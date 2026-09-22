import puppeteer from "puppeteer-core";
import path from "node:path";
import assert from "node:assert/strict";

const BRAVE_PATH = "C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe";
const ARTIFACTS_DIR = "C:\\Users\\Amogh Khairate\\.gemini\\antigravity\\brain\\127ba319-c802-464c-9981-3931c3b634d6";

async function run() {
  console.log("Launching Brave for Ground Zero targeting verification...");
  const browser = await puppeteer.launch({
    executablePath: BRAVE_PATH,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    console.log("Navigating to Ground Zero...");
    await page.goto("http://localhost:5173/games/ground-zero/index.html", { waitUntil: "networkidle0" });

    // Step 1: Initial state check
    const initialTarget = await page.$eval("#target-name", el => el.textContent.trim());
    console.log("1. Initial target HUD:", initialTarget);
    assert.ok(initialTarget.includes("New York City"), "Initial target should be NYC");

    // Get map container center point
    const mapBox = await page.$eval("#map", el => {
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2, left: r.left, top: r.top, width: r.width, height: r.height };
    });

    // Step 2: Test panning/dragging the map (The exact action the user was doing!)
    console.log("\n2. Panning map 350px west...");
    await page.mouse.move(mapBox.x, mapBox.y);
    await page.mouse.down();
    await page.mouse.move(mapBox.x - 350, mapBox.y - 100, { steps: 15 });
    await page.mouse.up();
    await new Promise(r => setTimeout(r, 500));

    const pannedTarget = await page.$eval("#target-name", el => el.textContent.trim());
    console.log("Target HUD after map pan:", pannedTarget);
    assert.ok(!pannedTarget.includes("New York City, USA [40.7128"), "Target must update away from NYC when panned!");

    // Detonate at the panned location!
    console.log("Clicking DETONATE at panned location...");
    await page.click("#btn-detonate");
    await new Promise(r => setTimeout(r, 1000));

    // Verify map center is still at the panned location, NOT NYC!
    const targetAfterDetonate = await page.$eval("#target-name", el => el.textContent.trim());
    console.log("Target HUD after detonation:", targetAfterDetonate);
    assert.equal(targetAfterDetonate, pannedTarget, "Detonation must occur at panned location without resetting to NYC!");

    const pannedScreenshotPath = path.join(ARTIFACTS_DIR, "ground-zero-panned-detonate.png");
    await page.screenshot({ path: pannedScreenshotPath });
    console.log("Saved panned detonation screenshot:", pannedScreenshotPath);

    // Step 3: Test clicking on a completely different spot on the map
    console.log("\n3. Clicking on map at offset (x + 200, y - 150)...");
    await page.mouse.click(mapBox.x + 200, mapBox.y - 150);
    await new Promise(r => setTimeout(r, 600));

    const clickedTarget = await page.$eval("#target-name", el => el.textContent.trim());
    console.log("Target HUD after click:", clickedTarget);
    assert.notEqual(clickedTarget, pannedTarget, "Target should have changed on click!");

    console.log("Clicking DETONATE at clicked location...");
    await page.click("#btn-detonate");
    await new Promise(r => setTimeout(r, 1000));

    const clickedScreenshotPath = path.join(ARTIFACTS_DIR, "ground-zero-clicked-detonate.png");
    await page.screenshot({ path: clickedScreenshotPath });
    console.log("Saved clicked detonation screenshot:", clickedScreenshotPath);

    // Step 4: Test selecting a city from dropdown (e.g. Paris)
    console.log("\n4. Selecting Paris from dropdown...");
    await page.select("#city-select", "48.8566,2.3522");
    await new Promise(r => setTimeout(r, 600));

    const parisTarget = await page.$eval("#target-name", el => el.textContent.trim());
    console.log("Target HUD after selecting Paris:", parisTarget);
    assert.ok(parisTarget.includes("Paris"), "Target HUD must reflect Paris");

    console.log("Clicking DETONATE in Paris...");
    await page.click("#btn-detonate");
    await new Promise(r => setTimeout(r, 1000));

    const parisScreenshotPath = path.join(ARTIFACTS_DIR, "ground-zero-paris-detonate.png");
    await page.screenshot({ path: parisScreenshotPath });
    console.log("Saved Paris detonation screenshot:", parisScreenshotPath);

    // Step 5: Test clicking inside active blast rings (verify rings do not block clicks)
    console.log("\n5. Testing click directly inside active blast rings...");
    await page.mouse.click(mapBox.x + 40, mapBox.y + 40);
    await new Promise(r => setTimeout(r, 400));
    const targetAfterRingClick = await page.$eval("#target-name", el => el.textContent.trim());
    console.log("Target HUD after clicking inside blast rings:", targetAfterRingClick);
    assert.notEqual(targetAfterRingClick, parisTarget, "Click inside blast rings must register cleanly and update target!");

    console.log("\nALL GROUND ZERO TARGETING TESTS PASSED 100%!");
  } finally {
    await browser.close();
  }
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
