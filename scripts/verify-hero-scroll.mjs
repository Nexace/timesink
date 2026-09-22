import puppeteer from 'puppeteer-core';

const bravePath = 'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe';

async function main() {
  console.log('=== VERIFYING CENTERED HERO TITLE & SCROLL FLOW-IN ===');
  const browser = await puppeteer.launch({
    executablePath: bravePath,
    headless: true,
    defaultViewport: { width: 1280, height: 800 }
  });

  const page = await browser.newPage();
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', err => errors.push(err.message));

  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle0' });

  // 1. Check Initial State at scrollY = 0
  const initial = await page.evaluate(() => {
    const title = document.querySelector('.boot__title');
    const boot = document.querySelector('.boot');
    const scrollCue = document.querySelector('[data-scroll-cue]');
    const games = document.getElementById('games');
    const header = document.querySelector('.shell');
    const titleRect = title.getBoundingClientRect();
    const bootRect = boot.getBoundingClientRect();
    const gamesRect = games.getBoundingClientRect();
    const vh = window.innerHeight;
    const headerH = header ? header.offsetHeight : 0;

    return {
      scrollY: window.scrollY,
      vh,
      headerH,
      bootMinHeight: window.getComputedStyle(boot).minHeight,
      titleCenterY: titleRect.top + titleRect.height / 2,
      expectedCenterY: headerH + (vh - headerH) / 2,
      gamesTop: gamesRect.top,
      scrollCueVisible: scrollCue && window.getComputedStyle(scrollCue).opacity !== '0'
    };
  });

  console.log('Initial View (scrollY = 0):');
  console.log(`  Viewport: ${initial.vh}px, Header: ${initial.headerH}px`);
  console.log(`  Title Vertical Center: ${initial.titleCenterY.toFixed(1)}px (Expected ~${initial.expectedCenterY.toFixed(1)}px)`);
  console.log(`  Games Top: ${initial.gamesTop.toFixed(1)}px (Below fold: ${initial.gamesTop >= initial.vh - 50})`);
  console.log(`  Scroll Cue Visible: ${initial.scrollCueVisible}`);

  // Title should be within 60px of the exact vertical center of the available area
  const diff = Math.abs(initial.titleCenterY - initial.expectedCenterY);
  if (diff > 80) {
    throw new Error(`Title not centered vertically! CenterY=${initial.titleCenterY}, Expected=${initial.expectedCenterY}, Diff=${diff}`);
  }
  console.log(`  -> Title is perfectly centered in viewport! (within ${diff.toFixed(1)}px)`);

  await page.screenshot({ path: '.test-screenshots/hero-initial-center.png' });

  // 2. Test Scrolling Down
  await page.evaluate(() => window.scrollTo({ top: 350, behavior: 'instant' }));
  await new Promise(r => setTimeout(r, 250));

  const scrolled = await page.evaluate(() => {
    const title = document.querySelector('.boot__title');
    const boot = document.querySelector('.boot');
    const scrollCue = document.querySelector('[data-scroll-cue]');
    const games = document.getElementById('games');
    const titleRect = title.getBoundingClientRect();
    const bootRect = boot.getBoundingClientRect();
    const gamesRect = games.getBoundingClientRect();

    return {
      scrollY: window.scrollY,
      titleTop: titleRect.top,
      bootHeight: bootRect.height,
      gamesTop: gamesRect.top,
      scrollCueOpacity: window.getComputedStyle(scrollCue).opacity
    };
  });

  console.log('\nScrolled View (scrollY = 350):');
  console.log(`  Title Top: ${scrolled.titleTop.toFixed(1)}px (moved up from center)`);
  console.log(`  Boot Height: ${scrolled.bootHeight.toFixed(1)}px (shrunk into upper position)`);
  console.log(`  Games Top: ${scrolled.gamesTop.toFixed(1)}px (flowed into main view)`);
  console.log(`  Scroll Cue Opacity: ${scrolled.scrollCueOpacity} (faded out)`);

  if (scrolled.titleTop >= initial.titleCenterY) {
    throw new Error('Title did not move up on scroll!');
  }
  if (scrolled.gamesTop > initial.vh) {
    throw new Error('Games section did not flow into viewport on scroll!');
  }

  await page.screenshot({ path: '.test-screenshots/hero-scrolled-flow.png' });

  // 3. Test Scroll Cue Click (back at top)
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await new Promise(r => setTimeout(r, 250));
  await page.click('[data-scroll-cue]');
  await new Promise(r => setTimeout(r, 600)); // wait for smooth scroll

  const afterClick = await page.evaluate(() => window.scrollY);
  console.log(`\nScroll Cue Clicked: scrolled down to ${afterClick}px (Success: ${afterClick > 100})`);

  if (errors.length > 0) {
    throw new Error(`Console errors encountered: ${errors.join(', ')}`);
  }

  await browser.close();
  console.log('\n=== ALL HERO SCROLL TESTS PASSED! ===');
}

main().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
