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

function parkSVG() {
  // static park: grass, fair territory, fence, dirt, infield, lines, bases, distances
  const pts = []; for (let i = 0; i <= 36; i++) { const th = 45 + i * 2.5; const [x, y] = polarXY(fenceAt(th), th); pts.push(x.toFixed(1) + ',' + FY(y).toFixed(1)); }
  const fair = '300,' + FY(HOMEY) + ' ' + pts.join(' ') + ' 300,' + FY(HOMEY);
  const dirt = []; for (let i = 0; i <= 36; i++) { const th = 45 + i * 2.5; const [x, y] = polarXY(150, th); dirt.push(x.toFixed(1) + ',' + FY(y).toFixed(1)); }
  const [b1x, b1y] = polarXY(90, 45); const [, b2y] = polarXY(127.3, 90); const d = 14 * IN_SC;
  const ingrass = [[300, HOMEY + d], [b1x - d * 0.75, b1y], [300, b2y - d], [600 - b1x + d * 0.75, b1y]].map(p => p[0].toFixed(1) + ',' + FY(p[1]).toFixed(1)).join(' ');
  const [rfx, rfy] = polarXY(fenceDist(9), 45), [lfx, lfy] = polarXY(fenceDist(7), 135);
  const [, my] = polarXY(60.5, 90);
  let s = '';
  s += `<rect x="0" y="0" width="600" height="420" fill="#e4ebd8"/>`;
  s += `<polygon points="${fair}" fill="#b6da96"/>`;
  s += `<polyline points="${pts.join(' ')}" fill="none" stroke="#274e13" stroke-width="3"/>`;
  s += `<polygon points="300,${FY(HOMEY - 8)} ${dirt.join(' ')} 300,${FY(HOMEY - 8)}" fill="#d6ba8c"/>`;
  s += `<polygon points="${ingrass}" fill="#b6da96"/>`;
  s += `<line x1="300" y1="${FY(HOMEY)}" x2="${rfx.toFixed(1)}" y2="${FY(rfy).toFixed(1)}" stroke="#fff" stroke-width="1.5"/>`;
  s += `<line x1="300" y1="${FY(HOMEY)}" x2="${lfx.toFixed(1)}" y2="${FY(lfy).toFixed(1)}" stroke="#fff" stroke-width="1.5"/>`;
  const bp = [[300, HOMEY], [b1x, b1y], [300, b2y], [600 - b1x, b1y], [300, HOMEY]];
  for (let i = 0; i < 4; i++) s += `<line x1="${bp[i][0].toFixed(1)}" y1="${FY(bp[i][1]).toFixed(1)}" x2="${bp[i + 1][0].toFixed(1)}" y2="${FY(bp[i + 1][1]).toFixed(1)}" stroke="#8a6d3b" stroke-width="1.2"/>`;
  s += `<ellipse cx="300" cy="${FY(my).toFixed(1)}" rx="7" ry="5" fill="#d6ba8c"/>`;
  s += `<rect x="295" y="${FY(HOMEY) - 5}" width="10" height="10" fill="#fff" stroke="#5a5a5a" stroke-width="0.8"/>`;
  const bases = [[b1x, b1y], [300, b2y], [600 - b1x, b1y]];
  bases.forEach((b, i) => { s += `<rect id="base${i + 1}" x="${(b[0] - 6).toFixed(1)}" y="${(FY(b[1]) - 6).toFixed(1)}" width="12" height="12" transform="rotate(45 ${b[0].toFixed(1)} ${FY(b[1]).toFixed(1)})" fill="#fff" stroke="#555" stroke-width="0.8"/>`; });
  [[129, 7], [90, 8], [51, 9]].forEach(([th, f]) => { const [x, y] = polarXY(fenceAt(th) - 17, th); s += `<text x="${x.toFixed(1)}" y="${(FY(y) + 3).toFixed(1)}" text-anchor="middle" font-size="9" font-weight="bold" fill="#274e13" font-family="Arial">${fenceDist(f)}</text>`; });
  s += `<text x="8" y="414" font-size="10" fill="#274e13" font-family="Arial" font-weight="bold">${esc(gParkOverride || parkName())}</text>`;
  return { svg: s, bases, b1x, b1y, b2y };
}
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
