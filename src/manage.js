/* manage.js: loading teams, game flow, end of game, season records, standings, leaders, playoffs */
'use strict';

function nextSchedIdx() { for (let i = 0; i < D.schedule.length; i++) if (!(i in S.played)) return i; return -1; }
function realLURow(gid, team) { const k = gid + '|' + team; return (k in IX.real) ? D.reallu[IX.real[k]] : null; }
function schedGamesTotal() { return D.schedule.length; }

function loadTeams(mode) {
  // mode: {kind:'schedule'} | {kind:'exhib', away, home} | {kind:'playoff', away, home, row}
  mode = mode || { kind: 'schedule' };
  const keepGameNo = G.gameNo;
  const ng = newGame(); ng.gameNo = S.gameNo + 1; S.gameNo = ng.gameNo;
  ng.injuriesOff = false;
  if (mode.kind === 'schedule' && opt('Games').includes('schedule')) {
    const si = nextSchedIdx(); if (si < 0) { UI.alert('The 1977 schedule is finished!'); S.gameNo = keepGameNo; return false; }
    const sr = D.schedule[si]; ng.teams = [sr[SC.AWAY], sr[SC.HOME]]; ng.sched = si; ng.dayNo = num(sr[SC.DAY]);
  } else if (mode.kind === 'schedule') {
    ng.teams = mode.away && mode.home ? [mode.away, mode.home] : (G.teams[0] ? G.teams.slice() : ['', '']); ng.exhib = true;
  } else { ng.teams = [mode.away, mode.home]; ng.exhib = mode.kind === 'exhib'; ng.playoffRow = mode.kind === 'playoff' ? mode.row : -1; }
  if (!teamRow(ng.teams[0]) || !teamRow(ng.teams[1])) { UI.alert('Pick an Away and a Home team first.'); S.gameNo = keepGameNo; return false; }
  const gid = ng.sched >= 0 ? D.schedule[ng.sched][SC.GID] : '';
  G = ng;
  const lmode = opt('Lineups'); let useReal = lmode === 'Real for each game' && gid !== '';
  if (useReal && (!realLURow(gid, G.teams[0]) || !realLURow(gid, G.teams[1]))) useReal = false;
  const note = []; const starter = ['', ''];
  for (let side = 0; side <= 1; side++) {
    const team = G.teams[side];
    starter[side] = useReal ? realLURow(gid, team)[2] : pickStarter(side, team, note);
  }
  let useDH; const dh = opt('DH rule');
  if (dh === 'Always') useDH = true; else if (dh === 'Never') useDH = false; else useDH = dhYear(teamLeague(G.teams[1]), seasonYr());
  for (let side = 0; side <= 1; side++) {
    const team = G.teams[side], hand = throws_(starter[1 - side]);
    G.pitcher[side] = starter[side];
    let ids = [], pos = [], hasDH = false;
    if (useReal) {
      const rl = realLURow(gid, team);
      for (let i = 1; i <= 9; i++) { ids.push(rl[1 + 2 * i]); pos.push(rl[2 + 2 * i]); if (pos[i - 1] === 'P') ids[i - 1] = 'PITCHER'; }
    } else {
      let lu = lmode === 'Typical' ? null : S.myLU[team + '|' + hand];
      if (!lu) { const k = team + '|' + hand; lu = (k in IX.typ) ? lineupFromRow(D.typicallu[IX.typ[k]]) : null; }
      if (!lu) { const k2 = team + '|' + (hand === 'L' ? 'R' : 'L'); lu = (k2 in IX.typ) ? lineupFromRow(D.typicallu[IX.typ[k2]]) : []; }
      for (let i = 0; i < 9; i++) { const s = lu[i] || { id: '', pos: '' }; ids.push(s.pos === 'P' ? 'PITCHER' : s.id); pos.push(s.pos); if (s.pos === 'DH') hasDH = true; }
      if (useDH && !hasDH) { const best = bestSub(team, 'DH', ids); for (let i = 0; i < 9; i++) if (ids[i] === 'PITCHER' && best) { ids[i] = best; pos[i] = 'DH'; } }
      else if (!useDH && hasDH) {
        let j = -1; for (let i = 0; i < 9; i++) if (pos[i] === 'DH') j = i;
        if (j >= 0) { for (let i = j; i < 8; i++) { ids[i] = ids[i + 1]; pos[i] = pos[i + 1]; } ids[8] = 'PITCHER'; pos[8] = 'P'; }
      }
      for (let i = 0; i < 9; i++) {
        if (ids[i] && ids[i] !== 'PITCHER' && !isAvail(ids[i], team)) { const sub2 = bestSub(team, pos[i], ids); if (sub2) { note.push(lastName(ids[i]) + ' out, ' + lastName(sub2) + ' plays ' + pos[i]); ids[i] = sub2; } }
      }
    }
    G.lineup[side] = []; for (let i = 0; i < 9; i++) G.lineup[side].push({ pos: pos[i] || '', id: ids[i] === 'PITCHER' ? '' : (ids[i] || '') });
  }
  resetGame();
  addLog('--- Top of the 1st ---');
  if (note.length) addLog('Injuries: ' + note.join('; ') + '.');
  saveAll();
  return true;
}
function resetGame() {
  G.inn = 1; G.half = 0; G.outs = 0; G.bases = ['', '', '']; G.innRuns = [[0], [0]];
  G.title = G.sched >= 0 ? seasonYr() + ' game ' + (G.sched + 1) + ' of ' + schedGamesTotal() + ' · ' + D.schedule[G.sched][SC.DATE] + ' · ' + parkName()
    : (G.exhib ? 'EXHIBITION · ' + parkName() + " · doesn't count" : 'Game · ' + parkName());
  rollWeather();
  if (windText()) G.title += ' · ' + windText();
  G.rollTxt = teamCode(0) + ' at ' + teamCode(1) + '. Click the dice to play ball.';
  G.playTxt = ''; G.extra = '';
  gPitID = ''; gBatID = '';
  ensurePitchers(); syncLineupBox();
  G.wuRoll = [0, 0];
  if (popOpt('Warm-up tosses') && opt('Pitcher daily form') !== 'Off' && !solo() && !gSim && (G.formNeed[0] === 1 || G.formNeed[1] === 1)) {
    G.pregame = 1; if (G.formNeed[0] === 0) G.pregame = 3;
    G.rollTxt = teamCode(0) + ' at ' + teamCode(1) + '. Warm-up tosses first.';
    G.playTxt = "Click the pop-up to roll each starter's warm-up tosses, then Ready to play.";
  } else G.pregame = 0;
  G.rollLeads = true;
}
async function restartGame() {
  if (G.over) { UI.toast('This game is final and already saved. Click Play next game.'); return; }
  if (!await UI.confirm('Start this game over from the first pitch? Every play so far will be erased.', 'Restart game')) return;
  const mode = G.playoffRow >= 0 ? { kind: 'playoff', away: G.teams[0], home: G.teams[1], row: G.playoffRow } : G.exhib ? { kind: 'exhib', away: G.teams[0], home: G.teams[1] } : { kind: 'schedule' };
  S.gameNo--; // the restarted game keeps its number
  loadTeams(mode);
}
async function playNextGame() {
  if (!G.over && G.started && !await UI.confirm("This game isn't finished. Start a new game anyway? (This game won't be saved.)", 'Next game')) return;
  if (S.playoffs && S.playoffs.mode) { await playNextPlayoff(); return; }
  loadTeams({ kind: 'schedule' });
}
async function simNextGame() {
  if (G.over) { if (S.playoffs && S.playoffs.mode) { if (!await playNextPlayoff()) return; } else if (!loadTeams({ kind: 'schedule' })) return; }
  else if (!G.started && (!curPitcherID(0) || !curPitcherID(1))) { if (!loadTeams({ kind: 'schedule' })) return; }
  if (G.over) return;
  G.pregame = 0; G.pend = null; gSim = true;
  try {
    let k = 0;
    while (!G.over && k < 1500) { await nextAtBat(); G.pend = null; k++; }
  } catch (e) { console.error(e); UI.alert('The sim stopped: ' + e.message); }
  gSim = false;
  G.rollLeads = true;
}
async function restartSeason() {
  if (!await UI.confirm('Start the whole season over?\n\nEvery game played, the standings, season stats, leaders, box scores, the log and the playoffs will be erased. Your lineups and options stay.\n\nThis can\'t be undone.', 'Restart season')) return;
  const keep = { myLU: S.myLU, staff: S.staff };
  S = newSeason(); S.myLU = keep.myLU; S.staff = keep.staff;
  G = newGame();
  loadTeams({ kind: 'schedule' });
  UI.toast('The season starts over: game 1 is loaded.');
}

// ---- end of game ----
function endGame() {
  G.over = true; G.pend = null;
  const [sA, sH] = G.score; const w = sA > sH ? 0 : 1;
  let wP = G.pitWin, lp = G.pitLose; const startW = G.startPit[w];
  if (wP === startW) {
    const r = boxPitFind(wP);
    if (r && r.OUTS < 15) { let best = '', bestOuts = -1; for (const x of G.boxPit) if (x.team === teamCode(w) && x.id !== startW && x.OUTS > bestOuts) { bestOuts = x.OUTS; best = x.id; } if (best) wP = best; }
  }
  let cur = G.curPit[w], sv = '';
  if (cur !== wP && cur) { if (G.entLead[w] >= 1 && G.entLead[w] <= 3) sv = cur; const r = boxPitFind(cur); if (r && r.OUTS >= 9) sv = cur; }
  let r; r = boxPitFind(wP); if (r) r.W = 1; r = boxPitFind(lp); if (r) r.L = 1; if (sv) { r = boxPitFind(sv); if (r) r.SV = 1; }
  for (let side = 0; side <= 1; side++) {
    const n = G.boxPit.filter(x => x.team === teamCode(side)).length; cur = G.curPit[side]; r = boxPitFind(cur);
    if (r) { if (n === 1) { r.CG = 1; if ((side === 0 && sH === 0) || (side === 1 && sA === 0)) r.SHO = 1; } else if (cur !== G.startPit[side]) r.GF = 1; }
  }
  const line = G.innRuns[0].slice(0, G.inn).join('') + ' / ' + G.innRuns[1].slice(0, G.inn).join('');
  const res = { game: G.gameNo, away: teamCode(0), ra: sA, home: teamCode(1), rh: sH, wp: fullName(wP), lp: fullName(lp), sv: sv ? fullName(sv) : '', line, label: '' };
  if (G.playoffRow >= 0) playoffResult(teamCode(w));
  if (G.sched >= 0) {
    S.played[G.sched] = teamCode(0) + ' ' + sA + ', ' + teamCode(1) + ' ' + sH;
    for (let side = 0; side <= 1; side++) { const t = S.teams[teamCode(side)]; if (t) { if (side === w) t.w++; else t.l++; } }
  }
  if (!G.exhib) { for (let side = 0; side <= 1; side++) { const t = S.teams[teamCode(side)]; if (t) t.next++; } updateRest(); }
  addLog('Final: ' + teamCode(0) + ' ' + sA + ', ' + teamCode(1) + ' ' + sH + '.  W: ' + lastName(wP) + '  L: ' + lastName(lp) + (sv ? '  S: ' + lastName(sv) : ''));
  if (G.playoffRow < 0 && !G.exhib) { saveToSeason(); updateRecords(); }
  for (const x of G.boxPit) {
    if (x.id === wP) x.dec = 'W, ' + replayPit(x.id, 'W') + '-' + replayPit(x.id, 'L');
    else if (x.id === lp) x.dec = 'L, ' + replayPit(x.id, 'W') + '-' + replayPit(x.id, 'L');
    else if (x.id === sv) x.dec = 'S, ' + replayPit(x.id, 'SV');
  }
  let ln = G.playoffRow >= 0 && S.playoffs ? S.playoffs.rows[G.playoffRow].round : G.exhib ? 'Exhibition' : gameDate();
  S.results.push(res);
  res.label = '#' + S.results.length + ' · ' + ln + ' · ' + teamCode(0) + ' ' + sA + ' at ' + teamCode(1) + ' ' + sH;
  S.archive[G.gameNo] = snapGame(res.label);
  S.logAll[G.gameNo] = { label: res.label, log: G.log.slice() };
  trimSeason();
  G.playTxt = 'Final: ' + teamCode(0) + ' ' + sA + ', ' + teamCode(1) + ' ' + sH + '. Click NEXT GAME.'; sfx(G.walkoff ? 'walkoff' : 'final', 0.3, { home: w === 1 }); if (!G.walkoff && UI.flash && !gSim) UI.flash('FINAL', 'navy'); G.summary = { wp: fullName(wP), lp: fullName(lp), sv: sv ? fullName(sv) : '' };
}
function trimSeason() {
  // browser storage is small: keep the last 100 game logs and 150 box scores (results and stats keep everything)
  const lk = Object.keys(S.logAll).map(Number).sort((a, b) => a - b); while (lk.length > 100) delete S.logAll[lk.shift()];
  const ak = Object.keys(S.archive).map(Number).sort((a, b) => a - b); while (ak.length > 150) delete S.archive[ak.shift()];
}
function gameDate() { return G.sched >= 0 ? D.schedule[G.sched][SC.DATE] : 'Exhibition'; }
function snapGame(label) {
  return {
    game: G.gameNo, label, teams: G.teams.slice(), names: [teamFull(G.teams[0]), teamFull(G.teams[1])],
    innRuns: [G.innRuns[0].slice(0, G.inn), G.innRuns[1].slice(0, G.inn)], bottomSkipped: G.over && G.half === 0 && G.inn >= 9 && G.score[1] > G.score[0],
    score: G.score.slice(), hits: G.hits.slice(), errs: G.errs.slice(), lob: G.lob.slice(), park: parkName(),
    status: G.over ? 'Final' + (G.inn > 9 ? ' (' + G.inn + ')' : '') : (G.half === 0 ? 'Top ' : 'Bottom ') + ordinal(G.inn) + ', ' + G.outs + (G.outs === 1 ? ' out' : ' outs'),
    bat: G.boxBat.map(x => Object.assign({}, x, { avg: avg3(replayBat(x.id, 'H'), replayBat(x.id, 'AB')) })),
    pit: G.boxPit.map(x => { const ipo = replayPit(x.id, 'OUTS'); return Object.assign({}, x, { era: ipo > 0 ? fmt2(replayPit(x.id, 'ER') * 27 / ipo) : '-.--' }); }),
    pa: G.pa.slice(), lineup: deepCopy(G.lineup), inn: G.inn,
  };
}
function saveToSeason() {
  for (const b of G.boxBat) {
    const s = S.seasonBat[b.id] || (S.seasonBat[b.id] = Object.assign({ name: b.name, team: b.team, G: 0 }, Object.fromEntries(BAT_COLS.map(c => [c, 0]))));
    s.G++; BAT_COLS.forEach(c => s[c] += b[c]);
    if (b.AB > 0) { s.streak = b.H > 0 ? (s.streak || 0) + 1 : 0; if ((s.streak || 0) > (s.best || 0)) s.best = s.streak; }
  }
  for (const p of G.boxPit) {
    const s = S.seasonPit[p.id] || (S.seasonPit[p.id] = Object.assign({ name: p.name, team: p.team, G: 0 }, Object.fromEntries(PIT_COLS.map(c => [c, 0]))));
    s.G++; PIT_COLS.forEach(c => s[c] += p[c]);
  }
}

// ---- standings and leaders ----
function leagueList() { const s = []; for (const t of D.teams) if (!s.includes(t[T.LG])) s.push(t[T.LG]); s.sort((a, b) => a === 'AL' ? -1 : b === 'AL' ? 1 : 0); return s; }
const leagueName = lg => lg === 'AL' ? 'American League' : lg === 'NL' ? 'National League' : lg;
const divName = dv => ({ E: 'East', N: 'North', C: 'Central', S: 'South', W: 'West' })[dv] || dv;
function winPct(code) { const t = S.teams[code]; return t && t.w + t.l > 0 ? t.w / (t.w + t.l) : 0; }
function standingsData() {
  const out = [];
  for (const lg of leagueList()) for (const dv of ['E', 'N', 'C', 'S', 'W', '']) {
    const rows = D.teams.filter(t => t[T.LG] === lg && (t[T.DIV] || '') === dv);
    if (!rows.length) continue;
    rows.sort((a, b) => winPct(b[T.CODE]) - winPct(a[T.CODE]) || S.teams[b[T.CODE]].w - S.teams[a[T.CODE]].w);
    const best = S.teams[rows[0][T.CODE]];
    out.push({ title: leagueName(lg) + (dv ? ' ' + divName(dv) : ''), teams: rows.map(t => { const s = S.teams[t[T.CODE]]; const gb = ((best.w - s.w) + (s.l - best.l)) / 2; return { code: t[T.CODE], name: t[T.NAME], w: s.w, l: s.l, pct: fmt3(winPct(t[T.CODE])), gb: gb <= 0 ? '-' : gb, real: t[T.RW] + '-' + t[T.RL] }; }) });
  }
  return out;
}
function teamGames(code) { const t = S.teams[code]; return t ? t.w + t.l : 0; }
const obpOf = s => { const d = s.AB + s.BB + s.HBP + s.SF; return d > 0 ? (s.H + s.BB + s.HBP) / d : 0; };
const slgOf = s => s.AB > 0 ? (s.H + s['2B'] + 2 * s['3B'] + 3 * s.HR) / s.AB : 0;
function leaderTable(kind, stat, lg) {
  const src = kind === 'B' ? S.seasonBat : S.seasonPit; const low = stat === 'ERA' || stat === 'WHIP'; const list = [];
  for (const id in src) {
    const s = src[id]; if (!s.team || teamLeague(s.team) !== lg) continue; const g = teamGames(s.team); let ok = true, x = 0;
    const paOK = s.AB + s.BB + s.HBP + s.SF + s.SH >= 3.1 * g && s.AB > 0;
    switch (stat) {
      case 'AVG': ok = paOK; if (ok) x = s.H / s.AB; break;
      case 'OBP': ok = paOK; if (ok) x = obpOf(s); break;
      case 'SLG': ok = paOK; if (ok) x = slgOf(s); break;
      case 'OPS': ok = paOK; if (ok) x = obpOf(s) + slgOf(s); break;
      case 'IP': x = s.OUTS / 3; break;
      case 'ERA': ok = s.OUTS / 3 >= g && s.OUTS > 0; if (ok) x = s.ER * 27 / s.OUTS; break;
      case 'WHIP': ok = s.OUTS / 3 >= g && s.OUTS > 0; if (ok) x = (s.H + s.BB) * 3 / s.OUTS; break;
      default: x = num(s[stat]);
    }
    if (ok && (low || x > 0)) list.push({ name: s.name, team: s.team, v: x });
  }
  list.sort((a, b) => low ? a.v - b.v : b.v - a.v);
  const fmt = v => ['AVG', 'OBP', 'SLG', 'OPS'].includes(stat) ? (v >= 1 ? v.toFixed(3) : fmt3(v)) : (stat === 'ERA' || stat === 'WHIP') ? fmt2(v) : stat === 'IP' ? Math.floor(v + 0.0001) + '.' + Math.round((v - Math.floor(v + 0.0001)) * 3) : String(v);
  const titles = { AVG: 'Batting average', HR: 'Home runs', RBI: 'Runs batted in', OBP: 'On-base pct', SLG: 'Slugging pct', OPS: 'OPS (OBP + SLG)', '2B': 'Doubles', WHIP: 'WHIP', R: 'Runs', H: 'Hits', SB: 'Stolen bases', BB: 'Walks', W: 'Wins', ERA: 'ERA', K: 'Strikeouts', SV: 'Saves', IP: 'Innings', CG: 'Complete games', SHO: 'Shutouts', E: 'Errors (most)' };
  return { title: titles[stat] || stat, rows: list.slice(0, 10).map(r => ({ name: r.name + ' (' + friendlyCode(r.team) + ')', v: fmt(r.v) })) };
}
const LEADER_DEFS = [['B', 'AVG'], ['B', 'OBP'], ['B', 'SLG'], ['B', 'OPS'], ['B', 'HR'], ['B', 'RBI'], ['B', 'R'], ['B', 'H'], ['B', 'SB'], ['B', 'BB'], ['B', '2B'], ['B', 'E'], ['P', 'W'], ['P', 'ERA'], ['P', 'WHIP'], ['P', 'K'], ['P', 'SV'], ['P', 'IP'], ['P', 'CG'], ['P', 'SHO']];
function teamLeaders(lg) {
  const rows = [];
  for (const t of D.teams) {
    if (t[T.LG] !== lg) continue; const code = t[T.CODE]; const st = { code, name: t[T.NAME], w: S.teams[code].w, l: S.teams[code].l, r: 0, hr: 0, h: 0, ab: 0, sb: 0, er: 0, outs: 0, ra: 0, e: 0 };
    for (const id in S.seasonBat) { const s = S.seasonBat[id]; if (s.team === code) { st.r += s.R; st.hr += s.HR; st.h += s.H; st.ab += s.AB; st.sb += s.SB; st.e += s.E; } }
    for (const id in S.seasonPit) { const s = S.seasonPit[id]; if (s.team === code) { st.er += s.ER; st.outs += s.OUTS; st.ra += s.R; } }
    rows.push(st);
  }
  rows.sort((a, b) => b.w - a.w);
  return rows.map(s => ({ name: s.name, w: s.w, l: s.l, r: s.r, hr: s.hr, avg: s.ab > 0 ? fmt3(s.h / s.ab) : '---', sb: s.sb, era: s.outs > 0 ? fmt2(s.er * 27 / s.outs) : '-.--', ra: s.ra, e: s.e }));
}

// ---- lineup editor / saved lineups ----
function saveDefaultLineups() {
  const msg = [];
  for (let side = 0; side <= 1; side++) {
    const team = teamCode(side), hand = throws_(curPitcherID(1 - side));
    S.myLU[team + '|' + hand] = G.lineup[side].map(s => ({ id: String(s.pos).toUpperCase() === 'P' ? 'PITCHER' : s.id, pos: s.pos }));
    msg.push(team + ' vs ' + hand + 'HP');
  }
  saveAll(); UI.toast('Saved as the default lineups: ' + msg.join(', ') + '.');
}
function swapSpots(side, a, b) {
  if (G.started) { UI.toast('The batting order is set once the game starts. Use the dropdowns for substitutes.'); return; }
  const lu = G.lineup[side]; const t = lu[a]; lu[a] = lu[b]; lu[b] = t;
}

// ---- playoffs ----
// S.playoffs = { mode:1, n, bo:[r1..r5 (index 0 = earliest), ws], hf, seedsTyped:{AL:[],NL:[]}, seeds:{lg:[codes]}, rows:[{round, series, hi, hiW, lo, loW, status, key:[lg,rd,hi,lo,bo]}], champ }
function poDefaults() { return { mode: 0, n: 2, bo: [1, 1, 3, 5, 5], ws: 7, hf: 'AL', typed: { AL: [], NL: [] }, seeds: {}, rows: [], champ: '' }; }
function bracketOrder(sz) { let cur = [1]; let m = 1; while (m < sz) { const nx = []; for (const c of cur) nx.push(c, 2 * m + 1 - c); cur = nx; m *= 2; } return cur; }
function roundsFor(n) { let m = 1, r = 0; while (m < n) { m *= 2; r++; } return r; }
function roundName(lft, oneLg) { if (lft > 6) lft = 6; return oneLg ? ['', 'Final', 'Semifinal', 'Quarterfinal', 'Round of 16', 'Round of 32', 'Round of 64'][lft] : ['', 'LCS', 'Division Series', 'Wild Card', 'First Round', 'Opening Round', 'Play-in Round'][lft]; }
function roundBo(lft) { const po = S.playoffs; if (lft > 5) lft = 5; let b = num(po.bo[5 - lft]); if (b < 1) b = 1; if (b % 2 === 0) b++; return b; }
function teamPct(code, useReal) { const t = teamRow(code); if (!t) return 0; const w = useReal ? num(t[T.RW]) : S.teams[code].w, l = useReal ? num(t[T.RL]) : S.teams[code].l; return w + l > 0 ? w / (w + l) : 0; }
function playoffSeeds(lg, n) {
  const po = S.playoffs; const seeds = []; const have = new Set();
  for (const c of (po.typed[lg] || [])) if (c && teamRow(c) && seeds.length < n && !have.has(c)) { seeds.push(c); have.add(c); }
  const typed = seeds.length;
  let useReal = true; for (const c in S.teams) if (S.teams[c].w + S.teams[c].l > 0) useReal = false;
  for (const dv of ['E', 'N', 'C', 'S', 'W']) {
    if (seeds.length >= n) break; let best = '', bp = -1;
    for (const t of D.teams) if (t[T.LG] === lg && t[T.DIV] === dv && !have.has(t[T.CODE])) { const p = teamPct(t[T.CODE], useReal); if (p > bp) { bp = p; best = t[T.CODE]; } }
    if (best) { seeds.push(best); have.add(best); }
  }
  const nDivW = seeds.length;
  while (seeds.length < n) {
    let best = '', bp = -1;
    for (const t of D.teams) if (t[T.LG] === lg && !have.has(t[T.CODE])) { const p = teamPct(t[T.CODE], useReal); if (p > bp) { bp = p; best = t[T.CODE]; } }
    if (!best) break; seeds.push(best); have.add(best);
  }
  const sortSeg = (a, b) => { const seg = seeds.slice(a, b).sort((x, y) => teamPct(y, useReal) - teamPct(x, useReal)); for (let i = a; i < b; i++) seeds[i] = seg[i - a]; };
  sortSeg(typed, nDivW); sortSeg(nDivW, seeds.length);
  return seeds;
}
function setupBracket() {
  const po = S.playoffs || (S.playoffs = poDefaults());
  let n = clamp(Math.floor(num(po.n)) || 2, 1, 16); po.n = n;
  po.rows = []; po.seeds = {}; po.champ = '';
  for (const lg of leagueList()) po.seeds[lg] = playoffSeeds(lg, n);
  po.mode = 1; G.playoffRow = -1;
  advancePlayoffs();
  saveAll();
}
function poFind(key) { return S.playoffs.rows.findIndex(r => r.key.slice(0, 4).join('|') === key); }
function advancePlayoffs() {
  const po = S.playoffs; const lgs = Object.keys(po.seeds); const oneLg = lgs.length === 1; const champ = [];
  lgs.forEach((lg, gi) => {
    const sd = po.seeds[lg]; const n = sd.length; champ[gi] = '';
    if (n === 1) champ[gi] = sd[0];
    if (n >= 2) {
      const nRd = roundsFor(n); let cur = bracketOrder(Math.pow(2, nRd));
      for (let rd = 1; rd <= nRd; rd++) {
        const nx = [];
        for (let j = 0; j < cur.length / 2; j++) {
          const a = cur[2 * j], b = cur[2 * j + 1]; let w = -1;
          if (a === -1 || b === -1) w = -1; else if (a > n) w = b; else if (b > n) w = a;
          else {
            const hi = Math.min(a, b), lo = Math.max(a, b); const key = [lg, rd, hi, lo].join('|'); const r = poFind(key);
            if (r < 0) po.rows.push({ round: (oneLg ? '' : lg + ' ') + roundName(nRd - rd + 1, oneLg), series: j + 1, hi: sd[hi - 1], hiW: 0, lo: sd[lo - 1], loW: 0, status: 'Not started', key: [lg, rd, hi, lo, roundBo(nRd - rd + 1)] });
            else if (po.rows[r].status.startsWith('Done')) w = po.rows[r].hiW > po.rows[r].loW ? hi : lo;
          }
          nx.push(w);
        }
        cur = nx;
      }
      if (cur[0] > 0) champ[gi] = sd[cur[0] - 1];
    }
  });
  if (lgs.length === 2 && champ[0] && champ[1]) {
    if (poFind('WS|99|1|2') >= 0) return;
    let c = champ.slice();
    if (po.hf === 'NL') c.reverse(); else if (po.hf === 'Better record' && teamPct(c[1], false) > teamPct(c[0], false)) c.reverse();
    po.rows.push({ round: 'World Series', series: 1, hi: c[0], hiW: 0, lo: c[1], loW: 0, status: 'Not started', key: ['WS', 99, 1, 2, num(po.ws) || 7] });
  } else if (lgs.length === 1 && champ[0]) po.champ = champ[0];
}
async function playNextPlayoff() {
  const po = S.playoffs;
  if (!po || !po.mode) { UI.alert('Set up the bracket on the Playoffs tab first.'); return false; }
  if (!G.over && G.started && !await UI.confirm("This game isn't finished. Start the next playoff game anyway? (This game won't be saved.)", 'Playoffs')) return false;
  advancePlayoffs();
  let r = -1, bestRd = 1000;
  po.rows.forEach((row, i) => { if (!row.status.startsWith('Done') && row.lo) { const rd = num(row.key[1]); if (rd < bestRd) { bestRd = rd; r = i; } } });
  if (r < 0) {
    const ws = po.rows.find(x => x.key[0] === 'WS' && x.status.startsWith('Done'));
    if (ws) UI.alert(ws.status.slice(7) + '!'); else if (po.champ) UI.alert(teamFull(po.champ) + ' are the champions!'); else UI.alert('No playoff game is waiting.');
    return false;
  }
  const row = po.rows[r]; let bo = num(row.key[4]); if (bo < 1) bo = 7;
  const gnum = row.hiW + row.loW + 1;
  const pat = bo === 1 ? 'H' : bo === 3 ? 'HHH' : bo === 5 ? 'HHAAH' : bo === 7 ? 'HHAAAHH' : 'HHAAAHHAH';
  const hiHome = pat.charAt(gnum - 1) !== 'A';
  const hm = hiHome ? row.hi : row.lo, aw = hiHome ? row.lo : row.hi;
  if (!loadTeams({ kind: 'playoff', away: aw, home: hm, row: r })) return false;
  G.title = row.round + ' Game ' + gnum + ' · ' + seriesText(row) + ' · ' + parkName() + (windText() ? ' · ' + windText() : '');
  saveAll();
  return true;
}
function seriesText(row) { return row.hiW === row.loW ? 'series tied ' + row.hiW + '-' + row.loW : row.hiW > row.loW ? row.hi + ' leads ' + row.hiW + '-' + row.loW : row.lo + ' leads ' + row.loW + '-' + row.hiW; }
function playoffResult(winner) {
  const po = S.playoffs; if (!po || G.playoffRow < 0 || G.playoffRow >= po.rows.length) return;
  const row = po.rows[G.playoffRow];
  if (row.hi === winner) row.hiW++; else row.loW++;
  const bo = num(row.key[4]), need = Math.floor(bo / 2) + 1;
  if (row.hiW >= need) row.status = 'Done · ' + row.hi + ' wins ' + row.hiW + '-' + row.loW;
  else if (row.loW >= need) row.status = 'Done · ' + row.lo + ' wins ' + row.loW + '-' + row.hiW;
  else row.status = seriesText(row);
  if (row.status.startsWith('Done') && row.key[0] === 'WS') row.status = row.status.replace(' wins ', ' wins the World Series ');
  advancePlayoffs();
}
async function resetPlayoffs() {
  if (!await UI.confirm('Clear the playoff bracket?', 'Playoffs')) return;
  const po = S.playoffs || poDefaults(); po.mode = 0; po.rows = []; po.seeds = {}; po.champ = ''; S.playoffs = po; G.playoffRow = -1; saveAll();
}
