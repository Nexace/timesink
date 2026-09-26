// Ghost Lap broadcast-style HUD, drawn in screen space on the race canvas.
import { KMH, CAR, ERS, LIMITS, BRAKES } from "./race.js";

const DISPLAY = "'Press Start 2P', monospace";
const BODY = "'VT323', 'Share Tech Mono', monospace";
const SECTOR_COLORS = { purple: "#b44dff", green: "#22e36b", yellow: "#ffd23f", red: "#ff4d5e" };

export function fmtLap(ms) {
  if (!Number.isFinite(ms)) return "--:--.---";
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const f = Math.floor(ms % 1000);
  return `${m}:${String(s).padStart(2, "0")}.${String(f).padStart(3, "0")}`;
}
export const fmtSec = (s) => fmtLap(s * 1000);

function panel(ctx, x, y, w, h, alpha = 0.78) {
  ctx.fillStyle = `rgba(6, 9, 16, ${alpha})`;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = "rgba(0, 170, 255, 0.35)";
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
}

function text(ctx, str, x, y, { font = DISPLAY, size = 10, color = "#fff", align = "left", base = "alphabetic" } = {}) {
  ctx.font = `${size}px ${font}`;
  ctx.textAlign = align;
  ctx.textBaseline = base;
  ctx.fillStyle = color;
  ctx.fillText(str, x, y);
}

// The timing towers are dozens of lines of pixel-font text, the most expensive thing on the HUD. Each
// is drawn into its own image and reused, redrawn ~10 times a second (gaps tick over smoothly enough)
// and straight away whenever the rows themselves change (order, who's shown, penalties...).
const panelCache = new Map();
function cachedPanel(ctx, id, key, x, y, w, h, draw) {
  if (typeof document === "undefined") return draw(ctx); // (outside a browser: draw directly)
  const m = ctx.getTransform();
  const sx = Math.hypot(m.a, m.b) || 1;
  const pw = Math.max(1, Math.ceil(w * sx));
  const ph = Math.max(1, Math.ceil(h * sx));
  const now = performance.now();
  let c = panelCache.get(id);
  if (!c) panelCache.set(id, (c = { canvas: document.createElement("canvas"), key: null, at: -1e9 }));
  if (c.key !== key || now - c.at > 100 || c.canvas.width !== pw || c.canvas.height !== ph) {
    c.canvas.width = pw;
    c.canvas.height = ph;
    const g = c.canvas.getContext("2d");
    g.setTransform(sx, 0, 0, sx, -x * sx, -y * sx);
    draw(g);
    c.key = key;
    c.at = now;
  }
  // (placed on whole device pixels so the text stays as crisp as if it were drawn directly)
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(c.canvas, Math.round(m.e + x * sx), Math.round(m.f + y * sx));
  ctx.restore();
}

// Which rows a tower shows: all of them, or (on a small screen) the top three plus the ones around
// the player. Returns [[position index, row], ...] in order.
function towerRows(rows, maxRows, isMe) {
  const all = rows.map((r, k) => [k, r]);
  if (!maxRows || rows.length <= maxRows) return all;
  const me = Math.max(0, rows.findIndex(isMe));
  const keep = new Set([0, 1, 2]);
  const room = maxRows - 3;
  let from = Math.max(3, Math.min(me - Math.floor(room / 2), rows.length - room));
  for (let k = from; k < from + room; k++) keep.add(k);
  return all.filter(([k]) => keep.has(k));
}

function timingTower(ctx, race, x, y, maxRows = 0) {
  const rows = race.order;
  // A 20-car field gets a compact tower so it still clears the speed panel
  const big = rows.length > 12;
  const rowH = big ? 21 : 26;
  const w = 238;
  const shown = towerRows(rows, maxRows, (c) => c.isPlayer);
  const key = `${race.mode}|${rowH}|${race.bestLapBy}|${shown.map(([k, c]) => `${k}:${c.id}:${c.finished ? 1 : 0}:${c.penalty}`).join(",")}`;
  cachedPanel(ctx, "race", key, x, y, w, 30 + shown.length * rowH, (ctx) => {
    panel(ctx, x, y, w, 30 + shown.length * rowH);
    text(ctx, race.mode === "duel" ? "DUEL" : "RACE ORDER", x + 12, y + 20, { size: 9, color: "#8fb4ff" });
    text(ctx, "GAP", x + w - 12, y + 20, { size: 8, color: "#6c7a96", align: "right" });
    shown.forEach(([k, c], slot) => {
      const ry = y + 30 + slot * rowH;
      if (c.isPlayer) {
        ctx.fillStyle = "rgba(0, 136, 255, 0.28)";
        ctx.fillRect(x + 2, ry, w - 4, rowH - 2);
      }
      const ty = ry + (big ? 15 : 18);
      text(ctx, String(k + 1).padStart(2, " "), x + 10, ty, { size: big ? 9 : 10, color: k === 0 ? "#ffd400" : "#fff" });
      ctx.fillStyle = c.color;
      ctx.fillRect(x + 44, ry + 4, 4, rowH - 9);
      text(ctx, c.code, x + 56, ty, { size: big ? 9 : 10, color: c.isPlayer ? "#6fd3ff" : "#e8ecf4" });
      let gap = "";
      if (c.finished) gap = k === 0 ? "FLAG" : `+${c.gapLeader.toFixed(3)}`;
      else if (k === 0) gap = "LEADER";
      else gap = `+${c.gapAhead.toFixed(3)}`;
      if (c.penalty) gap = `${gap} ▲${c.penalty}s`;
      text(ctx, gap, x + w - 12, ry + (big ? 16 : 19), { font: BODY, size: big ? 17 : 20, color: k === 0 ? "#ffd400" : "#c9d2e3", align: "right" });
      if (race.bestLapBy === c.id) {
        ctx.fillStyle = SECTOR_COLORS.purple;
        ctx.fillRect(x + 140, ry + (big ? 6 : 8), 7, 7);
      }
    });
  });
}

// Live qualifying tower: everyone's best lap (gap to the fastest), how far into their run they are,
// and a flash of each new lap as it comes in (purple = fastest overall, green = personal best,
// yellow = slower, red = deleted)
function qualiTower(ctx, rows, x, y, title, maxRows = 0) {
  const rowH = 20;
  const w = 300;
  const shown = towerRows(rows, maxRows, (r) => r.isPlayer);
  const key = `${title}|${shown.map(([k, r]) => `${k}:${r.code}:${r.status}:${r.best}:${r.flash}:${r.flashTime}`).join(",")}`;
  cachedPanel(ctx, "quali", key, x, y, w, 30 + shown.length * rowH, (ctx) => {
    panel(ctx, x, y, w, 30 + shown.length * rowH);
    text(ctx, title, x + 12, y + 20, { size: 9, color: "#8fb4ff" });
    text(ctx, "LIVE", x + w - 12, y + 20, { size: 8, color: "#ff4d5e", align: "right" });
    const pole = rows[0] && Number.isFinite(rows[0].best) ? rows[0].best : null;
    shown.forEach(([k, r], slot) => {
      const ry = y + 30 + slot * rowH;
      if (r.flash) {
        ctx.fillStyle = r.flash;
        ctx.globalAlpha = 0.22;
        ctx.fillRect(x + 2, ry, w - 4, rowH - 2);
        ctx.globalAlpha = 1;
      } else if (r.isPlayer) {
        ctx.fillStyle = "rgba(0, 136, 255, 0.28)";
        ctx.fillRect(x + 2, ry, w - 4, rowH - 2);
      }
      const ty = ry + 14;
      const timed = Number.isFinite(r.best);
      text(ctx, timed ? String(k + 1).padStart(2, " ") : " -", x + 10, ty, { size: 9, color: k === 0 && timed ? "#ffd400" : "#fff" });
      ctx.fillStyle = r.color;
      ctx.fillRect(x + 40, ry + 4, 4, rowH - 8);
      text(ctx, r.code, x + 52, ty, { size: 9, color: r.isPlayer ? "#6fd3ff" : "#e8ecf4" });
      text(ctx, r.status, x + 112, ty, { size: 7, color: r.status === "GARAGE" ? "#55606f" : r.status === "DONE" ? "#8a95a8" : "#22e36b" });
      let t;
      let col = "#c9d2e3";
      if (r.flash) {
        t = r.flashValid ? fmtLap(r.flashTime * 1000) : "DELETED";
        col = r.flash;
      } else if (!timed) t = "NO TIME";
      else if (k === 0 || !pole) {
        t = fmtLap(r.best * 1000);
        col = "#ffd400";
      } else t = `+${(r.best - pole).toFixed(3)}`;
      text(ctx, t, x + w - 12, ry + 15, { font: BODY, size: 17, color: col, align: "right" });
    });
  });
}

function lapList(ctx, car, bestTrail, x, y, title = "TIME TRIAL") {
  const laps = car.lapTimes.slice(-6);
  panel(ctx, x, y, 238, 60 + Math.max(1, laps.length) * 24);
  text(ctx, title, x + 12, y + 20, { size: 9, color: "#8fb4ff" });
  text(ctx, `BEST ${fmtLap(car.bestLap * 1000)}`, x + 12, y + 42, { font: BODY, size: 22, color: "#b44dff" });
  if (!laps.length) text(ctx, "SET A FLYING LAP", x + 12, y + 70, { font: BODY, size: 20, color: "#6c7a96" });
  laps.forEach((l, k) => {
    const n = car.lapTimes.length - laps.length + k + 1;
    text(ctx, `L${n}`, x + 12, y + 70 + k * 24, { font: BODY, size: 20, color: "#8a96ad" });
    text(ctx, l.valid ? fmtLap(l.time * 1000) : `${fmtLap(l.time * 1000)} ✕`, x + 226, y + 70 + k * 24, {
      font: BODY,
      size: 20,
      color: !l.valid ? "#ff4d5e" : l.time === car.bestLap ? "#b44dff" : "#e8ecf4",
      align: "right"
    });
  });
  if (bestTrail) text(ctx, "GHOST ACTIVE", x + 226, y + 20, { size: 7, color: "#ff5ea8", align: "right" });
}

function minimap(ctx, mm, race, x, y, ghost) {
  const { img, scale, pad } = mm;
  panel(ctx, x, y, img.width + 8, img.height + 8, 0.7);
  ctx.drawImage(img, x + 4, y + 4);
  const dot = (cx, cy, color, r) => {
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.arc(x + 4 + pad + cx * scale, y + 4 + pad + cy * scale, r + 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x + 4 + pad + cx * scale, y + 4 + pad + cy * scale, r, 0, Math.PI * 2);
    ctx.fill();
  };
  if (ghost) dot(ghost.x, ghost.y, "rgba(255, 94, 168, 0.8)", 3);
  for (const c of race.cars) if (!c.isPlayer) dot(c.x, c.y, c.color, 3.2);
  if (race.player) dot(race.player.x, race.player.y, "#00f0ff", 5);
}

function speedPanel(ctx, car, x, y, drsState, now = 0) {
  panel(ctx, x, y, car.brakeTemp != null ? 452 : 384, 110);
  if (car.brakeTemp != null) brakeGauge(ctx, car, x + 384, y, now);
  const kmh = Math.max(0, Math.round(car.fwd * KMH));
  text(ctx, String(kmh).padStart(3, "0"), x + 16, y + 58, { size: 34, color: "#ffffff" });
  text(ctx, "KM/H", x + 150, y + 58, { size: 10, color: "#8fb4ff" });
  const gear = car.fwd < -5 ? "R" : car.fwd < 8 ? "N" : String(Math.min(8, 1 + Math.floor((car.fwd / CAR.top) * 7.6)));
  text(ctx, gear, x + 258, y + 58, { size: 30, color: "#ffd400", align: "center" });
  text(ctx, "GEAR", x + 258, y + 76, { size: 7, color: "#6c7a96", align: "center" });
  // Rev lights: green → red → blue at the limiter
  const gearSpan = CAR.top / 7.6;
  const rev = car.fwd > 8 ? ((car.fwd % gearSpan) / gearSpan) * (car.throttle > 0 ? 1 : 0.6) : car.throttle * 0.5;
  for (let k = 0; k < 15; k++) {
    const on = k / 15 < rev;
    const col = k < 5 ? "#22e36b" : k < 10 ? "#ff3b3b" : "#3a8bff";
    ctx.fillStyle = on ? col : "rgba(255,255,255,0.08)";
    ctx.fillRect(x + 16 + k * 18, y + 12, 14, 8);
  }
  // DRS / tow / surface
  const drsCol = drsState === "open" ? "#22e36b" : drsState === "ready" ? "#ffd23f" : "rgba(255,255,255,0.15)";
  ctx.strokeStyle = drsCol;
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 16, y + 80, 60, 20);
  if (drsState === "open") {
    ctx.fillStyle = "rgba(34, 227, 107, 0.25)";
    ctx.fillRect(x + 16, y + 80, 60, 20);
  }
  text(ctx, "DRS", x + 46, y + 95, { size: 9, color: drsCol, align: "center" });
  // Behind another car: in a corner that's dirty air (less grip), on a straight it's a tow
  if (car.dirty > 0.3 && Math.abs(car.steer) > 0.12) text(ctx, "DIRTY", x + 90, y + 95, { size: 9, color: "#ff9a3c" });
  else if (car.slip) text(ctx, "TOW", x + 90, y + 95, { size: 9, color: "#6fd3ff" });
  if (car.surface !== "track") text(ctx, car.surface === "kerb" ? "KERB" : "OFF", x + 136, y + 95, { size: 9, color: "#ff9a3c" });
  if (car.ersOn) text(ctx, "DEPLOY", x + 190, y + 95, { size: 9, color: Math.sin(now * 14) > -0.3 ? "#ffd400" : "#b88a00" });
  else if (car.harvesting) text(ctx, "HARVEST", x + 190, y + 95, { size: 9, color: "#22e36b" });

  // ERS: battery (tall bar) and what the brakes can still recover this lap (thin bar)
  const bx = x + 306;
  const by = y + 12;
  const bh = 74;
  const locked = car.drsOpen;
  ctx.fillStyle = "rgba(255,255,255,0.08)";
  ctx.fillRect(bx, by, 26, bh);
  const lvl = Math.max(0, Math.min(1, car.battery ?? 0));
  const col = locked ? "#55606f" : car.ersOn ? "#ffd400" : car.harvesting ? "#22e36b" : lvl < 0.15 ? "#ff4d5e" : "#22c3ff";
  ctx.fillStyle = col;
  ctx.fillRect(bx + 2, by + bh - 2 - (bh - 4) * lvl, 22, (bh - 4) * lvl);
  ctx.strokeStyle = "rgba(255,255,255,0.25)";
  ctx.lineWidth = 1;
  for (let k = 1; k < 4; k++) {
    ctx.beginPath();
    ctx.moveTo(bx, by + (bh * k) / 4);
    ctx.lineTo(bx + 26, by + (bh * k) / 4);
    ctx.stroke();
  }
  const budget = Math.max(0, ERS.harvestLap - (car.ersHarvestLap ?? 0)) / ERS.harvestLap;
  ctx.fillStyle = "rgba(255,255,255,0.08)";
  ctx.fillRect(bx + 32, by, 8, bh);
  ctx.fillStyle = "#22e36b";
  ctx.fillRect(bx + 32, by + bh - bh * budget, 8, bh * budget);
  text(ctx, locked ? "LOCK" : "ERS", bx + 20, y + 100, { size: 7, color: locked ? "#8a95a8" : "#8fb4ff", align: "center" });
  text(ctx, `${Math.round(lvl * 100)}%`, bx + 13, by - 2 + 0, { size: 6, color: "#d7deea", align: "center" });
}

// Brake gauge: disc temperature (tall bar, °C, coloured by the operating window) and brake life (thin bar)
function brakeGauge(ctx, car, x, y, now) {
  const bx = x + 4;
  const by = y + 12;
  const bh = 74;
  const T = car.brakeTemp;
  const lo = BRAKES.ambient;
  const hi = 1400;
  ctx.fillStyle = "rgba(255,255,255,0.08)";
  ctx.fillRect(bx, by, 26, bh);
  // Window markers: the green band is where the brakes work best
  const yAt = (t) => by + bh - ((Math.min(hi, Math.max(lo, t)) - lo) / (hi - lo)) * bh;
  ctx.fillStyle = "rgba(34, 227, 107, 0.16)";
  ctx.fillRect(bx, yAt(BRAKES.window[1]), 26, yAt(BRAKES.window[0]) - yAt(BRAKES.window[1]));
  const col = T > BRAKES.fade ? (Math.sin(now * 16) > 0 ? "#ff3b3b" : "#ff9a3c") : T > BRAKES.window[1] ? "#ffb020" : T < BRAKES.window[0] ? "#3aa0ff" : "#22e36b";
  ctx.fillStyle = col;
  ctx.fillRect(bx + 3, yAt(T), 20, by + bh - yAt(T));
  ctx.strokeStyle = "#ff4d5e";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(bx, yAt(BRAKES.fade));
  ctx.lineTo(bx + 26, yAt(BRAKES.fade));
  ctx.stroke();
  // Life left
  const life = Math.max(0, car.brakeLife);
  ctx.fillStyle = "rgba(255,255,255,0.08)";
  ctx.fillRect(bx + 32, by, 8, bh);
  ctx.fillStyle = life < BRAKES.worn ? "#ff4d5e" : life < 0.55 ? "#ffb020" : "#d7deea";
  ctx.fillRect(bx + 32, by + bh - bh * life, 8, bh * life);
  text(ctx, `${Math.round(T)}°`, bx + 13, by - 2, { size: 6, color: col, align: "center" });
  text(ctx, T > BRAKES.fade ? "HOT!" : life < BRAKES.worn ? "WORN" : "BRK", bx + 20, y + 100, { size: 7, color: T > BRAKES.fade || life < BRAKES.worn ? "#ff4d5e" : "#8fb4ff", align: "center" });
  text(ctx, `${Math.round(life * 100)}%`, bx + 36, by - 2, { size: 6, color: "#d7deea", align: "center" });
}

function timingPanel(ctx, race, car, x, y, w, extra) {
  panel(ctx, x, y, w, 110);
  const lapT = race.phase === "racing" && car.laps >= 0 ? (race.t - car.lapStart) * 1000 : 0;
  text(ctx, fmtLap(lapT), x + w / 2, y + 58, { size: 20, color: car.lapValid ? "#ffffff" : "#ff4d5e", align: "center" });
  if (!car.lapValid) text(ctx, "LAP INVALID", x + 16, y + 58, { size: 7, color: "#ff4d5e" });
  // Sector boxes
  const bw = (w - 48) / 3;
  for (let k = 0; k < 3; k++) {
    const col = car.sectorColors && car.sectorColors[k];
    ctx.fillStyle = col ? SECTOR_COLORS[col] : "rgba(255,255,255,0.1)";
    ctx.fillRect(x + 16 + k * (bw + 8), y + 72, bw, 8);
    text(ctx, `S${k + 1}`, x + 16 + k * (bw + 8), y + 96, { size: 7, color: "#6c7a96" });
    const st = car.sectorTimes[k];
    if (st != null && col) text(ctx, st.toFixed(3), x + 16 + k * (bw + 8) + bw, y + 98, { font: BODY, size: 18, color: SECTOR_COLORS[col], align: "right" });
  }
  if (extra) text(ctx, extra.text, x + w / 2, y + 26, { font: BODY, size: 22, color: extra.color, align: "center" });
  // Track limit warnings before the stewards start handing out penalties
  const pips = LIMITS.warnings;
  for (let k = 0; k < pips; k++) {
    ctx.fillStyle = k < car.strikes ? (car.strikes > pips ? "#ff4d5e" : "#ff9a3c") : "rgba(255,255,255,0.12)";
    ctx.fillRect(x + w - 14 - (pips - k) * 10, y + 10, 7, 7);
  }
  if (car.penalty) text(ctx, `+${car.penalty}s`, x + w - 20 - pips * 10, y + 18, { size: 8, color: "#ff4d5e", align: "right" });
}

function lightsGantry(ctx, race, W, y = 120) {
  const lit = race.lights;
  const w = 5 * 70 + 30;
  const x = (W - w) / 2;
  ctx.fillStyle = "#0b0d12";
  ctx.fillRect(x, y, w, 110);
  ctx.strokeStyle = "#2a2f3a";
  ctx.lineWidth = 3;
  ctx.strokeRect(x, y, w, 110);
  for (let k = 0; k < 5; k++) {
    for (let r = 0; r < 2; r++) {
      const cx = x + 50 + k * 70;
      const cy = y + 32 + r * 46;
      const on = k < lit && race.phase === "lights";
      if (on) {
        const g = ctx.createRadialGradient(cx, cy, 2, cx, cy, 34);
        g.addColorStop(0, "rgba(255, 40, 40, 0.8)");
        g.addColorStop(1, "rgba(255, 40, 40, 0)");
        ctx.fillStyle = g;
        ctx.fillRect(cx - 34, cy - 34, 68, 68);
      }
      ctx.fillStyle = on ? "#ff2a2a" : "#2a0c0c";
      ctx.beginPath();
      ctx.arc(cx, cy, 17, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function banners(ctx, list, W, now, y = 250) {
  const maxW = W - 24;
  for (const b of list) {
    const left = b.until - now;
    if (left <= 0) continue;
    const a = Math.min(1, left / 0.4) * Math.min(1, (now - b.at) / 0.15);
    ctx.globalAlpha = a;
    let size = b.size || 16;
    ctx.font = `${size}px ${DISPLAY}`;
    let tw = ctx.measureText(b.text).width;
    if (tw + 60 > maxW) {
      size = Math.max(9, Math.floor((size * (maxW - 60)) / tw));
      ctx.font = `${size}px ${DISPLAY}`;
      tw = ctx.measureText(b.text).width;
    }
    // Subtitle: one line if it fits, otherwise wrapped by words over as many lines as it needs
    ctx.font = `22px ${BODY}`;
    const lines = [];
    if (b.sub) {
      let line = "";
      for (const word of b.sub.split(" ")) {
        const next = line ? `${line} ${word}` : word;
        if (line && ctx.measureText(next).width + 60 > maxW) {
          lines.push(line);
          line = word;
        } else line = next;
      }
      if (line) lines.push(line);
    }
    const subW = Math.max(0, ...lines.map((l) => ctx.measureText(l).width));
    const bw = Math.min(maxW, Math.max(tw, subW) + 60);
    const bh = 46 + lines.length * 24;
    ctx.fillStyle = "rgba(6, 9, 16, 0.86)";
    ctx.fillRect((W - bw) / 2, y, bw, bh);
    ctx.fillStyle = b.color;
    ctx.fillRect((W - bw) / 2, y, 6, bh);
    ctx.fillRect((W + bw) / 2 - 6, y, 6, bh);
    text(ctx, b.text, W / 2, y + 30, { size, color: b.color, align: "center" });
    lines.forEach((l, k) => text(ctx, l, W / 2, y + 56 + k * 24, { font: BODY, size: 22, color: "#d7deea", align: "center" }));
    ctx.globalAlpha = 1;
    y += bh + 10;
  }
}

/**
 * state: { race, minimap, banners, now, ghost, bestTrail, delta, drsState, W, H, hudScale, bottomInset }
 * The HUD is laid out in "HUD units": the canvas is W x H pixels and one unit is hudScale pixels, so
 * a phone's small canvas still gets readable panels. A tall screen (portrait) gets its own layout.
 */
export function drawHud(ctx, s) {
  const { race } = s;
  const U = s.hudScale || 1;
  const W = s.W / U;
  const H = s.H / U;
  const Hb = H - (s.bottomInset || 0); // bottom panels sit above any on-screen touch controls
  const portrait = W < H * 1.2;
  const car = race.player;
  ctx.save();
  ctx.setTransform(U, 0, 0, U, 0, 0);
  // Towers show as many rows as fit above the bottom panels (and stay short on a tall screen)
  const towerRoom = (car ? Hb - 126 - (portrait ? 120 : 0) : H) - 16 - 12 - 30;
  const rowsFor = (rowH) => Math.max(5, Math.min(portrait ? 9 : 99, Math.floor(towerRoom / rowH)));
  if (race.mode === "trial" && car && s.qualiBoard) qualiTower(ctx, s.qualiBoard, 16, 16, `QUALIFYING • LAP ${Math.min(car.lapTimes.length + 1, s.quali)}/${s.quali}`, rowsFor(20));
  else if (race.mode === "trial" && car) lapList(ctx, car, s.bestTrail, 16, 16, "TIME TRIAL");
  else timingTower(ctx, race, 16, 16, rowsFor(race.order.length > 12 ? 21 : 26));

  // Minimap top-right (smaller on a tall screen), lap counter + race clock top-centre or under the map
  const mmScale = portrait ? 0.6 : 1;
  const mmW = (s.minimap.img.width + 8) * mmScale;
  ctx.save();
  const mmY = 14 + (s.topRightInset || 0); // clear of the fullscreen EXIT / CONTROLS buttons
  ctx.translate(W - mmW - 16, mmY);
  ctx.scale(mmScale, mmScale);
  minimap(ctx, s.minimap, race, 0, 0, s.ghost);
  ctx.restore();
  const lapW = portrait ? mmW : 300;
  const lapX = portrait ? W - mmW - 16 : W / 2 - 150;
  const lapY = portrait ? mmY + mmW + 8 : 14;
  const lapBig = portrait ? 11 : 14;
  panel(ctx, lapX, lapY, lapW, 58);
  if (race.mode === "trial") {
    text(ctx, `LAP ${Math.max(1, (car?.laps ?? 0) + 1)}`, lapX + lapW / 2, lapY + 26, { size: lapBig, color: "#fff", align: "center" });
    text(ctx, race.track.name.toUpperCase(), lapX + lapW / 2, lapY + 48, { font: BODY, size: portrait ? 15 : 18, color: "#8fb4ff", align: "center" });
  } else {
    const lapNow = Math.min(race.laps, Math.max(1, (car ? car.laps : race.order[0].laps) + 1));
    text(ctx, `LAP ${lapNow}/${race.laps}`, lapX + lapW / 2, lapY + 26, { size: lapBig, color: race.flag ? "#ffd400" : "#fff", align: "center" });
    text(ctx, race.phase === "racing" || race.phase === "finished" ? fmtSec(race.t) : "GRID", lapX + lapW / 2, lapY + 48, { font: BODY, size: 20, color: "#8fb4ff", align: "center" });
  }

  if (car) {
    speedPanel(ctx, car, 16, Hb - 126, s.drsState, s.now);
    let extra = null;
    if (race.mode === "trial" && s.delta != null) {
      extra = { text: `${s.delta <= 0 ? "-" : "+"}${Math.abs(s.delta).toFixed(3)}`, color: s.delta <= 0 ? "#22e36b" : "#ff4d5e" };
    } else if (race.mode !== "trial" && car.pos) {
      const ahead = race.order[car.pos - 2];
      const behind = race.order[car.pos];
      const parts = [`P${car.pos}`];
      if (ahead) parts.push(`▲ ${car.gapAhead.toFixed(2)}`);
      if (behind) parts.push(`▼ ${behind.gapAhead.toFixed(2)}`);
      extra = { text: parts.join("   "), color: "#d7deea" };
    }
    if (portrait) {
      // Tall screen: lap timing stacked above the speed panel; no room for the last / best box
      timingPanel(ctx, race, car, 16, Hb - 126 - 120, Math.min(400, W - 32), extra);
    } else {
      timingPanel(ctx, race, car, W / 2 - 200, Hb - 126, 400, extra);
      // Last / best lap
      panel(ctx, W - 250, Hb - 126, 234, 110);
      const last = car.lapTimes[car.lapTimes.length - 1];
      text(ctx, "LAST", W - 234, Hb - 92, { size: 8, color: "#6c7a96" });
      text(ctx, last ? fmtLap(last.time * 1000) : "--:--.---", W - 30, Hb - 90, { font: BODY, size: 24, color: last && !last.valid ? "#ff4d5e" : "#e8ecf4", align: "right" });
      text(ctx, "BEST", W - 234, Hb - 58, { size: 8, color: "#6c7a96" });
      text(ctx, fmtLap(car.bestLap * 1000), W - 30, Hb - 56, { font: BODY, size: 24, color: "#b44dff", align: "right" });
      if (race.reaction != null && race.t < 6) text(ctx, `REACTION ${race.reaction.toFixed(3)}s`, W - 234, Hb - 26, { size: 8, color: "#ffd23f" });
    }
  }

  if (race.phase === "lights") lightsGantry(ctx, race, W, portrait ? Math.round(H * 0.34) : 120);
  // Banners sit just under the start lights while they're up
  // (a short landscape screen starts them higher so they clear the bottom panels)
  banners(ctx, s.banners, W, s.now, portrait ? Math.round(H * 0.34) + (race.phase === "lights" ? 124 : 0) : Math.min(250, Math.max(90, Hb - 290)));
  ctx.restore();
}
