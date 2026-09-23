/**
 * LAST TOWER — Grid Tower Defense & Defense Citadel Engine
 * 9 Detailed Weapon Systems, Procedural Cybernetic Humanoid Attackers,
 * Tactical Commander Abilities, Dynamic A* Pathfinding Maze Validation,
 * Customizable Target Priorities, Game Speed Controls, and High-Tech Citadel Core.
 */

import { initShell, escapeHtml, toast } from "/shared/shell.js";
import { createGameLoop, createInputManager, clamp, lerp, dist, aStar } from "/src/core/engine.js";
import { playLaser, playCannon, playHit, playExplosion, playCoin, playWarningBeep, playTone, sfx } from "/src/core/audio.js";
import { saveGameScore } from "/src/core/save.js";
import { createParticles, vignette, scanlines, glow } from "/src/core/gfx.js";
import { buildField, buildRoad, drawPad, drawPortal, drawCitadel } from "./art.js";

initShell({ crumb: "Last Tower" });

const canvas = document.getElementById("lt-canvas");
const ctx = canvas.getContext("2d");
canvas.width = 960;
canvas.height = 540;

// Grid Definition (24 cols x 14 rows, tile 40x38 roughly)
export const COLS = 24;
export const ROWS = 14;
export const TILE_W = 40;
export const TILE_H = 38;

export const SPAWN_TILE = { x: 0, y: 6 };
export const EXIT_TILE = { x: 23, y: 7 };

// 0 = empty ground, 1 = tower
const grid = new Uint8Array(COLS * ROWS);
const towers = []; // { x, y, type, level: 1-3, cost, totalInvested, cooldown, target, turretAngle, recoil, priority }
const creeps = []; // { x, y, vx, vy, hp, maxHp, speed, type, isFlyer, path: [], walkTimer, acidStacks, freezeTime, stunTime, armor }
const projectiles = []; // bullets, cannon shells, laser beams, rockets, acid pools, sonic pulses
const particles = []; // smoke, sparks, shell casings, splinters
const floatingTexts = []; // damage numbers, crits, gold
const decals = []; // blast craters, acid puddles

// Player Economy & Game State
let gold = 240;
let lives = 20;
let maxLives = 20;
let currentWave = 0;
let waveTimer = 10;
let waveInProgress = false;
let creepsToSpawn = [];
let spawnInterval = 0;
let selectedTowerType = "gatling";
let inspectingTower = null;
let gameSpeed = 1; // 1X, 2X, 3X
let screenShake = 0;
let gameOver = false;
let gridVersion = 0; // bumped whenever towers change, for the placement preview cache
let hoverTile = null; // { x, y } under the mouse
let hoverCache = null; // { key, pathOk }
const scheduled = []; // delayed sim events (salvos, barrage strikes) — tick in game time, freeze on pause

function schedule(delay, fn) {
  scheduled.push({ t: delay, fn });
}

// Commander Tactical Abilities
const COMMANDER_ABILITIES = {
  barrage: { name: "AIR BARRAGE", cost: 40, cdMax: 28, cd: 0 },
  emp: { name: "EMP SHOCK", cost: 50, cdMax: 36, cd: 0 },
  overdrive: { name: "OVERDRIVE", cost: 60, cdMax: 40, cd: 0, activeTime: 0 }
};

// 9 Detailed Tower Specifications
export const TOWER_SPECS = {
  gatling: {
    name: "Vulkan Gatling",
    cost: 60,
    range: 115,
    rate: 0.16,
    dmg: 16,
    type: "physical",
    color: "#00e676",
    desc: "Rapid twin revolving barrels shred unarmored infantry."
  },
  laser: {
    name: "Thermal Laser",
    cost: 110,
    range: 130,
    rate: 0.05,
    dmg: 5.5,
    type: "energy",
    color: "#00f0ff",
    desc: "Continuous concentrated thermal beam bypassing 50% armor."
  },
  cannon: {
    name: "Siege Mortar",
    cost: 125,
    range: 165,
    rate: 1.35,
    dmg: 75,
    splash: 60,
    type: "explosive",
    color: "#ff9900",
    desc: "Heavy swiveling artillery lobbing high-explosive shells."
  },
  tesla: {
    name: "Tesla Coil",
    cost: 150,
    range: 110,
    rate: 0.8,
    dmg: 46,
    chains: 5,
    type: "energy",
    color: "#b366ff",
    desc: "High-voltage lightning arcs chaining between 5 human targets."
  },
  cryo: {
    name: "Cryo Blaster",
    cost: 90,
    range: 100,
    rate: 0.95,
    dmg: 12,
    slow: 0.55,
    type: "frost",
    color: "#00bfa5",
    desc: "Freezing nitrogen pulse slowing foes and making them brittle (+30% dmg)."
  },
  sniper: {
    name: "Mag-Rail Sniper",
    cost: 180,
    range: 9999,
    rate: 2.1,
    dmg: 195,
    piercing: true,
    type: "physical",
    color: "#ff3344",
    desc: "Supersonic piercing slug penetrating all lined-up attackers across the map."
  },
  missile: {
    name: "Swarm Rockets",
    cost: 140,
    range: 180,
    rate: 1.6,
    dmg: 35,
    salvo: 3,
    type: "explosive",
    color: "#ffea00",
    desc: "Fires salvos of 3 spiraling homing micromissiles tracking fast targets."
  },
  acid: {
    name: "Acid Spitter",
    cost: 95,
    range: 120,
    rate: 1.1,
    dmg: 18,
    acidDuration: 4.5,
    type: "chemical",
    color: "#76ff03",
    desc: "Coats path in corrosive sludge melting armor and dealing stacking DOT."
  },
  sonic: {
    name: "Sonic Disruptor",
    cost: 130,
    range: 95,
    rate: 1.25,
    dmg: 28,
    knockback: 24,
    type: "concussive",
    color: "#ff007f",
    desc: "Blasts acoustic shockwaves knocking humanoids backwards along the path."
  }
};

// Enemy Specifications (Humanoid Invaders)
export const ENEMY_SPECS = {
  grunt: {
    name: "Raider Infantry",
    hp: 75,
    speed: 68,
    reward: 8,
    armor: 0.05,
    color: "#8a97b1",
    isFlyer: false,
    scale: 1.0
  },
  runner: {
    name: "Cyber-Scout",
    hp: 42,
    speed: 120,
    reward: 10,
    armor: 0,
    color: "#ffea00",
    isFlyer: false,
    scale: 0.9
  },
  tank: {
    name: "Ironclad Enforcer",
    hp: 310,
    speed: 46,
    reward: 24,
    armor: 0.45,
    color: "#455a64",
    isFlyer: false,
    scale: 1.25,
    hasShield: true
  },
  flyer: {
    name: "Jetpack Commando",
    hp: 68,
    speed: 84,
    reward: 15,
    armor: 0.1,
    color: "#ff007f",
    isFlyer: true,
    scale: 1.05
  },
  medic: {
    name: "Combat Medic",
    hp: 95,
    speed: 62,
    reward: 20,
    armor: 0.15,
    color: "#00e676",
    isFlyer: false,
    heals: true,
    scale: 1.0
  },
  boss: {
    name: "Goliath Cyber-Titan",
    hp: 1400,
    speed: 38,
    reward: 120,
    armor: 0.5,
    color: "#d50000",
    isFlyer: false,
    isBoss: true,
    scale: 1.6
  }
};

// Validate whether a valid path exists from spawn to exit
export function validatePath(testGrid) {
  return pathFrom(SPAWN_TILE.x, SPAWN_TILE.y, testGrid || grid);
}

function pathFrom(gx, gy, g = grid) {
  return aStar({
    start: { x: gx, y: gy },
    goal: EXIT_TILE,
    cols: COLS,
    rows: ROWS,
    isWalkable: (x, y) => g[y * COLS + x] === 0
  });
}

function creepTile(c) {
  return {
    x: clamp(Math.floor(c.x / TILE_W), 0, COLS - 1),
    y: clamp(Math.floor(c.y / TILE_H), 0, ROWS - 1)
  };
}

// Cheap placement checks (no pathfinding): bounds, reserved tiles, existing towers, creeps standing there.
function quickPlacementBlock(gx, gy) {
  if (gx < 0 || gx >= COLS || gy < 0 || gy >= ROWS) return "OUT OF BOUNDS";
  if ((gx === SPAWN_TILE.x && gy === SPAWN_TILE.y) || (gx === EXIT_TILE.x && gy === EXIT_TILE.y)) return "PROTECTED ZONE";
  if (grid[gy * COLS + gx] === 1) return "OCCUPIED";
  const blockedByCreep = creeps.some((c) => {
    if (c.isFlyer) return false;
    const t = creepTile(c);
    return t.x === gx && t.y === gy;
  });
  if (blockedByCreep) return "HOSTILE ON TILE";
  return null;
}

let currentMasterPath = validatePath(grid);

// Input Manager
const input = createInputManager({
  canvas,
  buttons: [
    { id: "callWave", label: "CALL WAVE" },
    { id: "speed", label: "SPEED" }
  ]
});

// Canvas Click to Build or Select Tower
canvas.addEventListener("click", (e) => {
  const rect = canvas.getBoundingClientRect();
  const clickX = (e.clientX - rect.left) * (canvas.width / rect.width);
  const clickY = (e.clientY - rect.top) * (canvas.height / rect.height);

  if (gameOver) return;

  // If clicking outside grid
  const gx = Math.floor(clickX / TILE_W);
  const gy = Math.floor(clickY / TILE_H);

  if (gx < 0 || gx >= COLS || gy < 0 || gy >= ROWS) return;

  // Check if clicked an existing tower
  const existingTower = towers.find((t) => t.x === gx && t.y === gy);
  if (existingTower) {
    inspectingTower = existingTower;
    sfx.click();
    updateInspectorUI();
    return;
  }

  // Deselect inspector if clicking ground and build
  inspectingTower = null;
  updateInspectorUI();
  buildTowerAt(gx, gy);
});

// Hover preview: which tile the cursor is over.
canvas.addEventListener("mousemove", (e) => {
  const rect = canvas.getBoundingClientRect();
  const x = (e.clientX - rect.left) * (canvas.width / rect.width);
  const y = (e.clientY - rect.top) * (canvas.height / rect.height);
  const gx = Math.floor(x / TILE_W);
  const gy = Math.floor(y / TILE_H);
  hoverTile = gx >= 0 && gx < COLS && gy >= 0 && gy < ROWS ? { x: gx, y: gy } : null;
});
canvas.addEventListener("mouseleave", () => {
  hoverTile = null;
});
// Right-click clears the tower inspector.
canvas.addEventListener("contextmenu", (e) => {
  e.preventDefault();
  if (inspectingTower) {
    inspectingTower = null;
    updateInspectorUI();
  }
});

// Re-route every ground creep from wherever it stands (after the maze changes).
function repathCreeps() {
  creeps.forEach((c) => {
    if (c.isFlyer) return;
    const t = creepTile(c);
    const p = pathFrom(t.x, t.y);
    if (p && p.length > 0) {
      c.path = p;
      c.pathIndex = 0;
    }
  });
}

export function buildTowerAt(gx, gy) {
  if (gameOver) return false;
  const block = quickPlacementBlock(gx, gy);
  if (block) {
    sfx.deny();
    const body = block === "PROTECTED ZONE"
      ? "Cannot build on spawn gate or Last Tower citadel!"
      : block === "HOSTILE ON TILE"
        ? "An invader is standing there. Wait for the tile to clear."
        : "That tile is not buildable.";
    toast({ title: block, body, icon: "alert" });
    return false;
  }

  const spec = TOWER_SPECS[selectedTowerType];
  if (gold < spec.cost) {
    sfx.deny();
    toast({ title: "LOW TREASURY", body: `Need ${spec.cost} Gold to commission ${spec.name}`, icon: "alert" });
    return false;
  }

  // Check illegal blocking: spawn must reach the citadel, and so must every ground invader on the field.
  const tempGrid = new Uint8Array(grid);
  tempGrid[gy * COLS + gx] = 1;
  const newPath = validatePath(tempGrid);
  const trapsCreep = !!newPath && creeps.some((c) => {
    if (c.isFlyer) return false;
    const t = creepTile(c);
    return !pathFrom(t.x, t.y, tempGrid);
  });

  if (!newPath || trapsCreep) {
    playWarningBeep();
    sfx.deny();
    toast({ title: "ILLEGAL PLACEMENT", body: "Citadel defense doctrine: You must leave an open maze path!", icon: "alert" });
    return false;
  }

  // Placement valid
  grid[gy * COLS + gx] = 1;
  gridVersion++;
  currentMasterPath = newPath;
  gold -= spec.cost;

  const newTower = {
    x: gx,
    y: gy,
    type: selectedTowerType,
    level: 1,
    cost: spec.cost,
    totalInvested: spec.cost,
    cooldown: 0,
    target: null,
    turretAngle: 0,
    recoil: 0,
    priority: "FIRST"
  };

  towers.push(newTower);
  inspectingTower = newTower;
  sfx.click();
  updateHUD();
  updateInspectorUI();

  // Recalculate path for all active creeps
  repathCreeps();

  return true;
}

export function upgradeInspectedTower() {
  if (!inspectingTower || gameOver) return;
  const upgradeCost = Math.round(inspectingTower.cost * (1 + inspectingTower.level * 0.8));
  if (inspectingTower.level >= 3) {
    sfx.deny();
    toast({ title: "MAX LEVEL", body: "This weapon system is at maximum tier 3!" });
    return;
  }
  if (gold < upgradeCost) {
    sfx.deny();
    toast({ title: "LOW TREASURY", body: `Need ${upgradeCost} Gold to upgrade weapon!` });
    return;
  }

  gold -= upgradeCost;
  inspectingTower.level++;
  inspectingTower.totalInvested += upgradeCost;
  sfx.powerup();
  toast({
    title: "WEAPON UPGRADED!",
    body: `${TOWER_SPECS[inspectingTower.type].name} Tier ${inspectingTower.level} Operational!`,
    icon: "bolt"
  });

  updateHUD();
  updateInspectorUI();
}

export function sellInspectedTower() {
  if (!inspectingTower || gameOver) return;
  const refund = Math.floor(inspectingTower.totalInvested * 0.7);
  gold += refund;

  grid[inspectingTower.y * COLS + inspectingTower.x] = 0;
  gridVersion++;
  const idx = towers.indexOf(inspectingTower);
  if (idx !== -1) towers.splice(idx, 1);

  currentMasterPath = validatePath(grid);
  repathCreeps(); // a freshly opened gap may be a shortcut
  inspectingTower = null;
  playCoin();
  toast({ title: "TOWER RECYCLED", body: `+${refund} Gold recovered (70% value)` });

  updateHUD();
  updateInspectorUI();
}

// Tactical Commander Abilities
export function triggerOrbitalBarrage() {
  const ab = COMMANDER_ABILITIES.barrage;
  if (gameOver || ab.cd > 0 || gold < ab.cost) {
    sfx.deny();
    return;
  }
  gold -= ab.cost;
  ab.cd = ab.cdMax;
  screenShake = 14;
  playExplosion({ duration: 1.2, lowpass: 240 });
  toast({ title: "AIR BARRAGE INCOMING!", body: "5 heavy orbital strikes pounding the perimeter!", icon: "bomb" });

  // Strike 5 random creeps or strategic path nodes
  for (let s = 0; s < 5; s++) {
    schedule(s * 0.22, () => {
      let targetX = (COLS * 0.4 + Math.random() * COLS * 0.4) * TILE_W;
      let targetY = (ROWS * 0.3 + Math.random() * ROWS * 0.4) * TILE_H;

      if (creeps.length > 0) {
        const c = creeps[Math.floor(Math.random() * creeps.length)];
        targetX = c.x + (Math.random() - 0.5) * 40;
        targetY = c.y + (Math.random() - 0.5) * 40;
      }

      // Spawn blast crater decal
      decals.push({ x: targetX, y: targetY, r: 24, alpha: 0.85, life: 10, maxLife: 10, type: "crater" });
      playExplosion({ duration: 0.8, lowpass: 200 });
      explosionFx(targetX, targetY, true);
      screenShake = Math.max(screenShake, 8);

      // Damage nearby creeps
      for (const cr of [...creeps]) {
        if (dist(targetX, targetY, cr.x, cr.y) < 70) {
          floatingTexts.push({ x: cr.x, y: cr.y - 10, text: "-110 CRIT!", color: "#ffea00", life: 1.0 });
          damageCreep(cr, 110);
        }
      }
    });
  }
  updateHUD();
}

export function triggerEMPShock() {
  const ab = COMMANDER_ABILITIES.emp;
  if (gameOver || ab.cd > 0 || gold < ab.cost) {
    sfx.deny();
    return;
  }
  gold -= ab.cost;
  ab.cd = ab.cdMax;
  sfx.laser();
  playTone(480, 0.4, "sawtooth", 0.2);
  toast({ title: "EMP SHOCKWAVE FIRED!", body: "All cybernetic invaders disabled for 3.5s!", icon: "bolt" });

  // Paralyze every creep on field
  creeps.forEach((c) => {
    c.stunTime = 3.5;
    floatingTexts.push({ x: c.x, y: c.y - 12, text: "STUNNED!", color: "#00f0ff", life: 1.2 });
  });

  // Shockwave particle
  projectiles.push({
    x: (EXIT_TILE.x + 0.5) * TILE_W,
    y: (EXIT_TILE.y + 0.5) * TILE_H,
    radius: 10,
    maxRadius: 1100,
    life: 0.6,
    maxLife: 0.6,
    type: "emp_ring"
  });

  updateHUD();
}

export function triggerCoreOverdrive() {
  const ab = COMMANDER_ABILITIES.overdrive;
  if (gameOver || ab.cd > 0 || gold < ab.cost) {
    sfx.deny();
    return;
  }
  gold -= ab.cost;
  ab.cd = ab.cdMax;
  ab.activeTime = 7.0;
  sfx.powerup();
  playTone(600, 0.6, "triangle", 0.25);
  toast({ title: "CORE OVERDRIVE ACTIVE!", body: "+60% Fire Rate & Damage across all weapon systems!", icon: "fire" });
  updateHUD();
}

// Wave Spawning System
export function callEarlyWave() {
  if (gameOver) return;
  if (creepsToSpawn.length > 0 || creeps.length > 0) {
    toast({ title: "COMBAT IN PROGRESS", body: "Clear the current invading wave before calling next wave!" });
    return;
  }
  if (waveTimer <= 0) return; // already called; the wave launches next frame
  // Early call bonus: +20% gold reward
  const bonus = Math.round(15 + currentWave * 6);
  gold += bonus;
  playCoin();
  toast({ title: "EARLY WAVE CALLED!", body: `+${bonus} Bonus Gold for swift readiness!`, icon: "trophy" });
  waveTimer = 0;
  updateHUD();
}

function startWave() {
  currentWave++;
  waveInProgress = true;
  sfx.warn();
  toast({ title: `INCOMING WAVE ${currentWave}!`, body: "Hostile infantry and armored units approaching perimeter!", icon: "swords" });

  creepsToSpawn = [];
  const waveCount = 8 + currentWave * 4;

  for (let i = 0; i < waveCount; i++) {
    let type = "grunt";
    const roll = Math.random();

    if (currentWave >= 2 && roll < 0.25) type = "runner";
    else if (currentWave >= 4 && roll < 0.45) type = "tank";
    else if (currentWave >= 6 && roll < 0.65) type = "flyer";
    else if (currentWave >= 7 && roll < 0.78) type = "medic";

    // Boss on wave 5, 10, 15, 20
    if (currentWave % 5 === 0 && i === 0) {
      type = "boss";
    }

    creepsToSpawn.push(type);
  }

  spawnInterval = 0.85;
}

export function spawnCreep(type, at = null) {
  const spec = ENEMY_SPECS[type];
  const hpMult = 1.0 + (Math.max(1, currentWave) - 1) * 0.18;
  let path = null;
  if (!spec.isFlyer) {
    const fromHere = at ? pathFrom(creepTile(at).x, creepTile(at).y) : null;
    path = fromHere || [...(currentMasterPath || [])];
  }

  const creep = {
    x: at ? at.x : (SPAWN_TILE.x + 0.5) * TILE_W,
    y: at ? at.y : (SPAWN_TILE.y + 0.5) * TILE_H,
    vx: 1,
    vy: 0,
    type,
    hp: Math.round(spec.hp * hpMult),
    maxHp: Math.round(spec.hp * hpMult),
    speed: spec.speed,
    baseSpeed: spec.speed,
    armor: spec.armor || 0,
    reward: spec.reward,
    color: spec.color,
    heals: !!spec.heals,
    isFlyer: spec.isFlyer,
    isBoss: !!spec.isBoss,
    scale: spec.scale,
    walkTimer: Math.random() * 10,
    pathIndex: 0,
    pathProgress: 0,
    acidStacks: 0,
    acidTimer: 0,
    freezeTime: 0,
    stunTime: 0,
    healCd: 0,
    dead: false,
    path
  };

  creeps.push(creep);
}

// Target Selector matching test specifications
export function getTowerTarget(tower) {
  const spec = TOWER_SPECS[tower.type];
  const tx = (tower.x + 0.5) * TILE_W;
  const ty = (tower.y + 0.5) * TILE_H;

  const inRange = creeps.filter((c) => {
    return !c.dead && dist(tx, ty, c.x, c.y) <= spec.range;
  });


  if (inRange.length === 0) return null;

  const prio = tower.priority || "FIRST";

  if (prio === "FIRST") {
    return inRange.reduce((prev, curr) => (curr.pathProgress > prev.pathProgress ? curr : prev));
  } else if (prio === "LAST") {
    return inRange.reduce((prev, curr) => (curr.pathProgress < prev.pathProgress ? curr : prev));
  } else if (prio === "STRONGEST") {
    return inRange.reduce((prev, curr) => (curr.hp > prev.hp ? curr : prev));
  } else if (prio === "WEAKEST") {
    return inRange.reduce((prev, curr) => (curr.hp < prev.hp ? curr : prev));
  } else if (prio === "CLOSEST") {
    return inRange.reduce((prev, curr) => {
      const dCurr = dist(tx, ty, curr.x, curr.y);
      const dPrev = dist(tx, ty, prev.x, prev.y);
      return dCurr < dPrev ? curr : prev;
    });
  }

  return inRange[0];
}

// Tower Weapon Fire Action
function fireTower(t, target) {
  const spec = TOWER_SPECS[t.type];
  const tx = (t.x + 0.5) * TILE_W;
  const ty = (t.y + 0.5) * TILE_H;
  const isOverdrive = COMMANDER_ABILITIES.overdrive.activeTime > 0;
  const dmgMult = (1 + (t.level - 1) * 0.65) * (isOverdrive ? 1.6 : 1.0);
  const dmg = Math.round(spec.dmg * dmgMult);

  t.recoil = 1.0;
  // Muzzle flash at the barrel tip
  if (t.type === "gatling" || t.type === "cannon" || t.type === "sniper" || t.type === "missile") {
    const mx = tx + Math.cos(t.turretAngle) * 17;
    const my = ty + Math.sin(t.turretAngle) * 17;
    fx.spawn({ x: mx, y: my, life: 0.08, size: t.type === "gatling" ? 10 : 18, color: spec.color, kind: "glow", alpha: 0.9 });
    if (t.type !== "gatling") fx.burst(mx, my, { count: 4, speed: 60, life: 0.5, size: 4, grow: 10, color: "#6b6b6b", kind: "smoke", angle: t.turretAngle, spread: 0.8 });
  }

  // 1. Vulkan Gatling
  if (t.type === "gatling") {
    projectiles.push({
      x: tx,
      y: ty,
      target,
      speed: 550,
      dmg,
      type: "bullet"
    });
    // Eject brass casing
    particles.push({
      x: tx,
      y: ty,
      vx: (Math.random() - 0.5) * 80 - Math.sin(t.turretAngle) * 60,
      vy: (Math.random() - 0.5) * 80 + Math.cos(t.turretAngle) * 60,
      life: 2.2,
      maxLife: 2.2,
      type: "casing"
    });
    playLaser();
  }

  // 2. Thermal Laser
  else if (t.type === "laser") {
    projectiles.push({
      x1: tx,
      y1: ty,
      x2: target.x,
      y2: target.y,
      life: 0.08,
      type: "beam"
    });
    // Spark particles at target
    for (let p = 0; p < 2; p++) {
      particles.push({
        x: target.x,
        y: target.y,
        vx: (Math.random() - 0.5) * 70,
        vy: (Math.random() - 0.5) * 70,
        life: 0.3,
        maxLife: 0.3,
        color: "#00f0ff",
        type: "spark"
      });
    }
    damageCreep(target, dmg, "energy");
  }

  // 3. Siege Mortar
  else if (t.type === "cannon") {
    projectiles.push({
      startX: tx,
      startY: ty,
      x: tx,
      y: ty,
      targetX: target.x,
      targetY: target.y,
      life: 0.65,
      maxLife: 0.65,
      dmg,
      splash: spec.splash + t.level * 10,
      type: "mortar"
    });
    playCannon();
  }

  // 4. Tesla Coil
  else if (t.type === "tesla") {
    // Arcs hop to the nearest un-struck invader, `chains` strikes in total.
    const chainTargets = [target];
    let from = { x: tx, y: ty };
    let curr = target;

    for (let hop = 0; hop < spec.chains && curr; hop++) {
      projectiles.push({ x1: from.x, y1: from.y, x2: curr.x, y2: curr.y, life: 0.16, maxLife: 0.16, type: "lightning" });
      from = { x: curr.x, y: curr.y };
      damageCreep(curr, dmg);

      let next = null;
      let best = 110;
      for (const c of creeps) {
        if (c.dead || chainTargets.includes(c)) continue;
        const d = dist(from.x, from.y, c.x, c.y);
        if (d < best) {
          best = d;
          next = c;
        }
      }
      if (next) chainTargets.push(next);
      curr = next;
    }

    playTone(320, 0.2, "sawtooth", 0.08);
  }

  // 5. Cryo Blaster
  else if (t.type === "cryo") {
    for (const c of [...creeps]) {
      if (dist(tx, ty, c.x, c.y) <= spec.range) {
        c.freezeTime = 2.8 + t.level * 0.4;
        damageCreep(c, dmg);
      }
    }

    projectiles.push({
      x: tx,
      y: ty,
      radius: spec.range,
      life: 0.28,
      maxLife: 0.28,
      type: "frost_pulse"
    });

    playTone(210, 0.18, "sine", 0.06);
  }

  // 6. Mag-Rail Sniper
  else if (t.type === "sniper") {
    // Penetrates all creeps in a straight line through target across entire canvas
    const angle = Math.atan2(target.y - ty, target.x - tx);
    const endX = tx + Math.cos(angle) * 1200;
    const endY = ty + Math.sin(angle) * 1200;

    for (const c of [...creeps]) {
      // Distance from creep to ray
      const dRay = distToSegment({ x: c.x, y: c.y }, { x: tx, y: ty }, { x: endX, y: endY });
      if (dRay < 18) {
        floatingTexts.push({ x: c.x, y: c.y - 10, text: `-${dmg} RAIL!`, color: "#ff3344", life: 0.9 });
        damageCreep(c, dmg);
      }
    }

    projectiles.push({
      x1: tx,
      y1: ty,
      x2: endX,
      y2: endY,
      life: 0.24,
      maxLife: 0.24,
      type: "rail"
    });

    playExplosion({ duration: 0.45, lowpass: 380 });
  }

  // 7. Swarm Rockets
  else if (t.type === "missile") {
    for (let s = 0; s < spec.salvo; s++) {
      schedule(s * 0.11, () => {
        if (!towers.includes(t)) return; // recycled mid-salvo
        projectiles.push({
          x: tx + (Math.random() - 0.5) * 14,
          y: ty + (Math.random() - 0.5) * 14,
          target: target.dead ? null : target,
          speed: 340,
          angle: t.turretAngle + (Math.random() - 0.5) * 0.8,
          turnRate: 4.8,
          dmg,
          life: 2.5,
          type: "rocket"
        });
        playLaser();
      });
    }
  }

  // 8. Acid Spitter
  else if (t.type === "acid") {
    projectiles.push({
      startX: tx,
      startY: ty,
      x: tx,
      y: ty,
      targetX: target.x,
      targetY: target.y,
      life: 0.5,
      maxLife: 0.5,
      dmg,
      type: "acid_blob"
    });
    playTone(160, 0.2, "sawtooth", 0.07);
  }

  // 9. Sonic Disruptor
  else if (t.type === "sonic") {
    for (const c of [...creeps]) {
      if (dist(tx, ty, c.x, c.y) <= spec.range) {
        knockBack(c, spec.knockback);
        damageCreep(c, dmg);
      }
    }

    projectiles.push({
      x: tx,
      y: ty,
      radius: 10,
      maxRadius: spec.range,
      life: 0.35,
      maxLife: 0.35,
      type: "sonic_wave"
    });

    playTone(90, 0.3, "triangle", 0.12);
  }
}

// Distance from point to line segment
function distToSegment(p, v, w) {
  const l2 = (v.x - w.x) * (v.x - w.x) + (v.y - w.y) * (v.y - w.y);
  if (l2 === 0) return dist(p.x, p.y, v.x, v.y);
  let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  return dist(p.x, p.y, v.x + t * (w.x - v.x), v.y + t * (w.y - v.y));
}

// Push an invader back the way it came. Ground troops slide back along their own path segment
// (never through towers); flyers drift straight back along their heading.
function knockBack(c, amount) {
  c.pathProgress = Math.max(0, c.pathProgress - amount);
  c.stunTime = Math.max(c.stunTime, 0.12); // brief stagger
  if (c.isFlyer) {
    c.x = clamp(c.x - c.vx * amount, 4, canvas.width - 4);
    c.y = clamp(c.y - c.vy * amount, 4, ROWS * TILE_H - 4);
    return;
  }
  const prev = c.path && c.pathIndex > 0 ? c.path[c.pathIndex - 1] : null;
  if (!prev) return;
  const px = (prev.x + 0.5) * TILE_W;
  const py = (prev.y + 0.5) * TILE_H;
  const d = dist(c.x, c.y, px, py);
  if (d <= amount) {
    c.x = px;
    c.y = py;
  } else {
    c.x += ((px - c.x) / d) * amount;
    c.y += ((py - c.y) / d) * amount;
  }
}

// Every source of damage goes through here: armor, cryo brittleness, acid corrosion, one payout per kill.
//   kind "physical": full armor applies; "energy": half armor; "true": ignores armor.
function damageCreep(c, amount, kind = "true") {
  if (!c || c.dead) return 0;
  let mult = c.freezeTime > 0 ? 1.3 : 1.0; // frozen = brittle
  const armor = Math.max(0, (c.armor || 0) - (c.acidStacks || 0) * 0.1); // acid melts armor
  if (kind === "physical") mult *= Math.max(0.1, 1 - armor);
  else if (kind === "energy") mult *= Math.max(0.2, 1 - armor * 0.5);
  const dealt = amount * mult;
  c.hp -= dealt;
  if (c.hp <= 0) killCreep(c);
  return dealt;
}

function explosionFx(x, y, big = false) {
  fx.burst(x, y, { count: big ? 26 : 14, speed: big ? 220 : 150, life: 0.5, size: 3, color: "#ffd166", color2: "#ff5a1f", kind: "pixel", gravity: 120, drag: 0.9 });
  fx.burst(x, y, { count: big ? 8 : 4, speed: 40, life: 0.9, size: 6, grow: 18, color: "#3a3430", kind: "smoke", gravity: -30 });
  fx.spawn({ x, y, life: 0.25, size: big ? 60 : 36, color: "#ff8a3d", kind: "glow", alpha: 0.8 });
}

function killCreep(c) {
  if (c.dead) return;
  c.dead = true;
  fx.burst(c.x, c.y, { count: c.isBoss ? 40 : 12, speed: c.isBoss ? 220 : 140, life: 0.6, size: 3, color: c.color || "#8a97b1", color2: "#1e293b", kind: "shard", vr: 10, gravity: 260, drag: 0.92 });
  fx.burst(c.x, c.y, { count: 6, speed: 180, life: 0.3, size: 2, color: "#7df9ff", kind: "spark" });
  const idx = creeps.indexOf(c);
  if (idx !== -1) creeps.splice(idx, 1);

  gold += c.reward;
  playCoin();

  // Floating text
  floatingTexts.push({
    x: c.x,
    y: c.y - 12,
    text: `+${c.reward}G`,
    color: "#ffd700",
    life: 0.8
  });

  // Boss splits into mini runners
  if (c.isBoss) {
    screenShake = 12;
    playExplosion({ duration: 1.4, lowpass: 160 });
    toast({ title: "GOLIATH HAS FALLEN!", body: `+${c.reward} Gold! Mini cyber-runners emerging!`, icon: "trophy" });
    for (let i = 0; i < 4; i++) {
      spawnCreep("runner", { x: c.x + (Math.random() - 0.5) * 16, y: c.y + (Math.random() - 0.5) * 16 });
    }
  }
}

// Main Game Update
function update(rawDt) {
  if (gameOver) return;

  if (screenShake > 0) {
    screenShake = Math.max(0, screenShake - rawDt * 24);
  }

  // Update Commander Cooldowns
  for (const k in COMMANDER_ABILITIES) {
    const ab = COMMANDER_ABILITIES[k];
    if (ab.cd > 0) ab.cd = Math.max(0, ab.cd - rawDt);
    if (ab.activeTime > 0) ab.activeTime = Math.max(0, ab.activeTime - rawDt);
  }

  // Game speed runs extra full simulation steps rather than one giant step, so fast bullets and
  // homing rockets can't tunnel past their targets at 2X / 3X.
  const step = Math.min(rawDt, 1 / 30);
  for (let s = 0; s < gameSpeed && !gameOver; s++) simulate(step);
  fx.update(Math.min(rawDt, 0.05) * gameSpeed);

  updateHUD();
}

function simulate(dt) {
  // Delayed events (missile salvos, barrage strikes)
  for (let i = scheduled.length - 1; i >= 0; i--) {
    const ev = scheduled[i];
    ev.t -= dt;
    if (ev.t <= 0) {
      scheduled.splice(i, 1);
      ev.fn();
    }
  }

  // Wave Timer & Spawn Queue
  if (creepsToSpawn.length > 0) {
    spawnInterval -= dt;
    if (spawnInterval <= 0) {
      spawnInterval = 0.7;
      const type = creepsToSpawn.shift();
      spawnCreep(type);
    }
  } else if (creeps.length === 0) {
    if (waveInProgress) {
      waveInProgress = false;
      waveTimer = 10;
      toast({ title: `WAVE ${currentWave} CLEARED!`, body: "Perimeter secured. Prepare for the next assault!", icon: "check" });
    } else {
      waveTimer -= dt;
      if (waveTimer <= 0) {
        startWave();
      }
    }
  }

  // Update Decals (Blast craters, acid pools)
  for (let i = decals.length - 1; i >= 0; i--) {
    const d = decals[i];
    d.life -= dt;
    if (d.type === "acid_pool") {
      // Damage creeps wading through acid (flyers pass over it); stacks build over ~1.5s
      for (const c of [...creeps]) {
        if (!c.isFlyer && dist(d.x, d.y, c.x, c.y) < d.r) {
          c.acidStacks = Math.min(3, c.acidStacks + dt * 2);
          c.acidTimer = 3.0;
          damageCreep(c, 14 * dt);
        }
      }
    }
    if (d.life <= 0) decals.splice(i, 1);
  }
  // Keep the floor readable: only the newest craters linger
  let craters = 0;
  for (let i = decals.length - 1; i >= 0; i--) {
    if (decals[i].type === "crater" && ++craters > 40) decals.splice(i, 1);
  }

  // Update Creeps
  for (let i = creeps.length - 1; i >= 0; i--) {
    const c = creeps[i];

    // Status effect timers
    if (c.stunTime > 0) {
      c.stunTime -= dt;
      continue; // Paralyzed
    }

    if (c.freezeTime > 0) c.freezeTime -= dt;
    if (c.acidTimer > 0) {
      c.acidTimer -= dt;
      damageCreep(c, c.acidStacks * 6 * dt);
      if (c.dead) continue;
    } else {
      c.acidStacks = 0;
    }

    const currentSpeed = c.speed * (c.freezeTime > 0 ? 0.45 : 1.0);
    c.walkTimer += dt * (currentSpeed / 35);
    c.pathProgress += currentSpeed * dt;

    // Movement: Flyers fly straight to exit, Ground troops follow A* path
    let targetX = (EXIT_TILE.x + 0.5) * TILE_W;
    let targetY = (EXIT_TILE.y + 0.5) * TILE_H;

    if (!c.isFlyer && c.path && c.path.length > 0) {
      const node = c.path[c.pathIndex];
      if (node) {
        targetX = (node.x + 0.5) * TILE_W;
        targetY = (node.y + 0.5) * TILE_H;

        if (dist(c.x, c.y, targetX, targetY) < 6) {
          c.pathIndex++;
        }
      }
    }

    const ang = Math.atan2(targetY - c.y, targetX - c.x);
    c.vx = Math.cos(ang);
    c.vy = Math.sin(ang);
    c.x += c.vx * currentSpeed * dt;
    c.y += c.vy * currentSpeed * dt;

    // Medic heal pulse
    if (c.heals) {
      c.healCd = (c.healCd || 0) - dt;
      if (c.healCd <= 0) {
        c.healCd = 1.4;
        creeps.forEach((other) => {
          if (other !== c && dist(c.x, c.y, other.x, other.y) < 90) {
            other.hp = Math.min(other.maxHp, other.hp + 25);
            particles.push({ x: other.x, y: other.y, vx: 0, vy: -20, life: 0.6, maxLife: 0.6, color: "#00ff66", type: "heal" });
          }
        });
      }
    }

    // Check Breach into The Last Tower Core!
    if (dist(c.x, c.y, (EXIT_TILE.x + 0.5) * TILE_W, (EXIT_TILE.y + 0.5) * TILE_H) < 22) {
      lives = Math.max(0, lives - (c.isBoss ? 5 : 1));
      screenShake = 10;
      playHit({ isCritical: true });
      toast({
        title: "CORE BREACHED!",
        body: c.isBoss ? `The Goliath smashed the core! ${lives} shields left` : `An invader reached the core! ${lives} shields left`,
        icon: "skull"
      });
      c.dead = true;
      creeps.splice(i, 1);

      if (lives <= 0) {
        handleGameOver();
        return;
      }
    }
  }

  // Update Towers
  const isOverdrive = COMMANDER_ABILITIES.overdrive.activeTime > 0;
  towers.forEach((t) => {
    const spec = TOWER_SPECS[t.type];
    const rate = spec.rate / (isOverdrive ? 1.6 : 1.0);
    t.cooldown -= dt;
    if (t.recoil > 0) t.recoil = Math.max(0, t.recoil - dt * 5.0);

    const target = getTowerTarget(t);
    t.target = target;

    if (target) {
      const tx = (t.x + 0.5) * TILE_W;
      const ty = (t.y + 0.5) * TILE_H;
      const targetAngle = Math.atan2(target.y - ty, target.x - tx);
      // Smooth turret rotation
      let diff = targetAngle - t.turretAngle;
      while (diff < -Math.PI) diff += Math.PI * 2;
      while (diff > Math.PI) diff -= Math.PI * 2;
      t.turretAngle += clamp(diff, -12 * dt, 12 * dt);

      if (t.cooldown <= 0) {
        t.cooldown = rate;
        fireTower(t, target);
      }
    }
  });

  // Update Projectiles
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const p = projectiles[i];

    if (p.type === "bullet") {
      if (!p.target || p.target.dead) {
        projectiles.splice(i, 1); // target already gone
        continue;
      }
      const d = dist(p.x, p.y, p.target.x, p.target.y);
      const stepLen = p.speed * dt;
      if (d <= Math.max(14, stepLen)) {
        damageCreep(p.target, p.dmg, "physical");
        projectiles.splice(i, 1);
      } else {
        p.x += ((p.target.x - p.x) / d) * stepLen;
        p.y += ((p.target.y - p.y) / d) * stepLen;
      }
    } else if (p.type === "rocket") {
      p.life -= dt;
      if (!p.target || p.target.dead) {
        // Re-acquire the nearest invader
        let best = null;
        let bestD = Infinity;
        for (const c of creeps) {
          const d = dist(p.x, p.y, c.x, c.y);
          if (d < bestD) {
            bestD = d;
            best = c;
          }
        }
        p.target = best;
      }
      if (p.target) {
        const targetAng = Math.atan2(p.target.y - p.y, p.target.x - p.x);
        let diff = targetAng - p.angle;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;
        p.angle += clamp(diff, -p.turnRate * dt, p.turnRate * dt);
      }
      p.x += Math.cos(p.angle) * p.speed * dt;
      p.y += Math.sin(p.angle) * p.speed * dt;

      // Rocket smoke trail
      particles.push({
        x: p.x - Math.cos(p.angle) * 8,
        y: p.y - Math.sin(p.angle) * 8,
        vx: (Math.random() - 0.5) * 15,
        vy: (Math.random() - 0.5) * 15,
        life: 0.35,
        maxLife: 0.35,
        color: "rgba(255,200,50,0.6)",
        type: "smoke"
      });

      if (p.target && dist(p.x, p.y, p.target.x, p.target.y) < Math.max(16, p.speed * dt)) {
        playExplosion({ duration: 0.4, lowpass: 320 });
        explosionFx(p.x, p.y, false);
        for (const c of [...creeps]) {
          if (dist(p.x, p.y, c.x, c.y) < 36) damageCreep(c, p.dmg);
        }
        projectiles.splice(i, 1);
      } else if (p.life <= 0) {
        projectiles.splice(i, 1);
      }
    } else if (p.type === "mortar") {
      p.life -= dt;
      const progress = 1.0 - (p.life / p.maxLife);
      p.x = lerp(p.startX, p.targetX, progress);
      p.y = lerp(p.startY, p.targetY, progress);

      if (p.life <= 0) {
        playExplosion({ duration: 0.65, lowpass: 220 });
        explosionFx(p.targetX, p.targetY, true);
        screenShake = 6;
        decals.push({ x: p.targetX, y: p.targetY, r: 20, alpha: 0.7, life: 8, maxLife: 8, type: "crater" });
        for (const c of [...creeps]) {
          if (dist(p.targetX, p.targetY, c.x, c.y) <= p.splash) damageCreep(c, p.dmg);
        }
        projectiles.splice(i, 1);
      }
    } else if (p.type === "acid_blob") {
      p.life -= dt;
      const progress = 1.0 - (p.life / p.maxLife);
      p.x = lerp(p.startX, p.targetX, progress);
      p.y = lerp(p.startY, p.targetY, progress);

      if (p.life <= 0) {
        // Splash on impact, then a lingering acid puddle
        for (const c of [...creeps]) {
          if (!c.isFlyer && dist(p.targetX, p.targetY, c.x, c.y) < 28) damageCreep(c, p.dmg);
        }
        decals.push({ x: p.targetX, y: p.targetY, r: 28, life: 5.0, maxLife: 5.0, type: "acid_pool" });
        projectiles.splice(i, 1);
      }
    } else {
      p.life -= dt;
      const k = p.maxLife ? 1 - Math.max(0, p.life) / p.maxLife : 1;
      if (p.type === "emp_ring" || p.type === "sonic_wave") p.radius = lerp(10, p.maxRadius, k);
      if (p.life <= 0) projectiles.splice(i, 1);
    }
  }

  // Update Particles
  for (let i = particles.length - 1; i >= 0; i--) {
    const pt = particles[i];
    pt.life -= dt;
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    if (pt.type === "casing") {
      pt.vx *= 0.92;
      pt.vy *= 0.92;
    }
    if (pt.life <= 0) particles.splice(i, 1);
  }

  // Update Floating Texts
  for (let i = floatingTexts.length - 1; i >= 0; i--) {
    const ft = floatingTexts[i];
    ft.life -= dt;
    ft.y -= 18 * dt;
    if (ft.life <= 0) floatingTexts.splice(i, 1);
  }
  if (floatingTexts.length > 80) floatingTexts.splice(0, floatingTexts.length - 80);
}


// Render Engine
// Cached battlefield layers + effects
const fieldTex = buildField(canvas.width, canvas.height, COLS, ROWS, TILE_W, TILE_H);
let roadTex = null;
let roadVersion = -1;
const fx = createParticles(700);

function render() {
  const time = performance.now() / 1000;
  if (roadVersion !== gridVersion || !roadTex) {
    roadTex = buildRoad(canvas.width, canvas.height, currentMasterPath, TILE_W, TILE_H);
    roadVersion = gridVersion;
  }
  ctx.save();

  // Screen shake
  if (screenShake > 0) {
    const ox = (Math.random() - 0.5) * screenShake;
    const oy = (Math.random() - 0.5) * screenShake;
    ctx.translate(ox, oy);
  }

  // 1. Textured wasteland + the dirt road the invaders march along
  ctx.drawImage(fieldTex, 0, 0);
  ctx.drawImage(roadTex, 0, 0);

  // 2. Render Decals (Blast Craters & Acid Puddles)
  decals.forEach((d) => {
    if (d.type === "crater") {
      const fade = d.maxLife ? clamp(d.life / 2, 0, 1) : 1; // fade out over the last 2s
      ctx.fillStyle = `rgba(10, 5, 2, ${(d.alpha || 0.6) * fade})`;
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = `rgba(255, 120, 0, ${0.3 * fade})`;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    } else if (d.type === "acid_pool") {
      const alpha = Math.min(0.7, d.life / d.maxLife);
      ctx.fillStyle = `rgba(118, 255, 3, ${alpha * 0.5})`;
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = `rgba(118, 255, 3, ${alpha})`;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  });

  // 3. Spawn portal & the Last Tower citadel
  drawPortal(ctx, (SPAWN_TILE.x + 0.5) * TILE_W, (SPAWN_TILE.y + 0.5) * TILE_H, time);
  drawCitadel(ctx, (EXIT_TILE.x + 0.5) * TILE_W, (EXIT_TILE.y + 0.5) * TILE_H, time, lives, maxLives);

  // 4. Marching route markers show which way the invaders will walk
  if (currentMasterPath && currentMasterPath.length > 1) {
    ctx.strokeStyle = "rgba(255, 200, 80, 0.28)";
    ctx.lineWidth = 2;
    ctx.setLineDash([3, 9]);
    ctx.lineDashOffset = -time * 24;
    ctx.beginPath();
    currentMasterPath.forEach((node, idx) => {
      const nx = (node.x + 0.5) * TILE_W;
      const ny = (node.y + 0.5) * TILE_H;
      if (idx === 0) ctx.moveTo(nx, ny);
      else ctx.lineTo(nx, ny);
    });
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.lineDashOffset = 0;
  }

  // 5. Render Ejected Shell Casings on Floor
  particles.forEach((pt) => {
    if (pt.type === "casing") {
      ctx.fillStyle = "#ffd700";
      ctx.fillRect(pt.x - 1.5, pt.y - 1, 3, 2);
    }
  });

  // 6. Draw Detailed Weapon Platforms
  towers.forEach((t) => drawDetailedTower(t));

  // 6b. Placement preview under the cursor
  drawPlacementPreview();

  // 7. Draw Creeps (Detailed Humanoid Invaders)
  creeps.forEach((c) => drawHumanoidCreep(c));

  // 8. Draw Projectiles & Lasers
  drawProjectiles();

  // 9. Draw Combat Sparks & Particle FX
  particles.forEach((pt) => {
    if (pt.type === "spark") {
      ctx.fillStyle = pt.color || "#00f0ff";
      ctx.fillRect(pt.x - 1, pt.y - 1, 2, 2);
    } else if (pt.type === "smoke") {
      ctx.fillStyle = pt.color || "rgba(200,200,200,0.4)";
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 3, 0, Math.PI * 2);
      ctx.fill();
    } else if (pt.type === "heal") {
      ctx.fillStyle = "#00ff66";
      ctx.font = '8px "Press Start 2P", monospace';
      ctx.fillText("+", pt.x, pt.y);
    }
  });

  fx.draw(ctx);

  // 10. Draw Floating Combat Text (hard drop shadow)
  ctx.font = '9px "Press Start 2P", monospace';
  ctx.textAlign = "center";
  floatingTexts.forEach((ft) => {
    ctx.globalAlpha = clamp(ft.life / 0.3, 0, 1);
    ctx.fillStyle = "#000000";
    ctx.fillText(ft.text, ft.x + 1, ft.y + 1);
    ctx.fillStyle = ft.color || "#ffffff";
    ctx.fillText(ft.text, ft.x, ft.y);
  });
  ctx.globalAlpha = 1;
  ctx.textAlign = "left";

  ctx.restore();

  // Overdrive tint, low-shield warning, screen treatments
  if (COMMANDER_ABILITIES.overdrive.activeTime > 0) {
    ctx.fillStyle = `rgba(255, 120, 0, ${0.06 + Math.sin(time * 8) * 0.03})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  if (lives <= 5 && !gameOver) vignette(ctx, canvas.width, canvas.height, 0.3 + Math.sin(time * 5) * 0.1, "#8a0012");
  vignette(ctx, canvas.width, canvas.height, 0.45);
  scanlines(ctx, canvas.width, canvas.height, 0.05);
}

// Ghost of the selected tower on the hovered tile: green = buildable, red = blocked / can't afford.
function drawPlacementPreview() {
  if (!hoverTile || gameOver) return;
  const { x: gx, y: gy } = hoverTile;
  if (towers.some((t) => t.x === gx && t.y === gy)) return; // hovering a tower = inspect, no ghost

  const block = quickPlacementBlock(gx, gy);
  const key = `${gx},${gy},${gridVersion}`;
  if (!hoverCache || hoverCache.key !== key) {
    let pathOk = false;
    if (!block || block === "HOSTILE ON TILE") {
      const tempGrid = new Uint8Array(grid);
      tempGrid[gy * COLS + gx] = 1;
      pathOk = !!validatePath(tempGrid);
    }
    hoverCache = { key, pathOk };
  }

  const spec = TOWER_SPECS[selectedTowerType];
  const ok = hoverCache.pathOk && !block && gold >= spec.cost;
  const px = gx * TILE_W;
  const py = gy * TILE_H;
  const col = ok ? "0, 230, 118" : "255, 23, 68";

  ctx.save();
  ctx.fillStyle = `rgba(${col}, 0.18)`;
  ctx.fillRect(px + 1, py + 1, TILE_W - 2, TILE_H - 2);
  ctx.strokeStyle = `rgba(${col}, 0.9)`;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 3]);
  ctx.strokeRect(px + 1.5, py + 1.5, TILE_W - 3, TILE_H - 3);
  ctx.setLineDash([]);
  if (ok && spec.range < 1000) {
    ctx.strokeStyle = `rgba(${col}, 0.3)`;
    ctx.beginPath();
    ctx.arc(px + TILE_W / 2, py + TILE_H / 2, spec.range, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

// Procedural Humanoid Attacker Renderer
function drawHumanoidCreep(c) {
  ctx.save();
  ctx.translate(c.x, c.y);

  // Subtle breathing / walking scale
  const s = c.scale || 1.0;
  ctx.scale(s, s);

  // Walk cycle stride oscillation
  const legSwing = Math.sin(c.walkTimer * 8) * 5;
  const bobY = Math.abs(Math.sin(c.walkTimer * 8)) * 2;

  // 1. Shadow beneath boots
  ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
  ctx.beginPath();
  ctx.ellipse(0, 11, c.isBoss ? 18 : 8, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  // 2. Directional Body Orientation
  const isFacingLeft = c.vx < -0.1;
  ctx.scale(isFacingLeft ? -1 : 1, 1);

  // 3. Legs & Armored Boots
  ctx.fillStyle = "#1e293b";
  // Left Leg
  ctx.fillRect(-5, 4 + legSwing, 4, 7);
  // Right Leg
  ctx.fillRect(1, 4 - legSwing, 4, 7);
  // Boots
  ctx.fillStyle = "#0f172a";
  ctx.fillRect(-6, 10 + legSwing, 5, 3);
  ctx.fillRect(0, 10 - legSwing, 5, 3);

  // 4. Torso & Tactical Armor Vest
  ctx.fillStyle = c.color;
  ctx.fillRect(-6, -6 - bobY, 12, 11);

  // Vest straps & pouches
  ctx.fillStyle = "#111827";
  ctx.fillRect(-4, -4 - bobY, 8, 3);
  ctx.fillRect(-5, 0 - bobY, 3, 3);
  ctx.fillRect(2, 0 - bobY, 3, 3);

  // 5. Head & Combat Helmet
  ctx.fillStyle = "#fbcfe8"; // Neck/face
  ctx.fillRect(-3, -11 - bobY, 6, 5);

  ctx.fillStyle = c.isBoss ? "#991b1b" : "#334155";
  // Helmet dome
  ctx.fillRect(-5, -15 - bobY, 10, 6);

  // Glowing Visor / Night Vision Optics
  ctx.fillStyle = c.type === "runner" ? "#ffea00" : (c.type === "tank" ? "#00f0ff" : "#ff3344");
  ctx.fillRect(0, -12 - bobY, 5, 2);

  // 6. Archetype Specific Gear & Held Weapons
  if (c.type === "grunt") {
    // Combat Assault Rifle
    ctx.fillStyle = "#09090b";
    ctx.fillRect(2, -2 - bobY, 10, 3); // Gun barrel
    ctx.fillRect(2, 1 - bobY, 3, 4);   // Magazine
  } else if (c.type === "runner") {
    // Twin Cyber Energy Blades
    ctx.strokeStyle = "#ffea00";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(3, 0 - bobY);
    ctx.lineTo(12, -4 - bobY);
    ctx.moveTo(3, 3 - bobY);
    ctx.lineTo(10, 8 - bobY);
    ctx.stroke();
  } else if (c.type === "tank") {
    // Heavy Ballistic Riot Shield
    ctx.fillStyle = "#334155";
    ctx.strokeStyle = "#00f0ff";
    ctx.lineWidth = 1.5;
    ctx.fillRect(6, -9 - bobY, 5, 18);
    ctx.strokeRect(6, -9 - bobY, 5, 18);
    // Viewport slit
    ctx.fillStyle = "#00f0ff";
    ctx.fillRect(7, -5 - bobY, 3, 2);
  } else if (c.type === "flyer") {
    // Dual Jetpack Thrusters with Flame Plumes
    ctx.fillStyle = "#020617";
    ctx.fillRect(-10, -8 - bobY, 4, 10);
    // Thruster flame pulses
    ctx.fillStyle = Math.random() < 0.5 ? "#ff5722" : "#ffeb3b";
    ctx.beginPath();
    ctx.moveTo(-10, 2 - bobY);
    ctx.lineTo(-6, 2 - bobY);
    ctx.lineTo(-8, 8 + Math.random() * 4 - bobY);
    ctx.closePath();
    ctx.fill();
  } else if (c.type === "medic") {
    // Medical Cross Staff & Backpack
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(-9, -7 - bobY, 4, 8); // Backpack
    ctx.fillStyle = "#00e676";
    ctx.fillRect(-8, -5 - bobY, 2, 4); // Cross
    ctx.fillRect(-9, -4 - bobY, 4, 2);
    // Staff in hand
    ctx.strokeStyle = "#00e676";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(4, 4 - bobY);
    ctx.lineTo(6, -10 - bobY);
    ctx.stroke();
  } else if (c.isBoss) {
    // Goliath Cyber-Titan: Shoulder Missile Pods & Arm Rotary Cannons
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(-12, -18 - bobY, 8, 8); // Left pod
    ctx.fillRect(4, -18 - bobY, 8, 8);  // Right pod
    ctx.fillStyle = "#ff1744";
    ctx.fillRect(-10, -16 - bobY, 2, 2);
    ctx.fillRect(6, -16 - bobY, 2, 2);
    // Dual minigun arms
    ctx.fillStyle = "#09090b";
    ctx.fillRect(8, -4 - bobY, 14, 5);
  }

  // 7. Status Effects (Freeze, Acid, Stun)
  if (c.freezeTime > 0) {
    ctx.strokeStyle = "rgba(0, 240, 255, 0.85)";
    ctx.lineWidth = 2;
    ctx.strokeRect(-8, -16 - bobY, 16, 26);
    ctx.fillStyle = "rgba(0, 240, 255, 0.25)";
    ctx.fillRect(-8, -16 - bobY, 16, 26);
  }
  if (c.acidStacks > 0) {
    ctx.fillStyle = "#76ff03";
    for (let d = 0; d < c.acidStacks * 2; d++) {
      ctx.fillRect((Math.random() - 0.5) * 12, (Math.random() - 0.5) * 16 - bobY, 2, 2);
    }
  }
  if (c.stunTime > 0) {
    ctx.strokeStyle = "#ffea00";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, -18 - bobY, 6, 0, Math.PI * 2);
    ctx.stroke();
  }

  // 8. Health Bar & Name
  const hpRatio = Math.max(0, c.hp / c.maxHp);
  const barW = c.isBoss ? 32 : 18;
  ctx.fillStyle = "rgba(0,0,0,0.75)";
  ctx.fillRect(-barW / 2, -22 - bobY, barW, 3);
  ctx.fillStyle = hpRatio < 0.3 ? "#ff1744" : "#00e676";
  ctx.fillRect(-barW / 2, -22 - bobY, barW * hpRatio, 3);

  ctx.restore();
}

// Detailed Weapon Platform Renderer
function drawDetailedTower(t) {
  const spec = TOWER_SPECS[t.type];
  const tx = t.x * TILE_W;
  const ty = t.y * TILE_H;
  const cx = tx + TILE_W / 2;
  const cy = ty + TILE_H / 2;

  ctx.save();

  // 1. Concrete emplacement pad
  drawPad(ctx, tx, ty, TILE_W, TILE_H, spec.color, t === inspectingTower);
  // Turret drop shadow
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.beginPath();
  ctx.ellipse(cx + 3, cy + 4, 10 + t.level, 7 + t.level, 0, 0, Math.PI * 2);
  ctx.fill();

  // Level Pips
  for (let l = 0; l < t.level; l++) {
    ctx.fillStyle = "#ffd700";
    ctx.fillRect(tx + 4 + l * 5, ty + TILE_H - 6, 3, 3);
  }

  // 2. Rotating Turret Head Assembly
  ctx.translate(cx, cy);
  ctx.rotate(t.turretAngle || 0);

  // Recoil Kickback
  const recoilOffset = (t.recoil || 0) * -4;
  ctx.translate(recoilOffset, 0);

  // Turret Housing
  ctx.fillStyle = "#1e293b";
  ctx.beginPath();
  ctx.arc(0, 0, 8 + t.level, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = spec.color;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Turret Weapon Barrels based on type
  if (t.type === "gatling") {
    // Twin barrels
    ctx.fillStyle = "#09090b";
    ctx.fillRect(6, -4, 10, 3);
    ctx.fillRect(6, 1, 10, 3);
    if (t.recoil > 0.4) {
      // Muzzle flash star
      ctx.fillStyle = "#ffea00";
      ctx.beginPath();
      ctx.arc(17, -1, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (t.type === "laser") {
    // Thermal laser crystal housing
    ctx.fillStyle = "#00f0ff";
    ctx.fillRect(6, -2, 8, 4);
    ctx.beginPath();
    ctx.arc(14, 0, 3, 0, Math.PI * 2);
    ctx.fill();
  } else if (t.type === "cannon") {
    // Heavy artillery barrel
    ctx.fillStyle = "#334155";
    ctx.fillRect(4, -5, 12, 10);
    ctx.fillStyle = "#000000";
    ctx.fillRect(14, -4, 3, 8);
  } else if (t.type === "tesla") {
    // Tesla coil copper spheres
    ctx.fillStyle = "#b366ff";
    ctx.beginPath();
    ctx.arc(4, 0, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.stroke();
  } else if (t.type === "cryo") {
    // 4-nozzle manifold
    ctx.fillStyle = "#00bfa5";
    ctx.fillRect(5, -6, 5, 3);
    ctx.fillRect(5, 3, 5, 3);
  } else if (t.type === "sniper") {
    // Superlong magnetic railgun
    ctx.fillStyle = "#09090b";
    ctx.fillRect(4, -2, 18, 4);
    ctx.fillStyle = "#ff3344";
    ctx.fillRect(8, -3, 2, 6);
    ctx.fillRect(14, -3, 2, 6);
  } else if (t.type === "missile") {
    // Multi-cell rocket pod
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(2, -6, 8, 12);
    ctx.fillStyle = "#ffea00";
    ctx.fillRect(9, -4, 3, 3);
    ctx.fillRect(9, 1, 3, 3);
  } else if (t.type === "acid") {
    // Sludge vat
    ctx.fillStyle = "#76ff03";
    ctx.beginPath();
    ctx.arc(2, 0, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(7, -2, 6, 4);
  } else if (t.type === "sonic") {
    // Sound dish
    ctx.strokeStyle = "#ff007f";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(4, 0, 7, -Math.PI / 2, Math.PI / 2);
    ctx.stroke();
  }

  ctx.restore();

  // Range preview on inspected tower (the rail sniper covers the whole map, so no ring)
  if (t === inspectingTower && spec.range < 1000) {
    ctx.strokeStyle = "rgba(0, 230, 118, 0.3)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, spec.range, 0, Math.PI * 2);
    ctx.stroke();
  }
}

// Draw Projectiles
function drawProjectiles() {
  projectiles.forEach((p) => {
    if (p.type === "bullet") {
      ctx.fillStyle = "#ffea00";
      ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
    } else if (p.type === "beam") {
      ctx.strokeStyle = "#00f0ff";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(p.x1, p.y1);
      ctx.lineTo(p.x2, p.y2);
      ctx.stroke();
    } else if (p.type === "lightning") {
      ctx.strokeStyle = "#b366ff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(p.x1, p.y1);
      // Zig-zag midpoint
      const midX = (p.x1 + p.x2) / 2 + (Math.random() - 0.5) * 16;
      const midY = (p.y1 + p.y2) / 2 + (Math.random() - 0.5) * 16;
      ctx.lineTo(midX, midY);
      ctx.lineTo(p.x2, p.y2);
      ctx.stroke();
    } else if (p.type === "mortar") {
      ctx.fillStyle = "#ff9900";
      ctx.beginPath();
      ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
      ctx.fill();
    } else if (p.type === "rocket") {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);
      ctx.fillStyle = "#ffea00";
      ctx.fillRect(-5, -2, 10, 4);
      ctx.restore();
    } else if (p.type === "frost_pulse") {
      const k = clamp(p.life / (p.maxLife || 0.28), 0, 1);
      ctx.strokeStyle = `rgba(0, 191, 165, ${0.7 * k})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius * (1 - k * 0.6), 0, Math.PI * 2);
      ctx.stroke();
    } else if (p.type === "rail") {
      ctx.strokeStyle = `rgba(255, 51, 68, ${clamp(p.life / (p.maxLife || 0.24), 0, 1)})`;
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(p.x1, p.y1);
      ctx.lineTo(p.x2, p.y2);
      ctx.stroke();
    } else if (p.type === "acid_blob") {
      ctx.fillStyle = "#76ff03";
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
      ctx.fill();
    } else if (p.type === "sonic_wave") {
      ctx.strokeStyle = `rgba(255, 0, 127, ${0.7 * clamp(p.life / (p.maxLife || 0.35), 0, 1)})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.stroke();
    } else if (p.type === "emp_ring") {
      ctx.strokeStyle = `rgba(0, 240, 255, ${0.75 * clamp(p.life / (p.maxLife || 0.6), 0, 1)})`;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.stroke();
    }
  });
}

function handleGameOver() {
  if (gameOver) return;
  gameOver = true;
  scheduled.length = 0;
  hoverTile = null;
  inspectingTower = null;
  updateInspectorUI();
  updateHUD();
  playExplosion({ duration: 1.6, lowpass: 120 });
  saveGameScore("last-tower", currentWave, `DEFENDED ${currentWave} WAVES // ${towers.length} TOWERS`);

  const modal = document.getElementById("lt-death-modal");
  if (modal) {
    modal.style.display = "flex";
    document.getElementById("lt-death-stats").innerHTML = `
      <span>FINAL WAVE REACHED: <b>${currentWave}</b></span>
      <span>WEAPON PLATFORMS: <b>${towers.length}</b></span>
      <span>CORE INTEGRITY: <b>0% (CRITICAL FAILURE)</b></span>
    `;
  }
}

function updateHUD() {
  const goldEl = document.getElementById("hud-gold");
  const livesEl = document.getElementById("hud-lives");
  const waveEl = document.getElementById("hud-wave");
  const timerEl = document.getElementById("hud-wave-timer");
  const speedBtn = document.getElementById("btn-speed-toggle");

  if (goldEl) goldEl.textContent = `${gold} G`;
  if (livesEl) {
    livesEl.textContent = `${lives} / ${maxLives}`;
    livesEl.style.color = lives <= 5 ? "#ff1744" : lives <= 10 ? "#ffd700" : "#00e676";
  }
  if (waveEl) waveEl.textContent = `WAVE ${currentWave}`;
  if (timerEl) {
    timerEl.textContent = gameOver
      ? "CORE LOST"
      : creepsToSpawn.length > 0 || creeps.length > 0
        ? `IN COMBAT · ${creeps.length + creepsToSpawn.length} LEFT`
        : `NEXT: ${Math.max(0, Math.ceil(waveTimer))}s`;
  }
  const btnWave = document.getElementById("btn-call-wave");
  if (btnWave) btnWave.disabled = gameOver || creepsToSpawn.length > 0 || creeps.length > 0;

  // Dim tower buttons the treasury can't pay for
  document.querySelectorAll(".tower-btn").forEach((b) => {
    const spec = TOWER_SPECS[b.dataset.tower];
    b.classList.toggle("is-poor", !!spec && gold < spec.cost);
  });

  // Keep the inspector's upgrade button / stats honest as gold and overdrive change
  if (inspectingTower) updateInspectorUI(false);
  if (speedBtn) speedBtn.textContent = `SPEED: ${gameSpeed}X [Z]`;

  // Update Commander buttons state & cooldowns
  const btnBarrage = document.getElementById("btn-cmd-barrage");
  const btnEmp = document.getElementById("btn-cmd-emp");
  const btnOverdrive = document.getElementById("btn-cmd-overdrive");

  if (btnBarrage) {
    const ab = COMMANDER_ABILITIES.barrage;
    btnBarrage.disabled = ab.cd > 0 || gold < ab.cost;
    btnBarrage.querySelector("span:first-child").textContent = ab.cd > 0 ? `[1] AIR (${Math.ceil(ab.cd)}s)` : "[1] AIR BARRAGE";
  }
  if (btnEmp) {
    const ab = COMMANDER_ABILITIES.emp;
    btnEmp.disabled = ab.cd > 0 || gold < ab.cost;
    btnEmp.querySelector("span:first-child").textContent = ab.cd > 0 ? `[2] EMP (${Math.ceil(ab.cd)}s)` : "[2] EMP SHOCK";
  }
  if (btnOverdrive) {
    const ab = COMMANDER_ABILITIES.overdrive;
    btnOverdrive.disabled = ab.cd > 0 || gold < ab.cost;
    btnOverdrive.querySelector("span:first-child").textContent = ab.activeTime > 0 ? `[3] BOOST (${Math.ceil(ab.activeTime)}s)` : (ab.cd > 0 ? `[3] BOOST (${Math.ceil(ab.cd)}s)` : "[3] OVERDRIVE");
  }
}

function updateInspectorUI(full = true) {
  const inspector = document.getElementById("lt-inspector");
  if (!inspector) return;

  if (!inspectingTower) {
    inspector.style.display = "none";
    return;
  }

  inspector.style.display = "flex";
  const spec = TOWER_SPECS[inspectingTower.type];
  const nameEl = document.getElementById("inspect-name");
  const statsEl = document.getElementById("inspect-stats");
  const prioritySel = document.getElementById("inspect-priority");
  const btnUpgrade = document.getElementById("btn-upgrade-tower");
  const btnSell = document.getElementById("btn-sell-tower");

  const isOverdrive = COMMANDER_ABILITIES.overdrive.activeTime > 0;
  const dmg = Math.round(spec.dmg * (1 + (inspectingTower.level - 1) * 0.65) * (isOverdrive ? 1.6 : 1.0));
  const rate = (spec.rate / (isOverdrive ? 1.6 : 1.0)).toFixed(2);
  const upCost = Math.round(inspectingTower.cost * (1 + inspectingTower.level * 0.8));
  const refund = Math.floor(inspectingTower.totalInvested * 0.7);

  if (nameEl) nameEl.textContent = `${spec.name.toUpperCase()} [LVL ${inspectingTower.level}]`;
  if (statsEl) {
    const statsText = `DMG: ${dmg} | RATE: ${rate}s | RNG: ${spec.range >= 1000 ? "MAP" : spec.range} | ${spec.desc}`;
    if (statsEl.textContent !== statsText) statsEl.textContent = statsText;
  }
  // Only on a full refresh: rewriting the value every frame would fight an open dropdown.
  if (full && prioritySel) prioritySel.value = inspectingTower.priority || "FIRST";

  if (btnUpgrade) {
    const label = inspectingTower.level >= 3 ? "MAX LEVEL" : `UPGRADE (${upCost} G)`;
    if (btnUpgrade.textContent !== label) btnUpgrade.textContent = label;
    btnUpgrade.disabled = inspectingTower.level >= 3 || gold < upCost;
  }

  if (btnSell) {
    const label = `RECYCLE (+${refund} G)`;
    if (btnSell.textContent !== label) btnSell.textContent = label;
  }
}

// Wire Event Listeners
document.querySelectorAll(".tower-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tower-btn").forEach((b) => b.classList.remove("selected"));
    btn.classList.add("selected");
    selectedTowerType = btn.dataset.tower;
    hoverCache = null;
    sfx.click();
  });
});

const btnCallWave = document.getElementById("btn-call-wave");
const btnUpgrade = document.getElementById("btn-upgrade-tower");
const btnSell = document.getElementById("btn-sell-tower");
const btnSpeed = document.getElementById("btn-speed-toggle");
const prioritySel = document.getElementById("inspect-priority");

const btnCmdBarrage = document.getElementById("btn-cmd-barrage");
const btnCmdEmp = document.getElementById("btn-cmd-emp");
const btnCmdOverdrive = document.getElementById("btn-cmd-overdrive");

if (btnCallWave) btnCallWave.addEventListener("click", callEarlyWave);
if (btnUpgrade) btnUpgrade.addEventListener("click", upgradeInspectedTower);
if (btnSell) btnSell.addEventListener("click", sellInspectedTower);

function cycleSpeed() {
  gameSpeed = gameSpeed === 1 ? 2 : (gameSpeed === 2 ? 3 : 1);
  sfx.click();
  updateHUD();
}

if (btnSpeed) btnSpeed.addEventListener("click", cycleSpeed);

if (prioritySel) {
  prioritySel.addEventListener("change", (e) => {
    if (inspectingTower) {
      inspectingTower.priority = e.target.value;
      sfx.click();
    }
  });
}

if (btnCmdBarrage) btnCmdBarrage.addEventListener("click", triggerOrbitalBarrage);
if (btnCmdEmp) btnCmdEmp.addEventListener("click", triggerEMPShock);
if (btnCmdOverdrive) btnCmdOverdrive.addEventListener("click", triggerCoreOverdrive);

// Hotkeys for Tactical Abilities & Speed
window.addEventListener("keydown", (e) => {
  if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.target instanceof Element && e.target.closest("input, textarea, select, [contenteditable]")) return;
  if (document.querySelector(".modal-backdrop") || gameOver || loop.isPaused()) return;
  if (e.code === "Digit1") triggerOrbitalBarrage();
  else if (e.code === "Digit2") triggerEMPShock();
  else if (e.code === "Digit3") triggerCoreOverdrive();
  else if (e.code === "KeyZ") cycleSpeed();
});


// Start Game Loop
const loop = createGameLoop({
  canvas,
  update,
  render
});

loop.start();
