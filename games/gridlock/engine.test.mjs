import test from "node:test";
import assert from "node:assert/strict";

// Seedable PRNG for deterministic tests
function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Re-implemented pure solver functions (mirroring solver.js) ──

function createEmptyGrid() {
  return Array(81).fill(0);
}

function indexToRowCol(i) {
  return {
    row: Math.floor(i / 9),
    col: i % 9,
    box: Math.floor(Math.floor(i / 9) / 3) * 3 + Math.floor((i % 9) / 3),
  };
}

function rowColToIndex(r, c) {
  return r * 9 + c;
}

function getPeers(index) {
  const r = Math.floor(index / 9);
  const c = index % 9;
  const br = Math.floor(r / 3) * 3;
  const bc = Math.floor(c / 3) * 3;
  const peers = new Set();
  for (let i = 0; i < 9; i++) {
    if (i !== c) peers.add(r * 9 + i);
    if (i !== r) peers.add(i * 9 + c);
  }
  for (let dr = 0; dr < 3; dr++) {
    for (let dc = 0; dc < 3; dc++) {
      const idx = (br + dr) * 9 + (bc + dc);
      if (idx !== index) peers.add(idx);
    }
  }
  return Array.from(peers);
}

const PEERS_TABLE = Array(81)
  .fill(0)
  .map((_, i) => getPeers(i));

function isValidPlacement(grid, index, num) {
  if (num === 0) return true;
  const peers = PEERS_TABLE[index];
  for (let i = 0; i < peers.length; i++) {
    if (grid[peers[i]] === num) return false;
  }
  return true;
}

function getCandidates(grid, index) {
  if (grid[index] !== 0) return [];
  const peers = PEERS_TABLE[index];
  const used = new Set();
  for (let i = 0; i < peers.length; i++) {
    const val = grid[peers[i]];
    if (val !== 0) used.add(val);
  }
  const candidates = [];
  for (let n = 1; n <= 9; n++) {
    if (!used.has(n)) candidates.push(n);
  }
  return candidates;
}

function shuffle(array, rng = Math.random) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function countSolutions(grid, limit = 2) {
  let count = 0;
  const workGrid = [...grid];
  function search(idx) {
    if (idx === 81) {
      count++;
      return;
    }
    if (workGrid[idx] !== 0) {
      search(idx + 1);
      return;
    }
    const cands = getCandidates(workGrid, idx);
    for (let i = 0; i < cands.length; i++) {
      workGrid[idx] = cands[i];
      search(idx + 1);
      workGrid[idx] = 0;
      if (count >= limit) return;
    }
  }
  search(0);
  return count;
}

function solveBacktrack(grid, rng = Math.random) {
  const workGrid = [...grid];
  function backtrack() {
    let bestIdx = -1;
    let minCands = 10;
    for (let i = 0; i < 81; i++) {
      if (workGrid[i] === 0) {
        const cands = getCandidates(workGrid, i);
        if (cands.length === 0) return false;
        if (cands.length < minCands) {
          minCands = cands.length;
          bestIdx = i;
          if (minCands === 1) break;
        }
      }
    }
    if (bestIdx === -1) return true;
    const candidates = shuffle(getCandidates(workGrid, bestIdx), rng);
    for (const num of candidates) {
      workGrid[bestIdx] = num;
      if (backtrack()) return true;
      workGrid[bestIdx] = 0;
    }
    return false;
  }
  const ok = backtrack();
  return ok ? workGrid : null;
}

const TIER_CLUES = {
  Rookie: { min: 40, max: 45 },
  Standard: { min: 32, max: 39 },
  Hard: { min: 28, max: 31 },
  Expert: { min: 24, max: 27 },
  Nightmare: { min: 20, max: 23 },
};

function generateSudoku(targetTier = "Standard", rng = Math.random) {
  const empty = createEmptyGrid();
  const solution = solveBacktrack(empty, rng);
  if (!solution) throw new Error("Failed to generate complete solution");
  const puzzle = [...solution];
  const targetRange = TIER_CLUES[targetTier] || TIER_CLUES.Standard;
  const targetClues =
    Math.floor(rng() * (targetRange.max - targetRange.min + 1)) +
    targetRange.min;
  const indices = shuffle(
    Array.from({ length: 81 }, (_, i) => i),
    rng
  );
  let currentClues = 81;
  for (const idx of indices) {
    if (currentClues <= targetClues) break;
    const backup = puzzle[idx];
    puzzle[idx] = 0;
    if (countSolutions(puzzle, 2) === 1) {
      currentClues--;
    } else {
      puzzle[idx] = backup;
    }
  }
  return { puzzle, solution, clues: currentClues, targetTier };
}

// ── Tests ──

test("createEmptyGrid returns 81 zeros", () => {
  const grid = createEmptyGrid();
  assert.equal(grid.length, 81);
  assert.ok(grid.every((v) => v === 0));
});

test("indexToRowCol and rowColToIndex round-trip correctly", () => {
  for (let i = 0; i < 81; i++) {
    const { row, col, box } = indexToRowCol(i);
    assert.equal(rowColToIndex(row, col), i);
    // Box should be 0-8
    assert.ok(box >= 0 && box < 9);
    // Verify box calculation
    const expectedBox = Math.floor(row / 3) * 3 + Math.floor(col / 3);
    assert.equal(box, expectedBox);
  }
});

test("getPeers returns exactly 20 unique peers per cell", () => {
  for (let i = 0; i < 81; i++) {
    const peers = getPeers(i);
    const unique = new Set(peers);
    assert.equal(unique.size, 20, `Cell ${i} should have 20 unique peers`);
    assert.ok(!unique.has(i), `Cell ${i} should not be its own peer`);
  }
});

test("isValidPlacement rejects conflicting numbers in row, col, and box", () => {
  const grid = createEmptyGrid();
  // Place 5 at row 0, col 0
  grid[0] = 5;

  // Same row conflict (row 0, col 4)
  assert.ok(!isValidPlacement(grid, 4, 5), "Same row conflict");
  // Same col conflict (row 4, col 0)
  assert.ok(!isValidPlacement(grid, 36, 5), "Same col conflict");
  // Same box conflict (row 1, col 1)
  assert.ok(!isValidPlacement(grid, 10, 5), "Same box conflict");
  // No conflict (row 4, col 4) — different row, col, and box
  assert.ok(isValidPlacement(grid, 40, 5), "No conflict — should be valid");
  // Different number always valid
  assert.ok(isValidPlacement(grid, 4, 3), "Different number — no conflict");
});

test("getCandidates returns only valid numbers for empty cells", () => {
  const grid = createEmptyGrid();
  // Fill row 0 with 1-8 (leave col 8 empty)
  for (let c = 0; c < 8; c++) grid[c] = c + 1;

  const cands = getCandidates(grid, 8); // row 0, col 8
  assert.deepEqual(cands, [9], "Only 9 should be valid in last cell of row");

  // Filled cell returns empty candidates
  assert.deepEqual(getCandidates(grid, 0), []);
});

test("countSolutions on a complete solved grid returns exactly 1", () => {
  const rng = mulberry32(42);
  const solution = solveBacktrack(createEmptyGrid(), rng);
  assert.ok(solution, "Should produce a valid solution");
  assert.equal(
    countSolutions(solution, 2),
    1,
    "Complete grid has exactly 1 solution"
  );

  // Verify all 81 cells are filled with 1-9
  assert.ok(solution.every((v) => v >= 1 && v <= 9));
});

test("generated Rookie puzzle has exactly 1 unique solution", () => {
  const rng = mulberry32(123);
  const result = generateSudoku("Rookie", rng);

  assert.equal(result.puzzle.length, 81);
  assert.equal(result.solution.length, 81);

  // Clues should be in Rookie range
  assert.ok(
    result.clues >= TIER_CLUES.Rookie.min,
    `Clues ${result.clues} below Rookie min ${TIER_CLUES.Rookie.min}`
  );

  // Must have exactly 1 solution
  assert.equal(
    countSolutions(result.puzzle, 2),
    1,
    "Generated puzzle must have exactly 1 unique solution"
  );
});

test("TIER_CLUES ranges are well-ordered: Rookie most clues, Nightmare least", () => {
  const tiers = ["Rookie", "Standard", "Hard", "Expert", "Nightmare"];
  for (let i = 0; i < tiers.length - 1; i++) {
    const current = TIER_CLUES[tiers[i]];
    const next = TIER_CLUES[tiers[i + 1]];
    assert.ok(
      current.min > next.min,
      `${tiers[i]}.min (${current.min}) should be > ${tiers[i + 1]}.min (${next.min})`
    );
    assert.ok(
      current.max > next.max,
      `${tiers[i]}.max (${current.max}) should be > ${tiers[i + 1]}.max (${next.max})`
    );
  }
});
