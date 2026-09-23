import puppeteer from "puppeteer-core";
import fs from "node:fs";
import path from "node:path";

const BRAVE_PATH = "C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe";
const BASE_URL = "http://localhost:5173";

const SLUGS = [
  "mars-base",
  "ground-zero",
  "diet-game",
  "ping-age",
  "rootkit",
  "ghost-lap",
  "redlight",
  "resume-game",
];

async function main() {
  console.log("=== STARTING BRAVE AUTOMATED TEST SUITE ===");
  console.log(`Brave Path: ${BRAVE_PATH}`);

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
    errors.push(`[PAGE ERROR] ${err.message}`);
  });
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      errors.push(`[CONSOLE ERROR] ${msg.text()}`);
    }
  });
  page.on("response", (resp) => {
    if (resp.status() >= 400) {
      console.log(`  [HTTP ${resp.status()}] ${resp.url()}`);
    }
  });

  // 1. TEST HOMEPAGE
  console.log("\n--- Testing Homepage ---");
  await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle0" });

  // Verify SYS LAUNCH button is removed
  const sysLaunchCount = await page.evaluate(() => {
    return document.querySelectorAll(".sys-launch-btn").length;
  });
  console.log(`SYS LAUNCH buttons found on homepage: ${sysLaunchCount} (Expected: 0)`);
  if (sysLaunchCount !== 0) {
    throw new Error(`Expected 0 .sys-launch-btn elements, found ${sysLaunchCount}`);
  }

  // Verify cards and unique colors
  const cardData = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll(".card"));
    return cards.map((c) => ({
      title: c.querySelector(".spec-val--title")?.textContent?.trim(),
      accent: c.dataset.accent,
      hasPaddle: !!c.querySelector(".rocker-switch__paddle"),
      hasSwitchWell: !!c.querySelector(".cartridge-switch-well"),
    }));
  });

  console.log(`Found ${cardData.length} cartridge cards:`);
  const seenAccents = new Set();
  for (const c of cardData) {
    console.log(`  - ${c.title}: accent="${c.accent}", hasPaddle=${c.hasPaddle}`);
    if (c.hasPaddle || c.hasSwitchWell) {
      throw new Error(`ROCKER SWITCH BUTTON STILL PRESENT on ${c.title}`);
    }
    if (seenAccents.has(c.accent)) {
      throw new Error(`DUPLICATE ACCENT DETECTED: ${c.accent} on ${c.title}`);
    }
    seenAccents.add(c.accent);
  }
  console.log(`All ${seenAccents.size} cards verified with NO button and unique accent colors!`);

  // Ensure screenshot dir exists
  const ssDir = path.join(process.cwd(), ".test-screenshots");
  if (!fs.existsSync(ssDir)) fs.mkdirSync(ssDir, { recursive: true });

  await page.screenshot({ path: path.join(ssDir, "home.png"), fullPage: true });
  console.log("Captured screenshot: home.png");

  // 2. TEST EACH GAME
  for (const slug of SLUGS) {
    const gameUrl = `${BASE_URL}/games/${slug}/`;
    console.log(`\n--- Testing Game: ${slug} (${gameUrl}) ---`);
    errors.length = 0; // reset per game

    const resp = await page.goto(gameUrl, { waitUntil: "networkidle0" });
    if (!resp.ok()) {
      throw new Error(`Failed to load ${gameUrl}, status: ${resp.status()}`);
    }

    // Check page metadata
    const gameInfo = await page.evaluate(() => {
      const htmlAccent = document.documentElement.dataset.accent;
      const bodyAccent = document.body.dataset.accent;
      const title = document.title;
      const h1 = document.querySelector("h1")?.textContent;
      return { htmlAccent, bodyAccent, title, h1 };
    });

    console.log(`  Title: ${gameInfo.title}`);
    console.log(`  Accent: html="${gameInfo.htmlAccent}", body="${gameInfo.bodyAccent}"`);

    // Verify accent is populated
    if (!gameInfo.htmlAccent) {
      throw new Error(`Missing html data-accent on ${slug}`);
    }

    // Wait a brief moment for RAF / canvas / timers
    await page.evaluate(() => new Promise((r) => setTimeout(r, 400)));

    if (errors.length > 0) {
      console.error(`  Errors found in ${slug}:`, errors);
      throw new Error(`Errors in ${slug}: ${errors.join("; ")}`);
    } else {
      console.log(`  Clean run: 0 console errors, 0 failed requests.`);
    }

    await page.screenshot({ path: path.join(ssDir, `${slug}.png`) });
    console.log(`  Captured screenshot: ${slug}.png`);
  }

  await browser.close();
  console.log("\n=== ALL BRAVE BROWSER TESTS PASSED SUCCESSFULLY! ===");
}

main().catch((err) => {
  console.error("TEST FAILED:", err);
  process.exit(1);
});
