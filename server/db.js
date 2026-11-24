// db.js: the SQLite database (accounts, sessions, each user's live save, and the stats tables)
'use strict';
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const DB_PATH = process.env.BF_DB || path.join(__dirname, 'data', 'ballfive.db');
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  pass_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS saves (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  data TEXT NOT NULL,
  saved_at INTEGER NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS games (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  game_no INTEGER NOT NULL,
  season INTEGER NOT NULL DEFAULT 1977,
  label TEXT, played_at TEXT NOT NULL DEFAULT (datetime('now')),
  away TEXT NOT NULL, home TEXT NOT NULL, away_runs INTEGER NOT NULL, home_runs INTEGER NOT NULL,
  away_hits INTEGER, home_hits INTEGER, away_errors INTEGER, home_errors INTEGER,
  innings INTEGER, line_away TEXT, line_home TEXT, park TEXT,
  winning_pitcher TEXT, losing_pitcher TEXT, save_pitcher TEXT,
  exhibition INTEGER NOT NULL DEFAULT 0, playoff INTEGER NOT NULL DEFAULT 0, walkoff INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  UNIQUE(user_id, game_no)
);
CREATE TABLE IF NOT EXISTS batting_lines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  player_id TEXT NOT NULL, name TEXT, team TEXT, slot INTEGER, pos TEXT,
  ab INTEGER DEFAULT 0, r INTEGER DEFAULT 0, h INTEGER DEFAULT 0, d INTEGER DEFAULT 0, t INTEGER DEFAULT 0, hr INTEGER DEFAULT 0,
  rbi INTEGER DEFAULT 0, bb INTEGER DEFAULT 0, k INTEGER DEFAULT 0, sb INTEGER DEFAULT 0, cs INTEGER DEFAULT 0,
  sf INTEGER DEFAULT 0, sh INTEGER DEFAULT 0, gidp INTEGER DEFAULT 0, e INTEGER DEFAULT 0, hbp INTEGER DEFAULT 0, ibb INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS pitching_lines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  player_id TEXT NOT NULL, name TEXT, team TEXT, decision TEXT,
  outs INTEGER DEFAULT 0, h INTEGER DEFAULT 0, r INTEGER DEFAULT 0, er INTEGER DEFAULT 0, bb INTEGER DEFAULT 0, k INTEGER DEFAULT 0, hr INTEGER DEFAULT 0, bf INTEGER DEFAULT 0,
  w INTEGER DEFAULT 0, l INTEGER DEFAULT 0, sv INTEGER DEFAULT 0, gs INTEGER DEFAULT 0, cg INTEGER DEFAULT 0, sho INTEGER DEFAULT 0, gf INTEGER DEFAULT 0,
  hbp INTEGER DEFAULT 0, ibb INTEGER DEFAULT 0, wp INTEGER DEFAULT 0, bk INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS plate_appearances (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  seq INTEGER NOT NULL, side INTEGER NOT NULL, slot INTEGER, inning INTEGER, player_id TEXT, code TEXT,
  rbi INTEGER DEFAULT 0, scored INTEGER DEFAULT 0, sb INTEGER DEFAULT 0, outs INTEGER DEFAULT 0, text TEXT
);
CREATE INDEX IF NOT EXISTS ix_games_user ON games(user_id, game_no);
CREATE INDEX IF NOT EXISTS ix_bat_game ON batting_lines(game_id);
CREATE INDEX IF NOT EXISTS ix_bat_player ON batting_lines(player_id);
CREATE INDEX IF NOT EXISTS ix_pit_game ON pitching_lines(game_id);
CREATE INDEX IF NOT EXISTS ix_pa_game ON plate_appearances(game_id);
`);

const stmts = {
  userByEmail: db.prepare('SELECT * FROM users WHERE email = ?'),
  userById: db.prepare('SELECT id, email, name, created_at FROM users WHERE id = ?'),
  insertUser: db.prepare('INSERT INTO users (email, name, pass_hash) VALUES (?, ?, ?)'),
  insertSession: db.prepare("INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, datetime('now', '+90 days'))"),
  session: db.prepare("SELECT s.user_id FROM sessions s WHERE s.token = ? AND s.expires_at > datetime('now')"),
  deleteSession: db.prepare('DELETE FROM sessions WHERE token = ?'),
  getSave: db.prepare('SELECT data, saved_at, updated_at FROM saves WHERE user_id = ?'),
  putSave: db.prepare("INSERT INTO saves (user_id, data, saved_at) VALUES (?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET data = excluded.data, saved_at = excluded.saved_at, updated_at = datetime('now')"),
  gameByNo: db.prepare('SELECT id FROM games WHERE user_id = ? AND game_no = ?'),
  deleteGame: db.prepare('DELETE FROM games WHERE id = ?'),
  insertGame: db.prepare(`INSERT INTO games (user_id, game_no, season, label, away, home, away_runs, home_runs, away_hits, home_hits, away_errors, home_errors, innings, line_away, line_home, park, winning_pitcher, losing_pitcher, save_pitcher, exhibition, playoff, walkoff, notes)
    VALUES (@user_id, @game_no, @season, @label, @away, @home, @away_runs, @home_runs, @away_hits, @home_hits, @away_errors, @home_errors, @innings, @line_away, @line_home, @park, @winning_pitcher, @losing_pitcher, @save_pitcher, @exhibition, @playoff, @walkoff, @notes)`),
  insertBat: db.prepare(`INSERT INTO batting_lines (game_id, player_id, name, team, slot, pos, ab, r, h, d, t, hr, rbi, bb, k, sb, cs, sf, sh, gidp, e, hbp, ibb)
    VALUES (@game_id, @player_id, @name, @team, @slot, @pos, @ab, @r, @h, @d, @t, @hr, @rbi, @bb, @k, @sb, @cs, @sf, @sh, @gidp, @e, @hbp, @ibb)`),
  insertPit: db.prepare(`INSERT INTO pitching_lines (game_id, player_id, name, team, decision, outs, h, r, er, bb, k, hr, bf, w, l, sv, gs, cg, sho, gf, hbp, ibb, wp, bk)
    VALUES (@game_id, @player_id, @name, @team, @decision, @outs, @h, @r, @er, @bb, @k, @hr, @bf, @w, @l, @sv, @gs, @cg, @sho, @gf, @hbp, @ibb, @wp, @bk)`),
  insertPA: db.prepare(`INSERT INTO plate_appearances (game_id, seq, side, slot, inning, player_id, code, rbi, scored, sb, outs, text)
    VALUES (@game_id, @seq, @side, @slot, @inning, @player_id, @code, @rbi, @scored, @sb, @outs, @text)`),
  updateNotes: db.prepare('UPDATE games SET notes = ? WHERE user_id = ? AND game_no = ?'),
  listGames: db.prepare('SELECT id, game_no, season, label, played_at, away, home, away_runs, home_runs, innings, winning_pitcher, losing_pitcher, save_pitcher, exhibition, playoff, walkoff, notes FROM games WHERE user_id = ? ORDER BY game_no DESC LIMIT ? OFFSET ?'),
  countGames: db.prepare('SELECT COUNT(*) AS n, SUM(CASE WHEN exhibition = 0 AND playoff = 0 THEN 1 ELSE 0 END) AS counted FROM games WHERE user_id = ?'),
  battingTotals: db.prepare(`SELECT b.player_id, MAX(b.name) AS name, MAX(b.team) AS team, COUNT(*) AS g, SUM(ab) AS ab, SUM(r) AS r, SUM(h) AS h, SUM(d) AS d, SUM(t) AS t, SUM(hr) AS hr, SUM(rbi) AS rbi, SUM(bb) AS bb, SUM(k) AS k, SUM(sb) AS sb, SUM(cs) AS cs, SUM(sf) AS sf, SUM(hbp) AS hbp, SUM(e) AS e
    FROM batting_lines b JOIN games g ON g.id = b.game_id WHERE g.user_id = ? AND g.exhibition = 0 AND g.playoff = 0 GROUP BY b.player_id ORDER BY h DESC LIMIT 500`),
  pitchingTotals: db.prepare(`SELECT p.player_id, MAX(p.name) AS name, MAX(p.team) AS team, COUNT(*) AS g, SUM(outs) AS outs, SUM(h) AS h, SUM(r) AS r, SUM(er) AS er, SUM(bb) AS bb, SUM(k) AS k, SUM(hr) AS hr, SUM(w) AS w, SUM(l) AS l, SUM(sv) AS sv, SUM(gs) AS gs, SUM(cg) AS cg, SUM(sho) AS sho
    FROM pitching_lines p JOIN games g ON g.id = p.game_id WHERE g.user_id = ? AND g.exhibition = 0 AND g.playoff = 0 GROUP BY p.player_id ORDER BY outs DESC LIMIT 500`),
  playerGames: db.prepare(`SELECT g.game_no, g.label, g.away, g.home, g.away_runs, g.home_runs, b.team, b.pos, b.ab, b.r, b.h, b.d, b.t, b.hr, b.rbi, b.bb, b.k, b.sb
    FROM batting_lines b JOIN games g ON g.id = b.game_id WHERE g.user_id = ? AND b.player_id = ? ORDER BY g.game_no`),
  gameDetail: db.prepare('SELECT * FROM games WHERE user_id = ? AND game_no = ?'),
  gameBat: db.prepare('SELECT * FROM batting_lines WHERE game_id = ? ORDER BY team, slot, id'),
  gamePit: db.prepare('SELECT * FROM pitching_lines WHERE game_id = ? ORDER BY team, id'),
  gamePA: db.prepare('SELECT * FROM plate_appearances WHERE game_id = ? ORDER BY seq'),
  wipeUser: db.prepare('DELETE FROM games WHERE user_id = ?'),
};

const num = v => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const str = (v, max) => (v == null ? '' : String(v)).slice(0, max || 200);

// store one finished game (replaces an earlier copy with the same game number, e.g. after a restart)
const storeGame = db.transaction((userId, g) => {
  const prev = stmts.gameByNo.get(userId, num(g.game));
  if (prev) stmts.deleteGame.run(prev.id);
  const res = stmts.insertGame.run({
    user_id: userId, game_no: num(g.game), season: num(g.season) || 1977, label: str(g.label), away: str(g.teams[0], 8), home: str(g.teams[1], 8),
    away_runs: num(g.score[0]), home_runs: num(g.score[1]), away_hits: num(g.hits[0]), home_hits: num(g.hits[1]), away_errors: num(g.errs[0]), home_errors: num(g.errs[1]),
    innings: num(g.inn), line_away: str((g.innRuns[0] || []).join(','), 200), line_home: str((g.innRuns[1] || []).join(','), 200), park: str(g.park),
    winning_pitcher: str(g.wp), losing_pitcher: str(g.lp), save_pitcher: str(g.sv), exhibition: g.exhib ? 1 : 0, playoff: g.playoff ? 1 : 0, walkoff: g.walkoff ? 1 : 0, notes: str(g.notes, 4000),
  });
  const gid = res.lastInsertRowid;
  for (const b of g.bat || []) stmts.insertBat.run({ game_id: gid, player_id: str(b.id, 32), name: str(b.name), team: str(b.team, 8), slot: num(b.slot), pos: str(b.pos, 24), ab: num(b.AB), r: num(b.R), h: num(b.H), d: num(b['2B']), t: num(b['3B']), hr: num(b.HR), rbi: num(b.RBI), bb: num(b.BB), k: num(b.K), sb: num(b.SB), cs: num(b.CS), sf: num(b.SF), sh: num(b.SH), gidp: num(b.GIDP), e: num(b.E), hbp: num(b.HBP), ibb: num(b.IBB) });
  for (const p of g.pit || []) stmts.insertPit.run({ game_id: gid, player_id: str(p.id, 32), name: str(p.name), team: str(p.team, 8), decision: str(p.dec, 24), outs: num(p.OUTS), h: num(p.H), r: num(p.R), er: num(p.ER), bb: num(p.BB), k: num(p.K), hr: num(p.HR), bf: num(p.BF), w: num(p.W), l: num(p.L), sv: num(p.SV), gs: num(p.GS), cg: num(p.CG), sho: num(p.SHO), gf: num(p.GF), hbp: num(p.HBP), ibb: num(p.IBB), wp: num(p.WP), bk: num(p.BK) });
  (g.pa || []).forEach((p, i) => stmts.insertPA.run({ game_id: gid, seq: i, side: num(p.s), slot: num(p.slot), inning: num(p.inn), player_id: str(p.id, 32), code: str(p.code, 16), rbi: num(p.rbi), scored: p.scored ? 1 : 0, sb: num(p.sb), outs: num(p.outs), text: str(p.txt, 400) }));
  return gid;
});

module.exports = { db, stmts, storeGame, DB_PATH };
