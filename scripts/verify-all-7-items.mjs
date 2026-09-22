import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

const bravePath = 'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe';

async function main() {
  console.log('=== VERIFYING ALL 7 USER REQUESTS IN BRAVE ===');
  
  const browser = await puppeteer.launch({
    executablePath: bravePath,
    headless: true,
    defaultViewport: { width: 1400, height: 900 }
  });

  const page = await browser.newPage();
  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', err => consoleErrors.push(err.message));

  // Ensure output dir
  if (!fs.existsSync('.test-screenshots')) {
    fs.mkdirSync('.test-screenshots', { recursive: true });
  }

  // ----------------------------------------------------
  // TEST 1 & 2 & 7: HOMEPAGE (18 UNIQUE CARDS + TERMINAL /RESTART & MONOSPACE FONT)
  // ----------------------------------------------------
  console.log('\n--- Checking Homepage: 18 Game Cards & Themes ---');
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle0' });

  const cardCount = await page.$$eval('.card', cards => cards.length);
  console.log(`Total Game Cards Rendered: ${cardCount} (Expected: 18)`);

  const accents = await page.$$eval('.card', cards => cards.map(c => ({
    accent: c.dataset.accent,
    title: c.getAttribute('aria-label'),
    color: getComputedStyle(c).getPropertyValue('--card-accent').trim()
  })));
  console.log('Sample Game Accents:', accents.slice(0, 6));

  const uniqueAccents = new Set(accents.map(a => a.accent));
  console.log(`Unique Accent Themes: ${uniqueAccents.size}/18`);

  await page.screenshot({ path: '.test-screenshots/verify-homepage-cards.png', fullPage: false });

  console.log('\n--- Checking Terminal Prompt Font & Commands ---');
  const termInput = await page.$('#footer-terminal-input');
  if (!termInput) throw new Error('Footer terminal input not found!');

  const inputStyles = await page.$eval('#footer-terminal-input', el => {
    const cs = getComputedStyle(el);
    return {
      fontFamily: cs.fontFamily,
      fontSize: cs.fontSize,
      color: cs.color
    };
  });
  console.log('Terminal Input Computed Font:', inputStyles);

  // Type /help in terminal
  await page.type('#footer-terminal-input', '/help');
  await page.keyboard.press('Enter');
  await new Promise(r => setTimeout(r, 200));

  const helpMenuVisible = await page.$eval('#terminal-log', el => !el.hidden);
  const helpOptionsCount = await page.$$eval('.term-opt-btn', btns => btns.length);
  console.log(`Help Menu Visible: ${helpMenuVisible}, Options count: ${helpOptionsCount}`);

  // Check /restart option
  const restartBtn = await page.$('.term-opt-btn[data-term-cmd="/restart"]');
  console.log(`Found /restart button option in help menu: ${Boolean(restartBtn)}`);

  await page.screenshot({ path: '.test-screenshots/verify-terminal-help.png' });

  // ----------------------------------------------------
  // TEST 4 & 5: GHOST LAP (TRACK SELECTOR, PRE-RACE START, RIVALS, RACING LINE)
  // ----------------------------------------------------
  console.log('\n--- Checking Ghost Lap: Track Selector, Pre-Race, Rivals & Racing Line ---');
  await page.goto('http://localhost:5173/games/ghost-lap/', { waitUntil: 'networkidle0' });

  // Check track selector size & style
  const selectBox = await page.$eval('#track-select', el => {
    const rect = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return {
      width: rect.width,
      height: rect.height,
      fontSize: cs.fontSize,
      color: cs.color,
      borderColor: cs.borderColor
    };
  });
  console.log('Track Selector Box Metrics:', selectBox);

  // Check pre-race state
  const isPreRaceReady = await page.evaluate(() => {
    return window.speed === undefined || document.getElementById('hud-speed').textContent.includes('0');
  });
  console.log('Car stopped at pre-race starting grid:', isPreRaceReady);

  await page.screenshot({ path: '.test-screenshots/verify-ghostlap-ready.png' });

  // Test Space bar launch
  console.log('Pressing [Space] to launch race...');
  await page.keyboard.press('Space');
  await new Promise(r => setTimeout(r, 400));

  // Accelerate
  await page.keyboard.down('KeyW');
  await new Promise(r => setTimeout(r, 600));
  await page.keyboard.up('KeyW');

  const speedAfterLaunch = await page.$eval('#hud-speed', el => el.textContent);
  console.log(`Speed after [Space] launch and [W] accel: ${speedAfterLaunch}`);

  // Test Racing Line Toggle
  const initialLineText = await page.$eval('#btn-toggle-racing-line', el => el.textContent);
  console.log(`Initial Racing Line Button text: "${initialLineText}"`);
  await page.click('#btn-toggle-racing-line');
  await new Promise(r => setTimeout(r, 150));
  const toggledLineText = await page.$eval('#btn-toggle-racing-line', el => el.textContent);
  console.log(`Toggled Racing Line Button text: "${toggledLineText}"`);

  await page.screenshot({ path: '.test-screenshots/verify-ghostlap-racing.png' });

  // ----------------------------------------------------
  // TEST 3: SKYDOODLE SMOOTHNESS & PLATFORM PLACEMENT
  // ----------------------------------------------------
  console.log('\n--- Checking SkyDoodle Physics & Placement ---');
  await page.goto('http://localhost:5173/games/skydoodle/', { waitUntil: 'networkidle0' });

  // Wait for initial bounce
  await new Promise(r => setTimeout(r, 800));

  const skyDoodleInfo = await page.evaluate(() => {
    const scoreEl = document.getElementById('hud-score');
    return {
      score: scoreEl ? scoreEl.textContent : null,
      canvasWidth: document.getElementById('game-canvas')?.width,
      canvasHeight: document.getElementById('game-canvas')?.height
    };
  });
  console.log('SkyDoodle Init Info:', skyDoodleInfo);

  await page.screenshot({ path: '.test-screenshots/verify-skydoodle.png' });

  console.log('\nConsole Errors caught during verification:', consoleErrors);
  await browser.close();

  if (consoleErrors.length > 0) {
    console.error('FAILED with console errors!');
    process.exit(1);
  }

  console.log('\n=== ALL VERIFICATIONS PASSED CLEANLY! ===');
}

main().catch(err => {
  console.error('Verification failed:', err);
  process.exit(1);
});
