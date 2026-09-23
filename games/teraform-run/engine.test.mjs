import test from "node:test";
import assert from "node:assert/strict";

// ── Multi-Box Collision (mirroring game.js) ──

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
      const gapX = Math.max(0, Math.max(ob.x - (db.x + db.w), db.x - (ob.x + ob.w)));
      const gapY = Math.max(0, Math.max(ob.y - (db.y + db.h), db.y - (ob.y + ob.h)));
      const dist = Math.sqrt(gapX * gapX + gapY * gapY);
      if (dist < minDist) minDist = dist;
    }
  }
  return minDist;
}

// ── Dino hitboxes (mirroring game.js) ──

function getDinoBoxes(dino) {
  if (dino.ducking) {
    return [
      { x: dino.x + 4, y: dino.y + 4, w: 52, h: 10 },
      { x: dino.x, y: dino.y + 10, w: 60, h: 12 },
      { x: dino.x + 8, y: dino.y + 20, w: 44, h: 8 },
    ];
  }
  return [
    { x: dino.x + 8, y: dino.y, w: 28, h: 14 },
    { x: dino.x + 2, y: dino.y + 14, w: 40, h: 20 },
    { x: dino.x + 6, y: dino.y + 34, w: 32, h: 14 },
  ];
}

function getObstacleBoxes(obs) {
  switch (obs.type) {
    case "cactusSmall":
      return [
        { x: obs.x + 4, y: obs.y, w: 12, h: 30 },
        { x: obs.x - 4, y: obs.y + 8, w: 10, h: 12 },
        { x: obs.x + 14, y: obs.y + 6, w: 10, h: 14 },
      ];
    case "ptero":
      return [
        { x: obs.x + 14, y: obs.y + 8, w: 20, h: 14 },
        { x: obs.x, y: obs.y, w: 16, h: 10 },
        { x: obs.x + 32, y: obs.y, w: 16, h: 10 },
        { x: obs.x + 34, y: obs.y + 10, w: 14, h: 6 },
        { x: obs.x + 2, y: obs.y + 14, w: 12, h: 8 },
      ];
    default:
      return [{ x: obs.x, y: obs.y, w: obs.w || 20, h: obs.h || 40 }];
  }
}

// ── Jump physics (mirroring game.js) ──

function applyJumpPhysics(vy, dt, gravity = 2800, fastFall = false) {
  const mult = fastFall ? 3 : 1;
  return vy + gravity * mult * dt;
}

function variableJumpVelocity(holdDurationMs, baseVel = -850) {
  if (holdDurationMs < 150) {
    return baseVel * 0.55; // short hop
  }
  return baseVel; // full jump
}

// ── Biome rotation (mirroring game.js) ──

function getBiomeIndex(score, biomeCount = 6) {
  return Math.floor(score / 1000) % biomeCount;
}

// ── Tests ──

test("AABB boxesOverlap detects intersection and separation correctly", () => {
  const a = { x: 10, y: 10, w: 20, h: 20 };
  const b = { x: 25, y: 15, w: 20, h: 20 }; // overlapping
  const c = { x: 50, y: 50, w: 10, h: 10 }; // far away

  assert.ok(boxesOverlap(a, b), "Overlapping boxes should collide");
  assert.ok(!boxesOverlap(a, c), "Separated boxes should not collide");

  // Edge-touching (not overlapping — edges exactly meet)
  const d = { x: 30, y: 10, w: 10, h: 10 };
  assert.ok(!boxesOverlap(a, d), "Edge-touching boxes should not collide");
});

test("multiBoxCollision checks all dino boxes against all obstacle boxes", () => {
  const dino = { x: 100, y: 392, ducking: false };
  const dinoBoxes = getDinoBoxes(dino);

  // Cactus directly in front — overlapping body
  const cactus = { type: "cactusSmall", x: 110, y: 405 };
  const cactusBoxes = getObstacleBoxes(cactus);

  assert.ok(multiBoxCollision(dinoBoxes, cactusBoxes), "Dino overlapping cactus should collide");

  // Cactus far away
  const farCactus = { type: "cactusSmall", x: 500, y: 405 };
  assert.ok(!multiBoxCollision(dinoBoxes, getObstacleBoxes(farCactus)), "Distant cactus should not collide");
});

test("ducking dino has lower profile hitboxes (reduced height)", () => {
  const standingBoxes = getDinoBoxes({ x: 100, y: 392, ducking: false });
  const duckingBoxes = getDinoBoxes({ x: 100, y: 412, ducking: true }); // y adjusted for duck height

  // Standing: head at y=392, legs bottom at y=392+34+14=440
  const standingMaxY = Math.max(...standingBoxes.map((b) => b.y + b.h));
  const standingMinY = Math.min(...standingBoxes.map((b) => b.y));
  const standingHeight = standingMaxY - standingMinY;

  // Ducking: total height should be ~28 vs standing ~48
  const duckingMaxY = Math.max(...duckingBoxes.map((b) => b.y + b.h));
  const duckingMinY = Math.min(...duckingBoxes.map((b) => b.y));
  const duckingHeight = duckingMaxY - duckingMinY;

  assert.ok(duckingHeight < standingHeight, "Ducking hitbox should be shorter than standing");

  // Ducking should be wider
  const standingMaxX = Math.max(...standingBoxes.map((b) => b.x + b.w));
  const standingMinX = Math.min(...standingBoxes.map((b) => b.x));
  const duckingMaxX = Math.max(...duckingBoxes.map((b) => b.x + b.w));
  const duckingMinX = Math.min(...duckingBoxes.map((b) => b.x));

  assert.ok(
    duckingMaxX - duckingMinX >= standingMaxX - standingMinX,
    "Ducking hitbox should be at least as wide as standing"
  );
});

test("pterodactyl has exactly 5 hitboxes", () => {
  const ptero = { type: "ptero", x: 300, y: 350 };
  const boxes = getObstacleBoxes(ptero);
  assert.equal(boxes.length, 5, "Ptero should have 5 multi-box hitboxes");
});

test("cactus has 3 hitboxes", () => {
  const cactus = { type: "cactusSmall", x: 400, y: 405 };
  const boxes = getObstacleBoxes(cactus);
  assert.equal(boxes.length, 3, "Cactus should have 3 hitboxes");
});

test("variable jump: tap gives short hop, hold gives full jump", () => {
  const shortHop = variableJumpVelocity(100, -850);
  const fullJump = variableJumpVelocity(200, -850);

  assert.ok(shortHop > fullJump, "Short hop velocity should be less negative (higher)");
  assert.equal(shortHop, -850 * 0.55);
  assert.equal(fullJump, -850);
});

test("fast-fall multiplies gravity by 3x", () => {
  const normalFall = applyJumpPhysics(0, 0.1, 2800, false);
  const fastFall = applyJumpPhysics(0, 0.1, 2800, true);

  assert.equal(normalFall, 280, "Normal: 2800 * 0.1 = 280");
  assert.equal(fastFall, 840, "Fast-fall: 2800 * 3 * 0.1 = 840");
});

test("nearMissDistance returns 0 on overlap, positive gap otherwise", () => {
  const dino = { x: 100, y: 392, ducking: false };
  const dinoBoxes = getDinoBoxes(dino);

  // Overlapping
  const overlapObs = { type: "cactusSmall", x: 110, y: 405 };
  const overlapDist = nearMissDistance(dinoBoxes, getObstacleBoxes(overlapObs));
  assert.equal(overlapDist, 0, "Overlapping should give distance 0");

  // Far away
  const farObs = { type: "cactusSmall", x: 500, y: 405 };
  const farDist = nearMissDistance(dinoBoxes, getObstacleBoxes(farObs));
  assert.ok(farDist > 100, "Far obstacle should have large distance");
});

test("biome rotates every 1000 points across 6 biomes", () => {
  assert.equal(getBiomeIndex(0), 0, "Score 0 = biome 0");
  assert.equal(getBiomeIndex(999), 0, "Score 999 = biome 0");
  assert.equal(getBiomeIndex(1000), 1, "Score 1000 = biome 1");
  assert.equal(getBiomeIndex(5999), 5, "Score 5999 = biome 5");
  assert.equal(getBiomeIndex(6000), 0, "Score 6000 wraps back to biome 0");
  assert.equal(getBiomeIndex(7500), 1, "Score 7500 = biome 1 (second cycle)");
});
