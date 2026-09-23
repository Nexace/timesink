import { initShell } from "/shared/shell.js";
import { sfx, isSoundEnabled, setSoundEnabled } from "/shared/sound.js";
import { saveScore, getBestScore } from "/shared/scores.js";

initShell({ crumb: "Redlight" });

// DOM Elements
const modeSelect = document.getElementById("mode-select");
const treeSelect = document.getElementById("tree-select");
const stagePrompt = document.getElementById("stage-prompt");
const subPrompt = document.getElementById("sub-prompt");
const enduranceLine = document.getElementById("endurance-line");
const statAvg = document.getElementById("stat-avg");
const statBest = document.getElementById("stat-best");
const statStreak = document.getElementById("stat-streak");

// Lamps
const lamps = {
  prestageL: document.getElementById("lamp-prestage-l"),
  prestageR: document.getElementById("lamp-prestage-r"),
  stageL: document.getElementById("lamp-stage-l"),
  stageR: document.getElementById("lamp-stage-r"),
  a1L: document.getElementById("lamp-a1-l"),
  a1R: document.getElementById("lamp-a1-r"),
  a2L: document.getElementById("lamp-a2-l"),
  a2R: document.getElementById("lamp-a2-r"),
  a3L: document.getElementById("lamp-a3-l"),
  a3R: document.getElementById("lamp-a3-r"),
  greenL: document.getElementById("lamp-green-l"),
  greenR: document.getElementById("lamp-green-r"),
  redL: document.getElementById("lamp-red-l"),
  redR: document.getElementById("lamp-red-r"),
};

// Timeslip
const tsRt = document.getElementById("ts-rt");
const ts60 = document.getElementById("ts-60");
const ts330 = document.getElementById("ts-330");
const ts660 = document.getElementById("ts-660");
const ts1320 = document.getElementById("ts-1320");
const tsMph = document.getElementById("ts-mph");
const tsRank = document.getElementById("ts-rank");
const tsStatus = document.getElementById("ts-status");
const tsDate = document.getElementById("ts-date");

// State
let mode = "solo"; // "solo" | "versus" | "endurance"
let treeType = "pro"; // "pro" | "sportsman"
let state = "IDLE"; // "IDLE" | "PRE_STAGED" | "STAGED" | "COUNTDOWN" | "GREEN" | "FINISHED"

let p1PreStaged = false;
let p2PreStaged = false;
let p1Staged = false;
let p2Staged = false;

let stageTimeoutTimer = null;
let countdownTimers = [];
let greenTime = 0;
let p1LaunchTime = 0;
let p2LaunchTime = 0;
let p1Reaction = null;
let p2Reaction = null;

const recentRuns = [];
let enduranceStreak = 0;

// Initialize
function init() {
  if (tsDate) {
    tsDate.textContent = `DATE: ${new Date().toISOString().slice(0, 10)}`;
  }

  // Load best score
  const best = getBestScore("redlight");
  if (best && statBest) {
    statBest.textContent = `${(best.score / 1000).toFixed(3)} s`;
  }

  // Event Listeners
  modeSelect.addEventListener("change", (e) => {
    mode = e.target.value;
    enduranceLine.style.display = mode === "endurance" ? "flex" : "none";
    resetTree();
  });

  treeSelect.addEventListener("change", (e) => {
    treeType = e.target.value;
    resetTree();
  });

  window.addEventListener("keydown", handleKeyDown);

  // Touch support on tree panel
  const stripPanel = document.querySelector(".rl-strip-panel");
  if (stripPanel) {
    stripPanel.addEventListener("pointerdown", () => {
      if (mode === "versus") return;
      handleAction("p1");
    });
  }

  resetTree();
}

function resetTree() {
  // A completed endurance set starts fresh on the next pass.
  if (mode === "endurance" && enduranceStreak >= 10) {
    enduranceStreak = 0;
    if (statStreak) statStreak.textContent = `0 / 10`;
  }
  // Clear all pending timers
  if (stageTimeoutTimer) clearTimeout(stageTimeoutTimer);
  countdownTimers.forEach(t => clearTimeout(t));
  countdownTimers = [];

  // Reset all lamps
  Object.values(lamps).forEach(lamp => {
    if (lamp) lamp.classList.remove("lit");
  });

  state = "IDLE";
  p1PreStaged = false;
  p2PreStaged = false;
  p1Staged = false;
  p2Staged = false;
  greenTime = 0;
  p1LaunchTime = 0;
  p2LaunchTime = 0;
  p1Reaction = null;
  p2Reaction = null;

  if (mode === "versus") {
    stagePrompt.textContent = "P1: [A] | P2: [L] TO PRE-STAGE";
    subPrompt.textContent = "Both racers must stage before tree fires.";
  } else if (mode === "endurance") {
    stagePrompt.textContent = "PRESS [SPACE] TO PRE-STAGE";
    subPrompt.textContent = `Run 10 clean passes without foul! (Streak: ${enduranceStreak}/10)`;
  } else {
    stagePrompt.textContent = "PRESS [SPACE] TO PRE-STAGE";
    subPrompt.textContent = "7-second staging timeout in effect.";
  }
}

function handleKeyDown(e) {
  if (e.repeat) return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  // Don't hijack typing in the footer terminal or keyboard use of the mode/tree dropdowns.
  if (e.target instanceof Element && e.target.closest("input, textarea, select, [contenteditable]")) return;
  if (document.querySelector(".modal-backdrop")) return;

  if (mode === "versus") {
    if (e.code === "KeyA") {
      e.preventDefault();
      handleAction("p1");
    } else if (e.code === "KeyL") {
      e.preventDefault();
      handleAction("p2");
    }
  } else {
    if (e.code === "Space") {
      e.preventDefault();
      handleAction("p1");
    }
  }
}

function handleAction(player) {
  // 1. IDLE -> PRE-STAGE
  if (state === "IDLE") {
    if (mode === "versus") {
      if (player === "p1") {
        p1PreStaged = true;
        lamps.prestageL?.classList.add("lit");
        sfx.rev();
      } else if (player === "p2") {
        p2PreStaged = true;
        lamps.prestageR?.classList.add("lit");
        sfx.rev();
      }
      if (p1PreStaged && p2PreStaged) {
        state = "PRE_STAGED";
        startStageTimeout();
        stagePrompt.textContent = "BOTH PRE-STAGED // STAGE NOW!";
      } else {
        stagePrompt.textContent = p1PreStaged ? "P1 PRE-STAGED // WAITING FOR P2 [L]" : "P2 PRE-STAGED // WAITING FOR P1 [A]";
      }
    } else {
      p1PreStaged = true;
      p2PreStaged = true;
      lamps.prestageL?.classList.add("lit");
      lamps.prestageR?.classList.add("lit");
      sfx.rev();
      state = "PRE_STAGED";
      startStageTimeout();
      stagePrompt.textContent = "PRESS [SPACE] TO FULLY STAGE";
      subPrompt.textContent = "7-second timeout ticking...";
    }
    return;
  }

  // 2. PRE_STAGED -> STAGED
  if (state === "PRE_STAGED") {
    if (mode === "versus") {
      if (player === "p1" && !p1Staged) {
        p1Staged = true;
        lamps.stageL?.classList.add("lit");
        sfx.click();
      } else if (player === "p2" && !p2Staged) {
        p2Staged = true;
        lamps.stageR?.classList.add("lit");
        sfx.click();
      }
      if (p1Staged && p2Staged) {
        clearTimeout(stageTimeoutTimer);
        state = "STAGED";
        stagePrompt.textContent = "BOTH RACERS STAGED // WATCH TREE...";
        subPrompt.textContent = "Any early launch will RED LIGHT foul!";
        scheduleTreeSequence();
      }
    } else {
      p1Staged = true;
      p2Staged = true;
      lamps.stageL?.classList.add("lit");
      lamps.stageR?.classList.add("lit");
      sfx.click();
      clearTimeout(stageTimeoutTimer);
      state = "STAGED";
      stagePrompt.textContent = "STAGED // FOCUS ON TREE...";
      subPrompt.textContent = "Launching before GREEN is a RED LIGHT FOUL!";
      scheduleTreeSequence();
    }
    return;
  }

  // 3. Early Launch During STAGED or COUNTDOWN = RED LIGHT FOUL
  if (state === "STAGED" || state === "COUNTDOWN") {
    triggerRedLight(player, "EARLY LAUNCH (JUMPED START)");
    return;
  }

  // 4. GREEN Launch
  if (state === "GREEN") {
    const now = performance.now();
    const rt = (now - greenTime) / 1000;

    if (mode === "versus") {
      if (player === "p1" && p1Reaction === null) {
        p1Reaction = rt;
        p1LaunchTime = now;
        sfx.click();
      } else if (player === "p2" && p2Reaction === null) {
        p2Reaction = rt;
        p2LaunchTime = now;
        sfx.click();
      }
      if (p1Reaction !== null && p2Reaction !== null) {
        finishRun();
      } else {
        stagePrompt.textContent = `${player === "p1" ? "P1" : "P2"} LAUNCHED (${rt.toFixed(3)}s)! WAITING...`;
      }
    } else {
      p1Reaction = rt;
      finishRun();
    }
    return;
  }

  // 5. FINISHED -> Reset to run again
  if (state === "FINISHED") {
    resetTree();
  }
}

function startStageTimeout() {
  if (stageTimeoutTimer) clearTimeout(stageTimeoutTimer);
  stageTimeoutTimer = setTimeout(() => {
    triggerRedLight("timeout", "7-SECOND STAGING TIMEOUT EXPIRED");
  }, 7000);
}

function scheduleTreeSequence() {
  // Random delay between 1.5s and 4.0s
  const waitMs = 1500 + Math.random() * 2500;

  const tWait = setTimeout(() => {
    state = "COUNTDOWN";
    startCountdown();
  }, waitMs);
  countdownTimers.push(tWait);
}

function startCountdown() {
  if (treeType === "pro") {
    // Pro Tree: all 3 ambers at once, green 0.400s later
    lamps.a1L?.classList.add("lit");
    lamps.a1R?.classList.add("lit");
    lamps.a2L?.classList.add("lit");
    lamps.a2R?.classList.add("lit");
    lamps.a3L?.classList.add("lit");
    lamps.a3R?.classList.add("lit");
    sfx.treeAmber();

    const tGreen = setTimeout(() => {
      lamps.a1L?.classList.remove("lit");
      lamps.a1R?.classList.remove("lit");
      lamps.a2L?.classList.remove("lit");
      lamps.a2R?.classList.remove("lit");
      lamps.a3L?.classList.remove("lit");
      lamps.a3R?.classList.remove("lit");
      dropGreen();
    }, 400);
    countdownTimers.push(tGreen);

  } else {
    // Sportsman Tree: amber 1 (0.5s), amber 2 (0.5s), amber 3 (0.5s), green (0.5s)
    lamps.a1L?.classList.add("lit");
    lamps.a1R?.classList.add("lit");
    sfx.treeAmber();

    const t2 = setTimeout(() => {
      lamps.a1L?.classList.remove("lit");
      lamps.a1R?.classList.remove("lit");
      lamps.a2L?.classList.add("lit");
      lamps.a2R?.classList.add("lit");
      sfx.treeAmber();
    }, 500);
    countdownTimers.push(t2);

    const t3 = setTimeout(() => {
      lamps.a2L?.classList.remove("lit");
      lamps.a2R?.classList.remove("lit");
      lamps.a3L?.classList.add("lit");
      lamps.a3R?.classList.add("lit");
      sfx.treeAmber();
    }, 1000);
    countdownTimers.push(t3);

    const tGreen = setTimeout(() => {
      lamps.a3L?.classList.remove("lit");
      lamps.a3R?.classList.remove("lit");
      dropGreen();
    }, 1500);
    countdownTimers.push(tGreen);
  }
}

function dropGreen() {
  state = "GREEN";
  greenTime = performance.now();
  lamps.greenL?.classList.add("lit");
  lamps.greenR?.classList.add("lit");
  sfx.treeGreen();
  stagePrompt.textContent = "GO! GO! LAUNCH NOW!";
  subPrompt.textContent = mode === "versus" ? "P1: [A] | P2: [L]" : "PRESS [SPACE]";
  // A racer who never leaves the line is scored a 2.000s "no-show" so the round always ends.
  const tNoShow = setTimeout(() => {
    if (state !== "GREEN") return;
    if (mode === "versus") {
      if (p1Reaction === null) p1Reaction = 2;
      if (p2Reaction === null) p2Reaction = 2;
    } else {
      p1Reaction = 2;
    }
    finishRun();
  }, 2000);
  countdownTimers.push(tNoShow);
}

function triggerRedLight(fouledEntity, reason) {
  // Clear any staging timeout or tree sequence
  if (stageTimeoutTimer) clearTimeout(stageTimeoutTimer);
  stageTimeoutTimer = null;
  countdownTimers.forEach(t => clearTimeout(t));
  countdownTimers = [];

  // Turn off any active amber bulbs
  lamps.a1L?.classList.remove("lit");
  lamps.a1R?.classList.remove("lit");
  lamps.a2L?.classList.remove("lit");
  lamps.a2R?.classList.remove("lit");
  lamps.a3L?.classList.remove("lit");
  lamps.a3R?.classList.remove("lit");

  state = "FINISHED";
  sfx.buzzer();

  if (fouledEntity === "p1") {
    lamps.redL?.classList.add("lit");
  } else if (fouledEntity === "p2") {
    lamps.redR?.classList.add("lit");
  } else {
    lamps.redL?.classList.add("lit");
    lamps.redR?.classList.add("lit");
  }

  stagePrompt.textContent = "RED LIGHT FOUL!";
  subPrompt.textContent = `${reason}. Press ${mode === "versus" ? "[A] or [L]" : "SPACE"} to try again.`;
  if (mode === "versus" && (fouledEntity === "p1" || fouledEntity === "p2")) {
    // In a head-to-head, the first racer to red-light hands the win to the other lane.
    stagePrompt.textContent = `${fouledEntity === "p1" ? "P1" : "P2"} RED-LIT — ${fouledEntity === "p1" ? "P2" : "P1"} WINS!`;
  }

  // Timeslip update
  tsRt.textContent = "-.000";
  ts60.textContent = "---";
  ts330.textContent = "---";
  ts660.textContent = "---";
  ts1320.textContent = "---";
  tsMph.textContent = "0.00 MPH";
  tsRank.textContent = "RANK: FOUL";
  tsStatus.textContent = `DISQUALIFIED (${reason})`;

  if (mode === "endurance") {
    enduranceStreak = 0;
    if (statStreak) statStreak.textContent = `0 / 10`;
  }
}

function finishRun() {
  state = "FINISHED";
  sfx.win();

  let rt = p1Reaction;
  let winnerText = "";

  if (countdownTimers.length) {
    countdownTimers.forEach((t) => clearTimeout(t));
    countdownTimers = [];
  }

  if (mode === "versus") {
    if (p1Reaction === p2Reaction) {
      winnerText = "DEAD HEAT — A PERFECT TIE!";
      rt = p1Reaction;
    } else if (p1Reaction < p2Reaction) {
      const margin = ((p2Reaction - p1Reaction) * 1000).toFixed(0);
      winnerText = `P1 WINS BY ${margin} MS!`;
      rt = p1Reaction;
    } else {
      const margin = ((p1Reaction - p2Reaction) * 1000).toFixed(0);
      winnerText = `P2 WINS BY ${margin} MS!`;
      rt = p2Reaction;
    }
    stagePrompt.textContent = winnerText;
    subPrompt.textContent = `P1: ${p1Reaction.toFixed(3)}s | P2: ${p2Reaction.toFixed(3)}s. Press [A] or [L] to reset.`;
  } else {
    stagePrompt.textContent = `REACTION TIME: ${rt.toFixed(3)} SECONDS`;
    subPrompt.textContent = "Press [SPACE] to line up again.";
  }

  // Classification
  let rank = "";
  if (rt < 0.060) rank = "TOP FUEL (GODLIKE)";
  else if (rt < 0.120) rank = "PRO STOCK (EXCELLENT)";
  else if (rt < 0.250) rank = "SPORTSMAN (GOOD)";
  else if (rt < 0.450) rank = "STREET (AVERAGE)";
  else rank = "FLAGMAN (TOO SLOW)";

  // Quarter-mile physics simulation
  const et60 = (0.820 + rt * 0.15).toFixed(3);
  const et330 = (2.110 + rt * 0.4).toFixed(3);
  const et660 = (2.980 + rt * 0.7).toFixed(3);
  const et1320 = (3.850 + rt).toFixed(3);
  const trapMph = (332.5 - Math.min(rt * 20, 40)).toFixed(2);

  tsRt.textContent = `.${(rt * 1000).toFixed(0).padStart(3, "0")}`;
  ts60.textContent = et60;
  ts330.textContent = et330;
  ts660.textContent = et660;
  ts1320.textContent = et1320;
  tsMph.textContent = `${trapMph} MPH`;
  tsRank.textContent = `RANK: ${rank}`;
  tsStatus.textContent = mode === "versus" ? winnerText : "CLEAN PASS - SANCTION APPROVED";

  // Rolling Average (a no-show isn't a real reaction, so it isn't logged)
  if (mode !== "versus" && rt < 2) {
    recentRuns.push(rt);
    if (recentRuns.length > 10) recentRuns.shift();
    const sum = recentRuns.reduce((a, b) => a + b, 0);
    const avg = sum / recentRuns.length;
    if (statAvg) statAvg.textContent = `${avg.toFixed(3)} s`;

    // Save best score
    const ms = Math.round(rt * 1000);
    const res = saveScore("redlight", ms, `${(rt).toFixed(3)}s`, { lowerIsBetter: true });
    if (res.isNewBest && statBest) {
      statBest.textContent = `${rt.toFixed(3)} s`;
    }
  }

  // Endurance Mode
  if (mode === "endurance" && rt >= 2) {
    enduranceStreak = 0;
    if (statStreak) statStreak.textContent = `0 / 10`;
    subPrompt.textContent = "No launch detected — endurance streak reset. Press [SPACE] to line up again.";
  } else if (mode === "endurance") {
    enduranceStreak += 1;
    if (statStreak) statStreak.textContent = `${enduranceStreak} / 10`;
    if (enduranceStreak >= 10) {
      stagePrompt.textContent = "ENDURANCE CHAMPION!";
      subPrompt.textContent = "10 CLEAN PASSES IN A ROW! PHENOMENAL FOCUS!";
      sfx.win();
    }
  }
}

// Start
init();
