import { escapeHtml } from "../../../shared/shell.js";
import { ITEMS, itemById } from "../data/items.js";
import { RECIPES, recipeById } from "../data/recipes.js";
import { STRUCTURES, BUILD_CATS, structById } from "../data/structures.js";
import { RESEARCH, BRANCHES } from "../data/research.js";
import { MANIFESTS } from "../data/story.js";
import { itemIconURL, drawStruct, makeCanvas } from "../render/sprites.js";
import { nearbyPool, canCraft, queueCraft, cancelCraft, isResearched, stationNear } from "../sim/building.js";
import { poolCount, poolHas, swapSlots, moveSlot } from "../sim/inventory.js";
import { useItem } from "../sim/player.js";
import { orderDrop } from "../sim/events.js";
import { solOf } from "../sim/state.js";

export const TABS = [
  { id: "inventory", label: "INVENTORY", key: "TAB", pauses: false },
  { id: "build", label: "BUILD", key: "B", pauses: false },
  { id: "research", label: "RESEARCH", key: "T", pauses: true },
  { id: "map", label: "MAP", key: "M", pauses: true },
  { id: "journal", label: "JOURNAL", key: "J", pauses: true },
  { id: "comms", label: "COMMS", key: "", pauses: true, hidden: (g) => !g.s.story.flags.comms && !g.s.story.messages.length },
  { id: "menu", label: "MENU", key: "ESC", pauses: true },
];

const STATION_NAMES = { hand: "HAND", workbench: "WORKBENCH", smelter: "SMELTER", fabricator: "FABRICATOR" };

export function createPanels(root, api) {
  const panel = root.querySelector("#panel");
  const tabsEl = root.querySelector("#panel-tabs");
  const body = root.querySelector("#panel-body");
  const state = { open: false, tab: "inventory", crateAt: null, pick: null, station: null, buildCat: "shell" };

  root.querySelector("#panel-close").addEventListener("click", () => close());
  panel.addEventListener("mousedown", (e) => {
    if (e.target === panel) close();
  });

  function renderTabs() {
    const g = api.g();
    tabsEl.innerHTML = TABS.filter((t) => !t.hidden || !t.hidden(g))
      .map((t) => {
        const unread = t.id === "comms" ? g.s.story.messages.filter((m) => !m.read).length : 0;
        return `<button type="button" role="tab" class="mb-tab" data-tab="${t.id}" aria-selected="${state.tab === t.id}">${t.label}${unread ? ` (${unread})` : ""}${t.key ? `<span class="kbd">${t.key}</span>` : ""}</button>`;
      })
      .join("");
    tabsEl.querySelectorAll("[data-tab]").forEach((b) =>
      b.addEventListener("click", () => {
        state.tab = b.dataset.tab;
        state.crateAt = null;
        render();
      }),
    );
  }

  function open(tab, opts = {}) {
    state.tab = tab;
    state.crateAt = opts.crateAt ?? null;
    state.station = opts.station ?? null;
    state.pick = null;
    state.open = true;
    panel.hidden = false;
    render();
    api.onOpen?.(tab);
    const first = body.querySelector("button, canvas");
    first?.focus({ preventScroll: true });
  }

  function close() {
    if (!state.open) return;
    state.open = false;
    panel.hidden = true;
    state.crateAt = null;
    api.onClose?.();
    root.querySelector("#world")?.focus({ preventScroll: true });
  }

  function toggle(tab) {
    if (state.open && state.tab === tab && !state.crateAt) close();
    else open(tab);
  }

  function render() {
    if (!state.open) return;
    renderTabs();
    const g = api.g();
    switch (state.tab) {
      case "inventory":
        renderInventory(g);
        break;
      case "build":
        renderBuild(g);
        break;
      case "research":
        renderResearch(g);
        break;
      case "map":
        renderMap(g);
        break;
      case "journal":
        renderJournal(g);
        break;
      case "comms":
        renderComms(g);
        break;
      case "menu":
        api.renderMenu(body);
        break;
      default:
        break;
    }
  }

  // Light refresh for live values (crafting progress etc.) without rebuilding everything.
  function tick() {
    if (!state.open) return;
    const g = api.g();
    if (state.tab === "inventory") {
      const q = body.querySelector("#craft-queue");
      if (q) {
        const job = g.s.craft?.[0];
        const bar = q.querySelector(".queue__bar");
        if (bar && job) bar.style.width = `${Math.min(100, (job.t / recipeById(job.id).time) * 100)}%`;
        const sig = (g.s.craft ?? []).map((j) => j.id).join(",") + "|" + g.s.inv.map((it) => (it ? it.id + it.n : "-")).join(",");
        if (q.dataset.sig !== sig) renderInventory(g);
      }
    } else if (state.tab === "map") {
      const cv = body.querySelector("#map-canvas");
      if (cv) api.drawMap(cv);
    } else if (state.tab === "research") {
      const bar = body.querySelector("#rs-bar > i");
      const res = RESEARCH.find((r) => r.id === g.s.research.current);
      if (bar && res) bar.style.width = `${Math.min(100, (g.s.research.progress / res.cost) * 100)}%`;
      if (!res && bar) renderResearch(g);
    }
  }

  // ---------- inventory + crafting ----------
  function slotHtml(it, i, extra = "") {
    const hot = i < 9 && !extra.includes("crate");
    return `<button type="button" class="hud-slot ${hot ? "hud-slot--hot" : ""} ${state.pick === i && !extra ? "hud-slot--sel" : ""}" data-i="${i}" ${extra} title="${it ? escapeHtml(itemById(it.id)?.name ?? it.id) : "Empty"}">
      ${hot ? `<span class="hud-slot__k">${i + 1}</span>` : ""}
      ${it ? `<img src="${itemIconURL(it.id)}" alt="${escapeHtml(itemById(it.id)?.name ?? "")}" /><span class="hud-slot__n">${it.n > 1 ? it.n : ""}</span>` : ""}
    </button>`;
  }

  function renderInventory(g) {
    const s = g.s;
    const crate = state.crateAt !== null ? g.structs.get(state.crateAt) : null;
    const pool = nearbyPool(g);
    const invGrid = `<div class="inv-grid" id="inv-grid">${s.inv.map((it, i) => (i === 9 ? `<div class="inv-sep"></div>` : "") + slotHtml(it, i)).join("")}</div>`;
    let right = "";
    if (crate) {
      right = `<h3 class="mb-h">STORAGE CRATE <small>click an item to move it across</small></h3>
        <div class="inv-grid" id="crate-grid">${crate.items.map((it, i) => slotHtml(it, i, 'data-crate="1"')).join("")}</div>
        <p class="mb-note">Shift-click an inventory item to stash the whole stack. Crates within 8 tiles count toward building and crafting costs.</p>
        <button type="button" class="btn btn--sm" id="stash-all">STASH ALL RESOURCES</button>`;
    } else {
      const job = s.craft?.[0];
      const stations = ["hand", "workbench", "smelter", "fabricator"];
      const available = new Set(stations.filter((st) => stationNear(g, st)));
      const order = state.station ? [state.station, ...stations.filter((x) => x !== state.station)] : stations;
      const groups = order
        .map((stn) => {
          const list = RECIPES.filter((r) => r.station === stn && isResearched(g, r.research));
          if (!list.length) return "";
          const here = available.has(stn);
          return `<h3 class="mb-h">${STATION_NAMES[stn]} ${here ? "" : `<small>— stand at a ${stn}</small>`}</h3>
            <div class="recipe-list">${list
              .map((r) => {
                const ok = here && poolHas(pool, r.in);
                const ins = Object.entries(r.in)
                  .map(([id, n]) => {
                    const have = poolCount(pool, id);
                    return `<span class="${have >= n ? "have" : "miss"}">${n} ${escapeHtml(itemById(id)?.name ?? id)}</span>`;
                  })
                  .join(" + ");
                return `<div class="recipe ${ok ? "" : "recipe--na"}">
                  <img src="${itemIconURL(r.out[0])}" alt="" />
                  <div><div class="recipe__name">${escapeHtml(itemById(r.out[0])?.name ?? r.out[0])} ×${r.out[1]}</div><div class="recipe__in">${ins} · ${r.time}s</div></div>
                  <span><button type="button" class="btn btn--sm ${ok ? "btn--primary" : ""}" data-craft="${r.id}" ${ok ? "" : "disabled"}>CRAFT</button>
                  <button type="button" class="btn btn--sm btn--ghost" data-craft5="${r.id}" ${ok ? "" : "disabled"} title="Craft 5">×5</button></span>
                </div>`;
              })
              .join("")}</div>`;
        })
        .join("");
      right = `<h3 class="mb-h">CRAFT QUEUE <small>click to cancel</small></h3>
        <div class="queue" id="craft-queue">${(s.craft ?? [])
          .map((j, i) => `<button type="button" class="queue__item" data-cancel="${i}" title="${escapeHtml(itemById(recipeById(j.id).out[0])?.name ?? "")}"><img src="${itemIconURL(recipeById(j.id).out[0])}" alt="" />${i === 0 ? `<span class="queue__bar" style="width:${Math.min(100, (j.t / recipeById(j.id).time) * 100)}%"></span>` : ""}</button>`)
          .join("") || '<span class="mb-note">Empty.</span>'}</div>
        ${job ? "" : ""}${groups}`;
    }
    const sel = state.pick !== null ? s.inv[state.pick] : null;
    const selDef = sel ? itemById(sel.id) : null;
    const useBtn = selDef && ["food", "consumable"].includes(selDef.kind) ? `<button type="button" class="btn btn--sm" id="use-sel">USE ${escapeHtml(selDef.name.toUpperCase())}</button>` : "";
    body.innerHTML = `<div class="mb-cols">
      <div>
        <h3 class="mb-h">SUIT INVENTORY <small>slots 1–9 are the hotbar · click two slots to swap</small></h3>
        ${invGrid}
        <p class="mb-note">${sel ? `<b>${escapeHtml(selDef.name)}</b> ×${sel.n} — ${escapeHtml(itemDesc(selDef))}` : "Right-click an item to use or eat it."}</p>
        ${useBtn}
        <label class="setting"><span>Auto-eat when hungry</span><input type="checkbox" id="auto-eat" ${s.autoEat ? "checked" : ""} /></label>
      </div>
      <div>${right}</div>
    </div>`;
    const q = body.querySelector("#craft-queue");
    if (q) q.dataset.sig = (s.craft ?? []).map((j) => j.id).join(",") + "|" + s.inv.map((it) => (it ? it.id + it.n : "-")).join(",");

    body.querySelectorAll("#inv-grid [data-i]").forEach((b) => {
      const i = Number(b.dataset.i);
      b.addEventListener("click", (e) => {
        if (crate && e.shiftKey) {
          moveSlot(s.inv, i, crate.items);
          api.sfx("click");
          renderInventory(g);
          return;
        }
        if (crate) {
          moveSlot(s.inv, i, crate.items);
          api.sfx("click");
          renderInventory(g);
          return;
        }
        if (state.pick === null) state.pick = i;
        else if (state.pick === i) {
          if (i < 9) s.sel = i;
          state.pick = null;
        } else {
          swapSlots(s.inv, state.pick, i);
          state.pick = null;
          api.sfx("click");
        }
        renderInventory(g);
      });
      b.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        const r = useItem(g, i, null);
        if (r?.msg) api.say(r.msg);
        renderInventory(g);
      });
    });
    body.querySelectorAll("#crate-grid [data-i]").forEach((b) => {
      b.addEventListener("click", () => {
        moveSlot(crate.items, Number(b.dataset.i), s.inv);
        api.sfx("click");
        renderInventory(g);
      });
    });
    body.querySelector("#stash-all")?.addEventListener("click", () => {
      for (let i = 0; i < s.inv.length; i += 1) {
        const it = s.inv[i];
        if (!it) continue;
        const k = itemById(it.id)?.kind;
        if (k === "raw" || k === "refined") moveSlot(s.inv, i, crate.items);
      }
      api.sfx("click");
      renderInventory(g);
    });
    body.querySelector("#use-sel")?.addEventListener("click", () => {
      const r = useItem(g, state.pick, null);
      if (r?.msg) api.say(r.msg);
      state.pick = null;
      renderInventory(g);
    });
    body.querySelector("#auto-eat")?.addEventListener("change", (e) => {
      s.autoEat = e.target.checked;
    });
    body.querySelectorAll("[data-craft],[data-craft5]").forEach((b) =>
      b.addEventListener("click", () => {
        const id = b.dataset.craft ?? b.dataset.craft5;
        const r = queueCraft(g, id, b.dataset.craft5 ? 5 : 1);
        api.sfx(r.ok ? "build" : "deny");
        if (!r.ok) api.say(r.reason);
        renderInventory(g);
      }),
    );
    body.querySelectorAll("[data-cancel]").forEach((b) =>
      b.addEventListener("click", () => {
        cancelCraft(g, Number(b.dataset.cancel));
        renderInventory(g);
      }),
    );
  }

  // ---------- build ----------
  const buildIcons = new Map();
  function buildIcon(id) {
    if (buildIcons.has(id)) return buildIcons.get(id);
    const cv = document.createElement("canvas");
    cv.width = 16;
    cv.height = 16;
    const ctx = cv.getContext("2d");
    const fake = { id, x: 0, y: 0, dust: 0, charge: 300, water: 120, powered: true, compost: 2, crop: id === "planter" ? { type: "potato", g: 0.8 } : null, items: [] };
    drawStruct(ctx, fake, 0, 0, 0, { l: false, r: false, u: false, d: false }, { charge: 0.6, water: 0.6 });
    const url = cv.toDataURL();
    buildIcons.set(id, url);
    return url;
  }
  void makeCanvas;

  function renderBuild(g) {
    const pool = nearbyPool(g);
    const cats = BUILD_CATS.map((c) => `<button type="button" class="hbtn" data-cat="${c.id}" aria-pressed="${state.buildCat === c.id}">${c.name.toUpperCase()}</button>`).join("");
    const list = STRUCTURES.filter((d) => d.cat === state.buildCat && !d.hidden)
      .map((d) => {
        const unlocked = isResearched(g, d.research);
        const afford = poolHas(pool, d.cost);
        const cost = Object.entries(d.cost)
          .map(([id, n]) => `<span style="color:${poolCount(pool, id) >= n ? "var(--mb-green)" : "var(--mb-red)"}">${n} ${escapeHtml(itemById(id)?.name ?? id)}</span>`)
          .join(" + ");
        return `<button type="button" class="build-item ${unlocked && afford ? "" : "build-item--na"}" data-build="${d.id}" ${unlocked ? "" : "disabled"}>
          <img src="${buildIcon(d.id)}" alt="" width="32" height="32" style="image-rendering:pixelated" />
          <span><span class="recipe__name">${escapeHtml(d.name)}</span> ${d.power ? `<small style="color:${d.power > 0 ? "var(--mb-green)" : "var(--mb-yellow)"}">${d.power > 0 ? "+" : ""}${d.power} PWR</small>` : ""}<br /><span class="build-item__desc">${escapeHtml(d.desc)}</span><br /><span class="build-item__desc">${cost || "free"}</span></span>
          ${unlocked ? "" : `<span class="build-item__lock">NEEDS RESEARCH</span>`}
        </button>`;
      })
      .join("");
    body.innerHTML = `<div class="cat-tabs">${cats}</div>
      <p class="mb-note">Pick a structure, then click the ground to place it (hold and drag for walls and floors). Pressurized rooms need a closed ring of walls/airlocks around floor tiles. Everything touching is on one power grid. Hold L-CLICK with the multitool to deconstruct (50% refund).</p>
      <div class="build-list">${list}</div>`;
    body.querySelectorAll("[data-cat]").forEach((b) =>
      b.addEventListener("click", () => {
        state.buildCat = b.dataset.cat;
        renderBuild(g);
      }),
    );
    body.querySelectorAll("[data-build]").forEach((b) =>
      b.addEventListener("click", () => {
        api.startBuild(b.dataset.build);
        close();
      }),
    );
  }

  // ---------- research ----------
  function renderResearch(g) {
    const s = g.s;
    const cur = RESEARCH.find((r) => r.id === s.research.current);
    const labs = [...g.structs.values()].filter((st) => st.id === "lab");
    const samples = labs.reduce((a, l) => a + l.samples, 0);
    const cols = BRANCHES.map(
      (b) => `<div class="rs-col"><h3 class="mb-h">${escapeHtml(b.name.toUpperCase())}</h3>${RESEARCH.filter((r) => r.branch === b.id)
        .map((r) => {
          const done = s.research.done.includes(r.id);
          const avail = !done && (r.req ?? []).every((q) => s.research.done.includes(q));
          const isCur = s.research.current === r.id;
          return `<button type="button" class="rs-node ${done ? "rs-node--done" : ""} ${isCur ? "rs-node--cur" : ""} ${!done && !avail ? "rs-node--locked" : ""}" data-rs="${r.id}" ${avail ? "" : "disabled"}>
            <div class="rs-node__name">${escapeHtml(r.name)}</div>
            <div class="rs-node__desc">${escapeHtml(r.desc)}</div>
            <div class="rs-node__cost">${done ? "DONE" : `${r.cost} RP`}${!done && !avail && r.req ? ` · needs ${r.req.map((q) => escapeHtml(RESEARCH.find((x) => x.id === q).name)).join(", ")}` : ""}</div>
          </button>`;
        })
        .join("")}</div>`,
    ).join("");
    body.innerHTML = `
      <h3 class="mb-h">CURRENT PROJECT <small>${cur ? escapeHtml(cur.name) : "none — pick one below"}</small></h3>
      <div class="rs-bar" id="rs-bar"><i style="width:${cur ? Math.min(100, (s.research.progress / cur.cost) * 100) : 0}%"></i></div>
      <p class="mb-note">${labs.length ? `${labs.length} lab${labs.length === 1 ? "" : "s"} · ${samples} sample${samples === 1 ? "" : "s"} loaded. Each sample = 10 RP (≈40 s, faster with a colonist working the lab).` : "Build a Research Lab (Science tab) inside the hab, then load rock samples into it with E. Samples come from survey flags out in the field."}${s.story.flags.comms ? " Research is transmitted to Earth: +4 ₢ per sample." : ""}</p>
      <div class="research-grid">${cols}</div>`;
    body.querySelectorAll("[data-rs]").forEach((b) =>
      b.addEventListener("click", () => {
        if (s.research.current !== b.dataset.rs) {
          s.research.current = b.dataset.rs;
          s.research.progress = 0;
        }
        api.sfx("click");
        renderResearch(g);
      }),
    );
  }

  // ---------- map ----------
  function renderMap(g) {
    body.innerHTML = `<div class="map-wrap">
      <canvas class="map-canvas" id="map-canvas" width="384" height="384" aria-label="Full map. Click to drop a waypoint, right-click to remove one."></canvas>
      <div class="map-legend">
        <span><i style="background:#ff7a1a"></i>You</span><span><i style="background:#6ec8f0"></i>Rover</span>
        <span><i style="background:#ffcf4a"></i>Hab</span><span><i style="background:#9ee6ff"></i>Lander</span>
        <span><i style="background:#58c070"></i>Cache</span><span><i style="background:#b06adf"></i>Science / tube</span>
        <span><i style="background:#e8483a"></i>Waypoint</span><span><i style="border:1px solid #ffcf4a"></i>Objective</span>
      </div>
      <p class="mb-note">Click to drop a waypoint · right-click to remove one. Explored ${Math.round((g.explored.reduce((a, b) => a + b, 0) / g.explored.length) * 100)}% of the region.</p>
    </div>`;
    const cv = body.querySelector("#map-canvas");
    api.drawMap(cv);
    const toTile = (e) => {
      const r = cv.getBoundingClientRect();
      return { x: Math.floor(((e.clientX - r.left) / r.width) * g.world.w), y: Math.floor(((e.clientY - r.top) / r.height) * g.world.h) };
    };
    cv.addEventListener("click", (e) => {
      const t = toTile(e);
      g.s.beacons.push({ x: t.x, y: t.y, label: "WP" });
      api.drawMap(cv);
      api.sfx("click");
    });
    cv.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      const t = toTile(e);
      let best = -1;
      let bd = 12;
      g.s.beacons.forEach((b, i) => {
        const d = Math.hypot(b.x - t.x, b.y - t.y);
        if (d < bd) {
          bd = d;
          best = i;
        }
      });
      if (best >= 0) g.s.beacons.splice(best, 1);
      api.drawMap(cv);
    });
  }

  // ---------- journal ----------
  function renderJournal(g) {
    const s = g.s;
    const st = s.stats;
    body.innerHTML = `<div class="mb-cols">
      <div>
        <h3 class="mb-h">MISSION LOG</h3>
        <ul class="journal">${s.log.map((e) => `<li class="j--${escapeHtml(e.type)}"><span class="j-sol">SOL ${e.sol}</span>${escapeHtml(e.text)}</li>`).join("")}</ul>
      </div>
      <div>
        <h3 class="mb-h">STATS</h3>
        <dl class="stat-grid">
          ${stat("SOL", solOf(s.tick))}${stat("DISTANCE", `${(st.distance / 100).toFixed(2)} km`)}${stat("MINED", st.mined)}
          ${stat("CRAFTED", st.crafted)}${stat("BUILT", st.built)}${stat("HARVESTED", st.harvested)}
          ${stat("EVENTS", st.events)}${stat("RESEARCH", s.research.done.length)}${stat("COLONISTS", s.colonists.filter((c) => c.alive).length)}
        </dl>
      </div>
    </div>`;
  }

  function stat(k, v) {
    return `<div class="stat"><dt>${k}</dt><dd>${escapeHtml(String(v))}</dd></div>`;
  }

  // ---------- comms ----------
  function renderComms(g) {
    const s = g.s;
    for (const m of s.story.messages) m.read = true;
    const online = s.story.flags.comms;
    body.innerHTML = `<div class="mb-cols">
      <div>
        <h3 class="mb-h">TRANSMISSIONS</h3>
        ${s.story.messages.length ? s.story.messages.slice().reverse().map((m) => `<div class="comms-msg"><small>SOL ${m.sol} · EARTH</small>${escapeHtml(m.text)}</div>`).join("") : '<p class="mb-note">No messages.</p>'}
      </div>
      <div>
        <h3 class="mb-h">SUPPLY DROPS <small>${s.credits} ₢ available</small></h3>
        ${online ? "" : '<p class="mb-note" style="color:var(--mb-red)">Comms dish offline — it needs power.</p>'}
        ${MANIFESTS.map((m) => `<div class="manifest"><div><div class="recipe__name">${escapeHtml(m.name)} — ${m.cost} ₢</div><div class="manifest__items">${Object.entries(m.items).map(([id, n]) => `${n} ${escapeHtml(itemById(id)?.name ?? id)}`).join(", ")}</div></div>
          <button type="button" class="btn btn--sm" data-order="${m.id}" ${online && s.credits >= m.cost ? "" : "disabled"}>ORDER</button></div>`).join("")}
        <p class="mb-note">Credits come from research transmitted to Earth. Drops land by the landing pad (or the hab) half a sol after ordering.</p>
        ${s.orders.length ? `<p class="mb-note">In flight: ${s.orders.length}</p>` : ""}
      </div>
    </div>`;
    body.querySelectorAll("[data-order]").forEach((b) =>
      b.addEventListener("click", () => {
        const r = orderDrop(g, b.dataset.order);
        api.sfx(r.ok ? "good" : "deny");
        if (!r.ok) api.say(r.reason);
        renderComms(g);
      }),
    );
    renderTabs();
  }

  return {
    open,
    close,
    toggle,
    render,
    tick,
    get isOpen() {
      return state.open;
    },
    get tab() {
      return state.tab;
    },
    pauses() {
      return state.open && (TABS.find((t) => t.id === state.tab)?.pauses ?? true);
    },
  };
}

function itemDesc(def) {
  if (!def) return "";
  if (def.kind === "food") return "Food. Right-click or Q to eat.";
  if (def.kind === "seed") return "Plant in a Planter Bed with E.";
  if (def.o2) return `Refills ${def.o2} suit O₂.`;
  if (def.heal) return `Heals ${def.heal} HP.`;
  if (def.patch) return `Patches ${def.patch} suit integrity.`;
  if (def.charge) return `Restores ${def.charge} suit battery.`;
  if (def.drink) return `Drink for ${def.drink} hydration.`;
  if (def.tool === "drill") return `Tier ${def.tier} drill. Hold L-CLICK on deposits.`;
  if (def.tool === "shovel") return "Hold L-CLICK on open ground for regolith, sand or ice.";
  if (def.tool === "multitool") return "E to repair broken machines. Hold L-CLICK on a structure to deconstruct it.";
  if (def.tool === "scanner") return "L-CLICK or E: ping for deposits and reveal the map around you.";
  if (def.id === "beacon") return "E to plant a waypoint beacon.";
  if (def.kind === "part") return "A mission-critical part.";
  return def.kind === "raw" ? "Raw material." : "Refined material.";
}

export { ITEMS, structById, canCraft };
