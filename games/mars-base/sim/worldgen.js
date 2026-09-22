import { createRng, hashSeed } from "../../../shared/rng.js";
import { createNoise } from "./noise.js";
import { T, N, TERRAIN, NODES } from "../data/tiles.js";
import { WORLD_W, WORLD_H } from "../data/balance.js";

// Deterministic world from a seed. Returns plain typed arrays + POI list.
export function generateWorld(seed, { w = WORLD_W, h = WORLD_H } = {}) {
  const rng = createRng(hashSeed(`mars:${seed}:world`));
  const height = createNoise(seed, "height");
  const moist = createNoise(seed, "moist");
  const ridge = createNoise(seed, "ridge");
  const warp = createNoise(seed, "warp");
  const terrain = new Uint8Array(w * h);
  const nodes = new Uint8Array(w * h);
  const idx = (x, y) => y * w + x;
  const inb = (x, y) => x >= 0 && y >= 0 && x < w && y < h;

  const start = { x: Math.floor(w * 0.5), y: Math.floor(h * 0.6) };
  const volcanic = { x: w * 0.8, y: h * 0.8 };
  if (rng.chance(0.5)) volcanic.x = w * 0.2;

  // 1. Biomes
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const hv = height.fbm(x / 48, y / 48, 5);
      const mv = moist.fbm(x / 70 + 100, y / 70, 3);
      const wv = warp.fbm(x / 30, y / 30, 2) - 0.5;
      const lat = y / h;
      let t = T.PLAINS;
      if (mv > 0.6) t = T.DUNE;
      if (lat < 0.17 + wv * 0.16) t = T.ICE;
      const vd = Math.hypot(x - volcanic.x, y - volcanic.y) / w;
      if (vd < 0.17 + wv * 0.1 && hv > 0.38) t = T.VOLCANIC;
      if (ridge.ridged(x / 44, y / 44) > 0.88 && hv > 0.45) t = T.BASALT;
      terrain[idx(x, y)] = t;
    }
  }

  // 2. Chasma: a meandering rift across the map, north of the start.
  const phase = rng.float(0, Math.PI * 2);
  for (let x = 0; x < w; x += 1) {
    const cy = h * 0.36 + 16 * Math.sin(x / 37 + phase) + (warp.fbm(x / 60, 7.5, 3) - 0.5) * 50;
    const half = 1.8 + warp.value(x / 12, 3.3) * 2.2;
    for (let y = Math.floor(cy - half); y <= Math.ceil(cy + half); y += 1) {
      if (inb(x, y)) terrain[idx(x, y)] = T.CHASM;
    }
  }
  // Ramps across the chasma (3–4 crossings).
  const crossings = rng.int(3, 4);
  for (let i = 0; i < crossings; i += 1) {
    const cx = Math.floor(((i + 0.5) / crossings) * w + rng.int(-20, 20));
    for (let x = cx - 1; x <= cx + 1; x += 1) {
      for (let y = 0; y < h; y += 1) {
        if (inb(x, y) && terrain[idx(x, y)] === T.CHASM) terrain[idx(x, y)] = T.RAMP;
      }
    }
  }

  // 3. Craters
  const craterCount = 28;
  for (let i = 0; i < craterCount; i += 1) {
    const cx = rng.int(10, w - 10);
    const cy = rng.int(10, h - 10);
    const r = rng.float(5, 14);
    if (Math.hypot(cx - start.x, cy - start.y) < r + 26) continue;
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y += 1) {
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x += 1) {
        if (!inb(x, y)) continue;
        const i2 = idx(x, y);
        if (terrain[i2] === T.CHASM || terrain[i2] === T.RAMP) continue;
        const d = Math.hypot(x - cx, y - cy);
        if (d < r * 0.82) terrain[i2] = T.CRATER;
        else if (d <= r && warp.value(x / 3, y / 3) > 0.42) terrain[i2] = T.BASALT;
      }
    }
  }

  // 4. Scatter resource nodes (hash-based so it does not depend on loop order)
  const scatter = createNoise(seed, "scatter");
  const place = (x, y, n) => {
    if (!inb(x, y)) return false;
    const i2 = idx(x, y);
    if (TERRAIN[terrain[i2]].solid || nodes[i2]) return false;
    nodes[i2] = n;
    return true;
  };
  const table = {
    [T.PLAINS]: [[N.BOULDER, 0.006], [N.SILICA, 0.0025], [N.IRON, 0.002], [N.SAMPLE, 0.0005]],
    [T.DUNE]: [[N.SILICA, 0.012], [N.BOULDER, 0.002]],
    [T.CRATER]: [[N.IRON, 0.03], [N.BOULDER, 0.01], [N.SAMPLE, 0.002]],
    [T.ICE]: [[N.ICE, 0.035], [N.BOULDER, 0.003]],
    [T.VOLCANIC]: [[N.SULFUR, 0.022], [N.BOULDER, 0.01], [N.RARE, 0.0025], [N.SAMPLE, 0.001]],
  };
  for (let y = 1; y < h - 1; y += 1) {
    for (let x = 1; x < w - 1; x += 1) {
      const list = table[terrain[idx(x, y)]];
      if (!list) continue;
      let roll = scatter.hash(x, y);
      for (const [n, p] of list) {
        if (roll < p) {
          place(x, y, n);
          break;
        }
        roll -= p;
      }
    }
  }

  // 5. Clear the landing zone.
  const clear = (cx, cy, r, keepNodes = false) => {
    for (let y = cy - r; y <= cy + r; y += 1) {
      for (let x = cx - r; x <= cx + r; x += 1) {
        if (!inb(x, y) || Math.hypot(x - cx, y - cy) > r) continue;
        const i2 = idx(x, y);
        if (TERRAIN[terrain[i2]].solid) terrain[i2] = terrain[i2] === T.CHASM ? T.RAMP : T.PLAINS;
        if (!keepNodes) nodes[i2] = 0;
      }
    }
  };
  clear(start.x, start.y, 22);
  for (let y = start.y - 22; y <= start.y + 22; y += 1) {
    for (let x = start.x - 22; x <= start.x + 22; x += 1) {
      if (inb(x, y) && Math.hypot(x - start.x, y - start.y) <= 22 && terrain[idx(x, y)] !== T.RAMP) terrain[idx(x, y)] = T.PLAINS;
    }
  }

  const pois = [];
  const addPoi = (kind, name, x, y) => {
    const p = { id: `${kind}-${pois.length}`, kind, name, x, y };
    pois.push(p);
    return p;
  };
  addPoi("hab", "HELIOS-3 Hab", start.x, start.y);

  // Debris field around the hab — early scrap.
  let placed = 0;
  for (let guard = 0; placed < 30 && guard < 600; guard += 1) {
    const a = rng.float(0, Math.PI * 2);
    const d = rng.float(8, 17);
    const x = Math.round(start.x + Math.cos(a) * d);
    const y = Math.round(start.y + Math.sin(a) * d);
    if (Math.abs(x - start.x) < 8 && y > start.y - 7 && y < start.y + 9) continue; // keep hab/rover apron clear
    if (place(x, y, N.SCRAP)) placed += 1;
  }
  // A few nearby basics so the first sol is possible anywhere.
  const ring = (n, count, rMin, rMax) => {
    let c = 0;
    for (let guard = 0; c < count && guard < 400; guard += 1) {
      const a = rng.float(0, Math.PI * 2);
      const d = rng.float(rMin, rMax);
      if (place(Math.round(start.x + Math.cos(a) * d), Math.round(start.y + Math.sin(a) * d), n)) c += 1;
    }
  };
  ring(N.BOULDER, 10, 12, 22);
  ring(N.SILICA, 6, 14, 24);
  ring(N.IRON, 6, 16, 26);
  ring(N.ICE, 4, 26, 34); // a little frozen ground nearby so water isn't gated behind the chasma
  ring(N.SAMPLE, 2, 14, 22);

  const spot = (minD, maxD, angle = null, spread = Math.PI) => {
    for (let guard = 0; guard < 400; guard += 1) {
      const a = angle === null ? rng.float(0, Math.PI * 2) : angle + rng.float(-spread, spread);
      const d = rng.float(minD, maxD);
      const x = Math.round(start.x + Math.cos(a) * d);
      const y = Math.round(start.y + Math.sin(a) * d);
      if (x < 8 || y < 8 || x >= w - 8 || y >= h - 8) continue;
      if (pois.some((p) => Math.hypot(p.x - x, p.y - y) < 18)) continue;
      return { x, y };
    }
    return { x: Math.min(w - 10, start.x + minD), y: start.y };
  };

  // MDV wreck — hydrazine + scrap
  {
    const p = spot(30, 44);
    clear(p.x, p.y, 4);
    addPoi("wreck", "Descent-Stage Wreck", p.x, p.y);
    place(p.x, p.y, N.HYDRAZINE);
    place(p.x + 1, p.y, N.HYDRAZINE);
    place(p.x, p.y + 1, N.HYDRAZINE);
    for (let i = 0; i < 12; i += 1) place(p.x + rng.int(-4, 4), p.y + rng.int(-4, 4), i % 3 === 0 ? N.HYDRAZINE : N.SCRAP);
  }
  // Buried RTG, roughly south-east
  {
    const p = spot(38, 52, Math.PI / 4, 0.6);
    clear(p.x, p.y, 2);
    nodes[idx(p.x, p.y)] = N.RTG;
    addPoi("rtg", "Buried RTG", p.x, p.y);
  }
  // Old lander (comms quest)
  {
    const p = spot(125, 160);
    clear(p.x, p.y, 4);
    nodes[idx(p.x, p.y)] = N.LANDER;
    for (let i = 0; i < 5; i += 1) place(p.x + rng.int(-3, 3), p.y + rng.int(-3, 3), N.SCRAP);
    addPoi("lander", "Old Lander", p.x, p.y);
  }
  // MAV pad — farthest corner-ish from start
  {
    const corners = [
      { x: 16, y: 16 }, { x: w - 17, y: 16 }, { x: 16, y: h - 17 }, { x: w - 17, y: h - 17 },
    ].map((c) => ({ ...c, d: Math.hypot(c.x - start.x, c.y - start.y) }));
    corners.sort((a, b) => b.d - a.d);
    const c = corners[rng.int(0, 1)];
    const x = c.x + rng.int(-6, 6);
    const y = c.y + rng.int(-6, 6);
    clear(x, y, 5);
    nodes[idx(x, y)] = N.MAV;
    addPoi("mav", "Schiaparelli MAV Pad", x, y);
  }
  // Lava tube: walkable tube floor behind a basalt shell, with rare metal inside.
  {
    const p = spot(60, 115);
    for (let y = p.y - 4; y <= p.y + 4; y += 1) {
      for (let x = p.x - 6; x <= p.x + 6; x += 1) {
        if (!inb(x, y)) continue;
        const edge = Math.abs(y - p.y) === 4 || Math.abs(x - p.x) === 6;
        terrain[idx(x, y)] = edge ? T.BASALT : T.TUBE;
        nodes[idx(x, y)] = 0;
      }
    }
    // entrance on the side facing the start
    const ex = p.x + (start.x < p.x ? -6 : 6);
    for (let y = p.y - 1; y <= p.y + 1; y += 1) if (inb(ex, y)) terrain[idx(ex, y)] = T.TUBE;
    place(p.x + 3, p.y - 2, N.RARE);
    place(p.x - 3, p.y + 2, N.RARE);
    place(p.x + 1, p.y + 2, N.RARE);
    place(p.x - 1, p.y - 2, N.SAMPLE);
    addPoi("tube", "Lava Tube", p.x, p.y);
  }
  // Supply caches
  for (let i = 0; i < 5; i += 1) {
    const p = spot(40, 170);
    clear(p.x, p.y, 1);
    nodes[idx(p.x, p.y)] = N.CACHE;
    addPoi("cache", "Supply Cache", p.x, p.y);
  }
  // Science sites
  for (let i = 0; i < 3; i += 1) {
    const p = spot(50, 150);
    clear(p.x, p.y, 2);
    for (let k = 0; k < 4; k += 1) place(p.x + rng.int(-2, 2), p.y + rng.int(-2, 2), N.SAMPLE);
    addPoi("science", "Science Site", p.x, p.y);
  }

  // 6. Guarantee reachability: carve ramps from anything unreachable toward the start.
  const world = { w, h, terrain, nodes, nodeHp: new Uint8Array(w * h), pois, start, seed };
  ensureReachable(world);
  // Also guarantee the ice sheet is reachable (water must never be gated).
  const reach = floodReach(world);
  let iceReachable = false;
  for (let i = 0; i < w * h && !iceReachable; i += 1) if (reach[i] && terrain[i] === T.ICE) iceReachable = true;
  if (!iceReachable) carve(world, start.x, 4, reach);

  for (let i = 0; i < w * h; i += 1) if (nodes[i]) world.nodeHp[i] = NODES[nodes[i]].hp;
  return world;
}

export function floodReach(world) {
  const { w, h, terrain } = world;
  const seen = new Uint8Array(w * h);
  const q = new Int32Array(w * h);
  let head = 0;
  let tail = 0;
  const s = world.start.y * w + world.start.x;
  seen[s] = 1;
  q[tail++] = s;
  while (head < tail) {
    const i = q[head++];
    const x = i % w;
    const y = (i - x) / w;
    const nb = [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1];
    for (const j of nb) {
      if (j < 0 || seen[j] || TERRAIN[terrain[j]].solid) continue;
      seen[j] = 1;
      q[tail++] = j;
    }
  }
  return seen;
}

function carve(world, tx, ty, reach) {
  const { w, terrain } = world;
  let x = tx;
  let y = ty;
  const sx = world.start.x;
  const sy = world.start.y;
  for (let guard = 0; guard < world.w + world.h; guard += 1) {
    const i = y * w + x;
    if (reach[i] && !TERRAIN[terrain[i]].solid) return;
    if (TERRAIN[terrain[i]].solid) terrain[i] = terrain[i] === T.CHASM ? T.RAMP : T.PLAINS;
    // also widen by one so the rover fits
    if (x + 1 < w && TERRAIN[terrain[i + 1]].solid) terrain[i + 1] = terrain[i + 1] === T.CHASM ? T.RAMP : T.PLAINS;
    if (x === sx && y === sy) return;
    if (Math.abs(sx - x) > Math.abs(sy - y)) x += Math.sign(sx - x);
    else y += Math.sign(sy - y);
  }
}

export function ensureReachable(world) {
  for (let pass = 0; pass < 20; pass += 1) {
    const reach = floodReach(world);
    const missing = world.pois.filter((p) => !nearReach(world, reach, p));
    if (!missing.length) return;
    carve(world, missing[0].x, missing[0].y, reach);
  }
}

// A POI whose center is a solid node counts as reachable if a neighbour is.
function nearReach(world, reach, p) {
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      if (reach[(p.y + dy) * world.w + (p.x + dx)]) return true;
    }
  }
  return false;
}

export function worldHash(world) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < world.terrain.length; i += 1) {
    h ^= world.terrain[i] * 31 + world.nodes[i];
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
