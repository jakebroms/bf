const fs = require('fs'), path = require('path'), vm = require('vm');
const src = path.join(__dirname, '..', 'src'); const store = {};
const ctx = { console, setTimeout, clearTimeout, localStorage: { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); } }, document: { getElementById: () => null, querySelectorAll: () => [], addEventListener: () => {} }, navigator: {} }; ctx.window = ctx; vm.createContext(ctx);
for (const f of ['data.js', 'sound.js', 'core.js', 'play.js', 'manage.js', 'field.js']) vm.runInContext(fs.readFileSync(path.join(src, f), 'utf8'), ctx, { filename: f });
vm.runInContext(`const UI = { popRoll: async () => rnd1000(), popReveal(){}, popInfo(){}, popResult(){}, decide: async () => true, confirm: async () => true, alert(){}, toast(){}, soloRoll: async () => rnd1000(), showDice(){}, placeBall(){}, ballToMound(){}, animateDice: async () => {}, refresh(){}, pop: null }; loadAll(); S = newSeason(); G = newGame();`, ctx);
(async () => { await vm.runInContext(`(async () => {
  const codes = {}; let bad = 0;
  for (let i = 0; i < 25; i++) {
    loadTeams({ kind: 'schedule' }); gSim = true; G.pregame = 0; let n = 0; while (!G.over && n < 1500) { await nextAtBat(); G.pend = null; n++; } gSim = false;
    for (const p of G.pa) codes[p.code] = (codes[p.code] || 0) + 1;
    for (let s = 0; s <= 1; s++) { const pa = G.pa.filter(p => p.s === s).length; const box = G.boxBat.filter(b => b.team === G.teams[s]).reduce((t, b) => t + b.AB + b.BB + b.HBP + b.SF + b.SH, 0); if (pa !== box) { bad++; console.log('PA count mismatch', pa, box, G.teams[s]); } }
    const runs = G.pa.filter(p => p.scored).length; if (runs !== G.score[0] + G.score[1]) console.log('scored marks', runs, 'vs runs', G.score[0] + G.score[1]);
    if (i === 0) console.log(G.pa.slice(0, 12).map(p => p.inn + ':' + lastName(p.id) + ' ' + p.code + (p.rbi ? ' rbi' + p.rbi : '') + (p.scored ? ' ◆' : '') + '  <- ' + p.txt.slice(0, 60)).join('\\n'));
  }
  console.log('bad games', bad); console.log(Object.entries(codes).sort((a, b) => b[1] - a[1]).map(e => e[0] + ':' + e[1]).join('  '));
  console.log('records', JSON.stringify(S.records).slice(0, 400));
  console.log('streak sample', Object.values(S.seasonBat).filter(s => s.streak >= 3).slice(0, 3).map(s => s.name + ' ' + s.streak).join(', '));
})()`, ctx); })().catch(e => { console.error(e); process.exit(1); });
