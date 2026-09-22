import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  chaikin,
  createF1Circuit,
  distToSegment,
  updateVehiclePhysics,
  interpolateGhost,
  formatLapTime
} from './engine.js';

describe('Ghost Lap F1 Simulation Engine', () => {
  it('smooths raw track polygon points using Chaikin subdivision', () => {
    const raw = [[0, 0], [100, 0], [100, 100], [0, 100]];
    const smoothed = chaikin(raw, 2);
    // 4 points * 2 * 2 = 16 points after 2 Chaikin iterations
    assert.equal(smoothed.length, 16);
  });

  it('generates an F1 circuit with start position and designated sector checkpoints', () => {
    const raw = [[100, 100], [400, 100], [400, 300], [100, 300]];
    const circuit = createF1Circuit(raw, "Test Ring", 50, 4);
    assert.equal(circuit.name, "Test Ring");
    assert.equal(circuit.width, 50);
    assert.ok(Number.isFinite(circuit.start.x));
    assert.ok(Number.isFinite(circuit.start.y));
    assert.ok(Number.isFinite(circuit.start.angle));
    assert.equal(circuit.checkpoints.length, 4);
    assert.equal(circuit.checkpoints[0].isFinish, true);
    assert.equal(circuit.checkpoints[0].label, "FINISH");
    assert.equal(circuit.checkpoints[1].isFinish, false);
  });

  it('computes point-to-segment distance for checkpoint crossing detection', () => {
    // Segment from (0, 0) to (10, 0)
    // Point at (5, 5) -> distance should be exactly 5
    const d = distToSegment(5, 5, 0, 0, 10, 0);
    assert.equal(Math.round(d), 5);

    // Point on segment -> distance 0
    const dOn = distToSegment(3, 0, 0, 0, 10, 0);
    assert.equal(Math.round(dOn), 0);
  });

  it('simulates throttle acceleration and braking physics with decomposed velocity vectors', () => {
    const car = { x: 100, y: 100, vx: 0, vy: 0, angle: 0, speed: 0 };
    const dt = 1 / 60;

    // Apply throttle forward
    for (let i = 0; i < 30; i++) {
      updateVehiclePhysics(car, { up: true, down: false, left: false, right: false }, dt);
    }
    assert.ok(car.vx > 50, 'Car should have accelerated forward along angle 0');
    assert.ok(car.speed > 50, 'Car speed should increase');

    // Apply brake
    const speedBeforeBraking = car.speed;
    const telemetry = updateVehiclePhysics(car, { up: false, down: true, left: false, right: false }, dt);
    assert.equal(telemetry.braking, true);
    assert.ok(car.speed < speedBeforeBraking, 'Speed should decrease when braking');
  });

  it('penalizes top speed when vehicle runs off-track into the gravel/grass', () => {
    const carOnTrack = { x: 100, y: 100, vx: 350, vy: 0, angle: 0, speed: 350 };
    const carOffTrack = { x: 100, y: 100, vx: 350, vy: 0, angle: 0, speed: 350 };
    const dt = 1 / 60;

    updateVehiclePhysics(carOnTrack, { up: true }, dt, { onTrack: true });
    updateVehiclePhysics(carOffTrack, { up: true }, dt, { onTrack: false });

    assert.ok(carOffTrack.speed < carOnTrack.speed, 'Off-track car must be clamped to reduced speed');
  });

  it('interpolates ghost racer telemetry and formats lap times', () => {
    const trail = [
      { t: 0, x: 100, y: 100, angle: 0 },
      { t: 1000, x: 200, y: 100, angle: 0 }
    ];
    const midGhost = interpolateGhost(trail, 500);
    assert.equal(midGhost.x, 150);
    assert.equal(midGhost.y, 100);

    assert.equal(formatLapTime(65432), "01:05.432");
    assert.equal(formatLapTime(0), "00:00.000");
  });
});
