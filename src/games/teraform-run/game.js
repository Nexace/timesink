/**
 * TERAFORM RUN — 1-Bit Endless Runner
 * Multi-box collision, variable jump, fast-fall, roguelite perks,
 * 6 biomes, combo near-miss, night mode, coins & shop.
 */

import { initShell } from "/shared/shell.js";
import { createGameLoop, createInputManager, clamp, lerp } from "/src/core/engine.js";
import { playTone, playLaser, playExplosion } from "/src/core/audio.js";
import { saveGameScore, loadGameScore } from "/src/core/save.js";

initShell({ crumb: "Teraform Run" });

// ─── Constants ───
const CANVAS_W = 1440;
const CANVAS_H = 520;
const GROUND_Y = CANVAS_H - 80;
const GRAVITY = 2800;
const JUMP_VEL = -850;
const SHORT_HOP_MULT = 0.55;
const FAST_FALL_MULT = 3;
const BASE_SPEED = 300;
const SPEED_RAMP = 0.5; // px/s per second
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
  { id: "magnetBoots", icon: "🧲", name: "MAGNET BOOTS", desc: "20% wider ground" },
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
        { x: obs.x + 34, y: obs.y + 10, w: 14, h: 6 },    // beak
        { x: obs.x + 2, y: obs.y + 14, w: 12, h: 8 },     // tail
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
window.addEventListener("keydown", (e) => {
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
  const shuffled = [...PERKS].sort(() => Math.random() - 0.5);
  const choices = shuffled.slice(0, 3);

  perkGrid.innerHTML = "";
  for (const perk of choices) {
    const card = document.createElement("div");
    card.className = "perk-card";
    card.innerHTML = `
      <span class="perk-icon">${perk.icon}</span>
      <span class="perk-name">${perk.name}</span>
      <span class="perk-desc">${perk.desc}</span>
    `;
    card.addEventListener("click", () => selectPerk(perk));
    perkGrid.appendChild(card);
  }
  modalPerk.hidden = false;
  playTone(600, 0.08, "square", 0.12);
  setTimeout(() => playTone(800, 0.08, "square", 0.12), 80);
  setTimeout(() => playTone(1000, 0.08, "square", 0.12), 160);
}

function selectPerk(perk) {
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
    saveGameScore("teraform-run", score, "PTS");
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

    // Widen ground for magnet boots
    let groundLevel = GROUND_Y - dino.h;
    if (hasPerk("magnetBoots")) groundLevel += 10;

    if (dino.y >= GROUND_Y - dino.h) {
      dino.y = GROUND_Y - dino.h;
      dino.vy = 0;
      dino.grounded = true;
      fastFalling = false;

      // Slam effect
      if (fastFalling || dino.vy > 400) {
        spawnParticles(dino.x + dino.w / 2, GROUND_Y, 6, "#aaa");
        playTone(80, 0.15, "sine", 0.12);
      }

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
  const minGap = lerp(300, 180, (effSpeed - BASE_SPEED) / (MAX_SPEED - BASE_SPEED));
  spawnTimer += effSpeed * dt;
  if (spawnTimer > minGap + Math.random() * 200) {
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
function render(dt, { paused }) {
  const biome = BIOMES[biomeIndex];

  // Sky
  ctx.fillStyle = nightMode ? NIGHT_SKY : biome.skyCol;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  // Stars (night only)
  if (nightMode) {
    for (const s of stars) {
      const alpha = 0.4 + Math.sin(s.blink) * 0.4;
      ctx.fillStyle = `rgba(200,220,255,${alpha})`;
      ctx.fillRect(s.x, s.y, s.size, s.size);
    }
  }

  // Clouds
  ctx.fillStyle = nightMode ? "#112244" : biome.cloudCol;
  for (const c of clouds) {
    ctx.beginPath();
    ctx.ellipse(c.x + c.w / 2, c.y + c.h / 2, c.w / 2, c.h / 2, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Ground
  const groundCol = nightMode ? "#0e1030" : biome.groundCol;
  ctx.fillStyle = groundCol;
  ctx.fillRect(0, GROUND_Y, CANVAS_W, CANVAS_H - GROUND_Y);

  // Ground line
  ctx.strokeStyle = nightMode ? NIGHT_FG : biome.obstCol;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, GROUND_Y);
  ctx.lineTo(CANVAS_W, GROUND_Y);
  ctx.stroke();

  // Ground texture (dashes)
  ctx.lineWidth = 1;
  ctx.strokeStyle = nightMode ? "rgba(127,219,202,0.3)" : "rgba(0,0,0,0.15)";
  for (let gx = -groundOffset; gx < CANVAS_W; gx += 24) {
    const len = 4 + Math.sin(gx * 0.3) * 3;
    ctx.beginPath();
    ctx.moveTo(gx, GROUND_Y + 8 + Math.sin(gx * 0.1) * 4);
    ctx.lineTo(gx + len, GROUND_Y + 8 + Math.sin(gx * 0.1) * 4);
    ctx.stroke();
  }

  // Obstacles
  const obsColor = nightMode ? NIGHT_FG : biome.obstCol;
  for (const obs of obstacles) {
    drawObstacle(obs, obsColor);
  }

  // Coins
  for (const c of coins) {
    const coinY = c.y + Math.sin(c.bobPhase) * 6;
    ctx.fillStyle = nightMode ? "#ffcc44" : "#daa520";
    ctx.fillRect(c.x + 2, coinY + 2, 12, 12);
    ctx.strokeStyle = nightMode ? "#ffee88" : "#b8860b";
    ctx.lineWidth = 1;
    ctx.strokeRect(c.x + 2, coinY + 2, 12, 12);
    // Dollar sign
    ctx.fillStyle = nightMode ? "#0a0a2e" : "#fff";
    ctx.font = "8px monospace";
    ctx.textAlign = "center";
    ctx.fillText("$", c.x + 8, coinY + 12);
  }

  // Dino
  if (state !== STATES.IDLE || true) {
    drawDino(obsColor);
  }

  // Shield indicator
  if (shieldActive) {
    ctx.strokeStyle = "rgba(0,255,204,0.5)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(dino.x + dino.w / 2, dino.y + dino.h / 2, 30, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Phase shift indicator
  if (phaseShiftTimer > 0) {
    ctx.globalAlpha = 0.4 + Math.sin(performance.now() * 0.01) * 0.2;
    ctx.strokeStyle = "#00ffcc";
    ctx.lineWidth = 1;
    ctx.strokeRect(dino.x - 4, dino.y - 4, dino.w + 8, dino.h + 8);
    ctx.globalAlpha = 1;
  }

  // Particles
  for (const p of particles) {
    ctx.globalAlpha = clamp(p.life / 0.3, 0, 1);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x, p.y, p.size, p.size);
  }
  ctx.globalAlpha = 1;

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
  }
}

// ─── Draw Helpers ───
function drawDino(color) {
  ctx.fillStyle = color;

  if (dino.ducking) {
    // Ducking dino: wider and shorter (60x28)
    const x = dino.x, y = dino.y;
    // Body
    ctx.fillRect(x + 4, y + 4, 48, 16);
    // Head
    ctx.fillRect(x + 40, y, 16, 12);
    // Eye
    ctx.fillStyle = nightMode ? NIGHT_SKY : "#fafafa";
    ctx.fillRect(x + 50, y + 2, 4, 4);
    ctx.fillStyle = color;
    // Legs
    ctx.fillRect(x + 10, y + 20, 6, 8);
    ctx.fillRect(x + 28, y + 20, 6, 8);
  } else {
    // Standing dino: 44x48
    const x = dino.x, y = dino.y;
    // Head
    ctx.fillRect(x + 12, y, 28, 14);
    // Eye
    ctx.fillStyle = nightMode ? NIGHT_SKY : "#fafafa";
    ctx.fillRect(x + 32, y + 3, 5, 5);
    ctx.fillStyle = color;
    // Body
    ctx.fillRect(x + 6, y + 14, 32, 20);
    // Tail
    ctx.fillRect(x, y + 16, 8, 8);
    // Arms
    ctx.fillRect(x + 32, y + 20, 10, 4);
    // Legs (animated)
    if (dino.grounded) {
      if (dino.legFrame < 2) {
        ctx.fillRect(x + 10, y + 34, 8, 14);
        ctx.fillRect(x + 24, y + 34, 8, 10);
      } else {
        ctx.fillRect(x + 10, y + 34, 8, 10);
        ctx.fillRect(x + 24, y + 34, 8, 14);
      }
    } else {
      // In air: legs together
      ctx.fillRect(x + 12, y + 34, 8, 12);
      ctx.fillRect(x + 22, y + 34, 8, 12);
    }
  }
}

function drawObstacle(obs, color) {
  ctx.fillStyle = color;

  switch (obs.type) {
    case "cactusSmall": {
      const x = obs.x, y = obs.y;
      // Trunk
      ctx.fillRect(x + 6, y, 8, 30);
      // Left arm
      ctx.fillRect(x, y + 8, 8, 4);
      ctx.fillRect(x, y + 8, 4, 12);
      // Right arm
      ctx.fillRect(x + 14, y + 6, 8, 4);
      ctx.fillRect(x + 18, y + 6, 4, 14);
      break;
    }
    case "cactusTall": {
      const x = obs.x, y = obs.y;
      // Crown
      ctx.fillRect(x + 2, y, 16, 6);
      // Trunk
      ctx.fillRect(x + 5, y + 6, 10, 38);
      // Base
      ctx.fillRect(x + 2, y + 42, 16, 8);
      break;
    }
    case "cactusTriple": {
      const x = obs.x, y = obs.y;
      // Three cacti
      ctx.fillRect(x + 2, y + 8, 8, 27);
      ctx.fillRect(x - 2, y + 16, 6, 4);
      ctx.fillRect(x + 20, y + 2, 8, 33);
      ctx.fillRect(x + 16, y + 10, 6, 4);
      ctx.fillRect(x + 38, y + 10, 8, 25);
      ctx.fillRect(x + 44, y + 18, 6, 4);
      break;
    }
    case "ptero": {
      const x = obs.x, y = obs.y;
      const wingY = Math.sin(performance.now() * 0.008) * 6;
      // Body
      ctx.fillRect(x + 16, y + 10, 16, 10);
      // Head/beak
      ctx.fillRect(x + 32, y + 12, 14, 5);
      // Left wing
      ctx.fillRect(x + 2, y + wingY, 14, 8);
      // Right wing
      ctx.fillRect(x + 32, y + wingY, 14, 8);
      // Tail
      ctx.fillRect(x + 4, y + 16, 10, 5);
      break;
    }
  }
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

const loop = createGameLoop({
  update,
  render,
  canvas,
  targetFps: 60,
  onPause: (p) => {
    if (state === STATES.RUNNING && p) {
      // Paused
    }
  },
});

loop.start();
