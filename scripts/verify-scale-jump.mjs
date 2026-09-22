import puppeteer from "puppeteer-core";
import path from "node:path";
import assert from "node:assert/strict";

const BRAVE_PATH = "C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe";
const ARTIFACTS_DIR = "C:\\Users\\Amogh Khairate\\.gemini\\antigravity\\brain\\127ba319-c802-464c-9981-3931c3b634d6";

async function run() {
  console.log("Launching Brave for Scale Jump powers of ten verification...");
  const browser = await puppeteer.launch({
    executablePath: BRAVE_PATH,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1400, height: 900 });
    console.log("Navigating to Scale Jump...");
    await page.goto("http://localhost:5173/games/scale-jump/index.html", { waitUntil: "networkidle0" });

    // Step 1: Initial state (Human Scale)
    const pageTitle = await page.$eval(".stage-bar__title", el => el.textContent.trim());
    console.log("Page title:", pageTitle);
    assert.ok(pageTitle.includes("SCALE JUMP"), "Should contain title SCALE JUMP");

    const initialObjTitle = await page.$eval(".obj-card__title", el => el.textContent.trim());
    console.log("Initial object:", initialObjTitle);
    assert.ok(initialObjTitle.includes("Human"), "Default object should be Human");

    const hudScale = await page.$eval("#hud-scale-text", el => el.textContent.trim());
    console.log("Initial HUD scale:", hudScale);
    assert.equal(hudScale, "1 METRE");

    const analogyText = await page.$eval(".obj-card__analogy p", el => el.textContent.trim());
    console.log("Human analogy:", analogyText);
    assert.ok(analogyText.length > 20, "Analogy text must be present");

    await page.screenshot({ path: path.join(ARTIFACTS_DIR, "scale-jump-human.png") });
    console.log("Saved scale-jump-human.png");

    // Step 2: Test Atomic Scale Jump
    console.log("Jumping to Atomic scale (10^-10)...");
    await page.click('.sj-cat-btn[data-log="-10"]');
    await new Promise(r => setTimeout(r, 400));

    const atomicObj = await page.$eval(".obj-card__title", el => el.textContent.trim());
    console.log("Atomic object:", atomicObj);
    assert.ok(atomicObj.includes("Atom"), "Should display an atom");

    const atomicOrder = await page.$eval(".obj-card__order", el => el.textContent.trim());
    console.log("Atomic order:", atomicOrder);
    assert.ok(atomicOrder.includes("-10"), "Should be order 10^-10");

    await page.screenshot({ path: path.join(ARTIFACTS_DIR, "scale-jump-atomic.png") });
    console.log("Saved scale-jump-atomic.png");

    // Step 3: Test Cellular Scale Jump
    console.log("Jumping to Cellular scale (10^-6)...");
    await page.click('.sj-cat-btn[data-log="-6"]');
    await new Promise(r => setTimeout(r, 400));

    const cellObj = await page.$eval(".obj-card__title", el => el.textContent.trim());
    console.log("Cellular object:", cellObj);
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, "scale-jump-cellular.png") });
    console.log("Saved scale-jump-cellular.png");

    // Step 4: Test Planetary Scale Jump
    console.log("Jumping to Planetary scale (10^7)...");
    await page.click('.sj-cat-btn[data-log="7"]');
    await new Promise(r => setTimeout(r, 400));

    const planetObj = await page.$eval(".obj-card__title", el => el.textContent.trim());
    console.log("Planetary object:", planetObj);
    assert.ok(planetObj.includes("Earth"), "Should display Planet Earth");

    await page.screenshot({ path: path.join(ARTIFACTS_DIR, "scale-jump-planetary.png") });
    console.log("Saved scale-jump-planetary.png");

    // Step 5: Test Deep Space / Cosmic Scale Jump
    console.log("Jumping to Cosmic scale (10^25)...");
    await page.click('.sj-cat-btn[data-log="25"]');
    await new Promise(r => setTimeout(r, 400));

    const cosmicObj = await page.$eval(".obj-card__title", el => el.textContent.trim());
    console.log("Cosmic object:", cosmicObj);

    await page.screenshot({ path: path.join(ARTIFACTS_DIR, "scale-jump-cosmic.png") });
    console.log("Saved scale-jump-cosmic.png");

    // Step 6: Test Subatomic / Quantum Scale Jump
    console.log("Jumping to Quantum scale (10^-35)...");
    await page.click('.sj-cat-btn[data-log="-35"]');
    await new Promise(r => setTimeout(r, 400));

    const quantumObj = await page.$eval(".obj-card__title", el => el.textContent.trim());
    console.log("Quantum object:", quantumObj);
    assert.ok(quantumObj.includes("Planck"), "Should display Planck Length");

    await page.screenshot({ path: path.join(ARTIFACTS_DIR, "scale-jump-quantum.png") });
    console.log("Saved scale-jump-quantum.png");

    // Step 7: Test True-Size Compare Mode
    console.log("Opening Compare Mode...");
    await page.click("#btn-toggle-compare");
    await new Promise(r => setTimeout(r, 300));

    const compareDisplay = await page.$eval("#compare-panel", el => el.style.display);
    assert.equal(compareDisplay, "block", "Compare panel should be visible");

    // Click preset "Atom vs Cathedral"
    console.log("Clicking preset: Atom vs Cathedral...");
    await page.click('.btn-preset[data-a="atom_hydrogen"]');
    await new Promise(r => setTimeout(r, 300));

    const ratioText = await page.$eval("#compare-ratio", el => el.textContent.trim());
    console.log("Ratio text:", ratioText);
    assert.ok(ratioText.includes("larger than"), "Should display comparative ratio");

    const noteText = await page.$eval("#compare-note", el => el.textContent.trim());
    console.log("Comparison note:", noteText);
    assert.ok(noteText.includes("stadium") || noteText.includes("marble"), "Should display preset note");

    await page.screenshot({ path: path.join(ARTIFACTS_DIR, "scale-jump-compare.png") });
    console.log("Saved scale-jump-compare.png");

    // Step 8: Verify Milestones
    const unlockedBadges = await page.$$eval(".badge.is-unlocked", els => els.map(e => e.textContent.trim()));
    console.log("Unlocked milestones:", unlockedBadges);
    assert.ok(unlockedBadges.length >= 6, "At least 6 milestones should be unlocked");

    console.log("All Scale Jump verification tests passed successfully!");
  } finally {
    await browser.close();
  }
}

run().catch(err => {
  console.error("Scale Jump verification failed:", err);
  process.exit(1);
});
