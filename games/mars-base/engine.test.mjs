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

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) {
  for (const f of failures) console.error(`\n${f.name}:\n${f.err.stack}`);
  process.exit(1);
}
