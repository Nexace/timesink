import puppeteer from "puppeteer-core";
import fs from "node:fs";
import path from "node:path";

const BRAVE_PATH = "C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe";
const BASE_URL = "http://localhost:5173";
const ARTIFACTS_DIR = "C:\\Users\\Amogh Khairate\\.gemini\\antigravity\\brain\\127ba319-c802-464c-9981-3931c3b634d6";

const NEW_GAMES = [
  { slug: "ironsail", title: "IRONSAIL", canvasId: "is-canvas" },
  { slug: "ace-vector", title: "ACE VECTOR", canvasId: "av-canvas" },
  { slug: "swarmline", title: "SWARMLINE", canvasId: "sl-canvas" },
  { slug: "last-tower", title: "LAST TOWER", canvasId: "lt-canvas" },
  { slug: "ore-runner", title: "ORE RUNNER", canvasId: "or-canvas" }
];

async function main() {
  console.log("=== VERIFYING 6 EXPANSION GAMES VIA BRAVE ===");

  const browser = await puppeteer.launch({
    executablePath: BRAVE_PATH,
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--window-size=1280,800",
    ],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  const errors = [];
  page.on("pageerror", (err) => {
    console.log(`[PAGE ERROR] ${err.message}`);
    errors.push(`[PAGE ERROR] ${err.message}`);
  });
  page.on("console", (msg) => {
    console.log(`[CONSOLE ${msg.type().toUpperCase()}] ${msg.text()}`);
    if (msg.type() === "error") {
      errors.push(`[CONSOLE ERROR] ${msg.text()}`);
    }
  });

  // 1. Homepage verification
  console.log("\n--- Verifying Homepage ---");
  await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle0" });
  await new Promise((r) => setTimeout(r, 600));

  const totalCards = await page.evaluate(() => {
    return document.querySelectorAll(".card").length;
  });
  console.log(`Total games on homepage: ${totalCards} (Expected: 15)`);
  if (totalCards !== 15) {
    throw new Error(`Expected 15 game cards on homepage, found ${totalCards}`);
  }

  await page.screenshot({
    path: path.join(ARTIFACTS_DIR, "homepage-15-games.png"),
    fullPage: false,
  });
  console.log("Saved homepage screenshot.");

  // 2. Verify each of the 6 new games
  for (const game of NEW_GAMES) {
    console.log(`\n--- Verifying ${game.title} (/games/${game.slug}/) ---`);
    errors.length = 0;

    await page.goto(`${BASE_URL}/games/${game.slug}/`, { waitUntil: "networkidle0" });
    await new Promise((r) => setTimeout(r, 1000));

    // Check canvas exists
    const hasCanvas = await page.evaluate((cid) => {
      const c = document.getElementById(cid);
      return !!c && c.width > 0 && c.height > 0;
    }, game.canvasId);

    console.log(`  Canvas #${game.canvasId}: ${hasCanvas ? "OK" : "MISSING"}`);
    if (!hasCanvas) throw new Error(`Missing canvas #${game.canvasId} in ${game.slug}`);

    // Check How To Play widget
    const hasHtp = await page.evaluate(() => {
      const w = document.getElementById("how-to-play-widget");
      return !!w;
    });
    console.log(`  How To Play widget: ${hasHtp ? "OK" : "MISSING"}`);
    if (!hasHtp) throw new Error(`Missing How To Play widget in ${game.slug}`);

    // Check errors
    if (errors.length > 0) {
      console.error(`  Errors found in ${game.slug}:`, errors);
      throw new Error(`JavaScript errors encountered in ${game.slug}: ${errors.join(", ")}`);
    }

    // Save screenshot
    const shotPath = path.join(ARTIFACTS_DIR, `game-${game.slug}.png`);
    await page.screenshot({ path: shotPath });
    console.log(`  Screenshot saved: game-${game.slug}.png`);
  }

  await browser.close();
  console.log("\n=== ALL 6 EXPANSION GAMES VERIFIED SUCCESSFULLY! ===");
}

main().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
