// Ironclad art: parallax sunset backdrop, sea, deck buildings, units, projectiles and FX.
// Everything procedural and cached; per-frame work is mostly drawImage plus a few strokes.
import { makeCanvas, mulberry32, noiseTile, patternOf, glow, rgba, shade } from "/src/core/gfx.js";

const TAU = Math.PI * 2;

// ─────────────────────────── Backdrop ───────────────────────────
// Parallax layers sit on the horizon. Each is pre-rendered in world units at scale 1.
const LAYER_H = 420;
const ROCK_TEX = noiseTile(96, {
  base: "#241a2e",
  seed: 31,
  blotches: [{ color: "#2e2238", alpha: 0.5, count: 8, min: 10, max: 34 }, { color: "#170f1f", alpha: 0.5, count: 8, min: 8, max: 26 }],
  speckles: [{ color: "#3a2b44", density: 0.05 }, { color: "#0e0914", density: 0.05 }]
});

function ridge(rand, w, base, rough, step = 6) {
  // 1D fractal ridge line (height above the horizon per x)
  const pts = [];
  const octaves = [
    [0.0021, 1],
    [0.0063, 0.45],
    [0.019, 0.18],
    [0.05, 0.06]
  ].map(([f, a]) => [f, a, rand() * 1000]);
  for (let x = 0; x <= w + step; x += step) {
    let h = 0;
    for (const [f, a, ph] of octaves) h += Math.sin(x * f + ph) * a + Math.sin(x * f * 1.7 + ph * 2) * a * 0.5;
    pts.push([x, base + h * rough]);
  }
  return pts;
}

function fillRidge(g, pts, baseY, fill) {
  g.beginPath();
  g.moveTo(pts[0][0], baseY);
  for (const [x, h] of pts) g.lineTo(x, baseY - h);
  g.lineTo(pts[pts.length - 1][0], baseY);
  g.closePath();
  g.fillStyle = fill;
  g.fill();
}

function lighthouse(g, x, baseY) {
  g.fillStyle = "#1a1322";
  g.beginPath();
  g.moveTo(x - 9, baseY);
  g.lineTo(x - 5, baseY - 70);
  g.lineTo(x + 5, baseY - 70);
  g.lineTo(x + 9, baseY);
  g.fill();
  g.fillStyle = "#2b1f33";
  for (let k = 0; k < 3; k++) g.fillRect(x - 8 + k, baseY - 18 - k * 20, 16 - k * 2, 6);
  g.fillStyle = "#120c18";
  g.fillRect(x - 8, baseY - 78, 16, 8);
  g.fillRect(x - 5, baseY - 86, 10, 8);
  g.fillStyle = "#ffd98a";
  g.fillRect(x - 4, baseY - 84, 8, 5);
}

function oilRig(g, x, baseY) {
  g.strokeStyle = "#140f1c";
  g.lineWidth = 3;
  for (const lx of [-26, 26]) {
    g.beginPath();
    g.moveTo(x + lx, baseY);
    g.lineTo(x + lx * 0.7, baseY - 50);
    g.stroke();
  }
  g.lineWidth = 1.2;
  for (let k = 0; k < 4; k++) {
    g.beginPath();
    g.moveTo(x - 26 + k * 2, baseY - k * 12);
    g.lineTo(x + 24 - k * 2, baseY - (k + 1) * 12);
    g.moveTo(x + 26 - k * 2, baseY - k * 12);
    g.lineTo(x - 24 + k * 2, baseY - (k + 1) * 12);
    g.stroke();
  }
  g.fillStyle = "#140f1c";
  g.fillRect(x - 34, baseY - 58, 68, 10);
  g.fillRect(x - 24, baseY - 74, 26, 16);
  g.fillRect(x + 12, baseY - 110, 5, 52);
  g.beginPath();
  g.moveTo(x + 14, baseY - 110);
  g.lineTo(x + 50, baseY - 92);
  g.lineTo(x + 50, baseY - 89);
  g.lineTo(x + 14, baseY - 104);
  g.fill();
  g.fillStyle = "#ffb86b";
  for (let k = 0; k < 5; k++) g.fillRect(x - 22 + k * 5, baseY - 69, 2, 2);
}

function wreck(g, x, baseY, s) {
  g.fillStyle = "#100c16";
  g.beginPath();
  g.moveTo(x - 60 * s, baseY);
  g.lineTo(x - 40 * s, baseY - 22 * s);
  g.lineTo(x + 30 * s, baseY - 34 * s);
  g.lineTo(x + 52 * s, baseY - 10 * s);
  g.lineTo(x + 58 * s, baseY);
  g.closePath();
  g.fill();
  g.fillRect(x - 6 * s, baseY - 54 * s, 3 * s, 26 * s);
  g.fillRect(x + 12 * s, baseY - 46 * s, 10 * s, 14 * s);
}

function fortress(g, x, baseY) {
  g.fillStyle = "#171120";
  g.fillRect(x - 40, baseY - 36, 80, 36);
  for (let k = 0; k < 8; k++) g.fillRect(x - 40 + k * 10, baseY - 42, 6, 6);
  g.fillRect(x - 54, baseY - 60, 20, 60);
  g.fillRect(x + 34, baseY - 52, 18, 52);
  g.fillStyle = "#ffcf7a";
  g.fillRect(x - 48, baseY - 48, 3, 4);
  g.fillRect(x + 40, baseY - 40, 3, 4);
}

function makeLayer(width, seed, opts) {
  const { c, ctx: g } = makeCanvas(Math.ceil(width), LAYER_H);
  const rand = mulberry32(seed);
  const baseY = LAYER_H;
  const pts = ridge(rand, width, opts.base, opts.rough);
  fillRidge(g, pts, baseY, opts.fill);
  if (opts.texture) {
    g.save();
    g.globalCompositeOperation = "source-atop";
    g.globalAlpha = opts.texture;
    g.fillStyle = patternOf(g, ROCK_TEX);
    g.fillRect(0, 0, c.width, c.height);
    g.restore();
  }
  // Sun-facing rim light on the ridge crest
  g.save();
  g.globalCompositeOperation = "source-atop";
  g.strokeStyle = opts.rim;
  g.lineWidth = 2;
  g.beginPath();
  for (let i = 0; i < pts.length; i++) (i ? g.lineTo : g.moveTo).call(g, pts[i][0], baseY - pts[i][1] + 1);
  g.stroke();
  // Haze thickening toward the waterline
  const hz = g.createLinearGradient(0, baseY - opts.base - opts.rough, 0, baseY);
  hz.addColorStop(0, "rgba(0,0,0,0)");
  hz.addColorStop(1, opts.haze);
  g.fillStyle = hz;
  g.fillRect(0, 0, c.width, c.height);
  g.restore();
  if (opts.props) opts.props(g, rand, baseY, width, pts);
  return c;
}

export function createBackdrop(worldW, maxViewW) {
  const layers = [
    {
      f: 0.12,
      img: makeLayer(worldW * 0.12 + maxViewW + 40, 11, { base: 120, rough: 70, fill: "#3b2440", rim: "rgba(255, 160, 120, 0.35)", haze: "rgba(200, 96, 80, 0.55)", texture: 0.25 })
    },
    {
      f: 0.3,
      img: makeLayer(worldW * 0.3 + maxViewW + 40, 23, {
        base: 70,
        rough: 55,
        fill: "#281a30",
        rim: "rgba(255, 140, 100, 0.4)",
        haze: "rgba(150, 70, 70, 0.5)",
        texture: 0.45,
        props: (g, rand, baseY, width) => {
          for (let x = 300; x < width; x += 900 + rand() * 500) lighthouse(g, x, baseY - 8);
          for (let x = 700; x < width; x += 1300 + rand() * 600) fortress(g, x, baseY - 4);
        }
      })
    },
    {
      f: 0.55,
      img: makeLayer(worldW * 0.55 + maxViewW + 40, 37, {
        base: 16,
        rough: 22,
        fill: "#1a1222",
        rim: "rgba(255, 150, 110, 0.35)",
        haze: "rgba(90, 44, 60, 0.45)",
        texture: 0.5,
        props: (g, rand, baseY, width) => {
          for (let x = 500; x < width; x += 1100 + rand() * 700) oilRig(g, x, baseY - 2);
          for (let x = 180; x < width; x += 600 + rand() * 500) wreck(g, x, baseY + 2, 0.7 + rand() * 0.5);
          // Sea stacks
          for (let x = 90; x < width; x += 380 + rand() * 420) {
            const h = 30 + rand() * 50;
            const w = 14 + rand() * 18;
            g.fillStyle = "#150f1c";
            g.beginPath();
            g.moveTo(x - w, baseY);
            g.lineTo(x - w * 0.6, baseY - h);
            g.lineTo(x + w * 0.4, baseY - h - 6);
            g.lineTo(x + w, baseY);
            g.fill();
            g.fillStyle = "rgba(255, 150, 110, 0.25)";
            g.fillRect(x - w * 0.6, baseY - h, w, 2);
          }
        }
      })
    }
  ];

  // Cloud sprites: lit tops, violet undersides
  const clouds = [];
  for (let k = 0; k < 6; k++) {
    const rand = mulberry32(100 + k);
    const w = 220 + rand() * 180;
    const h = 90;
    const { c, ctx: g } = makeCanvas(w, h);
    const puffs = [];
    for (let p = 0; p < 14; p++) puffs.push([26 + rand() * (w - 52), 46 + rand() * 18, 12 + rand() * 20]);
    const layer = (dy, scale, fill) => {
      g.fillStyle = fill;
      g.beginPath();
      for (const [x, y, r] of puffs) {
        g.moveTo(x + r * 1.5 * scale, y + dy);
        g.ellipse(x, y + dy, r * 1.5 * scale, r * scale, 0, 0, TAU);
      }
      g.fill();
    };
    // Opaque layers (the sprite is faded as a whole when drawn, so puffs never stack into rings)
    layer(8, 1, "#3e2140");
    layer(3, 0.93, "#7a3d57");
    layer(-2, 0.78, "#c46a62");
    layer(-6, 0.52, "#f2a27a");
    g.globalCompositeOperation = "destination-out";
    g.fillStyle = "rgba(0,0,0,1)";
    g.fillRect(0, h - 16, w, 16);
    clouds.push(c);
  }

  // Stars for the upper sky
  const stars = [];
  const sr = mulberry32(7);
  for (let k = 0; k < 160; k++) stars.push([sr(), sr(), 0.3 + sr() * 0.7]);

  return { layers, clouds, stars };
}

/**
 * Screen-space sky, sun and parallax ranges. `cam` = {x, y, zoom}; horizonY is the world waterline.
 * Returns the sun's screen x so the sea can place its glitter column.
 */
export function drawBackdrop(ctx, bd, cam, W, H, horizonY, t) {
  const z = cam.zoom;
  const hy = (horizonY - cam.y) * z;
  const sky = ctx.createLinearGradient(0, hy - 620 * z, 0, hy);
  sky.addColorStop(0, "#070a18");
  sky.addColorStop(0.3, "#1b1533");
  sky.addColorStop(0.58, "#4b2445");
  sky.addColorStop(0.8, "#9c3f45");
  sky.addColorStop(0.93, "#dc7247");
  sky.addColorStop(1, "#f3a25a");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, hy + 2);

  // Stars fade out toward the glow
  for (const [sx, sy, a] of bd.stars) {
    const y = sy * (hy - 260 * z);
    if (y < 0) continue;
    const tw = 0.6 + Math.sin(t * 2 + sx * 50) * 0.4;
    ctx.fillStyle = `rgba(255, 240, 220, ${a * tw * Math.max(0, 1 - y / Math.max(1, hy - 260 * z)) * 0.8})`;
    ctx.fillRect(sx * W, y, 1.5, 1.5);
  }

  // Sun low on the horizon with banded haze
  const sunX = W * 0.5 - cam.x * 0.06 * z + 180;
  const sunY = hy - 34 * z;
  glow(ctx, sunX, sunY, 420 * z, "#ff8a4c", 0.35);
  glow(ctx, sunX, sunY, 160 * z, "#ffd27a", 0.55);
  ctx.fillStyle = "#ffe2a0";
  ctx.beginPath();
  ctx.arc(sunX, sunY, 58 * z, 0, TAU);
  ctx.fill();
  ctx.fillStyle = "rgba(220, 110, 80, 0.55)";
  for (let k = 0; k < 4; k++) ctx.fillRect(sunX - 70 * z, sunY + (4 + k * 11) * z, 140 * z, (2 + k) * z);

  // Clouds drift slowly on their own parallax plane
  for (let k = 0; k < 9; k++) {
    const img = bd.clouds[k % bd.clouds.length];
    const span = W + img.width * z * 2;
    const x = ((k * 431 + t * (5 + (k % 3) * 3) - cam.x * 0.2 * z) % span + span) % span - img.width * z;
    const y = hy - (230 + ((k * 73) % 200)) * z;
    ctx.globalAlpha = 0.55 + (k % 3) * 0.1;
    ctx.drawImage(img, x, y, img.width * z * (0.8 + (k % 3) * 0.2), img.height * z * (0.8 + (k % 3) * 0.2));
  }
  ctx.globalAlpha = 1;

  // Ranges, far to near
  for (const L of bd.layers) {
    const x = -(cam.x * L.f) * z;
    ctx.drawImage(L.img, x, hy - LAYER_H * z, L.img.width * z, LAYER_H * z);
  }

  // Low mist over the waterline
  const mist = ctx.createLinearGradient(0, hy - 40 * z, 0, hy + 4);
  mist.addColorStop(0, "rgba(240, 140, 110, 0)");
  mist.addColorStop(1, "rgba(240, 140, 110, 0.25)");
  ctx.fillStyle = mist;
  ctx.fillRect(0, hy - 40 * z, W, 44 * z);
  return sunX;
}

// ─────────────────────────── Sea ───────────────────────────
export function drawSea(ctx, cam, W, H, horizonY, sunX, t) {
  const z = cam.zoom;
  const hy = (horizonY - cam.y) * z;
  if (hy >= H) return;
  const sea = ctx.createLinearGradient(0, hy, 0, H);
  sea.addColorStop(0, "#3a3350");
  sea.addColorStop(0.04, "#1a2a44");
  sea.addColorStop(0.3, "#0c1a2c");
  sea.addColorStop(1, "#040a14");
  ctx.fillStyle = sea;
  ctx.fillRect(0, hy, W, H - hy);

  // Sun column
  const col = ctx.createLinearGradient(sunX - 160 * z, 0, sunX + 160 * z, 0);
  col.addColorStop(0, "rgba(255, 150, 80, 0)");
  col.addColorStop(0.5, "rgba(255, 180, 100, 0.22)");
  col.addColorStop(1, "rgba(255, 150, 80, 0)");
  ctx.fillStyle = col;
  ctx.fillRect(sunX - 160 * z, hy, 320 * z, H - hy);

  // Perspective swell lines: denser and thinner near the horizon
  for (let row = 0; row < 26; row++) {
    const d = row / 26;
    const y = hy + Math.pow(d, 1.8) * (H - hy + 40);
    if (y > H) break;
    const amp = (1 + d * 5) * z;
    const len = (18 + d * 60) * z;
    const speed = 12 + d * 40;
    const off = ((t * speed + row * 57) % (len * 3));
    ctx.fillStyle = `rgba(120, 190, 220, ${0.05 + d * 0.1})`;
    for (let x = -len * 3 + off; x < W; x += len * 3) ctx.fillRect(x, y + Math.sin(x * 0.01 + t + row) * amp, len, Math.max(1, d * 2.5 * z));
    // Glitter where the swell crosses the sun column
    const near = Math.max(0, 1 - Math.abs(((row * 97) % 300) - 150) / 150);
    for (let k = 0; k < 6; k++) {
      const gx = sunX + Math.sin(t * 3 + row * 7 + k * 13) * (60 + d * 120) * z;
      const flick = Math.sin(t * 9 + k * 5 + row * 3);
      if (flick < 0.3) continue;
      ctx.fillStyle = `rgba(255, 220, 150, ${(0.25 + near * 0.35) * flick * (1 - d * 0.6)})`;
      ctx.fillRect(gx, y, (4 + d * 14) * z, Math.max(1, z));
    }
  }

  // Bright crest line right at the waterline
  ctx.strokeStyle = "rgba(150, 225, 225, 0.55)";
  ctx.lineWidth = 2 * z;
  ctx.beginPath();
  for (let sx = 0; sx <= W; sx += 10) {
    const wx = sx / z + cam.x;
    const y = hy + (Math.sin(wx * 0.015 + t * 2.5) * 3 + Math.cos(wx * 0.04 + t * 1.8) * 1.5) * z;
    if (sx === 0) ctx.moveTo(sx, y);
    else ctx.lineTo(sx, y);
  }
  ctx.stroke();
}

// Seabirds wheeling in world space above the fleets
export function drawBirds(ctx, worldW, t) {
  ctx.strokeStyle = "rgba(30, 20, 36, 0.85)";
  ctx.lineWidth = 1.5;
  for (let k = 0; k < 7; k++) {
    const x = ((k * 480 + t * (22 + k * 3)) % (worldW + 200)) - 100;
    const y = 180 + Math.sin(t * 0.6 + k) * 30 + (k % 3) * 40;
    const flap = Math.sin(t * 8 + k * 2) * 4;
    ctx.beginPath();
    ctx.moveTo(x - 7, y - flap);
    ctx.lineTo(x, y);
    ctx.lineTo(x + 7, y - flap);
    ctx.stroke();
  }
}

// ─────────────────────────── Deck buildings ───────────────────────────
function plate(ctx, x, y, w, h, base) {
  ctx.fillStyle = shade(base, -0.35);
  ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, shade(base, 0.25));
  g.addColorStop(0.5, base);
  g.addColorStop(1, shade(base, -0.25));
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = "rgba(255,255,255,0.18)";
  ctx.fillRect(x, y, w, 1);
  ctx.fillStyle = "rgba(255,255,255,0.22)";
  if (w > 10 && h > 8) {
    ctx.fillRect(x + 2, y + 2, 1, 1);
    ctx.fillRect(x + w - 3, y + 2, 1, 1);
    ctx.fillRect(x + 2, y + h - 3, 1, 1);
    ctx.fillRect(x + w - 3, y + h - 3, 1, 1);
  }
}

function barrel(ctx, x, y, len, w, ang, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  ctx.fillStyle = shade(color, -0.4);
  ctx.fillRect(0, -w / 2 - 0.5, len, w + 1);
  ctx.fillStyle = color;
  ctx.fillRect(0, -w / 2, len, w);
  ctx.fillStyle = "rgba(255,255,255,0.25)";
  ctx.fillRect(0, -w / 2, len, 1);
  ctx.fillStyle = shade(color, -0.5);
  ctx.fillRect(len - 3, -w / 2 - 1, 3, w + 2);
  ctx.restore();
}

function dome(ctx, r, base) {
  const g = ctx.createRadialGradient(-r * 0.3, -r * 0.6, 1, 0, 0, r);
  g.addColorStop(0, shade(base, 0.45));
  g.addColorStop(1, shade(base, -0.3));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, r, Math.PI, 0);
  ctx.closePath();
  ctx.fill();
}

function lamp(ctx, x, y, color, t, rate = 3, phase = 0) {
  const on = Math.sin(t * rate + phase) > 0;
  if (on) glow(ctx, x, y, 7, color, 0.6);
  ctx.fillStyle = on ? color : shade(color, -0.6);
  ctx.fillRect(x - 1, y - 1, 2, 2);
}

function hazard(ctx, x, y, w, h) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.fillStyle = "#e0b020";
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = "#1a1a1a";
  for (let k = -h; k < w; k += 6) {
    ctx.beginPath();
    ctx.moveTo(x + k, y + h);
    ctx.lineTo(x + k + 3, y + h);
    ctx.lineTo(x + k + 3 + h, y);
    ctx.lineTo(x + k + h, y);
    ctx.fill();
  }
  ctx.restore();
}

/** Deck building sprite, base at (0,0), facing +x (the enemy). */
export function drawBuildingArt(ctx, id, isEnemy, t) {
  const hull = isEnemy ? "#4a2a34" : "#34506c";
  const dark = isEnemy ? "#24121a" : "#16222f";
  const team = isEnemy ? "#ff5964" : "#4aa8ff";
  const energy = isEnemy ? "#ff758f" : "#00f0ff";
  const gun = "#6d7684";
  // Drop shadow on the deck
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.fillRect(-16, -2, 34, 3);

  switch (id) {
    case "droneStation": {
      plate(ctx, -17, -8, 34, 8, hull);
      ctx.fillStyle = "#1c232c";
      ctx.fillRect(-14, -10, 28, 2);
      ctx.strokeStyle = "rgba(255, 220, 90, 0.8)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-4, -9);
      ctx.lineTo(-4, -9.5);
      ctx.stroke();
      ctx.fillStyle = "#e8e8e8";
      ctx.fillRect(-5, -9.5, 1, 1.5);
      ctx.fillRect(4, -9.5, 1, 1.5);
      ctx.fillRect(-4, -9, 8, 0.8);
      // Parked drone
      ctx.fillStyle = "#cbd5e1";
      ctx.fillRect(-3, -15, 6, 4);
      ctx.fillStyle = energy;
      ctx.fillRect(-8, -16, 16, 1);
      lamp(ctx, -15, -9, "#7CFC00", t, 4);
      lamp(ctx, 15, -9, "#ff4040", t, 4, Math.PI);
      break;
    }
    case "airFactory": {
      ctx.save();
      ctx.translate(0, -2);
      ctx.fillStyle = shade(hull, -0.3);
      ctx.beginPath();
      ctx.ellipse(0, 0, 21, 26, 0, Math.PI, 0);
      ctx.fill();
      const g = ctx.createLinearGradient(-20, 0, 20, 0);
      g.addColorStop(0, shade(hull, -0.2));
      g.addColorStop(0.4, shade(hull, 0.35));
      g.addColorStop(1, shade(hull, -0.3));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(0, 0, 20, 25, 0, Math.PI, 0);
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.25)";
      ctx.lineWidth = 1;
      for (let k = -16; k <= 16; k += 4) {
        ctx.beginPath();
        ctx.moveTo(k, 0);
        ctx.lineTo(k * 0.9, -Math.sqrt(Math.max(0, 1 - (k / 20) ** 2)) * 25);
        ctx.stroke();
      }
      ctx.fillStyle = "#0b0f15";
      ctx.fillRect(4, -14, 14, 14);
      ctx.fillStyle = "rgba(255, 200, 120, 0.35)";
      ctx.fillRect(5, -13, 12, 13);
      ctx.fillStyle = team;
      ctx.fillRect(-20, -3, 40, 2);
      ctx.restore();
      lamp(ctx, 0, -28, "#ff4040", t, 2);
      break;
    }
    case "navalFactory": {
      plate(ctx, -18, -14, 36, 14, hull);
      ctx.fillStyle = "#0b0f15";
      ctx.fillRect(-12, -10, 16, 10);
      ctx.fillStyle = "rgba(120, 200, 255, 0.25)";
      ctx.fillRect(-12, -3, 16, 3);
      // Gantry crane
      ctx.fillStyle = "#c9a227";
      ctx.fillRect(10, -40, 3, 26);
      ctx.fillRect(-10, -42, 26, 3);
      ctx.strokeStyle = "rgba(0,0,0,0.5)";
      ctx.lineWidth = 0.8;
      for (let k = -10; k < 16; k += 4) {
        ctx.beginPath();
        ctx.moveTo(k, -42);
        ctx.lineTo(k + 4, -39);
        ctx.stroke();
      }
      const sway = Math.sin(t * 1.3) * 2;
      ctx.strokeStyle = "#20252c";
      ctx.beginPath();
      ctx.moveTo(-6, -39);
      ctx.lineTo(-6 + sway, -24);
      ctx.stroke();
      ctx.fillStyle = "#d9b53a";
      ctx.fillRect(-8 + sway, -24, 4, 3);
      hazard(ctx, -18, -16, 36, 2);
      break;
    }
    case "shieldGenerator": {
      plate(ctx, -10, -10, 20, 10, dark);
      ctx.fillStyle = gun;
      ctx.fillRect(-2, -22, 4, 12);
      const pulse = 0.5 + Math.sin(t * 3) * 0.25;
      glow(ctx, 0, -26, 16, energy, 0.35 + pulse * 0.3);
      ctx.fillStyle = energy;
      ctx.beginPath();
      ctx.arc(0, -26, 5, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = rgba(energy, 0.5);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(0, -26, 10, 3, t * 1.5, 0, TAU);
      ctx.stroke();
      break;
    }
    case "localBooster":
    case "spySatellite":
    case "deathstarSatellite": {
      plate(ctx, -10, -8, 20, 8, hull);
      ctx.fillStyle = gun;
      ctx.fillRect(-1.5, -24, 3, 16);
      ctx.save();
      ctx.translate(0, -24);
      ctx.rotate(-0.6 + Math.sin(t * 0.5) * 0.15);
      ctx.fillStyle = "#c7ced8";
      ctx.beginPath();
      ctx.ellipse(0, 0, 12, 5, 0, 0, Math.PI);
      ctx.fill();
      ctx.fillStyle = "#8a93a0";
      ctx.fillRect(-1, -8, 2, 8);
      ctx.restore();
      if (id === "deathstarSatellite") {
        glow(ctx, 0, -40, 14, "#ff3b3b", 0.5);
        ctx.fillStyle = "#555c66";
        ctx.beginPath();
        ctx.arc(0, -40, 7, 0, TAU);
        ctx.fill();
        ctx.fillStyle = "#ff3b3b";
        ctx.fillRect(-2, -42, 3, 3);
      } else lamp(ctx, 0, -33, energy, t, 5);
      break;
    }
    case "controlTower":
    case "jammerTower":
    case "kamikazeSignal": {
      // Lattice mast
      ctx.strokeStyle = gun;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-8, 0);
      ctx.lineTo(-3, -38);
      ctx.moveTo(8, 0);
      ctx.lineTo(3, -38);
      ctx.stroke();
      ctx.lineWidth = 0.8;
      for (let k = 0; k < 5; k++) {
        const y0 = -k * 7.5;
        const y1 = y0 - 7.5;
        const w0 = 8 - k;
        const w1 = 7 - k;
        ctx.beginPath();
        ctx.moveTo(-w0, y0);
        ctx.lineTo(w1, y1);
        ctx.moveTo(w0, y0);
        ctx.lineTo(-w1, y1);
        ctx.stroke();
      }
      if (id === "controlTower") {
        plate(ctx, -9, -48, 18, 10, hull);
        ctx.fillStyle = "rgba(160, 230, 255, 0.8)";
        ctx.fillRect(-7, -45, 14, 4);
        lamp(ctx, 0, -50, "#ff4040", t, 2);
      } else if (id === "jammerTower") {
        ctx.strokeStyle = energy;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let k = 0; k < 6; k++) ctx.lineTo(-6 + k * 2.4, -44 + (k % 2 ? -4 : 0) + Math.sin(t * 20 + k) * 1.5);
        ctx.stroke();
        glow(ctx, 0, -44, 14, energy, 0.3);
      } else {
        const strobe = Math.sin(t * 10) > 0.6;
        if (strobe) glow(ctx, 0, -42, 26, "#ff2a2a", 0.8);
        ctx.fillStyle = strobe ? "#ff5050" : "#5a1010";
        ctx.fillRect(-3, -45, 6, 5);
      }
      break;
    }
    case "stealthGenerator": {
      ctx.fillStyle = "#11131a";
      ctx.beginPath();
      ctx.moveTo(-9, 0);
      ctx.lineTo(-4, -34);
      ctx.lineTo(4, -34);
      ctx.lineTo(9, 0);
      ctx.fill();
      ctx.fillStyle = `rgba(180, 120, 255, ${0.5 + Math.sin(t * 2) * 0.3})`;
      for (let k = 0; k < 4; k++) ctx.fillRect(-2, -8 - k * 7, 4, 2);
      glow(ctx, 0, -20, 20, "#a070ff", 0.2);
      break;
    }
    case "energyMatrix": {
      plate(ctx, -16, -16, 32, 16, dark);
      for (let k = 0; k < 4; k++) {
        const lvl = 0.5 + Math.sin(t * 2 + k) * 0.4;
        ctx.fillStyle = "#0a0e14";
        ctx.fillRect(-13 + k * 7, -14, 5, 12);
        ctx.fillStyle = energy;
        ctx.fillRect(-13 + k * 7, -2 - 12 * lvl, 5, 12 * lvl);
      }
      glow(ctx, 0, -8, 22, energy, 0.2);
      break;
    }
    case "pointDefenseLaser":
    case "floatingLaserBattery":
    case "lasCannon": {
      const hover = id === "floatingLaserBattery" ? -10 + Math.sin(t * 2) * 2 : 0;
      ctx.save();
      ctx.translate(0, hover);
      if (id === "floatingLaserBattery") glow(ctx, 0, 2, 16, energy, 0.35);
      plate(ctx, -11, -18, 22, 18, dark);
      ctx.strokeStyle = energy;
      ctx.lineWidth = 1;
      ctx.strokeRect(-10.5, -17.5, 21, 17);
      for (let k = 0; k < 3; k++) {
        ctx.fillStyle = rgba(energy, 0.35 + 0.3 * Math.sin(t * 4 + k));
        ctx.fillRect(-8, -15 + k * 5, 8, 2);
      }
      barrel(ctx, 4, -12, id === "lasCannon" ? 18 : 12, 5, -0.15, "#8c95a3");
      glow(ctx, id === "lasCannon" ? 22 : 16, -14, 10, energy, 0.6);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(id === "lasCannon" ? 20 : 14, -15, 2, 2);
      ctx.restore();
      break;
    }
    case "ionCannon": {
      plate(ctx, -6, -18, 34, 18, dark);
      for (let k = 0; k < 4; k++) {
        ctx.strokeStyle = rgba(energy, 0.4 + 0.4 * Math.sin(t * 5 - k));
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(6 + k * 6, -9, 2, 8, 0, 0, TAU);
        ctx.stroke();
      }
      glow(ctx, 30, -9, 16, energy, 0.6);
      ctx.fillStyle = "#fff";
      ctx.fillRect(28, -10, 3, 2);
      break;
    }
    case "teslaCoil": {
      plate(ctx, -8, -8, 16, 8, dark);
      ctx.fillStyle = "#b87333";
      for (let k = 0; k < 6; k++) ctx.fillRect(-4 + (k % 2), -10 - k * 4, 8 - (k % 2) * 2, 3);
      ctx.fillStyle = "#9aa3ae";
      ctx.beginPath();
      ctx.arc(0, -36, 6, 0, TAU);
      ctx.fill();
      glow(ctx, 0, -36, 16, energy, 0.45 + Math.random() * 0.3);
      ctx.strokeStyle = "#e8f8ff";
      ctx.lineWidth = 1;
      ctx.beginPath();
      let px = 0;
      let py = -36;
      ctx.moveTo(px, py);
      for (let k = 0; k < 4; k++) {
        px += 4 + Math.random() * 4;
        py += (Math.random() - 0.5) * 10;
        ctx.lineTo(px, py);
      }
      ctx.stroke();
      break;
    }
    case "samSite":
    case "rocketLauncher": {
      plate(ctx, -12, -8, 24, 8, hull);
      ctx.save();
      ctx.translate(-2, -10);
      ctx.rotate(id === "samSite" ? -0.9 : -0.45);
      plate(ctx, -4, -9, 26, 14, "#4b5563");
      const tubes = id === "samSite" ? 2 : 4;
      for (let k = 0; k < tubes; k++) {
        const y = -7 + k * (12 / tubes);
        ctx.fillStyle = "#11151b";
        ctx.fillRect(20, y, 3, 12 / tubes - 1);
        if (id === "samSite") {
          ctx.fillStyle = "#e5e7eb";
          ctx.fillRect(22, y + 1, 6, 3);
          ctx.fillStyle = "#ef4444";
          ctx.fillRect(28, y + 1, 2, 3);
        }
      }
      ctx.restore();
      break;
    }
    case "antiAirTurret":
    case "flakBattery": {
      ctx.save();
      ctx.translate(0, -6);
      dome(ctx, 11, hull);
      ctx.restore();
      const n = id === "flakBattery" ? 2 : 4;
      for (let k = 0; k < n; k++) barrel(ctx, -3 + k * 2, -12 - k * 1.5, 18, id === "flakBattery" ? 3.5 : 2, -1.0, gun);
      plate(ctx, -8, -16, 12, 7, hull);
      break;
    }
    case "mortar": {
      plate(ctx, -11, -8, 22, 8, hull);
      barrel(ctx, 0, -8, 14, 8, -1.25, "#5b6470");
      ctx.fillStyle = "#1a1f26";
      ctx.beginPath();
      ctx.arc(0, -8, 5, 0, TAU);
      ctx.fill();
      break;
    }
    case "artillery":
    case "shipTurret":
    case "broadsword": {
      const big = id === "broadsword" ? 1.4 : id === "artillery" ? 1.1 : 0.9;
      ctx.save();
      ctx.scale(big, big);
      const recoil = Math.max(0, Math.sin(t * 1.7)) > 0.97 ? -3 : 0;
      barrel(ctx, 4 + recoil, -12, 24, 4, -0.5, gun);
      if (id !== "artillery") barrel(ctx, 4 + recoil, -8, 22, 4, -0.45, gun);
      // Turret house
      ctx.fillStyle = shade(hull, -0.35);
      ctx.beginPath();
      ctx.moveTo(-14, 0);
      ctx.lineTo(-12, -14);
      ctx.lineTo(8, -16);
      ctx.lineTo(14, -6);
      ctx.lineTo(14, 0);
      ctx.fill();
      const g = ctx.createLinearGradient(0, -16, 0, 0);
      g.addColorStop(0, shade(hull, 0.35));
      g.addColorStop(1, shade(hull, -0.2));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(-13, -1);
      ctx.lineTo(-11, -13);
      ctx.lineTo(7, -15);
      ctx.lineTo(13, -6);
      ctx.lineTo(13, -1);
      ctx.fill();
      ctx.fillStyle = team;
      ctx.fillRect(-11, -6, 22, 2);
      ctx.fillStyle = "rgba(0,0,0,0.4)";
      ctx.fillRect(-6, -11, 5, 2);
      ctx.restore();
      break;
    }
    case "railgun": {
      plate(ctx, -14, -12, 22, 12, dark);
      ctx.save();
      ctx.translate(-4, -10);
      ctx.rotate(-0.28);
      ctx.fillStyle = "#3a4250";
      ctx.fillRect(0, -5, 42, 3);
      ctx.fillRect(0, 2, 42, 3);
      ctx.fillStyle = rgba(energy, 0.35 + 0.35 * Math.sin(t * 6));
      ctx.fillRect(2, -2, 38, 4);
      for (let k = 0; k < 5; k++) {
        ctx.fillStyle = "#5b6472";
        ctx.fillRect(4 + k * 8, -6, 3, 12);
      }
      glow(ctx, 42, 0, 10, energy, 0.5);
      ctx.restore();
      break;
    }
    case "broadsides": {
      plate(ctx, -18, -14, 36, 14, hull);
      for (let k = 0; k < 3; k++) {
        ctx.fillStyle = "#0b0f15";
        ctx.fillRect(-14 + k * 11, -10, 7, 6);
        barrel(ctx, -8 + k * 11, -7, 12, 3, 0, gun);
      }
      ctx.fillStyle = team;
      ctx.fillRect(-18, -14, 36, 2);
      break;
    }
    case "nukeLauncher": {
      plate(ctx, -14, -14, 28, 14, dark);
      hazard(ctx, -14, -16, 28, 3);
      const open = (Math.sin(t * 0.7) + 1) / 2;
      ctx.fillStyle = "#1e2530";
      ctx.fillRect(-10, -18, 8 - open * 6, 3);
      ctx.fillRect(2 + open * 6, -18, 8 - open * 6, 3);
      ctx.fillStyle = "#e5e7eb";
      ctx.fillRect(-3, -24 - open * 4, 6, 10);
      ctx.fillStyle = "#ef4444";
      ctx.beginPath();
      ctx.moveTo(-3, -24 - open * 4);
      ctx.lineTo(0, -30 - open * 4);
      ctx.lineTo(3, -24 - open * 4);
      ctx.fill();
      lamp(ctx, -12, -18, "#ffcc00", t, 6);
      break;
    }
    case "ultraliskFabrication": {
      plate(ctx, -14, -8, 28, 8, dark);
      const g = ctx.createRadialGradient(0, -20, 2, 0, -18, 14);
      g.addColorStop(0, "#b6ff7a");
      g.addColorStop(1, "#1f5e2a");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(0, -19, 11, 13, 0, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = "#7a8490";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(0, -19, 11, 13, 0, 0, TAU);
      ctx.stroke();
      ctx.fillStyle = "rgba(20, 40, 20, 0.8)";
      ctx.beginPath();
      ctx.ellipse(Math.sin(t) * 2, -19, 4, 6, 0, 0, TAU);
      ctx.fill();
      glow(ctx, 0, -19, 20, "#7CFC00", 0.25);
      break;
    }
    default: {
      plate(ctx, -12, -18, 24, 18, hull);
      ctx.fillStyle = team;
      ctx.fillRect(-12, -18, 24, 2);
      lamp(ctx, 8, -21, energy, t, 3);
    }
  }
}

export function drawDroneArt(ctx, t, energy) {
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.fillRect(-5, 6, 10, 2);
  plate(ctx, -6, -3, 12, 6, "#8b96a5");
  ctx.fillStyle = "#1a1f26";
  ctx.fillRect(-2, 3, 4, 3);
  const spin = Math.abs(Math.sin(t * 40)) * 7 + 1;
  ctx.fillStyle = "rgba(220, 235, 245, 0.8)";
  ctx.fillRect(-8 - spin / 2, -5, spin, 1);
  ctx.fillRect(8 - spin / 2, -5, spin, 1);
  ctx.fillStyle = "#2a3038";
  ctx.fillRect(-9, -4, 2, 2);
  ctx.fillRect(7, -4, 2, 2);
  lamp(ctx, 0, 0, energy, t, 8);
  // Welding sparks down onto the build
  if (Math.random() < 0.5) {
    ctx.fillStyle = "#ffd166";
    ctx.fillRect((Math.random() - 0.5) * 6, 8 + Math.random() * 14, 1.5, 1.5);
  }
}

// ─────────────────────────── Units ───────────────────────────
function boatHull(ctx, len, h, color, deck) {
  ctx.fillStyle = shade(color, -0.45);
  ctx.beginPath();
  ctx.moveTo(-len / 2, -h * 0.4);
  ctx.lineTo(len / 2 - h, -h * 0.5);
  ctx.lineTo(len / 2 + h * 0.4, -h);
  ctx.lineTo(len / 2 - h * 0.6, h * 0.55);
  ctx.lineTo(-len / 2 + 2, h * 0.55);
  ctx.closePath();
  ctx.fill();
  const g = ctx.createLinearGradient(0, -h, 0, h * 0.6);
  g.addColorStop(0, shade(color, 0.35));
  g.addColorStop(1, shade(color, -0.3));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(-len / 2 + 1, -h * 0.35);
  ctx.lineTo(len / 2 - h, -h * 0.45);
  ctx.lineTo(len / 2 + h * 0.3, -h * 0.9);
  ctx.lineTo(len / 2 - h * 0.6, h * 0.45);
  ctx.lineTo(-len / 2 + 3, h * 0.45);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#7a1f22";
  ctx.fillRect(-len / 2 + 3, h * 0.2, len - h * 1.2, h * 0.25);
  ctx.fillStyle = deck;
  ctx.fillRect(-len / 2 + 1, -h * 0.45, len - h, 1.5);
}

function rotor(ctx, x, y, w, t) {
  const s = Math.abs(Math.sin(t * 30)) * w + 3;
  ctx.fillStyle = "rgba(200, 210, 220, 0.25)";
  ctx.fillRect(x - w, y - 0.5, w * 2, 1);
  ctx.fillStyle = "rgba(230, 235, 245, 0.85)";
  ctx.fillRect(x - s, y - 1, s * 2, 2);
}

/** Draw a unit at the origin, facing +x (caller mirrors enemies). */
export function drawUnitArt(ctx, unit, t) {
  const color = unit.isEnemy ? "#b8434f" : "#4f7fae";
  const team = unit.isEnemy ? "#ff5964" : "#4aa8ff";
  const bob = Math.sin(t * 3 + unit.x * 0.05);
  const id = unit.id;
  if (unit.spec.domain === "naval") {
    ctx.rotate(bob * 0.03);
    // Wake: foam wedge trailing astern
    const wl = { attackRib: 40, attackBoat: 50, frigate: 60, destroyer: 70, archonBattleship: 90 }[id] || 50;
    const wake = ctx.createLinearGradient(-wl * 1.6, 0, -wl * 0.3, 0);
    wake.addColorStop(0, "rgba(220, 240, 255, 0)");
    wake.addColorStop(1, "rgba(220, 240, 255, 0.55)");
    ctx.fillStyle = wake;
    ctx.beginPath();
    ctx.moveTo(-wl * 0.3, 1);
    ctx.lineTo(-wl * 1.6, -2);
    ctx.lineTo(-wl * 1.6, 5);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgba(230, 245, 255, 0.7)";
    ctx.fillRect(wl * 0.42, -1 - Math.abs(bob) * 2, 6, 3);

    if (id === "attackRib") {
      ctx.fillStyle = "#2b2f36";
      ctx.beginPath();
      ctx.ellipse(0, -1, 14, 4, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = "#4b515b";
      ctx.fillRect(-12, -5, 22, 3);
      ctx.fillStyle = team;
      ctx.fillRect(-4, -9, 6, 4);
      ctx.fillStyle = "#1a1d22";
      ctx.fillRect(-15, -6, 3, 8);
      barrel(ctx, 2, -8, 9, 1.5, -0.05, "#9aa3ae");
    } else if (id === "attackBoat") {
      boatHull(ctx, 40, 9, color, team);
      plate(ctx, -8, -13, 14, 8, shade(color, 0.1));
      ctx.fillStyle = "rgba(160, 220, 255, 0.8)";
      ctx.fillRect(2, -11, 3, 3);
      barrel(ctx, 9, -7, 11, 2, -0.08, "#9aa3ae");
      ctx.fillStyle = "#1a1d22";
      ctx.fillRect(-4, -18, 1, 6);
    } else if (id === "frigate") {
      boatHull(ctx, 56, 11, color, team);
      plate(ctx, -14, -16, 22, 11, shade(color, 0.05));
      plate(ctx, -8, -24, 12, 8, shade(color, 0.15));
      ctx.fillStyle = "rgba(255, 214, 112, 0.9)";
      for (let k = 0; k < 3; k++) ctx.fillRect(-6 + k * 4, -21, 2, 2);
      ctx.fillStyle = "#1a1d22";
      ctx.fillRect(-3, -32, 1.5, 8);
      barrel(ctx, 12, -9, 14, 2.5, -0.12, "#9aa3ae");
      lamp(ctx, -2, -33, "#ff4040", t, 3);
    } else if (id === "destroyer") {
      boatHull(ctx, 70, 12, color, team);
      plate(ctx, -18, -18, 30, 12, shade(color, 0.05));
      plate(ctx, -10, -27, 14, 9, shade(color, 0.15));
      plate(ctx, -22, -24, 6, 12, "#2b2f36");
      for (let i = 0; i < 3; i++) {
        const a = (t * 0.7 + i / 3) % 1;
        ctx.fillStyle = `rgba(40, 40, 48, ${0.35 * (1 - a)})`;
        ctx.beginPath();
        ctx.arc(-19 - a * 16, -26 - a * 18, 3 + a * 6, 0, TAU);
        ctx.fill();
      }
      ctx.fillStyle = "rgba(255, 214, 112, 0.9)";
      for (let k = 0; k < 3; k++) ctx.fillRect(-8 + k * 4, -24, 2, 2);
      barrel(ctx, 16, -10, 16, 3, -0.12, "#9aa3ae");
      barrel(ctx, -24, -10, 12, 3, -0.2, "#9aa3ae");
    } else {
      // Archon battleship
      boatHull(ctx, 96, 15, color, team);
      plate(ctx, -26, -24, 40, 16, shade(color, 0.05));
      plate(ctx, -14, -36, 20, 12, shade(color, 0.15));
      ctx.fillStyle = "#1a1d22";
      ctx.fillRect(-5, -50, 2, 14);
      ctx.fillRect(-12, -44, 16, 1.5);
      ctx.fillStyle = "rgba(255, 214, 112, 0.9)";
      for (let k = 0; k < 4; k++) ctx.fillRect(-12 + k * 4, -32, 2, 2);
      barrel(ctx, 20, -12, 22, 4, -0.1, "#9aa3ae");
      barrel(ctx, 20, -7, 22, 4, -0.06, "#9aa3ae");
      barrel(ctx, -34, -12, 16, 4, -0.2, "#9aa3ae");
      glow(ctx, 0, -18, 30, team, 0.2);
      lamp(ctx, -4, -51, "#ff4040", t, 2);
    }
  } else {
    // Aircraft: nose up/down with the dive
    ctx.rotate(unit.diving ? 0.45 : bob * 0.05);
    if (id === "steamCopter" || id === "gunship") {
      const big = id === "gunship" ? 1.25 : 1;
      ctx.scale(big, big);
      ctx.fillStyle = shade(color, -0.2);
      ctx.fillRect(-20, -3, 16, 3);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.ellipse(0, 0, 11, 6, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = "rgba(160, 220, 255, 0.85)";
      ctx.beginPath();
      ctx.ellipse(6, -1, 4, 3.5, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = "#1a1d22";
      ctx.fillRect(-1, -9, 2, 3);
      ctx.fillRect(-8, 6, 14, 1);
      rotor(ctx, 0, -9, 16, t);
      rotor(ctx, -20, -4, 4, t * 1.3);
      if (id === "gunship") {
        barrel(ctx, 5, 4, 10, 2, 0.3, "#9aa3ae");
        ctx.fillStyle = "#3a3f47";
        ctx.fillRect(-6, 3, 8, 3);
      }
      if (id === "steamCopter") {
        const a = (t * 1.5) % 1;
        ctx.fillStyle = `rgba(220, 220, 230, ${0.4 * (1 - a)})`;
        ctx.beginPath();
        ctx.arc(-14 - a * 14, -6 - a * 8, 2 + a * 4, 0, TAU);
        ctx.fill();
      }
    } else {
      const spec = {
        fighter: { len: 26, wing: 10, eng: 1 },
        bomber: { len: 36, wing: 18, eng: 2 },
        spyPlane: { len: 30, wing: 22, eng: 1 }
      }[id] || { len: 24, wing: 10, eng: 1 };
      const L = spec.len;
      // Afterburner
      glow(ctx, -L / 2 - 2, 0, 10 + spec.eng * 3, "#ff9a3c", 0.55);
      ctx.fillStyle = `rgba(255, 190, 90, ${0.7 + Math.random() * 0.3})`;
      ctx.fillRect(-L / 2 - 8 - Math.random() * 4, -1.5, 8, 3);
      // Wings (far wing darker)
      ctx.fillStyle = shade(color, -0.35);
      ctx.beginPath();
      ctx.moveTo(2, -1);
      ctx.lineTo(-6, -spec.wing);
      ctx.lineTo(-11, -spec.wing);
      ctx.lineTo(-6, -1);
      ctx.fill();
      ctx.fillStyle = id === "spyPlane" ? "#2a2e36" : color;
      ctx.beginPath();
      ctx.moveTo(L / 2 + 2, 0);
      ctx.lineTo(L / 2 - 6, -3);
      ctx.lineTo(-L / 2, -3);
      ctx.lineTo(-L / 2 - 2, 0);
      ctx.lineTo(-L / 2, 3);
      ctx.lineTo(L / 2 - 6, 3);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.2)";
      ctx.fillRect(-L / 2, -3, L - 6, 1);
      ctx.fillStyle = shade(color, 0.1);
      ctx.beginPath();
      ctx.moveTo(4, 1);
      ctx.lineTo(-7, spec.wing);
      ctx.lineTo(-12, spec.wing);
      ctx.lineTo(-6, 1);
      ctx.fill();
      ctx.fillStyle = shade(color, -0.2);
      ctx.beginPath();
      ctx.moveTo(-L / 2 + 3, -2);
      ctx.lineTo(-L / 2 - 2, -9);
      ctx.lineTo(-L / 2 + 1, -9);
      ctx.lineTo(-L / 2 + 7, -2);
      ctx.fill();
      ctx.fillStyle = "rgba(160, 220, 255, 0.9)";
      ctx.fillRect(L / 2 - 9, -3, 5, 2);
      ctx.fillStyle = team;
      ctx.fillRect(-4, -1, 6, 2);
      if (id === "bomber") {
        ctx.fillStyle = "#3a3f47";
        for (const wy of [-8, 8]) ctx.fillRect(-6, wy - 1.5, 7, 3);
      }
    }
  }
  // Damage bar
  if (unit.hp < unit.maxHp) {
    const k = Math.max(0, unit.hp / unit.maxHp);
    ctx.fillStyle = "rgba(0,0,0,0.7)";
    ctx.fillRect(-12, -26, 24, 3);
    ctx.fillStyle = k < 0.35 ? "#ff5964" : "#7CFC00";
    ctx.fillRect(-12, -26, 24 * k, 3);
  }
}

// ─────────────────────────── Projectiles & FX ───────────────────────────
export function drawShot(ctx, p, t) {
  const col = p.color || (p.isEnemy ? "#ff6b6b" : "#ffc14d");
  if (p.type === "ballistic" && !p.icbm) {
    // Tracer trail along the arc (sample the same curve slightly back in time)
    const back = (k) => {
      const kk = Math.max(0, Math.min(1, k));
      return [p.startX + (p.targetX - p.startX) * kk, p.startY + (p.targetY - p.startY) * kk - 260 * Math.sin(kk * Math.PI)];
    };
    const k = Math.min(1, p.progress);
    ctx.strokeStyle = rgba(col, 0.35);
    ctx.lineWidth = 2;
    ctx.beginPath();
    const a = back(k - 0.06);
    ctx.moveTo(a[0], a[1]);
    const b = back(k - 0.03);
    ctx.lineTo(b[0], b[1]);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    glow(ctx, p.x, p.y, 9, col, 0.6);
    ctx.fillStyle = "#fff4d6";
    ctx.fillRect(p.x - 1.5, p.y - 1.5, 3, 3);
    return;
  }
  if (p.type === "linear") {
    const dir = Math.sign(p.vx) || 1;
    if (p.rocket) {
      for (let k = 1; k < 6; k++) {
        ctx.fillStyle = `rgba(200, 200, 210, ${0.25 - k * 0.04})`;
        ctx.beginPath();
        ctx.arc(p.x - dir * k * 7, p.y + Math.sin(t * 20 + k) * 1.5, 2 + k, 0, TAU);
        ctx.fill();
      }
      ctx.fillStyle = "#e5e7eb";
      ctx.fillRect(p.x - 6, p.y - 1.5, 12, 3);
      ctx.fillStyle = "#ef4444";
      ctx.fillRect(p.x + dir * 5 - 1, p.y - 1.5, 3, 3);
      glow(ctx, p.x - dir * 7, p.y, 8, "#ffb347", 0.7);
    } else {
      const g = ctx.createLinearGradient(p.x - dir * 26, 0, p.x, 0);
      g.addColorStop(0, rgba(col, 0));
      g.addColorStop(1, rgba(col, 0.9));
      ctx.strokeStyle = g;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(p.x - dir * 26, p.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      glow(ctx, p.x, p.y, 8, col, 0.6);
      ctx.fillStyle = "#fff";
      ctx.fillRect(p.x - 1, p.y - 1, 2, 2);
    }
    return;
  }
  if (p.type === "shell") {
    glow(ctx, p.x, p.y, 7, col, 0.6);
    ctx.fillStyle = "#fff4d6";
    ctx.fillRect(p.x - 1.5, p.y - 1.5, 3, 3);
    return;
  }
  if (p.type === "rod") {
    const g = ctx.createLinearGradient(0, p.y - 60, 0, p.y);
    g.addColorStop(0, "rgba(255, 209, 102, 0)");
    g.addColorStop(1, "rgba(255, 240, 200, 1)");
    ctx.strokeStyle = g;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y - 60);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    glow(ctx, p.x, p.y, 14, "#ffd166", 0.7);
  }
}

export function drawIcbm(ctx, t) {
  // Missile body at origin, pointing +x
  for (let k = 1; k < 8; k++) {
    ctx.fillStyle = `rgba(210, 210, 220, ${0.3 - k * 0.035})`;
    ctx.beginPath();
    ctx.arc(-18 - k * 9, Math.sin(t * 15 + k) * 2, 3 + k * 1.4, 0, TAU);
    ctx.fill();
  }
  glow(ctx, -18, 0, 18, "#ff9a3c", 0.8);
  ctx.fillStyle = "#ffd27a";
  ctx.fillRect(-26 - Math.random() * 6, -3, 10, 6);
  plate(ctx, -14, -4, 26, 8, "#d8dde5");
  ctx.fillStyle = "#ef4444";
  ctx.beginPath();
  ctx.moveTo(12, -4);
  ctx.lineTo(19, 0);
  ctx.lineTo(12, 4);
  ctx.fill();
  hazard(ctx, -6, -4, 5, 8);
  ctx.fillStyle = "#6b7280";
  ctx.beginPath();
  ctx.moveTo(-14, -4);
  ctx.lineTo(-18, -9);
  ctx.lineTo(-10, -4);
  ctx.moveTo(-14, 4);
  ctx.lineTo(-18, 9);
  ctx.lineTo(-10, 4);
  ctx.fill();
}

export function drawBeamArt(ctx, b, t) {
  const w = b.isIonCannon ? 9 : b.orbital ? 12 : b.visualOnly ? 2 : 4;
  const fade = b.visualOnly ? Math.max(0, 1 - b.elapsed / b.duration) : 1;
  const pts = [[b.sourceX, b.sourceY]];
  if (b.jagged) {
    for (let k = 1; k < 5; k++) {
      const f = k / 5;
      pts.push([b.sourceX + (b.targetX - b.sourceX) * f + (Math.random() - 0.5) * 18, b.sourceY + (b.targetY - b.sourceY) * f + (Math.random() - 0.5) * 18]);
    }
  }
  pts.push([b.targetX, b.targetY]);
  const path = () => {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let k = 1; k < pts.length; k++) ctx.lineTo(pts[k][0], pts[k][1]);
  };
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = fade;
  ctx.lineCap = "round";
  const flicker = 0.85 + Math.sin(t * 60) * 0.15;
  path();
  ctx.strokeStyle = rgba(b.color, 0.25);
  ctx.lineWidth = w * 3.2 * flicker;
  ctx.stroke();
  ctx.strokeStyle = rgba(b.color, 0.8);
  ctx.lineWidth = w;
  ctx.stroke();
  ctx.strokeStyle = "rgba(255,255,255,0.95)";
  ctx.lineWidth = Math.max(1, w * 0.3);
  ctx.stroke();
  glow(ctx, b.targetX, b.targetY, w * 4, b.color, 0.7 * fade);
  glow(ctx, b.sourceX, b.sourceY, w * 2.5, b.color, 0.6 * fade);
  ctx.restore();
}

export function drawParticles(ctx, parts) {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const p of parts) {
    const k = Math.max(0, p.life / (p.maxLife || 0.8));
    const r = p.size * (0.6 + k * 0.6);
    if (r > 2.5) glow(ctx, p.x, p.y, r * 2.4, p.color, 0.35 * k);
    ctx.fillStyle = rgba(p.color, Math.min(1, 0.4 + k));
    ctx.fillRect(p.x - r / 2, p.y - r / 2, r, r);
  }
  ctx.restore();
  // Dark smoke puffs linger above big bursts
  for (const p of parts) {
    if (p.size < 4.5) continue;
    const k = Math.max(0, p.life / (p.maxLife || 0.8));
    ctx.fillStyle = `rgba(30, 26, 34, ${0.25 * (1 - k)})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y - (1 - k) * 12, p.size * (1.5 - k), 0, TAU);
    ctx.fill();
  }
}
