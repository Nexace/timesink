import { initShell, escapeHtml, toast } from "/shared/shell.js";
import { sfx } from "/shared/sound.js";
import { saveScore } from "/shared/scores.js";

initShell({ crumb: "Ghost Lap" });

const canvas = document.getElementById("race-canvas");
const ctx = canvas.getContext("2d");

const trackSelect = document.getElementById("track-select");
const btnToggleRacingLine = document.getElementById("btn-toggle-racing-line");
const btnControls = document.getElementById("btn-controls");
const btnEditor = document.getElementById("btn-editor");
const editorAside = document.getElementById("editor-aside");
const btnClearTrack = document.getElementById("btn-clear-track");
const btnUndoTrack = document.getElementById("btn-undo-track");
const btnTestDrive = document.getElementById("btn-test-drive");
const btnSaveTrack = document.getElementById("btn-save-track");
const btnExportTrack = document.getElementById("btn-export-track");
const btnImportTrack = document.getElementById("btn-import-track");
const btnToggleGuide = document.getElementById("btn-toggle-guide");
const trackGuide = document.getElementById("track-guide");
const editorPointsCount = document.getElementById("editor-points-count");
const editorTrackStatus = document.getElementById("editor-track-status");

// Controls Modal Elements
const modalControls = document.getElementById("modal-controls");
const modalControlsBackdrop = document.getElementById("modal-controls-backdrop");
const btnCloseControls = document.getElementById("btn-close-controls");
const btnResetControls = document.getElementById("btn-reset-controls");
const btnSaveControls = document.getElementById("btn-save-controls");
const keybindsGrid = document.getElementById("keybinds-grid");
const inputSteerSens = document.getElementById("input-steer-sens");
const valSteerSens = document.getElementById("val-steer-sens");
const inputBrakeForce = document.getElementById("input-brake-force");
const valBrakeForce = document.getElementById("val-brake-force");
const btnToggleDrift = document.getElementById("btn-toggle-drift");
const valDriftAssist = document.getElementById("val-drift-assist");
const glControlsHint = document.getElementById("gl-controls-hint");

const hudSpeed = document.getElementById("hud-speed");
const hudBrakeStatus = document.getElementById("hud-brake-status");
const hudLapTime = document.getElementById("hud-lap-time");
const hudDelta = document.getElementById("hud-delta");
const hudBestTime = document.getElementById("hud-best-time");
const hudLapCount = document.getElementById("hud-lap-count");

// ==========================================
// CONTROLS & SETTINGS ENGINE
// ==========================================
const DEFAULT_CONTROLS = {
  accel: ["KeyW", "ArrowUp"],
  brake: ["KeyS", "ArrowDown"],
  left: ["KeyA", "ArrowLeft"],
  right: ["KeyD", "ArrowRight"],
  drift: ["Space"],
  restart: ["KeyR"]
};

const DEFAULT_SETTINGS = {
  steerSens: 100,
  brakeForce: 100,
  driftAssist: true,
  racingLine: true
};

const ACTION_LABELS = {
  accel: "ACCELERATE (GAS)",
  brake: "BRAKE / REVERSE",
  left: "STEER LEFT",
  right: "STEER RIGHT",
  drift: "HANDBRAKE / DRIFT",
  restart: "RESTART LAP"
};

let controls = loadControls();
let settings = loadSettings();
let rebindingAction = null;

function loadControls() {
  try {
    const raw = localStorage.getItem("timesink:ghost-lap:controls");
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_CONTROLS, ...parsed };
    }
  } catch {}
  return JSON.parse(JSON.stringify(DEFAULT_CONTROLS));
}

function saveControls() {
  try {
    localStorage.setItem("timesink:ghost-lap:controls", JSON.stringify(controls));
  } catch {}
}

function loadSettings() {
  try {
    const raw = localStorage.getItem("timesink:ghost-lap:settings");
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_SETTINGS, ...parsed };
    }
  } catch {}
  return { ...DEFAULT_SETTINGS };
}

function saveSettings() {
  try {
    localStorage.setItem("timesink:ghost-lap:settings", JSON.stringify(settings));
  } catch {}
}

function formatKeyName(code) {
  if (!code) return "NONE";
  if (code.startsWith("Key")) return code.slice(3);
  if (code.startsWith("Digit")) return code.slice(5);
  if (code.startsWith("Arrow")) return code.slice(5).toUpperCase();
  if (code === "Space") return "SPACE";
  return code.toUpperCase();
}

function renderKeybindsUI() {
  if (!keybindsGrid) return;
  keybindsGrid.innerHTML = Object.entries(ACTION_LABELS).map(([action, label]) => {
    const assignedKeys = controls[action] || [];
    const formatted = assignedKeys.map(formatKeyName).join(" / ") || "NONE";
    const isRebinding = rebindingAction === action;
    return `
      <div class="keybind-row">
        <span class="keybind-action">${escapeHtml(label)}</span>
        <button type="button" class="key-badge ${isRebinding ? "is-rebinding" : ""}" data-action="${action}">
          ${isRebinding ? "PRESS KEY..." : escapeHtml(formatted)}
        </button>
      </div>
    `;
  }).join("");

  updateControlsHint();
}

function updateControlsHint() {
  if (!glControlsHint) return;
  const accelKey = (controls.accel || []).map(formatKeyName).join("/") || "W";
  const brakeKey = (controls.brake || []).map(formatKeyName).join("/") || "S";
  const driftKey = (controls.drift || []).map(formatKeyName).join("/") || "SPACE";
  const restartKey = (controls.restart || []).map(formatKeyName).join("/") || "R";

  glControlsHint.innerHTML = `
    <span>[${escapeHtml(accelKey)}] ACCEL</span>
    <span>[${escapeHtml(brakeKey)}] BRAKE / REV</span>
    <span>[${escapeHtml(driftKey)}] HANDBRAKE DRIFT</span>
    <span>[${escapeHtml(restartKey)}] RESTART</span>
  `;
}

function applyPreset(type) {
  sfx.click();
  if (type === "wasd") {
    controls = {
      accel: ["KeyW"],
      brake: ["KeyS"],
      left: ["KeyA"],
      right: ["KeyD"],
      drift: ["Space"],
      restart: ["KeyR"]
    };
  } else if (type === "arrows") {
    controls = {
      accel: ["ArrowUp"],
      brake: ["ArrowDown"],
      left: ["ArrowLeft"],
      right: ["ArrowRight"],
      drift: ["Space"],
      restart: ["KeyR"]
    };
  } else if (type === "esdf") {
    controls = {
      accel: ["KeyE"],
      brake: ["KeyD"],
      left: ["KeyS"],
      right: ["KeyF"],
      drift: ["Space"],
      restart: ["KeyR"]
    };
  }
  saveControls();
  renderKeybindsUI();
  toast({ title: "PRESET APPLIED", body: type.toUpperCase(), icon: "check" });
}

// Chaikin corner smoothing algorithm: converts polygon waypoints into a flowing circuit
function chaikin(points, iterations = 2) {
  let pts = points;
  for (let it = 0; it < iterations; it++) {
    const next = [];
    for (let i = 0; i < pts.length; i++) {
      const p1 = pts[i];
      const p2 = pts[(i + 1) % pts.length];
      next.push([
        Math.round((0.75 * p1[0] + 0.25 * p2[0]) * 10) / 10,
        Math.round((0.75 * p1[1] + 0.25 * p2[1]) * 10) / 10
      ]);
      next.push([
        Math.round((0.25 * p1[0] + 0.75 * p2[0]) * 10) / 10,
        Math.round((0.25 * p1[1] + 0.75 * p2[1]) * 10) / 10
      ]);
    }
    pts = next;
  }
  return pts;
}

function createF1Circuit(rawPoints, name = "F1 Circuit", width = 52, numGates = 6) {
  const path = chaikin(rawPoints, 2);
  const p0 = path[0];
  const p1 = path[1] || [p0[0] + 100, p0[1]];
  const angle = Math.atan2(p1[1] - p0[1], p1[0] - p0[0]);

  // Generate 6 sector checkpoints evenly distributed around the perimeter
  const checkpoints = [];
  const halfWidth = Math.round(width / 2) + 20;

  for (let g = 0; g < numGates; g++) {
    const idx = Math.floor((g / numGates) * path.length);
    const curr = path[idx];
    const next = path[(idx + 1) % path.length];
    const segAngle = Math.atan2(next[1] - curr[1], next[0] - curr[0]);
    const normal = segAngle + Math.PI / 2;

    checkpoints.push({
      id: g,
      x1: curr[0] + Math.cos(normal) * halfWidth,
      y1: curr[1] + Math.sin(normal) * halfWidth,
      x2: curr[0] - Math.cos(normal) * halfWidth,
      y2: curr[1] - Math.sin(normal) * halfWidth,
      isFinish: g === 0,
      label: g === 0 ? "FINISH" : `S${g}`
    });
  }

  return {
    name,
    path,
    width,
    start: { x: p0[0], y: p0[1], angle },
    checkpoints
  };
}

function createTrackFromPoints(points, name = "Custom Circuit", width = 52) {
  if (points.length >= 4) {
    return createF1Circuit(points, name, width, Math.min(8, Math.max(4, points.length)));
  }
  const p0 = points[0] || [400, 250];
  const p1 = points[1] || [p0[0] + 100, p0[1]];
  return {
    name,
    path: [...points],
    width,
    start: { x: p0[0], y: p0[1], angle: Math.atan2(p1[1] - p0[1], p1[0] - p0[0]) },
    checkpoints: [
      { id: 0, x1: p0[0] - 30, y1: p0[1] - 30, x2: p0[0] + 30, y2: p0[1] + 30, isFinish: true, label: "FINISH" }
    ]
  };
}

// ==========================================
// 2025 FORMULA 1 CALENDAR TRACKS (24 ROUNDS)
// ==========================================
const TRACKS = {
  australia: createF1Circuit([
    [250, 410], [420, 410], [560, 410], [670, 390], [710, 320],
    [660, 250], [600, 220], [630, 170], [690, 140], [650, 85],
    [510, 85], [380, 120], [250, 140], [150, 190], [120, 270],
    [140, 350], [190, 400]
  ], "01. Australia — Albert Park", 52),

  china: createF1Circuit([
    [160, 410], [330, 410], [480, 410], [530, 370], [530, 300],
    [470, 270], [390, 290], [420, 340], [360, 350], [280, 290],
    [240, 210], [280, 120], [390, 110], [510, 120], [680, 140],
    [710, 270], [690, 370], [620, 380], [360, 410]
  ], "02. China — Shanghai Circuit", 52),

  suzuka: createF1Circuit([
    [220, 410], [350, 410], [460, 390], [510, 340], [470, 290],
    [510, 240], [470, 190], [510, 140], [470, 90], [400, 80],
    [360, 110], [360, 150], [410, 190], [460, 240], [460, 280],
    [410, 300], [360, 270], [280, 240], [190, 200], [130, 180],
    [90, 130], [120, 85], [190, 85], [280, 120], [360, 170],
    [340, 230], [270, 310], [190, 360], [150, 400]
  ], "03. Japan — Suzuka Circuit", 50),

  bahrain: createF1Circuit([
    [180, 410], [380, 410], [560, 410], [660, 390], [690, 340],
    [640, 290], [550, 270], [600, 210], [670, 150], [630, 85],
    [520, 85], [460, 130], [420, 190], [370, 240], [310, 240],
    [240, 190], [210, 120], [140, 90], [100, 150], [110, 260],
    [130, 360]
  ], "04. Bahrain — Sakhir Circuit", 52),

  saudiarabia: createF1Circuit([
    [110, 300], [240, 310], [400, 320], [570, 320], [690, 290],
    [720, 230], [690, 180], [570, 180], [450, 210], [330, 190],
    [210, 210], [130, 190], [80, 230]
  ], "05. Saudi Arabia — Jeddah Corniche", 52),

  miami: createF1Circuit([
    [180, 410], [370, 410], [560, 410], [660, 380], [710, 310],
    [680, 230], [610, 200], [670, 140], [640, 85], [440, 85],
    [240, 85], [120, 120], [90, 190], [130, 250], [100, 320],
    [140, 380]
  ], "06. Miami (USA) — Miami Autodrome", 52),

  imola: createF1Circuit([
    [550, 410], [380, 410], [240, 410], [150, 380], [110, 300],
    [150, 230], [120, 150], [160, 85], [280, 95], [390, 120],
    [490, 170], [620, 220], [690, 300], [660, 380]
  ], "07. Emilia-Romagna — Imola Circuit", 52),

  monaco: createF1Circuit([
    [220, 410], [370, 410], [460, 410], [540, 380], [570, 290],
    [520, 190], [440, 120], [360, 120], [300, 160], [350, 200],
    [500, 220], [670, 240], [710, 290], [640, 320], [540, 330],
    [420, 320], [300, 340], [230, 370]
  ], "08. Monaco — Circuit de Monaco", 48),

  spain: createF1Circuit([
    [190, 420], [370, 420], [540, 420], [660, 390], [710, 320],
    [680, 240], [590, 230], [540, 280], [450, 280], [410, 210],
    [440, 120], [340, 95], [240, 130], [160, 200], [120, 280],
    [140, 370]
  ], "09. Spain — Barcelona-Catalunya", 52),

  montreal: createF1Circuit([
    [180, 120], [350, 120], [520, 120], [640, 150], [700, 220],
    [710, 310], [660, 390], [510, 400], [310, 400], [110, 400],
    [80, 330], [90, 240], [120, 160]
  ], "10. Canada — Montreal (Gilles Villeneuve)", 52),

  redbullring: createF1Circuit([
    [190, 400], [360, 400], [470, 400], [580, 380], [650, 280],
    [700, 150], [700, 80], [630, 80], [520, 170], [410, 240],
    [330, 300], [260, 290], [200, 240], [140, 180], [170, 110],
    [240, 95], [290, 150], [260, 260], [180, 340]
  ], "11. Austria — Red Bull Ring", 52),

  silverstone: createF1Circuit([
    [370, 420], [530, 420], [640, 390], [680, 320], [630, 280],
    [570, 310], [530, 240], [430, 190], [360, 220], [420, 270],
    [510, 260], [620, 210], [680, 140], [660, 70], [580, 70],
    [490, 90], [350, 100], [210, 140], [140, 230], [170, 330],
    [240, 380]
  ], "12. Great Britain — Silverstone", 52),

  spa: createF1Circuit([
    [170, 120], [280, 120], [300, 170], [260, 190], [240, 230],
    [280, 240], [430, 250], [590, 260], [690, 250], [710, 190],
    [650, 150], [580, 190], [510, 250], [420, 330], [320, 360],
    [240, 330], [170, 350], [90, 310], [75, 230], [95, 140]
  ], "13. Belgium — Spa-Francorchamps", 52),

  hungary: createF1Circuit([
    [230, 420], [400, 420], [540, 420], [660, 390], [690, 320],
    [630, 280], [650, 220], [590, 150], [640, 95], [540, 85],
    [460, 120], [400, 105], [340, 150], [380, 240], [320, 290],
    [230, 270], [170, 210], [130, 270], [150, 360]
  ], "14. Hungary — Hungaroring", 52),

  netherlands: createF1Circuit([
    [210, 410], [380, 410], [520, 410], [650, 390], [690, 310],
    [630, 260], [670, 200], [620, 140], [530, 105], [430, 125],
    [360, 175], [290, 165], [230, 215], [160, 290], [120, 360]
  ], "15. Netherlands — Circuit Zandvoort", 52),

  monza: createF1Circuit([
    [210, 420], [420, 420], [570, 420], [660, 400], [700, 320],
    [670, 210], [610, 170], [550, 120], [460, 95], [350, 125],
    [230, 175], [140, 235], [120, 330], [150, 410]
  ], "16. Italy — Monza", 52),

  azerbaijan: createF1Circuit([
    [110, 410], [350, 410], [560, 410], [690, 410], [720, 360],
    [690, 300], [720, 240], [660, 190], [570, 180], [500, 125],
    [420, 115], [360, 155], [290, 215], [200, 270], [130, 335]
  ], "17. Azerbaijan — Baku City Circuit", 52),

  singapore: createF1Circuit([
    [190, 410], [360, 410], [500, 410], [600, 390], [660, 340],
    [700, 270], [650, 210], [560, 180], [490, 135], [400, 115],
    [320, 155], [240, 210], [170, 280], [120, 350]
  ], "18. Singapore — Marina Bay", 52),

  usa: createF1Circuit([
    [230, 390], [400, 390], [540, 390], [640, 360], [690, 300],
    [640, 240], [690, 180], [620, 115], [490, 95], [340, 115],
    [180, 155], [120, 220], [150, 290], [180, 360]
  ], "19. USA — Austin (COTA)", 52),

  mexico: createF1Circuit([
    [170, 420], [380, 420], [580, 420], [680, 390], [720, 320],
    [670, 250], [570, 220], [510, 155], [420, 125], [330, 115],
    [230, 155], [150, 225], [110, 300], [130, 380]
  ], "20. Mexico — Hermanos Rodríguez", 52),

  interlagos: createF1Circuit([
    [520, 110], [380, 110], [270, 110], [180, 140], [140, 200],
    [210, 240], [370, 260], [540, 270], [680, 290], [710, 350],
    [640, 380], [550, 380], [580, 320], [520, 280], [440, 320],
    [370, 370], [280, 340], [350, 230], [450, 160]
  ], "21. Brazil — Interlagos", 52),

  lasvegas: createF1Circuit([
    [180, 410], [380, 410], [580, 410], [700, 410], [720, 360],
    [720, 250], [660, 170], [570, 135], [470, 115], [300, 125],
    [160, 155], [110, 240], [100, 340]
  ], "22. Las Vegas — Strip Circuit", 52),

  qatar: createF1Circuit([
    [190, 420], [390, 420], [590, 420], [690, 390], [720, 310],
    [650, 240], [690, 170], [620, 105], [520, 85], [430, 125],
    [370, 95], [290, 115], [220, 175], [150, 240], [120, 320],
    [140, 390]
  ], "23. Qatar — Lusail Circuit", 52),

  abudhabi: createF1Circuit([
    [210, 410], [370, 410], [500, 410], [600, 390], [670, 330],
    [700, 250], [600, 185], [480, 135], [350, 115], [260, 135],
    [170, 175], [120, 250], [110, 330], [150, 390]
  ], "24. Abu Dhabi — Yas Marina", 52)
};

// Aliases for backward compatibility
TRACKS.italy = TRACKS.monza;
TRACKS.japan = TRACKS.suzuka;
TRACKS.canada = TRACKS.montreal;
TRACKS.austria = TRACKS.redbullring;
TRACKS.belgium = TRACKS.spa;
TRACKS.brazil = TRACKS.interlagos;

let currentTrackKey = trackSelect ? trackSelect.value : "monza";
let currentTrack = TRACKS[currentTrackKey] || TRACKS.monza;

// Physics & Car State
let car = {
  x: 400,
  y: 150,
  vx: 0,
  vy: 0,
  angle: 0,
  speed: 0,
  drifting: false,
  braking: false,
  reversing: false
};

const keys = {
  up: false,
  down: false,
  left: false,
  right: false,
  drift: false
};

// Skid marks buffer
const skidmarks = [];
// Visual particles for braking sparks & smoke
const particles = [];
let lastBrakeSound = 0;

// Lap & Ghost state
let lapStartTime = 0;
let currentLapTime = 0;
let currentCheckpointIdx = 0;
let sessionLap = 1;
let currentLapTrail = []; // [{ t, x, y, angle }]
let bestLapTrail = [];
let bestLapTime = Infinity;
let editorMode = false;
let customPoints = [];

function loadBestGhost() {
  try {
    const raw = localStorage.getItem(`timesink:ghost-lap:${currentTrackKey}`);
    if (raw) {
      const data = JSON.parse(raw);
      bestLapTime = data.time || Infinity;
      bestLapTrail = data.trail || [];
      hudBestTime.textContent = fmtTime(bestLapTime);
    } else {
      bestLapTime = Infinity;
      bestLapTrail = [];
      hudBestTime.textContent = "--:--.---";
    }
  } catch {
    bestLapTime = Infinity;
    bestLapTrail = [];
  }
}

function saveBestGhost(time, trail) {
  try {
    localStorage.setItem(`timesink:ghost-lap:${currentTrackKey}`, JSON.stringify({ time, trail }));
    saveScore("ghost-lap", time, `${fmtTime(time)} on ${currentTrack.name}`, { lowerIsBetter: true });
  } catch {}
}

function fmtTime(ms) {
  if (!Number.isFinite(ms) || ms === Infinity) return "--:--.---";
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const frac = Math.floor(ms % 1000);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(frac).padStart(3, "0")}`;
}

// Race & Rivals State
let raceState = "ready"; // "ready" | "racing"

const RIVAL_CONFIGS = [
  { id: "apex", name: "APEX RED", color: "#ff2244", maxSpeed: 335, accel: 280, turnRate: 3.6, offset: -8 },
  { id: "pace", name: "PACE GOLD", color: "#ffd700", maxSpeed: 290, accel: 250, turnRate: 3.2, offset: 0 },
  { id: "rookie", name: "ROOKIE GREEN", color: "#00ff88", maxSpeed: 245, accel: 220, turnRate: 2.8, offset: 8 }
];

let rivalCars = [];

function initRivals() {
  const path = currentTrack.path;
  if (!path || path.length < 4) {
    rivalCars = [];
    return;
  }
  const startAngle = currentTrack.start.angle || 0;
  const startX = currentTrack.start.x;
  const startY = currentTrack.start.y;
  const backDirX = -Math.cos(startAngle);
  const backDirY = -Math.sin(startAngle);
  const normalDirX = -Math.sin(startAngle);
  const normalDirY = Math.cos(startAngle);

  rivalCars = RIVAL_CONFIGS.map((cfg, idx) => {
    const gridDist = (idx + 1) * 32;
    const gx = startX + backDirX * gridDist + normalDirX * cfg.offset;
    const gy = startY + backDirY * gridDist + normalDirY * cfg.offset;
    return {
      ...cfg,
      x: gx,
      y: gy,
      vx: 0,
      vy: 0,
      angle: startAngle,
      speed: 0,
      braking: false,
      currentWp: Math.min(path.length - 1, idx + 1)
    };
  });
}

function updateRivals(dt) {
  if (raceState !== "racing" || !currentTrack.path || currentTrack.path.length < 4) return;
  const path = currentTrack.path;
  const pathLen = path.length;

  for (const rival of rivalCars) {
    const targetIdx = (rival.currentWp + 3) % pathLen;
    const nextIdx = (targetIdx + 1) % pathLen;
    const targetPt = path[targetIdx];
    const nextPt = path[nextIdx];

    const segDx = nextPt[0] - targetPt[0];
    const segDy = nextPt[1] - targetPt[1];
    const segLen = Math.hypot(segDx, segDy) || 1;
    const normX = -segDy / segLen;
    const normY = segDx / segLen;

    const tx = targetPt[0] + normX * rival.offset;
    const ty = targetPt[1] + normY * rival.offset;

    const targetAngle = Math.atan2(ty - rival.y, tx - rival.x);
    let diff = targetAngle - rival.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;

    const maxTurn = rival.turnRate * dt;
    const turnAmount = Math.max(-maxTurn, Math.min(maxTurn, diff));
    rival.angle += turnAmount;

    const isSharpCorner = Math.abs(diff) > 0.42;
    rival.braking = isSharpCorner && rival.speed > (rival.maxSpeed * 0.62);

    let targetSpeed = rival.maxSpeed;
    if (isSharpCorner) targetSpeed = rival.maxSpeed * 0.58;

    if (rival.braking) {
      rival.speed = Math.max(targetSpeed, rival.speed - 520 * dt);
    } else if (rival.speed < targetSpeed) {
      rival.speed = Math.min(targetSpeed, rival.speed + rival.accel * dt);
    } else {
      rival.speed = Math.max(targetSpeed, rival.speed - 150 * dt);
    }

    rival.vx = Math.cos(rival.angle) * rival.speed;
    rival.vy = Math.sin(rival.angle) * rival.speed;
    rival.x += rival.vx * dt;
    rival.y += rival.vy * dt;

    const currentWpPt = path[rival.currentWp];
    const dist = Math.hypot(currentWpPt[0] - rival.x, currentWpPt[1] - rival.y);
    if (dist < 40) {
      rival.currentWp = (rival.currentWp + 1) % pathLen;
    }
  }
}

function drawRivals() {
  for (const rival of rivalCars) {
    drawCar(rival.x, rival.y, rival.angle, rival.color, false, rival.braking, false);

    ctx.save();
    ctx.translate(rival.x, rival.y - 14);
    ctx.fillStyle = rival.color;
    ctx.font = "6px 'Press Start 2P', monospace";
    ctx.textAlign = "center";
    ctx.shadowColor = rival.color;
    ctx.shadowBlur = 6;
    ctx.fillText(rival.name.split(" ")[0], 0, 0);
    ctx.restore();
  }
}

function drawRacingLine() {
  if (!settings.racingLine || !currentTrack.path || currentTrack.path.length < 4) return;
  const path = currentTrack.path;
  const len = path.length;

  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const animDash = (performance.now() * 0.03) % 20;

  for (let i = 0; i < len; i++) {
    const prev = path[(i - 1 + len) % len];
    const curr = path[i];
    const next = path[(i + 1) % len];

    const a1 = Math.atan2(curr[1] - prev[1], curr[0] - prev[0]);
    const a2 = Math.atan2(next[1] - curr[1], next[0] - curr[0]);
    let diff = Math.abs(a2 - a1);
    while (diff > Math.PI) diff = Math.abs(diff - Math.PI * 2);

    let color = "#00ff66";
    let glow = "rgba(0, 255, 102, 0.4)";
    let width = 3;

    if (diff > 0.32) {
      color = "#ff2244";
      glow = "rgba(255, 34, 68, 0.55)";
      width = 4;
    } else if (diff > 0.15) {
      color = "#ffb700";
      glow = "rgba(255, 183, 0, 0.45)";
      width = 3.5;
    }

    ctx.strokeStyle = color;
    ctx.shadowColor = glow;
    ctx.shadowBlur = 6;
    ctx.lineWidth = width;
    ctx.setLineDash([6, 6]);
    ctx.lineDashOffset = -animDash;

    ctx.beginPath();
    ctx.moveTo(curr[0], curr[1]);
    ctx.lineTo(next[0], next[1]);
    ctx.stroke();
  }
  ctx.restore();
}

function startRace() {
  if (raceState === "racing") return;
  raceState = "racing";
  lapStartTime = performance.now();
  currentLapTrail = [];
  try { sfx.rev(); } catch {}
  toast({ title: "GREEN LIGHT!", body: "RACE STARTED — PUSH FOR PURPLE!", icon: "check" });
}

function resetCar(toReady = true) {
  car.x = currentTrack.start.x;
  car.y = currentTrack.start.y;
  car.vx = 0;
  car.vy = 0;
  car.angle = currentTrack.start.angle || 0;
  car.speed = 0;
  car.drifting = false;
  car.braking = false;
  car.reversing = false;
  currentLapTime = 0;
  currentLapTrail = [];
  currentCheckpointIdx = 1; // target the first gate ahead
  skidmarks.length = 0;
  particles.length = 0;

  if (toReady) {
    raceState = "ready";
    lapStartTime = 0;
    hudSpeed.textContent = "000 KM/H";
    hudLapTime.textContent = "00:00.000";
    if (hudBrakeStatus) {
      hudBrakeStatus.textContent = "READY";
      hudBrakeStatus.className = "hud-val hud-brake-status";
    }
  } else {
    raceState = "racing";
    lapStartTime = performance.now();
  }

  initRivals();
}

// Distance from point to line segment
function distToSegment(px, py, x1, y1, x2, y2) {
  const l2 = (x2 - x1) ** 2 + (y2 - y1) ** 2;
  if (l2 === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * (x2 - x1)), py - (y1 + t * (y2 - y1)));
}

function isCarOnTrack(x, y) {
  if (!currentTrack || !currentTrack.path) return true;
  const path = currentTrack.path;
  const w = currentTrack.width;
  let minDist = Infinity;
  for (let i = 0; i < path.length; i++) {
    const p1 = path[i];
    const p2 = path[(i + 1) % path.length];
    const d = distToSegment(x, y, p1[0], p1[1], p2[0], p2[1]);
    if (d < minDist) minDist = d;
  }
  return minDist <= (w / 2) + 8; // generous margin including curbs
}

// ==========================================
// PHYSICS & BRAKING MECHANICS
// ==========================================
function updatePhysics(dt) {
  if (raceState !== "racing") return;
  const accel = 360; // px/s^2
  const maxSpeed = 380;
  const onTrack = isCarOnTrack(car.x, car.y);

  // Speed cap off-track
  const effectiveMaxSpeed = onTrack ? maxSpeed : maxSpeed * 0.45;

  // Decompose velocity into forward & lateral vectors
  const forwardDirX = Math.cos(car.angle);
  const forwardDirY = Math.sin(car.angle);
  const normalDirX = -Math.sin(car.angle);
  const normalDirY = Math.cos(car.angle);

  const forwardSpeed = car.vx * forwardDirX + car.vy * forwardDirY;
  const lateralSpeed = car.vx * normalDirX + car.vy * normalDirY;

  let throttle = 0;
  car.braking = false;
  car.reversing = false;

  // BRAKING & REVERSE LOGIC
  if (keys.down) {
    if (forwardSpeed > 15) {
      // 1. ACTIVE BRAKING: Vehicle is traveling forward, apply high-torque braking friction
      car.braking = true;
      const brakeForceFactor = settings.brakeForce / 100;
      const brakeDecel = 780 * brakeForceFactor; // px/s^2
      const decelStep = brakeDecel * dt;
      const newForward = Math.max(0, forwardSpeed - decelStep);

      car.vx = forwardDirX * newForward + normalDirX * lateralSpeed;
      car.vy = forwardDirY * newForward + normalDirY * lateralSpeed;

      // Spawn red/amber brake friction sparks & skid marks
      if (car.speed > 70) {
        skidmarks.push({ x: car.x - forwardDirX * 10 - normalDirX * 5, y: car.y - forwardDirY * 10 - normalDirY * 5, alpha: 0.75 });
        skidmarks.push({ x: car.x - forwardDirX * 10 + normalDirX * 5, y: car.y - forwardDirY * 10 + normalDirY * 5, alpha: 0.75 });
        if (skidmarks.length > 250) skidmarks.splice(0, 2);

        // Friction spark particles
        for (let i = 0; i < 2; i++) {
          particles.push({
            x: car.x - forwardDirX * 12 + (Math.random() * 6 - 3),
            y: car.y - forwardDirY * 12 + (Math.random() * 6 - 3),
            vx: -forwardDirX * (Math.random() * 50) + (Math.random() * 20 - 10),
            vy: -forwardDirY * (Math.random() * 50) + (Math.random() * 20 - 10),
            color: Math.random() > 0.35 ? "#ff2233" : "#ffb700",
            alpha: 0.85,
            size: 2.5 + Math.random() * 2,
            decay: 0.05 + Math.random() * 0.04
          });
        }

        // Trigger synthesized tire screech / brake bite sound
        if (performance.now() - lastBrakeSound > 220) {
          try { sfx.brake(); } catch {}
          lastBrakeSound = performance.now();
        }
      }
    } else {
      // 2. REVERSE GEAR: Vehicle has halted or is rolling back
      car.reversing = true;
      throttle -= 0.55;
    }
  }

  // ACCELERATOR
  if (keys.up) {
    if (forwardSpeed < -10) {
      // Moving in reverse: hitting gas acts as forward brake first to prevent instant jolt
      car.braking = true;
      const decel = 600 * dt;
      const newForward = Math.min(0, forwardSpeed + decel);
      car.vx = forwardDirX * newForward + normalDirX * lateralSpeed;
      car.vy = forwardDirY * newForward + normalDirY * lateralSpeed;
    } else {
      throttle += 1;
    }
  }

  // Handbrake Drift Mechanics
  car.drifting = keys.drift && Math.abs(car.speed) > 40;
  if (keys.drift && car.speed > 60) {
    // Handbrake drag
    car.vx *= (1 - 0.35 * dt);
    car.vy *= (1 - 0.35 * dt);
  }

  // Steering Mechanics with Sensitivity Multiplier
  const sens = (settings.steerSens / 100);
  const baseTurnSpeed = car.drifting ? 4.3 : (settings.driftAssist ? 3.3 : 2.9);
  const turnSpeed = baseTurnSpeed * sens * (1 - Math.min(0.35, Math.abs(car.speed) / (maxSpeed * 1.5)));
  if (keys.left) car.angle -= turnSpeed * dt;
  if (keys.right) car.angle += turnSpeed * dt;

  // Forward acceleration vector
  if (throttle !== 0) {
    const ax = Math.cos(car.angle) * throttle * accel;
    const ay = Math.sin(car.angle) * throttle * accel;
    car.vx += ax * dt;
    car.vy += ay * dt;
  }

  // Friction & Grip
  const friction = car.drifting ? 0.987 : (onTrack ? 0.975 : 0.92);
  const lateralFriction = car.drifting ? (settings.driftAssist ? 0.88 : 0.91) : (onTrack ? 0.70 : 0.82);

  // Apply friction to decomposed velocities
  const curForward = car.vx * forwardDirX + car.vy * forwardDirY;
  const curLateral = car.vx * normalDirX + car.vy * normalDirY;

  const updatedForward = curForward * friction;
  const updatedLateral = curLateral * lateralFriction;

  car.vx = forwardDirX * updatedForward + normalDirX * updatedLateral;
  car.vy = forwardDirY * updatedForward + normalDirY * updatedLateral;

  car.speed = Math.hypot(car.vx, car.vy);
  if (car.speed > effectiveMaxSpeed) {
    const scale = effectiveMaxSpeed / car.speed;
    car.vx *= scale;
    car.vy *= scale;
    car.speed = effectiveMaxSpeed;
  }

  car.x += car.vx * dt;
  car.y += car.vy * dt;

  // Boundary clamp
  car.x = Math.max(10, Math.min(canvas.width - 10, car.x));
  car.y = Math.max(10, Math.min(canvas.height - 10, car.y));

  // Skid marks while drifting or off-track
  if (car.drifting || (!onTrack && car.speed > 80)) {
    skidmarks.push({ x: car.x, y: car.y, alpha: 0.6 });
    if (skidmarks.length > 250) skidmarks.shift();
  }

  // Record trail for ghost
  currentLapTime = performance.now() - lapStartTime;
  currentLapTrail.push({
    t: currentLapTime,
    x: car.x,
    y: car.y,
    angle: car.angle
  });

  // Checkpoint collision logic
  const targetCp = currentTrack.checkpoints[currentCheckpointIdx];
  if (targetCp) {
    const d = distToSegment(car.x, car.y, targetCp.x1, targetCp.y1, targetCp.x2, targetCp.y2);
    const cpThreshold = (currentTrack.width / 2) + 24;
    if (d <= cpThreshold) {
      if (targetCp.isFinish) {
        // Lap complete!
        sfx.good();
        if (currentLapTime < bestLapTime) {
          bestLapTime = currentLapTime;
          bestLapTrail = [...currentLapTrail];
          saveBestGhost(bestLapTime, bestLapTrail);
          hudBestTime.textContent = fmtTime(bestLapTime);
          toast({ title: "NEW RECORD!", body: `Lap time: ${fmtTime(bestLapTime)}`, icon: "check" });
        }
        sessionLap = (sessionLap % 3) + 1;
        hudLapCount.textContent = `${sessionLap} / 3`;
        // Seamless flying lap: keep driving, reset clock and target sector 1
        lapStartTime = performance.now();
        currentLapTrail = [];
        currentCheckpointIdx = 1;
      } else {
        sfx.click();
        currentCheckpointIdx = (currentCheckpointIdx + 1) % currentTrack.checkpoints.length;
      }
    }
  }

  // Update HUD
  hudSpeed.textContent = `${String(Math.round(car.speed * 0.8)).padStart(3, "0")} KM/H`;
  hudLapTime.textContent = fmtTime(currentLapTime);

  // Update Brake & Gear HUD status
  if (hudBrakeStatus) {
    if (car.braking) {
      hudBrakeStatus.textContent = "BRAKING";
      hudBrakeStatus.className = "hud-val hud-brake-status status--braking";
    } else if (car.reversing) {
      hudBrakeStatus.textContent = "REVERSE";
      hudBrakeStatus.className = "hud-val hud-brake-status status--reverse";
    } else if (car.drifting) {
      hudBrakeStatus.textContent = "DRIFT";
      hudBrakeStatus.className = "hud-val hud-brake-status status--drift";
    } else {
      hudBrakeStatus.textContent = "DRIVE";
      hudBrakeStatus.className = "hud-val hud-brake-status";
    }
  }

  // Delta vs ghost
  if (bestLapTrail.length > 0) {
    const ghostSample = getGhostAt(currentLapTime);
    if (ghostSample) {
      const ghostDist = Math.hypot(ghostSample.x - currentTrack.start.x, ghostSample.y - currentTrack.start.y);
      const carDist = Math.hypot(car.x - currentTrack.start.x, car.y - currentTrack.start.y);
      const deltaMs = Math.round((currentLapTime - ghostSample.t) / 10) / 100;
      const ahead = carDist >= ghostDist;
      hudDelta.className = `hud-val ${ahead ? "delta-ahead" : "delta-behind"}`;
      hudDelta.textContent = `${ahead ? "-" : "+"}${Math.abs(deltaMs).toFixed(2)}s`;
    }
  }
}

function getGhostAt(timeMs) {
  if (!bestLapTrail.length) return null;
  for (let i = 0; i < bestLapTrail.length - 1; i++) {
    if (bestLapTrail[i].t <= timeMs && bestLapTrail[i + 1].t >= timeMs) {
      const p1 = bestLapTrail[i];
      const p2 = bestLapTrail[i + 1];
      const factor = (timeMs - p1.t) / (p2.t - p1.t || 1);
      return {
        t: timeMs,
        x: p1.x + (p2.x - p1.x) * factor,
        y: p1.y + (p2.y - p1.y) * factor,
        angle: p1.angle + (p2.angle - p1.angle) * factor
      };
    }
  }
  return bestLapTrail[bestLapTrail.length - 1];
}

// ==========================================
// RENDERING PIPELINE
// ==========================================
function draw() {
  ctx.fillStyle = "#020306";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Subtle grid lines
  ctx.strokeStyle = "#08101a";
  ctx.lineWidth = 1;
  for (let x = 0; x < canvas.width; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }
  for (let y = 0; y < canvas.height; y += 40) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }

  // Draw track asphalt / ribbon
  const path = currentTrack.path;
  if (path.length > 2) {
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // Track outer glow border
    ctx.strokeStyle = "rgba(0, 240, 255, 0.4)";
    ctx.lineWidth = currentTrack.width + 8;
    ctx.shadowColor = "#00f0ff";
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.moveTo(path[0][0], path[0][1]);
    for (let i = 1; i < path.length; i++) ctx.lineTo(path[i][0], path[i][1]);
    ctx.closePath();
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Track asphalt surface
    ctx.strokeStyle = "#080e18";
    ctx.lineWidth = currentTrack.width;
    ctx.stroke();

    // Subtle edge borders
    ctx.strokeStyle = "rgba(0, 240, 255, 0.6)";
    ctx.lineWidth = currentTrack.width + 1;
    ctx.stroke();

    ctx.strokeStyle = "#080e18";
    ctx.lineWidth = currentTrack.width - 2;
    ctx.stroke();

    // Centerline luminous dashed guide
    ctx.strokeStyle = "rgba(0, 240, 255, 0.25)";
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 12]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Draw Dynamic Racing Line (Apex & Braking Zones)
  drawRacingLine();

  // Draw Checkpoints / Sector Gates
  for (let i = 0; i < currentTrack.checkpoints.length; i++) {
    const cp = currentTrack.checkpoints[i];
    const isTarget = (i === currentCheckpointIdx);

    if (cp.isFinish) {
      // Start / Finish Line: Gold neon with checkered bar
      ctx.lineWidth = isTarget ? 6 : 4;
      ctx.strokeStyle = isTarget ? "#ffd700" : "rgba(255, 215, 0, 0.85)";
      ctx.shadowColor = isTarget ? "#ffd700" : "transparent";
      ctx.shadowBlur = isTarget ? 14 : 0;
      ctx.beginPath();
      ctx.moveTo(cp.x1, cp.y1);
      ctx.lineTo(cp.x2, cp.y2);
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Checkered white dashes along the finish line
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 3;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(cp.x1, cp.y1);
      ctx.lineTo(cp.x2, cp.y2);
      ctx.stroke();
      ctx.setLineDash([]);
    } else {
      // Intermediate Sector Gates (S1..S5)
      ctx.lineWidth = isTarget ? 4 : 2;
      ctx.strokeStyle = isTarget ? "#00ff66" : (i < currentCheckpointIdx ? "rgba(0, 255, 102, 0.25)" : "rgba(0, 180, 255, 0.25)");
      ctx.shadowColor = isTarget ? "#00ff66" : "transparent";
      ctx.shadowBlur = isTarget ? 12 : 0;
      ctx.beginPath();
      ctx.moveTo(cp.x1, cp.y1);
      ctx.lineTo(cp.x2, cp.y2);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
  }

  // Draw Skidmarks
  for (const s of skidmarks) {
    ctx.fillStyle = `rgba(0, 136, 255, ${s.alpha * 0.4})`;
    ctx.fillRect(s.x - 2, s.y - 2, 4, 4);
    s.alpha -= 0.002;
  }

  // Draw Brake / Drift Particles
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    ctx.fillStyle = p.color;
    ctx.globalAlpha = p.alpha;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    p.x += p.vx * 0.016;
    p.y += p.vy * 0.016;
    p.alpha -= p.decay;
    p.size *= 0.96;
    if (p.alpha <= 0) particles.splice(i, 1);
  }

  // Draw Ghost Car (45% opacity)
  if (bestLapTrail.length > 0) {
    const ghost = getGhostAt(currentLapTime);
    if (ghost) {
      drawCar(ghost.x, ghost.y, ghost.angle, "rgba(255, 0, 127, 0.45)", false, false, false);
    }
  }

  // Draw AI Rival Cars
  drawRivals();

  // Draw Player Car
  drawCar(car.x, car.y, car.angle, "#0088ff", car.drifting, car.braking, car.reversing);

  // Editor mode points & live loop preview
  if (editorMode) {
    drawEditorPreview();
  }

  // Pre-Race CRT Starting Overlay
  if (raceState === "ready" && !editorMode) {
    drawReadyOverlay();
  }
}

function drawReadyOverlay() {
  ctx.save();
  const bannerW = 440;
  const bannerH = 130;
  const bx = (canvas.width - bannerW) / 2;
  const by = (canvas.height - bannerH) / 2;

  // Translucent backdrop
  ctx.fillStyle = "rgba(4, 8, 16, 0.90)";
  ctx.fillRect(bx, by, bannerW, bannerH);

  // Cyan glowing border
  ctx.strokeStyle = "#00f0ff";
  ctx.lineWidth = 2;
  ctx.shadowColor = "#00f0ff";
  ctx.shadowBlur = 12;
  ctx.strokeRect(bx, by, bannerW, bannerH);
  ctx.shadowBlur = 0;

  // Gold corner brackets
  ctx.fillStyle = "#ffd700";
  ctx.fillRect(bx - 2, by - 2, 8, 8);
  ctx.fillRect(bx + bannerW - 6, by - 2, 8, 8);
  ctx.fillRect(bx - 2, by + bannerH - 6, 8, 8);
  ctx.fillRect(bx + bannerW - 6, by + bannerH - 6, 8, 8);

  ctx.textAlign = "center";
  ctx.font = "13px 'Press Start 2P', monospace";
  ctx.fillStyle = "#ffd700";
  ctx.shadowColor = "#ffd700";
  ctx.shadowBlur = 8;
  ctx.fillText("READY TO RACE", canvas.width / 2, by + 34);
  ctx.shadowBlur = 0;

  // Pulsing start command
  const flash = Math.floor(performance.now() / 420) % 2 === 0;
  ctx.font = "9px 'Press Start 2P', monospace";
  ctx.fillStyle = flash ? "#00ff66" : "#ffffff";
  ctx.fillText("PRESS [SPACE] OR [ACCEL] TO START", canvas.width / 2, by + 68);

  ctx.font = "7.5px 'Press Start 2P', monospace";
  ctx.fillStyle = "rgba(255, 255, 255, 0.75)";
  ctx.fillText("(OR TAP / CLICK CANVAS TO LAUNCH)", canvas.width / 2, by + 90);

  ctx.font = "7px 'Press Start 2P', monospace";
  ctx.fillStyle = "#00f0ff";
  ctx.fillText(`CIRCUIT: ${currentTrack.name.toUpperCase()}`, canvas.width / 2, by + 114);

  ctx.restore();
}

function drawEditorPreview() {
  if (customPoints.length > 1) {
    // Draw preview line connecting placed points
    ctx.strokeStyle = "rgba(255, 183, 0, 0.4)";
    ctx.lineWidth = 40;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(customPoints[0][0], customPoints[0][1]);
    for (let i = 1; i < customPoints.length; i++) {
      ctx.lineTo(customPoints[i][0], customPoints[i][1]);
    }
    if (customPoints.length >= 3) {
      ctx.setLineDash([6, 6]);
      ctx.lineTo(customPoints[0][0], customPoints[0][1]);
      ctx.stroke();
      ctx.setLineDash([]);
    } else {
      ctx.stroke();
    }
  }

  // Draw nodes with indices
  for (let i = 0; i < customPoints.length; i++) {
    const p = customPoints[i];
    const isStart = i === 0;

    ctx.fillStyle = isStart ? "#ffd700" : "#00f0ff";
    ctx.shadowColor = isStart ? "#ffd700" : "#00f0ff";
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(p[0], p[1], isStart ? 8 : 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Node label
    ctx.fillStyle = "#ffffff";
    ctx.font = "9px 'Press Start 2P', monospace";
    ctx.fillText(isStart ? "START" : `#${i + 1}`, p[0] + 12, p[1] + 4);
  }

  // Draw start direction arrow if at least 2 points
  if (customPoints.length >= 2) {
    const p1 = customPoints[0];
    const p2 = customPoints[1];
    const angle = Math.atan2(p2[1] - p1[1], p2[0] - p1[0]);
    const arrowLen = 35;
    const ax = p1[0] + Math.cos(angle) * arrowLen;
    const ay = p1[1] + Math.sin(angle) * arrowLen;

    ctx.strokeStyle = "#ffd700";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(p1[0], p1[1]);
    ctx.lineTo(ax, ay);
    ctx.stroke();

    // Arrow tip
    ctx.fillStyle = "#ffd700";
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(ax - Math.cos(angle - 0.4) * 8, ay - Math.sin(angle - 0.4) * 8);
    ctx.lineTo(ax - Math.cos(angle + 0.4) * 8, ay - Math.sin(angle + 0.4) * 8);
    ctx.closePath();
    ctx.fill();
  }
}

function drawCar(x, y, angle, color, isDrift, isBraking, isReversing) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);

  // Car chassis
  ctx.fillStyle = color;
  ctx.fillRect(-12, -7, 24, 14);

  // Windshield
  ctx.fillStyle = "#020306";
  ctx.fillRect(-2, -5, 8, 10);

  // Headlights
  ctx.fillStyle = "#fff";
  ctx.fillRect(10, -6, 2, 3);
  ctx.fillRect(10, 3, 2, 3);

  // TAILLIGHTS: Reactive to Braking, Reversing, or Normal Driving
  if (isBraking) {
    // Glowing Crimson Active Brake Lamps with bright asphalt halo
    ctx.fillStyle = "#ff0033";
    ctx.shadowColor = "#ff0033";
    ctx.shadowBlur = 14;
    ctx.fillRect(-14, -7, 4, 4);
    ctx.fillRect(-14, 3, 4, 4);
    ctx.shadowBlur = 0;
  } else if (isReversing) {
    // White Reverse Lamps
    ctx.fillStyle = "#ffffff";
    ctx.shadowColor = "#ffffff";
    ctx.shadowBlur = 8;
    ctx.fillRect(-13, -6, 3, 3);
    ctx.fillRect(-13, 3, 3, 3);
    ctx.shadowBlur = 0;
  } else {
    // Normal Running Taillights
    ctx.fillStyle = "#ff3b30";
    ctx.fillRect(-12, -6, 2, 3);
    ctx.fillRect(-12, 3, 2, 3);
  }

  if (isDrift) {
    // Neon drift sparks
    ctx.fillStyle = "#ffb700";
    ctx.fillRect(-16, -6 + (Math.random() * 4 - 2), 4, 2);
    ctx.fillRect(-16, 4 + (Math.random() * 4 - 2), 4, 2);
  }

  ctx.restore();
}

let lastFrame = performance.now();
function gameLoop(now) {
  const dt = Math.min(0.1, (now - lastFrame) / 1000);
  lastFrame = now;

  if (!editorMode) {
    if (raceState === "racing") {
      updatePhysics(dt);
      updateRivals(dt);
    }
  }
  draw();
  requestAnimationFrame(gameLoop);
}

// ==========================================
// INPUT EVENT LISTENERS
// ==========================================
function matchesKey(code, actionList) {
  return Array.isArray(actionList) && actionList.includes(code);
}

window.addEventListener("keydown", (e) => {
  // If actively rebinding a key in the modal
  if (rebindingAction) {
    e.preventDefault();
    if (e.code === "Escape") {
      rebindingAction = null;
      renderKeybindsUI();
      return;
    }
    controls[rebindingAction] = [e.code];
    rebindingAction = null;
    saveControls();
    renderKeybindsUI();
    sfx.good();
    toast({ title: "KEY BOUND", body: `${ACTION_LABELS[rebindingAction] || "ACTION"} -> ${formatKeyName(e.code)}`, icon: "check" });
    return;
  }

  // Pre-race start key detection (Space, W, Up, Accel, Drift, Steer)
  if (raceState === "ready" && !editorMode) {
    if (e.code === "Space" || matchesKey(e.code, controls.accel) || matchesKey(e.code, controls.drift) || matchesKey(e.code, controls.left) || matchesKey(e.code, controls.right)) {
      startRace();
    }
  }

  // Regular gameplay controls
  if (matchesKey(e.code, controls.accel)) {
    if (!keys.up) sfx.rev();
    keys.up = true;
  }
  if (matchesKey(e.code, controls.brake)) {
    keys.down = true;
  }
  if (matchesKey(e.code, controls.left)) keys.left = true;
  if (matchesKey(e.code, controls.right)) keys.right = true;
  if (matchesKey(e.code, controls.drift)) {
    keys.drift = true;
    e.preventDefault();
  }
  if (matchesKey(e.code, controls.restart)) resetCar(true);

  // Undo point in editor mode via Backspace or Ctrl+Z
  if (editorMode && (e.code === "Backspace" || (e.code === "KeyZ" && (e.ctrlKey || e.metaKey)))) {
    e.preventDefault();
    undoPoint();
  }
});

window.addEventListener("keyup", (e) => {
  if (rebindingAction) return;
  if (matchesKey(e.code, controls.accel)) keys.up = false;
  if (matchesKey(e.code, controls.brake)) keys.down = false;
  if (matchesKey(e.code, controls.left)) keys.left = false;
  if (matchesKey(e.code, controls.right)) keys.right = false;
  if (matchesKey(e.code, controls.drift)) keys.drift = false;
});

// ==========================================
// CONTROLS MODAL WIRING
// ==========================================
function openControlsModal() {
  sfx.click();
  rebindingAction = null;
  renderKeybindsUI();
  if (inputSteerSens) inputSteerSens.value = settings.steerSens;
  if (valSteerSens) valSteerSens.textContent = `${settings.steerSens}%`;
  if (inputBrakeForce) inputBrakeForce.value = settings.brakeForce;
  if (valBrakeForce) valBrakeForce.textContent = `${settings.brakeForce}%`;
  if (btnToggleDrift && valDriftAssist) {
    btnToggleDrift.textContent = `DRIFT ASSIST: [${settings.driftAssist ? "ON" : "OFF"}]`;
    valDriftAssist.textContent = settings.driftAssist ? "ON" : "OFF";
  }
  modalControls.style.display = "flex";
}

function closeControlsModal() {
  sfx.click();
  rebindingAction = null;
  modalControls.style.display = "none";
}

if (btnControls) btnControls.addEventListener("click", openControlsModal);
if (btnCloseControls) btnCloseControls.addEventListener("click", closeControlsModal);
if (modalControlsBackdrop) modalControlsBackdrop.addEventListener("click", closeControlsModal);
if (btnSaveControls) btnSaveControls.addEventListener("click", () => {
  saveControls();
  saveSettings();
  closeControlsModal();
  toast({ title: "CONTROLS SAVED", icon: "check" });
});

if (btnResetControls) {
  btnResetControls.addEventListener("click", () => {
    sfx.deny();
    controls = JSON.parse(JSON.stringify(DEFAULT_CONTROLS));
    settings = { ...DEFAULT_SETTINGS };
    saveControls();
    saveSettings();
    renderKeybindsUI();
    if (inputSteerSens) inputSteerSens.value = 100;
    if (valSteerSens) valSteerSens.textContent = "100%";
    if (inputBrakeForce) inputBrakeForce.value = 100;
    if (valBrakeForce) valBrakeForce.textContent = "100%";
    if (btnToggleDrift && valDriftAssist) {
      btnToggleDrift.textContent = "DRIFT ASSIST: [ON]";
      valDriftAssist.textContent = "ON";
    }
    toast({ title: "DEFAULTS RESTORED", icon: "check" });
  });
}

// Preset buttons
document.querySelectorAll("[data-preset]").forEach((btn) => {
  btn.addEventListener("click", () => applyPreset(btn.dataset.preset));
});

// Keybind grid click handler
if (keybindsGrid) {
  keybindsGrid.addEventListener("click", (e) => {
    const badge = e.target.closest(".key-badge");
    if (!badge) return;
    sfx.click();
    rebindingAction = badge.dataset.action;
    renderKeybindsUI();
  });
}

// Sliders & Toggles
if (inputSteerSens) {
  inputSteerSens.addEventListener("input", (e) => {
    settings.steerSens = Number(e.target.value);
    if (valSteerSens) valSteerSens.textContent = `${settings.steerSens}%`;
    saveSettings();
  });
}

if (inputBrakeForce) {
  inputBrakeForce.addEventListener("input", (e) => {
    settings.brakeForce = Number(e.target.value);
    if (valBrakeForce) valBrakeForce.textContent = `${settings.brakeForce}%`;
    saveSettings();
  });
}

if (btnToggleDrift) {
  btnToggleDrift.addEventListener("click", () => {
    sfx.click();
    settings.driftAssist = !settings.driftAssist;
    btnToggleDrift.textContent = `DRIFT ASSIST: [${settings.driftAssist ? "ON" : "OFF"}]`;
    if (valDriftAssist) valDriftAssist.textContent = settings.driftAssist ? "ON" : "OFF";
    saveSettings();
  });
}

// ==========================================
// TRACK EDITOR & GUIDE ENHANCEMENTS
// ==========================================
function updateEditorStatus() {
  if (editorPointsCount) {
    editorPointsCount.textContent = `NODES: [${customPoints.length} / MIN 4]`;
    editorPointsCount.style.color = customPoints.length >= 4 ? "#00ff66" : "#ffb700";
  }
  if (editorTrackStatus) {
    if (customPoints.length === 0) {
      editorTrackStatus.textContent = "Click canvas to place circuit nodes";
    } else if (customPoints.length < 4) {
      editorTrackStatus.textContent = `Need ${4 - customPoints.length} more node${4 - customPoints.length > 1 ? "s" : ""} to complete loop`;
    } else {
      editorTrackStatus.textContent = "Closed loop circuit ready! Test or save now.";
    }
  }
}

function undoPoint() {
  if (customPoints.length > 0) {
    customPoints.pop();
    updateEditorStatus();
    sfx.click();
  }
}

if (btnUndoTrack) btnUndoTrack.addEventListener("click", undoPoint);

if (btnToggleGuide && trackGuide) {
  btnToggleGuide.addEventListener("click", () => {
    sfx.click();
    const isHidden = trackGuide.style.display === "none";
    trackGuide.style.display = isHidden ? "flex" : "none";
    btnToggleGuide.textContent = isHidden ? "HIDE GUIDE" : "HOW TO BUILD A TRACK ?";
  });
}

trackSelect.addEventListener("change", () => {
  sfx.click();
  currentTrackKey = trackSelect.value;
  if (currentTrackKey !== "custom") {
    currentTrack = TRACKS[currentTrackKey];
  }
  loadBestGhost();
  resetCar(true);
});

btnEditor.addEventListener("click", () => {
  editorMode = !editorMode;
  sfx.click();
  editorAside.style.display = editorMode ? "block" : "none";
  btnEditor.textContent = editorMode ? "EXIT EDITOR" : "TRACK EDITOR";
  if (editorMode) {
    customPoints = [...currentTrack.path];
    updateEditorStatus();
  }
});

canvas.addEventListener("click", (e) => {
  if (editorMode) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = Math.round((e.clientX - rect.left) * scaleX);
    const y = Math.round((e.clientY - rect.top) * scaleY);
    customPoints.push([x, y]);
    sfx.click();
    updateEditorStatus();
    return;
  }
  if (raceState === "ready") {
    startRace();
  }
});

canvas.addEventListener("pointerdown", () => {
  if (!editorMode && raceState === "ready") {
    startRace();
  }
});

btnClearTrack.addEventListener("click", () => {
  customPoints = [];
  updateEditorStatus();
  sfx.deny();
});

if (btnTestDrive) {
  btnTestDrive.addEventListener("click", () => {
    if (customPoints.length < 4) {
      toast({ title: "INCOMPLETE", body: "Need at least 4 spline points.", icon: "alert" });
      return;
    }
    TRACKS.custom = createTrackFromPoints(customPoints, "Custom Circuit");
    currentTrackKey = "custom";
    currentTrack = TRACKS.custom;
    trackSelect.value = "custom";
    editorMode = false;
    editorAside.style.display = "none";
    btnEditor.textContent = "TRACK EDITOR";
    resetCar(true);
    sfx.win();
    toast({ title: "TEST DRIVE READY", body: "Press [Space] or [W] to launch test drive!", icon: "check" });
  });
}

btnSaveTrack.addEventListener("click", () => {
  if (customPoints.length < 4) {
    toast({ title: "INCOMPLETE", body: "Need at least 4 spline points.", icon: "alert" });
    return;
  }
  TRACKS.custom = createTrackFromPoints(customPoints, "Custom Circuit");
  trackSelect.value = "custom";
  currentTrackKey = "custom";
  currentTrack = TRACKS.custom;
  sfx.win();
  toast({ title: "CUSTOM TRACK SAVED", body: "Circuit ready for ghost lap records!", icon: "check" });
  resetCar(true);
});

btnExportTrack.addEventListener("click", () => {
  const code = btoa(JSON.stringify(customPoints));
  navigator.clipboard?.writeText?.(code);
  toast({ title: "TRACK CODE COPIED", body: code.slice(0, 20) + "...", icon: "check" });
});

btnImportTrack.addEventListener("click", () => {
  const code = prompt("Paste track base64 code:");
  if (code) {
    try {
      const pts = JSON.parse(atob(code));
      if (Array.isArray(pts) && pts.length >= 3) {
        customPoints = pts;
        updateEditorStatus();
        btnSaveTrack.click();
      }
    } catch {
      toast({ title: "INVALID TRACK CODE", icon: "alert" });
    }
  }
});

// Racing line toggle wiring
function updateRacingLineUI() {
  if (btnToggleRacingLine) {
    btnToggleRacingLine.textContent = `RACING LINE: [${settings.racingLine ? "ON" : "OFF"}]`;
  }
}

if (btnToggleRacingLine) {
  btnToggleRacingLine.addEventListener("click", () => {
    sfx.click();
    settings.racingLine = !settings.racingLine;
    saveSettings();
    updateRacingLineUI();
    toast({ title: "RACING LINE", body: settings.racingLine ? "OPTIMAL LINE VISIBLE" : "RACING LINE HIDDEN", icon: "check" });
  });
}

window.addEventListener("arcade:restart", () => {
  resetCar(true);
});

// Initialization
renderKeybindsUI();
updateRacingLineUI();
loadBestGhost();
resetCar(true);
requestAnimationFrame(gameLoop);
