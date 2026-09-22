import { initShell, escapeHtml } from "/shared/shell.js";
import { sfx } from "/shared/sound.js";
import { saveScore } from "/shared/scores.js";
import {
  CHECKPOINTS,
  CATEGORIES,
  COMPARE_PRESETS,
  formatMetricExponent,
  formatScientificNotation,
  calculateScaleRatio,
} from "./data.js";

initShell({ crumb: "Scale Jump" });

export { CHECKPOINTS, CATEGORIES, COMPARE_PRESETS };

// DOM Elements
const scaleSlider = document.getElementById("scale-slider");
const expValEl = document.getElementById("exp-val");
const metricLabelEl = document.getElementById("metric-label");
const notationLabelEl = document.getElementById("notation-label");
const ordersTravelledEl = document.getElementById("orders-travelled");
const hudScaleTextEl = document.getElementById("hud-scale-text");
const objectsStage = document.getElementById("objects-stage");
const objectDetails = document.getElementById("object-details");
const btnToggleCompare = document.getElementById("btn-toggle-compare");
const infoPanel = document.getElementById("info-panel");
const comparePanel = document.getElementById("compare-panel");
const comparePresetsContainer = document.getElementById("compare-presets");
const cmpASelect = document.getElementById("cmp-a");
const cmpBSelect = document.getElementById("cmp-b");
const compareStage = document.getElementById("compare-stage");
const compareBars = document.getElementById("compare-bars");
const compareRatioEl = document.getElementById("compare-ratio");
const compareNoteEl = document.getElementById("compare-note");
const viewport = document.getElementById("viewport");
const catNav = document.getElementById("cat-nav");

// Step buttons
const btnStepDown10 = document.getElementById("btn-step-down-10");
const btnStepDown1 = document.getElementById("btn-step-down-1");
const btnStepUp1 = document.getElementById("btn-step-up-1");
const btnStepUp10 = document.getElementById("btn-step-up-10");

let currentLog = 0; // 10^0 = 1 metre (Human scale)
let compareMode = false;
const visitedLogs = new Set();
let lastTickOrder = Math.round(currentLog);

function getHudRulerLabel(log) {
  const rounded = Math.round(log);
  if (rounded === 0) return "1 METRE";
  if (rounded === 1) return "10 METRES";
  if (rounded === 2) return "100 METRES";
  if (rounded === 3) return "1 KILOMETRE";
  if (rounded === 4) return "10 KILOMETRES";
  if (rounded === 5) return "100 KILOMETRES";
  if (rounded === 6) return "1,000 KILOMETRES";
  if (rounded === 7) return "10,000 KILOMETRES";
  if (rounded === 8) return "100,000 KILOMETRES";
  if (rounded === 9) return "1 MILLION KILOMETRES";
  if (rounded === 11) return "1 ASTRONOMICAL UNIT (AU)";
  if (rounded === 16) return "1 LIGHT-YEAR";
  if (rounded === 18) return "100 LIGHT-YEARS";
  if (rounded === 21) return "100,000 LIGHT-YEARS (Milky Way)";
  if (rounded === 27) return "93 BILLION LIGHT-YEARS";

  if (rounded === -1) return "10 CENTIMETRES (10 cm)";
  if (rounded === -2) return "1 CENTIMETRE (1 cm)";
  if (rounded === -3) return "1 MILLIMETRE (1 mm)";
  if (rounded === -4) return "100 MICROMETRES (100 µm)";
  if (rounded === -5) return "10 MICROMETRES (10 µm)";
  if (rounded === -6) return "1 MICROMETRE (1 µm)";
  if (rounded === -7) return "100 NANOMETRES (100 nm)";
  if (rounded === -8) return "10 NANOMETRES (10 nm)";
  if (rounded === -9) return "1 NANOMETRE (1 nm)";
  if (rounded === -10) return "1 ÅNGSTRÖM (0.1 nm)";
  if (rounded === -12) return "1 PICOMETRE (1 pm)";
  if (rounded === -15) return "1 FEMTOMETRE (1 fm)";
  if (rounded === -18) return "1 ATTOMETRE (1 am)";
  if (rounded === -35) return "1.6 × 10⁻³⁵ m (Planck Length)";

  return formatMetricExponent(log);
}

function updateMilestones() {
  const rounded = Math.round(currentLog);
  visitedLogs.add(rounded);
  ordersTravelledEl.textContent = `${visitedLogs.size} / 63`;

  // Milestone unlocked checks
  const milestones = {
    quantum: currentLog <= -20,
    subatomic: currentLog > -20 && currentLog <= -14,
    atomic: currentLog > -14 && currentLog <= -8,
    cellular: currentLog > -8 && currentLog <= -4,
    human: currentLog > -4 && currentLog <= 3,
    planetary: currentLog > 3 && currentLog <= 8,
    stellar: currentLog > 8 && currentLog <= 14,
    galactic: currentLog > 14 && currentLog <= 21,
    cosmic: currentLog >= 22,
  };

  for (const [key, unlocked] of Object.entries(milestones)) {
    const el = document.querySelector(`[data-badge="${key}"]`);
    if (el) {
      if (unlocked && !el.classList.contains("is-unlocked")) {
        sfx.good();
        el.classList.add("is-unlocked");
      }
    }
  }

  saveScore("scale-jump", visitedLogs.size, `${visitedLogs.size}/63 Orders Travelled`);
}

function updateCategoryNav() {
  const btns = catNav.querySelectorAll(".sj-cat-btn");
  let activeCat = "human";
  for (const cat of CATEGORIES) {
    if (Math.abs(currentLog - cat.log) <= 3) {
      activeCat = cat.id;
      break;
    }
  }

  btns.forEach((btn) => {
    const btnLog = Number(btn.getAttribute("data-log"));
    if (Math.abs(btnLog - currentLog) <= 3) {
      btn.classList.add("is-active");
    } else {
      btn.classList.remove("is-active");
    }
  });
}

function renderViewport() {
  const rounded = Math.round(currentLog);
  expValEl.textContent = formatMetricExponent(currentLog);
  hudScaleTextEl.textContent = getHudRulerLabel(currentLog);

  // Find the closest checkpoint for the main telemetry
  let closest = CHECKPOINTS[0];
  let minDiff = Infinity;
  for (const item of CHECKPOINTS) {
    const exactLog = Math.log10(item.exactM);
    const diff = Math.abs(exactLog - currentLog);
    if (diff < minDiff) {
      minDiff = diff;
      closest = item;
    }
  }

  metricLabelEl.innerHTML = `${escapeHtml(closest.metric)} &bull; <span class="sj-dim">${escapeHtml(closest.imperial)}</span>`;
  notationLabelEl.textContent = formatScientificNotation(closest.exactM);

  // Render objects within +/- 0.75 orders of magnitude to keep focus clean
  const visible = CHECKPOINTS.filter((item) => Math.abs(Math.log10(item.exactM) - currentLog) <= 0.75);

  // Sort visible items: non-dominant first, dominant last (on top)
  visible.sort((a, b) => {
    if (a === closest) return 1;
    if (b === closest) return -1;
    return Math.abs(Math.log10(b.exactM) - currentLog) - Math.abs(Math.log10(a.exactM) - currentLog);
  });

  objectsStage.innerHTML = visible
    .map((item) => {
      const exactLog = Math.log10(item.exactM);
      const delta = exactLog - currentLog;
      const scale = Math.pow(10, delta);
      const isDominant = (item === closest);
      
      // Normalized scale clamped for visualization
      const visualScale = isDominant ? 1.0 : Math.min(1.4, Math.max(0.5, scale));
      const opacity = isDominant ? 1.0 : Math.max(0.2, 0.7 - Math.abs(delta));
      const color = isDominant ? "#00f0ff" : "#ffd166";

      // Spread secondary items to left/right so center focal object is always clear
      let offsetX = 0;
      if (!isDominant) {
        offsetX = delta > 0 ? 140 : -140;
      }

      // Invert badge scale so badge font size remains perfectly fixed and readable
      const badgeCounterScale = (1 / visualScale).toFixed(3);

      return `
      <div class="sj-obj ${isDominant ? "is-dominant" : "is-secondary"}" 
           style="transform: translate(${offsetX}px, 0) scale(${visualScale.toFixed(3)}); opacity: ${opacity.toFixed(2)}; z-index: ${isDominant ? 10 : 2};">
        <div class="sj-obj__svg-wrap">
          <svg width="150" height="150" viewBox="0 0 120 120">
            ${item.draw(color)}
          </svg>
        </div>
        ${isDominant ? `
          <div class="sj-obj__badge" style="border-color: ${color}; transform: scale(${badgeCounterScale}); transform-origin: top center;">
            <span class="sj-obj__name" style="color: ${color}">${escapeHtml(item.name)}</span>
            <span class="sj-obj__size">${escapeHtml(item.metric)} &bull; ${escapeHtml(item.imperial)}</span>
          </div>
        ` : `
          <div class="sj-obj__mini-badge" style="transform: scale(${badgeCounterScale}); transform-origin: top center;">
            <span style="color: ${color}">${escapeHtml(item.name)}</span>
          </div>
        `}
      </div>
    `;
    })
    .join("");

  // Detailed object inspection card
  const categoryMeta = CATEGORIES.find((cat) => cat.id === closest.category) || CATEGORIES[4];
  const ratioToHuman = closest.exactM / 1.75;
  let humanComparisonText = "";

  if (Math.abs(ratioToHuman - 1.0) < 0.1) {
    humanComparisonText = "Standard human baseline scale (1.75 m).";
  } else if (ratioToHuman > 1.0) {
    if (ratioToHuman < 1000) {
      humanComparisonText = `Approx. <b>${ratioToHuman.toFixed(1)}×</b> human scale.`;
    } else if (ratioToHuman < 1e6) {
      humanComparisonText = `Approx. <b>${(ratioToHuman / 1e3).toFixed(1)} Thousand×</b> larger than a human.`;
    } else if (ratioToHuman < 1e9) {
      humanComparisonText = `Approx. <b>${(ratioToHuman / 1e6).toFixed(2)} Million×</b> larger than a human.`;
    } else if (ratioToHuman < 1e12) {
      humanComparisonText = `Approx. <b>${(ratioToHuman / 1e9).toFixed(2)} Billion×</b> larger than a human.`;
    } else if (ratioToHuman < 1e15) {
      humanComparisonText = `Approx. <b>${(ratioToHuman / 1e12).toFixed(2)} Trillion×</b> larger than a human.`;
    } else {
      humanComparisonText = `Approx. <b>${ratioToHuman.toExponential(2)}×</b> larger than a human.`;
    }
  } else {
    const frac = 1.75 / closest.exactM;
    if (frac < 1000) {
      humanComparisonText = `Approx. <b>1 / ${frac.toFixed(1)}</b> of human scale.`;
    } else if (frac < 1e6) {
      humanComparisonText = `Approx. <b>1 / ${(frac / 1e3).toFixed(1)} Thousandth</b> of human scale.`;
    } else if (frac < 1e9) {
      humanComparisonText = `Approx. <b>1 / ${(frac / 1e6).toFixed(2)} Millionth</b> of human scale.`;
    } else if (frac < 1e12) {
      humanComparisonText = `Approx. <b>1 / ${(frac / 1e9).toFixed(2)} Billionth</b> of human scale.`;
    } else if (frac < 1e15) {
      humanComparisonText = `Approx. <b>1 / ${(frac / 1e12).toFixed(2)} Trillionth</b> of human scale.`;
    } else {
      humanComparisonText = `Approx. <b>1 / ${frac.toExponential(2)}</b> of human scale.`;
    }
  }

  objectDetails.innerHTML = `
    <div class="obj-card">
      <div class="obj-card__header">
        <span class="obj-card__category" style="background: ${categoryMeta.color}22; color: ${categoryMeta.color}; border: 1px solid ${categoryMeta.color}">
          ${escapeHtml(categoryMeta.label)}
        </span>
        <span class="obj-card__order">10<sup>${closest.log}</sup> m</span>
      </div>

      <div class="obj-card__title">${escapeHtml(closest.name)}</div>
      
      <div class="obj-card__metrics">
        <div class="obj-metric-row">
          <span class="label">METRIC:</span>
          <b>${escapeHtml(closest.metric)}</b>
        </div>
        <div class="obj-metric-row">
          <span class="label">IMPERIAL:</span>
          <b>${escapeHtml(closest.imperial)}</b>
        </div>
        <div class="obj-metric-row">
          <span class="label">SCIENTIFIC:</span>
          <b>${formatScientificNotation(closest.exactM)}</b>
        </div>
        <div class="obj-metric-row">
          <span class="label">HUMAN SCALE:</span>
          <span>${humanComparisonText}</span>
        </div>
      </div>

      <div class="obj-card__fact">
        <div class="fact-title">PHYSICAL DESCRIPTION</div>
        <p>${escapeHtml(closest.fact)}</p>
      </div>

      <div class="obj-card__analogy">
        <div class="analogy-badge">MIND-BENDING SCALE ANALOGY</div>
        <p>${escapeHtml(closest.analogy)}</p>
      </div>
    </div>
  `;

  updateMilestones();
  updateCategoryNav();
}

function renderCompare() {
  const itemA = CHECKPOINTS.find((c) => c.id === cmpASelect.value) || CHECKPOINTS.find((c) => c.id === "human") || CHECKPOINTS[0];
  const itemB = CHECKPOINTS.find((c) => c.id === cmpBSelect.value) || CHECKPOINTS.find((c) => c.id === "earth") || CHECKPOINTS[1];

  const { logDiff, ratio, bigger, smaller } = calculateScaleRatio(itemA, itemB);

  compareStage.innerHTML = `
    <div class="compare-slot">
      <div class="compare-svg-wrap">
        <svg width="100" height="100" viewBox="0 0 120 120">${itemA.draw("#00f0ff")}</svg>
      </div>
      <b class="compare-name">${escapeHtml(itemA.name)}</b>
      <span class="compare-meta">${escapeHtml(itemA.metric)}</span>
      <span class="compare-order">10<sup>${itemA.log}</sup> m</span>
    </div>

    <div class="compare-vs">
      <span>VS</span>
      <span class="compare-log-diff">Δ 10<sup>${logDiff}</sup></span>
    </div>

    <div class="compare-slot">
      <div class="compare-svg-wrap">
        <svg width="100" height="100" viewBox="0 0 120 120">${itemB.draw("#ffd166")}</svg>
      </div>
      <b class="compare-name">${escapeHtml(itemB.name)}</b>
      <span class="compare-meta">${escapeHtml(itemB.metric)}</span>
      <span class="compare-order">10<sup>${itemB.log}</sup> m</span>
    </div>
  `;

  // Visual relative bar
  const maxBarLog = Math.max(Math.abs(itemA.log), Math.abs(itemB.log), 1);
  const percentA = Math.max(5, Math.min(100, (50 + (itemA.log / 35) * 45))).toFixed(1);
  const percentB = Math.max(5, Math.min(100, (50 + (itemB.log / 35) * 45))).toFixed(1);

  compareBars.innerHTML = `
    <div class="cbar-row">
      <span class="cbar-label">${escapeHtml(itemA.name)}</span>
      <div class="cbar-track"><div class="cbar-fill" style="width: ${percentA}%; background: #00f0ff;"></div></div>
    </div>
    <div class="cbar-row">
      <span class="cbar-label">${escapeHtml(itemB.name)}</span>
      <div class="cbar-track"><div class="cbar-fill" style="width: ${percentB}%; background: #ffd166;"></div></div>
    </div>
  `;

  let verbalMultiplier = "";
  if (logDiff === 0) {
    verbalMultiplier = "roughly the SAME order of magnitude";
  } else if (ratio < 1000) {
    verbalMultiplier = `~${ratio.toFixed(0)} times larger`;
  } else if (ratio < 1e6) {
    verbalMultiplier = `~${(ratio / 1e3).toFixed(1)} Thousand times larger`;
  } else if (ratio < 1e9) {
    verbalMultiplier = `~${(ratio / 1e6).toFixed(1)} Million times larger`;
  } else if (ratio < 1e12) {
    verbalMultiplier = `~${(ratio / 1e9).toFixed(1)} Billion times larger`;
  } else if (ratio < 1e15) {
    verbalMultiplier = `~${(ratio / 1e12).toFixed(1)} Trillion times larger`;
  } else if (ratio < 1e18) {
    verbalMultiplier = `~${(ratio / 1e15).toFixed(1)} Quadrillion times larger`;
  } else {
    verbalMultiplier = `~10<sup>${logDiff}</sup> (${ratio.toExponential(1)}) times larger`;
  }

  compareRatioEl.innerHTML = `&gt; <b>${escapeHtml(bigger.name)}</b> is ${verbalMultiplier} than <b>${escapeHtml(smaller.name)}</b>.`;

  // Look for matching preset note if available
  const matchingPreset = COMPARE_PRESETS.find(
    (p) => (p.a === itemA.id && p.b === itemB.id) || (p.a === itemB.id && p.b === itemA.id)
  );
  if (matchingPreset) {
    compareNoteEl.innerHTML = `&bull; <i>${escapeHtml(matchingPreset.note)}</i>`;
    compareNoteEl.style.display = "block";
  } else {
    compareNoteEl.style.display = "none";
  }
}

function initCompareOptions() {
  const options = CHECKPOINTS.map(
    (c) => `<option value="${c.id}">${escapeHtml(c.name)} (10^${c.log}m)</option>`
  ).join("");
  cmpASelect.innerHTML = options;
  cmpBSelect.innerHTML = options;
  cmpASelect.value = "human";
  cmpBSelect.value = "earth";

  // Render presets
  comparePresetsContainer.innerHTML = COMPARE_PRESETS.map((preset) => {
    return `<button type="button" class="btn-preset" data-a="${preset.a}" data-b="${preset.b}">${escapeHtml(preset.name)}</button>`;
  }).join("");

  comparePresetsContainer.querySelectorAll(".btn-preset").forEach((btn) => {
    btn.addEventListener("click", () => {
      sfx.click();
      cmpASelect.value = btn.getAttribute("data-a");
      cmpBSelect.value = btn.getAttribute("data-b");
      renderCompare();
    });
  });
}

function setZoom(log) {
  currentLog = Math.max(-35, Math.min(27, log));
  scaleSlider.value = String(currentLog);
  const curInt = Math.round(currentLog);
  if (curInt !== lastTickOrder) {
    lastTickOrder = curInt;
    sfx.hover();
  }
  renderViewport();
}

// Event Listeners
scaleSlider.addEventListener("input", () => {
  setZoom(Number(scaleSlider.value));
});

viewport.addEventListener(
  "wheel",
  (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.35 : -0.35;
    setZoom(currentLog + delta);
  },
  { passive: false }
);

// Keyboard controls
window.addEventListener("keydown", (e) => {
  if (document.activeElement && ["INPUT", "SELECT", "TEXTAREA"].includes(document.activeElement.tagName)) {
    return;
  }
  if (e.key === "ArrowLeft") {
    setZoom(currentLog - 0.2);
  } else if (e.key === "ArrowRight") {
    setZoom(currentLog + 0.2);
  } else if (e.key === "PageDown") {
    setZoom(currentLog - 2.0);
  } else if (e.key === "PageUp") {
    setZoom(currentLog + 2.0);
  } else if (e.key === "Home") {
    setZoom(-35);
  } else if (e.key === "End") {
    setZoom(27);
  }
});

// Category jump buttons
catNav.querySelectorAll(".sj-cat-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    sfx.click();
    const targetLog = Number(btn.getAttribute("data-log"));
    setZoom(targetLog);
  });
});

// Tick jumps
document.querySelectorAll(".sj-ticks [data-jump]").forEach((tick) => {
  tick.addEventListener("click", () => {
    sfx.click();
    const targetLog = Number(tick.getAttribute("data-jump"));
    setZoom(targetLog);
  });
});

// Step buttons
btnStepDown10.addEventListener("click", () => { sfx.click(); setZoom(currentLog - 10); });
btnStepDown1.addEventListener("click", () => { sfx.click(); setZoom(currentLog - 1); });
btnStepUp1.addEventListener("click", () => { sfx.click(); setZoom(currentLog + 1); });
btnStepUp10.addEventListener("click", () => { sfx.click(); setZoom(currentLog + 10); });

btnToggleCompare.addEventListener("click", () => {
  compareMode = !compareMode;
  sfx.click();
  btnToggleCompare.textContent = compareMode ? "CLOSE COMPARE" : "COMPARE MODE";
  comparePanel.style.display = compareMode ? "block" : "none";
  infoPanel.style.display = compareMode ? "none" : "block";
  if (compareMode) renderCompare();
});

cmpASelect.addEventListener("change", () => { sfx.click(); renderCompare(); });
cmpBSelect.addEventListener("change", () => { sfx.click(); renderCompare(); });

initCompareOptions();
renderViewport();
