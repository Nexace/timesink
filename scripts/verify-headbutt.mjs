import puppeteer from 'puppeteer-core';
import { mkdir, copyFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BRAVE = 'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe';
const BASE = 'http://localhost:5173';
const OUT = join(__dirname, '..', '.verify-headbutt');
const ARTIFACT_DIR = 'C:/Users/Amogh Khairate/.gemini/antigravity/brain/127ba319-c802-464c-9981-3931c3b634d6';

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await puppeteer.launch({
    executablePath: BRAVE,
    headless: true,
    args: ['--no-sandbox', '--disable-gpu'],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });

    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

    const pressKey = async (code) => {
      await page.evaluate((c) => {
        window.dispatchEvent(new KeyboardEvent('keydown', { code: c, bubbles: true }));
        window.dispatchEvent(new KeyboardEvent('keyup', { code: c, bubbles: true }));
      }, code);
    };

    const holdKey = async (code, ms) => {
      await page.evaluate((c) => {
        window.dispatchEvent(new KeyboardEvent('keydown', { code: c, bubbles: true }));
      }, code);
      await new Promise(r => setTimeout(r, ms));
      await page.evaluate((c) => {
        window.dispatchEvent(new KeyboardEvent('keyup', { code: c, bubbles: true }));
      }, code);
    };

    // 1. Navigate to HEADBUTT
    console.log('Navigating to HEADBUTT...');
    await page.goto(`${BASE}/games/headbutt/`, { waitUntil: 'networkidle2', timeout: 15000 });

    const canvas = await page.$('#hb-canvas');
    if (!canvas) throw new Error('Canvas #hb-canvas not found');
    console.log('✓ Canvas found');

    const hasMatter = await page.evaluate(() => typeof Matter !== 'undefined');
    if (!hasMatter) throw new Error('Matter.js not loaded');
    console.log('✓ Matter.js loaded');

    // Wait for Garage UI to render
    await new Promise(r => setTimeout(r, 1200));
    const shotGarage = join(OUT, 'headbutt-garage-wide.png');
    await page.screenshot({ path: shotGarage });
    await copyFile(shotGarage, join(ARTIFACT_DIR, 'headbutt-garage-wide.png')).catch(() => {});
    console.log('✓ Screenshot 1: headbutt-garage-wide.png');

    // 2. Play Cyber Stadium (The Bump)
    console.log('Testing Cyber Stadium match...');
    await pressKey('Space'); // Start match
    await new Promise(r => setTimeout(r, 3400)); // Wait for countdown to finish

    // Drive right toward center jump hill
    console.log('Driving right up launch wedges...');
    await holdKey('KeyD', 1400);
    await new Promise(r => setTimeout(r, 400));

    const shotCyber = join(OUT, 'headbutt-cyber-stadium.png');
    await page.screenshot({ path: shotCyber });
    await copyFile(shotCyber, join(ARTIFACT_DIR, 'headbutt-cyber-stadium.png')).catch(() => {});
    console.log('✓ Screenshot 2: headbutt-cyber-stadium.png');

    // Return to Garage via KeyG
    await pressKey('KeyG');
    await new Promise(r => setTimeout(r, 800));

    // 3. Test Magma Caverns (Volcano = Digit 3)
    console.log('Selecting Magma Caverns (Arena 3 via Digit3)...');
    await pressKey('Digit3');
    await new Promise(r => setTimeout(r, 400));
    await pressKey('Space'); // Start match
    await new Promise(r => setTimeout(r, 3400)); // Wait past countdown

    // Drive on basalt ledge
    console.log('Driving on basalt ledge...');
    await holdKey('KeyD', 1000);
    await new Promise(r => setTimeout(r, 300));

    const shotVolcano = join(OUT, 'headbutt-magma-caverns.png');
    await page.screenshot({ path: shotVolcano });
    await copyFile(shotVolcano, join(ARTIFACT_DIR, 'headbutt-magma-caverns.png')).catch(() => {});
    console.log('✓ Screenshot 3: headbutt-magma-caverns.png');

    // Return to Garage via KeyG
    await pressKey('KeyG');
    await new Promise(r => setTimeout(r, 800));

    // 4. Test Demolition Derby (Arena 8 = Digit 8)
    console.log('Selecting Demolition Derby (Arena 8 via Digit8)...');
    await pressKey('Digit8');
    await new Promise(r => setTimeout(r, 400));
    await pressKey('Space');
    await new Promise(r => setTimeout(r, 3400));

    // Drive into explosive TNT barrels
    console.log('Driving into TNT barrels...');
    await holdKey('KeyD', 1200);
    await new Promise(r => setTimeout(r, 400));

    const shotDerby = join(OUT, 'headbutt-demolition-derby.png');
    await page.screenshot({ path: shotDerby });
    await copyFile(shotDerby, join(ARTIFACT_DIR, 'headbutt-demolition-derby.png')).catch(() => {});
    console.log('✓ Screenshot 4: headbutt-demolition-derby.png');

    console.log('\n✅ All verification tests completed successfully!');
  } finally {
    await browser.close();
  }
}

main().catch(err => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});
