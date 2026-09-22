import puppeteer from "puppeteer-core";

const BRAVE_PATH = "C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe";

async function run() {
  console.log("Connecting / Launching Brave...");
  const browser = await puppeteer.launch({
    executablePath: BRAVE_PATH,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    console.log("Navigating to http://localhost:5173/ ...");
    await page.goto("http://localhost:5173/", { waitUntil: "networkidle0" });

    const pageTitle = await page.title();
    console.log("Home Title:", pageTitle);

    const bootKicker = await page.$eval(".boot__kicker", el => el.textContent.trim());
    const bootTitle = await page.$eval(".boot__title", el => el.textContent.trim());
    const shellLogo = await page.$eval(".shell__logo", el => el.textContent.trim());

    console.log("Boot Kicker:", bootKicker);
    console.log("Boot Title:", bootTitle);
    console.log("Shell Logo:", shellLogo);

    if (bootTitle !== "TIMESINK.NET") {
      throw new Error(`Expected boot title 'TIMESINK.NET', got '${bootTitle}'`);
    }
    if (!shellLogo.includes("TIMESINK.NET")) {
      throw new Error(`Expected shell logo to include 'TIMESINK.NET', got '${shellLogo}'`);
    }
    if (!bootKicker.includes("TIMESINK.NET")) {
      throw new Error(`Expected kicker to include 'TIMESINK.NET', got '${bootKicker}'`);
    }

    // Now test a game page: /games/swarmline
    console.log("Navigating to http://localhost:5173/games/swarmline ...");
    await page.goto("http://localhost:5173/games/swarmline", { waitUntil: "networkidle0" });

    const gameTitle = await page.title();
    console.log("Swarmline Title:", gameTitle);

    const gameShellLogo = await page.$eval(".shell__logo", el => el.textContent.trim());
    console.log("Swarmline Shell Logo:", gameShellLogo);

    const termHeader = await page.$eval(".terminal-log__header span", el => el.textContent.trim());
    console.log("Terminal Log Header:", termHeader);

    if (!gameShellLogo.includes("TIMESINK.NET")) {
      throw new Error(`Expected game shell logo to include 'TIMESINK.NET', got '${gameShellLogo}'`);
    }
    if (!termHeader.includes("TIMESINK.NET")) {
      throw new Error(`Expected termHeader to include 'TIMESINK.NET', got '${termHeader}'`);
    }

    // Screenshot
    await page.screenshot({ path: "C:/Users/Amogh Khairate/.gemini/antigravity/brain/127ba319-c802-464c-9981-3931c3b634d6/verify-timesink-branding.png" });
    console.log("Screenshot saved!");
    console.log("ALL VERIFICATIONS PASSED!");
  } finally {
    await browser.close();
  }
}

run().catch(err => {
  console.error("Verification failed:", err);
  process.exit(1);
});
