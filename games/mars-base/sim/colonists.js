import { COLONIST_NAMES } from "../data/story.js";
import { CROPS, FOOD_VALUE, VITALS, SOL_SECONDS, COLONY } from "../data/balance.js";
import { structById } from "../data/structures.js";
import { itemById } from "../data/items.js";
import { findPath } from "./path.js";
import { blocksWalk } from "./world.js";
import { roomAtTile, isBreathable } from "./rooms.js";
import { withRng, pushLog, alert } from "./state.js";
import { addTo, removeFrom, countIn, poolPay, poolHas } from "./inventory.js";
import { withdrawWater, pantry } from "./systems.js";
import { REPAIR_COST } from "./player.js";
import { freeTileNear } from "./events.js";

const WALK = 3.2;
const FOODS = ["potato", "lettuce", "beans", "ration"];

export function aliveColonists(g) {
  return g.s.colonists.filter((c) => c.alive);
}

export function bunkCount(g) {
  let n = 0;
  for (const st of g.structs.values()) if (st.id === "bunk" && roomAtTile(g, st.x, st.y)) n += 1;
  return n;
}

// Crew capacity: bunks beyond the commander's own.
export function housingFree(g) {
  return bunkCount(g) - 1 - aliveColonists(g).length;
}

function crates(g) {
  return [...g.structs.values()].filter((st) => st.id === "crate");
}

function cratePool(g) {
  return crates(g).map((c) => c.items);
}

export function landersAllowed(g) {
  const s = g.s;
  // A working dish is enough — Earth schedules landers even if it browned out overnight.
  if (![...g.structs.values()].some((st) => st.id === "comms" && !st.broken)) return false;
  if (![...g.structs.values()].some((st) => st.id === "pad")) return false;
  if (s.mode === "campaign" && !(s.story.done.includes("pad"))) return false;
  if (s.mode === "campaign" && aliveColonists(g).length >= COLONY.campaignMaxColonists) return false;
  return true;
}

// Called at each dawn.
export function maybeLander(g, sol) {
  const s = g.s;
  if (!landersAllowed(g)) return;
  if (sol < s.nextLander) return;
  const free = housingFree(g);
  if (free <= 0) {
    if (!s.story.flags.housingNag) {
      s.story.flags.housingNag = true;
      pushLog(g, "Mission Control is holding the next crew lander until there are free bunks.", "info");
    }
    return;
  }
  const crew = 1 + aliveColonists(g).length;
  const foodOk = pantry(g) + countFood(s.inv) >= (crew + 1) * 2;
  if (!foodOk) {
    pushLog(g, "Crew lander postponed: not enough food stored in crates (2 sols per person).", "bad");
    s.nextLander = sol + 1;
    return;
  }
  const pad = [...g.structs.values()].find((st) => st.id === "pad");
  const count = Math.min(free, withRng(g, "ai", (rng) => rng.int(1, 2)));
  for (let k = 0; k < count; k += 1) {
    const spot = freeTileNear(g, pad.x, pad.y, 4, (x, y) => !blocksWalk(g, x, y)) ?? { x: pad.x, y: pad.y };
    const name = COLONIST_NAMES[(s.colonists.length + s.seed) % COLONIST_NAMES.length];
    s.colonists.push({
      id: s.colonists.length,
      name,
      x: spot.x + 0.5,
      y: spot.y + 0.5,
      health: 100,
      food: 80,
      water: 80,
      o2: 100,
      alive: true,
      job: null,
      path: null,
      working: false,
      t: 0,
      think: 0,
    });
  }
  s.stats.maxColonists = Math.max(s.stats.maxColonists, aliveColonists(g).length);
  s.nextLander = sol + COLONY.landerInterval;
  g.fx.push({ kind: "lander", x: pad.x + 0.5, y: pad.y + 0.5 });
  pushLog(g, `Crew lander touched down. ${count} new colonist${count === 1 ? "" : "s"} walking in.`, "good");
  alert(g, `CREW LANDER — +${count} COLONIST${count === 1 ? "" : "S"}`, "good");
}

function countFood(slots) {
  let n = 0;
  for (const id of FOODS) n += countIn(slots, id);
  return n;
}

// ---- per-second needs ----
export function colonistNeeds(g, dt) {
  const s = g.s;
  for (const c of s.colonists) {
    if (!c.alive) continue;
    const room = roomAtTile(g, Math.floor(c.x), Math.floor(c.y));
    const breathable = isBreathable(room);
    c.o2 = breathable ? Math.min(100, c.o2 + 4 * dt) : Math.max(0, c.o2 - 0.25 * dt);
    c.food = Math.max(0, c.food - VITALS.foodDrain * dt);
    c.water = Math.max(0, c.water - VITALS.waterDrain * dt);
    if (c.food < 40) {
      for (const cr of crates(g)) {
        const id = FOODS.find((f) => countIn(cr.items, f) > 0);
        if (id) {
          removeFrom(cr.items, id, 1);
          c.food = Math.min(100, c.food + FOOD_VALUE[id]);
          break;
        }
      }
    }
    if (breathable && c.water < 90) {
      const want = (90 - c.water) * 0.03;
      const got = withdrawWater(g, Math.min(want, 0.2 * dt));
      c.water += got / 0.03;
      g.s.waterUsed = (g.s.waterUsed ?? 0) + got;
    }
    let dmg = 0;
    if (c.o2 <= 0) dmg += 5;
    if (c.food <= 0) dmg += 0.12;
    if (c.water <= 0) dmg += 0.25;
    if (room && room.temp < -5) dmg += 0.3;
    if (s.events.active.some((e) => e.id === "spe") && !(room && room.sealed)) dmg += 0.5;
    if (dmg > 0) {
      c.health -= dmg * dt;
      s.sustain.badSol = true;
    } else {
      c.health = Math.min(100, c.health + 0.05 * dt);
    }
    if (c.health <= 0) {
      c.alive = false;
      s.stats.colonistsLost += 1;
      pushLog(g, `${c.name} has died. The colony is quieter tonight.`, "danger");
      alert(g, `COLONIST LOST — ${c.name.toUpperCase()}`, "danger");
    }
  }
}

// ---- jobs ----
function blockedFor(g) {
  return (x, y) => blocksWalk(g, x, y);
}

function pickJob(g, c) {
  const s = g.s;
  const cx = Math.floor(c.x);
  const cy = Math.floor(c.y);
  const near = (st) => Math.abs(st.x - cx) + Math.abs(st.y - cy);
  const structs = [...g.structs.values()].sort((a, b) => near(a) - near(b));
  const pool = cratePool(g);
  const taken = new Set(s.colonists.filter((o) => o !== c && o.alive && o.job).map((o) => o.job.at));
  const key = (st) => st.y * g.world.w + st.x;
  for (const st of structs) {
    if (taken.has(key(st))) continue;
    if (st.broken && poolHas(pool, REPAIR_COST[st.id] ?? REPAIR_COST.default)) return { kind: "repair", at: key(st), dur: 4 };
  }
  for (const st of structs) {
    if (st.id !== "planter" || taken.has(key(st))) continue;
    if (st.crop && (st.crop.g >= 1 || st.crop.dead)) return { kind: "harvest", at: key(st), dur: 2 };
    if (!st.crop && pool.some((sl) => countIn(sl, "seed-potato") + countIn(sl, "seed-lettuce") + countIn(sl, "seed-beans") > 0)) return { kind: "plant", at: key(st), dur: 2 };
  }
  for (const st of structs) {
    if (st.id === "recycler" && st.compost >= 3 && !taken.has(key(st))) return { kind: "haul", at: key(st), dur: 1.5 };
  }
  for (const st of structs) {
    if (st.id === "lab" && st.samples > 0 && s.research.current && !taken.has(key(st))) return { kind: "lab", at: key(st), dur: 40 };
  }
  for (const st of structs) {
    if (st.id === "solar" && (st.dust ?? 0) > 0.45 && !taken.has(key(st)) && !s.events.active.some((e) => e.id === "spe")) return { kind: "wipe", at: key(st), dur: 1.5 };
  }
  return null;
}

function finishJob(g, c) {
  const s = g.s;
  const st = g.structs.get(c.job.at);
  if (!st) return;
  const pool = cratePool(g);
  const store = (id, n) => {
    let left = n;
    for (const cr of crates(g)) {
      left = addTo(cr.items, id, left);
      if (!left) break;
    }
    if (left) s.drops.push({ x: st.x + 0.5, y: st.y + 1.5, id, n: left });
  };
  switch (c.job.kind) {
    case "repair":
      if (st.broken && poolPay(pool, REPAIR_COST[st.id] ?? REPAIR_COST.default)) {
        st.broken = false;
        if (st.wear !== undefined) st.wear = 0;
        g.dirtyRooms = true;
        pushLog(g, `${c.name} repaired the ${structById(st.id).name}.`, "good");
      }
      break;
    case "harvest": {
      const crop = st.crop;
      if (!crop) break;
      if (!crop.dead) {
        const def = CROPS[crop.type];
        const n = withRng(g, "ai", (rng) => rng.int(def.yieldCount[0], def.yieldCount[1])) + (s.research.done.includes("fertilizer") ? 1 : 0);
        store(def.yield, n);
        s.stats.harvested += n;
        st.crop = { type: crop.type, g: 0, stress: 0, dead: false }; // replant from the returned seed
      } else {
        st.crop = null;
      }
      break;
    }
    case "plant": {
      if (st.crop) break;
      const seed = ["seed-potato", "seed-beans", "seed-lettuce"].find((id) => pool.some((sl) => countIn(sl, id) > 0));
      if (seed && poolPay(pool, { [seed]: 1 })) st.crop = { type: itemById(seed).crop, g: 0, stress: 0, dead: false };
      break;
    }
    case "haul":
      if (st.compost > 0) {
        store("compost", st.compost);
        st.compost = 0;
      }
      break;
    case "wipe":
      st.dust = 0;
      break;
    default:
      break;
  }
}

export function tickColonists(g, dt) {
  const s = g.s;
  for (const c of s.colonists) {
    if (!c.alive) continue;
    c.think -= dt;
    if (!c.job && c.think <= 0) {
      c.think = 2 + (c.id % 5) * 0.3;
      const job = pickJob(g, c);
      if (job) {
        const st = g.structs.get(job.at);
        const path = findPath(g.world.w, g.world.h, Math.floor(c.x), Math.floor(c.y), st.x, st.y, blockedFor(g), { goalAdjacent: true, maxNodes: 5000 });
        if (path) {
          c.job = job;
          c.path = path;
          c.working = false;
          c.t = 0;
        }
      } else if (!c.path || !c.path.length) {
        // idle: wander inside the current room
        const room = roomAtTile(g, Math.floor(c.x), Math.floor(c.y));
        if (room && room.tiles.length) {
          const t = withRng(g, "ai", (rng) => rng.pick(room.tiles));
          const tx = t % g.world.w;
          const ty = (t - tx) / g.world.w;
          if (!blocksWalk(g, tx, ty)) c.path = findPath(g.world.w, g.world.h, Math.floor(c.x), Math.floor(c.y), tx, ty, blockedFor(g), { maxNodes: 800 });
        } else {
          // outside (e.g. fresh off the lander): head for the nearest bunk room
          const bunk = [...g.structs.values()].find((st) => st.id === "bunk");
          if (bunk) c.path = findPath(g.world.w, g.world.h, Math.floor(c.x), Math.floor(c.y), bunk.x, bunk.y, blockedFor(g), { goalAdjacent: true, maxNodes: 8000 });
        }
      }
    }
    // Walk the path.
    if (c.path && c.path.length) {
      const next = c.path[0];
      if (blocksWalk(g, next.x, next.y)) {
        c.path = null;
        c.job = null;
        continue;
      }
      const tx = next.x + 0.5;
      const ty = next.y + 0.5;
      const dx = tx - c.x;
      const dy = ty - c.y;
      const d = Math.hypot(dx, dy);
      const step = WALK * dt;
      if (d <= step) {
        c.x = tx;
        c.y = ty;
        c.path.shift();
      } else {
        c.x += (dx / d) * step;
        c.y += (dy / d) * step;
      }
      c.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : dy > 0 ? 2 : 0;
      c.moving = true;
      continue;
    }
    c.moving = false;
    if (c.job) {
      if (!g.structs.get(c.job.at)) {
        c.job = null;
        continue;
      }
      c.working = true;
      c.t += dt;
      if (c.t >= c.job.dur) {
        finishJob(g, c);
        c.job = null;
        c.working = false;
      }
    }
  }
}

export { SOL_SECONDS };
