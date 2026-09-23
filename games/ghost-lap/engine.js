/**
 * GHOST LAP — Vector F1 Vehicle Dynamics & Telemetry Simulation Engine
 */

export function chaikin(points, iterations = 2) {
  let pts = points;
  for (let it = 0; it < iterations; it++) {
    const next = [];
    for (let i = 0; i < pts.length; i++) {
      const p1 = pts[i];
      const p2 = pts[(i + 1) % pts.length];
      next.push([
        Math.round((0.75 * p1[0] + 0.25 * p2[0]) * 10) / 10,
        Math.round((0.75 * p1[1] + 0.25 * p2[1]) * 10) / 10
      ]);
      next.push([
        Math.round((0.25 * p1[0] + 0.75 * p2[0]) * 10) / 10,
        Math.round((0.25 * p1[1] + 0.75 * p2[1]) * 10) / 10
      ]);
    }
    pts = next;
  }
  return pts;
}

export function createF1Circuit(rawPoints, name = "F1 Circuit", width = 52, numGates = 6) {
  const path = chaikin(rawPoints, 2);
  const p0 = path[0];
  const p1 = path[1] || [p0[0] + 100, p0[1]];
  const angle = Math.atan2(p1[1] - p0[1], p1[0] - p0[0]);

  const checkpoints = [];
  const halfWidth = Math.round(width / 2) + 20;

  for (let g = 0; g < numGates; g++) {
    const idx = Math.floor((g / numGates) * path.length);
    const curr = path[idx];
    const next = path[(idx + 1) % path.length];
    const segAngle = Math.atan2(next[1] - curr[1], next[0] - curr[0]);
    const normal = segAngle + Math.PI / 2;

    checkpoints.push({
      id: g,
      x1: curr[0] + Math.cos(normal) * halfWidth,
      y1: curr[1] + Math.sin(normal) * halfWidth,
      x2: curr[0] - Math.cos(normal) * halfWidth,
      y2: curr[1] - Math.sin(normal) * halfWidth,
      isFinish: g === 0,
      label: g === 0 ? "FINISH" : `S${g}`
    });
  }

  return {
    name,
    path,
    width,
    start: { x: p0[0], y: p0[1], angle },
    checkpoints
  };
}

export function distToSegment(px, py, x1, y1, x2, y2) {
  const l2 = (x2 - x1) ** 2 + (y2 - y1) ** 2;
  if (l2 === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * (x2 - x1)), py - (y1 + t * (y2 - y1)));
}

export function updateVehiclePhysics(car, input, dt, options = {}) {
  const {
    onTrack = true,
    steerSens = 100,
    brakeForce = 100,
    driftAssist = true,
    bounds = { minX: 10, maxX: 950, minY: 10, maxY: 530 }
  } = options;

  const accel = 360; // px/s^2
  const maxSpeed = 380;
  const effectiveMaxSpeed = onTrack ? maxSpeed : maxSpeed * 0.45;

  const forwardDirX = Math.cos(car.angle);
  const forwardDirY = Math.sin(car.angle);
  const normalDirX = -Math.sin(car.angle);
  const normalDirY = Math.cos(car.angle);

  const forwardSpeed = car.vx * forwardDirX + car.vy * forwardDirY;
  const lateralSpeed = car.vx * normalDirX + car.vy * normalDirY;

  let throttle = 0;
  let braking = false;
  let reversing = false;

  // Braking & Reverse
  if (input.down) {
    if (forwardSpeed > 15) {
      braking = true;
      const brakeForceFactor = brakeForce / 100;
      const brakeDecel = 780 * brakeForceFactor;
      const decelStep = brakeDecel * dt;
      const newForward = Math.max(0, forwardSpeed - decelStep);

      car.vx = forwardDirX * newForward + normalDirX * lateralSpeed;
      car.vy = forwardDirY * newForward + normalDirY * lateralSpeed;
    } else {
      reversing = true;
      throttle -= 0.55;
    }
  }

  // Acceleration
  if (input.up) {
    if (forwardSpeed < -10) {
      braking = true;
      const decel = 600 * dt;
      const newForward = Math.min(0, forwardSpeed + decel);
      car.vx = forwardDirX * newForward + normalDirX * lateralSpeed;
      car.vy = forwardDirY * newForward + normalDirY * lateralSpeed;
    } else {
      throttle += 1;
    }
  }

  // Handbrake Drift Mechanics
  const drifting = Boolean(input.drift && Math.abs(car.speed) > 40);
  if (input.drift && car.speed > 60) {
    car.vx *= (1 - 0.35 * dt);
    car.vy *= (1 - 0.35 * dt);
  }

  // Steering Mechanics
  const sens = steerSens / 100;
  const baseTurnSpeed = drifting ? 4.3 : (driftAssist ? 3.3 : 2.9);
  const turnSpeed = baseTurnSpeed * sens * (1 - Math.min(0.35, Math.abs(car.speed) / (maxSpeed * 1.5)));

  if (input.left) car.angle -= turnSpeed * dt;
  if (input.right) car.angle += turnSpeed * dt;

  // Apply throttle acceleration
  if (throttle !== 0) {
    const ax = Math.cos(car.angle) * throttle * accel;
    const ay = Math.sin(car.angle) * throttle * accel;
    car.vx += ax * dt;
    car.vy += ay * dt;
  }

  // Friction & Grip
  const friction = drifting ? 0.987 : (onTrack ? 0.975 : 0.92);
  const lateralFriction = drifting ? (driftAssist ? 0.88 : 0.91) : (onTrack ? 0.70 : 0.82);

  const curForward = car.vx * forwardDirX + car.vy * forwardDirY;
  const curLateral = car.vx * normalDirX + car.vy * normalDirY;

  const frameScale = dt * 60;
  const updatedForward = curForward * Math.pow(friction, frameScale);
  const updatedLateral = curLateral * Math.pow(lateralFriction, frameScale);

  car.vx = forwardDirX * updatedForward + normalDirX * updatedLateral;
  car.vy = forwardDirY * updatedForward + normalDirY * updatedLateral;

  car.speed = Math.hypot(car.vx, car.vy);
  if (car.speed > effectiveMaxSpeed) {
    const scale = effectiveMaxSpeed / car.speed;
    car.vx *= scale;
    car.vy *= scale;
    car.speed = effectiveMaxSpeed;
  }

  car.x += car.vx * dt;
  car.y += car.vy * dt;

  if (bounds) {
    car.x = Math.max(bounds.minX, Math.min(bounds.maxX, car.x));
    car.y = Math.max(bounds.minY, Math.min(bounds.maxY, car.y));
  }

  return {
    braking,
    reversing,
    drifting,
    speedKmh: Math.round(car.speed * 0.8)
  };
}

export function interpolateGhost(trail, timeMs) {
  if (!trail || trail.length === 0) return null;
  if (timeMs <= trail[0].t) return trail[0];
  if (timeMs >= trail[trail.length - 1].t) return trail[trail.length - 1];

  let low = 0;
  let high = trail.length - 1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (trail[mid].t < timeMs) low = mid + 1;
    else high = mid - 1;
  }

  const p1 = trail[Math.max(0, low - 1)];
  const p2 = trail[Math.min(trail.length - 1, low)];
  if (!p1 || !p2 || p1.t === p2.t) return p1 || p2;

  const frac = (timeMs - p1.t) / (p2.t - p1.t);
  return {
    x: p1.x + (p2.x - p1.x) * frac,
    y: p1.y + (p2.y - p1.y) * frac,
    angle: p1.angle + (p2.angle - p1.angle) * frac
  };
}

export function formatLapTime(ms) {
  if (ms == null || !Number.isFinite(ms)) return "--:--.---";
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  const millis = Math.floor(ms % 1000);
  return `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}.${String(millis).padStart(3, "0")}`;
}
