import puppeteer from 'puppeteer-core';

const bravePath = 'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe';

async function main() {
  const browser = await puppeteer.launch({
    executablePath: bravePath,
    headless: true,
    defaultViewport: { width: 1280, height: 850 }
  });

  const page = await browser.newPage();
  await page.goto('http://localhost:5173/games/swarmline/', { waitUntil: 'networkidle0' });

  await page.evaluate(() => {
    const modal = document.getElementById('sl-modal');
    const container = document.getElementById('cards-container');
    const choices = [
      { icon: '📖', typeTag: 'NEW WEAPON', hotkey: 1, title: 'King Bible (NEW)', desc: 'Orbiting sacred books create a protective shield.', statDiff: 'Adds new auto-firing attack slot' },
      { icon: '🥬', typeTag: 'NEW PASSIVE', hotkey: 2, title: 'Spinach (NEW)', desc: 'Increases overall damage dealt by 10% per level.', statDiff: 'Adds passive stat enhancement' },
      { icon: '✨', typeTag: '★ EVOLUTION READY', hotkey: 3, title: 'Holy Wand', desc: 'Zero cooldown continuous stream of holy magic.', statDiff: 'GODLIKE FORM // MAX DAMAGE ASCENSION' }
    ];

    container.innerHTML = choices.map(c => {
      const isEvo = c.typeTag.includes('EVOLUTION');
      return `
        <div class="upgrade-card ${isEvo ? 'is-evo-card' : ''}">
          <div class="card-top">
            <div class="card-icon-frame">
              <span class="card-icon">${c.icon}</span>
              <span class="card-type-tag ${isEvo ? 'tag-evo' : ''}">${c.typeTag}</span>
            </div>
            <span class="card-hotkey">[${c.hotkey}]</span>
          </div>
          <h4 class="card-title">${c.title}</h4>
          <p class="card-desc">${c.desc}</p>
          <div class="card-stat-diff">${c.statDiff}</div>
        </div>
      `;
    }).join('');

    modal.style.display = 'flex';
  });

  await new Promise(r => setTimeout(r, 300));
  await page.screenshot({ path: '.test-screenshots/swarmline-levelup-modal.png' });
  await browser.close();
  console.log('Saved .test-screenshots/swarmline-levelup-modal.png');
}

main();
