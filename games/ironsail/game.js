/* ================================================================
 *  IRONSAIL — open-sea naval conquest & trading
 *  Sail a 14 km archipelago: trade between ports, sink pirate raiders (alone or in packs),
 *  storm island forts to capture them, and hunt the Ghost Ship and the Kraken.
 * ================================================================ */
import { initShell, escapeHtml, toast } from "/shared/shell.js";
import { sfx } from "/shared/sound.js";
import { playExplosion, playHit, playTone, setEngineHum } from "/shared/audio.js";
import { saveGameScore } from "/shared/save.js";
import { createParticles, createLightLayer, vignette, glow } from "/shared/gfx.js";
import {
  WORLD,
  SAVE_KEY,
  COMMODITIES,
  SHIPS,
  UPGRADES,
  MAX_UPGRADE,
  upgradeCost,
  generateWorld,
  priceAt,
  sellPrice,
  shipStats,
  windFactor,
  pirateSpawns,
  sectorOf,
  validateSave,
  cargoCount,
  hasWon
} from "./world.js";
import * as art from "./art.js";
import { enableTouchLayout } from "/shared/touchlayout.js";

initShell({ crumb: "IronSail" });

const canvas = document.getElementById("is-canvas");
const ctx = canvas.getContext("2d");
const W = canvas.width;
const H = canvas.height;
const TAU = Math.PI * 2;
const wrap = (a) => ((a + Math.PI) % TAU + TAU) % TAU - Math.PI;

// ─────────────────────────── world & save ───────────────────────────
const world = generateWorld(1717);
let save = (() => {
  try {
    return validateSave(JSON.parse(localStorage.getItem(SAVE_KEY) || "null"), world);
  } catch {
    return validateSave(null, world);
  }
})();
const persist = () => {
  save.x = player.x;
  save.y = player.y;
  save.hull = player.hp;
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch {}
};

// Runtime island state
const islands = world.islands.map((isl) => ({
  ...isl,
  owner: save.captured.includes(isl.id) ? "player" : "hostile",
  fortCount: isl.forts,
  forts: [],
  img: null,
  dock: { x: isl.x + Math.cos(isl.dockAngle) * isl.r * 1.22, y: isl.y + Math.sin(isl.dockAngle) * isl.r * 1.22 }
}));
for (const isl of islands) {
  if (isl.owner !== "hostile") continue;
  for (let k = 0; k < isl.fortCount; k++) {
    const a = isl.dockAngle + Math.PI + (k - (isl.fortCount - 1) / 2) * 1.1;
    const hp = 220 + isl.danger * 90;
    isl.forts.push({ x: isl.x + Math.cos(a) * isl.r * 0.78, y: isl.y + Math.sin(a) * isl.r * 0.62, hp, maxHp: hp, cd: 1 + Math.random() * 2, angle: a });
  }
}
const imgCache = [];
function islandImg(isl) {
  if (!isl.img) {
    isl.img = art.renderIsland(isl);
    imgCache.push(isl);
    if (imgCache.length > 12) imgCache.shift().img = null;
  }
  return isl.img;
}
const features = world.features.map((f, id) => ({ ...f, id, taken: false, circles: f.kind === "rocks" ? art.rockCircles(f) : null }));

// ─────────────────────────── entities ───────────────────────────
const fx = createParticles(1200);
const light = createLightLayer(W, H);
const ships = [];
const balls = [];
const wakes = [];
const critters = [];
let nextId = 1;

function makeShip(kind, x, y, tier, extra = {}) {
  const st = kind === "player" ? shipStats(save.tier, save.upgrades) : shipStats(tier, {});
  const s = {
    id: nextId++,
    kind,
    x,
    y,
    angle: Math.random() * TAU,
    speed: 0,
    trim: kind === "player" ? 0.6 : 0.8,
    tier: kind === "player" ? save.tier : tier,
    st,
    hp: st.maxHull,
    maxHp: st.maxHull,
    reload: [0, 0, 0],
    sinking: 0,
    ai: { state: "patrol", home: { x, y }, wander: Math.random() * TAU, t: 0 },
    ...extra
  };
  if (kind !== "player") {
    // Enemy balance: pirates hit a bit softer than the player's crew, forts harder
    s.st = { ...s.st, damage: s.st.damage * (kind === "navy" ? 0.8 : 0.7), reload: s.st.reload * 1.25 };
  }
  ships.push(s);
  return s;
}

const player = makeShip("player", save.x, save.y, save.tier);
player.angle = 0;
if (save.hull) player.hp = Math.min(player.maxHp, save.hull);

// Guards around hostile islands, merchants on the trade lanes
for (const isl of islands) {
  if (isl.owner !== "hostile") continue;
  for (let k = 0; k < isl.guards; k++) {
    const a = (k / Math.max(1, isl.guards)) * TAU;
    const g = makeShip("navy", isl.x + Math.cos(a) * (isl.r + 260), isl.y + Math.sin(a) * (isl.r + 260), Math.min(3, Math.floor(isl.danger * 0.7)));
    g.ai.island = isl.id;
    g.ai.orbit = a;
  }
}
function spawnMerchant() {
  const from = islands[Math.floor(Math.random() * islands.length)];
  const to = islands[Math.floor(Math.random() * islands.length)];
  if (from === to) return;
  const m = makeShip("merchant", from.dock.x, from.dock.y, 1);
  m.ai.to = to.id;
}
for (let k = 0; k < 10; k++) spawnMerchant();

// Pirate streaming: 2000px cells around the player, re-rolled every 3-minute epoch
const spawnedCells = new Set();
let pirateEpoch = 0;
let clock = save.played || 0;
function streamPirates() {
  pirateEpoch = Math.floor(clock / 180);
  const pcx = Math.floor(player.x / 2000);
  const pcy = Math.floor(player.y / 2000);
  for (let cy = pcy - 1; cy <= pcy + 1; cy++) {
    for (let cx = pcx - 1; cx <= pcx + 1; cx++) {
      if (cx < 0 || cy < 0 || cx > 6 || cy > 6) continue;
      const key = `${cx},${cy},${pirateEpoch}`;
      if (spawnedCells.has(key)) continue;
      spawnedCells.add(key);
      // Don't pop raiders into view: only cells whose spawn points are off screen
      for (const p of pirateSpawns(world, cx, cy, pirateEpoch)) {
        if (Math.hypot(p.x - player.x, p.y - player.y) < 1100) continue;
        const s = makeShip("pirate", p.x, p.y, p.tier, { group: p.group, leader: p.leader, pack: p.pack });
        s.ai.home = { x: p.x, y: p.y };
      }
    }
  }
  // Retire raiders far behind the player that aren't fighting
  for (let i = ships.length - 1; i >= 0; i--) {
    const s = ships[i];
    if (s.kind === "pirate" && s.ai.state !== "attack" && Math.hypot(s.x - player.x, s.y - player.y) > 4200) ships.splice(i, 1);
  }
}

// Bosses
const boss = { ghost: null, kraken: null };
function spawnBosses() {
  for (const b of world.bosses) {
    if (save.bosses.includes(b.id) || boss[b.id]) continue;
    if (Math.hypot(b.x - player.x, b.y - player.y) > 2200) continue;
    if (b.id === "ghost") {
      const g = makeShip("ghost", b.x, b.y, 3, { name: b.name });
      g.hp = g.maxHp = b.hp;
      g.st = { ...g.st, damage: 20, reload: 2.6, speedMult: 1.05, len: 140, beam: 42, guns: 10 };
      g.phase = 0;
      boss.ghost = g;
      toast({ title: "THE GHOST SHIP", body: "A spectral galleon rises from the mist!", icon: "skull" });
    } else {
      boss.kraken = {
        x: b.x,
        y: b.y,
        hp: b.hp,
        maxHp: b.hp,
        tentacles: Array.from({ length: 6 }, (_, k) => ({ a: (k / 6) * TAU, hp: 360, maxHp: 360, up: 0, slam: null })),
        headUp: 0,
        t: 0
      };
      toast({ title: "THE KRAKEN", body: "The trench churns. Sever its tentacles!", icon: "skull" });
    }
  }
}

// ─────────────────────────── environment ───────────────────────────
const wind = { dir: Math.random() * TAU, strength: 0.7, target: Math.random() * TAU };
const storms = Array.from({ length: 4 }, (_, k) => ({ x: Math.random() * WORLD, y: Math.random() * WORLD, r: 650 + Math.random() * 400, vx: Math.cos(k) * 22, vy: Math.sin(k * 1.7) * 22 }));
const DAY = 420; // seconds per full day
const darkness = () => {
  const p = (clock % DAY) / DAY; // 0 dawn → 0.5 dusk
  return Math.max(0, Math.min(0.62, (Math.cos((p - 0.25) * TAU) * -0.5 + 0.1) * 1.1));
};
const stormAt = (x, y) => storms.find((s) => Math.hypot(s.x - x, s.y - y) < s.r);

// ─────────────────────────── input ───────────────────────────
const keys = new Set();
let mouse = { x: 0, y: 0, down: false };
let screen = "intro"; // intro | sail | port | chart | paused | dead | won
window.addEventListener("keydown", (e) => {
  if (e.target instanceof Element && e.target.closest("input, textarea, select, [contenteditable]")) return;
  if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code) && screen === "sail") e.preventDefault();
  keys.add(e.code);
  if (e.repeat) return;
  if (screen === "sail") {
    if (e.code === "KeyE" && dockable()) openPort(dockable());
    else if (e.code === "KeyM") openChart();
    else if (e.code === "Escape") openPause();
  } else if ((screen === "chart" && (e.code === "KeyM" || e.code === "Escape")) || (screen === "paused" && e.code === "Escape") || (screen === "port" && (e.code === "Escape" || e.code === "KeyE"))) {
    closeModal();
  } else if (screen === "intro" && (e.code === "Enter" || e.code === "Space")) closeModal();
});
window.addEventListener("keyup", (e) => keys.delete(e.code));
window.addEventListener("blur", () => keys.clear());
const aimAt = (e) => {
  const r = canvas.getBoundingClientRect();
  mouse.x = ((e.clientX - r.left) / r.width) * W;
  mouse.y = ((e.clientY - r.top) / r.height) * H;
};
canvas.addEventListener("pointermove", aimAt);
canvas.addEventListener("pointerdown", (e) => {
  if (screen !== "sail") return;
  // A tap has no hover before it: aim at the finger straight away, not at the last position
  aimAt(e);
  mouse.down = true;
  canvas.setPointerCapture?.(e.pointerId);
});
canvas.addEventListener("pointerup", () => (mouse.down = false));
canvas.addEventListener("pointercancel", () => (mouse.down = false));

// Touch buttons: they press the same keys as the keyboard
const touchButtons = [...document.querySelectorAll("#is-touch [data-key]")];
for (const b of touchButtons) {
  const code = b.dataset.key;
  b.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    b.classList.add("is-pressed");
    window.dispatchEvent(new KeyboardEvent("keydown", { code, key: code === "Space" ? " " : code }));
  });
  for (const t of ["pointerup", "pointercancel", "pointerleave"]) {
    b.addEventListener(t, () => {
      if (!b.classList.contains("is-pressed")) return;
      b.classList.remove("is-pressed");
      window.dispatchEvent(new KeyboardEvent("keyup", { code, key: code }));
    });
  }
}
enableTouchLayout({ id: "ironsail", frame: document.getElementById("is-touch"), items: touchButtons });
const down = (...c) => c.some((k) => keys.has(k));

// ─────────────────────────── helpers ───────────────────────────
function pointInIsland(isl, x, y, scale = 1) {
  const dx = x - isl.x;
  const dy = y - isl.y;
  if (dx * dx + dy * dy > (isl.r * 1.5 * scale) ** 2) return false;
  const pts = isl.shape;
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i][0] * scale;
    const yi = pts[i][1] * scale;
    const xj = pts[j][0] * scale;
    const yj = pts[j][1] * scale;
    if (yi > dy !== yj > dy && dx < ((xj - xi) * (dy - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function dockable() {
  for (const isl of islands) {
    if (isl.owner !== "player") continue;
    if (Math.hypot(isl.dock.x - player.x, isl.dock.y - player.y) < 220 && player.speed < 110) return isl;
  }
  return null;
}
const hostileTo = (a, b) => {
  if (a === b || a.sinking || b.sinking) return false;
  if (a.kind === "merchant" || b.kind === "merchant") return false;
  if (a.kind === "player") return true;
  if (b.kind === "player") return true;
  return false;
};

// ─────────────────────────── ship physics ───────────────────────────
function sail(s, dt, cmd) {
  const turnRate = s.st.turn * (0.35 + 0.65 * Math.min(1, s.speed / 70));
  s.angle = wrap(s.angle + cmd.turn * turnRate * dt);
  s.trim = Math.max(0, Math.min(1, s.trim + cmd.trim * dt * 0.8));
  const reef = features.find((f) => f.kind === "reef" && Math.hypot(f.x - s.x, f.y - s.y) < f.r);
  const storm = stormAt(s.x, s.y);
  let target = 165 * s.st.speedMult * s.trim * windFactor(s.angle, wind.dir) * (0.75 + wind.strength * 0.4) * (reef ? 0.55 : 1) * (storm ? 1.1 : 1);
  if (s.boost > 0) target *= 1.45;
  if (s.kind !== "player") target *= 0.92;
  s.speed += (target - s.speed) * Math.min(1, dt * 0.9);
  let vx = Math.cos(s.angle) * s.speed;
  let vy = Math.sin(s.angle) * s.speed;
  // Whirlpools drag you in and spin you round
  for (const f of features) {
    if (f.kind !== "whirlpool") continue;
    const dx = f.x - s.x;
    const dy = f.y - s.y;
    const d = Math.hypot(dx, dy);
    if (d < f.r * 1.4) {
      const pull = (1 - d / (f.r * 1.4)) * 120;
      vx += (dx / d) * pull - (dy / d) * pull * 0.8;
      vy += (dy / d) * pull + (dx / d) * pull * 0.8;
      if (d < f.r * 0.35) damage(s, 14 * dt, null);
    }
  }
  s.x += vx * dt;
  s.y += vy * dt;
  s.x = Math.max(60, Math.min(WORLD - 60, s.x));
  s.y = Math.max(60, Math.min(WORLD - 60, s.y));
  // Islands: slide back out to sea, hurt if rammed at speed
  for (const isl of islands) {
    if (Math.abs(isl.x - s.x) > isl.r * 1.6 || Math.abs(isl.y - s.y) > isl.r * 1.6) continue;
    if (pointInIsland(isl, s.x, s.y, 1.02)) {
      const a = Math.atan2(s.y - isl.y, s.x - isl.x);
      for (let k = 0; k < 20 && pointInIsland(isl, s.x, s.y, 1.02); k++) {
        s.x += Math.cos(a) * 6;
        s.y += Math.sin(a) * 6;
      }
      if (s.speed > 80) damage(s, (s.speed - 80) * 0.25, null);
      s.speed *= 0.3;
    }
  }
  // Rocks and sea stacks
  for (const f of features) {
    if (f.kind !== "rocks" && f.kind !== "stack" && f.kind !== "lighthouse") continue;
    if (Math.abs(f.x - s.x) > 320 || Math.abs(f.y - s.y) > 320) continue;
    const circles = f.circles || [{ x: f.x, y: f.y, r: f.kind === "lighthouse" ? 44 : 34 }];
    for (const c of circles) {
      const d = Math.hypot(s.x - c.x, s.y - c.y);
      const min = c.r + s.st.beam * 0.6;
      if (d < min) {
        const nx = (s.x - c.x) / (d || 1);
        const ny = (s.y - c.y) / (d || 1);
        s.x = c.x + nx * min;
        s.y = c.y + ny * min;
        if (s.speed > 60) {
          damage(s, (s.speed - 60) * 0.2, null);
          fx.burst(s.x - nx * s.st.beam * 0.5, s.y - ny * s.st.beam * 0.5, { count: 8, speed: 90, life: 0.5, size: 3, color: "#b98a55", kind: "pixel" });
          if (s.kind === "player") playHit({ pitch: 70, duration: 0.2 });
        }
        s.speed *= 0.5;
      }
    }
  }
  s.boost = Math.max(0, (s.boost || 0) - dt);
  // Wake trail
  if (s.speed > 30 && Math.random() < 0.8) {
    const bx = s.x - Math.cos(s.angle) * s.st.len * 0.5;
    const by = s.y - Math.sin(s.angle) * s.st.len * 0.5;
    wakes.push({ x: bx, y: by, a: s.angle, life: 1.2, w: s.st.beam * 0.5, v: s.speed });
  }
}

function damage(s, amount, from) {
  if (s.sinking || s.ghostFade) return;
  s.hp -= amount;
  s.hitFlash = 0.15;
  if (from && s.kind !== "player") {
    s.ai.state = "attack";
    // A pack answers when one of them is hit
    if (s.group) for (const o of ships) if (o.group === s.group) o.ai.state = "attack";
  }
  if (s.hp <= 0) sink(s, from);
}

function sink(s, from) {
  s.sinking = 0.001;
  s.hp = 0;
  playExplosion({ duration: 0.8, lowpass: 380 });
  fx.burst(s.x, s.y, { count: 40, speed: 200, life: 1.2, size: 4, color: "#ffb347", color2: "#5a3a1a", kind: "pixel", drag: 0.95 });
  fx.spawn({ x: s.x, y: s.y, life: 0.6, size: 110, color: "#ffd166", kind: "ring", alpha: 0.8 });
  if (s.kind === "player") return playerLost();
  if (from === player) {
    const loot = { pirate: 60, navy: 90, merchant: 40, ghost: 1500 }[s.kind] || 40;
    const gold = Math.round(loot * (1 + s.tier * 0.6));
    save.gold += gold;
    popText(s.x, s.y, `+${gold} G`, "#ffd24a");
    if (s.kind === "merchant" || Math.random() < 0.35) features.push({ kind: "crate", x: s.x, y: s.y, seed: Math.floor(Math.random() * 1e9), loot: "cargo", id: features.length, taken: false, dropped: true });
    if (s.kind === "ghost") defeatBoss("ghost");
  }
}

function playerLost() {
  const lostGold = Math.floor(save.gold * 0.2);
  save.gold -= lostGold;
  save.cargo = {};
  screen = "dead";
  setEngineHum(false);
  sfx.bad();
  showModal(`
    <h2 class="is-title is-bad">SHIP LOST</h2>
    <p class="is-note">Your crew was fished out of the water. The cargo went down with her and ${lostGold} G were lost.</p>
    <div class="is-row"><button type="button" class="btn btn--primary" data-act="respawn">RETURN TO PORT</button></div>`);
}
function respawn() {
  // Nearest friendly harbour
  let best = islands[0];
  let bd = Infinity;
  for (const isl of islands) {
    if (isl.owner !== "player") continue;
    const d = Math.hypot(isl.x - player.x, isl.y - player.y);
    if (d < bd) {
      bd = d;
      best = isl;
    }
  }
  player.x = best.dock.x + Math.cos(best.dockAngle) * 80;
  player.y = best.dock.y + Math.sin(best.dockAngle) * 80;
  player.angle = best.dockAngle;
  player.sinking = 0;
  player.hp = player.maxHp;
  player.speed = 0;
  for (let i = ships.length - 1; i >= 0; i--) if (ships[i].kind === "pirate" && Math.hypot(ships[i].x - player.x, ships[i].y - player.y) < 1500) ships.splice(i, 1);
  persist();
  closeModal();
}

// ─────────────────────────── cannons ───────────────────────────
function fireSide(s, side, target) {
  const n = s.st.guns;
  const perp = s.angle + (side === 0 ? -Math.PI / 2 : Math.PI / 2);
  const bearing = Math.atan2(target.y - s.y, target.x - s.x);
  const aim = Math.abs(wrap(bearing - perp)) < 0.6 ? bearing : perp;
  const dist = Math.hypot(target.x - s.x, target.y - s.y);
  for (let k = 0; k < n; k++) {
    const off = (k / Math.max(1, n - 1) - 0.5) * s.st.len * 0.55;
    const x = s.x + Math.cos(s.angle) * off + Math.cos(perp) * s.st.beam * 0.5;
    const y = s.y + Math.sin(s.angle) * off + Math.sin(perp) * s.st.beam * 0.5;
    const a = aim + (Math.random() - 0.5) * 0.08;
    const sp = 430;
    balls.push({ x, y, vx: Math.cos(a) * sp + Math.cos(s.angle) * s.speed * 0.5, vy: Math.sin(a) * sp + Math.sin(s.angle) * s.speed * 0.5, life: Math.min(1.1, dist / sp + 0.25), owner: s, dmg: s.st.damage, spectral: s.kind === "ghost" });
    fx.spawn({ x, y, vx: Math.cos(a) * 40, vy: Math.sin(a) * 40, life: 0.5, size: 5, grow: 14, color: "#d9d9d9", kind: "smoke", alpha: 0.6 });
  }
  if (Math.hypot(s.x - player.x, s.y - player.y) < 900) playTone(90 + Math.random() * 20, 0.12, "sawtooth", s === player ? 0.1 : 0.05);
}

function autoFire(s, dt) {
  s.reload[0] -= dt;
  s.reload[1] -= dt;
  if (s.sinking || s.ghostFade) return;
  const range = s.kind === "ghost" ? 460 : 380;
  for (const side of [0, 1]) {
    if (s.reload[side] > 0) continue;
    const perp = s.angle + (side === 0 ? -Math.PI / 2 : Math.PI / 2);
    let best = null;
    let bd = range;
    const consider = (o) => {
      const d = Math.hypot(o.x - s.x, o.y - s.y);
      if (d > bd) return;
      if (Math.abs(wrap(Math.atan2(o.y - s.y, o.x - s.x) - perp)) > 0.62) return;
      bd = d;
      best = o;
    };
    if (s.kind === "player") {
      for (const o of ships) if (o !== s && hostileTo(s, o) && !o.ghostFade && (o.kind !== "merchant" || o.ai.state === "attacked")) consider(o);
      for (const isl of islands) if (isl.owner === "hostile") for (const f of isl.forts) if (f.hp > 0) consider(f);
      if (boss.kraken) for (const tt of boss.kraken.tentacles) if (tt.hp > 0 && tt.up > 0.5) consider(tentaclePos(tt));
      if (boss.kraken && boss.kraken.headUp > 0.5) consider(boss.kraken);
    } else if (s.ai.state === "attack") consider(player);
    if (best) {
      fireSide(s, side, best);
      s.reload[side] = s.st.reload * (0.9 + Math.random() * 0.2);
    }
  }
}

function updateBalls(dt) {
  for (let i = balls.length - 1; i >= 0; i--) {
    const b = balls[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    let hit = false;
    for (const s of ships) {
      if (s === b.owner || s.sinking || s.ghostFade) continue;
      if (b.owner.kind !== "player" && s.kind !== "player") continue;
      if (Math.hypot(s.x - b.x, s.y - b.y) < s.st.len * 0.42) {
        damage(s, b.dmg, b.owner);
        hit = true;
        break;
      }
    }
    if (!hit && b.owner === player) {
      for (const isl of islands) {
        if (isl.owner !== "hostile" || Math.hypot(isl.x - b.x, isl.y - b.y) > isl.r + 100) continue;
        for (const f of isl.forts) {
          if (f.hp > 0 && Math.hypot(f.x - b.x, f.y - b.y) < 26) {
            f.hp -= b.dmg;
            hit = true;
            if (f.hp <= 0) fortDestroyed(isl, f);
            break;
          }
        }
      }
      const kr = boss.kraken;
      if (!hit && kr) {
        for (const tt of kr.tentacles) {
          const p = tentaclePos(tt);
          if (tt.hp > 0 && tt.up > 0.5 && Math.hypot(p.x - b.x, p.y - b.y) < 34) {
            tt.hp -= b.dmg;
            hit = true;
            if (tt.hp <= 0) {
              fx.burst(p.x, p.y, { count: 30, speed: 180, life: 0.9, size: 4, color: "#6b2a7a", kind: "pixel" });
              popText(p.x, p.y, "SEVERED!", "#c77dff");
            }
          }
        }
        if (!hit && kr.headUp > 0.5 && Math.hypot(kr.x - b.x, kr.y - b.y) < 90) {
          kr.hp -= b.dmg * 1.5;
          hit = true;
          if (kr.hp <= 0) defeatBoss("kraken");
        }
      }
    }
    if (hit) {
      fx.burst(b.x, b.y, { count: 10, speed: 120, life: 0.45, size: 3, color: "#ffb347", color2: "#ff5a1f", kind: "spark" });
      if (Math.hypot(b.x - player.x, b.y - player.y) < 700) playHit({ pitch: 120, duration: 0.08 });
    }
    if (hit || b.life <= 0) {
      if (!hit) {
        // Splash where it fell short
        fx.burst(b.x, b.y, { count: 8, speed: 60, life: 0.5, size: 3, color: "#dff6ff", kind: "pixel", gravity: -30 });
        fx.spawn({ x: b.x, y: b.y, life: 0.5, size: 22, color: "#dff6ff", kind: "ring", alpha: 0.6 });
      }
      balls.splice(i, 1);
    }
  }
}

function fortDestroyed(isl, f) {
  fx.burst(f.x, f.y, { count: 40, speed: 200, life: 1, size: 4, color: "#8d8676", color2: "#ffb347", kind: "pixel" });
  playExplosion({ duration: 0.9, lowpass: 300 });
  popText(f.x, f.y, "FORT DOWN", "#ffd24a");
  if (isl.forts.every((q) => q.hp <= 0)) captureIsland(isl);
}

function captureIsland(isl) {
  isl.owner = "player";
  if (!save.captured.includes(isl.id)) save.captured.push(isl.id);
  for (const s of ships) if (s.kind === "navy" && s.ai.island === isl.id) s.ai.state = "flee";
  save.gold += 300 + isl.danger * 150;
  sfx.win();
  toast({ title: `${isl.name.toUpperCase()} CAPTURED`, body: `+${300 + isl.danger * 150} G • port unlocked • +${isl.tax} G taxes per minute`, icon: "trophy", duration: 4000 });
  saveGameScore("ironsail", save.captured.length, `${save.captured.length}/${islands.length} ISLANDS`);
  persist();
  checkVictory();
}

function defeatBoss(id) {
  if (save.bosses.includes(id)) return;
  save.bosses.push(id);
  const b = world.bosses.find((q) => q.id === id);
  save.gold += 2500;
  sfx.fanfare();
  toast({ title: `${b.name.toUpperCase()} DEFEATED`, body: "+2500 G and the sea breathes easier.", icon: "trophy", duration: 4500 });
  if (id === "kraken") {
    fx.burst(boss.kraken.x, boss.kraken.y, { count: 80, speed: 260, life: 1.4, size: 5, color: "#6b2a7a", color2: "#c77dff", kind: "pixel" });
    boss.kraken = null;
  } else boss.ghost = null;
  persist();
  checkVictory();
}

function checkVictory() {
  if (!hasWon(save, world)) return;
  screen = "won";
  showModal(`
    <h2 class="is-title is-good">RULER OF THE ARCHIPELAGO</h2>
    <p class="is-note">Every island flies your colours and both legends lie at the bottom of the sea.</p>
    <p class="is-note">${save.gold} G in the treasury.</p>
    <div class="is-row"><button type="button" class="btn btn--primary" data-act="close">KEEP SAILING</button></div>`);
}

// ─────────────────────────── AI ───────────────────────────
function steerTo(s, tx, ty) {
  const want = Math.atan2(ty - s.y, tx - s.x);
  const d = wrap(want - s.angle);
  return Math.max(-1, Math.min(1, d * 2.5));
}
function broadsideSteer(s, target) {
  // Put the target on a beam at ~260px
  const dx = target.x - s.x;
  const dy = target.y - s.y;
  const d = Math.hypot(dx, dy);
  if (d > 520) return steerTo(s, target.x, target.y);
  const bearing = Math.atan2(dy, dx);
  const left = wrap(bearing + Math.PI / 2 - s.angle);
  const right = wrap(bearing - Math.PI / 2 - s.angle);
  let want = Math.abs(left) < Math.abs(right) ? bearing + Math.PI / 2 : bearing - Math.PI / 2;
  if (d > 320) want += (want > bearing ? -0.35 : 0.35);
  if (d < 180) want += (want > bearing ? 0.4 : -0.4);
  return Math.max(-1, Math.min(1, wrap(want - s.angle) * 2.5));
}

function runAI(s, dt) {
  const ai = s.ai;
  const dp = Math.hypot(player.x - s.x, player.y - s.y);
  let cmd = { turn: 0, trim: 0.3 };
  if (s.kind === "merchant") {
    const to = islands[ai.to];
    if (ai.state === "attacked") {
      cmd.turn = steerTo(s, s.x * 2 - player.x, s.y * 2 - player.y);
      cmd.trim = 1;
    } else {
      cmd.turn = steerTo(s, to.dock.x, to.dock.y);
      if (Math.hypot(to.dock.x - s.x, to.dock.y - s.y) < 200) {
        const i = ships.indexOf(s);
        if (i >= 0) ships.splice(i, 1);
        spawnMerchant();
      }
    }
  } else if (s.kind === "navy") {
    const isl = islands[ai.island];
    if (ai.state === "flee" || isl.owner === "player") {
      cmd.turn = steerTo(s, s.x * 2 - isl.x, s.y * 2 - isl.y);
      if (dp > 2500) s.remove = true;
    } else if (dp < 800 || ai.state === "attack") {
      ai.state = dp < 1400 ? "attack" : "patrol";
      cmd.turn = broadsideSteer(s, player);
    } else {
      ai.orbit += dt * 0.08;
      cmd.turn = steerTo(s, isl.x + Math.cos(ai.orbit) * (isl.r + 280), isl.y + Math.sin(ai.orbit) * (isl.r + 280));
    }
  } else if (s.kind === "pirate") {
    if (ai.state !== "attack" && dp < 750 && screen === "sail") ai.state = "attack";
    if (ai.state === "attack") {
      if (s.hp < s.maxHp * 0.22 && !s.pack) {
        ai.state = "flee";
      }
      // Pack members fan out around their leader's target so they don't stack
      const k = s.leader ? 0 : (s.id % 3) - 1;
      const tgt = { x: player.x + Math.cos(player.angle + Math.PI / 2) * k * 140, y: player.y + Math.sin(player.angle + Math.PI / 2) * k * 140 };
      cmd.turn = broadsideSteer(s, tgt);
      if (dp > 2600) ai.state = "patrol";
    } else if (ai.state === "flee") {
      cmd.turn = steerTo(s, s.x * 2 - player.x, s.y * 2 - player.y);
      cmd.trim = 1;
      if (dp > 2000) s.remove = true;
    } else {
      ai.wander += (Math.random() - 0.5) * dt;
      const tx = ai.home.x + Math.cos(ai.wander) * 400;
      const ty = ai.home.y + Math.sin(ai.wander) * 400;
      cmd.turn = steerTo(s, tx, ty);
      cmd.trim = -0.2;
    }
  } else if (s.kind === "ghost") {
    // Phase in and out of the mist; untouchable while faded
    s.phase = (s.phase || 0) + dt;
    s.ghostFade = s.phase % 8 > 5.5;
    s.ai.state = dp < 1800 ? "attack" : "patrol";
    cmd.turn = s.ai.state === "attack" ? broadsideSteer(s, player) : 0;
  }
  // Keep AI ships off the rocks: veer away from anything close ahead
  for (const f of features) {
    if (f.kind !== "rocks" && f.kind !== "stack") continue;
    const ax = s.x + Math.cos(s.angle) * 160;
    const ay = s.y + Math.sin(s.angle) * 160;
    if (Math.hypot(f.x - ax, f.y - ay) < (f.spread || 50) + 60) cmd.turn = wrap(Math.atan2(f.y - s.y, f.x - s.x) - s.angle) > 0 ? -1 : 1;
  }
  for (const isl of islands) {
    const ax = s.x + Math.cos(s.angle) * 200;
    const ay = s.y + Math.sin(s.angle) * 200;
    if (Math.hypot(isl.x - ax, isl.y - ay) < isl.r * 1.25) cmd.turn = wrap(Math.atan2(isl.y - s.y, isl.x - s.x) - s.angle) > 0 ? -1 : 1;
  }
  return cmd;
}

function tentaclePos(tt) {
  const kr = boss.kraken;
  return { x: kr.x + Math.cos(tt.a) * 230, y: kr.y + Math.sin(tt.a) * 230 };
}
function updateKraken(dt) {
  const kr = boss.kraken;
  if (!kr) return;
  kr.t += dt;
  const dp = Math.hypot(player.x - kr.x, player.y - kr.y);
  const alive = kr.tentacles.filter((q) => q.hp > 0);
  for (const tt of kr.tentacles) {
    tt.a += dt * 0.12;
    tt.up = tt.hp > 0 && dp < 1200 ? Math.min(1, tt.up + dt) : Math.max(0, tt.up - dt);
    if (tt.hp <= 0 || tt.up < 1) continue;
    // Telegraphed slams near the player
    if (!tt.slam && Math.random() < dt * 0.35) tt.slam = { x: player.x + (Math.random() - 0.5) * 120, y: player.y + (Math.random() - 0.5) * 120, t: 1.3 };
    if (tt.slam) {
      tt.slam.t -= dt;
      if (tt.slam.t <= 0) {
        if (Math.hypot(player.x - tt.slam.x, player.y - tt.slam.y) < 90) damage(player, 42, null);
        fx.burst(tt.slam.x, tt.slam.y, { count: 30, speed: 160, life: 0.8, size: 4, color: "#dff6ff", kind: "pixel" });
        fx.spawn({ x: tt.slam.x, y: tt.slam.y, life: 0.6, size: 120, color: "#dff6ff", kind: "ring", alpha: 0.8 });
        playExplosion({ duration: 0.5, lowpass: 250 });
        tt.slam = null;
      }
    }
  }
  // With every tentacle severed the head surfaces; if it survives, they grow back
  if (alive.length === 0) {
    kr.headUp = Math.min(1, kr.headUp + dt);
    kr.headTimer = (kr.headTimer || 9) - dt;
    if (kr.headTimer <= 0) {
      kr.headTimer = 9;
      kr.headUp = 0;
      for (const tt of kr.tentacles) tt.hp = tt.maxHp * 0.7;
      toast({ title: "THE KRAKEN DIVES", body: "Its tentacles grow back!", icon: "alert" });
    }
  } else kr.headUp = Math.max(0, kr.headUp - dt);
}

// Forts track and fire at the player
function updateForts(dt) {
  for (const isl of islands) {
    if (isl.owner !== "hostile") continue;
    if (Math.abs(isl.x - player.x) > 1600 || Math.abs(isl.y - player.y) > 1600) continue;
    for (const f of isl.forts) {
      if (f.hp <= 0) continue;
      const d = Math.hypot(player.x - f.x, player.y - f.y);
      const want = Math.atan2(player.y - f.y, player.x - f.x);
      f.angle += wrap(want - f.angle) * Math.min(1, dt * 2);
      f.cd -= dt;
      if (d < 540 && f.cd <= 0 && screen === "sail") {
        f.cd = 2.8;
        const sp = 420;
        const lead = d / sp;
        const tx = player.x + Math.cos(player.angle) * player.speed * lead;
        const ty = player.y + Math.sin(player.angle) * player.speed * lead;
        const a = Math.atan2(ty - f.y, tx - f.x);
        balls.push({ x: f.x, y: f.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: Math.min(1.4, d / sp + 0.3), owner: { kind: "fort" }, dmg: 16 + isl.danger * 4 });
        fx.spawn({ x: f.x + Math.cos(a) * 22, y: f.y + Math.sin(a) * 22, life: 0.5, size: 6, grow: 16, color: "#d9d9d9", kind: "smoke", alpha: 0.7 });
      }
    }
  }
}

// ─────────────────────────── loop ───────────────────────────
const pops = [];
function popText(x, y, text, color) {
  pops.push({ x, y, text, color, life: 1.4 });
}
let taxClock = 60;
let streamClock = 0;
let saveClock = 45;
const cam = { x: player.x, y: player.y, z: 1.6 };

function update(dt) {
  clock += dt;
  save.played = clock;
  // Wind veers slowly
  if (Math.random() < dt * 0.02) wind.target = wind.dir + (Math.random() - 0.5) * 1.6;
  wind.dir += wrap(wind.target - wind.dir) * dt * 0.05;
  const storm = stormAt(player.x, player.y);
  wind.strength += ((storm ? 1.2 : 0.7) - wind.strength) * dt * 0.3;
  for (const s of storms) {
    s.x = (s.x + s.vx * dt + WORLD) % WORLD;
    s.y = (s.y + s.vy * dt + WORLD) % WORLD;
  }

  // Player command
  let turn = (down("KeyD", "ArrowRight") ? 1 : 0) - (down("KeyA", "ArrowLeft") ? 1 : 0);
  let trim = (down("KeyW", "ArrowUp") ? 1 : 0) - (down("KeyS", "ArrowDown") ? 1 : 0);
  if (mouse.down) {
    const wx = cam.x + (mouse.x - W / 2) / cam.z;
    const wy = cam.y + (mouse.y - H / 2) / cam.z;
    turn = steerTo(player, wx, wy);
    trim = 1;
  }
  if (down("Space") && !(player.boostCd > 0)) {
    player.boost = 2.4;
    player.boostCd = 10;
    sfx.powerup();
  }
  player.boostCd = Math.max(0, (player.boostCd || 0) - dt);
  if (!player.sinking) sail(player, dt, { turn, trim });
  autoFire(player, dt);

  for (let i = ships.length - 1; i >= 0; i--) {
    const s = ships[i];
    if (s === player) continue;
    if (s.sinking) {
      s.sinking += dt;
      s.speed *= 0.97;
      if (s.sinking > 2.6) ships.splice(i, 1);
      continue;
    }
    if (s.remove) {
      ships.splice(i, 1);
      continue;
    }
    // Far-away ships idle cheaply
    const far = Math.abs(s.x - player.x) > 3200 || Math.abs(s.y - player.y) > 3200;
    if (far && s.kind !== "merchant") continue;
    sail(s, dt, runAI(s, dt));
    autoFire(s, dt);
    s.hitFlash = Math.max(0, (s.hitFlash || 0) - dt);
  }
  player.hitFlash = Math.max(0, (player.hitFlash || 0) - dt);
  if (player.sinking) player.sinking += dt;

  updateForts(dt);
  updateBalls(dt);
  updateKraken(dt);

  // Floating loot and wreck salvage
  for (const f of features) {
    if (f.taken) continue;
    if ((f.kind === "crate" || f.kind === "wreck") && Math.hypot(f.x - player.x, f.y - player.y) < (f.kind === "wreck" ? 70 : 40)) {
      f.taken = true;
      const r = Math.random();
      if (f.kind === "wreck" || f.loot === "gold") {
        const g = Math.round((f.kind === "wreck" ? 120 : 30) + r * 90 + sectorOf(f.x, f.y).danger * 30);
        save.gold += g;
        popText(f.x, f.y, `+${g} G`, "#ffd24a");
      } else {
        const room = player.st.cargo - cargoCount(save.cargo);
        const c = COMMODITIES[Math.floor(r * COMMODITIES.length)];
        const n = Math.min(room, 3 + Math.floor(r * 6));
        if (n > 0) {
          save.cargo[c.id] = (save.cargo[c.id] || 0) + n;
          popText(f.x, f.y, `+${n} ${c.name}`, "#9ad0ff");
        } else popText(f.x, f.y, "HOLD FULL", "#ff9a9a");
      }
      playTone(880, 0.1, "triangle", 0.06);
    }
  }

  // Taxes from captured islands
  taxClock -= dt;
  if (taxClock <= 0) {
    taxClock = 60;
    const tax = islands.filter((i) => i.owner === "player").reduce((a, i) => a + i.tax, 0);
    save.gold += tax;
    popText(player.x, player.y - 60, `+${tax} G TAXES`, "#7cff9a");
  }
  streamClock -= dt;
  if (streamClock <= 0) {
    streamClock = 1.5;
    streamPirates();
    spawnBosses();
  }
  saveClock -= dt;
  if (saveClock <= 0) {
    saveClock = 45;
    persist();
  }

  // Ambient wildlife around the camera
  if (Math.random() < dt * 0.35) critters.push({ kind: "dolphin", x: cam.x + (Math.random() - 0.5) * W, y: cam.y + (Math.random() - 0.5) * H, a: Math.random() * TAU, t0: clock, dur: 1.2 });
  if (Math.random() < dt * 0.04) critters.push({ kind: "whale", x: cam.x + (Math.random() - 0.5) * W, y: cam.y + (Math.random() - 0.5) * H, a: Math.random() * TAU, t0: clock, dur: 7 });
  for (let i = critters.length - 1; i >= 0; i--) if (clock - critters[i].t0 > critters[i].dur) critters.splice(i, 1);
  for (let i = wakes.length - 1; i >= 0; i--) {
    wakes[i].life -= dt;
    if (wakes[i].life <= 0) wakes.splice(i, 1);
  }
  if (wakes.length > 900) wakes.splice(0, wakes.length - 900);
  for (let i = pops.length - 1; i >= 0; i--) {
    pops[i].life -= dt;
    pops[i].y -= 30 * dt;
    if (pops[i].life <= 0) pops.splice(i, 1);
  }
  fx.update(dt);

  // Camera: lead the ship, pull back a little at speed
  const lead = 0.6;
  cam.x += (player.x + Math.cos(player.angle) * player.speed * lead - cam.x) * Math.min(1, dt * 3);
  cam.y += (player.y + Math.sin(player.angle) * player.speed * lead - cam.y) * Math.min(1, dt * 3);
  // Close enough to read the ships, easing out at speed so you can see what's coming
  const zt = 1.6 - Math.min(0.3, player.speed / 700);
  cam.z += (zt - cam.z) * dt;
  setEngineHum(false);
}

// ─────────────────────────── render ───────────────────────────
function shipLook(s) {
  const t = SHIPS[Math.min(3, s.tier)];
  const look = {
    len: s.st.len || t.len,
    beam: s.st.beam || t.beam,
    masts: s.kind === "ghost" ? 3 : 1 + Math.min(2, s.tier),
    guns: Math.min(9, s.st.guns),
    sailTrim: s.trim * (0.5 + windFactor(s.angle, wind.dir) * 0.5),
    t: clock
  };
  if (s.kind === "player") return { ...look, hullColor: "#7a4a24", sail: "#f2ead7", flag: "#00bfa5", emblem: "#00bfa5" };
  if (s.kind === "pirate") return { ...look, hullColor: "#3a2a22", sail: "#2b2b30", flag: "#111111", emblem: "#e8e8e8" };
  if (s.kind === "navy") return { ...look, hullColor: "#5a3a2a", sail: "#f4f1e8", flag: "#b3202a", emblem: "#b3202a" };
  if (s.kind === "merchant") return { ...look, hullColor: "#8a6a44", sail: "#e8d9b0", flag: "#ffd24a" };
  return { ...look, hullColor: "#28404a", sail: "rgba(170,255,240,0.55)", flag: "#7fffd4", emblem: "#7fffd4" };
}

function drawShipAt(s) {
  ctx.save();
  ctx.translate(s.x, s.y);
  if (s.sinking) {
    ctx.globalAlpha = Math.max(0, 1 - s.sinking / 2.6);
    ctx.rotate(s.sinking * 0.3);
    ctx.scale(1 - s.sinking * 0.15, 1 - s.sinking * 0.15);
  }
  if (s.ghostFade) ctx.globalAlpha = 0.25;
  else if (s.kind === "ghost") ctx.globalAlpha = 0.85;
  ctx.rotate(s.angle);
  art.drawShip(ctx, shipLook(s));
  if (s.hitFlash > 0) {
    ctx.globalAlpha = s.hitFlash * 3;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(-s.st.len / 2, -s.st.beam / 2, s.st.len, s.st.beam);
  }
  ctx.restore();
  if (s.kind === "ghost") glow(ctx, s.x, s.y, 160, "#7fffd4", s.ghostFade ? 0.1 : 0.22);
  // Health bars for enemies that are hurt or hunting you
  if (s !== player && !s.sinking && (s.hp < s.maxHp || s.ai.state === "attack")) {
    const w = s.st.len;
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(s.x - w / 2, s.y - s.st.len * 0.6 - 10, w, 5);
    ctx.fillStyle = s.kind === "merchant" ? "#ffd24a" : "#ff5a5a";
    ctx.fillRect(s.x - w / 2, s.y - s.st.len * 0.6 - 10, w * (s.hp / s.maxHp), 5);
  }
}

function render() {
  const t = clock;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const sec = sectorOf(cam.x, cam.y);
  art.drawSea(ctx, cam, W, H, art.seaTileFor(sec.danger, sec.name), t);
  ctx.setTransform(cam.z, 0, 0, cam.z, W / 2 - cam.x * cam.z, H / 2 - cam.y * cam.z);
  const view = { left: cam.x - W / 2 / cam.z - 100, right: cam.x + W / 2 / cam.z + 100, top: cam.y - H / 2 / cam.z - 100, bottom: cam.y + H / 2 / cam.z + 100 };
  const inView = (x, y, m = 200) => x > view.left - m && x < view.right + m && y > view.top - m && y < view.bottom + m;
  art.drawCrests(ctx, view, t, wind.dir);

  // Wakes: foam puffs that spread into a V and fade
  for (const w of wakes) {
    if (!inView(w.x, w.y, 0)) continue;
    const k = w.life / 1.2;
    const spread = w.w * (0.6 + (1 - k) * 3.2);
    const nx = -Math.sin(w.a);
    const ny = Math.cos(w.a);
    ctx.fillStyle = `rgba(235,250,255,${k * 0.45})`;
    const r = 2 + (1 - k) * 4;
    ctx.beginPath();
    ctx.arc(w.x + nx * spread, w.y + ny * spread, r, 0, TAU);
    ctx.arc(w.x - nx * spread, w.y - ny * spread, r, 0, TAU);
    ctx.fill();
    ctx.fillStyle = `rgba(235,250,255,${k * 0.18})`;
    ctx.beginPath();
    ctx.arc(w.x, w.y, r * 1.6, 0, TAU);
    ctx.fill();
  }

  // Sea features under the ships
  const night = darkness() > 0.3;
  for (const f of features) {
    if (!inView(f.x, f.y, 260)) continue;
    if (f.kind === "reef") art.drawReef(ctx, f, t);
    else if (f.kind === "whirlpool") art.drawWhirlpool(ctx, f, t);
    else if (f.kind === "wreck") art.drawWreck(ctx, f, t, f.taken);
    else if (f.kind === "ruins") art.drawRuins(ctx, f, t);
  }
  for (const c of critters) {
    if (!inView(c.x, c.y)) continue;
    if (c.kind === "dolphin") art.drawDolphin(ctx, c, t);
    else art.drawWhale(ctx, c, t);
  }
  // Islands
  for (const isl of islands) {
    if (!inView(isl.x, isl.y, isl.r * 1.5)) continue;
    const img = islandImg(isl);
    ctx.drawImage(img.img, isl.x - img.half, isl.y - img.half);
    for (const f of isl.forts) if (f.hp > 0) art.drawFort(ctx, f.x, f.y, f.hp, f.maxHp, isl.owner, t, f.angle);
    // Harbour flag + name
    const own = isl.owner === "player";
    ctx.fillStyle = own ? "#00bfa5" : "#b3202a";
    ctx.fillRect(isl.dock.x - 1, isl.dock.y - 34, 3, 26);
    ctx.beginPath();
    ctx.moveTo(isl.dock.x + 2, isl.dock.y - 34);
    ctx.lineTo(isl.dock.x + 20 + Math.sin(t * 5) * 2, isl.dock.y - 28);
    ctx.lineTo(isl.dock.x + 2, isl.dock.y - 22);
    ctx.fill();
    ctx.font = "bold 16px 'Press Start 2P', monospace";
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillText(isl.name, isl.x + 2, isl.y - isl.r * 1.05 + 2);
    ctx.fillStyle = own ? "#b8fff0" : "#ffd0d0";
    ctx.fillText(isl.name, isl.x, isl.y - isl.r * 1.05);
  }
  for (const f of features) {
    if (!inView(f.x, f.y, 200)) continue;
    if (f.kind === "rocks") art.drawRocks(ctx, f, t);
    else if (f.kind === "stack") art.drawStack(ctx, f, t);
    else if (f.kind === "lighthouse") art.drawLighthouse(ctx, f, t, night);
    else if (f.kind === "buoy") art.drawBuoy(ctx, f, t);
    else if (f.kind === "crate" && !f.taken) art.drawCrate(ctx, f, t);
  }

  // Kraken
  const kr = boss.kraken;
  if (kr && inView(kr.x, kr.y, 400)) {
    const g = ctx.createRadialGradient(kr.x, kr.y, 20, kr.x, kr.y, 260);
    g.addColorStop(0, "rgba(40,10,50,0.75)");
    g.addColorStop(1, "rgba(40,10,50,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(kr.x, kr.y, 260, 0, TAU);
    ctx.fill();
    if (kr.headUp > 0) {
      ctx.globalAlpha = kr.headUp;
      ctx.fillStyle = "#5a2266";
      ctx.beginPath();
      ctx.ellipse(kr.x, kr.y, 90, 70, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = "#ffe066";
      ctx.beginPath();
      ctx.arc(kr.x - 30, kr.y - 10, 10, 0, TAU);
      ctx.arc(kr.x + 30, kr.y - 10, 10, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    for (const tt of kr.tentacles) {
      if (tt.slam) {
        const k = 1 - tt.slam.t / 1.3;
        ctx.strokeStyle = `rgba(255,60,60,${0.4 + k * 0.5})`;
        ctx.lineWidth = 3;
        ctx.setLineDash([10, 8]);
        ctx.beginPath();
        ctx.arc(tt.slam.x, tt.slam.y, 90, 0, TAU);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = `rgba(255,40,40,${k * 0.25})`;
        ctx.fill();
      }
      if (tt.hp <= 0 || tt.up <= 0) continue;
      const p = tentaclePos(tt);
      ctx.globalAlpha = tt.up;
      ctx.strokeStyle = "#6b2a7a";
      ctx.lineCap = "round";
      ctx.lineWidth = 26;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      const wig = Math.sin(t * 3 + tt.a * 4) * 30;
      ctx.quadraticCurveTo(p.x + wig, p.y - 60, p.x + wig * 1.5, p.y - 110);
      ctx.stroke();
      ctx.strokeStyle = "#c77dff";
      ctx.lineWidth = 6;
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.fillStyle = "rgba(0,0,0,0.6)";
      ctx.fillRect(p.x - 25, p.y + 22, 50, 5);
      ctx.fillStyle = "#c77dff";
      ctx.fillRect(p.x - 25, p.y + 22, 50 * (tt.hp / tt.maxHp), 5);
    }
  }

  for (const s of ships) if (inView(s.x, s.y)) drawShipAt(s);
  // Cannonballs
  for (const b of balls) {
    if (!inView(b.x, b.y, 0)) continue;
    ctx.fillStyle = b.spectral ? "#7fffd4" : "#15171c";
    ctx.beginPath();
    ctx.arc(b.x, b.y, 4, 0, TAU);
    ctx.fill();
    if (b.spectral) glow(ctx, b.x, b.y, 12, "#7fffd4", 0.6);
  }
  fx.draw(ctx);
  ctx.font = "bold 14px 'Press Start 2P', monospace";
  ctx.textAlign = "center";
  for (const p of pops) {
    ctx.globalAlpha = Math.min(1, p.life);
    ctx.fillStyle = "#000";
    ctx.fillText(p.text, p.x + 2, p.y + 2);
    ctx.fillStyle = p.color;
    ctx.fillText(p.text, p.x, p.y);
  }
  ctx.globalAlpha = 1;

  // Screen space: storms, night, fog, vignette, HUD
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const storm = stormAt(player.x, player.y);
  if (storm) {
    const k = 1 - Math.hypot(storm.x - player.x, storm.y - player.y) / storm.r;
    ctx.fillStyle = `rgba(20,30,40,${0.35 * k})`;
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = `rgba(200,220,240,${0.35 * k})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let k2 = 0; k2 < 160; k2++) {
      const x = (k2 * 97 + t * 900) % W;
      const y = (k2 * 57 + t * 1300) % H;
      ctx.moveTo(x, y);
      ctx.lineTo(x - 8, y + 22);
    }
    ctx.stroke();
    if (Math.random() < 0.004) {
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.fillRect(0, 0, W, H);
      playTone(50, 0.6, "sawtooth", 0.05);
    }
  }
  if (sec.name === "Devil's Shroud") {
    ctx.fillStyle = "rgba(180,200,200,0.22)";
    ctx.fillRect(0, 0, W, H);
  }
  const dk = darkness();
  if (dk > 0.02) {
    light.begin("#02101c", dk);
    const toScreen = (x, y) => [(x - cam.x) * cam.z + W / 2, (y - cam.y) * cam.z + H / 2];
    const [px, py] = toScreen(player.x, player.y);
    light.light(px, py, 260 * cam.z, 1);
    for (const s of ships) {
      if (s === player || !inView(s.x, s.y)) continue;
      const [sx, sy] = toScreen(s.x, s.y);
      light.light(sx, sy, 110 * cam.z, 0.8);
    }
    for (const isl of islands) {
      if (!inView(isl.x, isl.y, isl.r)) continue;
      const [ix, iy] = toScreen(isl.dock.x, isl.dock.y);
      light.light(ix, iy, 240 * cam.z, 0.7);
    }
    for (const f of features) {
      if (f.kind !== "lighthouse" || !inView(f.x, f.y, 400)) continue;
      const [lx, ly] = toScreen(f.x, f.y);
      light.light(lx, ly, 380 * cam.z, 0.9);
    }
    light.draw(ctx);
  }
  vignette(ctx, W, H, 0.4);
  drawHud(t, sec);
}

function drawMinimap(x0, y0, size) {
  ctx.fillStyle = "rgba(4,16,24,0.82)";
  ctx.fillRect(x0, y0, size, size);
  ctx.strokeStyle = "rgba(0,191,165,0.6)";
  ctx.lineWidth = 2;
  ctx.strokeRect(x0, y0, size, size);
  const s = size / WORLD;
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 1;
  for (let k = 1; k < 3; k++) {
    ctx.beginPath();
    ctx.moveTo(x0 + (k * size) / 3, y0);
    ctx.lineTo(x0 + (k * size) / 3, y0 + size);
    ctx.moveTo(x0, y0 + (k * size) / 3);
    ctx.lineTo(x0 + size, y0 + (k * size) / 3);
    ctx.stroke();
  }
  for (const isl of islands) {
    ctx.fillStyle = isl.owner === "player" ? "#00bfa5" : "#d0a060";
    ctx.beginPath();
    ctx.arc(x0 + isl.x * s, y0 + isl.y * s, Math.max(2.5, isl.r * s * 1.2), 0, TAU);
    ctx.fill();
  }
  for (const b of world.bosses) {
    if (save.bosses.includes(b.id)) continue;
    ctx.fillStyle = "#c77dff";
    ctx.font = "10px monospace";
    ctx.fillText("☠", x0 + b.x * s - 4, y0 + b.y * s + 4);
  }
  for (const sh of ships) {
    if (sh.kind !== "pirate" && sh.kind !== "navy" && sh.kind !== "ghost") continue;
    if (Math.hypot(sh.x - player.x, sh.y - player.y) > 2600) continue;
    ctx.fillStyle = "#ff4d4d";
    ctx.fillRect(x0 + sh.x * s - 1.5, y0 + sh.y * s - 1.5, 3, 3);
  }
  ctx.save();
  ctx.translate(x0 + player.x * s, y0 + player.y * s);
  ctx.rotate(player.angle);
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.moveTo(6, 0);
  ctx.lineTo(-4, -4);
  ctx.lineTo(-4, 4);
  ctx.fill();
  ctx.restore();
}

function drawHud(t, sec) {
  const F = "'Press Start 2P', monospace";
  const B = "'VT323', monospace";
  const st = player.st;
  // Status panel
  ctx.fillStyle = "rgba(4,16,24,0.82)";
  ctx.fillRect(16, 16, 360, 124);
  ctx.strokeStyle = "rgba(0,191,165,0.5)";
  ctx.strokeRect(16.5, 16.5, 359, 123);
  ctx.textAlign = "left";
  ctx.font = `10px ${F}`;
  ctx.fillStyle = "#00bfa5";
  ctx.fillText(st.name.toUpperCase(), 30, 38);
  ctx.fillStyle = "rgba(255,255,255,0.1)";
  ctx.fillRect(30, 48, 330, 12);
  const hk = Math.max(0, player.hp / player.maxHp);
  ctx.fillStyle = hk > 0.5 ? "#2ee68a" : hk > 0.25 ? "#ffd24a" : "#ff4d4d";
  ctx.fillRect(30, 48, 330 * hk, 12);
  ctx.font = `20px ${B}`;
  ctx.fillStyle = "#e8fbf7";
  ctx.fillText(`HULL ${Math.ceil(player.hp)} / ${player.maxHp}`, 30, 80);
  ctx.fillStyle = "#ffd24a";
  ctx.fillText(`${save.gold} G`, 250, 80);
  ctx.fillStyle = "#9ad0ff";
  ctx.fillText(`CARGO ${cargoCount(save.cargo)} / ${st.cargo}`, 30, 104);
  ctx.fillStyle = "#b8fff0";
  ctx.fillText(`ISLANDS ${save.captured.length} / ${islands.length}  ☠ ${save.bosses.length}/2`, 30, 128);

  // Sector banner
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(4,16,24,0.72)";
  ctx.fillRect(W / 2 - 220, 16, 440, 40);
  ctx.font = `11px ${F}`;
  ctx.fillStyle = "#e8fbf7";
  ctx.fillText(sec.name.toUpperCase(), W / 2, 36);
  ctx.font = `16px ${B}`;
  ctx.fillStyle = ["#7cff9a", "#b8ff7a", "#ffd24a", "#ff9a4a", "#ff4d4d"][sec.danger];
  ctx.fillText(`DANGER ${"●".repeat(sec.danger + 1)}${"○".repeat(4 - sec.danger)}`, W / 2, 52);

  drawMinimap(W - 216, 16, 200);

  // Wind compass + sail trim
  const cx = 90;
  const cy = H - 90;
  ctx.fillStyle = "rgba(4,16,24,0.82)";
  ctx.beginPath();
  ctx.arc(cx, cy, 66, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = "rgba(0,191,165,0.5)";
  ctx.stroke();
  ctx.font = `9px ${F}`;
  ctx.fillStyle = "#8fb8b0";
  ctx.fillText("N", cx, cy - 50);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(wind.dir);
  ctx.fillStyle = "#9ad0ff";
  ctx.beginPath();
  ctx.moveTo(40, 0);
  ctx.lineTo(10, -10);
  ctx.lineTo(10, 10);
  ctx.fill();
  ctx.fillRect(-36, -3, 48, 6);
  ctx.restore();
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(player.angle);
  ctx.fillStyle = "#f2ead7";
  ctx.beginPath();
  ctx.moveTo(22, 0);
  ctx.lineTo(-12, -8);
  ctx.lineTo(-12, 8);
  ctx.fill();
  ctx.restore();
  const wf = windFactor(player.angle, wind.dir);
  ctx.font = `16px ${B}`;
  ctx.fillStyle = "#e8fbf7";
  ctx.fillText(`${Math.round(player.speed / 10)} KN`, cx, cy + 90);
  // Sail and boost bars
  ctx.textAlign = "left";
  ctx.fillStyle = "rgba(4,16,24,0.82)";
  ctx.fillRect(170, H - 92, 250, 70);
  ctx.font = `8px ${F}`;
  ctx.fillStyle = "#8fb8b0";
  ctx.fillText("SAILS (W/S)", 184, H - 72);
  ctx.fillText("ALL HANDS (SPACE)", 184, H - 42);
  ctx.fillStyle = "rgba(255,255,255,0.1)";
  ctx.fillRect(184, H - 66, 220, 8);
  ctx.fillRect(184, H - 36, 220, 8);
  ctx.fillStyle = wf > 0.8 ? "#2ee68a" : wf > 0.55 ? "#ffd24a" : "#ff9a4a";
  ctx.fillRect(184, H - 66, 220 * player.trim, 8);
  ctx.fillStyle = player.boostCd > 0 ? "#6a7a78" : "#9ad0ff";
  ctx.fillRect(184, H - 36, 220 * (1 - (player.boostCd || 0) / 10), 8);

  // Prompts
  const dock = dockable();
  ctx.textAlign = "center";
  if (dock) {
    ctx.font = `12px ${F}`;
    ctx.fillStyle = "rgba(4,16,24,0.82)";
    ctx.fillRect(W / 2 - 230, H - 70, 460, 40);
    ctx.fillStyle = "#b8fff0";
    ctx.fillText(`[E] DOCK AT ${dock.name.toUpperCase()}`, W / 2, H - 44);
  } else {
    const near = islands.find((i) => i.owner === "hostile" && Math.hypot(i.x - player.x, i.y - player.y) < i.r + 700);
    if (near) {
      const left = near.forts.filter((f) => f.hp > 0).length;
      ctx.font = `11px ${F}`;
      ctx.fillStyle = "rgba(40,6,10,0.8)";
      ctx.fillRect(W / 2 - 260, H - 70, 520, 40);
      ctx.fillStyle = "#ffb0b0";
      ctx.fillText(`${near.name.toUpperCase()}: ${left} FORT${left === 1 ? "" : "S"} LEFT TO CAPTURE`, W / 2, H - 44);
    }
  }
  ctx.font = `8px ${F}`;
  ctx.fillStyle = "rgba(200,240,235,0.6)";
  ctx.textAlign = "right";
  ctx.fillText("M CHART • E DOCK • ESC PAUSE", W - 18, H - 14);
}

// ─────────────────────────── modals ───────────────────────────
const modal = document.getElementById("is-modal");
function showModal(html, wide = false) {
  modal.hidden = false;
  modal.innerHTML = `<div class="is-panel ${wide ? "is-panel--wide" : ""}">${html}</div>`;
  modal.querySelector("button")?.focus();
}
function closeModal() {
  modal.hidden = true;
  modal.innerHTML = "";
  if (screen === "dead") return;
  screen = "sail";
  canvas.focus({ preventScroll: true });
}
function openPause() {
  screen = "paused";
  showModal(`
    <h2 class="is-title">PAUSED</h2>
    <p class="is-note">${escapeHtml(sectorOf(player.x, player.y).name)} • ${save.gold} G • ${save.captured.length}/${islands.length} islands</p>
    <div class="is-col">
      <button type="button" class="btn btn--primary" data-act="close">RESUME</button>
      <button type="button" class="btn" data-act="chart">SEA CHART</button>
      <button type="button" class="btn" data-act="reset">NEW VOYAGE (RESET SAVE)</button>
    </div>`);
}

let portIsland = null;
let portTab = "market";
function openPort(isl) {
  portIsland = isl;
  screen = "port";
  player.speed = 0;
  persist();
  sfx.good();
  renderPort();
}
function renderPort() {
  const isl = portIsland;
  const epoch = Math.floor(clock / 120);
  const st = player.st;
  const used = cargoCount(save.cargo);
  let body = "";
  if (portTab === "market") {
    body = `<table class="is-market"><thead><tr><th>GOOD</th><th>BUY</th><th>SELL</th><th>HOLD</th><th></th></tr></thead><tbody>${COMMODITIES.map((c) => {
      const buy = priceAt(world, isl, c.id, epoch);
      const tag = isl.produces.includes(c.id) ? `<em class="cheap">LOCAL</em>` : isl.demands.includes(c.id) ? `<em class="dear">WANTED</em>` : "";
      const have = save.cargo[c.id] || 0;
      return `<tr><td>${c.name} ${tag}</td><td>${buy} G</td><td>${sellPrice(buy)} G</td><td>${have}</td><td class="is-trade">
        <button type="button" class="btn btn--sm" data-buy="${c.id}" ${save.gold < buy || used >= st.cargo ? "disabled" : ""}>BUY 1</button>
        <button type="button" class="btn btn--sm" data-buy5="${c.id}" ${save.gold < buy * 5 || used + 5 > st.cargo ? "disabled" : ""}>×5</button>
        <button type="button" class="btn btn--sm" data-sell="${c.id}" ${have ? "" : "disabled"}>SELL ALL</button></td></tr>`;
    }).join("")}</tbody></table>
    <p class="is-note">Prices shift every two minutes. Buy what an island makes, sell where it's WANTED.</p>`;
  } else {
    const repair = Math.ceil((player.maxHp - player.hp) * 1.2);
    const next = SHIPS[save.tier + 1];
    body = `<div class="is-yard">
      <div class="is-card"><b>REPAIRS</b><p>${Math.ceil(player.hp)} / ${player.maxHp} hull</p><button type="button" class="btn btn--sm" data-act="repair" ${repair && save.gold >= repair ? "" : "disabled"}>REPAIR — ${repair} G</button></div>
      <div class="is-card"><b>NEW SHIP</b>${next ? `<p>${next.name}: ${next.hull} hull, ${next.guns} guns a side, ${next.cargo} cargo</p><button type="button" class="btn btn--sm" data-act="ship" ${save.gold >= next.price ? "" : "disabled"}>BUY — ${next.price} G</button>` : "<p>You command the finest ship afloat.</p>"}</div>
      ${UPGRADES.map((u) => {
        const lvl = save.upgrades[u.id] || 0;
        const cost = upgradeCost(u, lvl);
        return `<div class="is-card"><b>${u.name.toUpperCase()} ${"■".repeat(lvl)}${"□".repeat(MAX_UPGRADE - lvl)}</b><p>${u.desc}</p><button type="button" class="btn btn--sm" data-up="${u.id}" ${lvl < MAX_UPGRADE && save.gold >= cost ? "" : "disabled"}>${lvl < MAX_UPGRADE ? `UPGRADE — ${cost} G` : "MAXED"}</button></div>`;
      }).join("")}
    </div>`;
  }
  showModal(
    `<header class="is-port-head"><div><p class="is-kicker">${escapeHtml(sectorOf(isl.x, isl.y).name.toUpperCase())} • TAX ${isl.tax} G/MIN</p><h2 class="is-title">${escapeHtml(isl.name.toUpperCase())}</h2></div>
     <div class="is-purse">${save.gold} G • HOLD ${used}/${st.cargo}</div></header>
     <nav class="is-tabs"><button type="button" class="btn btn--sm ${portTab === "market" ? "btn--primary" : ""}" data-tab="market">MARKET</button><button type="button" class="btn btn--sm ${portTab === "yard" ? "btn--primary" : ""}" data-tab="yard">SHIPYARD</button><button type="button" class="btn btn--sm" data-act="close">SET SAIL [E]</button></nav>
     ${body}`,
    true
  );
}

function openChart() {
  screen = "chart";
  showModal(`<h2 class="is-title">SEA CHART</h2><canvas id="is-chart" width="760" height="760" class="is-chart"></canvas><p class="is-note">Teal: your ports. Sand: hostile islands. ☠: legends. M or Esc to close.</p>`, true);
  const c = document.getElementById("is-chart");
  const g = c.getContext("2d");
  const s = 760 / WORLD;
  g.fillStyle = "#0b3148";
  g.fillRect(0, 0, 760, 760);
  g.strokeStyle = "rgba(255,255,255,0.12)";
  g.font = "bold 11px monospace";
  g.fillStyle = "rgba(200,240,235,0.45)";
  for (let r = 0; r < 3; r++)
    for (let col = 0; col < 3; col++) {
      g.strokeRect(col * 253, r * 253, 253, 253);
      g.fillText(sectorOf((col + 0.5) * (WORLD / 3), (r + 0.5) * (WORLD / 3)).name.toUpperCase(), col * 253 + 8, r * 253 + 18);
    }
  for (const f of world.features) {
    if (f.kind === "rocks" || f.kind === "stack") {
      g.fillStyle = "rgba(160,170,180,0.6)";
      g.fillRect(f.x * s - 1, f.y * s - 1, 3, 3);
    } else if (f.kind === "whirlpool") {
      g.strokeStyle = "rgba(220,245,255,0.6)";
      g.beginPath();
      g.arc(f.x * s, f.y * s, 5, 0, TAU);
      g.stroke();
    }
  }
  for (const isl of islands) {
    g.fillStyle = isl.owner === "player" ? "#00bfa5" : "#d0a060";
    g.beginPath();
    g.arc(isl.x * s, isl.y * s, Math.max(4, isl.r * s * 1.1), 0, TAU);
    g.fill();
    g.fillStyle = "#e8fbf7";
    g.font = "10px monospace";
    g.fillText(isl.name, isl.x * s + 8, isl.y * s + 4);
  }
  for (const b of world.bosses) {
    if (save.bosses.includes(b.id)) continue;
    g.fillStyle = "#c77dff";
    g.font = "18px monospace";
    g.fillText("☠", b.x * s - 8, b.y * s + 6);
  }
  g.save();
  g.translate(player.x * s, player.y * s);
  g.rotate(player.angle);
  g.fillStyle = "#ffffff";
  g.beginPath();
  g.moveTo(9, 0);
  g.lineTo(-6, -6);
  g.lineTo(-6, 6);
  g.fill();
  g.restore();
}

modal.addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  sfx.click();
  const epoch = Math.floor(clock / 120);
  const isl = portIsland;
  if (b.dataset.tab) {
    portTab = b.dataset.tab;
    return renderPort();
  }
  if (b.dataset.buy || b.dataset.buy5) {
    const id = b.dataset.buy || b.dataset.buy5;
    const n = b.dataset.buy5 ? 5 : 1;
    const price = priceAt(world, isl, id, epoch) * n;
    if (save.gold >= price && cargoCount(save.cargo) + n <= player.st.cargo) {
      save.gold -= price;
      save.cargo[id] = (save.cargo[id] || 0) + n;
      sfx.coin();
    }
    return renderPort();
  }
  if (b.dataset.sell) {
    const id = b.dataset.sell;
    const n = save.cargo[id] || 0;
    save.gold += sellPrice(priceAt(world, isl, id, epoch)) * n;
    delete save.cargo[id];
    sfx.coin();
    saveGameScore("ironsail-gold", save.gold, `${save.gold} G`);
    return renderPort();
  }
  if (b.dataset.up) {
    const u = UPGRADES.find((q) => q.id === b.dataset.up);
    const lvl = save.upgrades[u.id] || 0;
    const cost = upgradeCost(u, lvl);
    if (lvl < MAX_UPGRADE && save.gold >= cost) {
      save.gold -= cost;
      save.upgrades[u.id] = lvl + 1;
      refitPlayer();
      sfx.powerup();
    }
    return renderPort();
  }
  const act = b.dataset.act;
  if (act === "repair") {
    const cost = Math.ceil((player.maxHp - player.hp) * 1.2);
    if (save.gold >= cost) {
      save.gold -= cost;
      player.hp = player.maxHp;
    }
    return renderPort();
  }
  if (act === "ship") {
    const next = SHIPS[save.tier + 1];
    if (next && save.gold >= next.price) {
      save.gold -= next.price;
      save.tier++;
      refitPlayer(true);
      sfx.fanfare();
      toast({ title: "NEW FLAGSHIP", body: next.name, icon: "trophy" });
    }
    return renderPort();
  }
  if (act === "close") return closeModal();
  if (act === "chart") return openChart();
  if (act === "respawn") {
    screen = "sail";
    return respawn();
  }
  if (act === "reset") {
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch {}
    location.reload();
  }
  persist();
});

function refitPlayer(full = false) {
  const hpK = player.hp / player.maxHp;
  player.tier = save.tier;
  player.st = shipStats(save.tier, save.upgrades);
  player.maxHp = player.st.maxHull;
  player.hp = full ? player.maxHp : Math.max(1, player.maxHp * hpK);
  persist();
}

// ─────────────────────────── boot ───────────────────────────
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (screen === "sail") update(dt);
  else fx.update(dt * 0.2);
  render();
  requestAnimationFrame(frame);
}
document.addEventListener("visibilitychange", () => {
  if (document.hidden && screen === "sail") openPause();
});

screen = "intro";
showModal(`
  <p class="is-kicker">A 14 KM ARCHIPELAGO • 30 ISLANDS • 2 LEGENDS</p>
  <h2 class="is-title is-good">IRON<span>SAIL</span></h2>
  <p class="is-note">Trade between ports, sink pirate raiders (they sail alone or in packs), storm island forts to capture them, and hunt the Ghost Ship and the Kraken.</p>
  <ul class="is-help">
    <li><b>A / D</b> steer • <b>W / S</b> raise and lower sails • <b>SPACE</b> all hands (burst of speed)</li>
    <li>Or hold the mouse to sail toward the cursor • cannons fire broadsides automatically</li>
    <li>Sailing with the wind on your beam is fastest; straight into it is slow</li>
    <li><b>E</b> dock at your ports • <b>M</b> sea chart • <b>ESC</b> pause</li>
  </ul>
  <div class="is-row"><button type="button" class="btn btn--primary" data-act="close">${save.played > 5 ? "CONTINUE VOYAGE" : "SET SAIL"}</button></div>`);
requestAnimationFrame(frame);

// Debug/test hook (used by automated verification scripts).
window.__ironsail = {
  player,
  get ships() {
    return ships;
  },
  get islands() {
    return islands;
  },
  get boss() {
    return boss;
  },
  save: () => save,
  world,
  get screen() {
    return screen;
  },
  closeModal,
  keys
};
