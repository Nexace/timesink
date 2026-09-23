/**
 * GRIDLOCK — Retro Terminal Sudoku UI & Game Coordinator
 * Features:
 * - Off-thread puzzle generation via Web Worker (guaranteed 1 unique solution)
 * - Technique-tagged difficulty (Rookie, Standard, Hard, Expert, Nightmare)
 * - Pencil mode (1-9 small candidates), auto-candidates real-time calculation
 * - Peer highlight, same-number highlight, instant conflict glow
 * - 3-stage hint assist, Check validator, 3-strikes mistake mode
 * - Daily Puzzle with shareable emoji/ASCII card, Endless, and Killer Sudoku mode
 * - Soft oscillator audio beeps, conflict buzz, ascending arpeggio on victory
 */

import { initShell, escapeHtml, toast } from "/shared/shell.js";
import { PEERS_TABLE, getCandidates, generateSudoku, generateKillerCages } from "./solver.js";
import { playTone } from "/shared/audio.js";
import { saveGameScore, loadGameScore } from "/shared/save.js";

initShell({ crumb: "Gridlock" });

// DOM Elements
const gridEl = document.getElementById("sudoku-grid");
const loadingEl = document.getElementById("grid-loading");
const selectTier = document.getElementById("select-tier");
const btnNewPuzzle = document.getElementById("btn-new-puzzle");
const timerEl = document.getElementById("hud-timer");
const tierNameEl = document.getElementById("hud-tier-name");
const techniqueEl = document.getElementById("hud-technique");
const mistakesEl = document.getElementById("hud-mistakes");
const hintBoxEl = document.getElementById("hint-text");
const hintCountEl = document.getElementById("hint-count");
const btnPencil = document.getElementById("btn-pencil");
const pencilStatusEl = document.getElementById("pencil-status");
const btnAutoCands = document.getElementById("btn-auto-candidates");
const btnHint = document.getElementById("btn-hint");
const btnCheck = document.getElementById("btn-check");
const btnUndo = document.getElementById("btn-undo");
const btnRedo = document.getElementById("btn-redo");
const modalVictory = document.getElementById("modal-victory");
const btnShare = document.getElementById("btn-share-result");
const btnNextPuzzle = document.getElementById("btn-next-puzzle");

// Game State
let currentTier = "Standard";
let currentMode = "endless"; // "endless", "daily", "killer"
let givenGrid = Array(81).fill(0);
let currentGrid = Array(81).fill(0);
let solutionGrid = Array(81).fill(0);
let candidatesGrid = Array(81).fill(0).map(() => []);
let killerCages = null;

let selectedIdx = null;
let pencilMode = false;
let autoCandidates = false;
let hintTargetIdx = null;
let hintStage = 0; // 0=none, 1=named, 2=highlighted
let hintCurrentInfo = null;
let hintsUsed = 0;
let mistakesCount = 0;
let isAssisted = false;
let isSolved = false;

// History Stack for Undo/Redo
let undoStack = [];
let redoStack = [];

// Timer
let timerSeconds = 0;
let timerInterval = null;

// Audio Synthesizer Helpers
function playKeypressBeep() {
  playTone(820, 0.04, "square", 0.15);
}

function playConflictBuzz() {
  playTone(110, 0.18, "sawtooth", 0.35);
}

function playEraseBeep() {
  playTone(340, 0.05, "sine", 0.15);
}

function playVictoryArpeggio() {
  const notes = [261.6, 329.6, 392.0, 523.3, 659.3, 783.9, 1046.5];
  notes.forEach((n, i) => {
    setTimeout(() => {
      playTone(n, 0.18, "triangle", 0.3);
    }, i * 110);
  });
}

// -------------------------------------------------------------
// WEB WORKER & GENERATION
// -------------------------------------------------------------

let worker = null;
let requestId = 0; // only the newest request's puzzle may land on the board
try {
  worker = new Worker("/games/gridlock/worker.js", { type: "module" });
  worker.onmessage = (e) => {
    if (e.data.reqId !== undefined && e.data.reqId !== requestId) return; // stale (mode/tier changed since)
    if (e.data.status === "ok") {
      onPuzzleGenerated(e.data);
    } else {
      console.warn("Worker error, falling back:", e.data.error);
      generateLocalPuzzle();
    }
  };
  // A worker that fails to load would otherwise leave the board on "generating" forever
  worker.onerror = (err) => {
    console.warn("Web Worker failed, generating locally:", err.message || err);
    worker = null;
    generateLocalPuzzle();
  };
} catch (err) {
  console.warn("Web Worker unavailable, generating locally:", err);
}

function dailySeed() {
  const today = new Date().toISOString().slice(0, 10);
  return today.split("-").reduce((acc, part) => acc * 31 + parseInt(part, 10), 0);
}

function requestNewPuzzle() {
  requestId++;
  modalVictory.hidden = true;
  loadingEl.hidden = false;
  isSolved = false;
  selectedIdx = null;
  hintTargetIdx = null;
  hintStage = 0;
  hintCurrentInfo = null;
  hintsUsed = 0;
  mistakesCount = 0;
  isAssisted = false;
  hintCountEl.textContent = "3";
  mistakesEl.textContent = "0 / 3";
  undoStack = [];
  redoStack = [];

  const seed = currentMode === "daily" ? dailySeed() : undefined;

  if (worker) {
    worker.postMessage({
      action: "generate",
      tier: currentTier,
      mode: currentMode,
      seed,
      reqId: requestId,
    });
  } else {
    const id = requestId;
    setTimeout(() => {
      if (id === requestId) generateLocalPuzzle();
    }, 50);
  }
}

function generateLocalPuzzle() {
  let rng = Math.random;
  if (currentMode === "daily") {
    let s = dailySeed();
    rng = () => {
      s = (s * 9301 + 49297) % 233280;
      return s / 233280;
    };
  }

  const generated = generateSudoku(currentTier, rng);
  let cages = null;
  if (currentMode === "killer") {
    cages = generateKillerCages(generated.solution, rng);
  }
  onPuzzleGenerated({ ...generated, killerCages: cages });
}

function onPuzzleGenerated(data) {
  loadingEl.hidden = true;
  givenGrid = [...data.puzzle];
  currentGrid = [...data.puzzle];
  solutionGrid = [...data.solution];
  killerCages = data.killerCages;

  tierNameEl.textContent = data.targetTier.toUpperCase();
  techniqueEl.textContent = (data.technique || data.targetTier).toUpperCase();

  // Reset candidates
  candidatesGrid = Array(81).fill(0).map(() => []);
  if (autoCandidates) {
    recalcAutoCandidates();
  }

  startTimer();
  renderBoard();
  hintBoxEl.textContent = `Generated unique ${data.targetTier} puzzle (${data.clues} clues). Logic rating: ${data.technique || data.targetTier}.`;
}

// -------------------------------------------------------------
// TIMER & SCORING
// -------------------------------------------------------------

function startTimer() {
  if (timerInterval) clearInterval(timerInterval);
  timerSeconds = 0;
  updateTimerDisplay();
  timerInterval = setInterval(() => {
    if (!isSolved) {
      timerSeconds++;
      updateTimerDisplay();
    }
  }, 1000);
}

function updateTimerDisplay() {
  const m = Math.floor(timerSeconds / 60).toString().padStart(2, "0");
  const s = (timerSeconds % 60).toString().padStart(2, "0");
  timerEl.textContent = `${m}:${s}`;
}

function calculateScore() {
  const basePoints = {
    Rookie: 1000,
    Standard: 1800,
    Hard: 2800,
    Expert: 4000,
    Nightmare: 6000,
  }[currentTier] || 1800;

  // Time multiplier: faster gives higher score
  const timeSec = Math.max(30, timerSeconds);
  const timeFactor = Math.max(0.4, 1.6 - (timeSec / 900));

  let finalScore = Math.floor(basePoints * timeFactor - (hintsUsed * 150) - (mistakesCount * 50));
  if (hintsUsed === 0 && mistakesCount === 0) {
    finalScore = Math.floor(finalScore * 1.5); // 1.5x Perfect Run bonus!
  }

  return Math.max(100, finalScore);
}

// -------------------------------------------------------------
// BOARD RENDERING & INTERACTION
// -------------------------------------------------------------

function renderBoard() {
  gridEl.innerHTML = "";

  // Identify Conflicts
  const conflicts = findConflicts(currentGrid);

  // Selected cell number
  const selectedNum = selectedIdx !== null ? currentGrid[selectedIdx] : 0;
  const peerIndices = selectedIdx !== null ? PEERS_TABLE[selectedIdx] : [];

  for (let i = 0; i < 81; i++) {
    const cell = document.createElement("div");
    cell.className = "grid-cell";
    cell.dataset.index = i;

    const val = currentGrid[i];
    const isGiven = givenGrid[i] !== 0;

    if (isGiven) {
      cell.classList.add("given");
      cell.textContent = val;
    } else if (val !== 0) {
      cell.classList.add("player-entry");
      cell.textContent = val;
    } else {
      // Empty cell: render candidate marks if any
      const cands = candidatesGrid[i];
      if (cands && cands.length > 0) {
        const cGrid = document.createElement("div");
        cGrid.className = "candidates-grid";
        for (let d = 1; d <= 9; d++) {
          const dEl = document.createElement("span");
          dEl.className = "cand-digit";
          dEl.textContent = cands.includes(d) ? d : "";
          cGrid.appendChild(dEl);
        }
        cell.appendChild(cGrid);
      }
    }

    // Highlighting
    if (i === selectedIdx) {
      cell.classList.add("selected");
    } else if (selectedIdx !== null && peerIndices.includes(i)) {
      cell.classList.add("peer-highlight");
    }

    if (selectedNum !== 0 && val === selectedNum) {
      cell.classList.add("same-number");
    }

    if (conflicts.has(i)) {
      cell.classList.add("conflict");
    }

    if (i === hintTargetIdx) {
      cell.classList.add("hint-target");
    }

    // Killer Sudoku Cage Boundaries & Sum Labels
    if (killerCages) {
      applyKillerCageStyles(cell, i, killerCages);
    }

    cell.addEventListener("click", () => selectCell(i));
    gridEl.appendChild(cell);
  }
}

function applyKillerCageStyles(cell, i, cages) {
  const r = Math.floor(i / 9);
  const c = i % 9;

  for (const cage of cages) {
    if (cage.cells.includes(i)) {
      // Top boundary
      if (r === 0 || !cage.cells.includes((r - 1) * 9 + c)) cell.classList.add("killer-top");
      // Bottom boundary
      if (r === 8 || !cage.cells.includes((r + 1) * 9 + c)) cell.classList.add("killer-bottom");
      // Left boundary
      if (c === 0 || !cage.cells.includes(r * 9 + (c - 1))) cell.classList.add("killer-left");
      // Right boundary
      if (c === 8 || !cage.cells.includes(r * 9 + (c + 1))) cell.classList.add("killer-right");

      // Small sum badge in top-left cell of the cage
      const minIdx = Math.min(...cage.cells);
      if (i === minIdx) {
        const badge = document.createElement("span");
        badge.className = "cage-sum-badge";
        badge.textContent = cage.sum;
        cell.appendChild(badge);
      }
      break;
    }
  }
}

function selectCell(index) {
  selectedIdx = index;
  renderBoard();
}

function findConflicts(grid) {
  const conflicts = new Set();

  for (let i = 0; i < 81; i++) {
    const val = grid[i];
    if (val === 0) continue;

    const peers = PEERS_TABLE[i];
    for (let p = 0; p < peers.length; p++) {
      const peerIdx = peers[p];
      if (grid[peerIdx] === val) {
        conflicts.add(i);
        conflicts.add(peerIdx);
      }
    }
  }

  return conflicts;
}

// -------------------------------------------------------------
// DIGIT INPUT & PENCIL MARKS
// -------------------------------------------------------------

function enterDigit(num) {
  if (selectedIdx === null || isSolved) return;
  if (givenGrid[selectedIdx] !== 0) {
    toast({ title: "LOCKED CLUE", body: "Initial terminal clues cannot be edited." });
    return;
  }

  const prevVal = currentGrid[selectedIdx];
  const prevCands = [...candidatesGrid[selectedIdx]];

  if (pencilMode) {
    if (prevVal !== 0) return; // pencil marks only go in empty cells
    // Toggle pencil candidate
    const idx = candidatesGrid[selectedIdx].indexOf(num);
    if (idx === -1) {
      candidatesGrid[selectedIdx].push(num);
      candidatesGrid[selectedIdx].sort((a, b) => a - b);
    } else {
      candidatesGrid[selectedIdx].splice(idx, 1);
    }
    pushHistory({ type: "pencil", index: selectedIdx, prevCands, newCands: [...candidatesGrid[selectedIdx]] });
    playKeypressBeep();
  } else {
    // Normal digit placement
    if (prevVal === num) {
      // Clearing digit
      currentGrid[selectedIdx] = 0;
      pushHistory({ type: "value", index: selectedIdx, prevVal, newVal: 0 });
      playEraseBeep();
    } else {
      currentGrid[selectedIdx] = num;
      pushHistory({ type: "value", index: selectedIdx, prevVal, newVal: num });

      // Check for conflicts
      const conflicts = findConflicts(currentGrid);
      if (conflicts.has(selectedIdx)) {
        playConflictBuzz();
        mistakesCount++;
        mistakesEl.textContent = `${mistakesCount} / 3`;
        if (mistakesCount >= 3) {
          toast({ title: "3 STRIKES", body: "Too many conflicts detected!" });
        }
      } else {
        playKeypressBeep();
      }

      // Eliminate candidate from peers
      eliminateCandidateFromPeers(selectedIdx, num);
      if (autoCandidates) {
        recalcAutoCandidates();
      }
    }

    checkWinCondition();
  }

  renderBoard();
}

function clearCell() {
  if (selectedIdx === null || isSolved) return;
  if (givenGrid[selectedIdx] !== 0) return;

  const prevVal = currentGrid[selectedIdx];
  const prevCands = [...candidatesGrid[selectedIdx]];

  currentGrid[selectedIdx] = 0;
  candidatesGrid[selectedIdx] = [];
  pushHistory({ type: "clear", index: selectedIdx, prevVal, prevCands });

  playEraseBeep();
  if (autoCandidates) {
    recalcAutoCandidates();
  }
  renderBoard();
}

function eliminateCandidateFromPeers(index, num) {
  const peers = PEERS_TABLE[index];
  for (let i = 0; i < peers.length; i++) {
    const p = peers[i];
    const cIdx = candidatesGrid[p].indexOf(num);
    if (cIdx !== -1) {
      candidatesGrid[p].splice(cIdx, 1);
    }
  }
}

function recalcAutoCandidates() {
  for (let i = 0; i < 81; i++) {
    if (currentGrid[i] === 0) {
      candidatesGrid[i] = getCandidates(currentGrid, i);
    } else {
      candidatesGrid[i] = [];
    }
  }
}

// -------------------------------------------------------------
// KEYBOARD & KEYPAD WIRING
// -------------------------------------------------------------

window.addEventListener("keydown", (e) => {
  // Typing in the footer terminal / the tier select must not edit the grid
  if (e.target instanceof Element && e.target.closest("input, textarea, select, [contenteditable]")) return;
  if (!modalVictory.hidden) return;
  const mod = e.ctrlKey || e.metaKey;
  if (mod) {
    const k = e.key.toLowerCase();
    if (k === "z" && !e.shiftKey) {
      e.preventDefault();
      undo();
    } else if (k === "y" || (k === "z" && e.shiftKey)) {
      e.preventDefault();
      redo();
    }
    return;
  }
  if (e.altKey) return;
  if (e.key >= "1" && e.key <= "9") {
    enterDigit(parseInt(e.key, 10));
  } else if (e.key === "Backspace" || e.key === "Delete" || e.key === "0") {
    e.preventDefault();
    clearCell();
  } else if (e.key === "p" || e.key === "P") {
    togglePencilMode();
  } else if (e.key.startsWith("Arrow")) {
    e.preventDefault(); // move the cursor, not the page
    if (e.key === "ArrowLeft") moveSelection(0, -1);
    else if (e.key === "ArrowRight") moveSelection(0, 1);
    else if (e.key === "ArrowUp") moveSelection(-1, 0);
    else if (e.key === "ArrowDown") moveSelection(1, 0);
  }
});

function moveSelection(dr, dc) {
  if (selectedIdx === null) {
    selectedIdx = 0;
  } else {
    const r = Math.floor(selectedIdx / 9);
    const c = selectedIdx % 9;
    const nextR = (r + dr + 9) % 9;
    const nextC = (c + dc + 9) % 9;
    selectedIdx = nextR * 9 + nextC;
  }
  renderBoard();
}

// On-Screen Keypad
document.querySelectorAll(".key-btn[data-digit]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const digit = parseInt(btn.dataset.digit, 10);
    enterDigit(digit);
  });
});

document.getElementById("key-delete")?.addEventListener("click", clearCell);

function togglePencilMode() {
  pencilMode = !pencilMode;
  pencilStatusEl.textContent = pencilMode ? "[ON]" : "[OFF]";
  btnPencil.classList.toggle("active", pencilMode);
  toast({ title: "PENCIL MODE", body: pencilMode ? "Entering candidates" : "Entering solution numbers" });
}

btnPencil?.addEventListener("click", togglePencilMode);

btnAutoCands?.addEventListener("click", () => {
  autoCandidates = !autoCandidates;
  btnAutoCands.classList.toggle("active", autoCandidates);
  if (autoCandidates) {
    recalcAutoCandidates();
    toast({ title: "AUTO-CANDIDATES", body: "Candidates updated dynamically." });
  } else {
    candidatesGrid = Array(81).fill(0).map(() => []);
  }
  renderBoard();
});

// -------------------------------------------------------------
// UNDO & REDO
// -------------------------------------------------------------

function pushHistory(action) {
  undoStack.push(action);
  redoStack = []; // clear redo
}

function undo() {
  if (undoStack.length === 0 || isSolved) return;
  const action = undoStack.pop();
  redoStack.push(action);

  if (action.type === "value") {
    currentGrid[action.index] = action.prevVal;
  } else if (action.type === "pencil") {
    candidatesGrid[action.index] = action.prevCands;
  } else if (action.type === "clear") {
    currentGrid[action.index] = action.prevVal;
    candidatesGrid[action.index] = action.prevCands;
  }

  if (autoCandidates) recalcAutoCandidates();
  playKeypressBeep();
  renderBoard();
}

function redo() {
  if (redoStack.length === 0 || isSolved) return;
  const action = redoStack.pop();
  undoStack.push(action);

  if (action.type === "value") {
    currentGrid[action.index] = action.newVal;
  } else if (action.type === "pencil") {
    candidatesGrid[action.index] = action.newCands;
  } else if (action.type === "clear") {
    currentGrid[action.index] = 0;
    candidatesGrid[action.index] = [];
  }

  if (autoCandidates) recalcAutoCandidates();
  playKeypressBeep();
  renderBoard();
  checkWinCondition();
}

btnUndo?.addEventListener("click", undo);
btnRedo?.addEventListener("click", redo);

// -------------------------------------------------------------
// ASSISTS: 3-STAGE HINT & CHECK
// -------------------------------------------------------------

btnHint?.addEventListener("click", () => {
  if (isSolved) return;
  if (hintsUsed >= 3 && hintStage === 0) {
    toast({ title: "HINT LIMIT", body: "Maximum 3 hints used per puzzle!" });
    return;
  }

  // Find a cell in solution that is empty or incorrect
  if (hintStage === 0) {
    const candidates = [];
    for (let i = 0; i < 81; i++) {
      if (currentGrid[i] !== solutionGrid[i]) {
        candidates.push(i);
      }
    }

    if (candidates.length === 0) {
      toast({ title: "GRID COMPLETE", body: "No errors detected on board." });
      return;
    }

    // Pick first logical discrepancy
    hintTargetIdx = candidates[0];
    const correctVal = solutionGrid[hintTargetIdx];
    const r = Math.floor(hintTargetIdx / 9) + 1;
    const c = (hintTargetIdx % 9) + 1;
    const box = Math.floor((r - 1) / 3) * 3 + Math.floor((c - 1) / 3) + 1;

    hintsUsed++;
    hintCountEl.textContent = `${3 - hintsUsed}`;
    timerSeconds += 30; // 30s penalty
    updateTimerDisplay();

    hintStage = 1;
    hintCurrentInfo = { idx: hintTargetIdx, r, c, box, val: correctVal };
    hintBoxEl.textContent = `[HINT 1/3]: Deductive technique available in Box ${box}, Row ${r}, Col ${c}. (Press Hint again to target cell).`;
    playTone(550, 0.12, "triangle", 0.3);
  } else if (hintStage === 1) {
    // Stage 2: Highlight the cell
    hintStage = 2;
    hintTargetIdx = hintCurrentInfo.idx;
    selectedIdx = hintCurrentInfo.idx;
    hintBoxEl.textContent = `[HINT 2/3]: Cell at R${hintCurrentInfo.r}C${hintCurrentInfo.c} targeted. (Press Hint again to reveal digit).`;
    playTone(700, 0.12, "triangle", 0.3);
  } else if (hintStage === 2) {
    // Stage 3: Fill the digit (recorded in history so Undo stays coherent)
    hintStage = 0;
    const idx = hintCurrentInfo.idx;
    pushHistory({ type: "value", index: idx, prevVal: currentGrid[idx], newVal: hintCurrentInfo.val });
    currentGrid[idx] = hintCurrentInfo.val;
    candidatesGrid[idx] = [];
    eliminateCandidateFromPeers(idx, hintCurrentInfo.val);
    if (autoCandidates) recalcAutoCandidates();
    hintBoxEl.textContent = `[HINT 3/3]: Filled ${hintCurrentInfo.val} at R${hintCurrentInfo.r}C${hintCurrentInfo.c}.`;
    hintTargetIdx = null;
    playKeypressBeep();
    checkWinCondition();
  }

  renderBoard();
});

btnCheck?.addEventListener("click", () => {
  if (isSolved) return;
  isAssisted = true;
  let wrongCount = 0;
  for (let i = 0; i < 81; i++) {
    if (currentGrid[i] !== 0 && currentGrid[i] !== solutionGrid[i]) {
      wrongCount++;
    }
  }

  if (wrongCount === 0) {
    toast({ title: "VALIDATION PASSED", body: "All placed numbers match the solution!" });
    hintBoxEl.textContent = "> CHECK: All current entries match the unique terminal solution.";
  } else {
    toast({ title: "DISCREPANCIES FOUND", body: `${wrongCount} cell(s) contain invalid entries.` });
    hintBoxEl.textContent = `> CHECK: ${wrongCount} incorrect digits detected on grid.`;
    playConflictBuzz();
  }
});

// -------------------------------------------------------------
// WIN CONDITION & SHARE
// -------------------------------------------------------------

function checkWinCondition() {
  if (isSolved) return;
  for (let i = 0; i < 81; i++) {
    if (currentGrid[i] !== solutionGrid[i]) return;
  }

  // Solved!
  isSolved = true;
  if (timerInterval) clearInterval(timerInterval);

  playVictoryArpeggio();

  const finalScore = calculateScore();
  const timeFormatted = timerEl.textContent;

  saveGameScore("gridlock", finalScore, `${timeFormatted} (${currentTier})`, {
    tier: currentTier,
    mode: currentMode,
    time: timerSeconds,
    perfect: hintsUsed === 0 && mistakesCount === 0,
    assisted: isAssisted,
  });
  recordTierTime(currentTier, timerSeconds);

  // Update records display
  updateRecordsPanel();

  // Show victory modal
  document.getElementById("vic-time").textContent = timeFormatted;
  document.getElementById("vic-tier").textContent = `${currentTier.toUpperCase()}${isAssisted ? " (ASSISTED)" : ""}`;
  document.getElementById("vic-hints").textContent = `${hintsUsed} / 3`;
  document.getElementById("vic-mistakes").textContent = mistakesCount;
  document.getElementById("vic-score").textContent = `${finalScore.toLocaleString()} PTS`;
  modalVictory.hidden = false;
}

btnShare?.addEventListener("click", () => {
  const dateStr = new Date().toISOString().slice(0, 10);
  // 3x3 card: one square per box — red for each mistake, yellow for each hint, green otherwise
  const squares = Array(9).fill("🟩");
  let k = 0;
  for (let m = 0; m < Math.min(9, mistakesCount); m++) squares[k++] = "🟥";
  for (let h = 0; h < hintsUsed && k < 9; h++) squares[k++] = "🟨";
  const card = [0, 3, 6].map((r) => squares.slice(r, r + 3).join("")).join("\n");
  const shareText = `SYS://TIMESINK.NET — GRIDLOCK SUDOKU${currentMode === "daily" ? ` // DAILY ${dateStr}` : ""}\n` +
    `Mode: ${currentMode.toUpperCase()} | Tier: ${currentTier}\n` +
    `Time: ${timerEl.textContent} | Score: ${calculateScore()} PTS\n` +
    `Hints: ${hintsUsed}/3 | Mistakes: ${mistakesCount}\n` +
    card;

  const fallback = () => toast({ title: "SHARE", body: shareText });
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(shareText).then(() => {
      toast({ title: "COPIED TO CLIPBOARD", body: "Share your terminal solve!" });
    }).catch(fallback);
  } else {
    fallback();
  }
});

btnNextPuzzle?.addEventListener("click", () => {
  modalVictory.hidden = true;
  requestNewPuzzle();
});

// -------------------------------------------------------------
// MODES & TIERS
// -------------------------------------------------------------

document.querySelectorAll(".mode-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".mode-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    currentMode = btn.dataset.mode;
    requestNewPuzzle();
  });
});

selectTier?.addEventListener("change", (e) => {
  currentTier = e.target.value;
  requestNewPuzzle();
});

btnNewPuzzle?.addEventListener("click", requestNewPuzzle);

// Fastest solve per tier (the arcade score table only keeps one overall best)
const PB_KEY = "timesink:gridlock:pb";

function readTierTimes() {
  try {
    const raw = JSON.parse(localStorage.getItem(PB_KEY) || "{}");
    return raw && typeof raw === "object" ? raw : {};
  } catch {
    return {};
  }
}

function recordTierTime(tier, seconds) {
  const times = readTierTimes();
  if (!(Number(times[tier]) > 0) || seconds < times[tier]) {
    times[tier] = seconds;
    try {
      localStorage.setItem(PB_KEY, JSON.stringify(times));
    } catch {}
  }
}

function updateRecordsPanel() {
  const times = readTierTimes();
  // Seed from the legacy single-best record so an existing PB isn't lost
  const rec = loadGameScore("gridlock");
  if (rec && rec.tier && Number(rec.time) > 0 && !(Number(times[rec.tier]) > 0)) times[rec.tier] = Number(rec.time);
  for (const tier of ["Rookie", "Standard", "Hard", "Expert", "Nightmare"]) {
    const el = document.getElementById(`pb-${tier}`);
    const t = Number(times[tier]);
    if (el) el.textContent = t > 0 ? `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}` : "--:--";
  }
}

// Initialize
if (selectTier) selectTier.value = currentTier; // the dropdown must show the tier actually being played
updateRecordsPanel();
requestNewPuzzle();

