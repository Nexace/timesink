export const RESOURCES = [
  { id: "power", name: "Power", icon: "bolt", color: "var(--c-power)", unit: "MW" },
  { id: "water", name: "Water", icon: "droplet", color: "var(--c-water)", unit: "kL" },
  { id: "oxygen", name: "Oxygen", icon: "oxygen", color: "var(--c-oxygen)", unit: "t" },
  { id: "ore", name: "Ore", icon: "ore", color: "var(--c-ore)", unit: "t" },
  { id: "credits", name: "Credits", icon: "credits", color: "var(--c-credits)", unit: "₡" },
];

export const RESOURCE_IDS = RESOURCES.map((r) => r.id);

export const START_RESOURCES = {
  power: 30,
  water: 30,
  oxygen: 40,
  ore: 0,
  credits: 180,
};

export const COLONIST = {
  oxygen: 1,
  water: 0.6,
  credits: 0.8,
};

export const BASE_POP_CAP = 4;
export const POP_CAP_PER_HABITAT = 4;
export const GROWTH_INTERVAL = 3;
export const GROWTH_INTERVAL_GROWTH_DOCTRINE = 2;
export const SUFFOCATION_LIMIT = 3;
export const WIN_POPULATION = 50;
export const WIN_SUSTAIN_STREAK = 10;
export const EVENT_CHANCE_EARLY = 0.22;
export const EVENT_CHANCE_MID = 0.3;
export const EVENT_CHANCE_LATE = 0.35;
export const EVENT_MID_SOL = 15;
export const EVENT_LATE_SOL = 40;
export const COST_SCALE = 1.55;
export const COST_SCALE_ORE = 1.3;
export const LAB_EFFICIENCY_PER_LEVEL = 0.03;
export const TRADE_RATE = 3;
export const TRADE_PER_LEVEL = 10;
export const TRADE_EXPORT_FRACTION = 0.5;
export const RESCUE_BASE_COST = 100;
export const RESCUE_PENALTY_SOLS = 5;
export const RESCUE_PENALTY_FACTOR = 0.5;

export const DOCTRINES = [
  {
    id: "industry",
    name: "Industry",
    icon: "factory",
    desc: "Ore output +25% and solar output +10%. Build fast, dig deep.",
  },
  {
    id: "science",
    name: "Science",
    icon: "flask",
    desc: "Research Lab efficiency bonus doubled (+6% per level).",
  },
  {
    id: "growth",
    name: "Growth",
    icon: "users",
    desc: "Colonists arrive twice as often and consume 10% less.",
  },
];

export const BUILDINGS = [
  {
    id: "landing-pad",
    name: "Landing Pad",
    icon: "rocket",
    tier: 1,
    desc: "Docks supply craft and collects landing fees. Required before anything heavy can arrive.",
    flavor: "The first thing you build and the last thing you stop needing.",
    startLevel: 1,
    maxLevel: 5,
    cost: { credits: 50, ore: 0 },
    produces: { credits: 2 },
    consumes: { power: 1 },
    unlock: null,
  },
  {
    id: "solar-array",
    name: "Solar Array",
    icon: "sun",
    tier: 1,
    desc: "Photovoltaic field. Your baseline power source, but dust storms gut its output.",
    flavor: "Free energy, weather permitting.",
    startLevel: 0,
    maxLevel: 12,
    cost: { credits: 40, ore: 0 },
    produces: { power: 8 },
    consumes: {},
    unlock: null,
  },
  {
    id: "ice-drill",
    name: "Ice Drill",
    icon: "drill",
    tier: 1,
    desc: "Mines subsurface ice for water. Everything alive and everything industrial drinks from it.",
    flavor: "Turns out Mars has water. It is just extremely committed to being ice.",
    startLevel: 0,
    maxLevel: 12,
    cost: { credits: 60, ore: 0 },
    produces: { water: 6 },
    consumes: { power: 2 },
    unlock: [{ building: "landing-pad", level: 1 }],
  },
  {
    id: "electrolyzer",
    name: "Electrolyzer",
    icon: "oxygen",
    tier: 1,
    desc: "Splits water into breathable oxygen. Power-hungry and thirsty, but it keeps lungs full.",
    flavor: "Breathing is a subscription service and this is the billing department.",
    startLevel: 0,
    maxLevel: 12,
    cost: { credits: 70, ore: 0 },
    produces: { oxygen: 5 },
    consumes: { power: 3, water: 2 },
    unlock: [{ building: "landing-pad", level: 1 }],
  },
  {
    id: "greenhouse",
    name: "Greenhouse",
    icon: "leaf",
    tier: 1,
    desc: "Grows crops under glass. Produces oxygen and sells surplus food for credits.",
    flavor: "The tomatoes taste like victory and faintly of recycled air.",
    startLevel: 0,
    maxLevel: 10,
    cost: { credits: 80, ore: 0 },
    produces: { oxygen: 2, credits: 4 },
    consumes: { power: 2, water: 2 },
    unlock: [{ building: "landing-pad", level: 1 }],
  },
  {
    id: "ore-mine",
    name: "Ore Mine",
    icon: "ore",
    tier: 1,
    desc: "Extracts regolith ore. Spend it on advanced construction or export it for credits.",
    flavor: "Red dirt, red dust, red everything. Some of it is even valuable.",
    startLevel: 0,
    maxLevel: 12,
    cost: { credits: 90, ore: 0 },
    produces: { ore: 5 },
    consumes: { power: 2 },
    unlock: [{ building: "landing-pad", level: 1 }],
  },
  {
    id: "habitat-dome",
    name: "Habitat Dome",
    icon: "dome",
    tier: 2,
    desc: "Pressurized housing. Each level raises population capacity by 4 colonists.",
    flavor: "Home is where the air scrubbers are.",
    startLevel: 0,
    maxLevel: 12,
    cost: { credits: 120, ore: 10 },
    costScale: 1.28,
    costScaleOre: 1.12,
    produces: {},
    consumes: { power: 2, oxygen: 1 },
    unlock: [{ building: "electrolyzer", level: 1 }],
  },
  {
    id: "trade-hub",
    name: "Trade Hub",
    icon: "trade",
    tier: 2,
    desc: `Exports up to half your ore stock per sol (max ${TRADE_PER_LEVEL}t per level) at ${TRADE_RATE} credits per tonne, keeping a reserve for construction.`,
    flavor: "The only thing Earth wants from Mars is Mars.",
    startLevel: 0,
    maxLevel: 8,
    cost: { credits: 150, ore: 20 },
    produces: {},
    consumes: { power: 1 },
    unlock: [{ building: "ore-mine", level: 1 }],
  },
  {
    id: "research-lab",
    name: "Research Lab",
    icon: "flask",
    tier: 2,
    desc: `Improves colony-wide efficiency by ${Math.round(LAB_EFFICIENCY_PER_LEVEL * 100)}% per level and unlocks the reactor.`,
    flavor: "Science is just well-funded curiosity with better paperwork.",
    startLevel: 0,
    maxLevel: 4,
    cost: { credits: 200, ore: 30 },
    produces: {},
    consumes: { power: 3 },
    unlock: [{ building: "habitat-dome", level: 1 }],
  },
  {
    id: "nuclear-reactor",
    name: "Nuclear Reactor",
    icon: "reactor",
    tier: 3,
    desc: "Massive steady power output, immune to dust storms. Prone to dramatic scrams.",
    flavor: "What could possibly go wrong, two hundred million kilometres from the nearest technician.",
    startLevel: 0,
    maxLevel: 4,
    cost: { credits: 300, ore: 40 },
    produces: { power: 24 },
    consumes: {},
    unlock: [{ building: "research-lab", level: 1 }],
  },
];

export const BUILDING_IDS = BUILDINGS.map((b) => b.id);

export function buildingById(id) {
  return BUILDINGS.find((b) => b.id === id) ?? null;
}

export const EVENTS = [
  {
    id: "dust-storm",
    name: "Dust Storm",
    icon: "oxygen",
    kind: "bad",
    minSol: 10,
    weight: 3,
    desc: "Solar output reduced to 40% while the storm passes.",
  },
  {
    id: "meteor-strike",
    name: "Meteor Strike",
    icon: "alert",
    kind: "bad",
    minSol: 12,
    weight: 1.5,
    desc: "A meteorite impacts the colony and damages a structure.",
  },
  {
    id: "reactor-scram",
    name: "Reactor Scram",
    icon: "reactor",
    kind: "bad",
    minSol: 1,
    weight: 1,
    requires: "nuclear-reactor",
    desc: "Emergency shutdown takes the reactor offline for two sols.",
  },
  {
    id: "solar-flare",
    name: "Solar Flare",
    icon: "sun",
    kind: "bad",
    minSol: 6,
    weight: 1.5,
    desc: "Radiation surge. Power is spent shielding the colony, or colonists are lost.",
  },
  {
    id: "dust-devil",
    name: "Dust Devil",
    icon: "alert",
    kind: "bad",
    minSol: 2,
    weight: 2,
    desc: "A whirlwind tears through the camp, scattering power cells and water.",
  },
  {
    id: "ice-pocket",
    name: "Ice Pocket Found",
    icon: "droplet",
    kind: "good",
    minSol: 3,
    weight: 2,
    desc: "Surveyors strike a shallow ice deposit. Free water.",
  },
  {
    id: "ore-vein",
    name: "Ore Vein Discovered",
    icon: "ore",
    kind: "good",
    minSol: 5,
    weight: 2,
    desc: "A rich vein is exposed near the mine. Free ore.",
  },
  {
    id: "supply-drop",
    name: "Earth Supply Drop",
    icon: "rocket",
    kind: "good",
    minSol: 7,
    weight: 1.2,
    desc: "An uncrewed resupply capsule arrives with credits from sponsors.",
  },
];

export function eventById(id) {
  return EVENTS.find((e) => e.id === id) ?? null;
}

export const ACHIEVEMENTS = [
  { id: "first-light", name: "First Light", icon: "sun", desc: "Build a Solar Array.", test: (s) => s.buildings["solar-array"] >= 1 },
  { id: "breathing-room", name: "Breathing Room", icon: "oxygen", desc: "Build an Electrolyzer.", test: (s) => s.buildings["electrolyzer"] >= 1 },
  { id: "green-thumb", name: "Green Thumb", icon: "leaf", desc: "Build a Greenhouse.", test: (s) => s.buildings["greenhouse"] >= 1 },
  { id: "boomtown", name: "Boomtown", icon: "users", desc: "Reach 10 colonists.", test: (s) => s.population >= 10 },
  { id: "metropolis", name: "Metropolis", icon: "dome", desc: "Reach 50 colonists.", test: (s) => s.population >= 50 },
  { id: "deep-pocket", name: "Deep Pocket", icon: "ore", desc: "Mine 100 ore in total.", test: (s) => s.stats.oreMined >= 100 },
  { id: "tycoon", name: "Tycoon", icon: "credits", desc: "Hold 1,000 credits at once.", test: (s) => s.resources.credits >= 1000 },
  { id: "storm-chaser", name: "Storm Chaser", icon: "oxygen", desc: "Survive 3 dust storms.", test: (s) => s.stats.storms >= 3 },
  { id: "weathered", name: "Weathered", icon: "shield", desc: "Survive 5 events of any kind.", test: (s) => s.stats.events >= 5 },
  { id: "split-atom", name: "Split Atom", icon: "reactor", desc: "Bring a Nuclear Reactor online.", test: (s) => s.buildings["nuclear-reactor"] >= 1 },
  { id: "self-sufficient", name: "Self-Sufficient", icon: "trend", desc: "Stay self-sustaining for 10 consecutive sols.", test: (s) => s.selfSustainStreak >= 10 },
  { id: "phoenix", name: "Phoenix", icon: "sparkle", desc: "Call a rescue mission and still establish the colony.", test: (s) => s.rescues >= 1 && s.status === "won" },
  { id: "founder", name: "Founder", icon: "trophy", desc: "Establish the colony.", test: (s) => s.status === "won" },
];
