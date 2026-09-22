import test from "node:test";
import assert from "node:assert/strict";

// Core simulation functions from Swarmline engine to test

function simulateSpawnAccumulator(durationSeconds, fps = 60, mins = 0) {
  let spawnTimer = 0;
  let spawnedCount = 0;
  const dt = 1 / fps;
  const spawnRatePerSec = 12 + mins * 3.5;
  const spawnInterval = 1 / spawnRatePerSec;

  const totalFrames = Math.floor(durationSeconds * fps);
  for (let f = 0; f < totalFrames; f++) {
    spawnTimer += dt;
    while (spawnTimer >= spawnInterval) {
      spawnTimer -= spawnInterval;
      spawnedCount++;
    }
  }

  return spawnedCount;
}

function calculateDamageTaken(rawDamage, armorLevel) {
  const flatArmor = armorLevel || 0;
  return Math.max(1, Math.round(rawDamage - flatArmor));
}

function calculateDashState(player, dt) {
  if (player.dashCooldownTimer > 0) {
    player.dashCooldownTimer -= dt;
  }

  if (player.isDashing) {
    player.dashTimer -= dt;
    player.x += player.dashVx * dt;
    player.y += player.dashVy * dt;

    if (player.dashTimer <= 0) {
      player.isDashing = false;
    }
  }

  return player;
}

function checkEvolutionEligibility(weapons, passives, evoPairs) {
  const readyEvos = [];
  for (const wid in weapons) {
    if (weapons[wid] >= 8 && evoPairs[wid]) {
      const pair = evoPairs[wid];
      if (passives[pair.passive] && !weapons[pair.evo]) {
        readyEvos.push(pair.evo);
      }
    }
  }
  return readyEvos;
}

function simulateBloaterBlast(bloater, targets, blastRadius = 75, blastDmg = 120) {
  const hitTargets = [];
  for (const t of targets) {
    const d = Math.hypot(t.x - bloater.x, t.y - bloater.y);
    if (d <= blastRadius) {
      t.hp -= blastDmg;
      hitTargets.push(t);
    }
  }
  return hitTargets;
}

// -------------------------------------------------------------
// TESTS
// -------------------------------------------------------------

test("swarm spawn accumulator reliably spawns multiple enemies and never floors to 0", () => {
  // Over 1 second at 60 FPS, should spawn ~12 enemies at minute 0
  const count1s = simulateSpawnAccumulator(1.0, 60, 0);
  assert.ok(count1s >= 11 && count1s <= 13, `Expected ~12 enemies, got ${count1s}`);

  // Over 5 seconds at 60 FPS, should spawn ~60 enemies
  const count5s = simulateSpawnAccumulator(5.0, 60, 0);
  assert.ok(count5s >= 58 && count5s <= 62, `Expected ~60 enemies, got ${count5s}`);

  // At minute 10, rate should scale up to ~47 enemies/second
  const countMin10 = simulateSpawnAccumulator(1.0, 60, 10);
  assert.ok(countMin10 >= 45 && countMin10 <= 49, `Expected ~47 enemies at min 10, got ${countMin10}`);
});

test("player armor reduces incoming damage with a floor of 1 flat damage", () => {
  // 10 raw damage with armor 0 -> 10 taken
  assert.equal(calculateDamageTaken(10, 0), 10);

  // 10 raw damage with armor 3 -> 7 taken
  assert.equal(calculateDamageTaken(10, 3), 7);

  // 10 raw damage with armor 15 -> minimum 1 taken (never 0 or negative)
  assert.equal(calculateDamageTaken(10, 15), 1);
});

test("dash mechanic advances player position and clears after duration", () => {
  const player = {
    x: 100,
    y: 100,
    isDashing: true,
    dashTimer: 0.2,
    dashCooldownTimer: 3.0,
    dashVx: 400,
    dashVy: 0
  };

  // Advance by 0.1s
  calculateDashState(player, 0.1);
  assert.equal(player.x, 140);
  assert.equal(player.isDashing, true);

  // Advance by another 0.11s (completes dash)
  calculateDashState(player, 0.11);
  assert.ok(player.x >= 180);
  assert.equal(player.isDashing, false);
});

test("weapon evolution triggers only when weapon is level 8 AND matching passive is equipped", () => {
  const evoPairs = {
    wand: { evo: "holy_wand", passive: "tome" },
    knife: { evo: "thousand_edge", passive: "bracer" }
  };

  // Wand at lvl 7 with tome -> not ready
  let evos = checkEvolutionEligibility({ wand: 7 }, { tome: 1 }, evoPairs);
  assert.deepEqual(evos, []);

  // Wand at lvl 8 without tome -> not ready
  evos = checkEvolutionEligibility({ wand: 8 }, {}, evoPairs);
  assert.deepEqual(evos, []);

  // Wand at lvl 8 with tome -> Holy Wand ready!
  evos = checkEvolutionEligibility({ wand: 8 }, { tome: 1 }, evoPairs);
  assert.deepEqual(evos, ["holy_wand"]);

  // If Holy Wand already owned -> not offered again
  evos = checkEvolutionEligibility({ wand: 8, holy_wand: 1 }, { tome: 1 }, evoPairs);
  assert.deepEqual(evos, []);
});

test("bloater explosion damages nearby entities within blast radius", () => {
  const bloater = { x: 100, y: 100 };
  const targets = [
    { id: 1, x: 120, y: 100, hp: 100 }, // distance 20: within 75px radius
    { id: 2, x: 150, y: 100, hp: 100 }, // distance 50: within 75px radius
    { id: 3, x: 250, y: 100, hp: 100 }  // distance 150: outside radius
  ];

  const hit = simulateBloaterBlast(bloater, targets, 75, 120);
  assert.equal(hit.length, 2);
  assert.equal(targets[0].hp, -20);
  assert.equal(targets[1].hp, -20);
  assert.equal(targets[2].hp, 100);
});
