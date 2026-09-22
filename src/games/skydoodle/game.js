/**
 * SKYDOODLE — Retro Endless Vertical Climber Engine
 * Features:
 * - Automatic landing bounce physics (no jump button)
 * - Mobile DeviceOrientation tilt controls with zero calibration & low-pass jitter filter
 * - Desktop Arrow/WASD steering + Spacebar shooting
 * - 6 Platform types: Static, Moving, Breakable, Disappearing, Spike, Blast
 * - 6 Power-ups: Spring, Trampoline, Propeller Hat, Jetpack, Shield (stacks), Repellent
 * - Enemies: Monsters (head stomp or shoot), UFOs (abduction), Black Holes (gravitational vortex)
 * - Fair-spawn protection rules (never near springs, safe zones after enemy clusters)
 * - Multi-tier visual themes & progressive Web Audio chiptune synthesizer
 * - Left-edge ghost markers for personal best heights
 */

import { initShell, escapeHtml, toast } from "/shared/shell.js";
import { createGameLoop, clamp, lerp } from "/src/core/engine.js";
import { playTone, playLaser, playExplosion, sfx } from "/src/core/audio.js";
import { saveGameScore, loadGameScore } from "/src/core/save.js";

initShell({ crumb: "SkyDoodle" });

const canvas = document.getElementById("sd-canvas");
const ctx = canvas.getContext("2d");
const container = document.getElementById("sd-container");

// Game Dimensions
const W = 480;
const H = 720;
canvas.width = W;
canvas.height = H;

// Audio & Music Variables
let musicTimer = 0;
let musicStep = 0;
const BASS_NOTES = [110, 130.8, 146.8, 164.8, 130.8, 110, 98, 110];
const LEAD_NOTES = [220, 261.6, 293.7, 329.6, 392.0, 329.6, 293.7, 261.6];
const ARPEGGIO_NOTES = [440, 523.3, 587.3, 659.3, 783.9, 659.3, 587.3, 523.3];
const SPACE_NOTES = [880, 1046.5, 1174.7, 1318.5, 1046.5];

// Physics Constants
const GRAVITY = 1350;
const BOUNCE_SPEED = -620;
const SPRING_BOUNCE = -980;
const TRAMPOLINE_BOUNCE = -1350;
const MAX_FALL_SPEED = 900;
const BASE_STEER_SPEED = 460;
const JETPACK_STEER_SPEED = 820;

// Game State
let gameState = "PLAYING"; // "CALIBRATING", "PLAYING", "GAMEOVER"
let cameraY = 0;
let maxCameraY = 0;
let score = 0;
let monstersSquashed = 0;
let highScore = 0;

// Tilt Sensor Variables
let neutralGamma = 0;
let rawGamma = 0;
let smoothedGamma = 0;
const TILT_SMOOTH_ALPHA = 0.2;
const TILT_DEADZONE = 3.0; // degrees
const TILT_MAX_ANGLE = 25.0; // degrees
let gyroActive = false;
let touchSteerLeft = false;
let touchSteerRight = false;

// Player Entity
const player = {
  x: W / 2,
  y: 120,
  vx: 0,
  vy: BOUNCE_SPEED,
  width: 32,
  height: 34,
  facingLeft: false,
  powerups: {
    propeller: 0,
    jetpack: 0,
    shield: 0,
    repellent: 0,
  },
  hasShield() {
    return this.powerups.shield > 0;
  }
};

// World Entities
let platforms = [];
let projectiles = [];
let enemies = [];
let particles = [];
let ghostMarkers = [];
let nextPlatformY = 80;
let lastPlatformX = W / 2 - 40;
let lastPlatformType = "static";
let lastEnemySpawnY = 0;
let safeZonePadsRemaining = 0;

// Key state
const keys = {
  left: false,
  right: false,
  shoot: false,
};

// High Score & Ghost initialization
const prevScoreRec = loadGameScore("skydoodle");
if (prevScoreRec && typeof prevScoreRec.score === "number") {
  highScore = prevScoreRec.score;
  ghostMarkers.push({ score: highScore, label: "PB" });
}

// -------------------------------------------------------------
// INPUT & ORIENTATION SENSORS
// -------------------------------------------------------------

window.addEventListener("keydown", (e) => {
  if (e.code === "ArrowLeft" || e.code === "KeyA") keys.left = true;
  if (e.code === "ArrowRight" || e.code === "KeyD") keys.right = true;
  if (e.code === "Space") {
    e.preventDefault();
    if (gameState === "GAMEOVER") {
      restartGame();
    } else {
      shootProjectile();
    }
  }
});

window.addEventListener("keyup", (e) => {
  if (e.code === "ArrowLeft" || e.code === "KeyA") keys.left = false;
  if (e.code === "ArrowRight" || e.code === "KeyD") keys.right = false;
});

// Device Orientation Handling
function handleOrientation(e) {
  if (e.gamma !== null && e.gamma !== undefined) {
    rawGamma = e.gamma;
    gyroActive = true;
    updateTiltBubble(rawGamma - neutralGamma);
  }
}

function updateTiltBubble(diff) {
  const bubble = document.getElementById("tilt-bubble");
  if (bubble) {
    const clamped = clamp(diff, -25, 25);
    const pct = 50 + (clamped / 25) * 40;
    bubble.style.left = `${pct}%`;
  }
}

// iOS 13+ permission flow
const modalPerm = document.getElementById("modal-permission");
const modalCalib = document.getElementById("modal-calibrate");

function checkGyroSupport() {
  if (typeof DeviceOrientationEvent !== "undefined") {
    if (typeof DeviceOrientationEvent.requestPermission === "function") {
      // iOS requires explicit permission
      modalPerm.hidden = false;
    } else {
      window.addEventListener("deviceorientation", handleOrientation);
      // Show calibration on mobile touches
      if (window.matchMedia("(max-width: 820px)").matches) {
        modalCalib.hidden = false;
        gameState = "CALIBRATING";
      }
    }
  }
}

document.getElementById("btn-enable-tilt")?.addEventListener("click", async () => {
  try {
    const res = await DeviceOrientationEvent.requestPermission();
    if (res === "granted") {
      window.addEventListener("deviceorientation", handleOrientation);
      modalPerm.hidden = true;
      modalCalib.hidden = false;
      gameState = "CALIBRATING";
    } else {
      modalPerm.hidden = true;
    }
  } catch {
    modalPerm.hidden = true;
  }
});

document.getElementById("btn-cancel-permission")?.addEventListener("click", () => {
  modalPerm.hidden = true;
});

document.getElementById("btn-set-zero")?.addEventListener("click", () => {
  neutralGamma = rawGamma;
  modalCalib.hidden = true;
  gameState = "PLAYING";
  toast({ title: "GYRO CALIBRATED", body: "Tilt left & right to climb!" });
});

document.getElementById("btn-skip-gyro")?.addEventListener("click", () => {
  modalCalib.hidden = true;
  gameState = "PLAYING";
});

// Touch Fallback & Tap to Shoot
const leftZone = document.getElementById("touch-left");
const rightZone = document.getElementById("touch-right");

leftZone?.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  touchSteerLeft = true;
  leftZone.classList.add("active");
  shootProjectile();
});
leftZone?.addEventListener("pointerup", () => {
  touchSteerLeft = false;
  leftZone.classList.remove("active");
});
leftZone?.addEventListener("pointerleave", () => {
  touchSteerLeft = false;
  leftZone.classList.remove("active");
});

rightZone?.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  touchSteerRight = true;
  rightZone.classList.add("active");
  shootProjectile();
});
rightZone?.addEventListener("pointerup", () => {
  touchSteerRight = false;
  rightZone.classList.remove("active");
});
rightZone?.addEventListener("pointerleave", () => {
  touchSteerRight = false;
  rightZone.classList.remove("active");
});

canvas.addEventListener("pointerdown", (e) => {
  if (gameState === "PLAYING") {
    shootProjectile();
  }
});

document.getElementById("btn-restart")?.addEventListener("click", restartGame);

// -------------------------------------------------------------
// GAME GENERATION & FAIR SPAWNING
// -------------------------------------------------------------

function resetWorld() {
  cameraY = 0;
  maxCameraY = 0;
  score = 0;
  monstersSquashed = 0;
  platforms = [];
  projectiles = [];
  enemies = [];
  particles = [];
  nextPlatformY = 40;
  lastEnemySpawnY = 0;
  safeZonePadsRemaining = 0;
  lastPlatformX = W / 2 - 40;
  lastPlatformType = "static";

  // Base platform directly under player
  platforms.push({
    id: 1,
    x: W / 2 - 40,
    y: 30,
    width: 86,
    height: 14,
    type: "static",
    spring: false,
    trampoline: false,
  });

  // Generate initial world
  for (let i = 0; i < 18; i++) {
    spawnNextPlatform();
  }

  player.x = W / 2;
  player.y = 120;
  player.vx = 0;
  player.vy = BOUNCE_SPEED;
  player.squash = 1.0;
  player.powerups.propeller = 0;
  player.powerups.jetpack = 0;
  player.powerups.shield = 0;
  player.powerups.repellent = 0;
}

function spawnNextPlatform() {
  const y = nextPlatformY;
  const currentHeight = Math.floor(y);
  const tier = getProgressionTier(currentHeight);

  // Platform vertical gap: bounded comfortably within max jump apex (142px)
  const gap = 48 + Math.min(42, Math.floor(currentHeight / 350) * 4);
  nextPlatformY += gap;

  // Choose platform type with reachability and fairness guarantees
  let type = "static";
  const r = Math.random();

  // If previous platform was hazardous/breakable, guarantee a solid landing spot now
  const prevWasHazard = lastPlatformType === "breakable" || lastPlatformType === "spike" || lastPlatformType === "blast";

  if (!prevWasHazard) {
    if (currentHeight > 300 && r < 0.25) {
      type = "moving";
    } else if (currentHeight > 500 && r < 0.38) {
      type = "breakable";
    } else if (currentHeight > 850 && r < 0.50) {
      type = "blast";
    } else if (currentHeight > 1400 && r < 0.62) {
      type = "disappearing";
    } else if (currentHeight > 1800 && r < 0.70) {
      type = "spike";
    }
  } else {
    // 50% static, 50% moving for reliable rescue landing
    type = r < 0.5 ? "static" : "moving";
  }

  const width = type === "breakable" ? 68 : 76;

  // Controlled horizontal step: bounds delta-x to comfortable jumping reach
  const maxStep = 150;
  const deltaX = (Math.random() * 2 - 1) * maxStep;
  let targetX = lastPlatformX + deltaX;
  if (targetX < 24) targetX += (W - width - 48);
  if (targetX > W - width - 24) targetX -= (W - width - 48);
  const x = clamp(Math.floor(targetX), 24, W - width - 24);

  lastPlatformX = x;
  lastPlatformType = type;

  const platform = {
    id: Math.random(),
    x,
    y,
    width,
    height: 14,
    type,
    vx: (Math.random() > 0.5 ? 1 : -1) * (110 + Math.min(120, currentHeight / 50)),
    oscillationOrigin: x,
    broken: false,
    fadeAlpha: 1.0,
    fadeActive: false,
    blastTimer: null,
    hasSpring: false,
    hasTrampoline: false,
    hasPowerup: null,
  };

  // Power-up chance on safe platforms
  let hasBoostDevice = false;
  if (type === "static" || type === "moving") {
    const powR = Math.random();
    if (powR < 0.08) {
      platform.hasSpring = true;
      hasBoostDevice = true;
    } else if (powR < 0.12) {
      platform.hasTrampoline = true;
      hasBoostDevice = true;
    } else if (powR < 0.15) {
      platform.hasPowerup = "shield";
    } else if (powR < 0.17) {
      platform.hasPowerup = "propeller";
    } else if (powR < 0.19) {
      platform.hasPowerup = "jetpack";
    } else if (powR < 0.21) {
      platform.hasPowerup = "repellent";
    }
  }

  platforms.push(platform);

  // FAIR SPAWN RULES:
  // 1. Enemies NEVER spawn near a spring or trampoline
  // 2. Enforce safe zones after an enemy spawn
  if (safeZonePadsRemaining > 0) {
    safeZonePadsRemaining--;
    return;
  }

  if (!hasBoostDevice && currentHeight > 250 && y - lastEnemySpawnY > 220) {
    const enemyChance = Math.min(0.32, 0.10 + currentHeight / 6000);
    if (Math.random() < enemyChance) {
      spawnEnemy(x + width / 2, y + 54, currentHeight);
      lastEnemySpawnY = y;
      safeZonePadsRemaining = 2; // Guarantee 2 safe platforms after enemy
    }
  }
}

function spawnEnemy(x, y, height) {
  const r = Math.random();
  let type = "monster";
  if (height > 1000 && r < 0.28) {
    type = "ufo";
  } else if (height > 1500 && r < 0.48) {
    type = "blackhole";
  }

  enemies.push({
    id: Math.random(),
    x: clamp(x, 40, W - 40),
    y,
    type,
    width: type === "ufo" ? 44 : (type === "blackhole" ? 36 : 38),
    height: type === "ufo" ? 24 : (type === "blackhole" ? 36 : 32),
    vx: type === "monster" ? (Math.random() > 0.5 ? 60 : -60) : (type === "ufo" ? 90 : 0),
    alive: true,
    bobTimer: Math.random() * Math.PI * 2,
  });
}

function shootProjectile() {
  if (gameState !== "PLAYING") return;
  projectiles.push({
    x: player.x,
    y: player.y + player.height / 2,
    vy: -1150,
    radius: 4,
  });
  playLaser({ startFreq: 750, endFreq: 1400, duration: 0.08, type: "square" });
}

function getProgressionTier(h) {
  if (h < 300) return "NOTEBOOK";
  if (h < 800) return "SKY";
  if (h < 1400) return "SUNSET";
  if (h < 2000) return "NIGHT";
  return "SPACE";
}

// -------------------------------------------------------------
// GAME LOOP (UPDATE & RENDER)
// -------------------------------------------------------------

function update(dt) {
  if (gameState !== "PLAYING") return;

  // Power-up Timers
  if (player.powerups.propeller > 0) {
    player.powerups.propeller -= dt;
    player.vy = -520;
    if (Math.random() < 0.3) {
      createSpark(player.x, player.y - 10, "#38bdf8");
    }
  }

  if (player.powerups.jetpack > 0) {
    player.powerups.jetpack -= dt;
    player.vy = -860;
    createSpark(player.x - 6, player.y - 14, "#ff7700");
    createSpark(player.x + 6, player.y - 14, "#ffdd00");
  }

  if (player.powerups.shield > 0) {
    player.powerups.shield -= dt;
  }

  if (player.powerups.repellent > 0) {
    player.powerups.repellent -= dt;
    // Clear all enemies while repellent is active
    enemies.forEach(e => {
      if (e.alive) {
        e.alive = false;
        createBurst(e.x, e.y, "#39ff14", 8);
      }
    });
  }

  // Horizontal Steering
  let moveDir = 0;
  if (keys.left || touchSteerLeft) moveDir -= 1;
  if (keys.right || touchSteerRight) moveDir += 1;

  // Apply tilt if available
  if (gyroActive) {
    const rawDiff = rawGamma - neutralGamma;
    smoothedGamma = smoothedGamma * (1 - TILT_SMOOTH_ALPHA) + rawDiff * TILT_SMOOTH_ALPHA;
    if (Math.abs(smoothedGamma) > TILT_DEADZONE) {
      const tiltNorm = clamp((Math.abs(smoothedGamma) - TILT_DEADZONE) / (TILT_MAX_ANGLE - TILT_DEADZONE), 0, 1);
      const tiltDir = Math.sign(smoothedGamma);
      moveDir = tiltDir * tiltNorm;
    }
  }

  const speed = player.powerups.jetpack > 0 ? JETPACK_STEER_SPEED : BASE_STEER_SPEED;
  const targetVx = moveDir * speed;
  const steerResponsiveness = moveDir !== 0 ? 16.0 : 11.0;
  player.vx = lerp(player.vx, targetVx, 1 - Math.exp(-steerResponsiveness * dt));
  player.x += player.vx * dt;

  // Restore squash
  player.squash = lerp(player.squash || 1, 1, 1 - Math.exp(-20 * dt));

  if (moveDir < -0.1) player.facingLeft = true;
  if (moveDir > 0.1) player.facingLeft = false;

  // Screen Wrap
  if (player.x < -16) player.x = W + 16;
  if (player.x > W + 16) player.x = -16;

  // Vertical Gravity & Movement
  if (player.powerups.propeller <= 0 && player.powerups.jetpack <= 0) {
    player.vy += GRAVITY * dt;
    if (player.vy > MAX_FALL_SPEED) player.vy = MAX_FALL_SPEED;
  }

  player.y += -player.vy * dt; // In our coordinate system, higher y = higher altitude

  // Camera upward follow with smooth interpolation
  const targetCam = player.y - H * 0.45;
  if (targetCam > cameraY) {
    cameraY = Math.max(cameraY, lerp(cameraY, targetCam, 1 - Math.exp(-24 * dt)));
  }
  if (cameraY > maxCameraY) {
    maxCameraY = cameraY;
    score = Math.floor(maxCameraY);
  }

  // Fall off bottom check
  if (player.y < cameraY - 40) {
    triggerGameOver("FELL INTO THE VOID");
    return;
  }

  // Update Platforms
  platforms.forEach((p) => {
    // Moving platforms
    if (p.type === "moving") {
      p.x += p.vx * dt;
      if (p.x < 10) {
        p.x = 10;
        p.vx = Math.abs(p.vx);
      } else if (p.x + p.width > W - 10) {
        p.x = W - 10 - p.width;
        p.vx = -Math.abs(p.vx);
      }
    }

    // Breakable falling
    if (p.broken) {
      p.y -= 500 * dt;
    }

    // Disappearing fade
    if (p.fadeActive) {
      p.fadeAlpha -= dt;
      if (p.fadeAlpha <= 0) p.broken = true;
    }

    // Blast platform countdown
    if (p.blastTimer !== null) {
      p.blastTimer -= dt;
      if (p.blastTimer <= 0) {
        createBurst(p.x + p.width / 2, p.y, "#ff2233", 16);
        playExplosion({ duration: 0.35, lowpass: 420 });
        p.broken = true;
        // Check if player is caught in detonation
        if (Math.hypot(player.x - (p.x + p.width / 2), player.y - p.y) < 65) {
          if (player.hasShield()) {
            player.powerups.shield = 0;
            createBurst(player.x, player.y, "#00f0ff", 14);
          } else {
            triggerGameOver("BLAST PLATFORM DETONATION");
          }
        }
      }
    }

    // Platform Landing Collisions (Only when falling down)
    if (player.vy > 0 && !p.broken && (!p.fadeActive || p.fadeAlpha > 0.2)) {
      const feetY = player.y - player.height / 2;
      const prevFeetY = feetY + player.vy * dt;
      const padTop = p.y + p.height / 2;
      const marginH = 6;

      if (
        player.x + player.width / 2 >= p.x - marginH &&
        player.x - player.width / 2 <= p.x + p.width + marginH &&
        prevFeetY >= padTop - 8 &&
        feetY <= padTop + 14
      ) {
        player.y = padTop + player.height / 2;
        player.squash = 0.72; // Tactile bounce deformation!
        // Landed on platform!
        if (p.type === "spike") {
          if (player.hasShield()) {
            player.powerups.shield = 0;
            player.vy = BOUNCE_SPEED;
            createBurst(player.x, player.y, "#00f0ff", 12);
          } else {
            triggerGameOver("IMPALED ON SPIKES");
            return;
          }
        } else if (p.type === "breakable") {
          p.broken = true;
          playTone(160, 0.08, "triangle", 0.3);
          createBurst(p.x + p.width / 2, p.y, "#8b5a2b", 6);
          player.vy = BOUNCE_SPEED * 0.75;
        } else {
          // Standard / Moving / Disappearing / Blast bounce
          if (p.type === "disappearing") p.fadeActive = true;
          if (p.type === "blast" && p.blastTimer === null) p.blastTimer = 0.8;

          // Check Spring / Trampoline / Powerup
          if (p.hasSpring) {
            const centerDist = (player.x - (p.x + p.width / 2)) / (p.width / 2);
            player.vy = SPRING_BOUNCE;
            player.vx += centerDist * 220; // Off-center throw penalty
            playTone(880, 0.18, "square", 0.4);
            createBurst(p.x + p.width / 2, p.y + 12, "#ffd700", 8);
          } else if (p.hasTrampoline) {
            player.vy = TRAMPOLINE_BOUNCE;
            playLaser({ startFreq: 400, endFreq: 1100, duration: 0.2 });
            createBurst(p.x + p.width / 2, p.y + 12, "#ff007f", 12);
          } else {
            // Normal landing bounce
            player.vy = BOUNCE_SPEED;
            if (p.type === "moving") {
              player.vx += p.vx * 0.4; // Slingshot momentum transfer!
            }
            playTone(480, 0.08, "sine", 0.25);
          }

          // Pick up floating powerup if present
          if (p.hasPowerup) {
            activatePowerup(p.hasPowerup);
            p.hasPowerup = null;
          }
        }
      }
    }
  });

  // Recycle platforms below viewport
  platforms = platforms.filter(p => p.y > cameraY - 120);
  while (nextPlatformY < cameraY + H + 80) {
    spawnNextPlatform();
  }

  // Update Projectiles
  projectiles.forEach(pr => {
    pr.y += -pr.vy * dt;
  });
  projectiles = projectiles.filter(pr => pr.y < cameraY + H + 40);

  // Update Enemies
  enemies.forEach(e => {
    if (!e.alive) return;

    if (e.type === "monster") {
      e.x += e.vx * dt;
      if (e.x < 30 || e.x > W - 30) e.vx = -e.vx;
    } else if (e.type === "ufo") {
      e.x += e.vx * dt;
      if (e.x < 40 || e.x > W - 40) e.vx = -e.vx;
      // UFO tractor beam checks
      if (Math.abs(player.x - e.x) < 24 && player.y < e.y && player.y > e.y - 180) {
        if (!player.hasShield()) {
          triggerGameOver("ABDUCTED BY UFO");
          return;
        }
      }
    } else if (e.type === "blackhole") {
      // Gravitational pull
      const dx = e.x - player.x;
      const dy = e.y - player.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 150) {
        const force = (150 - dist) * 12;
        player.x += (dx / dist) * force * dt;
        player.y += (dy / dist) * force * dt;
        if (dist < 18) {
          triggerGameOver("SUCKED INTO BLACK HOLE");
          return;
        }
      }
    }

    // Bullet vs Enemy collision
    projectiles.forEach(pr => {
      if (e.alive && Math.hypot(pr.x - e.x, pr.y - e.y) < e.width / 2 + pr.radius) {
        e.alive = false;
        pr.y = 999999; // destroy bullet
        createBurst(e.x, e.y, "#ff3333", 14);
        playExplosion({ duration: 0.25, lowpass: 500 });
        score += 50;
        monstersSquashed++;
      }
    });

    // Player vs Enemy Collision
    if (e.alive && e.type !== "blackhole") {
      const dx = Math.abs(player.x - e.x);
      const dy = player.y - e.y;

      if (dx < (player.width + e.width) / 2 - 4 && Math.abs(dy) < (player.height + e.height) / 2 - 4) {
        // Head stomp condition (falling down and landing on top of head)
        if (player.vy > 0 && dy > 6 && e.type === "monster") {
          e.alive = false;
          player.vy = BOUNCE_SPEED * 1.1;
          createBurst(e.x, e.y, "#22c55e", 10);
          playTone(280, 0.15, "triangle", 0.4);
          score += 50;
          monstersSquashed++;
        } else {
          // Side or bottom contact
          if (player.hasShield()) {
            player.powerups.shield = 0;
            e.alive = false;
            createBurst(e.x, e.y, "#00f0ff", 14);
            playExplosion({ duration: 0.2 });
          } else {
            triggerGameOver(e.type === "ufo" ? "CRASHED INTO UFO" : "MAULED BY MONSTER");
          }
        }
      }
    }
  });

  // Clean up despawned enemies
  enemies = enemies.filter(e => e.y > cameraY - 140);

  // Update Particles
  particles.forEach(p => {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
  });
  particles = particles.filter(p => p.life > 0);

  // Update Chiptune Synth Progression
  updateChiptuneMusic(dt);

  // Update UI HUD
  document.getElementById("hud-score").textContent = `${score.toString().padStart(4, "0")} M`;
  document.getElementById("hud-tier").textContent = getProgressionTier(score);
  document.getElementById("hud-best").textContent = `${Math.max(score, highScore).toString().padStart(4, "0")} M`;

  // Render Powerup Badges
  renderPowerupBadges();
}

function activatePowerup(type) {
  if (type === "shield") {
    // Shield stacks with other powerups!
    player.powerups.shield = 8.0;
    playTone(620, 0.2, "sine", 0.3);
    toast({ title: "ENERGY SHIELD ON", body: "Absorbs 1 lethal contact hit!" });
  } else if (type === "propeller") {
    player.powerups.propeller = 4.0;
    player.powerups.jetpack = 0;
    playTone(720, 0.25, "sawtooth", 0.3);
  } else if (type === "jetpack") {
    player.powerups.jetpack = 3.0;
    player.powerups.propeller = 0;
    playLaser({ startFreq: 300, endFreq: 900, duration: 0.3 });
  } else if (type === "repellent") {
    player.powerups.repellent = 5.0;
    playTone(940, 0.3, "square", 0.35);
    toast({ title: "MONSTER REPELLENT", body: "All airspace cleared for 5s!" });
  }
}

function renderPowerupBadges() {
  const host = document.getElementById("sd-powerups-hud");
  if (!host) return;

  const badges = [];
  if (player.powerups.shield > 0) badges.push(`🛡️ SHIELD ${player.powerups.shield.toFixed(1)}s`);
  if (player.powerups.jetpack > 0) badges.push(`🚀 JETPACK ${player.powerups.jetpack.toFixed(1)}s`);
  if (player.powerups.propeller > 0) badges.push(`🧢 PROPELLER ${player.powerups.propeller.toFixed(1)}s`);
  if (player.powerups.repellent > 0) badges.push(`✨ REPEL ${player.powerups.repellent.toFixed(1)}s`);

  host.innerHTML = badges.map(b => `<div class="powerup-badge">${b}</div>`).join("");
}

// -------------------------------------------------------------
// CHIPTUNE SOUNDTRACK PROGRESSION
// -------------------------------------------------------------

function updateChiptuneMusic(dt) {
  musicTimer += dt;
  if (musicTimer >= 0.22) {
    musicTimer = 0;
    musicStep = (musicStep + 1) % 8;

    const tier = getProgressionTier(score);

    // Layer 1: Bass note (all tiers)
    playTone(BASS_NOTES[musicStep], 0.08, "triangle", 0.08);

    // Layer 2: Lead melody (Tier Sky+)
    if (tier !== "NOTEBOOK") {
      playTone(LEAD_NOTES[musicStep], 0.09, "square", 0.06);
    }

    // Layer 3: Counter Arpeggio (Tier Sunset+)
    if (tier === "SUNSET" || tier === "NIGHT" || tier === "SPACE") {
      playTone(ARPEGGIO_NOTES[(musicStep * 2) % 8], 0.06, "sawtooth", 0.04);
    }

    // Layer 4: Deep Space Lead (Tier Night & Space)
    if (tier === "SPACE") {
      playTone(SPACE_NOTES[musicStep % 5], 0.12, "sine", 0.07);
    }
  }
}

// -------------------------------------------------------------
// RENDERING
// -------------------------------------------------------------

function render() {
  ctx.clearRect(0, 0, W, H);

  // Background Theme by Progression Tier
  const tier = getProgressionTier(score);
  renderBackgroundTheme(tier);

  // Ghost High Score Markers
  renderGhostMarkers();

  // Draw Platforms
  platforms.forEach(p => {
    const screenY = H - (p.y - cameraY);
    if (screenY < -30 || screenY > H + 30) return;

    ctx.save();
    if (p.fadeActive) {
      ctx.globalAlpha = clamp(p.fadeAlpha, 0, 1);
    }

    // Platform Body
    if (p.type === "static") {
      ctx.fillStyle = "#22c55e";
      ctx.strokeStyle = "#15803d";
      ctx.lineWidth = 2;
      roundRect(ctx, p.x, screenY - p.height / 2, p.width, p.height, 4, true, true);
    } else if (p.type === "moving") {
      ctx.fillStyle = "#3b82f6";
      ctx.strokeStyle = "#1d4ed8";
      ctx.lineWidth = 2;
      roundRect(ctx, p.x, screenY - p.height / 2, p.width, p.height, 4, true, true);
    } else if (p.type === "breakable") {
      ctx.fillStyle = "#a16207";
      ctx.strokeStyle = "#713f12";
      ctx.lineWidth = 2;
      roundRect(ctx, p.x, screenY - p.height / 2, p.width, p.height, 3, true, true);
      // Crack lines
      ctx.strokeStyle = "#451a03";
      ctx.beginPath();
      ctx.moveTo(p.x + 10, screenY - 4);
      ctx.lineTo(p.x + 24, screenY + 4);
      ctx.lineTo(p.x + 36, screenY - 2);
      ctx.stroke();
    } else if (p.type === "disappearing") {
      ctx.fillStyle = "#a855f7";
      ctx.strokeStyle = "#7e22ce";
      ctx.lineWidth = 2;
      roundRect(ctx, p.x, screenY - p.height / 2, p.width, p.height, 4, true, true);
    } else if (p.type === "spike") {
      ctx.fillStyle = "#64748b";
      ctx.fillRect(p.x, screenY, p.width, p.height / 2);
      // Spike teeth
      ctx.fillStyle = "#e2e8f0";
      for (let sx = p.x; sx < p.x + p.width - 6; sx += 10) {
        ctx.beginPath();
        ctx.moveTo(sx, screenY);
        ctx.lineTo(sx + 5, screenY - 8);
        ctx.lineTo(sx + 10, screenY);
        ctx.fill();
      }
    } else if (p.type === "blast") {
      ctx.fillStyle = p.blastTimer !== null ? (Math.floor(Date.now() / 100) % 2 ? "#ff0000" : "#ffffff") : "#ef4444";
      ctx.strokeStyle = "#991b1b";
      ctx.lineWidth = 2;
      roundRect(ctx, p.x, screenY - p.height / 2, p.width, p.height, 4, true, true);
      // TNT text
      ctx.fillStyle = "#fff";
      ctx.font = '8px "Press Start 2P", monospace';
      ctx.fillText("TNT", p.x + p.width / 2 - 10, screenY + 3);
    }

    // Draw Spring or Trampoline
    if (p.hasSpring) {
      ctx.strokeStyle = "#f59e0b";
      ctx.lineWidth = 2;
      ctx.beginPath();
      const sx = p.x + p.width / 2;
      const sy = screenY - p.height / 2;
      ctx.moveTo(sx - 6, sy);
      ctx.lineTo(sx + 6, sy - 3);
      ctx.lineTo(sx - 6, sy - 6);
      ctx.lineTo(sx + 6, sy - 9);
      ctx.stroke();
    } else if (p.hasTrampoline) {
      ctx.fillStyle = "#ec4899";
      const sx = p.x + p.width / 2;
      const sy = screenY - p.height / 2;
      ctx.fillRect(sx - 14, sy - 4, 28, 4);
      ctx.fillStyle = "#475569";
      ctx.fillRect(sx - 12, sy, 4, 4);
      ctx.fillRect(sx + 8, sy, 4, 4);
    } else if (p.hasPowerup) {
      // Floating powerup badge
      renderPowerupIcon(ctx, p.hasPowerup, p.x + p.width / 2, screenY - 14);
    }

    ctx.restore();
  });

  // Draw Enemies
  enemies.forEach(e => {
    if (!e.alive) return;
    const screenY = H - (e.y - cameraY);

    if (e.type === "monster") {
      // Pixel Monster
      ctx.fillStyle = "#ef4444";
      ctx.fillRect(e.x - 16, screenY - 16, 32, 28);
      // Eyes & Horns
      ctx.fillStyle = "#fff";
      ctx.fillRect(e.x - 10, screenY - 12, 6, 6);
      ctx.fillRect(e.x + 4, screenY - 12, 6, 6);
      ctx.fillStyle = "#000";
      ctx.fillRect(e.x - 8, screenY - 10, 3, 3);
      ctx.fillRect(e.x + 6, screenY - 10, 3, 3);
      ctx.fillStyle = "#ffd700";
      ctx.fillRect(e.x - 14, screenY - 22, 4, 6);
      ctx.fillRect(e.x + 10, screenY - 22, 4, 6);
    } else if (e.type === "ufo") {
      // UFO + Tractor Beam
      ctx.save();
      ctx.fillStyle = "rgba(0, 240, 255, 0.18)";
      ctx.beginPath();
      ctx.moveTo(e.x - 10, screenY + 4);
      ctx.lineTo(e.x + 10, screenY + 4);
      ctx.lineTo(e.x + 36, screenY + 140);
      ctx.lineTo(e.x - 36, screenY + 140);
      ctx.fill();

      // Saucer
      ctx.fillStyle = "#64748b";
      ctx.beginPath();
      ctx.ellipse(e.x, screenY, 22, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#38bdf8";
      ctx.beginPath();
      ctx.ellipse(e.x, screenY - 4, 10, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else if (e.type === "blackhole") {
      // Black hole vortex
      ctx.save();
      ctx.fillStyle = "#020617";
      ctx.beginPath();
      ctx.arc(e.x, screenY, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#a855f7";
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.restore();
    }
  });

  // Draw Projectiles
  ctx.fillStyle = "#eab308";
  projectiles.forEach(pr => {
    const screenY = H - (pr.y - cameraY);
    ctx.beginPath();
    ctx.arc(pr.x, screenY, pr.radius, 0, Math.PI * 2);
    ctx.fill();
  });

  // Draw Particles
  particles.forEach(p => {
    const screenY = H - (p.y - cameraY);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x, screenY, p.size, p.size);
  });

  // Draw Player
  renderPlayer();
}

function renderPlayer() {
  const screenY = H - (player.y - cameraY);
  ctx.save();
  ctx.translate(player.x, screenY);

  const sq = player.squash || 1.0;
  ctx.scale(2 - sq, sq);

  if (player.facingLeft) {
    ctx.scale(-1, 1);
  }

  // Energy Shield Aura
  if (player.hasShield()) {
    ctx.strokeStyle = "#38bdf8";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, 0, 26, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Doodle Character Body
  ctx.fillStyle = "#84cc16";
  ctx.strokeStyle = "#365314";
  ctx.lineWidth = 1.5;
  roundRect(ctx, -14, -14, 28, 26, 6, true, true);

  // Snout
  roundRect(ctx, 10, -8, 10, 8, 3, true, true);

  // Eyes
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(-2, -6, 3, 0, Math.PI * 2);
  ctx.arc(6, -6, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#000000";
  ctx.beginPath();
  ctx.arc(-1, -6, 1.2, 0, Math.PI * 2);
  ctx.arc(7, -6, 1.2, 0, Math.PI * 2);
  ctx.fill();

  // 4 Little Legs
  ctx.fillStyle = "#65a30d";
  ctx.fillRect(-12, 12, 4, 6);
  ctx.fillRect(-5, 12, 4, 5);
  ctx.fillRect(2, 12, 4, 5);
  ctx.fillRect(9, 12, 4, 6);

  // Propeller Hat
  if (player.powerups.propeller > 0) {
    ctx.fillStyle = "#f59e0b";
    ctx.fillRect(-6, -18, 12, 4);
    ctx.fillStyle = "#ef4444";
    const propW = Math.sin(Date.now() / 30) * 16;
    ctx.fillRect(-propW / 2, -22, propW, 3);
  }

  // Jetpack
  if (player.powerups.jetpack > 0) {
    ctx.fillStyle = "#475569";
    ctx.fillRect(-22, -10, 8, 18);
    // Exhaust Flame
    ctx.fillStyle = "#ff7700";
    ctx.fillRect(-20, 8, 4, 8 + Math.random() * 6);
  }

  ctx.restore();
}

function renderBackgroundTheme(tier) {
  if (tier === "NOTEBOOK") {
    ctx.fillStyle = "#060b14";
    ctx.fillRect(0, 0, W, H);
    // Dark blueprint / grid lines
    ctx.strokeStyle = "rgba(56, 189, 248, 0.12)";
    ctx.lineWidth = 1;
    const offset = Math.floor(cameraY % 24);
    for (let y = -offset; y < H; y += 24) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }
    // Red left margin line
    ctx.strokeStyle = "rgba(244, 63, 94, 0.4)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(44, 0);
    ctx.lineTo(44, H);
    ctx.stroke();
  } else if (tier === "SKY") {
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, "#0a192f");
    grad.addColorStop(1, "#172a45");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
    // Fluffy clouds with soft glow
    ctx.fillStyle = "rgba(56, 189, 248, 0.12)";
    ctx.beginPath();
    ctx.arc(80, 140, 28, 0, Math.PI * 2);
    ctx.arc(110, 130, 36, 0, Math.PI * 2);
    ctx.arc(140, 140, 26, 0, Math.PI * 2);
    ctx.fill();
  } else if (tier === "SUNSET") {
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, "#31103f");
    grad.addColorStop(0.6, "#7e22ce");
    grad.addColorStop(1, "#f97316");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
  } else if (tier === "NIGHT") {
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, "#030712");
    grad.addColorStop(1, "#1e1b4b");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
    // Stars
    ctx.fillStyle = "#fff";
    ctx.fillRect(50, 80, 2, 2);
    ctx.fillRect(140, 220, 2, 2);
    ctx.fillRect(360, 140, 2, 2);
    ctx.fillRect(280, 420, 2, 2);
  } else {
    // Deep Space
    ctx.fillStyle = "#02040a";
    ctx.fillRect(0, 0, W, H);
    // Nebulae
    const grad = ctx.createRadialGradient(240, 360, 40, 240, 360, 220);
    grad.addColorStop(0, "rgba(99, 102, 241, 0.2)");
    grad.addColorStop(1, "transparent");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
  }
}

function renderGhostMarkers() {
  ghostMarkers.forEach(g => {
    const screenY = H - (g.score - cameraY);
    if (screenY > 0 && screenY < H) {
      ctx.strokeStyle = "rgba(100, 116, 139, 0.7)";
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(0, screenY);
      ctx.lineTo(W, screenY);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "#94a3b8";
      ctx.font = '8px "Press Start 2P", monospace';
      ctx.fillText(`${g.label} ${g.score}M`, 48, screenY - 4);
    }
  });
}

function renderPowerupIcon(ctx, type, x, y) {
  if (type === "shield") {
    ctx.fillStyle = "#38bdf8";
    ctx.beginPath();
    ctx.arc(x, y, 7, 0, Math.PI * 2);
    ctx.fill();
  } else if (type === "propeller") {
    ctx.fillStyle = "#f59e0b";
    ctx.fillRect(x - 5, y - 4, 10, 8);
  } else if (type === "jetpack") {
    ctx.fillStyle = "#ff7700";
    ctx.fillRect(x - 4, y - 6, 8, 12);
  } else if (type === "repellent") {
    ctx.fillStyle = "#39ff14";
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, Math.PI * 2);
    ctx.fill();
  }
}

function roundRect(ctx, x, y, width, height, radius, fill, stroke) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
  if (fill) ctx.fill();
  if (stroke) ctx.stroke();
}

function createBurst(x, y, color, count = 8) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 60 + Math.random() * 140;
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0.35 + Math.random() * 0.25,
      color,
      size: 3,
    });
  }
}

function createSpark(x, y, color) {
  particles.push({
    x,
    y,
    vx: (Math.random() - 0.5) * 50,
    vy: (Math.random() - 0.5) * 50,
    life: 0.2,
    color,
    size: 2.5,
  });
}

function triggerGameOver(reason) {
  if (gameState === "GAMEOVER") return;
  gameState = "GAMEOVER";
  playExplosion({ duration: 0.45, lowpass: 300 });

  saveGameScore("skydoodle", score, `${score} M`, { monstersSquashed });
  if (score > highScore) highScore = score;

  document.getElementById("death-reason").textContent = reason;
  document.getElementById("final-score").textContent = `${score} M`;
  document.getElementById("final-best").textContent = `${highScore} M`;
  document.getElementById("final-monsters").textContent = monstersSquashed;
  document.getElementById("modal-gameover").hidden = false;
}

function restartGame() {
  document.getElementById("modal-gameover").hidden = true;
  gameState = "PLAYING";
  resetWorld();
}

// -------------------------------------------------------------
// INITIALIZE
// -------------------------------------------------------------

resetWorld();
checkGyroSupport();

const loop = createGameLoop({
  update,
  render,
  canvas,
});

loop.start();
