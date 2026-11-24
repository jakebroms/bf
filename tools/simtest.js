// Headless engine test: simulate N schedule games with a stub UI and report sanity numbers.
const fs = require('fs'), path = require('path'), vm = require('vm');
const src = path.join(__dirname, '..', 'src');
const N = parseInt(process.argv[2] || '60', 10);
const store = {};
const ctx = {
  console, window: {}, setTimeout, clearTimeout,
  localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
  document: { getElementById: () => null, querySelectorAll: () => [], addEventListener: () => {} },
  navigator: {},
};
ctx.window = ctx;
vm.createContext(ctx);
for (const f of ['data.js', 'sound.js', 'core.js', 'play.js', 'manage.js', 'field.js', 'extras.js', 'gate.js']) { if (f === 'extras.js') vm.runInContext('var Actions = {}; var $ = () => null; var busy = false; function runAction(){}', ctx); vm.runInContext(fs.readFileSync(path.join(src, f), 'utf8'), ctx, { filename: f }); }
// stub UI
vm.runInContext(`
const UI = {
  popRoll: async () => rnd1000(), popReveal(){}, popInfo(){}, popResult(){}, decide: async () => true, confirm: async () => true, alert(m){ console.log('ALERT:', m); },
  toast(m){ console.log('TOAST:', m); }, soloRoll: async () => rnd1000(), showDice(){}, placeBall(){}, ballToMound(){}, animateDice: async () => {}, refresh(){}, pop: null,
};
loadAll();
S = newSeason(); G = newGame();
`, ctx);
(async () => {
  await vm.runInContext(`(async () => {
    let runs = 0, games = 0, hits = 0, errs = 0, hr = 0, sb = 0, cs = 0, k = 0, bb = 0, pa = 0, dp = 0, er = 0, outs = 0, bunts = 0, lob = 0, extra = 0, maxInn = 0, playoffs = 0;
    const t0 = Date.now();
    for (let i = 0; i < ${N}; i++) {
      if (!loadTeams({ kind: 'schedule' })) break;
      gSim = true; G.pregame = 0;
      let n = 0; while (!G.over && n < 1500) { await nextAtBat(); G.pend = null; n++; }
      gSim = false;
      if (!G.over) { console.log('game did not finish!', G.inn, G.half, G.outs); break; }
      games++; runs += G.score[0] + G.score[1]; hits += G.hits[0] + G.hits[1]; errs += G.errs[0] + G.errs[1]; lob += G.lob[0] + G.lob[1];
      if (G.inn > 9) extra++; if (G.inn > maxInn) maxInn = G.inn;
      for (const b of G.boxBat) { hr += b.HR; sb += b.SB; cs += b.CS; k += b.K; bb += b.BB; pa += b.AB + b.BB + b.HBP + b.SF + b.SH; dp += b.GIDP; }
      for (const p of G.boxPit) { er += p.ER; outs += p.OUTS; }
      // consistency checks
      const rA = G.boxBat.filter(b => b.team === G.teams[0]).reduce((s, b) => s + b.R, 0), rH = G.boxBat.filter(b => b.team === G.teams[1]).reduce((s, b) => s + b.R, 0);
      if (rA !== G.score[0] || rH !== G.score[1]) console.log('RUN MISMATCH game', i, rA, G.score[0], rH, G.score[1]);
      const pr = G.boxPit.reduce((s, p) => s + p.R, 0); if (pr !== G.score[0] + G.score[1]) console.log('PIT RUN MISMATCH', pr, G.score);
      const hA = G.boxBat.filter(b => b.team === G.teams[0]).reduce((s, b) => s + b.H, 0); if (hA !== G.hits[0]) console.log('HIT MISMATCH', hA, G.hits[0]);
      const ln = G.innRuns[0].reduce((a, b) => a + b, 0) + G.innRuns[1].reduce((a, b) => a + b, 0); if (ln !== G.score[0] + G.score[1]) console.log('LINE MISMATCH', ln, G.score);
      const w = G.boxPit.filter(p => p.W).length, l = G.boxPit.filter(p => p.L).length; if (w !== 1 || l !== 1) console.log('DECISION MISMATCH', w, l, G.pitWin, G.pitLose);
      if (i < 2) { console.log(G.log.slice(0, 6).map(x => x.txt).join('\\n')); console.log('...'); console.log(G.log.slice(-3).map(x => x.txt).join('\\n')); }
    }
    const t = (Date.now() - t0) / 1000;
    console.log('games', games, 'in', t.toFixed(1), 's');
    console.log('runs/game (both teams)', (runs / games).toFixed(2), 'league 1977 ~', (2 * miscV('lg_rpg', 4.47)).toFixed(2));
    console.log('hits/game', (hits / games).toFixed(1), 'errors/game', (errs / games).toFixed(2), 'HR/game', (hr / games).toFixed(2), 'LOB/game', (lob / games).toFixed(1));
    console.log('K/PA', (k / pa).toFixed(3), 'BB/PA', (bb / pa).toFixed(3), 'SB', sb, 'CS', cs, 'succ', (sb / (sb + cs)).toFixed(2), 'GIDP/game', (dp / games).toFixed(2));
    console.log('ERA', (er * 27 / outs).toFixed(2), 'extra-inning games', extra, 'longest', maxInn);
    console.log('standings sample', JSON.stringify(standingsData()[0].teams.slice(0, 3)));
    console.log('leaders HR', JSON.stringify(leaderTable('B', 'HR', 'AL').rows.slice(0, 3)));
    console.log('results', S.results.length, 'archive', Object.keys(S.archive).length, 'save size KB', (exportJSON().length / 1024).toFixed(0));
    // pitRest sanity
    const pr = Object.values(S.pitRest); console.log('pitRest entries', pr.length, 'sample', JSON.stringify(pr[0]));
    // playoffs quick test
    S.playoffs = poDefaults(); S.playoffs.n = 2; setupBracket(); console.log('bracket rows', S.playoffs.rows.map(r => r.round + ' ' + r.hi + ' v ' + r.lo).join(' | '));
    let guard = 0; while (guard++ < 40) { if (!await playNextPlayoff()) break; gSim = true; G.pregame = 0; let n = 0; while (!G.over && n < 1500) { await nextAtBat(); G.pend = null; n++; } gSim = false; playoffs++; }
    console.log('playoff games', playoffs, S.playoffs.rows.map(r => r.round + ': ' + r.status).join(' | '));
  })()`, ctx);
})().catch(e => { console.error('FAILED', e); process.exit(1); });
