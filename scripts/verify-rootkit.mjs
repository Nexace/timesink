import puppeteer from "puppeteer-core";
import path from "node:path";
import assert from "node:assert/strict";

const BRAVE_PATH = "C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe";
const ARTIFACTS_DIR = "C:\\Users\\Amogh Khairate\\.gemini\\antigravity\\brain\\127ba319-c802-464c-9981-3931c3b634d6";

async function run() {
  console.log("Launching Brave for Rootkit terminal verification...");
  const browser = await puppeteer.launch({
    executablePath: BRAVE_PATH,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 880 });
    console.log("Navigating to Rootkit...");
    await page.goto("http://localhost:5173/games/rootkit/index.html", { waitUntil: "networkidle0" });

    // Step 1: Initial Telemetry & Title Verification
    const stageTitle = await page.$eval(".stage-bar__title", (el) => el.textContent.trim());
    console.log("Stage title:", stageTitle);
    assert.ok(stageTitle.includes("ROOTKIT"), "Stage title must contain ROOTKIT");

    const subnetVal = await page.$eval("#subnet-val", (el) => el.textContent.trim());
    const hostIp = await page.$eval("#host-ip", (el) => el.textContent.trim());
    const proxyCount = await page.$eval("#proxy-count", (el) => el.textContent.trim());
    const clearance = await page.$eval("#privilege-badge", (el) => el.textContent.trim());
    console.log(`Subnet: ${subnetVal} | Host: ${hostIp} | Proxies: ${proxyCount} | Clearance: ${clearance}`);

    assert.equal(subnetVal, "10.0.0.0/24");
    assert.equal(hostIp, "10.0.0.1");
    assert.equal(proxyCount, "0 HOPS");
    assert.equal(clearance, "OPERATOR");

    // Capture initial terminal state
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, "rootkit-initial-terminal.png") });
    console.log("Saved rootkit-initial-terminal.png");

    // Step 2: Test Tab Autocompletion
    console.log("Testing Tab autocompletion for 'sc' -> 'scan '...");
    await page.click("#cmd-input");
    await page.type("#cmd-input", "sc");
    await page.keyboard.press("Tab");
    const autocompletedVal = await page.$eval("#cmd-input", (el) => el.value);
    console.log("Autocompleted value:", `"${autocompletedVal}"`);
    assert.equal(autocompletedVal, "scan ", "Tab should autocomplete 'sc' to 'scan '");

    // Press Enter to run scan
    await page.keyboard.press("Enter");
    await new Promise((r) => setTimeout(r, 150));

    // Verify scan output
    const bufferText = await page.$eval("#output-buffer", (el) => el.textContent);
    assert.ok(bufferText.includes("10.0.0.15"), "Buffer must contain discovered host 10.0.0.15");
    assert.ok(bufferText.includes("research-node.local"), "Buffer must contain hostname");

    // Step 3: Test Command History (ArrowUp)
    console.log("Testing ArrowUp command history...");
    await page.keyboard.press("ArrowUp");
    const historyVal = await page.$eval("#cmd-input", (el) => el.value);
    console.log("History recalled:", `"${historyVal}"`);
    assert.equal(historyVal, "scan", "ArrowUp must recall previous command 'scan'");
    await page.keyboard.press("Escape");
    await page.$eval("#cmd-input", (el) => (el.value = ""));

    // Step 4: Connect to 10.0.0.15 & Crack Port 22
    console.log("Connecting to 10.0.0.15...");
    await page.type("#cmd-input", "connect 10.0.0.15");
    await page.keyboard.press("Enter");
    await new Promise((r) => setTimeout(r, 150));

    const updatedHost = await page.$eval("#host-ip", (el) => el.textContent.trim());
    console.log("Updated host telemetry:", updatedHost);
    assert.equal(updatedHost, "10.0.0.15");

    console.log("Cracking port 22...");
    await page.type("#cmd-input", "crack 22");
    await page.keyboard.press("Enter");
    await new Promise((r) => setTimeout(r, 150));

    const updatedClearance = await page.$eval("#privilege-badge", (el) => el.textContent.trim());
    console.log("Updated clearance after cracking:", updatedClearance);
    assert.equal(updatedClearance, "USER");

    // Step 5: Test Hex Dump formatting
    console.log("Testing hex dump on flag.txt...");
    await page.type("#cmd-input", "dump flag.txt");
    await page.keyboard.press("Enter");
    await new Promise((r) => setTimeout(r, 200));

    const dumpLineExists = await page.$eval(".rk-line--dump", (el) => el.textContent);
    console.log("Hex dump sample preview:\n" + dumpLineExists.split("\n")[0]);
    assert.ok(dumpLineExists.includes("00000000:"), "Hex dump must contain offset 00000000:");
    assert.ok(dumpLineExists.includes("|FLAG{"), "Hex dump must contain ASCII representation |FLAG{|");

    await page.screenshot({ path: path.join(ARTIFACTS_DIR, "rootkit-hex-dump.png") });
    console.log("Saved rootkit-hex-dump.png");

    // Step 6: Complete Mission 1 via 'cat flag.txt'
    console.log("Completing Mission 1 via 'cat flag.txt'...");
    await page.type("#cmd-input", "cat flag.txt");
    await page.keyboard.press("Enter");
    await new Promise((r) => setTimeout(r, 300));

    const victoryBuffer = await page.$eval("#output-buffer", (el) => el.textContent);
    assert.ok(victoryBuffer.includes("MISSION CLEARED"), "Buffer must announce MISSION CLEARED");

    await page.screenshot({ path: path.join(ARTIFACTS_DIR, "rootkit-mission-cleared.png") });
    console.log("Saved rootkit-mission-cleared.png");

    console.log("All Rootkit browser verifications PASSED successfully!");
  } catch (err) {
    console.error("Verification failed:", err);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

run();
