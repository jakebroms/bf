/* stats.js: the stats pages dressed like a game, not a spreadsheet: standings and the race, leaders and awards, season stats, playoffs */
'use strict';

// ---------- the kit ----------
const tmChip = (code, cls) => { const c1 = teamColor(code, 1), c2 = teamColor(code, 2); return `<span class="tm ${cls || ''}" style="background:${c1};border-color:${c2}" title="${esc(teamFull(code))}">${esc(friendlyCode(code))}</span>`; };
function heroHtml(title, sub, chips) {
  return `<div class="hero"><div><div class="hero-t">${title}</div><div class="hero-s">${sub}</div></div>${chips && chips.length ? `<div class="hero-c">${chips.map(([k, v]) => `<div class="hc"><div class="hv">${v}</div><div class="hk">${k}</div></div>`).join('')}</div>` : ''}</div>`;
}
function seasonProgress() { const played = Object.keys(S.played).length; const last = S.results.length ? S.results[S.results.length - 1] : null; return { played, date: last ? last.date : '', total: D.schedule.length, days: new Set(S.results.map(r => r.day)).size }; }
function teamForm(code) {
  const gs = S.results.filter(r => (r.away === code || r.home === code) && !/Exhibition|LCS|Series|Wild/.test(r.label || ''));
  let w10 = 0, l10 = 0; gs.slice(-10).forEach(r => { ((r.ra > r.rh ? r.away : r.home) === code) ? w10++ : l10++; });
  let n = 0, kind = ''; for (let i = gs.length - 1; i >= 0; i--) { const k = (gs[i].ra > gs[i].rh ? gs[i].away : gs[i].home) === code ? 'W' : 'L'; if (!kind) kind = k; if (k !== kind) break; n++; }
  return { l10: gs.length ? w10 + '-' + l10 : '-', streak: kind ? kind + n : '-', hot: kind === 'W' && n >= 4, cold: kind === 'L' && n >= 4 };
}
const subTitle = () => { const p = seasonProgress(); return p.played ? `Through ${esc(p.date)} · ${p.played} of ${p.total} games played` : 'The season has not started'; };
const lgSub = lg => leagueName(lg).replace(' League', '');

// ---------- STANDINGS & THE RACE ----------
let showAllResults = false;
function standingsScreen() {
  const root = $('screen'); const p = seasonProgress();
  let h = `<div class="pane stats">` + heroHtml('Standings', subTitle(), p.played ? [['games', p.played], ['days', p.days], ['leaders', standingsData().map(d => friendlyCode(d.teams[0].code)).join(' · ')]] : []);
  h += `<div class="stgrid">`;
  for (const d of standingsData()) {
    const n = d.teams.length;
    h += `<div class="stcard"><div class="stcard-h">${esc(d.title)}</div><table class="stbl"><tr><th></th><th class="l">Club</th><th>W</th><th>L</th><th>Pct</th><th>GB</th><th>L10</th><th>Strk</th><th class="small">1977</th></tr>`;
    d.teams.forEach((t, i) => {
      const f = teamForm(t.code); const pct = (t.w + t.l) ? t.w / (t.w + t.l) : 0;
      h += `<tr class="${i === 0 ? 'lead' : ''}"><td class="rk">${i === 0 && p.played ? '<span class="crown">★</span>' : i + 1}</td><td class="l club">${tmChip(t.code)} <b>${esc(t.name)}</b><div class="pace" style="width:${Math.round(pct * 100)}%;background:${teamColor(t.code, 1)}"></div></td><td class="w">${t.w}</td><td>${t.l}</td><td>${t.pct}</td><td>${t.gb}</td><td>${f.l10}</td><td class="${f.hot ? 'hot' : f.cold ? 'cold' : ''}">${f.streak}</td><td class="small dim">${t.real}</td></tr>`;
    });
    h += `</table></div>`;
  }
  h += `</div>`;
  h += raceHtml();
  // results
  const list = S.results.slice().reverse(); const shown = showAllResults ? list : list.slice(0, 24);
  if (list.length) {
    h += `<h3 class="sec">Results <small>${showAllResults ? 'all ' + list.length : 'the last ' + shown.length}</small></h3><div class="resgrid">`;
    for (const r of shown) { const aw = r.ra > r.rh; h += `<div class="res"><div class="res-d">${esc(String(r.label || '').replace(/^#\d+ · /, '').replace(/ · \w+ \d+ at \w+ \d+$/, ''))}</div><div class="res-l${aw ? ' won' : ''}">${tmChip(r.away)} ${esc(nickOf(r.away))}<span class="res-s">${r.ra}</span></div><div class="res-l${aw ? '' : ' won'}">${tmChip(r.home)} ${esc(nickOf(r.home))}<span class="res-s">${r.rh}</span></div><div class="res-p">W ${esc(r.wp.split(' ').slice(-1)[0])} · L ${esc(r.lp.split(' ').slice(-1)[0])}${r.sv ? ' · S ' + esc(r.sv.split(' ').slice(-1)[0]) : ''}${r.att ? ' · ' + fmtNum(r.att) : ''}</div></div>`; }
    h += `</div>`;
    if (list.length > 24) h += `<div class="btnrow"><button class="btn" onclick="showAllResults=!showAllResults;UI.refresh()">${showAllResults ? 'Show just the recent ones' : 'Show every result (' + list.length + ')'}</button></div>`;
  }
  h += `<div class="btnrow end"><button class="btn warn" onclick="Actions.restartSeason()">Restart the season</button></div></div>`;
  root.innerHTML = h;
}
function raceHtml() {
  const played = Object.keys(S.played).length; if (!played) return '';
  let h = '<h3 class="sec">The pennant race</h3><div class="racegrid">';
  for (const lg of leagueList()) {
    const divs = [...new Set(D.teams.filter(t => t[T.LG] === lg).map(t => t[T.DIV] || ''))];
    for (const dv of divs) {
      const rows = divStandings(lg, dv); const lead = rows[0], second = rows[1]; const gp = S.teams[lead.code].w + S.teams[lead.code].l;
      let magic = ''; if (second && gp >= 110) { const m = 163 - lead.w - second.l; magic = m <= 0 ? `<span class="tag clinch">CLINCHED</span>` : m <= 30 ? `<span class="tag magic">Magic number ${m}</span>` : ''; }
      const tight = second && second.gb <= 2 && gp >= 20 ? `<span class="tag hot">RACE ON</span>` : '';
      const chart = raceChart(lg, dv);
      h += `<div class="racebox"><div class="raceh"><span class="raceh-t">${esc(lgSub(lg))} ${esc(divName(dv))}</span>${magic}${tight}</div>
        <div class="racelead">${tmChip(lead.code)} <b>${esc(teamFull(lead.code))}</b> ${lead.w}-${lead.l}${second ? `<span class="dim"> · ${esc(nickOf(second.code))} ${second.gb ? gbWords(second.gb) + ' back' : 'tied'}</span>` : ''}</div>
        ${chart || '<div class="small dim">The chart draws itself after the first week.</div>'}</div>`;
    }
  }
  h += '</div><h3 class="sec">If the season ended today</h3><div class="pogrid2">';
  for (const lg of leagueList()) { const divs = [...new Set(D.teams.filter(t => t[T.LG] === lg).map(t => t[T.DIV] || ''))]; const champs = divs.map(dv => divStandings(lg, dv)[0]); h += `<div class="matchup"><div class="matchup-h">${esc(leagueName(lg))} Championship Series</div>${champs.map(c => `<div class="matchup-t">${tmChip(c.code)} <b>${esc(teamFull(c.code))}</b> <span class="dim">${c.w}-${c.l}</span></div>`).join('<div class="vs">vs</div>')}</div>`; }
  return h + '</div>';
}

// ---------- LEADERS & AWARDS ----------
let leadersLg = 'AL';
function leadersScreen() {
  const root = $('screen'); if (!leagueList().includes(leadersLg)) leadersLg = leagueList()[0];
  const lg = leadersLg;
  let h = `<div class="pane stats">` + heroHtml('Leaders & awards', subTitle());
  h += `<div class="lgtabs">${leagueList().map(l => `<button class="lgtab${l === lg ? ' on' : ''}" onclick="leadersLg='${l}';UI.refresh()">${esc(leagueName(l))}</button>`).join('')}</div>`;
  h += awardsHtml(lg);
  const cards = defs => defs.map(([k, s]) => { const t = leaderTable(k, s, lg); const top = t.rows[0];
    return `<div class="ldc"><div class="ldc-h">${esc(t.title)}</div>${top ? `<div class="ldc-top">${tmChip(top.team)}<div class="ldc-n">${esc(top.who)}</div><div class="ldc-v">${top.v}</div></div><div class="ldc-rest">${t.rows.slice(1, 5).map((r, i) => `<div><span class="dim">${i + 2}.</span> ${esc(r.who)} <span class="dim">${friendlyCode(r.team)}</span><span class="ldc-rv">${r.v}</span></div>`).join('')}</div>` : '<div class="small dim ldc-none">No qualifiers yet</div>'}</div>`; }).join('');
  h += `<h3 class="sec">Batting leaders</h3><div class="ldgrid">${cards(LEADER_DEFS.filter(d => d[0] === 'B'))}</div>`;
  h += `<h3 class="sec">Pitching leaders</h3><div class="ldgrid">${cards(LEADER_DEFS.filter(d => d[0] === 'P'))}</div>`;
  h += `<p class="small dim">To qualify: 3.1 plate appearances per team game for the averages, one inning per team game for ERA and WHIP.</p>`;
  const tl = teamLeaders(lg);
  h += `<h3 class="sec">${esc(lgSub(lg))} clubs</h3><div class="stcard"><table class="stbl"><tr><th class="l">Club</th><th>W</th><th>L</th><th>Runs</th><th>HR</th><th>AVG</th><th>SB</th><th>ERA</th><th>Runs allowed</th><th>Errors</th></tr>${tl.map(t => { const code = D.teams.find(x => x[T.NAME] === t.name)[T.CODE]; return `<tr><td class="l club">${tmChip(code)} <b>${esc(t.name)}</b></td><td class="w">${t.w}</td><td>${t.l}</td><td>${t.r}</td><td>${t.hr}</td><td>${t.avg}</td><td>${t.sb}</td><td>${t.era}</td><td>${t.ra}</td><td>${t.e}</td></tr>`; }).join('')}</table></div>`;
  h += recordsHtml();
  root.innerHTML = h + '</div>';
}
function recordsHtml() {
  const R = S.records || {}; const names = { crowd: 'Biggest crowd', longhr: 'Longest home run', hits: 'Most hits in a game', hr: 'Most homers in a game', rbi: 'Most RBI in a game', sb: 'Most steals in a game', k: 'Most strikeouts by a pitcher', runs: 'Most runs by a team', hitsteam: 'Most hits by a team', blowout: 'Biggest margin', innings: 'Longest game' };
  const units = { crowd: '', longhr: ' ft', innings: ' inn' };
  let cards = (R.nohit || []).map(n => `<div class="rec nohit"><div class="rec-v">NO-HITTER</div><div class="rec-t">${esc(n.who)}</div><div class="rec-w small">${esc(n.label)} · ${n.walks} walks</div></div>`).join('');
  for (const k in names) if (R[k]) cards += `<div class="rec"><div class="rec-t">${names[k]}</div><div class="rec-v">${k === 'crowd' ? fmtNum(R[k].v) : R[k].v}${units[k] || ''}</div><div class="rec-w">${esc(R[k].who)}</div><div class="rec-g small dim">${esc(R[k].label)}${R[k].extra && k !== 'longhr' ? ' · ' + esc(R[k].extra) : ''}</div></div>`;
  if (!cards) return '';
  return `<h3 class="sec">Season records</h3><div class="recgrid">${cards}</div><p class="small dim">${R.games || 0} games · ${R.shutouts || 0} shutouts · ${R.extras || 0} extra-inning games · ${R.walkoffs || 0} walk-off wins</p>`;
}
function awardsHtml(lg) {
  const weeks = Object.keys(S.weekly || {}).map(Number).sort((a, b) => a - b);
  if (!weeks.length) return '<h3 class="sec">Awards</h3><p class="small dim">Player of the week and the awards race appear once games are in the books.</p>';
  const lastWk = weeks[weeks.length - 1]; const curMonth = monthOfDay(lastWk * 7 + 3); const monthWeeks = weeks.filter(w => monthOfDay(w * 7 + 3) === curMonth);
  const MN = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October'];
  const wkB = bestOfPeriod([lastWk], lg), moB = bestOfPeriod(monthWeeks, lg);
  const g = Math.max(1, ...D.teams.filter(t => t[T.LG] === lg).map(t => teamGames(t[T.CODE])));
  const bats = Object.entries(S.seasonBat).filter(([id, s]) => teamLeague(s.team) === lg && s.AB + s.BB + s.HBP + s.SF >= 2.5 * g).map(([id, s]) => { const pa = s.AB + s.BB + s.HBP + s.SF; const tb = s.H + s['2B'] + 2 * s['3B'] + 3 * s.HR; const rc = pa ? (s.H + s.BB + s.HBP) * (tb + 0.5 * s.SB) / pa : 0; return { id, s, v: rc + s.RBI * 0.15 + s.R * 0.1 }; }).sort((a, b) => b.v - a.v).slice(0, 5);
  const pits = Object.entries(S.seasonPit).filter(([id, s]) => teamLeague(s.team) === lg && s.OUTS >= 20 * g / 10).map(([id, s]) => { const ip = s.OUTS / 3, era = s.OUTS ? s.ER * 27 / s.OUTS : 9; return { id, s, v: 6 * s.W - 2 * s.L + 4 * s.SV + ip * (4.5 - era) * 0.35 + s.K / 8 }; }).sort((a, b) => b.v - a.v).slice(0, 5);
  const gg = []; for (let f = 2; f <= 9; f++) { const cands = Object.keys(S.seasonBat).filter(id => teamLeague(S.seasonBat[id].team) === lg && hasFld(id, f) && S.seasonBat[id].G >= g * 0.5).map(id => ({ id, r: fieldVal(id, f, F.RNGR, 5), e: fieldVal(id, f, F.ER, 99), inn: fieldVal(id, f, F.INN, 0) })).sort((a, b) => a.r - b.r || a.e - b.e || b.inn - a.inn); if (cands[0]) gg.push({ f, id: cands[0].id }); }
  const mgr = D.teams.filter(t => t[T.LG] === lg).map(t => { const c = t[T.CODE], s = S.teams[c], n = s.w + s.l; const real = num(t[T.RW]) / (num(t[T.RW]) + num(t[T.RL])); return { c, v: n ? (s.w / n - real) * n : 0, rec: s.w + '-' + s.l }; }).sort((a, b) => b.v - a.v)[0];
  S.awards = S.awards || {};
  const batLine = s => `${avg3(s.H, s.AB)} · ${s.HR} HR · ${s.RBI} RBI · ${s.R} R`, pitLine = s => `${s.W}-${s.L}${s.SV ? ' · ' + s.SV + ' SV' : ''} · ${s.OUTS ? fmt2(s.ER * 27 / s.OUTS) : '-'} ERA · ${s.K} K`;
  const trophy = (key, cands, label, icon, fmt) => {
    if (!cands.length) return `<div class="trophy"><div class="tr-i">${icon}</div><div class="tr-l">${label}</div><div class="small dim">Not yet</div></div>`;
    const pickId = S.awards[lg + '|' + key]; const chosen = pickId && cands.find(c => c.id === pickId) ? pickId : cands[0].id; const c = cands.find(x => x.id === chosen);
    return `<div class="trophy"><div class="tr-i">${icon}</div><div class="tr-l">${label}</div><div class="tr-n">${esc(fullName(c.id))}</div><div class="tr-t">${tmChip(c.s.team)} ${esc(teamFull(c.s.team))}</div><div class="tr-s">${esc(fmt(c.s))}</div>
      <details class="tr-more"><summary>The race${pickId && pickId !== cands[0].id ? " · commissioner's pick" : ''}</summary>${cands.map((x, i) => `<div class="tr-r${x.id === chosen ? ' on' : ''}" onclick="S.awards['${lg}|${key}']='${x.id}';saveAll();UI.refresh()"><span class="dim">${i + 1}.</span> ${esc(fullName(x.id))} <span class="dim">${friendlyCode(x.s.team)} · ${esc(fmt(x.s))}</span></div>`).join('')}<div class="small dim">Click a name to hand him the award.</div></details></div>`;
  };
  const period = (label, icon, x, sub) => `<div class="trophy sm"><div class="tr-i">${icon}</div><div class="tr-l">${label}</div>${x ? `<div class="tr-n">${esc(fullName(x.id))}</div><div class="tr-t">${tmChip(x.team)} ${esc(nickOf(x.team))}</div><div class="tr-s">${esc(x.line)}</div>` : '<div class="small dim">Not yet</div>'}${sub ? `<div class="small dim">${sub}</div>` : ''}</div>`;
  let h = `<h3 class="sec">The awards race <small>if the season ended today</small></h3><div class="trgrid">`;
  h += trophy('mvp', bats, 'Most Valuable Player', '🏆', batLine) + trophy('cy', pits, 'Cy Young Award', '🏆', pitLine);
  h += `<div class="trophy"><div class="tr-i">🧤</div><div class="tr-l">Gold Gloves</div><div class="gglist">${gg.map(x => `<div class="ggl"><span class="pos">${posName(x.f)}</span> ${esc(fullName(x.id))} <span class="dim">${friendlyCode(S.seasonBat[x.id].team)}</span></div>`).join('') || '<span class="small dim">Not yet</span>'}</div></div>`;
  h += `<div class="trophy"><div class="tr-i">🏅</div><div class="tr-l">Manager of the Year</div>${mgr && mgr.v > 0 ? `<div class="tr-n">${esc(teamFull(mgr.c))}</div><div class="tr-t">${tmChip(mgr.c)} ${mgr.rec}</div><div class="tr-s">${mgr.v.toFixed(1)} wins above the club's real 1977 pace</div>` : '<div class="small dim">Nobody is beating his real pace yet</div>'}</div>`;
  h += `</div><h3 class="sec">This week and this month</h3><div class="trgrid four">`;
  h += period('Player of the Week', '⭐', wkB.hitter) + period('Pitcher of the Week', '⭐', wkB.pitcher) + period('Player of the Month', '🌟', moB.hitter, MN[curMonth]) + period('Pitcher of the Month', '🌟', moB.pitcher, MN[curMonth]);
  return h + '</div>';
}

// ---------- SEASON STATS ----------
let seasonSort = { bat: 'AB', pit: 'OUTS' };
function seasonScreen() {
  const root = $('screen'); const teams = D.teams.map(t => t[T.CODE]);
  let h = `<div class="pane stats">` + heroHtml('Season stats', subTitle());
  h += `<div class="chips"><button class="chip${seasonTeam ? '' : ' on'}" onclick="seasonTeam='';UI.refresh()">Everyone</button>${teams.map(t => `<button class="chip tmchip${seasonTeam === t ? ' on' : ''}" style="--c1:${teamColor(t, 1)};--c2:${teamColor(t, 2)}" onclick="seasonTeam='${t}';UI.refresh()">${esc(friendlyCode(t))}</button>`).join('')}</div>`;
  const g = seasonTeam ? Math.max(1, teamGames(seasonTeam)) : Math.max(1, ...teams.map(teamGames));
  if (seasonTeam) {
    const st = S.teams[seasonTeam]; const { lg, dv } = divisionOf(seasonTeam); const rows = divStandings(lg, dv); const place = rows.findIndex(r => r.code === seasonTeam) + 1; const f = teamForm(seasonTeam);
    const bl = Object.values(S.seasonBat).filter(s => s.team === seasonTeam); const pl = Object.values(S.seasonPit).filter(s => s.team === seasonTeam);
    const rs = bl.reduce((a, s) => a + s.R, 0), ra = pl.reduce((a, s) => a + s.R, 0);
    const bestB = bl.slice().sort((a, b) => (b.HR * 3 + b.RBI + b.H) - (a.HR * 3 + a.RBI + a.H))[0], bestP = pl.slice().sort((a, b) => (b.W * 3 + b.SV * 2 + b.K / 10) - (a.W * 3 + a.SV * 2 + a.K / 10))[0];
    h += `<div class="teamhdr" style="background:${teamColor(seasonTeam, 1)};border-color:${teamColor(seasonTeam, 2)}"><div class="th-n">${esc(teamFull(seasonTeam))}</div><div class="th-r">${st.w}-${st.l}</div><div class="th-s">${place ? ordinal(place) + ' in the ' + esc(lgSub(lg) + ' ' + divName(dv)) : ''}${rows[place - 1] && rows[place - 1].gb ? ' · ' + gbWords(rows[place - 1].gb) + ' back' : place === 1 && st.w + st.l ? ' · in first' : ''} · last 10: ${f.l10} · streak ${f.streak}</div>
      <div class="th-c"><div class="hc"><div class="hv">${rs}</div><div class="hk">runs scored</div></div><div class="hc"><div class="hv">${ra}</div><div class="hk">runs allowed</div></div><div class="hc"><div class="hv">${rs - ra >= 0 ? '+' : ''}${rs - ra}</div><div class="hk">differential</div></div>${bestB ? `<div class="hc"><div class="hv">${esc(lastName(Object.keys(S.seasonBat).find(k => S.seasonBat[k] === bestB)))}</div><div class="hk">${bestB.HR} HR · ${bestB.RBI} RBI</div></div>` : ''}${bestP ? `<div class="hc"><div class="hv">${esc(lastName(Object.keys(S.seasonPit).find(k => S.seasonPit[k] === bestP)))}</div><div class="hk">${bestP.W}-${bestP.L}${bestP.SV ? ' · ' + bestP.SV + ' SV' : ''}</div></div>` : ''}</div></div>`;
  }
  const hdr = (kind, key, label, title) => `<th class="${seasonSort[kind] === key ? 'sorted' : ''}" title="${title || 'Sort by ' + label}" onclick="seasonSort.${kind}='${key}';UI.refresh()">${label}</th>`;
  // batting
  const bcols = [['G', 'G'], ['AB', 'AB'], ['R', 'R'], ['H', 'H'], ['2B', '2B'], ['3B', '3B'], ['HR', 'HR'], ['RBI', 'RBI'], ['BB', 'BB'], ['K', 'K'], ['SB', 'SB'], ['CS', 'CS'], ['E', 'E'], ['AVG', 'AVG'], ['OBP', 'OBP'], ['SLG', 'SLG'], ['OPS', 'OPS'], ['streak', 'Streak']];
  const bval = (s, k) => k === 'AVG' ? (s.AB ? s.H / s.AB : 0) : k === 'OBP' ? obpOf(s) : k === 'SLG' ? slgOf(s) : k === 'OPS' ? obpOf(s) + slgOf(s) : k === 'streak' ? (s.streak || 0) : num(s[k]);
  const rate = k => ['AVG', 'OBP', 'SLG', 'OPS'].includes(k);
  const bk = seasonSort.bat; const qualB = s => s.AB + s.BB + s.HBP + s.SF + s.SH >= 3.1 * g;
  let bats = Object.entries(S.seasonBat).filter(([id, s]) => !seasonTeam || s.team === seasonTeam);
  bats.sort((a, b) => (rate(bk) ? (qualB(b[1]) - qualB(a[1])) : 0) || bval(b[1], bk) - bval(a[1], bk) || b[1].AB - a[1].AB);
  h += `<h3 class="sec">Batting <small>click a column to sort</small></h3><div class="tblwrap"><table class="stbl stats-t"><tr><th></th><th class="l">Player</th><th>Club</th>${bcols.map(([k, l]) => hdr('bat', k, l, k === 'streak' ? 'Current hitting streak (season best)' : '')).join('')}</tr>`;
  bats.forEach(([id, s], i) => { const ob = obpOf(s), sl = slgOf(s); const q = qualB(s);
    h += `<tr class="${i < 3 && bk !== 'AB' && bk !== 'G' ? 'top' + (i + 1) : ''}${rate(bk) && !q ? ' nq' : ''}"><td class="rk">${i + 1}</td><td class="l"><b>${esc(s.name)}</b></td><td>${tmChip(s.team)}</td><td>${s.G}</td><td>${s.AB}</td><td>${s.R}</td><td>${s.H}</td><td>${s['2B']}</td><td>${s['3B']}</td><td>${s.HR}</td><td>${s.RBI}</td><td>${s.BB}</td><td>${s.K}</td><td>${s.SB}</td><td>${s.CS}</td><td>${s.E}</td><td>${avg3(s.H, s.AB)}</td><td>${s.AB ? fmt3(ob) : '---'}</td><td>${s.AB ? fmt3(sl) : '---'}</td><td>${s.AB ? fmt3(ob + sl) : '---'}</td><td>${s.streak || 0}${s.best ? ' <span class="dim">(' + s.best + ')</span>' : ''}</td></tr>`; });
  if (!bats.length) h += `<tr><td colspan="21" class="l dim">No games yet.</td></tr>`;
  h += `</table></div>`;
  // pitching
  const pcols = [['G', 'G'], ['GS', 'GS'], ['W', 'W'], ['L', 'L'], ['SV', 'SV'], ['OUTS', 'IP'], ['H', 'H'], ['R', 'R'], ['ER', 'ER'], ['BB', 'BB'], ['K', 'K'], ['HR', 'HR'], ['CG', 'CG'], ['SHO', 'SHO'], ['ERA', 'ERA'], ['WHIP', 'WHIP']];
  const pk = seasonSort.pit; const low = pk === 'ERA' || pk === 'WHIP'; const qualP = s => s.OUTS / 3 >= g;
  const pval = (s, k) => k === 'ERA' ? (s.OUTS ? s.ER * 27 / s.OUTS : 99) : k === 'WHIP' ? (s.OUTS ? (s.H + s.BB) * 3 / s.OUTS : 99) : num(s[k]);
  let pits = Object.entries(S.seasonPit).filter(([id, s]) => !seasonTeam || s.team === seasonTeam);
  pits.sort((a, b) => (low ? (qualP(b[1]) - qualP(a[1])) : 0) || (low ? pval(a[1], pk) - pval(b[1], pk) : pval(b[1], pk) - pval(a[1], pk)) || b[1].OUTS - a[1].OUTS);
  h += `<h3 class="sec">Pitching <small>click a column to sort</small></h3><div class="tblwrap"><table class="stbl stats-t"><tr><th></th><th class="l">Pitcher</th><th>Club</th>${pcols.map(([k, l]) => hdr('pit', k, l)).join('')}</tr>`;
  pits.forEach(([id, s], i) => { h += `<tr class="${i < 3 && pk !== 'OUTS' && pk !== 'G' ? 'top' + (i + 1) : ''}${low && !qualP(s) ? ' nq' : ''}"><td class="rk">${i + 1}</td><td class="l"><b>${esc(s.name)}</b></td><td>${tmChip(s.team)}</td><td>${s.G}</td><td>${s.GS}</td><td>${s.W}</td><td>${s.L}</td><td>${s.SV}</td><td>${ipTxt(s.OUTS)}</td><td>${s.H}</td><td>${s.R}</td><td>${s.ER}</td><td>${s.BB}</td><td>${s.K}</td><td>${s.HR}</td><td>${s.CG}</td><td>${s.SHO}</td><td>${s.OUTS ? fmt2(s.ER * 27 / s.OUTS) : '-.--'}</td><td>${s.OUTS ? fmt2((s.H + s.BB) * 3 / s.OUTS) : '-.--'}</td></tr>`; });
  if (!pits.length) h += `<tr><td colspan="19" class="l dim">No games yet.</td></tr>`;
  h += `</table></div>`;
  root.innerHTML = h + gateHtml() + '</div>';
}

// ---------- PLAYOFFS ----------
function playoffsScreen() {
  const root = $('screen'); const po = S.playoffs || (S.playoffs = poDefaults());
  const teams = lg => D.teams.filter(t => t[T.LG] === lg).map(t => t[T.CODE]);
  const seedSel = (lg, i) => `<select class="poseed" data-lg="${lg}" data-i="${i}"><option value="">from the standings</option>${teams(lg).map(c => `<option${(po.typed[lg] || [])[i] === c ? ' selected' : ''}>${esc(teamFull(c))}</option>`).join('')}</select>`;
  const n = clamp(num(po.n) || 2, 1, 8);
  let h = `<div class="pane stats">` + heroHtml('Playoffs', po.mode ? (po.champ ? `${esc(teamFull(po.champ))} are the champions` : 'The bracket is set') : 'Set up October');
  if (po.champ) h += `<div class="champ"><div class="champ-i">🏆</div><div><div class="champ-t">${seasonYr()} World Champions</div><div class="champ-n">${tmChip(po.champ)} ${esc(teamFull(po.champ))}</div></div></div>`;
  if (po.mode) {
    const rounds = []; for (const r of po.rows) { let g = rounds.find(x => x.name === r.round); if (!g) { g = { name: r.round, rows: [] }; rounds.push(g); } g.rows.push(r); }
    h += `<div class="bracket">`;
    for (const rd of rounds) {
      h += `<div class="brk-col"><div class="brk-h">${esc(rd.name)}</div>`;
      for (const r of rd.rows) {
        const need = Math.ceil((r.key && r.key[4] ? num(r.key[4]) : 7) / 2); const done = r.hiW >= need || r.loW >= need;
        const line = (code, w, won) => `<div class="brk-t${won ? ' won' : done ? ' lost' : ''}">${tmChip(code)} <span class="brk-n">${esc(teamFull(code))}</span><span class="brk-w">${'●'.repeat(w)}${'○'.repeat(Math.max(0, need - w))}</span></div>`;
        h += `<div class="series">${line(r.hi, r.hiW, r.hiW >= need)}${line(r.lo, r.loW, r.loW >= need)}<div class="brk-s small">${esc(r.status)}</div></div>`;
      }
      h += `</div>`;
    }
    if (!rounds.some(r => r.name === 'World Series')) h += `<div class="brk-col"><div class="brk-h">World Series</div><div class="series"><div class="brk-t"><span class="brk-n dim">American League champion</span></div><div class="brk-t"><span class="brk-n dim">National League champion</span></div><div class="brk-s small">Best of ${po.ws}</div></div></div>`;
    h += `</div><div class="btnrow"><button class="btn primary" style="width:auto" onclick="Actions.poPlay()"${po.champ ? ' disabled' : ''}>PLAY THE NEXT PLAYOFF GAME</button><button class="btn warn" onclick="Actions.poReset()">Clear the bracket</button></div>`;
  }
  h += `<details class="setup"${po.mode ? '' : ' open'}><summary>${po.mode ? 'Change the format' : 'Set up the bracket'}</summary><p class="small dim">1977 had two teams a league: the League Championship Series best of five, the World Series best of seven. Leave the seeds on "from the standings" to take the division winners.</p>
  <div class="pogrid"><div><label>Teams per league <input id="poN" type="number" min="1" max="8" value="${n}"></label>
  <label>LCS best of <input id="poB4" type="number" min="1" max="9" value="${po.bo[4]}"></label><label>Division Series best of <input id="poB3" type="number" min="1" max="9" value="${po.bo[3]}"></label><label>Wild Card best of <input id="poB2" type="number" min="1" max="9" value="${po.bo[2]}"></label>
  <label>World Series best of <input id="poWS" type="number" min="1" max="9" value="${po.ws}"></label><label>World Series home field <select id="poHF">${['AL', 'NL', 'Better record'].map(v => `<option${po.hf === v ? ' selected' : ''}>${v}</option>`).join('')}</select></label></div>
  <div><b>American League seeds</b>${Array.from({ length: n }, (_, i) => `<div class="seed">${i + 1}. ${seedSel('AL', i)}</div>`).join('')}</div><div><b>National League seeds</b>${Array.from({ length: n }, (_, i) => `<div class="seed">${i + 1}. ${seedSel('NL', i)}</div>`).join('')}</div></div>
  <div class="btnrow"><button class="btn ${po.mode ? '' : 'primary'}" style="width:auto" onclick="Actions.poSetup()">${po.mode ? 'Set the bracket again' : 'SET UP THE BRACKET'}</button></div></details>`;
  root.innerHTML = h + '</div>';
}
