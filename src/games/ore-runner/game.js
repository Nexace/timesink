/**
 * ORE RUNNER — Newtonian Asteroid Miner Engine
 * Zero-friction space flight physics, cargo capacity mass penalty (-30% speed/turn),
 * fuel depletion, unbanked cargo risk/reward, 5 asteroid tiers (8s Unstable Core),
 * pirate drone encounters, base station docking bay.
 */

import { initShell, escapeHtml, toast } from "/shared/shell.js";
import { createGameLoop, createInputManager, clamp, lerp, dist, angleDiff } from "/src/core/engine.js";
import { playLaser, playExplosion, playHit, playCoin, playPowerup, playWarningBeep, sfx } from "/src/core/audio.js";
import { saveGameScore } from "/src/core/save.js";

initShell({ crumb: "Ore Runner" });

const canvas = document.getElementById("or-canvas");
const ctx = canvas.getContext("2d");
canvas.width = 960;
canvas.height = 540;

// World Bounds
const WORLD_SIZE = 4000;

// Docking Base Station (Center)
const STATION = {
  x: 2000,
  y: 2000,
  radius: 120,
  dockRadius: 85,
  beaconAngle: 0
};

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
  x: STATION.x + 160,
  y: STATION.y,
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

// World Entities
const asteroids = [];
const oreChunks = [];
const particles = [];
const pirates = [];
const stars = [];

// Generate Starfield
for (let i = 0; i < 300; i++) {
  stars.push({
    x: Math.random() * WORLD_SIZE,
    y: Math.random() * WORLD_SIZE,
    size: Math.random() * 2 + 0.5,
    alpha: Math.random() * 0.7 + 0.3
  });
}

// Generate Asteroid Field
function generateAsteroids(count = 70) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const distance = 350 + Math.random() * (WORLD_SIZE / 2 - 450);
    const ax = STATION.x + Math.cos(angle) * distance;
    const ay = STATION.y + Math.sin(angle) * distance;

    // Pick tier by weight
    const roll = Math.random() * 100;
    let tier = ASTEROID_TIERS[0];
    let acc = 0;
    for (const t of ASTEROID_TIERS) {
      acc += t.weight;
      if (roll <= acc) {
        tier = t;
        break;
      }
    }

    const radius = 22 + Math.random() * 26;
    asteroids.push({
      x: ax,
      y: ay,
      vx: (Math.random() - 0.5) * 15,
      vy: (Math.random() - 0.5) * 15,
      radius,
      tier,
      hp: tier.hp,
      maxHp: tier.hp,
      rotation: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 0.4,
      cracked: false,
      fuseTime: tier.isUnstable ? 8.0 : null
    });
  }
}
generateAsteroids(75);

// Spawn Outer Belt Pirate Drones
function spawnPirates(count = 6) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const distance = 1100 + Math.random() * 600;
    pirates.push({
      x: STATION.x + Math.cos(angle) * distance,
      y: STATION.y + Math.sin(angle) * distance,
      vx: 0,
      vy: 0,
      angle: 0,
      hp: 60,
      attackCd: 1.5,
      isAlive: true
    });
  }
}
spawnPirates(7);

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
  if (!player.isAlive) return;

  STATION.beaconAngle += dt * 1.2;

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

    if (Math.random() < 0.2) playTone(90, "sawtooth", 0.08, 0.04);
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

  // Boundary clamp (Outer asteroid shield)
  player.x = clamp(player.x, 80, WORLD_SIZE - 80);
  player.y = clamp(player.y, 80, WORLD_SIZE - 80);

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
      saveGameScore("ore-runner", {
        score: player.bankedCredits,
        label: `${player.bankedCredits} BANKED CREDITS`
      });

      toast({
        title: "STATION DOCKED",
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
    const toA = Math.atan2(a.y - player.y, a.x - player.x);
    const diff = Math.abs(angleDiff(toA, player.angle));

    if (d < maxRange + a.radius && diff < 0.25) {
      if (d < hitDist) {
        hitDist = d;
        hitTarget = a;
      }
    }
  });

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

    if (Math.random() < 0.1) playLaser({ pitch: 480, duration: 0.05 });

    // If Unstable Core hit, start 8s detonation clock
    if (hitTarget.tier.isUnstable && !hitTarget.cracked) {
      hitTarget.cracked = true;
      playWarningBeep();
      toast({ title: "UNSTABLE ISOTOPE CRACKED!", body: "Detonation in 8 SECONDS! Mine and RUN!", icon: "skull" });
    }

    if (hitTarget.hp <= 0) {
      breakAsteroid(hitTarget);
    }
  }
}

function breakAsteroid(a) {
  const idx = asteroids.indexOf(a);
  if (idx !== -1) asteroids.splice(idx, 1);

  playExplosion({ duration: 0.6, lowpass: 280 });

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
      value: a.tier.value
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

    // Unstable Core Fuse Timer
    if (a.cracked && a.fuseTime !== null) {
      a.fuseTime -= dt;
      if (a.fuseTime <= 0) {
        detonateUnstableCore(a);
      }
    }

    // Ship collision with asteroid
    const d = dist(player.x, player.y, a.x, a.y);
    if (d < a.radius + 12) {
      const impactSpeed = Math.hypot(player.vx - a.vx, player.vy - a.vy);
      if (impactSpeed > 75) {
        const dmg = Math.round(impactSpeed * 0.4);
        player.hp -= dmg;
        playHit({ pitch: 70, duration: 0.25 });
        toast({ title: "HULL IMPACT!", body: `Took ${dmg} damage!`, icon: "alert" });

        // Bounce back
        const bounceAng = Math.atan2(player.y - a.y, player.x - a.x);
        player.vx = Math.cos(bounceAng) * impactSpeed * 0.6;
        player.vy = Math.sin(bounceAng) * impactSpeed * 0.6;

        if (player.hp <= 0) {
          killPlayer("Crushed in asteroid collision");
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
    if (d < tractorDist && player.cargo.length < player.cargoCapacity) {
      const ang = Math.atan2(player.y - chunk.y, player.x - chunk.x);
      chunk.vx += Math.cos(ang) * 320 * dt;
      chunk.vy += Math.sin(ang) * 320 * dt;

      if (d < 16) {
        player.cargo.push({ type: chunk.tier.id, value: chunk.value });
        oreChunks.splice(i, 1);
        playCoin();
        toast({ title: "CARGO LOADED", body: `${chunk.tier.name} (+${chunk.value} G)`, icon: "gem" });
      }
    }
  }
}

function updatePirates(dt) {
  pirates.forEach((p) => {
    if (!p.isAlive) return;

    const d = dist(player.x, player.y, p.x, p.y);
    if (d < 550) {
      const toPlayer = Math.atan2(player.y - p.y, player.x - p.x);
      p.angle = lerp(p.angle, toPlayer, dt * 2.0);
      p.x += Math.cos(p.angle) * 110 * dt;
      p.y += Math.sin(p.angle) * 110 * dt;

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
          color: "#ff0044"
        });
        playLaser({ pitch: 260, duration: 0.1 });
      }
    }
  });

  // Check plasma bolt hit on player
  particles.forEach((p) => {
    if (p.isPlasma && dist(p.x, p.y, player.x, player.y) < 16) {
      player.hp -= 14;
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

  saveGameScore("ore-runner", {
    score: player.bankedCredits,
    label: `${player.bankedCredits} BANKED CREDITS`,
    details: `${reason} // Lost ${unbankedLost} unbanked cargo`
  });

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
function render() {
  ctx.fillStyle = "#040201";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const camX = player.x - canvas.width / 2;
  const camY = player.y - canvas.height / 2;

  ctx.save();
  ctx.translate(-camX, -camY);

  // 1. Draw Starfield
  ctx.fillStyle = "#ffffff";
  stars.forEach((s) => {
    ctx.globalAlpha = s.alpha;
    ctx.fillRect(s.x, s.y, s.size, s.size);
  });
  ctx.globalAlpha = 1.0;

  // 2. Draw Docking Base Station
  drawStation();

  // 3. Draw Asteroids
  asteroids.forEach((a) => {
    drawAsteroid(a);
  });

  // 4. Draw Floating Ore Chunks
  oreChunks.forEach((c) => {
    ctx.fillStyle = c.tier.color;
    ctx.beginPath();
    ctx.arc(c.x, c.y, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1;
    ctx.stroke();
  });

  // 5. Draw Particles & Plasma
  particles.forEach((p) => {
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.isPlasma ? 5 : 2.5, 0, Math.PI * 2);
    ctx.fill();
  });

  // 6. Draw Mining Laser Beam
  if (player.miningBeam) {
    ctx.strokeStyle = "#00f0ff";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(player.miningBeam.x1, player.miningBeam.y1);
    ctx.lineTo(player.miningBeam.x2, player.miningBeam.y2);
    ctx.stroke();
  }

  // 7. Draw Pirates
  pirates.forEach((p) => {
    if (p.isAlive) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);
      ctx.fillStyle = "#ff2233";
      ctx.beginPath();
      ctx.moveTo(12, 0);
      ctx.lineTo(-8, 8);
      ctx.lineTo(-4, 0);
      ctx.lineTo(-8, -8);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  });

  // 8. Draw Player Mining Ship
  drawPlayerShip();

  ctx.restore();
}

function drawStation() {
  ctx.save();
  ctx.translate(STATION.x, STATION.y);

  // Outer tractor ring
  ctx.strokeStyle = "rgba(255, 119, 0, 0.35)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, STATION.radius, 0, Math.PI * 2);
  ctx.stroke();

  // Docking threshold zone
  ctx.fillStyle = "rgba(255, 119, 0, 0.1)";
  ctx.beginPath();
  ctx.arc(0, 0, STATION.dockRadius, 0, Math.PI * 2);
  ctx.fill();

  // Rotating beacon guide lights
  for (let i = 0; i < 4; i++) {
    const a = STATION.beaconAngle + (i * Math.PI) / 2;
    const bx = Math.cos(a) * STATION.radius;
    const by = Math.sin(a) * STATION.radius;
    ctx.fillStyle = "#00ff66";
    ctx.beginPath();
    ctx.arc(bx, by, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  // Station Core
  ctx.fillStyle = "#1c1208";
  ctx.strokeStyle = "#ff7700";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, 48, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#ffd700";
  ctx.font = '9px "Press Start 2P", monospace';
  ctx.textAlign = "center";
  ctx.fillText("ORE DEPOT", 0, -4);
  ctx.fillText("[DOCK ZONE]", 0, 12);

  ctx.restore();
}

function drawAsteroid(a) {
  ctx.save();
  ctx.translate(a.x, a.y);
  ctx.rotate(a.rotation);

  ctx.fillStyle = a.tier.color;
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 1.5;

  ctx.beginPath();
  const sides = 8;
  for (let i = 0; i < sides; i++) {
    const ang = (i / sides) * Math.PI * 2;
    const r = a.radius * (0.85 + Math.sin(i * 3) * 0.15);
    const px = Math.cos(ang) * r;
    const py = Math.sin(ang) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Unstable Core warning beacon
  if (a.tier.isUnstable && a.cracked) {
    ctx.fillStyle = "#ffffff";
    ctx.font = '10px "Press Start 2P", monospace';
    ctx.textAlign = "center";
    ctx.fillText(`${a.fuseTime.toFixed(1)}s!`, 0, 4);
  }

  ctx.restore();
}

function drawPlayerShip() {
  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.rotate(player.angle);

  // Ship body (Heavy industrial miner triangle)
  ctx.fillStyle = "#2b190c";
  ctx.strokeStyle = "#ff7700";
  ctx.lineWidth = 2;

  ctx.beginPath();
  ctx.moveTo(16, 0);       // Cockpit nose
  ctx.lineTo(-12, 12);     // Right cargo pod
  ctx.lineTo(-8, 0);       // Engine recess
  ctx.lineTo(-12, -12);    // Left cargo pod
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Cargo hold fullness indicator
  const cargoRatio = player.cargo.length / player.cargoCapacity;
  ctx.fillStyle = cargoRatio > 0.8 ? "#ff2233" : "#00ff66";
  ctx.fillRect(-6, -4, 4, 8);

  ctx.restore();
}

// Start Game Loop
const loop = createGameLoop({
  canvas,
  update,
  render
});

loop.start();
