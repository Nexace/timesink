// Ghost Lap — pure race simulation (no DOM). Tracks at real-length scale, arcade car physics,
// AI drivers, lap/sector timing, track limits, DRS, ERS, slipstream and race classification.
import { fitCircuit, cornerRadii } from "./circuits.js";

export const PX_PER_M = 3.3; // world pixels per real metre of circuit length
export const TRACK_WIDTH = 128;
// The world runs a little slower than real life on these wider roads; the speedo still reads F1
// numbers (700 px/s flat out ≈ 330 km/h).
export const KMH = 0.47; // world px/s → displayed km/h
export const STEP = 10; // path resample spacing (px)

export const CAR = {
  top: 700, // px/s flat out (aero drag balances the engine here)
  power: 270, // px/s² traction-limited launch acceleration
  powerSpeed: 250, // above this speed the engine is power-limited (thrust falls off as 1/v)
  brake: 1450,
  // Lateral grip grows with speed like an F1 car's downforce: about 3 g in slow corners, about 5 g
  // flat out (in the game's scale). Hairpins need ~70 km/h; only genuinely fast corners are flat.
  gripLow: 450,
  gripHigh: 750,
  wheelbase: 30,
  radius: 15
};

/** Lateral grip (px/s²) available at speed v. */
export const gripAt = (v) => CAR.gripLow + (CAR.gripHigh - CAR.gripLow) * Math.min(1, (v / CAR.top) ** 2);

/**
 * Fastest speed through a corner of radius r: solves v² = r·m·gripAt(v) for the speed-dependent grip.
 * m scales the grip (skill, surface).
 */
export function cornerSpeed(r, m = 1) {
  const a = CAR.gripLow * m * r;
  const b = ((CAR.gripHigh - CAR.gripLow) * m * r) / (CAR.top * CAR.top);
  return b >= 0.98 ? CAR.top * 2 : Math.sqrt(a / (1 - b));
}

// Steering lock shrinks with speed; this sets the tightest turn the car can make at a given speed
export const maxSteerAt = (v) => 0.95 / (1 + Math.abs(v) / 170);
export const turnRadiusAt = (v) => CAR.wheelbase / Math.tan(maxSteerAt(v));
// Fastest speed whose steering-limited radius still fits a corner of radius r (table lookup)
const STEER_TABLE = Array.from({ length: 90 }, (_, k) => [k * 10, turnRadiusAt(k * 10)]);
function steerSpeedFor(r) {
  let v = 0;
  for (const [sv, sr] of STEER_TABLE) {
    if (sr <= r) v = sv;
    else break;
  }
  return Math.max(60, v);
}

export const DIFFICULTY = {
  noob: { label: "NOOB", pace: 0.56, grip: 0.7, noise: 0.3 },
  veryEasy: { label: "VERY EASY", pace: 0.66, grip: 0.78, noise: 0.22 },
  easy: { label: "EASY", pace: 0.76, grip: 0.85, noise: 0.14 },
  medium: { label: "MEDIUM", pace: 0.86, grip: 0.92, noise: 0.08 },
  hard: { label: "HARD", pace: 0.93, grip: 0.97, noise: 0.04 },
  veryHard: { label: "VERY HARD", pace: 0.98, grip: 1.0, noise: 0.02 },
  impossible: { label: "IMPOSSIBLE", pace: 1.04, grip: 1.07, noise: 0 }
};
DIFFICULTY.mixed = { label: "MIXED", pace: 0.86, grip: 0.92, noise: 0.08 };
export const DIFFICULTY_ORDER = ["noob", "veryEasy", "easy", "medium", "hard", "veryHard", "impossible"];

// Fictional grid (names, 3-letter timing codes, livery)
export const DRIVERS = [
  { name: "A. VOSS", code: "VOS", color: "#e10600", accent: "#ffd400" },
  { name: "K. MORI", code: "MOR", color: "#00d2be", accent: "#0b2230" },
  { name: "L. MARLOW", code: "MAR", color: "#ff8700", accent: "#1e2a44" },
  { name: "R. AZEVEDO", code: "AZE", color: "#1e41ff", accent: "#ff2b2b" },
  { name: "E. LINDQVIST", code: "LIN", color: "#006f62", accent: "#cedc00" },
  { name: "T. OKAFOR", code: "OKA", color: "#f5f5f5", accent: "#111111" },
  { name: "J. DUCHAMP", code: "DUC", color: "#2b4562", accent: "#ff5ea8" },
  { name: "M. RAINES", code: "RAI", color: "#900000", accent: "#f0f0f0" },
  { name: "I. SOKOLOV", code: "SOK", color: "#52e252", accent: "#161616" },
  { name: "D. BRENNAN", code: "BRE", color: "#ffd400", accent: "#1a1a1a" },
  { name: "H. TANAKA", code: "TAN", color: "#ff2e88", accent: "#ffffff" },
  { name: "P. OLIVEIRA", code: "OLI", color: "#7a3cff", accent: "#ffd400" },
  { name: "S. KOWALSKI", code: "KOW", color: "#ff5a1f", accent: "#0b2230" },
  { name: "N. ADEYEMI", code: "ADE", color: "#00a86b", accent: "#ffffff" },
  { name: "C. ROUSSEAU", code: "ROU", color: "#3a86ff", accent: "#ffbe0b" },
  { name: "V. PETROV", code: "PET", color: "#8d99ae", accent: "#e63946" },
  { name: "Y. NAKAMURA", code: "NAK", color: "#e5383b", accent: "#f5f3f4" },
  { name: "G. FERRARO", code: "FER", color: "#b5179e", accent: "#4cc9f0" },
  { name: "O. HALVORSEN", code: "HAL", color: "#06d6a0", accent: "#073b4c" }
];
// ERS: the battery (0–1) charges under braking and deploys for extra shove. Strategy lives in
// the limits — a per-lap deploy budget, a per-lap harvest cap, and no deploying with DRS open.
export const ERS = {
  start: 0.6,
  power: 1.22, // engine force multiplier while deploying (also lifts top speed by about 7%)
  top: 1, // no separate top-speed bonus
  drain: 0.17, // battery per second of deployment (about 6s from full)
  perLap: 0.6, // most battery that can be spent in one lap
  harvest: 0.42, // battery per second of full braking from top speed
  harvestLap: 0.55 // most battery that can be recovered in one lap
};

// Track limits are looser than F1: the car must be clearly past the kerb for a moment, and the
// stewards give five warnings before handing out 3-second penalties.
export const LIMITS = { margin: 24, dwell: 0.25, minSpeed: 170, warnings: 5, penalty: 3 };
// Cutting a corner on the inside (more than ~15 m gained off the road) is penalised straight away
export const CUT_GAIN = 50;
export const CUT_PENALTY = 2;

export const PLAYER_LIVERY = { name: "YOU", code: "YOU", color: "#0088ff", accent: "#00f0ff" };

const TAU = Math.PI * 2;
const wrapAngle = (a) => {
  while (a > Math.PI) a -= TAU;
  while (a < -Math.PI) a += TAU;
  return a;
};
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

// ─────────────────────────── Track ───────────────────────────
function pathLength(path) {
  let L = 0;
  for (let i = 0; i < path.length; i++) {
    const a = path[i];
    const b = path[(i + 1) % path.length];
    L += Math.hypot(b[0] - a[0], b[1] - a[1]);
  }
  return L;
}

/** Build a raceable world track from a circuit definition { key, name, pts, lengthM, theme, night }. */
export function buildTrack(def) {
  const probe = fitCircuit(def.pts, 1760, 800, 0, STEP);
  const k = clamp((def.lengthM * PX_PER_M) / pathLength(probe), 3.2, 9);
  const margin = 520;
  const W = Math.round(1760 * k + margin * 2);
  const H = Math.round(800 * k + margin * 2);
  const path = fitCircuit(def.pts, W, H, margin, STEP);
  const n = path.length;
  const w = TRACK_WIDTH;

  const cum = new Float64Array(n + 1);
  const tan = [];
  const nor = [];
  for (let i = 0; i < n; i++) {
    const a = path[i];
    const b = path[(i + 1) % n];
    cum[i + 1] = cum[i] + Math.hypot(b[0] - a[0], b[1] - a[1]);
    const p = path[(i - 1 + n) % n];
    const q = path[(i + 1) % n];
    const len = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1;
    tan.push([(q[0] - p[0]) / len, (q[1] - p[1]) / len]);
    nor.push([-(q[1] - p[1]) / len, (q[0] - p[0]) / len]);
  }
  const L = cum[n];
  const radii = cornerRadii(path, 4);
  // Signed curvature (+ = turning toward +normal)
  const curv = path.map((b, i) => {
    const a = path[(i - 4 + n) % n];
    const c = path[(i + 4) % n];
    const cross = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
    return Math.sign(cross) / Math.max(1, radii[i]);
  });

  // Racing line: sit toward the inside of each corner, blurred so entries and exits swing wide
  const raw = curv.map((c) => clamp(c * 26000, -1, 1) * w * 0.34);
  const line = new Float64Array(n);
  const R = 22;
  for (let i = 0; i < n; i++) {
    let s = 0;
    let wsum = 0;
    for (let j = -R; j <= R; j++) {
      const wt = 1 - Math.abs(j) / (R + 1);
      s += raw[(i + j + n) % n] * wt;
      wsum += wt;
    }
    line[i] = clamp((s / wsum) * 1.35, -w * 0.34, w * 0.34);
  }
  // ...then relax it like an elastic band pulled tight between the edges: each point moves toward the
  // midpoint of its neighbours (coarse to fine), which converges on the least-curvature line that uses
  // the full width — outside on entry, clipping the apex, outside again on exit.
  const lim = w / 2 - 16;
  for (const [k, iters] of [[10, 80], [4, 120], [1, 160]]) {
    for (let it = 0; it < iters; it++) {
      for (let i = 0; i < n; i++) {
        const a = (i - k + n) % n;
        const b = (i + k) % n;
        const tx = (path[a][0] + nor[a][0] * line[a] + path[b][0] + nor[b][0] * line[b]) / 2;
        const ty = (path[a][1] + nor[a][1] * line[a] + path[b][1] + nor[b][1] * line[b]) / 2;
        const px = path[i][0] + nor[i][0] * line[i];
        const py = path[i][1] + nor[i][1] * line[i];
        line[i] = clamp(line[i] + ((tx - px) * nor[i][0] + (ty - py) * nor[i][1]) * 0.6, -lim, lim);
      }
    }
  }
  const linePath = path.map((p, i) => [p[0] + nor[i][0] * line[i], p[1] + nor[i][1] * line[i]]);
  const lineRadii = cornerRadii(linePath, 8);
  const lineDs = linePath.map((p, i) => {
    const q = linePath[(i + 1) % n];
    return Math.hypot(q[0] - p[0], q[1] - p[1]);
  });

  // Reference speed profile along the racing line at full grip (drives the line guide and DRS zones)
  const vmax = profileFor({ n, lineRadii, lineDs }, 1);

  // DRS: the longest flat-out runs (up to two) with detection points before them
  const flat = Array.from(vmax, (v) => v >= CAR.top * 0.985);
  const runs = [];
  let start = flat.indexOf(false);
  if (start < 0) start = 0;
  let cur = null;
  for (let k2 = 1; k2 <= n; k2++) {
    const i = (start + k2) % n;
    if (flat[i]) {
      if (!cur) cur = { from: i, len: 0 };
      cur.len++;
    } else if (cur) {
      runs.push(cur);
      cur = null;
    }
  }
  if (cur) runs.push(cur);
  const drs = runs
    .filter((r) => r.len * STEP > 900)
    .sort((a, b) => b.len - a.len)
    .slice(0, 2)
    .map((r) => {
      const from = (r.from + 12) % n;
      const to = (r.from + r.len - 6) % n;
      return { from, to, detect: (from - Math.round(1400 / STEP) + n) % n };
    });

  // Grid: staggered two-by-two behind the line
  const grid = [];
  for (let s = 0; s < 20; s++) {
    const i = (n - 5 - s * 7 + n * 2) % n;
    const side = s % 2 === 0 ? -1 : 1;
    const off = side * w * 0.22;
    grid.push({ x: path[i][0] + nor[i][0] * off, y: path[i][1] + nor[i][1] * off, heading: Math.atan2(tan[i][1], tan[i][0]), i });
  }

  const street = def.theme === "street";
  return {
    key: def.key,
    name: def.name,
    theme: def.theme || "park",
    night: !!def.night,
    lengthM: def.lengthM,
    W,
    H,
    path,
    n,
    cum,
    L,
    tan,
    nor,
    radii,
    curv,
    line,
    linePath,
    lineRadii,
    lineDs,
    profiles: new Map(),
    vmax,
    drs,
    grid,
    width: w,
    // Distance from the centreline where the car meets a wall / tyre barrier
    barrier: street ? w / 2 + 36 : w / 2 + 200,
    sectors: [Math.floor(n / 3), Math.floor((2 * n) / 3)],
    loopEvery: 20
  };
}

/**
 * Target speed at every point of the racing line for a driver using grip multiple m: the corner limit
 * on the line's own curvature, then braking zones propagated backwards (the brakes' full force, less a
 * small margin). This is the "speed plan" a driver follows.
 */
function profileFor(track, m) {
  const { n, lineRadii, lineDs } = track;
  const v = new Float64Array(n);
  for (let i = 0; i < n; i++) v[i] = Math.min(CAR.top * 1.2, cornerSpeed(Math.max(lineRadii[i], 8), m));
  const B = CAR.brake * 0.86;
  for (let pass = 0; pass < 2; pass++) {
    for (let i = n - 1; i >= 0; i--) {
      const nxt = v[(i + 1) % n];
      v[i] = Math.min(v[i], Math.sqrt(nxt * nxt + 2 * B * lineDs[i]));
    }
  }
  return v;
}

export function speedProfile(track, m) {
  const key = Math.round(m * 200);
  let prof = track.profiles.get(key);
  if (!prof) {
    prof = profileFor(track, key / 200);
    track.profiles.set(key, prof);
  }
  return prof;
}

/** Nearest point on the centreline. `hint` (last index) keeps it local and cheap. */
export function project(track, x, y, hint = -1) {
  const { path, n } = track;
  let best = Infinity;
  let bi = 0;
  let bt = 0;
  const scan = (i) => {
    const a = path[i];
    const b = path[(i + 1) % n];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const l2 = dx * dx + dy * dy || 1;
    let t = ((x - a[0]) * dx + (y - a[1]) * dy) / l2;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const px = a[0] + dx * t - x;
    const py = a[1] + dy * t - y;
    const d = px * px + py * py;
    if (d < best) {
      best = d;
      bi = i;
      bt = t;
    }
  };
  if (hint >= 0) for (let k = -30; k <= 50; k++) scan((hint + k + n) % n);
  if (hint < 0 || best > (track.width * 3) ** 2) for (let i = 0; i < n; i++) scan(i);
  const a = path[bi];
  const b = path[(bi + 1) % n];
  const sx = b[0] - a[0];
  const sy = b[1] - a[1];
  const cross = sx * (y - a[1]) - sy * (x - a[0]);
  const d = Math.sqrt(best) * (cross >= 0 ? 1 : -1);
  return { i: bi, s: track.cum[bi] + bt * (track.cum[bi + 1] - track.cum[bi]), d };
}

// ─────────────────────────── Cars ───────────────────────────
export function makeCar(id, livery, slot, opts = {}) {
  return {
    id,
    name: livery.name,
    code: livery.code,
    color: livery.color,
    accent: livery.accent,
    isPlayer: !!opts.isPlayer,
    skill: opts.skill || DIFFICULTY.medium,
    x: slot.x,
    y: slot.y,
    heading: slot.heading,
    vx: 0,
    vy: 0,
    speed: 0,
    fwd: 0,
    steer: 0,
    throttle: 0,
    brake: 0,
    sliding: 0,
    surface: "track",
    idx: slot.i,
    s: 0,
    d: 0,
    laps: -1, // becomes 0 when the car first crosses the line
    total: 0,
    lapStart: 0,
    lapTimes: [],
    bestLap: Infinity,
    lapValid: true,
    sector: 0,
    sectorStart: 0,
    sectorTimes: [null, null, null],
    bestSectors: [Infinity, Infinity, Infinity],
    loops: [],
    strikes: 0,
    penalty: 0,
    offTrack: false,
    offTime: 0,
    battery: ERS.start,
    ersOn: false,
    ersUsedLap: 0,
    ersHarvestLap: 0,
    drsEligible: false,
    drsOpen: false,
    slip: false,
    finished: false,
    finishTime: 0,
    lineBias: 0,
    wallHit: 0,
    noiseT: Math.random() * 100
  };
}

/**
 * Advance one car. input = { throttle, brake, steer, handbrake }; mods = { power, grip, top }.
 * Returns true when it touched a wall/barrier this step.
 */
export function stepCar(car, input, track, dt, mods = {}) {
  const power = mods.power ?? 1;
  const gripMult = mods.grip ?? 1;
  const topMult = mods.top ?? 1;
  const dirX = Math.cos(car.heading);
  const dirY = Math.sin(car.heading);
  let fwd = car.vx * dirX + car.vy * dirY;
  let lat = -car.vx * dirY + car.vy * dirX;

  const onTrack = Math.abs(car.d) <= track.width / 2 + 6;
  const onKerb = !onTrack && Math.abs(car.d) <= track.width / 2 + 16;
  car.surface = onTrack ? "track" : onKerb ? "kerb" : "grass";
  const top = CAR.top * topMult * (onTrack ? 1 : onKerb ? 0.9 : 0.45);

  // Longitudinal: traction-limited off the line, power-limited at speed, aero drag sets top speed
  const thrust = CAR.power * Math.min(1, CAR.powerSpeed / Math.max(1, fwd));
  if (input.throttle > 0 && fwd > -20) fwd += input.throttle * thrust * power * dt;
  if (input.brake > 0) {
    if (fwd > 25) fwd = Math.max(0, fwd - input.brake * CAR.brake * (mods.brake ?? 1) * dt);
    else fwd = Math.max(-170, fwd - 420 * input.brake * dt);
  }
  if (input.throttle > 0 && fwd < -20) fwd = Math.min(0, fwd + 900 * dt);
  const dragK = (CAR.power * CAR.powerSpeed) / (top * top * top);
  const drag = 10 + dragK * fwd * fwd;
  fwd -= Math.sign(fwd) * Math.min(Math.abs(fwd), drag * dt);
  if (!onTrack && !onKerb) fwd *= Math.exp(-1.4 * dt);
  if (fwd > top) fwd = Math.max(top, fwd - 900 * dt);

  // Steering: bicycle model, capped by available lateral grip
  const steerRate = input.steerRate || (car.isPlayer ? 7 : 10);
  car.steer += clamp(input.steer - car.steer, -steerRate * dt, steerRate * dt);
  const maxSteer = maxSteerAt(fwd);
  let yaw = (fwd * Math.tan(car.steer * maxSteer)) / CAR.wheelbase;
  const surfaceGrip = onTrack ? 1 : onKerb ? 0.75 : 0.5;
  // Friction circle: hard braking or wheelspin eats into the grip left for turning
  const longUse = Math.max((input.brake ?? 0) * (fwd > 60 ? 0.35 : 0), (input.throttle ?? 0) * 0.25 * Math.max(0, 1 - Math.abs(fwd) / CAR.top));
  const G = gripAt(Math.abs(fwd)) * gripMult * surfaceGrip * (input.handbrake ? 0.75 : 1) * (1 - longUse);
  const need = Math.abs(yaw * fwd);
  car.sliding = need > G ? Math.min(1, (need - G) / G) : Math.max(0, car.sliding - dt * 3);
  if (need > G && Math.abs(fwd) > 1) {
    yaw = (Math.sign(yaw) * G) / Math.abs(fwd);
    // Past the limit the tyres scrub: the car runs wide AND bleeds speed
    const excess = Math.min(1, (need - G) / need);
    fwd -= Math.sign(fwd) * Math.min(Math.abs(fwd), excess * 650 * dt);
  }
  // Kerbs rattle the car and cost speed
  if (onKerb && Math.abs(fwd) > 150) fwd *= Math.exp(-0.35 * dt);
  if (input.handbrake && Math.abs(fwd) > 120) {
    yaw += car.steer * 1.4;
    fwd *= Math.exp(-0.5 * dt);
  }
  car.heading = wrapAngle(car.heading + yaw * dt);

  // Lateral slip decays with grip (low grip = drift)
  const latDamp = input.handbrake ? 1.6 : onTrack ? 10 : 4.5;
  lat *= Math.exp(-latDamp * dt);
  if (input.handbrake) car.sliding = Math.max(car.sliding, Math.min(1, Math.abs(lat) / 200));

  const nx = Math.cos(car.heading);
  const ny = Math.sin(car.heading);
  car.vx = nx * fwd - ny * lat;
  car.vy = ny * fwd + nx * lat;
  car.x += car.vx * dt;
  car.y += car.vy * dt;
  car.fwd = fwd;
  car.throttle = input.throttle;
  car.brake = input.brake;

  // Re-project and keep the car inside walls / tyre barriers
  const pr = project(track, car.x, car.y, car.idx);
  car.idx = pr.i;
  car.d = pr.d;
  car.s = pr.s;
  let hit = false;
  if (Math.abs(pr.d) > track.barrier) {
    const over = Math.abs(pr.d) - track.barrier;
    const nrm = track.nor[pr.i];
    const sgn = Math.sign(pr.d);
    car.x -= nrm[0] * sgn * over;
    car.y -= nrm[1] * sgn * over;
    const vn = car.vx * nrm[0] + car.vy * nrm[1];
    if (vn * sgn > 0) {
      car.vx -= nrm[0] * vn * 1.3;
      car.vy -= nrm[1] * vn * 1.3;
    }
    car.vx *= 0.8;
    car.vy *= 0.8;
    car.d = sgn * track.barrier;
    hit = true;
    car.wallHit = 0.3;
  }
  car.wallHit = Math.max(0, car.wallHit - dt);
  car.speed = Math.hypot(car.vx, car.vy);
  return hit;
}

// ─────────────────────────── AI ───────────────────────────
export function aiInput(car, race, dt) {
  const track = race.track;
  const { n, path, nor, line } = track;
  const sk = car.skill;
  const fwd = Math.max(0, car.fwd);

  // Follow a speed plan for this driver's grip: weaker drivers leave more margin in every corner
  const m = sk.grip * (0.975 - sk.noise * 0.45);
  const prof = speedProfile(track, m);
  const look = 1 + Math.round((fwd * 0.04) / STEP);
  let target = Math.min(prof[(car.idx + look) % n], CAR.top * sk.pace * (car.drsOpen ? 1.12 : 1) * (car.slip ? 1.05 : 1) * 1.02);

  // Racecraft: don't drive into the car ahead on the same piece of road
  for (const o of race.cars) {
    if (o === car) continue;
    const gap = o.total - car.total;
    if (gap > 0 && gap < 90 && Math.abs(o.d - car.d) < 26) target = Math.min(target, Math.max(0, o.fwd) + (gap - 34) * 2.5);
  }
  car.aiTarget = target;

  // Stanley path tracking: align with the (slightly previewed) path heading and close the
  // cross-track error to the racing line, scaled by speed so it stays stable at any pace.
  const preview = (car.idx + 2 + Math.round(fwd * 0.06 / STEP)) % n;
  const tn = track.tan[preview];
  const headingErr = wrapAngle(Math.atan2(tn[1], tn[0]) - car.heading);
  const wantD = clamp(line[preview] + car.lineBias, -(track.width / 2 - 16), track.width / 2 - 16);
  const cross = car.d - wantD;
  car.noiseT += dt;
  const wobble = sk.noise ? Math.sin(car.noiseT * 1.7) * sk.noise * 0.12 : 0;
  const delta = headingErr + Math.atan((-2.2 * cross) / (fwd + 40)) + wobble;
  const edge = Math.abs(car.d) - (track.width / 2 - 12);
  const recover = edge > 0 ? -Math.sign(car.d) * Math.min(1, edge / 10) : 0;
  const steer = clamp(delta / maxSteerAt(fwd) + recover, -1, 1);

  let throttle = 0;
  let brake = 0;
  if (fwd > target + 6) brake = clamp((fwd - target) / 22, 0.35, 1);
  else throttle = clamp((target - fwd) / 30 + 0.5, 0, 1);
  // Exit traction: feed the throttle in while still turning, and lift when running out of road
  if (throttle > 0) {
    // Lift only when the tyres are actually saturated (sliding), not just because the car is turning
    throttle *= clamp(1 - car.sliding * 2.5, 0.3, 1);
    if (edge > -24 && Math.sign(car.d) === Math.sign(car.d - wantD)) throttle *= clamp(1 - (edge + 24) / 30, 0.15, 1);
  }
  // Launch: full beans off the line
  if (fwd < 60 && race.phase === "racing") throttle = 1;
  // ERS: deploy out of slow corners and when attacking or defending, keeping budget for later in the lap
  const lapFrac = (((car.s / track.L) % 1) + 1) % 1;
  const budgetLeft = ERS.perLap - car.ersUsedLap;
  const pressure = (car.gapAhead > 0 && car.gapAhead < 1.2) || car.defending;
  const exit = fwd < CAR.top * 0.7 && throttle > 0.8;
  const spare = budgetLeft > ERS.perLap * (1 - lapFrac) * 0.6;
  const ers = throttle > 0.8 && car.battery > 0.08 && (exit || pressure || spare) && (sk.pace >= 0.8 || exit);
  return { throttle, brake, steer, handbrake: false, drs: true, ers };
}

// ─────────────────────────── Race ───────────────────────────
/**
 * mode: "gp" (20 cars) | "duel" (you + 1 bot) | "trial" (you alone, flying laps) | "demo" (AI only)
 */
function seededRand(seed) {
  let r = seed >>> 0 || 1;
  return () => {
    r = (r + 0x6d2b79f5) >>> 0;
    let t = r;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The AI drivers for a race, quickest first: [{ id, livery, skill }]. A Grand Prix field is spread
 * around the chosen difficulty (front-runners a touch quicker); a duel bot drives at exactly that level.
 */
export function makeField({ mode, difficulty = "medium", seed = 1 }) {
  const rand = seededRand(seed ^ 0x9e3779b9);
  const base = DIFFICULTY[difficulty] || DIFFICULTY.medium;
  const count = mode === "gp" ? 19 : mode === "duel" ? 1 : mode === "demo" ? 10 : 0;
  const drivers = DRIVERS.slice();
  for (let k = drivers.length - 1; k > 0; k--) {
    const j = Math.floor(rand() * (k + 1));
    [drivers[k], drivers[j]] = [drivers[j], drivers[k]];
  }
  // "Mixed": the grid spans every level from Noob to Impossible, quickest first
  const levels = difficulty === "mixed" ? DIFFICULTY_ORDER.slice().reverse() : null;
  const mid = (count - 1) / 2;
  return Array.from({ length: count }, (_, rank) => {
    const liv = drivers[rank % drivers.length];
    let skill;
    if (levels) skill = { ...DIFFICULTY[levels[Math.min(levels.length - 1, Math.floor((rank * levels.length) / count))]] };
    else {
      // Spread the field around the chosen level: front-runners a touch quicker
      const spread = mode === "duel" ? 0 : ((mid - rank) / Math.max(1, mid)) * 0.05;
      skill = { ...base, pace: base.pace + spread, grip: base.grip + spread * 0.6 };
    }
    return { id: `ai${rank}`, livery: rank >= DRIVERS.length ? { ...liv, code: liv.code + rank } : liv, skill };
  });
}

/**
 * One flying lap for an AI driver on an empty track (qualifying). Returns the lap time in seconds,
 * with a little random "form" so the order isn't identical every weekend.
 */
export function qualifyingLap(track, skill, rand = Math.random) {
  const race = createRace({ track, mode: "trial", seed: 1 });
  const car = race.cars[0];
  car.isPlayer = false;
  car.skill = skill;
  race.player = null;
  const dt = 1 / 120;
  for (let k = 0; k < 400 * 120; k++) {
    stepRace(race, null, dt);
    const lap = car.lapTimes.find((l) => l.valid);
    if (lap) return lap.time * (1 + (rand() - 0.5) * 0.008);
    if (car.lapTimes.length > 3) break;
  }
  return Infinity;
}

export function createRace({ track, mode, laps = 5, difficulty = "medium", seed = 1, grid = null }) {
  const rand = seededRand(seed);
  const cars = [];
  // Grid order, front to back: "player" or a field entry. By default the player starts in the middle
  // of a GP grid, second in a duel, and alone in a time trial.
  if (!grid) {
    const field = makeField({ mode, difficulty, seed });
    const playerSlot = mode === "gp" ? 6 : mode === "duel" ? 1 : 0;
    grid = mode === "demo" ? field : [...field.slice(0, playerSlot), "player", ...field.slice(playerSlot)];
  }
  grid.forEach((entry, k) => {
    if (entry === "player") cars.push(makeCar("player", PLAYER_LIVERY, track.grid[k], { isPlayer: true }));
    else cars.push(makeCar(entry.id, entry.livery, track.grid[k], { skill: entry.skill }));
  });
  for (const c of cars) {
    const pr = project(track, c.x, c.y, -1);
    c.idx = pr.i;
    c.s = pr.s;
    c.d = pr.d;
    c.total = pr.s - track.L; // behind the line on the grid
  }
  cars.forEach((c, k) => {
    c.pos = k + 1;
    c.gapAhead = 0;
    c.gapLeader = 0;
  });
  return {
    track,
    mode,
    laps: mode === "trial" ? Infinity : laps,
    difficulty,
    cars,
    player: cars.find((c) => c.isPlayer) || null,
    t: 0, // race clock (starts at lights out)
    clock: 0,
    phase: mode === "trial" ? "racing" : "lights",
    lights: 0,
    lightsOutAt: 4.6 + rand() * 1.1,
    reaction: null,
    flag: false, // chequered flag shown
    events: [],
    bestLap: Infinity,
    bestLapBy: null,
    bestSectors: [Infinity, Infinity, Infinity],
    order: cars.slice(),
    rand
  };
}

function emit(race, ev) {
  race.events.push(ev);
}

function crossLine(race, car) {
  const t = race.t;
  if (car.laps < 0) {
    car.laps = 0;
    car.lapStart = t;
    car.sectorStart = t;
    car.sector = 0;
    car.lapValid = true;
    return;
  }
  const lapTime = t - car.lapStart;
  const valid = car.lapValid;
  car.lapTimes.push({ time: lapTime, valid });
  car.laps += 1;
  const personalBest = valid && lapTime < car.bestLap;
  if (personalBest) car.bestLap = lapTime;
  let fastest = false;
  if (valid && lapTime < race.bestLap) {
    race.bestLap = lapTime;
    race.bestLapBy = car.id;
    fastest = true;
  }
  emit(race, { type: "lap", car: car.id, time: lapTime, valid, personalBest, fastest, lap: car.laps });
  car.ersUsedLap = 0;
  car.ersHarvestLap = 0;
  car.lapStart = t;
  car.lapValid = true;
  if (race.mode !== "trial" && (car.laps >= race.laps || race.flag)) {
    car.finished = true;
    car.finishTime = t;
    if (!race.flag) {
      race.flag = true;
      emit(race, { type: "flag", car: car.id });
    }
    emit(race, { type: "finish", car: car.id, time: t });
  }
}

function sectorDone(race, car, k) {
  const t = race.t;
  const st = t - car.sectorStart;
  car.sectorStart = t;
  car.sectorTimes[k] = st;
  let color = "yellow";
  if (car.lapValid && st < car.bestSectors[k]) {
    car.bestSectors[k] = st;
    color = "green";
  }
  if (car.lapValid && st < race.bestSectors[k]) {
    race.bestSectors[k] = st;
    color = "purple";
  }
  car.sectorColors = car.sectorColors || [null, null, null];
  car.sectorColors[k] = car.lapValid ? color : "red";
  emit(race, { type: "sector", car: car.id, sector: k, time: st, color: car.sectorColors[k] });
}

function trackProgress(race, car, prevIdx) {
  const track = race.track;
  const { n } = track;
  const [s1, s2] = track.sectors;
  const moved = (car.idx - prevIdx + n) % n;
  const forward = moved > 0 && moved < n / 2;
  const back = moved >= n / 2;
  // Line crossing (index wraps n-1 → 0)
  if (forward && car.idx < prevIdx) {
    if (car.laps < 0 || car.sector === 2) {
      if (car.laps >= 0) sectorDone(race, car, 2);
      crossLine(race, car);
      car.sector = 0;
      car.sectorColors = [null, null, null];
    }
  } else if (back && car.idx > prevIdx && car.laps >= 0) {
    // Reversed over the line: undo the lap start so it can't be farmed
    car.sector = 2;
  }
  if (car.laps >= 0) {
    if (car.sector === 0 && forward && prevIdx < s1 && car.idx >= s1) {
      sectorDone(race, car, 0);
      car.sector = 1;
    } else if (car.sector === 1 && forward && prevIdx < s2 && car.idx >= s2) {
      sectorDone(race, car, 1);
      car.sector = 2;
    }
  }
  const lapBase = car.laps < 0 ? -track.L : car.laps * track.L;
  // Before the first crossing the car sits at the end of the lap; after it, near the start
  car.total = lapBase + (car.laps < 0 ? car.s : car.s > track.L * 0.9 && car.sector === 0 ? car.s - track.L : car.s);

  // Timing loops for live gaps
  const loopsPerLap = Math.ceil(n / track.loopEvery);
  const g = Math.floor(car.total / (track.L / loopsPerLap));
  if (car.loops.length === 0 || g > car.loops.length - 1 + (car.loopBase ?? 0)) {
    if (car.loopBase == null) car.loopBase = g;
    while (car.loops.length - 1 + car.loopBase < g) car.loops.push(race.t);
  }
}

function loopTime(car, g) {
  if (car.loopBase == null) return null;
  const k = g - car.loopBase;
  return k >= 0 && k < car.loops.length ? car.loops[k] : null;
}

/** Advance the race. playerInput may be null (demo / AI-only). */
export function stepRace(race, playerInput, dt) {
  const track = race.track;
  race.events.length = 0;
  race.clock += dt;

  if (race.phase === "lights") {
    const lit = Math.min(5, Math.floor(race.clock / 0.85));
    if (lit !== race.lights) {
      race.lights = lit;
      emit(race, { type: "light", count: lit });
    }
    if (race.clock >= race.lightsOutAt) {
      race.phase = "racing";
      race.lights = 0;
      race.t = 0;
      emit(race, { type: "go" });
    }
    // Cars sit on the grid; the player can build revs
    for (const c of race.cars) c.throttle = c.isPlayer && playerInput ? playerInput.throttle : 0.3;
    return;
  }
  if (race.phase === "finished") return;
  race.t += dt;
  if (race.reaction == null && playerInput && playerInput.throttle > 0) {
    race.reaction = race.t;
    emit(race, { type: "reaction", time: race.t });
  }

  // Order by track position for DRS / slipstream / gaps
  const byPos = race.cars.slice().sort((a, b) => (b.finished - a.finished) || (a.finished && b.finished ? a.finishTime - b.finishTime : b.total - a.total));

  for (const car of race.cars) {
    if (car.finished && race.mode !== "trial") {
      // Cool-down: roll on gently along the racing line
      const inp = aiInput(car, race, dt);
      inp.throttle = Math.min(inp.throttle, 0.35);
      stepCar(car, inp, track, dt, { power: 0.6 });
      continue;
    }
    const input = car.isPlayer ? playerInput || { throttle: 0, brake: 0, steer: 0, handbrake: false, drs: false } : aiInput(car, race, dt);

    // DRS: eligible within 1s of the car ahead at the detection point (always in a time trial)
    const zone = track.drs.find((z) => (z.from <= z.to ? car.idx >= z.from && car.idx <= z.to : car.idx >= z.from || car.idx <= z.to));
    // "DRS enabled" is announced on entering the activation zone, not back at the detection point
    if (zone && !car.inDrsZone && car.drsEligible && car.isPlayer) emit(race, { type: "drsReady", car: car.id });
    car.inDrsZone = !!zone;
    if (!zone) {
      if (car.drsOpen) car.drsOpen = false;
    } else if (car.drsEligible && input.drs && !car.drsOpen && input.brake < 0.1) {
      car.drsOpen = true;
      if (car.isPlayer) emit(race, { type: "drs", car: car.id });
    }
    if (car.drsOpen && input.brake > 0.1) car.drsOpen = false;

    // Slipstream: tucked in behind another car
    car.slip = false;
    for (const o of race.cars) {
      if (o === car) continue;
      const dx = o.x - car.x;
      const dy = o.y - car.y;
      const along = dx * Math.cos(car.heading) + dy * Math.sin(car.heading);
      const side = Math.abs(-dx * Math.sin(car.heading) + dy * Math.cos(car.heading));
      if (along > 30 && along < 240 && side < 26) {
        car.slip = true;
        break;
      }
    }

    // ERS deploy: blocked while DRS is open, capped per lap, needs charge and throttle
    const ersBudget = ERS.perLap - car.ersUsedLap;
    const wantErs = !!input.ers && race.phase === "racing";
    const canErs = wantErs && !car.drsOpen && car.battery > 0.002 && ersBudget > 0.002 && (input.throttle ?? 0) > 0.3 && car.fwd > 30;
    if (car.isPlayer && wantErs && !canErs && !car.ersBlockedShown) {
      car.ersBlockedShown = true;
      const reason = car.drsOpen ? "drs" : car.battery <= 0.002 ? "empty" : ersBudget <= 0.002 ? "lap" : "throttle";
      emit(race, { type: "ersBlocked", car: car.id, reason });
    }
    if (!wantErs || canErs) car.ersBlockedShown = false;
    if (canErs) {
      const use = Math.min(car.battery, ersBudget, ERS.drain * dt);
      car.battery -= use;
      car.ersUsedLap += use;
    }
    car.ersOn = canErs;
    const ersPow = canErs ? ERS.power : 1;
    const ersTop = canErs ? ERS.top : 1;

    const mods = car.isPlayer
      ? { power: ersPow, top: ersTop * (car.drsOpen ? 1.12 : 1) * (car.slip ? 1.05 : 1), brake: input.brakeMult ?? 1 }
      : { power: Math.sqrt(car.skill.pace) * ersPow, grip: car.skill.grip, top: ersTop * car.skill.pace * (car.drsOpen ? 1.12 : 1) * (car.slip ? 1.05 : 1) };
    const prevIdx = car.idx;
    const hit = stepCar(car, input, track, dt, mods);
    if (hit && car.isPlayer) emit(race, { type: "wall", car: car.id, speed: car.speed });

    // Harvest under braking (MGU-K), capped per lap
    if ((input.brake ?? 0) > 0.05 && car.fwd > 60 && car.battery < 1) {
      const room = Math.max(0, ERS.harvestLap - car.ersHarvestLap);
      const h = Math.min(room, 1 - car.battery, input.brake * ERS.harvest * Math.min(1, car.fwd / CAR.top) * dt);
      car.battery += h;
      car.ersHarvestLap += h;
    }

    // Track limits: clearly past the kerb, for a moment, at speed. Kerb-hopping is fine.
    const off = Math.abs(car.d) > track.width / 2 + LIMITS.margin;
    car.offTime = off ? car.offTime + dt : 0;
    if (off && !car.offTrack && car.laps >= 0 && car.speed > LIMITS.minSpeed && car.offTime >= LIMITS.dwell) {
      car.offTrack = true;
      car.lapValid = false;
      car.strikes += 1;
      let pen = 0;
      if (race.mode !== "trial" && car.strikes > LIMITS.warnings) {
        pen = LIMITS.penalty;
        car.penalty += pen;
      }
      emit(race, { type: "limits", car: car.id, strikes: car.strikes, penalty: pen, warnings: LIMITS.warnings });
    } else if (!off && Math.abs(car.d) < track.width / 2) {
      car.offTrack = false;
    }

    // Corner cutting (separate from the lenient running-wide limits): ground gained off the road on
    // the INSIDE of a corner, e.g. straight across a chicane, costs 2 s in a race and deletes the lap.
    const offRoad = Math.abs(car.d) > track.width / 2 + 16;
    const moved = (car.idx - prevIdx + track.n) % track.n;
    if (offRoad && moved < track.n / 2 && Math.sign(car.d) === Math.sign(track.curv[car.idx])) car.cutGain = (car.cutGain || 0) + moved * STEP;
    if (!offRoad && car.cutGain) {
      if (car.cutGain > CUT_GAIN && car.laps >= 0) {
        car.lapValid = false;
        const pen = race.mode !== "trial" ? CUT_PENALTY : 0;
        car.penalty += pen;
        emit(race, { type: "cut", car: car.id, penalty: pen });
      }
      car.cutGain = 0;
    }

    const before = car.idx;
    trackProgress(race, car, prevIdx);
    // DRS detection
    for (const z of track.drs) {
      const passed = (z.detect - prevIdx + track.n) % track.n;
      const movedBy = (before - prevIdx + track.n) % track.n;
      if (movedBy > 0 && movedBy < track.n / 2 && passed > 0 && passed <= movedBy) {
        if (race.mode === "trial") car.drsEligible = true;
        else {
          const pos = byPos.indexOf(car);
          const ahead = pos > 0 ? byPos[pos - 1] : null;
          const gap = ahead ? gapBetween(race, ahead, car) : Infinity;
          car.drsEligible = car.laps >= 1 && gap < 1.0;
        }
      }
    }
  }

  // Car-to-car contact
  const cars = race.cars;
  for (let a = 0; a < cars.length; a++) {
    for (let b = a + 1; b < cars.length; b++) {
      const A = cars[a];
      const B = cars[b];
      const dx = B.x - A.x;
      const dy = B.y - A.y;
      const d2 = dx * dx + dy * dy;
      const min = CAR.radius * 2;
      if (d2 > 0 && d2 < min * min) {
        const d = Math.sqrt(d2);
        const nx = dx / d;
        const ny = dy / d;
        const push = (min - d) / 2;
        A.x -= nx * push;
        A.y -= ny * push;
        B.x += nx * push;
        B.y += ny * push;
        const rv = (B.vx - A.vx) * nx + (B.vy - A.vy) * ny;
        if (rv < 0) {
          const j = -rv * 0.65;
          A.vx -= nx * j;
          A.vy -= ny * j;
          B.vx += nx * j;
          B.vy += ny * j;
        }
        if ((A.isPlayer || B.isPlayer) && Math.abs(rv) > 60) emit(race, { type: "contact", speed: Math.abs(rv) });
      }
    }
  }

  // AI racecraft. Attack: when closing on the car ahead, go for the inside of the next corner (or the
  // side it leaves open). Defend: with a quicker car right behind before a corner, cover the inside.
  const { n: tn, curv, line: tline, width: tw } = track;
  const insideOfNextCorner = (idx) => {
    let c = 0;
    for (let k = 8; k < 70; k += 3) c += curv[(idx + k) % tn];
    return Math.abs(c) > 0.004 ? Math.sign(c) : 0;
  };
  for (const car of cars) {
    if (car.isPlayer || car.finished) continue;
    let want = 0;
    let ahead = null;
    let aheadGap = Infinity;
    let behind = null;
    let behindGap = Infinity;
    for (const o of cars) {
      if (o === car) continue;
      const gap = o.total - car.total;
      if (gap > 0 && gap < aheadGap) {
        aheadGap = gap;
        ahead = o;
      } else if (gap < 0 && -gap < behindGap) {
        behindGap = -gap;
        behind = o;
      }
    }
    const here = tline[car.idx];
    if (ahead && aheadGap < 170 && (car.fwd > ahead.fwd - 15 || aheadGap < 70)) {
      let side = insideOfNextCorner(car.idx) || Math.sign(car.d - ahead.d) || 1;
      // The door's shut on that side: take the other one
      if (Math.sign(ahead.d) === side && Math.abs(ahead.d) > tw * 0.18) side = -side;
      want = side * tw * 0.28 - here;
    } else if (behind && behindGap < 70 && behind.fwd > car.fwd - 10) {
      const inside = insideOfNextCorner(car.idx);
      if (inside) want = inside * tw * 0.2 - here;
    }
    car.lineBias += clamp(want - car.lineBias, -80 * dt, 80 * dt);
  }

  race.order = cars.slice().sort((a, b) => {
    if (a.finished !== b.finished) return a.finished ? -1 : 1;
    if (a.finished && b.finished) return a.finishTime - b.finishTime;
    return b.total - a.total;
  });
  for (let k = 0; k < race.order.length; k++) {
    const c = race.order[k];
    c.pos = k + 1;
    c.gapAhead = k > 0 ? gapBetween(race, race.order[k - 1], c) : 0;
    c.gapLeader = k > 0 ? gapBetween(race, race.order[0], c) : 0;
  }
  for (let k = 0; k < race.order.length; k++) {
    const behind = race.order[k + 1];
    race.order[k].defending = !!behind && behind.gapAhead > 0 && behind.gapAhead < 0.8;
  }
}

/** Seconds that `behind` trails `ahead`, from the timing loops (Infinity/laps if a lap down). */
export function gapBetween(race, ahead, behind) {
  if (ahead.finished && behind.finished) return behind.finishTime - ahead.finishTime;
  const g = behind.loops.length - 1 + (behind.loopBase ?? 0);
  if (behind.loopBase == null) return 0;
  const ta = loopTime(ahead, g);
  const tb = loopTime(behind, g);
  if (ta == null || tb == null) return 0;
  return Math.max(0, tb - ta);
}

/** Final classification: finished cars by time + penalties, the rest estimated from their pace. */
export function classify(race) {
  const L = race.track.L;
  const rows = race.cars.map((c) => {
    let time = c.finishTime;
    let est = false;
    if (!c.finished) {
      const pace = c.laps > 0 ? race.t / Math.max(0.2, c.total / L) : 60;
      const remaining = race.laps * L - c.total;
      time = race.t + Math.max(0, remaining / L) * pace;
      est = true;
    }
    const lapsDone = c.finished ? Math.max(0, c.laps) : race.laps;
    return { car: c, time: time + c.penalty, raw: time, est, lapsDone };
  });
  // Laps completed first (a lapped car can take the flag before the lead-lap runners), then time
  rows.sort((a, b) => b.lapsDone - a.lapsDone || a.time - b.time);
  rows.forEach((r, k) => {
    r.pos = k + 1;
    r.gap = k === 0 ? 0 : r.time - rows[0].time;
    r.lapsDown = rows[0].lapsDone - r.lapsDone;
  });
  return rows;
}
