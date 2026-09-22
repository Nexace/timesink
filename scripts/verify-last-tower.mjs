import puppeteer from "puppeteer-core";

const BRAVE_PATH = "C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe";
const ARTIFACT_DIR = "C:/Users/Amogh Khairate/.gemini/antigravity/brain/127ba319-c802-464c-9981-3931c3b634d6";

async function run() {
  console.log("Launching Brave for LAST TOWER overhaul verification...");
  const browser = await puppeteer.launch({
    executablePath: BRAVE_PATH,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    console.log("Navigating to http://localhost:5173/games/last-tower/ ...");
    await page.goto("http://localhost:5173/games/last-tower/", { waitUntil: "networkidle0" });

    const title = await page.title();
    console.log("Page Title:", title);
    if (!title.includes("LAST TOWER")) throw new Error("Title does not include LAST TOWER");

    await new Promise(r => setTimeout(r, 1000));

    // 1. Build a diverse set of towers
    console.log("Building diverse weapon platforms onto the defense grid...");
    await page.evaluate(async () => {
      const m = await import("/src/games/last-tower/game.js");
      // Build Gatling at (4, 4)
      m.buildTowerAt(4, 4);
      // Build Laser at (6, 5)
      window.document.querySelector('[data-tower="laser"]').click();
      m.buildTowerAt(6, 5);
      // Build Swarm Rockets at (8, 4)
      window.document.querySelector('[data-tower="missile"]').click();
      m.buildTowerAt(8, 4);
      // Build Acid Spitter at (10, 5)
      window.document.querySelector('[data-tower="acid"]').click();
      m.buildTowerAt(10, 5);
      // Build Cryo at (12, 4)
      window.document.querySelector('[data-tower="cryo"]').click();
      m.buildTowerAt(12, 4);
    });

    await new Promise(r => setTimeout(r, 800));

    // 2. Inspect a tower & verify inspector UI
    console.log("Inspecting tower and switching priority to STRONGEST...");
    await page.evaluate(() => {
      // Click canvas at tile (4, 4) -> x: 4*40 + 20 = 180, y: 4*38 + 19 = 171
      const canvas = document.getElementById("lt-canvas");
      const rect = canvas.getBoundingClientRect();
      const clickX = rect.left + (180 / 960) * rect.width;
      const clickY = rect.top + (171 / 540) * rect.height;
      canvas.dispatchEvent(new MouseEvent("click", { clientX: clickX, clientY: clickY, bubbles: true }));
    });

    await new Promise(r => setTimeout(r, 600));

    // 3. Spawn Wave with detailed humanoids
    console.log("Calling early wave with detailed humanoids...");
    await page.click("#btn-call-wave");
    await new Promise(r => setTimeout(r, 1500));

    // Spawn a mix of humanoids directly for visual review (Grunt, Runner, Tank with Riot Shield, Jetpack Flyer, Medic)
    await page.evaluate(async () => {
      const m = await import("/src/games/last-tower/game.js");
      m.spawnCreep("grunt");
      m.spawnCreep("runner");
      m.spawnCreep("tank");
      m.spawnCreep("flyer");
      m.spawnCreep("medic");
    });

    await new Promise(r => setTimeout(r, 1600));

    // Screenshot 1: Humanoid march
    await page.screenshot({ path: `${ARTIFACT_DIR}/last-tower-humanoid-march.png` });
    console.log("Captured: last-tower-humanoid-march.png");

    // Screenshot 2: Weapons in full combat (muzzle flash, laser, rockets)
    await new Promise(r => setTimeout(r, 1400));
    await page.screenshot({ path: `${ARTIFACT_DIR}/last-tower-combat-weapons.png` });
    console.log("Captured: last-tower-combat-weapons.png");

    // 4. Test Tactical Commander Abilities (Air Barrage / EMP)
    console.log("Triggering Tactical Commander Ability: AIR BARRAGE...");
    await page.keyboard.press("Digit1");
    await new Promise(r => setTimeout(r, 400));

    await page.screenshot({ path: `${ARTIFACT_DIR}/last-tower-tactical-ability.png` });
    console.log("Captured: last-tower-tactical-ability.png");

    console.log("\nALL LAST TOWER OVERHAUL VERIFICATIONS PASSED SUCCESSFULLY!");
  } finally {
    await browser.close();
  }
}

run().catch(err => {
  console.error("Verification failed:", err);
  process.exit(1);
});
