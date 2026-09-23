import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  ERAS,
  QUESTIONS,
  REACTIONS,
  shuffleArray,
  calculateWinningEra,
  calculateHybridDna,
  checkTimeTraveller,
  evaluateBadges,
  formatDossierShareText,
} from "./data.js";

describe("Ping Age Era Database", () => {
  it("contains exactly 5 canonical digital eras", () => {
    assert.equal(ERAS.length, 5, "Must have exactly 5 eras");
    const ids = ERAS.map((e) => e.id);
    assert.deepEqual(ids, ["dialup", "myspace", "meme", "feed", "brainrot"]);
  });

  it("each era has rich metadata and complete 4-part archaeological dossier", () => {
    for (const era of ERAS) {
      assert.ok(era.id, "Era must have an id");
      assert.ok(era.name, `Era ${era.id} must have a name`);
      assert.ok(era.dates, `Era ${era.id} must have dates`);
      assert.ok(era.archetype, `Era ${era.id} must have an archetype title`);
      assert.ok(era.desc && era.desc.length > 40, `Era ${era.id} must have a detailed description`);
      assert.ok(era.color, `Era ${era.id} must have a signature color`);

      assert.ok(era.dossier, `Era ${era.id} must have a dossier object`);
      assert.ok(era.dossier.relic && era.dossier.relic.length > 10, `Era ${era.id} missing relic`);
      assert.ok(era.dossier.habitat && era.dossier.habitat.length > 10, `Era ${era.id} missing habitat`);
      assert.ok(era.dossier.trauma && era.dossier.trauma.length > 10, `Era ${era.id} missing trauma`);
      assert.ok(era.dossier.superpower && era.dossier.superpower.length > 10, `Era ${era.id} missing superpower`);
    }
  });

  it("each era has a registered reaction with sound, text, and tag", () => {
    for (const era of ERAS) {
      const r = REACTIONS[era.id];
      assert.ok(r, `Reaction missing for era ${era.id}`);
      assert.ok(r.sound, `Reaction sound missing for ${era.id}`);
      assert.ok(r.text && r.text.length > 5, `Reaction text missing for ${era.id}`);
      assert.ok(r.tag && r.tag.length > 3, `Reaction tag missing for ${era.id}`);
    }
  });
});

describe("Ping Age Questions & Responses Matrix", () => {
  it("contains exactly 12 cultural archaeology questions", () => {
    assert.equal(QUESTIONS.length, 12, "Must have exactly 12 questions");
  });

  it("each question has non-empty category, text, and 5 era-balanced options", () => {
    const expectedEras = ["dialup", "myspace", "meme", "feed", "brainrot"];

    QUESTIONS.forEach((q, i) => {
      assert.ok(q.category && q.category.length > 2, `Question ${i + 1} missing category`);
      assert.ok(q.text && q.text.length > 10, `Question ${i + 1} missing prompt text`);
      assert.equal(q.options.length, 5, `Question ${i + 1} must have 5 options`);

      // Verify every single era is represented exactly once per question
      const coveredEras = q.options.flatMap((opt) => opt.eras);
      assert.equal(coveredEras.length, 5, `Question ${i + 1} options must cover 5 eras`);
      for (const eraId of expectedEras) {
        assert.ok(coveredEras.includes(eraId), `Question ${i + 1} missing coverage for era ${eraId}`);
      }

      // Check option labels are detailed and authentic
      for (const opt of q.options) {
        assert.ok(opt.label && opt.label.length >= 15, `Option text too short in Q${i + 1}: ${opt.label}`);
      }
    });
  });
});

describe("Ping Age Engine Logic & Calculations", () => {
  it("shuffleArray randomizes without mutating original array", () => {
    const orig = [1, 2, 3, 4, 5];
    const shuffled = shuffleArray(orig, () => 0.5);
    assert.notStrictEqual(shuffled, orig, "Must return a new array copy");
    assert.equal(shuffled.length, orig.length);
    assert.deepEqual(shuffled.sort(), orig.sort());
  });

  it("calculateWinningEra identifies maximum score", () => {
    const scores = { dialup: 1, myspace: 8, meme: 2, feed: 1, brainrot: 0 };
    const winner = calculateWinningEra(scores);
    assert.equal(winner.id, "myspace");
  });

  it("calculateWinningEra breaks ties in favor of oldest historical era", () => {
    // Both dialup and meme have 4
    const scores = { dialup: 4, myspace: 2, meme: 4, feed: 2, brainrot: 0 };
    const winner = calculateWinningEra(scores);
    assert.equal(winner.id, "dialup", "Dial-up should win tiebreak against meme due to chronological priority");
  });

  it("calculateHybridDna returns percentage shares correctly", () => {
    const scores = { dialup: 6, myspace: 3, meme: 3, feed: 0, brainrot: 0 };
    const dna = calculateHybridDna(scores, 12);
    assert.equal(dna.length, 5);

    const dialupDna = dna.find((d) => d.id === "dialup");
    assert.equal(dialupDna.count, 6);
    assert.equal(dialupDna.pct, 50);

    const myspaceDna = dna.find((d) => d.id === "myspace");
    assert.equal(myspaceDna.pct, 25);
  });

  it("checkTimeTraveller identifies spans across 3+ non-adjacent eras", () => {
    // Indices: 0 (dialup), 2 (meme), 4 (brainrot) -> non-adjacent!
    assert.equal(checkTimeTraveller([0, 2, 4]), true);

    // Indices: 0, 1, 2 -> all adjacent! Not time traveller
    assert.equal(checkTimeTraveller([0, 1, 2]), false);

    // Only 2 eras -> not time traveller
    assert.equal(checkTimeTraveller([0, 4]), false);
  });

  it("evaluateBadges awards Time Traveller, Era Purist, and Digital Omnivore correctly", () => {
    // 1. Era Purist (10 myspace out of 12)
    const puristScores = { dialup: 1, myspace: 10, meme: 1, feed: 0, brainrot: 0 };
    const puristBadges = evaluateBadges(puristScores, [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2]);
    assert.ok(puristBadges.some((b) => b.id === "era-purist"), "Should award ERA PURIST badge");

    // 2. Digital Omnivore (at least 1 in all 5)
    const omnivoreScores = { dialup: 3, myspace: 2, meme: 2, feed: 3, brainrot: 2 };
    const omnivoreBadges = evaluateBadges(omnivoreScores, [0, 1, 2, 3, 4]);
    assert.ok(omnivoreBadges.some((b) => b.id === "digital-omnivore"), "Should award DIGITAL OMNIVORE badge");
    assert.ok(omnivoreBadges.some((b) => b.id === "time-traveller"), "Should also award TIME TRAVELLER");

    // 3. Regular civilian without badges
    const normieScores = { dialup: 0, myspace: 7, meme: 5, feed: 0, brainrot: 0 };
    const normieBadges = evaluateBadges(normieScores, [1, 2]);
    assert.equal(normieBadges.length, 0, "No badges should be awarded for narrow adjacent spread");
  });

  it("formatDossierShareText generates shareable text summary", () => {
    const winningEra = ERAS[0];
    const dna = calculateHybridDna({ dialup: 12, myspace: 0, meme: 0, feed: 0, brainrot: 0 });
    const badges = [{ id: "era-purist", icon: "💾", name: "ERA PURIST" }];
    const text = formatDossierShareText({ winningEra, dna, badges });

    assert.ok(text.includes("DIAL-UP NATIVE"), "Share card must contain era name");
    assert.ok(text.includes("ERA PURIST"), "Share card must contain badge");
    assert.ok(text.includes("timesink.vercel.app/games/ping-age"), "Share card must contain link");
  });
});
