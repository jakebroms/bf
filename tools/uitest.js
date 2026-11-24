// Browser test: load the bundled HTML, start a game, drive it through the DOM with step logging.
const { chromium } = require('playwright');
const path = require('path');
const T = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1500, height: 1100 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message + '\n' + (e.stack || '').split('\n').slice(1, 4).join('\n')));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text().split('\n').slice(0, 4).join('\n')); });
  await page.goto('file://' + path.resolve(__dirname, '..', 'BallFive_1977.html'));
  await page.waitForSelector('#nav');
  if (await page.$('#tbGo')) await page.click('#tbGo');
  await page.screenshot({ path: path.join(__dirname, '..', 'shot_welcome.png') });
  await page.click('button.primary');
  await page.waitForSelector('#field');
  for (let i = 0; i < 6; i++) { const p = await page.$('#popHost .pop'); if (!p) break; await p.click({ timeout: 5000 }); await T(150); }
  await page.screenshot({ path: path.join(__dirname, '..', 'shot_game0.png') });
  let plays = 0;
  for (let i = 0; i < 60; i++) {
    const st = await page.evaluate(() => ({ popWait: !!(UI.pop && UI.pop.waiting), modal: !!document.querySelector('#modal .dlg button'), lit: !!document.querySelector('.crow.lit.clk'), glow: !!document.querySelector('.fld.glow'), dice: !!document.querySelector('.dice'), pend: G.pend ? G.pend.kind + (G.pend.k || G.pend.f) : '', busy, inn: G.inn, half: G.half, outs: G.outs, over: G.over }));
    if (i % 10 === 0 || st.modal) console.log('step', i, JSON.stringify(st));
    if (st.over) break;
    if (st.busy && !st.popWait && !st.modal) { await T(300); continue; }
    if (st.modal) { await page.evaluate(() => document.querySelector('#modal .dlg button').click()); await T(200); continue; }
    if (st.popWait) { await page.evaluate(() => { UI.pop.click(); }); await T(300); continue; }
    if (st.lit) { await page.evaluate(() => document.querySelector('.crow.lit.clk').click()); await T(300); plays++; continue; }
    if (st.glow) { await page.evaluate(() => { Actions.fieldingCheck(G.pend.f); }); await T(300); plays++; continue; }
    if (!st.dice) { console.log('NO DICE at', i, await page.$eval('#screen', e => e.innerText.slice(0, 300))); break; }
    await page.evaluate(() => { Actions.rollDice(); }); await T(700);
  }
  const state = await page.evaluate(() => ({ inn: G.inn, half: G.half, outs: G.outs, score: G.score, plays: G.log.length, log: G.log.slice(-5).map(l => l.txt), pend: G.pend, pop: UI.pop && UI.pop.title }));
  console.log('plays', plays, JSON.stringify(state, null, 1));
  await page.screenshot({ path: path.join(__dirname, '..', 'shot_game1.png'), fullPage: true });
  // steal / bunt / IBB / undo smoke
  await page.evaluate(() => { Actions.undo(); }); await T(200);
  console.log('after undo', await page.evaluate(() => G.log.length + ' lines, ' + G.extra));
  for (const s of ['schedule', 'standings', 'leaders', 'season', 'box', 'log', 'lineups', 'playoffs', 'options', 'help']) {
    await page.evaluate(k => Actions.showScreen(k), s); await T(100);
    console.log(s, '->', await page.$eval('#screen', e => e.innerText.slice(0, 70).replace(/\n/g, ' ')));
  }
  await page.evaluate(() => Actions.showScreen('game'));
  await page.evaluate(() => { Actions.simGame(); }); await T(2500);
  console.log(JSON.stringify(await page.evaluate(() => ({ over: G.over, score: G.score, results: S.results.length, last: G.log.slice(-1)[0].txt }))));
  await page.screenshot({ path: path.join(__dirname, '..', 'shot_final.png') });
  await page.evaluate(() => Actions.showScreen('box')); await T(100);
  await page.screenshot({ path: path.join(__dirname, '..', 'shot_box.png'), fullPage: true });
  // reload persistence
  await page.reload(); await page.waitForSelector('#nav'); await T(300);
  console.log('after reload', JSON.stringify(await page.evaluate(() => ({ over: G.over, results: S.results.length, teams: G.teams }))));
  console.log('errors:', errors.length ? errors.join('\n') : 'none');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
