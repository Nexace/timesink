// kind: raw | refined | food | consumable | tool | seed | part
export const ITEMS = [
  // raw
  { id: "regolith", name: "Regolith", kind: "raw", stack: 99, color: 7 },
  { id: "ice", name: "Ice", kind: "raw", stack: 99, color: 12 },
  { id: "iron-ore", name: "Iron Ore", kind: "raw", stack: 99, color: 5 },
  { id: "silica", name: "Silica Sand", kind: "raw", stack: 99, color: 9 },
  { id: "basalt", name: "Basalt", kind: "raw", stack: 99, color: 3 },
  { id: "sulfur", name: "Sulfur", kind: "raw", stack: 99, color: 10 },
  { id: "scrap", name: "Scrap", kind: "raw", stack: 99, color: 14 },
  { id: "hydrazine", name: "Hydrazine", kind: "raw", stack: 50, color: 11 },
  { id: "sample", name: "Rock Sample", kind: "raw", stack: 50, color: 15 },
  { id: "rare-metal", name: "Rare Metal", kind: "raw", stack: 50, color: 16 },
  // refined
  { id: "metal", name: "Metal Plate", kind: "refined", stack: 99, color: 14 },
  { id: "glass", name: "Glass", kind: "refined", stack: 99, color: 12 },
  { id: "wire", name: "Wire", kind: "refined", stack: 99, color: 10 },
  { id: "circuit", name: "Circuit", kind: "refined", stack: 99, color: 13 },
  { id: "sealant", name: "Sealant", kind: "refined", stack: 99, color: 15 },
  { id: "plastic", name: "Plastic", kind: "refined", stack: 99, color: 16 },
  { id: "concrete", name: "Sulfur Concrete", kind: "refined", stack: 99, color: 7 },
  { id: "compost", name: "Compost", kind: "refined", stack: 99, color: 4 },
  { id: "soil", name: "Soil", kind: "refined", stack: 99, color: 4 },
  { id: "water", name: "Water Pouch", kind: "consumable", stack: 50, color: 12, drink: 35 },
  // food
  { id: "ration", name: "Ration Pack", kind: "food", stack: 50, color: 15 },
  { id: "potato", name: "Potato", kind: "food", stack: 99, color: 10 },
  { id: "lettuce", name: "Lettuce", kind: "food", stack: 99, color: 13 },
  { id: "beans", name: "Beans", kind: "food", stack: 99, color: 13 },
  // seeds
  { id: "seed-potato", name: "Seed Potato", kind: "seed", stack: 99, color: 10, crop: "potato" },
  { id: "seed-lettuce", name: "Lettuce Seeds", kind: "seed", stack: 99, color: 13, crop: "lettuce" },
  { id: "seed-beans", name: "Bean Seeds", kind: "seed", stack: 99, color: 13, crop: "beans" },
  // consumables
  { id: "o2-canister", name: "O₂ Canister", kind: "consumable", stack: 10, color: 12, o2: 60 },
  { id: "medkit", name: "Medkit", kind: "consumable", stack: 10, color: 2, heal: 45 },
  { id: "duct-tape", name: "Duct Tape", kind: "consumable", stack: 20, color: 14, patch: 40 },
  { id: "battery-cell", name: "Battery Cell", kind: "consumable", stack: 10, color: 10, charge: 60 },
  // parts
  { id: "antenna", name: "Lander Antenna", kind: "part", stack: 1, color: 14 },
  { id: "rtg-core", name: "RTG Core", kind: "part", stack: 1, color: 11 },
  // tools
  { id: "drill-1", name: "Hand Drill", kind: "tool", stack: 1, color: 14, tool: "drill", tier: 1 },
  { id: "drill-2", name: "Percussion Drill", kind: "tool", stack: 1, color: 10, tool: "drill", tier: 2 },
  { id: "drill-3", name: "Plasma Drill", kind: "tool", stack: 1, color: 11, tool: "drill", tier: 3 },
  { id: "shovel", name: "Shovel", kind: "tool", stack: 1, color: 14, tool: "shovel", tier: 1 },
  { id: "multitool", name: "Multitool", kind: "tool", stack: 1, color: 13, tool: "multitool", tier: 1 },
  { id: "scanner", name: "Scanner", kind: "tool", stack: 1, color: 12, tool: "scanner", tier: 1 },
  { id: "beacon", name: "Flag Beacon", kind: "consumable", stack: 20, color: 2, place: "beacon" },
];

const byId = new Map(ITEMS.map((i) => [i.id, i]));
export function itemById(id) {
  return byId.get(id) ?? null;
}
export const ITEM_IDS = ITEMS.map((i) => i.id);
