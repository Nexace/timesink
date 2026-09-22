// Every structure occupies one tile.
// seals: counts as a pressure boundary. solid: blocks walking. interior: must be inside a sealed room to work.
// power: +gen / -use per second (MW-ish units). prio: brownout priority (lower = kept longer).
// cat: build-menu category. research: required tech id.
export const STRUCTURES = [
  // Shell
  { id: "wall", name: "Hab Wall", cat: "shell", cost: { metal: 1, sealant: 1 }, seals: true, solid: true, desc: "Pressure-rated wall panel." },
  { id: "glass-wall", name: "Glass Panel", cat: "shell", cost: { glass: 2, sealant: 1 }, seals: true, solid: true, glass: true, desc: "Seals like a wall, lets sunlight reach crops." },
  { id: "floor", name: "Hab Floor", cat: "shell", cost: { metal: 1 }, floor: true, desc: "Pressurized decking. Rooms need floors to hold air." },
  { id: "airlock", name: "Airlock", cat: "shell", cost: { metal: 3, circuit: 1, sealant: 2 }, seals: true, door: true, power: -0.2, prio: 0, desc: "Walk through without losing the room's air. Wears with use." },
  { id: "cable", name: "Power Cable", cat: "power", cost: { wire: 1 }, conduit: true, desc: "Links structures into one power grid." },
  { id: "rwall", name: "Reinforced Wall", cat: "shell", cost: { concrete: 2, metal: 1 }, seals: true, solid: true, armored: true, research: "reinforced", desc: "Shrugs off meteor fragments." },

  // Power
  { id: "solar", name: "Solar Panel", cat: "power", cost: { metal: 2, glass: 2, wire: 1 }, power: 2.2, solar: true, solid: true, desc: "Daylight power. Dust builds up; wipe it with E." },
  { id: "battery", name: "Battery Bank", cat: "power", cost: { metal: 2, wire: 2, circuit: 1 }, store: 600, solid: true, desc: "Stores 600 units of charge for night and storms." },
  { id: "rtg", name: "RTG", cat: "power", cost: { "rtg-core": 1, metal: 2 }, power: 1.2, heat: 6, solid: true, desc: "Plutonium decay: steady power and warmth. Do not lick." },
  { id: "reactor", name: "Fission Reactor", cat: "power", cost: { metal: 12, circuit: 6, "rare-metal": 6, concrete: 6 }, power: 12, solid: true, research: "fission", desc: "A lot of power. Storm-proof." },

  // Life support
  { id: "oxygenator", name: "Oxygenator", cat: "life", cost: { metal: 4, circuit: 2, wire: 2 }, power: -1.2, prio: 0, interior: true, o2: 0.9, solid: true, desc: "Splits CO₂ into breathable air for its room." },
  { id: "reclaimer", name: "Water Reclaimer", cat: "life", cost: { metal: 4, circuit: 2, plastic: 2 }, power: -0.8, prio: 0, interior: true, reclaim: 0.9, solid: true, desc: "Recovers 90% of the water the crew uses." },
  { id: "heater", name: "Heater", cat: "life", cost: { metal: 2, wire: 2 }, power: -0.9, prio: 1, interior: true, heat: 8, solid: true, desc: "Keeps a room above freezing at night." },
  { id: "tank", name: "Water Tank", cat: "life", cost: { metal: 3, plastic: 1 }, water: 200, solid: true, desc: "Holds 200 L. Drop ice in to melt it." },
  { id: "recycler", name: "Waste Recycler", cat: "life", cost: { metal: 2, plastic: 1 }, power: -0.3, prio: 2, interior: true, solid: true, desc: "Turns crew waste into compost. Glamorous." },
  { id: "chem", name: "Chem Station", cat: "life", cost: { metal: 3, glass: 2, circuit: 1 }, power: -0.5, prio: 2, interior: true, solid: true, desc: "Burns hydrazine into water. Keep the room O₂ low or it gets exciting." },

  // Farming
  { id: "planter", name: "Planter Bed", cat: "farm", cost: { soil: 2, metal: 1 }, interior: true, planter: true, desc: "Soil bed for one crop. Needs light, water, warmth." },
  { id: "growlamp", name: "Grow Lamp", cat: "farm", cost: { wire: 2, glass: 1, circuit: 1 }, power: -0.4, prio: 3, interior: true, lamp: 3, desc: "Lights planters within 3 tiles." },
  { id: "algae", name: "Algae Vat", cat: "farm", cost: { glass: 3, plastic: 2, circuit: 1 }, power: -0.4, prio: 2, interior: true, o2: 0.35, solid: true, research: "algae", desc: "Slow food and a little oxygen." },

  // Industry
  { id: "workbench", name: "Workbench", cat: "industry", cost: { scrap: 4 }, station: "workbench", solid: true, desc: "Craft basic parts." },
  { id: "smelter", name: "Smelter", cat: "industry", cost: { basalt: 6, metal: 2 }, station: "smelter", power: -0.6, prio: 3, solid: true, desc: "Refines ore and sand. Draws power while working." },
  { id: "fabricator", name: "Fabricator", cat: "industry", cost: { metal: 6, circuit: 3, glass: 2 }, station: "fabricator", power: -0.6, prio: 3, solid: true, research: "fabrication", desc: "Advanced parts, tools and suit upgrades." },
  { id: "crate", name: "Storage Crate", cat: "industry", cost: { metal: 2 }, storage: 24, solid: true, desc: "24 slots of storage." },
  { id: "autominer", name: "Auto-Miner", cat: "industry", cost: { metal: 6, circuit: 3, wire: 3 }, power: -1, prio: 4, solid: true, miner: true, research: "automation", desc: "Place next to a deposit; mines it slowly. Collect with E." },

  // Science & comms
  { id: "lab", name: "Research Lab", cat: "science", cost: { metal: 4, glass: 2, circuit: 2 }, power: -0.7, prio: 3, interior: true, station: "lab", solid: true, desc: "Turn rock samples into research." },
  { id: "comms", name: "Comms Dish", cat: "science", cost: { antenna: 1, metal: 3, circuit: 2, wire: 3 }, power: -0.5, prio: 1, comms: true, solid: true, desc: "Talk to Earth. Order supply drops." },
  { id: "pad", name: "Landing Pad", cat: "science", cost: { concrete: 8 }, pad: true, desc: "Supply drops and crew landers need somewhere flat." },

  // Living
  { id: "bunk", name: "Bunk", cat: "living", cost: { metal: 2, plastic: 1 }, interior: true, bunk: true, desc: "Sleep to skip the night and heal. Houses one colonist." },
  { id: "lamp", name: "Flood Lamp", cat: "living", cost: { wire: 1, glass: 1 }, power: -0.1, prio: 4, light: 5, desc: "Pushes back the Martian dark." },
  { id: "beacon", name: "Flag Beacon", cat: "living", cost: {}, beacon: true, hidden: true, desc: "A map waypoint." },
];

const byId = new Map(STRUCTURES.map((s) => [s.id, s]));
export function structById(id) {
  return byId.get(id) ?? null;
}
export const BUILD_CATS = [
  { id: "shell", name: "Shell" },
  { id: "power", name: "Power" },
  { id: "life", name: "Life Support" },
  { id: "farm", name: "Farming" },
  { id: "industry", name: "Industry" },
  { id: "science", name: "Science" },
  { id: "living", name: "Living" },
];
