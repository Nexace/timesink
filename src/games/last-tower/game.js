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
  const g = testGrid || grid;
  const path = aStar({
    start: SPAWN_TILE,
    goal: EXIT_TILE,
    cols: COLS,
    rows: ROWS,
    isWalkable: (x, y) => {
      return g[y * COLS + x] === 0;
    }
  });
  return path;
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

export function buildTowerAt(gx, gy) {
  if ((gx === SPAWN_TILE.x && gy === SPAWN_TILE.y) || (gx === EXIT_TILE.x && gy === EXIT_TILE.y)) {
    sfx.deny();
    toast({ title: "PROTECTED ZONE", body: "Cannot build on spawn gate or Last Tower citadel!", icon: "alert" });
    return false;
  }

  const spec = TOWER_SPECS[selectedTowerType];
  if (gold < spec.cost) {
    sfx.deny();
    toast({ title: "LOW TREASURY", body: `Need ${spec.cost} Gold to commission ${spec.name}`, icon: "alert" });
    return false;
  }

  // Check illegal blocking
  const tempGrid = new Uint8Array(grid);
  tempGrid[gy * COLS + gx] = 1;
  const newPath = validatePath(tempGrid);

  if (!newPath) {
    playWarningBeep();
    sfx.deny();
    toast({ title: "ILLEGAL PLACEMENT", body: "Citadel defense doctrine: You must leave an open maze path!", icon: "alert" });
    return false;
  }

  // Placement valid
  grid[gy * COLS + gx] = 1;
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
  creeps.forEach((c) => {
    if (!c.isFlyer) {
      const creepGx = clamp(Math.floor(c.x / TILE_W), 0, COLS - 1);
      const creepGy = clamp(Math.floor(c.y / TILE_H), 0, ROWS - 1);
      const pathFromCreep = aStar({
        start: { x: creepGx, y: creepGy },
        goal: EXIT_TILE,
        cols: COLS,
        rows: ROWS,
        isWalkable: (x, y) => grid[y * COLS + x] === 0
      });
      if (pathFromCreep && pathFromCreep.length > 0) {
        c.path = pathFromCreep;
        c.pathIndex = 0;
      }
    }
  });

  return true;
}

export function upgradeInspectedTower() {
  if (!inspectingTower) return;
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
  if (!inspectingTower) return;
  const refund = Math.floor(inspectingTower.totalInvested * 0.7);
  gold += refund;

  grid[inspectingTower.y * COLS + inspectingTower.x] = 0;
  const idx = towers.indexOf(inspectingTower);
  if (idx !== -1) towers.splice(idx, 1);

  currentMasterPath = validatePath(grid);
  inspectingTower = null;
  playCoin();
  toast({ title: "TOWER RECYCLED", body: `+${refund} Gold recovered (70% value)` });

  updateHUD();
  updateInspectorUI();
}

// Tactical Commander Abilities
export function triggerOrbitalBarrage() {
  const ab = COMMANDER_ABILITIES.barrage;
  if (ab.cd > 0 || gold < ab.cost) {
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
    setTimeout(() => {
      let targetX = (COLS * 0.4 + Math.random() * COLS * 0.4) * TILE_W;
      let targetY = (ROWS * 0.3 + Math.random() * ROWS * 0.4) * TILE_H;

      if (creeps.length > 0) {
        const c = creeps[Math.floor(Math.random() * creeps.length)];
        targetX = c.x + (Math.random() - 0.5) * 40;
        targetY = c.y + (Math.random() - 0.5) * 40;
      }

      // Spawn blast crater decal
      decals.push({ x: targetX, y: targetY, r: 24, alpha: 0.85, type: "crater" });
      playExplosion({ duration: 0.8, lowpass: 200 });

      // Damage nearby creeps
      creeps.forEach((cr) => {
        if (dist(targetX, targetY, cr.x, cr.y) < 70) {
          cr.hp -= 110;
          floatingTexts.push({ x: cr.x, y: cr.y - 10, text: "-110 CRIT!", color: "#ffea00", life: 1.0 });
          if (cr.hp <= 0) killCreep(cr);
        }
      });
    }, s * 220);
  }
  updateHUD();
}

export function triggerEMPShock() {
  const ab = COMMANDER_ABILITIES.emp;
  if (ab.cd > 0 || gold < ab.cost) {
    sfx.deny();
    return;
  }
  gold -= ab.cost;
  ab.cd = ab.cdMax;
  sfx.laser();
  playTone(480, "sawtooth", 0.4, 0.2);
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
    type: "emp_ring"
  });

  updateHUD();
}

export function triggerCoreOverdrive() {
  const ab = COMMANDER_ABILITIES.overdrive;
  if (ab.cd > 0 || gold < ab.cost) {
    sfx.deny();
    return;
  }
  gold -= ab.cost;
  ab.cd = ab.cdMax;
  ab.activeTime = 7.0;
  sfx.powerup();
  playTone(600, "triangle", 0.6, 0.25);
  toast({ title: "CORE OVERDRIVE ACTIVE!", body: "+60% Fire Rate & Damage across all weapon systems!", icon: "fire" });
  updateHUD();
}

// Wave Spawning System
export function callEarlyWave() {
  if (creepsToSpawn.length > 0 || creeps.length > 0) {
    toast({ title: "COMBAT IN PROGRESS", body: "Clear the current invading wave before calling next wave!" });
    return;
  }
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

export function spawnCreep(type) {
  const spec = ENEMY_SPECS[type];
  const hpMult = 1.0 + (currentWave - 1) * 0.18;

  const creep = {
    x: (SPAWN_TILE.x + 0.5) * TILE_W,
    y: (SPAWN_TILE.y + 0.5) * TILE_H,
    vx: 1,
    vy: 0,
    type,
    hp: Math.round(spec.hp * hpMult),
    maxHp: Math.round(spec.hp * hpMult),
    speed: spec.speed,
    baseSpeed: spec.speed,
    armor: spec.armor || 0,
    reward: spec.reward,
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
    path: spec.isFlyer ? null : [...currentMasterPath]
  };

  creeps.push(creep);
}

// Target Selector matching test specifications
export function getTowerTarget(tower) {
  const spec = TOWER_SPECS[tower.type];
  const tx = (tower.x + 0.5) * TILE_W;
  const ty = (tower.y + 0.5) * TILE_H;

  const inRange = creeps.filter((c) => {
    return dist(tx, ty, c.x, c.y) <= spec.range;
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
    const netDmg = Math.round(dmg * Math.max(0.2, 1.0 - (target.armor * 0.5)));
    target.hp -= netDmg;
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
    if (target.hp <= 0) killCreep(target);
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
    let hitCount = 0;
    let currTarget = target;
    const chainTargets = [target];

    while (hitCount < spec.chains) {
      currTarget.hp -= dmg;
      if (currTarget.hp <= 0) killCreep(currTarget);

      // Find next closest creep not yet chained
      const next = creeps.find((c) => !chainTargets.includes(c) && dist(currTarget.x, currTarget.y, c.x, c.y) < 110);
      if (!next) break;

      projectiles.push({
        x1: currTarget.x,
        y1: currTarget.y,
        x2: next.x,
        y2: next.y,
        life: 0.16,
        type: "lightning"
      });

      chainTargets.push(next);
      currTarget = next;
      hitCount++;
    }

    projectiles.push({
      x1: tx,
      y1: ty,
      x2: target.x,
      y2: target.y,
      life: 0.16,
      type: "lightning"
    });

    playTone(320, "sawtooth", 0.2, 0.08);
  }

  // 5. Cryo Blaster
  else if (t.type === "cryo") {
    creeps.forEach((c) => {
      if (dist(tx, ty, c.x, c.y) <= spec.range) {
        c.hp -= dmg;
        c.freezeTime = 2.8 + t.level * 0.4;
        if (c.hp <= 0) killCreep(c);
      }
    });

    projectiles.push({
      x: tx,
      y: ty,
      radius: spec.range,
      life: 0.28,
      type: "frost_pulse"
    });

    playTone(210, "sine", 0.18, 0.06);
  }

  // 6. Mag-Rail Sniper
  else if (t.type === "sniper") {
    // Penetrates all creeps in a straight line through target across entire canvas
    const angle = Math.atan2(target.y - ty, target.x - tx);
    const endX = tx + Math.cos(angle) * 1200;
    const endY = ty + Math.sin(angle) * 1200;

    creeps.forEach((c) => {
      // Distance from creep to ray
      const dRay = distToSegment({ x: c.x, y: c.y }, { x: tx, y: ty }, { x: endX, y: endY });
      if (dRay < 18) {
        c.hp -= dmg;
        floatingTexts.push({ x: c.x, y: c.y - 10, text: `-${dmg} RAIL!`, color: "#ff3344", life: 0.9 });
        if (c.hp <= 0) killCreep(c);
      }
    });

    projectiles.push({
      x1: tx,
      y1: ty,
      x2: endX,
      y2: endY,
      life: 0.24,
      type: "rail"
    });

    playExplosion({ duration: 0.45, lowpass: 380 });
  }

  // 7. Swarm Rockets
  else if (t.type === "missile") {
    for (let s = 0; s < spec.salvo; s++) {
      setTimeout(() => {
        if (!target) return;
        projectiles.push({
          x: tx + (Math.random() - 0.5) * 14,
          y: ty + (Math.random() - 0.5) * 14,
          target,
          speed: 340,
          angle: t.turretAngle + (Math.random() - 0.5) * 0.8,
          turnRate: 4.8,
          dmg,
          life: 2.5,
          type: "rocket"
        });
        playLaser();
      }, s * 110);
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
    playTone(160, "sawtooth", 0.2, 0.07);
  }

  // 9. Sonic Disruptor
  else if (t.type === "sonic") {
    creeps.forEach((c) => {
      if (dist(tx, ty, c.x, c.y) <= spec.range) {
        c.hp -= dmg;
        // Knockback along movement path
        c.pathProgress = Math.max(0, c.pathProgress - spec.knockback);
        c.x -= Math.cos(t.turretAngle) * spec.knockback * 0.5;
        c.y -= Math.sin(t.turretAngle) * spec.knockback * 0.5;
        if (c.hp <= 0) killCreep(c);
      }
    });

    projectiles.push({
      x: tx,
      y: ty,
      radius: 10,
      maxRadius: spec.range,
      life: 0.35,
      type: "sonic_wave"
    });

    playTone(90, "triangle", 0.3, 0.12);
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

function killCreep(c) {
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
    toast({ title: "GOLIATH HAS FALLEN!", body: "+120 Gold! Mini cyber-runners emerging!", icon: "trophy" });
    for (let i = 0; i < 4; i++) {
      spawnCreep("runner");
    }
  }
}

// Main Game Update
function update(rawDt) {
  const dt = rawDt * gameSpeed;

  if (screenShake > 0) {
    screenShake = Math.max(0, screenShake - rawDt * 24);
  }

  // Update Commander Cooldowns
  for (const k in COMMANDER_ABILITIES) {
    const ab = COMMANDER_ABILITIES[k];
    if (ab.cd > 0) ab.cd = Math.max(0, ab.cd - rawDt);
    if (ab.activeTime > 0) ab.activeTime = Math.max(0, ab.activeTime - rawDt);
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
    if (d.type === "acid_pool") {
      d.life -= dt;
      // Damage creeps standing in acid
      creeps.forEach((c) => {
        if (dist(d.x, d.y, c.x, c.y) < d.r) {
          c.acidStacks = Math.min(3, c.acidStacks + 1);
          c.acidTimer = 3.0;
          c.hp -= 14 * dt;
          if (c.hp <= 0) killCreep(c);
        }
      });
      if (d.life <= 0) decals.splice(i, 1);
    }
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
      c.hp -= c.acidStacks * 6 * dt;
      if (c.hp <= 0) {
        killCreep(c);
        continue;
      }
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
      lives--;
      screenShake = 10;
      playHit({ isCritical: true });
      toast({ title: "CORE BREACHED!", body: "An invader compromised the Last Tower!", icon: "skull" });
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
      const ang = Math.atan2(p.target.y - p.y, p.target.x - p.x);
      p.x += Math.cos(ang) * p.speed * dt;
      p.y += Math.sin(ang) * p.speed * dt;

      if (dist(p.x, p.y, p.target.x, p.target.y) < 14) {
        const netDmg = Math.round(p.dmg * Math.max(0.1, 1.0 - (p.target.armor || 0)));
        p.target.hp -= netDmg;
        if (p.target.hp <= 0) killCreep(p.target);
        projectiles.splice(i, 1);
      }
    } else if (p.type === "rocket") {
      p.life -= dt;
      if (!p.target || p.target.hp <= 0) {
        p.target = creeps[0] || null;
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

      if (p.target && dist(p.x, p.y, p.target.x, p.target.y) < 16) {
        playExplosion({ duration: 0.4, lowpass: 320 });
        creeps.forEach((c) => {
          if (dist(p.x, p.y, c.x, c.y) < 36) {
            c.hp -= p.dmg;
            if (c.hp <= 0) killCreep(c);
          }
        });
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
        screenShake = 6;
        decals.push({ x: p.targetX, y: p.targetY, r: 20, alpha: 0.7, type: "crater" });
        creeps.forEach((c) => {
          if (dist(p.targetX, p.targetY, c.x, c.y) <= p.splash) {
            c.hp -= p.dmg;
            if (c.hp <= 0) killCreep(c);
          }
        });
        projectiles.splice(i, 1);
      }
    } else if (p.type === "acid_blob") {
      p.life -= dt;
      const progress = 1.0 - (p.life / p.maxLife);
      p.x = lerp(p.startX, p.targetX, progress);
      p.y = lerp(p.startY, p.targetY, progress);

      if (p.life <= 0) {
        // Spawn lingering acid puddle
        decals.push({ x: p.targetX, y: p.targetY, r: 28, life: 5.0, maxLife: 5.0, type: "acid_pool" });
        projectiles.splice(i, 1);
      }
    } else {
      p.life -= dt;
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

  updateHUD();
}

// Render Engine
function render() {
  ctx.save();

  // Screen shake
  if (screenShake > 0) {
    const ox = (Math.random() - 0.5) * screenShake;
    const oy = (Math.random() - 0.5) * screenShake;
    ctx.translate(ox, oy);
  }

  // 1. High-Tech Cyber Defense Grid Floor
  ctx.fillStyle = "#020a05";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Grid Lines & Subtle Pulse
  ctx.strokeStyle = "rgba(0, 230, 118, 0.08)";
  ctx.lineWidth = 1;
  for (let x = 0; x <= COLS; x++) {
    ctx.beginPath();
    ctx.moveTo(x * TILE_W, 0);
    ctx.lineTo(x * TILE_W, ROWS * TILE_H);
    ctx.stroke();
  }
  for (let y = 0; y <= ROWS; y++) {
    ctx.beginPath();
    ctx.moveTo(0, y * TILE_H);
    ctx.lineTo(COLS * TILE_W, y * TILE_H);
    ctx.stroke();
  }

  // 2. Render Decals (Blast Craters & Acid Puddles)
  decals.forEach((d) => {
    if (d.type === "crater") {
      ctx.fillStyle = `rgba(10, 5, 2, ${d.alpha || 0.6})`;
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(255, 120, 0, 0.3)";
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

  // 3. Spawn Portal & THE LAST TOWER CITADEL (Exit Tile)
  // Spawn Gate
  const sx = SPAWN_TILE.x * TILE_W;
  const sy = SPAWN_TILE.y * TILE_H;
  ctx.fillStyle = "rgba(255, 23, 68, 0.25)";
  ctx.fillRect(sx, sy, TILE_W, TILE_H);
  ctx.strokeStyle = "#ff1744";
  ctx.lineWidth = 2;
  ctx.strokeRect(sx, sy, TILE_W, TILE_H);
  ctx.fillStyle = "#ff1744";
  ctx.font = '8px "Press Start 2P", monospace';
  ctx.fillText("SPAWN", sx + 4, sy + TILE_H / 2 + 3);

  // The Last Tower Citadel (Exit Tile)
  drawLastTowerCitadel((EXIT_TILE.x + 0.5) * TILE_W, (EXIT_TILE.y + 0.5) * TILE_H);

  // 4. Projected A* Path Line
  if (currentMasterPath && currentMasterPath.length > 1) {
    ctx.strokeStyle = "rgba(0, 230, 118, 0.22)";
    ctx.lineWidth = 3;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    currentMasterPath.forEach((node, idx) => {
      const nx = (node.x + 0.5) * TILE_W;
      const ny = (node.y + 0.5) * TILE_H;
      if (idx === 0) ctx.moveTo(nx, ny);
      else ctx.lineTo(nx, ny);
    });
    ctx.stroke();
    ctx.setLineDash([]);
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

  // 10. Draw Floating Combat Text
  floatingTexts.forEach((ft) => {
    ctx.fillStyle = ft.color || "#ffffff";
    ctx.font = '9px "Press Start 2P", monospace';
    ctx.textAlign = "center";
    ctx.fillText(ft.text, ft.x, ft.y);
  });

  ctx.restore();
}

// Detailed Citadel Rendering for Exit
function drawLastTowerCitadel(cx, cy) {
  ctx.save();
  ctx.translate(cx, cy);

  // Outer fortified wall
  ctx.fillStyle = "#051f11";
  ctx.strokeStyle = "#00e676";
  ctx.lineWidth = 2;
  ctx.strokeRect(-TILE_W * 0.45, -TILE_H * 0.45, TILE_W * 0.9, TILE_H * 0.9);
  ctx.fillRect(-TILE_W * 0.45, -TILE_H * 0.45, TILE_W * 0.9, TILE_H * 0.9);

  // Rotating Fusion Rings
  const time = Date.now() * 0.003;
  ctx.strokeStyle = "rgba(0, 240, 255, 0.7)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(0, 0, 14, time, time + Math.PI * 1.5);
  ctx.stroke();

  // Core Glowing Sphere
  ctx.fillStyle = lives < 6 ? "#ff1744" : "#00f0ff";
  ctx.shadowColor = ctx.fillStyle;
  ctx.shadowBlur = 12;
  ctx.beginPath();
  ctx.arc(0, 0, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  // Label
  ctx.fillStyle = "#ffffff";
  ctx.font = '7px "VT323", monospace';
  ctx.textAlign = "center";
  ctx.fillText("THE LAST TOWER", 0, -17);

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

  // 1. Reinforced Steel Base Plate
  ctx.fillStyle = "#0c1f14";
  ctx.fillRect(tx + 2, ty + 2, TILE_W - 4, TILE_H - 4);
  ctx.strokeStyle = spec.color;
  ctx.lineWidth = t === inspectingTower ? 2.5 : 1.2;
  ctx.strokeRect(tx + 2, ty + 2, TILE_W - 4, TILE_H - 4);

  // Corner Rivets
  ctx.fillStyle = "#8a97b1";
  ctx.fillRect(tx + 3, ty + 3, 2, 2);
  ctx.fillRect(tx + TILE_W - 5, ty + 3, 2, 2);
  ctx.fillRect(tx + 3, ty + TILE_H - 5, 2, 2);
  ctx.fillRect(tx + TILE_W - 5, ty + TILE_H - 5, 2, 2);

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

  // Range preview on inspected tower
  if (t === inspectingTower) {
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
      ctx.strokeStyle = "rgba(0, 191, 165, 0.7)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.stroke();
    } else if (p.type === "rail") {
      ctx.strokeStyle = "#ff3344";
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
      ctx.strokeStyle = "rgba(255, 0, 127, 0.6)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.stroke();
    } else if (p.type === "emp_ring") {
      ctx.strokeStyle = "rgba(0, 240, 255, 0.75)";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.stroke();
      p.radius += 1200 * (1 / 60);
    }
  });
}

function handleGameOver() {
  playExplosion({ duration: 1.6, lowpass: 120 });
  saveGameScore("last-tower", {
    score: currentWave,
    label: `DEFENDED ${currentWave} WAVES // ${towers.length} TOWERS`
  });

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
  if (livesEl) livesEl.textContent = `${lives} / ${maxLives}`;
  if (waveEl) waveEl.textContent = `WAVE ${currentWave}`;
  if (timerEl) {
    timerEl.textContent = creepsToSpawn.length > 0 || creeps.length > 0 ? "IN COMBAT" : `NEXT: ${Math.ceil(waveTimer)}s`;
  }
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

function updateInspectorUI() {
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
  if (statsEl) statsEl.textContent = `DMG: ${dmg} | RATE: ${rate}s | RNG: ${spec.range} | ${spec.desc}`;
  if (prioritySel) prioritySel.value = inspectingTower.priority || "FIRST";

  if (btnUpgrade) {
    if (inspectingTower.level >= 3) {
      btnUpgrade.textContent = "MAX LEVEL";
      btnUpgrade.disabled = true;
    } else {
      btnUpgrade.textContent = `UPGRADE (${upCost} G)`;
      btnUpgrade.disabled = gold < upCost;
    }
  }

  if (btnSell) {
    btnSell.textContent = `RECYCLE (+${refund} G)`;
  }
}

// Wire Event Listeners
document.querySelectorAll(".tower-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tower-btn").forEach((b) => b.classList.remove("selected"));
    btn.classList.add("selected");
    selectedTowerType = btn.dataset.tower;
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

if (btnSpeed) {
  btnSpeed.addEventListener("click", () => {
    gameSpeed = gameSpeed === 1 ? 2 : (gameSpeed === 2 ? 3 : 1);
    sfx.click();
    updateHUD();
  });
}

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
  if (e.code === "Digit1") triggerOrbitalBarrage();
  else if (e.code === "Digit2") triggerEMPShock();
  else if (e.code === "Digit3") triggerCoreOverdrive();
  else if (e.code === "KeyZ") {
    gameSpeed = gameSpeed === 1 ? 2 : (gameSpeed === 2 ? 3 : 1);
    sfx.click();
    updateHUD();
  }
});

// Start Game Loop
const loop = createGameLoop({
  canvas,
  update,
  render
});

loop.start();
