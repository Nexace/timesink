import puppeteer from "puppeteer-core";
import path from "node:path";
import assert from "node:assert/strict";

const BRAVE_PATH = "C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe";
const ARTIFACTS_DIR = "C:\\Users\\Amogh Khairate\\.gemini\\antigravity\\brain\\127ba319-c802-464c-9981-3931c3b634d6";

async function run() {
  console.log("Launching Brave for Diet Game verification...");
  const browser = await puppeteer.launch({
    executablePath: BRAVE_PATH,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    console.log("Navigating to Diet Game...");
    await page.goto("http://localhost:5173/games/diet-game/index.html", { waitUntil: "networkidle0" });

    // Step 1: Check initial empty state
    const plateEmptyText = await page.$eval("#plate-items", el => el.textContent.trim());
    console.log("Initial plate state:", plateEmptyText);
    assert.ok(plateEmptyText.includes("PLATE EMPTY"), "Initial plate should show PLATE EMPTY");

    await page.screenshot({ path: path.join(ARTIFACTS_DIR, "diet-game-empty.png") });
    console.log("Saved empty plate screenshot");

    // Step 2: Input user's exact text from the screenshot
    const userMealText = "Pizza\nBurger\nCarrot 50 cal\nSoya Chunks\nRed";
    console.log("Typing user's exact meal plan:\n", userMealText);

    await page.focus("#meal-input");
    await page.$eval("#meal-input", (el, text) => {
      el.value = text;
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }, userMealText);

    // Wait for render
    await new Promise(r => setTimeout(r, 400));

    // Step 3: Verify Rules Status
    const ruleCards = await page.$$eval(".rule-card", cards => {
      return cards.map(c => {
        const title = c.querySelector(".rule-card__head span:first-child")?.textContent || "";
        const status = c.querySelector(".rule-card__head span:last-child")?.textContent || "";
        const desc = c.querySelector(".rule-card__desc")?.textContent || "";
        return { title, status, desc };
      });
    });

    console.log("Rule Evaluation Results:");
    ruleCards.forEach(r => console.log(`  ${r.title}: ${r.status} (${r.desc.substring(0, 40)}...)`));

    // Check Rule 4 (Protein) specifically:
    const rule4 = ruleCards.find(r => r.title.includes("RULE 4"));
    assert.ok(rule4, "Rule 4 must exist");
    assert.equal(rule4.status, "[OK]", "Rule 4 (Protein) MUST PASS for 'Soya Chunks'!");
    console.log(">>> SUCCESS: Rule 4 passed with Soya Chunks recognized as protein!");

    // Check Rules 1, 2, 3, 5
    const rule1 = ruleCards.find(r => r.title.includes("RULE 1"));
    const rule2 = ruleCards.find(r => r.title.includes("RULE 2"));
    const rule3 = ruleCards.find(r => r.title.includes("RULE 3"));
    const rule5 = ruleCards.find(r => r.title.includes("RULE 5"));
    assert.equal(rule1.status, "[OK]", "Rule 1 must pass");
    assert.equal(rule2.status, "[OK]", "Rule 2 (Vegetables) must pass");
    assert.equal(rule3.status, "[OK]", "Rule 3 (Calories) must pass");
    assert.equal(rule5.status, "[OK]", "Rule 5 (Colour word) must pass");

    // Step 4: Verify Plated Food Badges
    const platedBadges = await page.$$eval(".plate-food-badge", badges => {
      return badges.map(b => b.textContent.trim());
    });
    console.log("Plated Food Badges on White Plate:", platedBadges);
    assert.ok(platedBadges.some(b => b.includes("Pizza")), "Plate must show Pizza");
    assert.ok(platedBadges.some(b => b.includes("Burger")), "Plate must show Burger");
    assert.ok(platedBadges.some(b => b.includes("Carrot")), "Plate must show Carrot");
    assert.ok(platedBadges.some(b => b.includes("Soya Chunks")), "Plate must show Soya Chunks");

    // Step 5: Verify Telemetry Bar
    const telemetry = await page.evaluate(() => {
      return {
        items: document.getElementById("pt-items-val")?.textContent,
        calories: document.getElementById("pt-cal-val")?.textContent,
        protein: document.getElementById("pt-protein-val")?.textContent,
        vegan: document.getElementById("pt-vegan-val")?.textContent,
      };
    });
    console.log("Plate Telemetry:", telemetry);
    assert.equal(telemetry.items, "4", "Item count should be 4");
    assert.equal(telemetry.calories, "50 CAL", "Calories should be 50 CAL");
    assert.ok(telemetry.protein.includes("SOYA CHUNKS"), "Protein telemetry must report SOYA CHUNKS");

    // Capture screenshot of the user's solved state
    const platePanel = await page.$(".dg-plate-panel");
    const panelScreenshotPath = path.join(ARTIFACTS_DIR, "diet-game-soya-chunks-plate-panel.png");
    await platePanel.screenshot({ path: panelScreenshotPath });
    console.log("Saved Plate Panel screenshot:", panelScreenshotPath);

    const fullScreenshotPath = path.join(ARTIFACTS_DIR, "diet-game-soya-chunks-verified.png");
    await page.screenshot({ path: fullScreenshotPath });
    console.log("Saved Full Screen screenshot:", fullScreenshotPath);

    // Step 6: Test expanded food menu (Indian and Global items)
    const indianMealText = "1 bowl dal 180 cal\nrajma chawal 350 cal\npaneer tikka\npalak 40 cal\ngulab jamun 120 cal\ngolden";
    console.log("\nTesting expanded food items (dal, rajma, paneer, palak, gulab jamun):\n", indianMealText);

    await page.$eval("#meal-input", (el, text) => {
      el.value = text;
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }, indianMealText);

    await new Promise(r => setTimeout(r, 400));

    const expandedBadges = await page.$$eval(".plate-food-badge", badges => badges.map(b => b.textContent.trim()));
    console.log("Expanded Food Badges on Plate:", expandedBadges);
    assert.ok(expandedBadges.some(b => b.includes("Dal") || b.includes("Lentils")), "Plate recognized Dal");
    assert.ok(expandedBadges.some(b => b.includes("Rajma")), "Plate recognized Rajma");
    assert.ok(expandedBadges.some(b => b.includes("Paneer")), "Plate recognized Paneer");
    assert.ok(expandedBadges.some(b => b.includes("Palak") || b.includes("Spinach")), "Plate recognized Palak");
    assert.ok(expandedBadges.some(b => b.includes("Mithai") || b.includes("Gulab Jamun")), "Plate recognized dessert");

    const indianScreenshotPath = path.join(ARTIFACTS_DIR, "diet-game-expanded-foods.png");
    await page.screenshot({ path: indianScreenshotPath });
    console.log("Saved expanded foods screenshot:", indianScreenshotPath);

    console.log("\nALL VERIFICATIONS PASSED 100%!");
  } finally {
    await browser.close();
  }
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
