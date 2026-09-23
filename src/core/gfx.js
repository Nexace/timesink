/**
 * SYS://TIMESINK.NET — Shared retro graphics toolkit
 * Pixel sprites from strings, tileable procedural textures, lighting, vignette, scanlines,
 * a pooled particle system and colour helpers. Everything is generated at runtime (no image files)
 * and cached on offscreen canvases, the same approach the Mars Base renderer uses.
 */

// ---------- canvases & randomness ----------

export function makeCanvas(w, h) {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  const ctx = c.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  return { c, ctx };
}

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function rand() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Deterministic 0..1 hash of integer coordinates (stable textures, no flicker). */
export function hash2(x, y, s = 0) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(s | 0, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export function reducedMotion() {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

// ---------- colour ----------

function parseHex(hex) {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full.slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function toHex([r, g, b]) {
  const c = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

/** Lighten (amt > 0) or darken (amt < 0) a hex colour; amt in -1..1. */
export function shade(hex, amt) {
  const [r, g, b] = parseHex(hex);
  if (amt >= 0) return toHex([r + (255 - r) * amt, g + (255 - g) * amt, b + (255 - b) * amt]);
  return toHex([r * (1 + amt), g * (1 + amt), b * (1 + amt)]);
}

export function mix(a, b, t) {
  const A = parseHex(a);
  const B = parseHex(b);
  return toHex([A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t]);
}

export function rgba(hex, alpha) {
  const [r, g, b] = parseHex(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// ---------- pixel sprites ----------

/**
 * Build a sprite from rows of characters. `colors` maps a character to a CSS colour;
 * "." (or any unmapped char) is transparent. Scale multiplies every pixel.
 */
export function sprite(rows, colors, scale = 1, flip = false) {
  const h = rows.length;
  const w = rows[0].length;
  const { c, ctx } = makeCanvas(w * scale, h * scale);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const ch = rows[y][flip ? w - 1 - x : x];
      const col = colors[ch];
      if (!col) continue;
      ctx.fillStyle = col;
      ctx.fillRect(x * scale, y * scale, scale, scale);
    }
  }
  return c;
}

/** Tint a sprite canvas to a flat colour (hit flashes, silhouettes). Cached per sprite+colour. */
const tintCache = new WeakMap();
export function tinted(src, color) {
  let byColor = tintCache.get(src);
  if (!byColor) tintCache.set(src, (byColor = new Map()));
  if (byColor.has(color)) return byColor.get(color);
  const { c, ctx } = makeCanvas(src.width, src.height);
  ctx.drawImage(src, 0, 0);
  ctx.globalCompositeOperation = "source-in";
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, c.width, c.height);
  byColor.set(color, c);
  return c;
}

// ---------- procedural textures ----------

/**
 * Tileable speckle/blotch texture: a base colour, soft blotches (large low-contrast patches)
 * and pixel speckles. Wraps at the edges so it can be used as a repeating pattern.
 */
export function noiseTile(size, { base, blotches = [], speckles = [], seed = 1, cracks = null } = {}) {
  const { c, ctx } = makeCanvas(size, size);
  const rand = mulberry32(seed);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);

  // Soft blotches (drawn 9x with wrap offsets so the tile is seamless)
  for (const b of blotches) {
    for (let i = 0; i < b.count; i++) {
      const x = rand() * size;
      const y = rand() * size;
      const r = b.min + rand() * (b.max - b.min);
      for (const ox of [-size, 0, size]) {
        for (const oy of [-size, 0, size]) {
          const g = ctx.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r);
          g.addColorStop(0, rgba(b.color, b.alpha ?? 0.35));
          g.addColorStop(1, rgba(b.color, 0));
          ctx.fillStyle = g;
          ctx.fillRect(x + ox - r, y + oy - r, r * 2, r * 2);
        }
      }
    }
  }

  // Pixel speckles
  for (const s of speckles) {
    const n = Math.round(size * size * s.density);
    ctx.fillStyle = s.color;
    for (let i = 0; i < n; i++) {
      const w = s.size || 1;
      ctx.fillRect(Math.floor(rand() * size), Math.floor(rand() * size), w, w);
    }
  }

  // Thin random-walk cracks
  if (cracks) {
    ctx.strokeStyle = cracks.color;
    ctx.lineWidth = 1;
    for (let i = 0; i < cracks.count; i++) {
      let x = rand() * size;
      let y = rand() * size;
      ctx.beginPath();
      ctx.moveTo(x, y);
      const steps = 4 + Math.floor(rand() * 6);
      for (let k = 0; k < steps; k++) {
        x += (rand() - 0.5) * 10;
        y += (rand() - 0.5) * 10;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }
  return c;
}

/** Brick / panel / plank texture. */
export function brickTile(w, h, { base, mortar, rows = 4, cols = 2, seed = 3, jitter = 0.12, bevel = true } = {}) {
  const { c, ctx } = makeCanvas(w, h);
  const rand = mulberry32(seed);
  ctx.fillStyle = mortar;
  ctx.fillRect(0, 0, w, h);
  const rh = h / rows;
  const bw = w / cols;
  for (let r = 0; r < rows; r++) {
    const off = r % 2 ? bw / 2 : 0;
    for (let k = -1; k <= cols; k++) {
      const x = k * bw + off;
      const col = shade(base, (rand() - 0.5) * jitter * 2);
      ctx.fillStyle = col;
      ctx.fillRect(Math.round(x + 1), Math.round(r * rh + 1), Math.round(bw - 2), Math.round(rh - 2));
      if (bevel) {
        ctx.fillStyle = shade(col, 0.18);
        ctx.fillRect(Math.round(x + 1), Math.round(r * rh + 1), Math.round(bw - 2), 1);
        ctx.fillStyle = shade(col, -0.25);
        ctx.fillRect(Math.round(x + 1), Math.round(r * rh + rh - 2), Math.round(bw - 2), 1);
      }
    }
  }
  return c;
}

const patternCache = new WeakMap();
/** Cached CanvasPattern for a texture canvas. */
export function patternOf(ctx, tex) {
  let byCtx = patternCache.get(tex);
  if (!byCtx) patternCache.set(tex, (byCtx = new WeakMap()));
  let p = byCtx.get(ctx);
  if (!p) {
    p = ctx.createPattern(tex, "repeat");
    byCtx.set(ctx, p);
  }
  return p;
}

/** Fill a rect with a texture that stays anchored to world space (offset by camera). */
export function fillTextured(ctx, tex, x, y, w, h, ox = 0, oy = 0) {
  const p = patternOf(ctx, tex);
  ctx.save();
  ctx.translate(-ox, -oy);
  ctx.fillStyle = p;
  ctx.fillRect(x + ox, y + oy, w, h);
  ctx.restore();
}

// ---------- screen treatments ----------

const overlayCache = new Map();

/** Dark corners (cached per size/strength). */
export function vignette(ctx, w, h, strength = 0.55, color = "#000000") {
  const key = `v${w}x${h}:${strength}:${color}`;
  let tex = overlayCache.get(key);
  if (!tex) {
    const { c, ctx: g } = makeCanvas(w, h);
    const grad = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.hypot(w, h) * 0.58);
    grad.addColorStop(0, rgba(color, 0));
    grad.addColorStop(1, rgba(color, strength));
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
    tex = c;
    overlayCache.set(key, tex);
  }
  ctx.drawImage(tex, 0, 0);
}

/** Subtle CRT scanlines (cached). */
export function scanlines(ctx, w, h, alpha = 0.07, gap = 3) {
  const key = `s${w}x${h}:${alpha}:${gap}`;
  let tex = overlayCache.get(key);
  if (!tex) {
    const { c, ctx: g } = makeCanvas(w, h);
    g.fillStyle = `rgba(0,0,0,${alpha})`;
    for (let y = 0; y < h; y += gap) g.fillRect(0, y, w, 1);
    tex = c;
    overlayCache.set(key, tex);
  }
  ctx.drawImage(tex, 0, 0);
}

/** Additive soft light blob. */
export function glow(ctx, x, y, r, color, alpha = 0.5) {
  if (r <= 0) return;
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgba(color, alpha));
  g.addColorStop(1, rgba(color, 0));
  const prev = ctx.globalCompositeOperation;
  ctx.globalCompositeOperation = "lighter";
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.globalCompositeOperation = prev;
}

/**
 * Darkness layer with light cut-outs (like Mars Base's night lighting).
 *   const L = createLightLayer(w, h); L.begin("#05070d", 0.6); L.light(x, y, 120); L.draw(ctx);
 */
export function createLightLayer(w, h) {
  const { c, ctx } = makeCanvas(w, h);
  return {
    canvas: c,
    begin(color = "#000000", alpha = 0.6) {
      ctx.globalCompositeOperation = "source-over";
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = rgba(color, alpha);
      ctx.fillRect(0, 0, w, h);
      ctx.globalCompositeOperation = "destination-out";
    },
    light(x, y, r, intensity = 1) {
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(0,0,0,${intensity})`);
      g.addColorStop(0.6, `rgba(0,0,0,${intensity * 0.55})`);
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    },
    draw(target) {
      ctx.globalCompositeOperation = "source-over";
      target.drawImage(c, 0, 0);
    }
  };
}

// ---------- particles ----------

/**
 * Pooled particle system.
 *   const fx = createParticles(600);
 *   fx.burst(x, y, { count: 20, color: "#ffb000", speed: 160, life: 0.6, size: 3, gravity: 200, kind: "spark" });
 *   fx.update(dt); fx.draw(ctx);
 * kinds: "spark" (streak), "pixel" (square), "smoke" (fading growing puff), "glow" (additive blob), "ring".
 */
export function createParticles(max = 600) {
  const pool = [];
  return {
    get count() {
      return pool.length;
    },
    clear() {
      pool.length = 0;
    },
    spawn(p) {
      if (pool.length >= max) pool.shift();
      pool.push({
        x: p.x, y: p.y,
        vx: p.vx || 0, vy: p.vy || 0,
        life: p.life || 0.6, maxLife: p.life || 0.6,
        size: p.size || 2, grow: p.grow || 0,
        color: p.color || "#ffffff", color2: p.color2 || null,
        gravity: p.gravity || 0, drag: p.drag ?? 0.98,
        kind: p.kind || "pixel", alpha: p.alpha ?? 1,
        rot: p.rot || 0, vr: p.vr || 0
      });
    },
    burst(x, y, o = {}) {
      const n = o.count || 12;
      for (let i = 0; i < n; i++) {
        const a = (o.angle ?? Math.random() * Math.PI * 2) + (o.spread != null ? (Math.random() - 0.5) * o.spread : 0);
        const ang = o.spread != null ? a : Math.random() * Math.PI * 2;
        const sp = (o.speed || 120) * (0.35 + Math.random() * 0.65);
        this.spawn({
          ...o,
          x: x + (Math.random() - 0.5) * (o.jitter || 0),
          y: y + (Math.random() - 0.5) * (o.jitter || 0),
          vx: Math.cos(ang) * sp + (o.vx || 0),
          vy: Math.sin(ang) * sp + (o.vy || 0),
          life: (o.life || 0.6) * (0.6 + Math.random() * 0.6),
          size: (o.size || 2) * (0.7 + Math.random() * 0.6)
        });
      }
    },
    update(dt) {
      for (let i = pool.length - 1; i >= 0; i--) {
        const p = pool[i];
        p.life -= dt;
        if (p.life <= 0) {
          pool.splice(i, 1);
          continue;
        }
        const d = Math.pow(p.drag, dt * 60);
        p.vx *= d;
        p.vy = p.vy * d + p.gravity * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.size += p.grow * dt;
        p.rot += p.vr * dt;
      }
    },
    draw(ctx) {
      for (const p of pool) {
        const k = Math.max(0, p.life / p.maxLife);
        const col = p.color2 && k < 0.5 ? p.color2 : p.color;
        if (p.kind === "glow") {
          glow(ctx, p.x, p.y, p.size, col, p.alpha * k);
          continue;
        }
        ctx.globalAlpha = p.alpha * (p.kind === "smoke" ? k * 0.6 : Math.min(1, k * 1.6));
        if (p.kind === "spark") {
          ctx.strokeStyle = col;
          ctx.lineWidth = Math.max(1, p.size * 0.6);
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03);
          ctx.stroke();
        } else if (p.kind === "smoke") {
          ctx.fillStyle = col;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        } else if (p.kind === "ring") {
          ctx.strokeStyle = col;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.stroke();
        } else if (p.kind === "shard") {
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.fillStyle = col;
          ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
          ctx.restore();
        } else {
          ctx.fillStyle = col;
          const s = Math.max(1, Math.round(p.size));
          ctx.fillRect(Math.round(p.x - s / 2), Math.round(p.y - s / 2), s, s);
        }
      }
      ctx.globalAlpha = 1;
    }
  };
}

// ---------- misc drawing helpers ----------

/** Pixel-font text with a hard drop shadow (retro HUD look). */
export function shadowText(ctx, text, x, y, color, shadow = "#000000", off = 2) {
  ctx.fillStyle = shadow;
  ctx.fillText(text, x + off, y + off);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

/** Chunky bevelled panel (HUD boxes drawn on canvas). */
export function bevelPanel(ctx, x, y, w, h, { fill = "#0b0f18", light = "#2a3350", dark = "#05070c", border = null } = {}) {
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = light;
  ctx.fillRect(x, y, w, 2);
  ctx.fillRect(x, y, 2, h);
  ctx.fillStyle = dark;
  ctx.fillRect(x, y + h - 2, w, 2);
  ctx.fillRect(x + w - 2, y, 2, h);
  if (border) {
    ctx.strokeStyle = border;
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  }
}

/** Starfield layer cached to a canvas (twinkle handled by caller alpha if wanted). */
export function starfield(w, h, { count = 200, seed = 7, colors = ["#ffffff", "#bcd4ff", "#ffe6b0"] } = {}) {
  const { c, ctx } = makeCanvas(w, h);
  const rand = mulberry32(seed);
  for (let i = 0; i < count; i++) {
    const x = Math.floor(rand() * w);
    const y = Math.floor(rand() * h);
    const b = rand();
    ctx.globalAlpha = 0.25 + b * 0.75;
    ctx.fillStyle = colors[Math.floor(rand() * colors.length)];
    ctx.fillRect(x, y, b > 0.92 ? 2 : 1, b > 0.92 ? 2 : 1);
    if (b > 0.985) {
      ctx.globalAlpha = 0.35;
      ctx.fillRect(x - 2, y, 5, 1);
      ctx.fillRect(x, y - 2, 1, 5);
    }
  }
  ctx.globalAlpha = 1;
  return c;
}
