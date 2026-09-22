// cost in research points (RP). Lab converts 1 sample -> 10 RP over time.
export const RESEARCH = [
  // Life support
  { id: "oxy2", branch: "life", name: "Catalytic Oxygenator", cost: 20, desc: "Oxygenators +50% output." },
  { id: "reclaim95", branch: "life", name: "Membrane Reclaimer", cost: 25, req: ["oxy2"], desc: "Water reclaim 95%." },
  { id: "algae", branch: "life", name: "Algae Vats", cost: 30, req: ["oxy2"], desc: "Unlocks the Algae Vat." },
  { id: "insulation", branch: "life", name: "Aerogel Insulation", cost: 30, req: ["reclaim95"], desc: "Rooms lose heat 50% slower." },
  // Agriculture
  { id: "lettuce", branch: "farm", name: "Leafy Greens", cost: 10, desc: "Gives lettuce seeds (5). Fast crop." },
  { id: "beans", branch: "farm", name: "Legumes", cost: 20, req: ["lettuce"], desc: "Gives bean seeds (5). Hearty crop." },
  { id: "hydroponics", branch: "farm", name: "Hydroponics", cost: 35, req: ["beans"], desc: "Crops grow 35% faster." },
  { id: "fertilizer", branch: "farm", name: "Nitrogen Fixing", cost: 30, req: ["lettuce"], desc: "+1 yield per harvest." },
  // Engineering
  { id: "fabrication", branch: "eng", name: "Fabrication", cost: 10, desc: "Unlocks the Fabricator." },
  { id: "drill2", branch: "eng", name: "Percussion Drill", cost: 20, req: ["fabrication"], desc: "Tier 2 drill: sulfur, faster mining." },
  { id: "reinforced", branch: "eng", name: "Reinforced Walls", cost: 25, req: ["fabrication"], desc: "Unlocks meteor-proof walls." },
  { id: "automation", branch: "eng", name: "Automation", cost: 40, req: ["drill2"], desc: "Unlocks the Auto-Miner." },
  { id: "drill3", branch: "eng", name: "Plasma Drill", cost: 45, req: ["drill2"], desc: "Tier 3 drill: rare metals." },
  { id: "fission", branch: "eng", name: "Fission Power", cost: 60, req: ["automation", "drill3"], desc: "Unlocks the Fission Reactor." },
  // Exploration
  { id: "tank2", branch: "explore", name: "High-Pressure Tanks", cost: 15, desc: "Suit O₂ capacity +60%." },
  { id: "rover-pack", branch: "explore", name: "Rover Battery Packs", cost: 20, desc: "Rover battery +100%." },
  { id: "scanner2", branch: "explore", name: "Deep Scanner", cost: 20, req: ["tank2"], desc: "Scanner range doubled." },
  { id: "rad-shield", branch: "explore", name: "Radiation Weave", cost: 30, req: ["scanner2"], desc: "Solar particle events hurt 70% less." },
];

const byId = new Map(RESEARCH.map((r) => [r.id, r]));
export function researchById(id) {
  return byId.get(id) ?? null;
}
export const BRANCHES = [
  { id: "life", name: "Life Support" },
  { id: "farm", name: "Agriculture" },
  { id: "eng", name: "Engineering" },
  { id: "explore", name: "Exploration" },
];
