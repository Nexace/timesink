// HEADBUTT art: chunky outlined cars, big-helmet drivers, themed arenas with animated crowds.
import { makeCanvas, mulberry32, noiseTile, patternOf, glow, shade, rgba } from "/shared/gfx.js";

const TAU = Math.PI * 2;
const OUT = "#0b0a10";
export const W = 1280;
export const H = 720;

// ─────────────────────────── helpers ───────────────────────────
function path(ctx, pts) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
}
function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function inked(ctx, fill, lw = 3) {
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = lw;
  ctx.strokeStyle = OUT;
  ctx.stroke();
}
function bodyGrad(ctx, y0, y1, color) {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, shade(color, 0.28));
  g.addColorStop(0.45, color);
  g.addColorStop(1, shade(color, -0.32));
  return g;
}
function partPath(ctx, p) {
  if (p.rect) {
    const [cx, cy, w, h] = p.rect;
    rr(ctx, cx - w / 2, cy - h / 2, w, h, Math.min(8, h / 3));
  } else path(ctx, p.poly);
}

// ─────────────────────────── driver ───────────────────────────
export function drawHelmet(ctx, x, y, r, color, t, opts = {}) {
  ctx.save();
  ctx.translate(x, y);
  // Shoulders / torso peeking out of the cabin
  if (!opts.noBody) {
    ctx.fillStyle = shade(color, -0.35);
    rr(ctx, -r * 0.9, r * 0.55, r * 1.8, r * 1.1, 5);
    ctx.fill();
    ctx.strokeStyle = OUT;
    ctx.lineWidth = 2.5;
    ctx.stroke();
  }
  // Helmet shell
  const g = ctx.createRadialGradient(-r * 0.35, -r * 0.45, r * 0.15, 0, 0, r * 1.05);
  g.addColorStop(0, shade(color, 0.55));
  g.addColorStop(0.6, color);
  g.addColorStop(1, shade(color, -0.35));
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, TAU);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = OUT;
  ctx.stroke();
  // Racing stripe
  ctx.save();
  ctx.clip();
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.fillRect(-r * 0.18, -r * 1.1, r * 0.36, r * 1.2);
  ctx.restore();
  // Visor
  ctx.beginPath();
  ctx.ellipse(r * 0.38, r * 0.05, r * 0.6, r * 0.42, 0, 0, TAU);
  const v = ctx.createLinearGradient(0, -r * 0.4, 0, r * 0.45);
  v.addColorStop(0, "#9fe6ff");
  v.addColorStop(1, "#1b3b66");
  ctx.fillStyle = v;
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,0.8)";
  ctx.fillRect(r * 0.2, -r * 0.22, r * 0.34, r * 0.14);
  // Target ring pulses so it's obvious what to hit
  if (opts.target) {
    ctx.strokeStyle = rgba(color, 0.35 + Math.sin(t * 6) * 0.2);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, r + 5 + Math.sin(t * 6) * 1.5, 0, TAU);
    ctx.stroke();
  }
  ctx.restore();
}

// ─────────────────────────── cars ───────────────────────────
/** Draw the car body in its local frame (facing right). Wheels are drawn separately. */
export function drawCarBody(ctx, def, t, opts = {}) {
  const c = def.color;
  const a = def.accent;
  // Silhouette from the collision parts
  for (const p of def.parts) {
    partPath(ctx, p);
    inked(ctx, bodyGrad(ctx, -70, 10, c));
  }
  ctx.lineJoin = "round";
  const s = def.style;
  if (s === "hotrod") {
    // Flames on the flank, chrome bumper, blower and exhaust
    ctx.fillStyle = a;
    path(ctx, [[-50, -14], [-8, -14], [4, -22], [-4, -18], [14, -24], [2, -12], [20, -16], [-50, -8]]);
    ctx.fill();
    ctx.fillStyle = "#ff6a00";
    path(ctx, [[-50, -12], [-14, -12], [-4, -18], [-10, -14], [4, -18], [-4, -10], [-50, -10]]);
    ctx.fill();
    rr(ctx, 58, -18, 10, 14, 3);
    inked(ctx, "#d7dde6", 2);
    rr(ctx, 26, -40, 18, 10, 2);
    inked(ctx, "#b9c1cc", 2);
    ctx.fillStyle = "#4a4f59";
    for (let k = 0; k < 3; k++) ctx.fillRect(28 + k * 5, -46, 3, 6);
    windows(ctx, [[-20, -40], [14, -40], [20, -32], [-24, -32]]);
    headlight(ctx, 62, -22, t);
    taillight(ctx, -57, -24);
  } else if (s === "pickup") {
    windows(ctx, [[4, -54], [38, -54], [30, -38], [2, -38]]);
    ctx.fillStyle = shade(c, -0.25);
    ctx.fillRect(-60, -34, 56, 4);
    rr(ctx, -58, -44, 50, 10, 2);
    inked(ctx, shade(c, 0.1), 2);
    ctx.fillStyle = a;
    ctx.fillRect(-60, -20, 128, 4);
    rr(ctx, 64, -26, 8, 16, 3);
    inked(ctx, "#cfd6df", 2);
    headlight(ctx, 64, -28, t);
    taillight(ctx, -64, -28);
  } else if (s === "monster") {
    // Tall suspension struts and a roll bar
    ctx.strokeStyle = "#3a3f47";
    ctx.lineWidth = 6;
    for (const x of [-40, 40]) {
      ctx.beginPath();
      ctx.moveTo(x, -4);
      ctx.lineTo(x * 0.8, -34);
      ctx.stroke();
    }
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#e0e4ea";
    for (const x of [-40, 40]) {
      ctx.beginPath();
      ctx.moveTo(x, -6);
      ctx.lineTo(x * 0.8, -32);
      ctx.stroke();
    }
    for (const p of def.parts) {
      partPath(ctx, p);
      inked(ctx, bodyGrad(ctx, -80, -30, c));
    }
    windows(ctx, [[-12, -75], [24, -75], [18, -61], [-14, -61]]);
    ctx.fillStyle = a;
    for (let k = 0; k < 5; k++) ctx.fillRect(-50 + k * 22, -52, 12, 8);
    ctx.fillStyle = "#ffd23f";
    for (let k = 0; k < 4; k++) {
      ctx.beginPath();
      ctx.arc(-8 + k * 10, -80, 3, 0, TAU);
      ctx.fill();
    }
    headlight(ctx, 54, -48, t);
  } else if (s === "kart") {
    ctx.fillStyle = a;
    ctx.fillRect(-44, -10, 88, 3);
    rr(ctx, -20, -24, 30, 12, 4);
    inked(ctx, "#2b2b30", 2);
    rr(ctx, 36, -18, 14, 8, 3);
    inked(ctx, shade(c, -0.2), 2);
    ctx.strokeStyle = "#2b2b30";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(18, -18);
    ctx.lineTo(8, -30);
    ctx.stroke();
    ctx.fillStyle = "#1b1b1b";
    ctx.beginPath();
    ctx.arc(8, -31, 5, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "#e8e8e8";
    ctx.font = "bold 10px monospace";
    decal(ctx, "07", -34, -8, opts);
  } else if (s === "dozer") {
    // Blade teeth, cab cage, exhaust stack
    ctx.fillStyle = "#6b6f78";
    for (let k = 0; k < 4; k++) {
      path(ctx, [[78, -38 + k * 11], [86, -34 + k * 11], [78, -30 + k * 11]]);
      ctx.fill();
    }
    windows(ctx, [[-26, -62], [2, -62], [2, -44], [-26, -44]]);
    ctx.strokeStyle = OUT;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-12, -62);
    ctx.lineTo(-12, -44);
    ctx.stroke();
    rr(ctx, 16, -60, 7, 22, 2);
    inked(ctx, "#3a3d44", 2);
    ctx.fillStyle = OUT;
    for (let k = 0; k < 5; k++) ctx.fillRect(-52 + k * 20, -12, 12, 4);
    ctx.fillStyle = "#1a1a1a";
    ctx.fillRect(-50, -28, 30, 6);
    ctx.fillStyle = "#f2f2f2";
    ctx.font = "bold 9px monospace";
    decal(ctx, "CAT-9", -35, -23, opts);
  } else if (s === "police") {
    ctx.fillStyle = a;
    ctx.fillRect(-58, -26, 124, 14);
    ctx.fillStyle = OUT;
    ctx.font = "bold 10px monospace";
    decal(ctx, "POLICE", 4, -15, opts);
    windows(ctx, [[-16, -40], [16, -40], [26, -30], [-26, -30]]);
    // Light bar flashing red/blue
    const on = Math.sin(t * 14) > 0;
    rr(ctx, -12, -50, 24, 7, 3);
    inked(ctx, "#1a1c22", 2);
    ctx.fillStyle = on ? "#ff2d3d" : "#5a0f16";
    ctx.fillRect(-10, -48, 9, 3);
    ctx.fillStyle = on ? "#1d3a78" : "#3b8cff";
    ctx.fillRect(1, -48, 9, 3);
    if (!opts.preview) glow(ctx, on ? -6 : 6, -47, 22, on ? "#ff2d3d" : "#3b8cff", 0.5);
    headlight(ctx, 66, -20, t);
    taillight(ctx, -60, -20);
  } else if (s === "buggy") {
    // Exposed roll cage over a slim tub
    ctx.strokeStyle = "#2d2f36";
    ctx.lineWidth = 6;
    path(ctx, [[-30, -27], [-22, -60], [14, -60], [26, -27]]);
    ctx.stroke();
    ctx.strokeStyle = shade(c, 0.2);
    ctx.lineWidth = 3;
    path(ctx, [[-30, -27], [-22, -60], [14, -60], [26, -27]]);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-22, -60);
    ctx.lineTo(26, -27);
    ctx.stroke();
    ctx.fillStyle = a;
    ctx.fillRect(-50, -18, 100, 4);
    rr(ctx, 44, -34, 10, 8, 2);
    inked(ctx, "#ffd23f", 2);
    glow(ctx, 54, -30, 10, "#fff4b0", 0.5);
  } else if (s === "icecream") {
    // Awning, serving hatch, giant cone on the roof
    ctx.fillStyle = a;
    for (let k = 0; k < 6; k++) {
      ctx.beginPath();
      ctx.arc(-58 + k * 16 + 8, -71, 8, 0, Math.PI);
      ctx.fill();
    }
    ctx.fillStyle = "#4a3a2e";
    rr(ctx, -50, -60, 56, 26, 3);
    ctx.fill();
    ctx.fillStyle = "#ffe9b0";
    ctx.fillRect(-46, -56, 48, 18);
    ctx.fillStyle = "#ff6fb5";
    ctx.font = "bold 9px monospace";
    decal(ctx, "SCOOPS", -22, -44, opts);
    windows(ctx, [[50, -60], [62, -60], [62, -34], [50, -34]]);
    // Cone
    ctx.fillStyle = "#e0a05a";
    path(ctx, [[-14, -72], [-2, -72], [-8, -92]].map(([x, y]) => [x, y]));
    ctx.fill();
    ctx.fillStyle = "#ff9ed1";
    ctx.beginPath();
    ctx.arc(-8, -76, 8, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = "#1a1a1a";
    ctx.fillRect(-60, 2, 124, 6);
    headlight(ctx, 62, -16, t);
  }
  // Soft sheen along the top of the silhouette
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = "#ffffff";
  for (const p of def.parts) {
    if (!p.rect) continue;
    const [cx, cy, w, h] = p.rect;
    ctx.fillRect(cx - w / 2 + 6, cy - h / 2 + 3, w - 12, 3);
  }
  ctx.globalAlpha = 1;
}

function decal(ctx, text, x, y, opts) {
  ctx.save();
  ctx.translate(x, y);
  if (opts.mirrored) ctx.scale(-1, 1);
  ctx.textAlign = "center";
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

function windows(ctx, pts) {
  path(ctx, pts);
  const g = ctx.createLinearGradient(0, pts[0][1], 0, pts[2][1]);
  g.addColorStop(0, "#bfefff");
  g.addColorStop(1, "#2d5d8f");
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = OUT;
  ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,0.45)";
  ctx.beginPath();
  ctx.moveTo(pts[0][0] + 4, pts[0][1] + 2);
  ctx.lineTo(pts[0][0] + 12, pts[0][1] + 2);
  ctx.lineTo(pts[3][0] + 6, pts[3][1] - 2);
  ctx.lineTo(pts[3][0] + 2, pts[3][1] - 2);
  ctx.fill();
}
function headlight(ctx, x, y, t) {
  ctx.fillStyle = "#fff6c8";
  ctx.beginPath();
  ctx.arc(x, y, 4, 0, TAU);
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = OUT;
  ctx.stroke();
  glow(ctx, x + 6, y, 16, "#fff3b0", 0.35);
}
function taillight(ctx, x, y) {
  ctx.fillStyle = "#ff2b3b";
  ctx.fillRect(x - 2, y - 3, 5, 7);
}

export function drawWheel(ctx, x, y, r, angle, accent) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, TAU);
  ctx.fillStyle = "#1a1b20";
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = OUT;
  ctx.stroke();
  // Tread blocks
  ctx.fillStyle = "#2c2e35";
  const n = Math.max(8, Math.round(r * 0.7));
  for (let k = 0; k < n; k++) {
    ctx.save();
    ctx.rotate((k / n) * TAU);
    ctx.fillRect(r - 4, -2.5, 4, 5);
    ctx.restore();
  }
  // Rim and spokes
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.55, 0, TAU);
  ctx.fillStyle = "#b8c0cc";
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.strokeStyle = shade(accent || "#888888", -0.1);
  ctx.lineWidth = 3;
  for (let k = 0; k < 5; k++) {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos((k / 5) * TAU) * r * 0.5, Math.sin((k / 5) * TAU) * r * 0.5);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.16, 0, TAU);
  ctx.fillStyle = "#e9edf2";
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = OUT;
  ctx.stroke();
  ctx.restore();
}

/** Small static render of a car (garage cards and the preview). */
export function carPreview(def, w, h, color) {
  const { c, ctx } = makeCanvas(w, h);
  const scale = Math.min(w / 190, h / 130);
  ctx.translate(w / 2, h * 0.72);
  ctx.scale(scale, scale);
  const d = color ? { ...def, color } : def;
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.beginPath();
  ctx.ellipse(0, Math.max(...def.wheels.map((q) => q.y + q.r)) + 4, 80, 8, 0, 0, TAU);
  ctx.fill();
  drawCarBody(ctx, d, 0, { preview: true });
  drawHelmet(ctx, def.head.x, def.head.y, def.head.r, "#00d8ff", 0);
  for (const wh of def.wheels) drawWheel(ctx, wh.x, wh.y, wh.r, 0.3, d.accent);
  return c;
}

// ─────────────────────────── arenas ───────────────────────────
const TEX = {
  concrete: noiseTile(96, { base: "#3b3f4a", seed: 4, blotches: [{ color: "#454a57", alpha: 0.5, count: 8, min: 8, max: 26 }], speckles: [{ color: "#555b69", density: 0.05 }, { color: "#2a2d35", density: 0.05 }] }),
  dirt: noiseTile(96, { base: "#6b4a2e", seed: 8, blotches: [{ color: "#7c5836", alpha: 0.5, count: 8, min: 8, max: 26 }], speckles: [{ color: "#8f6a44", density: 0.06 }, { color: "#4a3120", density: 0.05 }] }),
  rock: noiseTile(96, { base: "#2a1512", seed: 9, blotches: [{ color: "#3a1d17", alpha: 0.5, count: 8, min: 8, max: 26 }], speckles: [{ color: "#4d2a20", density: 0.05 }, { color: "#150a08", density: 0.05 }] }),
  regolith: noiseTile(96, { base: "#8d8f96", seed: 11, blotches: [{ color: "#9ea0a8", alpha: 0.5, count: 8, min: 8, max: 26 }, { color: "#6d6f76", alpha: 0.5, count: 6, min: 6, max: 18 }], speckles: [{ color: "#b3b5bc", density: 0.05 }, { color: "#5a5c63", density: 0.05 }] }),
  wood: noiseTile(96, { base: "#7a4f2c", seed: 12, blotches: [{ color: "#8a5d36", alpha: 0.5, count: 6, min: 12, max: 30 }], speckles: [{ color: "#5d3a1e", density: 0.04 }] }),
  ice: noiseTile(96, { base: "#cfe9f7", seed: 13, blotches: [{ color: "#e6f6ff", alpha: 0.6, count: 8, min: 10, max: 30 }], speckles: [{ color: "#a9d2ea", density: 0.03 }, { color: "#ffffff", density: 0.03 }] }),
  roof: noiseTile(96, { base: "#2b2e38", seed: 14, blotches: [{ color: "#333744", alpha: 0.5, count: 8, min: 8, max: 26 }], speckles: [{ color: "#3f4452", density: 0.05 }, { color: "#1c1e25", density: 0.05 }] }),
  soil: noiseTile(96, { base: "#2c2433", seed: 15, blotches: [{ color: "#372d40", alpha: 0.5, count: 8, min: 8, max: 26 }], speckles: [{ color: "#463a52", density: 0.05 }, { color: "#1c1621", density: 0.05 }] }),
  sand: noiseTile(96, { base: "#d9b36a", seed: 16, blotches: [{ color: "#e6c47e", alpha: 0.6, count: 9, min: 10, max: 30 }, { color: "#c49a52", alpha: 0.5, count: 7, min: 6, max: 20 }], speckles: [{ color: "#f2d898", density: 0.05 }, { color: "#a8803f", density: 0.05 }] }),
  stone: noiseTile(96, { base: "#4a4a52", seed: 17, blotches: [{ color: "#56565f", alpha: 0.55, count: 9, min: 10, max: 30 }, { color: "#3a3a41", alpha: 0.5, count: 6, min: 6, max: 20 }], speckles: [{ color: "#6a6a74", density: 0.05 }, { color: "#2c2c33", density: 0.05 }] }),
  sandstone: noiseTile(96, { base: "#a86a3c", seed: 18, blotches: [{ color: "#b97b48", alpha: 0.55, count: 9, min: 10, max: 30 }, { color: "#8e5530", alpha: 0.5, count: 6, min: 6, max: 20 }], speckles: [{ color: "#cf915a", density: 0.05 }, { color: "#6e3f22", density: 0.05 }] }),
  metal: noiseTile(96, { base: "#5b6270", seed: 19, blotches: [{ color: "#667080", alpha: 0.5, count: 6, min: 14, max: 34 }], speckles: [{ color: "#7c8696", density: 0.04 }, { color: "#454b56", density: 0.05 }] }),
  cage: noiseTile(96, { base: "#3c4452", seed: 20, blotches: [{ color: "#4a5364", alpha: 0.5, count: 6, min: 14, max: 34 }], speckles: [{ color: "#6f7a8c", density: 0.04 }, { color: "#262c36", density: 0.05 }] })
};
const THEME = {
  stadium: { tex: "concrete", top: "#b44dff", grass: null },
  junkyard: { tex: "dirt", top: "#9c7a4d" },
  volcano: { tex: "rock", top: "#ff6a1f" },
  moon: { tex: "regolith", top: "#d6d8de" },
  ship: { tex: "wood", top: "#c28c55" },
  ice: { tex: "ice", top: "#ffffff" },
  rooftop: { tex: "roof", top: "#00e5ff" },
  graveyard: { tex: "soil", top: "#6b8c3a" },
  sand: { tex: "sand", top: "#fff0c2" },
  desert: { tex: "sand", top: "#fff0c2" },
  planet: { tex: "sand", top: "#ffe7b0" },
  cave: { tex: "stone", top: "#9aa0ad" },
  goggles: { tex: "sand", top: "#fff0c2" },
  desertcave: { tex: "sandstone", top: "#f0b27a" },
  icecave: { tex: "ice", top: "#ffffff" },
  xmas: { tex: "ice", top: "#ffffff" },
  metal: { tex: "metal", top: "#ffd23f" },
  dome: { tex: "cage", top: "#7cff6b" },
  pool: { tex: "metal", top: "#ffffff" },
  void: { tex: "concrete", top: "#ffffff" }
};

function sky(g, top, bottom) {
  const s = g.createLinearGradient(0, 0, 0, H);
  s.addColorStop(0, top);
  s.addColorStop(1, bottom);
  g.fillStyle = s;
  g.fillRect(0, 0, W, H);
}
function stars(g, n, seed, alpha = 1) {
  const r = mulberry32(seed);
  for (let k = 0; k < n; k++) {
    g.fillStyle = `rgba(255,255,255,${(0.3 + r() * 0.7) * alpha})`;
    const s = r() < 0.1 ? 2 : 1;
    g.fillRect(r() * W, r() * H * 0.7, s, s);
  }
}

// Crowd heads live in the backdrop list and bob each frame
function crowdRows(rows, seed) {
  const r = mulberry32(seed);
  const people = [];
  const cols = ["#ff4d6d", "#ffd23f", "#3ec1ff", "#7cff6b", "#ff8a1f", "#c77dff", "#f4f4f4", "#ff5ea8"];
  for (const row of rows) {
    for (let x = row.x0; x < row.x1; x += 9 + r() * 5) {
      if (r() < 0.08) continue;
      people.push({ x, y: row.y, c: cols[Math.floor(r() * cols.length)], ph: r() * TAU, sp: 2 + r() * 4, arms: r() < 0.25 });
    }
  }
  return people;
}

export function buildArenaArt(key, arena) {
  const { c, ctx: g } = makeCanvas(W, H);
  const r = mulberry32(key.length * 977 + 13);
  let crowd = [];
  let lights = [];
  const theme = arena?.theme || key;
  if (arena?.section === "classic") {
    const out = classicBackdrop(g, theme, r, key);
    return { img: c, crowd: out.crowd || [], lights: out.lights || [] };
  }
  if (key === "stadium" || key === "ice") {
    sky(g, key === "ice" ? "#0c1830" : "#07030f", key === "ice" ? "#1c3558" : "#1a0b2e");
    // Tiered stands
    for (let k = 0; k < 5; k++) {
      const y = 150 + k * 52;
      g.fillStyle = k % 2 ? "#1a1428" : "#221a33";
      if (key === "ice") g.fillStyle = k % 2 ? "#1c2c47" : "#223656";
      g.fillRect(0, y, W, 52);
      g.fillStyle = "rgba(255,255,255,0.05)";
      g.fillRect(0, y, W, 2);
    }
    crowd = crowdRows([150, 202, 254, 306, 358].map((y) => ({ y: y + 26, x0: 10, x1: W - 10 })), 3);
    // Ad boards
    const ads = key === "ice" ? ["HOCKEY NIGHT", "TIMESINK", "ZAMBONI", "COLD BREW"] : ["HEADBUTT", "TIMESINK", "NITRO JUICE", "SMASH TV"];
    for (let k = 0; k < 8; k++) {
      const x = k * 160;
      g.fillStyle = ["#ff2d6f", "#00d8ff", "#ffd23f", "#8a5cff"][k % 4];
      g.fillRect(x + 4, 412, 152, 26);
      g.fillStyle = "#0b0a10";
      g.font = "bold 14px monospace";
      g.fillText(ads[k % 4], x + 16, 431);
    }
    // Jumbotron + floodlight towers
    g.fillStyle = "#0b0a10";
    g.fillRect(530, 30, 220, 96);
    g.fillStyle = key === "ice" ? "#123a6a" : "#2a0f4a";
    g.fillRect(538, 38, 204, 80);
    for (const x of [90, 1190]) {
      g.fillStyle = "#1b1b24";
      g.fillRect(x - 4, 20, 8, 140);
      g.fillStyle = "#e9ecf2";
      for (let k = 0; k < 4; k++) g.fillRect(x - 26 + k * 13, 14, 10, 8);
      lights.push({ x, y: 18 });
    }
  } else if (key === "junkyard") {
    sky(g, "#2b1b3d", "#ff9a5a");
    glow(g, 980, 330, 220, "#ffd9a0", 0.6);
    g.fillStyle = "#ffe0b0";
    g.beginPath();
    g.arc(980, 330, 60, 0, TAU);
    g.fill();
    // Junk pile silhouettes with car hulks
    for (let layer = 0; layer < 2; layer++) {
      g.fillStyle = layer ? "#3a2230" : "#57313a";
      g.beginPath();
      g.moveTo(0, H);
      for (let x = 0; x <= W; x += 40) g.lineTo(x, 420 + layer * 50 - Math.abs(Math.sin(x * 0.01 + layer)) * 90 - r() * 20);
      g.lineTo(W, H);
      g.fill();
    }
    for (let k = 0; k < 7; k++) {
      const x = 60 + k * 180 + r() * 60;
      const y = 470 + r() * 40;
      g.save();
      g.translate(x, y);
      g.rotate((r() - 0.5) * 0.8);
      g.fillStyle = ["#6b3a2a", "#3a4a5a", "#5a5a3a"][k % 3];
      g.fillRect(-40, -14, 80, 22);
      g.fillRect(-20, -26, 40, 14);
      g.fillStyle = "#1a1418";
      g.beginPath();
      g.arc(-24, 10, 9, 0, TAU);
      g.arc(24, 10, 9, 0, TAU);
      g.fill();
      g.restore();
    }
    // Crane with magnet
    g.strokeStyle = "#1c1216";
    g.lineWidth = 8;
    g.beginPath();
    g.moveTo(160, 520);
    g.lineTo(160, 120);
    g.lineTo(520, 150);
    g.stroke();
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(470, 146);
    g.lineTo(470, 280);
    g.stroke();
    g.fillStyle = "#1c1216";
    g.fillRect(440, 280, 60, 18);
    // Chain-link fence
    g.strokeStyle = "rgba(20,12,16,0.5)";
    g.lineWidth = 1;
    for (let x = 0; x < W; x += 14) {
      g.beginPath();
      g.moveTo(x, 520);
      g.lineTo(x + 40, 600);
      g.moveTo(x + 40, 520);
      g.lineTo(x, 600);
      g.stroke();
    }
  } else if (key === "volcano") {
    sky(g, "#12030a", "#4a0c05");
    // Cave walls and stalactites
    g.fillStyle = "#1a0705";
    for (let x = 0; x < W; x += 50) {
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x + 25, 60 + r() * 90);
      g.lineTo(x + 50, 0);
      g.fill();
    }
    // Lava falls
    for (const x of [140, 1120]) {
      const lf = g.createLinearGradient(x - 20, 0, x + 20, 0);
      lf.addColorStop(0, "rgba(255,80,20,0)");
      lf.addColorStop(0.5, "rgba(255,150,40,0.9)");
      lf.addColorStop(1, "rgba(255,80,20,0)");
      g.fillStyle = lf;
      g.fillRect(x - 20, 60, 40, 520);
      glow(g, x, 400, 140, "#ff5a1f", 0.3);
    }
    // Glowing cracks
    g.strokeStyle = "rgba(255,110,30,0.6)";
    g.lineWidth = 2;
    for (let k = 0; k < 22; k++) {
      let x = r() * W;
      let y = 150 + r() * 350;
      g.beginPath();
      g.moveTo(x, y);
      for (let s = 0; s < 5; s++) {
        x += (r() - 0.5) * 40;
        y += r() * 22;
        g.lineTo(x, y);
      }
      g.stroke();
    }
  } else if (key === "moon") {
    sky(g, "#000004", "#0b0d1a");
    stars(g, 380, 5);
    // Earth
    glow(g, 1000, 140, 160, "#4aa3ff", 0.35);
    g.fillStyle = "#1f6fd1";
    g.beginPath();
    g.arc(1000, 140, 64, 0, TAU);
    g.fill();
    g.fillStyle = "#3fb35a";
    g.beginPath();
    g.ellipse(980, 120, 26, 16, 0.4, 0, TAU);
    g.ellipse(1022, 160, 18, 12, -0.3, 0, TAU);
    g.fill();
    g.fillStyle = "rgba(0,0,0,0.45)";
    g.beginPath();
    g.arc(1024, 150, 64, -1.2, 1.9);
    g.fill();
    // Base domes and antenna
    for (const [x, rad] of [[220, 70], [360, 44], [1120, 56]]) {
      g.fillStyle = "#2a2d38";
      g.fillRect(x - rad - 10, 560, rad * 2 + 20, 20);
      const dg = g.createRadialGradient(x - rad * 0.3, 560 - rad * 0.6, 4, x, 560, rad);
      dg.addColorStop(0, "rgba(180,220,255,0.6)");
      dg.addColorStop(1, "rgba(60,90,140,0.35)");
      g.fillStyle = dg;
      g.beginPath();
      g.arc(x, 560, rad, Math.PI, 0);
      g.fill();
      g.strokeStyle = "#8fb4d8";
      g.lineWidth = 2;
      g.stroke();
    }
    g.strokeStyle = "#8a8f9a";
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(720, 580);
    g.lineTo(720, 380);
    g.stroke();
    lights.push({ x: 720, y: 378, blink: true });
    // Distant ridge
    g.fillStyle = "#3a3c44";
    g.beginPath();
    g.moveTo(0, 600);
    for (let x = 0; x <= W; x += 30) g.lineTo(x, 540 - Math.abs(Math.sin(x * 0.008)) * 70);
    g.lineTo(W, 600);
    g.fill();
  } else if (key === "ship") {
    sky(g, "#1d2b52", "#ff9a6b");
    glow(g, 640, 430, 240, "#ffcf8a", 0.55);
    g.fillStyle = "#ffe2a8";
    g.beginPath();
    g.arc(640, 440, 70, 0, TAU);
    g.fill();
    // Sea
    const sea = g.createLinearGradient(0, 440, 0, 620);
    sea.addColorStop(0, "#2b4f7a");
    sea.addColorStop(1, "#0f2340");
    g.fillStyle = sea;
    g.fillRect(0, 440, W, 200);
    g.fillStyle = "rgba(255,220,160,0.35)";
    for (let k = 0; k < 40; k++) g.fillRect(560 + (r() - 0.5) * 240, 450 + r() * 150, 20 + r() * 40, 2);
    // Masts, sails, rigging
    for (const [x, s] of [[200, 1], [1080, 0.85]]) {
      g.fillStyle = "#3a2414";
      g.fillRect(x - 6, 60, 12, 540);
      g.fillStyle = "#efe4cc";
      g.beginPath();
      g.moveTo(x - 110 * s, 110);
      g.quadraticCurveTo(x, 150, x + 110 * s, 110);
      g.lineTo(x + 100 * s, 300);
      g.quadraticCurveTo(x, 330, x - 100 * s, 300);
      g.fill();
      g.fillStyle = "rgba(0,0,0,0.15)";
      g.fillRect(x - 100 * s, 200, 200 * s, 8);
      g.fillStyle = "#111";
      g.beginPath();
      g.moveTo(x, 40);
      g.lineTo(x + 40, 52);
      g.lineTo(x, 64);
      g.fill();
      g.fillStyle = "#f4f4f4";
      g.beginPath();
      g.arc(x + 14, 52, 4, 0, TAU);
      g.fill();
    }
    g.strokeStyle = "rgba(30,20,10,0.6)";
    g.lineWidth = 1.5;
    for (let k = 0; k < 10; k++) {
      g.beginPath();
      g.moveTo(200, 70 + k * 18);
      g.lineTo(20 + k * 10, 600);
      g.moveTo(1080, 70 + k * 18);
      g.lineTo(1260 - k * 10, 600);
      g.stroke();
    }
    // Railing
    g.fillStyle = "#4a2c18";
    g.fillRect(0, 580, W, 10);
    for (let x = 10; x < W; x += 34) g.fillRect(x, 590, 6, 30);
  } else if (key === "rooftop") {
    sky(g, "#05030f", "#2a0f3a");
    stars(g, 120, 6, 0.6);
    g.fillStyle = "#f2efe0";
    g.beginPath();
    g.arc(1080, 110, 40, 0, TAU);
    g.fill();
    // Skyline layers with lit windows
    for (let layer = 0; layer < 3; layer++) {
      let x = 0;
      while (x < W) {
        const bw = 50 + r() * 90;
        const bh = 180 + r() * 260 - layer * 60;
        const y = 620 - bh;
        g.fillStyle = ["#120a22", "#1a0f30", "#241640"][layer];
        g.fillRect(x, y, bw - 4, bh);
        for (let wy = y + 10; wy < 610; wy += 14) {
          for (let wx = x + 6; wx < x + bw - 12; wx += 11) {
            if (r() < 0.35) {
              g.fillStyle = r() < 0.7 ? `rgba(255,214,120,${0.35 + layer * 0.2})` : `rgba(120,220,255,${0.35 + layer * 0.2})`;
              g.fillRect(wx, wy, 5, 7);
            }
          }
        }
        x += bw;
      }
    }
    // Neon signs
    for (const [x, y, text, col] of [[140, 300, "HOTEL", "#ff2d6f"], [1000, 260, "RAMEN", "#00e5ff"]]) {
      g.font = "bold 28px monospace";
      g.fillStyle = col;
      g.shadowColor = col;
      g.shadowBlur = 16;
      g.fillText(text, x, y);
      g.shadowBlur = 0;
    }
    // The drop between the towers
    const drop = g.createLinearGradient(0, 600, 0, H);
    drop.addColorStop(0, "rgba(0,0,0,0)");
    drop.addColorStop(1, "rgba(0,0,0,0.9)");
    g.fillStyle = drop;
    g.fillRect(500, 600, 280, 120);
  } else if (key === "graveyard") {
    sky(g, "#07050f", "#2a1a3d");
    stars(g, 160, 7, 0.7);
    glow(g, 300, 150, 200, "#d8e8ff", 0.35);
    g.fillStyle = "#e8eefa";
    g.beginPath();
    g.arc(300, 150, 56, 0, TAU);
    g.fill();
    g.fillStyle = "rgba(160,170,190,0.4)";
    g.beginPath();
    g.arc(284, 140, 10, 0, TAU);
    g.arc(318, 168, 7, 0, TAU);
    g.fill();
    // Dead trees
    const tree = (x, y, s) => {
      g.strokeStyle = "#140d1c";
      g.lineCap = "round";
      const branch = (bx, by, ang, len, w) => {
        if (len < 8) return;
        const ex = bx + Math.cos(ang) * len;
        const ey = by + Math.sin(ang) * len;
        g.lineWidth = w;
        g.beginPath();
        g.moveTo(bx, by);
        g.lineTo(ex, ey);
        g.stroke();
        branch(ex, ey, ang - 0.4 - r() * 0.3, len * 0.7, w * 0.7);
        branch(ex, ey, ang + 0.35 + r() * 0.3, len * 0.66, w * 0.7);
      };
      branch(x, y, -Math.PI / 2, 90 * s, 12 * s);
    };
    tree(160, 600, 1.2);
    tree(1120, 600, 1);
    // Crypt
    g.fillStyle = "#1f1a2b";
    g.fillRect(560, 380, 160, 220);
    g.beginPath();
    g.moveTo(550, 380);
    g.lineTo(640, 320);
    g.lineTo(730, 380);
    g.fill();
    g.fillStyle = "#0b0810";
    g.fillRect(610, 480, 60, 120);
    // Tombstones
    for (let k = 0; k < 12; k++) {
      const x = 40 + k * 105 + r() * 30;
      const y = 560 + r() * 30;
      g.fillStyle = "#3a3448";
      g.beginPath();
      g.moveTo(x - 14, y + 40);
      g.lineTo(x - 14, y);
      g.arc(x, y, 14, Math.PI, 0);
      g.lineTo(x + 14, y + 40);
      g.fill();
      g.fillStyle = "rgba(0,0,0,0.3)";
      g.fillRect(x - 6, y + 4, 12, 3);
    }
  }
  return { img: c, crowd, lights };
}

// Drive Ahead's arenas sit in a daytime stadium; caves, domes and the rest get their own scenery.
function stadiumDay(g, r, opts = {}) {
  sky(g, opts.top || "#5fb6ff", opts.bottom || "#cfeaff");
  // Clouds
  g.fillStyle = "rgba(255,255,255,0.85)";
  for (let k = 0; k < 6; k++) {
    const x = r() * W;
    const y = 30 + r() * 90;
    for (let b = 0; b < 4; b++) {
      g.beginPath();
      g.arc(x + b * 26, y + (b % 2) * 6, 22 + r() * 10, 0, TAU);
      g.fill();
    }
  }
  // Stands in a bowl
  for (let k = 0; k < 5; k++) {
    const y = 190 + k * 44;
    g.fillStyle = k % 2 ? "#3d4a66" : "#46557a";
    g.fillRect(0, y, W, 44);
    g.fillStyle = "rgba(255,255,255,0.08)";
    g.fillRect(0, y, W, 2);
  }
  const crowd = crowdRows([190, 234, 278, 322, 366].map((y) => ({ y: y + 24, x0: 10, x1: W - 10 })), 11);
  // Jumbotron between two floodlight towers
  g.fillStyle = "#12141c";
  g.fillRect(500, 34, 280, 120);
  const scr = g.createLinearGradient(0, 44, 0, 144);
  scr.addColorStop(0, "#1b6fd8");
  scr.addColorStop(1, "#0d2e66");
  g.fillStyle = scr;
  g.fillRect(510, 44, 260, 100);
  g.fillStyle = "#ffffff";
  g.font = "bold 22px monospace";
  g.textAlign = "center";
  g.fillText(opts.screen || "HEADBUTT!", 640, 102);
  g.textAlign = "left";
  const lights = [];
  for (const x of [120, 1160]) {
    g.fillStyle = "#2a2f3c";
    g.fillRect(x - 4, 40, 8, 180);
    g.fillStyle = "#f4f6fb";
    for (let k = 0; k < 4; k++) g.fillRect(x - 26 + k * 13, 30, 10, 10);
    lights.push({ x, y: 34 });
  }
  // Ad boards
  const ads = ["HEADBUTT", "TIMESINK", "NITRO", "BONK TV"];
  for (let k = 0; k < 8; k++) {
    g.fillStyle = ["#ff2d6f", "#00b4ff", "#ffd23f", "#34d17a"][k % 4];
    g.fillRect(k * 160 + 4, 410, 152, 26);
    g.fillStyle = "#0b0a10";
    g.font = "bold 14px monospace";
    g.fillText(ads[k % 4], k * 160 + 18, 429);
  }
  return { crowd, lights };
}

function rockWall(g, r, base, dark, light) {
  g.fillStyle = base;
  g.fillRect(0, 0, W, H);
  for (let k = 0; k < 90; k++) {
    g.fillStyle = r() < 0.5 ? dark : light;
    g.globalAlpha = 0.25 + r() * 0.3;
    g.beginPath();
    g.ellipse(r() * W, r() * H, 20 + r() * 70, 10 + r() * 40, r() * 3, 0, TAU);
    g.fill();
  }
  g.globalAlpha = 1;
}

function stalactites(g, r, color, y0 = 90) {
  g.fillStyle = color;
  for (let x = 0; x < W; x += 34 + r() * 30) {
    g.beginPath();
    g.moveTo(x, y0);
    g.lineTo(x + 10 + r() * 6, y0 + 30 + r() * 70);
    g.lineTo(x + 22, y0);
    g.fill();
  }
}

function classicBackdrop(g, theme, r, key) {
  if (theme === "sand" || theme === "void") return stadiumDay(g, r, { screen: theme === "void" ? "?!?" : key === "triplehill" ? "REPLAY" : "HEADBUTT!" });
  if (theme === "desert") {
    // Mexican Standoff: high noon over the mesas
    sky(g, "#ffb347", "#ffe6a8");
    glow(g, 1000, 120, 180, "#fff6d0", 0.8);
    g.fillStyle = "#fffbe6";
    g.beginPath();
    g.arc(1000, 120, 52, 0, TAU);
    g.fill();
    for (let layer = 0; layer < 2; layer++) {
      g.fillStyle = layer ? "#b8683c" : "#d98a4e";
      let x = -40;
      while (x < W) {
        const w = 120 + r() * 200;
        const h = 120 + r() * 140 - layer * 40;
        g.fillRect(x, 560 - h, w, h + 200);
        g.fillRect(x - 14, 560 - h, w + 28, 16);
        x += w + 40 + r() * 80;
      }
    }
    // Cacti
    g.fillStyle = "#2f7a3a";
    for (const x of [140, 1120, 260]) {
      g.fillRect(x, 470, 16, 120);
      g.fillRect(x - 22, 500, 22, 12);
      g.fillRect(x - 22, 480, 10, 30);
      g.fillRect(x + 16, 520, 20, 12);
      g.fillRect(x + 26, 494, 10, 36);
    }
    return {};
  }
  if (theme === "planet") {
    sky(g, "#0b0620", "#3a1e5c");
    stars(g, 320, 21);
    glow(g, 260, 150, 200, "#ff9ad5", 0.35);
    g.fillStyle = "#c05a9a";
    g.beginPath();
    g.arc(260, 150, 70, 0, TAU);
    g.fill();
    g.strokeStyle = "rgba(255,210,240,0.6)";
    g.lineWidth = 4;
    g.beginPath();
    g.ellipse(260, 150, 120, 26, -0.3, 0, TAU);
    g.stroke();
    g.fillStyle = "#6fd3ff";
    g.beginPath();
    g.arc(1060, 90, 22, 0, TAU);
    g.fill();
    return {};
  }
  if (theme === "cave" || theme === "goggles") {
    rockWall(g, r, "#22232a", "#15161b", "#2f3039");
    stalactites(g, r, "#15161b");
    if (theme === "goggles") {
      const sandBg = g.createLinearGradient(0, 380, 0, H);
      sandBg.addColorStop(0, "rgba(160,120,60,0)");
      sandBg.addColorStop(1, "rgba(160,120,60,0.55)");
      g.fillStyle = sandBg;
      g.fillRect(0, 380, W, H);
    }
    // Wall torches
    for (const x of [300, 980]) {
      g.fillStyle = "#3a2a1a";
      g.fillRect(x - 3, 250, 6, 40);
      glow(g, x, 240, 120, "#ffb347", 0.35);
    }
    return {};
  }
  if (theme === "desertcave") {
    rockWall(g, r, "#5a3320", "#44261a", "#6e4029");
    stalactites(g, r, "#3a2016");
    for (let k = 0; k < 5; k++) glow(g, 150 + k * 250, 300 + r() * 80, 110, "#ffcf8a", 0.18);
    return {};
  }
  if (theme === "icecave") {
    rockWall(g, r, "#16324f", "#0e243b", "#23496f");
    stalactites(g, r, "#bfe6ff", 140);
    for (let k = 0; k < 40; k++) {
      g.fillStyle = `rgba(200,240,255,${0.2 + r() * 0.4})`;
      g.fillRect(r() * W, r() * H, 2, 2);
    }
    // Daylight through the roof gap
    const beam = g.createLinearGradient(0, 80, 0, 600);
    beam.addColorStop(0, "rgba(220,245,255,0.35)");
    beam.addColorStop(1, "rgba(220,245,255,0)");
    g.fillStyle = beam;
    g.beginPath();
    g.moveTo(560, 80);
    g.lineTo(720, 80);
    g.lineTo(800, 640);
    g.lineTo(480, 640);
    g.fill();
    g.fillStyle = "#9fd8ff";
    g.fillRect(560, 0, 160, 80);
    return {};
  }
  if (theme === "xmas") {
    sky(g, "#0a1430", "#27406e");
    stars(g, 160, 23, 0.8);
    // Snowy hills and pine trees with fairy lights
    g.fillStyle = "#dfe9f7";
    g.beginPath();
    g.moveTo(0, H);
    for (let x = 0; x <= W; x += 40) g.lineTo(x, 520 - Math.abs(Math.sin(x * 0.006)) * 90);
    g.lineTo(W, H);
    g.fill();
    const lights = [];
    for (const [x, s] of [[120, 1.3], [420, 0.9], [880, 1.1], [1160, 1.4]]) {
      g.fillStyle = "#123b24";
      for (let k = 0; k < 4; k++) {
        g.beginPath();
        g.moveTo(x, 330 - 40 * s + k * 40 * s);
        g.lineTo(x + (50 + k * 18) * s, 420 * 1 + k * 40 * s - 60 * s);
        g.lineTo(x - (50 + k * 18) * s, 420 * 1 + k * 40 * s - 60 * s);
        g.fill();
      }
      for (let k = 0; k < 10; k++) {
        const c = ["#ff3b3b", "#ffd23f", "#3ec1ff", "#7cff6b"][k % 4];
        glow(g, x + (r() - 0.5) * 90 * s, 340 + r() * 140 * s, 8, c, 0.9);
      }
      g.fillStyle = "#ffd23f";
      g.beginPath();
      g.arc(x, 330 - 44 * s, 8, 0, TAU);
      g.fill();
    }
    for (let k = 0; k < 160; k++) {
      g.fillStyle = "rgba(255,255,255,0.8)";
      g.beginPath();
      g.arc(r() * W, r() * H, 1 + r() * 2, 0, TAU);
      g.fill();
    }
    return { lights };
  }
  if (theme === "metal") {
    g.fillStyle = "#2a2f38";
    g.fillRect(0, 0, W, H);
    for (let y = 0; y < H; y += 80) {
      for (let x = (y / 80) % 2 ? -60 : 0; x < W; x += 120) {
        g.fillStyle = (x + y) % 240 ? "#323845" : "#2d3340";
        g.fillRect(x + 2, y + 2, 116, 76);
        g.fillStyle = "#4a5160";
        for (const [dx, dy] of [[8, 8], [108, 8], [8, 68], [108, 68]]) g.fillRect(x + dx, y + dy, 4, 4);
      }
    }
    for (let x = 0; x < W; x += 40) {
      g.fillStyle = (x / 40) % 2 ? "#ffd23f" : "#1b1d22";
      g.beginPath();
      g.moveTo(x, 600);
      g.lineTo(x + 40, 600);
      g.lineTo(x + 20, 620);
      g.lineTo(x - 20, 620);
      g.fill();
    }
    return { lights: [{ x: 640, y: 20, blink: true }] };
  }
  if (theme === "dome") {
    sky(g, "#050a08", "#0d1f18");
    stars(g, 140, 29, 0.5);
    // Scaffolding and the acid glow underneath the cage
    g.strokeStyle = "rgba(90,110,100,0.35)";
    g.lineWidth = 6;
    for (let x = 60; x < W; x += 170) {
      g.beginPath();
      g.moveTo(x, H);
      g.lineTo(x + 60, 0);
      g.stroke();
    }
    glow(g, 640, 720, 520, "#7cff3b", 0.35);
    return {};
  }
  if (theme === "pool") {
    g.fillStyle = "#cfe3ef";
    g.fillRect(0, 0, W, H);
    for (let y = 0; y < H; y += 32) {
      for (let x = 0; x < W; x += 32) {
        g.fillStyle = (x + y) % 64 ? "#d9ecf7" : "#c4dbe9";
        g.fillRect(x + 1, y + 1, 30, 30);
      }
    }
    // Diving board, flags and lane ropes
    g.fillStyle = "#1c4f7a";
    g.fillRect(60, 360, 220, 14);
    g.fillRect(60, 360, 20, 260);
    for (let x = 0; x < W; x += 60) {
      g.fillStyle = ["#ff3b3b", "#ffffff", "#1b6fd8"][(x / 60) % 3];
      g.beginPath();
      g.moveTo(x, 150);
      g.lineTo(x + 30, 170);
      g.lineTo(x + 60, 150);
      g.fill();
    }
    g.strokeStyle = "#2b3a4a";
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(0, 150);
    g.lineTo(W, 150);
    g.stroke();
    g.fillStyle = "#0b0a10";
    g.font = "bold 40px monospace";
    g.fillText("NO RUNNING", 780, 300);
    return {};
  }
  return stadiumDay(g, r);
}

/** Water or acid: translucent body with a moving surface, drawn over whatever is under it. */
export function drawLiquid(ctx, y, kind, t, w = W, h = H) {
  const acid = kind === "acid";
  const g = ctx.createLinearGradient(0, y, 0, y + 260);
  g.addColorStop(0, acid ? "rgba(140,255,60,0.72)" : "rgba(60,170,255,0.6)");
  g.addColorStop(1, acid ? "rgba(30,90,10,0.9)" : "rgba(10,40,110,0.88)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(-200, h + 400);
  for (let k = 0; k <= 60; k++) {
    const px = -200 + ((w + 400) * k) / 60;
    ctx.lineTo(px, y + Math.sin(px * 0.03 + t * 2.4) * 3 + Math.sin(px * 0.011 - t * 1.3) * 3);
  }
  ctx.lineTo(w + 200, h + 400);
  ctx.fill();
  ctx.strokeStyle = acid ? "rgba(220,255,160,0.9)" : "rgba(220,245,255,0.85)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let k = 0; k <= 60; k++) {
    const px = -200 + ((w + 400) * k) / 60;
    const py = y + Math.sin(px * 0.03 + t * 2.4) * 3 + Math.sin(px * 0.011 - t * 1.3) * 3;
    k ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
  }
  ctx.stroke();
  if (acid) {
    for (let k = 0; k < 8; k++) {
      const bx = (k * 173 + t * 30) % w;
      const s = (Math.sin(t * 4 + k) + 1) * 3 + 1;
      ctx.fillStyle = "rgba(220,255,140,0.8)";
      ctx.beginPath();
      ctx.arc(bx, y + 8 + (k % 3) * 10, s, 0, TAU);
      ctx.fill();
    }
  }
}

/** Circular sawblade centred at (x, y). */
export function drawSaw(ctx, x, y, r, angle) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  const teeth = Math.max(12, Math.round(r / 3.2));
  ctx.beginPath();
  for (let k = 0; k < teeth; k++) {
    const a0 = (k / teeth) * TAU;
    const a1 = ((k + 0.55) / teeth) * TAU;
    ctx.lineTo(Math.cos(a0) * r * 0.86, Math.sin(a0) * r * 0.86);
    ctx.lineTo(Math.cos(a1) * r, Math.sin(a1) * r);
  }
  ctx.closePath();
  const g = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
  g.addColorStop(0, "#f4f6fa");
  g.addColorStop(1, "#8a93a3");
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = OUT;
  ctx.stroke();
  ctx.strokeStyle = "rgba(0,0,0,0.25)";
  ctx.lineWidth = 2;
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * TAU;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * r * 0.25, Math.sin(a) * r * 0.25);
    ctx.lineTo(Math.cos(a + 0.4) * r * 0.7, Math.sin(a + 0.4) * r * 0.7);
    ctx.stroke();
  }
  ctx.fillStyle = "#3a3f4a";
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.2, 0, TAU);
  ctx.fill();
  ctx.fillStyle = "#ffd23f";
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.08, 0, TAU);
  ctx.fill();
  ctx.restore();
}

/** Flaming meteor (or, rarely, a flaming cow) falling in sudden death. */
export function drawMeteor(ctx, x, y, r, angle, vx, vy, t, cow = false) {
  const sp = Math.hypot(vx, vy) || 1;
  const tx = -vx / sp;
  const ty = -vy / sp;
  for (let k = 5; k > 0; k--) glow(ctx, x + tx * k * r * 0.9, y + ty * k * r * 0.9, r * (1.8 - k * 0.2), k % 2 ? "#ff7a1f" : "#ffd23f", 0.35);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  if (cow) {
    ctx.fillStyle = "#f4f4f4";
    rr(ctx, -23, -14, 46, 28, 8);
    ctx.fill();
    ctx.fillStyle = "#1b1b1b";
    ctx.beginPath();
    ctx.ellipse(-8, -4, 8, 6, 0.3, 0, TAU);
    ctx.ellipse(10, 5, 6, 5, -0.4, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "#f7b2c0";
    ctx.fillRect(18, -6, 10, 10);
    for (const lx of [-16, -6, 6, 16]) {
      ctx.fillStyle = "#f4f4f4";
      ctx.fillRect(lx - 2, 12, 5, 10);
    }
    ctx.lineWidth = 2;
    ctx.strokeStyle = OUT;
    rr(ctx, -23, -14, 46, 28, 8);
    ctx.stroke();
  } else {
    ctx.fillStyle = "#5a3a2a";
    ctx.beginPath();
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * TAU;
      const rr2 = r * (0.8 + ((k * 37) % 5) * 0.06);
      ctx.lineTo(Math.cos(a) * rr2, Math.sin(a) * rr2);
    }
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#ffb347";
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  ctx.restore();
  void t;
}

/** Static geometry texture fill, lit top edge, ink outline. */
export function drawSolid(ctx, theme, shape, verts) {
  const th = THEME[theme] || THEME.stadium;
  path(ctx, verts);
  if (shape.deco === "girder") {
    ctx.fillStyle = "#3a3f4a";
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.strokeStyle = "#6b7280";
    ctx.lineWidth = 2;
    const xs = verts.map((v) => v[0]);
    const x0 = Math.min(...xs);
    const x1 = Math.max(...xs);
    for (let x = x0; x < x1; x += 20) {
      ctx.beginPath();
      ctx.moveTo(x, verts[0][1] - 20);
      ctx.lineTo(x + 20, verts[2][1] + 20);
      ctx.stroke();
    }
    ctx.restore();
  } else if (shape.deco === "barbell") {
    ctx.fillStyle = "#b9c0cc";
    ctx.fill();
  } else if (shape.deco === "plate") {
    ctx.fillStyle = "#1c1d24";
    ctx.fill();
  } else if (shape.deco === "rotor") {
    ctx.fillStyle = patternOf(ctx, TEX.metal);
    ctx.fill();
  } else if (shape.deco === "plank" || shape.deco === "bridge" || shape.deco === "sign") {
    ctx.fillStyle = shape.deco === "bridge" ? "#4a3a36" : shape.deco === "sign" ? "#241640" : "#6b4a2c";
    ctx.fill();
  } else {
    ctx.fillStyle = patternOf(ctx, TEX[shape.ice || shape.deco === "ice" ? "ice" : th.tex]);
    ctx.fill();
  }
  ctx.lineWidth = 3;
  ctx.strokeStyle = OUT;
  ctx.stroke();
  // Lit top edges (edges facing up)
  ctx.strokeStyle = shape.deco === "sign" ? "#ff2d6f" : th.top;
  ctx.lineWidth = 3;
  for (let i = 0; i < verts.length; i++) {
    const a = verts[i];
    const b = verts[(i + 1) % verts.length];
    const nx = b[1] - a[1];
    const ny = -(b[0] - a[0]);
    // outward normal pointing up (verts are clockwise in screen space)
    if (ny < -0.3 * Math.hypot(nx, ny)) {
      ctx.beginPath();
      ctx.moveTo(a[0], a[1] + 1.5);
      ctx.lineTo(b[0], b[1] + 1.5);
      ctx.stroke();
    }
  }
}

export function drawLava(ctx, x, y, w, h, t) {
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, "#ffd24a");
  g.addColorStop(0.15, "#ff6a1f");
  g.addColorStop(1, "#7a0f05");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(x, y + h);
  for (let k = 0; k <= 40; k++) {
    const px = x + (w * k) / 40;
    ctx.lineTo(px, y + Math.sin(px * 0.05 + t * 3) * 4);
  }
  ctx.lineTo(x + w, y + h);
  ctx.fill();
  glow(ctx, x + w / 2, y, w * 0.6, "#ff7a2a", 0.35);
  for (let k = 0; k < 6; k++) {
    const bx = x + ((k * 97 + t * 40) % w);
    const s = (Math.sin(t * 3 + k) + 1) * 3;
    ctx.fillStyle = "#ffe08a";
    ctx.beginPath();
    ctx.arc(bx, y + 6, s, 0, TAU);
    ctx.fill();
  }
}

export function drawSpikes(ctx, x, y, w, h, down = false) {
  const n = Math.max(3, Math.floor(w / 16));
  ctx.fillStyle = "#1b1b22";
  ctx.fillRect(x, down ? y - 6 : y + h - 6, w, 6);
  for (let k = 0; k < n; k++) {
    const sx = x + (w * k) / n;
    const sw = w / n;
    const g = ctx.createLinearGradient(sx, 0, sx + sw, 0);
    g.addColorStop(0, "#9aa3b2");
    g.addColorStop(0.5, "#eef1f6");
    g.addColorStop(1, "#6b7280");
    ctx.fillStyle = g;
    ctx.beginPath();
    if (down) {
      ctx.moveTo(sx, y);
      ctx.lineTo(sx + sw / 2, y + h);
      ctx.lineTo(sx + sw, y);
    } else {
      ctx.moveTo(sx, y + h);
      ctx.lineTo(sx + sw / 2, y);
      ctx.lineTo(sx + sw, y + h);
    }
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = OUT;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
}

/** Crowd heads bob; the ones with arms up wave. */
export function drawCrowd(ctx, crowd, t, excite = 0) {
  for (const p of crowd) {
    const bob = Math.abs(Math.sin(t * p.sp * 0.6 + p.ph)) * (1.5 + excite * 5);
    const y = p.y - bob;
    ctx.fillStyle = p.c;
    ctx.fillRect(p.x - 3, y, 6, 8);
    ctx.fillStyle = "#f1c9a5";
    ctx.fillRect(p.x - 2, y - 5, 5, 5);
    if (p.arms || (excite > 0.5 && p.ph > 3)) {
      ctx.fillStyle = p.c;
      ctx.fillRect(p.x - 5, y - 7 - bob * 0.5, 2, 7);
      ctx.fillRect(p.x + 4, y - 7 - bob * 0.5, 2, 7);
    }
  }
}

export function drawLights(ctx, lights, t) {
  for (const l of lights) {
    if (l.blink) {
      if (Math.sin(t * 4) > 0) glow(ctx, l.x, l.y, 16, "#ff3344", 0.8);
      continue;
    }
    const beam = ctx.createLinearGradient(l.x, l.y, l.x, 700);
    beam.addColorStop(0, "rgba(255,250,230,0.18)");
    beam.addColorStop(1, "rgba(255,250,230,0)");
    ctx.fillStyle = beam;
    ctx.beginPath();
    ctx.moveTo(l.x - 20, l.y);
    ctx.lineTo(l.x + 20, l.y);
    ctx.lineTo(l.x + (l.x < 640 ? 420 : -260), 700);
    ctx.lineTo(l.x + (l.x < 640 ? 160 : -520), 700);
    ctx.closePath();
    ctx.fill();
    glow(ctx, l.x, l.y, 40, "#fffbe0", 0.6);
  }
}

export { rgba, glow, shade };
