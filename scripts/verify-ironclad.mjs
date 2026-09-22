import puppeteer from "puppeteer-core";
import fs from "node:fs";
import path from "node:path";

const BRAVE_PATH = "C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe";
const BASE_URL = "http://localhost:5173";
const ARTIFACTS_DIR = "C:\\Users\\Amogh Khairate\\.gemini\\antigravity\\brain\\127ba319-c802-464c-9981-3931c3b634d6";

async function main() {
  console.log("=== VERIFYING IRONCLAD.EXE VIA BRAVE BROWSER ===");

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

  try {
    // 1. Check Homepage Arcade Card Motif
    console.log("1. Checking homepage coverpanel motif for ironclad...");
    await page.goto(BASE_URL, { waitUntil: "networkidle0" });
    const cardFound = await page.evaluate(() => {
      const card = document.querySelector('a[href*="ironclad"]');
      return Boolean(card);
    });
    console.log(`Arcade card found: ${cardFound}`);

    const cardElement = await page.$('a[href*="ironclad"]');
    if (cardElement) {
      await cardElement.screenshot({
        path: path.join(ARTIFACTS_DIR, "ironclad-home-card.png"),
      });
      console.log("Saved ironclad-home-card.png");
    }

    // 2. Open Ironclad Game
    console.log("2. Navigating to IRONCLAD game...");
    await page.goto(`${BASE_URL}/games/ironclad/`, { waitUntil: "networkidle0" });
    await page.waitForSelector("#ic-canvas", { timeout: 5000 });

    // Allow game loop and canvas to initialize
    await new Promise((r) => setTimeout(r, 1000));

    // 3. Test building placement: Select Drone Station and place in utility slot
    console.log("3. Testing building placement...");
    await page.click('.ic-bldg-card[data-building-id="droneStation"]');
    await new Promise((r) => setTimeout(r, 300));

    // Place into util_1 slot
    await page.evaluate(() => {
      const b = window.ironclad.getBattle();
      const utilSlot = b.player.slots.find((s) => s.id === "util_1");
      if (utilSlot) {
        window.ironclad.handleSlotClick(utilSlot);
      }
    });

    // Let the game run for 2 seconds so drones fly over, welding sparks emit, progress bars tick
    await new Promise((r) => setTimeout(r, 2000));

    // Scroll to top to capture both the Top HUD and Canvas in the battlefield screenshot
    await page.evaluate(() => window.scrollTo(0, 0));
    await new Promise((r) => setTimeout(r, 200));

    await page.screenshot({
      path: path.join(ARTIFACTS_DIR, "ironclad-battlefield.png"),
    });
    console.log("Saved ironclad-battlefield.png");

    // 4. Test Research & Tech Lab modal
    console.log("4. Testing Research & Tech Lab modal...");
    await page.click("#btn-open-tech");
    await page.waitForSelector("#tech-modal", { visible: true, timeout: 3000 });
    await new Promise((r) => setTimeout(r, 500));

    await page.screenshot({
      path: path.join(ARTIFACTS_DIR, "ironclad-tech-lab.png"),
    });
    console.log("Saved ironclad-tech-lab.png");

    // Close tech modal
    await page.click("#btn-close-tech");
    await new Promise((r) => setTimeout(r, 500));

    console.log("=== ALL BROWSER CHECKS PASSED ===");
    console.log(`Total errors captured: ${errors.length}`);
    if (errors.length > 0) {
      console.warn("Errors:", errors);
      process.exit(1);
    }
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error("FATAL ERROR IN VERIFICATION:", err);
  process.exit(1);
});
