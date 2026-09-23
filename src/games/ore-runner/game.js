/**
 * ORE RUNNER — Newtonian Asteroid Miner Engine
 * Zero-friction space flight physics, cargo capacity mass penalty (-30% speed/turn),
 * fuel depletion, unbanked cargo risk/reward, 5 asteroid tiers (8s Unstable Core),
 * pirate packs, derelict salvage, an endless streamed star field with remote outposts.
 */

import { initShell, escapeHtml, toast } from "/shared/shell.js";
import { createGameLoop, createInputManager, clamp, lerp, dist, angleDiff } from "/src/core/engine.js";
import { playTone, playLaser, playExplosion, playHit, playCoin, playPowerup, playWarningBeep } from "/src/core/audio.js";
import { saveGameScore } from "/src/core/save.js";
import { createParticles, vignette, scanlines, glow } from "/src/core/gfx.js";
import { buildSpace, buildShips, chunkSprite, asteroidSprite, drawAsteroidShading, drawStationArt } from "./art.js";

initShell({ crumb: "Ore Runner" });

const canvas = document.getElementById("or-canvas");
const ctx = canvas.getContext("2d");
canvas.width = 1280;
canvas.height = 720;

// Asteroid Tiers Definition
const ASTEROID_TIERS = [
  { id: "silicate", name: "Silicate Ore", value: 15, hp: 35, color: "#8a97b1", weight: 45 },
  { id: "metallic", name: "Metallic Ore", value: 40, hp: 60, color: "#c89d7c", weight: 25 },
  { id: "crystalline", name: "Crystal Ore", value: 90, hp: 80, color: "#00f0ff", weight: 15 },
  { id: "exotic", name: "Exotic Gold", value: 220, hp: 120, color: "#ffd700", weight: 10 },
  { id: "unstable", name: "Unstable Core", value: 450, hp: 90, color: "#ff2233", weight: 5, isUnstable: true }
];

// Player Ship State
const player = {
  x: 160,
  y: 0,
  vx: 0,
  vy: 0,
  angle: -Math.PI / 2,
  baseThrust: 220,
  baseTurnRate: 2.8,
  fuel: 100,
  maxFuel: 100,
  hp: 100,
  maxHp: 100,
  cargoCapacity: 25,
  cargo: [], // { type, value }
  bankedCredits: 0,
  isThrusting: false,
  isMining: false,
  miningBeam: null,
  isAlive: true,
  isDocked: false
};

// Throttled notifications so mining a rock doesn't bury the screen in toasts.
const toastGate = new Map();
function notify(key, opts, gapMs = 1500) {
  const now = performance.now();
  if (now - (toastGate.get(key) ?? -Infinity) < gapMs) return;
  toastGate.set(key, now);
  toast(opts);
}
let pendingCargo = { count: 0, value: 0, since: 0 };
let hitCooldown = 0;

// World Entities
const asteroids = [];
const oreChunks = [];
const particles = [];
const pirates = [];
const fx = createParticles(600);

// ---------------------------------------------------------------- open world
// Space is endless: it is cut into CHUNK-sized cells generated on demand from a seed, so every
// region looks the same when you come back. Mined rocks stay mined. Ore gets richer and pirates
// get meaner the further you fly from the home depot; remote outposts let you bank and refuel.
const CHUNK = 1400;
const LOAD_R = 2; // chunks kept live around the ship (5×5)
const WORLD_SEED = 0x5eed0;

// Home depot at the origin
const STATION = { x: 0, y: 0, radius: 120, dockRadius: 85, name: "HOME DEPOT", home: true };
const stations = [STATION];

const SALVAGE = { id: "salvage", name: "Salvage", value: 70, hp: 140, color: "#9ad0ff", weight: 0, isWreck: true };

function hashi(x, y, salt = 0) {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(salt | 0, 2246822519) + WORLD_SEED) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
}
function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// Smooth value noise over chunk coordinates (0..1)
function vnoise(x, y) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const fx = x - xi;
  const fy = y - yi;
  const r = (a, b) => hashi(a, b, 9) / 4294967296;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const top = r(xi, yi) + (r(xi + 1, yi) - r(xi, yi)) * sx;
  const bot = r(xi, yi + 1) + (r(xi + 1, yi + 1) - r(xi, yi + 1)) * sx;
  return top + (bot - top) * sy;
}
const density = (cx, cy) => vnoise(cx * 0.35, cy * 0.35) * 0.65 + vnoise(cx * 0.9 + 40, cy * 0.9 + 40) * 0.35;
const chunkOf = (v) => Math.floor((v + CHUNK / 2) / CHUNK);
const chunkDist = (cx, cy) => Math.hypot(cx, cy);

function regionName(cx, cy) {
  const d = chunkDist(cx, cy);
  const dn = density(cx, cy);
  if (d < 1.5) return "HOME BELT";
  if (dn < 0.3) return "THE QUIET VOID";
  if (d > 9 && dn > 0.55) return "PIRATE REACHES";
  if (dn > 0.66) return "DENSE ORE BELT";
  if (d > 5) return "DEEP FIELD";
  return "OUTER DRIFT";
}

function pickTier(rand, d) {
  const w = [
    Math.max(12, 45 - d * 3),
    25,
    15 + Math.min(10, d),
    10 + Math.min(16, d * 1.6),
    5 + Math.min(9, d)
  ];
  const total = w.reduce((a, b) => a + b, 0);
  let roll = rand() * total;
  for (let i = 0; i < w.length; i++) {
    roll -= w[i];
    if (roll <= 0) return ASTEROID_TIERS[i];
  }
  return ASTEROID_TIERS[0];
}

const chunks = new Map(); // "cx,cy" → { cx, cy, stations }
const mined = new Set(); // keys of broken asteroids / wrecks

function loadChunk(cx, cy) {
  const key = `${cx},${cy}`;
  if (chunks.has(key)) return;
  const rand = rng(hashi(cx, cy, 1));
  const d = chunkDist(cx, cy);
  const dn = density(cx, cy);
  const x0 = cx * CHUNK - CHUNK / 2;
  const y0 = cy * CHUNK - CHUNK / 2;
  const entry = { cx, cy, stations: [] };
  chunks.set(key, entry);

  // Remote outposts (never right next to home)
  if (d >= 2.5 && rand() < 0.09) {
    const st = { x: cx * CHUNK, y: cy * CHUNK, radius: 100, dockRadius: 75, name: `OUTPOST ${cx}:${cy}`, home: false, chunk: key };
    stations.push(st);
    entry.stations.push(st);
  }

  // Asteroid belt: denser in belts, sparse in voids
  const count = Math.round(2 + dn * dn * 30);
  const scale = 1 + Math.min(0.9, d * 0.06);
  for (let i = 0; i < count; i++) {
    const akey = `${key}:${i}`;
    const x = x0 + rand() * CHUNK;
    const y = y0 + rand() * CHUNK;
    const tier = pickTier(rand, d);
    const radius = (20 + rand() * 26) * (0.85 + rand() * 0.3) * Math.min(1.5, scale);
    const vx = (rand() - 0.5) * 14;
    const vy = (rand() - 0.5) * 14;
    const rot = rand() * Math.PI * 2;
    const rotSpeed = (rand() - 0.5) * 0.4;
    if (mined.has(akey)) continue;
    if (stations.some((s) => Math.hypot(s.x - x, s.y - y) < s.radius + radius + 200)) continue;
    asteroids.push({
      key: akey,
      chunk: key,
      x,
      y,
      vx,
      vy,
      radius,
      tier,
      value: Math.round(tier.value * scale),
      hp: tier.hp * Math.min(1.6, scale),
      maxHp: tier.hp * Math.min(1.6, scale),
      rotation: rot,
      rotSpeed,
      cracked: false,
      fuseTime: tier.isUnstable ? 8.0 : null
    });
  }

  // Derelict wrecks to salvage for credits and fuel cells
  if (d >= 1 && rand() < 0.3) {
    const wkey = `${key}:wreck`;
    const x = x0 + 200 + rand() * (CHUNK - 400);
    const y = y0 + 200 + rand() * (CHUNK - 400);
    if (!mined.has(wkey)) {
      asteroids.push({
        key: wkey,
        chunk: key,
        x,
        y,
        vx: (rand() - 0.5) * 6,
        vy: (rand() - 0.5) * 6,
        radius: 34,
        tier: SALVAGE,
        value: Math.round(SALVAGE.value * scale),
        hp: SALVAGE.hp,
        maxHp: SALVAGE.hp,
        rotation: rand() * Math.PI * 2,
        rotSpeed: (rand() - 0.5) * 0.08,
        cracked: false,
        fuseTime: null,
        wreckSeed: hashi(cx, cy, 7)
      });
    }
  }

  // Pirate scavengers: none near home, packs further out
  if (d >= 2) {
    const packs = rand() < Math.min(0.45, 0.08 + d * 0.03) ? 1 : 0;
    for (let p = 0; p < packs; p++) {
      const px = x0 + rand() * CHUNK;
      const py = y0 + rand() * CHUNK;
      // Lone scavengers are common; packs of 2–4 get likelier the deeper you go
      const size = rand() < Math.max(0.3, 0.7 - d * 0.04) ? 1 : 2 + Math.floor(rand() * Math.min(3, 1 + d * 0.15));
      for (let k = 0; k < size; k++) {
        pirates.push({
          chunk: key,
          x: px + (rand() - 0.5) * 160,
          y: py + (rand() - 0.5) * 160,
          vx: 0,
          vy: 0,
          angle: rand() * Math.PI * 2,
          hp: 60 + d * 6,
          maxHp: 60 + d * 6,
          dmg: Math.round(12 + Math.min(16, d * 1.2)),
          bounty: Math.round(50 + d * 12),
          attackCd: 1 + rand() * 1.5,
          isAlive: true
        });
      }
    }
  }
}

function unloadChunk(key) {
  const entry = chunks.get(key);
  if (!entry) return;
  chunks.delete(key);
  for (let i = asteroids.length - 1; i >= 0; i--) if (asteroids[i].chunk === key && !asteroids[i].cracked) asteroids.splice(i, 1);
  for (let i = pirates.length - 1; i >= 0; i--) {
    const p = pirates[i];
    // Pirates locked onto the ship keep chasing across chunk borders
    if (p.chunk === key && dist(p.x, p.y, player.x, player.y) > 900) pirates.splice(i, 1);
  }
  for (const s of entry.stations) {
    const i = stations.indexOf(s);
    if (i > 0) stations.splice(i, 1);
  }
}

let streamTimer = 0;
function streamChunks(dt, force = false) {
  streamTimer -= dt;
  if (!force && streamTimer > 0) return;
  streamTimer = 0.25;
  const pcx = chunkOf(player.x);
  const pcy = chunkOf(player.y);
  for (let dy = -LOAD_R; dy <= LOAD_R; dy++) for (let dx = -LOAD_R; dx <= LOAD_R; dx++) loadChunk(pcx + dx, pcy + dy);
  for (const [key, c] of chunks) if (Math.abs(c.cx - pcx) > LOAD_R + 1 || Math.abs(c.cy - pcy) > LOAD_R + 1) unloadChunk(key);
  // Loose ore far behind the ship evaporates
  for (let i = oreChunks.length - 1; i >= 0; i--) if (dist(oreChunks[i].x, oreChunks[i].y, player.x, player.y) > CHUNK * 2.5) oreChunks.splice(i, 1);
}

function nearestStation() {
  let best = STATION;
  let bd = Infinity;
  for (const s of stations) {
    const d = dist(s.x, s.y, player.x, player.y);
    if (d < bd) {
      bd = d;
      best = s;
    }
  }
  return best;
}

streamChunks(0, true);

// Setup Input
const input = createInputManager({
  canvas,
  buttons: [
    { id: "thrust", label: "THRUST" },
    { id: "brake", label: "RETRO" },
    { id: "mine", label: "MINE" }
  ]
});

// Primary Update Loop
function update(dt) {
  fx.update(dt);
  if (!player.isAlive) return;

  hitCooldown = Math.max(0, hitCooldown - dt);

  // Emergency solar trickle: never leave the pilot permanently stranded with empty tanks.
  if (player.fuel < 15 && !input.isDown("KeyW") && !input.isDown("ArrowUp") && !input.isDown("Space")) {
    player.fuel = Math.min(15, player.fuel + dt * 0.6);
  }

  // 1. Controls & Mass Penalty
  // Each cargo unit adds mass, reducing accel and turn speed by up to 30%
  const cargoRatio = player.cargo.length / player.cargoCapacity;
  const massMult = 1.0 + cargoRatio * 0.45; // up to 1.45 mass
  const effectiveThrust = (player.baseThrust / massMult);
  const effectiveTurn = (player.baseTurnRate / (1.0 + cargoRatio * 0.3));

  let turn = 0;
  if (input.isDown("KeyA") || input.isDown("ArrowLeft")) turn -= 1;
  if (input.isDown("KeyD") || input.isDown("ArrowRight")) turn += 1;

  if (input.stick.active) {
    turn = input.stick.x;
  }

  player.angle += turn * effectiveTurn * dt;

  // Thrust (W / Up / Virtual Thrust)
  player.isThrusting = (input.isDown("KeyW") || input.isDown("ArrowUp") || input.isDown("Space") || input.isPressed("thrust")) && player.fuel > 0;

  if (player.isThrusting) {
    player.vx += Math.cos(player.angle) * effectiveThrust * dt;
    player.vy += Math.sin(player.angle) * effectiveThrust * dt;
    player.fuel = Math.max(0, player.fuel - dt * 2.8);

    // Engine exhaust particles
    for (let i = 0; i < 2; i++) {
      particles.push({
        x: player.x - Math.cos(player.angle) * 16,
        y: player.y - Math.sin(player.angle) * 16,
        vx: -Math.cos(player.angle) * 140 + (Math.random() - 0.5) * 40,
        vy: -Math.sin(player.angle) * 140 + (Math.random() - 0.5) * 40,
        life: 0.25,
        color: "#ff7700"
      });
    }

    if (Math.random() < 0.2) playTone(90, 0.08, "sawtooth", 0.04);
  }

  // Retro-Braking (S / Down / Brake button)
  const isBraking = (input.isDown("KeyS") || input.isDown("ArrowDown") || input.isPressed("brake")) && player.fuel > 0;
  if (isBraking) {
    const curSpeed = Math.hypot(player.vx, player.vy);
    if (curSpeed > 2) {
      const brakeX = -player.vx / curSpeed;
      const brakeY = -player.vy / curSpeed;
      player.vx += brakeX * effectiveThrust * 0.8 * dt;
      player.vy += brakeY * effectiveThrust * 0.8 * dt;
      player.fuel = Math.max(0, player.fuel - dt * 2.0);
    }
  }

  // Newtonian Integration (ZERO DRAG / ZERO FRICTION)
  player.x += player.vx * dt;
  player.y += player.vy * dt;

  // Endless space: stream chunks in around the ship
  streamChunks(dt);

  // 2. Docking Bay Station Interaction
  checkStationDocking(dt);

  // 3. Mining Laser (F / Left Click / Mine button)
  player.isMining = input.isDown("KeyF") || input.isDown("KeyE") || input.isPressed("mine");
  if (player.isMining) {
    fireMiningLaser(dt);
  } else {
    player.miningBeam = null;
  }

  // 4. Update Asteroids (Drift & Unstable Fuse)
  updateAsteroids(dt);

  // 5. Update Floating Ore Chunks
  updateOreChunks(dt);

  // 6. Update Pirate Drones
  updatePirates(dt);

  // 7. Update Particles
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
    if (p.life <= 0) particles.splice(i, 1);
  }

  updateHUD();
}

function checkStationDocking(dt) {
  const STATION = nearestStation();
  const d = dist(player.x, player.y, STATION.x, STATION.y);
  const curSpeed = Math.hypot(player.vx, player.vy);

  if (d <= STATION.dockRadius) {
    // Tractor beam gently dampens momentum
    player.vx = lerp(player.vx, 0, dt * 3.5);
    player.vy = lerp(player.vy, 0, dt * 3.5);

    if (curSpeed < 50 && !player.isDocked) {
      player.isDocked = true;

      // Bank all cargo
      let depositedCredits = 0;
      player.cargo.forEach((c) => {
        depositedCredits += c.value;
      });

      player.bankedCredits += depositedCredits;
      player.cargo.length = 0;
      player.fuel = player.maxFuel;
      player.hp = player.maxHp;

      playPowerup();
      playCoin();

      // Persist Banked High Score
      saveGameScore("ore-runner", player.bankedCredits, `${player.bankedCredits} BANKED CREDITS`);

      toast({
        title: `${STATION.name} DOCKED`,
        body: depositedCredits > 0 ? `Deposited ${depositedCredits} Credits! Refueled & Repaired.` : "Tanks Refueled & Hull Repaired.",
        icon: "gem"
      });
    }
  } else {
    player.isDocked = false;
  }
}

function fireMiningLaser(dt) {
  const maxRange = 220;
  const beamTipX = player.x + Math.cos(player.angle) * maxRange;
  const beamTipY = player.y + Math.sin(player.angle) * maxRange;

  let hitTarget = null;
  let hitDist = maxRange;

  // Check collision with asteroids
  asteroids.forEach((a) => {
    const d = dist(player.x, player.y, a.x, a.y);
    if (d > maxRange + a.radius + 10) return;
    const toA = Math.atan2(a.y - player.y, a.x - player.x);
    const diff = Math.abs(angleDiff(toA, player.angle));

    if (d < maxRange + a.radius && diff < 0.25) {
      if (d < hitDist) {
        hitDist = d;
        hitTarget = a;
      }
    }
  });

  // The mining laser also works as a (weak) weapon against scavenger drones.
  let hitPirate = null;
  pirates.forEach((p) => {
    if (!p.isAlive) return;
    const d = dist(player.x, player.y, p.x, p.y);
    if (d > maxRange + 20) return;
    const diff = Math.abs(angleDiff(Math.atan2(p.y - player.y, p.x - player.x), player.angle));
    if (d < maxRange && diff < 0.2 && d < hitDist) {
      hitDist = d;
      hitPirate = p;
      hitTarget = null;
    }
  });
  if (hitPirate) {
    hitPirate.hp -= dt * 60;
    if (hitPirate.hp <= 0) {
      hitPirate.isAlive = false;
      playExplosion({ duration: 0.5, lowpass: 600 });
      fx.burst(hitPirate.x, hitPirate.y, { count: 26, speed: 200, life: 0.7, size: 3, color: "#ffd166", color2: "#ff2233", kind: "pixel", drag: 0.94 });
      fx.spawn({ x: hitPirate.x, y: hitPirate.y, life: 0.35, size: 50, color: "#ff5a1f", kind: "glow", alpha: 0.8 });
      const bounty = hitPirate.bounty || 60;
      player.bankedCredits += bounty;
      saveGameScore("ore-runner", player.bankedCredits, `${player.bankedCredits} BANKED CREDITS`);
      toast({ title: "SCAVENGER DOWN", body: `Bounty +${bounty} C banked`, icon: "trophy" });
      for (let i = 0; i < 14; i++) {
        particles.push({ x: hitPirate.x, y: hitPirate.y, vx: (Math.random() - 0.5) * 200, vy: (Math.random() - 0.5) * 200, life: 0.5, color: "#ff2233" });
      }
    }
  }

  const actualTipX = player.x + Math.cos(player.angle) * hitDist;
  const actualTipY = player.y + Math.sin(player.angle) * hitDist;
  player.miningBeam = { x1: player.x, y1: player.y, x2: actualTipX, y2: actualTipY };

  if (hitTarget) {
    hitTarget.hp -= dt * 45;

    // Sparks
    particles.push({
      x: actualTipX,
      y: actualTipY,
      vx: (Math.random() - 0.5) * 80,
      vy: (Math.random() - 0.5) * 80,
      life: 0.15,
      color: hitTarget.tier.color
    });

    if (Math.random() < 0.1) playLaser({ startFreq: 480, endFreq: 320, duration: 0.05 });

    // If Unstable Core hit, start 8s detonation clock
    if (hitTarget.tier.isUnstable && !hitTarget.cracked) {
      hitTarget.cracked = true;
      playWarningBeep();
      toast({ title: "UNSTABLE ISOTOPE CRACKED!", body: "Detonation in 8 SECONDS! Mine and RUN!", icon: "skull", duration: 5000 });
    }

    if (hitTarget.hp <= 0) {
      breakAsteroid(hitTarget);
    }
  }
}

function breakAsteroid(a) {
  const idx = asteroids.indexOf(a);
  if (idx !== -1) asteroids.splice(idx, 1);
  if (a.key) mined.add(a.key);
  if (a.tier.isWreck) {
    // Fuel cells tumble out of the hulk alongside the salvage
    for (let i = 0; i < 2; i++) {
      const ang = Math.random() * Math.PI * 2;
      oreChunks.push({ x: a.x, y: a.y, vx: a.vx + Math.cos(ang) * 50, vy: a.vy + Math.sin(ang) * 50, tier: SALVAGE, value: 0, fuel: 30 });
    }
    toast({ title: "WRECK BREACHED", body: "Salvage and fuel cells floating free.", icon: "gem" });
  }

  playExplosion({ duration: 0.6, lowpass: 280 });
  fx.burst(a.x, a.y, { count: 22, speed: 140, life: 1.1, size: 4, color: "#8a8f99", color2: "#4a4e56", kind: "shard", vr: 6, drag: 0.97 });
  fx.burst(a.x, a.y, { count: 10, speed: 90, life: 0.6, size: 3, color: a.tier.color, kind: "pixel", drag: 0.95 });
  fx.spawn({ x: a.x, y: a.y, life: 0.3, size: a.radius * 2, color: a.tier.color, kind: "glow", alpha: 0.6 });

  // Spawn Ore Chunks
  const chunkCount = 3 + Math.floor(Math.random() * 3);
  for (let i = 0; i < chunkCount; i++) {
    const ang = Math.random() * Math.PI * 2;
    oreChunks.push({
      x: a.x + Math.cos(ang) * 12,
      y: a.y + Math.sin(ang) * 12,
      vx: a.vx + Math.cos(ang) * 55,
      vy: a.vy + Math.sin(ang) * 55,
      tier: a.tier,
      value: a.value ?? a.tier.value
    });
  }

  // Debris particles
  for (let i = 0; i < 12; i++) {
    particles.push({
      x: a.x, y: a.y,
      vx: (Math.random() - 0.5) * 120,
      vy: (Math.random() - 0.5) * 120,
      life: 0.4,
      color: a.tier.color
    });
  }
}

function updateAsteroids(dt) {
  asteroids.forEach((a) => {
    a.x += a.vx * dt;
    a.y += a.vy * dt;
    a.rotation += a.rotSpeed * dt;
    // Keep rocks out of the docking rings.
    for (const st of stations) {
      if (Math.abs(a.x - st.x) < 400 && dist(a.x, a.y, st.x, st.y) < st.radius + a.radius) {
        const ang = Math.atan2(a.y - st.y, a.x - st.x);
        a.vx = Math.cos(ang) * 12;
        a.vy = Math.sin(ang) * 12;
      }
    }

    // Unstable Core Fuse Timer
    if (a.cracked && a.fuseTime !== null) {
      a.fuseTime -= dt;
      if (a.fuseTime <= 0) {
        detonateUnstableCore(a);
      }
    }

    // Ship collision with asteroid
    if (Math.abs(player.x - a.x) > a.radius + 20 || Math.abs(player.y - a.y) > a.radius + 20) return;
    const d = dist(player.x, player.y, a.x, a.y);
    if (d < a.radius + 12) {
      const impactSpeed = Math.hypot(player.vx - a.vx, player.vy - a.vy);
      const bounceAng = Math.atan2(player.y - a.y, player.x - a.x);
      const nx = Math.cos(bounceAng);
      const ny = Math.sin(bounceAng);
      // Push the ship back out so it can never end up inside a rock.
      player.x = a.x + nx * (a.radius + 12.5);
      player.y = a.y + ny * (a.radius + 12.5);
      if (impactSpeed > 75 && hitCooldown <= 0) {
        hitCooldown = 0.6;
        const dmg = Math.round(impactSpeed * 0.4);
        player.hp -= dmg;
        playHit({ pitch: 70, duration: 0.25 });
        notify("impact", { title: "HULL IMPACT!", body: `Took ${dmg} damage!`, icon: "alert" });

        // Bounce back
        player.vx = a.vx + nx * impactSpeed * 0.6;
        player.vy = a.vy + ny * impactSpeed * 0.6;

        if (player.hp <= 0) {
          killPlayer("Crushed in asteroid collision");
        }
      } else {
        // Gentle contact: cancel the closing velocity instead of sliding through.
        const vn = (player.vx - a.vx) * nx + (player.vy - a.vy) * ny;
        if (vn < 0) {
          player.vx -= vn * nx;
          player.vy -= vn * ny;
        }
      }
    }
  });
}

function detonateUnstableCore(a) {
  const idx = asteroids.indexOf(a);
  if (idx !== -1) asteroids.splice(idx, 1);

  playExplosion({ duration: 1.8, lowpass: 140 });

  // Massive blast radius 240px
  const blastRadius = 240;
  const d = dist(player.x, player.y, a.x, a.y);

  if (d <= blastRadius) {
    const dmg = Math.round((1 - d / blastRadius) * 130);
    player.hp -= dmg;
    toast({ title: "CORE DETONATION!", body: `Nuclear shockwave dealt ${dmg} damage!`, icon: "skull" });
    if (player.hp <= 0) {
      killPlayer("Vaporized by Unstable Core detonation");
    }
  }

  for (let i = 0; i < 30; i++) {
    particles.push({
      x: a.x, y: a.y,
      vx: (Math.random() - 0.5) * 340,
      vy: (Math.random() - 0.5) * 340,
      life: 0.8,
      color: "#ff2233"
    });
  }
}

function updateOreChunks(dt) {
  const tractorDist = 120;
  for (let i = oreChunks.length - 1; i >= 0; i--) {
    const chunk = oreChunks[i];
    chunk.x += chunk.vx * dt;
    chunk.y += chunk.vy * dt;

    const d = dist(player.x, player.y, chunk.x, chunk.y);

    // Magnetic tractor beam
    if (chunk.fuel && d < tractorDist) {
      const ang = Math.atan2(player.y - chunk.y, player.x - chunk.x);
      chunk.vx += Math.cos(ang) * 320 * dt;
      chunk.vy += Math.sin(ang) * 320 * dt;
      if (d < 16) {
        player.fuel = Math.min(player.maxFuel, player.fuel + chunk.fuel);
        oreChunks.splice(i, 1);
        playPowerup();
        notify("fuelcell", { title: "FUEL CELL", body: `+${chunk.fuel} fuel`, icon: "check" }, 800);
        continue;
      }
    } else if (d < tractorDist && player.cargo.length < player.cargoCapacity) {
      const ang = Math.atan2(player.y - chunk.y, player.x - chunk.x);
      chunk.vx += Math.cos(ang) * 320 * dt;
      chunk.vy += Math.sin(ang) * 320 * dt;

      if (d < 16) {
        player.cargo.push({ type: chunk.tier.id, value: chunk.value });
        oreChunks.splice(i, 1);
        playCoin();
        pendingCargo.count += 1;
        pendingCargo.value += chunk.value;
        pendingCargo.since = performance.now();
        continue;
      }
    } else if (d < tractorDist) {
      notify("full", { title: "CARGO HOLD FULL", body: "Return to the depot to bank your ore.", icon: "alert" }, 6000);
    }
    // Loose chunks slowly lose momentum and stay inside the field.
    chunk.vx *= 1 - dt * 0.2;
    chunk.vy *= 1 - dt * 0.2;
  }
  if (pendingCargo.count && performance.now() - pendingCargo.since > 600) {
    toast({ title: "CARGO LOADED", body: `${pendingCargo.count} chunk${pendingCargo.count === 1 ? "" : "s"} (+${pendingCargo.value} C unbanked)`, icon: "gem", duration: 2200 });
    pendingCargo = { count: 0, value: 0, since: 0 };
  }
}

function updatePirates(dt) {
  pirates.forEach((p) => {
    if (!p.isAlive) return;

    const d = dist(player.x, player.y, p.x, p.y);
    if (d < 550) {
      const toPlayer = Math.atan2(player.y - p.y, player.x - p.x);
      p.angle += angleDiff(toPlayer, p.angle) * Math.min(1, dt * 2.0);
      p.x += Math.cos(p.angle) * 110 * dt;
      p.y += Math.sin(p.angle) * 110 * dt;
      for (const o of pirates) {
        if (o === p || !o.isAlive) continue;
        const sep = dist(o.x, o.y, p.x, p.y);
        if (sep < 40 && sep > 0) {
          p.x += ((p.x - o.x) / sep) * 60 * dt;
          p.y += ((p.y - o.y) / sep) * 60 * dt;
        }
      }

      p.attackCd -= dt;
      if (p.attackCd <= 0 && d < 380) {
        p.attackCd = 1.6;
        // Fire plasma bolt
        particles.push({
          x: p.x, y: p.y,
          vx: Math.cos(p.angle) * 260,
          vy: Math.sin(p.angle) * 260,
          life: 1.4,
          isPlasma: true,
          dmg: p.dmg || 14,
          color: "#ff0044"
        });
        playLaser({ startFreq: 260, endFreq: 120, duration: 0.1 });
      }
    }
  });

  for (let i = pirates.length - 1; i >= 0; i--) if (!pirates[i].isAlive) pirates.splice(i, 1);

  // Check plasma bolt hit on player
  particles.forEach((p) => {
    if (p.isPlasma && p.life > 0 && dist(p.x, p.y, player.x, player.y) < 16) {
      player.hp -= p.dmg || 14;
      p.life = 0;
      playHit({ pitch: 120, duration: 0.15 });
      if (player.hp <= 0) killPlayer("Vaporized by pirate scavenger");
    }
  });
}

function killPlayer(reason) {
  player.isAlive = false;
  playExplosion({ duration: 1.6, lowpass: 130 });

  const unbankedLost = player.cargo.reduce((a, b) => a + b.value, 0);

  saveGameScore("ore-runner", player.bankedCredits, `${player.bankedCredits} BANKED CREDITS`, { details: `${reason} // Lost ${unbankedLost} unbanked cargo` });

  const modal = document.getElementById("or-death-modal");
  if (modal) {
    modal.style.display = "flex";
    document.getElementById("or-death-stats").innerHTML = `
      <span>BANKED CREDITS SECURED: ${player.bankedCredits} C</span>
      <span>UNBANKED CARGO DESTROYED: ${unbankedLost} C</span>
      <span>CAUSE: ${escapeHtml(reason.toUpperCase())}</span>
    `;
  }
}

function updateHUD() {
  const hpFill = document.getElementById("hud-hp-fill");
  const fuelFill = document.getElementById("hud-fuel-fill");
  const speedEl = document.getElementById("hud-speed");
  const cargoEl = document.getElementById("hud-cargo");
  const bankedEl = document.getElementById("hud-banked");

  const curSpeed = Math.round(Math.hypot(player.vx, player.vy));

  if (hpFill) hpFill.style.width = `${Math.max(0, player.hp)}%`;
  if (fuelFill) fuelFill.style.width = `${Math.max(0, player.fuel)}%`;
  if (speedEl) speedEl.textContent = `${curSpeed} M/S`;
  if (cargoEl) cargoEl.textContent = `${player.cargo.length} / ${player.cargoCapacity}`;
  if (bankedEl) bankedEl.textContent = `${player.bankedCredits} C`;
}

// Render Engine
// ---------- Rendering ----------
const space = buildSpace();
const ships = buildShips();

function tileLayer(img, camX, camY, factor) {
  const w = img.width;
  const h = img.height;
  const ox = -((((camX * factor) % w) + w) % w);
  const oy = -((((camY * factor) % h) + h) % h);
  for (let x = ox; x < canvas.width; x += w) {
    for (let y = oy; y < canvas.height; y += h) ctx.drawImage(img, Math.floor(x), Math.floor(y));
  }
}

function render() {
  const t = performance.now() / 1000;
  const W = canvas.width;
  const H = canvas.height;
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = "#03040a";
  ctx.fillRect(0, 0, W, H);

  const camX = Math.round(player.x - W / 2);
  const camY = Math.round(player.y - H / 2);

  // 1. Deep space: nebula, far planet, three star layers at different depths
  tileLayer(space.nebula, camX, camY, 0.08);
  ctx.globalAlpha = 0.9;
  tileLayer(space.starsFar, camX, camY, 0.12);
  ctx.globalAlpha = 1;
  // Distant planets repeat across the parallax sky so every direction has a landmark
  const SPAN = 3200;
  const pxr = ((((1060 - camX * 0.04) % SPAN) + SPAN) % SPAN) - 600;
  const pyr = ((((160 - camY * 0.04) % SPAN) + SPAN) % SPAN) - 600;
  const pk = Math.floor((camX * 0.04) / SPAN) + Math.floor((camY * 0.04) / SPAN) * 7;
  const planet = space.planets[((pk % space.planets.length) + space.planets.length) % space.planets.length];
  ctx.drawImage(planet, Math.round(pxr - planet.width / 2), Math.round(pyr - planet.height / 2));
  tileLayer(space.starsMid, camX, camY, 0.3);
  tileLayer(space.starsNear, camX, camY, 0.6);

  ctx.save();
  ctx.translate(-camX, -camY);

  // 2. Depot and outposts
  for (const st of stations) {
    if (st.x < camX - 300 || st.x > camX + W + 300 || st.y < camY - 300 || st.y > camY + H + 300) continue;
    drawStationArt(ctx, st.x, st.y, t, st.dockRadius, st.radius);
    ctx.font = '9px "Press Start 2P", monospace';
    ctx.textAlign = "center";
    ctx.fillStyle = "#000";
    ctx.fillText(st.name, st.x + 1, st.y - st.radius - 13);
    ctx.fillStyle = st.home ? "#ffd700" : "#7fe7ff";
    ctx.fillText(st.name, st.x, st.y - st.radius - 14);
    ctx.textAlign = "left";
  }

  // 3. Asteroids
  asteroids.forEach((a) => {
    if (a.x < camX - 80 || a.x > camX + W + 80 || a.y < camY - 80 || a.y > camY + H + 80) return;
    if (a.tier.isWreck) drawWreck(a, t);
    else drawAsteroid(a, t);
  });

  // 4. Ore chunks (glowing crystal shards)
  oreChunks.forEach((c, i) => {
    if (c.x < camX - 40 || c.x > camX + W + 40 || c.y < camY - 40 || c.y > camY + H + 40) return;
    if (c.fuel) {
      glow(ctx, c.x, c.y, 18, "#39ff88", 0.5);
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate(t * 1.5 + i);
      ctx.fillStyle = "#1b2a22";
      ctx.fillRect(-5, -8, 10, 16);
      ctx.fillStyle = "#39ff88";
      ctx.fillRect(-3, -6, 6, 12 * (0.6 + Math.sin(t * 4 + i) * 0.2));
      ctx.fillStyle = "#c9d6e6";
      ctx.fillRect(-4, -10, 8, 2);
      ctx.restore();
      return;
    }
    const s = chunkSprite(ships, c.tier.color);
    glow(ctx, c.x, c.y, 16, c.tier.color, 0.45);
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.rotate(t * 2 + i);
    ctx.drawImage(s, -s.width / 2, -s.height / 2);
    ctx.restore();
  });

  // 5. Particles: exhaust embers, sparks, plasma bolts
  particles.forEach((p) => {
    if (p.isPlasma) {
      glow(ctx, p.x, p.y, 14, "#ff2233", 0.7);
      ctx.fillStyle = "#ffd0d0";
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    const k = Math.max(0, Math.min(1, (p.life || 0) / 0.4));
    ctx.globalAlpha = k;
    ctx.fillStyle = p.color;
    const s = 1 + Math.round(k * 2);
    ctx.fillRect(Math.round(p.x - s / 2), Math.round(p.y - s / 2), s, s);
  });
  ctx.globalAlpha = 1;
  fx.draw(ctx);

  // 6. Mining laser: wide soft beam, bright core, impact flare
  if (player.miningBeam) {
    const b = player.miningBeam;
    const flick = 0.8 + Math.random() * 0.2;
    ctx.lineCap = "round";
    ctx.strokeStyle = `rgba(0, 240, 255, ${0.25 * flick})`;
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.moveTo(b.x1, b.y1);
    ctx.lineTo(b.x2, b.y2);
    ctx.stroke();
    ctx.strokeStyle = `rgba(120, 250, 255, ${0.8 * flick})`;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.lineCap = "butt";
    glow(ctx, b.x2, b.y2, 22, "#00f0ff", 0.7);
  }

  // 7. Scavenger drones
  pirates.forEach((p) => {
    if (!p.isAlive) return;
    if (p.x < camX - 60 || p.x > camX + W + 60 || p.y < camY - 60 || p.y > camY + H + 60) return;
    glow(ctx, p.x, p.y, 26, "#ff2233", 0.25 + Math.sin(t * 6 + p.x) * 0.08);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle + t * 0.5);
    ctx.drawImage(ships.drone, -ships.drone.width / 2, -ships.drone.height / 2);
    ctx.restore();
  });

  // 8. Player miner
  if (player.isAlive) drawPlayerShip(t);

  ctx.restore();

  // 9. Screen treatments + HUD cues
  vignette(ctx, W, H, 0.55);
  scanlines(ctx, W, H, 0.05);

  if (!player.isAlive) return;
  drawStationPointer();
  drawRadar(t);
  drawSectorTag();
  if (player.fuel <= 15) {
    ctx.save();
    ctx.fillStyle = Math.floor(performance.now() / 400) % 2 ? "#ff2233" : "#ffd700";
    ctx.font = '10px "Press Start 2P", monospace';
    ctx.textAlign = "center";
    ctx.fillText(player.fuel <= 0.5 ? "FUEL DRY — SOLAR TRICKLE CHARGING" : "LOW FUEL — RETURN TO DEPOT", canvas.width / 2, canvas.height - 24);
    ctx.restore();
  }
}

// Screen-edge arrow pointing home to the depot, with distance.
function drawStationPointer() {
  const STATION = nearestStation();
  const dx = STATION.x - player.x;
  const dy = STATION.y - player.y;
  if (Math.abs(dx) < canvas.width / 2 - 40 && Math.abs(dy) < canvas.height / 2 - 40) return;
  const d = Math.hypot(dx, dy);
  const ang = Math.atan2(dy, dx);
  const halfW = canvas.width / 2 - 36;
  const halfH = canvas.height / 2 - 36;
  const edge = Math.min(halfW / Math.max(1e-6, Math.abs(Math.cos(ang))), halfH / Math.max(1e-6, Math.abs(Math.sin(ang))));
  const x = canvas.width / 2 + Math.cos(ang) * edge;
  const y = canvas.height / 2 + Math.sin(ang) * edge;
  glow(ctx, x, y, 22, "#ffd700", 0.35);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  ctx.fillStyle = "#ffd700";
  ctx.beginPath();
  ctx.moveTo(14, 0);
  ctx.lineTo(-8, -8);
  ctx.lineTo(-4, 0);
  ctx.lineTo(-8, 8);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.font = '8px "Press Start 2P", monospace';
  ctx.textAlign = "center";
  const lx = x - Math.cos(ang) * 34;
  const ly = y - Math.sin(ang) * 24 + 4;
  ctx.fillStyle = "#000000";
  const label = `${STATION.home ? "DEPOT" : "OUTPOST"} ${Math.round(d)}m`;
  ctx.fillText(label, lx + 1, ly + 1);
  ctx.fillStyle = "#ffd700";
  ctx.fillText(label, lx, ly);
  ctx.restore();
}

// Short-range radar: ore by tier colour, wrecks, pirates, depots
function drawRadar(t) {
  const R = 78;
  const range = 2400;
  const cx = canvas.width - R - 18;
  const cy = canvas.height - R - 18;
  ctx.save();
  ctx.fillStyle = "rgba(4, 8, 14, 0.72)";
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 140, 40, 0.5)";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.strokeStyle = "rgba(255, 140, 40, 0.18)";
  for (const r of [R / 3, (2 * R) / 3]) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  const sweep = (t * 1.6) % (Math.PI * 2);
  ctx.fillStyle = "rgba(255, 140, 40, 0.12)";
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.arc(cx, cy, R, sweep - 0.5, sweep);
  ctx.closePath();
  ctx.fill();
  const blip = (x, y, color, size) => {
    const dx = (x - player.x) / range;
    const dy = (y - player.y) / range;
    if (Math.hypot(dx, dy) > 1) return;
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(cx + dx * R - size / 2), Math.round(cy + dy * R - size / 2), size, size);
  };
  for (const a of asteroids) blip(a.x, a.y, a.tier.isWreck ? "#9ad0ff" : a.tier.color, a.tier.isWreck ? 4 : 2);
  for (const p of pirates) if (p.isAlive) blip(p.x, p.y, Math.sin(t * 8) > 0 ? "#ff2233" : "#ff7788", 3);
  for (const st of stations) blip(st.x, st.y, st.home ? "#ffd700" : "#7fe7ff", 6);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(cx - 1.5, cy - 1.5, 3, 3);
  ctx.restore();
}

function drawSectorTag() {
  const cx = chunkOf(player.x);
  const cy = chunkOf(player.y);
  const name = regionName(cx, cy);
  const far = Math.round(Math.hypot(player.x, player.y));
  ctx.save();
  ctx.font = '9px "Press Start 2P", monospace';
  ctx.textAlign = "center";
  const text = `SECTOR ${cx}:${cy} // ${name} // ${far}m FROM HOME`;
  ctx.fillStyle = "rgba(4, 8, 14, 0.7)";
  const w = ctx.measureText(text).width + 24;
  ctx.fillRect(canvas.width / 2 - w / 2, 12, w, 22);
  ctx.fillStyle = name === "PIRATE REACHES" ? "#ff5a6a" : "#ffb86b";
  ctx.fillText(text, canvas.width / 2, 27);
  ctx.restore();
}

// Derelict freighter hulk: broken hull plates, exposed ribs, flickering running lights
function drawWreck(a, t) {
  const r = rng(a.wreckSeed || 1);
  ctx.save();
  ctx.translate(a.x, a.y);
  ctx.rotate(a.rotation);
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.fillRect(-36, -12, 76, 30);
  ctx.fillStyle = "#3b4350";
  ctx.beginPath();
  ctx.moveTo(-40, -10);
  ctx.lineTo(18, -14);
  ctx.lineTo(38, -4);
  ctx.lineTo(34, 8);
  ctx.lineTo(10, 14);
  ctx.lineTo(-6, 6);
  ctx.lineTo(-18, 13);
  ctx.lineTo(-40, 9);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#566070";
  ctx.fillRect(-36, -9, 50, 3);
  ctx.strokeStyle = "#1c2129";
  ctx.lineWidth = 1;
  for (let k = -32; k < 30; k += 8) {
    ctx.beginPath();
    ctx.moveTo(k, -11);
    ctx.lineTo(k + (r() - 0.5) * 3, 10);
    ctx.stroke();
  }
  ctx.fillStyle = "#0b0e13";
  ctx.beginPath();
  ctx.ellipse(-4, 0, 9, 6, 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#8b95a5";
  for (let k = -10; k <= 2; k += 4) {
    ctx.beginPath();
    ctx.moveTo(k, -5);
    ctx.lineTo(k + 2, 5);
    ctx.stroke();
  }
  ctx.fillStyle = "#b8742a";
  ctx.fillRect(16, -6, 8, 6);
  ctx.fillStyle = "#7a8a9a";
  ctx.fillRect(24, 1, 7, 5);
  if (Math.sin(t * 3 + a.x) > 0.3) {
    ctx.fillStyle = "#ff3344";
    ctx.fillRect(-39, -2, 2, 2);
  }
  if (Math.sin(t * 5 + a.y) > 0.6) {
    ctx.fillStyle = "#9ad0ff";
    ctx.fillRect(35, -2, 2, 2);
  }
  ctx.restore();
  const dmg = 1 - a.hp / a.maxHp;
  if (dmg > 0) {
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(a.x - 20, a.y - 30, 40, 4);
    ctx.fillStyle = "#9ad0ff";
    ctx.fillRect(a.x - 20, a.y - 30, 40 * (1 - dmg), 4);
  }
}

function drawAsteroid(a, t) {
  if (!a.sprite) a.sprite = asteroidSprite(a.radius, a.tier.id, Math.floor(a.x * 13 + a.y * 7) >>> 0);
  const s = a.sprite;
  // Unstable cores throb red (faster once cracked)
  if (a.tier.isUnstable) {
    const rate = a.cracked ? 10 + (8 - (a.fuseTime ?? 8)) * 3 : 3;
    glow(ctx, a.x, a.y, a.radius * 2.2, "#ff2233", 0.3 + Math.sin(t * rate) * 0.18);
  } else if (a.tier.id === "crystalline" || a.tier.id === "exotic") {
    glow(ctx, a.x, a.y, a.radius * 1.8, a.tier.color, 0.1);
  }
  ctx.save();
  ctx.translate(a.x, a.y);
  ctx.rotate(a.rotation);
  ctx.drawImage(s, -s.width / 2, -s.height / 2);
  // Damage cracks grow as the rock is mined
  const dmg = 1 - a.hp / a.maxHp;
  if (dmg > 0.15) {
    ctx.strokeStyle = `rgba(255, 220, 160, ${0.25 + dmg * 0.5})`;
    ctx.lineWidth = 1;
    const cracks = Math.ceil(dmg * 5);
    for (let i = 0; i < cracks; i++) {
      const ang = i * 2.4;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(ang) * a.radius * 0.45, Math.sin(ang) * a.radius * 0.45);
      ctx.lineTo(Math.cos(ang + 0.3) * a.radius * 0.8, Math.sin(ang + 0.3) * a.radius * 0.8);
      ctx.stroke();
    }
  }
  ctx.restore();
  drawAsteroidShading(ctx, a.x, a.y, a.radius * 0.85);

  // Unstable Core countdown
  if (a.tier.isUnstable && a.cracked) {
    ctx.font = '10px "Press Start 2P", monospace';
    ctx.textAlign = "center";
    ctx.fillStyle = "#000000";
    ctx.fillText(`${a.fuseTime.toFixed(1)}s!`, a.x + 1, a.y + 5);
    ctx.fillStyle = "#ffffff";
    ctx.fillText(`${a.fuseTime.toFixed(1)}s!`, a.x, a.y + 4);
    ctx.textAlign = "left";
  }
}

function drawPlayerShip(t) {
  // Engine plume while thrusting
  if (player.isThrusting) {
    const bx = player.x - Math.cos(player.angle) * 20;
    const by = player.y - Math.sin(player.angle) * 20;
    glow(ctx, bx, by, 26, "#ff7700", 0.6);
    fx.spawn({ x: bx, y: by, vx: -Math.cos(player.angle) * 160 + player.vx, vy: -Math.sin(player.angle) * 160 + player.vy, life: 0.35, size: 3, grow: 6, color: "#ffd166", color2: "#ff3b1f", kind: "smoke", alpha: 0.8 });
  }
  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.rotate(player.angle);
  const s = ships.ship;
  ctx.drawImage(s, -s.width / 2, -s.height / 2);
  // Cargo fill gauge on the hull
  const cargoRatio = player.cargo.length / player.cargoCapacity;
  ctx.fillStyle = "#0b0704";
  ctx.fillRect(-10, -3, 12, 6);
  ctx.fillStyle = cargoRatio > 0.8 ? "#ff2233" : "#00ff66";
  ctx.fillRect(-10, -3, Math.round(12 * cargoRatio), 6);
  // Navigation lights
  ctx.fillStyle = Math.sin(t * 6) > 0 ? "#ff3344" : "#401015";
  ctx.fillRect(-2, -13, 2, 2);
  ctx.fillStyle = Math.sin(t * 6) > 0 ? "#33ff88" : "#0f4020";
  ctx.fillRect(-2, 11, 2, 2);
  ctx.restore();
}

// Start Game Loop
const loop = createGameLoop({
  canvas,
  update,
  render
});

loop.start();

// Debug/test hook (used by automated verification scripts).
window.__oreRunner = {
  player,
  get asteroids() {
    return asteroids;
  },
  get pirates() {
    return pirates;
  },
  get stations() {
    return stations;
  },
  get chunks() {
    return chunks.size;
  }
};
