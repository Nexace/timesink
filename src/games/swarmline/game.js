/**
 * SWARMLINE — Top-Down Auto-Attack Roguelite Engine
 * High-octane horde survivor:
 * Movement input + active Dash, auto-firing weapons, 6 weapon & 6 passive slots,
 * 8 weapon evolutions, 7 distinct enemy archetypes, wave formations,
 * utility drops (magnet, rosary nuke, chicken, chest), boss health bar,
 * and the 20:00 Red Death trial.
 */

import { initShell, escapeHtml, toast } from "/shared/shell.js";
import { createGameLoop, createInputManager, clamp, lerp, dist } from "/src/core/engine.js";
import { playLaser, playHit, playExplosion, playPowerup, playCoin, playTone, sfx } from "/src/core/audio.js";
import { saveGameScore } from "/src/core/save.js";

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
let nextFormationTimer = 45; // First special wave at 45s
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

  playLaser({ pitch: 580, duration: 0.12 });
  toast({ title: "DASH EVASION", body: "Invulnerable dodge active!", icon: "sparkle", duration: 1200 });

  // Knockback enemies directly touching player
  enemies.forEach((e) => {
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

  // Update Orbiting Bible angle
  player.orbitAngle += dt * 3.8;

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
    player.weaponCooldowns[wid] = (isEvo ? 0.07 : Math.max(0.2, 0.7 - lvl * 0.05)) * cdReduction;
    const count = (isEvo ? 3 : 1 + Math.floor(lvl / 3)) + extraProj;

    const targets = findNearestEnemies(count);
    targets.forEach((t) => {
      const ang = Math.atan2(t.y - player.y, t.x - player.x);
      projectiles.push({
        wid,
        x: player.x,
        y: player.y,
        vx: Math.cos(ang) * 480 * speedBonus,
        vy: Math.sin(ang) * 480 * speedBonus,
        dmg: (isEvo ? 45 : 22 + lvl * 5) * dmgBonus,
        pierce: isEvo ? 4 : 1,
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
    player.weaponCooldowns[wid] = (isEvo ? 0.05 : 0.45) * cdReduction;
    const count = (isEvo ? 4 : 2 + Math.floor(lvl / 2)) + extraProj;

    for (let i = 0; i < count; i++) {
      const spread = (i - (count - 1) / 2) * 0.12;
      const ang = player.facing + spread;
      projectiles.push({
        wid,
        x: player.x,
        y: player.y,
        vx: Math.cos(ang) * 620 * speedBonus,
        vy: Math.sin(ang) * 620 * speedBonus,
        dmg: (isEvo ? 32 : 16 + lvl * 4) * dmgBonus,
        pierce: isEvo ? 3 : 1,
        color: isEvo ? "#ff007f" : "#ffffff",
        size: 4 * areaBonus,
        life: 1.4
      });
    }
    playTone(340, "triangle", 0.05, 0.04);
  }

  // 3. Battle Axe / Death Spiral
  else if (wid === "axe" || wid === "death_spiral") {
    const isEvo = wid === "death_spiral";
    player.weaponCooldowns[wid] = (isEvo ? 1.1 : 1.5) * cdReduction;

    if (isEvo) {
      // 360-degree giant scythe burst
      for (let i = 0; i < 12; i++) {
        const ang = (i / 12) * Math.PI * 2;
        projectiles.push({
          wid,
          x: player.x,
          y: player.y,
          vx: Math.cos(ang) * 380 * speedBonus,
          vy: Math.sin(ang) * 380 * speedBonus,
          dmg: 95 * dmgBonus,
          pierce: 99,
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
          dmg: (38 + lvl * 9) * dmgBonus,
          pierce: 4 + lvl,
          color: "#ffaa00",
          size: 8 * areaBonus,
          life: 2.2
        });
      }
      playTone(190, "sawtooth", 0.1, 0.08);
    }
  }

  // 4. Silver Cross / Heavenly Sword
  else if (wid === "cross" || wid === "heavenly_sword") {
    const isEvo = wid === "heavenly_sword";
    player.weaponCooldowns[wid] = (isEvo ? 0.9 : 1.3) * cdReduction;
    const count = (isEvo ? 2 : 1 + Math.floor(lvl / 4)) + extraProj;

    for (let i = 0; i < count; i++) {
      const ang = player.facing + (Math.random() - 0.5) * 0.4;
      projectiles.push({
        wid,
        x: player.x,
        y: player.y,
        vx: Math.cos(ang) * 480 * speedBonus,
        vy: Math.sin(ang) * 480 * speedBonus,
        dmg: (isEvo ? 120 : 40 + lvl * 8) * dmgBonus,
        pierce: 99,
        isBoomerang: true,
        originX: player.x,
        originY: player.y,
        color: isEvo ? "#00ffff" : "#ffd700",
        size: (isEvo ? 12 : 7) * areaBonus,
        life: 2.5
      });
    }
    playTone(480, "square", 0.09, 0.06);
  }

  // 5. King Bible / Unholy Vespers
  else if (wid === "bible" || wid === "unholy_vespers") {
    // Handled in dedicated orbital rendering & collision pass
    player.weaponCooldowns[wid] = 10.0;
  }

  // 6. Fire Wand / Hellfire
  else if (wid === "firewand" || wid === "hellfire") {
    const isEvo = wid === "hellfire";
    player.weaponCooldowns[wid] = (isEvo ? 0.7 : 1.4) * cdReduction;
    const count = (isEvo ? 3 : 1 + Math.floor(lvl / 3)) + extraProj;

    for (let i = 0; i < count; i++) {
      const target = enemies[Math.floor(Math.random() * enemies.length)];
      const ang = target ? Math.atan2(target.y - player.y, target.x - player.x) : Math.random() * Math.PI * 2;
      projectiles.push({
        wid,
        x: player.x,
        y: player.y,
        vx: Math.cos(ang) * 360 * speedBonus,
        vy: Math.sin(ang) * 360 * speedBonus,
        dmg: (isEvo ? 110 : 50 + lvl * 12) * dmgBonus,
        pierce: isEvo ? 99 : 2,
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
    const auraRadius = (isEvo ? 150 : 85 + lvl * 12) * areaBonus;

    enemies.forEach((e) => {
      if (dist(player.x, player.y, e.x, e.y) <= auraRadius) {
        const dmg = (isEvo ? 55 : 18 + lvl * 5) * dmgBonus;
        hitEnemy(e, dmg, wid);
        if (isEvo && Math.random() < 0.3) {
          player.hp = Math.min(player.maxHp, player.hp + 2);
        }
      }
    });
    playTone(110, "sine", 0.15, 0.06);
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

    // Hit Enemies
    enemies.forEach((e) => {
      if (p.pierce > 0 && dist(p.x, p.y, e.x, e.y) < p.size + e.size) {
        p.pierce--;
        hitEnemy(e, p.dmg, p.wid);

        if (p.isExplosive) {
          addScreenShake(3, 0.12);
          // Splash radius damage
          enemies.forEach((splashE) => {
            if (splashE !== e && dist(p.x, p.y, splashE.x, splashE.y) < 65) {
              hitEnemy(splashE, p.dmg * 0.6, p.wid);
            }
          });
        }
      }
    });

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

    // Damage enemies in pool
    if (Math.random() < 0.35) {
      enemies.forEach((e) => {
        if (dist(pool.x, pool.y, e.x, e.y) <= pool.radius) {
          hitEnemy(e, pool.dmg * 0.35, pool.wid);
        }
      });
    }

    if (pool.duration <= 0) groundPools.splice(i, 1);
  }
}

function hitEnemy(e, dmg, wid = "wand") {
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
  const idx = enemies.indexOf(e);
  if (idx !== -1) enemies.splice(idx, 1);

  player.kills++;

  // Bloater death explosion
  if (e.type === "bloater") {
    playExplosion({ duration: 0.35, lowpass: 360 });
    addScreenShake(5, 0.2);
    // Radial damage
    enemies.forEach((otherE) => {
      if (dist(e.x, e.y, otherE.x, otherE.y) < 75) {
        hitEnemy(otherE, 120, "bloater_blast");
      }
    });
    if (!player.isDashing && dist(e.x, e.y, player.x, player.y) < 75) {
      damagePlayer(25);
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
  if (e.type === "golem" || e.type === "bloater") {
    gemVal = 8;
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
function updateEnemies(dt) {
  const mins = runTimeSeconds / 60;

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
        playTone(180, "sawtooth", 0.08, 0.05);
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

  // Maximum enemies allowed on screen simultaneously
  const maxEnemies = Math.min(420, 180 + Math.floor(mins * 25));

  // Spawner accumulator: scales from 12 enemies/sec up to 60+ enemies/sec
  const spawnRatePerSec = 12 + mins * 3.5;
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
    nextFormationTimer = 55 + Math.random() * 20;
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
  if (mins > 6 && roll < 0.12) {
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
  } else if (mins > 4 && roll < 0.24) {
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
  } else if (mins > 3 && roll < 0.40) {
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
  } else if (mins > 2 && roll < 0.55) {
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
  } else if (roll < 0.80) {
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
        enemies.forEach((e) => {
          if (!e.isBoss) hitEnemy(e, 9999, "rosary");
        });
      } else if (p.type === "freeze") {
        screenFreezeTimer = 5.0;
        playTone(600, "sine", 0.4, 0.1);
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

  saveGameScore("swarmline", {
    score: player.kills,
    label: `${m}:${s} // LVL ${player.level} // ${player.kills} KILLS`
  });

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
function render() {
  ctx.fillStyle = "#07020a";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  let camX = player.x - canvas.width / 2;
  let camY = player.y - canvas.height / 2;

  // Apply screen shake
  if (screenShakeTimer > 0) {
    camX += (Math.random() - 0.5) * screenShakeMagnitude * 2;
    camY += (Math.random() - 0.5) * screenShakeMagnitude * 2;
  }

  ctx.save();
  ctx.translate(-camX, -camY);

  // 1. Draw Dungeon Cobblestone Ground Grid
  drawDungeonGround(camX, camY);

  // 2. Draw Ground Pools (Santa Water / La Borra)
  groundPools.forEach((gp) => {
    ctx.fillStyle = gp.isEvo ? "rgba(0, 200, 255, 0.45)" : "rgba(0, 100, 255, 0.35)";
    ctx.beginPath();
    ctx.arc(gp.x, gp.y, gp.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = gp.isEvo ? "#00f0ff" : "rgba(0, 200, 255, 0.7)";
    ctx.lineWidth = gp.isEvo ? 2 : 1;
    ctx.stroke();
  });

  // 3. Draw XP Gems
  xpGems.forEach((g) => {
    ctx.fillStyle = g.color;
    ctx.beginPath();
    ctx.arc(g.x, g.y, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1;
    ctx.stroke();
  });

  // 4. Draw Utility Combat Pickups (Chicken, Magnet, Nuke, Freeze, Chest)
  pickups.forEach((p) => {
    drawPickup(p);
  });

  // 5. Draw Projectiles
  projectiles.forEach((p) => {
    ctx.fillStyle = p.color;
    ctx.shadowColor = p.color;
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  });

  // 6. Draw Enemy Projectiles (Necromancer skulls)
  enemyProjectiles.forEach((ep) => {
    ctx.fillStyle = ep.color;
    ctx.shadowColor = ep.color;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(ep.x, ep.y, ep.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  });

  // 7. Draw Orbiting Bible Grimoires & Unholy Vespers
  const bibleLvl = player.weapons.bible || (player.weapons.unholy_vespers ? 8 : 0);
  if (bibleLvl > 0) {
    const isEvo = !!player.weapons.unholy_vespers;
    const bCount = (isEvo ? 7 : 2 + Math.floor(bibleLvl / 2));
    const radius = (isEvo ? 125 : 90) * (1 + (player.passives.candelabrador || 0) * 0.15);

    // Glowing orbital trace
    ctx.strokeStyle = isEvo ? "rgba(255, 0, 70, 0.25)" : "rgba(0, 240, 255, 0.2)";
    ctx.lineWidth = isEvo ? 3 : 1.5;
    ctx.beginPath();
    ctx.arc(player.x, player.y, radius, 0, Math.PI * 2);
    ctx.stroke();

    for (let i = 0; i < bCount; i++) {
      const a = player.orbitAngle + (i / bCount) * Math.PI * 2;
      const bx = player.x + Math.cos(a) * radius;
      const by = player.y + Math.sin(a) * radius;

      ctx.save();
      ctx.translate(bx, by);
      ctx.rotate(a + Math.PI / 2);

      ctx.fillStyle = isEvo ? "#ff0055" : "#00f0ff";
      ctx.shadowColor = isEvo ? "#ff0055" : "#00f0ff";
      ctx.shadowBlur = 8;
      ctx.fillRect(-7, -10, 14, 20);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(-4, -6, 8, 12);
      ctx.shadowBlur = 0;
      ctx.restore();

      // Collision with enemies
      enemies.forEach((e) => {
        if (dist(bx, by, e.x, e.y) < 18) {
          hitEnemy(e, isEvo ? 75 : 26, "bible");
        }
      });
    }
  }

  // 8. Draw Swarm Enemies
  enemies.forEach((e) => {
    drawEnemy(e);
  });

  // 9. Draw Dash After-Images
  player.dashAfterImages.forEach((img) => {
    ctx.save();
    ctx.globalAlpha = img.alpha;
    ctx.fillStyle = "#00f0ff";
    ctx.beginPath();
    ctx.arc(img.x, img.y, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });

  // 10. Draw Player Character
  drawPlayer();

  // 11. Draw Floating Damage Numbers
  ctx.font = '9px "Press Start 2P", monospace';
  damageNumbers.forEach((dn) => {
    if (dn.isPlayerDmg) {
      ctx.fillStyle = "#ff2233";
    } else if (dn.isCrit) {
      ctx.fillStyle = "#ffd700";
    } else {
      ctx.fillStyle = "#ffffff";
    }
    ctx.fillText(dn.text, dn.x, dn.y);
  });

  ctx.restore();
}

function drawDungeonGround(camX, camY) {
  const tileSize = 80;
  const startX = Math.floor(camX / tileSize) * tileSize;
  const startY = Math.floor(camY / tileSize) * tileSize;

  ctx.strokeStyle = "rgba(255, 0, 127, 0.07)";
  ctx.lineWidth = 1;

  for (let x = startX; x < startX + canvas.width + tileSize; x += tileSize) {
    for (let y = startY; y < startY + canvas.height + tileSize; y += tileSize) {
      ctx.strokeRect(x, y, tileSize, tileSize);
      // Subtle gothic floor cross-stud
      ctx.fillStyle = "rgba(255, 255, 255, 0.03)";
      ctx.fillRect(x + tileSize / 2 - 2, y + tileSize / 2 - 2, 4, 4);
    }
  }
}

function drawPlayer() {
  ctx.save();
  ctx.translate(player.x, player.y);

  // Dash Invulnerability Glow
  if (player.isDashing) {
    ctx.strokeStyle = "#00f0ff";
    ctx.lineWidth = 3;
    ctx.shadowColor = "#00f0ff";
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(0, 0, 16, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  // Garlic / Soul Eater Aura Indicator
  const garlicLvl = player.weapons.garlic || (player.weapons.soul_eater ? 8 : 0);
  if (garlicLvl > 0) {
    const isEvo = !!player.weapons.soul_eater;
    const auraRad = (isEvo ? 150 : 85 + garlicLvl * 12) * (1 + (player.passives.candelabrador || 0) * 0.15);
    ctx.fillStyle = isEvo ? "rgba(180, 0, 80, 0.15)" : "rgba(255, 255, 200, 0.08)";
    ctx.beginPath();
    ctx.arc(0, 0, auraRad, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = isEvo ? "rgba(255, 0, 120, 0.4)" : "rgba(255, 255, 150, 0.25)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  // Flashing i-frame invulnerability effect
  if (player.invulnTimer > 0 && Math.floor(runTimeSeconds * 30) % 2 === 0) {
    ctx.restore();
    return;
  }

  // Player Body (Wizard with cloak & wizard hat)
  ctx.fillStyle = "#ff007f";
  ctx.beginPath();
  ctx.arc(0, 0, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 2;
  ctx.stroke();

  // Wizard Hat Tip pointing in facing direction
  const hx = Math.cos(player.facing) * 9;
  const hy = Math.sin(player.facing) * 9;
  ctx.fillStyle = "#ffd700";
  ctx.fillRect(hx - 2, hy - 2, 4, 4);

  // Over-head Mini Health Bar
  const hbW = 28;
  const hbH = 4;
  const pct = Math.max(0, player.hp / player.maxHp);
  ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
  ctx.fillRect(-hbW / 2, -18, hbW, hbH);
  ctx.fillStyle = pct > 0.5 ? "#00ff66" : pct > 0.25 ? "#ffd700" : "#ff2233";
  ctx.fillRect(-hbW / 2, -18, hbW * pct, hbH);

  ctx.restore();
}

function drawEnemy(e) {
  ctx.save();
  ctx.translate(e.x, e.y);

  // Hit flash
  if (e.flash > 0) {
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(0, 0, e.size + 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }

  if (e.isBoss) {
    // Glowing Boss Aura
    ctx.strokeStyle = e.color;
    ctx.shadowColor = e.color;
    ctx.shadowBlur = 12;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, e.size + 3, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  // Draw by archetype
  ctx.fillStyle = e.color;

  if (e.type === "bat") {
    // Flapping Bat Wings
    const flap = Math.sin(runTimeSeconds * 16) * 5;
    ctx.beginPath();
    ctx.moveTo(-e.size - 2, flap);
    ctx.lineTo(0, -e.size);
    ctx.lineTo(e.size + 2, flap);
    ctx.lineTo(0, e.size / 2);
    ctx.closePath();
    ctx.fill();
    // Red glowing eyes
    ctx.fillStyle = "#fff";
    ctx.fillRect(-2, -3, 1.5, 1.5);
    ctx.fillRect(1, -3, 1.5, 1.5);
  } else if (e.type === "skeleton") {
    // Pixel Skull
    ctx.fillRect(-e.size, -e.size, e.size * 2, e.size * 2);
    // Eye sockets
    ctx.fillStyle = "#000000";
    ctx.fillRect(-5, -4, 3, 3);
    ctx.fillRect(2, -4, 3, 3);
    ctx.fillRect(-3, 2, 6, 2);
  } else if (e.type === "bloater") {
    // Pulsing toxic bloater
    const pulse = Math.sin(runTimeSeconds * 8) * 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, e.size + pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#000000";
    ctx.fillRect(-4, -3, 2, 2);
    ctx.fillRect(2, -3, 2, 2);
  } else if (e.type === "golem") {
    // Armored Iron Brick
    ctx.fillRect(-e.size, -e.size, e.size * 2, e.size * 2);
    ctx.fillStyle = "#ffd700";
    ctx.fillRect(-3, -2, 6, 4); // Glowing central eye
  } else if (e.type === "necromancer") {
    // Shadow Robed Sorcerer
    ctx.beginPath();
    ctx.arc(0, 0, e.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ff00ff";
    ctx.fillRect(-3, -3, 6, 2);
  } else {
    // Generic / Ghost
    ctx.beginPath();
    ctx.arc(0, 0, e.size, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawPickup(p) {
  ctx.save();
  ctx.translate(p.x, p.y);

  if (p.type === "chest") {
    // Golden Treasure Chest with glowing beams
    ctx.fillStyle = "#ffd700";
    ctx.shadowColor = "#ffd700";
    ctx.shadowBlur = 14;
    ctx.fillRect(-10, -7, 20, 14);
    ctx.fillStyle = "#000";
    ctx.fillRect(-2, -3, 4, 5);
    ctx.shadowBlur = 0;
  } else if (p.type === "chicken") {
    // Roast Chicken
    ctx.font = "14px monospace";
    ctx.textAlign = "center";
    ctx.fillText("🍗", 0, 5);
  } else if (p.type === "magnet") {
    // Vacuum Magnet
    ctx.font = "14px monospace";
    ctx.textAlign = "center";
    ctx.fillText("🧲", 0, 5);
  } else if (p.type === "nuke") {
    // Holy Rosary Nuke
    ctx.font = "14px monospace";
    ctx.textAlign = "center";
    ctx.fillText("✝️", 0, 5);
  } else if (p.type === "freeze") {
    // Time Freeze Clock
    ctx.font = "14px monospace";
    ctx.textAlign = "center";
    ctx.fillText("⏱️", 0, 5);
  }

  ctx.restore();
}

// =============================================================
// START LOOP
// =============================================================
loop = createGameLoop({
  canvas,
  update,
  render,
  onPause: handlePauseChange
});

loop.start();
