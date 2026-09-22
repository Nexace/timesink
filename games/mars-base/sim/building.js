import { structById } from "../data/structures.js";
import { recipeById } from "../data/recipes.js";
import { itemById } from "../data/items.js";
import { NODES } from "../data/tiles.js";
import { TERRAIN } from "../data/tiles.js";
import { inBounds, structAt, nodeAt, terrainAt } from "./world.js";
import { poolPay, poolMissing, poolHas, addTo } from "./inventory.js";
import { placeStruct, removeStruct, pushLog } from "./state.js";

export const BUILD_RANGE = 7;

// Player inventory first, then every crate within 8 tiles.
export function nearbyPool(g) {
  const p = g.s.player;
  const pool = [g.s.inv];
  for (const st of g.structs.values()) {
    if (st.id === "crate" && Math.hypot(st.x + 0.5 - p.x, st.y + 0.5 - p.y) <= 8) pool.push(st.items);
  }
  return pool;
}

export function isResearched(g, id) {
  return !id || g.s.research.done.includes(id) || g.s.mode === "sandbox";
}

export function canPlace(g, id, x, y) {
  const def = structById(id);
  const p = g.s.player;
  if (!def || def.hidden) return { ok: false, reason: "Unknown structure." };
  if (!isResearched(g, def.research)) return { ok: false, reason: "Needs research." };
  if (!inBounds(g, x, y)) return { ok: false, reason: "Out of bounds." };
  if (Math.hypot(x + 0.5 - p.x, y + 0.5 - p.y) > BUILD_RANGE) return { ok: false, reason: "Too far away." };
  if (TERRAIN[terrainAt(g, x, y)].solid) return { ok: false, reason: "Solid rock." };
  if (nodeAt(g, x, y)) return { ok: false, reason: "Clear the deposit first." };
  const existing = structAt(g, x, y);
  const replacesFloor = existing && existing.id === "floor" && id !== "floor" && !def.floor && !def.pad;
  if (existing && !replacesFloor) return { ok: false, reason: "Occupied." };
  if (def.pad && existing) return { ok: false, reason: "Pads go outside." };
  if (def.solid) {
    if (Math.floor(p.x) === x && Math.floor(p.y) === y) return { ok: false, reason: "You're standing there." };
    const rv = g.s.rover;
    if (Math.floor(rv.x) === x && Math.floor(rv.y) === y) return { ok: false, reason: "The rover is there." };
    for (const c of g.s.colonists) if (c.alive && Math.floor(c.x) === x && Math.floor(c.y) === y) return { ok: false, reason: "Someone is standing there." };
  }
  if (def.miner) {
    let found = false;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const n = nodeAt(g, x + dx, y + dy);
      if (n && NODES[n].drop && !NODES[n].unique && NODES[n].drop !== "cache") found = true;
    }
    if (!found) return { ok: false, reason: "Must be next to a deposit." };
  }
  const pool = nearbyPool(g);
  if (!poolHas(pool, def.cost)) {
    const miss = poolMissing(pool, def.cost).map((m) => `${m.need - m.have} ${itemById(m.id)?.name ?? m.id}`).join(", ");
    return { ok: false, reason: `Need ${miss}.`, missing: true };
  }
  return { ok: true, replacesFloor };
}

export function build(g, id, x, y) {
  const check = canPlace(g, id, x, y);
  if (!check.ok) return check;
  const def = structById(id);
  poolPay(nearbyPool(g), def.cost);
  if (check.replacesFloor) removeStruct(g, x, y);
  placeStruct(g, x, y, id);
  g.s.stats.built += 1;
  g.s.story.flags[`built:${id}`] = true;
  g.fx.push({ kind: "build", x: x + 0.5, y: y + 0.5, id });
  return { ok: true };
}

// ---- crafting ----
const STATION_RANGE = 3;

export function stationNear(g, station) {
  if (station === "hand") return { hand: true };
  const p = g.s.player;
  let best = null;
  for (const st of g.structs.values()) {
    if (st.id !== station || st.broken) continue;
    const d = Math.hypot(st.x + 0.5 - p.x, st.y + 0.5 - p.y);
    if (d <= STATION_RANGE && (!best || d < best.d)) best = { st, d };
  }
  return best?.st ?? null;
}

export function canCraft(g, rid) {
  const r = recipeById(rid);
  if (!r) return { ok: false, reason: "Unknown recipe." };
  if (!isResearched(g, r.research)) return { ok: false, reason: "Needs research." };
  if (!stationNear(g, r.station)) return { ok: false, reason: `Stand at a ${structById(r.station)?.name ?? r.station}.`, station: true };
  const pool = nearbyPool(g);
  if (!poolHas(pool, r.in)) {
    const miss = poolMissing(pool, r.in).map((m) => `${m.need - m.have} ${itemById(m.id)?.name ?? m.id}`).join(", ");
    return { ok: false, reason: `Need ${miss}.`, missing: true };
  }
  return { ok: true };
}

export function queueCraft(g, rid, times = 1) {
  const s = g.s;
  s.craft = s.craft ?? [];
  let queued = 0;
  for (let k = 0; k < times; k += 1) {
    const c = canCraft(g, rid);
    if (!c.ok) {
      if (!queued) return c;
      break;
    }
    const r = recipeById(rid);
    poolPay(nearbyPool(g), r.in);
    const station = stationNear(g, r.station);
    s.craft.push({ id: rid, t: 0, at: station.hand ? -1 : station.y * g.world.w + station.x });
    queued += 1;
  }
  return { ok: true, queued };
}

export function cancelCraft(g, index) {
  const s = g.s;
  const job = s.craft?.[index];
  if (!job) return false;
  const r = recipeById(job.id);
  for (const [id, n] of Object.entries(r.in)) {
    const left = addTo(s.inv, id, n);
    if (left) s.drops.push({ x: s.player.x, y: s.player.y, id, n: left });
  }
  s.craft.splice(index, 1);
  return true;
}

export function tickCrafting(g, dt) {
  const s = g.s;
  for (const st of g.structs.values()) if (st.busy) st.busy = false;
  const job = s.craft?.[0];
  if (!job) return;
  const r = recipeById(job.id);
  let speed = 1;
  if (job.at >= 0) {
    const st = g.structs.get(job.at);
    if (!st || st.broken) {
      cancelCraft(g, 0);
      g.fx.push({ kind: "toast", text: "Crafting cancelled — station missing." });
      return;
    }
    st.busy = true;
    const def = structById(st.id);
    if (def.power < 0 && !st.powered) speed = 0; // stalled, waiting for power
  }
  job.t += dt * speed;
  if (job.t >= r.time) {
    s.craft.shift();
    const [id, n] = r.out;
    const left = addTo(s.inv, id, n);
    if (left) s.drops.push({ x: s.player.x, y: s.player.y, id, n: left });
    s.stats.crafted += n;
    s.story.flags[`crafted:${id}`] = true;
    g.fx.push({ kind: "crafted", id, n });
  }
}

export { pushLog };
