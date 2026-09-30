// Ghost Lap — pure race simulation (no DOM). Tracks at real-length scale, arcade car physics,
// AI drivers, lap/sector timing, track limits, DRS, ERS, slipstream and race classification.
import { fitCircuit, cornerRadii, resampleClosed } from "./circuits.js";
import { RACING_LINES } from "./lines.js";

// Circuits are drawn 1.35x bigger than the original 3.3 px/m against the same car and road size,
// so a 20-car field has room to spread out and corners are closer to real proportions
export const WORLD_SCALE = 1.35;
export const PX_PER_M = 3.3 * WORLD_SCALE; // world pixels per real metre of circuit length
export const TRACK_WIDTH = 148; // road width through corners (room to race side by side)
export const STRAIGHT_WIDTH = 124; // and on long straights, blending between the two
/** Half the road width at point i (the road is narrower on long straights). */
export const halfAt = (track, i) => (track.half ? track.half[i] : track.width / 2);
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

// Levels set the DRIVER: how close to the grip limit they take corners (corner), how late and hard
// they brake (brake: share of the car's full braking they plan on), how much throttle they dare use
// (commit), how tidy their line is (noise), how quickly they react to the lights (react, s) and how
// often they make a mistake (err: late on the brakes, greedy on the throttle, off their line, a cut).
// lead (steps) is where their own line starts (see LINE_START); it's a calibration that keeps each
// level's overall race pace where it was before drivers had their own lines, mistakes and moods.
// Every level is a serious racer. A bot already drives close to what the car can do, so from Hard up
// the bots also get a faster CAR (boost: engine, top speed, grip and brakes x boost), because a good
// human can beat a same-car bot. Up to Medium they drive exactly your car.
export const DIFFICULTY = {
  noob: { label: "NOOB", corner: 0.88, brake: 0.8, commit: 0.96, noise: 0.06, react: 0.3, boost: 1, err: 1, lead: 5 },
  veryEasy: { label: "VERY EASY", corner: 0.92, brake: 0.85, commit: 0.98, noise: 0.04, react: 0.26, boost: 1, err: 0.75, lead: 3.6 },
  easy: { label: "EASY", corner: 0.96, brake: 0.9, commit: 1, noise: 0.02, react: 0.23, boost: 1, err: 0.55, lead: 2.9 },
  medium: { label: "MEDIUM", corner: 1, brake: 0.95, commit: 1, noise: 0.01, react: 0.2, boost: 1, err: 0.4, lead: 2.7 },
  hard: { label: "HARD", corner: 1, brake: 1, commit: 1, noise: 0, react: 0.18, boost: 1.03, err: 0.25, lead: 2.4 },
  veryHard: { label: "VERY HARD", corner: 1, brake: 1, commit: 1, noise: 0, react: 0.17, boost: 1.06, err: 0.14, lead: 2.1 },
  impossible: { label: "IMPOSSIBLE", corner: 1, brake: 1, commit: 1, noise: 0, react: 0.16, boost: 1.1, err: 0.06, lead: 2 }
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
  { name: "O. HALVORSEN", code: "HAL", color: "#06d6a0", accent: "#073b4c" },
  { name: "B. ACHTERBERG", code: "ACH", color: "#f77f00", accent: "#003049" },
  { name: "F. QUINTERO", code: "QUI", color: "#fcbf49", accent: "#6a040f" },
  { name: "W. DRUMMOND", code: "DRU", color: "#4361ee", accent: "#f8f9fa" },
  { name: "Z. HADDAD", code: "HAD", color: "#2d6a4f", accent: "#ffd166" },
  { name: "U. SVENSSON", code: "SVE", color: "#48cae4", accent: "#03045e" },
  { name: "Q. MBEKI", code: "MBE", color: "#9d0208", accent: "#ffba08" },
  { name: "X. LAURENT", code: "LAU", color: "#adb5bd", accent: "#7209b7" },
  { name: "J. KAPOOR", code: "KAP", color: "#ff9f1c", accent: "#2ec4b6" },
  { name: "M. CASTELLI", code: "CAS", color: "#c1121f", accent: "#fdf0d5" },
  { name: "T. WREN", code: "WRE", color: "#80ed99", accent: "#22577a" }
];

// Driving styles. Every race each AI driver is dealt one at random (a duel too), and a style is only
// where they start: each trait is then varied for that driver and that race, so two drivers dealt the
// same style still don't race alike. During the race a driver's mood drifts (a volatile one swings
// more), losing a place makes them angrier (how much is their grudge), a late charger comes alive in
// the closing laps, and every attack and defence is a plan picked at random (weighted by who they
// are) and dropped for another when it isn't working. Traits (0-1 unless noted):
//  agg        how far back and how readily they attack; later braking on the inside
//  patience   wait for DRS, a mistake or a much better run instead of trying it anywhere
//  defend     how early and hard they cover, and how often they defend at all
//  tow        how long they sit in the slipstream before pulling out
//  straights  prefer attacking on the straights (slipstream, dummies) over lunges into corners
//  feint      dummies: show one side, take the other; react to being covered
//  risk       round the outside, and how far they hang it out there
//  explore    how often they try a new line through a corner (kept if it's faster)
//  apex       their line: + turn in later (steps), - earlier;  tight: nearer the inside at the apex (px)
//  volatility how much their mood swings;  grudge: how much losing a place fires them up
//  charge     how much they come alive in the closing laps (and hold back early)
//  ersSave, ersBurn  how often a lap is spent saving the battery, or burning it
//  mistake    extra chance per corner of a mistake (scaled, with the base rate, by the level's err)
//  brake, corner, noise, noiseAdd: small pace and consistency trims on the driver's level
const STYLE_BASES = {
  aggressor: { agg: 0.95, patience: 0.1, defend: 0.75, tow: 0.35, straights: 0.25, feint: 0.45, risk: 0.8, explore: 0.3, apex: 0, tight: 2, volatility: 0.5, grudge: 0.8, charge: 0, ersSave: 0.15, ersBurn: 0.6, mistake: 0.012, brake: 0.015, corner: 0, noise: 1.3, noiseAdd: 0.006 },
  tactician: { agg: 0.5, patience: 0.95, defend: 0.6, tow: 0.95, straights: 0.7, feint: 0.35, risk: 0.3, explore: 0.3, apex: 0.5, tight: 0, volatility: 0.2, grudge: 0.2, charge: 0.2, ersSave: 0.6, ersBurn: 0.15, mistake: 0.003, brake: 0, corner: 0, noise: 0.8, noiseAdd: 0 },
  metronome: { agg: 0.3, patience: 0.6, defend: 0.4, tow: 0.6, straights: 0.5, feint: 0.05, risk: 0.15, explore: 0.15, apex: -0.5, tight: 0, volatility: 0.1, grudge: 0.1, charge: 0, ersSave: 0.3, ersBurn: 0.2, mistake: 0.001, brake: -0.01, corner: 0.005, noise: 0.3, noiseAdd: 0 },
  exitKing: { agg: 0.6, patience: 0.5, defend: 0.5, tow: 0.85, straights: 0.65, feint: 0.2, risk: 0.35, explore: 0.4, apex: 1, tight: -2, volatility: 0.3, grudge: 0.4, charge: 0.1, ersSave: 0.35, ersBurn: 0.3, mistake: 0.006, brake: 0, corner: 0, noise: 1, noiseAdd: 0 },
  wildcard: { agg: 0.85, patience: 0.15, defend: 0.5, tow: 0.3, straights: 0.45, feint: 0.9, risk: 0.9, explore: 1, apex: 0, tight: 0, volatility: 0.9, grudge: 0.7, charge: 0, ersSave: 0.2, ersBurn: 0.5, mistake: 0.02, brake: 0.01, corner: 0.005, noise: 1.8, noiseAdd: 0.012 },
  blocker: { agg: 0.4, patience: 0.7, defend: 1, tow: 0.6, straights: 0.5, feint: 0.2, risk: 0.3, explore: 0.2, apex: -0.5, tight: 1, volatility: 0.2, grudge: 0.5, charge: 0, ersSave: 0.55, ersBurn: 0.15, mistake: 0.004, brake: 0, corner: 0, noise: 0.9, noiseAdd: 0 },
  opportunist: { agg: 0.7, patience: 0.4, defend: 0.6, tow: 0.8, straights: 0.45, feint: 0.5, risk: 0.5, explore: 0.5, apex: 0.5, tight: 0, volatility: 0.5, grudge: 0.4, charge: 0.1, ersSave: 0.45, ersBurn: 0.25, mistake: 0.006, brake: 0.005, corner: 0, noise: 1, noiseAdd: 0 },
  lateBraker: { agg: 0.8, patience: 0.3, defend: 0.7, tow: 0.5, straights: 0.15, feint: 0.4, risk: 0.6, explore: 0.3, apex: -1, tight: 3, volatility: 0.4, grudge: 0.6, charge: 0, ersSave: 0.25, ersBurn: 0.35, mistake: 0.012, brake: 0.025, corner: -0.005, noise: 1.1, noiseAdd: 0.004 },
  slipstreamer: { agg: 0.65, patience: 0.75, defend: 0.5, tow: 1, straights: 0.95, feint: 0.6, risk: 0.25, explore: 0.3, apex: 0.5, tight: -1, volatility: 0.3, grudge: 0.3, charge: 0.1, ersSave: 0.6, ersBurn: 0.2, mistake: 0.005, brake: 0, corner: 0, noise: 1, noiseAdd: 0 },
  lateCharger: { agg: 0.45, patience: 0.6, defend: 0.55, tow: 0.7, straights: 0.5, feint: 0.4, risk: 0.5, explore: 0.5, apex: 0, tight: 1, volatility: 0.35, grudge: 0.5, charge: 1, ersSave: 0.7, ersBurn: 0.1, mistake: 0.006, brake: 0, corner: 0, noise: 1, noiseAdd: 0 }
};
export const STYLES = Object.keys(STYLE_BASES);
// (the player's car on autopilot, and anything without a persona)
const PERSONA_NEUTRAL = { style: "", agg: 0.6, patience: 0.4, defend: 0.6, tow: 0.6, straights: 0.45, feint: 0.3, risk: 0.4, explore: 0.3, apex: 0, tight: 0, volatility: 0, grudge: 0, charge: 0, ersSave: 0.3, ersBurn: 0.3, mistake: 0, brake: 0, corner: 0, noise: 1, noiseAdd: 0 };
const UNIT_TRAITS = ["agg", "patience", "defend", "tow", "straights", "feint", "risk", "explore", "volatility", "grudge", "charge", "ersSave", "ersBurn"];

/** One driver's persona for one race: their style, with every trait varied. */
export function makePersona(style, rand = Math.random) {
  const b = STYLE_BASES[style] || PERSONA_NEUTRAL;
  const p = { ...b, style };
  for (const k of UNIT_TRAITS) p[k] = clamp(b[k] + (rand() - 0.5) * 0.5, 0, 1);
  p.apex = b.apex + (rand() - 0.5) * 1.2;
  p.tight = b.tight + (rand() - 0.5) * 4;
  p.mistake = b.mistake * (0.5 + rand());
  p.brake = b.brake + (rand() - 0.5) * 0.01;
  p.noise = b.noise * (0.75 + rand() * 0.5);
  return p;
}
export const personaOf = (car) => car.skill?.persona || PERSONA_NEUTRAL;

/** Pick a key from { key: weight }. */
function pickWeighted(weights, rand) {
  let sum = 0;
  for (const k in weights) sum += Math.max(0, weights[k]);
  let r = rand() * sum;
  for (const k in weights) {
    r -= Math.max(0, weights[k]);
    if (r <= 0) return k;
  }
  return Object.keys(weights)[0];
}

// Car balance setting (the player's), -1 to +1. Understeer (-) takes grip off the front and plants
// the rear (it won't step out on the brakes or the throttle, but the car pushes wide); oversteer (+)
// takes grip off the rear (the car rotates into corners and can be steered on the throttle, but it
// slides, and a slide scrubs speed). Neither is free speed: each end trades a little pace for its feel.
export const BALANCE = { front: 0.03, rearPlanted: 0.08, rearLoose: 0.16, slideScrub: 1300 };
// Engine: a Formula 1 V8 (2006-2013): idles ~4,200 rpm, revs to 18,000; 8 gears over the speed range
export const V8 = { idle: 4200, upshift: 11800, limiter: 18000 };
const GEAR_SPAN = CAR.top / 7.6; // same gearing the HUD shows
const TOP_GEAR = 8;

/** The gear a car is in at forward speed `fwd` (0 = neutral on the grid, -1 = reverse). */
export function engineGear(fwd) {
  if (fwd < -5) return -1;
  if (fwd < 8) return 0;
  return Math.min(TOP_GEAR, 1 + Math.floor(fwd / GEAR_SPAN));
}

/** Engine speed (rpm) at forward speed `fwd`: each gear sweeps up to the limiter, then drops on the upshift. */
export function engineRpm(fwd, throttle = 0) {
  const gear = engineGear(fwd);
  if (gear <= 0) return V8.idle + Math.max(0, Math.min(1, throttle)) * (V8.limiter - V8.idle) * (gear < 0 ? 0.4 : 1);
  const from = (gear - 1) * GEAR_SPAN;
  // Top gear is long: near the limiter at the car's top speed, on it with DRS or a tow
  const span = gear === TOP_GEAR ? CAR.top * 1.012 - from : GEAR_SPAN;
  const frac = Math.max(0, Math.min(1, (fwd - from) / span));
  const low = gear === 1 ? V8.idle : V8.upshift;
  return low + frac * (V8.limiter - low);
}

// Grand Prix field size: from a 3-car sprint to a 30-car scramble (20 is a real F1 grid)
export const MIN_CARS = 3;
export const MAX_CARS = 30;
export const DEFAULT_CARS = 20;
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
  // life used per second of full braking from top speed (x more when overheating): with normal driving
  // a full-distance race leaves about half (Monaco, the hardest, ~50%); abuse them and they wear out
  wear: 0.005,
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

// How far past the tyres' grip a full steering input can ask for at speed (1 = exactly the limit)
const STEER_ASSIST = 1.15;

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
        if ((A.isPlayer || B.isPlayer) && Math.abs(rv) > 60) emit(race, { type: "contact", car: (A.isPlayer ? A : B).id, speed: Math.abs(rv) });
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

/**
 * Where two parts of a circuit run side by side, a wall splits the ground between them (as on real
 * tracks), so nobody can drive across onto the other section. The wall runs exactly halfway between
 * the two centrelines. Returns { walls, divider }: walls[side][i] is the distance from the
 * centreline to the wall on that side ([-normal, +normal]; `base`, the normal barrier, where no
 * section is near) and divider[i] the wall's point beside point i (null where there is none).
 * Crossings (a bridge) are left open.
 */
function sectionWalls(path, nor, n, base, w, crossover) {
  const cell = 64;
  const grid = new Map();
  path.forEach((p, i) => {
    const k = Math.floor(p[0] / cell) * 65536 + Math.floor(p[1] / cell);
    const list = grid.get(k);
    if (list) list.push(i);
    else grid.set(k, [i]);
  });
  // Nearest point of ANOTHER section: one that is much further away going round the track than
  // straight across (so the other side of a hairpin counts only well away from its apex)
  const reach = 2 * base + 40;
  const r = Math.ceil(reach / cell);
  const near = new Int32Array(n).fill(-1);
  const gap = new Float32Array(n).fill(Infinity);
  for (let i = 0; i < n; i++) {
    const [px, py] = path[i];
    const cx = Math.floor(px / cell);
    const cy = Math.floor(py / cell);
    for (let dx = -r; dx <= r; dx++) {
      for (let dy = -r; dy <= r; dy++) {
        for (const j of grid.get((cx + dx) * 65536 + cy + dy) || []) {
          const d = Math.hypot(path[j][0] - px, path[j][1] - py);
          if (d >= gap[i] || d > reach) continue;
          const arc = Math.min(Math.abs(j - i), n - Math.abs(j - i)) * STEP;
          if (arc < 3 * d + base * 2) continue;
          gap[i] = d;
          near[i] = j;
        }
      }
    }
    if (crossover && gap[i] < w * 1.5) near[i] = -1;
  }
  const walls = [new Float32Array(n).fill(base), new Float32Array(n).fill(base)];
  const divider = new Array(n).fill(null);
  for (let i = 0; i < n; i++) {
    const j = near[i];
    if (j < 0) continue;
    const [px, py] = path[i];
    const qx = path[j][0] - px;
    const qy = path[j][1] - py;
    const along = (qx * nor[i][0] + qy * nor[i][1]) / gap[i]; // how square-on the other section is
    if (Math.abs(along) < 0.5) continue;
    const side = along > 0 ? 1 : 0;
    // Distance along the normal to the halfway line
    const t = gap[i] / 2 / Math.abs(along);
    if (t >= base) continue;
    walls[side][i] = Math.max(w / 2 + 8, t - 8);
    divider[i] = [px + qx / 2, py + qy / 2];
  }
  // Smooth the halfway line so it runs cleanly
  const smooth = divider.map((d, i) => {
    if (!d) return null;
    let sx = 0;
    let sy = 0;
    let c = 0;
    for (let k = -4; k <= 4; k++) {
      const e = divider[(i + k + n) % n];
      if (e && Math.hypot(e[0] - d[0], e[1] - d[1]) < 60) {
        sx += e[0];
        sy += e[1];
        c++;
      }
    }
    return [sx / c, sy / c];
  });
  return { walls, divider: smooth };
}

/** Build a raceable world track from a circuit definition { key, name, pts, lengthM, theme, night }. */
export function buildTrack(def) {
  const probe = fitCircuit(def.pts, 1760, 800, 0, STEP);
  const k = clamp((def.lengthM * PX_PER_M) / pathLength(probe), 3.2 * WORLD_SCALE, 9 * WORLD_SCALE);
  const margin = 520;
  const W = Math.round(1760 * k + margin * 2);
  const H = Math.round(800 * k + margin * 2);
  let path = separateSections(fitCircuit(def.pts, W, H, margin, STEP), TRACK_WIDTH + 64, STEP, !!def.crossover);
  // startM: move the start/finish line this far up the road, so the whole grid sits on the straight
  if (def.startM) {
    const shift = Math.round((def.startM / def.lengthM) * path.length);
    path = path.slice(shift).concat(path.slice(0, shift));
  }
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

  // Road width: full width through corners, their braking zones (~450 px before, room to set up a wide
  // entry) and exits (~250 px after); narrower on long straights, with a smooth blend (~300 px)
  const bend = Uint8Array.from(radii, (r) => (r < 600 ? 1 : 0));
  const near = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    for (let k = -25; k <= 45; k++) {
      if (bend[(i + k + n) % n]) {
        near[i] = 1;
        break;
      }
    }
  }
  const half = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let s = 0;
    let ws = 0;
    for (let k = -15; k <= 15; k++) {
      const wt = 16 - Math.abs(k);
      s += near[(i + k + n) % n] * wt;
      ws += wt;
    }
    half[i] = STRAIGHT_WIDTH / 2 + ((w - STRAIGHT_WIDTH) / 2) * (s / ws);
  }
  // How far from the centreline the racing line may go at each point
  const lineLim = Float64Array.from(half, (h) => h - 16);

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
    line[i] = clamp((s / wsum) * 1.35, -Math.min(w * 0.34, lineLim[i]), Math.min(w * 0.34, lineLim[i]));
  }
  // ...then relax it like an elastic band pulled tight between the edges: each point moves toward the
  // midpoint of its neighbours (coarse to fine), which converges on the least-curvature line that uses
  // the full width — outside on entry, clipping the apex, outside again on exit.
  for (const [k, iters] of [[10, 80], [4, 120], [1, 160]]) {
    for (let it = 0; it < iters; it++) {
      for (let i = 0; i < n; i++) {
        const a = (i - k + n) % n;
        const b = (i + k) % n;
        const tx = (path[a][0] + nor[a][0] * line[a] + path[b][0] + nor[b][0] * line[b]) / 2;
        const ty = (path[a][1] + nor[a][1] * line[a] + path[b][1] + nor[b][1] * line[b]) / 2;
        const px = path[i][0] + nor[i][0] * line[i];
        const py = path[i][1] + nor[i][1] * line[i];
        line[i] = clamp(line[i] + ((tx - px) * nor[i][0] + (ty - py) * nor[i][1]) * 0.6, -lineLim[i], lineLim[i]);
      }
    }
  }
  // The fastest line: minimum-lap-time offsets computed offline (scripts/optimize-lines.mjs). They're
  // used only when they were made for exactly this track shape; otherwise the elastic-band line stays.
  const stored = def.key && !def.elasticLine ? RACING_LINES[def.key] : null;
  if (stored && stored.shape === trackShapeKey(path, half)) decodeLine(stored, line, lineLim);
  const linePath = path.map((p, i) => [p[0] + nor[i][0] * line[i], p[1] + nor[i][1] * line[i]]);
  const lineRadii = cornerRadii(linePath, 8);
  const lineDs = linePath.map((p, i) => {
    const q = linePath[(i + 1) % n];
    return Math.hypot(q[0] - p[0], q[1] - p[1]);
  });

  // Reference speed profile along the racing line at full grip (drives the line guide and DRS zones)
  const vmax = profileFor({ n, lineRadii, lineDs }, 1);
  // What the car actually does on that line (braking AND acceleration limits), for the line guide
  const { v: plan, guide } = speedPlan(lineCornerRadii(linePath), lineDs, n);

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
  const long = runs.filter((r) => r.len * STEP > 1000 * WORLD_SCALE);
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
      return { from, to, detect: (from - Math.round((1400 * WORLD_SCALE) / STEP) + n) % n };
    });

  // Grid: staggered two-by-two behind the line
  const grid = [];
  for (let s = 0; s < MAX_CARS; s++) {
    const i = (n - 5 - s * 7 + n * 2) % n;
    const side = s % 2 === 0 ? -1 : 1;
    const off = side * w * 0.22;
    grid.push({ x: path[i][0] + nor[i][0] * off, y: path[i][1] + nor[i][1] * off, heading: Math.atan2(tan[i][1], tan[i][0]), i });
  }

  const street = def.theme === "street" || !!def.street; // walls right beside the road
  const sw = sectionWalls(path, nor, n, street ? w / 2 + 36 : w / 2 + 200, w, !!def.crossover);
  // Street circuits: the walls line the road, so they come in with it on the narrower straights
  if (street) for (const wall of sw.walls) for (let i = 0; i < n; i++) wall[i] = Math.min(wall[i], half[i] + 36);
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
    plan,
    guide,
    drs,
    grid,
    width: w,
    half,
    // Distance from the centreline where the car meets a wall / tyre barrier, and per point and
    // side ([-normal, +normal]) where a wall between close sections comes in nearer than that
    barrier: street ? w / 2 + 36 : w / 2 + 200,
    ...sw,
    sectors: [Math.floor(n / 3), Math.floor((2 * n) / 3)],
    loopEvery: 20
  };
}

// ── Lap-time model for the racing line (full grip, flat-out driver) ──
const DRAG_K = (CAR.power * CAR.powerSpeed) / CAR.top ** 3;
/** Acceleration flat out at speed v (engine minus drag), px/s², as stepCar applies it. */
const flatOutAccel = (v) => CAR.power * Math.min(1, CAR.powerSpeed / Math.max(1, v)) - (10 + DRAG_K * v * v);
/** Deceleration from just lifting off at speed v (drag only). */
const coastDecel = (v) => 10 + DRAG_K * v * v;
export const GUIDE = { FLAT: 0, LIFT: 1, BRAKE: 2 };

/**
 * The speed a car really carries round the line: no faster than each corner allows, accelerating
 * out of corners with the engine it has, and braking (hard, 86% of the brakes) into the next one.
 * guide per point: FLAT (full throttle), LIFT (a small slow-down, or holding speed at the grip limit)
 * or BRAKE. Also returns the lap time.
 */
export function speedPlan(radii, ds, n, m = 1) {
  const lim = new Float64Array(n);
  for (let i = 0; i < n; i++) lim[i] = Math.min(CAR.top, cornerSpeed(Math.max(radii[i], 8), m));
  const v = Float64Array.from(lim);
  const B = CAR.brake * 0.86;
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const a = Math.max(0, flatOutAccel(v[i]));
      v[j] = Math.min(v[j], Math.sqrt(v[i] * v[i] + 2 * a * ds[i]));
    }
  }
  for (let pass = 0; pass < 2; pass++) {
    for (let i = n - 1; i >= 0; i--) {
      const j = (i + 1) % n;
      v[i] = Math.min(v[i], Math.sqrt(v[j] * v[j] + 2 * B * ds[i]));
    }
  }
  let time = 0;
  for (let i = 0; i < n; i++) time += (2 * ds[i]) / Math.max(1, v[i] + v[(i + 1) % n]);
  // Guide: braking zones whose whole slow-down is small are "lift"; so is holding speed at the limit
  const guide = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const decel = (v[i] * v[i] - v[j] * v[j]) / (2 * Math.max(1e-6, ds[i]));
    if (decel > coastDecel(v[i]) * 1.05) guide[i] = GUIDE.BRAKE;
    else if (decel > 0.5 || (v[j] <= v[i] + 0.01 && v[i] < CAR.top * 0.97)) guide[i] = GUIDE.LIFT;
  }
  for (let i = 0; i < n; i++) {
    if (guide[i] !== GUIDE.BRAKE || guide[(i - 1 + n) % n] === GUIDE.BRAKE) continue;
    let j = i;
    let k = 0;
    while (guide[j] === GUIDE.BRAKE && k++ < n) j = (j + 1) % n;
    if (v[i] - v[j] < 60) for (let q = i; q !== j; q = (q + 1) % n) guide[q] = GUIDE.LIFT;
  }
  return { v, guide, time };
}

/** A fingerprint of the track shape: stored lines are only reused for the exact geometry. */
export function trackShapeKey(path, half = null) {
  let s = 0;
  for (let i = 0; i < path.length; i += 7) s += path[i][0] * 1.3 + path[i][1] * 0.7;
  let h = 0;
  if (half) for (let i = 0; i < half.length; i += 7) h += half[i];
  return `${path.length}:${Math.round(s)}${half ? `:${Math.round(h)}` : ""}`;
}

function decodeLine(stored, line, lim) {
  const offs = stored.offs;
  const m = offs.length;
  for (let i = 0; i < line.length; i++) {
    const x = i / stored.step;
    const k = Math.floor(x);
    const f = x - k;
    const a = offs[k % m];
    const b = offs[(k + 1) % m];
    line[i] = clamp(a + (b - a) * f, -lim[i], lim[i]);
  }
}

/**
 * Corner radius along a line, judged at two scales and taking the tighter: a kink too short to show
 * over 8 points still counts, so the optimiser can't "straighten" a corner with wiggles.
 */
export function lineCornerRadii(pts) {
  const r8 = cornerRadii(pts, 8);
  const r4 = cornerRadii(pts, 4);
  return r8.map((r, i) => Math.min(r, r4[i]));
}

/** Lap time of a line (offsets from the centreline) on a track. */
export function lineLapTime(track, line) {
  const { n, path, nor } = track;
  const pts = path.map((p, i) => [p[0] + nor[i][0] * line[i], p[1] + nor[i][1] * line[i]]);
  const ds = pts.map((p, i) => Math.hypot(pts[(i + 1) % n][0] - p[0], pts[(i + 1) % n][1] - p[1]));
  return speedPlan(lineCornerRadii(pts), ds, n).time;
}

/**
 * Minimum-lap-time line: starting from the elastic-band line, nudge it across the track with smooth
 * bumps (coarse to fine) and keep every nudge that makes the simulated lap quicker. Used offline.
 */
export function optimizeRacingLine(track, log = null, opts = { margin: 24, passes: [[24, 12, 4, 3], [16, 6, 3, 3]] }) {
  const { n } = track;
  // A little more margin from the edge than the elastic band, and only broad, smooth changes: a line a
  // real car can follow (quick side-to-side flicks look fast on paper but no car can track them)
  const lim = Float64Array.from(track.half, (h) => h - opts.margin);
  const line = Float64Array.from(track.line, (v, i) => clamp(v, -lim[i], lim[i]));
  let best = lineLapTime(track, line);
  const start = best;
  for (const [H, step, stride, sweeps] of opts.passes) {
    const w = Array.from({ length: 2 * H + 1 }, (_, k) => 0.5 * (1 + Math.cos((Math.PI * (k - H)) / (H + 1))));
    for (let sweep = 0; sweep < sweeps; sweep++) {
      let gained = 0;
      for (let c = 0; c < n; c += stride) {
        for (const dir of [1, -1]) {
          const saved = [];
          for (let k = -H; k <= H; k++) {
            const i = (c + k + n) % n;
            saved.push(line[i]);
            line[i] = clamp(line[i] + dir * step * w[k + H], -lim[i], lim[i]);
          }
          const t = lineLapTime(track, line);
          if (t < best - 1e-7) {
            gained += best - t;
            best = t;
            break;
          }
          for (let k = -H; k <= H; k++) line[(c + k + n) % n] = saved[k + H];
        }
      }
      if (log) log(`  bump ${H} step ${step} sweep ${sweep + 1}: ${best.toFixed(3)}s`);
      if (gained < 1e-4) break;
    }
  }
  return { line, time: best, start };
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
    balance: 0, // + understeer (front sliding), - oversteer (rear sliding), 0..1 either way
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
    raceD: 0, // racecraft: where on the road the car wants to be to attack or defend (px from centre)
    raceW: 0, // and how far it has moved from its racing line toward that spot (0-1)
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

  const halfW = halfAt(track, car.idx);
  const onTrack = Math.abs(car.d) <= halfW + 6;
  const onKerb = !onTrack && Math.abs(car.d) <= halfW + 16;
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
  // Speed-sensitive steering (every car): at speed a full turn of the wheel asks for just past the
  // grip limit rather than several times it, so steering hard runs the car wide (understeer) instead
  // of scrubbing off a third of its speed. Corners still can't be taken flat: too fast = too wide.
  if (!input.handbrake && Math.abs(fwd) > 1) {
    const yawMax = (G * STEER_ASSIST) / Math.abs(fwd);
    if (Math.abs(yaw) > yawMax) yaw = Math.sign(yaw) * yawMax;
  }
  // Balance: the grip is split between the axles and weight transfer moves it. Braking lightens the
  // rear (trail-brake too hard and it steps out); the throttle loads the rear, but at low speed
  // the rear tyres spin up (power oversteer); dirty air robs the front wing (understeer); kerbs and
  // grass make the rear nervous. The front sliding runs the car wide (understeer); the rear sliding
  // rotates the car into the corner more than it's travelling, until the rear grips again (oversteer:
  // lift, straighten the wheel or counter-steer to catch it).
  const brakeLoad = fwd > 60 ? (input.brake ?? 0) : 0;
  const thr = Math.max(0, input.throttle ?? 0);
  const wheelspin = thr * Math.max(0, 1 - Math.abs(fwd) / (CAR.top * 0.45));
  const setup = clamp(input.balance ?? 0, -1, 1);
  const frontG = G * (1 + Math.min(0, setup) * BALANCE.front) * (1 - 0.05 * thr) * (1 - 0.15 * (mods.dirty || 0));
  const rearG = G * (1 - setup * (setup > 0 ? BALANCE.rearLoose : BALANCE.rearPlanted)) * (1 - 0.18 * brakeLoad + 0.05 * thr) * (1 - 0.7 * wheelspin) * (onTrack ? 1 : 0.85);
  const need = Math.abs(yaw * fwd);
  let under = 0;
  if (need > frontG && Math.abs(fwd) > 1) {
    under = Math.min(1, (need - frontG) / frontG);
    yaw = (Math.sign(yaw) * frontG) / Math.abs(fwd);
    // Past the limit the tyres scrub: the car runs wide AND bleeds speed
    const excess = Math.min(1, (need - frontG) / need);
    fwd -= Math.sign(fwd) * Math.min(Math.abs(fwd), excess * 650 * dt);
  }
  const rearNeed = Math.abs(yaw * fwd);
  const over = !input.handbrake && rearNeed > rearG && Math.abs(fwd) > 40 ? Math.min(1, (rearNeed - rearG) / rearG) : 0;
  // A sliding rear scrubs speed too (the tyres are going sideways): the rotation isn't free
  if (over > 0) fwd -= Math.sign(fwd) * Math.min(Math.abs(fwd), over * BALANCE.slideScrub * dt);
  // The slide builds and settles over a moment (it doesn't snap)
  car.oversteer = Math.max(over, (car.oversteer || 0) - dt * 2.5);
  // (applied to the heading after the velocity, below: the car points further into the corner than
  // it's going, which is what a slide is)
  const slideYaw = car.oversteer > 0 ? Math.sign(yaw || car.steer || 1) * car.oversteer * 2.6 : 0;
  car.balance = under > 0 ? under : -car.oversteer;
  const slide = Math.max(under, car.oversteer);
  car.sliding = slide > 0 ? Math.min(1, slide) : Math.max(0, car.sliding - dt * 3);
  // Kerbs rattle the car and cost speed
  if (onKerb && Math.abs(fwd) > 150) fwd *= Math.exp(-0.35 * dt);
  if (input.handbrake && Math.abs(fwd) > 120) {
    yaw += car.steer * 1.4;
    fwd *= Math.exp(-0.5 * dt);
  }
  car.heading = wrapAngle(car.heading + yaw * dt);

  // Lateral slip decays with grip (low grip = drift); a sliding rear holds the slide
  const latDamp = (input.handbrake ? 1.6 : onTrack ? 10 : 4.5) * (1 - 0.8 * (car.oversteer || 0));
  lat *= Math.exp(-latDamp * dt);
  if (input.handbrake) car.sliding = Math.max(car.sliding, Math.min(1, Math.abs(lat) / 200));

  const nx = Math.cos(car.heading);
  const ny = Math.sin(car.heading);
  car.vx = nx * fwd - ny * lat;
  car.vy = ny * fwd + nx * lat;
  car.x += car.vx * dt;
  car.y += car.vy * dt;
  if (slideYaw) car.heading = wrapAngle(car.heading + slideYaw * dt);
  car.fwd = fwd;
  car.throttle = input.throttle;
  car.rev = input.rev || 0; // revs held on the clutch (the engine's revving, the car isn't driving)
  car.brake = input.brake;

  // Re-project and keep the car inside walls / tyre barriers
  const pr = project(track, car.x, car.y, car.idx);
  car.idx = pr.i;
  car.d = pr.d;
  car.s = pr.s;
  let hit = false;
  const wall = track.walls ? track.walls[pr.d > 0 ? 1 : 0][pr.i] : track.barrier;
  if (Math.abs(pr.d) > wall) {
    const over = Math.abs(pr.d) - wall;
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
    car.d = sgn * wall;
    hit = true;
    car.wallHit = 0.3;
  }
  car.wallHit = Math.max(0, car.wallHit - dt);
  car.speed = Math.hypot(car.vx, car.vy);
  return hit;
}

// ─────────────────────────── AI ───────────────────────────
// ── Lines of their own ──
// Each corner (a run of road tighter than 600 px radius, split where it changes direction) gets a
// window from its braking zone to its exit where a driver takes their own line: the racing line
// shifted later or earlier along the road (a later or earlier apex) and pulled toward the inside or
// the outside at the apex. Drivers try small changes as the race goes on and keep what's faster.
const MISTAKE_BASE = 0.03; // chance per corner at err 1, before the persona's own
const LINE_SHIFT = 9; // steps
const LINE_TIGHT = 16; // px
// Where a driver starts: turning in a little ahead of the drawn line (by their level's lead) and a
// touch tighter (a driver reacts, so aiming slightly early makes up for it). There's more to find
// (about -6 and +8 is ~1% quicker), which the drivers work out corner by corner as they go.
const LINE_START = { shift: -2.5, tight: 3 };
const CORNER_IN = 28; // window starts this many steps before the corner (braking)...
const CORNER_OUT = 18; // ...and ends this many after it (the exit, where a good line pays off)
function cornersOf(track) {
  if (track.corners) return track.corners;
  const { n, radii, curv } = track;
  let s0 = 0;
  for (let i = 0; i < n; i++) {
    if (radii[i] >= 600) {
      s0 = i;
      break;
    }
  }
  const found = [];
  let cur = null;
  for (let k = 0; k <= n; k++) {
    const i = (s0 + k) % n;
    const inCorner = k < n && radii[i] < 600;
    const sg = Math.sign(curv[i]) || 1;
    if (inCorner && cur && sg === cur.sign) {
      cur.len = k - cur.k0 + 1;
      if (radii[i] < cur.r) {
        cur.r = radii[i];
        cur.apexK = k;
      }
      continue;
    }
    if (cur && cur.len >= 3) found.push(cur);
    cur = inCorner ? { k0: k, len: 1, sign: sg, r: radii[i], apexK: k } : null;
  }
  const at = new Int16Array(n).fill(-1);
  const wAt = new Float32Array(n);
  const apexAt = new Float32Array(n);
  const startAt = new Int16Array(n).fill(-1);
  const corners = found.map((f, c) => {
    const from = (s0 + f.k0) % n;
    const apex = f.apexK - f.k0;
    const reach = f.len / 2 + 6;
    for (let k = -CORNER_IN; k <= f.len + CORNER_OUT; k++) {
      const j = (from + k + n) % n;
      const w = Math.min(1, (k + CORNER_IN) / 12, (f.len + CORNER_OUT - k) / 12);
      if (w > wAt[j]) {
        at[j] = c;
        wAt[j] = w;
        apexAt[j] = Math.exp(-(((k - apex) / reach) ** 2));
      }
    }
    for (let k = 0; k < 4; k++) startAt[(from - CORNER_IN + k + n) % n] = c;
    return { from, len: f.len, sign: f.sign, span: (f.len + CORNER_IN + CORNER_OUT) * STEP };
  });
  track.cornerAt = at;
  track.cornerW = wAt;
  track.cornerA = apexAt;
  track.cornerStart = startAt;
  track.corners = corners;
  return corners;
}

/** Where on the road (px from the centre) this driver's own line runs at point j. */
export function carLine(car, track, j) {
  const L = car.lines;
  const c = L && track.cornerAt ? track.cornerAt[j] : -1;
  if (c < 0 || L.key !== track.key) return track.line[j];
  const p = L.try[c] || L.c[c];
  const n = track.n;
  const f = (((j - p.shift * track.cornerW[j]) % n) + n) % n;
  const i0 = Math.floor(f);
  const t = f - i0;
  const base = track.line[i0] * (1 - t) + track.line[(i0 + 1) % n] * t;
  return base + p.tight * track.corners[c].sign * track.cornerA[j];
}

function initLines(track, st, rand, from = null, lead = -LINE_START.shift) {
  const corners = cornersOf(track);
  const start = { shift: -lead, tight: (LINE_START.tight * lead) / -LINE_START.shift };
  const c = corners.map((_, k) =>
    from
      ? { shift: from.c[k].shift, tight: from.c[k].tight, best: [Infinity, Infinity] }
      : { shift: clamp(start.shift + st.apex + (rand() - 0.5) * 1.5, -LINE_SHIFT, LINE_SHIFT), tight: clamp(start.tight + st.tight + (rand() - 0.5) * 4, -LINE_TIGHT, LINE_TIGHT), best: [Infinity, Infinity] }
  );
  return { key: track.key, c, try: [], runs: [], lastC: -1, adopted: 0 };
}

/**
 * Time each run through a corner window. A clean run (no traffic, fight, DRS, moment or trip off the
 * road) sets that corner's reference time; now and then the driver tries a variation of their line
 * there instead, and keeps it if it beat the reference. Runs are compared only with the same ERS state.
 */
function learnLines(car, race, st, L) {
  const track = race.track;
  const rand = race.rand || Math.random;
  if (race.phase !== "racing" || car.finished) {
    L.runs.length = 0;
    L.try.length = 0;
    return;
  }
  const messy = car.raceW > 0.05 || car.dirty > 0.05 || car.drsOpen || car.offTrack || car.cutGain > 0 || Math.abs(car.d) > halfAt(track, car.idx) + 6 || car.wallHit > 0 || car.recoverT > 0 || car.sliding > 0.6 || !!car.mistake;
  for (let r = L.runs.length - 1; r >= 0; r--) {
    const run = L.runs[r];
    if (messy) run.clean = false;
    if (car.total - run.total0 < run.span) continue;
    const t = race.t - run.t0;
    const p = L.c[run.c];
    const q = L.try[run.c];
    if (run.clean && q) {
      if (t < p.best[run.cls] - Math.max(0.004, t * 0.002)) {
        p.shift = q.shift;
        p.tight = q.tight;
        p.best[run.cls] = t;
        L.adopted++;
      }
    } else if (run.clean) p.best[run.cls] = p.best[run.cls] === Infinity ? t : p.best[run.cls] * 0.7 + t * 0.3;
    L.try[run.c] = null;
    if (car.mistake && car.mistake.c === run.c) car.mistake = null;
    L.runs.splice(r, 1);
  }
  const c = track.cornerStart[car.idx];
  if (c < 0 || c === L.lastC) return;
  L.lastC = c;
  const p = L.c[c];
  const cls = car.battery > 0.5 ? 1 : 0;
  if (p.best[cls] < Infinity && rand() < st.explore * 0.7) {
    const q = { shift: p.shift, tight: p.tight };
    const dir = rand() < 0.5 ? -1 : 1;
    if (rand() < 0.5) q.shift = clamp(p.shift + dir * (1 + rand()), -LINE_SHIFT, LINE_SHIFT);
    else q.tight = clamp(p.tight + dir * (3 + rand() * 5), -LINE_TIGHT, LINE_TIGHT);
    L.try[c] = q;
  }
  L.runs.push({ c, t0: race.t, total0: car.total, span: track.corners[c].span, cls, clean: true });
  // Mistakes: nobody's perfect. How often is the driver's level (err) and who they are, and an angry
  // driver makes more. At most one per corner: too late on the brakes (runs wide, maybe off and a
  // track-limits strike), too greedy on the throttle out of it (a slide, maybe a spin into the wall),
  // drifting off their line, or taking too much of the inside (across a chicane: a cut).
  if (!car.mistake && rand() < (MISTAKE_BASE + st.mistake) * (car.skill.err ?? 0) * (1 + 2 * (car.fury || 0))) {
    car.mistake = { c, t0: race.t, kind: pickWeighted({ late: 0.4, greedy: 0.25, wander: 0.25, cut: 0.1 }, rand), sev: 0.4 + rand() * 0.6, side: (rand() < 0.75 ? -1 : 1) * track.corners[c].sign };
  }
}

/** How far through the race a car is (0-1; a time trial is always half way). */
function raceProgress(race, car) {
  return Number.isFinite(race.laps) ? clamp((Math.max(0, car.laps) + car.s / race.track.L) / race.laps, 0, 1) : 0.5;
}

export function aiInput(car, race, dt) {
  const track = race.track;
  const { n, path, nor, line } = track;
  const sk = car.skill;
  const st = personaOf(car);
  const fwd = Math.max(0, car.fwd);
  cornersOf(track);
  if (!car.lines || car.lines.key !== track.key) {
    // (a line worked out in qualifying carries into the race)
    car.lines = initLines(track, st, race.rand || Math.random, sk.lines && sk.lines.key === track.key ? sk.lines : null, sk.lead);
  }
  learnLines(car, race, st, car.lines);

  // Follow a speed plan: how close to the grip limit this driver corners and how late they brake.
  // In dirty air the car has less grip, and the driver knows it.
  // (a bot with a faster car knows it: it plans on its own grip and brakes)
  const boost = sk.boost ?? 1;
  const m = (sk.corner + st.corner) * boost * (1 - DIRTY_AIR.grip * (car.dirty || 0));
  // Brake management: plan on the braking the car actually has (cold, fading or worn brakes stop
  // shorter), and when they run hot, brake earlier and lighter (lift and coast) to let them cool
  const hot = car.brakeTemp > BRAKES.window[1] - 40;
  // (with the inside line on someone, the committed ones brake later to make it stick)
  // (and the less skilled misjudge it)
  const dive = car.attackInside ? 1 + 0.04 * (car.aggNow ?? st.agg) + 0.05 * (sk.err ?? 0) : 1;
  const prof = speedProfile(track, m, (sk.brake + st.brake) * boost * (car.brakeEff ?? 1) * (hot ? 0.8 : 1) * dive);
  const look = 1 + Math.round((fwd * 0.04) / STEP);
  let target = prof[(car.idx + look) % n];
  // A mistake in this corner (see learnLines). It's over once it has bitten (into the wall, a spin,
  // nearly stopped) or after a few seconds, whichever comes first.
  if (car.mistake && (car.wallHit > 0 || car.recoverT > 0 || car.stuckT > 0.3 || fwd < 60 || race.t - car.mistake.t0 > 4)) car.mistake = null;
  const mk = car.mistake && car.mistake.c === track.cornerAt[car.idx] ? car.mistake : null;
  // Too late on the brakes: arriving too fast for it
  // (against what the car can really do, not the driver's usual margin: a cautious driver gets it wrong too)
  if (car.mistake && car.mistake.kind === "late" && car.mistake.c === track.cornerAt[(car.idx + look) % n]) {
    const limit = speedProfile(track, boost * (1 - DIRTY_AIR.grip * (car.dirty || 0)), boost * 0.95)[(car.idx + look) % n];
    target = Math.max(target, limit * (1.08 + 0.15 * car.mistake.sev));
  }
  // Off the racing line (attacking, defending, pushed wide), the car's own path through the coming
  // corners is tighter than the line's: slow down for it (grip-limited speed goes with the square root
  // of the radius). Judged from where the car is and where it's heading, whichever is tighter.
  const offBy = Math.abs(car.d - carLine(car, track, car.idx));
  if (offBy > 12 || car.raceW > 0.05) {
    let ratio = 1;
    for (let k = 0; k <= look + 24; k += 2) {
      const j = (car.idx + k) % n;
      const rc = track.radii[j];
      if (rc > 1500) continue;
      const s = Math.sign(track.curv[j]);
      const onLine = Math.max(20, rc - s * line[j]);
      const here = Math.max(20, rc - s * car.d);
      const heading = car.raceW > 0.05 ? Math.max(20, rc - s * car.raceD) : here;
      ratio = Math.min(ratio, Math.sqrt(Math.min(1, Math.min(here, heading) / onLine)));
    }
    target *= Math.max(0.7, ratio);
  }

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
        const room = halfAt(track, car.idx) - 14;
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
  const onLine = carLine(car, track, preview);
  // Drifting off their line, or taking too much of the inside
  let err = 0;
  let edgeAllow = 16;
  if (mk && mk.kind === "wander") {
    // (mostly running wide on the way out; sometimes tucking in too early)
    err = mk.side * (70 + 60 * mk.sev) * track.cornerW[preview];
    edgeAllow = -20 - 40 * mk.sev;
  } else if (mk && mk.kind === "cut") {
    err = track.corners[mk.c].sign * (60 + 60 * mk.sev) * track.cornerA[preview];
    edgeAllow = -30 - 40 * mk.sev;
  }
  const wantD = clamp(dodge ?? onLine + (car.raceD - onLine) * car.raceW + err, -(halfAt(track, preview) - edgeAllow), halfAt(track, preview) - edgeAllow);
  const cross = car.d - wantD;
  car.noiseT += dt;
  const noise = (sk.noise ?? 0) * st.noise + st.noiseAdd;
  const wobble = noise ? Math.sin(car.noiseT * 1.7) * noise * 0.12 : 0;
  const delta = headingErr + Math.atan((-2.2 * cross) / (fwd + 40)) + wobble;
  const edge = Math.abs(car.d) - (halfAt(track, car.idx) - 12);
  const recover = edge > 0 && !(mk && (mk.kind === "wander" || mk.kind === "cut")) ? -Math.sign(car.d) * Math.min(1, edge / 10) : 0;
  const steer = clamp(delta / maxSteerAt(fwd) + recover, -1, 1);

  let throttle = 0;
  let brake = 0;
  if (fwd > target + 6) brake = clamp((fwd - target) / 22, 0.35, hot ? 0.75 : 1);
  else throttle = clamp((target - fwd) / 30 + 0.5, 0, 1);
  // Missed the braking point: a moment late on the pedal, then it's too late to get it all off
  const lateMk = car.mistake && car.mistake.kind === "late" && car.mistake.c === track.cornerAt[(car.idx + look) % n] ? car.mistake : null;
  if (lateMk && brake > 0 && (lateMk.hold ??= 0.08 + 0.17 * lateMk.sev) > 0) {
    lateMk.hold -= dt;
    brake = 0;
    throttle = 0;
  }
  // Exit traction: feed the throttle in while still turning, and lift when running out of road
  if (throttle > 0) {
    // Lift only when the tyres are actually saturated (sliding), not just because the car is turning
    throttle *= clamp(1 - car.sliding * 2.5, 0.3, 1);
    // (only while actually heading further out: a car off the road and pointing back on gets the power)
    // Judged on where the car's sideways drift will carry it in the next ~0.3 s, not just where it is,
    // so a car sliding wide out of a hairpin lifts before it's on the grass
    const nr = track.nor[car.idx];
    const vLat = car.vx * nr[0] + car.vy * nr[1];
    const dSoon = car.d + vLat * 0.3;
    const outward = vLat * Math.sign(dSoon) > 0;
    const edgeSoon = Math.max(edge, Math.abs(dSoon) - (halfAt(track, car.idx) - 12));
    if (edgeSoon > -24 && outward && Math.sign(dSoon) === Math.sign(dSoon - wantD)) throttle *= clamp(1 - (edgeSoon + 24) / 30, 0.15, 1);
  }
  // Power oversteer: at low speed with the wheel turned, feed the throttle in gently (managing the
  // wheelspin, as a driver does) and back off the moment the rear starts to step out
  if (mk && mk.kind === "greedy" && brake === 0) throttle = Math.max(throttle, 0.75 + 0.25 * mk.sev);
  else if (throttle > 0) {
    const lowSpeed = Math.max(0, 1 - fwd / (CAR.top * 0.45));
    throttle = Math.min(throttle, 1 - 0.6 * lowSpeed * Math.min(1, Math.abs(car.steer)));
    throttle *= clamp(1 - (car.oversteer || 0) * 2.2, 0.25, 1);
  }
  // Running wide in a tight corner (the front's gone): scrub the speed off rather than ride it out
  // across the road (in a chicane, straight over the inside of the next corner)
  if (track.radii[car.idx] < 200 && car.balance > 0.1 && !(mk && (mk.kind === "wander" || mk.kind === "greedy"))) {
    const wide = (wantD - car.d) * Math.sign(track.curv[car.idx]);
    if (wide > 40 && car.balance > 0.14) {
      throttle = 0;
      brake = Math.max(brake, clamp((wide - 40) / 40, 0.2, 0.8));
    }
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
  // ERS: deploy out of slow corners and when attacking or defending; spend freely when the battery's
  // full. How is the driver's style: some save it all for a fight, some spend it as it comes.
  const pressure = (car.gapAhead > 0 && car.gapAhead < 1.2) || car.defending;
  const exit = fwd < CAR.top * 0.7 && throttle > 0.8;
  const fighting = pressure || (car.attack && car.raceW > 0.3);
  // Each lap the driver picks how to use the battery (a late charger burns more as the end nears)
  if (car.ersLap !== car.laps) {
    car.ersLap = car.laps;
    const rand = race.rand || Math.random;
    car.ersPlan = pickWeighted({ save: st.ersSave, burn: st.ersBurn + st.charge * raceProgress(race, car) + (car.fury || 0), steady: 0.4 }, rand);
  }
  const want =
    car.ersPlan === "save" ? fighting || (exit && car.battery > 0.45) || car.battery > 0.85
    : car.ersPlan === "burn" ? exit || fighting || car.battery > 0.25
    : exit || pressure || car.battery > 0.5;
  const ers = throttle > 0.8 && car.battery > 0.08 && want && (sk.corner >= 0.84 || exit);
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
export function makeField({ mode, difficulty = "medium", seed = 1, cars = DEFAULT_CARS }) {
  const rand = seededRand(seed ^ 0x9e3779b9);
  const base = DIFFICULTY[difficulty] || DIFFICULTY.medium;
  const gpCars = clamp(Math.round(cars) || DEFAULT_CARS, MIN_CARS, MAX_CARS);
  const count = mode === "gp" ? gpCars - 1 : mode === "duel" ? 1 : mode === "demo" ? 10 : 0;
  const drivers = DRIVERS.slice();
  for (let k = drivers.length - 1; k > 0; k--) {
    const j = Math.floor(rand() * (k + 1));
    [drivers[k], drivers[j]] = [drivers[j], drivers[k]];
  }
  const shuffle = (a, r) => {
    for (let k = a.length - 1; k > 0; k--) {
      const j = Math.floor(r() * (k + 1));
      [a[k], a[j]] = [a[j], a[k]];
    }
    return a;
  };
  const deck = [];
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
        corner: clamp(base.corner + spread * 0.5, 0.5, 1.03),
        brake: clamp(base.brake + spread * 0.5, 0.45, 1),
        commit: clamp(base.commit + spread * 0.4, 0.55, 1)
      };
    }
    // Deal the driver a style from a shuffled deck (every style once before any repeats), and make
    // their persona for this race (its small pace trims apply as they drive; the level stays as set)
    if (rank % STYLES.length === 0) deck.splice(0, deck.length, ...shuffle(STYLES.slice(), rand));
    const st = makePersona(deck[rank % STYLES.length], rand);
    skill.style = st.style;
    skill.persona = st;
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
    noise: (skill.noise ?? 0) * 0.5,
    err: (skill.err ?? 0) * 0.7
  };
}

// Qualifying: everyone gets this many timed laps in a row, starting from the line; the best clean one counts
export const QUALI_LAPS = 3;

/** A bot's whole qualifying run: QUALI_LAPS laps from the line, each [{ time, valid }] with its own bit of form. */
export function qualifyingRun(track, skill, rand = Math.random) {
  // Same start as the player: from the line, so lap 1 includes the getaway and laps 2-3 are flying
  const race = createRace({ track, mode: "trial", seed: 1 });
  const car = race.cars[0];
  car.isPlayer = false;
  car.skill = qualifyingSkill(skill);
  race.player = null;
  const dt = 1 / 120;
  for (let k = 0; k < 150 * QUALI_LAPS * 120 && car.lapTimes.length < QUALI_LAPS; k++) stepRace(race, null, dt);
  // The lines they worked out go with them into the race
  if (car.lines) skill.lines = car.lines;
  const laps = car.lapTimes.slice(0, QUALI_LAPS).map((l) => ({ time: l.time * (1 + (rand() - 0.5) * 0.008), valid: l.valid }));
  while (laps.length < QUALI_LAPS) laps.push({ time: Infinity, valid: false });
  return laps;
}

/** Best clean lap of a qualifying run (Infinity if every lap was deleted). */
export const bestQualiLap = (laps) => Math.min(...laps.filter((l) => l.valid).map((l) => l.time));

export function qualifyingLap(track, skill, rand = Math.random) {
  return bestQualiLap(qualifyingRun(track, skill, rand));
}

export function createRace({ track, mode, laps = 5, difficulty = "medium", seed = 1, grid = null, brakes = false, fieldSize = DEFAULT_CARS }) {
  const rand = seededRand(seed);
  const cars = [];
  // Grid order, front to back: "player" or a field entry. By default the player starts in the middle
  // of a GP grid, second in a duel, and alone in a time trial.
  if (!grid) {
    const field = makeField({ mode, difficulty, seed, cars: fieldSize });
    // In a Grand Prix the player starts about a third of the way down the field (7th of 20)
    const playerSlot = mode === "gp" ? Math.round((6 / 19) * field.length) : mode === "duel" ? 1 : 0;
    grid = mode === "demo" ? field : [...field.slice(0, playerSlot), "player", ...field.slice(playerSlot)];
  }
  grid.forEach((entry, k) => {
    if (entry === "player") cars.push(makeCar("player", PLAYER_LIVERY, track.grid[k], { isPlayer: true }));
    else cars.push(makeCar(entry.id, entry.livery, track.grid[k], { skill: entry.skill }));
  });
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
  // Start lights: each of the five comes on after its own random gap, then they go out after an
  // unpredictable hold (0.2 to 3 s), so a start can never be timed from memory
  const lightTimes = [];
  for (let k = 0, at = 0; k < 5; k++) lightTimes.push((at += 0.65 + rand() * 0.6));
  const lightsOutAt = lightTimes[4] + 0.2 + rand() * 2.8;
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
    lightTimes,
    lightsOutAt,
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
  // Crossing the line while off the track at racing speed (running wide out of the last corner), or
  // part-way through a shortcut, deletes the lap being completed: that's the lap it helped. The
  // strike or cut is still judged when the car rejoins, but it won't delete the new lap as well.
  if (car.offTrack && car.offTime >= LIMITS.dwell && car.offSpeed > LIMITS.minSpeed && !car.offPushed && car.speed >= car.offSpeed * LIMITS.keep) {
    car.lapValid = false;
    car.offCarried = true;
  }
  if (car.cutGain > CUT_GAIN && car.cutGain - car.cutDriven * 0.8 > 0 && !car.cutPushed) {
    car.lapValid = false;
    car.cutCarried = true;
  }
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
  // Line crossing (index wraps n-1 → 0). Reversing back over the line leaves a debt: the next forward
  // crossing only brings the car back to where it was, it doesn't count as a lap (no farming laps by
  // rocking back and forth over the line).
  if (forward && car.idx < prevIdx) {
    if (car.lineDebt > 0) {
      car.lineDebt -= 1;
      car.sector = 0;
    } else if (car.laps < 0 || car.sector === 2) {
      if (car.laps >= 0) sectorDone(race, car, 2);
      crossLine(race, car);
      car.sector = 0;
      car.sectorColors = [null, null, null];
    }
  } else if (back && car.idx > prevIdx && car.laps >= 0) {
    // Reversed back over the line: it has to be driven over again before the next one counts
    car.lineDebt = (car.lineDebt || 0) + 1;
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
    let lit = 0;
    while (lit < 5 && race.clock >= race.lightTimes[lit]) lit++;
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
    // One car for everyone (same ERS, DRS, tow, dirty air); from Hard up the bots' car is faster
    // (skill.boost). The player's brake setting can only soften the pedal.
    const boost = car.isPlayer ? 1 : car.skill.boost ?? 1;
    const mods = {
      power: ersPow * boost,
      top: ersTop * (car.drsOpen ? 1.12 : 1) * (car.slip ? 1.05 : 1) * boost,
      grip: (1 - DIRTY_AIR.grip * car.dirty) * boost,
      dirty: car.dirty,
      brake: (car.isPlayer ? Math.min(1, input.brakeMult ?? 1) : boost) * (car.brakeEff ?? 1)
    };
    const prevIdx = car.idx;
    const fwdBefore = car.fwd;
    const hit = stepCar(car, input, track, dt, mods);
    if (hit && car.isPlayer) emit(race, { type: "wall", car: car.id, speed: car.speed });

    // Harvest under braking (MGU-K), capped per lap. Slow-speed braking recovers less.
    car.harvesting = false;
    if (!canErs && (input.brake ?? 0) > 0.05 && car.fwd > 60 && car.battery < 1) {
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
    const halfW = halfAt(track, car.idx);
    const off = Math.abs(car.d) > halfW + LIMITS.margin;
    if (off) {
      if (!car.offTrack) {
        car.offTrack = true;
        car.offTime = 0;
        car.offSpeed = car.speed;
        car.offPushed = false;
      }
      car.offTime += dt;
      if (pushed) car.offPushed = true;
    } else if (car.offTrack && Math.abs(car.d) < halfW + 16) {
      car.offTrack = false;
      const carried = car.offCarried;
      car.offCarried = false;
      const gained = car.speed >= car.offSpeed * LIMITS.keep;
      // (across the inside of a corner is the corner-cut rule's business, below)
      if (car.laps >= 0 && !car.cutGain && car.offTime >= LIMITS.dwell && car.offSpeed > LIMITS.minSpeed && !car.offPushed && !pushed) {
        if (gained) {
          if (!carried) car.lapValid = false;
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
    const offRoad = Math.abs(car.d) > halfW + 16;
    const moved = (car.idx - prevIdx + track.n) % track.n;
    // (a real corner only: two wheels on the grass inside a flat-out kink gains next to nothing)
    if (offRoad && moved < track.n / 2 && track.radii[car.idx] < 500 && Math.sign(car.d) === Math.sign(track.curv[car.idx])) {
      car.cutGain = (car.cutGain || 0) + moved * STEP;
      car.cutDriven = (car.cutDriven || 0) + car.speed * dt;
      if (pushed) car.cutPushed = true;
    }
    if (!offRoad && car.cutGain) {
      const shortcut = car.cutGain - car.cutDriven * 0.8;
      if (car.cutGain > CUT_GAIN && shortcut > 0 && !car.cutPushed && car.laps >= 0) {
        if (!car.cutCarried) car.lapValid = false;
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
      car.cutCarried = false;
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
  // The inside of the FIRST real corner coming up (in a quick left-right, that's the first one)
  let cornerIn = 99;
  const insideOfNextCorner = (idx) => {
    for (let k = 8; k < 70; k += 2) {
      const j = (idx + k) % tn;
      if (track.radii[j] < 600) {
        cornerIn = k;
        return Math.sign(curv[j]);
      }
    }
    cornerIn = 99;
    return 0;
  };
  for (const car of cars) {
    if (car.isPlayer) continue;
    if (car.finished) {
      car.raceW = Math.max(0, car.raceW - dt / 0.6); // back to the racing line for the cool-down lap
      continue;
    }
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
    // A spot on the road (not an offset from the line, which would carry into the next corners).
    // How and when a driver attacks and defends comes from who they are, their mood, and a plan
    // picked at random for each fight.
    const P = personaOf(car);
    const rnd = race.rand || Math.random;
    // Mood: drifts toward a new random target every few seconds (the volatile ones swing further)
    if (race.phase === "racing") {
      car.moodT = (car.moodT ?? 0) - dt;
      if (car.moodT <= 0) {
        car.moodT = 3 + rnd() * 9;
        car.moodTo = (rnd() - 0.5) * 0.9 * P.volatility;
      }
      car.mood = (car.mood || 0) + clamp((car.moodTo || 0) - (car.mood || 0), -0.25 * dt, 0.25 * dt);
      // Losing a place fires them up (their grudge); making one calms them down
      if (car.lastPos != null && car.pos > car.lastPos) car.fury = Math.min(0.6, (car.fury || 0) + 0.35 * P.grudge);
      else if (car.lastPos != null && car.pos < car.lastPos) car.fury = (car.fury || 0) * 0.5;
      car.fury = Math.max(0, (car.fury || 0) - 0.03 * dt);
      car.lastPos = car.pos;
    }
    const late = P.charge * (raceProgress(race, car) - 0.55);
    const aggNow = (car.aggNow = clamp(P.agg + (car.mood || 0) + (car.fury || 0) + late * 0.9, 0, 1));
    const patNow = clamp(P.patience - (car.fury || 0) * 0.8 - late * 0.6, 0, 1);
    let spot = null;
    car.attackInside = false;
    // The car ahead has made a mistake (a slide, a moment off the road or into the wall, a slow exit)
    const chance = ahead && (ahead.sliding > 0.35 || ahead.offTrack || ahead.wallHit > 0 || ahead.fwd < car.fwd - 40);
    const drsOn = car.drsOpen || (car.inDrsZone && car.drsEligible);
    const range = (120 + 80 * aggNow) * (chance ? 1.4 : 1);
    // The patient ones only go when there's a real chance: DRS, a mistake, a much better run, or right there
    const keen = !!ahead && aheadGap < range && (car.fwd > ahead.fwd - 15 || aheadGap < 70) && (patNow < 0.6 || drsOn || chance || car.fwd > ahead.fwd + 20 + 20 * patNow || aheadGap < 60);
    if (keen) {
      car.defPlan = null;
      const inside = insideOfNextCorner(car.idx);
      const alongside = Math.abs(car.d - ahead.d) > 12;
      let at = car.attack;
      const plan = (not) =>
        pickWeighted(
          {
            dive: (0.25 + aggNow * (1 - 0.5 * P.straights)) * (not === "dive" ? 0.2 : 1),
            around: (0.05 + 0.45 * aggNow * P.risk) * (not === "around" ? 0.2 : 1),
            tow: (0.15 + P.tow * P.straights) * (not === "tow" ? 0.2 : 1),
            dummy: (0.03 + 0.5 * P.feint * P.straights) * (not === "dummy" ? 0.2 : 1),
            exit: (0.05 + 0.4 * patNow) * (not === "exit" ? 0.2 : 1)
          },
          rnd
        );
      if (!at || at.on !== ahead.id) at = car.attack = { on: ahead.id, plan: plan(null), age: 0, giveUp: 3 + rnd() * 5, side: 0, since: 0, d0: 0, switched: false, pullAt: 55 + (1 - P.tow) * 40 + rnd() * 25, fake: 0.2 + rnd() * 0.35 };
      at.age += dt;
      // Not working: try something else
      if (at.age > at.giveUp && !alongside) {
        at.plan = plan(at.plan);
        at.age = 0;
        at.giveUp = 3 + rnd() * 5;
        at.side = 0;
        at.switched = false;
        at.pullAt = 55 + (1 - P.tow) * 40 + rnd() * 25;
      }
      if (cornerIn === 99) {
        // A straight
        const slip = at.plan === "tow" || at.plan === "dummy";
        if (slip && !alongside && !at.side && aheadGap > at.pullAt) spot = ahead.d; // sit in the tow
        else {
          // (a straight fight: whichever side they're on; a pull-out from the tow: usually the side
          // with more room, sometimes not, and they stick with it)
          if (!at.side || !slip) {
            const room = -Math.sign(ahead.d) || 1;
            at.side = alongside ? Math.sign(car.d - ahead.d) : slip ? (rnd() < 0.7 ? room : -room) : Math.sign(car.d - ahead.d) || room;
            at.since = 0;
            at.d0 = ahead.d;
          }
          at.since += dt;
          // They moved to cover it, or it was a dummy all along: switch (once)
          const covered = (ahead.d - at.d0) * at.side > 10;
          if (!at.switched && aheadGap > 35 && ((covered && rnd() < P.feint * dt * 8) || (at.plan === "dummy" && at.since > at.fake))) {
            at.side = -at.side;
            at.switched = true;
          }
          spot = at.side * tw * 0.28;
        }
      } else {
        at.side = 0;
        at.switched = false;
        // A corner coming. Alongside: stay on that side. Hanging back for the exit: stay on the line.
        let side = alongside ? Math.sign(car.d - ahead.d) : at.plan === "around" ? -inside || 1 : inside || Math.sign(car.d - ahead.d) || 1;
        if (!alongside && (at.plan === "exit" || ((at.plan === "tow" || at.plan === "dummy") && aheadGap > 60))) side = 0;
        // The door's shut on that side: go round the outside if they dare, otherwise wait
        if (side && !alongside && Math.sign(ahead.d) === side && Math.abs(ahead.d) > tw * 0.18) side = aggNow * P.risk > 0.2 ? -side : 0;
        // (round the outside only a little way off the line, less the nearer the corner is: a wide
        // line in is a slow one; the brave hang it out further)
        if (side) spot = side * tw * (inside && side === -inside ? (0.06 + 0.16 * clamp((cornerIn - 8) / 50, 0, 1)) * (0.85 + 0.3 * P.risk) : 0.28);
        car.attackInside = spot != null && inside !== 0 && side === inside && cornerIn < 35;
      }
    } else {
      car.attack = null;
      if (behind && behindGap < 40 + 80 * P.defend && behind.fwd > car.fwd - 10) {
        // Defend, with a plan for this fight: cover the inside (early or late), pull across once to
        // break the tow on a straight, or just hold the line
        let dp = car.defPlan;
        if (!dp || dp.vs !== behind.id) {
          dp = car.defPlan = {
            vs: behind.id,
            plan: pickWeighted({ cover: 0.4 + P.defend, tow: 0.05 + 0.25 * P.defend * P.risk, hold: 0.15 + 0.5 * (1 - P.defend) }, rnd),
            at: 25 + rnd() * 45,
            side: 0
          };
        }
        const inside = insideOfNextCorner(car.idx);
        if (dp.plan === "cover" && inside && cornerIn < dp.at) spot = inside * tw * (0.12 + 0.12 * P.defend);
        else if (dp.plan === "tow" && (cornerIn === 99 || cornerIn > 25) && (dp.side || behindGap < 90)) {
          if (!dp.side) dp.side = Math.sign(behind.d - car.d) || 1;
          spot = dp.side * tw * 0.16;
        }
      } else car.defPlan = null;
    }
    // Never set up on the outside of the corner the car is in: hold the line until the exit
    if (spot != null && track.radii[car.idx] < 600 && Math.sign(spot) === -Math.sign(curv[car.idx])) spot = null;
    if (spot != null) {
      if (car.raceW < 0.05) car.raceD = tline[car.idx]; // start from where the line is
      car.raceD += clamp(spot - car.raceD, -80 * dt, 80 * dt);
    }
    // Move across over ~0.6 s, and back to the racing line the same way
    car.raceW = clamp(car.raceW + (spot != null ? dt : -dt) / 0.6, 0, 1);
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
