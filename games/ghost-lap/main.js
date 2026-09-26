import { initShell, escapeHtml, toast } from "/shared/shell.js";
import { sfx } from "/shared/sound.js";
import { saveScore } from "/shared/scores.js";
import { setEngineHum } from "/shared/audio.js";
import { vignette, glow } from "/shared/gfx.js";
import { CIRCUITS } from "./circuits.js";
import { buildTrack, createRace, stepRace, classify, aiInput, makeField, qualifyingRun, bestQualiLap, QUALI_LAPS, PLAYER_LIVERY, DIFFICULTY, DIFFICULTY_ORDER, CAR, LIMITS, DRS_GAP, MIN_CARS, MAX_CARS, DEFAULT_CARS, halfAt } from "./race.js";
import { createWorld, drawCar, createMinimap, worldTransform } from "./render.js";
import { drawHud, fmtLap, fmtSec } from "./hud.js";
import { enableTouchLayout } from "/shared/touchlayout.js";

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

initShell({ crumb: "Ghost Lap" });

const $ = (id) => document.getElementById(id);
const canvas = $("race-canvas");
const ctx = canvas.getContext("2d");
const overlay = $("overlay");
const announcer = $("race-announcer");
// Canvas size. Desktop: the 1760x800 race view. Phones & tablets: the canvas takes the exact shape of
// its screen area (a portrait phone gets a tall view, not a letterboxed strip) at up to 2x pixel
// density, and the HUD is drawn in bigger "HUD units" (hudScale px each) so it stays readable.
let W = canvas.width;
let H = canvas.height;
let hudScale = 1;
let hudBottom = 0; // HUD units kept clear at the bottom for touch buttons drawn over the canvas
let hudTopRight = 0; // ...and at the top right for the fullscreen EXIT / CONTROLS buttons
const stageEl = $("stage");
function sizeCanvas() {
  const r = stageEl.getBoundingClientRect();
  if (!r.width || !r.height) return;
  let w = 1760;
  // Desktop keeps the 1760-wide view; its height follows the stage (800 on the page, the monitor's
  // shape in fullscreen) so nothing is ever stretched
  let h = Math.round(Math.max(560, Math.min(1400, (1760 * r.height) / r.width)));
  let u = 1;
  if (r.width < 1100) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    w = Math.round(r.width * dpr);
    h = Math.round(r.height * dpr);
    u = Math.max(0.6, w / (r.width < r.height * 1.2 ? 560 : 1200));
  }
  hudScale = u;
  const root = document.documentElement.classList;
  const coarse = !!window.matchMedia?.("(pointer: coarse)").matches;
  // The touch buttons sit over the canvas except in fullscreen portrait (there they get their own strip)
  hudBottom = coarse && !(root.contains("is-immersive") && root.contains("is-portrait")) ? (84 * (w / r.width)) / u : 0;
  hudTopRight = root.contains("is-immersive") && !root.contains("is-portrait") ? (44 * (w / r.width)) / u : 0;
  if (w !== W || h !== H) {
    canvas.width = W = w;
    canvas.height = H = h;
  }
}
new ResizeObserver(sizeCanvas).observe(stageEl);
window.addEventListener("immersivechange", sizeCanvas);
sizeCanvas();
const SIM_DT = 1 / 120;

// ==========================================
// 2025 CALENDAR
// ==========================================
const CALENDAR = [
  ["australia", "Albert Park", "Australia", "park", false],
  ["china", "Shanghai", "China", "park", false],
  ["suzuka", "Suzuka", "Japan", "park", false],
  ["bahrain", "Sakhir", "Bahrain", "desert", true],
  ["saudiarabia", "Jeddah Corniche", "Saudi Arabia", "street", true],
  ["miami", "Miami", "USA", "street", false],
  ["imola", "Imola", "Emilia-Romagna", "park", false],
  ["monaco", "Monaco", "Monaco", "street", false],
  ["spain", "Barcelona-Catalunya", "Spain", "park", false],
  ["montreal", "Gilles-Villeneuve", "Canada", "park", false],
  ["redbullring", "Red Bull Ring", "Austria", "park", false],
  ["silverstone", "Silverstone", "Great Britain", "park", false],
  ["spa", "Spa-Francorchamps", "Belgium", "park", false],
  ["hungary", "Hungaroring", "Hungary", "park", false],
  ["netherlands", "Zandvoort", "Netherlands", "park", false],
  ["monza", "Monza", "Italy", "park", false],
  ["azerbaijan", "Baku City", "Azerbaijan", "street", false],
  ["singapore", "Marina Bay", "Singapore", "street", true],
  ["usa", "Circuit of the Americas", "USA", "park", false],
  ["mexico", "Hermanos Rodríguez", "Mexico", "park", false],
  ["interlagos", "Interlagos", "Brazil", "park", false],
  ["lasvegas", "Las Vegas Strip", "USA", "street", true],
  ["qatar", "Lusail", "Qatar", "desert", true],
  ["abudhabi", "Yas Marina", "Abu Dhabi", "desert", true],
  // Classic circuits, off the current calendar
  ["india", "Buddh International", "India", "desert", false, true],
  ["malaysia", "Sepang", "Malaysia", "park", false, true],
  ["hockenheim", "Hockenheim", "Germany", "park", false, true],
  ["nurburgring", "Nürburgring", "Germany", "park", false, true],
  ["russia", "Sochi Autodrom", "Russia", "park", false, true]
].map(([key, name, country, theme, night, classic = false], k) => ({ key, name, country, theme, night, classic, round: k + 1 }));
const CAL = Object.fromEntries(CALENDAR.map((c) => [c.key, c]));

const trackCache = new Map();
function getTrack(key) {
  if (trackCache.has(key)) {
    const e = trackCache.get(key);
    trackCache.delete(key);
    trackCache.set(key, e);
    return e;
  }
  const meta = CAL[key] || CAL.monza;
  const c = CIRCUITS[meta.key];
  const track = buildTrack({ key: meta.key, name: `${meta.name} — ${meta.country}`, pts: c.pts, lengthM: c.lengthM, drs: c.drs, drsMain: c.drsMain, crossover: c.crossover, startM: c.startM, theme: meta.theme, night: meta.night });
  const entry = { meta, track, world: createWorld(track), minimap: createMinimap(track, 250) };
  trackCache.set(key, entry);
  // Worlds hold their own tile caches; keep only a couple around
  while (trackCache.size > 2) trackCache.delete(trackCache.keys().next().value);
  return entry;
}

// ==========================================
// PERSISTENCE
// ==========================================
function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...fallback, ...JSON.parse(raw) } : { ...fallback };
  } catch {
    return { ...fallback };
  }
}
function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}
const PREFS_KEY = "timesink:ghost-lap:prefs";
const RECORDS_KEY = "timesink:ghost-lap:records";
let prefs = load(PREFS_KEY, { track: "monza", gpLaps: 5, duelLaps: 3, difficulty: "medium", gpQuali: true, gpBrakes: true, gpCars: DEFAULT_CARS });
const clampCars = (n) => Math.max(MIN_CARS, Math.min(MAX_CARS, Math.round(Number(n)) || DEFAULT_CARS));
prefs.gpCars = clampCars(prefs.gpCars);
if (!CAL[prefs.track]) prefs.track = "monza";
if (!DIFFICULTY[prefs.difficulty]) prefs.difficulty = "medium";
// Real race distance: the fewest laps over 305 km (Monaco is the exception at 78 laps)
const fullLaps = (key) => (key === "monaco" ? 78 : Math.ceil(305000 / CIRCUITS[key].lengthM));
const clampLaps = (n) => clamp(Math.round(Number(n) || 3), 1, fullLaps(prefs.track));
prefs.gpLaps = clampLaps(prefs.gpLaps);
prefs.duelLaps = clampLaps(prefs.duelLaps);
let records = load(RECORDS_KEY, { races: 0, gpWins: {}, podiums: 0, duels: {}, bestLaps: {} });

const ghostKey = (track) => `timesink:ghost-lap:v5:${track}`;
function loadGhost(track) {
  try {
    const raw = localStorage.getItem(ghostKey(track));
    if (!raw) return null;
    const g = JSON.parse(raw);
    return Array.isArray(g.trail) && g.trail.length > 10 && Number.isFinite(g.time) ? g : null;
  } catch {
    return null;
  }
}
function saveGhost(track, time, trail) {
  save(ghostKey(track), { time, trail: trail.map((p) => p.map((v) => Math.round(v * 100) / 100)) });
}

// ==========================================
// CONTROLS & SETTINGS
// ==========================================
const DEFAULT_CONTROLS = {
  accel: ["KeyW", "ArrowUp"],
  brake: ["KeyS", "ArrowDown"],
  left: ["KeyA", "ArrowLeft"],
  right: ["KeyD", "ArrowRight"],
  drift: ["Space"],
  drs: ["KeyE"],
  ers: ["ShiftLeft", "ShiftRight"],
  restart: ["KeyR"]
};
const DEFAULT_SETTINGS = { steerSens: 100, brakeForce: 100, accelSens: 60, racingLine: true, playerRing: false, edgeShade: true, camRotate: false };
const ACTION_LABELS = {
  accel: "THROTTLE",
  brake: "BRAKE / REVERSE",
  left: "STEER LEFT",
  right: "STEER RIGHT",
  drift: "HANDBRAKE",
  drs: "OPEN DRS",
  ers: "DEPLOY ERS (HOLD)",
  restart: "RESTART SESSION"
};
let controls = (() => {
  const c = load("timesink:ghost-lap:controls", DEFAULT_CONTROLS);
  for (const k of Object.keys(DEFAULT_CONTROLS)) if (!Array.isArray(c[k])) c[k] = DEFAULT_CONTROLS[k].slice();
  // ERS moved from Q to Shift
  if (c.ers?.length === 1 && c.ers[0] === "KeyQ") c.ers = DEFAULT_CONTROLS.ers.slice();
  return c;
})();
let settings = load("timesink:ghost-lap:settings", DEFAULT_SETTINGS);
// Brakes can be softened but never stronger than the car's (the bots get 100% too)
settings.brakeForce = Math.max(40, Math.min(100, Number(settings.brakeForce) || 100));
let rebindingAction = null;
const saveControls = () => save("timesink:ghost-lap:controls", controls);
const saveSettings = () => save("timesink:ghost-lap:settings", settings);

function formatKeyName(code) {
  if (!code) return "NONE";
  if (code.startsWith("Key")) return code.slice(3);
  if (code.startsWith("Digit")) return code.slice(5);
  if (code.startsWith("Arrow")) return code.slice(5).toUpperCase();
  if (code === "Space") return "SPACE";
  if (code === "ShiftLeft" || code === "ShiftRight") return "SHIFT";
  return code.toUpperCase();
}
const keyLabel = (action) => [...new Set((controls[action] || []).map(formatKeyName))].join("/") || "—";

function renderKeybindsUI() {
  const grid = $("keybinds-grid");
  if (!grid) return;
  grid.innerHTML = Object.entries(ACTION_LABELS)
    .map(([action, label]) => {
      const isRebinding = rebindingAction === action;
      return `
      <div class="keybind-row">
        <span class="keybind-action">${escapeHtml(label)}</span>
        <button type="button" class="key-badge ${isRebinding ? "is-rebinding" : ""}" data-action="${action}">
          ${isRebinding ? "PRESS KEY..." : escapeHtml(keyLabel(action))}
        </button>
      </div>`;
    })
    .join("");
  updateControlsHint();
}

function updateControlsHint() {
  const hint = $("gl-controls-hint");
  if (!hint) return;
  hint.innerHTML = [
    [`${keyLabel("accel")}`, "THROTTLE"],
    [`${keyLabel("brake")}`, "BRAKE"],
    [`${keyLabel("left")} ${keyLabel("right")}`, "STEER"],
    [keyLabel("drs"), "DRS"],
    [keyLabel("ers"), "ERS"],
    [keyLabel("drift"), "HANDBRAKE"],
    ["ESC", "PAUSE"],
    [keyLabel("restart"), "RESTART"]
  ]
    .map(([k, v]) => `<span><kbd>${escapeHtml(k)}</kbd> ${escapeHtml(v)}</span>`)
    .join("");
}

function applyPreset(type) {
  sfx.click();
  const presets = {
    wasd: { accel: ["KeyW"], brake: ["KeyS"], left: ["KeyA"], right: ["KeyD"], drift: ["Space"], drs: ["KeyE"], ers: ["ShiftLeft", "ShiftRight"], restart: ["KeyR"] },
    arrows: { accel: ["ArrowUp"], brake: ["ArrowDown"], left: ["ArrowLeft"], right: ["ArrowRight"], drift: ["Space"], drs: ["KeyE"], ers: ["ShiftLeft", "ShiftRight"], restart: ["KeyR"] },
    esdf: { accel: ["KeyE"], brake: ["KeyD"], left: ["KeyS"], right: ["KeyF"], drift: ["Space"], drs: ["KeyR"], ers: ["ShiftLeft", "ShiftRight"], restart: ["KeyT"] }
  };
  if (!presets[type]) return;
  controls = presets[type];
  saveControls();
  renderKeybindsUI();
  toast({ title: "PRESET APPLIED", body: type.toUpperCase(), icon: "check" });
}

const modal = $("modal-controls");
function syncSettingsUI() {
  const ss = $("input-steer-sens");
  const bf = $("input-brake-force");
  if (ss) ss.value = settings.steerSens;
  if ($("val-steer-sens")) $("val-steer-sens").textContent = `${settings.steerSens}%`;
  const as = $("input-accel-sens");
  if (as) as.value = settings.accelSens;
  if ($("val-accel-sens")) $("val-accel-sens").textContent = `${settings.accelSens}%`;
  if (bf) bf.value = settings.brakeForce;
  if ($("val-brake-force")) $("val-brake-force").textContent = `${settings.brakeForce}%`;
  if ($("btn-toggle-line")) $("btn-toggle-line").textContent = `RACING LINE: [${settings.racingLine ? "ON" : "OFF"}]`;
  if ($("val-racing-line")) $("val-racing-line").textContent = settings.racingLine ? "ON" : "OFF";
  const onOff = (v) => (v ? "ON" : "OFF");
  if ($("btn-toggle-ring")) $("btn-toggle-ring").textContent = `PLAYER RING: [${onOff(settings.playerRing)}]`;
  if ($("val-player-ring")) $("val-player-ring").textContent = onOff(settings.playerRing);
  if ($("btn-toggle-shade")) $("btn-toggle-shade").textContent = `EDGE SHADING: [${onOff(settings.edgeShade)}]`;
  if ($("val-edge-shade")) $("val-edge-shade").textContent = onOff(settings.edgeShade);
  if ($("btn-toggle-cam")) $("btn-toggle-cam").textContent = `CAMERA: [${settings.camRotate ? "ROTATING" : "FIXED"}]`;
  if ($("val-cam-mode")) $("val-cam-mode").textContent = settings.camRotate ? "ROTATING" : "FIXED";
}
function openControlsModal() {
  sfx.click();
  rebindingAction = null;
  renderKeybindsUI();
  syncSettingsUI();
  modal.style.display = "flex";
}
function closeControlsModal() {
  sfx.click();
  rebindingAction = null;
  modal.style.display = "none";
  if (screen === "home") overlay.querySelector("button")?.focus();
}
$("btn-close-controls")?.addEventListener("click", closeControlsModal);
$("modal-controls-backdrop")?.addEventListener("click", closeControlsModal);
$("btn-save-controls")?.addEventListener("click", () => {
  saveControls();
  saveSettings();
  closeControlsModal();
  toast({ title: "CONTROLS SAVED", icon: "check" });
});
$("btn-reset-controls")?.addEventListener("click", () => {
  sfx.deny();
  controls = JSON.parse(JSON.stringify(DEFAULT_CONTROLS));
  settings = { ...DEFAULT_SETTINGS };
  saveControls();
  saveSettings();
  renderKeybindsUI();
  syncSettingsUI();
  toast({ title: "DEFAULTS RESTORED", icon: "check" });
});
document.querySelectorAll("[data-preset]").forEach((btn) => btn.addEventListener("click", () => applyPreset(btn.dataset.preset)));
$("keybinds-grid")?.addEventListener("click", (e) => {
  const badge = e.target.closest(".key-badge");
  if (!badge) return;
  sfx.click();
  rebindingAction = badge.dataset.action;
  renderKeybindsUI();
});
$("input-steer-sens")?.addEventListener("input", (e) => {
  settings.steerSens = Number(e.target.value);
  syncSettingsUI();
  saveSettings();
});
$("input-accel-sens")?.addEventListener("input", (e) => {
  settings.accelSens = Number(e.target.value);
  syncSettingsUI();
  saveSettings();
});
$("input-brake-force")?.addEventListener("input", (e) => {
  settings.brakeForce = Number(e.target.value);
  syncSettingsUI();
  saveSettings();
});
$("btn-toggle-line")?.addEventListener("click", () => {
  sfx.click();
  settings.racingLine = !settings.racingLine;
  syncSettingsUI();
  saveSettings();
});
for (const [id, key] of [["btn-toggle-ring", "playerRing"], ["btn-toggle-shade", "edgeShade"], ["btn-toggle-cam", "camRotate"]]) {
  $(id)?.addEventListener("click", () => {
    sfx.click();
    settings[key] = !settings[key];
    syncSettingsUI();
    saveSettings();
  });
}

// ==========================================
// INPUT
// ==========================================
const keys = { up: false, down: false, left: false, right: false, drift: false, drs: false, ers: false };
const matches = (code, action) => (controls[action] || []).includes(code);

window.addEventListener("keydown", (e) => {
  if (rebindingAction) {
    e.preventDefault();
    if (e.code === "Escape") {
      rebindingAction = null;
      renderKeybindsUI();
      return;
    }
    const act = rebindingAction;
    for (const a of Object.keys(controls)) if (a !== act) controls[a] = (controls[a] || []).filter((c) => c !== e.code);
    controls[act] = [e.code];
    rebindingAction = null;
    saveControls();
    renderKeybindsUI();
    sfx.good();
    return;
  }
  if (e.target instanceof Element && e.target.closest("input, textarea, select, [contenteditable]")) return;
  if (modal.style.display === "flex" || document.querySelector(".modal-backdrop")) return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;

  if (e.code === "Escape" && screen === "race" && session) {
    e.preventDefault();
    if (session.paused) resumeRace();
    else pauseRace();
    return;
  }
  if (screen !== "race") return;
  if (e.code === "Enter" && !e.repeat && canSubmitQuali()) {
    e.preventDefault();
    submitQuali();
    return;
  }
  const map = { accel: "up", brake: "down", left: "left", right: "right", drift: "drift", drs: "drs", ers: "ers" };
  let used = false;
  for (const [action, k] of Object.entries(map)) {
    if (matches(e.code, action)) {
      keys[k] = true;
      used = true;
    }
  }
  if (matches(e.code, "restart") && !e.repeat && session && !session.paused) {
    startRace(session.config);
    used = true;
  }
  if (used) e.preventDefault();
});
window.addEventListener("keyup", (e) => {
  const map = { accel: "up", brake: "down", left: "left", right: "right", drift: "drift", drs: "drs", ers: "ers" };
  for (const [action, k] of Object.entries(map)) if (matches(e.code, action)) keys[k] = false;
});
window.addEventListener("blur", () => Object.keys(keys).forEach((k) => (keys[k] = false)));

// Touch pad (the player can move and resize the buttons: MOVE CONTROLS in the stage bar)
enableTouchLayout({ id: "ghost-lap", frame: $("touch-pad"), items: [...document.querySelectorAll("#touch-pad [data-key]")].map((b) => ((b.dataset.touchId = b.dataset.key), b)) });
// Touch buttons press the same inputs as the keys. BRK is the S key: it brakes, and held at a
// standstill it drives backwards.
const TOUCH_KEYS = { brake: "down" };
document.querySelectorAll("#touch-pad [data-key]").forEach((btn) => {
  const k = TOUCH_KEYS[btn.dataset.key] || btn.dataset.key;
  const set = (v) => (e) => {
    e.preventDefault();
    keys[k] = v;
  };
  btn.addEventListener("pointerdown", set(true));
  btn.addEventListener("pointerup", set(false));
  btn.addEventListener("pointercancel", set(false));
  btn.addEventListener("pointerleave", set(false));
});

// Throttle builds up at a rate set by the acceleration sensitivity, and a traction limiter caps it at
// low speed (lifting as the car gathers pace), so launches and slow-corner exits don't light up the rears.
let throttleLevel = 0;
// No rolling starts: throttle held on the grid is ignored, and if it's still held when the lights go
// out it stays dead until released and pressed again.
let gridLock = false;
let gridWarned = false;
let lockShown = false;
function playerInput(dt = 1 / 120) {
  const sens = settings.steerSens / 100;
  const accel = Math.max(0.25, Math.min(1, (settings.accelSens ?? 60) / 100));
  const steer = ((keys.right ? 1 : 0) - (keys.left ? 1 : 0)) * Math.min(1, sens);
  if (session?.race.phase === "lights") {
    throttleLevel = 0;
    if (keys.up) {
      gridLock = true;
      if (!gridWarned) {
        gridWarned = true;
        sfx.deny();
        banner("HOLD IT!", "WAIT FOR LIGHTS OUT", "#ff9a3c", 1.6, 16);
      }
    }
    // The car can't move yet; the throttle only revs the engine on the grid
    return { throttle: keys.up ? 1 : 0, ers: false, brake: 0, steer: 0, handbrake: false, drs: false, brakeMult: 1, steerRate: 7 };
  }
  if (gridLock) {
    if (keys.up) {
      if (!lockShown) {
        lockShown = true;
        banner("THROTTLE LOCKED", `JUMPED THE LIGHTS • RELEASE ${keyLabel("accel")} AND GO AGAIN`, "#ff4d5e", 2, 14);
      }
    } else gridLock = false;
  }
  if (keys.up && !gridLock) throttleLevel = Math.min(1, throttleLevel + (0.6 + accel * 6) * dt);
  else throttleLevel = Math.max(0, throttleLevel - 9 * dt);
  const car = session?.race.player;
  const v = car ? Math.max(0, car.fwd) / CAR.top : 1;
  const traction = Math.min(1, 0.25 + accel * 0.75 + v * 1.6);
  return {
    throttle: throttleLevel * traction,
    ers: keys.ers,
    brake: keys.down ? 1 : 0,
    steer,
    handbrake: keys.drift,
    drs: keys.drs,
    brakeMult: settings.brakeForce / 100,
    steerRate: 7 * Math.max(1, sens)
  };
}

// ==========================================
// SESSION STATE
// ==========================================
let screen = "home"; // home | setup | race | results
let setupMode = "gp";
let session = null;
let demo = null;
let acc = 0;
let autopilot = false; // test hook only: lets the AI drive the player's car

// Mouse camera: drag to turn the view, wheel to zoom, double-click to reset. Kept across races.
const camView = { angle: 0, zoom: 1 };
function newCam(car) {
  return { x: car.x, y: car.y, zoom: 1, shake: 0, angle: camView.angle + (settings.camRotate ? car.heading + Math.PI / 2 : 0) };
}
let camDrag = null;
canvas.addEventListener("pointerdown", (e) => {
  if (e.button !== 0) return;
  const r = canvas.getBoundingClientRect();
  camDrag = { id: e.pointerId, cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
  camDrag.last = Math.atan2(e.clientY - camDrag.cy, e.clientX - camDrag.cx);
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener("pointermove", (e) => {
  if (!camDrag || e.pointerId !== camDrag.id) return;
  const a = Math.atan2(e.clientY - camDrag.cy, e.clientX - camDrag.cx);
  let d = a - camDrag.last;
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  // Grab-and-turn: the track follows the pointer round the centre of the screen
  camView.angle -= d;
  camDrag.last = a;
});
const endDrag = (e) => {
  if (camDrag && e.pointerId === camDrag.id) camDrag = null;
};
canvas.addEventListener("pointerup", endDrag);
canvas.addEventListener("pointercancel", endDrag);
canvas.addEventListener(
  "wheel",
  (e) => {
    e.preventDefault();
    camView.zoom = clamp(camView.zoom * Math.exp(-e.deltaY * 0.0012), 0.5, 2);
  },
  { passive: false }
);
canvas.addEventListener("dblclick", () => {
  camView.angle = 0;
  camView.zoom = 1;
});

function makeDemo() {
  const pool = CALENDAR.filter((c) => c.key !== (session?.config.track ?? ""));
  const meta = pool[Math.floor(Math.random() * pool.length)];
  const entry = getTrack(meta.key);
  const race = createRace({ track: entry.track, mode: "demo", laps: 99, difficulty: "veryHard", seed: Date.now() & 0xffff });
  race.phase = "racing";
  const cam = newCam(race.cars[0]);
  cam.zoom = 0.85;
  // Skip the grid: start the demo mid-lap so the attract loop shows real racing immediately
  for (let k = 0; k < 900; k++) stepRace(race, null, 1 / 60);
  const lead = race.order[0];
  cam.x = lead.x;
  cam.y = lead.y;
  entry.world.warm(cam, W, H);
  return { entry, race, cam, fx: newFx(), follow: 0, switchAt: performance.now() + 9000 };
}

// ==========================================
// FX: skid marks, smoke, sparks, dust
// ==========================================
function newFx() {
  return { skids: [], parts: [], last: new Map() };
}

function updateFx(fx, race, dt) {
  const track = race.track;
  for (const c of race.cars) {
    const cs = Math.cos(c.heading);
    const sn = Math.sin(c.heading);
    const rears = [
      [c.x - cs * 17 - sn * 9, c.y - sn * 17 + cs * 9],
      [c.x - cs * 17 + sn * 9, c.y - sn * 17 - cs * 9]
    ];
    const locking = c.brake > 0.8 && c.fwd > 380;
    const marking = (c.sliding > 0.25 || locking) && c.surface === "track";
    const prev = fx.last.get(c.id);
    if (marking && prev) {
      for (let w = 0; w < 2; w++) fx.skids.push([prev[w][0], prev[w][1], rears[w][0], rears[w][1], 0.55]);
      if (fx.skids.length > 1800) fx.skids.splice(0, fx.skids.length - 1800);
      if (Math.random() < 0.5) fx.parts.push({ kind: "smoke", x: rears[0][0], y: rears[0][1], vx: (Math.random() - 0.5) * 30, vy: (Math.random() - 0.5) * 30, life: 0.9, max: 0.9, r: 6 });
    }
    fx.last.set(c.id, marking ? rears : null);
    if (c.surface === "grass" && c.speed > 120 && Math.random() < 0.6) {
      const col = track.theme === "desert" ? "#c9a878" : track.theme === "street" ? "#9aa0a8" : "#8d7650";
      fx.parts.push({ kind: "dust", x: rears[Math.random() < 0.5 ? 0 : 1][0], y: rears[0][1], vx: -c.vx * 0.2 + (Math.random() - 0.5) * 60, vy: -c.vy * 0.2 + (Math.random() - 0.5) * 60, life: 0.8, max: 0.8, r: 5, col });
    }
    if (c.wallHit > 0.25) {
      for (let k = 0; k < 6; k++) fx.parts.push({ kind: "spark", x: c.x, y: c.y, vx: (Math.random() - 0.5) * 420, vy: (Math.random() - 0.5) * 420, life: 0.35, max: 0.35, r: 2 });
    }
  }
  for (const p of fx.parts) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= Math.exp(-2 * dt);
    p.vy *= Math.exp(-2 * dt);
    p.life -= dt;
    if (p.kind !== "spark") p.r += dt * 14;
  }
  fx.parts = fx.parts.filter((p) => p.life > 0);
  if (fx.parts.length > 600) fx.parts.splice(0, fx.parts.length - 600);
  for (const s of fx.skids) s[4] = Math.max(0.12, s[4] - dt * 0.004);
}

function drawFx(fx, view) {
  ctx.lineCap = "round";
  ctx.lineWidth = 3.2;
  for (const s of fx.skids) {
    if (s[0] < view.left - 20 || s[0] > view.right + 20 || s[1] < view.top - 20 || s[1] > view.bottom + 20) continue;
    ctx.strokeStyle = `rgba(8, 8, 10, ${s[4]})`;
    ctx.beginPath();
    ctx.moveTo(s[0], s[1]);
    ctx.lineTo(s[2], s[3]);
    ctx.stroke();
  }
  for (const p of fx.parts) {
    const k = p.life / p.max;
    if (p.kind === "spark") {
      ctx.fillStyle = `rgba(255, ${180 + Math.floor(k * 70)}, 90, ${k})`;
      ctx.fillRect(p.x - 1.5, p.y - 1.5, 3, 3);
    } else {
      ctx.fillStyle = p.kind === "dust" ? p.col : "#d8dbe0";
      ctx.globalAlpha = k * (p.kind === "dust" ? 0.45 : 0.3);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }
}

// ==========================================
// RACE FLOW
// ==========================================
function startRace(config) {
  throttleLevel = 0;
  gridLock = false;
  gridWarned = false;
  lockShown = false;
  prefs.track = config.track;
  if (config.mode === "gp") prefs.gpLaps = config.laps;
  if (config.mode === "duel") prefs.duelLaps = config.laps;
  if (config.mode !== "trial") prefs.difficulty = config.difficulty;
  save(PREFS_KEY, prefs);

  const entry = getTrack(config.track);
  const quali = config.stage === "quali";
  const race = createRace({
    track: entry.track,
    mode: quali ? "trial" : config.mode,
    laps: quali ? Infinity : config.laps,
    difficulty: config.difficulty,
    seed: (Date.now() & 0xffffff) + 1,
    grid: quali ? null : config.grid || null,
    // Grand Prix option: brakes heat up, fade when overheated and wear out (for every car)
    brakes: config.mode === "gp" && prefs.gpBrakes !== false
  });
  const cam = newCam(race.player);
  cam.zoom = 1.05;
  entry.world.setGridCount(race.cars.length);
  entry.world.warm(cam, W, H);
  const ghost = config.mode === "trial" || quali ? loadGhost(config.track) : null;
  session = {
    config,
    entry,
    race,
    cam,
    fx: newFx(),
    banners: [],
    paused: false,
    endAt: 0,
    ghost,
    ghostDist: ghost ? monotone(ghost.trail.map((p) => p[4])) : null,
    rec: [],
    recT: 0,
    lastLaps: race.player.laps,
    delta: null,
    qualiLaps: [],
    qualiBoard: quali ? createQualiBoard(config.field) : null
  };
  acc = 0;
  Object.keys(keys).forEach((k) => (keys[k] = false));
  screen = "race";
  overlay.hidden = true;
  overlay.innerHTML = "";
  canvas.focus({ preventScroll: true });
  if (quali) banner(`QUALIFYING • ${QUALI_LAPS} LAPS`, "Go from the line: lap 1 includes the start, laps 2 and 3 are flying. Your best clean lap sets your grid slot", "#00f0ff", 4);
  else if (config.mode === "trial") banner("TIME TRIAL", ghost ? `Beat your ghost: ${fmtSec(ghost.time)}` : "Cross the line to start a flying lap", "#00f0ff", 3.5);
  else {
    const slot = race.cars.findIndex((c) => c.isPlayer) + 1;
    const where = config.mode === "gp" ? ` • STARTING P${slot}` : "";
    banner(config.mode === "gp" ? "GRAND PRIX" : "DUEL", `${CAL[config.track].name.toUpperCase()} • ${config.laps} LAPS • ${DIFFICULTY[config.difficulty].label}${where}`, "#ffd400", 3.5);
  }
  announce(`${CAL[config.track].name}. ${quali ? "Qualifying" : config.mode === "trial" ? "Time trial" : `${config.laps} laps`}.`);
}

// A Grand Prix weekend: one-lap qualifying sets the grid, or (if skipped) you get a random slot
function startGrandPrix(base) {
  const seed = (Date.now() & 0xffffff) + 7;
  const field = makeField({ mode: "gp", difficulty: base.difficulty, seed, cars: base.cars || DEFAULT_CARS });
  if (prefs.gpQuali) return startRace({ ...base, stage: "quali", field });
  const slot = Math.floor(Math.random() * (field.length + 1));
  startRace({ ...base, stage: "race", grid: [...field.slice(0, slot), "player", ...field.slice(slot)] });
}

function monotone(arr) {
  let m = -Infinity;
  return arr.map((v) => (m = Math.max(m, v)));
}

function banner(text, sub, color = "#ffffff", secs = 2.4, size = 16) {
  if (!session) return;
  const now = performance.now() / 1000;
  session.banners = session.banners.filter((b) => b.until > now).slice(-2);
  session.banners.push({ text, sub, color, at: now, until: now + secs, size });
}
function announce(msg) {
  if (announcer) announcer.textContent = msg;
}

function handleEvents(race) {
  const s = session;
  const pid = race.player?.id;
  for (const e of race.events) {
    if (e.type === "light") sfx.click();
    else if (e.type === "go") {
      sfx.rev();
      banner("LIGHTS OUT", "AND AWAY WE GO!", "#22e36b", 2.2, 20);
      announce("Lights out.");
    } else if (e.type === "reaction") {
      if (e.time < 0.2) banner("ROCKET START", `REACTION ${e.time.toFixed(3)}s`, "#22e36b", 1.8);
    } else if (e.car !== pid && e.type !== "flag") continue;
    else if (e.type === "sector") {
      // colour shown in the HUD
    } else if (e.type === "lap" && s.config.stage === "quali") {
      // Qualifying: three timed laps in a row, the best clean one counts
      s.qualiLaps.push({ time: e.time, valid: e.valid });
      const n = s.qualiLaps.length;
      const best = Math.min(...s.qualiLaps.filter((l) => l.valid).map((l) => l.time));
      const isBest = e.valid && e.time <= best;
      if (isBest) sfx.good();
      const bestTxt = Number.isFinite(best) ? `BEST ${fmtSec(best)}` : "NO CLEAN LAP YET";
      banner(
        `QUALI LAP ${n}/${QUALI_LAPS}${e.valid ? "" : " DELETED"}`,
        `${fmtSec(e.time)}${isBest && n > 1 ? " • NEW BEST" : ""} • ${n < QUALI_LAPS ? `${bestTxt} • ${QUALI_LAPS - n} TO GO` : bestTxt}`,
        e.valid ? (isBest ? "#22e36b" : "#ffffff") : "#ff4d5e",
        2.8
      );
      announce(`Qualifying lap ${n}: ${fmtSec(e.time)}${e.valid ? "" : ", deleted"}.`);
      onTrialLap(e, race.player);
      const me = s.qualiBoard?.rows.find((r) => r.entry === "player");
      if (me) boardLap(s.qualiBoard, me, { time: e.time, valid: e.valid });
      if (n >= QUALI_LAPS) s.endAt = performance.now() + 1800;
    } else if (e.type === "lap") {
      const c = race.player;
      if (!e.valid) banner(`LAP ${e.lap} DELETED`, `${fmtSec(e.time)} • TRACK LIMITS`, "#ff4d5e", 2.6);
      else if (e.fastest && race.mode !== "trial") {
        sfx.powerup();
        banner("FASTEST LAP", fmtSec(e.time), "#b44dff", 2.6);
      } else if (e.personalBest) {
        sfx.good();
        banner(race.mode === "trial" ? "PERSONAL BEST" : `LAP ${e.lap}`, fmtSec(e.time), "#22e36b", 2.6);
      } else {
        banner(`LAP ${e.lap}`, fmtSec(e.time), "#ffffff", 2);
      }
      announce(`Lap ${e.lap}: ${fmtSec(e.time)}${e.valid ? "" : ", deleted"}.`);
      if (race.mode === "trial") onTrialLap(e, c);
      if (race.mode !== "trial" && !c.finished && c.laps === race.laps - 1) banner("FINAL LAP", "", "#ffd400", 2);
    } else if (e.type === "limits") {
      sfx.warn();
      if (e.penalty) banner(`${e.penalty} SECOND PENALTY`, `TRACK LIMITS • STRIKE ${e.strikes}`, "#ff4d5e", 3);
      else if (race.mode === "trial") banner("TRACK LIMITS", "LAP TIME DELETED", "#ff9a3c", 2.2);
      else banner("TRACK LIMITS", `WARNING ${Math.min(LIMITS.warnings, e.strikes)}/${LIMITS.warnings}${e.strikes === LIMITS.warnings ? " • BLACK & WHITE FLAG" : ""}`, "#ff9a3c", 2.4);
    } else if (e.type === "cut") {
      sfx.warn();
      if (e.penalty) banner("CORNER CUT", `+${e.penalty} SECOND PENALTY • LAP DELETED`, "#ff4d5e", 2.6);
      else if (e.warning) banner("CORNER CUT", "WARNING • NEXT ONE IS A PENALTY • LAP DELETED", "#ff9a3c", 2.6);
      else banner("CORNER CUT", "LAP TIME DELETED", "#ff4d5e", 2.6);
    } else if (e.type === "noAdvantage") {
      banner("OFF TRACK", "NO ADVANTAGE • NO STRIKE", "#8a95a8", 1.4, 12);
    } else if (e.type === "brakesHot") {
      sfx.warn();
      banner("BRAKES OVERHEATING", "THEY'RE FADING • BRAKE EARLIER AND LIGHTER, LIFT AND COAST", "#ff4d5e", 2.6, 14);
      announce("Brakes overheating.");
    } else if (e.type === "brakesWorn") {
      sfx.warn();
      banner("BRAKES WORN", "LESS STOPPING POWER • BRAKE EARLIER", "#ff9a3c", 2.8, 14);
      announce("Brakes worn.");
    } else if (e.type === "drsDetect") {
      const gap = Number.isFinite(e.gap) ? `+${e.gap.toFixed(2)}s` : "NO CAR IN FRONT";
      banner("DRS DETECTION", e.eligible ? `${gap} • DRS ENABLED FOR THE NEXT ZONE` : `${gap} • NEED UNDER ${DRS_GAP.toFixed(1)}s`, e.eligible ? "#22e36b" : "#8a95a8", 1.8, 12);
    } else if (e.type === "ersBlocked") {
      const why = { drs: "NOT WITH DRS OPEN", empty: "BATTERY FLAT • BRAKE TO HARVEST", throttle: "NEEDS THROTTLE" }[e.reason];
      if (e.reason !== "throttle") {
        sfx.deny();
        banner("ERS LOCKED", why, "#8a95a8", 1.6, 12);
      }
    } else if (e.type === "drsReady") {
      banner("DRS ENABLED", `PRESS ${keyLabel("drs")} TO OPEN THE FLAP`, "#22e36b", 1.6, 12);
    } else if (e.type === "drs") {
      sfx.coin();
    } else if (e.type === "wall") {
      sfx.hit();
      s.cam.shake = Math.min(12, e.speed / 40);
    } else if (e.type === "contact") {
      sfx.hit();
      s.cam.shake = Math.min(8, e.speed / 50);
    } else if (e.type === "flag") {
      banner("CHEQUERED FLAG", e.car === pid ? "YOU WIN!" : "", "#ffffff", 3);
    } else if (e.type === "finish" && e.car === pid) {
      s.endAt = performance.now() + 3200;
      const pos = race.order.findIndex((c) => c.isPlayer) + 1;
      if (pos === 1) sfx.win();
      else sfx.good();
      banner(`P${pos}`, race.mode === "duel" ? (pos === 1 ? "DUEL WON" : "DUEL LOST") : "FINISH", pos === 1 ? "#ffd400" : "#ffffff", 3.2, 22);
    }
  }
}

function onTrialLap(e, car) {
  const s = session;
  const trail = s.rec;
  s.rec = [];
  s.recT = 0;
  if (!e.valid || trail.length < 20) return;
  if (!s.ghost || e.time < s.ghost.time) {
    s.ghost = { time: e.time, trail };
    s.ghostDist = monotone(trail.map((p) => p[4]));
    saveGhost(s.config.track, e.time, trail);
    const prev = records.bestLaps[s.config.track];
    if (!prev || e.time < prev) {
      records.bestLaps[s.config.track] = e.time;
      save(RECORDS_KEY, records);
    }
    saveScore("ghost-lap", Math.round(e.time * 1000), `${fmtSec(e.time)} at ${CAL[s.config.track].name}`, { lowerIsBetter: true });
  }
}

function ghostAt(g, t) {
  const tr = g.trail;
  if (!tr.length || t > tr[tr.length - 1][0]) return null;
  let lo = 0;
  let hi = tr.length - 1;
  while (hi - lo > 1) {
    const m = (lo + hi) >> 1;
    if (tr[m][0] < t) lo = m;
    else hi = m;
  }
  const a = tr[lo];
  const b = tr[hi];
  const f = b[0] > a[0] ? Math.min(1, Math.max(0, (t - a[0]) / (b[0] - a[0]))) : 0;
  let dh = b[3] - a[3];
  while (dh > Math.PI) dh -= Math.PI * 2;
  while (dh < -Math.PI) dh += Math.PI * 2;
  return { x: a[1] + (b[1] - a[1]) * f, y: a[2] + (b[2] - a[2]) * f, heading: a[3] + dh * f };
}

function ghostDelta(s, lapT, dist) {
  const d = s.ghostDist;
  const tr = s.ghost.trail;
  if (dist <= d[0]) return null;
  if (dist >= d[d.length - 1]) return lapT - tr[tr.length - 1][0];
  let lo = 0;
  let hi = d.length - 1;
  while (hi - lo > 1) {
    const m = (lo + hi) >> 1;
    if (d[m] < dist) lo = m;
    else hi = m;
  }
  const f = d[hi] > d[lo] ? (dist - d[lo]) / (d[hi] - d[lo]) : 0;
  return lapT - (tr[lo][0] + (tr[hi][0] - tr[lo][0]) * f);
}

function pauseRace() {
  if (!session || session.paused) return;
  session.paused = true;
  setEngineHum(false);
  sfx.click();
  overlay.hidden = false;
  overlay.innerHTML = `
    <div class="gl-menu gl-menu--small">
      <p class="gl-kicker">SESSION PAUSED</p>
      <h2 class="gl-heading">${escapeHtml(CAL[session.config.track].name.toUpperCase())}</h2>
      <div class="gl-menu__list">
        <button type="button" class="btn btn--primary" data-act="resume">RESUME <small>Esc</small></button>
        <button type="button" class="btn" data-act="restart">RESTART <small>${escapeHtml(keyLabel("restart"))}</small></button>
        <button type="button" class="btn" data-act="controls">CONTROLS <small>keys &amp; tuning</small></button>
        ${session.config.mode !== "trial" ? `<button type="button" class="btn" data-act="retire">RETIRE <small>see classification</small></button>` : ""}
        <button type="button" class="btn" data-act="quit">QUIT TO MENU</button>
      </div>
    </div>`;
  overlay.querySelector("button")?.focus();
}
function resumeRace() {
  if (!session) return;
  session.paused = false;
  overlay.hidden = true;
  overlay.innerHTML = "";
  acc = 0;
  canvas.focus({ preventScroll: true });
}

// Qualifying: after the first timed lap the player can keep their best lap and skip the rest
const submitBtn = $("quali-submit");
const canSubmitQuali = () =>
  !!session && screen === "race" && !session.paused && session.config.stage === "quali" && session.qualiLaps.length >= 1 && session.qualiLaps.length < QUALI_LAPS && !session.endAt;
function submitQuali() {
  if (!canSubmitQuali()) return;
  sfx.click();
  session.endAt = 0;
  finishSession(false);
}
submitBtn?.addEventListener("click", submitQuali);
let submitShown = null;
function syncQualiSubmit() {
  const show = canSubmitQuali();
  const clean = show && session.qualiLaps.some((l) => l.valid);
  const key = show ? (clean ? "submit" : "end") : "hide";
  if (key === submitShown || !submitBtn) return;
  submitShown = key;
  submitBtn.hidden = !show;
  submitBtn.classList.toggle("is-end", key === "end");
  submitBtn.innerHTML = key === "end" ? "END QUALIFYING (NO CLEAN LAP) <small>ENTER</small>" : "SUBMIT LAP &#10003; <small>ENTER</small>";
}

function finishSession(retired = false) {
  const s = session;
  const race = s.race;
  setEngineHum(false);
  if (s.config.stage === "quali") return showQualifying();
  if (race.mode === "trial") return goHome();
  const rows = classify(race);
  const me = rows.find((r) => r.car.isPlayer);
  records.races += 1;
  if (!retired && me) {
    if (race.mode === "gp") {
      if (me.pos === 1) records.gpWins[race.difficulty] = (records.gpWins[race.difficulty] || 0) + 1;
      if (me.pos <= 3) records.podiums += 1;
    } else {
      const d = (records.duels[race.difficulty] = records.duels[race.difficulty] || { w: 0, l: 0 });
      if (me.pos === 1) d.w += 1;
      else d.l += 1;
    }
    saveScore("ghost-lap", Math.round(me.time * 1000), `P${me.pos} ${race.mode === "gp" ? "Grand Prix" : "Duel"} at ${CAL[s.config.track].name} (${DIFFICULTY[race.difficulty].label})`, { lowerIsBetter: true });
  }
  save(RECORDS_KEY, records);
  showResults(rows, retired);
}

// ── Live qualifying board ──
// The rivals run the same three laps from the line on their own empty track, pushing harder than in the race. Each
// bot's run is worked out up front (one bot per frame, so nothing stutters), then its laps are revealed
// on the board at the moment they'd cross the line: bots head out at staggered times, like real
// qualifying. The final grid uses exactly the same laps, so the board and the results always agree.
function createQualiBoard(field) {
  const rows = [
    { entry: "player", code: PLAYER_LIVERY.code, color: PLAYER_LIVERY.color, laps: [], best: Infinity, flashAt: -99 },
    ...field.map((f) => ({ entry: f, code: f.livery.code, color: f.livery.color, run: null, start: 0, frac: Math.random(), laps: [], best: Infinity, flashAt: -99 }))
  ];
  return { rows, pending: rows.filter((r) => r.entry !== "player"), fastest: Infinity };
}

function runBot(board, row, track) {
  row.run = qualifyingRun(track, row.entry.skill);
  // Out on track some time within the first lap and a half of the session
  row.start = row.frac * (Number.isFinite(row.run[0].time) ? row.run[0].time : 40) * 1.5;
  board.pending = board.pending.filter((r) => r !== row);
}

// A lap has come in: update that driver's best, the board's fastest, and flash the row
function boardLap(board, row, lap) {
  row.laps.push(lap);
  const wasPole = board.rows.every((r) => r === row || row.best <= r.best);
  const pb = lap.valid && lap.time < row.best;
  if (pb) row.best = lap.time;
  const overall = pb && lap.time < board.fastest;
  if (overall) board.fastest = lap.time;
  row.flashAt = performance.now();
  row.flash = !lap.valid ? "#ff4d5e" : overall ? "#b44dff" : pb ? "#22e36b" : "#ffd23f";
  row.flashTime = lap.time;
  row.flashValid = lap.valid;
  // Somebody else takes provisional pole: tell the player
  if (overall && row.entry !== "player" && !wasPole && board.rows.filter((r) => Number.isFinite(r.best)).length > 1) {
    banner("PROVISIONAL POLE", `${row.code} • ${fmtSec(lap.time)}`, "#b44dff", 1.8, 12);
  }
}

function updateQualiBoard(s) {
  const board = s.qualiBoard;
  if (board.pending.length) runBot(board, board.pending[0], s.race.track);
  const t = s.race.t;
  for (const row of board.rows) {
    if (!row.run) continue;
    let end = row.start;
    for (let k = 0; k < row.run.length; k++) {
      end += Number.isFinite(row.run[k].time) ? row.run[k].time : 60;
      if (k < row.laps.length) continue;
      if (t >= end) boardLap(board, row, row.run[k]);
      break;
    }
  }
}

/** Rows for the HUD tower, quickest first; drivers without a time yet sit below, in the order they went out. */
function qualiBoardRows(s) {
  const board = s.qualiBoard;
  const t = s.race.t;
  const now = performance.now();
  const rows = board.rows.map((r) => {
    let status;
    if (r.entry === "player") status = r.laps.length >= QUALI_LAPS ? "DONE" : `L${r.laps.length + 1}/${QUALI_LAPS}`;
    else if (!r.run || t < r.start) status = "GARAGE";
    else status = r.laps.length >= QUALI_LAPS ? "DONE" : `L${r.laps.length + 1}/${QUALI_LAPS}`;
    const flashing = now - r.flashAt < 3000;
    return { code: r.code, color: r.color, isPlayer: r.entry === "player", best: r.best, status, flash: flashing ? r.flash : null, flashTime: r.flashTime, flashValid: r.flashValid };
  });
  rows.sort((a, b) => a.best - b.best || (a.status === "GARAGE") - (b.status === "GARAGE"));
  return rows;
}

function showQualifying() {
  const s = session;
  screen = "results";
  const track = s.race.track;
  const mine = Math.min(...s.qualiLaps.filter((l) => l.valid).map((l) => l.time));
  // Rivals keep their full three-lap runs (the same laps the live board was showing)
  const board = s.qualiBoard;
  while (board.pending.length) runBot(board, board.pending[0], track);
  const rows = [
    { entry: "player", name: PLAYER_LIVERY.name, code: PLAYER_LIVERY.code, color: PLAYER_LIVERY.color, time: mine },
    ...board.rows
      .filter((r) => r.entry !== "player")
      .map((r) => ({ entry: r.entry, name: r.entry.livery.name, code: r.code, color: r.color, time: bestQualiLap(r.run) }))
  ].sort((a, b) => a.time - b.time);
  s.qualiGrid = rows.map((r) => r.entry);
  const pole = rows[0].time;
  const myPos = rows.findIndex((r) => r.entry === "player") + 1;
  if (myPos === 1 && Number.isFinite(mine)) sfx.win();
  else sfx.good();
  const body = rows
    .map((r, k) => {
      const t = Number.isFinite(r.time) ? (k === 0 ? fmtSec(r.time) : `+${(r.time - pole).toFixed(3)}`) : "NO TIME";
      return `<tr class="${r.entry === "player" ? "is-you" : ""}">
        <td>${k + 1}</td>
        <td><i style="background:${r.color}"></i>${escapeHtml(r.name)} <small>${escapeHtml(r.code)}</small></td>
        <td>${t}</td>
      </tr>`;
    })
    .join("");
  const title = !Number.isFinite(mine) ? "NO TIME" : myPos === 1 ? "POLE POSITION" : `QUALIFIED P${myPos}`;
  const note = !Number.isFinite(mine)
    ? `No clean lap in ${s.qualiLaps.length || QUALI_LAPS} tries (track limits), so you start from the back of the grid.`
    : `Your laps: ${s.qualiLaps.map((l) => (l.valid ? fmtSec(l.time) : "deleted")).join(" • ")}. ${s.qualiLaps.length < QUALI_LAPS ? `Submitted after ${s.qualiLaps.length} of ${QUALI_LAPS} laps.` : `Best of ${QUALI_LAPS} counts, same for every driver.`} Run it again for a better slot, or take the grid as it stands.`;
  overlay.hidden = false;
  overlay.innerHTML = `
    <div class="gl-menu gl-menu--wide">
      <p class="gl-kicker">QUALIFYING • ${escapeHtml(CAL[s.config.track].name.toUpperCase())} • ${escapeHtml(DIFFICULTY[s.config.difficulty].label)}</p>
      <h2 class="gl-heading ${myPos === 1 && Number.isFinite(mine) ? "is-win" : ""}">${title}</h2>
      <table class="gl-res">
        <thead><tr><th>GRID</th><th>DRIVER</th><th>LAP / GAP</th></tr></thead>
        <tbody>${body}</tbody>
      </table>
      <p class="gl-note">${note}</p>
      <div class="gl-menu__row">
        <button type="button" class="btn btn--primary" data-act="race">START RACE ▶ <small>from P${myPos}</small></button>
        <button type="button" class="btn" data-act="restart">REDO QUALIFYING</button>
        <button type="button" class="btn" data-act="home">MAIN MENU</button>
      </div>
    </div>`;
  overlay.querySelector("button")?.focus();
  announce(`Qualifying: ${title}.`);
}

function showResults(rows, retired) {
  const s = session;
  const race = s.race;
  screen = "results";
  overlay.hidden = false;
  const me = rows.find((r) => r.car.isPlayer);
  const title = retired ? "RETIRED" : me.pos === 1 ? (race.mode === "duel" ? "DUEL WON" : "RACE WINNER") : `FINISHED P${me.pos}`;
  const body = rows
    .map((r) => {
      const c = r.car;
      const gap = r.pos === 1 ? fmtSec(r.time) : r.lapsDown > 0 ? `+${r.lapsDown} LAP${r.lapsDown > 1 ? "S" : ""}` : `+${r.gap.toFixed(3)}`;
      const best = Number.isFinite(c.bestLap) ? fmtSec(c.bestLap) : "—";
      const fl = race.bestLapBy === c.id ? " gl-res__fl" : "";
      return `<tr class="${c.isPlayer ? "is-you" : ""}">
        <td>${r.pos}</td>
        <td><i style="background:${c.color}"></i>${escapeHtml(c.name)} <small>${escapeHtml(c.code)}</small></td>
        <td>${gap}${r.est ? "*" : ""}</td>
        <td class="${fl}">${best}</td>
        <td>${c.penalty ? `+${c.penalty}s` : ""}</td>
      </tr>`;
    })
    .join("");
  overlay.innerHTML = `
    <div class="gl-menu gl-menu--wide">
      <p class="gl-kicker">${escapeHtml(CAL[s.config.track].name.toUpperCase())} • ${race.laps} LAPS • ${escapeHtml(DIFFICULTY[race.difficulty].label)}</p>
      <h2 class="gl-heading ${me && me.pos === 1 && !retired ? "is-win" : ""}">${title}</h2>
      <table class="gl-res">
        <thead><tr><th>POS</th><th>DRIVER</th><th>TIME / GAP</th><th>BEST LAP</th><th>PEN</th></tr></thead>
        <tbody>${body}</tbody>
      </table>
      <p class="gl-note">Purple = fastest lap. Time penalties are included in the classification.${rows.some((r) => r.est) ? " * Still running at the flag: time projected from pace." : ""}</p>
      <div class="gl-menu__row">
        <button type="button" class="btn btn--primary" data-act="again">RACE AGAIN</button>
        <button type="button" class="btn" data-act="setup">CHANGE TRACK</button>
        <button type="button" class="btn" data-act="home">MAIN MENU</button>
      </div>
    </div>`;
  overlay.querySelector("button")?.focus();
}

// ==========================================
// MENUS
// ==========================================
function statsLine() {
  const wins = Object.values(records.gpWins).reduce((a, b) => a + b, 0);
  const duelW = Object.values(records.duels).reduce((a, d) => a + d.w, 0);
  const tracks = Object.keys(records.bestLaps).length;
  return `RACES ${records.races} • GP WINS ${wins} • PODIUMS ${records.podiums} • DUELS WON ${duelW} • LAP RECORDS ${tracks}/24`;
}

function goHome() {
  setEngineHum(false);
  session = null;
  screen = "home";
  if (!demo) demo = makeDemo();
  overlay.hidden = false;
  overlay.innerHTML = `
    <div class="gl-title">
      <p class="gl-kicker">WORLD CIRCUIT SERIES // 24 ROUNDS + 5 CLASSICS</p>
      <h2 class="gl-title__logo">GHOST<br />LAP</h2>
      <p class="gl-title__tag">Lights out and away we go.</p>
      <div class="gl-menu__list">
        <button type="button" class="btn btn--primary" data-go="gp">GRAND PRIX <small>3 to 30 cars</small></button>
        <button type="button" class="btn" data-go="duel">DUEL <small>1v1 vs a bot</small></button>
        <button type="button" class="btn" data-go="trial">TIME TRIAL <small>race your ghost</small></button>
        <button type="button" class="btn" data-go="controls">CONTROLS <small>keys &amp; tuning</small></button>
      </div>
      <p class="gl-title__stats">${escapeHtml(statsLine())}</p>
    </div>`;
  overlay.querySelector("button")?.focus();
}

function thumb(key) {
  const c = document.createElement("canvas");
  c.width = 150;
  c.height = 84;
  const g = c.getContext("2d");
  const f = CIRCUITS[key].pts;
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (let i = 0; i < f.length; i += 2) {
    x0 = Math.min(x0, f[i]);
    x1 = Math.max(x1, f[i]);
    y0 = Math.min(y0, f[i + 1]);
    y1 = Math.max(y1, f[i + 1]);
  }
  const sc = Math.min(134 / (x1 - x0), 70 / (y1 - y0));
  const ox = (150 - (x1 - x0) * sc) / 2 - x0 * sc;
  const oy = (84 - (y1 - y0) * sc) / 2 - y0 * sc;
  g.lineJoin = "round";
  g.beginPath();
  for (let i = 0; i < f.length; i += 2) (i ? g.lineTo : g.moveTo).call(g, ox + f[i] * sc, oy + f[i + 1] * sc);
  g.closePath();
  g.strokeStyle = "rgba(0,0,0,0.6)";
  g.lineWidth = 5;
  g.stroke();
  g.strokeStyle = "#dfe6f2";
  g.lineWidth = 2.5;
  g.stroke();
  g.fillStyle = "#ffd400";
  g.fillRect(ox + f[0] * sc - 3, oy + f[1] * sc - 3, 6, 6);
  return c.toDataURL();
}
const thumbCache = new Map();
const thumbOf = (key) => {
  if (!thumbCache.has(key)) thumbCache.set(key, thumb(key));
  return thumbCache.get(key);
};

function showSetup(mode) {
  setupMode = mode;
  screen = "setup";
  const laps = mode === "gp" ? prefs.gpLaps : prefs.duelLaps;
  // A mixed field only makes sense in a Grand Prix; a duel falls back to Medium
  if (mode === "duel" && prefs.difficulty === "mixed") prefs.difficulty = "medium";
  const lapOpts = [1, 3, 5, 10, 20];
  const title = { gp: "GRAND PRIX", duel: "DUEL", trial: "TIME TRIAL" }[mode];
  const blurb = {
    gp: "A Grand Prix against up to 29 rivals (20 cars is a real F1 grid; pick anything from 3 to 30): pick one level for the whole field, or MIXED for everything from Noob to Impossible. Up to Medium the bots drive your exact car; from Hard up their cars are faster. Follow closely and you get a tow on the straights but dirty air (less grip) in the corners. Qualify over three laps from the line (your best clean lap sets your grid slot), or skip it for a random grid. Running wide only counts if you gain from it: five warnings, then 3 s penalties. Cutting a corner: one warning, then +2 s.",
    duel: "Head-to-head against one bot. Every level is a real racer; up to Medium it drives your exact car, and from Hard up its car is faster too (Hard +3%, Very Hard +6%, Impossible +10%).",
    trial: "Flying laps on an empty circuit. Your best clean lap becomes a ghost; running wide deletes the lap."
  }[mode];
  const cards = CALENDAR.map((c) => {
    const best = records.bestLaps[c.key];
    const km = (CIRCUITS[c.key].lengthM / 1000).toFixed(3);
    return `<button type="button" class="gl-track ${c.key === prefs.track ? "is-on" : ""}" data-track="${c.key}" aria-pressed="${c.key === prefs.track}">
      <img src="${thumbOf(c.key)}" alt="" width="150" height="84" />
      <span class="gl-track__round">${c.classic ? "CLASSIC" : `R${String(c.round).padStart(2, "0")}`}${c.night ? " ☾" : ""}</span>
      <b>${escapeHtml(c.name)}</b>
      <small>${escapeHtml(c.country)} • ${km} km${best ? ` • PB ${fmtSec(best)}` : ""}</small>
    </button>`;
  }).join("");
  overlay.hidden = false;
  overlay.innerHTML = `
    <div class="gl-menu gl-menu--setup">
      <div class="gl-setup__head">
        <button type="button" class="btn btn--ghost btn--sm" data-act="home">&lt; BACK</button>
        <div>
          <p class="gl-kicker">SELECT CIRCUIT</p>
          <h2 class="gl-heading">${title}</h2>
        </div>
        <button type="button" class="btn btn--primary" data-act="start">START ▶</button>
      </div>
      <p class="gl-note">${blurb}</p>
      <div class="gl-tracks" role="group" aria-label="Circuit">${cards}</div>
      <div class="gl-setup__opts">
        ${
          mode === "trial"
            ? ""
            : `<div class="gl-opt gl-opt--laps"><span>LAPS</span>${lapOpts.map((l) => `<button type="button" class="gl-chip" data-laps="${l}">${l}</button>`).join("")}<button type="button" class="gl-chip" data-laps="full">FULL</button>
                 <span class="gl-stepper"><button type="button" class="gl-chip" data-lapstep="-1" aria-label="One lap fewer">−</button><output class="gl-laps-val" aria-live="polite">${laps}</output><button type="button" class="gl-chip" data-lapstep="1" aria-label="One lap more">+</button></span></div>
               <div class="gl-opt"><span>${mode === "duel" ? "BOT" : "AI LEVEL"}</span>${(mode === "gp" ? [...DIFFICULTY_ORDER, "mixed"] : DIFFICULTY_ORDER).map((d) => `<button type="button" class="gl-chip ${d === prefs.difficulty ? "is-on" : ""}" data-diff="${d}" aria-pressed="${d === prefs.difficulty}">${DIFFICULTY[d].label}</button>`).join("")}</div>
               ${mode === "gp" ? `<div class="gl-opt gl-opt--cars"><span>CARS</span>${[3, 10, 20, 30].map((n) => `<button type="button" class="gl-chip" data-cars="${n}">${n}</button>`).join("")}
                 <span class="gl-stepper"><button type="button" class="gl-chip" data-carstep="-1" aria-label="One car fewer">−</button><output class="gl-cars-val" aria-live="polite"></output><button type="button" class="gl-chip" data-carstep="1" aria-label="One car more">+</button></span></div>
               <div class="gl-opt"><span>GRID</span><button type="button" class="gl-chip ${prefs.gpQuali ? "is-on" : ""}" data-quali="1" aria-pressed="${prefs.gpQuali}">QUALIFYING</button><button type="button" class="gl-chip ${!prefs.gpQuali ? "is-on" : ""}" data-quali="0" aria-pressed="${!prefs.gpQuali}">SKIP • RANDOM GRID</button></div>
               <div class="gl-opt"><span>BRAKES</span><button type="button" class="gl-chip ${prefs.gpBrakes !== false ? "is-on" : ""}" data-brakes="1" aria-pressed="${prefs.gpBrakes !== false}">HEAT &amp; WEAR</button><button type="button" class="gl-chip ${prefs.gpBrakes === false ? "is-on" : ""}" data-brakes="0" aria-pressed="${prefs.gpBrakes === false}">OFF</button></div>` : ""}`
        }
      </div>
    </div>`;
  syncLaps();
  syncCars();
  overlay.querySelector(".gl-track.is-on")?.scrollIntoView({ block: "nearest" });
  overlay.querySelector("[data-act=start]")?.focus();
}

// Lap picker: presets, the real race distance for the chosen circuit, and a -/+ stepper for any count
function setLaps(n) {
  const v = clampLaps(n);
  if (setupMode === "gp") prefs.gpLaps = v;
  else prefs.duelLaps = v;
}
function syncLaps() {
  if (setupMode === "trial") return;
  const full = fullLaps(prefs.track);
  setLaps(setupMode === "gp" ? prefs.gpLaps : prefs.duelLaps);
  const laps = setupMode === "gp" ? prefs.gpLaps : prefs.duelLaps;
  overlay.querySelectorAll("[data-laps]").forEach((el) => {
    const v = el.dataset.laps === "full" ? full : Number(el.dataset.laps);
    if (el.dataset.laps === "full") el.textContent = `FULL • ${full}`;
    el.hidden = el.dataset.laps !== "full" && v > full;
    const on = v === laps;
    el.classList.toggle("is-on", on);
    el.setAttribute("aria-pressed", String(on));
  });
  const out = overlay.querySelector(".gl-laps-val");
  if (out) out.textContent = `${laps} LAP${laps === 1 ? "" : "S"}`;
  const [minus, plus] = overlay.querySelectorAll("[data-lapstep]");
  if (minus) minus.disabled = laps <= 1;
  if (plus) plus.disabled = laps >= full;
}

// Grand Prix field size: presets and a -/+ stepper, 3 to 30 cars
function syncCars() {
  const n = prefs.gpCars;
  overlay.querySelectorAll("[data-cars]").forEach((el) => {
    const on = Number(el.dataset.cars) === n;
    el.classList.toggle("is-on", on);
    el.setAttribute("aria-pressed", String(on));
  });
  const out = overlay.querySelector(".gl-cars-val");
  if (out) out.textContent = `${n} CARS`;
  const [minus, plus] = overlay.querySelectorAll("[data-carstep]");
  if (minus) minus.disabled = n <= MIN_CARS;
  if (plus) plus.disabled = n >= MAX_CARS;
}

overlay.addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  if (b.dataset.cars || b.dataset.carstep) {
    sfx.click();
    prefs.gpCars = clampCars(b.dataset.cars ? b.dataset.cars : prefs.gpCars + Number(b.dataset.carstep));
    save(PREFS_KEY, prefs);
    syncCars();
    return;
  }
  if (b.dataset.go) {
    sfx.click();
    if (b.dataset.go === "controls") openControlsModal();
    else showSetup(b.dataset.go);
    return;
  }
  if (b.dataset.track) {
    sfx.click();
    prefs.track = b.dataset.track;
    overlay.querySelectorAll(".gl-track").forEach((el) => {
      el.classList.toggle("is-on", el === b);
      el.setAttribute("aria-pressed", String(el === b));
    });
    syncLaps();
    return;
  }
  if (b.dataset.laps) {
    sfx.click();
    setLaps(b.dataset.laps === "full" ? fullLaps(prefs.track) : b.dataset.laps);
    syncLaps();
    save(PREFS_KEY, prefs);
    return;
  }
  if (b.dataset.lapstep) {
    sfx.click();
    setLaps((setupMode === "gp" ? prefs.gpLaps : prefs.duelLaps) + Number(b.dataset.lapstep));
    syncLaps();
    save(PREFS_KEY, prefs);
    return;
  }
  if (b.dataset.brakes) {
    sfx.click();
    prefs.gpBrakes = b.dataset.brakes === "1";
    save(PREFS_KEY, prefs);
    overlay.querySelectorAll("[data-brakes]").forEach((el) => {
      el.classList.toggle("is-on", el === b);
      el.setAttribute("aria-pressed", String(el === b));
    });
    return;
  }
  if (b.dataset.quali) {
    sfx.click();
    prefs.gpQuali = b.dataset.quali === "1";
    save(PREFS_KEY, prefs);
    overlay.querySelectorAll("[data-quali]").forEach((el) => {
      el.classList.toggle("is-on", el === b);
      el.setAttribute("aria-pressed", String(el === b));
    });
    return;
  }
  if (b.dataset.diff) {
    sfx.click();
    prefs.difficulty = b.dataset.diff;
    overlay.querySelectorAll("[data-diff]").forEach((el) => {
      el.classList.toggle("is-on", el === b);
      el.setAttribute("aria-pressed", String(el === b));
    });
    return;
  }
  const act = b.dataset.act;
  if (!act) return;
  sfx.click();
  if (act === "home") goHome();
  else if (act === "start") {
    const laps = setupMode === "gp" ? prefs.gpLaps : prefs.duelLaps;
    const base = { mode: setupMode, track: prefs.track, laps: setupMode === "trial" ? Infinity : laps, difficulty: prefs.difficulty, cars: prefs.gpCars };
    if (setupMode === "gp") startGrandPrix(base);
    else startRace(base);
  } else if (act === "resume") resumeRace();
  else if (act === "restart") startRace(session.config);
  else if (act === "controls") openControlsModal();
  else if (act === "retire") finishSession(true);
  else if (act === "quit") goHome();
  else if (act === "race") startRace({ ...session.config, stage: "race", grid: session.qualiGrid });
  else if (act === "again") {
    // A new Grand Prix weekend means a new qualifying session (or a new random grid)
    const { mode, track, laps, difficulty, cars } = session.config;
    if (mode === "gp") startGrandPrix({ mode, track, laps, difficulty, cars });
    else startRace(session.config);
  }
  else if (act === "setup") showSetup(session.config.mode);
});

// ==========================================
// CAMERA & RENDER
// ==========================================
function followCam(cam, car, dt) {
  const k = 1 - Math.exp(-dt * 5);
  const tx = car.x + car.vx * 0.3;
  const ty = car.y + car.vy * 0.3;
  cam.x += (tx - cam.x) * k;
  cam.y += (ty - cam.y) * k;
  const zt = (1.08 - Math.min(1, car.speed / CAR.top) * 0.3) * camView.zoom;
  cam.zoom += (zt - cam.zoom) * (1 - Math.exp(-dt * 1.6));
  // Fixed: north-up plus whatever turn the mouse gave it. Rotating: the car always points up the screen.
  let at = camView.angle + (settings.camRotate ? car.heading + Math.PI / 2 : 0);
  let da = at - cam.angle;
  da -= Math.round(da / (Math.PI * 2)) * Math.PI * 2;
  cam.angle += camDrag ? da : da * (1 - Math.exp(-dt * 4));
  cam.shake = Math.max(0, cam.shake - dt * 30);
}

function drawRacingLine(race, view) {
  const track = race.track;
  const car = race.player;
  if (!car) return;
  ctx.lineWidth = 3;
  ctx.setLineDash([10, 10]);
  ctx.lineDashOffset = -((performance.now() * 0.05) % 20);
  const n = track.n;
  let cur = null;
  const flush = () => {
    if (cur && cur.pts.length > 1) {
      ctx.strokeStyle = cur.col;
      ctx.beginPath();
      ctx.moveTo(cur.pts[0][0], cur.pts[0][1]);
      for (const p of cur.pts) ctx.lineTo(p[0], p[1]);
      ctx.stroke();
    }
  };
  for (let k = -10; k < 180; k++) {
    const i = (car.idx + k + n) % n;
    const p = track.path[i];
    const off = track.line[i];
    const x = p[0] + track.nor[i][0] * off;
    const y = p[1] + track.nor[i][1] * off;
    // From what the car really does on the line: red = brake here, amber = lift (a small slow-down,
    // or holding speed at the grip limit mid-corner), green = full throttle
    const g = track.guide[i];
    const col = g === 2 ? "rgba(255, 60, 70, 0.8)" : g === 1 ? "rgba(255, 190, 40, 0.75)" : "rgba(40, 230, 110, 0.6)";
    if (!cur || cur.col !== col) {
      flush();
      cur = { col, pts: cur ? [cur.pts[cur.pts.length - 1]] : [] };
    }
    cur.pts.push([x, y]);
  }
  flush();
  ctx.setLineDash([]);
}

function drawGantry(race, t) {
  const track = race.track;
  const p = track.path[0];
  const nr = track.nor[0];
  const half = halfAt(track, 0) + 34;
  const a = [p[0] + nr[0] * half, p[1] + nr[1] * half];
  const b = [p[0] - nr[0] * half, p[1] - nr[1] * half];
  ctx.save();
  ctx.lineCap = "butt";
  ctx.strokeStyle = "rgba(0,0,0,0.35)";
  ctx.lineWidth = 14;
  ctx.beginPath();
  ctx.moveTo(a[0] + 14, a[1] + 18);
  ctx.lineTo(b[0] + 14, b[1] + 18);
  ctx.stroke();
  ctx.strokeStyle = "#20242c";
  ctx.lineWidth = 12;
  ctx.beginPath();
  ctx.moveTo(a[0], a[1]);
  ctx.lineTo(b[0], b[1]);
  ctx.stroke();
  for (let k = 0; k < 5; k++) {
    const f = 0.3 + k * 0.1;
    const x = a[0] + (b[0] - a[0]) * f;
    const y = a[1] + (b[1] - a[1]) * f;
    const on = race.phase === "lights" && k < race.lights;
    const go = race.phase === "racing" && race.t < 2;
    if (on) glow(ctx, x, y, 14, "#ff2020", 0.8);
    ctx.fillStyle = on ? "#ff3030" : go ? "#2bff6a" : "#3a1010";
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function renderScene(s, now) {
  const { entry, race, cam } = s;
  const shake = cam.shake ? { x: (Math.random() - 0.5) * cam.shake, y: (Math.random() - 0.5) * cam.shake } : { x: 0, y: 0 };
  const eye = { x: cam.x + shake.x, y: cam.y + shake.y, zoom: cam.zoom, angle: cam.angle };
  const view = entry.world.draw(ctx, eye, W, H, 3);
  ctx.save();
  worldTransform(ctx, eye, W, H);
  if (s === session && settings.racingLine) drawRacingLine(race, view);
  drawFx(s.fx, view);
  const t = now / 1000;
  if (s === session && s.ghost && race.player && race.player.laps >= 0) {
    const g = ghostAt(s.ghost, race.t - race.player.lapStart);
    if (g) {
      drawCar(ctx, { x: g.x, y: g.y, heading: g.heading, color: "#ff5ea8", accent: "#ffffff", brake: 0, steer: 0 }, t, { alpha: 0.42, ghost: true });
      s.ghostPos = g;
    } else s.ghostPos = null;
  }
  for (const c of race.cars) {
    if (c.x < view.left - 60 || c.x > view.right + 60 || c.y < view.top - 60 || c.y > view.bottom + 60) continue;
    // Cars on their cool-down lap are out of the race (and no longer collide): show them faded
    if (!c.isPlayer) drawCar(ctx, c, t, c.finished && session?.race === race ? { alpha: 0.45 } : {});
  }
  if (race.player) {
    const p = race.player;
    drawCar(ctx, p, t);
    if (settings.playerRing) {
      ctx.strokeStyle = "rgba(0, 240, 255, 0.55)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 30, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  // Driver codes over rivals, kept upright however the camera is turned
  ctx.font = "9px 'Press Start 2P', monospace";
  ctx.textAlign = "center";
  for (const c of race.cars) {
    if (c.isPlayer || c.x < view.left || c.x > view.right || c.y < view.top || c.y > view.bottom) continue;
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.rotate(eye.angle);
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(-20, -38, 40, 14);
    ctx.fillStyle = c.color;
    ctx.fillText(c.code, 0, -27);
    ctx.restore();
  }
  entry.world.drawLive(ctx, view, t);
  drawGantry(race, t);
  ctx.restore();
  // Faint edge fade only: the wide stage shouldn't read darker than the car at its centre
  if (settings.edgeShade) vignette(ctx, W, H, 0.12);
}

// ==========================================
// MAIN LOOP
// ==========================================
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, Math.max(0, (now - last) / 1000)); // never backwards
  last = now;

  if (session && screen === "race" && !session.paused) {
    const s = session;
    const race = s.race;
    acc += dt;
    let steps = 0;
    while (acc >= SIM_DT && steps < 12) {
      stepRace(race, autopilot ? aiInput(race.player, race, SIM_DT) : playerInput(SIM_DT), SIM_DT);
      handleEvents(race);
      if (race.mode === "trial" && race.player) {
        const c = race.player;
        if (s.lastLaps < 0 && c.laps === 0) s.rec = [];
        s.lastLaps = c.laps;
        if (c.laps >= 0) {
          s.recT += SIM_DT;
          if (s.recT >= 1 / 30) {
            s.recT = 0;
            s.rec.push([race.t - c.lapStart, c.x, c.y, c.heading, c.total - c.laps * race.track.L]);
          }
        }
      }
      acc -= SIM_DT;
      steps++;
    }
    updateFx(s.fx, race, dt);
    followCam(s.cam, race.player, dt);
    const c = race.player;
    if (race.mode === "trial" && s.ghost && c.laps >= 0) s.delta = ghostDelta(s, race.t - c.lapStart, c.total - c.laps * race.track.L);
    else s.delta = null;
    setEngineHum(true, { throttle: Math.max(0, c.fwd) / CAR.top * 1.4 + c.throttle * 0.3, baseFreq: 58 });
    if (s.endAt && now > s.endAt) {
      s.endAt = 0;
      finishSession(false);
    }
  } else if (!session && demo) {
    const d = demo;
    for (let k = 0; k < 2; k++) stepRace(d.race, null, 1 / 120);
    updateFx(d.fx, d.race, dt);
    if (now > d.switchAt) {
      d.follow = (d.follow + 1 + Math.floor(Math.random() * 3)) % d.race.cars.length;
      d.switchAt = now + 9000;
    }
    const target = d.race.order[Math.min(d.follow, d.race.order.length - 1)];
    followCam(d.cam, target, dt);
    d.cam.zoom = Math.min(d.cam.zoom, 0.9);
  }

  const view = session || demo;
  if (session?.qualiBoard && session.race.phase === "racing" && !session.paused) updateQualiBoard(session);
  if (view) renderScene(view, now);
  syncQualiSubmit();
  if (session && screen !== "home") {
    const c = session.race.player;
    const inZone = c && session.race.track.drs.some((z) => (z.from <= z.to ? c.idx >= z.from && c.idx <= z.to : c.idx >= z.from || c.idx <= z.to));
    drawHud(ctx, {
      race: session.race,
      minimap: session.entry.minimap,
      banners: session.banners,
      now: now / 1000,
      ghost: session.ghostPos,
      bestTrail: session.ghost,
      qualiBoard: session.qualiBoard ? qualiBoardRows(session) : null,
      quali: session.config.stage === "quali" ? QUALI_LAPS : 0,
      delta: session.delta,
      drsState: c.drsOpen ? "open" : c.drsEligible && inZone ? "ready" : c.drsEligible ? "armed" : "off",
      W,
      H,
      hudScale,
      bottomInset: hudBottom,
      topRightInset: hudTopRight
    });
  }
  requestAnimationFrame(frame);
}

document.addEventListener("visibilitychange", () => {
  if (document.hidden && session && screen === "race") pauseRace();
});

updateControlsHint();
goHome();
requestAnimationFrame(frame);

// Debug/test hook (used by automated verification scripts).
window.__ghostLap = {
  get session() {
    return session;
  },
  get demo() {
    return demo;
  },
  startRace,
  showSetup,
  goHome,
  keys,
  set autopilot(v) {
    autopilot = !!v;
  }
};
