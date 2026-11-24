/* extras.js: the Gazette (a morning paper), the pennant race, awards, lineup announcements, printable cards, ballparks */
'use strict';

// ---------- small helpers ----------
const nickOf = code => { const n = teamFull(code).split(' '); const last = n[n.length - 1]; return (last === 'Sox' || last === 'Jays') ? n.slice(-2).join(' ') : last; };
const cityOf = code => teamCity(code);
const plural = (n, w) => (n === 0 ? 'no' : n) + ' ' + w + (n === 1 ? '' : 's');
const aAn = x => (/^(8|11|18|8\d)/.test(String(x)) ? 'an ' : 'a ') + x;
const poss = n => n + (/s$/.test(n) ? "'" : "'s");
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
// verbs by margin, each with its past tense
const VERBS = {
  rout: [['rout', 'routed'], ['crush', 'crushed'], ['pound', 'pounded'], ['bury', 'buried'], ['hammer', 'hammered'], ['thump', 'thumped'], ['roll past', 'rolled past'], ['maul', 'mauled']],
  big: [['beat', 'beat'], ['handle', 'handled'], ['down', 'downed'], ['top', 'topped'], ['dump', 'dumped'], ['whip', 'whipped'], ['trip', 'tripped'], ['defeat', 'defeated']],
  mid: [['top', 'topped'], ['beat', 'beat'], ['take care of', 'took care of'], ['get past', 'got past'], ['turn back', 'turned back'], ['hold off', 'held off'], ['best', 'bested'], ['get by', 'got by']],
  close: [['edge', 'edged'], ['nip', 'nipped'], ['slip past', 'slipped past'], ['squeeze by', 'squeezed by'], ['sneak past', 'sneaked past'], ['shade', 'shaded'], ['hold off', 'held off'], ['escape', 'escaped']]
};
const teamStreak = code => { let n = 0, won = null; for (let i = S.results.length - 1; i >= 0; i--) { const r = S.results[i]; if (r.away !== code && r.home !== code) continue; const w = (r.ra > r.rh ? r.away : r.home) === code; if (won === null) won = w; if (w !== won) break; n++; } return { n, won }; };
const hitLine = x => `${x.H}-for-${x.AB}` + (x.HR ? ` with ${x.HR === 1 ? 'a homer' : x.HR + ' homers'}` : x['2B'] >= 2 ? ` with ${x['2B']} doubles` : x['3B'] ? ' with a triple' : '') + (x.RBI ? ` and ${plural(x.RBI, 'RBI').replace('RBIs', 'RBI')}` : '');
const hitLineLong = x => `${x.H}-for-${x.AB}` + (x.HR ? ` with ${x.HR === 1 ? 'a home run' : x.HR + ' home runs'}` : x['2B'] >= 2 ? ` with ${x['2B']} doubles` : x['3B'] ? ' with a triple' : '') + (x.RBI ? ` and ${x.RBI} ${x.RBI === 1 ? 'run batted in' : 'runs batted in'}` : '');
function makePaper() {
  const w = G.score[0] > G.score[1] ? 0 : 1, l = 1 - w;
  const wc = teamCode(w), lc = teamCode(l), wn = nickOf(wc), ln = nickOf(lc), sw = G.score[w], sl = G.score[l], margin = sw - sl;
  const bat = G.boxBat, pit = G.boxPit;
  // the man of the match
  const hit = bat.filter(b => b.team === wc).map(b => ({ b, sc: b.HR * 4 + b.RBI * 2 + b.H + b['2B'] + b['3B'] * 2 + b.R + b.SB })).sort((a, b) => b.sc - a.sc)[0];
  const H = hit ? hit.b : null;
  const lh = bat.filter(x => x.team === lc).sort((x, y) => (y.HR * 4 + y.RBI * 2 + y.H) - (x.HR * 4 + x.RBI * 2 + x.H))[0];
  const wp = pit.find(p => p.W), lp = pit.find(p => p.L), sv = pit.find(p => p.SV);
  const starterW = pit.find(p => p.team === wc && p.GS), starterL = pit.find(p => p.team === lc && p.GS);
  const relW = pit.filter(p => p.team === wc && !p.GS), relL = pit.filter(p => p.team === lc && !p.GS);
  // the shape of the game
  const cumW = [], cumL = []; let a = 0, b = 0, maxDeficit = 0, lateDeficit = 0, leadChanges = 0, lastLead = 0, wLedAll = true;
  for (let i = 0; i < G.inn; i++) {
    a += G.innRuns[w][i] || 0; b += G.innRuns[l][i] || 0; cumW.push(a); cumL.push(b);
    if (b - a > maxDeficit) { maxDeficit = b - a; if (i >= 5) lateDeficit = b - a; }
    const ld = Math.sign(a - b); if (ld && lastLead && ld !== lastLead) leadChanges++; if (ld) lastLead = ld;
    if (b > a) wLedAll = false;
  }
  const shutout = sl === 0, extra = G.inn > 9, walkoff = !!G.walkoff, comeback = lateDeficit >= 3, blowout = margin >= 7, oneRun = margin === 1;
  const cg = pit.find(p => p.team === wc && p.CG);
  const lastPA = G.pa.filter(p => p.s === w).slice(-1)[0];
  const lastHitWord = lastPA ? ({ HR: 'homer', '2B': 'double', '3B': 'triple', '1B': 'single' })[lastPA.code] : '';
  const totalHits = G.hits[0] + G.hits[1], slugfest = sw + sl >= 15, duel = sw + sl <= 3 && !shutout;
  const seesaw = leadChanges >= 3;
  const stk = G.sched >= 0 && !G.exhib ? teamStreak(wc) : { n: 0 }, lstk = G.sched >= 0 && !G.exhib ? teamStreak(lc) : { n: 0 };
  const bpBlown = starterL && starterL !== lp && lp && !lp.GS && (() => { let lead = 0; for (let i = 0; i < G.inn; i++) { if (cumL[i] > cumW[i]) lead = 1; } return lead && lateDeficit === 0 && cumL[5] > cumW[5]; })();
  const hrW = bat.filter(x => x.team === wc).reduce((s, x) => s + x.HR, 0), hrAll = hrW + bat.filter(x => x.team === lc).reduce((s, x) => s + x.HR, 0);
  const Hn = H ? lastName(H.id) : '', Hf = H ? fullName(H.id) : '';
  // verb
  const vb = pick(margin >= 7 ? VERBS.rout : margin >= 4 ? VERBS.big : margin >= 2 ? VERBS.mid : VERBS.close);
  const verb = vb[0], verbed = vb[1];
  // headline: collect every angle that applies, forced angles first, then pick
  const forced = [], angles = [];
  if (pit.some(x => x.CG && x.H === 0)) { const nh = pit.find(x => x.CG && x.H === 0); forced.push(pick([`NO-HITTER! ${lastName(nh.id)} makes history against ${ln}`, `${lastName(nh.id)} throws a no-hitter at ${ln}`, `No hits: ${lastName(nh.id)} silences ${ln}`])); }
  if (walkoff && lastPA && lastHitWord) forced.push(pick([`${poss(lastName(lastPA.id))} ${lastHitWord} in the ${ordinal(G.inn)} walks ${wn} off past ${ln}`, `${lastName(lastPA.id)} ends it: ${wn} walk off ${ln} in the ${ordinal(G.inn)}`, `Walk-off ${lastHitWord} by ${lastName(lastPA.id)} lifts ${wn} over ${ln}`, `${wn} win it in the ${ordinal(G.inn)} on ${poss(lastName(lastPA.id))} ${lastHitWord}`]));
  else if (walkoff) forced.push(pick([`${wn} walk off ${ln} in the ${ordinal(G.inn)}`, `Last licks: ${wn} beat ${ln} in the bottom of the ${ordinal(G.inn)}`, `${wn} send ${ln} home with a ${ordinal(G.inn)}-inning rally`]));
  if (shutout && cg) angles.push(pick([`${lastName(cg.id)} blanks ${ln} on ${plural(cg.H, 'hit')}`, `${lastName(cg.id)} shuts out ${ln}, ${sw}-${sl}`, `${plural(cg.H, 'hit')}, no runs: ${lastName(cg.id)} handcuffs ${ln}`, `${lastName(cg.id)} goes the distance as ${wn} blank ${ln}`, `${lastName(cg.id)} whitewashes ${ln}`]));
  else if (shutout) angles.push(pick([`${wn} shut out ${ln}, ${sw}-${sl}`, `${wn} pitching blanks ${ln}`, `${wn} ${verb} ${ln}, ${sw}-${sl}, behind ${lastName((starterW || wp).id)}`, `${ln} go quietly, ${sw}-${sl}`]));
  if (H && H.HR >= 2) angles.push(pick([`${Hn} homers ${H.HR === 2 ? 'twice' : wordNum(H.HR) + ' times'} as ${wn} ${verb} ${ln}`, `Two-homer night for ${Hn} sinks ${ln}`.replace('Two-homer', H.HR === 2 ? 'Two-homer' : wordNum(H.HR).charAt(0).toUpperCase() + wordNum(H.HR).slice(1) + '-homer'), `${Hn} goes deep ${H.HR === 2 ? 'twice' : wordNum(H.HR) + ' times'}; ${wn} ${verb} ${ln} ${sw}-${sl}`, `${wn} ride ${poss(Hn)} ${H.HR} homers past ${ln}`]));
  if (comeback) angles.push(pick([`${wn} rally from ${lateDeficit} down to stun ${ln}`, `Down ${lateDeficit}, ${wn} storm back to beat ${ln}`, `${wn} erase ${lateDeficit}-run deficit, shock ${ln}`, `Late ${wn} rally sinks ${ln}`, `${ln} let ${lateDeficit}-run lead get away`]));
  if (extra) angles.push(pick([`${wn} outlast ${ln} in ${G.inn} innings`, `${wn} win ${G.inn}-inning marathon over ${ln}`, `${G.inn} innings later, ${wn} beat ${ln}`, `${wn} ${verb} ${ln} in ${G.inn}`, `Extra innings, same result: ${wn} top ${ln}`]));
  if (bpBlown) angles.push(pick([`${ln} bullpen coughs it up; ${wn} win ${sw}-${sl}`, `${wn} get to ${ln} relievers late`, `${lastName(lp.id)} can't hold it, ${wn} ${verb} ${ln}`]));
  if (slugfest) angles.push(pick([`${wn} outslug ${ln}, ${sw}-${sl}`, `${sw + sl} runs, ${totalHits} hits: ${wn} survive slugfest with ${ln}`, `${wn} win a wild one over ${ln}, ${sw}-${sl}`, `Bats boom as ${wn} ${verb} ${ln}`]));
  if (duel && starterW && starterL) angles.push(pick([`${lastName(starterW.id)} wins duel with ${lastName(starterL.id)}, ${sw}-${sl}`, `Pitchers' duel goes to ${wn}, ${sw}-${sl}`, `${wn} scratch out ${sw}-${sl} win over ${ln}`]));
  if (seesaw) angles.push(pick([`${wn} take see-saw battle from ${ln}`, `Lead changes hands ${leadChanges} times; ${wn} get the last one`, `${wn} win a back-and-forth game with ${ln}`]));
  if (blowout) angles.push(pick([`${wn} ${verb} ${ln}, ${sw}-${sl}`, `${wn} run away from ${ln}`, `Laugher: ${wn} ${verb} ${ln} ${sw}-${sl}`, `${wn} pile on ${ln}, ${sw}-${sl}`, `No contest: ${wn} ${sw}, ${ln} ${sl}`]));
  if (H && H.RBI >= 4) angles.push(pick([`${Hn} drives in ${H.RBI} as ${wn} ${verb} ${ln}`, `${poss(Hn)} ${H.RBI} RBI carry ${wn} past ${ln}`, `${Hn} knocks in ${H.RBI}; ${wn} ${verb} ${ln}`, `Big night for ${Hn}: ${H.RBI} RBI in ${wn} win`]));
  if (H && H.H >= 4) angles.push(pick([`${Hn} collects ${H.H} hits as ${wn} ${verb} ${ln}`, `${H.H}-hit game by ${Hn} leads ${wn}`, `${Hn} ${H.H}-for-${H.AB}; ${wn} ${verb} ${ln}`]));
  if (starterW && starterW.K >= 10) angles.push(pick([`${lastName(starterW.id)} fans ${starterW.K} as ${wn} ${verb} ${ln}`, `${starterW.K} strikeouts for ${lastName(starterW.id)} in ${wn} win`, `${lastName(starterW.id)} strikes out ${starterW.K}, ${wn} ${verb} ${ln}`]));
  if (stk.n >= 5 && stk.won) angles.push(pick([`${wn} make it ${stk.n} straight, ${verb} ${ln}`, `${wn} win ${stk.n}th in a row`, `Streaking ${wn} ${verb} ${ln} for No. ${stk.n}`, `${wn} ${verb} ${ln}; streak hits ${stk.n}`]));
  if (lstk.n >= 5 && !lstk.won) angles.push(pick([`${ln} lose ${lstk.n}th straight`, `${ln} skid reaches ${lstk.n} as ${wn} ${verb} them`, `No relief for ${ln}: ${lstk.n} losses in a row`]));
  if (stk.n === 1 && stk.won && S.results.length > 3) { /* a losing streak snapped? look back past this game */ let n = 0; for (let i = S.results.length - 2; i >= 0; i--) { const r = S.results[i]; if (r.away !== wc && r.home !== wc) continue; if ((r.ra > r.rh ? r.away : r.home) === wc) break; n++; } if (n >= 4) angles.push(pick([`${wn} snap ${n}-game skid, ${verb} ${ln}`, `${wn} finally win one, ${verb} ${ln} to end ${n}-game slide`, `Slide over: ${wn} ${verb} ${ln}`])); }
  if (oneRun && !walkoff && !extra) angles.push(pick([`${wn} ${verb} ${ln} by a run`, `${wn} hang on, ${verb} ${ln} ${sw}-${sl}`, `One-run win for ${wn} over ${ln}`, `${wn} ${sw}, ${ln} ${sl}: just enough`]));
  if (hrW >= 3) angles.push(pick([`${wn} hit ${hrW} homers, ${verb} ${ln}`, `${hrW} home runs power ${wn} past ${ln}`, `Long-ball ${wn} ${verb} ${ln}`]));
  if (sv && sv.OUTS >= 6) angles.push(pick([`${lastName(sv.id)} slams door as ${wn} ${verb} ${ln}`, `${wn} ${verb} ${ln}; ${lastName(sv.id)} saves it`]));
  // generic fallbacks
  const generic = [`${wn} ${verb} ${ln}, ${sw}-${sl}`, `${wn} ${verb} ${ln}, ${sw}-${sl}`, `${wn} ${sw}, ${ln} ${sl}`, `${wn} ${verb} ${ln} behind ${lastName((wp || starterW || { id: '' }).id)}`.replace(' behind ?', ''), H && H.H >= 2 ? `${Hn} leads ${wn} past ${ln}` : `${wn} ${verb} ${ln} at ${parkName()}`, `${wn} ${verb} ${ln} ${sw}-${sl}${G.sched >= 0 ? (w === 1 ? ' at home' : ' on the road') : ''}`];
  let head = forced.length ? forced[0] : angles.length ? pick(angles) : pick(generic);
  head = head.charAt(0).toUpperCase() + head.slice(1);
  // deck: two or three bits, in varying shapes
  const deckBits = [];
  if (H && H.H > 0) deckBits.push(pick([`${Hn} ${hitLine(H)}`, `${Hn} ${hitLine(H)}`, `${plural(H.H, 'hit')}${H.RBI ? ', ' + H.RBI + ' RBI' : ''} for ${Hn}`, H.HR ? `${Hn} goes deep${H.HR > 1 ? ' ' + wordNum(H.HR) + ' times' : ''}` : `${Hn} ${hitLine(H)}`]));
  if (wp) deckBits.push(wp.OUTS >= 18 ? pick([`${lastName(wp.id)} goes ${ipTxt(wp.OUTS).replace('.0', '')} strong`, `${lastName(wp.id)} works ${ipTxt(wp.OUTS).replace('.0', '')}, ${wp.R === 0 ? 'no runs' : 'allows ' + plural(wp.R, 'run')}`, wp.K >= 7 ? `${lastName(wp.id)} fans ${wp.K}` : `${lastName(wp.id)} now ${replayPit(wp.id, 'W')}-${replayPit(wp.id, 'L')}`]) : pick([`${lastName(wp.id)} gets the win`, `Win goes to ${lastName(wp.id)}`, `${lastName(wp.id)} picks up the W in relief`]));
  if (sv && rand() < 0.5) deckBits.push(pick([`${lastName(sv.id)} saves`, `${ordinal(replayPit(sv.id, 'SV'))} save for ${lastName(sv.id)}`]));
  else if (lp && rand() < 0.35) deckBits.push(pick([`${lastName(lp.id)} takes the loss`, `${lastName(lp.id)} falls to ${replayPit(lp.id, 'W')}-${replayPit(lp.id, 'L')}`]));
  const deck = deckBits.slice(0, 3).join(' · ');
  // paragraphs
  const city = cityOf(teamCode(1)).toUpperCase();
  const dateTxt = G.sched >= 0 ? gameDate() : 'Today';
  const when = dateTxt === 'Today' ? 'today' : pick(['on ' + dateTxt, G.dayNo ? gameDOW() + (G.dh === 2 ? ' night' : '') : 'on ' + dateTxt, 'here']);
  const where = pick([`at ${parkName()}`, `at ${parkName()}`, G.att ? `before ${fmtNum(G.att)} at ${parkName()}` : `before the ${parkName()} crowd`, G.att ? `in front of ${fmtNum(G.att)}${G.attNote.includes('sellout') || G.attNote.includes('Opening') ? ', a sellout,' : ''} at ${parkName()}` : (w === 1 ? 'at home' : 'on the road'), G.dh ? `in the ${G.dh === 1 ? 'opener' : 'nightcap'} of a doubleheader at ${parkName()}` : `at ${parkName()}`]);
  const P = [];
  const wf = teamFull(wc), lf = teamFull(lc), scoreTxt = `${sw}-${sl}${extra ? ` in ${G.inn} innings` : ''}`;
  const ledeShapes = [
    () => `${city} — The ${wf} ${verbed} the ${lf} ${scoreTxt} ${where} ${when}`,
    () => `${city} — The ${wf} ${verbed} the ${lf} ${scoreTxt} ${where} ${when}`,
    () => `${city} — ${H && H.H > 0 ? `${Hf} went ${hitLineLong(H)} and the` : 'The'} ${wf} ${verbed} the ${lf} ${scoreTxt} ${when}`,
    () => `${city} — Behind ${wp ? fullName(wp.id) : 'their pitching'}${H && H.H > 0 ? ' and ' + Hf : ''}, the ${wf} ${verbed} the ${lf} ${scoreTxt} ${where} ${when}`,
    () => `${city} — It was the ${wn} ${sw}, the ${ln} ${sl} ${where} ${when}${extra ? ', ' + G.inn + ' innings' : ''}`,
    () => w === 1 ? `${city} — The ${lf} came to ${parkName()} ${when} and went home ${margin >= 4 ? 'beaten' : 'beaten by ' + (oneRun ? 'a run' : margin + ' runs')}, ${sw}-${sl}, by the ${wf}` : `${city} — The ${wf} came into ${parkName()} ${when} and left with ${aAn(sw + '-' + sl)} win over the ${lf}`,
    () => `${city} — ${comeback ? `Trailing by ${lateDeficit}, the` : wLedAll && !oneRun ? 'Never trailing, the' : seesaw ? 'In a game that changed hands ' + wordNum(leadChanges) + ' times, the' : 'The'} ${wf} ${verbed} the ${lf} ${scoreTxt} ${when}`,
    () => `${city} — ${plural(G.hits[w], 'hit')}, ${plural(sw, 'run')}: the ${wf} ${verbed} the ${lf} ${scoreTxt} ${where} ${when}`
  ];
  let p1 = pick(ledeShapes)();
  if (walkoff && lastPA) p1 += pick([`, ending it on ${paPhrase(lastPA).replace(/^an? /, 'a ').replace('a a', 'a')} in the bottom of the ${ordinal(G.inn)}`, `, winning it on ${paPhrase(lastPA).replace(/^an? /, 'a ').replace('a a', 'a')} with the crowd on its feet in the ${ordinal(G.inn)}`]);
  p1 += '.';
  if (H && H.H > 0 && !p1.includes(Hf)) p1 += ' ' + pick([`${Hf} led the way, going ${hitLineLong(H)}.`, `${Hf} was the big bat, ${hitLine(H)}.`, `${Hf} went ${hitLineLong(H)}.`, `The ${wn} got ${hitLineLong(H)} from ${Hf}.`, H.HR ? `${Hf} hit ${H.HR === 1 ? 'a home run' : H.HR + ' home runs'}${H.RBI > H.HR ? ' and drove in ' + H.RBI : ''}.` : `${Hf} had ${plural(H.H, 'hit')}${H.RBI ? ' and ' + plural(H.RBI, 'RBI').replace('RBIs', 'RBI') : ''}.`]);
  if (comeback) p1 += ' ' + pick([`The ${wn} had trailed by ${lateDeficit} after ${plural(cumW.findIndex((v, i) => cumL[i] - v === lateDeficit) + 1, 'inning')}.`, `They did it the hard way, down ${lateDeficit} as late as the ${ordinal(cumW.findIndex((v, i) => cumL[i] - v === lateDeficit) + 1)}.`, `A ${lateDeficit}-run deficit in the ${ordinal(cumW.findIndex((v, i) => cumL[i] - v === lateDeficit) + 1)} did not hold up.`]);
  else if (wLedAll && !oneRun && margin >= 3 && rand() < 0.5) p1 += ' ' + pick([`The ${wn} never trailed.`, `The ${wn} led from the start.`, `It was never much of a contest after the ${ordinal(cumW.findIndex((v, i) => v > cumL[i]) + 1)}.`]);
  else if (seesaw && rand() < 0.7) p1 += ' ' + pick([`The lead changed hands ${wordNum(leadChanges)} times.`, `Neither club could hold a lead until the ${wn} finally did.`]);
  P.push(p1);
  // the big inning
  let bigI = 0; for (let i = 1; i < G.inn; i++) if ((G.innRuns[w][i] || 0) > (G.innRuns[w][bigI] || 0)) bigI = i;
  const bigRuns = G.innRuns[w][bigI] || 0, bigOrd = ordinal(bigI + 1);
  if (bigRuns > 0) {
    const plays = G.pa.filter(p => p.s === w && p.inn === bigI + 1 && p.rbi > 0).map(paPhrase);
    const wasBehind = cumW[bigI] - bigRuns < cumL[bigI], wasTied = cumW[bigI] - bigRuns === cumL[bigI];
    let p2 = bigRuns >= 4 ? pick([`The ${wn} broke it open with ${wordNum(bigRuns)} in the ${bigOrd}`, `A ${wordNum(bigRuns)}-run ${bigOrd} settled it`, `The ${wn} sent ${bigRuns + 4} men to the plate in the ${bigOrd} and scored ${wordNum(bigRuns)}`, `${wordNum(bigRuns).charAt(0).toUpperCase() + wordNum(bigRuns).slice(1)} runs in the ${bigOrd} put it away`, `The game turned in the ${bigOrd}, when the ${wn} batted around and scored ${wordNum(bigRuns)}`]) :
      bigRuns === 3 ? pick([`The ${wn} broke it open with three in the ${bigOrd}`, `A three-run ${bigOrd} ${wasBehind ? 'turned it around' : wasTied ? 'broke the tie' : 'put it out of reach'}`, `Three in the ${bigOrd} did the damage`, `The ${wn} did most of their work in the ${bigOrd}`]) :
      bigRuns === 2 ? pick([`The ${wn} got two in the ${bigOrd}`, `A two-run ${bigOrd} ${wasBehind ? 'put the ' + wn + ' ahead' : wasTied ? 'broke a tie' : 'was the big inning'}`, `The ${bigOrd} was the big inning`, `Two in the ${bigOrd} ${margin <= 2 ? 'proved to be the difference' : 'got the ' + wn + ' going'}`]) :
      pick([`The ${wn}' big blow came in the ${bigOrd}`, `The ${wn} scored ${sw === 1 ? 'their only run' : 'in the ' + bigOrd}`.replace('in the ' + bigOrd, 'one at a time, starting in the ' + bigOrd), `The winning run came in the ${ordinal(Math.max(0, cumW.findIndex(v => v > sl)) + 1)}`]);
    if (plays.length) p2 += pick([': ', ': ', ', on ', '. The runs came on ']) + (plays.length === 1 ? plays[0] : plays.slice(0, -1).join(', ') + ' and ' + plays[plays.length - 1]);
    p2 += '.';
    if (sl > 0 && lh && lh.H > 0) p2 += ' ' + pick([`For the ${ln}, ${fullName(lh.id)} went ${hitLine(lh)}.`, `${fullName(lh.id)} had ${plural(lh.H, 'hit')}${lh.HR ? ', including a homer,' : ''} for the ${ln}.`, `The ${ln} got ${hitLine(lh)} from ${fullName(lh.id)}${margin >= 4 ? ', and not much else' : ''}.`, `${fullName(lh.id)} (${lh.H}-for-${lh.AB}${lh.HR ? ', HR' : ''}${lh.RBI ? ', ' + lh.RBI + ' RBI' : ''}) led the ${ln}.`]);
    else if (sl === 0 && rand() < 0.6) p2 += ' ' + pick([`The ${ln} managed ${plural(G.hits[l], 'hit')}${G.hits[l] <= 3 ? ' all night' : ''} and never got a runner home.`, `The ${ln} left ${G.lob[l]} on base.`, `${plural(G.hits[l], 'hit')} and ${plural(G.lob[l], 'runner')} stranded for the ${ln}.`]);
    P.push(p2);
  }
  // pitching
  let p3 = '';
  const wpRec = wp ? `(${replayPit(wp.id, 'W')}-${replayPit(wp.id, 'L')})` : '';
  if (wp && wp.GS) p3 += pick([
    `${fullName(wp.id)} ${wpRec} went ${ipTxt(wp.OUTS)} innings, allowing ${plural(wp.H, 'hit')} and ${plural(wp.R, 'run')}${wp.K ? ' while striking out ' + wp.K : ''}.`,
    `${fullName(wp.id)} ${wpRec} ${wp.CG ? 'went the distance' : 'worked ' + ipTxt(wp.OUTS) + ' innings'}, scattering ${plural(wp.H, 'hit')}${wp.BB ? ' and walking ' + wp.BB : ''}${wp.K ? ' and fanning ' + wp.K : ''}.`.replace('scattering 0 hits', 'allowing no hits'),
    `The win went to ${fullName(wp.id)} ${wpRec}: ${ipTxt(wp.OUTS)} innings, ${plural(wp.H, 'hit')}, ${plural(wp.R, 'run')}${wp.K ? ', ' + plural(wp.K, 'strikeout') : ''}.`,
    `${fullName(wp.id)} ${wpRec} ${wp.R <= 1 ? 'was in command' : wp.R <= 3 ? 'was good enough' : 'got the win despite ' + plural(wp.R, 'run') + ' allowed'}, ${wp.R <= 3 ? 'giving up ' + plural(wp.R, 'run') + ' in ' + ipTxt(wp.OUTS) + ' innings' : 'lasting ' + ipTxt(wp.OUTS) + ' innings'}${wp.K >= 6 ? ' with ' + plural(wp.K, 'strikeout') : ''}.`,
    `${fullName(wp.id)} picked up his ${ordinal(replayPit(wp.id, 'W'))} win, going ${ipTxt(wp.OUTS)} innings and allowing ${plural(wp.R, 'run')} on ${plural(wp.H, 'hit')}.`
  ]);
  else if (wp) p3 += pick([`${fullName(wp.id)} ${wpRec} picked up the win in relief.`, `${fullName(wp.id)} ${wpRec} got the win with ${ipTxt(wp.OUTS)} innings out of the bullpen.`, `The win went to reliever ${fullName(wp.id)} ${wpRec}${starterW ? ' after ' + lastName(starterW.id) + ' left after ' + ipTxt(starterW.OUTS) + ' innings' : ''}.`]);
  if (sv) p3 += ' ' + pick([`${fullName(sv.id)} got his ${ordinal(replayPit(sv.id, 'SV'))} save.`, `${fullName(sv.id)} finished for his ${ordinal(replayPit(sv.id, 'SV'))} save.`, `${fullName(sv.id)} ${sv.OUTS >= 6 ? 'worked the last ' + ipTxt(sv.OUTS) + ' innings' : 'closed it out'} for save No. ${replayPit(sv.id, 'SV')}.`, sv.K >= 2 ? `${fullName(sv.id)} struck out ${sv.K} in nailing down his ${ordinal(replayPit(sv.id, 'SV'))} save.` : `${fullName(sv.id)} saved it, his ${ordinal(replayPit(sv.id, 'SV'))}.`]);
  else if (wp && wp.GS && !wp.CG && relW.length && rand() < 0.5) { const lastR = relW[relW.length - 1]; p3 += ' ' + pick([relW.length >= 2 ? `${plural(relW.length, 'reliever')} finished up.` : `${lastName(lastR.id)} finished up.`, `${lastName(lastR.id)} got the last ${lastR.OUTS === 3 ? 'three outs' : plural(lastR.OUTS, 'out')}.`, `The bullpen handled the rest.`]); }
  if (lp) { const lpRec = `(${replayPit(lp.id, 'W')}-${replayPit(lp.id, 'L')})`; p3 += ' ' + (lp.GS ? pick([
    `${fullName(lp.id)} ${lpRec} took the loss, giving up ${plural(lp.R, 'run')} in ${ipTxt(lp.OUTS)} innings.`,
    `${fullName(lp.id)} ${lpRec} ${lp.OUTS < 12 ? 'did not get out of the ' + ordinal(Math.floor(lp.OUTS / 3) + 1) : 'lasted ' + ipTxt(lp.OUTS) + ' innings'} and took the loss.`,
    `The loss went to ${fullName(lp.id)} ${lpRec}, who allowed ${plural(lp.R, 'run')} on ${plural(lp.H, 'hit')}${lp.BB >= 3 ? ' and walked ' + lp.BB : ''}.`,
    lp.R >= 6 ? `${fullName(lp.id)} ${lpRec} was hit hard: ${plural(lp.R, 'run')} and ${plural(lp.H, 'hit')} in ${ipTxt(lp.OUTS)} innings.` : `${fullName(lp.id)} ${lpRec} was the loser despite ${lp.R <= 3 ? 'a decent outing' : 'getting through ' + ipTxt(lp.OUTS) + ' innings'}.`
  ]) : pick([`${fullName(lp.id)} ${lpRec} took the loss in relief.`, `The loss went to ${fullName(lp.id)} ${lpRec}, who gave up ${plural(lp.R, 'run')} in ${ipTxt(lp.OUTS)} innings of relief.`, `${fullName(lp.id)} ${lpRec} was charged with the loss.`])); }
  if (starterL && starterL !== lp && starterL.OUTS >= 15 && starterL.R <= 2) p3 += ' ' + pick([`${lastName(starterL.id)} deserved better for the ${ln}: ${ipTxt(starterL.OUTS)} innings, ${plural(starterL.R, 'run')}.`, `${ln} starter ${lastName(starterL.id)} left with a no-decision after ${ipTxt(starterL.OUTS)} fine innings.`, `It was a wasted start by ${lastName(starterL.id)}, who gave the ${ln} ${ipTxt(starterL.OUTS)} innings of ${starterL.R === 0 ? 'shutout' : starterL.R + '-run'} ball.`]);
  if (starterW && starterW !== wp && !starterW.W && starterW.OUTS >= 18 && rand() < 0.6) p3 += ' ' + pick([`${lastName(starterW.id)} started for the ${wn} and left with a no-decision after ${ipTxt(starterW.OUTS)} innings.`, `${wn} starter ${lastName(starterW.id)} went ${ipTxt(starterW.OUTS)} but got no decision.`]);
  if (p3) P.push(p3);
  // a word from the dugout (templated, but it reads like a quote)
  if (rand() < 0.55) {
    const q = H && H.H > 0 && rand() < 0.5 ? pick([`"${Hn} carried us tonight," the ${wn} manager said. "When he's swinging like that, we're tough."`, `"I'd like to say we planned it," said the ${wn} manager, "but ${Hn} just hit everything they threw."`, `"${Hn} was locked in," the ${wn} skipper said. "You could see it from the first at-bat."`]) :
      comeback ? pick([`"Nobody in that dugout thought we were done," the ${wn} manager said.`, `"That's a game you remember," the ${wn} manager said. "Down ${lateDeficit} and we just kept coming."`, `"We stole one," the ${wn} manager admitted. "They had us."`]) :
      shutout && wp ? pick([`"${lastName(wp.id)} had everything working," the ${wn} manager said. "They never had a chance."`, `"You don't need much offense when ${lastName(wp.id)} pitches like that," the ${wn} manager said.`]) :
      blowout ? pick([`"Some nights it all goes your way," the ${wn} manager said. "This was one of them."`, `"Hit the ball, catch the ball, that's all it was," the ${wn} manager said.`, `"We'd like to spread those runs out over the week," the ${wn} manager joked.`]) :
      oneRun ? pick([`"Every one of these counts the same in the standings," the ${wn} manager said.`, `"I'd rather win them ugly than lose them pretty," the ${wn} manager said.`, `"That one took a year off my life," the ${wn} manager said.`]) :
      lstk.n >= 4 && !lstk.won ? pick([`"We'll keep showing up," the ${ln} manager said. "That's all you can do."`, `"Nobody's happy," the ${ln} manager said. "But it's a long season."`]) :
      pick([`"A win's a win," the ${wn} manager said.`, `"We did the little things," the ${wn} manager said. "That's how you win in this league."`, `"We got the pitching and just enough hitting," the ${wn} manager said.`, `"They're a good club," the ${ln} manager said. "They beat us tonight; we'll see them again."`, `"Good game, bad result," the ${ln} manager said.`]);
    P.push(q);
  }
  // notes
  const notes = [];
  for (const x of bat) { const s = S.seasonBat[x.id]; if (s && s.streak >= 8 && x.H > 0) notes.push(pick([`${lastName(x.id)} extended his hitting streak to ${s.streak} games.`, `Hitting streak watch: ${lastName(x.id)} is now at ${s.streak} games.`, `${s.streak} straight games with a hit for ${lastName(x.id)}.`])); }
  for (const x of bat) if (x.H >= 4) notes.push(pick([`${fullName(x.id)} had a ${x.H}-hit game.`, `${x.H} hits for ${fullName(x.id)}, a season high for him.`.replace(', a season high for him', ''), `${fullName(x.id)} went ${x.H}-for-${x.AB}.`]));
  for (const x of pit) if (x.K >= 10) notes.push(pick([`${fullName(x.id)} struck out ${x.K}.`, `${x.K} strikeouts for ${fullName(x.id)}.`, `${fullName(x.id)} fanned ${x.K} ${x.team === wc ? ln : wn}.`]));
  for (const x of bat) if (x.SB >= 2) notes.push(pick([`${lastName(x.id)} stole ${x.SB} bases.`, `${plural(x.SB, 'stolen base')} for ${lastName(x.id)}.`]));
  for (const x of bat) if (x.HR >= 1 && x.AB && rand() < 0.3 && x.id !== (H && H.id)) notes.push(`${poss(lastName(x.id))} homer was his ${ordinal(replayBat(x.id, 'HR'))} of the year.`);
  if (H && H.HR >= 1) notes.push(`${Hn} now has ${plural(replayBat(H.id, 'HR'), 'home run')} on the season.`);
  for (const x of pit) if (x.BB >= 5) notes.push(`${lastName(x.id)} walked ${x.BB}.`);
  if (hrAll === 0 && totalHits >= 20) notes.push(`${totalHits} hits between the clubs and not one of them left the park.`);
  if (G.lob[l] >= 10) notes.push(pick([`The ${ln} stranded ${G.lob[l]} runners.`, `${G.lob[l]} left on base for the ${ln}, which tells the story.`]));
  if (G.lob[w] >= 11) notes.push(`The ${wn} won despite leaving ${G.lob[w]} on base.`);
  const R = S.records || {}; for (const k of ['longhr', 'hits', 'hr', 'rbi', 'k', 'runs', 'blowout', 'innings']) if (R[k] && R[k].game === G.gameNo) notes.push(pick(['A season record: ', 'New season high: ', 'For the record book: ']) + `${{ longhr: 'longest home run', hits: 'most hits in a game', hr: 'most homers in a game', rbi: 'most RBI in a game', k: 'most strikeouts by a pitcher', runs: 'most runs by a team', blowout: 'biggest margin', innings: 'longest game' }[k]}, ${R[k].v}${R[k].extra ? ' (' + R[k].extra + ')' : ''}, by ${R[k].who}.`);
  for (const x of pit) if (x.CG && x.H === 0) notes.unshift(`NO-HITTER: ${fullName(x.id)} did not allow a hit${x.BB === 0 ? ' or a walk. A perfect game' : x.BB ? ', walking ' + x.BB : ''}.`);
  if (G.errs[w] + G.errs[l] >= 4) notes.push(pick([`A sloppy one: ${G.errs[0] + G.errs[1]} errors in all.`, `The gloves were not good: ${G.errs[0] + G.errs[1]} errors between the two clubs.`]));
  else if (G.errs[l] >= 3) notes.push(`The ${ln} made ${G.errs[l]} errors.`);
  if (G.weather && G.weather.dir !== 'Dome' && G.weather.temp <= 45) notes.push(`Game-time temperature was ${G.weather.temp}°.`);
  if (G.weather && G.weather.dir === 'Rain') notes.push(pick([`They played through a light rain.`, `A steady drizzle kept the crowd down.`]));
  if (G.att && G.attNote && /Day|Night/.test(G.attNote)) notes.push(`It was ${G.attNote.split(', ').find(x => /Day|Night/.test(x))} at ${parkName()}.`);
  if (G.att && /sellout|Opening/.test(G.attNote)) notes.push(pick([`The crowd of ${fmtNum(G.att)} was a sellout.`, `A full house: ${fmtNum(G.att)}.`]));
  else if (G.att && G.att < 5000) notes.push(pick([`Only ${fmtNum(G.att)} turned out.`, `The announced crowd was ${fmtNum(G.att)}, and that may have been generous.`]));
  if (G.dh === 1) notes.push(`The clubs play the second game of the doubleheader next.`);
  if (G.dh === 2) notes.push(`The game made up the ${D.schedule[G.sched][SC.DATE]} rainout.`);
  if (G.weather && G.weather.dir === 'Out' && G.weather.mph >= 15 && hrAll >= 3) notes.push(`The wind was blowing out at ${G.weather.mph} mph, and ${hrAll} balls left the yard.`);
  if (stk.n >= 3 && stk.won && !/straight|row|streak|No\./.test(head)) notes.push(pick([`The ${wn} have won ${stk.n} in a row.`, `That is ${stk.n} straight for the ${wn}.`]));
  if (lstk.n >= 3 && !lstk.won && !/straight|row|skid|losses/.test(head)) notes.push(pick([`The ${ln} have lost ${lstk.n} straight.`, `It is ${lstk.n} losses in a row for the ${ln}.`]));
  // standings
  if (G.sched >= 0 && !G.exhib) {
    const wt = S.teams[wc], lt = S.teams[lc];
    P.push(pick([
      `The win leaves the ${wn} at ${wt.w}-${wt.l}, ${gbText(wc)}; the ${ln} fall to ${lt.w}-${lt.l}, ${gbText(lc)}.`,
      `The ${wn} are ${wt.w}-${wt.l}, ${gbText(wc)}. The ${ln} drop to ${lt.w}-${lt.l}, ${gbText(lc)}.`,
      `At ${wt.w}-${wt.l}, the ${wn} are ${gbText(wc)}. The loss puts the ${ln} at ${lt.w}-${lt.l}, ${gbText(lc)}.`,
      `It leaves the ${wn} ${gbText(wc)} at ${wt.w}-${wt.l}, and the ${ln} ${gbText(lc)} at ${lt.w}-${lt.l}.`,
      `The ${wn} improve to ${wt.w}-${wt.l}, ${gbText(wc)}, while the ${ln} slip to ${lt.w}-${lt.l}, ${gbText(lc)}.`
    ]));
  }
  const wx = windText();
  return { game: G.gameNo, date: dateTxt, label: '', head, deck, story: P, notes, teams: G.teams.slice(), score: G.score.slice(), park: parkName(), weather: wx, line: G.innRuns.map(r => r.slice(0, G.inn)), exhib: !!G.exhib, playoff: G.playoffRow >= 0, att: G.att, time: G.time || timeOfGame(), dh: G.dh };
}
function paperHtml(pp) {
  const date = pp.date + ', ' + seasonYr();
  const others = (S.results.filter(r => r.date === pp.date && r.game !== pp.game).map(r => `<div>${esc(nickOf(r.away))} ${r.ra}, ${esc(nickOf(r.home))} ${r.rh} <span class="small">(W: ${esc(r.wp.split(' ').slice(-1)[0])}${r.dh ? ', DH ' + r.dh : ''})</span></div>`).join('') + (S.rainouts || []).filter(r => r.date === pp.date).map(r => `<div>${esc(nickOf(r.away))} at ${esc(nickOf(r.home))} <span class="small">rained out, made up ${esc(r.makeupDate)}</span></div>`).join('')) || '<div class="small">No other games.</div>';
  const divs = []; for (const c of pp.teams) { const d = divisionOf(c); if (!divs.some(x => x.lg === d.lg && x.dv === d.dv)) divs.push(d); }
  const standBox = divs.map(d => `<table class="gz-stand"><tr><th class="l">${esc(leagueName(d.lg).replace(' League', '') + ' ' + divName(d.dv))}</th><th>W</th><th>L</th><th>GB</th></tr>${divStandings(d.lg, d.dv).map(r => `<tr><td class="l">${esc(nickOf(r.code))}</td><td>${r.w}</td><td>${r.l}</td><td>${r.gb ? r.gb : '—'}</td></tr>`).join('')}</table>`).join('');
  const ldr = (lg, stat) => leaderTable('B', stat, lg).rows.slice(0, 3).map(r => `${esc(r.name.replace(/ \(.*\)/, '').split(' ').slice(-1)[0])} <b>${r.v}</b>`).join(', ') || '—';
  const ni = Math.max(9, pp.line[0].length);
  const lineTbl = `<table class="gz-line"><tr><th></th>${Array.from({ length: ni }, (_, i) => '<th>' + (i + 1) + '</th>').join('')}<th>R</th></tr>${[0, 1].map(s => `<tr><td class="l">${pp.teams[s]}</td>${Array.from({ length: ni }, (_, i) => '<td>' + (pp.line[s][i] == null ? '' : pp.line[s][i]) + '</td>').join('')}<td><b>${pp.score[s]}</b></td></tr>`).join('')}</table>`;
  return `<div class="gazette"><div class="gz-mast"><div class="gz-vol">Vol. ${seasonYr() - 1976} · No. ${pp.game}</div><div class="gz-title">The Ball Five Gazette</div><div class="gz-date">${esc(date)} · ${pp.exhib ? 'Exhibition' : pp.playoff ? 'Playoffs' : 'Baseball'}${pp.weather ? ' · ' + esc(pp.weather) : ''}</div></div>
    <h1 class="gz-head">${esc(pp.head)}</h1>${pp.deck ? `<div class="gz-deck">${esc(pp.deck)}</div>` : ''}
    <div class="gz-cols"><div class="gz-story">${pp.story.map(p => '<p>' + esc(p) + '</p>').join('')}${lineTbl}${pp.att || pp.time ? `<div class="small gz-tail">${pp.att ? 'Att. ' + fmtNum(pp.att) + '. ' : ''}${pp.time ? 'T ' + pp.time + '.' : ''}</div>` : ''}${pp.notes.length ? '<h4>Notes</h4>' + pp.notes.map(n => '<p class="gz-note">' + esc(n) + '</p>').join('') : ''}</div>
    <div class="gz-side"><h4>Around the league</h4>${others}<h4>Standings</h4>${standBox}<h4>Leaders</h4><div class="gz-ld"><span class="gz-lg">AL</span><i>Average:</i> ${ldr('AL', 'AVG')}<br><i>Homers:</i> ${ldr('AL', 'HR')}</div><div class="gz-ld"><span class="gz-lg">NL</span><i>Average:</i> ${ldr('NL', 'AVG')}<br><i>Homers:</i> ${ldr('NL', 'HR')}</div></div></div></div>`;
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
    <div class="parkgrid"><div class="parkpic"><svg viewBox="0 -72 600 500">${svg}</svg></div>
    <div><h3 style="margin-top:0">${esc(park)}</h3><p>Home of the <b>${esc(teamFull(parkPick))}</b> · ${esc(teamCity(parkPick))} · ${isDome(park) ? 'indoors, no wind' : 'open air'}</p>
    <p><b>Dimensions:</b> left field ${dims[0]} ft · center ${dims[1]} ft · right ${dims[2]} ft${park.includes('Fenway') ? ' · the Green Monster in left' : ''}</p>
    <h4>How it plays (${seasonYr()} park effects, measured from home vs road games)</h4><table class="data"><tr><th class="l">Result</th><th>Factor</th><th class="l">In plain English</th></tr>${pf}</table>
    <h4>This season here</h4><p>${home.length ? `The ${esc(nickOf(parkPick))} are <b>${hw}-${hl}</b> at home (${aw}-${al} on the road). ${plural(home.length, 'game')} played here, ${(runsHere / home.length).toFixed(1)} runs a game.` : 'No games here yet.'}</p>
    ${R.longhr && R.longhr.label && R.longhr.label.endsWith('at ' + parkPick) ? `<p>The season's longest home run was hit here: ${R.longhr.v} ft by ${esc(R.longhr.who)}.</p>` : ''}
    </div></div></div>`;
}
