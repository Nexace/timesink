// IRONSAIL — pure world generation, economy and progression rules (no DOM). Deterministic from a seed.

export const WORLD = 14000; // square ocean, px
export const SECTOR = WORLD / 3;
export const SAVE_KEY = "timesink:ironsail:v2";

export const SECTORS = [
  ["Sapphire Shallows", "Coral Reach", "Gull Rocks"],
  ["Smugglers' Run", "The Crown Isles", "Tempest Belt"],
  ["Devil's Shroud", "Bonefield Strait", "Abyssal Trench"]
];
// Danger 0 (home waters) … 4 (boss seas) per sector
export const SECTOR_DANGER = [
  [1, 1, 2],
  [2, 0, 3],
  [4, 3, 4]
];
export const sectorOf = (x, y) => {
  const c = Math.max(0, Math.min(2, Math.floor(x / SECTOR)));
  const r = Math.max(0, Math.min(2, Math.floor(y / SECTOR)));
  return { r, c, name: SECTORS[r][c], danger: SECTOR_DANGER[r][c] };
};

export const COMMODITIES = [
  { id: "rum", name: "Rum", base: 22 },
  { id: "sugar", name: "Sugar", base: 14 },
  { id: "spice", name: "Spices", base: 48 },
  { id: "silk", name: "Silk", base: 70 },
  { id: "timber", name: "Timber", base: 11 },
  { id: "iron", name: "Iron", base: 34 }
];

export const SHIPS = [
  { id: "sloop", name: "Coastal Sloop", hull: 180, speed: 1, turn: 1.25, guns: 2, cargo: 30, price: 0, len: 72, beam: 24 },
  { id: "brig", name: "War Brig", hull: 320, speed: 0.95, turn: 1.05, guns: 4, cargo: 60, price: 1400, len: 88, beam: 28 },
  { id: "frigate", name: "Frigate", hull: 520, speed: 0.9, turn: 0.9, guns: 6, cargo: 90, price: 4200, len: 106, beam: 32 },
  { id: "galleon", name: "Royal Galleon", hull: 820, speed: 0.8, turn: 0.72, guns: 9, cargo: 160, price: 9800, len: 126, beam: 38 }
];

export const UPGRADES = [
  { id: "plating", name: "Iron Plating", desc: "+15% hull per level", base: 260 },
  { id: "guns", name: "Heavy Shot", desc: "+14% cannon damage per level", base: 300 },
  { id: "sails", name: "Silk Sails", desc: "+6% speed per level", base: 240 },
  { id: "crew", name: "Gun Crews", desc: "-9% reload time per level", base: 280 }
];
export const MAX_UPGRADE = 5;
export const upgradeCost = (u, lvl) => Math.round(u.base * Math.pow(1.75, lvl));

const NAME_A = ["Tortuga", "Port", "Isla", "Fort", "Cape", "Saint", "Blackwater", "Gull", "Coral", "Mariner's", "Old", "Dead Man's", "Red", "Amber", "Driftwood", "Shark", "Lantern", "Mermaid", "Cannon", "Rum"];
const NAME_B = ["Haven", "Royal", "Cay", "Key", "Point", "Hollow", "Bluff", "Harbor", "Reach", "Rock", "Landing", "Isle", "Cove", "Bay", "Spire", "Atoll"];

export function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Wobbly island outline: radius per angle from a few summed sines. */
function islandShape(rand, rx, ry) {
  const n = 40;
  const waves = [2, 3, 5, 7].map((k) => [k, rand() * Math.PI * 2, (rand() * 0.16) / Math.sqrt(k)]);
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    let r = 1;
    for (const [k, ph, amp] of waves) r += Math.sin(a * k + ph) * amp;
    pts.push([Math.cos(a) * rx * r, Math.sin(a) * ry * r]);
  }
  return pts;
}

export function generateWorld(seed = 1717) {
  const rand = rng(seed);
  const islands = [];
  const used = new Set();
  const nameFor = () => {
    for (let k = 0; k < 50; k++) {
      const n = `${NAME_A[Math.floor(rand() * NAME_A.length)]} ${NAME_B[Math.floor(rand() * NAME_B.length)]}`;
      if (!used.has(n)) {
        used.add(n);
        return n;
      }
    }
    return `Isle ${used.size}`;
  };
  const far = (x, y, d) => islands.every((i) => Math.hypot(i.x - x, i.y - y) > d + i.r);
  // Home port first, dead centre of the Crown Isles
  const home = { id: 0, name: "Tortuga Haven", x: WORLD / 2, y: WORLD / 2, r: 300 };
  islands.push(home);
  used.add(home.name);
  for (let guard = 0; islands.length < 30 && guard < 4000; guard++) {
    const x = 500 + rand() * (WORLD - 1000);
    const y = 500 + rand() * (WORLD - 1000);
    const r = 170 + rand() * 230;
    if (!far(x, y, r + 700)) continue;
    const sec = sectorOf(x, y);
    // Boss seas keep open water for the fights
    if ((sec.r === 2 && sec.c === 0) || (sec.r === 2 && sec.c === 2)) if (rand() < 0.5) continue;
    islands.push({ id: islands.length, name: nameFor(), x, y, r });
  }
  for (const isl of islands) {
    const irand = rng(seed * 31 + isl.id * 977);
    const sec = sectorOf(isl.x, isl.y);
    isl.shape = islandShape(irand, isl.r, isl.r * (0.7 + irand() * 0.35));
    isl.danger = sec.danger;
    isl.forts = isl.id === 0 ? 0 : 1 + Math.min(3, Math.floor(sec.danger * 0.7 + irand() * 1.4));
    isl.guards = isl.id === 0 ? 0 : Math.min(4, Math.floor(sec.danger * 0.8 + irand() * 1.5));
    isl.tax = Math.round(20 + isl.r * 0.08 + sec.danger * 12);
    // Market personality: produces two goods cheaply, craves two others
    const ids = COMMODITIES.map((c) => c.id).sort(() => irand() - 0.5);
    isl.produces = ids.slice(0, 2);
    isl.demands = ids.slice(2, 4);
    isl.hasLighthouse = irand() < 0.35;
    isl.town = 3 + Math.floor(irand() * 6);
    isl.palms = 8 + Math.floor(irand() * 16);
    isl.dockAngle = irand() * Math.PI * 2;
  }

  // Open-ocean features, away from islands and the spawn
  const features = [];
  const clearOfIslands = (x, y, d) => islands.every((i) => Math.hypot(i.x - x, i.y - y) > i.r * 1.3 + d);
  const place = (kind, count, minD, extra = () => ({})) => {
    for (let k = 0, guard = 0; k < count && guard < count * 60; guard++) {
      const x = 300 + rand() * (WORLD - 600);
      const y = 300 + rand() * (WORLD - 600);
      if (!clearOfIslands(x, y, minD) || Math.hypot(x - home.x, y - home.y) < 900) continue;
      if (features.some((f) => Math.hypot(f.x - x, f.y - y) < minD)) continue;
      features.push({ kind, x, y, seed: Math.floor(rand() * 1e9), ...extra() });
      k++;
    }
  };
  place("rocks", 70, 260, () => ({ count: 3 + Math.floor(rand() * 6), spread: 60 + rand() * 110 }));
  place("stack", 26, 300, () => ({ h: 40 + rand() * 50 }));
  place("reef", 22, 380, () => ({ r: 120 + rand() * 160 }));
  place("wreck", 24, 300, () => ({ angle: rand() * Math.PI * 2, size: 0.8 + rand() * 0.7 }));
  place("ruins", 10, 400, () => ({ pillars: 5 + Math.floor(rand() * 5) }));
  place("lighthouse", 9, 400);
  place("buoy", 40, 200);
  place("whirlpool", 5, 700, () => ({ r: 170 + rand() * 90 }));
  place("crate", 110, 120, () => ({ loot: rand() < 0.3 ? "cargo" : "gold" }));

  // Boss lairs
  const bosses = [
    { id: "ghost", name: "The Ghost Ship", x: SECTOR * 0.5, y: SECTOR * 2.5, hp: 2600 },
    { id: "kraken", name: "The Kraken", x: SECTOR * 2.5, y: SECTOR * 2.5, hp: 3600 }
  ];
  return { seed, islands, features, bosses, home };
}

/** Commodity price at an island for a given 2-minute market epoch. */
export function priceAt(world, island, commodityId, epoch) {
  const c = COMMODITIES.find((q) => q.id === commodityId);
  const r = rng((world.seed * 7919 + island.id * 104729 + epoch * 1299709 + commodityId.length * 31) >>> 0);
  let m = 0.85 + r() * 0.3;
  if (island.produces.includes(commodityId)) m *= 0.62;
  if (island.demands.includes(commodityId)) m *= 1.45;
  return Math.max(2, Math.round(c.base * m));
}
export const sellPrice = (buy) => Math.max(1, Math.floor(buy * 0.9));

export function shipStats(tier, upgrades = {}) {
  const s = SHIPS[Math.max(0, Math.min(SHIPS.length - 1, tier))];
  const u = (id) => Math.max(0, Math.min(MAX_UPGRADE, upgrades[id] || 0));
  return {
    ...s,
    maxHull: Math.round(s.hull * (1 + 0.15 * u("plating"))),
    damage: 14 * (1 + 0.14 * u("guns")),
    speedMult: s.speed * (1 + 0.06 * u("sails")),
    reload: 2.1 * Math.pow(0.91, u("crew"))
  };
}

/** Sailing speed factor from the angle between heading and the wind (both radians). */
export function windFactor(heading, windDir) {
  let d = Math.abs(((heading - windDir + Math.PI * 3) % (Math.PI * 2)) - Math.PI); // 0 = running with the wind
  // Into the wind (irons) is slowest, beam reach fastest, dead run slightly slower than a reach
  const reach = Math.sin(d);
  const run = Math.cos(d);
  return Math.max(0.38, 0.55 + reach * 0.45 + Math.max(0, run) * 0.25 - Math.max(0, -run) * 0.35);
}

/** Pirate raiders for a 2000px cell: deterministic per cell and 3-minute epoch. */
export function pirateSpawns(world, cx, cy, epoch) {
  const x0 = cx * 2000;
  const y0 = cy * 2000;
  const sec = sectorOf(x0 + 1000, y0 + 1000);
  const r = rng((world.seed * 2654435761 + cx * 73856093 + cy * 19349663 + epoch * 83492791) >>> 0);
  const out = [];
  if (sec.danger === 0 && r() < 0.8) return out;
  const groups = r() < 0.25 + sec.danger * 0.12 ? 1 + (r() < sec.danger * 0.12 ? 1 : 0) : 0;
  for (let g = 0; g < groups; g++) {
    const gx = x0 + 200 + r() * 1600;
    const gy = y0 + 200 + r() * 1600;
    if (world.islands.some((i) => Math.hypot(i.x - gx, i.y - gy) < i.r + 250)) continue;
    // Lone raiders are common; packs of 2–4 get likelier in dangerous seas
    const size = r() < Math.max(0.3, 0.7 - sec.danger * 0.12) ? 1 : 2 + Math.floor(r() * Math.min(3, 1 + sec.danger * 0.6));
    const tier = Math.min(3, Math.floor(sec.danger * 0.6 + r() * 1.2));
    for (let k = 0; k < size; k++) out.push({ x: gx + (k % 2 ? 1 : -1) * k * 60, y: gy + k * 50, tier, pack: size > 1, leader: k === 0, group: `${cx},${cy},${epoch},${g}` });
  }
  return out;
}

export function newSave() {
  return { v: 2, gold: 250, tier: 0, upgrades: {}, cargo: {}, captured: [0], bosses: [], hull: null, x: WORLD / 2 + 420, y: WORLD / 2, played: 0 };
}

/** Clamp and whitelist a loaded save so bad data can never break the game. */
export function validateSave(data, world) {
  const s = newSave();
  if (!data || typeof data !== "object" || data.v !== 2) return s;
  const num = (v, d, lo, hi) => (Number.isFinite(Number(v)) ? Math.min(hi, Math.max(lo, Number(v))) : d);
  s.gold = Math.floor(num(data.gold, s.gold, 0, 1e8));
  s.tier = Math.floor(num(data.tier, 0, 0, SHIPS.length - 1));
  for (const u of UPGRADES) s.upgrades[u.id] = Math.floor(num(data.upgrades?.[u.id], 0, 0, MAX_UPGRADE));
  for (const c of COMMODITIES) {
    const n = Math.floor(num(data.cargo?.[c.id], 0, 0, 999));
    if (n) s.cargo[c.id] = n;
  }
  const ids = new Set(world.islands.map((i) => i.id));
  s.captured = [...new Set([0, ...(Array.isArray(data.captured) ? data.captured : [])])].filter((i) => ids.has(i));
  s.bosses = (Array.isArray(data.bosses) ? data.bosses : []).filter((b) => b === "ghost" || b === "kraken");
  s.hull = data.hull == null ? null : num(data.hull, null, 1, 1e6);
  s.x = num(data.x, s.x, 100, WORLD - 100);
  s.y = num(data.y, s.y, 100, WORLD - 100);
  s.played = num(data.played, 0, 0, 1e9);
  return s;
}

export const cargoCount = (cargo) => Object.values(cargo).reduce((a, b) => a + b, 0);
export const hasWon = (save, world) => save.captured.length >= world.islands.length && save.bosses.length === 2;
