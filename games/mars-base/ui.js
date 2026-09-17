import { initShell, toast, openModal, confirmDialog, escapeHtml, setStreak, getStreak } from "../../shared/shell.js";
import { icon } from "../../shared/icons.js";
import { sfx } from "../../shared/sound.js";
import { createStore, exportCode, importCode, createPrefStore } from "../../shared/storage.js";
import { dailySeedKey } from "../../shared/rng.js";
import { fmt, fmtDelta } from "../../shared/format.js";
import { RESOURCES, BUILDINGS, DOCTRINES, ACHIEVEMENTS } from "./data.js";
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

  const bldHost = el("buildings");
  bldHost.innerHTML = BUILDINGS.map((def, index) => {
    const keyHint = index === 9 ? "0" : String(index + 1);
    const flow = [
      ...Object.entries(def.produces).map(([res, amt]) => `<span class="flow flow--up" title="+${amt} ${res} per level per sol">${icon(resIcon(res), { size: 13 })}+${amt}</span>`),
      ...Object.entries(def.consumes).map(([res, amt]) => `<span class="flow flow--down" title="−${amt} ${res} per level per sol">${icon(resIcon(res), { size: 13 })}−${amt}</span>`),
    ].join("");
    return `
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
      toast({ title: `Resumed at sol ${state.sol}`, body: "Your colony kept the lights on.", icon: "rocket" });
      if (state.pending) rescueModal();
      else if (state.status !== "playing") endModal();
      return;
    }
  }
  startFlow("normal");
}

function startFlow(mode) {
  const seed = mode === "daily" ? seedForDaily(dailySeedKey()) : undefined;
  state = createState({ mode, seed });
  lastStocks = null;
  render();
  doctrineModal(() => {
    render();
    save();
  });
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

  const { result } = openModal({
    title: "Found a colony on Mars",
    body: `
      <p>Pick a founding doctrine. It shapes how your colony grows and cannot be changed later.</p>
      <div class="doctrine-grid">${cards}</div>
      <p class="modal__hint">You can also skip and run a balanced colony.</p>
    `,
    dismissible: false,
    actions: [{ id: "skip", label: "No doctrine", variant: "ghost" }],
  });

  document.querySelectorAll("[data-doctrine]").forEach((btn) => {
    btn.addEventListener("click", () => {
      setDoctrine(state, btn.dataset.doctrine);
      sfx.build();
      document.querySelector(".modal-backdrop")?.remove();
      document.body.style.overflow = "";
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
  el("btn-reset").addEventListener("click", () => resetTo("normal"));
}

function wireKeyboard() {
  document.addEventListener("keydown", (event) => {
    if (event.target.matches("input, textarea, select")) return;
    if (document.querySelector(".modal-backdrop")) return;

    if (event.code === "Space") {
      event.preventDefault();
      onAdvance();
      return;
    }
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
  toast({ title: "Rewound one sol", icon: "undo", duration: 1600 });
}

function rescueModal() {
  const cost = state.pending?.cost ?? rescueCost(state);
  const affordable = state.resources.credits >= cost;
  openModal({
    title: "Life support collapse",
    body: `
      <p>Oxygen has been at zero too long. Your colonists are suffocating.</p>
      <p>Earth will launch an emergency rescue for <strong>${fmt(cost)} credits</strong>, restoring oxygen and water but halving all output for five sols while the colony recovers.</p>
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
  if (state.mode === "daily") {
    const streak = recordDailyStreak();
    streakLine = `<p>DAILY LOGGED. STREAK: <strong>${streak}</strong> DAY${streak === 1 ? "" : "S"}.</p>`;
  }

  const sols = state.sol - 1;
  const fameOpen = qualifiesForFame(sols);
  const fameForm = fameOpen
    ? `<div class="hs-entry"><input id="fame-name" maxlength="3" placeholder="AAA" aria-label="Your initials" /><button type="button" class="btn btn--sm" id="fame-save">LOG SCORE</button></div>`
    : "";

  openModal({
    title: won ? "COLONY ESTABLISHED" : "COLONY LOST",
    body: `
      <p>${won
        ? `After ${sols} sols and ${state.population} colonists, Mars is officially someone's home.`
        : `The colony lasted ${sols} sols and peaked at ${state.population} colonists. Mars keeps its silence.`}</p>
      <p>BADGES: <strong>${state.achievements.length}/${ACHIEVEMENTS.length}</strong></p>
      ${streakLine}
      ${fameForm}
    `,
    dismissible: true,
    actions: [
      { id: "copy", label: "Copy result", variant: "ghost", onClick: () => copyResult() },
      { id: "new", label: "New colony", variant: "primary", onClick: () => resetTo(state.mode) },
      { id: "stay", label: "Look around", variant: "ghost" },
    ],
  });

  if (fameOpen) {
    el("fame-save")?.addEventListener("click", () => {
      const name = el("fame-name")?.value?.trim() || "ACE";
      addFameEntry(name, sols);
      sfx.good();
      toast({ title: "LOGGED", body: `${name.toUpperCase().slice(0, 3)} — ${sols} SOLS`, icon: "trophy" });
    });
  }
}

function helpModal() {
  openModal({
    title: "How to play",
    body: `
      <p><strong>Goal:</strong> reach 50 colonists and stay self-sustaining for 10 consecutive sols.</p>
      <p>Each <strong>sol</strong> (Mars day) you press Advance. Buildings produce and consume resources, colonists breathe and drink, and Mars occasionally throws something at you.</p>
      <p><strong>Power</strong> gates everything: if demand exceeds supply you brown out and all other production scales down. <strong>Oxygen</strong> at zero for three sols in a row forces a rescue or ends the run.</p>
      <p><strong>Ore</strong> is both a construction material for advanced structures and an export good at the Trade Hub &mdash; spend it or sell it, not both.</p>
      <p class="modal__hint">Keys: <span class="kbd">Space</span> advance &middot; <span class="kbd">1</span>&ndash;<span class="kbd">0</span> build/upgrade &middot; <span class="kbd">U</span> undo &middot; <span class="kbd">?</span> help</p>
    `,
    actions: [{ id: "ok", label: "Got it", variant: "primary" }],
  });
}

function exportModal() {
  const code = exportCode(toSave(state)) ?? "";
  openModal({
    title: "Export colony",
    body: `
      <p>Copy this code to back up or share your colony.</p>
      <textarea class="code-box" readonly rows="6">${escapeHtml(code)}</textarea>
    `,
    actions: [
      {
        id: "copy",
        label: "Copy",
        variant: "primary",
        onClick: () => {
          navigator.clipboard?.writeText(code).then(() => toast({ title: "Copied", icon: "check" }));
        },
      },
      { id: "close", label: "Close", variant: "ghost" },
    ],
  });
}

function importModal() {
  openModal({
    title: "Import colony",
    body: `
      <p>Paste a colony code. This replaces your current save.</p>
      <textarea class="code-box" id="import-input" rows="6" placeholder="Paste code here"></textarea>
    `,
    actions: [
      {
        id: "load",
        label: "Load",
        variant: "primary",
        onClick: () => {
          const raw = el("import-input")?.value ?? "";
          const data = importCode(raw);
          const restored = data ? fromSave(data) : null;
          if (!restored) {
            toast({ title: "Invalid code", body: "That is not a colony I recognise.", icon: "alert" });
            return;
          }
          state = restored;
          lastStocks = null;
          save();
          render();
          toast({ title: `Loaded sol ${state.sol}`, icon: "check" });
        },
      },
      { id: "close", label: "Cancel", variant: "ghost" },
    ],
  });
}

async function resetTo(mode) {
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
  startFlow(mode);
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
  if (prefs.get("lastDaily", "") === today) return getStreak();
  const next = prefs.get("lastDaily", "") === yesterdayKey() ? getStreak() + 1 : 1;
  prefs.set("lastDaily", today);
  setStreak(next);
  return next;
}

function resultText() {
  const mode = state.mode === "daily" ? `DAILY ${dailySeedKey()}` : "STANDARD";
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
  return Array.isArray(list) ? list.filter((e) => e && typeof e.sols === "number").slice(0, 5) : [];
}

function qualifiesForFame(sols) {
  if (state.status !== "won") return false;
  const list = getFame();
  return list.length < 5 || sols < list[list.length - 1].sols;
}

function addFameEntry(name, sols) {
  const list = getFame();
  list.push({ name: String(name).toUpperCase().slice(0, 3) || "ACE", sols, date: dailySeedKey() });
  list.sort((a, b) => a.sols - b.sols);
  fame.save(list.slice(0, 5));
  renderFame();
}

function renderFame() {
  const host = el("hall-of-fame");
  if (!host) return;
  const list = getFame();
  if (!list.length) {
    host.innerHTML = `<p class="modal__hint">NO OPERATORS ON RECORD. ESTABLISH A COLONY.</p>`;
    return;
  }
  host.innerHTML = `
    <table class="hs-table">
      <caption>FEWEST SOLS TO ESTABLISH</caption>
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
  for (const res of RESOURCES) {
    const r = refs.res[res.id];
    const stock = state.resources[res.id];
    const net = preview.net[res.id];
    const sign = net > 0.001 ? "up" : net < -0.001 ? "down" : "flat";

    r.stock.textContent = fmt(stock, 1);
    r.delta.textContent = fmtDelta(net, 1);
    r.delta.className = `res__delta res__delta--${sign}`;
    r.delta.setAttribute("aria-label", `per sol ${fmtDelta(net, 1)}`);

    const changed = lastStocks ? stock !== lastStocks[res.id] : false;
    r.node.classList.toggle("res--flash", changed);
  }
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
    <div class="meter"><span class="meter__label">POP</span><span class="meter__bar">${segments(state.population, 50, 10)}</span><span class="meter__val">${state.population}/50</span></div>
    <div class="meter"><span class="meter__label">SUS</span><span class="meter__bar">${segments(state.selfSustainStreak, 10, 10)}</span><span class="meter__val">${state.selfSustainStreak}/10</span></div>
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
        .map((entry) => `<li class="log__item log__item--${entry.type}"><span class="log__sol">S${entry.sol}</span> ${escapeHtml(entry.text)}</li>`)
        .join("")
    : `<li class="log__item log__item--info"><span class="log__sol">S1</span> Touchdown confirmed. The dust settles. Begin.</li>`;
}

function renderControls() {
  el("btn-advance").disabled = state.status !== "playing" || Boolean(state.pending);
  el("btn-undo").disabled = !canUndo(state);
}
