import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  CRUISERS,
  BUILDINGS,
  UNITS,
  BOSSES,
  CAMPAIGN_LEVELS,
  STARTER_LOADOUT,
  createDroneEconomy,
  canStartBuild,
  startConstruction,
  updateDroneEconomy,
  checkBuildQueue,
  TECH_LAB_UPGRADES,
  calculateUpgradedHull,
  canIonCannonHitTarget,
  isSlotShieldProtected,
  isAdjacentToBooster,
  calculateStars,
  evaluateEnemyAiDecision,
  exportSaveCode,
  importSaveCode
} from './engine.js';

describe('IRONCLAD Cruiser Roster', () => {
  it('defines all 13 battlecruisers including the secret Yeti Charger', () => {
    const cruiserKeys = Object.keys(CRUISERS);
    assert.equal(cruiserKeys.length, 13, 'Must have exactly 13 battlecruisers');

    const expectedCruisers = [
      'trident', 'raptor', 'bullshark', 'rockjaw', 'eagle',
      'hammerhead', 'longbow', 'hurricane', 'blackrig', 'rickshaw',
      'flea', 'megalodon', 'yetiCharger'
    ];
    for (const key of expectedCruisers) {
      assert.ok(CRUISERS[key], `Cruiser ${key} must exist in roster`);
      assert.ok(CRUISERS[key].hullHp >= 1000, `${key} should have substantial hull HP (>= 1000)`);
      assert.ok(CRUISERS[key].slots && CRUISERS[key].slots.length > 0, `${key} must define slots`);
      assert.ok(CRUISERS[key].slotCounts, `${key} must define slotCounts`);
    }

    // Verify Yeti Charger characteristics
    const yeti = CRUISERS.yetiCharger;
    assert.ok(yeti.hullHp >= 3000, 'Yeti Charger should be an armored behemoth (>= 3000 HP)');
    assert.ok(yeti.slots.some(s => s.type === 'bow'), 'Yeti Charger must possess bow slot for super-weapons');
  });

  it('verifies slot geometry and slot types for all cruisers', () => {
    const validSlotTypes = new Set(['bow', 'deck', 'utility', 'mast', 'platform']);
    for (const [id, cruiser] of Object.entries(CRUISERS)) {
      assert.ok(cruiser.name, `Cruiser ${id} must have a name`);
      assert.ok(cruiser.role, `Cruiser ${id} must have a tactical role`);
      for (const slot of cruiser.slots) {
        assert.ok(validSlotTypes.has(slot.type), `Slot ${slot.id} has invalid type ${slot.type}`);
        assert.equal(typeof slot.x, 'number');
        assert.equal(typeof slot.y, 'number');
      }
    }
  });
});

describe('IRONCLAD Building Catalog (29 Buildings across 5 Categories)', () => {
  it('defines exactly 29 buildings distributed across 5 categories', () => {
    const buildingKeys = Object.keys(BUILDINGS);
    assert.equal(buildingKeys.length, 29, 'Must have exactly 29 buildings in catalog');

    const categories = {
      factories: 0,
      tactical: 0,
      defensive: 0,
      offensive: 0,
      ultraweapons: 0
    };

    for (const [id, b] of Object.entries(BUILDINGS)) {
      assert.ok(b.name, `Building ${id} must have a name`);
      assert.ok(b.category, `Building ${id} must have a category`);
      assert.ok(b.drones >= 1, `Building ${id} must require at least 1 drone`);
      assert.ok(b.buildTime > 0, `Building ${id} must have a positive build time`);
      assert.ok(b.hp > 0, `Building ${id} must have HP`);
      assert.ok(Array.isArray(b.allowedSlots), `Building ${id} must specify allowed slot types`);

      if (categories[b.category] !== undefined) {
        categories[b.category]++;
      }
    }

    assert.equal(categories.factories, 3, 'Must have 3 factories (Naval, Air, Drone Station)');
    assert.equal(categories.tactical, 8, 'Must have 8 tactical buildings');
    assert.equal(categories.defensive, 6, 'Must have 6 defensive buildings');
    assert.equal(categories.offensive, 7, 'Must have 7 offensive buildings');
    assert.equal(categories.ultraweapons, 5, 'Must have 5 ultraweapons');
  });

  it('enforces exact reference drone-second balance metrics', () => {
    // Reference from specification:
    // Artillery = 6 drones × 180s = 1080 drone-seconds
    const artillery = BUILDINGS.artillery;
    assert.equal(artillery.drones, 6, 'Artillery must require 6 drones');
    assert.equal(artillery.buildTime, 180, 'Artillery must take 180s build time');
    assert.equal(artillery.drones * artillery.buildTime, 1080, 'Artillery must equal 1080 drone-seconds');

    // LasCannon = 10 drones × 120s = 1200 drone-seconds
    const lasCannon = BUILDINGS.lasCannon;
    assert.equal(lasCannon.drones, 10, 'LasCannon must require 10 drones');
    assert.equal(lasCannon.buildTime, 120, 'LasCannon must take 120s build time');
    assert.equal(lasCannon.drones * lasCannon.buildTime, 1200, 'LasCannon must equal 1200 drone-seconds');

    // Nuke Launcher = 8 drones × 360s = 2880 drone-seconds (6 minutes)
    const nuke = BUILDINGS.nukeLauncher;
    assert.equal(nuke.drones, 8, 'Nuke Launcher must require 8 drones');
    assert.equal(nuke.buildTime, 360, 'Nuke Launcher must take 360s (6 minutes)');
  });

  it('restricts superweapons and specific turrets to appropriate slots', () => {
    const ion = BUILDINGS.ionCannon;
    assert.deepEqual(ion.allowedSlots, ['bow'], 'Ion Cannon can ONLY be mounted in bow slot');

    const droneStation = BUILDINGS.droneStation;
    assert.ok(droneStation.allowedSlots.includes('utility'), 'Drone station should be mountable in utility slot');

    const radar = BUILDINGS.controlTower;
    assert.ok(radar.allowedSlots.includes('mast'), 'Control tower should be mountable in mast slot');
  });
});

describe('IRONCLAD Unit Roster (10 Autonomous Combat Units)', () => {
  it('defines 5 naval and 5 air autonomous units with low-profile attributes', () => {
    const unitKeys = Object.keys(UNITS);
    assert.equal(unitKeys.length, 10, 'Must have exactly 10 autonomous combat units');

    let navalCount = 0;
    let airCount = 0;

    for (const [id, unit] of Object.entries(UNITS)) {
      assert.ok(unit.name, `Unit ${id} must have a name`);
      assert.ok(unit.hp > 0, `Unit ${id} must have positive HP`);
      assert.ok(unit.speed > 0, `Unit ${id} must have positive movement speed`);
      if (unit.domain === 'naval') navalCount++;
      if (unit.domain === 'air') airCount++;
    }

    assert.equal(navalCount, 5, 'Must have 5 naval units');
    assert.equal(airCount, 5, 'Must have 5 air units');

    // Low-profile immunity check
    assert.equal(UNITS.attackRib.lowProfile, true, 'AttackRIB must have lowProfile = true');
    assert.equal(UNITS.attackBoat.lowProfile, true, 'AttackBoat must have lowProfile = true');
    assert.ok(!UNITS.frigate.lowProfile, 'Frigate is a capital-class vessel, not low-profile');
    assert.ok(!UNITS.destroyer.lowProfile, 'Destroyer is not low-profile');
    assert.ok(!UNITS.archonBattleship.lowProfile, 'Archon Battleship is an armored dreadnought');
  });
});

describe('Drone Economy & Parallel Construction System', () => {
  it('starts with 4 builder drones and manages drone allocation cleanly', () => {
    const economy = createDroneEconomy(4);
    assert.equal(economy.maxDrones, 4);
    assert.equal(economy.idleDrones, 4);
    assert.equal(economy.assignedDrones, 0);

    // Can start a 2-drone building
    const smallBldg = { id: 'shipTurret', drones: 2, buildTime: 20 };
    assert.equal(canStartBuild(economy, smallBldg), true);

    const result = startConstruction(economy, 'deck_1', 'shipTurret', smallBldg);
    assert.equal(result.success, true);
    assert.equal(economy.idleDrones, 2);
    assert.equal(economy.assignedDrones, 2);
    assert.equal(economy.activeBuilds.length, 1);

    // Cannot start a 3-drone building now (only 2 idle drones)
    const medBldg = { id: 'mortar', drones: 3, buildTime: 35 };
    assert.equal(canStartBuild(economy, medBldg), false);

    // Enqueueing when drones are unavailable
    const queueResult = startConstruction(economy, 'deck_2', 'mortar', medBldg);
    assert.equal(queueResult.success, false);
    assert.equal(queueResult.queued, true);
    assert.equal(economy.queue.length, 1, 'Should be placed in build queue');
  });

  it('updates build progress and frees drones on completion', () => {
    const economy = createDroneEconomy(4);
    const bldg = { id: 'shipTurret', drones: 2, buildTime: 10 };
    startConstruction(economy, 'deck_1', 'shipTurret', bldg);

    let completedBuilding = null;
    const onComplete = (build) => { completedBuilding = build; };

    // Advance 5 seconds (50% progress)
    updateDroneEconomy(economy, 5, onComplete);
    assert.equal(completedBuilding, null);
    assert.equal(economy.activeBuilds[0].progress, 5);
    assert.equal(economy.idleDrones, 2);

    // Advance another 5 seconds (100% progress)
    updateDroneEconomy(economy, 5, onComplete);
    assert.ok(completedBuilding);
    assert.equal(completedBuilding.slotId, 'deck_1');
    assert.equal(economy.activeBuilds.length, 0);
    assert.equal(economy.idleDrones, 4, 'All 4 drones must be idle after completion');
  });

  it('auto-promotes from build queue when drones free up', () => {
    const economy = createDroneEconomy(4);
    const bldgA = { id: 'mortar', drones: 3, buildTime: 10 };
    const bldgB = { id: 'shipTurret', drones: 2, buildTime: 10 };

    startConstruction(economy, 'deck_1', 'mortar', bldgA); // Consumes 3 drones, 1 idle
    startConstruction(economy, 'deck_2', 'shipTurret', bldgB); // Queued because 2 needed > 1 idle

    assert.equal(economy.activeBuilds.length, 1);
    assert.equal(economy.queue.length, 1);

    // Complete bldgA
    updateDroneEconomy(economy, 10, () => {});
    assert.equal(economy.idleDrones, 2, 'Should have promoted queued build immediately and allocated 2 drones');
    assert.equal(economy.activeBuilds.length, 1, 'Queued shipTurret should now be active');
    assert.equal(economy.activeBuilds[0].slotId, 'deck_2');
    assert.equal(economy.queue.length, 0);
    assert.equal(economy.assignedDrones, 2);
  });
});

describe('Combat Mechanics: Ion Cannon, Shields & Boosters', () => {
  it('enforces that horizontal Bow Ion Cannon passes over low-profile boats', () => {
    // Target 1: AttackRIB (low-profile)
    const ribTarget = { domain: 'naval', lowProfile: true, name: 'AttackRIB' };
    assert.equal(canIonCannonHitTarget(ribTarget), false, 'Ion Cannon beam MUST pass over AttackRIB');

    // Target 2: AttackBoat (low-profile)
    const boatTarget = { domain: 'naval', lowProfile: true, name: 'AttackBoat' };
    assert.equal(canIonCannonHitTarget(boatTarget), false, 'Ion Cannon beam MUST pass over AttackBoat');

    // Target 3: Destroyer (full profile)
    const destroyerTarget = { domain: 'naval', lowProfile: false, name: 'Destroyer' };
    assert.equal(canIonCannonHitTarget(destroyerTarget), true, 'Ion Cannon beam hits standard naval vessels');

    // Target 4: Battlecruiser Hull
    const cruiserTarget = { isCruiser: true, name: 'Enemy Cruiser' };
    assert.equal(canIonCannonHitTarget(cruiserTarget), true, 'Ion Cannon beam hits enemy cruiser hull');
  });

  it('evaluates shield dome protection radius', () => {
    const shieldPos = { x: 100, y: -40 };
    const insideSlot = { x: 150, y: -40 }; // 50px away <= 180px radius
    const outsideSlot = { x: 350, y: -40 }; // 250px away > 180px radius

    assert.equal(isSlotShieldProtected(shieldPos, insideSlot, 180), true);
    assert.equal(isSlotShieldProtected(shieldPos, outsideSlot, 180), false);
  });

  it('evaluates booster proximity aura', () => {
    const boosterPos = { x: 100, y: -40 };
    const adjacentSlot = { x: 140, y: -40 }; // 40px <= 90px
    const distantSlot = { x: 250, y: -40 };  // 150px > 90px

    assert.equal(isAdjacentToBooster(boosterPos, adjacentSlot, 90), true);
    assert.equal(isAdjacentToBooster(boosterPos, distantSlot, 90), false);
  });
});

describe('Tech Lab Upgrades & Campaign Star System', () => {
  it('calculates hull upgrades with armor tiers and nanocoat', () => {
    const baseHp = 2000;
    // Tier 0, no nanocoat
    assert.equal(calculateUpgradedHull(baseHp, 0, false), 2000);

    // Tier 1 (+5%)
    assert.equal(calculateUpgradedHull(baseHp, 1, false), 2100);

    // Tier 3 (+15%)
    assert.equal(calculateUpgradedHull(baseHp, 3, false), 2300);

    // Tier 3 + Nanocoat (divide by 0.95)
    const nanoHp = calculateUpgradedHull(baseHp, 3, true);
    assert.equal(nanoHp, Math.round(2300 / 0.95));
  });

  it('evaluates star rating based on win, speed, and losses', () => {
    const parTime = 120; // 2 minutes

    // Lost battle = 0 stars
    assert.equal(calculateStars(false, 90, parTime, 0), 0);

    // Won slowly with losses = 1 star
    assert.equal(calculateStars(true, 180, parTime, 5), 1);

    // Won under par time with losses = 2 stars
    assert.equal(calculateStars(true, 100, parTime, 3), 2);

    // Won under par time without losing any buildings = 3 stars
    assert.equal(calculateStars(true, 95, parTime, 0), 3);
  });

  it('defines 40 campaign levels and 24 scripted bosses', () => {
    assert.equal(CAMPAIGN_LEVELS.length, 40, 'Must have 40 campaign levels');
    assert.equal(BOSSES.length, 24, 'Must have 24 unique scripted bosses');

    for (let i = 0; i < CAMPAIGN_LEVELS.length; i++) {
      const lvl = CAMPAIGN_LEVELS[i];
      assert.equal(lvl.level, i + 1);
      assert.ok(lvl.title);
      assert.ok(lvl.bossId);
      const boss = BOSSES.find(b => b.id === lvl.bossId);
      assert.ok(boss, `Boss ${lvl.bossId} must exist in BOSSES roster`);
      assert.ok(lvl.parTime > 0);
    }
  });

  it('encodes and decodes save state correctly', () => {
    const sampleSave = {
      stars: 42,
      scrap: 1250,
      unlockedCruisers: ['trident', 'raptor', 'bullshark'],
      techTiers: { hullArmor: 2, drones: 1, buildSpeed: 1, shields: 0, nanocoat: false }
    };

    const code = exportSaveCode(sampleSave);
    assert.equal(typeof code, 'string');
    assert.ok(code.length > 20);

    const imported = importSaveCode(code);
    assert.equal(imported.stars, 42);
    assert.equal(imported.scrap, 1250);
    assert.deepEqual(imported.unlockedCruisers, ['trident', 'raptor', 'bullshark']);
    assert.equal(imported.techTiers.hullArmor, 2);
  });
});

describe('AI Tactical Decision Making', () => {
  it('selects anti-air counters when player deploys air wings', () => {
    const playerUnits = [
      { domain: 'air', type: 'bomber' },
      { domain: 'air', type: 'bomber' },
      { domain: 'air', type: 'gunship' }
    ];
    const playerBuildings = [];

    const counter = evaluateEnemyAiDecision(playerUnits, playerBuildings);
    assert.equal(counter.priority, 'counter_air');
    assert.ok(counter.recommended.includes('antiAirTurret') || counter.recommended.includes('flakBattery'));
  });
});
