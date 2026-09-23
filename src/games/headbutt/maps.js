/*
 * Classic arenas modelled on the Drive Ahead! map roster (layouts rebuilt from the map descriptions:
 * https://drive-ahead.fandom.com/wiki/Category:Maps). Pure data, 1280×720 world, same schema as
 * data.js ARENAS plus the extra features the game engine understands:
 *
 *   liquid:   { y, kind: "water" | "acid" }         a head under the surface drowns / dissolves
 *   saws:     [{ x, y, r }]                          static sawblades — deadly to helmets only
 *   pendulum: { x, y, len, r, amp, period }          a sawblade swinging on a chain from (x, y)
 *   rotor:    { x, y, w, h, speed }                  a spinning platform (rad/s, + = clockwise)
 *   dome:     { x, y, R, lobes, k, speed, saw }      a spinning "motordome" cage (r = R(1 + k·cos nθ))
 *   props:    [{ rect, density, deco }]              loose physics girders that topple
 *   floaters: [{ rect, deco }]                       platforms that float on the liquid
 *   overtime: "flood" (liquid rises, meteors fall unless meteors: false) | "acid" | "saws" | "crusher"
 */

const W = 1280;
const mirrorX = (pts) => pts.map(([x, y]) => [W - x, y]);
const mirrorShape = (s) => (s.rect ? { ...s, rect: [W - s.rect[0], s.rect[1], s.rect[2], s.rect[3]], angle: s.angle ? -s.angle : 0 } : { ...s, poly: mirrorX(s.poly) });
const both = (...shapes) => shapes.flatMap((s) => [s, mirrorShape(s)]);

// Rock shell shared by the cave maps: ceiling, rounded top and bottom corners, flat floor
const caveShell = (floorTop = 640) => [
  { rect: [640, 30, 1400, 140] },
  ...both(
    { poly: [[0, 100], [170, 100], [0, 250]] },
    { poly: [[0, floorTop - 250], [70, floorTop - 80], [0, floorTop]] },
    { poly: [[0, floorTop], [70, floorTop - 80], [180, floorTop]] }
  )
];

export const CLASSIC_ARENAS = {
  bump: {
    name: "Bump",
    blurb: "Flat sand hill with a bump in the middle and water off both ledges.",
    theme: "sand",
    gravity: 1,
    friction: 0.9,
    spawns: [{ x: 330, y: 500 }, { x: 950, y: 500 }],
    solids: [
      { rect: [640, 620, 880, 120] },
      ...both({ poly: [[110, 690], [200, 560], [200, 690]] }),
      { poly: [[560, 560], [640, 516], [720, 560]] }
    ],
    liquid: { y: 640, kind: "water" },
    overtime: "flood"
  },
  blades: {
    name: "Blades",
    blurb: "Sand arena with a small hill. Sawblades guard both edges.",
    theme: "sand",
    gravity: 1,
    friction: 0.9,
    spawns: [{ x: 380, y: 500 }, { x: 900, y: 500 }],
    solids: [
      { rect: [640, 620, 800, 120] },
      { poly: [[520, 560], [640, 522], [760, 560]] },
      ...both({ rect: [170, 220, 16, 300], deco: "girder" })
    ],
    saws: [{ x: 196, y: 548, r: 58 }, { x: 1084, y: 548, r: 58 }],
    liquid: { y: 650, kind: "water" },
    overtime: "flood"
  },
  cave: {
    name: "Cave",
    blurb: "Closed rock cave with curved edges. Saws drop from the roof.",
    theme: "cave",
    gravity: 1,
    friction: 0.9,
    spawns: [{ x: 320, y: 560 }, { x: 960, y: 560 }],
    solids: [{ rect: [640, 690, 1400, 100] }, ...caveShell()],
    overtime: "saws"
  },
  tunnel: {
    name: "Tunnel",
    blurb: "The Cave with a free-floating slab to drive around and under.",
    theme: "cave",
    gravity: 1,
    friction: 0.9,
    spawns: [{ x: 280, y: 560 }, { x: 1000, y: 560 }],
    solids: [{ rect: [640, 690, 1400, 100] }, ...caveShell(), { rect: [640, 430, 560, 40] }],
    overtime: "saws"
  },
  pit: {
    name: "Pit",
    blurb: "Small stone cave with a trough in the floor.",
    theme: "cave",
    gravity: 1,
    friction: 0.9,
    spawns: [{ x: 300, y: 540 }, { x: 980, y: 540 }],
    solids: [
      { rect: [220, 670, 440, 100] },
      { rect: [1060, 670, 440, 100] },
      ...both({ poly: [[440, 620], [560, 690], [560, 720], [440, 720]] }),
      { rect: [640, 705, 160, 30] },
      ...caveShell(620)
    ],
    overtime: "saws"
  },
  saw: {
    name: "Saw",
    blurb: "A cave with a floating slab and a sawblade spinning in the floor.",
    theme: "cave",
    gravity: 1,
    friction: 0.9,
    spawns: [{ x: 300, y: 560 }, { x: 980, y: 560 }],
    solids: [{ rect: [300, 690, 600, 100] }, { rect: [980, 690, 600, 100] }, ...caveShell(), { rect: [640, 420, 320, 30] }],
    saws: [{ x: 640, y: 668, r: 52 }],
    overtime: "saws"
  },
  desertcave: {
    name: "Desert Cave",
    blurb: "Sandstone cave with drifted sand and a small floating island.",
    theme: "desertcave",
    gravity: 1,
    friction: 0.85,
    spawns: [{ x: 300, y: 560 }, { x: 980, y: 560 }],
    solids: [
      { rect: [640, 690, 1400, 100] },
      ...caveShell(),
      { poly: [[380, 640], [470, 612], [580, 640]] },
      { poly: [[700, 640], [810, 610], [900, 640]] },
      { poly: [[520, 420], [560, 402], [640, 396], [720, 402], [760, 420], [720, 438], [640, 444], [560, 438]] }
    ],
    overtime: "saws"
  },
  goggles: {
    name: "Goggles",
    blurb: "Enclosed twin bowls: sand below, stone above, a hump in the middle. Floods in sudden death.",
    theme: "goggles",
    gravity: 1,
    friction: 0.9,
    spawns: [{ x: 320, y: 560 }, { x: 960, y: 560 }],
    solids: [
      { rect: [640, 690, 1400, 100] },
      ...caveShell(),
      { poly: [[500, 640], [640, 566], [780, 640]] },
      { poly: [[560, 100], [720, 100], [640, 210]] }
    ],
    liquid: { y: 760, kind: "water" },
    overtime: "flood",
    meteors: false
  },
  sandplanet: {
    name: "Sand Planet",
    blurb: "Big cratered sand hill with a pit on top. Roll off the sides and you're swimming.",
    theme: "planet",
    gravity: 0.8,
    friction: 0.85,
    spawns: [{ x: 480, y: 460 }, { x: 800, y: 460 }],
    solids: [
      { poly: [[60, 720], [420, 520], [420, 720]] },
      { rect: [490, 620, 140, 200] },
      { rect: [640, 650, 160, 140] },
      { rect: [790, 620, 140, 200] },
      { poly: [[860, 520], [1220, 720], [860, 720]] }
    ],
    liquid: { y: 660, kind: "water" },
    overtime: "flood"
  },
  triplehill: {
    name: "Triple Hill",
    blurb: "Three sand hills in the stadium, water waiting on both sides.",
    theme: "sand",
    gravity: 1,
    friction: 0.9,
    spawns: [{ x: 330, y: 470 }, { x: 950, y: 470 }],
    solids: [
      { rect: [640, 660, 1000, 80] },
      { poly: [[180, 620], [330, 540], [480, 620]] },
      { poly: [[490, 620], [640, 526], [790, 620]] },
      { poly: [[800, 620], [950, 540], [1100, 620]] }
    ],
    liquid: { y: 660, kind: "water" },
    overtime: "flood"
  },
  wateringhole: {
    name: "Watering Hole",
    blurb: "Spawn on a floating island above curved banks that funnel into the water.",
    theme: "sand",
    gravity: 1,
    friction: 0.9,
    spawns: [{ x: 520, y: 360 }, { x: 760, y: 360 }],
    solids: [...both({ poly: [[0, 400], [520, 720], [0, 720]] }), { rect: [640, 420, 440, 30] }],
    liquid: { y: 640, kind: "water" },
    overtime: "flood"
  },
  smileyface: {
    name: "Smiley Face",
    blurb: "Two eye platforms, a centre slab and a bowl rising out of the water.",
    theme: "sand",
    gravity: 1,
    friction: 0.9,
    spawns: [{ x: 420, y: 560 }, { x: 860, y: 560 }],
    solids: [
      { rect: [640, 650, 700, 40] },
      ...both({ poly: [[200, 380], [290, 630], [290, 670], [200, 670]] }),
      ...both({ rect: [380, 300, 170, 22] }),
      { rect: [640, 470, 300, 24] }
    ],
    liquid: { y: 690, kind: "water" },
    overtime: "flood"
  },
  doubletowers: {
    name: "Double Towers",
    blurb: "Two little T-shaped towers that topple when you lean on them.",
    theme: "sand",
    gravity: 1,
    friction: 0.9,
    spawns: [{ x: 250, y: 560 }, { x: 1030, y: 560 }],
    solids: [{ rect: [640, 660, 1000, 80] }],
    props: [
      { rect: [470, 540, 24, 160], density: 0.004, deco: "girder" },
      { rect: [470, 452, 180, 16], density: 0.004, deco: "girder" },
      { rect: [810, 540, 24, 160], density: 0.004, deco: "girder" },
      { rect: [810, 452, 180, 16], density: 0.004, deco: "girder" }
    ],
    liquid: { y: 650, kind: "water" },
    overtime: "flood"
  },
  mexicanstandoff: {
    name: "Mexican Standoff",
    blurb: "Start high on two tall girder towers over a sandbar. Who blinks first?",
    theme: "desert",
    gravity: 1,
    friction: 0.9,
    spawns: [{ x: 400, y: 250 }, { x: 880, y: 250 }],
    solids: [{ rect: [640, 680, 900, 80] }],
    props: [
      { rect: [400, 478, 28, 300], density: 0.006, deco: "girder" },
      { rect: [400, 318, 210, 16], density: 0.005, deco: "girder" },
      { rect: [880, 478, 28, 300], density: 0.006, deco: "girder" },
      { rect: [880, 318, 210, 16], density: 0.005, deco: "girder" }
    ],
    liquid: { y: 670, kind: "water" },
    overtime: "flood"
  },
  pendulum: {
    name: "Pendulum",
    blurb: "A sawblade swings on a chain over a steel pit.",
    theme: "metal",
    gravity: 1,
    friction: 0.9,
    spawns: [{ x: 280, y: 540 }, { x: 1000, y: 540 }],
    solids: [
      { rect: [220, 670, 440, 100] },
      { rect: [1060, 670, 440, 100] },
      ...both({ poly: [[440, 620], [560, 690], [560, 720], [440, 720]] }),
      { rect: [640, 705, 160, 30] },
      ...both({ poly: [[0, 0], [300, 0], [0, 460]] })
    ],
    pendulum: { x: 640, y: 30, len: 470, r: 54, amp: 1.05, period: 3.4 },
    liquid: { y: 760, kind: "water" },
    overtime: "flood",
    meteors: false
  },
  rotor: {
    name: "Rotor",
    blurb: "Start on a slowly spinning platform over a steel basin. Drop in or get dropped.",
    theme: "metal",
    gravity: 1,
    friction: 0.9,
    spawns: [{ x: 470, y: 280 }, { x: 810, y: 280 }],
    solids: [
      ...both(
        { poly: [[0, 300], [110, 520], [0, 720]] },
        { poly: [[0, 720], [110, 520], [300, 640], [300, 720]] },
        { poly: [[300, 640], [640, 690], [640, 720], [300, 720]] }
      )
    ],
    rotor: { x: 640, y: 330, w: 560, h: 22, speed: 0.4 },
    liquid: { y: 760, kind: "water" },
    overtime: "flood",
    meteors: false
  },
  coldcave: {
    name: "Cold Cave",
    blurb: "Icy cave with a spike in the middle. When the water rises, ride the ice floe out the roof.",
    theme: "icecave",
    gravity: 1,
    friction: 0.35,
    spawns: [{ x: 300, y: 560 }, { x: 980, y: 560 }],
    solids: [
      { rect: [640, 690, 1400, 100], ice: true },
      { poly: [[590, 640], [640, 548], [690, 640]], ice: true },
      { rect: [280, 110, 560, 60], ice: true },
      { rect: [1000, 110, 560, 60], ice: true },
      ...both({ poly: [[0, 40], [560, 80], [0, 80]], ice: true }),
      ...both(
        { poly: [[0, 390], [70, 560], [0, 640]], ice: true },
        { poly: [[0, 640], [70, 560], [180, 640]], ice: true }
      )
    ],
    floaters: [{ rect: [900, 626, 200, 20], deco: "ice" }],
    liquid: { y: 760, kind: "water" },
    overtime: "flood",
    meteors: false
  },
  adventureland: {
    name: "Adventure Land",
    blurb: "Christmas ice rink. Two high ledges are only reachable on the ice floes when the flood comes.",
    theme: "xmas",
    gravity: 1,
    friction: 0.3,
    spawns: [{ x: 300, y: 570 }, { x: 980, y: 570 }],
    solids: [
      { rect: [640, 690, 1400, 100], ice: true },
      { rect: [250, 270, 280, 22], ice: true },
      { rect: [1060, 210, 260, 22], ice: true }
    ],
    floaters: [{ rect: [520, 628, 190, 20], deco: "ice" }, { rect: [800, 628, 190, 20], deco: "ice" }],
    liquid: { y: 760, kind: "water" },
    overtime: "flood"
  },
  swimminglesson: {
    name: "Swimming Lesson",
    blurb: "No ground at all: fight on a floating barbell in the pool.",
    theme: "pool",
    gravity: 1,
    friction: 0.9,
    spawns: [{ x: 440, y: 470 }, { x: 840, y: 470 }],
    solids: [{ rect: [640, 760, 1400, 40], deco: "hidden" }],
    floaters: [{ rect: [640, 560, 760, 22], deco: "barbell" }],
    liquid: { y: 580, kind: "water" },
    overtime: "flood",
    meteors: false
  },
  lungs: {
    name: "Lungs",
    blurb: "Motordrome: a two-lobed cage spinning over a pit of acid.",
    theme: "dome",
    gravity: 1,
    friction: 0.9,
    spawns: [{ x: 520, y: 470 }, { x: 760, y: 470 }],
    solids: [],
    dome: { x: 640, y: 380, R: 285, lobes: 2, k: 0.27, speed: 0.22 },
    liquid: { y: 700, kind: "acid" },
    overtime: "acid"
  },
  sawmill: {
    name: "Sawmill",
    blurb: "Motordrome with three lobes, and a sawblade that turns with the cage.",
    theme: "dome",
    gravity: 1,
    friction: 0.9,
    spawns: [{ x: 540, y: 470 }, { x: 740, y: 470 }],
    solids: [],
    dome: { x: 640, y: 380, R: 270, lobes: 3, k: 0.2, speed: -0.2, saw: true },
    liquid: { y: 720, kind: "acid" },
    overtime: "acid"
  },
  clover: {
    name: "Clover",
    blurb: "Four-lobed motordrome. Acid creeps up in sudden death.",
    theme: "dome",
    gravity: 1,
    friction: 0.9,
    spawns: [{ x: 540, y: 470 }, { x: 740, y: 470 }],
    solids: [],
    dome: { x: 640, y: 375, R: 275, lobes: 4, k: 0.17, speed: 0.18 },
    liquid: { y: 720, kind: "acid" },
    overtime: "acid"
  },
  invisible: {
    name: "Invisible Map",
    blurb: "The long-lost glitch map. The ground is there, you just can't see it.",
    theme: "void",
    gravity: 1,
    friction: 0.9,
    spawns: [{ x: 330, y: 500 }, { x: 950, y: 500 }],
    solids: [
      { rect: [640, 620, 880, 120] },
      ...both({ poly: [[110, 690], [200, 560], [200, 690]] }),
      { poly: [[540, 560], [640, 500], [740, 560]] },
      ...both({ rect: [330, 380, 180, 18] })
    ],
    liquid: { y: 640, kind: "water" },
    overtime: "flood"
  }
};

/** Outline of a spinning motordome cage: r(θ) = R(1 + k·cos(nθ)), sampled into wall segments. */
export function domeSegments(d, samples = 64, thick = 26) {
  const segs = [];
  const r = (a) => d.R * (1 + d.k * Math.cos(d.lobes * a));
  for (let i = 0; i < samples; i++) {
    const a0 = (i / samples) * Math.PI * 2;
    const a1 = ((i + 1) / samples) * Math.PI * 2;
    const p0 = [Math.cos(a0) * (r(a0) + thick / 2), Math.sin(a0) * (r(a0) + thick / 2)];
    const p1 = [Math.cos(a1) * (r(a1) + thick / 2), Math.sin(a1) * (r(a1) + thick / 2)];
    const len = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) + 4;
    segs.push({ x: (p0[0] + p1[0]) / 2, y: (p0[1] + p1[1]) / 2, len, thick, angle: Math.atan2(p1[1] - p0[1], p1[0] - p0[0]) });
  }
  return segs;
}
