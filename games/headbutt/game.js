/* ================================================================
 *  HEADBUTT — Drive Ahead-style physics car battler
 *  Two cars, one small arena: touch the other driver's helmet with your car to win the round.
 *  First to 5. Bots from Easy to Insane, or a friend on the same keyboard.
 * ================================================================ */
import { initShell, escapeHtml } from "/shared/shell.js";
import { sfx } from "/shared/sound.js";
import { playExplosion, playHit, playTone, setEngineHum } from "/shared/audio.js";
import { saveGameScore, saveSlot, loadSlot } from "/shared/save.js";
import { vignette, glow, createParticles } from "/shared/gfx.js";
import {
  CARS,
  CAR_KEYS,
  ARENAS,
  ARENA_KEYS,
  BOTS,
  BOT_KEYS,
  ROUND_SECONDS,
  WINS_NEEDED,
  BOOST_COOLDOWN,
  contactOutcome,
  hazardOutcome,
  resolveRound,
  matchWinner,
  mirrorCar
} from "./data.js";
import { domeSegments } from "./maps.js";
import * as art from "./art.js";

initShell({ crumb: "Headbutt" });

const { Engine, Composite, Bodies, Body, Constraint, Events, Vertices, Query } = Matter;

const canvas = document.getElementById("hb-canvas");
const ctx = canvas.getContext("2d");
const W = art.W;
const H = art.H;
canvas.width = W;
canvas.height = H;
const overlay = document.getElementById("hb-overlay");
const STEP_MS = 1000 / 120;
const BASE_MS = 1000 / 60; // Matter velocities are per 16.7 ms
const WATER_DENSITY = 0.0055;

// ─────────────────────────── persistence ───────────────────────────
const prefs = Object.assign({ car: "hotrod", foeCar: "random", arena: "stadium", bot: "normal", mode: "bot" }, loadSlot("headbutt-prefs") || {});
if (!CARS[prefs.car]) prefs.car = "hotrod";
if (prefs.foeCar !== "random" && !CARS[prefs.foeCar]) prefs.foeCar = "random";
if (prefs.arena !== "random" && !ARENAS[prefs.arena]) prefs.arena = "stadium";
if (!BOTS[prefs.bot]) prefs.bot = "normal";
const record = Object.assign({ wins: 0, losses: 0, headshots: 0 }, loadSlot("headbutt-record") || {});
const savePrefs = () => saveSlot("headbutt-prefs", prefs);

// ─────────────────────────── input ───────────────────────────
const keys = new Set();
window.addEventListener("keydown", (e) => {
  if (e.target instanceof Element && e.target.closest("input, textarea, select, [contenteditable]")) return;
  if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Space"].includes(e.code) && game.screen !== "garage") e.preventDefault();
  keys.add(e.code);
  if (e.code === "Escape" && ["countdown", "play", "ko"].includes(game.screen)) togglePause();
  else if (e.code === "Escape" && game.screen === "paused") togglePause();
  if ((e.code === "Enter" || e.code === "Space") && game.screen === "garage" && !e.repeat && document.activeElement?.tagName !== "BUTTON") startMatch();
});
window.addEventListener("keyup", (e) => keys.delete(e.code));
window.addEventListener("blur", () => keys.clear());
const down = (...codes) => codes.some((c) => keys.has(c));

// Touch: left half = back, right half = forward, two-finger tap = boost
const touch = { l: false, r: false, boost: false };
canvas.addEventListener("pointerdown", (e) => {
  if (game.screen !== "play" && game.screen !== "countdown") return;
  const rect = canvas.getBoundingClientRect();
  if (e.clientX - rect.left < rect.width / 2) touch.l = true;
  else touch.r = true;
  if (touch.l && touch.r) touch.boost = true;
});
const clearTouch = () => Object.assign(touch, { l: false, r: false, boost: false });
canvas.addEventListener("pointerup", clearTouch);
canvas.addEventListener("pointercancel", clearTouch);

function humanInput(idx) {
  if (game.cfg.mode === "friend") {
    if (idx === 0) return { throttle: (down("KeyD") ? 1 : 0) - (down("KeyA") ? 1 : 0), boost: down("KeyW") };
    // Right-hand player drives toward the left: ← is "forward"
    return { throttle: (down("ArrowLeft") ? 1 : 0) - (down("ArrowRight") ? 1 : 0), boost: down("ArrowUp") };
  }
  const throttle = (down("KeyD", "ArrowRight") || touch.r ? 1 : 0) - (down("KeyA", "ArrowLeft") || touch.l ? 1 : 0);
  return { throttle, boost: down("KeyW", "ArrowUp", "Space") || touch.boost };
}

// ─────────────────────────── game state ───────────────────────────
const fx = createParticles(900);
const game = {
  screen: "garage",
  cfg: null,
  scores: [0, 0],
  round: 1,
  timer: ROUND_SECONDS,
  overtime: false,
  engine: null,
  cars: [],
  statics: [],
  hazards: [],
  seesaw: null,
  crusher: null,
  lavaRise: null,
  liquid: null,
  rising: false,
  kin: [],
  saws: [],
  props: [],
  floaters: [],
  meteors: [],
  meteorClock: 0,
  simT: 0,
  helmet: null,
  knockouts: [],
  result: null,
  koClock: 0,
  countdown: 0,
  shake: 0,
  cam: { x: W / 2, y: H / 2, z: 1 },
  arenaArt: null,
  excite: 0,
  frame: 0,
  stats: { headshots: [0, 0] }
};

// ─────────────────────────── world building ───────────────────────────
function shapeBody(shape, opts) {
  if (shape.rect) {
    const [cx, cy, w, h] = shape.rect;
    return Bodies.rectangle(cx, cy, w, h, { ...opts, angle: shape.angle || 0 });
  }
  const pts = shape.poly.map(([x, y]) => ({ x, y }));
  const c = Vertices.centre(pts);
  const b = Bodies.fromVertices(c.x, c.y, [pts], opts);
  // fromVertices recentres on the area centroid; put it back exactly where it was authored
  const bc = Vertices.centre(b.vertices);
  Body.setPosition(b, { x: b.position.x + (c.x - bc.x), y: b.position.y + (c.y - bc.y) });
  return b;
}

function createCar(idx, key, spawn, arena) {
  const base = CARS[key];
  const facing = idx === 0 ? 1 : -1;
  const def = facing === 1 ? base : mirrorCar(base);
  const group = Body.nextGroup(true);
  const filter = { group };
  const x0 = spawn.x;
  const y0 = spawn.y;
  const parts = def.parts.map((p) => {
    const shp = p.rect ? { rect: [x0 + p.rect[0], y0 + p.rect[1], p.rect[2], p.rect[3]] } : { poly: p.poly.map(([x, y]) => [x0 + x, y0 + y]) };
    return shapeBody(shp, { label: `p${idx}_body`, density: def.density, collisionFilter: filter, chamfer: p.rect ? { radius: 4 } : undefined });
  });
  const head = Bodies.circle(x0 + def.head.x, y0 + def.head.y, def.head.r, { label: `p${idx}_head`, density: 0.0006, collisionFilter: filter });
  const body = Body.create({ parts: [...parts, head], collisionFilter: filter, friction: 0.4, frictionAir: 0.008, restitution: 0.12 });
  const com = { x: body.position.x, y: body.position.y };
  const wheels = [];
  const axles = [];
  for (const w of def.wheels) {
    const wheel = Bodies.circle(x0 + w.x, y0 + w.y, w.r, {
      label: `p${idx}_wheel`,
      density: def.density * 0.7,
      friction: arena.friction,
      frictionStatic: arena.friction * 1.4,
      restitution: 0.08,
      collisionFilter: filter
    });
    wheel.lastTouch = -99;
    wheels.push(wheel);
    axles.push(
      Constraint.create({ bodyA: body, pointA: { x: x0 + w.x - com.x, y: y0 + w.y - com.y }, bodyB: wheel, pointB: { x: 0, y: 0 }, stiffness: 0.32, damping: 0.16, length: 0 })
    );
  }
  return {
    idx,
    key,
    base,
    def,
    facing,
    body,
    head,
    wheels,
    axles,
    origin: { x: x0 - com.x, y: y0 - com.y },
    boostCd: 0,
    boostFx: 0,
    input: { throttle: 0, boost: false },
    headless: false,
    color: idx === 0 ? "#00d8ff" : "#ff3b5c",
    ai: null
  };
}

function buildRound() {
  const arena = ARENAS[game.cfg.arena];
  const engine = Engine.create({ positionIterations: 10, velocityIterations: 8, constraintIterations: 4 });
  engine.gravity.y = arena.gravity;
  const world = engine.world;
  game.engine = engine;
  game.statics = [];
  game.hazards = [];
  game.seesaw = null;
  game.crusher = null;
  game.lavaRise = null;
  game.helmet = null;
  game.knockouts = [];
  game.overtime = false;
  game.timer = ROUND_SECONDS;
  game.liquid = arena.liquid ? { ...arena.liquid } : null;
  game.rising = false;
  game.kin = [];
  game.saws = [];
  game.props = [];
  game.floaters = [];
  game.meteors = [];
  game.meteorClock = 1.5;
  game.simT = 0;
  buildFeatures(arena, world);

  for (const s of arena.solids) {
    const b = shapeBody(s, { isStatic: true, label: "world", friction: s.ice ? 0.02 : arena.friction });
    b.shape = s;
    game.statics.push(b);
  }
  for (const h of arena.hazards || []) {
    const [cx, cy, w, hh] = h.rect;
    const b = Bodies.rectangle(cx, cy, w, hh, { isStatic: true, isSensor: true, label: "hazard" });
    b.kind = h.kind;
    b.rect = [cx, cy, w, hh];
    game.hazards.push(b);
    if (h.kind === "lava") game.lavaRise = b;
  }
  if (arena.seesaw) {
    const s = arena.seesaw;
    const plank = Bodies.rectangle(s.x, s.y, s.w, s.h, { label: "world", density: 0.004, friction: arena.friction, frictionAir: 0.02, chamfer: { radius: 4 } });
    const pin = Constraint.create({ pointA: { x: s.x, y: s.y }, bodyB: plank, pointB: { x: 0, y: 0 }, stiffness: 1, length: 0 });
    game.seesaw = { plank, pin, w: s.w, h: s.h };
  }
  // Invisible walls and ceiling keep the fight on screen
  const walls = [
    Bodies.rectangle(-40, H / 2, 80, H * 3, { isStatic: true, label: "world" }),
    Bodies.rectangle(W + 40, H / 2, 80, H * 3, { isStatic: true, label: "world" }),
    Bodies.rectangle(W / 2, -140, W * 2, 80, { isStatic: true, label: "world" })
  ];

  const botCar = game.cfg.foeCar;
  game.cars = [createCar(0, game.cfg.car, arena.spawns[0], arena), createCar(1, botCar, arena.spawns[1], arena)];
  if (game.cfg.mode === "bot") game.cars[1].ai = { level: BOTS[game.cfg.bot], next: 0, throttle: 0, boost: false };
  for (const c of game.cars) Composite.add(world, [c.body, ...c.wheels, ...c.axles]);
  Composite.add(world, [...game.statics, ...game.hazards, ...walls]);
  if (game.seesaw) Composite.add(world, [game.seesaw.plank, game.seesaw.pin]);

  const onPairs = (evt) => {
    for (const pair of evt.pairs) {
      const a = pair.bodyA.label;
      const b = pair.bodyB.label;
      if (a === "meteor" && b !== "meteor") pair.bodyA.hit = true;
      if (b === "meteor" && a !== "meteor") pair.bodyB.hit = true;
      if (a.endsWith("_wheel")) pair.bodyA.lastTouch = game.frame;
      if (b.endsWith("_wheel")) pair.bodyB.lastTouch = game.frame;
      if (game.screen !== "play") continue;
      const ko = contactOutcome(a, b) || hazardOutcome(a, b);
      if (ko) {
        const other = ko.loser === 0 ? 1 : 0;
        const hitAt = pair.collision?.supports?.[0] || game.cars[ko.loser].head.position;
        game.knockouts.push({ ...ko, x: hitAt.x, y: hitAt.y, by: ko.by, hitter: other, cow: !!(pair.bodyA.cow || pair.bodyB.cow) });
      }
    }
  };
  Events.on(engine, "collisionStart", onPairs);
  Events.on(engine, "collisionActive", onPairs);
}

// Moving parts are "kinematic": huge mass, no spin inertia, gravity cancelled, and steered onto an
// exact path every step with a matching velocity so cars riding them are carried along.
function makeKinematic(b) {
  Body.setMass(b, 5000);
  Body.setInertia(b, Infinity);
  b.frictionAir = 0;
  return b;
}
function steerKinematic(b, x, y, angle) {
  const vs = BASE_MS / STEP_MS;
  const vx = (x - b.position.x) * vs;
  const vy = (y - b.position.y) * vs;
  const va = (angle - b.angle) * vs;
  Body.setPosition(b, { x, y });
  Body.setAngle(b, angle);
  Body.setVelocity(b, { x: vx, y: vy });
  Body.setAngularVelocity(b, va);
  const g = game.engine.gravity;
  Body.applyForce(b, b.position, { x: 0, y: -b.mass * g.y * g.scale });
}

function buildFeatures(arena, world) {
  const add = (...b) => Composite.add(world, b);
  for (const s of arena.saws || []) {
    const b = Bodies.circle(s.x, s.y, s.r, { isStatic: true, label: "saw" });
    b.sawR = s.r;
    b.spin = 9;
    game.saws.push(b);
    add(b);
  }
  for (const pr of arena.props || []) {
    const b = shapeBody({ rect: pr.rect }, { label: "world", density: pr.density || 0.003, friction: arena.friction, chamfer: { radius: 2 } });
    b.shape = { rect: pr.rect, deco: pr.deco };
    game.props.push(b);
    add(b);
  }
  for (const f of arena.floaters || []) {
    const [cx, cy, w, h] = f.rect;
    const opts = { label: "world", density: 0.0012, friction: f.deco === "ice" ? 0.12 : arena.friction, frictionAir: 0.01 };
    let b;
    if (f.deco === "barbell") {
      const bar = Bodies.rectangle(cx, cy, w, h, opts);
      bar.deco = "barbell";
      const plates = [-1, 1].map((sgn) => {
        const pl = Bodies.rectangle(cx + sgn * (w / 2 - 24), cy, 34, 96, opts);
        pl.deco = "plate";
        return pl;
      });
      b = Body.create({ parts: [bar, ...plates], label: "world", friction: arena.friction, frictionAir: 0.01 });
    } else {
      b = Bodies.rectangle(cx, cy, w, h, opts);
      b.deco = f.deco;
    }
    b.fw = w;
    b.fh = h;
    game.floaters.push(b);
    add(b);
  }
  if (arena.rotor) {
    const r = arena.rotor;
    const b = makeKinematic(Bodies.rectangle(r.x, r.y, r.w, r.h, { label: "world", friction: arena.friction, chamfer: { radius: 6 } }));
    b.deco = "rotor";
    game.kin.push({ body: b, path: (t) => [r.x, r.y, r.speed * t] });
    add(b);
  }
  if (arena.pendulum) {
    const pd = arena.pendulum;
    const b = makeKinematic(Bodies.circle(pd.x, pd.y + pd.len, pd.r, { label: "saw" }));
    b.sawR = pd.r;
    b.pivot = pd;
    game.kin.push({
      body: b,
      path: (t) => {
        const th = pd.amp * Math.sin((t * Math.PI * 2) / pd.period);
        return [pd.x + Math.sin(th) * pd.len, pd.y + Math.cos(th) * pd.len, t * 9];
      }
    });
    add(b);
  }
  if (arena.dome) {
    const d = arena.dome;
    const parts = domeSegments(d).map((sg) => {
      const part = Bodies.rectangle(d.x + sg.x, d.y + sg.y, sg.len, sg.thick, { angle: sg.angle, label: "world" });
      part.deco = "cage";
      return part;
    });
    const cage = makeKinematic(Body.create({ parts, label: "world", friction: arena.friction }));
    Body.setPosition(cage, { x: d.x, y: d.y });
    cage.isDome = true;
    game.kin.push({ body: cage, path: (t) => [d.x, d.y, d.speed * t] });
    add(cage);
    if (d.saw) {
      const rs = d.R * (1 + d.k) * 0.72;
      const saw = makeKinematic(Bodies.circle(d.x + rs, d.y, 42, { label: "saw" }));
      saw.sawR = 42;
      game.kin.push({ body: saw, path: (t) => [d.x + Math.cos(d.speed * t) * rs, d.y + Math.sin(d.speed * t) * rs, t * 10] });
      add(saw);
    }
  }
}

// Per-step world features: moving parts, buoyancy, water drag, meteors
function stepFeatures(dt) {
  game.simT += dt;
  const t = game.simT;
  for (const k of game.kin) {
    const [x, y, a] = k.path(t);
    steerKinematic(k.body, x, y, a);
  }
  const L = game.liquid;
  if (L) {
    const g = game.engine.gravity;
    for (const f of game.floaters) {
      // Four sample points along the plank: each carries a quarter of the buoyancy, so load tips it
      let wet = false;
      const c = Math.cos(f.angle);
      const sn = Math.sin(f.angle);
      for (let i = 0; i < 4; i++) {
        const u = (-0.375 + i * 0.25) * f.fw;
        const px = f.position.x + c * u;
        const py = f.position.y + sn * u;
        const bottom = py + (f.fh / 2) * Math.abs(c);
        const sub = Math.max(0, Math.min(1, (bottom - L.y) / f.fh));
        if (sub > 0) {
          wet = true;
          Body.applyForce(f, { x: px, y: py }, { x: 0, y: -(sub * (f.area / 4) * WATER_DENSITY * g.y * g.scale) });
        }
      }
      if (wet) {
        Body.setVelocity(f, { x: f.velocity.x * 0.985, y: f.velocity.y * 0.94 });
        Body.setAngularVelocity(f, f.angularVelocity * 0.95);
      }
    }
    for (const b of [...game.cars.flatMap((c) => [c.body, ...c.wheels]), ...game.props]) {
      if (b.position.y > L.y) Body.setVelocity(b, { x: b.velocity.x * 0.985, y: b.velocity.y * 0.975 });
    }
  }
  // Meteors (and the odd flaming cow) in a flooding sudden death
  const arena = ARENAS[game.cfg.arena];
  if (game.rising && arena.meteors !== false && arena.overtime === "flood") {
    game.meteorClock -= dt;
    if (game.meteorClock <= 0) {
      game.meteorClock = 0.7 + Math.random() * 0.9;
      const cow = Math.random() < 0.08;
      const x = 120 + Math.random() * (W - 240);
      const m = cow ? Bodies.rectangle(x, -40, 46, 28, { label: "meteor", density: 0.002 }) : Bodies.circle(x, -40, 15, { label: "meteor", density: 0.003 });
      m.cow = cow;
      m.mr = cow ? 24 : 15;
      Body.setVelocity(m, { x: (Math.random() - 0.5) * 5, y: 5 });
      Body.setAngularVelocity(m, (Math.random() - 0.5) * 0.3);
      game.meteors.push(m);
      Composite.add(game.engine.world, m);
    }
  }
}

// After the physics step: burst meteors that hit something, sink the ones that missed
function settleMeteors() {
  for (let i = game.meteors.length - 1; i >= 0; i--) {
    const m = game.meteors[i];
    const inWater = game.liquid && m.position.y > game.liquid.y;
    if (m.hit || inWater || m.position.y > H + 100) {
      Composite.remove(game.engine.world, m);
      game.meteors.splice(i, 1);
      const { x, y } = m.position;
      if (inWater && !m.hit) {
        fx.burst(x, game.liquid.y, { count: 14, speed: 160, life: 0.6, size: 3, color: "#cfefff", kind: "pixel", drag: 0.95 });
        continue;
      }
      fx.burst(x, y, { count: 22, speed: 240, life: 0.7, size: 4, color: "#ffd23f", color2: "#ff5a1f", kind: "spark", drag: 0.94 });
      fx.spawn({ x, y, life: 0.5, size: 40, grow: 40, color: "#6a6a72", kind: "smoke", alpha: 0.6 });
      game.shake = Math.max(game.shake, 6);
      playExplosion({ duration: 0.3, lowpass: m.cow ? 900 : 500 });
      if (m.cow) playTone(140, 0.4, "sawtooth", 0.1);
    }
  }
}

// Is there ground (or anything solid) between (x, y) and the liquid surface?
function groundBelow(x, y, limit) {
  const solids = [...game.statics, ...game.props, ...game.floaters, ...game.kin.map((k) => k.body)];
  for (let py = y; py < limit; py += 18) if (Query.point(solids, { x, y: py }).length) return true;
  return false;
}

// ─────────────────────────── bot AI ───────────────────────────
function normAngle(a) {
  a %= Math.PI * 2;
  if (a > Math.PI) a -= Math.PI * 2;
  if (a < -Math.PI) a += Math.PI * 2;
  return a;
}
function botThink(car, foe, dt) {
  const ai = car.ai;
  const L = ai.level;
  ai.next -= dt;
  if (ai.next > 0) return;
  ai.next = L.reaction * (0.7 + Math.random() * 0.6);
  const me = car.body.position;
  const foeHead = foe.head.position;
  const dx = foeHead.x - me.x;
  const grounded = car.wheels.some((w) => game.frame - w.lastTouch < 4);
  const angle = normAngle(car.body.angle);
  const toward = Math.sign(dx) || 1;
  // "forward" for this car points along facing when upright
  let throttle = toward * car.facing * L.aggression;
  if (grounded) {
    if (Math.abs(angle) > 2.2) {
      // On the roof: rock back and forth to roll over
      throttle = Math.sin(game.frame * 0.05) > 0 ? 1 : -1;
    } else if (Math.abs(dx) < 110 && foeHead.y < me.y - 40) {
      // Foe is above us: back off to line up a proper run at them
      throttle = -toward * car.facing;
    }
    // Gaps (bridge seams, the rooftop drop): commit at speed, otherwise back off for a run-up
    const vx = car.body.velocity.x;
    const aheadX = me.x + Math.sign(vx || throttle * car.facing) * 110;
    const gap = (ARENAS[game.cfg.arena].gaps || []).find(([a, b]) => aheadX > a - 20 && aheadX < b + 20);
    if (gap) {
      if (Math.abs(vx) > 6) ai.jump = true;
      else if (!ai.jump && Math.random() > L.noise) throttle = -Math.sign(throttle) || 1;
    } else ai.jump = false;
    if (game.liquid && Math.abs(dx) > 150) {
      const dir = Math.sign(throttle * car.facing) || 1;
      if (!groundBelow(me.x + dir * 120, me.y - 20, game.liquid.y)) throttle = -throttle * 0.8;
    }
  } else {
    // Airborne: rotate back toward upright (throttle spins the body in the air)
    throttle = Math.abs(angle) < 0.25 ? 0 : -Math.sign(angle) * car.facing;
  }
  if (Math.random() < L.noise * 0.5) throttle *= -0.5;
  ai.throttle = Math.max(-1, Math.min(1, throttle));
  ai.boost = grounded && car.boostCd <= 0 && Math.abs(angle) < 0.5 && ((Math.abs(dx) < 330 && Math.random() < L.boost) || ai.jump);
}

// ─────────────────────────── car control ───────────────────────────
function driveCar(car, dt) {
  const { def, facing, body, wheels } = car;
  const inp = car.input;
  const grounded = wheels.some((w) => game.frame - w.lastTouch < 4);
  const target = inp.throttle * def.spin * facing;
  for (const w of wheels) Body.setAngularVelocity(w, w.angularVelocity + (target - w.angularVelocity) * 0.12 * def.torque);
  // Throttle also twists the chassis: small wheelies on the ground, controlled flips in the air
  // (angular velocity is per 16.7 ms base step; ~0.12 ≈ one full turn a second)
  const twist = -inp.throttle * facing * def.air * 0.3 * (grounded ? 0.12 : 1);
  let av = body.angularVelocity + twist;
  if (!inp.throttle && !grounded) av *= 0.985;
  av = Math.max(-0.12, Math.min(0.12, av));
  Body.setAngularVelocity(body, av);

  car.boostCd = Math.max(0, car.boostCd - dt);
  car.boostFx = Math.max(0, car.boostFx - dt);
  if (inp.boost && car.boostCd <= 0) {
    car.boostCd = BOOST_COOLDOWN;
    car.boostFx = 0.35;
    const ax = Math.cos(body.angle) * facing;
    const ay = Math.sin(body.angle) * facing;
    const kick = 9 * (def.boost / 0.03);
    for (const b of [body, ...wheels]) Body.setVelocity(b, { x: b.velocity.x + ax * kick, y: b.velocity.y + ay * kick - 1.5 });
    playTone(160, 0.18, "sawtooth", 0.08);
  }
}

// ─────────────────────────── flow ───────────────────────────
function startMatch() {
  sfx.click();
  const foeCar = prefs.foeCar === "random" ? CAR_KEYS[Math.floor(Math.random() * CAR_KEYS.length)] : prefs.foeCar;
  const arenaKey = prefs.arena === "random" ? ARENA_KEYS[Math.floor(Math.random() * ARENA_KEYS.length)] : prefs.arena;
  game.cfg = { car: prefs.car, foeCar, arena: arenaKey, bot: prefs.bot, mode: prefs.mode };
  game.scores = [0, 0];
  game.round = 1;
  game.stats = { headshots: [0, 0] };
  game.arenaArt = art.buildArenaArt(game.cfg.arena, ARENAS[game.cfg.arena]);
  overlay.hidden = true;
  overlay.innerHTML = "";
  canvas.focus({ preventScroll: true });
  beginRound();
}

function beginRound() {
  buildRound();
  game.screen = "countdown";
  game.countdown = 3.2;
  game.result = null;
  game.cam = { x: W / 2, y: H / 2, z: 1 };
  fx.clear?.();
}

function knockout(res, kos) {
  game.screen = "ko";
  game.koClock = 0;
  game.result = res;
  game.excite = 1;
  game.knockoutsBy = null;
  if (res.draw) {
    game.focus = { x: W / 2, y: H / 2 };
    playExplosion({ duration: 0.4, lowpass: 400 });
    return;
  }
  const loser = game.cars[res.loser];
  const ko = kos.find((k) => k.loser === res.loser) || kos[0];
  game.knockoutsBy = ko.by;
  game.lastCow = !!ko.cow;
  game.focus = { x: loser.head.position.x, y: loser.head.position.y };
  const byCar = ko.by === "car";
  if (byCar) game.stats.headshots[res.winner]++;
  // Pop the helmet off and send it spinning away from the hit
  const hx = loser.head.position.x;
  const hy = loser.head.position.y;
  const away = Math.sign(hx - (byCar ? game.cars[res.winner].body.position.x : W / 2)) || 1;
  const helmet = Bodies.circle(hx, hy, loser.def.head.r, { label: "helmet", restitution: 0.6, density: 0.001 });
  Body.setVelocity(helmet, { x: away * 7, y: -11 });
  Body.setAngularVelocity(helmet, away * 0.4);
  Composite.add(game.engine.world, helmet);
  game.helmet = { body: helmet, color: loser.color, r: loser.def.head.r };
  loser.headless = true;
  fx.burst(hx, hy, { count: 30, speed: 260, life: 1, size: 4, color: "#ffd23f", color2: "#ff3b5c", kind: "spark", drag: 0.95 });
  fx.burst(hx, hy, { count: 18, speed: 160, life: 0.8, size: 3, color: "#ffffff", kind: "pixel", drag: 0.96 });
  fx.spawn({ x: hx, y: hy, life: 0.4, size: 90, color: "#ffffff", kind: "ring", alpha: 0.9 });
  game.shake = 14;
  playExplosion({ duration: 0.6, lowpass: 700 });
  playHit({ pitch: 90, duration: 0.3 });
}

function endKo() {
  const res = game.result;
  if (!res.draw) game.scores[res.winner]++;
  const win = matchWinner(game.scores);
  if (win !== -1) return endMatch(win);
  game.round++;
  beginRound();
}

function endMatch(winner) {
  game.screen = "matchEnd";
  setEngineHum(false);
  const youWon = winner === 0;
  if (game.cfg.mode === "bot") {
    if (youWon) record.wins++;
    else record.losses++;
    record.headshots += game.stats.headshots[0];
    saveSlot("headbutt-record", record);
    if (youWon) saveGameScore("headbutt", record.wins, `${record.wins} MATCH WINS`, { details: `${game.scores[0]}-${game.scores[1]} vs ${BOTS[game.cfg.bot].label} bot` });
  }
  youWon ? sfx.win() : sfx.bad();
  const title = game.cfg.mode === "friend" ? `PLAYER ${winner + 1} WINS` : youWon ? "VICTORY" : "DEFEATED";
  overlay.hidden = false;
  overlay.innerHTML = `
    <div class="hb-panel hb-panel--result">
      <p class="hb-kicker">${escapeHtml(ARENAS[game.cfg.arena].name.toUpperCase())} • ${game.cfg.mode === "friend" ? "VS FRIEND" : `${BOTS[game.cfg.bot].label} BOT`}</p>
      <h2 class="hb-title ${youWon || game.cfg.mode === "friend" ? "is-win" : "is-loss"}">${title}</h2>
      <p class="hb-score"><span style="color:#00d8ff">${game.scores[0]}</span> — <span style="color:#ff3b5c">${game.scores[1]}</span></p>
      <p class="hb-note">${escapeHtml(CARS[game.cfg.car].name)} vs ${escapeHtml(CARS[game.cfg.foeCar].name)} • headshots ${game.stats.headshots[0]}–${game.stats.headshots[1]}</p>
      ${game.cfg.mode === "bot" ? `<p class="hb-note">Career: ${record.wins} wins • ${record.losses} losses • ${record.headshots} headshots</p>` : ""}
      <div class="hb-row">
        <button type="button" class="btn btn--primary" data-act="rematch">REMATCH</button>
        <button type="button" class="btn" data-act="garage">GARAGE</button>
      </div>
    </div>`;
  overlay.querySelector("button")?.focus();
}

function togglePause() {
  if (game.screen === "paused") {
    game.screen = game.pausedFrom;
    overlay.hidden = true;
    overlay.innerHTML = "";
    return;
  }
  game.pausedFrom = game.screen;
  game.screen = "paused";
  setEngineHum(false);
  overlay.hidden = false;
  overlay.innerHTML = `
    <div class="hb-panel hb-panel--small">
      <h2 class="hb-title">PAUSED</h2>
      <div class="hb-col">
        <button type="button" class="btn btn--primary" data-act="resume">RESUME <small>Esc</small></button>
        <button type="button" class="btn" data-act="rematch">RESTART MATCH</button>
        <button type="button" class="btn" data-act="garage">QUIT TO GARAGE</button>
      </div>
    </div>`;
  overlay.querySelector("button")?.focus();
}

// ─────────────────────────── garage ───────────────────────────
const previewArena = () => (ARENAS[prefs.arena] ? prefs.arena : "stadium");
const thumbCache = new Map();
function arenaThumb(key) {
  if (thumbCache.has(key)) return thumbCache.get(key);
  const A = ARENAS[key];
  const a = art.buildArenaArt(key, A);
  const c = document.createElement("canvas");
  c.width = 320;
  c.height = 180;
  const g = c.getContext("2d");
  g.scale(0.25, 0.25);
  g.drawImage(a.img, 0, 0);
  art.drawCrowd(g, a.crowd, 0);
  const vs = (b) => b.vertices.map((v) => [v.x, v.y]);
  const drawShape = (shape) => {
    if (shape.deco === "hidden") return;
    const b = shapeBody(shape, { isStatic: true });
    if (A.theme === "void") g.globalAlpha = 0.12;
    art.drawSolid(g, A.theme, shape, vs(b));
    g.globalAlpha = 1;
  };
  for (const sh of A.solids) drawShape(sh);
  for (const pr of A.props || []) drawShape({ rect: pr.rect, deco: pr.deco });
  for (const f of A.floaters || []) drawShape({ rect: f.rect, deco: f.deco === "barbell" ? "barbell" : f.deco });
  if (A.rotor) drawShape({ rect: [A.rotor.x, A.rotor.y, A.rotor.w, A.rotor.h], deco: "rotor" });
  if (A.dome) {
    for (const sg of domeSegments(A.dome)) {
      const b = Bodies.rectangle(A.dome.x + sg.x, A.dome.y + sg.y, sg.len, sg.thick, { angle: sg.angle, isStatic: true });
      art.drawSolid(g, "dome", { deco: "cage" }, vs(b));
    }
    if (A.dome.saw) art.drawSaw(g, A.dome.x + A.dome.R * (1 + A.dome.k) * 0.72, A.dome.y, 42, 0);
  }
  for (const sw of A.saws || []) art.drawSaw(g, sw.x, sw.y, sw.r, 0);
  if (A.pendulum) {
    const pd = A.pendulum;
    g.strokeStyle = "#8a93a3";
    g.lineWidth = 6;
    g.beginPath();
    g.moveTo(pd.x, pd.y);
    g.lineTo(pd.x, pd.y + pd.len);
    g.stroke();
    art.drawSaw(g, pd.x, pd.y + pd.len, pd.r, 0);
  }
  for (const h of A.hazards || []) {
    const [cx, cy, w, hh] = h.rect;
    if (h.kind === "lava") art.drawLava(g, cx - w / 2, cy - hh / 2, w, hh, 0);
    else art.drawSpikes(g, cx - w / 2, cy - hh / 2, w, hh);
  }
  if (A.seesaw) {
    const ss = A.seesaw;
    art.drawSolid(g, A.theme, { deco: "plank" }, [[ss.x - ss.w / 2, ss.y - ss.h / 2], [ss.x + ss.w / 2, ss.y - ss.h / 2], [ss.x + ss.w / 2, ss.y + ss.h / 2], [ss.x - ss.w / 2, ss.y + ss.h / 2]]);
  }
  if (A.liquid && A.liquid.y < 720) art.drawLiquid(g, A.liquid.y, A.liquid.kind, 0);
  const url = c.toDataURL();
  thumbCache.set(key, url);
  return url;
}

// Paint thumbnails a few at a time after the garage appears, so opening it stays instant
let thumbJob = 0;
function fillThumbs() {
  const job = ++thumbJob;
  const pending = [...overlay.querySelectorAll("img[data-thumb]")];
  const step = () => {
    if (job !== thumbJob) return;
    const t0 = performance.now();
    while (pending.length && performance.now() - t0 < 12) {
      const img = pending.shift();
      img.src = arenaThumb(img.dataset.thumb);
      img.removeAttribute("data-thumb");
    }
    if (pending.length) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function statBar(label, v) {
  return `<div class="hb-stat"><span>${label}</span><i><b style="width:${Math.round(v * 100)}%"></b></i></div>`;
}

function renderGarage() {
  game.screen = "garage";
  setEngineHum(false);
  const car = CARS[prefs.car];
  const foe = prefs.foeCar === "random" ? null : CARS[prefs.foeCar];
  const card = (k) => {
    const ready = thumbCache.get(k);
    return `<button type="button" class="hb-arena ${k === prefs.arena ? "is-on" : ""}" data-arena="${k}" aria-pressed="${k === prefs.arena}">
      <img ${ready ? `src="${ready}"` : `data-thumb="${k}"`} alt="" width="320" height="180" />
      <b>${escapeHtml(ARENAS[k].name)}</b><small>${escapeHtml(ARENAS[k].blurb)}</small>
    </button>`;
  };
  const randomCard = `<button type="button" class="hb-arena hb-arena--random ${prefs.arena === "random" ? "is-on" : ""}" data-arena="random" aria-pressed="${prefs.arena === "random"}">
      <span class="hb-arena__dice" aria-hidden="true">?</span>
      <b>Random</b><small>A different arena every match.</small>
    </button>`;
  const originals = ARENA_KEYS.filter((k) => ARENAS[k].section !== "classic");
  const classics = ARENA_KEYS.filter((k) => ARENAS[k].section === "classic");
  const arenaCards = `${randomCard}${originals.map(card).join("")}`;
  const classicCards = classics.map(card).join("");
  overlay.hidden = false;
  overlay.innerHTML = `
    <div class="hb-panel hb-panel--garage">
      <header class="hb-head">
        <div>
          <h2 class="hb-logo">HEAD<span>BUTT</span></h2>
          <p class="hb-kicker">Bonk the other driver's helmet with your car. First to ${WINS_NEEDED}.</p>
        </div>
        <button type="button" class="btn btn--primary hb-go" data-act="start">FIGHT ▶</button>
      </header>
      <div class="hb-picks">
        <section class="hb-pick">
          <p class="hb-label">${prefs.mode === "friend" ? "PLAYER 1 • A D W" : "YOUR CAR • A D OR ARROWS • W BOOST"}</p>
          <div class="hb-carousel">
            <button type="button" class="hb-arrow" data-car="-1" aria-label="Previous car">◀</button>
            <canvas class="hb-preview" id="hb-prev-p1" width="360" height="200" aria-label="${escapeHtml(car.name)}"></canvas>
            <button type="button" class="hb-arrow" data-car="1" aria-label="Next car">▶</button>
          </div>
          <h3 class="hb-name" style="color:#00d8ff">${escapeHtml(car.name)}</h3>
          <p class="hb-blurb">${escapeHtml(car.blurb)}</p>
          ${statBar("SPEED", car.stats.speed)}${statBar("WEIGHT", car.stats.weight)}${statBar("GRIP", car.stats.grip)}
        </section>
        <section class="hb-pick">
          <p class="hb-label">${prefs.mode === "friend" ? "PLAYER 2 • ARROW KEYS" : "OPPONENT"}</p>
          <div class="hb-carousel">
            <button type="button" class="hb-arrow" data-foe="-1" aria-label="Previous opponent car">◀</button>
            <canvas class="hb-preview" id="hb-prev-p2" width="360" height="200" aria-label="${foe ? escapeHtml(foe.name) : "Random car"}"></canvas>
            <button type="button" class="hb-arrow" data-foe="1" aria-label="Next opponent car">▶</button>
          </div>
          <h3 class="hb-name" style="color:#ff3b5c">${foe ? escapeHtml(foe.name) : "RANDOM"}</h3>
          <div class="hb-chips">
            ${BOT_KEYS.map((b) => `<button type="button" class="hb-chip ${prefs.mode === "bot" && prefs.bot === b ? "is-on" : ""}" data-bot="${b}">${BOTS[b].label}</button>`).join("")}
            <button type="button" class="hb-chip ${prefs.mode === "friend" ? "is-on" : ""}" data-bot="friend">VS FRIEND</button>
          </div>
          <p class="hb-note">Career vs bots: ${record.wins} W • ${record.losses} L • ${record.headshots} headshots</p>
        </section>
      </div>
      <p class="hb-label">ARENA</p>
      <div class="hb-arenas">${arenaCards}</div>
      <p class="hb-label">DRIVE AHEAD CLASSICS <small>(${classics.length} maps)</small></p>
      <div class="hb-arenas">${classicCards}</div>
    </div>`;
  const p1 = overlay.querySelector("#hb-prev-p1");
  p1.getContext("2d").drawImage(art.carPreview(car, 360, 200), 0, 0);
  const p2 = overlay.querySelector("#hb-prev-p2");
  const g2 = p2.getContext("2d");
  if (foe) {
    g2.translate(360, 0);
    g2.scale(-1, 1);
    g2.drawImage(art.carPreview({ ...foe }, 360, 200), 0, 0);
  } else {
    g2.fillStyle = "#ff3b5c";
    g2.font = "bold 90px monospace";
    g2.textAlign = "center";
    g2.fillText("?", 180, 135);
  }
  overlay.querySelector("[data-act=start]")?.focus();
  fillThumbs();
}

overlay.addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  sfx.click();
  if (b.dataset.car) {
    const i = CAR_KEYS.indexOf(prefs.car);
    prefs.car = CAR_KEYS[(i + Number(b.dataset.car) + CAR_KEYS.length) % CAR_KEYS.length];
  } else if (b.dataset.foe) {
    const list = ["random", ...CAR_KEYS];
    const i = list.indexOf(prefs.foeCar);
    prefs.foeCar = list[(i + Number(b.dataset.foe) + list.length) % list.length];
  } else if (b.dataset.bot) {
    if (b.dataset.bot === "friend") prefs.mode = "friend";
    else {
      prefs.mode = "bot";
      prefs.bot = b.dataset.bot;
    }
  } else if (b.dataset.arena) {
    prefs.arena = b.dataset.arena;
  } else if (b.dataset.act) {
    const act = b.dataset.act;
    if (act === "start") return startMatch();
    if (act === "resume") return togglePause();
    if (act === "rematch") return startMatch();
    if (act === "garage") return renderGarage();
    return;
  }
  savePrefs();
  const scroll = overlay.querySelector(".hb-panel")?.scrollTop || 0;
  renderGarage();
  const panel = overlay.querySelector(".hb-panel");
  if (panel) panel.scrollTop = scroll;
});

// ─────────────────────────── update ───────────────────────────
let acc = 0;
let last = performance.now();
function update(dtReal) {
  if (game.screen === "countdown") {
    const before = Math.ceil(game.countdown);
    game.countdown -= dtReal;
    if (Math.ceil(game.countdown) !== before && game.countdown > 0) playTone(520, 0.08, "square", 0.06);
    if (game.countdown <= 0) {
      game.screen = "play";
      playTone(880, 0.2, "square", 0.08);
    }
  }
  const live = game.screen === "countdown" || game.screen === "play" || game.screen === "ko";
  if (!live) return;

  // Slow motion during the knockout
  let scale = 1;
  if (game.screen === "ko") {
    game.koClock += dtReal;
    scale = game.koClock < 1.3 ? 0.22 : 1;
    if (game.koClock > 2.6) {
      endKo();
      return;
    }
  }
  if (game.screen === "play") {
    game.timer -= dtReal;
    if (game.timer <= 0 && !game.overtime) {
      game.overtime = true;
      sfx.warn();
      startOvertime();
    }
    // Inputs
    for (const car of game.cars) {
      if (car.ai) {
        botThink(car, game.cars[1 - car.idx], dtReal);
        car.input = { throttle: car.ai.throttle, boost: car.ai.boost };
      } else car.input = humanInput(car.idx);
    }
  } else {
    for (const car of game.cars) car.input = { throttle: 0, boost: false };
  }

  acc += dtReal * 1000 * scale;
  let steps = 0;
  while (acc >= STEP_MS && steps < 8) {
    game.frame++;
    for (const car of game.cars) driveCar(car, STEP_MS / 1000);
    if (game.overtime) advanceOvertime(STEP_MS / 1000);
    stepFeatures(STEP_MS / 1000);
    Engine.update(game.engine, STEP_MS);
    settleMeteors();
    acc -= STEP_MS;
    steps++;
    if (game.screen === "play") {
      // Falling off the map counts as a knockout
      for (const car of game.cars) {
        if (car.body.position.y > (ARENAS[game.cfg.arena].fallY || 900)) game.knockouts.push({ loser: car.idx, by: "fall", x: car.body.position.x, y: H });
        // Helmet under the surface: drowned (or dissolved in acid)
        if (game.liquid && car.head.position.y > game.liquid.y + 4) game.knockouts.push({ loser: car.idx, by: game.liquid.kind === "acid" ? "acid" : "drown", x: car.head.position.x, y: game.liquid.y });
      }
      if (game.knockouts.length) {
        const res = resolveRound(game.knockouts);
        if (res) knockout(res, game.knockouts);
        game.knockouts = [];
      }
    } else game.knockouts = [];
  }
  if (steps >= 8) acc = 0;

  // Exhaust and boost flames
  for (const car of game.cars) {
    const b = car.body;
    const back = { x: b.position.x - Math.cos(b.angle) * car.facing * 60, y: b.position.y - Math.sin(b.angle) * car.facing * 60 + 8 };
    if (Math.abs(car.input.throttle) > 0 && Math.random() < 0.4) fx.spawn({ x: back.x, y: back.y, vx: -car.facing * 30, vy: -20, life: 0.5, size: 4, grow: 10, color: "#b9bcc4", kind: "smoke", alpha: 0.35 });
    if (car.boostFx > 0) for (let k = 0; k < 3; k++) fx.spawn({ x: back.x, y: back.y, vx: -Math.cos(b.angle) * car.facing * 260, vy: -Math.sin(b.angle) * car.facing * 260, life: 0.3, size: 6, grow: 8, color: "#ffd23f", color2: "#ff3b1f", kind: "smoke", alpha: 0.9 });
  }
  fx.update(dtReal * scale);
  game.shake = Math.max(0, game.shake - dtReal * 30);
  game.excite = Math.max(0, game.excite - dtReal * 0.4);

  // Engine note follows the player's throttle
  const p = game.cars[0];
  setEngineHum(game.screen === "play", { throttle: Math.abs(p.input.throttle) * 0.7 + Math.min(1, Math.hypot(p.body.velocity.x, p.body.velocity.y) / 12) * 0.5, baseFreq: 48 });
}

function startOvertime() {
  const arena = ARENAS[game.cfg.arena];
  if (arena.overtime === "lava" && game.lavaRise) return;
  if ((arena.overtime === "flood" || arena.overtime === "acid") && game.liquid) {
    game.rising = true;
    return;
  }
  if (arena.overtime === "saws") {
    for (const x of [320, 640, 960]) {
      const b = Bodies.circle(x, -70, 54, { isStatic: true, label: "saw" });
      b.sawR = 54;
      b.spin = 10;
      b.dropping = true;
      b.baseX = x;
      b.phase = x * 0.01;
      game.saws.push(b);
      Composite.add(game.engine.world, b);
    }
    return;
  }
  const crusher = Bodies.rectangle(W / 2, -60, W + 200, 120, { isStatic: true, label: "hazard" });
  Composite.add(game.engine.world, crusher);
  game.crusher = crusher;
}
function advanceOvertime(dt) {
  if (game.rising && game.liquid) game.liquid.y = Math.max(250, game.liquid.y - (game.liquid.kind === "acid" ? 11 : 13) * dt);
  // Sudden-death saws sink all the way to the floor, swaying so there's nowhere to hide
  for (const s of game.saws) {
    if (!s.dropping) continue;
    const y = Math.min(720, s.position.y + 48 * dt);
    const x = s.baseX + Math.sin(game.simT * 0.9 + s.phase) * 115;
    Body.setPosition(s, { x, y });
  }
  if (game.crusher && game.crusher.position.y < 330) Body.setPosition(game.crusher, { x: W / 2, y: game.crusher.position.y + 26 * dt });
  if (game.lavaRise && ARENAS[game.cfg.arena].overtime === "lava" && game.lavaRise.position.y > 470) {
    Body.setPosition(game.lavaRise, { x: game.lavaRise.position.x, y: game.lavaRise.position.y - 14 * dt });
    // The pool also spreads across the whole floor once it tops the banks
    if (game.lavaRise.position.y < 600 && !game.lavaRise.widened) {
      game.lavaRise.widened = true;
      const wide = Bodies.rectangle(W / 2, game.lavaRise.position.y, W + 200, 120, { isStatic: true, isSensor: true, label: "hazard" });
      wide.kind = "lava";
      wide.rect = [W / 2, 0, W + 200, 120];
      Composite.remove(game.engine.world, game.lavaRise);
      Composite.add(game.engine.world, wide);
      game.hazards = game.hazards.filter((h) => h !== game.lavaRise).concat(wide);
      game.lavaRise = wide;
    }
  }
}

// ─────────────────────────── render ───────────────────────────
function carTransform(car) {
  const b = car.body;
  ctx.translate(b.position.x, b.position.y);
  ctx.rotate(b.angle);
  ctx.translate(car.origin.x, car.origin.y);
}

function drawCar(car, t) {
  const b = car.body;
  // Ground shadow
  ctx.fillStyle = "rgba(0,0,0,0.28)";
  ctx.beginPath();
  ctx.ellipse(b.position.x, Math.min(H - 60, b.position.y + 60), 70, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  carTransform(car);
  if (car.facing === -1) ctx.scale(-1, 1);
  art.drawCarBody(ctx, car.base, t, { mirrored: car.facing === -1 });
  if (!car.headless) {
    const hd = car.base.head;
    art.drawHelmet(ctx, hd.x, hd.y, hd.r, car.color, t, { target: true });
  }
  ctx.restore();
  for (const w of car.wheels) art.drawWheel(ctx, w.position.x, w.position.y, w.circleRadius, w.angle, car.base.accent);
}

function render(now) {
  const t = now / 1000;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (!game.arenaArt) game.arenaArt = art.buildArenaArt(previewArena(), ARENAS[previewArena()]);
  const aa = game.arenaArt;
  // Camera: gentle zoom toward the knockout
  const cam = game.cam;
  const wantZ = game.screen === "ko" && game.koClock < 1.6 ? 1.45 : 1;
  const wantX = game.screen === "ko" && game.koClock < 1.6 ? game.focus.x : W / 2;
  const wantY = game.screen === "ko" && game.koClock < 1.6 ? game.focus.y : H / 2;
  cam.z += (wantZ - cam.z) * 0.08;
  cam.x += (wantX - cam.x) * 0.08;
  cam.y += (wantY - cam.y) * 0.08;
  const sx = (Math.random() - 0.5) * game.shake;
  const sy = (Math.random() - 0.5) * game.shake;
  const cx = Math.max(W / 2 / cam.z, Math.min(W - W / 2 / cam.z, cam.x));
  const cy = Math.max(H / 2 / cam.z, Math.min(H - H / 2 / cam.z, cam.y));
  ctx.setTransform(cam.z, 0, 0, cam.z, W / 2 - cx * cam.z + sx, H / 2 - cy * cam.z + sy);

  ctx.drawImage(aa.img, 0, 0);
  art.drawLights(ctx, aa.lights, t);
  art.drawCrowd(ctx, aa.crowd, t, game.excite);
  if (game.cfg || game.screen !== "garage") {
    if (game.engine) {
      const theme = ARENAS[game.cfg.arena].theme;
      drawFeaturesBack(t, theme);
      for (const s of game.statics) {
        if (s.shape.deco === "hidden") continue;
        if (theme === "void") {
          // The Invisible Map: only a faint shimmer gives the ground away
          ctx.save();
          ctx.globalAlpha = 0.05 + Math.max(0, Math.sin(t * 1.3 + s.position.x * 0.01)) * 0.05;
          art.drawSolid(ctx, "sand", s.shape, s.vertices.map((v) => [v.x, v.y]));
          ctx.restore();
          continue;
        }
        art.drawSolid(ctx, theme, s.shape, s.vertices.map((v) => [v.x, v.y]));
      }
      if (game.seesaw) {
        const p = game.seesaw.plank;
        art.drawSolid(ctx, theme, { deco: "plank" }, p.vertices.map((v) => [v.x, v.y]));
      }
      for (const h of game.hazards) {
        const bb = h.bounds;
        if (h.kind === "lava") art.drawLava(ctx, bb.min.x, bb.min.y, bb.max.x - bb.min.x, bb.max.y - bb.min.y + 200, t);
        else art.drawSpikes(ctx, bb.min.x, bb.min.y, bb.max.x - bb.min.x, bb.max.y - bb.min.y);
      }
      for (const car of game.cars) drawCar(car, t);
      drawFeaturesFront(t);
      if (game.helmet) {
        const hb = game.helmet.body;
        ctx.save();
        ctx.translate(hb.position.x, hb.position.y);
        ctx.rotate(hb.angle);
        art.drawHelmet(ctx, 0, 0, game.helmet.r, game.helmet.color, t, { noBody: true });
        ctx.restore();
      }
      if (game.crusher) {
        const cb = game.crusher.bounds;
        ctx.fillStyle = "#1c1d24";
        ctx.fillRect(cb.min.x, cb.min.y, cb.max.x - cb.min.x, cb.max.y - cb.min.y);
        ctx.fillStyle = "#ffd23f";
        for (let x = cb.min.x; x < cb.max.x; x += 60) {
          ctx.beginPath();
          ctx.moveTo(x, cb.max.y - 26);
          ctx.lineTo(x + 30, cb.max.y - 26);
          ctx.lineTo(x + 18, cb.max.y - 14);
          ctx.lineTo(x - 12, cb.max.y - 14);
          ctx.fill();
        }
        art.drawSpikes(ctx, cb.min.x, cb.max.y, cb.max.x - cb.min.x, 22, true);
      }
    }
  }
  fx.draw(ctx);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  vignette(ctx, W, H, 0.35);
  if (game.engine && game.screen !== "garage") drawHud(t);
}

const verts = (b) => b.vertices.map((v) => [v.x, v.y]);
function drawFeaturesBack(t, theme) {
  const pd = ARENAS[game.cfg.arena].pendulum;
  if (pd) {
    const s = game.kin.find((k) => k.body.label === "saw" && k.body.pivot)?.body;
    if (s) {
      ctx.strokeStyle = "#8a93a3";
      ctx.lineWidth = 6;
      ctx.setLineDash([10, 6]);
      ctx.beginPath();
      ctx.moveTo(pd.x, pd.y);
      ctx.lineTo(s.position.x, s.position.y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "#1c1d24";
      ctx.beginPath();
      ctx.arc(pd.x, pd.y, 14, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  for (const k of game.kin) {
    const b = k.body;
    if (b.isDome) for (const part of b.parts.slice(1)) art.drawSolid(ctx, "dome", { deco: "cage" }, verts(part));
    else if (b.deco === "rotor") {
      art.drawSolid(ctx, theme, { deco: "rotor" }, verts(b));
      ctx.fillStyle = "#ffd23f";
      ctx.beginPath();
      ctx.arc(b.position.x, b.position.y, 9, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  for (const b of game.props) art.drawSolid(ctx, theme, b.shape, verts(b));
  for (const f of game.floaters) {
    const parts = f.parts.length > 1 ? f.parts.slice(1) : [f];
    for (const part of parts) art.drawSolid(ctx, theme, { deco: part.deco || f.deco }, verts(part));
  }
  for (const s of game.saws) art.drawSaw(ctx, s.position.x, s.position.y, s.sawR, t * (s.spin || 9));
  for (const k of game.kin) if (k.body.label === "saw") art.drawSaw(ctx, k.body.position.x, k.body.position.y, k.body.sawR, k.body.angle);
}
function drawFeaturesFront(t) {
  for (const m of game.meteors) art.drawMeteor(ctx, m.position.x, m.position.y, m.mr, m.angle, m.velocity.x, m.velocity.y, t, m.cow);
  if (game.liquid) art.drawLiquid(ctx, game.liquid.y, game.liquid.kind, t);
}

function pips(x, y, n, color, alignRight) {
  for (let k = 0; k < WINS_NEEDED; k++) {
    const px = alignRight ? x - k * 26 : x + k * 26;
    ctx.beginPath();
    ctx.arc(px, y, 9, 0, Math.PI * 2);
    ctx.fillStyle = k < n ? color : "rgba(255,255,255,0.08)";
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = k < n ? "#ffffff" : "rgba(255,255,255,0.25)";
    ctx.stroke();
  }
}

function drawHud(t) {
  const DISP = "'Press Start 2P', monospace";
  const p0 = game.cars[0];
  const p1 = game.cars[1];
  // Score cards
  const card = (x, align, car, name, score) => {
    ctx.fillStyle = "rgba(8,6,14,0.78)";
    ctx.fillRect(x, 14, 330, 70);
    ctx.fillStyle = car.color;
    ctx.fillRect(align === "right" ? x + 324 : x, 14, 6, 70);
    ctx.font = `12px ${DISP}`;
    ctx.textAlign = align;
    ctx.fillStyle = car.color;
    ctx.fillText(name, align === "right" ? x + 312 : x + 18, 38);
    pips(align === "right" ? x + 300 : x + 30, 62, score, car.color, align === "right");
    // Boost meter
    const k = 1 - car.boostCd / BOOST_COOLDOWN;
    ctx.fillStyle = "rgba(255,255,255,0.1)";
    ctx.fillRect(align === "right" ? x + 18 : x + 170, 55, 140, 8);
    ctx.fillStyle = k >= 1 ? "#ffd23f" : "#7a6a2a";
    const bw = 140 * Math.min(1, k);
    ctx.fillRect(align === "right" ? x + 158 - bw : x + 170, 55, bw, 8);
    ctx.font = `7px ${DISP}`;
    ctx.fillStyle = k >= 1 ? "#ffd23f" : "#8a8a9a";
    ctx.fillText("BOOST", align === "right" ? x + 88 : x + 240, 50);
  };
  const foeName = game.cfg.mode === "friend" ? "PLAYER 2" : `${BOTS[game.cfg.bot].label} BOT`;
  card(14, "left", p0, game.cfg.mode === "friend" ? "PLAYER 1" : "YOU", game.scores[0]);
  card(W - 344, "right", p1, foeName, game.scores[1]);
  // Timer
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(8,6,14,0.78)";
  ctx.fillRect(W / 2 - 90, 14, 180, 70);
  ctx.font = `28px ${DISP}`;
  ctx.fillStyle = game.overtime ? (Math.sin(t * 10) > 0 ? "#ff3b3b" : "#ffd23f") : "#ffffff";
  ctx.fillText(game.overtime ? "SD" : String(Math.max(0, Math.ceil(game.timer))), W / 2, 58);
  ctx.font = `8px ${DISP}`;
  ctx.fillStyle = "#9a90b8";
  ctx.fillText(`ROUND ${game.round}`, W / 2, 76);

  if (game.overtime && game.screen === "play") {
    ctx.font = `18px ${DISP}`;
    ctx.fillStyle = Math.sin(t * 8) > 0 ? "#ff3b3b" : "#ffd23f";
    const ot = ARENAS[game.cfg.arena].overtime;
    const sdText = { lava: "THE LAVA RISES", flood: "THE WATER RISES", acid: "THE ACID RISES", saws: "SAWBLADES DESCENDING", crusher: "CRUSHER" }[ot] || "CRUSHER";
    ctx.fillText(`SUDDEN DEATH — ${sdText}`, W / 2, 118);
  }
  if (game.screen === "countdown") {
    const n = Math.ceil(game.countdown);
    const f = game.countdown - Math.floor(game.countdown);
    ctx.font = `${80 + f * 40}px ${DISP}`;
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "#0b0a10";
    ctx.lineWidth = 8;
    const txt = n > 3 ? `ROUND ${game.round}` : String(n);
    if (n > 3) ctx.font = `44px ${DISP}`;
    ctx.strokeText(txt, W / 2, H / 2);
    ctx.fillText(txt, W / 2, H / 2);
    ctx.font = `10px ${DISP}`;
    ctx.fillStyle = "#c9c0e6";
    ctx.fillText("HIT THEIR HELMET • PROTECT YOURS", W / 2, H / 2 + 60);
  }
  if (game.screen === "play" && game.timer > ROUND_SECONDS - 0.8) {
    ctx.font = `64px ${DISP}`;
    ctx.fillStyle = "#ffd23f";
    ctx.strokeStyle = "#0b0a10";
    ctx.lineWidth = 8;
    ctx.strokeText("GO!", W / 2, H / 2);
    ctx.fillText("GO!", W / 2, H / 2);
  }
  if (game.screen === "ko" && game.result) {
    const r = game.result;
    const pop = Math.min(1, game.koClock * 3);
    ctx.save();
    ctx.translate(W / 2, H / 2 - 40);
    ctx.scale(0.6 + pop * 0.4, 0.6 + pop * 0.4);
    ctx.rotate(-0.06);
    ctx.font = `64px ${DISP}`;
    ctx.lineWidth = 10;
    ctx.strokeStyle = "#0b0a10";
    const cause = game.knockoutsBy;
    const hazardKind = game.crusher ? "CRUSHED!" : ARENAS[game.cfg.arena].theme === "volcano" ? "BURNED!" : "SPIKED!";
    const causes = { fall: "OVERBOARD!", hazard: hazardKind, drown: "DROWNED!", acid: "DISSOLVED!", saw: "SLICED!", meteor: game.lastCow ? "MOOOO!" : "METEOR!" };
    const label = r.draw ? "DOUBLE K.O." : causes[cause] || "HEADSHOT!";
    ctx.strokeText(label, 0, 0);
    ctx.fillStyle = r.draw ? "#ffffff" : game.cars[r.winner].color;
    ctx.fillText(label, 0, 0);
    ctx.font = `14px ${DISP}`;
    ctx.fillStyle = "#ffffff";
    const who = r.draw ? "NO POINT" : game.cfg.mode === "friend" ? `PLAYER ${r.winner + 1} SCORES` : r.winner === 0 ? "YOU SCORE" : "BOT SCORES";
    ctx.fillText(who, 0, 44);
    ctx.restore();
  }
}

// ─────────────────────────── loop ───────────────────────────
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (game.screen !== "paused" && game.screen !== "matchEnd" && game.screen !== "garage") update(dt);
  else fx.update(dt);
  render(now);
  requestAnimationFrame(frame);
}

document.addEventListener("visibilitychange", () => {
  if (document.hidden && ["countdown", "play", "ko"].includes(game.screen)) togglePause();
});

game.arenaArt = art.buildArenaArt(previewArena(), ARENAS[previewArena()]);
renderGarage();
requestAnimationFrame(frame);

// Debug/test hook (used by automated verification scripts).
window.__headbutt = {
  get game() {
    return game;
  },
  prefs,
  startMatch,
  renderGarage,
  keys
};
