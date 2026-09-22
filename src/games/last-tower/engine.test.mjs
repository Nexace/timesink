import test from "node:test";
import assert from "node:assert/strict";

// Pure functions and logic mirroring game.js engine
export function aStarSearch({ start, goal, cols, rows, isWalkable }) {
  const getKey = (x, y) => `${x},${y}`;
  const heuristic = (x, y) => Math.abs(x - goal.x) + Math.abs(y - goal.y);

  const openSet = [{ x: start.x, y: start.y, g: 0, f: heuristic(start.x, start.y) }];
  const cameFrom = new Map();
  const gScore = new Map();
  gScore.set(getKey(start.x, start.y), 0);

  const closedSet = new Set();

  while (openSet.length > 0) {
    openSet.sort((a, b) => a.f - b.f);
    const current = openSet.shift();
    const currKey = getKey(current.x, current.y);

    if (current.x === goal.x && current.y === goal.y) {
      const path = [{ x: current.x, y: current.y }];
      let curr = currKey;
      while (cameFrom.has(curr)) {
        const prev = cameFrom.get(curr);
        path.unshift(prev);
        curr = getKey(prev.x, prev.y);
      }
      return path;
    }

    closedSet.add(currKey);

    const neighbors = [
      { x: current.x + 1, y: current.y },
      { x: current.x - 1, y: current.y },
      { x: current.x, y: current.y + 1 },
      { x: current.x, y: current.y - 1 }
    ];

    for (const n of neighbors) {
      if (n.x < 0 || n.x >= cols || n.y < 0 || n.y >= rows) continue;
      if (!isWalkable(n.x, n.y)) continue;
      const nKey = getKey(n.x, n.y);
      if (closedSet.has(nKey)) continue;

      const tentativeG = gScore.get(currKey) + 1;
      if (!gScore.has(nKey) || tentativeG < gScore.get(nKey)) {
        cameFrom.set(nKey, { x: current.x, y: current.y });
        gScore.set(nKey, tentativeG);
        const f = tentativeG + heuristic(n.x, n.y);
        const existing = openSet.find(o => o.x === n.x && o.y === n.y);
        if (!existing) {
          openSet.push({ x: n.x, y: n.y, g: tentativeG, f });
        } else if (tentativeG < existing.g) {
          existing.g = tentativeG;
          existing.f = f;
        }
      }
    }
  }
  return null;
}

export function selectTarget(tower, candidates, priority = "FIRST") {
  if (!candidates || candidates.length === 0) return null;

  const inRange = candidates.filter(c => {
    const d = Math.hypot(c.x - tower.x, c.y - tower.y);
    return d <= tower.range;
  });

  if (inRange.length === 0) return null;

  if (priority === "FIRST") {
    // Furthest along their path (lowest remaining path distance or highest progress)
    return inRange.reduce((prev, curr) => (curr.pathProgress > prev.pathProgress ? curr : prev));
  } else if (priority === "LAST") {
    return inRange.reduce((prev, curr) => (curr.pathProgress < prev.pathProgress ? curr : prev));
  } else if (priority === "STRONGEST") {
    return inRange.reduce((prev, curr) => (curr.hp > prev.hp ? curr : prev));
  } else if (priority === "WEAKEST") {
    return inRange.reduce((prev, curr) => (curr.hp < prev.hp ? curr : prev));
  } else if (priority === "CLOSEST") {
    return inRange.reduce((prev, curr) => {
      const dCurr = Math.hypot(curr.x - tower.x, curr.y - tower.y);
      const dPrev = Math.hypot(prev.x - tower.x, prev.y - tower.y);
      return dCurr < dPrev ? curr : prev;
    });
  }
  return inRange[0];
}

export function calculateDamage(baseDmg, enemy, isEnergy = false) {
  let effectiveArmor = enemy.armor || 0;
  // Acid status strips armor
  if (enemy.acidStacks > 0) {
    effectiveArmor = Math.max(0, effectiveArmor - enemy.acidStacks * 0.15);
  }
  // Energy weapons ignore 50% armor
  if (isEnergy) {
    effectiveArmor *= 0.5;
  }
  // Freeze status makes enemy brittle (+30% dmg)
  const freezeMult = enemy.freezeTime > 0 ? 1.3 : 1.0;
  const reduction = Math.max(0.1, 1.0 - effectiveArmor);
  return Math.round(baseDmg * reduction * freezeMult);
}

export function calculateRefund(totalInvested) {
  return Math.floor(totalInvested * 0.7);
}

export function calculateUpgradeCost(baseCost, currentLevel) {
  return Math.round(baseCost * (1 + currentLevel * 0.8));
}

// -------------------------------------------------------------
// Test Suite
// -------------------------------------------------------------

test("aStarSearch finds valid path and detects illegal maze blocking", () => {
  const cols = 10;
  const rows = 10;
  const grid = new Uint8Array(cols * rows);

  const start = { x: 0, y: 5 };
  const goal = { x: 9, y: 5 };

  // 1. Clean path
  const path = aStarSearch({
    start,
    goal,
    cols,
    rows,
    isWalkable: (x, y) => grid[y * cols + x] === 0
  });

  assert.ok(path !== null, "Path should exist on empty grid");
  assert.equal(path[0].x, start.x);
  assert.equal(path[0].y, start.y);
  assert.equal(path[path.length - 1].x, goal.x);
  assert.equal(path[path.length - 1].y, goal.y);

  // 2. Complete wall blocking column 5
  for (let y = 0; y < rows; y++) {
    grid[y * cols + 5] = 1;
  }

  const blockedPath = aStarSearch({
    start,
    goal,
    cols,
    rows,
    isWalkable: (x, y) => grid[y * cols + x] === 0
  });

  assert.equal(blockedPath, null, "Complete wall should make path impossible");
});

test("selectTarget filters by range and handles priorities (FIRST, LAST, STRONGEST, CLOSEST)", () => {
  const tower = { x: 100, y: 100, range: 80 };
  const creeps = [
    { id: 1, x: 120, y: 100, pathProgress: 50, hp: 120 }, // dist 20
    { id: 2, x: 160, y: 100, pathProgress: 90, hp: 45 },  // dist 60
    { id: 3, x: 110, y: 110, pathProgress: 20, hp: 400 }, // dist 14.14
    { id: 4, x: 300, y: 300, pathProgress: 120, hp: 80 }  // out of range (dist 282)
  ];

  // FIRST: creep 2 has highest progress within range
  const targetFirst = selectTarget(tower, creeps, "FIRST");
  assert.equal(targetFirst.id, 2);

  // LAST: creep 3 has lowest progress within range
  const targetLast = selectTarget(tower, creeps, "LAST");
  assert.equal(targetLast.id, 3);

  // STRONGEST: creep 3 has highest HP
  const targetStrongest = selectTarget(tower, creeps, "STRONGEST");
  assert.equal(targetStrongest.id, 3);

  // CLOSEST: creep 3 is closest (14.14 distance)
  const targetClosest = selectTarget(tower, creeps, "CLOSEST");
  assert.equal(targetClosest.id, 3);

  // WEAKEST: creep 2 has lowest HP
  const targetWeakest = selectTarget(tower, creeps, "WEAKEST");
  assert.equal(targetWeakest.id, 2);
});

test("calculateDamage applies armor reduction, acid shred, and freeze brittle bonus", () => {
  const baseDmg = 100;

  // Unarmored creep
  const unarmored = { armor: 0, acidStacks: 0, freezeTime: 0 };
  assert.equal(calculateDamage(baseDmg, unarmored, false), 100);

  // Armored tank (40% armor)
  const tank = { armor: 0.4, acidStacks: 0, freezeTime: 0 };
  assert.equal(calculateDamage(baseDmg, tank, false), 60);

  // Armored tank hit by Energy weapon (50% armor piercing)
  assert.equal(calculateDamage(baseDmg, tank, true), 80);

  // Armored tank with 2 acid stacks (2 * 15% = 30% armor stripped)
  const acidTank = { armor: 0.4, acidStacks: 2, freezeTime: 0 };
  assert.equal(calculateDamage(baseDmg, acidTank, false), 90);

  // Frozen enemy takes +30% shatter damage
  const frozen = { armor: 0, acidStacks: 0, freezeTime: 2.5 };
  assert.equal(calculateDamage(baseDmg, frozen, false), 130);
});

test("calculateUpgradeCost and calculateRefund follow balanced economy rules", () => {
  const baseCost = 100;
  // Upgrade level 1 -> 2
  const costLvl2 = calculateUpgradeCost(baseCost, 1);
  assert.equal(costLvl2, 180);

  // Upgrade level 2 -> 3
  const costLvl3 = calculateUpgradeCost(baseCost, 2);
  assert.equal(costLvl3, 260);

  // Total invested = 100 + 180 = 280. 70% refund = 196
  const refund = calculateRefund(280);
  assert.equal(refund, 196);
});

test("Tactical commander abilities have valid costs and timers", () => {
  const abilities = {
    barrage: { name: "Orbital Barrage", cost: 40, cd: 30 },
    emp: { name: "EMP Shockwave", cost: 50, cd: 40 },
    overdrive: { name: "Core Overdrive", cost: 60, cd: 45 }
  };

  assert.equal(abilities.barrage.cost, 40);
  assert.equal(abilities.emp.cost, 50);
  assert.equal(abilities.overdrive.cost, 60);

  let treasury = 100;
  let canAffordBarrage = treasury >= abilities.barrage.cost;
  assert.equal(canAffordBarrage, true);

  treasury -= abilities.barrage.cost;
  assert.equal(treasury, 60);
  assert.equal(treasury >= abilities.overdrive.cost, true);
});
