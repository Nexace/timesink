// IRONSAIL art: living sea, hand-shaded islands, top-down ships with filling sails, sea features.
import { makeCanvas, mulberry32, noiseTile, patternOf, glow, shade, rgba } from "/shared/gfx.js";

const TAU = Math.PI * 2;
const INK = "#0a1418";

// ─────────────────────────── sea ───────────────────────────
function waterTile(size, base, seed) {
  const { c, ctx } = makeCanvas(size, size);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  const r = mulberry32(seed);
  // Soft swells
  for (let k = 0; k < 40; k++) {
    const x = r() * size;
    const y = r() * size;
    const rad = 20 + r() * 60;
    const light = r() < 0.5;
    // Each wrapped copy needs its own gradient centre, or swells get cut off at the tile edge
    for (const ox of [-size, 0, size]) {
      for (const oy of [-size, 0, size]) {
        const g = ctx.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, rad);
        g.addColorStop(0, light ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.06)");
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g;
        ctx.fillRect(x - rad + ox, y - rad + oy, rad * 2, rad * 2);
      }
    }
  }
  // Ripple glints
  ctx.strokeStyle = "rgba(210,245,255,0.16)";
  ctx.lineWidth = 1.5;
  for (let k = 0; k < 60; k++) {
    const x = r() * (size - 30) + 4;
    const y = r() * (size - 8) + 4;
    const w = 6 + r() * 16;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + w / 2, y - 2.5, x + w, y);
    ctx.stroke();
  }
  return c;
}

const SEA = {
  deep: waterTile(256, "#0d4a66", 1),
  dark: waterTile(256, "#0a2f45", 2),
  grey: waterTile(256, "#26394a", 3),
  bright: waterTile(256, "#0f6e8c", 4)
};
export function seaTileFor(danger, sectorName) {
  if (sectorName === "Devil's Shroud") return SEA.grey;
  if (sectorName === "Abyssal Trench") return SEA.dark;
  if (sectorName === "Sapphire Shallows" || sectorName === "Coral Reach") return SEA.bright;
  return SEA.deep;
}

/** Fill the view with two slowly drifting water layers (camera cam = {x, y, z}). */
export function drawSea(ctx, cam, W, H, tile, t) {
  ctx.save();
  ctx.setTransform(cam.z, 0, 0, cam.z, W / 2 - cam.x * cam.z, H / 2 - cam.y * cam.z);
  const left = cam.x - W / 2 / cam.z;
  const top = cam.y - H / 2 / cam.z;
  const vw = W / cam.z;
  const vh = H / cam.z;
  const pat = patternOf(ctx, tile);
  ctx.fillStyle = pat;
  const d1 = (t * 9) % 256;
  ctx.translate(d1, d1 * 0.4);
  ctx.fillRect(left - 256, top - 256, vw + 512, vh + 512);
  ctx.translate(-d1, -d1 * 0.4);
  ctx.globalAlpha = 0.35;
  const d2 = (t * -6) % 256;
  ctx.translate(d2 * 0.6, d2);
  ctx.fillRect(left - 256, top - 256, vw + 512, vh + 512);
  ctx.restore();
}

/** Wave crests: short white arcs that swell and fade, hashed per world cell so they stay put. */
export function drawCrests(ctx, view, t, windDir) {
  const CELL = 160;
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  const x0 = Math.floor(view.left / CELL);
  const x1 = Math.floor(view.right / CELL);
  const y0 = Math.floor(view.top / CELL);
  const y1 = Math.floor(view.bottom / CELL);
  const dx = Math.cos(windDir);
  const dy = Math.sin(windDir);
  for (let cy = y0; cy <= y1; cy++) {
    for (let cx = x0; cx <= x1; cx++) {
      const h = Math.imul(cx * 73856093 ^ cy * 19349663, 2654435761) >>> 0;
      const ph = (h % 1000) / 1000;
      const k = (Math.sin(t * 0.9 + ph * TAU) + 1) / 2;
      if (k < 0.55) continue;
      const x = cx * CELL + ((h >>> 10) % CELL) + dx * k * 18;
      const y = cy * CELL + ((h >>> 20) % CELL) + dy * k * 18;
      const len = 10 + ((h >>> 5) % 14);
      ctx.strokeStyle = `rgba(230,250,255,${(k - 0.55) * 1.6})`;
      ctx.beginPath();
      ctx.moveTo(x - dy * len, y + dx * len);
      ctx.quadraticCurveTo(x + dx * 4, y + dy * 4, x + dy * len, y - dx * len);
      ctx.stroke();
    }
  }
}

// ─────────────────────────── islands ───────────────────────────
const TEX = {
  sand: noiseTile(96, { base: "#e6cf96", seed: 21, blotches: [{ color: "#f0dcaa", alpha: 0.5, count: 8, min: 8, max: 24 }], speckles: [{ color: "#c9b07a", density: 0.06 }, { color: "#fff0c8", density: 0.03 }] }),
  grass: noiseTile(96, { base: "#3f8a3a", seed: 22, blotches: [{ color: "#4d9c44", alpha: 0.5, count: 10, min: 8, max: 28 }, { color: "#2f6e2d", alpha: 0.5, count: 8, min: 8, max: 24 }], speckles: [{ color: "#62b356", density: 0.05 }, { color: "#245523", density: 0.05 }] }),
  rock: noiseTile(64, { base: "#6b6f75", seed: 23, blotches: [{ color: "#7c8087", alpha: 0.5, count: 6, min: 6, max: 18 }], speckles: [{ color: "#8e939a", density: 0.06 }, { color: "#4a4e54", density: 0.06 }] }),
  wood: noiseTile(64, { base: "#7a5230", seed: 24, speckles: [{ color: "#8f6238", density: 0.08 }, { color: "#5c3c21", density: 0.06 }] })
};

function outline(g, pts, s = 1) {
  g.beginPath();
  g.moveTo(pts[0][0] * s, pts[0][1] * s);
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0] * s, pts[i][1] * s);
  g.closePath();
}

export function palm(g, x, y, s, rand) {
  g.fillStyle = "rgba(0,0,0,0.25)";
  g.beginPath();
  g.ellipse(x + 6 * s, y + 6 * s, 14 * s, 9 * s, 0, 0, TAU);
  g.fill();
  const rot = rand() * TAU;
  g.lineCap = "round";
  for (let f = 0; f < 7; f++) {
    const a = rot + (f / 7) * TAU;
    g.strokeStyle = f % 2 ? "#2d7a2a" : "#3d9436";
    g.lineWidth = 4 * s;
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo(x + Math.cos(a) * 9 * s, y + Math.sin(a) * 9 * s - 2, x + Math.cos(a) * 17 * s, y + Math.sin(a) * 17 * s);
    g.stroke();
  }
  g.fillStyle = "#6b4a24";
  g.beginPath();
  g.arc(x, y, 3 * s, 0, TAU);
  g.fill();
}

/** Pre-render an island (sand, lagoon-bright shallows, grass, rocks, palms, town, dock). */
export function renderIsland(isl) {
  const pad = 170;
  const r = isl.r * 1.35 + pad;
  const size = Math.ceil(r * 2);
  const { c, ctx: g } = makeCanvas(size, size);
  const rand = mulberry32(isl.id * 7919 + 13);
  g.translate(size / 2, size / 2);
  // Shallows fade out into deep water
  for (const [s, a] of [[1.42, 0.12], [1.28, 0.2], [1.16, 0.3]]) {
    outline(g, isl.shape, s);
    g.fillStyle = `rgba(80,220,215,${a})`;
    g.fill();
  }
  // Foam line
  outline(g, isl.shape, 1.06);
  g.strokeStyle = "rgba(255,255,255,0.55)";
  g.lineWidth = 5;
  g.stroke();
  // Beach
  outline(g, isl.shape, 1.02);
  g.fillStyle = patternOf(g, TEX.sand);
  g.fill();
  g.strokeStyle = shade("#e6cf96", -0.3);
  g.lineWidth = 2;
  g.stroke();
  // Grass interior with a darker rim
  outline(g, isl.shape, 0.82);
  g.fillStyle = patternOf(g, TEX.grass);
  g.fill();
  g.strokeStyle = "rgba(30,70,25,0.55)";
  g.lineWidth = 4;
  g.stroke();
  // A hill in the middle
  const hg = g.createRadialGradient(-isl.r * 0.15, -isl.r * 0.2, 4, 0, 0, isl.r * 0.55);
  hg.addColorStop(0, "rgba(120,190,90,0.55)");
  hg.addColorStop(1, "rgba(40,90,35,0)");
  g.fillStyle = hg;
  g.beginPath();
  g.arc(0, 0, isl.r * 0.55, 0, TAU);
  g.fill();
  // Rock outcrops
  for (let k = 0; k < 5; k++) {
    const a = rand() * TAU;
    const d = isl.r * (0.2 + rand() * 0.45);
    const rr = 10 + rand() * 18;
    g.fillStyle = "rgba(0,0,0,0.3)";
    g.beginPath();
    g.ellipse(Math.cos(a) * d + 4, Math.sin(a) * d + 5, rr, rr * 0.8, 0, 0, TAU);
    g.fill();
    g.fillStyle = patternOf(g, TEX.rock);
    g.beginPath();
    g.ellipse(Math.cos(a) * d, Math.sin(a) * d, rr, rr * 0.8, 0, 0, TAU);
    g.fill();
  }
  // Town: roofs clustered near the dock
  const da = isl.dockAngle;
  const tx = Math.cos(da) * isl.r * 0.5;
  const ty = Math.sin(da) * isl.r * 0.5;
  const roofs = ["#b8472e", "#a0522d", "#7a3b2a", "#c8663a", "#4a6b8a"];
  for (let k = 0; k < isl.town; k++) {
    const x = tx + (rand() - 0.5) * isl.r * 0.45;
    const y = ty + (rand() - 0.5) * isl.r * 0.35;
    const w = 16 + rand() * 12;
    const h = 12 + rand() * 8;
    g.fillStyle = "rgba(0,0,0,0.3)";
    g.fillRect(x - w / 2 + 3, y - h / 2 + 4, w, h);
    g.fillStyle = "#e8dcc0";
    g.fillRect(x - w / 2, y - h / 2, w, h);
    g.fillStyle = roofs[Math.floor(rand() * roofs.length)];
    g.beginPath();
    g.moveTo(x - w / 2 - 2, y);
    g.lineTo(x, y - h / 2 - 5);
    g.lineTo(x + w / 2 + 2, y);
    g.lineTo(x, y + h / 2 + 3);
    g.closePath();
    g.fill();
    g.strokeStyle = "rgba(0,0,0,0.35)";
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(x - w / 2 - 2, y);
    g.lineTo(x + w / 2 + 2, y);
    g.stroke();
  }
  // Dock reaching out past the beach
  g.save();
  g.rotate(da);
  g.fillStyle = "rgba(0,0,0,0.3)";
  g.fillRect(isl.r * 0.78 + 4, -9, isl.r * 0.42, 22);
  g.fillStyle = patternOf(g, TEX.wood);
  g.fillRect(isl.r * 0.78, -12, isl.r * 0.42, 22);
  g.strokeStyle = "rgba(40,24,10,0.6)";
  g.lineWidth = 1;
  for (let x = isl.r * 0.78; x < isl.r * 1.2; x += 8) {
    g.beginPath();
    g.moveTo(x, -12);
    g.lineTo(x, 10);
    g.stroke();
  }
  g.restore();
  // Palms around the grass edge
  for (let k = 0; k < isl.palms; k++) {
    const a = rand() * TAU;
    const d = isl.r * (0.62 + rand() * 0.2);
    palm(g, Math.cos(a) * d * 1.05, Math.sin(a) * d * 0.85, 0.9 + rand() * 0.5, rand);
  }
  return { img: c, half: size / 2 };
}

// ─────────────────────────── ships ───────────────────────────
function hullPath(ctx, L, B) {
  ctx.beginPath();
  ctx.moveTo(L / 2, 0);
  ctx.quadraticCurveTo(L * 0.28, -B / 2, -L * 0.1, -B / 2);
  ctx.lineTo(-L / 2 + 4, -B * 0.42);
  ctx.quadraticCurveTo(-L / 2 - 2, 0, -L / 2 + 4, B * 0.42);
  ctx.lineTo(-L * 0.1, B / 2);
  ctx.quadraticCurveTo(L * 0.28, B / 2, L / 2, 0);
  ctx.closePath();
}

/**
 * Top-down ship at the origin facing +x.
 * o = { len, beam, masts, sail, sailTrim (0..1), flag, guns, hullColor, t, sinking }
 */
export function drawShip(ctx, o) {
  const L = o.len;
  const B = o.beam;
  // Shadow on the water
  ctx.fillStyle = "rgba(0,20,30,0.35)";
  ctx.save();
  ctx.translate(5, 7);
  hullPath(ctx, L, B);
  ctx.fill();
  ctx.restore();
  // Hull
  hullPath(ctx, L, B);
  const hg = ctx.createLinearGradient(0, -B / 2, 0, B / 2);
  hg.addColorStop(0, shade(o.hullColor, 0.25));
  hg.addColorStop(0.5, o.hullColor);
  hg.addColorStop(1, shade(o.hullColor, -0.3));
  ctx.fillStyle = hg;
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = INK;
  ctx.stroke();
  // Deck planks
  ctx.save();
  hullPath(ctx, L * 0.86, B * 0.74);
  ctx.clip();
  ctx.fillStyle = "#b98a55";
  ctx.fillRect(-L / 2, -B / 2, L, B);
  ctx.strokeStyle = "rgba(90,55,25,0.45)";
  ctx.lineWidth = 1;
  for (let y = -B / 2; y < B / 2; y += 4) {
    ctx.beginPath();
    ctx.moveTo(-L / 2, y);
    ctx.lineTo(L / 2, y);
    ctx.stroke();
  }
  ctx.restore();
  // Cannons poking out both sides
  ctx.fillStyle = "#1c1f24";
  const n = o.guns;
  for (let k = 0; k < n; k++) {
    const x = -L * 0.3 + (k / Math.max(1, n - 1)) * L * 0.5;
    ctx.fillRect(x - 3, -B / 2 - 4, 6, 5);
    ctx.fillRect(x - 3, B / 2 - 1, 6, 5);
  }
  // Jib from the bowsprit
  ctx.fillStyle = shade(o.sail, -0.08);
  ctx.beginPath();
  ctx.moveTo(L / 2 + 10, 0);
  ctx.lineTo(L * 0.3, -B * 0.28);
  ctx.quadraticCurveTo(L * 0.34 + o.sailTrim * 6, 0, L * 0.3, B * 0.28);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.2;
  ctx.stroke();
  // Square sails on their yards, wider than the hull, bellied forward by the wind
  for (let m = 0; m < o.masts; m++) {
    const mx = o.masts === 1 ? L * 0.02 : L * 0.2 - (m / (o.masts - 1)) * L * 0.5;
    const span = B * (1.9 - m * 0.12);
    const depth = 7 + o.sailTrim * 9;
    // Shadow cast on the deck/water
    ctx.fillStyle = "rgba(0,0,0,0.22)";
    ctx.beginPath();
    ctx.moveTo(mx + 4, -span / 2 + 5);
    ctx.quadraticCurveTo(mx + depth + 10, 5, mx + 4, span / 2 + 5);
    ctx.lineTo(mx - 2, span / 2 + 5);
    ctx.quadraticCurveTo(mx + depth * 0.4, 5, mx - 2, -span / 2 + 5);
    ctx.fill();
    // Canvas
    const sg = ctx.createLinearGradient(mx - 4, 0, mx + depth + 4, 0);
    sg.addColorStop(0, shade(o.sail, -0.2));
    sg.addColorStop(1, o.sail);
    ctx.fillStyle = sg;
    ctx.beginPath();
    ctx.moveTo(mx, -span / 2);
    ctx.quadraticCurveTo(mx + depth + 6, 0, mx, span / 2);
    ctx.lineTo(mx - 5, span / 2 - 1);
    ctx.quadraticCurveTo(mx + depth * 0.45, 0, mx - 5, -span / 2 + 1);
    ctx.closePath();
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = INK;
    ctx.stroke();
    // Seams and the yard
    ctx.strokeStyle = rgba("#000000", 0.18);
    ctx.lineWidth = 1;
    for (const f of [-0.25, 0, 0.25]) {
      ctx.beginPath();
      ctx.moveTo(mx - 3, span * f);
      ctx.lineTo(mx + depth * (1 - Math.abs(f)), span * f);
      ctx.stroke();
    }
    ctx.strokeStyle = "#4a3018";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(mx - 3, -span / 2 - 3);
    ctx.lineTo(mx - 3, span / 2 + 3);
    ctx.stroke();
    ctx.fillStyle = "#3a2410";
    ctx.beginPath();
    ctx.arc(mx - 3, 0, 3.5, 0, TAU);
    ctx.fill();
    if (o.emblem && m === 0) {
      ctx.fillStyle = o.emblem;
      ctx.beginPath();
      ctx.arc(mx + depth * 0.5, 0, 5, 0, TAU);
      ctx.fill();
    }
  }
  // Stern flag
  const wave = Math.sin(o.t * 8) * 3;
  ctx.fillStyle = o.flag;
  ctx.beginPath();
  ctx.moveTo(-L / 2 + 2, 0);
  ctx.lineTo(-L / 2 - 14, -6 + wave);
  ctx.lineTo(-L / 2 - 14, 6 + wave);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1;
  ctx.stroke();
}

// ─────────────────────────── sea features ───────────────────────────
export function drawRocks(ctx, f, t) {
  const r = mulberry32(f.seed);
  for (let k = 0; k < f.count; k++) {
    const x = f.x + (r() - 0.5) * f.spread * 2;
    const y = f.y + (r() - 0.5) * f.spread * 2;
    const s = 12 + r() * 26;
    ctx.strokeStyle = `rgba(255,255,255,${0.35 + Math.sin(t * 2 + k) * 0.15})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(x, y, s * 1.35, s * 1.15, 0, 0, TAU);
    ctx.stroke();
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.beginPath();
    ctx.ellipse(x + 4, y + 5, s, s * 0.85, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = patternOf(ctx, TEX.rock);
    ctx.beginPath();
    for (let a = 0; a < 8; a++) {
      const ang = (a / 8) * TAU;
      const rr = s * (0.8 + r() * 0.3);
      (a ? ctx.lineTo : ctx.moveTo).call(ctx, x + Math.cos(ang) * rr, y + Math.sin(ang) * rr * 0.85);
    }
    ctx.closePath();
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = INK;
    ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    ctx.beginPath();
    ctx.ellipse(x - s * 0.25, y - s * 0.3, s * 0.35, s * 0.2, -0.4, 0, TAU);
    ctx.fill();
  }
}
/** Rock positions used for collisions (same hash as the drawing). */
export function rockCircles(f) {
  const r = mulberry32(f.seed);
  const out = [];
  for (let k = 0; k < f.count; k++) {
    const x = f.x + (r() - 0.5) * f.spread * 2;
    const y = f.y + (r() - 0.5) * f.spread * 2;
    const s = 12 + r() * 26;
    r();
    r();
    r();
    r();
    r();
    r();
    r();
    r();
    out.push({ x, y, r: s });
  }
  return out;
}

export function drawStack(ctx, f, t) {
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.beginPath();
  ctx.ellipse(f.x + f.h * 0.5, f.y + f.h * 0.5, 34, 26, 0.6, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.5)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(f.x, f.y, 44, 36, 0, 0, TAU);
  ctx.stroke();
  const g = ctx.createRadialGradient(f.x - 10, f.y - 12, 4, f.x, f.y, 36);
  g.addColorStop(0, "#9aa0a6");
  g.addColorStop(1, "#4a4f55");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(f.x, f.y, 34, 28, 0, 0, TAU);
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = INK;
  ctx.stroke();
  ctx.fillStyle = "#e8eef2";
  for (let k = 0; k < 4; k++) ctx.fillRect(f.x - 12 + k * 7, f.y - 6 + (k % 2) * 6, 3, 2);
  // Gulls wheeling over it
  ctx.strokeStyle = "#f4f7fa";
  ctx.lineWidth = 1.5;
  for (let k = 0; k < 3; k++) {
    const a = t * 0.8 + k * 2.1;
    const x = f.x + Math.cos(a) * 60;
    const y = f.y + Math.sin(a) * 40 - 20;
    const flap = Math.sin(t * 10 + k) * 3;
    ctx.beginPath();
    ctx.moveTo(x - 6, y - flap);
    ctx.lineTo(x, y);
    ctx.lineTo(x + 6, y - flap);
    ctx.stroke();
  }
}

export function drawReef(ctx, f, t) {
  const g = ctx.createRadialGradient(f.x, f.y, 10, f.x, f.y, f.r);
  g.addColorStop(0, "rgba(90,230,210,0.5)");
  g.addColorStop(1, "rgba(90,230,210,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(f.x, f.y, f.r, 0, TAU);
  ctx.fill();
  const r = mulberry32(f.seed);
  const cols = ["#ff7a8a", "#ffb04a", "#c77dff", "#ffe066"];
  for (let k = 0; k < 26; k++) {
    const a = r() * TAU;
    const d = r() * f.r * 0.75;
    ctx.fillStyle = rgba(cols[k % 4], 0.55);
    ctx.beginPath();
    ctx.arc(f.x + Math.cos(a) * d, f.y + Math.sin(a) * d, 3 + r() * 5, 0, TAU);
    ctx.fill();
  }
  ctx.strokeStyle = `rgba(255,255,255,${0.2 + Math.sin(t * 1.5) * 0.08})`;
  ctx.setLineDash([6, 10]);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(f.x, f.y, f.r * 0.8, 0, TAU);
  ctx.stroke();
  ctx.setLineDash([]);
}

export function drawWreck(ctx, f, t, looted) {
  ctx.save();
  ctx.translate(f.x, f.y);
  ctx.rotate(f.angle);
  ctx.scale(f.size, f.size);
  // Hull half under water
  ctx.globalAlpha = 0.55;
  hullPath(ctx, 90, 28);
  ctx.fillStyle = "#3a2a1c";
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = "#5a3e24";
  ctx.beginPath();
  ctx.moveTo(45, 0);
  ctx.quadraticCurveTo(20, -14, -5, -13);
  ctx.lineTo(8, 2);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.stroke();
  // Snapped mast and torn sail
  ctx.fillStyle = "#4a3018";
  ctx.save();
  ctx.rotate(0.9);
  ctx.fillRect(-4, -30, 6, 46);
  ctx.restore();
  ctx.fillStyle = "rgba(230,220,195,0.7)";
  ctx.beginPath();
  ctx.moveTo(-10, -6);
  ctx.lineTo(10, -24);
  ctx.lineTo(4, -2);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  if (!looted) glow(ctx, f.x, f.y, 36, "#ffd24a", 0.2 + Math.sin(t * 3) * 0.1);
}

export function drawRuins(ctx, f, t) {
  const r = mulberry32(f.seed);
  ctx.strokeStyle = "rgba(90,230,210,0.35)";
  ctx.lineWidth = 16;
  ctx.beginPath();
  ctx.arc(f.x, f.y, 90, 0, TAU);
  ctx.stroke();
  for (let k = 0; k < f.pillars; k++) {
    const a = (k / f.pillars) * TAU;
    const x = f.x + Math.cos(a) * 90;
    const y = f.y + Math.sin(a) * 90;
    const broken = r() < 0.4;
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.beginPath();
    ctx.ellipse(x + 8, y + 10, 12, 9, 0.6, 0, TAU);
    ctx.fill();
    ctx.fillStyle = broken ? "#a39a86" : "#d8cfb8";
    ctx.beginPath();
    ctx.arc(x, y, 11, 0, TAU);
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = INK;
    ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.beginPath();
    ctx.arc(x - 3, y - 3, 4, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = "#b3a88f";
  ctx.beginPath();
  ctx.arc(f.x, f.y, 26, 0, TAU);
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = INK;
  ctx.stroke();
  glow(ctx, f.x, f.y, 40, "#7fffd4", 0.18 + Math.sin(t * 2) * 0.08);
}

export function drawLighthouse(ctx, f, t, night) {
  ctx.fillStyle = patternOf(ctx, TEX.rock);
  ctx.beginPath();
  ctx.ellipse(f.x, f.y, 46, 38, 0, 0, TAU);
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = INK;
  ctx.stroke();
  ctx.strokeStyle = "rgba(255,255,255,0.45)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(f.x, f.y, 54, 45, 0, 0, TAU);
  ctx.stroke();
  // Tower from above: striped rings
  for (const [rad, col] of [[18, "#e8e8e8"], [14, "#d63a3a"], [10, "#e8e8e8"], [6, "#2a2a2a"]]) {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(f.x, f.y, rad, 0, TAU);
    ctx.fill();
  }
  const a = t * 1.2;
  if (night) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const beam = ctx.createRadialGradient(f.x, f.y, 5, f.x, f.y, 420);
    beam.addColorStop(0, "rgba(255,245,200,0.5)");
    beam.addColorStop(1, "rgba(255,245,200,0)");
    ctx.fillStyle = beam;
    for (const off of [0, Math.PI]) {
      ctx.beginPath();
      ctx.moveTo(f.x, f.y);
      ctx.arc(f.x, f.y, 420, a + off - 0.12, a + off + 0.12);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }
  glow(ctx, f.x, f.y, 20, "#fff4c0", 0.7);
}

export function drawBuoy(ctx, f, t) {
  const bob = Math.sin(t * 2.4 + f.seed) * 2;
  ctx.strokeStyle = "rgba(255,255,255,0.4)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(f.x, f.y + bob, 12 + Math.sin(t * 2.4 + f.seed) * 2, 0, TAU);
  ctx.stroke();
  ctx.fillStyle = "#d63a3a";
  ctx.beginPath();
  ctx.arc(f.x, f.y + bob, 7, 0, TAU);
  ctx.fill();
  ctx.fillStyle = "#f2f2f2";
  ctx.fillRect(f.x - 7, f.y + bob - 1.5, 14, 3);
  if (Math.sin(t * 3 + f.seed) > 0.8) glow(ctx, f.x, f.y + bob, 10, "#ffd24a", 0.8);
}

export function drawWhirlpool(ctx, f, t) {
  ctx.save();
  ctx.translate(f.x, f.y);
  for (let k = 0; k < 6; k++) {
    ctx.rotate(t * 0.9 + k * 0.4);
    const rad = f.r * (1 - k / 7);
    ctx.strokeStyle = `rgba(220,245,255,${0.18 + k * 0.06})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, rad, 0, Math.PI * 1.3);
    ctx.stroke();
  }
  ctx.restore();
  const g = ctx.createRadialGradient(f.x, f.y, 4, f.x, f.y, f.r * 0.4);
  g.addColorStop(0, "rgba(0,10,20,0.9)");
  g.addColorStop(1, "rgba(0,10,20,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(f.x, f.y, f.r * 0.4, 0, TAU);
  ctx.fill();
}

export function drawCrate(ctx, f, t) {
  const bob = Math.sin(t * 2 + f.seed) * 1.5;
  const rot = Math.sin(t * 0.7 + f.seed) * 0.4;
  ctx.save();
  ctx.translate(f.x, f.y + bob);
  ctx.rotate(rot);
  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.lineWidth = 2;
  ctx.strokeRect(-12, -12, 24, 24);
  if (f.loot === "cargo") {
    ctx.fillStyle = "#8a5a2c";
    ctx.fillRect(-9, -9, 18, 18);
    ctx.strokeStyle = "#4a2e14";
    ctx.lineWidth = 2;
    ctx.strokeRect(-9, -9, 18, 18);
    ctx.beginPath();
    ctx.moveTo(-9, -9);
    ctx.lineTo(9, 9);
    ctx.stroke();
  } else {
    ctx.fillStyle = "#6b3f1f";
    ctx.beginPath();
    ctx.ellipse(0, 0, 11, 8, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = "#d9b24a";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-4, -8);
    ctx.lineTo(-4, 8);
    ctx.moveTo(4, -8);
    ctx.lineTo(4, 8);
    ctx.stroke();
  }
  ctx.restore();
  glow(ctx, f.x, f.y, 22, "#ffd24a", 0.18);
}

/** Fort tower seen from above: stone ring, cannon, team flag. */
export function drawFort(ctx, x, y, hp, maxHp, owner, t, angle) {
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.beginPath();
  ctx.arc(x + 5, y + 6, 22, 0, TAU);
  ctx.fill();
  ctx.fillStyle = "#8d8676";
  ctx.beginPath();
  ctx.arc(x, y, 22, 0, TAU);
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = INK;
  ctx.stroke();
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * TAU;
    ctx.fillStyle = "#6e6859";
    ctx.fillRect(x + Math.cos(a) * 18 - 3, y + Math.sin(a) * 18 - 3, 6, 6);
  }
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = "#1c1f24";
  ctx.fillRect(0, -3, 22, 6);
  ctx.restore();
  ctx.fillStyle = owner === "player" ? "#00bfa5" : "#b3202a";
  ctx.fillRect(x - 2, y - 30, 3, 14);
  ctx.beginPath();
  ctx.moveTo(x + 1, y - 30);
  ctx.lineTo(x + 14 + Math.sin(t * 6) * 2, y - 26);
  ctx.lineTo(x + 1, y - 22);
  ctx.fill();
  if (hp < maxHp && hp > 0) {
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(x - 20, y + 26, 40, 5);
    ctx.fillStyle = "#ff5a5a";
    ctx.fillRect(x - 20, y + 26, 40 * (hp / maxHp), 5);
  }
}

// ─────────────────────────── wildlife ───────────────────────────
export function drawDolphin(ctx, d, t) {
  const k = (t - d.t0) / d.dur; // 0..1 arc
  if (k < 0 || k > 1) return;
  const x = d.x + Math.cos(d.a) * k * 120;
  const y = d.y + Math.sin(d.a) * k * 120;
  const lift = Math.sin(k * Math.PI);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(d.a);
  ctx.globalAlpha = 0.35 + lift * 0.65;
  ctx.fillStyle = "#5a7a92";
  ctx.beginPath();
  ctx.ellipse(0, 0, 16 + lift * 6, 5, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = "#3e5a70";
  ctx.beginPath();
  ctx.moveTo(-16, 0);
  ctx.lineTo(-24, -6);
  ctx.lineTo(-24, 6);
  ctx.fill();
  ctx.restore();
  ctx.globalAlpha = 1;
  if (k < 0.12 || k > 0.88) {
    ctx.strokeStyle = "rgba(255,255,255,0.6)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, 8 + (k < 0.5 ? k : 1 - k) * 40, 0, TAU);
    ctx.stroke();
  }
}

export function drawWhale(ctx, w, t) {
  const k = (t - w.t0) / w.dur;
  if (k < 0 || k > 1) return;
  const up = Math.sin(k * Math.PI);
  ctx.save();
  ctx.translate(w.x + Math.cos(w.a) * k * 80, w.y + Math.sin(w.a) * k * 80);
  ctx.rotate(w.a);
  ctx.globalAlpha = up * 0.8;
  ctx.fillStyle = "#2a3d4d";
  ctx.beginPath();
  ctx.ellipse(0, 0, 60, 18, 0, 0, TAU);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-58, 0);
  ctx.lineTo(-80, -16);
  ctx.lineTo(-74, 0);
  ctx.lineTo(-80, 16);
  ctx.fill();
  ctx.restore();
  ctx.globalAlpha = 1;
  if (k > 0.3 && k < 0.6) {
    // Blow spout
    for (let s = 0; s < 6; s++) {
      ctx.fillStyle = `rgba(240,250,255,${0.5 - s * 0.07})`;
      ctx.beginPath();
      ctx.arc(w.x + Math.cos(w.a) * 40 + (Math.random() - 0.5) * 10, w.y + Math.sin(w.a) * 40 - s * 6, 5 + s, 0, TAU);
      ctx.fill();
    }
  }
}

export { glow, rgba, shade };
