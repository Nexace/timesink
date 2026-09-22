import puppeteer from "puppeteer-core";
import fs from "node:fs";
import path from "node:path";

const BRAVE_PATH = "C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe";
const BASE_URL = "http://localhost:5173";
const ARTIFACTS_DIR = "C:\\Users\\Amogh Khairate\\.gemini\\antigravity\\brain\\127ba319-c802-464c-9981-3931c3b634d6";

async function main() {
  console.log("=== VERIFYING ACE VECTOR OVERHAUL VIA BRAVE ===");

  const browser = await puppeteer.launch({
    executablePath: BRAVE_PATH,
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--window-size=1280,850",
    ],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 850 });

  const errors = [];
  page.on("pageerror", (err) => {
    console.error(`[PAGE ERROR] ${err.message}`);
    errors.push(`[PAGE ERROR] ${err.message}`);
  });
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      console.error(`[BROWSER ERROR] ${msg.text()}`);
      errors.push(`[BROWSER ERROR] ${msg.text()}`);
    }
  });

  // 1. Check Homepage Arcade Card Motif
  console.log("1. Checking homepage coverpanel motif for ace-vector...");
  await page.goto(BASE_URL, { waitUntil: "networkidle0" });
  const cardFound = await page.evaluate(() => {
    const card = document.querySelector('a[href*="ace-vector"]');
    return Boolean(card);
  });
  console.log(`Arcade card found: ${cardFound}`);

  // Screenshot homepage motif
  const cardElement = await page.$('a[href*="ace-vector"]');
  if (cardElement) {
    await cardElement.screenshot({
      path: path.join(ARTIFACTS_DIR, "ace-vector-coverpanel-motif.png")
    });
    console.log("Saved ace-vector-coverpanel-motif.png");
  }

  // 2. Open Ace Vector Game
  console.log("2. Navigating to Ace Vector game...");
  await page.goto(`${BASE_URL}/games/ace-vector/`, { waitUntil: "networkidle0" });
  await page.waitForSelector("#av-canvas", { timeout: 5000 });
  await new Promise((r) => setTimeout(r, 1000));

  // 3. Open Hangar Requisition Modal
  console.log("3. Opening Fighter Hangar Requisition modal...");
  await page.click("#btn-open-hangar");
  await new Promise((r) => setTimeout(r, 600));

  const cardCount = await page.$$eval(".hangar-card", (cards) => cards.length);
  console.log(`Hangar aircraft cards found: ${cardCount} (expected 5)`);

  await page.screenshot({
    path: path.join(ARTIFACTS_DIR, "ace-vector-hangar.png"),
    fullPage: false
  });
  console.log("Saved ace-vector-hangar.png");

  // 4. Select Su-47 Berkut (card index 1 / Key 2)
  console.log("4. Selecting Su-47 Berkut fighter...");
  await page.keyboard.press("2");
  await new Promise((r) => setTimeout(r, 400));

  const activeCraft = await page.$eval("#hud-craft", (el) => el.textContent);
  console.log(`Active aircraft in HUD: ${activeCraft}`);

  // Resume sortie
  await page.click("#btn-hangar-close");
  await new Promise((r) => setTimeout(r, 600));

  // 5. Test Flight in Mountain Canyon with Bandits
  console.log("5. Engaging in low-altitude mountain combat...");
  // Steer down into canyon / mountain airspace
  await page.keyboard.down("KeyS"); // Nose down / dive toward mountains
  await new Promise((r) => setTimeout(r, 1200));
  await page.keyboard.up("KeyS");

  // Fire rotary cannon & afterburner
  await page.keyboard.down("ShiftLeft");
  await page.keyboard.down("Space");
  await new Promise((r) => setTimeout(r, 800));
  await page.keyboard.up("Space");
  await page.keyboard.up("ShiftLeft");

  await page.screenshot({
    path: path.join(ARTIFACTS_DIR, "ace-vector-mountain-combat.png"),
    fullPage: false
  });
  console.log("Saved ace-vector-mountain-combat.png");

  // 6. Test A-10C Warthog & Cloud Strata
  console.log("6. Switching to A-10C Warthog and climbing into cloud deck...");
  await page.keyboard.press("3"); // Select A-10
  await new Promise((r) => setTimeout(r, 300));

  // Climb up into cloud deck
  await page.keyboard.down("KeyW"); // Nose up
  await page.keyboard.down("ShiftLeft"); // Afterburner zoom climb
  await new Promise((r) => setTimeout(r, 1800));
  await page.keyboard.up("KeyW");
  await page.keyboard.up("ShiftLeft");

  const hudZone = await page.$eval("#hud-strata", (el) => el.textContent);
  const hudSpeed = await page.$eval("#hud-speed", (el) => el.textContent);
  const hudAlt = await page.$eval("#hud-alt", (el) => el.textContent);
  console.log(`HUD Status: Zone: ${hudZone}, Speed: ${hudSpeed}, Altitude: ${hudAlt}`);

  // Fire missile / cannon in cloud deck
  await page.keyboard.press("KeyF");
  await page.keyboard.press("KeyC"); // flares

  await page.screenshot({
    path: path.join(ARTIFACTS_DIR, "ace-vector-cloud-layer.png"),
    fullPage: false
  });
  console.log("Saved ace-vector-cloud-layer.png");

  // 7. Test Low-Altitude Ocean Pass & GPWS Warning
  console.log("7. Diving low over mountain valleys and ocean surf...");
  await page.keyboard.press("1"); // F-22 Raptor
  await page.keyboard.down("KeyS"); // Nose down into low valley
  await new Promise((r) => setTimeout(r, 2200));
  await page.keyboard.up("KeyS");
  // Pull up gently near ocean
  await page.keyboard.down("KeyW");
  await new Promise((r) => setTimeout(r, 600));
  await page.keyboard.up("KeyW");

  await page.screenshot({
    path: path.join(ARTIFACTS_DIR, "ace-vector-ocean-low-pass.png"),
    fullPage: false
  });
  console.log("Saved ace-vector-ocean-low-pass.png");

  // Verify no fatal page errors
  console.log(`Total errors captured: ${errors.length}`);
  if (errors.length > 0) {
    console.error("Errors encountered:", errors);
  }

  await browser.close();
  console.log("=== VERIFICATION COMPLETE ===");
}

main().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
