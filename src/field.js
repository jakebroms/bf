/* field.js: the ballpark drawn to scale from its fence distances (field units 600 x 420, home plate at y = HOMEY) */
'use strict';
const IN_SC = 1.45, HOMEY = 30;
function pkScale() { const cf = fenceDist(8); let s = (350 - 130 * IN_SC) / (cf - 130); return s > 0.78 ? 0.78 : s; }
function RU(ft) { return ft <= 130 ? ft * IN_SC : 130 * IN_SC + (ft - 130) * pkScale(); }
function fenceAt(th) {
  th = clamp(th, 45, 135); const cf = fenceDist(8), ln = th < 90 ? fenceDist(9) : fenceDist(7);
  const t = 1 - Math.abs(th - 90) / 45; return ln + (cf - ln) * (t + Math.sin(t * Math.PI / 2)) / 2;
}
function polarXY(ft, th) { const r = RU(ft); return [300 + r * Math.cos(th * Math.PI / 180), HOMEY + r * Math.sin(th * Math.PI / 180)]; }
const fAng = f => [90, 90, 90, 52, 62, 128, 118, 120, 90, 60][(f < 1 || f > 9) ? 8 : f];
function fDistFt(f) { switch (f) { case 1: return 60.5; case 2: return 6; case 3: case 5: return 105; case 4: case 6: return 160; default: return (160 + fenceAt(fAng(f))) / 2; } }
function flyFeet(f, loc) { return Math.floor(fenceAt(fAng(f)) * (0.55 + 0.42 * loc / 99) / 5 + 0.5) * 5; }
const FY = y => 420 - y;
function ballSpot(f, depth, hrFt) {
  // where the ball went, in field units
  if (f < 1 || f > 9) f = 8; const sg = rand() < 0.5 ? -1 : 1; let ft, th;
  switch (depth) {
    case 0:
      if (f >= 7) { ft = flyFeet(f, gLoc); th = fAng(f) + (rand() - 0.5) * 10; }
      else if (f === 1) { ft = 45 + rand() * 20; th = 90 + (rand() - 0.5) * 24; }
      else if (f === 2) { ft = 12 + rand() * 25; th = 90 + (rand() - 0.5) * 70; }
      else { ft = fDistFt(f) + (rand() - 0.5) * 16; th = fAng(f) + sg * (gLoc / 99) * 9; }
      break;
    case 1:
      if (f >= 7) { th = fAng(f) + (rand() - 0.5) * 16; ft = fenceAt(th) * (0.55 + rand() * 0.12); }
      else { th = fAng(f) + (rand() - 0.5) * 10; ft = 175 + rand() * 35; }
      break;
    case 2: th = fAng(f) + sg * (6 + rand() * 10); ft = fenceAt(th) * (0.87 + rand() * 0.08); break;
    case 3: th = fAng(f) + sg * (8 + rand() * 8); ft = fenceAt(th) * 0.96; break;
    default: th = fAng(f) + (rand() - 0.5) * 14; ft = hrFt > 0 ? hrFt : fenceAt(th) + 20 + rand() * 25; if (ft < fenceAt(th) + 8) ft = fenceAt(th) + 8;
  }
  th = clamp(th, 44, 136); let [x, y] = polarXY(ft, th);
  for (let i = 0; i < 30 && !(y <= 413 && x >= 8 && x <= 592); i++) { ft -= 6; [x, y] = polarXY(ft, th); }
  return { x, y };
}
function animateBall(el, ball) {
  // the ball leaves the plate and flies (or rolls) to where it ended up
  if (!el) return; const x0 = 300, y0 = HOMEY, x1 = ball.x, y1 = ball.y, dist = Math.hypot(x1 - x0, y1 - y0);
  const arc = ball.depth >= 1 || ball.depth === 0 && ball.air ? Math.min(90, dist * 0.35) : 6; const ms = 350 + Math.min(650, dist * 2.2); const t0 = performance.now();
  const step = now => { let t = (now - t0) / ms; if (t > 1) t = 1; const e = 1 - Math.pow(1 - t, 2); const x = x0 + (x1 - x0) * e, y = y0 + (y1 - y0) * e + Math.sin(t * Math.PI) * arc;
    el.setAttribute('cx', x.toFixed(1)); el.setAttribute('cy', FY(y).toFixed(1)); el.setAttribute('r', (5.5 + Math.sin(t * Math.PI) * arc / 30).toFixed(1)); if (t < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
}
function speedColor(v) {
  v = Math.round(v);
  if (v >= 20) return '#006100'; if (v === 19) return '#008000'; if (v === 18) return '#38a03c'; if (v === 17) return '#70be5a'; if (v === 16) return '#a9dc8c';
  if (v >= 11) return '#ffe650'; if (v >= 6) return '#ffa53c'; return '#ff6464';
}
function speedWord(v) { return v >= 17 ? 'very fast' : v >= 13 ? 'fast' : v >= 8 ? 'average' : v >= 4 ? 'slow' : 'very slow'; }

// how each 1977 park looks: turf or grass, wall colour, seat colour, and a signature
const PARKLOOK = [
  ['Fenway', { seats: '#2e5d3a', wall: '#1f6b3a', monster: true, dirt: '#b7794a' }],
  ['Wrigley', { seats: '#3b6b4a', wall: '#2f7d3a', ivy: true, dirt: '#c08a52', noLights: true }],
  ['Yankee', { seats: '#2c4a8a', wall: '#2c4a8a', dirt: '#b5774a' }],
  ['Dodger', { seats: '#3c6fc0', wall: '#2f5fb0', pavilion: true, dirt: '#c48d55' }],
  ['Tiger', { seats: '#2f5a3a', wall: '#1f5b36', dirt: '#b07248' }],
  ['Royals', { seats: '#2d4f9a', wall: '#2d4f9a', fountains: true, turf: true }],
  ['Riverfront', { seats: '#a33', wall: '#2a3f6f', turf: true }],
  ['Three Rivers', { seats: '#c9a227', wall: '#2a3f6f', turf: true }],
  ['Veterans', { seats: '#b58a3c', wall: '#2a3f6f', turf: true }],
  ['Busch', { seats: '#b03030', wall: '#2f5b3f', turf: true }],
  ['Kingdome', { seats: '#4f6f9f', wall: '#2a3f6f', turf: true, dome: true }],
  ['Astrodome', { seats: '#c8641e', wall: '#2a3f6f', turf: true, dome: true }],
  ['Olympic', { seats: '#4f7fb0', wall: '#2a3f6f', turf: true }],
  ['Exhibition', { seats: '#3a5f9f', wall: '#2a3f6f', turf: true }],
  ['Candlestick', { seats: '#d9742c', wall: '#2f5b3f', turf: true }],
  ['Oakland', { seats: '#2f7d4a', wall: '#2f6b3f', dirt: '#b5774a' }],
  ['Anaheim', { seats: '#b03030', wall: '#2f5b3f', dirt: '#c08a52' }],
  ['Comiskey', { seats: '#3a5f3a', wall: '#2f5b3f', dirt: '#b07248' }],
  ['Memorial', { seats: '#c96a1e', wall: '#2f5b3f', dirt: '#b5774a' }],
  ['Cleveland', { seats: '#5a5a5a', wall: '#2f5b3f', dirt: '#b5774a' }],
  ['County', { seats: '#2d4f9a', wall: '#2f5b3f', dirt: '#b5774a' }],
  ['Metropolitan', { seats: '#4a6fa5', wall: '#2f5b3f', dirt: '#b5774a' }],
  ['Arlington', { seats: '#2d4f9a', wall: '#2f5b3f', dirt: '#c08a52' }],
  ['Atlanta', { seats: '#b03030', wall: '#2f5b3f', dirt: '#c08a52' }],
  ['San Diego', { seats: '#c9a227', wall: '#2f5b3f', dirt: '#c08a52' }],
  ['Shea', { seats: '#3c6fc0', wall: '#2f5b3f', dirt: '#b5774a' }],
];
function parkLook(park) { for (const [k, v] of PARKLOOK) if (park.includes(k)) return v; return { seats: '#555', wall: '#2f5b3f', dirt: '#c08a52' }; }
function mulberry(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
// what the sky is doing: 'day', 'dusk', 'night', 'dome'
function skyPhase() {
  if (isDome(gParkOverride || parkName())) return 'dome';
  if (gParkOverride || !G.night) return 'day';
  return G.inn <= 2 && !G.over ? 'dusk' : 'night';
}
let gParkCache = { key: '', svg: null }, gViewX = 0;
const VB_Y = -72, VB_H = 500;   // the picture starts above the park so the upper deck beyond centre field is in it
// the stands follow the shape of the field: a strip of foul ground along each line, the backstop behind the plate, the fence arc
function boundaryPts(Wf) {
  const pts = []; const push = (x, y, nx, ny) => pts.push([x, y, nx, ny]);
  for (let a = -135; a <= -45; a += 7.5) { const r = a * Math.PI / 180; push(300 + Wf * Math.cos(r), HOMEY + Wf * Math.sin(r), Math.cos(r), Math.sin(r)); }
  const c45 = Math.cos(Math.PI / 4), s45 = Math.sin(Math.PI / 4);
  const tR = RU(fenceDist(9)); for (let t = 0; t <= tR; t += tR / 10) push(300 + t * c45 + Wf * s45, HOMEY + t * s45 - Wf * c45, s45, -c45);
  for (let th = 45; th <= 135; th += 2.5) { const [x, y] = polarXY(fenceAt(th), th); const r = th * Math.PI / 180; push(x, y, Math.cos(r), Math.sin(r)); }
  const tL = RU(fenceDist(7)); for (let t = tL; t >= 0; t -= tL / 10) push(300 - t * c45 - Wf * s45, HOMEY + t * s45 - Wf * c45, -s45, -c45);
  return pts;
}
const offPoly = (pts, k) => pts.map(p => (p[0] + p[2] * k).toFixed(1) + ',' + FY(p[1] + p[3] * k).toFixed(1)).join(' ');
const bandPoly = (pts, k1, k2) => offPoly(pts, k1) + ' ' + pts.slice().reverse().map(p => (p[0] + p[2] * k2).toFixed(1) + ',' + FY(p[1] + p[3] * k2).toFixed(1)).join(' ');
function parkSVG() {
  // the park: stands, grass or turf, warning track, fence, dirt, lines, bases, dugouts, bullpens, the sky, the weather
  const park = gParkOverride || parkName(), look = parkLook(park), att = gParkOverride ? 0.6 : (G.att ? crowdSize() : G.dh === 2 ? 0.55 : 0.5);
  const phase = skyPhase(), w = gParkOverride ? null : G.weather;
  const wxKey = w ? w.dir + w.mph + ',' + w.temp + (G.sky || '') : '';
  const key = [park, att.toFixed(2), phase, wxKey, G.gameNo, G.inn, G.teams.join(), gViewX].join('|');
  if (gParkCache.key === key) return gParkCache.svg;
  const pts = []; for (let i = 0; i <= 36; i++) { const th = 45 + i * 2.5; const [x, y] = polarXY(fenceAt(th), th); pts.push(x.toFixed(1) + ',' + FY(y).toFixed(1)); }
  const fair = '300,' + FY(HOMEY) + ' ' + pts.join(' ') + ' 300,' + FY(HOMEY);
  const track = []; for (let i = 0; i <= 36; i++) { const th = 45 + i * 2.5; const [x, y] = polarXY(fenceAt(th) - 13, th); track.push(x.toFixed(1) + ',' + FY(y).toFixed(1)); }
  const dirt = []; for (let i = 0; i <= 36; i++) { const th = 45 + i * 2.5; const [x, y] = polarXY(150, th); dirt.push(x.toFixed(1) + ',' + FY(y).toFixed(1)); }
  const [b1x, b1y] = polarXY(90, 45); const [, b2y] = polarXY(127.3, 90); const d = 14 * IN_SC;
  const ingrass = [[300, HOMEY + d], [b1x - d * 0.75, b1y], [300, b2y - d], [600 - b1x + d * 0.75, b1y]].map(p => p[0].toFixed(1) + ',' + FY(p[1]).toFixed(1)).join(' ');
  const [rfx, rfy] = polarXY(fenceDist(9), 45), [lfx, lfy] = polarXY(fenceDist(7), 135);
  const [, my] = polarXY(60.5, 90);
  const night = phase === 'night', dusk = phase === 'dusk', dome = phase === 'dome';
  const grassA = look.turf ? '#5fb45c' : '#9fcf7e', grassB = look.turf ? '#58aa55' : '#92c472';
  const dirtC = look.turf ? '#c9a46f' : (look.dirt || '#c08a52'), trackC = look.turf ? '#b8905a' : '#a8713f';
  const homeC = gParkOverride ? '#345' : teamColor(G.teams[1], 1), awayC = gParkOverride ? '#543' : teamColor(G.teams[0], 1);
  const seed = (G.gameNo || 1) * 7919 + park.length;
  let s = '';
  // ---- defs: shading, the crowd texture, rain, shadows ----
  const crowdCols = ['#e9dcc3', '#cdb48f', '#7a6652', '#33302c', '#f4f1ea', '#9b8468', '#5a4f45', homeC];
  const rng = mulberry(seed); let tile = '';
  for (let i = 0; i < 120; i++) { const c = crowdCols[Math.floor(rng() * (i % 9 === 0 ? crowdCols.length : crowdCols.length - 1))]; tile += `<circle cx="${(rng() * 24).toFixed(1)}" cy="${(rng() * 24).toFixed(1)}" r="${(0.8 + rng() * 0.5).toFixed(1)}" fill="${c}"/>`; }
  s += `<defs><clipPath id="fairclip"><polygon points="${fair}"/></clipPath>
    <radialGradient id="turf" cx="0.5" cy="0.93" r="0.95"><stop offset="0" stop-color="${grassA}"/><stop offset="1" stop-color="${grassB}"/></radialGradient>
    <radialGradient id="lamp"><stop offset="0" stop-color="#fff8d0" stop-opacity="0.26"/><stop offset="1" stop-color="#fff8d0" stop-opacity="0"/></radialGradient>
    <pattern id="crowd" width="24" height="24" patternUnits="userSpaceOnUse">${tile}</pattern>
    <pattern id="rainp" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(18)"><line x1="0" y1="0" x2="0" y2="8" stroke="#e8f3ff" stroke-width="1.4" stroke-opacity="0.85"/><line x1="7" y1="6" x2="7" y2="14" stroke="#e8f3ff" stroke-width="1.4" stroke-opacity="0.75"/></pattern>
    <filter id="shadow" x="-10%" y="-20%" width="120%" height="150%"><feDropShadow dx="0" dy="1.2" stdDeviation="1.1" flood-color="#000" flood-opacity="0.35"/></filter>
    <filter id="wallshade" x="-5%" y="-5%" width="110%" height="110%"><feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#000" flood-opacity="0.35"/></filter></defs>`;
  // ---- the stands: concrete outside, upper deck, concourse, lower bowl, seat rows, aisles, the crowd ----
  const B = boundaryPts(22);
  const seatDark = look.seats, seatLite = shade(look.seats, 1.25);
  s += `<rect x="-900" y="-300" width="2400" height="1000" fill="#55554f"/>`;
  s += `<polygon points="${bandPoly(B, 126, 900)}" fill="#55554f"/><polygon points="${bandPoly(B, 120, 126)}" fill="#8f8d85"/><polygon points="${bandPoly(B, 40, 120)}" fill="${seatDark}"/>`;
  s += `<polygon points="${bandPoly(B, 0, 40)}" fill="${seatLite}"/>`;
  for (let k = 4; k < 120; k += 4) if (k !== 36 && k !== 40) s += `<polyline points="${offPoly(B, k)}" fill="none" stroke="#000" stroke-opacity="${k < 40 ? 0.13 : 0.18}" stroke-width="1"/>`;
  s += `<polygon points="${bandPoly(B, 35, 40)}" fill="#b9b6ac"/>`;
  for (let i = 0; i < B.length; i += 4) { const p = B[i]; s += `<line x1="${p[0].toFixed(1)}" y1="${FY(p[1]).toFixed(1)}" x2="${(p[0] + p[2] * 120).toFixed(1)}" y2="${FY(p[1] + p[3] * 120).toFixed(1)}" stroke="#e8e6df" stroke-opacity="0.55" stroke-width="1.4"/>`; }
  const lowerFill = clamp(att * 1.55, 0.08, 1), upperFill = clamp((att - 0.3) / 0.7, 0, 1) * 0.95;
  s += `<polygon points="${bandPoly(B, 1, 35)}" fill="url(#crowd)" fill-opacity="${(lowerFill * (night ? 0.8 : 0.95)).toFixed(2)}"/>`;
  if (upperFill > 0.02) s += `<polygon points="${bandPoly(B, 41, 118)}" fill="url(#crowd)" fill-opacity="${(upperFill * (night ? 0.75 : 0.9)).toFixed(2)}"/>`;
  s += `<polygon points="${offPoly(B, 0)}" fill="none" stroke="#000" stroke-opacity="0.35" stroke-width="2.5"/>`;
  // ---- the playing field ----
  s += `<polygon points="${offPoly(B, 0)}" fill="${grassB}"/>`;
  s += `<polygon points="${fair}" fill="url(#turf)"/>`;
  if (!look.turf) { for (let r = 1; r < 14; r++) { const ring = []; for (let i = 0; i <= 36; i++) { const th = 45 + i * 2.5; const ft = 128 + (fenceAt(th) - 128) * (r / 14); const [x, y] = polarXY(ft, th); ring.push(x.toFixed(1) + ',' + FY(y).toFixed(1)); } if (r % 2) s += `<polyline points="${ring.join(' ')}" fill="none" stroke="#fff" stroke-opacity="0.07" stroke-width="${(RU(fenceAt(90)) - RU(128)) / 14 * 0.95}" clip-path="url(#fairclip)"/>`; } }
  else { for (let x = -400; x < 1000; x += 26) s += `<line x1="${x}" y1="-80" x2="${x}" y2="428" stroke="#fff" stroke-opacity="0.05" stroke-width="13" clip-path="url(#fairclip)"/>`; }
  // warning track and the wall
  s += `<polygon points="${pts.join(' ')} ${track.slice().reverse().join(' ')}" fill="${trackC}" fill-opacity="0.9"/>`;
  s += `<polyline points="${pts.join(' ')}" fill="none" stroke="${look.wall}" stroke-width="4" filter="url(#wallshade)"/>`;
  s += `<polyline points="${pts.join(' ')}" fill="none" stroke="#fff" stroke-opacity="0.35" stroke-width="0.8"/>`;
  if (look.monster) { const seg = []; for (let th = 112; th <= 135; th += 2.5) { const [x, y] = polarXY(fenceAt(th), th); seg.push(x.toFixed(1) + ',' + FY(y).toFixed(1)); } s += `<polyline points="${seg.join(' ')}" fill="none" stroke="#1f6b3a" stroke-width="10" stroke-linecap="round" filter="url(#wallshade)"/>`; const [tx, ty] = polarXY(fenceDist(7) + 12, 124); s += `<text x="${tx.toFixed(1)}" y="${FY(ty).toFixed(1)}" font-size="6.5" fill="#fff" font-family="Arial" text-anchor="middle" transform="rotate(-38 ${tx.toFixed(1)} ${FY(ty).toFixed(1)})">GREEN MONSTER</text>`; }
  if (look.ivy) s += `<polyline points="${pts.join(' ')}" fill="none" stroke="#8b3a2f" stroke-width="7"/><polyline points="${pts.join(' ')}" fill="none" stroke="#2f7d3a" stroke-width="4.5" stroke-dasharray="3 2"/>`;
  if (look.fountains) for (const th of [74, 90, 106]) { const [x, y] = polarXY(fenceAt(th) + 16, th); s += `<ellipse cx="${x.toFixed(1)}" cy="${FY(y).toFixed(1)}" rx="17" ry="5" fill="#6fb7e8" stroke="#2d4f9a" stroke-width="0.8"/><path d="M${(x - 6).toFixed(1)} ${FY(y).toFixed(1)} q3 -9 6 0 q3 -9 6 0" fill="none" stroke="#dff3ff" stroke-width="1.2"/>`; }
  if (look.pavilion) for (const th of [52, 128]) { const [x, y] = polarXY(fenceAt(th) + 14, th); s += `<path d="M${(x - 22).toFixed(1)} ${FY(y).toFixed(1)} q5 -8 11 0 q5 -8 11 0 q5 -8 11 0 q5 -8 11 0" fill="none" stroke="#dfe8ff" stroke-width="2"/>`; }
  // foul poles
  s += `<line x1="${rfx.toFixed(1)}" y1="${FY(rfy).toFixed(1)}" x2="${(rfx + 6).toFixed(1)}" y2="${(FY(rfy) - 6).toFixed(1)}" stroke="#ffd400" stroke-width="2.5"/><line x1="${lfx.toFixed(1)}" y1="${FY(lfy).toFixed(1)}" x2="${(lfx - 6).toFixed(1)}" y2="${(FY(lfy) - 6).toFixed(1)}" stroke="#ffd400" stroke-width="2.5"/>`;
  // infield: full dirt on grass, cutouts on turf
  if (look.turf) {
    s += `<circle cx="300" cy="${FY(HOMEY).toFixed(1)}" r="26" fill="${dirtC}"/>`;
    [[b1x, b1y], [300, b2y], [600 - b1x, b1y]].forEach(b => { s += `<circle cx="${b[0].toFixed(1)}" cy="${FY(b[1]).toFixed(1)}" r="13" fill="${dirtC}"/>`; });
    s += `<ellipse cx="300" cy="${FY(my).toFixed(1)}" rx="13" ry="10" fill="${dirtC}"/>`;
    const bp0 = [[300, HOMEY], [b1x, b1y], [300, b2y], [600 - b1x, b1y], [300, HOMEY]];
    for (let i = 0; i < 4; i++) s += `<line x1="${bp0[i][0].toFixed(1)}" y1="${FY(bp0[i][1]).toFixed(1)}" x2="${bp0[i + 1][0].toFixed(1)}" y2="${FY(bp0[i + 1][1]).toFixed(1)}" stroke="${dirtC}" stroke-width="7" stroke-linecap="round"/>`;
  } else {
    s += `<polygon points="300,${FY(HOMEY - 8)} ${dirt.join(' ')} 300,${FY(HOMEY - 8)}" fill="${dirtC}"/>`;
    s += `<polygon points="300,${FY(HOMEY - 8)} ${dirt.join(' ')} 300,${FY(HOMEY - 8)}" fill="none" stroke="#000" stroke-opacity="0.12" stroke-width="1.5"/>`;
    s += `<polygon points="${ingrass}" fill="url(#turf)"/>`;
    s += `<ellipse cx="300" cy="${FY(my).toFixed(1)}" rx="8" ry="6" fill="${shade(dirtC, 0.9)}" stroke="#000" stroke-opacity="0.15"/>`;
  }
  s += `<rect x="296.5" y="${FY(my) - 1}" width="7" height="2" fill="#fff"/>`;
  // lines, boxes, bases
  s += `<line x1="300" y1="${FY(HOMEY)}" x2="${rfx.toFixed(1)}" y2="${FY(rfy).toFixed(1)}" stroke="#fff" stroke-width="1.5"/><line x1="300" y1="${FY(HOMEY)}" x2="${lfx.toFixed(1)}" y2="${FY(lfy).toFixed(1)}" stroke="#fff" stroke-width="1.5"/>`;
  s += `<rect x="283" y="${FY(HOMEY) - 7}" width="8" height="14" fill="none" stroke="#fff" stroke-width="0.9"/><rect x="309" y="${FY(HOMEY) - 7}" width="8" height="14" fill="none" stroke="#fff" stroke-width="0.9"/><rect x="294" y="${FY(HOMEY) + 7}" width="12" height="9" fill="none" stroke="#fff" stroke-width="0.9"/>`;
  const bp = [[300, HOMEY], [b1x, b1y], [300, b2y], [600 - b1x, b1y], [300, HOMEY]];
  if (!look.turf) for (let i = 0; i < 4; i++) s += `<line x1="${bp[i][0].toFixed(1)}" y1="${FY(bp[i][1]).toFixed(1)}" x2="${bp[i + 1][0].toFixed(1)}" y2="${FY(bp[i + 1][1]).toFixed(1)}" stroke="#000" stroke-opacity="0.18" stroke-width="1.2"/>`;
  const [c1x, c1y] = polarXY(75, 38), [c3x, c3y] = polarXY(75, 142);
  s += `<rect x="${(c1x - 3).toFixed(1)}" y="${(FY(c1y) - 9).toFixed(1)}" width="6" height="16" fill="none" stroke="#fff" stroke-width="0.8" transform="rotate(-45 ${c1x.toFixed(1)} ${FY(c1y).toFixed(1)})"/><rect x="${(c3x - 3).toFixed(1)}" y="${(FY(c3y) - 9).toFixed(1)}" width="6" height="16" fill="none" stroke="#fff" stroke-width="0.8" transform="rotate(45 ${c3x.toFixed(1)} ${FY(c3y).toFixed(1)})"/>`;
  s += `<polygon points="300,${FY(HOMEY) - 5} 305,${FY(HOMEY)} 305,${FY(HOMEY) + 4} 295,${FY(HOMEY) + 4} 295,${FY(HOMEY)}" fill="#fff" stroke="#5a5a5a" stroke-width="0.8"/>`;
  const bases = [[b1x, b1y], [300, b2y], [600 - b1x, b1y]];
  bases.forEach((b, i) => { s += `<rect id="base${i + 1}" x="${(b[0] - 6).toFixed(1)}" y="${(FY(b[1]) - 6).toFixed(1)}" width="12" height="12" transform="rotate(45 ${b[0].toFixed(1)} ${FY(b[1]).toFixed(1)})" fill="#fff" stroke="#555" stroke-width="0.8" filter="url(#shadow)"/>`; });
  // dugouts (home down the first-base line), on-deck circles, bullpens down the lines
  const dug = (side, color, label) => { const sg = side ? 1 : -1; const th = side ? 45 : 135; const [ax, ay] = polarXY(55, th), [bx, by] = polarXY(115, th); const nx = sg * 0.707 * 1, ny = -0.707; const o = 10, h = 11;
    const p = [[ax + nx * o, ay + ny * o], [bx + nx * o, by + ny * o], [bx + nx * (o + h), by + ny * (o + h)], [ax + nx * (o + h), ay + ny * (o + h)]].map(q => q[0].toFixed(1) + ',' + FY(q[1]).toFixed(1)).join(' ');
    const [mx, my2] = polarXY(85, th); return `<polygon points="${p}" fill="${color}" stroke="#222" stroke-width="0.8" filter="url(#shadow)"/><text x="${(mx + nx * (o + h / 2)).toFixed(1)}" y="${(FY(my2 + ny * (o + h / 2)) + 2.5).toFixed(1)}" text-anchor="middle" font-size="6" fill="#fff" font-family="Arial" font-weight="bold" transform="rotate(${sg * -45} ${(mx + nx * (o + h / 2)).toFixed(1)} ${FY(my2 + ny * (o + h / 2)).toFixed(1)})">${esc(label)}</text>`; };
  s += dug(true, homeC, gParkOverride ? 'HOME' : friendlyCode(G.teams[1])) + dug(false, awayC, gParkOverride ? 'VISITORS' : friendlyCode(G.teams[0]));
  for (const [th, sg] of [[36, 1], [144, -1]]) { const [x, y] = polarXY(44, th); s += `<circle cx="${x.toFixed(1)}" cy="${FY(y).toFixed(1)}" r="4.5" fill="none" stroke="#fff" stroke-width="0.9" stroke-opacity="0.9"/>`; }
  for (const th of [40.5, 139.5]) { for (const ft of [205, 222]) { const [x, y] = polarXY(ft, th); s += `<circle cx="${x.toFixed(1)}" cy="${FY(y).toFixed(1)}" r="4" fill="${dirtC}" stroke="#000" stroke-opacity="0.15"/>`; } const [hx, hy] = polarXY(238, th); s += `<rect x="${(hx - 2).toFixed(1)}" y="${(FY(hy) - 2).toFixed(1)}" width="4" height="4" fill="#fff"/>`; }
  [[129, 7], [90, 8], [51, 9]].forEach(([th, f]) => { const [x, y] = polarXY(fenceAt(th) - 22, th); s += `<text x="${x.toFixed(1)}" y="${(FY(y) + 3).toFixed(1)}" text-anchor="middle" font-size="9" font-weight="bold" fill="#fff" stroke="#000" stroke-width="0.5" paint-order="stroke" font-family="Arial">${fenceDist(f)}</text>`; });
  // ---- the sky: dusk, night with the lights on, rain, a dome ----
  if (dusk) s += `<rect x="-700" y="-100" width="2000" height="700" fill="#ff9a3c" fill-opacity="0.13" pointer-events="none"/>`;
  if (night) {
    s += `<rect x="-700" y="-100" width="2000" height="700" fill="#0b1a3a" fill-opacity="0.42" pointer-events="none"/>`;
    for (const [lx, ly] of [[40, 40], [560, 40], [12, 300], [588, 300], [300, -10]]) s += `<circle cx="${lx}" cy="${ly}" r="190" fill="url(#lamp)" pointer-events="none"/><g transform="translate(${lx} ${ly})"><rect x="-7" y="-5" width="14" height="10" rx="2" fill="#ddd" stroke="#555" stroke-width="0.8"/><rect x="-5" y="-3" width="10" height="6" fill="#fff6c0"/></g>`;
  }
  if (dome) s += `<polygon points="${bandPoly(B, 118, 900)}" fill="#8a919c"/><polyline points="${offPoly(B, 118)}" fill="none" stroke="#dfe6f0" stroke-width="3" stroke-opacity="0.8"/><rect x="-700" y="-100" width="2000" height="700" fill="#dfe6f0" fill-opacity="0.08" pointer-events="none"/>`;
  if (w && w.dir === 'Rain') s += `<rect class="rain" x="-720" y="-120" width="2040" height="740" fill="url(#rainp)" pointer-events="none"/><rect x="-700" y="-100" width="2000" height="700" fill="#334" fill-opacity="0.12" pointer-events="none"/>`;
  else if (G.sky === 'cloudy' && !dome && !night && !gParkOverride) s += `<rect x="-700" y="-100" width="2000" height="700" fill="#8a94a6" fill-opacity="0.12" pointer-events="none"/>`;
  // the wind, shown in the left-center gap
  if (w && w.mph >= 5 && w.dir !== 'Dome' && w.dir !== 'Rain') {
    const ang = { 'Out to left': -135, 'Out to center': -90, 'Out to right': -45, 'In': 90, 'Across': 0 }[w.dir]; if (ang != null) {
      const cx = 215, cy = FY(b2y) - 28, L = 10 + w.mph * 1.2;
      s += `<g class="wind" transform="translate(${cx} ${cy}) rotate(${ang})"><line x1="${-L}" y1="0" x2="${L}" y2="0" stroke="#fff" stroke-width="3" stroke-opacity="0.85" stroke-linecap="round"/><polygon points="${L},0 ${L - 9},-5 ${L - 9},5" fill="#fff" fill-opacity="0.9"/></g><text x="${cx}" y="${cy + 24}" text-anchor="middle" font-size="8" font-weight="bold" fill="#fff" font-family="Arial" stroke="#000" stroke-width="0.5" paint-order="stroke">wind ${w.mph}</text>`;
    }
  }
  // the weather, as a badge: hover for the detail
  if (!gParkOverride && (w || dome)) {
    const icon = dome ? '🏟' : w.dir === 'Rain' ? '🌧' : night ? '🌙' : dusk ? '🌆' : G.sky === 'cloudy' ? '☁' : '☀';
    const tip = (dome ? 'Indoors, 72°' : windText()) + (dome ? '' : G.night ? ' · night game' : G.dayNo ? ' · day game' : '') + (G.att ? ' · attendance ' + fmtNum(G.att) + (G.attNote ? ' (' + G.attNote + ')' : '') : '');
    s += `<g class="wxbadge" transform="translate(${gViewX} ${VB_Y})"><title>${esc(tip)}</title><circle cx="16" cy="16" r="11" fill="#000" fill-opacity="0.45"/><text x="16" y="21" text-anchor="middle" font-size="13" font-family="Arial">${icon}</text>${w && !dome ? `<text x="31" y="20" font-size="9" font-weight="bold" fill="#fff" stroke="#000" stroke-width="0.5" paint-order="stroke" font-family="Arial">${w.temp}°</text>` : ''}</g>`;
  }
  s += `<text x="${gViewX + 8}" y="417" font-size="10" fill="#fff" font-family="Arial" font-weight="bold" stroke="#000" stroke-width="0.6" paint-order="stroke">${esc(park)}${G.att && !gParkOverride ? ' · ' + fmtNum(G.att) : ''}</text>`;
  // camera flashes in the seats after a big moment at night
  if (night && gSpark > Date.now()) { const r2 = mulberry(Date.now() & 0xffff); for (let i = 0; i < 26; i++) { const p = B[Math.floor(r2() * B.length)]; const k = 3 + r2() * 30; s += `<circle class="spark" cx="${(p[0] + p[2] * k).toFixed(0)}" cy="${FY(p[1] + p[3] * k).toFixed(0)}" r="2.2" fill="#fff" style="animation-delay:${(r2() * 1.2).toFixed(2)}s"/>`; } }
  const out = { svg: s, bases, b1x, b1y, b2y };
  gParkCache = { key: gSpark > Date.now() ? '' : key, svg: out };
  return out;
}
function shade(hex, f) { const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex); if (!m) return hex; return '#' + [1, 2, 3].map(i => Math.round(clamp(parseInt(m[i], 16) * f, 0, 255)).toString(16).padStart(2, '0')).join(''); }
let gSpark = 0;
function fielderLabel(f, fid) {
  // [name line, ratings line]
  const k = fid + '|' + f; let r2 = '';
  if (k in IX.fld) { const r = D.fielding[IX.fld[k]]; if (f >= 2) r2 = 'range ' + r[F.RNGR] + ' · e' + r[F.ER]; if (f === 2 || f >= 7) r2 += ' · arm ' + (num(r[F.ARMR]) >= 0 ? '+' : '') + r[F.ARMR]; }
  else if (f >= 2) r2 = 'out of position';
  return [posName(f) + ' ' + lastName(fid), r2];
}
function renderField(container) {
  const fside = fieldSideTeam(); const pk = parkSVG();
  const pendX = G.pend && G.pend.kind === 'X' ? G.pend.f : 0;
  let s = pk.svg;
  for (let f = 1; f <= 9; f++) {
    const id = defID(fside, f); let x, y;
    if (f === 2) { x = 300; y = 9; } else [x, y] = polarXY(fDistFt(f), fAng(f));
    const [l1, l2] = fielderLabel(f, id); const w = Math.max(70, l1.length * 8.2 + 12, l2.length * 4.6 + 8);
    const glow = pendX === f; const h = l2 ? 26 : 18;
    s += `<g class="fld${glow ? ' glow' : ''}" data-f="${f}" style="cursor:${glow ? 'pointer' : 'default'}"><rect x="${(x - w / 2).toFixed(1)}" y="${(FY(y) - h / 2).toFixed(1)}" width="${w.toFixed(1)}" height="${h}" rx="4" filter="url(#shadow)" fill="${glow ? '#ffc000' : '#fff'}" fill-opacity="0.95" stroke="${glow ? '#c55a11' : '#6e9a3a'}" stroke-width="${glow ? 2 : 1}"/><text x="${x.toFixed(1)}" y="${(FY(y) + (l2 ? -0.5 : 4.5)).toFixed(1)}" text-anchor="middle" font-size="13" font-weight="bold" font-family="Arial" fill="#111">${esc(l1)}</text>${l2 ? `<text x="${x.toFixed(1)}" y="${(FY(y) + 9.5).toFixed(1)}" text-anchor="middle" font-size="7.5" font-family="Arial" fill="#444">${esc(l2)}</text>` : ''}</g>`;
  }
  pk.bases.forEach((b, i) => {
    const rid = G.bases[i]; if (!rid) return;
    const spd = runSpd(rid), cue = stealCue(i + 1); const lbl = lastName(rid); const w = Math.max(60, lbl.length * 8.4 + 14);
    const stroke = cue === 2 ? '#00b050' : cue === 1 ? '#ffc000' : '#595959';
    s += `<g class="runner"><rect x="${(b[0] - w / 2).toFixed(1)}" y="${(FY(b[1]) - 10).toFixed(1)}" width="${w}" height="20" rx="4" filter="url(#shadow)" fill="${speedColor(spd)}" stroke="${stroke}" stroke-width="${cue ? 3 : 1}"/><text x="${b[0].toFixed(1)}" y="${(FY(b[1]) + 5).toFixed(1)}" text-anchor="middle" font-size="13" font-weight="bold" font-family="Arial" fill="${spd >= 19 ? '#fff' : '#000'}">${esc(lbl)}</text></g>`;
  });
  if (G.ball) s += `<circle id="balldot" cx="${G.ball.x.toFixed(1)}" cy="${FY(G.ball.y).toFixed(1)}" r="5.5" fill="#fff" stroke="#6e6e6e" stroke-width="0.8"/>`;
  container.innerHTML = s;
  if (G.ball && G.ball.fresh && !gSim) { G.ball.fresh = false; animateBall(container.querySelector('#balldot'), G.ball); }
  container.querySelectorAll('.fld.glow').forEach(el => el.addEventListener('click', () => Actions.fieldingCheck(num(el.dataset.f))));
}
