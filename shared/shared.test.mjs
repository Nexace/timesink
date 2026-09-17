import assert from "node:assert/strict";
import { createRng, rngFromSnapshot, hashSeed, dailySeedKey } from "./rng.js";
import { exportCode, importCode } from "./storage.js";
import { fmt, fmtDelta, fmtExact, fmtCost, pct, ordinal, formatDuration, clamp } from "./format.js";

let passed = 0;
let failed = 0;

function t(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`  ok  ${name}`);
  } catch (err) {
    failed += 1;
    console.log(`FAIL  ${name}\n      ${err.message}`);
  }
}

console.log("shared module tests\n");

t("rng is deterministic per seed", () => {
  const a = createRng(123);
  const b = createRng(123);
  for (let i = 0; i < 20; i += 1) assert.equal(a.next(), b.next());
});

t("rng snapshot restores state exactly", () => {
  const a = createRng(99);
  for (let i = 0; i < 50; i += 1) a.next();
  const snap = a.snapshot();
  const b = rngFromSnapshot(snap);
  for (let i = 0; i < 20; i += 1) assert.equal(a.next(), b.next());
});

t("rng rejects invalid snapshots", () => {
  assert.throws(() => rngFromSnapshot(null), RangeError);
  assert.throws(() => rngFromSnapshot({ seed: 1, calls: -1 }), RangeError);
  assert.throws(() => rngFromSnapshot({ seed: 1, calls: 1.5 }), RangeError);
  assert.throws(() => rngFromSnapshot({ seed: 1, calls: 99999999 }), RangeError);
});

t("rng helpers handle bad input", () => {
  const r = createRng(7);
  assert.equal(r.pick([]), undefined);
  assert.equal(r.pick(null), undefined);
  assert.equal(r.weighted([]), null);
  assert.equal(r.weighted([{ id: "a" }]), "a");
  assert.equal(r.chance(0), false);
  assert.equal(r.chance(1), true);
  assert.equal(r.chance(NaN), false);
  assert.deepEqual(r.shuffle(null), []);
  assert.equal(hashSeed(null), hashSeed(""));
});

t("daily keys are UTC calendar days", () => {
  const d = new Date(Date.UTC(2026, 8, 17, 23, 59));
  assert.equal(dailySeedKey(d), "2026-09-17");
});

t("export/import round-trips with whitespace", () => {
  const data = { version: 1, sol: 42, name: "héllo wörld" };
  const code = exportCode(data);
  assert.ok(code && !code.includes(" "));
  const broken = code.slice(0, 20) + "\n  " + code.slice(20, 40) + "\r\n" + code.slice(40);
  assert.deepEqual(importCode(broken), data);
  assert.equal(importCode(""), null);
  assert.equal(importCode("!!!"), null);
  assert.equal(importCode("   "), null);
});

t("formatters never throw or leak infinity", () => {
  assert.equal(fmt(NaN), "—");
  assert.equal(fmt(undefined), "—");
  assert.equal(fmt("123"), "123");
  assert.equal(fmt(1500), "1,500");
  assert.equal(fmt(15000), "15.0K");
  assert.equal(fmt(-2500000), "-2.50M");
  assert.equal(fmtDelta(0), "±0");
  assert.equal(fmtDelta(-3), "-3");
  assert.equal(fmtDelta(2.5, 1), "+2.5");
  assert.equal(fmtExact(null), "0");
  assert.equal(fmtExact(undefined), "—");
  assert.equal(fmtCost(null), "—");
  assert.equal(fmtCost({}), "free");
  assert.equal(pct(0.5), "50%");
  assert.equal(pct(NaN), "—");
  assert.equal(ordinal(1), "1st");
  assert.equal(ordinal(2), "2nd");
  assert.equal(ordinal(3), "3rd");
  assert.equal(ordinal(11), "11th");
  assert.equal(formatDuration(90), "1m 30s");
  assert.equal(formatDuration(NaN), "0s");
  assert.equal(clamp(NaN, 0, 5), 0);
  assert.equal(fmt(5, -1), "5");
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
