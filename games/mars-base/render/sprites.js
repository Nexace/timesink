import { PAL, hex, TERRAIN_COLORS } from "./palette.js";
import { itemById } from "../data/items.js";
import { N } from "../data/tiles.js";

export const TS = 16; // tile size in pixels

export function makeCanvas(w, h) {
  const c = typeof OffscreenCanvas !== "undefined" ? new OffscreenCanvas(w, h) : Object.assign(document.createElement("canvas"), { width: w, height: h });
  const ctx = c.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  return { c, ctx };
}

function hash(x, y, s = 0) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(s | 0, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function px(ctx, x, y, c, w = 1, h = 1) {
  ctx.fillStyle = typeof c === "number" ? hex(c) : c;
  ctx.fillRect(x, y, w, h);
}

// Draw a sprite from rows of characters using a key → palette-index map.
function fromRows(rows, key, flip = false) {
  const h = rows.length;
  const w = rows[0].length;
  const { c, ctx } = makeCanvas(w, h);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const ch = rows[y][flip ? w - 1 - x : x];
      const idx = key[ch];
      if (idx) px(ctx, x, y, idx);
    }
  }
  return c;
}

// ---------- Astronaut ----------
const ASTRO_DOWN = [
  "................",
  ".....WWWWWW.....",
  "....WWWWWWWW....",
  "....WVVVVVVW....",
  "....WVvVVVVW....",
  "....WVVVVVVW....",
  ".....WWWWWW.....",
  "...OWWWWWWWWO...",
  "...WWwWWWWwWW...",
  "...WWwOOOOwWW...",
  "...wWWWWWWWWw...",
  "....WWWddWWW....",
  "....WWW..WWW....",
  "....wWW..WWw....",
  "....dd....dd....",
  "................",
];
const ASTRO_DOWN_2 = [...ASTRO_DOWN.slice(0, 12), "....WWW..WWW....", "....wWW...WWw...", "...dd......dd...", "................"];
const ASTRO_UP = [
  "................",
  ".....WWWWWW.....",
  "....WWWWWWWW....",
  "....WWWWWWWW....",
  "....WWWWWWWW....",
  "....wWWWWWWw....",
  ".....WWWWWW.....",
  "...OwwwwwwwwO...",
  "...WwddddddwW...",
  "...WwdwwwwdwW...",
  "...wwddddddww...",
  "....WWWWWWWW....",
  "....WWW..WWW....",
  "....wWW..WWw....",
  "....dd....dd....",
  "................",
];
const ASTRO_UP_2 = [...ASTRO_UP.slice(0, 12), "....WWW..WWW....", "...wWW...WWw....", "...dd......dd...", "................"];
const ASTRO_SIDE = [
  "................",
  "......WWWWW.....",
  ".....WWWWWWW....",
  "....dWWWWVVV....",
  "....dWWWVVvV....",
  "....dWWWVVVV....",
  ".....WWWWWWW....",
  "....ddWWWWWO....",
  "....ddWWWWWW....",
  "....ddWWOOWW....",
  "....ddwWWWWw....",
  ".....WWWWWW.....",
  ".....WWW.WW.....",
  ".....wWW.Ww.....",
  ".....dd...dd....",
  "................",
];
const ASTRO_SIDE_2 = [...ASTRO_SIDE.slice(0, 12), "......WWWW......", "......wWWw......", "......dddd......", "................"];

function astronautSet(suit, accent, visor = 19) {
  const key = { W: suit, w: 14, d: 18, V: visor, v: 12, O: accent };
  const down = [fromRows(ASTRO_DOWN, key), fromRows(ASTRO_DOWN_2, key)];
  const up = [fromRows(ASTRO_UP, key), fromRows(ASTRO_UP_2, key)];
  const right = [fromRows(ASTRO_SIDE, key), fromRows(ASTRO_SIDE_2, key)];
  const left = [fromRows(ASTRO_SIDE, key, true), fromRows(ASTRO_SIDE_2, key, true)];
  return [up, right, down, left]; // index by dir 0..3
}

// ---------- Rover (drawn facing right, rotated into 16 headings) ----------
function roverBase(broken) {
  const { c, ctx } = makeCanvas(24, 24);
  // wheels
  for (const wx of [5, 11, 17]) {
    px(ctx, wx, 4, 1, 3, 3);
    px(ctx, wx, 17, 1, 3, 3);
    px(ctx, wx + 1, 5, 18);
    px(ctx, wx + 1, 18, 18);
  }
  // chassis
  px(ctx, 3, 6, 26, 18, 12);
  px(ctx, 4, 7, broken ? 18 : 28, 16, 10);
  // pressurized cabin
  px(ctx, 12, 8, 15, 8, 8);
  px(ctx, 18, 9, 19, 2, 6);
  px(ctx, 19, 10, 12, 1, 2);
  // solar roof
  px(ctx, 5, 8, 31, 6, 8);
  for (let y = 8; y < 16; y += 2) px(ctx, 5, y, 19, 6, 1);
  // lights
  px(ctx, 21, 7, broken ? 18 : 30);
  px(ctx, 21, 16, broken ? 18 : 30);
  px(ctx, 3, 11, broken ? 18 : 2, 1, 2);
  if (broken) {
    px(ctx, 9, 9, 1, 2, 1);
    px(ctx, 14, 12, 1, 3, 1);
  }
  return c;
}

function rotations(base, steps = 16) {
  const out = [];
  for (let k = 0; k < steps; k += 1) {
    const { c, ctx } = makeCanvas(32, 32);
    ctx.translate(16, 16);
    ctx.rotate((k / steps) * Math.PI * 2);
    ctx.drawImage(base, -12, -12);
    out.push(c);
  }
  return out;
}

// ---------- Terrain ----------
function terrainTile(t, v) {
  const { c, ctx } = makeCanvas(TS, TS);
  const [base, light, dark] = TERRAIN_COLORS[t] ?? [6, 7, 22];
  px(ctx, 0, 0, base, TS, TS);
  const seed = t * 97 + v * 13;
  for (let y = 0; y < TS; y += 1) {
    for (let x = 0; x < TS; x += 1) {
      const r = hash(x, y, seed);
      if (r < 0.07) px(ctx, x, y, light);
      else if (r < 0.14) px(ctx, x, y, dark);
    }
  }
  if (t === 1) {
    // dune ripples
    for (let k = 0; k < 3; k += 1) {
      const y0 = 3 + k * 5 + (v % 2);
      for (let x = 0; x < TS; x += 1) px(ctx, x, y0 + Math.round(Math.sin((x + v * 3) / 2.5)), light);
    }
  } else if (t === 3) {
    // ice cracks
    for (let k = 0; k < 6; k += 1) px(ctx, (v * 5 + k * 3) % TS, (k * 7 + v) % TS, 15, 2, 1);
  } else if (t === 4) {
    px(ctx, 0, 0, 18, TS, 2);
    for (let k = 0; k < 4; k += 1) px(ctx, (k * 5 + v * 3) % 14, 4 + ((k * 3 + v) % 10), 24, 2, 2);
  } else if (t === 5) {
    px(ctx, 0, 0, 24, TS, TS);
    for (let k = 0; k < 5; k += 1) px(ctx, (k * 4 + v) % TS, (k * 5) % TS, 1, 2, 1);
  } else if (t === 7) {
    for (let y = 1; y < TS; y += 4) px(ctx, 0, y, dark, TS, 1);
  } else if (t === 9) {
    for (let k = 0; k < 5; k += 1) px(ctx, (k * 3 + v * 2) % TS, (k * 7 + v) % TS, 3, 2, 1);
  } else if (t === 0 || t === 2) {
    if (v === 1) {
      // pebble
      px(ctx, 5, 9, 21, 3, 2);
      px(ctx, 5, 9, 8);
    } else if (v === 3) {
      px(ctx, 10, 4, 21, 2, 2);
    }
  }
  return c;
}

// ---------- Nodes ----------
function rock(ctx, body, light, dark, spots, spotColor, big = true) {
  const x0 = big ? 2 : 4;
  const w = big ? 12 : 8;
  const y0 = big ? 4 : 7;
  const h = big ? 10 : 7;
  px(ctx, x0 + 1, y0 + h, 1, w - 1, 1); // shadow
  px(ctx, x0 + 1, y0, body, w - 2, h);
  px(ctx, x0, y0 + 1, body, w, h - 2);
  px(ctx, x0 + 1, y0, light, w - 3, 1);
  px(ctx, x0, y0 + 1, light, 1, h - 4);
  px(ctx, x0 + 1, y0 + h - 1, dark, w - 2, 1);
  px(ctx, x0 + w - 1, y0 + 2, dark, 1, h - 3);
  for (const [sx, sy] of spots) px(ctx, x0 + sx, y0 + sy, spotColor, 2, 2);
}

function nodeSprite(n) {
  const { c, ctx } = makeCanvas(TS, TS);
  switch (n) {
    case N.IRON:
      rock(ctx, 18, 27, 26, [[3, 3], [7, 5], [5, 7]], 5);
      px(ctx, 6, 7, 10);
      break;
    case N.SILICA:
      rock(ctx, 9, 15, 7, [[2, 2], [6, 4]], 15, false);
      break;
    case N.ICE:
      rock(ctx, 23, 15, 31, [[3, 3], [7, 6]], 12);
      break;
    case N.SULFUR:
      rock(ctx, 25, 10, 24, [[2, 3], [6, 2], [7, 6], [3, 7]], 10);
      break;
    case N.BOULDER:
      rock(ctx, 3, 18, 24, [[4, 4]], 24);
      break;
    case N.SCRAP:
      px(ctx, 2, 11, 1, 12, 2);
      px(ctx, 3, 8, 27, 5, 4);
      px(ctx, 7, 6, 14, 6, 5);
      px(ctx, 8, 7, 28, 3, 1);
      px(ctx, 4, 9, 26, 2, 1);
      px(ctx, 11, 10, 20, 2, 1);
      px(ctx, 5, 6, 18, 1, 3);
      break;
    case N.SAMPLE:
      px(ctx, 6, 10, 1, 5, 1);
      px(ctx, 6, 7, 16, 4, 3);
      px(ctx, 7, 7, 15);
      px(ctx, 11, 3, 10, 1, 7); // survey flag
      px(ctx, 12, 3, 2, 3, 2);
      break;
    case N.HYDRAZINE:
      px(ctx, 3, 13, 1, 11, 1);
      px(ctx, 4, 3, 28, 8, 10);
      px(ctx, 3, 4, 28, 10, 8);
      px(ctx, 5, 4, 15, 2, 7);
      px(ctx, 6, 7, 11, 5, 2);
      px(ctx, 7, 7, 1, 1, 2);
      px(ctx, 9, 7, 1, 1, 2);
      break;
    case N.RARE:
      rock(ctx, 24, 3, 1, [[2, 2], [7, 3], [4, 6], [8, 7]], 16);
      px(ctx, 5, 8, 15);
      break;
    case N.RTG:
      px(ctx, 2, 10, 21, 12, 4);
      px(ctx, 5, 6, 26, 6, 6);
      for (let k = 0; k < 3; k += 1) px(ctx, 4 + k * 3, 5, 18, 1, 8);
      px(ctx, 7, 8, 10, 2, 2);
      px(ctx, 12, 2, 2, 1, 8);
      px(ctx, 13, 2, 10, 2, 2);
      break;
    case N.LANDER:
      px(ctx, 1, 13, 1, 14, 1);
      px(ctx, 3, 6, 14, 10, 6);
      px(ctx, 2, 8, 28, 12, 3);
      px(ctx, 6, 2, 27, 4, 4);
      px(ctx, 7, 1, 15, 2, 1);
      px(ctx, 1, 12, 18, 2, 2);
      px(ctx, 13, 12, 18, 2, 2);
      px(ctx, 4, 7, 19, 3, 2);
      px(ctx, 9, 7, 19, 3, 2);
      break;
    case N.MAV:
      px(ctx, 5, 1, 15, 6, 13);
      px(ctx, 6, 0, 15, 4, 1);
      px(ctx, 7, 3, 19, 2, 2);
      px(ctx, 4, 10, 2, 1, 4);
      px(ctx, 11, 10, 2, 1, 4);
      px(ctx, 5, 12, 20, 6, 2);
      px(ctx, 2, 14, 18, 12, 2);
      break;
    case N.CACHE:
      px(ctx, 3, 12, 1, 11, 1);
      px(ctx, 3, 5, 20, 10, 7);
      px(ctx, 3, 5, 10, 10, 1);
      px(ctx, 7, 7, 15, 2, 3);
      px(ctx, 3, 8, 22, 10, 1);
      break;
    default:
      break;
  }
  return c;
}

// ---------- Item icons (10x10) as data URLs for the DOM ----------
const iconCache = new Map();
export function itemIconURL(id) {
  if (iconCache.has(id)) return iconCache.get(id);
  const cv = document.createElement("canvas");
  cv.width = 12;
  cv.height = 12;
  const ctx = cv.getContext("2d");
  const def = itemById(id);
  const col = def?.color ?? 14;
  const k = def?.kind;
  const tool = def?.tool;
  if (tool === "drill") {
    px(ctx, 1, 4, 18, 5, 4);
    px(ctx, 2, 5, def.tier === 3 ? 16 : def.tier === 2 ? 10 : 20, 3, 2);
    px(ctx, 6, 5, 28, 4, 2);
    px(ctx, 10, 6, 15, 2, 1);
    px(ctx, 3, 8, 26, 2, 3);
  } else if (tool === "shovel") {
    px(ctx, 5, 1, 21, 2, 7);
    px(ctx, 3, 7, 28, 6, 4);
    px(ctx, 4, 0, 26, 4, 1);
  } else if (tool === "multitool") {
    px(ctx, 2, 2, 28, 3, 3);
    px(ctx, 4, 4, 18, 2, 2);
    px(ctx, 5, 5, 20, 5, 5);
    px(ctx, 6, 6, 10, 2, 2);
  } else if (tool === "scanner") {
    px(ctx, 2, 3, 26, 8, 7);
    px(ctx, 3, 4, 19, 6, 4);
    px(ctx, 5, 5, 13, 2, 2);
    px(ctx, 3, 9, 20, 2, 1);
    px(ctx, 8, 0, 18, 1, 3);
  } else if (k === "food") {
    if (id === "ration") {
      px(ctx, 2, 3, 15, 8, 7);
      px(ctx, 2, 3, 20, 8, 2);
      px(ctx, 4, 7, 18, 4, 1);
    } else {
      px(ctx, 3, 3, col, 6, 6);
      px(ctx, 2, 4, col, 8, 4);
      px(ctx, 4, 3, 15);
      if (id === "potato") {
        px(ctx, 5, 6, 21);
        px(ctx, 7, 4, 21);
      }
    }
  } else if (k === "seed") {
    px(ctx, 3, 5, col, 3, 3);
    px(ctx, 7, 6, col, 3, 3);
    px(ctx, 5, 2, 13, 1, 3);
  } else if (id === "o2-canister") {
    px(ctx, 3, 1, 28, 6, 10);
    px(ctx, 4, 2, 12, 4, 8);
    px(ctx, 5, 0, 18, 2, 1);
  } else if (id === "water") {
    px(ctx, 3, 3, 23, 6, 7);
    px(ctx, 4, 4, 12, 2, 4);
    px(ctx, 5, 1, 28, 2, 2);
  } else if (id === "medkit") {
    px(ctx, 2, 3, 15, 8, 7);
    px(ctx, 5, 4, 2, 2, 5);
    px(ctx, 3, 6, 2, 6, 1);
  } else if (id === "duct-tape") {
    px(ctx, 2, 2, 27, 8, 8);
    px(ctx, 4, 4, 1, 4, 4);
    px(ctx, 5, 5, 26, 2, 2);
  } else if (id === "battery-cell") {
    px(ctx, 3, 2, 26, 6, 9);
    px(ctx, 4, 3, 10, 4, 3);
    px(ctx, 5, 1, 28, 2, 1);
  } else if (id === "beacon") {
    px(ctx, 5, 1, 28, 1, 10);
    px(ctx, 6, 1, 2, 4, 3);
    px(ctx, 3, 10, 18, 5, 1);
  } else if (id === "antenna") {
    px(ctx, 5, 4, 28, 2, 7);
    px(ctx, 1, 1, 14, 10, 4);
    px(ctx, 2, 2, 28, 8, 2);
  } else if (id === "rtg-core") {
    px(ctx, 2, 2, 26, 8, 8);
    px(ctx, 4, 4, 10, 4, 4);
    px(ctx, 5, 5, 2, 2, 2);
  } else if (k === "refined") {
    // plate / bar
    px(ctx, 1, 4, col, 10, 5);
    px(ctx, 1, 4, 15, 10, 1);
    px(ctx, 1, 8, 1, 10, 1);
    if (id === "circuit") {
      px(ctx, 1, 3, 13, 10, 6);
      px(ctx, 3, 5, 10, 2, 2);
      px(ctx, 7, 5, 18, 2, 2);
    }
    if (id === "wire") {
      ctx.clearRect(0, 0, 12, 12);
      for (let a = 0; a < 3; a += 1) px(ctx, 2 + a * 3, 2, 10, 2, 8);
      px(ctx, 2, 2, 5, 8, 1);
    }
  } else {
    // raw chunk
    px(ctx, 3, 2, col, 6, 8);
    px(ctx, 2, 4, col, 8, 5);
    px(ctx, 3, 2, 15, 2, 1);
    px(ctx, 8, 8, 1, 2, 2);
  }
  const url = cv.toDataURL();
  iconCache.set(id, url);
  return url;
}

// ---------- structure drawing (per frame, cheap fillRects) ----------
export function drawStruct(ctx, st, x, y, t, nb, extra = {}) {
  const f = (dx, dy, c, w = 1, h = 1) => px(ctx, x + dx, y + dy, c, w, h);
  const blink = Math.floor(t * 2) % 2 === 0;
  switch (st.id) {
    case "floor":
      f(0, 0, 18, 16, 16);
      f(0, 0, 27, 16, 1);
      f(0, 0, 27, 1, 16);
      f(7, 7, 26, 2, 2);
      break;
    case "wall":
    case "rwall": {
      const body = st.id === "rwall" ? 26 : 28;
      f(0, 0, body, 16, 16);
      f(0, 0, 15, 16, 1);
      f(0, 15, 18, 16, 1);
      if (!nb.l) f(0, 0, 18, 1, 16);
      if (!nb.r) f(15, 0, 18, 1, 16);
      f(3, 4, 27, 10, 1);
      f(3, 10, 27, 10, 1);
      if (st.id === "rwall") {
        f(2, 2, 18, 2, 2);
        f(12, 2, 18, 2, 2);
        f(2, 12, 18, 2, 2);
        f(12, 12, 18, 2, 2);
      }
      break;
    }
    case "glass-wall":
      f(0, 0, 27, 16, 16);
      f(1, 1, 31, 14, 14);
      f(2, 2, 23, 3, 1);
      f(2, 3, 23, 1, 2);
      f(9, 10, 12, 4, 1);
      break;
    case "airlock": {
      f(0, 0, 26, 16, 16);
      const col = st.broken ? 2 : 20;
      for (let k = 0; k < 16; k += 4) f(k, 0, col, 2, 2);
      for (let k = 2; k < 16; k += 4) f(k, 14, col, 2, 2);
      f(3, 3, st.broken ? 1 : 18, 10, 10);
      f(7, 3, st.broken ? 1 : 26, 2, 10);
      f(13, 7, st.broken ? 2 : blink ? 13 : 29, 2, 2);
      break;
    }
    case "cable":
      if (nb.l) f(0, 7, 10, 8, 2);
      if (nb.r) f(8, 7, 10, 8, 2);
      if (nb.u) f(7, 0, 10, 2, 8);
      if (nb.d) f(7, 8, 10, 2, 8);
      f(6, 6, 18, 4, 4);
      break;
    case "solar": {
      f(1, 13, 1, 14, 2);
      f(0, 1, 18, 16, 13);
      f(1, 2, 19, 14, 11);
      for (let k = 2; k < 13; k += 3) f(1, k, 31, 14, 1);
      for (let k = 5; k < 15; k += 5) f(k, 2, 31, 1, 11);
      f(2, 3, 12, 3, 1);
      const dust = st.dust ?? 0;
      if (dust > 0.05) {
        ctx.globalAlpha = Math.min(0.85, dust);
        f(1, 2, 7, 14, 11);
        ctx.globalAlpha = 1;
      }
      break;
    }
    case "battery": {
      f(1, 1, 26, 14, 14);
      f(2, 2, 18, 12, 12);
      const lvl = extra.charge ?? 0;
      const bars = Math.round(lvl * 5);
      for (let k = 0; k < 5; k += 1) f(4, 11 - k * 2, k < bars ? (lvl < 0.25 ? 2 : 13) : 26, 8, 1);
      f(6, 0, 28, 4, 1);
      break;
    }
    case "rtg":
      f(3, 3, 26, 10, 10);
      for (let k = 0; k < 4; k += 1) f(2 + k * 3, 1, 18, 1, 14);
      f(6, 6, blink ? 20 : 10, 4, 4);
      break;
    case "reactor":
      f(0, 0, 26, 16, 16);
      f(2, 2, 28, 12, 12);
      f(4, 4, 19, 8, 8);
      f(6, 6, blink ? 12 : 23, 4, 4);
      f(0, 0, 10, 3, 3);
      break;
    case "oxygenator":
      f(1, 1, 28, 14, 14);
      f(2, 2, 15, 12, 5);
      f(3, 3, st.broken ? 18 : st.powered ? (blink ? 12 : 23) : 26, 10, 3);
      f(3, 9, 18, 10, 5);
      for (let k = 4; k < 13; k += 2) f(k, 10, 26, 1, 3);
      f(12, 2, st.broken ? 2 : 13, 1, 1);
      break;
    case "reclaimer":
      f(1, 1, 28, 14, 14);
      f(3, 3, 31, 10, 10);
      f(5, 5, st.broken ? 18 : 23, 6, 6);
      f(7, 3, 18, 2, 10);
      f(12, 2, st.broken ? 2 : 13, 1, 1);
      break;
    case "heater":
      f(1, 2, 26, 14, 12);
      for (let k = 3; k < 14; k += 2) f(k, 4, st.powered ? 20 : 18, 1, 8);
      break;
    case "tank": {
      f(2, 1, 28, 12, 14);
      f(3, 2, 26, 10, 12);
      const lvl = extra.water ?? 0;
      const hh = Math.round(lvl * 10);
      f(4, 13 - hh, 23, 8, hh);
      f(4, 13 - hh, 12, 8, Math.min(1, hh));
      break;
    }
    case "recycler":
      f(2, 2, 27, 12, 12);
      f(4, 4, 4, 8, 8);
      if ((st.compost ?? 0) > 0) f(5, 5, 21, Math.min(6, st.compost), 2);
      f(2, 2, 13, 2, 2);
      break;
    case "chem":
      f(1, 4, 26, 14, 10);
      f(3, 1, 12, 3, 7);
      f(9, 2, 11, 4, 6);
      f(4, 6, 15, 1, 1);
      f(3, 10, (st.hyd ?? 0) > 0 && st.powered ? (blink ? 2 : 20) : 18, 10, 2);
      break;
    case "planter": {
      f(0, 2, 21, 16, 13);
      f(1, 3, 4, 14, 11);
      for (let k = 0; k < 4; k += 1) f(2 + k * 4, 5 + (k % 2), 21, 2, 1);
      const c = st.crop;
      if (c) drawCrop(f, c);
      break;
    }
    case "growlamp":
      f(3, 12, 18, 10, 3);
      f(7, 3, 26, 2, 10);
      f(2, 1, 26, 12, 3);
      f(3, 2, st.powered ? 16 : 18, 10, 1);
      break;
    case "algae":
      f(1, 1, 28, 14, 14);
      f(2, 2, 29, 12, 12);
      f(3, 3, 13, 4, 3);
      f(8, 6, 13, 3, 4);
      if (st.powered && blink) f(5, 9, 15, 1, 1);
      break;
    case "workbench":
      f(1, 4, 21, 14, 8);
      f(1, 4, 7, 14, 2);
      f(2, 12, 24, 2, 3);
      f(12, 12, 24, 2, 3);
      f(4, 2, 28, 4, 2);
      f(10, 1, 20, 2, 3);
      break;
    case "smelter":
      f(1, 1, 3, 14, 14);
      f(3, 3, 24, 10, 8);
      f(5, 6, st.busy && st.powered ? (blink ? 20 : 10) : 25, 6, 4);
      f(6, 0, 18, 4, 2);
      break;
    case "fabricator":
      f(0, 1, 26, 16, 14);
      f(2, 3, 19, 12, 7);
      f(3, 4, st.busy && st.powered ? 12 : 31, 4, 1);
      f(3, 12, 20, 10, 1);
      f(13, 11, blink && st.busy ? 13 : 18, 2, 2);
      break;
    case "crate":
      f(1, 3, 20, 14, 11);
      f(1, 3, 22, 14, 2);
      f(1, 8, 22, 14, 1);
      f(7, 5, 18, 2, 3);
      f(2, 14, 1, 13, 1);
      break;
    case "autominer":
      f(2, 2, 26, 12, 12);
      f(4, 4, 10, 8, 8);
      f(6, 6, 1, 4, 4);
      f(7, blink && st.powered ? 1 : 12, 18, 2, 3);
      break;
    case "lab":
      f(0, 1, 15, 16, 14);
      f(1, 2, 28, 14, 12);
      f(3, 4, 19, 6, 5);
      f(4, 5, st.powered && (st.samples ?? 0) > 0 ? 13 : 31, 4, 3);
      f(11, 4, 16, 3, 6);
      break;
    case "comms":
      f(6, 10, 26, 4, 6);
      f(2, 2, 28, 12, 9);
      f(3, 3, 15, 10, 6);
      f(7, 5, 18, 2, 2);
      f(8, 0, 27, 1, 5);
      f(8, 0, st.powered ? (blink ? 2 : 20) : 18, 1, 1);
      break;
    case "pad":
      f(0, 0, 27, 16, 16);
      f(0, 0, 28, 16, 1);
      f(0, 0, 28, 1, 16);
      if (nb.l === false) f(0, 0, 10, 2, 16);
      if (nb.r === false) f(14, 0, 10, 2, 16);
      f(6, 6, 20, 4, 4);
      break;
    case "bunk":
      f(1, 1, 26, 14, 14);
      f(2, 2, 31, 12, 12);
      f(3, 3, 15, 10, 3);
      f(2, 7, 19, 12, 7);
      break;
    case "lamp":
      f(7, 4, 18, 2, 12);
      f(4, 1, 26, 8, 4);
      f(5, 2, st.powered ? 30 : 18, 6, 2);
      break;
    case "beacon":
      f(7, 1, 28, 1, 14);
      f(8, 1, 2, 5, 4);
      f(5, 14, 18, 5, 2);
      if (blink) f(7, 0, 2, 1, 1);
      break;
    default:
      f(2, 2, 2, 12, 12);
  }
  if (st.broken) {
    // hazard corner + sparks
    f(0, 0, 10, 4, 1);
    f(0, 0, 10, 1, 4);
    if (blink) f(11, 3, 10, 2, 1);
    f(12, 12, 2, 3, 3);
  }
}

function drawCrop(f, c) {
  if (c.dead) {
    f(5, 6, 21, 1, 5);
    f(9, 7, 21, 1, 4);
    f(4, 6, 24, 3, 1);
    return;
  }
  const stage = c.g >= 1 ? 3 : Math.floor(c.g * 3);
  const leaf = 13;
  const dark = 29;
  for (let k = 0; k < 3; k += 1) {
    const cx = 3 + k * 5;
    if (stage === 0) {
      f(cx, 9, leaf, 1, 2);
    } else if (stage === 1) {
      f(cx, 7, leaf, 1, 4);
      f(cx - 1, 7, leaf);
      f(cx + 1, 8, dark);
    } else {
      f(cx - 1, 5, dark, 3, 5);
      f(cx, 4, leaf, 1, 6);
      f(cx - 2, 6, leaf, 1, 2);
      f(cx + 2, 5, leaf, 1, 2);
      if (stage === 3) {
        const fruit = c.type === "potato" ? 7 : c.type === "beans" ? 11 : 13;
        f(cx - 1, 10, fruit, 2, 2);
        f(cx + 1, 11, fruit, 1, 1);
      }
    }
  }
}

// ---------- asset bundle ----------
export function buildAssets() {
  const terrain = [];
  for (let t = 0; t < 10; t += 1) {
    terrain[t] = [];
    for (let v = 0; v < 4; v += 1) terrain[t].push(terrainTile(t, v));
  }
  const nodes = [];
  for (let n = 1; n <= 13; n += 1) nodes[n] = nodeSprite(n);
  return {
    terrain,
    nodes,
    player: astronautSet(15, 20),
    colonist: astronautSet(28, 19, 31),
    colonistAlt: astronautSet(9, 13, 31),
    rover: rotations(roverBase(false)),
    roverBroken: rotations(roverBase(true)),
  };
}

export { hash, px, PAL };
