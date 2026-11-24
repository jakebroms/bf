/* gate.js: attendance, gate receipts, rain, rainouts and doubleheaders */
'use strict';

// Average home crowd in 1977 (season total / 81) and park capacity, by club.
// Totals are the real 1977 figures, rounded: LA led the majors at 2.96 million, Oakland drew 495,000.
const ATT77 = {
  BAL: [14800, 52000], BOS: [25600, 33500], CAL: [17700, 43000], CHA: [20500, 44500], CLE: [11100, 74000], DET: [16800, 54000],
  KCA: [22900, 40600], MIL: [13800, 53000], MIN: [14400, 45900], NYA: [26000, 57500], OAK: [6100, 50000], SEA: [16500, 59000],
  TEX: [15400, 41000], TOR: [21000, 43700], ATL: [10800, 52700], CHN: [17800, 37700], CIN: [31100, 52400], HOU: [13700, 45000],
  LAN: [36500, 56000], MON: [17700, 58500], NYN: [13200, 55300], PHI: [33300, 62400], PIT: [15300, 50200], SDN: [17000, 47600],
  SFN: [8600, 58000], SLN: [20500, 50100],
};
// clubs people pay to see on the road
const DRAW77 = { NYA: 1.3, BOS: 1.15, LAN: 1.2, CIN: 1.25, PHI: 1.1, KCA: 1.05, NYN: 1.05, CHN: 1.05 };
const TICKET77 = 3.98;  // the average major-league ticket in 1977
const DOW = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
function gameDOW() { return G.dayNo > 0 ? DOW[new Date(seasonYr(), 0, G.dayNo).getDay()] : ''; }
function gameMonth() { return G.dayNo > 0 ? new Date(seasonYr(), 0, G.dayNo).getMonth() + 1 : 7; }
const fmtNum = n => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
const fmtMoney = n => '$' + fmtNum(n);
function gaussian() { let u = 0, v = 0; while (u === 0) u = rand(); while (v === 0) v = rand(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
function westCoast(code) { return /^(LAN|SDN|SFN|OAK|CAL|SEA)$/.test(code); }

// ---------- rain ----------
// chance that today's game is washed out (outdoor parks only; the West Coast stays dry; spring and September are wettest)
function rainoutChance(park, home, dayNo) {
  if (opt('Rainouts') === 'Off' || isDome(park)) return 0;
  const mon = dayNo > 0 ? new Date(seasonYr(), 0, dayNo).getMonth() + 1 : 7;
  let p = mon <= 5 ? 0.035 : mon >= 9 ? 0.03 : 0.022;
  if (westCoast(home)) p *= 0.2; if (home === 'HOU' || home === 'ATL' || home === 'TEX') p *= 0.7;
  return p;
}
// the next scheduled game between the same two clubs at the same park: the makeup date for a doubleheader
function makeupFor(si) {
  const r = D.schedule[si];
  for (let j = si + 1; j < D.schedule.length; j++) { const x = D.schedule[j]; if (x[SC.HOME] === r[SC.HOME] && x[SC.AWAY] === r[SC.AWAY] && x[SC.PARK] === r[SC.PARK] && !(j in S.played) && !(S.ppd && S.ppd[j])) return j; }
  return -1;
}
// called by nextSchedIdx: is schedule game i waiting on a makeup date that has not come yet?
function ppdPending(i) { const p = S.ppd && S.ppd[i]; return !!p && !(p.makeup in S.played); }
// a rained-out game gets postponed: returns the record, or null if it cannot be made up (no later visit)
function rainOut(si) {
  const j = makeupFor(si); if (j < 0) return null;
  const r = D.schedule[si], m = D.schedule[j];
  S.ppd = S.ppd || {}; S.rainouts = S.rainouts || [];
  const rec = { si, makeup: j, date: r[SC.DATE], away: r[SC.AWAY], home: r[SC.HOME], park: r[SC.PARK], makeupDate: m[SC.DATE], gameNo: S.gameNo };
  S.ppd[si] = rec; S.rainouts.push(rec);
  return rec;
}
function rainoutText(rec) { return `RAINED OUT: ${teamFull(rec.away)} at ${teamFull(rec.home)}, ${rec.date}, postponed. It will be made up as part of a doubleheader on ${rec.makeupDate}.`; }
// doubleheader status for the game being loaded: 0 single game, 1 first game, 2 second game (the makeup)
function dhStatus(si) {
  if (S.ppd && S.ppd[si] && (S.ppd[si].makeup in S.played)) return 2;
  if (S.ppd) for (const k in S.ppd) if (S.ppd[k].makeup === si) return 1;
  return 0;
}

// ---------- the crowd ----------
function rollAttendance() {
  G.att = 0; G.gate = 0; G.attNote = '';
  if (G.exhib || G.sched < 0 && G.playoffRow < 0) return;
  const home = teamCode(1), away = teamCode(0), park = parkName();
  const base = ATT77[home] || [15000, 50000]; let cap = base[1];
  let att = base[0];
  const notes = [];
  if (G.playoffRow >= 0) { att = cap * (0.93 + rand() * 0.06); notes.push('playoff sellout'); }
  else {
    const dow = gameDOW();
    att *= dow === 'Saturday' ? 1.3 : dow === 'Sunday' ? 1.28 : dow === 'Friday' ? 1.12 : 0.84;
    att *= DRAW77[away] || 1;
    const t = S.teams[home], g = t.w + t.l;
    if (g >= 20) { const pct = t.w / g; att *= clamp(1 + (pct - 0.5) * 1.1, 0.75, 1.3); }
    const mon = gameMonth();
    if (mon >= 9 && g >= 100) { const { lg, dv } = divisionOf(home); const row = divStandings(lg, dv).find(r => r.code === home); if (row && row.gb <= 3) { att *= 1.25; notes.push('pennant-race crowd'); } }
    if (t.w + t.l <= 6 && !(S.gate && S.gate[home] && S.gate[home].g > 0)) { att = cap * (0.9 + rand() * 0.08); notes.push('Opening Day'); }
    if (G.dh === 1) { att *= 1.45; notes.push('doubleheader'); }
    if (G.dh === 2) { att = 0; notes.push('second game of the doubleheader (one admission)'); }
    const w = G.weather;
    if (w && w.dir !== 'Dome') { if (w.dir === 'Rain') { att *= 0.65; notes.push('rain'); } else if (w.temp < 40) { att *= 0.6; notes.push('cold'); } else if (w.temp < 50) att *= 0.8; else if (w.temp >= 70 && w.temp <= 85) att *= 1.05; }
    if (att > 0 && rand() < 0.06) { att *= 1.3; notes.push(pick(['Bat Day', 'Cap Day', 'Jacket Night', 'Old-Timers Day', 'Helmet Day', 'Fireworks Night', 'Camera Day', 'Ball Day'])); }
    att *= Math.exp(gaussian() * 0.22);
  }
  if (att > cap * 0.985) { att = cap * (0.985 + rand() * 0.015); if (!notes.some(n => /sellout|Opening/.test(n))) notes.push('sellout'); }
  if (att > 0 && att < 1500) att = 1500 + rand() * 800;
  G.att = Math.round(att) + (att > 0 ? Math.floor(rand() * 7) : 0);
  G.gate = Math.round(G.att * TICKET77 * (0.9 + rand() * 0.2));
  G.attNote = notes.join(', ');
}
function attText() { if (!G.att) return G.dh === 2 ? 'Game 2 of the doubleheader' : ''; return 'Att. ' + fmtNum(G.att) + (G.attNote ? ' (' + G.attNote + ')' : ''); }
// time of game: a 1977 game ran about two and a half hours
function timeOfGame() {
  const runs = G.score[0] + G.score[1], hits = G.hits[0] + G.hits[1];
  const bb = G.boxPit.reduce((s, p) => s + p.BB, 0), pitchers = G.boxPit.length;
  let min = 96 + (G.inn - 9) * 11 + runs * 2 + hits * 1.2 + bb * 1.5 + pitchers * 2 + (rand() * 14 - 7);
  if (G.half === 0 && G.over) min -= 10;
  min = Math.max(95, Math.round(min)); return Math.floor(min / 60) + ':' + String(min % 60).padStart(2, '0');
}
// the crowd's size as 0..1 for the sound engine (a full house roars, 6,000 in Oakland does not)
function crowdSize() { if (!G.att) return G.dh === 2 ? 0.55 : 0.6; const home = teamCode(1); const cap = (ATT77[home] || [15000, 50000])[1]; return clamp(0.25 + 0.75 * Math.sqrt(G.att / cap), 0.25, 1); }
// season totals, kept per home club
function gateRecord() {
  if (G.exhib || G.playoffRow >= 0 || G.sched < 0) return;
  S.gate = S.gate || {}; const home = teamCode(1); const g = S.gate[home] || (S.gate[home] = { g: 0, att: 0, gate: 0, best: 0, bestDate: '', bestOpp: '', worst: 0, worstDate: '' });
  g.g++; g.att += G.att; g.gate += G.gate;
  if (G.att > g.best) { g.best = G.att; g.bestDate = gameDate(); g.bestOpp = teamCode(0); }
  if (G.att > 0 && (!g.worst || G.att < g.worst)) { g.worst = G.att; g.worstDate = gameDate(); }
  const R = S.records || (S.records = {});
  if (G.att > 0 && (!R.crowd || G.att > R.crowd.v)) R.crowd = { v: G.att, who: teamFull(home) + ' vs ' + nickOf(teamCode(0)), game: G.gameNo, label: gameDate() + ' ' + teamCode(0) + ' at ' + teamCode(1), extra: parkName() };
}
function gateHtml() {
  const g = S.gate || {}; const rows = Object.keys(g).map(c => ({ c, ...g[c] })).filter(x => x.g > 0).sort((a, b) => b.att / b.g - a.att / a.g);
  if (!rows.length) return '';
  const tot = rows.reduce((s, x) => s + x.att, 0), tg = rows.reduce((s, x) => s + x.g, 0);
  let h = `<h3>Attendance and gate</h3><p class="small">Crowds are drawn from each club's real 1977 draw, the day of the week, the opponent, the weather, the standings and the promotions calendar. Gate at the 1977 average ticket of $3.98. League average so far: <b>${fmtNum(tot / tg)}</b> a game.</p>`;
  h += `<table class="data"><tr><th class="l">Club</th><th>Home games</th><th>Total</th><th>Average</th><th>1977 average</th><th>Biggest crowd</th><th>Smallest</th><th>Gate</th></tr>`;
  for (const x of rows) h += `<tr><td class="l">${esc(teamFull(x.c))}</td><td>${x.g}</td><td>${fmtNum(x.att)}</td><td><b>${fmtNum(x.att / x.g)}</b></td><td class="small">${fmtNum((ATT77[x.c] || [0])[0])}</td><td>${fmtNum(x.best)} <span class="small">${esc(x.bestDate)} vs ${x.bestOpp}</span></td><td>${fmtNum(x.worst)} <span class="small">${esc(x.worstDate)}</span></td><td>${fmtMoney(x.gate)}</td></tr>`;
  h += '</table>';
  const ro = S.rainouts || [];
  if (ro.length) h += `<h3>Rainouts</h3><table class="data"><tr><th>Date</th><th>Game</th><th>Park</th><th>Made up</th></tr>${ro.map(r => `<tr><td>${esc(r.date)}</td><td>${r.away} at ${r.home}</td><td class="small">${esc(r.park)}</td><td>${esc(r.makeupDate)}${(r.si in S.played) ? ' · ' + esc(S.played[r.si]) : ' (doubleheader to come)'}</td></tr>`).join('')}</table>`;
  return h;
}
