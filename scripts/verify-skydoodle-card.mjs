import puppeteer from "puppeteer-core";
import path from "node:path";

const BRAVE_PATH = "C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe";
const ARTIFACTS_DIR = "C:\\Users\\Amogh Khairate\\.gemini\\antigravity\\brain\\127ba319-c802-464c-9981-3931c3b634d6";

async function run() {
  console.log("Launching Brave...");
  const browser = await puppeteer.launch({
    executablePath: BRAVE_PATH,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    console.log("Navigating to Homepage...");
    await page.goto("http://localhost:5173/", { waitUntil: "networkidle0" });

    // Find the SkyDoodle card
    const skydoodleCard = await page.$('a[href*="skydoodle"]');
    if (!skydoodleCard) {
      throw new Error("SkyDoodle card not found on homepage!");
    }

    // Scroll card into view
    await skydoodleCard.evaluate(el => el.scrollIntoView({ block: "center" }));
    await new Promise(r => setTimeout(r, 400));

    // Capture screenshot of the SkyDoodle card specifically
    const cardScreenshotPath = path.join(ARTIFACTS_DIR, "skydoodle-card-new.png");
    await skydoodleCard.screenshot({ path: cardScreenshotPath });
    console.log("Saved SkyDoodle card screenshot:", cardScreenshotPath);

    // Also take screenshot of the full grid view
    const gridScreenshotPath = path.join(ARTIFACTS_DIR, "homepage-grid-skydoodle.png");
    await page.screenshot({ path: gridScreenshotPath });
    console.log("Saved Homepage grid screenshot:", gridScreenshotPath);

    console.log("Verification completed successfully!");
  } finally {
    await browser.close();
  }
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
