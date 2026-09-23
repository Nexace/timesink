import { initShell, toast } from "/shared/shell.js";
import { sfx } from "/shared/sound.js";
import { saveScore, getBestScore } from "/shared/scores.js";
import { createRuleEngine } from "/shared/rule-engine.js";
import { RESUME_RULES as ENGINE_RULES } from "./engine.js";

initShell({ crumb: "The Resume Game" });

// DOM Elements
const resumeInput = document.getElementById("resume-input");
const charStat = document.getElementById("char-stat");
const wordStat = document.getElementById("word-stat");
const vowelStat = document.getElementById("vowel-stat");
const activeTimersEl = document.getElementById("active-timers");
const ruleCountEl = document.getElementById("rule-count");
const atsPct = document.getElementById("ats-pct");
const atsPctBar = document.getElementById("ats-pct-bar");
const atsFill = document.getElementById("ats-fill");
const rulesList = document.getElementById("rules-list");
const hrFace = document.getElementById("hr-face");
const hrQuote = document.getElementById("hr-quote");

const failOverlay = document.getElementById("fail-overlay");
const failMsg = document.getElementById("fail-msg");
const winOverlay = document.getElementById("win-overlay");
const btnRestart = document.getElementById("btn-restart");
const btnWinRestart = document.getElementById("btn-win-restart");
const btnShareResult = document.getElementById("btn-share-result");
const btnSample = document.getElementById("btn-sample");
const btnClear = document.getElementById("btn-clear");

// State
let shredderInterval = null;
let briefcaseTimeoutTimer = null;
let briefcaseVanishInterval = null;
let briefcaseSecondsRemaining = 30;
let briefcaseTimerActive = false;
let hasWon = false;
let bestPassed = 0;

// 28 escalating rules live in engine.js (unit-tested); the two timed rules get their in-game labels here
const TIMED_LABELS = {
  r19: "RECRUITER SHREDDER ACTIVE: The HR bot deletes 1 character every 5 seconds! Keep resume ≥ 150 chars.",
  r26: "EMERGENCY BRIEFCASE: Must include the briefcase emoji 💼 (disappears if left unattended!).",
  r28: "Cryptographic Attestation: Include a 16-hex character cryptographic signature starting with 0x (e.g. 0xDEADBEEFCAFE1337)."
};
const RESUME_RULES = ENGINE_RULES.map((r) => (TIMED_LABELS[r.id] ? { ...r, label: TIMED_LABELS[r.id] } : r));

// Initialize Rule Engine
const engine = createRuleEngine(RESUME_RULES, {
  onFail: (reason) => {
    sfx.bad();
    updateHRState("REJECTED", reason);
    failMsg.textContent = reason;
    failOverlay.style.display = "flex";
    stopTimers();
  },
  onPassRule: (newCount) => {
    sfx.good();
    toast(`ATS Filter #${newCount - 1} Passed! New requirement unlocked.`);
  },
});

function init() {
  resumeInput.addEventListener("input", handleInput);
  resumeInput.addEventListener("keydown", (e) => {
    if (e.key.length === 1 || e.key === "Backspace" || e.key === "Enter") {
      sfx.type();
    }
  });

  btnRestart.addEventListener("click", () => {
    failOverlay.style.display = "none";
    resetGame();
  });

  btnWinRestart.addEventListener("click", () => {
    winOverlay.style.display = "none";
    resetGame();
  });

  btnSample.addEventListener("click", insertSample);
  btnClear.addEventListener("click", () => {
    resumeInput.value = "";
    handleInput();
  });

  btnShareResult.addEventListener("click", shareResult);

  resetGame();
}

function resetGame() {
  stopTimers();
  engine.reset();
  hasWon = false;
  failOverlay.style.display = "none";
  winOverlay.style.display = "none";
  resumeInput.value = "";
  briefcaseSecondsRemaining = 30;
  briefcaseTimerActive = false;
  handleInput();
}

function stopTimers() {
  if (shredderInterval) clearInterval(shredderInterval);
  shredderInterval = null;
  if (briefcaseTimeoutTimer) clearInterval(briefcaseTimeoutTimer);
  briefcaseTimeoutTimer = null;
  if (briefcaseVanishInterval) clearInterval(briefcaseVanishInterval);
  briefcaseVanishInterval = null;
  activeTimersEl.innerHTML = "";
}

// A starter skeleton that clears the first few screens — the rest is up to the candidate.
function insertSample() {
  if (resumeInput.value.trim() && !resumeInput.value.startsWith("Name:")) {
    resumeInput.value = `${resumeInput.value.trimEnd()}\n`;
  }
  const sample = `Name: Ada Lovelace
Experience: 8 years of experience
Key Buzzwords: Synergy, Scalability, Agile.
Contact: ada@lovelace.io | GitHub: github.com/adalovelace
`;
  resumeInput.value = resumeInput.value.startsWith("Name:") ? resumeInput.value : sample + resumeInput.value;
  resumeInput.focus();
  handleInput();
}

function handleInput() {
  const text = resumeInput.value;

  // Stats calculation
  const charLen = text.length;
  const words = (text.match(/\S+/g) || []).length;
  const vowels = (text.match(/[aeiou]/gi) || []).length;
  const consonants = (text.match(/[bcdfghjklmnpqrstvwxyz]/gi) || []).length;
  const cvRatio = vowels > 0 ? (consonants / vowels).toFixed(2) : "0.00";

  charStat.textContent = `CHARS: ${charLen}`;
  wordStat.textContent = `WORDS: ${words}`;
  vowelStat.textContent = `C/V RATIO: ${cvRatio}`;

  // Evaluate against rules
  const evalRes = engine.evaluate(text);

  if (evalRes.failed) return;

  const passed = evalRes.passedCount;
  const total = evalRes.total;
  const unlocked = evalRes.unlockedCount;

  const pct = Math.round((passed / total) * 100);
  ruleCountEl.textContent = `${passed} / ${total}`;
  if (passed > bestPassed && !evalRes.completedAll) {
    bestPassed = passed;
    saveScore("resume-game", passed, `${passed}/${total} ATS Rules`);
  }
  atsPct.textContent = `${pct}%`;
  atsPctBar.textContent = `${pct}%`;
  atsFill.style.width = `${pct}%`;

  if (pct === 100) {
    atsFill.classList.add("green");
  } else {
    atsFill.classList.remove("green");
  }

  // Render checklist
  renderRules(evalRes.results);

  // Manage timers for the advanced rules (not once you're hired)
  if (!hasWon) manageSpecialRules(unlocked, text);

  // Update HR Avatar dialogue & face
  updateHRState(getHRMood(passed, unlocked, evalRes.completedAll));

  // Check victory
  if (evalRes.completedAll && !hasWon) {
    hasWon = true;
    stopTimers();
    sfx.stamp();
    setTimeout(() => sfx.win(), 250);
    saveScore("resume-game", 28, "HIRED (28/28)");
    winOverlay.style.display = "flex";
  }
}

function getHRMood(passed, unlocked, won) {
  if (won) return "HIRED";
  if (unlocked >= 26) return "IMPRESSED";
  if (unlocked >= 19) return "PANICKED";
  if (unlocked >= 12) return "SUSPICIOUS";
  if (unlocked >= 6) return "INTRIGUED";
  return "BORED";
}

function updateHRState(mood, customMsg = "") {
  hrFace.className = "hr-face";

  switch (mood) {
    case "BORED":
      hrFace.textContent = "( - _ - )";
      hrQuote.textContent = customMsg || "Looking through hundreds of applicants today... convince me not to filter you.";
      break;
    case "INTRIGUED":
      hrFace.textContent = "( • _ • )";
      hrQuote.textContent = customMsg || "Wait, you actually listed quantifiable metrics and pre-1975 languages? Let me keep reading...";
      break;
    case "SUSPICIOUS":
      hrFace.textContent = "( ಠ _ ಠ )";
      hrQuote.textContent = customMsg || "Why is your character count strictly even, with a Mars relocation waiver?!";
      break;
    case "PANICKED":
      hrFace.textContent = "( ⊙ _ ⊙ )";
      hrQuote.textContent = customMsg || "SHREDDER ACTIVATED! I'm deleting your words and you're still typing faster than me!";
      break;
    case "IMPRESSED":
      hrFace.textContent = "( ◕ ‿ ◕ )";
      hrFace.classList.add("impressed");
      hrQuote.textContent = customMsg || "The algorithm is glowing! Keep that briefcase emoji in hand!";
      break;
    case "HIRED":
      hrFace.textContent = "\\ ( ^ ▽ ^ ) /";
      hrFace.classList.add("impressed");
      hrQuote.textContent = customMsg || "UNPRECEDENTED 100% MATCH! VP of Engineering wants you in the C-suite!";
      break;
    case "REJECTED":
      hrFace.textContent = "( × _ × )";
      hrFace.classList.add("rejected");
      hrQuote.textContent = customMsg || "Automated rejection letter dispatched.";
      break;
  }
}

function renderRules(results) {
  rulesList.innerHTML = "";

  results.forEach((r) => {
    const item = document.createElement("div");
    item.className = `rule-item ${r.passed ? "rule-item--pass" : "rule-item--fail"}`;

    const head = document.createElement("div");
    head.className = "rule-item__head";
    head.innerHTML = `<span>RULE #${r.order}</span><span>${r.passed ? "[✓] PASS" : "[×] PENDING"}</span>`;

    const body = document.createElement("div");
    body.textContent = r.label;

    item.appendChild(head);
    item.appendChild(body);

    if (!r.passed && r.note) {
      const note = document.createElement("div");
      note.className = "rule-item__note";
      note.textContent = `▶ ${r.note}`;
      item.appendChild(note);
    }

    rulesList.appendChild(item);
  });
}

function manageSpecialRules(unlocked, text) {
  // Rule 19: Shredder
  if (unlocked >= 19 && !shredderInterval) {
    startShredder();
  }

  // Rule 26: Briefcase
  if (unlocked >= 26) {
    if (!briefcaseVanishInterval) {
      startBriefcaseVanish();
    }
    if (!text.includes("💼")) {
      if (!briefcaseTimerActive) {
        startBriefcaseTimer();
      }
    } else {
      clearBriefcaseTimer();
    }
  }
}

function startShredder() {
  shredderInterval = setInterval(() => {
    const current = resumeInput.value;
    if (current.length > 0) {
      const start = resumeInput.selectionStart;
      const end = resumeInput.selectionEnd;
      // Shred the last whole character (never half an emoji); the briefcase is spared.
      const chars = Array.from(current);
      let idx = chars.length - 1;
      while (idx > 0 && chars[idx] === "💼") idx -= 1;
      chars.splice(idx, 1);
      resumeInput.value = chars.join("");
      if (document.activeElement === resumeInput) {
        resumeInput.setSelectionRange(Math.min(start, resumeInput.value.length), Math.min(end, resumeInput.value.length));
      }
      sfx.hover();
      toast("HR Shredder deleted 1 character!", "warn");
      handleInput();
    }
  }, 5000);
  updateTimersDisplay();
}

function startBriefcaseVanish() {
  briefcaseVanishInterval = setInterval(() => {
    const current = resumeInput.value;
    if (current.includes("💼")) {
      resumeInput.value = current.replace(/💼/g, "");
      toast("The ATS scanner vaporized your briefcase 💼! Replace it within 30s!", "warn");
      sfx.bad();
      handleInput();
    }
  }, 25000);
}

function startBriefcaseTimer() {
  briefcaseTimerActive = true;
  briefcaseSecondsRemaining = 30;
  updateTimersDisplay();

  briefcaseTimeoutTimer = setInterval(() => {
    briefcaseSecondsRemaining -= 1;
    updateTimersDisplay();

    if (briefcaseSecondsRemaining <= 0) {
      clearBriefcaseTimer();
      engine.triggerFail("Briefcase emoji 💼 was missing for 30 seconds! Auto-rejected.");
    }
  }, 1000);
}

function clearBriefcaseTimer() {
  if (briefcaseTimeoutTimer) clearInterval(briefcaseTimeoutTimer);
  briefcaseTimeoutTimer = null;
  briefcaseTimerActive = false;
  briefcaseSecondsRemaining = 30;
  updateTimersDisplay();
}

function updateTimersDisplay() {
  activeTimersEl.innerHTML = "";

  if (shredderInterval) {
    const alert = document.createElement("div");
    alert.className = "alert-timer";
    alert.textContent = "⚠ RECRUITER SHREDDER ACTIVE: -1 CHAR EVERY 5 SECONDS!";
    activeTimersEl.appendChild(alert);
  }

  if (briefcaseTimerActive) {
    const alert = document.createElement("div");
    alert.className = "alert-timer";
    alert.textContent = `🚨 EMERGENCY: 💼 MISSING! AUTO-REJECT IN ${briefcaseSecondsRemaining}S`;
    activeTimersEl.appendChild(alert);
  }
}

function shareResult() {
  const best = getBestScore("resume-game");
  const text = `SYS://TIMESINK.NET — THE RESUME GAME\nATS SCORE: 28/28 RULES COMPLETED\nSTATUS: HIRED // $500K TC EXTENDED\nCan you beat the recruiter bot? ${location.origin}/games/resume-game`;
  navigator.clipboard?.writeText(text).then(() => {
    toast("Scorecard copied to clipboard!");
  }).catch(() => {
    toast("Scorecard: 28/28 Rules Passed!");
  });
}

// Launch
init();
