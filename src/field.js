/* field.js: the ballpark drawn to scale from its fence distances (field units 600 x 420, home plate at y = HOMEY) */
'use strict';
const IN_SC = 1.45, HOMEY = 30;
function pkScale() { const cf = fenceDist(8); let s = (388 - 130 * IN_SC) / (cf - 130); return s > 0.85 ? 0.85 : s; }
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
let gParkCache = { key: '', svg: null };
function parkSVG() {
  // the park: stands with the crowd, grass or turf, fence, dirt, lines, bases, distances, the sky, the weather
  const park = gParkOverride || parkName(), look = parkLook(park), att = gParkOverride ? 0.6 : (G.att ? crowdSize() : G.dh === 2 ? 0.55 : 0.5);
  const phase = skyPhase(), w = gParkOverride ? null : G.weather;
  const wxKey = w ? w.dir + w.mph + ',' + w.temp + (G.sky || '') : '';
  const key = [park, att.toFixed(2), phase, wxKey, G.gameNo, G.inn].join('|');
  if (gParkCache.key === key) return gParkCache.svg;
  const pts = [], ptsXY = []; for (let i = 0; i <= 36; i++) { const th = 45 + i * 2.5; const [x, y] = polarXY(fenceAt(th), th); ptsXY.push([x, y, th]); pts.push(x.toFixed(1) + ',' + FY(y).toFixed(1)); }
  const fair = '300,' + FY(HOMEY) + ' ' + pts.join(' ') + ' 300,' + FY(HOMEY);
  const dirt = []; for (let i = 0; i <= 36; i++) { const th = 45 + i * 2.5; const [x, y] = polarXY(150, th); dirt.push(x.toFixed(1) + ',' + FY(y).toFixed(1)); }
  const [b1x, b1y] = polarXY(90, 45); const [, b2y] = polarXY(127.3, 90); const d = 14 * IN_SC;
  const ingrass = [[300, HOMEY + d], [b1x - d * 0.75, b1y], [300, b2y - d], [600 - b1x + d * 0.75, b1y]].map(p => p[0].toFixed(1) + ',' + FY(p[1]).toFixed(1)).join(' ');
  const [rfx, rfy] = polarXY(fenceDist(9), 45), [lfx, lfy] = polarXY(fenceDist(7), 135);
  const [, my] = polarXY(60.5, 90);
  const night = phase === 'night', dusk = phase === 'dusk', dome = phase === 'dome';
  const grass = look.turf ? (night ? '#4f9a4a' : '#5db35a') : (night ? '#7fae63' : '#b6da96'), grass2 = look.turf ? grass : (night ? '#76a45c' : '#aed08c');
  const dirtC = look.turf ? '#c7a06a' : (look.dirt || '#c08a52');
  let s = '';
  s += `<defs><clipPath id="fairclip"><polygon points="${fair}"/></clipPath>
    <radialGradient id="lamp"><stop offset="0" stop-color="#fff8d0" stop-opacity="0.55"/><stop offset="1" stop-color="#fff8d0" stop-opacity="0"/></radialGradient>
    <pattern id="rainp" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(18)"><line x1="0" y1="0" x2="0" y2="8" stroke="#e8f3ff" stroke-width="1.4" stroke-opacity="0.85"/><line x1="7" y1="6" x2="7" y2="14" stroke="#e8f3ff" stroke-width="1.4" stroke-opacity="0.75"/></pattern></defs>`;
  // the stands, all the way round, then the foul ground
  s += `<rect x="0" y="0" width="600" height="428" fill="${look.seats}"/>`;
  for (let r = 0; r < 7; r++) { const rr = []; for (let i = 0; i <= 36; i++) { const th = 45 + i * 2.5; const [x, y] = polarXY(fenceAt(th), th); const dx = x - 300, dy = y - HOMEY, L = Math.hypot(dx, dy); rr.push((x + dx / L * (6 + r * 5.5)).toFixed(1) + ',' + FY(y + dy / L * (6 + r * 5.5)).toFixed(1)); } s += `<polyline points="${rr.join(' ')}" fill="none" stroke="#000" stroke-opacity="0.12" stroke-width="1"/>`; }
  const foulPts = []; for (let i = 0; i <= 40; i++) { const th = 36 + i * 2.7; const [x, y] = polarXY(fenceAt(clamp(th, 45, 135)) + (th < 45 || th > 135 ? -40 * (1 - Math.abs(th - 90) / 54) : 0), th); foulPts.push(x.toFixed(1) + ',' + FY(y).toFixed(1)); }
  s += `<polygon points="300,${FY(HOMEY - 22)} ${foulPts.join(' ')} 300,${FY(HOMEY - 22)}" fill="${grass2}"/>`;
  s += `<polygon points="${fair}" fill="${grass}"/>`;
  if (!look.turf) { for (let r = 1; r < 9; r++) { const ring = []; for (let i = 0; i <= 36; i++) { const th = 45 + i * 2.5; const ft = 130 + (fenceAt(th) - 130) * (r / 9); const [x, y] = polarXY(ft, th); ring.push(x.toFixed(1) + ',' + FY(y).toFixed(1)); } if (r % 2) s += `<polyline points="${ring.join(' ')}" fill="none" stroke="#fff" stroke-opacity="${night ? 0.05 : 0.09}" stroke-width="${(RU(fenceAt(90)) - RU(130)) / 9 * 0.95}" clip-path="url(#fairclip)"/>`; } }
  // the wall (with its signatures)
  const wallW = 3;
  s += `<polyline points="${pts.join(' ')}" fill="none" stroke="${look.wall}" stroke-width="${wallW}"/>`;
  if (look.monster) { const seg = ptsXY.filter(p => p[2] >= 112).map(p => p[0].toFixed(1) + ',' + FY(p[1]).toFixed(1)); s += `<polyline points="${seg.join(' ')}" fill="none" stroke="#1f6b3a" stroke-width="9" stroke-linecap="round"/>`; const [tx, ty] = polarXY(fenceDist(7) + 14, 124); s += `<text x="${tx.toFixed(1)}" y="${FY(ty).toFixed(1)}" font-size="6.5" fill="#fff" font-family="Arial" text-anchor="middle" transform="rotate(-38 ${tx.toFixed(1)} ${FY(ty).toFixed(1)})">GREEN MONSTER</text>`; }
  if (look.ivy) { s += `<polyline points="${pts.join(' ')}" fill="none" stroke="#8b3a2f" stroke-width="7"/><polyline points="${pts.join(' ')}" fill="none" stroke="#2f7d3a" stroke-width="4" stroke-dasharray="3 2"/>`; }
  if (look.fountains) { for (const th of [78, 90, 102]) { const [x, y] = polarXY(fenceAt(th) + 18, th); s += `<ellipse cx="${x.toFixed(1)}" cy="${FY(y).toFixed(1)}" rx="16" ry="5" fill="#6fb7e8" stroke="#2d4f9a" stroke-width="0.8"/><path d="M${(x - 6).toFixed(1)} ${FY(y).toFixed(1)} q3 -9 6 0 q3 -9 6 0" fill="none" stroke="#dff3ff" stroke-width="1.2"/>`; } }
  if (look.pavilion) { for (const th of [52, 128]) { const [x, y] = polarXY(fenceAt(th) + 16, th); s += `<path d="M${(x - 22).toFixed(1)} ${FY(y).toFixed(1)} q5 -8 11 0 q5 -8 11 0 q5 -8 11 0 q5 -8 11 0" fill="none" stroke="#dfe8ff" stroke-width="2"/>`; } }
  // the crowd: one dot a head, as many as came through the gate
  const rng = mulberry((G.gameNo || 1) * 7919 + park.length);
  const n = Math.round(1100 * att * att), cols = ['#f1e4c8', '#e9c9a4', '#c8a07a', '#d94e3c', '#3461c1', '#f0e06a', '#f6f6f6', '#2f2f2f', '#8ab6e4', '#c89b2f'];
  let dots = '';
  for (let i = 0; i < n; i++) {
    let x, y; const u = rng();
    if (u < 0.55) { const th = 45 + rng() * 90; const [fx, fy] = polarXY(fenceAt(th), th); const dx = fx - 300, dy = fy - HOMEY, L = Math.hypot(dx, dy); const k = 7 + rng() * 34; x = fx + dx / L * k; y = fy + dy / L * k; }
    else { const left = rng() < 0.5; const th = left ? 137 + rng() * 32 : 11 + rng() * 32; const ft = 40 + rng() * (fenceAt(clamp(th, 45, 135)) + 60 - 40); const [px, py] = polarXY(ft, th); x = px; y = py; const near = fenceAt(clamp(th, 45, 135)); if (ft < near - 40 * (1 - Math.abs(th - 90) / 54) + 4 && th > 36 && th < 144) continue; }
    if (x < 2 || x > 598 || y < -6 || y > 420) continue;
    dots += `<circle cx="${x.toFixed(0)}" cy="${FY(y).toFixed(0)}" r="1.6" fill="${cols[Math.floor(rng() * cols.length)]}" fill-opacity="${night ? 0.75 : 0.9}"/>`;
  }
  s += `<g class="crowd">${dots}</g>`;
  // infield: full dirt on grass, cutouts on turf
  if (look.turf) {
    s += `<circle cx="300" cy="${FY(HOMEY).toFixed(1)}" r="${(26 * 1.0).toFixed(1)}" fill="${dirtC}"/>`;
    [[b1x, b1y], [300, b2y], [600 - b1x, b1y]].forEach(b => { s += `<circle cx="${b[0].toFixed(1)}" cy="${FY(b[1]).toFixed(1)}" r="13" fill="${dirtC}"/>`; });
    s += `<ellipse cx="300" cy="${FY(my).toFixed(1)}" rx="13" ry="10" fill="${dirtC}"/>`;
    const bp0 = [[300, HOMEY], [b1x, b1y], [300, b2y], [600 - b1x, b1y], [300, HOMEY]];
    for (let i = 0; i < 4; i++) s += `<line x1="${bp0[i][0].toFixed(1)}" y1="${FY(bp0[i][1]).toFixed(1)}" x2="${bp0[i + 1][0].toFixed(1)}" y2="${FY(bp0[i + 1][1]).toFixed(1)}" stroke="${dirtC}" stroke-width="7" stroke-linecap="round"/>`;
  } else {
    s += `<polygon points="300,${FY(HOMEY - 8)} ${dirt.join(' ')} 300,${FY(HOMEY - 8)}" fill="${dirtC}"/>`;
    s += `<polygon points="${ingrass}" fill="${grass}"/>`;
    s += `<ellipse cx="300" cy="${FY(my).toFixed(1)}" rx="7" ry="5" fill="${dirtC}" stroke="#000" stroke-opacity="0.15"/>`;
  }
  s += `<line x1="300" y1="${FY(HOMEY)}" x2="${rfx.toFixed(1)}" y2="${FY(rfy).toFixed(1)}" stroke="#fff" stroke-width="1.5"/>`;
  s += `<line x1="300" y1="${FY(HOMEY)}" x2="${lfx.toFixed(1)}" y2="${FY(lfy).toFixed(1)}" stroke="#fff" stroke-width="1.5"/>`;
  const bp = [[300, HOMEY], [b1x, b1y], [300, b2y], [600 - b1x, b1y], [300, HOMEY]];
  if (!look.turf) for (let i = 0; i < 4; i++) s += `<line x1="${bp[i][0].toFixed(1)}" y1="${FY(bp[i][1]).toFixed(1)}" x2="${bp[i + 1][0].toFixed(1)}" y2="${FY(bp[i + 1][1]).toFixed(1)}" stroke="#8a6d3b" stroke-width="1.2"/>`;
  s += `<rect x="295" y="${FY(HOMEY) - 5}" width="10" height="10" fill="#fff" stroke="#5a5a5a" stroke-width="0.8"/>`;
  const bases = [[b1x, b1y], [300, b2y], [600 - b1x, b1y]];
  bases.forEach((b, i) => { s += `<rect id="base${i + 1}" x="${(b[0] - 6).toFixed(1)}" y="${(FY(b[1]) - 6).toFixed(1)}" width="12" height="12" transform="rotate(45 ${b[0].toFixed(1)} ${FY(b[1]).toFixed(1)})" fill="#fff" stroke="#555" stroke-width="0.8"/>`; });
  [[129, 7], [90, 8], [51, 9]].forEach(([th, f]) => { const [x, y] = polarXY(fenceAt(th) - 17, th); s += `<text x="${x.toFixed(1)}" y="${(FY(y) + 3).toFixed(1)}" text-anchor="middle" font-size="9" font-weight="bold" fill="${night ? '#eaf5dc' : '#274e13'}" font-family="Arial">${fenceDist(f)}</text>`; });
  // the sky: dusk, night with the lights on, rain, a dome
  if (dusk) s += `<rect x="0" y="0" width="600" height="428" fill="#ff9a3c" fill-opacity="0.13" pointer-events="none"/>`;
  if (night) {
    s += `<rect x="0" y="0" width="600" height="428" fill="#0b1a3a" fill-opacity="0.28" pointer-events="none"/>`;
    for (const [lx, ly] of [[40, 40], [560, 40], [12, 300], [588, 300], [300, -10]]) s += `<circle cx="${lx}" cy="${ly}" r="230" fill="url(#lamp)" pointer-events="none"/><g transform="translate(${lx} ${ly})"><rect x="-7" y="-5" width="14" height="10" rx="2" fill="#ddd" stroke="#555" stroke-width="0.8"/><rect x="-5" y="-3" width="10" height="6" fill="#fff6c0"/></g>`;
  }
  if (dome) { s += `<path d="M0 0 L600 0 L600 428 L0 428 Z M18 18 L582 18 L582 410 L18 410 Z" fill="#6b7280" fill-rule="evenodd" fill-opacity="0.9"/><rect x="0" y="0" width="600" height="428" fill="#dfe6f0" fill-opacity="0.08" pointer-events="none"/>`; }
  if (w && w.dir === 'Rain') s += `<rect class="rain" x="-20" y="-20" width="640" height="470" fill="url(#rainp)" pointer-events="none"/><rect x="0" y="0" width="600" height="428" fill="#334" fill-opacity="0.12" pointer-events="none"/>`;
  else if (G.sky === 'cloudy' && !dome && !night) s += `<rect x="0" y="0" width="600" height="428" fill="#8a94a6" fill-opacity="0.12" pointer-events="none"/>`;
  // the wind, shown at second base where the gusts cross the field
  if (w && w.mph >= 5 && w.dir !== 'Dome' && w.dir !== 'Rain') {
    const ang = { 'Out to left': -135, 'Out to center': -90, 'Out to right': -45, 'In': 90, 'Across': 0 }[w.dir]; if (ang != null) {
      const cx = 215, cy = FY(b2y) - 28, L = 10 + w.mph * 1.2;
      s += `<g class="wind" transform="translate(${cx} ${cy}) rotate(${ang})"><line x1="${-L}" y1="0" x2="${L}" y2="0" stroke="#fff" stroke-width="3" stroke-opacity="0.85" stroke-linecap="round"/><polygon points="${L},0 ${L - 9},-5 ${L - 9},5" fill="#fff" fill-opacity="0.9"/></g><text x="${cx}" y="${cy + 24}" text-anchor="middle" font-size="8" font-weight="bold" fill="#fff" font-family="Arial" stroke="#000" stroke-width="0.5" paint-order="stroke">wind ${w.mph}</text>`;
    }
  }
  // the weather line and the park name
  const wxTxt = gParkOverride ? '' : (dome ? 'Indoors, 72°' : (w ? (w.dir === 'Rain' ? '🌧 ' : night ? '🌙 ' : G.sky === 'cloudy' ? '☁ ' : '☀ ') + windText() : '')) + (G.night && !dome && !gParkOverride ? ' · night game' : G.dayNo && !gParkOverride && !dome ? ' · day game' : '');
  if (wxTxt) s += `<rect x="4" y="4" width="${wxTxt.length * 5.2 + 12}" height="15" rx="3" fill="#000" fill-opacity="0.45"/><text x="10" y="15" font-size="9" fill="#fff" font-family="Arial" font-weight="bold">${esc(wxTxt)}</text>`;
  s += `<text x="8" y="420" font-size="10" fill="${night || dome ? '#fff' : '#fff'}" font-family="Arial" font-weight="bold" stroke="#000" stroke-width="0.6" paint-order="stroke">${esc(park)}${G.att && !gParkOverride ? ' · ' + fmtNum(G.att) : ''}</text>`;
  // camera flashes in the seats after a big moment at night
  if (night && gSpark > Date.now()) { const r2 = mulberry(Date.now() & 0xffff); for (let i = 0; i < 26; i++) { const th = 20 + r2() * 140; const ft = fenceAt(clamp(th, 45, 135)) + 10 + r2() * 30; const [x, y] = polarXY(ft, th); s += `<circle class="spark" cx="${x.toFixed(0)}" cy="${FY(y).toFixed(0)}" r="2.2" fill="#fff" style="animation-delay:${(r2() * 1.2).toFixed(2)}s"/>`; } }
  const out = { svg: s, bases, b1x, b1y, b2y };
  gParkCache = { key: gSpark > Date.now() ? '' : key, svg: out };
  return out;
}
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
    s += `<g class="fld${glow ? ' glow' : ''}" data-f="${f}" style="cursor:${glow ? 'pointer' : 'default'}"><rect x="${(x - w / 2).toFixed(1)}" y="${(FY(y) - h / 2).toFixed(1)}" width="${w.toFixed(1)}" height="${h}" rx="4" fill="${glow ? '#ffc000' : '#fff'}" fill-opacity="0.93" stroke="${glow ? '#c55a11' : '#6e9a3a'}" stroke-width="${glow ? 2 : 1}"/><text x="${x.toFixed(1)}" y="${(FY(y) + (l2 ? -0.5 : 4.5)).toFixed(1)}" text-anchor="middle" font-size="13" font-weight="bold" font-family="Arial" fill="#111">${esc(l1)}</text>${l2 ? `<text x="${x.toFixed(1)}" y="${(FY(y) + 9.5).toFixed(1)}" text-anchor="middle" font-size="7.5" font-family="Arial" fill="#444">${esc(l2)}</text>` : ''}</g>`;
  }
  pk.bases.forEach((b, i) => {
    const rid = G.bases[i]; if (!rid) return;
    const spd = runSpd(rid), cue = stealCue(i + 1); const lbl = lastName(rid); const w = Math.max(60, lbl.length * 8.4 + 14);
    const stroke = cue === 2 ? '#00b050' : cue === 1 ? '#ffc000' : '#595959';
    s += `<g class="runner"><rect x="${(b[0] - w / 2).toFixed(1)}" y="${(FY(b[1]) - 10).toFixed(1)}" width="${w}" height="20" rx="4" fill="${speedColor(spd)}" stroke="${stroke}" stroke-width="${cue ? 3 : 1}"/><text x="${b[0].toFixed(1)}" y="${(FY(b[1]) + 5).toFixed(1)}" text-anchor="middle" font-size="13" font-weight="bold" font-family="Arial" fill="${spd >= 19 ? '#fff' : '#000'}">${esc(lbl)}</text></g>`;
  });
  if (G.ball) s += `<circle id="balldot" cx="${G.ball.x.toFixed(1)}" cy="${FY(G.ball.y).toFixed(1)}" r="5.5" fill="#fff" stroke="#6e6e6e" stroke-width="0.8"/>`;
  container.innerHTML = s;
  if (G.ball && G.ball.fresh && !gSim) { G.ball.fresh = false; animateBall(container.querySelector('#balldot'), G.ball); }
  container.querySelectorAll('.fld.glow').forEach(el => el.addEventListener('click', () => Actions.fieldingCheck(num(el.dataset.f))));
}
