import puppeteer from "puppeteer-core";
import path from "node:path";
import fs from "node:fs";

const BRAVE_PATH = "C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe";
const ARTIFACTS_DIR = "C:\\Users\\Amogh Khairate\\.gemini\\antigravity\\brain\\127ba319-c802-464c-9981-3931c3b634d6";

async function run() {
  console.log("Launching Brave...");
  const browser = await puppeteer.launch({
    executablePath: BRAVE_PATH,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"]
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 850 });
    console.log("Navigating to Ground Zero...");
    await page.goto("http://localhost:5173/games/ground-zero/", { waitUntil: "networkidle0" });

    // 1. Inspect computed styles for select elements
    const selectStyles = await page.evaluate(() => {
      const ps = document.getElementById("preset-select");
      const cs = document.getElementById("city-select");
      const psOpt = ps.querySelector("option");
      const psStyle = window.getComputedStyle(ps);
      const csStyle = window.getComputedStyle(cs);
      const optStyle = window.getComputedStyle(psOpt);
      const options = Array.from(ps.options).map(o => ({ value: o.value, text: o.text }));

      return {
        presetSelect: {
          color: psStyle.color,
          backgroundColor: psStyle.backgroundColor,
          border: psStyle.border,
          fontFamily: psStyle.fontFamily
        },
        citySelect: {
          color: csStyle.color,
          backgroundColor: csStyle.backgroundColor
        },
        presetOption: {
          color: optStyle.color,
          backgroundColor: optStyle.backgroundColor
        },
        optionsCount: options.length,
        optionsList: options
      };
    });

    console.log("=== SELECT COMPUTED STYLES ===");
    console.log("Preset Select:", selectStyles.presetSelect);
    console.log("City Select:", selectStyles.citySelect);
    console.log("Option:", selectStyles.presetOption);
    console.log("Options Count:", selectStyles.optionsCount);
    console.log("Options:", selectStyles.optionsList.map(o => `[${o.value}] ${o.text}`).join("\n"));

    // Take screenshot of default state (W76 selected, 100 kt)
    const ss1Path = path.join(ARTIFACTS_DIR, "ground-zero-warheads-ui.png");
    await page.screenshot({ path: ss1Path });
    console.log("Saved screenshot:", ss1Path);

    // 2. Select Davy Crockett (0.02) and detonate
    await page.select("#preset-select", "0.02");
    await page.waitForTimeout ? page.waitForTimeout(300) : new Promise(r => setTimeout(r, 300));
    const davyYield = await page.$eval("#yield-display", el => el.textContent);
    console.log("Davy Crockett yield display:", davyYield);

    await page.click("#btn-detonate");
    await new Promise(r => setTimeout(r, 800));

    const ssDavyPath = path.join(ARTIFACTS_DIR, "ground-zero-davy-crockett.png");
    await page.screenshot({ path: ssDavyPath });
    console.log("Saved Davy Crockett screenshot:", ssDavyPath);

    // 3. Select Castle Bravo (15000) and detonate
    await page.select("#preset-select", "15000");
    await new Promise(r => setTimeout(r, 300));
    const bravoYield = await page.$eval("#yield-display", el => el.textContent);
    console.log("Castle Bravo yield display:", bravoYield);

    await page.click("#btn-detonate");
    await new Promise(r => setTimeout(r, 800));

    const ssBravoPath = path.join(ARTIFACTS_DIR, "ground-zero-castle-bravo.png");
    await page.screenshot({ path: ssBravoPath });
    console.log("Saved Castle Bravo screenshot:", ssBravoPath);

    console.log("Ground Zero verification complete!");
  } finally {
    await browser.close();
  }
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
