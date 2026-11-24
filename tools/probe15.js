const { chromium } = require('playwright'); const path = require('path'); const T = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await chromium.launch(); const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('file://' + path.resolve(__dirname, '..', 'BallFive_1977.html')); await page.waitForSelector('#nav');
  if (await page.$('#tbGo')) await page.click('#tbGo');
  await page.click('button.primary'); await page.waitForSelector('#field'); await T(200);
  console.log('intro?', await page.evaluate(() => G.intro), 'button:', await page.$eval('button.primary', e => e.textContent));
  await page.evaluate(() => { Actions.primary(); }); await T(2500);
  await page.screenshot({ path: path.join(__dirname, '..', 'shot_announce.png'), clip: { x: 250, y: 90, width: 1000, height: 700 } });
  await page.evaluate(() => document.querySelector('#popHost .pop').click()); await T(600);
  console.log('after skip: intro', await page.evaluate(() => G.intro), 'pregame', await page.evaluate(() => G.pregame), 'busy', await page.evaluate(() => busy));
  // sim several games so the paper, race and awards have material
  for (let g = 0; g < 6; g++) { await page.evaluate(() => { G.intro = 0; Actions.simGame(); }); for (let i = 0; i < 80; i++) { await T(150); if (await page.evaluate(() => G.over && !busy)) break; } await T(1200); await page.evaluate(() => { const b = document.querySelector('#sumClose'); if (b) b.click(); }); }
  console.log('papers', await page.evaluate(() => Object.keys(S.papers).length), 'results', await page.evaluate(() => S.results.length));
  for (const [s, f] of [['paper', 'shot_paper.png'], ['standings', 'shot_race.png'], ['leaders', 'shot_awards.png'], ['cards', 'shot_cards.png'], ['parks', 'shot_parks.png']]) { await page.evaluate(k => Actions.showScreen(k), s); await T(300); await page.screenshot({ path: path.join(__dirname, '..', f), fullPage: s !== 'cards' }); }
  console.log('errors:', errors.join('|') || 'none'); await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
