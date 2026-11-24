/* net.js: accounts and the stats database (only when the page is served by the Ball Five server) */
'use strict';
const Net = {
  available: location.protocol === 'http:' || location.protocol === 'https:',
  user: null, games: 0, counted: 0, pending: null, timer: null, lastErr: '', queue: [],
  async api(method, url, body) {
    const r = await fetch(url, { method, headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined, credentials: 'same-origin' });
    let j = null; try { j = await r.json(); } catch (e) { j = {}; }
    if (!r.ok) throw new Error(j.error || ('Server error ' + r.status));
    return j;
  },
  async me() {
    if (!this.available) return null;
    try { const j = await this.api('GET', '/api/me'); this.user = j.user; this.games = j.games || 0; this.counted = j.counted || 0; this.lastErr = ''; }
    catch (e) { this.user = null; this.lastErr = e.message; }
    return this.user;
  },
  // on start-up: take the server's save if it is newer than what this browser has
  async pullSave() {
    if (!this.user) return false;
    try {
      const j = await this.api('GET', '/api/save'); if (!j.save) return false;
      const localAt = S && S.savedAt ? S.savedAt : 0;
      if ((j.saved_at || 0) > localAt) { O = Object.assign(optDefaults(), j.save.O || {}); S = Object.assign(newSeason(), j.save.S); G = Object.assign(newGame(), j.save.G || {}); saveAll(false); return true; }
    } catch (e) { this.lastErr = e.message; }
    return false;
  },
  // every local save is pushed to the server a moment later (coalesced)
  pushSave() {
    if (!this.user) return; clearTimeout(this.timer);
    this.timer = setTimeout(async () => {
      try { await this.api('PUT', '/api/save', { save: { v: 1, O, S, G }, saved_at: S.savedAt || Date.now() }); this.lastErr = ''; this.flushQueue(); }
      catch (e) { this.lastErr = e.message; UI.syncState && UI.syncState(); }
      UI.syncState && UI.syncState();
    }, 800);
  },
  // a finished game goes into the stats tables; kept in a queue if the server is away
  storeGame(snap) {
    if (!this.available) return;
    const g = Object.assign({}, snap, { season: seasonYr(), game: snap.game, wp: G.summary ? G.summary.wp : '', lp: G.summary ? G.summary.lp : '', sv: G.summary ? G.summary.sv : '', exhib: !!G.exhib, playoff: G.playoffRow >= 0, walkoff: !!G.walkoff, notes: S.notes[snap.game] || '' });
    this.queue.push(g); try { localStorage.setItem('BF5_queue', JSON.stringify(this.queue.slice(-50))); } catch (e) {}
    this.flushQueue();
  },
  async flushQueue() {
    if (!this.user || !this.queue.length) return;
    const q = this.queue.slice(); this.queue = [];
    for (const g of q) { try { await this.api('POST', '/api/games', g); this.games++; if (!g.exhib && !g.playoff) this.counted++; } catch (e) { this.queue.push(g); this.lastErr = e.message; } }
    try { localStorage.setItem('BF5_queue', JSON.stringify(this.queue.slice(-50))); } catch (e) {}
    UI.syncState && UI.syncState();
  },
  saveNotes(gameNo, txt) { if (this.user) this.api('PUT', '/api/games/' + gameNo + '/notes', { notes: txt }).catch(() => {}); },
  async login(email, password) { const j = await this.api('POST', '/api/login', { email, password }); this.user = j.user; await this.me(); },
  async register(email, name, password) { const j = await this.api('POST', '/api/register', { email, name, password }); this.user = j.user; await this.me(); },
  async logout() { try { await this.api('POST', '/api/logout'); } catch (e) {} this.user = null; },
  load() { try { this.queue = JSON.parse(localStorage.getItem('BF5_queue') || '[]'); } catch (e) { this.queue = []; } },
};
