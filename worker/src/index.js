// Ball Five Baseball 1977 on Cloudflare Workers + D1
import PAGE from '../public/index.html';
// Accounts (email + password), sessions, each user's live save, and every finished game in the stats tables.
const COOKIE = 'bf5_session';
const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers } });
const err = (msg, status) => json({ error: msg }, status);
const num = v => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const str = (v, max) => (v == null ? '' : String(v)).slice(0, max || 200);
const emailOk = e => typeof e === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && e.length <= 120;

// ---- passwords: PBKDF2-SHA256 with a random salt (Web Crypto, no native code) ----
const enc = new TextEncoder();
const b64 = buf => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
async function hashPassword(pw, saltBytes) {
  const salt = saltBytes || crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 100000 }, key, 256);
  return 'pbkdf2$100000$' + b64(salt) + '$' + b64(bits);
}
async function verifyPassword(pw, stored) {
  const p = (stored || '').split('$'); if (p.length !== 4) return false;
  const again = await hashPassword(pw, unb64(p[2]));
  const a = enc.encode(again), b = enc.encode(stored); if (a.length !== b.length) return false;
  let d = 0; for (let i = 0; i < a.length; i++) d |= a[i] ^ b[i]; return d === 0;
}
const randomToken = () => Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, '0')).join('');

// ---- sessions ----
function getCookie(req, name) { const c = req.headers.get('cookie') || ''; const m = c.match(new RegExp('(?:^|;\\s*)' + name + '=([^;]+)')); return m ? m[1] : null; }
function sessionCookie(token, req) { const secure = new URL(req.url).protocol === 'https:' ? '; Secure' : ''; return `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${90 * 24 * 3600}${secure}`; }
async function currentUser(env, req) {
  const token = getCookie(req, COOKIE); if (!token) return null;
  const s = await env.DB.prepare("SELECT user_id FROM sessions WHERE token = ? AND expires_at > datetime('now')").bind(token).first();
  if (!s) return null;
  return env.DB.prepare('SELECT id, email, name, created_at FROM users WHERE id = ?').bind(s.user_id).first();
}
async function newSession(env, req, userId) {
  const token = randomToken();
  await env.DB.prepare("INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, datetime('now', '+90 days'))").bind(token, userId).run();
  return { 'set-cookie': sessionCookie(token, req) };
}

// ---- storing a finished game ----
async function storeGame(env, userId, g) {
  const prev = await env.DB.prepare('SELECT id FROM games WHERE user_id = ? AND game_no = ?').bind(userId, num(g.game)).first();
  if (prev) await env.DB.batch([
    env.DB.prepare('DELETE FROM plate_appearances WHERE game_id = ?').bind(prev.id), env.DB.prepare('DELETE FROM batting_lines WHERE game_id = ?').bind(prev.id),
    env.DB.prepare('DELETE FROM pitching_lines WHERE game_id = ?').bind(prev.id), env.DB.prepare('DELETE FROM games WHERE id = ?').bind(prev.id)]);
  const r = await env.DB.prepare(`INSERT INTO games (user_id, game_no, season, label, away, home, away_runs, home_runs, away_hits, home_hits, away_errors, home_errors, innings, line_away, line_home, park, winning_pitcher, losing_pitcher, save_pitcher, exhibition, playoff, walkoff, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(
    userId, num(g.game), num(g.season) || 1977, str(g.label), str(g.teams[0], 8), str(g.teams[1], 8), num(g.score[0]), num(g.score[1]), num(g.hits[0]), num(g.hits[1]), num(g.errs[0]), num(g.errs[1]),
    num(g.inn), str((g.innRuns[0] || []).join(','), 200), str((g.innRuns[1] || []).join(','), 200), str(g.park), str(g.wp), str(g.lp), str(g.sv), g.exhib ? 1 : 0, g.playoff ? 1 : 0, g.walkoff ? 1 : 0, str(g.notes, 4000)).run();
  const gid = r.meta.last_row_id;
  const stmts = [];
  const bat = env.DB.prepare(`INSERT INTO batting_lines (game_id, player_id, name, team, slot, pos, ab, r, h, d, t, hr, rbi, bb, k, sb, cs, sf, sh, gidp, e, hbp, ibb) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  for (const b of g.bat || []) stmts.push(bat.bind(gid, str(b.id, 32), str(b.name), str(b.team, 8), num(b.slot), str(b.pos, 24), num(b.AB), num(b.R), num(b.H), num(b['2B']), num(b['3B']), num(b.HR), num(b.RBI), num(b.BB), num(b.K), num(b.SB), num(b.CS), num(b.SF), num(b.SH), num(b.GIDP), num(b.E), num(b.HBP), num(b.IBB)));
  const pit = env.DB.prepare(`INSERT INTO pitching_lines (game_id, player_id, name, team, decision, outs, h, r, er, bb, k, hr, bf, w, l, sv, gs, cg, sho, gf, hbp, ibb, wp, bk) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  for (const p of g.pit || []) stmts.push(pit.bind(gid, str(p.id, 32), str(p.name), str(p.team, 8), str(p.dec, 24), num(p.OUTS), num(p.H), num(p.R), num(p.ER), num(p.BB), num(p.K), num(p.HR), num(p.BF), num(p.W), num(p.L), num(p.SV), num(p.GS), num(p.CG), num(p.SHO), num(p.GF), num(p.HBP), num(p.IBB), num(p.WP), num(p.BK)));
  const pa = env.DB.prepare(`INSERT INTO plate_appearances (game_id, seq, side, slot, inning, player_id, code, rbi, scored, sb, outs, text) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  (g.pa || []).slice(0, 400).forEach((p, i) => stmts.push(pa.bind(gid, i, num(p.s), num(p.slot), num(p.inn), str(p.id, 32), str(p.code, 16), num(p.rbi), p.scored ? 1 : 0, num(p.sb), num(p.outs), str(p.txt, 400))));
  for (let i = 0; i < stmts.length; i += 100) await env.DB.batch(stmts.slice(i, i + 100));
  return gid;
}

// ---- a little brake on password guessing (per isolate; fine for a family site) ----
const fails = new Map();
const failed = e => { const f = fails.get(e) || { n: 0, t: Date.now() }; if (Date.now() - f.t > 15 * 60e3) { f.n = 0; f.t = Date.now(); } f.n++; fails.set(e, f); };
const blocked = e => { const f = fails.get(e); return f && f.n >= 10 && Date.now() - f.t < 15 * 60e3; };

async function api(req, env, url) {
  const p = url.pathname, m = req.method;
  const body = async () => { try { return await req.json(); } catch (e) { return {}; } };
  if (p === '/api/register' && m === 'POST') {
    const { email, name, password } = await body();
    if (!emailOk(email)) return err('That does not look like an email address.', 400);
    if (typeof name !== 'string' || !name.trim() || name.length > 60) return err('Please give a name.', 400);
    if (typeof password !== 'string' || password.length < 6) return err('The password needs at least 6 characters.', 400);
    const em = email.toLowerCase();
    if (await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(em).first()) return err('There is already an account with that email. Sign in instead.', 409);
    const r = await env.DB.prepare('INSERT INTO users (email, name, pass_hash) VALUES (?, ?, ?)').bind(em, name.trim(), await hashPassword(password)).run();
    const id = r.meta.last_row_id; const h = await newSession(env, req, id);
    return json({ user: await env.DB.prepare('SELECT id, email, name, created_at FROM users WHERE id = ?').bind(id).first() }, 200, h);
  }
  if (p === '/api/login' && m === 'POST') {
    const { email, password } = await body();
    if (!emailOk(email) || typeof password !== 'string') return err('Email and password, please.', 400);
    const em = email.toLowerCase(); if (blocked(em)) return err('Too many tries. Wait 15 minutes and try again.', 429);
    const u = await env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(em).first();
    if (!u || !(await verifyPassword(password, u.pass_hash))) { failed(em); return err('Wrong email or password.', 401); }
    fails.delete(em); const h = await newSession(env, req, u.id);
    return json({ user: { id: u.id, email: u.email, name: u.name, created_at: u.created_at } }, 200, h);
  }
  if (p === '/api/logout' && m === 'POST') {
    const t = getCookie(req, COOKIE); if (t) await env.DB.prepare('DELETE FROM sessions WHERE token = ?').bind(t).run();
    return json({ ok: true }, 200, { 'set-cookie': `${COOKIE}=; Path=/; Max-Age=0` });
  }
  const user = await currentUser(env, req);
  if (p === '/api/me' && m === 'GET') {
    if (!user) return json({ user: null });
    const c = await env.DB.prepare('SELECT COUNT(*) AS n, SUM(CASE WHEN exhibition = 0 AND playoff = 0 THEN 1 ELSE 0 END) AS counted FROM games WHERE user_id = ?').bind(user.id).first();
    return json({ user, games: c.n || 0, counted: c.counted || 0 });
  }
  if (!user) return err('Please sign in.', 401);
  if (p === '/api/save' && m === 'GET') {
    const s = await env.DB.prepare('SELECT data, saved_at, updated_at FROM saves WHERE user_id = ?').bind(user.id).first();
    if (!s) return json({ save: null });
    return new Response('{"save":' + s.data + ',"saved_at":' + num(s.saved_at) + ',"updated_at":' + JSON.stringify(s.updated_at) + '}', { headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
  }
  if (p === '/api/save' && m === 'PUT') {
    const { save, saved_at } = await body();
    if (!save || typeof save !== 'object' || !save.S) return err('Not a save.', 400);
    const data = JSON.stringify(save); if (data.length > 9_000_000) return err('The save is too large.', 413);
    await env.DB.prepare("INSERT INTO saves (user_id, data, saved_at) VALUES (?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET data = excluded.data, saved_at = excluded.saved_at, updated_at = datetime('now')").bind(user.id, data, num(saved_at) || Date.now()).run();
    return json({ ok: true });
  }
  if (p === '/api/games' && m === 'POST') {
    const g = await body(); if (!g || !Array.isArray(g.teams) || !Array.isArray(g.score)) return err('Not a game.', 400);
    try { return json({ ok: true, id: await storeGame(env, user.id, g) }); } catch (e) { console.error(e); return err('Could not store the game.', 500); }
  }
  if (p === '/api/games' && m === 'GET') {
    const limit = Math.min(500, parseInt(url.searchParams.get('limit') || '100', 10) || 100), offset = parseInt(url.searchParams.get('offset') || '0', 10) || 0;
    const rows = await env.DB.prepare('SELECT id, game_no, season, label, played_at, away, home, away_runs, home_runs, innings, winning_pitcher, losing_pitcher, save_pitcher, exhibition, playoff, walkoff, notes FROM games WHERE user_id = ? ORDER BY game_no DESC LIMIT ? OFFSET ?').bind(user.id, limit, offset).all();
    const c = await env.DB.prepare('SELECT COUNT(*) AS n FROM games WHERE user_id = ?').bind(user.id).first();
    return json({ games: rows.results, total: c.n || 0 });
  }
  let mm;
  if ((mm = p.match(/^\/api\/games\/(\d+)\/notes$/)) && m === 'PUT') {
    const { notes } = await body();
    await env.DB.prepare('UPDATE games SET notes = ? WHERE user_id = ? AND game_no = ?').bind(str(notes, 4000), user.id, parseInt(mm[1], 10)).run();
    return json({ ok: true });
  }
  if ((mm = p.match(/^\/api\/games\/(\d+)$/)) && m === 'GET') {
    const g = await env.DB.prepare('SELECT * FROM games WHERE user_id = ? AND game_no = ?').bind(user.id, parseInt(mm[1], 10)).first();
    if (!g) return err('No such game.', 404);
    const [b, pt, pa] = await Promise.all([
      env.DB.prepare('SELECT * FROM batting_lines WHERE game_id = ? ORDER BY team, slot, id').bind(g.id).all(),
      env.DB.prepare('SELECT * FROM pitching_lines WHERE game_id = ? ORDER BY team, id').bind(g.id).all(),
      env.DB.prepare('SELECT * FROM plate_appearances WHERE game_id = ? ORDER BY seq').bind(g.id).all()]);
    return json({ game: g, batting: b.results, pitching: pt.results, plate_appearances: pa.results });
  }
  if (p === '/api/stats/batting' && m === 'GET') {
    const rows = await env.DB.prepare(`SELECT b.player_id, MAX(b.name) AS name, MAX(b.team) AS team, COUNT(*) AS g, SUM(ab) AS ab, SUM(r) AS r, SUM(h) AS h, SUM(d) AS d, SUM(t) AS t, SUM(hr) AS hr, SUM(rbi) AS rbi, SUM(bb) AS bb, SUM(k) AS k, SUM(sb) AS sb, SUM(cs) AS cs, SUM(sf) AS sf, SUM(hbp) AS hbp, SUM(e) AS e
      FROM batting_lines b JOIN games g ON g.id = b.game_id WHERE g.user_id = ? AND g.exhibition = 0 AND g.playoff = 0 GROUP BY b.player_id ORDER BY h DESC LIMIT 500`).bind(user.id).all();
    return json({ rows: rows.results });
  }
  if (p === '/api/stats/pitching' && m === 'GET') {
    const rows = await env.DB.prepare(`SELECT p.player_id, MAX(p.name) AS name, MAX(p.team) AS team, COUNT(*) AS g, SUM(outs) AS outs, SUM(h) AS h, SUM(r) AS r, SUM(er) AS er, SUM(bb) AS bb, SUM(k) AS k, SUM(hr) AS hr, SUM(w) AS w, SUM(l) AS l, SUM(sv) AS sv, SUM(gs) AS gs, SUM(cg) AS cg, SUM(sho) AS sho
      FROM pitching_lines p JOIN games g ON g.id = p.game_id WHERE g.user_id = ? AND g.exhibition = 0 AND g.playoff = 0 GROUP BY p.player_id ORDER BY outs DESC LIMIT 500`).bind(user.id).all();
    return json({ rows: rows.results });
  }
  if ((mm = p.match(/^\/api\/players\/([A-Za-z0-9_\-]+)\/games$/)) && m === 'GET') {
    const rows = await env.DB.prepare(`SELECT g.game_no, g.label, g.away, g.home, g.away_runs, g.home_runs, b.team, b.pos, b.ab, b.r, b.h, b.d, b.t, b.hr, b.rbi, b.bb, b.k, b.sb
      FROM batting_lines b JOIN games g ON g.id = b.game_id WHERE g.user_id = ? AND b.player_id = ? ORDER BY g.game_no`).bind(user.id, mm[1].slice(0, 32)).all();
    return json({ rows: rows.results });
  }
  if (p === '/api/wipe' && m === 'POST') { await env.DB.prepare('DELETE FROM games WHERE user_id = ?').bind(user.id).run(); return json({ ok: true }); }
  return err('Not found.', 404);
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname.startsWith('/api/')) {
      try { return await api(req, env, url); } catch (e) { console.error(e); return err('Server error: ' + (e.message || e), 500); }
    }
    if (url.pathname === '/health') return json({ ok: true });
    if (url.pathname === '/' || url.pathname === '/index.html') return new Response(PAGE, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-cache' } });
    return new Response('Not found', { status: 404 });
  },
};
