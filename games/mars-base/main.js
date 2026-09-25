import { initShell, toast, openModal, confirmDialog, escapeHtml, setStreak, getStreak, getOperator, prefersReducedMotion, setImmersive, isImmersive } from "../../shared/shell.js";
import { saveScore } from "../../shared/scores.js";
import { createStore, createPrefStore, exportCode, importCode } from "../../shared/storage.js";
import { dailySeedKey } from "../../shared/rng.js";
import { createInputManager } from "../../shared/engine.js";
import { DT, SPEEDS, MAX_TICKS_PER_FRAME, TICK_RATE, REACH, DAILY_SCORE_SOL } from "./data/balance.js";
import { itemById } from "./data/items.js";
import { structById } from "./data/structures.js";
import { ACTS, ENDINGS, OBJECTIVES } from "./data/story.js";
import { createGame, solOf, SAVE_VERSION } from "./sim/state.js";
import { step, computeScore } from "./sim/step.js";
import { serialize, deserialize } from "./sim/save.js";
import { interact, eat, scan, selectedItem } from "./sim/player.js";
import { exitRover } from "./sim/rover.js";
import { build, canPlace } from "./sim/building.js";
import { chooseEnding, tryLaunch, currentObjective } from "./sim/story.js";
import { outsideTemp, isNight, hasEffect } from "./sim/env.js";
import { roomAtTile } from "./sim/rooms.js";
import { aliveColonists } from "./sim/colonists.js";
import { createRenderer } from "./render/renderer.js";
import { createMinimap } from "./render/minimap.js";
import { createHud } from "./ui/hud.js";
import { createPanels } from "./ui/panels.js";
import { updateAmbience, sound } from "./ui/audio.js";

initShell();

const SLUG = "mars-base";
const stores = {
  campaign: createStore("mars-base-campaign", { version: SAVE_VERSION }),
  endless: createStore("mars-base-endless", { version: SAVE_VERSION }),
  daily: createStore("mars-base-daily", { version: SAVE_VERSION }),
};
const checkpoints = {
  campaign: createStore("mars-base-checkpoint", { version: SAVE_VERSION }),
};
const legacy = createStore("mars-base", { version: 1 });
const prefs = createPrefStore("prefs");
const fame = createStore("mars-base-fame-v2", { version: 1 });

const stage = document.getElementById("stage");
const canvas = document.getElementById("world");
const hudRoot = document.getElementById("hud");
const titleEl = document.getElementById("title-screen");

const renderer = createRenderer(canvas);
const minimap = createMinimap();
const hud = createHud(hudRoot);
let g = null;
let running = false;
let paused = false;
let speedIdx = 0;
let acc = 0;
let last = performance.now();
let zoom = prefs.get("mars-base:zoom", matchMedia("(max-width: 820px)").matches ? 2 : 3);
let showHints = prefs.get("mars-base:hints", true);
let buildId = null;
let ghost = null;
let scanFx = null;
let lastAutosave = performance.now();
let lastHud = 0;
let lastAmb = 0;
const reduce = prefersReducedMotion();
renderer.setReducedMotion(reduce);

// ---------- input ----------
const keys = new Set();
const mouse = { x: 0, y: 0, inside: false, left: false, right: false, lastPlaced: null };
const coarse = matchMedia("(pointer: coarse)").matches;
const touch = coarse
  ? createInputManager({
      canvas,
      buttons: [
        { id: "tUse", label: "USE" },
        { id: "tAct", label: "E" },
        { id: "tEat", label: "EAT" },
        { id: "tInv", label: "INV" },
      ],
    })
  : null;
const touchPrev = {};

function aimTile() {
  if (!g) return null;
  if (coarse && !mouse.inside) {
    // On touch, aim at the tile the astronaut faces.
    const p = g.s.player;
    const f = [[0, -1], [1, 0], [0, 1], [-1, 0]][p.dir];
    return { x: p.x + f[0] * 1.1, y: p.y + f[1] * 1.1 };
  }
  const w = renderer.screenToWorld(mouse.x, mouse.y);
  return w;
}

function inputFrame() {
  let mx = 0;
  let my = 0;
  if (keys.has("KeyA") || keys.has("ArrowLeft")) mx -= 1;
  if (keys.has("KeyD") || keys.has("ArrowRight")) mx += 1;
  if (keys.has("KeyW") || keys.has("ArrowUp")) my -= 1;
  if (keys.has("KeyS") || keys.has("ArrowDown")) my += 1;
  if (touch?.stick.active) {
    mx = touch.stick.x;
    my = touch.stick.y;
  }
  const aim = aimTile();
  const use = !buildId && (mouse.left || Boolean(touch?.button("tUse")));
  const o = window.__marsBase?.hold;
  if (o) return { mx: o.mx ?? mx, my: o.my ?? my, aim: o.aim ?? aim, use: o.use ?? use };
  return { mx, my, aim, use };
}

function panelsBlockInput() {
  return panels.isOpen || document.querySelector(".modal-backdrop") || !running;
}

window.addEventListener("keydown", (e) => {
  if (e.target instanceof Element && e.target.matches("input, textarea, select")) return;
  if (document.querySelector(".modal-backdrop")) return;
  if (!running) return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const code = e.code;
  // Panel hotkeys work whether or not a panel is open.
  const panelKeys = { Tab: "inventory", KeyI: "inventory", KeyC: "inventory", KeyB: "build", KeyT: "research", KeyM: "map", KeyJ: "journal" };
  const onGameView = document.activeElement === canvas || document.activeElement === document.body || !document.activeElement;
  if (code === "Tab" && !onGameView) return; // keep Tab for focus navigation inside panels and page chrome
  if (panelKeys[code]) {
    e.preventDefault();
    cancelBuild();
    panels.toggle(panelKeys[code]);
    sound.click();
    return;
  }
  if (code === "Escape") {
    e.preventDefault();
    if (buildId) cancelBuild();
    else if (panels.isOpen) panels.close();
    else panels.open("menu");
    return;
  }
  if (panels.isOpen) return;
  if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(code)) e.preventDefault();
  keys.add(code);
  if (e.repeat) return;
  if (code === "Space") togglePause();
  else if (code === "BracketRight" || code === "Equal") setSpeed(speedIdx + 1);
  else if (code === "BracketLeft" || code === "Minus") setSpeed(speedIdx - 1);
  else if (code === "KeyE") doInteract();
  else if (code === "KeyF") doRover();
  else if (code === "KeyQ") doEat();
  else if (code === "KeyZ") cycleZoom();
  else if (code === "KeyH") {
    showHints = !showHints;
    prefs.set("mars-base:hints", showHints);
  } else if (/^Digit[1-9]$/.test(code)) {
    g.s.sel = Number(code.slice(5)) - 1;
    cancelBuild();
  }
});
window.addEventListener("keyup", (e) => keys.delete(e.code));
window.addEventListener("blur", () => {
  keys.clear();
  mouse.left = false;
});

canvas.addEventListener("mousemove", (e) => {
  const r = canvas.getBoundingClientRect();
  mouse.x = e.clientX - r.left;
  mouse.y = e.clientY - r.top;
  mouse.inside = true;
  if (buildId && mouse.left) tryPlace();
});
canvas.addEventListener("mouseleave", () => {
  mouse.inside = false;
});
canvas.addEventListener("mousedown", (e) => {
  if (!running || panelsBlockInput()) return;
  canvas.focus({ preventScroll: true });
  if (e.button === 0) {
    mouse.left = true;
    if (buildId) {
      mouse.lastPlaced = null;
      tryPlace();
    } else {
      const it = selectedItem(g);
      const def = it && itemById(it.id);
      if (def?.tool === "scanner") handleResult(scan(g));
      else if (def && ["food", "consumable"].includes(def.kind) && !def.tool) doInteract();
    }
  } else if (e.button === 2) {
    if (buildId) cancelBuild();
    else doInteract();
  }
});
window.addEventListener("mouseup", (e) => {
  if (e.button === 0) mouse.left = false;
});
canvas.addEventListener("contextmenu", (e) => e.preventDefault());
canvas.addEventListener(
  "wheel",
  (e) => {
    if (!running || panelsBlockInput()) return;
    e.preventDefault();
    const d = Math.sign(e.deltaY);
    g.s.sel = (g.s.sel + d + 9) % 9;
    cancelBuild();
  },
  { passive: false },
);
hudRoot.querySelector("#hud-hotbar").addEventListener("click", (e) => {
  const b = e.target.closest("[data-slot]");
  if (!b || !g) return;
  g.s.sel = Number(b.dataset.slot);
  cancelBuild();
});
hudRoot.querySelectorAll("[data-open]").forEach((b) =>
  b.addEventListener("click", () => {
    cancelBuild();
    panels.toggle(b.dataset.open);
  }),
);
hudRoot.querySelector("#hud-mini").addEventListener("click", () => panels.toggle("map"));

// ---------- actions ----------
function say(text, level = "info") {
  pushAlert(text, level);
}

function handleResult(r) {
  if (!r) return;
  if (r.msg) say(r.msg, r.bad ? "warn" : r.good ? "good" : "info");
  if (r.bad) sound.deny();
  else if (r.good) sound.good();
  switch (r.ui) {
    case "crate":
      panels.open("inventory", { crateAt: r.at });
      break;
    case "craft":
      panels.open("inventory", { station: r.station });
      break;
    case "comms":
      panels.open("comms");
      break;
    case "research":
      panels.open("research");
      break;
    case "exitRover":
      if (!exitRover(g)) say("No room to climb out here.", "warn");
      else sound.airlock();
      break;
    case "enteredRover":
      sound.airlock();
      say("In the rover. W/S throttle, A/D steer, F to get out.");
      break;
    case "sleep":
      say("Lights out. The hab hums you to sleep.");
      break;
    case "mav": {
      const out = tryLaunch(g);
      if (out.ui === "ending") endingModal();
      else if (out.msg) say(out.msg);
      break;
    }
    default:
      break;
  }
}

function doInteract() {
  if (!g || g.s.status !== "playing") return;
  handleResult(interact(g, aimTile()));
}

function doRover() {
  if (!g) return;
  if (g.s.player.inRover) handleResult({ ui: "exitRover" });
  else {
    const rv = g.s.rover;
    if (Math.hypot(rv.x - g.s.player.x, rv.y - g.s.player.y) < 1.8) doInteract();
    else say("The rover is out of reach.", "warn");
  }
}

function doEat() {
  if (!g) return;
  const r = eat(g);
  if (r?.msg) say(r.msg);
  if (r?.msg?.startsWith("Ate")) sound.eat();
}

function togglePause(force) {
  paused = typeof force === "boolean" ? force : !paused;
  sound.click();
}

function setSpeed(i) {
  speedIdx = Math.max(0, Math.min(SPEEDS.length - 1, i));
  say(`Time ×${SPEEDS[speedIdx]}`);
}

function cycleZoom() {
  const zs = [2, 3, 4];
  zoom = zs[(zs.indexOf(zoom) + 1) % zs.length] ?? 3;
  prefs.set("mars-base:zoom", zoom);
  resize();
}

function startBuild(id) {
  buildId = id;
  say(`Placing ${structById(id).name}. Click to build, right-click to stop.`);
}

function cancelBuild() {
  buildId = null;
  ghost = null;
}

function tryPlace() {
  const a = aimTile();
  if (!a) return;
  const x = Math.floor(a.x);
  const y = Math.floor(a.y);
  const key = `${x},${y}`;
  if (mouse.lastPlaced === key) return;
  mouse.lastPlaced = key;
  const r = build(g, buildId, x, y);
  if (r.ok) sound.build();
  else {
    sound.deny();
    say(r.reason, "warn");
  }
}

// ---------- alerts ----------
const alertHost = hudRoot.querySelector("#hud-alerts");
const alerts = [];
function pushAlert(text, level = "info", key = null) {
  const now = performance.now();
  const k = key ?? text;
  const existing = alerts.find((a) => a.key === k);
  if (existing) {
    existing.until = now + 4200;
    return;
  }
  const el = document.createElement("div");
  el.className = `alert alert--${level}`;
  el.innerHTML = `${level === "danger" ? '<span class="alert__tag">[!]</span>' : level === "good" ? '<span class="alert__tag">[+]</span>' : ""}${escapeHtml(text)}`;
  alertHost.appendChild(el);
  alerts.push({ key: k, el, until: now + (level === "danger" ? 6500 : 4200) });
  while (alerts.length > 4) alerts.shift().el.remove();
}
function tickAlerts(now) {
  for (let i = alerts.length - 1; i >= 0; i -= 1) {
    if (now > alerts[i].until) {
      alerts[i].el.remove();
      alerts.splice(i, 1);
    }
  }
}

// ---------- fx from the sim ----------
function handleFx() {
  const list = g.fx;
  if (!list.length) return;
  g.fx = [];
  for (const f of list) {
    switch (f.kind) {
      case "alert":
        pushAlert(f.text, f.level, f.key);
        if (f.level === "danger") sound.alarm();
        else if (f.level === "warn") sound.warn();
        else if (f.level === "good") sound.good();
        break;
      case "toast":
        say(f.text);
        break;
      case "hit":
        sound.drill();
        renderer.emit(f.n === 3 ? "ice" : "dust", f.x, f.y, 4);
        break;
      case "break":
        sound.crack();
        renderer.emit(f.n === 3 ? "ice" : "dust", f.x, f.y, 14);
        break;
      case "dig":
        sound.dig();
        renderer.emit("dust", f.x, f.y, 6);
        break;
      case "pickup":
        sound.pickup();
        break;
      case "build":
        renderer.emit("dust", f.x, f.y, 8);
        minimap.markDirty();
        break;
      case "decon":
        renderer.emit("spark", f.x, f.y, 8);
        sound.crack();
        minimap.markDirty();
        break;
      case "repair":
        renderer.emit("spark", f.x, f.y, 12);
        sound.powerup();
        break;
      case "wipe":
        renderer.emit("dust", f.x, f.y, 12);
        sound.wipe();
        break;
      case "harvest":
      case "plant":
        renderer.emit("green", f.x, f.y, 8);
        sound.pickup();
        break;
      case "airlock":
        sound.airlock();
        break;
      case "blowout":
        renderer.emit("smoke", f.x + 0.5, f.y + 0.5, 30);
        renderer.shake(4);
        sound.explosion();
        break;
      case "explosion":
        renderer.emit("fire", f.x, f.y, 40);
        renderer.emit("smoke", f.x, f.y, 30);
        renderer.shake(7);
        sound.explosion();
        minimap.markDirty();
        break;
      case "impact":
        renderer.emit("fire", f.x, f.y, 16);
        renderer.emit("dust", f.x, f.y, 16);
        renderer.shake(5);
        sound.impact();
        minimap.markDirty();
        break;
      case "scan":
        scanFx = f;
        sound.scan();
        minimap.markDirty();
        break;
      case "reveal":
        minimap.markDirty();
        break;
      case "crafted":
        sound.pickup();
        break;
      case "eat":
        sound.eat();
        break;
      case "objective":
        sound.objective();
        pushAlert(`OBJECTIVE COMPLETE — ${f.text.toUpperCase()}`, "good", "obj");
        panels.render();
        break;
      case "act": {
        const act = ACTS.find((a) => a.id === f.act);
        if (act) actCard(act.name);
        break;
      }
      case "comms-message":
        pushAlert("INCOMING TRANSMISSION — OPEN COMMS", "good", "comms");
        break;
      case "choice":
        setTimeout(choiceModal, 400);
        break;
      case "dawn":
        autosave(true);
        break;
      case "lander":
      case "drop":
        renderer.emit("fire", f.x, f.y, 20);
        renderer.emit("dust", f.x, f.y, 30);
        renderer.shake(3);
        sound.impact();
        minimap.markDirty();
        break;
      case "wake":
        if (f.danger) pushAlert("WOKEN UP — SOMETHING'S WRONG", "danger");
        else pushAlert(`GOOD MORNING — SOL ${solOf(g.s.tick)}`, "good");
        break;
      case "rover-in":
      case "rover-out":
        break;
      case "research":
        panels.render();
        break;
      case "event":
        if (f.id === "dust-storm") sound.warn();
        break;
      default:
        break;
    }
  }
}

function actCard(name) {
  pushAlert(name, "good", "act");
  sound.win();
}

// ---------- objective targets for the map/HUD ----------
function objectiveTarget() {
  const obj = currentObjective(g);
  if (!obj) return null;
  const poi = (kind) => g.world.pois.find((p) => p.kind === kind);
  switch (obj.id) {
    case "rover":
      return { x: Math.floor(g.s.rover.x), y: Math.floor(g.s.rover.y) };
    case "rtg":
      return poi("rtg");
    case "lander":
    case "antenna":
      return poi("lander");
    case "mav":
      return poi("mav");
    case "scrap":
      return null;
    default:
      return null;
  }
}

// ---------- loop ----------
function frame(now) {
  const dtReal = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (running && g) {
    const s = g.s;
    const hold = paused || panels.pauses() || (document.hidden && !window.__marsBase?.ignoreHidden) || Boolean(document.querySelector(".modal-backdrop"));
    if (!hold && s.status === "playing") {
      const sleeping = s.player.sleeping;
      acc += dtReal * SPEEDS[speedIdx] * (sleeping ? 30 : 1);
      const cap = sleeping ? 900 : MAX_TICKS_PER_FRAME;
      let n = 0;
      const input = inputFrame();
      while (acc >= DT && n < cap) {
        step(g, input);
        acc -= DT;
        n += 1;
        if (g.s.status !== "playing") break;
      }
      if (n >= cap) acc = 0;
      pollTouch();
    }
    handleFx();
    if (s.status === "dead" && !g._deathShown) {
      g._deathShown = true;
      setTimeout(deathModal, 600);
    }
    if (s.status === "won" && !g._endShown && s.ending) {
      g._endShown = true;
      setTimeout(endingModal, 300);
    }
    g._objectiveTarget = objectiveTarget();

    // Build ghost + cursor
    const a = aimTile();
    const cursor = a ? { x: Math.floor(a.x), y: Math.floor(a.y) } : null;
    if (cursor) cursor.inReach = Math.hypot(cursor.x + 0.5 - s.player.x, cursor.y + 0.5 - s.player.y) <= REACH;
    if (buildId && cursor) {
      const chk = canPlace(g, buildId, cursor.x, cursor.y);
      ghost = { id: buildId, x: cursor.x, y: cursor.y, ok: chk.ok, reason: chk.reason };
    } else ghost = null;
    const view = {
      cursor: mouse.inside || coarse ? cursor : null,
      ghost,
      build: buildId,
      scan: scanFx,
      paused: paused || panels.pauses(),
      panelOpen: panels.isOpen,
      speed: SPEEDS[speedIdx],
      outsideTemp: outsideTemp(s.tick),
      showHints,
    };
    renderer.draw(g, view, dtReal, now);
    if (now - lastHud > 110) {
      lastHud = now;
      hud.update(g, view);
      minimap.draw(g, hudRoot.querySelector("#hud-mini"), { radius: 48, blink: Math.floor(now / 400) % 2 === 0 });
      panels.tick();
    }
    if (now - lastAmb > 100) {
      lastAmb = now;
      const room = s.player.inRover ? null : roomAtTile(g, Math.floor(s.player.x), Math.floor(s.player.y));
      updateAmbience({ outside: !s.player.inRover && !(room && room.sealed), storm: hasEffect(g, "dust-storm"), roverSpeed: s.rover.v, inRover: s.player.inRover, paused: view.paused });
    }
    tickAlerts(now);
    if (now - lastAutosave > 45000) autosave(false);
  } else {
    updateAmbience({ outside: false, storm: false, roverSpeed: 0, inRover: false, paused: true });
  }
  requestAnimationFrame(frame);
}

function pollTouch() {
  if (!touch) return;
  for (const id of ["tAct", "tEat", "tInv"]) {
    const down = touch.button(id);
    if (down && !touchPrev[id]) {
      if (id === "tAct") doInteract();
      if (id === "tEat") doEat();
      if (id === "tInv") panels.toggle("inventory");
    }
    touchPrev[id] = down;
  }
}

// ---------- sizing ----------
function resize() {
  const r = stage.getBoundingClientRect();
  renderer.resize(r.width, r.height, zoom);
}
new ResizeObserver(resize).observe(stage);
resize();

// ---------- saving ----------
function autosave(checkpoint) {
  if (!g || g.s.status !== "playing") return;
  lastAutosave = performance.now();
  const data = serialize(g);
  const store = stores[g.s.mode];
  store?.save(data);
  if (checkpoint && checkpoints[g.s.mode]) checkpoints[g.s.mode].save(data);
  saveScore(SLUG, computeScore(g), `${g.s.mode === "campaign" ? "Campaign" : g.s.mode === "daily" ? "Daily" : "Endless"} · sol ${solOf(g.s.tick)}`);
}
window.addEventListener("visibilitychange", () => {
  if (document.hidden) autosave(false);
});
window.addEventListener("pagehide", () => autosave(false));

function loadFrom(store) {
  const data = store.load(null);
  if (!data) return null;
  try {
    return deserialize(data);
  } catch (err) {
    console.warn("save load failed", err);
    return null;
  }
}

// ---------- modes ----------
function begin(newGame, { fresh = true } = {}) {
  g = newGame;
  renderer.resetCache();
  minimap.markDirty();
  acc = 0;
  paused = false;
  speedIdx = 0;
  cancelBuild();
  alerts.splice(0).forEach((a) => a.el.remove());
  titleEl.hidden = true;
  hudRoot.hidden = false;
  running = true;
  canvas.focus({ preventScroll: true });
  if (fresh) {
    autosave(true);
    if (g.s.mode === "campaign") introModal();
  } else {
    pushAlert(`RESUMED — SOL ${solOf(g.s.tick)}`, "good");
  }
}

function newCampaign() {
  begin(createGame({ mode: "campaign" }));
}
function newEndless(kit) {
  begin(createGame({ mode: "endless", start: kit }));
}
function newDaily() {
  const key = dailySeedKey();
  const saved = loadFrom(stores.daily);
  if (saved && saved.s.dailyKey === key && saved.s.status === "playing") {
    begin(saved, { fresh: false });
    return;
  }
  begin(createGame({ mode: "daily", seed: hashKey(key), start: "colony", dailyKey: key }));
}
function hashKey(key) {
  let h = 2166136261 >>> 0;
  for (const ch of `timesink:mars-base:v2:${key}`) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function toTitle() {
  if (g && g.s.status === "playing") autosave(false);
  running = false;
  panels.close();
  hudRoot.hidden = true;
  titleEl.hidden = false;
  renderTitle();
}

// ---------- title screen ----------
function renderTitle() {
  const menu = document.getElementById("title-menu");
  const camp = stores.campaign.exists() ? loadMeta(stores.campaign) : null;
  const endl = stores.endless.exists() ? loadMeta(stores.endless) : null;
  const items = [];
  if (camp) items.push({ id: "cont-camp", label: "CONTINUE CAMPAIGN", sub: `sol ${camp.sol}` });
  items.push({ id: "new-camp", label: "NEW CAMPAIGN", sub: "the story" });
  if (endl) items.push({ id: "cont-endless", label: "CONTINUE ENDLESS", sub: `sol ${endl.sol}` });
  items.push({ id: "endless-solo", label: "ENDLESS — SOLO", sub: "hard start" });
  items.push({ id: "endless-colony", label: "ENDLESS — COLONY KIT", sub: "sandbox-ish" });
  items.push({ id: "daily", label: "DAILY SOL", sub: dailySeedKey() });
  items.push({ id: "help", label: "FIELD MANUAL", sub: "how to play" });
  items.push({ id: "import", label: "IMPORT SAVE", sub: "" });
  menu.innerHTML = items.map((it, i) => `<button type="button" class="btn ${i === 0 ? "btn--primary" : ""}" data-t="${it.id}">${it.label} <small>${escapeHtml(it.sub)}</small></button>`).join("");
  menu.querySelectorAll("[data-t]").forEach((b) => b.addEventListener("click", () => titleAction(b.dataset.t)));
  renderFame();
  menu.querySelector("button")?.focus({ preventScroll: true });
}

function loadMeta(store) {
  const d = store.load(null);
  if (!d) return null;
  return { sol: solOf(d.tick ?? 0) };
}

async function titleAction(id) {
  sound.click();
  switch (id) {
    case "cont-camp": {
      const loaded = loadFrom(stores.campaign);
      if (loaded) begin(loaded, { fresh: false });
      else toast({ title: "SAVE CORRUPTED", body: "Starting fresh.", icon: "alert" });
      break;
    }
    case "cont-endless": {
      const loaded = loadFrom(stores.endless);
      if (loaded) begin(loaded, { fresh: false });
      break;
    }
    case "new-camp":
      if (stores.campaign.exists() && !(await confirmDialog({ title: "Start a new campaign?", body: "Your current campaign save will be overwritten.", confirmLabel: "New campaign", danger: true }))) return;
      newCampaign();
      break;
    case "endless-solo":
    case "endless-colony":
      if (stores.endless.exists() && !(await confirmDialog({ title: "Start a new endless run?", body: "Your current endless save will be overwritten.", confirmLabel: "Start", danger: true }))) return;
      newEndless(id === "endless-solo" ? "solo" : "colony");
      break;
    case "daily":
      newDaily();
      break;
    case "help":
      helpModal();
      break;
    case "import":
      importModal();
      break;
    default:
      break;
  }
}

function renderFame() {
  const host = document.getElementById("title-fame");
  const list = getFame();
  if (!list.length) {
    host.innerHTML = "No records yet. Mars is waiting.";
    return;
  }
  host.innerHTML = `<table><thead><tr><th>OP</th><th>MODE</th><th>RESULT</th><th>DATE</th></tr></thead><tbody>${list
    .slice(0, 5)
    .map((e) => `<tr><td>${escapeHtml(e.name)}</td><td>${escapeHtml(e.mode)}</td><td>${escapeHtml(e.label)}</td><td>${escapeHtml(e.date)}</td></tr>`)
    .join("")}</tbody></table>`;
}

function getFame() {
  const list = fame.load([]);
  return Array.isArray(list) ? list.filter((e) => e && typeof e.label === "string") : [];
}
function addFame(entry) {
  const list = getFame();
  list.unshift(entry);
  list.sort((a, b) => (b.rank ?? 0) - (a.rank ?? 0));
  fame.save(list.slice(0, 20));
}

// Title background: a slow pixel parallax of dunes and a tiny hab.
(function titleBg() {
  const cv = document.getElementById("title-bg");
  const c = cv.getContext("2d");
  let t0 = performance.now();
  function draw(now) {
    if (!titleEl.hidden) {
      const W = 240;
      const H = 135;
      if (cv.width !== W) {
        cv.width = W;
        cv.height = H;
      }
      const t = reduce ? 0 : (now - t0) / 1000;
      const sky = c.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, "#1a0a10");
      sky.addColorStop(0.55, "#6b2a1c");
      sky.addColorStop(1, "#c8663a");
      c.fillStyle = sky;
      c.fillRect(0, 0, W, H);
      for (let i = 0; i < 40; i += 1) {
        c.fillStyle = i % 5 ? "#6b4a5a" : "#f4e9dc";
        c.fillRect((i * 53) % W, (i * 29) % 50, 1, 1);
      }
      // sun
      c.fillStyle = "#ffd9a0";
      c.fillRect(170, 40, 6, 6);
      c.fillStyle = "rgba(255,217,160,0.25)";
      c.fillRect(167, 37, 12, 12);
      const layer = (base, amp, freq, speed, color) => {
        c.fillStyle = color;
        for (let x = 0; x < W; x += 1) {
          const y = Math.round(base + Math.sin((x + t * speed) / freq) * amp + Math.sin((x + t * speed) / (freq * 0.37)) * amp * 0.4);
          c.fillRect(x, y, 1, H - y);
        }
      };
      layer(88, 5, 30, 2, "#8a3a22");
      layer(100, 4, 22, 5, "#a8482a");
      // hab
      c.fillStyle = "#cfd3da";
      c.fillRect(60, 103, 18, 6);
      c.fillRect(63, 100, 12, 3);
      c.fillStyle = "#ffcf4a";
      if (Math.floor(t * 2) % 2 === 0) c.fillRect(69, 98, 1, 1);
      c.fillStyle = "#2f6fa8";
      c.fillRect(46, 106, 10, 3);
      layer(116, 3, 16, 10, "#c8663a");
    }
    requestAnimationFrame(draw);
  }
  requestAnimationFrame(draw);
})();

// ---------- modals ----------
function introModal() {
  openModal({
    title: "SOL 1 — HELIOS-3",
    body: `<p>The storm hit fast. The crew launched without you — a comms antenna went through your suit and your biomonitor flatlined. It was wrong.</p>
      <p>You're alone at the HELIOS-3 hab on Acidalia Planitia. There's a breach in the east wall, the Oxygenator is dead, and your suit tank is ticking down.</p>
      <p><strong>First:</strong> step outside, salvage scrap from the debris field, and patch the hab.</p>
      <ul class="manual-list">
        <li><span class="kbd">WASD</span> move · hold <span class="kbd">L-CLICK</span> to use the selected tool (drill wreckage)</li>
        <li><span class="kbd">E</span> / <span class="kbd">R-CLICK</span> interact · <span class="kbd">TAB</span> inventory &amp; crafting · <span class="kbd">B</span> build</li>
        <li><span class="kbd">SPACE</span> pause · <span class="kbd">[ ]</span> time speed · <span class="kbd">H</span> toggle hints</li>
      </ul>`,
    actions: [{ id: "go", label: "Let's science this", variant: "primary" }],
  });
}

function helpModal() {
  openModal({
    title: "FIELD MANUAL",
    body: `<ul class="manual-list">
      <li><strong>Survive.</strong> Your suit carries O₂ and battery. Inside a <em>sealed, oxygenated</em> room both refill and you drink from the water tanks. Food you eat yourself (Q), or let auto-eat handle it.</li>
      <li><strong>Rooms.</strong> Floor tiles fully enclosed by walls, glass or airlocks (or natural rock) form a room. Any gap = leak. Oxygenators fill a room with air, heaters keep it above freezing.</li>
      <li><strong>Power.</strong> Everything touching forms one grid. Solar panels need wiping (E) and fail in storms; batteries carry you through the night. On a shortfall, life support is powered first.</li>
      <li><strong>Water.</strong> Mine ice (north, or the ice lenses nearby) and drop it in a tank, or burn hydrazine at a Chem Station — in a low-oxygen room, unless you enjoy explosions. The Reclaimer recycles what the crew drinks.</li>
      <li><strong>Food.</strong> Planters need soil (regolith + compost), light (glass wall by day, or a grow lamp), warmth and water. Potatoes take 4 sols.</li>
      <li><strong>Explore.</strong> Scan (scanner tool) to reveal deposits. The rover (F) goes far but needs charge — park it next to the base to recharge. The map (M) shows discoveries and waypoints.</li>
      <li><strong>Hazards.</strong> Dust storms (warned a sol ahead), meteors (clear the marked zone), radiation storms (get inside, into the rover, or into a lava tube), equipment failures and worn airlocks.</li>
      <li><strong>Modes.</strong> Campaign tells the story. Endless scores sols survived, colonists, research. Daily Sol: everyone gets the same Mars for ${DAILY_SCORE_SOL} sols.</li>
    </ul>
    <p class="modal__hint">Keys: WASD move · L-click use tool · E/R-click interact · Q eat · 1–9 tools · TAB inventory/craft · B build · T research · M map · J journal · F rover · SPACE pause · [ ] speed · Z zoom · H hints · ESC menu</p>`,
    actions: [{ id: "ok", label: "Close", variant: "primary" }],
  });
}

function choiceModal() {
  if (!g || g.s.status !== "playing" || g.s.story.flags.choice) return;
  openModal({
    title: "THE CHOICE",
    body: `<p>The colony is self-sufficient. Mission Control confirms the old HELIOS MAV at Schiaparelli Basin is still fueled and could get one person to orbit.</p>
      <p>Go home — a long drive across Mars — or stay and found the colony for good.</p>`,
    dismissible: false,
    actions: [
      { id: "home", label: "Go home", variant: "primary", onClick: () => { chooseEnding(g, "homebound"); sound.good(); } },
      { id: "stay", label: "Stay on Mars", variant: "ghost", onClick: () => { chooseEnding(g, "founder"); } },
    ],
  });
}

function endingModal() {
  const s = g.s;
  const sols = solOf(s.tick);
  const ending = s.ending === "daily" ? { title: "DAILY SOL COMPLETE", body: `You made it to sol ${DAILY_SCORE_SOL + 1}.` } : ENDINGS[s.ending] ?? ENDINGS.homebound;
  sound.win();
  const score = computeScore(g);
  const label = s.mode === "campaign" ? `${ending.title} in ${sols} sols` : `${score} pts · sol ${sols}`;
  const rank = s.mode === "campaign" ? 100000 - sols : score;
  saveScore(SLUG, score, label);
  if (s.mode === "daily") recordDailyStreak();
  const { el } = openModal({
    title: ending.title,
    tone: "ok",
    body: `<p>${escapeHtml(ending.body)}</p>${recapHtml()}
      <div class="hs-entry"><input id="fame-name" maxlength="3" placeholder="AAA" value="${escapeHtml(getOperator())}" aria-label="Your initials" /><button type="button" class="btn btn--sm" id="fame-save">LOG RESULT</button></div>`,
    dismissible: false,
    actions: [
      { id: "copy", label: "Copy result", variant: "ghost", onClick: () => { copyResult(ending.title); return false; } },
      ...(s.ending === "founder" ? [{ id: "continue", label: "Keep building (endless)", variant: "primary", onClick: () => continueAsEndless() }] : []),
      { id: "title", label: "Title screen", variant: s.ending === "founder" ? "ghost" : "primary", onClick: () => { clearRun(); toTitle(); } },
    ],
  });
  el?.querySelector("#fame-save")?.addEventListener("click", () => {
    const name = (el.querySelector("#fame-name").value.trim() || "ACE").toUpperCase().slice(0, 3);
    addFame({ name, mode: s.mode.toUpperCase(), label, rank, date: dailySeedKey() });
    el.querySelector("#fame-save").disabled = true;
    sound.good();
  });
}

function continueAsEndless() {
  const s = g.s;
  s.mode = "endless";
  s.status = "playing";
  g._endShown = false;
  stores.campaign.clear();
  checkpoints.campaign.clear();
  autosave(true);
  pushAlert("ENDLESS MODE — THE COLONY IS YOURS", "good");
}

function clearRun() {
  if (!g) return;
  if (g.s.mode === "campaign") {
    stores.campaign.clear();
    checkpoints.campaign.clear();
  } else if (g.s.mode === "endless") stores.endless.clear();
}

function deathModal() {
  const s = g.s;
  sound.bad();
  const cause = s.deathCause ?? "the elements";
  const sols = solOf(s.tick);
  const score = computeScore(g);
  if (s.mode !== "campaign") {
    saveScore(SLUG, score, `${score} pts · sol ${sols}`);
  }
  const cp = s.mode === "campaign" && checkpoints.campaign.exists();
  const { el } = openModal({
    title: "COMMANDER LOST",
    tone: "danger",
    body: `<p>Cause of death: <strong>${escapeHtml(cause)}</strong>, sol ${sols}.</p>
      <p>${s.mode === "campaign" ? "Mars doesn't do second chances, but the hab computer does keep a dawn backup." : `Final score: <strong>${score}</strong>.`}</p>
      ${recapHtml()}
      ${s.mode !== "campaign" ? `<div class="hs-entry"><input id="fame-name" maxlength="3" placeholder="AAA" value="${escapeHtml(getOperator())}" aria-label="Your initials" /><button type="button" class="btn btn--sm" id="fame-save">LOG RESULT</button></div>` : ""}`,
    dismissible: false,
    actions: [
      ...(cp ? [{ id: "reload", label: "Load dawn backup", variant: "primary", onClick: () => { const l = loadFrom(checkpoints.campaign); if (l) begin(l, { fresh: false }); } }] : []),
      { id: "copy", label: "Copy result", variant: "ghost", onClick: () => { copyResult("COMMANDER LOST"); return false; } },
      { id: "title", label: "Title screen", variant: cp ? "ghost" : "primary", onClick: () => { if (s.mode !== "campaign") clearRun(); toTitle(); } },
    ],
  });
  el?.querySelector("#fame-save")?.addEventListener("click", () => {
    const name = (el.querySelector("#fame-name").value.trim() || "ACE").toUpperCase().slice(0, 3);
    addFame({ name, mode: s.mode.toUpperCase(), label: `${score} pts · sol ${sols}`, rank: score, date: dailySeedKey() });
    el.querySelector("#fame-save").disabled = true;
  });
  if (s.mode !== "campaign") stores[s.mode]?.clear();
}

function recapHtml() {
  const s = g.s;
  const st = s.stats;
  return `<dl class="recap">
    <div><dt>SOLS</dt><dd>${solOf(s.tick)}</dd></div>
    <div><dt>DISTANCE</dt><dd>${(st.distance / 100).toFixed(1)} km</dd></div>
    <div><dt>MINED</dt><dd>${st.mined}</dd></div>
    <div><dt>BUILT</dt><dd>${st.built}</dd></div>
    <div><dt>HARVESTED</dt><dd>${st.harvested}</dd></div>
    <div><dt>COLONISTS</dt><dd>${aliveColonists(g).length}</dd></div>
    <div><dt>RESEARCH</dt><dd>${s.research.done.length}</dd></div>
    <div><dt>SCORE</dt><dd>${computeScore(g)}</dd></div>
  </dl>`;
}

function copyResult(title) {
  const s = g.s;
  const mode = s.mode === "daily" ? `DAILY ${s.dailyKey}` : s.mode.toUpperCase();
  const text = `[MARS BASE // ${mode}] ${title} — sol ${solOf(s.tick)}, ${aliveColonists(g).length} colonists, ${computeScore(g)} pts, ${(s.stats.distance / 100).toFixed(1)} km travelled. timesink.vercel.app/games/mars-base`;
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).then(
      () => toast({ title: "RESULT COPIED", icon: "check" }),
      () => toast({ title: "COPY THIS", body: text, icon: "info", duration: 8000 }),
    );
  } else toast({ title: "COPY THIS", body: text, icon: "info", duration: 8000 });
}

function yesterdayKey() {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return dailySeedKey(d);
}
function recordDailyStreak() {
  const today = dailySeedKey();
  if (g.s.dailyKey !== today) return;
  const lastKey = prefs.get("mars-base:lastDaily", "");
  if (lastKey === today) return;
  const next = lastKey === yesterdayKey() ? (Number(getStreak()) || 0) + 1 : 1;
  prefs.set("mars-base:lastDaily", today);
  setStreak(next);
}

function exportModal() {
  const code = exportCode(serialize(g)) ?? "";
  openModal({
    title: "EXPORT SAVE",
    body: `<p>Copy this code to back up or move your run.</p><textarea class="code-box" readonly rows="6">${escapeHtml(code)}</textarea>`,
    actions: [
      { id: "close", label: "Close", variant: "ghost" },
      { id: "copy", label: "Copy", variant: "primary", onClick: () => { navigator.clipboard?.writeText(code).then(() => toast({ title: "COPIED", icon: "check" })); } },
    ],
  });
}

function importModal() {
  openModal({
    title: "IMPORT SAVE",
    body: `<p>Paste a save code. It replaces the save for that mode.</p><textarea class="code-box" id="import-input" rows="6" placeholder="Paste code here"></textarea>`,
    actions: [
      { id: "close", label: "Cancel", variant: "ghost" },
      {
        id: "load",
        label: "Load",
        variant: "primary",
        onClick: () => {
          const data = importCode(document.getElementById("import-input")?.value ?? "");
          let loaded = null;
          try {
            loaded = data ? deserialize(data) : null;
          } catch {
            loaded = null;
          }
          if (!loaded) {
            toast({ title: "INVALID CODE", body: "That's not a Mars I recognise.", icon: "alert" });
            return false;
          }
          begin(loaded, { fresh: false });
          autosave(true);
        },
      },
    ],
  });
}

// ---------- panels ----------
const panels = createPanels(stage, {
  g: () => g,
  sfx: (k) => sound[k]?.(),
  say: (t) => say(t),
  startBuild,
  drawMap: (cv) => minimap.draw(g, cv, { full: true, blink: Math.floor(performance.now() / 400) % 2 === 0 }),
  onOpen: () => {
    keys.clear();
    mouse.left = false;
  },
  onClose: () => {},
  renderMenu(body) {
    const s = g.s;
    body.innerHTML = `<div class="mb-cols"><div class="menu-list">
      <h3 class="mb-h">${escapeHtml(s.mode.toUpperCase())} · SOL ${solOf(s.tick)}</h3>
      <button type="button" class="btn btn--primary" data-m="resume">RESUME</button>
      <button type="button" class="btn" data-m="save">SAVE NOW</button>
      <button type="button" class="btn" data-m="help">FIELD MANUAL</button>
      <button type="button" class="btn" data-m="export">EXPORT SAVE</button>
      <button type="button" class="btn btn--ghost" data-m="title">SAVE &amp; QUIT TO TITLE</button>
      ${s.mode !== "daily" ? `<button type="button" class="btn btn--danger" data-m="abandon">ABANDON RUN</button>` : ""}
    </div><div>
      <h3 class="mb-h">SETTINGS</h3>
      <label class="setting"><span>Zoom</span><span><button type="button" class="hbtn" data-z="2" aria-pressed="${zoom === 2}">2×</button> <button type="button" class="hbtn" data-z="3" aria-pressed="${zoom === 3}">3×</button> <button type="button" class="hbtn" data-z="4" aria-pressed="${zoom === 4}">4×</button></span></label>
      <label class="setting"><span>Objective hints</span><input type="checkbox" data-set="hints" ${showHints ? "checked" : ""} /></label>
      <label class="setting"><span>Auto-eat</span><input type="checkbox" data-set="autoeat" ${s.autoEat ? "checked" : ""} /></label>
      <p class="mb-note">Sound and volume live in the cabinet controls at the top of the page. Motion effects follow your system's reduced-motion setting.</p>
    </div></div>`;
    body.querySelectorAll("[data-m]").forEach((b) =>
      b.addEventListener("click", async () => {
        const m = b.dataset.m;
        if (m === "resume") panels.close();
        if (m === "save") {
          autosave(true);
          say("Saved.", "good");
        }
        if (m === "help") helpModal();
        if (m === "export") exportModal();
        if (m === "title") toTitle();
        if (m === "abandon") {
          if (await confirmDialog({ title: "Abandon this run?", body: "The save will be deleted.", confirmLabel: "Abandon", danger: true })) {
            clearRun();
            running = false;
            toTitle();
          }
        }
      }),
    );
    body.querySelectorAll("[data-z]").forEach((b) =>
      b.addEventListener("click", () => {
        zoom = Number(b.dataset.z);
        prefs.set("mars-base:zoom", zoom);
        resize();
        panels.render();
      }),
    );
    body.querySelector('[data-set="hints"]')?.addEventListener("change", (e) => {
      showHints = e.target.checked;
      prefs.set("mars-base:hints", showHints);
    });
    body.querySelector('[data-set="autoeat"]')?.addEventListener("change", (e) => {
      s.autoEat = e.target.checked;
    });
  },
});

document.querySelectorAll("[data-fullscreen-toggle]").forEach((btn) =>
  btn.addEventListener("click", () => {
    // The site's fullscreen mode: the map fills the screen on every device (incl. iPhone)
    setImmersive(!isImmersive());
  }),
);

(function sessionClock() {
  const started = Date.now();
  setInterval(() => {
    const s = Math.floor((Date.now() - started) / 1000);
    document.querySelectorAll("[data-session-clock]").forEach((el) => {
      el.textContent = `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
    });
  }, 1000);
})();

// ---------- boot ----------
if (legacy.exists() && !legacy.load(null)) {
  // no-op: a newer-version blob under the old key; leave it
} else if (legacy.exists()) {
  legacy.clear();
  toast({ title: "MARS BASE 2.0", body: "The old turn-based colony was archived. Welcome to the surface.", icon: "rocket", duration: 6000 });
}
const params = new URLSearchParams(location.search);
if (params.get("mode") === "daily") newDaily();
else renderTitle();
requestAnimationFrame(frame);

// Debug/test hook for automated browser checks.
window.__marsBase = {
  get game() {
    return g;
  },
  newCampaign,
  newEndless,
  step: (n = 1) => {
    for (let i = 0; i < n; i += 1) step(g, { mx: 0, my: 0, use: false, aim: null });
  },
  TICK_RATE,
  OBJECTIVES,
  hold: null,
  // Drive frames manually (rAF is throttled in hidden tabs).
  pump(frames = 1, stepMs = 100) {
    for (let i = 0; i < frames; i += 1) {
      last = performance.now() - stepMs;
      frame(performance.now());
    }
  },
  interact: () => doInteract(),
  // Client coordinates of a world point (for synthetic mouse events in tests).
  clientOf(wx, wy) {
    const o = renderer.worldToScreen(wx, wy);
    const r = canvas.getBoundingClientRect();
    return { x: r.left + o.x * renderer.scale, y: r.top + o.y * renderer.scale };
  },
  debug: () => ({ paused, running, acc, speedIdx, panel: panels.pauses(), hidden: document.hidden, modal: Boolean(document.querySelector(".modal-backdrop")) }),
  aimAt(x, y) {
    this.hold = { ...(this.hold ?? {}), aim: { x, y } };
  },
  isNight: () => isNight(g.s.tick),
};
