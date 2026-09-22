import { structById } from "../data/structures.js";
import { ROOM, SOL_SECONDS, CROPS, DUST_PER_SOL } from "../data/balance.js";
import { NODES } from "../data/tiles.js";
import { researchById } from "../data/research.js";
import { computeRooms, roomAtTile } from "./rooms.js";
import { computeGrids, updatePower } from "./power.js";
import { outsideTemp, daylight, isNight, hasEffect } from "./env.js";
import { addTo, countIn } from "./inventory.js";
import { withRng, pushLog, alert, removeStruct } from "./state.js";
import { nodeAt, setNode } from "./world.js";

export function ensureDerived(g) {
  if (g.dirtyRooms || !g.rooms) computeRooms(g, outsideTemp(g.s.tick));
  if (g.dirtyGrids || !g.grids) computeGrids(g);
}

export function structRoom(g, st) {
  return roomAtTile(g, st.x, st.y);
}

function isActive(g) {
  const night = isNight(g.s.tick);
  return (st, def) => {
    const room = def.interior ? structRoom(g, st) : null;
    if (def.interior && !room) return false;
    switch (st.id) {
      case "oxygenator":
      case "algae":
        return room.o2 < 0.999;
      case "heater":
        return room.temp < ROOM.thermostat;
      case "smelter":
      case "fabricator":
        return Boolean(st.busy);
      case "lab":
        return st.samples > 0 && Boolean(g.s.research.current);
      case "chem":
        return st.hyd > 0;
      case "autominer":
        return Boolean(adjacentNode(g, st)) && freeSlots(st.items) > 0;
      case "lamp":
        return night;
      default:
        return true;
    }
  };
}

function freeSlots(items) {
  return items ? items.filter((v) => !v).length : 0;
}

export function adjacentNode(g, st) {
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const n = nodeAt(g, st.x + dx, st.y + dy);
    if (n && NODES[n].drop && !NODES[n].unique && NODES[n].drop !== "cache") return { x: st.x + dx, y: st.y + dy, n };
  }
  return null;
}

// ---- water ----
export function tanks(g) {
  const out = [];
  for (const st of g.structs.values()) if (st.id === "tank") out.push(st);
  return out;
}
export function waterTotal(g) {
  let t = 0;
  let cap = 0;
  for (const st of tanks(g)) {
    t += st.water;
    cap += structById("tank").water;
  }
  return { total: t, cap };
}
export function withdrawWater(g, liters) {
  let left = liters;
  for (const st of tanks(g)) {
    const take = Math.min(st.water, left);
    st.water -= take;
    left -= take;
    if (left <= 1e-9) break;
  }
  return liters - left;
}
export function depositWater(g, liters) {
  let left = liters;
  const cap = structById("tank").water;
  for (const st of tanks(g)) {
    const add = Math.min(cap - st.water, left);
    st.water += add;
    left -= add;
    if (left <= 1e-9) break;
  }
  return liters - left;
}

export function reclaimRate(g) {
  let n = 0;
  for (const st of g.structs.values()) if (st.id === "reclaimer" && st.powered && !st.broken) n += 1;
  if (!n) return { rate: 0, capacity: 0 };
  return { rate: g.s.research.done.includes("reclaim95") ? 0.95 : 0.9, capacity: n * 6 };
}

// The colony's crew count (player + colonists).
export function crewCount(g) {
  return 1 + g.s.colonists.filter((c) => c.alive).length;
}

// ---- once-per-second systems ----
export function updateSystems(g, dt) {
  ensureDerived(g);
  const s = g.s;
  const outT = outsideTemp(s.tick);

  updatePower(g, dt, isActive(g));

  // People per room.
  for (const r of g.rooms) r.people = 0;
  const p = s.player;
  if (!p.inRover && s.status === "playing") {
    const r = roomAtTile(g, Math.floor(p.x), Math.floor(p.y));
    if (r) r.people += 1;
  }
  for (const c of s.colonists) {
    if (!c.alive) continue;
    const r = roomAtTile(g, Math.floor(c.x), Math.floor(c.y));
    if (r) r.people += 1;
  }

  // Heat & O2 sources per room.
  const oxyBoost = s.research.done.includes("oxy2") ? 1.5 : 1;
  const insul = s.research.done.includes("insulation") ? 0.5 : 1;
  for (const r of g.rooms) {
    r.prod = 0;
    r.heat = r.people * 0.4;
  }
  const lamps = [];
  for (const st of g.structs.values()) {
    const def = structById(st.id);
    const r = structRoom(g, st);
    if (st.id === "growlamp" && st.powered) lamps.push(st);
    if (!r) continue;
    if (def.o2 && st.powered && !st.broken) r.prod += ROOM.oxyUnits * (def.o2 / 0.9) * oxyBoost;
    if (def.heat && st.id !== "rtg" && st.powered && !st.broken) r.heat += def.heat;
    if (st.id === "rtg" && !st.broken) r.heat += def.heat;
    if (def.power < 0 && st.powered) r.heat += 0.2;
  }
  for (const r of g.rooms) {
    const n = r.tiles.length;
    if (!r.sealed) {
      r.o2 = Math.max(0, r.o2 - ROOM.decompress * dt);
      r.temp += (outT - r.temp) * Math.min(1, 0.2 * dt);
      continue;
    }
    const cons = r.people * ROOM.personUnits + n * ROOM.seepUnits;
    r.o2 = Math.min(1, Math.max(0, r.o2 + ((r.prod - cons) / n) * dt));
    const dT = r.heat / n - ROOM.loss * insul * (r.temp - outT) * (4 / Math.sqrt(n));
    r.temp += dT * dt;
  }

  // Solar dust.
  const dustRate = (DUST_PER_SOL / SOL_SECONDS) * (hasEffect(g, "dust-storm") ? 5 : 1);
  for (const st of g.structs.values()) if (st.id === "solar") st.dust = Math.min(1, (st.dust ?? 0) + dustRate * dt);

  // Water: crew drinking is handled in vitals/colonists and reclaimed here from the per-second tally.
  const used = s.waterUsed ?? 0;
  s.waterUsed = 0;
  if (used > 0) {
    const { rate, capacity } = reclaimRate(g);
    const share = Math.min(1, capacity / Math.max(1, crewCount(g)));
    depositWater(g, used * rate * share);
  }

  updateMachines(g, dt, lamps);
  updateCrops(g, dt, lamps);
  s.story.flags.comms = [...g.structs.values()].some((st) => st.id === "comms" && st.powered);

  // Sustain tracking: any life-support brownout on a grid that holds people breaks the streak.
  for (const grid of g.grids) if (grid.lifeBrownout) s.sustain.badSol = true;
}

function updateMachines(g, dt, _lamps) {
  const s = g.s;
  for (const st of [...g.structs.values()]) {
    if (st.broken || !st.powered) continue;
    switch (st.id) {
      case "recycler": {
        st.t += (dt * crewCount(g)) / (SOL_SECONDS * 0.5);
        while (st.t >= 1) {
          st.t -= 1;
          st.compost = Math.min(20, st.compost + 1);
        }
        break;
      }
      case "lab": {
        const res = researchById(s.research.current);
        if (!res) break;
        const staff = s.colonists.some((c) => c.alive && c.job?.kind === "lab" && c.job.at === st.y * g.world.w + st.x && c.working) ? 1 : 0;
        st.t += (dt * (1 + staff)) / 40;
        if (st.t >= 1) {
          st.t -= 1;
          st.samples -= 1;
          s.research.progress += 10;
          s.research.rp += 10;
          if (s.story.flags.comms) s.credits += 4;
          if (s.research.progress >= res.cost) completeResearch(g, res);
        }
        break;
      }
      case "chem": {
        st.t += dt / 30;
        if (st.t >= 1) {
          st.t -= 1;
          st.hyd -= 1;
          depositWater(g, 6);
          const room = structRoom(g, st);
          const risk = room ? Math.max(0, room.o2 - 0.35) * 0.8 : 0;
          const boom = withRng(g, "misc", (rng) => rng.chance(risk));
          if (boom) explode(g, st);
        }
        break;
      }
      case "autominer": {
        st.t += dt / 15;
        if (st.t >= 1) {
          st.t -= 1;
          const nd = adjacentNode(g, st);
          if (nd) {
            const i = nd.y * g.world.w + nd.x;
            g.world.nodeHp[i] = Math.max(0, g.world.nodeHp[i] - 1);
            if (g.world.nodeHp[i] === 0) {
              const def = NODES[nd.n];
              const count = withRng(g, "misc", (rng) => rng.int(def.n[0], def.n[1]));
              addTo(st.items, def.drop, count);
              setNode(g, nd.x, nd.y, 0);
            }
          }
        }
        break;
      }
      case "algae": {
        st.t += dt / (SOL_SECONDS / 3);
        if (st.t >= 1) {
          st.t -= 1;
          st.food = Math.min(10, (st.food ?? 0) + 1);
        }
        break;
      }
      default:
        break;
    }
  }
}

export function completeResearch(g, res) {
  const s = g.s;
  s.research.done.push(res.id);
  s.research.current = null;
  s.research.progress = 0;
  s.stats.research += 1;
  pushLog(g, `Research complete: ${res.name}. ${res.desc}`, "good");
  alert(g, `RESEARCH COMPLETE — ${res.name.toUpperCase()}`, "good");
  if (res.id === "lettuce") addTo(s.inv, "seed-lettuce", 5);
  if (res.id === "beans") addTo(s.inv, "seed-beans", 5);
  g.fx.push({ kind: "research", id: res.id });
}

function explode(g, st) {
  const s = g.s;
  pushLog(g, "The Chem Station exploded. Note to self: hydrazine and oxygen are not friends.", "danger");
  alert(g, "EXPLOSION — CHEM STATION", "danger");
  g.fx.push({ kind: "explosion", x: st.x + 0.5, y: st.y + 0.5 });
  removeStruct(g, st.x, st.y);
  // Blow out up to two neighbouring pressure walls.
  const around = [];
  for (let dy = -2; dy <= 2; dy += 1) {
    for (let dx = -2; dx <= 2; dx += 1) {
      const n = g.structs.get((st.y + dy) * g.world.w + st.x + dx);
      if (n && structById(n.id).seals && !structById(n.id).armored) around.push(n);
    }
  }
  withRng(g, "misc", (rng) => {
    const picks = rng.shuffle(around).slice(0, 2);
    for (const w of picks) removeStruct(g, w.x, w.y);
  });
  const p = s.player;
  if (Math.hypot(p.x - st.x - 0.5, p.y - st.y - 0.5) < 4) {
    p.health = Math.max(0, p.health - 35);
    p.integrity = Math.max(0, p.integrity - 30);
    p.damageTag = "explosion";
  }
}

function lit(g, st, lamps) {
  const room = structRoom(g, st);
  if (room?.glass && daylight(g.s.tick) > 0.1) return true;
  for (const l of lamps) if (Math.max(Math.abs(l.x - st.x), Math.abs(l.y - st.y)) <= 3) return true;
  return false;
}

export function cropStatus(g, st, lamps = null) {
  if (!st.crop) return null;
  const room = structRoom(g, st);
  const lampList = lamps ?? [...g.structs.values()].filter((x) => x.id === "growlamp" && x.powered);
  return {
    sealed: Boolean(room && room.sealed),
    warm: Boolean(room && room.temp >= 5),
    lit: lit(g, st, lampList),
    water: waterTotal(g).total > 0.1,
  };
}

function updateCrops(g, dt, lamps) {
  const s = g.s;
  const speed = s.research.done.includes("hydroponics") ? 1.35 : 1;
  for (const st of g.structs.values()) {
    if (st.id !== "planter" || !st.crop || st.crop.dead) continue;
    const c = st.crop;
    const def = CROPS[c.type];
    const room = structRoom(g, st);
    const hostile = !room || !room.sealed || room.temp < ROOM.freeze;
    // Freshly planted seeds just lie dormant in bad conditions; sprouted plants suffer.
    if (hostile && c.g < 0.05) continue;
    if (hostile) {
      c.stress = (c.stress ?? 0) + dt;
      if (c.stress > (room && room.sealed ? 90 : 30)) {
        c.dead = true;
        pushLog(g, `A ${c.type} crop died — ${!room || !room.sealed ? "the room lost pressure" : "it froze"}.`, "bad");
        alert(g, "CROP LOST", "bad");
      }
      continue;
    }
    c.stress = Math.max(0, (c.stress ?? 0) - dt * 0.5);
    if (c.g >= 1) continue;
    const st2 = cropStatus(g, st, lamps);
    if (!st2.lit || !st2.warm) continue;
    const need = (def.water / SOL_SECONDS) * dt;
    if (withdrawWater(g, need) < need * 0.99) continue;
    c.g = Math.min(1, c.g + (dt / (def.growSols * SOL_SECONDS)) * speed);
  }
}

// Counts food items in all crates (the colony pantry).
export function pantry(g) {
  let n = 0;
  for (const st of g.structs.values()) {
    if (!st.items || st.id !== "crate") continue;
    for (const id of ["ration", "potato", "lettuce", "beans"]) n += countIn(st.items, id);
  }
  return n;
}
