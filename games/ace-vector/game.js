/**
 * ACE VECTOR // High-Fidelity Energy Dogfighter
 * Realistic Energy-Maneuverability flight physics, 5 player-selectable fighters,
 * 5 distinct enemy bandit classes, multi-layered mountain canyon & ocean landscape,
 * cloud strata separation, GPWS terrain collision, wingtip vortices, and supersonic shockwaves.
 */

import { initShell, escapeHtml, toast } from "/shared/shell.js";
import { createGameLoop, createInputManager, clamp, lerp, dist, angleDiff } from "/shared/engine.js";
import { playCannon, playLaser, playExplosion, playLockTone, playWarningBeep, sfx } from "/shared/audio.js";
import { saveGameScore } from "/shared/save.js";
import { noiseTile, patternOf, vignette, scanlines, glow } from "/shared/gfx.js";

import {
  AIRCRAFT_ROSTER,
  ENEMY_CLASSES,
  getAtmosphericZone,
  isInCloudDeck,
  canMaintainRadarLock,
  generateMountainTerrain,
  getTerrainHeightAt,
  checkTerrainCollision,
  checkGroundProximity,
  simulateFlightStep,
  calculateFlightControls,
  WORLD_WIDTH,
  WORLD_HEIGHT,
  SEA_LEVEL_Y,
  CLOUD_DECK_TOP_Y,
  CLOUD_DECK_BOTTOM_Y,
  CEILING_Y,
  GRAVITY
} from "./engine.js";

initShell({ crumb: "Ace Vector" });

const canvas = document.getElementById("av-canvas");
const ctx = canvas.getContext("2d");
canvas.width = 960;
canvas.height = 540;

// Granite texture for the foreground massif (tileable, world-anchored via a pattern)
const ROCK_TEX = noiseTile(192, {
  base: "#2a3a4a",
  seed: 41,
  blotches: [
    { color: "#415a70", alpha: 0.35, count: 10, min: 16, max: 40 },
    { color: "#141d27", alpha: 0.45, count: 10, min: 14, max: 36 }
  ],
  speckles: [
    { color: "#6b839a", density: 0.012 },
    { color: "#0f161e", density: 0.02 },
    { color: "#8aa2b8", density: 0.003, size: 2 }
  ],
  cracks: { color: "rgba(10, 16, 22, 0.8)", count: 14 }
});

// ── Terrain & World Generation ──
const terrain = generateMountainTerrain(101);

// Ambient Clouds in Cloud Deck & Low Stratosphere (volumetric clusters)
const clouds = [];
for (let i = 0; i < 45; i++) {
  clouds.push({
    x: Math.random() * (WORLD_WIDTH + 2000) - 1000,
    y: CLOUD_DECK_TOP_Y - 180 + Math.random() * (CLOUD_DECK_BOTTOM_Y - CLOUD_DECK_TOP_Y + 400),
    w: 240 + Math.random() * 260,
    h: 80 + Math.random() * 80,
    alpha: 0.35 + Math.random() * 0.35,
    speed: 12 + Math.random() * 20,
    puffs: [
      { ox: 0, oy: 0, r: 40 + Math.random() * 20 },
      { ox: -60, oy: 10, r: 35 + Math.random() * 15 },
      { ox: 60, oy: 10, r: 35 + Math.random() * 15 },
      { ox: -110, oy: 20, r: 25 + Math.random() * 12 },
      { ox: 110, oy: 20, r: 25 + Math.random() * 12 }
    ]
  });
}

// Stratospheric Stars
const stars = [];
for (let i = 0; i < 90; i++) {
  stars.push({
    x: Math.random() * (WORLD_WIDTH + 2000) - 1000,
    y: 50 + Math.random() * (CLOUD_DECK_TOP_Y - 150),
    r: 0.7 + Math.random() * 1.3,
    alpha: 0.4 + Math.random() * 0.6
  });
}

// Low-Altitude Sea Spray & Atmospheric Combat Effects
const sprayParticles = [];
const flakPuffs = [];
let missionGraceTimer = 2.5;

// Mouse Flight Aim State
const mouseAim = {
  active: false,
  targetAngle: 0,
  screenX: canvas.width / 2,
  screenY: canvas.height / 2,
  mouseShooting: false,
  rightClicked: false
};

canvas.addEventListener("mousemove", (e) => {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  mouseAim.screenX = (e.clientX - rect.left) * scaleX;
  mouseAim.screenY = (e.clientY - rect.top) * scaleY;

  const camX = camera.x - canvas.width / 2;
  const camY = camera.y - canvas.height / 2;
  const worldX = camX + mouseAim.screenX;
  const worldY = camY + mouseAim.screenY;

  mouseAim.targetAngle = Math.atan2(worldY - player.y, worldX - player.x);
  mouseAim.active = true;
});

canvas.addEventListener("mousedown", (e) => {
  if (e.button === 0) {
    mouseAim.mouseShooting = true;
  } else if (e.button === 2) {
    e.preventDefault();
    mouseAim.rightClicked = true;
  }
});

canvas.addEventListener("mouseup", (e) => {
  if (e.button === 0) mouseAim.mouseShooting = false;
});

canvas.addEventListener("contextmenu", (e) => e.preventDefault());

// ── Player State & Aircraft Hangar ──
let currentAircraftId = "f22";
let isHangarOpen = false;

const player = {
  type: "f22",
  x: 1800,
  y: 3200, // starting altitude inside high canyon / cloud transition
  vx: 380,
  vy: 0,
  angle: 0,
  speed: 380,
  throttle: 0.8,
  fuel: 100,
  hp: 110,
  maxHp: 110,
  damageResist: 0,
  isStalled: false,
  flaresCount: 12,
  missilesCount: 6,
  missileType: "AIM-120",
  missileCooldown: 0,
  flareCooldown: 0,
  cannonDmg: 30,
  cannonExplosive: false,
  cannonFireRate: 0.08,
  cannonCooldown: 0,
  cannonVelocity: 900,
  selectedTarget: null,
  lockTimer: 0,
  hasLock: false,
  kills: 0,
  isAlive: true,
  strata: "CLOUD_DECK",
  sonicBoomTimer: 0,
  wasSupersonic: false,
  vaporTrails: [],
  components: {
    engine: 100,
    leftWing: 100,
    rightWing: 100,
    radar: 100
  }
};

function selectAircraft(id, silent = false) {
  const craft = AIRCRAFT_ROSTER[id];
  if (!craft) return;

  // Swapping airframes keeps your damage state and ammo (no free mid-fight repair or rearm);
  // the carrier fully rearms, refuels and patches you up between sorties (see startMission).
  const hpRatio = player.maxHp > 0 ? clamp(player.hp / player.maxHp, 0, 1) : 1;
  currentAircraftId = id;
  player.type = id;
  player.maxHp = craft.hp;
  player.hp = Math.max(1, Math.round(craft.hp * hpRatio));
  player.damageResist = craft.damageResist || 0;
  player.cannonDmg = craft.cannonDmg;
  player.cannonExplosive = Boolean(craft.cannonExplosive);
  player.cannonFireRate = craft.cannonFireRate;
  player.cannonVelocity = craft.cannonVelocity;
  player.missilesCount = Math.min(player.missilesCount, craft.missilesCount);
  player.missileType = craft.missileType;
  player.flaresCount = Math.min(player.flaresCount, craft.flaresCount);

  // Update HUD
  const craftEl = document.getElementById("hud-craft");
  if (craftEl) {
    craftEl.textContent = craft.name.toUpperCase();
    craftEl.style.color = craft.color;
  }

  // Update Hangar Modal Cards
  document.querySelectorAll(".hangar-card").forEach((card) => {
    if (card.dataset.craftId === id) {
      card.classList.add("hangar-card--selected");
    } else {
      card.classList.remove("hangar-card--selected");
    }
  });

  if (!silent) {
    sfx.powerup();
    toast({
      title: `AIRFRAME SELECTED: ${craft.name}`,
      body: `${craft.role} // ${craft.badge}`,
      icon: "jet"
    });
  }
}

// ── Campaign Missions Definition ──
const MISSIONS = [
  {
    id: 1,
    title: "MISSION 1 // BORDER PATROL",
    desc: "Intercept 3 hostile MiG-21 scouts intruding sovereign airspace.",
    enemies: [{ type: "mig21" }, { type: "mig21" }, { type: "mig21" }]
  },
  {
    id: 2,
    title: "MISSION 2 // SCRAMBLE",
    desc: "Engage mixed wing of 2 MiG-21s and 2 heavy Su-27 Flankers at high altitude.",
    enemies: [{ type: "mig21" }, { type: "su27" }, { type: "mig21" }, { type: "su27" }]
  },
  {
    id: 3,
    title: "MISSION 3 // CANYON INTERCEPT",
    desc: "Low-altitude dogfight through alpine mountain peaks and sea cliffs.",
    enemies: [{ type: "su27" }, { type: "mig21" }, { type: "su27" }, { type: "mig21" }]
  },
  {
    id: 4,
    title: "MISSION 4 // ACE DUEL: GHOST 01",
    desc: "1v1 duel against legendary hypersonic prototype ace 'Black Ghost'.",
    enemies: [{ type: "blackGhost" }]
  },
  {
    id: 5,
    title: "MISSION 5 // FLEET AIR COVER",
    desc: "Defend coastal airspace from 2 Tu-160 heavy bombers escorted by Su-27s.",
    enemies: [{ type: "tu160" }, { type: "su27" }, { type: "tu160" }, { type: "su27" }]
  },
  {
    id: 6,
    title: "MISSION 6 // NIGHT STRIKE",
    desc: "Engage stealth J-20 Mighty Dragons using cloud cover to break radar locks.",
    enemies: [{ type: "j20" }, { type: "j20" }, { type: "j20" }, { type: "j20" }]
  },
  {
    id: 7,
    title: "MISSION 7 // THE GAUNTLET",
    desc: "Survive against a combined strike wing of MiG-21s, Su-27s, and stealth J-20s.",
    enemies: [{ type: "mig21" }, { type: "su27" }, { type: "j20" }, { type: "su27" }, { type: "j20" }, { type: "tu160" }]
  },
  {
    id: 8,
    title: "MISSION 8 // APEX PREDATOR",
    desc: "Final duel against the upgraded Black Ghost Ace flanked by elite Su-27 and J-20 wingmen.",
    enemies: [{ type: "blackGhost" }, { type: "j20" }, { type: "su27" }, { type: "j20" }]
  }
];

let currentMissionIndex = 0;
let wingman = null;
let missionClearTimer = -1; // >= 0 while the "airspace secured" beat plays before the next sortie
let campaignComplete = false;

// Entities
const bullets = [];
const missiles = [];
const countermeasures = []; // Flares
const explosions = [];
const enemies = [];
const shockwaves = [];

// Camera & Screen Shake
const camera = {
  x: player.x,
  y: player.y,
  shake: 0
};

// Setup Mission
function startMission(index) {
  currentMissionIndex = index;
  missionClearTimer = -1;
  missionGraceTimer = 2.5; // Tactical grace timer: bandits hold fire for 2.5s

  // Carrier turnaround: rearm, refuel, and patch the airframe between sorties
  const craft = AIRCRAFT_ROSTER[player.type] || AIRCRAFT_ROSTER.f22;
  player.missilesCount = craft.missilesCount;
  player.flaresCount = craft.flaresCount;
  player.fuel = 100;
  player.hp = Math.min(player.maxHp, player.hp + Math.round(player.maxHp * 0.5));
  player.selectedTarget = null;
  player.lockTimer = 0;
  player.hasLock = false;
  const m = MISSIONS[index];
  enemies.length = 0;
  bullets.length = 0;
  missiles.length = 0;
  countermeasures.length = 0;
  shockwaves.length = 0;
  flakPuffs.length = 0;
  sprayParticles.length = 0;

  // Wingman setup
  wingman = {
    x: player.x - 140,
    y: player.y + 50,
    angle: player.angle,
    speed: player.speed,
    hp: 120,
    isAlive: true,
    gunCd: 1.5
  };

  // Spawn varied enemies with tactical opening distance
  m.enemies.forEach((spec, i) => {
    const classData = ENEMY_CLASSES[spec.type] || ENEMY_CLASSES.mig21;
    const ex = player.x + 1400 + i * 460 + Math.random() * 200;
    // Alternate altitudes between cloud deck and low canyon
    const ey = i % 2 === 0 ? 2500 + Math.random() * 600 : 3800 + Math.random() * 600;

    enemies.push({
      id: i + 1,
      type: spec.type,
      name: classData.name,
      role: classData.role,
      x: ex,
      y: ey,
      angle: Math.PI, // facing left toward player
      speed: classData.speed,
      hp: classData.maxHp,
      maxHp: classData.maxHp,
      pitchRate: classData.pitchRate,
      attackCd: 2.0 + Math.random() * 2,
      missileCd: 5.0 + Math.random() * 4,
      flares: spec.type === "blackGhost" ? 10 : spec.type === "tu160" ? 6 : 4,
      firesMissiles: Boolean(classData.firesMissiles),
      defensiveFlak: Boolean(classData.defensiveFlak),
      stealth: Boolean(classData.stealth),
      highGManeuvers: Boolean(classData.highGManeuvers),
      scoreValue: classData.scoreValue,
      color: classData.color,
      isAlive: true
    });
  });

  sfx.powerup();
  toast({ title: m.title, body: m.desc, icon: "jet" });
}

// ── Setup Input ──
const input = createInputManager({
  canvas,
  buttons: [
    { id: "fire", label: "CANNON" },
    { id: "missile", label: "MISSILE" },
    { id: "flare", label: "FLARE" },
    { id: "burner", label: "AFTERBURN" }
  ]
});

// Setup Hangar Overlay UI
function setupHangarUI() {
  const modal = document.getElementById("av-hangar-modal");
  const grid = document.getElementById("hangar-grid");
  const openBtn = document.getElementById("btn-open-hangar");
  const closeBtn = document.getElementById("btn-hangar-close");
  const launchBtn = document.getElementById("btn-hangar-launch");

  if (!modal || !grid) return;

  grid.innerHTML = "";
  Object.values(AIRCRAFT_ROSTER).forEach((craft, idx) => {
    const card = document.createElement("div");
    card.className = `hangar-card ${craft.id === currentAircraftId ? "hangar-card--selected" : ""}`;
    card.dataset.craftId = craft.id;

    // Stat bars calculations (normalized 0-100)
    const speedPct = Math.min(100, Math.round((craft.maxSpeed / 1250) * 100));
    const turnPct = Math.min(100, Math.round((craft.pitchRate / 3.4) * 100));
    const armorPct = Math.min(100, Math.round((craft.hp / 220) * 100));
    const firePct = Math.min(100, Math.round((craft.cannonDmg / 54) * 100));

    card.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <span class="hangar-card__badge" style="color:${craft.accent};">[KEY ${idx + 1}]</span>
        <span class="hangar-card__badge">${escapeHtml(craft.badge)}</span>
      </div>
      <h3 class="hangar-card__title" style="color:${craft.color};">${escapeHtml(craft.name)}</h3>
      <div class="hangar-card__role">${escapeHtml(craft.role)}</div>
      
      <div class="hangar-card__stats">
        <div class="stat-row">
          <span>SPEED: ${craft.maxSpeed} KTS</span>
          <div class="stat-bar-bg"><div class="stat-bar-fill" style="width:${speedPct}%;"></div></div>
        </div>
        <div class="stat-row">
          <span>AGILITY: ${craft.pitchRate} R/S</span>
          <div class="stat-bar-bg"><div class="stat-bar-fill" style="width:${turnPct}%;"></div></div>
        </div>
        <div class="stat-row">
          <span>ARMOR: ${craft.hp} HP</span>
          <div class="stat-bar-bg"><div class="stat-bar-fill" style="width:${armorPct}%;"></div></div>
        </div>
        <div class="stat-row">
          <span>GUN: ${craft.cannonDmg} DMG</span>
          <div class="stat-bar-bg"><div class="stat-bar-fill" style="width:${firePct}%;"></div></div>
        </div>
      </div>

      <div class="hangar-card__desc">${escapeHtml(craft.desc)}</div>
    `;

    card.addEventListener("click", () => {
      selectAircraft(craft.id);
    });

    grid.appendChild(card);
  });

  const toggleHangar = (show) => {
    isHangarOpen = typeof show === "boolean" ? show : modal.style.display === "none";
    modal.style.display = isHangarOpen ? "flex" : "none";
    if (isHangarOpen) sfx.click();
  };

  if (openBtn) openBtn.addEventListener("click", () => toggleHangar(true));
  if (closeBtn) closeBtn.addEventListener("click", () => toggleHangar(false));
  if (launchBtn) launchBtn.addEventListener("click", () => toggleHangar(false));

  // Global key listener for H and number keys 1-5 (airframe keys only work inside the hangar)
  window.addEventListener("keydown", (ev) => {
    if (ev.target instanceof Element && ev.target.closest("input, textarea, select, [contenteditable]")) return;
    if (ev.ctrlKey || ev.metaKey || ev.altKey || ev.repeat) return;
    if (!player.isAlive) return;
    if (ev.code === "KeyH") {
      toggleHangar();
    } else if (ev.key === "Escape" && isHangarOpen) {
      ev.stopImmediatePropagation(); // close the hangar instead of also pausing
      toggleHangar(false);
    } else if (isHangarOpen && ev.key >= "1" && ev.key <= "5") {
      const rosterKeys = Object.keys(AIRCRAFT_ROSTER);
      const chosen = rosterKeys[parseInt(ev.key, 10) - 1];
      if (chosen && chosen !== currentAircraftId) selectAircraft(chosen);
    }
  });
}

// ── Game Update Loop ──
function update(dt) {
  if (isHangarOpen || !player.isAlive) {
    input.clearJustPressed();
    mouseAim.rightClicked = false;
    return;
  }

  missionGraceTimer = Math.max(0, missionGraceTimer - dt);

  // 1. High-Precision Flight Controls via engine.js mapper (Keyboard & Mouse Aim)
  const flightCtrl = calculateFlightControls(player, input, dt, mouseAim);

  // 2. Headless Flight Simulation Step from engine.js
  simulateFlightStep(player, flightCtrl, dt);

  // 3. Update Strata & Atmosphere
  player.strata = getAtmosphericZone(player.y);

  // Supersonic Mach 1 check (760 kts)
  if (player.speed >= 760 && !player.wasSupersonic) {
    player.wasSupersonic = true;
    shockwaves.push({
      x: player.x,
      y: player.y,
      radius: 12,
      maxRadius: 180,
      alpha: 0.9,
      angle: player.angle
    });
    sfx.coin();
    toast({ title: "SONIC BOOM // MACH 1.0", body: "Transonic shock barrier breached!", icon: "bolt" });
  } else if (player.speed < 740) {
    player.wasSupersonic = false;
  }

  // Wingtip Vortices on High-G turns
  if (Math.abs(flightCtrl.pitchInput) > 0.45 && player.speed > 320) {
    const wingOffset = 22;
    const leftX = player.x - Math.sin(player.angle) * wingOffset;
    const leftY = player.y + Math.cos(player.angle) * wingOffset;
    const rightX = player.x + Math.sin(player.angle) * wingOffset;
    const rightY = player.y - Math.cos(player.angle) * wingOffset;
    player.vaporTrails.push(
      { x: leftX, y: leftY, life: 0.7, maxLife: 0.7 },
      { x: rightX, y: rightY, life: 0.7, maxLife: 0.7 }
    );
  }

  // Age vapor trails
  for (let i = player.vaporTrails.length - 1; i >= 0; i--) {
    const v = player.vaporTrails[i];
    v.life -= dt;
    if (v.life <= 0) player.vaporTrails.splice(i, 1);
  }

  // Low-Altitude Sea Spray Rooster Tails
  const altAboveWater = SEA_LEVEL_Y - player.y;
  if (altAboveWater > 0 && altAboveWater < 80 && player.speed > 240) {
    for (let i = 0; i < 3; i++) {
      sprayParticles.push({
        x: player.x - Math.cos(player.angle) * 32 + (Math.random() - 0.5) * 16,
        y: SEA_LEVEL_Y - 2 + Math.random() * 4,
        vx: -Math.cos(player.angle) * player.speed * 0.35 + (Math.random() - 0.5) * 50,
        vy: -20 - Math.random() * 40,
        r: 2.2 + Math.random() * 3.5,
        life: 0.5 + Math.random() * 0.35,
        maxLife: 0.85
      });
    }
  }

  // Update spray particles
  for (let i = sprayParticles.length - 1; i >= 0; i--) {
    const sp = sprayParticles[i];
    sp.x += sp.vx * dt;
    sp.y += sp.vy * dt;
    sp.vy += 120 * dt; // gravity
    sp.life -= dt;
    if (sp.life <= 0 || sp.y > SEA_LEVEL_Y + 12) {
      sprayParticles.splice(i, 1);
    }
  }

  // Ambient flak puffs in heavy combat
  if (Math.random() < 0.04 && enemies.some((e) => e.isAlive)) {
    const flakX = player.x + (Math.random() - 0.5) * 1200;
    const flakY = player.y + (Math.random() - 0.5) * 600;
    if (flakY < SEA_LEVEL_Y - 100) {
      flakPuffs.push({
        x: flakX,
        y: flakY,
        r: 8,
        maxR: 36 + Math.random() * 24,
        alpha: 0.75,
        life: 1.8
      });
    }
  }

  for (let i = flakPuffs.length - 1; i >= 0; i--) {
    const fp = flakPuffs[i];
    fp.r += (fp.maxR - fp.r) * dt * 3.2;
    fp.alpha -= dt * 0.45;
    fp.life -= dt;
    if (fp.life <= 0 || fp.alpha <= 0) {
      flakPuffs.splice(i, 1);
    }
  }

  // 4. Ground Proximity & Terrain Collision Check
  const terrainCollision = checkTerrainCollision(player.x, player.y, 12, terrain.points);
  if (terrainCollision.collided) {
    if (terrainCollision.type === "ocean") {
      killPlayer("Ditched into the ocean at high speed");
    } else {
      killPlayer("CFIT // Controlled flight into mountain terrain");
    }
    return;
  }

  // GPWS Warning Alarm
  const gpws = checkGroundProximity(player.x, player.y, player.vy, terrain.points);
  const gpwsEl = document.getElementById("gpws-warning");
  if (gpwsEl) {
    gpwsEl.style.display = gpws.warning ? "block" : "none";
    if (gpws.warning && Math.random() < 0.15) {
      playWarningBeep();
    }
  }

  // 5. Weapons: Cannon Fire (Space, Touch Button, or Mouse Click)
  player.cannonCooldown = Math.max(0, player.cannonCooldown - dt);
  const wantsCannon = input.isDown("Space") || input.isPressed("fire") || mouseAim.mouseShooting;
  if (wantsCannon && player.cannonCooldown <= 0) {
    fireCannon();
    player.cannonCooldown = player.cannonFireRate;
  }

  // Weapons: Missile Launch (Debounced single-shot with cooldown)
  player.missileCooldown = Math.max(0, (player.missileCooldown || 0) - dt);
  const wantsMissile = input.wasPressed("KeyF") || input.wasPressed("KeyE") || input.isPressed("missile") || mouseAim.rightClicked;
  mouseAim.rightClicked = false;
  if (wantsMissile && player.missileCooldown <= 0) {
    launchMissile();
    player.missileCooldown = 0.5;
  }

  // Weapons: Flares (Debounced single-shot with cooldown)
  player.flareCooldown = Math.max(0, (player.flareCooldown || 0) - dt);
  const wantsFlare = input.wasPressed("KeyC") || input.wasPressed("KeyQ") || input.isPressed("flare");
  if (wantsFlare && player.flareCooldown <= 0) {
    deployCountermeasure();
    player.flareCooldown = 0.35;
  }
  input.clearJustPressed(); // presses not consumed this frame must not fire later

  // RWR Warning Alarm check (Incoming Hostile Missiles)
  const incomingMissiles = missiles.filter((m) => !m.isPlayer && m.target === player && m.life > 0);
  const rwrEl = document.getElementById("rwr-warning");
  if (rwrEl) {
    if (incomingMissiles.length > 0) {
      rwrEl.style.display = "block";
      if (Math.random() < 0.22) {
        playWarningBeep();
      }
    } else {
      rwrEl.style.display = "none";
    }
  }

  // 6. Update Radar & Targets
  updateRadarLock(dt);

  // 7. Update Entities & Projectiles
  updateBullets(dt);
  updateMissiles(dt);
  updateCountermeasures(dt);
  updateShockwaves(dt);
  updateEnemies(dt);
  updateWingman(dt);

  // 8. Mission Progress Check (fires once; the next sortie launches after a short beat)
  const aliveBandits = enemies.filter((e) => e.isAlive).length;
  if (aliveBandits === 0 && enemies.length > 0 && missionClearTimer < 0 && !campaignComplete) {
    completeCurrentMission();
  }
  if (missionClearTimer >= 0) {
    missionClearTimer -= dt;
    if (missionClearTimer < 0) startMission(currentMissionIndex + 1);
  }

  // 9. Camera Smoothing & Shake
  const targetCamX = player.x + player.vx * 0.28;
  const targetCamY = player.y + player.vy * 0.28;
  camera.x = lerp(camera.x, targetCamX, dt * 6.0);
  camera.y = lerp(camera.y, targetCamY, dt * 6.0);
  if (camera.shake > 0) {
    camera.shake = Math.max(0, camera.shake - dt * 25);
  }

  updateHUD();
}

function fireCannon() {
  playCannon({ duration: player.cannonExplosive ? 0.16 : 0.09 });
  camera.shake = Math.min(8, camera.shake + 1.5);

  const spread = (Math.random() - 0.5) * (player.cannonExplosive ? 0.05 : 0.025);
  const v = player.speed + player.cannonVelocity;

  bullets.push({
    x: player.x + Math.cos(player.angle) * 28,
    y: player.y + Math.sin(player.angle) * 28,
    vx: Math.cos(player.angle + spread) * v,
    vy: Math.sin(player.angle + spread) * v,
    life: 1.5,
    dmg: player.cannonDmg,
    isExplosive: player.cannonExplosive,
    isPlayer: true
  });
}

function launchMissile() {
  if (player.missilesCount <= 0) {
    toast({ title: "WINCHESTER", body: "Out of air-to-air missiles!", icon: "alert" });
    return;
  }
  player.missilesCount--;

  playLaser({ pitch: 440, duration: 0.22 });
  if (player.selectedTarget && player.hasLock) {
    toast({
      title: `FOX TWO! [${player.missilesCount} LEFT]`,
      body: `Fired ${player.missileType} at ${player.selectedTarget.name}`,
      icon: "bolt"
    });
  } else {
    toast({
      title: `FOX TWO! [${player.missilesCount} LEFT]`,
      body: `Fired ${player.missileType} (Boresight)`,
      icon: "bolt"
    });
  }

  missiles.push({
    x: player.x,
    y: player.y,
    angle: player.angle,
    speed: player.speed + 320,
    maxSpeed: 960,
    // Seeker only guides with a full radar lock; otherwise it flies boresight
    target: player.hasLock ? player.selectedTarget : null,
    type: player.missileType,
    life: 6.0,
    isPlayer: true
  });
}

function deployCountermeasure() {
  if (player.flaresCount <= 0) {
    toast({ title: "FLARES DEPLETED", body: "No countermeasures remaining!", icon: "alert" });
    return;
  }
  player.flaresCount--;
  sfx.click();

  for (let i = 0; i < 5; i++) {
    const a = player.angle + Math.PI + (Math.random() - 0.5) * 0.9;
    countermeasures.push({
      x: player.x,
      y: player.y,
      vx: Math.cos(a) * (180 + Math.random() * 80),
      vy: Math.sin(a) * (180 + Math.random() * 80),
      life: 2.4,
      type: "flare",
      owner: "player"
    });
  }
}

// Bandits pop their own flares against an incoming player missile
function deployEnemyFlares(e) {
  e.flares--;
  for (let i = 0; i < 4; i++) {
    const a = e.angle + Math.PI + (Math.random() - 0.5) * 1.1;
    countermeasures.push({
      x: e.x,
      y: e.y,
      vx: Math.cos(a) * (160 + Math.random() * 80),
      vy: Math.sin(a) * (160 + Math.random() * 80),
      life: 2.2,
      type: "flare",
      owner: "enemy"
    });
  }
}

function updateRadarLock(dt) {
  let bestTarget = null;
  const craft = AIRCRAFT_ROSTER[player.type] || AIRCRAFT_ROSTER.f22;
  let minDist = craft.radarRange || 2400;

  enemies.forEach((e) => {
    if (!e.isAlive) return;
    const d = dist(player.x, player.y, e.x, e.y);
    const ang = Math.atan2(e.y - player.y, e.x - player.x);
    const diff = Math.abs(angleDiff(ang, player.angle));

    // Radar cone 48 degrees
    if (d < minDist && diff < 0.8) {
      // Check cloud occlusion
      if (canMaintainRadarLock(player, e)) {
        bestTarget = e;
        minDist = d;
      }
    }
  });

  player.selectedTarget = bestTarget;
  if (bestTarget) {
    const stealthPenalty = bestTarget.stealth ? 0.4 : 1.0;
    player.lockTimer = Math.min(1.5, player.lockTimer + dt * stealthPenalty);
    if (player.lockTimer >= 1.0 && !player.hasLock) {
      player.hasLock = true;
      playLockTone();
    }
  } else {
    player.lockTimer = 0;
    player.hasLock = false;
  }
}

function updateBullets(dt) {
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;

    // Check hit against terrain
    const tCol = checkTerrainCollision(b.x, b.y, 4, terrain.points);
    if (tCol.collided) {
      b.life = 0;
    }

    // Check hit against enemies (a round stops in the first airframe it hits)
    if (b.isPlayer && b.life > 0) {
      for (const e of enemies) {
        if (e.isAlive && dist(b.x, b.y, e.x, e.y) < 28) {
          e.hp -= b.dmg;
          b.life = 0;
          playLaser({ startFreq: 180, endFreq: 90, duration: 0.08 });
          if (b.isExplosive) {
            playExplosion({ duration: 0.3, lowpass: 400 });
          }
          if (e.hp <= 0) destroyEnemy(e);
          break;
        }
      }
    } else if (!b.isPlayer && b.life > 0) {
      // Check hit on player
      if (dist(b.x, b.y, player.x, player.y) < 20) {
        const dmgTaken = Math.round((b.dmg || 18) * (1 - player.damageResist));
        player.hp -= dmgTaken;
        b.life = 0;
        camera.shake = 10;
        playExplosion({ duration: 0.25, lowpass: 340 });
        if (player.hp <= 0) killPlayer("Shot down by enemy cannon fire");
      }
    }

    if (b.life <= 0) bullets.splice(i, 1);
  }
}

function updateMissiles(dt) {
  for (let i = missiles.length - 1; i >= 0; i--) {
    const m = missiles[i];
    m.life -= dt;
    m.speed = Math.min(m.maxSpeed, m.speed + dt * 320);

    // A guided player missile closing on a bandit may provoke a flare dump (once per missile)
    if (m.isPlayer && m.target && m.target.isAlive && !m.flareChecked && dist(m.x, m.y, m.target.x, m.target.y) < 380) {
      m.flareChecked = true;
      const odds = m.target.highGManeuvers ? 0.6 : 0.3;
      if (m.target.flares > 0 && Math.random() < odds) deployEnemyFlares(m.target);
    }

    // Decoy check: only the OTHER side's flares can seduce a seeker
    let currentTarg = m.target;
    if (currentTarg) {
      for (const cm of countermeasures) {
        const hostileFlare = m.isPlayer ? cm.owner === "enemy" : cm.owner !== "enemy";
        if (hostileFlare && dist(m.x, m.y, cm.x, cm.y) < 280) {
          currentTarg = cm;
          m.target = cm; // once seduced, the seeker stays on the decoy
          break;
        }
      }
    }

    if (currentTarg && (currentTarg.isAlive || currentTarg.life > 0)) {
      const wantAngle = Math.atan2(currentTarg.y - m.y, currentTarg.x - m.x);
      const diff = angleDiff(wantAngle, m.angle);
      m.angle += clamp(diff, -3.5 * dt, 3.5 * dt);
    }

    m.x += Math.cos(m.angle) * m.speed * dt;
    m.y += Math.sin(m.angle) * m.speed * dt;

    // Check terrain collision
    const col = checkTerrainCollision(m.x, m.y, 6, terrain.points);
    if (col.collided) {
      m.life = 0;
      playExplosion({ duration: 0.6, lowpass: 220 });
    }

    // Detonation on target
    if (m.isPlayer && m.life > 0) {
      for (const e of enemies) {
        if (e.isAlive && dist(m.x, m.y, e.x, e.y) < 30) {
          const missileDamage = m.type === "AGM-65 MAVERICK" ? 220 : 150;
          e.hp -= missileDamage;
          m.life = 0;
          camera.shake = 14;
          playExplosion({ duration: 1.0, lowpass: 200 });
          if (e.hp <= 0) destroyEnemy(e);
          break;
        }
      }
    } else if (!m.isPlayer && m.life > 0) {
      if (dist(m.x, m.y, player.x, player.y) < 26) {
        const dmgTaken = Math.round(75 * (1 - player.damageResist));
        player.hp -= dmgTaken;
        m.life = 0;
        camera.shake = 22;
        playExplosion({ duration: 1.2, lowpass: 160 });
        if (player.hp <= 0) killPlayer("Direct hit by enemy heat-seeking missile");
      }
    }

    if (m.life <= 0) missiles.splice(i, 1);
  }
}

function updateCountermeasures(dt) {
  for (let i = countermeasures.length - 1; i >= 0; i--) {
    const cm = countermeasures[i];
    cm.x += cm.vx * dt;
    cm.y += cm.vy * dt;
    cm.life -= dt;
    if (cm.life <= 0) countermeasures.splice(i, 1);
  }
}

function updateShockwaves(dt) {
  for (let i = shockwaves.length - 1; i >= 0; i--) {
    const sw = shockwaves[i];
    sw.radius += dt * 380;
    sw.alpha = Math.max(0, sw.alpha - dt * 1.6);
    if (sw.radius >= sw.maxRadius || sw.alpha <= 0) {
      shockwaves.splice(i, 1);
    }
  }
}

function updateEnemies(dt) {
  enemies.forEach((e) => {
    if (!e.isAlive) return;

    const d = dist(e.x, e.y, player.x, player.y);
    const toPlayer = Math.atan2(player.y - e.y, player.x - e.x);

    // Steer along the SHORTEST way round (plain lerp on raw angles spun bandits the long way at ±180°)
    const steer = (target, rate) => {
      e.angle += angleDiff(target, e.angle) * Math.min(1, rate);
      e.angle = Math.atan2(Math.sin(e.angle), Math.cos(e.angle));
    };

    // AI Maneuvers based on Aircraft Class
    if (e.highGManeuvers) {
      // Ace: high-speed intercept and Cobra loops
      const wantAng = d > 450 ? toPlayer : e.angle + 0.6;
      steer(wantAng, dt * e.pitchRate);
      e.speed = 490;
    } else if (e.type === "tu160") {
      // Bomber: steady flight path with gentle banks toward the fight
      steer(toPlayer, dt * 0.3);
    } else {
      // General Pursuit
      steer(toPlayer, dt * e.pitchRate * 0.85);
    }

    // AI Mountain Collision Avoidance (Pulls up if near terrain)
    const eGPWS = checkGroundProximity(e.x, e.y, Math.sin(e.angle) * e.speed, terrain.points);
    if (eGPWS.warning) {
      const climbOut = Math.cos(e.angle) >= 0 ? -Math.PI / 3 : -Math.PI + Math.PI / 3; // keep heading, nose up
      steer(climbOut, dt * 3.5);
    }

    // Terrain crash check for bandits!
    const eCol = checkTerrainCollision(e.x, e.y, 14, terrain.points);
    if (eCol.collided) {
      e.isAlive = false;
      player.kills++;
      playExplosion({ duration: 1.2, lowpass: 180 });
      toast({ title: "CFIT SPLASH!", body: `${e.name} crashed into mountain terrain!`, icon: "target" });
      return;
    }

    e.x += Math.cos(e.angle) * e.speed * dt;
    e.y += Math.sin(e.angle) * e.speed * dt;

    // AI Cannon Fire (holds fire during missionGraceTimer)
    e.attackCd -= dt;
    if (missionGraceTimer <= 0 && e.attackCd <= 0 && d < 750 && Math.abs(angleDiff(toPlayer, e.angle)) < 0.4) {
      e.attackCd = 1.4;
      bullets.push({
        x: e.x,
        y: e.y,
        vx: Math.cos(e.angle) * (e.speed + 650),
        vy: Math.sin(e.angle) * (e.speed + 650),
        life: 1.3,
        dmg: 18,
        isExplosive: false,
        isPlayer: false
      });
    }

    // Bomber Defensive Flak Cannon (fires backwards at trailing aircraft)
    if (e.defensiveFlak && d < 650 && Math.abs(angleDiff(toPlayer, e.angle + Math.PI)) < 0.5) {
      if (missionGraceTimer <= 0 && Math.random() < 0.08) {
        bullets.push({
          x: e.x - Math.cos(e.angle) * 30,
          y: e.y - Math.sin(e.angle) * 30,
          vx: -Math.cos(e.angle) * (e.speed + 550),
          vy: -Math.sin(e.angle) * (e.speed + 550),
          life: 1.2,
          dmg: 24,
          isExplosive: true,
          isPlayer: false
        });
      }
    }

    // AI Missile Launch (holds fire during missionGraceTimer)
    if (e.firesMissiles) {
      e.missileCd -= dt;
      if (missionGraceTimer <= 0 && e.missileCd <= 0 && d < 1200 && d > 350 && Math.abs(angleDiff(toPlayer, e.angle)) < 0.5) {
        e.missileCd = 5.0 + Math.random() * 4;
        playWarningBeep();
        toast({ title: "MISSILE LAUNCH DETECTED", body: `Bandit fired missile! POP FLARES [C]!`, icon: "alert" });
        missiles.push({
          x: e.x,
          y: e.y,
          angle: e.angle,
          speed: e.speed + 250,
          maxSpeed: 820,
          target: player,
          type: "IR",
          life: 5.5,
          isPlayer: false
        });
      }
    }
  });
}

function updateWingman(dt) {
  if (!wingman || !wingman.isAlive) return;
  const targetX = player.x - Math.cos(player.angle) * 120 + Math.sin(player.angle) * 90;
  const targetY = player.y - Math.sin(player.angle) * 120 - Math.cos(player.angle) * 90;
  wingman.x = lerp(wingman.x, targetX, dt * 3.5);
  wingman.y = lerp(wingman.y, targetY, dt * 3.5);
  wingman.angle = player.angle;

  // Wingman covers you: short bursts at bandits in its forward cone
  wingman.gunCd -= dt;
  if (wingman.gunCd <= 0 && missionGraceTimer <= 0) {
    const tgt = enemies.find((e) => {
      if (!e.isAlive) return false;
      const d = dist(wingman.x, wingman.y, e.x, e.y);
      const off = Math.abs(angleDiff(Math.atan2(e.y - wingman.y, e.x - wingman.x), wingman.angle));
      return d < 650 && off < 0.35;
    });
    if (tgt) {
      wingman.gunCd = 0.7;
      const a = Math.atan2(tgt.y - wingman.y, tgt.x - wingman.x);
      const v = player.speed + 850;
      bullets.push({
        x: wingman.x + Math.cos(a) * 24,
        y: wingman.y + Math.sin(a) * 24,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        life: 1.0,
        dmg: 10,
        isExplosive: false,
        isPlayer: true
      });
    } else {
      wingman.gunCd = 0.25;
    }
  }
}

function destroyEnemy(e) {
  e.isAlive = false;
  player.kills++;
  camera.shake = 16;
  playExplosion({ duration: 1.2, lowpass: 190 });
  toast({
    title: `SPLASH: ${e.name}!`,
    body: `Confirmed kill (+${e.scoreValue} PTS) // [${player.kills} KILLS TOTAL]`,
    icon: "target"
  });
}

function completeCurrentMission() {
  sfx.powerup();
  toast({
    title: "AIRSPACE SECURED",
    body: `${MISSIONS[currentMissionIndex].title} CLEARED!`,
    icon: "trophy"
  });

  if (currentMissionIndex + 1 < MISSIONS.length) {
    missionClearTimer = 2.8; // next sortie launches from update() (so it respects pause)
  } else {
    // Campaign Victory
    campaignComplete = true;
    saveGameScore("ace-vector", player.kills, `TOP GUN ACE // ALL 8 MISSIONS // ${player.kills} KILLS`);
    toast({
      title: "CAMPAIGN VICTORY!",
      body: "You cleared all 8 combat sorties and achieved Top Gun Ace status!",
      icon: "trophy"
    });
    showDebrief("CAMPAIGN COMPLETE // TOP GUN", [
      `<span style="color:#ffb700;">AIRFRAME: ${escapeHtml((AIRCRAFT_ROSTER[player.type] || {}).name || "FIGHTER")}</span>`,
      `<span>ALL ${MISSIONS.length} SORTIES FLOWN</span>`,
      `<span>CONFIRMED AIR-TO-AIR KILLS: ${player.kills}</span>`
    ], "[ FLY THE CAMPAIGN AGAIN ]");
  }
}

function showDebrief(title, lines, retryLabel) {
  const modal = document.getElementById("av-debrief-modal");
  if (!modal) return;
  const titleEl = modal.querySelector(".av-modal-title");
  if (titleEl) titleEl.textContent = title;
  const statsEl = document.getElementById("debrief-stats");
  if (statsEl) statsEl.innerHTML = lines.join("");
  const retryBtn = document.getElementById("btn-debrief-retry");
  if (retryBtn) retryBtn.textContent = retryLabel;
  modal.style.display = "flex";
}

// Relaunch after a shoot-down (same sortie) or after the campaign (from mission 1).
function relaunch() {
  const modal = document.getElementById("av-debrief-modal");
  if (modal) modal.style.display = "none";
  const fromStart = campaignComplete;
  campaignComplete = false;
  if (fromStart) player.kills = 0;
  const craft = AIRCRAFT_ROSTER[player.type] || AIRCRAFT_ROSTER.f22;
  Object.assign(player, {
    x: 1800, y: 3200, vx: 380, vy: 0, angle: 0, speed: 380, throttle: 0.8,
    hp: craft.hp, maxHp: craft.hp, isAlive: true, isStalled: false, wasSupersonic: false
  });
  player.vaporTrails.length = 0;
  camera.x = player.x;
  camera.y = player.y;
  camera.shake = 0;
  startMission(fromStart ? 0 : currentMissionIndex);
}
document.getElementById("btn-debrief-retry")?.addEventListener("click", relaunch);

function killPlayer(reason) {
  if (!player.isAlive) return;
  player.isAlive = false;
  camera.shake = 28;
  playExplosion({ duration: 1.6, lowpass: 130 });
  saveGameScore("ace-vector", player.kills, `M${currentMissionIndex + 1} // ${player.kills} KILLS`, { details: reason });
  ["gpws-warning", "rwr-warning", "stall-warning"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.style.display = "none";
  });

  showDebrief("MISSION DEBRIEFING", [
    `<span style="color:#ffb700;">AIRFRAME: ${escapeHtml((AIRCRAFT_ROSTER[player.type] || {}).name || "FIGHTER")}</span>`,
    `<span>MISSION: ${escapeHtml(MISSIONS[currentMissionIndex].title)}</span>`,
    `<span>CONFIRMED AIR-TO-AIR KILLS: ${player.kills}</span>`,
    `<span style="color:#ff3333;">LOSS CAUSE: ${escapeHtml(reason.toUpperCase())}</span>`
  ], "[ RETRY SORTIE ]");
}

function updateHUD() {
  const spdEl = document.getElementById("hud-speed");
  const altEl = document.getElementById("hud-alt");
  const fuelEl = document.getElementById("hud-fuel");
  const lockEl = document.getElementById("hud-lock-status");
  const strataEl = document.getElementById("hud-strata");
  const stallEl = document.getElementById("stall-warning");

  if (spdEl) spdEl.textContent = `${Math.round(player.speed)} KTS`;
  if (altEl) altEl.textContent = `${Math.round(Math.max(0, (SEA_LEVEL_Y - player.y) * 2))} FT`;
  if (fuelEl) fuelEl.textContent = `${Math.round(player.fuel)}%`;

  if (strataEl) {
    strataEl.textContent = player.strata.replace("_", " ");
    strataEl.style.color = player.strata === "STRATOSPHERE" ? "#00f0ff" : player.strata === "CLOUD_DECK" ? "#e0f7fa" : "#ffb700";
  }

  if (lockEl) {
    const ammo = ` // MSL ${player.missilesCount} • FLR ${player.flaresCount}`;
    lockEl.textContent = (player.hasLock ? `RADAR LOCK [${player.missileType}]` : player.selectedTarget ? "TRACKING..." : "SEARCHING") + ammo;
    lockEl.style.color = player.hasLock ? "#ff3333" : "#ffb700";
  }


  if (stallEl) {
    stallEl.style.display = player.isStalled ? "block" : "none";
  }
}

// ── Rendering Engine ──
function render() {
  // Screen Shake translation
  let sx = 0;
  let sy = 0;
  if (camera.shake > 0) {
    sx = (Math.random() - 0.5) * camera.shake;
    sy = (Math.random() - 0.5) * camera.shake;
  }

  // 1. Stratospheric Sky Gradient
  const skyGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  if (player.y < CLOUD_DECK_TOP_Y) {
    // Deep starry stratosphere
    skyGrad.addColorStop(0, "#010308");
    skyGrad.addColorStop(0.5, "#051224");
    skyGrad.addColorStop(1, "#10253f");
  } else if (player.y <= CLOUD_DECK_BOTTOM_Y) {
    // Cloud deck twilight
    skyGrad.addColorStop(0, "#0a1829");
    skyGrad.addColorStop(0.45, "#1f3750");
    skyGrad.addColorStop(1, "#3c5874");
  } else {
    // Low canyon atmospheric warm haze
    skyGrad.addColorStop(0, "#0e2035");
    skyGrad.addColorStop(0.5, "#2b4661");
    skyGrad.addColorStop(1, "#4b687f");
  }
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const camX = camera.x - canvas.width / 2 + sx;
  const camY = camera.y - canvas.height / 2 + sy;

  ctx.save();
  ctx.translate(-camX, -camY);

  // 2. Celestial Sun Disc, Radiant Beams & Lens Flare
  drawCelestialSun(camX, camY);

  // 3. Stratosphere Starfield (Parallax 0.18x)
  if (player.y < CLOUD_DECK_TOP_Y + 500) {
    const starAlphaMult = clamp(1.0 - (player.y - 1200) / 1600, 0, 1);
    stars.forEach((s) => {
      ctx.fillStyle = "#ffffff";
      ctx.globalAlpha = s.alpha * starAlphaMult;
      ctx.beginPath();
      ctx.arc(s.x + camX * 0.82, s.y + camY * 0.82, s.r, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1.0;
  }

  // 4. Multi-Layered Parallax Mountain Ridges
  drawParallaxRidges(camX, camY);

  // 5. Volumetric Clouds in Cloud Deck
  drawClouds(camX, camY);

  // 6. Coastal & Maritime Installations (Carrier, Airfield, Oil Rig, Lighthouse)
  drawInstallations(camX, camY);

  // 7. Foreground Mountain Landscape with Rock Strata, Snowcaps & Evergreen Pines
  drawForegroundTerrain(camX, camY);

  // 8. Ocean Water Surface with Waves & Sun Glint
  drawEnhancedOcean(camX, camY);

  // 9. Low-Altitude Sea Spray Rooster Tails
  sprayParticles.forEach((sp) => {
    const alpha = (sp.life / sp.maxLife) * 0.75;
    ctx.fillStyle = `rgba(180, 240, 255, ${alpha})`;
    ctx.beginPath();
    ctx.arc(sp.x, sp.y, sp.r, 0, Math.PI * 2);
    ctx.fill();
  });

  // 10. Ambient Combat Flak Puffs
  flakPuffs.forEach((fp) => {
    const puffGrad = ctx.createRadialGradient(fp.x, fp.y, 2, fp.x, fp.y, fp.r);
    puffGrad.addColorStop(0, `rgba(255, 140, 0, ${fp.alpha * 0.9})`);
    puffGrad.addColorStop(0.35, `rgba(60, 60, 60, ${fp.alpha * 0.75})`);
    puffGrad.addColorStop(0.8, `rgba(25, 25, 25, ${fp.alpha * 0.4})`);
    puffGrad.addColorStop(1, `rgba(10, 10, 10, 0)`);
    ctx.fillStyle = puffGrad;
    ctx.beginPath();
    ctx.arc(fp.x, fp.y, fp.r, 0, Math.PI * 2);
    ctx.fill();
  });

  // 11. Supersonic Shockwave Rings
  shockwaves.forEach((sw) => {
    ctx.save();
    ctx.translate(sw.x, sw.y);
    ctx.rotate(sw.angle);
    ctx.strokeStyle = `rgba(0, 240, 255, ${sw.alpha})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(0, 0, sw.radius, sw.radius * 0.45, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  });

  // 12. Flares & Countermeasures
  countermeasures.forEach((cm) => {
    ctx.fillStyle = "#ffff55";
    ctx.shadowColor = "#ffaa00";
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(cm.x, cm.y, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  });

  // 13. High-G Vapor Trails
  player.vaporTrails.forEach((v) => {
    const alpha = (v.life / v.maxLife) * 0.45;
    ctx.fillStyle = `rgba(224, 247, 250, ${alpha})`;
    ctx.beginPath();
    ctx.arc(v.x, v.y, 3.5, 0, Math.PI * 2);
    ctx.fill();
  });

  // 14. Bullets & Tracers
  bullets.forEach((b) => {
    ctx.fillStyle = b.isExplosive ? "#ff7700" : b.isPlayer ? "#ffee55" : "#ff3344";
    ctx.fillRect(b.x - 2, b.y - 2, b.isExplosive ? 6 : 4, b.isExplosive ? 6 : 4);
  });

  // 15. Missiles & Rocket Plumes
  missiles.forEach((m) => {
    ctx.save();
    ctx.translate(m.x, m.y);
    ctx.rotate(m.angle);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(-10, -2.5, 20, 5);
    // Rocket Flame plume
    ctx.fillStyle = "#ff7700";
    ctx.beginPath();
    ctx.moveTo(-10, -2.5);
    ctx.lineTo(-24 - Math.random() * 8, 0);
    ctx.lineTo(-10, 2.5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  });

  // 16. Friendly Wingman
  if (wingman && wingman.isAlive) {
    drawPlayerAircraft(wingman.x, wingman.y, wingman.angle, "f22", false, 0, "#00ffaa");
  }

  // 17. Enemy Bandits
  enemies.forEach((e) => {
    if (e.isAlive) {
      drawEnemyAircraft(e);
    }
  });

  // 18. Player Aircraft
  const isBurnerActive = player.throttle > 1.0;
  drawPlayerAircraft(player.x, player.y, player.angle, player.type, isBurnerActive, 0);

  // 19. Lead Pursuit Reticle for Rotary Cannon
  if (player.selectedTarget) {
    const t = player.selectedTarget;
    const v = player.speed + player.cannonVelocity;
    const leadTime = dist(player.x, player.y, t.x, t.y) / v;
    const leadX = t.x + Math.cos(t.angle) * t.speed * leadTime;
    const leadY = t.y + Math.sin(t.angle) * t.speed * leadTime;

    ctx.strokeStyle = player.hasLock ? "#ff3333" : "#ffb700";
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(leadX, leadY, 15, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(leadX - 20, leadY);
    ctx.lineTo(leadX + 20, leadY);
    ctx.moveTo(leadX, leadY - 20);
    ctx.lineTo(leadX, leadY + 20);
    ctx.stroke();

    // Box around target
    ctx.strokeRect(t.x - 18, t.y - 18, 36, 36);
  }

  // 20. Mouse Flight Aim Reticle & Vector Director
  drawMouseAimReticle(camX, camY);

  // 21. Cloud Deck Fog Overlay when Inside Clouds
  if (player.strata === "CLOUD_DECK") {
    ctx.fillStyle = "rgba(220, 238, 255, 0.18)";
    ctx.fillRect(camX, camY, canvas.width, canvas.height);
  }

  ctx.restore();

  // Screen treatments: damage vignette, lens vignette, CRT scanlines
  if (player.isAlive && player.hp < player.maxHp * 0.35) {
    vignette(ctx, canvas.width, canvas.height, 0.35 + Math.sin(performance.now() / 160) * 0.12, "#8a0012");
  }
  vignette(ctx, canvas.width, canvas.height, 0.45);
  scanlines(ctx, canvas.width, canvas.height, 0.05);
}

// ── Background & Landscape Drawing ──

function drawCelestialSun(camX, camY) {
  // Parallax Sun Position
  const sunX = 5400 + camX * 0.92;
  const sunY = 900 + camY * 0.94;

  ctx.save();

  // 1. Sun Radial Corona
  const radGrad = ctx.createRadialGradient(sunX, sunY, 20, sunX, sunY, 520);
  radGrad.addColorStop(0, "rgba(255, 245, 215, 0.95)");
  radGrad.addColorStop(0.12, "rgba(255, 215, 120, 0.45)");
  radGrad.addColorStop(0.35, "rgba(255, 160, 45, 0.16)");
  radGrad.addColorStop(0.7, "rgba(255, 110, 20, 0.04)");
  radGrad.addColorStop(1, "rgba(255, 90, 0, 0)");
  ctx.fillStyle = radGrad;
  ctx.fillRect(camX - 200, camY - 200, canvas.width + 400, canvas.height + 400);

  // 2. Core Sun Disc
  ctx.fillStyle = "#fffdf5";
  ctx.shadowColor = "#ffaa00";
  ctx.shadowBlur = 45;
  ctx.beginPath();
  ctx.arc(sunX, sunY, 34, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  // 3. Radiant Atmospheric Sun Beams
  ctx.save();
  ctx.translate(sunX, sunY);
  ctx.strokeStyle = "rgba(255, 235, 180, 0.06)";
  ctx.lineWidth = 14;
  for (let i = 0; i < 12; i++) {
    const beamAngle = (i * Math.PI) / 6 + 0.08;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(beamAngle) * 950, Math.sin(beamAngle) * 950);
    ctx.stroke();
  }
  ctx.restore();

  // 4. Optical Lens Flare Elements
  const screenCenterX = camX + canvas.width / 2;
  const screenCenterY = camY + canvas.height / 2;
  const dx = screenCenterX - sunX;
  const dy = screenCenterY - sunY;

  const flares = [
    { t: 0.28, r: 14, color: "rgba(255, 200, 100, 0.18)" },
    { t: 0.52, r: 26, color: "rgba(0, 240, 255, 0.12)" },
    { t: 0.72, r: 10, color: "rgba(255, 100, 180, 0.15)" },
    { t: 1.12, r: 42, color: "rgba(255, 220, 120, 0.09)" },
    { t: 1.38, r: 18, color: "rgba(50, 255, 180, 0.11)" }
  ];

  flares.forEach((f) => {
    const fx = sunX + dx * f.t;
    const fy = sunY + dy * f.t;
    ctx.fillStyle = f.color;
    ctx.beginPath();
    ctx.arc(fx, fy, f.r, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.restore();
}

// Filled snowcap: ridge line on top, a ragged lower edge whose depth grows with height above the snow line.
function snowCap(pts, offset, snowLine, maxDepth, litCol, shadeCol) {
  const dense = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const steps = Math.max(1, Math.ceil(Math.abs(b.x - a.x) / 18));
    for (let k = 0; k < steps; k++) {
      const u = k / steps;
      dense.push({ x: a.x + (b.x - a.x) * u + offset, y: a.y + (b.y - a.y) * u });
    }
  }
  if (!dense.length) return;
  const depthAt = (p, i) => {
    const d = Math.min(maxDepth, Math.max(0, (snowLine - p.y) * 0.85));
    return d > 0 ? d + ((i * 7919) % 13) - 6 : 0;
  };
  ctx.beginPath();
  dense.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  for (let i = dense.length - 1; i >= 0; i--) ctx.lineTo(dense[i].x, dense[i].y + depthAt(dense[i], i));
  ctx.closePath();
  ctx.fillStyle = shadeCol;
  ctx.fill();
  // Sun-lit faces: segments rising to the right are lit (sun is to the upper right)
  ctx.fillStyle = litCol;
  for (let i = 1; i < dense.length; i++) {
    const p = dense[i];
    const q = dense[i - 1];
    if (p.y > q.y) continue;
    const d = depthAt(p, i);
    if (d <= 0) continue;
    ctx.beginPath();
    ctx.moveTo(q.x, q.y);
    ctx.lineTo(p.x, p.y);
    ctx.lineTo(p.x, p.y + d);
    ctx.lineTo(q.x, q.y + depthAt(q, i - 1));
    ctx.closePath();
    ctx.fill();
  }
}

// Distant ridges: gradient-filled silhouettes with rim light, snowy summits and atmospheric haze.
function ridgeLayer(pointsArr, offset, fillTop, fillBot, rimCol, snowLine, hazeAlpha, camX) {
  const vis = pointsArr.filter((pt) => pt.x + offset > camX - 400 && pt.x + offset < camX + canvas.width + 400);
  if (vis.length < 2) return;
  const trace = () => {
    ctx.beginPath();
    ctx.moveTo(vis[0].x + offset, SEA_LEVEL_Y);
    vis.forEach((pt) => ctx.lineTo(pt.x + offset, pt.y));
    ctx.lineTo(vis[vis.length - 1].x + offset, SEA_LEVEL_Y);
    ctx.closePath();
  };
  const g = ctx.createLinearGradient(0, 3200, 0, SEA_LEVEL_Y);
  g.addColorStop(0, fillTop);
  g.addColorStop(1, fillBot);
  trace();
  ctx.fillStyle = g;
  ctx.fill();
  ctx.save();
  trace();
  ctx.clip();
  // Snowcaps, then rim light on the sun-facing slopes
  snowCap(vis, offset, snowLine, 320, "rgba(240, 247, 255, 0.95)", "rgba(185, 205, 228, 0.95)");
  ctx.lineJoin = "round";
  for (let i = 1; i < vis.length; i++) {
    const a = vis[i - 1];
    const b = vis[i];
    ctx.strokeStyle = b.y < a.y ? rimCol : "rgba(0,0,0,0.25)";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(a.x + offset, a.y);
    ctx.lineTo(b.x + offset, b.y);
    ctx.stroke();
  }
  // Haze thickening toward the sea
  const hz = ctx.createLinearGradient(0, 3600, 0, SEA_LEVEL_Y);
  hz.addColorStop(0, `rgba(120, 150, 185, 0)`);
  hz.addColorStop(1, `rgba(120, 150, 185, ${hazeAlpha})`);
  ctx.fillStyle = hz;
  ctx.fillRect(camX - 400, 3000, canvas.width + 800, SEA_LEVEL_Y - 3000);
  ctx.restore();
}

function drawParallaxRidges(camX, camY) {
  const distant = terrain.distantRidges;
  if (!distant) return;
  if (distant.far && distant.far.length > 0) ridgeLayer(distant.far, camX * 0.82, "#243850", "#101b28", "rgba(170, 200, 230, 0.35)", 3900, 0.5, camX);
  if (distant.mid && distant.mid.length > 0) ridgeLayer(distant.mid, camX * 0.55, "#1a2a3c", "#0a121c", "rgba(170, 200, 230, 0.45)", 3650, 0.35, camX);
}

function drawClouds(camX, camY) {
  // High Cirrus Wisps Band
  ctx.save();
  ctx.strokeStyle = "rgba(220, 240, 255, 0.12)";
  ctx.lineWidth = 16;
  ctx.beginPath();
  for (let x = camX - 100; x <= camX + canvas.width + 100; x += 60) {
    const cy = CLOUD_DECK_TOP_Y - 240 + Math.sin(x * 0.0025) * 35;
    if (x === camX - 100) ctx.moveTo(x, cy);
    else ctx.lineTo(x, cy);
  }
  ctx.stroke();

  // Volumetric Clusters with Shaded Puffs
  clouds.forEach((c) => {
    if (c.x + c.w > camX - 180 && c.x - c.w < camX + canvas.width + 180) {
      c.puffs.forEach((puff) => {
        const px = c.x + puff.ox;
        const py = c.y + puff.oy;
        const puffGrad = ctx.createRadialGradient(px, py - puff.r * 0.35, puff.r * 0.08, px, py, puff.r);
        puffGrad.addColorStop(0, `rgba(255, 255, 255, ${c.alpha})`);
        puffGrad.addColorStop(0.65, `rgba(220, 235, 250, ${c.alpha * 0.75})`);
        puffGrad.addColorStop(1, `rgba(180, 205, 230, 0)`);
        ctx.fillStyle = puffGrad;
        ctx.beginPath();
        ctx.arc(px, py, puff.r, 0, Math.PI * 2);
        ctx.fill();
      });
    }
  });
  ctx.restore();
}

function drawForegroundTerrain(camX, camY) {
  const points = terrain.points;
  if (!points || points.length === 0) return;

  ctx.save();

  // 1. Rock massif: world-anchored rock texture + depth shading
  const trace = () => {
    ctx.beginPath();
    ctx.moveTo(points[0].x, SEA_LEVEL_Y);
    points.forEach((p) => ctx.lineTo(p.x, p.y));
    ctx.lineTo(points[points.length - 1].x, SEA_LEVEL_Y);
    ctx.closePath();
  };
  trace();
  ctx.fillStyle = patternOf(ctx, ROCK_TEX);
  ctx.fill();
  ctx.save();
  trace();
  ctx.clip();
  const depth = ctx.createLinearGradient(0, 3400, 0, SEA_LEVEL_Y);
  depth.addColorStop(0, "rgba(60, 90, 120, 0.15)");
  depth.addColorStop(1, "rgba(3, 8, 14, 0.75)");
  ctx.fillStyle = depth;
  ctx.fillRect(camX - 100, 3000, canvas.width + 200, SEA_LEVEL_Y - 3000);

  // 2. Snowcaps on the high ridges, rim light on sunward slopes
  const visPts = points.filter((p) => p.x > camX - 700 && p.x < camX + canvas.width + 700);
  snowCap(visPts, 0, 4150, 260, "#f4f9ff", "#c9dbee");
  ctx.lineJoin = "round";
  for (let i = 0; i < visPts.length - 1; i++) {
    const p1 = visPts[i];
    const p2 = visPts[i + 1];
    ctx.strokeStyle = p2.y < p1.y ? "rgba(180, 210, 240, 0.55)" : "rgba(0, 0, 0, 0.35)";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
  }
  ctx.restore();

  // 3. Crisp outline
  trace();
  ctx.strokeStyle = "rgba(120, 160, 200, 0.5)";
  ctx.lineWidth = 2;
  ctx.stroke();

  // 4. Multi-Tiered Evergreen Pine Trees
  terrain.trees.forEach((t) => {
    if (t.x > camX - 60 && t.x < camX + canvas.width + 60) {
      // Trunk
      ctx.fillStyle = "#3e2723";
      ctx.fillRect(t.x - 1.5, t.y - 6, 3, 6);

      // Bottom tier
      ctx.fillStyle = "#0c281e";
      ctx.beginPath();
      ctx.moveTo(t.x, t.y - t.h * 0.45);
      ctx.lineTo(t.x - 9, t.y - 4);
      ctx.lineTo(t.x + 9, t.y - 4);
      ctx.closePath();
      ctx.fill();

      // Mid tier
      ctx.fillStyle = "#12382a";
      ctx.beginPath();
      ctx.moveTo(t.x, t.y - t.h * 0.75);
      ctx.lineTo(t.x - 7, t.y - t.h * 0.35);
      ctx.lineTo(t.x + 7, t.y - t.h * 0.35);
      ctx.closePath();
      ctx.fill();

      // Top tier
      ctx.fillStyle = "#1b4d3a";
      ctx.beginPath();
      ctx.moveTo(t.x, t.y - t.h);
      ctx.lineTo(t.x - 5, t.y - t.h * 0.65);
      ctx.lineTo(t.x + 5, t.y - t.h * 0.65);
      ctx.closePath();
      ctx.fill();
    }
  });

  ctx.restore();
}

function drawInstallations(camX, camY) {
  const list = terrain.installations;
  if (!list || list.length === 0) return;

  const now = Date.now() * 0.003;

  list.forEach((inst) => {
    const instW = inst.length || inst.width || 300;
    if (inst.x + instW < camX - 100 || inst.x - 100 > camX + canvas.width + 100) return;

    ctx.save();

    if (inst.type === "carrier") {
      // CVN-80 VALIANT Aircraft Carrier
      const cx = inst.x;
      const cy = inst.y;
      const cl = inst.length;
      const cd = inst.deckH;

      // Hull below water / waterline
      ctx.fillStyle = "#1c242e";
      ctx.beginPath();
      ctx.moveTo(cx - cl * 0.5, cy);
      ctx.lineTo(cx - cl * 0.48, cy + 18);
      ctx.lineTo(cx + cl * 0.44, cy + 18);
      ctx.lineTo(cx + cl * 0.5, cy);
      ctx.closePath();
      ctx.fill();

      // Red waterline stripe
      ctx.fillStyle = "#c0392b";
      ctx.fillRect(cx - cl * 0.49, cy + 14, cl * 0.95, 3);

      // Main Flight Deck
      ctx.fillStyle = "#2c3e50";
      ctx.strokeStyle = "#7f8c8d";
      ctx.lineWidth = 1.5;
      ctx.fillRect(cx - cl * 0.5, cy - cd, cl, cd);
      ctx.strokeRect(cx - cl * 0.5, cy - cd, cl, cd);

      // Flight Deck Markings: Yellow/White runway stripe
      ctx.strokeStyle = "rgba(255, 235, 59, 0.75)";
      ctx.lineWidth = 2;
      ctx.setLineDash([12, 8]);
      ctx.beginPath();
      ctx.moveTo(cx - cl * 0.46, cy - cd + 10);
      ctx.lineTo(cx + cl * 0.38, cy - cd + 10);
      ctx.stroke();
      ctx.setLineDash([]);

      // Hull Number "80" on Deck
      ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
      ctx.font = "bold 12px monospace";
      ctx.fillText("CVN-80", cx - cl * 0.42, cy - cd + 24);

      // Arrestor wires
      ctx.strokeStyle = "#bdc3c7";
      ctx.lineWidth = 1.2;
      inst.arrestorWires.forEach((wx) => {
        ctx.beginPath();
        ctx.moveTo(wx, cy - cd + 4);
        ctx.lineTo(wx, cy - cd + 22);
        ctx.stroke();
      });

      // Steam Catapult Track & Steam Puffs
      ctx.strokeStyle = "#e67e22";
      ctx.lineWidth = 1;
      inst.catapults.forEach((catX) => {
        ctx.strokeRect(catX, cy - cd + 5, 80, 2);
        const steamAlpha = 0.25 + Math.sin(now * 2 + catX) * 0.15;
        ctx.fillStyle = `rgba(240, 248, 255, ${steamAlpha})`;
        ctx.beginPath();
        ctx.arc(catX + 40, cy - cd + 2, 4 + Math.sin(now * 3) * 2, 0, Math.PI * 2);
        ctx.fill();
      });

      // Island Superstructure (Command Bridge)
      const ix = inst.islandX;
      const iw = inst.islandW;
      const ih = inst.islandH;
      ctx.fillStyle = "#34495e";
      ctx.fillRect(ix, cy - cd - ih, iw, ih);
      ctx.strokeStyle = "#95a5a6";
      ctx.strokeRect(ix, cy - cd - ih, iw, ih);

      // Bridge Windows (green glow)
      ctx.fillStyle = "#2ecc71";
      ctx.fillRect(ix + 6, cy - cd - ih + 6, iw - 12, 4);

      // Phased Array Radome / Mast Antenna
      ctx.strokeStyle = "#ecf0f1";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(ix + iw * 0.5, cy - cd - ih);
      ctx.lineTo(ix + iw * 0.5, cy - cd - ih - 22);
      ctx.lineTo(ix + iw * 0.5 - 10, cy - cd - ih - 14);
      ctx.moveTo(ix + iw * 0.5, cy - cd - ih - 22);
      ctx.lineTo(ix + iw * 0.5 + 10, cy - cd - ih - 14);
      ctx.stroke();

      // Rotating Air-Search Radar on Island
      const radarRot = Math.cos(now * 4) * 8;
      ctx.strokeStyle = "#f39c12";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(ix + iw * 0.5 - radarRot, cy - cd - ih - 24);
      ctx.lineTo(ix + iw * 0.5 + radarRot, cy - cd - ih - 24);
      ctx.stroke();

      // Parked Jets on Deck
      drawPlayerAircraft(cx + 80, cy - cd + 18, 0, "f22", false, 0, "#7f8c8d");
      drawPlayerAircraft(cx + 140, cy - cd + 18, 0, "f22", false, 0, "#7f8c8d");

    } else if (inst.type === "airfield") {
      // FORWARD BASE OMEGA Coastal Airfield
      const ax = inst.x;
      const ay = inst.y;
      const al = inst.length;

      // Base tarmac embankment
      ctx.fillStyle = "#1e272e";
      ctx.fillRect(ax - al * 0.5, ay - 14, al, 18);

      // Asphalt Runway with edge lines
      ctx.fillStyle = "#2f3640";
      ctx.fillRect(ax - al * 0.48, ay - 12, al * 0.96, 12);
      ctx.strokeStyle = "#f5f6fa";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(ax - al * 0.48, ay - 12, al * 0.96, 12);

      // Centerline dashed runway markings
      ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
      ctx.lineWidth = 2;
      ctx.setLineDash([14, 10]);
      ctx.beginPath();
      ctx.moveTo(ax - al * 0.45, ay - 6);
      ctx.lineTo(ax + al * 0.45, ay - 6);
      ctx.stroke();
      ctx.setLineDash([]);

      // Runway Threshold Piano Keys
      for (let k = 0; k < 6; k++) {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(ax - al * 0.46 + k * 8, ay - 11, 4, 10);
        ctx.fillRect(ax + al * 0.46 - k * 8 - 4, ay - 11, 4, 10);
      }

      // Runway Edge Lights
      for (let lx = ax - al * 0.45; lx <= ax + al * 0.45; lx += 70) {
        ctx.fillStyle = Math.sin(now * 3 + lx) > 0 ? "#00f0ff" : "#ffffff";
        ctx.beginPath();
        ctx.arc(lx, ay - 13, 2, 0, Math.PI * 2);
        ctx.fill();
      }

      // Air Traffic Control Tower
      const tx = inst.towerX;
      const th = inst.towerH;
      ctx.fillStyle = "#353b48";
      ctx.fillRect(tx - 10, ay - 14 - th, 20, th);
      // Glazed observation cab
      ctx.fillStyle = "#00d2d3";
      ctx.fillRect(tx - 16, ay - 14 - th, 32, 14);
      // Tower beacon
      ctx.fillStyle = Math.sin(now * 6) > 0 ? "#ff3838" : "#ffffff";
      ctx.beginPath();
      ctx.arc(tx, ay - 14 - th - 5, 3.5, 0, Math.PI * 2);
      ctx.fill();

      // Hardened Aircraft Hangars (corrugated arch)
      inst.hangars.forEach((hx) => {
        ctx.fillStyle = "#718093";
        ctx.beginPath();
        ctx.arc(hx, ay - 14, 28, Math.PI, 0);
        ctx.fill();
        ctx.strokeStyle = "#2f3640";
        ctx.lineWidth = 2;
        ctx.stroke();

        // Hangar open bay door
        ctx.fillStyle = "#1e272e";
        ctx.fillRect(hx - 16, ay - 30, 32, 16);
      });

      // Base Name Plate
      ctx.fillStyle = "#dcdde1";
      ctx.font = "bold 11px monospace";
      ctx.fillText("AIRBASE OMEGA", ax - 45, ay - 18);

    } else if (inst.type === "oilRig") {
      // TITAN DEEPWATER PLATFORM
      const rx = inst.x;
      const ry = inst.y;
      const rw = inst.width;
      const rd = inst.deckH;

      // Steel Lattice Legs in Water
      ctx.strokeStyle = "#e1b12c";
      ctx.lineWidth = 3;
      const legOffsets = [-rw * 0.4, -rw * 0.15, rw * 0.15, rw * 0.4];
      legOffsets.forEach((lo) => {
        ctx.beginPath();
        ctx.moveTo(rx + lo, ry - rd);
        ctx.lineTo(rx + lo * 1.15, ry + 120);
        ctx.stroke();
      });

      // Cross Truss Bracing
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = "#c23616";
      ctx.beginPath();
      ctx.moveTo(rx - rw * 0.4, ry - rd);
      ctx.lineTo(rx + rw * 0.4, ry + 80);
      ctx.moveTo(rx + rw * 0.4, ry - rd);
      ctx.lineTo(rx - rw * 0.4, ry + 80);
      ctx.stroke();

      // Main Deck & Modules
      ctx.fillStyle = "#2f3640";
      ctx.fillRect(rx - rw * 0.5, ry - rd, rw, 16);
      ctx.strokeStyle = "#fbc531";
      ctx.strokeRect(rx - rw * 0.5, ry - rd, rw, 16);

      // Helipad on cantilever
      ctx.fillStyle = "#353b48";
      ctx.fillRect(rx - rw * 0.5 - 35, ry - rd - 6, 40, 6);
      ctx.strokeStyle = "#ffffff";
      ctx.strokeRect(rx - rw * 0.5 - 35, ry - rd - 6, 40, 6);
      ctx.fillStyle = "#f5f6fa";
      ctx.font = "bold 9px monospace";
      ctx.fillText("H", rx - rw * 0.5 - 18, ry - rd - 1);

      // Crane with boom
      ctx.strokeStyle = "#e1b12c";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(rx + rw * 0.25, ry - rd);
      ctx.lineTo(rx + rw * 0.25, ry - rd - 30);
      ctx.lineTo(rx + rw * 0.25 + 35, ry - rd - 45);
      ctx.stroke();

      // Angled Flare Boom Stack & Animated Burning Flame
      const fx = inst.flareStackX;
      const fh = inst.flareH;
      ctx.strokeStyle = "#718093";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(fx, ry - rd);
      ctx.lineTo(fx + 25, ry - rd - fh);
      ctx.stroke();

      // Flickering Methane Flame
      const flameTipX = fx + 25 + (Math.random() - 0.5) * 6;
      const flameTipY = ry - rd - fh - 24 - Math.sin(now * 15) * 8;
      const flameGrad = ctx.createRadialGradient(fx + 25, ry - rd - fh, 4, fx + 25, ry - rd - fh, 28);
      flameGrad.addColorStop(0, "rgba(255, 255, 255, 0.95)");
      flameGrad.addColorStop(0.3, "rgba(255, 180, 0, 0.8)");
      flameGrad.addColorStop(0.7, "rgba(255, 60, 0, 0.4)");
      flameGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = flameGrad;
      ctx.beginPath();
      ctx.arc(fx + 25, ry - rd - fh, 24, 0, Math.PI * 2);
      ctx.fill();

      // Smoke puff from flare
      ctx.fillStyle = "rgba(40, 40, 40, 0.35)";
      ctx.beginPath();
      ctx.arc(flameTipX + 15 + Math.sin(now * 2) * 10, flameTipY - 20, 14, 0, Math.PI * 2);
      ctx.fill();

    } else if (inst.type === "lighthouse") {
      // CAPE VALIANT LIGHT
      const lx = inst.x;
      const ly = inst.y;
      const th = inst.towerH;

      // Rocky cliff pedestal
      ctx.fillStyle = "#1e272e";
      ctx.beginPath();
      ctx.moveTo(lx - 45, ly);
      ctx.lineTo(lx - 25, ly - 20);
      ctx.lineTo(lx + 25, ly - 20);
      ctx.lineTo(lx + 45, ly);
      ctx.closePath();
      ctx.fill();

      // Conical Masonry Tower with Red/White Spiral Stripes
      const baseW = 28;
      const topW = 16;
      const towerTopY = ly - 20 - th;

      // White tower body
      ctx.fillStyle = "#f5f6fa";
      ctx.beginPath();
      ctx.moveTo(lx - baseW * 0.5, ly - 20);
      ctx.lineTo(lx - topW * 0.5, towerTopY);
      ctx.lineTo(lx + topW * 0.5, towerTopY);
      ctx.lineTo(lx + baseW * 0.5, ly - 20);
      ctx.closePath();
      ctx.fill();

      // Red spiral daymark bands
      ctx.fillStyle = "#e84118";
      for (let b = 1; b <= 3; b++) {
        const by = ly - 20 - (th * b) / 4;
        ctx.beginPath();
        ctx.moveTo(lx - baseW * 0.45, by);
        ctx.lineTo(lx + baseW * 0.45, by - 12);
        ctx.lineTo(lx + baseW * 0.42, by - 20);
        ctx.lineTo(lx - baseW * 0.42, by - 8);
        ctx.closePath();
        ctx.fill();
      }

      // Lantern Room & Gallery
      ctx.fillStyle = "#2f3640";
      ctx.fillRect(lx - 12, towerTopY - 14, 24, 14);
      // Cupola Roof
      ctx.fillStyle = "#e84118";
      ctx.beginPath();
      ctx.arc(lx, towerTopY - 14, 10, Math.PI, 0);
      ctx.fill();

      // Sweeping Rotating Beacon Light Cone
      const sweepAngle = now * 1.8;
      const coneLength = 520;
      const coneSpread = 0.28;
      const beamX1 = lx + Math.cos(sweepAngle - coneSpread) * coneLength;
      const beamY1 = towerTopY - 7 + Math.sin(sweepAngle - coneSpread) * coneLength;
      const beamX2 = lx + Math.cos(sweepAngle + coneSpread) * coneLength;
      const beamY2 = towerTopY - 7 + Math.sin(sweepAngle + coneSpread) * coneLength;

      const beamGrad = ctx.createRadialGradient(lx, towerTopY - 7, 10, lx, towerTopY - 7, coneLength);
      beamGrad.addColorStop(0, "rgba(255, 255, 200, 0.85)");
      beamGrad.addColorStop(0.3, "rgba(255, 245, 160, 0.35)");
      beamGrad.addColorStop(0.7, "rgba(255, 230, 100, 0.1)");
      beamGrad.addColorStop(1, "rgba(255, 220, 50, 0)");

      ctx.fillStyle = beamGrad;
      ctx.beginPath();
      ctx.moveTo(lx, towerTopY - 7);
      ctx.lineTo(beamX1, beamY1);
      ctx.lineTo(beamX2, beamY2);
      ctx.closePath();
      ctx.fill();

      // Glowing lens bulb
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(lx, towerTopY - 7, 5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  });
}

function drawEnhancedOcean(camX, camY) {
  ctx.save();

  // 1. Deep Ocean Gradient Base
  const oceanGrad = ctx.createLinearGradient(0, SEA_LEVEL_Y, 0, SEA_LEVEL_Y + 1200);
  oceanGrad.addColorStop(0, "#081d2e");
  oceanGrad.addColorStop(0.15, "#041421");
  oceanGrad.addColorStop(0.5, "#020b12");
  oceanGrad.addColorStop(1, "#010508");
  ctx.fillStyle = oceanGrad;
  ctx.fillRect(camX - 200, SEA_LEVEL_Y, canvas.width + 400, 1200);

  const time = Date.now() * 0.0025;

  // 2. Sun Glint / Reflection Column on Water Surface
  const sunX = 5400 + camX * 0.92;
  const glintW = 340;
  const glintGrad = ctx.createLinearGradient(sunX - glintW * 0.5, 0, sunX + glintW * 0.5, 0);
  glintGrad.addColorStop(0, "rgba(255, 200, 100, 0)");
  glintGrad.addColorStop(0.3, "rgba(255, 215, 120, 0.18)");
  glintGrad.addColorStop(0.5, "rgba(255, 245, 180, 0.45)");
  glintGrad.addColorStop(0.7, "rgba(255, 215, 120, 0.18)");
  glintGrad.addColorStop(1, "rgba(255, 200, 100, 0)");
  ctx.fillStyle = glintGrad;
  ctx.fillRect(sunX - glintW * 0.5, SEA_LEVEL_Y, glintW, 450);

  // 3. Multi-Frequency Swell Waves & Whitecaps
  ctx.strokeStyle = "rgba(0, 240, 255, 0.55)";
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  for (let x = camX - 200; x <= camX + canvas.width + 200; x += 12) {
    const swell = Math.sin(x * 0.015 + time * 0.8) * 6;
    const chop = Math.sin(x * 0.06 - time * 1.6) * 3;
    const ripple = Math.sin(x * 0.12 + time * 2.2) * 1.5;
    const wy = SEA_LEVEL_Y + swell + chop + ripple;
    if (x === camX - 200) ctx.moveTo(x, wy);
    else ctx.lineTo(x, wy);
  }
  ctx.stroke();

  // Secondary sub-surface wave highlight
  ctx.strokeStyle = "rgba(46, 204, 113, 0.25)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let x = camX - 200; x <= camX + canvas.width + 200; x += 18) {
    const wy2 = SEA_LEVEL_Y + 12 + Math.sin(x * 0.02 - time) * 4;
    if (x === camX - 200) ctx.moveTo(x, wy2);
    else ctx.lineTo(x, wy2);
  }
  ctx.stroke();

  ctx.restore();
}

function drawMouseAimReticle(camX, camY) {
  if (!mouseAim.active || !player.isAlive) return;

  const mx = camX + mouseAim.screenX;
  const my = camY + mouseAim.screenY;

  ctx.save();

  // Flight Director Lead Line from Nose to Mouse Aim
  const noseX = player.x + Math.cos(player.angle) * 28;
  const noseY = player.y + Math.sin(player.angle) * 28;

  ctx.strokeStyle = "rgba(0, 240, 255, 0.35)";
  ctx.lineWidth = 1.2;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(noseX, noseY);
  ctx.lineTo(mx, my);
  ctx.stroke();
  ctx.setLineDash([]);

  // Reticle Circle
  ctx.strokeStyle = "#00f0ff";
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.arc(mx, my, 12, 0, Math.PI * 2);
  ctx.stroke();

  // Center pip
  ctx.fillStyle = "#00f0ff";
  ctx.beginPath();
  ctx.arc(mx, my, 2.5, 0, Math.PI * 2);
  ctx.fill();

  // 4 Cardinal Hash Marks
  ctx.beginPath();
  ctx.moveTo(mx - 18, my);
  ctx.lineTo(mx - 12, my);
  ctx.moveTo(mx + 12, my);
  ctx.lineTo(mx + 18, my);
  ctx.moveTo(mx, my - 18);
  ctx.lineTo(mx, my - 12);
  ctx.moveTo(mx, my + 12);
  ctx.lineTo(mx, my + 18);
  ctx.stroke();

  ctx.restore();
}

// ── Vector Aircraft Renderers ──
// Clip to the hull path that was just filled and add a lit gradient, panel lines and a glint.
function shadeHull() {
  ctx.save();
  ctx.clip();
  const g = ctx.createLinearGradient(0, -26, 0, 26);
  g.addColorStop(0, "rgba(255, 255, 255, 0.3)");
  g.addColorStop(0.45, "rgba(255, 255, 255, 0.05)");
  g.addColorStop(1, "rgba(0, 0, 0, 0.5)");
  ctx.fillStyle = g;
  ctx.fillRect(-42, -32, 84, 64);
  ctx.strokeStyle = "rgba(0, 0, 0, 0.35)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-26, 0);
  ctx.lineTo(26, 0);
  for (const px of [-14, -4, 8]) {
    ctx.moveTo(px, -26);
    ctx.lineTo(px, 26);
  }
  ctx.stroke();
  ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
  ctx.fillRect(2, -4, 12, 1);
  ctx.restore();
}

function drawPlayerAircraft(x, y, angle, type, afterburning, pitchInput, customColor = null) {
  const craft = AIRCRAFT_ROSTER[type] || AIRCRAFT_ROSTER.f22;
  const strokeColor = customColor || craft.color;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);

  // 1. Afterburner Shock Plumes & Diamonds
  if (afterburning) {
    glow(ctx, -30, 0, 26, "#ff8a3d", 0.55);
    // Outer flame cone
    ctx.fillStyle = "#ff6600";
    ctx.beginPath();
    ctx.moveTo(-18, -5);
    ctx.lineTo(-38 - Math.random() * 12, 0);
    ctx.lineTo(-18, 5);
    ctx.closePath();
    ctx.fill();

    // Inner cyan flame & shock diamonds
    ctx.fillStyle = "#00f0ff";
    ctx.beginPath();
    ctx.moveTo(-18, -2.5);
    ctx.lineTo(-28 - Math.random() * 6, 0);
    ctx.lineTo(-18, 2.5);
    ctx.closePath();
    ctx.fill();

    // White shock diamond
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.moveTo(-22, 0);
    ctx.lineTo(-25, -2);
    ctx.lineTo(-28, 0);
    ctx.lineTo(-25, 2);
    ctx.closePath();
    ctx.fill();
  }

  // 2. Bespoke Silhouette by Aircraft Type
  ctx.fillStyle = "#2c3a4c";
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = 1.8;

  if (type === "f22") {
    // F-22A Stealth Raptor (Diamond delta, canted twin tails, chine nose)
    ctx.beginPath();
    ctx.moveTo(26, 0);        // Stealth nose
    ctx.lineTo(12, 6);
    ctx.lineTo(-2, 11);
    ctx.lineTo(-16, 24);      // Right wingtip
    ctx.lineTo(-20, 16);
    ctx.lineTo(-26, 18);      // Right canted rudder
    ctx.lineTo(-22, 6);
    ctx.lineTo(-24, 0);       // Thrust nozzle
    ctx.lineTo(-22, -6);
    ctx.lineTo(-26, -18);     // Left canted rudder
    ctx.lineTo(-20, -16);
    ctx.lineTo(-16, -24);     // Left wingtip
    ctx.lineTo(-2, -11);
    ctx.lineTo(12, -6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    shadeHull();

    // Gold tinted stealth canopy
    ctx.fillStyle = "#00f0ff";
    ctx.beginPath();
    ctx.ellipse(6, 0, 8, 3, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (type === "su47") {
    // Su-47 Berkut (Forward-swept wings & active canards)
    ctx.beginPath();
    ctx.moveTo(28, 0);        // Long pointed nose
    ctx.lineTo(14, 4);
    ctx.lineTo(10, 14);       // Right forward canard
    ctx.lineTo(4, 4);
    ctx.lineTo(-20, 6);
    ctx.lineTo(-12, 28);      // Forward-swept wingtip (angled forward!)
    ctx.lineTo(-18, 14);
    ctx.lineTo(-24, 12);      // Twin tail
    ctx.lineTo(-22, 0);       // Center exhaust
    ctx.lineTo(-24, -12);     // Twin tail
    ctx.lineTo(-18, -14);
    ctx.lineTo(-12, -28);     // Left forward-swept wingtip
    ctx.lineTo(-20, -6);
    ctx.lineTo(4, -4);
    ctx.lineTo(10, -14);      // Left canard
    ctx.lineTo(14, -4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    shadeHull();

    // Cockpit
    ctx.fillStyle = "#38ef7d";
    ctx.beginPath();
    ctx.ellipse(8, 0, 7, 3, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (type === "a10") {
    // A-10C Warthog (Straight wings, twin high-mounted turbofan nacelles, H-tail)
    ctx.beginPath();
    ctx.moveTo(22, 0);        // Blunt nose with 30mm gun
    ctx.lineTo(12, 6);
    ctx.lineTo(2, 6);
    ctx.lineTo(2, 26);        // Right straight wingtip
    ctx.lineTo(-8, 26);
    ctx.lineTo(-8, 7);
    ctx.lineTo(-22, 7);
    ctx.lineTo(-22, 16);      // Right H-tail rudder
    ctx.lineTo(-26, 16);
    ctx.lineTo(-26, -16);     // Left H-tail rudder
    ctx.lineTo(-22, -16);
    ctx.lineTo(-22, -7);
    ctx.lineTo(-8, -7);
    ctx.lineTo(-8, -26);      // Left straight wingtip
    ctx.lineTo(2, -26);
    ctx.lineTo(2, -6);
    ctx.lineTo(12, -6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    shadeHull();

    // Twin High-Mounted Turbofan Nacelles
    ctx.fillStyle = "#2d3748";
    ctx.fillRect(-16, -12, 10, 5);
    ctx.fillRect(-16, 7, 10, 5);

    // 30mm GAU-8 Rotary Gun Barrel on Nose
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.strokeRect(20, -1.5, 6, 3);

    // Bubble Canopy
    ctx.fillStyle = "#a8ff78";
    ctx.beginPath();
    ctx.ellipse(8, 0, 6, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (type === "mirage") {
    // Mirage 2000 (Clean tailless delta wing, large central fin, pitot tube)
    ctx.beginPath();
    ctx.moveTo(28, 0);        // Pitot probe nose
    ctx.lineTo(10, 5);
    ctx.lineTo(-18, 24);      // Delta wingtip
    ctx.lineTo(-20, 8);
    ctx.lineTo(-24, 0);       // Single central engine nozzle
    ctx.lineTo(-20, -8);
    ctx.lineTo(-18, -24);     // Delta wingtip
    ctx.lineTo(10, -5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    shadeHull();

    // Large delta vertical tail fin
    ctx.fillStyle = strokeColor;
    ctx.fillRect(-16, -1.5, 12, 3);

    // Blue canopy
    ctx.fillStyle = "#4facfe";
    ctx.beginPath();
    ctx.ellipse(8, 0, 7, 3, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (type === "sr71") {
    // SR-71X Vector (Long needle chine, twin massive ramjet nacelles with spike cones)
    ctx.beginPath();
    ctx.moveTo(34, 0);        // Needle nose
    ctx.lineTo(18, 5);
    ctx.lineTo(-6, 8);
    ctx.lineTo(-12, 22);      // Right wing outer
    ctx.lineTo(-24, 20);
    ctx.lineTo(-26, 0);
    ctx.lineTo(-24, -20);
    ctx.lineTo(-12, -22);     // Left wing outer
    ctx.lineTo(-6, -8);
    ctx.lineTo(18, -5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    shadeHull();

    // Dual Ramjet Nacelles with Spike Cones
    ctx.fillStyle = "#ff0844";
    ctx.fillRect(-16, -16, 16, 5);
    ctx.fillRect(-16, 11, 16, 5);
    // Shock Spikes
    ctx.beginPath();
    ctx.moveTo(0, -13.5);
    ctx.lineTo(4, -13.5);
    ctx.moveTo(0, 13.5);
    ctx.lineTo(4, 13.5);
    ctx.stroke();

    // Narrow stealth cockpit
    ctx.fillStyle = "#ffb199";
    ctx.beginPath();
    ctx.ellipse(12, 0, 8, 2, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawEnemyAircraft(e) {
  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.rotate(e.angle);

  ctx.fillStyle = "#3a2a30";
  ctx.strokeStyle = e.color;
  ctx.lineWidth = 1.8;

  if (e.type === "mig21") {
    // MiG-21 (Pencil fuselage, intake shock cone, small delta wing)
    ctx.beginPath();
    ctx.moveTo(22, 0);
    ctx.lineTo(6, 4);
    ctx.lineTo(-8, 16);     // Delta wing
    ctx.lineTo(-12, 6);
    ctx.lineTo(-20, 8);     // Stabilizer
    ctx.lineTo(-18, 0);
    ctx.lineTo(-20, -8);
    ctx.lineTo(-12, -6);
    ctx.lineTo(-8, -16);
    ctx.lineTo(6, -4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    shadeHull();

    // Nose intake shock cone
    ctx.fillStyle = e.color;
    ctx.beginPath();
    ctx.arc(20, 0, 2.5, 0, Math.PI * 2);
    ctx.fill();
  } else if (e.type === "tu160") {
    // Tu-160 Blackjack (Massive strategic bomber, variable-geometry wings, 4 engines)
    ctx.beginPath();
    ctx.moveTo(34, 0);
    ctx.lineTo(16, 8);
    ctx.lineTo(-4, 38);      // Huge wingspan!
    ctx.lineTo(-12, 38);
    ctx.lineTo(-14, 10);
    ctx.lineTo(-32, 16);     // Giant T-tail
    ctx.lineTo(-34, 0);
    ctx.lineTo(-32, -16);
    ctx.lineTo(-14, -10);
    ctx.lineTo(-12, -38);
    ctx.lineTo(-4, -38);
    ctx.lineTo(16, -8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    shadeHull();

    // Twin engine pods under wings
    ctx.fillStyle = "#555";
    ctx.fillRect(-10, -16, 12, 4);
    ctx.fillRect(-10, 12, 12, 4);

    // Defensive rear turret
    ctx.fillStyle = "#ff5252";
    ctx.fillRect(-34, -2, 4, 4);
  } else if (e.type === "j20") {
    // J-20 Mighty Dragon (Angular stealth chine, forward canards, canted fins)
    ctx.beginPath();
    ctx.moveTo(28, 0);
    ctx.lineTo(16, 5);
    ctx.lineTo(12, 13);     // Canard
    ctx.lineTo(6, 5);
    ctx.lineTo(-14, 22);     // Trailing delta wing
    ctx.lineTo(-18, 14);
    ctx.lineTo(-24, 14);     // All-moving fin
    ctx.lineTo(-22, 0);
    ctx.lineTo(-24, -14);
    ctx.lineTo(-18, -14);
    ctx.lineTo(-14, -22);
    ctx.lineTo(6, -5);
    ctx.lineTo(12, -13);    // Canard
    ctx.lineTo(16, -5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    shadeHull();

    ctx.fillStyle = "#6c5ce7";
    ctx.beginPath();
    ctx.ellipse(8, 0, 7, 2.8, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (e.type === "blackGhost") {
    // Black Ghost Hypersonic Prototype Ace Boss (Dual shock cones, crimson trim)
    ctx.beginPath();
    ctx.moveTo(32, 0);
    ctx.lineTo(14, 6);
    ctx.lineTo(-10, 24);
    ctx.lineTo(-18, 16);
    ctx.lineTo(-26, 18);
    ctx.lineTo(-22, 6);
    ctx.lineTo(-28, 0);
    ctx.lineTo(-22, -6);
    ctx.lineTo(-26, -18);
    ctx.lineTo(-18, -16);
    ctx.lineTo(-10, -24);
    ctx.lineTo(14, -6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    shadeHull();

    // Twin Crimson Shock Cones
    ctx.fillStyle = "#ff0000";
    ctx.fillRect(-16, -6, 6, 3);
    ctx.fillRect(-16, 3, 6, 3);
  } else {
    // Su-27 Flanker (Default heavy fighter)
    ctx.beginPath();
    ctx.moveTo(26, 0);
    ctx.lineTo(12, 6);
    ctx.lineTo(2, 10);
    ctx.lineTo(-14, 22);
    ctx.lineTo(-18, 12);
    ctx.lineTo(-24, 14);
    ctx.lineTo(-20, 4);
    ctx.lineTo(-26, 0);      // Stinger tail
    ctx.lineTo(-20, -4);
    ctx.lineTo(-24, -14);
    ctx.lineTo(-18, -12);
    ctx.lineTo(-14, -22);
    ctx.lineTo(2, -10);
    ctx.lineTo(12, -6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    shadeHull();
  }

  // Bandit Health Bar
  if (e.hp < e.maxHp) {
    ctx.rotate(-e.angle); // orient horizontal
    const pct = Math.max(0, e.hp / e.maxHp);
    ctx.fillStyle = "rgba(0,0,0,0.7)";
    ctx.fillRect(-16, -30, 32, 4);
    ctx.fillStyle = e.color;
    ctx.fillRect(-16, -30, 32 * pct, 4);
  }

  ctx.restore();
}

// ── Initialize Sortie ──
setupHangarUI();
selectAircraft("f22", true);
startMission(0);

// Start Loop
const loop = createGameLoop({
  canvas,
  update,
  render
});

loop.start();
