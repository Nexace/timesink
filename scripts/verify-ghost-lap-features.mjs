import puppeteer from 'puppeteer-core';

const bravePath = 'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe';

async function main() {
  console.log('=== VERIFYING GHOST LAP BRAKING, CONTROLS & TRACK BUILDER ===');
  const browser = await puppeteer.launch({
    executablePath: bravePath,
    headless: true,
    defaultViewport: { width: 1280, height: 850 }
  });

  const page = await browser.newPage();
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', err => errors.push(err.message));

  await page.goto('http://localhost:5173/games/ghost-lap/', { waitUntil: 'networkidle0' });

  // ----------------------------------------------------
  // 1. TEST BRAKING MECHANIC
  // ----------------------------------------------------
  console.log('\n--- 1. Testing Braking Mechanic ---');
  // Accelerate forward for 700ms
  await page.keyboard.down('KeyW');
  await new Promise(r => setTimeout(r, 700));
  await page.keyboard.up('KeyW');

  const speedBeforeBrake = await page.evaluate(() => {
    return document.getElementById('hud-speed').textContent;
  });
  console.log(`  Accelerated to: ${speedBeforeBrake}`);

  // Slam brakes with KeyS
  await page.keyboard.down('KeyS');
  await new Promise(r => setTimeout(r, 80));

  const brakeStatus = await page.evaluate(() => {
    const el = document.getElementById('hud-brake-status');
    return {
      text: el.textContent,
      className: el.className
    };
  });
  console.log(`  Brake Status while braking: "${brakeStatus.text}" (class: ${brakeStatus.className})`);

  if (!brakeStatus.className.includes('status--braking')) {
    throw new Error(`Expected status--braking class, got: ${brakeStatus.className}`);
  }

  // Take screenshot while active braking
  await page.screenshot({ path: '.test-screenshots/ghost-lap-braking.png' });

  // Keep holding until stopped and shifted to reverse
  await new Promise(r => setTimeout(r, 900));
  const revStatus = await page.evaluate(() => {
    const el = document.getElementById('hud-brake-status');
    return {
      text: el.textContent,
      className: el.className
    };
  });
  console.log(`  Status after complete halt: "${revStatus.text}" (class: ${revStatus.className})`);
  await page.keyboard.up('KeyS');

  if (revStatus.text !== 'REVERSE') {
    throw new Error(`Expected REVERSE gear after stopping, got: ${revStatus.text}`);
  }
  console.log('  -> Active braking and reverse gear shift verified successfully!');

  // ----------------------------------------------------
  // 2. TEST CONTROLS MODAL & REBINDING
  // ----------------------------------------------------
  console.log('\n--- 2. Testing Controls Modal & Key Rebinding ---');
  await page.click('#btn-controls');
  await new Promise(r => setTimeout(r, 200));

  const modalOpen = await page.evaluate(() => {
    const modal = document.getElementById('modal-controls');
    return window.getComputedStyle(modal).display !== 'none';
  });
  console.log(`  Controls Modal Opened: ${modalOpen}`);
  if (!modalOpen) throw new Error('Controls modal failed to open');

  // Test preset click
  await page.click('[data-preset="arrows"]');
  await new Promise(r => setTimeout(r, 150));

  const accelKeyArrow = await page.evaluate(() => {
    const badge = document.querySelector('[data-action="accel"]');
    return badge.textContent.trim();
  });
  console.log(`  Accel Key after ARROWS preset: "${accelKeyArrow}"`);
  if (!accelKeyArrow.includes('UP')) {
    throw new Error(`Expected UP arrow after arrows preset, got: ${accelKeyArrow}`);
  }

  // Test manual rebinding: click brake badge and press 'X'
  await page.click('[data-action="brake"]');
  await new Promise(r => setTimeout(r, 100));
  await page.keyboard.press('KeyX');
  await new Promise(r => setTimeout(r, 150));

  const brakeKeyRebound = await page.evaluate(() => {
    const badge = document.querySelector('[data-action="brake"]');
    return badge.textContent.trim();
  });
  console.log(`  Brake Key after rebinding to X: "${brakeKeyRebound}"`);
  if (brakeKeyRebound !== 'X') {
    throw new Error(`Expected 'X' for brake key, got: ${brakeKeyRebound}`);
  }

  // Adjust steering sensitivity
  await page.evaluate(() => {
    const input = document.getElementById('input-steer-sens');
    input.value = '125';
    input.dispatchEvent(new Event('input'));
  });
  const sensText = await page.evaluate(() => document.getElementById('val-steer-sens').textContent);
  console.log(`  Steering Sensitivity adjusted to: ${sensText}`);

  await page.screenshot({ path: '.test-screenshots/ghost-lap-controls-modal.png' });

  // Save & close
  await page.click('#btn-save-controls');
  await new Promise(r => setTimeout(r, 200));

  const modalClosed = await page.evaluate(() => {
    const modal = document.getElementById('modal-controls');
    return window.getComputedStyle(modal).display === 'none';
  });
  console.log(`  Controls Modal Closed: ${modalClosed}`);

  // Verify on-screen hint updated
  const hintText = await page.evaluate(() => document.getElementById('gl-controls-hint').textContent);
  console.log(`  On-screen hint dynamically updated: "${hintText.replace(/\s+/g, ' ').trim()}"`);
  if (!hintText.includes('X')) {
    throw new Error('On-screen hint did not update with new X brake binding');
  }

  // ----------------------------------------------------
  // 3. TEST TRACK EDITOR & TRACK BUILDING GUIDE
  // ----------------------------------------------------
  console.log('\n--- 3. Testing Track Editor & Building Guide ---');
  await page.click('#btn-editor');
  await new Promise(r => setTimeout(r, 200));

  const editorOpen = await page.evaluate(() => {
    const aside = document.getElementById('editor-aside');
    return window.getComputedStyle(aside).display !== 'none';
  });
  console.log(`  Track Editor Opened: ${editorOpen}`);

  // Check guide is present
  const guideSteps = await page.evaluate(() => {
    const steps = document.querySelectorAll('.guide-step');
    return steps.length;
  });
  console.log(`  Track Building Guide Steps visible: ${guideSteps} (Expected: 4)`);
  if (guideSteps !== 4) throw new Error(`Expected 4 guide steps, found ${guideSteps}`);

  // Clear track
  await page.click('#btn-clear-track');
  await new Promise(r => setTimeout(r, 100));

  const pointsAfterClear = await page.evaluate(() => {
    return document.getElementById('editor-points-count').textContent;
  });
  console.log(`  Points after clear: ${pointsAfterClear}`);

  // Click canvas 4 times to place circuit nodes
  const canvasEl = await page.$('#race-canvas');
  await canvasEl.scrollIntoView();
  await new Promise(r => setTimeout(r, 100));

  await canvasEl.click({ offset: { x: 150, y: 100 } });
  await canvasEl.click({ offset: { x: 500, y: 100 } });
  await canvasEl.click({ offset: { x: 500, y: 350 } });
  await canvasEl.click({ offset: { x: 150, y: 350 } });
  await new Promise(r => setTimeout(r, 150));

  const pointsAfterAdd = await page.evaluate(() => {
    return document.getElementById('editor-points-count').textContent;
  });
  console.log(`  Points after adding 4 nodes: ${pointsAfterAdd}`);
  if (!pointsAfterAdd.includes('4 / MIN 4')) {
    throw new Error(`Expected 4 nodes, got: ${pointsAfterAdd}`);
  }

  // Test UNDO point
  await page.click('#btn-undo-track');
  await new Promise(r => setTimeout(r, 100));
  const pointsAfterUndo = await page.evaluate(() => {
    return document.getElementById('editor-points-count').textContent;
  });
  console.log(`  Points after UNDO: ${pointsAfterUndo}`);
  if (!pointsAfterUndo.includes('3 / MIN 4')) {
    throw new Error(`Expected 3 nodes after undo, got: ${pointsAfterUndo}`);
  }

  // Re-add 4th point
  await canvasEl.click({ offset: { x: 150, y: 350 } });
  await new Promise(r => setTimeout(r, 150));

  await page.screenshot({ path: '.test-screenshots/ghost-lap-track-editor.png' });

  // Test Test Drive button
  await page.click('#btn-test-drive');
  await new Promise(r => setTimeout(r, 300));

  const inTestDrive = await page.evaluate(() => {
    const aside = document.getElementById('editor-aside');
    const select = document.getElementById('track-select');
    return {
      editorClosed: window.getComputedStyle(aside).display === 'none',
      trackSelected: select.value
    };
  });
  console.log(`  Test Drive Launched: editorClosed=${inTestDrive.editorClosed}, trackSelected=${inTestDrive.trackSelected}`);
  if (!inTestDrive.editorClosed || inTestDrive.trackSelected !== 'custom') {
    throw new Error('Test drive mode failed to launch custom circuit');
  }

  if (errors.length > 0) {
    throw new Error(`Console errors during test: ${errors.join(', ')}`);
  }

  await browser.close();
  console.log('\n=== ALL GHOST LAP FEATURE TESTS PASSED! ===');
}

main().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
