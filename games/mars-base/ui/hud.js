import { escapeHtml } from "../../../shared/shell.js";
import { itemById } from "../data/items.js";
import { structById } from "../data/structures.js";
import { NODES, TERRAIN } from "../data/tiles.js";
import { ACTS } from "../data/story.js";
import { CROPS } from "../data/balance.js";
import { itemIconURL } from "../render/sprites.js";
import { solOf } from "../sim/state.js";
import { clockText, isNight, hasEffect } from "../sim/env.js";
import { roomAtTile } from "../sim/rooms.js";
import { maxO2, playerRoom, gridForRoom, REPAIR_COST } from "../sim/player.js";
import { waterTotal, pantry, cropStatus, adjacentNode } from "../sim/systems.js";
import { currentObjective, objectiveProgress } from "../sim/story.js";
import { aliveColonists, housingFree } from "../sim/colonists.js";
import { eventById } from "../data/events.js";
import { structAt, nodeAt, terrainAt, inBounds } from "../sim/world.js";
import { ROVER } from "../sim/rover.js";

const VITALS = [
  { id: "o2", label: "O₂", color: "var(--mb-o2)", warn: "LOW OXYGEN" },
  { id: "power", label: "PWR", color: "var(--mb-power)", warn: "SUIT BATTERY LOW" },
  { id: "food", label: "FOOD", color: "var(--mb-food)", warn: "STARVING" },
  { id: "water", label: "H₂O", color: "var(--mb-water)", warn: "DEHYDRATED" },
  { id: "health", label: "HP", color: "var(--mb-health)", warn: "CRITICAL" },
  { id: "integrity", label: "SUIT", color: "var(--mb-suit)", warn: "SUIT BREACH — TAPE IT" },
];

export function createHud(root) {
  const el = (id) => root.querySelector(`#${id}`);
  const refs = { vitals: {} };
  const vitalsHost = el("hud-vitals");
  vitalsHost.classList.add("hud-box");
  vitalsHost.innerHTML =
    VITALS.map(
      (v) => `<div class="vital" data-v="${v.id}" style="--vc:${v.color}">
        <span class="vital__label">${v.label}</span>
        <span class="vital__bar" role="meter" aria-label="${v.label}" aria-valuemin="0" aria-valuemax="100"><span class="vital__fill"></span></span>
        <span class="vital__num">0</span>
        <span class="vital__warn">${v.warn}</span>
      </div>`,
    ).join("") + `<div class="hud-status-line" id="hud-status"></div>`;
  for (const v of VITALS) {
    const node = vitalsHost.querySelector(`[data-v="${v.id}"]`);
    refs.vitals[v.id] = { node, fill: node.querySelector(".vital__fill"), num: node.querySelector(".vital__num"), bar: node.querySelector(".vital__bar") };
  }
  el("hud-objective").classList.add("hud-box");
  el("hud-base").classList.add("hud-box");
  el("hud-context").classList.add("hud-box");
  el("hud-hotbar").classList.add("hud-box");
  root.querySelector(".hud-tr").classList.add("hud-box");

  // Hotbar
  const hot = el("hud-hotbar");
  hot.innerHTML = `<span class="hud-selname" id="hud-selname"></span>${Array.from({ length: 9 }, (_, i) => `<button type="button" class="hud-slot" data-slot="${i}" aria-label="Slot ${i + 1}"><span class="hud-slot__k">${i + 1}</span><img alt="" hidden /><span class="hud-slot__n"></span></button>`).join("")}`;
  refs.slots = [...hot.querySelectorAll(".hud-slot")].map((b) => ({ b, img: b.querySelector("img"), n: b.querySelector(".hud-slot__n") }));
  refs.selname = el("hud-selname");

  let lastHotSig = "";
  let lastObjSig = "";
  let lastBaseSig = "";
  let lastCtxSig = "";

  function update(g, view) {
    const s = g.s;
    const p = s.player;
    // Vitals
    const o2max = maxO2(g);
    for (const v of VITALS) {
      const r = refs.vitals[v.id];
      const max = v.id === "o2" ? o2max : 100;
      const val = Math.max(0, p[v.id]);
      const frac = Math.min(1, val / max);
      r.fill.style.width = `${(frac * 100).toFixed(1)}%`;
      r.num.textContent = String(Math.ceil((val / max) * 100));
      r.bar.setAttribute("aria-valuenow", String(Math.round(frac * 100)));
      const low = frac < 0.25;
      const crit = frac < 0.12;
      r.node.classList.toggle("vital--low", low);
      r.node.classList.toggle("vital--crit", crit);
    }
    const room = playerRoom(g);
    const status = [];
    if (p.inRover) status.push(`ROVER <b>${Math.round(s.rover.battery)}/${Math.round(s.rover.capacity)}</b>`);
    else if (room && room.sealed) status.push(`ROOM O₂ <b>${Math.round(room.o2 * 100)}%</b> <b>${Math.round(room.temp)}°C</b>`);
    else if (room) status.push(`<b style="color:var(--mb-red)">ROOM LEAKING</b>`);
    else status.push(`EVA <b>${Math.round(view.outsideTemp)}°C</b>`);
    el("hud-status").innerHTML = status.join(" ");

    // Clock
    el("hud-sol").textContent = String(solOf(s.tick));
    el("hud-time").textContent = `${clockText(s.tick)}${isNight(s.tick) ? " ☾" : ""}`;
    el("hud-speed").textContent = view.paused ? "II" : `${view.speed}×`;
    const bar = document.getElementById("bar-sol");
    if (bar) bar.textContent = String(solOf(s.tick));

    // Weather
    const w = [];
    for (const e of s.events.active) {
      const def = eventById(e.id);
      const left = Math.max(0, Math.ceil((e.until - s.tick) / 20 / 60));
      w.push(`<b>${escapeHtml(def.name.toUpperCase())}</b> ${left}m`);
    }
    const warned = s.events.scheduled.filter((e) => e.warned);
    for (const e of warned) {
      const secs = Math.max(0, Math.ceil((e.at - s.tick) / 20));
      w.push(`⚠ ${escapeHtml(eventById(e.id).name)} in ${secs >= 90 ? `${Math.ceil(secs / 60)}m` : `${secs}s`}`);
    }
    el("hud-weather").innerHTML = w.join("<br>") || (isNight(s.tick) ? "Night. −90°C." : "Clear skies.");

    // Hotbar
    const sig = s.inv.slice(0, 9).map((it) => (it ? `${it.id}:${it.n}` : "-")).join("|") + `#${s.sel}`;
    if (sig !== lastHotSig) {
      lastHotSig = sig;
      for (let i = 0; i < 9; i += 1) {
        const it = s.inv[i];
        const r = refs.slots[i];
        r.b.classList.toggle("hud-slot--sel", i === s.sel);
        if (it) {
          r.img.hidden = false;
          r.img.src = itemIconURL(it.id);
          r.n.textContent = it.n > 1 ? String(it.n) : "";
          r.b.title = itemById(it.id)?.name ?? it.id;
          r.b.setAttribute("aria-label", `Slot ${i + 1}: ${itemById(it.id)?.name}${it.n > 1 ? ` ×${it.n}` : ""}`);
        } else {
          r.img.hidden = true;
          r.n.textContent = "";
          r.b.title = "";
          r.b.setAttribute("aria-label", `Slot ${i + 1}: empty`);
        }
      }
      const cur = s.inv[s.sel];
      refs.selname.textContent = cur ? itemById(cur.id)?.name.toUpperCase() : "";
    }

    // Objective
    const obj = currentObjective(g);
    let objHtml = "";
    if (obj) {
      const prog = objectiveProgress(g);
      const act = ACTS.find((a) => a.id === obj.act);
      const tgt = g._objectiveTarget;
      const dist = tgt ? Math.round(Math.hypot(tgt.x + 0.5 - p.x, tgt.y + 0.5 - p.y)) : null;
      objHtml = `<div class="obj__act">${escapeHtml(act?.name ?? "")}</div>
        <div class="obj__text">▸ ${escapeHtml(obj.text)} ${prog ? `<span class="obj__prog">${escapeHtml(prog)}</span>` : ""}</div>
        ${dist !== null && dist > 6 ? `<div class="obj__dist">${dist * 10} m ${compass(tgt.x + 0.5 - p.x, tgt.y + 0.5 - p.y)} — marked on map</div>` : ""}
        ${view.showHints ? `<div class="obj__hint">${escapeHtml(obj.hint)}</div>` : ""}`;
    } else if (s.mode !== "campaign") {
      objHtml = `<div class="obj__act">${s.mode === "daily" ? `DAILY SOL ${escapeHtml(s.dailyKey ?? "")}` : "ENDLESS"}</div>
        <div class="obj__text">SCORE <span class="obj__prog">${s.score}</span></div>
        <div class="obj__hint">${s.mode === "daily" ? `Survive to sol 31. ` : ""}Colonists ${aliveColonists(g).length} · Streak ${s.sustain.streak} sols</div>`;
    }
    if (objHtml !== lastObjSig) {
      lastObjSig = objHtml;
      el("hud-objective").innerHTML = objHtml;
    }

    // Base status (hab grid)
    const habRoom = roomAtTile(g, g.world.start.x, g.world.start.y) ?? room;
    const grid = gridForRoom(g, room && room.sealed ? room : habRoom);
    const wt = waterTotal(g);
    const food = pantry(g);
    const rows = [];
    if (grid) {
      const net = grid.gen - grid.demand;
      rows.push(row("POWER", `${grid.gen.toFixed(1)} / ${grid.demand.toFixed(1)}`, grid.brownout ? "bad" : net >= 0 ? "ok" : ""));
      rows.push(row("BATTERY", grid.cap ? `${Math.round((grid.stored / grid.cap) * 100)}%` : "none", grid.cap && grid.stored / grid.cap < 0.15 ? "bad" : ""));
    }
    rows.push(row("WATER", `${Math.round(wt.total)} / ${wt.cap} L`, wt.total < 10 ? "bad" : ""));
    rows.push(row("PANTRY", `${food} meals`, food < 3 ? "bad" : ""));
    if (habRoom) rows.push(row("HAB AIR", habRoom.sealed ? `${Math.round(habRoom.o2 * 100)}% · ${Math.round(habRoom.temp)}°C` : "BREACHED", !habRoom.sealed || habRoom.o2 < 0.5 ? "bad" : habRoom.temp < 0 ? "bad" : "ok"));
    const crew = aliveColonists(g).length;
    if (crew || s.story.flags.comms) rows.push(row("CREW", `${crew + 1} (${Math.max(0, housingFree(g))} free bunks)`, ""));
    if (s.story.flags.comms) rows.push(row("CREDITS", `${s.credits} ₢`, ""));
    if (s.craft?.length) {
      const job = s.craft[0];
      rows.push(row("CRAFTING", `${s.craft.length} queued`, ""));
      void job;
    }
    const baseHtml = `<div class="base__title">BASE</div>${rows.join("")}`;
    if (baseHtml !== lastBaseSig) {
      lastBaseSig = baseHtml;
      el("hud-base").innerHTML = baseHtml;
    }

    // Context (hover)
    const ctxHtml = contextHtml(g, view);
    if (ctxHtml !== lastCtxSig) {
      lastCtxSig = ctxHtml;
      el("hud-context").innerHTML = ctxHtml;
    }

    // Overlays
    el("hud-pause").hidden = !view.paused || view.panelOpen;
    el("hud-sleep").hidden = !p.sleeping;
    const vig = el("hud-vignette");
    vig.classList.toggle("is-hurt", p.health < 30);
    vig.classList.toggle("is-o2", p.o2 <= 0);
  }

  return { update, refs };
}

function row(k, v, cls) {
  return `<div class="base__row ${cls ? `base__row--${cls}` : ""}"><span>${k}</span><span>${escapeHtml(v)}</span></div>`;
}

function compass(dx, dy) {
  const a = Math.atan2(dy, dx);
  const dirs = ["E", "SE", "S", "SW", "W", "NW", "N", "NE"];
  return dirs[(Math.round(a / (Math.PI / 4)) + 8) % 8];
}

function contextHtml(g, view) {
  const s = g.s;
  if (view.build) {
    const def = structById(view.build);
    const chk = view.ghost;
    return `<div class="ctx__name">BUILD: ${escapeHtml(def.name.toUpperCase())}</div>
      <div class="ctx__line">${escapeHtml(def.desc)}</div>
      <div class="ctx__line">Cost: <b>${Object.entries(def.cost).map(([k, n]) => `${n} ${escapeHtml(itemById(k)?.name ?? k)}`).join(", ") || "free"}</b></div>
      ${chk && !chk.ok ? `<div class="ctx__line ctx__bad">${escapeHtml(chk.reason)}</div>` : ""}
      <div class="ctx__line"><span class="ctx__key">L-CLICK</span> place · <span class="ctx__key">R-CLICK/ESC</span> cancel</div>`;
  }
  const c = view.cursor;
  if (!c || !inBounds(g, c.x, c.y)) return "";
  if (!g.explored[c.y * g.world.w + c.x]) return `<div class="ctx__name">UNCHARTED</div><div class="ctx__line">Explore or scan to reveal.</div>`;
  const lines = [];
  let name = "";
  const st = structAt(g, c.x, c.y);
  const n = nodeAt(g, c.x, c.y);
  const rv = s.rover;
  if (Math.floor(rv.x) === c.x && Math.floor(rv.y) === c.y) {
    name = "ROVER";
    if (rv.broken) lines.push(`<span class="ctx__bad">Broken.</span> Repair: ${costText(REPAIR_COST.rover)} — <span class="ctx__key">E</span> with multitool`);
    else lines.push(`Battery <b>${Math.round(rv.battery)}/${Math.round(rv.capacity)}</b> · ~${Math.round((rv.battery / ROVER.drainPerSec) * ROVER.maxSpeed * 0.8) * 10} m range`, `<span class="ctx__key">E / F</span> drive`);
  } else if (st) {
    const def = structById(st.id);
    name = def.name.toUpperCase();
    if (st.broken) lines.push(`<span class="ctx__bad">BROKEN.</span> Repair: ${costText(REPAIR_COST[st.id] ?? REPAIR_COST.default)} — <span class="ctx__key">E</span>`);
    if (def.power < 0) lines.push(`Power: ${st.broken ? "—" : st.powered ? "<b>ON</b>" : st.active === false ? "idle" : '<span class="ctx__bad">NO POWER</span>'} (${(-def.power).toFixed(1)})`);
    if (def.power > 0) {
      const out = def.solar ? `${Math.round((1 - (st.dust ?? 0)) * 100)}% clean` : "steady";
      lines.push(`Generates <b>${def.power}</b> · ${out}`);
    }
    if (def.interior && !roomAtTile(g, st.x, st.y)) lines.push(`<span class="ctx__bad">Must be inside a sealed room.</span>`);
    switch (st.id) {
      case "solar":
        if ((st.dust ?? 0) > 0.05) lines.push(`Dust ${Math.round(st.dust * 100)}% — <span class="ctx__key">E</span> wipe`);
        break;
      case "battery":
        lines.push(`Charge <b>${Math.round(st.charge)} / ${def.store}</b>`);
        break;
      case "tank":
        lines.push(`<b>${Math.round(st.water)} / ${def.water} L</b>`, `<span class="ctx__key">E</span> melt carried ice (8 L each), or fill a water pouch`);
        break;
      case "planter": {
        const cr = st.crop;
        if (!cr) lines.push(`Empty — <span class="ctx__key">E</span> to plant seeds`);
        else if (cr.dead) lines.push(`<span class="ctx__bad">Dead crop.</span> <span class="ctx__key">E</span> to clear`);
        else {
          lines.push(`${escapeHtml(itemById(CROPS[cr.type].yield).name)} <b>${Math.floor(cr.g * 100)}%</b>${cr.g >= 1 ? ' — <span class="ctx__key">E</span> harvest' : ""}`);
          const cs = cropStatus(g, st);
          const bad = [];
          if (!cs.sealed) bad.push("no pressure");
          if (!cs.warm) bad.push("too cold");
          if (!cs.lit) bad.push("no light (glass or grow lamp)");
          if (!cs.water) bad.push("no water");
          if (bad.length && cr.g < 1) lines.push(`<span class="ctx__bad">Not growing: ${bad.join(", ")}</span>`);
        }
        break;
      }
      case "recycler":
        lines.push(`Compost <b>${st.compost}</b> — <span class="ctx__key">E</span> collect`);
        break;
      case "chem": {
        const r = roomAtTile(g, st.x, st.y);
        lines.push(`Hydrazine queued <b>${st.hyd}</b> → 6 L water each — <span class="ctx__key">E</span> load`);
        if (r && r.o2 > 0.35) lines.push(`<span class="ctx__bad">Room O₂ ${Math.round(r.o2 * 100)}% — explosion risk ${Math.round(Math.max(0, r.o2 - 0.35) * 80)}% per burn</span>`);
        break;
      }
      case "lab":
        lines.push(`Samples <b>${st.samples}</b> · <span class="ctx__key">E</span> load samples / research`);
        break;
      case "airlock":
        lines.push(`Seal wear <b>${Math.min(100, Math.round(((st.wear ?? 0) / 120) * 100))}%</b>`);
        break;
      case "crate":
        lines.push(`${st.items.filter(Boolean).length}/${def.storage} slots — <span class="ctx__key">E</span> open`);
        break;
      case "autominer":
        lines.push(adjacentNode(g, st) ? "Mining adjacent deposit." : '<span class="ctx__bad">No deposit next to it.</span>', `<span class="ctx__key">E</span> collect`);
        break;
      case "comms":
        lines.push(`${s.story.messages.filter((m) => !m.read).length} unread · <span class="ctx__key">E</span> open`);
        break;
      case "bunk":
        lines.push(`<span class="ctx__key">E</span> sleep (at night)`);
        break;
      case "workbench":
      case "smelter":
      case "fabricator":
        lines.push(`<span class="ctx__key">E</span> craft here`);
        break;
      default:
        break;
    }
    const r = roomAtTile(g, st.x, st.y);
    if (r) lines.push(r.sealed ? `Room: O₂ <b>${Math.round(r.o2 * 100)}%</b> · <b>${Math.round(r.temp)}°C</b> · ${r.tiles.length} tiles` : `<span class="ctx__bad">Room is leaking</span>`);
  } else if (n) {
    const nd = NODES[n];
    name = nd.name.toUpperCase();
    if (nd.drop && nd.drop !== "cache") lines.push(`Yields <b>${escapeHtml(itemById(nd.drop)?.name ?? nd.drop)}</b> · drill tier ${nd.tier}`);
    if (nd.drop === "cache") lines.push("Sealed supplies. Drill it open.");
    if (n === 12) lines.push("The ascent vehicle. <span class=\"ctx__key\">E</span> board");
    lines.push(`Hold <span class="ctx__key">L-CLICK</span> with a drill`);
  } else {
    const t = terrainAt(g, c.x, c.y);
    name = TERRAIN[t].name.toUpperCase();
    const r = roomAtTile(g, c.x, c.y);
    if (TERRAIN[t].solid) lines.push("Impassable.");
    else lines.push("Shovel for regolith / sand / ice.");
    if (r && !r.sealed) lines.push('<span class="ctx__bad">Open to vacuum.</span>');
  }
  if (!view.cursor.inReach) lines.push('<span style="opacity:.6">(out of reach)</span>');
  return `<div class="ctx__name">${escapeHtml(name)}</div>${lines.map((l) => `<div class="ctx__line">${l}</div>`).join("")}`;
}

function costText(cost) {
  return Object.entries(cost).map(([k, n]) => `${n} ${escapeHtml(itemById(k)?.name ?? k)}`).join(", ");
}

export { hasEffect };
