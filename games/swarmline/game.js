/**
 * SWARMLINE — Top-Down Auto-Attack Roguelite Engine
 * High-octane horde survivor:
 * Movement input + active Dash, auto-firing weapons, 6 weapon & 6 passive slots,
 * 8 weapon evolutions, 7 distinct enemy archetypes, wave formations,
 * utility drops (magnet, rosary nuke, chicken, chest), boss health bar,
 * and the 20:00 Red Death trial.
 */

import { initShell, escapeHtml, toast } from "/shared/shell.js";
import { createGameLoop, createInputManager, clamp, lerp, dist } from "/shared/engine.js";
import { playLaser, playHit, playExplosion, playPowerup, playCoin, playTone, sfx } from "/shared/audio.js";
import { saveGameScore } from "/shared/save.js";
import { createParticles, createLightLayer, vignette, scanlines, fillTextured, glow, rgba, tinted } from "/shared/gfx.js";
import { buildArt, demonSprite, gemSprite, decorAt, drawDecor, decorLight, DECOR_CELL } from "./art.js";

initShell({ crumb: "Swarmline" });

const canvas = document.getElementById("sl-canvas");
const ctx = canvas.getContext("2d");
canvas.width = 960;
canvas.height = 540;

// World Dimensions
const WORLD_W = 3400;
const WORLD_H = 3400;

// =============================================================
// EQUIPMENT DEFINITIONS & EVOLUTIONS
// =============================================================
const WEAPON_DEFS = {
  wand: { name: "Magic Wand", icon: "🪄", evo: "holy_wand", desc: "Fires magic bolts at the nearest foe." },
  knife: { name: "Throwing Knife", icon: "🗡️", evo: "thousand_edge", desc: "Fires rapid daggers in facing direction." },
  axe: { name: "Battle Axe", icon: "🪓", evo: "death_spiral", desc: "Arcs high overhead with heavy cleave." },
  cross: { name: "Silver Cross", icon: "✝️", evo: "heavenly_sword", desc: "Fires forward then boomerangs back." },
  bible: { name: "King Bible", icon: "📖", evo: "unholy_vespers", desc: "Orbiting sacred books create a protective shield." },
  firewand: { name: "Fire Wand", icon: "🔥", evo: "hellfire", desc: "Strikes random foes with heavy explosive fireballs." },
  garlic: { name: "Garlic", icon: "🧄", evo: "soul_eater", desc: "Damaging aura repelling swarms around player." },
  water: { name: "Santa Water", icon: "💧", evo: "la_borra", desc: "Rains pools of damaging holy fire onto the ground." },

  // Evolutions
  holy_wand: { name: "Holy Wand", icon: "✨", isEvo: true, desc: "Zero cooldown continuous stream of holy magic." },
  thousand_edge: { name: "Thousand Edge", icon: "⚔️", isEvo: true, desc: "Continuous unbroken Gatling stream of blades." },
  death_spiral: { name: "Death Spiral", icon: "🌀", isEvo: true, desc: "Giant scythes erupt in a 360-degree outward spiral." },
  heavenly_sword: { name: "Heavenly Sword", icon: "🗡️", isEvo: true, desc: "Massive critical blade cleaves through dense swarms." },
  unholy_vespers: { name: "Unholy Vespers", icon: "📕", isEvo: true, desc: "Permanent unbreakable vortex of crimson grimoires." },
  hellfire: { name: "Hellfire", icon: "☄️", isEvo: true, desc: "Giant piercing meteorites incinerating enemy lines." },
  soul_eater: { name: "Soul Eater", icon: "🖤", isEvo: true, desc: "Massive dark energy pulses with life drain." },
  la_borra: { name: "La Borra", icon: "🌊", isEvo: true, desc: "Growing vortexes of blue holy fire seeking the player." }
};

const PASSIVE_DEFS = {
  spinach: { name: "Spinach", icon: "🥬", desc: "Increases overall damage dealt by 10% per level." },
  armor: { name: "Armor", icon: "🛡️", desc: "Reduces all incoming damage by 1 flat point per level." },
  heart: { name: "Hollow Heart", icon: "❤️", desc: "Increases Max Health by 25 points per level." },
  pummarola: { name: "Pummarola", icon: "🧆", desc: "Regenerates 0.8 HP every second per level." },
  tome: { name: "Empty Tome", icon: "📚", desc: "Reduces all weapon cooldowns by 10% per level." },
  candelabrador: { name: "Candelabrador", icon: "🕯️", desc: "Augments attack area, blast size, and range by 15%." },
  bracer: { name: "Bracer", icon: "🦾", desc: "Increases projectile flight speed by 25%." },
  duplicator: { name: "Duplicator", icon: "💍", desc: "Fires +1 additional projectile per attack volley." }
};

// Evolution Pairs: Weapon + Passive needed to evolve
const EVO_PAIRS = {
  wand: { evo: "holy_wand", passive: "tome" },
  knife: { evo: "thousand_edge", passive: "bracer" },
  axe: { evo: "death_spiral", passive: "candelabrador" },
  cross: { evo: "heavenly_sword", passive: "spinach" },
  bible: { evo: "unholy_vespers", passive: "spinach" },
  firewand: { evo: "hellfire", passive: "spinach" },
  garlic: { evo: "soul_eater", passive: "pummarola" },
  water: { evo: "la_borra", passive: "heart" }
};

// =============================================================
// PLAYER STATE
// =============================================================
const player = {
  x: WORLD_W / 2,
  y: WORLD_H / 2,
  facing: 0,
  baseSpeed: 175,
  speed: 175,
  hp: 120,
  maxHp: 120,
  level: 1,
  xp: 0,
  xpNeeded: 12,
  kills: 0,
  isAlive: true,
  invulnTimer: 0,

  // Active Dash Mechanic
  dashCooldown: 3.0,
  dashCooldownTimer: 0,
  dashDuration: 0.22,
  dashTimer: 0,
  isDashing: false,
  dashVx: 0,
  dashVy: 0,
  dashAfterImages: [],

  // Equipment (max 6 weapons, max 6 passives)
  weapons: { wand: 1 },
  passives: {},
  weaponCooldowns: {},
  orbitAngle: 0,
  damageDealtByWeapon: {},
  rerollsLeft: 1
};

// =============================================================
// WORLD ENTITIES & COMBAT STATE
// =============================================================
const enemies = [];
const enemyProjectiles = [];
const xpGems = [];
const pickups = []; // chicken, magnet, nuke, freeze, chest
const projectiles = [];
const groundPools = [];
const damageNumbers = [];
const particles = [];

let runTimeSeconds = 0;
let isLevelingUp = false;
let isPaused = false;
let screenFreezeTimer = 0;
let screenShakeTimer = 0;
let screenShakeMagnitude = 0;

// Spawning accumulator & wave pacing
let spawnTimer = 0;
let nextFormationTimer = 75; // First special wave at 75s
let activeBoss = null;

// Setup Input Manager
const input = createInputManager({
  canvas,
  buttons: [
    { id: "dash", label: "DASH" },
    { id: "pause", label: "PAUSE" }
  ]
});

// Touch & Button Wiring
document.getElementById("btn-touch-dash")?.addEventListener("click", triggerDash);
document.getElementById("btn-pause-toggle")?.addEventListener("click", toggleGamePause);
document.getElementById("btn-resume-run")?.addEventListener("click", toggleGamePause);
document.getElementById("btn-restart-run")?.addEventListener("click", () => window.location.reload());
document.getElementById("btn-death-retry")?.addEventListener("click", () => window.location.reload());

window.addEventListener("keydown", (e) => {
  if (e.target instanceof Element && e.target.closest("input, textarea, select, [contenteditable]")) return;
  if (e.code === "Space" || e.code === "ShiftLeft" || e.code === "ShiftRight") {
    if (!isLevelingUp && !isPaused && player.isAlive) {
      triggerDash();
      e.preventDefault();
    }
  }

  // Hotkeys 1, 2, 3 for level up choices
  if (isLevelingUp && (e.key === "1" || e.key === "2" || e.key === "3")) {
    const idx = parseInt(e.key, 10) - 1;
    const cards = document.querySelectorAll("#cards-container .upgrade-card");
    if (cards[idx]) cards[idx].click();
  }
});

let loop = null;

function toggleGamePause() {
  if (loop && !isLevelingUp && player.isAlive) {
    loop.togglePause();
  }
}

function handlePauseChange(paused) {
  isPaused = paused;
  const modal = document.getElementById("sl-pause-modal");
  if (!modal) return;
  if (isPaused) {
    sfx.click();
    modal.style.display = "flex";
    renderStatsGrid("sl-pause-stats");
  } else {
    sfx.click();
    modal.style.display = "none";
  }
}

function triggerDash() {
  if (player.dashCooldownTimer > 0 || player.isDashing || !player.isAlive) return;

  player.isDashing = true;
  player.dashTimer = player.dashDuration;
  player.dashCooldownTimer = player.dashCooldown;

  // Direction of dash
  let dx = Math.cos(player.facing);
  let dy = Math.sin(player.facing);
  if (Math.abs(dx) < 0.1 && Math.abs(dy) < 0.1) {
    dx = 1;
    dy = 0;
  }
  player.dashVx = dx * 460;
  player.dashVy = dy * 460;

  playLaser({ startFreq: 580, endFreq: 290, duration: 0.12 });

  // Knockback enemies directly touching player
  [...enemies].forEach((e) => {
    if (dist(player.x, player.y, e.x, e.y) < 55) {
      const a = Math.atan2(e.y - player.y, e.x - player.x);
      e.x += Math.cos(a) * 80;
      e.y += Math.sin(a) * 80;
      hitEnemy(e, 25, "dash");
    }
  });
}

// =============================================================
// MAIN SIMULATION LOOP (DELTA TIME)
// =============================================================
function update(dt) {
  if (!player.isAlive || isLevelingUp || isPaused) return;

  runTimeSeconds += dt;
  updateVisuals(dt);

  // Screen shake decay
  if (screenShakeTimer > 0) {
    screenShakeTimer -= dt;
    if (screenShakeTimer <= 0) screenShakeMagnitude = 0;
  }

  // Freeze clock decay
  if (screenFreezeTimer > 0) {
    screenFreezeTimer -= dt;
  }

  // Invulnerability timer decay
  if (player.invulnTimer > 0) {
    player.invulnTimer -= dt;
  }

  // Dash updates & cooldown
  if (player.dashCooldownTimer > 0) {
    player.dashCooldownTimer -= dt;
  }

  if (player.isDashing) {
    player.dashTimer -= dt;
    player.x += player.dashVx * dt;
    player.y += player.dashVy * dt;

    // After-image ghost particles
    if (Math.random() < 0.5) {
      player.dashAfterImages.push({ x: player.x, y: player.y, alpha: 0.7, facing: player.facing });
    }

    if (player.dashTimer <= 0) {
      player.isDashing = false;
    }
  }

  // Fade after-images
  for (let i = player.dashAfterImages.length - 1; i >= 0; i--) {
    player.dashAfterImages[i].alpha -= dt * 3.5;
    if (player.dashAfterImages[i].alpha <= 0) {
      player.dashAfterImages.splice(i, 1);
    }
  }

  // Passive HP Regen (Pummarola)
  const pummarolaLvl = player.passives.pummarola || 0;
  if (pummarolaLvl > 0 && player.hp < player.maxHp) {
    player.hp = Math.min(player.maxHp, player.hp + dt * (pummarolaLvl * 0.8));
  }

  // Player Movement (WASD / Arrows / Virtual Stick)
  if (!player.isDashing) {
    let mx = 0;
    let my = 0;
    if (input.isDown("KeyW") || input.isDown("ArrowUp")) my -= 1;
    if (input.isDown("KeyS") || input.isDown("ArrowDown")) my += 1;
    if (input.isDown("KeyA") || input.isDown("ArrowLeft")) mx -= 1;
    if (input.isDown("KeyD") || input.isDown("ArrowRight")) mx += 1;

    if (input.stick?.active) {
      mx = input.stick.x;
      my = input.stick.y;
    }

    if (mx !== 0 || my !== 0) {
      const len = Math.hypot(mx, my) || 1;
      player.x += (mx / len) * player.speed * dt;
      player.y += (my / len) * player.speed * dt;
      player.facing = Math.atan2(my, mx);
    }
  }

  // Keep in world bounds
  player.x = clamp(player.x, 60, WORLD_W - 60);
  player.y = clamp(player.y, 60, WORLD_H - 60);

  // Update Orbiting Bible angle + its damage (in the simulation, not the renderer)
  player.orbitAngle += dt * 3.8;
  updateBibleOrbit(dt);

  // Auto-Fire Equipped Weapons
  updateWeaponAutoFire(dt);

  // Update Projectiles & Ground Pools
  updateProjectiles(dt);
  updateEnemyProjectiles(dt);
  updateGroundPools(dt);

  // Update Swarm Enemies & Formations
  if (screenFreezeTimer <= 0) {
    updateEnemies(dt);
  }

  // High-Density Swarm Wave Spawning
  spawnSwarmWaves(dt);

  // Update XP Gems & Utility Drops
  updateXPGems(dt);
  updatePickups(dt);

  // Update Floating Damage Numbers
  for (let i = damageNumbers.length - 1; i >= 0; i--) {
    const dn = damageNumbers[i];
    dn.y -= dt * 28;
    dn.life -= dt;
    if (dn.life <= 0) damageNumbers.splice(i, 1);
  }

  // Update Particles
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.alpha -= dt * 2.0;
    if (p.alpha <= 0) particles.splice(i, 1);
  }

  updateHUD();
}

// =============================================================
// WEAPON FIRING & DAMAGE PIPELINE
// =============================================================
function updateWeaponAutoFire(dt) {
  const tomeLvl = player.passives.tome || 0;
  const cdReduction = Math.max(0.35, 1 - tomeLvl * 0.1);
  const extraProj = player.passives.duplicator || 0;
  const dmgBonus = 1 + (player.passives.spinach || 0) * 0.12;
  const areaBonus = 1 + (player.passives.candelabrador || 0) * 0.15;
  const speedBonus = 1 + (player.passives.bracer || 0) * 0.25;

  for (const wid in player.weapons) {
    const lvl = player.weapons[wid];
    player.weaponCooldowns[wid] = (player.weaponCooldowns[wid] || 0) - dt;

    if (player.weaponCooldowns[wid] <= 0) {
      fireWeapon(wid, lvl, dmgBonus, extraProj, cdReduction, areaBonus, speedBonus);
    }
  }
}

function fireWeapon(wid, lvl, dmgBonus, extraProj, cdReduction, areaBonus, speedBonus) {
  // 1. Magic Wand / Holy Wand
  if (wid === "wand" || wid === "holy_wand") {
    const isEvo = wid === "holy_wand";
    player.weaponCooldowns[wid] = (isEvo ? 0.16 : 0.72 - lvl * 0.03) * cdReduction;
    const count = (isEvo ? 3 : 1 + Math.floor(lvl / 4)) + extraProj;

    const targets = findNearestEnemies(count);
    targets.forEach((t) => {
      const ang = Math.atan2(t.y - player.y, t.x - player.x);
      projectiles.push({
        wid,
        x: player.x,
        y: player.y,
        vx: Math.cos(ang) * 480 * speedBonus,
        vy: Math.sin(ang) * 480 * speedBonus,
        dmg: (isEvo ? 34 : 18 + lvl * 2.5) * dmgBonus,
        pierce: isEvo ? 2 : 1,
        color: isEvo ? "#ffff00" : "#00f0ff",
        size: (isEvo ? 6 : 4.5) * areaBonus,
        life: 2.0
      });
      playLaser({ pitch: isEvo ? 640 : 460, duration: 0.06 });
    });
  }

  // 2. Throwing Knife / Thousand Edge
  else if (wid === "knife" || wid === "thousand_edge") {
    const isEvo = wid === "thousand_edge";
    player.weaponCooldowns[wid] = (isEvo ? 0.12 : 0.55 - lvl * 0.02) * cdReduction;
    const count = (isEvo ? 3 : 1 + Math.floor(lvl / 2)) + extraProj;

    for (let i = 0; i < count; i++) {
      const spread = (i - (count - 1) / 2) * 0.12;
      const ang = player.facing + spread;
      projectiles.push({
        wid,
        x: player.x,
        y: player.y,
        vx: Math.cos(ang) * 620 * speedBonus,
        vy: Math.sin(ang) * 620 * speedBonus,
        dmg: (isEvo ? 28 : 14 + lvl * 3) * dmgBonus,
        pierce: isEvo ? 2 : 1,
        color: isEvo ? "#ff007f" : "#ffffff",
        size: 4 * areaBonus,
        life: 1.4
      });
    }
    playTone(340, 0.05, "triangle", 0.04);
  }

  // 3. Battle Axe / Death Spiral
  else if (wid === "axe" || wid === "death_spiral") {
    const isEvo = wid === "death_spiral";
    player.weaponCooldowns[wid] = (isEvo ? 1.4 : 1.5) * cdReduction;

    if (isEvo) {
      // 360-degree giant scythe burst
      for (let i = 0; i < 10; i++) {
        const ang = (i / 10) * Math.PI * 2;
        projectiles.push({
          wid,
          x: player.x,
          y: player.y,
          vx: Math.cos(ang) * 380 * speedBonus,
          vy: Math.sin(ang) * 380 * speedBonus,
          dmg: 80 * dmgBonus,
          pierce: 12,
          color: "#ff0044",
          size: 10 * areaBonus,
          life: 2.2
        });
      }
      playExplosion({ duration: 0.35, lowpass: 320 });
      addScreenShake(6, 0.25);
    } else {
      const count = (1 + Math.floor(lvl / 3)) + extraProj;
      for (let i = 0; i < count; i++) {
        projectiles.push({
          wid,
          x: player.x,
          y: player.y,
          vx: (Math.random() - 0.5) * 220 * speedBonus,
          vy: -420 * speedBonus,
          gravity: 580,
          dmg: (34 + lvl * 7) * dmgBonus,
          pierce: 3 + Math.floor(lvl / 2),
          color: "#ffaa00",
          size: 8 * areaBonus,
          life: 2.2
        });
      }
      playTone(190, 0.1, "sawtooth", 0.08);
    }
  }

  // 4. Silver Cross / Heavenly Sword
  else if (wid === "cross" || wid === "heavenly_sword") {
    const isEvo = wid === "heavenly_sword";
    player.weaponCooldowns[wid] = (isEvo ? 1.0 : 1.4) * cdReduction;
    const count = (isEvo ? 2 : 1 + Math.floor(lvl / 4)) + extraProj;

    for (let i = 0; i < count; i++) {
      const ang = player.facing + (Math.random() - 0.5) * 0.4;
      projectiles.push({
        wid,
        x: player.x,
        y: player.y,
        vx: Math.cos(ang) * 480 * speedBonus,
        vy: Math.sin(ang) * 480 * speedBonus,
        dmg: (isEvo ? 90 : 30 + lvl * 6) * dmgBonus,
        pierce: isEvo ? 20 : 6 + lvl,
        isBoomerang: true,
        originX: player.x,
        originY: player.y,
        color: isEvo ? "#00ffff" : "#ffd700",
        size: (isEvo ? 12 : 7) * areaBonus,
        life: 2.5
      });
    }
    playTone(480, 0.09, "square", 0.06);
  }

  // 5. King Bible / Unholy Vespers
  else if (wid === "bible" || wid === "unholy_vespers") {
    // Handled in dedicated orbital rendering & collision pass
    player.weaponCooldowns[wid] = 10.0;
  }

  // 6. Fire Wand / Hellfire
  else if (wid === "firewand" || wid === "hellfire") {
    const isEvo = wid === "hellfire";
    player.weaponCooldowns[wid] = (isEvo ? 0.9 : 1.4) * cdReduction;
    const count = (isEvo ? 3 : 1 + Math.floor(lvl / 4)) + extraProj;

    for (let i = 0; i < count; i++) {
      const target = enemies[Math.floor(Math.random() * enemies.length)];
      const ang = target ? Math.atan2(target.y - player.y, target.x - player.x) : Math.random() * Math.PI * 2;
      projectiles.push({
        wid,
        x: player.x,
        y: player.y,
        vx: Math.cos(ang) * 360 * speedBonus,
        vy: Math.sin(ang) * 360 * speedBonus,
        dmg: (isEvo ? 95 : 40 + lvl * 8) * dmgBonus,
        pierce: isEvo ? 8 : 2,
        color: isEvo ? "#ff2200" : "#ff6600",
        size: (isEvo ? 14 : 9) * areaBonus,
        life: 2.0,
        isExplosive: true
      });
    }
    playExplosion({ duration: 0.25, lowpass: 450 });
  }

  // 7. Garlic / Soul Eater (Continuous Pulsing Aura)
  else if (wid === "garlic" || wid === "soul_eater") {
    const isEvo = wid === "soul_eater";
    player.weaponCooldowns[wid] = 0.85 * cdReduction;
    const auraRadius = (isEvo ? 160 : 80 + lvl * 8) * areaBonus;

    [...enemies].forEach((e) => {
      if (dist(player.x, player.y, e.x, e.y) <= auraRadius) {
        const dmg = (isEvo ? 48 : 16 + lvl * 4) * dmgBonus;
        hitEnemy(e, dmg, wid);
        if (isEvo && Math.random() < 0.2) {
          player.hp = Math.min(player.maxHp, player.hp + 2);
        }
      }
    });
    playTone(110, 0.15, "sine", 0.06);
  }

  // 8. Santa Water / La Borra
  else if (wid === "water" || wid === "la_borra") {
    const isEvo = wid === "la_borra";
    player.weaponCooldowns[wid] = (isEvo ? 1.8 : 2.8) * cdReduction;
    const count = (isEvo ? 2 : 1) + extraProj;

    for (let i = 0; i < count; i++) {
      const dropX = player.x + (Math.random() - 0.5) * 280;
      const dropY = player.y + (Math.random() - 0.5) * 280;
      groundPools.push({
        wid,
        x: dropX,
        y: dropY,
        radius: (isEvo ? 80 : 50 + lvl * 7) * areaBonus,
        dmg: (isEvo ? 48 : 24 + lvl * 5) * dmgBonus,
        duration: isEvo ? 6.5 : 3.8,
        isEvo
      });
    }
  }
}

// Orbiting books: each enemy can be struck by the orbit at most every 0.35s.
function getBibleOrbit() {
  const bibleLvl = player.weapons.bible || (player.weapons.unholy_vespers ? 8 : 0);
  if (bibleLvl <= 0) return null;
  const isEvo = !!player.weapons.unholy_vespers;
  return {
    isEvo,
    count: isEvo ? 7 : 2 + Math.floor(bibleLvl / 2),
    radius: (isEvo ? 125 : 90) * (1 + (player.passives.candelabrador || 0) * 0.15),
    dmg: (isEvo ? 60 : 16 + bibleLvl * 3) * (1 + (player.passives.spinach || 0) * 0.12),
  };
}

function updateBibleOrbit(dt) {
  const orbit = getBibleOrbit();
  if (!orbit) return;
  for (const e of enemies) if (e.bibleCd > 0) e.bibleCd -= dt;
  for (let i = 0; i < orbit.count; i++) {
    const a = player.orbitAngle + (i / orbit.count) * Math.PI * 2;
    const bx = player.x + Math.cos(a) * orbit.radius;
    const by = player.y + Math.sin(a) * orbit.radius;
    for (const e of [...enemies]) {
      if (!(e.bibleCd > 0) && dist(bx, by, e.x, e.y) < 16 + e.size) {
        e.bibleCd = 0.35;
        hitEnemy(e, orbit.dmg, player.weapons.unholy_vespers ? "unholy_vespers" : "bible");
      }
    }
  }
}

function findNearestEnemies(count) {
  return enemies
    .map((e) => ({ enemy: e, d: dist(player.x, player.y, e.x, e.y) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, count)
    .map((item) => item.enemy);
}

// Projectiles & Pools
function updateProjectiles(dt) {
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const p = projectiles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;

    if (p.gravity) p.vy += p.gravity * dt;

    // Boomerang mechanics for Silver Cross
    if (p.isBoomerang) {
      p.vx -= (p.vx * 1.5) * dt;
      p.vy -= (p.vy * 1.5) * dt;
      if (p.life < 1.2) {
        const backAng = Math.atan2(player.y - p.y, player.x - p.x);
        p.vx += Math.cos(backAng) * 700 * dt;
        p.vy += Math.sin(backAng) * 700 * dt;
      }
    }

    p.life -= dt;

    // Hit Enemies (each projectile hits a given enemy once; iterate a copy since kills splice the list)
    for (const e of [...enemies]) {
      if (p.pierce <= 0) break;
      if (e.dead || (p.hitSet && p.hitSet.has(e))) continue;
      if (dist(p.x, p.y, e.x, e.y) < p.size + e.size) {
        p.pierce--;
        (p.hitSet ??= new Set()).add(e);
        hitEnemy(e, p.dmg, p.wid);

        if (p.isExplosive) {
          addScreenShake(3, 0.12);
          // Splash radius damage
          for (const splashE of [...enemies]) {
            if (splashE !== e && !splashE.dead && dist(p.x, p.y, splashE.x, splashE.y) < 65) {
              hitEnemy(splashE, p.dmg * 0.6, p.wid);
            }
          }
        }
      }
    }

    if (p.life <= 0 || p.pierce <= 0) projectiles.splice(i, 1);
  }
}

function updateEnemyProjectiles(dt) {
  for (let i = enemyProjectiles.length - 1; i >= 0; i--) {
    const ep = enemyProjectiles[i];
    ep.x += ep.vx * dt;
    ep.y += ep.vy * dt;
    ep.life -= dt;

    // Check hit player
    if (!player.isDashing && dist(ep.x, ep.y, player.x, player.y) < ep.size + 10) {
      damagePlayer(ep.dmg);
      enemyProjectiles.splice(i, 1);
      continue;
    }

    if (ep.life <= 0) enemyProjectiles.splice(i, 1);
  }
}

function updateGroundPools(dt) {
  for (let i = groundPools.length - 1; i >= 0; i--) {
    const pool = groundPools[i];
    pool.duration -= dt;

    // La Borra slowly gravitates toward player
    if (pool.isEvo) {
      const ang = Math.atan2(player.y - pool.y, player.x - pool.x);
      pool.x += Math.cos(ang) * 75 * dt;
      pool.y += Math.sin(ang) * 75 * dt;
    }

    // Damage enemies in pool (ticks ~3x per second regardless of frame rate)
    pool.tick = (pool.tick ?? 0) - dt;
    if (pool.tick <= 0) {
      pool.tick = 0.33;
      for (const e of [...enemies]) {
        if (dist(pool.x, pool.y, e.x, e.y) <= pool.radius) {
          hitEnemy(e, pool.dmg * 0.35, pool.wid);
        }
      }
    }

    if (pool.duration <= 0) groundPools.splice(i, 1);
  }
}

function hitEnemy(e, dmg, wid = "wand") {
  if (e.dead) return;
  e.hp -= dmg;
  e.flash = 0.08;

  // Track damage per weapon
  if (wid) {
    player.damageDealtByWeapon[wid] = (player.damageDealtByWeapon[wid] || 0) + dmg;
  }

  // Critical hit check
  const isCrit = Math.random() < 0.12;
  const actualDmg = isCrit ? Math.round(dmg * 1.8) : Math.round(dmg);
  if (isCrit) e.hp -= (actualDmg - Math.round(dmg));

  damageNumbers.push({
    x: e.x + (Math.random() * 12 - 6),
    y: e.y - 14,
    text: isCrit ? `${actualDmg}!` : `${actualDmg}`,
    isCrit,
    life: 0.55
  });
  hitSparkFx(e, isCrit);

  if (e.hp <= 0) {
    destroyEnemy(e);
  }
}

function damagePlayer(rawAmount) {
  if (player.isDashing || !player.isAlive || player.invulnTimer > 0) return;

  const flatArmor = player.passives.armor || 0;
  const taken = Math.max(1, Math.round(rawAmount - flatArmor));
  player.hp -= taken;
  player.invulnTimer = 0.45; // Grace period i-frames so swarms don't 1-frame delete player
  addScreenShake(8, 0.25);
  playHit({ pitch: 110, duration: 0.12 });

  damageNumbers.push({
    x: player.x,
    y: player.y - 18,
    text: `-${taken}`,
    isPlayerDmg: true,
    life: 0.65
  });

  if (player.hp <= 0) {
    killPlayer();
  }
}

function addScreenShake(magnitude, duration) {
  screenShakeMagnitude = Math.max(screenShakeMagnitude, magnitude);
  screenShakeTimer = Math.max(screenShakeTimer, duration);
}

// =============================================================
// ENEMY DESTROY & SPECIAL DROPS
// =============================================================
function destroyEnemy(e) {
  if (e.dead) return;
  e.dead = true;
  const idx = enemies.indexOf(e);
  if (idx !== -1) enemies.splice(idx, 1);
  enemyDeathFx(e);

  player.kills++;

  // Bloater death explosion
  if (e.type === "bloater") {
    playExplosion({ duration: 0.35, lowpass: 360 });
    addScreenShake(5, 0.2);
    // Radial damage
    for (const otherE of [...enemies]) {
      if (dist(e.x, e.y, otherE.x, otherE.y) < 75) {
        hitEnemy(otherE, 120, "bloater_blast");
      }
    }
    if (!player.isDashing && dist(e.x, e.y, player.x, player.y) < 75) {
      damagePlayer(25);
    }
  }

  // Plague Slime splits in two
  if (e.type === "slime") {
    const mins = runTimeSeconds / 60;
    for (let k = 0; k < 2; k++) {
      const a = Math.random() * Math.PI * 2;
      enemies.push({ type: "slimelet", name: "Slimelet", x: e.x + Math.cos(a) * 12, y: e.y + Math.sin(a) * 12, hp: 18 + mins * 6, speed: 125, dmg: 7, size: 7, color: "#8be04e" });
    }
  }

  // Boss / Elite defeat
  if (e.isBoss || e.isElite) {
    playExplosion({ duration: 0.9, lowpass: 200 });
    addScreenShake(12, 0.4);
    toast({ title: `${e.name || "CHAMPION"} SLAIN!`, body: "Golden Treasure Chest dropped!", icon: "gem" });

    // Clear boss bar if this was the active boss
    if (activeBoss === e) {
      activeBoss = null;
      const bBar = document.getElementById("sl-boss-bar");
      if (bBar) bBar.style.display = "none";
    }

    // Always drop Golden Chest
    pickups.push({
      type: "chest",
      x: e.x,
      y: e.y,
      size: 14,
      color: "#ffd700"
    });
  }

  // Normal Drop Roll (Gem + Chance of Utility Pickup)
  let gemVal = 2;
  let gemColor = "#00f0ff";
  if (e.type === "golem" || e.type === "bloater" || e.type === "slime") {
    gemVal = 8;
    gemColor = "#00ff66";
  } else if (e.type === "hound" || e.type === "archer") {
    gemVal = 5;
    gemColor = "#00ff66";
  } else if (e.type === "necromancer") {
    gemVal = 20;
    gemColor = "#ff007f";
  }

  xpGems.push({
    x: e.x,
    y: e.y,
    value: gemVal,
    color: gemColor
  });

  // Random Utility Drops (1 in 50)
  const roll = Math.random();
  if (roll < 0.008) {
    // Roast Chicken (Heal 35 HP)
    pickups.push({ type: "chicken", x: e.x, y: e.y, size: 10 });
  } else if (roll < 0.014) {
    // Vacuum Magnet (Draw all gems)
    pickups.push({ type: "magnet", x: e.x, y: e.y, size: 11 });
  } else if (roll < 0.018) {
    // Rosary Holy Nuke
    pickups.push({ type: "nuke", x: e.x, y: e.y, size: 12 });
  } else if (roll < 0.022) {
    // Freeze Clock (5s freeze)
    pickups.push({ type: "freeze", x: e.x, y: e.y, size: 11 });
  }
}

// =============================================================
// ENEMY BEHAVIOR & AI
// =============================================================
function separateEnemies(dt) {
  const CELL = 28;
  const grid = new Map();
  for (const e of enemies) {
    const k = ((Math.floor(e.x / CELL) & 0xffff) << 16) | (Math.floor(e.y / CELL) & 0xffff);
    let list = grid.get(k);
    if (!list) grid.set(k, (list = []));
    list.push(e);
  }
  for (const e of enemies) {
    if (e.isBoss) continue;
    const cx = Math.floor(e.x / CELL);
    const cy = Math.floor(e.y / CELL);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const list = grid.get((((cx + dx) & 0xffff) << 16) | ((cy + dy) & 0xffff));
        if (!list) continue;
        for (const o of list) {
          if (o === e) continue;
          const ox = e.x - o.x;
          const oy = e.y - o.y;
          const min = (e.size + o.size) * 0.85;
          const d2 = ox * ox + oy * oy;
          if (d2 > 0 && d2 < min * min) {
            const d = Math.sqrt(d2);
            const push = ((min - d) / min) * 60 * dt;
            e.x += (ox / d) * push;
            e.y += (oy / d) * push;
          }
        }
      }
    }
  }
}

function updateEnemies(dt) {
  const mins = runTimeSeconds / 60;
  separateEnemies(dt);

  enemies.forEach((e) => {
    // Hit flash decay
    if (e.flash > 0) e.flash -= dt;

    // Movement toward player
    const ang = Math.atan2(player.y - e.y, player.x - e.x);
    const d = dist(player.x, player.y, e.x, e.y);

    if (e.type === "necromancer") {
      // Necromancer circles around player at 240px distance
      if (d < 220) {
        // Back off
        e.x -= Math.cos(ang) * e.speed * dt;
        e.y -= Math.sin(ang) * e.speed * dt;
      } else if (d > 280) {
        // Approach
        e.x += Math.cos(ang) * e.speed * dt;
        e.y += Math.sin(ang) * e.speed * dt;
      } else {
        // Strafe clockwise
        e.x += Math.cos(ang + Math.PI / 2) * e.speed * dt;
        e.y += Math.sin(ang + Math.PI / 2) * e.speed * dt;
      }

      // Fire dark skull projectile every 2.4s
      e.spellTimer = (e.spellTimer || 2.0) - dt;
      if (e.spellTimer <= 0) {
        e.spellTimer = 2.4;
        enemyProjectiles.push({
          x: e.x,
          y: e.y,
          vx: Math.cos(ang) * 190,
          vy: Math.sin(ang) * 190,
          dmg: 16 + mins * 2,
          size: 6,
          life: 3.5,
          color: "#9900ff"
        });
        playTone(180, 0.08, "sawtooth", 0.05);
      }
    } else if (e.type === "archer") {
      // Hold at bow range, strafe, and loose an arrow every couple of seconds
      if (d < 250) {
        e.x -= Math.cos(ang) * e.speed * 0.8 * dt;
        e.y -= Math.sin(ang) * e.speed * 0.8 * dt;
      } else if (d > 330) {
        e.x += Math.cos(ang) * e.speed * dt;
        e.y += Math.sin(ang) * e.speed * dt;
      } else {
        e.x += Math.cos(ang - Math.PI / 2) * e.speed * 0.5 * dt;
        e.y += Math.sin(ang - Math.PI / 2) * e.speed * 0.5 * dt;
      }
      e.shotCd -= dt;
      if (e.shotCd <= 0 && d < 420) {
        e.shotCd = 2.2 + Math.random() * 0.8;
        enemyProjectiles.push({ x: e.x, y: e.y, vx: Math.cos(ang) * 260, vy: Math.sin(ang) * 260, dmg: 8 + mins * 0.8, size: 4, life: 2.4, color: "#6fd3ff", arrow: true });
      }
    } else if (e.type === "hound") {
      // Stalk → crouch (telegraphed glow) → pounce → recover
      if (e.pounce > 0) {
        e.pounce -= dt;
        e.x += e.pvx * dt;
        e.y += e.pvy * dt;
        if (e.pounce <= 0) e.pounceCd = 1.6;
      } else if (e.windup > 0) {
        e.windup -= dt;
        if (e.windup <= 0) {
          e.pounce = 0.42;
          e.pvx = Math.cos(ang) * 560;
          e.pvy = Math.sin(ang) * 560;
          playTone(140, 0.12, "sawtooth", 0.06);
        }
      } else {
        e.pounceCd -= dt;
        e.x += Math.cos(ang) * e.speed * dt;
        e.y += Math.sin(ang) * e.speed * dt;
        if (e.pounceCd <= 0 && d < 260) e.windup = 0.6;
      }
    } else if (e.type === "ghost") {
      // Ghost weaves with sinusoidal offset
      e.phase = (e.phase || 0) + dt * 4;
      const waveOffset = Math.sin(e.phase) * 60;
      e.x += (Math.cos(ang) * e.speed + Math.cos(ang + Math.PI / 2) * waveOffset) * dt;
      e.y += (Math.sin(ang) * e.speed + Math.sin(ang + Math.PI / 2) * waveOffset) * dt;
    } else {
      // Standard pursuit
      e.x += Math.cos(ang) * e.speed * dt;
      e.y += Math.sin(ang) * e.speed * dt;
    }

    // Contact damage with player
    if (d < e.size + 11) {
      if (!player.isDashing) {
        damagePlayer(e.dmg);
      }
    }
  });

  // Update Boss Bar if boss exists
  if (activeBoss) {
    const bBar = document.getElementById("sl-boss-bar");
    const bName = document.getElementById("sl-boss-name");
    const bText = document.getElementById("sl-boss-hp-text");
    const bFill = document.getElementById("sl-boss-fill");

    if (bBar && bName && bText && bFill) {
      bBar.style.display = "block";
      bName.textContent = activeBoss.name.toUpperCase();
      const pct = Math.max(0, Math.min(100, Math.round((activeBoss.hp / activeBoss.maxHp) * 100)));
      bText.textContent = `${pct}%`;
      bFill.style.width = `${pct}%`;
    }
  }
}

// =============================================================
// MASS HORDE WAVE SPAWNING & FORMATIONS
// =============================================================
function spawnSwarmWaves(dt) {
  const mins = runTimeSeconds / 60;

  // The horde builds up: a trickle while the starting wand finds its feet, a flood by minute 10
  const maxEnemies = Math.min(300, 45 + Math.floor(mins * 22));
  const spawnRatePerSec = Math.min(26, 2.2 + mins * 1.9);
  const spawnInterval = 1 / spawnRatePerSec;

  spawnTimer += dt;
  while (spawnTimer >= spawnInterval) {
    spawnTimer -= spawnInterval;

    if (enemies.length < maxEnemies) {
      spawnSingleSwarmMob(mins);
    }
  }

  // Periodic Boss Encounters
  checkBossSpawns(mins);

  // Special Formations (every 50–70 seconds)
  nextFormationTimer -= dt;
  if (nextFormationTimer <= 0) {
    nextFormationTimer = 60 + Math.random() * 25;
    triggerSpecialWaveFormation(mins);
  }
}

function spawnSingleSwarmMob(mins) {
  const spawnAngle = Math.random() * Math.PI * 2;
  const spawnDist = 620 + Math.random() * 80;
  const sx = player.x + Math.cos(spawnAngle) * spawnDist;
  const sy = player.y + Math.sin(spawnAngle) * spawnDist;

  const roll = Math.random();

  // Archetype distribution shifts with elapsed time
  if (mins > 3.5 && roll < 0.07) {
    // Plague Slime: splits into two slimelets when popped
    enemies.push({ type: "slime", name: "Plague Slime", x: sx, y: sy, hp: 70 + mins * 22, speed: 62, dmg: 14, size: 13, color: "#8be04e" });
    return;
  }
  if (mins > 2.5 && roll < 0.14) {
    // Hellhound: stalks, telegraphs, then pounces in a straight line
    enemies.push({ type: "hound", name: "Hellhound", x: sx, y: sy, hp: 45 + mins * 16, speed: 120, dmg: 16, size: 11, color: "#ff5a1f", pounce: 0, pounceCd: 1 + Math.random() * 2 });
    return;
  }
  if (mins > 1.5 && roll < 0.22) {
    // Skeleton Archer: keeps its distance and looses arrows
    enemies.push({ type: "archer", name: "Skeleton Archer", x: sx, y: sy, hp: 26 + mins * 10, speed: 92, dmg: 8, size: 9, color: "#d9c9a3", shotCd: 1.5 + Math.random() * 1.5 });
    return;
  }
  if (mins > 6 && roll < 0.3) {
    // Shadow Necromancer
    enemies.push({
      type: "necromancer",
      name: "Necromancer",
      x: sx,
      y: sy,
      hp: 110 + mins * 35,
      speed: 85,
      dmg: 16,
      size: 13,
      color: "#9900ff"
    });
  } else if (mins > 4 && roll < 0.38) {
    // Armored Golem
    enemies.push({
      type: "golem",
      name: "Armored Golem",
      x: sx,
      y: sy,
      hp: 200 + mins * 65,
      speed: 60,
      dmg: 24,
      size: 18,
      color: "#778899"
    });
  } else if (mins > 3 && roll < 0.48) {
    // Plague Bloater / Exploder
    enemies.push({
      type: "bloater",
      name: "Bloater",
      x: sx,
      y: sy,
      hp: 40 + mins * 16,
      speed: 135,
      dmg: 14,
      size: 12,
      color: "#39ff14"
    });
  } else if (mins > 2 && roll < 0.6) {
    // Specter / Ghost
    enemies.push({
      type: "ghost",
      name: "Specter",
      x: sx,
      y: sy,
      hp: 50 + mins * 20,
      speed: 110,
      dmg: 12,
      size: 10,
      color: "rgba(180, 100, 255, 0.85)"
    });
  } else if (roll < (mins < 1 ? 0.62 : 0.8)) {
    // Gothic Skeleton
    enemies.push({
      type: "skeleton",
      name: "Skeleton",
      x: sx,
      y: sy,
      hp: 30 + mins * 12,
      speed: 105,
      dmg: 10,
      size: 9,
      color: "#e2e8f0"
    });
  } else {
    // Blood Bat
    enemies.push({
      type: "bat",
      name: "Blood Bat",
      x: sx,
      y: sy,
      hp: 12 + mins * 6,
      speed: 165,
      dmg: 6,
      size: 7,
      color: "#ff2244"
    });
  }
}

function triggerSpecialWaveFormation(mins) {
  const formationType = Math.floor(Math.random() * 3);

  if (formationType === 0) {
    // 1. THE ENCIRCLE RING: 32 bats surround player in 360° ring
    toast({ title: "SWARM PINCH!", body: "Blood Bat ring closing in!", icon: "alert" });
    const count = 36;
    const rad = 580;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      enemies.push({
        type: "bat",
        name: "Blood Bat",
        x: player.x + Math.cos(a) * rad,
        y: player.y + Math.sin(a) * rad,
        hp: 16 + mins * 6,
        speed: 160,
        dmg: 7,
        size: 7,
        color: "#ff007f"
      });
    }
  } else if (formationType === 1) {
    // 2. THE SKELETON WALL: 28 skeletons marching in vertical wall
    toast({ title: "SKELETON PHALANX!", body: "Armored wall approaching!", icon: "alert" });
    const side = Math.random() > 0.5 ? 1 : -1;
    const sx = player.x + side * 620;
    for (let i = -14; i <= 14; i++) {
      enemies.push({
        type: "skeleton",
        name: "Skeleton",
        x: sx,
        y: player.y + i * 32,
        hp: 45 + mins * 15,
        speed: 110,
        dmg: 12,
        size: 9,
        color: "#f8fafc"
      });
    }
  } else {
    // 3. BLOATER STAMPEDE: 16 fast bloaters charging
    toast({ title: "TOXIC FRENZY!", body: "Explosive bloaters incoming!", icon: "alert" });
    for (let i = 0; i < 16; i++) {
      const a = Math.random() * Math.PI * 2;
      enemies.push({
        type: "bloater",
        name: "Bloater",
        x: player.x + Math.cos(a) * 600,
        y: player.y + Math.sin(a) * 600,
        hp: 48 + mins * 18,
        speed: 145,
        dmg: 14,
        size: 12,
        color: "#00ff66"
      });
    }
  }
}

function checkBossSpawns(mins) {
  // Minute 20:00 Red Death
  if (mins >= 20 && !enemies.some((e) => e.isBoss && e.type === "red_death")) {
    const boss = {
      type: "red_death",
      name: "The Red Death",
      x: player.x + 650,
      y: player.y,
      hp: 99999,
      maxHp: 99999,
      speed: 230,
      dmg: 999,
      size: 24,
      isBoss: true,
      color: "#ff0033"
    };
    enemies.push(boss);
    activeBoss = boss;
    toast({ title: "THE RED DEATH HAS ARRIVED", body: "20:00 REACHED — SURVIVE THE REAPER TRIAL!", icon: "skull" });
    return;
  }

  // Minute 2, 4, 7, 10, 15 Bosses
  const bossMilestones = [
    { min: 2, name: "Gargoyle King", hp: 1400, speed: 120, dmg: 22, size: 20, color: "#ff5500" },
    { min: 4, name: "Crimson Behemoth", hp: 3200, speed: 75, dmg: 32, size: 24, color: "#ff0044" },
    { min: 7, name: "Lich Primus", hp: 6500, speed: 90, dmg: 35, size: 22, color: "#aa00ff" },
    { min: 10, name: "Doom Knight", hp: 14000, speed: 105, dmg: 45, size: 25, color: "#ffd700" },
    { min: 15, name: "Gorgon Swarm Lord", hp: 28000, speed: 125, dmg: 60, size: 28, color: "#00f0ff" }
  ];

  for (const b of bossMilestones) {
    if (mins >= b.min && !b.spawned && (!activeBoss || activeBoss.hp <= 0)) {
      b.spawned = true;
      const spawnAngle = Math.random() * Math.PI * 2;
      const boss = {
        type: "miniboss",
        name: b.name,
        x: player.x + Math.cos(spawnAngle) * 600,
        y: player.y + Math.sin(spawnAngle) * 600,
        hp: b.hp,
        maxHp: b.hp,
        speed: b.speed,
        dmg: b.dmg,
        size: b.size,
        isBoss: true,
        color: b.color
      };
      enemies.push(boss);
      activeBoss = boss;
      toast({ title: `BOSS APPROACHES: ${b.name}`, body: `Survive and claim the Golden Chest!`, icon: "skull" });
      playExplosion({ duration: 1.0, lowpass: 240 });
      addScreenShake(10, 0.4);
      break;
    }
  }
}

// =============================================================
// XP GEMS & COMBAT PICKUPS
// =============================================================
function updateXPGems(dt) {
  const magnetRadius = 150 + (player.passives.candelabrador || 0) * 15;
  for (let i = xpGems.length - 1; i >= 0; i--) {
    const gem = xpGems[i];
    const d = dist(player.x, player.y, gem.x, gem.y);

    if (d < magnetRadius || gem.isMagnetized) {
      const ang = Math.atan2(player.y - gem.y, player.x - gem.x);
      gem.x += Math.cos(ang) * 440 * dt;
      gem.y += Math.sin(ang) * 440 * dt;

      if (d < 18) {
        player.xp += gem.value;
        playCoin();
        xpGems.splice(i, 1);

        if (player.xp >= player.xpNeeded) {
          triggerLevelUp();
        }
      }
    }
  }
}

function updatePickups(dt) {
  for (let i = pickups.length - 1; i >= 0; i--) {
    const p = pickups[i];
    const d = dist(player.x, player.y, p.x, p.y);

    if (d < p.size + 18) {
      // Collect pickup
      if (p.type === "chicken") {
        player.hp = Math.min(player.maxHp, player.hp + 35);
        playPowerup();
        toast({ title: "ROAST CHICKEN", body: "+35 HP Restored!", icon: "heart" });
      } else if (p.type === "magnet") {
        // Attract all gems in world
        xpGems.forEach((g) => (g.isMagnetized = true));
        playPowerup();
        toast({ title: "VACUUM ORB", body: "All gems magnetized to you!", icon: "sparkle" });
      } else if (p.type === "nuke") {
        // Flash kill all non-boss monsters
        playExplosion({ duration: 1.2, lowpass: 200 });
        addScreenShake(14, 0.5);
        toast({ title: "HOLY ROSARY NUKE!", body: "Obliterated all visible monsters!", icon: "fire" });
        for (const e of [...enemies]) {
          if (!e.isBoss) hitEnemy(e, 9999, "rosary");
        }
      } else if (p.type === "freeze") {
        screenFreezeTimer = 5.0;
        playTone(600, 0.4, "sine", 0.1);
        toast({ title: "TIME FREEZE", body: "Monsters frozen for 5 seconds!", icon: "clock" });
      } else if (p.type === "chest") {
        openTreasureChest();
      }

      pickups.splice(i, 1);
    }
  }
}

// =============================================================
// LEVEL UP & UPGRADE REVIEWS
// =============================================================
function triggerLevelUp() {
  player.level++;
  player.xp -= player.xpNeeded;
  player.xpNeeded = Math.round(player.xpNeeded * 1.32);
  isLevelingUp = true;
  playPowerup();

  renderLevelUpModal();
}

function renderLevelUpModal() {
  const modal = document.getElementById("sl-modal");
  const container = document.getElementById("cards-container");
  const btnReroll = document.getElementById("btn-reroll-cards");
  const btnSkip = document.getElementById("btn-skip-card");
  if (!modal || !container) return;

  if (btnReroll) {
    btnReroll.textContent = `[ REROLL CHOICES (${player.rerollsLeft} REMAINING) ]`;
    btnReroll.disabled = player.rerollsLeft <= 0;
    btnReroll.onclick = () => {
      if (player.rerollsLeft > 0) {
        player.rerollsLeft--;
        sfx.click();
        renderLevelUpModal();
      }
    };
  }

  if (btnSkip) {
    btnSkip.onclick = () => {
      sfx.click();
      player.hp = Math.min(player.maxHp, player.hp + 25);
      toast({ title: "SKIPPED", body: "+25 HP recovered!" });
      modal.style.display = "none";
      isLevelingUp = false;
    };
  }

  const choices = generateUpgradeChoices();

  container.innerHTML = choices.map((c, i) => {
    const isEvo = c.type === "evo";
    const hotkey = i + 1;
    return `
      <div class="upgrade-card ${isEvo ? "is-evo-card" : ""}" data-type="${c.type}" data-id="${c.id}">
        <div class="card-top">
          <div class="card-icon-frame">
            <span class="card-icon">${c.icon}</span>
            <span class="card-type-tag ${isEvo ? "tag-evo" : ""}">${c.typeTag}</span>
          </div>
          <span class="card-hotkey">[${hotkey}]</span>
        </div>
        <h4 class="card-title">${escapeHtml(c.title)}</h4>
        <p class="card-desc">${escapeHtml(c.desc)}</p>
        <div class="card-stat-diff">${escapeHtml(c.statDiff || "")}</div>
      </div>
    `;
  }).join("");

  modal.style.display = "flex";

  const cardClick = (e) => {
    const card = e.target.closest(".upgrade-card");
    if (!card) return;
    const type = card.dataset.type;
    const id = card.dataset.id;

    applyUpgrade(type, id);

    container.removeEventListener("click", cardClick);
    modal.style.display = "none";
    isLevelingUp = false;
  };

  container.addEventListener("click", cardClick);
}

function applyUpgrade(type, id) {
  if (type === "evo") {
    player.weapons[id] = 1;
    playExplosion({ duration: 0.8, lowpass: 260 });
    toast({ title: "WEAPON EVOLVED!", body: `★ ${WEAPON_DEFS[id].name} UNLEASHED!`, icon: "star" });
  } else if (type === "weapon") {
    player.weapons[id] = (player.weapons[id] || 0) + 1;
    playPowerup();
  } else if (type === "passive") {
    player.passives[id] = (player.passives[id] || 0) + 1;
    if (id === "heart") {
      player.maxHp += 25;
      player.hp += 25;
    }
    playPowerup();
  }
}

function generateUpgradeChoices() {
  const pool = [];

  // 1. Check Evolutions Ready
  for (const wid in player.weapons) {
    if (player.weapons[wid] >= 8 && EVO_PAIRS[wid]) {
      const pair = EVO_PAIRS[wid];
      // Needs matching passive equipped
      if (player.passives[pair.passive] && !player.weapons[pair.evo]) {
        pool.push({
          type: "evo",
          id: pair.evo,
          icon: WEAPON_DEFS[pair.evo].icon,
          typeTag: "★ EVOLUTION READY",
          title: WEAPON_DEFS[pair.evo].name,
          desc: WEAPON_DEFS[pair.evo].desc,
          statDiff: "GODLIKE FORM // MAX DAMAGE ASCENSION"
        });
      }
    }
  }

  // 2. Weapon Upgrades / New Weapons
  const activeWeaponCount = Object.keys(player.weapons).length;
  for (const wid in WEAPON_DEFS) {
    if (WEAPON_DEFS[wid].isEvo) continue;
    const curLvl = player.weapons[wid] || 0;

    if (curLvl === 0 && activeWeaponCount < 6) {
      pool.push({
        type: "weapon",
        id: wid,
        icon: WEAPON_DEFS[wid].icon,
        typeTag: "NEW WEAPON",
        title: `${WEAPON_DEFS[wid].name} (NEW)`,
        desc: WEAPON_DEFS[wid].desc,
        statDiff: "Adds new auto-firing attack slot"
      });
    } else if (curLvl > 0 && curLvl < 8) {
      pool.push({
        type: "weapon",
        id: wid,
        icon: WEAPON_DEFS[wid].icon,
        typeTag: "UPGRADE",
        title: `${WEAPON_DEFS[wid].name} (LVL ${curLvl + 1})`,
        desc: WEAPON_DEFS[wid].desc,
        statDiff: "+20% Base Damage // Faster Cooldown"
      });
    }
  }

  // 3. Passive Upgrades / New Passives
  const activePassiveCount = Object.keys(player.passives).length;
  for (const pid in PASSIVE_DEFS) {
    const curLvl = player.passives[pid] || 0;

    if (curLvl === 0 && activePassiveCount < 6) {
      pool.push({
        type: "passive",
        id: pid,
        icon: PASSIVE_DEFS[pid].icon,
        typeTag: "NEW PASSIVE",
        title: `${PASSIVE_DEFS[pid].name} (NEW)`,
        desc: PASSIVE_DEFS[pid].desc,
        statDiff: "Adds passive stat enhancement"
      });
    } else if (curLvl > 0 && curLvl < 5) {
      pool.push({
        type: "passive",
        id: pid,
        icon: PASSIVE_DEFS[pid].icon,
        typeTag: "UPGRADE",
        title: `${PASSIVE_DEFS[pid].name} (LVL ${curLvl + 1})`,
        desc: PASSIVE_DEFS[pid].desc,
        statDiff: "Amplifies stat effectiveness"
      });
    }
  }

  // Shuffle and choose 3
  pool.sort(() => Math.random() - 0.5);
  return pool.slice(0, 3);
}

function openTreasureChest() {
  const modal = document.getElementById("sl-chest-modal");
  const container = document.getElementById("chest-cards-container");
  const btnClaim = document.getElementById("btn-claim-chest");
  if (!modal || !container) return;

  isLevelingUp = true;
  playPowerup();

  // Pick 1 to 3 random upgrades from equipped gear
  const eligible = [];
  for (const wid in player.weapons) {
    if (player.weapons[wid] < 8) eligible.push({ type: "weapon", id: wid });
  }
  for (const pid in player.passives) {
    if (player.passives[pid] < 5) eligible.push({ type: "passive", id: pid });
  }
  eligible.sort(() => Math.random() - 0.5);

  const rewards = eligible.slice(0, Math.min(3, eligible.length));
  rewards.forEach((r) => applyUpgrade(r.type, r.id));
  // Fully kitted out: pay the chest out as XP instead.
  if (!rewards.length) player.xp += 500;

  container.innerHTML = rewards.map((r) => {
    const def = r.type === "weapon" ? WEAPON_DEFS[r.id] : PASSIVE_DEFS[r.id];
    return `
      <div class="upgrade-card is-evo-card" style="cursor:default;">
        <span class="card-icon" style="font-size:28px;">${def.icon}</span>
        <h4 class="card-title">${escapeHtml(def.name)} UPGRADED!</h4>
        <p class="card-desc">${escapeHtml(def.desc)}</p>
      </div>
    `;
  }).join("") || `<div style="color:#ffd700;font-family:monospace;font-size:14px;">★ 500 BONUS XP GRANTED! ★</div>`;

  modal.style.display = "flex";

  btnClaim.onclick = () => {
    sfx.click();
    modal.style.display = "none";
    isLevelingUp = false;
    if (player.xp >= player.xpNeeded) triggerLevelUp();
  };
}

// =============================================================
// GAME OVER & TELEMETRY
// =============================================================
function killPlayer() {
  player.isAlive = false;
  playExplosion({ duration: 1.6, lowpass: 140 });
  addScreenShake(16, 0.6);

  const m = Math.floor(runTimeSeconds / 60).toString().padStart(2, "0");
  const s = Math.floor(runTimeSeconds % 60).toString().padStart(2, "0");

  saveGameScore("swarmline", player.kills, `${m}:${s} // LVL ${player.level} // ${player.kills} KILLS`);

  const modal = document.getElementById("sl-death-modal");
  if (modal) {
    modal.style.display = "flex";
    renderStatsGrid("sl-death-stats");
  }
}

function renderStatsGrid(containerId) {
  const host = document.getElementById(containerId);
  if (!host) return;

  const m = Math.floor(runTimeSeconds / 60).toString().padStart(2, "0");
  const s = Math.floor(runTimeSeconds % 60).toString().padStart(2, "0");

  const weaponDmgRows = Object.entries(player.damageDealtByWeapon).map(([wid, dmg]) => {
    const name = WEAPON_DEFS[wid]?.name || wid;
    return `<div class="stat-item"><span>${escapeHtml(name)}:</span> <span>${Math.round(dmg)} DMG</span></div>`;
  }).join("");

  host.innerHTML = `
    <div class="stat-item"><span>TIME SURVIVED:</span> <span>${m}:${s}</span></div>
    <div class="stat-item"><span>LEVEL REACHED:</span> <span>LVL ${player.level}</span></div>
    <div class="stat-item"><span>ENEMIES SLAIN:</span> <span>${player.kills} KILLS</span></div>
    <div class="stat-item"><span>KILL RATE:</span> <span>${Math.round((player.kills / Math.max(1, runTimeSeconds)) * 60)} /MIN</span></div>
    <div style="margin-top:6px;font-weight:bold;color:#ff007f;font-size:11px;">DAMAGE BY WEAPON:</div>
    ${weaponDmgRows || "<div class='stat-item'><span>NO WEAPON DATA</span></div>"}
  `;
}

function updateHUD() {
  const timeEl = document.getElementById("hud-time");
  const lvlEl = document.getElementById("hud-level");
  const killsEl = document.getElementById("hud-kills");
  const hpEl = document.getElementById("hud-hp");
  const dpsEl = document.getElementById("hud-dps");
  const dashEl = document.getElementById("hud-dash");
  const xpBar = document.getElementById("sl-xp-fill");

  const m = Math.floor(runTimeSeconds / 60).toString().padStart(2, "0");
  const s = Math.floor(runTimeSeconds % 60).toString().padStart(2, "0");

  if (timeEl) timeEl.textContent = `${m}:${s}`;
  if (lvlEl) lvlEl.textContent = `LVL ${player.level}`;
  if (killsEl) killsEl.textContent = `${player.kills} KILLS`;
  if (hpEl) hpEl.textContent = `${Math.max(0, Math.round(player.hp))} / ${player.maxHp}`;

  const totalDmg = Object.values(player.damageDealtByWeapon).reduce((a, b) => a + b, 0);
  const curDps = Math.round(totalDmg / Math.max(1, runTimeSeconds));
  if (dpsEl) dpsEl.textContent = `${curDps}`;

  if (dashEl) {
    if (player.dashCooldownTimer > 0) {
      dashEl.textContent = `${player.dashCooldownTimer.toFixed(1)}S`;
      dashEl.className = "hud-val hud-val--dash is-charging";
    } else {
      dashEl.textContent = "READY";
      dashEl.className = "hud-val hud-val--dash";
    }
  }

  if (xpBar) {
    const pct = Math.min(100, (player.xp / player.xpNeeded) * 100);
    xpBar.style.width = `${pct}%`;
  }

  // Update Equipment Slots Rack
  updateEquipRackUI();
}

function updateEquipRackUI() {
  const wRack = document.getElementById("equip-weapons");
  const pRack = document.getElementById("equip-passives");
  if (!wRack || !pRack) return;

  const wSlots = [];
  const pSlots = [];

  for (const wid in player.weapons) {
    const def = WEAPON_DEFS[wid];
    const lvl = player.weapons[wid];
    const isEvo = !!def?.isEvo;
    wSlots.push(`
      <div class="equip-slot has-item ${isEvo ? "is-evo" : ""}" title="${escapeHtml(def?.name || wid)} (LVL ${lvl})">
        <span>${def?.icon || "⚔️"}</span>
        <span class="slot-lvl ${isEvo ? "is-star" : ""}">${isEvo ? "★" : lvl}</span>
      </div>
    `);
  }
  while (wSlots.length < 6) {
    wSlots.push(`<div class="equip-slot" title="Empty Weapon Slot"></div>`);
  }

  for (const pid in player.passives) {
    const def = PASSIVE_DEFS[pid];
    const lvl = player.passives[pid];
    pSlots.push(`
      <div class="equip-slot has-passive" title="${escapeHtml(def?.name || pid)} (LVL ${lvl})">
        <span>${def?.icon || "🛡️"}</span>
        <span class="slot-lvl">${lvl}</span>
      </div>
    `);
  }
  while (pSlots.length < 6) {
    pSlots.push(`<div class="equip-slot" title="Empty Passive Slot"></div>`);
  }

  wRack.innerHTML = wSlots.join("");
  pRack.innerHTML = pSlots.join("");
}

// =============================================================
// RENDERING ENGINE & PIXEL ART SPRITES
// =============================================================
// =============================================================
// RENDERING — torch-lit crypt, pixel sprites, lighting & particles
// =============================================================
const art = buildArt();
const fx = createParticles(900);
const lightLayer = createLightLayer(canvas.width, canvas.height);
const ENEMY_DEATH_FX = {
  bat: { color: "#ff2d55", color2: "#3b0a17", kind: "pixel" },
  skeleton: { color: "#ece6d6", color2: "#a79f8c", kind: "shard" },
  ghost: { color: "#c4a6ff", color2: "#8b62f0", kind: "smoke" },
  bloater: { color: "#8cff4a", color2: "#2f7a1f", kind: "pixel" },
  golem: { color: "#8a93a3", color2: "#4d8a3f", kind: "shard" },
  necromancer: { color: "#b04cff", color2: "#2a0a3d", kind: "smoke" }
};
let walkPhase = 0;
let lastPlayerX = player.x;
let lastPlayerY = player.y;
let renderClock = 0;

// Called from update(): particles & anim clocks only advance while the game runs.
function updateVisuals(dt) {
  fx.update(dt);
  const moved = Math.hypot(player.x - lastPlayerX, player.y - lastPlayerY);
  lastPlayerX = player.x;
  lastPlayerY = player.y;
  if (moved > 0.2) {
    walkPhase += dt * 9;
    if (Math.random() < dt * 14) {
      fx.spawn({ x: player.x + (Math.random() - 0.5) * 10, y: player.y + 14, vx: (Math.random() - 0.5) * 20, vy: -10, life: 0.5, size: 4, grow: 8, color: "#5a4f63", kind: "smoke", alpha: 0.5 });
    }
  }
  // Embers from fireballs & hellfire
  for (const p of projectiles) {
    if (p.isExplosive && Math.random() < dt * 40) {
      fx.spawn({ x: p.x, y: p.y, vx: (Math.random() - 0.5) * 40, vy: (Math.random() - 0.5) * 40 - 20, life: 0.45, size: 2, color: "#ffb347", color2: "#ff3b1f", kind: "pixel" });
    }
  }
  // Holy water flames
  for (const gp of groundPools) {
    if (Math.random() < dt * 18) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * gp.radius;
      fx.spawn({ x: gp.x + Math.cos(a) * r, y: gp.y + Math.sin(a) * r, vy: -40 - Math.random() * 30, life: 0.5, size: 2, color: gp.isEvo ? "#7df9ff" : "#4ab0ff", color2: "#ffffff", kind: "pixel" });
    }
  }
}

function enemyDeathFx(e) {
  const style = ENEMY_DEATH_FX[e.type] || { color: e.color && e.color.startsWith("#") ? e.color : "#ff3355", color2: "#330011", kind: "pixel" };
  const big = e.isBoss || e.isElite;
  fx.burst(e.x, e.y, { count: big ? 60 : 14, speed: big ? 260 : 150, life: big ? 1.0 : 0.55, size: big ? 4 : 3, gravity: style.kind === "smoke" ? -30 : 260, drag: 0.93, vr: 8, ...style });
  if (style.kind === "smoke") fx.burst(e.x, e.y, { count: 6, speed: 40, life: 0.8, size: 6, grow: 14, color: style.color, kind: "smoke", gravity: -40 });
  if (big) fx.spawn({ x: e.x, y: e.y, life: 0.6, size: 20, grow: 220, color: "#ffd24a", kind: "ring" });
}

function hitSparkFx(e, isCrit) {
  fx.burst(e.x, e.y, { count: isCrit ? 7 : 3, speed: isCrit ? 200 : 120, life: 0.22, size: 2, color: isCrit ? "#ffd24a" : "#ffffff", kind: "spark", drag: 0.9 });
}

function render() {
  const W = canvas.width;
  const H = canvas.height;
  renderClock = runTimeSeconds;
  const t = renderClock;

  let camX = player.x - W / 2;
  let camY = player.y - H / 2;
  if (screenShakeTimer > 0) {
    camX += (Math.random() - 0.5) * screenShakeMagnitude * 2;
    camY += (Math.random() - 0.5) * screenShakeMagnitude * 2;
  }
  camX = Math.round(camX);
  camY = Math.round(camY);

  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = "#07040a";
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  ctx.translate(-camX, -camY);

  // 1. Flagstone floor + crypt props
  drawDungeonGround(camX, camY);
  const lights = [];
  const c0x = Math.floor(camX / DECOR_CELL) - 1;
  const c0y = Math.floor(camY / DECOR_CELL) - 1;
  const c1x = Math.floor((camX + W) / DECOR_CELL) + 1;
  const c1y = Math.floor((camY + H) / DECOR_CELL) + 1;
  const decor = [];
  for (let cy = c0y; cy <= c1y; cy++) {
    for (let cx = c0x; cx <= c1x; cx++) {
      const d = decorAt(cx, cy);
      if (!d) continue;
      decor.push(d);
      const L = decorLight(d, t);
      if (L) lights.push(L);
    }
  }
  // Flat props first (blood, runes, bones), standing props are y-sorted with actors below
  for (const d of decor) if (d.kind === "blood" || d.kind === "rune" || d.kind === "bones") drawDecor(ctx, d, t);

  // 2. Holy water pools
  groundPools.forEach((gp) => {
    const col = gp.isEvo ? "#7df9ff" : "#3a8dff";
    const g = ctx.createRadialGradient(gp.x, gp.y, 0, gp.x, gp.y, gp.radius);
    g.addColorStop(0, rgba(col, 0.45));
    g.addColorStop(0.75, rgba(col, 0.25));
    g.addColorStop(1, rgba(col, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(gp.x, gp.y, gp.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = rgba(col, 0.6 + Math.sin(t * 8) * 0.2);
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 5]);
    ctx.lineDashOffset = -t * 30;
    ctx.stroke();
    ctx.setLineDash([]);
    lights.push({ x: gp.x, y: gp.y, r: gp.radius * 1.6, color: col });
  });

  // 3. XP gems (bobbing, with a sparkle)
  xpGems.forEach((g, i) => {
    const s = gemSprite(art, g.color);
    const bob = Math.sin(t * 5 + i) * 2;
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fillRect(g.x - 4, g.y + 6, 8, 2);
    ctx.drawImage(s, Math.round(g.x - s.width / 2), Math.round(g.y - s.height / 2 + bob));
    if ((i + Math.floor(t * 3)) % 9 === 0) {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(Math.round(g.x + 3), Math.round(g.y - 6 + bob), 1, 3);
      ctx.fillRect(Math.round(g.x + 2), Math.round(g.y - 5 + bob), 3, 1);
    }
  });

  // 4. Pickups
  pickups.forEach((p) => {
    drawPickup(p, t);
    lights.push({ x: p.x, y: p.y, r: p.type === "chest" ? 120 : 60, color: p.type === "chest" ? "#ffd24a" : "#ffffff" });
  });

  // 5. Y-sorted actors: standing props, enemies, player
  const actors = [];
  for (const d of decor) if (d.kind === "grave" || d.kind === "pillar" || d.kind === "candles" || d.kind === "brazier") actors.push({ y: d.y + 10, draw: () => drawDecor(ctx, d, t) });
  for (const e of enemies) {
    if (e.x < camX - 80 || e.x > camX + W + 80 || e.y < camY - 80 || e.y > camY + H + 80) continue;
    actors.push({ y: e.y + e.size, draw: () => drawEnemy(e, t) });
    if (e.type === "necromancer" || e.isBoss) lights.push({ x: e.x, y: e.y, r: e.isBoss ? 160 : 70, color: e.isBoss ? e.color : "#b04cff" });
  }
  actors.push({ y: player.y + 14, draw: () => drawPlayer(t) });
  actors.sort((a, b) => a.y - b.y);

  // Dash after-images (under actors)
  player.dashAfterImages.forEach((img) => {
    const frames = Math.cos(img.facing ?? player.facing) < 0 ? art.wizardL : art.wizard;
    ctx.globalAlpha = img.alpha * 0.6;
    ctx.drawImage(tinted(frames[0], "#00f0ff"), Math.round(img.x - frames[0].width / 2), Math.round(img.y - frames[0].height + 18));
  });
  ctx.globalAlpha = 1;

  for (const a of actors) a.draw();

  // 6. Orbiting grimoires
  const bibleLvl = player.weapons.bible || (player.weapons.unholy_vespers ? 8 : 0);
  if (bibleLvl > 0) {
    const isEvo = !!player.weapons.unholy_vespers;
    const bCount = isEvo ? 7 : 2 + Math.floor(bibleLvl / 2);
    const radius = (isEvo ? 125 : 90) * (1 + (player.passives.candelabrador || 0) * 0.15);
    ctx.strokeStyle = isEvo ? "rgba(255, 0, 70, 0.22)" : "rgba(80, 160, 255, 0.18)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(player.x, player.y, radius, 0, Math.PI * 2);
    ctx.stroke();
    const book = isEvo ? art.bookEvo : art.book;
    for (let i = 0; i < bCount; i++) {
      const a = player.orbitAngle + (i / bCount) * Math.PI * 2;
      const bx = player.x + Math.cos(a) * radius;
      const by = player.y + Math.sin(a) * radius;
      glow(ctx, bx, by, 22, isEvo ? "#ff0044" : "#4a8dff", 0.45);
      ctx.save();
      ctx.translate(bx, by);
      ctx.rotate(a + Math.PI / 2);
      ctx.drawImage(book, -book.width / 2, -book.height / 2);
      ctx.restore();
      lights.push({ x: bx, y: by, r: 55, color: isEvo ? "#ff0044" : "#4a8dff" });
    }
  }

  // 7. Projectiles
  projectiles.forEach((p) => {
    drawProjectile(p, t);
    if (lights.length < 60) lights.push({ x: p.x, y: p.y, r: p.isExplosive ? 90 : 45, color: p.color });
  });

  // 8. Enemy projectiles (cursed skulls)
  enemyProjectiles.forEach((ep) => {
    if (ep.arrow) {
      // Bone arrow with a frosted tip
      const a = Math.atan2(ep.vy, ep.vx);
      ctx.save();
      ctx.translate(ep.x, ep.y);
      ctx.rotate(a);
      ctx.fillStyle = "#8a5a2b";
      ctx.fillRect(-10, -1, 14, 2);
      ctx.fillStyle = "#6fd3ff";
      ctx.fillRect(4, -2, 4, 4);
      ctx.fillStyle = "#e8e4d8";
      ctx.fillRect(-12, -3, 3, 2);
      ctx.fillRect(-12, 1, 3, 2);
      ctx.restore();
      return;
    }
    glow(ctx, ep.x, ep.y, ep.size * 3, ep.color || "#b04cff", 0.6);
    ctx.fillStyle = "#e8e4d8";
    ctx.fillRect(Math.round(ep.x - 4), Math.round(ep.y - 4), 8, 6);
    ctx.fillStyle = "#12000a";
    ctx.fillRect(Math.round(ep.x - 3), Math.round(ep.y - 2), 2, 2);
    ctx.fillRect(Math.round(ep.x + 1), Math.round(ep.y - 2), 2, 2);
    lights.push({ x: ep.x, y: ep.y, r: 40, color: "#b04cff" });
  });

  // 9. Particles
  fx.draw(ctx);

  ctx.restore();

  // 10. Lighting pass: the crypt is dark; the wizard carries a lantern-glow, props & magic light the rest
  lightLayer.begin("#040108", screenFreezeTimer > 0 ? 0.4 : 0.74);
  lightLayer.light(player.x - camX, player.y - camY, 300, 1);
  for (const L of lights) lightLayer.light(L.x - camX, L.y - camY, L.r, 0.95);
  lightLayer.draw(ctx);
  // Warm colour bloom on top of the lit areas
  for (const L of lights) {
    const sx = L.x - camX;
    const sy = L.y - camY;
    if (sx < -L.r || sx > W + L.r || sy < -L.r || sy > H + L.r) continue;
    glow(ctx, sx, sy, L.r * 0.7, L.color && L.color.startsWith("#") ? L.color : "#ffffff", 0.12);
  }

  // 11. Floating damage numbers (screen space, hard shadow)
  ctx.font = '9px "Press Start 2P", monospace';
  ctx.textAlign = "center";
  damageNumbers.forEach((dn) => {
    const col = dn.isPlayerDmg ? "#ff2233" : dn.isCrit ? "#ffd24a" : "#ffffff";
    ctx.globalAlpha = Math.min(1, dn.life / 0.25);
    ctx.fillStyle = "#000000";
    ctx.fillText(dn.text, dn.x - camX + 1, dn.y - camY + 1);
    ctx.fillStyle = col;
    ctx.fillText(dn.text, dn.x - camX, dn.y - camY);
  });
  ctx.globalAlpha = 1;
  ctx.textAlign = "left";

  // 12. Freeze tint, low-HP pulse, vignette, scanlines
  if (screenFreezeTimer > 0) {
    ctx.fillStyle = "rgba(120, 200, 255, 0.12)";
    ctx.fillRect(0, 0, W, H);
  }
  const hpK = player.hp / player.maxHp;
  if (player.isAlive && hpK < 0.3) {
    vignette(ctx, W, H, 0.35 + Math.sin(t * 6) * 0.12, "#8a0012");
  }
  vignette(ctx, W, H, 0.6, "#000000");
  scanlines(ctx, W, H, 0.06);
}

function drawDungeonGround(camX, camY) {
  fillTextured(ctx, art.floor, camX, camY, canvas.width, canvas.height);
}

function drawPlayer(t) {
  const frames = Math.cos(player.facing) < 0 ? art.wizardL : art.wizard;
  const frame = frames[Math.floor(walkPhase) % 2];
  const bob = Math.round(Math.abs(Math.sin(walkPhase * Math.PI)) * 2);

  // Garlic / Soul Eater aura
  const garlicLvl = player.weapons.garlic || (player.weapons.soul_eater ? 8 : 0);
  if (garlicLvl > 0) {
    const isEvo = !!player.weapons.soul_eater;
    const auraRad = (isEvo ? 150 : 85 + garlicLvl * 12) * (1 + (player.passives.candelabrador || 0) * 0.15);
    const col = isEvo ? "#b4004f" : "#fff6b0";
    const g = ctx.createRadialGradient(player.x, player.y, auraRad * 0.4, player.x, player.y, auraRad);
    g.addColorStop(0, rgba(col, 0));
    g.addColorStop(1, rgba(col, isEvo ? 0.22 : 0.12));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(player.x, player.y, auraRad, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = rgba(col, 0.35 + Math.sin(t * 5) * 0.1);
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  // Shadow
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  ctx.beginPath();
  ctx.ellipse(player.x, player.y + 14, 11, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  if (player.isDashing) glow(ctx, player.x, player.y, 34, "#00f0ff", 0.55);

  // i-frame flicker
  const flicker = player.invulnTimer > 0 && Math.floor(runTimeSeconds * 30) % 2 === 0;
  const img = flicker ? tinted(frame, "#ffffff") : frame;
  ctx.drawImage(img, Math.round(player.x - img.width / 2), Math.round(player.y - img.height + 18 - bob));

  // Staff orb glow
  const orbX = Math.cos(player.facing) < 0 ? player.x - 13 : player.x + 13;
  glow(ctx, orbX, player.y - 28 - bob, 14, "#00f0ff", 0.5 + Math.sin(t * 6) * 0.15);

  // Health bar
  const hbW = 28;
  const pct = Math.max(0, player.hp / player.maxHp);
  const hy = Math.round(player.y - 36 - bob);
  ctx.fillStyle = "rgba(0, 0, 0, 0.85)";
  ctx.fillRect(Math.round(player.x - hbW / 2) - 1, hy - 1, hbW + 2, 6);
  ctx.fillStyle = pct > 0.5 ? "#00ff66" : pct > 0.25 ? "#ffd24a" : "#ff2233";
  ctx.fillRect(Math.round(player.x - hbW / 2), hy, Math.round(hbW * pct), 4);
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.fillRect(Math.round(player.x - hbW / 2), hy, Math.round(hbW * pct), 1);
}

function drawEnemy(e, t) {
  let img;
  if (e.type === "red_death") img = art.reaper;
  else if (e.isBoss || e.type === "miniboss") img = demonSprite(art, e.color && e.color.startsWith("#") ? e.color : "#ff3355");
  else {
    const frames = art.enemy[e.type] || art.enemy.skeleton;
    const phase = (t * (e.type === "bat" ? 10 : 5) + (e.x + e.y) * 0.01) % 2;
    img = frames[Math.floor(phase)];
  }
  const facingLeft = e.x > player.x;
  // Scale so the sprite's width is ~2.6× the collision radius
  const scale = Math.max(0.75, (e.size * 3.2) / img.width);
  const w = img.width * scale;
  const h = img.height * scale;
  const hover = e.type === "ghost" || e.type === "bat" ? Math.sin(t * 4 + e.x * 0.05) * 3 - 6 : 0;

  // Shadow
  ctx.fillStyle = "rgba(0,0,0,0.4)";
  ctx.beginPath();
  ctx.ellipse(e.x, e.y + e.size * 0.9, e.size * 0.9, e.size * 0.32, 0, 0, Math.PI * 2);
  ctx.fill();

  // Hellhound crouching to pounce: a hot red warning glow
  if (e.windup > 0) glow(ctx, e.x, e.y, e.size * 3.4, "#ff2a1a", 0.55 + Math.sin(t * 30) * 0.2);
  if (e.isBoss || e.isElite) {
    glow(ctx, e.x, e.y, e.size * 3.2, e.color && e.color.startsWith("#") ? e.color : "#ff0033", 0.35 + Math.sin(t * 4) * 0.1);
  }

  ctx.save();
  ctx.translate(Math.round(e.x), Math.round(e.y + hover));
  if (facingLeft) ctx.scale(-1, 1);
  if (e.type === "ghost") ctx.globalAlpha = 0.78;
  const draw = e.flash > 0 ? tinted(img, "#ffffff") : screenFreezeTimer > 0 ? tinted(img, "#8fd8ff") : img;
  ctx.drawImage(draw, Math.round(-w / 2), Math.round(-h / 2), Math.round(w), Math.round(h));
  ctx.restore();

  // Boss crown + name plate
  if (e.isBoss || e.isElite) {
    ctx.fillStyle = "#ffd24a";
    const cy = Math.round(e.y - h / 2 - 8 + hover);
    ctx.fillRect(Math.round(e.x - 8), cy, 16, 3);
    ctx.fillRect(Math.round(e.x - 8), cy - 4, 3, 4);
    ctx.fillRect(Math.round(e.x - 1), cy - 5, 3, 5);
    ctx.fillRect(Math.round(e.x + 5), cy - 4, 3, 4);
  }
}

function drawProjectile(p, t) {
  const ang = Math.atan2(p.vy, p.vx);
  const wid = p.wid;
  ctx.save();
  ctx.translate(p.x, p.y);
  if (wid === "knife" || wid === "thousand_edge") {
    ctx.rotate(ang);
    const s = wid === "thousand_edge" ? art.knifeEvo : art.knife;
    ctx.drawImage(s, -s.width / 2, -s.height / 2);
  } else if (wid === "axe") {
    ctx.rotate(t * 14);
    ctx.drawImage(art.axe, -art.axe.width / 2, -art.axe.height / 2);
  } else if (wid === "death_spiral") {
    ctx.rotate(t * 12);
    glow(ctx, 0, 0, 26, "#ff0044", 0.4);
    ctx.drawImage(art.scythe, -art.scythe.width / 2, -art.scythe.height / 2);
  } else if (wid === "cross" || wid === "heavenly_sword") {
    ctx.rotate(t * 10);
    const s = wid === "heavenly_sword" ? art.crossEvo : art.cross;
    glow(ctx, 0, 0, s.width, wid === "heavenly_sword" ? "#7df9ff" : "#ffd24a", 0.35);
    ctx.drawImage(s, -s.width / 2, -s.height / 2);
  } else if (p.isExplosive) {
    // Fireball: layered flame core with a streaming tail
    const r = p.size;
    glow(ctx, 0, 0, r * 3, "#ff5a1f", 0.55);
    ctx.rotate(ang);
    for (let i = 3; i >= 0; i--) {
      ctx.fillStyle = ["#fff3b0", "#ffb347", "#ff5a1f", "#b3160b"][i];
      ctx.beginPath();
      ctx.ellipse(-i * r * 0.35, 0, r * (1 - i * 0.12) + (i === 3 ? 2 : 0), r * (0.8 - i * 0.12), 0, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    // Magic bolt: bright core, soft halo and a short streak
    const col = p.color || "#00f0ff";
    glow(ctx, 0, 0, p.size * 4, col, 0.55);
    ctx.rotate(ang);
    ctx.fillStyle = rgba(col, 0.5);
    ctx.fillRect(-p.size * 3, -p.size * 0.5, p.size * 3, p.size);
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(0, 0, p.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(0, 0, p.size * 0.45, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawPickup(p, t) {
  const bob = Math.round(Math.sin(t * 3 + p.x) * 2);
  ctx.fillStyle = "rgba(0,0,0,0.4)";
  ctx.beginPath();
  ctx.ellipse(p.x, p.y + 10, 10, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  let s;
  if (p.type === "chest") {
    s = art.chest;
    // Light beams from a champion's chest
    ctx.save();
    ctx.translate(p.x, p.y);
    for (let i = 0; i < 6; i++) {
      ctx.rotate(Math.PI / 3 + t * 0.4 / 6);
      ctx.fillStyle = "rgba(255, 210, 74, 0.08)";
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-8, -60);
      ctx.lineTo(8, -60);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  } else if (p.type === "chicken") s = art.chicken;
  else if (p.type === "magnet") s = art.magnet;
  else if (p.type === "nuke") s = art.rosary;
  else if (p.type === "freeze") s = art.clock;
  if (!s) return;
  glow(ctx, p.x, p.y + bob, 20, p.type === "chest" ? "#ffd24a" : "#ffffff", 0.25);
  ctx.drawImage(s, Math.round(p.x - s.width / 2), Math.round(p.y - s.height / 2 + bob));
}

// =============================================================
// START LOOP
// =============================================================
// Read-only debug handle for automated checks
window.__swarmline = { player, enemies, get runTime() { return runTimeSeconds; } };

loop = createGameLoop({
  canvas: null, // the HTML pause modal replaces the engine's canvas overlay
  update,
  render,

  onPause: handlePauseChange
});

loop.start();
