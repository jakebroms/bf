/* play.js: the at-bat engine (async: pop-ups await a click) */
'use strict';

// ---- who the crowd is rooting for ----
const offHome = () => batSideTeam() === 1, defHome = () => fieldSideTeam() === 1;
const flash = (txt, cls) => { if (!gSim && UI.flash) UI.flash(txt, cls); };

// ---- rolls ----
let gSoloLoc = null;
async function getRoll(label, preview) {
  if (solo()) { const v = await UI.soloRoll(label, preview); if (v >= 1 && v <= 1000) return v; }
  return rnd1000();
}
let gMainRollTxt = '';
// an extra roll (double play try, fielding check, steal, send/hold, at the wall) takes over the big dice and the roll line
function extraShow(label, v) { G.dice = v; G.rollTxt = label + ' · rolled ' + v + (gMainRollTxt ? '  (' + gMainRollTxt + ')' : ''); }
function extraRoll(label) { const v = rnd1000(); gExtra += label + ': ' + v + '   '; extraShow(label, v); return v; }
function chance(p, label) { if (p <= 0) return false; const ok = rand() < p; if (ok) gExtra += label + '   '; return ok; }
function showDice(v, txt) { G.dice = v; G.loc = null; G.rollTxt = txt; gMainRollTxt = txt; UI.showDice(v, txt); }
async function popRoll(title, sub, rows, lbl) {
  const kind = gPopKind; gPopKind = '';
  if (!popOn() || (kind && !popOpt(kind))) return extraRoll(lbl);
  UI.refresh();
  const rr = await UI.popRoll(title, sub, rows, lbl);
  gExtra += lbl + ': ' + rr + '   '; extraShow(lbl, rr);
  gPopCap = true; gPopOut = '';
  return rr;
}
async function popDecide(question) {
  if (gSim) return true;
  UI.refresh();
  return await UI.decide(question);
}
function popReveal(title, sub, rows, rr) { if (!popOn()) return; UI.popReveal(title, sub, rows, rr); gPopCap = true; gPopOut = ''; }
function popInfo(title, txt) { if (popOn() && popOpt('Error pop-ups')) UI.popInfo(title, txt); }

// ---- location dice 0-99 ----
function locRoll() {
  let v;
  if (gLocForced) { v = gLocForceV; gLocForced = false; }
  else if (gSoloLoc != null) { v = gSoloLoc; gSoloLoc = null; }
  else if (G.pend && G.pend.loc != null) { v = G.pend.loc; G.pend.loc = null; }
  else v = Math.floor(rand() * 100);
  v = clamp(v, 0, 99); gLoc = v; G.loc = v;
  if (G.rollTxt && !G.rollTxt.includes('Loc ')) G.rollTxt += ' · Loc ' + String(v).padStart(2, '0');
  return v;
}
function digitPick(id, c0, n, d) { const r = bRowOf(id); for (let i = 1; i <= n; i++) if (d <= num(r[c0 + i - 1])) return i; return n; }
function lastDie(roll) { const d = roll % 10; return d === 0 ? 10 : d; }
function pickOutFielder(ev, b, d) {
  let f;
  if (ev === EV.GB) f = digitPick(b, B.GB0, 6, d);
  else {
    f = digitPick(b, B.AIR0, 9, d);
    if (ev === EV.LD && f <= 2) f = 6;
    if (ev === EV.FB && f <= 2) f = 2;
    if (ev === EV.FB && f >= 3 && f <= 6 && rand() < 0.32) f = 6 + digitPick(b, B.HIT0, 3, Math.floor(rand() * 10) + 1);
    if (ev === EV.PU && f === 7) f = 6;
    if (ev === EV.PU && f === 8) f = 4 + 2 * Math.floor(rand() * 2);
    if (ev === EV.PU && f === 9) f = 4;
  }
  return f;
}
function preLoc(k, xf, roll) {
  // an out in play (or a fielding check): pick the fielder and roll the location now so both show before the click
  const pend = G.pend; pend.loc = null; if (xf === 0) pend.of = 0;
  if (xf === 0 && (k < 11 || k > 14)) return;
  const b = gBatID, d = lastDie(roll); let f = xf;
  if (xf === 0) { f = pickOutFielder(ROW_EV[k], b, d); pend.of = f; }
  const v = locRoll(); let wd = '';
  switch (k) {
    case 11: wd = ['right at him', 'near him', 'a few steps over', 'deep in the hole', 'slow roller'][gbZone(v)] + ' (' + posName(f) + ')'; break;
    case 12: wd = f >= 7 ? ['shallow', 'medium depth', 'deep', 'warning track'][fbZone(v, b)] + ' (' + posName(f) + '), about ' + flyFeet(f, v) + ' ft' : (v < 20 ? 'little pop-up' : v >= 80 ? 'sky-high' : 'routine pop') + ' (' + posName(f) + ')'; break;
    case 13: wd = ['right at him', 'a step away', v >= 93 ? 'leaping catch' : 'diving catch'][ldZone(v)] + ' (' + posName(f) + ')'; break;
    case 14: wd = (v < 20 ? 'little pop-up' : v >= 80 ? 'sky-high' : 'routine pop') + ' (' + posName(f) + ')'; break;
  }
  pend.loc = v;
  if (wd) G.rollTxt += ': ' + wd;
  if (f > 0 && !findMode()) UI.placeBall(f, 0);
}
function zoneAdj(p, m, w, z) {
  if (m[z] <= 0) return 0; p = clamp(p, 0.0001, 0.9999); let lo = -8, hi = 8;
  for (let it = 0; it < 40; it++) {
    const md = (lo + hi) / 2, k = Math.exp(md); let avg = 0;
    for (let i = 0; i < m.length; i++) if (m[i] > 0) avg += w[i] * oddsAdj(p, k * m[i]);
    if (avg < p) lo = md; else hi = md;
  }
  return oddsAdj(p, Math.exp((lo + hi) / 2) * m[z]);
}
const gbZone = loc => loc < 20 ? 0 : loc < 50 ? 1 : loc < 80 ? 2 : loc < 92 ? 3 : 4;
function fbShift(bid) { const r = bRowOf(bid); let h = 0.0185; if (num(r[B.PA]) > 0) h = num(r[B.HR]) / num(r[B.PA]); return clamp(Math.round((h - 0.0185) / 0.0185 * 7), -8, 15); }
function fbZone(loc, bid) { const s = fbShift(bid); return loc < 30 - s ? 0 : loc < 75 - s ? 1 : loc < 92 - s ? 2 : 3; }
const ldZone = loc => loc < 40 ? 0 : loc < 85 ? 1 : 2;
const GBM = [2.2, 1.3, 0.6, 0.25, 0], GBW = [0.2, 0.3, 0.3, 0.12, 0.08];

// ---- manager settings ----
const infieldIn = () => G.infield === 'Infield in';
const cornersIn = () => G.infield === 'Corners in' && G.outs < 2;
const ofDepth = () => G.ofDepth;

// ---- runner tries ----
async function tryBase(pGo, pout, desc, sub, goWord) {
  // 1 = makes it, -1 = thrown out, 0 = holds
  let pTry = pGo + pout; if (pTry <= 0) return 0;
  if (pTry > 1) { pout /= pTry; pGo /= pTry; pTry = 1; }
  const safe = pGo / pTry; let safeTop = clamp(Math.floor(safe * 1000), 1, 999);
  if (gSim || !prompts() || pTry >= 0.95 || pTry < 0.03) {
    const rr = extraRoll(desc + ' (' + goWord.toLowerCase() + ' 1-' + Math.floor(pGo * 1000) + ', out ' + (Math.floor(pGo * 1000) + 1) + '-' + Math.floor(pTry * 1000) + ')');
    return rr <= pGo * 1000 ? 1 : rr <= pTry * 1000 ? -1 : 0;
  }
  const rr = extraRoll(desc + ': an opening? (1-' + Math.floor(pTry * 1000) + ')');
  if (rr > pTry * 1000) return 0;
  const go = await popDecide({ title: desc.toUpperCase() + '!', sub, safeTop, pct: Math.round(safe * 100) });
  if (go) {
    gPopKind = 'Runner pop-ups';
    const r2 = await popRoll('RUNNER: ' + desc.toUpperCase(), 'You sent him · ' + sub, [{ label: 'Safe', lo: 1, hi: safeTop, c: 'g' }, { label: 'Out', lo: safeTop + 1, hi: 1000, c: 'r' }], desc + ' (safe 1-' + safeTop + ')');
    return r2 <= safeTop ? 1 : -1;
  }
  addLogNote('(' + desc + ': the manager holds him.)');
  return 0;
}
function runnerSub(f, runner, arm) { const fid = defID(fieldSideTeam(), f); const a = fieldVal(fid, f, F.ARMR, 0); return lastName(runner) + ' speed ' + runSpd(runner) + ' of 20 · ' + lastName(fid) + ' (' + posName(f) + ') arm ' + (a > 0 ? '+' : '') + a; }
async function platePlay(code, runner) {
  if (!flavor('Plays at the plate') || !chance(0.3, 'Close play at the plate')) return code;
  const cat = defID(fieldSideTeam(), 2); let t;
  if (code === -1) {
    if (chance(0.05 * eFac(cat, 2), 'Catcher drops the ball')) { chargeE(2); tagAided(runner); t = lastName(runner) + ' barrels into ' + lastName(cat) + ' and the ball pops loose! Safe (error on the catcher).'; code = 1; }
    else if (chance(0.06, 'Blown call at the plate')) { t = 'Bang-bang at the plate... SAFE! (Replays say ' + lastName(cat) + ' had him.)'; code = 1; }
    else t = lastName(runner) + ' barrels into ' + lastName(cat) + ', who holds on!';
  } else {
    if (chance(0.06, 'Blown call at the plate')) { t = 'Bang-bang at the plate... OUT! (Replays say ' + lastName(runner) + ' got in.)'; code = -1; }
    else t = lastName(runner) + " slides in just under " + lastName(cat) + "'s tag!";
  }
  addLogNote(t);
  if (popOn() && popOpt('Plays at the plate')) UI.popInfo('PLAY AT THE PLATE', t);
  return code;
}
async function runChoice(key, f, runner, arm, boost, desc) {
  let [pa, pX] = tabP(key, G.outs, f);
  const ceff = G.outs === 2 ? 0 : SPLIT_C, den = 1 - SPLIT_A - ceff;
  pa = clamp((pa - SPLIT_A) / den, 0, 0.98); pX = clamp(pX / den, 0, 0.3);
  if (pa > 0) pa = oddsAdj(pa, speedF(runner) / arm * boost);
  if (pa + pX > 1) pX = 1 - pa;
  if (pa + pX <= 0) return 0;
  let v = await tryBase(pa, pX, desc, runnerSub(f, runner, arm), 'Makes it');
  if ((key === 'S_r2' || key === 'D_r1') && v !== 0) v = await platePlay(v, runner);
  return v;
}
const gbRun = (pGo, pout, desc, goWord) => tryBase(pGo, pout, desc, 'Going on the ground ball', goWord);
async function flyTag(pAdv, pout, desc) { let v = await tryBase(pAdv, pout, desc, 'Tagging up on the fly', 'Scores'); if (v !== 0) v = await platePlay(v, G.bases[2]); return v; }

// ---- misplays ----
function hitMisplay(f, hadOn) {
  if (G.outs >= 3) return '';
  const fid = defID(fieldSideTeam(), f);
  if (!chance((hadOn ? ERR_HIT_ON : ERR_HIT_EMPTY) * errScale() * eFac(fid, f), 'Misplay on the hit')) return '';
  chargeE(f); tagRunners(); advanceAll(true);
  popInfo('ERROR!', lastName(fid) + ' (' + posName(f) + ') bobbles it, and everybody takes an extra base.');
  return ' Error by ' + lastName(fid) + ' (' + posName(f) + '), everybody moves up a base!';
}
function outMisplay(f) {
  if (G.outs >= 3 || !anyOn()) return '';
  const fid = f === 1 ? gPitID : defID(fieldSideTeam(), f);
  if (!chance(ERR_OUT_ON * errScale() * eFac(fid, f), 'Misplay on the out')) return '';
  chargeE(f); tagRunners(); advanceAll(true);
  popInfo('ERROR!', lastName(fid) + ' (' + posName(f) + ') throws it away after the out. The runners move up.');
  return ' Error by ' + lastName(fid) + ' (' + posName(f) + ') on the play, the runners move up.';
}

// ---- hits and events ----
function hbpShare(b) {
  const lg = miscV('hbp_lg', 0.054); let sB = num(bRowOf(b)[B.HBPSH]); if (sB <= 0) sB = lg;
  const pr = pRowOf(gPitID); let sp = pr ? num(pr[P.HBPSH]) : lg; if (sp <= 0) sp = lg;
  return clamp(sB + sp - lg, 0.005, 0.4);
}
function hrDist(f, roll, b) {
  const r = bRowOf(b); let hrr = 0; if (num(r[B.PA]) > 0) hrr = num(r[B.HR]) / num(r[B.PA]);
  const pw = clamp(4 + 160 * hrr, 4, 14); let d;
  if (gJustOver) d = fenceDist(f) + lastDie(roll); else d = fenceDist(f) + Math.floor(lastDie(roll) * pw) + Math.floor(windEffect(f) * 60);
  gJustOver = false; return d;
}
function resolveSingleInfield() {
  const b = gBatID, bs = G.bases;
  addBat(b, 'AB', 1); addBat(b, 'H', 1); addPit('H', 1); addHit();
  if (bs[0]) { if (bs[1]) { if (bs[2]) scoreRun(bs[2], b); bs[2] = bs[1]; } bs[1] = bs[0]; }
  bs[0] = b;
}
async function resolveEvent(ev, sB, roll, forceF) {
  const b = gBatID, bs = G.bases, hadOn = anyOn(), d = lastDie(roll);
  let f = forceF > 0 ? forceF : 6 + digitPick(b, B.HIT0, 3, d);
  let txt = '', res, arm, who;
  if (!gDepthDone && forceF === 0) {
    if (G.careful && (ev === EV.HR || ev === EV.B3 || ev === EV.B2) && chance(0.25, 'Careful pitching: he just misses it')) {
      gLogPrefix = 'Careful pitching, he just misses it: '; gDepthDone = true; await resolveOut(EV.FB, roll, d, f); gDepthDone = false; return;
    }
    if (ofDepth() === 'Deep' && (ev === EV.B2 || ev === EV.B3) && chance(0.15, 'The deep outfield cuts it off')) {
      gLogPrefix = 'The deep outfield cuts it off: '; gDepthDone = true; await resolveEvent(EV.B1, '2', roll, f); gDepthDone = false; return;
    }
    if (ofDepth() === 'Shallow' && ev === EV.B1 && chance(0.06, 'The shallow outfield runs it down')) {
      gLogPrefix = 'The shallow outfield runs it down: '; gDepthDone = true; await resolveOut(EV.LD, roll, d, f); gDepthDone = false; return;
    }
  }
  switch (ev) {
    case EV.K: {
      if (gHitRun && hadOn) {
        const gr = hnrGrade(b); const r = gr === 'A' ? 500 : gr === 'B' ? 350 : gr === 'D' ? 50 : 200;
        if (chance(r / 1000, 'Puts it in play on the hit and run')) { gLogPrefix = 'He gets the bat on it on the hit and run: '; await resolveOut(EV.GB, roll, d, 4); return; }
      }
      recordOut(1); addBat(b, 'AB', 1); addBat(b, 'K', 1); addPit('K', 1);
      addLog(lastName(b) + (roll % 2 === 1 || gHitRun ? ' strikes out swinging.' : ' strikes out looking.')); sfx('strikeout', 0, { home: defHome() }); flash('STRIKEOUT', 'red');
      if (gHitRun && G.outs < 3) {
        if (bs[0] && !bs[1]) await stealAttempt(1, true);
        else if (bs[1] && !bs[2]) {
          who = bs[0]; await stealAttempt(2, true);
          if (who && bs[0] === who && !bs[1] && G.outs < 3) { bs[1] = who; bs[0] = ''; addLog(lastName(who) + ' takes second on the double steal.'); }
        }
      }
      break;
    }
    case EV.BB: {
      const isHBP = ((roll * 37) % 1000) < hbpShare(b) * 1000;
      if (isHBP) { addBat(b, 'HBP', 1); addPit('HBP', 1); } else { addBat(b, 'BB', 1); addPit('BB', 1); }
      if (bs[0]) { if (bs[1]) { if (bs[2]) scoreRun(bs[2], b); bs[2] = bs[1]; } bs[1] = bs[0]; }
      bs[0] = b;
      addLog(lastName(b) + (isHBP ? ' is hit by the pitch.' : ' walks.')); sfx(isHBP ? 'hbp' : 'walk', 0, { home: offHome() });
      break;
    }
    case EV.HR: {
      addBat(b, 'AB', 1); addBat(b, 'H', 1); addBat(b, 'HR', 1); addPit('H', 1); addPit('HR', 1); addHit();
      const ft = hrDist(f, roll, b); if (!G.longHR || ft > G.longHR.ft) G.longHR = { ft, id: b, side: batSideTeam() };
      txt = lastName(b) + ' HOMERS to ' + FIELDNAME[f] + '! (' + ft + ' ft)';
      if (hadOn) { const rt = runnersText(); txt += ' ' + rt + (rt.includes(' and ') ? ' score.' : ' scores.'); }
      sfx('homer', 0, { home: offHome(), big: G.inn >= 7 || gJustOver }); flash('HOME RUN!', 'gold'); gHRPlay = true; runnersScore(b); scoreRun(b, b); gHRPlay = false;
      addLog(txt); UI.placeBall(f, 4, ft);
      break;
    }
    case EV.B3: {
      addBat(b, 'AB', 1); addBat(b, 'H', 1); addBat(b, '3B', 1); addPit('H', 1); addHit();
      sfx('triple', 0, { home: offHome() }); flash('TRIPLE!', 'green'); txt = lastName(b) + ' triples to ' + FIELDNAME[f] + '.';
      if (hadOn) { const rt = runnersText(); txt += ' ' + rt + (rt.includes(' and ') ? ' score.' : ' scores.'); }
      runnersScore(b); bs[2] = b; addLog(txt); UI.placeBall(f, 3);
      break;
    }
    case EV.B2: {
      addBat(b, 'AB', 1); addBat(b, 'H', 1); addBat(b, '2B', 1); addPit('H', 1); addHit();
      arm = armF(fieldSideTeam(), f);
      sfx('double', 0, { home: offHome() }); flash('DOUBLE', 'green'); txt = lastName(b) + ' doubles to ' + FIELDNAME[f] + '.';
      if (bs[2]) { txt += ' ' + lastName(bs[2]) + ' scores.'; scoreRun(bs[2], b); }
      if (bs[1]) { txt += ' ' + lastName(bs[1]) + ' scores.'; scoreRun(bs[1], b); }
      const nb = ['', b, ''];
      if (bs[0]) {
        who = bs[0];
        if (sB === '3') res = 1; else if (sB === '2') res = 0; else res = await runChoice('D_r1', f, who, arm, gHitRun ? 1.6 : 1, lastName(who) + ' heading home from first');
        if (res === 1) { txt += ' ' + lastName(who) + ' scores from first!'; scoreRun(who, b); }
        else if (res === -1) { recordOut(1); txt += ' ' + lastName(who) + ' is thrown out at the plate!'; }
        else { nb[2] = who; txt += ' ' + lastName(who) + ' stops at third.'; }
      }
      bs[0] = nb[0]; bs[1] = nb[1]; bs[2] = nb[2];
      txt += hitMisplay(f, hadOn); addLog(txt); UI.placeBall(f, 2);
      break;
    }
    case EV.B1: {
      addBat(b, 'AB', 1); addBat(b, 'H', 1); addPit('H', 1); addHit();
      arm = armF(fieldSideTeam(), f);
      if (sB === '1' && (G.outs === 2 || gHitRun)) sB = 'C';
      sfx('hit', 0, { home: offHome() }); flash('BASE HIT', 'green'); txt = lastName(b) + ' singles to ' + FIELDNAME[f] + '.';
      const nb = [b, '', '']; let held3 = false;
      if (bs[2]) { txt += ' ' + lastName(bs[2]) + ' scores.'; scoreRun(bs[2], b); }
      if (bs[1]) {
        who = bs[1];
        if (sB === '2') res = 1; else if (sB === '1') res = 0; else res = await runChoice('S_r2', f, who, arm, gHitRun ? 1.8 : 1, lastName(who) + ' rounding third, heading home');
        if (res === 1) { txt += ' ' + lastName(who) + ' scores from second.'; scoreRun(who, b); }
        else if (res === -1) { recordOut(1); txt += ' ' + lastName(who) + ' is thrown out at the plate!'; }
        else { nb[2] = who; held3 = true; txt += ' ' + lastName(who) + ' stops at third.'; }
      }
      if (bs[0]) {
        who = bs[0];
        if (held3 || G.outs >= 3) nb[1] = who;
        else if (sB === '2') { nb[2] = who; txt += ' ' + lastName(who) + ' goes first to third.'; }
        else if (sB === '1') nb[1] = who;
        else {
          res = await runChoice('S_r1', f, who, arm, gHitRun ? 2.5 : 1, lastName(who) + ' going first to third');
          if (res === 1) { nb[2] = who; txt += ' ' + lastName(who) + ' goes first to third.'; }
          else if (res === -1) { recordOut(1); txt += ' ' + lastName(who) + ' is thrown out at third!'; }
          else nb[1] = who;
        }
      }
      bs[0] = nb[0]; bs[1] = nb[1]; bs[2] = nb[2];
      txt += hitMisplay(f, hadOn); addLog(txt); UI.placeBall(f, 1);
      break;
    }
    case EV.WALL: await resolveWall(roll); break;
    default: await resolveOut(ev, roll, d, forceF);
  }
}

// ---- at the wall ----
function wallSetup(roll) {
  const pth = throws_(gPitID);
  if (roll <= 500) batterCard(gBatID, pth); else pitcherCard(gPitID, batSide(gBatID, pth), totalForm(fieldSideTeam()));
  const f = 6 + digitPick(gBatID, B.HIT0, 3, lastDie(roll));
  return { f, fid: defID(fieldSideTeam(), f) };
}
function wallChart(f, fid) {
  let [hH, dd, tT, oO] = gWallParts; let tot = hH + dd + tT + oO;
  if (tot <= 0) { hH = 3; dd = 3; tT = 1; oO = 4; }
  const rg = rangeR(fid, f); let s = 0.04 * (3 - rg);
  if (s > 0) { oO += s * (hH + dd + tT); hH *= 1 - s; dd *= 1 - s; tT *= 1 - s; }
  else if (s < 0 && hH + dd > 0) { hH -= s * oO * hH / (hH + dd); dd -= s * oO * dd / (hH + dd); oO *= 1 + s; }
  s = windEffect(f);
  if (s > 0) { hH += s * oO; oO *= 1 - s; } else if (s < 0) { oO -= s * hH; hH *= 1 + s; }
  const park = parkName(), dome = isDome(park), monster = park.includes('Fenway') && f === 7;
  const rows = [
    ['Just over the wall', 'H', hH * (dome ? 0.7 : 0.5) + (f === 8 ? hH * 0.2 : 0)],
    [park === 'Wrigley Field' ? 'Wind off the lake carries it out' : 'Wind carries it out', 'H', dome ? 0 : hH * 0.3],
    ['Off the foul pole', 'H', f === 8 ? 0 : hH * 0.2],
    [monster ? 'Off the Green Monster' : 'Off the wall', 'D', dd * 0.7],
    ['Ground-rule double', 'G', dd * 0.3],
    ['Off the wall, past him', 'T', tT],
    ['Robbed at the wall', 'O', monster ? 0 : oO * 0.3],
    ['Caught on the warning track', 'O', oO * (monster ? 0.8 : 0.5)],
    ['Crashes into the wall, holds on', 'O', oO * 0.2],
  ];
  const wi = roundN(rows.map(r => r[2]), 1000); let acc = 0;
  return rows.map((r, i) => { const lo = acc + 1, hi = acc + wi[i]; acc = hi; return { label: r[0], kind: r[1], lo, hi, c: r[1] === 'O' ? 'r' : 'g' }; }).filter(r => r.hi >= r.lo);
}
function wallSpec(roll) {
  const { f, fid } = wallSetup(roll);
  return { title: 'AT THE WALL', sub: lastName(gBatID) + ' drives it to ' + FIELDNAME[f] + ' · ' + lastName(fid) + ' (range ' + rangeR(fid, f) + ') goes back', rows: wallChart(f, fid) };
}
async function resolveWall(roll) {
  const { f, fid } = wallSetup(roll); const rows = wallChart(f, fid);
  const rr = extraRoll('At the wall');
  const k = rows.find(r => rr >= r.lo && rr <= r.hi) || rows[rows.length - 1];
  if (k.kind === 'D' || k.kind === 'T' || k.kind === 'G') sfx('wall', 0, { home: offHome() });
  popReveal('AT THE WALL', lastName(gBatID) + ' drives it to ' + FIELDNAME[f] + ' · ' + lastName(fid) + ' (range ' + rangeR(fid, f) + ') goes back', rows, rr);
  gLogPrefix = 'At the wall: ' + k.label.charAt(0).toLowerCase() + k.label.slice(1) + '! ';
  switch (k.kind) {
    case 'H': gJustOver = true; await resolveEvent(EV.HR, '', roll, f); break;
    case 'D': await resolveEvent(EV.B2, 'C', roll, f); break;
    case 'T': await resolveEvent(EV.B3, '', roll, f); break;
    case 'G': groundRuleDouble(f); break;
    default:
      gLocForced = true; gLocForceV = 92 - fbShift(gBatID); if (gLocForceV > 99) gLocForceV = 99;
      gLocForceV += Math.floor(rand() * (100 - gLocForceV));
      await resolveOut(EV.FB, roll, lastDie(roll), f);
  }
}
function groundRuleDouble(f) {
  const b = gBatID, bs = G.bases;
  addBat(b, 'AB', 1); addBat(b, 'H', 1); addBat(b, '2B', 1); addPit('H', 1); addHit();
  let txt = lastName(b) + ' gets a ground-rule double to ' + FIELDNAME[f] + '.';
  if (bs[2]) { txt += ' ' + lastName(bs[2]) + ' scores.'; scoreRun(bs[2], b); }
  if (bs[1]) { txt += ' ' + lastName(bs[1]) + ' scores.'; scoreRun(bs[1], b); }
  bs[2] = bs[0]; bs[1] = b; bs[0] = '';
  if (bs[2]) txt += ' ' + lastName(bs[2]) + ' stops at third.';
  addLog(txt); UI.placeBall(f, 2);
}

// ---- outs in play ----
async function resolveOut(ev, roll, d, forceF) {
  const b = gBatID, bs = G.bases, fside = fieldSideTeam();
  let f, txt = '', rr, res, p2, pout, tg = 0, who;
  if (forceF === 0 && G.pend && G.pend.of > 0) { f = G.pend.of; G.pend.of = 0; }
  else if (forceF > 0) f = forceF;
  else f = pickOutFielder(ev, b, d);
  const fid = f === 1 ? gPitID : defID(fside, f);
  if (!gDepthDone && forceF === 0 && f >= 7) {
    if (ofDepth() === 'Deep' && (ev === EV.LD || ev === EV.PU || ev === EV.FB) && chance(0.04, 'Drops in front of the deep outfield')) {
      gLogPrefix = 'It drops in front of the deep outfield: '; gDepthDone = true; await resolveEvent(EV.B1, '1', roll, f); gDepthDone = false; return;
    }
    if (ofDepth() === 'Shallow' && ev === EV.FB && chance(0.03, "Over the shallow outfielder's head")) {
      gLogPrefix = 'Over his head! '; gDepthDone = true; await resolveEvent(EV.B2, 'C', roll, f); gDepthDone = false; return;
    }
  }
  let ifin = infieldIn() && bs[2] && G.outs < 2;
  if (ev === EV.GB && cornersIn() && (f === 3 || f === 5)) {
    if (chance(0.06, 'Corners in: past him?')) { addLog('Grounder gets past the drawn-in ' + (f === 3 ? 'first' : 'third') + ' baseman!'); await resolveEvent(EV.B1, '1', roll, f === 5 ? 7 : 9); return; }
    if (bs[2]) ifin = true;
  }
  if (ev === EV.GB && ifin && !cornersIn() && chance(0.1, 'Infield in: through?')) {
    addLog('Grounder sneaks through the drawn-in infield!'); await resolveEvent(EV.B1, '1', roll, f <= 5 ? 7 : 8); return;
  }
  if (ev === EV.GB && f >= 3 && f <= 6 && flavor('Close plays at first') && chance(0.04, 'Bang-bang at first')) {
    gPopKind = 'Close plays at first';
    rr = await popRoll('BANG-BANG AT FIRST', lastName(b) + ' races ' + lastName(fid) + "'s throw (" + posName(f) + ")... the umpire's call:", [{ label: 'Safe (blown call)', lo: 1, hi: 100, c: 'g' }, { label: 'Out', lo: 101, hi: 1000, c: 'r' }], "Umpire's call (safe 1-100)");
    if (rr <= 100) {
      txt = 'Bang-bang play at first... SAFE! ' + lastName(b) + ' beats it out (replays would disagree).';
      if (flavor('Manager arguments')) {
        gPopKind = 'Manager arguments';
        const r2 = await popRoll('MANAGER ARGUES', 'The ' + teamCode(fside) + ' manager storms out to argue the call at first.', [{ label: 'Ejected', lo: 1, hi: 250, c: 'r' }, { label: 'Says his piece and goes back', lo: 251, hi: 1000, c: 'y' }], 'Manager argues (ejected 1-250)');
        txt += r2 <= 250 ? ' The ' + teamCode(fside) + ' manager storms out and gets ejected!' : ' The ' + teamCode(fside) + ' manager comes out to argue.';
      }
      addLog(txt); resolveSingleInfield(); UI.placeBall(f, 0); return;
    }
    addLog('Bang-bang play at first... OUT! Great throw by ' + lastName(fid) + '.');
  }
  const loc = locRoll(); let z = 0;
  if (ev === EV.GB) {
    z = gbZone(loc);
    if (z === 3 && bs[0] && forceF === 0) {
      tg = 0; if (!bs[1] && (f === 3 || f === 4)) tg = 1; if (tg === 0 && G.outs < 2 && (f === 4 || f === 6)) tg = 2;
      if (tg > 0 && chance(0.1, 'Through the hole?')) {
        gLogPrefix = tg === 1 ? 'Through the hole with the first baseman holding the runner! ' : 'Up the middle, past the middle infield at double-play depth! ';
        gDepthDone = true; await resolveEvent(EV.B1, '1', roll, tg === 1 ? 9 : 8); gDepthDone = false; return;
      }
    }
  }
  addBat(b, 'AB', 1);
  UI.placeBall(f, 0); sfx(ev === EV.GB ? 'groundout' : (ev === EV.FB && f >= 7) ? 'flyout' : 'out', 0, { home: defHome() });
  if (ev === EV.GB) {
    const fidTxt = f === 1 ? 'the pitcher' : lastName(fid) + ' (' + posName(f) + ')';
    switch (z) {
      case 0: txt = lastName(b) + ' grounds right at ' + fidTxt + '.'; break;
      case 2: txt = lastName(b) + ' grounds to ' + FIELDNAME[f] + ' (' + lastName(fid) + ')' + (f >= 3 ? ', a few steps over.' : '.'); break;
      case 3: txt = lastName(b) + ' grounds to ' + FIELDNAME[f] + ' (' + lastName(fid) + ')' + (f >= 3 ? ', deep in the hole.' : '.'); break;
      case 4: txt = lastName(b) + ' hits a slow roller to ' + FIELDNAME[f] + ' (' + lastName(fid) + ').'; break;
      default: txt = lastName(b) + ' grounds to ' + FIELDNAME[f] + ' (' + lastName(fid) + ').';
    }
    if (bs[0] && G.outs < 2 && !gHitRun) {
      let dp = 0.967 * miscV('gdp_' + f, 0.39) * num(bRowOf(b)[B.GDP]);
      const piv = (f === 5 || f === 6) ? 4 : 6; const pivId = defID(fside, piv);
      if (flavor('The pivot')) dp *= clamp(1 + 0.08 * (3 - rangeR(pivId, piv)), 0.85, 1.15);
      dp = zoneAdj(clamp(dp, 0, 0.97), GBM, GBW, z);
      if (dp > 0 && flavor('The pivot')) {
        gPopKind = 'The pivot';
        rr = await popRoll('DOUBLE PLAY TRY', lastName(fid) + ' (' + posName(f) + ') to ' + lastName(pivId) + ' covering second (range ' + rangeR(pivId, piv) + ')... can they turn two?', [{ label: 'Double play', lo: 1, hi: Math.floor(dp * 1000), c: 'r' }, { label: 'No double play', lo: Math.floor(dp * 1000) + 1, hi: 1000, c: 'g' }], 'Double play (1-' + Math.floor(dp * 1000) + ')');
      } else if (dp > 0) rr = extraRoll('Double play (1-' + Math.floor(dp * 1000) + ')'); else rr = 1000;
      if (rr <= dp * 1000) {
        recordOut(2); addBat(b, 'GIDP', 1); txt += ' DOUBLE PLAY!'; sfx('dp', 0, { home: defHome() }); flash('DOUBLE PLAY!', 'red');
        if (G.outs < 3) { if (bs[2]) { txt += ' ' + lastName(bs[2]) + ' scores.'; scoreRun(bs[2], ''); } bs[2] = bs[1]; bs[1] = ''; bs[0] = ''; }
        addLog(txt); return;
      }
      if (z === 4) p2 = 0;
      else { p2 = [0, 0.52, 0.5, 0.51, 0.55, 0.63, 0.76, 0.6, 0.6, 0.6][f]; p2 = p2 / (p2 + (1 - p2) / 0.85); p2 = zoneAdj(p2, [1.8, 1.3, 0.8, 0.45, 0], GBW, z); p2 = oddsAdj(p2, Math.exp(-0.02 * (runSpd(bs[0]) - 10))); }
      rr = p2 > 0 ? extraRoll('Force at second (1-' + Math.floor(p2 * 1000) + ')') : 1000;
      if (rr <= p2 * 1000) {
        const fp = tagGet(bs[0]);
        recordOut(1); txt += ' Force out at second, ' + lastName(b) + ' safe at first.';
        if (G.outs < 3) {
          if (bs[2] && bs[1]) { txt += ' ' + lastName(bs[2]) + ' scores.'; scoreRun(bs[2], b); bs[2] = bs[1]; bs[1] = ''; }
          else if (bs[2]) { if (extraRoll('Runner on third scores (1-450)') <= 450) { txt += ' ' + lastName(bs[2]) + ' scores.'; scoreRun(bs[2], b); bs[2] = ''; } }
          else if (bs[1]) { bs[2] = bs[1]; bs[1] = ''; }
          bs[0] = b;
          if (fp) tagPut(b, { pit: fp.pit, un: 0 });
          txt += outMisplay((f === 5 || f === 6) ? 4 : 6);
        } else { bs[0] = ''; bs[1] = ''; bs[2] = ''; }
        addLog(txt); return;
      }
      recordOut(1); txt += ' Out at first, runners move up.';
      if (G.outs < 3) {
        if (bs[2]) {
          if (bs[1]) { txt += ' ' + lastName(bs[2]) + ' scores.'; scoreRun(bs[2], b); bs[2] = ''; }
          else { const p3 = miscV('gb_r3_score', 0.43); if (extraRoll('Runner on third scores (1-' + Math.floor(p3 * 1000) + ')') <= p3 * 1000) { txt += ' ' + lastName(bs[2]) + ' scores.'; scoreRun(bs[2], b); bs[2] = ''; } }
        }
        if (!bs[2]) { bs[2] = bs[1]; bs[1] = ''; }
        if (!bs[1]) { bs[1] = bs[0]; bs[0] = ''; }
        txt += outMisplay(f);
      }
      addLog(txt); return;
    }
    recordOut(1);
    if (G.outs < 3) {
      const o3 = bs[2]; let hrMv = false; who = bs[0];
      if (bs[0] && gHitRun) {
        hrMv = true;
        if (bs[1] && !bs[2]) { bs[2] = bs[1]; bs[1] = ''; }
        if (!bs[1]) { bs[1] = bs[0]; bs[0] = ''; txt += ' The runner moves up on the hit and run.'; }
        if (bs[1] === who && !bs[2] && G.outs < 2) {
          p2 = 0.01 + (loc >= 80 ? 0.05 : 0) + ((f === 3 || f === 4) ? 0.03 : 0) + clamp(0.01 * (runSpd(who) - 12), 0, 0.04);
          pout = p2 * clamp(0.45 - 0.03 * (runSpd(who) - 10) - (loc >= 80 ? 0.1 : 0), 0.15, 0.7); p2 -= pout;
          res = await tryBase(p2, pout, lastName(who) + ' rounds second, third base is open', 'Hit and run · ' + posName(f) + ' is making the play at first', 'Makes third');
          if (res === 1) { bs[2] = who; bs[1] = ''; txt += ' ' + lastName(who) + ' keeps going, first to third on the hit and run!'; }
          else if (res === -1) { bs[1] = ''; recordOut(1); txt += ' ' + lastName(who) + ' is thrown out trying for third!'; }
        }
      } else if (bs[1] && !bs[2] && gHitRun) { hrMv = true; bs[2] = bs[1]; bs[1] = ''; txt += ' The runner moves up to third on the hit and run.'; }
      tg = 0;
      if (bs[2] && !bs[0] && bs[2] === o3) {
        who = bs[2];
        p2 = [0, 0.083, 0.083, 0.33, 0.514, 0.158, 0.45, 0.4, 0.4, 0.4][f]; pout = [0, 0.208, 0.208, 0.093, 0.097, 0.164, 0.096, 0.1, 0.1, 0.1][f];
        p2 = zoneAdj(p2, [0.5, 0.8, 1.3, 1.8, 2.5], GBW, z); pout *= [1.4, 1.1, 0.9, 0.7, 0.4][z];
        p2 = oddsAdj(p2, Math.exp(0.02 * (runSpd(who) - 10)));
        if (ifin) { p2 = oddsAdj(p2, 0.35); pout *= 1.6; }
        if (gHitRun) p2 = oddsAdj(p2, 3);
        if (p2 + pout > 0.98) pout = 0.98 - p2;
        res = await gbRun(p2, pout, lastName(who) + ' on third' + (ifin ? ' (infield in)' : '') + (gHitRun ? ' (running on the pitch)' : ''), 'Scores');
        if (res === 1) { txt += ' ' + lastName(who) + ' scores.'; scoreRun(who, b); bs[2] = ''; if (bs[1] && !hrMv) { bs[2] = bs[1]; bs[1] = ''; txt += ' ' + lastName(bs[2]) + ' to third.'; } }
        else if (res === -1) { txt += ' ' + lastName(who) + ' is thrown out at the plate! ' + lastName(b) + " safe at first on the fielder's choice."; bs[2] = ''; if (bs[1] && !hrMv) { bs[2] = bs[1]; bs[1] = ''; } bs[0] = b; }
        else txt += ' The runner holds.';
      } else if (bs[1] && !bs[2] && !bs[0] && !hrMv) {
        who = bs[1];
        p2 = [0, 0.287, 0.5, 0.947, 0.946, 0.134, 0.348, 0.5, 0.5, 0.5][f]; pout = [0, 0.16, 0.1, 0.012, 0.011, 0.009, 0.065, 0.04, 0.04, 0.04][f];
        p2 = zoneAdj(p2, [0.6, 0.8, 1.2, 1.5, 2.5], GBW, z); pout *= [1.4, 1.1, 0.9, 0.7, 0.4][z];
        p2 = oddsAdj(p2, Math.exp(0.02 * (runSpd(who) - 10)));
        if (p2 + pout > 0.98) pout = 0.98 - p2;
        res = await gbRun(p2, pout, lastName(who) + ' on second', 'Makes third');
        if (res === 1) { bs[2] = bs[1]; bs[1] = ''; txt += ' ' + lastName(bs[2]) + ' to third.'; }
        else if (res === -1) { txt += ' ' + lastName(who) + ' is thrown out at third! ' + lastName(b) + " safe at first on the fielder's choice."; bs[1] = ''; bs[0] = b; }
      }
      txt += outMisplay(f);
    }
    addLog(txt); return;
  }
  // fly, line, pop
  if (ev === EV.FB && f >= 7) z = fbZone(loc, b); else if (ev === EV.LD) z = ldZone(loc); else z = loc < 20 ? 0 : loc >= 80 ? 2 : 1;
  const popWord = z === 2 ? ' pops a sky-high one to ' : z === 0 ? ' hits a little pop-up to ' : ' pops out to ';
  if (ev === EV.FB) {
    if (f === 2) txt = lastName(b) + ' pops up in foul ground, ' + lastName(fid) + ' makes the catch' + (z === 2 ? ' near the screen.' : '.');
    else if (f <= 6) txt = lastName(b) + popWord + FIELDNAME[f] + ' (' + lastName(fid) + ').';
    else txt = lastName(b) + ' flies out to ' + ['shallow ', '', 'deep ', 'the warning track in '][z] + FIELDNAME[f] + ' (' + lastName(fid) + ').';
  } else if (ev === EV.LD) txt = lastName(b) + ' lines out to ' + FIELDNAME[f] + ' (' + lastName(fid) + ')' + [', right at him.', '.', loc >= 93 ? ', a leaping catch!' : ', a diving catch!'][z];
  else txt = lastName(b) + popWord + FIELDNAME[f] + ' (' + lastName(fid) + ').';
  recordOut(1);
  if (G.outs < 3 && ev === EV.LD && gHitRun && anyOn()) {
    if (extraRoll('Doubled off? (1-300)') <= 300) {
      tg = bs[2] ? 2 : bs[1] ? 1 : 0;
      recordOut(1); txt += ' ' + lastName(bs[tg]) + ' is doubled off ' + ['first', 'second', 'third'][tg] + ' on the hit and run!'; bs[tg] = '';
    }
  } else if (G.outs < 3 && ev === EV.LD && anyOn()) {
    p2 = zoneAdj(0.283, [1.4, 0.9, 0.5], [0.4, 0.45, 0.15], z);
    if (extraRoll('Runner doubled off? (1-' + Math.floor(p2 * 1000) + ')') <= p2 * 1000) {
      tg = bs[0] ? 0 : bs[1] ? 1 : 2;
      txt += ' ' + lastName(bs[tg]) + ' is doubled off ' + ['first', 'second', 'third'][tg] + '!'; recordOut(1); bs[tg] = '';
    }
  }
  if (G.outs < 3 && ev === EV.FB && f >= 7) {
    const arm = armF(fside, f); let pAdv;
    if (bs[2]) {
      who = bs[2]; [pAdv, pout] = tabP('F_r3', G.outs - 1, f);
      pAdv = oddsAdj(pAdv, speedF(who) / arm); pAdv = zoneAdj(pAdv, [0.22, 1.8, 9, 25], [0.3, 0.45, 0.17, 0.08], z); pout *= [1.5, 1, 0.4, 0.2][z];
      if (pAdv + pout > 1) pout = 1 - pAdv;
      res = await flyTag(pAdv, pout, lastName(who) + ' tagging from third (' + ['shallow', 'medium', 'deep', 'warning track'][z] + ')');
      if (res === 1) { txt += ' ' + lastName(who) + ' tags and scores.'; scoreRun(who, b); addBat(b, 'AB', -1); addBat(b, 'SF', 1); bs[2] = ''; }
      else if (res === -1) { recordOut(1); txt += ' ' + lastName(who) + ' is thrown out at the plate!'; bs[2] = ''; }
    }
    if (G.outs < 3 && bs[1] && !bs[2]) {
      [pAdv, pout] = tabP('F_r2', G.outs - 1, f);
      pAdv = oddsAdj(pAdv, speedF(bs[1]) / arm); pAdv = zoneAdj(pAdv, [0.15, 1, 4, 8], [0.3, 0.45, 0.17, 0.08], z);
      if (extraRoll(lastName(bs[1]) + ' tagging from second (1-' + Math.floor(pAdv * 1000) + ')') <= pAdv * 1000) { bs[2] = bs[1]; bs[1] = ''; txt += ' ' + lastName(bs[2]) + ' tags up to third.'; }
    }
    if (G.outs < 3 && bs[0] && !bs[1]) {
      pAdv = zoneAdj(0.027, [0.0001, 0.3, 2.5, 6], [0.3, 0.45, 0.17, 0.08], z); pAdv = oddsAdj(pAdv, Math.exp(0.02 * (runSpd(bs[0]) - 10)) / arm);
      pout = 0.005 * [1.5, 1, 0.4, 0.2][z];
      rr = extraRoll(lastName(bs[0]) + ' tagging from first (1-' + Math.floor(pAdv * 1000) + ')');
      if (rr <= pAdv * 1000) { bs[1] = bs[0]; bs[0] = ''; txt += ' ' + lastName(bs[1]) + ' tags and goes to second.'; }
      else if (rr <= (pAdv + pout) * 1000) { txt += ' ' + lastName(bs[0]) + " tags, but he's thrown out at second!"; bs[0] = ''; recordOut(1); }
    }
    txt += outMisplay(f);
  }
  addLog(txt);
}

// ---- fielding checks ----
async function resolveX(f, roll) {
  const fside = fieldSideTeam(), fid = f === 1 ? gPitID : defID(fside, f), bs = G.bases;
  const c = xChart(f, fid);
  G.extra = xText(f, fid);
  const rr = extraRoll('Fielding check ' + posName(f));
  const oc = rr <= c.pout * 1000 ? 'out' : rr <= (c.pout + c.perr) * 1000 ? 'ERROR' : rr <= (c.pout + c.perr + c.p1) * 1000 ? 'single' : 'double';
  showDice(rr, 'Check roll ' + rr + ' · ' + posName(f) + ' ' + oc);
  popReveal('FIELDING CHECK', posName(f) + ' ' + lastName(fid) + ' · range ' + c.rg + (hasFld(fid, f) ? ' · e' + fieldVal(fid, f, F.ER, 0) : ' · out of position'), xRows(f, fid), rr);
  G.xshow = { f, roll: rr, fid };
  const b = gBatID;
  if (rr <= c.pout * 1000) {
    if (f === 2) await resolveOut(EV.PU, roll, 0, 2); else if (f >= 7) await resolveOut(EV.FB, roll, 0, f); else await resolveOut(EV.GB, roll, 0, f);
  } else if (rr <= (c.pout + c.perr) * 1000) {
    addErr(); addBatSide(fid, 'E', 1, fside); gBatErr = true; errOut(); addBat(b, 'AB', 1); flash('ERROR', 'amber');
    let txt = 'Error! ' + lastName(fid) + ' (' + posName(f) + ") can't handle it, " + lastName(b);
    if (f >= 7) {
      txt += ' ends up on second.';
      if (bs[2]) { txt += ' ' + lastName(bs[2]) + ' scores.'; scoreRun(bs[2], ''); }
      if (bs[1]) { txt += ' ' + lastName(bs[1]) + ' scores.'; scoreRun(bs[1], ''); }
      bs[2] = bs[0]; bs[1] = b; bs[0] = '';
    } else {
      txt += ' is safe.';
      if (bs[2] && bs[1] && bs[0]) { txt += ' ' + lastName(bs[2]) + ' scores.'; scoreRun(bs[2], ''); }
      if (bs[0]) { if (bs[1]) bs[2] = bs[1]; bs[1] = bs[0]; }
      bs[0] = b;
    }
    addLog(txt); UI.placeBall(f, 0);
  } else if (rr <= (c.pout + c.perr + c.p1) * 1000) {
    if (f >= 7) { G.extra = xText(f, fid); await resolveEvent(EV.B1, 'C', roll, f); }
    else { addLog('Infield hit! ' + lastName(fid) + ' (' + posName(f) + ") can't make the play in time."); resolveSingleInfield(); UI.placeBall(f, 0); }
  } else await resolveEvent(EV.B2, 'C', roll, f >= 7 ? f : 7 + Math.floor(rand() * 3));
}

// ---- steals ----
function sitMult() {
  const d = G.half === 0 ? G.score[0] - G.score[1] : G.score[1] - G.score[0];
  const i = d <= -4 ? 0 : d <= -2 ? 1 : d === -1 ? 2 : d === 0 ? 3 : d === 1 ? 4 : d <= 3 ? 5 : 6;
  const m = miscB('sit' + i + (G.inn >= 7 ? 'L' : 'E'), 1) * miscB('sito' + G.outs, 1);
  return m <= 0 ? 1 : m;
}
const leadStr = bse => (bse === 1 || bse === 2) ? G.lead[bse - 1] : '';
function leadMult(lead) { return ({ Great: 1.6, Good: 1.25, Bad: 0.7, Poor: 0.4 })[lead] || 1; }
function pitHold(pid) { const r = pRowOf(pid); return r ? clamp(num(r[P.HOLDX]), 0.3, 2.5) : 1; }
function pitSBO(pid) { const r = pRowOf(pid); return r && num(r[P.SBO]) > 0 ? clamp(num(r[P.SBO]), 0.4, 2.5) : 1; }
function pacePen(rnr) {
  const br = backRow('B|' + rnr); if (!br) return 0;
  const rg = backV(br, 1), rAtt = backV(br, 11) + backV(br, 12); if (rg <= 0) return 0;
  const pG = replayBat(rnr, 'G') + (G.over ? 0 : 1); const pAtt = replayBat(rnr, 'SB') + replayBat(rnr, 'CS');
  const over = pAtt - (rAtt / rg * pG * 1.15 + 2);
  return over <= 0 ? 0 : Math.round(clamp(over * 15, 0, 250));
}
function stealSafe(bse) {
  const rnr = G.bases[bse - 1]; let succ = num(bRowOf(rnr)[B.SBSUCC]); if (succ <= 0) succ = 0.6;
  const lgcs = miscV('cs_lg', 0.34), cs = fieldVal(defID(fieldSideTeam(), 2), 2, F.CS, lgcs);
  const c1 = clamp(cs, 0.05, 0.95), c2 = clamp(lgcs, 0.05, 0.95);
  succ = oddsAdj(succ, ((1 - c1) / c1) / ((1 - c2) / c2));
  let md = ({ Great: 0.06, Good: 0.03, Bad: -0.03, Poor: -0.06 })[leadStr(bse)] || 0;
  succ = oddsAdj(succ, pitSBO(gPitID));
  if (bse === 2) { if (miscB('sb3_s', 0) > 0) succ *= clamp(miscB('sb3_s', 0), 0.85, 0.97); else succ -= 0.05; }
  else if (bse === 3) succ *= miscB('sbh_s', 0.6);
  succ -= 0.01;
  if (G.pitchout) { succ = oddsAdj(clamp(succ + md, 0.05, 0.95), 0.45); md = 0; }
  let top = Math.floor(clamp(succ + md, 0.05, 0.95) * 1000);
  gPaceTxt = ''; const pp = pacePen(rnr);
  if (pp > 0) { top -= pp; if (top < 50) top = 50; gPaceTxt = 'Pitchers are watching him (running ahead of his real pace): -' + pp; }
  return top;
}
async function surpriseSteal(bse) {
  const bs = G.bases, rnr = bs[bse - 1]; if (!rnr) return;
  const cat = defID(fieldSideTeam(), 2), lgcs = miscV('cs_lg', 0.34), cs = fieldVal(cat, 2, F.CS, lgcs);
  const safeTop = Math.floor(clamp(oddsAdj(clamp(0.8 * (1 - cs) / (1 - lgcs), 0.6, 0.92), pitSBO(gPitID)), 0.55, 0.94) * 1000);
  const nm = bse === 1 ? 'second' : 'third';
  gPopKind = 'Surprise steals';
  const rr = await popRoll('SURPRISE STEAL!', lastName(rnr) + ' (speed ' + runSpd(rnr) + ') catches ' + lastName(gPitID) + ' napping and takes off for ' + nm + '!', [{ label: 'Safe', lo: 1, hi: safeTop, c: 'g' }, { label: 'Caught stealing', lo: safeTop + 1, hi: 1000, c: 'r' }], 'Surprise steal of ' + nm + ' (safe 1-' + safeTop + ')');
  sfx(rr <= safeTop ? 'safe' : 'caught', 0, { home: rr <= safeTop ? offHome() : defHome() }); flash(rr <= safeTop ? 'SAFE!' : 'CAUGHT STEALING', rr <= safeTop ? 'green' : 'red');
  if (rr <= safeTop) { bs[bse] = rnr; bs[bse - 1] = ''; addBat(rnr, 'SB', 1); addLog('Surprise! ' + lastName(rnr) + ' catches ' + lastName(gPitID) + ' napping and steals ' + nm + '.'); }
  else { bs[bse - 1] = ''; recordOut(1); addBat(rnr, 'CS', 1); addLog('Surprise! ' + lastName(rnr) + ' catches ' + lastName(gPitID) + ' napping and takes off for ' + nm + ', but ' + lastName(cat) + ' guns him down.'); }
}
async function stealAttempt(bse, onStrikeout) {
  const bs = G.bases, rnr = bs[bse - 1]; if (!rnr) return;
  let safeTop = stealSafe(bse); if (onStrikeout) safeTop = Math.floor(safeTop * 0.9);
  if (G.pitchout) gLogPrefix = 'Pitchout! ';
  const nm = bse === 1 ? 'second' : bse === 2 ? 'third' : 'home', cat = defID(fieldSideTeam(), 2);
  gPopKind = 'Steal and pickoff pop-ups';
  const rr = await popRoll('STEAL: ' + lastName(rnr).toUpperCase() + ' GOES FOR ' + nm.toUpperCase(), 'Lead: ' + (leadStr(bse) || 'OK') + ' · ' + lastName(cat) + ' throws out ' + Math.round(fieldVal(cat, 2, F.CS, miscV('cs_lg', 0.34)) * 100) + '%' + (gPaceTxt ? ' · ' + gPaceTxt : ''), [{ label: 'Safe', lo: 1, hi: safeTop, c: 'g' }, { label: 'Caught stealing', lo: safeTop + 1, hi: 1000, c: 'r' }], lastName(rnr) + ' stealing ' + nm + ' (safe 1-' + safeTop + ')');
  G.pitchout = false;
  let txt;
  if (rr <= safeTop && bse < 3 && chance(ERR_SB * (bse === 2 ? 0.6 : 1) * errScale() * eFac(cat, 2), 'Throwing error on the steal')) {
    chargeE(2); tagRunners(); addBat(rnr, 'SB', 1); bs[bse - 1] = '';
    if (bse === 1) { if (bs[2]) { tagAided(bs[2]); scoreRun(bs[2], ''); } bs[2] = rnr; txt = lastName(rnr) + ' steals second, and ' + lastName(cat) + "'s throw gets away! He goes to third."; }
    else { tagAided(rnr); scoreRun(rnr, ''); txt = lastName(rnr) + ' steals third, and ' + lastName(cat) + "'s throw gets away! He scores."; }
    addLog(txt); return;
  }
  if (rr <= safeTop && bse === 3) { bs[2] = ''; addBat(rnr, 'SB', 1); scoreRun(rnr, ''); noteSB(rnr); txt = lastName(rnr) + ' STEALS HOME!'; sfx('safe', 0, { home: offHome(), big: true }); flash('STEALS HOME!', 'gold'); }
  else if (rr <= safeTop) { bs[bse] = rnr; bs[bse - 1] = ''; addBat(rnr, 'SB', 1); noteSB(rnr); txt = lastName(rnr) + ' steals ' + nm + '!'; sfx('safe', 0, { home: offHome() }); flash('SAFE!', 'green'); }
  else { bs[bse - 1] = ''; recordOut(1); addBat(rnr, 'CS', 1); txt = lastName(rnr) + ' is caught stealing ' + nm + '.'; sfx('caught', 0, { home: defHome() }); flash('CAUGHT STEALING', 'red'); }
  addLog(txt);
}
async function computerSteal() {
  if (!teamOpt('Computer steals', batSideTeam())) return false;
  const bs = G.bases, cand = [];
  if (bs[0] && !bs[1]) cand.push(1); else if (bs[1] && !bs[2] && !bs[0]) cand.push(2);
  if (bs[2] && !bs[1]) cand.push(3);
  for (const bse of cand) {
    const rnr = bs[bse - 1]; let att = num(bRowOf(rnr)[B.SBATT]);
    if (bse === 2) att *= miscB('sb3_r', 0.2); if (bse === 3) att *= miscB('sbh_r', 0);
    att *= miscB('sbadj', 1) * sitMult(); if (flavor('Surprise steals')) att *= 0.94;
    let mult = leadMult(leadStr(bse)) * pitHold(gPitID);
    if (G.pitchout) att *= 0.5;
    if (att > 0 && chance(clamp(0.8 * att * mult, 0, 0.6), 'Runner goes?')) { await stealAttempt(bse, false); return true; }
  }
  return false;
}
function stealCue(ob) {
  const bs = G.bases;
  if (ob === 1) { if (!bs[0] || bs[1]) return 0; } else if (ob === 2) { if (!bs[1] || bs[2] || bs[0]) return 0; } else return 0;
  const rnr = bs[ob - 1]; const pid = curPitcherID(fieldSideTeam());
  let att = num(bRowOf(rnr)[B.SBATT]) * miscB('sbadj', 1); if (ob === 2) att *= miscB('sb3_r', 0.2);
  const p = 0.8 * att * leadMult(leadStr(ob)) * pitHold(pid); const safe = stealSafe(ob) / 1000;
  return (p >= 0.2 && safe >= 0.6) ? 2 : (p >= 0.1 && safe >= 0.5) ? 1 : 0;
}

// ---- pickoffs before the pitch ----
const pkOn = () => gSim || opt('Pickoffs') !== 'Manual';
function ppBase() { const bs = G.bases; return (bs[0] && !bs[1]) ? 1 : (bs[1] && !bs[2] && !bs[0]) ? 2 : 0; }
function ppSig() { return G.gameNo + '|' + G.inn + '|' + G.half + '|' + G.outs + '|' + G.bases.join('|') + '|' + G.next[batSideTeam()]; }
function pitPKF(pid) { const r = pRowOf(pid); return r && num(r[P.PKF]) > 0 ? num(r[P.PKF]) : 1; }
function runPKR(id) { const r = bRowOf(id); return num(r[B.PKR]) > 0 ? num(r[B.PKR]) : 1; }
const LEADS = ['', 'Poor', 'Bad', 'OK', 'Good', 'Great'];
function leadIdx(l) { const i = LEADS.indexOf(l); return i < 1 ? 3 : i; }
const leadFactor = lead => [0, 0.3, 0.6, 1, 1.4, 2][leadIdx(lead)];
function prePitch(showPop) {
  const b = ppBase(); if (b === 0 || !pkOn()) return false;
  const sig = ppSig(); if (G.ppSig === sig) return false; G.ppSig = sig;
  const bs = G.bases, rnr = bs[b - 1];
  gPitID = curPitcherID(fieldSideTeam());
  const pkf = clamp(pitPKF(gPitID), 0.3, 3), threat = clamp(num(bRowOf(rnr)[B.SBATT]) / clamp(miscB('sb_att_lg', 0.1), 0.01, 1), 0.3, 3);
  const mean = miscV(b === 1 ? 't1_r' : 't2_r', b === 1 ? 0.4 : 0.02) * Math.pow(threat, 0.6);
  const rule = miscV('pkrule', 0) === 1;
  let u = rand(), term = Math.exp(-mean), acc = term, thr = 0;
  while (u > acc && thr < 6) { thr++; term = term * mean / thr; acc += term; }
  if (rule && thr > 2) thr = 2;
  const lead0 = leadStr(b) || 'OK'; const l0 = leadIdx(lead0); let li = l0;
  const pdn = 0.12 * Math.sqrt(pkf), pup = 0.12 * Math.sqrt(threat);
  for (let i = 0; i < thr; i++) { u = rand(); if (u < pdn) { if (li > 1) li--; } else if (u < pdn + pup) { if (li < 5) li++; } }
  if (rule && thr === 2 && li < 5) li++;
  G.lead[b - 1] = LEADS[li];
  let ev = 0;
  if (thr > 0) {
    const pAny = 1 - Math.exp(-mean);
    const pout = clamp(miscV(b === 1 ? 'po1_r' : 'po2_r', 0.004) * pkf * runPKR(rnr) * leadFactor(LEADS[li]) / pAny, 0, 0.5);
    const perr = clamp(miscV(b === 1 ? 'pe1_r' : 'pe2_r', 0.004) * eFac(gPitID, 1) / pAny, 0, 0.3);
    u = rand(); if (u < pout) ev = 1; else if (u < pout + perr) ev = 2;
  }
  const nm = b === 1 ? 'first' : 'second';
  let txt = lastName(gPitID) + (thr === 0 ? " doesn't throw over" : ' throws over ' + (thr === 1 ? 'once' : thr + ' times')) + '. ' + lastName(rnr) + "'s lead: " + (li !== l0 ? lead0 + ' to ' + LEADS[li] : LEADS[li]) + (li > l0 ? ' (he got a read)' : li < l0 ? ' (driven back)' : '') + '.';
  let res;
  if (ev === 1) { bs[b - 1] = ''; recordOut(1); res = lastName(gPitID) + ' picks ' + lastName(rnr) + ' off ' + nm + '!'; addLog(res); if (G.outs < 3) res += ' Proceed to the at-bat.'; }
  else if (ev === 2) { chargeE(1); tagRunners(); if (b === 1) { bs[1] = rnr; bs[0] = ''; } else { bs[2] = rnr; bs[1] = ''; } res = 'The pickoff throw gets away! ' + lastName(rnr) + ' to ' + (b === 1 ? 'second' : 'third') + '. Proceed to the at-bat.'; addLog(res); }
  else { txt += '  Steal ' + (b === 1 ? 'second' : 'third') + ' now: safe 1-' + stealSafe(b) + '.'; res = lastName(rnr) + (thr === 0 ? ' takes his lead. ' : ' gets back safely. ') + 'Proceed to the at-bat.'; }
  G.ppSig = ppSig();
  const newRunner = G.ppLast !== b + '|' + rnr; G.ppLast = b + '|' + rnr;
  if (showPop && !gSim && (ev > 0 || newRunner) && opt('Pop-ups') !== 'Off') { UI.popInfo('ON BASE: ' + lastName(rnr).toUpperCase(), txt, res); return true; }
  return false;
}

// ---- pitchers taking the mound ----
function ensurePitchers() {
  for (let side = 0; side <= 1; side++) {
    const pid = curPitcherID(side);
    if (pid && pid !== G.curPit[side]) {
      if (!G.started && G.startPit[side]) {
        const i = G.boxPit.findIndex(x => x.id === G.startPit[side]); if (i >= 0) G.boxPit.splice(i, 1);
        G.startPit[side] = ''; G.used[side] = [];
      }
      G.curPit[side] = pid; G.mom[side] = 0; G.scoreless[side] = 0; G.eff[side] = pitEffSimple(pid); G.bf[side] = 0; G.runs[side] = 0;
      if (opt('Pitcher daily form') === 'Off') { G.form[side] = restPen(pid); G.formNeed[side] = 0; }
      else if (opt('Warm-up tosses') !== 'Off' && !gSim) { G.form[side] = restPen(pid); G.formNeed[side] = 1; }
      else { G.form[side] = rollForm() + restPen(pid); G.formNeed[side] = 0; }
      G.entLead[side] = side === 0 ? G.score[0] - G.score[1] : G.score[1] - G.score[0];
      if (side === fieldSideTeam()) { G.pxpit = pid; G.pxouts = G.outs; }
      G.used[side].push(pid);
      if (!G.startPit[side]) { G.startPit[side] = pid; boxPitRow(pid, side).GS = 1; }
      else { boxPitRow(pid, side); addLog('Now pitching for ' + teamCode(side) + ': ' + fullName(pid) + (G.formNeed[side] === 1 ? '' : ' (' + formName(G.form[side]) + ')')); }
    }
  }
}
function warmUpFirst() {
  // a pitcher taking the mound mid-game throws his warm-up tosses as a roll of its own
  const side = fieldSideTeam(); if (G.formNeed[side] !== 1) return false;
  const pid = curPitcherID(side); if (!pid) return false;
  const ri = restInfo(pid), rr = rnd1000(), f = formFromRoll(rr) / 100 + ri.pen;
  G.form[side] = f; G.formNeed[side] = 0; G.wuRoll[side] = rr;
  addLog(lastName(pid) + ' finishes his warm-up tosses: ' + formName(f) + (ri.txt ? ' (' + ri.txt + ')' : '') + '.');
  showDice(rr, 'Warm-up tosses · ' + lastName(pid) + ' (' + teamCode(side) + '): ' + formName(f));
  if (popOn() && popOpt('Warm-up tosses')) UI.popReveal('WARM-UP TOSSES', fullName(pid) + ' takes the mound for ' + teamCode(side) + (ri.txt ? ' · ' + ri.txt + ' (' + Math.round(ri.pen * 100) + '%)' : '') + '. How does he look today?', wuRows(), rr, wuResult(rr, pid));
  G.playTxt = lastName(pid) + ' is warmed up. Click the dice for the at-bat.';
  return true;
}
function autoPitching() {
  const side = fieldSideTeam(); if (!teamOpt('Auto pitching changes', side)) return;
  const pid = curPitcherID(side), r = pRowOf(pid); if (!r) return;
  const bf = G.bf[side], runs = G.runs[side]; let stam = num(r[P.STAM]) * effNow(side); if (stam < 4) stam = 4;
  const isStarter = pid === G.startPit[side]; const lead = side === 0 ? G.score[0] - G.score[1] : G.score[1] - G.score[0];
  let pull = false;
  if (bf >= stam + 3) pull = true;
  if (G.inn <= 3 && runs >= 6) pull = true;
  if (G.inn >= 4 && G.inn <= 5 && runs >= 5) pull = true;
  if (G.inn >= 6 && runs >= 4) pull = true;
  if (G.inn >= 9 && G.outs === 0 && !anyOn() && lead >= 1 && lead <= 3 && !isCloser(side, pid) && bf >= 1 && (!isStarter || bf >= stam - 2)) pull = true;
  if (!pull) return;
  const nxt = nextReliever(side, G.inn >= 9 && lead >= 1 && lead <= 3); if (!nxt) return;
  G.pitcher[side] = nxt; ensurePitchers();
}
function syncLineupBox() {
  // box score rows follow the batting order; subs get their own row under the slot
  for (let side = 0; side <= 1; side++) {
    let nb = G.next[side]; if (nb < 1) nb = 1;
    for (let slot = 1; slot <= 9; slot++) {
      const id = slotID(side, slot); if (!id) continue;
      let ps = slotPos(side, slot).toLowerCase(); let r = boxBatFind(id);
      if (!r) {
        let prev = ''; for (const x of G.boxBat) if (x.team === teamCode(side) && x.slot === slot) prev = x.id;
        r = boxBatRow(id, side);
        if (G.started && side === batSideTeam() && prev) {
          if (slot === nb) ps = 'ph';
          else for (let i = 0; i < 3; i++) if (G.bases[i] === prev) { G.bases[i] = id; ps = 'pr'; const tg = tagGet(prev); if (tg) { tagPut(id, tg); tagPut(prev, null); } }
        }
        r.slot = slot; r.pos = ps;
      } else if (!r.slot) { r.slot = slot; r.pos = ps; }
      else if (side === fieldSideTeam()) { const cur = r.pos; const last = cur.slice(cur.lastIndexOf('-') + 1); if (ps && last !== ps) r.pos = cur + '-' + ps; }
    }
  }
}
function checkPH() {
  // a hitter picked in a "P" spot becomes a pinch hitter (PH); the spot goes back to P after the inning
  for (let side = 0; side <= 1; side++) for (let slot = 1; slot <= 9; slot++) {
    const s = G.lineup[side][slot - 1]; if (!s || String(s.pos).toUpperCase() !== 'P') continue;
    if (s.id && s.id !== curPitcherID(side) && isBat(s.id) && !isPit(s.id)) { s.pos = 'PH'; G.phSlot[side] = slot; addLog(lastName(s.id) + ' pinch hits for ' + lastName(curPitcherID(side)) + '.'); }
  }
}
function phDone(side) {
  const slot = G.phSlot[side]; if (slot < 1 || slot > 9) return; G.phSlot[side] = 0;
  const s = G.lineup[side][slot - 1]; if (!s || s.pos !== 'PH') return;
  s.pos = 'P'; s.id = '';
  if (gSim || G.over) return;
  if (G.inn >= 9 && ((G.half === 0 && G.score[1] > G.score[0]) || (G.half === 1 && G.score[0] !== G.score[1]))) return;
  G.phTold[side] = true;
}

// ---- half innings, momentum, walk-offs ----
function countLOB() { let n = 0; for (const b of G.bases) if (b) n++; G.lob[G.half] += n; }
function checkWalkoff() {
  if (G.half === 1 && G.inn >= 9 && G.score[1] > G.score[0]) { countLOB(); addLog('Ballgame! ' + teamCode(1) + ' wins it in the bottom of the ' + ordinal(G.inn) + '.'); G.walkoff = true; flash('WALK-OFF WIN!', 'gold'); endGame(); return true; }
  return false;
}
function momentum() {
  if (opt('Momentum') !== 'On') return;
  const fs = 1 - G.half, pid = curPitcherID(fs); if (!pid) return;
  const r = G.innRuns[G.half][G.inn - 1] || 0; let sc = G.scoreless[fs], m = G.mom[fs];
  if (r === 0) {
    sc++;
    if (m === -1) { m = 0; addLog(lastName(pid) + ' settles down: a clean inning ends the rattled spell.'); if (popOn() && popOpt('Momentum')) UI.popInfo('SETTLED DOWN', fullName(pid) + ' threw a scoreless inning. The -3% rattled spell is over.'); }
    else if (sc >= 3 && m === 0) { m = 1; addLog('In a groove: ' + lastName(pid) + ' has thrown ' + sc + ' scoreless innings in a row (+2% while it lasts).'); if (popOn() && popOpt('Momentum')) UI.popInfo('IN A GROOVE', fullName(pid) + ' has thrown ' + sc + ' scoreless innings in a row. +2% until he gives up a run.'); }
  } else {
    sc = 0;
    if (r >= 3 && m !== -1) { m = -1; addLog('Rattled: ' + lastName(pid) + ' gave up ' + r + ' runs that inning (-3% until he throws a clean inning).'); if (popOn() && popOpt('Momentum')) UI.popInfo('RATTLED', fullName(pid) + ' gave up ' + r + ' runs that inning. -3% until he throws a scoreless inning.'); }
  }
  G.scoreless[fs] = sc; G.mom[fs] = m;
}
function endHalf() {
  phDone(batSideTeam()); momentum(); countLOB();
  G.bases = ['', '', '']; G.xouts = 0; G.pxouts = 0; G.pxpit = '';
  const [sA, sH] = G.score;
  if (G.half === 0) {
    if (G.inn >= 9 && sH > sA) { addLog('Ballgame! ' + teamCode(1) + ' wins, no need for the bottom of the ' + ordinal(G.inn) + '.'); endGame(); return; }
    G.half = 1; G.outs = 0;
  } else {
    if (G.inn >= 9 && sA !== sH) { addLog('Ballgame! ' + (sA > sH ? teamCode(0) : teamCode(1)) + ' wins.'); endGame(); return; }
    G.half = 0; G.outs = 0; G.inn++;
  }
  while (G.innRuns[G.half].length < G.inn) G.innRuns[G.half].push(0);
  G.infield = 'No';
  addLog('--- ' + (G.half === 0 ? 'Top' : 'Bottom') + ' of the ' + ordinal(G.inn) + ' ---');
  if (G.half === 1 && G.inn === 7) { sfx('stretch', 0.3); flash('SEVENTH-INNING STRETCH', 'gold'); } else sfx('inning', 0.3);
}
function rollLead() { const r = rand(); return r < 0.1 ? 'Poor' : r < 0.3 ? 'Bad' : r < 0.7 ? 'OK' : r < 0.9 ? 'Good' : 'Great'; }

// ---- the main at-bat ----
async function nextAtBat() {
  const bs = G.bases;
  if (G.over) { gHitRun = false; UI.toast('Game over. Click Play next game.'); return; }
  if (G.pend) { gHitRun = false; await playPending(); return; }
  UI.ballToMound();
  if (G.pregame > 0 && !gSim) { gHitRun = false; pregameClick(); return; }
  G.xshow = null;
  if (!teamCode(0) || !curPitcherID(0) || !curPitcherID(1)) { gHitRun = false; UI.toast('Load teams first, and make sure both pitchers are picked.'); return; }
  if (!lineupHealthy()) { gHitRun = false; return; }
  const hr0 = gHitRun;
  ensurePitchers(); syncLineupBox(); autoPitching(); syncLineupBox();
  if (!gSim && warmUpFirst()) {
    if (hr0) { gHitRun = false; G.playTxt += ' (Hit and run is off: click Hit and run again.)'; }
    return;
  }
  G.started = true; gExtra = ''; G.extra = '';
  const side = batSideTeam();
  checkPH();
  let bslot = G.next[side]; if (bslot < 1) bslot = 1;
  gBatID = slotID(side, bslot); gPitID = curPitcherID(fieldSideTeam());
  prePitch(false);
  const logStart = G.log.length, outs0 = G.outs, rbi0 = (boxBatFind(gBatID) || { RBI: 0 }).RBI, r0 = (boxBatFind(gBatID) || { R: 0 }).R, paBat = gBatID;
  const finish = async () => {
    recordPA(side, bslot, paBat, logStart, outs0, rbi0, r0);
    bslot++; if (bslot > 9) bslot = 1; G.next[side] = bslot;
    if (checkWalkoff()) return;
    if (G.outs >= 3) endHalf();
  };
  if (G.outs >= 3) { endHalf(); gHitRun = false; return; }
  if (!gBatID) { UI.toast('Lineup spot ' + bslot + ' for ' + teamCode(side) + ' has no player. Pick one from the dropdown.'); gHitRun = false; return; }
  // wild pitch, passed ball or balk before the pitch
  if (anyOn()) {
    const cat = defID(fieldSideTeam(), 2); const pr = pRowOf(gPitID);
    let pwp = pr ? num(pr[P.WP]) : 0.0045, pbk = pr ? num(pr[P.BK]) : 0.0014;
    pwp *= 2.55; const ppb = 1.8 * fieldVal(cat, 2, F.PB9, 0.025) / 38; pbk *= 2.16;
    gMainRoll = rnd1000();
    if (chance(pwp + ppb + pbk, 'Wild pitch / passed ball / balk check')) {
      tagRunners(); const u = rand() * (pwp + ppb + pbk); let txt;
      if (u < pwp) { txt = 'Wild pitch! '; addPit('WP', 1); advanceAll(false); }
      else if (u < pwp + ppb) { txt = 'Passed ball on ' + lastName(cat) + '! '; advanceAll(true); }
      else { txt = 'Balk on ' + lastName(gPitID) + '! '; addPit('BK', 1); advanceAll(false); }
      addLog(txt + 'The runners move up.');
      popInfo(txt.replace('!', '').trim().toUpperCase(), 'The runners move up a base.');
      if (checkWalkoff()) { gHitRun = false; return; }
    }
  }
  // surprise steal
  if (!gHitRun && flavor('Surprise steals')) {
    let k = 0; if (bs[0] && !bs[1]) k = 1; else if (bs[1] && !bs[2] && !bs[0]) k = 2;
    if (k > 0) {
      let psur = SURP_SHARE * 0.8 * miscB('sb_att_lg', 0.106) * miscB('sbadj', 1); if (k === 2) psur *= miscB('sb3_r', 0.2);
      psur *= pitHold(gPitID) * sitMult();
      if (chance(clamp(psur, 0, 0.05), 'Surprise steal?')) { await surpriseSteal(k); if (G.outs >= 3) { endHalf(); gHitRun = false; return; } }
    }
  }
  if (!gHitRun && await computerSteal()) {
    if (G.outs >= 3) { endHalf(); gHitRun = false; return; }
    if (checkWalkoff()) { gHitRun = false; return; }
  }
  // pitching around this batter
  G.careful = false;
  if (G.pitchAround) {
    G.pitchAround = false;
    if (extraRoll('Pitching around him (ball four 1-500)') <= 500) {
      G.bf[fieldSideTeam()]++; addPit('BF', 1);
      gLogPrefix = lastName(gPitID) + ' pitches around him: ';
      showDice(0, 'Pitching around ' + lastName(gBatID) + ': ball four');
      await resolveEvent(EV.BB, '', 999, 0);
      await finish(); gHitRun = false; return;
    }
    G.careful = true;
  }
  const pth = throws_(gPitID), bside = batSide(gBatID, pth), form = totalForm(fieldSideTeam());
  const wB = batterCard(gBatID, pth), pc = pitcherCard(gPitID, bside, form), wP = pc.w, wX = pc.x;
  if (G.pitchout) {
    G.pitchout = false;
    if (rand() < 0.03) {
      G.bf[fieldSideTeam()]++; addPit('BF', 1);
      gLogPrefix = 'The pitchout puts ' + lastName(gBatID) + ' ahead, and he walks: ';
      showDice(0, 'Pitchout, nobody ran: ball four');
      await resolveEvent(EV.BB, '', 999, 0);
      await finish(); gHitRun = false; return;
    }
    gExtra += 'Pitchout, nobody ran (ball one)   ';
  }
  G.manThrows = 0;
  const preview = r => {
    if (r <= 500) { let acc = 0; for (let i = 1; i <= 15; i++) { acc += wB[i]; if (r <= acc) return lastName(gBatID) + "'s card: " + LBL[i]; } return lastName(gBatID) + "'s card: Pop out"; }
    let acc = 500; for (let i = 1; i <= 15; i++) { acc += wP[i]; if (r <= acc) return lastName(gPitID) + "'s card: " + LBL[i]; }
    for (let i = 1; i <= 9; i++) { acc += wX[i - 1]; if (r <= acc) return lastName(gPitID) + "'s card: fielding check, " + posName(i); } return lastName(gPitID) + "'s card: fielding check";
  };
  const roll = await getRoll(fullName(gBatID) + ' batting vs ' + fullName(gPitID), preview);
  gMainRoll = roll;
  let k = 0, xf = 0, onCard;
  if (roll <= 500) {
    onCard = lastName(gBatID) + "'s card"; let acc = 0;
    for (let i = 1; i <= 15; i++) { acc += wB[i]; if (roll <= acc) { k = i; break; } }
    if (k === 0) k = 14;
  } else {
    onCard = lastName(gPitID) + "'s card"; let acc = 500;
    for (let i = 1; i <= 15; i++) { acc += wP[i]; if (roll <= acc) { k = i; break; } }
    if (k === 0) { for (let i = 1; i <= 9; i++) { acc += wX[i - 1]; if (roll <= acc) { xf = i; break; } } if (xf === 0) xf = 6; }
  }
  G.bf[fieldSideTeam()]++; addPit('BF', 1);
  if (xf > 0) {
    const fid = xf === 1 ? gPitID : defID(fieldSideTeam(), xf);
    showDice(roll, 'Roll ' + roll + ' · ' + onCard + ' · ' + posName(xf) + ' fielding check (' + lastName(fid) + ', range ' + rangeR(fid, xf) + ')');
    if (popOpt('Fielding check pop-ups')) {
      G.pend = { kind: 'X', f: xf, roll, hr: gHitRun, loc: null };
      G.extra = xText(xf, fid); G.rollTxt = 'Roll ' + roll + ' · ' + posName(xf) + ' check';
      preLoc(0, xf, roll);
      G.playTxt = 'Fielding check: click ' + lastName(fid) + ' on the field (or the pop-up) to roll.';
      gHitRun = false; return;
    }
    await resolveX(xf, roll);
  } else {
    if (clickMode()) {
      showDice(roll, 'Roll ' + roll + ' · ' + LBL[k]);
      G.pend = { kind: 'K', k, roll, hr: gHitRun, loc: null, of: 0 };
      preLoc(k, 0, roll);
      G.playTxt = 'On ' + onCard + '. Click the ' + (k === 15 ? 'amber row (or the wall chart)' : k <= 9 ? 'green row' : 'red row') + ' to play it.';
      G.misses = 0;
      if (findMode()) {
        G.pend.findTxt = G.rollTxt;
        G.rollTxt = 'Roll ' + roll + (G.pend.loc != null ? ' · Loc ' + String(G.pend.loc).padStart(2, '0') : '');
        G.playTxt = 'Find roll ' + roll + ' on the cards (1-500 batter, 501-1000 pitcher) and click its row.';
      }
      gHitRun = false; return;
    }
    showDice(roll, 'Roll ' + roll + ' · ' + LBL[k]);
    await resolveEvent(ROW_EV[k], ROW_SUB[k], roll, 0);
  }
  await finish();
  gHitRun = false;
}
async function playPending() {
  const pend = G.pend; if (!pend) return;
  gExtra = ''; const roll = pend.roll; gHitRun = !!pend.hr;
  const side = batSideTeam(); let bslot = G.next[side]; if (bslot < 1) bslot = 1;
  gBatID = slotID(side, bslot); gPitID = curPitcherID(fieldSideTeam()); gMainRoll = roll;
  G.extra = ''; gMainRollTxt = ''; const logStart = G.log.length, outs0 = G.outs, rbi0 = (boxBatFind(gBatID) || { RBI: 0 }).RBI, r0 = (boxBatFind(gBatID) || { R: 0 }).R;
  if (pend.findTxt) G.rollTxt = pend.findTxt;
  if (pend.kind === 'X') { G.pend = { kind: 'done', of: 0, loc: pend.loc }; await resolveX(pend.f, roll); }
  else { G.pend = { kind: 'done', of: pend.of || 0, loc: pend.loc }; G.rollTxt = 'Roll ' + roll + ' · ' + LBL[pend.k]; await resolveEvent(ROW_EV[pend.k], ROW_SUB[pend.k], roll, 0); }
  G.pend = null; recordPA(side, bslot, gBatID, logStart, outs0, rbi0, r0);
  bslot++; if (bslot > 9) bslot = 1; G.next[side] = bslot;
  if (checkWalkoff()) { gHitRun = false; return; }
  if (G.outs >= 3) endHalf();
  gHitRun = false;
}
function lineupHealthy() {
  if (gSim || !injuriesOn()) return true;
  const msg = [];
  for (let side = 0; side <= 1; side++) {
    for (let i = 1; i <= 9; i++) { const id = slotID(side, i); if (id && !isAvail(id, teamCode(side))) msg.push(fullName(id) + ' (' + outUntil(id, teamCode(side)) + ')'); }
    const id = curPitcherID(side); if (id && !isAvail(id, teamCode(side))) msg.push(fullName(id) + ' (' + outUntil(id, teamCode(side)) + ')');
  }
  if (msg.length) { UI.alert("These players can't play today:\n\n" + msg.join('\n') + "\n\nPick someone else, or set 'Injuries this game' to Off in the manager panel."); return false; }
  return true;
}

// ---- pregame warm-ups ----
function pregameClick() {
  let stg = G.pregame; if (stg === 0) return;
  ensurePitchers(); syncLineupBox();
  if (stg >= 2 && G.formNeed[0] === 1) stg = 1;
  else if (stg === 4 && G.formNeed[1] === 1) stg = 3;
  else if (stg === 4) { G.pregame = 0; G.rollTxt = 'Play ball! ' + teamCode(0) + ' at ' + teamCode(1) + '.'; G.playTxt = 'Click ROLL THE DICE.'; sfx('playball'); flash('PLAY BALL!', 'gold'); return; }
  const side = stg === 1 ? 0 : 1;
  if (G.formNeed[side] === 1) {
    const pid = curPitcherID(side), rr = rnd1000(), ri = restInfo(pid), f = formFromRoll(rr) / 100 + ri.pen;
    G.form[side] = f; G.formNeed[side] = 0; G.wuRoll[side] = rr;
    addLog(lastName(pid) + ' finishes his warm-up tosses: ' + formName(f) + (ri.txt ? ' (' + ri.txt + ')' : '') + '.');
    showDice(rr, 'Warm-up tosses · ' + lastName(pid) + ' (' + teamCode(side) + '): ' + formName(f)); sfx('warmup');
  }
  if (side === 0 && G.formNeed[1] === 0) stg = 4; else if (side === 0) stg = 2; else stg = 4;
  G.pregame = stg;
  if (stg === 4) G.playTxt = 'Both starters are loose. Click READY TO PLAY.';
}
function pregameSpec() {
  const stg = G.pregame; const side = stg <= 2 ? 0 : 1, who = side === 0 ? 'VISITORS' : 'HOME';
  const pid = curPitcherID(side), ri = restInfo(pid); const rr = (stg === 2 || stg === 4) ? G.wuRoll[side] : 0;
  return { title: 'WARM-UP TOSSES · ' + who, sub: fullName(pid) + ' warms up for ' + teamCode(side) + (ri.txt ? ' · ' + ri.txt + ' (' + Math.round(ri.pen * 100) + '%)' : '') + '. How does he look today?', rows: wuRows(), rr, res: rr > 0 ? wuResult(rr, pid) : '' };
}

// ---- manager actions ----
async function leadPrompt() {
  if (gSim || !popOpt('Big lead pop-ups') || teamOpt('Computer steals', batSideTeam())) return false;
  const bs = G.bases; let bse;
  if (bs[0] && !bs[1]) bse = 1; else if (bs[1] && !bs[2] && !bs[0]) bse = 2; else return false;
  const sig = G.inn + '|' + G.half + '|' + G.outs + '|' + bs.join('|') + '|' + G.next[batSideTeam()];
  if (sig === G.leadSig) return false; G.leadSig = sig;
  const rnr = bs[bse - 1], lead = leadStr(bse); gPitID = curPitcherID(fieldSideTeam());
  let att = num(bRowOf(rnr)[B.SBATT]) * miscB('sbadj', 1); if (bse === 2) att *= miscB('sb3_r', 0.2);
  const p = POP_SHARE * clamp(0.8 * att * leadMult(lead) * pitHold(gPitID) * sitMult(), 0, 0.6);
  if (rand() >= p) return false;
  const ok = await UI.confirm(lastName(rnr) + ' has a' + (lead === 'OK' || !lead ? 'n OK' : ' ' + lead.toUpperCase()) + ' lead off ' + (bse === 1 ? 'first' : 'second') + ' and wants to go.\n\nSteal ' + (bse === 1 ? 'second' : 'third') + ': safe on 1-' + stealSafe(bse) + '.\n\nSend him?', 'He wants to run!', 'SEND HIM', 'Hold him');
  if (ok) { await stealBase(); return true; }
  return false;
}
async function stealBase() {
  if (G.over) return; const bs = G.bases; let bse;
  if (bs[0] && !bs[1]) bse = 1; else if (bs[1] && !bs[2]) bse = 2; else if (bs[2]) bse = 3; else { UI.toast('No runner on base to steal.'); return; }
  gPitID = curPitcherID(fieldSideTeam()); G.xshow = null;
  ensurePitchers(); syncLineupBox(); gExtra = ''; G.extra = '';
  await stealAttempt(bse, false);
  if (G.outs >= 3) endHalf(); else checkWalkoff();
}
function buntRanges(b) {
  const gr = buntGrade(b); let sacTop = gr === 'A' ? 700 : gr === 'B' ? 650 : gr === 'D' ? 520 : 600;
  let s1 = sacTop - 35; const spd = runSpd(b);
  let hw = Math.round((25 + spd * 4) * ((gr === 'A' || gr === 'B') ? 1.2 : 0.8)); hw = clamp(hw, 20, 140);
  if (G.infield === 'Corners in') { sacTop -= 60; s1 -= 60; hw = Math.round(hw * 0.6); }
  const hTop = sacTop + hw, lTop = hTop + Math.round((1000 - hTop) * 0.6);
  return { s1, sacTop, hTop, lTop };
}
async function bunt() {
  if (G.over) return; const bs = G.bases;
  if ((!bs[0] && !bs[1]) || G.outs >= 2) { await buntForHit(); return; }
  ensurePitchers(); syncLineupBox(); gExtra = ''; G.extra = '';
  const side = batSideTeam(); let bslot = G.next[side];
  gBatID = slotID(side, bslot); gPitID = curPitcherID(fieldSideTeam()); const b = gBatID;
  const { s1, sacTop, hTop, lTop } = buntRanges(b); const logStart = G.log.length, outs0 = G.outs, rbi0 = (boxBatFind(b) || { RBI: 0 }).RBI, r0 = (boxBatFind(b) || { R: 0 }).R;
  const rr = await getRoll(lastName(b) + ' bunting (grade ' + buntGrade(b) + '): 1-' + s1 + ' sacrifice, ' + (s1 + 1) + '-' + sacTop + ' error, ' + (sacTop + 1) + '-' + hTop + ' bunt hit, ' + (hTop + 1) + '-' + lTop + ' lead runner out, ' + (lTop + 1) + '-1000 popped up');
  gMainRoll = rr; showDice(rr, 'Roll ' + rr + ' · bunt');
  G.bf[fieldSideTeam()]++; addPit('BF', 1);
  let txt;
  if (rr > s1 && rr <= sacTop) {
    const fx = rr <= s1 + 15 ? 1 : rr <= s1 + 25 ? 5 : 3;
    chargeE(fx); errOut(); gBatErr = true; addBat(b, 'SH', 1);
    txt = 'Error on the bunt by ' + lastName(fx === 1 ? gPitID : defID(fieldSideTeam(), fx)) + '! ' + lastName(b) + ' is safe and the runners move up.';
    if (bs[0]) { if (bs[1]) { if (bs[2]) scoreRun(bs[2], ''); bs[2] = bs[1]; } bs[1] = bs[0]; }
    else if (bs[1] && !bs[2]) { bs[2] = bs[1]; bs[1] = ''; }
    bs[0] = b;
  } else if (rr <= sacTop) {
    recordOut(1); addBat(b, 'SH', 1); txt = lastName(b) + ' lays down a sacrifice bunt. Runners move up.';
    if (G.outs < 3) { if (bs[2]) scoreRun(bs[2], b); bs[2] = bs[1]; bs[1] = bs[0]; bs[0] = ''; }
  } else if (rr <= hTop) {
    addBat(b, 'AB', 1); addBat(b, 'H', 1); addPit('H', 1); addHit(); txt = lastName(b) + " bunts for a hit! Everybody's safe.";
    if (bs[2] && bs[1] && bs[0]) scoreRun(bs[2], b);
    if (bs[0]) { if (bs[1]) bs[2] = bs[1]; bs[1] = bs[0]; }
    bs[0] = b;
  } else if (rr <= lTop) {
    addBat(b, 'AB', 1); recordOut(1); txt = 'Bunt fielded, the lead runner is forced out. ' + lastName(b) + ' safe at first.';
    let fp;
    if (bs[1] && bs[0]) { fp = tagGet(bs[1]); bs[1] = bs[0]; bs[0] = b; }
    else if (bs[1]) { fp = tagGet(bs[1]); bs[1] = ''; bs[0] = b; }
    else { fp = tagGet(bs[0]); bs[0] = b; }
    if (fp) tagPut(b, { pit: fp.pit, un: 0 });
  } else { addBat(b, 'AB', 1); recordOut(1); txt = lastName(b) + ' pops the bunt up. Runners hold.'; }
  sfx(rr > sacTop && rr <= hTop ? 'hit' : rr > s1 && rr <= sacTop ? 'error' : 'out', 0, { home: rr <= hTop ? offHome() : defHome() }); addLog(txt); UI.placeBall(1, 0);
  recordPA(side, bslot, b, logStart, outs0, rbi0, r0);
  bslot++; if (bslot > 9) bslot = 1; G.next[side] = bslot;
  if (!checkWalkoff() && G.outs >= 3) endHalf();
}
async function buntForHit() {
  ensurePitchers(); syncLineupBox(); gExtra = ''; G.extra = '';
  const side = batSideTeam(); let bslot = G.next[side]; const bs = G.bases;
  gBatID = slotID(side, bslot); gPitID = curPitcherID(fieldSideTeam()); const b = gBatID;
  let ph = 0.56, pP = 0.055; const pe = 0.018, gr = buntGrade(b); const logStart = G.log.length, outs0 = G.outs, rbi0 = (boxBatFind(b) || { RBI: 0 }).RBI, r0 = (boxBatFind(b) || { R: 0 }).R;
  ph *= gr === 'A' ? 1 : gr === 'B' ? 0.8 : gr === 'D' ? 0.35 : 0.55;
  const spd = runSpd(b); ph *= clamp(1 + 0.05 * (spd - 12), 0.5, 1.3);
  if (G.infield === 'Corners in') ph *= 0.6; if (infieldIn()) ph *= 0.75;
  ph = clamp(ph, 0.05, 0.75);
  const hTop = Math.round(ph * 1000), eTop = hTop + Math.round(pe * 1000), pTop = eTop + Math.round(pP * 1000);
  const rr = await getRoll(lastName(b) + ' bunting for a hit (grade ' + gr + ', speed ' + spd + '): 1-' + hTop + ' bunt hit, ' + (hTop + 1) + '-' + eTop + ' error, ' + (eTop + 1) + '-' + pTop + ' popped up, ' + (pTop + 1) + '-1000 thrown out');
  gMainRoll = rr; showDice(rr, 'Roll ' + rr + ' · bunt for a hit');
  G.bf[fieldSideTeam()]++; addPit('BF', 1);
  let txt;
  if (rr <= hTop) {
    addBat(b, 'AB', 1); addBat(b, 'H', 1); addPit('H', 1); addHit(); txt = lastName(b) + ' drags a bunt and beats it out for a hit!';
    if (bs[0]) { if (bs[1]) { if (bs[2]) scoreRun(bs[2], b); bs[2] = bs[1]; } bs[1] = bs[0]; }
    bs[0] = b;
  } else if (rr <= eTop) {
    const fx = rr % 2 === 0 ? 5 : 1; addBat(b, 'AB', 1); chargeE(fx); errOut(); gBatErr = true;
    txt = lastName(b) + ' bunts and ' + lastName(fx === 1 ? gPitID : defID(fieldSideTeam(), fx)) + ' throws it away! ' + lastName(b) + ' is safe at first.';
    if (bs[0]) { if (bs[1]) { if (bs[2]) scoreRun(bs[2], ''); bs[2] = bs[1]; } bs[1] = bs[0]; }
    bs[0] = b;
  } else if (rr <= pTop) { addBat(b, 'AB', 1); recordOut(1); txt = lastName(b) + ' pops the bunt up. Caught for the out.'; }
  else { addBat(b, 'AB', 1); recordOut(1); txt = lastName(b) + " bunts, but he's thrown out at first."; }
  sfx(rr <= hTop ? 'hit' : rr <= eTop ? 'error' : 'out', 0, { home: rr <= eTop ? offHome() : defHome() }); addLog(txt); UI.placeBall(1, 0);
  recordPA(side, bslot, b, logStart, outs0, rbi0, r0);
  bslot++; if (bslot > 9) bslot = 1; G.next[side] = bslot;
  if (!checkWalkoff() && G.outs >= 3) endHalf();
}
function intentionalWalk() {
  if (G.over) return; G.xshow = null;
  ensurePitchers(); syncLineupBox(); gExtra = ''; G.extra = '';
  const side = batSideTeam(); let bslot = G.next[side]; const bs = G.bases;
  gBatID = slotID(side, bslot); gPitID = curPitcherID(fieldSideTeam()); const b = gBatID; const logStart = G.log.length, outs0 = G.outs, rbi0 = (boxBatFind(b) || { RBI: 0 }).RBI, r0 = (boxBatFind(b) || { R: 0 }).R;
  addBat(b, 'BB', 1); addPit('BB', 1); addPit('BF', 1); addBat(b, 'IBB', 1); addPit('IBB', 1); G.bf[fieldSideTeam()]++;
  if (bs[0]) { if (bs[1]) { if (bs[2]) scoreRun(bs[2], b); bs[2] = bs[1]; } bs[1] = bs[0]; }
  bs[0] = b;
  addLog(lastName(b) + ' is walked intentionally.'); sfx('walk', 0, { home: offHome() });
  recordPA(side, bslot, b, logStart, outs0, rbi0, r0);
  bslot++; if (bslot > 9) bslot = 1; G.next[side] = bslot;
  checkWalkoff();
}
function pickoffThrow() {
  if (G.over) return;
  if (opt('Pickoffs') !== 'Manual') { UI.toast('Pickoffs are on Automatic: the game handles throws over for you (Options, Pickoffs).'); return; }
  const b = ppBase(); if (b === 0) { UI.toast('No runner to throw over to (runner on first, or on second with third open).'); return; }
  const bs = G.bases, rnr = bs[b - 1]; gPitID = curPitcherID(fieldSideTeam());
  const rule = miscV('pkrule', 0) === 1; const n = G.manThrows + 1;
  ensurePitchers(); gExtra = ''; G.extra = ''; G.manThrows = n;
  let mean = miscV(b === 1 ? 't1_r' : 't2_r', b === 1 ? 0.4 : 0.02); if (mean < 0.05) mean = 0.05;
  const pt = clamp(miscV(b === 1 ? 'po1_r' : 'po2_r', 0.004) / mean * clamp(pitPKF(gPitID), 0.3, 3) * runPKR(rnr) * leadFactor(leadStr(b)), 0, 0.3);
  const pe = clamp(miscV(b === 1 ? 'pe1_r' : 'pe2_r', 0.004) / mean * eFac(gPitID, 1), 0, 0.2);
  const u = rand(); let txt;
  if (u < pt) { bs[b - 1] = ''; recordOut(1); txt = lastName(gPitID) + ' picks ' + lastName(rnr) + ' off ' + (b === 1 ? 'first' : 'second') + '!'; }
  else if (u < pt + pe) { chargeE(1); tagRunners(); if (b === 1) { bs[1] = rnr; bs[0] = ''; } else { bs[2] = rnr; bs[1] = ''; } txt = 'The pickoff throw gets away! ' + lastName(rnr) + ' moves up.'; }
  else if (rule && n >= 3) { addPit('BK', 1); advanceAll(false); txt = 'Third throw over without a pickoff: balk! The runners move up.'; }
  else {
    let li = leadIdx(leadStr(b)); if (rand() < 0.12 * Math.sqrt(clamp(pitPKF(gPitID), 0.3, 3)) && li > 1) li--;
    G.lead[b - 1] = LEADS[li];
    txt = lastName(gPitID) + ' throws over. ' + lastName(rnr) + ' gets back. Lead: ' + LEADS[li] + ' (steal now: safe 1-' + stealSafe(b) + ').';
  }
  addLog(txt);
  if (popOn() && popOpt('Steal and pickoff pop-ups')) UI.popInfo('PICKOFF THROW', lastName(gPitID) + ' throws over to ' + (b === 1 ? 'first' : 'second'), txt);
  if (G.outs >= 3) endHalf();
}
function callPitchout() {
  if (G.over) return; const bs = G.bases;
  if (!bs[0] && !bs[1]) { UI.toast('Nobody on to pitch out against.'); return; }
  G.pitchout = true;
  addLog(lastName(curPitcherID(fieldSideTeam())) + ' and the catcher call a pitchout.');
  UI.toast("Pitchout called for the next pitch. A runner who goes is far more likely to be thrown out; if nobody runs, it's a ball.");
}
function prePitchAction() {
  // dice click: settle the cat and mouse before the pitch. True = stop here (a pop-up is up, or the inning ended)
  if (G.over || G.pend || G.pregame > 0) return false;
  if (ppBase() === 0 || !pkOn()) return false;
  if (G.ppSig === ppSig()) return false;
  ensurePitchers(); syncLineupBox(); gExtra = ''; G.extra = '';
  let stop = prePitch(true);
  if (G.outs >= 3) { endHalf(); stop = true; }
  G.extra = gExtra;
  return stop;
}
