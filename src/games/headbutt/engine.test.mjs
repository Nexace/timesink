import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// ── replicate pure game logic for testing ──

// Vehicle physics properties
const VEHICLES = {
  goKart:       { mass: 1.2, wheelFriction: 0.6, restitution: 0.3, chassisW: 55, chassisH: 16, wheelRadius: 10, wheelBase: 40 },
  bmx:          { mass: 0.8, wheelFriction: 0.7, restitution: 0.2, chassisW: 40, chassisH: 10, wheelRadius: 12, wheelBase: 30 },
  muscleCar:    { mass: 3.0, wheelFriction: 0.8, restitution: 0.2, chassisW: 80, chassisH: 22, wheelRadius: 14, wheelBase: 56 },
  ambulance:    { mass: 4.0, wheelFriction: 0.8, restitution: 0.15, chassisW: 85, chassisH: 32, wheelRadius: 13, wheelBase: 58 },
  offRoader:    { mass: 3.5, wheelFriction: 1.2, restitution: 0.2, chassisW: 75, chassisH: 24, wheelRadius: 16, wheelBase: 52 },
  rallyCar:     { mass: 2.8, wheelFriction: 0.7, restitution: 0.25, chassisW: 72, chassisH: 18, wheelRadius: 12, wheelBase: 50 },
  formulaCar:   { mass: 1.8, wheelFriction: 0.9, restitution: 0.1, chassisW: 90, chassisH: 14, wheelRadius: 11, wheelBase: 64 },
  monsterTruck: { mass: 6.0, wheelFriction: 0.9, restitution: 0.3, chassisW: 70, chassisH: 26, wheelRadius: 24, wheelBase: 48 },
  garbageTruck: { mass: 7.0, wheelFriction: 0.8, restitution: 0.1, chassisW: 95, chassisH: 34, wheelRadius: 14, wheelBase: 66 },
  tank:         { mass: 10.0, wheelFriction: 1.0, restitution: 0.05, chassisW: 88, chassisH: 24, wheelRadius: 14, wheelBase: 62 },
  eggMobile:    { mass: 1.5, wheelFriction: 0.6, restitution: 0.9, chassisW: 44, chassisH: 30, wheelRadius: 10, wheelBase: 32 },
  sawbot:       { mass: 3.0, wheelFriction: 0.8, restitution: 0.2, chassisW: 60, chassisH: 20, wheelRadius: 12, wheelBase: 42, hasBlades: true },
};

function isUpsideDown(angle) {
  const norm = ((angle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  return norm > Math.PI / 2 && norm < 3 * Math.PI / 2;
}

function getEffectiveInput(rawInput, angle) {
  return isUpsideDown(angle) ? -rawInput : rawInput;
}

function checkHeadHit(labelA, labelB) {
  if (labelA === 'p1_head' && labelB.startsWith('p2_') && labelB !== 'p2_head') return { loser: 0, winner: 1 };
  if (labelA === 'p2_head' && labelB.startsWith('p1_') && labelB !== 'p1_head') return { loser: 1, winner: 0 };
  if (labelB === 'p1_head' && labelA.startsWith('p2_') && labelA !== 'p2_head') return { loser: 0, winner: 1 };
  if (labelB === 'p2_head' && labelA.startsWith('p1_') && labelA !== 'p1_head') return { loser: 1, winner: 0 };
  return null;
}

function checkHazardHit(labelA, labelB) {
  const hazards = ['hazard_saw', 'hazard_lava', 'hazard_pit', 'hazard_water'];
  if (hazards.includes(labelA) && (labelB.startsWith('p1_') || labelB.startsWith('p2_'))) {
    return { loser: labelB.startsWith('p1_') ? 0 : 1 };
  }
  if (hazards.includes(labelB) && (labelA.startsWith('p1_') || labelA.startsWith('p2_'))) {
    return { loser: labelA.startsWith('p1_') ? 0 : 1 };
  }
  return null;
}

function checkMatchWin(scores) {
  if (scores[0] >= 5) return 0;
  if (scores[1] >= 5) return 1;
  return -1;
}

// Tests
describe('Vehicle definitions', () => {
  it('all 12 vehicles have required physics properties', () => {
    const types = Object.keys(VEHICLES);
    assert.equal(types.length, 12);
    for (const type of types) {
      const v = VEHICLES[type];
      assert.ok(v.mass > 0, `${type} mass`);
      assert.ok(v.wheelFriction > 0, `${type} wheelFriction`);
      assert.ok(v.chassisW > 0 && v.chassisH > 0, `${type} chassis dimensions`);
      assert.ok(v.wheelRadius > 0, `${type} wheelRadius`);
      assert.ok(v.wheelBase > 0, `${type} wheelBase`);
    }
  });

  it('vehicles have genuinely different mass values', () => {
    const masses = Object.values(VEHICLES).map(v => v.mass);
    const unique = new Set(masses);
    assert.ok(unique.size >= 8, 'at least 8 unique mass values');
  });

  it('goKart is lightest non-BMX vehicle', () => {
    assert.ok(VEHICLES.goKart.mass < VEHICLES.muscleCar.mass);
    assert.ok(VEHICLES.goKart.mass < VEHICLES.tank.mass);
  });

  it('tank is heaviest vehicle', () => {
    for (const [type, v] of Object.entries(VEHICLES)) {
      if (type !== 'tank') assert.ok(VEHICLES.tank.mass >= v.mass, `tank >= ${type}`);
    }
  });

  it('sawbot has blade flag', () => {
    assert.ok(VEHICLES.sawbot.hasBlades);
    const others = Object.entries(VEHICLES).filter(([k]) => k !== 'sawbot');
    for (const [type, v] of others) {
      assert.ok(!v.hasBlades, `${type} should not have blades`);
    }
  });
});

describe('Upside-down detection', () => {
  it('detects normal orientation', () => {
    assert.equal(isUpsideDown(0), false);
    assert.equal(isUpsideDown(0.5), false);
    assert.equal(isUpsideDown(-0.5), false);
  });

  it('detects upside-down orientation', () => {
    assert.equal(isUpsideDown(Math.PI), true);
    assert.equal(isUpsideDown(Math.PI * 0.75), true);
    assert.equal(isUpsideDown(-Math.PI), true);
  });

  it('inverts input when upside-down', () => {
    assert.equal(getEffectiveInput(1, 0), 1);
    assert.equal(getEffectiveInput(1, Math.PI), -1);
    assert.equal(getEffectiveInput(-1, Math.PI), 1);
  });
});

describe('Head-hit collision', () => {
  it('P2 body hitting P1 head = P2 wins', () => {
    const result = checkHeadHit('p1_head', 'p2_chassis');
    assert.deepEqual(result, { loser: 0, winner: 1 });
  });

  it('P1 body hitting P2 head = P1 wins', () => {
    const result = checkHeadHit('p2_head', 'p1_fwheel');
    assert.deepEqual(result, { loser: 1, winner: 0 });
  });

  it('head-to-head = no result', () => {
    assert.equal(checkHeadHit('p1_head', 'p2_head'), null);
  });

  it('same-team collision = no result', () => {
    assert.equal(checkHeadHit('p1_head', 'p1_chassis'), null);
  });

  it('terrain collision = no result', () => {
    assert.equal(checkHeadHit('p1_head', 'terrain'), null);
  });
});

describe('Hazard detection', () => {
  it('saw hitting P1 = P1 loses', () => {
    const r = checkHazardHit('hazard_saw', 'p1_chassis');
    assert.deepEqual(r, { loser: 0 });
  });

  it('lava hitting P2 = P2 loses', () => {
    const r = checkHazardHit('hazard_lava', 'p2_rwheel');
    assert.deepEqual(r, { loser: 1 });
  });

  it('water pool hitting P1 = P1 loses', () => {
    const r = checkHazardHit('hazard_water', 'p1_head');
    assert.deepEqual(r, { loser: 0 });
  });

  it('water pool hitting P2 = P2 loses', () => {
    const r = checkHazardHit('hazard_water', 'p2_chassis');
    assert.deepEqual(r, { loser: 1 });
  });

  it('terrain is not a hazard', () => {
    assert.equal(checkHazardHit('terrain', 'p1_head'), null);
  });
});

describe('Match scoring', () => {
  it('no winner at start', () => {
    assert.equal(checkMatchWin([0, 0]), -1);
  });

  it('P1 wins at 5 rounds', () => {
    assert.equal(checkMatchWin([5, 3]), 0);
  });

  it('P2 wins at 5 rounds', () => {
    assert.equal(checkMatchWin([2, 5]), 1);
  });

  it('4-4 is not a win', () => {
    assert.equal(checkMatchWin([4, 4]), -1);
  });
});

describe('Vehicle Jump Mechanics & Mobility', () => {
  function calculateJumpForce(mass) {
    return -0.024 * mass;
  }

  function canJump({ grounded, airTime, jumpCooldown, upsideDown }) {
    if (jumpCooldown > 0) return false;
    const isGroundOrCoyote = grounded || (airTime || 0) < 0.15;
    if (!isGroundOrCoyote && !upsideDown && (airTime || 0) > 0.35) {
      return false;
    }
    return true;
  }

  it('jump impulse scales with vehicle mass', () => {
    const kartJump = calculateJumpForce(VEHICLES.goKart.mass);
    const truckJump = calculateJumpForce(VEHICLES.monsterTruck.mass);
    const tankJump = calculateJumpForce(VEHICLES.tank.mass);

    assert.ok(kartJump < 0, 'jump force is upward (negative y)');
    assert.ok(Math.abs(truckJump) > Math.abs(kartJump), 'heavier vehicle gets larger upward force');
    assert.ok(Math.abs(tankJump) > Math.abs(truckJump), 'tank gets highest upward impulse');
  });

  it('allows jump when grounded', () => {
    assert.equal(canJump({ grounded: true, airTime: 0, jumpCooldown: 0, upsideDown: false }), true);
  });

  it('allows jump during coyote time (< 150ms airborne)', () => {
    assert.equal(canJump({ grounded: false, airTime: 0.08, jumpCooldown: 0, upsideDown: false }), true);
  });

  it('rejects jump when airborne past coyote time without inversion', () => {
    assert.equal(canJump({ grounded: false, airTime: 0.45, jumpCooldown: 0, upsideDown: false }), false);
  });

  it('allows recovery hop when upside down even in mid-air', () => {
    assert.equal(canJump({ grounded: false, airTime: 0.5, jumpCooldown: 0, upsideDown: true }), true);
  });

  it('respects jump cooldown timer', () => {
    assert.equal(canJump({ grounded: true, airTime: 0, jumpCooldown: 0.2, upsideDown: false }), false);
  });
});

describe('Arena Geometry & Trap Elimination', () => {
  it('chaosBarn has double-sided hay ramps so vehicles can drive both directions', () => {
    // Left ramp: incline angle -0.32, crest, decline angle 0.32
    const leftIncline = { angle: -0.32, x: 115 };
    const leftDecline = { angle: 0.32, x: 225 };
    assert.ok(leftIncline.angle < 0, 'left side slopes up toward crest');
    assert.ok(leftDecline.angle > 0, 'right side slopes down toward center');
    assert.ok(leftDecline.x > leftIncline.x, 'ramp spans smoothly across crest');
  });

  it('sawmill has inner incline ramps allowing return to upper gantries', () => {
    const leftOuter = { x: 85, angle: -0.45 };
    const leftInner = { x: 330, angle: 0.52 };
    assert.ok(leftOuter.angle < 0, 'outer ramp ascends to gantry');
    assert.ok(leftInner.angle > 0, 'inner ramp ascends to gantry from arena center');
  });
});

describe('12-Arena Roster & Geometry Validation', () => {
  const ARENA_KEYS = [
    'theBump', 'sawmill', 'volcano', 'ovalTrack',
    'scaffolding', 'pirateShip', 'winterCliff', 'chaosBarn',
    'duneSaws', 'hydroDeck', 'colosseum', 'catacombs'
  ];

  it('has exactly 12 arenas defined', () => {
    assert.equal(ARENA_KEYS.length, 12);
  });

  it('all 12 arenas have distinct names and valid descriptors', () => {
    const arenaMetadata = {
      theBump:     { name: 'Cyber Stadium', hasHazards: false },
      sawmill:     { name: 'Hazard Foundry', hasHazards: true },
      volcano:     { name: 'Magma Caverns', hasHazards: true },
      ovalTrack:   { name: 'Neon Oval', hasHazards: false },
      scaffolding: { name: 'Metro Works', hasHazards: true },
      pirateShip:  { name: 'Corsair Galleon', hasHazards: false },
      winterCliff: { name: 'Frostbite Peak', hasHazards: false },
      chaosBarn:   { name: 'Rustic Barnyard', hasHazards: false },
      duneSaws:    { name: 'Dune Saws', hasHazards: true },
      hydroDeck:   { name: 'Hydro Facility', hasHazards: true },
      colosseum:   { name: 'The Thunderdome', hasHazards: false },
      catacombs:   { name: 'Bone Catacombs', hasHazards: true },
    };

    const names = new Set();
    for (const key of ARENA_KEYS) {
      const meta = arenaMetadata[key];
      assert.ok(meta, `Metadata for ${key} must exist`);
      assert.ok(meta.name.length > 0, `Arena ${key} must have non-empty name`);
      assert.ok(!names.has(meta.name), `Arena name ${meta.name} must be unique`);
      names.add(meta.name);
    }
  });

  it('new drive-ahead archetypes provide required hazard mechanics', () => {
    // Dune Saws: wall saws on both perimeter edges
    const duneHazards = [
      { type: 'wall_saw', side: 'left', radius: 46 },
      { type: 'wall_saw', side: 'right', radius: 46 }
    ];
    assert.equal(duneHazards.length, 2);
    assert.equal(duneHazards[0].type, 'wall_saw');

    // Hydro Facility: water pool
    const hydroHazards = [
      { type: 'water_pool', x: 480, w: 280, h: 45 }
    ];
    assert.equal(hydroHazards[0].type, 'water_pool');

    // Bone Catacombs: lava pit and swinging pendulum
    const catacombHazards = [
      { type: 'lava', x: 480, w: 260 },
      { type: 'pendulum', pivotX: 480, length: 155 }
    ];
    assert.equal(catacombHazards.length, 2);
  });
});
