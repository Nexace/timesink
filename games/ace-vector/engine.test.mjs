import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  AIRCRAFT_ROSTER,
  ENEMY_CLASSES,
  getAtmosphericZone,
  isInCloudDeck,
  canMaintainRadarLock,
  generateMountainTerrain,
  getTerrainHeightAt,
  checkTerrainCollision,
  checkGroundProximity,
  simulateFlightStep,
  WORLD_WIDTH,
  SEA_LEVEL_Y,
  CLOUD_DECK_TOP_Y,
  CLOUD_DECK_BOTTOM_Y
} from './engine.js';

describe('Ace Vector Flight Engine & Roster', () => {
  it('defines 5 unique playable aircraft with specialized roles', () => {
    const keys = Object.keys(AIRCRAFT_ROSTER);
    assert.equal(keys.length, 5);
    assert.deepEqual(keys, ['f22', 'su47', 'a10', 'mirage', 'sr71']);

    // F-22 Stealth Raptor
    const f22 = AIRCRAFT_ROSTER.f22;
    assert.equal(f22.role, 'Stealth Air Dominance');
    assert.ok(f22.stealthFactor > 0.5);
    assert.equal(f22.maxSpeed, 960);

    // Su-47 Berkut
    const su47 = AIRCRAFT_ROSTER.su47;
    assert.ok(su47.pitchRate >= 3.4, 'Su-47 should have highest instantaneous pitch rate');
    assert.equal(su47.stallSpeed, 135);

    // A-10C Warthog
    const a10 = AIRCRAFT_ROSTER.a10;
    assert.ok(a10.hp >= 200, 'A-10 has heavy titanium armor');
    assert.ok(a10.damageResist > 0.3);
    assert.equal(a10.cannonExplosive, true);

    // Mirage 2000
    const mirage = AIRCRAFT_ROSTER.mirage;
    assert.ok(mirage.energyRetention > 1.2, 'Mirage has superior energy retention in climbs');
    assert.ok(mirage.maxSpeed > 1000);

    // SR-71X Vector
    const sr71 = AIRCRAFT_ROSTER.sr71;
    assert.ok(sr71.maxSpeed >= 1200, 'SR-71X has hypersonic top speed');
    assert.ok(sr71.radarRange >= 3000, 'SR-71X has long-range radar sniper');
  });

  it('defines 5 distinct enemy aircraft classes with bespoke combat profiles', () => {
    const enemyKeys = Object.keys(ENEMY_CLASSES);
    assert.equal(enemyKeys.length, 5);
    assert.deepEqual(enemyKeys, ['mig21', 'su27', 'tu160', 'j20', 'blackGhost']);

    // MiG-21 Light Interceptor
    assert.equal(ENEMY_CLASSES.mig21.role, 'Light Interceptor');
    assert.equal(ENEMY_CLASSES.mig21.firesMissiles, false);

    // Su-27 Heavy Fighter
    assert.equal(ENEMY_CLASSES.su27.firesMissiles, true);
    assert.ok(ENEMY_CLASSES.su27.pitchRate > 2.0);

    // Tu-160 Heavy Bomber
    assert.equal(ENEMY_CLASSES.tu160.role, 'Heavy Strategic Bomber');
    assert.ok(ENEMY_CLASSES.tu160.maxHp >= 350);
    assert.equal(ENEMY_CLASSES.tu160.defensiveFlak, true);

    // J-20 Stealth Canard
    assert.equal(ENEMY_CLASSES.j20.stealth, true);
    assert.equal(ENEMY_CLASSES.j20.firesMissiles, true);

    // Black Ghost Boss Ace
    assert.ok(ENEMY_CLASSES.blackGhost.maxHp >= 250);
    assert.ok(ENEMY_CLASSES.blackGhost.highGManeuvers);
  });

  it('correctly partitions atmospheric vertical strata', () => {
    // Stratosphere high above clouds
    assert.equal(getAtmosphericZone(1000), 'STRATOSPHERE');
    assert.equal(isInCloudDeck(1000), false);

    // Cloud Deck (2200 to 3500)
    assert.equal(getAtmosphericZone(2500), 'CLOUD_DECK');
    assert.equal(isInCloudDeck(2500), true);
    assert.equal(getAtmosphericZone(CLOUD_DECK_TOP_Y), 'CLOUD_DECK');
    assert.equal(getAtmosphericZone(CLOUD_DECK_BOTTOM_Y), 'CLOUD_DECK');

    // Low Altitude (below 3500)
    assert.equal(getAtmosphericZone(4200), 'LOW_ALTITUDE');
    assert.equal(isInCloudDeck(4200), false);
  });

  it('breaks radar locks when obscured across cloud deck boundaries', () => {
    const highJet = { x: 2000, y: 1500 }; // in stratosphere
    const cloudJet = { x: 2000, y: 2800 }; // in cloud deck
    const lowJet = { x: 2000, y: 4500 }; // in low altitude

    // Distance between highJet and cloudJet is 1300 (> 600) and across cloud border -> lock broken!
    assert.equal(canMaintainRadarLock(highJet, cloudJet), false);

    // Very close distance (< 600) can maintain lock even near cloud edge
    const closeJet = { x: 2000, y: 2250 };
    assert.equal(canMaintainRadarLock({ x: 2000, y: 2150 }, closeJet), true);

    // Two jets clear in stratosphere can maintain lock at long range
    const jet1 = { x: 1000, y: 1200 };
    const jet2 = { x: 2200, y: 1400 };
    assert.equal(canMaintainRadarLock(jet1, jet2), true);
  });

  it('generates procedural mountain landscape with peaks, valleys, and trees', () => {
    const terrain = generateMountainTerrain(42);
    assert.ok(terrain.points.length > 10);
    assert.ok(terrain.trees.length > 5);

    // First and last points should span the world boundaries at sea level
    assert.equal(terrain.points[0].y, SEA_LEVEL_Y);
    assert.equal(terrain.points[terrain.points.length - 1].y, SEA_LEVEL_Y);

    // Must have mountain peaks that rise into airspace (y < 4200)
    const hasHighPeaks = terrain.points.some((p) => p.y < 4200);
    assert.ok(hasHighPeaks, 'Terrain must have peaks rising into flight airspace');
  });

  it('interpolates terrain height correctly', () => {
    const testPoints = [
      { x: 0, y: 5200 },
      { x: 1000, y: 4000 },
      { x: 2000, y: 5200 }
    ];

    assert.equal(getTerrainHeightAt(0, testPoints), 5200);
    assert.equal(getTerrainHeightAt(1000, testPoints), 4000);
    // Midpoint between 0 and 1000 should be 4600
    assert.equal(getTerrainHeightAt(500, testPoints), 4600);
  });

  it('detects collision with mountain peaks and ocean surface', () => {
    const testPoints = [
      { x: 0, y: 5200 },
      { x: 1000, y: 4000 },
      { x: 2000, y: 5200 }
    ];

    // Flying safe high above peak at (1000, 3000)
    const safeCheck = checkTerrainCollision(1000, 3000, 15, testPoints);
    assert.equal(safeCheck.collided, false);

    // Flying into mountain peak at (1000, 3995) with radius 15
    const peakCrash = checkTerrainCollision(1000, 3995, 15, testPoints);
    assert.equal(peakCrash.collided, true);
    assert.equal(peakCrash.type, 'mountain');

    // Crashing into ocean at y = 5205
    const oceanCrash = checkTerrainCollision(500, 5195, 15, testPoints);
    assert.equal(oceanCrash.collided, true);
    assert.equal(oceanCrash.type, 'ocean');
  });

  it('triggers Ground Proximity Warning System (GPWS) on rapid descent', () => {
    const testPoints = [{ x: 0, y: 5200 }, { x: 2000, y: 5200 }];

    // High altitude safe flight
    const safe = checkGroundProximity(1000, 3000, 0, testPoints);
    assert.equal(safe.warning, false);

    // Descending rapidly near ground (clearance 300, vy 150)
    const warning = checkGroundProximity(1000, 4900, 150, testPoints);
    assert.equal(warning.warning, true);
  });

  it('simulates energy flight physics: climb deceleration and stall', () => {
    const plane = {
      type: 'f22',
      x: 1000,
      y: 3000,
      vx: 400,
      vy: 0,
      angle: -Math.PI / 3, // steep climb nose up
      speed: 300,
      throttle: 0.8,
      fuel: 100,
      isStalled: false
    };

    const initialSpeed = plane.speed;
    simulateFlightStep(plane, { isBraking: false, isBurner: false, pitchInput: 0 }, 0.5);

    // Climbing should decelerate the jet
    assert.ok(plane.speed < initialSpeed, 'Climbing must drain kinetic speed into potential energy');

    // Simulate severe low speed stall
    plane.speed = 100; // below stall speed (160)
    simulateFlightStep(plane, { isBraking: false, isBurner: false, pitchInput: 0 }, 0.2);
    assert.equal(plane.isStalled, true, 'Low speed must trigger stall aerodynamics');
  });

  it('simulates afterburner acceleration and fuel consumption', () => {
    const plane = {
      type: 'mirage',
      x: 1000,
      y: 3000,
      vx: 400,
      vy: 0,
      angle: 0,
      speed: 400,
      throttle: 0.8,
      fuel: 100,
      isStalled: false
    };

    simulateFlightStep(plane, { isBraking: false, isBurner: true, pitchInput: 0 }, 1.0);
    assert.ok(plane.speed > 400, 'Afterburner must accelerate the jet');
    assert.ok(plane.fuel < 100, 'Afterburner must consume fuel');
    assert.equal(plane.throttle, 1.5);
  });

  it('generates rich coastal installations and multi-layered distant ridges', () => {
    const terrain = generateMountainTerrain(456);
    assert.ok(terrain.installations.length >= 4, 'Must generate at least 4 coastal installations');
    const types = terrain.installations.map(i => i.type);
    assert.ok(types.includes('carrier'), 'Must generate aircraft carrier');
    assert.ok(types.includes('airfield'), 'Must generate airfield');
    assert.ok(types.includes('oilRig'), 'Must generate oil platform');
    assert.ok(types.includes('lighthouse'), 'Must generate lighthouse');

    assert.ok(terrain.distantRidges.far.length > 20, 'Must generate far distant ridge');
    assert.ok(terrain.distantRidges.mid.length > 20, 'Must generate mid distant ridge');
  });

  it('correctly maps keyboard and mouse aim flight controls', async () => {
    const { calculateFlightControls } = await import('./engine.js');
    const plane = { angle: 0, fuel: 80 };

    // Climb input W
    const mockInputW = {
      isDown: (k) => k === 'KeyW',
      stick: { active: false }
    };
    const ctrlW = calculateFlightControls(plane, mockInputW, 0.016);
    assert.equal(ctrlW.pitchInput, -1, 'KeyW should command nose up / climb (-1)');

    // Brake input A
    const mockInputA = {
      isDown: (k) => k === 'KeyA',
      stick: { active: false }
    };
    const ctrlA = calculateFlightControls(plane, mockInputA, 0.016);
    assert.equal(ctrlA.isBraking, true, 'KeyA should engage airbrake');

    // Boost input D
    const mockInputD = {
      isDown: (k) => k === 'KeyD',
      stick: { active: false }
    };
    const ctrlD = calculateFlightControls(plane, mockInputD, 0.016);
    assert.equal(ctrlD.isBurner, true, 'KeyD should engage afterburner');

    // Mouse aim vectoring (target at angle -Math.PI / 4, i.e. 45 degrees up)
    const mockNoKeys = {
      isDown: () => false,
      stick: { active: false }
    };
    const mouseAim = { active: true, targetAngle: -Math.PI / 4 };
    const ctrlMouse = calculateFlightControls(plane, mockNoKeys, 0.016, mouseAim);
    assert.ok(ctrlMouse.pitchInput < 0, 'Mouse aim above heading must steer pitch up');
  });
});

