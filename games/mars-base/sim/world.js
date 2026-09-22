import { TERRAIN, NODES } from "../data/tiles.js";
import { structById } from "../data/structures.js";
import { chunkKey } from "./state.js";

export function inBounds(g, x, y) {
  return x >= 0 && y >= 0 && x < g.world.w && y < g.world.h;
}
export function tIdx(g, x, y) {
  return y * g.world.w + x;
}
export function terrainAt(g, x, y) {
  if (!inBounds(g, x, y)) return 5; // chasm-like void
  return g.world.terrain[y * g.world.w + x];
}
export function nodeAt(g, x, y) {
  if (!inBounds(g, x, y)) return 0;
  return g.world.nodes[y * g.world.w + x];
}
export function structAt(g, x, y) {
  if (!inBounds(g, x, y)) return null;
  return g.structs.get(y * g.world.w + x) ?? null;
}

export function setTerrain(g, x, y, t) {
  const i = tIdx(g, x, y);
  g.world.terrain[i] = t;
  g.s.diff.t[i] = t;
  g.dirtyChunks.add(chunkKey(g, x, y));
}
export function setNode(g, x, y, n) {
  const i = tIdx(g, x, y);
  g.world.nodes[i] = n;
  g.world.nodeHp[i] = n ? NODES[n].hp : 0;
  g.s.diff.n[i] = n;
  g.dirtyChunks.add(chunkKey(g, x, y));
}

// Solid for walking (player/colonists). Airlocks and floors are passable.
export function blocksWalk(g, x, y) {
  if (!inBounds(g, x, y)) return true;
  const i = y * g.world.w + x;
  if (TERRAIN[g.world.terrain[i]].solid) return true;
  const n = g.world.nodes[i];
  if (n && NODES[n].solid) return true;
  const st = g.structs.get(i);
  if (st) {
    const def = structById(st.id);
    if (def.solid) return true;
  }
  return false;
}

export function walkSpeedAt(g, x, y) {
  const t = terrainAt(g, x, y);
  const st = structAt(g, x, y);
  if (st) return 1.1; // decking is fast
  return TERRAIN[t]?.speed || 1;
}

export function applyDiff(g) {
  for (const [k, v] of Object.entries(g.s.diff.t)) g.world.terrain[Number(k)] = v;
  for (const [k, v] of Object.entries(g.s.diff.n)) {
    g.world.nodes[Number(k)] = v;
    g.world.nodeHp[Number(k)] = v ? NODES[v].hp : 0;
  }
}
