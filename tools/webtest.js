const { chromium } = require('playwright'); const path = require('path');
const T = ms => new Promise(r => setTimeout(r, ms)); const URL = process.env.BF_URL || 'http://localhost:3077/';
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } }); const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(URL); await page.waitForSelector('#nav'); await T(300);
  if (await page.$('#tbGo')) await page.click('#tbGo');
  console.log('sync badge:', await page.$eval('#sync', e => e.textContent));
  await page.evaluate(() => Actions.showScreen('account')); await T(200);
  await page.evaluate(() => { acctMode = 'register'; UI.refresh(); }); await T(200);
  await page.fill('input[name=name]', 'Grandpa'); await page.fill('input[name=email]', 'grandpa@example.com'); await page.fill('input[name=password]', 'baseball77');
  await page.click('#acctForm button[type=submit]'); await T(800);
  console.log('after register: user =', await page.evaluate(() => Net.user && Net.user.name), '| badge:', await page.$eval('#sync', e => e.textContent));
  await page.screenshot({ path: path.join(__dirname, '..', 'shot_account0.png') });
  // play: load teams and sim a game
  await page.evaluate(() => { O['Warm-up tosses'] = 'Off'; }); await page.click('button.primary'); await page.waitForSelector('#field'); await T(300);
  await page.evaluate(() => { Actions.simGame(); });
  for (let i = 0; i < 80; i++) { await T(200); if (await page.evaluate(() => G.over && !busy)) break; }
  await T(2500);
  await page.evaluate(() => { const b = document.querySelector('#sumClose'); if (b) b.click(); });
  const me = await page.evaluate(() => fetch('/api/me').then(r => r.json())); console.log('server /api/me:', JSON.stringify(me));
  const games = await page.evaluate(() => fetch('/api/games').then(r => r.json())); console.log('games stored:', games.total, games.games[0] && (games.games[0].away + ' ' + games.games[0].away_runs + ', ' + games.games[0].home + ' ' + games.games[0].home_runs + ' W: ' + games.games[0].winning_pitcher));
  const detail = await page.evaluate(() => fetch('/api/games/1').then(r => r.json())); console.log('detail: batting lines', detail.batting.length, 'pitching', detail.pitching.length, 'PAs', detail.plate_appearances.length, 'first PA', JSON.stringify(detail.plate_appearances[0]).slice(0, 120));
  const bat = await page.evaluate(() => fetch('/api/stats/batting').then(r => r.json())); console.log('batting totals rows', bat.rows.length, 'top:', bat.rows[0].name, bat.rows[0].h, 'H');
  await page.evaluate(() => Actions.showScreen('account')); await T(200); await page.evaluate(() => Actions.acctLoadStats()); await T(600);
  await page.screenshot({ path: path.join(__dirname, '..', 'shot_account.png'), fullPage: true });
  // reload: still signed in, season intact
  await page.reload(); await page.waitForSelector('#nav'); await T(600);
  console.log('after reload: user', await page.evaluate(() => Net.user && Net.user.name), 'results', await page.evaluate(() => S.results.length), 'over', await page.evaluate(() => G.over));
  // a second, fresh browser: sign in and get the same season
  const ctx2 = await browser.newContext({ viewport: { width: 1600, height: 1000 } }); const p2 = await ctx2.newPage();
  await p2.goto(URL); await p2.waitForSelector('#nav'); await T(300); if (await p2.$('#tbGo')) await p2.click('#tbGo');
  console.log('fresh browser before login: results', await p2.evaluate(() => S.results.length));
  await p2.evaluate(() => Actions.showScreen('account')); await T(200);
  await p2.fill('input[name=email]', 'grandpa@example.com'); await p2.fill('input[name=password]', 'baseball77'); await p2.click('#acctForm button[type=submit]'); await T(1000);
  console.log('fresh browser after login: results', await p2.evaluate(() => S.results.length), 'teams', await p2.evaluate(() => G.teams.join('@')), 'screen', await p2.evaluate(() => curScreen));
  // wrong password
  await p2.evaluate(() => Actions.acctLogout()); await T(300); await p2.evaluate(() => Actions.showScreen('account')); await T(200);
  await p2.fill('input[name=email]', 'grandpa@example.com'); await p2.fill('input[name=password]', 'nope'); await p2.click('#acctForm button[type=submit]'); await T(500);
  console.log('wrong password message:', await p2.$eval('#acctErr', e => e.textContent));
  console.log('errors:', errors.join('|') || 'none'); await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
