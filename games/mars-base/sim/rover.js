import { TERRAIN } from "../data/tiles.js";
import { structById } from "../data/structures.js";
import { inBounds, terrainAt, nodeAt, structAt } from "./world.js";
import { NODES } from "../data/tiles.js";
import { revealAround } from "./state.js";
import { daylight, stormFactor } from "./env.js";
import { PLAYER_RADIUS } from "../data/balance.js";

export const ROVER = {
  accel: 5,
  maxSpeed: 7.5,
  turn: 2.4,
  drag: 1.4,
  drainPerSec: 0.75, // at full throttle
  solarCharge: 0.15, // per second in full sun (roof panels)
  dockCharge: 6,
  radius: 0.45,
};

export function roverCapacity(g) {
  return 100 * (g.s.research.done.includes("rover-pack") ? 2 : 1);
}

function roverBlocked(g, x, y) {
  const r = ROVER.radius;
  for (const [px, py] of [[x - r, y - r], [x + r, y - r], [x - r, y + r], [x + r, y + r]]) {
    const tx = Math.floor(px);
    const ty = Math.floor(py);
    if (!inBounds(g, tx, ty)) return true;
    if (TERRAIN[terrainAt(g, tx, ty)].solid) return true;
    const n = nodeAt(g, tx, ty);
    if (n && NODES[n].solid) return true;
    const st = structAt(g, tx, ty);
    if (st && !structById(st.id).pad && st.id !== "cable" && st.id !== "beacon") return true;
  }
  return false;
}

export function tickRover(g, input, dt) {
  const s = g.s;
  const rv = s.rover;
  const p = s.player;
  rv.capacity = roverCapacity(g);
  // Passive charging: roof panels by day, dock next to any powered grid with stored charge.
  rv.battery = Math.min(rv.capacity, rv.battery + ROVER.solarCharge * daylight(s.tick) * stormFactor(g) * dt);
  if (!p.inRover || rv.broken) {
    rv.v *= Math.max(0, 1 - ROVER.drag * dt * 3);
    dockCharge(g, dt);
    return;
  }
  const throttle = -(input.my ?? 0);
  const steer = input.mx ?? 0;
  const t = terrainAt(g, Math.floor(rv.x), Math.floor(rv.y));
  const terrainSpeed = TERRAIN[t]?.speed || 1;
  if (rv.battery > 0 && Math.abs(throttle) > 0.05) {
    rv.v += throttle * ROVER.accel * dt;
    rv.battery = Math.max(0, rv.battery - Math.abs(throttle) * ROVER.drainPerSec * dt);
  }
  rv.v -= rv.v * ROVER.drag * dt * (Math.abs(throttle) > 0.05 && rv.battery > 0 ? 0.3 : 1);
  const vmax = ROVER.maxSpeed * terrainSpeed;
  rv.v = Math.max(-vmax * 0.4, Math.min(vmax, rv.v));
  if (Math.abs(rv.v) > 0.1) rv.a += steer * ROVER.turn * dt * Math.sign(rv.v) * Math.min(1, Math.abs(rv.v) / 2);
  const nx = rv.x + Math.cos(rv.a) * rv.v * dt;
  const ny = rv.y + Math.sin(rv.a) * rv.v * dt;
  // Move, sliding along obstacles on a glancing hit; bounce only on a head-on one.
  let mx = nx;
  let my = ny;
  if (roverBlocked(g, mx, my)) {
    if (!roverBlocked(g, nx, rv.y)) my = rv.y;
    else if (!roverBlocked(g, rv.x, ny)) mx = rv.x;
    else {
      mx = rv.x;
      my = rv.y;
    }
    if (mx === rv.x && my === rv.y) {
      if (Math.abs(rv.v) > 3) g.fx.push({ kind: "bump", x: rv.x, y: rv.y });
      rv.v = -rv.v * 0.25;
    } else {
      rv.v *= 0.9;
    }
  }
  if (mx !== rv.x || my !== rv.y) {
    s.stats.distance += Math.hypot(mx - rv.x, my - rv.y);
    const ox = Math.floor(rv.x);
    const oy = Math.floor(rv.y);
    rv.x = mx;
    rv.y = my;
    if (Math.floor(rv.x) !== ox || Math.floor(rv.y) !== oy) {
      if (revealAround(g, rv.x, rv.y, 14)) g.fx.push({ kind: "reveal" });
    }
  }
  p.x = rv.x;
  p.y = rv.y;
  dockCharge(g, dt);
}

function dockCharge(g, dt) {
  const rv = g.s.rover;
  if (!g.grids) return;
  const tx = Math.floor(rv.x);
  const ty = Math.floor(rv.y);
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      const st = structAt(g, tx + dx, ty + dy);
      if (!st || st.grid === undefined) continue;
      const grid = g.grids[st.grid];
      if (!grid || grid.stored < 5) continue;
      const want = Math.min(rv.capacity - rv.battery, ROVER.dockCharge * dt);
      if (want <= 0) return;
      // Pull from the batteries directly.
      let need = want;
      for (const bi of grid.batteries) {
        const b = g.structs.get(bi);
        const take = Math.min(b.charge, need);
        b.charge -= take;
        need -= take;
        if (need <= 0) break;
      }
      rv.battery += want - need;
      grid.stored -= want - need;
      rv.docked = true;
      return;
    }
  }
  rv.docked = false;
}

// Exit the rover onto a free tile next to it.
export function exitRover(g) {
  const s = g.s;
  const rv = s.rover;
  const p = s.player;
  const spots = [[0, 1], [1, 0], [-1, 0], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1], [0, 2], [2, 0], [-2, 0], [0, -2]];
  for (const [dx, dy] of spots) {
    const x = rv.x + dx;
    const y = rv.y + dy;
    const r = PLAYER_RADIUS;
    let ok = true;
    for (const [px, py] of [[x - r, y - r], [x + r, y - r], [x - r, y + r], [x + r, y + r]]) {
      const tx = Math.floor(px);
      const ty = Math.floor(py);
      if (!inBounds(g, tx, ty) || TERRAIN[terrainAt(g, tx, ty)].solid) ok = false;
      const n = nodeAt(g, tx, ty);
      if (n && NODES[n].solid) ok = false;
      const st = structAt(g, tx, ty);
      if (st && structById(st.id).solid) ok = false;
    }
    if (ok) {
      p.inRover = false;
      p.x = x;
      p.y = y;
      rv.v = 0;
      g.fx.push({ kind: "rover-out" });
      return true;
    }
  }
  return false;
}
