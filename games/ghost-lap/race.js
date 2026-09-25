// Ghost Lap — pure race simulation (no DOM). Tracks at real-length scale, arcade car physics,
// AI drivers, lap/sector timing, track limits, DRS, ERS, slipstream and race classification.
import { fitCircuit, cornerRadii, resampleClosed } from "./circuits.js";

export const PX_PER_M = 3.3; // world pixels per real metre of circuit length
export const TRACK_WIDTH = 148;
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
  // Collision body: a capsule the size of the drawn car (44 px long, 21 px wide)
  bodyHalf: 11.5,
  bodyRad: 10.5,
  steerRate: 10 // fastest the steering can turn (per second), the same for every driver
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

// Every bot drives exactly the same car as the player: same engine, grip, brakes, ERS, DRS and tow.
// Levels differ only in the DRIVER: how close to the grip limit they take corners (corner), how late
// and hard they brake (brake: share of the car's full braking they plan on), how much throttle they
// dare use (commit), how tidy their line is (noise) and how quickly they react to the lights (react, s).
export const DIFFICULTY = {
  noob: { label: "NOOB", corner: 0.62, brake: 0.55, commit: 0.74, noise: 0.24, react: 0.5 },
  veryEasy: { label: "VERY EASY", corner: 0.7, brake: 0.63, commit: 0.82, noise: 0.17, react: 0.42 },
  easy: { label: "EASY", corner: 0.79, brake: 0.71, commit: 0.89, noise: 0.11, react: 0.35 },
  medium: { label: "MEDIUM", corner: 0.87, brake: 0.79, commit: 0.95, noise: 0.06, react: 0.29 },
  hard: { label: "HARD", corner: 0.92, brake: 0.84, commit: 0.98, noise: 0.03, react: 0.24 },
  veryHard: { label: "VERY HARD", corner: 0.97, brake: 0.91, commit: 1, noise: 0.01, react: 0.2 },
  impossible: { label: "IMPOSSIBLE", corner: 1.06, brake: 1.0, commit: 1, noise: 0, react: 0.16 }
};
DIFFICULTY.mixed = { ...DIFFICULTY.medium, label: "MIXED" };
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
// ERS: the battery (0–1) charges under braking and deploys for extra shove. Use it whenever there's
// charge (not with DRS open); every braking zone puts a chunk back, up to a cap on what one lap can
// recover, so the strategy is where to spend what the brakes give you.
export const ERS = {
  start: 0.8,
  power: 1.3, // engine force multiplier while deploying
  top: 1.04, // and about +13 km/h on the top speed
  drain: 0.1, // battery per second of deployment (10 s from full)
  harvest: 0.6, // battery per second of hard braking (a big stop is worth ~20-30%)
  harvestLap: 0.8 // most battery that can be recovered in one lap (~8 s of boost)
};

// Stewarding is looser than F1 but still fair. F1: all four wheels past the white line, three
// warnings, then a 5 s penalty; leaving the track and gaining an advantage, 5-10 s.
// Here:
// • Running wide only counts when the whole car is past the kerb for a moment AND it gained something
//   by it (came back carrying its speed). Run onto the grass and lose time: no strike. Five
//   warnings, then 3 s penalties.
// • Cutting a corner counts when the car takes a real shortcut across the inside at racing speed.
//   The first cut in a race is a warning; after that it's +2 s (+5 s for a huge shortcut).
// • Nothing counts in the second after contact with another car or a wall: you were pushed.
// • Any offence still deletes that lap's time (it can't set a best lap or a qualifying time).
export const LIMITS = { margin: 28, dwell: 0.25, minSpeed: 170, keep: 0.85, warnings: 5, penalty: 3, grace: 1 };
export const CUT_GAIN = 60; // px of the track (~18 m) gained across the inside before it counts
export const CUT_PENALTY = 2;
export const CUT_BIG = { gain: 200, penalty: 5 };

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

/**
 * The road is drawn much wider than a real one relative to the layout, so hairpin legs and parallel
 * sections (Zandvoort, Jeddah, Monaco, Baku…) can end up on top of each other. Push any two stretches
 * of road that run side by side apart until there's a strip of grass between them, spreading each
 * push smoothly along the track so the shape stays true. Sections that meet at a steep angle are
 * left alone (that's how Suzuka's bridge survives). If pushing ever shoves one part of a circuit
 * across another (only Suzuka, `crossover`, may cross itself), it retries with a narrower gap.
 */
function separateSections(path, need, step, crossover = false) {
  let best = null;
  for (const gap of [need, need - 20, need - 40]) {
    let pts = path.map((p) => [p[0], p[1]]);
    for (let round = 0; round < 3; round++) {
      const pushed = pushApart(pts, gap, step);
      pts = resampleClosed(pushed.pts, step);
      const eased = easeTightCorners(pts);
      pts = resampleClosed(eased.pts, step);
      if (!pushed.moved && !eased.moved) break;
    }
    best = pts;
    if (crossover || !crossesItself(pts, gap, step)) break;
  }
  return best;
}

/** True if two separate parts of the centreline come within half a road width (a false crossing). */
function crossesItself(pts, gap, step) {
  const n = pts.length;
  const minGap = Math.ceil((gap * 2.5) / step);
  const lim = TRACK_WIDTH / 2;
  const cell = lim;
  const grid = new Map();
  pts.forEach((p, i) => {
    const k = Math.floor(p[0] / cell) * 65536 + Math.floor(p[1] / cell);
    const list = grid.get(k);
    if (list) list.push(i);
    else grid.set(k, [i]);
  });
  for (let i = 0; i < n; i++) {
    const cx = Math.floor(pts[i][0] / cell);
    const cy = Math.floor(pts[i][1] / cell);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (const j of grid.get((cx + dx) * 65536 + cy + dy) || []) {
          if (Math.min(Math.abs(j - i), n - Math.abs(j - i)) < minGap) continue;
          if (Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1]) < lim) return true;
        }
      }
    }
  }
  return false;
}

function pushApart(input, need, step) {
  let pts = input;
  let moved = false;
  const n = pts.length;
  const minGap = Math.ceil((need * 2.5) / step);
  const cell = need;
  for (let iter = 0; iter < 120; iter++) {
    const grid = new Map();
    pts.forEach((p, i) => {
      const k = Math.floor(p[0] / cell) * 65536 + Math.floor(p[1] / cell);
      const list = grid.get(k);
      if (list) list.push(i);
      else grid.set(k, [i]);
    });
    const tan = pts.map((_, i) => {
      const a = pts[(i - 2 + n) % n];
      const b = pts[(i + 2) % n];
      const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      return [(b[0] - a[0]) / l, (b[1] - a[1]) / l];
    });
    const disp = pts.map(() => [0, 0]);
    let hits = 0;
    for (let i = 0; i < n; i++) {
      const p = pts[i];
      const cx = Math.floor(p[0] / cell);
      const cy = Math.floor(p[1] / cell);
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          for (const j of grid.get((cx + dx) * 65536 + cy + dy) || []) {
            if (j <= i) continue;
            const gap = Math.min(j - i, n - (j - i));
            if (gap < minGap) continue;
            if (Math.abs(tan[i][0] * tan[j][0] + tan[i][1] * tan[j][1]) < 0.5) continue;
            const vx = p[0] - pts[j][0];
            const vy = p[1] - pts[j][1];
            const d = Math.hypot(vx, vy) || 1;
            if (d >= need) continue;
            hits++;
            const f = ((need - d) / d) * 0.5;
            disp[i][0] += vx * f;
            disp[i][1] += vy * f;
            disp[j][0] -= vx * f;
            disp[j][1] -= vy * f;
          }
        }
      }
    }
    if (!hits) break;
    moved = true;
    // Spread each push along the road so corners bend rather than kink
    let sm = disp;
    for (let pass = 0; pass < 3; pass++) {
      const R = 10;
      sm = sm.map((_, i) => {
        let x = 0;
        let y = 0;
        for (let k = -R; k <= R; k++) {
          const q = sm[(i + k + n) % n];
          x += q[0];
          y += q[1];
        }
        return [x / (2 * R + 1), y / (2 * R + 1)];
      });
    }
    // The blur dilutes a push; scale it back so the worst overlap still moves by about its full depth
    let peakRaw = 0;
    let peakSm = 0;
    for (let i = 0; i < n; i++) {
      peakRaw = Math.max(peakRaw, Math.hypot(disp[i][0], disp[i][1]));
      peakSm = Math.max(peakSm, Math.hypot(sm[i][0], sm[i][1]));
    }
    const gain = peakSm > 0 ? Math.min(6, (peakRaw / peakSm) * 0.35) : 0;
    pts = pts.map((p, i) => [p[0] + sm[i][0] * gain, p[1] + sm[i][1] * gain]);
  }
  return { pts, moved };
}

// Pushing can pinch a corner tighter than the real one: ease any that fall under the tightest
// radius the unmodified layouts use (~48 px) back out, locally
function easeTightCorners(input) {
  let pts = input;
  let moved = false;
  for (let iter = 0; iter < 300; iter++) {
    const r = cornerRadii(pts, 4);
    let tight = 0;
    const m = pts.length;
    pts = pts.map((p, i) => {
      let worst = Infinity;
      for (let k = -4; k <= 4; k++) worst = Math.min(worst, r[(i + k + m) % m]);
      if (worst >= 48) return p;
      tight++;
      const a = pts[(i - 2 + m) % m];
      const b = pts[(i + 2) % m];
      return [p[0] + ((a[0] + b[0]) / 2 - p[0]) * 0.4, p[1] + ((a[1] + b[1]) / 2 - p[1]) * 0.4];
    });
    if (!tight) break;
    moved = true;
  }
  return { pts, moved };
}

// Brakes (Grand Prix option): carbon brakes work best from ~350 to ~950 °C. Braking heats them in
// proportion to the braking power (how hard x how fast); airflow cools them, more at speed. Cold
// brakes bite less, past 1000 °C they fade, and they wear with use: far faster when overheated.
// Worn-out brakes lose stopping power and run hotter. The same for every car on the grid.
export const BRAKES = {
  ambient: 180, // °C the discs settle to with no braking
  start: 420, // warmed up on the formation lap
  heat: 2100, // °C/s at full braking from top speed
  cool: 0.1, // share of the gap to ambient shed per second (x airflow)
  window: [350, 950],
  fade: 1000, // above this the brakes start to fade
  wear: 0.014, // life used per second of full braking from top speed (x more when overheating)
  worn: 0.3, // below this much life left the brakes lose bite
  regenShare: 0.2 // share of the braking the MGU-K does while it's harvesting
};
/** Share of full braking force the brakes can give at this temperature (°C) and life (0-1). */
export function brakeEfficiency(temp, life) {
  const cold = temp < BRAKES.window[0] ? 0.82 + (0.18 * clamp(temp - BRAKES.ambient, 0, 170)) / 170 : 1;
  const fade = temp > BRAKES.fade ? 1 - Math.min(0.5, ((temp - BRAKES.fade) / 400) * 0.5) : 1;
  const worn = life < BRAKES.worn ? 0.55 + (0.45 * Math.max(0, life)) / BRAKES.worn : 1;
  return cold * fade * worn;
}

// DRS: the gap to the car in front at the detection line that enables it
export const DRS_GAP = 1.0;

function updateBrakes(race, car, input, mods, fwdBefore, dt) {
  const v = Math.max(0, Math.min(fwdBefore, car.fwd)) / CAR.top;
  const b = fwdBefore > 25 && (input.brake ?? 0) > 0 ? input.brake * (mods.brake ?? 1) : 0;
  const worn = 1 + (1 - car.brakeLife) * 0.6;
  const heat = BRAKES.heat * b * v * worn * (car.harvesting ? 1 - BRAKES.regenShare : 1);
  const cool = BRAKES.cool * (car.brakeTemp - BRAKES.ambient) * (0.35 + v);
  const was = car.brakeTemp;
  car.brakeTemp = Math.max(BRAKES.ambient, car.brakeTemp + (heat - cool) * dt);
  const over = Math.max(0, (car.brakeTemp - BRAKES.fade) / 300);
  const lifeWas = car.brakeLife;
  car.brakeLife = Math.max(0, car.brakeLife - BRAKES.wear * b * v * (1 + 5 * over) * dt);
  car.brakeEff = brakeEfficiency(car.brakeTemp, car.brakeLife);
  if (!car.isPlayer) return;
  // Warn once per overheat: the warning re-arms after the brakes have cooled back into the window
  if (car.brakeTemp > BRAKES.fade && !car.brakeWarned) {
    car.brakeWarned = true;
    emit(race, { type: "brakesHot", car: car.id, temp: car.brakeTemp });
  } else if (car.brakeTemp < BRAKES.window[1] - 100) car.brakeWarned = false;
  if (lifeWas >= BRAKES.worn && car.brakeLife < BRAKES.worn) emit(race, { type: "brakesWorn", car: car.id });
}

// Wake behind a car: dirty air starts just off its gearbox and fades out ~9 car lengths back
export const DIRTY_AIR = { from: 40, reach: 380, width: 44, grip: 0.14 };
// How fast a bot can open the throttle (per second): the same as the quickest player setting
const AI_THROTTLE_RATE = 6.6;

/**
 * Solid cars: each car is a capsule the size of its body. Overlapping cars are pushed fully apart,
 * the closing speed is absorbed (a little bounce), side-by-side rubbing scrubs speed through friction,
 * and an off-centre hit twists the car. Two passes so a pile-up settles instead of cars sinking in.
 */
function resolveContacts(race) {
  const cars = race.cars;
  const HL = CAR.bodyHalf;
  const R = CAR.bodyRad;
  const reach = 2 * (HL + R);
  for (let pass = 0; pass < 2; pass++) {
    for (let a = 0; a < cars.length; a++) {
      for (let b = a + 1; b < cars.length; b++) {
        const A = cars[a];
        const B = cars[b];
        // Cars on their cool-down lap are out of the race: they no longer collide
        if (A.finished || B.finished) continue;
        if (Math.abs(B.x - A.x) > reach || Math.abs(B.y - A.y) > reach) continue;
        const [pa, pb] = closestOnBodies(A, B, HL);
        let nx = pb[0] - pa[0];
        let ny = pb[1] - pa[1];
        let d = Math.hypot(nx, ny);
        if (d >= 2 * R) continue;
        if (d < 1e-6) {
          nx = B.x - A.x || 1;
          ny = B.y - A.y;
          d = 0;
        }
        const len = Math.hypot(nx, ny) || 1;
        nx /= len;
        ny /= len;
        const push = (2 * R - d) / 2;
        A.x -= nx * push;
        A.y -= ny * push;
        B.x += nx * push;
        B.y += ny * push;
        if (pass) continue;
        const rv = (B.vx - A.vx) * nx + (B.vy - A.vy) * ny;
        if (rv < 0) {
          // Equal masses: share the closing speed, keeping 20% of it as a bounce
          const j = (-rv * 1.2) / 2;
          A.vx -= nx * j;
          A.vy -= ny * j;
          B.vx += nx * j;
          B.vy += ny * j;
          // Friction along the contact: rubbing cars drag each other toward the same speed
          const tx = -ny;
          const ty = nx;
          const rt = (B.vx - A.vx) * tx + (B.vy - A.vy) * ty;
          const f = clamp(rt / 2, -j * 0.35, j * 0.35);
          A.vx += tx * f;
          A.vy += ty * f;
          B.vx -= tx * f;
          B.vy -= ty * f;
          // A hit away from the middle of the car twists it
          const cx = (pa[0] + pb[0]) / 2;
          const cy = (pa[1] + pb[1]) / 2;
          for (const [car, sgn] of [[A, -1], [B, 1]]) {
            const rx = cx - car.x;
            const ry = cy - car.y;
            const torque = (rx * ny - ry * nx) * sgn * j;
            car.heading = wrapAngle(car.heading + clamp(torque * 0.00004, -0.08, 0.08));
          }
        }
        if (Math.abs(rv) > 40) A.lastHit = B.lastHit = race.t;
        if ((A.isPlayer || B.isPlayer) && Math.abs(rv) > 60) emit(race, { type: "contact", speed: Math.abs(rv) });
      }
    }
  }
}

/** Closest points between two cars' body centrelines (each a segment +/-HL along its heading). */
function closestOnBodies(A, B, HL) {
  const ax = Math.cos(A.heading) * HL;
  const ay = Math.sin(A.heading) * HL;
  const bx = Math.cos(B.heading) * HL;
  const by = Math.sin(B.heading) * HL;
  const p1x = A.x - ax;
  const p1y = A.y - ay;
  const p2x = B.x - bx;
  const p2y = B.y - by;
  const d1x = 2 * ax;
  const d1y = 2 * ay;
  const d2x = 2 * bx;
  const d2y = 2 * by;
  const rx = p1x - p2x;
  const ry = p1y - p2y;
  const a = d1x * d1x + d1y * d1y;
  const e = d2x * d2x + d2y * d2y;
  const f = d2x * rx + d2y * ry;
  const c = d1x * rx + d1y * ry;
  const bb = d1x * d2x + d1y * d2y;
  const den = a * e - bb * bb;
  let s = den > 1e-9 ? clamp((bb * f - c * e) / den, 0, 1) : 0;
  let t = (bb * s + f) / e;
  if (t < 0) {
    t = 0;
    s = clamp(-c / a, 0, 1);
  } else if (t > 1) {
    t = 1;
    s = clamp((bb - c) / a, 0, 1);
  }
  return [
    [p1x + d1x * s, p1y + d1y * s],
    [p2x + d2x * t, p2y + d2y * t]
  ];
}

/** Build a raceable world track from a circuit definition { key, name, pts, lengthM, theme, night }. */
export function buildTrack(def) {
  const probe = fitCircuit(def.pts, 1760, 800, 0, STEP);
  const k = clamp((def.lengthM * PX_PER_M) / pathLength(probe), 3.2, 9);
  const margin = 520;
  const W = Math.round(1760 * k + margin * 2);
  const H = Math.round(800 * k + margin * 2);
  const path = separateSections(fitCircuit(def.pts, W, H, margin, STEP), TRACK_WIDTH + 64, STEP, !!def.crossover);
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

  // DRS: as many zones as the real circuit has. Every real layout has one on the pit straight, so the
  // flat-out run through (or leading onto) the start line always gets one; the rest go to the longest
  // remaining flat-out runs. Detection sits ~420 m before each activation point.
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
  const wanted = def.drs ?? 2;
  const long = runs.filter((r) => r.len * STEP > 1000);
  // Distance (in points) from the end of a run forward to the start line: 0 if the run crosses it
  const toLine = (r) => {
    const end = r.from + r.len;
    return end >= n ? 0 : n - end;
  };
  // (Silverstone is the odd one out: its zones are Wellington and Hangar, not the pit straight)
  const main = def.drsMain === false ? null : long.slice().sort((a, b) => toLine(a) - toLine(b))[0];
  const chosen = main ? [main] : [];
  for (const r of long.slice().sort((a, b) => b.len - a.len)) {
    if (chosen.length >= wanted) break;
    if (!chosen.includes(r)) chosen.push(r);
  }
  const drs = chosen
    .sort((a, b) => a.from - b.from)
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
function profileFor(track, m, b = 0.86) {
  const { n, lineRadii, lineDs } = track;
  const v = new Float64Array(n);
  for (let i = 0; i < n; i++) v[i] = Math.min(CAR.top * 1.2, cornerSpeed(Math.max(lineRadii[i], 8), m));
  const B = CAR.brake * b;
  for (let pass = 0; pass < 2; pass++) {
    for (let i = n - 1; i >= 0; i--) {
      const nxt = v[(i + 1) % n];
      v[i] = Math.min(v[i], Math.sqrt(nxt * nxt + 2 * B * lineDs[i]));
    }
  }
  return v;
}

export function speedProfile(track, m, b = 0.86) {
  const km = Math.round(m * 200);
  const kb = Math.round(b * 100);
  const key = km * 1000 + kb;
  let prof = track.profiles.get(key);
  if (!prof) {
    prof = profileFor(track, km / 200, kb / 100);
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
  const steerRate = Math.min(CAR.steerRate, input.steerRate || CAR.steerRate);
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

  // Follow a speed plan: how close to the grip limit this driver corners and how late they brake.
  // In dirty air the car has less grip, and the driver knows it.
  const m = sk.corner * (1 - DIRTY_AIR.grip * (car.dirty || 0));
  // Brake management: plan on the braking the car actually has (cold, fading or worn brakes stop
  // shorter), and when they run hot, brake earlier and lighter (lift and coast) to let them cool
  const hot = car.brakeTemp > BRAKES.window[1] - 40;
  const prof = speedProfile(track, m, sk.brake * (car.brakeEff ?? 1) * (hot ? 0.8 : 1));
  const look = 1 + Math.round((fwd * 0.04) / STEP);
  let target = prof[(car.idx + look) % n];

  // Racecraft: don't drive into the car ahead on the same piece of road. A car that's stopped or
  // spun is an obstacle, not someone to queue behind: slow down and go round it.
  let dodge = null;
  for (const o of race.cars) {
    if (o === car || o.finished) continue;
    const gap = o.total - car.total;
    if (gap <= 0 || gap > 160) continue;
    const blocked = Math.abs(o.d - car.d) < CAR.bodyRad * 2 + 4;
    if (o.speed < 60) {
      if (gap < 160 && Math.abs(o.d - car.d) < CAR.bodyRad * 2 + 18) {
        const room = track.width / 2 - 14;
        const left = o.d - (CAR.bodyRad * 2 + 16);
        const right = o.d + (CAR.bodyRad * 2 + 16);
        dodge = Math.abs(left) <= room && (Math.abs(right) > room || Math.abs(left - car.d) < Math.abs(right - car.d)) ? left : right;
        target = Math.min(target, 140);
      }
    } else if (blocked && gap < 110) target = Math.min(target, Math.max(0, o.fwd) + (gap - 52) * 2.5);
  }
  car.aiTarget = target;

  // Stanley path tracking: align with the (slightly previewed) path heading and close the
  // cross-track error to the racing line, scaled by speed so it stays stable at any pace.
  const preview = (car.idx + 2 + Math.round(fwd * 0.06 / STEP)) % n;
  const tn = track.tan[preview];
  const headingErr = wrapAngle(Math.atan2(tn[1], tn[0]) - car.heading);
  const wantD = clamp(dodge ?? line[preview] + car.lineBias, -(track.width / 2 - 16), track.width / 2 - 16);
  const cross = car.d - wantD;
  car.noiseT += dt;
  const wobble = sk.noise ? Math.sin(car.noiseT * 1.7) * sk.noise * 0.12 : 0;
  const delta = headingErr + Math.atan((-2.2 * cross) / (fwd + 40)) + wobble;
  const edge = Math.abs(car.d) - (track.width / 2 - 12);
  const recover = edge > 0 ? -Math.sign(car.d) * Math.min(1, edge / 10) : 0;
  const steer = clamp(delta / maxSteerAt(fwd) + recover, -1, 1);

  let throttle = 0;
  let brake = 0;
  if (fwd > target + 6) brake = clamp((fwd - target) / 22, 0.35, hot ? 0.75 : 1);
  else throttle = clamp((target - fwd) / 30 + 0.5, 0, 1);
  // Exit traction: feed the throttle in while still turning, and lift when running out of road
  if (throttle > 0) {
    // Lift only when the tyres are actually saturated (sliding), not just because the car is turning
    throttle *= clamp(1 - car.sliding * 2.5, 0.3, 1);
    if (edge > -24 && Math.sign(car.d) === Math.sign(car.d - wantD)) throttle *= clamp(1 - (edge + 24) / 30, 0.15, 1);
  }
  // Launch: full beans off the line, once the driver has reacted to the lights
  if (fwd < 60 && race.phase === "racing") throttle = race.t < (car.react || 0) ? 0 : 1;
  // Less confident drivers never use all the throttle (same car, less of it)
  throttle = Math.min(throttle, sk.commit ?? 1);

  // Stuck (spun, facing the wall, wedged against another car): back out and turn to face the road
  if (race.phase === "racing" && !car.finished && race.t > (car.react || 0) + 1) {
    const lost = Math.abs(headingErr) > 1.4;
    if (car.speed < 25 || (lost && fwd < 120)) car.stuckT = (car.stuckT || 0) + dt;
    else car.stuckT = 0;
    if (car.stuckT > 0.8 && !car.recoverT) car.recoverT = 1.1;
  }
  if (car.recoverT > 0) {
    car.recoverT = Math.max(0, car.recoverT - dt);
    if (!car.recoverT) car.stuckT = 0;
    // Reversing turns the car the other way, so steer against the error
    return { throttle: 0, brake: 1, steer: clamp(-headingErr * 2, -1, 1), handbrake: false, drs: false, ers: false };
  }
  // ERS: deploy out of slow corners and when attacking or defending; spend freely when the battery's full
  const pressure = (car.gapAhead > 0 && car.gapAhead < 1.2) || car.defending;
  const exit = fwd < CAR.top * 0.7 && throttle > 0.8;
  const spare = car.battery > 0.5;
  const ers = throttle > 0.8 && car.battery > 0.08 && (exit || pressure || spare) && (sk.corner >= 0.84 || exit);
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
      skill = {
        ...base,
        corner: clamp(base.corner + spread * 0.5, 0.5, 1.08),
        brake: clamp(base.brake + spread * 0.5, 0.45, 1),
        commit: clamp(base.commit + spread * 0.4, 0.55, 1)
      };
    }
    return { id: `ai${rank}`, livery: rank >= DRIVERS.length ? { ...liv, code: liv.code + rank } : liv, skill };
  });
}

/**
 * One flying lap for an AI driver on an empty track (qualifying). Returns the lap time in seconds,
 * with a little random "form" so the order isn't identical every weekend.
 */
/** A driver on a qualifying lap pushes harder than in the race: closer to the limit, later on the brakes. */
export function qualifyingSkill(skill) {
  return {
    ...skill,
    corner: Math.min(1.1, skill.corner + 0.03),
    brake: Math.min(1.02, skill.brake + 0.04),
    commit: Math.min(1, (skill.commit ?? 1) + 0.04),
    noise: (skill.noise ?? 0) * 0.5
  };
}

// Qualifying: everyone gets this many timed laps in a row (from a flying start); the best clean one counts
export const QUALI_LAPS = 3;

/** A bot's whole qualifying run: QUALI_LAPS flying laps, each [{ time, valid }] with its own bit of form. */
export function qualifyingRun(track, skill, rand = Math.random) {
  const race = createRace({ track, mode: "trial", seed: 1, flying: true });
  const car = race.cars[0];
  car.isPlayer = false;
  car.skill = qualifyingSkill(skill);
  race.player = null;
  const dt = 1 / 120;
  for (let k = 0; k < 150 * QUALI_LAPS * 120 && car.lapTimes.length < QUALI_LAPS; k++) stepRace(race, null, dt);
  const laps = car.lapTimes.slice(0, QUALI_LAPS).map((l) => ({ time: l.time * (1 + (rand() - 0.5) * 0.008), valid: l.valid }));
  while (laps.length < QUALI_LAPS) laps.push({ time: Infinity, valid: false });
  return laps;
}

/** Best clean lap of a qualifying run (Infinity if every lap was deleted). */
export const bestQualiLap = (laps) => Math.min(...laps.filter((l) => l.valid).map((l) => l.time));

export function qualifyingLap(track, skill, rand = Math.random) {
  return bestQualiLap(qualifyingRun(track, skill, rand));
}

export function createRace({ track, mode, laps = 5, difficulty = "medium", seed = 1, grid = null, brakes = false, flying = false }) {
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
  // Qualifying is a flying lap: start on the racing line ~200 m before the line, already at speed
  if (flying) {
    const k = (track.n - 60 + track.n) % track.n;
    for (const c of cars) {
      const v = Math.min(track.vmax[k], CAR.top * 0.9);
      c.x = track.path[k][0] + track.nor[k][0] * track.line[k];
      c.y = track.path[k][1] + track.nor[k][1] * track.line[k];
      c.heading = Math.atan2(track.tan[k][1], track.tan[k][0]);
      c.vx = track.tan[k][0] * v;
      c.vy = track.tan[k][1] * v;
      c.fwd = v;
      c.speed = v;
    }
  }
  // Bots react to the lights like a person would (quicker drivers, quicker starts)
  for (const c of cars) if (!c.isPlayer) c.react = (c.skill.react ?? 0.3) * (0.8 + rand() * 0.4);
  if (brakes) {
    for (const c of cars) {
      c.brakeTemp = BRAKES.start;
      c.brakeLife = 1;
      c.brakeEff = 1;
    }
  }
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
    brakes: !!brakes,
    drsLine: [],
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
    // The out-lap / run from the grid doesn't eat into lap 1's ERS harvest cap
    car.ersUsedLap = 0;
    car.ersHarvestLap = 0;
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
    if (!car.isPlayer) {
      // Bots work the pedal like a person: the throttle can't snap open (brakes are instant for everyone)
      car.thrCmd = input.throttle < (car.thrCmd ?? 0) ? input.throttle : Math.min(input.throttle, (car.thrCmd ?? 0) + AI_THROTTLE_RATE * dt);
      input.throttle = car.thrCmd;
    }

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

    // Air: behind another car you're in its wake. On the straights that's a tow (less drag, more top
    // speed); in the corners it's dirty air (turbulent air robs the wings of downforce, so less grip).
    // Out in clean air you get the full grip.
    car.slip = false;
    car.dirty = 0;
    const hx = Math.cos(car.heading);
    const hy = Math.sin(car.heading);
    for (const o of race.cars) {
      if (o === car || o.finished) continue;
      const dx = o.x - car.x;
      const dy = o.y - car.y;
      const along = dx * hx + dy * hy;
      const side = Math.abs(-dx * hy + dy * hx);
      if (along < DIRTY_AIR.from || along > DIRTY_AIR.reach || side > DIRTY_AIR.width) continue;
      const w = (1 - (along - DIRTY_AIR.from) / (DIRTY_AIR.reach - DIRTY_AIR.from)) * (1 - side / DIRTY_AIR.width);
      car.dirty = Math.max(car.dirty, w);
      if (along < 260 && side < 26) car.slip = true;
    }

    // ERS deploy: needs charge and throttle, blocked while DRS is open
    const wantErs = !!input.ers && race.phase === "racing";
    const canErs = wantErs && !car.drsOpen && car.battery > 0.002 && (input.throttle ?? 0) > 0.3 && car.fwd > 30;
    if (car.isPlayer && wantErs && !canErs && !car.ersBlockedShown) {
      car.ersBlockedShown = true;
      const reason = car.drsOpen ? "drs" : car.battery <= 0.002 ? "empty" : "throttle";
      emit(race, { type: "ersBlocked", car: car.id, reason });
    }
    // One "ERS LOCKED" message per press, not a flicker every time a sliver of charge comes and goes
    if (!wantErs) car.ersBlockedShown = false;
    if (canErs) {
      const use = Math.min(car.battery, ERS.drain * dt);
      car.battery -= use;
      car.ersUsedLap += use;
    }
    car.ersOn = canErs;
    const ersPow = canErs ? ERS.power : 1;
    const ersTop = canErs ? ERS.top : 1;

    // One car for everyone: the same engine, ERS, DRS, tow and grip. (The player's brake setting can
    // only soften the pedal, never add braking the bots don't have.)
    const mods = {
      power: ersPow,
      top: ersTop * (car.drsOpen ? 1.12 : 1) * (car.slip ? 1.05 : 1),
      grip: 1 - DIRTY_AIR.grip * car.dirty,
      brake: (car.isPlayer ? Math.min(1, input.brakeMult ?? 1) : 1) * (car.brakeEff ?? 1)
    };
    const prevIdx = car.idx;
    const fwdBefore = car.fwd;
    const hit = stepCar(car, input, track, dt, mods);
    if (hit && car.isPlayer) emit(race, { type: "wall", car: car.id, speed: car.speed });

    // Harvest under braking (MGU-K), capped per lap. Slow-speed braking recovers less.
    car.harvesting = false;
    if ((input.brake ?? 0) > 0.05 && car.fwd > 60 && car.battery < 1) {
      const room = Math.max(0, ERS.harvestLap - car.ersHarvestLap);
      const h = Math.min(room, 1 - car.battery, input.brake * ERS.harvest * clamp(car.fwd / (CAR.top * 0.5), 0.35, 1) * dt);
      car.battery += h;
      car.ersHarvestLap += h;
      car.harvesting = h > 0;
    }
    // Brakes after the harvest: while the MGU-K is recharging the battery it takes part of the
    // braking load, so the discs run a little cooler
    if (car.brakeTemp != null) updateBrakes(race, car, input, mods, fwdBefore, dt);

    // Track limits: judged when the car rejoins. Kerb-hopping is fine; the whole car has to be past
    // the kerb for a moment, and it only counts if the car came back with its speed (an advantage).
    if (car.wallHit > 0) car.lastHit = race.t;
    const pushed = race.t - (car.lastHit ?? -9) < LIMITS.grace;
    const off = Math.abs(car.d) > track.width / 2 + LIMITS.margin;
    if (off) {
      if (!car.offTrack) {
        car.offTrack = true;
        car.offTime = 0;
        car.offSpeed = car.speed;
        car.offPushed = false;
      }
      car.offTime += dt;
      if (pushed) car.offPushed = true;
    } else if (car.offTrack && Math.abs(car.d) < track.width / 2 + 16) {
      car.offTrack = false;
      const gained = car.speed >= car.offSpeed * LIMITS.keep;
      // (across the inside of a corner is the corner-cut rule's business, below)
      if (car.laps >= 0 && !car.cutGain && car.offTime >= LIMITS.dwell && car.offSpeed > LIMITS.minSpeed && !car.offPushed && !pushed) {
        if (gained) {
          car.lapValid = false;
          car.strikes += 1;
          let pen = 0;
          if (race.mode !== "trial" && car.strikes > LIMITS.warnings) {
            pen = LIMITS.penalty;
            car.penalty += pen;
          }
          emit(race, { type: "limits", car: car.id, strikes: car.strikes, penalty: pen, warnings: LIMITS.warnings });
        } else if (car.isPlayer) emit(race, { type: "noAdvantage", car: car.id });
      }
    }

    // Corner cutting: ground covered off the road on the INSIDE of a corner (straight across a
    // chicane). It only counts as a shortcut if the car made more progress along the track than it
    // actually drove, at racing speed, and nobody pushed it there. A slow spin across the grass is fine.
    const offRoad = Math.abs(car.d) > track.width / 2 + 16;
    const moved = (car.idx - prevIdx + track.n) % track.n;
    if (offRoad && moved < track.n / 2 && Math.sign(car.d) === Math.sign(track.curv[car.idx])) {
      car.cutGain = (car.cutGain || 0) + moved * STEP;
      car.cutDriven = (car.cutDriven || 0) + car.speed * dt;
      if (pushed) car.cutPushed = true;
    }
    if (!offRoad && car.cutGain) {
      const shortcut = car.cutGain - car.cutDriven * 0.8;
      if (car.cutGain > CUT_GAIN && shortcut > 0 && !car.cutPushed && car.laps >= 0) {
        car.lapValid = false;
        car.cuts = (car.cuts || 0) + 1;
        let pen = 0;
        if (race.mode !== "trial" && car.cuts > 1) {
          pen = car.cutGain > CUT_BIG.gain ? CUT_BIG.penalty : CUT_PENALTY;
          car.penalty += pen;
        }
        emit(race, { type: "cut", car: car.id, penalty: pen, warning: race.mode !== "trial" && car.cuts === 1 });
      }
      car.cutGain = 0;
      car.cutDriven = 0;
      car.cutPushed = false;
    }

    const before = car.idx;
    trackProgress(race, car, prevIdx);
    // DRS detection, as in F1: crossing a detection line less than 1.0 s after ANY other car (a
    // rival or a backmarker) enables DRS in the zone that follows. From lap 2 on.
    track.drs.forEach((z, zi) => {
      const passed = (z.detect - prevIdx + track.n) % track.n;
      const movedBy = (before - prevIdx + track.n) % track.n;
      if (!(movedBy > 0 && movedBy < track.n / 2 && passed > 0 && passed <= movedBy)) return;
      if (race.mode === "trial") {
        car.drsEligible = true;
        return;
      }
      const last = race.drsLine[zi];
      const gap = last && last.id !== car.id ? race.t - last.t : Infinity;
      car.drsEligible = car.laps >= 1 && gap < DRS_GAP;
      race.drsLine[zi] = { id: car.id, t: race.t };
      if (car.isPlayer && car.laps >= 1) emit(race, { type: "drsDetect", car: car.id, gap, eligible: car.drsEligible });
    });
  }

  // Car-to-car contact
  resolveContacts(race);
  const cars = race.cars;

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
      if (o === car || o.finished) continue;
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
