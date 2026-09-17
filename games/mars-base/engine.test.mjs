import assert from "node:assert/strict";
import {
  createState,
  advanceSol,
  buildOrUpgrade,
  productionBreakdown,
  previewNextSol,
  costFor,
  isUnlocked,
  unlockHint,
  undoLastSol,
  canUndo,
  resolveRescue,
  rescueCost,
  toSave,
  fromSave,
  setDoctrine,
  eventChanceFor,
  rngFor,
  debugApplyEvent,
  seedForDaily,
  buildingById,
  level,
  popCap,
} from "./engine.js";
import {
  EVENT_CHANCE_EARLY,
  EVENT_CHANCE_MID,
  EVENT_CHANCE_LATE,
} from "./data.js";

let passed = 0;
let failed = 0;
const failures = [];

function t(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`  ok  ${name}`);
  } catch (err) {
    failed += 1;
    failures.push({ name, err });
    console.log(`FAIL  ${name}\n      ${err.message}`);
  }
}

console.log("mars-base engine tests\n");

t("createState seeds defaults", () => {
  const s = createState({ seed: 1234 });
  assert.equal(s.sol, 1);
  assert.equal(s.status, "playing");
  assert.equal(s.population, 2);
  assert.equal(s.buildings["landing-pad"], 1);
  assert.equal(s.buildings["solar-array"], 0);
  assert.equal(s.resources.credits, 180);
  assert.equal(s.seed, 1234);
});

t("starting production is a slow bleed", () => {
  const s = createState({ seed: 1 });
  const b = productionBreakdown(s);
  assert.equal(b.brownout, false);
  assert.equal(Math.round(b.net.power), -1);
  assert.equal(Math.round(b.net.oxygen * 10) / 10, -2);
  assert.equal(Math.round(b.net.water * 10) / 10, -1.2);
  assert.equal(Math.round(b.net.credits * 10) / 10, 3.6);
});

t("build deducts cost and raises level", () => {
  const s = createState({ seed: 1 });
  const r = buildOrUpgrade(s, "solar-array");
  assert.equal(r.ok, true);
  assert.equal(s.buildings["solar-array"], 1);
  assert.equal(s.resources.credits, 140);
});

t("cost scales geometrically, ore cheaper", () => {
  const solar = buildingById("solar-array");
  assert.equal(costFor(solar, 0).credits, 40);
  assert.equal(costFor(solar, 1).credits, Math.round(40 * 1.55));
  assert.equal(costFor(solar, 2).credits, Math.round(40 * 1.55 * 1.55));
  const hab = buildingById("habitat-dome");
  assert.equal(costFor(hab, 0).ore, 10);
  assert.equal(costFor(hab, 1).ore, 11);
  assert.equal(costFor(hab, 3).ore, 14);
  assert.equal(costFor(hab, 3).credits, 252);
});

t("event chance ramps with sol", () => {
  assert.equal(eventChanceFor(1), EVENT_CHANCE_EARLY);
  assert.equal(eventChanceFor(14), EVENT_CHANCE_EARLY);
  assert.equal(eventChanceFor(15), EVENT_CHANCE_MID);
  assert.equal(eventChanceFor(39), EVENT_CHANCE_MID);
  assert.equal(eventChanceFor(40), EVENT_CHANCE_LATE);
  assert.equal(eventChanceFor(200), EVENT_CHANCE_LATE);
});

t("unlock gating blocks habitat before electrolyzer", () => {
  const s = createState({ seed: 1 });
  const def = buildingById("habitat-dome");
  assert.equal(isUnlocked(s, def), false);
  assert.match(unlockHint(s, def), /Electrolyzer/);
  const r = buildOrUpgrade(s, "habitat-dome");
  assert.equal(r.ok, false);
});

t("unlock gating opens after prerequisite", () => {
  const s = createState({ seed: 1 });
  s.resources.credits = 10000;
  s.resources.ore = 1000;
  buildOrUpgrade(s, "electrolyzer");
  const def = buildingById("habitat-dome");
  assert.equal(isUnlocked(s, def), true);
  assert.equal(buildOrUpgrade(s, "habitat-dome").ok, true);
});

t("brownout triggers when power is short", () => {
  const s = createState({ seed: 1 });
  s.resources.power = 0;
  s.buildings["electrolyzer"] = 1;
  const b = productionBreakdown(s);
  assert.equal(b.brownout, true);
  assert.equal(b.efficiency, 0);
  assert.equal(b.produced.oxygen, 0);
});

t("brownout scales production proportionally", () => {
  const s = createState({ seed: 1 });
  s.resources.power = 3;
  s.buildings["landing-pad"] = 0;
  s.buildings["solar-array"] = 0;
  s.buildings["electrolyzer"] = 2;
  const b = productionBreakdown(s);
  assert.equal(b.powerDemand, 6);
  assert.equal(b.efficiency, 0.5);
  assert.equal(Math.round(b.produced.oxygen * 100) / 100, 5);
});

t("trade hub converts ore to credits", () => {
  const s = createState({ seed: 1 });
  s.buildings["trade-hub"] = 1;
  s.resources.ore = 100;
  const b = productionBreakdown(s);
  assert.equal(b.tradeSold, 10);
  assert.ok(b.produced.credits >= 30);
});

t("advanceSol is deterministic for a fixed seed", () => {
  const a = createState({ seed: 777 });
  const b = createState({ seed: 777 });
  for (let i = 0; i < 25; i += 1) {
    advanceSol(a);
    advanceSol(b);
  }
  assert.deepEqual(a.resources, b.resources);
  assert.deepEqual(a.log, b.log);
  assert.equal(a.sol, b.sol);
});

t("different seeds diverge", () => {
  const a = createState({ seed: 1 });
  const b = createState({ seed: 2 });
  for (let i = 0; i < 40; i += 1) {
    advanceSol(a);
    advanceSol(b);
  }
  const same = JSON.stringify(a.log) === JSON.stringify(b.log);
  assert.equal(same, false);
});

t("undo restores the previous sol", () => {
  const s = createState({ seed: 5 });
  const before = JSON.stringify(s.resources);
  advanceSol(s);
  assert.equal(canUndo(s), true);
  undoLastSol(s);
  assert.equal(JSON.stringify(s.resources), before);
  assert.equal(s.sol, 1);
});

t("undo is capped at the history limit", () => {
  const s = createState({ seed: 5 });
  for (let i = 0; i < 10; i += 1) advanceSol(s);
  let undos = 0;
  while (canUndo(s)) {
    undoLastSol(s);
    undos += 1;
  }
  assert.equal(undos, 5);
});

t("oxygen collapse offers a rescue then recovers", () => {
  const s = createState({ seed: 9 });
  s.resources.oxygen = 0;
  s.resources.credits = 5000;
  advanceSol(s);
  advanceSol(s);
  advanceSol(s);
  assert.ok(s.pending, "expected a pending rescue");
  assert.equal(s.pending.type, "rescue");
  const cost = s.pending.cost;
  assert.equal(cost, rescueCost(s));
  const creditsBefore = s.resources.credits;
  const r = resolveRescue(s, true);
  assert.equal(r.rescued, true);
  assert.equal(s.status, "playing");
  assert.equal(s.resources.oxygen, 20);
  assert.equal(s.rescues, 1);
  assert.equal(s.resources.credits, creditsBefore - cost);
});

t("refusing rescue ends the colony", () => {
  const s = createState({ seed: 9 });
  s.resources.oxygen = 0;
  s.resources.credits = 0;
  advanceSol(s);
  advanceSol(s);
  advanceSol(s);
  assert.ok(s.pending);
  resolveRescue(s, false);
  assert.equal(s.status, "lost");
});

t("population grows toward habitat capacity", () => {
  const s = createState({ seed: 3 });
  s.resources = { power: 500, water: 500, oxygen: 500, ore: 0, credits: 500 };
  s.buildings["habitat-dome"] = 2;
  assert.equal(popCap(s), 12);
  for (let i = 0; i < 30; i += 1) advanceSol(s);
  assert.ok(s.population > 2, `population should grow, got ${s.population}`);
  assert.ok(s.population <= 12);
});

t("win condition fires at population and sustain streak", () => {
  const s = createState({ seed: 4 });
  s.population = 50;
  s.selfSustainStreak = 9;
  s.resources = { power: 500, water: 500, oxygen: 500, ore: 0, credits: 500 };
  s.buildings["solar-array"] = 12;
  s.buildings["ice-drill"] = 10;
  s.buildings["electrolyzer"] = 12;
  advanceSol(s);
  assert.equal(s.status, "won");
});

t("save round-trips through toSave/fromSave", () => {
  const s = createState({ seed: 42 });
  s.resources.credits = 999;
  s.buildings["solar-array"] = 3;
  advanceSol(s);
  const restored = fromSave(toSave(s));
  assert.equal(restored.resources.credits, s.resources.credits);
  assert.equal(restored.buildings["solar-array"], 3);
  assert.equal(restored.sol, s.sol);
  assert.deepEqual(restored.history, []);
});

t("doctrine can only be set on sol 1", () => {
  const s = createState({ seed: 6 });
  assert.equal(setDoctrine(s, "industry").ok, true);
  assert.equal(s.doctrine, "industry");
  advanceSol(s);
  assert.equal(setDoctrine(s, "science").ok, false);
  assert.equal(s.doctrine, "industry");
});

t("industry doctrine boosts ore output", () => {
  const plain = createState({ seed: 8 });
  const ind = createState({ seed: 8 });
  ind.doctrine = "industry";
  for (const s of [plain, ind]) {
    s.buildings["ore-mine"] = 2;
    s.resources.power = 500;
  }
  const a = productionBreakdown(plain).produced.ore;
  const b = productionBreakdown(ind).produced.ore;
  assert.ok(b > a, `industry ore ${b} should exceed plain ${a}`);
});

t("research lab raises global efficiency", () => {
  const s = createState({ seed: 8 });
  s.buildings["ore-mine"] = 2;
  s.resources.power = 500;
  const before = productionBreakdown(s).produced.ore;
  s.buildings["research-lab"] = 2;
  const after = productionBreakdown(s).produced.ore;
  assert.ok(after > before);
});

t("achievement unlocks once", () => {
  const s = createState({ seed: 8 });
  buildOrUpgrade(s, "solar-array");
  advanceSol(s);
  assert.ok(s.achievements.includes("first-light"));
  const count = s.achievements.filter((a) => a === "first-light").length;
  assert.equal(count, 1);
});

t("preview never mutates state", () => {
  const s = createState({ seed: 11 });
  const snapshot = JSON.stringify(s);
  previewNextSol(s);
  productionBreakdown(s);
  assert.equal(JSON.stringify(s), snapshot);
});

t("meteor with no targets falls back without double count", () => {
  const s = createState({ seed: 21 });
  const before = s.stats.events;
  const report = { events: [], achievements: [], growth: 0, unlocked: [] };
  const { default: eng } = { default: null };
  void eng;
  const rng = rngFor(s);
  debugApplyEvent(s, "meteor-strike", rng, report);
  assert.equal(s.stats.events, before + 1);
  assert.equal(report.events.length, 1);
  assert.equal(report.events[0].id, "dust-devil");
});

t("solar flare shields with power or takes a colonist", () => {
  const rich = createState({ seed: 22 });
  rich.resources.power = 100;
  rich.population = 5;
  const rngR = rngFor(rich);
  const repR = { events: [] };
  debugApplyEvent(rich, "solar-flare", rngR, repR);
  assert.equal(rich.resources.power, 60);
  assert.equal(rich.population, 5);

  const poor = createState({ seed: 22 });
  poor.resources.power = 0;
  poor.population = 5;
  const rngP = rngFor(poor);
  debugApplyEvent(poor, "solar-flare", rngP, { events: [] });
  assert.equal(poor.population, 4);
});

t("reactor scram zeroes reactor output", () => {
  const s = createState({ seed: 23 });
  s.buildings["nuclear-reactor"] = 1;
  s.resources.power = 500;
  const on = productionBreakdown(s).produced.power;
  assert.ok(on >= 24);
  s.effects.push({ id: "reactor-scram", solsLeft: 2 });
  const off = productionBreakdown(s).produced.power;
  assert.equal(off, 0);
});

t("unaffordable rescue accept refuses without dying", () => {
  const s = createState({ seed: 24 });
  s.resources.oxygen = 0;
  s.resources.credits = 0;
  advanceSol(s);
  advanceSol(s);
  advanceSol(s);
  assert.ok(s.pending);
  const r = resolveRescue(s, true);
  assert.equal(r.ok, false);
  assert.equal(r.reason, "unaffordable");
  assert.ok(s.pending);
  assert.equal(s.status, "playing");
});

t("second rescue costs more than the first", () => {
  const s = createState({ seed: 25 });
  const first = rescueCost(s);
  s.rescues = 1;
  const second = rescueCost(s);
  assert.ok(second > first);
  assert.equal(first, 100);
});

t("daily seeds are stable per UTC day", () => {
  const a = seedForDaily("2026-09-17");
  const b = seedForDaily("2026-09-17");
  const c = seedForDaily("2026-09-18");
  assert.equal(a, b);
  assert.notEqual(a, c);
  const g1 = createState({ mode: "daily", seed: a });
  const g2 = createState({ mode: "daily", seed: a });
  for (let i = 0; i < 10; i += 1) {
    advanceSol(g1);
    advanceSol(g2);
  }
  assert.deepEqual(g1.resources, g2.resources);
});

t("fromSave rejects garbage", () => {
  assert.equal(fromSave(null), null);
  assert.equal(fromSave([1, 2]), null);
  assert.equal(fromSave({ version: 999 }), null);
  assert.equal(fromSave({ version: 1, buildings: { "solar-array": "x" }, resources: { credits: NaN } }).buildings["solar-array"], 0);
  const bad = fromSave({ version: 1, population: -99, sol: "5", effects: "x", achievements: ["nope", "first-light"] });
  assert.equal(bad.population, 0);
  assert.equal(bad.sol, 5);
  assert.deepEqual(bad.effects, []);
  assert.deepEqual(bad.achievements, ["first-light"]);
});

t("undo rewinds rng exactly", () => {
  const s = createState({ seed: 26 });
  advanceSol(s);
  const callsAfter = s.rngCalls;
  assert.ok(callsAfter > 0);
  undoLastSol(s);
  assert.equal(s.rngCalls, 0);
  const a = createState({ seed: 26 });
  advanceSol(s);
  advanceSol(a);
  assert.deepEqual(s.resources, a.resources);
});

t("growth doctrine grows faster, science doubles lab", () => {
  const g = createState({ seed: 27 });
  g.doctrine = "growth";
  const p = createState({ seed: 27 });
  g.resources = { power: 500, water: 500, oxygen: 500, ore: 0, credits: 500 };
  p.resources = { power: 500, water: 500, oxygen: 500, ore: 0, credits: 500 };
  g.buildings["habitat-dome"] = 3;
  p.buildings["habitat-dome"] = 3;
  for (let i = 0; i < 12; i += 1) {
    advanceSol(g);
    advanceSol(p);
  }
  assert.ok(g.population > p.population);

  const lab = createState({ seed: 27 });
  lab.doctrine = "science";
  lab.buildings["ore-mine"] = 2;
  lab.resources.power = 500;
  const plain = createState({ seed: 27 });
  plain.buildings["ore-mine"] = 2;
  plain.resources.power = 500;
  plain.buildings["research-lab"] = 1;
  lab.buildings["research-lab"] = 1;
  const sciBoost = productionBreakdown(lab).produced.ore / productionBreakdown(plain).produced.ore;
  assert.ok(sciBoost > 1.02);
});

t("dust storm cuts solar to forty percent", () => {
  const s = createState({ seed: 28 });
  s.buildings["solar-array"] = 2;
  s.resources.power = 0;
  const clear = productionBreakdown(s).produced.power;
  s.effects.push({ id: "dust-storm", solsLeft: 2 });
  const storm = productionBreakdown(s).produced.power;
  assert.ok(Math.abs(storm - clear * 0.4) < 0.01);
});

t("trade hub keeps half the ore as reserve", () => {
  const s = createState({ seed: 29 });
  s.buildings["trade-hub"] = 2;
  s.buildings["ore-mine"] = 4;
  s.resources.ore = 0;
  s.resources.power = 500;
  advanceSol(s);
  assert.ok(s.resources.ore > 0);
});

t("brownout or zero oxygen resets the sustain streak", () => {
  const s = createState({ seed: 30 });
  s.selfSustainStreak = 9;
  s.resources = { power: 0, water: 500, oxygen: 500, ore: 0, credits: 500 };
  s.buildings["electrolyzer"] = 1;
  advanceSol(s);
  assert.equal(s.selfSustainStreak, 0);
});

t("empty colony loses even with sustain met", () => {
  const s = createState({ seed: 31 });
  s.population = 1;
  s.resources.power = 0;
  s.selfSustainStreak = 10;
  const rng = rngFor(s);
  debugApplyEvent(s, "solar-flare", rng, { events: [] });
  assert.equal(s.population, 0);
  advanceSol(s);
  assert.equal(s.status, "lost");
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) {
  for (const f of failures) console.error(`\n${f.name}:\n${f.err.stack}`);
  process.exit(1);
}
