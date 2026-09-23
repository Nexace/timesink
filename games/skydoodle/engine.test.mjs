import test from "node:test";
import assert from "node:assert/strict";

// Physics & Engine simulation functions to test
function applyGravity(vy, dt, gravity = 1350, maxFall = 900) {
  let nextVy = vy + gravity * dt;
  if (nextVy > maxFall) nextVy = maxFall;
  return nextVy;
}

function checkPlatformLanding(player, platform, dt) {
  if (player.vy <= 0 || platform.broken) return false;
  const feetY = player.y - player.height / 2;
  const prevFeetY = feetY + player.vy * dt;
  const padTop = platform.y + platform.height / 2;

  return (
    player.x + player.width / 2 > platform.x &&
    player.x - player.width / 2 < platform.x + platform.width &&
    prevFeetY >= padTop - 6 &&
    feetY <= padTop + 8
  );
}

function calculateScreenWrap(x, width, canvasWidth = 480) {
  if (x < -width / 2) return canvasWidth + width / 2;
  if (x > canvasWidth + width / 2) return -width / 2;
  return x;
}

function processTilt(rawGamma, neutralGamma, prevSmoothed, alpha = 0.2, deadzone = 3.0, maxAngle = 25.0) {
  const diff = rawGamma - neutralGamma;
  const smoothed = prevSmoothed * (1 - alpha) + diff * alpha;
  if (Math.abs(smoothed) <= deadzone) {
    return { smoothed, moveDir: 0 };
  }
  const norm = Math.min(1, Math.max(0, (Math.abs(smoothed) - deadzone) / (maxAngle - deadzone)));
  const dir = Math.sign(smoothed);
  return { smoothed, moveDir: dir * norm };
}

function getProgressionTier(score) {
  if (score < 300) return "NOTEBOOK";
  if (score < 800) return "SKY";
  if (score < 1400) return "SUNSET";
  if (score < 2000) return "NIGHT";
  return "SPACE";
}

function isEnemySpawnAllowed(platform, recentEnemyY, currentY, safeZonePads) {
  if (safeZonePads > 0) return false;
  if (platform.hasSpring || platform.hasTrampoline) return false;
  if (currentY - recentEnemyY < 180) return false;
  return true;
}

test("gravity increases downward velocity up to terminal max fall speed", () => {
  let vy = 0;
  vy = applyGravity(vy, 0.1, 1000, 900);
  assert.equal(vy, 100);

  // Exceed terminal speed
  vy = applyGravity(850, 0.1, 1000, 900);
  assert.equal(vy, 900);
});

test("platform landing detection triggers only when falling downward across top edge", () => {
  const platform = { x: 100, y: 200, width: 80, height: 14, broken: false };
  const playerFalling = { x: 140, y: 224, width: 32, height: 34, vy: 200 };
  const playerRising = { x: 140, y: 224, width: 32, height: 34, vy: -200 };

  assert.ok(checkPlatformLanding(playerFalling, platform, 0.05), "Falling player lands on platform");
  assert.ok(!checkPlatformLanding(playerRising, platform, 0.05), "Rising player does not land on platform");
});

test("horizontal screen wrap teleports character seamlessly across edges", () => {
  const canvasW = 480;
  const charW = 32;

  // Off left edge
  assert.equal(calculateScreenWrap(-20, charW, canvasW), canvasW + charW / 2);
  // Off right edge
  assert.equal(calculateScreenWrap(500, charW, canvasW), -charW / 2);
  // Within bounds
  assert.equal(calculateScreenWrap(240, charW, canvasW), 240);
});

test("gyro tilt smoothing and deadzone filtering", () => {
  const neutral = 10;
  // Raw tilt equals neutral -> 0 output
  const zeroRes = processTilt(10, neutral, 0);
  assert.equal(zeroRes.moveDir, 0);

  // Raw tilt within deadzone (+/- 3 deg)
  const deadzoneRes = processTilt(12, neutral, 2);
  assert.equal(deadzoneRes.moveDir, 0);

  // Full tilt right (35 deg with neutral 10 = +25 deg)
  const fullRightRes = processTilt(35, neutral, 25);
  assert.equal(fullRightRes.moveDir, 1);

  // Full tilt left (-15 deg with neutral 10 = -25 deg)
  const fullLeftRes = processTilt(-15, neutral, -25);
  assert.equal(fullLeftRes.moveDir, -1);
});

test("progression tiers correctly transition with vertical altitude", () => {
  assert.equal(getProgressionTier(0), "NOTEBOOK");
  assert.equal(getProgressionTier(299), "NOTEBOOK");
  assert.equal(getProgressionTier(300), "SKY");
  assert.equal(getProgressionTier(799), "SKY");
  assert.equal(getProgressionTier(800), "SUNSET");
  assert.equal(getProgressionTier(1399), "SUNSET");
  assert.equal(getProgressionTier(1400), "NIGHT");
  assert.equal(getProgressionTier(1999), "NIGHT");
  assert.equal(getProgressionTier(2000), "SPACE");
});

test("fair-spawn rules prevent unfair launch and clustered deaths", () => {
  const springPad = { x: 50, y: 500, hasSpring: true };
  const normalPad = { x: 50, y: 500, hasSpring: false };

  // Rule 1: Enemies never spawn on/near spring platforms
  assert.ok(!isEnemySpawnAllowed(springPad, 200, 500, 0), "Enemy blocked on spring pad");

  // Rule 2: Safe zones enforce 0 enemies after enemy spawn
  assert.ok(!isEnemySpawnAllowed(normalPad, 200, 500, 2), "Enemy blocked during safe zone");

  // Allowed when safe zone ended and distance is adequate
  assert.ok(isEnemySpawnAllowed(normalPad, 200, 500, 0), "Enemy permitted when conditions met");
});
