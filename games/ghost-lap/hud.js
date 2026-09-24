// Ghost Lap broadcast-style HUD, drawn in screen space on the race canvas.
import { KMH, CAR, ERS, LIMITS } from "./race.js";

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

function timingTower(ctx, race, x, y) {
  const rows = race.order;
  // A 20-car field gets a compact tower so it still clears the speed panel
  const big = rows.length > 12;
  const rowH = big ? 21 : 26;
  const w = 238;
  panel(ctx, x, y, w, 30 + rows.length * rowH);
  text(ctx, race.mode === "duel" ? "DUEL" : "RACE ORDER", x + 12, y + 20, { size: 9, color: "#8fb4ff" });
  text(ctx, "GAP", x + w - 12, y + 20, { size: 8, color: "#6c7a96", align: "right" });
  rows.forEach((c, k) => {
    const ry = y + 30 + k * rowH;
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
}

function lapList(ctx, car, bestTrail, x, y) {
  const laps = car.lapTimes.slice(-6);
  panel(ctx, x, y, 238, 60 + Math.max(1, laps.length) * 24);
  text(ctx, "TIME TRIAL", x + 12, y + 20, { size: 9, color: "#8fb4ff" });
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
  panel(ctx, x, y, 384, 110);
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
  if (car.slip) text(ctx, "TOW", x + 90, y + 95, { size: 9, color: "#6fd3ff" });
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

function lightsGantry(ctx, race, W) {
  const lit = race.lights;
  const w = 5 * 70 + 30;
  const x = (W - w) / 2;
  const y = 120;
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

function banners(ctx, list, W, now) {
  let y = 250;
  for (const b of list) {
    const left = b.until - now;
    if (left <= 0) continue;
    const a = Math.min(1, left / 0.4) * Math.min(1, (now - b.at) / 0.15);
    ctx.globalAlpha = a;
    ctx.font = `${b.size || 16}px ${DISPLAY}`;
    const tw = ctx.measureText(b.text).width;
    const bw = Math.max(tw, b.sub ? b.sub.length * 9 : 0) + 60;
    const bh = b.sub ? 70 : 46;
    ctx.fillStyle = "rgba(6, 9, 16, 0.86)";
    ctx.fillRect((W - bw) / 2, y, bw, bh);
    ctx.fillStyle = b.color;
    ctx.fillRect((W - bw) / 2, y, 6, bh);
    ctx.fillRect((W + bw) / 2 - 6, y, 6, bh);
    text(ctx, b.text, W / 2, y + 30, { size: b.size || 16, color: b.color, align: "center" });
    if (b.sub) text(ctx, b.sub, W / 2, y + 56, { font: BODY, size: 22, color: "#d7deea", align: "center" });
    ctx.globalAlpha = 1;
    y += bh + 10;
  }
}

/** state: { race, minimap, banners, now, ghost, bestTrail, delta, drsState, W, H } */
export function drawHud(ctx, s) {
  const { race, W, H } = s;
  const car = race.player;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (race.mode === "trial" && car) lapList(ctx, car, s.bestTrail, 16, 16);
  else timingTower(ctx, race, 16, 16);

  // Lap counter + race clock
  panel(ctx, W / 2 - 150, 14, 300, 58);
  if (race.mode === "trial") {
    text(ctx, `LAP ${Math.max(1, (car?.laps ?? 0) + 1)}`, W / 2, 40, { size: 14, color: "#fff", align: "center" });
    text(ctx, race.track.name.toUpperCase(), W / 2, 62, { font: BODY, size: 18, color: "#8fb4ff", align: "center" });
  } else {
    const lapNow = Math.min(race.laps, Math.max(1, (car ? car.laps : race.order[0].laps) + 1));
    text(ctx, `LAP ${lapNow}/${race.laps}`, W / 2, 40, { size: 14, color: race.flag ? "#ffd400" : "#fff", align: "center" });
    text(ctx, race.phase === "racing" || race.phase === "finished" ? fmtSec(race.t) : "GRID", W / 2, 62, { font: BODY, size: 20, color: "#8fb4ff", align: "center" });
  }

  minimap(ctx, s.minimap, race, W - s.minimap.img.width - 24, 14, s.ghost);

  if (car) {
    speedPanel(ctx, car, 16, H - 126, s.drsState, s.now);
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
    timingPanel(ctx, race, car, W / 2 - 200, H - 126, 400, extra);
    // Last / best lap
    panel(ctx, W - 250, H - 126, 234, 110);
    const last = car.lapTimes[car.lapTimes.length - 1];
    text(ctx, "LAST", W - 234, H - 92, { size: 8, color: "#6c7a96" });
    text(ctx, last ? fmtLap(last.time * 1000) : "--:--.---", W - 30, H - 90, { font: BODY, size: 24, color: last && !last.valid ? "#ff4d5e" : "#e8ecf4", align: "right" });
    text(ctx, "BEST", W - 234, H - 58, { size: 8, color: "#6c7a96" });
    text(ctx, fmtLap(car.bestLap * 1000), W - 30, H - 56, { font: BODY, size: 24, color: "#b44dff", align: "right" });
    if (race.reaction != null && race.t < 6) text(ctx, `REACTION ${race.reaction.toFixed(3)}s`, W - 234, H - 26, { size: 8, color: "#ffd23f" });
  }

  if (race.phase === "lights") lightsGantry(ctx, race, W);
  banners(ctx, s.banners, W, s.now);
  ctx.restore();
}
