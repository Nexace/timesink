/**
 * GRIDLOCK — Web Worker for Asynchronous Sudoku Generation
 * Keeps main thread completely smooth and responsive during puzzle generation.
 */

import { generateSudoku, generateKillerCages } from "./solver.js";

self.onmessage = function (e) {
  const { action, tier, mode, seed } = e.data;

  if (action === "generate") {
    try {
      // Optional seeded PRNG for Daily Puzzle
      let rng = Math.random;
      if (typeof seed === "number") {
        let s = seed;
        rng = function () {
          s = (s * 9301 + 49297) % 233280;
          return s / 233280;
        };
      }

      const generated = generateSudoku(tier || "Standard", rng);

      let killerCages = null;
      if (mode === "killer") {
        killerCages = generateKillerCages(generated.solution, rng);
      }

      self.postMessage({
        status: "ok",
        ...generated,
        killerCages,
      });
    } catch (err) {
      self.postMessage({
        status: "error",
        error: err.message,
      });
    }
  }
};
