// All tunables live here. Times are in sim ticks unless named *_SEC.
export const TICK_RATE = 20;
export const DT = 1 / TICK_RATE;
export const SOL_SECONDS = 600; // real seconds per sol at 1x
export const SOL_TICKS = SOL_SECONDS * TICK_RATE;
export const DAY_FRACTION = 0.6; // daylight share of a sol
export const DAWN = 0.2; // time-of-day where the sol "starts" for autosave and day counting

export const WORLD_W = 384;
export const WORLD_H = 384;
export const CHUNK = 32;

export const PLAYER_SPEED = 4.2; // tiles / s
export const PLAYER_RADIUS = 0.3;
export const REACH = 2.6; // tiles

// Vitals (per second of game time)
export const VITALS = {
  o2Max: 100,
  o2DrainOutside: 0.1, // 100 / 0.1 = 1000 s ≈ 1.7 sols of EVA per full tank at 1x
  o2DrainLeak: 0.3,
  o2RefillInside: 4,
  powerMax: 100,
  powerDrainDay: 0.03,
  powerDrainNight: 0.08,
  powerDrainCold: 0.08, // extra in cold biomes
  powerRecharge: 3,
  foodMax: 100, // 100 = 2000 kcal, one sol's worth
  foodDrain: 100 / SOL_SECONDS,
  waterMax: 100,
  waterDrain: 100 / SOL_SECONDS * 1.2,
  healthMax: 100,
  suffocateDmg: 5,
  coldDmg: 0.8,
  starveDmg: 0.12,
  thirstDmg: 0.25,
  regenRest: 0.35, // while inside a pressurized room with needs satisfied
  integrityMax: 100,
};

// Rooms
export const ROOM = {
  maxTiles: 400, // flood-fill cap; bigger than this counts as open to outside
  breathableFrac: 0.5, // room O2 (0..1 of a full 21% atmosphere) needed to take the helmet off
  oxyUnits: 0.9, // O2 units/s per oxygenator (1 unit = one tile of full air)
  personUnits: 0.05, // O2 units/s breathed per person
  seepUnits: 0.0004, // per tile per second of slow seepage
  decompress: 0.35, // O2 fraction lost per second while breached
  thermostat: 20,
  loss: 0.002, // heat loss coefficient
  dayTemp: -30,
  nightTemp: -100,
  freeze: 0,
};

export const SPEEDS = [1, 2, 3];
export const MAX_TICKS_PER_FRAME = 8;

export const START = {
  rations: 30,
  seedPotatoes: 12,
  hydrazineStart: 0,
};

export const FOOD_VALUE = {
  ration: 100,
  potato: 18,
  lettuce: 8,
  beans: 22,
  algae: 12,
};

export const CROPS = {
  potato: { seed: "seed-potato", yield: "potato", yieldCount: [3, 5], growSols: 4, seedBack: 1, water: 2 },
  lettuce: { seed: "seed-lettuce", yield: "lettuce", yieldCount: [2, 3], growSols: 2, seedBack: 1, water: 1 },
  beans: { seed: "seed-beans", yield: "beans", yieldCount: [3, 4], growSols: 5, seedBack: 1, water: 2 },
};

export const MINE_TIME = 0.9; // seconds per hit at tier 1
export const DUST_PER_SOL = 0.22; // solar dust accumulation per sol
export const STORM_SOLAR = 0.3;

export const COLONY = {
  selfSustainSolsForFinale: 10,
  campaignMaxColonists: 20,
  landerInterval: 3, // sols between crew landers when capacity allows
};

export const DAILY_SCORE_SOL = 30;
