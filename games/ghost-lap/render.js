// Ghost Lap world renderer: the circuit and its surroundings are generated once per track and
// painted into 512px tiles on demand (LRU cached), so huge real-scale maps stay cheap per frame.
import { makeCanvas, mulberry32, noiseTile, patternOf, glow, shade, rgba } from "/shared/gfx.js";

const TILE = 512;
const MAX_TILES = 72;
const TAU = Math.PI * 2;

// ─────────────────────────── Textures ───────────────────────────
const TEX = {
  grass: noiseTile(128, {
    base: "#1d4a24",
    seed: 12,
    blotches: [{ color: "#24592b", alpha: 0.5, count: 10, min: 12, max: 34 }, { color: "#153a1b", alpha: 0.5, count: 8, min: 10, max: 30 }],
    speckles: [{ color: "#2f6a33", density: 0.05 }, { color: "#0f2c14", density: 0.03 }]
  }),
  sand: noiseTile(128, {
    base: "#b08d5c",
    seed: 21,
    blotches: [{ color: "#c19e6b", alpha: 0.5, count: 10, min: 14, max: 40 }, { color: "#957449", alpha: 0.4, count: 8, min: 10, max: 30 }],
    speckles: [{ color: "#d2b07c", density: 0.05 }, { color: "#76593a", density: 0.04 }]
  }),
  city: noiseTile(96, {
    base: "#23262d",
    seed: 5,
    blotches: [{ color: "#2b2f37", alpha: 0.5, count: 6, min: 8, max: 24 }],
    speckles: [{ color: "#353a44", density: 0.05 }, { color: "#15171b", density: 0.05 }]
  }),
  asphalt: noiseTile(96, {
    base: "#2a2d33",
    seed: 7,
    blotches: [{ color: "#31353c", alpha: 0.5, count: 6, min: 8, max: 22 }, { color: "#212328", alpha: 0.5, count: 6, min: 8, max: 20 }],
    speckles: [{ color: "#3b3f47", density: 0.06 }, { color: "#17191c", density: 0.05 }, { color: "#4b505a", density: 0.004 }]
  }),
  runoff: noiseTile(64, {
    base: "#3a4a55",
    seed: 9,
    speckles: [{ color: "#46596a", density: 0.06 }, { color: "#2c3942", density: 0.05 }]
  }),
  gravel: noiseTile(64, {
    base: "#8d7650",
    seed: 3,
    speckles: [{ color: "#a88f64", density: 0.2 }, { color: "#6a573a", density: 0.2 }, { color: "#c2a97c", density: 0.03 }]
  })
};

const TEAM = ["#e10600", "#00d2be", "#1e41ff", "#ff8700", "#006f62", "#2b4562", "#b6babd", "#0090ff", "#900000", "#52e252"];
const SPONSORS = [
  ["TIMESINK", "#0a0a0a", "#00f0ff"],
  ["NEON OIL", "#d4001c", "#ffffff"],
  ["HYPERION", "#101a3a", "#ffd400"],
  ["VECTOR", "#ffffff", "#e10600"],
  ["APEX TYRES", "#ffd400", "#111111"],
  ["KAIJU ENERGY", "#18a34a", "#ffffff"],
  ["ORBITAL", "#5a1d8f", "#ffffff"],
  ["PIXELCOM", "#ff6a00", "#111111"]
];
const CROWD = ["#e8e2d0", "#e10600", "#ffd400", "#1e41ff", "#f28c28", "#ffffff", "#2ecc71", "#ff5ea8", "#00d2be", "#9b59b6"];

// ─────────────────────────── Geometry helpers ───────────────────────────
function offsetPts(track, i0, len, d) {
  const out = [];
  for (let k = 0; k <= len; k++) {
    const i = (i0 + k) % track.n;
    out.push([track.path[i][0] + track.nor[i][0] * d, track.path[i][1] + track.nor[i][1] * d]);
  }
  return out;
}

/**
 * Split an offset line into the pieces that really are that far from the track. Where it isn't
 * (the inside of a corner tighter than the offset, or where another part of the circuit runs
 * close by) the line would cut across the tarmac, so it's dropped there.
 */
function clipToField(pts, field, minD) {
  const parts = [];
  let cur = [];
  for (const p of pts) {
    if (field.at(p[0], p[1]) >= minD - 30) cur.push(p);
    else if (cur.length) {
      parts.push(cur);
      cur = [];
    }
  }
  if (cur.length) parts.push(cur);
  return parts.filter((part) => part.length > 1);
}

function polyline(g, pts) {
  g.beginPath();
  g.moveTo(pts[0][0], pts[0][1]);
  for (let k = 1; k < pts.length; k++) g.lineTo(pts[k][0], pts[k][1]);
}

function bboxOf(pts, pad) {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const [x, y] of pts) {
    if (x < x0) x0 = x;
    if (y < y0) y0 = y;
    if (x > x1) x1 = x;
    if (y > y1) y1 = y;
  }
  return [x0 - pad, y0 - pad, x1 + pad, y1 + pad];
}

// Index runs where mask is set, grown by `grow` points each side
function runsOf(mask, grow) {
  const n = mask.length;
  const on = new Uint8Array(n);
  for (let i = 0; i < n; i++) if (mask[i]) for (let k = -grow; k <= grow; k++) on[(i + k + n) % n] = 1;
  if (on.every((v) => v)) return [{ i0: 0, len: n }];
  const s = on.indexOf(0);
  const runs = [];
  let cur = null;
  for (let k = 1; k <= n; k++) {
    const i = (s + k) % n;
    if (on[i]) {
      if (!cur) cur = { i0: i, len: 0 };
      else cur.len++;
    } else if (cur) {
      runs.push(cur);
      cur = null;
    }
  }
  if (cur) runs.push(cur);
  return runs;
}

// ─────────────────────────── Distance field ───────────────────────────
const CELL = 24;
function buildDistField(track) {
  const cols = Math.ceil(track.W / CELL);
  const rows = Math.ceil(track.H / CELL);
  const f = new Float32Array(cols * rows).fill(1e6);
  const R = 34; // cells (~800px)
  for (let i = 0; i < track.n; i += 2) {
    const [px, py] = track.path[i];
    const cx = Math.floor(px / CELL);
    const cy = Math.floor(py / CELL);
    for (let y = Math.max(0, cy - R); y <= Math.min(rows - 1, cy + R); y++) {
      for (let x = Math.max(0, cx - R); x <= Math.min(cols - 1, cx + R); x++) {
        const d = Math.hypot((x + 0.5) * CELL - px, (y + 0.5) * CELL - py);
        const k = y * cols + x;
        if (d < f[k]) f[k] = d;
      }
    }
  }
  return {
    at(x, y) {
      const cx = Math.floor(x / CELL);
      const cy = Math.floor(y / CELL);
      if (cx < 0 || cy < 0 || cx >= cols || cy >= rows) return -1;
      return f[cy * cols + cx];
    }
  };
}

// ─────────────────────────── Scenery generation ───────────────────────────
function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

function generateScenery(track, field) {
  const rand = mulberry32(hashStr(track.key || track.name));
  const { n, width: w } = track;
  const street = track.theme === "street";
  const items = [];
  const push = (kind, bbox, data) => items.push({ kind, bbox, seed: Math.floor(rand() * 1e9), ...data });
  const fenceD = street ? w / 2 + 36 : w / 2 + 200;
  const inWorld = (x, y, m = 20) => x > m && y > m && x < track.W - m && y < track.H - m;
  const clearOf = (pts, minD) => pts.every(([x, y]) => inWorld(x, y) && field.at(x, y) >= minD - 4);
  const claimed = new Uint8Array(n * 2); // per side: stand / pits already here

  const claim = (i0, len, side) => {
    for (let k = -6; k <= len + 6; k++) claimed[((i0 + k + n) % n) * 2 + (side > 0 ? 1 : 0)] = 1;
  };
  const isClaimed = (i0, len, side) => {
    for (let k = -6; k <= len + 6; k++) if (claimed[((i0 + k + n) % n) * 2 + (side > 0 ? 1 : 0)]) return true;
    return false;
  };

  // Pit complex along the start/finish straight, on whichever side has room
  const pitFrom = n - 70;
  const pitLen = 100;
  let pitSide = 0;
  for (const side of [1, -1]) {
    const probe = offsetPts(track, pitFrom, pitLen, side * (w / 2 + 250));
    if (clearOf(probe, w / 2 + 240)) {
      pitSide = side;
      break;
    }
  }
  if (pitSide) {
    claim(pitFrom, pitLen, pitSide);
    const lane = offsetPts(track, pitFrom, pitLen, pitSide * (w / 2 + 64));
    const all = offsetPts(track, pitFrom, pitLen, pitSide * (w / 2 + 280));
    push("pits", bboxOf(lane.concat(all), 60), { i0: pitFrom, len: pitLen, side: pitSide });
  }

  // Grandstands: always opposite the pits, then at corners and straights with room behind the fence
  const standD = fenceD + 26;
  const tryStand = (i0, len, side, main) => {
    if (isClaimed(i0, len, side)) return false;
    const depth = main ? 110 : 60 + Math.floor(rand() * 40);
    const inner = offsetPts(track, i0, len, side * standD);
    const outer = offsetPts(track, i0, len, side * (standD + depth));
    if (!clearOf(inner, standD) || !clearOf(outer, standD + depth)) return false;
    claim(i0, len, side);
    const flags = [];
    for (let f = 0; f < len / 4; f++) flags.push({ k: Math.floor(rand() * len), row: rand(), c: CROWD[Math.floor(rand() * CROWD.length)] });
    push("stand", bboxOf(inner.concat(outer), 30), { i0, len, side, depth, main, flags, roof: main || rand() < 0.5 });
    return true;
  };
  if (pitSide) tryStand(pitFrom + 10, 80, -pitSide, true);
  else tryStand(n - 60, 80, 1, true);
  // Candidate spots ranked by how much action they see (corners first)
  const cands = [];
  for (let i = 0; i < n; i += 12) cands.push({ i, score: Math.abs(track.curv[i]) * 1e4 + rand() * 2 });
  cands.sort((a, b) => b.score - a.score);
  let stands = 0;
  for (const c of cands) {
    if (stands >= 12) break;
    const len = 30 + Math.floor(rand() * 30);
    const i0 = (c.i - Math.floor(len / 2) + n) % n;
    // Outside of the corner sees the cars come toward it
    const outside = track.curv[c.i] > 0 ? -1 : 1;
    if (tryStand(i0, len, outside, false) || tryStand(i0, len, -outside, false)) stands++;
  }

  // Corners: gravel/tyre walls, marshal posts
  const cornerRuns = runsOf(track.radii.map((r) => r < 260), 4);
  let post = 0;
  for (const run of cornerRuns) {
    const mid = (run.i0 + Math.floor(run.len / 2)) % n;
    const outside = track.curv[mid] > 0 ? -1 : 1;
    if (!street) {
      for (const tyres of clipToField(offsetPts(track, run.i0, run.len, outside * (fenceD - 8)), field, fenceD - 8)) {
        push("tyres", bboxOf(tyres, 20), { pts: tyres });
      }
    }
    const pp = offsetPts(track, mid, 0, -outside * (street ? w / 2 + 50 : w / 2 + 150))[0];
    if (inWorld(pp[0], pp[1]) && field.at(pp[0], pp[1]) > (street ? w / 2 + 40 : w / 2 + 140)) {
      post++;
      push("marshal", [pp[0] - 30, pp[1] - 30, pp[0] + 30, pp[1] + 30], { x: pp[0], y: pp[1], num: post });
    }
  }

  // Sponsor boards along the straights, just inside the fence
  for (let i = 0; i < n; i += 26) {
    if (track.radii[i] < 900 || rand() < 0.35) continue;
    const side = rand() < 0.5 ? -1 : 1;
    if (isClaimed(i, 10, side)) continue;
    const pts = offsetPts(track, i, 10, side * (fenceD - 14));
    if (!clearOf(pts, fenceD - 18)) continue;
    push("board", bboxOf(pts, 20), { pts, sponsor: SPONSORS[Math.floor(rand() * SPONSORS.length)] });
  }

  // Floodlight pylons for the night races
  if (track.night) {
    for (let i = 0; i < n; i += 30) {
      const side = (i / 30) % 2 ? 1 : -1;
      const p = offsetPts(track, i, 0, side * (fenceD + 14))[0];
      if (!inWorld(p[0], p[1]) || field.at(p[0], p[1]) < fenceD) continue;
      push("pylon", [p[0] - 20, p[1] - 20, p[0] + 20, p[1] + 20], { x: p[0], y: p[1] });
    }
  }

  // Theme dressing on everything left over
  const area = track.W * track.H;
  if (track.theme === "park") {
    const clusters = Math.floor(area / 90000);
    for (let c = 0; c < clusters; c++) {
      const cx = rand() * track.W;
      const cy = rand() * track.H;
      if (field.at(cx, cy) < fenceD + 60) continue;
      const trees = [];
      const count = 4 + Math.floor(rand() * 12);
      for (let t = 0; t < count; t++) {
        const x = cx + (rand() - 0.5) * 160;
        const y = cy + (rand() - 0.5) * 120;
        const r = 9 + rand() * 13;
        if (field.at(x, y) < fenceD + 40 + r) continue;
        trees.push([x, y, r]);
      }
      if (trees.length) push("trees", bboxOf(trees, 40), { trees });
    }
    // Spectator banks with tents and umbrellas behind the fences
    for (let i = 0; i < n; i += 40) {
      if (rand() < 0.45) continue;
      const side = rand() < 0.5 ? -1 : 1;
      if (isClaimed(i, 14, side)) continue;
      const pts = offsetPts(track, i, 14, side * (fenceD + 30));
      if (!clearOf(pts, fenceD + 20)) continue;
      push("bank", bboxOf(pts, 50), { i0: i, side, pts });
    }
    // Car parks
    for (let c = 0; c < area / 2.5e6; c++) {
      const x = rand() * track.W;
      const y = rand() * track.H;
      if (field.at(x, y) < fenceD + 380) continue;
      push("carpark", [x - 170, y - 110, x + 170, y + 110], { x, y });
    }
  } else if (track.theme === "desert") {
    for (let c = 0; c < area / 30000; c++) {
      const x = rand() * track.W;
      const y = rand() * track.H;
      if (field.at(x, y) < fenceD + 40) continue;
      push("palm", [x - 30, y - 30, x + 30, y + 30], { x, y });
    }
    for (let c = 0; c < area / 60000; c++) {
      const x = rand() * track.W;
      const y = rand() * track.H;
      if (field.at(x, y) < fenceD + 60) continue;
      push("dune", [x - 120, y - 30, x + 120, y + 30], { x, y, len: 60 + rand() * 120 });
    }
  } else {
    // Street grid: blocks of buildings wherever the circuit leaves room
    const bw = 150;
    const bh = 130;
    for (let bx = 0; bx < track.W; bx += bw) {
      for (let by = 0; by < track.H; by += bh) {
        const parts = [];
        const count = 1 + Math.floor(rand() * 3);
        for (let p = 0; p < count; p++) {
          const pw = (bw - 34) / count - 4;
          const x = bx + 17 + p * (pw + 4);
          const y = by + 17;
          const h = bh - 34 - Math.floor(rand() * 16);
          const corners = [[x, y], [x + pw, y], [x, y + h], [x + pw, y + h], [x + pw / 2, y + h / 2]];
          if (corners.every(([cx, cy]) => field.at(cx, cy) > w / 2 + 64)) parts.push([x, y, pw, h, Math.floor(rand() * 1e9)]);
        }
        if (parts.length) push("block", [bx, by, bx + bw, by + bh], { parts });
      }
    }
    for (let c = 0; c < area / 70000; c++) {
      const x = rand() * track.W;
      const y = rand() * track.H;
      const f = field.at(x, y);
      if (f < w / 2 + 50 || f > w / 2 + 90) continue;
      push("palm", [x - 30, y - 30, x + 30, y + 30], { x, y });
    }
  }
  return { items, pitSide, pitFrom, pitLen, fenceD, cornerRuns };
}

// ─────────────────────────── Item painters ───────────────────────────
function paintTrees(g, it) {
  const greens = ["#1a4a22", "#22582a", "#2a6632", "#184022", "#30703a"];
  const rand = mulberry32(it.seed);
  for (const [x, y, r] of it.trees) {
    g.fillStyle = "rgba(0, 0, 0, 0.32)";
    g.beginPath();
    g.ellipse(x + r * 0.45, y + r * 0.55, r, r * 0.85, 0, 0, TAU);
    g.fill();
    const base = greens[Math.floor(rand() * greens.length)];
    g.fillStyle = shade(base, -0.25);
    g.beginPath();
    g.arc(x, y, r, 0, TAU);
    g.fill();
    g.fillStyle = base;
    for (let k = 0; k < 5; k++) {
      const a = rand() * TAU;
      g.beginPath();
      g.arc(x + Math.cos(a) * r * 0.35, y + Math.sin(a) * r * 0.35, r * 0.62, 0, TAU);
      g.fill();
    }
    g.fillStyle = "rgba(170, 220, 130, 0.22)";
    g.beginPath();
    g.arc(x - r * 0.3, y - r * 0.35, r * 0.45, 0, TAU);
    g.fill();
  }
}

function paintPalm(g, x, y, seed) {
  const rand = mulberry32(seed);
  g.fillStyle = "rgba(0, 0, 0, 0.3)";
  g.beginPath();
  g.ellipse(x + 8, y + 9, 14, 9, 0, 0, TAU);
  g.fill();
  const rot = rand() * TAU;
  g.lineCap = "round";
  for (let f = 0; f < 7; f++) {
    const a = rot + (f / 7) * TAU;
    g.strokeStyle = f % 2 ? "#2f7a30" : "#3c8c3a";
    g.lineWidth = 4;
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo(x + Math.cos(a) * 10, y + Math.sin(a) * 10 - 3, x + Math.cos(a) * 17, y + Math.sin(a) * 17);
    g.stroke();
  }
  g.fillStyle = "#7a5526";
  g.fillRect(x - 2, y - 2, 4, 4);
}

function paintStand(g, track, it, night) {
  const rand = mulberry32(it.seed);
  const s = it.side;
  const d0 = track.width / 2 + (track.theme === "street" ? 36 : 200) + 26;
  const inner = offsetPts(track, it.i0, it.len, s * d0);
  const outer = offsetPts(track, it.i0, it.len, s * (d0 + it.depth));
  const poly = inner.concat(outer.slice().reverse());
  // Shadow, then the concrete shell
  g.save();
  g.translate(10, 12);
  g.fillStyle = "rgba(0, 0, 0, 0.4)";
  polyline(g, poly);
  g.closePath();
  g.fill();
  g.restore();
  g.fillStyle = "#565d69";
  polyline(g, poly);
  g.closePath();
  g.fill();
  // Tiered rows packed with spectators
  const rows = Math.floor((it.depth - 14) / 7);
  for (let r = 0; r < rows; r++) {
    const d = s * (d0 + 8 + r * 7);
    const row = offsetPts(track, it.i0, it.len, d);
    g.strokeStyle = r % 2 ? "#3e444f" : "#474e5a";
    g.lineWidth = 6;
    polyline(g, row);
    g.stroke();
    for (let k = 0; k < row.length - 1; k++) {
      const [ax, ay] = row[k];
      const [bx, by] = row[k + 1];
      for (let p = 0; p < 4; p++) {
        if (rand() < 0.12) continue; // empty seat
        const t = (p + rand() * 0.6) / 4;
        g.fillStyle = CROWD[Math.floor(rand() * CROWD.length)];
        g.fillRect(ax + (bx - ax) * t - 1.5, ay + (by - ay) * t - 1.5, 3, 3);
        g.fillStyle = "rgba(240, 200, 160, 0.6)";
        g.fillRect(ax + (bx - ax) * t - 0.5, ay + (by - ay) * t - 2.5, 1.5, 1.5);
      }
    }
  }
  // Aisles
  g.strokeStyle = "#8a919d";
  g.lineWidth = 3;
  for (let k = 6; k < it.len; k += 12) {
    const a = inner[k];
    const b = outer[k];
    g.beginPath();
    g.moveTo(a[0], a[1]);
    g.lineTo(b[0], b[1]);
    g.stroke();
  }
  // Roof over the back half, with steel ribs
  if (it.roof) {
    const rIn = offsetPts(track, it.i0, it.len, s * (d0 + it.depth * 0.45));
    const roof = rIn.concat(outer.slice().reverse());
    g.fillStyle = it.main ? "#d9dde3" : "#a8aeb8";
    polyline(g, roof);
    g.closePath();
    g.fill();
    g.strokeStyle = "rgba(0, 0, 0, 0.18)";
    g.lineWidth = 2;
    for (let k = 0; k < it.len; k += 4) {
      g.beginPath();
      g.moveTo(rIn[k][0], rIn[k][1]);
      g.lineTo(outer[k][0], outer[k][1]);
      g.stroke();
    }
    g.fillStyle = "rgba(0, 0, 0, 0.35)";
    g.strokeStyle = "rgba(0, 0, 0, 0.35)";
    g.lineWidth = 4;
    polyline(g, rIn);
    g.stroke();
    if (it.main) {
      // Big screen on the roof edge
      const m = rIn[Math.floor(it.len / 2)];
      g.fillStyle = "#101318";
      g.fillRect(m[0] - 34, m[1] - 12, 68, 24);
      g.fillStyle = night ? "#3fa9ff" : "#2a73c9";
      g.fillRect(m[0] - 31, m[1] - 9, 62, 18);
    }
  }
  g.strokeStyle = "#2b2f36";
  g.lineWidth = 2;
  polyline(g, poly);
  g.closePath();
  g.stroke();
}

function paintPits(g, track, it) {
  const s = it.side;
  const w = track.width;
  const lane = offsetPts(track, it.i0, it.len, s * (w / 2 + 64));
  // Entry / exit connectors to the circuit
  const entryT = offsetPts(track, it.i0 - 12, 0, s * (w / 2 - 4))[0];
  const exitT = offsetPts(track, it.i0 + it.len + 12, 0, s * (w / 2 - 4))[0];
  const full = [entryT, ...lane, exitT];
  g.lineJoin = "round";
  g.lineCap = "round";
  g.strokeStyle = "#e9e9e9";
  g.lineWidth = 40;
  polyline(g, full);
  g.stroke();
  g.strokeStyle = patternOf(g, TEX.asphalt);
  g.lineWidth = 36;
  polyline(g, full);
  g.stroke();
  // Pit boxes painted on the lane
  for (let k = 8; k < it.len - 6; k += 8) {
    const p = offsetPts(track, it.i0 + k, 0, s * (w / 2 + 74))[0];
    const tn = track.tan[(it.i0 + k) % track.n];
    g.save();
    g.translate(p[0], p[1]);
    g.rotate(Math.atan2(tn[1], tn[0]));
    g.strokeStyle = TEAM[(k / 8) % TEAM.length];
    g.lineWidth = 2;
    g.strokeRect(-24, -7, 48, 14);
    g.restore();
  }
  // Pit wall
  g.lineCap = "butt";
  g.strokeStyle = "#c9ced6";
  g.lineWidth = 6;
  polyline(g, offsetPts(track, it.i0, it.len, s * (w / 2 + 36)));
  g.stroke();
  g.strokeStyle = "rgba(0,0,0,0.35)";
  g.lineWidth = 2;
  polyline(g, offsetPts(track, it.i0, it.len, s * (w / 2 + 40)));
  g.stroke();
  // Garages (team colours, open doors) and the pit building roof
  for (let k = 4; k < it.len - 4; k += 8) {
    const i = (it.i0 + k) % track.n;
    const p = offsetPts(track, i, 0, s * (w / 2 + 122))[0];
    const tn = track.tan[i];
    g.save();
    g.translate(p[0], p[1]);
    g.rotate(Math.atan2(tn[1], tn[0]));
    g.fillStyle = "rgba(0,0,0,0.4)";
    g.fillRect(-36, -26, 76, 56);
    g.fillStyle = "#4a515c";
    g.fillRect(-38, -28, 76, 56);
    const team = TEAM[(k / 8) % TEAM.length];
    g.fillStyle = "#15181d";
    g.fillRect(-30, s > 0 ? -28 : 20, 60, 8);
    g.fillStyle = team;
    g.fillRect(-38, s > 0 ? -20 : 14, 76, 4);
    g.fillStyle = "rgba(255,255,255,0.12)";
    g.fillRect(-38, -28, 76, 3);
    // Tyre sets stacked by the door
    g.fillStyle = "#111";
    for (let t = 0; t < 4; t++) {
      g.beginPath();
      g.arc(-26 + t * 7, s > 0 ? -10 : 8, 3, 0, TAU);
      g.fill();
    }
    g.restore();
  }
  const roofIn = offsetPts(track, it.i0 + 2, it.len - 4, s * (w / 2 + 156));
  const roofOut = offsetPts(track, it.i0 + 2, it.len - 4, s * (w / 2 + 210));
  const roof = roofIn.concat(roofOut.slice().reverse());
  g.save();
  g.translate(10, 12);
  g.fillStyle = "rgba(0,0,0,0.4)";
  polyline(g, roof);
  g.closePath();
  g.fill();
  g.restore();
  g.fillStyle = "#cfd4db";
  polyline(g, roof);
  g.closePath();
  g.fill();
  g.strokeStyle = "rgba(0,0,0,0.15)";
  g.lineWidth = 2;
  for (let k = 0; k < roofIn.length; k += 3) {
    g.beginPath();
    g.moveTo(roofIn[k][0], roofIn[k][1]);
    g.lineTo(roofOut[k][0], roofOut[k][1]);
    g.stroke();
  }
  // Paddock motorhomes and trucks
  const rand = mulberry32(it.seed);
  for (let k = 6; k < it.len - 6; k += 7) {
    const i = (it.i0 + k) % track.n;
    const p = offsetPts(track, i, 0, s * (w / 2 + 250))[0];
    const tn = track.tan[i];
    g.save();
    g.translate(p[0], p[1]);
    g.rotate(Math.atan2(tn[1], tn[0]) + (rand() - 0.5) * 0.1);
    g.fillStyle = "rgba(0,0,0,0.35)";
    g.fillRect(-20, -9, 44, 22);
    g.fillStyle = "#e6e8ec";
    g.fillRect(-22, -11, 44, 22);
    g.fillStyle = TEAM[Math.floor(rand() * TEAM.length)];
    g.fillRect(-22, -11, 44, 5);
    g.restore();
  }
}

function paintTyres(g, it) {
  const pts = it.pts;
  for (let k = 0; k < pts.length; k++) {
    const [x, y] = pts[k];
    g.fillStyle = "rgba(0,0,0,0.35)";
    g.beginPath();
    g.arc(x + 2, y + 3, 7, 0, TAU);
    g.fill();
    g.fillStyle = "#16171a";
    g.beginPath();
    g.arc(x, y, 6.5, 0, TAU);
    g.fill();
    g.fillStyle = k % 4 < 2 ? "#d42a2a" : "#e8e8e8";
    g.beginPath();
    g.arc(x, y, 3.5, 0, TAU);
    g.fill();
    g.fillStyle = "#0b0b0d";
    g.beginPath();
    g.arc(x, y, 1.8, 0, TAU);
    g.fill();
  }
}

function paintBoard(g, it) {
  const [text, bg, fg] = it.sponsor;
  const a = it.pts[0];
  const b = it.pts[it.pts.length - 1];
  const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  g.save();
  g.translate(a[0], a[1]);
  g.rotate(ang);
  g.fillStyle = "rgba(0,0,0,0.35)";
  g.fillRect(3, 2, len, 12);
  g.fillStyle = bg;
  g.fillRect(0, -2, len, 12);
  g.fillStyle = fg;
  g.font = "bold 9px monospace";
  g.textBaseline = "middle";
  for (let x = 6; x < len - 50; x += 90) g.fillText(text, x, 4);
  g.restore();
}

function paintMarshal(g, it) {
  const { x, y } = it;
  g.fillStyle = "rgba(0,0,0,0.35)";
  g.fillRect(x - 8, y - 6, 20, 16);
  g.fillStyle = "#f28c28";
  g.fillRect(x - 10, y - 8, 20, 16);
  g.fillStyle = "#ffffff";
  g.fillRect(x - 10, y - 8, 20, 3);
  g.fillStyle = "#111";
  g.font = "bold 8px monospace";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(String(it.num), x, y + 2);
  g.textAlign = "left";
  // Marshals in orange overalls
  g.fillStyle = "#ff8a00";
  g.fillRect(x + 12, y - 3, 3, 3);
  g.fillRect(x + 12, y + 3, 3, 3);
}

function paintBank(g, it) {
  const rand = mulberry32(it.seed);
  for (let k = 0; k < it.pts.length; k++) {
    const [x, y] = it.pts[k];
    for (let p = 0; p < 10; p++) {
      g.fillStyle = CROWD[Math.floor(rand() * CROWD.length)];
      g.fillRect(x + (rand() - 0.5) * 34, y + (rand() - 0.5) * 30, 3, 3);
    }
    if (rand() < 0.25) {
      // Umbrella / tent
      const ux = x + (rand() - 0.5) * 30;
      const uy = y + (rand() - 0.5) * 26;
      g.fillStyle = CROWD[Math.floor(rand() * CROWD.length)];
      g.beginPath();
      g.arc(ux, uy, 6, 0, TAU);
      g.fill();
      g.strokeStyle = "rgba(255,255,255,0.4)";
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(ux - 6, uy);
      g.lineTo(ux + 6, uy);
      g.moveTo(ux, uy - 6);
      g.lineTo(ux, uy + 6);
      g.stroke();
    }
  }
}

function paintCarpark(g, it) {
  const rand = mulberry32(it.seed);
  g.fillStyle = "#34383f";
  g.fillRect(it.x - 160, it.y - 100, 320, 200);
  g.strokeStyle = "rgba(255,255,255,0.35)";
  g.lineWidth = 1;
  for (let r = 0; r < 6; r++) {
    for (let c = 0; c < 22; c++) {
      const x = it.x - 150 + c * 14;
      const y = it.y - 90 + r * 32;
      g.strokeRect(x, y, 12, 22);
      if (rand() < 0.72) {
        g.fillStyle = CROWD[Math.floor(rand() * CROWD.length)];
        g.fillRect(x + 2, y + 3, 8, 16);
        g.fillStyle = "rgba(150, 200, 255, 0.5)";
        g.fillRect(x + 3, y + 6, 6, 3);
      }
    }
  }
}

function paintBlock(g, it, night) {
  const roofs = ["#3a3f4a", "#444a57", "#4d5363", "#343943", "#4a4239", "#3d4a4e"];
  for (const [x, y, w, h, seed] of it.parts) {
    const rand = mulberry32(seed);
    const tall = 4 + rand() * 18;
    g.fillStyle = "rgba(0,0,0,0.45)";
    g.fillRect(x + tall * 0.6, y + tall * 0.7, w, h);
    const roof = roofs[Math.floor(rand() * roofs.length)];
    g.fillStyle = roof;
    g.fillRect(x, y, w, h);
    g.fillStyle = "rgba(255,255,255,0.1)";
    g.fillRect(x, y, w, 3);
    g.fillRect(x, y, 3, h);
    g.fillStyle = "rgba(0,0,0,0.28)";
    g.fillRect(x, y + h - 3, w, 3);
    g.fillRect(x + w - 3, y, 3, h);
    const r = rand();
    if (r < 0.2 && w > 34) {
      g.fillStyle = "#2a9dc4";
      g.fillRect(x + 8, y + 8, Math.min(28, w - 16), 14);
      g.fillStyle = "rgba(255,255,255,0.3)";
      g.fillRect(x + 8, y + 8, Math.min(28, w - 16), 2);
    } else if (r < 0.32 && w > 36 && h > 36) {
      g.strokeStyle = "rgba(240,240,240,0.55)";
      g.lineWidth = 2;
      g.beginPath();
      g.arc(x + w / 2, y + h / 2, 13, 0, TAU);
      g.stroke();
      g.fillStyle = "rgba(240,240,240,0.55)";
      g.font = "bold 12px monospace";
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText("H", x + w / 2, y + h / 2 + 1);
      g.textAlign = "left";
    } else {
      g.fillStyle = "rgba(210, 215, 225, 0.25)";
      for (let u = 0; u < 4; u++) g.fillRect(x + 6 + rand() * (w - 16), y + 6 + rand() * (h - 16), 7, 5);
    }
    if (night) {
      for (let k = 0; k < (w * h) / 90; k++) {
        g.fillStyle = rand() < 0.7 ? "rgba(255, 214, 120, 0.6)" : "rgba(140, 200, 255, 0.5)";
        g.fillRect(x + 3 + Math.floor(rand() * (w - 7)), y + 3 + Math.floor(rand() * (h - 7)), 2, 2);
      }
    }
  }
}

function paintDune(g, it) {
  g.strokeStyle = "rgba(235, 205, 150, 0.22)";
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(it.x - it.len / 2, it.y);
  g.quadraticCurveTo(it.x, it.y - 16, it.x + it.len / 2, it.y);
  g.stroke();
  g.strokeStyle = "rgba(90, 60, 30, 0.18)";
  g.beginPath();
  g.moveTo(it.x - it.len / 2, it.y + 4);
  g.quadraticCurveTo(it.x, it.y - 10, it.x + it.len / 2, it.y + 4);
  g.stroke();
}

function paintPylon(g, it) {
  g.fillStyle = "rgba(0,0,0,0.4)";
  g.fillRect(it.x - 4, it.y - 2, 26, 8);
  g.fillStyle = "#6b7280";
  g.fillRect(it.x - 5, it.y - 5, 10, 10);
  g.fillStyle = "#e5e7eb";
  g.fillRect(it.x - 7, it.y - 3, 14, 3);
}

// ─────────────────────────── Track surface painter ───────────────────────────
function strokeRuns(g, track, runs) {
  for (const r of runs) {
    g.beginPath();
    const p0 = track.path[r.i0 % track.n];
    g.moveTo(p0[0], p0[1]);
    for (let k = 1; k <= r.len; k++) {
      const p = track.path[(r.i0 + k) % track.n];
      g.lineTo(p[0], p[1]);
    }
    g.stroke();
  }
}

function strokeOffsetRuns(g, track, runs, d, field) {
  for (const r of runs) {
    const line = offsetPts(track, r.i0, r.len, d);
    for (const pts of field ? clipToField(line, field, Math.abs(d)) : [line]) {
      polyline(g, pts);
      g.stroke();
    }
  }
}

/** The pieces of the dividing walls (between close sections) beside the points of these runs. */
function wallPieces(track, runs) {
  const pieces = [];
  if (!track.divider) return pieces;
  for (const r of runs) {
    let cur = [];
    for (let k = 0; k <= r.len; k++) {
      const d = track.divider[(r.i0 + k) % track.n];
      const last = cur[cur.length - 1];
      if (d && (!last || Math.hypot(d[0] - last[0], d[1] - last[1]) < 40)) cur.push(d);
      else {
        if (cur.length > 3) pieces.push(cur);
        cur = d ? [d] : [];
      }
    }
    if (cur.length > 3) pieces.push(cur);
  }
  return pieces;
}

/** Concrete walls with a red-and-white top where two parts of the circuit run side by side. */
function strokeWalls(g, track, runs) {
  const pieces = wallPieces(track, runs);
  if (!pieces.length) return;
  g.lineCap = "round";
  for (const [style, width, dash] of [
    ["rgba(0,0,0,0.4)", 13, null],
    ["#9aa1ab", 9, null],
    ["#e9ecf0", 5, null],
    ["#d42a2a", 5, [14, 14]]
  ]) {
    g.strokeStyle = style;
    g.lineWidth = width;
    g.setLineDash(dash || []);
    for (const pc of pieces) {
      polyline(g, pc);
      g.stroke();
    }
  }
  g.setLineDash([]);
}

// ─────────────────────────── Renderer ───────────────────────────
/** Camera → canvas: centre on the camera, turn the world by -angle, then zoom. */
export function worldTransform(ctx, cam, W, H) {
  const z = cam.zoom;
  const a = cam.angle || 0;
  const c = Math.cos(a) * z;
  const n = Math.sin(a) * z;
  // translate(W/2,H/2) · rotate(-a) · scale(z) · translate(-x,-y)
  ctx.setTransform(c, -n, n, c, W / 2 - (c * cam.x + n * cam.y), H / 2 - (-n * cam.x + c * cam.y));
}

export function createWorld(track) {
  const field = buildDistField(track);
  const scene = generateScenery(track, field);
  const { n, width: w } = track;
  const street = track.theme === "street";
  const corner = track.radii.map((r) => r < 260);
  const cornerRuns = scene.cornerRuns;
  // Braking zones: where the reference speed drops hard, the tarmac is streaked with rubber
  const brakeMask = [];
  for (let i = 0; i < n; i++) brakeMask.push(track.vmax[i] - track.vmax[(i + 8) % n] > 90);
  const brakeRuns = runsOf(brakeMask, 0);

  const cols = Math.ceil(track.W / TILE);
  const rows = Math.ceil(track.H / TILE);
  // Spatial buckets: items and path indices per tile
  const itemBuckets = new Map();
  for (const it of scene.items) {
    const [x0, y0, x1, y1] = it.bbox;
    for (let ty = Math.max(0, Math.floor(y0 / TILE)); ty <= Math.min(rows - 1, Math.floor(y1 / TILE)); ty++) {
      for (let tx = Math.max(0, Math.floor(x0 / TILE)); tx <= Math.min(cols - 1, Math.floor(x1 / TILE)); tx++) {
        const key = ty * cols + tx;
        if (!itemBuckets.has(key)) itemBuckets.set(key, []);
        itemBuckets.get(key).push(it);
      }
    }
  }
  const REACH = w / 2 + 240;
  function tileRuns(tx, ty) {
    const x0 = tx * TILE - REACH;
    const y0 = ty * TILE - REACH;
    const x1 = (tx + 1) * TILE + REACH;
    const y1 = (ty + 1) * TILE + REACH;
    const mask = track.path.map(([x, y]) => x >= x0 && x <= x1 && y >= y0 && y <= y1);
    if (!mask.some(Boolean)) return [];
    return runsOf(mask, 2);
  }
  const intersectRuns = (a, b) => {
    // Keep only parts of runs `b` that also fall in runs `a` (both index runs)
    if (!a.length || !b.length) return [];
    const set = new Uint8Array(n);
    for (const r of a) for (let k = 0; k <= r.len; k++) set[(r.i0 + k) % n] = 1;
    const mask = new Array(n).fill(false);
    for (const r of b) for (let k = 0; k <= r.len; k++) if (set[(r.i0 + k) % n]) mask[(r.i0 + k) % n] = true;
    return mask.some(Boolean) ? runsOf(mask, 0) : [];
  };

  const tiles = new Map();
  // Grid boxes are painted only for the cars actually racing (the field size is the player's choice)
  let gridCount = Math.min(20, track.grid.length);
  function paintTile(tx, ty) {
    const { c, ctx: g } = makeCanvas(TILE, TILE);
    g.translate(-tx * TILE, -ty * TILE);
    const X0 = tx * TILE;
    const Y0 = ty * TILE;
    // Ground
    g.fillStyle = patternOf(g, street ? TEX.city : track.theme === "desert" ? TEX.sand : TEX.grass);
    g.fillRect(X0, Y0, TILE, TILE);
    if (track.theme === "park") {
      g.fillStyle = "rgba(255,255,255,0.028)";
      for (let x = Math.floor(X0 / 80) * 80; x < X0 + TILE; x += 80) g.fillRect(x, Y0, 40, TILE);
    }
    const items = itemBuckets.get(ty * cols + tx) || [];
    // Ground-level scenery first
    for (const it of items) {
      if (it.kind === "carpark") paintCarpark(g, it);
      else if (it.kind === "dune") paintDune(g, it);
      else if (it.kind === "bank") paintBank(g, it);
      else if (it.kind === "block") paintBlock(g, it, track.night);
    }

    const runs = tileRuns(tx, ty);
    if (runs.length) {
      g.lineJoin = "round";
      g.lineCap = "round";
      const cr = intersectRuns(runs, cornerRuns);
      if (street) {
        // Kerbside pavement, walls with Tecpro blocks at the corners
        g.strokeStyle = "#474b52";
        g.lineWidth = w + 90;
        strokeRuns(g, track, runs);
        g.strokeStyle = "rgba(0,0,0,0.5)";
        g.lineWidth = w + 80;
        strokeRuns(g, track, runs);
        g.strokeStyle = "#c3c7ce";
        g.lineWidth = w + 74;
        strokeRuns(g, track, runs);
        g.lineCap = "butt";
        g.setLineDash([10, 10]);
        g.strokeStyle = "#d42a2a";
        strokeRuns(g, track, cr);
        g.strokeStyle = "#1e4fd6";
        g.lineDashOffset = 10;
        strokeRuns(g, track, cr);
        g.setLineDash([]);
        g.lineDashOffset = 0;
        g.lineCap = "round";
        g.strokeStyle = patternOf(g, TEX.runoff);
        g.lineWidth = w + 62;
        strokeRuns(g, track, runs);
      } else {
        // Gravel traps on corner exits, asphalt run-off everywhere, green verge
        g.strokeStyle = "rgba(0,0,0,0.35)";
        g.lineWidth = w + 250;
        strokeRuns(g, track, cr);
        g.strokeStyle = patternOf(g, TEX.gravel);
        g.lineWidth = w + 244;
        strokeRuns(g, track, cr);
        g.strokeStyle = "#285c2e";
        g.lineWidth = w + 110;
        strokeRuns(g, track, runs);
        g.strokeStyle = patternOf(g, TEX.runoff);
        g.lineWidth = w + 96;
        strokeRuns(g, track, runs);
        // Painted run-off stripes through the corners
        g.lineCap = "butt";
        g.setLineDash([16, 16]);
        g.strokeStyle = "rgba(210, 40, 50, 0.55)";
        g.lineWidth = w + 84;
        strokeRuns(g, track, cr);
        g.setLineDash([]);
        g.lineCap = "round";
        g.strokeStyle = patternOf(g, TEX.runoff);
        g.lineWidth = w + 60;
        strokeRuns(g, track, cr);
        // Catch fence
        g.strokeStyle = "rgba(210, 215, 225, 0.6)";
        g.lineWidth = 1.5;
        strokeOffsetRuns(g, track, runs, scene.fenceD, field);
        strokeOffsetRuns(g, track, runs, -scene.fenceD, field);
      }

      // Kerbs through the corners
      g.lineCap = "butt";
      g.strokeStyle = "#c8102e";
      g.lineWidth = w + 22;
      strokeRuns(g, track, cr);
      g.setLineDash([10, 10]);
      g.strokeStyle = "#f2f2f2";
      strokeRuns(g, track, cr);
      g.setLineDash([]);
      g.lineCap = "round";
      // White lines, then the tarmac
      g.strokeStyle = "#f0f0f0";
      g.lineWidth = w + 4;
      strokeRuns(g, track, runs);
      g.strokeStyle = patternOf(g, TEX.asphalt);
      g.lineWidth = w - 3;
      strokeRuns(g, track, runs);
      // Rubbered-in racing line, darker in braking zones
      g.strokeStyle = "rgba(0,0,0,0.16)";
      g.lineWidth = w * 0.42;
      strokeRuns(g, track, runs);
      const br = intersectRuns(runs, brakeRuns);
      g.strokeStyle = "rgba(0,0,0,0.2)";
      g.lineWidth = 3;
      for (const off of [-12, -4, 5, 13]) strokeOffsetRuns(g, track, br, off);

      // Start/finish line, grid boxes, DRS lines
      const inRuns = (i) => runs.some((r) => (i - r.i0 + n) % n <= r.len);
      const across = (i, color, dash, width2) => {
        const p = track.path[i];
        const nr = track.nor[i];
        g.strokeStyle = color;
        g.lineWidth = width2;
        g.setLineDash(dash);
        g.beginPath();
        g.moveTo(p[0] + nr[0] * (w / 2 - 2), p[1] + nr[1] * (w / 2 - 2));
        g.lineTo(p[0] - nr[0] * (w / 2 - 2), p[1] - nr[1] * (w / 2 - 2));
        g.stroke();
        g.setLineDash([]);
      };
      g.lineCap = "butt";
      if (inRuns(0)) {
        const p = track.path[0];
        const tn = track.tan[0];
        g.save();
        g.translate(p[0], p[1]);
        g.rotate(Math.atan2(tn[1], tn[0]));
        for (let r2 = 0; r2 < 2; r2++) {
          for (let q = 0; q < Math.floor(w / 6); q++) {
            g.fillStyle = (q + r2) % 2 ? "#111" : "#f5f5f5";
            g.fillRect(-6 + r2 * 6, -w / 2 + q * 6, 6, 6);
          }
        }
        g.restore();
      }
      track.grid.forEach((slot, k) => {
        if (k >= gridCount || !inRuns(slot.i)) return;
        g.save();
        g.translate(slot.x, slot.y);
        g.rotate(slot.heading);
        g.strokeStyle = "rgba(245,245,245,0.9)";
        g.lineWidth = 2;
        g.beginPath();
        g.moveTo(-16, -12);
        g.lineTo(26, -12);
        g.lineTo(26, 12);
        g.lineTo(-16, 12);
        g.stroke();
        g.fillStyle = "rgba(245,245,245,0.8)";
        g.font = "bold 10px monospace";
        g.fillText(String(k + 1), -12, 4);
        g.restore();
      });
      for (const z of track.drs) {
        if (inRuns(z.detect)) across(z.detect, "rgba(255,255,255,0.7)", [6, 6], 3);
        if (inRuns(z.from)) across(z.from, "#39ff14", [8, 4], 3);
      }
      strokeWalls(g, track, runs);
    }

    // Structures above the ground
    for (const it of items) {
      if (it.kind === "trees") paintTrees(g, it);
      else if (it.kind === "palm") paintPalm(g, it.x, it.y, it.seed);
      else if (it.kind === "pits") paintPits(g, track, it);
      else if (it.kind === "stand") paintStand(g, track, it, track.night);
      else if (it.kind === "tyres") paintTyres(g, it);
      else if (it.kind === "board") paintBoard(g, it);
      else if (it.kind === "marshal") paintMarshal(g, it);
      else if (it.kind === "pylon") paintPylon(g, it);
    }
    if (track.night) {
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.fillStyle = "rgba(6, 10, 30, 0.5)";
      g.fillRect(0, 0, TILE, TILE);
    }
    return c;
  }

  function getTile(tx, ty, allowPaint) {
    const key = ty * cols + tx;
    let t = tiles.get(key);
    if (t) {
      tiles.delete(key);
      tiles.set(key, t); // LRU bump
      return t;
    }
    if (!allowPaint) return null;
    t = paintTile(tx, ty);
    tiles.set(key, t);
    if (tiles.size > MAX_TILES) tiles.delete(tiles.keys().next().value);
    return t;
  }

  const stands = scene.items.filter((it) => it.kind === "stand");
  const pylons = scene.items.filter((it) => it.kind === "pylon");

  return {
    track,
    scene,
    /** Draw the cached world for a camera {x, y, zoom} (x/y = world point at screen centre). */
    draw(ctx, cam, W, H, budget = 3) {
      const z = cam.zoom;
      const a = cam.angle || 0;
      // A rotated view needs the bounding box of the whole screen, whichever way it's turned
      const hw = a ? Math.hypot(W, H) / 2 / z : W / 2 / z;
      const hh = a ? hw : H / 2 / z;
      const left = cam.x - hw;
      const top = cam.y - hh;
      const right = cam.x + hw;
      const bottom = cam.y + hh;
      ctx.fillStyle = street ? "#1c1f25" : track.theme === "desert" ? "#9c7c50" : "#1a4020";
      ctx.fillRect(0, 0, W, H);
      ctx.save();
      worldTransform(ctx, cam, W, H);
      ctx.imageSmoothingEnabled = false;
      let painted = 0;
      for (let ty = Math.max(0, Math.floor(top / TILE)); ty <= Math.min(rows - 1, Math.floor(bottom / TILE)); ty++) {
        for (let tx = Math.max(0, Math.floor(left / TILE)); tx <= Math.min(cols - 1, Math.floor(right / TILE)); tx++) {
          const had = tiles.has(ty * cols + tx);
          const t = getTile(tx, ty, had || painted < budget);
          if (!t) continue;
          if (!had) painted++;
          ctx.drawImage(t, tx * TILE, ty * TILE, TILE + 0.5, TILE + 0.5);
        }
      }
      ctx.restore();
      return { left, top, right, bottom };
    },
    /** Show `n` grid boxes: repaints the tiles under the grid when the field size changes. */
    setGridCount(n) {
      const next = Math.max(0, Math.min(track.grid.length, n));
      if (next === gridCount) return;
      gridCount = next;
      for (const slot of track.grid) {
        const cx = Math.floor(slot.x / TILE);
        const cy = Math.floor(slot.y / TILE);
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) tiles.delete((cy + dy) * cols + cx + dx);
      }
    },
    /** Paint every tile the camera can see right now (used before a race starts). */
    warm(cam, W, H) {
      const z = cam.zoom;
      for (let ty = Math.max(0, Math.floor((cam.y - H / 2 / z) / TILE)); ty <= Math.min(rows - 1, Math.floor((cam.y + H / 2 / z) / TILE)); ty++) {
        for (let tx = Math.max(0, Math.floor((cam.x - W / 2 / z) / TILE)); tx <= Math.min(cols - 1, Math.floor((cam.x + W / 2 / z) / TILE)); tx++) getTile(tx, ty, true);
      }
    },
    /** Waving flags and camera flashes in the grandstands, floodlight pools at night. */
    drawLive(ctx, view, t) {
      for (const st of stands) {
        const [x0, y0, x1, y1] = st.bbox;
        if (x1 < view.left || x0 > view.right || y1 < view.top || y0 > view.bottom) continue;
        const d0 = w / 2 + (street ? 36 : 200) + 26;
        for (const f of st.flags) {
          const i = (st.i0 + f.k) % n;
          const d = st.side * (d0 + 8 + f.row * (st.depth - 20));
          const p = track.path[i];
          const x = p[0] + track.nor[i][0] * d;
          const y = p[1] + track.nor[i][1] * d;
          const wave = Math.sin(t * 6 + f.k) * 3;
          ctx.fillStyle = f.c;
          ctx.fillRect(x + wave - 3, y - 4, 7, 4);
          if (track.night && Math.random() < 0.004) glow(ctx, x, y, 10, "#ffffff", 0.9);
        }
      }
      if (track.night) {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        for (const p of pylons) {
          if (p.x < view.left - 200 || p.x > view.right + 200 || p.y < view.top - 200 || p.y > view.bottom + 200) continue;
          glow(ctx, p.x, p.y, 230, "#fff1c9", 0.16);
        }
        ctx.restore();
      }
    },
    tileCount: () => tiles.size
  };
}

// ─────────────────────────── Cars ───────────────────────────
const carCache = new Map();
/** Top-down open-wheel car sprite (nose toward +x), 48×24, cached per livery. */
export function carSprite(color, accent) {
  const key = color + accent;
  if (carCache.has(key)) return carCache.get(key);
  const { c, ctx: g } = makeCanvas(52, 26);
  g.translate(26, 13);
  const dark = shade(color, -0.45);
  // Tyres
  g.fillStyle = "#101114";
  g.fillRect(-19, -12, 10, 6);
  g.fillRect(-19, 6, 10, 6);
  g.fillRect(9, -11, 8, 5);
  g.fillRect(9, 6, 8, 5);
  g.fillStyle = "rgba(255,255,255,0.18)";
  g.fillRect(-19, -12, 10, 1);
  g.fillRect(9, -11, 8, 1);
  // Suspension arms
  g.strokeStyle = "#2a2d33";
  g.lineWidth = 1;
  g.beginPath();
  g.moveTo(-14, -6);
  g.lineTo(-10, -2);
  g.moveTo(-14, 6);
  g.lineTo(-10, 2);
  g.moveTo(13, -6);
  g.lineTo(8, -2);
  g.moveTo(13, 6);
  g.lineTo(8, 2);
  g.stroke();
  // Floor
  g.fillStyle = "#1b1d22";
  g.beginPath();
  g.moveTo(-20, -6);
  g.lineTo(6, -7);
  g.lineTo(6, 7);
  g.lineTo(-20, 6);
  g.fill();
  // Sidepods and engine cover
  g.fillStyle = dark;
  g.beginPath();
  g.moveTo(-17, -5);
  g.quadraticCurveTo(-4, -8, 6, -5);
  g.lineTo(6, 5);
  g.quadraticCurveTo(-4, 8, -17, 5);
  g.fill();
  g.fillStyle = color;
  g.beginPath();
  g.moveTo(-18, -3.5);
  g.quadraticCurveTo(-3, -7, 5, -4);
  g.lineTo(5, 4);
  g.quadraticCurveTo(-3, 7, -18, 3.5);
  g.fill();
  // Nose
  g.fillStyle = color;
  g.beginPath();
  g.moveTo(4, -3);
  g.lineTo(21, -1.5);
  g.lineTo(22, 0);
  g.lineTo(21, 1.5);
  g.lineTo(4, 3);
  g.fill();
  g.fillStyle = accent;
  g.fillRect(8, -0.8, 12, 1.6);
  g.fillRect(-16, -1, 18, 2);
  // Front wing
  g.fillStyle = dark;
  g.fillRect(19, -11, 4, 22);
  g.fillStyle = accent;
  g.fillRect(22, -11, 2, 22);
  // Cockpit, halo, helmet
  g.fillStyle = "#07080a";
  g.beginPath();
  g.ellipse(-1, 0, 5, 3, 0, 0, TAU);
  g.fill();
  g.fillStyle = accent;
  g.beginPath();
  g.arc(-1, 0, 2, 0, TAU);
  g.fill();
  g.strokeStyle = "#2c2f35";
  g.lineWidth = 1.2;
  g.beginPath();
  g.ellipse(0, 0, 5.5, 3.6, 0, -1.3, 1.3);
  g.stroke();
  // Airbox / fin
  g.fillStyle = "rgba(255,255,255,0.25)";
  g.fillRect(-12, -0.6, 7, 1.2);
  // Rear wing
  g.fillStyle = "#15171b";
  g.fillRect(-24, -10, 4, 20);
  g.fillStyle = color;
  g.fillRect(-24, -10, 4, 2);
  g.fillRect(-24, 8, 4, 2);
  // Highlight along the top
  g.fillStyle = "rgba(255,255,255,0.22)";
  g.beginPath();
  g.moveTo(-17, -3);
  g.quadraticCurveTo(-3, -6, 5, -3.5);
  g.lineTo(5, -2.6);
  g.quadraticCurveTo(-3, -5, -17, -2);
  g.fill();
  carCache.set(key, c);
  return c;
}

export function drawCar(ctx, car, t, opts = {}) {
  const img = carSprite(car.color, car.accent);
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.globalAlpha = opts.alpha ?? 1;
  // Soft shadow
  ctx.save();
  ctx.translate(3, 4);
  ctx.rotate(car.heading);
  ctx.fillStyle = "rgba(0,0,0,0.38)";
  ctx.fillRect(-22, -10, 44, 20);
  ctx.restore();
  ctx.rotate(car.heading);
  ctx.drawImage(img, -26, -13);
  // Front wheels turn with the steering
  if (car.steer && !opts.ghost) {
    ctx.fillStyle = "#101114";
    for (const sy of [-8.5, 8.5]) {
      ctx.save();
      ctx.translate(13, sy);
      ctx.rotate(car.steer * 0.45);
      ctx.fillRect(-4, -2.5, 8, 5);
      ctx.restore();
    }
  }
  // Rain light / brake light
  const braking = car.brake > 0.1;
  if (braking || Math.sin(t * 12) > 0.6) {
    if (braking) glow(ctx, -25, 0, 12, "#ff2030", 0.7);
    ctx.fillStyle = braking ? "#ff3040" : "#9a1020";
    ctx.fillRect(-26, -1.5, 2, 3);
  }
  if (car.drsOpen) {
    ctx.fillStyle = "#39ff14";
    ctx.fillRect(-24, -10, 1.5, 20);
  }
  ctx.restore();
}

// ─────────────────────────── Minimap ───────────────────────────
export function createMinimap(track, size = 250) {
  const scale = Math.min(size / track.W, (size * 0.62) / track.H);
  const w = Math.ceil(track.W * scale);
  const h = Math.ceil(track.H * scale);
  const { c, ctx: g } = makeCanvas(w + 16, h + 16);
  g.translate(8, 8);
  g.lineJoin = "round";
  g.lineCap = "round";
  g.beginPath();
  track.path.forEach(([x, y], i) => (i ? g.lineTo(x * scale, y * scale) : g.moveTo(x * scale, y * scale)));
  g.closePath();
  g.strokeStyle = "rgba(0,0,0,0.6)";
  g.lineWidth = 7;
  g.stroke();
  g.strokeStyle = "#d8dde6";
  g.lineWidth = 3.5;
  g.stroke();
  // DRS zones in green
  g.strokeStyle = "#39ff14";
  g.lineWidth = 3.5;
  for (const z of track.drs) {
    g.beginPath();
    for (let k = 0, i = z.from; k < 2000; k++, i = (i + 1) % track.n) {
      const [x, y] = track.path[i];
      if (k === 0) g.moveTo(x * scale, y * scale);
      else g.lineTo(x * scale, y * scale);
      if (i === z.to) break;
    }
    g.stroke();
  }
  const [sx, sy] = track.path[0];
  g.fillStyle = "#ffffff";
  g.fillRect(sx * scale - 3, sy * scale - 3, 6, 6);
  return { img: c, scale, pad: 8 };
}

/** Thumbnail outline for menus. */
export function trackThumb(track, w, h, color = "#d8dde6") {
  const { c, ctx: g } = makeCanvas(w, h);
  const s = Math.min((w - 16) / track.W, (h - 16) / track.H);
  const ox = (w - track.W * s) / 2;
  const oy = (h - track.H * s) / 2;
  g.lineJoin = "round";
  g.beginPath();
  track.path.forEach(([x, y], i) => (i ? g.lineTo(ox + x * s, oy + y * s) : g.moveTo(ox + x * s, oy + y * s)));
  g.closePath();
  g.strokeStyle = color;
  g.lineWidth = 2.5;
  g.stroke();
  const [sx, sy] = track.path[0];
  g.fillStyle = "#ffd400";
  g.fillRect(ox + sx * s - 2.5, oy + sy * s - 2.5, 5, 5);
  return c;
}

export { rgba };
