import puppeteer from "puppeteer-core";
import path from "node:path";
import assert from "node:assert/strict";

const BRAVE_PATH = "C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe";
const ARTIFACTS_DIR = "C:\\Users\\Amogh Khairate\\.gemini\\antigravity\\brain\\127ba319-c802-464c-9981-3931c3b634d6";

async function run() {
  console.log("Launching Brave for Ping Age quiz verification...");
  const browser = await puppeteer.launch({
    executablePath: BRAVE_PATH,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 1250 });
    console.log("Navigating to Ping Age...");
    await page.goto("http://localhost:5173/games/ping-age/index.html", { waitUntil: "networkidle0" });

    // Step 1: Initial Question State
    const stageTitle = await page.$eval(".stage-bar__title", (el) => el.textContent.trim());
    console.log("Stage title:", stageTitle);
    assert.ok(stageTitle.includes("PING AGE"), "Should contain PING AGE in stage bar title");

    const qCategory = await page.$eval("#q-category", (el) => el.textContent.trim());
    const qText = await page.$eval("#q-text", (el) => el.textContent.trim());
    console.log(`Q1 Category: ${qCategory}`);
    console.log(`Q1 Prompt: ${qText}`);
    assert.ok(qCategory.length > 3, "Category must be loaded");
    assert.ok(qText.length > 10, "Question prompt must be loaded");

    const optionCount = await page.$$eval(".pa-opt-btn", (btns) => btns.length);
    console.log(`Rendered options count: ${optionCount}`);
    assert.equal(optionCount, 5, "Must render exactly 5 options per question");

    // Capture Question 1 screenshot
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, "ping-age-question.png") });
    console.log("Saved ping-age-question.png");

    // Step 2: Test Reaction Quip Toast on Option Click
    console.log("Clicking an option on Q1...");
    await page.click('.pa-opt-btn[data-idx="0"]');

    // Wait briefly for reaction toast to appear
    await new Promise((r) => setTimeout(r, 150));
    const toastDisplay = await page.$eval("#reaction-toast", (el) => el.style.display);
    const toastMsg = await page.$eval("#reaction-msg", (el) => el.textContent.trim());
    console.log("Reaction Toast visible:", toastDisplay, "| Message:", toastMsg);
    assert.ok(toastMsg.length > 5, "Reaction quip message must be non-empty");

    // Capture Reaction Toast screenshot
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, "ping-age-reaction-toast.png") });
    console.log("Saved ping-age-reaction-toast.png");

    // Wait for auto-advance to Q2 (420ms transition in code)
    await new Promise((r) => setTimeout(r, 450));

    // Step 3: Complete remaining 11 questions with authentic choices
    for (let q = 2; q <= 12; q++) {
      const progress = await page.$eval("#quiz-progress-text", (el) => el.textContent.trim());
      console.log(`Answering: ${progress}...`);
      // Select option with index based on question number to get an interesting hybrid mix
      const clickIdx = (q % 5).toString();
      await page.click(`.pa-opt-btn[data-idx="${clickIdx}"]`);
      await new Promise((r) => setTimeout(r, 480));
    }

    // Step 4: Verify Result Dossier Screen
    console.log("Verifying Result Dossier Screen...");
    const resultDisplay = await page.$eval("#result-view", (el) => el.style.display);
    assert.notEqual(resultDisplay, "none", "Result view must be visible");

    const winningTitle = await page.$eval("#era-title", (el) => el.textContent.trim());
    const winningDates = await page.$eval("#era-dates", (el) => el.textContent.trim());
    const winningArchetype = await page.$eval("#era-archetype", (el) => el.textContent.trim());
    const winningDesc = await page.$eval("#era-desc", (el) => el.textContent.trim());
    console.log(`Winning Era: ${winningTitle} ${winningDates}`);
    console.log(`Archetype: ${winningArchetype}`);
    console.log(`Description preview: ${winningDesc.slice(0, 70)}...`);

    assert.ok(winningTitle.length > 3, "Winning title must be present");
    assert.ok(winningArchetype.length > 5, "Winning archetype must be present");
    assert.ok(winningDesc.length > 20, "Winning description must be present");

    // Verify 4 Dossier Cards
    const relic = await page.$eval("#dossier-relic", (el) => el.textContent.trim());
    const habitat = await page.$eval("#dossier-habitat", (el) => el.textContent.trim());
    const trauma = await page.$eval("#dossier-trauma", (el) => el.textContent.trim());
    const superpower = await page.$eval("#dossier-superpower", (el) => el.textContent.trim());
    console.log("Holy Relic:", relic);
    console.log("Natural Habitat:", habitat);
    console.log("Defining Trauma:", trauma);
    console.log("Digital Superpower:", superpower);

    assert.ok(relic.length > 10, "Holy Relic must be populated");
    assert.ok(habitat.length > 10, "Natural Habitat must be populated");
    assert.ok(trauma.length > 10, "Defining Trauma must be populated");
    assert.ok(superpower.length > 10, "Digital Superpower must be populated");

    // Verify Hybrid Era DNA Bars
    const dnaCount = await page.$$eval(".dna-row", (rows) => rows.length);
    console.log(`DNA Rows count: ${dnaCount}`);
    assert.equal(dnaCount, 5, "Must render exactly 5 DNA bars for all 5 eras");

    // Verify Badges if displayed
    const badgesSectionDisplay = await page.$eval("#badges-section", (el) => el.style.display);
    console.log("Badges Section display:", badgesSectionDisplay);

    // Verify Share Button Click
    console.log("Testing Copy Dossier button...");
    await page.click("#btn-share-era");
    await new Promise((r) => setTimeout(r, 200));

    // Capture high-res full Result Dossier screenshot
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, "ping-age-result-dossier.png"), fullPage: true });
    console.log("Saved ping-age-result-dossier.png");

    console.log("All Ping Age verifications PASSED successfully!");
  } catch (err) {
    console.error("Verification failed:", err);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

run();
