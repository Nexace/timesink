import { EVENTS, eventById, eventsPerSol } from "../data/events.js";
import { SOL_TICKS, DAWN, TICK_RATE } from "../data/balance.js";
import { structById } from "../data/structures.js";
import { N, T, TERRAIN } from "../data/tiles.js";
import { MANIFESTS } from "../data/story.js";
import { withRng, pushLog, alert, removeStruct, placeStruct, revealAround, solOf } from "./state.js";
import { structAt, nodeAt, setNode, terrainAt, setTerrain, inBounds } from "./world.js";
import { addTo } from "./inventory.js";

export function solStartTick(sol) {
  return Math.round((sol - 1 + DAWN) * SOL_TICKS);
}

function baseCenter(g) {
  let sx = 0;
  let sy = 0;
  let n = 0;
  for (const st of g.structs.values()) {
    if (st.id === "beacon" || st.id === "cable") continue;
    sx += st.x;
    sy += st.y;
    n += 1;
  }
  if (!n) return { x: g.world.start.x, y: g.world.start.y };
  return { x: Math.round(sx / n), y: Math.round(sy / n) };
}

export function rollSolEvents(g, sol) {
  const s = g.s;
  const start = solStartTick(sol);
  withRng(g, "events", (rng) => {
    const rate = eventsPerSol(sol) * (s.mode === "campaign" && sol < 3 ? 0.4 : 1);
    let count = Math.floor(rate) + (rng.chance(rate % 1) ? 1 : 0);
    const stormActive = s.events.active.some((e) => e.id === "dust-storm") || s.events.scheduled.some((e) => e.id === "dust-storm");
    const eligible = EVENTS.filter((e) => sol >= e.minSol && (!e.requiresComms || s.story.flags.comms) && !(e.id === "dust-storm" && stormActive));
    while (count-- > 0 && eligible.length) {
      const id = rng.weighted(eligible.map((e) => ({ id: e.id, weight: e.weight })));
      const def = eventById(id);
      const ev = { id, at: 0, warnAt: 0, warned: false };
      if (id === "dust-storm") {
        ev.at = solStartTick(sol + 1) + rng.int(0, Math.floor(SOL_TICKS * 0.2));
        ev.warnAt = start + rng.int(0, Math.floor(SOL_TICKS * 0.3));
        ev.dur = rng.int(def.durSols[0], def.durSols[1]) * SOL_TICKS;
      } else {
        ev.at = start + rng.int(Math.floor(SOL_TICKS * 0.08), Math.floor(SOL_TICKS * 0.85));
        ev.warnAt = def.warn ? ev.at - def.warn * TICK_RATE : ev.at;
        if (def.dur) ev.dur = def.dur * TICK_RATE;
      }
      if (id === "meteor") {
        const c = baseCenter(g);
        ev.x = c.x + rng.int(-7, 7);
        ev.y = c.y + rng.int(-7, 7);
      }
      if (id === "dust-devil") {
        const c = baseCenter(g);
        const a = rng.float(0, Math.PI * 2);
        ev.x = Math.round(c.x + Math.cos(a) * rng.float(3, 12));
        ev.y = Math.round(c.y + Math.sin(a) * rng.float(3, 12));
      }
      s.events.scheduled.push(ev);
      if (id === "dust-storm") eligible.splice(eligible.findIndex((e) => e.id === "dust-storm"), 1);
    }
  });
}

export function tickEvents(g) {
  const s = g.s;
  const now = s.tick;
  for (const ev of s.events.scheduled) {
    if (!ev.warned && now >= ev.warnAt && ev.warnAt < ev.at) {
      ev.warned = true;
      warn(g, ev);
    }
  }
  const due = s.events.scheduled.filter((e) => now >= e.at);
  if (due.length) {
    s.events.scheduled = s.events.scheduled.filter((e) => now < e.at);
    for (const ev of due) fire(g, ev);
  }
  const ended = s.events.active.filter((e) => now >= e.until);
  if (ended.length) {
    s.events.active = s.events.active.filter((e) => now < e.until);
    for (const e of ended) {
      const def = eventById(e.id);
      pushLog(g, `${def.name} has passed.`, "info");
      alert(g, `${def.name.toUpperCase()} HAS PASSED`, "good");
    }
  }
  // Supply drops
  const orders = s.orders.filter((o) => now >= o.at);
  if (orders.length) {
    s.orders = s.orders.filter((o) => now < o.at);
    for (const o of orders) deliver(g, o);
  }
}

function warn(g, ev) {
  const def = eventById(ev.id);
  const secs = Math.max(1, Math.round((ev.at - g.s.tick) / TICK_RATE));
  if (ev.id === "dust-storm") {
    pushLog(g, "Weather station: a dust storm front will arrive next sol. Charge the batteries.", "bad");
    alert(g, "STORM WARNING — DUST STORM NEXT SOL", "warn", "storm-warn");
  } else if (ev.id === "meteor") {
    pushLog(g, `Meteor shower incoming in ${secs}s. Impact zone marked.`, "bad");
    alert(g, `METEOR SHOWER IN ${secs}s — CLEAR THE MARKED ZONE`, "danger", "meteor");
  } else if (ev.id === "spe") {
    pushLog(g, `Solar particle event in ${secs}s. Get inside a sealed room, the rover, or a lava tube.`, "bad");
    alert(g, `RADIATION STORM IN ${secs}s — TAKE SHELTER`, "danger", "spe");
  } else {
    alert(g, `${def.name.toUpperCase()} INBOUND`, "warn");
  }
}

function fire(g, ev) {
  const s = g.s;
  const def = eventById(ev.id);
  s.stats.events += 1;
  g.fx.push({ kind: "event", id: ev.id, x: ev.x, y: ev.y });
  switch (ev.id) {
    case "dust-storm":
      s.events.active.push({ id: ev.id, until: s.tick + ev.dur });
      pushLog(g, "The dust storm hits. Visibility near zero, solar output down to 30%.", "bad");
      alert(g, "DUST STORM — SOLAR AT 30%", "danger", "storm");
      break;
    case "spe":
      s.events.active.push({ id: ev.id, until: s.tick + ev.dur });
      alert(g, "RADIATION STORM ACTIVE — STAY SHELTERED", "danger", "spe");
      break;
    case "meteor":
      meteor(g, ev);
      break;
    case "failure":
      failure(g);
      break;
    case "dust-devil":
      dustDevil(g, ev);
      break;
    case "ice-pocket":
      icePocket(g);
      break;
    case "orbiter-pass":
      orbiterPass(g);
      break;
    default:
      pushLog(g, def.name, def.kind === "good" ? "good" : "bad");
  }
}

function meteor(g, ev) {
  const s = g.s;
  const p = s.player;
  let hits = 0;
  withRng(g, "events", (rng) => {
    const impacts = rng.int(3, 5);
    for (let k = 0; k < impacts; k += 1) {
      const x = ev.x + rng.int(-4, 4);
      const y = ev.y + rng.int(-4, 4);
      if (!inBounds(g, x, y)) continue;
      g.fx.push({ kind: "impact", x: x + 0.5, y: y + 0.5 });
      const st = structAt(g, x, y);
      if (st) {
        const def = structById(st.id);
        if (def.armored) continue;
        hits += 1;
        const fragile = def.seals || def.floor || def.conduit || def.solar || def.pad || def.beacon || st.id === "lamp";
        if (fragile) {
          removeStruct(g, x, y);
          s.drops.push({ x: x + 0.5, y: y + 0.5, id: "scrap", n: 1 });
        } else if (st.crop) {
          st.crop.dead = true;
        } else {
          st.broken = true; // machines, crates and tanks get knocked out, not vaporized
        }
      } else if (!nodeAt(g, x, y) && !TERRAIN[terrainAt(g, x, y)].solid) {
        if (rng.chance(0.3)) setNode(g, x, y, N.IRON);
        else setTerrain(g, x, y, T.CRATER);
      }
      if (!p.inRover && Math.hypot(p.x - x - 0.5, p.y - y - 0.5) < 1.4) {
        p.health = Math.max(0, p.health - 30);
        p.integrity = Math.max(0, p.integrity - 35);
        p.damageTag = "meteor strike";
      }
      for (const c of s.colonists) {
        if (c.alive && Math.hypot(c.x - x - 0.5, c.y - y - 0.5) < 1.4) c.health -= 40;
      }
    }
  });
  pushLog(g, hits ? `Meteor shower. ${hits} structure${hits === 1 ? "" : "s"} destroyed.` : "Meteor shower passed. Nothing important got hit. This time.", hits ? "danger" : "bad");
  alert(g, hits ? `IMPACT — ${hits} STRUCTURE${hits === 1 ? "" : "S"} LOST` : "METEORS MISSED THE BASE", hits ? "danger" : "warn");
}

function failure(g) {
  const s = g.s;
  const candidates = [...g.structs.values()].filter((st) => {
    const def = structById(st.id);
    return !st.broken && (def.power < 0 || def.store) && st.id !== "airlock" && st.id !== "lamp";
  });
  if (!candidates.length) return;
  const st = withRng(g, "events", (rng) => rng.pick(candidates));
  st.broken = true;
  const name = structById(st.id).name;
  pushLog(g, `${name} failure. Grab the multitool.`, "bad");
  alert(g, `${name.toUpperCase()} FAILED — REPAIR WITH MULTITOOL`, "danger", "failure");
  void s;
}

function dustDevil(g, ev) {
  let cleaned = 0;
  let broken = 0;
  withRng(g, "events", (rng) => {
    for (const st of g.structs.values()) {
      if (st.id !== "solar") continue;
      if (Math.hypot(st.x - ev.x, st.y - ev.y) > 10) continue;
      st.dust = 0;
      cleaned += 1;
      if (rng.chance(0.08)) {
        st.broken = true;
        broken += 1;
      }
    }
  });
  pushLog(g, cleaned ? `A dust devil swept through and cleaned ${cleaned} panel${cleaned === 1 ? "" : "s"}${broken ? `, but knocked ${broken} out` : ""}. Thanks, Mars.` : "A dust devil danced past the base.", cleaned ? "good" : "info");
  alert(g, cleaned ? `DUST DEVIL — ${cleaned} PANELS SCOURED CLEAN` : "DUST DEVIL NEARBY", cleaned ? "good" : "info");
}

function icePocket(g) {
  const c = baseCenter(g);
  let placed = 0;
  let px = 0;
  let py = 0;
  withRng(g, "events", (rng) => {
    const a = rng.float(0, Math.PI * 2);
    const d = rng.float(16, 28);
    px = Math.round(c.x + Math.cos(a) * d);
    py = Math.round(c.y + Math.sin(a) * d);
    for (let k = 0; k < 12 && placed < 5; k += 1) {
      const x = px + rng.int(-2, 2);
      const y = py + rng.int(-2, 2);
      if (!inBounds(g, x, y) || nodeAt(g, x, y) || structAt(g, x, y) || TERRAIN[terrainAt(g, x, y)].solid) continue;
      setNode(g, x, y, N.ICE);
      placed += 1;
    }
  });
  revealAround(g, px, py, 4);
  g.s.beacons.push({ x: px, y: py, label: "ICE" });
  pushLog(g, "Ground-penetrating radar found a shallow ice pocket. Marked on the map.", "good");
  alert(g, "ICE POCKET FOUND — MARKED ON MAP", "good");
}

function orbiterPass(g) {
  const hidden = g.world.pois.filter((p) => !g.explored[p.y * g.world.w + p.x]);
  const target = hidden.length ? withRng(g, "events", (rng) => rng.pick(hidden)) : null;
  if (target) {
    revealAround(g, target.x, target.y, 18);
    pushLog(g, `TETHYS orbiter imaged the ${target.name}. Map updated.`, "good");
  } else {
    const p = g.s.player;
    revealAround(g, p.x, p.y, 40);
    pushLog(g, "TETHYS orbiter pass: local map refreshed.", "good");
  }
  g.fx.push({ kind: "reveal" });
  alert(g, "ORBITER PASS — MAP UPDATED", "good");
}

// ---- supply drops ----
export function orderDrop(g, manifestId) {
  const s = g.s;
  const m = MANIFESTS.find((x) => x.id === manifestId);
  if (!m) return { ok: false, reason: "Unknown manifest." };
  if (!s.story.flags.comms) return { ok: false, reason: "No comms link." };
  if (s.credits < m.cost) return { ok: false, reason: "Not enough credits." };
  s.credits -= m.cost;
  s.orders.push({ at: s.tick + Math.floor(SOL_TICKS * 0.5), manifest: m.id });
  pushLog(g, `Ordered a ${m.name}. ETA half a sol.`, "info");
  return { ok: true };
}

export function freeTileNear(g, cx, cy, maxR = 8, pred = null) {
  for (let r = 0; r <= maxR; r += 1) {
    for (let dy = -r; dy <= r; dy += 1) {
      for (let dx = -r; dx <= r; dx += 1) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const x = cx + dx;
        const y = cy + dy;
        if (!inBounds(g, x, y) || structAt(g, x, y) || nodeAt(g, x, y) || TERRAIN[terrainAt(g, x, y)].solid) continue;
        if (pred && !pred(x, y)) continue;
        return { x, y };
      }
    }
  }
  return null;
}

function deliver(g, o) {
  const m = MANIFESTS.find((x) => x.id === o.manifest);
  if (!m) return;
  const pad = [...g.structs.values()].find((st) => st.id === "pad");
  const c = pad ?? g.world.start;
  const spot = freeTileNear(g, c.x, c.y + (pad ? 0 : 7), 10);
  if (!spot) return;
  const crate = placeStruct(g, spot.x, spot.y, "crate");
  for (const [id, n] of Object.entries(m.items)) addTo(crate.items, id, n);
  g.fx.push({ kind: "drop", x: spot.x + 0.5, y: spot.y + 0.5 });
  g.s.beacons.push({ x: spot.x, y: spot.y, label: "DROP" });
  pushLog(g, `Supply drop landed: ${m.name}. It's in a crate by the ${pad ? "pad" : "hab"}.`, "good");
  alert(g, `SUPPLY DROP LANDED — ${m.name.toUpperCase()}`, "good");
}

export { solOf };
