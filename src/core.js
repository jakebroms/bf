/* =====================================================================
   BALL FIVE BASEBALL 1977 - web edition
   core.js: data indexes, options, state, cards, scoring helpers
   One roll 1-1000: 1-500 batter's card, 501-851 pitcher's card,
   852-1000 fielding checks (the fielder's range and error ratings decide).
   ===================================================================== */
'use strict';
const D = window.BF_DATA;
const BF_VERSION = '1.0 web';

// ---- column constants (0-based; VBA column minus 1) ----
const B = { ID:0, NAME:1, LAST:2, TEAM:3, BATS:4, L0:5, R0:15, GB0:25, AIR0:31, HIT0:40, ADV:43, SBATT:44, SBSUCC:45, GDP:46, STEAL:47, RUN:48, AB:49, H:50, HR:51, RBI:52, PA:53, FLD:54, HBPSH:55, BUNT:56, HNR:57, PKR:58 };
const P = { ID:0, NAME:1, LAST:2, TEAM:3, THROWS:4, L0:5, R0:15, STAM:25, HOLDX:26, HOLD:27, WP:28, W:29, L:30, SV:31, ERA:32, G:33, GS:34, IPO:35, GF:36, XL0:37, XR0:46, BK:55, HBPSH:56, PKF:57, SBO:58 };
const F = { ID:0, POS:1, RNG:2, ERR:3, ARM:4, CS:5, PB9:6, RNGR:7, ER:8, ARMR:9, INN:10 };
const T = { CODE:0, NAME:1, LG:2, DIV:3, RW:4, RL:5, W:6, L:7, NEXT:8, PARK:9, YEAR:10, RLG:11, SLOT:12, IN:13, C1:14, C2:15, CITY:16, PF0:17 };
const SC = { NO:0, DATE:1, AWAY:2, HOME:3, RA:4, RH:5, PARK:6, GID:7, DAY:8 };

const EV = { HR:1, B3:2, B2:3, B1:4, BB:5, K:6, GB:7, FB:8, LD:9, PU:10, WALL:11 };
const SPLIT_A = 0.15, SPLIT_C = 0.3, PIT_NONX = 351, PIT_X = 149;
const ERR_HIT_ON = 0.0342, ERR_HIT_EMPTY = 0.0138, ERR_OUT_ON = 0.02, HIT_TRIM = 0.055, ERR_SB = 0.1, ERR_PKO = 0.12;
const POP_SHARE = 0.23, SURP_SHARE = 0.05;
const LBL = ['', 'Home run', 'Triple', 'Double 3', 'Double', 'Double 2', 'Single 2', 'Single', 'Single 1', 'Walk / HBP', 'Strikeout', 'Ground out', 'Fly out', 'Line out', 'Pop out', 'At the wall'];
const ROW_EV = [0, EV.HR, EV.B3, EV.B2, EV.B2, EV.B2, EV.B1, EV.B1, EV.B1, EV.BB, EV.K, EV.GB, EV.FB, EV.LD, EV.PU, EV.WALL];
const ROW_SUB = ['', '', '', '3', 'C', '2', '2', 'C', '1', '', '', '', '', '', '', ''];
const POSN = ['', 'P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'];
const FIELDNAME = ['', 'the pitcher', 'the catcher', 'first', 'second', 'third', 'short', 'left', 'center', 'right'];
const WU_HI = [4, 11, 22, 38, 60, 90, 150, 220, 305, 400, 600, 695, 780, 850, 910, 940, 962, 978, 989, 996, 1000];

// ---- indexes ----
const IX = { bat:{}, pit:{}, fld:{}, tab:{}, misc:{}, x:{}, team:{}, staff:{}, typ:{}, real:{}, avail:{}, back:{} };
D.batters.forEach((r, i) => { if (!(r[0] in IX.bat)) IX.bat[r[0]] = i; });
D.pitchers.forEach((r, i) => { if (!(r[0] in IX.pit)) IX.pit[r[0]] = i; });
D.fielding.forEach((r, i) => { IX.fld[r[0] + '|' + r[1]] = i; });
D.tables.forEach((r, i) => { IX.tab[r[0] + '|' + r[1] + '|' + r[2]] = i; });
D.misc.forEach(r => { IX.misc[r[0]] = r[1]; });
D.xchart.forEach((r, i) => { IX.x[r[0]] = i; });
D.teams.forEach((r, i) => { IX.team[r[0]] = i; });
D.staff.forEach((r, i) => { IX.staff[r[0]] = i; });
D.typicallu.forEach((r, i) => { IX.typ[r[0] + '|' + r[1]] = i; });
D.reallu.forEach((r, i) => { IX.real[r[0] + '|' + r[1]] = i; });
D.avail.forEach((r, i) => { IX.avail[r[0] + '|' + r[1]] = i; });
D.backs.forEach((r, i) => { IX.back[r[0]] = i; });

// ---- small helpers ----
const num = v => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };
const clamp = (x, lo, hi) => x < lo ? lo : (x > hi ? hi : x);
const rand = () => Math.random();
const rnd1000 = () => Math.floor(rand() * 1000) + 1;
function oddsAdj(p, mult) { p = clamp(p, 0.0001, 0.9999); const o = p / (1 - p) * mult; return o / (1 + o); }
const fmtPct = p => Math.round(p * 100) + '%';
const fmt2 = x => x.toFixed(2);
const fmt3 = x => { const s = x.toFixed(3); return x >= 1 ? s : s.replace(/^0/, ''); };
const avg3 = (h, ab) => ab <= 0 ? '---' : fmt3(h / ab);
const ipTxt = outs => Math.floor(outs / 3) + '.' + (outs % 3);
const ordinal = n => n === 1 ? '1st' : n === 2 ? '2nd' : n === 3 ? '3rd' : n + 'th';
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const deepCopy = o => JSON.parse(JSON.stringify(o));
function friendlyCode(t) { return ({ NYA:'NYY', NYN:'NYM', LAN:'LAD', SLN:'STL', SFN:'SF', KCA:'KC', CHA:'CWS', CHN:'CHC', SDN:'SD', TBA:'TB', FLO:'FLA', MLN:'MIL' })[t] || t; }

// ---- options ----
const OPTION_DEFS = D.options.map(o => ({ name: o[0], def: String(o[1]), help: o[2] || '' }));
const OPTION_CHOICES = {
  'Games': ['1977 schedule', 'Pick teams'],
  'Lineups': ['Real for each game', 'My saved lineups', 'Typical'],
  'Injuries': ['Real', 'Off'],
  'Pitcher rest days': ['On', 'Off'],
  'Tired pitcher cutoff': ['Lenient (50%)', 'Normal (60%)', 'Strict (70%)'],
  'Click to play results': ['On', 'Off'],
  'Card lookup': ['Highlight', 'Find it yourself'],
  'Bouton tribute': ['On', 'Off'],
  'Pickoffs': ['Automatic', 'Manual'],
  'Computer steals': ['Off', 'Away', 'Home', 'Both'],
  'Mode': ['Basic', 'Advanced'],
  'Splits': ['Real', 'Blended'],
  'DH rule': ["Home team's league", 'Always', 'Never'],
};
let O = {};
function optDefaults() { const o = {}; OPTION_DEFS.forEach(d => o[d.name] = d.def); return o; }
let gSim = false;      // the computer plays the game start to finish
function opt(nm) {
  if (gSim) {
    if (['Pop-ups', 'Click to play results', 'Fielding check pop-ups', 'Send/hold prompts', 'Solo dice mode', 'Warm-up tosses'].includes(nm)) return 'Off';
    if (nm === 'Mode') return 'Basic';
    if (nm === 'Auto pitching changes' || nm === 'Computer steals') return 'Both';
  }
  if (nm === 'Auto pitching changes') return 'Off';
  return O[nm] == null ? '' : O[nm];
}
const prompts = () => opt('Send/hold prompts') === 'On' || opt('Mode') === 'Advanced';
const flavor = nm => opt(nm) === 'On' || opt('Mode') === 'Advanced';
const solo = () => opt('Solo dice mode') === 'On';
function teamOpt(nm, side) { const v = opt(nm); return v === 'Both' || (v === 'Away' && side === 0) || (v === 'Home' && side === 1); }
const popOpt = nm => !gSim && opt('Pop-ups') !== 'Off' && opt(nm) !== 'Off';
const popOn = () => opt('Pop-ups') !== 'Off' && !solo() && !gSim;
const clickMode = () => opt('Click to play results') !== 'Off';
const findMode = () => !gSim && opt('Card lookup') === 'Find it yourself' && G.misses < 2;

// ---- season (persistent) and game state ----
let S = null, G = null;
function newSeason() {
  const s = { teams: {}, played: {}, results: [], seasonBat: {}, seasonPit: {}, archive: {}, logAll: {}, pitRest: {}, myLU: {}, staff: {}, gameNo: 0, playoffs: null, records: {}, notes: {} };
  D.teams.forEach(t => { s.teams[t[T.CODE]] = { w: 0, l: 0, next: 0 }; });
  D.mylu.forEach(r => { s.myLU[r[0] + '|' + r[1]] = lineupFromRow(r); });
  D.staff.forEach(r => { s.staff[r[0]] = { rot: String(r[1] || '').split(',').filter(Boolean), closer: r[2] || '', pen: String(r[3] || '').split(',').filter(Boolean) }; });
  return s;
}
function lineupFromRow(r) { const a = []; for (let i = 1; i <= 9; i++) a.push({ id: r[2 * i] || '', pos: r[2 * i + 1] || '' }); return a; }
function newGame() {
  return {
    gameNo: 0, sched: -1, exhib: false, playoffRow: -1, dayNo: 0,
    teams: ['', ''], lineup: [[], []], pitcher: ['', ''],
    inn: 1, half: 0, outs: 0, bases: ['', '', ''],
    score: [0, 0], hits: [0, 0], errs: [0, 0], lob: [0, 0], innRuns: [[0], [0]],
    next: [1, 1],
    curPit: ['', ''], startPit: ['', ''], used: [[], []], bf: [0, 0], form: [0, 0], formNeed: [0, 0], eff: [1, 1], mom: [0, 0], scoreless: [0, 0], runs: [0, 0], entLead: [0, 0], wuRoll: [0, 0],
    leadTeam: -1, pitWin: '', pitLose: '',
    started: false, over: false, pregame: 0,
    tags: {}, xouts: 0, pxouts: 0, pxpit: '',
    lead: ['', ''], careful: false, pitchout: false, ppSig: '', ppLast: '', manThrows: 0,
    phSlot: [0, 0], phTold: [false, false],
    infield: 'No', ofDepth: 'Normal', pitchAround: false, injuriesOff: false,
    weather: null,
    boxBat: [], boxPit: [], log: [], pa: [], longHR: null,
    pend: null, misses: 0,
    dice: null, loc: null, rollTxt: '', playTxt: '', extra: '',
    ball: null, xshow: null, leadSig: '', rollLeads: true, title: '',
  };
}

// ---- lookups ----
const bRowOf = id => (id in IX.bat) ? D.batters[IX.bat[id]] : (id in IX.pit) ? D.batters[IX.bat['zzPIT']] : D.batters[IX.bat['zzBAT']];
const isBat = id => id in IX.bat;
const isPit = id => id in IX.pit;
const pRowOf = id => isPit(id) ? D.pitchers[IX.pit[id]] : null;
function lastName(id) { if (!id) return '?'; if (isBat(id)) return D.batters[IX.bat[id]][B.LAST]; if (isPit(id)) return D.pitchers[IX.pit[id]][P.LAST]; return id; }
function fullName(id) { if (isBat(id)) return D.batters[IX.bat[id]][B.NAME]; if (isPit(id)) return D.pitchers[IX.pit[id]][P.NAME]; return id || ''; }
function throws_(pid) { const r = pRowOf(pid); return r && r[P.THROWS] === 'L' ? 'L' : 'R'; }
function batsOf(bid) { return bRowOf(bid)[B.BATS] || 'R'; }
function batSide(bid, pth) { let b = batsOf(bid); if (b === 'B' || b === 'S') b = pth === 'L' ? 'R' : 'L'; return b === 'L' ? 'L' : 'R'; }
function handTag(b) { b = String(b || '').toUpperCase(); if (b === 'B') b = 'S'; return b || 'R'; }
function hasFld(id, pos) { return (id + '|' + pos) in IX.fld; }
function fieldVal(id, pos, col, dflt) { const k = id + '|' + pos; if (!(k in IX.fld)) return dflt; const v = D.fielding[IX.fld[k]][col]; return (v === null || v === '' || isNaN(parseFloat(v))) ? dflt : parseFloat(v); }
const speedF = id => clamp(num(bRowOf(id)[B.ADV]), 0.7, 1.35);
function runSpd(id) { if (!id) return 10; const v = num(bRowOf(id)[B.RUN]); return v > 0 ? v : 10; }
function miscV(k, dflt) { return (k in IX.misc) ? num(IX.misc[k]) : dflt; }
const miscB = miscV;
const seasonYr = () => miscV('season', 1977);
function teamRow(code) { return (code in IX.team) ? D.teams[IX.team[code]] : null; }
function teamFull(code) { const r = teamRow(code); return r ? r[T.NAME] : code; }
function teamLeague(code) { const r = teamRow(code); return r ? r[T.LG] : 'NL'; }
function teamColor(code, which) { const r = teamRow(code); const h = r ? String(r[which === 1 ? T.C1 : T.C2] || '') : ''; return /^[0-9A-Fa-f]{6}$/.test(h) ? '#' + h : (which === 1 ? '#1f3864' : '#7f7f7f'); }
function teamCity(code) { const r = teamRow(code); return r ? (r[T.CITY] || r[T.NAME]) : code; }
const dhYear = (lg, y) => (lg === 'AL' && y >= 1973) || y === 2020 || y >= 2022;
function tabP(key, outs, f) { outs = clamp(outs, 0, 2); if (f < 7) f = 8; const k = key + '|' + outs + '|' + f; if (k in IX.tab) { const r = D.tables[IX.tab[k]]; return [num(r[3]), num(r[4])]; } return [0.5, 0.02]; }
function posNum(ps) { const i = POSN.indexOf(String(ps || '').toUpperCase()); return i < 0 ? 0 : i; }
const posName = n => POSN[n] || '';
function dayText(d) { const dt = new Date(seasonYr(), 0, d); return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); }
function backRow(key) { return (key in IX.back) ? D.backs[IX.back[key]] : null; }
const backV = (r, j) => r ? num(r[j]) : 0;
function buntGrade(b) { const g = String(bRowOf(b)[B.BUNT] || '').toUpperCase().trim(); return g || 'C'; }
function hnrGrade(b) { const g = String(bRowOf(b)[B.HNR] || '').toUpperCase().trim(); return g || 'C'; }

// ---- lineup helpers (side 0 = away, 1 = home) ----
const batSideTeam = () => G.half;
const fieldSideTeam = () => 1 - G.half;
const teamCode = side => G.teams[side];
const curPitcherID = side => G.pitcher[side] || '';
function slotPos(side, slot) { const s = G.lineup[side][slot - 1]; return s ? String(s.pos || '').toUpperCase() : ''; }
function slotID(side, slot) { const s = G.lineup[side][slot - 1]; if (!s) return ''; if (String(s.pos).toUpperCase() === 'P') return curPitcherID(side); return s.id || ''; }
function defID(side, pos) { if (pos === 1) return curPitcherID(side); for (let s = 1; s <= 9; s++) if (posNum(slotPos(side, s)) === pos) return slotID(side, s); return ''; }
function armF(side, f) { return clamp(1 + 0.5 * (fieldVal(defID(side, f), f, F.ARM, 1) - 1), 0.8, 1.25); }
function rosterBatters(team) { return D.batters.filter(r => r[B.TEAM] === team && num(r[B.PA]) > 0 && (!isPit(r[B.ID]) || num(r[B.PA]) >= 100)); }
function rosterPitchers(team) { return D.pitchers.filter(r => r[P.TEAM] === team); }
function staffOf(team) { return S.staff[team] || { rot: [], closer: '', pen: [] }; }

// ---- availability / injuries ----
function injuriesOn() { return G.dayNo > 0 && opt('Injuries') === 'Real' && !G.injuriesOff; }
function availRow(id, team) { const k = id + '|' + team; return (k in IX.avail) ? D.avail[IX.avail[k]] : null; }
function isAvail(id, team) {
  if (!id || id === 'PITCHER' || !injuriesOn()) return true;
  const r = availRow(id, team); if (!r) return false;
  const d = G.dayNo; if (d < num(r[2]) || d > num(r[3])) return false;
  if (!r[4]) return true;
  for (const sp of String(r[4]).split(';')) { const p = sp.split('-'); if (p.length === 2 && d >= num(p[0]) && d <= num(p[1])) return false; }
  return true;
}
function outUntil(id, team) {
  const r = availRow(id, team); if (!r) return 'not with ' + team + ' this season';
  const d = G.dayNo;
  if (d < num(r[2])) return 'joins ' + team + ' ' + dayText(num(r[2]));
  if (d > num(r[3])) return 'no longer with ' + team;
  for (const sp of String(r[4] || '').split(';')) { const p = sp.split('-'); if (p.length === 2 && d >= num(p[0]) && d <= num(p[1])) return 'out through ' + dayText(num(p[1])); }
  return '';
}
function availShort(id, team) {
  const t = outUntil(id, team);
  if (t.startsWith('joins ')) return 'joins ' + t.slice(('joins ' + team + ' ').length);
  if (t.startsWith('no longer')) return 'gone';
  if (t.startsWith('out through ')) return 'out to ' + t.slice(12);
  if (t.startsWith('not with')) return 'not on team';
  return 'out';
}
function bestSub(team, ps, ids) {
  const f = posNum(ps); let best = '', bestPA = -1;
  for (const r of D.batters) {
    if (r[B.TEAM] !== team) continue; const id = r[B.ID];
    if (ids.includes(id) || isPit(id) || !isAvail(id, team)) continue;
    if (f === 0 || hasFld(id, f)) { if (num(r[B.PA]) > bestPA) { bestPA = num(r[B.PA]); best = id; } }
  }
  if (!best && f > 0) best = bestSub(team, 'DH', ids);
  return best;
}

// ---- parks and weather ----
function parkName() { if (G.sched >= 0) { const p = D.schedule[G.sched][SC.PARK]; if (p) return p; } const r = teamRow(G.teams[1]); return r ? r[T.PARK] : ''; }
function isDome(park) { return /Astrodome|Kingdome|Metrodome|Tropicana/.test(park); }
const FENCES = [
  ['Fenway', [315, 390, 302]], ['Wrigley', [355, 400, 353]], ['Astrodome', [340, 406, 340]], ['Shea', [341, 410, 341]], ['Tiger', [340, 440, 325]],
  ['Comiskey', [352, 440, 352]], ['Memorial', [309, 405, 309]], ['County Stadium', [320, 402, 315]], ['Metropolitan', [343, 402, 330]], ['Busch', [330, 414, 330]],
  ['Jarry', [340, 420, 340]], ['San Diego', [330, 420, 330]], ['Cleveland', [320, 410, 320]], ['Royals', [330, 410, 330]], ['Veterans', [330, 408, 330]],
  ['Riverfront', [330, 404, 330]], ['Three Rivers', [335, 400, 335]], ['Kingdome', [316, 405, 316]], ['Exhibition', [330, 400, 330]], ['Olympic', [325, 404, 325]],
  ['Arlington', [330, 400, 330]], ['Candlestick', [335, 400, 335]], ['Atlanta', [330, 402, 330]], ['Dodger', [330, 395, 330]], ['Anaheim', [333, 404, 333]],
  ['Oakland', [330, 400, 330]], ['Yankee', [312, 417, 310]],
];
function fenceDist(f) { const park = parkName(); let a = [330, 405, 330]; for (const [k, v] of FENCES) if (park.includes(k)) a = v; if (f < 7 || f > 9) f = 8; return a[f - 7]; }
function rollWeather() {
  G.weather = null; if (opt('Weather') === 'Off') return;
  const mon = G.dayNo > 0 ? new Date(seasonYr(), 0, G.dayNo).getMonth() + 1 : 7;
  const temp = [0, 40, 42, 48, 56, 66, 76, 83, 82, 72, 60, 50, 42][mon] + Math.floor(rand() * 15) - 7;
  if (isDome(parkName())) { G.weather = { dir: 'Dome', mph: 0, temp: 72 }; return; }
  const r = rand(); let dir;
  if (r < 0.31) dir = 'Calm'; else if (r < 0.43) dir = 'Out to left'; else if (r < 0.55) dir = 'Out to center'; else if (r < 0.67) dir = 'Out to right'; else if (r < 0.85) dir = 'In'; else dir = 'Across';
  const mph = dir === 'Calm' ? Math.floor(rand() * 4) : 5 + Math.floor(rand() * 16);
  G.weather = { dir, mph, temp };
}
function windText() {
  const w = G.weather; if (!w) return '';
  if (w.dir === 'Dome') return 'Indoors, 72°';
  if (w.dir === 'Calm') return 'Calm, ' + w.temp + '°';
  if (w.dir === 'In') return 'Wind blowing in ' + w.mph + ' mph, ' + w.temp + '°';
  if (w.dir === 'Across') return 'Crosswind ' + w.mph + ' mph, ' + w.temp + '°';
  return 'Wind blowing ' + w.dir.toLowerCase() + ' ' + w.mph + ' mph, ' + w.temp + '°';
}
function windEffect(f) {
  const w = G.weather; if (!w) return 0; const k = w.mph / 20 * 0.1;
  switch (w.dir) {
    case 'In': return -k;
    case 'Out to left': return f === 7 ? k : f === 8 ? k / 2 : 0;
    case 'Out to center': return f === 8 ? k : k / 2;
    case 'Out to right': return f === 9 ? k : f === 8 ? k / 2 : 0;
  }
  return 0;
}

// ---- cards ----
function roundN(w, total) {
  const n = w.length, wi = new Array(n), rm = new Array(n); let sm = 0;
  for (let i = 0; i < n; i++) { if (w[i] < 0) w[i] = 0; sm += w[i]; }
  if (sm <= 0) sm = 1; let s = 0;
  for (let i = 0; i < n; i++) { wi[i] = Math.floor(w[i] / sm * total); rm[i] = w[i] / sm * total - wi[i]; s += wi[i]; }
  while (s < total) { let best = 0, bv = -1; for (let i = 0; i < n; i++) if (rm[i] > bv) { bv = rm[i]; best = i; } wi[best]++; rm[best] = -1; s++; }
  return wi;
}
function split14(w10) {
  // 10 card events -> 14 display rows (index 1..14), doubles and singles split three ways
  const w = new Array(16).fill(0);
  w[1] = w10[0]; w[2] = w10[1];
  const w2 = w10[2]; w[3] = Math.round(w2 * SPLIT_A); w[5] = Math.round(w2 * SPLIT_C); w[4] = w2 - w[3] - w[5];
  const w1 = w10[3]; w[6] = Math.round(w1 * SPLIT_A); w[8] = Math.round(w1 * SPLIT_C); w[7] = w1 - w[6] - w[8];
  w[9] = w10[4]; w[10] = w10[5]; w[11] = w10[6]; w[12] = w10[7]; w[13] = w10[8]; w[14] = w10[9];
  return w;
}
let gWallParts = [0, 0, 0, 0];
function wallCarve(w) {
  // About 10% of homers, triples, doubles plus 3% of fly outs move into row 15; the wall chart pays back the mix.
  w[15] = 0; gWallParts = [0, 0, 0, 0];
  if (opt('At the wall') === 'Off') return w;
  const t = new Array(16).fill(0);
  t[1] = Math.round(w[1] * 0.1); t[2] = Math.round(w[2] * 0.1); t[3] = Math.round(w[3] * 0.1); t[4] = Math.round(w[4] * 0.1); t[5] = Math.round(w[5] * 0.1); t[12] = Math.round(w[12] * 0.03);
  for (let i = 1; i <= 14; i++) { w[i] -= t[i]; w[15] += t[i]; }
  gWallParts = [t[1], t[3] + t[4] + t[5], t[2], t[12]];
  return w;
}
let gNoPark = false;
function parkAdj(w) {
  if (gNoPark || opt('Park effects') === 'Off') return;
  const r = teamRow(G.teams[1]); if (!r) return;
  let tot = 0, tot2 = 0; for (let i = 0; i < 10; i++) tot += w[i];
  for (let i = 0; i < 10; i++) { let f = num(r[T.PF0 + i]); if (f <= 0) f = 1; w[i] *= clamp(f, 0.5, 2); tot2 += w[i]; }
  if (tot2 > 0) for (let i = 0; i < 10; i++) w[i] *= tot / tot2;
}
function batterCard(bid, pth) {
  const r = bRowOf(bid), w = new Array(10); let prevL = 0, prevR = 0;
  const blend = opt('Splits') === 'Blended';
  for (let i = 0; i < 10; i++) {
    const eL = num(r[B.L0 + i]), eR = num(r[B.R0 + i]);
    w[i] = blend ? ((eL - prevL) + (eR - prevR)) / 2 : (pth === 'L' ? eL - prevL : eR - prevR);
    prevL = eL; prevR = eR;
  }
  parkAdj(w);
  return wallCarve(split14(roundN(w, 500)));
}
function pitcherCard(pid, bside, form) {
  const r = pRowOf(pid), w = new Array(10), x = new Array(9); const blend = opt('Splits') === 'Blended';
  let prevL = 500, prevR = 500;
  for (let i = 0; i < 10; i++) {
    if (r) { const eL = num(r[P.L0 + i]), eR = num(r[P.R0 + i]); w[i] = blend ? ((eL - prevL) + (eR - prevR)) / 2 : (bside === 'L' ? eL - prevL : eR - prevR); prevL = eL; prevR = eR; }
    else w[i] = PIT_NONX / 10;
  }
  for (let i = 0; i < 9; i++) {
    if (r) { const eL = num(r[P.XL0 + i]), eR = num(r[P.XR0 + i]); x[i] = blend ? ((eL - prevL) + (eR - prevR)) / 2 : (bside === 'L' ? eL - prevL : eR - prevR); prevL = eL; prevR = eR; }
    else x[i] = PIT_X / 9;
  }
  if (r) {
    const mv = HIT_TRIM * (w[1] + w[2] + w[3]); const b = w[6] + w[7] + w[8] + w[9];
    if (b > 0) { for (let i = 1; i <= 3; i++) w[i] *= (1 - HIT_TRIM); for (let i = 6; i <= 9; i++) w[i] *= (b + mv) / b; }
  }
  parkAdj(w);
  const g = w[0] + w[1] + w[2] + w[3] + w[4]; let b = 0; for (let i = 5; i < 10; i++) b += w[i];
  if (form !== 0 && g > 0 && b > 0) {
    let mv = Math.abs(form) * g; if (mv > b * 0.8) mv = b * 0.8;
    for (let i = 0; i < 10; i++) {
      if (i <= 4) w[i] *= form > 0 ? (g - mv) / g : (g + mv) / g;
      else w[i] *= form > 0 ? (b + mv) / b : (b - mv) / b;
    }
  }
  return { w: wallCarve(split14(roundN(w, PIT_NONX))), x: roundN(x, PIT_X) };
}

// ---- fielding checks ----
function rangeR(id, f) {
  if (!id) return 5;
  if (hasFld(id, f)) return clamp(Math.round(fieldVal(id, f, F.RNGR, 3)), 1, 5);
  return f === 1 ? 3 : 5;
}
function xChart(f, id) {
  const rg = rangeR(id, f), stp = miscV('x_step', 0.15), xr = D.xchart[IX.x[f]];
  const h1 = num(xr[3]), h2 = num(xr[4]) + num(xr[5]);
  const p1 = h1 * (1 + stp * (rg - 3)), p2 = h2 * (1 + stp * (rg - 3));
  const e = num(xr[2]); let lge = miscV('lgerr_' + f, 0.02); if (lge <= 0) lge = 0.02;
  const myE = hasFld(id, f) ? fieldVal(id, f, F.ERR, lge) : lge * 1.5;
  const perr = clamp(e * myE / lge, 0, 0.6);
  let pout = 1 - perr - p1 - p2; if (pout < 0.05) pout = 0.05;
  return { pout, perr, p1, p2, rg };
}
function xRows(f, fid) {
  const c = xChart(f, fid); const a = Math.floor(c.pout * 1000), b = a + Math.floor(c.perr * 1000); let cc = b + Math.floor(c.p1 * 1000); if (cc > 1000) cc = 1000;
  return [{ label: 'Out', lo: 1, hi: a, c: 'r' }, { label: 'Error', lo: a + 1, hi: b, c: 'g' }, { label: 'Single', lo: b + 1, hi: cc, c: 'g' }, { label: 'Double', lo: cc + 1, hi: 1000, c: 'g' }];
}
function xText(f, id) {
  const c = xChart(f, id); const a = Math.floor(c.pout * 1000), b = a + Math.floor(c.perr * 1000); let cc = b + Math.floor(c.p1 * 1000); if (cc > 1000) cc = 1000;
  return posName(f) + ' check, ' + lastName(id) + ' range ' + c.rg + ': out 1-' + a + ' · error ' + (a + 1) + '-' + b + ' · single ' + (b + 1) + '-' + cc + (cc < 1000 ? ' · double ' + (cc + 1) + '-1000' : '');
}
function eFac(id, pos) {
  let lge = miscV('lgerr_' + pos, 0.02); if (lge <= 0) lge = 0.02;
  if (hasFld(id, pos)) return clamp(fieldVal(id, pos, F.ERR, lge) / lge, 0.3, 3);
  return pos === 1 ? 1 : 1.5;
}
function errScale() { const e = miscV('errscale', 1); return e <= 0 ? 1 : e; }

// ---- earned-run tags (rule 9.16) ----
function tagGet(id) { return id && G.tags[id] ? G.tags[id] : null; }
function tagPut(id, v) { if (!id) return; if (v) G.tags[id] = v; else delete G.tags[id]; }
function tagAided(id) { const tg = tagGet(id); const pid = tg ? tg.pit : (gPitID || curPitcherID(fieldSideTeam())); tagPut(id, { pit: pid, un: 1 }); }
function tagRunners() {
  const pid = gPitID || curPitcherID(fieldSideTeam()); const out = {};
  for (let i = 0; i < 3; i++) { const id = G.bases[i]; if (id) { const tg = tagGet(id) || { pit: pid, un: (id === gBatID && gBatErr) ? 1 : 0 }; out[id] = tg; } }
  G.tags = out;
}
function errOut() { G.xouts++; G.pxouts++; }

// ---- box score ----
const BAT_COLS = ['AB', 'R', 'H', '2B', '3B', 'HR', 'RBI', 'BB', 'K', 'SB', 'CS', 'SF', 'SH', 'GIDP', 'E', 'HBP', 'IBB'];
const PIT_COLS = ['OUTS', 'H', 'R', 'BB', 'K', 'HR', 'BF', 'W', 'L', 'SV', 'GS', 'ER', 'CG', 'SHO', 'GF', 'HBP', 'IBB', 'WP', 'BK'];
function boxBatRow(id, side) {
  let r = G.boxBat.find(x => x.id === id);
  if (!r) { r = { id, name: fullName(id), team: teamCode(side), slot: 0, pos: '' }; BAT_COLS.forEach(c => r[c] = 0); G.boxBat.push(r); }
  return r;
}
function boxPitRow(pid, side) {
  let r = G.boxPit.find(x => x.id === pid);
  if (!r) { r = { id: pid, name: fullName(pid), team: teamCode(side), dec: '' }; PIT_COLS.forEach(c => r[c] = 0); G.boxPit.push(r); }
  return r;
}
const boxBatFind = id => G.boxBat.find(x => x.id === id) || null;
const boxPitFind = id => G.boxPit.find(x => x.id === id) || null;
function addBatSide(id, col, n, side) { if (!id || !n) return; boxBatRow(id, side)[col] += n; }
function addBat(id, col, n) { addBatSide(id, col, n, batSideTeam()); }
function addPit(col, n) { if (!n) return; const pid = gPitID || curPitcherID(fieldSideTeam()); if (!pid) return; boxPitRow(pid, fieldSideTeam())[col] += n; }
function addPitID(pid, col, n) { if (!pid || !n) return; boxPitRow(pid, fieldSideTeam())[col] += n; }
function recordOut(n) { G.outs += n; addPit('OUTS', n); G.xouts += n; G.pxouts += n; }
function addHit() { G.hits[batSideTeam()]++; }
function addErr() { G.errs[fieldSideTeam()]++; }
function chargeE(f) { const fid = f === 1 ? gPitID : defID(fieldSideTeam(), f); addErr(); addBatSide(fid, 'E', 1, fieldSideTeam()); sfx('error', 0, { home: batSideTeam() === 1 }); }

// ---- engine globals for the play in progress ----
let gBatID = '', gPitID = '', gBatErr = false, gHitRun = false, gHRPlay = false, gMainRoll = 0, gExtra = '', gLogPrefix = '', gPlateNote = '', gUnNote = 0;
let gLoc = 0, gLocForced = false, gLocForceV = 0, gDepthDone = false, gJustOver = false, gPaceTxt = '', gPopKind = '';
let gPopCap = false, gPopOut = '';

// ---- scoring ----
function scoreRun(runner, rbiBatter) {
  const side = batSideTeam();
  if (G.half === 1 && side === 1 && G.inn >= 9 && G.score[1] > G.score[0] && !gHRPlay) {
    gPlateNote += (gPlateNote ? ' ' : '') + '(' + lastName(runner) + "'s run doesn't count: the game ended when the winning run scored.)";
    return;
  }
  const fs = 1 - side;
  if (G.mom[fs] === 1) {
    G.mom[fs] = 0; addLog(lastName(curPitcherID(fs)) + "'s groove is over.");
    if (popOn() && popOpt('Momentum')) UI.popInfo('GROOVE OVER', fullName(curPitcherID(fs)) + ' gave up a run. The +2% groove is over.');
  }
  const before = G.score[0] > G.score[1] ? 0 : G.score[1] > G.score[0] ? 1 : -1;
  G.score[side]++;
  const after = G.score[0] > G.score[1] ? 0 : G.score[1] > G.score[0] ? 1 : -1;
  while (G.innRuns[side].length < G.inn) G.innRuns[side].push(0);
  G.innRuns[side][G.inn - 1]++;
  addBat(runner, 'R', 1);
  if (runner !== gBatID) for (let i = G.pa.length - 1; i >= 0; i--) if (G.pa[i].id === runner) { if (!G.pa[i].scored) G.pa[i].scored = true; break; }
  const tg = tagGet(runner); let rp, un;
  if (!tg) { rp = gPitID || curPitcherID(fs); un = (runner === gBatID && gBatErr); } else { rp = tg.pit; un = tg.un === 1; }
  addPitID(rp, 'R', 1);
  let earned = !un;
  if (earned) { if (rp && rp === G.pxpit) { if (G.pxouts >= 3) earned = false; } else if (G.xouts >= 3) earned = false; }
  if (earned) addPitID(rp, 'ER', 1); else gUnNote++;
  if (!gHRPlay) sfx('score', 0.25, { home: side === 1, big: G.inn >= 7 });
  tagPut(runner, null);
  if (rbiBatter) addBat(rbiBatter, 'RBI', 1);
  G.runs[fs]++;
  if (after !== before) {
    if (after === -1) G.leadTeam = -1;
    else if (after === side) { G.leadTeam = side; G.pitWin = curPitcherID(side); G.pitLose = rp; }
  }
}
function runnersScore(rbiBatter) { for (let i = 2; i >= 0; i--) if (G.bases[i]) { scoreRun(G.bases[i], rbiBatter); G.bases[i] = ''; } }
function advanceAll(scoreUnearned) {
  if (G.bases[2]) { if (scoreUnearned) tagAided(G.bases[2]); scoreRun(G.bases[2], ''); }
  G.bases[2] = G.bases[1]; G.bases[1] = G.bases[0]; G.bases[0] = '';
}
function runnersText() { const t = []; for (let i = 2; i >= 0; i--) if (G.bases[i]) t.push(lastName(G.bases[i])); return t.join(' and '); }
const anyOn = () => !!(G.bases[0] || G.bases[1] || G.bases[2]);

// ---- log ----
function addLog(txt) {
  if (gPopCap && !gPopOut && !txt.startsWith('---')) gPopOut = txt;
  if (gLogPrefix && !txt.startsWith('---')) { txt = gLogPrefix + txt; gLogPrefix = ''; }
  if (gPlateNote && !txt.startsWith('---')) { txt += ' ' + gPlateNote; gPlateNote = ''; }
  if (gUnNote > 0) { txt += gUnNote === 1 ? ' (unearned run)' : ' (' + gUnNote + ' unearned runs)'; gUnNote = 0; }
  const inn = (G.half === 0 ? 'Top ' : 'Bot ') + G.inn;
  G.log.push({ inn, team: friendlyCode(teamCode(G.half)), txt });
  if (!txt.startsWith('---') && !txt.startsWith('Now pitching')) G.playTxt = txt;
  if (gPopCap && gPopOut === txt && UI.popResult) UI.popResult(txt);
}
function addLogNote(t) { gPlateNote += (gPlateNote ? ' ' : '') + t; }

// ---- pitcher form, rest, availability ----
function formFromRoll(rr) { for (let i = 0; i <= 20; i++) if (rr <= WU_HI[i]) return i - 10; return 10; }
const rollForm = () => formFromRoll(rnd1000()) / 100;
function wuRows() { const t = []; let lo = 1; for (let i = 0; i <= 20; i++) { const v = i - 10; t.push({ label: (v > 0 ? '+' : '') + v + '%', lo, hi: WU_HI[i], c: v < 0 ? 'r' : v === 0 ? 'y' : 'g' }); lo = WU_HI[i] + 1; } return t; }
function formName(f) {
  const p = Math.round(f * 100); let n = p >= 8 ? 'Locked in' : p >= 3 ? 'Sharp' : p >= -2 ? 'Normal' : p >= -7 ? 'Off' : 'Struggling';
  return n + ' ' + (p > 0 ? '+' : '') + p + '%';
}
function wuResult(rr, pid) {
  const b = formFromRoll(rr); const ri = restInfo(pid); let s = 'Roll ' + rr + ':  ' + formName(b / 100);
  if (ri.pen !== 0) { const tot = b + Math.round(ri.pen * 100); s += '   ·   tired ' + Math.round(ri.pen * 100) + '%   =   ' + (tot > 0 ? '+' : '') + tot + '% this game'; } else s += ' this game';
  return s;
}
function pitRec(pid) { const r = pRowOf(pid); return r ? clamp(num(r[P.IPO]) * 1.42 / 175 * 1.1, 2.5, 14) : 2.5; }
function tiredCut() { const v = opt('Tired pitcher cutoff'); return v.startsWith('Lenient') ? 0.5 : v.startsWith('Strict') ? 0.7 : 0.6; }
function pitEff(pid) {
  // {eff, days, lastOuts}: 100% = fully rested; every day of rest he still needs costs 15%
  const res = { eff: 1, days: -1, lastOuts: 0 };
  if (!pid || opt('Pitcher rest days') === 'Off' || G.dayNo <= 0) return res;
  const r = S.pitRest[pid]; if (!r) return res;
  res.days = G.dayNo - r.lastDay; res.lastOuts = r.lastOuts;
  const rec = pitRec(pid); let t = r.tired - rec * res.days; if (t < 0) t = 0;
  res.eff = clamp(1 - 0.15 * t / rec, 0.2, 1);
  return res;
}
const pitEffSimple = pid => pitEff(pid).eff;
function restWords(days) { return days < 0 ? "hasn't pitched yet" : days === 0 ? 'pitched earlier today' : days === 1 ? 'pitched yesterday' : (days - 1) + " days' rest"; }
function restInfo(pid) {
  const e = pitEff(pid); const out = { txt: '', pen: 0, canGo: true };
  if (e.days < 0) return out;
  if (e.eff < 0.995) { out.pen = -(1 - e.eff) * 0.4; out.txt = restWords(e.days) + ' · ' + Math.round(e.eff * 100) + '% ready'; }
  out.canGo = e.eff >= tiredCut() - 0.0001;
  return out;
}
const restPen = pid => restInfo(pid).pen;
const canPitch = (pid, team) => isAvail(pid, team) && pitEffSimple(pid) >= tiredCut() - 0.0001;
function effNow(side) { const e = G.eff[side]; return e <= 0 ? 1 : e; }
function totalForm(side) {
  let f = G.form[side]; const bf = G.bf[side]; const pid = curPitcherID(side); const r = pRowOf(pid);
  let stam = r ? num(r[P.STAM]) : 25; stam *= effNow(side); if (stam < 4) stam = 4;
  if (r) f -= miscV('tto', 0) * (bf - num(r[P.STAM]) / 2);
  if (bf > stam + 3) f -= 0.015 * (bf - stam - 3);
  if (opt('Momentum') === 'On') { f -= miscV('momadj', 0.002); if (G.mom[side] === 1) f += 0.02; else if (G.mom[side] === -1) f -= 0.03; }
  return clamp(f, -0.25, 0.12);
}
function updateRest() {
  const d = G.dayNo; if (d <= 0) return;
  for (const bp of G.boxPit) {
    const r = S.pitRest[bp.id] || (S.pitRest[bp.id] = { lastDay: 0, lastBF: 0, streak: 0, tired: 0, lastOuts: 0 });
    const prev = r.lastDay;
    if (prev === d) { r.tired += bp.BF; r.lastOuts += bp.OUTS; }
    else {
      let t = r.tired; if (prev > 0) t -= pitRec(bp.id) * (d - prev); if (t < 0) t = 0;
      r.tired = t + bp.BF; r.lastOuts = bp.OUTS; r.streak = prev === d - 1 ? r.streak + 1 : 1; r.lastDay = d; r.lastBF = bp.BF;
    }
  }
}
function pickStarter(side, team, noteArr) {
  const st = staffOf(team); let best = '', bestE = -1; const rot = st.rot; const n = rot.length;
  if (n) {
    const k = G.exhib ? 0 : (S.teams[team] ? S.teams[team].next : 0);
    for (let j = 0; j < n; j++) {
      const pid = rot[(k + j) % n];
      if (isAvail(pid, team)) { const e = pitEffSimple(pid); if (e >= 0.9) return pid; if (e > bestE) { bestE = e; best = pid; } }
      if (j === 0 && noteArr) noteArr.push(lastName(pid) + ' (' + team + ') ' + (isAvail(pid, team) ? 'needs rest' : 'is out'));
    }
    if (best && bestE >= tiredCut() - 0.0001) return best;
  }
  for (const r of rosterPitchers(team)) { const pid = r[P.ID]; if (isAvail(pid, team)) { const e = pitEffSimple(pid); if (e > bestE) { bestE = e; best = pid; } } }
  if (!best && n) best = rot[(S.teams[team] ? S.teams[team].next : 0) % n];
  return best;
}
function isCloser(side, pid) { return staffOf(teamCode(side)).closer === pid; }
function nextReliever(side, wantCloser) {
  const used = G.used[side]; const st = staffOf(teamCode(side)); const cl = st.closer; const team = teamCode(side);
  if (wantCloser && cl && !used.includes(cl) && canPitch(cl, team)) return cl;
  for (const p of st.pen) if (p && p !== cl && !used.includes(p) && canPitch(p, team)) return p;
  if (cl && !used.includes(cl) && canPitch(cl, team)) return cl;
  for (const r of rosterPitchers(team)) { const p = r[P.ID]; if (!used.includes(p) && canPitch(p, team)) return p; }
  return '';
}
function pickRole(side, pid) { const st = staffOf(teamCode(side)); return st.rot.includes(pid) ? 'SP' : st.closer === pid ? 'CL' : st.pen.includes(pid) ? 'RP' : ''; }

// ---- season stat lookups (replay numbers include the game in progress) ----
function replayBat(id, col) { let v = S.seasonBat[id] ? num(S.seasonBat[id][col]) : 0; const r = boxBatFind(id); if (r && !G.over && col !== 'G') v += num(r[col]); return v; }
function replayPit(id, col) { let v = S.seasonPit[id] ? num(S.seasonPit[id][col]) : 0; const r = boxPitFind(id); if (r && !G.over && col !== 'G') v += num(r[col]); return v; }
function opsTxt(h, bb, hbp, ab, sf, tb) { if (ab <= 0) return '-'; const x = (h + bb + hbp) / (ab + bb + hbp + sf) + tb / ab; return x >= 1 ? x.toFixed(3) : fmt3(x); }

// ---- the scorebook: one entry per plate appearance, in scorecard notation ----
const POSWORD = { pitcher: 1, catcher: 2, first: 3, second: 4, third: 5, short: 6, left: 7, center: 8, right: 9 };
function paPos(txt) {
  const m = txt.match(/\((P|C|1B|2B|3B|SS|LF|CF|RF)\)/); if (m) return posNum(m[1]);
  const w = txt.match(/(?:to|at|in) (?:shallow |deep |the warning track in |the )?(pitcher|catcher|first|second|third|short|left|center|right)/); return w ? POSWORD[w[1]] : 0;
}
function paCode(txt) {
  const f = paPos(txt); const fs = f || '';
  if (/HOMERS/.test(txt)) return 'HR';
  if (/triples/.test(txt)) return '3B';
  if (/doubles|ground-rule double/.test(txt)) return '2B';
  if (/singles|Infield hit|bunts for a hit|drags a bunt|beats it out|sneaks through|gets past the drawn-in|Through the hole|Up the middle/.test(txt)) return '1B';
  if (/walked intentionally/.test(txt)) return 'IBB';
  if (/ walks/.test(txt)) return 'BB';
  if (/hit by the pitch/.test(txt)) return 'HBP';
  if (/strikes out looking/.test(txt)) return 'ꓘ';
  if (/strikes out/.test(txt)) return 'K';
  if (/Error on the bunt|throws it away|can't handle it|bobbles/.test(txt)) return 'E' + fs;
  if (/DOUBLE PLAY/.test(txt)) return (f === 6 || f === 5 || f === 1 ? fs + '-4-3' : f === 4 || f === 3 ? fs + '-6-3' : fs + '-6-3') + ' DP';
  if (/lays down a sacrifice/.test(txt)) return 'SAC';
  if (/pops the bunt/.test(txt)) return 'P' + (f || 2);
  if (/tags and scores/.test(txt) && /flies out/.test(txt)) return 'SF' + fs;
  if (/Force out at second|lead runner is forced|fielder's choice/.test(txt)) return 'FC' + (f ? ' ' + f + (f === 3 || f === 4 ? '-6' : '-4') : '');
  if (/grounds|slow roller|Bang-bang.*OUT|he's thrown out at first/.test(txt)) return f === 3 ? '3U' : f ? f + '-3' : 'GO';
  if (/flies out/.test(txt)) return 'F' + fs;
  if (/lines out/.test(txt)) return 'L' + fs;
  if (/pops up in foul/.test(txt)) return 'P2';
  if (/pops? (out|up|a sky-high)|little pop-up/.test(txt)) return 'P' + (f || 2);
  if (/picked off|PICKED OFF/.test(txt)) return 'PO';
  return 'OUT';
}
function recordPA(side, slot, bid, logStart, outs0, rbi0, r0) {
  if (!bid) return;
  const lines = G.log.slice(logStart).map(l => l.txt).filter(t => !t.startsWith('---') && !t.startsWith('Now pitching'));
  const ln = lastName(bid); let main = lines.find(t => t.includes(ln + ' ') || t.includes(ln + "'")) || lines[lines.length - 1] || '';
  // a steal or pickoff logged before the pitch is the runner's line, not the batter's
  const own = lines.filter(t => /singles|doubles|triples|HOMERS|walks|hit by the pitch|strikes out|grounds|slow roller|flies out|lines out|pops|bunt|Infield hit|Error|Bang-bang|walked intentionally|gets past|sneaks through|Through the hole|Up the middle|ground-rule/.test(t));
  if (own.length) main = own[own.length - 1];
  const b = boxBatFind(bid); const rbi = b ? b.RBI - rbi0 : 0; const scored = !!(b && r0 != null && b.R > r0);
  G.pa.push({ s: side, slot, inn: G.inn, id: bid, code: paCode(main), rbi, scored, sb: 0, outs: G.outs - outs0, txt: main });
}
function noteSB(id) { for (let i = G.pa.length - 1; i >= 0; i--) if (G.pa[i].id === id) { G.pa[i].sb = (G.pa[i].sb || 0) + 1; return; } }
function updateRecords() {
  const R = S.records; const g = G.gameNo, label = G.sched >= 0 ? D.schedule[G.sched][SC.DATE] + ' ' + teamCode(0) + ' at ' + teamCode(1) : teamCode(0) + ' at ' + teamCode(1);
  const beat = (k, v, who, extra) => { if (v > 0 && (!R[k] || v > R[k].v)) R[k] = { v, who, game: g, label, extra: extra || '' }; };
  for (const b of G.boxBat) { beat('hits', b.H, b.name + ' (' + friendlyCode(b.team) + ')'); beat('rbi', b.RBI, b.name + ' (' + friendlyCode(b.team) + ')'); beat('hr', b.HR, b.name + ' (' + friendlyCode(b.team) + ')'); beat('sb', b.SB, b.name + ' (' + friendlyCode(b.team) + ')'); }
  for (const p of G.boxPit) { beat('k', p.K, p.name + ' (' + friendlyCode(p.team) + ')'); if (p.CG && p.H === 0) { R.nohit = R.nohit || []; R.nohit.push({ who: p.name + ' (' + friendlyCode(p.team) + ')', game: g, label, walks: p.BB + p.HBP }); } }
  if (G.longHR) beat('longhr', G.longHR.ft, lastName(G.longHR.id) + ' (' + friendlyCode(teamCode(G.longHR.side)) + ')', G.longHR.ft + ' ft');
  const mg = Math.abs(G.score[0] - G.score[1]); beat('blowout', mg, (G.score[0] > G.score[1] ? teamCode(0) : teamCode(1)) + ' by ' + mg, G.score[0] + '-' + G.score[1]);
  beat('runs', Math.max(G.score[0], G.score[1]), G.score[0] >= G.score[1] ? teamCode(0) : teamCode(1), G.score[0] + '-' + G.score[1]);
  beat('innings', G.inn > 9 ? G.inn : 0, teamCode(0) + ' at ' + teamCode(1), G.score[0] + '-' + G.score[1]);
  beat('hitsteam', Math.max(G.hits[0], G.hits[1]), G.hits[0] >= G.hits[1] ? teamCode(0) : teamCode(1));
  R.games = (R.games || 0) + 1; if (G.score[0] === 0 || G.score[1] === 0) R.shutouts = (R.shutouts || 0) + 1; if (G.walkoff) R.walkoffs = (R.walkoffs || 0) + 1; if (G.inn > 9) R.extras = (R.extras || 0) + 1;
}

// ---- persistence ----
const SAVE_KEY = 'BF5_1977_save';
function saveAll(push) {
  if (push !== false) S.savedAt = Date.now();
  if (push !== false && typeof Net !== 'undefined') Net.pushSave();
  try { localStorage.setItem(SAVE_KEY, JSON.stringify({ v: 1, O, S, G })); }
  catch (e) {
    // out of room: drop the oldest archived box scores and logs, then try once more
    try {
      const ak = Object.keys(S.archive).map(Number).sort((a, b) => a - b); while (ak.length > 40) delete S.archive[ak.shift()];
      const lk = Object.keys(S.logAll).map(Number).sort((a, b) => a - b); while (lk.length > 20) delete S.logAll[lk.shift()];
      localStorage.setItem(SAVE_KEY, JSON.stringify({ v: 1, O, S, G }));
    } catch (e2) { console.warn('save failed', e2); if (typeof UI !== 'undefined' && UI.toast) UI.toast('Warning: the browser could not save the game (storage full). Export your save from Options.'); }
  }
}
function loadAll() {
  O = optDefaults();
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      const o = JSON.parse(raw);
      if (o.O) Object.assign(O, o.O);
      if (o.S) { S = Object.assign(newSeason(), o.S); if (!S.logAll) S.logAll = {}; if (!S.records) S.records = {}; if (!S.notes) S.notes = {}; }
      if (o.G) { G = Object.assign(newGame(), o.G); }
    }
  } catch (e) { console.warn('load failed', e); }
  if (!S) S = newSeason();
  if (!G) G = newGame();
}
function exportJSON() { return JSON.stringify({ v: 1, O, S, G }); }
function importJSON(txt) {
  const o = JSON.parse(txt); if (!o || !o.S) throw new Error('Not a Ball Five save file.');
  O = Object.assign(optDefaults(), o.O || {}); S = Object.assign(newSeason(), o.S); G = Object.assign(newGame(), o.G || {}); saveAll();
}
