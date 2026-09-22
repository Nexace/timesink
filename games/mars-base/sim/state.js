import { createRng, hashSeed } from "../../../shared/rng.js";
import { generateWorld } from "./worldgen.js";
import { structById } from "../data/structures.js";
import { START, VITALS, SOL_TICKS, DAWN } from "../data/balance.js";
import { N } from "../data/tiles.js";

export const SAVE_VERSION = 2;
export const INV_SLOTS = 30;
export const HOTBAR = 9;

export function makeRngState(seed, salt) {
  return { seed: hashSeed(`mars:${seed}:${salt}`), state: null, calls: 0 };
}

// g = the whole live game. Only `g.s` plus the derived-from-seed world and struct map are persisted.
export function createGame({ mode = "campaign", seed = null, start = "solo", dailyKey = null } = {}) {
  const resolvedSeed = (seed ?? (Date.now() ^ Math.floor(Math.random() * 0xffffffff))) >>> 0;
  const world = generateWorld(resolvedSeed);
  const s = {
    version: SAVE_VERSION,
    mode,
    startKit: start,
    seed: resolvedSeed,
    dailyKey,
    tick: Math.floor(SOL_TICKS * (DAWN + 0.02)), // start just after dawn on sol 1
    rng: { events: makeRngState(resolvedSeed, "events"), ai: makeRngState(resolvedSeed, "ai"), misc: makeRngState(resolvedSeed, "misc") },
    status: "playing", // playing | dead | won
    ending: null,
    player: {
      x: world.start.x + 0.5,
      y: world.start.y + 0.5,
      dir: 2, // 0 up 1 right 2 down 3 left
      moving: false,
      o2: VITALS.o2Max,
      power: 80,
      food: 70,
      water: 70,
      health: 85,
      integrity: 100,
      inRover: false,
      sleeping: false,
      mining: null, // { i, t }
      damageTag: null,
      spawn: { x: world.start.x + 0.5, y: world.start.y + 0.5 },
    },
    inv: new Array(INV_SLOTS).fill(null),
    sel: 0,
    autoEat: true,
    rover: { x: world.start.x + 0.5, y: world.start.y + 8.5, a: 0, v: 0, battery: 35, broken: mode === "campaign" || start === "solo", capacity: 100 },
    colonists: [],
    drops: [],
    diff: { t: {}, n: {} }, // tile index -> terrain / node overrides vs. generated world
    atmos: [], // saved room atmospheres: [{ at: idx, o2, temp }]
    research: { done: [], current: null, progress: 0, rp: 0 },
    credits: 0,
    story: { idx: 0, done: [], flags: {}, messages: [] },
    events: { active: [], scheduled: [], lastSol: 0 },
    sustain: { streak: 0, badSol: false, lastSol: 1 },
    stats: { mined: 0, crafted: 0, built: 0, harvested: 0, events: 0, distance: 0, deaths: 0, colonistsLost: 0, maxColonists: 0, research: 0 },
    log: [],
    orders: [], // pending supply drops { at: tick, manifest }
    nextLander: 0,
    beacons: [],
    colonyName: null,
    selfSustainSols: 0,
    score: 0,
    alerts: [], // transient, not important to persist
    craft: [],
    waterUsed: 0,
  };

  const g = {
    s,
    world,
    structs: new Map(),
    rooms: null,
    roomOf: null,
    grids: null,
    dirtyRooms: true,
    dirtyGrids: true,
    dirtyChunks: new Set(),
    explored: new Uint8Array(world.w * world.h),
    fx: [], // transient render effects emitted by the sim: { kind, x, y, ... }
  };

  buildStartingBase(g, mode, start);
  if (mode === "campaign") {
    pushLog(g, "HELIOS-3 evacuated during the storm. Commander presumed dead. Commander is, in fact, not dead. Suit alarms everywhere.", "journal");
  } else {
    pushLog(g, mode === "daily" ? `Daily Sol ${dailyKey}. Same Mars for everyone today. Survive ${30} sols.` : "Endless mode. Mars is patient. Be more patient.", "journal");
  }
  return g;
}

export function rngOf(g, name) {
  const snap = g.s.rng[name];
  const rng = createRng(snap.seed);
  if (Number.isInteger(snap.state)) rng.restore(snap.state, snap.calls);
  return {
    rng,
    commit() {
      const sn = rng.snapshot();
      snap.state = sn.state;
      snap.calls = sn.calls;
    },
  };
}

export function withRng(g, name, fn) {
  const { rng, commit } = rngOf(g, name);
  const out = fn(rng);
  commit();
  return out;
}

export function placeStruct(g, x, y, id, extra = {}) {
  const def = structById(id);
  const i = y * g.world.w + x;
  const st = { id, x, y, ...initialStructState(def), ...extra };
  g.structs.set(i, st);
  g.dirtyRooms = true;
  g.dirtyGrids = true;
  g.dirtyChunks.add(chunkKey(g, x, y));
  return st;
}

export function removeStruct(g, x, y) {
  const i = y * g.world.w + x;
  const st = g.structs.get(i);
  if (!st) return null;
  g.structs.delete(i);
  g.dirtyRooms = true;
  g.dirtyGrids = true;
  g.dirtyChunks.add(chunkKey(g, x, y));
  return st;
}

export function chunkKey(g, x, y) {
  return `${Math.floor(x / 32)},${Math.floor(y / 32)}`;
}

export function initialStructState(def) {
  const st = {};
  if (def.store) st.charge = 0;
  if (def.water) st.water = 0;
  if (def.solar) st.dust = 0;
  if (def.planter) st.crop = null;
  if (def.storage) st.items = new Array(def.storage).fill(null);
  if (def.door) st.wear = 0;
  if (def.id === "recycler") { st.compost = 0; st.t = 0; }
  if (def.id === "chem") { st.hyd = 0; st.t = 0; }
  if (def.id === "lab") { st.samples = 0; st.t = 0; }
  if (def.miner) { st.items = new Array(8).fill(null); st.t = 0; }
  if (def.id === "algae") { st.t = 0; st.food = 0; }
  return st;
}

// The damaged HELIOS-3 hab. Interior 9×6, airlock west, breach east.
function buildStartingBase(g, mode, kit) {
  const { x: sx, y: sy } = g.world.start;
  const left = sx - 5;
  const right = sx + 5;
  const top = sy - 3;
  const bottom = sy + 4;
  const campaign = mode === "campaign" || kit === "solo";
  for (let y = top; y <= bottom; y += 1) {
    for (let x = left; x <= right; x += 1) {
      const edge = x === left || x === right || y === top || y === bottom;
      if (edge) {
        if (x === left && y === sy) placeStruct(g, x, y, "airlock");
        else if (x === right && y === sy && campaign) continue; // the breach
        else if (y === bottom && (x === sx - 1 || x === sx + 1)) placeStruct(g, x, y, "glass-wall"); // skylights for crops
        else placeStruct(g, x, y, "wall");
      } else {
        placeStruct(g, x, y, "floor");
      }
    }
  }
  const inside = (dx, dy, id, extra) => {
    const x = sx + dx;
    const y = sy + dy;
    g.structs.delete(y * g.world.w + x);
    return placeStruct(g, x, y, id, extra);
  };
  inside(-3, -2, "oxygenator", { broken: campaign });
  inside(-2, -2, "reclaimer", { broken: campaign });
  inside(-1, -2, "heater");
  inside(0, -2, "battery", { charge: 260 });
  inside(1, -2, "tank", { water: campaign ? 24 : 120 });
  inside(2, -2, "recycler", { compost: 3 });
  inside(3, 3, "bunk");
  inside(3, -2, "workbench");
  const crate = inside(-3, 3, "crate");
  inside(-2, 3, "crate");
  // Solar farm hugging the north wall (adjacent = same grid).
  for (let k = 0; k < 4; k += 1) placeStruct(g, sx - 3 + k * 2, top - 1, "solar", { dust: campaign ? 0.8 : 0.1 });
  for (let k = 0; k < 4; k += 1) placeStruct(g, sx - 2 + k * 2, top - 1, "cable");

  const c = crate.items;
  const put = (id, n) => {
    const slot = c.findIndex((v) => !v);
    if (slot >= 0) c[slot] = { id, n };
  };
  put("ration", campaign ? START.rations - 4 : 30);
  put("seed-potato", START.seedPotatoes);
  put("o2-canister", 3);
  put("hydrazine", 4);
  put("medkit", 2);
  put("duct-tape", 4);
  put("compost", 4);
  if (!campaign) {
    put("metal", 20);
    put("circuit", 6);
    put("wire", 10);
    put("glass", 8);
    put("plastic", 6);
    put("sealant", 8);
  }

  const inv = g.s.inv;
  inv[0] = { id: "drill-1", n: 1 };
  inv[1] = { id: "shovel", n: 1 };
  inv[2] = { id: "multitool", n: 1 };
  inv[3] = { id: "scanner", n: 1 };
  inv[4] = { id: "ration", n: 4 };
  inv[5] = { id: "beacon", n: 3 };

  if (kit === "colony" && mode !== "campaign") {
    inside(3, 2, "bunk");
    inside(2, 3, "bunk");
    inside(1, 3, "planter", { crop: null });
    inside(0, 3, "planter", { crop: null });
    placeStruct(g, sx + 2, bottom + 1, "comms");
    placeStruct(g, sx + 4, bottom + 1, "rtg");
    inside(-1, 3, "battery", { charge: 400 });
    for (let dx = -2; dx <= 1; dx += 1) placeStruct(g, sx + dx, bottom + 2, "pad");
  }
  // Hab starts at comfortable temperature but no air (breach) in the campaign.
  g.s.atmos = [{ at: sy * g.world.w + sx, o2: campaign ? 0.05 : 1, temp: campaign ? 6 : 18 }];
  // Mark the hab region explored.
  revealAround(g, sx, sy, 20);
  // Rover sits on the apron south of the hab; RTG-less campaign starts need a charge.
  void N;
}

export function revealAround(g, cx, cy, r) {
  const { w, h } = g.world;
  const r2 = r * r;
  const x0 = Math.max(0, Math.floor(cx - r));
  const x1 = Math.min(w - 1, Math.ceil(cx + r));
  const y0 = Math.max(0, Math.floor(cy - r));
  const y1 = Math.min(h - 1, Math.ceil(cy + r));
  let changed = false;
  for (let y = y0; y <= y1; y += 1) {
    for (let x = x0; x <= x1; x += 1) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy > r2) continue;
      const i = y * w + x;
      if (!g.explored[i]) {
        g.explored[i] = 1;
        changed = true;
      }
    }
  }
  return changed;
}

export function solOf(tick) {
  return Math.floor((tick / SOL_TICKS) - DAWN) + 1;
}
export function timeOfDay(tick) {
  return (tick % SOL_TICKS) / SOL_TICKS;
}

export function pushLog(g, text, type = "info") {
  g.s.log.unshift({ sol: solOf(g.s.tick), text, type });
  if (g.s.log.length > 120) g.s.log.length = 120;
}

export function alert(g, text, level = "info", key = null) {
  g.fx.push({ kind: "alert", text, level, key });
}
