import { PLAYER_SPEED, PLAYER_RADIUS, REACH, VITALS, MINE_TIME, FOOD_VALUE, SOL_SECONDS, CROPS } from "../data/balance.js";
import { NODES, N, SHOVEL, CACHE_LOOT, isColdTerrain, T } from "../data/tiles.js";
import { itemById } from "../data/items.js";
import { structById } from "../data/structures.js";
import { blocksWalk, walkSpeedAt, nodeAt, structAt, terrainAt, setNode, inBounds } from "./world.js";
import { addTo, removeFrom, countIn, poolPay, poolMissing } from "./inventory.js";
import { roomAtTile, isBreathable } from "./rooms.js";
import { withRng, pushLog, alert, revealAround, removeStruct, placeStruct } from "./state.js";
import { isNight, hasEffect } from "./env.js";
import { withdrawWater, depositWater, structRoom } from "./systems.js";
import { nearbyPool } from "./building.js";

export const REPAIR_COST = {
  oxygenator: { circuit: 1 },
  reclaimer: { circuit: 1, plastic: 1 },
  airlock: { sealant: 1, metal: 1 },
  rover: { metal: 2, wire: 1 },
  crate: { metal: 1 },
  tank: { metal: 1, sealant: 1 },
  bunk: { metal: 1 },
  workbench: { scrap: 2 },
  heater: { metal: 1, wire: 1 },
  battery: { metal: 1, wire: 1 },
  default: { metal: 1, circuit: 1 },
};

export function selectedItem(g) {
  return g.s.inv[g.s.sel] ?? null;
}

export function playerTile(g) {
  return { x: Math.floor(g.s.player.x), y: Math.floor(g.s.player.y) };
}

export function playerRoom(g) {
  const p = g.s.player;
  if (p.inRover) return null;
  return roomAtTile(g, Math.floor(p.x), Math.floor(p.y));
}

export function isSheltered(g) {
  const p = g.s.player;
  if (p.inRover) return true;
  const t = playerTile(g);
  if (terrainAt(g, t.x, t.y) === T.TUBE) return true;
  const r = roomAtTile(g, t.x, t.y);
  return Boolean(r && r.sealed);
}

function collide(g, x, y) {
  const r = PLAYER_RADIUS;
  const pts = [[x - r, y - r], [x + r, y - r], [x - r, y + r], [x + r, y + r]];
  for (const [px, py] of pts) if (blocksWalk(g, Math.floor(px), Math.floor(py))) return true;
  return false;
}

export function tickPlayer(g, input, dt) {
  const s = g.s;
  const p = s.player;
  if (s.status !== "playing") return;
  if (p.sleeping) return;
  if (p.inRover) {
    return; // rover.js drives
  }
  // --- movement ---
  let mx = input.mx ?? 0;
  let my = input.my ?? 0;
  const len = Math.hypot(mx, my);
  if (len > 1) {
    mx /= len;
    my /= len;
  }
  const hungry = p.food <= 0 ? 0.7 : 1;
  const tx = Math.floor(p.x);
  const ty = Math.floor(p.y);
  const spd = PLAYER_SPEED * walkSpeedAt(g, tx, ty) * hungry;
  p.moving = len > 0.05;
  if (p.moving) {
    const nx = p.x + mx * spd * dt;
    const ny = p.y + my * spd * dt;
    if (!collide(g, nx, p.y)) p.x = nx;
    if (!collide(g, p.x, ny)) p.y = ny;
    if (Math.abs(mx) > Math.abs(my)) p.dir = mx > 0 ? 1 : 3;
    else p.dir = my > 0 ? 2 : 0;
    s.stats.distance += spd * dt;
    const ntx = Math.floor(p.x);
    const nty = Math.floor(p.y);
    if (ntx !== tx || nty !== ty) onEnterTile(g, ntx, nty);
  }
  // Aim direction follows the mouse if present.
  if (input.aim && !p.moving) {
    const dx = input.aim.x - p.x;
    const dy = input.aim.y - p.y;
    if (Math.abs(dx) > Math.abs(dy)) p.dir = dx > 0 ? 1 : 3;
    else p.dir = dy > 0 ? 2 : 0;
  }

  // --- tool use (held) ---
  if (input.use && input.aim) useTool(g, input.aim, dt);
  else p.mining = null;

  // --- pick up drops ---
  for (let i = s.drops.length - 1; i >= 0; i -= 1) {
    const d = s.drops[i];
    if (Math.abs(d.x - p.x) < 0.8 && Math.abs(d.y - p.y) < 0.8) {
      const left = addTo(s.inv, d.id, d.n);
      if (left < d.n) g.fx.push({ kind: "pickup", id: d.id, n: d.n - left });
      if (left <= 0) s.drops.splice(i, 1);
      else d.n = left;
    }
  }
}

function onEnterTile(g, x, y) {
  const s = g.s;
  const st = structAt(g, x, y);
  if (st && st.id === "airlock" && !st.broken) {
    st.wear = (st.wear ?? 0) + 1;
    g.fx.push({ kind: "airlock", x, y });
    if (st.wear >= 120) {
      const fail = withRng(g, "misc", (rng) => rng.chance(0.08));
      if (fail) {
        st.broken = true;
        g.dirtyRooms = true;
        pushLog(g, "The airlock seal gave out. That was the loudest silence I've ever heard.", "danger");
        alert(g, "AIRLOCK FAILURE — ROOM DECOMPRESSING", "danger", "airlock");
        g.fx.push({ kind: "blowout", x, y });
      }
    }
  }
  if (revealAround(g, x + 0.5, y + 0.5, 11)) g.fx.push({ kind: "reveal" });
  if (!s.story.flags.evaDone) {
    const r = roomAtTile(g, x, y);
    if (!r && !st) s.story.flags.evaDone = true;
  }
}

function inReach(g, ax, ay) {
  const p = g.s.player;
  return Math.hypot(ax + 0.5 - p.x, ay + 0.5 - p.y) <= REACH;
}

function drillTier(item) {
  const def = item && itemById(item.id);
  return def?.tool === "drill" ? def.tier : 0;
}

function giveOrDrop(g, id, n, x, y) {
  const left = addTo(g.s.inv, id, n);
  if (left < n) g.fx.push({ kind: "pickup", id, n: n - left });
  if (left > 0) g.s.drops.push({ x: x + 0.5, y: y + 0.5, id, n: left });
}

function useTool(g, aim, dt) {
  const s = g.s;
  const p = s.player;
  const item = selectedItem(g);
  const def = item && itemById(item.id);
  const ax = Math.floor(aim.x);
  const ay = Math.floor(aim.y);
  if (!def || !inBounds(g, ax, ay) || !inReach(g, ax, ay)) {
    p.mining = null;
    return;
  }
  const i = ay * g.world.w + ax;
  if (def.tool === "drill") {
    const n = nodeAt(g, ax, ay);
    if (!n || !NODES[n].drop && NODES[n].id !== N.MAV) {
      p.mining = null;
      return;
    }
    const nd = NODES[n];
    if (n === N.MAV) return;
    if (nd.tier > def.tier) {
      if (!p.mining || p.mining.i !== i) alert(g, `${nd.name.toUpperCase()} NEEDS A TIER ${nd.tier} DRILL`, "warn", "tier");
      p.mining = { i, t: 0, blocked: true };
      return;
    }
    if (!p.mining || p.mining.i !== i) p.mining = { i, t: 0 };
    p.mining.t += dt * (1 + (def.tier - 1) * 0.6);
    if (p.mining.t >= MINE_TIME) {
      p.mining.t = 0;
      g.world.nodeHp[i] = Math.max(0, g.world.nodeHp[i] - 1);
      g.fx.push({ kind: "hit", x: ax + 0.5, y: ay + 0.5, n });
      if (g.world.nodeHp[i] === 0) breakNode(g, ax, ay, n);
    }
    return;
  }
  if (def.tool === "shovel") {
    if (nodeAt(g, ax, ay) || structAt(g, ax, ay)) return;
    const yieldDef = SHOVEL[terrainAt(g, ax, ay)];
    if (!yieldDef) return;
    if (!p.mining || p.mining.i !== i) p.mining = { i, t: 0 };
    p.mining.t += dt;
    if (p.mining.t >= MINE_TIME * 1.4) {
      p.mining.t = 0;
      giveOrDrop(g, yieldDef.item, yieldDef.n, ax, ay);
      s.stats.mined += yieldDef.n;
      g.fx.push({ kind: "dig", x: ax + 0.5, y: ay + 0.5 });
    }
    return;
  }
  if (def.tool === "multitool") {
    const st = structAt(g, ax, ay);
    if (!st) {
      p.mining = null;
      return;
    }
    if (st.broken) return; // repair is an interaction (E) so it can't happen by accident
    if (!p.mining || p.mining.i !== i) p.mining = { i, t: 0, decon: true };
    p.mining.t += dt;
    if (p.mining.t >= 1.5) {
      p.mining = null;
      deconstruct(g, ax, ay);
    }
  }
}

function breakNode(g, x, y, n) {
  const s = g.s;
  const nd = NODES[n];
  if (nd.drop === "cache") {
    withRng(g, "misc", (rng) => {
      for (let k = 0; k < 3; k += 1) {
        const id = rng.weighted(CACHE_LOOT.map((l) => ({ id: l.id, weight: l.weight })));
        const l = CACHE_LOOT.find((c) => c.id === id);
        giveOrDrop(g, id, rng.int(l.n[0], l.n[1]), x, y);
      }
    });
    pushLog(g, "Cracked open a supply cache. Christmas on Mars.", "good");
    setNode(g, x, y, 0);
  } else {
    const count = withRng(g, "misc", (rng) => rng.int(nd.n[0], nd.n[1]));
    giveOrDrop(g, nd.drop, count, x, y);
    s.stats.mined += count;
    if (nd.drop === "scrap") s.story.flags.scrapTotal = (s.story.flags.scrapTotal ?? 0) + count;
    if (n === N.LANDER) {
      setNode(g, x, y, N.SCRAP);
      s.story.flags.antenna = true;
    } else {
      setNode(g, x, y, 0);
    }
    if (n === N.RTG) s.story.flags.rtg = true;
  }
  g.fx.push({ kind: "break", x: x + 0.5, y: y + 0.5, n });
}

export function deconstruct(g, x, y) {
  const st = structAt(g, x, y);
  if (!st) return false;
  const def = structById(st.id);
  removeStruct(g, x, y);
  // 50% refund, rounded up so single-item costs come back.
  for (const [id, n] of Object.entries(def.cost)) giveOrDrop(g, id, Math.ceil(n / 2), x, y);
  // Contents spill.
  if (st.items) for (const it of st.items) if (it) g.s.drops.push({ x: x + 0.5, y: y + 0.5, id: it.id, n: it.n });
  if (st.crop && st.crop.g >= 1 && !st.crop.dead) giveOrDrop(g, CROPS[st.crop.type].yield, 1, x, y);
  if (st.id === "lab" && st.samples) giveOrDrop(g, "sample", st.samples, x, y);
  if (st.id === "chem" && st.hyd) giveOrDrop(g, "hydrazine", st.hyd, x, y);
  if (st.id === "recycler" && st.compost) giveOrDrop(g, "compost", st.compost, x, y);
  if (st.id === "tank" && st.water > 0) pushLog(g, `Drained ${Math.round(st.water)} L onto the regolith. It's gone now.`, "bad");
  g.fx.push({ kind: "decon", x: x + 0.5, y: y + 0.5 });
  return true;
}

// ---- interaction (E) ----
// Returns an object the UI may act on (e.g. open a panel), or null.
export function interact(g, aim) {
  const s = g.s;
  const p = s.player;
  if (s.status !== "playing") return null;
  if (p.inRover) return { ui: "exitRover" };

  // Prefer the aimed tile; fall back to the tile the player faces.
  const facing = [[0, -1], [1, 0], [0, 1], [-1, 0]][p.dir];
  const candidates = [];
  if (aim) candidates.push({ x: Math.floor(aim.x), y: Math.floor(aim.y) });
  candidates.push({ x: Math.floor(p.x + facing[0] * 0.9), y: Math.floor(p.y + facing[1] * 0.9) });
  candidates.push({ x: Math.floor(p.x), y: Math.floor(p.y) });

  // Rover first if close.
  const rv = s.rover;
  if (Math.hypot(rv.x - p.x, rv.y - p.y) < 1.8) {
    if (rv.broken) return repair(g, null, "rover");
    p.inRover = true;
    p.x = rv.x;
    p.y = rv.y;
    g.fx.push({ kind: "rover-in" });
    return { ui: "enteredRover" };
  }

  for (const c of candidates) {
    if (!inReach(g, c.x, c.y)) continue;
    const st = structAt(g, c.x, c.y);
    if (st && st.id !== "floor" && st.id !== "wall" && st.id !== "cable") {
      const r = interactStruct(g, st);
      if (r) return r;
    }
    const n = nodeAt(g, c.x, c.y);
    if (n === N.MAV) return { ui: "mav" };
  }
  // Selected consumable: use it.
  const item = selectedItem(g);
  if (item) {
    const r = useItem(g, s.sel, aim);
    if (r) return r;
  }
  return null;
}

function interactStruct(g, st) {
  const s = g.s;
  const def = structById(st.id);
  const item = selectedItem(g);
  if (st.broken) return repair(g, st, st.id);
  switch (st.id) {
    case "solar":
      if ((st.dust ?? 0) > 0.02) {
        st.dust = 0;
        g.fx.push({ kind: "wipe", x: st.x + 0.5, y: st.y + 0.5 });
        s.stats.wiped = (s.stats.wiped ?? 0) + 1;
        return { msg: "Panel wiped clean." };
      }
      return { msg: "Panel is clean." };
    case "planter":
      return tendPlanter(g, st, item);
    case "tank": {
      if (countIn(s.inv, "ice") > 0) {
        const n = countIn(s.inv, "ice");
        let melted = 0;
        for (let k = 0; k < n; k += 1) {
          if (depositWater(g, 8) < 8) break;
          melted += 1;
        }
        removeFrom(s.inv, "ice", melted);
        return { msg: melted ? `Melted ${melted} ice into ${melted * 8} L.` : "Tanks are full." };
      }
      // Fill a water pouch
      if (st.water >= 2 && addTo(s.inv, "water", 1) === 0) {
        withdrawWater(g, 2);
        return { msg: "Filled a water pouch (2 L)." };
      }
      return { msg: `Tank: ${Math.round(st.water)} / ${def.water} L` };
    }
    case "chem": {
      const n = countIn(s.inv, "hydrazine");
      if (n) {
        removeFrom(s.inv, "hydrazine", n);
        st.hyd += n;
        return { msg: `Loaded ${n} hydrazine. Mind the oxygen.` };
      }
      return { msg: `Chem Station: ${st.hyd} hydrazine queued.` };
    }
    case "lab": {
      const n = countIn(s.inv, "sample");
      if (n) {
        removeFrom(s.inv, "sample", n);
        st.samples += n;
        return { msg: `Loaded ${n} samples.`, ui: s.research.current ? null : "research" };
      }
      return { ui: "research" };
    }
    case "recycler":
      if (st.compost > 0) {
        const got = st.compost - addTo(s.inv, "compost", st.compost);
        st.compost -= got;
        return { msg: `Collected ${got} compost.` };
      }
      return { msg: "Nothing to collect yet." };
    case "autominer": {
      let got = 0;
      for (let k = 0; k < st.items.length; k += 1) {
        const it = st.items[k];
        if (!it) continue;
        const left = addTo(s.inv, it.id, it.n);
        got += it.n - left;
        st.items[k] = left ? { id: it.id, n: left } : null;
      }
      return { msg: got ? `Collected ${got} items.` : "Hopper empty." };
    }
    case "algae":
      if (st.food > 0) {
        const got = st.food - addTo(s.inv, "lettuce", st.food);
        st.food -= got;
        return { msg: `Harvested ${got} algae greens.` };
      }
      return { msg: "Vat still growing." };
    case "crate":
      return { ui: "crate", at: st.y * g.world.w + st.x };
    case "workbench":
    case "smelter":
    case "fabricator":
      return { ui: "craft", station: st.id };
    case "comms":
      return { ui: "comms" };
    case "bunk":
      return trySleep(g, st);
    case "rtg":
    case "battery":
    case "reactor":
    case "heater":
    case "oxygenator":
    case "reclaimer":
    case "growlamp":
    case "lamp":
    case "airlock":
    case "pad":
      return { ui: "inspect", at: st.y * g.world.w + st.x };
    default:
      return null;
  }
}

function tendPlanter(g, st, item) {
  const s = g.s;
  const c = st.crop;
  if (c && c.dead) {
    st.crop = null;
    return { msg: "Cleared the dead crop." };
  }
  if (c && c.g >= 1) {
    const def = CROPS[c.type];
    const bonus = s.research.done.includes("fertilizer") ? 1 : 0;
    const n = withRng(g, "misc", (rng) => rng.int(def.yieldCount[0], def.yieldCount[1])) + bonus;
    giveOrDrop(g, def.yield, n, st.x, st.y);
    giveOrDrop(g, def.seed, def.seedBack, st.x, st.y);
    s.stats.harvested += n;
    st.crop = null;
    g.fx.push({ kind: "harvest", x: st.x + 0.5, y: st.y + 0.5 });
    return { msg: `Harvested ${n} ${itemById(def.yield).name.toLowerCase()}${n === 1 ? "" : "s"}.` };
  }
  if (c) return { msg: `${itemById(CROPS[c.type].yield).name}: ${Math.floor(c.g * 100)}% grown.`, ui: "inspect", at: st.y * g.world.w + st.x };
  // Plant: selected seed, else seed potatoes.
  const pool = nearbyPool(g);
  let seed = item && itemById(item.id)?.kind === "seed" ? item.id : null;
  if (!seed) seed = ["seed-potato", "seed-lettuce", "seed-beans"].find((id) => pool.some((sl) => countIn(sl, id) > 0)) ?? null;
  if (!seed) return { msg: "No seeds on you or in nearby crates." };
  poolPay(pool, { [seed]: 1 });
  st.crop = { type: itemById(seed).crop, g: 0, stress: 0, dead: false };
  s.stats.planted = (s.stats.planted ?? 0) + 1;
  g.fx.push({ kind: "plant", x: st.x + 0.5, y: st.y + 0.5 });
  return { msg: `Planted ${itemById(seed).name.toLowerCase()}.` };
}

export function repair(g, st, kind) {
  const s = g.s;
  const cost = REPAIR_COST[kind] ?? REPAIR_COST.default;
  const tool = selectedItem(g);
  if (!tool || tool.id !== "multitool") {
    if (countIn(s.inv, "multitool") === 0) return { msg: "You need the multitool to repair this." };
    // auto-switch to the multitool for convenience
    s.sel = s.inv.findIndex((v) => v && v.id === "multitool");
    if (s.sel >= 9) {
      const i = s.sel;
      const t = s.inv[0];
      s.inv[0] = s.inv[i];
      s.inv[i] = t;
      s.sel = 0;
    }
  }
  const pool = nearbyPool(g);
  if (!poolPay(pool, cost)) {
    const miss = poolMissing(pool, cost).map((m) => `${m.need - m.have} ${itemById(m.id).name}`).join(", ");
    return { msg: `Repair needs: ${miss}.`, bad: true };
  }
  if (kind === "rover") {
    s.rover.broken = false;
    s.story.flags.roverFixed = true;
    pushLog(g, "Rover repaired.", "good");
  } else {
    st.broken = false;
    if (st.wear !== undefined) st.wear = 0;
    g.dirtyRooms = true;
    s.story.flags[`fixed:${st.id}`] = true;
  }
  g.fx.push({ kind: "repair", x: (st?.x ?? s.rover.x) + 0.5, y: (st?.y ?? s.rover.y) + 0.5 });
  return { msg: `${kind === "rover" ? "Rover" : structById(st.id).name} repaired.`, good: true };
}

function trySleep(g, st) {
  const s = g.s;
  const room = structRoom(g, st);
  if (!isBreathable(room)) return { msg: "Can't sleep in a vacuum. Seal and pressurize the room first.", bad: true };
  if (!isNight(s.tick) && s.player.health > 60) return { msg: "Too bright to sleep. Come back at night." };
  s.player.sleeping = true;
  s.player.sleepStart = s.tick;
  return { ui: "sleep" };
}

// ---- consumables ----
export function useItem(g, slot, aim) {
  const s = g.s;
  const p = s.player;
  const it = s.inv[slot];
  if (!it) return null;
  const def = itemById(it.id);
  if (def.kind === "food") return eat(g, slot);
  if (it.id === "water") {
    if (p.water > 95) return { msg: "Not thirsty." };
    p.water = Math.min(VITALS.waterMax, p.water + def.drink);
    removeFrom(s.inv, "water", 1);
    g.s.waterUsed = (g.s.waterUsed ?? 0) + 2;
    return { msg: "Drank a water pouch." };
  }
  if (def.o2) {
    const max = maxO2(g);
    if (p.o2 > max - 5) return { msg: "Tank already full." };
    p.o2 = Math.min(max, p.o2 + def.o2);
    removeFrom(s.inv, it.id, 1);
    return { msg: "Swapped in an O₂ canister." };
  }
  if (def.heal) {
    if (p.health > 95) return { msg: "You're fine. Mostly." };
    p.health = Math.min(VITALS.healthMax, p.health + def.heal);
    removeFrom(s.inv, it.id, 1);
    return { msg: "Patched yourself up." };
  }
  if (def.patch) {
    if (p.integrity > 95) return { msg: "Suit is intact." };
    p.integrity = Math.min(VITALS.integrityMax, p.integrity + def.patch);
    removeFrom(s.inv, it.id, 1);
    return { msg: "Duct tape: the universal constant." };
  }
  if (def.charge) {
    p.power = Math.min(VITALS.powerMax, p.power + def.charge);
    removeFrom(s.inv, it.id, 1);
    return { msg: "Suit battery swapped." };
  }
  if (def.place === "beacon" && aim) {
    const x = Math.floor(aim.x);
    const y = Math.floor(aim.y);
    if (!inReach(g, x, y) || structAt(g, x, y) || blocksWalk(g, x, y)) return { msg: "Can't plant a beacon there." };
    placeStruct(g, x, y, "beacon");
    s.beacons.push({ x, y });
    removeFrom(s.inv, "beacon", 1);
    return { msg: "Beacon planted. It's on your map." };
  }
  if (def.tool === "scanner") return scan(g);
  return null;
}

export function scan(g) {
  const s = g.s;
  if ((s.player.scanCd ?? 0) > s.tick) return { msg: "Scanner recharging." };
  const r = s.research.done.includes("scanner2") ? 44 : 22;
  s.player.scanCd = s.tick + 20 * 4;
  revealAround(g, s.player.x, s.player.y, r);
  g.fx.push({ kind: "scan", x: s.player.x, y: s.player.y, r, until: s.tick + 20 * 25 });
  return { msg: "Scanner ping." };
}

export function eat(g, slot = null) {
  const s = g.s;
  const p = s.player;
  if (p.food > 95) return { msg: "Not hungry." };
  if (slot !== null) {
    const it = s.inv[slot];
    if (!it || itemById(it.id)?.kind !== "food") return { msg: "That's not food." };
    return consumeFood(g, [s.inv], it.id);
  }
  // Cheapest food that doesn't overshoot, from the suit first, then nearby crates.
  const pools = [[s.inv], nearbyPool(g).slice(1)];
  const order = ["lettuce", "potato", "beans", "ration"];
  for (const pool of pools) {
    for (const id of order) {
      if (pool.some((sl) => countIn(sl, id) > 0) && (p.food + FOOD_VALUE[id] <= 105 || id === "ration")) return consumeFood(g, pool, id);
    }
  }
  return { msg: "Nothing to eat." };
}

function consumeFood(g, pool, id) {
  const p = g.s.player;
  poolPay(pool, { [id]: 1 });
  p.food = Math.min(VITALS.foodMax, p.food + (FOOD_VALUE[id] ?? 10));
  g.s.stats.meals = (g.s.stats.meals ?? 0) + 1;
  g.fx.push({ kind: "eat", id });
  return { msg: `Ate ${itemById(id).name.toLowerCase()}.` };
}

export function maxO2(g) {
  return VITALS.o2Max * (g.s.research.done.includes("tank2") ? 1.6 : 1);
}

// ---- vitals per tick ----
export function tickVitals(g, dt) {
  const s = g.s;
  const p = s.player;
  if (s.status !== "playing") return;
  const t = playerTile(g);
  const room = p.inRover ? null : roomAtTile(g, t.x, t.y);
  const breathable = isBreathable(room);
  const cold = isColdTerrain(terrainAt(g, t.x, t.y));
  const night = isNight(s.tick);
  const o2Max = maxO2(g);

  // Oxygen
  if (p.inRover) {
    p.o2 = Math.min(o2Max, p.o2 + 2 * dt);
  } else if (breathable) {
    p.o2 = Math.min(o2Max, p.o2 + VITALS.o2RefillInside * dt);
  } else {
    const leak = p.integrity < 30 ? 3 : 1;
    p.o2 = Math.max(0, p.o2 - VITALS.o2DrainOutside * leak * dt);
  }
  // Suit power
  const grid = room ? gridForRoom(g, room) : null;
  if (p.inRover && s.rover.battery > 0) {
    p.power = Math.min(VITALS.powerMax, p.power + VITALS.powerRecharge * dt);
  } else if (room && room.sealed && grid && (grid.stored > 1 || grid.gen > 0.2)) {
    p.power = Math.min(VITALS.powerMax, p.power + VITALS.powerRecharge * dt);
  } else if (!room || !room.sealed) {
    let drain = night ? VITALS.powerDrainNight : VITALS.powerDrainDay;
    if (cold) drain += VITALS.powerDrainCold;
    p.power = Math.max(0, p.power - drain * dt);
  }
  // Food & water
  p.food = Math.max(0, p.food - VITALS.foodDrain * dt);
  const beforeW = p.water;
  p.water = Math.max(0, p.water - VITALS.waterDrain * dt);
  if (breathable && p.water < 97) {
    // Drink from the tanks while indoors (0.03 L per point).
    const want = Math.min(97 - p.water, 6 * dt);
    const got = withdrawWater(g, want * 0.03);
    p.water += got / 0.03;
    g.s.waterUsed = (g.s.waterUsed ?? 0) + got;
  }
  void beforeW;

  // Auto-eat / auto-drink
  if (s.autoEat) {
    if (p.food < 25) eat(g);
    if (p.water < 25 && countIn(s.inv, "water") > 0) useItem(g, s.inv.findIndex((v) => v && v.id === "water"));
  }

  // Damage & regen
  let dmg = 0;
  let cause = null;
  if (p.o2 <= 0) {
    dmg += VITALS.suffocateDmg;
    cause = "suffocation";
  }
  if (p.power <= 0 && (night || cold) && !breathable) {
    dmg += VITALS.coldDmg;
    cause = cause ?? "hypothermia";
  }
  if (p.food <= 0) {
    dmg += VITALS.starveDmg;
    cause = cause ?? "starvation";
  }
  if (p.water <= 0) {
    dmg += VITALS.thirstDmg;
    cause = cause ?? "dehydration";
  }
  if (hasEffect(g, "spe") && !isSheltered(g)) {
    dmg += s.research.done.includes("rad-shield") ? 0.15 : 0.5;
    cause = cause ?? "radiation";
  }
  if (dmg > 0) {
    p.health = Math.max(0, p.health - dmg * dt);
    p.damageTag = cause;
    s.sustain.badSol = true;
  } else if (breathable && p.food > 30 && p.water > 30) {
    p.health = Math.min(VITALS.healthMax, p.health + VITALS.regenRest * dt * 0.3);
  }
  if (p.health <= 0) {
    s.status = "dead";
    s.stats.deaths += 1;
    s.deathCause = p.damageTag ?? "unknown";
    pushLog(g, `Commander lost to ${s.deathCause}.`, "danger");
  }
}

export function gridForRoom(g, room) {
  if (!g.grids || !room?.tiles.length) return null;
  for (const t of room.tiles) {
    const st = g.structs.get(t);
    if (st && st.grid !== undefined) return g.grids[st.grid] ?? null;
  }
  return null;
}

export { SOL_SECONDS };
