/**
 * LAST TOWER — battlefield art: textured wasteland, dirt road that follows the live maze path,
 * spawn portal and citadel fortress. Static layers are cached on offscreen canvases.
 */
import { makeCanvas, mulberry32, hash2, shade, rgba } from "/src/core/gfx.js";

// Wasteland field: per-tile colour variation, grass tufts, rocks, craters, scorch.
export function buildField(W, H, cols, rows, tw, th) {
  const { c, ctx } = makeCanvas(W, H);
  const rand = mulberry32(4242);
  ctx.fillStyle = "#1a2418";
  ctx.fillRect(0, 0, W, H);

  // Tiles with subtle tone variation
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const v = hash2(x, y, 3);
      const base = v < 0.33 ? "#212e1f" : v < 0.66 ? "#202d1e" : "#232f1f";
      ctx.fillStyle = base;
      ctx.fillRect(x * tw, y * th, tw, th);
      // Grain
      for (let i = 0; i < 40; i++) {
        ctx.fillStyle = rand() < 0.5 ? shade(base, 0.14) : shade(base, -0.2);
        ctx.fillRect(x * tw + Math.floor(rand() * tw), y * th + Math.floor(rand() * th), 1, 1);
      }
    }
  }
  // Large soft moisture / dry patches
  for (let i = 0; i < 26; i++) {
    const x = rand() * W;
    const y = rand() * H;
    const r = 40 + rand() * 90;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    const dry = rand() < 0.5;
    g.addColorStop(0, dry ? "rgba(90, 80, 45, 0.22)" : "rgba(10, 30, 12, 0.3)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // Grass tufts
  for (let i = 0; i < 420; i++) {
    const x = Math.floor(rand() * W);
    const y = Math.floor(rand() * H);
    const col = rand() < 0.5 ? "#3f6b33" : "#557f3c";
    ctx.fillStyle = col;
    ctx.fillRect(x, y, 1, 3);
    ctx.fillRect(x + 2, y + 1, 1, 2);
    ctx.fillRect(x - 2, y + 1, 1, 2);
  }
  // Rocks
  for (let i = 0; i < 55; i++) {
    const x = Math.floor(rand() * W);
    const y = Math.floor(rand() * H);
    const s = 2 + Math.floor(rand() * 4);
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fillRect(x + 1, y + 1, s + 1, s);
    ctx.fillStyle = "#5b5f58";
    ctx.fillRect(x, y, s + 1, s);
    ctx.fillStyle = "#7d8279";
    ctx.fillRect(x, y, s, 1);
  }
  // Old shell craters and scorch marks
  for (let i = 0; i < 9; i++) {
    const x = rand() * W;
    const y = rand() * H;
    const r = 8 + rand() * 14;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r * 1.8);
    g.addColorStop(0, "rgba(10, 8, 6, 0.55)");
    g.addColorStop(0.55, "rgba(30, 22, 12, 0.35)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - r * 2, y - r * 2, r * 4, r * 4);
    ctx.strokeStyle = "rgba(120, 100, 70, 0.18)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  // Etched build grid
  ctx.strokeStyle = "rgba(0, 230, 118, 0.07)";
  ctx.lineWidth = 1;
  for (let x = 0; x <= cols; x++) {
    ctx.beginPath();
    ctx.moveTo(x * tw + 0.5, 0);
    ctx.lineTo(x * tw + 0.5, rows * th);
    ctx.stroke();
  }
  for (let y = 0; y <= rows; y++) {
    ctx.beginPath();
    ctx.moveTo(0, y * th + 0.5);
    ctx.lineTo(cols * tw, y * th + 0.5);
    ctx.stroke();
  }
  // Grid corner studs
  ctx.fillStyle = "rgba(0, 230, 118, 0.14)";
  for (let y = 0; y <= rows; y++) for (let x = 0; x <= cols; x++) ctx.fillRect(x * tw - 1, y * th - 1, 2, 2);
  return c;
}

// Dirt road along the maze path (redrawn only when the path changes).
export function buildRoad(W, H, path, tw, th) {
  const { c, ctx } = makeCanvas(W, H);
  if (!path || path.length < 2) return c;
  const pts = path.map((n) => [(n.x + 0.5) * tw, (n.y + 0.5) * th]);
  const trace = () => {
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  };
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  // Worn verge, road bed, lighter crown
  trace();
  ctx.strokeStyle = "rgba(20, 16, 10, 0.55)";
  ctx.lineWidth = 34;
  ctx.stroke();
  trace();
  ctx.strokeStyle = "#4d3d27";
  ctx.lineWidth = 27;
  ctx.stroke();
  trace();
  ctx.strokeStyle = "#5e4b31";
  ctx.lineWidth = 17;
  ctx.stroke();

  // Gravel speckle confined to the road
  ctx.save();
  trace();
  ctx.lineWidth = 27;
  ctx.globalCompositeOperation = "source-atop";
  const rand = mulberry32(pts.length * 97 + Math.round(pts[0][1]));
  for (let i = 0; i < 2600; i++) {
    const x = Math.floor(rand() * W);
    const y = Math.floor(rand() * H);
    ctx.fillStyle = rand() < 0.5 ? "rgba(140, 115, 80, 0.5)" : "rgba(30, 22, 14, 0.5)";
    ctx.fillRect(x, y, 1 + (rand() < 0.2 ? 1 : 0), 1);
  }
  ctx.restore();

  // Twin tyre tracks
  ctx.setLineDash([6, 4]);
  for (const off of [-5, 5]) {
    ctx.beginPath();
    pts.forEach(([x, y], i) => {
      // offset perpendicular to the local segment
      const [nx, ny] = pts[Math.min(i + 1, pts.length - 1)];
      const [px, py] = pts[Math.max(i - 1, 0)];
      const dx = nx - px;
      const dy = ny - py;
      const l = Math.hypot(dx, dy) || 1;
      const ox = (-dy / l) * off;
      const oy = (dx / l) * off;
      if (i) ctx.lineTo(x + ox, y + oy);
      else ctx.moveTo(x + ox, y + oy);
    });
    ctx.strokeStyle = "rgba(25, 18, 10, 0.45)";
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  ctx.setLineDash([]);
  return c;
}

// Concrete tower pad drawn under each turret
export function drawPad(ctx, x, y, w, h, accent, selected) {
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  ctx.fillRect(x + 4, y + 5, w - 4, h - 4);
  ctx.fillStyle = "#3a3f44";
  ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
  ctx.fillStyle = "#4d545a";
  ctx.fillRect(x + 2, y + 2, w - 4, 2);
  ctx.fillRect(x + 2, y + 2, 2, h - 4);
  ctx.fillStyle = "#23272b";
  ctx.fillRect(x + 2, y + h - 4, w - 4, 2);
  ctx.fillRect(x + w - 4, y + 2, 2, h - 4);
  // hazard corner chevrons
  ctx.fillStyle = rgba("#ffcc00", 0.55);
  ctx.fillRect(x + 4, y + 4, 4, 2);
  ctx.fillRect(x + 4, y + 4, 2, 4);
  ctx.fillRect(x + w - 8, y + h - 6, 4, 2);
  ctx.fillRect(x + w - 6, y + h - 8, 2, 4);
  ctx.strokeStyle = selected ? accent : rgba(accent, 0.55);
  ctx.lineWidth = selected ? 2 : 1;
  ctx.strokeRect(x + 2.5, y + 2.5, w - 5, h - 5);
}

export function drawPortal(ctx, cx, cy, t) {
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 36);
  g.addColorStop(0, "rgba(255, 60, 90, 0.9)");
  g.addColorStop(0.4, "rgba(160, 0, 60, 0.6)");
  g.addColorStop(1, "rgba(60, 0, 20, 0)");
  ctx.fillStyle = g;
  ctx.fillRect(cx - 36, cy - 36, 72, 72);
  ctx.save();
  ctx.translate(cx, cy);
  for (let i = 0; i < 3; i++) {
    ctx.rotate(t * (1.5 + i * 0.7));
    ctx.strokeStyle = `rgba(255, ${80 + i * 50}, ${120 + i * 40}, 0.8)`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 10 + i * 5, 0, Math.PI * 1.3);
    ctx.stroke();
  }
  ctx.restore();
  ctx.fillStyle = "#1a0006";
  ctx.beginPath();
  ctx.arc(cx, cy, 6, 0, Math.PI * 2);
  ctx.fill();
  // Stone arch frame
  ctx.fillStyle = "#3b2e33";
  ctx.fillRect(cx - 22, cy - 18, 5, 36);
  ctx.fillRect(cx + 17, cy - 18, 5, 36);
  ctx.fillRect(cx - 22, cy - 22, 44, 6);
  ctx.fillStyle = "#5a474e";
  ctx.fillRect(cx - 22, cy - 22, 44, 2);
  ctx.fillStyle = "#ff1744";
  ctx.fillRect(cx - 2, cy - 21, 4, 4);
}

export function drawCitadel(ctx, cx, cy, t, lives, maxLives) {
  const hurt = lives / maxLives;
  // Shield dome
  const pulse = 0.5 + Math.sin(t * 2) * 0.15;
  ctx.fillStyle = hurt < 0.3 ? `rgba(255, 23, 68, ${0.1 * pulse})` : `rgba(0, 240, 255, ${0.1 * pulse})`;
  ctx.beginPath();
  ctx.arc(cx, cy, 44, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = hurt < 0.3 ? `rgba(255, 23, 68, ${0.5 * pulse})` : `rgba(0, 240, 255, ${0.45 * pulse})`;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // Shadow
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  ctx.fillRect(cx - 18, cy - 12, 40, 34);
  // Fortress walls with crenellations
  ctx.fillStyle = "#3a4246";
  ctx.fillRect(cx - 20, cy - 14, 40, 32);
  ctx.fillStyle = "#4f595e";
  ctx.fillRect(cx - 20, cy - 14, 40, 3);
  for (let i = 0; i < 5; i++) ctx.fillRect(cx - 20 + i * 9, cy - 19, 5, 5);
  ctx.fillStyle = "#262c2f";
  ctx.fillRect(cx - 20, cy + 15, 40, 3);
  // Brick lines
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  for (let r = 0; r < 4; r++) ctx.fillRect(cx - 20, cy - 8 + r * 6, 40, 1);
  // Central keep with reactor core
  ctx.fillStyle = "#2c3337";
  ctx.fillRect(cx - 9, cy - 30, 18, 22);
  ctx.fillStyle = "#3f494e";
  ctx.fillRect(cx - 9, cy - 30, 18, 2);
  const coreCol = hurt < 0.3 ? "#ff1744" : "#00f0ff";
  ctx.fillStyle = coreCol;
  ctx.shadowColor = coreCol;
  ctx.shadowBlur = 14;
  ctx.fillRect(cx - 4, cy - 24, 8, 8);
  ctx.shadowBlur = 0;
  // Gate
  ctx.fillStyle = "#12171a";
  ctx.fillRect(cx - 6, cy + 4, 12, 14);
  ctx.fillStyle = coreCol;
  ctx.fillRect(cx - 6, cy + 4, 12, 1);
  // Antenna with blinking beacon
  ctx.fillStyle = "#8a97b1";
  ctx.fillRect(cx + 5, cy - 42, 1, 12);
  ctx.fillStyle = Math.sin(t * 4) > 0 ? "#ff3344" : "#551018";
  ctx.fillRect(cx + 4, cy - 44, 3, 3);
}
