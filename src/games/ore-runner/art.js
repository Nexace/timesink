/**
 * ORE RUNNER — space art: nebula, parallax stars, textured asteroids, station, ships.
 */
import { sprite, makeCanvas, mulberry32, shade, rgba, starfield } from "/src/core/gfx.js";

// ---------------------------------------------------------------- backgrounds
export function buildSpace() {
  return {
    nebula: buildNebula(1400, 1400, 77),
    starsFar: starfield(1024, 1024, { count: 420, seed: 11, colors: ["#8fa3c7", "#b9c7e6", "#6f7fa6"] }),
    starsMid: starfield(1024, 1024, { count: 160, seed: 12 }),
    starsNear: starfield(1024, 1024, { count: 45, seed: 13, colors: ["#ffffff", "#ffe6b0"] }),
    planet: buildPlanet(190, 5),
    planets: [buildPlanet(190, 5), buildPlanet(150, 21), buildPlanet(240, 44), buildPlanet(120, 63)]
  };
}

function buildNebula(w, h, seed) {
  const { c, ctx } = makeCanvas(w, h);
  const rand = mulberry32(seed);
  const cols = ["#5a1f6b", "#1f3a7a", "#7a3316", "#20505a", "#3a1a5a"];
  // Draw each cloud at 9 wrap offsets so the texture tiles seamlessly
  for (let i = 0; i < 38; i++) {
    const x = rand() * w;
    const y = rand() * h;
    const r = 120 + rand() * 280;
    const col = cols[Math.floor(rand() * cols.length)];
    const a = 0.05 + rand() * 0.09;
    for (const ox of [-w, 0, w]) {
      for (const oy of [-h, 0, h]) {
        const g = ctx.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r);
        g.addColorStop(0, rgba(col, a));
        g.addColorStop(1, rgba(col, 0));
        ctx.fillStyle = g;
        ctx.fillRect(x + ox - r, y + oy - r, r * 2, r * 2);
      }
    }
  }
  // Fine dust grain
  for (let i = 0; i < 9000; i++) {
    ctx.fillStyle = `rgba(255,255,255,${rand() * 0.035})`;
    ctx.fillRect(Math.floor(rand() * w), Math.floor(rand() * h), 1, 1);
  }
  return c;
}

function buildPlanet(size, seed) {
  const { c, ctx } = makeCanvas(size, size);
  const rand = mulberry32(seed);
  const r = size / 2 - 6;
  const cx = size / 2;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cx, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = "#8a4a2a";
  ctx.fillRect(0, 0, size, size);
  // Banded atmosphere
  for (let y = 0; y < size; y += 3) {
    ctx.fillStyle = rgba(rand() < 0.5 ? "#c47a44" : "#5a2c18", 0.25 + rand() * 0.25);
    ctx.fillRect(0, y + Math.sin(y * 0.1) * 3, size, 2 + rand() * 4);
  }
  // Storm
  ctx.fillStyle = "rgba(230, 170, 110, 0.45)";
  ctx.beginPath();
  ctx.ellipse(cx + r * 0.25, cx + r * 0.2, r * 0.18, r * 0.09, 0.1, 0, Math.PI * 2);
  ctx.fill();
  // Terminator shadow
  const sh = ctx.createRadialGradient(cx - r * 0.45, cx - r * 0.45, r * 0.2, cx, cx, r * 1.15);
  sh.addColorStop(0, "rgba(0,0,0,0)");
  sh.addColorStop(0.6, "rgba(0,0,0,0.35)");
  sh.addColorStop(1, "rgba(0,0,0,0.92)");
  ctx.fillStyle = sh;
  ctx.fillRect(0, 0, size, size);
  ctx.restore();
  // Atmosphere rim
  ctx.strokeStyle = "rgba(255, 170, 110, 0.35)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(cx, cx, r, Math.PI * 0.8, Math.PI * 1.7);
  ctx.stroke();
  return c;
}

// ---------------------------------------------------------------- asteroids
const TIER_LOOK = {
  silicate: { base: "#6d7483", dark: "#3c414c", light: "#9aa2b2" },
  metallic: { base: "#7a5a47", dark: "#43302a", light: "#b08466", vein: "#d9dde6" },
  crystalline: { base: "#3b4452", dark: "#1f2530", light: "#5d6879", crystal: "#5ff4ff" },
  exotic: { base: "#4a3f35", dark: "#261f19", light: "#6f6152", vein: "#ffd24a" },
  unstable: { base: "#3a2224", dark: "#1c0f10", light: "#5a3538", vein: "#ff3b3b" }
};

/** Unique textured rock (unlit — lighting is applied at draw time so it stays correct while spinning). */
export function asteroidSprite(radius, tierId, seed) {
  const look = TIER_LOOK[tierId] || TIER_LOOK.silicate;
  const S = Math.ceil(radius * 2.3) + 4;
  const { c, ctx } = makeCanvas(S, S);
  const rand = mulberry32(seed);
  const cx = S / 2;
  // Irregular outline (smoothed random radii)
  const n = 18;
  const raw = Array.from({ length: n }, () => 0.62 + rand() * 0.4);
  // light smoothing keeps lumps but removes spikes
  const rr = raw.map((v, i) => v * 0.6 + (raw[(i + 1) % n] + raw[(i + n - 1) % n]) * 0.2);
  const pts = rr.map((k, i) => {
    const a = (i / n) * Math.PI * 2;
    return [cx + Math.cos(a) * radius * k, cx + Math.sin(a) * radius * k];
  });
  const outline = () => {
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
  };
  outline();
  ctx.fillStyle = look.base;
  ctx.fill();
  ctx.save();
  outline();
  ctx.clip();
  // Mottled surface
  for (let i = 0; i < radius * radius * 0.5; i++) {
    ctx.fillStyle = rand() < 0.5 ? rgba(look.light, 0.35) : rgba(look.dark, 0.45);
    const s = rand() < 0.2 ? 2 : 1;
    ctx.fillRect(Math.floor(rand() * S), Math.floor(rand() * S), s, s);
  }
  // Craters (dark bowl, lit lower rim)
  const craters = 2 + Math.floor(radius / 10);
  for (let i = 0; i < craters; i++) {
    const a = rand() * Math.PI * 2;
    const d = rand() * radius * 0.6;
    const x = cx + Math.cos(a) * d;
    const y = cx + Math.sin(a) * d;
    const cr = 2 + rand() * radius * 0.22;
    ctx.fillStyle = rgba(look.dark, 0.8);
    ctx.beginPath();
    ctx.arc(x, y, cr, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = rgba(look.light, 0.6);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(x, y, cr, 0.1 * Math.PI, 0.9 * Math.PI);
    ctx.stroke();
  }
  // Tier features
  if (look.vein) {
    ctx.strokeStyle = look.vein;
    ctx.lineWidth = tierId === "unstable" ? 2 : 1.5;
    const veins = tierId === "metallic" ? 3 : 4;
    for (let v = 0; v < veins; v++) {
      let x = cx + (rand() - 0.5) * radius;
      let y = cx + (rand() - 0.5) * radius;
      ctx.beginPath();
      ctx.moveTo(x, y);
      for (let k = 0; k < 6; k++) {
        x += (rand() - 0.5) * radius * 0.5;
        y += (rand() - 0.5) * radius * 0.5;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    if (tierId === "metallic" || tierId === "exotic") {
      for (let i = 0; i < 14; i++) {
        ctx.fillStyle = look.vein;
        ctx.fillRect(Math.floor(cx + (rand() - 0.5) * radius * 1.4), Math.floor(cx + (rand() - 0.5) * radius * 1.4), 2, 2);
      }
    }
  }
  if (look.crystal) {
    for (let i = 0; i < 5; i++) {
      const a = rand() * Math.PI * 2;
      const d = radius * (0.2 + rand() * 0.5);
      const x = cx + Math.cos(a) * d;
      const y = cx + Math.sin(a) * d;
      const h = 5 + rand() * 8;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rand() * Math.PI * 2);
      ctx.fillStyle = look.crystal;
      ctx.beginPath();
      ctx.moveTo(0, -h);
      ctx.lineTo(3, -h * 0.4);
      ctx.lineTo(3, 2);
      ctx.lineTo(-3, 2);
      ctx.lineTo(-3, -h * 0.4);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      ctx.fillRect(-1, -h + 2, 1, h * 0.6);
      ctx.restore();
    }
  }
  ctx.restore();
  // Dark rim
  outline();
  ctx.strokeStyle = rgba(look.dark, 0.9);
  ctx.lineWidth = 1.5;
  ctx.stroke();
  return c;
}

// Fixed sun direction (upper-left): shading drawn over each rock after rotation.
export function drawAsteroidShading(ctx, x, y, radius) {
  const g = ctx.createRadialGradient(x - radius * 0.45, y - radius * 0.45, radius * 0.1, x, y, radius * 1.05);
  g.addColorStop(0, "rgba(255, 240, 220, 0.18)");
  g.addColorStop(0.45, "rgba(0, 0, 0, 0)");
  g.addColorStop(1, "rgba(0, 0, 0, 0.62)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, radius * 0.92, 0, Math.PI * 2);
  ctx.fill();
}

// ---------------------------------------------------------------- ships
const SHIP = [
  "........MMMM........",
  "......MMooooMM......",
  "....OOoooooooOOO....",
  "..OOooYoYoYooooOO...",
  "EMMoooooooooooGGGO..",
  "EMooodddddoooogGGGO.",
  "EMooodddddooooggGGOO",
  "EMooodddddoooogGGGO.",
  "EMMoooooooooooGGGO..",
  "..OOooYoYoYooooOO...",
  "....OOoooooooOOO....",
  "......MMooooMM......",
  "........MMMM........"
];
const SHIP_PAL = { O: "#ff7700", o: "#5a3a1c", d: "#2b190c", G: "#7df9ff", g: "#2a8fa0", Y: "#ffd24a", M: "#8a97b1", E: "#ff3b1f" };

const DRONE = [
  "..KK......KK..",
  ".KRRK....KRRK.",
  "KRRRRKKKKRRRRK",
  "KRRKKKRRKKKRRK",
  ".KKKRRWWRRKKK.",
  "..KRRWrrWRRK..",
  "..KRRWrrWRRK..",
  ".KKKRRWWRRKKK.",
  "KRRKKKRRKKKRRK",
  "KRRRRKKKKRRRRK",
  ".KRRK....KRRK.",
  "..KK......KK.."
];
const DRONE_PAL = { K: "#1a0508", R: "#6a1020", W: "#ff2233", r: "#ffe0e0" };

const CHUNK = ["..X..", ".XHX.", "XHXXX", ".XXd.", "..d.."];

export function buildShips() {
  return {
    ship: sprite(SHIP, SHIP_PAL, 2),
    drone: sprite(DRONE, DRONE_PAL, 2),
    chunks: new Map()
  };
}

export function chunkSprite(ships, color) {
  let s = ships.chunks.get(color);
  if (!s) {
    s = sprite(CHUNK, { X: color, H: shade(color, 0.6), d: shade(color, -0.4) }, 2);
    ships.chunks.set(color, s);
  }
  return s;
}

// ---------------------------------------------------------------- station
export function drawStationArt(ctx, x, y, t, dockRadius, radius) {
  ctx.save();
  ctx.translate(x, y);

  // Docking field
  const pulse = 0.5 + Math.sin(t * 2) * 0.2;
  const g = ctx.createRadialGradient(0, 0, dockRadius * 0.4, 0, 0, dockRadius);
  g.addColorStop(0, "rgba(255, 119, 0, 0)");
  g.addColorStop(1, `rgba(255, 119, 0, ${0.12 * pulse})`);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, dockRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.setLineDash([8, 8]);
  ctx.lineDashOffset = -t * 20;
  ctx.strokeStyle = `rgba(255, 170, 60, ${0.35 + pulse * 0.2})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  // Solar arrays on 4 slowly turning arms
  ctx.save();
  ctx.rotate(t * 0.08);
  for (let i = 0; i < 4; i++) {
    ctx.save();
    ctx.rotate((i * Math.PI) / 2);
    ctx.fillStyle = "#5b6472";
    ctx.fillRect(40, -3, 58, 6);
    for (let p = 0; p < 3; p++) {
      const px = 54 + p * 16;
      ctx.fillStyle = "#1a2d5a";
      ctx.fillRect(px, -20, 13, 17);
      ctx.fillRect(px, 3, 13, 17);
      ctx.fillStyle = "rgba(120, 170, 255, 0.35)";
      for (let k = 0; k < 4; k++) {
        ctx.fillRect(px, -20 + k * 4.5, 13, 1);
        ctx.fillRect(px, 3 + k * 4.5, 13, 1);
      }
      ctx.fillStyle = "rgba(255,255,255,0.18)";
      ctx.fillRect(px, -20, 2, 17);
    }
    // Arm tip beacon
    ctx.fillStyle = Math.sin(t * 5 + i) > 0.3 ? "#00ff66" : "#0a3a1a";
    ctx.fillRect(98, -3, 5, 6);
    ctx.restore();
  }
  ctx.restore();

  // Habitat ring with modules (counter-rotating)
  ctx.save();
  ctx.rotate(-t * 0.25);
  ctx.strokeStyle = "#3a404a";
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.arc(0, 0, 44, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = "#5c6370";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, 48, Math.PI, Math.PI * 1.9);
  ctx.stroke();
  for (let i = 0; i < 8; i++) {
    ctx.save();
    ctx.rotate((i / 8) * Math.PI * 2);
    ctx.fillStyle = "#4a515c";
    ctx.fillRect(38, -7, 13, 14);
    ctx.fillStyle = "#6b7380";
    ctx.fillRect(38, -7, 13, 2);
    ctx.fillStyle = (i + Math.floor(t * 2)) % 3 === 0 ? "#ffe08a" : "#ffb347";
    ctx.fillRect(42, -3, 2, 2);
    ctx.fillRect(46, -3, 2, 2);
    ctx.fillRect(42, 1, 2, 2);
    ctx.restore();
  }
  ctx.restore();

  // Central hub
  ctx.fillStyle = "#2a2e36";
  ctx.beginPath();
  ctx.arc(0, 0, 26, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#ff7700";
  ctx.lineWidth = 2;
  ctx.stroke();
  const hub = ctx.createRadialGradient(-8, -8, 2, 0, 0, 26);
  hub.addColorStop(0, "rgba(255,255,255,0.25)");
  hub.addColorStop(1, "rgba(0,0,0,0.4)");
  ctx.fillStyle = hub;
  ctx.beginPath();
  ctx.arc(0, 0, 26, 0, Math.PI * 2);
  ctx.fill();
  // Docking port glow
  ctx.fillStyle = `rgba(255, 170, 60, ${0.6 + pulse * 0.4})`;
  ctx.beginPath();
  ctx.arc(0, 0, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fff3d6";
  ctx.beginPath();
  ctx.arc(0, 0, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Label
  ctx.fillStyle = "#ffd700";
  ctx.font = '8px "Press Start 2P", monospace';
  ctx.textAlign = "center";
  ctx.fillText("ORE DEPOT", x, y - radius - 10);
  ctx.textAlign = "left";
}
