import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { games, liveGames, getGame, getHowToPlay } from "./registry.js";
import { createRuleEngine } from "./rule-engine.js";

test("registry contains exactly 18 live games", () => {
  assert.equal(games.length, 18, "Should have exactly 18 games");
  assert.equal(liveGames().length, 18, "All 18 games should be live");

  const expectedSlugs = [
    "mars-base",
    "ground-zero",
    "diet-game",
    "ping-age",
    "rootkit",
    "ghost-lap",
    "redlight",
    "resume-game",
    "ironsail",
    "ace-vector",
    "swarmline",
    "last-tower",
    "ore-runner",
    "skydoodle",
    "gridlock",
    "teraform-run",
    "headbutt",
    "ironclad",
  ];

  const actualSlugs = games.map((g) => g.slug);
  assert.deepEqual(actualSlugs, expectedSlugs);

  // Verify all 18 games have unique signature accent colors
  const accents = games.map((g) => g.accent);
  const uniqueAccents = new Set(accents);
  assert.equal(uniqueAccents.size, 18, `All 18 games must have unique colors, got: ${accents.join(", ")}`);

  const validAccents = new Set([
    "flare", "lime", "cyan", "pink", "teal", "purple", "blue", "crimson", "gold", "red", "blood", "amber", "magenta", "green", "emerald", "orange", "copper", "indigo", "doodle", "mint", "phosphor", "mono", "silver", "violet", "steel", "steel-blue"
  ]);
  for (const game of games) {
    assert.ok(validAccents.has(game.accent), `Game ${game.slug} has valid accent: ${game.accent}`);
  }

  // Verify deleted games are not present
  assert.equal(getGame("cold-snap"), null);
  assert.equal(getGame("pixel-auction"), null);
  assert.equal(getGame("price-of-nothing"), null);
  assert.equal(getGame("null-snake"), null);
});

test("all games contain valid howToPlay instructions with fallback support", () => {
  for (const game of games) {
    const htp = getHowToPlay(game.slug);
    assert.ok(htp, `Game ${game.slug} must have howToPlay data`);
    assert.ok(typeof htp.goal === "string" && htp.goal.length > 5, `Game ${game.slug} must have a goal`);
    assert.ok(Array.isArray(htp.steps) && htp.steps.length >= 2, `Game ${game.slug} must have >= 2 steps`);
    assert.ok(typeof htp.tip === "string" && htp.tip.length > 5, `Game ${game.slug} must have a tip`);
  }

  // Verify fallback for an unknown/future game
  const fallback = getHowToPlay("future-game");
  assert.ok(fallback.goal.includes("future-game"));
  assert.ok(fallback.steps.length >= 2);
  assert.ok(fallback.tip);
});

test("all game directories exist with index.html", () => {
  for (const game of games) {
    const dir = path.join(process.cwd(), "games", game.slug);
    assert.ok(fs.existsSync(dir), `Directory games/${game.slug} must exist`);
    const indexPath = path.join(dir, "index.html");
    assert.ok(fs.existsSync(indexPath), `games/${game.slug}/index.html must exist`);
  }
});

test("rule engine escalates rules progressively", () => {
  const rules = [
    { id: "r1", label: "Must have at least 5 chars", test: (t) => t.length >= 5 },
    { id: "r2", label: "Must contain 'retro'", test: (t) => t.includes("retro") },
    { id: "r3", label: "Must contain a number", test: (t) => /\d/.test(t) },
  ];

  const engine = createRuleEngine(rules);
  assert.equal(engine.totalRules, 3);
  assert.equal(engine.unlockedCount, 1);

  // Empty string fails rule 1
  let res = engine.evaluate("");
  assert.equal(res.unlockedCount, 1);
  assert.equal(res.results[0].passed, false);

  // Satisfy rule 1 -> unlocks rule 2
  res = engine.evaluate("hello world");
  assert.equal(res.unlockedCount, 2);
  assert.equal(res.results[0].passed, true);
  assert.equal(res.results[1].passed, false);

  // Satisfy rule 1 & 2 -> unlocks rule 3
  res = engine.evaluate("hello retro");
  assert.equal(res.unlockedCount, 3);
  assert.equal(res.results[0].passed, true);
  assert.equal(res.results[1].passed, true);
  assert.equal(res.results[2].passed, false);

  // Satisfy all 3
  res = engine.evaluate("hello retro 1884");
  assert.equal(res.completedAll, true);
  assert.equal(res.passedCount, 3);
});

test("score store handles numeric and categorical scores", () => {
  // Mock localStorage in Node environment
  const mockStorage = new Map();
  globalThis.localStorage = {
    getItem: (k) => mockStorage.get(k) ?? null,
    setItem: (k, v) => mockStorage.set(k, String(v)),
    removeItem: (k) => mockStorage.delete(k),
  };

  // Import score functions
  import("./scores.js").then(({ saveScore, getBestScore }) => {
    // 1. Higher is better (e.g. Diet Game rules passed)
    saveScore("diet-game", 5, "5/25 Rules");
    let best = getBestScore("diet-game");
    assert.equal(best.score, 5);
    assert.equal(best.label, "5/25 Rules");

    saveScore("diet-game", 3, "3/25 Rules");
    best = getBestScore("diet-game");
    assert.equal(best.score, 5, "Lower score should not overwrite higher");

    saveScore("diet-game", 12, "12/25 Rules");
    best = getBestScore("diet-game");
    assert.equal(best.score, 12, "Higher score should overwrite");

    // 2. Lower is better (e.g. Redlight reaction time)
    saveScore("redlight", 250, ".250 s", { lowerIsBetter: true });
    best = getBestScore("redlight");
    assert.equal(best.score, 250);

    saveScore("redlight", 310, ".310 s", { lowerIsBetter: true });
    best = getBestScore("redlight");
    assert.equal(best.score, 250, "Slower time should not overwrite faster");

    saveScore("redlight", 180, ".180 s", { lowerIsBetter: true });
    best = getBestScore("redlight");
    assert.equal(best.score, 180, "Faster time should overwrite");

    // 3. Categorical string score (e.g. Ping Age era)
    saveScore("ping-age", "DIAL-UP NATIVE", "DIAL-UP NATIVE (1895-2001)");
    best = getBestScore("ping-age");
    assert.equal(best.score, "DIAL-UP NATIVE");
    assert.equal(best.label, "DIAL-UP NATIVE (1895-2001)");
  });
});
