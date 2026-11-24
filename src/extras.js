/* extras.js: the Gazette (a morning paper), the pennant race, awards, lineup announcements, printable cards, ballparks */
'use strict';

// ---------- small helpers ----------
const nickOf = code => { const n = teamFull(code).split(' '); const last = n[n.length - 1]; return (last === 'Sox' || last === 'Jays') ? n.slice(-2).join(' ') : last; };
const cityOf = code => teamCity(code);
const plural = (n, w) => n + ' ' + w + (n === 1 ? '' : 's');
const gbWords = g => g === 0.5 ? 'a half game' : g % 1 ? Math.floor(g) + '½ games' : g === 1 ? 'one game' : g + ' games';
const wordNum = n => ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'][n] || String(n);
const pick = a => a[Math.floor(rand() * a.length)];
function divisionOf(code) { const r = teamRow(code); return r ? { lg: r[T.LG], dv: r[T.DIV] } : { lg: 'AL', dv: 'E' }; }
function divStandings(lg, dv) {
  const rows = D.teams.filter(t => t[T.LG] === lg && (t[T.DIV] || '') === dv).map(t => ({ code: t[T.CODE], name: t[T.NAME], w: S.teams[t[T.CODE]].w, l: S.teams[t[T.CODE]].l }));
  rows.sort((a, b) => winPct(b.code) - winPct(a.code) || b.w - a.w);
  const best = rows[0]; rows.forEach(r => { r.gb = ((best.w - r.w) + (r.l - best.l)) / 2; });
  return rows;
}
function gbText(code) {
  const { lg, dv } = divisionOf(code); const rows = divStandings(lg, dv); const i = rows.findIndex(r => r.code === code); const me = rows[i];
  const dvName = leagueName(lg).replace('American', 'AL').replace('National', 'NL').replace(' League', '') + ' ' + divName(dv);
  if (i === 0) { const second = rows[1]; const lead = second ? ((me.w - second.w) + (second.l - me.l)) / 2 : 0; return lead > 0 ? `${gbWords(lead)} ahead of the ${nickOf(second.code)} in the ${dvName}` : `tied for the ${dvName} lead`; }
  if (me.gb === 0) return `tied with the ${nickOf(rows[0].code)} atop the ${dvName}`;
  return `${gbWords(me.gb)} behind the ${nickOf(rows[0].code)} in the ${dvName}`;
}

// ---------- 1. THE GAZETTE: a game story written from the play-by-play ----------
function paPhrase(p) {
  const who = lastName(p.id), n = p.rbi; const runs = n === 1 ? 'an RBI' : wordNum(n) + '-run';
  const c = p.code;
  if (c === 'HR') return n > 1 ? `a ${runs} homer by ${who}` : `a solo homer by ${who}`;
  if (c === '3B') return `${runs} triple by ${who}`.replace(/^an RBI/, 'an RBI').replace(/^(\w+-run)/, 'a $1');
  if (c === '2B') return (n === 1 ? 'an RBI double by ' : 'a ' + runs + ' double by ') + who;
  if (c === '1B') return (n === 1 ? 'an RBI single by ' : 'a ' + runs + ' single by ') + who;
  if (c === 'BB' || c === 'IBB' || c === 'HBP') return `a bases-loaded ${c === 'HBP' ? 'hit batsman' : 'walk'} to ${who}`;
  if (c.startsWith('SF')) return `a sacrifice fly by ${who}`;
  if (c.startsWith('E')) return `an error that let ${who} reach`;
  if (c.startsWith('FC') || /^\d/.test(c) || c === 'GO') return `a run-scoring groundout by ${who}`;
  return `a play by ${who}`;
}
function makePaper() {
  const w = G.score[0] > G.score[1] ? 0 : 1, l = 1 - w;
  const wc = teamCode(w), lc = teamCode(l), wn = nickOf(wc), ln = nickOf(lc), sw = G.score[w], sl = G.score[l], margin = sw - sl;
  const bat = G.boxBat, pit = G.boxPit;
  // the man of the match
  const hit = bat.filter(b => b.team === wc).map(b => ({ b, sc: b.HR * 4 + b.RBI * 2 + b.H + b['2B'] + b['3B'] * 2 + b.R + b.SB })).sort((a, b) => b.sc - a.sc)[0];
  const H = hit ? hit.b : null;
  const wp = pit.find(p => p.W), lp = pit.find(p => p.L), sv = pit.find(p => p.SV);
  const starterW = pit.find(p => p.team === wc && p.GS), starterL = pit.find(p => p.team === lc && p.GS);
  // the shape of the game
  const cumW = [], cumL = []; let a = 0, b = 0, maxDeficit = 0, lateDeficit = 0;
  for (let i = 0; i < G.inn; i++) { a += G.innRuns[w][i] || 0; b += G.innRuns[l][i] || 0; cumW.push(a); cumL.push(b); if (b - a > maxDeficit) { maxDeficit = b - a; if (i >= 5) lateDeficit = b - a; } }
  const shutout = sl === 0, extra = G.inn > 9, walkoff = !!G.walkoff, comeback = lateDeficit >= 3, blowout = margin >= 7;
  const cg = pit.find(p => p.team === wc && p.CG);
  const lastPA = G.pa.filter(p => p.s === w).slice(-1)[0];
  // headline
  const verb = margin >= 7 ? pick(['rout', 'crush', 'pound']) : margin >= 4 ? pick(['beat', 'handle', 'down', 'top']) : margin >= 2 ? pick(['top', 'beat', 'take care of']) : pick(['edge', 'nip', 'slip past']);
  let head;
  if (walkoff && lastPA && /HR|1B|2B|3B/.test(lastPA.code)) head = `${lastName(lastPA.id)}'s ${lastPA.code === 'HR' ? 'homer' : lastPA.code === '2B' ? 'double' : lastPA.code === '3B' ? 'triple' : 'single'} in the ${ordinal(G.inn)} walks ${wn} off past ${ln}`;
  else if (walkoff) head = `${wn} walk off ${ln} in the ${ordinal(G.inn)}`;
  else if (shutout && cg) head = `${lastName(cg.id)} blanks ${ln} on ${plural(cg.H, 'hit')}`;
  else if (shutout) head = `${wn} shut out ${ln}, ${sw}-${sl}`;
  else if (H && H.HR >= 2) head = `${lastName(H.id)} homers ${H.HR === 2 ? 'twice' : wordNum(H.HR) + ' times'} as ${wn} ${verb} ${ln}`;
  else if (comeback) head = `${wn} rally from ${lateDeficit} down to stun ${ln}`;
  else if (extra) head = `${wn} outlast ${ln} in ${G.inn} innings`;
  else if (blowout) head = `${wn} ${verb} ${ln}, ${sw}-${sl}`;
  else if (H && H.RBI >= 4) head = `${lastName(H.id)} drives in ${H.RBI} as ${wn} ${verb} ${ln}`;
  else head = `${wn} ${verb} ${ln}, ${sw}-${sl}`;
  head = head.charAt(0).toUpperCase() + head.slice(1);
  // deck
  const deckBits = [];
  if (H && H.H > 0) deckBits.push(`${lastName(H.id)} ${H.H}-for-${H.AB}` + (H.HR ? ` with ${H.HR === 1 ? 'a homer' : H.HR + ' homers'}` : '') + (H.RBI ? ` and ${plural(H.RBI, 'RBI').replace('RBIs', 'RBI')}` : ''));
  if (wp) deckBits.push(`${lastName(wp.id)} ${wp.OUTS >= 18 ? 'goes ' + ipTxt(wp.OUTS).replace('.0', '') + ' strong' : 'gets the win'}`);
  const deck = deckBits.join(' · ');
  // paragraphs
  const city = cityOf(teamCode(1)).toUpperCase();
  const dateTxt = G.sched >= 0 ? D.schedule[G.sched][SC.DATE] : 'Today';
  const P = [];
  let p1 = `${city} — The ${teamFull(wc)} ${verb === 'rout' ? 'routed' : verb === 'crush' ? 'crushed' : verb === 'pound' ? 'pounded' : verb === 'edge' ? 'edged' : verb === 'nip' ? 'nipped' : verb === 'slip past' ? 'slipped past' : verb === 'take care of' ? 'took care of' : verb === 'handle' ? 'handled' : verb === 'down' ? 'downed' : verb === 'top' ? 'topped' : 'beat'} the ${teamFull(lc)} ${sw}-${sl}${extra ? ` in ${G.inn} innings` : ''} at ${parkName()} ${dateTxt === 'Today' ? 'today' : 'on ' + dateTxt}`;
  if (walkoff && lastPA) p1 += `, ending it on ${paPhrase(lastPA).replace(/^an? /, 'a ').replace('a a', 'a')} in the bottom of the ${ordinal(G.inn)}`;
  p1 += '.';
  if (H && H.H > 0) p1 += ` ${fullName(H.id)} led the way, going ${H.H}-for-${H.AB}` + (H.HR ? ` with ${H.HR === 1 ? 'a home run' : H.HR + ' home runs'}` : '') + (H.RBI ? ` and ${H.RBI} ${H.RBI === 1 ? 'run batted in' : 'runs batted in'}` : '') + '.';
  if (comeback) p1 += ` The ${wn} had trailed by ${lateDeficit} after ${plural(cumW.findIndex((v, i) => cumL[i] - v === lateDeficit) + 1, 'inning')}.`;
  P.push(p1);
  // the big inning
  let bigI = 0; for (let i = 1; i < G.inn; i++) if ((G.innRuns[w][i] || 0) > (G.innRuns[w][bigI] || 0)) bigI = i;
  const bigRuns = G.innRuns[w][bigI] || 0;
  if (bigRuns > 0) {
    const plays = G.pa.filter(p => p.s === w && p.inn === bigI + 1 && p.rbi > 0).map(paPhrase);
    let p2 = bigRuns >= 3 ? `The ${wn} broke it open with ${wordNum(bigRuns)} in the ${ordinal(bigI + 1)}` : bigRuns === 2 ? `The ${wn} got two in the ${ordinal(bigI + 1)}` : `The ${wn}' big blow came in the ${ordinal(bigI + 1)}`;
    if (plays.length) p2 += ': ' + (plays.length === 1 ? plays[0] : plays.slice(0, -1).join(', ') + ' and ' + plays[plays.length - 1]);
    p2 += '.';
    if (sl > 0) { const lh = bat.filter(x => x.team === lc).sort((x, y) => (y.HR * 4 + y.RBI * 2 + y.H) - (x.HR * 4 + x.RBI * 2 + x.H))[0]; if (lh && lh.H > 0) p2 += ` For the ${ln}, ${fullName(lh.id)} went ${lh.H}-for-${lh.AB}${lh.HR ? ' with a homer' : ''}${lh.RBI ? ' and ' + plural(lh.RBI, 'RBI').replace('RBIs', 'RBI') : ''}.`; }
    P.push(p2);
  }
  // pitching
  let p3 = '';
  if (wp) p3 += `${fullName(wp.id)} (${replayPit(wp.id, 'W')}-${replayPit(wp.id, 'L')}) ${wp.GS ? 'went ' + ipTxt(wp.OUTS) + ' innings, allowing ' + plural(wp.H, 'hit') + ' and ' + plural(wp.R, 'run') + (wp.K ? ' while striking out ' + wp.K : '') : 'picked up the win in relief'}.`;
  if (sv) p3 += ` ${fullName(sv.id)} got his ${ordinal(replayPit(sv.id, 'SV'))} save.`;
  if (lp) p3 += ` ${fullName(lp.id)} (${replayPit(lp.id, 'W')}-${replayPit(lp.id, 'L')}) took the loss${lp.GS ? ', giving up ' + plural(lp.R, 'run') + ' in ' + ipTxt(lp.OUTS) + ' innings' : ''}.`;
  if (starterL && starterL !== lp && starterL.OUTS >= 15 && starterL.R <= 2) p3 += ` ${lastName(starterL.id)} deserved better for the ${ln}: ${ipTxt(starterL.OUTS)} innings, ${plural(starterL.R, 'run')}.`;
  if (p3) P.push(p3);
  // notes
  const notes = [];
  for (const x of bat) { const s = S.seasonBat[x.id]; if (s && s.streak >= 8) notes.push(`${lastName(x.id)} extended his hitting streak to ${s.streak} games.`); }
  for (const x of bat) if (x.H >= 4) notes.push(`${fullName(x.id)} had a ${x.H}-hit game.`);
  for (const x of pit) if (x.K >= 10) notes.push(`${fullName(x.id)} struck out ${x.K}.`);
  const R = S.records || {}; for (const k of ['longhr', 'hits', 'hr', 'rbi', 'k', 'runs', 'blowout', 'innings']) if (R[k] && R[k].game === G.gameNo) notes.push(`A season record: ${{ longhr: 'longest home run', hits: 'most hits in a game', hr: 'most homers in a game', rbi: 'most RBI in a game', k: 'most strikeouts by a pitcher', runs: 'most runs by a team', blowout: 'biggest margin', innings: 'longest game' }[k]}, ${R[k].v}${R[k].extra ? ' (' + R[k].extra + ')' : ''}, by ${R[k].who}.`);
  for (const x of pit) if (x.CG && x.H === 0) notes.unshift(`NO-HITTER: ${fullName(x.id)} did not allow a hit.`);
  if (G.errs[w] + G.errs[l] >= 4) notes.push(`A sloppy one: ${G.errs[0] + G.errs[1]} errors in all.`);
  if (G.sched >= 0) P.push(`The win leaves the ${wn} at ${S.teams[wc].w}-${S.teams[wc].l}, ${gbText(wc)}; the ${ln} fall to ${S.teams[lc].w}-${S.teams[lc].l}, ${gbText(lc)}.`);
  const wx = windText();
  return { game: G.gameNo, date: dateTxt, label: '', head, deck, story: P, notes, teams: G.teams.slice(), score: G.score.slice(), park: parkName(), weather: wx, line: G.innRuns.map(r => r.slice(0, G.inn)), exhib: !!G.exhib, playoff: G.playoffRow >= 0 };
}
function paperHtml(pp) {
  const date = pp.date + ', ' + seasonYr();
  const others = S.results.filter(r => r.date === pp.date && r.game !== pp.game).map(r => `<div>${esc(nickOf(r.away))} ${r.ra}, ${esc(nickOf(r.home))} ${r.rh} <span class="small">(W: ${esc(r.wp.split(' ').slice(-1)[0])})</span></div>`).join('') || '<div class="small">No other games.</div>';
  const divs = []; for (const c of pp.teams) { const d = divisionOf(c); if (!divs.some(x => x.lg === d.lg && x.dv === d.dv)) divs.push(d); }
  const standBox = divs.map(d => `<table class="gz-stand"><tr><th class="l">${esc(leagueName(d.lg).replace(' League', '') + ' ' + divName(d.dv))}</th><th>W</th><th>L</th><th>GB</th></tr>${divStandings(d.lg, d.dv).map(r => `<tr><td class="l">${esc(nickOf(r.code))}</td><td>${r.w}</td><td>${r.l}</td><td>${r.gb ? r.gb : '—'}</td></tr>`).join('')}</table>`).join('');
  const ldr = (lg, stat) => leaderTable('B', stat, lg).rows.slice(0, 3).map(r => `${esc(r.name.replace(/ \(.*\)/, '').split(' ').slice(-1)[0])} <b>${r.v}</b>`).join(', ') || '—';
  const ni = Math.max(9, pp.line[0].length);
  const lineTbl = `<table class="gz-line"><tr><th></th>${Array.from({ length: ni }, (_, i) => '<th>' + (i + 1) + '</th>').join('')}<th>R</th></tr>${[0, 1].map(s => `<tr><td class="l">${pp.teams[s]}</td>${Array.from({ length: ni }, (_, i) => '<td>' + (pp.line[s][i] == null ? '' : pp.line[s][i]) + '</td>').join('')}<td><b>${pp.score[s]}</b></td></tr>`).join('')}</table>`;
  return `<div class="gazette"><div class="gz-mast"><div class="gz-vol">Vol. ${seasonYr() - 1976} · No. ${pp.game}</div><div class="gz-title">The Ball Five Gazette</div><div class="gz-date">${esc(date)} · ${pp.exhib ? 'Exhibition' : pp.playoff ? 'Playoffs' : 'Baseball'}${pp.weather ? ' · ' + esc(pp.weather) : ''}</div></div>
    <h1 class="gz-head">${esc(pp.head)}</h1>${pp.deck ? `<div class="gz-deck">${esc(pp.deck)}</div>` : ''}
    <div class="gz-cols"><div class="gz-story">${pp.story.map(p => '<p>' + esc(p) + '</p>').join('')}${lineTbl}${pp.notes.length ? '<h4>Notes</h4>' + pp.notes.map(n => '<p class="gz-note">' + esc(n) + '</p>').join('') : ''}</div>
    <div class="gz-side"><h4>Around the league</h4>${others}<h4>Standings</h4>${standBox}<h4>Leaders</h4><div class="gz-ld"><b>AL</b> <i>Average:</i> ${ldr('AL', 'AVG')}<br><i>Homers:</i> ${ldr('AL', 'HR')}</div><div class="gz-ld"><b>NL</b> <i>Average:</i> ${ldr('NL', 'AVG')}<br><i>Homers:</i> ${ldr('NL', 'HR')}</div></div></div></div>`;
}
let paperPick = 'latest';
function paperScreen() {
  const root = $('screen'); const keys = Object.keys(S.papers || {}).map(Number).sort((a, b) => b - a);
  if (!keys.length) { root.innerHTML = '<div class="pane"><h2>The Gazette</h2><p>The morning paper comes out after your first finished game.</p></div>'; return; }
  const k = paperPick === 'latest' ? keys[0] : Number(paperPick); const pp = S.papers[k] || S.papers[keys[0]];
  root.innerHTML = `<div class="pane"><div class="btnrow"><label>Edition <select onchange="paperPick=this.value;UI.refresh()">${keys.map(x => `<option value="${x}"${x === k ? ' selected' : ''}>${esc(S.papers[x].date)} · ${esc(nickOf(S.papers[x].teams[0]))} at ${esc(nickOf(S.papers[x].teams[1]))}</option>`).join('')}</select></label><button class="mini" onclick="window.print()">Print</button></div>${paperHtml(pp)}</div>`;
}

// ---------- 2. THE PENNANT RACE ----------
function raceLogAdd() {
  if (G.sched < 0 || G.exhib) return; S.raceLog = S.raceLog || [];
  for (let s = 0; s <= 1; s++) { const c = teamCode(s); S.raceLog.push([G.dayNo, c, S.teams[c].w, S.teams[c].l]); }
}
function raceChart(lg, dv) {
  const log = S.raceLog || []; if (log.length < 4) return '';
  const teams = D.teams.filter(t => t[T.LG] === lg && (t[T.DIV] || '') === dv).map(t => t[T.CODE]);
  const days = [...new Set(log.map(e => e[0]))].sort((a, b) => a - b); const d0 = days[0], d1 = days[days.length - 1]; if (d1 - d0 < 7) return '';
  const rec = {}; teams.forEach(c => rec[c] = { w: 0, l: 0 }); const series = {}; teams.forEach(c => series[c] = []); let maxGB = 1;
  let li = 0;
  for (const d of days) {
    while (li < log.length && log[li][0] <= d) { const e = log[li]; if (rec[e[1]]) rec[e[1]] = { w: e[2], l: e[3] }; li++; }
    let bw = -1, bl = 0; for (const c of teams) { const r = rec[c]; if (r.w - r.l > bw - bl) { bw = r.w; bl = r.l; } }
    for (const c of teams) { const r = rec[c]; const gb = ((bw - r.w) + (r.l - bl)) / 2; series[c].push([d, gb]); if (gb > maxGB) maxGB = gb; }
  }
  const W = 520, Hh = 180, px = 36, py = 14; const X = d => px + (d - d0) / (d1 - d0) * (W - px - 10), Y = gb => py + gb / maxGB * (Hh - py - 22);
  let s = `<svg viewBox="0 0 ${W} ${Hh}" class="race"><rect x="0" y="0" width="${W}" height="${Hh}" fill="#fff" rx="6"/>`;
  for (let g = 0; g <= maxGB; g += Math.max(1, Math.ceil(maxGB / 5))) s += `<line x1="${px}" y1="${Y(g)}" x2="${W - 10}" y2="${Y(g)}" stroke="#e5e5e5"/><text x="${px - 4}" y="${Y(g) + 4}" font-size="9" text-anchor="end" fill="#777">${g}</text>`;
  for (const m of [4, 5, 6, 7, 8, 9]) { const dd = Math.round((new Date(seasonYr(), m - 1, 1) - new Date(seasonYr(), 0, 1)) / 864e5) + 1; if (dd >= d0 && dd <= d1) s += `<line x1="${X(dd)}" y1="${py}" x2="${X(dd)}" y2="${Hh - 22}" stroke="#eee"/><text x="${X(dd) + 2}" y="${Hh - 10}" font-size="9" fill="#777">${['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'][m]}</text>`; }
  for (const c of teams) { const pts = series[c].map(([d, gb]) => X(d).toFixed(1) + ',' + Y(gb).toFixed(1)).join(' '); s += `<polyline points="${pts}" fill="none" stroke="${teamColor(c, 1)}" stroke-width="2.2" stroke-linejoin="round"/>`; const last = series[c][series[c].length - 1]; s += `<text x="${(X(last[0]) + 3).toFixed(1)}" y="${(Y(last[1]) + 3).toFixed(1)}" font-size="9" font-weight="bold" fill="${teamColor(c, 1)}">${c}</text>`; }
  s += `<text x="${px}" y="10" font-size="9" fill="#555">games behind, by day</text></svg>`;
  return s;
}
function raceHtml() {
  const lgs = leagueList(); let h = '<h3>The pennant race</h3>';
  const played = Object.keys(S.played).length; const perTeam = 162;
  for (const lg of lgs) {
    const divs = [...new Set(D.teams.filter(t => t[T.LG] === lg).map(t => t[T.DIV] || ''))];
    for (const dv of divs) {
      const rows = divStandings(lg, dv); const lead = rows[0], second = rows[1];
      let magic = ''; if (second && S.teams[lead.code].w + S.teams[lead.code].l >= 110) { const m = perTeam + 1 - lead.w - second.l; magic = m <= 0 ? `<span class="tag clinch">CLINCHED</span>` : m <= 30 ? `<span class="tag magic">Magic number ${m}</span>` : ''; }
      const tight = second && second.gb <= 2 && S.teams[lead.code].w + S.teams[lead.code].l >= 20 ? `<span class="tag hot">RACE: ${nickOf(second.code)} ${second.gb === 0 ? 'tied' : second.gb + ' back'}</span>` : '';
      h += `<div class="racebox"><div class="raceh"><b>${esc(leagueName(lg))} ${esc(divName(dv))}</b> · ${esc(teamFull(lead.code))} ${lead.w}-${lead.l}${second ? ', ' + esc(nickOf(second.code)) + ' ' + (second.gb ? second.gb + ' back' : 'tied') : ''} ${magic} ${tight}</div>${raceChart(lg, dv)}</div>`;
    }
  }
  // the playoff picture
  h += '<h3>If the season ended today</h3><div class="btnrow">';
  for (const lg of lgs) { const divs = [...new Set(D.teams.filter(t => t[T.LG] === lg).map(t => t[T.DIV] || ''))]; const champs = divs.map(dv => divStandings(lg, dv)[0]); h += `<div class="panel" style="min-width:260px"><div class="ph">${esc(leagueName(lg))} Championship Series</div>${champs.map(c => `<div><b>${esc(teamFull(c.code))}</b> ${c.w}-${c.l}</div>`).join('<div class="small">versus</div>')}</div>`; }
  h += '</div>';
  if (played === 0) h = '<h3>The pennant race</h3><p class="small">The race starts with the first game.</p>';
  return h;
}

// ---------- 3. AWARDS ----------
function weeklyAdd() {
  if (G.sched < 0 || G.exhib || G.playoffRow >= 0) return;
  const wk = Math.floor(G.dayNo / 7); S.weekly = S.weekly || {}; S.weeklyP = S.weeklyP || {};
  const W = S.weekly[wk] || (S.weekly[wk] = {}), WP = S.weeklyP[wk] || (S.weeklyP[wk] = {});
  for (const b of G.boxBat) { if (b.AB + b.BB + b.HBP + b.SF + b.SH === 0) continue; const a = W[b.id] || (W[b.id] = [0, 0, 0, 0, 0, 0, 0, 0, 0, b.team]); a[0] += b.AB; a[1] += b.H; a[2] += b['2B']; a[3] += b['3B']; a[4] += b.HR; a[5] += b.RBI; a[6] += b.R; a[7] += b.BB + b.HBP; a[8] += b.SB; }
  for (const p of G.boxPit) { const a = WP[p.id] || (WP[p.id] = [0, 0, 0, 0, 0, 0, 0, 0, p.team]); a[0] += p.OUTS; a[1] += p.H; a[2] += p.ER; a[3] += p.BB; a[4] += p.K; a[5] += p.W; a[6] += p.L; a[7] += p.SV; }
}
const hitScore = a => a[1] + a[2] + 2 * a[3] + 3 * a[4] + a[5] + a[6] + 0.5 * a[7] + 0.5 * a[8];
const pitScore = a => 6 * a[5] - 2 * a[6] + 4 * a[7] + a[0] / 3 + a[4] / 2 - 2 * a[2];
function bestOfPeriod(weeks, lg) {
  const H = {}, P = {};
  for (const wk of weeks) {
    for (const id in (S.weekly[wk] || {})) { const a = S.weekly[wk][id]; if (teamLeague(a[9]) !== lg) continue; const t = H[id] || (H[id] = [0, 0, 0, 0, 0, 0, 0, 0, 0, a[9]]); for (let i = 0; i < 9; i++) t[i] += a[i]; }
    for (const id in (S.weeklyP[wk] || {})) { const a = S.weeklyP[wk][id]; if (teamLeague(a[8]) !== lg) continue; const t = P[id] || (P[id] = [0, 0, 0, 0, 0, 0, 0, 0, a[8]]); for (let i = 0; i < 8; i++) t[i] += a[i]; }
  }
  const hb = Object.entries(H).map(([id, a]) => ({ id, a, sc: hitScore(a) })).sort((x, y) => y.sc - x.sc)[0];
  const pb = Object.entries(P).map(([id, a]) => ({ id, a, sc: pitScore(a) })).sort((x, y) => y.sc - x.sc)[0];
  return { hitter: hb && hb.sc > 0 ? { id: hb.id, team: hb.a[9], line: `${avg3(hb.a[1], hb.a[0])}, ${hb.a[1]} H, ${hb.a[4]} HR, ${hb.a[5]} RBI, ${hb.a[6]} R${hb.a[8] ? ', ' + hb.a[8] + ' SB' : ''}` } : null,
    pitcher: pb && pb.sc > 0 ? { id: pb.id, team: pb.a[8], line: `${pb.a[5]}-${pb.a[6]}${pb.a[7] ? ', ' + pb.a[7] + ' SV' : ''}, ${ipTxt(pb.a[0])} IP, ${pb.a[0] ? fmt2(pb.a[2] * 27 / pb.a[0]) : '-'} ERA, ${pb.a[4]} K` } : null };
}
function monthOfDay(d) { return new Date(seasonYr(), 0, d).getMonth() + 1; }
function awardsHtml() {
  const weeks = Object.keys(S.weekly || {}).map(Number).sort((a, b) => a - b); if (!weeks.length) return '<h3>Awards</h3><p class="small">Player of the week and the awards race appear once games are in the books.</p>';
  const lastWk = weeks[weeks.length - 1]; const curMonth = monthOfDay(lastWk * 7 + 3); const monthWeeks = weeks.filter(w => monthOfDay(w * 7 + 3) === curMonth);
  const MN = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October'];
  let h = '<h3>Awards</h3><div class="awgrid">';
  for (const lg of leagueList()) {
    const wkB = bestOfPeriod([lastWk], lg), moB = bestOfPeriod(monthWeeks, lg);
    const cell = (t, x) => x ? `<div class="aw"><b>${t}</b> ${esc(fullName(x.id))} <small>(${friendlyCode(x.team)})</small><br><small>${esc(x.line)}</small></div>` : '';
    h += `<div class="panel"><div class="ph">${esc(leagueName(lg))}</div>${cell('Player of the week', wkB.hitter)}${cell('Pitcher of the week', wkB.pitcher)}${cell('Player of the month (' + MN[curMonth] + ')', moB.hitter)}${cell('Pitcher of the month', moB.pitcher)}</div>`;
  }
  h += '</div><h3>The awards race <small class="small">(if the season ended today; the commissioner may overrule)</small></h3><div class="awgrid">';
  S.awards = S.awards || {};
  for (const lg of leagueList()) {
    const g = Math.max(1, ...D.teams.filter(t => t[T.LG] === lg).map(t => teamGames(t[T.CODE])));
    const bats = Object.entries(S.seasonBat).filter(([id, s]) => teamLeague(s.team) === lg && s.AB + s.BB + s.HBP + s.SF >= 2.5 * g).map(([id, s]) => { const pa = s.AB + s.BB + s.HBP + s.SF; const tb = s.H + s['2B'] + 2 * s['3B'] + 3 * s.HR; const rc = pa ? (s.H + s.BB + s.HBP) * (tb + 0.5 * s.SB) / pa : 0; return { id, s, v: rc + s.RBI * 0.15 + s.R * 0.1 }; }).sort((a, b) => b.v - a.v).slice(0, 5);
    const pits = Object.entries(S.seasonPit).filter(([id, s]) => teamLeague(s.team) === lg && s.OUTS >= 20 * g / 10).map(([id, s]) => { const ip = s.OUTS / 3, era = s.OUTS ? s.ER * 27 / s.OUTS : 9; return { id, s, v: 6 * s.W - 2 * s.L + 4 * s.SV + ip * (4.5 - era) * 0.35 + s.K / 8 }; }).sort((a, b) => b.v - a.v).slice(0, 5);
    const gg = []; for (let f = 2; f <= 9; f++) { const cands = Object.keys(S.seasonBat).filter(id => teamLeague(S.seasonBat[id].team) === lg && hasFld(id, f) && S.seasonBat[id].G >= g * 0.5).map(id => ({ id, r: fieldVal(id, f, F.RNGR, 5), e: fieldVal(id, f, F.ER, 99), inn: fieldVal(id, f, F.INN, 0) })).sort((a, b) => a.r - b.r || a.e - b.e || b.inn - a.inn); if (cands[0]) gg.push({ f, id: cands[0].id }); }
    const mgr = D.teams.filter(t => t[T.LG] === lg).map(t => { const c = t[T.CODE], s = S.teams[c], n = s.w + s.l; const real = num(t[T.RW]) / (num(t[T.RW]) + num(t[T.RL])); return { c, v: n ? (s.w / n - real) * n : 0, rec: s.w + '-' + s.l }; }).sort((a, b) => b.v - a.v)[0];
    const sel = (key, cands, label, fmt) => { const pickId = S.awards[lg + '|' + key]; const chosen = pickId && cands.find(c => c.id === pickId) ? pickId : (cands[0] ? cands[0].id : ''); return `<div class="aw"><b>${label}</b> <select onchange="S.awards['${lg}|${key}']=this.value;saveAll();UI.refresh()">${cands.map((c, i) => `<option value="${c.id}"${c.id === chosen ? ' selected' : ''}>${i + 1}. ${esc(fullName(c.id))} (${friendlyCode(c.s.team)}) · ${esc(fmt(c.s))}</option>`).join('')}</select>${pickId && pickId !== (cands[0] && cands[0].id) ? "<small> commissioner's pick</small>" : ''}</div>`; };
    h += `<div class="panel"><div class="ph">${esc(leagueName(lg))}</div>
      ${sel('mvp', bats, 'Most Valuable Player', s => `${avg3(s.H, s.AB)}, ${s.HR} HR, ${s.RBI} RBI, ${s.R} R`)}
      ${sel('cy', pits, 'Cy Young', s => `${s.W}-${s.L}${s.SV ? ', ' + s.SV + ' SV' : ''}, ${s.OUTS ? fmt2(s.ER * 27 / s.OUTS) : '-'} ERA, ${s.K} K`)}
      <div class="aw"><b>Gold Gloves</b> <small>(from the fielding ratings, regulars only)</small><br>${gg.map(x => `<span class="ggl">${posName(x.f)} ${esc(lastName(x.id))}</span>`).join(' ') || '<small>not yet</small>'}</div>
      ${mgr && mgr.v > 0 ? `<div class="aw"><b>Manager of the Year</b> ${esc(teamFull(mgr.c))} <small>(${mgr.rec}, ${mgr.v.toFixed(1)} wins above their real pace)</small></div>` : ''}
    </div>`;
  }
  return h + '</div>';
}

// ---------- 4. LINEUPS ANNOUNCED ----------
async function announceLineups() {
  const host = $('popHost'); if (!host) return; let skipped = false;
  host.classList.remove('hidden');
  const show = (title, line, sub) => { host.innerHTML = `<div class="pop announce"><div class="pop-title">${esc(title)}</div><div class="ann-line">${esc(line)}</div><div class="ann-sub">${esc(sub || '')}</div><div class="pop-foot">click to skip</div></div>`; host.firstChild.onclick = () => { skipped = true; }; };
  const wait = async ms => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (skipped) return; await new Promise(r => setTimeout(r, 60)); } };
  sfx('pa'); show('LADIES AND GENTLEMEN', 'Welcome to ' + parkName(), windText()); await wait(1600);
  for (let side = 0; side <= 1 && !skipped; side++) {
    const team = teamCode(side); sfx('pa');
    show(side === 0 ? 'THE STARTING LINEUP FOR THE VISITING ' + teamFull(team).toUpperCase() : 'AND NOW, YOUR ' + teamFull(team).toUpperCase(), side === 0 ? 'The ' + nickOf(team) : 'The ' + nickOf(team) + '!', ''); sfx(side === 1 ? 'cheer' : 'murmur', 0.2); await wait(1400);
    for (let i = 1; i <= 9 && !skipped; i++) {
      const id = slotID(side, i), ps = slotPos(side, i); const r = isBat(id) ? bRowOf(id) : null;
      const posLong = { P: 'the pitcher', C: 'the catcher', '1B': 'the first baseman', '2B': 'the second baseman', '3B': 'the third baseman', SS: 'the shortstop', LF: 'the left fielder', CF: 'the center fielder', RF: 'the right fielder', DH: 'the designated hitter' }[ps] || ps;
      const star = r && (num(r[B.HR]) >= 20 || num(r[B.H]) / Math.max(1, num(r[B.AB])) >= 0.3);
      show((side === 0 ? 'VISITORS' : 'HOME') + ' · BATTING ' + ordinal(i).toUpperCase(), (ps === 'P' ? 'And pitching, ' : 'Batting ' + ordinal(i) + ', ' + posLong + ', ') + fullName(id), r ? 'Hit ' + avg3(num(r[B.H]), num(r[B.AB])) + ' with ' + num(r[B.HR]) + ' homers and ' + num(r[B.RBI]) + ' RBI in ' + seasonYr() : '');
      sfx(side === 1 ? (star ? 'star' : 'name') : 'murmur', 0.15); await wait(star ? 1500 : 1150);
    }
    if (!skipped) { const pid = curPitcherID(side), pr = pRowOf(pid); show((side === 0 ? 'VISITORS' : 'HOME') + ' · ON THE MOUND', 'And pitching, ' + fullName(pid), pr ? pr[P.W] + '-' + pr[P.L] + ', ' + fmt2(num(pr[P.ERA])) + ' ERA in ' + seasonYr() : ''); sfx(side === 1 ? 'star' : 'murmur', 0.15); await wait(1500); }
  }
  host.innerHTML = ''; host.classList.add('hidden');
}
Actions.announce = () => { if (busy || !G.intro) return; runAction(async () => { Snd.ambient(true); await announceLineups(); G.intro = 0; sfx('pa'); }, { undo: false }); };

// ---------- 5. PRINTABLE CARDS ----------
let cardsTeam = '';
function printCardFront(id, team, isPit) {
  gNoPark = true; let rows = '';
  try {
    if (isPit) {
      const L = pitcherCard(id, 'L', 0), R = pitcherCard(id, 'R', 0); let aL = 500, aR = 500;
      for (let i = 1; i <= 15; i++) { const l = L.w[i] ? (aL + 1) + '-' + (aL + L.w[i]) : '-', r = R.w[i] ? (aR + 1) + '-' + (aR + R.w[i]) : '-'; rows += `<div class="prow"><span>${LBL[i]}</span><span>${l}</span><span>${r}</span></div>`; aL += L.w[i]; aR += R.w[i]; }
      rows += `<div class="prow"><span>Fielding check</span><span>${aL + 1}-1000</span><span>${aR + 1}-1000</span></div>`;
    } else {
      const L = batterCard(id, 'L'), R = batterCard(id, 'R'); let aL = 0, aR = 0;
      for (let i = 1; i <= 15; i++) { const l = L[i] ? (aL + 1) + '-' + (aL + L[i]) : '-', r = R[i] ? (aR + 1) + '-' + (aR + R[i]) : '-'; rows += `<div class="prow"><span>${LBL[i]}</span><span>${l}</span><span>${r}</span></div>`; aL += L[i]; aR += R[i]; }
    }
  } finally { gNoPark = false; }
  const c1 = teamColor(team, 1), c2 = teamColor(team, 2); let info, strip;
  if (isPit) { const r = pRowOf(id); info = r ? 'Pitcher · Throws ' + r[P.THROWS] : 'Pitcher'; strip = r ? `${r[P.W]}-${r[P.L]} · ${fmt2(num(r[P.ERA]))} ERA · ${Math.floor(num(r[P.IPO]) / 3)} IP` : ''; }
  else { const r = bRowOf(id); const fld = String(r[B.FLD] || ''); info = (fld ? fld.split(' ')[0].replace(/-.*/, '') + ' · ' : '') + 'Bats ' + r[B.BATS] + ' · speed ' + num(r[B.RUN]); strip = `${avg3(num(r[B.H]), num(r[B.AB]))} · ${num(r[B.HR])} HR · ${num(r[B.RBI])} RBI`; }
  return `<div class="pcard"><div class="pc-top"><span>${esc(teamFull(team).toUpperCase())}</span><span>${seasonYr()}</span></div><div class="pc-band" style="background:${c1};border-bottom:3px solid ${c2}">${esc(fullName(id))}</div><div class="pc-info">${esc(info)}</div><div class="prow pc-h"><span>${isPit ? 'PITCHER 501-1000' : 'BATTER 1-500'}</span><span>${isPit ? 'vs LHB' : 'vs LHP'}</span><span>${isPit ? 'vs RHB' : 'vs RHP'}</span></div>${rows}<div class="pc-strip">${esc(strip)}</div></div>`;
}
function cardsScreen() {
  const root = $('screen'); const teams = D.teams.map(t => t[T.CODE]); if (!cardsTeam) cardsTeam = teams[0];
  const bats = rosterBatters(cardsTeam).filter(r => !isPit(r[B.ID])), pits = rosterPitchers(cardsTeam);
  let h = `<div class="pane"><h2>Player cards</h2><p class="small">Every player's card, front and back, park-neutral with both halves (vs left and vs right) side by side, like the table-top cards. Print on card stock: each card is 2.5 by 3.5 inches, nine to a page. Use the Print button and turn off headers and footers in the print dialog.</p>
    <div class="btnrow"><label>Team <select onchange="cardsTeam=this.value;UI.refresh()">${teams.map(t => `<option${cardsTeam === t ? ' selected' : ''}>${t}</option>`).join('')}</select></label><button class="btn go" onclick="window.print()">Print this team's cards</button></div><div class="pcards">`;
  for (const r of bats) h += printCardFront(r[B.ID], cardsTeam, false) + cardBackHtml(0, r[B.ID], false, cardsTeam);
  for (const r of pits) h += printCardFront(r[P.ID], cardsTeam, true) + cardBackHtml(0, r[P.ID], true, cardsTeam);
  root.innerHTML = h + '</div></div>';
}

// ---------- 6. BALLPARKS ----------
let parkPick = '';
function parksScreen() {
  const root = $('screen'); const parks = D.teams.map(t => ({ code: t[T.CODE], park: t[T.PARK] }));
  if (!parkPick) parkPick = G.teams[1] && teamRow(G.teams[1]) ? G.teams[1] : parks[0].code;
  const t = teamRow(parkPick); const park = t[T.PARK];
  gParkOverride = park; let svg; try { svg = parkSVG().svg; } finally { gParkOverride = null; }
  const dims = [fenceDist(7, park), fenceDist(8, park), fenceDist(9, park)];
  const pfNames = ['Home runs', 'Triples', 'Doubles', 'Singles', 'Walks', 'Strikeouts', 'Ground balls', 'Fly balls', 'Line drives', 'Pop-ups'];
  const pf = pfNames.map((n, i) => { const f = num(t[T.PF0 + i]) || 1; const d = Math.round((f - 1) * 100); return `<tr><td class="l">${n}</td><td>${f.toFixed(2)}</td><td class="l">${Math.abs(d) < 3 ? 'about average' : (d > 0 ? d + '% more than average' : (-d) + '% fewer than average')}</td></tr>`; }).join('');
  const home = S.results.filter(r => r.home === parkPick), hw = home.filter(r => r.rh > r.ra).length, hl = home.length - hw;
  const away = S.results.filter(r => r.away === parkPick), aw = away.filter(r => r.ra > r.rh).length, al = away.length - aw;
  const runsHere = home.reduce((s, r) => s + r.ra + r.rh, 0), hrHere = ''; const R = S.records || {};
  root.innerHTML = `<div class="pane"><h2>Ballparks</h2><div class="btnrow">${parks.map(p => `<button class="mini${p.code === parkPick ? ' on' : ''}" onclick="parkPick='${p.code}';UI.refresh()">${p.code}</button>`).join('')}</div>
    <div class="parkgrid"><div class="parkpic"><svg viewBox="0 0 600 428">${svg}</svg></div>
    <div><h3 style="margin-top:0">${esc(park)}</h3><p>Home of the <b>${esc(teamFull(parkPick))}</b> · ${esc(teamCity(parkPick))} · ${isDome(park) ? 'indoors, no wind' : 'open air'}</p>
    <p><b>Dimensions:</b> left field ${dims[0]} ft · center ${dims[1]} ft · right ${dims[2]} ft${park.includes('Fenway') ? ' · the Green Monster in left' : ''}</p>
    <h4>How it plays (${seasonYr()} park effects, measured from home vs road games)</h4><table class="data"><tr><th class="l">Result</th><th>Factor</th><th class="l">In plain English</th></tr>${pf}</table>
    <h4>This season here</h4><p>${home.length ? `The ${esc(nickOf(parkPick))} are <b>${hw}-${hl}</b> at home (${aw}-${al} on the road). ${plural(home.length, 'game')} played here, ${(runsHere / home.length).toFixed(1)} runs a game.` : 'No games here yet.'}</p>
    ${R.longhr && R.longhr.label && R.longhr.label.endsWith('at ' + parkPick) ? `<p>The season's longest home run was hit here: ${R.longhr.v} ft by ${esc(R.longhr.who)}.</p>` : ''}
    </div></div></div>`;
}
