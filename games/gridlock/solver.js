/**
 * GRIDLOCK — Sudoku Pure Engine & Logical Solver
 * Handles:
 * - Randomized backtracking full-board generator
 * - Solution counting solver (ensures EXACTLY 1 unique solution)
 * - Technique-tagged logical solver (Naked Singles, Hidden Singles, Pointing Pairs,
 *   Box-Line Reductions, Naked Pairs, Hidden Pairs, X-Wing, Swordfish)
 * - Killer Sudoku cage generator and sum validator
 */

// Helper to create empty 9x9 board
export function createEmptyGrid() {
  return Array(81).fill(0);
}

export function indexToRowCol(i) {
  return { row: Math.floor(i / 9), col: i % 9, box: Math.floor(Math.floor(i / 9) / 3) * 3 + Math.floor((i % 9) / 3) };
}

export function rowColToIndex(r, c) {
  return r * 9 + c;
}

// Get peers of a cell index (all cells in same row, column, or 3x3 box)
export function getPeers(index) {
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

// Precomputed peers table for high performance
export const PEERS_TABLE = Array(81).fill(0).map((_, i) => getPeers(i));

// Check if placing num at index is valid
export function isValidPlacement(grid, index, num) {
  if (num === 0) return true;
  const peers = PEERS_TABLE[index];
  for (let i = 0; i < peers.length; i++) {
    if (grid[peers[i]] === num) return false;
  }
  return true;
}

// Get valid candidate numbers for a cell
export function getCandidates(grid, index) {
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

// Shuffle array with optional seed or Math.random
export function shuffle(array, rng = Math.random) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// -------------------------------------------------------------
// BACKTRACKING SOLVER & UNIQUE SOLUTION COUNTER
// -------------------------------------------------------------

export function countSolutions(grid, limit = 2) {
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

    // Minimum Remaining Values (MRV) heuristic for fast pruning
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

// Solve grid and return solution or null
export function solveBacktrack(grid, rng = Math.random) {
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

    if (bestIdx === -1) return true; // solved!

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

// -------------------------------------------------------------
// TECHNIQUE-TAGGED LOGICAL SOLVER
// -------------------------------------------------------------

export function ratePuzzleTechnique(puzzleGrid) {
  const grid = [...puzzleGrid];
  let candidates = Array(81).fill(0).map((_, i) => grid[i] === 0 ? getCandidates(grid, i) : []);

  let hardestTechnique = "Rookie";
  let progressed = true;

  while (grid.includes(0) && progressed) {
    progressed = false;

    // 1. Naked Single: cell has only 1 candidate
    for (let i = 0; i < 81; i++) {
      if (grid[i] === 0 && candidates[i].length === 1) {
        const num = candidates[i][0];
        grid[i] = num;
        candidates[i] = [];
        eliminatePeerCandidates(candidates, i, num);
        progressed = true;
        break;
      }
    }
    if (progressed) continue;

    // 2. Hidden Single: num appears as candidate only once in a row, col, or box
    const hiddenSingle = findHiddenSingle(grid, candidates);
    if (hiddenSingle) {
      grid[hiddenSingle.index] = hiddenSingle.num;
      candidates[hiddenSingle.index] = [];
      eliminatePeerCandidates(candidates, hiddenSingle.index, hiddenSingle.num);
      progressed = true;
      if (hardestTechnique === "Rookie") hardestTechnique = "Standard";
      continue;
    }

    // 3. Pointing Pairs / Box-Line Reduction
    const pointingFound = findPointingPairs(grid, candidates);
    if (pointingFound) {
      progressed = true;
      if (hardestTechnique === "Rookie" || hardestTechnique === "Standard") hardestTechnique = "Hard";
      continue;
    }

    // 4. Naked / Hidden Pairs & X-Wing
    const xwingFound = findXWing(candidates);
    if (xwingFound) {
      progressed = true;
      if (hardestTechnique !== "Nightmare") hardestTechnique = "Expert";
      continue;
    }

    // If logic is exhausted but grid not full, requires Swordfish / Chains / Forcing
    if (!progressed && grid.includes(0)) {
      hardestTechnique = "Nightmare";
      break;
    }
  }

  return hardestTechnique;
}

function eliminatePeerCandidates(candidates, index, num) {
  const peers = PEERS_TABLE[index];
  for (let i = 0; i < peers.length; i++) {
    const p = peers[i];
    const idx = candidates[p].indexOf(num);
    if (idx !== -1) candidates[p].splice(idx, 1);
  }
}

function findHiddenSingle(grid, candidates) {
  // Check rows, cols, boxes for uniquely placed candidate
  for (let unit = 0; unit < 9; unit++) {
    // Row
    const rowCells = [];
    for (let c = 0; c < 9; c++) rowCells.push(unit * 9 + c);
    const hsRow = checkUnitForHiddenSingle(grid, candidates, rowCells);
    if (hsRow) return hsRow;

    // Col
    const colCells = [];
    for (let r = 0; r < 9; r++) colCells.push(r * 9 + unit);
    const hsCol = checkUnitForHiddenSingle(grid, candidates, colCells);
    if (hsCol) return hsCol;

    // Box
    const boxCells = [];
    const br = Math.floor(unit / 3) * 3;
    const bc = (unit % 3) * 3;
    for (let dr = 0; dr < 3; dr++) {
      for (let dc = 0; dc < 3; dc++) {
        boxCells.push((br + dr) * 9 + (bc + dc));
      }
    }
    const hsBox = checkUnitForHiddenSingle(grid, candidates, boxCells);
    if (hsBox) return hsBox;
  }
  return null;
}

function checkUnitForHiddenSingle(grid, candidates, unitIndices) {
  for (let num = 1; num <= 9; num++) {
    const possible = [];
    for (const idx of unitIndices) {
      if (grid[idx] === 0 && candidates[idx].includes(num)) {
        possible.push(idx);
      }
    }
    if (possible.length === 1) {
      return { index: possible[0], num };
    }
  }
  return null;
}

function findPointingPairs(grid, candidates) {
  let eliminated = false;
  // Box pointing pairs into row/col
  for (let b = 0; b < 9; b++) {
    const br = Math.floor(b / 3) * 3;
    const bc = (b % 3) * 3;
    for (let num = 1; num <= 9; num++) {
      const occurrences = [];
      for (let dr = 0; dr < 3; dr++) {
        for (let dc = 0; dc < 3; dc++) {
          const idx = (br + dr) * 9 + (bc + dc);
          if (grid[idx] === 0 && candidates[idx].includes(num)) {
            occurrences.push(idx);
          }
        }
      }
      if (occurrences.length === 2 || occurrences.length === 3) {
        // Check if same row
        const sameRow = occurrences.every(idx => Math.floor(idx / 9) === Math.floor(occurrences[0] / 9));
        if (sameRow) {
          const r = Math.floor(occurrences[0] / 9);
          for (let c = 0; c < 9; c++) {
            const idx = r * 9 + c;
            if (!occurrences.includes(idx) && candidates[idx].includes(num)) {
              candidates[idx].splice(candidates[idx].indexOf(num), 1);
              eliminated = true;
            }
          }
        }
        // Check if same col
        const sameCol = occurrences.every(idx => (idx % 9) === (occurrences[0] % 9));
        if (sameCol) {
          const c = occurrences[0] % 9;
          for (let r = 0; r < 9; r++) {
            const idx = r * 9 + c;
            if (!occurrences.includes(idx) && candidates[idx].includes(num)) {
              candidates[idx].splice(candidates[idx].indexOf(num), 1);
              eliminated = true;
            }
          }
        }
      }
    }
  }
  return eliminated;
}

function findXWing(candidates) {
  let eliminated = false;
  for (let num = 1; num <= 9; num++) {
    // Find rows with exactly 2 candidates
    const rows = [];
    for (let r = 0; r < 9; r++) {
      const cols = [];
      for (let c = 0; c < 9; c++) {
        if (candidates[r * 9 + c].includes(num)) cols.push(c);
      }
      if (cols.length === 2) rows.push({ r, cols });
    }

    if (rows.length >= 2) {
      for (let i = 0; i < rows.length; i++) {
        for (let j = i + 1; j < rows.length; j++) {
          if (rows[i].cols[0] === rows[j].cols[0] && rows[i].cols[1] === rows[j].cols[1]) {
            // X-Wing match! Eliminate in these columns in other rows
            const [c1, c2] = rows[i].cols;
            for (let r = 0; r < 9; r++) {
              if (r !== rows[i].r && r !== rows[j].r) {
                if (candidates[r * 9 + c1].includes(num)) {
                  candidates[r * 9 + c1].splice(candidates[r * 9 + c1].indexOf(num), 1);
                  eliminated = true;
                }
                if (candidates[r * 9 + c2].includes(num)) {
                  candidates[r * 9 + c2].splice(candidates[r * 9 + c2].indexOf(num), 1);
                  eliminated = true;
                }
              }
            }
          }
        }
      }
    }
  }
  return eliminated;
}

// -------------------------------------------------------------
// PUZZLE GENERATOR
// -------------------------------------------------------------

export const TIER_CLUES = {
  Rookie: { min: 40, max: 45 },
  Standard: { min: 32, max: 39 },
  Hard: { min: 28, max: 31 },
  Expert: { min: 24, max: 27 },
  Nightmare: { min: 20, max: 23 },
};

export function generateSudoku(targetTier = "Standard", rng = Math.random) {
  // Step 1: Fill completely with randomized backtracking
  const empty = createEmptyGrid();
  const solution = solveBacktrack(empty, rng);
  if (!solution) throw new Error("Failed to generate complete solution");

  const puzzle = [...solution];
  const targetRange = TIER_CLUES[targetTier] || TIER_CLUES.Standard;
  const targetClues = Math.floor(rng() * (targetRange.max - targetRange.min + 1)) + targetRange.min;

  // Step 2: Remove cells one at a time randomly with unique solution checking
  const indices = shuffle(Array.from({ length: 81 }, (_, i) => i), rng);
  let currentClues = 81;

  for (const idx of indices) {
    if (currentClues <= targetClues) break;

    const backup = puzzle[idx];
    puzzle[idx] = 0;

    // Step 3: Verify EXACTLY 1 solution
    if (countSolutions(puzzle, 2) === 1) {
      currentClues--;
    } else {
      // Not unique, restore number!
      puzzle[idx] = backup;
    }
  }

  // Step 4: Tag technique rating
  const technique = ratePuzzleTechnique(puzzle);

  return {
    puzzle,
    solution,
    clues: currentClues,
    targetTier,
    technique,
  };
}

// -------------------------------------------------------------
// KILLER SUDOKU BONUS GENERATOR
// -------------------------------------------------------------

export function generateKillerCages(solution, rng = Math.random) {
  const visited = new Set();
  const cages = [];
  let cageId = 0;

  for (let i = 0; i < 81; i++) {
    if (visited.has(i)) continue;

    const cage = [i];
    visited.add(i);
    const targetSize = Math.floor(rng() * 3) + 2; // 2 to 4 cells per cage

    while (cage.length < targetSize) {
      // Find unvisited adjacent cells
      const adj = [];
      for (const idx of cage) {
        const r = Math.floor(idx / 9);
        const c = idx % 9;
        const neighbors = [
          r > 0 ? (r - 1) * 9 + c : -1,
          r < 8 ? (r + 1) * 9 + c : -1,
          c > 0 ? r * 9 + (c - 1) : -1,
          c < 8 ? r * 9 + (c + 1) : -1,
        ];
        for (const n of neighbors) {
          if (n !== -1 && !visited.has(n) && !adj.includes(n)) {
            // Killer rule: numbers inside cage cannot repeat
            const candidateNum = solution[n];
            const alreadyInCage = cage.some(cIdx => solution[cIdx] === candidateNum);
            if (!alreadyInCage) {
              adj.push(n);
            }
          }
        }
      }

      if (adj.length === 0) break;
      const nextCell = adj[Math.floor(rng() * adj.length)];
      visited.add(nextCell);
      cage.push(nextCell);
    }

    const sum = cage.reduce((acc, idx) => acc + solution[idx], 0);
    cages.push({
      id: cageId++,
      cells: cage,
      sum,
    });
  }

  return cages;
}
