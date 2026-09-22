import puppeteer from "puppeteer-core";

const BRAVE_PATH = "C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe";

async function run() {
  const browser = await puppeteer.launch({
    executablePath: BRAVE_PATH,
    headless: true,
    args: ["--no-sandbox"]
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  await page.goto("http://localhost:5173/games/ground-zero/index.html", { waitUntil: "networkidle0" });

  page.on("console", msg => console.log("PAGE LOG:", msg.text()));
  page.on("pageerror", err => console.log("PAGE ERROR:", err));

  const initialTarget = await page.$eval("#target-name", el => el.textContent);
  console.log("Initial target:", initialTarget);

  // Click on the map offset from center
  const mapRect = await page.$eval("#map", el => {
    const r = el.getBoundingClientRect();
    return { left: r.left, top: r.top, width: r.width, height: r.height };
  });
  console.log("Map rect:", mapRect);

  // Click at left + 100, top + 100
  await page.mouse.click(mapRect.left + 100, mapRect.top + 100);
  await new Promise(r => setTimeout(r, 400));

  const targetAfterClick = await page.$eval("#target-name", el => el.textContent);
  console.log("Target after click (100, 100):", targetAfterClick);

  // Detonate
  await page.click("#btn-detonate");
  await new Promise(r => setTimeout(r, 600));

  // Now click inside the blast rings
  console.log("Clicking near center (inside blast rings)...");
  await page.mouse.click(mapRect.left + mapRect.width / 2 + 30, mapRect.top + mapRect.height / 2 + 30);
  await new Promise(r => setTimeout(r, 400));
  const targetAfterRingClick = await page.$eval("#target-name", el => el.textContent);
  console.log("Target after click inside blast rings:", targetAfterRingClick);

  await browser.close();
}

run().catch(console.error);
