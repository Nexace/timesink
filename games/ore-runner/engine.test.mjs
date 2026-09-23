import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  ASTEROID_TIERS,
  STATION_DEFAULT,
  calculateMassMultiplier,
  calculateEffectiveThrust,
  calculateEffectiveTurnRate,
  isWithinDockingBay,
  calculateUnstableCoreFuse,
  bankAllCargo,
  simulateNewtonianMotion
} from './engine.js';

describe('Ore Runner Space Miner Engine', () => {
  it('defines 5 unique asteroid tiers with balanced weights and values', () => {
    assert.equal(ASTEROID_TIERS.length, 5);
    const unstable = ASTEROID_TIERS.find(t => t.id === 'unstable');
    assert.ok(unstable);
    assert.equal(unstable.isUnstable, true);
    assert.equal(unstable.value, 450, 'Unstable Core should be most valuable high-risk ore');

    const silicate = ASTEROID_TIERS.find(t => t.id === 'silicate');
    assert.equal(silicate.weight, 45, 'Silicate should be the most common asteroid');
  });

  it('implements realistic cargo mass penalties on thrust and turn rate', () => {
    const baseThrust = 220;
    const baseTurn = 2.8;

    // Empty cargo
    assert.equal(calculateMassMultiplier(0, 25), 1.0);
    assert.equal(calculateEffectiveThrust(baseThrust, 0, 25), 220);
    assert.equal(calculateEffectiveTurnRate(baseTurn, 0, 25), 2.8);

    // Full cargo (25/25)
    const fullMass = calculateMassMultiplier(25, 25);
    assert.equal(fullMass, 1.45, 'Full cargo adds 45% mass penalty');
    const fullThrust = calculateEffectiveThrust(baseThrust, 25, 25);
    assert.ok(fullThrust < 160, 'Full cargo severely degrades ship acceleration');

    const fullTurn = calculateEffectiveTurnRate(baseTurn, 25, 25);
    assert.ok(fullTurn < baseTurn, 'Turn agility decreases under full load');
  });

  it('verifies station docking detection and cargo banking', () => {
    // Within docking radius (85px)
    assert.equal(isWithinDockingBay(2020, 2030, 2000, 2000, 85), true);

    // Far in the asteroid belt
    assert.equal(isWithinDockingBay(2500, 2500, 2000, 2000, 85), false);

    // Banking cargo
    const cargo = [
      { id: 'silicate', value: 15 },
      { id: 'metallic', value: 40 },
      { id: 'exotic', value: 220 }
    ];
    const receipt = bankAllCargo(cargo);
    assert.equal(receipt.depositedCount, 3);
    assert.equal(receipt.creditsEarned, 275);
    assert.equal(receipt.remainingCargo.length, 0);
  });

  it('accurately simulates zero-friction Newtonian inertia', () => {
    const startPos = { x: 100, y: 100 };
    const startVel = { vx: 50, vy: 0 };

    // Advance 1 second with no thrust -> maintains constant velocity (Newton's 1st Law)
    const step1 = simulateNewtonianMotion(startPos, startVel, false, 0, 200, 1.0);
    assert.equal(step1.x, 150);
    assert.equal(step1.y, 100);
    assert.equal(step1.vx, 50);

    // Advance 1 second with forward thrust (0 rad = +X)
    const step2 = simulateNewtonianMotion(step1, { vx: step1.vx, vy: step1.vy }, true, 0, 100, 1.0);
    assert.equal(step2.vx, 150);
    assert.equal(step2.x, 300);
  });

  it('tracks unstable core 8-second nuclear countdown', () => {
    let fuse = 8.0;
    fuse = calculateUnstableCoreFuse(fuse, 2.5);
    assert.equal(fuse, 5.5);

    fuse = calculateUnstableCoreFuse(fuse, 6.0);
    assert.equal(fuse, 0, 'Fuse clamps at 0 upon detonation');
  });
});
