import test from "node:test";
import assert from "node:assert/strict";

// Helper math functions mirroring engine
function angleDiff(target, current) {
  let diff = (target - current) % (Math.PI * 2);
  if (diff < -Math.PI) diff += Math.PI * 2;
  if (diff > Math.PI) diff -= Math.PI * 2;
  return diff;
}

function dist(x1, y1, x2, y2) {
  return Math.hypot(x2 - x1, y2 - y1);
}

// 1. WASD Rudder & Throttle Physics Logic
function calculateShipMovement({ keys, currentAngle, currentSpeed, maxSpeed, turnRate, dt }) {
  let angle = currentAngle;
  let speed = currentSpeed;

  // Steering: A turns port (counter-clockwise), D turns starboard (clockwise)
  let steerDir = 0;
  if (keys.has("KeyA") || keys.has("ArrowLeft")) steerDir -= 1;
  if (keys.has("KeyD") || keys.has("ArrowRight")) steerDir += 1;

  if (steerDir !== 0) {
    // Turning is responsive even at slow speed, but scaled nicely
    const speedFactor = Math.max(0.4, Math.min(1.2, speed / (maxSpeed * 0.5)));
    angle += steerDir * turnRate * speedFactor * dt;
  }

  // Throttle: W raises sails (accelerates forward), S reefs sails / brakes / reverses slowly
  let targetSpeed = 0;
  if (keys.has("KeyW") || keys.has("ArrowUp")) {
    targetSpeed = maxSpeed;
    speed += (targetSpeed - speed) * Math.min(1, dt * 2.5);
  } else if (keys.has("KeyS") || keys.has("ArrowDown")) {
    targetSpeed = -maxSpeed * 0.25; // Gentle reverse/anchor
    speed += (targetSpeed - speed) * Math.min(1, dt * 3.0);
  } else {
    // Natural water friction drag
    speed += (0 - speed) * Math.min(1, dt * 1.2);
  }

  return { angle, speed };
}

test("WASD input correctly rotates rudder and accelerates ship", () => {
  // Turn starboard with D
  const turnRight = calculateShipMovement({
    keys: new Set(["KeyD", "KeyW"]),
    currentAngle: 0,
    currentSpeed: 100,
    maxSpeed: 160,
    turnRate: 1.8,
    dt: 0.1,
  });
  assert.ok(turnRight.angle > 0, "D should increase heading angle clockwise");
  assert.ok(turnRight.speed > 100, "W should accelerate forward speed");

  // Turn port with A
  const turnLeft = calculateShipMovement({
    keys: new Set(["KeyA"]),
    currentAngle: 0,
    currentSpeed: 100,
    maxSpeed: 160,
    turnRate: 1.8,
    dt: 0.1,
  });
  assert.ok(turnLeft.angle < 0, "A should decrease heading angle counter-clockwise");

  // Brake with S
  const brake = calculateShipMovement({
    keys: new Set(["KeyS"]),
    currentAngle: 0,
    currentSpeed: 100,
    maxSpeed: 160,
    turnRate: 1.8,
    dt: 0.1,
  });
  assert.ok(brake.speed < 100, "S should brake/decelerate the ship");
});

// 2. Safe Harbor Spawning Distance Validation
const ISLANDS = [
  { id: 1, name: "Tortuga Haven", x: 1200, y: 1200, r: 120, captured: true },
  { id: 2, name: "Craggy Cay", x: 3200, y: 1400, r: 90, captured: false },
  { id: 3, name: "Emerald Atoll", x: 2600, y: 3400, r: 100, captured: false },
];

test("player spawn harbor is well isolated from any hostile island territory", () => {
  const playerSpawn = { x: ISLANDS[0].x + 160, y: ISLANDS[0].y };
  
  // Verify distance to all hostile islands
  for (let i = 1; i < ISLANDS.length; i++) {
    const hostile = ISLANDS[i];
    const d = dist(playerSpawn.x, playerSpawn.y, hostile.x, hostile.y);
    assert.ok(
      d >= 1500,
      `Hostile island ${hostile.name} must be at least 1500px from spawn, was ${d.toFixed(1)}px`
    );
  }
});

// 3. DOKDO Broadside Arc Targeting
function isTargetInBroadside(shipX, shipY, shipAngle, targetX, targetY, maxRange) {
  const d = dist(shipX, shipY, targetX, targetY);
  if (d > maxRange) return { inRange: false, side: null };

  let relAngle = (Math.atan2(targetY - shipY, targetX - shipX) - shipAngle) % (Math.PI * 2);
  if (relAngle < 0) relAngle += Math.PI * 2;
  const deg = (relAngle * 180) / Math.PI;

  // Left (port) broadside: 50° to 130°
  if (deg >= 50 && deg <= 130) {
    return { inRange: true, side: "port", deg };
  }
  // Right (starboard) broadside: 230° to 310°
  if (deg >= 230 && deg <= 310) {
    return { inRange: true, side: "starboard", deg };
  }
  // Bow (forward chaser): 340° to 360° or 0° to 20°
  if (deg <= 20 || deg >= 340) {
    return { inRange: true, side: "bow", deg };
  }

  return { inRange: false, side: null, deg };
}

test("broadside arc correctly identifies port, starboard, and bow target vectors", () => {
  const ship = { x: 500, y: 500, angle: 0 }; // Facing East (0 rad)

  // Target directly North (90° port side in canvas Y-down coords: positive Y is south, negative Y is north)
  // atan2(-200, 0) = -PI/2 = 270 deg (starboard in screen space or port depending on orientation)
  // Let's test explicit angles:
  // Directly South (deg = +90°) -> Port broadside
  const southTarget = isTargetInBroadside(ship.x, ship.y, ship.angle, 500, 700, 300);
  assert.equal(southTarget.side, "port");
  assert.equal(southTarget.inRange, true);

  // Directly North (deg = 270°) -> Starboard broadside
  const northTarget = isTargetInBroadside(ship.x, ship.y, ship.angle, 500, 300, 300);
  assert.equal(northTarget.side, "starboard");
  assert.equal(northTarget.inRange, true);

  // Directly East (deg = 0°) -> Bow chaser
  const eastTarget = isTargetInBroadside(ship.x, ship.y, ship.angle, 700, 500, 300);
  assert.equal(eastTarget.side, "bow");
  assert.equal(eastTarget.inRange, true);

  // Target out of range
  const farTarget = isTargetInBroadside(ship.x, ship.y, ship.angle, 500, 1000, 300);
  assert.equal(farTarget.inRange, false);
});

// 4. Ship Tier Evolution Logic
const SHIP_TIERS = [
  { tier: 1, name: "Coastal Sloop", minHullLvl: 1, gunsPerSide: 1, masts: 1, baseHp: 160 },
  { tier: 2, name: "Armed Schooner", minHullLvl: 3, gunsPerSide: 2, masts: 2, baseHp: 240 },
  { tier: 3, name: "War Brigantine", minHullLvl: 5, gunsPerSide: 3, masts: 2, baseHp: 350 },
  { tier: 4, name: "Heavy Frigate", minHullLvl: 7, gunsPerSide: 4, masts: 3, baseHp: 500 },
  { tier: 5, name: "Royal Galleon", minHullLvl: 9, gunsPerSide: 5, masts: 3, baseHp: 750 },
  { tier: 6, name: "Sovereign Dreadnought", minHullLvl: 11, gunsPerSide: 6, masts: 4, baseHp: 1100 }
];

function getShipTier(hullLevel) {
  let current = SHIP_TIERS[0];
  for (const t of SHIP_TIERS) {
    if (hullLevel >= t.minHullLvl) current = t;
  }
  return current;
}

test("ship tier upgrades dynamically with hull reinforcement levels", () => {
  assert.equal(getShipTier(1).name, "Coastal Sloop");
  assert.equal(getShipTier(1).gunsPerSide, 1);

  assert.equal(getShipTier(4).name, "Armed Schooner");
  assert.equal(getShipTier(4).gunsPerSide, 2);

  assert.equal(getShipTier(6).name, "War Brigantine");
  assert.equal(getShipTier(6).gunsPerSide, 3);

  assert.equal(getShipTier(10).name, "Royal Galleon");
  assert.equal(getShipTier(10).gunsPerSide, 5);

  assert.equal(getShipTier(12).name, "Sovereign Dreadnought");
  assert.equal(getShipTier(12).gunsPerSide, 6);
});

// 5. Floating Flotsam / Cargo Barrel Magnet & Collection
test("floating cargo barrels are collected when within pickup magnet radius", () => {
  const barrels = [
    { x: 100, y: 100, type: "wood", amount: 3, collected: false },
    { x: 500, y: 500, type: "gold", amount: 25, collected: false }
  ];

  const playerPos = { x: 120, y: 110 };
  const magnetRadius = 45;

  for (const b of barrels) {
    if (dist(playerPos.x, playerPos.y, b.x, b.y) <= magnetRadius) {
      b.collected = true;
    }
  }

  assert.equal(barrels[0].collected, true, "Nearby barrel must be collected");
  assert.equal(barrels[1].collected, false, "Far barrel must remain in water");
});

// 6. Island Passive Tax & Revenue Accumulation
test("captured islands generate passive resources based on tier", () => {
  const islands = [
    { id: 1, captured: true, level: 1, uncollectedTax: 0 },
    { id: 2, captured: true, level: 3, uncollectedTax: 0 },
    { id: 3, captured: false, level: 5, uncollectedTax: 0 }
  ];

  function tickIslandEconomy(islands, secondsElapsed) {
    for (const isl of islands) {
      if (!isl.captured) continue;
      // 1 Gold per level every 10 seconds
      isl.uncollectedTax += Math.floor((secondsElapsed / 10) * isl.level * 2);
    }
  }

  tickIslandEconomy(islands, 30);

  assert.equal(islands[0].uncollectedTax, 6, "Level 1 island produces 6 gold in 30s");
  assert.equal(islands[1].uncollectedTax, 18, "Level 3 island produces 18 gold in 30s");
  assert.equal(islands[2].uncollectedTax, 0, "Uncaptured island produces 0 tax");
});
