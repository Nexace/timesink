import { initShell, toast, openModal, confirmDialog, escapeHtml, setStreak, getStreak } from "../../shared/shell.js";
import { icon } from "../../shared/icons.js";
import { sfx } from "../../shared/sound.js";
import { createStore, exportCode, importCode, createPrefStore } from "../../shared/storage.js";
import { dailySeedKey } from "../../shared/rng.js";
import { fmt, fmtDelta } from "../../shared/format.js";
import { RESOURCES, BUILDINGS, DOCTRINES, ACHIEVEMENTS, WIN_POPULATION, WIN_SUSTAIN_STREAK, SUFFOCATION_LIMIT } from "./data.js";
import {
  createState,
  advanceSol,
  buildOrUpgrade,
  previewNextSol,
  costFor,
  canAfford,
  isUnlocked,
  unlockHint,
  canUndo,
  undoLastSol,
  resolveRescue,
  rescueCost,
  setDoctrine,
  toSave,
  fromSave,
  seedForDaily,
  level,
  popCap,
  SAVE_VERSION,
} from "./engine.js";

const store = createStore("mars-base", { version: SAVE_VERSION });
const prefs = createPrefStore("prefs");
const fame = createStore("mars-base-fame", { version: 1 });

let state = null;
let lastStocks = null;

const refs = { res: {}, bld: {}, prow: {} };

const LOG_TYPES = new Set(["info", "good", "bad", "danger", "build"]);

const el = (id) => document.getElementById(id);

initShell();

buildStatic();
boot();
startSessionClock();
wireFullscreen();

function buildStatic() {
  const resHost = el("resources");
  resHost.innerHTML = RESOURCES.map(
    (r) => `
    <div class="res" data-res="${r.id}" style="--res-color: ${r.color}" title="${escapeHtml(r.name)}">
      <span class="res__icon">${icon(r.icon)}</span>
      <span class="res__main">
        <span class="res__name">${escapeHtml(r.name)}</span>
        <span class="res__stock" data-stock>0</span>
      </span>
      <span class="res__delta" data-delta>±0</span>
    </div>`
  ).join("");
  for (const r of RESOURCES) {
    const node = resHost.querySelector(`[data-res="${r.id}"]`);
    refs.res[r.id] = { node, stock: node.querySelector("[data-stock]"), delta: node.querySelector("[data-delta]") };
  }

  const TIER_NAMES = { 1: "FOUNDATION", 2: "EXPANSION", 3: "FUSION" };
  const bldHost = el("buildings");
  let lastTier = 0;
  bldHost.innerHTML = BUILDINGS.map((def, index) => {
    const keyHint = index === 9 ? "0" : String(index + 1);
    const tierHead = def.tier !== lastTier
      ? `<h3 class="bld__tier">TIER ${def.tier} — <b>${TIER_NAMES[def.tier] ?? ""}</b></h3>`
      : "";
    lastTier = def.tier;
    const flow = [
      ...Object.entries(def.produces).map(([res, amt]) => `<span class="flow flow--up" title="+${amt} ${res} per level per sol">${icon(resIcon(res), { size: 13 })}<span aria-hidden="true">↑</span>+${amt}</span>`),
      ...Object.entries(def.consumes).map(([res, amt]) => `<span class="flow flow--down" title="−${amt} ${res} per level per sol">${icon(resIcon(res), { size: 13 })}<span aria-hidden="true">↓</span>−${amt}</span>`),
    ].join("");
    return `${tierHead}
      <article class="bld" data-id="${def.id}">
        <span class="bld__icon">${icon(def.icon)}</span>
        <div class="bld__main">
          <div class="bld__head">
            <span class="bld__name">${escapeHtml(def.name)}</span>
            <span class="bld__level" data-level>—</span>
            <span class="kbd bld__key">${keyHint}</span>
          </div>
          <p class="bld__desc">${escapeHtml(def.desc)}</p>
          <div class="bld__flow">${flow}</div>
        </div>
        <div class="bld__side">
          <button type="button" class="btn btn--sm" data-build="${def.id}"><span data-build-label>Build</span> <span class="bld__cost" data-cost></span></button>
          <span class="bld__lock" data-lock hidden></span>
        </div>
      </article>`;
  }).join("");
  for (const def of BUILDINGS) {
    const node = bldHost.querySelector(`[data-id="${def.id}"]`);
    const button = node.querySelector("[data-build]");
    refs.bld[def.id] = {
      node,
      button,
      label: button.querySelector("[data-build-label]"),
      cost: button.querySelector("[data-cost]"),
      lock: node.querySelector("[data-lock]"),
      levelEl: node.querySelector("[data-level]"),
    };
    button.addEventListener("click", () => onBuild(def.id));
  }

  const prowHost = el("preview-rows");
  prowHost.innerHTML = RESOURCES.map(
    (r) => `
    <div class="prow" data-res="${r.id}">
      <span class="prow__name" style="--res-color: ${r.color}">${icon(r.icon, { size: 14 })} ${escapeHtml(r.name)}</span>
      <span class="prow__now" data-now>0</span>
      <span class="prow__net" data-net>±0</span>
      <span class="prow__next" data-next>0</span>
    </div>`
  ).join("");
  for (const r of RESOURCES) {
    const node = prowHost.querySelector(`[data-res="${r.id}"]`);
    refs.prow[r.id] = { now: node.querySelector("[data-now]"), net: node.querySelector("[data-net]"), next: node.querySelector("[data-next]") };
  }
}

function resIcon(resId) {
  return RESOURCES.find((r) => r.id === resId)?.icon ?? "grid";
}

function boot() {
  wireControls();
  wireKeyboard();

  const saved = store.load(null);
  if (saved) {
    const restored = fromSave(saved);
    if (restored) {
      state = restored;
      render();
      toast({ title: `RESUMED — SOL ${state.sol}`, body: "Your colony kept the lights on.", icon: "rocket" });
      if (state.pending) rescueModal();
      else if (state.status !== "playing") endModal();
      return;
    }
  }
  startFlow("normal");
}

function startFlow(mode, seedKey = null) {
  const key = mode === "daily" ? seedKey ?? dailySeedKey() : null;
  const seed = mode === "daily" ? seedForDaily(key) : undefined;
  state = createState({ mode, seed });
  if (mode === "daily") state.dailyKey = key;
  lastStocks = null;
  render();
  doctrineModal(() => {
    render();
    save();
    maybeOnboard();
  });
}

function maybeOnboard() {
  if (prefs.get("mars-base:onboarded", false)) return;
  prefs.set("mars-base:onboarded", true);
  toast({ title: "FIRST ORDERS", body: "Build power first: press 1 for a Solar Array, then 2 and 3 for water and air.", icon: "info", duration: 7000 });
}

function doctrineModal(onDone) {
  const cards = DOCTRINES.map(
    (d) => `
    <button type="button" class="doctrine" data-doctrine="${d.id}">
      <span class="doctrine__icon">${icon(d.icon)}</span>
      <span class="doctrine__name">${escapeHtml(d.name)}</span>
      <span class="doctrine__desc">${escapeHtml(d.desc)}</span>
    </button>`
  ).join("");

  const { close, el: modalEl, result } = openModal({
    title: "FOUND COLONY",
    body: `
      <p>Pick a founding doctrine. It shapes how your colony grows and cannot be changed later.</p>
      <div class="doctrine-grid">${cards}</div>
      <p class="modal__hint">You can also skip and run a balanced colony.</p>
    `,
    dismissible: false,
    actions: [{ id: "skip", label: "No doctrine", variant: "ghost" }],
  });

  modalEl.querySelectorAll("[data-doctrine]").forEach((btn) => {
    btn.addEventListener("click", () => {
      setDoctrine(state, btn.dataset.doctrine);
      sfx.build();
      close(`doctrine:${btn.dataset.doctrine}`);
      onDone?.();
    });
  });

  result.then((value) => {
    if (value === "skip") onDone?.();
  });
}

function wireControls() {
  el("btn-advance").addEventListener("click", onAdvance);
  el("btn-undo").addEventListener("click", onUndo);
  el("btn-help").addEventListener("click", helpModal);
  el("btn-export").addEventListener("click", exportModal);
  el("btn-import").addEventListener("click", importModal);
  el("btn-daily").addEventListener("click", () => resetTo("daily"));
  el("btn-yesterday")?.addEventListener("click", () => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - 1);
    resetTo("daily", dailySeedKey(d));
  });
  el("btn-reset").addEventListener("click", () => resetTo("normal"));
}

function wireKeyboard() {
  document.addEventListener("keydown", (event) => {
    if (!(event.target instanceof Element)) return;
    if (event.target.matches("input, textarea, select")) return;
    if (document.querySelector(".modal-backdrop")) return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;

    const onControl = event.target.closest("button, a");
    if (event.code === "Space") {
      if (onControl || event.repeat) return;
      event.preventDefault();
      onAdvance();
      return;
    }
    if (event.code === "Enter" && onControl) return;
    if (event.key === "u" || event.key === "U") {
      onUndo();
      return;
    }
    if (event.key === "?" || event.key === "h" || event.key === "H") {
      helpModal();
      return;
    }
    if (/^[0-9]$/.test(event.key)) {
      const index = event.key === "0" ? 9 : Number(event.key) - 1;
      const def = BUILDINGS[index];
      if (def) onBuild(def.id);
    }
  });
}

function onAdvance() {
  if (!state || state.status !== "playing" || state.pending) return;
  lastStocks = { ...state.resources };
  const report = advanceSol(state);

  sfx.sol();
  for (const ev of report.events) {
    if (ev.kind === "good") sfx.good();
    else sfx.bad();
    if (ev.id === "meteor-strike") shake();
  }
  if (report.growth) sfx.good();

  for (const id of report.achievements) {
    const a = ACHIEVEMENTS.find((x) => x.id === id);
    if (a) toast({ title: `Achievement: ${a.name}`, body: a.desc, icon: a.icon, duration: 4600 });
  }

  save();
  render();

  if (state.pending) rescueModal();
  else if (state.status !== "playing") endModal();
}

function onBuild(id) {
  if (!state || state.status !== "playing" || state.pending) return;
  const result = buildOrUpgrade(state, id);
  sfx[result.ok ? "build" : "deny"]();
  save();
  render();
}

function onUndo() {
  if (!state || !canUndo(state)) {
    sfx.deny();
    return;
  }
  undoLastSol(state);
  sfx.click();
  lastStocks = null;
  save();
  render();
  toast({ title: "REWOUND ONE SOL", icon: "undo", duration: 1600 });
}

function rescueModal() {
  const cost = state.pending?.cost ?? rescueCost(state);
  const affordable = state.resources.credits >= cost;
  openModal({
    title: "LIFE SUPPORT COLLAPSE",
    tone: "danger",
    body: `
      <p>Oxygen has been at zero too long. Your colonists are suffocating.</p>
      <p>Earth will launch an emergency rescue for <strong>${fmt(cost)} credits</strong>, restoring <strong>${fmt(Math.max(20, Math.ceil(state.population * 1.2)))} oxygen</strong> and <strong>${fmt(Math.max(10, Math.ceil(state.population * 0.8)))} water</strong> but halving all output for five sols while the colony recovers. The next rescue will cost <strong>${fmt(Math.round(cost * 1.5))} credits</strong>.</p>
      ${affordable ? "" : `<p class="modal__danger">You cannot afford the rescue.</p>`}
    `,
    dismissible: false,
    actions: affordable
      ? [
          { id: "accept", label: `Pay ${fmt(cost)} credits`, variant: "primary", onClick: () => { resolveRescue(state, true); sfx.good(); save(); render(); } },
          { id: "refuse", label: "Let it fall", variant: "danger", onClick: () => { resolveRescue(state, false); sfx.bad(); save(); render(); endModal(); } },
        ]
      : [{ id: "refuse", label: "Let it fall", variant: "danger", onClick: () => { resolveRescue(state, false); sfx.bad(); save(); render(); endModal(); } }],
  });
}

function endModal() {
  const won = state.status === "won";
  if (won) sfx.win();
  else sfx.bad();

  let streakLine = "";
  if (state.mode === "daily" && won) {
    const streak = recordDailyStreak();
    streakLine = `<p>DAILY LOGGED. STREAK: <strong>${streak}</strong> DAY${streak === 1 ? "" : "S"}.</p>`;
  }

  const sols = state.sol - 1;
  const fameOpen = qualifiesForFame(sols);
  const fameForm = fameOpen
    ? `<div class="hs-entry"><input id="fame-name" maxlength="3" placeholder="AAA" aria-label="Your initials" /><button type="button" class="btn btn--sm" id="fame-save">LOG SCORE</button></div>`
    : "";
  const recap = `
    <dl class="recap">
      <div><dt>SOLS</dt><dd>${sols}</dd></div>
      <div><dt>COLONISTS</dt><dd>${state.population}</dd></div>
      <div><dt>ORE MINED</dt><dd>${fmt(state.stats.oreMined ?? 0)}</dd></div>
      <div><dt>CREDITS EARNED</dt><dd>${fmt(state.stats.creditsEarned ?? 0)}</dd></div>
      <div><dt>STRUCTURES BUILT</dt><dd>${state.stats.buildingsBuilt ?? 0}</dd></div>
      <div><dt>EVENTS SURVIVED</dt><dd>${state.stats.events ?? 0}</dd></div>
    </dl>`;

  const { el: modalEl } = openModal({
    title: won ? "COLONY ESTABLISHED" : "COLONY LOST",
    tone: won ? "ok" : "danger",
    body: `
      <p>${won
        ? `After ${sols} sols and ${state.population} colonists, Mars is officially someone's home.`
        : `The colony lasted ${sols} sols and ended with ${state.population} colonists. Mars keeps its silence.`}</p>
      <p>ACHIEVEMENTS: <strong>${state.achievements.length}/${ACHIEVEMENTS.length}</strong></p>
      ${recap}
      ${streakLine}
      ${fameForm}
    `,
    dismissible: true,
    actions: [
      { id: "stay", label: "View colony", variant: "ghost" },
      { id: "copy", label: "Copy result", variant: "ghost", onClick: () => copyResult() },
      { id: "new", label: "New colony", variant: "primary", onClick: () => resetTo(state.mode) },
    ],
  });

  if (fameOpen && modalEl) {
    const saveBtn = modalEl.querySelector("#fame-save");
    const nameInput = modalEl.querySelector("#fame-name");
    saveBtn?.addEventListener("click", () => {
      const name = nameInput?.value?.trim() || "ACE";
      addFameEntry(name, sols);
      sfx.good();
      toast({ title: "LOGGED", body: `${name.toUpperCase().slice(0, 3)} — ${sols} SOLS`, icon: "trophy" });
    });
  }
}

function helpModal() {
  openModal({
    title: "FIELD MANUAL",
    body: `
      <ul class="manual-list">
        <li><strong>Goal:</strong> reach ${WIN_POPULATION} colonists and stay self-sustaining for ${WIN_SUSTAIN_STREAK} consecutive sols (no shortages, no brownouts).</li>
        <li><strong>Each sol</strong> (Mars day) press Advance. Buildings produce and consume resources, colonists breathe and drink, and Mars occasionally throws something at you.</li>
        <li><strong>Power</strong> gates everything: if demand exceeds supply you brown out and all other production scales down — brownouts also break your sustain streak.</li>
        <li><strong>Oxygen</strong> at zero for ${SUFFOCATION_LIMIT} sols in a row forces a rescue or ends the run.</li>
        <li><strong>Ore</strong> is both a construction material for advanced structures and an export good at the Trade Hub &mdash; spend it or sell it, not both.</li>
      </ul>
      <p class="modal__hint">Keys: <span class="kbd">Space</span> advance &middot; <span class="kbd">1</span>&ndash;<span class="kbd">0</span> build/upgrade &middot; <span class="kbd">U</span> undo &middot; <span class="kbd">?</span> help</p>
    `,
    actions: [{ id: "ok", label: "Close", variant: "primary" }],
  });
}

function exportModal() {
  const code = exportCode(toSave(state)) ?? "";
  openModal({
    title: "EXPORT COLONY",
    body: `
      <p>Copy this code to back up or share your colony.</p>
      <label class="modal__label" for="export-code">COLONY CODE</label>
      <textarea class="code-box" id="export-code" readonly rows="6">${escapeHtml(code)}</textarea>
    `,
    actions: [
      { id: "close", label: "Close", variant: "ghost" },
      {
        id: "copy",
        label: "Copy",
        variant: "primary",
        onClick: () => {
          if (!navigator.clipboard?.writeText) {
            toast({ title: "COPY UNAVAILABLE", body: "Select the text and copy it manually.", icon: "alert" });
            return false;
          }
          navigator.clipboard.writeText(code).then(
            () => toast({ title: "COPIED", icon: "check" }),
            () => toast({ title: "COPY FAILED", body: "Select the text and copy it manually.", icon: "alert" })
          );
        },
      },
    ],
  });
}

function importModal() {
  openModal({
    title: "IMPORT COLONY",
    body: `
      <p>Paste a colony code. This replaces your current save.</p>
      <label class="modal__label" for="import-input">COLONY CODE</label>
      <textarea class="code-box" id="import-input" rows="6" placeholder="Paste code here"></textarea>
    `,
    actions: [
      { id: "close", label: "Cancel", variant: "ghost" },
      {
        id: "load",
        label: "Load",
        variant: "primary",
        onClick: () => {
          const raw = el("import-input")?.value ?? "";
          const data = importCode(raw);
          let restored = null;
          try {
            restored = data ? fromSave(data) : null;
          } catch {
            restored = null;
          }
          if (!restored) {
            toast({ title: "INVALID CODE", body: "That is not a colony I recognise.", icon: "alert" });
            return false;
          }
          state = restored;
          lastStocks = null;
          save();
          render();
          toast({ title: `LOADED — SOL ${state.sol}`, icon: "check" });
        },
      },
    ],
  });
}

async function resetTo(mode, seedKey = null) {
  if (state && state.status === "playing" && state.sol > 1) {
    const ok = await confirmDialog({
      title: "Abandon this colony?",
      body: "Current progress will be discarded.",
      confirmLabel: "Abandon",
      danger: true,
    });
    if (!ok) return;
  }
  if (mode === "normal") store.clear();
  startFlow(mode, seedKey);
}

function save() {
  if (!state) return;
  if (state.mode === "normal") store.save(toSave(state));
}

function startSessionClock() {
  const started = Date.now();
  setInterval(() => {
    const s = Math.floor((Date.now() - started) / 1000);
    document.querySelectorAll("[data-session-clock]").forEach((el) => {
      el.textContent = `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
    });
  }, 1000);
}

function wireFullscreen() {
  document.querySelectorAll("[data-fullscreen-toggle]").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      else document.documentElement.requestFullscreen?.().catch(() => {});
    });
  });
}

function yesterdayKey() {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return dailySeedKey(d);
}

function recordDailyStreak() {
  const today = dailySeedKey();
  const key = state?.dailyKey ?? today;
  if (key !== today) return Number(getStreak()) || 0;
  const last = prefs.get("mars-base:lastDaily", "");
  if (last === today) return Number(getStreak()) || 0;
  const next = last === yesterdayKey() ? (Number(getStreak()) || 0) + 1 : 1;
  prefs.set("mars-base:lastDaily", today);
  setStreak(next);
  return next;
}

function resultText() {
  const mode = state.mode === "daily" ? `DAILY ${state.dailyKey ?? dailySeedKey()}` : "STANDARD";
  const outcome = state.status === "won" ? "COLONY ESTABLISHED" : "COLONY LOST";
  return `[MARS BASE // ${mode}] ${outcome} — sol ${state.sol - 1}, pop ${state.population}, ${state.achievements.length}/13 badges. Think you can do better?`;
}

function copyResult() {
  const text = resultText();
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).then(
      () => toast({ title: "RESULT COPIED", body: "Paste it anywhere to talk trash.", icon: "check" }),
      () => toast({ title: "COPY FAILED", body: text, icon: "alert", duration: 6000 })
    );
  } else {
    toast({ title: "COPY THIS", body: text, icon: "info", duration: 8000 });
  }
}

function getFame() {
  const list = fame.load([]);
  if (!Array.isArray(list)) return [];
  return list
    .filter((e) => e && Number.isFinite(e.sols))
    .sort((a, b) => a.sols - b.sols || String(a.date ?? "").localeCompare(String(b.date ?? "")))
    .slice(0, 5);
}

function qualifiesForFame(sols) {
  if (state.status !== "won") return false;
  const list = getFame();
  return list.length < 5 || sols <= list[list.length - 1].sols;
}

function addFameEntry(name, sols) {
  const list = getFame();
  list.push({ name: String(name).toUpperCase().slice(0, 3) || "ACE", sols, date: dailySeedKey(), mode: state.mode });
  list.sort((a, b) => a.sols - b.sols || String(a.date ?? "").localeCompare(String(b.date ?? "")));
  fame.save(list.slice(0, 5));
  renderFame();
}

function renderFame() {
  const host = el("hall-of-fame");
  if (!host) return;
  const list = getFame();
  if (!list.length) {
    host.innerHTML = `<p class="hs-empty">No operators yet — establish a colony to log the first run.</p>`;
    return;
  }
  host.innerHTML = `
    <table class="hs-table">
      <caption>FEWEST SOLS — TOP 5</caption>
      <thead><tr><th>#</th><th>OP</th><th>SOLS</th><th>DATE</th></tr></thead>
      <tbody>
        ${list.map((e, i) => `<tr><td class="rank">${i + 1}</td><td>${escapeHtml(e.name)}</td><td>${e.sols}</td><td>${escapeHtml(e.date)}</td></tr>`).join("")}
      </tbody>
    </table>`;
}

function shake() {
  const main = document.querySelector("main");
  if (!main) return;
  main.classList.remove("shake");
  void main.offsetWidth;
  main.classList.add("shake");
  setTimeout(() => main.classList.remove("shake"), 500);
}

function render() {
  if (!state) return;
  renderHud();
  renderResources();
  renderBuildings();
  renderPreview();
  renderLog();
  renderFame();
  renderControls();
}

function renderHud() {
  el("sol").textContent = state.sol;
  el("pop").textContent = `${state.population}/${popCap(state)}`;

  const doctrine = DOCTRINES.find((d) => d.id === state.doctrine);
  el("doctrine-badge").innerHTML = doctrine
    ? `<span class="badge badge--accent">${icon(doctrine.icon, { size: 11, strokeWidth: 2.4 })} ${escapeHtml(doctrine.name)}</span>`
    : `<span class="badge">No doctrine</span>`;

  el("mode-badge").innerHTML =
    state.mode === "daily"
      ? `<span class="badge badge--accent">${icon("clock", { size: 11, strokeWidth: 2.4 })} Daily ${escapeHtml(dailySeedKey())}</span>`
      : "";

  const banner = el("status-banner");
  if (state.status === "won") banner.innerHTML = `<span class="banner banner--win">${icon("trophy")} Colony established</span>`;
  else if (state.status === "lost") banner.innerHTML = `<span class="banner banner--lose">${icon("skull")} Colony lost</span>`;
  else if (state.pending) banner.innerHTML = `<span class="banner banner--crisis">${icon("alert")} Life support crisis</span>`;
  else banner.innerHTML = "";
}

function renderResources() {
  const preview = previewNextSol(state);
  const summary = [];
  for (const res of RESOURCES) {
    const r = refs.res[res.id];
    if (!r) continue;
    const stock = state.resources[res.id];
    const net = preview.net[res.id];
    const sign = net > 0.001 ? "up" : net < -0.001 ? "down" : "flat";

    r.stock.textContent = fmt(stock, 1);
    r.delta.textContent = fmtDelta(net, 1);
    r.delta.className = `res__delta res__delta--${sign}`;
    r.delta.setAttribute("aria-label", `per sol ${fmtDelta(net, 1)}`);

    const changed = lastStocks ? stock !== lastStocks[res.id] : false;
    r.node.classList.toggle("res--flash", changed);
    const critical = stock <= 0 || ((res.id === "oxygen" || res.id === "water") && net < -0.001 && stock < 5);
    r.node.classList.toggle("res--critical", critical);
    if (critical) r.node.setAttribute("aria-label", `${res.name} critical`);
    else r.node.removeAttribute("aria-label");
    summary.push(`${res.name} ${fmt(stock, 0)} (${fmtDelta(net, 0)})`);
  }
  const summaryEl = el("res-summary");
  if (summaryEl) summaryEl.textContent = `Sol ${state.sol}. ${summary.join(", ")}. Population ${state.population} of ${popCap(state)}.`;
}

function renderBuildings() {
  for (const def of BUILDINGS) {
    const r = refs.bld[def.id];
    const lvl = level(state, def.id);
    const unlocked = isUnlocked(state, def);
    const maxed = lvl >= def.maxLevel;
    const cost = costFor(def, lvl);
    const afford = canAfford(state, cost);

    r.node.classList.toggle("bld--locked", !unlocked);
    r.levelEl.textContent = lvl > 0 ? `Lv ${lvl}` : "—";

    if (!unlocked) {
      r.button.hidden = true;
      r.lock.hidden = false;
      r.lock.innerHTML = `${icon("lock", { size: 14 })} ${escapeHtml(unlockHint(state, def))}`;
    } else if (maxed) {
      r.button.hidden = true;
      r.lock.hidden = false;
      r.lock.innerHTML = `${icon("check", { size: 14 })} Max level`;
    } else {
      r.button.hidden = false;
      r.lock.hidden = true;
      r.label.textContent = lvl === 0 ? "Build" : "Upgrade";
      r.cost.textContent = Object.entries(cost)
        .filter(([, v]) => v > 0)
        .map(([k, v]) => `${fmt(v)}${k === "credits" ? "₡" : ""}`)
        .join(" ");
      r.button.disabled = !afford.ok;
      r.button.classList.toggle("btn--primary", afford.ok);
    }
  }
}

function renderPreview() {
  const p = previewNextSol(state);
  for (const res of RESOURCES) {
    const r = refs.prow[res.id];
    const net = p.net[res.id];
    const sign = net > 0.001 ? "up" : net < -0.001 ? "down" : "flat";
    r.now.textContent = fmt(state.resources[res.id], 1);
    r.net.textContent = fmtDelta(net, 1);
    r.net.className = `prow__net prow__net--${sign}`;
    r.next.textContent = fmt(p.projected[res.id], 1);
  }

  el("preview-notes").innerHTML = p.notes.length
    ? p.notes
        .map((n) => `<p class="note note--${n.id === "brownout" || n.id === "rescue" ? "bad" : "info"}">${icon(n.id === "brownout" ? "bolt" : n.id === "rescue" ? "alert" : "info", { size: 13 })} ${escapeHtml(n.text)}</p>`)
        .join("")
    : `<p class="note note--ok">${icon("check", { size: 13 })} All systems nominal.</p>`;

  el("win-progress").innerHTML = `
    <div class="meter" role="meter" aria-valuemin="0" aria-valuemax="50" aria-valuenow="${state.population}" aria-label="Population"><span class="meter__label" title="Population">POPULATION</span><span class="meter__bar">${segments(state.population, 50, 10)}</span><span class="meter__val">${state.population}/50</span></div>
    <div class="meter" role="meter" aria-valuemin="0" aria-valuemax="10" aria-valuenow="${state.selfSustainStreak}" aria-label="Self-sustaining sols" title="Self-sustaining sols"><span class="meter__label">SUSTAIN</span><span class="meter__bar">${segments(state.selfSustainStreak, 10, 10)}</span><span class="meter__val">${state.selfSustainStreak}/10</span></div>
  `;
}

function segments(value, max, count) {
  const filled = Math.round(Math.min(1, value / max) * count);
  let out = "";
  for (let i = 0; i < count; i += 1) out += `<i class="${i < filled ? "on" : ""}"></i>`;
  return out;
}

function renderLog() {
  el("log").innerHTML = state.log.length
    ? state.log
        .map((entry) => {
          const type = LOG_TYPES.has(entry?.type) ? entry.type : "info";
          const sol = Number.isFinite(Number(entry?.sol)) ? Math.max(1, Math.floor(Number(entry.sol))) : state.sol;
          return `<li class="log__item log__item--${type}"><span class="log__sol">SOL ${sol}</span> ${escapeHtml(entry?.text ?? "")}</li>`;
        })
        .join("")
    : `<li class="log__item log__item--info"><span class="log__sol">SOL 1</span> Touchdown confirmed. The dust settles. Begin.</li>`;
}

function renderControls() {
  el("btn-advance").disabled = state.status !== "playing" || Boolean(state.pending);
  el("btn-undo").disabled = !canUndo(state);
}
