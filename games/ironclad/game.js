/**
 * IRONCLAD — side-view naval RTS in the Battlecruisers mould.
 *
 * Two battlecruisers slug it out across a strait. Builder drones are the only currency: every deck
 * building and every unit a factory launches locks drones for its build time. Factories build the
 * unit you pick, weapons fire at the building you target, shields soak damage until they collapse,
 * and ultraweapons end fights. The rules tables live in engine.js; this file is the live battle:
 * simulation, unit AI, the enemy commander, camera and rendering.
 */

import { initShell } from "/shared/shell.js";
import { getHowToPlay } from "/shared/registry.js";
import { isSoundEnabled, getVolume } from "/shared/sound.js";
import { saveSlot, loadSlot } from "/shared/save.js";
import {
  CRUISERS,
  BUILDINGS,
  UNITS,
  BOSSES,
  CAMPAIGN_LEVELS,
  STARTER_LOADOUT,
  createDroneEconomy,
  canStartBuild,
  startConstruction,
  updateDroneEconomy,
  checkBuildQueue,
  TECH_LAB_UPGRADES,
  calculateUpgradedHull,
  canIonCannonHitTarget,
  isAdjacentToBooster,
  calculateStars,
  evaluateEnemyAiDecision,
  exportSaveCode,
  importSaveCode
} from "./engine.js";
import { createBackdrop, drawBackdrop, drawSea, drawBirds, drawBuildingArt, drawDroneArt, drawUnitArt, drawShot, drawIcbm, drawBeamArt, drawParticles } from "./art.js";
import { vignette, scanlines, glow, shade, rgba } from "/shared/gfx.js";

const TAU = Math.PI * 2;
const REDUCED_MOTION = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

// ── Web Audio Synthesizer ──
let audioCtx = null;
function getAudioCtx() {
  if (!audioCtx && typeof window !== "undefined") {
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (Ctor) audioCtx = new Ctor();
  }
  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

// Rate-limit each sound family so a 40-gun broadside doesn't turn into white noise
const soundGate = new Map();
function gate(name, gap) {
  const now = performance.now();
  if (now - (soundGate.get(name) || 0) < gap) return false;
  soundGate.set(name, now);
  return true;
}

function playTone(freq, duration, type = "square", gain = 0.2) {
  if (!isSoundEnabled()) return;
  const ctx = getAudioCtx();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    const vol = gain * getVolume();
    g.gain.setValueAtTime(vol, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration);
  } catch {}
}

function playExplosionSound(duration = 0.4, lowpass = 320, gain = 0.45) {
  if (!isSoundEnabled()) return;
  const ctx = getAudioCtx();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    const bufferSize = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(lowpass, now);
    filter.frequency.exponentialRampToValueAtTime(30, now + duration);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain * getVolume(), now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    noise.connect(filter);
    filter.connect(g);
    g.connect(ctx.destination);
    noise.start(now);
    noise.stop(now + duration);
  } catch {}
}

function playLaserSound(startFreq = 850, endFreq = 140, duration = 0.12) {
  if (!isSoundEnabled()) return;
  const ctx = getAudioCtx();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(startFreq, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), now + duration);
    g.gain.setValueAtTime(0.22 * getVolume(), now);
    g.gain.linearRampToValueAtTime(0.0001, now + duration);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration);
  } catch {}
}

function playArtilleryThud() {
  if (!isSoundEnabled() || !gate("thud", 70)) return;
  const ctx = getAudioCtx();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(130, now);
    osc.frequency.exponentialRampToValueAtTime(25, now + 0.38);
    g.gain.setValueAtTime(0.45 * getVolume(), now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.38);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.38);
  } catch {}
}

function playSirenSound() {
  if (!isSoundEnabled()) return;
  playTone(880, 0.25, "sawtooth", 0.3);
  setTimeout(() => playTone(660, 0.25, "sawtooth", 0.3), 260);
}

const sfx = {
  gun: () => gate("gun", 60) && playTone(480 + Math.random() * 60, 0.07, "square", 0.12),
  pop: () => gate("pop", 50) && playTone(760, 0.05, "square", 0.08),
  boom: (big = false) => gate(big ? "bigboom" : "boom", big ? 120 : 70) && playExplosionSound(big ? 0.7 : 0.3, big ? 180 : 260, big ? 0.5 : 0.3),
  splash: () => gate("splash", 90) && playExplosionSound(0.18, 900, 0.12),
  shield: () => gate("shield", 90) && playTone(1400, 0.08, "sine", 0.1),
  place: () => playTone(540, 0.1, "sine", 0.22),
  queue: () => playTone(380, 0.1, "sine", 0.22),
  deny: () => gate("deny", 120) && playTone(180, 0.15, "sawtooth", 0.25),
  done: () => playTone(660, 0.18, "triangle", 0.28),
  target: () => playTone(980, 0.08, "square", 0.14),
  launch: () => gate("launch", 200) && playTone(300, 0.2, "triangle", 0.18)
};

// ── Persistent Game Save State ──
const SAVE_KEY = "ironclad:save_v1";

function defaultSaveData() {
  return {
    stars: 0,
    scrap: 150,
    levelStars: {},
    unlockedCruisers: [...STARTER_LOADOUT.cruisers],
    unlockedBuildings: [...STARTER_LOADOUT.buildings],
    unlockedUnits: [...STARTER_LOADOUT.units],
    campaignLevel: 1,
    cruiser: "trident",
    techTiers: {
      hullArmor: 0,
      startingDrones: 0,
      buildSpeed: 0,
      shieldRecharge: 0,
      nanocoat: false
    }
  };
}

// Merge a stored / imported save over the defaults, rejecting malformed fields.
function normalizeSave(raw) {
  const d = defaultSaveData();
  if (!raw || typeof raw !== "object") return d;
  const num = (v, fb, lo = 0, hi = 1e9) => (Number.isFinite(v) ? Math.max(lo, Math.min(hi, Math.floor(v))) : fb);
  const list = (v, fb, valid) => (Array.isArray(v) ? [...new Set([...fb, ...v.filter((x) => typeof x === "string" && x in valid)])] : fb);
  const tiers = raw.techTiers && typeof raw.techTiers === "object" ? raw.techTiers : {};
  const unlockedCruisers = list(raw.unlockedCruisers, d.unlockedCruisers, CRUISERS);
  return {
    stars: num(raw.stars, d.stars),
    scrap: num(raw.scrap, d.scrap),
    levelStars: raw.levelStars && typeof raw.levelStars === "object" ? raw.levelStars : {},
    unlockedCruisers,
    unlockedBuildings: list(raw.unlockedBuildings, d.unlockedBuildings, BUILDINGS),
    unlockedUnits: list(raw.unlockedUnits, d.unlockedUnits, UNITS),
    campaignLevel: num(raw.campaignLevel, 1, 1, CAMPAIGN_LEVELS.length),
    cruiser: unlockedCruisers.includes(raw.cruiser) ? raw.cruiser : unlockedCruisers[0] || "trident",
    techTiers: {
      hullArmor: num(tiers.hullArmor, 0, 0, TECH_LAB_UPGRADES.hullArmor.maxTier),
      startingDrones: num(tiers.startingDrones, 0, 0, TECH_LAB_UPGRADES.startingDrones.maxTier),
      buildSpeed: num(tiers.buildSpeed, 0, 0, TECH_LAB_UPGRADES.buildSpeed.maxTier),
      shieldRecharge: num(tiers.shieldRecharge, 0, 0, TECH_LAB_UPGRADES.shieldRecharge.maxTier),
      nanocoat: tiers.nanocoat === true || tiers.nanocoat === 1
    }
  };
}

let saveState = normalizeSave(loadSlot(SAVE_KEY));

function persistSave() {
  saveSlot(SAVE_KEY, saveState);
}

// ── World ──
const WORLD_WIDTH = 3000;
const WORLD_HEIGHT = 720;
const WATER_Y = 520;
const PLAYER_CRUISER_X = 350;
const ENEMY_CRUISER_X = 2650;
const SKY_CEIL = WATER_Y - 430;
const PLANES = new Set(["fighter", "bomber", "spyPlane"]);
// Battle pace: construction and factory production run at 2x the drone-second tables, which keeps
// a sector to a few minutes while preserving every relative cost.
const BUILD_PACE = 2;

// ── Active Battle State ──
let battle = null;
let selectedBuildingId = null;
let activeCategory = "factories";
let speedMultiplier = 1;
let isPaused = false;
let contextMenuSlot = null;
let unitSeq = 0;
const camera = {
  x: 0,
  y: 0,
  zoom: 1.3,
  tx: 0,
  tz: 1.3,
  vx: 0,
  yOff: 0,
  anchor: null,
  shake: 0,
  isDragging: false,
  dragMoved: false,
  dragStartX: 0,
  dragStartY: 0,
  camStartX: 0,
  camStartOff: 0,
  lastDragX: 0,
  lastDragT: 0
};
const heldKeys = new Set();

// ─────────────────────────── Hull geometry ───────────────────────────
// Each hull is derived from its slot layout, so a Flea is a stubby gunboat and a Megalodon a long
// dreadnought. +x points at the bow; y is up-negative with the waterline at 0.
const geomCache = new Map();
function hullGeom(spec) {
  if (geomCache.has(spec.id)) return geomCache.get(spec.id);
  const xs = spec.slots.map((s) => s.x);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const bow = spec.slots.find((s) => s.type === "bow");
  const bowTip = (bow ? bow.x : maxX) + 38;
  const stern = minX - 150;
  const decks = spec.slots.filter((s) => s.type === "deck").sort((a, b) => a.x - b.x);
  const deck = [[stern, -28], [stern + 26, -36]];
  for (const d of decks) deck.push([d.x, d.y + 1]);
  const last = decks[decks.length - 1];
  if (last) deck.push([last.x + 16, last.y + 1]);
  if (bow) deck.push([bow.x - 14, bow.y + 1], [bow.x + 14, bow.y + 3]);
  deck.push([bowTip, -10]);
  const keel = [[bowTip - 4, 4], [bowTip - 36, 22], [stern + 26, 22], [stern - 2, 4]];
  const g = {
    minX,
    maxX,
    stern,
    bowTip,
    len: bowTip - stern,
    mid: (bowTip + stern) / 2,
    deck,
    poly: [...deck, ...keel],
    bridge: { x0: stern + 30, x1: Math.max(stern + 110, minX - 16) }
  };
  geomCache.set(spec.id, g);
  return g;
}

function deckYAt(g, x) {
  const d = g.deck;
  if (x <= d[0][0]) return d[0][1];
  for (let i = 1; i < d.length; i++) {
    if (x <= d[i][0]) {
      const k = (x - d[i - 1][0]) / Math.max(1, d[i][0] - d[i - 1][0]);
      return d[i - 1][1] + (d[i][1] - d[i - 1][1]) * k;
    }
  }
  return d[d.length - 1][1];
}

// Cruisers ride the swell: a slow heave and roll (and, at the end, a list and a plunge).
function updatePose(fleet, t) {
  const calm = REDUCED_MOTION ? 0.3 : 1;
  let dy = Math.sin(t * 0.8 + fleet.phase) * 2.6 * calm;
  let rot = Math.sin(t * 0.55 + fleet.phase * 1.7) * 0.011 * calm;
  if (fleet.sinking > 0) {
    const s = fleet.sinking;
    rot += Math.min(0.2, s * 0.06);
    dy += s * s * 7;
  }
  fleet.pose.dy = dy;
  fleet.pose.rot = rot;
}

// Local hull coordinates → world
function toWorld(fleet, lx, ly) {
  const g = fleet.geom;
  const { dy, rot } = fleet.pose;
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  const ax = lx - g.mid;
  const rx = ax * c - ly * s + g.mid;
  const ry = ax * s + ly * c;
  return { x: fleet.x + (fleet.isEnemy ? -rx : rx), y: WATER_Y + dy + ry };
}

function applyHullTransform(ctx, fleet) {
  const g = fleet.geom;
  ctx.translate(fleet.x, WATER_Y + fleet.pose.dy);
  if (fleet.isEnemy) ctx.scale(-1, 1);
  ctx.translate(g.mid, 0);
  ctx.rotate(fleet.pose.rot);
  ctx.translate(-g.mid, 0);
}

function fleetOf(isEnemy) {
  return isEnemy ? battle.enemy : battle.player;
}

function slotPos(fleet, slot) {
  return toWorld(fleet, slot.x, slot.y);
}

// Back-compat helper: world position of a slot on the given side
function slotWorldPos(slot, isEnemy) {
  return slotPos(fleetOf(isEnemy), slot);
}

function hullSpan(isEnemyHull) {
  const f = fleetOf(isEnemyHull);
  const g = f.geom;
  return isEnemyHull ? { x0: f.x - g.bowTip, x1: f.x - g.stern } : { x0: f.x + g.stern, x1: f.x + g.bowTip };
}

// Local x on a hull for a world x (ignores the tiny roll)
function localX(fleet, wx) {
  return fleet.isEnemy ? fleet.x - wx : wx - fleet.x;
}

function domeOf(fleet) {
  const g = fleet.geom;
  const c = toWorld(fleet, g.mid, 0);
  return { cx: c.x, cy: c.y, a: g.len / 2 + 60, b: 175 };
}

function insideDome(fleet, x, y) {
  if (!(fleet.shield > 0)) return false;
  const d = domeOf(fleet);
  if (y > d.cy + 4) return false;
  const nx = (x - d.cx) / d.a;
  const ny = (y - d.cy) / d.b;
  return nx * nx + ny * ny <= 1;
}

// ─────────────────────────── Battle setup ───────────────────────────
function makeFleet(spec, isEnemy, maxHull, drones) {
  return {
    id: spec.id,
    spec,
    isEnemy,
    passive: spec.passive || {},
    geom: hullGeom(spec),
    x: isEnemy ? ENEMY_CRUISER_X : PLAYER_CRUISER_X,
    pose: { dy: 0, rot: 0 },
    phase: Math.random() * TAU,
    hull: maxHull,
    maxHull,
    shield: 0,
    maxShield: 0,
    shieldRechargeDelayTimer: 0,
    shieldFlash: 0,
    cloakTimer: 0,
    economy: createDroneEconomy(drones),
    slots: spec.slots.map((s) => ({ ...s, isEnemy, building: null, underConstruction: null })),
    target: null,
    fires: [],
    sinking: 0
  };
}

function initBattle(levelNum = 1, mode = "campaign", customEnemyCruiser = null) {
  levelNum = Math.max(1, Math.min(CAMPAIGN_LEVELS.length, levelNum));
  const campaignLvl = CAMPAIGN_LEVELS[levelNum - 1];
  const boss = BOSSES.find((b) => b.id === campaignLvl.bossId) || BOSSES[0];

  // Secret unlock: Yeti Charger at 90+ stars
  if (saveState.stars >= 90 && !saveState.unlockedCruisers.includes("yetiCharger")) {
    saveState.unlockedCruisers.push("yetiCharger");
    persistSave();
  }

  const playerSpec = CRUISERS[saveState.cruiser] || CRUISERS.trident;
  const playerMaxHull = calculateUpgradedHull(playerSpec.hullHp, saveState.techTiers.hullArmor || 0, saveState.techTiers.nanocoat || false);
  const playerDrones = 4 + (saveState.techTiers.startingDrones || 0) + (playerSpec.passive?.extraStartingDrones || 0);

  // The enemy gets tougher through the campaign: more hull, more drones, a faster commander
  const enemySpec = CRUISERS[customEnemyCruiser || boss.cruiser] || CRUISERS.trident;
  const hullScale = (1 + (levelNum - 1) * 0.015) * (mode === "bossrush" ? 1.3 : 1);
  const enemyDrones = 4 + Math.floor((levelNum - 1) / 10) + (enemySpec.passive?.extraStartingDrones || 0);

  battle = {
    mode,
    levelNum,
    campaignLvl,
    boss,
    time: 0,
    gameOver: false,
    ending: null,
    won: false,
    buildingsLost: 0,
    nukeSirenFired: false,
    aiTimer: 2,
    aiThink: Math.max(1.6, 3.6 - levelNum * 0.05),
    aiSequenceIndex: 0,
    aiStall: 0,
    aiTargetTimer: 20,
    player: makeFleet(playerSpec, false, playerMaxHull, playerDrones),
    enemy: makeFleet(enemySpec, true, Math.round(enemySpec.hullHp * hullScale), enemyDrones),
    units: [],
    projectiles: [],
    beams: [],
    particles: [],
    smoke: [],
    flashes: [],
    ripples: [],
    texts: [],
    hover: null
  };
  battle.enemy.boss = boss;

  closeContextMenu();
  selectedBuildingId = null;
  const nukeWarn = document.getElementById("nuke-warning");
  if (nukeWarn) nukeWarn.style.display = "none";
  const resultModal = document.getElementById("result-modal");
  if (resultModal) resultModal.style.display = "none";

  camera.tz = camera.zoom = 1.6;
  camera.yOff = 0;
  jumpCameraTo("player", true);
  updateHUD(true);
  renderBuildCards();
  showBossTaunt(boss.name, boss.taunt || "Prepare for battle!");
}

// ─────────────────────────── Camera ───────────────────────────
function canvasEl() {
  return document.getElementById("ic-canvas");
}

function frameY(zoom) {
  const c = canvasEl();
  return WATER_Y - (c.height / zoom) * 0.78 + camera.yOff;
}

function clampX(x, zoom) {
  const c = canvasEl();
  const viewW = c.width / zoom;
  if (viewW >= WORLD_WIDTH) return (WORLD_WIDTH - viewW) / 2;
  return Math.max(0, Math.min(WORLD_WIDTH - viewW, x));
}

function jumpCameraTo(target, instant = false) {
  const c = canvasEl();
  if (!c || !battle) return;
  const viewW = c.width / camera.tz;
  let cx;
  if (target === "player") cx = PLAYER_CRUISER_X + battle.player.geom.mid + viewW * 0.18;
  else if (target === "enemy") cx = ENEMY_CRUISER_X - battle.enemy.geom.mid - viewW * 0.18;
  else if (typeof target === "number") cx = target;
  else cx = WORLD_WIDTH / 2;
  camera.tx = clampX(cx - viewW / 2, camera.tz);
  camera.vx = 0;
  camera.anchor = null;
  if (instant) {
    camera.x = camera.tx;
    camera.zoom = camera.tz;
    camera.y = frameY(camera.zoom);
  }
}

function updateCamera(dt) {
  const c = canvasEl();
  if (!c) return;
  const k = 1 - Math.exp(-dt * 9);
  // Keyboard pan
  const pan = (heldKeys.has("left") ? -1 : 0) + (heldKeys.has("right") ? 1 : 0);
  if (pan) camera.tx += (pan * 1100 * dt) / camera.zoom;
  // Drag inertia
  if (!camera.isDragging && Math.abs(camera.vx) > 1) {
    camera.tx += camera.vx * dt;
    camera.vx *= Math.exp(-dt * 4.5);
  }
  camera.zoom += (camera.tz - camera.zoom) * k;
  if (camera.anchor) {
    // Keep the world point under the cursor fixed while the zoom eases in
    camera.tx = camera.anchor.wx - camera.anchor.sx / camera.zoom;
    camera.x = camera.tx;
    if (Math.abs(camera.tz - camera.zoom) < 0.002) camera.anchor = null;
  }
  camera.tx = clampX(camera.tx, camera.zoom);
  camera.x += (camera.tx - camera.x) * (camera.isDragging || camera.anchor ? 1 : k);
  camera.x = clampX(camera.x, camera.zoom);
  const viewH = c.height / camera.zoom;
  camera.yOff = Math.max(-viewH * 0.25, Math.min(viewH * 0.18, camera.yOff));
  camera.y = frameY(camera.zoom);
  camera.shake = Math.max(0, camera.shake - dt * 18);
}

function addShake(amount, x) {
  if (REDUCED_MOTION) return;
  const c = canvasEl();
  if (x !== undefined && c) {
    const viewW = c.width / camera.zoom;
    if (x < camera.x - 100 || x > camera.x + viewW + 100) return;
  }
  camera.shake = Math.min(14, camera.shake + amount);
}

// ─────────────────────────── HUD ───────────────────────────
let hudStripTimer = 0;
function updateHUD(force = false) {
  if (!battle) return;
  const P = battle.player;
  const E = battle.enemy;
  const pct = (f) => Math.max(0, (f.hull / f.maxHull) * 100);
  const set = (id, fn) => {
    const el = document.getElementById(id);
    if (el) fn(el);
  };
  set("hud-player-hull-bar", (el) => (el.style.width = `${pct(P)}%`));
  set("hud-enemy-hull-bar", (el) => (el.style.width = `${pct(E)}%`));
  const shieldPct = (f) => (f.maxShield > 0 ? Math.min(100, (f.shield / f.maxHull) * 100) : 0);
  set("hud-player-shield-bar", (el) => (el.style.width = `${shieldPct(P)}%`));
  set("hud-enemy-shield-bar", (el) => (el.style.width = `${shieldPct(E)}%`));
  set("hud-mode-badge", (el) => (el.textContent = `${battle.mode.toUpperCase()} ${String(battle.levelNum).padStart(2, "0")}`));
  const shieldTag = (f) => (f.maxShield > 0 ? ` • SHIELD ${Math.ceil(f.shield)}` : "");
  set("hud-player-hp-text", (el) => (el.textContent = `${Math.max(0, Math.ceil(P.hull))} / ${P.maxHull} HP${shieldTag(P)}`));
  set("hud-enemy-hp-text", (el) => (el.textContent = `${Math.max(0, Math.ceil(E.hull))} / ${E.maxHull} HP${shieldTag(E)}`));
  set("hud-player-name", (el) => (el.textContent = P.spec.name.toUpperCase()));
  set("hud-drones", (el) => (el.textContent = `${P.economy.idleDrones} / ${P.economy.maxDrones}`));
  set("hud-scrap", (el) => (el.textContent = saveState.scrap));
  set("hud-stars", (el) => (el.textContent = `${saveState.stars} ★`));
  set("hud-timer", (el) => {
    const m = Math.floor(battle.time / 60);
    const s = Math.floor(battle.time % 60);
    el.textContent = `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  });
  set("hud-enemy-name", (el) => (el.textContent = battle.boss.name.toUpperCase()));
  set("hud-enemy-cruiser-type", (el) => (el.textContent = E.spec.name.toUpperCase()));
  if (battle.campaignLvl) {
    set("hud-par-time", (el) => {
      const pm = Math.floor(battle.campaignLvl.parTime / 60);
      const ps = Math.floor(battle.campaignLvl.parTime % 60);
      el.textContent = `${String(pm).padStart(2, "0")}:${String(ps).padStart(2, "0")}`;
    });
  }
  hudStripTimer -= 1;
  if (force || hudStripTimer <= 0) {
    hudStripTimer = 8;
    updateBuildStrip();
    refreshCardAffordability();
  }
}

function hasIntel(fleet) {
  return hasBuilding(fleet, "spySatellite") || battle.units.some((u) => u.isEnemy === fleet.isEnemy && u.id === "spyPlane" && u.hp > 0);
}

function updateBuildStrip() {
  const container = document.getElementById("build-items-container");
  if (!container || !battle) return;
  const P = battle.player;
  const item = (label, pct, color, extra = "") =>
    `<div class="ic-build-item" style="border-color:${color};${extra}"><span style="font-weight:700;color:${color};">${label}</span>` +
    (pct === null ? "" : `<div class="ic-build-item__bar"><div class="ic-build-item__fill" style="width:${pct}%;background:${color};"></div></div><span style="color:${color};font-size:10px;">${Math.floor(pct)}%</span>`) +
    `</div>`;
  let html = "";
  // Spy Satellite / Spy Plane: the enemy's construction yard is visible too
  if (hasIntel(P)) {
    for (const b of battle.enemy.economy.activeBuilds) {
      const spec = BUILDINGS[b.buildingId];
      html += item(`[ENEMY] ${spec ? spec.name : b.buildingId}`, Math.min(100, (b.progress / b.totalDuration) * 100), "#ff758f");
    }
  }
  for (const b of P.economy.activeBuilds) {
    const spec = BUILDINGS[b.buildingId];
    html += item(`${spec ? spec.name : b.buildingId} ▲${b.dronesLocked}`, Math.min(100, (b.progress / b.totalDuration) * 100), "#00f0ff");
  }
  for (const s of P.slots) {
    const f = s.building?.prod;
    if (f) html += item(`${UNITS[f.unitId].name} ▲${f.drones}`, Math.min(100, (f.progress / f.total) * 100), "#7CFC00");
  }
  for (const q of P.economy.queue) {
    const spec = BUILDINGS[q.buildingId];
    html += item(`[QUEUED] ${spec ? spec.name : q.buildingId} ▲${q.buildingSpec.drones}`, null, "#ffb703", "border-style:dashed;opacity:.8;");
  }
  container.innerHTML = html || `<span style="color:#64748b;font-style:italic;">All builder drones on standby.</span>`;
}

// ── Build dock ──
const iconCache = new Map();
function buildingIcon(id) {
  if (iconCache.has(id)) return iconCache.get(id);
  let url = "";
  try {
    const c = document.createElement("canvas");
    c.width = 96;
    c.height = 72;
    const g = c.getContext("2d");
    g.translate(48, 56);
    g.scale(1.5, 1.5);
    drawBuildingArt(g, id, false, 0.4);
    url = c.toDataURL();
  } catch {}
  iconCache.set(id, url);
  return url;
}

function effectiveDrones(fleet, spec) {
  const discount = spec.category === "tactical" ? fleet.passive.tacticalDroneDiscount || 0 : 0;
  return Math.max(1, spec.drones - discount);
}

function renderBuildCards() {
  const cardsContainer = document.getElementById("dock-cards");
  if (!cardsContainer) return;
  const keys = Object.keys(BUILDINGS).filter((k) => BUILDINGS[k].category === activeCategory);
  cardsContainer.innerHTML = keys
    .map((k) => {
      const b = BUILDINGS[k];
      const isUnlocked = saveState.unlockedBuildings.includes(k);
      const drones = battle ? effectiveDrones(battle.player, b) : b.drones;
      const icon = buildingIcon(k);
      return `
        <button type="button" class="ic-bldg-card ${selectedBuildingId === k ? "selected" : ""} ${!isUnlocked ? "locked" : ""}" data-building-id="${k}" ${isUnlocked ? "" : 'aria-disabled="true"'}>
          <span class="ic-bldg-card__icon">${icon ? `<img src="${icon}" alt="" width="64" height="48" />` : ""}</span>
          <span class="ic-bldg-card__body">
            <span class="ic-bldg-card__header">
              <span class="ic-bldg-card__name">${b.name}</span>
              <span class="ic-bldg-card__slots">${b.allowedSlots.join("/").toUpperCase()}</span>
            </span>
            <span class="ic-bldg-card__cost">
              <span class="ic-bldg-card__drones">▲ ${drones} DRONES</span>
              <span class="ic-bldg-card__time">⏱ ${Math.round(buildTimeFor(battle ? battle.player : null, b))}s</span>
            </span>
            <span class="ic-bldg-card__desc">${isUnlocked ? b.desc : "[LOCKED // ADVANCE CAMPAIGN]"}</span>
          </span>
        </button>`;
    })
    .join("");
  refreshCardAffordability();
}

function refreshCardAffordability() {
  if (!battle) return;
  const idle = battle.player.economy.idleDrones;
  document.querySelectorAll(".ic-bldg-card").forEach((card) => {
    const spec = BUILDINGS[card.dataset.buildingId];
    if (spec) card.classList.toggle("short", effectiveDrones(battle.player, spec) > idle);
  });
}

// ─────────────────────────── Construction ───────────────────────────
function buildSpeedFor(fleet, spec) {
  let m = BUILD_PACE;
  if (fleet && !fleet.isEnemy) m += (saveState.techTiers.buildSpeed || 0) * 0.05;
  const p = fleet ? fleet.passive : {};
  if (spec.id === "lasCannon" && p.lasCannonBuildBonus) m += p.lasCannonBuildBonus;
  if (spec.category === "ultraweapons" && p.ultraweaponBuildSpeedBonus) m += p.ultraweaponBuildSpeedBonus;
  return m;
}

function buildTimeFor(fleet, spec) {
  return spec.buildTime / buildSpeedFor(fleet, spec);
}

// Shared by the player and the enemy commander
function placeBuilding(fleet, slot, buildingId) {
  const spec = BUILDINGS[buildingId];
  if (!spec || !spec.allowedSlots.includes(slot.type) || slot.building || slot.underConstruction) return null;
  if (spec.limitOne && fleet.slots.some((s) => (s.building?.id || s.underConstruction?.buildingId) === buildingId)) return null;
  const drones = effectiveDrones(fleet, spec);
  const mult = buildSpeedFor(fleet, spec);
  const res = startConstruction(fleet.economy, slot.id, buildingId, drones === spec.drones ? spec : { ...spec, drones }, mult);
  slot.underConstruction = { buildingId, spec, progress: 0, totalDuration: spec.buildTime / mult, isQueued: res.queued, hp: spec.hp };
  return res;
}

function handleSlotClick(slot) {
  if (!battle || battle.gameOver || battle.ending) return;
  if (selectedBuildingId) {
    const spec = BUILDINGS[selectedBuildingId];
    if (!spec) return;
    if (!spec.allowedSlots.includes(slot.type) || slot.building || slot.underConstruction) {
      sfx.deny();
      toastCanvas(slot.building || slot.underConstruction ? "SLOT OCCUPIED" : `NEEDS A ${spec.allowedSlots.join(" / ").toUpperCase()} SLOT`, "#ff758f");
      return;
    }
    if (spec.limitOne && battle.player.slots.some((s) => (s.building?.id || s.underConstruction?.buildingId) === selectedBuildingId)) {
      sfx.deny();
      toastCanvas("ONE PER CRUISER", "#ff758f");
      return;
    }
    const res = placeBuilding(battle.player, slot, selectedBuildingId);
    if (res) {
      if (res.queued) sfx.queue();
      else sfx.place();
      // Keep the card armed with Shift held, like a build queue
      if (!heldKeys.has("shift")) selectedBuildingId = null;
      renderBuildCards();
      updateHUD(true);
    }
  } else if (slot.building || slot.underConstruction) {
    openContextMenu(slot);
  }
}

function openContextMenu(slot) {
  contextMenuSlot = slot;
  const menu = document.getElementById("context-menu");
  const canvas = canvasEl();
  if (!menu || !canvas) return;

  const title = document.getElementById("ctx-title");
  const repairBtn = document.getElementById("ctx-repair");
  const sellBtn = document.getElementById("ctx-sell");
  const unitsBox = document.getElementById("ctx-units");
  const b = slot.building;
  if (title) title.textContent = (b ? b.spec.name : BUILDINGS[slot.underConstruction.buildingId].name).toUpperCase();
  if (b) {
    const damaged = b.hp < b.maxHp;
    if (repairBtn) {
      repairBtn.style.display = "";
      repairBtn.disabled = !damaged || b.repairing > 0;
      repairBtn.textContent = b.repairing > 0 ? "REPAIRING…" : damaged ? `REPAIR ▲1 (${Math.ceil(b.hp)}/${b.maxHp})` : "INTEGRITY 100%";
    }
    if (sellBtn) sellBtn.textContent = "DEMOLISH (FREE SLOT)";
  } else {
    if (repairBtn) repairBtn.style.display = "none";
    if (sellBtn) sellBtn.textContent = "CANCEL BUILD";
  }

  // Factories: choose what they build
  if (unitsBox) {
    if (b && b.spec.canProduce) {
      unitsBox.hidden = false;
      unitsBox.innerHTML =
        `<span class="ic-context-label">PRODUCTION</span>` +
        b.spec.canProduce
          .map((id) => {
            const u = UNITS[id];
            const locked = !saveState.unlockedUnits.includes(id);
            const on = b.unitId === id;
            return `<button type="button" class="ic-context-unit ${on ? "on" : ""}" data-unit="${id}" ${locked ? "disabled" : ""}>
              <span>${locked ? "🔒 " : ""}${u.name}</span><small>▲${u.drones} · ${Math.round(unitBuildTime(battle.player, u))}s</small></button>`;
          })
          .join("") +
        `<button type="button" class="ic-context-unit ${!b.unitId ? "on" : ""}" data-unit="">HOLD PRODUCTION</button>`;
    } else {
      unitsBox.hidden = true;
      unitsBox.innerHTML = "";
    }
  }

  const rect = canvas.getBoundingClientRect();
  const cssPerPx = rect.width / canvas.width;
  const p = slotPos(battle.player, slot);
  const sx = (p.x - camera.x) * camera.zoom * cssPerPx;
  const sy = (p.y - camera.y) * camera.zoom * cssPerPx;
  menu.style.display = "flex";
  const mw = menu.offsetWidth || 170;
  const mh = menu.offsetHeight || 90;
  menu.style.left = `${Math.max(4, Math.min(rect.width - mw - 4, sx + 22))}px`;
  menu.style.top = `${Math.max(4, Math.min(rect.height - mh - 4, sy - mh / 2))}px`;
}

function closeContextMenu() {
  contextMenuSlot = null;
  const menu = document.getElementById("context-menu");
  if (menu) menu.style.display = "none";
}

// ── Boss Dialogue Banner ──
let bossBannerTimeout = null;
function showBossTaunt(bossName, dialogText) {
  const banner = document.getElementById("boss-banner");
  const nameEl = document.getElementById("boss-name");
  const textEl = document.getElementById("boss-dialog");
  if (!banner || !nameEl || !textEl) return;
  nameEl.textContent = bossName.toUpperCase();
  textEl.textContent = `"${dialogText}"`;
  banner.style.display = "flex";
  if (bossBannerTimeout) clearTimeout(bossBannerTimeout);
  bossBannerTimeout = setTimeout(() => (banner.style.display = "none"), 6000);
}

// Short centred callout drawn on the canvas ("SLOT OCCUPIED", "TARGET LOCKED")
function toastCanvas(text, color = "#9bf6ff") {
  if (!battle) return;
  battle.toast = { text, color, life: 1.6 };
}

// ─────────────────────────── Enemy commander ───────────────────────────
function aiFreeSlot(fleet, spec) {
  const free = fleet.slots.filter((s) => !s.building && !s.underConstruction && spec.allowedSlots.includes(s.type));
  if (!free.length) return null;
  // Weapons prefer the bow end (closer to the enemy), support buildings the stern
  const forward = spec.category === "offensive" || spec.category === "ultraweapons";
  free.sort((a, b) => (forward ? b.x - a.x : a.x - b.x));
  return free[0];
}

function aiTryBuild(id) {
  const E = battle.enemy;
  const spec = BUILDINGS[id];
  if (!spec) return false;
  if (spec.limitOne && E.slots.some((s) => (s.building?.id || s.underConstruction?.buildingId) === id)) return false;
  if (!canStartBuild(E.economy, { drones: effectiveDrones(E, spec) })) return false;
  const slot = aiFreeSlot(E, spec);
  if (!slot) return false;
  return !!placeBuilding(E, slot, id);
}

function aiOrderUnit(unitId) {
  const E = battle.enemy;
  const factoryId = UNITS[unitId].domain === "air" ? "airFactory" : "navalFactory";
  const factories = E.slots.filter((s) => s.building?.id === factoryId);
  if (!factories.length) return E.slots.some((s) => s.underConstruction?.buildingId === factoryId) ? "wait" : "skip";
  const f = factories.find((s) => !s.building.orderedByScript) || factories[0];
  f.building.unitId = unitId;
  f.building.orderedByScript = true;
  return "ok";
}

// The boss's own "palette": what it opened with is what it keeps coming back to
function aiPalette() {
  const pal = new Set();
  for (const id of battle.boss.openingBuild || []) if (BUILDINGS[id]) pal.add(id);
  return [...pal];
}

function updateEnemyAi(dt) {
  const E = battle.enemy;
  const P = battle.player;

  // Target selection: go for the most dangerous thing on the player's deck
  battle.aiTargetTimer -= dt;
  if (battle.aiTargetTimer <= 0 || (E.target && !E.target.building && !E.target.underConstruction)) {
    battle.aiTargetTimer = 14 + Math.random() * 8;
    const threat = (s) => {
      const id = s.building?.id || s.underConstruction?.buildingId;
      if (!id) return -1;
      const sp = BUILDINGS[id];
      if (id === "nukeLauncher") return 100;
      if (sp.category === "ultraweapons") return 80;
      if (sp.category === "offensive") return 40 + (sp.dmg || 0) / 10;
      if (sp.canProduce) return 30;
      if (id === "shieldGenerator") return 25;
      return 5;
    };
    const ranked = P.slots.filter((s) => threat(s) > 0).sort((a, b) => threat(b) - threat(a));
    E.target = ranked.length && Math.random() < 0.3 + battle.levelNum * 0.015 ? ranked[0] : null;
  }

  // Repair: one idle drone patches up a badly damaged building
  if (E.economy.idleDrones > 0) {
    const hurt = E.slots.find((s) => s.building && s.building.hp < s.building.maxHp * 0.45 && !(s.building.repairing > 0));
    if (hurt && Math.random() < 0.02) startRepair(E, hurt.building);
  }

  battle.aiTimer -= dt;
  if (battle.aiTimer > 0) return;
  battle.aiTimer = battle.aiThink;

  // 1. Scripted opening
  const opening = battle.boss.openingBuild || [];
  if (battle.aiSequenceIndex < opening.length) {
    const next = opening[battle.aiSequenceIndex];
    if (BUILDINGS[next]) {
      if (aiTryBuild(next)) {
        battle.aiSequenceIndex++;
        battle.aiStall = 0;
        return;
      }
      const hasSlot = aiFreeSlot(E, BUILDINGS[next]);
      battle.aiStall += battle.aiThink;
      if (!hasSlot || battle.aiStall > 50) {
        battle.aiSequenceIndex++;
        battle.aiStall = 0;
      }
      return;
    }
    if (UNITS[next]) {
      const r = aiOrderUnit(next);
      if (r === "wait" && battle.aiStall < 60) {
        battle.aiStall += battle.aiThink;
        return;
      }
      battle.aiSequenceIndex++;
      battle.aiStall = 0;
      return;
    }
    battle.aiSequenceIndex++;
  }

  // 2. Grow the drone pool first — drones are everything
  const droneGoal = 6 + Math.floor(battle.levelNum / 5) * 2;
  if (E.economy.maxDrones < droneGoal && aiTryBuild("droneStation")) return;

  const count = (id) => E.slots.filter((s) => (s.building?.id || s.underConstruction?.buildingId) === id).length;
  const factoryCap = battle.levelNum < 6 ? 1 : 2;
  const factories = count("airFactory") + count("navalFactory");
  const support = (id) => BUILDINGS[id].category === "tactical" && id !== "shieldGenerator";
  const capped = (id) =>
    (id === "droneStation" && E.economy.maxDrones >= droneGoal) ||
    (!!BUILDINGS[id]?.canProduce && factories >= factoryCap) ||
    (support(id) && count(id) >= 1) ||
    (id === "shieldGenerator" && count(id) >= 2);

  // 3. Counter what the player is fielding
  const playerUnits = battle.units.filter((u) => !u.isEnemy && u.hp > 0).map((u) => ({ domain: u.spec.domain }));
  const playerBuildings = P.slots.filter((s) => s.building).map((s) => ({ buildingId: s.building.id }));
  const decision = evaluateEnemyAiDecision(playerUnits, playerBuildings);
  for (const id of decision.recommended) if (!capped(id) && aiTryBuild(id)) return;

  // 4. Fill remaining slots: the boss's signature weapons, then generic guns. Economy and
  //    factories are capped so the commander doesn't just stack drone stations.
  const palette = aiPalette().filter((id) => !capped(id));
  const generic = battle.levelNum < 3 ? ["shipTurret", "antiAirTurret", "mortar"] : battle.levelNum < 8 ? ["shipTurret", "antiAirTurret", "artillery", "mortar"] : ["artillery", "samSite", "mortar", "railgun", "shieldGenerator", "rocketLauncher"];
  const unlockedGeneric = generic.filter((id) => !capped(id));
  for (const id of palette.length ? [palette[Math.floor(Math.random() * palette.length)], ...unlockedGeneric] : unlockedGeneric) if (aiTryBuild(id)) return;

  // 5. Idle factories: pick a unit that answers the player's fleet
  for (const s of E.slots) {
    const b = s.building;
    if (!b || !b.spec.canProduce || b.unitId) continue;
    const air = playerUnits.filter((u) => u.domain === "air").length;
    const tier = battle.levelNum < 6 ? 3 : battle.levelNum < 15 ? 4 : 6;
    const pool = b.spec.canProduce.filter((id) => UNITS[id].drones <= Math.min(tier, Math.max(2, E.economy.maxDrones - 2)));
    if (!pool.length) continue;
    b.unitId = b.spec.id === "airFactory" && air >= 2 && pool.includes("fighter") ? "fighter" : pool[Math.min(pool.length - 1, Math.floor(Math.random() * pool.length))];
  }
}

// ─────────────────────────── Fleet helpers ───────────────────────────
function hasBuilding(fleet, id) {
  return fleet.slots.some((s) => s.building && s.building.id === id);
}

function isBuildingActive(fleet, slot) {
  return fleet.economy.activeBuilds.some((b) => b.slotId === slot.id);
}

function fleetIsEnemy(fleet) {
  return fleet === battle.enemy;
}

function onBuildingAdded(fleet, bldg) {
  const spec = bldg.spec;
  if (spec.droneYield) {
    fleet.economy.maxDrones += spec.droneYield;
    fleet.economy.idleDrones += spec.droneYield;
    checkBuildQueue(fleet.economy);
  }
  if (spec.shieldMaxHp) {
    fleet.maxShield += spec.shieldMaxHp;
    fleet.shield = Math.min(fleet.maxShield, fleet.shield + spec.shieldMaxHp);
  }
  if (spec.oneHitWin) bldg.launchTimer = 4.0;
  if (spec.orbitalSweep || spec.bombardmentCount || spec.aircraftDiveBomb) bldg.cooldown = 2.0;
  if (spec.stealthDuration) bldg.cooldown = 0;
  if (spec.canProduce) {
    // Default order: the cheapest unlocked unit (the enemy commander picks its own)
    const pool = fleet.isEnemy ? spec.canProduce : spec.canProduce.filter((id) => saveState.unlockedUnits.includes(id));
    bldg.unitId = fleet.isEnemy ? null : [...pool].sort((a, b) => UNITS[a].drones - UNITS[b].drones || UNITS[a].buildTime - UNITS[b].buildTime)[0] || null;
    bldg.prod = null;
    bldg.rest = 1.5;
  }
}

function onBuildingRemoved(fleet, bldg) {
  const spec = bldg.spec;
  const eco = fleet.economy;
  if (spec.droneYield) {
    eco.maxDrones = Math.max(0, eco.maxDrones - spec.droneYield);
    eco.idleDrones = Math.max(0, eco.idleDrones - spec.droneYield);
  }
  if (spec.shieldMaxHp) {
    fleet.maxShield = Math.max(0, fleet.maxShield - spec.shieldMaxHp);
    fleet.shield = Math.min(fleet.shield, fleet.maxShield);
  }
  if (bldg.repairing > 0) releaseDrones(eco, 1);
  if (bldg.prod) releaseDrones(eco, bldg.prod.drones);
  bldg.prod = null;
  checkBuildQueue(eco);
}

function releaseDrones(eco, n) {
  eco.idleDrones += n;
  eco.assignedDrones = Math.max(0, eco.assignedDrones - n);
}

function completeBuilding(fleet, slotId, buildingId) {
  const slot = fleet.slots.find((s) => s.id === slotId);
  if (!slot || !slot.underConstruction) return;
  const spec = BUILDINGS[buildingId];
  slot.building = { id: buildingId, spec, hp: spec.hp, maxHp: spec.hp, cooldown: 0, repairing: 0, flash: 0, rise: 0 };
  slot.underConstruction = null;
  onBuildingAdded(fleet, slot.building);
  const p = slotPos(fleet, slot);
  burst(p.x, p.y - 12, 10, fleet.isEnemy ? "#ff758f" : "#00f0ff", 70);
  if (!fleet.isEnemy) {
    sfx.done();
    floatText(p.x, p.y - 40, spec.droneYield ? `+${spec.droneYield} DRONES` : `${spec.name.toUpperCase()} ONLINE`, "#9bf6ff");
    renderBuildCards();
  }
}

function removeBuilding(fleet, slot, destroyed) {
  const b = slot.building;
  if (!b) return;
  onBuildingRemoved(fleet, b);
  slot.building = null;
  if (destroyed) {
    const p = slotPos(fleet, slot);
    boom(p.x, p.y - 12, 2.2);
    debris(p.x, p.y - 12, 10);
    if (!fleet.isEnemy) battle.buildingsLost++;
    else floatText(p.x, p.y - 44, `${b.spec.name.toUpperCase()} DESTROYED`, "#ffd166");
  }
  if (fleet.target === slot) fleet.target = null;
  if (battle.player.target === slot && fleet.isEnemy) battle.player.target = null;
  if (contextMenuSlot === slot) closeContextMenu();
}

function cancelConstruction(fleet, slot) {
  const eco = fleet.economy;
  const ai = eco.activeBuilds.findIndex((b) => b.slotId === slot.id);
  if (ai !== -1) {
    releaseDrones(eco, eco.activeBuilds[ai].dronesLocked);
    eco.activeBuilds.splice(ai, 1);
  }
  const qi = eco.queue.findIndex((q) => q.slotId === slot.id);
  if (qi !== -1) eco.queue.splice(qi, 1);
  slot.underConstruction = null;
  checkBuildQueue(eco);
  if (contextMenuSlot === slot) closeContextMenu();
}

function startRepair(fleet, b) {
  const eco = fleet.economy;
  if (eco.idleDrones < 1 || b.repairing > 0 || b.hp >= b.maxHp) return false;
  eco.idleDrones -= 1;
  eco.assignedDrones += 1;
  b.repairing = 5;
  return true;
}

function shieldRechargeDelay(fleet) {
  const gen = fleet.slots.find((s) => s.building && s.building.spec.shieldRechargeDelay);
  return gen ? gen.building.spec.shieldRechargeDelay : 8;
}

// Deal damage to a cruiser. The shield soaks it first; then it lands on the given deck slot, or
// (unless told otherwise) sometimes on a random exposed building, or on the hull itself.
function strikeFleet(fleet, dmg, opts = {}) {
  if (!battle || battle.gameOver || battle.ending || !(dmg > 0)) return;
  if (!fleet.isEnemy && saveState.techTiers.nanocoat) dmg *= 0.95;
  if (opts.shieldBreaker) fleet.shield = 0;
  if (fleet.maxShield > 0) fleet.shieldRechargeDelayTimer = shieldRechargeDelay(fleet);
  if (fleet.shield > 0 && !opts.bypassShield) {
    const absorbed = Math.min(fleet.shield, dmg);
    fleet.shield -= absorbed;
    fleet.shieldFlash = 1;
    dmg -= absorbed;
    if (fleet.shield <= 0) {
      const d = domeOf(fleet);
      ring(d.cx, d.cy - 40, fleet.isEnemy ? "#ff758f" : "#00f0ff", 1.4);
      sfx.boom();
    }
    if (dmg <= 0) return;
  }

  let slot = opts.slot && (opts.slot.building || opts.slot.underConstruction) ? opts.slot : null;
  if (!slot && opts.canHitBuildings === true && !(fleet.cloakTimer > 0)) {
    const exposed = fleet.slots.filter((s) => s.building || (s.underConstruction && isBuildingActive(fleet, s)));
    if (exposed.length && Math.random() < 0.3) slot = exposed[Math.floor(Math.random() * exposed.length)];
  }

  if (slot) {
    if (slot.building) {
      slot.building.hp -= dmg;
      if (slot.building.hp <= 0) removeBuilding(fleet, slot, true);
    } else {
      const uc = slot.underConstruction;
      uc.hp = (uc.hp ?? uc.spec.hp) - dmg;
      if (uc.hp <= 0) {
        const p = slotPos(fleet, slot);
        boom(p.x, p.y - 10, 1.6);
        cancelConstruction(fleet, slot);
      }
    }
    return;
  }
  const reduction = fleet.passive.damageReduction || 0;
  fleet.hull -= dmg * (1 - reduction);
  // Hull fires break out as the armour gives way
  const k = fleet.hull / fleet.maxHull;
  const want = k < 0.25 ? 4 : k < 0.5 ? 3 : k < 0.75 ? 1 : 0;
  while (fleet.fires.length < want) {
    const g = fleet.geom;
    fleet.fires.push({ lx: g.stern + 40 + Math.random() * (g.len - 90), ly: -8 - Math.random() * 18, phase: Math.random() * TAU });
  }
}

function updateShield(fleet, dt) {
  fleet.shieldFlash = Math.max(0, fleet.shieldFlash - dt * 3);
  if (fleet.maxShield <= 0) return;
  if (fleet.shieldRechargeDelayTimer > 0) {
    fleet.shieldRechargeDelayTimer -= dt;
    return;
  }
  let rate = 0;
  for (const s of fleet.slots) if (s.building && s.building.spec.shieldRechargeRate) rate += s.building.spec.shieldRechargeRate;
  if (hasBuilding(fleet, "energyMatrix")) rate *= 1.5;
  if (fleet.passive.shieldRechargeBonus) rate *= 1 + fleet.passive.shieldRechargeBonus;
  if (!fleet.isEnemy) rate *= 1 + (saveState.techTiers.shieldRecharge || 0) * 0.1;
  fleet.shield = Math.min(fleet.maxShield, fleet.shield + rate * dt);
}

// ─────────────────────────── Battle update ───────────────────────────
function updateBattle(dt) {
  if (!battle || isPaused) return;
  const stepDt = dt * speedMultiplier;
  if (stepDt <= 0) return;

  if (battle.ending) {
    updateEnding(stepDt);
    return;
  }
  if (battle.gameOver) return;

  battle.time += stepDt;

  for (const fleet of [battle.player, battle.enemy]) {
    const ecoDt = stepDt * (hasBuilding(fleet, "ultraliskFabrication") ? 2 : 1);
    updateDroneEconomy(fleet.economy, ecoDt, (b) => completeBuilding(fleet, b.slotId, b.buildingId));
    for (const slot of fleet.slots) {
      if (!slot.underConstruction) continue;
      const active = fleet.economy.activeBuilds.find((b) => b.slotId === slot.id);
      if (!active) continue;
      slot.underConstruction.progress = active.progress;
      slot.underConstruction.totalDuration = active.totalDuration;
      slot.underConstruction.isQueued = false;
      if (Math.random() < 5 * stepDt) {
        const p = slotPos(fleet, slot);
        spark(p.x + (Math.random() - 0.5) * 16, p.y - 10 - Math.random() * 14, "#9bf6ff");
      }
    }
    updateShield(fleet, stepDt);
    if (fleet.cloakTimer > 0) fleet.cloakTimer -= stepDt;
  }

  updateNukeWarning();
  updateEnemyAi(stepDt);
  updateCruiserBuildings(battle.player, battle.enemy, stepDt);
  updateCruiserBuildings(battle.enemy, battle.player, stepDt);
  updateUnits(stepDt);
  updateProjectiles(stepDt);
  updateBeams(stepDt);
  updateFx(stepDt);

  if (battle.enemy.hull <= 0) beginEnding(true);
  else if (battle.player.hull <= 0) beginEnding(false);
}

function updateNukeWarning() {
  const nukeWarn = document.getElementById("nuke-warning");
  const enemyNukeSlot = battle.enemy.slots.find((s) => s.underConstruction && s.underConstruction.buildingId === "nukeLauncher");
  const nukeArmed = battle.enemy.slots.some((s) => s.building && s.building.id === "nukeLauncher");
  const uc = enemyNukeSlot?.underConstruction;
  const nukePct = uc && !uc.isQueued ? uc.progress / uc.totalDuration : nukeArmed ? 1 : 0;
  if (nukePct >= 0.8) {
    if (nukeWarn) nukeWarn.style.display = "flex";
    const txt = document.getElementById("nuke-warning-text");
    if (txt) txt.textContent = nukeArmed ? "ICBM ARMED — LAUNCH IMMINENT!" : `STRATEGIC ICBM DETECTED (${Math.floor(nukePct * 100)}% LAUNCH) — NEUTRALIZE SILO IMMEDIATELY!`;
    if (!battle.nukeSirenFired) {
      battle.nukeSirenFired = true;
      playSirenSound();
    }
  } else if (nukeWarn && nukeWarn.style.display !== "none") {
    nukeWarn.style.display = "none";
    battle.nukeSirenFired = false;
  }
}

// Victory/defeat: the losing hull lists, burns and goes under before the debrief
function beginEnding(won) {
  const loser = won ? battle.enemy : battle.player;
  battle.ending = { won, t: 0, loser };
  battle.won = won;
  loser.sinking = 0.001;
  closeContextMenu();
  selectedBuildingId = null;
  renderBuildCards();
  const nukeWarn = document.getElementById("nuke-warning");
  if (nukeWarn) nukeWarn.style.display = "none";
  jumpCameraTo(won ? "enemy" : "player");
  playExplosionSound(1.2, 160, 0.55);
  addShake(12);
}

function updateEnding(dt) {
  const e = battle.ending;
  e.t += dt;
  const L = e.loser;
  L.sinking = e.t;
  L.shield = 0;
  if (Math.random() < 10 * dt && e.t < 3.2) {
    const g = L.geom;
    const p = toWorld(L, g.stern + Math.random() * g.len, -10 - Math.random() * 40);
    boom(p.x, p.y, 1.2 + Math.random() * 1.6);
  }
  updateUnits(dt);
  updateProjectiles(dt);
  updateBeams(dt);
  updateFx(dt);
  if (e.t > 4.2 && !battle.gameOver) handleBattleEnd(e.won);
}

// ─────────────────────────── Weapons ───────────────────────────
function findUnitTarget(isEnemy, x, y, range, domains, skipLowProfile = false) {
  let best = null;
  let bestD = range;
  for (const u of battle.units) {
    if (u.isEnemy === isEnemy || u.hp <= 0 || u.dying) continue;
    if (domains && !domains.includes(u.spec.domain)) continue;
    if (skipLowProfile && u.spec.lowProfile) continue;
    const d = Math.hypot(u.x - x, u.y - y);
    if (d <= bestD) {
      bestD = d;
      best = u;
    }
  }
  return best;
}

function distToFoeHull(isEnemy, sourceX) {
  const span = hullSpan(!isEnemy);
  return isEnemy ? sourceX - span.x1 : span.x0 - sourceX;
}

// Where a shot at the enemy cruiser should land: the owner's chosen target building if there is one
// (and the foe isn't cloaked), otherwise sometimes a random exposed building, otherwise the hull.
function aimAt(owner, foe, randomBuildings = 0.35) {
  const tg = owner.target;
  const cloaked = foe.cloakTimer > 0;
  if (tg && !cloaked && (tg.building || tg.underConstruction)) {
    const p = slotPos(foe, tg);
    return { x: p.x + (Math.random() - 0.5) * 8, y: p.y - 10, slot: tg };
  }
  if (!cloaked && Math.random() < randomBuildings) {
    const exposed = foe.slots.filter((s) => s.building || (s.underConstruction && isBuildingActive(foe, s)));
    if (exposed.length) {
      const s = exposed[Math.floor(Math.random() * exposed.length)];
      const p = slotPos(foe, s);
      return { x: p.x, y: p.y - 10, slot: s };
    }
  }
  const g = foe.geom;
  const lx = g.minX - 40 + Math.random() * (g.maxX - g.minX + 60);
  const p = toWorld(foe, lx, deckYAt(g, lx) * (0.3 + Math.random() * 0.5));
  return { x: p.x, y: p.y, slot: null };
}

function fireShellAt(sourceX, sourceY, target, dmg, isEnemy, opts = {}) {
  battle.projectiles.push({ type: "shell", x: sourceX, y: sourceY, target, speed: opts.speed || 760, dmg, isEnemy, aoe: opts.aoe || 0, color: opts.color });
  muzzle(sourceX, sourceY, isEnemy);
}

// Straight-flying round at a point (railgun slugs, rockets, gunship cannon)
function fireLinear(sx, sy, aim, dmg, isEnemy, opts = {}) {
  const dx = aim.x - sx;
  const dy = aim.y - sy;
  const d = Math.max(1, Math.hypot(dx, dy));
  const speed = opts.speed || 520;
  battle.projectiles.push({
    type: "linear",
    x: sx,
    y: sy,
    vx: (dx / d) * speed,
    vy: (dy / d) * speed,
    dist: d,
    travelled: 0,
    aim,
    dmg,
    isEnemy,
    rocket: !!opts.rocket,
    wobble: opts.rocket ? Math.random() * TAU : 0,
    color: opts.color
  });
  muzzle(sx, sy, isEnemy);
}

// Arcing round at a point (artillery, mortars, warship guns)
function fireArc(sx, sy, aim, dmg, isEnemy, opts = {}) {
  const d = Math.abs(aim.x - sx);
  battle.projectiles.push({
    type: "arc",
    x: sx,
    y: sy,
    startX: sx,
    startY: sy,
    aim,
    arc: opts.arc ?? Math.min(300, 60 + d * 0.16),
    progress: 0,
    speed: opts.speed || Math.max(0.3, 620 / Math.max(300, d)),
    dmg,
    isEnemy,
    aoe: opts.aoe || 0,
    color: opts.color,
    size: opts.size || 1
  });
  muzzle(sx, sy, isEnemy, 1.4);
}

function fireInterval(fleet, slot, spec) {
  let base = spec.fireRate || 1;
  const boosted = fleet.slots.some((s) => s !== slot && s.building && s.building.id === "localBooster" && isAdjacentToBooster(s, slot, 90));
  if (boosted) base *= 0.75;
  const p = fleet.passive;
  if (spec.id === "lasCannon" && p.lasCannonFireBonus) base /= 1 + p.lasCannonFireBonus;
  if (spec.id === "artillery" && p.artilleryFireBonus) base /= 1 + p.artilleryFireBonus;
  if (spec.category === "defensive" && p.turretFireBonus) base /= 1 + p.turretFireBonus;
  return base;
}

function weaponRange(fleet, spec) {
  let r = spec.range || 0;
  if (spec.id === "artillery" && fleet.passive.artilleryRangeBonus) r *= 1 + fleet.passive.artilleryRangeBonus;
  return r;
}

function weaponDmg(fleet, base) {
  return base * (1 + (fleet.passive.weaponDamageBonus || 0));
}

function unitBuildTime(fleet, u) {
  const p = fleet.passive;
  const bonus = u.domain === "air" ? p.airBuildSpeedBonus || 0 : p.navalBuildSpeedBonus || 0;
  return u.buildTime / (1 + bonus) / BUILD_PACE;
}

function updateFactory(fleet, slot, dt) {
  const b = slot.building;
  const eco = fleet.economy;
  if (b.prod) {
    const speed = hasBuilding(fleet, "ultraliskFabrication") ? 2 : 1;
    b.prod.progress += dt * speed;
    if (b.prod.progress >= b.prod.total) {
      releaseDrones(eco, b.prod.drones);
      const p = slotPos(fleet, slot);
      const u = UNITS[b.prod.unitId];
      if (u.domain === "air") spawnUnit(b.prod.unitId, fleet.isEnemy, p.x, p.y - 20);
      else spawnUnit(b.prod.unitId, fleet.isEnemy, p.x + (fleet.isEnemy ? -1 : 1) * (fleet.geom.bowTip - slot.x + 30), WATER_Y);
      if (!fleet.isEnemy) {
        sfx.launch();
        floatText(p.x, p.y - 36, `${u.name.toUpperCase()} LAUNCHED`, "#7CFC00");
      }
      b.prod = null;
      b.rest = fleet.isEnemy ? Math.max(3, 14 - battle.levelNum * 0.4) : 0.6;
      checkBuildQueue(eco);
    }
    return;
  }
  b.rest = Math.max(0, (b.rest || 0) - dt);
  if (!b.unitId || b.rest > 0) return;
  const u = UNITS[b.unitId];
  // Buildings waiting in the queue get drones first
  if (eco.queue.length || eco.idleDrones < u.drones) {
    b.waiting = true;
    return;
  }
  b.waiting = false;
  eco.idleDrones -= u.drones;
  eco.assignedDrones += u.drones;
  b.prod = { unitId: b.unitId, progress: 0, total: unitBuildTime(fleet, u), drones: u.drones };
}

function updateCruiserBuildings(fleet, foe, dt) {
  const isEnemy = fleet.isEnemy;
  for (const slot of fleet.slots) {
    if (!slot.building) continue;
    const bldg = slot.building;
    const spec = bldg.spec;
    bldg.cooldown = Math.max(0, bldg.cooldown - dt);
    bldg.flash = Math.max(0, (bldg.flash || 0) - dt * 6);
    bldg.rise = Math.min(1, (bldg.rise || 0) + dt * 3);

    if (bldg.repairing > 0) {
      bldg.repairing -= dt;
      bldg.hp = Math.min(bldg.maxHp, bldg.hp + bldg.maxHp * 0.2 * (fleet.passive.repairSpeedMultiplier || 1) * dt);
      if (bldg.repairing <= 0 || bldg.hp >= bldg.maxHp) {
        bldg.repairing = 0;
        releaseDrones(fleet.economy, 1);
        checkBuildQueue(fleet.economy);
      }
    }

    // Burning buildings smoke
    if (bldg.hp < bldg.maxHp * 0.5 && Math.random() < dt * (bldg.hp < bldg.maxHp * 0.25 ? 8 : 3)) {
      const p = slotPos(fleet, slot);
      puff(p.x + (Math.random() - 0.5) * 12, p.y - 16, 0.8);
    }

    const src = slotPos(fleet, slot);
    const sourceX = src.x;
    const sourceY = src.y - 14;
    const interval = fireInterval(fleet, slot, spec);

    if (spec.canProduce) {
      updateFactory(fleet, slot, dt);
      continue;
    }

    // Ultraweapons
    if (spec.oneHitWin) {
      if (!bldg.launched) {
        bldg.launchTimer -= dt;
        if (bldg.launchTimer <= 0) {
          bldg.launched = true;
          playSirenSound();
          const d = domeOf(foe);
          battle.projectiles.push({ type: "icbm", x: sourceX, y: sourceY, startX: sourceX, startY: sourceY, targetX: d.cx, targetY: WATER_Y - 30, progress: 0, speed: 0.2, dmg: 0, isEnemy });
        }
      }
      continue;
    }
    if (spec.orbitalSweep) {
      if (bldg.cooldown <= 0) {
        bldg.cooldown = 14;
        const span = hullSpan(!isEnemy);
        battle.beams.push({ sourceX: span.x0, sourceY: -60, targetX: span.x0, targetY: WATER_Y - 20, sweepFrom: span.x0, sweepTo: span.x1, orbital: true, color: isEnemy ? "#ff5964" : "#b388ff", duration: 4.0, elapsed: 0, dps: weaponDmg(fleet, spec.beamDps || 190), shieldBreaker: !!spec.shieldBreaker, isEnemy });
        playLaserSound(1500, 200, 0.6);
      }
      continue;
    }
    if (spec.bombardmentCount) {
      if (bldg.cooldown <= 0) {
        bldg.cooldown = 40;
        const span = hullSpan(!isEnemy);
        for (let r = 0; r < spec.bombardmentCount; r++) {
          battle.projectiles.push({ type: "rod", x: span.x0 + Math.random() * (span.x1 - span.x0), y: -80 - r * 70, vy: 900, dmg: weaponDmg(fleet, spec.bombardmentDmg || 95), isEnemy });
        }
        playArtilleryThud();
      }
      continue;
    }
    if (spec.aircraftDiveBomb) {
      if (bldg.cooldown <= 0) {
        const ownAir = battle.units.filter((u) => u.isEnemy === isEnemy && u.spec.domain === "air" && !u.diving && !u.dying);
        if (ownAir.length) {
          bldg.cooldown = 30;
          ownAir.forEach((u) => (u.diving = true));
          playSirenSound();
        } else bldg.cooldown = 3;
      }
      continue;
    }
    if (spec.stealthDuration) {
      if (bldg.cooldown <= 0) {
        const dur = spec.stealthDuration * (1 + (fleet.passive.stealthDurationBonus || 0));
        bldg.cooldown = (spec.cooldown || 45) + dur;
        fleet.cloakTimer = dur;
      }
      continue;
    }

    // Point defence: shoot down incoming rounds (not the ICBM)
    if (spec.interceptsShells || spec.interceptsMissiles) {
      if (bldg.cooldown <= 0) {
        let best = null;
        let bestD = spec.range || 480;
        for (const p of battle.projectiles) {
          if (p.isEnemy === isEnemy || p.type === "icbm" || p.type === "shell") continue;
          const d = Math.hypot(p.x - sourceX, p.y - sourceY);
          if (d < bestD) {
            bestD = d;
            best = p;
          }
        }
        if (best) {
          bldg.cooldown = interval;
          bldg.flash = 1;
          battle.projectiles.splice(battle.projectiles.indexOf(best), 1);
          battle.beams.push({ sourceX, sourceY, targetX: best.x, targetY: best.y, color: isEnemy ? "#ff758f" : "#9bf6ff", duration: 0.12, elapsed: 0, dps: 0, isEnemy, visualOnly: true });
          burst(best.x, best.y, 6, "#e2e8f0", 60);
          sfx.pop();
        }
      }
      continue;
    }

    if (bldg.cooldown > 0) continue;
    const range = weaponRange(fleet, spec);

    // LasCannon: burns a warship in range, else holds a beam on the target building or hull
    if (spec.id === "lasCannon") {
      const unit = findUnitTarget(isEnemy, sourceX, sourceY, range, ["naval"]);
      if (!unit && distToFoeHull(isEnemy, sourceX) > range) continue;
      bldg.cooldown = interval;
      bldg.flash = 1;
      playLaserSound(1100, 320, 0.3);
      const aim = unit ? null : aimAt(fleet, foe, 0.5);
      battle.beams.push({
        sourceX, sourceY, targetX: unit ? unit.x : aim.x, targetY: unit ? unit.y : aim.y,
        fromSlot: slot, owner: fleet, targetUnit: unit, targetSlot: aim?.slot || null, hullPoint: aim && !aim.slot ? { x: aim.x, y: aim.y } : null,
        color: isEnemy ? "#ff5964" : "#00f0ff", duration: unit ? 1.2 : spec.beamDuration || 5.0, elapsed: 0, dps: weaponDmg(fleet, spec.beamDps || 95), isEnemy
      });
      continue;
    }

    // Bow Ion Cannon: a flat beam along the waterline
    if (spec.id === "ionCannon") {
      bldg.cooldown = interval;
      bldg.flash = 1;
      playTone(340, 0.4, "sawtooth", 0.35);
      battle.beams.push({ fromSlot: slot, owner: fleet, sourceX, sourceY: WATER_Y - 20, targetX: isEnemy ? 0 : WORLD_WIDTH, targetY: WATER_Y - 20, color: isEnemy ? "#ff5964" : "#00f0ff", duration: spec.beamDuration || 4.0, elapsed: 0, dps: weaponDmg(fleet, spec.beamDps || 150), isIonCannon: true, isEnemy });
      continue;
    }

    // Anti-unit turrets (and dual-role guns when a unit is in range)
    const unitDomains = (spec.targets || []).filter((t) => t === "naval" || t === "air");
    const antiUnitOnly = spec.deploysBuoy || (unitDomains.length && !(spec.targets || []).includes("cruiser"));
    const domains = spec.deploysBuoy ? ["naval", "air"] : unitDomains;
    if (domains.length && range) {
      const target = findUnitTarget(isEnemy, sourceX, sourceY, range, domains, !!spec.poorAccuracyVsSmall);
      if (target) {
        bldg.cooldown = interval;
        bldg.flash = 1;
        const dmg = weaponDmg(fleet, spec.dmg || 30);
        if (spec.chainCount) {
          const hit = [target];
          let from = { x: sourceX, y: sourceY };
          let cur = target;
          for (let c = 0; c <= spec.chainCount && cur; c++) {
            battle.beams.push({ sourceX: from.x, sourceY: from.y, targetX: cur.x, targetY: cur.y, color: "#b388ff", duration: 0.18, elapsed: 0, dps: 0, isEnemy, visualOnly: true, jagged: true });
            cur.hp -= dmg;
            from = { x: cur.x, y: cur.y };
            cur = battle.units.find((u) => u.isEnemy !== isEnemy && u.hp > 0 && !u.dying && !hit.includes(u) && Math.hypot(u.x - from.x, u.y - from.y) < 160);
            if (cur) hit.push(cur);
          }
          playTone(260, 0.12, "sawtooth", 0.18);
        } else if (spec.volleyCount) {
          for (let v = 0; v < spec.volleyCount; v++) fireShellAt(sourceX, sourceY - v * 3, target, dmg, isEnemy, { speed: 520 + v * 30 });
          sfx.gun();
        } else if (spec.salvoCount) {
          for (let v = 0; v < spec.salvoCount; v++) fireShellAt(sourceX, sourceY + v * 2, target, dmg, isEnemy, { speed: 620 + v * 25 });
          playArtilleryThud();
        } else {
          fireShellAt(sourceX, sourceY, target, dmg, isEnemy, { aoe: spec.aoeRadius || 0, speed: spec.guided ? 620 : 760 });
          sfx.gun();
        }
        continue;
      }
      if (antiUnitOnly) continue;
    }

    // Siege weapons against the enemy cruiser
    if (!(spec.targets || []).includes("cruiser") || !spec.dmg) continue;
    if (distToFoeHull(isEnemy, sourceX) > range) continue;
    bldg.cooldown = interval;
    bldg.flash = 1;
    const dmg = weaponDmg(fleet, spec.dmg);
    if (spec.ballistic) {
      playArtilleryThud();
      fireArc(sourceX, sourceY, aimAt(fleet, foe), dmg, isEnemy, { arc: 240 + Math.random() * 60, speed: 0.36, aoe: spec.aoeRadius || 0, size: 1.4 });
    } else if (spec.volleyCount) {
      for (let v = 0; v < spec.volleyCount; v++) {
        const aim = aimAt(fleet, foe);
        fireLinear(sourceX, sourceY - 6 + v * 3, { ...aim, x: aim.x + (Math.random() - 0.5) * 30 }, dmg, isEnemy, { speed: 480 + v * 25, rocket: true, color: "#ff9f1c" });
      }
      sfx.gun();
    } else if (spec.salvoCount) {
      const aim = aimAt(fleet, foe);
      for (let v = 0; v < spec.salvoCount; v++) fireLinear(sourceX, sourceY + v * 2, { ...aim, x: aim.x + (Math.random() - 0.5) * 24 }, dmg, isEnemy, { speed: 560 + v * 20 });
      playArtilleryThud();
    } else {
      fireLinear(sourceX, sourceY, aimAt(fleet, foe), dmg, isEnemy, { speed: spec.hypervelocity ? 1700 : 460, color: spec.hypervelocity ? "#9bf6ff" : undefined });
      if (spec.hypervelocity) playLaserSound(420, 90, 0.18);
      else sfx.gun();
    }
  }
}

// ─────────────────────────── Units ───────────────────────────
function spawnUnit(unitId, isEnemy, x, y) {
  const spec = UNITS[unitId];
  if (!spec || !battle) return null;
  const owner = fleetOf(isEnemy);
  const air = spec.domain === "air";
  const hpMult = air && owner.passive.airHpBonus ? 1 + owner.passive.airHpBonus : 1;
  const dir = isEnemy ? -1 : 1;
  const u = {
    uid: ++unitSeq,
    id: unitId,
    spec,
    isEnemy,
    dir,
    x,
    y: air ? y : WATER_Y,
    hp: spec.hp * hpMult,
    maxHp: spec.hp * hpMult,
    cooldown: 0.6 + Math.random() * 0.6,
    vx: air ? dir * spec.speed * 0.4 : 0,
    vy: air ? -60 : 0,
    heading: air ? (isEnemy ? Math.PI + 0.5 : -0.5) : 0,
    alt: WATER_Y + (spec.altitude || -140) + (Math.random() - 0.5) * 50,
    plane: PLANES.has(unitId),
    heli: air && !PLANES.has(unitId),
    phase: Math.random() * TAU,
    orbit: Math.random() * TAU,
    leg: 0,
    bombs: 0,
    dying: 0,
    spin: 0,
    flash: 0
  };
  battle.units.push(u);
  return u;
}

function wrapAngle(a) {
  while (a > Math.PI) a -= TAU;
  while (a < -Math.PI) a += TAU;
  return a;
}

function steerPlane(u, wx, wy, speed, turn, dt) {
  const desired = Math.atan2(wy - u.y, wx - u.x);
  const diff = wrapAngle(desired - u.heading);
  u.heading = wrapAngle(u.heading + Math.max(-turn * dt, Math.min(turn * dt, diff)));
  // Pull up hard near the waves, push down under the ceiling
  if (u.y > WATER_Y - 70) u.heading = wrapAngle(u.heading + (Math.cos(u.heading) >= 0 ? -1 : 1) * turn * dt);
  u.vx = Math.cos(u.heading) * speed;
  u.vy = Math.sin(u.heading) * speed;
  u.x += u.vx * dt;
  u.y = Math.max(SKY_CEIL, Math.min(WATER_Y - 40, u.y + u.vy * dt));
  u.x = Math.max(20, Math.min(WORLD_WIDTH - 20, u.x));
  return Math.abs(diff);
}

function unitFireAtHull(u, owner, foe) {
  const aim = aimAt(owner, foe, 0.4);
  // Belt armour: small-calibre unit fire does 60% against a battlecruiser
  const dmg = weaponDmg(owner, u.spec.dmg || 15) * 0.6;
  const gy = u.y - (u.spec.domain === "naval" ? 10 : 0);
  if (u.spec.domain === "naval") fireArc(u.x + u.dir * 10, gy, aim, dmg, u.isEnemy, { size: u.id === "archonBattleship" ? 1.4 : 0.9 });
  else fireLinear(u.x, u.y + 4, aim, dmg, u.isEnemy, { speed: 700 });
  u.flash = 1;
  sfx.gun();
}

function updateUnits(dt) {
  const t = battle.time;
  for (let i = battle.units.length - 1; i >= 0; i--) {
    const u = battle.units[i];

    // Death: ships settle and sink, aircraft trail smoke into the sea
    if (u.hp <= 0 && !u.dying) {
      u.dying = 0.0001;
      boom(u.x, u.y, u.spec.domain === "naval" ? 1.4 : 1);
      if (u.spec.domain === "air") u.vy = Math.max(u.vy, 20);
    }
    if (u.dying) {
      u.dying += dt;
      if (u.spec.domain === "naval") {
        u.y += (10 + u.dying * 14) * dt;
        u.spin = Math.min(0.5, u.dying * 0.3) * u.dir;
        if (Math.random() < dt * 10) puff(u.x + (Math.random() - 0.5) * 20, u.y - 12, 1);
        if (u.dying > 2.4) battle.units.splice(i, 1);
      } else {
        u.vy += 300 * dt;
        u.x += u.vx * dt;
        u.y += u.vy * dt;
        u.spin += dt * 4 * u.dir;
        if (Math.random() < dt * 30) puff(u.x, u.y, 0.7);
        if (u.y >= WATER_Y - 2) {
          splash(u.x, 1.4);
          battle.units.splice(i, 1);
        }
      }
      continue;
    }

    const owner = fleetOf(u.isEnemy);
    const foe = fleetOf(!u.isEnemy);
    const speedMult = hasBuilding(owner, "controlTower") ? 1.2 : 1.0;
    u.cooldown = Math.max(0, u.cooldown - dt);
    u.flash = Math.max(0, u.flash - dt * 6);
    const span = hullSpan(!u.isEnemy);
    const nearEdge = u.isEnemy ? span.x1 : span.x0;
    const distHull = (nearEdge - u.x) * u.dir;
    const range = u.spec.range || 300;

    // Kamikaze Signal: every aircraft dives onto the enemy deck
    if (u.diving) {
      const g = foe.geom;
      const aim = toWorld(foe, g.mid, deckYAt(g, g.mid) - 10);
      steerPlane(u, aim.x, aim.y, u.spec.speed * 2.2 * speedMult, 3.5, dt);
      if (Math.random() < dt * 20) puff(u.x, u.y, 0.5);
      if (Math.hypot(aim.x - u.x, aim.y - u.y) < 46 || (u.x > span.x0 && u.x < span.x1 && u.y > aim.y - 6)) {
        strikeFleet(foe, weaponDmg(owner, (u.spec.dmg || u.spec.bombDmg || 20) * 3), { slot: nearestSlot(foe, u.x) });
        boom(u.x, u.y, 2.2);
        battle.units.splice(i, 1);
      }
      continue;
    }

    if (u.spec.domain === "naval") {
      // Close to firing range of the hull, engage warships on the way
      const shipT = findUnitTarget(u.isEnemy, u.x, u.y, range, ["naval"]);
      const airT = u.id === "destroyer" || u.id === "archonBattleship" ? findUnitTarget(u.isEnemy, u.x, u.y, range * 0.8, ["air"]) : null;
      const holdForShip = shipT && Math.abs(shipT.x - u.x) < range * 0.75;
      const want = distHull <= range * 0.88 || holdForShip ? 0 : u.dir * u.spec.speed * speedMult;
      u.vx += (want - u.vx) * Math.min(1, dt * 1.1);
      u.x += u.vx * dt;
      u.y = WATER_Y;
      if (u.cooldown <= 0) {
        if (shipT) {
          fireShellAt(u.x + u.dir * 14, u.y - 12, shipT, weaponDmg(owner, u.spec.dmg || 15), u.isEnemy, { speed: 640 });
          u.cooldown = u.spec.fireRate || 1;
          u.flash = 1;
          sfx.gun();
        } else if (airT) {
          fireShellAt(u.x, u.y - 16, airT, weaponDmg(owner, (u.spec.dmg || 15) * 0.6), u.isEnemy, { speed: 800 });
          u.cooldown = u.spec.fireRate || 1;
        } else if (distHull <= range) {
          unitFireAtHull(u, owner, foe);
          u.cooldown = u.spec.fireRate || 1;
        }
      }
      if (Math.abs(u.vx) > 20 && Math.random() < dt * 6) spray(u.x + u.dir * 20, 0.6);
      continue;
    }

    if (u.heli) {
      // Helicopters and gunships advance, then hover and strafe
      const shipT = findUnitTarget(u.isEnemy, u.x, u.y, range, ["naval"]);
      const stop = distHull <= range * 0.8 || (shipT && Math.abs(shipT.x - u.x) < range * 0.7);
      const want = stop ? Math.sin(t * 0.7 + u.phase) * 18 : u.dir * u.spec.speed * speedMult;
      u.vx += (want - u.vx) * Math.min(1, dt * 1.4);
      const wantY = u.alt + Math.sin(t * 1.3 + u.phase) * 8;
      u.vy += ((wantY - u.y) * 2 - u.vy) * Math.min(1, dt * 2);
      u.x += u.vx * dt;
      u.y += u.vy * dt;
      u.heading = Math.max(-0.25, Math.min(0.25, (u.vx / (u.spec.speed || 100)) * 0.2 * u.dir));
      if (u.cooldown <= 0) {
        if (shipT) {
          fireShellAt(u.x + u.dir * 8, u.y + 4, shipT, weaponDmg(owner, u.spec.dmg || 15), u.isEnemy, { speed: 700 });
          u.cooldown = u.spec.fireRate || 1;
          u.flash = 1;
          sfx.gun();
        } else if (distHull <= range) {
          unitFireAtHull(u, owner, foe);
          u.cooldown = u.spec.fireRate || 1;
        }
      }
      continue;
    }

    // Fixed-wing aircraft
    const sp = u.spec.speed * speedMult;
    if (u.id === "fighter") {
      const prey = findUnitTarget(u.isEnemy, u.x, u.y, 1500, ["air"]);
      if (prey) {
        const off = steerPlane(u, prey.x, prey.y, sp, 2.6, dt);
        if (u.cooldown <= 0 && off < 0.5 && Math.hypot(prey.x - u.x, prey.y - u.y) < range) {
          fireShellAt(u.x + Math.cos(u.heading) * 12, u.y + Math.sin(u.heading) * 12, prey, weaponDmg(owner, u.spec.dmg || 20), u.isEnemy, { speed: 900, color: "#fff3b0" });
          u.cooldown = u.spec.fireRate || 0.6;
          sfx.pop();
        }
      } else {
        // Combat air patrol ahead of our own cruiser
        u.orbit += dt * 0.9;
        const cx = owner.x + u.dir * (owner.geom.bowTip + 360);
        const cy = WATER_Y - 250;
        steerPlane(u, cx + Math.cos(u.orbit) * 220, cy + Math.sin(u.orbit) * 70, sp, 2, dt);
      }
    } else if (u.id === "bomber") {
      // Bombing runs: cross the enemy deck, drop a stick of bombs, loop round and come back
      const clampW = (x) => Math.max(80, Math.min(WORLD_WIDTH - 80, x));
      const far = clampW(u.isEnemy ? span.x0 - 300 : span.x1 + 300);
      const near = clampW(u.isEnemy ? span.x1 + 340 : span.x0 - 340);
      const wx = u.leg === 0 ? far : near;
      steerPlane(u, wx, u.alt, sp, 1.25, dt);
      if (Math.abs(u.x - wx) < 90) {
        u.leg ^= 1;
        u.bombs = 0;
      }
      const over = u.x > span.x0 + 30 && u.x < span.x1 - 30;
      if (over && u.cooldown <= 0 && u.bombs < 3) {
        battle.projectiles.push({ type: "bomb", x: u.x, y: u.y + 6, vx: u.vx * 0.85, vy: u.vy * 0.5 + 30, dmg: weaponDmg(owner, (u.spec.bombDmg || 150) * 0.5), isEnemy: u.isEnemy });
        u.bombs++;
        u.cooldown = 0.3;
      }
    } else {
      // Spy plane: high orbit over the enemy
      u.orbit += dt * 0.5;
      const c = domeOf(foe);
      steerPlane(u, c.cx + Math.cos(u.orbit) * 320, u.alt + Math.sin(u.orbit) * 30, sp * 0.8, 1.1, dt);
    }
    if (Math.random() < dt * 12) contrail(u);
  }
}

function nearestSlot(fleet, wx) {
  let best = null;
  let bestD = 34;
  for (const s of fleet.slots) {
    if (!s.building && !s.underConstruction) continue;
    const p = slotPos(fleet, s);
    const d = Math.abs(p.x - wx);
    if (d < bestD) {
      bestD = d;
      best = s;
    }
  }
  return best;
}

// ─────────────────────────── Projectiles ───────────────────────────
function impact(p, foe, x, y, slot, scale = 1) {
  strikeFleet(foe, p.dmg, { slot });
  boom(x, y, scale);
  if (p.aoe) {
    for (const u of battle.units) if (u.isEnemy !== p.isEnemy && !u.dying && Math.hypot(u.x - x, u.y - y) <= p.aoe) u.hp -= p.dmg * 0.5;
  }
}

function shieldHit(p, foe) {
  strikeFleet(foe, p.dmg, {});
  ring(p.x, p.y, foe.isEnemy ? "#ff758f" : "#00f0ff", 0.5);
  burst(p.x, p.y, 5, foe.isEnemy ? "#ff9aa9" : "#9bf6ff", 80);
  sfx.shield();
}

function updateProjectiles(dt) {
  for (let i = battle.projectiles.length - 1; i >= 0; i--) {
    const p = battle.projectiles[i];
    const foe = p.isEnemy ? battle.player : battle.enemy;
    const kill = () => battle.projectiles.splice(i, 1);

    if (p.type === "icbm") {
      p.progress += p.speed * dt;
      const k = Math.min(1, p.progress);
      p.x = p.startX + (p.targetX - p.startX) * k;
      p.y = p.startY + (p.targetY - p.startY) * k - 420 * Math.sin(k * Math.PI);
      if (Math.random() < dt * 30) puff(p.x, p.y, 0.9);
      if (p.progress >= 1) {
        kill();
        boom(p.targetX, p.targetY, 6);
        battle.flashes.push({ x: p.targetX, y: p.targetY, r: 900, life: 0.8, maxLife: 0.8, color: "#fff3b0" });
        playExplosionSound(1.4, 160, 0.6);
        addShake(14);
        foe.shield = 0;
        foe.hull = 0;
      }
    } else if (p.type === "arc") {
      p.progress += p.speed * dt;
      const k = Math.min(1, p.progress);
      const px = p.x;
      const py = p.y;
      p.x = p.startX + (p.aim.x - p.startX) * k;
      p.y = p.startY + (p.aim.y - p.startY) * k - p.arc * Math.sin(k * Math.PI);
      p.ang = Math.atan2(p.y - py, p.x - px);
      if (k > 0.5 && insideDome(foe, p.x, p.y)) {
        kill();
        shieldHit(p, foe);
      } else if (p.progress >= 1) {
        kill();
        impact(p, foe, p.x, p.y, p.aim.slot, p.size > 1.2 ? 1.6 : 1);
      }
    } else if (p.type === "linear") {
      const sx = p.vx * dt;
      const sy = p.vy * dt;
      p.x += sx;
      p.y += sy;
      if (p.rocket) p.y += Math.sin(battle.time * 18 + p.wobble) * 0.6;
      p.travelled += Math.hypot(sx, sy);
      if (insideDome(foe, p.x, p.y) && p.travelled > 60) {
        kill();
        shieldHit(p, foe);
      } else if (p.travelled >= p.dist) {
        kill();
        // Jammer Tower: a share of incoming rockets lose their lock
        if (p.rocket && hasBuilding(foe, "jammerTower") && Math.random() < 0.35) {
          splash(p.x + (Math.random() - 0.5) * 80, 0.5);
          continue;
        }
        impact(p, foe, p.x, p.y, p.aim.slot, 0.9);
      }
    } else if (p.type === "shell") {
      const tg = p.target;
      if (!tg || tg.hp <= 0 || tg.dying || !battle.units.includes(tg)) {
        kill();
        continue;
      }
      const d = Math.hypot(tg.x - p.x, tg.y - p.y);
      const stepLen = p.speed * dt;
      if (d <= Math.max(10, stepLen)) {
        kill();
        tg.hp -= p.dmg;
        if (p.aoe) for (const u of battle.units) if (u !== tg && u.isEnemy === tg.isEnemy && !u.dying && Math.hypot(u.x - tg.x, u.y - tg.y) <= p.aoe) u.hp -= p.dmg * 0.6;
        burst(tg.x, tg.y, p.aoe ? 10 : 5, p.aoe ? "#ffd166" : "#ffb703", 70);
      } else {
        p.x += ((tg.x - p.x) / d) * stepLen;
        p.y += ((tg.y - p.y) / d) * stepLen;
      }
    } else if (p.type === "rod") {
      p.y += p.vy * dt;
      if (insideDome(foe, p.x, p.y)) {
        kill();
        shieldHit(p, foe);
      } else if (p.y >= WATER_Y - 30) {
        kill();
        impact(p, foe, p.x, WATER_Y - 30, nearestSlot(foe, p.x), 1.4);
      }
    } else if (p.type === "bomb") {
      p.vy += 420 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.ang = Math.atan2(p.vy, p.vx);
      const lx = localX(foe, p.x);
      const g = foe.geom;
      if (insideDome(foe, p.x, p.y)) {
        kill();
        shieldHit(p, foe);
      } else if (lx > g.stern && lx < g.bowTip && p.y >= toWorld(foe, lx, deckYAt(g, lx)).y - 4) {
        kill();
        impact(p, foe, p.x, p.y, nearestSlot(foe, p.x), 1.5);
      } else if (p.y >= WATER_Y) {
        kill();
        splash(p.x, 1.2);
      }
    }
  }
}

function updateBeams(dt) {
  for (let i = battle.beams.length - 1; i >= 0; i--) {
    const b = battle.beams[i];
    b.elapsed += dt;
    const targetFleet = b.isEnemy ? battle.player : battle.enemy;
    // Beams stay pinned to the turret that fires them as the hull rolls
    if (b.fromSlot && b.owner) {
      if (!b.fromSlot.building) {
        battle.beams.splice(i, 1);
        continue;
      }
      const s = slotPos(b.owner, b.fromSlot);
      b.sourceX = s.x;
      if (!b.isIonCannon) b.sourceY = s.y - 14;
    }

    if (!b.visualOnly && b.dps > 0 && !battle.ending) {
      if (b.isIonCannon) {
        strikeFleet(targetFleet, b.dps * dt, {});
        for (const u of battle.units) if (u.isEnemy !== b.isEnemy && !u.dying && u.spec.domain === "naval" && canIonCannonHitTarget(u.spec)) u.hp -= b.dps * dt;
        const span = hullSpan(!b.isEnemy);
        b.targetX = b.isEnemy ? span.x1 - 20 : span.x0 + 20;
      } else if (b.orbital) {
        const k = Math.min(1, b.elapsed / b.duration);
        b.sourceX = b.targetX = b.sweepFrom + (b.sweepTo - b.sweepFrom) * k;
        strikeFleet(targetFleet, b.dps * dt, { shieldBreaker: b.shieldBreaker && !b.brokeShield, slot: nearestSlot(targetFleet, b.targetX) });
        b.brokeShield = true;
      } else if (b.targetUnit) {
        const u = b.targetUnit;
        if (u.hp <= 0 || u.dying || !battle.units.includes(u)) {
          battle.beams.splice(i, 1);
          continue;
        }
        b.targetX = u.x;
        b.targetY = u.y;
        u.hp -= b.dps * dt;
      } else {
        if (b.targetSlot && !b.targetSlot.building && !b.targetSlot.underConstruction) b.targetSlot = null;
        if (targetFleet.shield > 0) {
          // The beam splashes on the dome
          const d = domeOf(targetFleet);
          const toward = Math.atan2(b.sourceY - d.cy, b.sourceX - d.cx);
          b.targetX = d.cx + Math.cos(toward) * d.a * 0.98;
          b.targetY = Math.min(d.cy, d.cy + Math.sin(toward) * d.b * 0.98);
          targetFleet.shieldFlash = 1;
        } else if (b.targetSlot) {
          const tp = slotPos(targetFleet, b.targetSlot);
          b.targetX = tp.x;
          b.targetY = tp.y - 12;
        } else if (b.hullPoint) {
          b.targetX = b.hullPoint.x;
          b.targetY = b.hullPoint.y;
        }
        strikeFleet(targetFleet, b.dps * dt, b.targetSlot ? { slot: b.targetSlot } : {});
        if (Math.random() < dt * 20) spark(b.targetX, b.targetY, b.color);
      }
    }
    if (b.elapsed >= b.duration) battle.beams.splice(i, 1);
  }
}

// ─────────────────────────── FX ───────────────────────────
const MAX_PARTICLES = 900;
function pushParticle(p) {
  if (battle.particles.length < MAX_PARTICLES) battle.particles.push(p);
}

function burst(x, y, count, color, speed = 80) {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * TAU;
    const s = speed * (0.25 + Math.random());
    pushParticle({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 20, life: 0.35 + Math.random() * 0.45, maxLife: 0.8, size: 1.5 + Math.random() * 3.5, color, g: 60 });
  }
}

function spark(x, y, color) {
  pushParticle({ x, y, vx: (Math.random() - 0.5) * 80, vy: -Math.random() * 60, life: 0.3, maxLife: 0.3, size: 1.5, color, g: 200 });
}

function puff(x, y, scale = 1) {
  if (battle.smoke.length > 260) return;
  battle.smoke.push({ x, y, vx: 6 + Math.random() * 8, vy: -14 - Math.random() * 14, r: (4 + Math.random() * 4) * scale, grow: 8 * scale, life: 1.6 + Math.random() * 1.2, maxLife: 2.8, dark: 0.35 + Math.random() * 0.2 });
}

function contrail(u) {
  if (battle.smoke.length > 260) return;
  battle.smoke.push({ x: u.x - Math.cos(u.heading) * 14, y: u.y - Math.sin(u.heading) * 14, vx: 0, vy: -2, r: 1.5, grow: 3, life: 0.8, maxLife: 0.8, dark: -0.18 });
}

function ring(x, y, color, scale = 1) {
  battle.ripples.push({ x, y, r: 6, grow: 260 * scale, life: 0.5, maxLife: 0.5, color });
}

function debris(x, y, n) {
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.2;
    const s = 90 + Math.random() * 160;
    pushParticle({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 1 + Math.random() * 0.6, maxLife: 1.6, size: 2 + Math.random() * 2, color: "#3a3f47", g: 380, chunk: true });
  }
}

function splash(x, scale = 1) {
  for (let i = 0; i < 10 * scale; i++) {
    pushParticle({ x: x + (Math.random() - 0.5) * 16 * scale, y: WATER_Y - 2, vx: (Math.random() - 0.5) * 60 * scale, vy: -80 - Math.random() * 140 * scale, life: 0.6 + Math.random() * 0.4, maxLife: 1, size: 2 + Math.random() * 2 * scale, color: "#cfefff", g: 420 });
  }
  battle.ripples.push({ x, y: WATER_Y, r: 4, grow: 90 * scale, life: 0.6, maxLife: 0.6, color: "#cfefff", flat: true });
  sfx.splash();
}

function spray(x, scale) {
  pushParticle({ x, y: WATER_Y - 3, vx: (Math.random() - 0.5) * 30, vy: -30 - Math.random() * 30, life: 0.4, maxLife: 0.4, size: 1.5 * scale + 1, color: "#dff6ff", g: 200 });
}

function muzzle(x, y, isEnemy, scale = 1) {
  battle.flashes.push({ x, y, r: 16 * scale, life: 0.09, maxLife: 0.09, color: isEnemy ? "#ffb4a2" : "#fff3b0" });
}

function boom(x, y, scale = 1) {
  burst(x, y, Math.round(8 * scale), "#ffb703", 70 + 40 * scale);
  burst(x, y, Math.round(5 * scale), "#ff5f3c", 50 + 30 * scale);
  battle.flashes.push({ x, y, r: 30 * scale, life: 0.22, maxLife: 0.22, color: "#ffd8a0" });
  for (let k = 0; k < Math.ceil(scale * 1.5); k++) puff(x + (Math.random() - 0.5) * 14 * scale, y - 4, 0.8 + scale * 0.3);
  if (y > WATER_Y - 12) splash(x, Math.min(1.5, scale * 0.6));
  if (scale >= 1.6) {
    sfx.boom(scale >= 3);
    addShake(scale * 1.5, x);
  } else sfx.boom();
}

function floatText(x, y, text, color) {
  battle.texts.push({ x, y, text, color, life: 1.8, maxLife: 1.8 });
}

function updateFx(dt) {
  for (let i = battle.particles.length - 1; i >= 0; i--) {
    const p = battle.particles[i];
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += (p.g ?? 40) * dt;
    if (p.chunk && p.y > WATER_Y) {
      p.life = 0;
      if (Math.random() < 0.5) spray(p.x, 0.8);
    }
    if (p.life <= 0) battle.particles.splice(i, 1);
  }
  for (let i = battle.smoke.length - 1; i >= 0; i--) {
    const s = battle.smoke[i];
    s.life -= dt;
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    s.r += s.grow * dt;
    if (s.life <= 0) battle.smoke.splice(i, 1);
  }
  for (const list of [battle.flashes, battle.ripples, battle.texts]) {
    for (let i = list.length - 1; i >= 0; i--) {
      const f = list[i];
      f.life -= dt;
      if (f.grow) f.r += f.grow * dt;
      if (f.text) f.y -= 22 * dt;
      if (f.life <= 0) list.splice(i, 1);
    }
  }
  if (battle.toast) {
    battle.toast.life -= dt;
    if (battle.toast.life <= 0) battle.toast = null;
  }
  // Hull fires
  for (const f of [battle.player, battle.enemy]) {
    for (const fire of f.fires) {
      if (Math.random() < dt * 5) {
        const p = toWorld(f, fire.lx, fire.ly);
        puff(p.x, p.y - 4, 1.1);
      }
    }
  }
}

// ─────────────────────────── Results ───────────────────────────
function handleBattleEnd(won) {
  battle.gameOver = true;
  battle.won = won;
  const modal = document.getElementById("result-modal");
  const titleEl = document.getElementById("result-title");
  const starsEl = document.getElementById("result-stars");
  const timeEl = document.getElementById("result-time");
  const parEl = document.getElementById("result-par");
  const scrapEl = document.getElementById("result-scrap");
  const unlockEl = document.getElementById("result-unlock");

  const elapsed = Math.floor(battle.time);
  const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  const par = battle.campaignLvl ? battle.campaignLvl.parTime : 180;
  const baseScrap = battle.campaignLvl ? battle.campaignLvl.scrapReward : 100;
  const scrapWon = Math.round(baseScrap * (battle.mode === "skirmish" ? 0.5 : battle.mode === "bossrush" ? 1.5 : 1));

  if (won) {
    playTone(523, 0.15, "triangle", 0.4);
    setTimeout(() => playTone(659, 0.15, "triangle", 0.4), 160);
    setTimeout(() => playTone(784, 0.35, "triangle", 0.45), 320);
    const stars = calculateStars(true, elapsed, par, battle.buildingsLost);
    const key = String(battle.levelNum);
    const prevBest = battle.mode === "campaign" ? Number(saveState.levelStars[key]) || 0 : stars;
    if (battle.mode === "campaign" && stars > prevBest) {
      saveState.stars += stars - prevBest;
      saveState.levelStars[key] = stars;
    }
    saveState.scrap += scrapWon;
    if (titleEl) {
      titleEl.className = "ic-result-title ic-result-title--win";
      titleEl.textContent = "SECTOR SECURED";
    }
    if (starsEl) starsEl.innerHTML = [1, 2, 3].map((n) => `<span class="ic-star ${stars >= n ? "awarded" : ""}">★</span>`).join("");
    if (unlockEl) unlockEl.textContent = battle.mode === "campaign" ? "" : `${battle.mode.toUpperCase()} VICTORY`;
    if (battle.mode === "campaign" && battle.campaignLvl && battle.campaignLvl.unlock) {
      const unl = battle.campaignLvl.unlock;
      const bucket = unl.type === "cruiser" ? saveState.unlockedCruisers : unl.type === "building" ? saveState.unlockedBuildings : saveState.unlockedUnits;
      if (!bucket.includes(unl.id)) bucket.push(unl.id);
      if (unlockEl) unlockEl.textContent = `UNLOCKED: ${unl.name.toUpperCase()}`;
    }
    if (battle.mode === "campaign" && saveState.campaignLevel <= battle.levelNum) saveState.campaignLevel = Math.min(CAMPAIGN_LEVELS.length, battle.levelNum + 1);
    persistSave();
  } else {
    playExplosionSound(0.6, 120);
    if (titleEl) {
      titleEl.className = "ic-result-title ic-result-title--lose";
      titleEl.textContent = "HULL BREACHED // DEFEAT";
    }
    if (starsEl) starsEl.innerHTML = `<span class="ic-star">★</span><span class="ic-star">★</span><span class="ic-star">★</span>`;
    if (unlockEl) unlockEl.textContent = "NO RECOVERED SALVAGE";
  }
  if (timeEl) timeEl.textContent = fmt(elapsed);
  if (parEl) parEl.textContent = fmt(par);
  if (scrapEl) scrapEl.textContent = won ? `+${scrapWon}` : "+0";
  const nextBtn = document.getElementById("btn-result-next");
  if (nextBtn) {
    const hasNext = won && battle.levelNum < CAMPAIGN_LEVELS.length && battle.levelNum + 1 <= saveState.campaignLevel;
    nextBtn.disabled = !hasNext;
    nextBtn.textContent = battle.levelNum >= CAMPAIGN_LEVELS.length && won ? "CAMPAIGN COMPLETE" : "NEXT SECTOR";
  }
  closeContextMenu();
  if (modal) modal.style.display = "flex";
  updateHUD(true);
}

// ─────────────────────────── Rendering ───────────────────────────
const PAL = {
  player: { hi: "#58728f", mid: "#34465c", lo: "#141d29", deck: "#6c7f95", trim: "#4aa8ff", rim: "#ffb27a", glass: "rgba(255, 214, 112, 0.9)" },
  enemy: { hi: "#6d4450", mid: "#432a33", lo: "#1a0d12", deck: "#806068", trim: "#ff5964", rim: "#ffb27a", glass: "rgba(255, 140, 150, 0.9)" }
};

let backdrop = null;
function render(ctx, now) {
  const canvas = ctx.canvas;
  const W = canvas.width;
  const H = canvas.height;
  const t = now / 1000;
  if (!backdrop) backdrop = createBackdrop(WORLD_WIDTH, W / 0.45);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, W, H);

  const shx = camera.shake ? (Math.random() - 0.5) * camera.shake : 0;
  const shy = camera.shake ? (Math.random() - 0.5) * camera.shake : 0;
  const cam = { x: camera.x + shx / camera.zoom, y: camera.y + shy / camera.zoom, zoom: camera.zoom };
  const sunX = drawBackdrop(ctx, backdrop, cam, W, H, WATER_Y, t);
  const toWorldCtx = () => ctx.setTransform(cam.zoom, 0, 0, cam.zoom, -cam.x * cam.zoom, -cam.y * cam.zoom);

  toWorldCtx();
  drawBirds(ctx, WORLD_WIDTH, t);
  if (battle) {
    for (const f of [battle.player, battle.enemy]) updatePose(f, t);
    drawSmoke(ctx, true);
    drawCruiser(ctx, battle.player, t);
    drawCruiser(ctx, battle.enemy, t);
    const naval = battle.units.filter((u) => u.spec.domain === "naval").sort((a, b) => b.maxHp - a.maxHp);
    for (const u of naval) drawUnit(ctx, u, t);
  }

  // Sea surface (screen space) laps over the keels
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  drawSea(ctx, cam, W, H, WATER_Y, sunX, t);

  toWorldCtx();
  if (battle) {
    drawReflection(ctx, battle.player);
    drawReflection(ctx, battle.enemy);
    drawWaterline(ctx, battle.player, t);
    drawWaterline(ctx, battle.enemy, t);
    for (const r of battle.ripples) if (r.flat) drawRipple(ctx, r);
    drawShield(ctx, battle.player, t);
    drawShield(ctx, battle.enemy, t);
    drawBuilderDrones(ctx, battle.player, t);
    drawBuilderDrones(ctx, battle.enemy, t);
    drawSmoke(ctx, false);
    for (const u of battle.units) if (u.spec.domain !== "naval") drawUnit(ctx, u, t);
    for (const p of battle.projectiles) drawProjectile(ctx, p, t);
    for (const b of battle.beams) drawBeamArt(ctx, b, t);
    drawParticles(ctx, battle.particles);
    drawFlashes(ctx);
    for (const r of battle.ripples) if (!r.flat) drawRipple(ctx, r);
    drawTargeting(ctx, t);
    drawTexts(ctx);
  }

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  vignette(ctx, W, H, 0.45);
  if (battle) {
    drawMinimap(ctx, W, t);
    drawToast(ctx, W, H);
    if (isPaused && !battle.gameOver) drawPausedTag(ctx, W, H);
  }
  scanlines(ctx, W, H, 0.035);
  ctx.restore();
}

function polyPath(ctx, pts) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
}

function drawCruiser(ctx, fleet, t) {
  const g = fleet.geom;
  const pal = fleet.isEnemy ? PAL.enemy : PAL.player;
  ctx.save();
  applyHullTransform(ctx, fleet);
  if (fleet.cloakTimer > 0) ctx.globalAlpha = 0.45 + Math.sin(t * 8) * 0.08;

  // ── Back layer: masts, pylons, bridge and funnel ──
  for (const s of fleet.slots) {
    const dY = deckYAt(g, s.x);
    if (s.type === "mast") drawMastTruss(ctx, s.x, dY, s.y, pal);
    else if (s.type === "platform") drawPylon(ctx, s.x, dY, s.y, pal);
  }
  drawBridge(ctx, g, pal, t, fleet);

  // ── Hull ──
  polyPath(ctx, g.poly);
  const hg = ctx.createLinearGradient(0, -46, 0, 22);
  hg.addColorStop(0, pal.hi);
  hg.addColorStop(0.35, pal.mid);
  hg.addColorStop(1, pal.lo);
  ctx.fillStyle = hg;
  ctx.fill();
  ctx.save();
  polyPath(ctx, g.poly);
  ctx.clip();
  // Boot-top and anti-fouling
  ctx.fillStyle = "#0a0a0c";
  ctx.fillRect(g.stern - 10, -3, g.len + 20, 4);
  ctx.fillStyle = "#7a1f22";
  ctx.fillRect(g.stern - 10, 1, g.len + 20, 22);
  // Armour belt plating
  ctx.strokeStyle = "rgba(0,0,0,0.28)";
  ctx.lineWidth = 1;
  for (let y = -30; y < -3; y += 9) {
    ctx.beginPath();
    ctx.moveTo(g.stern, y);
    ctx.lineTo(g.bowTip, y);
    ctx.stroke();
  }
  for (let x = g.stern + 20; x < g.bowTip; x += 34) {
    ctx.beginPath();
    ctx.moveTo(x, -50);
    ctx.lineTo(x + 2, -3);
    ctx.stroke();
  }
  ctx.fillStyle = "rgba(255,255,255,0.10)";
  for (let x = g.stern + 6; x < g.bowTip; x += 8) for (let y = -26; y < -4; y += 9) ctx.fillRect(x, y, 1, 1);
  // Portholes along the belt, skipping the utility sponsons
  ctx.fillStyle = pal.glass;
  for (let x = g.stern + 30; x < g.bowTip - 30; x += 22) {
    if (fleet.slots.some((s) => s.type === "utility" && Math.abs(s.x - x) < 16)) continue;
    ctx.fillRect(x, -9, 3, 3);
  }
  // Sunset rim light from the west (the enemy's lit side is its stern)
  const rim = ctx.createLinearGradient(0, -50, 0, -20);
  rim.addColorStop(0, rgba(pal.rim, 0.22));
  rim.addColorStop(1, rgba(pal.rim, 0));
  ctx.fillStyle = rim;
  ctx.fillRect(g.stern, -50, g.len, 30);
  // Hull number
  ctx.fillStyle = "rgba(255,255,255,0.65)";
  ctx.font = "bold 11px monospace";
  ctx.textAlign = "left";
  ctx.save();
  ctx.translate(g.bowTip - 78, -14);
  if (fleet.isEnemy) ctx.scale(-1, 1);
  ctx.fillText(fleet.isEnemy ? "BX-9" : "IC-01", fleet.isEnemy ? -30 : 0, 0);
  ctx.restore();
  ctx.restore();

  // Deck edge + rail
  ctx.strokeStyle = pal.deck;
  ctx.lineWidth = 2;
  ctx.beginPath();
  g.deck.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.stroke();
  ctx.strokeStyle = rgba(pal.rim, 0.5);
  ctx.lineWidth = 1;
  ctx.beginPath();
  g.deck.forEach(([x, y], i) => (i ? ctx.lineTo(x, y - 1) : ctx.moveTo(x, y - 1)));
  ctx.stroke();
  ctx.strokeStyle = "rgba(200, 210, 225, 0.28)";
  ctx.beginPath();
  for (let x = g.stern + 6; x < g.bowTip - 20; x += 10) {
    const y = deckYAt(g, x);
    ctx.moveTo(x, y);
    ctx.lineTo(x, y - 5);
  }
  ctx.stroke();
  // Anchor and hawse
  ctx.fillStyle = "#0d1117";
  ctx.fillRect(g.bowTip - 34, -22, 5, 4);
  ctx.fillStyle = "#9aa3ae";
  ctx.fillRect(g.bowTip - 33, -18, 2, 8);

  // Hull fires
  for (const f of fleet.fires) {
    const fl = 0.7 + Math.sin(t * 13 + f.phase) * 0.3;
    glow(ctx, f.lx, f.ly, 16 * fl, "#ff7b2e", 0.55);
    ctx.fillStyle = `rgba(255, 210, 120, ${0.8 * fl})`;
    ctx.fillRect(f.lx - 2, f.ly - 5 * fl, 4, 6 * fl);
  }

  // ── Slots & buildings ──
  for (const slot of fleet.slots) drawSlot(ctx, fleet, slot, t);
  ctx.restore();
}

function drawMastTruss(ctx, x, deckY, topY, pal) {
  ctx.strokeStyle = shade(pal.mid, -0.2);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x - 7, deckY);
  ctx.lineTo(x - 2, topY + 3);
  ctx.moveTo(x + 7, deckY);
  ctx.lineTo(x + 2, topY + 3);
  ctx.stroke();
  ctx.lineWidth = 1;
  ctx.beginPath();
  const n = Math.max(2, Math.floor((deckY - topY) / 12));
  for (let i = 0; i < n; i++) {
    const y0 = deckY - ((deckY - topY) * i) / n;
    const y1 = deckY - ((deckY - topY) * (i + 1)) / n;
    const w0 = 7 - (5 * i) / n;
    const w1 = 7 - (5 * (i + 1)) / n;
    ctx.moveTo(x - w0, y0);
    ctx.lineTo(x + w1, y1);
    ctx.moveTo(x + w0, y0);
    ctx.lineTo(x - w1, y1);
  }
  ctx.stroke();
  ctx.fillStyle = pal.hi;
  ctx.fillRect(x - 12, topY + 1, 24, 3);
  ctx.fillStyle = "rgba(0,0,0,0.4)";
  ctx.fillRect(x - 12, topY + 4, 24, 1);
}

function drawPylon(ctx, x, deckY, topY, pal) {
  ctx.fillStyle = shade(pal.mid, -0.15);
  ctx.fillRect(x - 5, topY + 3, 10, deckY - topY - 3);
  ctx.fillStyle = "rgba(255,255,255,0.08)";
  ctx.fillRect(x - 5, topY + 3, 2, deckY - topY - 3);
  ctx.strokeStyle = shade(pal.mid, -0.3);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x - 16, topY + 4);
  ctx.lineTo(x - 4, topY + 16);
  ctx.moveTo(x + 16, topY + 4);
  ctx.lineTo(x + 4, topY + 16);
  ctx.stroke();
  ctx.fillStyle = pal.hi;
  ctx.fillRect(x - 18, topY + 1, 36, 4);
  ctx.fillStyle = "#e0b33a";
  for (let k = -16; k < 16; k += 6) ctx.fillRect(x + k, topY + 1, 3, 1);
}

function drawBridge(ctx, g, pal, t, fleet) {
  const { x0, x1 } = g.bridge;
  const w = x1 - x0;
  const base = deckYAt(g, (x0 + x1) / 2);
  // Funnel + smoke
  const fx = x0 + w * 0.08;
  if (!fleet.sinking) {
    for (let i = 0; i < 5; i++) {
      const age = (t * 0.5 + i / 5) % 1;
      ctx.fillStyle = `rgba(36, 34, 42, ${0.3 * (1 - age)})`;
      ctx.beginPath();
      ctx.arc(fx + 8 - age * 50, base - 62 - age * 60, 6 + age * 16, 0, TAU);
      ctx.fill();
    }
  }
  ctx.fillStyle = pal.lo;
  ctx.fillRect(fx - 1, base - 60, 20, 60);
  ctx.fillStyle = pal.mid;
  ctx.fillRect(fx, base - 58, 18, 58);
  ctx.fillStyle = pal.trim;
  ctx.fillRect(fx, base - 52, 18, 4);
  ctx.fillStyle = "#0b0b0e";
  ctx.fillRect(fx + 1, base - 62, 16, 4);
  // Tiered superstructure
  const tier = (tx, ty, tw, th, shadeAmt) => {
    ctx.fillStyle = pal.lo;
    ctx.fillRect(tx - 1, ty - 1, tw + 2, th + 1);
    const gr = ctx.createLinearGradient(0, ty, 0, ty + th);
    gr.addColorStop(0, shade(pal.hi, shadeAmt));
    gr.addColorStop(1, shade(pal.mid, shadeAmt - 0.1));
    ctx.fillStyle = gr;
    ctx.fillRect(tx, ty, tw, th);
    ctx.fillStyle = rgba(pal.rim, 0.35);
    ctx.fillRect(tx, ty, tw, 1.5);
  };
  tier(x0 + w * 0.16, base - 26, w * 0.84, 26, 0);
  tier(x0 + w * 0.3, base - 46, w * 0.6, 20, 0.05);
  tier(x0 + w * 0.42, base - 62, w * 0.42, 16, 0.1);
  ctx.fillStyle = pal.glass;
  for (let wx = x0 + w * 0.45; wx < x0 + w * 0.82; wx += 7) ctx.fillRect(wx, base - 57, 4, 3);
  for (let wx = x0 + w * 0.2; wx < x0 + w * 0.98; wx += 9) ctx.fillRect(wx, base - 16, 4, 2);
  for (let wx = x0 + w * 0.34; wx < x0 + w * 0.88; wx += 9) ctx.fillRect(wx, base - 36, 4, 2);
  // Radar mast
  const mx = x0 + w * 0.62;
  ctx.fillStyle = "#8a97b1";
  ctx.fillRect(mx, base - 96, 2, 34);
  ctx.fillRect(mx - 9, base - 84, 20, 2);
  const radar = Math.cos(t * 2.5);
  ctx.fillStyle = "#c9d6e6";
  ctx.fillRect(mx + 1 - 10 * Math.abs(radar), base - 99, 20 * Math.abs(radar) + 1, 3);
  ctx.fillStyle = Math.sin(t * 4) > 0 ? "#ff3344" : "#401015";
  ctx.fillRect(mx, base - 99, 2, 2);
  // Ensign at the stern
  const sx = g.stern + 8;
  ctx.fillStyle = "#8a97b1";
  ctx.fillRect(sx, base - 44, 1.5, 40);
  ctx.fillStyle = pal.trim;
  ctx.beginPath();
  ctx.moveTo(sx + 1.5, base - 44);
  for (let k = 0; k <= 4; k++) ctx.lineTo(sx + 1.5 - k * 4, base - 44 + Math.sin(t * 5 + k) * 1.5);
  ctx.lineTo(sx + 1.5 - 16, base - 34 + Math.sin(t * 5 + 4) * 1.5);
  ctx.lineTo(sx + 1.5, base - 34);
  ctx.fill();
}

function drawSlot(ctx, fleet, slot, t) {
  const armed = !fleet.isEnemy && selectedBuildingId && BUILDINGS[selectedBuildingId]?.allowedSlots.includes(slot.type);
  const empty = !slot.building && !slot.underConstruction;
  const hovered = battle.hover && battle.hover.slot === slot;

  if (slot.type === "utility") {
    // Sponson recess on the hull side
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(slot.x - 13, slot.y - 5, 26, 10);
    ctx.fillStyle = "rgba(255,255,255,0.1)";
    ctx.fillRect(slot.x - 13, slot.y + 4, 26, 1);
  }
  if (empty) {
    if (armed) {
      const pulse = 0.5 + Math.sin(t * 6) * 0.25;
      ctx.fillStyle = `rgba(0, 240, 255, ${0.18 + pulse * 0.2})`;
      ctx.strokeStyle = "#00f0ff";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(slot.x - 13, slot.y - 22, 26, 22, 3) : ctx.rect(slot.x - 13, slot.y - 22, 26, 22);
      ctx.fill();
      ctx.stroke();
      ctx.save();
      ctx.translate(slot.x, slot.y - 26);
      if (fleet.isEnemy) ctx.scale(-1, 1);
      ctx.fillStyle = "#9bf6ff";
      ctx.font = "bold 7px monospace";
      ctx.textAlign = "center";
      ctx.fillText(slot.type.toUpperCase(), 0, 0);
      ctx.restore();
    } else {
      ctx.fillStyle = "rgba(10, 16, 24, 0.6)";
      ctx.fillRect(slot.x - 8, slot.y - 3, 16, 4);
      ctx.fillStyle = "rgba(160, 180, 200, 0.28)";
      ctx.fillRect(slot.x - 8, slot.y - 3, 16, 1);
      ctx.fillRect(slot.x - 1, slot.y - 2, 2, 2);
    }
    if (hovered && !fleet.isEnemy) {
      ctx.strokeStyle = "rgba(255,255,255,0.6)";
      ctx.strokeRect(slot.x - 14, slot.y - 23, 28, 24);
    }
    return;
  }

  if (slot.underConstruction) {
    const uc = slot.underConstruction;
    const pct = Math.min(1, uc.progress / uc.totalDuration);
    const col = fleet.isEnemy ? "#ff758f" : "#00f0ff";
    // Ghost of the finished building, filling up from the deck
    ctx.save();
    ctx.globalAlpha *= 0.28;
    ctx.translate(slot.x, slot.y);
    drawBuildingArt(ctx, uc.buildingId, fleet.isEnemy, t);
    ctx.restore();
    ctx.save();
    ctx.beginPath();
    ctx.rect(slot.x - 30, slot.y - 60 * pct, 60, 60 * pct + 2);
    ctx.clip();
    ctx.globalAlpha *= 0.9;
    ctx.translate(slot.x, slot.y);
    drawBuildingArt(ctx, uc.buildingId, fleet.isEnemy, t);
    ctx.restore();
    // Scaffold
    ctx.strokeStyle = rgba(col, 0.75);
    ctx.lineWidth = 1;
    ctx.strokeRect(slot.x - 15, slot.y - 30, 30, 30);
    ctx.beginPath();
    ctx.moveTo(slot.x - 15, slot.y);
    ctx.lineTo(slot.x + 15, slot.y - 30);
    ctx.moveTo(slot.x + 15, slot.y);
    ctx.lineTo(slot.x - 15, slot.y - 30);
    ctx.stroke();
    ctx.fillStyle = "rgba(0,0,0,0.7)";
    ctx.fillRect(slot.x - 15, slot.y - 37, 30, 4);
    ctx.fillStyle = uc.isQueued ? "#ffb703" : col;
    ctx.fillRect(slot.x - 15, slot.y - 37, 30 * pct, 4);
    if (uc.isQueued) {
      ctx.save();
      ctx.translate(slot.x, slot.y - 42);
      if (fleet.isEnemy) ctx.scale(-1, 1);
      ctx.fillStyle = "#ffb703";
      ctx.font = "bold 7px monospace";
      ctx.textAlign = "center";
      ctx.fillText("QUEUED", 0, 0);
      ctx.restore();
    }
    return;
  }

  const b = slot.building;
  // Build-complete pop and recoil kick
  const rise = b.rise ?? 1;
  const recoil = (b.flash || 0) * 1.5;
  ctx.save();
  ctx.translate(slot.x - recoil, slot.y);
  const s = 0.85 + 0.15 * Math.min(1, rise * 1.2);
  ctx.scale(s, s);
  drawBuildingArt(ctx, b.id, fleet.isEnemy, t);
  ctx.restore();
  if (b.flash > 0.1) glow(ctx, slot.x + 14, slot.y - 16, 14 * b.flash, "#fff3b0", 0.6 * b.flash);
  if (b.repairing > 0 && Math.random() < 0.3) {
    ctx.fillStyle = "#68d8d6";
    ctx.fillRect(slot.x + (Math.random() - 0.5) * 20, slot.y - Math.random() * 24, 2, 2);
  }
  // Factory production bar
  if (b.prod) {
    const k = Math.min(1, b.prod.progress / b.prod.total);
    ctx.fillStyle = "rgba(0,0,0,0.7)";
    ctx.fillRect(slot.x - 15, slot.y - 42, 30, 3);
    ctx.fillStyle = "#7CFC00";
    ctx.fillRect(slot.x - 15, slot.y - 42, 30 * k, 3);
  } else if (b.spec.canProduce && !fleet.isEnemy && (b.waiting || !b.unitId)) {
    ctx.save();
    ctx.translate(slot.x, slot.y - 40);
    ctx.fillStyle = !b.unitId ? "#8da4c4" : "#ffb703";
    ctx.font = "bold 7px monospace";
    ctx.textAlign = "center";
    ctx.fillText(!b.unitId ? "HOLD" : `NEED ▲${UNITS[b.unitId].drones}`, 0, 0);
    ctx.restore();
  }
  if (b.hp < b.maxHp) {
    const k = Math.max(0, b.hp / b.maxHp);
    ctx.fillStyle = "rgba(0,0,0,0.7)";
    ctx.fillRect(slot.x - 15, slot.y - 36, 30, 3);
    ctx.fillStyle = k < 0.35 ? "#ff5964" : b.repairing > 0 ? "#68d8d6" : "#ffb703";
    ctx.fillRect(slot.x - 15, slot.y - 36, 30 * k, 3);
  }
  if (hovered) {
    ctx.strokeStyle = fleet.isEnemy ? "rgba(255,120,140,0.8)" : "rgba(255,255,255,0.6)";
    ctx.lineWidth = 1;
    ctx.strokeRect(slot.x - 18, slot.y - 34, 36, 36);
  }
}

function drawWaterline(ctx, fleet, t) {
  const g = fleet.geom;
  const a = toWorld(fleet, g.stern + 4, 0);
  const b = toWorld(fleet, g.bowTip - 6, 0);
  const x0 = Math.min(a.x, b.x);
  const x1 = Math.max(a.x, b.x);
  ctx.fillStyle = `rgba(230, 245, 255, ${0.22 + Math.sin(t * 3 + fleet.phase) * 0.06})`;
  ctx.fillRect(x0, WATER_Y - 1, x1 - x0, 2.5);
  // Bow wave
  const bow = toWorld(fleet, g.bowTip - 8, 0);
  ctx.fillStyle = "rgba(210, 240, 255, 0.5)";
  ctx.beginPath();
  ctx.ellipse(bow.x, WATER_Y, 16, 3 + Math.abs(Math.sin(t * 2 + fleet.phase)) * 2, 0, 0, TAU);
  ctx.fill();
}

function drawReflection(ctx, fleet) {
  const g = fleet.geom;
  ctx.save();
  ctx.translate(fleet.x, WATER_Y + 3);
  ctx.scale(fleet.isEnemy ? -1 : 1, -0.4);
  ctx.globalAlpha = fleet.sinking ? Math.max(0, 0.2 - fleet.sinking * 0.05) : 0.2;
  ctx.fillStyle = fleet.isEnemy ? PAL.enemy.mid : PAL.player.mid;
  polyPath(ctx, g.deck.concat([[g.bowTip, 0], [g.stern, 0]]));
  ctx.fill();
  const { x0, x1 } = g.bridge;
  ctx.fillRect(x0 + (x1 - x0) * 0.16, -60, (x1 - x0) * 0.84, 60);
  ctx.restore();
}

function drawShield(ctx, fleet, t) {
  if (!(fleet.maxShield > 0) || !(fleet.shield > 0)) return;
  const d = domeOf(fleet);
  const k = fleet.shield / fleet.maxShield;
  const col = fleet.isEnemy ? "#ff758f" : "#00f0ff";
  const flash = fleet.shieldFlash || 0;
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(d.cx, d.cy, d.a, d.b, 0, Math.PI, 0);
  ctx.closePath();
  const gr = ctx.createRadialGradient(d.cx, d.cy, d.b * 0.3, d.cx, d.cy, d.a);
  gr.addColorStop(0, rgba(col, 0));
  gr.addColorStop(1, rgba(col, 0.05 + k * 0.08 + flash * 0.15));
  ctx.fillStyle = gr;
  ctx.fill();
  ctx.clip();
  // Hex lattice that shimmers when hit
  ctx.strokeStyle = rgba(col, 0.05 + flash * 0.25);
  ctx.lineWidth = 1;
  const hs = 18;
  for (let y = d.cy - d.b; y < d.cy; y += hs * 0.87) {
    const row = Math.round((y - d.cy) / (hs * 0.87));
    for (let x = d.cx - d.a + ((row & 1) * hs) / 2; x < d.cx + d.a; x += hs) {
      ctx.beginPath();
      for (let s = 0; s < 6; s++) {
        const a = (s / 6) * TAU + Math.PI / 6;
        const px = x + Math.cos(a) * hs * 0.5;
        const py = y + Math.sin(a) * hs * 0.5;
        s ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();
    }
  }
  ctx.restore();
  ctx.strokeStyle = rgba(col, 0.25 + k * 0.4 + flash * 0.3);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(d.cx, d.cy, d.a, d.b, 0, Math.PI, 0);
  ctx.stroke();
  void t;
}

function drawBuilderDrones(ctx, fleet, t) {
  const color = fleet.isEnemy ? "#ff758f" : "#00f0ff";
  const hover = (slot, i, lift) => {
    const p = slotPos(fleet, slot);
    const a = t * 2.2 + i * 2.1 + slot.x;
    return { x: p.x + Math.cos(a) * 14, y: p.y - lift + Math.sin(a * 1.7) * 4 };
  };
  for (const b of fleet.economy.activeBuilds) {
    const slot = fleet.slots.find((s) => s.id === b.slotId);
    if (!slot) continue;
    const n = Math.min(4, b.dronesLocked);
    for (let i = 0; i < n; i++) {
      const p = hover(slot, i, 40 + (i % 2) * 10);
      ctx.save();
      ctx.translate(p.x, p.y);
      drawDroneArt(ctx, t + i, color);
      ctx.restore();
    }
  }
  for (const slot of fleet.slots) {
    const b = slot.building;
    if (!b) continue;
    if (b.repairing > 0) {
      const p = hover(slot, 0, 42);
      ctx.save();
      ctx.translate(p.x, p.y);
      drawDroneArt(ctx, t, "#68d8d6");
      ctx.restore();
    }
    if (b.prod) {
      const n = Math.min(3, b.prod.drones);
      for (let i = 0; i < n; i++) {
        const p = hover(slot, i + 1, 36 + i * 6);
        ctx.save();
        ctx.translate(p.x, p.y);
        drawDroneArt(ctx, t + i, "#7CFC00");
        ctx.restore();
      }
    }
  }
}

function drawUnit(ctx, u, t) {
  const art = { id: u.id, spec: u.spec, isEnemy: u.isEnemy, x: u.x, hp: 1, maxHp: 1 };
  ctx.save();
  ctx.translate(u.x, u.y);
  const sc = u.spec.domain === "naval" ? 1.35 : 1.3;
  ctx.scale(sc, sc);
  if (u.spec.domain === "naval") {
    if (u.dir < 0) ctx.scale(-1, 1);
    if (u.dying) ctx.rotate(u.spin * u.dir);
    drawUnitArt(ctx, art, t);
    if (u.flash > 0.1) glow(ctx, 18, -12, 12 * u.flash, "#fff3b0", 0.7 * u.flash);
  } else if (u.plane || u.dying || u.diving) {
    ctx.rotate(u.heading + (u.dying ? u.spin : 0));
    if (Math.cos(u.heading) < 0) ctx.scale(1, -1);
    drawUnitArt(ctx, art, t);
  } else {
    if (u.dir < 0) ctx.scale(-1, 1);
    ctx.rotate(u.heading);
    drawUnitArt(ctx, art, t);
    if (u.flash > 0.1) glow(ctx, 12, 4, 10 * u.flash, "#fff3b0", 0.7 * u.flash);
  }
  ctx.restore();
  if (!u.dying && u.hp < u.maxHp) {
    const k = Math.max(0, u.hp / u.maxHp);
    ctx.fillStyle = "rgba(0,0,0,0.7)";
    ctx.fillRect(u.x - 14, u.y - 40, 28, 3);
    ctx.fillStyle = k < 0.35 ? "#ff5964" : u.isEnemy ? "#ff9aa9" : "#7CFC00";
    ctx.fillRect(u.x - 14, u.y - 40, 28 * k, 3);
  }
}

function drawProjectile(ctx, p, t) {
  const col = p.color || (p.isEnemy ? "#ff6b6b" : "#ffc14d");
  if (p.type === "icbm") {
    const k = Math.min(1, p.progress);
    const dxdk = p.targetX - p.startX;
    const dydk = p.targetY - p.startY - 420 * Math.PI * Math.cos(k * Math.PI);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(Math.atan2(dydk, dxdk));
    drawIcbm(ctx, t);
    ctx.restore();
  } else if (p.type === "arc") {
    const sz = p.size || 1;
    const ang = p.ang || 0;
    ctx.strokeStyle = rgba(col, 0.4);
    ctx.lineWidth = 2 * sz;
    ctx.beginPath();
    ctx.moveTo(p.x - Math.cos(ang) * 18 * sz, p.y - Math.sin(ang) * 18 * sz);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    glow(ctx, p.x, p.y, 8 * sz, col, 0.6);
    ctx.fillStyle = "#fff4d6";
    ctx.fillRect(p.x - 1.5 * sz, p.y - 1.5 * sz, 3 * sz, 3 * sz);
  } else if (p.type === "bomb") {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.ang || Math.PI / 2);
    ctx.fillStyle = "#2b2f36";
    ctx.beginPath();
    ctx.ellipse(0, 0, 6, 2.5, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "#6b7280";
    ctx.fillRect(-8, -3, 3, 6);
    ctx.restore();
  } else if (p.type === "linear") {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(Math.atan2(p.vy, p.vx));
    if (p.rocket) {
      for (let k = 1; k < 6; k++) {
        ctx.fillStyle = `rgba(200, 200, 210, ${0.25 - k * 0.04})`;
        ctx.beginPath();
        ctx.arc(-k * 7, Math.sin(t * 20 + k) * 1.5, 2 + k, 0, TAU);
        ctx.fill();
      }
      glow(ctx, -7, 0, 8, "#ffb347", 0.7);
      ctx.fillStyle = "#e5e7eb";
      ctx.fillRect(-6, -1.5, 12, 3);
      ctx.fillStyle = "#ef4444";
      ctx.fillRect(5, -1.5, 3, 3);
    } else {
      const len = Math.min(40, 14 + Math.hypot(p.vx, p.vy) * 0.02);
      const gr = ctx.createLinearGradient(-len, 0, 0, 0);
      gr.addColorStop(0, rgba(col, 0));
      gr.addColorStop(1, rgba(col, 0.95));
      ctx.strokeStyle = gr;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(-len, 0);
      ctx.lineTo(0, 0);
      ctx.stroke();
      glow(ctx, 0, 0, 8, col, 0.6);
      ctx.fillStyle = "#fff";
      ctx.fillRect(-1, -1, 2, 2);
    }
    ctx.restore();
  } else {
    drawShot(ctx, p, t);
  }
}

function drawSmoke(ctx, behind) {
  for (const s of battle.smoke) {
    if ((s.dark < 0) === behind) continue;
    const k = Math.max(0, s.life / s.maxLife);
    if (s.dark < 0) ctx.fillStyle = `rgba(235, 240, 250, ${0.35 * k})`;
    else ctx.fillStyle = `rgba(28, 24, 30, ${s.dark * k})`;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, TAU);
    ctx.fill();
  }
}

function drawFlashes(ctx) {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const f of battle.flashes) {
    const k = Math.max(0, f.life / f.maxLife);
    glow(ctx, f.x, f.y, f.r * (1.2 - k * 0.2), f.color, 0.8 * k);
  }
  ctx.restore();
}

function drawRipple(ctx, r) {
  const k = Math.max(0, r.life / r.maxLife);
  ctx.strokeStyle = rgba(r.color, 0.6 * k);
  ctx.lineWidth = 2;
  ctx.beginPath();
  if (r.flat) ctx.ellipse(r.x, r.y, r.r, r.r * 0.12, 0, 0, TAU);
  else ctx.arc(r.x, r.y, r.r, 0, TAU);
  ctx.stroke();
}

function drawTargeting(ctx, t) {
  const tg = battle.player.target;
  if (tg && (tg.building || tg.underConstruction)) {
    const p = slotPos(battle.enemy, tg);
    const r = 24 + Math.sin(t * 5) * 2;
    ctx.save();
    ctx.translate(p.x, p.y - 14);
    ctx.rotate(t * 1.2);
    ctx.strokeStyle = "#ffd166";
    ctx.lineWidth = 2;
    for (let k = 0; k < 4; k++) {
      ctx.rotate(Math.PI / 2);
      ctx.beginPath();
      ctx.arc(0, 0, r, -0.45, 0.45);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(r + 3, 0);
      ctx.lineTo(r + 9, 0);
      ctx.stroke();
    }
    ctx.restore();
    ctx.fillStyle = "#ffd166";
    ctx.font = "bold 9px monospace";
    ctx.textAlign = "center";
    const name = (tg.building?.spec.name || BUILDINGS[tg.underConstruction.buildingId].name).toUpperCase();
    ctx.fillText(`TARGET: ${name}`, p.x, p.y - 48);
  }
  // Hover label on enemy buildings
  const h = battle.hover;
  if (h && h.fleet === battle.enemy && (h.slot.building || h.slot.underConstruction) && h.slot !== tg) {
    const p = slotPos(battle.enemy, h.slot);
    const name = (h.slot.building?.spec.name || BUILDINGS[h.slot.underConstruction.buildingId].name).toUpperCase();
    ctx.fillStyle = "rgba(0,0,0,0.65)";
    ctx.font = "bold 9px monospace";
    const w = ctx.measureText(name).width + 70;
    ctx.fillRect(p.x - w / 2, p.y - 62, w, 14);
    ctx.fillStyle = "#ff9aa9";
    ctx.textAlign = "center";
    ctx.fillText(`${name} · CLICK TO TARGET`, p.x, p.y - 52);
  }
  // Enemy's current target on our deck
  const et = battle.enemy.target;
  if (et && (et.building || et.underConstruction)) {
    const p = slotPos(battle.player, et);
    ctx.strokeStyle = `rgba(255, 89, 100, ${0.5 + Math.sin(t * 8) * 0.3})`;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);
    ctx.strokeRect(p.x - 18, p.y - 34, 36, 36);
    ctx.setLineDash([]);
  }
}

function drawTexts(ctx) {
  ctx.textAlign = "center";
  ctx.font = "bold 10px monospace";
  for (const f of battle.texts) {
    const k = Math.max(0, f.life / f.maxLife);
    ctx.fillStyle = `rgba(0,0,0,${0.6 * k})`;
    ctx.fillText(f.text, f.x + 1, f.y + 1);
    ctx.fillStyle = rgba(f.color, Math.min(1, k * 1.5));
    ctx.fillText(f.text, f.x, f.y);
  }
}

// Minimap strip across the top of the battlefield
const MINIMAP = { w: 560, h: 50, y: 10 };
function minimapRect(W) {
  return { x: W / 2 - MINIMAP.w / 2, y: MINIMAP.y, w: MINIMAP.w, h: MINIMAP.h };
}

function drawMinimap(ctx, W, t) {
  const r = minimapRect(W);
  const sx = r.w / WORLD_WIDTH;
  const waterY = r.y + r.h * 0.72;
  const wy = (y) => waterY - ((WATER_Y - y) / (WATER_Y - SKY_CEIL)) * (r.h * 0.62);
  ctx.save();
  ctx.fillStyle = "rgba(4, 10, 18, 0.72)";
  ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.fillStyle = "rgba(20, 50, 80, 0.8)";
  ctx.fillRect(r.x, waterY, r.w, r.y + r.h - waterY);
  ctx.strokeStyle = "rgba(120, 170, 220, 0.35)";
  ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
  for (const f of [battle.player, battle.enemy]) {
    const span = hullSpan(f.isEnemy);
    ctx.fillStyle = f.isEnemy ? "#ff5964" : "#4aa8ff";
    ctx.fillRect(r.x + span.x0 * sx, waterY - 5, (span.x1 - span.x0) * sx, 5);
    if (f.shield > 0) {
      ctx.strokeStyle = f.isEnemy ? "rgba(255,117,143,.6)" : "rgba(0,240,255,.6)";
      ctx.beginPath();
      ctx.ellipse(r.x + ((span.x0 + span.x1) / 2) * sx, waterY, ((span.x1 - span.x0) / 2) * sx + 4, 12, 0, Math.PI, 0);
      ctx.stroke();
    }
    const k = Math.max(0, f.hull / f.maxHull);
    ctx.fillStyle = "rgba(0,0,0,.6)";
    ctx.fillRect(r.x + span.x0 * sx, r.y + 4, (span.x1 - span.x0) * sx, 3);
    ctx.fillStyle = f.isEnemy ? "#ff5964" : "#4aa8ff";
    ctx.fillRect(r.x + span.x0 * sx, r.y + 4, (span.x1 - span.x0) * sx * k, 3);
  }
  for (const u of battle.units) {
    if (u.dying) continue;
    ctx.fillStyle = u.isEnemy ? "#ff9aa9" : "#9bf6ff";
    const s = u.spec.domain === "naval" ? 3 : 2;
    ctx.fillRect(r.x + u.x * sx - s / 2, (u.spec.domain === "naval" ? waterY - 2 : wy(u.y)) - s / 2, s, s);
  }
  for (const p of battle.projectiles) {
    if (p.type !== "arc" && p.type !== "icbm") continue;
    ctx.fillStyle = p.type === "icbm" ? "#fff" : "#ffd166";
    ctx.fillRect(r.x + p.x * sx, wy(Math.max(SKY_CEIL, p.y)), 1.5, 1.5);
  }
  const c = canvasEl();
  const vw = c.width / camera.zoom;
  ctx.strokeStyle = "rgba(255,255,255,0.85)";
  ctx.lineWidth = 1;
  ctx.strokeRect(r.x + camera.x * sx, r.y + 1, vw * sx, r.h - 2);
  ctx.restore();
  void t;
}

function drawToast(ctx, W, H) {
  const tt = battle.toast;
  if (!tt) return;
  const k = Math.min(1, tt.life * 2);
  ctx.save();
  ctx.font = "bold 16px monospace";
  ctx.textAlign = "center";
  ctx.fillStyle = `rgba(0,0,0,${0.55 * k})`;
  const w = ctx.measureText(tt.text).width + 30;
  ctx.fillRect(W / 2 - w / 2, H - 70, w, 30);
  ctx.fillStyle = rgba(tt.color, k);
  ctx.fillText(tt.text, W / 2, H - 50);
  ctx.restore();
}

function drawPausedTag(ctx, W) {
  ctx.save();
  ctx.font = "bold 22px monospace";
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.fillRect(W / 2 - 90, 78, 180, 36);
  ctx.fillStyle = "#ffd166";
  ctx.fillText("❚❚ PAUSED", W / 2, 104);
  ctx.restore();
}

// ─────────────────────────── Input ───────────────────────────
function eventToCanvas(e) {
  const canvas = canvasEl();
  const rect = canvas.getBoundingClientRect();
  return { cx: (e.clientX - rect.left) * (canvas.width / rect.width), cy: (e.clientY - rect.top) * (canvas.height / rect.height) };
}

function eventToWorld(e) {
  const { cx, cy } = eventToCanvas(e);
  return { x: cx / camera.zoom + camera.x, y: cy / camera.zoom + camera.y, cx, cy };
}

// Slot under the pointer on either cruiser: { fleet, slot } or null
function pickSlot(e) {
  if (!battle) return null;
  const w = eventToWorld(e);
  let best = null;
  let bestD = 30;
  for (const fleet of [battle.player, battle.enemy]) {
    for (const slot of fleet.slots) {
      const p = slotPos(fleet, slot);
      const d = Math.hypot(w.x - p.x, w.y - (p.y - 12));
      if (d <= bestD) {
        bestD = d;
        best = { fleet, slot };
      }
    }
  }
  return best;
}

function slotAtEvent(e) {
  const hit = pickSlot(e);
  return hit && hit.fleet === battle.player ? hit.slot : null;
}

function inMinimap(e) {
  const c = canvasEl();
  const { cx, cy } = eventToCanvas(e);
  const r = minimapRect(c.width);
  return cx >= r.x && cx <= r.x + r.w && cy >= r.y && cy <= r.y + r.h ? (cx - r.x) / r.w : null;
}

function setTarget(slot) {
  if (!battle || !slot) return;
  if (battle.player.target === slot) {
    battle.player.target = null;
    toastCanvas("TARGET CLEARED", "#8da4c4");
  } else {
    battle.player.target = slot;
    sfx.target();
    const name = (slot.building?.spec.name || BUILDINGS[slot.underConstruction.buildingId].name).toUpperCase();
    toastCanvas(`ALL GUNS: ${name}`, "#ffd166");
  }
}

function handleCanvasClick(e) {
  if (!battle) return false;
  const hit = pickSlot(e);
  if (!hit) {
    closeContextMenu();
    return false;
  }
  if (hit.fleet === battle.player) {
    handleSlotClick(hit.slot);
    return true;
  }
  if (hit.slot.building || hit.slot.underConstruction) {
    setTarget(hit.slot);
    return true;
  }
  return false;
}

function setupEvents() {
  const canvas = canvasEl();

  canvas.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    if (selectedBuildingId) {
      selectedBuildingId = null;
      renderBuildCards();
      return;
    }
    const slot = slotAtEvent(e);
    if (slot && (slot.building || slot.underConstruction)) openContextMenu(slot);
    else closeContextMenu();
  });

  let minimapDrag = false;
  canvas.addEventListener("mousedown", (e) => {
    if (e.button !== 0) return;
    getAudioCtx();
    const mm = inMinimap(e);
    if (mm !== null) {
      minimapDrag = true;
      jumpCameraTo(mm * WORLD_WIDTH);
      return;
    }
    if (handleCanvasClick(e)) return;
    camera.isDragging = true;
    camera.dragMoved = false;
    camera.dragStartX = e.clientX;
    camera.dragStartY = e.clientY;
    camera.camStartX = camera.x;
    camera.camStartOff = camera.yOff;
    camera.lastDragX = e.clientX;
    camera.lastDragT = performance.now();
    camera.vx = 0;
    camera.anchor = null;
  });

  window.addEventListener("mousemove", (e) => {
    if (minimapDrag) {
      const c = canvasEl();
      const { cx } = eventToCanvas(e);
      const r = minimapRect(c.width);
      jumpCameraTo(Math.max(0, Math.min(1, (cx - r.x) / r.w)) * WORLD_WIDTH);
      return;
    }
    if (camera.isDragging) {
      const rect = canvas.getBoundingClientRect();
      const k = canvas.width / rect.width / camera.zoom;
      const dx = (e.clientX - camera.dragStartX) * k;
      const dy = (e.clientY - camera.dragStartY) * k;
      if (Math.abs(dx) + Math.abs(dy) > 4) camera.dragMoved = true;
      camera.tx = camera.x = clampX(camera.camStartX - dx, camera.zoom);
      camera.yOff = camera.camStartOff - dy;
      const now = performance.now();
      const dtm = Math.max(1, now - camera.lastDragT);
      camera.vx = (-(e.clientX - camera.lastDragX) * k * 1000) / dtm;
      camera.lastDragX = e.clientX;
      camera.lastDragT = now;
      return;
    }
    if (battle && e.target === canvas) {
      battle.hover = pickSlot(e);
      canvas.style.cursor = battle.hover && (battle.hover.fleet === battle.player || battle.hover.slot.building || battle.hover.slot.underConstruction) ? "pointer" : inMinimap(e) !== null ? "pointer" : "grab";
    }
  });

  window.addEventListener("mouseup", () => {
    minimapDrag = false;
    if (camera.isDragging && performance.now() - camera.lastDragT > 80) camera.vx = 0;
    camera.isDragging = false;
  });

  canvas.addEventListener("mouseleave", () => {
    if (battle) battle.hover = null;
  });

  // Wheel: zoom around the cursor, eased
  canvas.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      if (e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        camera.tx += ((e.deltaX || e.deltaY) * 1.2) / camera.zoom;
        camera.anchor = null;
        return;
      }
      const w = eventToWorld(e);
      camera.tz = Math.max(0.55, Math.min(2.2, camera.tz * (e.deltaY < 0 ? 1.12 : 0.89)));
      camera.anchor = { wx: w.x, sx: w.cx };
    },
    { passive: false }
  );

  // Touch: one finger pans, tap places / targets
  let touchStart = null;
  canvas.addEventListener(
    "touchstart",
    (e) => {
      if (e.touches.length !== 1) return;
      const tch = e.touches[0];
      touchStart = { x: tch.clientX, y: tch.clientY, camX: camera.x, off: camera.yOff, moved: false };
    },
    { passive: true }
  );
  canvas.addEventListener(
    "touchmove",
    (e) => {
      if (!touchStart || e.touches.length !== 1) return;
      e.preventDefault();
      const tch = e.touches[0];
      const rect = canvas.getBoundingClientRect();
      const k = canvas.width / rect.width / camera.zoom;
      const dx = (tch.clientX - touchStart.x) * k;
      if (Math.abs(dx) > 6) touchStart.moved = true;
      camera.tx = camera.x = clampX(touchStart.camX - dx, camera.zoom);
    },
    { passive: false }
  );
  canvas.addEventListener("touchend", (e) => {
    if (touchStart && !touchStart.moved && e.changedTouches[0]) {
      const tch = e.changedTouches[0];
      const fake = { clientX: tch.clientX, clientY: tch.clientY };
      const mm = inMinimap(fake);
      if (mm !== null) jumpCameraTo(mm * WORLD_WIDTH);
      else handleCanvasClick(fake);
    }
    touchStart = null;
  });

  // Context menu actions
  document.getElementById("ctx-repair")?.addEventListener("click", () => {
    const b = contextMenuSlot && contextMenuSlot.building;
    if (!battle || !b) return;
    if (!startRepair(battle.player, b)) {
      sfx.deny();
      return;
    }
    sfx.place();
    closeContextMenu();
  });
  document.getElementById("ctx-sell")?.addEventListener("click", () => {
    const slot = contextMenuSlot;
    if (!battle || !slot) return;
    if (slot.building) removeBuilding(battle.player, slot, false);
    else if (slot.underConstruction) cancelConstruction(battle.player, slot);
    playTone(300, 0.12, "triangle", 0.22);
    closeContextMenu();
    renderBuildCards();
    updateHUD(true);
  });
  document.getElementById("ctx-units")?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-unit]");
    const slot = contextMenuSlot;
    if (!btn || btn.disabled || !slot || !slot.building) return;
    const b = slot.building;
    const id = btn.dataset.unit || null;
    if (b.prod && b.prod.unitId !== id) {
      releaseDrones(battle.player.economy, b.prod.drones);
      b.prod = null;
      checkBuildQueue(battle.player.economy);
    }
    b.unitId = id;
    b.rest = 0;
    sfx.place();
    openContextMenu(slot);
  });

  document.querySelectorAll(".ic-tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => setCategory(btn.dataset.category));
  });

  const dockCards = document.getElementById("dock-cards");
  dockCards?.addEventListener("click", (e) => {
    const card = e.target.closest(".ic-bldg-card");
    if (!card || card.classList.contains("locked")) return;
    const id = card.dataset.buildingId;
    selectedBuildingId = selectedBuildingId === id ? null : id;
    closeContextMenu();
    renderBuildCards();
  });

  document.getElementById("btn-speed-1")?.addEventListener("click", () => setSpeed(1));
  document.getElementById("btn-speed-2")?.addEventListener("click", () => setSpeed(2));
  document.getElementById("btn-speed-4")?.addEventListener("click", () => setSpeed(4));
  document.getElementById("btn-pause")?.addEventListener("click", () => setSpeed(isPaused ? 1 : 0));
  document.getElementById("btn-jump-player")?.addEventListener("click", () => jumpCameraTo("player"));
  document.getElementById("btn-jump-mid")?.addEventListener("click", () => jumpCameraTo("mid"));
  document.getElementById("btn-jump-enemy")?.addEventListener("click", () => jumpCameraTo("enemy"));

  document.getElementById("btn-open-tech")?.addEventListener("click", () => openTechModal());
  document.getElementById("btn-close-tech")?.addEventListener("click", () => (document.getElementById("tech-modal").style.display = "none"));
  document.getElementById("btn-open-sectors")?.addEventListener("click", () => openSectorsModal());
  document.getElementById("btn-close-sectors")?.addEventListener("click", () => (document.getElementById("sector-modal").style.display = "none"));

  document.getElementById("btn-result-next")?.addEventListener("click", () => {
    if (!battle || battle.levelNum >= CAMPAIGN_LEVELS.length) return;
    document.getElementById("result-modal").style.display = "none";
    initBattle(battle.levelNum + 1, battle.mode);
  });
  document.getElementById("btn-result-retry")?.addEventListener("click", () => {
    document.getElementById("result-modal").style.display = "none";
    initBattle(battle.levelNum, battle.mode);
  });

  document.querySelectorAll("#btn-mode-campaign, #btn-mode-skirmish, #btn-mode-bossrush").forEach((btn) => {
    btn.addEventListener("click", () => {
      sectorMode = btn.id.replace("btn-mode-", "");
      openSectorsModal();
    });
  });

  window.addEventListener("keydown", (e) => {
    if (e.target instanceof Element && e.target.closest("input, textarea, select, [contenteditable]")) return;
    if (e.key === "Shift") heldKeys.add("shift");
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key.toLowerCase();
    if (k === "arrowleft" || k === "a") heldKeys.add("left");
    if (k === "arrowright" || k === "d") heldKeys.add("right");
    if (k.startsWith("arrow") || k === " ") e.preventDefault();
    if (e.repeat) return;
    if (k === "escape") {
      selectedBuildingId = null;
      closeContextMenu();
      document.getElementById("tech-modal").style.display = "none";
      document.getElementById("sector-modal").style.display = "none";
      renderBuildCards();
    } else if (k >= "1" && k <= "5") setCategoryByIndex(Number(k) - 1);
    else if (k === " ") setSpeed(isPaused ? 1 : 0);
    else if (k === "t") openTechModal();
    else if (k === "z") jumpCameraTo("player");
    else if (k === "x") jumpCameraTo("mid");
    else if (k === "c") jumpCameraTo("enemy");
    else if (k === "f") setSpeed(speedMultiplier === 1 ? 2 : speedMultiplier === 2 ? 4 : 1);
    else if (k === "q" && battle?.player.target) setTarget(battle.player.target);
  });
  window.addEventListener("keyup", (e) => {
    const k = e.key.toLowerCase();
    if (k === "shift") heldKeys.delete("shift");
    if (k === "arrowleft" || k === "a") heldKeys.delete("left");
    if (k === "arrowright" || k === "d") heldKeys.delete("right");
  });
  window.addEventListener("blur", () => heldKeys.clear());
}

function setSpeed(spd) {
  speedMultiplier = spd || speedMultiplier || 1;
  isPaused = spd === 0;
  document.querySelectorAll(".ic-btn-speed").forEach((b) => b.classList.remove("active"));
  const id = isPaused ? "btn-pause" : `btn-speed-${speedMultiplier}`;
  document.getElementById(id)?.classList.add("active");
}

const CATEGORIES = ["factories", "tactical", "defensive", "offensive", "ultraweapons"];
function setCategory(cat) {
  activeCategory = cat;
  document.querySelectorAll(".ic-tab-btn").forEach((b) => b.classList.toggle("active", b.dataset.category === cat));
  selectedBuildingId = null;
  renderBuildCards();
}

function setCategoryByIndex(idx) {
  if (CATEGORIES[idx]) setCategory(CATEGORIES[idx]);
}

// ─────────────────────────── Tech Lab ───────────────────────────
function openTechModal() {
  const modal = document.getElementById("tech-modal");
  const grid = document.getElementById("tech-grid");
  if (!modal || !grid) return;
  document.getElementById("tech-scrap-display").textContent = saveState.scrap;
  document.getElementById("tech-stars-display").textContent = `${saveState.stars} ★`;

  grid.innerHTML = Object.keys(TECH_LAB_UPGRADES)
    .map((k) => {
      const upg = TECH_LAB_UPGRADES[k];
      const curTier = Number(saveState.techTiers[k]) || 0;
      const isMax = curTier >= upg.maxTier;
      const cost = isMax ? 0 : upg.costs[curTier];
      const canAfford = !isMax && saveState.scrap >= cost;
      return `
        <div class="ic-tech-card">
          <div class="ic-tech-card__top">
            <span class="ic-tech-card__name">${upg.name}</span>
            <span class="ic-tech-card__tier">TIER ${curTier} / ${upg.maxTier}</span>
          </div>
          <div class="ic-tech-card__pips">${Array.from({ length: upg.maxTier }, (_, i) => `<i class="${i < curTier ? "on" : ""}"></i>`).join("")}</div>
          <div class="ic-tech-card__desc">${upg.desc}</div>
          <div class="ic-tech-card__action">
            <span style="font-weight:700; color:var(--steel-warning); font-size:11px;">${isMax ? "MAX LEVEL" : `${cost} SCRAP`}</span>
            <button type="button" class="ic-btn-upgrade" data-upgrade-id="${k}" ${!canAfford ? "disabled" : ""}>${isMax ? "INSTALLED" : "RESEARCH"}</button>
          </div>
        </div>`;
    })
    .join("");

  grid.querySelectorAll(".ic-btn-upgrade").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.upgradeId;
      const upg = TECH_LAB_UPGRADES[id];
      const cur = Number(saveState.techTiers[id]) || 0;
      if (cur < upg.maxTier && saveState.scrap >= upg.costs[cur]) {
        saveState.scrap -= upg.costs[cur];
        saveState.techTiers[id] = id === "nanocoat" ? true : cur + 1;
        persistSave();
        playTone(660, 0.15, "triangle", 0.3);
        openTechModal();
        updateHUD(true);
      }
    });
  });

  const input = document.getElementById("save-code-input");
  document.getElementById("btn-save-export").onclick = () => {
    if (input) input.value = exportSaveCode(saveState);
  };
  document.getElementById("btn-save-import").onclick = () => {
    if (input && input.value.trim()) {
      const imported = importSaveCode(input.value);
      if (imported && typeof imported === "object") {
        saveState = normalizeSave(imported);
        if (window.ironclad) window.ironclad.saveState = saveState;
        persistSave();
        playTone(520, 0.2, "sine", 0.3);
        openTechModal();
        updateHUD(true);
      }
    }
  };
  modal.style.display = "flex";
}

// ─────────────────────────── Sectors & hangar ───────────────────────────
// campaign: story order + unlocks • skirmish: replay any reached sector for half scrap
// bossrush: any reached sector with a +30% enemy hull for 1.5x scrap
let sectorMode = "campaign";

function hullThumb(id) {
  const key = `hull:${id}`;
  if (iconCache.has(key)) return iconCache.get(key);
  let url = "";
  try {
    const spec = CRUISERS[id];
    const g = hullGeom(spec);
    const c = document.createElement("canvas");
    c.width = 200;
    c.height = 70;
    const x = c.getContext("2d");
    const s = 180 / (g.len + 20);
    x.translate(10 - g.stern * s, 56);
    x.scale(s, s);
    x.fillStyle = "#3f5a78";
    polyPath(x, g.poly);
    x.fill();
    const { x0, x1 } = g.bridge;
    const w = x1 - x0;
    const base = deckYAt(g, (x0 + x1) / 2);
    x.fillRect(x0 + w * 0.16, base - 26, w * 0.84, 26);
    x.fillRect(x0 + w * 0.3, base - 46, w * 0.6, 20);
    x.fillRect(x0 + w * 0.42, base - 62, w * 0.42, 16);
    x.fillRect(x0 + w * 0.08, base - 60, 18, 60);
    for (const sl of spec.slots) {
      x.fillStyle = { bow: "#ff9f1c", deck: "#9bf6ff", utility: "#7CFC00", mast: "#ffd166", platform: "#b388ff" }[sl.type];
      x.fillRect(sl.x - 5, sl.y - 5, 10, 5);
      if (sl.type === "mast" || sl.type === "platform") {
        x.fillStyle = "#3f5a78";
        x.fillRect(sl.x - 2, sl.y, 4, deckYAt(g, sl.x) - sl.y);
      }
    }
    url = c.toDataURL();
  } catch {}
  iconCache.set(key, url);
  return url;
}

function openSectorsModal() {
  const modal = document.getElementById("sector-modal");
  const list = document.getElementById("sector-list");
  if (!modal || !list) return;

  document.querySelectorAll("#btn-mode-campaign, #btn-mode-skirmish, #btn-mode-bossrush").forEach((b) => b.classList.toggle("active", b.id === `btn-mode-${sectorMode}`));

  // Hangar: pick the hull you sail into the next battle
  let hangar = document.getElementById("hull-list");
  if (!hangar) {
    hangar = document.createElement("div");
    hangar.id = "hull-list";
    hangar.className = "ic-hangar";
    list.parentElement.insertBefore(hangar, list);
    hangar.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-hull]");
      if (!btn || btn.disabled) return;
      saveState.cruiser = btn.dataset.hull;
      persistSave();
      sfx.place();
      openSectorsModal();
    });
  }
  hangar.innerHTML =
    `<div class="ic-hangar__label">HANGAR // HULL FOR THE NEXT SORTIE</div><div class="ic-hangar__row">` +
    Object.values(CRUISERS)
      .map((c) => {
        const owned = saveState.unlockedCruisers.includes(c.id);
        const on = saveState.cruiser === c.id;
        const counts = Object.entries(c.slotCounts || {})
          .map(([k, v]) => `${v}${k[0].toUpperCase()}`)
          .join(" ");
        return `<button type="button" class="ic-hull ${on ? "on" : ""}" data-hull="${c.id}" ${owned ? "" : "disabled"} title="${c.bonusDesc || ""}">
          ${owned ? `<img src="${hullThumb(c.id)}" alt="" width="200" height="70" />` : `<span class="ic-hull__lock">🔒</span>`}
          <b>${c.name.toUpperCase()}</b><small>${owned ? `${c.hullHp} HP · ${counts}` : "LOCKED"}</small>
          ${owned ? `<em>${c.role}</em>` : ""}
        </button>`;
      })
      .join("") +
    `</div>`;

  list.innerHTML = CAMPAIGN_LEVELS.map((lvl) => {
    const isUnlocked = lvl.level <= saveState.campaignLevel;
    const best = Number(saveState.levelStars[String(lvl.level)]) || 0;
    const boss = BOSSES.find((b) => b.id === lvl.bossId);
    return `
      <button type="button" class="ic-sector-card ${isUnlocked ? "" : "locked"}" data-sector-lvl="${lvl.level}" ${isUnlocked ? "" : "disabled"}>
        <span class="ic-sector-card__num">SECTOR ${lvl.level} <span class="ic-sector-card__stars">${"★".repeat(best)}${"☆".repeat(3 - best)}</span></span>
        <span class="ic-sector-card__meta">${boss ? boss.name.toUpperCase() + " • " + CRUISERS[boss.cruiser]?.name.toUpperCase() : ""}</span>
        <span class="ic-sector-card__meta">PAR ${Math.floor(lvl.parTime / 60)}m ${lvl.parTime % 60}s${lvl.unlock ? ` • ${lvl.unlock.name.toUpperCase()}` : ""}</span>
      </button>`;
  }).join("");

  list.querySelectorAll("[data-sector-lvl]").forEach((card) => {
    card.addEventListener("click", () => {
      const lvl = parseInt(card.dataset.sectorLvl, 10);
      if (lvl <= saveState.campaignLevel) {
        modal.style.display = "none";
        initBattle(lvl, sectorMode);
      }
    });
  });
  modal.style.display = "flex";
}

// ─────────────────────────── Loop ───────────────────────────
let lastTimestamp = 0;
let hudTick = 0;
function gameLoop(timestamp) {
  if (!lastTimestamp) lastTimestamp = timestamp;
  const dt = Math.min(0.1, (timestamp - lastTimestamp) / 1000);
  lastTimestamp = timestamp;

  // Sub-step the sim at high speed so fast rounds don't tunnel through targets
  const steps = Math.max(1, Math.ceil(speedMultiplier / 2));
  for (let s = 0; s < steps; s++) updateBattle(dt / steps);
  updateCamera(dt);
  if (++hudTick % 2 === 0) updateHUD();

  const canvas = canvasEl();
  if (canvas) render(canvas.getContext("2d"), timestamp);
  requestAnimationFrame(gameLoop);
}

function init() {
  initShell({ howToPlay: getHowToPlay("ironclad") });
  setupEvents();
  initBattle(Math.min(saveState.campaignLevel, CAMPAIGN_LEVELS.length));
  if (typeof window !== "undefined") {
    window.ironclad = {
      getBattle: () => battle,
      initBattle,
      handleSlotClick,
      completeBuilding,
      spawnUnit,
      setTarget,
      placeBuilding: (slotId, id) => placeBuilding(battle.player, battle.player.slots.find((s) => s.id === slotId), id),
      setFactoryUnit: (slotId, unitId) => {
        const b = battle.player.slots.find((s) => s.id === slotId)?.building;
        if (b) b.unitId = unitId;
      },
      camera,
      jumpCameraTo,
      setSpeed,
      saveState
    };
  }
  requestAnimationFrame(gameLoop);
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
else init();
