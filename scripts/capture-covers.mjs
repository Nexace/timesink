// Captures a gameplay cover for every game on the home page.
//
//   npm run dev            (in another terminal)
//   node scripts/capture-covers.mjs [slug ...]
//
// Each game is loaded in Brave, staged into an interesting moment (debug hooks where a game has
// them, ordinary clicks and key presses otherwise), then a 20:9 region of its main view is cropped
// and written to assets/covers/<slug>.webp at 800×360.
import puppeteer from "puppeteer-core";
import fs from "node:fs";
import path from "node:path";

const BRAVE_PATH = "C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe";
const BASE_URL = "http://localhost:5173";
const OUT_DIR = path.resolve("assets/covers");
const OUT_W = 800;
const OUT_H = 360;

// Page-side helpers available to every stage script
const PRELUDE = `
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const key = async (code, ms = 80, down = true) => {
    const k = code.replace(/^Key/, "").toLowerCase();
    // Dispatched on document only: it bubbles to window, so listeners on either see it once
    document.dispatchEvent(new KeyboardEvent("keydown", { code, key: code === "Space" ? " " : k, bubbles: true }));
    if (!down) return;
    await sleep(ms);
    document.dispatchEvent(new KeyboardEvent("keyup", { code, key: code === "Space" ? " " : k, bubbles: true }));
  };
  const hold = (code) => document.dispatchEvent(new KeyboardEvent("keydown", { code, bubbles: true }));
  const release = (code) => document.dispatchEvent(new KeyboardEvent("keyup", { code, bubbles: true }));
  const clickText = (text) => { const b = [...document.querySelectorAll("button")].find((el) => el.textContent.trim().startsWith(text)); if (b) b.click(); return !!b; };
  const click = (sel) => { const el = typeof sel === "string" ? document.querySelector(sel) : sel; if (el) el.click(); return !!el; };
  const clickAt = (sel, fx = 0.5, fy = 0.5) => {
    const el = document.querySelector(sel);
    if (!el) return;
    const r = el.getBoundingClientRect();
    const o = { clientX: r.left + r.width * fx, clientY: r.top + r.height * fy, bubbles: true, button: 0 };
    el.dispatchEvent(new PointerEvent("pointerdown", o));
    el.dispatchEvent(new MouseEvent("mousedown", o));
    el.dispatchEvent(new PointerEvent("pointerup", o));
    el.dispatchEvent(new MouseEvent("mouseup", o));
    el.dispatchEvent(new MouseEvent("click", o));
  };
  const type = async (sel, text) => {
    const el = document.querySelector(sel);
    if (!el) return;
    el.focus();
    for (const ch of text) {
      el.value += ch;
      el.dispatchEvent(new Event("input", { bubbles: true }));
      await sleep(10);
    }
  };
`;

// sel: element to crop from. focus: [fx, fy] centre of the crop within it. zoom: crop width as a
// fraction of the element width (<1 zooms in). hide: overlays to hide before the shot.
export const COVERS = {
  "mars-base": { sel: "#world", zoom: 0.62, focus: [0.5, 0.36], hide: ["#hud", ".mb-toast", ".toast-stack"], stage: `
    await sleep(1500);
    window.__marsBase.newCampaign();
    await sleep(1500);
    clickText("Let's science this");
    await sleep(400);
    window.__marsBase.pump(600, 50);
    await sleep(1200);
  ` },
  "ground-zero": { sel: "#map", zoom: 1, focus: [0.5, 0.5], stage: `
    await sleep(2500);
    clickAt("#map", 0.5, 0.5);
    await sleep(300);
    click("#btn-detonate");
    await sleep(4500);
  ` },
  "diet-game": { sel: ".pixel-dining-scene", zoom: 1, focus: [0.5, 0.5], stage: `
    await sleep(1500);
    await type("#meal-input", "2 fried eggs 180 cal, 1 avocado toast 320 cal, 1 banana 105 cal, 1 grilled salmon 360 cal, 1 cup broccoli 55 cal, 1 slice pizza 285 cal");
    await sleep(1500);
  ` },
  "ping-age": { sel: "main", zoom: 0.62, focus: [0.36, 0.2], stage: `await sleep(2500);` },
  rootkit: { sel: ".rk-container", zoom: 1, focus: [0.5, 0.3], stage: `
    await sleep(1500);
    for (const cmd of ["help", "scan", "ls"]) {
      await type("#cmd-input", cmd);
      document.querySelector("#cmd-input")?.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", code: "Enter", bubbles: true }));
      await sleep(700);
    }
  ` },
  "ghost-lap": { sel: "#race-canvas", zoom: 0.7, focus: [0.52, 0.5], stage: `
    await sleep(800);
    window.__ghostLap.startRace({ mode: "gp", track: "monaco", laps: 5, difficulty: "hard" });
    window.__ghostLap.autopilot = true;
    await sleep(15500);
  ` },
  redlight: { sel: ".rl-strip-panel", zoom: 0.62, focus: [0.5, 0.36], stage: `
    await sleep(1500);
    await key("Space");
    await sleep(500);
    await key("Space");
    // Catch the tree mid-countdown with the ambers burning
    for (let k = 0; k < 120; k++) { await sleep(40); if (document.querySelectorAll("#tree .lit, .lamp.lit").length >= 7) break; }
  ` },
  "resume-game": { sel: "main", zoom: 1, focus: [0.5, 0.3], stage: `await sleep(1500); click("#btn-sample"); await sleep(1500);` },
  ironsail: { sel: "#is-canvas", zoom: 0.8, focus: [0.5, 0.5], stage: `
    await sleep(2000);
    const I = window.__ironsail;
    I.closeModal?.();
    // Sail past a port island so the cover shows coast, town and shipping, not open water
    const isl = I.islands[2];
    I.player.x = isl.x - isl.r - 260;
    I.player.y = isl.y + 60;
    I.player.angle = 0;
    await sleep(300);
    hold("KeyW");
    await sleep(3200);
    release("KeyW");
    await sleep(400);
  ` },
  "ace-vector": { sel: "#av-canvas", zoom: 0.55, focus: [0.66, 0.6], stage: `await sleep(1500); click("#btn-hangar-launch"); await sleep(1000); hold("KeyW"); hold("Space"); await sleep(2500); hold("KeyA"); await sleep(700); release("KeyA"); await sleep(1500); release("KeyW"); release("Space");` },
  swarmline: { sel: "#sl-canvas", zoom: 0.8, focus: [0.5, 0.5], stage: `
    await sleep(2000);
    await key("Space");
    // Kite in a slow square so the horde builds up around the player
    for (const k of ["KeyD", "KeyS", "KeyA", "KeyW", "KeyD", "KeyS", "KeyA", "KeyW"]) {
      hold(k);
      for (let t = 0; t < 13; t++) { await sleep(200); document.querySelector("#cards-container .upgrade-card")?.click(); }
      release(k);
    }
    document.querySelector("#cards-container .upgrade-card")?.click();
    await sleep(300);
  ` },
  "last-tower": { sel: "#lt-canvas", zoom: 1, focus: [0.5, 0.5], stage: `
    await sleep(2000);
    // Towers well down the lane so the wave is mid-fight, not already wiped out, at shot time
    const towers = ["gatling", "tesla", "gatling"];
    const spots = [[0.5, 0.42], [0.62, 0.6], [0.74, 0.42]];
    for (let k = 0; k < spots.length; k++) {
      click('[data-tower="' + towers[k] + '"]');
      await sleep(80);
      clickAt("#lt-canvas", spots[k][0], spots[k][1]);
      await sleep(120);
    }
    click("#btn-call-wave");
    await sleep(9500);
  ` },
  "ore-runner": { sel: "#or-canvas", zoom: 0.8, focus: [0.5, 0.5], stage: `
    await sleep(2500);
    await key("Space");
    await sleep(300);
    const O = window.__oreRunner;
    const st = O.stations[0];
    if (st) { O.player.x = st.x + 230; O.player.y = st.y + 150; O.player.vx = O.player.vy = 0; O.player.angle = -2.4; }
    await sleep(1800);
  ` },
  skydoodle: { sel: "#sd-canvas", zoom: 1, focus: [0.5, 0.5], stage: `await sleep(2000); await key("Space"); await sleep(2500);` },
  gridlock: { sel: ".sudoku-grid-wrapper", zoom: 1, focus: [0.5, 0.5], stage: `await sleep(2000);` },
  "teraform-run": { sel: "#game-canvas", zoom: 0.62, focus: [0.36, 0.6], stage: `
    await sleep(1500);
    await key("Space");
    await sleep(400);
    window.__teraform?.warp(2, true);
    await sleep(3200);
    await key("Space");
    await sleep(220);
  ` },
  headbutt: { sel: "#hb-canvas", zoom: 0.9, focus: [0.5, 0.55], stage: `
    await sleep(1500);
    const H = window.__headbutt;
    H.prefs.arena = "volcano";
    H.prefs.car = "monster";
    H.startMatch();
    await sleep(4200);
  ` },
  ironclad: { sel: "#ic-canvas", zoom: 0.8, focus: [0.42, 0.62], hide: [".ic-jump-bar", "#boss-banner"], stage: `
    await sleep(1500);
    const ic = window.ironclad;
    const b = ic.getBattle();
    const put = (f, id, what) => { const s = f.slots.find((x) => x.id === id); if (s) { s.underConstruction = { buildingId: what }; ic.completeBuilding(f, id, what); } };
    [["bow_1", "shipTurret"], ["deck_1", "artillery"], ["deck_2", "shieldGenerator"], ["deck_3", "railgun"], ["deck_4", "navalFactory"], ["deck_5", "airFactory"], ["deck_6", "artillery"],
     ["mast_1", "samSite"], ["mast_2", "antiAirTurret"], ["platform_1", "teslaCoil"], ["platform_2", "mortar"], ["util_1", "droneStation"], ["util_2", "droneStation"], ["util_3", "droneStation"]].forEach(([s, w]) => put(b.player, s, w));
    [["deck_2", "artillery"], ["deck_3", "shieldGenerator"], ["deck_5", "navalFactory"], ["mast_1", "antiAirTurret"], ["platform_1", "shipTurret"], ["util_1", "droneStation"]].forEach(([s, w]) => put(b.enemy, s, w));
    b.player.hull = b.enemy.hull = 99999;
    b.player.maxHull = b.enemy.maxHull = 99999;
    for (const [id, x, y] of [["destroyer", 1150, 520], ["frigate", 1300, 520], ["gunship", 1250, 400], ["bomber", 1100, 330], ["fighter", 1000, 300]]) ic.spawnUnit(id, false, x, y);
    for (const [id, x, y] of [["frigate", 1650, 520], ["attackBoat", 1550, 520], ["steamCopter", 1500, 410], ["fighter", 1700, 280]]) ic.spawnUnit(id, true, x, y);
    ic.setTarget(b.enemy.slots.find((s) => s.id === "deck_2"));
    ic.camera.tz = ic.camera.zoom = 1.35;
    ic.jumpCameraTo(760, true);
    await sleep(3200);
  ` }
};

async function capture(browser, slug, cfg) {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewport({ width: 1600, height: 1000, deviceScaleFactor: 2 });
  await page.evaluateOnNewDocument(() => {
    try {
      localStorage.clear();
    } catch {}
  });
  await page.goto(`${BASE_URL}/games/${slug}/`, { waitUntil: "networkidle2", timeout: 60000 });
  await page.evaluate(`(async () => { ${PRELUDE} ${cfg.stage} })()`);
  const rect = await page.evaluate(
    (sel, hide) => {
      for (const h of hide || []) document.querySelectorAll(h).forEach((el) => (el.style.visibility = "hidden"));
      document.querySelectorAll(".toast, .toast-stack, [data-toast]").forEach((el) => (el.style.visibility = "hidden"));
      const el = document.querySelector(sel);
      if (!el) return null;
      el.scrollIntoView({ block: "center" });
      const r = el.getBoundingClientRect();
      return { x: r.left + window.scrollX, y: r.top + window.scrollY, w: r.width, h: r.height };
    },
    cfg.sel,
    cfg.hide
  );
  if (!rect) throw new Error(`${slug}: selector ${cfg.sel} not found`);
  // 20:9 crop around the focus point
  const aspect = OUT_W / OUT_H;
  let w = rect.w * (cfg.zoom ?? 1);
  let h = w / aspect;
  if (h > rect.h) {
    h = rect.h;
    w = h * aspect;
  }
  const cx = rect.x + rect.w * cfg.focus[0];
  const cy = rect.y + rect.h * cfg.focus[1];
  const x = Math.max(rect.x, Math.min(rect.x + rect.w - w, cx - w / 2));
  const y = Math.max(rect.y, Math.min(rect.y + rect.h - h, cy - h / 2));
  const png = await page.screenshot({ clip: { x, y, width: w, height: h }, captureBeyondViewport: true });
  // Downscale and encode to WebP in the browser
  const webp = await page.evaluate(
    async (b64, W, H) => {
      const img = new Image();
      img.src = `data:image/png;base64,${b64}`;
      await img.decode();
      const c = document.createElement("canvas");
      c.width = W;
      c.height = H;
      const g = c.getContext("2d");
      g.imageSmoothingEnabled = true;
      g.imageSmoothingQuality = "high";
      g.drawImage(img, 0, 0, W, H);
      return c.toDataURL("image/webp", 0.84).split(",")[1];
    },
    Buffer.from(png).toString("base64"),
    OUT_W,
    OUT_H
  );
  fs.writeFileSync(path.join(OUT_DIR, `${slug}.webp`), Buffer.from(webp, "base64"));
  await page.close();
  return errors;
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const only = process.argv.slice(2);
  const browser = await puppeteer.launch({ executablePath: BRAVE_PATH, headless: true, args: ["--no-sandbox", "--autoplay-policy=no-user-gesture-required"], protocolTimeout: 180000 });
  let failed = 0;
  for (const [slug, cfg] of Object.entries(COVERS)) {
    if (only.length && !only.includes(slug)) continue;
    try {
      const errors = await capture(browser, slug, cfg);
      console.log(`✔ ${slug}${errors.length ? `  (page errors: ${errors.join(" | ")})` : ""}`);
    } catch (e) {
      failed++;
      console.log(`✖ ${slug}: ${e.message}`);
    }
  }
  await browser.close();
  process.exit(failed ? 1 : 0);
}

main();
