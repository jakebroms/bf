/* ui.js: screens, the game board, pop-ups, actions */
'use strict';
const UI = {};
const Actions = {};
let busy = false, G_UNDO = null, curScreen = 'game', luView = 0, swapPick = null, cardBackSide = -1;
let boxPick = 'current', logPick = 'current', seasonTeam = '', schedTeam = '', edTeam = '', scoutOpen = true;
const VIEW_PRESETS = {
  everything: { cards: true, lineups: true, pbp: true, scout: true, settings: true, field: 'medium' },
  simple: { cards: false, lineups: true, pbp: true, scout: false, settings: false, field: 'large' },
  scorekeeper: { cards: false, lineups: true, pbp: true, scout: false, settings: true, field: 'small' },
  boardgame: { cards: true, cardsIn: true, lineups: false, pbp: false, scout: false, settings: false, field: 'large' },
};
let VIEW = Object.assign({}, VIEW_PRESETS.everything);
try { const v = JSON.parse(localStorage.getItem('BF5_view') || 'null'); if (v) VIEW = Object.assign({}, VIEW_PRESETS.everything, v); } catch (e) {}
function saveView() { try { localStorage.setItem('BF5_view', JSON.stringify(VIEW)); } catch (e) {} }
Actions.setView = (k, v) => { VIEW[k] = v; saveView(); UI.refresh(); };
Actions.viewPreset = p => { VIEW = Object.assign({}, VIEW_PRESETS[p]); saveView(); UI.refresh(); };
let defOpen = false;
Actions.viewMenu = () => { VIEW.bar = !VIEW.bar; saveView(); UI.refresh(); };
Actions.toggleDef = () => { defOpen = !defOpen; UI.refresh(); };
// a slim strip under the header: presets, what is on the screen, the field size, and the defense pop-over
function viewBarHtml() {
  if (VIEW.bar === false) return '';
  const chip = (k, label, title) => `<button class="vchip${VIEW[k] ? ' on' : ''}" onclick="Actions.setView('${k}',${!VIEW[k]})" title="${esc(title)}">${label}</button>`;
  const pre = (p, label) => { const cur = Object.keys(VIEW_PRESETS[p]).every(k => VIEW[k] === VIEW_PRESETS[p][k]); return `<button class="vchip pre${cur ? ' on' : ''}" onclick="Actions.viewPreset('${p}')">${label}</button>`; };
  return `<div class="viewbar"><span class="vlab">VIEW</span>${pre('boardgame', 'Board game')}${pre('simple', 'Simple')}${pre('everything', 'Everything')}${pre('scorekeeper', 'Scorekeeper')}<span class="vsep"></span>
    ${chip('cards', 'Cards', 'the batter and pitcher cards')}${VIEW.cards ? chip('cardsIn', 'on the field', 'cards inside the field box') : ''}${chip('lineups', 'Lineups', 'both batting orders')}${chip('pbp', 'Play-by-play', 'the last plays')}${chip('scout', 'Scouting', 'notes on the batter, pitcher and runners')}${chip('settings', 'Settings panel', 'defense and settings as a panel')}<span class="vsep"></span>
    <span class="vlab">FIELD</span>${['small', 'medium', 'large'].map(f => `<button class="vchip${VIEW.field === f ? ' on' : ''}" onclick="Actions.setView('field','${f}')">${f[0].toUpperCase() + f.slice(1)}</button>`).join('')}<span class="vsep"></span>
    <button class="vchip def${defOpen ? ' on' : ''}${(G.infield && G.infield !== 'No') || (G.ofDepth && G.ofDepth !== 'Normal') || G.pitchAround ? ' set' : ''}" onclick="Actions.toggleDef()" title="Infield, outfield, pitch around, injuries">⚙ Defense ${defOpen ? '▴' : '▾'}</button>
    <button class="vchip x" onclick="Actions.viewMenu()" title="Hide this strip (the View button brings it back)">✕</button>
    ${defOpen ? `<div class="defpop">${settingsPanelHtml()}</div>` : ''}</div>`;
}
function settingsPanelHtml() {
  return `<div class="ph">DEFENSE AND SETTINGS</div>
    <label title="Infield in: a grounder is more likely to be cut off at the plate, but more get through">Infield <select onchange="Actions.setInfield(this.value)">${['No', 'Corners in', 'Infield in'].map(v => `<option${G.infield === v ? ' selected' : ''}>${v}</option>`).join('')}</select></label>
    <label title="Deep: fewer doubles but bloopers drop in. Shallow: the reverse">Outfield <select onchange="Actions.setOF(this.value)">${['Normal', 'Deep', 'Shallow'].map(v => `<option${G.ofDepth === v ? ' selected' : ''}>${v}</option>`).join('')}</select></label>
    <label title="Ball four half the time, careful pitches otherwise">Pitch around this batter <select onchange="Actions.setPitchAround(this.value==='Yes')"><option${!G.pitchAround ? ' selected' : ''}>No</option><option${G.pitchAround ? ' selected' : ''}>Yes</option></select></label>
    <label>Injuries this game <select onchange="Actions.setInjOff(this.value==='Off')"><option${!G.injuriesOff ? ' selected' : ''}>Use setting</option><option${G.injuriesOff ? ' selected' : ''}>Off</option></select></label>
    <div class="btnrow"><button class="mini" onclick="Actions.toggleToday()">${luView ? 'Show season stats' : "Show today's stats"}</button><button class="mini" onclick="Actions.saveDefault()" title="Both lineups become each team's saved lineup vs today's starter's hand">Save lineups as default</button></div>`;
}
const $ = id => document.getElementById(id);
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };

// ======================= pop-ups and dialogs =======================
UI.pop = null;            // {title, sub, rows, rr, res, waiting, click, foot}
UI.popRoll = (title, sub, rows, lbl) => new Promise(resolve => {
  UI.pop = { title, sub, rows, rr: 0, res: '', waiting: true, foot: 'Click here to roll', click: async () => {
    const p = UI.pop; if (!p || !p.waiting) return;
    p.waiting = false; sfx('dice');
    let rr = solo() ? await UI.soloRoll(lbl, null) : 0; if (!(rr >= 1 && rr <= 1000)) rr = rnd1000();
    p.rr = rr; p.foot = 'Rolled ' + rr; renderPop(); resolve(rr);
  } };
  renderPop();
});
UI.popReveal = (title, sub, rows, rr, res) => { UI.pop = { title, sub, rows, rr, res: res || '', waiting: false, foot: 'Rolled ' + rr + '  ·  click to close', click: () => { UI.pop = null; renderPop(); } }; renderPop(); };
UI.popInfo = (title, txt, res) => { UI.pop = { title, sub: txt, rows: [], rr: 0, res: res || '', waiting: false, foot: 'click to close', click: () => { UI.pop = null; renderPop(); } }; renderPop(); };
UI.popResult = txt => { if (UI.pop && !UI.pop.waiting && !UI.pop.res) { UI.pop.res = txt; renderPop(); } };
UI.decide = q => UI.ask(q.title, q.sub + '\n\nSEND HIM: safe on 1-' + q.safeTop + ' (' + q.pct + '%), out on ' + (q.safeTop + 1) + '-1000.', [['SEND HIM', true, 'go'], ['HOLD HIM', false, '']]);
UI.confirm = (txt, title, yes, no) => UI.ask(title || 'Ball Five', txt, [[yes || 'Yes', true, 'go'], [no || 'No', false, '']]);
UI.alert = (txt, title) => UI.ask(title || 'Ball Five', txt, [['OK', true, 'go']]);
UI.ask = (title, txt, buttons) => new Promise(resolve => {
  const m = $('modal'); m.classList.remove('hidden');
  m.innerHTML = `<div class="dlg"><div class="dlg-title">${esc(title)}</div><div class="dlg-body">${esc(txt).replace(/\n/g, '<br>')}</div><div class="dlg-btns">${buttons.map((b, i) => `<button class="btn ${b[2]}" data-i="${i}">${esc(b[0])}</button>`).join('')}</div></div>`;
  m.querySelectorAll('button').forEach(b => b.onclick = () => { m.classList.add('hidden'); m.innerHTML = ''; resolve(buttons[num(b.dataset.i)][1]); });
});
UI.soloRoll = (label, preview, opts) => new Promise(resolve => {
  // roll your own dice: three ten-sided dice (hundreds, tens, ones; 000 = 1000) and, for an at-bat, the two location dice
  opts = opts || {}; const withLoc = !!preview; const m = $('modal'); m.classList.remove('hidden');
  const d = ['', '', ''], l = ['', '']; let cur = 0;   // cur: 0-2 main dice, 3-4 location dice
  const value = () => { if (d.some(x => x === '')) return 0; const v = parseInt(d.join(''), 10); return v === 0 ? 1000 : v; };
  const draw = () => {
    const v = value();
    const pv = v && preview ? preview(v) : '';
    m.innerHTML = `<div class="dlg dice-dlg"><div class="dlg-title">🎲 ROLL YOUR OWN DICE</div><div class="dlg-body">
      <div class="dd-label">${esc(label)}</div>
      <div class="dd-row"><div class="dd-cap">The roll · hundreds, tens, ones <small>(000 counts as 1000)</small></div><div class="dd-dice">${d.map((x, i) => `<div class="die g big${cur === i ? ' active' : ''}" data-i="${i}">${x}</div>`).join('')}<div class="dd-val">${v ? '= ' + v : ''}</div></div></div>
      ${withLoc ? `<div class="dd-row"><div class="dd-cap">Ball location · blue, red <small>(optional: leave blank and the game rolls them)</small></div><div class="dd-dice"><div class="die b big${cur === 3 ? ' active' : ''}" data-i="3">${l[0]}</div><div class="die r big${cur === 4 ? ' active' : ''}" data-i="4">${l[1]}</div></div></div>` : ''}
      <div class="dd-preview${v ? '' : ' empty'}">${v ? esc(pv || 'Roll ' + v) : 'Type the digits, or tap the keypad.'}</div>
      <div class="keypad">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => `<button class="key" data-k="${n}">${n}</button>`).join('')}<button class="key" data-k="back">⌫</button><button class="key" data-k="0">0</button><button class="key" data-k="clear">clear</button></div>
    </div><div class="dlg-btns"><button class="btn primary" id="ddPlay" style="width:auto" ${v ? '' : 'disabled'}>PLAY THIS ROLL</button><button class="btn" id="ddAuto">Let the computer roll this one</button></div></div>`;
    m.querySelectorAll('.die.big').forEach(e => e.onclick = () => { cur = num(e.dataset.i); draw(); });
    m.querySelectorAll('.key').forEach(k => k.onclick = () => press(k.dataset.k));
    $('ddPlay').onclick = play; $('ddAuto').onclick = () => finish(rnd1000(), null);
  };
  const press = k => {
    sfx('click');
    if (k === 'clear') { d.fill(''); l.fill(''); cur = 0; }
    else if (k === 'back') { if (cur > 0 && (cur > 4 || (cur < 3 ? d[cur] === '' : l[cur - 3] === ''))) cur--; if (cur < 3) d[cur] = ''; else l[cur - 3] = ''; }
    else { if (cur < 3) d[cur] = k; else if (cur < 5) l[cur - 3] = k; if (cur < (withLoc ? 4 : 2)) cur++; }
    draw();
  };
  const finish = (v, loc) => { document.removeEventListener('keydown', onKey, true); m.classList.add('hidden'); m.innerHTML = ''; if (loc != null) gSoloLoc = loc; resolve(v); };
  const play = () => { const v = value(); if (!v) return; const loc = (l[0] !== '' && l[1] !== '') ? parseInt(l[0] + l[1], 10) : null; sfx('dice'); finish(v, loc); };
  const onKey = e => { if (/^[0-9]$/.test(e.key)) { press(e.key); e.preventDefault(); } else if (e.key === 'Backspace') { press('back'); e.preventDefault(); } else if (e.key === 'Enter') { play(); e.preventDefault(); } else if (e.key === 'Escape') { finish(rnd1000(), null); } e.stopPropagation(); };
  document.addEventListener('keydown', onKey, true);
  draw();
});
Actions.setSolo = on => { O['Solo dice mode'] = on ? 'On' : 'Off'; saveAll(); UI.refresh(); UI.toast(on ? 'You roll: each roll asks for your three dice (000 = 1000).' : 'The computer rolls the dice.'); };
UI.toast = (txt) => { const t = $('toast'); t.textContent = txt; t.classList.add('show'); clearTimeout(UI._tt); UI._tt = setTimeout(() => t.classList.remove('show'), 3500); };
UI.showDice = (v, txt) => { /* state only; the refresh draws them */ };
UI.placeBall = (f, depth, hrFt) => { if (gSim) return; G.ball = ballSpot(f, depth, hrFt || 0); G.ball.fresh = true; G.ball.depth = depth; G.ball.air = f >= 7 || depth > 0; };
UI.flashQ = [];
UI.flash = (txt, cls) => { UI.flashQ.push({ txt, cls }); };
UI.showFlashes = () => {
  const host = document.querySelector('.fieldwrap'); if (!host || !UI.flashQ.length) { UI.flashQ = []; return; }
  const q = UI.flashQ; UI.flashQ = [];
  q.forEach((f, i) => setTimeout(() => { const d = el('div', 'flash ' + f.cls, esc(f.txt)); host.appendChild(d); setTimeout(() => d.remove(), 1500); }, i * 900));
};
UI.crowdLevel = () => {
  if (!G.teams[0] || G.over) { Snd.crowd = crowdSize(); Snd.setLevel(0.012); return; }
  let lv = 0.028; if (G.bases[1]) lv += 0.012; if (G.bases[2]) lv += 0.016; if (G.bases[0] && G.bases[1] && G.bases[2]) lv += 0.012;
  if (G.inn >= 7 && Math.abs(G.score[0] - G.score[1]) <= 2) lv += 0.02; if (G.inn >= 9 && Math.abs(G.score[0] - G.score[1]) <= 1) lv += 0.02;
  Snd.crowd = crowdSize(); Snd.setLevel(lv * (0.45 + 0.55 * Snd.crowd));
};
UI.ballToMound = () => { if (gSim) return; const [x, y] = polarXY(64, 84); G.ball = { x, y }; };
UI.animateDice = () => new Promise(resolve => {
  if (gSim || solo()) { resolve(); return; }
  sfx('dice'); let i = 0; const ds = ['d1', 'd2', 'd3', 'l1', 'l2'].map($);
  const tick = () => { ds.forEach(d => { if (d) d.textContent = Math.floor(rand() * 10); }); if (++i < 6) setTimeout(tick, 70); else resolve(); };
  tick();
});
function renderPop() {
  const host = $('popHost'); if (!host) return;
  let p = UI.pop;
  if (!p && G.pend && G.pend.kind === 'X') {
    const f = G.pend.f, fid = f === 1 ? curPitcherID(fieldSideTeam()) : defID(fieldSideTeam(), f);
    p = { title: 'FIELDING CHECK', sub: posName(f) + ' ' + lastName(fid) + ' · range ' + rangeR(fid, f) + (hasFld(fid, f) ? ' · e' + fieldVal(fid, f, F.ER, 0) : ' · out of position'), rows: xRows(f, fid), rr: 0, res: '', waiting: true, foot: 'Click here to roll', click: () => Actions.fieldingCheck(f) };
  } else if (!p && G.pend && G.pend.kind === 'K' && G.pend.k === 15) {
    const side = batSideTeam(); gBatID = slotID(side, G.next[side]); gPitID = curPitcherID(fieldSideTeam());
    const w = wallSpec(G.pend.roll);
    p = { title: w.title, sub: w.sub, rows: w.rows, rr: 0, res: '', waiting: true, foot: 'Click here to roll', click: () => Actions.playResult() };
  } else if (!p && G.pregame > 0) {
    const sp = pregameSpec(); const stg = G.pregame;
    p = { title: sp.title, sub: sp.sub, rows: sp.rows, rr: sp.rr, res: sp.res, waiting: stg === 1 || stg === 3, click: () => Actions.pregameClick(),
      foot: stg === 2 ? "CLICK HERE to roll " + lastName(curPitcherID(1)) + "'s warm-up tosses (" + teamCode(1) + ')' : stg === 4 ? 'PLAY BALL' : 'Click here to roll', big: stg === 4 };
  }
  if (!p) { host.innerHTML = ''; host.classList.add('hidden'); return; }
  host.classList.remove('hidden');
  const n = p.rows.length, two = n > 12;
  let rowsHtml = '';
  if (n) {
    rowsHtml = '<div class="pop-rows' + (two ? ' two' : '') + '">' + p.rows.map(r => {
      const lit = p.rr >= r.lo && p.rr <= r.hi && p.rr > 0; const pct = ((r.hi - r.lo + 1) / 10).toFixed(1) + '%';
      return `<div class="pop-row${lit ? ' lit ' + (r.c || 'y') : ''}"><span class="pl">${esc(r.label)}</span><span class="pr">${r.lo}-${r.hi}</span><span class="pp">${pct}</span></div>`;
    }).join('') + '</div>';
  }
  const litRow = p.rows.find(r => p.rr >= r.lo && p.rr <= r.hi && p.rr > 0);
  const resCls = litRow && !p.title.startsWith('WARM-UP') ? ' ' + (litRow.c || 'y') : ' dark';
  host.innerHTML = `<div class="pop${p.waiting ? ' waiting' : ''}"><div class="pop-title">${esc(p.title)}</div><div class="pop-sub">${esc(p.sub)}</div>${rowsHtml}${p.res ? `<div class="pop-res${resCls}">${esc(p.res)}</div>` : ''}<div class="pop-foot${p.waiting ? ' hot' : ''}${p.big ? ' big' : ''}">${esc(p.waiting ? 'CLICK HERE TO ROLL' : p.foot)}</div></div>`;
  host.firstChild.onclick = () => p.click();
}

// ======================= action wrapper =======================
async function runAction(fn, opts) {
  opts = opts || {};
  if (busy) return; busy = true; const wasOver = G.over;
  if (opts.undo !== false) G_UNDO = deepCopy(G);
  if (!(UI.pop && UI.pop.waiting)) UI.pop = null;
  gExtra = ''; gLogPrefix = ''; gPlateNote = ''; gUnNote = 0; gBatErr = false; gPopCap = false; gPopOut = '';
  let failed = false;
  try { await fn(); }
  catch (e) { console.error(e); failed = true; UI.alert('Something went wrong on this play: ' + e.message + '\nClick Undo to go back one play.'); }
  finally {
    if (gExtra) G.extra = G.extra ? G.extra + '  |  ' + gExtra : gExtra; gExtra = '';
    if (!opts.keepLeads) { G.lead = [G.bases[0] ? rollLead() : '', G.bases[1] ? rollLead() : '']; }
    gHitRun = false; busy = false; gSoloLoc = null;
  }
  // the organ asks the home crowd for a rally: a runner in scoring position, 6th inning or later, once a half inning
  if (!gSim && G.half === 1 && !G.over && G.inn >= 6 && (G.bases[1] || G.bases[2]) && G.chargeKey !== G.inn + '|' + G.half) { G.chargeKey = G.inn + '|' + G.half; sfx('charge', 1.2); }
  const justOver = G.over && !wasOver;
  if (!(G.infield === 'Infield in' && G.bases[2] && G.outs < 2)) { if (G.infield === 'Infield in') G.infield = 'No'; }
  if (G.infield === 'Corners in' && G.outs >= 2) G.infield = 'No';
  saveAll(); UI.refresh(); UI.showFlashes();
  if (justOver && G.summary) { setTimeout(showGameSummary, 900); if (S.archive[G.gameNo]) Net.storeGame(S.archive[G.gameNo]); }
  for (let side = 0; side <= 1; side++) if (G.phTold[side]) { G.phTold[side] = false; UI.alert(teamCode(side) + ': the pitcher was pinch hit for, so he is out of the game.\n\nPick the new pitcher in the pitcher box (or the ' + (side === 0 ? 'Away' : 'Home') + ' pitchers button) before the next pitch.', 'New pitcher'); }
}
function pendingMsg() {
  if (G.pend && G.pend.kind === 'X') { UI.toast('Finish this play first: click the glowing fielder.'); return true; }
  if (G.pend && G.pend.kind === 'K') { UI.toast('Finish this play first: click the lit row on the card.'); return true; }
  if (UI.pop && UI.pop.waiting) { UI.toast('Finish this play first: click the pop-up to roll.'); return true; }
  return false;
}

// ======================= actions =======================
Actions.rollDice = async () => {
  if (busy) return;
  if (UI.pop && UI.pop.waiting) { UI.pop.click(); return; }
  if (G.over) { UI.toast('Game over. Click Next game.'); return; }
  if (!G.teams[0]) { UI.toast('Click Load teams first.'); return; }
  if (G.pend) { if (G.pend.kind === 'X') UI.toast('Click the glowing fielder (or the pop-up) to roll the check.'); else UI.toast('Click the lit row on the card to play it.'); return; }
  if (G.intro) { Actions.announce(); return; }
  if (G.pregame > 0) { Actions.pregameClick(); return; }
  await runAction(async () => {
    if (prePitchAction()) return;
    if (await leadPrompt()) return;
    await UI.animateDice();
    await nextAtBat();
  });
};
Actions.pregameClick = () => { if (busy || G.pregame === 0) return; runAction(async () => { pregameClick(); }, { undo: false }); };
Actions.playResult = () => { if (busy || !G.pend || G.pend.kind !== 'K') return; runAction(async () => { await playPending(); }); };
Actions.fieldingCheck = f => { if (busy || !G.pend || G.pend.kind !== 'X') return; runAction(async () => { await playPending(); }); };
Actions.cardRowClick = (side, k) => {
  if (busy || !G.pend || G.pend.kind !== 'K') return;
  if (!findMode()) { if (k === G.pend.k && side === (G.pend.roll <= 500 ? G.half : 1 - G.half)) Actions.playResult(); return; }
  const roll = G.pend.roll, bs0 = roll <= 500 ? G.half : 1 - G.half;
  if (side === bs0 && k === G.pend.k) { G.misses = 0; Actions.playResult(); return; }
  G.misses++;
  if (G.misses >= 2) { G.playTxt = 'Here it is: roll ' + roll + ' is lit up. Click it to play.'; if (G.pend.findTxt) { G.rollTxt = G.pend.findTxt; G.pend.findTxt = ''; } }
  else G.playTxt = 'Roll ' + roll + " isn't in that row. Try again (" + (roll <= 500 ? "batter's card, 1-500" : "pitcher's card, 501-1000") + ').';
  UI.refresh();
};
Actions.steal = () => { if (busy || pendingMsg()) return; if (!anyOn()) { UI.toast('No runner on base to steal.'); return; } runAction(async () => { await stealBase(); }); };
Actions.bunt = () => { if (busy || pendingMsg() || G.over) return; runAction(async () => { await bunt(); }); };
Actions.hitAndRun = () => { if (busy || pendingMsg()) return; if (!anyOn()) { UI.toast('Hit and run needs a runner on base.'); return; } runAction(async () => { gHitRun = true; if (prePitchAction()) { gHitRun = false; return; } await UI.animateDice(); await nextAtBat(); }); };
Actions.ibb = () => { if (busy || pendingMsg() || G.over) return; runAction(async () => { intentionalWalk(); }); };
Actions.pickoff = () => { if (busy || pendingMsg() || G.over) return; runAction(async () => { pickoffThrow(); }, { keepLeads: true }); };
Actions.pitchout = () => { if (busy || pendingMsg() || G.over) return; runAction(async () => { callPitchout(); }, { undo: false, keepLeads: true }); };
Actions.undo = () => {
  if (busy) return;
  if (!G_UNDO) { UI.toast('Nothing to undo.'); return; }
  if (G.over) { UI.toast("The game is final and already saved to the season, so it can't be undone."); return; }
  G = G_UNDO; G_UNDO = null; UI.pop = null; G.extra = 'Last play undone.'; saveAll(); UI.refresh();
};
Actions.restartGame = () => { if (busy) return; runAction(async () => { await restartGame(); }, { undo: false }); };
Actions.loadTeams = () => { if (busy) return; runAction(async () => { if (!G.over && G.started && !await UI.confirm("This game isn't finished. Load a new game anyway? (This game won't be saved.)", 'Load teams')) return; if (opt('Games').includes('schedule')) loadTeams({ kind: 'schedule' }); else Actions.exhibitionOpen(); }, { undo: false }); G_UNDO = null; };
Actions.nextGame = () => { if (busy) return; runAction(async () => { await playNextGame(); }, { undo: false }); G_UNDO = null; };
Actions.simGame = () => { if (busy) return; runAction(async () => { await simNextGame(); }, { undo: false }); G_UNDO = null; };
Actions.restartSeason = () => { if (busy) return; runAction(async () => { await restartSeason(); }, { undo: false }); G_UNDO = null; };
Actions.setInfield = v => { G.infield = v; saveAll(); UI.refresh(); };
Actions.setOF = v => { G.ofDepth = v; saveAll(); UI.refresh(); };
Actions.setPitchAround = v => { G.pitchAround = v; saveAll(); UI.refresh(); };
Actions.setInjOff = v => { G.injuriesOff = v; saveAll(); UI.refresh(); };
Actions.toggleToday = () => { luView = luView ? 0 : 1; UI.refresh(); };
Actions.setSlotPlayer = (side, i, id) => {
  if (busy) return; const lu = G.lineup[side]; const j = id ? lu.findIndex((s, k) => k !== i && s.id === id) : -1;
  if (j >= 0) { lu[j].id = lu[i].id; UI.toast(lastName(id) + ' was already batting ' + (j + 1) + (j === 0 ? 'st' : j === 1 ? 'nd' : j === 2 ? 'rd' : 'th') + ': swapped the two spots.'); }
  lu[i].id = id; saveAll(); UI.refresh();
};
Actions.setSlotPos = (side, i, pos) => { if (busy) return; G.lineup[side][i].pos = pos; saveAll(); UI.refresh(); };
Actions.setPitcher = (side, id) => {
  if (busy || !id) return; G.pitcher[side] = id;
  if (!G.started) { ensurePitchers(); syncLineupBox(); if (G.pregame >= 2 && G.formNeed[0] === 1) G.pregame = 1; else if (G.pregame === 4 && G.formNeed[1] === 1) G.pregame = 3; G.playTxt = fullName(id) + ' starts for ' + teamCode(side) + '.'; }
  else G.playTxt = fullName(id) + ' will come in for ' + teamCode(side) + ' (click the dice).';
  saveAll(); UI.refresh();
};
Actions.swapClick = (side, i) => {
  if (busy) return; if (G.started) { UI.toast('The batting order is set once the game starts. Use the dropdowns for substitutes.'); return; }
  if (swapPick && swapPick.side === side && swapPick.i !== i) { swapSpots(side, swapPick.i, i); swapPick = null; saveAll(); } else { swapPick = { side, i }; G.playTxt = 'Swap: now click the other lineup spot on the same team.'; }
  UI.refresh();
};
Actions.saveDefault = () => { if (busy) return; saveDefaultLineups(); };
Actions.showScreen = s => { curScreen = s; UI.refresh(); };
Actions.flipCard = side => { cardBackSide = cardBackSide === side ? -1 : side; UI.refresh(); };

// pitcher picker
Actions.pickerOpen = side => {
  if (busy) return; if (!teamCode(side) || !curPitcherID(side)) { UI.toast('Load teams first.'); return; }
  if (G.over) { UI.toast('This game is over. Click Next game.'); return; } if (pendingMsg()) return;
  const team = teamCode(side), st = staffOf(team), have = rosterPitchers(team).map(r => r[P.ID]); const ids = [];
  for (const p of [...st.rot, st.closer, ...st.pen]) if (p && have.includes(p) && !ids.includes(p)) ids.push(p);
  for (const p of have) if (!ids.includes(p)) ids.push(p);
  if (!have.includes(curPitcherID(side))) ids.unshift(curPitcherID(side));
  const list = ids.filter(p => isAvail(p, team) || p === curPitcherID(side) || availShort(p, team).startsWith('out'));
  const nx = G.started ? nextReliever(side, false) : pickStarter(side, team, null);
  const states = list.map(p => pickState(p, side, 1)); const nOK = states.filter(s => s.st === 1).length;
  const m = $('modal'); m.classList.remove('hidden');
  let rows = list.map(pid => {
    const ps = pickState(pid, side, nOK); const e = pitEff(pid);
    const restT = e.days < 0 ? '-' : e.days === 0 ? 'today' : e.days === 1 ? 'yesterday' : (e.days - 1) + ' day' + (e.days - 1 === 1 ? '' : 's');
    const lastT = e.days < 0 ? '-' : ipTxt(e.lastOuts) + ' IP';
    const rc = ps.st === 0 ? '#d9d9d9' : e.eff >= 0.9 ? '#92d050' : e.eff >= 0.75 ? '#ffe650' : '#ffa53c';
    return `<tr class="${ps.st === 0 ? 'grey' : ''}${pid === nx && ps.st > 0 ? ' nextp' : ''}" data-pid="${pid}" title="${esc(ps.why)}"><td>${pid === nx && ps.st > 0 ? '<b>NEXT:</b> ' : ''}${esc(fullName(pid))} (${throws_(pid)})${pid === curPitcherID(side) ? ' <i>(now)</i>' : ''}</td><td>${pickRole(side, pid)}</td><td>${restT}</td><td>${lastT}</td><td style="background:${rc}">${isAvail(pid, team) ? Math.round(e.eff * 100) + '%' : esc(availShort(pid, team))}</td></tr>`;
  }).join('');
  m.innerHTML = `<div class="dlg wide"><div class="dlg-title">${team} PITCHERS · ${G.started ? 'bring in a pitcher' : "pick today's starter"}</div><div class="dlg-note">Ready = how rested he is (green 90%+, yellow 75%+, orange OK to pitch). Grey can't pitch today: under ${Math.round(tiredCut() * 100)}%, out (back date shown), or already used. NEXT = the computer's pick.</div><table class="picker"><tr><th>Pitcher</th><th>Role</th><th>Rest</th><th>Last time</th><th>Ready</th></tr>${rows}</table><div class="dlg-btns"><button class="btn" id="pkClose">Close</button></div></div>`;
  m.querySelectorAll('tr[data-pid]').forEach(tr => tr.onclick = () => {
    const pid = tr.dataset.pid, ps = pickState(pid, side, nOK);
    if (ps.st === 0) { UI.toast(fullName(pid) + ' ' + ps.why + '. Pick someone else.'); return; }
    m.classList.add('hidden'); m.innerHTML = ''; Actions.setPitcher(side, pid);
  });
  $('pkClose').onclick = () => { m.classList.add('hidden'); m.innerHTML = ''; };
};
function pickState(pid, side, nOK) {
  if (pid === curPitcherID(side) && G.started) return { st: 0, why: 'is already on the mound' };
  if (G.used[side].includes(pid) && G.started) return { st: 0, why: 'already pitched in this game' };
  if (!isAvail(pid, teamCode(side))) return { st: 0, why: 'is hurt or not with the team today' };
  const e = pitEffSimple(pid);
  if (e < tiredCut() - 0.0001) return { st: nOK === 0 ? 2 : 0, why: 'is too tired to pitch today (' + Math.round(e * 100) + '% ready)' };
  return { st: 1, why: '' };
}
// exhibition picker
Actions.exhibitionOpen = async () => {
  if (busy) return;
  if (!G.over && G.started && !await UI.confirm("This game isn't finished. Start an exhibition game anyway? (This game won't be saved.)", 'Exhibition')) return;
  let aw = '', hm = '';
  const m = $('modal'); m.classList.remove('hidden');
  const draw = () => {
    const sub = !aw ? 'Click the VISITING team.' : !hm ? 'Visitors: ' + aw + '.  Now click the HOME team.' : aw + ' at ' + hm + '.  Click PLAY BALL (or click a team to start over).';
    const col = lg => D.teams.filter(t => t[T.LG] === lg).map(t => { const c = t[T.CODE]; const cls = c === aw && c === hm ? 'both' : c === aw ? 'away' : c === hm ? 'home' : ''; return `<div class="ex-team ${cls}" data-c="${c}">${c}  ${esc(t[T.NAME])}${c === aw ? '  (visitors)' : c === hm ? '  (home)' : ''}</div>`; }).join('');
    m.innerHTML = `<div class="dlg wide"><div class="dlg-title">EXHIBITION GAME · doesn't count in standings, stats or rest</div><div class="dlg-note"><b>${esc(sub)}</b></div><div class="ex-cols"><div><div class="ex-h">American League</div>${col('AL')}</div><div><div class="ex-h">National League</div>${col('NL')}</div></div><div class="dlg-btns">${aw && hm ? '<button class="btn go" id="exPlay">PLAY BALL</button>' : ''}<button class="btn" id="exCancel">Cancel</button></div></div>`;
    m.querySelectorAll('.ex-team').forEach(d => d.onclick = () => { const c = d.dataset.c; if (!aw || (aw && hm)) { aw = c; hm = ''; } else hm = c; draw(); });
    $('exCancel').onclick = () => { m.classList.add('hidden'); m.innerHTML = ''; };
    if (aw && hm) $('exPlay').onclick = () => { m.classList.add('hidden'); m.innerHTML = ''; runAction(async () => { loadTeams({ kind: 'exhib', away: aw, home: hm }); }, { undo: false }); };
  };
  draw();
};

// ======================= game screen =======================
function kColor(k) { return k === 15 ? 'amber' : k <= 9 ? 'green' : 'red'; }
function cardHtml(side, isPitSide, bid, pid, wB, wP, wX, pth, bside) {
  const id = isPitSide ? pid : bid, team = teamCode(side), c1 = teamColor(team, 1), c2 = teamColor(team, 2);
  const w = isPitSide ? wP : wB; const start = isPitSide ? 500 : 0;
  const pend = G.pend && G.pend.kind === 'K' ? G.pend : null;
  const litSide = pend ? (pend.roll <= 500 ? G.half : 1 - G.half) : -1;
  const fm = findMode() && pend;
  let rows = '', acc = start;
  for (let i = 1; i <= 15; i++) {
    const lit = pend && !fm && litSide === side && pend.k === i;
    const clickable = pend && (fm || lit);
    rows += `<div class="crow${lit ? ' lit ' + kColor(i) : ''}${clickable ? ' clk' : ''}" ${clickable ? `onclick="Actions.cardRowClick(${side},${i})"` : ''}><span class="cl">${LBL[i]}</span><span class="cr">${w[i] > 0 ? (acc + 1) + '-' + (acc + w[i]) : '-'}</span><span class="cp">${(w[i] / 10).toFixed(1)}%</span></div>`;
    acc += w[i];
  }
  if (isPitSide) {
    let xs = 0; for (let i = 0; i < 9; i++) xs += wX[i];
    const pendX = G.pend && G.pend.kind === 'X';
    rows += `<div class="crow${pendX ? ' lit amber' : ''}"><span class="cl">Fielding check</span><span class="cr">${acc + 1}-${acc + xs}</span><span class="cp">${(xs / 10).toFixed(1)}%</span></div>`;
  }
  let line, strip;
  if (isPitSide) {
    const r = pRowOf(pid); const ipo = replayPit(pid, 'OUTS'), er = replayPit(pid, 'ER');
    line = r ? 'Throws ' + r[P.THROWS] + ' · ERA ' + fmt2(num(r[P.ERA])) + ' / ' + (ipo > 0 ? fmt2(er * 27 / ipo) : '---') + ' · W-L ' + r[P.W] + '-' + r[P.L] + ' / ' + replayPit(pid, 'W') + '-' + replayPit(pid, 'L') + ' (real / replay)' : '';
    const br = backRow('P|' + pid);
    strip = [['W-L', r ? r[P.W] + '-' + r[P.L] : '-'], ['ERA', r ? fmt2(num(r[P.ERA])) : '-'], ['IP', r ? Math.floor(num(r[P.IPO]) / 3) : '-'], ['K', br ? backV(br, 13) : '-']];
  } else {
    const r = bRowOf(bid);
    line = 'Bats ' + r[B.BATS] + ' · ' + avg3(num(r[B.H]), num(r[B.AB])) + ' real / ' + avg3(replayBat(bid, 'H'), replayBat(bid, 'AB')) + ' replay · ' + replayBat(bid, 'HR') + ' HR, ' + replayBat(bid, 'RBI') + ' RBI';
    const br = backRow('B|' + bid);
    strip = [['AVG', avg3(num(r[B.H]), num(r[B.AB]))], ['HR', num(r[B.HR])], ['RBI', num(r[B.RBI])], ['SB', br ? backV(br, 11) : '-']];
  }
  const hdr = (side === 0 ? 'AWAY · ' : 'HOME · ') + (isPitSide ? 'PITCHING' : 'AT BAT');
  const splitTxt = opt('Splits') === 'Blended' ? 'blended' : isPitSide ? 'vs ' + bside + 'HB' : 'vs ' + pth + 'HP';
  const hand = isPitSide ? bside : pth;
  const posTxt = isPitSide ? 'P' : slotPos(side, G.next[side]);
  return `<div class="card ${isPitSide ? 'pit' : 'bat'}">
    <div class="chdr ${isPitSide ? '' : 'atbat'}">${hdr}<span class="cno">${seasonYr()}</span></div>
    <div class="cband" style="background:${c1};border-bottom:3px solid ${c2}" onclick="Actions.flipCard(${side})" title="Click to flip the card"><span>${esc(fullName(id))}</span><span class="cpos">${esc(posTxt)}</span></div>
    <div class="cteam">${esc(teamFull(team))}</div>
    <div class="cline">${esc(line)}</div>
    <div class="csplit ${hand === 'L' ? 'lh' : 'rh'}">${isPitSide ? 'Pitcher card 501-1000' : 'Batter card 1-500'} · ${splitTxt}</div>
    <div class="crows">${rows}</div>
    <div class="cstrip">${strip.map(s => `<div><small>${s[0]}</small><b>${s[1]}</b></div>`).join('')}</div>
  </div>`;
}
function cardBackHtml(side, id, isPitSide, teamOverride) {
  const team = teamOverride || teamCode(side), c1 = teamColor(team, 1), c2 = teamColor(team, 2), yr = seasonYr();
  let hd, rv = [], pv = [], fun = '', head = fullName(id).toUpperCase(), sub1, rat = [];
  if (isPitSide) {
    hd = ['W', 'L', 'ERA', 'G', 'GS', 'CG', 'SV', 'IP', 'H', 'R', 'ER', 'HR', 'BB', 'SO', 'WHIP']; const br = backRow('P|' + id);
    if (br) {
      const ipo = backV(br, 7);
      rv = [backV(br, 1), backV(br, 2), ipo > 0 ? fmt2(backV(br, 10) * 27 / ipo) : '-', backV(br, 4), backV(br, 5), backV(br, 6), backV(br, 3), ipTxt(ipo), backV(br, 8), backV(br, 9), backV(br, 10), backV(br, 11), backV(br, 12), backV(br, 13), ipo > 0 ? fmt2((backV(br, 8) + backV(br, 12)) * 3 / ipo) : '-'];
      fun = 'Faced ' + backV(br, 14) + ' batters · ' + backV(br, 15) + ' wild pitches · runners stole ' + backV(br, 16) + ' of ' + (backV(br, 16) + backV(br, 17)) + ' against him';
      if (backV(br, 14) - backV(br, 12) > 0 && ipo > 0) fun += '<br>Opponents hit ' + fmt3(backV(br, 8) / (backV(br, 14) - backV(br, 12))) + ' · ' + (backV(br, 13) * 27 / ipo).toFixed(1) + ' K and ' + (backV(br, 12) * 27 / ipo).toFixed(1) + ' walks per 9 innings';
    }
    const inBox = boxPitFind(id) && !G.over ? 1 : 0; const ipo = replayPit(id, 'OUTS'), er = replayPit(id, 'ER');
    pv = [replayPit(id, 'W'), replayPit(id, 'L'), ipo > 0 ? fmt2(er * 27 / ipo) : '-', replayPit(id, 'G') + inBox, replayPit(id, 'GS'), replayPit(id, 'CG'), replayPit(id, 'SV'), ipTxt(ipo), replayPit(id, 'H'), replayPit(id, 'R'), er, replayPit(id, 'HR'), replayPit(id, 'BB'), replayPit(id, 'K'), ipo > 0 ? fmt2((replayPit(id, 'H') + replayPit(id, 'BB')) * 3 / ipo) : '-'];
    sub1 = 'PITCHER · ' + teamFull(team) + ' · Throws ' + throws_(id);
    const r = pRowOf(id);
    if (r) {
      const gms = num(r[P.G]); rat.push(['Stamina', 'About ' + Math.round(num(r[P.STAM])) + ' batters']);
      if (gms > 0) rat.push(['Typical outing', (num(r[P.IPO]) / gms / 3).toFixed(1) + ' inn · ' + r[P.GS] + ' GS, ' + gms + ' G']);
      let hx = num(r[P.HOLDX]); if (hx <= 0) hx = 1;
      rat.push(['Hold', (num(r[P.HOLD]) > 0 ? '+' : '') + r[P.HOLD] + (Math.abs(hx - 1) < 0.05 ? ' · average' : ' · ' + Math.round(Math.abs(hx - 1) * 100) + '% ' + (hx > 1 ? 'more' : 'fewer') + ' tries')]);
      rat.push(['Wild pitches', (num(r[P.WP]) * 1000).toFixed(1) + ' per 1000 batters']);
      rat.push(['Pickoff move', 'x' + pitPKF(id).toFixed(1) + " the league's pickoff rate"]);
    }
    if (hasFld(id, 1)) rat.push(['Fielding', 'P · range ' + fieldVal(id, 1, F.RNGR, 3) + ' · ' + fieldVal(id, 1, F.ER, 0) + ' errors']);
  } else {
    hd = ['G', 'AB', 'R', 'H', '2B', '3B', 'HR', 'RBI', 'BB', 'SO', 'SB', 'CS', 'AVG', 'OBP', 'SLG', 'OPS']; const br = backRow('B|' + id);
    if (br) {
      for (let j = 1; j <= 12; j++) rv.push(backV(br, j));
      const ab = backV(br, 2), h = backV(br, 4), bb = backV(br, 9), hbp = backV(br, 13), sf = backV(br, 14), tb = h + backV(br, 5) + 2 * backV(br, 6) + 3 * backV(br, 7);
      rv.push(avg3(h, ab), avg3(h + bb + hbp, ab + bb + hbp + sf), avg3(tb, ab), opsTxt(h, bb, hbp, ab, sf, tb));
      fun = 'Grounded into ' + backV(br, 16) + ' double plays · ' + backV(br, 15) + ' sacrifice bunts · reached on error ' + backV(br, 17) + ' times<br>' + tb + ' total bases · hit by pitch ' + hbp + ' · ' + sf + ' sacrifice flies';
    }
    const inBox = boxBatFind(id) && !G.over ? 1 : 0;
    const ab = replayBat(id, 'AB'), h = replayBat(id, 'H'), bb = replayBat(id, 'BB'), hbp = replayBat(id, 'HBP'), sf = replayBat(id, 'SF'), tb = h + replayBat(id, '2B') + 2 * replayBat(id, '3B') + 3 * replayBat(id, 'HR');
    pv = [replayBat(id, 'G') + inBox, ab, replayBat(id, 'R'), h, replayBat(id, '2B'), replayBat(id, '3B'), replayBat(id, 'HR'), replayBat(id, 'RBI'), bb, replayBat(id, 'K'), replayBat(id, 'SB'), replayBat(id, 'CS'), avg3(h, ab), avg3(h + bb + hbp, ab + bb + hbp + sf), avg3(tb, ab), opsTxt(h, bb, hbp, ab, sf, tb)];
    const r = bRowOf(id);
    sub1 = teamFull(team) + ' · Bats ' + r[B.BATS];
    const v = num(r[B.RUN]); rat.push(['Speed', v + ' of 20 · ' + speedWord(v)]);
    rat.push(['Stealing', r[B.STEAL] + ' · tries ' + Math.round(num(r[B.SBATT]) * 100) + '% · safe ' + Math.round(num(r[B.SBSUCC]) * 100) + '%']);
    rat.push(['Bunting', 'Grade ' + buntGrade(id) + ' · hit and run ' + hnrGrade(id)]);
    let dp = num(r[B.GDP]); if (dp <= 0) dp = 1; rat.push(['Double plays', 'x' + fmt2(dp)]);
    for (let f = 2; f <= 9; f++) if (hasFld(id, f)) rat.push(['Fielding ' + posName(f), 'range ' + fieldVal(id, f, F.RNGR, 3) + ' · ' + fieldVal(id, f, F.ER, 0) + ' errors' + ((f === 2 || f >= 7) ? ' · arm ' + (fieldVal(id, f, F.ARMR, 0) > 0 ? '+' : '') + fieldVal(id, f, F.ARMR, 0) : '')]);
  }
  // two rows of five, as on the printed card: hitters G AB R H HR / RBI BB SB AVG OPS; pitchers W L ERA G GS / IP SO BB SV WHIP
  const blocks = isPitSide ? [[0, 1, 2, 3, 4], [7, 13, 12, 6, 14]] : [[0, 1, 2, 3, 6], [7, 8, 10, 12, 15]];
  const tbl = blocks.map(ix => `<table class="backtbl"><tr><th></th>${ix.map(i => '<th>' + hd[i] + '</th>').join('')}</tr><tr><td class="yr">${yr}</td>${ix.map(i => '<td>' + (rv.length ? rv[i] : '-') + '</td>').join('')}</tr><tr class="rep"><td class="yr">Replay</td>${ix.map(i => '<td>' + pv[i] + '</td>').join('')}</tr></table>`).join('');
  const first = '';
  return `<div class="card back" style="background:${c1};border-color:${c2}" ${teamOverride ? '' : `onclick="Actions.flipCard(${side})"`}><div class="bbrand">BALL FIVE BASEBALL</div><div class="bcity">${esc(teamCity(team).toUpperCase())} · ${yr}</div><div class="bname">${esc(head)}</div><div class="bsub">${esc(sub1)}</div><div class="brat"><div class="brat-h">BALL FIVE RATINGS</div>${rat.map(r => `<div><span>${esc(r[0])}</span>${esc(r[1])}</div>`).join('')}</div><div class="bpanel">${first}${tbl}${fun ? '<div class="bfun">' + fun + '</div>' : '<div class="bfun">(Real season line not in this file.)</div>'}</div><div class="bfoot">CLICK TO FLIP BACK</div></div>`;
}
function rosterOptions(side, selId, isPitList) {
  const team = teamCode(side); let opts = '';
  if (isPitList) {
    const list = rosterPitchers(team).map(r => r[P.ID]); if (selId && !list.includes(selId)) list.unshift(selId);
    for (const id of list) { const out = !isAvail(id, team); if (out && !availShort(id, team).startsWith('out') && id !== selId) continue; opts += `<option value="${id}"${id === selId ? ' selected' : ''}${out ? ' class="out"' : ''}>${esc(fullName(id))} (${throws_(id)}HP)${out ? ' (out)' : ''}</option>`; }
  } else {
    const list = rosterBatters(team).map(r => r[B.ID]); if (selId && !list.includes(selId)) list.unshift(selId);
    opts += `<option value=""${!selId ? ' selected' : ''}></option>`;
    for (const id of list) { const out = !isAvail(id, team); if (out && !availShort(id, team).startsWith('out') && id !== selId) continue; opts += `<option value="${id}"${id === selId ? ' selected' : ''}${out ? ' class="out"' : ''}>${esc(fullName(id))} (${handTag(batsOf(id))})${out ? ' (out)' : ''}</option>`; }
  }
  return opts;
}
const POS_OPTS = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH', 'P', 'PH'];
function lineupHtml(side) {
  const team = teamCode(side), batting = side === G.half, bslot = G.next[side];
  let h = `<div class="lu-hdr" style="background:${teamColor(team, 1)}">${friendlyCode(team)} · ${esc(teamFull(team))}${batting ? ' <span class="tag">batting</span>' : ''}${luView ? ' · today' : ''}</div>`;
  h += `<table class="lu"><tr><th></th><th>Pos</th><th>Player</th>${luView ? '<th>H-AB</th><th>R</th><th>RBI</th><th>BB/K</th>' : '<th>Real</th><th>Replay</th><th>HR</th><th>RBI</th>'}</tr>`;
  for (let i = 0; i < 9; i++) {
    const s = G.lineup[side][i], sid = slotID(side, i + 1), isP = String(s.pos).toUpperCase() === 'P';
    const cur = batting && bslot === i + 1; const sw = swapPick && swapPick.side === side && swapPick.i === i;
    let stats;
    if (luView) { const r = boxBatFind(sid); stats = r ? `<td>${r.H}-${r.AB}</td><td>${r.R}</td><td>${r.RBI}</td><td>${r.BB + r.HBP}/${r.K}</td>` : '<td>0-0</td><td>0</td><td>0</td><td>0/0</td>'; }
    else stats = sid ? `<td>${isBat(sid) ? avg3(num(bRowOf(sid)[B.H]), num(bRowOf(sid)[B.AB])) : '---'}</td><td>${avg3(replayBat(sid, 'H'), replayBat(sid, 'AB'))}</td><td>${replayBat(sid, 'HR')}</td><td>${replayBat(sid, 'RBI')}</td>` : '<td></td><td></td><td></td><td></td>';
    const outCls = sid && !isAvail(sid, team) ? ' outp' : '';
    const onBase = sid && G.bases.includes(sid) && !cur; const pslot = isP && !cur;
    h += `<tr class="${cur ? 'cur' : ''}${onBase ? ' onbase' : ''}${pslot ? ' pslot' : ''}${sw ? ' swp' : ''}${outCls}" title="${cur ? 'Now batting' : onBase ? 'On base' : ''}"><td class="slot" onclick="Actions.swapClick(${side},${i})" title="Click two spots to swap them (before the first pitch)">${i + 1}</td><td><select class="pos" onchange="Actions.setSlotPos(${side},${i},this.value)">${POS_OPTS.map(p => `<option${String(s.pos).toUpperCase() === p ? ' selected' : ''}>${p}</option>`).join('')}</select></td><td>${isP && !s.id ? `<span class="pname">(${esc(lastName(curPitcherID(side)))})</span>` : `<select class="plr" onchange="Actions.setSlotPlayer(${side},${i},this.value)">${rosterOptions(side, s.id, false)}</select>`}</td>${stats}</tr>`;
  }
  const pid = curPitcherID(side); const bp = boxPitFind(pid);
  h += `<tr class="prow"><td>P</td><td><button class="mini" onclick="Actions.pickerOpen(${side})" title="The staff: role, rest, Ready %">Staff</button></td><td><select class="plr pit" onchange="Actions.setPitcher(${side},this.value)">${rosterOptions(side, pid, true)}</select></td>${luView && bp ? `<td>${ipTxt(bp.OUTS)} IP</td><td>${bp.H} H</td><td>${bp.ER} ER</td><td>${bp.BB + bp.HBP}/${bp.K}</td>` : '<td colspan="4"></td>'}</tr></table>`;
  return h;
}
function fatColor(pct) { return pct <= 30 ? '#00b050' : pct <= 60 ? '#92d050' : pct <= 80 ? '#ffff00' : pct < 100 ? '#ffc000' : '#ff5050'; }
function staminaHtml(side) {
  const pid = curPitcherID(side); if (!pid) return '';
  const bf = G.bf[side], r = pRowOf(pid); let stam = r ? num(r[P.STAM]) : 25; stam *= effNow(side); if (stam < 4) stam = 4;
  const pct = bf / stam * 100; const f = Math.round(G.form[side] * 100);
  return `<div class="stam"><div class="stamtxt"><b>${teamCode(side)} ${esc(lastName(pid))}</b>${r ? ' ' + r[P.W] + '-' + r[P.L] + ', ' + fmt2(num(r[P.ERA])) : ''} · faced ${bf} of about ${Math.round(stam)} · today ${f > 0 ? '+' : ''}${f}%${G.formNeed[side] ? ' (warm-ups pending)' : ''}</div><div class="bar" title="How much of his stamina he has used"><div style="width:${Math.min(100, pct).toFixed(0)}%;background:${fatColor(pct)}"></div><span>${Math.round(pct)}% used</span></div></div>`;
}
function scoutHtml(bid, pid, fside, form) {
  const L = []; const lgS = 1 - miscV('cs_lg', 0.34);
  const add = (lbl, txt, cls) => L.push({ lbl, txt, cls: cls || '' });
  if (anyOn()) {
    add('#ON BASE', 'green = fast (darker = faster) · yellow · orange · red = slow');
    for (let ob = 1; ob <= 3; ob++) {
      const rn = G.bases[ob - 1]; if (!rn) continue; const r = bRowOf(rn), v = num(r[B.RUN]), cue = stealCue(ob);
      let t = (cue === 2 ? 'GREEN LIGHT · ' : cue === 1 ? 'MAYBE · ' : '') + 'Speed ' + v + ' (' + speedWord(v) + ') · steal grade ' + r[B.STEAL];
      if (ob < 3) t += ' · lead ' + (G.lead[ob - 1] || 'OK');
      L.push({ lbl: ['1st ', '2nd ', '3rd '][ob - 1] + lastName(rn), txt: t, sp: v, cue });
      let t2 = 'Runs in ' + Math.round(num(r[B.SBATT]) * 100) + '% of chances, safe ' + Math.round(num(r[B.SBSUCC]) * 100) + '% (league ' + Math.round(lgS * 100) + '%)';
      if (ob === 1 && !G.bases[1]) t2 += ' · steal 2nd now: 1-' + stealSafe(1);
      if (ob === 2 && !G.bases[2] && !G.bases[0]) t2 += ' · steal 3rd now: 1-' + stealSafe(2);
      add('', t2);
      const hx = num(r[B.ADV]); if (Math.abs(hx - 1) >= 0.03) add('', 'Takes the extra base ' + Math.round(Math.abs(hx - 1) * 100) + '% ' + (hx > 1 ? 'more' : 'less') + ' often than average');
    }
  }
  const r = bRowOf(bid);
  add('#BATTER', fullName(bid) + ' · ' + teamCode(1 - fside) + ' · bats ' + r[B.BATS]);
  let v = num(r[B.RUN]); add('Speed', v + ' of 20 · ' + speedWord(v));
  v = num(r[B.ADV]); if (Math.abs(v - 1) >= 0.03) add('', 'Takes the extra base ' + Math.round(Math.abs(v - 1) * 100) + '% ' + (v > 1 ? 'more' : 'less') + ' often than average');
  add('Stealing', 'Grade ' + r[B.STEAL] + ' · tries in ' + Math.round(num(r[B.SBATT]) * 100) + '% of chances · safe ' + Math.round(num(r[B.SBSUCC]) * 100) + '% (league ' + Math.round(lgS * 100) + '%)');
  add('', 'A = runs often and makes it ... E = hardly ever runs');
  add('Bunting', 'Grade ' + buntGrade(bid) + ' · hit and run grade ' + hnrGrade(bid) + ' (A best, D worst)');
  v = num(r[B.GDP]); if (v <= 0) v = 1;
  add('Double plays', 'x' + fmt2(v) + (Math.abs(v - 1) < 0.05 ? ' · about average' : ' · grounds into ' + Math.round(Math.abs(v - 1) * 100) + '% ' + (v > 1 ? 'more' : 'fewer') + ' than average'));
  let hasArm = false, first = true;
  for (let f = 1; f <= 9; f++) {
    const k = bid + '|' + f; if (!(k in IX.fld) || (f === 1 && !isPit(bid))) continue; const fr = D.fielding[IX.fld[k]];
    let t = posName(f) + ': range ' + fr[F.RNGR] + ' · ' + fr[F.ER] + ' errors per season'; if (f === 2 || f >= 7) { t += ' · arm ' + (num(fr[F.ARMR]) > 0 ? '+' : '') + fr[F.ARMR]; hasArm = true; }
    add(first ? 'Fielding' : '', t); first = false;
  }
  add('', 'Range 1 = best, 5 = worst' + (hasArm ? ' · arm +: runners take fewer extra bases' : ''));
  add('#WHERE HIS BALLS GO', '(the last die of the roll; 0 = 10)');
  add('Grounders', digitText(bid, B.GB0, 6, ['P', 'C', '1B', '2B', '3B', 'SS']));
  add('Fly/line/pop', digitText(bid, B.AIR0, 9, ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF']));
  add('Hits', digitText(bid, B.HIT0, 3, ['LF', 'CF', 'RF']));
  add('#PITCHER', fullName(pid) + ' · ' + teamCode(fside) + ' · throws ' + throws_(pid));
  add('Today', formName(form));
  if (form > 0.005) add('', 'Sharper than his card: fewer hits and walks today'); else if (form < -0.005) add('', 'Not his day (or tiring): more hits and walks');
  const pr = pRowOf(pid);
  if (pr) {
    const gms = num(pr[P.G]), ipo = num(pr[P.IPO]);
    add('Stamina', 'About ' + Math.round(num(pr[P.STAM])) + ' batters, then his card starts to slip');
    if (gms > 0) add('Typical outing', (ipo / gms / 3).toFixed(1) + ' innings · ' + (num(pr[P.GS]) >= gms / 2 ? 'starter' : 'reliever') + ' (' + pr[P.GS] + ' starts in ' + gms + ' games)');
    let hx = num(pr[P.HOLDX]); if (hx <= 0) hx = 1;
    add('Hold', (num(pr[P.HOLD]) > 0 ? '+' : '') + pr[P.HOLD] + (Math.abs(hx - 1) < 0.05 ? ' · runners steal on him about as often as average' : ' · runners go ' + Math.round(Math.abs(hx - 1) * 100) + '% ' + (hx > 1 ? 'more' : 'less') + ' often on him'));
    add('Wild pitches', (num(pr[P.WP]) * 1000).toFixed(1) + ' per 1000 batters (average about 4.5)');
  }
  add('Pickoff move', 'x' + pitPKF(pid).toFixed(1) + " the league's pickoff rate (1.0 = average)");
  const cat = defID(fside, 2); if (cat) add('Catcher', lastName(cat) + ' throws out ' + Math.round(fieldVal(cat, 2, F.CS, miscV('cs_lg', 0.34)) * 100) + '% of base stealers (league ' + Math.round(miscV('cs_lg', 0.34) * 100) + '%)');
  return L.map(x => x.lbl.startsWith('#') ? `<div class="sc-h">${esc(x.lbl.slice(1))} <small>${esc(x.txt)}</small></div>` : `<div class="sc-r${x.cue === 2 ? ' go' : x.cue === 1 ? ' maybe' : ''}"><span class="sc-l"${x.sp ? ` style="background:${speedColor(x.sp)};color:${x.sp >= 19 ? '#fff' : '#000'}"` : ''}>${esc(x.lbl)}</span><span>${esc(x.txt)}</span></div>`).join('');
}
function digitText(id, c0, n, names) {
  const r = bRowOf(id); let lo = 1; const t = [];
  for (let i = 1; i <= n; i++) { const hi = Math.round(num(r[c0 + i - 1])); if (hi >= lo) t.push(names[i - 1] + ' ' + (lo === 10 ? '0' : lo) + (hi > lo ? '-' + (hi === 10 ? '0' : hi) : '')); if (hi + 1 > lo) lo = hi + 1; }
  return t.join(' · ');
}
function scoreboardHtml() {
  const first = G.inn > 9 ? G.inn - 8 : 1; let h = '<table class="sb"><tr><th class="tm"></th>';
  for (let i = 0; i < 9; i++) h += `<th>${first + i}</th>`;
  h += '<th class="tot">R</th><th class="tot">H</th><th class="tot">E</th></tr>';
  for (let side = 0; side <= 1; side++) {
    h += `<tr><td class="tm">${G.teams[side] ? tmChip(G.teams[side]) : '-'}</td>`;
    for (let i = 0; i < 9; i++) { const inn = first + i; const v = G.innRuns[side][inn - 1]; const cur = inn === G.inn && G.half === side && !G.over; h += `<td class="${cur ? 'cur' : ''}">${v == null ? '' : v}</td>`; }
    const bump = UI.lastScore && UI.lastScore[side] !== G.score[side] ? ' bump' : '';
    h += `<td class="tot${bump}">${G.score[side]}</td><td class="tot">${G.hits[side]}</td><td class="tot">${G.errs[side]}</td></tr>`;
  }
  h += '</table>';
  const st = G.over ? 'Final' : (G.half === 0 ? 'Top ' : 'Bottom ') + ordinal(G.inn) + ' · ' + G.outs + (G.outs === 1 ? ' out' : ' outs');
  return `<div class="sbwrap">${h}<div class="sbstate">${st}</div></div>`;
}
function diceHtml() {
  const v = G.dice; const d = v == null ? ['', '', ''] : v === 1000 ? [0, 0, 0] : [Math.floor(v / 100), Math.floor(v / 10) % 10, v % 10];
  const l = G.loc == null ? ['', ''] : [Math.floor(G.loc / 10), G.loc % 10];
  const mine = solo();
  return `<div class="dicewrap"><div class="dice" onclick="Actions.rollDice()" title="The last roll (click to roll again)"><div class="dlabel">ROLL<br><small>1-1000</small></div><div class="die g" id="d1">${d[0]}</div><div class="die g" id="d2">${d[1]}</div><div class="die g" id="d3">${d[2]}</div><div class="dlabel loc">BALL<br><small>location</small></div><div class="die b" id="l1">${l[0]}</div><div class="die r" id="l2">${l[1]}</div></div><div class="whoRolls"><button class="seg${mine ? '' : ' on'}" onclick="Actions.setSolo(false)" title="The game rolls for you">🖥 Computer rolls</button><button class="seg${mine ? ' on' : ''}" onclick="Actions.setSolo(true)" title="Roll real dice and type in the numbers">🎲 I roll my own</button></div></div>`;
}
function nextStep() {
  // the one thing to do next: {text, btn, act}
  if (!G.teams[0] || !G.lineup[0].length) return { text: 'Start the 1977 season.', btn: 'LOAD TEAMS', act: () => Actions.loadTeams() };
  if (busy && !(UI.pop && UI.pop.waiting)) return { text: 'Playing it out...', btn: '', act: null };
  if (UI.pop && UI.pop.waiting) return { text: 'Big moment: ' + UI.pop.title.charAt(0) + UI.pop.title.slice(1).toLowerCase() + '. Roll for it.', btn: 'ROLL', act: () => UI.pop.click() };
  if (G.intro && !gSim) return { text: 'The public-address announcer has tonight\'s starting lineups.', btn: 'ANNOUNCE THE LINEUPS', act: () => Actions.announce() };
  if (G.pregame > 0) {
    const stg = G.pregame;
    if (stg === 4) return { text: 'Both starters are warmed up.', btn: 'PLAY BALL', act: () => Actions.pregameClick() };
    const side = stg <= 2 ? 0 : 1; return { text: lastName(curPitcherID(side)) + ' (' + teamCode(side) + ') throws his warm-up tosses before the game.', btn: 'ROLL WARM-UP TOSSES', act: () => Actions.pregameClick() };
  }
  if (G.over) return { text: 'Game over: ' + teamCode(0) + ' ' + G.score[0] + ', ' + teamCode(1) + ' ' + G.score[1] + '.', btn: 'NEXT GAME', act: () => Actions.nextGame() };
  if (G.pend && G.pend.kind === 'X') { const f = G.pend.f, fid = f === 1 ? curPitcherID(fieldSideTeam()) : defID(fieldSideTeam(), f); return { text: 'Ball hit to ' + lastName(fid) + ' (' + posName(f) + '): a fielding check. Roll to see if he makes the play.', btn: 'ROLL THE FIELDING CHECK', act: () => Actions.fieldingCheck(f) }; }
  if (G.pend && G.pend.kind === 'K') {
    if (findMode() && G.misses < 2) return { text: 'Find roll ' + G.pend.roll + ' on the cards and click that row.', btn: '', act: null };
    const k = G.pend.k; return { text: 'Roll ' + G.pend.roll + ' is ' + LBL[k].toUpperCase() + ' (the lit row on the card).', btn: 'PLAY IT: ' + LBL[k].toUpperCase(), act: () => Actions.playResult(), kind: kColor(k) };
  }
  const side = batSideTeam(); const bid = slotID(side, G.next[side]);
  return { text: (bid ? lastName(bid) : 'The batter') + ' steps in against ' + lastName(curPitcherID(1 - side)) + '.', btn: 'ROLL THE DICE', act: () => Actions.rollDice() };
}
Actions.primary = () => { if (busy && !(UI.pop && UI.pop.waiting)) return; Snd.ambient(!!G.teams[0]); const st = nextStep(); if (st.act) { sfx('click'); st.act(); } };
function showGameSummary() {
  const s = G.summary; if (!s) return; const m = $('modal'); m.classList.remove('hidden');
  const w = G.score[0] > G.score[1] ? 0 : 1; const hr = G.boxBat.filter(b => b.HR > 0).map(b => lastName(b.id) + ' (' + friendlyCode(b.team) + ') ' + b.HR);
  const multi = G.boxBat.filter(b => b.H >= 3).map(b => lastName(b.id) + ' ' + b.H + '-for-' + b.AB);
  const stks = G.boxBat.filter(b => S.seasonBat[b.id] && S.seasonBat[b.id].streak >= 8).map(b => lastName(b.id) + ' ' + S.seasonBat[b.id].streak + ' games');
  const noh = G.boxPit.filter(p => p.CG && p.H === 0).map(p => lastName(p.id));
  const pits = G.boxPit.filter(p => p.W || p.L || p.SV).map(p => lastName(p.id) + ' (' + friendlyCode(p.team) + '): ' + ipTxt(p.OUTS) + ' IP, ' + p.H + ' H, ' + p.ER + ' ER, ' + p.K + ' K' + (p.dec ? ' · ' + p.dec : ''));
  const ni = G.innRuns[0].length; const line = `<table class="data box-line"><tr><th class="l"></th>${Array.from({ length: ni }, (_, i) => '<th>' + (i + 1) + '</th>').join('')}<th>R</th><th>H</th><th>E</th></tr>${[0, 1].map(sd => '<tr><td class="l">' + teamCode(sd) + '</td>' + Array.from({ length: ni }, (_, i) => '<td>' + (G.innRuns[sd][i] == null ? '' : G.innRuns[sd][i]) + '</td>').join('') + '<td><b>' + G.score[sd] + '</b></td><td>' + G.hits[sd] + '</td><td>' + G.errs[sd] + '</td></tr>').join('')}</table>`;
  m.innerHTML = `<div class="dlg wide summary"><div class="dlg-title">${G.walkoff ? 'WALK-OFF! ' : 'FINAL: '}${esc(teamFull(teamCode(w)))} win, ${G.score[w]}-${G.score[1 - w]}</div><div class="dlg-body">${line}
    <div class="sumrow"><b>Winning pitcher</b> ${esc(s.wp)}</div><div class="sumrow"><b>Losing pitcher</b> ${esc(s.lp)}</div>${s.sv ? `<div class="sumrow"><b>Save</b> ${esc(s.sv)}</div>` : ''}
    ${hr.length ? `<div class="sumrow"><b>Home runs</b> ${esc(hr.join(', '))}</div>` : ''}${multi.length ? `<div class="sumrow"><b>Big days</b> ${esc(multi.join(', '))}</div>` : ''}
    ${noh.length ? `<div class="sumrow" style="color:#c00"><b>NO-HITTER!</b> ${esc(noh.join(', '))}</div>` : ''}${stks.length ? `<div class="sumrow"><b>Hitting streaks</b> ${esc(stks.join(', '))}</div>` : ''}
    ${pits.map(p => `<div class="sumrow small">${esc(p)}</div>`).join('')}
    <div class="sumrow small">${G.att ? 'Attendance ' + fmtNum(G.att) + (G.gate ? ' · gate ' + fmtMoney(G.gate) : '') + ' · ' : ''}Time of game ${esc(G.time || timeOfGame())}${windText() ? ' · ' + esc(windText()) : ''}</div>
    <div class="small" style="margin-top:8px">${G.exhib ? 'Exhibition: nothing is saved.' : 'Saved to the standings, season stats, leaders and box score archive.'}</div></div>
    <div class="dlg-btns"><button class="btn primary" id="sumNext" style="width:auto">NEXT GAME</button><button class="btn" id="sumPaper">Read the paper</button><button class="btn" id="sumBox">Scorebook</button><button class="btn" id="sumClose">Close</button></div></div>`;
  const close = () => { m.classList.add('hidden'); m.innerHTML = ''; };
  $('sumNext').onclick = () => { close(); Actions.nextGame(); }; $('sumPaper').onclick = () => { close(); paperPick = 'latest'; Actions.showScreen('paper'); }; $('sumBox').onclick = () => { close(); Actions.showScreen('scorebook'); }; $('sumClose').onclick = close;
}
function diamondHtml() {
  const bs = G.bases;
  return `<svg class="dia" viewBox="0 0 64 50"><g transform="translate(32 22)">${[[0, -12, bs[1]], [11, -1, bs[0]], [-11, -1, bs[2]]].map(([x, y, on]) => `<rect x="${x - 6}" y="${y - 6}" width="12" height="12" transform="rotate(45 ${x} ${y})" fill="${on ? '#ffcc00' : 'none'}" stroke="${on ? '#b8860b' : '#8a94a6'}" stroke-width="1.8"/>`).join('')}</g>${[0, 1, 2].map(i => `<circle cx="${14 + i * 18}" cy="43" r="4.5" fill="${!G.over && G.outs > i ? '#e03030' : 'none'}" stroke="${!G.over && G.outs > i ? '#a00' : '#8a94a6'}" stroke-width="1.8"/>`).join('')}</svg>`;
}
function situationHtml() {
  // one compact line under the title: who is up, who is pitching, with today's and the season's numbers
  if (G.over) return `<div class="gwho"><span><b>WINNING PITCHER</b> ${esc(G.summary ? G.summary.wp : '')}${G.summary && G.summary.sv ? ' · <b>SAVE</b> ' + esc(G.summary.sv) : ''}</span><span><b>LOSING PITCHER</b> ${esc(G.summary ? G.summary.lp : '')}</span><span class="dim">${G.time ? 'Time ' + esc(G.time) : ''}${G.att ? ' · attendance ' + fmtNum(G.att) : ''}</span></div>`;
  const side = batSideTeam(), bid = slotID(side, G.next[side]), pid = curPitcherID(1 - side);
  const bb = boxBatFind(bid), sb = S.seasonBat[bid]; const today = bb ? bb.H + '-for-' + bb.AB + (bb.HR ? ', ' + bb.HR + ' HR' : '') + (bb.RBI ? ', ' + bb.RBI + ' RBI' : '') : 'first time up';
  const seas = sb ? avg3(replayBat(bid, 'H'), replayBat(bid, 'AB')) + ', ' + replayBat(bid, 'HR') + ' HR, ' + replayBat(bid, 'RBI') + ' RBI' : 'first game';
  const stk = sb && sb.streak >= 5 ? ' · <b class="hot">' + sb.streak + '-game streak</b>' : '';
  const pb = boxPitFind(pid); const ptoday = pb ? ipTxt(pb.OUTS) + ' IP, ' + pb.H + ' H, ' + pb.R + ' R, ' + pb.K + ' K' : 'warming up';
  const on = []; for (let i = 0; i < 3; i++) if (G.bases[i]) on.push(['1st', '2nd', '3rd'][i] + ' ' + lastName(G.bases[i]));
  return `<div class="gwho"><span><b>AT BAT</b> ${esc(fullName(bid))} <small>${esc(slotPos(side, G.next[side]))}, bats ${handTag(batsOf(bid || 'zzBAT'))}, #${G.next[side]} ${teamCode(side)}</small> <small class="dim">today ${esc(today)} · season ${esc(seas)}${stk}</small></span><span><b>PITCHING</b> ${esc(fullName(pid))} <small>${throws_(pid)}HP</small> <small class="dim">today ${esc(ptoday)} · season ${replayPit(pid, 'W')}-${replayPit(pid, 'L')}, ERA ${replayPit(pid, 'OUTS') > 0 ? fmt2(replayPit(pid, 'ER') * 27 / replayPit(pid, 'OUTS')) : '-.--'}</small></span>${on.length ? `<span><b>ON BASE</b> ${esc(on.join(', '))}</span>` : ''}</div>`;
}
function playKind(t) { if (/Home run|homer/i.test(t)) return 'hr'; if (/\b(Single|Double|Triple)\b|singles|doubles|triples/i.test(t)) return 'hit'; if (/Walk|HBP|hit by|walks/i.test(t)) return 'walk'; if (/Strikeout|strikes out|out\b|Double play|flies|grounds|pops|lines|caught/i.test(t)) return 'out'; return ''; }
function recentPlays() { const L = G.log.filter(l => !l.txt.startsWith('---')).slice(-4, -1).reverse(); if (!L.length) return ''; return `<div class="recent">${L.map(l => `<div>${esc(l.txt)}</div>`).join('')}</div>`; }
function actBtn(label, caption, onclick, enabled, title) {
  return `<button class="btn act" onclick="${onclick}" ${enabled ? '' : 'disabled'} title="${esc(title || '')}"><span class="al">${label}</span><span class="ac">${esc(caption)}</span></button>`;
}
function gameScreen() {
  const root = $('screen');
  if (!G.teams[0] || !G.lineup[0].length) {
    root.innerHTML = `<div class="welcome"><h2>Ball Five Baseball · 1977</h2><p>Play the 1977 season one game at a time. Every roll reads a real player's card.</p>
    <div class="steps"><div><b>1</b> Click <b>LOAD TEAMS</b>. The next game on the real 1977 schedule comes up with its real lineups.</div><div><b>2</b> The big yellow button always tells you what to do next. Click it (or press the space bar).</div><div><b>3</b> Each click rolls the dice and plays one batter. Hits, outs and runs show on the field and in the play line.</div><div><b>4</b> Want to steal, bunt, or hit and run? Use the manager buttons under the field before you roll.</div><div><b>5</b> When the game ends it saves itself. Click <b>NEXT GAME</b> to keep the season going.</div></div>
    <div class="btnrow"><button class="btn primary big" onclick="Actions.loadTeams()">LOAD TEAMS · start the 1977 schedule</button></div><div class="btnrow"><button class="btn" onclick="Actions.exhibitionOpen()">Exhibition game · pick any two teams</button><button class="btn" onclick="Actions.showScreen('help')">How to play</button></div>
    <p class="small">Dedicated to Jim Bouton (1939-2019), whose book Ball Four gave the game its name.</p></div>`;
    renderPop(); return;
  }
  const side = G.half, fside = 1 - side; let bslot = G.next[side]; if (bslot < 1) bslot = 1;
  const bid = slotID(side, bslot), pid = curPitcherID(fside);
  const pth = throws_(pid), bside = batSide(bid || 'zzBAT', pth), form = totalForm(fside);
  gPitID = pid;
  const wB = batterCard(bid || 'zzBAT', pth), pc = pitcherCard(pid, bside, form);
  const cards = [0, 1].map(s => cardBackSide === s ? cardBackHtml(s, s === side ? (bid || 'zzBAT') : pid, s !== side) : cardHtml(s, s !== side, bid || 'zzBAT', pid, wB, pc.w, pc.x, pth, bside));
  const canAct = !G.over && !G.pregame && !G.pend && !busy;
  const st = nextStep(); const bs = G.bases;
  const stealBase = bs[0] && !bs[1] ? 1 : bs[1] && !bs[2] ? 2 : bs[2] ? 3 : 0;
  const stealCap = stealBase ? lastName(bs[stealBase - 1]) + ' steals ' + ['2nd', '3rd', 'home'][stealBase - 1] + ': safe 1-' + stealSafe(stealBase) : 'nobody on base';
  const buntCap = ((!bs[0] && !bs[1]) || G.outs >= 2) ? 'bunt for a hit (grade ' + buntGrade(bid || 'zzBAT') + ')' : 'sacrifice (grade ' + buntGrade(bid || 'zzBAT') + ')';
  const pkManual = opt('Pickoffs') === 'Manual';
  const wide = innerWidth >= 1500 && innerHeight >= 700, xwide = innerWidth >= 2000;
  const cardsIn = VIEW.cards && VIEW.cardsIn;
  const cols = []; if (VIEW.cards && !cardsIn) cols.push('236px'); cols.push('minmax(480px, 1fr)'); if (VIEW.cards && !cardsIn) cols.push('236px');
  const luCol = VIEW.lineups && wide; if (luCol) cols.push('minmax(400px, 470px)');
  const sideCol = (VIEW.settings || VIEW.pbp) && xwide; if (sideCol) cols.push('minmax(380px, 460px)');
  root.innerHTML = `
  <div class="sticky"><div class="gtop"><div class="gleft"><div class="gtitle">${esc(G.title)}</div>${situationHtml()}</div><div class="gright">${diamondHtml()}${scoreboardHtml()}</div></div></div>
  ${viewBarHtml()}
  <div class="gmain" style="grid-template-columns:${cols.join(' ')}">
    ${VIEW.cards && !cardsIn ? `<div class="col card-col">${cards[0]}</div>` : ''}
    <div class="col mid">
      <div class="nextbox"><div class="nexttext">${esc(st.text)}</div>${st.btn ? `<button class="btn primary ${st.kind || ''}" onclick="Actions.primary()">${esc(st.btn)}</button>` : ''}</div>
      <div class="fieldwrap${cardsIn ? ' withcards' : ''}"><svg id="field" viewBox="0 0 600 428" preserveAspectRatio="xMidYMid meet"></svg>${cardsIn ? `<div class="fcard left">${cards[0]}</div><div class="fcard right">${cards[1]}</div>` : ''}<div id="popHost" class="hidden"></div></div>
      <div class="playrow">${diceHtml()}<div class="play ${playKind(G.rollTxt + ' ' + G.playTxt)}"><div class="rolltxt">${esc(G.rollTxt)}</div><div class="playtxt">${esc(G.playTxt)}</div>${recentPlays()}</div></div>
      <div class="extra">${esc(G.extra)}</div>
      <div class="ph2">MANAGER MOVES <small>· before you roll</small></div>
      <div class="btnrow acts">
        ${actBtn('Steal', stealCap, 'Actions.steal()', canAct && stealBase, 'Send the lead runner')}
        ${actBtn('Bunt', buntCap, 'Actions.bunt()', canAct, 'Lay one down')}
        ${actBtn('Hit and run', anyOn() ? 'runners go with the pitch' : 'needs a runner on', 'Actions.hitAndRun()', canAct && anyOn(), 'The runners break on the pitch; the batter swings')}
        ${actBtn('Intentional walk', 'put ' + lastName(bid || 'zzBAT') + ' on first', 'Actions.ibb()', canAct, 'Walk this batter on purpose')}
        ${actBtn('Pitchout', bs[0] || bs[1] ? 'catch a runner going' : 'needs a runner on', 'Actions.pitchout()', canAct && (bs[0] || bs[1]), 'Pitch out on the next pitch')}
        ${actBtn('Pickoff throw', pkManual ? 'throw over to the runner' : 'automatic (see Options)', 'Actions.pickoff()', canAct && pkManual && ppBase(), 'Throw over to the runner (Manual pickoffs only)')}
      </div>
      <div class="ph2">GAME <small>· undo, restart, next</small></div>
      <div class="btnrow acts2">
        <button class="btn" onclick="Actions.undo()" title="Take back the last play">Undo last play</button><button class="btn" onclick="Actions.restartGame()" title="Start this game over">Restart game</button>
        <button class="btn ${G.over ? 'go' : ''}" onclick="Actions.nextGame()" title="Load the next game on the schedule">Next game</button><button class="btn" onclick="Actions.simGame()" title="The computer plays the rest of this game">Sim the rest</button><button class="btn" onclick="Actions.exhibitionOpen()" title="Pick any two teams">Exhibition</button>
      </div>
    </div>
    ${VIEW.cards && !cardsIn ? `<div class="col card-col">${cards[1]}</div>` : ''}
    ${VIEW.lineups ? `<div class="lucols" style="${luCol ? 'grid-column:auto;grid-template-columns:1fr;gap:6px' : ''}"><div class="lucol">${lineupHtml(0)}${staminaHtml(0)}</div><div class="lucol">${lineupHtml(1)}${staminaHtml(1)}</div></div>` : ''}
    ${VIEW.settings || VIEW.pbp ? `<div class="side" style="${sideCol ? 'grid-column:auto;grid-template-columns:1fr;gap:8px;align-content:start' : VIEW.settings && VIEW.pbp ? '' : 'grid-template-columns:1fr'}">` : ''}
      ${VIEW.settings ? `<div class="panel">${settingsPanelHtml()}<div class="small">Lineup tips: change any player or position with the dropdowns (pinch hitters, defensive moves). Click <b>Staff</b> to change pitchers. Before the first pitch, click two slot numbers to swap them.</div></div>` : ''}
      ${VIEW.pbp ? `<div class="panel pbp"><div class="ph">PLAY-BY-PLAY</div>${G.log.slice(-16).reverse().map(l => `<div class="${l.txt.startsWith('---') ? 'inn' : ''}">${esc(l.txt)}</div>`).join('')}</div>` : ''}
    ${VIEW.settings || VIEW.pbp ? '</div>' : ''}
  </div>
  ${VIEW.scout ? `<div class="gbottom"><div class="scout"><div class="ph">SCOUTING REPORT <button class="mini" onclick="scoutOpen=!scoutOpen;UI.refresh()">${scoutOpen ? 'Hide' : 'Show'}</button></div>${scoutOpen && bid ? scoutHtml(bid, pid, fside, form) : '<div class="small">Plain-English notes on the batter, the pitcher and the runners.</div>'}</div></div>` : ''}`;
  sizeField(); renderField($('field')); renderPop(); UI.lastScore = G.score.slice(); UI.crowdLevel();
  if (!G.over && !G.pregame && !G.intro && G.started && !gSim && bid) { const key = G.gameNo + '|' + bid + '|' + G.pa.length; if (UI.lastBatter !== key) { UI.lastBatter = key; sfx('batter', 0.2, { home: side === 1, name: fullName(bid) }); } }
}
function sizeField() {
  // the field takes the room that is left on screen, so the dice and the manager moves stay in view
  const fw = document.querySelector('.fieldwrap'); if (!fw) return;
  const w = fw.getBoundingClientRect().width || 600; const byWidth = w * vbH() / 600;
  const below = VIEW.cards && VIEW.cardsIn ? 200 : (document.querySelector('.playrow') ? 80 : 0) + 190;   // dice row (and, unless the cards are on the field, the manager moves and game buttons)
  const avail = Math.max(220, innerHeight - fw.getBoundingClientRect().top - below);
  const cap = VIEW.field === 'small' ? Math.min(avail, innerHeight * 0.34) : VIEW.field === 'large' ? avail : Math.min(avail, innerHeight * 0.5);
  const h = Math.max(200, Math.min(byWidth, cap));
  fw.style.height = h + 'px'; const svg = fw.querySelector('svg');
  if (svg) { svg.style.height = h + 'px'; svg.style.width = '100%'; const extra = stadiumLook() ? Math.max(0, Math.min(900, vbH() * w / h - 600)) : 0; gViewX = -Math.round(extra / 2); svg.setAttribute('viewBox', `${gViewX} ${vbY()} ${Math.round(600 + extra)} ${vbH()}`); fw.classList.toggle('classic', !stadiumLook()); if (fw.classList.contains('withcards')) { const side = (w - h * 600 / vbH()) / 2; fw.style.setProperty('--cs', String(clamp(side / 250, 0.8, 1.45).toFixed(2))); } }
}

// ======================= other screens =======================
function scheduleScreen() {
  const root = $('screen'); const nx = nextSchedIdx();
  const teams = D.teams.map(t => t[T.CODE]);
  let h = `<div class="pane"><h2>1977 schedule</h2><div class="btnrow"><label>Team <select onchange="schedTeam=this.value;UI.refresh()"><option value="">All</option>${teams.map(t => `<option${schedTeam === t ? ' selected' : ''}>${t}</option>`).join('')}</select></label><span class="small">Games played: ${Object.keys(S.played).length} of ${D.schedule.length}</span></div><table class="data"><tr><th>#</th><th>Date</th><th>Away</th><th>Home</th><th>Real score</th><th>Replay result</th><th>Park</th></tr>`;
  D.schedule.forEach((r, i) => {
    if (schedTeam && r[SC.AWAY] !== schedTeam && r[SC.HOME] !== schedTeam) return;
    h += `<tr class="${i === nx ? 'next' : ''}${i in S.played ? ' done' : ''}"><td>${r[SC.NO]}</td><td>${r[SC.DATE]}</td><td>${r[SC.AWAY]}</td><td>${r[SC.HOME]}</td><td>${r[SC.RA]}-${r[SC.RH]}</td><td>${esc(S.played[i] || (i === nx ? 'next up' : S.ppd && S.ppd[i] ? 'rained out · makeup ' + S.ppd[i].makeupDate : ''))}${S.ppd && Object.values(S.ppd).some(p => p.makeup === i) ? ' <span class="small">(DH)</span>' : ''}</td><td class="small">${esc(r[SC.PARK])}</td></tr>`;
  });
  root.innerHTML = h + '</table></div>';
}
function boxHtml(a) {
  const ni = Math.max(9, a.innRuns[0].length);
  const w = a.score[0] > a.score[1] ? 0 : a.score[1] > a.score[0] ? 1 : -1;
  let h = `<div class="box"><div class="boxboard"><table class="sb big"><tr><th class="tm"></th>${Array.from({ length: ni }, (_, i) => `<th>${i + 1}</th>`).join('')}<th class="tot">R</th><th class="tot">H</th><th class="tot">E</th></tr>`;
  for (let s = 0; s <= 1; s++) h += `<tr class="${w === s ? 'won' : ''}"><td class="tm">${tmChip(a.teams[s])} ${esc(a.names[s])}</td>${Array.from({ length: ni }, (_, i) => `<td>${a.innRuns[s][i] == null ? (s === 1 && a.bottomSkipped && i === a.innRuns[0].length - 1 ? 'x' : '') : a.innRuns[s][i]}</td>`).join('')}<td class="tot">${a.score[s]}</td><td class="tot">${a.hits[s]}</td><td class="tot">${a.errs[s]}</td></tr>`;
  h += `</table><div class="boxmeta"><b>${esc(a.status)}</b> · ${esc(a.park)}${a.label ? ' · ' + esc(String(a.label).replace(/^#\d+ · /, '')) : ''}${a.att ? ' · attendance ' + fmtNum(a.att) : a.dh === 2 ? ' · second game of the doubleheader' : ''}${a.time ? ' · time ' + a.time : ''}${a.weather ? ' · ' + esc(a.weather) : ''}</div></div>`;
  const dec = p => p.dec ? `<span class="dec ${p.dec[0]}">${esc(p.dec)}</span>` : '';
  h += '<div class="box-cols">';
  for (let s = 0; s <= 1; s++) {
    const tm = a.teams[s]; const tot = {}; BAT_COLS.forEach(c => tot[c] = 0);
    h += `<div class="boxcol"><div class="stcard"><div class="stcard-h" style="background:${teamColor(tm, 1)};border-bottom:3px solid ${teamColor(tm, 2)}">${esc(a.names[s])} batting</div><table class="stbl boxt"><tr><th class="l">Player</th><th>AB</th><th>R</th><th>H</th><th>2B</th><th>3B</th><th>HR</th><th>RBI</th><th>BB</th><th>SO</th><th>SB</th><th>AVG</th></tr>`;
    for (let slot = 1; slot <= 9; slot++) { let first = true; for (const b of a.bat) if (b.team === tm && b.slot === slot) { const star = b.HR > 0 || b.H >= 3 || b.RBI >= 3; h += `<tr class="${first ? '' : 'sub'}${star ? ' star' : ''}"><td class="l">${first ? '' : '<span class="subarrow">↳</span>'}${esc(lastName(b.id))} <span class="pos">${esc(b.pos)}</span></td><td>${b.AB}</td><td>${b.R}</td><td>${b.H}</td><td>${b['2B']}</td><td>${b['3B']}</td><td>${b.HR}</td><td>${b.RBI}</td><td>${b.BB}</td><td>${b.K}</td><td>${b.SB}</td><td class="dim">${b.avg}</td></tr>`; BAT_COLS.forEach(c => tot[c] += b[c]); first = false; } }
    h += `<tr class="tot"><td class="l">Totals</td><td>${tot.AB}</td><td>${tot.R}</td><td>${tot.H}</td><td>${tot['2B']}</td><td>${tot['3B']}</td><td>${tot.HR}</td><td>${tot.RBI}</td><td>${tot.BB}</td><td>${tot.K}</td><td>${tot.SB}</td><td></td></tr></table><div class="boxfoot">Left on base ${a.lob[s]} · errors ${a.errs[s]}</div></div>`;
    h += `<div class="stcard"><div class="stcard-h" style="background:${teamColor(tm, 1)};border-bottom:3px solid ${teamColor(tm, 2)}">${esc(a.names[s])} pitching</div><table class="stbl boxt"><tr><th class="l">Pitcher</th><th>IP</th><th>H</th><th>R</th><th>ER</th><th>BB</th><th>SO</th><th>HR</th><th>ERA</th></tr>`;
    for (const p of a.pit) if (p.team === tm) h += `<tr class="${p.dec ? 'dec-' + p.dec[0] : ''}"><td class="l">${esc(lastName(p.id))} ${dec(p)}</td><td>${ipTxt(p.OUTS)}</td><td>${p.H}</td><td>${p.R}</td><td>${p.ER}</td><td>${p.BB}</td><td>${p.K}</td><td>${p.HR}</td><td class="dim">${p.era}</td></tr>`;
    h += '</table></div></div>';
  }
  h += '</div>' + boxFooter(a) + '</div>';
  return h;
}
// the classic box score footer: E, 2B, 3B, HR, SB, LOB
function boxFooter(a) {
  if (!a.pa || !a.pa.length) return '';
  const byCode = code => { const m = {}; for (const p of a.pa) if (p.code === code) { const k = p.s + '|' + p.id; m[k] = (m[k] || 0) + 1; } return m; };
  const list = (m, tag) => { const parts = [[], []]; for (const k in m) { const [s, id] = k.split('|'); parts[s].push(lastName(id) + (m[k] > 1 ? ' ' + m[k] : '')); } const out = [0, 1].map(s => parts[s].length ? `${friendlyCode(a.teams[s])} ${parts[s].join(', ')}` : '').filter(Boolean).join('; '); return out ? `<div><b>${tag}:</b> ${esc(out)}.</div>` : ''; };
  const sb = {}; for (const p of a.pa) if (p.sb) { const k = p.s + '|' + p.id; sb[k] = (sb[k] || 0) + p.sb; }
  const kk = [0, 1].map(s => a.bat.filter(b => b.team === a.teams[s]).reduce((x, b) => x + b.K, 0));
  const dp = a.pa.filter(p => /DP|double play/i.test(p.txt || '')).length;
  return `<div class="boxnotes">${list(byCode('2B'), '2B')}${list(byCode('3B'), '3B')}${list(byCode('HR'), 'HR')}${list(sb, 'SB')}<div><b>LOB:</b> ${friendlyCode(a.teams[0])} ${a.lob[0]}, ${friendlyCode(a.teams[1])} ${a.lob[1]}.${dp ? ` <b>DP:</b> ${dp}.` : ''} <b>SO:</b> ${friendlyCode(a.teams[0])} ${kk[0]}, ${friendlyCode(a.teams[1])} ${kk[1]}.</div></div>`;
}
function boxScreen() {
  const root = $('screen'); const keys = Object.keys(S.archive).map(Number).sort((a, b) => b - a);
  let a = null;
  if (boxPick === 'current') { if (G.teams[0] && G.lineup[0].length) a = snapGame('Current game'); } else a = S.archive[boxPick];
  let h = `<div class="pane stats">` + heroHtml('Box score', a ? `${esc(a.names[0])} at ${esc(a.names[1])}` : 'No game loaded yet');
  h += `<div class="btnrow"><label class="pick">Game <select onchange="boxPick=this.value;UI.refresh()"><option value="current"${boxPick === 'current' ? ' selected' : ''}>Current game</option>${keys.map(k => `<option value="${k}"${String(boxPick) === String(k) ? ' selected' : ''}>${esc(S.archive[k].label)}</option>`).join('')}</select></label><button class="btn" onclick="window.print()">Print</button><button class="mini" onclick="UI.copyText('box')" title="Copies the box score as plain text, for an e-mail">Copy as text</button></div>`;
  h += a ? boxHtml(a) : '<p class="dim">Start a game and the box score appears here.</p>';
  if (a) { const key = boxPick === 'current' ? G.gameNo : boxPick; h += `<h3 class="sec">Your notes on this game</h3><textarea class="notes" rows="4" placeholder="Who looked good, what you would do differently, anything worth remembering..." onchange="S.notes[${key}]=this.value;saveAll();Net.saveNotes(${key},this.value)">${esc(S.notes[key] || '')}</textarea>`; }
  root.innerHTML = h + '</div>'; UI._box = a;
}
function logScreen() {
  const root = $('screen'); const keys = Object.keys(S.logAll).map(Number).sort((a, b) => b - a);
  let h = `<div class="pane"><h2>Game log</h2><div class="btnrow"><label>Game <select onchange="logPick=this.value;UI.refresh()"><option value="current"${logPick === 'current' ? ' selected' : ''}>Current game</option>${keys.map(k => `<option value="${k}"${String(logPick) === String(k) ? ' selected' : ''}>${esc(S.logAll[k].label)}</option>`).join('')}</select></label><button class="mini" onclick="UI.copyText('log')">Copy as text</button></div>`;
  const log = logPick === 'current' ? G.log : (S.logAll[logPick] ? S.logAll[logPick].log : []);
  h += `<table class="data log">${log.map(l => `<tr class="${l.txt.startsWith('---') ? 'inn' : ''}"><td>${esc(l.team)}</td><td>${esc(l.inn)}</td><td class="l">${esc(l.txt)}</td></tr>`).join('')}</table>`;
  root.innerHTML = h + '</div>'; UI._log = log;
}
UI.copyText = what => {
  let t = '';
  if (what === 'box' && UI._box) { const a = UI._box; t = a.teams[0] + ' ' + a.score[0] + ', ' + a.teams[1] + ' ' + a.score[1] + ' · ' + a.status + '\n' + a.names[0] + ' at ' + a.names[1] + ' · ' + a.park + '\n\n'; for (let s = 0; s <= 1; s++) { t += a.names[s].padEnd(26) + 'ab  r  h bi bb so\n'; for (let slot = 1; slot <= 9; slot++) for (const b of a.bat) if (b.team === a.teams[s] && b.slot === slot) t += (lastName(b.id) + ' ' + b.pos).padEnd(26) + String(b.AB).padStart(2) + String(b.R).padStart(3) + String(b.H).padStart(3) + String(b.RBI).padStart(3) + String(b.BB).padStart(3) + String(b.K).padStart(3) + '\n'; t += '\n' + a.names[s].padEnd(26) + ' ip  h  r er bb so\n'; for (const p of a.pit) if (p.team === a.teams[s]) t += (lastName(p.id) + (p.dec ? ' (' + p.dec + ')' : '')).padEnd(26) + ipTxt(p.OUTS).padStart(4) + String(p.H).padStart(3) + String(p.R).padStart(3) + String(p.ER).padStart(3) + String(p.BB).padStart(3) + String(p.K).padStart(3) + '\n'; t += '\n'; } }
  if (what === 'log' && UI._log) t = UI._log.map(l => l.txt.startsWith('---') ? '\n' + l.txt.toUpperCase() : '  ' + l.team.padEnd(5) + l.txt).join('\n');
  if (!t) return;
  navigator.clipboard.writeText(t).then(() => UI.toast('Copied to the clipboard (paste into a forum post, fixed-width font).'), () => UI.toast('Copy failed.'));
};
function lineupsScreen() {
  const root = $('screen'); const teams = D.teams.map(t => t[T.CODE]); if (!edTeam) edTeam = teams[0];
  const bats = rosterBatters(edTeam), pits = rosterPitchers(edTeam); const st = staffOf(edTeam);
  const luFor = hand => S.myLU[edTeam + '|' + hand] || ((edTeam + '|' + hand) in IX.typ ? lineupFromRow(D.typicallu[IX.typ[edTeam + '|' + hand]]) : Array.from({ length: 9 }, () => ({ id: '', pos: '' })));
  const bOpts = sel => `<option value=""></option>` + bats.map(r => `<option value="${r[B.ID]}"${sel === r[B.ID] ? ' selected' : ''}>${esc(r[B.NAME])} (${handTag(r[B.BATS])})</option>`).join('');
  const pOpts = sel => `<option value=""></option>` + pits.map(r => `<option value="${r[P.ID]}"${sel === r[P.ID] ? ' selected' : ''}>${esc(r[P.NAME])} (${throws_(r[P.ID])}HP)</option>`).join('');
  const luTbl = hand => { const lu = luFor(hand); return `<table class="data ed" data-hand="${hand}"><tr><th colspan="3" class="l">vs ${hand === 'R' ? 'right-handed' : 'left-handed'} pitching</th></tr>${lu.map((s, i) => `<tr><td>${i + 1}</td><td><select class="edpos">${POS_OPTS.filter(p => p !== 'PH').map(p => `<option${String(s.pos).toUpperCase() === p ? ' selected' : ''}>${p}</option>`).join('')}</select></td><td><select class="edplr">${bOpts(s.pos === 'P' ? '' : s.id)}</select></td></tr>`).join('')}</table>`; };
  root.innerHTML = `<div class="pane"><h2>Lineups editor</h2><p class="small">Set each team's saved lineup vs righties and lefties, its rotation and its closer. Used when Options → Lineups is "My saved lineups" (and for the rotation in every mode). A "P" spot is the pitcher.</p>
  <div class="btnrow"><label>Team <select onchange="edTeam=this.value;UI.refresh()">${teams.map(t => `<option${edTeam === t ? ' selected' : ''}>${t}</option>`).join('')}</select></label><button class="btn go" onclick="Actions.edSave()">Save</button><button class="btn" onclick="Actions.edReset()">Reset to typical 1977 lineups</button></div>
  <div class="edgrid">${luTbl('R')}${luTbl('L')}<table class="data ed" id="edStaff"><tr><th colspan="2" class="l">Rotation and closer</th></tr>${[0, 1, 2, 3, 4].map(i => `<tr><td>SP ${i + 1}</td><td><select class="edrot">${pOpts(st.rot[i] || '')}</select></td></tr>`).join('')}<tr><td>Closer</td><td><select id="edCloser">${pOpts(st.closer)}</select></td></tr></table></div></div>`;
}
Actions.edSave = () => {
  for (const hand of ['R', 'L']) { const tbl = document.querySelector(`table.ed[data-hand="${hand}"]`); const lu = []; tbl.querySelectorAll('tr').forEach(tr => { const ps = tr.querySelector('.edpos'), pl = tr.querySelector('.edplr'); if (ps) lu.push({ pos: ps.value, id: ps.value === 'P' ? 'PITCHER' : pl.value }); });
    const ids = lu.map(x => x.id).filter(x => x && x !== 'PITCHER'); const dup = ids.find((x, k) => ids.indexOf(x) !== k); if (dup) { UI.alert(fullName(dup) + ' is in the vs ' + hand + 'HP lineup twice. Fix that first.'); return; }
    S.myLU[edTeam + '|' + hand] = lu; }
  const rot = []; document.querySelectorAll('#edStaff .edrot').forEach(s => { if (s.value) rot.push(s.value); });
  const st = staffOf(edTeam); if (rot.length) st.rot = rot; const cl = $('edCloser').value; if (cl) st.closer = cl; S.staff[edTeam] = st;
  saveAll(); UI.toast('Saved ' + edTeam + "'s lineups and rotation.");
};
Actions.edReset = async () => {
  if (!await UI.confirm('Put ' + edTeam + "'s saved lineups back to the 1977 typical lineups?", 'Reset lineups')) return;
  for (const hand of ['R', 'L']) { const k = edTeam + '|' + hand; if (k in IX.typ) S.myLU[k] = lineupFromRow(D.typicallu[IX.typ[k]]); }
  const r = D.staff[IX.staff[edTeam]]; if (r) S.staff[edTeam] = { rot: String(r[1] || '').split(',').filter(Boolean), closer: r[2] || '', pen: String(r[3] || '').split(',').filter(Boolean) };
  saveAll(); UI.refresh();
};
function poReadForm() {
  const po = S.playoffs; po.n = clamp(num($('poN').value) || 2, 1, 8); po.bo[4] = num($('poB4').value) || 5; po.bo[3] = num($('poB3').value) || 5; po.bo[2] = num($('poB2').value) || 3; po.ws = num($('poWS').value) || 7; po.hf = $('poHF').value;
  po.typed = { AL: [], NL: [] }; document.querySelectorAll('.poseed').forEach(s => { if (s.value) po.typed[s.dataset.lg][num(s.dataset.i)] = s.value; });
  po.typed.AL = po.typed.AL.filter(Boolean); po.typed.NL = po.typed.NL.filter(Boolean);
}
Actions.poSetup = () => { poReadForm(); setupBracket(); UI.refresh(); UI.toast('Bracket set. Click Play next playoff game.'); };
Actions.poPlay = () => { if (busy) return; runAction(async () => { if (await playNextPlayoff()) curScreen = 'game'; }, { undo: false }); };
Actions.poReset = () => { runAction(async () => { await resetPlayoffs(); }, { undo: false }); };
const OPTION_GROUPS = [
  ['The season', ['Games', 'Lineups', 'Injuries', 'Pitcher rest days', 'Tired pitcher cutoff', 'DH rule', 'Splits', 'Park effects', 'Weather', 'Rainouts']],
  ['How a play goes', ['Click to play results', 'Card lookup', 'Solo dice mode', 'Mode', 'Send/hold prompts', 'Pickoffs', 'Computer steals', 'Surprise steals', 'Momentum', 'Pitcher daily form', 'Warm-up tosses', 'At the wall']],
  ['Pop-ups', ['Pop-ups', 'Fielding check pop-ups', 'Runner pop-ups', 'Steal and pickoff pop-ups', 'Big lead pop-ups', 'Close plays at first', 'Manager arguments', 'The pivot', 'Plays at the plate', 'Error pop-ups']],
  ['Looks and sound', ['Ballpark look', 'Lineup announcements', 'Bouton tribute']],
];
function optionsScreen() {
  const root = $('screen'); const placed = new Set();
  let h = `<div class="pane stats">` + heroHtml('Options', 'How the game plays. Everything is saved automatically' + (Net.available && Net.user ? ', here and to your account' : '') + '.');
  const row = d => { let choices = OPTION_CHOICES[d.name] || ['On', 'Off']; const v = opt(d.name); placed.add(d.name);
    return `<div class="optrow"><div class="opt-n">${esc(d.name)}</div><div class="opt-s"><select onchange="Actions.setOpt('${esc(d.name)}',this.value)">${choices.map(c => `<option${c === v ? ' selected' : ''}>${esc(c)}</option>`).join('')}</select></div><div class="opt-h">${esc(d.help)}</div></div>`; };
  const groups = OPTION_GROUPS.map(([t, names]) => [t, names.map(n => OPTION_DEFS.find(d => d.name === n)).filter(Boolean)]);
  const rest = OPTION_DEFS.filter(d => !groups.some(g => g[1].includes(d))); if (rest.length) groups.push(['Other', rest]);
  for (const [title, defs] of groups) h += `<div class="optcard"><div class="stcard-h">${esc(title)}</div>${defs.map(row).join('')}</div>`;
  h += `<div class="btnrow end"><button class="btn warn" onclick="Actions.resetOptions()">Put every option back to normal</button></div></div>`;
  root.innerHTML = h;
}
Actions.setOpt = (nm, v) => { O[nm] = v; saveAll(); UI.refresh(); };
Actions.resetOptions = () => { O = optDefaults(); saveAll(); UI.refresh(); };
Actions.exportSave = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([exportJSON()], { type: 'application/json' })); a.download = 'BallFive_1977_save.json'; a.click(); };
Actions.importSave = async f => { if (!f) return; try { importJSON(await f.text()); UI.refresh(); UI.toast('Save imported.'); } catch (e) { UI.alert('Could not import: ' + e.message); } };
function helpScreen() {
  const root = $('screen'); const rm = D.readme;
  const start = rm.findIndex(s => s.startsWith('HOW A ROLL WORKS')); const body = rm.slice(start >= 0 ? start : 0).filter(s => !s.startsWith('SETUP') && !/^\d\. /.test(s) && !s.includes('Alt+F8') && !s.includes('Alt+F11'));
  let h = `<div class="pane help"><h2>Ball Five Baseball · 1977 · how to play</h2><p><i>${esc(rm[2] || '')}</i></p>
  <p>This is the web edition of the Excel game. Click the dice to play a plate appearance; one roll of 1-1000 reads the batter's card (1-500) or the pitcher's card (501-1000). Everything saves itself in this browser.</p>
  <h3>THE SHORT VERSION</h3><p>The big yellow button above the field always says what to do next: roll warm-up tosses, roll the dice, play the lit result, roll a fielding check, or go to the next game. Click it, or press the space bar. Everything else is optional.</p><p>Before you roll you can make a manager move with the buttons under the field (Steal, Bunt, Hit and run, Intentional walk, Pitchout). Each button says what it would do right now. Change players, positions or the pitcher with the dropdowns in the lineups. Click Staff to see how rested each pitcher is.</p><p>Want to roll real dice? Click <b>I roll my own</b> under the dice. Each roll then asks for your three ten-sided dice (hundreds, tens, ones; 000 counts as 1000) and, for an at-bat, the two location dice if you like. It shows what the roll lands on before you play it, and you can hand any single roll back to the computer.</p><p>Sound effects and bigger text can be switched on or off with the buttons at the top right. Undo takes back one play. Options → Export save keeps a copy of your season.</p>`;
  for (const s of body) { if (/^[A-Z][A-Z ,'\/\(\)-]+:$/.test(s.trim()) || /^[A-Z][A-Z ,'\/\(\)0-9.-]+:$/.test(s.trim())) h += `<h3>${esc(s)}</h3>`; else h += `<p>${esc(s)}</p>`; }
  root.innerHTML = h + '</div>';
}

// ======================= scorebook =======================
let bookPick = 'current';
function scorebookHtml(a) {
  // a: snapshot with pa, lineup, teams, names, inn, bat, score, hits, errs
  const ni = Math.max(9, a.inn || 9); let h = `<div class="book"><div class="box-t">${esc(a.names[0])} ${a.score[0]}, ${esc(a.names[1])} ${a.score[1]} · ${esc(a.status)}</div><div class="box-s">${esc(a.park)}${a.label ? ' · ' + esc(a.label) : ''}</div>`;
  for (let s = 0; s <= 1; s++) {
    const tm = a.teams[s]; const pas = (a.pa || []).filter(p => p.s === s);
    h += `<table class="data sbook"><tr><th class="l" style="min-width:150px">${esc(a.names[s])}</th>${Array.from({ length: ni }, (_, i) => `<th>${i + 1}</th>`).join('')}<th>AB</th><th>R</th><th>H</th><th>RBI</th></tr>`;
    for (let slot = 1; slot <= 9; slot++) {
      const bats = []; for (const p of pas) if (p.slot === slot && !bats.includes(p.id)) bats.push(p.id);
      for (const b of a.bat) if (b.team === tm && b.slot === slot && !bats.includes(b.id)) bats.push(b.id);
      if (!bats.length) { const lu = a.lineup && a.lineup[s][slot - 1]; bats.push(lu && lu.id ? lu.id : ''); }
      bats.forEach((bid, bi) => {
        const line = a.bat.find(b => b.id === bid) || { AB: 0, R: 0, H: 0, RBI: 0, pos: '' };
        h += `<tr><td class="l">${bi ? '&nbsp;&nbsp;↳ ' : '<b>' + slot + '</b> '}${esc(bid ? lastName(bid) : '')} <small>${esc(line.pos || '')}</small></td>`;
        for (let inn = 1; inn <= ni; inn++) {
          const cell = pas.filter(p => p.id === bid && p.inn === inn);
          h += `<td class="bc">${cell.map(p => `<div class="pa ${/^(1B|2B|3B|HR|BB|IBB|HBP|E)/.test(p.code) ? 'on' : 'out'}${p.scored ? ' run' : ''}"><span class="code">${esc(p.code)}</span>${p.rbi ? '<span class="rbi">' + '•'.repeat(Math.min(p.rbi, 4)) + '</span>' : ''}${p.sb ? '<span class="sb">SB</span>' : ''}${p.scored ? '<span class="dia">◆</span>' : ''}</div>`).join('')}</td>`;
        }
        h += `<td>${line.AB}</td><td>${line.R}</td><td>${line.H}</td><td>${line.RBI}</td></tr>`;
      });
    }
    h += `<tr class="tot"><td class="l">Runs</td>${Array.from({ length: ni }, (_, i) => `<td>${a.innRuns[s][i] == null ? '' : a.innRuns[s][i]}</td>`).join('')}<td colspan="4">${a.score[s]} R · ${a.hits[s]} H · ${a.errs[s]} E</td></tr></table>`;
  }
  h += `<div class="small">Notation: 6-3 ground out (shortstop to first), 3U unassisted, F8 fly out, L6 line out, P4 pop out, K strikeout, ꓘ called third strike, FC fielder's choice, SAC sacrifice bunt, SF sacrifice fly, E5 reached on error, DP double play. ◆ scored a run, • each RBI, SB stole a base.</div></div>`;
  return h;
}
function scorebookScreen() {
  const root = $('screen'); const keys = Object.keys(S.archive).map(Number).sort((a, b) => b - a);
  let h = `<div class="pane"><h2>Scorebook</h2><div class="btnrow"><label>Game <select onchange="bookPick=this.value;UI.refresh()"><option value="current"${bookPick === 'current' ? ' selected' : ''}>Current game</option>${keys.map(k => `<option value="${k}"${String(bookPick) === String(k) ? ' selected' : ''}>${esc(S.archive[k].label)}</option>`).join('')}</select></label><button class="mini" onclick="window.print()">Print this page</button></div>`;
  let a = null;
  if (bookPick === 'current') { if (G.teams[0] && G.lineup[0].length) a = snapGame('Current game'); } else a = S.archive[bookPick];
  h += a ? scorebookHtml(a) : '<p>No game loaded.</p>';
  if (a) { const key = bookPick === 'current' ? G.gameNo : bookPick; h += `<h3>Notes on this game</h3><textarea class="notes" rows="3" placeholder="Your own notes..." onchange="S.notes[${key}]=this.value;saveAll();Net.saveNotes(${key},this.value)">${esc(S.notes[key] || '')}</textarea>`; }
  root.innerHTML = h + '</div>';
}

// ======================= account and database =======================
let acctMode = 'login', acctData = null;
function accountScreen() {
  const root = $('screen');
  if (!Net.available) {
    root.innerHTML = `<div class="pane"><h2>Account</h2><p>This copy of the game is running straight from a file, so there is no sign-in and no database: everything is saved in this browser only (Options → Export save keeps a copy).</p><p>The web-app version adds accounts and a stats database. It comes as a small server program: start it, open its address in a browser, and sign in. See the README in the server folder for the steps.</p></div>`; return;
  }
  if (!Net.user) {
    root.innerHTML = `<div class="pane acct"><h2>${acctMode === 'login' ? 'Sign in' : 'Create an account'}</h2>
      <p class="small">Your season and every game you finish are saved under your account, so you can play from any computer. ${Net.lastErr ? '<span style="color:#c00">' + esc(Net.lastErr) + '</span>' : ''}</p>
      <form id="acctForm" onsubmit="Actions.acctSubmit(event)">
        ${acctMode === 'register' ? '<label>Your name<input name="name" type="text" required maxlength="60" autocomplete="name"></label>' : ''}
        <label>Email<input name="email" type="email" required autocomplete="email"></label>
        <label>Password<input name="password" type="password" required ${acctMode === 'register' ? 'minlength="6"' : ''} autocomplete="${acctMode === 'login' ? 'current-password' : 'new-password'}"></label>
        <div id="acctErr" class="acct-err"></div>
        <div class="btnrow"><button class="btn primary" type="submit" style="width:auto">${acctMode === 'login' ? 'SIGN IN' : 'CREATE ACCOUNT'}</button><button class="btn" type="button" onclick="acctMode='${acctMode === 'login' ? 'register' : 'login'}';UI.refresh()">${acctMode === 'login' ? 'New here? Create an account' : 'Already have an account? Sign in'}</button></div>
      </form>
      <p class="small">Playing without signing in keeps everything in this browser only.</p></div>`;
    return;
  }
  const u = Net.user;
  let h = `<div class="pane acct"><h2>Account</h2><p><b>${esc(u.name)}</b> · ${esc(u.email)} · signed in</p>
    <p>Games in the database: <b>${Net.games}</b> (${Net.counted} in the season, the rest exhibitions and playoffs). Season saved to the server ${S.savedAt ? 'at ' + new Date(S.savedAt).toLocaleString() : 'not yet'}.${Net.queue.length ? ' <span style="color:#c00">' + Net.queue.length + ' game(s) waiting to be sent.</span>' : ''}${Net.lastErr ? ' <span style="color:#c00">Last sync problem: ' + esc(Net.lastErr) + '</span>' : ''}</p>
    <div class="btnrow"><button class="btn" onclick="Actions.acctLogout()">Sign out</button><button class="btn" onclick="Actions.acctLoadStats()">Show all-time totals from the database</button><button class="btn" onclick="Net.flushQueue();Net.pushSave();UI.toast('Syncing...')">Sync now</button></div>`;
  if (acctData) {
    h += `<h3>All-time batting (database)</h3><table class="data"><tr><th class="l">Player</th><th>Tm</th><th>G</th><th>AB</th><th>R</th><th>H</th><th>2B</th><th>3B</th><th>HR</th><th>RBI</th><th>BB</th><th>K</th><th>SB</th><th>AVG</th><th>OPS</th></tr>${acctData.bat.slice(0, 40).map(r => { const ob = (r.ab + r.bb + r.hbp + r.sf) > 0 ? (r.h + r.bb + r.hbp) / (r.ab + r.bb + r.hbp + r.sf) : 0, sl = r.ab > 0 ? (r.h + r.d + 2 * r.t + 3 * r.hr) / r.ab : 0; return `<tr><td class="l">${esc(r.name)}</td><td>${friendlyCode(r.team)}</td><td>${r.g}</td><td>${r.ab}</td><td>${r.r}</td><td>${r.h}</td><td>${r.d}</td><td>${r.t}</td><td>${r.hr}</td><td>${r.rbi}</td><td>${r.bb}</td><td>${r.k}</td><td>${r.sb}</td><td>${avg3(r.h, r.ab)}</td><td>${r.ab ? fmt3(ob + sl) : '---'}</td></tr>`; }).join('')}</table>`;
    h += `<h3>All-time pitching (database)</h3><table class="data"><tr><th class="l">Pitcher</th><th>Tm</th><th>G</th><th>GS</th><th>W</th><th>L</th><th>SV</th><th>IP</th><th>H</th><th>ER</th><th>BB</th><th>K</th><th>ERA</th></tr>${acctData.pit.slice(0, 40).map(r => `<tr><td class="l">${esc(r.name)}</td><td>${friendlyCode(r.team)}</td><td>${r.g}</td><td>${r.gs}</td><td>${r.w}</td><td>${r.l}</td><td>${r.sv}</td><td>${ipTxt(r.outs)}</td><td>${r.h}</td><td>${r.er}</td><td>${r.bb}</td><td>${r.k}</td><td>${r.outs ? fmt2(r.er * 27 / r.outs) : '-.--'}</td></tr>`).join('')}</table>`;
    h += `<h3>Games stored (newest first)</h3><table class="data"><tr><th>#</th><th class="l">Game</th><th>Score</th><th class="l">W</th><th class="l">L</th><th class="l">Notes</th></tr>${acctData.games.map(g => `<tr><td>${g.game_no}</td><td class="l">${esc(g.label)}${g.exhibition ? ' (exhibition)' : ''}${g.playoff ? ' (playoff)' : ''}</td><td>${g.away} ${g.away_runs}, ${g.home} ${g.home_runs}${g.innings > 9 ? ' (' + g.innings + ')' : ''}</td><td class="l">${esc(g.winning_pitcher)}</td><td class="l">${esc(g.losing_pitcher)}</td><td class="l small">${esc(g.notes || '')}</td></tr>`).join('')}</table>`;
  }
  root.innerHTML = h + '</div>';
}
Actions.acctSubmit = async e => {
  e.preventDefault(); const f = new FormData($('acctForm')); const err = $('acctErr');
  try {
    if (acctMode === 'login') await Net.login(f.get('email'), f.get('password')); else await Net.register(f.get('email'), f.get('name'), f.get('password'));
    const pulled = await Net.pullSave(); if (!pulled) Net.pushSave(); Net.flushQueue();
    UI.toast('Signed in as ' + Net.user.name + (pulled ? '. Your season came down from the server.' : '.')); curScreen = 'game'; UI.refresh();
  } catch (ex) { err.textContent = ex.message; }
};
Actions.acctLogout = async () => { await Net.logout(); acctData = null; UI.toast('Signed out. The game keeps playing in this browser only.'); UI.refresh(); };
Actions.acctLoadStats = async () => { try { const [b, p, g] = await Promise.all([Net.api('GET', '/api/stats/batting'), Net.api('GET', '/api/stats/pitching'), Net.api('GET', '/api/games?limit=100')]); acctData = { bat: b.rows, pit: p.rows, games: g.games }; UI.refresh(); } catch (e) { UI.alert('Could not load: ' + e.message); } };
UI.syncState = () => { const el = $('sync'); if (!el) return; if (!Net.available) { el.textContent = ''; return; } el.textContent = Net.user ? (Net.lastErr ? '⚠ not synced' : '☁ ' + Net.user.name) : '○ not signed in'; el.title = Net.lastErr || (Net.user ? 'Saved to your account' : 'Click Account to sign in'); el.onclick = () => Actions.showScreen('account'); };

// ======================= refresh =======================
const SCREENS = { game: ['Game', gameScreen], paper: ['Gazette', paperScreen], scorebook: ['Scorebook', scorebookScreen], box: ['Box score', boxScreen], log: ['Log', logScreen], schedule: ['Schedule', scheduleScreen], standings: ['Standings & race', standingsScreen], leaders: ['Leaders & awards', leadersScreen], season: ['Season stats', seasonScreen], cards: ['Cards', cardsScreen], parks: ['Ballparks', parksScreen], lineups: ['Lineups', lineupsScreen], playoffs: ['Playoffs', playoffsScreen], options: ['Options', optionsScreen], help: ['Help', helpScreen], account: ['Account', accountScreen] };
// the menu: one tab for the game, then a dropdown for each kind of thing
Actions.navOpen = el => { const was = el.classList.contains('open'); document.querySelectorAll('.navg.open').forEach(x => x.classList.remove('open')); if (!was) el.classList.add('open'); };
const NAV_GROUPS = [['game'], ['Reading', 'paper', 'box', 'scorebook', 'log'], ['Season', 'schedule', 'standings', 'leaders', 'season', 'playoffs'], ['Teams', 'lineups', 'cards', 'parks'], ['Settings', 'options', 'help', 'account']];
Actions.toggleSound = () => { Snd.toggle(); UI.refresh(); };
Actions.toggleDark = () => { document.body.classList.toggle('dark'); try { localStorage.setItem('BF5_dark', document.body.classList.contains('dark') ? '1' : '0'); } catch (e) {} UI.refresh(); };
Actions.toggleBig = () => { document.body.classList.toggle('big'); try { localStorage.setItem('BF5_bigtext', document.body.classList.contains('big') ? '1' : '0'); } catch (e) {} UI.refresh(); };
UI.refresh = () => {
  const nav = $('nav'); nav.innerHTML = NAV_GROUPS.map(g => {
    if (g.length === 1) { const k = g[0]; return `<button class="tab${curScreen === k ? ' on' : ''}" onclick="Actions.showScreen('${k}')">${SCREENS[k][0]}</button>`; }
    const title = g[0], keys = g.slice(1), here = keys.includes(curScreen);
    return `<div class="navg${here ? ' here' : ''}"><button class="tab${here ? ' on' : ''}" onclick="Actions.navOpen(this.parentNode)">${title}${here ? ' · ' + SCREENS[curScreen][0] : ''} <span class="caret">▾</span></button><div class="navdd">${keys.map(k => `<button class="navitem${curScreen === k ? ' on' : ''}" onclick="Actions.showScreen('${k}')">${SCREENS[k][0]}</button>`).join('')}</div></div>`;
  }).join('');
  const tools = $('tools'); if (tools) tools.innerHTML = `<span id="sync" class="sync"></span><button class="tool" onclick="Actions.viewMenu()" title="Choose what is on the game screen">☰ View</button><button class="tool" onclick="Actions.toggleSound()" title="Sound effects on or off">${Snd.on ? '🔊 Sound on' : '🔇 Sound off'}</button><input type="range" class="vol" min="0" max="100" value="${Math.round(Snd.vol * 100)}" title="Volume" oninput="Snd.setVol(this.value/100)" onchange="sfx('hit',0,{home:true})"><button class="tool" onclick="Actions.toggleDark()" title="Dark or light screen">${document.body.classList.contains('dark') ? '☀ Light mode' : '🌙 Dark mode'}</button><button class="tool" onclick="Actions.toggleBig()" title="Bigger text">${document.body.classList.contains('big') ? 'A Normal text' : 'A+ Bigger text'}</button>`;
  UI.syncState();
  try { SCREENS[curScreen][1](); document.documentElement.style.setProperty('--topH', $('top').offsetHeight + 'px'); } catch (e) { console.error(e); $('screen').innerHTML = '<div class="pane"><p>Something went wrong drawing this screen: ' + esc(e.message) + '</p></div>'; }
};
function showTribute() {
  const m = $('modal'); m.classList.remove('hidden');
  m.innerHTML = `<div class="tribute"><div class="tcard"><div class="tband">Jim Bouton</div><div class="tsub">NEW YORK YANKEES · 1963 · Pitcher · Throws R</div><div class="tstrip">21-7 · 2.53 ERA · 249 IP · 148 K</div></div><div class="ttext"><h1>JIM BOUTON</h1><h2>1939-2019</h2><p>${esc(D.readme[2].replace('DEDICATED TO JIM BOUTON (1939-2019): ', ''))}</p><button class="btn gold" id="tbGo">PLAY BALL</button></div></div>`;
  $('tbGo').onclick = () => { m.classList.add('hidden'); m.innerHTML = ''; };
}
document.addEventListener('click', e => { if (!e.target.closest('.navg')) document.querySelectorAll('.navg.open').forEach(x => x.classList.remove('open')); });
document.addEventListener('mouseover', e => { const g = e.target.closest('.navg'); if (!g) return; const o = document.querySelector('.navg.open'); if (o && o !== g) { o.classList.remove('open'); g.classList.add('open'); } });
document.addEventListener('mouseout', e => { const g = e.target.closest('.navg'); if (g && !g.contains(e.relatedTarget)) g.classList.remove('open'); });
window.addEventListener('DOMContentLoaded', async () => {
  loadAll(); Net.load();
  if (Net.available) { await Net.me(); if (Net.user) { await Net.pullSave(); Net.flushQueue(); } }
  if (!G.teams[0]) { /* nothing loaded yet */ }
  document.addEventListener('keydown', e => { if ((e.code === 'Space' || e.code === 'Enter') && curScreen === 'game' && $('modal').classList.contains('hidden') && !['SELECT', 'INPUT', 'BUTTON', 'TEXTAREA'].includes(document.activeElement.tagName)) { e.preventDefault(); Actions.primary(); } });
  Snd.load(); try { if (localStorage.getItem('BF5_bigtext') === '1') document.body.classList.add('big'); if (localStorage.getItem('BF5_dark') === '1') document.body.classList.add('dark'); } catch (e) {}
  document.addEventListener('click', e => { if (e.target.closest('button.btn:not(.primary), .tab, .mini')) sfx('click'); }, true);
  let rt; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { if (curScreen === 'game' && !busy) UI.refresh(); }, 250); });
  UI.refresh();
  if (opt('Bouton tribute') !== 'Off' && !localStorage.getItem('BF5_tribute_seen')) { localStorage.setItem('BF5_tribute_seen', '1'); showTribute(); }
});
