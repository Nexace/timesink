import { CLASSIC_ARENAS } from "./maps.js";
// HEADBUTT — pure game data and rules (no DOM, no Matter.js): cars, arenas, bot levels, scoring.
// Car geometry is authored facing RIGHT in local coordinates: origin between the axles at axle
// height, +x forward, +y down. The right-hand player's car is mirrored at spawn.

export const ROUND_SECONDS = 45;
export const WINS_NEEDED = 5;
export const BOOST_COOLDOWN = 3.2;

/*
 * parts: collision shapes of the body (convex only)
 *   { rect: [cx, cy, w, h] }  or  { poly: [[x, y], ...] }  (convex, clockwise)
 * wheels: [{ x, y, r }]
 * head: { x, y, r }  — the driver's helmet; get it touched by the other car and you lose the round
 * stats (0..1) are for the garage bars; physics numbers drive the sim.
 */
export const CARS = {
  hotrod: {
    name: "Hot Rod",
    blurb: "Balanced muscle. Low roof, big rear tyres.",
    style: "hotrod",
    color: "#e0312b",
    accent: "#ffd23f",
    parts: [{ rect: [4, -20, 118, 22] }, { poly: [[-26, -31], [16, -31], [26, -44], [-20, -44]] }],
    wheels: [{ x: -40, y: 0, r: 20 }, { x: 44, y: 2, r: 17 }],
    head: { x: -4, y: -56, r: 12 },
    density: 0.0021,
    spin: 0.42,
    torque: 1,
    air: 0.0065,
    boost: 0.03,
    stats: { speed: 0.75, weight: 0.6, grip: 0.65 }
  },
  pickup: {
    name: "Pickup",
    blurb: "Heavy and planted. Hard to flip.",
    style: "pickup",
    color: "#2f7ad9",
    accent: "#e8eef7",
    parts: [{ rect: [2, -22, 132, 26] }, { poly: [[-4, -35], [34, -35], [44, -58], [2, -58]] }],
    wheels: [{ x: -44, y: 2, r: 20 }, { x: 44, y: 2, r: 20 }],
    head: { x: 20, y: -46, r: 12 },
    density: 0.0028,
    spin: 0.36,
    torque: 1.2,
    air: 0.0048,
    boost: 0.028,
    stats: { speed: 0.55, weight: 0.85, grip: 0.8 }
  },
  monster: {
    name: "Monster Truck",
    blurb: "Giant wheels climb anything.",
    style: "monster",
    color: "#29b24a",
    accent: "#111418",
    parts: [{ rect: [0, -46, 112, 26] }, { poly: [[-18, -59], [22, -59], [30, -78], [-10, -78]] }],
    wheels: [{ x: -40, y: 0, r: 30 }, { x: 40, y: 0, r: 30 }],
    head: { x: 6, y: -70, r: 12 },
    density: 0.0019,
    spin: 0.34,
    torque: 1.3,
    air: 0.0055,
    boost: 0.03,
    stats: { speed: 0.55, weight: 0.75, grip: 1 }
  },
  kart: {
    name: "Go-Kart",
    blurb: "Tiny, twitchy, flips in a heartbeat.",
    style: "kart",
    color: "#ff8a1f",
    accent: "#1b1b1b",
    parts: [{ rect: [0, -12, 92, 14] }],
    wheels: [{ x: -34, y: 0, r: 13 }, { x: 34, y: 0, r: 13 }],
    head: { x: -6, y: -38, r: 12 },
    density: 0.0022,
    spin: 0.55,
    torque: 0.8,
    air: 0.0085,
    boost: 0.034,
    stats: { speed: 1, weight: 0.3, grip: 0.55 }
  },
  dozer: {
    name: "Bulldozer",
    blurb: "Front blade scoops rivals onto their roof.",
    style: "dozer",
    color: "#f2b705",
    accent: "#2a2a2a",
    parts: [
      { rect: [-6, -24, 104, 30] },
      { poly: [[50, -44], [72, -44], [80, 2], [50, 2]] },
      { poly: [[-30, -40], [6, -40], [6, -66], [-24, -66]] }
    ],
    wheels: [{ x: -38, y: 2, r: 17 }, { x: 0, y: 2, r: 17 }, { x: 36, y: 2, r: 17 }],
    head: { x: -10, y: -52, r: 11 },
    density: 0.0026,
    spin: 0.3,
    torque: 1.4,
    air: 0.004,
    boost: 0.026,
    stats: { speed: 0.4, weight: 1, grip: 0.9 }
  },
  police: {
    name: "Interceptor",
    blurb: "Fast cruiser with a long nose.",
    style: "police",
    color: "#15171c",
    accent: "#f2f4f7",
    parts: [{ rect: [4, -18, 130, 20] }, { poly: [[-30, -28], [18, -28], [30, -44], [-18, -44]] }],
    wheels: [{ x: -44, y: 0, r: 17 }, { x: 46, y: 0, r: 17 }],
    head: { x: -4, y: -56, r: 12 },
    density: 0.0021,
    spin: 0.48,
    torque: 1,
    air: 0.006,
    boost: 0.032,
    stats: { speed: 0.9, weight: 0.6, grip: 0.6 }
  },
  buggy: {
    name: "Dune Buggy",
    blurb: "Springy roll cage; loves to jump.",
    style: "buggy",
    color: "#ff4fa3",
    accent: "#3a3a44",
    parts: [{ rect: [0, -20, 104, 14] }, { poly: [[-30, -27], [26, -27], [14, -60], [-22, -60]] }],
    wheels: [{ x: -42, y: 0, r: 21 }, { x: 42, y: 0, r: 21 }],
    head: { x: -2, y: -44, r: 12 },
    density: 0.0017,
    spin: 0.46,
    torque: 0.95,
    air: 0.0075,
    boost: 0.036,
    stats: { speed: 0.85, weight: 0.45, grip: 0.7 }
  },
  icecream: {
    name: "Ice Cream Van",
    blurb: "Tall box shields the driver from above.",
    style: "icecream",
    color: "#f7f0e1",
    accent: "#ff6fb5",
    parts: [{ rect: [-10, -40, 120, 62] }, { poly: [[50, -32], [66, -20], [66, -9], [50, -9]] }],
    wheels: [{ x: -44, y: 2, r: 17 }, { x: 40, y: 2, r: 17 }],
    head: { x: 58, y: -44, r: 11 },
    density: 0.0021,
    spin: 0.38,
    torque: 1.1,
    air: 0.0045,
    boost: 0.03,
    stats: { speed: 0.5, weight: 0.8, grip: 0.7 }
  }
};
export const CAR_KEYS = Object.keys(CARS);

/*
 * Arenas: 1280×720 world. `solids` are static convex shapes, `hazards` kill on contact,
 * `seesaw` is a pivoting plank, `movers` slide along a path. `overtime` sets the sudden-death:
 * "crusher" (spiked ceiling descends) or "lava" (the lava rises).
 */
export const ARENAS = {
  stadium: {
    name: "Neon Stadium",
    blurb: "Classic bowl with a central hump and packed stands.",
    theme: "stadium",
    gravity: 1,
    friction: 0.9,
    spawns: [{ x: 260, y: 560 }, { x: 1020, y: 560 }],
    solids: [
      { rect: [640, 700, 1400, 80] },
      { poly: [[0, 480], [120, 660], [0, 660]] },
      { poly: [[1280, 480], [1280, 660], [1160, 660]] },
      { poly: [[520, 660], [640, 612], [760, 660]] },
      { rect: [640, 360, 220, 18], deco: "girder" }
    ],
    overtime: "crusher"
  },
  junkyard: {
    name: "Scrapyard",
    blurb: "Rolling scrap hills and a tyre ramp.",
    theme: "junkyard",
    gravity: 1,
    friction: 0.8,
    spawns: [{ x: 230, y: 560 }, { x: 1050, y: 560 }],
    solids: [
      { rect: [640, 700, 1400, 80] },
      { poly: [[330, 660], [460, 590], [560, 660]] },
      { poly: [[720, 660], [820, 600], [950, 660]] },
      { poly: [[0, 420], [90, 660], [0, 660]] },
      { poly: [[1280, 420], [1280, 660], [1190, 660]] },
      { rect: [640, 470, 160, 20], angle: -0.08, deco: "plank" }
    ],
    overtime: "crusher"
  },
  volcano: {
    name: "Magma Forge",
    blurb: "Lava pit under a narrow bridge. It rises in overtime.",
    theme: "volcano",
    gravity: 1,
    friction: 0.9,
    spawns: [{ x: 200, y: 520 }, { x: 1080, y: 520 }],
    solids: [
      { rect: [180, 640, 380, 120] },
      { rect: [1100, 640, 380, 120] },
      { rect: [640, 591, 460, 22], deco: "bridge" }
    ],
    gaps: [[370, 410], [870, 910]],
    hazards: [{ rect: [640, 700, 520, 120], kind: "lava" }],
    overtime: "lava"
  },
  moon: {
    name: "Lunar Base",
    blurb: "Low gravity. Huge jumps, slow landings.",
    theme: "moon",
    gravity: 0.38,
    friction: 0.85,
    spawns: [{ x: 260, y: 560 }, { x: 1020, y: 560 }],
    solids: [
      { rect: [640, 700, 1400, 80] },
      { poly: [[380, 660], [470, 630], [560, 660]] },
      { poly: [[720, 660], [810, 630], [900, 660]] },
      { poly: [[0, 520], [100, 660], [0, 660]] },
      { poly: [[1280, 520], [1280, 660], [1180, 660]] },
      { rect: [640, 420, 260, 16], deco: "girder" }
    ],
    overtime: "crusher"
  },
  ship: {
    name: "Pirate Deck",
    blurb: "A giant see-saw plank over the hold.",
    theme: "ship",
    gravity: 1,
    friction: 0.85,
    spawns: [{ x: 230, y: 560 }, { x: 1050, y: 560 }],
    solids: [
      { rect: [640, 700, 1400, 80] },
      { poly: [[0, 440], [140, 660], [0, 660]] },
      { poly: [[1280, 440], [1280, 660], [1140, 660]] },
      { poly: [[600, 660], [640, 600], [680, 660]], deco: "pivot" }
    ],
    seesaw: { x: 640, y: 592, w: 560, h: 18 },
    overtime: "crusher"
  },
  ice: {
    name: "Ice Rink",
    blurb: "Almost no grip. Momentum is everything.",
    theme: "ice",
    gravity: 1,
    friction: 0.05,
    spawns: [{ x: 260, y: 560 }, { x: 1020, y: 560 }],
    solids: [
      { rect: [640, 700, 1400, 80], ice: true },
      { poly: [[0, 440], [150, 660], [0, 660]], ice: true },
      { poly: [[1280, 440], [1280, 660], [1130, 660]], ice: true },
      { rect: [640, 450, 200, 18], deco: "girder" }
    ],
    overtime: "crusher"
  },
  rooftop: {
    name: "Rooftop Gap",
    blurb: "Two towers and a drop. Fall and you lose.",
    theme: "rooftop",
    gravity: 1,
    friction: 0.9,
    spawns: [{ x: 230, y: 520 }, { x: 1050, y: 520 }],
    solids: [
      { rect: [280, 660, 560, 120] },
      { rect: [1000, 660, 560, 120] },
      { poly: [[480, 600], [560, 600], [560, 566]] },
      { poly: [[720, 600], [800, 600], [720, 566]] },
      { rect: [640, 380, 160, 16], deco: "sign" }
    ],
    gaps: [[560, 720]],
    fallY: 820,
    overtime: "crusher"
  },
  graveyard: {
    name: "Graveyard",
    blurb: "Spike pits either side of the crypt mound.",
    theme: "graveyard",
    gravity: 1,
    friction: 0.9,
    spawns: [{ x: 330, y: 560 }, { x: 950, y: 560 }],
    solids: [
      { rect: [640, 700, 1400, 80] },
      { poly: [[500, 660], [640, 590], [780, 660]] },
      { poly: [[160, 560], [200, 660], [160, 660]] },
      { poly: [[1120, 560], [1120, 660], [1080, 660]] },
      { rect: [80, 640, 160, 40] },
      { rect: [1200, 640, 160, 40] }
    ],
    hazards: [
      { rect: [80, 612, 150, 16], kind: "spikes" },
      { rect: [1200, 612, 150, 16], kind: "spikes" }
    ],
    overtime: "crusher"
  }
};
for (const a of Object.values(ARENAS)) a.section = "original";
for (const [k, a] of Object.entries(CLASSIC_ARENAS)) ARENAS[k] = { ...a, section: "classic" };
export const ARENA_KEYS = Object.keys(ARENAS);

// Bot levels: reaction time (s), aim noise, throttle discipline, boost use
export const BOTS = {
  easy: { label: "EASY", reaction: 0.45, noise: 0.5, aggression: 0.55, boost: 0.1 },
  normal: { label: "NORMAL", reaction: 0.28, noise: 0.3, aggression: 0.75, boost: 0.35 },
  hard: { label: "HARD", reaction: 0.16, noise: 0.15, aggression: 0.9, boost: 0.6 },
  insane: { label: "INSANE", reaction: 0.08, noise: 0.05, aggression: 1, boost: 0.9 }
};
export const BOT_KEYS = Object.keys(BOTS);

// Collision labels look like "p0_body", "p0_head", "p1_wheel"
export const ownerOf = (label) => (/^p([01])_/.test(label || "") ? Number(label[1]) : -1);
export const isHead = (label) => /^p[01]_head$/.test(label || "");

/**
 * Decide what a contact between two labelled parts means.
 * Returns { loser } when a driver is knocked out (head touched by the other car or a hazard).
 */
export function contactOutcome(a, b) {
  const check = (head, other) => {
    if (!isHead(head)) return null;
    const who = ownerOf(head);
    const hitter = ownerOf(other);
    if (hitter !== -1 && hitter !== who) return { loser: who, by: "car" };
    if (other === "hazard") return { loser: who, by: "hazard" };
    // Sawblades and meteors only knock you out when they hit the helmet (as in Drive Ahead)
    if (other === "saw" || other === "meteor") return { loser: who, by: other };
    return null;
  };
  return check(a, b) || check(b, a);
}

/** Any part of a car touching a hazard (lava, spikes, crusher) knocks that driver out. */
export function hazardOutcome(a, b) {
  if (a === "hazard" && ownerOf(b) !== -1) return { loser: ownerOf(b), by: "hazard" };
  if (b === "hazard" && ownerOf(a) !== -1) return { loser: ownerOf(a), by: "hazard" };
  return null;
}

/** Resolve all knockouts that happened in the same physics step. */
export function resolveRound(knockouts) {
  const losers = new Set(knockouts.map((k) => k.loser));
  if (losers.size === 0) return null;
  if (losers.size === 2) return { draw: true };
  const loser = [...losers][0];
  return { winner: 1 - loser, loser };
}

export function matchWinner(scores, need = WINS_NEEDED) {
  if (scores[0] >= need) return 0;
  if (scores[1] >= need) return 1;
  return -1;
}

/** Mirror a car definition to face left (for the right-hand spawn). */
export function mirrorCar(def) {
  return {
    ...def,
    parts: def.parts.map((p) => (p.rect ? { rect: [-p.rect[0], p.rect[1], p.rect[2], p.rect[3]] } : { poly: p.poly.map(([x, y]) => [-x, y]).reverse() })),
    wheels: def.wheels.map((w) => ({ ...w, x: -w.x })),
    head: { ...def.head, x: -def.head.x }
  };
}
