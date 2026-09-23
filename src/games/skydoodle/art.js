/**
 * SKYDOODLE — pixel art: platforms per type, the doodler, enemies, props and tiered skies.
 */
import { sprite, makeCanvas, mulberry32, shade, rgba, starfield } from "/src/core/gfx.js";

// ---------------------------------------------------------------- sprites
const DOODLER = [
  "....GGGGGG......",
  "..GGGGGGGGGG....",
  ".GGGhhGGGGGGG...",
  ".GGhWWGGWWGGG...",
  "GGGhWKGGWKGGGSSS",
  "GGGGWWGGWWGGGSSS",
  "GGGGGGGGGGGGGSSg",
  "GGGgGGGGGGGGGg..",
  "GGGGGGGGGGGGGG..",
  "GbGbGbGbGbGbGG..",
  "GGGGGGGGGGGGGG..",
  ".gGGGGGGGGGGg...",
  "..gggggggggg....",
  "..LL.LL..LL.LL..",
  "..LL.LL..LL.LL..",
  ".LLL.LL..LL.LLL."
];
const DOODLER_PAL = { G: "#8bd13a", g: "#4f8a1c", h: "#c6f07a", W: "#ffffff", K: "#101010", S: "#7cc234", b: "#5d9e22", L: "#3f6b14" };

const MONSTER_A = [
  "..Y..........Y..",
  "..YY........YY..",
  "...RRRRRRRRRR...",
  "..RRRRRRRRRRRR..",
  ".RRWWWRRRRWWWRR.",
  ".RRWKWRRRRWKWRR.",
  "RRRWWWRRRRWWWRRR",
  "RRRRRRRRRRRRRRRR",
  "RrRRKKKKKKKKRRrR",
  "RRRRKWKWKWKKRRRR",
  "rRRRRRRRRRRRRRRr",
  ".rRRRRRRRRRRRRr.",
  "..rR.rRRRRr.Rr..",
  "..r...rrrr...r.."
];
const MONSTER_B = [...MONSTER_A.slice(0, 12), ".rR..rRRRRr..Rr.", ".r....rrrr....r."];
const MONSTER_PAL = { Y: "#ffd24a", R: "#e8433b", r: "#9e1f1a", W: "#ffffff", K: "#1a0606" };

const SPRING = ["GGGGGGGGGG", ".S......S.", "..SSSSSS..", ".S......S.", "..SSSSSS..", ".S......S.", "DDDDDDDDDD"];
const SPRING_PAL = { G: "#ffd24a", S: "#b8c2cc", D: "#5a6470" };
const TRAMP = ["PPPPPPPPPPPPPP", "pPPPPPPPPPPPPp", ".M..........M.", ".M..........M.", "MM..........MM"];
const TRAMP_PAL = { P: "#ff5fa2", p: "#b3336b", M: "#64748b" };

const ICON = {
  shield: [
    "..BBBB..",
    ".BbbbbB.",
    "BbWbbbbB",
    "BbbbbbbB",
    "BbbbbbbB",
    ".BbbbbB.",
    "..BbbB..",
    "...BB..."
  ],
  propeller: [
    "RRR..RRR",
    "...YY...",
    "..OOOO..",
    ".OOOOOO.",
    ".OoOOoO.",
    ".OOOOOO.",
    "........",
    "........"
  ],
  jetpack: [
    ".MMMMMM.",
    ".MmMMmM.",
    ".MMMMMM.",
    ".MmMMmM.",
    ".MMMMMM.",
    "..F..F..",
    ".FFF.FF.",
    "..F..F.."
  ],
  repellent: [
    "...CC...",
    "...cc...",
    "..GGGG..",
    ".GGgGGG.",
    ".GGGGgG.",
    ".GgGGGG.",
    ".GGGGGG.",
    "..GGGG.."
  ]
};
const ICON_PAL = {
  B: "#38bdf8", b: "#7dd3fc", W: "#ffffff",
  R: "#ef4444", Y: "#ffd24a", O: "#f59e0b", o: "#b45309",
  M: "#64748b", m: "#334155", F: "#ff7700",
  C: "#e2e8f0", c: "#94a3b8", G: "#39ff14", g: "#1f9e0a"
};

export function buildSkyArt() {
  return {
    doodler: sprite(DOODLER, DOODLER_PAL, 2),
    monster: [sprite(MONSTER_A, MONSTER_PAL, 2), sprite(MONSTER_B, MONSTER_PAL, 2)],
    spring: sprite(SPRING, SPRING_PAL, 2),
    tramp: sprite(TRAMP, TRAMP_PAL, 2),
    icons: Object.fromEntries(Object.entries(ICON).map(([k, rows]) => [k, sprite(rows, ICON_PAL, 2)])),
    platforms: new Map(),
    stars: starfield(480, 720, { count: 140, seed: 9 }),
    starsFar: starfield(480, 720, { count: 220, seed: 19, colors: ["#8fa3c7", "#6f7fa6"] })
  };
}

// ---------------------------------------------------------------- platforms
export function platformSprite(art, type, width) {
  const key = `${type}:${width}`;
  if (art.platforms.has(key)) return art.platforms.get(key);
  const h = 18;
  const { c, ctx } = makeCanvas(width, h);
  const rand = mulberry32(width * 7 + type.length * 131);
  const px = (x, y, w, hh, col) => {
    ctx.fillStyle = col;
    ctx.fillRect(x, y, w, hh);
  };
  if (type === "static") {
    // Floating turf ledge: grass cap over dirt with pebbles
    px(0, 4, width, 12, "#7a4b24");
    for (let i = 0; i < width * 1.2; i++) px(Math.floor(rand() * width), 6 + Math.floor(rand() * 9), 1, 1, rand() < 0.5 ? "#9a6433" : "#55331a");
    px(0, 0, width, 6, "#4fbf3a");
    px(0, 0, width, 2, "#8be36a");
    for (let x = 1; x < width; x += 3) px(x, 6, 2, 1 + Math.floor(rand() * 3), "#3a9a2a");
    px(0, 14, width, 2, "#3e2410");
    px(2, 16, width - 4, 2, "#2a180a");
  } else if (type === "moving") {
    // Hover plate: steel deck, cyan thruster strip
    px(0, 2, width, 10, "#5b6b82");
    px(0, 2, width, 2, "#9fb3cc");
    px(0, 10, width, 2, "#2c3646");
    for (let x = 6; x < width - 4; x += 12) px(x, 5, 2, 2, "#c9d6e6");
    px(6, 12, width - 12, 3, "#38bdf8");
    px(10, 15, width - 20, 2, "rgba(56,189,248,0.5)");
  } else if (type === "breakable") {
    // Rotten planks with a crack
    for (let x = 0; x < width; x += 11) {
      const col = rand() < 0.5 ? "#a16a2c" : "#8a5520";
      px(x, 2, 10, 11, col);
      px(x, 2, 10, 1, shade(col, 0.25));
      px(x + 9, 2, 1, 11, shade(col, -0.35));
      px(x + 2, 6, 1, 1, "#3a2410");
    }
    ctx.strokeStyle = "#2a1606";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(width * 0.3, 2);
    ctx.lineTo(width * 0.38, 7);
    ctx.lineTo(width * 0.33, 13);
    ctx.stroke();
  } else if (type === "disappearing") {
    // Glassy crystal slab
    px(0, 2, width, 11, "rgba(168, 85, 247, 0.75)");
    px(0, 2, width, 2, "rgba(233, 213, 255, 0.95)");
    px(0, 11, width, 2, "rgba(88, 28, 135, 0.9)");
    for (let x = 4; x < width; x += 9) px(x, 4, 2, 5, "rgba(255,255,255,0.35)");
  } else if (type === "spike") {
    px(0, 9, width, 7, "#475569");
    px(0, 9, width, 1, "#94a3b8");
    for (let x = 0; x < width - 7; x += 10) {
      ctx.fillStyle = "#e2e8f0";
      ctx.beginPath();
      ctx.moveTo(x, 9);
      ctx.lineTo(x + 5, 0);
      ctx.lineTo(x + 10, 9);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#94a3b8";
      ctx.beginPath();
      ctx.moveTo(x + 5, 0);
      ctx.lineTo(x + 10, 9);
      ctx.lineTo(x + 6, 9);
      ctx.closePath();
      ctx.fill();
    }
  } else if (type === "blast") {
    // TNT crate: red with hazard stripes
    px(0, 1, width, 13, "#c9302c");
    px(0, 1, width, 2, "#f06a63");
    px(0, 12, width, 2, "#7a1512");
    for (let x = -10; x < width; x += 12) {
      ctx.fillStyle = "#ffd24a";
      ctx.beginPath();
      ctx.moveTo(x, 14);
      ctx.lineTo(x + 5, 14);
      ctx.lineTo(x + 11, 1);
      ctx.lineTo(x + 6, 1);
      ctx.closePath();
      ctx.fill();
    }
    px(width / 2 - 13, 4, 26, 7, "#1a0606");
    ctx.fillStyle = "#ffd24a";
    ctx.font = '6px "Press Start 2P", monospace';
    ctx.fillText("TNT", width / 2 - 9, 10);
  }
  art.platforms.set(key, c);
  return c;
}

// ---------------------------------------------------------------- skies
const TIER_SKY = {
  NOTEBOOK: ["#0b1422", "#0e1b2e"],
  SKY: ["#2b6fb8", "#8fd0ff"],
  SUNSET: ["#2b0f3f", "#ff8c42"],
  NIGHT: ["#030712", "#1e1b4b"],
  SPACE: ["#010208", "#0b0620"]
};
export const TIER_ORDER = ["NOTEBOOK", "SKY", "SUNSET", "NIGHT", "SPACE"];

function cloud(ctx, x, y, s, col, shadeCol) {
  ctx.fillStyle = shadeCol;
  ctx.beginPath();
  ctx.ellipse(x, y + 6 * s, 30 * s, 9 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.ellipse(x - 14 * s, y, 16 * s, 11 * s, 0, 0, Math.PI * 2);
  ctx.ellipse(x + 2 * s, y - 6 * s, 18 * s, 14 * s, 0, 0, Math.PI * 2);
  ctx.ellipse(x + 18 * s, y + 1 * s, 14 * s, 10 * s, 0, 0, Math.PI * 2);
  ctx.fill();
}

/** Full-screen background for a tier; `cam` is the camera height (world units climbed). */
export function drawSky(ctx, art, tier, cam, W, H, t) {
  const [top, bot] = TIER_SKY[tier] || TIER_SKY.SKY;
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, top);
  g.addColorStop(1, bot);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  const wrap = (v, m) => ((v % m) + m) % m;

  if (tier === "NOTEBOOK") {
    // Blueprint paper: ruled lines, margin, pencil doodles drifting past
    ctx.strokeStyle = "rgba(56, 189, 248, 0.14)";
    ctx.lineWidth = 1;
    const off = wrap(cam, 24);
    for (let y = off - 24; y < H; y += 24) {
      ctx.beginPath();
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(W, y + 0.5);
      ctx.stroke();
    }
    ctx.strokeStyle = "rgba(244, 63, 94, 0.45)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(44, 0);
    ctx.lineTo(44, H);
    ctx.stroke();
    // Binder holes
    for (let y = wrap(cam * 1, 180) - 180; y < H; y += 180) {
      ctx.fillStyle = "#050a12";
      ctx.beginPath();
      ctx.arc(18, y + 90, 7, 0, Math.PI * 2);
      ctx.fill();
    }
    // Pencil doodles (stars, spirals, arrows)
    ctx.strokeStyle = "rgba(186, 230, 253, 0.16)";
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 6; i++) {
      const y = wrap(cam * 0.6 + i * 137, H + 120) - 60;
      const x = 80 + ((i * 97) % 340);
      ctx.beginPath();
      if (i % 3 === 0) {
        for (let k = 0; k < 5; k++) {
          const a = -Math.PI / 2 + (k * 4 * Math.PI) / 5;
          ctx[k ? "lineTo" : "moveTo"](x + Math.cos(a) * 14, y + Math.sin(a) * 14);
        }
        ctx.closePath();
      } else if (i % 3 === 1) {
        for (let a = 0; a < Math.PI * 5; a += 0.3) ctx[a ? "lineTo" : "moveTo"](x + Math.cos(a) * a * 2, y + Math.sin(a) * a * 2);
      } else {
        ctx.moveTo(x, y + 12);
        ctx.lineTo(x, y - 12);
        ctx.lineTo(x - 6, y - 5);
        ctx.moveTo(x, y - 12);
        ctx.lineTo(x + 6, y - 5);
      }
      ctx.stroke();
    }
    return;
  }

  if (tier === "SKY" || tier === "SUNSET") {
    if (tier === "SUNSET") {
      const sy = 470 + wrap(cam * 0.05, 40);
      const sun = ctx.createRadialGradient(W * 0.7, sy, 10, W * 0.7, sy, 160);
      sun.addColorStop(0, "rgba(255, 230, 160, 0.95)");
      sun.addColorStop(0.25, "rgba(255, 160, 80, 0.5)");
      sun.addColorStop(1, "rgba(255, 120, 60, 0)");
      ctx.fillStyle = sun;
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#ffe8b0";
      ctx.beginPath();
      ctx.arc(W * 0.7, sy, 42, 0, Math.PI * 2);
      ctx.fill();
    } else {
      const sun = ctx.createRadialGradient(W * 0.8, 90, 8, W * 0.8, 90, 120);
      sun.addColorStop(0, "rgba(255, 255, 230, 0.9)");
      sun.addColorStop(1, "rgba(255, 255, 230, 0)");
      ctx.fillStyle = sun;
      ctx.fillRect(0, 0, W, 260);
    }
    const col = tier === "SKY" ? "#ffffff" : "#ffd3b0";
    const sh = tier === "SKY" ? "#c9e4f7" : "#b0607a";
    // Far clouds (slow) then near clouds (faster, bigger)
    for (let i = 0; i < 5; i++) {
      const y = wrap(cam * 0.25 + i * 170, H + 120) - 60;
      cloud(ctx, 60 + ((i * 131) % 380), y, 0.8, rgba(col, 0.55), rgba(sh, 0.45));
    }
    for (let i = 0; i < 3; i++) {
      const y = wrap(cam * 0.55 + i * 260 + 90, H + 160) - 80;
      cloud(ctx, 40 + ((i * 211) % 420), y, 1.5, rgba(col, 0.85), rgba(sh, 0.7));
    }
    // Birds
    if (tier === "SKY") {
      ctx.strokeStyle = "rgba(20, 40, 70, 0.6)";
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 3; i++) {
        const bx = wrap(t * 30 + i * 150, W + 60) - 30;
        const by = wrap(cam * 0.4 + i * 90, H) ;
        const f = Math.sin(t * 8 + i) * 3;
        ctx.beginPath();
        ctx.moveTo(bx - 6, by - f);
        ctx.lineTo(bx, by);
        ctx.lineTo(bx + 6, by - f);
        ctx.stroke();
      }
    }
    return;
  }

  // NIGHT / SPACE: parallax starfields
  const s1 = wrap(cam * 0.1, H);
  const s2 = wrap(cam * 0.3, H);
  ctx.drawImage(art.starsFar, 0, s1 - H);
  ctx.drawImage(art.starsFar, 0, s1);
  ctx.drawImage(art.stars, 0, s2 - H);
  ctx.drawImage(art.stars, 0, s2);
  if (tier === "NIGHT") {
    ctx.fillStyle = "#f4f1dc";
    ctx.beginPath();
    ctx.arc(W * 0.78, 120, 30, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(200, 196, 170, 0.6)";
    ctx.beginPath();
    ctx.arc(W * 0.78 - 8, 112, 6, 0, Math.PI * 2);
    ctx.arc(W * 0.78 + 9, 128, 4, 0, Math.PI * 2);
    ctx.fill();
    const halo = ctx.createRadialGradient(W * 0.78, 120, 30, W * 0.78, 120, 110);
    halo.addColorStop(0, "rgba(244, 241, 220, 0.25)");
    halo.addColorStop(1, "rgba(244, 241, 220, 0)");
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, W, 300);
  } else {
    // Nebula + ringed planet drifting past
    const neb = ctx.createRadialGradient(W * 0.3, 360, 20, W * 0.3, 360, 260);
    neb.addColorStop(0, "rgba(139, 92, 246, 0.28)");
    neb.addColorStop(0.5, "rgba(236, 72, 153, 0.12)");
    neb.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = neb;
    ctx.fillRect(0, 0, W, H);
    const py = wrap(cam * 0.08, H + 300) - 150;
    ctx.fillStyle = "#7c3aed";
    ctx.beginPath();
    ctx.arc(W * 0.75, py, 40, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#a78bfa";
    ctx.beginPath();
    ctx.arc(W * 0.75 - 10, py - 10, 28, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(244, 228, 255, 0.7)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(W * 0.75, py, 70, 14, -0.3, 0, Math.PI * 2);
    ctx.stroke();
  }
}
