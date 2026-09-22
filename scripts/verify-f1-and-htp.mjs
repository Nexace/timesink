import puppeteer from 'puppeteer-core';

const BRAVE_PATH = 'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe';
const BASE_URL = 'http://localhost:5173';

const F1_TRACKS = [
  { id: 'monza', name: 'Monza' },
  { id: 'spa', name: 'Spa-Francorchamps' },
  { id: 'silverstone', name: 'Silverstone' },
  { id: 'monaco', name: 'Circuit de Monaco' },
  { id: 'suzuka', name: 'Suzuka' },
  { id: 'interlagos', name: 'Interlagos' },
  { id: 'redbullring', name: 'Red Bull Ring' },
  { id: 'montreal', name: 'Montreal' }
];

async function main() {
  console.log('=== VERIFYING F1 CIRCUITS & UNIVERSAL HOW-TO-PLAY WIDGET ===');

  const browser = await puppeteer.launch({
    executablePath: BRAVE_PATH,
    headless: true,
    defaultViewport: { width: 1280, height: 850 }
  });

  const page = await browser.newPage();
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
      console.error('  [Browser Error]:', msg.text());
    }
  });

  // --- 1. Test Ghost Lap F1 Tracks ---
  console.log('\n--- 1. Testing Ghost Lap F1 Circuits ---');
  await page.goto(`${BASE_URL}/games/ghost-lap/`, { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 600));

  const selectOptions = await page.evaluate(() => {
    const select = document.getElementById('track-select');
    return Array.from(select.querySelectorAll('option')).map(o => o.value);
  });
  console.log(`  Found ${selectOptions.length} track options in dropdown.`);

  for (const t of F1_TRACKS) {
    if (!selectOptions.includes(t.id)) {
      throw new Error(`F1 track '${t.id}' (${t.name}) missing from track selector`);
    }
    console.log(`  ✓ Track '${t.id}' (${t.name}) found in selector`);
  }

  // Switch to each F1 track, verify car start and state
  for (const t of F1_TRACKS) {
    await page.select('#track-select', t.id);
    await new Promise(r => setTimeout(r, 200));

    const state = await page.evaluate(() => {
      const select = document.getElementById('track-select');
      const speed = document.getElementById('hud-speed').textContent;
      const status = document.getElementById('hud-brake-status').textContent;
      return { val: select.value, speed, status };
    });

    if (state.val !== t.id) {
      throw new Error(`Expected selected track '${t.id}', got '${state.val}'`);
    }
  }
  console.log(`  ✓ Successfully switched and initialized all 8 F1 tracks!`);

  // Select Monza, accelerate and test drive
  await page.select('#track-select', 'monza');
  await new Promise(r => setTimeout(r, 300));
  await page.keyboard.down('KeyW');
  await new Promise(r => setTimeout(r, 600));
  await page.keyboard.up('KeyW');

  const monzaSpeed = await page.evaluate(() => document.getElementById('hud-speed').textContent);
  console.log(`  Monza test drive: accelerated to ${monzaSpeed}`);
  await page.screenshot({ path: '.test-screenshots/ghost-lap-f1-monza.png' });

  // Select Spa, screenshot
  await page.select('#track-select', 'spa');
  await new Promise(r => setTimeout(r, 300));
  await page.screenshot({ path: '.test-screenshots/ghost-lap-f1-spa.png' });

  // Select Suzuka, screenshot
  await page.select('#track-select', 'suzuka');
  await new Promise(r => setTimeout(r, 300));
  await page.screenshot({ path: '.test-screenshots/ghost-lap-f1-suzuka.png' });

  // --- 2. Test Universal Bottom-Right How to Play Widget ---
  console.log('\n--- 2. Testing How to Play Widget (Ghost Lap) ---');
  const htpInfo = await page.evaluate(() => {
    const w = document.getElementById('how-to-play-widget');
    if (!w) return null;
    const style = window.getComputedStyle(w);
    const title = w.querySelector('.htp-title')?.textContent;
    const goal = w.querySelector('.htp-goal .htp-text')?.textContent;
    const stepsCount = w.querySelectorAll('.htp-steps li').length;
    const tip = w.querySelector('.htp-tip-text')?.textContent;
    const isCollapsed = w.classList.contains('is-collapsed');
    return {
      exists: true,
      position: style.position,
      right: style.right,
      bottom: style.bottom,
      title,
      goal,
      stepsCount,
      tip,
      isCollapsed
    };
  });

  if (!htpInfo) throw new Error('How-to-play widget not found in DOM');
  console.log(`  Widget detected at: position=${htpInfo.position}, right=${htpInfo.right}, bottom=${htpInfo.bottom}`);
  console.log(`  Title: "${htpInfo.title}"`);
  console.log(`  Goal: "${htpInfo.goal}"`);
  console.log(`  Steps count: ${htpInfo.stepsCount}, Tip present: ${Boolean(htpInfo.tip)}`);

  if (htpInfo.position !== 'fixed' || htpInfo.stepsCount < 2) {
    throw new Error('How to Play widget missing expected styles or steps');
  }

  await page.screenshot({ path: '.test-screenshots/htp-ghost-lap-open.png' });

  // Test close / collapse
  console.log('  Testing collapse / expand interaction...');
  await page.click('.htp-close-btn');
  await new Promise(r => setTimeout(r, 200));

  const collapsedState = await page.evaluate(() => {
    const w = document.getElementById('how-to-play-widget');
    const panel = document.getElementById('htp-panel');
    return {
      hasCollapsedClass: w.classList.contains('is-collapsed'),
      panelHidden: panel.hasAttribute('hidden') || window.getComputedStyle(panel).display === 'none'
    };
  });
  console.log(`  Collapsed state: hasClass=${collapsedState.hasCollapsedClass}, panelHidden=${collapsedState.panelHidden}`);
  if (!collapsedState.hasCollapsedClass || !collapsedState.panelHidden) {
    throw new Error('How-to-play widget failed to collapse properly');
  }

  await page.screenshot({ path: '.test-screenshots/htp-ghost-lap-collapsed.png' });

  // Test expand via toggle button
  await page.click('.htp-toggle-btn');
  await new Promise(r => setTimeout(r, 200));
  const expandedState = await page.evaluate(() => {
    const w = document.getElementById('how-to-play-widget');
    return !w.classList.contains('is-collapsed');
  });
  console.log(`  Expanded state: ${expandedState}`);
  if (!expandedState) throw new Error('Failed to expand How-to-play widget');

  // --- 3. Test How to Play on other games ---
  console.log('\n--- 3. Testing How to Play on other games ---');
  const sampleGames = ['mars-base', 'rootkit', 'redlight', 'scale-jump'];
  for (const slug of sampleGames) {
    await page.goto(`${BASE_URL}/games/${slug}/`, { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 400));
    const gameHtp = await page.evaluate(() => {
      const w = document.getElementById('how-to-play-widget');
      return {
        exists: Boolean(w),
        title: w?.querySelector('.htp-title')?.textContent,
        goal: w?.querySelector('.htp-goal .htp-text')?.textContent
      };
    });
    console.log(`  Game: ${slug} -> Widget: ${gameHtp.exists}, Title: "${gameHtp.title}"`);
    if (!gameHtp.exists || !gameHtp.title || !gameHtp.goal) {
      throw new Error(`How to play widget failed on ${slug}`);
    }
  }

  // --- 4. Verify Homepage does not show How to Play widget ---
  console.log('\n--- 4. Verifying Homepage does not display in-game How-to-Play widget ---');
  await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 400));
  const homeHtpExists = await page.evaluate(() => Boolean(document.getElementById('how-to-play-widget')));
  console.log(`  Homepage has how-to-play widget: ${homeHtpExists} (Expected: false)`);
  if (homeHtpExists) {
    throw new Error('How-to-play widget should only appear when in game, not on homepage');
  }

  if (errors.length > 0) {
    throw new Error(`Console errors encountered: ${errors.join(', ')}`);
  }

  await browser.close();
  console.log('\n=== ALL F1 CIRCUITS & HOW-TO-PLAY TESTS PASSED! ===');
}

main().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
