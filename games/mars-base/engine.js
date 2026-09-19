import {
  RESOURCES,
  RESOURCE_IDS,
  START_RESOURCES,
  COLONIST,
  BASE_POP_CAP,
  POP_CAP_PER_HABITAT,
  GROWTH_INTERVAL,
  GROWTH_INTERVAL_GROWTH_DOCTRINE,
  SUFFOCATION_LIMIT,
  WIN_POPULATION,
  WIN_SUSTAIN_STREAK,
  EVENT_CHANCE_EARLY,
  EVENT_CHANCE_MID,
  EVENT_CHANCE_LATE,
  EVENT_MID_SOL,
  EVENT_LATE_SOL,
  COST_SCALE,
  COST_SCALE_ORE,
  LAB_EFFICIENCY_PER_LEVEL,
  TRADE_RATE,
  TRADE_PER_LEVEL,
  TRADE_EXPORT_FRACTION,
  RESCUE_BASE_COST,
  RESCUE_PENALTY_SOLS,
  RESCUE_PENALTY_FACTOR,
  BUILDINGS,
  BUILDING_IDS,
  buildingById,
  EVENTS,
  eventById,
  ACHIEVEMENTS,
} from "./data.js";
import { createRng, rngFromSnapshot, hashSeed } from "../../shared/rng.js";

export const SAVE_VERSION = 1;
export const HISTORY_LIMIT = 5;

const zero = () => ({ power: 0, water: 0, oxygen: 0, ore: 0, credits: 0 });

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function createState({ mode = "normal", seed = null } = {}) {
  const resolvedSeed = seed ?? (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
  const buildings = {};
  for (const def of BUILDINGS) buildings[def.id] = def.startLevel ?? 0;

  return {
    version: SAVE_VERSION,
    mode,
    seed: resolvedSeed >>> 0,
    rngCalls: 0,
    sol: 1,
    status: "playing",
    doctrine: null,
    resources: { ...START_RESOURCES },
    population: 2,
    growthTimer: 0,
    buildings,
    effects: [],
    suffocation: 0,
    selfSustainStreak: 0,
    rescues: 0,
    outputPenaltySols: 0,
    pending: null,
    stats: {
      oreMined: 0,
      creditsEarned: 0,
      buildingsBuilt: 0,
      events: 0,
      storms: 0,
      meteors: 0,
      rescues: 0,
    },
    achievements: [],
    log: [],
    history: [],
  };
}

export function rngFor(state) {
  const rng = rngFromSnapshot({ seed: state.seed, calls: state.rngCalls });
  return {
    next: () => rng.next(),
    float: (min, max) => rng.float(min, max),
    int: (min, max) => rng.int(min, max),
    chance: (p) => rng.chance(p),
    pick: (list) => rng.pick(list),
    weighted: (entries) => rng.weighted(entries),
    shuffle: (list) => rng.shuffle(list),
    get calls() {
      return rng.calls;
    },
    commit() {
      state.rngCalls = rng.calls;
    },
  };
}

export function level(state, id) {
  return state.buildings[id] ?? 0;
}

export function popCap(state) {
  return BASE_POP_CAP + POP_CAP_PER_HABITAT * level(state, "habitat-dome");
}

export function doctrineModifiers(state) {
  const mods = {
    oreMult: 1,
    solarMult: 1,
    labMult: 1,
    growthInterval: GROWTH_INTERVAL,
    colonistConsumptionMult: 1,
  };
  if (state.doctrine === "industry") {
    mods.oreMult = 1.25;
    mods.solarMult = 1.1;
  } else if (state.doctrine === "science") {
    mods.labMult = 2;
  } else if (state.doctrine === "growth") {
    mods.growthInterval = GROWTH_INTERVAL_GROWTH_DOCTRINE;
    mods.colonistConsumptionMult = 0.9;
  }
  return mods;
}

export function labEfficiency(state) {
  const mods = doctrineModifiers(state);
  return 1 + level(state, "research-lab") * LAB_EFFICIENCY_PER_LEVEL * mods.labMult;
}

export function hasEffect(state, id) {
  return state.effects.some((e) => e.id === id);
}

export function effectRemaining(state, id) {
  const e = state.effects.find((x) => x.id === id);
  return e ? e.solsLeft : 0;
}

export function productionBreakdown(state) {
  const mods = doctrineModifiers(state);
  const globalEff = labEfficiency(state) * (state.outputPenaltySols > 0 ? RESCUE_PENALTY_FACTOR : 1);

  const buildingProduced = zero();
  const buildingConsumed = zero();
  const notes = [];

  const solarMult = mods.solarMult * (hasEffect(state, "dust-storm") ? 0.4 : 1);
  const reactorOnline = !hasEffect(state, "reactor-scram");

  for (const def of BUILDINGS) {
    const lvl = level(state, def.id);
    if (!lvl) continue;

    for (const [res, amt] of Object.entries(def.produces)) {
      let mult = globalEff;
      if (def.id === "solar-array") mult *= solarMult;
      if (def.id === "nuclear-reactor" && !reactorOnline) mult = 0;
      if (res === "ore") mult *= mods.oreMult;
      buildingProduced[res] += amt * lvl * mult;
    }
    for (const [res, amt] of Object.entries(def.consumes)) {
      buildingConsumed[res] += amt * lvl;
    }
  }

  if (hasEffect(state, "dust-storm")) {
    notes.push({ id: "dust-storm", text: `Dust storm: solar output at 40% (${effectRemaining(state, "dust-storm")} sol${effectRemaining(state, "dust-storm") === 1 ? "" : "s"} left)` });
  }
  if (!reactorOnline && level(state, "nuclear-reactor") > 0) {
    notes.push({ id: "reactor-scram", text: `Reactor offline (${effectRemaining(state, "reactor-scram")} sol${effectRemaining(state, "reactor-scram") === 1 ? "" : "s"} left)` });
  }
  if (state.outputPenaltySols > 0) {
    notes.push({ id: "rescue", text: `Post-rescue recovery: all output at ${Math.round(RESCUE_PENALTY_FACTOR * 100)}% (${state.outputPenaltySols} sols left)` });
  }

  const powerProduced = buildingProduced.power;
  const powerDemand = buildingConsumed.power;
  const powerAvailable = powerProduced + state.resources.power;

  let efficiency = 1;
  let brownout = false;
  if (powerDemand > 0 && powerAvailable < powerDemand) {
    efficiency = powerAvailable / powerDemand;
    brownout = true;
    notes.push({ id: "brownout", text: `Brownout: power demand exceeds supply, running at ${Math.round(efficiency * 100)}%` });
  }

  const produced = zero();
  const consumed = zero();
  for (const res of RESOURCE_IDS) {
    if (res === "power") continue;
    produced[res] = buildingProduced[res] * (brownout ? efficiency : 1);
    consumed[res] = buildingConsumed[res] * (brownout ? efficiency : 1);
  }

  const colonistMult = mods.colonistConsumptionMult;
  consumed.oxygen += state.population * COLONIST.oxygen * colonistMult;
  consumed.water += state.population * COLONIST.water * colonistMult;
  produced.credits += state.population * COLONIST.credits;

  produced.power = powerProduced;
  consumed.power = brownout ? powerAvailable : powerDemand;

  const tradeLevel = level(state, "trade-hub");
  let tradeSold = 0;
  if (tradeLevel > 0) {
    const capacity = TRADE_PER_LEVEL * tradeLevel * (brownout ? efficiency : 1);
    const oreAvailable = state.resources.ore + produced.ore;
    tradeSold = Math.max(0, Math.min(oreAvailable * TRADE_EXPORT_FRACTION, capacity));
    produced.credits += tradeSold * TRADE_RATE;
    consumed.ore += tradeSold;
    if (tradeSold > 0) notes.push({ id: "trade", text: `Trade Hub exporting ${tradeSold.toFixed(1)}t ore for ${(tradeSold * TRADE_RATE).toFixed(0)} credits` });
  }

  const net = {};
  for (const res of RESOURCE_IDS) net[res] = produced[res] - consumed[res];

  return { produced, consumed, net, efficiency, brownout, powerProduced, powerDemand, tradeSold, notes };
}

export function previewNextSol(state) {
  const b = productionBreakdown(state);
  const projected = {};
  for (const res of RESOURCE_IDS) {
    projected[res] = Math.max(0, state.resources[res] + b.net[res]);
  }
  return { ...b, projected };
}

export function isUnlocked(state, def) {
  if (!def.unlock) return true;
  return def.unlock.every((req) => level(state, req.building) >= req.level);
}

export function unlockHint(state, def) {
  if (!def.unlock) return null;
  const missing = def.unlock.filter((req) => level(state, req.building) < req.level);
  if (!missing.length) return null;
  return missing
    .map((req) => `${buildingById(req.building).name} Lv${req.level}`)
    .join(" + ");
}

export function costFor(def, currentLevel) {
  const creditScale = def.costScale ?? COST_SCALE;
  const oreScale = def.costScaleOre ?? COST_SCALE_ORE;
  const cost = {};
  for (const [res, amt] of Object.entries(def.cost)) {
    const scale = res === "ore" ? oreScale : creditScale;
    cost[res] = Math.round(amt * scale ** currentLevel);
  }
  return cost;
}

export function canAfford(state, cost) {
  const missing = [];
  for (const [res, amt] of Object.entries(cost)) {
    if (state.resources[res] < amt) missing.push({ res, need: amt, have: state.resources[res] });
  }
  return { ok: missing.length === 0, missing };
}

export function setDoctrine(state, doctrineId) {
  if (state.sol > 1) return { ok: false, reason: "Doctrine can only be chosen at the start of a colony." };
  state.doctrine = doctrineId;
  pushLog(state, `Colony doctrine adopted: ${doctrineId}.`, "info");
  return { ok: true };
}

export function buildOrUpgrade(state, id) {
  if (state.status !== "playing" || state.pending) return { ok: false, reason: "Cannot build right now." };
  const def = buildingById(id);
  if (!def) return { ok: false, reason: "Unknown structure." };

  const current = level(state, id);
  if (current >= def.maxLevel) return { ok: false, reason: "Maximum level reached." };
  if (!isUnlocked(state, def)) return { ok: false, reason: `Requires ${unlockHint(state, def)}.` };

  const cost = costFor(def, current);
  const afford = canAfford(state, cost);
  if (!afford.ok) return { ok: false, reason: "Insufficient resources." };

  for (const [res, amt] of Object.entries(cost)) state.resources[res] -= amt;
  state.buildings[id] = current + 1;
  state.stats.buildingsBuilt += 1;

  const verb = current === 0 ? "constructed" : `upgraded to Lv${current + 1}`;
  pushLog(state, `${def.name} ${verb}.`, "build");
  return { ok: true, level: current + 1, first: current === 0 };
}

export function advanceSol(state) {
  const report = { events: [], achievements: [], growth: 0, unlocked: [] };
  if (state.status !== "playing") return report;
  if (state.pending) return report;

  pushHistory(state);

  const rng = rngFor(state);
  const before = clone(state.buildings);
  const breakdown = productionBreakdown(state);

  for (const res of RESOURCE_IDS) {
    state.resources[res] = Math.max(0, state.resources[res] + breakdown.net[res]);
  }

  state.stats.oreMined += breakdown.produced.ore;
  state.stats.creditsEarned += breakdown.produced.credits;

  const oxygenOk = state.resources.oxygen > 0;
  const waterOk = state.resources.water > 0;
  const selfSustaining = oxygenOk && waterOk && !breakdown.brownout;
  state.selfSustainStreak = selfSustaining ? state.selfSustainStreak + 1 : 0;

  if (!oxygenOk) {
    state.suffocation += 1;
    pushLog(state, `OXYGEN DEPLETED — colonists suffocating (${state.suffocation}/${SUFFOCATION_LIMIT}).`, "danger");
  } else {
    state.suffocation = 0;
  }

  state.growthTimer += 1;
  const mods = doctrineModifiers(state);
  if (state.growthTimer >= mods.growthInterval) {
    state.growthTimer = 0;
    if (state.population < popCap(state) && oxygenOk && waterOk) {
      state.population += 1;
      report.growth = 1;
      pushLog(state, `A new colonist arrives. Population ${state.population}.`, "good");
    }
  }

  if (state.outputPenaltySols > 0) state.outputPenaltySols -= 1;

  for (const effect of state.effects) effect.solsLeft -= 1;
  const expired = state.effects.filter((e) => e.solsLeft <= 0);
  state.effects = state.effects.filter((e) => e.solsLeft > 0);
  for (const e of expired) pushLog(state, `${eventById(e.id)?.name ?? e.id} has passed.`, "info");

  if (rng.chance(eventChanceFor(state.sol))) {
    const eligible = EVENTS.filter((e) => state.sol >= e.minSol && (!e.requires || level(state, e.requires) > 0));
    if (eligible.length) {
      const id = rng.weighted(eligible.map((e) => ({ id: e.id, weight: e.weight })));
      applyEvent(state, id, rng, report);
    }
  }
  rng.commit();

  if (state.suffocation >= SUFFOCATION_LIMIT && !state.pending) {
    state.pending = { type: "rescue", cost: rescueCost(state) };
    pushLog(state, "Life support collapse imminent. Earth offers a rescue mission.", "danger");
  }

  if (state.population <= 0) {
    state.status = "lost";
    pushLog(state, "The colony is empty. Mars wins this round.", "danger");
  } else if (state.population >= WIN_POPULATION && state.selfSustainStreak >= WIN_SUSTAIN_STREAK) {
    state.status = "won";
    pushLog(state, "COLONY ESTABLISHED. Mars is officially someone's home.", "good");
  }

  state.sol += 1;

  for (const [id, lvl] of Object.entries(state.buildings)) {
    if (lvl > (before[id] ?? 0)) report.unlocked.push(id);
  }

  report.achievements = checkAchievements(state);
  return report;
}

export function eventChanceFor(sol) {
  if (sol >= EVENT_LATE_SOL) return EVENT_CHANCE_LATE;
  if (sol >= EVENT_MID_SOL) return EVENT_CHANCE_MID;
  return EVENT_CHANCE_EARLY;
}

export function debugApplyEvent(state, id, rng, report) {
  return applyEvent(state, id, rng, report);
}

function applyEvent(state, id, rng, report, count = true) {
  const def = eventById(id);
  if (count) state.stats.events += 1;

  switch (id) {
    case "dust-storm": {
      const sols = rng.int(1, 3);
      state.effects.push({ id: "dust-storm", solsLeft: sols });
      state.stats.storms += 1;
      pushLog(state, `Dust storm rolls in. Solar output crippled for ${sols} sol${sols === 1 ? "" : "s"}.`, "bad");
      break;
    }
    case "meteor-strike": {
      const targets = BUILDING_IDS.filter((b) => b !== "landing-pad" && b !== "habitat-dome" && level(state, b) > 0);
      if (!targets.length) {
        applyEvent(state, "dust-devil", rng, report, false);
        return;
      }
      const target = rng.pick(targets);
      state.buildings[target] -= 1;
      state.stats.meteors += 1;
      pushLog(state, `Meteor strike! ${buildingById(target).name} damaged to Lv${state.buildings[target]}.`, "bad");
      break;
    }
    case "reactor-scram": {
      state.effects.push({ id: "reactor-scram", solsLeft: 2 });
      pushLog(state, "Reactor scram! Emergency shutdown for 2 sols.", "bad");
      break;
    }
    case "solar-flare": {
      if (state.resources.power >= 40) {
        state.resources.power -= 40;
        pushLog(state, "Solar flare! Magnetic shielding holds, at a cost of 40 power.", "bad");
      } else {
        state.population = Math.max(0, state.population - 1);
        pushLog(state, "Solar flare! Insufficient power to shield. One colonist lost.", "danger");
      }
      break;
    }
    case "dust-devil": {
      state.resources.power = Math.max(0, state.resources.power - 8);
      state.resources.water = Math.max(0, state.resources.water - 6);
      pushLog(state, "Dust devil tears through camp. Lost 8 power and 6 water.", "bad");
      break;
    }
    case "ice-pocket": {
      state.resources.water += 25;
      pushLog(state, "Ice pocket found! +25 water.", "good");
      break;
    }
    case "ore-vein": {
      state.resources.ore += 20;
      state.stats.oreMined += 20;
      pushLog(state, "Rich ore vein discovered! +20 ore.", "good");
      break;
    }
    case "supply-drop": {
      state.resources.credits += 80;
      pushLog(state, "Earth supply drop arrives. +80 credits.", "good");
      break;
    }
    default:
      break;
  }

  report.events.push({ id, kind: def?.kind ?? "bad", name: def?.name ?? id });
}

export function rescueCost(state) {
  return Math.round(RESCUE_BASE_COST * 1.5 ** state.rescues);
}

export function resolveRescue(state, accept) {
  if (!state.pending || state.pending.type !== "rescue") return { ok: false };
  const cost = state.pending.cost;

  if (accept && state.resources.credits < cost) return { ok: false, reason: "unaffordable" };

  state.pending = null;

  if (accept) {
    state.resources.credits -= cost;
    state.rescues += 1;
    state.stats.rescues += 1;
    state.resources.oxygen = Math.max(state.resources.oxygen, 20, Math.ceil(state.population * 1.2));
    state.resources.water = Math.max(state.resources.water, 10, Math.ceil(state.population * 0.8));
    state.outputPenaltySols = RESCUE_PENALTY_SOLS;
    state.suffocation = 0;
    pushLog(state, `Rescue mission accepted for ${cost} credits. Output halved for ${RESCUE_PENALTY_SOLS} sols.`, "info");
    return { ok: true, rescued: true };
  }

  state.status = "lost";
  pushLog(state, "No rescue comes. The colony goes quiet.", "danger");
  return { ok: true, rescued: false };
}

export function checkAchievements(state) {
  const newly = [];
  for (const a of ACHIEVEMENTS) {
    if (state.achievements.includes(a.id)) continue;
    let pass = false;
    try {
      pass = a.test(state);
    } catch {
      pass = false;
    }
    if (pass) {
      state.achievements.push(a.id);
      newly.push(a.id);
    }
  }
  return newly;
}

export function pushLog(state, text, type = "info") {
  state.log.unshift({ sol: state.sol, type, text });
  if (state.log.length > 80) state.log.length = 80;
}

function pushHistory(state) {
  const snapshot = clone(state);
  snapshot.history = [];
  state.history.unshift(JSON.stringify(snapshot));
  if (state.history.length > HISTORY_LIMIT) state.history.length = HISTORY_LIMIT;
}

export function canUndo(state) {
  return state.mode !== "daily" && state.history.length > 0 && state.status === "playing" && !state.pending;
}

export function undoLastSol(state) {
  if (!canUndo(state)) return { ok: false };
  const snapshot = state.history.shift();
  const restored = JSON.parse(snapshot);
  const history = state.history;
  Object.assign(state, restored);
  state.history = history;
  pushLog(state, "Time rewound one sol. The colony remembers nothing.", "info");
  return { ok: true };
}

export function toSave(state) {
  const copy = clone(state);
  copy.history = [];
  return copy;
}

function num(value, fallback, min = 0, max = Number.MAX_SAFE_INTEGER) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

export function fromSave(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  if (data.version !== SAVE_VERSION) return null;
  const seed = num(data.seed, 0, 0, 0xffffffff);
  const mode = data.mode === "daily" ? "daily" : "normal";
  const state = createState({ mode, seed });

  state.sol = Math.max(1, Math.floor(num(data.sol, 1, 1, 100000)));
  state.status = data.status === "won" || data.status === "lost" ? data.status : "playing";
  state.doctrine = ["industry", "science", "growth"].includes(data.doctrine) ? data.doctrine : null;
  state.rngCalls = Math.max(0, Math.floor(num(data.rngCalls, 0, 0, 10000000)));
  state.population = Math.max(0, Math.floor(num(data.population, 2, 0, 10000)));
  state.growthTimer = Math.max(0, Math.floor(num(data.growthTimer, 0, 0, 1000)));
  state.suffocation = Math.max(0, Math.floor(num(data.suffocation, 0, 0, 1000)));
  state.selfSustainStreak = Math.max(0, Math.floor(num(data.selfSustainStreak, 0, 0, 100000)));
  state.rescues = Math.max(0, Math.floor(num(data.rescues, 0, 0, 1000)));
  state.outputPenaltySols = Math.max(0, Math.floor(num(data.outputPenaltySols, 0, 0, 1000)));
  if (data.pending && typeof data.pending === "object" && data.pending.type === "rescue" && state.suffocation >= SUFFOCATION_LIMIT) {
    state.pending = { type: "rescue", cost: rescueCost(state) };
  } else {
    state.pending = null;
  }

  if (data.buildings && typeof data.buildings === "object") {
    for (const def of BUILDINGS) {
      const lvl = Math.floor(num(data.buildings[def.id], def.startLevel ?? 0, 0, def.maxLevel));
      state.buildings[def.id] = lvl;
    }
  }
  if (data.resources && typeof data.resources === "object") {
    for (const res of RESOURCE_IDS) {
      state.resources[res] = num(data.resources[res], START_RESOURCES[res], 0, 1e12);
    }
  }
  if (data.stats && typeof data.stats === "object") {
    for (const key of Object.keys(state.stats)) {
      state.stats[key] = Math.max(0, Math.floor(num(data.stats[key], 0, 0, 1e12)));
    }
  }
  if (Array.isArray(data.achievements)) {
    const valid = new Set(ACHIEVEMENTS.map((a) => a.id));
    state.achievements = data.achievements.filter((id) => valid.has(id));
  }
  if (Array.isArray(data.effects)) {
    state.effects = data.effects
      .filter((e) => e && typeof e.id === "string" && eventById(e.id))
      .map((e) => ({ id: e.id, solsLeft: Math.max(1, Math.floor(num(e.solsLeft, 1, 1, 100))) }));
  }
  if (Array.isArray(data.log)) {
    state.log = data.log
      .filter((e) => e && typeof e.text === "string")
      .slice(0, 80)
      .map((e) => ({ sol: Math.max(1, Math.floor(num(e.sol, 1, 1, 100000))), type: String(e.type ?? "info"), text: String(e.text).slice(0, 500) }));
  }
  if (typeof data.dailyKey === "string" && /^\d{4}-\d{2}-\d{2}$/.test(data.dailyKey)) {
    state.dailyKey = data.dailyKey;
  }
  state.history = [];
  return state;
}

export function seedForDaily(key) {
  return hashSeed(`timesink:mars-base:${key}`);
}

export function summarize(state) {
  return {
    sol: state.sol,
    population: state.population,
    status: state.status,
    credits: Math.round(state.resources.credits),
    achievements: state.achievements.length,
  };
}

export { RESOURCES, RESOURCE_IDS, BUILDINGS, BUILDING_IDS, buildingById, ACHIEVEMENTS, EVENTS, eventById };
