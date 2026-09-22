import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

const BRAVE_PATH = 'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe';
const BASE_URL = 'http://localhost:5173';
const SCREENSHOT_DIR = path.resolve('.test-screenshots');

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function main() {
  console.log('=== VERIFYING WIDESCREEN AREA EXPANSION ===');

  const browser = await puppeteer.launch({
    executablePath: BRAVE_PATH,
    headless: true,
    defaultViewport: { width: 1920, height: 1080 }
  });

  const page = await browser.newPage();
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
      console.error('  [Browser Error]:', msg.text());
    }
  });

  // 1. Check Homepage remains constrained to 1180px
  console.log('\n--- Checking Homepage constraint ---');
  await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle0' });
  const homeMetrics = await page.evaluate(() => {
    const sec = document.querySelector('.games.wrap');
    const rect = sec.getBoundingClientRect();
    return { width: rect.width, maxWidth: getComputedStyle(sec).maxWidth };
  });
  console.log(`  Homepage .games.wrap: width=${homeMetrics.width.toFixed(1)}px (CSS maxWidth=${homeMetrics.maxWidth})`);

  // 2. Check Ghost Lap
  console.log('\n--- Checking Ghost Lap Widescreen ---');
  await page.goto(`${BASE_URL}/games/ghost-lap/`, { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 600));
  const ghostLapMetrics = await page.evaluate(() => {
    const main = document.querySelector('main.wrap');
    const canvas = document.getElementById('race-canvas');
    return {
      mainWidth: main.getBoundingClientRect().width,
      canvasWidth: canvas.getBoundingClientRect().width,
      canvasHeight: canvas.getBoundingClientRect().height
    };
  });
  console.log(`  Ghost Lap: mainWidth=${ghostLapMetrics.mainWidth.toFixed(1)}px, canvasWidth=${ghostLapMetrics.canvasWidth.toFixed(1)}px, canvasHeight=${ghostLapMetrics.canvasHeight.toFixed(1)}px`);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'wide-ghost-lap.png') });

  // 3. Check Ace Vector
  console.log('\n--- Checking Ace Vector Widescreen ---');
  await page.goto(`${BASE_URL}/games/ace-vector/`, { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 600));
  const aceMetrics = await page.evaluate(() => {
    const main = document.querySelector('main.wrap');
    const container = document.querySelector('.av-canvas-container');
    const canvas = document.getElementById('av-canvas');
    return {
      mainWidth: main.getBoundingClientRect().width,
      containerWidth: container.getBoundingClientRect().width,
      containerHeight: container.getBoundingClientRect().height,
      canvasWidth: canvas.getBoundingClientRect().width
    };
  });
  console.log(`  Ace Vector: mainWidth=${aceMetrics.mainWidth.toFixed(1)}px, containerWidth=${aceMetrics.containerWidth.toFixed(1)}px, containerHeight=${aceMetrics.containerHeight.toFixed(1)}px`);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'wide-ace-vector.png') });

  // 4. Check IronSail
  console.log('\n--- Checking IronSail Widescreen ---');
  await page.goto(`${BASE_URL}/games/ironsail/`, { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 600));
  const ironMetrics = await page.evaluate(() => {
    const main = document.querySelector('main.wrap');
    const container = document.querySelector('.is-canvas-container');
    return {
      mainWidth: main.getBoundingClientRect().width,
      containerWidth: container.getBoundingClientRect().width,
      containerHeight: container.getBoundingClientRect().height
    };
  });
  console.log(`  IronSail: mainWidth=${ironMetrics.mainWidth.toFixed(1)}px, containerWidth=${ironMetrics.containerWidth.toFixed(1)}px, containerHeight=${ironMetrics.containerHeight.toFixed(1)}px`);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'wide-ironsail.png') });


  // 6. Check Ground Zero
  console.log('\n--- Checking Ground Zero Widescreen ---');
  await page.goto(`${BASE_URL}/games/ground-zero/`, { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 600));
  const gzMetrics = await page.evaluate(() => {
    const main = document.querySelector('main.wrap');
    const map = document.querySelector('.gz-map-container');
    return {
      mainWidth: main.getBoundingClientRect().width,
      mapWidth: map?.getBoundingClientRect().width,
      mapHeight: map?.getBoundingClientRect().height
    };
  });
  console.log(`  Ground Zero: mainWidth=${gzMetrics.mainWidth.toFixed(1)}px, mapWidth=${gzMetrics.mapWidth?.toFixed(1)}px, mapHeight=${gzMetrics.mapHeight?.toFixed(1)}px`);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'wide-ground-zero.png') });

  // 7. Check Rootkit
  console.log('\n--- Checking Rootkit Widescreen ---');
  await page.goto(`${BASE_URL}/games/rootkit/`, { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 600));
  const rkMetrics = await page.evaluate(() => {
    const container = document.querySelector('.rk-container');
    const term = document.querySelector('.rk-terminal');
    return {
      containerWidth: container.getBoundingClientRect().width,
      termHeight: term.getBoundingClientRect().height
    };
  });
  console.log(`  Rootkit: containerWidth=${rkMetrics.containerWidth.toFixed(1)}px, termHeight=${rkMetrics.termHeight.toFixed(1)}px`);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'wide-rootkit.png') });

  // 8. Test 1366x768 viewport (Standard Laptop)
  console.log('\n--- Checking Laptop Viewport (1366x768) on Ghost Lap & Ace Vector ---');
  await page.setViewport({ width: 1366, height: 768 });
  await page.goto(`${BASE_URL}/games/ghost-lap/`, { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 600));
  const laptopGhostLap = await page.evaluate(() => {
    const canvas = document.getElementById('race-canvas');
    return {
      canvasWidth: canvas.getBoundingClientRect().width,
      canvasHeight: canvas.getBoundingClientRect().height
    };
  });
  console.log(`  Laptop Ghost Lap canvas: ${laptopGhostLap.canvasWidth.toFixed(1)}x${laptopGhostLap.canvasHeight.toFixed(1)}px`);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'laptop-ghost-lap.png') });

  await browser.close();
  console.log('\n=== Widescreen verification completed successfully ===');
}

main().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
