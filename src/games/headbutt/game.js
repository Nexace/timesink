/* ================================================================
 *  HEADBUTT — Physics Car Battler
 *  SYS://TIMESINK.NET  |  Accent: violet
 *  Land a hit on the opponent's exposed driver head to win.
 *  12 vehicles · 12 arenas · Player vs Bot AI · Best-of-9 matches
 * ================================================================ */

import { initShell, toast } from "/shared/shell.js";
import { createGameLoop, createInputManager, clamp, lerp, dist } from "/src/core/engine.js";
import { playExplosion, playHit, playTone, sfx, setEngineHum } from "/src/core/audio.js";
import { saveGameScore, saveSlot, loadSlot } from "/src/core/save.js";

initShell({ crumb: "Headbutt" });

/* ── Matter.js aliases ─────────────────────────────────────────── */
const { Engine, World, Bodies, Body, Composite, Constraint, Events, Vector, Query } = Matter;

/* ── Canvas ────────────────────────────────────────────────────── */
const canvas = document.getElementById("hb-canvas");
const ctx = canvas.getContext("2d");
const W = 1280, H = 720;
canvas.width = W; canvas.height = H;
ctx.imageSmoothingEnabled = false;

/* ── Input ─────────────────────────────────────────────────────── */
const input = createInputManager({ canvas });

/* ── Constants ─────────────────────────────────────────────────── */
const ROUND_TIME       = 60;
const WINS_NEEDED      = 5;
const COUNTDOWN_SECS   = 3;
const PHYSICS_DT       = 1000 / 60;
const HEAD_RADIUS      = 8;
const ARENA_FLOOR_Y    = H - 65;

/* ── Game states (Direct Garage, Player vs Bot) ─────────────────── */
const S = { GARAGE: 0, COUNTDOWN: 1, PLAYING: 2, ROUND_END: 3, MATCH_END: 4 };

/* ═══════════════════════════════════════════════════════════════
 *  SECTION 2: 12 VEHICLE DEFINITIONS (All Unlocked)
 * ═══════════════════════════════════════════════════════════════ */
const VEHICLES = {
  goKart: {
    name: "Go-Kart", mass: 1.2, wheelFriction: 0.8, restitution: 0.25,
    chassisW: 55, chassisH: 16, wheelRadius: 10, wheelBase: 40,
    headX: 8, headY: -18, driveForce: 0.0034, maxSpeed: 9.2, color: "#ff4444", color2: "#cc2222",
  },
  bmx: {
    name: "BMX Bike", mass: 0.8, wheelFriction: 0.85, restitution: 0.2,
    chassisW: 40, chassisH: 10, wheelRadius: 12, wheelBase: 30,
    headX: 2, headY: -24, driveForce: 0.0026, maxSpeed: 8.8, color: "#ffaa00", color2: "#cc8800",
  },
  muscleCar: {
    name: "Muscle Car", mass: 3.0, wheelFriction: 0.9, restitution: 0.2,
    chassisW: 80, chassisH: 22, wheelRadius: 14, wheelBase: 56,
    headX: 10, headY: -20, driveForce: 0.0068, maxSpeed: 10.2, color: "#3366ff", color2: "#2244cc",
  },
  ambulance: {
    name: "Ambulance", mass: 4.0, wheelFriction: 0.85, restitution: 0.15,
    chassisW: 85, chassisH: 32, wheelRadius: 13, wheelBase: 58,
    headX: -12, headY: -24, driveForce: 0.0082, maxSpeed: 8.2, color: "#ffffff", color2: "#dd3333",
  },
  offRoader: {
    name: "Off-Roader", mass: 3.5, wheelFriction: 1.2, restitution: 0.2,
    chassisW: 75, chassisH: 24, wheelRadius: 16, wheelBase: 52,
    headX: 6, headY: -22, driveForce: 0.0090, maxSpeed: 9.5, color: "#44aa44", color2: "#226622",
  },
  rallyCar: {
    name: "Rally Car", mass: 2.8, wheelFriction: 0.75, restitution: 0.25,
    chassisW: 72, chassisH: 18, wheelRadius: 12, wheelBase: 50,
    headX: 8, headY: -19, driveForce: 0.0065, maxSpeed: 10.8, color: "#ff6600", color2: "#cc4400",
  },
  formulaCar: {
    name: "Formula Car", mass: 1.8, wheelFriction: 0.95, restitution: 0.1,
    chassisW: 90, chassisH: 14, wheelRadius: 11, wheelBase: 64,
    headX: -8, headY: -18, driveForce: 0.0062, maxSpeed: 12.0, color: "#cc00cc", color2: "#990099",
  },
  monsterTruck: {
    name: "Monster Truck", mass: 6.0, wheelFriction: 1.0, restitution: 0.3,
    chassisW: 70, chassisH: 26, wheelRadius: 24, wheelBase: 48,
    headX: 4, headY: -26, driveForce: 0.0135, maxSpeed: 8.8, color: "#ffcc00", color2: "#aa8800",
  },
  garbageTruck: {
    name: "Garbage Truck", mass: 7.0, wheelFriction: 0.85, restitution: 0.1,
    chassisW: 95, chassisH: 34, wheelRadius: 14, wheelBase: 66,
    headX: -20, headY: -26, driveForce: 0.0145, maxSpeed: 7.2, color: "#669933", color2: "#446622",
  },
  tank: {
    name: "Tank", mass: 10.0, wheelFriction: 1.1, restitution: 0.05,
    chassisW: 88, chassisH: 24, wheelRadius: 14, wheelBase: 62,
    headX: 0, headY: -26, driveForce: 0.0200, maxSpeed: 6.8, color: "#556b2f", color2: "#3b4a1f",
  },
  eggMobile: {
    name: "Egg Mobile", mass: 1.5, wheelFriction: 0.7, restitution: 0.85,
    chassisW: 44, chassisH: 30, wheelRadius: 10, wheelBase: 32,
    headX: 0, headY: -26, driveForce: 0.0038, maxSpeed: 9.0, color: "#ffeedd", color2: "#ddccaa",
  },
  sawbot: {
    name: "Sawbot", mass: 3.0, wheelFriction: 0.85, restitution: 0.2,
    chassisW: 60, chassisH: 20, wheelRadius: 12, wheelBase: 42,
    headX: -6, headY: -20, driveForce: 0.0068, maxSpeed: 9.2, color: "#888888", color2: "#555555",
    hasBlades: true,
  },
};
const VEHICLE_KEYS = Object.keys(VEHICLES);

/* ═══════════════════════════════════════════════════════════════
 *  SECTION 3: 8 ENHANCED ARENAS
 * ═══════════════════════════════════════════════════════════════ */
const ARENAS = {
  theBump: {
    name: "Cyber Stadium", bg: "#130826", accent: "#9933ff",
    desc: "Curved quarter-pipe walls, launch ramps & elevated cyber girder",
    create(w) {
      const b = [];
      /* main floor across full width */
      b.push(Bodies.rectangle(W / 2, ARENA_FLOOR_Y + 20, W + 40, 40, { isStatic: true, label: "terrain", friction: 0.85 }));
      /* left corner solid fill & banked curve — NO GAPS BEHIND */
      b.push(Bodies.rectangle(25, ARENA_FLOOR_Y - 95, 52, 90, { isStatic: true, label: "terrain", friction: 0.8 }));
      b.push(Bodies.rectangle(65, ARENA_FLOOR_Y - 65, 130, 18, { isStatic: true, label: "terrain", friction: 0.75, angle: -0.55 }));
      b.push(Bodies.rectangle(150, ARENA_FLOOR_Y - 22, 100, 16, { isStatic: true, label: "terrain", friction: 0.75, angle: -0.22 }));
      /* right corner solid fill & banked curve */
      b.push(Bodies.rectangle(W - 25, ARENA_FLOOR_Y - 95, 52, 90, { isStatic: true, label: "terrain", friction: 0.8 }));
      b.push(Bodies.rectangle(W - 65, ARENA_FLOOR_Y - 65, 130, 18, { isStatic: true, label: "terrain", friction: 0.75, angle: 0.55 }));
      b.push(Bodies.rectangle(W - 150, ARENA_FLOOR_Y - 22, 100, 16, { isStatic: true, label: "terrain", friction: 0.75, angle: 0.22 }));
      /* center combat launch pyramid — driveable from BOTH sides */
      b.push(Bodies.rectangle(W / 2 - 85, ARENA_FLOOR_Y - 24, 150, 18, { isStatic: true, label: "terrain", friction: 0.75, angle: -0.26 }));
      b.push(Bodies.rectangle(W / 2 + 85, ARENA_FLOOR_Y - 24, 150, 18, { isStatic: true, label: "terrain", friction: 0.75, angle: 0.26 }));
      b.push(Bodies.rectangle(W / 2, ARENA_FLOOR_Y - 42, 60, 18, { isStatic: true, label: "terrain", friction: 0.75 }));
      /* elevated cyber girder crest */
      b.push(Bodies.rectangle(W / 2, ARENA_FLOOR_Y - 155, 280, 16, { isStatic: true, label: "terrain", friction: 0.8 }));
      /* walls & ceiling */
      b.push(Bodies.rectangle(-10, H / 2, 20, H + 100, { isStatic: true, label: "wall" }));
      b.push(Bodies.rectangle(W + 10, H / 2, 20, H + 100, { isStatic: true, label: "wall" }));
      b.push(Bodies.rectangle(W / 2, -10, W + 40, 20, { isStatic: true, label: "wall" }));
      b.forEach(bd => World.add(w, bd));
      return { bodies: b, spawns: [{ x: 240, y: ARENA_FLOOR_Y - 60 }, { x: W - 240, y: ARENA_FLOOR_Y - 60 }], hazards: [], bumpers: [] };
    }
  },
  sawmill: {
    name: "Hazard Foundry", bg: "#1a0f08", accent: "#ff6600",
    desc: "Industrial gantries, pneumatic steam vent & moving buzzsaws",
    create(w) {
      const b = [];
      b.push(Bodies.rectangle(W / 2, ARENA_FLOOR_Y + 20, W + 40, 40, { isStatic: true, label: "terrain", friction: 0.9 }));
      /* left gantry: flush outer ramp, platform, AND INNER DRIVE RAMP */
      b.push(Bodies.rectangle(20, ARENA_FLOOR_Y - 80, 45, 90, { isStatic: true, label: "terrain", friction: 0.85 }));
      b.push(Bodies.rectangle(85, ARENA_FLOOR_Y - 45, 140, 16, { isStatic: true, label: "terrain", friction: 0.85, angle: -0.45 }));
      b.push(Bodies.rectangle(210, ARENA_FLOOR_Y - 80, 160, 16, { isStatic: true, label: "terrain", friction: 0.85 }));
      b.push(Bodies.rectangle(330, ARENA_FLOOR_Y - 42, 110, 16, { isStatic: true, label: "terrain", friction: 0.85, angle: 0.52 }));
      /* right gantry: flush outer ramp, platform, AND INNER DRIVE RAMP */
      b.push(Bodies.rectangle(W - 20, ARENA_FLOOR_Y - 80, 45, 90, { isStatic: true, label: "terrain", friction: 0.85 }));
      b.push(Bodies.rectangle(W - 85, ARENA_FLOOR_Y - 45, 140, 16, { isStatic: true, label: "terrain", friction: 0.85, angle: 0.45 }));
      b.push(Bodies.rectangle(W - 210, ARENA_FLOOR_Y - 80, 160, 16, { isStatic: true, label: "terrain", friction: 0.85 }));
      b.push(Bodies.rectangle(W - 330, ARENA_FLOOR_Y - 42, 110, 16, { isStatic: true, label: "terrain", friction: 0.85, angle: -0.52 }));
      /* central upper crane catwalk */
      b.push(Bodies.rectangle(W / 2, ARENA_FLOOR_Y - 165, 260, 16, { isStatic: true, label: "terrain", friction: 0.85 }));
      /* walls & ceiling */
      b.push(Bodies.rectangle(-10, H / 2, 20, H + 100, { isStatic: true, label: "wall" }));
      b.push(Bodies.rectangle(W + 10, H / 2, 20, H + 100, { isStatic: true, label: "wall" }));
      b.push(Bodies.rectangle(W / 2, -10, W + 40, 20, { isStatic: true, label: "wall" }));
      /* 2 moving saw blades */
      const saw1 = Bodies.circle(280, ARENA_FLOOR_Y - 12, 18, { isStatic: true, label: "hazard_saw" });
      const saw2 = Bodies.circle(W - 280, ARENA_FLOOR_Y - 12, 18, { isStatic: true, label: "hazard_saw" });
      b.push(saw1, saw2);
      b.forEach(bd => World.add(w, bd));
      const hazards = [
        { type: "saw", body: saw1, baseX: 280, range: 160, speed: 2.0, t: 0 },
        { type: "saw", body: saw2, baseX: W - 280, range: 160, speed: 2.4, t: Math.PI },
        { type: "steam", x: W / 2, y: ARENA_FLOOR_Y, timer: 0, active: false }
      ];
      return { bodies: b, spawns: [{ x: 210, y: ARENA_FLOOR_Y - 110 }, { x: W - 210, y: ARENA_FLOOR_Y - 110 }], hazards };
    }
  },
  volcano: {
    name: "Magma Caverns", bg: "#240602", accent: "#ff3300",
    desc: "Basalt ledges, moving magma lift & floating stones over boiling lava",
    create(w) {
      const b = [];
      /* left basalt plateau with beveled transition ramp to high ledge */
      b.push(Bodies.rectangle(170, ARENA_FLOOR_Y - 14, 320, 36, { isStatic: true, label: "terrain", friction: 0.85 }));
      b.push(Bodies.rectangle(105, ARENA_FLOOR_Y - 48, 110, 18, { isStatic: true, label: "terrain", friction: 0.85, angle: -0.42 }));
      b.push(Bodies.rectangle(55, ARENA_FLOOR_Y - 75, 110, 20, { isStatic: true, label: "terrain", friction: 0.85 }));
      /* right basalt plateau with beveled transition ramp */
      b.push(Bodies.rectangle(W - 170, ARENA_FLOOR_Y - 14, 320, 36, { isStatic: true, label: "terrain", friction: 0.85 }));
      b.push(Bodies.rectangle(W - 105, ARENA_FLOOR_Y - 48, 110, 18, { isStatic: true, label: "terrain", friction: 0.85, angle: 0.42 }));
      b.push(Bodies.rectangle(W - 55, ARENA_FLOOR_Y - 75, 110, 20, { isStatic: true, label: "terrain", friction: 0.85 }));
      /* floating stepping stone platforms over lava */
      b.push(Bodies.rectangle(W / 2 - 145, ARENA_FLOOR_Y - 35, 75, 18, { isStatic: true, label: "terrain", friction: 0.85 }));
      b.push(Bodies.rectangle(W / 2 + 145, ARENA_FLOOR_Y - 35, 75, 18, { isStatic: true, label: "terrain", friction: 0.85 }));
      /* central moving basalt lift pillar */
      const pillar = Bodies.rectangle(W / 2, ARENA_FLOOR_Y - 45, 130, 22, { isStatic: true, label: "terrain", friction: 0.9 });
      b.push(pillar);
      /* lethal bubbling magma pit below */
      const lava = Bodies.rectangle(W / 2, H + 15, W, 40, { isStatic: true, label: "hazard_lava", isSensor: true });
      b.push(lava);
      /* walls & ceiling */
      b.push(Bodies.rectangle(-10, H / 2, 20, H + 100, { isStatic: true, label: "wall" }));
      b.push(Bodies.rectangle(W + 10, H / 2, 20, H + 100, { isStatic: true, label: "wall" }));
      b.push(Bodies.rectangle(W / 2, -10, W + 40, 20, { isStatic: true, label: "wall" }));
      b.forEach(bd => World.add(w, bd));
      const hazards = [
        { type: "pillar", body: pillar, baseY: ARENA_FLOOR_Y - 45, range: 75, speed: 1.5, t: 0 },
        { type: "lava_burst", timer: 0 }
      ];
      return { bodies: b, spawns: [{ x: 190, y: ARENA_FLOOR_Y - 60 }, { x: W - 190, y: ARENA_FLOOR_Y - 60 }], hazards };
    }
  },
  ovalTrack: {
    name: "Super Speedway", bg: "#09140c", accent: "#00ff66",
    desc: "High-speed banked bowl with neon turbo boost pads & crossover speed bridge",
    create(w) {
      const b = [];
      b.push(Bodies.rectangle(W / 2, ARENA_FLOOR_Y + 20, W + 40, 40, { isStatic: true, label: "terrain", friction: 0.9 }));
      /* multi-banked curves on left corner */
      b.push(Bodies.rectangle(55, ARENA_FLOOR_Y - 75, 130, 20, { isStatic: true, label: "terrain", friction: 0.8, angle: -0.62 }));
      b.push(Bodies.rectangle(140, ARENA_FLOOR_Y - 28, 90, 18, { isStatic: true, label: "terrain", friction: 0.8, angle: -0.28 }));
      /* multi-banked curves on right corner */
      b.push(Bodies.rectangle(W - 55, ARENA_FLOOR_Y - 75, 130, 20, { isStatic: true, label: "terrain", friction: 0.8, angle: 0.62 }));
      b.push(Bodies.rectangle(W - 140, ARENA_FLOOR_Y - 28, 90, 18, { isStatic: true, label: "terrain", friction: 0.8, angle: 0.28 }));
      /* center crossover speed bridge with double-sided approach ramps */
      b.push(Bodies.rectangle(W / 2, ARENA_FLOOR_Y - 105, 240, 16, { isStatic: true, label: "terrain", friction: 0.9 }));
      b.push(Bodies.rectangle(W / 2 - 165, ARENA_FLOOR_Y - 55, 120, 16, { isStatic: true, label: "terrain", friction: 0.85, angle: -0.42 }));
      b.push(Bodies.rectangle(W / 2 + 165, ARENA_FLOOR_Y - 55, 120, 16, { isStatic: true, label: "terrain", friction: 0.85, angle: 0.42 }));
      /* walls & ceiling */
      b.push(Bodies.rectangle(-10, H / 2, 20, H + 100, { isStatic: true, label: "wall" }));
      b.push(Bodies.rectangle(W + 10, H / 2, 20, H + 100, { isStatic: true, label: "wall" }));
      b.push(Bodies.rectangle(W / 2, -10, W + 40, 20, { isStatic: true, label: "wall" }));
      b.forEach(bd => World.add(w, bd));
      const boostPads = [
        { x: 280, y: ARENA_FLOOR_Y, w: 75, dir: 1 },
        { x: W - 280, y: ARENA_FLOOR_Y, w: 75, dir: -1 },
      ];
      return { bodies: b, spawns: [{ x: 250, y: ARENA_FLOOR_Y - 50 }, { x: W - 250, y: ARENA_FLOOR_Y - 50 }], hazards: [], boostPads, bumpers: [] };
    }
  },
  scaffolding: {
    name: "Skyline High-Rise", bg: "#0d0f1c", accent: "#ffbb00",
    desc: "Multi-tier steel girders, ground access ramps & swinging wrecking ball",
    create(w) {
      const b = [];
      b.push(Bodies.rectangle(W / 2, ARENA_FLOOR_Y + 20, W + 40, 40, { isStatic: true, label: "terrain", friction: 0.85 }));
      /* diagonal access ramps connecting ground to 1st tier girders */
      b.push(Bodies.rectangle(85, ARENA_FLOOR_Y - 45, 140, 16, { isStatic: true, label: "terrain", friction: 0.85, angle: -0.48 }));
      b.push(Bodies.rectangle(230, ARENA_FLOOR_Y - 88, 200, 16, { isStatic: true, label: "terrain", friction: 0.85 }));
      b.push(Bodies.rectangle(W - 85, ARENA_FLOOR_Y - 45, 140, 16, { isStatic: true, label: "terrain", friction: 0.85, angle: 0.48 }));
      b.push(Bodies.rectangle(W - 230, ARENA_FLOOR_Y - 88, 200, 16, { isStatic: true, label: "terrain", friction: 0.85 }));
      /* center top girder */
      b.push(Bodies.rectangle(W / 2, ARENA_FLOOR_Y - 175, 300, 16, { isStatic: true, label: "terrain", friction: 0.85 }));
      /* swinging wrecking ball pendulum */
      const anchor = Bodies.circle(W / 2, 40, 12, { isStatic: true, label: "terrain" });
      const ball = Bodies.circle(W / 2 + 120, 195, 26, { label: "wrecking_ball", density: 0.025, friction: 0.5, restitution: 0.45 });
      const cable = Constraint.create({ bodyA: anchor, bodyB: ball, length: 170, stiffness: 0.95 });
      b.push(anchor, ball);
      World.add(w, [anchor, ball, cable]);
      /* walls & ceiling */
      b.push(Bodies.rectangle(-10, H / 2, 20, H + 100, { isStatic: true, label: "wall" }));
      b.push(Bodies.rectangle(W + 10, H / 2, 20, H + 100, { isStatic: true, label: "wall" }));
      b.push(Bodies.rectangle(W / 2, -10, W + 40, 20, { isStatic: true, label: "wall" }));
      b.slice(3).forEach(bd => World.add(w, bd));
      return { bodies: b, spawns: [{ x: 230, y: ARENA_FLOOR_Y - 120 }, { x: W - 230, y: ARENA_FLOOR_Y - 120 }], hazards: [], wreckingBall: ball, anchor };
    }
  },
  pirateShip: {
    name: "Seasaw Galleon", bg: "#090d22", accent: "#00bfa5",
    desc: "Continuous wooden gun deck with tilting seesaw & companionway ramps",
    create(w) {
      const b = [];
      /* continuous lower wooden hull floor */
      b.push(Bodies.rectangle(W / 2, ARENA_FLOOR_Y + 12, W - 80, 24, { isStatic: true, label: "terrain", friction: 0.9 }));
      /* dynamic seesaw deck */
      const plank = Bodies.rectangle(W / 2, ARENA_FLOOR_Y - 28, 540, 20, { label: "terrain", friction: 0.95, density: 0.004 });
      const pivot = Bodies.circle(W / 2, ARENA_FLOOR_Y - 8, 12, { isStatic: true, label: "terrain" });
      const joint = Constraint.create({ bodyA: pivot, bodyB: plank, pointA: { x: 0, y: 0 }, pointB: { x: 0, y: 8 }, length: 0, stiffness: 0.85 });
      b.push(plank, pivot);
      World.add(w, [plank, pivot, joint]);
      /* stopper blocks */
      const stopL = Bodies.rectangle(W / 2 - 230, ARENA_FLOOR_Y + 6, 50, 22, { isStatic: true, label: "terrain", friction: 0.9 });
      const stopR = Bodies.rectangle(W / 2 + 230, ARENA_FLOOR_Y + 6, 50, 22, { isStatic: true, label: "terrain", friction: 0.9 });
      b.push(stopL, stopR);
      World.add(w, [stopL, stopR]);
      /* outer bow and stern decks with companionway ramps down to lower deck */
      b.push(Bodies.rectangle(80, ARENA_FLOOR_Y - 70, 140, 18, { isStatic: true, label: "terrain", friction: 0.9 }));
      b.push(Bodies.rectangle(170, ARENA_FLOOR_Y - 34, 75, 16, { isStatic: true, label: "terrain", friction: 0.85, angle: 0.48 }));
      b.push(Bodies.rectangle(W - 80, ARENA_FLOOR_Y - 70, 140, 18, { isStatic: true, label: "terrain", friction: 0.9 }));
      b.push(Bodies.rectangle(W - 170, ARENA_FLOOR_Y - 34, 75, 16, { isStatic: true, label: "terrain", friction: 0.85, angle: -0.48 }));
      /* ocean hazard pit below hull */
      const ocean = Bodies.rectangle(W / 2, H + 25, W, 30, { isStatic: true, label: "hazard_pit", isSensor: true });
      b.push(ocean);
      /* walls & ceiling */
      b.push(Bodies.rectangle(-10, H / 2, 20, H + 100, { isStatic: true, label: "wall" }));
      b.push(Bodies.rectangle(W + 10, H / 2, 20, H + 100, { isStatic: true, label: "wall" }));
      b.push(Bodies.rectangle(W / 2, -10, W + 40, 20, { isStatic: true, label: "wall" }));
      b.slice(4).forEach(bd => World.add(w, bd));
      return { bodies: b, spawns: [{ x: W / 2 - 160, y: ARENA_FLOOR_Y - 70 }, { x: W / 2 + 160, y: ARENA_FLOOR_Y - 70 }], hazards: [], seesaw: plank };
    }
  },
  winterCliff: {
    name: "Aurora Glaciers", bg: "#081528", accent: "#00f0ff",
    desc: "Frosted glacier with Aurora Borealis, high-grip snow banks & smooth ice ramps",
    create(w) {
      const b = [];
      /* ice floor with moderate drift friction */
      b.push(Bodies.rectangle(W / 2, ARENA_FLOOR_Y + 20, W + 40, 40, { isStatic: true, label: "terrain", friction: 0.08 }));
      /* left corner solid snow bank & smooth curved ice ramp */
      b.push(Bodies.rectangle(25, ARENA_FLOOR_Y - 95, 52, 90, { isStatic: true, label: "terrain", friction: 0.85 }));
      b.push(Bodies.rectangle(70, ARENA_FLOOR_Y - 58, 130, 18, { isStatic: true, label: "terrain", friction: 0.15, angle: -0.48 }));
      b.push(Bodies.rectangle(150, ARENA_FLOOR_Y - 20, 100, 16, { isStatic: true, label: "terrain", friction: 0.18, angle: -0.2 }));
      /* right corner solid snow bank & smooth curved ice ramp */
      b.push(Bodies.rectangle(W - 25, ARENA_FLOOR_Y - 95, 52, 90, { isStatic: true, label: "terrain", friction: 0.85 }));
      b.push(Bodies.rectangle(W - 70, ARENA_FLOOR_Y - 58, 130, 18, { isStatic: true, label: "terrain", friction: 0.15, angle: 0.48 }));
      b.push(Bodies.rectangle(W - 150, ARENA_FLOOR_Y - 20, 100, 16, { isStatic: true, label: "terrain", friction: 0.18, angle: 0.2 }));
      /* center double-sided ice jump hill */
      b.push(Bodies.rectangle(W / 2 - 80, ARENA_FLOOR_Y - 26, 140, 16, { isStatic: true, label: "terrain", friction: 0.12, angle: -0.26 }));
      b.push(Bodies.rectangle(W / 2 + 80, ARENA_FLOOR_Y - 26, 140, 16, { isStatic: true, label: "terrain", friction: 0.12, angle: 0.26 }));
      b.push(Bodies.rectangle(W / 2, ARENA_FLOOR_Y - 42, 60, 16, { isStatic: true, label: "terrain", friction: 0.2 }));
      /* overhead frozen arch */
      b.push(Bodies.rectangle(W / 2, ARENA_FLOOR_Y - 150, 240, 16, { isStatic: true, label: "terrain", friction: 0.1 }));
      /* walls & ceiling */
      b.push(Bodies.rectangle(-10, H / 2, 20, H + 100, { isStatic: true, label: "wall" }));
      b.push(Bodies.rectangle(W + 10, H / 2, 20, H + 100, { isStatic: true, label: "wall" }));
      b.push(Bodies.rectangle(W / 2, -10, W + 40, 20, { isStatic: true, label: "wall" }));
      b.forEach(bd => World.add(w, bd));
      return { bodies: b, spawns: [{ x: 230, y: ARENA_FLOOR_Y - 60 }, { x: W - 230, y: ARENA_FLOOR_Y - 60 }], hazards: [] };
    }
  },
  chaosBarn: {
    name: "Demolition Derby", bg: "#1a1107", accent: "#ffaa00",
    desc: "Double-sided hay jump pyramids, high-impulse TNT barrels & hay loft platform",
    create(w) {
      const b = [];
      b.push(Bodies.rectangle(W / 2, ARENA_FLOOR_Y + 20, W + 40, 40, { isStatic: true, label: "terrain", friction: 0.9 }));
      /* corner hay bales filling walls so cars never get wedged */
      b.push(Bodies.rectangle(30, ARENA_FLOOR_Y - 35, 60, 70, { isStatic: true, label: "terrain", friction: 0.9 }));
      b.push(Bodies.rectangle(W - 30, ARENA_FLOOR_Y - 35, 60, 70, { isStatic: true, label: "terrain", friction: 0.9 }));
      /* LEFT DOUBLE-SIDED HAY PYRAMID RAMP (Driveable both ways!) */
      b.push(Bodies.rectangle(115, ARENA_FLOOR_Y - 24, 110, 18, { isStatic: true, label: "terrain", friction: 0.85, angle: -0.32 }));
      b.push(Bodies.rectangle(170, ARENA_FLOOR_Y - 40, 40, 18, { isStatic: true, label: "terrain", friction: 0.85 }));
      b.push(Bodies.rectangle(225, ARENA_FLOOR_Y - 24, 110, 18, { isStatic: true, label: "terrain", friction: 0.85, angle: 0.32 }));
      /* RIGHT DOUBLE-SIDED HAY PYRAMID RAMP (Driveable both ways!) */
      b.push(Bodies.rectangle(W - 225, ARENA_FLOOR_Y - 24, 110, 18, { isStatic: true, label: "terrain", friction: 0.85, angle: -0.32 }));
      b.push(Bodies.rectangle(W - 170, ARENA_FLOOR_Y - 40, 40, 18, { isStatic: true, label: "terrain", friction: 0.85 }));
      b.push(Bodies.rectangle(W - 115, ARENA_FLOOR_Y - 24, 110, 18, { isStatic: true, label: "terrain", friction: 0.85, angle: 0.32 }));
      /* overhead hay loft platform */
      b.push(Bodies.rectangle(W / 2, ARENA_FLOOR_Y - 110, 240, 18, { isStatic: true, label: "terrain", friction: 0.85 }));
      /* walls & ceiling */
      b.push(Bodies.rectangle(-10, H / 2, 20, H + 100, { isStatic: true, label: "wall" }));
      b.push(Bodies.rectangle(W + 10, H / 2, 20, H + 100, { isStatic: true, label: "wall" }));
      b.push(Bodies.rectangle(W / 2, -10, W + 40, 20, { isStatic: true, label: "wall" }));
      /* 3 explosive TNT barrels */
      const barrels = [];
      const bXs = [W / 2 - 130, W / 2, W / 2 + 130];
      for (const bx of bXs) {
        const barrel = Bodies.rectangle(bx, ARENA_FLOOR_Y - 16, 24, 32, { isStatic: true, label: "barrel", friction: 0.9 });
        b.push(barrel);
        barrels.push({ body: barrel, alive: true, x: bx });
      }
      b.forEach(bd => World.add(w, bd));
      return { bodies: b, spawns: [{ x: 200, y: ARENA_FLOOR_Y - 70 }, { x: W - 200, y: ARENA_FLOOR_Y - 70 }], hazards: [{ type: "barrels", barrels }], bumpers: [] };
    }
  },
  duneSaws: {
    name: "Dune Saws", bg: "#181106", accent: "#e0b040",
    desc: "Undulating double camel-hump sand dunes, lower steel trusses & dual wall buzzsaws",
    create(w) {
      const b = [];
      /* main sub-floor underneath dunes */
      b.push(Bodies.rectangle(W / 2, ARENA_FLOOR_Y + 20, W + 40, 40, { isStatic: true, label: "terrain", friction: 0.9 }));
      /* corner fill blocks flush with walls so cars never get wedged */
      b.push(Bodies.rectangle(25, ARENA_FLOOR_Y - 80, 52, 120, { isStatic: true, label: "terrain", friction: 0.85 }));
      b.push(Bodies.rectangle(W - 25, ARENA_FLOOR_Y - 80, 52, 120, { isStatic: true, label: "terrain", friction: 0.85 }));
      /* LEFT CAMEL DUNE: climb ramp, crest, and descent to center */
      b.push(Bodies.rectangle(120, ARENA_FLOOR_Y - 44, 150, 24, { isStatic: true, label: "terrain", friction: 0.85, angle: -0.42 }));
      b.push(Bodies.rectangle(230, ARENA_FLOOR_Y - 76, 110, 24, { isStatic: true, label: "terrain", friction: 0.85 }));
      b.push(Bodies.rectangle(340, ARENA_FLOOR_Y - 44, 140, 24, { isStatic: true, label: "terrain", friction: 0.85, angle: 0.40 }));
      /* CENTRAL VALLEY TROUGH */
      b.push(Bodies.rectangle(W / 2, ARENA_FLOOR_Y - 14, 90, 22, { isStatic: true, label: "terrain", friction: 0.85 }));
      /* RIGHT CAMEL DUNE: ascent from center, crest, and descent to right wall */
      b.push(Bodies.rectangle(W - 340, ARENA_FLOOR_Y - 44, 140, 24, { isStatic: true, label: "terrain", friction: 0.85, angle: -0.40 }));
      b.push(Bodies.rectangle(W - 230, ARENA_FLOOR_Y - 76, 110, 24, { isStatic: true, label: "terrain", friction: 0.85 }));
      b.push(Bodies.rectangle(W - 120, ARENA_FLOOR_Y - 44, 150, 24, { isStatic: true, label: "terrain", friction: 0.85, angle: 0.42 }));
      /* walls & ceiling */
      b.push(Bodies.rectangle(-10, H / 2, 20, H + 100, { isStatic: true, label: "wall" }));
      b.push(Bodies.rectangle(W + 10, H / 2, 20, H + 100, { isStatic: true, label: "wall" }));
      b.push(Bodies.rectangle(W / 2, -10, W + 40, 20, { isStatic: true, label: "wall" }));
      /* dual giant wall-mounted rotating buzzsaws */
      const sawL = Bodies.circle(65, ARENA_FLOOR_Y - 135, 34, { isStatic: true, label: "hazard_saw" });
      const sawR = Bodies.circle(W - 65, ARENA_FLOOR_Y - 135, 34, { isStatic: true, label: "hazard_saw" });
      b.push(sawL, sawR);
      b.forEach(bd => World.add(w, bd));
      const hazards = [
        { type: "wall_saw", body: sawL, x: 65, y: ARENA_FLOOR_Y - 135, radius: 34, dir: 1 },
        { type: "wall_saw", body: sawR, x: W - 65, y: ARENA_FLOOR_Y - 135, radius: 34, dir: -1 },
      ];
      return { bodies: b, spawns: [{ x: 230, y: ARENA_FLOOR_Y - 110 }, { x: W - 230, y: ARENA_FLOOR_Y - 110 }], hazards, bumpers: [] };
    }
  },
  hydroDeck: {
    name: "Hydro Facility", bg: "#06121a", accent: "#00e5ff",
    desc: "Arched steel overpass catwalk, suspended pylon bridge & cyan water hazard pool",
    create(w) {
      const b = [];
      /* lethal water pool across the bottom chasm */
      const water = Bodies.rectangle(W / 2, H + 18, W + 40, 36, { isStatic: true, label: "hazard_water", isSensor: true });
      b.push(water);
      /* outer landing docks with beveled safety edges */
      b.push(Bodies.rectangle(75, ARENA_FLOOR_Y - 60, 150, 20, { isStatic: true, label: "terrain", friction: 0.85 }));
      b.push(Bodies.rectangle(W - 75, ARENA_FLOOR_Y - 60, 150, 20, { isStatic: true, label: "terrain", friction: 0.85 }));
      /* lower suspended steel bridge deck spanning above water */
      b.push(Bodies.rectangle(W / 2, ARENA_FLOOR_Y - 25, 460, 20, { isStatic: true, label: "terrain", friction: 0.85 }));
      /* diagonal pylon support struts connecting docks to lower deck */
      b.push(Bodies.rectangle(195, ARENA_FLOOR_Y + 5, 140, 18, { isStatic: true, label: "terrain", friction: 0.85, angle: -0.32 }));
      b.push(Bodies.rectangle(W - 195, ARENA_FLOOR_Y + 5, 140, 18, { isStatic: true, label: "terrain", friction: 0.85, angle: 0.32 }));
      /* upper arched catwalk overpass spanning upper center */
      b.push(Bodies.rectangle(W / 2 - 170, ARENA_FLOOR_Y - 115, 130, 16, { isStatic: true, label: "terrain", friction: 0.85, angle: -0.35 }));
      b.push(Bodies.rectangle(W / 2, ARENA_FLOOR_Y - 145, 230, 16, { isStatic: true, label: "terrain", friction: 0.85 }));
      b.push(Bodies.rectangle(W / 2 + 170, ARENA_FLOOR_Y - 115, 130, 16, { isStatic: true, label: "terrain", friction: 0.85, angle: 0.35 }));
      /* walls & ceiling */
      b.push(Bodies.rectangle(-10, H / 2, 20, H + 100, { isStatic: true, label: "wall" }));
      b.push(Bodies.rectangle(W + 10, H / 2, 20, H + 100, { isStatic: true, label: "wall" }));
      b.push(Bodies.rectangle(W / 2, -10, W + 40, 20, { isStatic: true, label: "wall" }));
      b.forEach(bd => World.add(w, bd));
      return { bodies: b, spawns: [{ x: 90, y: ARENA_FLOOR_Y - 95 }, { x: W - 90, y: ARENA_FLOOR_Y - 95 }], hazards: [{ type: "water_pool" }], bumpers: [] };
    }
  },
  colosseum: {
    name: "The Thunderdome", bg: "#16131c", accent: "#ffd700",
    desc: "Enclosed cobblestone oval bowl with 360° centrifugal wall-riding physics",
    create(w) {
      const b = [];
      /* main bottom stone floor */
      b.push(Bodies.rectangle(W / 2, ARENA_FLOOR_Y + 20, 520, 40, { isStatic: true, label: "terrain", friction: 0.95 }));
      /* left curved banking sectors into vertical wall */
      b.push(Bodies.rectangle(200, ARENA_FLOOR_Y - 20, 130, 24, { isStatic: true, label: "terrain", friction: 0.95, angle: -0.35 }));
      b.push(Bodies.rectangle(120, ARENA_FLOOR_Y - 68, 120, 24, { isStatic: true, label: "terrain", friction: 0.95, angle: -0.75 }));
      b.push(Bodies.rectangle(65, ARENA_FLOOR_Y - 145, 24, 120, { isStatic: true, label: "terrain", friction: 0.95 }));
      b.push(Bodies.rectangle(110, ARENA_FLOOR_Y - 220, 110, 24, { isStatic: true, label: "terrain", friction: 0.95, angle: 0.65 }));
      /* right curved banking sectors into vertical wall */
      b.push(Bodies.rectangle(W - 200, ARENA_FLOOR_Y - 20, 130, 24, { isStatic: true, label: "terrain", friction: 0.95, angle: 0.35 }));
      b.push(Bodies.rectangle(W - 120, ARENA_FLOOR_Y - 68, 120, 24, { isStatic: true, label: "terrain", friction: 0.95, angle: 0.75 }));
      b.push(Bodies.rectangle(W - 65, ARENA_FLOOR_Y - 145, 24, 120, { isStatic: true, label: "terrain", friction: 0.95 }));
      b.push(Bodies.rectangle(W - 110, ARENA_FLOOR_Y - 220, 110, 24, { isStatic: true, label: "terrain", friction: 0.95, angle: -0.65 }));
      /* arched stone ceiling */
      b.push(Bodies.rectangle(W / 2, 70, 680, 26, { isStatic: true, label: "terrain", friction: 0.9 }));
      /* walls */
      b.push(Bodies.rectangle(-10, H / 2, 20, H + 100, { isStatic: true, label: "wall" }));
      b.push(Bodies.rectangle(W + 10, H / 2, 20, H + 100, { isStatic: true, label: "wall" }));
      b.push(Bodies.rectangle(W / 2, -10, W + 40, 20, { isStatic: true, label: "wall" }));
      b.forEach(bd => World.add(w, bd));
      return { bodies: b, spawns: [{ x: 270, y: ARENA_FLOOR_Y - 50 }, { x: W - 270, y: ARENA_FLOOR_Y - 50 }], hazards: [], bumpers: [] };
    }
  },
  catacombs: {
    name: "Bone Catacombs", bg: "#0a140d", accent: "#55bb55",
    desc: "Mossy stone fortress, central bone bridge over boiling lava & swinging skeleton pendulum",
    create(w) {
      const b = [];
      /* left cliff fortress with bowl depression */
      b.push(Bodies.rectangle(80, ARENA_FLOOR_Y - 70, 150, 30, { isStatic: true, label: "terrain", friction: 0.9 }));
      b.push(Bodies.rectangle(175, ARENA_FLOOR_Y - 45, 110, 22, { isStatic: true, label: "terrain", friction: 0.9, angle: 0.36 }));
      b.push(Bodies.rectangle(260, ARENA_FLOOR_Y - 20, 80, 26, { isStatic: true, label: "terrain", friction: 0.9 }));
      /* right cliff fortress with bowl depression */
      b.push(Bodies.rectangle(W - 80, ARENA_FLOOR_Y - 70, 150, 30, { isStatic: true, label: "terrain", friction: 0.9 }));
      b.push(Bodies.rectangle(W - 175, ARENA_FLOOR_Y - 45, 110, 22, { isStatic: true, label: "terrain", friction: 0.9, angle: -0.36 }));
      b.push(Bodies.rectangle(W - 260, ARENA_FLOOR_Y - 20, 80, 26, { isStatic: true, label: "terrain", friction: 0.9 }));
      /* deep boiling lava chasm below */
      const lava = Bodies.rectangle(W / 2, H + 18, 480, 36, { isStatic: true, label: "hazard_lava", isSensor: true });
      b.push(lava);
      /* central ivory bone suspension bridge across the chasm */
      const bone1 = Bodies.rectangle(W / 2 - 100, ARENA_FLOOR_Y - 16, 110, 14, { isStatic: true, label: "bone_bridge", friction: 0.85, angle: 0.10 });
      const bone2 = Bodies.rectangle(W / 2, ARENA_FLOOR_Y - 10, 100, 14, { isStatic: true, label: "bone_bridge", friction: 0.85 });
      const bone3 = Bodies.rectangle(W / 2 + 100, ARENA_FLOOR_Y - 16, 110, 14, { isStatic: true, label: "bone_bridge", friction: 0.85, angle: -0.10 });
      b.push(bone1, bone2, bone3);
      /* swinging skeleton pendulum from ceiling */
      const anchor = Bodies.circle(W / 2, 40, 10, { isStatic: true, label: "terrain" });
      const skull = Bodies.circle(W / 2 + 80, 185, 20, { label: "skeleton_bob", density: 0.02, friction: 0.5, restitution: 0.4 });
      const chain = Constraint.create({ bodyA: anchor, bodyB: skull, length: 155, stiffness: 0.95 });
      b.push(anchor, skull);
      World.add(w, [anchor, skull, chain]);
      /* walls & ceiling */
      b.push(Bodies.rectangle(-10, H / 2, 20, H + 100, { isStatic: true, label: "wall" }));
      b.push(Bodies.rectangle(W + 10, H / 2, 20, H + 100, { isStatic: true, label: "wall" }));
      b.push(Bodies.rectangle(W / 2, -10, W + 40, 20, { isStatic: true, label: "wall" }));
      b.slice(8).forEach(bd => World.add(w, bd));
      const hazards = [
        { type: "skeleton", anchor, bob: skull }
      ];
      return { bodies: b, spawns: [{ x: 120, y: ARENA_FLOOR_Y - 105 }, { x: W - 120, y: ARENA_FLOOR_Y - 105 }], hazards, skeletonBob: skull, anchor, bumpers: [] };
    }
  },
};
const ARENA_KEYS = Object.keys(ARENAS);

/* ═══════════════════════════════════════════════════════════════
 *  SECTION 4: SAVE & STATS
 * ═══════════════════════════════════════════════════════════════ */
function getProgress() {
  return loadSlot("headbutt-progress") || { wins: 0, bestStreak: 0 };
}
function setProgress(p) { saveSlot("headbutt-progress", p); }

/* ═══════════════════════════════════════════════════════════════
 *  SECTION 5: GAME STATE
 * ═══════════════════════════════════════════════════════════════ */
let mEngine, mWorld;
let state = {
  screen: S.GARAGE,           /* starts directly in garage */
  aiDifficulty: 1,            /* 0=rookie, 1=veteran, 2=champion */
  /* selections */
  selP1: 0, selP2: 2, selArena: 0,
  /* match stats */
  scores: [0, 0],
  round: 0,
  streak: 0,
  /* vehicles & arena */
  vehicles: [null, null],
  arena: null,
  roundTimer: ROUND_TIME,
  suddenDeath: false,
  countdownTimer: 0,
  roundEndTimer: 0,
  matchEndTimer: 0,
  roundWinner: -1,
  matchWinner: -1,
  /* physics accumulator */
  physicsAccum: 0,
  /* visual effects */
  particles: [],
  weatherParticles: [],
  screenShake: { x: 0, y: 0, intensity: 0 },
};

/* ═══════════════════════════════════════════════════════════════
 *  SECTION 6: VEHICLE PHYSICS ASSEMBLY
 * ═══════════════════════════════════════════════════════════════ */
function initPhysics() {
  mEngine = Engine.create({
    gravity: { x: 0, y: 1.15 },
    positionIterations: 8,
    velocityIterations: 8,
  });
  mWorld = mEngine.world;
  Events.on(mEngine, "collisionStart", onCollision);
}

function clearPhysics() {
  if (mEngine) {
    Events.off(mEngine, "collisionStart", onCollision);
    World.clear(mWorld, false);
    Engine.clear(mEngine);
  }
  mEngine = null;
  mWorld = null;
}

function createVehicle(typeKey, spawnX, spawnY, playerIdx) {
  const def = VEHICLES[typeKey];
  const group = Body.nextGroup(true);
  const cFilter = { group };

  const density = def.mass / (def.chassisW * def.chassisH * 1.5);

  const chassis = Bodies.rectangle(spawnX, spawnY, def.chassisW, def.chassisH, {
    label: `p${playerIdx + 1}_chassis`,
    collisionFilter: cFilter,
    friction: 0.6,
    frictionAir: 0.012,
    restitution: def.restitution,
    density,
  });

  const rearWheel = Bodies.circle(
    spawnX - def.wheelBase / 2, spawnY + def.chassisH / 2 + def.wheelRadius * 0.15,
    def.wheelRadius, {
      label: `p${playerIdx + 1}_rwheel`,
      collisionFilter: cFilter,
      friction: def.wheelFriction,
      frictionAir: 0.01,
      restitution: 0.15,
      density: 0.003,
    }
  );

  const frontWheel = Bodies.circle(
    spawnX + def.wheelBase / 2, spawnY + def.chassisH / 2 + def.wheelRadius * 0.15,
    def.wheelRadius, {
      label: `p${playerIdx + 1}_fwheel`,
      collisionFilter: cFilter,
      friction: def.wheelFriction,
      frictionAir: 0.01,
      restitution: 0.15,
      density: 0.003,
    }
  );

  const headBody = Bodies.circle(
    spawnX + def.headX, spawnY + def.headY,
    HEAD_RADIUS, {
      label: `p${playerIdx + 1}_head`,
      collisionFilter: cFilter,
      density: 0.0004,
      restitution: 0.1,
      friction: 0.3,
    }
  );

  /* Axle suspension springs with damping */
  const rearAxle = Constraint.create({
    bodyA: chassis, bodyB: rearWheel,
    pointA: { x: -def.wheelBase / 2, y: def.chassisH / 2 },
    length: def.wheelRadius * 0.2, stiffness: 0.82, damping: 0.14,
  });
  const frontAxle = Constraint.create({
    bodyA: chassis, bodyB: frontWheel,
    pointA: { x: def.wheelBase / 2, y: def.chassisH / 2 },
    length: def.wheelRadius * 0.2, stiffness: 0.82, damping: 0.14,
  });

  /* Head rigid pin */
  const headPin = Constraint.create({
    bodyA: chassis, bodyB: headBody,
    pointA: { x: def.headX, y: def.headY },
    length: 0, stiffness: 1, damping: 0,
  });

  const comp = Composite.create();
  Composite.add(comp, [chassis, rearWheel, frontWheel, headBody, rearAxle, frontAxle, headPin]);

  /* Sawbot special blade */
  let bladeBody = null;
  if (def.hasBlades) {
    bladeBody = Bodies.circle(spawnX, spawnY + def.headY + 4, 14, {
      label: `p${playerIdx + 1}_blade`,
      collisionFilter: cFilter,
      density: 0.0003, restitution: 0.1,
    });
    const bladePin = Constraint.create({
      bodyA: chassis, bodyB: bladeBody,
      pointA: { x: 0, y: -def.chassisH / 2 - 8 },
      length: 0, stiffness: 1, damping: 0,
    });
    Composite.add(comp, [bladeBody, bladePin]);
  }

  World.add(mWorld, comp);

  return {
    composite: comp, chassis, rearWheel, frontWheel, headBody, bladeBody,
    typeKey, playerIdx, facing: playerIdx === 0 ? 1 : -1,
    throttle: 0, targetThrottle: 0,
    grounded: true,
    jumpCooldown: 0, airTime: 0, stuckTimer: 0,
  };
}

/* ═══════════════════════════════════════════════════════════════
 *  SECTION 7: COLLISION & COMBAT
 * ═══════════════════════════════════════════════════════════════ */
function isUpsideDown(angle) {
  const norm = ((angle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  return norm > Math.PI / 2 && norm < 3 * Math.PI / 2;
}

function onCollision(event) {
  if (state.screen !== S.PLAYING) return;
  for (const pair of event.pairs) {
    const a = pair.bodyA.label, b = pair.bodyB.label;
    /* Head-hit check */
    const hit = checkHeadHit(a, b);
    if (hit) { endRound(hit.winner); return; }
    /* Blade check */
    const blade = checkBladeHit(a, b);
    if (blade) { endRound(blade.winner); return; }
    /* Hazard check */
    const haz = checkHazardHit(a, b);
    if (haz) { endRound(1 - haz.loser); return; }
    /* Barrel impact */
    checkBarrelHit(pair);
    /* Bumper kinetic deflection */
    checkBumperHit(pair);
  }
}

function checkHeadHit(a, b) {
  if (a === "p1_head" && b.startsWith("p2_") && b !== "p2_head") return { loser: 0, winner: 1 };
  if (a === "p2_head" && b.startsWith("p1_") && b !== "p1_head") return { loser: 1, winner: 0 };
  if (b === "p1_head" && a.startsWith("p2_") && a !== "p2_head") return { loser: 0, winner: 1 };
  if (b === "p2_head" && a.startsWith("p1_") && a !== "p1_head") return { loser: 1, winner: 0 };
  return null;
}

function checkBladeHit(a, b) {
  if (a.endsWith("_blade") && b.startsWith("p") && !b.endsWith("_blade")) {
    const pWinner = parseInt(a[1]) - 1;
    const pHit = parseInt(b[1]) - 1;
    if (pWinner !== pHit) return { winner: pWinner };
  }
  if (b.endsWith("_blade") && a.startsWith("p") && !a.endsWith("_blade")) {
    const pWinner = parseInt(b[1]) - 1;
    const pHit = parseInt(a[1]) - 1;
    if (pWinner !== pHit) return { winner: pWinner };
  }
  return null;
}

function checkHazardHit(a, b) {
  const hazards = ["hazard_saw", "hazard_lava", "hazard_pit", "hazard_water"];
  if (hazards.includes(a) && (b.startsWith("p1_") || b.startsWith("p2_"))) {
    return { loser: b.startsWith("p1_") ? 0 : 1 };
  }
  if (hazards.includes(b) && (a.startsWith("p1_") || a.startsWith("p2_"))) {
    return { loser: a.startsWith("p1_") ? 0 : 1 };
  }
  return null;
}

function checkBarrelHit(pair) {
  const a = pair.bodyA, b = pair.bodyB;
  let barrel = null, other = null;
  if (a.label === "barrel") { barrel = a; other = b; }
  else if (b.label === "barrel") { barrel = b; other = a; }
  if (!barrel || !other.label.startsWith("p")) return;

  if (state.arena && state.arena.hazards) {
    for (const h of state.arena.hazards) {
      if (h.type === "barrels") {
        for (const br of h.barrels) {
          if (br.body === barrel && br.alive) {
            br.alive = false;
            World.remove(mWorld, barrel);
            const force = 0.06;
            const dx = other.position.x - barrel.position.x;
            const dy = other.position.y - barrel.position.y;
            const len = Math.max(1, Math.hypot(dx, dy));
            Body.applyForce(other, other.position, { x: (dx / len) * force, y: (dy / len) * force - 0.03 });
            spawnExplosion(barrel.position.x, barrel.position.y);
            shakeScreen(14);
            playExplosion();
          }
        }
      }
    }
  }
}

function checkBumperHit(pair) {
  const a = pair.bodyA, b = pair.bodyB;
  let bumper = null, other = null;
  if (a.label === "bumper") { bumper = a; other = b; }
  else if (b.label === "bumper") { bumper = b; other = a; }
  if (!bumper || !other.label.startsWith("p")) return;

  const dx = other.position.x - bumper.position.x;
  const dy = other.position.y - bumper.position.y;
  const len = Math.max(1, Math.hypot(dx, dy));
  const pushForce = 0.045;
  Body.applyForce(other, other.position, {
    x: (dx / len) * pushForce,
    y: (dy / len) * pushForce - 0.018
  });
  spawnSparks(other.position.x, other.position.y, 8, "#00f0ff");
  playTone(720, 0.09, "square");
  shakeScreen(7);
}

/* ═══════════════════════════════════════════════════════════════
 *  SECTION 8: VEHICLE JUMP & MOBILITY MECHANICS
 * ═══════════════════════════════════════════════════════════════ */
export function jumpVehicle(veh) {
  if (!veh || veh.jumpCooldown > 0) return false;
  const def = VEHICLES[veh.typeKey];
  const ch = veh.chassis;
  const rw = veh.rearWheel;
  const fw = veh.frontWheel;

  const grounded = isVehicleGrounded(veh) || (veh.airTime || 0) < 0.15; // 150ms coyote time
  const upsideDown = isUpsideDown(ch.angle);

  // Can jump if grounded, or if upside-down for recovery
  if (!grounded && !upsideDown && (veh.airTime || 0) > 0.35) {
    return false;
  }

  veh.jumpCooldown = 0.32; // 320ms cooldown

  const jumpMagnitude = -0.024 * def.mass;

  if (upsideDown) {
    /* Inverted recovery hop: upward pop + auto-righting rotational torque */
    Body.applyForce(ch, ch.position, { x: 0, y: jumpMagnitude * 0.95 });
    ch.torque += (veh.facing || 1) * 0.048 * def.mass;
  } else {
    /* Standard upward leap scaled to vehicle weight */
    const sinA = Math.sin(ch.angle);
    Body.applyForce(ch, ch.position, {
      x: sinA * 0.18 * Math.abs(jumpMagnitude),
      y: jumpMagnitude
    });
    Body.applyForce(rw, rw.position, { x: 0, y: jumpMagnitude * 0.35 });
    Body.applyForce(fw, fw.position, { x: 0, y: jumpMagnitude * 0.35 });

    /* Forward momentum leap if driving */
    if (Math.abs(veh.throttle) > 0.1) {
      const hopX = Math.sign(veh.throttle) * Math.abs(jumpMagnitude) * 0.28;
      Body.applyForce(ch, ch.position, { x: hopX, y: 0 });
    }
  }

  /* Audio and visual feedback */
  playTone(300, 0.06, "triangle");
  setTimeout(() => playTone(540, 0.08, "triangle"), 40);

  spawnSparks(rw.position.x, rw.position.y + 4, 3, "#ffaa44");
  spawnSparks(fw.position.x, fw.position.y + 4, 3, "#ffaa44");
  shakeScreen(3);
  return true;
}

/* ═══════════════════════════════════════════════════════════════
 *  SECTION 9: BOT AI (3 Tiers with Tactical Jumping)
 * ═══════════════════════════════════════════════════════════════ */
let aiTimer = 0;
let aiTargetThrottle = 0;

function updateAI(dt) {
  const difficulty = state.aiDifficulty;
  const me = state.vehicles[1];
  const opp = state.vehicles[0];
  if (!me || !opp) return;

  const meCh = me.chassis;
  const oppCh = opp.chassis;
  const dx = oppCh.position.x - meCh.position.x;
  const dy = oppCh.position.y - meCh.position.y;

  aiTimer -= dt;
  if (aiTimer <= 0) {
    if (difficulty === 0) {
      /* Rookie: steady drive toward player with casual pauses */
      aiTimer = 0.35 + Math.random() * 0.4;
      aiTargetThrottle = dx > 0 ? 0.75 : -0.75;
      if (Math.random() < 0.2) aiTargetThrottle = 0;
      if (Math.random() < 0.08) jumpVehicle(me);
    } else if (difficulty === 1) {
      /* Veteran: accelerates toward player, retreats if player is airborne dive-bombing */
      aiTimer = 0.15 + Math.random() * 0.25;
      if (dy < -40 && Math.abs(dx) < 120) {
        aiTargetThrottle = dx > 0 ? -0.85 : 0.85; /* dodge under falling player */
      } else {
        aiTargetThrottle = dx > 0 ? 0.95 : -0.95;
      }
      /* Tactical jump when opponent is above or close */
      if (Math.random() < 0.14 && (dy < -25 || Math.abs(dx) < 140)) {
        jumpVehicle(me);
      }
    } else {
      /* Champion: aims directly for exposed head, executes mid-air flips & dive-bombs */
      aiTimer = 0.08 + Math.random() * 0.15;
      const headDx = opp.headBody.position.x - meCh.position.x;
      aiTargetThrottle = headDx > 0 ? 1 : -1;

      /* Champion leap attack */
      if (opp.headBody.position.y < meCh.position.y || Math.abs(dx) < 130) {
        if (Math.random() < 0.28) jumpVehicle(me);
      }
    }
  }

  /* AI stuck escape recovery: if bot is blocked against terrain, hop out! */
  if (Math.abs(meCh.velocity.x) < 0.35 && Math.abs(aiTargetThrottle) > 0.4) {
    me.stuckTimer = (me.stuckTimer || 0) + dt;
    if (me.stuckTimer > 0.35) {
      jumpVehicle(me);
      me.stuckTimer = 0;
    }
  } else {
    me.stuckTimer = 0;
  }

  /* Smooth throttle transition for bot */
  me.throttle = lerp(me.throttle, aiTargetThrottle, dt * 5.5);
  applyVehiclePhysics(me, me.throttle);
}

/* ═══════════════════════════════════════════════════════════════
 *  SECTION 10: SMOOTH VEHICLE CONTROLS & PHYSICS
 * ═══════════════════════════════════════════════════════════════ */
function isVehicleGrounded(veh) {
  if (!state.arena || !state.arena.bodies) {
    return veh.rearWheel.position.y >= ARENA_FLOOR_Y - 20 || veh.frontWheel.position.y >= ARENA_FLOOR_Y - 20;
  }
  const terrains = state.arena.bodies.filter(b => b.label === "terrain" || b.label === "bumper" || b.label === "barrel");
  if (terrains.length === 0) return true;
  const rwHits = Query.collides(veh.rearWheel, terrains);
  if (rwHits.length > 0) return true;
  const fwHits = Query.collides(veh.frontWheel, terrains);
  if (fwHits.length > 0) return true;
  const chHits = Query.collides(veh.chassis, terrains);
  if (chHits.length > 0) return true;
  return false;
}

function applyVehiclePhysics(veh, throttleInput) {
  const def = VEHICLES[veh.typeKey];
  const ch = veh.chassis;
  const rw = veh.rearWheel;
  const fw = veh.frontWheel;

  if (veh.jumpCooldown > 0) veh.jumpCooldown -= PHYSICS_DT / 1000;

  const inverted = isUpsideDown(ch.angle);
  const effectiveThrottle = inverted ? -throttleInput : throttleInput;

  /* Progressive non-linear throttle response for organic control feel */
  const progressiveThrottle = Math.sign(effectiveThrottle) * Math.pow(Math.abs(effectiveThrottle), 1.25);

  /* Precise collision-query grounding detection & coyote time tracking */
  const grounded = isVehicleGrounded(veh);
  veh.grounded = grounded;
  if (grounded) {
    veh.airTime = 0;
  } else {
    veh.airTime = (veh.airTime || 0) + (PHYSICS_DT / 1000);
  }

  if (Math.abs(progressiveThrottle) > 0.02) {
    if (grounded) {
      /* Drive force oriented along the vehicle chassis tangent */
      const baseForce = def.driveForce * progressiveThrottle;
      const cosA = Math.cos(ch.angle);
      const sinA = Math.sin(ch.angle);
      Body.applyForce(ch, ch.position, { x: cosA * baseForce, y: sinA * baseForce });

      /* Natural physical torque applied to wheels */
      const driveTorque = progressiveThrottle * (def.mass * 0.016);
      rw.torque += driveTorque;
      fw.torque += driveTorque * 0.7;

      /* Rolling traction spin assistance */
      const targetSpin = progressiveThrottle * (def.maxSpeed * 0.022);
      Body.setAngularVelocity(rw, lerp(rw.angularVelocity, targetSpin, 0.08));
      Body.setAngularVelocity(fw, lerp(fw.angularVelocity, targetSpin, 0.08));
    } else {
      /* Mid-air attitude stabilization / intentional aerial flips */
      const airTorque = 0.0019 * progressiveThrottle * def.mass;
      ch.torque += airTorque;
    }
  } else {
    /* Natural progressive rolling resistance */
    Body.setAngularVelocity(rw, rw.angularVelocity * 0.92);
    Body.setAngularVelocity(fw, fw.angularVelocity * 0.92);
  }

  /* Chassis pitch stabilization damping so vehicles don't wobble or jitter */
  if (Math.abs(ch.angularVelocity) > 0.0005) {
    Body.setAngularVelocity(ch, ch.angularVelocity * 0.94);
  }

  /* Soft organic speed decay rather than harsh velocity snapping */
  const maxSpd = def.maxSpeed || 10;
  const speed = Math.hypot(ch.velocity.x, ch.velocity.y);
  if (speed > maxSpd) {
    const excess = speed - maxSpd;
    const damping = Math.max(0.86, 1 - excess * 0.03);
    Body.setVelocity(ch, { x: ch.velocity.x * damping, y: ch.velocity.y });
  }
}

function handlePlayerInput(dt) {
  const p1 = state.vehicles[0];
  if (!p1) return;

  /* JUMP input: W, Up Arrow, Space, or in-arena tap */
  if (input.wasPressed("KeyW") || input.wasPressed("ArrowUp") || input.wasPressed("Space")) {
    jumpVehicle(p1);
  }
  if (input.mouse.clicked && input.mouse.y > 80 && input.mouse.y < ARENA_FLOOR_Y) {
    jumpVehicle(p1);
  }

  /* Player controls: A/D or Left/Right or virtual stick */
  let target = 0;
  if (input.isDown("KeyA") || input.isDown("ArrowLeft")) target = -1;
  if (input.isDown("KeyD") || input.isDown("ArrowRight")) target = 1;
  if (input.stick.active && Math.abs(input.stick.x) > 0.25) {
    target = input.stick.x > 0 ? 1 : -1;
  }

  /* Smooth progressive throttle ramp-up and coast-down */
  if (target !== 0) {
    p1.throttle = lerp(p1.throttle, target, dt * 5.2);
  } else {
    p1.throttle = lerp(p1.throttle, 0, dt * 7.5);
  }

  applyVehiclePhysics(p1, p1.throttle);

  /* Speedway boost pads */
  if (state.arena && state.arena.boostPads) {
    for (const pad of state.arena.boostPads) {
      if (Math.abs(p1.chassis.position.x - pad.x) < pad.w / 2 && Math.abs(p1.chassis.position.y - pad.y) < 30) {
        Body.applyForce(p1.chassis, p1.chassis.position, { x: pad.dir * 0.016, y: -0.005 });
        spawnSparks(p1.chassis.position.x, p1.chassis.position.y + 10, 3, "#00ff66");
      }
    }
  }
}

/* ═══════════════════════════════════════════════════════════════
 *  SECTION 10: PARTICLES & SCREEN SHAKE
 * ═══════════════════════════════════════════════════════════════ */
function spawnParticle(x, y, vx, vy, color, life, size) {
  state.particles.push({ x, y, vx, vy, color, life, maxLife: life, size: size || 3 });
}

function spawnSparks(x, y, count, color) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 1.5 + Math.random() * 4;
    spawnParticle(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed - 2, color || "#ffaa00", 0.35 + Math.random() * 0.3, 2 + Math.random() * 2);
  }
}

function spawnExplosion(x, y) {
  for (let i = 0; i < 24; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 2 + Math.random() * 6;
    const color = ["#ff3300", "#ff7700", "#ffcc00", "#ffffff"][Math.floor(Math.random() * 4)];
    spawnParticle(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed - 3, color, 0.45 + Math.random() * 0.4, 3 + Math.random() * 4);
  }
}

function spawnHeadHitEffect(x, y) {
  for (let i = 0; i < 35; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 2.5 + Math.random() * 8;
    const color = ["#ff0055", "#00f0ff", "#ffffff", "#ffcc00"][Math.floor(Math.random() * 4)];
    spawnParticle(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed - 2, color, 0.5 + Math.random() * 0.5, 2 + Math.random() * 4);
  }
}

function shakeScreen(intensity) {
  state.screenShake.intensity = Math.max(state.screenShake.intensity, intensity);
}

function updateParticles(dt) {
  for (let i = state.particles.length - 1; i >= 0; i--) {
    const p = state.particles[i];
    p.life -= dt;
    if (p.life <= 0) { state.particles.splice(i, 1); continue; }
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.14; /* gravity */
  }

  if (state.screenShake.intensity > 0) {
    state.screenShake.intensity *= 0.86;
    if (state.screenShake.intensity < 0.3) state.screenShake.intensity = 0;
    state.screenShake.x = (Math.random() - 0.5) * state.screenShake.intensity * 2;
    state.screenShake.y = (Math.random() - 0.5) * state.screenShake.intensity * 2;
  }
}

function renderParticles() {
  for (const p of state.particles) {
    const alpha = Math.max(0, p.life / p.maxLife);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    ctx.restore();
  }
}

/* ═══════════════════════════════════════════════════════════════
 *  SECTION 11: MATCH & ROUND MANAGEMENT
 * ═══════════════════════════════════════════════════════════════ */
function startMatch() {
  state.scores = [0, 0];
  state.round = 0;
  state.matchWinner = -1;
  startCountdown();
}

function startCountdown() {
  clearPhysics();
  initPhysics();
  state.round++;

  const arenaKey = ARENA_KEYS[state.selArena];
  const arenaDef = ARENAS[arenaKey];
  state.arena = arenaDef.create(mWorld);
  state.arena.key = arenaKey;

  const sp = state.arena.spawns;
  const p1Key = VEHICLE_KEYS[state.selP1];
  const p2Key = VEHICLE_KEYS[state.selP2];
  state.vehicles[0] = createVehicle(p1Key, sp[0].x, sp[0].y, 0);
  state.vehicles[1] = createVehicle(p2Key, sp[1].x, sp[1].y, 1);

  state.screen = S.COUNTDOWN;
  state.countdownTimer = COUNTDOWN_SECS + 0.4;
  state.roundTimer = ROUND_TIME;
  state.suddenDeath = false;
  state.roundWinner = -1;
  state.particles = [];
  aiTimer = 0;
  aiTargetThrottle = 0;
}

function startPlaying() {
  state.screen = S.PLAYING;
}

function endRound(winner) {
  if (state.screen !== S.PLAYING) return;
  state.roundWinner = winner;
  state.scores[winner]++;
  state.screen = S.ROUND_END;
  state.roundEndTimer = 2.4;

  const loserHead = state.vehicles[1 - winner].headBody;
  spawnHeadHitEffect(loserHead.position.x, loserHead.position.y);
  shakeScreen(15);
  playExplosion({ duration: 0.28 });
  playTone(620, 0.12, "square");
  setTimeout(() => playTone(940, 0.18, "square"), 120);

  if (state.scores[winner] >= WINS_NEEDED) {
    state.matchWinner = winner;
  }
}

function finishRound() {
  if (state.matchWinner >= 0) {
    state.screen = S.MATCH_END;
    state.matchEndTimer = 4;

    const p = getProgress();
    if (state.matchWinner === 0) {
      p.wins++;
      state.streak++;
      p.bestStreak = Math.max(p.bestStreak, state.streak);
      toast({ title: "VICTORY! MATCH WON!", body: `Player defeated the Bot! Streak: ${state.streak}`, icon: "trophy" });
    } else {
      state.streak = 0;
      toast({ title: "DEFEAT! BOT WINS MATCH", body: "Practice your aerial flips and try again!", icon: "skull" });
    }
    setProgress(p);
    saveGameScore("headbutt", p.wins, `${p.wins} match wins`);
  } else {
    startCountdown();
  }
}

/* ═══════════════════════════════════════════════════════════════
 *  SECTION 12: DYNAMIC HAZARDS UPDATE
 * ═══════════════════════════════════════════════════════════════ */
function updateHazards(dt) {
  if (!state.arena || !state.arena.hazards) return;
  for (const h of state.arena.hazards) {
    if (h.type === "saw") {
      h.t += dt * h.speed * (state.suddenDeath ? 1.7 : 1);
      const nx = h.baseX + Math.sin(h.t) * h.range;
      Body.setPosition(h.body, { x: nx, y: h.body.position.y });
      Body.setAngle(h.body, h.t * 6);
      /* occasional spark from rail */
      if (Math.random() < 0.25) {
        spawnSparks(nx, h.body.position.y + 12, 1, "#ff8800");
      }
    } else if (h.type === "pillar") {
      h.t += dt * h.speed;
      const oldY = h.body.position.y;
      const ny = h.baseY + Math.sin(h.t) * h.range;
      const vy = (ny - oldY) / Math.max(0.001, dt);
      Body.setPosition(h.body, { x: h.body.position.x, y: ny });
      Body.setVelocity(h.body, { x: 0, y: vy });
    } else if (h.type === "steam") {
      h.timer = (h.timer || 0) + dt;
      if (h.timer >= 3.5) {
        h.active = true;
        /* Billow upward steam particles */
        for (let s = 0; s < 3; s++) {
          spawnParticle(h.x + (Math.random() - 0.5) * 50, h.y - 8, (Math.random() - 0.5) * 2, -6 - Math.random() * 5, "rgba(220, 240, 255, 0.75)", 0.45, 6);
        }
        /* Blast vehicles into the air */
        for (let v = 0; v < 2; v++) {
          const veh = state.vehicles[v];
          if (veh && Math.abs(veh.chassis.position.x - h.x) < 65 && veh.chassis.position.y > ARENA_FLOOR_Y - 140) {
            Body.applyForce(veh.chassis, veh.chassis.position, { x: (Math.random() - 0.5) * 0.005, y: -0.026 * VEHICLES[veh.typeKey].mass });
          }
        }
        if (h.timer >= 4.2) {
          h.timer = 0;
          h.active = false;
        }
      } else if (h.timer > 3.0) {
        /* Pre-vent hiss */
        spawnParticle(h.x + (Math.random() - 0.5) * 30, h.y - 4, (Math.random() - 0.5) * 1, -2 - Math.random() * 2, "rgba(220, 240, 255, 0.35)", 0.25, 3);
      }
    } else if (h.type === "lava_burst") {
      h.timer = (h.timer || 0) + dt;
      if (h.timer >= 2.5) {
        h.timer = 0;
        const bx = W / 2 + (Math.random() - 0.5) * 320;
        for (let p = 0; p < 5; p++) {
          spawnParticle(bx, H - 20, (Math.random() - 0.5) * 3.5, -6 - Math.random() * 6, Math.random() < 0.5 ? "#ff3300" : "#ffaa00", 0.65, 5);
        }
      }
    } else if (h.type === "wall_saw") {
      Body.setAngle(h.body, (h.body.angle || 0) + dt * 10 * h.dir);
      if (Math.random() < 0.15) {
        spawnSparks(h.x + (h.dir > 0 ? 25 : -25), h.y + (Math.random() - 0.5) * 20, 1, "#ffcc00");
      }
    } else if (h.type === "water_pool") {
      if (Math.random() < 0.25) {
        spawnParticle(Math.random() * W, ARENA_FLOOR_Y + 14, (Math.random() - 0.5) * 0.8, -1 - Math.random() * 2, "rgba(0, 240, 255, 0.6)", 0.4, 3);
      }
    }
  }
}

/* ═══════════════════════════════════════════════════════════════
 *  SECTION 13: PROCEDURAL VEHICLE RENDERING
 * ═══════════════════════════════════════════════════════════════ */
function drawWheel(x, y, angle, radius, color) {
  ctx.save();
  ctx.translate(x | 0, y | 0);
  ctx.rotate(angle);
  ctx.fillStyle = "#1e1e24";
  ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = color || "#444";
  ctx.beginPath(); ctx.arc(0, 0, radius * 0.55, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "#383842"; ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-radius + 1, 0); ctx.lineTo(radius - 1, 0);
  ctx.moveTo(0, -radius + 1); ctx.lineTo(0, radius - 1);
  ctx.stroke();
  ctx.restore();
}

function drawDriverHead(x, y, angle, playerIdx) {
  const r = HEAD_RADIUS;
  const t = performance.now() / 500;
  const glow = 2.5 + Math.sin(t) * 1.5;

  /* Helmet glow */
  ctx.fillStyle = playerIdx === 0 ? "rgba(0, 240, 255, 0.28)" : "rgba(255, 60, 60, 0.28)";
  ctx.beginPath(); ctx.arc(x | 0, y | 0, r + glow, 0, Math.PI * 2); ctx.fill();

  /* Helmet body */
  ctx.fillStyle = playerIdx === 0 ? "#00f0ff" : "#ff3355";
  ctx.beginPath(); ctx.arc(x | 0, y | 0, r, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "#000"; ctx.lineWidth = 1.5; ctx.stroke();

  /* Dark visor */
  ctx.save();
  ctx.translate(x | 0, y | 0);
  ctx.rotate(angle);
  ctx.fillStyle = "rgba(10,10,20,0.75)";
  ctx.fillRect(1, -3, 6, 5);
  ctx.restore();
}

const DRAW = {
  goKart(cx, cy, a, def) {
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(a);
    ctx.fillStyle = def.color;
    ctx.fillRect(-def.chassisW / 2, -def.chassisH / 2, def.chassisW, def.chassisH);
    ctx.fillStyle = "#222";
    ctx.fillRect(2, -def.chassisH / 2 - 6, 12, 6);
    ctx.strokeStyle = "#000"; ctx.lineWidth = 1;
    ctx.strokeRect(-def.chassisW / 2, -def.chassisH / 2, def.chassisW, def.chassisH);
    ctx.restore();
  },
  bmx(cx, cy, a, def) {
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(a);
    ctx.strokeStyle = def.color; ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-def.chassisW / 2, 0); ctx.lineTo(0, -8);
    ctx.lineTo(def.chassisW / 2, 0); ctx.lineTo(0, 4);
    ctx.closePath(); ctx.stroke();
    ctx.fillStyle = "#222"; ctx.fillRect(-4, -12, 8, 4);
    ctx.restore();
  },
  muscleCar(cx, cy, a, def) {
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(a);
    ctx.fillStyle = def.color;
    ctx.fillRect(-def.chassisW / 2, -def.chassisH / 2, def.chassisW, def.chassisH);
    ctx.fillStyle = def.color2;
    ctx.fillRect(-def.chassisW / 2, -def.chassisH / 2, def.chassisW * 0.4, def.chassisH);
    ctx.fillStyle = "#fff";
    ctx.fillRect(-def.chassisW / 2 + 4, -2, def.chassisW - 8, 3);
    ctx.strokeStyle = "#000"; ctx.lineWidth = 1;
    ctx.strokeRect(-def.chassisW / 2, -def.chassisH / 2, def.chassisW, def.chassisH);
    ctx.restore();
  },
  ambulance(cx, cy, a, def) {
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(a);
    ctx.fillStyle = def.color;
    ctx.fillRect(-def.chassisW / 2, -def.chassisH / 2, def.chassisW, def.chassisH);
    ctx.fillStyle = def.color2;
    ctx.fillRect(-def.chassisW / 2, def.chassisH / 2 - 7, def.chassisW, 7);
    ctx.fillStyle = "#dd3333";
    ctx.fillRect(10, -def.chassisH / 2 + 5, 12, 3);
    ctx.fillRect(14, -def.chassisH / 2 + 2, 4, 9);
    const flash = Math.sin(performance.now() / 180) > 0;
    ctx.fillStyle = flash ? "#ff0000" : "#880000";
    ctx.fillRect(-4, -def.chassisH / 2 - 6, 8, 5);
    ctx.strokeStyle = "#000"; ctx.lineWidth = 1;
    ctx.strokeRect(-def.chassisW / 2, -def.chassisH / 2, def.chassisW, def.chassisH);
    ctx.restore();
  },
  offRoader(cx, cy, a, def) {
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(a);
    ctx.fillStyle = def.color;
    ctx.fillRect(-def.chassisW / 2, -def.chassisH / 2, def.chassisW, def.chassisH);
    ctx.strokeStyle = "#333"; ctx.lineWidth = 2;
    ctx.strokeRect(-8, -def.chassisH / 2 - 10, 22, 10);
    ctx.strokeStyle = "#000"; ctx.lineWidth = 1;
    ctx.strokeRect(-def.chassisW / 2, -def.chassisH / 2, def.chassisW, def.chassisH);
    ctx.restore();
  },
  rallyCar(cx, cy, a, def) {
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(a);
    ctx.fillStyle = def.color;
    ctx.fillRect(-def.chassisW / 2, -def.chassisH / 2, def.chassisW, def.chassisH);
    ctx.fillStyle = def.color2;
    ctx.fillRect(def.chassisW / 2 - 12, -def.chassisH / 2 - 8, 14, 4);
    ctx.fillRect(def.chassisW / 2 - 4, -def.chassisH / 2 - 8, 3, 8);
    ctx.strokeStyle = "#000"; ctx.lineWidth = 1;
    ctx.strokeRect(-def.chassisW / 2, -def.chassisH / 2, def.chassisW, def.chassisH);
    ctx.restore();
  },
  formulaCar(cx, cy, a, def) {
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(a);
    ctx.fillStyle = def.color;
    ctx.fillRect(-def.chassisW / 2, -def.chassisH / 2, def.chassisW, def.chassisH);
    ctx.fillStyle = def.color2;
    ctx.fillRect(-def.chassisW / 2 - 10, -def.chassisH / 2 - 2, 16, 3);
    ctx.fillRect(def.chassisW / 2 - 6, -def.chassisH / 2 - 9, 14, 4);
    ctx.strokeStyle = "#000"; ctx.lineWidth = 1;
    ctx.strokeRect(-def.chassisW / 2, -def.chassisH / 2, def.chassisW, def.chassisH);
    ctx.restore();
  },
  monsterTruck(cx, cy, a, def) {
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(a);
    ctx.fillStyle = def.color;
    ctx.fillRect(-def.chassisW / 2, -def.chassisH / 2, def.chassisW, def.chassisH);
    ctx.fillStyle = "#ff4400";
    ctx.beginPath();
    ctx.moveTo(-def.chassisW / 2, def.chassisH / 2);
    ctx.lineTo(-def.chassisW / 2 + 20, 0);
    ctx.lineTo(-def.chassisW / 2 + 10, def.chassisH / 2);
    ctx.fill();
    ctx.strokeStyle = "#000"; ctx.lineWidth = 1;
    ctx.strokeRect(-def.chassisW / 2, -def.chassisH / 2, def.chassisW, def.chassisH);
    ctx.restore();
  },
  garbageTruck(cx, cy, a, def) {
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(a);
    ctx.fillStyle = def.color2;
    ctx.fillRect(-def.chassisW / 2, -def.chassisH / 2, 28, def.chassisH);
    ctx.fillStyle = def.color;
    ctx.fillRect(-def.chassisW / 2 + 28, -def.chassisH / 2, def.chassisW - 28, def.chassisH);
    ctx.strokeStyle = "#000"; ctx.lineWidth = 1;
    ctx.strokeRect(-def.chassisW / 2, -def.chassisH / 2, def.chassisW, def.chassisH);
    ctx.restore();
  },
  tank(cx, cy, a, def) {
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(a);
    ctx.fillStyle = "#3b4a1f";
    ctx.fillRect(-def.chassisW / 2, -2, def.chassisW, def.chassisH / 2 + 2);
    ctx.fillStyle = def.color;
    ctx.fillRect(-def.chassisW / 2 + 6, -def.chassisH / 2, def.chassisW - 12, def.chassisH / 2 + 2);
    ctx.fillStyle = "#444";
    ctx.fillRect(-def.chassisW / 2 - 16, -def.chassisH / 2 - 5, 28, 4);
    ctx.strokeStyle = "#000"; ctx.lineWidth = 1;
    ctx.strokeRect(-def.chassisW / 2, -def.chassisH / 2, def.chassisW, def.chassisH);
    ctx.restore();
  },
  eggMobile(cx, cy, a, def) {
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(a);
    ctx.fillStyle = def.color;
    ctx.beginPath();
    ctx.ellipse(0, 0, def.chassisW / 2, def.chassisH / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = def.color2;
    ctx.beginPath(); ctx.arc(-8, -4, 4, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#000"; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(0, 0, def.chassisW / 2, def.chassisH / 2, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  },
  sawbot(cx, cy, a, def) {
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(a);
    ctx.fillStyle = def.color;
    ctx.fillRect(-def.chassisW / 2, -def.chassisH / 2, def.chassisW, def.chassisH);
    ctx.fillStyle = "#dd8800";
    for (let sx = -def.chassisW / 2; sx < def.chassisW / 2; sx += 10) {
      ctx.fillRect(sx, def.chassisH / 2 - 4, 5, 4);
    }
    ctx.strokeStyle = "#000"; ctx.lineWidth = 1;
    ctx.strokeRect(-def.chassisW / 2, -def.chassisH / 2, def.chassisW, def.chassisH);
    ctx.restore();
  },
};

function drawSawBlade(x, y, radius) {
  const t = performance.now() / 70;
  ctx.save();
  ctx.translate(x | 0, y | 0);
  ctx.rotate(t);
  ctx.fillStyle = "#999";
  ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#ff4400";
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * (radius - 2), Math.sin(a) * (radius - 2));
    ctx.lineTo(Math.cos(a) * (radius + 4), Math.sin(a) * (radius + 4));
    ctx.lineTo(Math.cos(a + 0.2) * (radius - 2), Math.sin(a + 0.2) * (radius - 2));
    ctx.fill();
  }
  ctx.strokeStyle = "#333"; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
}

function renderVehicle(veh) {
  const def = VEHICLES[veh.typeKey];
  const ch = veh.chassis;
  const fw = veh.frontWheel;
  const rw = veh.rearWheel;
  const hd = veh.headBody;

  /* Suspension strut rods */
  ctx.strokeStyle = "#2a2a32"; ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(rw.position.x | 0, rw.position.y | 0);
  ctx.lineTo(ch.position.x | 0, (ch.position.y + def.chassisH / 2) | 0);
  ctx.moveTo(fw.position.x | 0, fw.position.y | 0);
  ctx.lineTo(ch.position.x | 0, (ch.position.y + def.chassisH / 2) | 0);
  ctx.stroke();

  /* Wheels */
  drawWheel(rw.position.x, rw.position.y, rw.angle, def.wheelRadius, def.color2);
  drawWheel(fw.position.x, fw.position.y, fw.angle, def.wheelRadius, def.color2);

  /* Chassis */
  const drawFn = DRAW[veh.typeKey];
  if (drawFn) drawFn(ch.position.x, ch.position.y, ch.angle, def);

  /* Sawbot spinning roof blade */
  if (veh.bladeBody) {
    drawSawBlade(veh.bladeBody.position.x, veh.bladeBody.position.y, 14);
  }

  /* Driver helmet */
  drawDriverHead(hd.position.x, hd.position.y, ch.angle, veh.playerIdx);
}

/* ═══════════════════════════════════════════════════════════════
 *  SECTION 14: ENHANCED ARENA RENDERING & PROCEDURAL TEXTURING
 * ═══════════════════════════════════════════════════════════════ */

function drawStadiumBackdrop(key, def) {
  const time = performance.now();

  /* 1. Dynamic Atmosphere Sky Gradient */
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, def.bg);
  grad.addColorStop(0.65, "#10091c");
  grad.addColorStop(1, "#04020a");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  /* 2. Top Steel Ceiling Truss Girders */
  ctx.fillStyle = "#1e1a28";
  ctx.fillRect(0, 0, W, 18);
  ctx.strokeStyle = "#383248";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(0, 0, W, 18);
  for (let tx = 0; tx < W; tx += 36) {
    ctx.beginPath();
    ctx.moveTo(tx, 0); ctx.lineTo(tx + 18, 18);
    ctx.moveTo(tx + 36, 0); ctx.lineTo(tx + 18, 18);
    ctx.stroke();
  }

  /* 3. Overhead Corner Stadium Floodlights with Angled Light Cones */
  const lightGlow = Math.sin(time / 300) * 0.01 + 0.05;
  /* Left Floodlight */
  ctx.fillStyle = `rgba(255, 245, 210, ${lightGlow})`;
  ctx.beginPath();
  ctx.moveTo(90, 16); ctx.lineTo(-40, H); ctx.lineTo(340, H); ctx.closePath(); ctx.fill();
  /* Right Floodlight */
  ctx.fillStyle = `rgba(255, 245, 210, ${lightGlow})`;
  ctx.beginPath();
  ctx.moveTo(W - 90, 16); ctx.lineTo(W + 40, H); ctx.lineTo(W - 340, H); ctx.closePath(); ctx.fill();

  /* Floodlight housing fixtures */
  ctx.fillStyle = "#323746";
  ctx.fillRect(72, 10, 36, 12);
  ctx.fillRect(W - 108, 10, 36, 12);
  ctx.fillStyle = "#ffffea";
  ctx.fillRect(76, 18, 28, 4);
  ctx.fillRect(W - 104, 18, 28, 4);

  /* 4. Cheering Spectator Grandstands (Tiered Seating with Animated Pixel Crowd) */
  const tY = [40, 75, 110];
  const tColors = ["#181224", "#140e1e", "#100b18"];
  const crowdShirtColors = ["#00f0ff", "#ff3355", "#ffaa00", "#00ff66", "#9933ff", "#ffffff", "#ff77aa"];

  for (let tier = 0; tier < 3; tier++) {
    const y = tY[tier];
    ctx.fillStyle = tColors[tier];
    ctx.fillRect(0, y, W, 34);
    ctx.strokeStyle = "#241c34"; ctx.lineWidth = 1;
    ctx.strokeRect(0, y, W, 34);

    /* Spectators */
    const fans = 54;
    for (let f = 0; f < fans; f++) {
      const fx = 12 + f * 17.5 + ((tier * 7) % 12);
      const bob = Math.sin(time / 180 + f * 0.9 + tier * 1.5) > 0.35 ? -2 : 0;
      /* Torso */
      ctx.fillStyle = crowdShirtColors[(f * 3 + tier * 5) % crowdShirtColors.length];
      ctx.fillRect(fx - 3, y + 16 + bob, 6, 8);
      /* Head */
      ctx.fillStyle = (f % 5 === 0) ? "#f8c89c" : (f % 5 === 1) ? "#d49a6a" : (f % 5 === 2) ? "#945a34" : "#ffe0bd";
      ctx.fillRect(fx - 2, y + 10 + bob, 4, 5);
      /* Cheering arms */
      if (bob < 0 && f % 3 === 0) {
        ctx.fillStyle = crowdShirtColors[(f * 3 + tier * 5) % crowdShirtColors.length];
        ctx.fillRect(fx - 5, y + 9, 2, 6);
        ctx.fillRect(fx + 3, y + 9, 2, 6);
      }
    }
  }

  /* 5. Stadium Sponsor Ribbon Banners */
  const banY = 144;
  ctx.fillStyle = "#120d1c";
  ctx.fillRect(0, banY, W, 22);
  ctx.strokeStyle = "#2a1e3e"; ctx.lineWidth = 1.5;
  ctx.strokeRect(0, banY, W, 22);

  const banners = [
    { text: "TURBO TURTLES", bg: "#143818", fg: "#ffcc00" },
    { text: "KILLER CRASH", bg: "#4a1212", fg: "#ff4444" },
    { text: "BATTLE SLIMES", bg: "#0d2e28", fg: "#00ff66" },
    { text: "DODREAMS", bg: "#17183e", fg: "#00f0ff" },
    { text: "TIMESINK.NET", bg: "#2a103c", fg: "#bb66ff" },
  ];
  const bW = 160, bGap = 28;
  const bTotal = banners.length * (bW + bGap);
  for (let i = 0; i < banners.length * 2; i++) {
    const ban = banners[i % banners.length];
    const bx = 10 + i * (bW + bGap);
    if (bx < W) {
      ctx.fillStyle = ban.bg;
      ctx.fillRect(bx, banY + 2, bW, 18);
      ctx.strokeStyle = ban.fg; ctx.lineWidth = 1;
      ctx.strokeRect(bx, banY + 2, bW, 18);
      ctx.fillStyle = ban.fg;
      ctx.font = "bold 8px 'Press Start 2P', monospace"; ctx.textAlign = "center";
      ctx.fillText(ban.text, bx + bW / 2, banY + 14);
    }
  }

  /* 6. Suspended Jumbotron Video Screen */
  const jw = 180, jh = 76;
  const jx = W / 2 - jw / 2, jy = 14;

  /* Suspension cables */
  ctx.strokeStyle = "#505868"; ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(jx + 24, 0); ctx.lineTo(jx + 24, jy);
  ctx.moveTo(jx + jw - 24, 0); ctx.lineTo(jx + jw - 24, jy);
  ctx.stroke();

  /* Metal Bezel with Rivets */
  ctx.fillStyle = "#222732";
  ctx.fillRect(jx, jy, jw, jh);
  ctx.strokeStyle = "#404a5c"; ctx.lineWidth = 2.5;
  ctx.strokeRect(jx, jy, jw, jh);

  /* Corner bolt rivets */
  ctx.fillStyle = "#8a96aa";
  ctx.fillRect(jx + 3, jy + 3, 3, 3);
  ctx.fillRect(jx + jw - 6, jy + 3, 3, 3);
  ctx.fillRect(jx + 3, jy + jh - 6, 3, 3);
  ctx.fillRect(jx + jw - 6, jy + jh - 6, 3, 3);

  /* Screen CRT Glass */
  ctx.fillStyle = "#071216";
  ctx.fillRect(jx + 7, jy + 7, jw - 14, jh - 14);
  ctx.strokeStyle = "#00e5ff"; ctx.lineWidth = 1;
  ctx.strokeRect(jx + 7, jy + 7, jw - 14, jh - 14);

  /* Live Cam Header */
  const blinkRec = Math.sin(time / 250) > 0;
  if (blinkRec) {
    ctx.fillStyle = "#ff2244";
    ctx.beginPath(); ctx.arc(jx + 15, jy + 15, 3, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = "#00f0ff";
  ctx.font = "6px 'Press Start 2P', monospace"; ctx.textAlign = "left";
  ctx.fillText("LIVE FEED", jx + 22, jy + 18);

  ctx.fillStyle = "#88aacc"; ctx.textAlign = "right";
  ctx.fillText(def.name.toUpperCase(), jx + jw - 10, jy + 18);

  /* Real-Time Mini Radar Display inside Jumbotron */
  const radarX = jx + 10, radarY = jy + 22, radarW = jw - 20, radarH = jh - 28;
  ctx.fillStyle = "rgba(0, 30, 40, 0.6)";
  ctx.fillRect(radarX, radarY, radarW, radarH);

  /* Ground silhouette in mini radar */
  ctx.strokeStyle = "rgba(0, 255, 170, 0.45)"; ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(radarX, radarY + radarH - 3);
  ctx.lineTo(radarX + radarW, radarY + radarH - 3);
  ctx.stroke();

  /* Real-time player dots on radar */
  if (state.vehicles[0] && state.vehicles[1]) {
    const v1 = state.vehicles[0].chassis;
    const v2 = state.vehicles[1].chassis;
    const r1X = radarX + (v1.position.x / W) * radarW;
    const r1Y = radarY + (v1.position.y / H) * radarH;
    const r2X = radarX + (v2.position.x / W) * radarW;
    const r2Y = radarY + (v2.position.y / H) * radarH;

    ctx.fillStyle = "#00f0ff";
    ctx.beginPath(); ctx.arc(Math.max(radarX + 3, Math.min(radarX + radarW - 3, r1X)), Math.max(radarY + 3, Math.min(radarY + radarH - 3, r1Y)), 2.5, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = "#ff3355";
    ctx.beginPath(); ctx.arc(Math.max(radarX + 3, Math.min(radarX + radarW - 3, r2X)), Math.max(radarY + 3, Math.min(radarY + radarH - 3, r2Y)), 2.5, 0, Math.PI * 2); ctx.fill();
  }

  /* CRT Scanlines across screen */
  ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
  for (let sc = jy + 8; sc < jy + jh - 8; sc += 3) {
    ctx.fillRect(jx + 8, sc, jw - 16, 1);
  }
}

function renderArena() {
  if (!state.arena) return;
  const key = state.arena.key;
  const def = ARENAS[key];
  const time = performance.now();

  /* ═══════════════════════════════════════════════════════════
   * 1. GLOBAL STADIUM BACKDROP & ENVIRONMENT
   * ═══════════════════════════════════════════════════════════ */
  drawStadiumBackdrop(key, def);

  /* ═══════════════════════════════════════════════════════════
   * 2. ARENA-SPECIFIC ATMOSPHERIC OVERLAYS
   * ═══════════════════════════════════════════════════════════ */
  if (key === "theBump") {
    ctx.fillStyle = "#9933ff"; ctx.font = "bold 11px 'Press Start 2P', monospace"; ctx.textAlign = "center";
    ctx.fillText("⚡ CYBER STADIUM OVERDRIVE ⚡", W / 2, 108);
  } else if (key === "winterCliff") {
    /* Shimmering Aurora Borealis */
    const t = time / 1500;
    const aurGrad = ctx.createLinearGradient(0, 20, W, 180);
    aurGrad.addColorStop(0, `rgba(0, 255, 170, ${0.08 + Math.sin(t) * 0.04})`);
    aurGrad.addColorStop(0.5, `rgba(0, 180, 255, ${0.12 + Math.cos(t * 0.8) * 0.05})`);
    aurGrad.addColorStop(1, `rgba(180, 0, 255, ${0.07 + Math.sin(t * 1.2) * 0.03})`);
    ctx.fillStyle = aurGrad;
    ctx.fillRect(0, 0, W, 200);

    /* Falling snow particles */
    ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
    for (let i = 0; i < 65; i++) {
      const sx = ((i * 37 + t * 45) % W);
      const sy = ((i * 29 + t * 60) % H);
      ctx.fillRect(sx | 0, sy | 0, 2, 2);
    }
  } else if (key === "volcano") {
    /* Magma heat haze & bubbles */
    const t = time / 600;
    ctx.fillStyle = "rgba(255, 50, 0, 0.22)";
    ctx.fillRect(0, ARENA_FLOOR_Y + 5, W, H - ARENA_FLOOR_Y);
    for (let i = 0; i < 32; i++) {
      const bx = (i * 42 + t * 20) % W;
      const by = H - 20 + Math.sin(t + i) * 6;
      ctx.fillStyle = i % 2 === 0 ? "#ffaa00" : "#ff3300";
      ctx.beginPath(); ctx.arc(bx, by, 4 + Math.sin(t * 2 + i) * 2, 0, Math.PI * 2); ctx.fill();
    }
  } else if (key === "scaffolding") {
    /* City skyline silhouettes */
    ctx.fillStyle = "rgba(10, 15, 30, 0.7)";
    for (let i = 0; i < 24; i++) {
      const bW = 45 + (i * 17) % 35;
      const bH = 120 + (i * 31) % 150;
      ctx.fillRect(i * 56, ARENA_FLOOR_Y - bH, bW, bH);
    }
    if (state.arena.wreckingBall && state.arena.anchor) {
      const wb = state.arena.wreckingBall;
      const anc = state.arena.anchor;
      ctx.strokeStyle = "#778"; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(anc.position.x, anc.position.y); ctx.lineTo(wb.position.x, wb.position.y); ctx.stroke();
      ctx.fillStyle = "#555";
      ctx.beginPath(); ctx.arc(wb.position.x, wb.position.y, 24, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#888"; ctx.lineWidth = 2; ctx.stroke();
    }
  } else if (key === "pirateShip") {
    /* Rolling animated ocean waves */
    const t = time / 700;
    ctx.fillStyle = "rgba(0, 35, 100, 0.75)";
    ctx.fillRect(0, ARENA_FLOOR_Y + 22, W, H);
    ctx.strokeStyle = "rgba(0, 180, 255, 0.45)"; ctx.lineWidth = 3;
    for (let wx = 0; wx < W + 40; wx += 35) {
      ctx.beginPath();
      ctx.moveTo(wx, ARENA_FLOOR_Y + 26 + Math.sin(t + wx * 0.04) * 5);
      ctx.lineTo(wx + 20, ARENA_FLOOR_Y + 26 + Math.sin(t + (wx + 20) * 0.04) * 5);
      ctx.stroke();
    }
  } else if (key === "catacombs") {
    /* Flickering wall torch sconces casting ambient flame glow */
    const torches = [110, W - 110, W / 2 - 180, W / 2 + 180];
    for (const tx of torches) {
      const ty = ARENA_FLOOR_Y - 95;
      /* Wall bracket */
      ctx.fillStyle = "#2c2836";
      ctx.fillRect(tx - 3, ty, 6, 14);
      /* Sconce cup */
      ctx.fillStyle = "#4a4258";
      ctx.fillRect(tx - 6, ty - 4, 12, 5);
      /* Flickering Flame */
      const fPulse = Math.sin(time / 70 + tx) * 2;
      ctx.fillStyle = "#ffaa00";
      ctx.beginPath();
      ctx.arc(tx, ty - 8 + fPulse * 0.5, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ffff55";
      ctx.beginPath();
      ctx.arc(tx, ty - 7 + fPulse * 0.5, 3, 0, Math.PI * 2);
      ctx.fill();
      /* Warm light halo */
      ctx.fillStyle = "rgba(255, 140, 0, 0.08)";
      ctx.beginPath();
      ctx.arc(tx, ty - 8, 36, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /* ═══════════════════════════════════════════════════════════
   * 3. PROCEDURAL MATERIAL TEXTURING ENGINE FOR TERRAIN
   * ═══════════════════════════════════════════════════════════ */
  for (const b of state.arena.bodies) {
    if (b.label === "wall" || b.label === "hazard_lava" || b.label === "hazard_pit" || b.label === "hazard_water" || b.label === "hazard_saw" || b.label === "wrecking_ball" || b.label === "skeleton_bob" || b.label === "bumper") continue;

    if (b.label === "barrel") {
      let alive = false;
      for (const h of state.arena.hazards || []) {
        if (h.type === "barrels") {
          for (const br of h.barrels) {
            if (br.body === b && br.alive) alive = true;
          }
        }
      }
      if (!alive) continue;
      /* Exploding TNT barrel */
      ctx.save();
      ctx.translate(b.position.x, b.position.y);
      ctx.rotate(b.angle);
      ctx.fillStyle = "#aa2211";
      ctx.fillRect(-12, -16, 24, 32);
      ctx.fillStyle = "#ffcc00";
      ctx.font = "bold 9px monospace"; ctx.textAlign = "center";
      ctx.fillText("TNT", 0, 3);
      ctx.strokeStyle = "#441108"; ctx.lineWidth = 1.5;
      ctx.strokeRect(-12, -16, 24, 32);
      ctx.restore();
      continue;
    }

    ctx.save();
    ctx.translate(b.position.x, b.position.y);
    ctx.rotate(b.angle);

    const bw = b.bounds.max.x - b.bounds.min.x;
    const bh = b.bounds.max.y - b.bounds.min.y;

    /* A. Bone Bridge Segments */
    if (b.label === "bone_bridge") {
      ctx.fillStyle = "#ede5d0";
      ctx.fillRect(-bw / 2, -bh / 2, bw, bh);

      /* Bone marrow fissure */
      ctx.strokeStyle = "#b5a88e"; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(-bw / 2 + 10, 0); ctx.lineTo(bw / 2 - 10, 0); ctx.stroke();

      /* Joint knuckle rounded caps */
      ctx.fillStyle = "#f5eee0";
      ctx.beginPath();
      ctx.arc(-bw / 2 + 5, -bh / 2 + 2, 4, 0, Math.PI * 2);
      ctx.arc(-bw / 2 + 5, bh / 2 - 2, 4, 0, Math.PI * 2);
      ctx.arc(bw / 2 - 5, -bh / 2 + 2, 4, 0, Math.PI * 2);
      ctx.arc(bw / 2 - 5, bh / 2 - 2, 4, 0, Math.PI * 2);
      ctx.fill();

      /* Hemp binding ropes */
      ctx.strokeStyle = "#7c5832"; ctx.lineWidth = 2;
      ctx.strokeRect(-bw / 2 + 14, -bh / 2 - 1, 6, bh + 2);
      ctx.strokeRect(bw / 2 - 20, -bh / 2 - 1, 6, bh + 2);

      ctx.restore();
      continue;
    }

    /* B. Dune Saws Material: Golden Sand Dunes with Steel Trusses */
    if (key === "duneSaws") {
      const sGrad = ctx.createLinearGradient(0, -bh / 2, 0, bh / 2);
      sGrad.addColorStop(0, "#f2c64b");
      sGrad.addColorStop(0.25, "#d69828");
      sGrad.addColorStop(0.7, "#a66c16");
      sGrad.addColorStop(1, "#66400c");
      ctx.fillStyle = sGrad;
      ctx.fillRect(-bw / 2, -bh / 2, bw, bh);

      /* Wind-rippled contour waves */
      ctx.strokeStyle = "rgba(255, 235, 140, 0.22)";
      ctx.lineWidth = 1.2;
      for (let ry = -bh / 2 + 5; ry < bh / 2 - 4; ry += 6) {
        ctx.beginPath();
        for (let rx = -bw / 2; rx <= bw / 2; rx += 8) {
          const dy = Math.sin((rx + ry * 3) * 0.12) * 1.5;
          if (rx === -bw / 2) ctx.moveTo(rx, ry + dy);
          else ctx.lineTo(rx, ry + dy);
        }
        ctx.stroke();
      }

      /* Sand grain stippling */
      ctx.fillStyle = "rgba(255, 255, 200, 0.35)";
      for (let g = 0; g < Math.min(120, (bw * bh) / 250); g++) {
        const gx = ((g * 37) % bw) - bw / 2;
        const gy = ((g * 59) % bh) - bh / 2;
        ctx.fillRect(gx, gy, 1.2, 1.2);
      }

      /* Glowing sand crest line along top */
      ctx.strokeStyle = "#fff6b0"; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(-bw / 2, -bh / 2); ctx.lineTo(bw / 2, -bh / 2); ctx.stroke();

      /* Bottom steel truss structure */
      if (bh > 28) {
        ctx.fillStyle = "#2a2d36";
        ctx.fillRect(-bw / 2, bh / 2 - 12, bw, 12);
        ctx.strokeStyle = "#404654"; ctx.lineWidth = 1.5;
        ctx.strokeRect(-bw / 2, bh / 2 - 12, bw, 12);
        ctx.fillStyle = "#8a94a6";
        for (let rv = -bw / 2 + 10; rv < bw / 2 - 6; rv += 18) {
          ctx.beginPath(); ctx.arc(rv, bh / 2 - 6, 2, 0, Math.PI * 2); ctx.fill();
        }
      }
    }
    /* C. Stone Brick Masonry (The Thunderdome & Bone Catacombs) */
    else if (key === "colosseum" || key === "catacombs") {
      const isDungeon = key === "catacombs";
      ctx.fillStyle = isDungeon ? "#18221b" : "#282330";
      ctx.fillRect(-bw / 2, -bh / 2, bw, bh);

      /* Staggered masonry bricks */
      const brW = 28, brH = 13;
      const rows = Math.ceil(bh / brH);
      const cols = Math.ceil(bw / brW) + 1;

      for (let r = 0; r < rows; r++) {
        const y0 = -bh / 2 + r * brH;
        const rowH = Math.min(brH, bh / 2 - y0);
        if (rowH <= 0) continue;
        const xOffset = (r % 2 === 0 ? 0 : brW / 2);

        for (let c = -1; c < cols; c++) {
          const x0 = -bw / 2 + c * brW + xOffset;
          const blockW = Math.min(brW, bw / 2 - x0);
          if (x0 + brW < -bw / 2 || x0 > bw / 2 || blockW <= 0) continue;

          const hash = ((r * 17 + c * 31) % 4);
          if (isDungeon) {
            ctx.fillStyle = hash === 0 ? "#1e2a21" : hash === 1 ? "#243228" : hash === 2 ? "#172019" : "#2a382e";
          } else {
            ctx.fillStyle = hash === 0 ? "#342d3e" : hash === 1 ? "#2e2837" : hash === 2 ? "#3a3245" : "#241f2b";
          }
          ctx.fillRect(Math.max(-bw / 2, x0 + 1), y0 + 1, Math.min(blockW - 2, bw / 2 - x0 - 1), rowH - 2);

          /* Brick bevel highlight */
          ctx.strokeStyle = "rgba(255,255,255,0.08)"; ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(Math.max(-bw / 2, x0 + 1), y0 + rowH - 1);
          ctx.lineTo(Math.max(-bw / 2, x0 + 1), y0 + 1);
          ctx.lineTo(Math.min(bw / 2, x0 + blockW - 1), y0 + 1);
          ctx.stroke();
        }
      }

      /* Moss patches on Catacombs */
      if (isDungeon) {
        ctx.fillStyle = "rgba(60, 140, 70, 0.45)";
        for (let m = -bw / 2 + 12; m < bw / 2; m += 36) {
          ctx.beginPath();
          ctx.arc(m, -bh / 2 + 4, 5, 0, Math.PI * 2);
          ctx.arc(m + 4, -bh / 2 + 3, 4, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      /* Glowing trim rim */
      ctx.strokeStyle = isDungeon ? "#66dd77" : "#ffd700"; ctx.lineWidth = 2.2;
      ctx.beginPath(); ctx.moveTo(-bw / 2, -bh / 2); ctx.lineTo(bw / 2, -bh / 2); ctx.stroke();
    }
    /* D. Riveted Industrial Steel (Hydro Facility, Hazard Foundry, Cyber Stadium, Skyline) */
    else if (key === "hydroDeck" || key === "sawmill" || key === "theBump" || key === "scaffolding" || key === "ovalTrack") {
      const mGrad = ctx.createLinearGradient(0, -bh / 2, 0, bh / 2);
      mGrad.addColorStop(0, "#363d4c");
      mGrad.addColorStop(0.5, "#252b36");
      mGrad.addColorStop(1, "#181d24");
      ctx.fillStyle = mGrad;
      ctx.fillRect(-bw / 2, -bh / 2, bw, bh);

      /* Brushed lines */
      ctx.strokeStyle = "rgba(255, 255, 255, 0.05)"; ctx.lineWidth = 1;
      for (let ly = -bh / 2 + 4; ly < bh / 2; ly += 5) {
        ctx.beginPath(); ctx.moveTo(-bw / 2, ly); ctx.lineTo(bw / 2, ly); ctx.stroke();
      }

      /* Rivet bolts */
      ctx.fillStyle = "#8a96aa";
      for (let rx = -bw / 2 + 8; rx < bw / 2 - 4; rx += 14) {
        ctx.beginPath(); ctx.arc(rx, -bh / 2 + 4, 1.8, 0, Math.PI * 2); ctx.fill();
      }

      /* Safety hazard chevrons on steep ramps */
      if (bh > 40 && b.angle !== 0) {
        ctx.save();
        ctx.clip();
        ctx.strokeStyle = "rgba(240, 180, 0, 0.4)"; ctx.lineWidth = 6;
        for (let s = -bw; s < bw + bh; s += 16) {
          ctx.beginPath(); ctx.moveTo(s, -bh / 2); ctx.lineTo(s + bh, bh / 2); ctx.stroke();
        }
        ctx.restore();
      }

      ctx.strokeStyle = def.accent || "#00e5ff"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-bw / 2, -bh / 2); ctx.lineTo(bw / 2, -bh / 2); ctx.stroke();
    }
    /* E. Glacial Ice & Snow (Aurora Glaciers) */
    else if (key === "winterCliff") {
      const iGrad = ctx.createLinearGradient(0, -bh / 2, 0, bh / 2);
      iGrad.addColorStop(0, "#a8e0f5");
      iGrad.addColorStop(0.4, "#5098c4");
      iGrad.addColorStop(1, "#184568");
      ctx.fillStyle = iGrad;
      ctx.fillRect(-bw / 2, -bh / 2, bw, bh);

      /* Ice crystalline fracture lines */
      ctx.strokeStyle = "rgba(255, 255, 255, 0.35)"; ctx.lineWidth = 1.2;
      for (let f = -bw / 2 + 25; f < bw / 2 - 15; f += 50) {
        ctx.beginPath();
        ctx.moveTo(f, -bh / 2 + 6);
        ctx.lineTo(f + 8, -bh / 2 + 16);
        ctx.lineTo(f + 2, -bh / 2 + 26);
        ctx.stroke();
      }

      /* White snow blanket */
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.moveTo(-bw / 2, -bh / 2);
      for (let sx = -bw / 2; sx <= bw / 2; sx += 12) {
        const drift = Math.sin(sx * 0.15) * 2.5 + 3;
        ctx.lineTo(sx, -bh / 2 + drift);
      }
      ctx.lineTo(bw / 2, -bh / 2);
      ctx.closePath();
      ctx.fill();

      /* Diamond sparkles */
      ctx.fillStyle = "#ffffff";
      const spTime = time / 400;
      for (let sp = 0; sp < 4; sp++) {
        const px = (-bw / 2 + 15 + ((sp * 67 + spTime * 20) % (bw - 30)));
        const py = -bh / 2 + 4;
        ctx.fillRect(px, py, 2, 2);
      }
    }
    /* F. Basalt Magma Rock (Magma Caverns) */
    else if (key === "volcano") {
      ctx.fillStyle = "#22130e";
      ctx.fillRect(-bw / 2, -bh / 2, bw, bh);

      /* Glowing magma crack fissures */
      const tPulse = Math.sin(time / 180) * 0.2 + 0.8;
      ctx.strokeStyle = `rgba(255, 80, 0, ${0.7 * tPulse})`; ctx.lineWidth = 1.8;
      for (let v = -bw / 2 + 20; v < bw / 2 - 10; v += 45) {
        ctx.beginPath();
        ctx.moveTo(v, -bh / 2 + 2);
        ctx.lineTo(v + 10, -bh / 2 + 14);
        ctx.lineTo(v + 4, -bh / 2 + 24);
        ctx.stroke();
      }

      ctx.strokeStyle = "#ff4400"; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(-bw / 2, -bh / 2); ctx.lineTo(bw / 2, -bh / 2); ctx.stroke();
    }
    /* G. Varnished Wooden Planks (Seasaw Galleon & Demolition Derby) */
    else {
      ctx.fillStyle = key === "chaosBarn" ? "#4a3520" : "#56381e";
      ctx.fillRect(-bw / 2, -bh / 2, bw, bh);

      const plH = 12;
      for (let py = -bh / 2; py < bh / 2; py += plH) {
        ctx.strokeStyle = "rgba(0, 0, 0, 0.4)"; ctx.lineWidth = 1;
        ctx.strokeRect(-bw / 2, py, bw, plH);

        ctx.strokeStyle = "rgba(255, 200, 120, 0.08)";
        ctx.beginPath();
        ctx.moveTo(-bw / 2, py + plH / 2); ctx.lineTo(bw / 2, py + plH / 2);
        ctx.stroke();

        ctx.fillStyle = "#22140a";
        for (let nx = -bw / 2 + 10; nx < bw / 2; nx += 32) {
          ctx.fillRect(nx, py + 3, 2, 2);
        }
      }

      if (key === "chaosBarn") {
        ctx.strokeStyle = "#ffcc44"; ctx.lineWidth = 1.5;
        for (let st = -bw / 2 + 8; st < bw / 2 - 4; st += 14) {
          ctx.beginPath(); ctx.moveTo(st, -bh / 2); ctx.lineTo(st + 3, -bh / 2 - 4); ctx.stroke();
        }
      }

      ctx.strokeStyle = def.accent || "#ffaa00"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-bw / 2, -bh / 2); ctx.lineTo(bw / 2, -bh / 2); ctx.stroke();
    }

    /* Subtle perimeter shadow */
    ctx.strokeStyle = "rgba(0,0,0,0.45)"; ctx.lineWidth = 1;
    ctx.strokeRect(-bw / 2, -bh / 2, bw, bh);
    ctx.restore();
  }

  /* ═══════════════════════════════════════════════════════════
   * 4. HAZARDS & SPECIAL PROPS RENDERING
   * ═══════════════════════════════════════════════════════════ */

  /* A. Dune Saws Giant Wall Buzzsaws */
  if (state.arena.hazards) {
    for (const h of state.arena.hazards) {
      if (h.type === "wall_saw") {
        ctx.save();
        ctx.translate(h.body.position.x, h.body.position.y);

        /* Horizontal steel mounting arm extending from wall */
        ctx.fillStyle = "#2c303a";
        const armW = h.dir > 0 ? -h.x : (W - h.x);
        ctx.fillRect(0, -8, armW, 16);
        ctx.strokeStyle = "#464d5c"; ctx.lineWidth = 2;
        ctx.strokeRect(0, -8, armW, 16);

        ctx.rotate(h.body.angle);

        /* Metallic saw disc */
        ctx.fillStyle = "#4a505e";
        ctx.beginPath(); ctx.arc(0, 0, h.radius, 0, Math.PI * 2); ctx.fill();

        /* Concentric blade spin rings */
        ctx.strokeStyle = "rgba(255, 255, 255, 0.2)"; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(0, 0, h.radius * 0.7, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.arc(0, 0, h.radius * 0.45, 0, Math.PI * 2); ctx.stroke();

        /* 14 curved saw teeth around rim */
        ctx.fillStyle = "#e0e4ec";
        const teeth = 14;
        for (let t = 0; t < teeth; t++) {
          const a = (t / teeth) * Math.PI * 2;
          ctx.beginPath();
          ctx.moveTo(Math.cos(a) * (h.radius - 3), Math.sin(a) * (h.radius - 3));
          ctx.lineTo(Math.cos(a + 0.15) * (h.radius + 7), Math.sin(a + 0.15) * (h.radius + 7));
          ctx.lineTo(Math.cos(a + 0.25) * (h.radius - 4), Math.sin(a + 0.25) * (h.radius - 4));
          ctx.fill();
        }

        /* Center axle hub with 6 bolts */
        ctx.fillStyle = "#1e222a";
        ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "#e0a020"; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = "#f0f2f6";
        for (let b = 0; b < 6; b++) {
          const ba = (b / 6) * Math.PI * 2;
          ctx.fillRect(Math.cos(ba) * 7 - 1.5, Math.sin(ba) * 7 - 1.5, 3, 3);
        }

        ctx.restore();
      }
    }
  }

  /* B. Hydro Facility Cyan Water Hazard Pool */
  if (key === "hydroDeck") {
    const t = time / 450;
    const waterY = ARENA_FLOOR_Y + 12;
    const wGrad = ctx.createLinearGradient(0, waterY, 0, H);
    wGrad.addColorStop(0, "rgba(0, 229, 255, 0.7)");
    wGrad.addColorStop(0.3, "rgba(0, 140, 220, 0.85)");
    wGrad.addColorStop(1, "rgba(2, 20, 45, 0.95)");
    ctx.fillStyle = wGrad;
    ctx.fillRect(0, waterY, W, H - waterY);

    /* Animated sine-wave water ripples */
    ctx.strokeStyle = "rgba(255, 255, 255, 0.65)"; ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let wx = 0; wx <= W; wx += 15) {
      const wy = waterY + Math.sin(wx * 0.035 + t) * 4 + Math.sin(wx * 0.08 - t * 1.5) * 2;
      if (wx === 0) ctx.moveTo(wx, wy);
      else ctx.lineTo(wx, wy);
    }
    ctx.stroke();

    /* Rising water bubbles */
    ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
    for (let b = 0; b < 24; b++) {
      const bx = ((b * 47 + t * 25) % W);
      const by = H - ((b * 31 + t * 45) % (H - waterY));
      ctx.beginPath(); ctx.arc(bx, by, 2 + (b % 3), 0, Math.PI * 2); ctx.fill();
    }
  }

  /* C. Catacombs Swinging Skeleton Pendulum */
  if (state.arena.skeletonBob && state.arena.anchor) {
    const anc = state.arena.anchor;
    const sk = state.arena.skeletonBob;

    /* Chain links */
    ctx.strokeStyle = "#606875"; ctx.lineWidth = 2.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.moveTo(anc.position.x, anc.position.y); ctx.lineTo(sk.position.x, sk.position.y); ctx.stroke();
    ctx.setLineDash([]);

    /* Pixel art Skeleton Bob */
    ctx.save();
    ctx.translate(sk.position.x, sk.position.y);
    ctx.rotate(sk.angle);
    /* Skull */
    ctx.fillStyle = "#ede6d4";
    ctx.beginPath(); ctx.arc(0, -6, 12, 0, Math.PI * 2); ctx.fill();
    ctx.fillRect(-6, 2, 12, 7);
    /* Eye sockets & nose */
    ctx.fillStyle = "#111418";
    ctx.fillRect(-5, -7, 4, 4);
    ctx.fillRect(1, -7, 4, 4);
    ctx.fillRect(-1.5, -2, 3, 2);
    /* Teeth */
    ctx.fillStyle = "#ede6d4";
    ctx.fillRect(-4, 7, 2, 3);
    ctx.fillRect(-1, 7, 2, 3);
    ctx.fillRect(2, 7, 2, 3);
    /* Ribcage & spine */
    ctx.fillStyle = "#dcd2be";
    ctx.fillRect(-1, 10, 2, 16);
    for (let rib = 0; rib < 4; rib++) {
      ctx.fillRect(-8 + rib, 12 + rib * 3, 16 - rib * 2, 2);
    }
    /* Dangling leg bones */
    ctx.fillRect(-6, 26, 3, 14);
    ctx.fillRect(3, 26, 3, 14);
    ctx.restore();
  }

  /* D. Moving Saw Blades & Steam Vent (Hazard Foundry) */
  if (state.arena.hazards) {
    for (const h of state.arena.hazards) {
      if (h.type === "saw") {
        drawSawBlade(h.body.position.x, h.body.position.y, 18);
        ctx.strokeStyle = "rgba(255, 60, 0, 0.28)"; ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(h.baseX - h.range, h.body.position.y);
        ctx.lineTo(h.baseX + h.range, h.body.position.y);
        ctx.stroke();
        ctx.setLineDash([]);
      } else if (h.type === "steam") {
        ctx.save();
        ctx.fillStyle = "#22252c";
        ctx.fillRect(h.x - 40, ARENA_FLOOR_Y - 4, 80, 8);
        ctx.strokeStyle = h.active ? "#00f0ff" : "#ff6600"; ctx.lineWidth = 2;
        ctx.strokeRect(h.x - 40, ARENA_FLOOR_Y - 4, 80, 8);
        ctx.fillStyle = "#08090c";
        for (let g = -32; g <= 32; g += 8) {
          ctx.fillRect(h.x + g, ARENA_FLOOR_Y - 3, 4, 6);
        }
        ctx.restore();
      }
    }
  }

  /* E. Speedway Boost Pads */
  if (state.arena.boostPads) {
    const pulse = Math.sin(time / 150) * 0.2 + 0.8;
    for (const pad of state.arena.boostPads) {
      ctx.fillStyle = `rgba(0, 255, 102, ${0.2 * pulse})`;
      ctx.fillRect(pad.x - pad.w / 2, pad.y - 4, pad.w, 8);
      ctx.fillStyle = "#00ff66";
      ctx.font = "bold 10px monospace"; ctx.textAlign = "center";
      ctx.fillText(pad.dir > 0 ? ">>>" : "<<<", pad.x, pad.y + 3);
    }
  }
}

/* ═══════════════════════════════════════════════════════════════
 *  SECTION 15: HUD & MATCH TELEMETRY
 * ═══════════════════════════════════════════════════════════════ */
function renderHUD() {
  const dotR = 8, dotGap = 22, dotY = 30;

  /* Player telemetry */
  ctx.fillStyle = "#00f0ff"; ctx.font = "bold 12px 'Press Start 2P', monospace"; ctx.textAlign = "left";
  ctx.fillText("PLAYER", 20, dotY - 12);
  for (let i = 0; i < WINS_NEEDED; i++) {
    ctx.fillStyle = i < state.scores[0] ? "#00f0ff" : "rgba(0, 240, 255, 0.18)";
    ctx.beginPath(); ctx.arc(20 + i * dotGap + dotR, dotY + dotR, dotR, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#00f0ff"; ctx.lineWidth = 1.2; ctx.stroke();
  }

  /* Interactive Garage button in HUD */
  const gHover = input.mouse.x >= 20 && input.mouse.x <= 135 && input.mouse.y >= 52 && input.mouse.y <= 74;
  ctx.fillStyle = gHover ? "rgba(153, 51, 255, 0.45)" : "rgba(153, 51, 255, 0.2)";
  ctx.fillRect(20, 52, 115, 22);
  ctx.strokeStyle = gHover ? "#d488ff" : "#9933ff";
  ctx.lineWidth = 1.2;
  ctx.strokeRect(20, 52, 115, 22);
  ctx.fillStyle = "#fff";
  ctx.font = "8px 'Press Start 2P', monospace";
  ctx.textAlign = "center";
  ctx.fillText("⮌ GARAGE [G]", 77, 66);

  /* Bot AI telemetry */
  const diffLabels = ["ROOKIE BOT", "VETERAN BOT", "CHAMPION BOT"];
  ctx.fillStyle = "#ff3355"; ctx.textAlign = "right";
  ctx.fillText(diffLabels[state.aiDifficulty], W - 20, dotY - 12);
  for (let i = 0; i < WINS_NEEDED; i++) {
    ctx.fillStyle = i < state.scores[1] ? "#ff3355" : "rgba(255, 51, 85, 0.18)";
    ctx.beginPath(); ctx.arc(W - 20 - i * dotGap - dotR, dotY + dotR, dotR, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#ff3355"; ctx.lineWidth = 1.2; ctx.stroke();
  }

  /* Round & timer */
  const secs = Math.max(0, Math.ceil(state.roundTimer));
  ctx.fillStyle = state.suddenDeath ? "#ff3300" : "#ffffff";
  ctx.font = "bold 16px 'Press Start 2P', monospace"; ctx.textAlign = "center";
  ctx.fillText(secs + (state.suddenDeath ? " !" : ""), W / 2, 40);

  ctx.fillStyle = "rgba(255,255,255,0.45)";
  ctx.font = "10px 'Press Start 2P', monospace";
  ctx.fillText(`ROUND ${state.round} / 9`, W / 2, 58);

  /* Sudden death indicator */
  if (state.suddenDeath) {
    const flash = Math.sin(performance.now() / 180) > 0;
    if (flash) {
      ctx.fillStyle = "#ff3300"; ctx.font = "bold 15px 'Press Start 2P', monospace";
      ctx.fillText("⚡ SUDDEN DEATH ⚡", W / 2, H / 2 - 70);
    }
  }
}

/* ═══════════════════════════════════════════════════════════════
 *  SECTION 16: GARAGE (All Unlocked, Player vs Bot)
 * ═══════════════════════════════════════════════════════════════ */
function updateGarage() {
  const cols = 6, cardW = 130, cardH = 68, gap = 10;
  const gridW = cols * (cardW + gap) - gap;
  const startX = (W - gridW) / 2;
  const startY = 60;

  /* Vehicle click selections */
  for (let i = 0; i < VEHICLE_KEYS.length; i++) {
    const col = i % cols, row = Math.floor(i / cols);
    const cx = startX + col * (cardW + gap);
    const cy = startY + row * (cardH + gap);
    const hover = input.mouse.x >= cx && input.mouse.x <= cx + cardW &&
                  input.mouse.y >= cy && input.mouse.y <= cy + cardH;

    if (hover) {
      if (input.mouse.clicked) {
        state.selP1 = i;
        sfx.click();
      }
      if (input.mouse.rightClicked) {
        state.selP2 = i;
        sfx.click();
      }
    }
  }

  /* Bot Difficulty selector */
  const diffY = startY + 2 * (cardH + gap) + 12;
  const diffs = ["ROOKIE", "VETERAN", "CHAMPION"];
  const dbW = 110, dbGap = 15;
  const dStartX = W / 2 - (diffs.length * dbW + (diffs.length - 1) * dbGap) / 2;

  for (let i = 0; i < diffs.length; i++) {
    const dx = dStartX + i * (dbW + dbGap);
    const hover = input.mouse.x >= dx && input.mouse.x <= dx + dbW &&
                  input.mouse.y >= diffY && input.mouse.y <= diffY + 28;
    if (hover && input.mouse.clicked) {
      state.aiDifficulty = i;
      sfx.click();
    }
  }

  /* Random Bot car button */
  const randBx = dStartX + 3 * (dbW + dbGap) + 10;
  const hoverRand = input.mouse.x >= randBx && input.mouse.x <= randBx + 110 &&
                    input.mouse.y >= diffY && input.mouse.y <= diffY + 28;
  if (hoverRand && input.mouse.clicked) {
    state.selP2 = Math.floor(Math.random() * VEHICLE_KEYS.length);
    sfx.click();
  }

  /* Arena selection (2 rows of 6 cards for 12 arenas) */
  const aCols = 6, aCardW = 132, aCardH = 42, aGapX = 10, aGapY = 8;
  const aGridW = aCols * (aCardW + aGapX) - aGapX;
  const aStartX = (W - aGridW) / 2;
  const arenaY = diffY + 40;

  for (let i = 0; i < ARENA_KEYS.length; i++) {
    const col = i % aCols, row = Math.floor(i / aCols);
    const ax = aStartX + col * (aCardW + aGapX);
    const ay = arenaY + row * (aCardH + aGapY);
    const hover = input.mouse.x >= ax && input.mouse.x <= ax + aCardW &&
                  input.mouse.y >= ay && input.mouse.y <= ay + aCardH;
    if (hover && input.mouse.clicked) {
      state.selArena = i;
      sfx.click();
    }
  }

  /* Keyboard shortcuts 1-9, 0, -, = for rapid arena selection */
  const digitKeys = ["Digit1", "Digit2", "Digit3", "Digit4", "Digit5", "Digit6", "Digit7", "Digit8", "Digit9", "Digit0", "Minus", "Equal"];
  for (let k = 0; k < ARENA_KEYS.length && k < digitKeys.length; k++) {
    if (input.wasPressed(digitKeys[k])) {
      state.selArena = k;
      sfx.click();
    }
  }

  /* START MATCH button */
  const btnY = arenaY + 2 * (aCardH + aGapY) + 14;
  const btnW = 260, btnH = 44;
  const bx = W / 2 - btnW / 2;
  const hoverStart = input.mouse.x >= bx && input.mouse.x <= bx + btnW &&
                     input.mouse.y >= btnY && input.mouse.y <= btnY + btnH;

  if ((hoverStart && input.mouse.clicked) || input.wasPressed("Space") || input.wasPressed("Enter")) {
    sfx.click();
    startMatch();
  }
}

function renderGarage() {
  ctx.fillStyle = "#0c0618";
  ctx.fillRect(0, 0, W, H);

  /* Title */
  ctx.fillStyle = "#9933ff";
  ctx.font = "bold 20px 'Press Start 2P', monospace"; ctx.textAlign = "center";
  ctx.fillText("HEADBUTT // BATTLE GARAGE", W / 2, 34);

  const cols = 6, cardW = 130, cardH = 68, gap = 10;
  const gridW = cols * (cardW + gap) - gap;
  const startX = (W - gridW) / 2;
  const startY = 60;

  /* 12 Vehicle Cards */
  for (let i = 0; i < VEHICLE_KEYS.length; i++) {
    const key = VEHICLE_KEYS[i];
    const def = VEHICLES[key];
    const col = i % cols, row = Math.floor(i / cols);
    const cx = startX + col * (cardW + gap);
    const cy = startY + row * (cardH + gap);

    const isP1 = state.selP1 === i;
    const isP2 = state.selP2 === i;
    const hover = input.mouse.x >= cx && input.mouse.x <= cx + cardW &&
                  input.mouse.y >= cy && input.mouse.y <= cy + cardH;

    ctx.fillStyle = isP1 ? "rgba(0, 240, 255, 0.2)" :
                    isP2 ? "rgba(255, 51, 85, 0.2)" :
                    hover ? "rgba(153, 51, 255, 0.2)" : "rgba(35, 30, 50, 0.5)";
    ctx.fillRect(cx, cy, cardW, cardH);

    ctx.strokeStyle = isP1 ? "#00f0ff" : isP2 ? "#ff3355" : hover ? "#bb66ff" : "#443860";
    ctx.lineWidth = isP1 || isP2 ? 2.5 : 1;
    ctx.strokeRect(cx, cy, cardW, cardH);

    /* Mini pixel-art vehicle preview */
    ctx.save();
    ctx.translate(cx + cardW / 2, cy + 26);
    ctx.scale(0.55, 0.55);
    const drawFn = DRAW[key];
    if (drawFn) drawFn(0, 0, 0, def);
    drawWheel(-def.wheelBase / 2, def.chassisH / 2 + 2, 0, def.wheelRadius * 0.75, def.color2);
    drawWheel(def.wheelBase / 2, def.chassisH / 2 + 2, 0, def.wheelRadius * 0.75, def.color2);
    ctx.restore();

    /* Labels */
    ctx.fillStyle = "#ddd";
    ctx.font = "7px 'Press Start 2P', monospace"; ctx.textAlign = "center";
    ctx.fillText(def.name.toUpperCase(), cx + cardW / 2, cy + cardH - 6);

    if (isP1) {
      ctx.fillStyle = "#00f0ff"; ctx.font = "bold 8px 'Press Start 2P', monospace"; ctx.textAlign = "left";
      ctx.fillText("PLAYER", cx + 6, cy + 12);
    }
    if (isP2) {
      ctx.fillStyle = "#ff3355"; ctx.font = "bold 8px 'Press Start 2P', monospace"; ctx.textAlign = "right";
      ctx.fillText("BOT", cx + cardW - 6, cy + 12);
    }
  }

  /* Bot Difficulty row */
  const diffY = startY + 2 * (cardH + gap) + 12;
  const diffs = ["ROOKIE", "VETERAN", "CHAMPION"];
  const dbW = 110, dbGap = 15;
  const dStartX = W / 2 - (diffs.length * dbW + (diffs.length - 1) * dbGap) / 2;

  ctx.fillStyle = "#aaa"; ctx.font = "9px 'Press Start 2P', monospace"; ctx.textAlign = "right";
  ctx.fillText("BOT AI:", dStartX - 14, diffY + 18);

  for (let i = 0; i < diffs.length; i++) {
    const dx = dStartX + i * (dbW + dbGap);
    const sel = state.aiDifficulty === i;
    const hover = input.mouse.x >= dx && input.mouse.x <= dx + dbW &&
                  input.mouse.y >= diffY && input.mouse.y <= diffY + 28;

    ctx.fillStyle = sel ? "rgba(255, 51, 85, 0.4)" : hover ? "rgba(255, 51, 85, 0.2)" : "rgba(40,30,50,0.4)";
    ctx.fillRect(dx, diffY, dbW, 28);
    ctx.strokeStyle = sel ? "#ff3355" : hover ? "#ff6688" : "#553850";
    ctx.lineWidth = sel ? 2 : 1;
    ctx.strokeRect(dx, diffY, dbW, 28);

    ctx.fillStyle = sel ? "#fff" : "#aaa";
    ctx.font = "8px 'Press Start 2P', monospace"; ctx.textAlign = "center";
    ctx.fillText(diffs[i], dx + dbW / 2, diffY + 17);
  }

  /* Arena selection (2 rows of 6 cards for 12 arenas) */
  const aCols = 6, aCardW = 132, aCardH = 42, aGapX = 10, aGapY = 8;
  const aGridW = aCols * (aCardW + aGapX) - aGapX;
  const aStartX = (W - aGridW) / 2;
  const arenaY = diffY + 40;

  for (let i = 0; i < ARENA_KEYS.length; i++) {
    const key = ARENA_KEYS[i];
    const def = ARENAS[key];
    const col = i % aCols, row = Math.floor(i / aCols);
    const ax = aStartX + col * (aCardW + aGapX);
    const ay = arenaY + row * (aCardH + aGapY);
    const sel = state.selArena === i;
    const hover = input.mouse.x >= ax && input.mouse.x <= ax + aCardW &&
                  input.mouse.y >= ay && input.mouse.y <= ay + aCardH;

    ctx.fillStyle = sel ? "rgba(153, 51, 255, 0.4)" : hover ? "rgba(153, 51, 255, 0.2)" : "rgba(35, 30, 50, 0.55)";
    ctx.fillRect(ax, ay, aCardW, aCardH);

    ctx.strokeStyle = sel ? "#bb66ff" : hover ? "#9933ff" : "#443860";
    ctx.lineWidth = sel ? 2.5 : 1;
    ctx.strokeRect(ax, ay, aCardW, aCardH);

    /* Arena color bar */
    ctx.fillStyle = def.accent || def.bg;
    ctx.fillRect(ax + 2, ay + 2, aCardW - 4, 10);

    /* Arena name */
    ctx.fillStyle = sel ? "#ffffff" : "#cccccc";
    ctx.font = "bold 7px 'Press Start 2P', monospace"; ctx.textAlign = "center";
    ctx.fillText(def.name.toUpperCase(), ax + aCardW / 2, ay + aCardH - 9);
  }

  /* START MATCH button */
  const btnY = arenaY + 2 * (aCardH + aGapY) + 14;
  const btnW = 260, btnH = 44;
  const bx = W / 2 - btnW / 2;
  const hoverStart = input.mouse.x >= bx && input.mouse.x <= bx + btnW &&
                     input.mouse.y >= btnY && input.mouse.y <= btnY + btnH;

  ctx.fillStyle = hoverStart ? "rgba(153, 51, 255, 0.5)" : "rgba(153, 51, 255, 0.25)";
  ctx.fillRect(bx, btnY, btnW, btnH);
  ctx.strokeStyle = hoverStart ? "#d488ff" : "#9933ff";
  ctx.lineWidth = 2.5;
  ctx.strokeRect(bx, btnY, btnW, btnH);

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 13px 'Press Start 2P', monospace"; ctx.textAlign = "center";
  ctx.fillText("START MATCH", W / 2, btnY + btnH / 2 + 5);

  /* Quick hint */
  ctx.fillStyle = "#888";
  ctx.font = "8px 'Press Start 2P', monospace"; ctx.textAlign = "center";
  ctx.fillText("LEFT CLICK = SELECT YOUR CAR  •  RIGHT CLICK = SELECT BOT CAR", W / 2, H - 20);
  ctx.fillText("PRESS SPACE OR ENTER TO COMMENCE BATTLE", W / 2, H - 7);
}

function renderCountdown() {
  renderArena();
  if (state.vehicles[0]) renderVehicle(state.vehicles[0]);
  if (state.vehicles[1]) renderVehicle(state.vehicles[1]);
  renderHUD();

  const secs = Math.ceil(state.countdownTimer - 0.4);
  const text = secs > 0 ? String(secs) : "HEADBUTT!";
  const scale = secs > 0 ? 1 + (1 - (state.countdownTimer % 1)) * 0.35 : 1.25;

  ctx.save();
  ctx.translate(W / 2, H / 2 - 20);
  ctx.scale(scale, scale);
  ctx.fillStyle = secs > 0 ? "#ffffff" : "#ff3300";
  ctx.font = secs > 0 ? "bold 64px 'Press Start 2P', monospace" : "bold 32px 'Press Start 2P', monospace";
  ctx.textAlign = "center";
  ctx.fillText(text, 0, 0);
  ctx.restore();

  ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
  ctx.fillRect(0, 0, W, H);
}

function renderRoundEnd() {
  renderArena();
  if (state.vehicles[0]) renderVehicle(state.vehicles[0]);
  if (state.vehicles[1]) renderVehicle(state.vehicles[1]);
  renderParticles();
  renderHUD();

  const winner = state.roundWinner;
  const label = winner === 0 ? "PLAYER WINS ROUND!" : "BOT WINS ROUND!";
  const color = winner === 0 ? "#00f0ff" : "#ff3355";

  ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
  ctx.fillRect(0, H / 2 - 38, W, 76);

  ctx.fillStyle = color;
  ctx.font = "bold 22px 'Press Start 2P', monospace"; ctx.textAlign = "center";
  ctx.fillText(label, W / 2, H / 2 + 8);
}

function renderMatchEnd() {
  ctx.fillStyle = "#0c0618";
  ctx.fillRect(0, 0, W, H);

  const winner = state.matchWinner;
  const label = winner === 0 ? "🏆 PLAYER WINS THE MATCH! 🏆" : "💀 BOT WINS THE MATCH 💀";
  const color = winner === 0 ? "#00f0ff" : "#ff3355";

  ctx.fillStyle = color;
  ctx.font = "bold 20px 'Press Start 2P', monospace"; ctx.textAlign = "center";
  ctx.fillText(label, W / 2, 170);

  ctx.fillStyle = "#fff";
  ctx.font = "bold 34px 'Press Start 2P', monospace";
  ctx.fillText(`${state.scores[0]}  -  ${state.scores[1]}`, W / 2, 240);

  const p = getProgress();
  ctx.fillStyle = "#aaa"; ctx.font = "10px 'Press Start 2P', monospace";
  ctx.fillText(`TOTAL MATCH WINS: ${p.wins}  |  CURRENT STREAK: ${state.streak}`, W / 2, 300);

  const flash = Math.sin(performance.now() / 350) > 0;
  if (flash) {
    ctx.fillStyle = "#9933ff";
    ctx.font = "12px 'Press Start 2P', monospace";
    ctx.fillText("PRESS SPACE FOR REMATCH", W / 2, 380);
    ctx.fillText("PRESS ESC FOR GARAGE", W / 2, 410);
  }
}

function updateMatchEnd() {
  if (input.wasPressed("Space") || input.wasPressed("Enter") || input.mouse.clicked) {
    sfx.click();
    startMatch();
  }
  if (input.wasPressed("Escape") || input.wasPressed("KeyG")) {
    sfx.click();
    state.screen = S.GARAGE;
    state.matchWinner = -1;
  }
}

/* ═══════════════════════════════════════════════════════════════
 *  SECTION 17: GAME LOOP & TIMESTEP
 * ═══════════════════════════════════════════════════════════════ */
function update(dt) {
  const clickedGarageBtn = input.mouse.clicked && input.mouse.x >= 20 && input.mouse.x <= 135 && input.mouse.y >= 52 && input.mouse.y <= 74;

  switch (state.screen) {
    case S.GARAGE:
      updateGarage();
      break;

    case S.COUNTDOWN:
      if (input.wasPressed("Escape") || input.wasPressed("KeyG") || clickedGarageBtn) {
        sfx.click();
        clearPhysics();
        state.screen = S.GARAGE;
        state.matchWinner = -1;
        break;
      }
      state.countdownTimer -= dt;
      if (mEngine) Engine.update(mEngine, PHYSICS_DT);
      if (state.countdownTimer <= 0) {
        startPlaying();
        playTone(850, 0.12, "square");
      } else if (state.countdownTimer <= COUNTDOWN_SECS) {
        const prev = Math.ceil(state.countdownTimer + dt);
        const curr = Math.ceil(state.countdownTimer);
        if (prev !== curr) playTone(440, 0.08, "square");
      }
      break;

    case S.PLAYING:
      if (input.wasPressed("Escape") || input.wasPressed("KeyG") || clickedGarageBtn) {
        sfx.click();
        clearPhysics();
        state.screen = S.GARAGE;
        state.matchWinner = -1;
        break;
      }
      handlePlayerInput(dt);
      updateAI(dt);

      /* Fixed 60 Hz physics step */
      state.physicsAccum += dt * 1000;
      let steps = 0;
      while (state.physicsAccum >= PHYSICS_DT && steps < 4) {
        Engine.update(mEngine, PHYSICS_DT);
        state.physicsAccum -= PHYSICS_DT;
        steps++;
      }
      if (state.physicsAccum > PHYSICS_DT * 4) state.physicsAccum = 0;

      updateHazards(dt);

      /* Round Timer */
      state.roundTimer -= dt;
      if (state.roundTimer <= 0 && !state.suddenDeath) {
        state.suddenDeath = true;
        state.roundTimer = 15;
        shakeScreen(10);
        toast({ title: "⚡ SUDDEN DEATH ⚡", body: "15s remaining! Hazards intensified!", icon: "sparkle" });
      }
      if (state.suddenDeath && state.roundTimer <= 0) {
        /* Sudden death timeout: vehicle with higher Y position (head height) wins */
        const p1Y = state.vehicles[0].headBody.position.y;
        const p2Y = state.vehicles[1].headBody.position.y;
        endRound(p1Y < p2Y ? 0 : 1);
      }

      /* Ring-out bounds check */
      for (let i = 0; i < 2; i++) {
        const ch = state.vehicles[i].chassis;
        if (ch.position.y > H + 80 || ch.position.x < -100 || ch.position.x > W + 100) {
          endRound(1 - i);
          break;
        }
      }

      updateParticles(dt);
      break;

    case S.ROUND_END:
      if (input.wasPressed("Escape") || input.wasPressed("KeyG") || clickedGarageBtn) {
        sfx.click();
        clearPhysics();
        state.screen = S.GARAGE;
        state.matchWinner = -1;
        break;
      }
      state.roundEndTimer -= dt;
      updateParticles(dt);
      if (mEngine) Engine.update(mEngine, PHYSICS_DT);
      if (state.roundEndTimer <= 0) finishRound();
      break;

    case S.MATCH_END:
      updateMatchEnd();
      break;
  }

  input.clearJustPressed();
}

function render(dt, { paused, fps }) {
  ctx.save();
  if (state.screenShake.intensity > 0) {
    ctx.translate(state.screenShake.x, state.screenShake.y);
  }

  switch (state.screen) {
    case S.GARAGE:
      renderGarage();
      break;
    case S.COUNTDOWN:
      renderCountdown();
      break;
    case S.PLAYING:
      renderArena();
      if (state.vehicles[0]) renderVehicle(state.vehicles[0]);
      if (state.vehicles[1]) renderVehicle(state.vehicles[1]);
      renderParticles();
      renderHUD();
      break;
    case S.ROUND_END:
      renderRoundEnd();
      break;
    case S.MATCH_END:
      renderMatchEnd();
      break;
  }

  ctx.restore();

  /* Minimal FPS debug watermark */
  ctx.fillStyle = "rgba(255,255,255,0.25)";
  ctx.font = "8px monospace"; ctx.textAlign = "right";
  ctx.fillText(`${fps} FPS`, W - 8, H - 6);
}

/* ── Loop Start ────────────────────────────────────────────────── */
const loop = createGameLoop({
  canvas, update, render, targetFps: 60,
});
loop.start();
