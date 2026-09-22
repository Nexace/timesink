// Terrain layer (one per tile). `solid` blocks walking; `speed` scales walk speed.
export const T = {
  PLAINS: 0,
  DUNE: 1,
  CRATER: 2,
  ICE: 3,
  BASALT: 4,
  CHASM: 5,
  VOLCANIC: 6,
  RAMP: 7,
  DUG: 8, // excavated ground (after shovelling)
  TUBE: 9, // lava tube floor
};

export const TERRAIN = [
  { id: T.PLAINS, name: "Dusty Plains", solid: false, speed: 1, cold: 0 },
  { id: T.DUNE, name: "Dune Sea", solid: false, speed: 0.65, cold: 0 },
  { id: T.CRATER, name: "Crater Floor", solid: false, speed: 1, cold: 0 },
  { id: T.ICE, name: "Ice Margin", solid: false, speed: 0.85, cold: 1 },
  { id: T.BASALT, name: "Basalt Ridge", solid: true, speed: 0, cold: 0 },
  { id: T.CHASM, name: "Chasma", solid: true, speed: 0, cold: 0 },
  { id: T.VOLCANIC, name: "Volcanic Slope", solid: false, speed: 0.9, cold: -1 },
  { id: T.RAMP, name: "Ramp", solid: false, speed: 0.9, cold: 0 },
  { id: T.DUG, name: "Excavated", solid: false, speed: 1, cold: 0 },
  { id: T.TUBE, name: "Lava Tube", solid: false, speed: 1, cold: 0 },
];

// Shovel yield per terrain (regolith-ish)
export const SHOVEL = {
  [T.PLAINS]: { item: "regolith", n: 2 },
  [T.DUNE]: { item: "silica", n: 2 },
  [T.CRATER]: { item: "regolith", n: 2 },
  [T.ICE]: { item: "ice", n: 1 },
  [T.VOLCANIC]: { item: "regolith", n: 1 },
};

// Node layer (resource deposits / props sitting on terrain). 0 = none.
export const N = {
  NONE: 0,
  IRON: 1,
  SILICA: 2,
  ICE: 3,
  SULFUR: 4,
  BOULDER: 5,
  SCRAP: 6,
  SAMPLE: 7,
  HYDRAZINE: 8,
  RARE: 9,
  RTG: 10,
  LANDER: 11,
  MAV: 12,
  CACHE: 13,
};

export const NODES = [
  null,
  { id: N.IRON, name: "Iron Deposit", drop: "iron-ore", n: [1, 2], hp: 5, tier: 1, solid: true, scan: true },
  { id: N.SILICA, name: "Silica Outcrop", drop: "silica", n: [2, 3], hp: 3, tier: 1, solid: true, scan: true },
  { id: N.ICE, name: "Ice Lens", drop: "ice", n: [2, 3], hp: 4, tier: 1, solid: true, scan: true },
  { id: N.SULFUR, name: "Sulfur Vent Crust", drop: "sulfur", n: [1, 3], hp: 4, tier: 2, solid: true, scan: true },
  { id: N.BOULDER, name: "Basalt Boulder", drop: "basalt", n: [2, 3], hp: 6, tier: 1, solid: true, scan: false },
  { id: N.SCRAP, name: "Wreckage", drop: "scrap", n: [2, 4], hp: 3, tier: 1, solid: true, scan: true },
  { id: N.SAMPLE, name: "Geologic Sample", drop: "sample", n: [1, 1], hp: 1, tier: 1, solid: false, scan: true },
  { id: N.HYDRAZINE, name: "Descent-Stage Tank", drop: "hydrazine", n: [3, 5], hp: 4, tier: 1, solid: true, scan: true },
  { id: N.RARE, name: "Rare-Metal Seam", drop: "rare-metal", n: [1, 2], hp: 8, tier: 3, solid: true, scan: true },
  { id: N.RTG, name: "Buried RTG", drop: "rtg-core", n: [1, 1], hp: 8, tier: 1, solid: true, scan: true, unique: true },
  { id: N.LANDER, name: "Old Lander", drop: "antenna", n: [1, 1], hp: 8, tier: 1, solid: true, scan: true, unique: true },
  { id: N.MAV, name: "HELIOS MAV", drop: null, n: [0, 0], hp: 255, tier: 9, solid: true, scan: true, unique: true, interact: true },
  { id: N.CACHE, name: "Supply Cache", drop: "cache", n: [1, 1], hp: 2, tier: 1, solid: true, scan: true },
];

// Loot rolled from a supply cache (weighted).
export const CACHE_LOOT = [
  { id: "ration", n: [2, 5], weight: 3 },
  { id: "o2-canister", n: [1, 2], weight: 2 },
  { id: "circuit", n: [2, 4], weight: 2 },
  { id: "wire", n: [3, 6], weight: 2 },
  { id: "plastic", n: [2, 4], weight: 2 },
  { id: "medkit", n: [1, 2], weight: 1.5 },
  { id: "duct-tape", n: [2, 4], weight: 1.5 },
  { id: "battery-cell", n: [1, 2], weight: 1 },
  { id: "seed-lettuce", n: [2, 3], weight: 0.8 },
];

export function isColdTerrain(t) {
  return TERRAIN[t]?.cold === 1;
}
