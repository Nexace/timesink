// Smoke-test Mars Base in a real browser: boot, start a campaign, walk out of the hab,
// mine scrap, open panels, fast-forward to night, and capture screenshots.
// Usage: npm run dev (in another shell), then
//   node scripts/verify-mars-base.mjs          # screenshots to .test-screenshots/
//   node scripts/verify-mars-base.mjs --og     # also refresh assets/mars-base-og.png (1200×630)
import puppeteer from "puppeteer-core";
import fs from "node:fs";

const BROWSER = process.env.BROWSER_PATH ?? "C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe";
const BASE = process.env.BASE_URL ?? "http://localhost:5173";
const OUT = ".test-screenshots";
const makeOg = process.argv.includes("--og");

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function run() {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await puppeteer.launch({ executablePath: BROWSER, headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox"] });
  const errors = [];
  try {
    const page = await browser.newPage();
    page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(`console: ${m.text()}`);
    });
    await page.setViewport({ width: 1366, height: 820 });
    await page.evaluateOnNewDocument(() => localStorage.clear());
    await page.goto(`${BASE}/games/mars-base`, { waitUntil: "networkidle0" });
    const title = await page.title();
    if (!title.includes("MARS BASE")) throw new Error(`unexpected title ${title}`);
    await page.screenshot({ path: `${OUT}/mars-base-title.png` });

    // New campaign
    await page.click('[data-t="new-camp"]');
    await wait(300);
    await page.click('.modal-backdrop [data-action="0"]');
    await wait(300);

    const state = await page.evaluate(async () => {
      const M = window.__marsBase;
      M.ignoreHidden = true;
      const g = M.game;
      // Walk west out of the airlock.
      M.hold = { mx: -1, my: 0 };
      M.pump(35);
      M.hold = null;
      // Mine the nearest scrap pile.
      const p = g.s.player;
      let best = null;
      for (let y = Math.floor(p.y) - 14; y < p.y + 14; y += 1)
        for (let x = Math.floor(p.x) - 14; x < p.x + 14; x += 1)
          if (g.world.nodes[y * g.world.w + x] === 6) {
            const d = Math.hypot(x + 0.5 - p.x, y + 0.5 - p.y);
            if (!best || d < best.d) best = { x, y, d };
          }
      for (let i = 0; i < 300 && Math.hypot(best.x + 0.5 - p.x, best.y + 1.5 - p.y) > 0.6; i += 1) {
        const dx = best.x + 0.5 - p.x;
        const dy = best.y + 1.5 - p.y;
        const d = Math.hypot(dx, dy);
        M.hold = { mx: dx / d, my: dy / d };
        M.pump(1);
      }
      g.s.sel = 0;
      M.hold = { aim: { x: best.x + 0.5, y: best.y + 0.5 }, use: true };
      M.pump(60);
      M.hold = null;
      return { obj: g.s.story.idx, scrap: g.s.story.flags.scrapTotal ?? 0, status: g.s.status };
    });
    console.log("campaign:", state);
    if (state.obj < 1) throw new Error("EVA objective did not complete");
    if (state.scrap < 1) throw new Error("mining produced no scrap");
    await page.screenshot({ path: `${OUT}/mars-base-eva.png` });

    // Panels
    for (const [key, name] of [["Tab", "inventory"], ["KeyB", "build"], ["KeyM", "map"], ["KeyJ", "journal"]]) {
      await page.evaluate((code) => {
        window.dispatchEvent(new KeyboardEvent("keydown", { code, bubbles: true }));
        window.__marsBase.pump(2);
      }, key);
      await page.screenshot({ path: `${OUT}/mars-base-panel-${name}.png` });
      await page.evaluate((code) => window.dispatchEvent(new KeyboardEvent("keydown", { code, bubbles: true })), key);
    }

    // Night + colony kit showcase
    await page.evaluate(() => {
      const M = window.__marsBase;
      M.newEndless("colony");
      const g = M.game;
      M.step(20 * 600 * 1.02);
      g.s.player.x = g.world.start.x - 1.5;
      g.s.player.y = g.world.start.y + 1.5;
      M.pump(4);
    });
    await page.screenshot({ path: `${OUT}/mars-base-colony.png` });
    await page.evaluate(() => {
      const M = window.__marsBase;
      M.step(20 * 400);
      M.pump(4);
    });
    await page.screenshot({ path: `${OUT}/mars-base-night.png` });

    if (makeOg) {
      await page.evaluate(() => {
        const M = window.__marsBase;
        M.step(20 * 250);
        M.pump(4);
      });
      await page.setViewport({ width: 1240, height: 880 });
      await wait(200);
      await page.evaluate(() => window.__marsBase.pump(3));
      const box = await (await page.$("#stage")).boundingBox();
      await page.screenshot({
        path: "assets/mars-base-og.png",
        clip: { x: Math.round(box.x + (box.width - 1200) / 2), y: Math.round(box.y + (box.height - 630) / 2), width: 1200, height: 630 },
      });
      console.log("wrote assets/mars-base-og.png");
    }

    if (errors.length) throw new Error(`browser errors:\n${errors.join("\n")}`);
    console.log("mars-base verification passed");
  } finally {
    await browser.close();
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
