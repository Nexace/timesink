/**
 * TERAFORM RUN — 1-Bit Endless Runner
 * Multi-box collision, variable jump, fast-fall, roguelite perks,
 * 6 biomes, combo near-miss, night mode, coins & shop.
 */

import { initShell } from "/shared/shell.js";
import { createGameLoop, createInputManager, clamp, lerp } from "/shared/engine.js";
import { playTone, playLaser, playExplosion } from "/shared/audio.js";
import { saveGameScore, loadGameScore } from "/shared/save.js";
import { createParticles, starfield, vignette, scanlines, glow, shade, rgba, tinted } from "/shared/gfx.js";
import { buildRunnerArt, BIOME_ART } from "./art.js";

initShell({ crumb: "Teraform Run" });

// ─── Constants ───
const CANVAS_W = 1440;
const CANVAS_H = 700;
const GROUND_Y = CANVAS_H - 80;
const GRAVITY = 2800;
const JUMP_VEL = -850;
const SHORT_HOP_MULT = 0.55;
const FAST_FALL_MULT = 3;
const BASE_SPEED = 300;
const SPEED_RAMP = 3; // px/s per second (base → max in ~5 minutes)
const MAX_SPEED = 1200;
const NEAR_MISS_PX = 18;
const PERK_INTERVAL = 500;
const NIGHT_INTERVAL = 700;

// ─── Biomes ───
const BIOMES = [
  { name: "DESERT",  groundCol: "#c2a66b", skyCol: "#fafafa", obstCol: "#222",    cloudCol: "#ddd" },
  { name: "TUNDRA",  groundCol: "#b8d8e8", skyCol: "#eef4f8", obstCol: "#3a5a7a", cloudCol: "#d0e8f0" },
  { name: "VOLCANIC",groundCol: "#5a1a1a", skyCol: "#1a0a0a", obstCol: "#ff4422", cloudCol: "#3a2020" },
  { name: "JUNGLE",  groundCol: "#2a6a2a", skyCol: "#e8f5e0", obstCol: "#1a3a1a", cloudCol: "#aadaaa" },
  { name: "CYBER",   groundCol: "#0a0a2e", skyCol: "#080818", obstCol: "#00ffcc", cloudCol: "#112244" },
  { name: "VOID",    groundCol: "#0a0a0a", skyCol: "#020204", obstCol: "#888",    cloudCol: "#111" },
];

const NIGHT_SKY = "#0a0a2e";
const NIGHT_FG = "#7fdbca";

// ─── Perk Definitions ───
const PERKS = [
  { id: "ironLegs",    icon: "🦿", name: "IRON LEGS",    desc: "+15% jump height" },
  { id: "phaseShift",  icon: "👻", name: "PHASE SHIFT",  desc: "2s invincible after near-miss" },
  { id: "magnetBoots", icon: "🧲", name: "MAGNET BOOTS", desc: "Pulls nearby coins to you" },
  { id: "doubleCoins", icon: "🪙", name: "DOUBLE COINS", desc: "Coins worth 2x" },
  { id: "slowMo",      icon: "⏳", name: "SLOW-MO",      desc: "0.7x speed for 10s" },
  { id: "featherfall", icon: "🪶", name: "FEATHERFALL",  desc: "-30% gravity" },
  { id: "turbo",       icon: "⚡", name: "TURBO",        desc: "+50 base speed, more pts" },
  { id: "thickSkin",   icon: "🛡️", name: "THICK SKIN",   desc: "Survive one hit (1 use)" },
];

// ─── Multi-Box Collision ───
function boxesOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function multiBoxCollision(dinoBoxes, obstacleBoxes) {
  for (const db of dinoBoxes) {
    for (const ob of obstacleBoxes) {
      if (boxesOverlap(db, ob)) return true;
    }
  }
  return false;
}

function nearMissDistance(dinoBoxes, obstacleBoxes) {
  let minDist = Infinity;
  for (const db of dinoBoxes) {
    for (const ob of obstacleBoxes) {
      // Horizontal gap
      const gapX = Math.max(0, Math.max(ob.x - (db.x + db.w), db.x - (ob.x + ob.w)));
      const gapY = Math.max(0, Math.max(ob.y - (db.y + db.h), db.y - (ob.y + ob.h)));
      const dist = Math.sqrt(gapX * gapX + gapY * gapY);
      if (dist < minDist) minDist = dist;
    }
  }
  return minDist;
}

// ─── Dino Hitboxes ───
function getDinoBoxes(dino) {
  if (dino.ducking) {
    // Ducking: wider and shorter (60x28)
    return [
      { x: dino.x + 4, y: dino.y + 4, w: 52, h: 10 },  // head
      { x: dino.x, y: dino.y + 10, w: 60, h: 12 },      // body
      { x: dino.x + 8, y: dino.y + 20, w: 44, h: 8 },   // legs
    ];
  }
  // Standing: 44x48
  return [
    { x: dino.x + 8, y: dino.y, w: 28, h: 14 },       // head
    { x: dino.x + 2, y: dino.y + 14, w: 40, h: 20 },   // body
    { x: dino.x + 6, y: dino.y + 34, w: 32, h: 14 },   // legs
  ];
}

// ─── Obstacle Hitboxes ───
function getObstacleBoxes(obs) {
  switch (obs.type) {
    case "cactusSmall":
      return [
        { x: obs.x + 4, y: obs.y, w: 12, h: 30 },       // trunk
        { x: obs.x - 4, y: obs.y + 8, w: 10, h: 12 },    // left arm
        { x: obs.x + 14, y: obs.y + 6, w: 10, h: 14 },   // right arm
      ];
    case "cactusTall":
      return [
        { x: obs.x + 2, y: obs.y, w: 16, h: 10 },        // crown
        { x: obs.x + 4, y: obs.y + 10, w: 12, h: 35 },   // trunk
        { x: obs.x + 2, y: obs.y + 40, w: 16, h: 10 },   // base
      ];
    case "cactusTriple":
      return [
        { x: obs.x, y: obs.y + 5, w: 12, h: 30 },
        { x: obs.x + 18, y: obs.y, w: 12, h: 35 },
        { x: obs.x + 36, y: obs.y + 8, w: 12, h: 28 },
      ];
    case "ptero":
      return [
        { x: obs.x + 14, y: obs.y + 8, w: 20, h: 14 },   // body
        { x: obs.x, y: obs.y, w: 16, h: 10 },             // left wing
        { x: obs.x + 32, y: obs.y, w: 16, h: 10 },        // right wing
        { x: obs.x, y: obs.y + 10, w: 14, h: 6 },         // beak (flies beak-first, to the left)
        { x: obs.x + 34, y: obs.y + 14, w: 12, h: 8 },    // tail
      ];
    default:
      return [{ x: obs.x, y: obs.y, w: obs.w || 20, h: obs.h || 40 }];
  }
}

// ─── DOM References ───
const canvas = document.getElementById("game-canvas");
const ctx = canvas.getContext("2d");
const hudScore = document.getElementById("hud-score");
const hudHi = document.getElementById("hud-hi");
const hudBiome = document.getElementById("hud-biome");
const hudCombo = document.getElementById("hud-combo");
const comboVal = document.getElementById("combo-val");
const hudCoins = document.getElementById("hud-coins");
const startOverlay = document.getElementById("start-overlay");
const modalPerk = document.getElementById("modal-perk");
const perkGrid = document.getElementById("perk-grid");
const modalGameover = document.getElementById("modal-gameover");
const goScore = document.getElementById("go-score");
const goCombo = document.getElementById("go-combo");
const goCoins = document.getElementById("go-coins");
const goPerks = document.getElementById("go-perks");
const goFinal = document.getElementById("go-final");
const btnRestart = document.getElementById("btn-restart");
const containerEl = document.querySelector(".tr-canvas-container");

// ─── State ───
const STATES = { IDLE: 0, RUNNING: 1, PERK_SELECT: 2, GAME_OVER: 3 };
let state = STATES.IDLE;

let dino, scrollSpeed, distancePx, score, combo, bestCombo, nightMode, nightTimer;
let obstacles, coins, particles, clouds, stars;
let jumpHeld, jumpPressTime, ducking, fastFalling;
let perksChosen, activePerks, perkTimers;
let nextPerkScore, nextNightToggle;
let coinsCollected, totalCoins;
let biomeIndex;
let groundOffset;
let hiScore;
let slowMoTimer;
let phaseShiftTimer;
let shieldActive;
let sessionStart;
let deathAnimTimer;

function loadCoins() {
  try { return parseInt(localStorage.getItem("tr-coins") || "0", 10); } catch { return 0; }
}
function saveCoins(c) {
  try { localStorage.setItem("tr-coins", String(c)); } catch { /* */ }
}

function initGame() {
  dino = {
    x: 100,
    y: GROUND_Y - 48,
    w: 44,
    h: 48,
    vy: 0,
    grounded: true,
    ducking: false,
    legFrame: 0,
    legTimer: 0,
  };
  scrollSpeed = BASE_SPEED;
  distancePx = 0;
  score = 0;
  combo = 0;
  bestCombo = 0;
  nightMode = false;
  nightTimer = 0;
  obstacles = [];
  coins = [];
  particles = [];
  clouds = generateClouds();
  stars = generateStars();
  jumpHeld = false;
  jumpPressTime = 0;
  ducking = false;
  fastFalling = false;
  perksChosen = [];
  activePerks = {};
  perkTimers = {};
  nextPerkScore = PERK_INTERVAL;
  nextNightToggle = NIGHT_INTERVAL;
  coinsCollected = 0;
  totalCoins = loadCoins();
  biomeIndex = 0;
  groundOffset = 0;
  slowMoTimer = 0;
  phaseShiftTimer = 0;
  shieldActive = false;
  deathAnimTimer = 0;

  const saved = loadGameScore("teraform-run");
  hiScore = saved ? saved.score : 0;
  hudHi.textContent = String(hiScore).padStart(5, "0");
  hudCoins.textContent = String(totalCoins);

  containerEl.classList.toggle("night-mode", false);
}

function generateClouds() {
  const arr = [];
  for (let i = 0; i < 8; i++) {
    arr.push({
      x: Math.random() * CANVAS_W * 1.5,
      y: 40 + Math.random() * 120,
      w: 60 + Math.random() * 80,
      h: 20 + Math.random() * 15,
      speed: 20 + Math.random() * 30,
    });
  }
  return arr;
}

function generateStars() {
  const arr = [];
  for (let i = 0; i < 60; i++) {
    arr.push({
      x: Math.random() * CANVAS_W,
      y: Math.random() * (GROUND_Y - 40),
      size: 1 + Math.random() * 2,
      blink: Math.random() * Math.PI * 2,
    });
  }
  return arr;
}

// ─── Perk Helpers ───
function hasPerk(id) {
  return activePerks[id] === true;
}

function getEffectiveGravity() {
  let g = GRAVITY;
  if (hasPerk("featherfall")) g *= 0.7;
  return g;
}

function getEffectiveJumpVel() {
  let v = JUMP_VEL;
  if (hasPerk("ironLegs")) v *= 1.15;
  return v;
}

function getEffectiveSpeed() {
  let s = scrollSpeed;
  if (hasPerk("turbo")) s += 50;
  if (slowMoTimer > 0) s *= 0.7;
  return s;
}

// ─── Input Handling ───
const keys = {};
let perkChoices = [];
window.addEventListener("keydown", (e) => {
  if (e.target instanceof Element && e.target.closest("input, textarea, select, [contenteditable]")) return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  // Pick a perk with 1 / 2 / 3.
  if (state === STATES.PERK_SELECT && /^Digit[123]$/.test(e.code)) {
    const perk = perkChoices[Number(e.code.slice(5)) - 1];
    if (perk) selectPerk(perk);
    return;
  }
  if (typeof loop !== "undefined" && loop.isPaused() && e.code !== "Escape") return;
  if (state === STATES.GAME_OVER && (e.code === "Space" || e.code === "Enter")) {
    e.preventDefault();
    restartGame();
    return;
  }
  if (state === STATES.IDLE && (e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyW")) {
    e.preventDefault();
    startRun();
    return;
  }
  if (!keys[e.code]) {
    keys[e.code] = true;
    if ((e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyW") && state === STATES.RUNNING) {
      e.preventDefault();
      handleJumpPress();
    }
    if ((e.code === "ArrowDown" || e.code === "KeyS") && state === STATES.RUNNING) {
      e.preventDefault();
      handleDuckPress();
    }
  }
});

window.addEventListener("keyup", (e) => {
  keys[e.code] = false;
  if ((e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyW")) {
    handleJumpRelease();
  }
  if ((e.code === "ArrowDown" || e.code === "KeyS")) {
    handleDuckRelease();
  }
});

// Touch
const touchLeft = document.getElementById("touch-left");
const touchRight = document.getElementById("touch-right");

function setupTouch(el, pressHandler, releaseHandler) {
  el.addEventListener("touchstart", (e) => { e.preventDefault(); pressHandler(); }, { passive: false });
  el.addEventListener("touchend", (e) => { e.preventDefault(); releaseHandler(); }, { passive: false });
  el.addEventListener("touchcancel", (e) => { e.preventDefault(); releaseHandler(); }, { passive: false });
}

setupTouch(touchRight, () => {
  if (state === STATES.IDLE) { startRun(); return; }
  if (state === STATES.RUNNING) handleJumpPress();
}, handleJumpRelease);

setupTouch(touchLeft, () => {
  if (state === STATES.IDLE) { startRun(); return; }
  if (state === STATES.RUNNING) handleDuckPress();
}, handleDuckRelease);

// Start overlay click
startOverlay.addEventListener("click", () => {
  if (state === STATES.IDLE) startRun();
});

btnRestart.addEventListener("click", restartGame);

function handleJumpPress() {
  if (state !== STATES.RUNNING) return;
  if (dino.grounded) {
    jumpHeld = true;
    jumpPressTime = performance.now();
    dino.vy = getEffectiveJumpVel();
    dino.grounded = false;
    dino.ducking = false;
    ducking = false;
    dino.h = 48;
    dino.y = GROUND_Y - 48;
    playTone(200, 0.1, "square", 0.15);
  }
}

function handleJumpRelease() {
  if (jumpHeld && dino.vy < 0) {
    const holdDur = performance.now() - jumpPressTime;
    if (holdDur < 150) {
      // Short hop: cut velocity
      dino.vy *= SHORT_HOP_MULT;
    } else {
      // Release mid-jump: cut to 40%
      dino.vy *= 0.4;
    }
  }
  jumpHeld = false;
}

function handleDuckPress() {
  if (state !== STATES.RUNNING) return;
  if (dino.grounded) {
    // Duck on ground
    ducking = true;
    dino.ducking = true;
    dino.h = 28;
    dino.y = GROUND_Y - 28;
  } else {
    // Fast-fall in air
    fastFalling = true;
  }
}

function handleDuckRelease() {
  ducking = false;
  fastFalling = false;
  if (dino.grounded && dino.ducking) {
    dino.ducking = false;
    dino.h = 48;
    dino.y = GROUND_Y - 48;
  }
}

// ─── Game Flow ───
function startRun() {
  initGame();
  state = STATES.RUNNING;
  startOverlay.hidden = true;
  modalGameover.hidden = true;
  modalPerk.hidden = true;
  sessionStart = performance.now();
}

function restartGame() {
  startRun();
}

function showPerkModal() {
  state = STATES.PERK_SELECT;
  // Pick 3 random perks
  // Offer perks the runner doesn't already have (one-shot perks can repeat).
  const repeatable = new Set(["slowMo", "thickSkin"]);
  const pool = PERKS.filter((p) => repeatable.has(p.id) || !hasPerk(p.id));
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  const choices = shuffled.slice(0, 3);
  perkChoices = choices;

  perkGrid.innerHTML = "";
  choices.forEach((perk, idx) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "perk-card";
    card.innerHTML = `
      <span class="perk-key">[${idx + 1}]</span>
      <span class="perk-icon">${perk.icon}</span>
      <span class="perk-name">${perk.name}</span>
      <span class="perk-desc">${perk.desc}</span>
    `;
    card.addEventListener("click", () => selectPerk(perk));
    perkGrid.appendChild(card);
  });
  modalPerk.hidden = false;
  playTone(600, 0.08, "square", 0.12);
  setTimeout(() => playTone(800, 0.08, "square", 0.12), 80);
  setTimeout(() => playTone(1000, 0.08, "square", 0.12), 160);
}

function selectPerk(perk) {
  if (state !== STATES.PERK_SELECT) return;
  activePerks[perk.id] = true;
  perksChosen.push(perk.name);
  modalPerk.hidden = true;
  state = STATES.RUNNING;

  // Apply immediate-effect perks
  if (perk.id === "slowMo") slowMoTimer = 10;
  if (perk.id === "thickSkin") shieldActive = true;

  playTone(1200, 0.15, "square", 0.15);
}

function triggerDeath() {
  if (shieldActive) {
    shieldActive = false;
    // Flash effect
    spawnParticles(dino.x + 22, dino.y + 24, 8, "#00ffcc");
    playTone(600, 0.1, "triangle", 0.15);
    return;
  }

  state = STATES.GAME_OVER;
  // Death sound
  playTone(400, 0.3, "sawtooth", 0.2);
  setTimeout(() => playTone(200, 0.3, "sawtooth", 0.15), 100);
  setTimeout(() => playTone(100, 0.4, "sawtooth", 0.12), 200);

  // Save score
  if (score > hiScore) {
    hiScore = score;
    saveGameScore("teraform-run", score, `${score.toLocaleString()} PTS`);
  }

  // Save coins
  totalCoins += coinsCollected;
  saveCoins(totalCoins);

  // Show game over
  goScore.textContent = score.toLocaleString();
  goCombo.textContent = bestCombo + "x";
  goCoins.textContent = coinsCollected;
  goPerks.textContent = perksChosen.length;
  goFinal.textContent = score.toLocaleString();
  modalGameover.hidden = false;
}

// ─── Spawning ───
function spawnObstacle() {
  const types = ["cactusSmall", "cactusTall", "cactusTriple"];
  if (score > 200) types.push("ptero");

  const type = types[Math.floor(Math.random() * types.length)];
  const obs = { type, passed: false };

  switch (type) {
    case "cactusSmall":
      obs.x = CANVAS_W + 20;
      obs.y = GROUND_Y - 35;
      obs.w = 24;
      obs.h = 35;
      break;
    case "cactusTall":
      obs.x = CANVAS_W + 20;
      obs.y = GROUND_Y - 50;
      obs.w = 20;
      obs.h = 50;
      break;
    case "cactusTriple":
      obs.x = CANVAS_W + 20;
      obs.y = GROUND_Y - 40;
      obs.w = 50;
      obs.h = 40;
      break;
    case "ptero": {
      const heights = [GROUND_Y - 70, GROUND_Y - 120, GROUND_Y - 170];
      obs.x = CANVAS_W + 20;
      obs.y = heights[Math.floor(Math.random() * heights.length)];
      obs.w = 48;
      obs.h = 28;
      obs.speedOffset = (Math.random() - 0.5) * 60;
      break;
    }
  }
  obstacles.push(obs);
}

function spawnCoin() {
  coins.push({
    x: CANVAS_W + 20 + Math.random() * 200,
    y: GROUND_Y - 60 - Math.random() * 100,
    w: 16,
    h: 16,
    bobPhase: Math.random() * Math.PI * 2,
  });
}

function spawnParticles(x, y, count, color) {
  for (let i = 0; i < count; i++) {
    particles.push({
      x, y,
      vx: (Math.random() - 0.5) * 200,
      vy: -Math.random() * 150 - 50,
      life: 0.4 + Math.random() * 0.3,
      color: color || "#888",
      size: 2 + Math.random() * 3,
    });
  }
}

// ─── Update ───
let spawnTimer = 0;
let coinSpawnTimer = 0;

function update(dt) {
  if (state !== STATES.RUNNING) return;

  const effSpeed = getEffectiveSpeed();
  const effGravity = getEffectiveGravity();

  // Timers
  if (slowMoTimer > 0) slowMoTimer -= dt;
  if (phaseShiftTimer > 0) phaseShiftTimer -= dt;

  // Speed ramp
  scrollSpeed = Math.min(MAX_SPEED, scrollSpeed + SPEED_RAMP * dt);

  // Distance & score
  distancePx += effSpeed * dt;
  score = Math.floor(distancePx / 10);

  // Biome change every 1000 pts
  const newBiome = Math.floor(score / 1000) % BIOMES.length;
  if (newBiome !== biomeIndex) {
    biomeIndex = newBiome;
    hudBiome.textContent = BIOMES[biomeIndex].name;
  }

  // Night mode toggle
  if (score >= nextNightToggle) {
    nightMode = !nightMode;
    containerEl.classList.toggle("night-mode", nightMode);
    nextNightToggle += NIGHT_INTERVAL;
    playTone(120, 0.4, "sine", 0.1);
  }

  // Perk milestone
  if (score >= nextPerkScore) {
    nextPerkScore += PERK_INTERVAL;
    showPerkModal();
    return; // Pause game flow
  }

  // ── Dino physics ──
  if (!dino.grounded) {
    let fallMult = fastFalling ? FAST_FALL_MULT : 1;
    dino.vy += effGravity * fallMult * dt;
    dino.y += dino.vy * dt;


    if (dino.y >= GROUND_Y - dino.h) {
      // Slam effect (check before the landing resets velocity / fast-fall)
      if (fastFalling || dino.vy > 900) {
        spawnParticles(dino.x + dino.w / 2, GROUND_Y, 6, "#aaa");
        playTone(80, 0.15, "sine", 0.12);
      }
      dino.y = GROUND_Y - dino.h;
      dino.vy = 0;
      dino.grounded = true;
      fastFalling = false;

      // Re-apply duck if held
      if (ducking) {
        dino.ducking = true;
        dino.h = 28;
        dino.y = GROUND_Y - 28;
      }
    }
  }

  // Leg animation
  if (dino.grounded && !dino.ducking) {
    dino.legTimer += dt;
    if (dino.legTimer > 0.08) {
      dino.legTimer = 0;
      dino.legFrame = (dino.legFrame + 1) % 4;
    }
  }

  // ── Ground scroll ──
  groundOffset = (groundOffset + effSpeed * dt) % 24;

  // ── Clouds ──
  for (const c of clouds) {
    c.x -= c.speed * dt;
    if (c.x + c.w < 0) {
      c.x = CANVAS_W + 20;
      c.y = 40 + Math.random() * 120;
    }
  }

  // ── Stars blink ──
  for (const s of stars) {
    s.blink += dt * 2;
  }

  // ── Spawn obstacles ──
  // Gaps scale with speed so there's always time to land and jump again (~0.6s airtime).
  const minGap = effSpeed * 0.72 + 90;
  spawnTimer += effSpeed * dt;
  if (spawnTimer > minGap + Math.random() * effSpeed * 0.6) {
    spawnTimer = 0;
    spawnObstacle();
  }

  // ── Spawn coins ──
  coinSpawnTimer += dt;
  if (coinSpawnTimer > 2 + Math.random() * 3) {
    coinSpawnTimer = 0;
    if (Math.random() < 0.5) spawnCoin();
  }

  // ── Update obstacles ──
  const dinoBoxes = getDinoBoxes(dino);

  for (let i = obstacles.length - 1; i >= 0; i--) {
    const obs = obstacles[i];
    const speed = obs.type === "ptero" ? effSpeed + (obs.speedOffset || 0) : effSpeed;
    obs.x -= speed * dt;

    // Off screen
    if (obs.x + (obs.w || 50) < -20) {
      obstacles.splice(i, 1);
      continue;
    }

    const obsBoxes = getObstacleBoxes(obs);

    // Collision check
    if (phaseShiftTimer <= 0 && multiBoxCollision(dinoBoxes, obsBoxes)) {
      triggerDeath();
      return;
    }

    // Near-miss check (only once per obstacle)
    if (!obs.passed && obs.x + (obs.w || 50) < dino.x) {
      obs.passed = true;
      const dist = nearMissDistance(dinoBoxes, obsBoxes);
      if (dist < NEAR_MISS_PX && dist > 0) {
        combo++;
        if (combo > bestCombo) bestCombo = combo;
        // Bonus score
        score += Math.floor(combo * 5);
        hudCombo.hidden = false;
        comboVal.textContent = combo;
        playTone(500 + combo * 50, 0.08, "sine", 0.1);

        if (hasPerk("phaseShift")) phaseShiftTimer = 2;
      } else if (dist > NEAR_MISS_PX * 3) {
        // Reset combo on large gap
        if (combo > 0) {
          combo = 0;
          hudCombo.hidden = true;
        }
      }
    }
  }

  // ── Update coins ──
  for (let i = coins.length - 1; i >= 0; i--) {
    const c = coins[i];
    c.x -= effSpeed * dt;
    c.bobPhase += dt * 4;
    if (hasPerk("magnetBoots")) {
      const dx = dino.x + dino.w / 2 - (c.x + c.w / 2);
      const dy = dino.y + dino.h / 2 - (c.y + c.h / 2);
      const d = Math.hypot(dx, dy);
      if (d < 220 && d > 1) {
        c.x += (dx / d) * 520 * dt;
        c.y += (dy / d) * 520 * dt;
      }
    }

    if (c.x + c.w < -10) {
      coins.splice(i, 1);
      continue;
    }

    // Collect check
    const coinY = c.y + Math.sin(c.bobPhase) * 6;
    const coinBox = { x: c.x, y: coinY, w: c.w, h: c.h };
    for (const db of dinoBoxes) {
      if (boxesOverlap(db, coinBox)) {
        const worth = hasPerk("doubleCoins") ? 2 : 1;
        coinsCollected += worth;
        hudCoins.textContent = String(totalCoins + coinsCollected);
        spawnParticles(c.x + 8, coinY + 8, 4, "#ffcc00");
        playTone(800, 0.06, "square", 0.1);
        setTimeout(() => playTone(1200, 0.06, "square", 0.08), 60);
        coins.splice(i, 1);
        break;
      }
    }
  }

  // ── Particles ──
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 400 * dt;
    p.life -= dt;
    if (p.life <= 0) particles.splice(i, 1);
  }

  // ── HUD ──
  hudScore.textContent = String(score).padStart(5, "0");
  if (score > hiScore) {
    hudHi.textContent = String(score).padStart(5, "0");
  }
}

// ─── Render ───
const rart = buildRunnerArt();
const fx = createParticles(500);
const starLayer = starfield(CANVAS_W, GROUND_Y, { count: 160, seed: 21 });
let shownBiome = 0;
let fadeFromBiome = -1;
let fadeT = 1;
let deathFlash = 0;
let wasGameOver = false;

function drawWrapped(img, offset, y = 0) {
  const w = img.width;
  const x = -(((offset % w) + w) % w);
  ctx.drawImage(img, Math.floor(x), y);
  ctx.drawImage(img, Math.floor(x + w), y);
  if (x + w * 2 < CANVAS_W) ctx.drawImage(img, Math.floor(x + w * 2), y);
}

function drawSky(bi, t) {
  const B = BIOME_ART[bi];
  const g = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
  g.addColorStop(0, B.skyTop);
  g.addColorStop(1, B.skyBot);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, CANVAS_W, GROUND_Y);

  // Sun / celestial body (slow parallax so it drifts)
  const sx = 1080 - ((distancePx || 0) * 0.01) % 200;
  const sy = B.key === "desert" ? 250 : 150;
  if (B.key === "cyber") {
    // Synthwave sun: gradient disc with horizontal cut-outs
    const r = 110;
    const sg = ctx.createLinearGradient(0, sy - r, 0, sy + r);
    sg.addColorStop(0, "#ffe66d");
    sg.addColorStop(0.5, "#ff4dd8");
    sg.addColorStop(1, "#7a1fff");
    ctx.save();
    ctx.beginPath();
    ctx.arc(sx, sy + 60, r, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = sg;
    ctx.fillRect(sx - r, sy + 60 - r, r * 2, r * 2);
    ctx.fillStyle = B.skyBot;
    for (let i = 0; i < 7; i++) ctx.fillRect(sx - r, sy + 60 + i * 16 + (t * 12) % 16, r * 2, 3 + i);
    ctx.restore();
  } else if (B.key === "void") {
    // Ringed planet
    ctx.fillStyle = "#3a2566";
    ctx.beginPath();
    ctx.arc(sx, sy, 60, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#5a3aa8";
    ctx.beginPath();
    ctx.arc(sx - 14, sy - 14, 46, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(224,204,255,0.7)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(sx, sy, 100, 22, -0.3, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    const r = B.key === "desert" ? 70 : B.key === "volcanic" ? 80 : 45;
    const halo = ctx.createRadialGradient(sx, sy, r * 0.6, sx, sy, r * 3.2);
    halo.addColorStop(0, rgba(B.sun, 0.55));
    halo.addColorStop(1, rgba(B.sun, 0));
    ctx.fillStyle = halo;
    ctx.fillRect(sx - r * 3.2, sy - r * 3.2, r * 6.4, r * 6.4);
    ctx.fillStyle = B.sun;
    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawClouds(bi) {
  const B = BIOME_ART[bi];
  if (B.key === "void") return;
  for (const c of clouds) {
    const x = Math.round(c.x);
    const y = Math.round(c.y);
    ctx.fillStyle = shade(B.cloud, -0.12);
    ctx.fillRect(x + 4, y + c.h * 0.55, c.w - 8, c.h * 0.45);
    ctx.fillStyle = B.cloud;
    ctx.beginPath();
    ctx.ellipse(x + c.w * 0.3, y + c.h * 0.55, c.w * 0.26, c.h * 0.45, 0, 0, Math.PI * 2);
    ctx.ellipse(x + c.w * 0.55, y + c.h * 0.35, c.w * 0.3, c.h * 0.6, 0, 0, Math.PI * 2);
    ctx.ellipse(x + c.w * 0.8, y + c.h * 0.6, c.w * 0.2, c.h * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = rgba("#ffffff", B.key === "volcanic" || B.key === "cyber" ? 0.05 : 0.45);
    ctx.fillRect(x + c.w * 0.4, y + c.h * 0.02, c.w * 0.25, 3);
  }
}

function drawScenery(bi, t) {
  const A = rart.biomes[bi];
  const d = distancePx || 0;
  drawSky(bi, t);
  drawClouds(bi);
  // Scenery strips are authored standing on a 440px ground line; seat them on this stage's ground
  const lift = GROUND_Y - A.far.height;
  drawWrapped(A.far, d * 0.08, lift);
  drawWrapped(A.mid, d * 0.25, lift);
  drawWrapped(A.near, d * 0.6, lift);
  // Textured ground strip
  const gx = -((d % A.ground.width) + A.ground.width) % A.ground.width;
  for (let x = gx; x < CANVAS_W; x += A.ground.width) ctx.drawImage(A.ground, Math.floor(x), GROUND_Y);
}

function spawnWeather(bi, dt) {
  const kind = BIOME_ART[bi].weather;
  if (!kind || state !== STATES.RUNNING) return;
  const rate = { snow: 60, embers: 30, leaves: 8, rain: 90, motes: 20 }[kind] * dt;
  let n = Math.floor(rate) + (Math.random() < rate % 1 ? 1 : 0);
  while (n-- > 0) {
    const x = Math.random() * (CANVAS_W + 300);
    if (kind === "snow") fx.spawn({ x, y: -5, vx: -60 - Math.random() * 60, vy: 40 + Math.random() * 40, life: 8, size: 2 + Math.random() * 2, color: "#ffffff", drag: 1, alpha: 0.9 });
    else if (kind === "embers") fx.spawn({ x, y: GROUND_Y + 10, vx: -80 - Math.random() * 60, vy: -60 - Math.random() * 80, life: 3, size: 2, color: "#ffb347", color2: "#ff3b1f", drag: 1 });
    else if (kind === "leaves") fx.spawn({ x, y: -5, vx: -120, vy: 50, life: 8, size: 4, color: Math.random() < 0.5 ? "#5cbf3f" : "#ffcc4d", kind: "shard", vr: 3, drag: 1 });
    else if (kind === "rain") fx.spawn({ x, y: -5, vx: -260, vy: 700, life: 1.2, size: 2, color: Math.random() < 0.7 ? "#00ffcc" : "#ff4dd8", kind: "spark", drag: 1, alpha: 0.55 });
    else if (kind === "motes") fx.spawn({ x, y: Math.random() * GROUND_Y, vx: -40, vy: -10, life: 4, size: 3, color: "#c9a6ff", kind: "glow", drag: 1, alpha: 0.6 });
  }
}

function render(dt, { paused }) {
  const t = performance.now() / 1000;
  const live = !paused && state === STATES.RUNNING;
  if (live) fx.update(Math.min(dt, 0.05));
  else if (state === STATES.GAME_OVER && !paused) fx.update(Math.min(dt, 0.05));

  // Biome cross-fade
  if (biomeIndex !== shownBiome) {
    fadeFromBiome = shownBiome;
    shownBiome = biomeIndex;
    fadeT = 0;
  }
  if (fadeT < 1 && !paused) fadeT = Math.min(1, fadeT + dt / 1.2);

  ctx.imageSmoothingEnabled = false;
  if (fadeT < 1 && fadeFromBiome >= 0) {
    drawScenery(fadeFromBiome, t);
    ctx.globalAlpha = fadeT;
    drawScenery(shownBiome, t);
    ctx.globalAlpha = 1;
  } else {
    drawScenery(shownBiome, t);
  }

  // Night: deep-blue grade, stars and a moon
  if (nightMode) {
    ctx.fillStyle = "rgba(6, 8, 38, 0.58)";
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.globalAlpha = 0.9;
    ctx.drawImage(starLayer, 0, 0);
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#f4f1dc";
    ctx.beginPath();
    ctx.arc(300, 90, 26, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(6, 8, 38, 0.9)";
    ctx.beginPath();
    ctx.arc(312, 82, 24, 0, Math.PI * 2);
    ctx.fill();
  }

  if (live) spawnWeather(shownBiome, Math.min(dt, 0.05));

  const A = rart.biomes[shownBiome];
  const B = BIOME_ART[shownBiome];

  // Obstacles (sprites sit on the ground line; drop shadows on the dirt)
  for (const obs of obstacles) drawObstacle(obs, A, B, t);

  // Coins: spinning disc
  for (const c of coins) {
    const coinY = c.y + Math.sin(c.bobPhase) * 6;
    const spin = Math.abs(Math.cos(c.bobPhase * 1.5));
    const w = Math.max(2, Math.round(A.coin.width * spin));
    glow(ctx, c.x + 8, coinY + 8, 16, B.coin, 0.35);
    ctx.drawImage(A.coin, Math.round(c.x + 8 - w / 2), Math.round(coinY), w, A.coin.height);
  }

  // Dino
  drawDino(A, t);

  // Shield bubble
  if (shieldActive) {
    const cx = dino.x + dino.w / 2;
    const cy = dino.y + dino.h / 2;
    ctx.strokeStyle = `rgba(0,255,204,${0.5 + Math.sin(t * 6) * 0.2})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, 34, 0, Math.PI * 2);
    ctx.stroke();
    glow(ctx, cx, cy, 40, "#00ffcc", 0.18);
  }
  if (phaseShiftTimer > 0) glow(ctx, dino.x + dino.w / 2, dino.y + dino.h / 2, 46, "#7df9ff", 0.3 + Math.sin(t * 20) * 0.1);

  // Legacy particle list (coin pickups, slams) + new FX
  for (const p of particles) {
    ctx.globalAlpha = clamp(p.life / 0.3, 0, 1);
    ctx.fillStyle = p.color;
    ctx.fillRect(Math.round(p.x), Math.round(p.y), Math.round(p.size), Math.round(p.size));
  }
  ctx.globalAlpha = 1;
  fx.draw(ctx);

  // Death flash
  if (state === STATES.GAME_OVER && !wasGameOver) {
    deathFlash = 1;
    fx.burst(dino.x + 22, dino.y + 24, { count: 30, speed: 260, life: 0.8, size: 4, color: "#4caf50", color2: "#2e7d32", gravity: 700, kind: "pixel" });
  }
  wasGameOver = state === STATES.GAME_OVER;
  if (deathFlash > 0) {
    ctx.fillStyle = `rgba(255,255,255,${deathFlash * 0.6})`;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    deathFlash = Math.max(0, deathFlash - dt * 3);
  }

  vignette(ctx, CANVAS_W, CANVAS_H, nightMode || B.key === "void" || B.key === "volcanic" || B.key === "cyber" ? 0.55 : 0.3);
  scanlines(ctx, CANVAS_W, CANVAS_H, 0.05);

  // Paused overlay
  if (paused && state === STATES.RUNNING) {
    ctx.fillStyle = "rgba(3,5,8,0.75)";
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.fillStyle = "#f4f6f8";
    ctx.font = '16px "Press Start 2P", monospace';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("PAUSED", CANVAS_W / 2, CANVAS_H / 2);
    ctx.font = '10px "Press Start 2P", monospace';
    ctx.fillStyle = "#8a97b1";
    ctx.fillText("PRESS ESC TO RESUME", CANVAS_W / 2, CANVAS_H / 2 + 28);
    ctx.textBaseline = "alphabetic";
  }
}

// ─── Draw Helpers ───
function drawDino(A, t) {
  const D = rart.dino;
  let img;
  if (dino.ducking) img = dino.legFrame < 2 ? D.duckA : D.duckB;
  else if (!dino.grounded) img = D.jump;
  else img = dino.legFrame < 2 ? D.runA : D.runB;

  // Ground shadow shrinks with height
  const air = Math.max(0, GROUND_Y - (dino.y + dino.h));
  const k = Math.max(0.35, 1 - air / 220);
  ctx.fillStyle = `rgba(0,0,0,${0.3 * k})`;
  ctx.beginPath();
  ctx.ellipse(dino.x + dino.w / 2, GROUND_Y + 3, (dino.w / 2) * k, 5 * k, 0, 0, Math.PI * 2);
  ctx.fill();

  // Running dust
  if (state === STATES.RUNNING && dino.grounded && Math.random() < 0.35) {
    fx.spawn({ x: dino.x + 6, y: GROUND_Y - 2, vx: -120 - Math.random() * 80, vy: -20 - Math.random() * 30, life: 0.4, size: 3, grow: 10, color: shade(BIOME_ART[shownBiome].groundTop, -0.1), kind: "smoke", alpha: 0.6 });
  }

  const dead = state === STATES.GAME_OVER;
  ctx.save();
  if (dead) {
    ctx.translate(dino.x + dino.w / 2, dino.y + dino.h / 2);
    ctx.rotate(0.25);
    ctx.translate(-(dino.x + dino.w / 2), -(dino.y + dino.h / 2));
  }
  ctx.drawImage(dead ? tinted(img, "#b3261e") : img, Math.round(dino.x), Math.round(dino.y));
  ctx.restore();
}

function drawObstacle(obs, A, B, t) {
  if (obs.type === "ptero") {
    const frame = A.ptero[Math.floor(t * 8) % 2];
    ctx.fillStyle = "rgba(0,0,0,0.18)";
    ctx.beginPath();
    ctx.ellipse(obs.x + 24, GROUND_Y + 3, 18, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.drawImage(frame, Math.round(obs.x), Math.round(obs.y));
    if (B.key === "cyber" || B.key === "volcanic") glow(ctx, obs.x + 6, obs.y + 14, 14, B.ptero.b, 0.4);
    return;
  }
  const img = A.obstacles[obs.type];
  if (!img) return;
  const x = Math.round(obs.x + (obs.w - img.width) / 2);
  const y = GROUND_Y + 3 - img.height;
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.beginPath();
  ctx.ellipse(obs.x + obs.w / 2, GROUND_Y + 3, obs.w * 0.6, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  if (B.obstacle.family === "crystal") glow(ctx, obs.x + obs.w / 2, y + img.height * 0.4, img.height * 0.9, B.obstacle.h, 0.18 + Math.sin(t * 3 + obs.x * 0.01) * 0.06);
  ctx.drawImage(img, x, y);
}

// ─── Session Clock ───
const clockEl = document.querySelector("[data-session-clock]");
const pageStart = performance.now();
setInterval(() => {
  const elapsed = Math.floor((performance.now() - pageStart) / 1000);
  const m = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const s = String(elapsed % 60).padStart(2, "0");
  if (clockEl) clockEl.textContent = `${m}:${s}`;
}, 1000);

// ─── Game Loop ───
initGame();

// Debug handle for automated visual checks (jump to a biome / toggle night)
window.__teraform = {
  get state() { return state; },
  warp(biome, night = false) {
    distancePx = biome * 10000 + 10;
    score = Math.floor(distancePx / 10);
    nextPerkScore = score + 100000;
    nextNightToggle = score + 100000;
    nightMode = night;
    if (dino) { dino.vy = 0; }
  }
};

const loop = createGameLoop({
  update,
  render,
  canvas: null, // the game draws its own pause overlay
  targetFps: 60,

  onPause: (p) => {
    if (state === STATES.RUNNING && p) {
      // Paused
    }
  },
});

loop.start();
