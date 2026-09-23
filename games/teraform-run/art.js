/**
 * TERAFORM RUN — biome art: parallax scenery, textured ground, pixel sprites.
 * Scenery layers are generated once per biome as seamless 1440px strips (integer-frequency
 * sine ridges wrap perfectly), then scrolled at different speeds.
 */
import { sprite, makeCanvas, mulberry32, shade, rgba } from "/shared/gfx.js";

export const W = 1440;

// ---------------------------------------------------------------- palettes
export const BIOME_ART = [
  { key: "desert", skyTop: "#f19a5b", skyBot: "#fde3b5", sun: "#fff3cf", far: "#d98b5f", mid: "#c77747", near: "#9c5832",
    groundTop: "#f0c77c", ground: "#d9a45c", groundDark: "#a8743a", cloud: "#fff4e0", weather: null,
    obstacle: { family: "plant", X: "#4f8a3a", x: "#2f5c22", h: "#86c164", f: "#ff6b9a" },
    ptero: { X: "#8a5a3a", x: "#5c3a24", b: "#f0b34a" }, coin: "#ffd24a" },
  { key: "tundra", skyTop: "#7fa9d6", skyBot: "#e9f3fb", sun: "#ffffff", far: "#7f9dbf", mid: "#6d8eb2", near: "#dce9f5",
    groundTop: "#ffffff", ground: "#dfeaf5", groundDark: "#a9c0d8", cloud: "#ffffff", weather: "snow",
    obstacle: { family: "crystal", X: "#9fe3ff", x: "#4f9cc9", h: "#ffffff" },
    ptero: { X: "#e9f1f8", x: "#9fb4c9", b: "#f0b34a" }, coin: "#ffe27a" },
  { key: "volcanic", skyTop: "#1a0503", skyBot: "#6b1d0c", sun: "#ff8a3d", far: "#2e0c07", mid: "#401108", near: "#1f0805",
    groundTop: "#5a2a20", ground: "#2e1a16", groundDark: "#160c0a", cloud: "#3a2622", weather: "embers",
    obstacle: { family: "crystal", X: "#2b1d2a", x: "#120a12", h: "#ff5a1f" },
    ptero: { X: "#3a1a14", x: "#1a0a08", b: "#ff8a3d" }, coin: "#ffb347" },
  { key: "jungle", skyTop: "#5cb89a", skyBot: "#dcf3cf", sun: "#fffbe0", far: "#3d8c68", mid: "#2b6b4b", near: "#1b4a33",
    groundTop: "#5cbf3f", ground: "#6b4526", groundDark: "#3e2615", cloud: "#f2fff0", weather: "leaves",
    obstacle: { family: "plant", X: "#8e2f4f", x: "#4d1429", h: "#e0608c", f: "#ffd24a" },
    ptero: { X: "#2f6a4a", x: "#1a3f2b", b: "#ffcc4d" }, coin: "#ffd24a" },
  { key: "cyber", skyTop: "#07021a", skyBot: "#2b0b52", sun: "#ff4dd8", far: "#150a33", mid: "#1d0f45", near: "#0c0624",
    groundTop: "#00ffcc", ground: "#0b0820", groundDark: "#05030f", cloud: "#2a1655", weather: "rain",
    obstacle: { family: "crystal", X: "#2a1a66", x: "#150b3a", h: "#00ffcc" },
    ptero: { X: "#1a1040", x: "#0a0620", b: "#ff4dd8" }, coin: "#00ffcc" },
  { key: "void", skyTop: "#000000", skyBot: "#170a2b", sun: "#c9a6ff", far: "#1a1030", mid: "#221540", near: "#0e0918",
    groundTop: "#7c4dff", ground: "#15101f", groundDark: "#07050c", cloud: "#1d1433", weather: "motes",
    obstacle: { family: "crystal", X: "#5a3aa8", x: "#2a1a55", h: "#e0ccff" },
    ptero: { X: "#2a1a3a", x: "#140a1d", b: "#c9a6ff" }, coin: "#e0ccff" }
];

// ---------------------------------------------------------------- sprites
const DINO_PAL = { X: "#4caf50", x: "#2e7d32", h: "#8bd88e", W: "#ffffff", K: "#101010", r: "#7a1f1f", p: "#ffb300", a: "#3d8f41", f: "#1f4f22" };
const DINO_TOP = [
  "......XXXXh",
  ".....XXXXXX",
  ".....XWKXXX",
  ".....XXXXXX",
  ".....XXXrrr",
  "p...XXXXx..",
  "pp.XXXXXXa.",
  "XXXXXhXXXa.",
  "xXXXXXXXx..",
  ".xXXXXXx..."
];
const DINO_RUN_A = [...DINO_TOP, "..XX...X...", "..ff...ff.."];
const DINO_RUN_B = [...DINO_TOP, "...X..XX...", "...ff.ff..."];
const DINO_JUMP = [...DINO_TOP, "..XX..XX...", "..ff..ff..."];
const DUCK_TOP = [
  "..........XXXXh",
  "p...XXXXXXXWKXX",
  "ppXXXXXhXXXXXXX",
  "XXXXXXXXXXXXrrr",
  "xXXXXXXXXXXx..."
];
const DINO_DUCK_A = [...DUCK_TOP, ".xXX...XXx.....", "..ff....ff....."];
const DINO_DUCK_B = [...DUCK_TOP, "..XX....XX.....", "...ff....ff...."];

const PTERO_A = [
  "...X........X...",
  "...XX......XX...",
  "....XX....XX....",
  "....XXX..XXX....",
  "hKXXXXXXXXXXXx..",
  "bbXXXXXXXXXXxxx.",
  "...xXXXXXXxx..xx",
  "......xx........",
  "................"
];
const PTERO_B = [
  "................",
  "................",
  "................",
  "....XXXXXXXXX...",
  "hKXXXXXXXXXXXx..",
  "bbXXXXXXXXXXxxx.",
  "...XXx...xXX..xx",
  "..XX.......XX...",
  ".XX.........XX.."
];

const PLANT = {
  small: [
    "...XX...",
    "...Xh...",
    "X..XX...",
    "Xh.XX..X",
    "XX.XX.hX",
    "XXXXX.XX",
    "..XXXXXX",
    "...XX...",
    "...Xh...",
    "...XX...",
    "...XX...",
    "..xxxx.."
  ],
  tall: [
    "..XfX..",
    ".XXhXX.",
    ".XXXXX.",
    "..XXX..",
    "..XhX..",
    "..XXX..",
    "X.XXX..",
    "XhXXX..",
    "XXXXX.X",
    "..XXXhX",
    "..XXXXX",
    "..XhX..",
    "..XXX..",
    "..XXX..",
    "..XXX..",
    "..XXX..",
    ".xxxxx."
  ],
  triple: [
    "........Xf.......",
    ".......XhX.......",
    "..XX...XXX....XX.",
    "..Xh.X.XXX.X..Xh.",
    "X.XX.XhXXX.X..XX.",
    "XhXX.XXXXXXX.XXX.",
    "XXXX..XXXX...X.XX",
    "..XX...XXX.....XX",
    "..Xh...XhX..X..Xh",
    "..XX...XXX..XhXXX",
    "..XX...XXX...XXXX",
    "..XX...XXX.....XX",
    "..XX...XXX.....XX",
    ".xxxx.xxxxx...xxx"
  ]
};
const CRYSTAL = {
  small: [
    "....h...",
    "...hX...",
    "...hX...",
    "..hXX...",
    "..hXX.h.",
    "..hXXhX.",
    ".hXXXhX.",
    ".hXXXXX.",
    "hXXxXXXx",
    "hXXxXXXx",
    "XXXxxXXx",
    "xxxxxxxx"
  ],
  tall: [
    "...h...",
    "...h...",
    "..hX...",
    "..hX...",
    "..hXX..",
    "..hXX..",
    ".hXXX..",
    ".hXXX..",
    ".hXXXx.",
    ".hXXXx.",
    "hXXXXx.",
    "hXXXXxh",
    "hXXXXxX",
    "XXXXXxX",
    "XXXXXxX",
    "XXXxxxx",
    "xxxxxxx"
  ],
  triple: [
    "........h........",
    ".......hX........",
    "..h....hX.....h..",
    "..hX...hXX...hX..",
    ".hXX...hXX...hX..",
    ".hXX..hXXX..hXXx.",
    ".hXXx.hXXXx.hXXx.",
    "hXXXx.hXXXx.hXXXx",
    "hXXXxhXXXXxhXXXXx",
    "hXXXxhXXXXxhXXXXx",
    "XXXXxXXXXXxXXXXXx",
    "XXXxxXXXXxxXXXxxx",
    "xxxxxxxxxxxxxxxxx",
    "xxxxxxxxxxxxxxxxx"
  ]
};

const COIN = [
  "..YYYY..",
  ".YyyyyY.",
  "YyWYYyyY",
  "YyWYyyyY",
  "YyYYyyyY",
  "YyyyyyyY",
  ".YyyyyY.",
  "..YYYY.."
];

export function buildRunnerArt() {
  const art = {
    dino: {
      runA: sprite(DINO_RUN_A, DINO_PAL, 4),
      runB: sprite(DINO_RUN_B, DINO_PAL, 4),
      jump: sprite(DINO_JUMP, DINO_PAL, 4),
      duckA: sprite(DINO_DUCK_A, DINO_PAL, 4),
      duckB: sprite(DINO_DUCK_B, DINO_PAL, 4)
    },
    biomes: BIOME_ART.map((b, i) => buildBiome(b, i))
  };
  return art;
}

function buildBiome(b, i) {
  const fam = b.obstacle.family === "plant" ? PLANT : CRYSTAL;
  const opal = { X: b.obstacle.X, x: b.obstacle.x, h: b.obstacle.h, f: b.obstacle.f || b.obstacle.h };
  return {
    obstacles: {
      cactusSmall: sprite(fam.small, opal, 3),
      cactusTall: sprite(fam.tall, opal, 3),
      cactusTriple: sprite(fam.triple, opal, 3)
    },
    ptero: [
      sprite(PTERO_A, { X: b.ptero.X, x: b.ptero.x, b: b.ptero.b, h: shade(b.ptero.X, 0.35), K: "#101010" }, 3),
      sprite(PTERO_B, { X: b.ptero.X, x: b.ptero.x, b: b.ptero.b, h: shade(b.ptero.X, 0.35), K: "#101010" }, 3)
    ],
    coin: sprite(COIN, { Y: shade(b.coin, -0.25), y: b.coin, W: "#ffffff" }, 2),
    far: buildLayer(b, "far", 1000 + i),
    mid: buildLayer(b, "mid", 2000 + i),
    near: buildLayer(b, "near", 3000 + i),
    ground: buildGround(b, 4000 + i)
  };
}

// ---------------------------------------------------------------- scenery
const GROUND_Y = 440;

function ridgeHeights(seed, base, amp, freqs) {
  const rand = mulberry32(seed);
  const phases = freqs.map(() => rand() * Math.PI * 2);
  const weights = freqs.map(() => 0.5 + rand() * 0.5);
  const tot = weights.reduce((a, c) => a + c, 0);
  const hs = new Float32Array(W);
  for (let x = 0; x < W; x++) {
    let v = 0;
    freqs.forEach((k, j) => {
      v += weights[j] * (0.5 + 0.5 * Math.sin((2 * Math.PI * k * x) / W + phases[j]));
    });
    hs[x] = base - (v / tot) * amp;
  }
  return hs;
}

function fillRidge(ctx, hs, color, bottom = GROUND_Y) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, bottom);
  for (let x = 0; x < W; x += 2) ctx.lineTo(x, Math.round(hs[x]));
  ctx.lineTo(W, Math.round(hs[0]));
  ctx.lineTo(W, bottom);
  ctx.closePath();
  ctx.fill();
}

// Rim-light the sunward (left-facing) slopes one shade lighter
function rimLight(ctx, hs, color) {
  ctx.fillStyle = color;
  for (let x = 1; x < W; x++) {
    if (hs[x] < hs[x - 1]) ctx.fillRect(x, Math.round(hs[x]), 1, 3);
  }
}

// Props that straddle the strip's edges are drawn on a 3×-wide scratch canvas, then the
// overflow on either side is folded back so the strip tiles with no visible seam.
function foldSeamless(big, hazeColor) {
  const { c, ctx } = makeCanvas(W, GROUND_Y);
  ctx.drawImage(big, 0, 0);
  ctx.drawImage(big, -W, 0);
  ctx.drawImage(big, -2 * W, 0);
  if (hazeColor) {
    const haze = ctx.createLinearGradient(0, 150, 0, GROUND_Y);
    haze.addColorStop(0, rgba(hazeColor, 0));
    haze.addColorStop(1, rgba(hazeColor, 0.35));
    ctx.fillStyle = haze;
    ctx.globalCompositeOperation = "source-atop";
    ctx.fillRect(0, 0, W, GROUND_Y);
    ctx.globalCompositeOperation = "source-over";
  }
  return c;
}

function buildLayer(b, depth, seed) {
  const big = makeCanvas(W * 3, GROUND_Y);
  const ctx = big.ctx;
  ctx.translate(W, 0);
  const rand = mulberry32(seed);
  const key = b.key;

  if (depth === "far") {
    const hs = ridgeHeights(seed, 330, key === "cyber" ? 60 : 200, [2, 3, 5, 9]);
    if (key === "cyber") {
      // Distant megacity skyline
      ctx.fillStyle = b.far;
      for (let x = 0; x < W; ) {
        const bw = 30 + Math.floor(rand() * 60);
        const bh = 90 + Math.floor(rand() * 200);
        ctx.fillRect(x, GROUND_Y - 60 - bh, bw - 4, bh + 60);
        for (let wy = GROUND_Y - 60 - bh + 8; wy < GROUND_Y - 70; wy += 10) {
          for (let wx = x + 4; wx < x + bw - 8; wx += 8) {
            if (rand() < 0.28) {
              ctx.fillStyle = rand() < 0.5 ? "rgba(255,77,216,0.55)" : "rgba(0,255,204,0.45)";
              ctx.fillRect(wx, wy, 3, 4);
            }
          }
        }
        ctx.fillStyle = b.far;
        x += bw;
      }
    } else if (key === "void") {
      // Floating islands
      for (let i = 0; i < 9; i++) {
        const ix = (i / 9) * W + rand() * 80;
        const iy = 90 + rand() * 180;
        const iw = 40 + rand() * 70;
        ctx.fillStyle = b.far;
        ctx.beginPath();
        ctx.moveTo(ix - iw / 2, iy);
        ctx.lineTo(ix + iw / 2, iy);
        ctx.lineTo(ix + iw * 0.15, iy + iw * 0.7);
        ctx.lineTo(ix - iw * 0.2, iy + iw * 0.5);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "rgba(201,166,255,0.35)";
        ctx.fillRect(ix - iw / 2, iy, iw, 2);
      }
      fillRidge(ctx, ridgeHeights(seed + 1, 420, 60, [3, 7]), shade(b.far, -0.2));
    } else {
      fillRidge(ctx, hs, b.far);
      rimLight(ctx, hs, shade(b.far, 0.12));
      if (key === "tundra") {
        // Snow caps hugging the peaks (thicker the higher the summit, ragged lower edge)
        for (let x = 0; x < W; x++) {
          const top = Math.round(hs[x]);
          if (top >= 250) continue;
          const depth = Math.min(30, (250 - top) * 0.45) + Math.round(Math.sin(x * 0.9) * 2 + Math.sin(x * 0.23) * 3);
          ctx.fillStyle = "#f4f9ff";
          ctx.fillRect(x, top, 1, Math.max(2, depth));
          ctx.fillStyle = "#c9dbee";
          ctx.fillRect(x, top + Math.max(2, depth), 1, 2);
        }
      }
      if (key === "volcanic") {
        // Volcano cones with glowing craters
        for (let i = 0; i < 3; i++) {
          const vx = 200 + i * 480 + rand() * 60;
          ctx.fillStyle = b.far;
          ctx.beginPath();
          ctx.moveTo(vx - 170, GROUND_Y);
          ctx.lineTo(vx - 28, 150);
          ctx.lineTo(vx + 28, 150);
          ctx.lineTo(vx + 170, GROUND_Y);
          ctx.closePath();
          ctx.fill();
          const g = ctx.createRadialGradient(vx, 150, 0, vx, 150, 70);
          g.addColorStop(0, "rgba(255,140,60,0.8)");
          g.addColorStop(1, "rgba(255,90,31,0)");
          ctx.fillStyle = g;
          ctx.fillRect(vx - 70, 80, 140, 140);
          // Lava streaks
          ctx.fillStyle = "rgba(255,90,31,0.6)";
          for (let s = 0; s < 4; s++) {
            let lx = vx - 20 + s * 13;
            for (let y = 152; y < 300 + rand() * 80; y += 2) {
              lx += (rand() - 0.5) * 2 + (s - 1.5) * 0.25;
              ctx.fillRect(Math.round(lx), y, 2, 2);
            }
          }
        }
      }
    }
    // Atmospheric haze toward the horizon is applied after folding
    return foldSeamless(big.c, b.skyBot);
  }

  if (depth === "mid") {
    const hs = ridgeHeights(seed, 395, 110, [3, 4, 7, 11]);
    fillRidge(ctx, hs, b.mid);
    rimLight(ctx, hs, shade(b.mid, 0.15));
    // Surface texture
    for (let i = 0; i < 1800; i++) {
      const x = Math.floor(rand() * W);
      const y = Math.floor(hs[x] + 4 + rand() * (GROUND_Y - hs[x]));
      ctx.fillStyle = rand() < 0.5 ? shade(b.mid, 0.08) : shade(b.mid, -0.12);
      ctx.fillRect(x, y, 2, 1);
    }
    if (key === "desert") {
      // Dune wind ripples
      ctx.strokeStyle = shade(b.mid, 0.18);
      for (let i = 0; i < 40; i++) {
        const x = rand() * W;
        const y = hs[Math.floor(x)] + 10 + rand() * 30;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.quadraticCurveTo(x + 20, y - 3, x + 40, y);
        ctx.stroke();
      }
    } else if (key === "tundra") {
      // Pine forest silhouettes
      for (let i = 0; i < 70; i++) {
        const x = Math.floor(rand() * W);
        const y = hs[x] + 6;
        const h = 22 + rand() * 30;
        ctx.fillStyle = "#3f5f7a";
        ctx.beginPath();
        ctx.moveTo(x, y - h);
        ctx.lineTo(x - h * 0.32, y);
        ctx.lineTo(x + h * 0.32, y);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "#f4f9ff";
        ctx.fillRect(x - 2, y - h + 2, 4, 3);
        ctx.fillRect(x - 5, y - h * 0.55, 10, 2);
      }
    } else if (key === "jungle") {
      // Canopy trees
      for (let i = 0; i < 36; i++) {
        const x = Math.floor(rand() * W);
        const y = hs[x] + 4;
        const r = 16 + rand() * 20;
        ctx.fillStyle = "#3a2615";
        ctx.fillRect(x - 2, y - r, 4, r + 6);
        ctx.fillStyle = shade(b.mid, -0.15);
        ctx.beginPath();
        ctx.arc(x, y - r, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = shade(b.mid, 0.12);
        ctx.beginPath();
        ctx.arc(x - r * 0.3, y - r * 1.25, r * 0.5, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (key === "volcanic") {
      // Lava rivers
      ctx.fillStyle = "rgba(255,90,31,0.7)";
      for (let i = 0; i < 6; i++) {
        let x = rand() * W;
        for (let y = hs[Math.floor(x)] + 4; y < GROUND_Y; y += 2) {
          x += (rand() - 0.5) * 3;
          ctx.fillRect(Math.round(x), Math.round(y), 3, 2);
        }
      }
    } else if (key === "cyber") {
      // Mid-rise towers with neon signs
      for (let x = 0; x < W; ) {
        const bw = 40 + Math.floor(rand() * 50);
        const bh = 60 + Math.floor(rand() * 110);
        ctx.fillStyle = b.mid;
        ctx.fillRect(x, GROUND_Y - bh, bw - 6, bh);
        ctx.fillStyle = "rgba(255,255,255,0.05)";
        ctx.fillRect(x, GROUND_Y - bh, 3, bh);
        if (rand() < 0.5) {
          const sc = rand() < 0.5 ? "#ff4dd8" : "#00ffcc";
          ctx.fillStyle = sc;
          ctx.fillRect(x + 6, GROUND_Y - bh + 12, bw - 18, 4);
          ctx.fillStyle = rgba(sc, 0.25);
          ctx.fillRect(x + 2, GROUND_Y - bh + 8, bw - 10, 12);
        }
        x += bw;
      }
    } else if (key === "void") {
      for (let i = 0; i < 26; i++) {
        const x = rand() * W;
        const y = hs[Math.floor(x)] + 8;
        const h = 20 + rand() * 50;
        ctx.fillStyle = "#3a2566";
        ctx.beginPath();
        ctx.moveTo(x, y - h);
        ctx.lineTo(x - 7, y);
        ctx.lineTo(x + 7, y);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "rgba(224,204,255,0.5)";
        ctx.fillRect(Math.round(x - 1), Math.round(y - h + 4), 2, h * 0.5);
      }
    }
    return foldSeamless(big.c, null);
  }

  // near: foreground props hugging the ground line
  for (let i = 0; i < 26; i++) {
    const x = Math.floor(rand() * W);
    const y = GROUND_Y + 2;
    const s = 0.8 + rand() * 0.8;
    ctx.fillStyle = b.near;
    if (key === "desert") {
      ctx.beginPath();
      ctx.ellipse(x, y - 6 * s, 16 * s, 10 * s, 0, Math.PI, 0);
      ctx.fill();
      ctx.fillStyle = shade(b.near, 0.2);
      ctx.fillRect(x - 10 * s, y - 14 * s, 8 * s, 2);
    } else if (key === "tundra") {
      ctx.beginPath();
      ctx.ellipse(x, y - 4 * s, 20 * s, 12 * s, 0, Math.PI, 0);
      ctx.fill();
      ctx.fillStyle = "#aac2da";
      ctx.fillRect(x - 12 * s, y - 4 * s, 24 * s, 3);
    } else if (key === "volcanic") {
      ctx.beginPath();
      ctx.moveTo(x - 14 * s, y);
      ctx.lineTo(x - 4 * s, y - 26 * s);
      ctx.lineTo(x + 6 * s, y - 12 * s);
      ctx.lineTo(x + 14 * s, y);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "rgba(255,90,31,0.5)";
      ctx.fillRect(x - 3 * s, y - 16 * s, 2, 10 * s);
    } else if (key === "jungle") {
      for (let f = 0; f < 5; f++) {
        ctx.strokeStyle = f % 2 ? "#2f7a34" : "#1b4a22";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.quadraticCurveTo(x + (f - 2) * 8 * s, y - 30 * s, x + (f - 2) * 16 * s, y - 20 * s);
        ctx.stroke();
      }
    } else if (key === "cyber") {
      ctx.fillStyle = "#1d1245";
      ctx.fillRect(x, y - 24 * s, 3, 24 * s);
      ctx.fillStyle = "#00ffcc";
      ctx.fillRect(x - 1, y - 26 * s, 5, 3);
    } else {
      ctx.fillStyle = "#2a1d45";
      ctx.fillRect(x - 6 * s, y - 8 * s, 12 * s, 8 * s);
      ctx.fillStyle = "#7c4dff";
      ctx.fillRect(x - 6 * s, y - 8 * s, 12 * s, 1);
    }
  }
  return foldSeamless(big.c, null);
}

// 96px-wide ground strip (tiles horizontally): surface band, strata, pebbles
function buildGround(b, seed) {
  const H = 80;
  const TW = 96;
  const { c, ctx } = makeCanvas(TW, H);
  const rand = mulberry32(seed);
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, b.ground);
  g.addColorStop(1, b.groundDark);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, TW, H);
  // Strata bands
  for (let y = 18; y < H; y += 14 + Math.floor(rand() * 8)) {
    ctx.fillStyle = rgba(shade(b.ground, -0.3), 0.35);
    for (let x = 0; x < TW; x++) ctx.fillRect(x, y + Math.round(Math.sin((x / TW) * Math.PI * 2 * 2 + y) * 2), 1, 2);
  }
  // Pebbles & grain
  for (let i = 0; i < 140; i++) {
    const x = Math.floor(rand() * TW);
    const y = 10 + Math.floor(rand() * (H - 10));
    ctx.fillStyle = rand() < 0.5 ? shade(b.ground, 0.15) : shade(b.ground, -0.25);
    ctx.fillRect(x, y, rand() < 0.15 ? 3 : 1, rand() < 0.15 ? 2 : 1);
  }
  // Surface band (grass / sand crust / snow / neon edge)
  ctx.fillStyle = b.groundTop;
  ctx.fillRect(0, 0, TW, 6);
  ctx.fillStyle = shade(b.groundTop, -0.25);
  for (let x = 0; x < TW; x += 2) {
    const d = 6 + Math.floor(Math.abs(Math.sin(x * 0.7)) * 3);
    ctx.fillRect(x, 6, 2, d - 6);
  }
  if (b.key === "jungle" || b.key === "desert") {
    // Grass tufts / sand ripples sticking up
    ctx.fillStyle = shade(b.groundTop, 0.15);
    for (let x = 3; x < TW; x += 7) ctx.fillRect(x, 0, 1, 2);
  }
  if (b.key === "volcanic") {
    ctx.fillStyle = "rgba(255,90,31,0.8)";
    for (let i = 0; i < 5; i++) {
      let x = rand() * TW;
      for (let y = 8; y < 60; y += 2) {
        x += (rand() - 0.5) * 3;
        ctx.fillRect(((Math.round(x) % TW) + TW) % TW, y, 1, 2);
      }
    }
  }
  if (b.key === "cyber") {
    ctx.fillStyle = "rgba(0,255,204,0.35)";
    for (let x = 0; x < TW; x += 24) ctx.fillRect(x, 6, 1, H);
    for (let y = 20; y < H; y += 18) ctx.fillRect(0, y, TW, 1);
  }
  return c;
}
