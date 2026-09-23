import { initShell, escapeHtml, toast } from "/shared/shell.js";
import { sfx } from "/shared/sound.js";
import { saveScore } from "/shared/scores.js";
import { setEngineHum } from "/shared/audio.js";
import { vignette, glow } from "/shared/gfx.js";
import { CIRCUITS } from "./circuits.js";
import { buildTrack, createRace, stepRace, classify, aiInput, DIFFICULTY, DIFFICULTY_ORDER, CAR, LIMITS } from "./race.js";
import { createWorld, drawCar, createMinimap } from "./render.js";
import { drawHud, fmtLap, fmtSec } from "./hud.js";

initShell({ crumb: "Ghost Lap" });

const $ = (id) => document.getElementById(id);
const canvas = $("race-canvas");
const ctx = canvas.getContext("2d");
const overlay = $("overlay");
const announcer = $("race-announcer");
const W = canvas.width;
const H = canvas.height;
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
  ["abudhabi", "Yas Marina", "Abu Dhabi", "desert", true]
].map(([key, name, country, theme, night], k) => ({ key, name, country, theme, night, round: k + 1 }));
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
  const track = buildTrack({ key: meta.key, name: `${meta.name} — ${meta.country}`, pts: c.pts, lengthM: c.lengthM, theme: meta.theme, night: meta.night });
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
let prefs = load(PREFS_KEY, { track: "monza", gpLaps: 5, duelLaps: 3, difficulty: "medium" });
if (!CAL[prefs.track]) prefs.track = "monza";
if (!DIFFICULTY[prefs.difficulty]) prefs.difficulty = "medium";
let records = load(RECORDS_KEY, { races: 0, gpWins: {}, podiums: 0, duels: {}, bestLaps: {} });

const ghostKey = (track) => `timesink:ghost-lap:v3:${track}`;
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
const DEFAULT_SETTINGS = { steerSens: 100, brakeForce: 100, accelSens: 60, racingLine: true, playerRing: false, edgeShade: true };
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
for (const [id, key] of [["btn-toggle-ring", "playerRing"], ["btn-toggle-shade", "edgeShade"]]) {
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

// Touch pad
document.querySelectorAll("#touch-pad [data-key]").forEach((btn) => {
  const k = btn.dataset.key;
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
function playerInput(dt = 1 / 120) {
  const sens = settings.steerSens / 100;
  const accel = Math.max(0.25, Math.min(1, (settings.accelSens ?? 60) / 100));
  const steer = ((keys.right ? 1 : 0) - (keys.left ? 1 : 0)) * Math.min(1, sens);
  if (keys.up) throttleLevel = Math.min(1, throttleLevel + (0.6 + accel * 6) * dt);
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

function newCam(car) {
  return { x: car.x, y: car.y, zoom: 1, shake: 0 };
}

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
  prefs.track = config.track;
  if (config.mode === "gp") prefs.gpLaps = config.laps;
  if (config.mode === "duel") prefs.duelLaps = config.laps;
  if (config.mode !== "trial") prefs.difficulty = config.difficulty;
  save(PREFS_KEY, prefs);

  const entry = getTrack(config.track);
  const race = createRace({ track: entry.track, mode: config.mode, laps: config.laps, difficulty: config.difficulty, seed: (Date.now() & 0xffffff) + 1 });
  const cam = newCam(race.player);
  cam.zoom = 1.05;
  entry.world.warm(cam, W, H);
  const ghost = config.mode === "trial" ? loadGhost(config.track) : null;
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
    delta: null
  };
  acc = 0;
  Object.keys(keys).forEach((k) => (keys[k] = false));
  screen = "race";
  overlay.hidden = true;
  overlay.innerHTML = "";
  canvas.focus({ preventScroll: true });
  if (config.mode === "trial") banner("TIME TRIAL", ghost ? `Beat your ghost: ${fmtSec(ghost.time)}` : "Cross the line to start a flying lap", "#00f0ff", 3.5);
  else banner(config.mode === "gp" ? "GRAND PRIX" : "DUEL", `${CAL[config.track].name.toUpperCase()} • ${config.laps} LAPS • ${DIFFICULTY[config.difficulty].label}`, "#ffd400", 3.5);
  announce(`${CAL[config.track].name}. ${config.mode === "trial" ? "Time trial" : `${config.laps} laps`}.`);
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
    } else if (e.type === "ersBlocked") {
      const why = { drs: "NOT WITH DRS OPEN", empty: "BATTERY FLAT • BRAKE TO HARVEST", lap: "LAP ALLOWANCE USED • RESETS AT THE LINE", throttle: "NEEDS THROTTLE" }[e.reason];
      if (e.reason !== "throttle") {
        sfx.deny();
        banner("ERS LOCKED", why, "#8a95a8", 1.6, 12);
      }
    } else if (e.type === "drsReady") {
      banner("DRS ENABLED", `PRESS ${keyLabel("drs")} IN THE ZONE`, "#22e36b", 1.6, 12);
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

function finishSession(retired = false) {
  const s = session;
  const race = s.race;
  setEngineHum(false);
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
      <p class="gl-kicker">WORLD CIRCUIT SERIES // 24 ROUNDS</p>
      <h2 class="gl-title__logo">GHOST<br />LAP</h2>
      <p class="gl-title__tag">Lights out and away we go.</p>
      <div class="gl-menu__list">
        <button type="button" class="btn btn--primary" data-go="gp">GRAND PRIX <small>10-car race</small></button>
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
  const lapOpts = mode === "gp" ? [3, 5, 8, 12] : [3, 5, 8];
  const title = { gp: "GRAND PRIX", duel: "DUEL", trial: "TIME TRIAL" }[mode];
  const blurb = {
    gp: "Start mid-grid against nine rivals. Three track-limit warnings, then 5 second penalties. DRS opens within a second of the car ahead.",
    duel: "Head-to-head against one bot. Pick how fast it drives — Impossible is quicker than the car you drive.",
    trial: "Flying laps on an empty circuit. Your best clean lap becomes a ghost; running wide deletes the lap."
  }[mode];
  const cards = CALENDAR.map((c) => {
    const best = records.bestLaps[c.key];
    const km = (CIRCUITS[c.key].lengthM / 1000).toFixed(3);
    return `<button type="button" class="gl-track ${c.key === prefs.track ? "is-on" : ""}" data-track="${c.key}" aria-pressed="${c.key === prefs.track}">
      <img src="${thumbOf(c.key)}" alt="" width="150" height="84" />
      <span class="gl-track__round">R${String(c.round).padStart(2, "0")}${c.night ? " ☾" : ""}</span>
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
            : `<div class="gl-opt"><span>LAPS</span>${lapOpts.map((l) => `<button type="button" class="gl-chip ${l === laps ? "is-on" : ""}" data-laps="${l}" aria-pressed="${l === laps}">${l}</button>`).join("")}</div>
               <div class="gl-opt"><span>${mode === "duel" ? "BOT" : "AI LEVEL"}</span>${DIFFICULTY_ORDER.map((d) => `<button type="button" class="gl-chip ${d === prefs.difficulty ? "is-on" : ""}" data-diff="${d}" aria-pressed="${d === prefs.difficulty}">${DIFFICULTY[d].label}</button>`).join("")}</div>`
        }
      </div>
    </div>`;
  overlay.querySelector(".gl-track.is-on")?.scrollIntoView({ block: "nearest" });
  overlay.querySelector("[data-act=start]")?.focus();
}

overlay.addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
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
    return;
  }
  if (b.dataset.laps) {
    sfx.click();
    if (setupMode === "gp") prefs.gpLaps = Number(b.dataset.laps);
    else prefs.duelLaps = Number(b.dataset.laps);
    overlay.querySelectorAll("[data-laps]").forEach((el) => {
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
    startRace({ mode: setupMode, track: prefs.track, laps: setupMode === "trial" ? Infinity : laps, difficulty: prefs.difficulty });
  } else if (act === "resume") resumeRace();
  else if (act === "restart") startRace(session.config);
  else if (act === "controls") openControlsModal();
  else if (act === "retire") finishSession(true);
  else if (act === "quit") goHome();
  else if (act === "again") startRace(session.config);
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
  const zt = 1.08 - Math.min(1, car.speed / CAR.top) * 0.3;
  cam.zoom += (zt - cam.zoom) * (1 - Math.exp(-dt * 1.6));
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
    const v = track.vmax[i];
    const next = track.vmax[(i + 6) % n];
    const col = next < v - 40 ? "rgba(255, 60, 70, 0.75)" : v < CAR.top * 0.97 ? "rgba(255, 190, 40, 0.7)" : "rgba(40, 230, 110, 0.6)";
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
  const half = track.width / 2 + 34;
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
  const view = entry.world.draw(ctx, { x: cam.x + shake.x, y: cam.y + shake.y, zoom: cam.zoom }, W, H, 3);
  const z = cam.zoom;
  ctx.save();
  ctx.setTransform(z, 0, 0, z, W / 2 - (cam.x + shake.x) * z, H / 2 - (cam.y + shake.y) * z);
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
    if (!c.isPlayer) drawCar(ctx, c, t);
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
  // Driver codes over rivals
  ctx.font = "9px 'Press Start 2P', monospace";
  ctx.textAlign = "center";
  for (const c of race.cars) {
    if (c.isPlayer || c.x < view.left || c.x > view.right || c.y < view.top || c.y > view.bottom) continue;
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(c.x - 20, c.y - 38, 40, 14);
    ctx.fillStyle = c.color;
    ctx.fillText(c.code, c.x, c.y - 27);
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
  const dt = Math.min(0.05, (now - last) / 1000);
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
  if (view) renderScene(view, now);
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
      delta: session.delta,
      drsState: c.drsOpen ? "open" : c.drsEligible && inZone ? "ready" : c.drsEligible ? "armed" : "off",
      W,
      H
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
