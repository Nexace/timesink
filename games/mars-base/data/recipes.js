// station: "hand" = anywhere; otherwise must stand near that station. time in seconds.
export const RECIPES = [
  { id: "metal-scrap", out: ["metal", 1], in: { scrap: 2 }, station: "hand", time: 2 },
  { id: "wire-scrap", out: ["wire", 2], in: { scrap: 1 }, station: "workbench", time: 2 },
  { id: "sealant", out: ["sealant", 2], in: { regolith: 2, hydrazine: 1 }, station: "workbench", time: 3 },
  { id: "sealant-sulfur", out: ["sealant", 3], in: { sulfur: 1, regolith: 2 }, station: "workbench", time: 3 },
  { id: "duct-tape", out: ["duct-tape", 2], in: { plastic: 1 }, station: "workbench", time: 2 },
  { id: "circuit-scrap", out: ["circuit", 1], in: { scrap: 3, wire: 1 }, station: "workbench", time: 4 },
  { id: "soil", out: ["soil", 2], in: { regolith: 2, compost: 1 }, station: "hand", time: 2 },
  { id: "plastic-hyd", out: ["plastic", 2], in: { hydrazine: 1, scrap: 1 }, station: "workbench", time: 3 },
  { id: "beacon", out: ["beacon", 3], in: { scrap: 1 }, station: "hand", time: 1 },
  { id: "melt-ice", out: ["water", 1], in: { ice: 1 }, station: "hand", time: 2 },

  { id: "metal", out: ["metal", 2], in: { "iron-ore": 2 }, station: "smelter", time: 3 },
  { id: "glass", out: ["glass", 2], in: { silica: 3 }, station: "smelter", time: 3 },
  { id: "wire", out: ["wire", 3], in: { "iron-ore": 1, scrap: 1 }, station: "smelter", time: 3 },
  { id: "concrete", out: ["concrete", 3], in: { sulfur: 1, regolith: 3 }, station: "smelter", time: 4 },
  { id: "basalt-metal", out: ["metal", 1], in: { basalt: 3 }, station: "smelter", time: 4 },

  { id: "circuit", out: ["circuit", 2], in: { silica: 1, wire: 2, metal: 1 }, station: "fabricator", time: 4 },
  { id: "plastic", out: ["plastic", 2], in: { sulfur: 1, regolith: 1, ice: 1 }, station: "fabricator", time: 3 },
  { id: "o2-canister", out: ["o2-canister", 1], in: { metal: 1, ice: 2 }, station: "fabricator", time: 4 },
  { id: "medkit", out: ["medkit", 1], in: { plastic: 1, lettuce: 1, water: 1 }, station: "fabricator", time: 4 },
  { id: "battery-cell", out: ["battery-cell", 1], in: { metal: 1, wire: 1, circuit: 1 }, station: "fabricator", time: 4 },
  { id: "drill-2", out: ["drill-2", 1], in: { metal: 6, circuit: 2, wire: 2 }, station: "fabricator", time: 8, research: "drill2" },
  { id: "drill-3", out: ["drill-3", 1], in: { metal: 6, circuit: 4, "rare-metal": 2 }, station: "fabricator", time: 10, research: "drill3" },
];

const byId = new Map(RECIPES.map((r) => [r.id, r]));
export function recipeById(id) {
  return byId.get(id) ?? null;
}
