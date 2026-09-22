import { generateWorld } from "./worldgen.js";
import { SAVE_VERSION, INV_SLOTS, initialStructState } from "./state.js";
import { applyDiff } from "./world.js";
import { snapshotAtmos } from "./rooms.js";
import { ensureDerived } from "./systems.js";
import { refreshGridStats } from "./power.js";
import { structById } from "../data/structures.js";
import { itemById } from "../data/items.js";
import { researchById } from "../data/research.js";

// Run-length encode a 0/1 byte array as alternating run lengths (starting with zeros).
export function rleEncode(bytes) {
  const runs = [];
  let cur = 0;
  let n = 0;
  for (let i = 0; i < bytes.length; i += 1) {
    const b = bytes[i] ? 1 : 0;
    if (b === cur) n += 1;
    else {
      runs.push(n);
      cur = b;
      n = 1;
    }
  }
  runs.push(n);
  return runs.join(",");
}

export function rleDecode(str, length) {
  const out = new Uint8Array(length);
  if (typeof str !== "string" || !str) return out;
  let i = 0;
  let cur = 0;
  for (const part of str.split(",")) {
    const n = Math.max(0, Math.min(length - i, Number(part) | 0));
    if (cur) out.fill(1, i, i + n);
    i += n;
    cur ^= 1;
    if (i >= length) break;
  }
  return out;
}

export function serialize(g) {
  const s = g.s;
  const structs = [];
  for (const st of g.structs.values()) {
    const copy = { ...st };
    delete copy.grid;
    delete copy.busy;
    structs.push(copy);
  }
  const data = JSON.parse(JSON.stringify({ ...s, alerts: [] }));
  data.atmos = snapshotAtmos(g);
  data.structs = structs;
  data.explored = rleEncode(g.explored);
  return data;
}

const num = (v, d, lo = -1e12, hi = 1e12) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d;
};

function cleanSlots(arr, len) {
  const out = new Array(len).fill(null);
  if (!Array.isArray(arr)) return out;
  for (let i = 0; i < len; i += 1) {
    const it = arr[i];
    if (it && typeof it.id === "string" && itemById(it.id)) {
      const n = Math.floor(num(it.n, 0, 0, itemById(it.id).stack));
      if (n > 0) out[i] = { id: it.id, n };
    }
  }
  return out;
}

export function deserialize(data) {
  if (!data || typeof data !== "object" || data.version !== SAVE_VERSION) return null;
  const seed = num(data.seed, 0, 0, 0xffffffff) >>> 0;
  const world = generateWorld(seed);
  const s = data;
  s.seed = seed;
  s.mode = ["campaign", "endless", "daily"].includes(s.mode) ? s.mode : "campaign";
  s.tick = Math.floor(num(s.tick, 0, 0, 1e9));
  s.inv = cleanSlots(s.inv, INV_SLOTS);
  s.sel = Math.floor(num(s.sel, 0, 0, 8));
  s.diff = s.diff && typeof s.diff === "object" ? { t: s.diff.t ?? {}, n: s.diff.n ?? {} } : { t: {}, n: {} };
  s.research = s.research ?? { done: [], current: null, progress: 0, rp: 0 };
  s.research.done = (s.research.done ?? []).filter((id) => researchById(id));
  if (s.research.current && !researchById(s.research.current)) s.research.current = null;
  s.colonists = Array.isArray(s.colonists) ? s.colonists.map((c) => ({ ...c, path: null, job: null, working: false })) : [];
  s.drops = Array.isArray(s.drops) ? s.drops.filter((d) => d && itemById(d.id)) : [];
  s.craft = Array.isArray(s.craft) ? s.craft : [];
  s.player = { ...s.player, sleeping: false, mining: null };
  const p = s.player;
  for (const k of ["o2", "power", "food", "water", "health", "integrity"]) p[k] = num(p[k], 50, 0, 200);
  p.x = num(p.x, world.start.x + 0.5, 0, world.w);
  p.y = num(p.y, world.start.y + 0.5, 0, world.h);

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
    explored: rleDecode(data.explored, world.w * world.h),
    fx: [],
  };
  applyDiff(g);
  for (const st of Array.isArray(data.structs) ? data.structs : []) {
    const def = structById(st?.id);
    if (!def) continue;
    const x = Math.floor(num(st.x, -1));
    const y = Math.floor(num(st.y, -1));
    if (x < 0 || y < 0 || x >= world.w || y >= world.h) continue;
    const base = initialStructState(def);
    const merged = { id: st.id, x, y, ...base, ...st };
    merged.x = x;
    merged.y = y;
    if (def.storage || def.miner) merged.items = cleanSlots(st.items, (def.storage ?? 8));
    g.structs.set(y * world.w + x, merged);
  }
  delete s.structs;
  delete s.explored;
  ensureDerived(g);
  refreshGridStats(g);
  return g;
}
