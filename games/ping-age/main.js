import { initShell, escapeHtml, toast } from "/shared/shell.js";
import { sfx } from "/shared/sound.js";
import { saveScore } from "/shared/scores.js";
import {
  ERAS,
  QUESTIONS,
  REACTIONS,
  shuffleArray,
  calculateWinningEra,
  calculateHybridDna,
  evaluateBadges,
  formatDossierShareText,
} from "./data.js";

initShell({ crumb: "Ping Age" });

// Quiz State
let currentQ = 0;
const scores = { dialup: 0, myspace: 0, meme: 0, feed: 0, brainrot: 0 };
const chosenEraIndices = [];
let currentShuffledOptions = [];
let isAdvancing = false;

// DOM Elements
const qCategory = document.getElementById("q-category");
const qText = document.getElementById("q-text");
const optionsGrid = document.getElementById("options-grid");
const quizFill = document.getElementById("quiz-fill");
const quizProgressText = document.getElementById("quiz-progress-text");
const quizView = document.getElementById("quiz-view");

const reactionToast = document.getElementById("reaction-toast");
const reactionTag = document.getElementById("reaction-tag");
const reactionMsg = document.getElementById("reaction-msg");

const resultView = document.getElementById("result-view");
const eraContainer = document.getElementById("era-container");
const eraTitle = document.getElementById("era-title");
const eraDates = document.getElementById("era-dates");
const eraArchetype = document.getElementById("era-archetype");
const eraDesc = document.getElementById("era-desc");

const dossierRelic = document.getElementById("dossier-relic");
const dossierHabitat = document.getElementById("dossier-habitat");
const dossierTrauma = document.getElementById("dossier-trauma");
const dossierSuperpower = document.getElementById("dossier-superpower");

const dnaBars = document.getElementById("dna-bars");
const badgesSection = document.getElementById("badges-section");
const badgesRow = document.getElementById("badges-row");

const eraShare = document.getElementById("era-share");
const eraDominance = document.getElementById("era-dominance");
const btnShareEra = document.getElementById("btn-share-era");
const btnRetake = document.getElementById("btn-retake");

let latestShareText = "";

function playEraSound(eraId) {
  switch (eraId) {
    case "dialup":
      sfx.dialup?.() || sfx.click?.();
      break;
    case "myspace":
      sfx.good?.() || sfx.click?.();
      break;
    case "meme":
      sfx.coin?.() || sfx.click?.();
      break;
    case "feed":
      sfx.hover?.() || sfx.click?.();
      break;
    case "brainrot":
      sfx.laser?.() || sfx.bad?.() || sfx.click?.();
      break;
    default:
      sfx.click?.();
  }
}

function renderQuestion() {
  const q = QUESTIONS[currentQ];
  qCategory.textContent = q.category;
  qText.textContent = q.text;
  quizProgressText.textContent = `QUESTION ${currentQ + 1} / ${QUESTIONS.length}`;
  quizFill.style.width = `${Math.round(((currentQ + 1) / QUESTIONS.length) * 100)}%`;

  // Dynamically randomize option ordering each question
  currentShuffledOptions = shuffleArray(q.options);

  optionsGrid.innerHTML = currentShuffledOptions
    .map((opt, i) => {
      const letter = String.fromCharCode(65 + i);
      return `
      <button type="button" class="pa-opt-btn" data-idx="${i}" aria-label="Option ${letter}: ${escapeHtml(opt.label)}">
        <span class="opt-prefix">[${letter}]</span>
        <span class="opt-text">${escapeHtml(opt.label)}</span>
      </button>
    `;
    })
    .join("");

  optionsGrid.querySelectorAll(".pa-opt-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = Number(btn.dataset.idx);
      selectOption(idx, btn);
    });
  });
}

function selectOption(idx, btnElement) {
  if (isAdvancing) return;
  isAdvancing = true;

  if (btnElement) {
    btnElement.classList.add("is-selected");
  }

  const opt = currentShuffledOptions[idx];
  const primaryEra = opt.eras[0];

  // Play audio signature
  playEraSound(primaryEra);

  // Update scores
  for (const era of opt.eras) {
    scores[era] = (scores[era] || 0) + 1;
    const eraIdx = ERAS.findIndex((e) => e.id === era);
    if (eraIdx !== -1) chosenEraIndices.push(eraIdx);
  }

  // Display snappy reaction toast quip
  const reaction = REACTIONS[primaryEra];
  if (reaction && reactionToast && reactionTag && reactionMsg) {
    reactionTag.textContent = reaction.tag;
    reactionMsg.textContent = reaction.text;
    reactionToast.style.display = "flex";
  }

  setTimeout(() => {
    if (reactionToast) reactionToast.style.display = "none";
    isAdvancing = false;
    currentQ += 1;
    if (currentQ < QUESTIONS.length) {
      renderQuestion();
    } else {
      showResults();
    }
  }, 420);
}

function showResults() {
  quizView.style.display = "none";
  resultView.style.display = "block";

  // Calculate results via pure data helpers
  const winningEra = calculateWinningEra(scores);
  const dna = calculateHybridDna(scores, QUESTIONS.length);
  const badges = evaluateBadges(scores, chosenEraIndices);

  // Sound fanfare
  if (winningEra.id === "dialup") {
    sfx.dialup?.();
    setTimeout(() => sfx.win?.(), 650);
  } else {
    sfx.win?.();
  }

  // Record tallies in localStorage
  const talliesKey = "timesink:ping-age:tallies";
  let tallies = {};
  try {
    tallies = JSON.parse(localStorage.getItem(talliesKey) || "{}");
  } catch {
    tallies = {};
  }
  tallies[winningEra.id] = (tallies[winningEra.id] || 0) + 1;
  localStorage.setItem(talliesKey, JSON.stringify(tallies));

  const totalRuns = Object.values(tallies).reduce((a, b) => a + b, 0);
  const sharePct = Math.round(((tallies[winningEra.id] || 1) / Math.max(1, totalRuns)) * 100);

  // Update Container Class and Header
  eraContainer.className = `panel__body era-container ${winningEra.themeClass}`;
  eraTitle.textContent = winningEra.name;
  eraDates.textContent = winningEra.dates;
  eraArchetype.textContent = winningEra.archetype;
  eraDesc.textContent = winningEra.desc;

  // Archaeological Dossier Quadrants
  dossierRelic.textContent = winningEra.dossier.relic;
  dossierHabitat.textContent = winningEra.dossier.habitat;
  dossierTrauma.textContent = winningEra.dossier.trauma;
  dossierSuperpower.textContent = winningEra.dossier.superpower;

  // Hybrid Era DNA Distribution Matrix
  dnaBars.innerHTML = dna
    .map(
      (d) => `
      <div class="dna-row">
        <div class="dna-row__meta">
          <span class="dna-row__name" style="color: ${d.color}">
            ${d.name} <span class="dna-row__dates">(${d.dates})</span>
          </span>
          <span class="dna-row__pct">${d.pct}% (${d.count}/12)</span>
        </div>
        <div class="dna-track">
          <div class="dna-fill" style="width: ${d.pct}%; background: ${d.color}; box-shadow: 0 0 6px ${d.color}"></div>
        </div>
      </div>
    `,
    )
    .join("");

  // Special Recognition Badges
  if (badges.length > 0) {
    badgesSection.style.display = "block";
    badgesRow.innerHTML = badges
      .map(
        (b) => `
        <div class="badge-card ${b.badgeClass}">
          <span class="badge-icon">${b.icon}</span>
          <div class="badge-info">
            <span class="badge-title">${b.name}</span>
            <span class="badge-desc">${b.desc}</span>
          </div>
        </div>
      `,
      )
      .join("");
  } else {
    badgesSection.style.display = "none";
  }

  // Demographics
  eraShare.textContent = `${sharePct}% of players share this era (${tallies[winningEra.id]} / ${totalRuns})`;
  eraDominance.textContent = `VERIFIED ARCHAEOLOGICAL RECORD // ${winningEra.id.toUpperCase()}`;

  // Format Share Text
  latestShareText = formatDossierShareText({ winningEra, dna, badges });

  // Save score to timesink score ledger
  saveScore("ping-age", winningEra.name, `${winningEra.name} - ${winningEra.archetype}`);
}

// Keyboard shortcuts (A-E or 1-5)
window.addEventListener("keydown", (e) => {
  if (quizView.style.display === "none") return;
  const key = e.key.toUpperCase();
  let idx = -1;

  if (["A", "B", "C", "D", "E"].includes(key)) {
    idx = key.charCodeAt(0) - 65;
  } else if (["1", "2", "3", "4", "5"].includes(key)) {
    idx = parseInt(key, 10) - 1;
  }

  if (idx >= 0 && idx < currentShuffledOptions.length) {
    const btn = optionsGrid.querySelector(`[data-idx="${idx}"]`);
    selectOption(idx, btn);
  }
});

btnShareEra.addEventListener("click", () => {
  if (latestShareText) {
    navigator.clipboard?.writeText?.(latestShareText);
    toast({ title: "DOSSIER COPIED", body: "Archaeology Report copied to clipboard!", icon: "check" });
  }
});

btnRetake.addEventListener("click", () => {
  sfx.click?.();
  currentQ = 0;
  for (const key of Object.keys(scores)) scores[key] = 0;
  chosenEraIndices.length = 0;
  resultView.style.display = "none";
  quizView.style.display = "block";
  renderQuestion();
});

// Launch First Question
renderQuestion();
