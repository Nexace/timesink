// A scripted player that drives the pure sim through the same input frames the UI produces.
import { step } from "../sim/step.js";
import { findPath } from "../sim/path.js";
import { blocksWalk, nodeAt } from "../sim/world.js";
import { interact } from "../sim/player.js";
import { build, queueCraft } from "../sim/building.js";
import { countIn } from "../sim/inventory.js";
import { TICK_RATE } from "../data/balance.js";

export function createBot(g, { maxTicks = TICK_RATE * 60 * 60 * 3 } = {}) {
  let used = 0;
  const p = () => g.s.player;

  function tick(input) {
    if (g.s.status !== "playing") throw new Error(`bot: game over (${g.s.status}, ${g.s.deathCause ?? ""}) at tick ${g.s.tick}`);
    step(g, input);
    used += 1;
    if (used > maxTicks) throw new Error("bot: tick budget exhausted");
  }

  function wait(seconds) {
    for (let i = 0; i < seconds * TICK_RATE; i += 1) tick({ mx: 0, my: 0, use: false, aim: null });
  }

  // Walk to within `near` tiles of (tx, ty) following an A* path.
  function walkTo(tx, ty, near = 1.4) {
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const sx = Math.floor(p().x);
      const sy = Math.floor(p().y);
      const goalBlocked = blocksWalk(g, tx, ty);
      const path = findPath(g.world.w, g.world.h, sx, sy, tx, ty, (x, y) => blocksWalk(g, x, y), { maxNodes: 60000, goalAdjacent: goalBlocked });
      if (!path) throw new Error(`bot: no path from ${sx},${sy} to ${tx},${ty}`);
      for (const wp of path) {
        let guard = 0;
        while (Math.hypot(wp.x + 0.5 - p().x, wp.y + 0.5 - p().y) > 0.15 && guard < 200) {
          const dx = wp.x + 0.5 - p().x;
          const dy = wp.y + 0.5 - p().y;
          const d = Math.hypot(dx, dy);
          tick({ mx: dx / d, my: dy / d, use: false, aim: null });
          guard += 1;
        }
        if (Math.hypot(tx + 0.5 - p().x, ty + 0.5 - p().y) <= near) return;
      }
      if (Math.hypot(tx + 0.5 - p().x, ty + 0.5 - p().y) <= near + 0.8) return;
    }
    throw new Error(`bot: could not reach ${tx},${ty}`);
  }

  function select(id) {
    const i = g.s.inv.findIndex((v) => v && v.id === id);
    if (i < 0) throw new Error(`bot: no ${id}`);
    if (i > 8) {
      const t = g.s.inv[0];
      g.s.inv[0] = g.s.inv[i];
      g.s.inv[i] = t;
      g.s.sel = 0;
    } else g.s.sel = i;
  }

  function mine(x, y, tool = "drill-1") {
    walkTo(x, y, 1.9);
    select(tool);
    const aim = { x: x + 0.5, y: y + 0.5 };
    let guard = 0;
    while (nodeAt(g, x, y) && guard < TICK_RATE * 30) {
      tick({ mx: 0, my: 0, use: true, aim });
      guard += 1;
    }
    if (nodeAt(g, x, y)) throw new Error(`bot: failed to mine ${x},${y}`);
  }

  function shovel(x, y, times) {
    walkTo(x, y, 1.9);
    select("shovel");
    const aim = { x: x + 0.5, y: y + 0.5 };
    const before = g.s.stats.mined;
    let guard = 0;
    while (g.s.stats.mined - before < times * 2 && guard < TICK_RATE * 60) {
      tick({ mx: 0, my: 0, use: true, aim });
      guard += 1;
    }
  }

  function nearestNode(n, maxR = 60) {
    const px = Math.floor(p().x);
    const py = Math.floor(p().y);
    let best = null;
    for (let y = py - maxR; y <= py + maxR; y += 1) {
      for (let x = px - maxR; x <= px + maxR; x += 1) {
        if (x < 0 || y < 0 || x >= g.world.w || y >= g.world.h) continue;
        if (g.world.nodes[y * g.world.w + x] !== n) continue;
        const d = Math.hypot(x - px, y - py);
        if (!best || d < best.d) best = { x, y, d };
      }
    }
    return best;
  }

  function act(x, y) {
    walkTo(x, y, 1.6);
    return interact(g, { x: x + 0.5, y: y + 0.5 });
  }

  function craft(rid, times = 1, at = null) {
    if (at) walkTo(at.x, at.y, 1.6);
    const r = queueCraft(g, rid, times);
    if (!r.ok) throw new Error(`bot: craft ${rid} failed: ${r.reason}`);
    let guard = 0;
    while (g.s.craft.length && guard < TICK_RATE * 120) {
      tick({ mx: 0, my: 0, use: false, aim: null });
      guard += 1;
    }
  }

  function place(id, x, y) {
    walkTo(x, y, 3);
    const r = build(g, id, x, y);
    if (!r.ok) throw new Error(`bot: build ${id} at ${x},${y} failed: ${r.reason}`);
  }

  function has(id) {
    return countIn(g.s.inv, id);
  }

  // Drive the rover along an A* path to within `near` tiles of the target.
  function drive(tx, ty, near = 3) {
    const rv = g.s.rover;
    if (!p().inRover) throw new Error("bot: not in rover");
    const blocked = (x, y) => {
      if (blocksWalk(g, x, y)) return true;
      const st = g.structs.get(y * g.world.w + x);
      return Boolean(st && !["pad", "cable", "beacon"].includes(st.id));
    };
    let path = findPath(g.world.w, g.world.h, Math.floor(rv.x), Math.floor(rv.y), tx, ty, blocked, { maxNodes: 200000, goalAdjacent: blocksWalk(g, tx, ty) });
    if (!path) throw new Error("bot: no rover path");
    let i = 0;
    let stuck = 0;
    let lastD = Infinity;
    for (let guard = 0; guard < TICK_RATE * 60 * 20; guard += 1) {
      if (Math.hypot(tx + 0.5 - rv.x, ty + 0.5 - rv.y) <= near) {
        for (let k = 0; k < TICK_RATE * 2; k += 1) tick({ mx: 0, my: 1, use: false, aim: null }); // brake
        return;
      }
      while (i < path.length - 1 && Math.hypot(path[i].x + 0.5 - rv.x, path[i].y + 0.5 - rv.y) < 1.2) i += 1;
      const look = path[Math.min(path.length - 1, i + 1)];
      const want = Math.atan2(look.y + 0.5 - rv.y, look.x + 0.5 - rv.x);
      let diff = ((want - rv.a + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      const steer = Math.max(-1, Math.min(1, diff * 2));
      const throttle = Math.abs(diff) > 0.9 ? 0.25 : Math.abs(diff) > 0.4 ? 0.5 : 1;
      if (rv.battery <= 0) throw new Error(`bot: rover battery dead ${Math.round(Math.hypot(tx - rv.x, ty - rv.y))} tiles short`);
      tick({ mx: steer, my: -throttle, use: false, aim: null });
      const d = Math.hypot(look.x + 0.5 - rv.x, look.y + 0.5 - rv.y);
      if (d >= lastD - 0.001) stuck += 1;
      else stuck = 0;
      lastD = d;
      if (stuck > TICK_RATE * 3) {
        if (process.env.MB_DEBUG) console.log("replan at", rv.x.toFixed(1), rv.y.toFixed(1), "battery", rv.battery.toFixed(1), "look", look);
        // back up and re-plan
        for (let k = 0; k < TICK_RATE; k += 1) tick({ mx: 0, my: 1, use: false, aim: null });
        path = findPath(g.world.w, g.world.h, Math.floor(rv.x), Math.floor(rv.y), tx, ty, blocked, { maxNodes: 200000, goalAdjacent: blocksWalk(g, tx, ty) }) ?? path;
        i = 0;
        stuck = 0;
        lastD = Infinity;
      }
    }
    throw new Error("bot: drive timed out");
  }

  return { tick, wait, walkTo, drive, mine, shovel, nearestNode, act, craft, place, select, has, get used() { return used; } };
}
