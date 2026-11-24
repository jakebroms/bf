// server.js: Ball Five Baseball 1977 as a web app with accounts and a stats database
'use strict';
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const { db, stmts, storeGame, DB_PATH } = require('./db');

const PORT = parseInt(process.env.PORT || '3000', 10);
const SECURE = process.env.BF_SECURE_COOKIES === '1';          // set to 1 behind HTTPS
const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '12mb' }));
app.use(cookieParser());

// ---- helpers ----
const COOKIE = 'bf5_session';
function setSession(res, userId) {
  const token = crypto.randomBytes(32).toString('hex');
  stmts.insertSession.run(token, userId);
  res.cookie(COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: SECURE, maxAge: 90 * 24 * 3600 * 1000 });
}
function currentUser(req) {
  const token = req.cookies[COOKIE]; if (!token) return null;
  const s = stmts.session.get(token); if (!s) return null;
  return stmts.userById.get(s.user_id) || null;
}
function requireUser(req, res, next) { const u = currentUser(req); if (!u) return res.status(401).json({ error: 'Please sign in.' }); req.user = u; next(); }
const emailOk = e => typeof e === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && e.length <= 120;

// a little brake on password guessing: 10 failed tries per email per 15 minutes
const fails = new Map();
function failed(email) { const f = fails.get(email) || { n: 0, t: Date.now() }; if (Date.now() - f.t > 15 * 60e3) { f.n = 0; f.t = Date.now(); } f.n++; fails.set(email, f); }
function blocked(email) { const f = fails.get(email); return f && f.n >= 10 && Date.now() - f.t < 15 * 60e3; }

// ---- accounts ----
app.post('/api/register', async (req, res) => {
  const { email, name, password } = req.body || {};
  if (!emailOk(email)) return res.status(400).json({ error: 'That does not look like an email address.' });
  if (typeof name !== 'string' || !name.trim() || name.length > 60) return res.status(400).json({ error: 'Please give a name.' });
  if (typeof password !== 'string' || password.length < 6) return res.status(400).json({ error: 'The password needs at least 6 characters.' });
  if (stmts.userByEmail.get(email.toLowerCase())) return res.status(409).json({ error: 'There is already an account with that email. Sign in instead.' });
  const hash = await bcrypt.hash(password, 10);
  const r = stmts.insertUser.run(email.toLowerCase(), name.trim(), hash);
  setSession(res, r.lastInsertRowid);
  res.json({ user: stmts.userById.get(r.lastInsertRowid) });
});
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!emailOk(email) || typeof password !== 'string') return res.status(400).json({ error: 'Email and password, please.' });
  const em = email.toLowerCase();
  if (blocked(em)) return res.status(429).json({ error: 'Too many tries. Wait 15 minutes and try again.' });
  const u = stmts.userByEmail.get(em);
  if (!u || !(await bcrypt.compare(password, u.pass_hash))) { failed(em); return res.status(401).json({ error: 'Wrong email or password.' }); }
  fails.delete(em);
  setSession(res, u.id);
  res.json({ user: stmts.userById.get(u.id) });
});
app.post('/api/logout', (req, res) => { const t = req.cookies[COOKIE]; if (t) stmts.deleteSession.run(t); res.clearCookie(COOKIE); res.json({ ok: true }); });
app.get('/api/me', (req, res) => { const u = currentUser(req); if (!u) return res.json({ user: null }); const c = stmts.countGames.get(u.id); res.json({ user: u, games: c.n || 0, counted: c.counted || 0 }); });

// ---- the live save (the whole season as the game keeps it) ----
app.get('/api/save', requireUser, (req, res) => { const s = stmts.getSave.get(req.user.id); if (!s) return res.json({ save: null }); res.json({ save: JSON.parse(s.data), saved_at: s.saved_at, updated_at: s.updated_at }); });
app.put('/api/save', requireUser, (req, res) => {
  const { save, saved_at } = req.body || {};
  if (!save || typeof save !== 'object' || !save.S) return res.status(400).json({ error: 'Not a save.' });
  stmts.putSave.run(req.user.id, JSON.stringify(save), Number(saved_at) || Date.now());
  res.json({ ok: true });
});

// ---- finished games into the stats tables ----
app.post('/api/games', requireUser, (req, res) => {
  const g = req.body || {};
  if (!g || !Array.isArray(g.teams) || !Array.isArray(g.score)) return res.status(400).json({ error: 'Not a game.' });
  try { const id = storeGame(req.user.id, g); res.json({ ok: true, id }); }
  catch (e) { console.error(e); res.status(500).json({ error: 'Could not store the game.' }); }
});
app.put('/api/games/:no/notes', requireUser, (req, res) => { stmts.updateNotes.run(String(req.body.notes || '').slice(0, 4000), req.user.id, parseInt(req.params.no, 10)); res.json({ ok: true }); });
app.get('/api/games', requireUser, (req, res) => { const limit = Math.min(500, parseInt(req.query.limit || '100', 10) || 100), offset = parseInt(req.query.offset || '0', 10) || 0; res.json({ games: stmts.listGames.all(req.user.id, limit, offset), total: stmts.countGames.get(req.user.id).n || 0 }); });
app.get('/api/games/:no', requireUser, (req, res) => {
  const g = stmts.gameDetail.get(req.user.id, parseInt(req.params.no, 10)); if (!g) return res.status(404).json({ error: 'No such game.' });
  res.json({ game: g, batting: stmts.gameBat.all(g.id), pitching: stmts.gamePit.all(g.id), plate_appearances: stmts.gamePA.all(g.id) });
});
app.get('/api/stats/batting', requireUser, (req, res) => res.json({ rows: stmts.battingTotals.all(req.user.id) }));
app.get('/api/stats/pitching', requireUser, (req, res) => res.json({ rows: stmts.pitchingTotals.all(req.user.id) }));
app.get('/api/players/:id/games', requireUser, (req, res) => res.json({ rows: stmts.playerGames.all(req.user.id, String(req.params.id).slice(0, 32)) }));
app.post('/api/wipe', requireUser, (req, res) => { stmts.wipeUser.run(req.user.id); res.json({ ok: true }); });

// ---- the game itself ----
app.use(express.static(path.join(__dirname, 'public'), { index: 'index.html', maxAge: 0 }));
app.get('/health', (req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log('Ball Five Baseball 1977 is up: http://localhost:' + PORT);
  console.log('Database: ' + DB_PATH);
});
