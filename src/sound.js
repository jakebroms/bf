/* sound.js: the ballpark, built live with the Web Audio API (no sound files).
   A crowd made of voices (dozens of them, through vowel filters), with applause, whistles and swells that build and fade.
   A bat that rings like ash, a glove that pops like leather, a Hammond-style organ with a songbook, a wall that clangs,
   fireworks for a walk-off, and a public-address announcer, umpire and beer vendor who use the browser's own voice. */
'use strict';
const Snd = {
  ctx: null, on: true, vol: 0.8, crowd: 0.7, busyUntil: 0, level: 0.1, ambientOn: false, stretchDone: -1, lastOrgan: 0, lastVendor: 0,
  init() {
    if (this.ctx) return true;
    try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { this.ctx = null; return false; }
    const c = this.ctx;
    this.master = c.createGain(); this.master.gain.value = this.vol;
    this.comp = c.createDynamicsCompressor(); this.comp.threshold.value = -14; this.comp.ratio.value = 5; this.comp.knee.value = 10;
    this.master.connect(this.comp); this.comp.connect(c.destination);
    this.fx = c.createGain(); this.fx.gain.value = 1; this.fx.connect(this.master);
    // the stadium: a long, dark reverb for the crowd and the organ, a short slap for the field sounds
    this.verb = c.createConvolver(); this.verb.buffer = this.impulse(2.6, 3.2, 1800); this.verbGain = c.createGain(); this.verbGain.gain.value = 0.3;
    this.fx.connect(this.verb); this.verb.connect(this.verbGain); this.verbGain.connect(this.master);
    this.slap = c.createConvolver(); this.slap.buffer = this.impulse(0.45, 4, 4000); this.slapGain = c.createGain(); this.slapGain.gain.value = 0.25;
    this.dry = c.createGain(); this.dry.connect(this.master); this.dry.connect(this.slap); this.slap.connect(this.slapGain); this.slapGain.connect(this.master);
    this.noiseBuf = this.makeNoise(4); this.whiteBuf = this.makeWhite(2); this.clickBuf = this.makeClick();
    return true;
  },
  makeNoise(sec) { const c = this.ctx, n = Math.ceil(c.sampleRate * sec), b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0); let last = 0; for (let i = 0; i < n; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = (w * 0.5 + last * 3); } return b; },
  makeWhite(sec) { const c = this.ctx, n = Math.ceil(c.sampleRate * sec), b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; return b; },
  makeClick() { const c = this.ctx, n = 64, b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = (i < 3 ? 1 : (Math.random() * 2 - 1) * Math.exp(-i / 12)); return b; },
  impulse(sec, decay, lp) { const c = this.ctx, n = Math.ceil(c.sampleRate * sec), b = c.createBuffer(2, n, c.sampleRate); for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); let y = 0; const k = Math.exp(-2 * Math.PI * lp / c.sampleRate); for (let i = 0; i < n; i++) { const w = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decay); y = k * y + (1 - k) * w; d[i] = y * 3; } } return b; },
  enabled() { return this.on && !gSim; },
  setVol(v) { this.vol = v; if (this.master) this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05); try { localStorage.setItem('BF5_vol', String(v)); } catch (e) {} },
  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); },
  // ---- building blocks ----
  noise(t, dur, { type = 'bandpass', freq = 1000, q = 1, gain = 0.5, attack = 0.005, sweepTo = null, out = null, white = false } = {}) {
    const c = this.ctx, src = c.createBufferSource(); src.buffer = white ? this.whiteBuf : this.noiseBuf; src.loop = true; src.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(out || this.fx); src.start(t, Math.random() * 1.5); src.stop(t + dur + 0.05);
  },
  tone(t, dur, freq, { type = 'sine', gain = 0.2, to = null, attack = 0.01, out = null, decay = null } = {}) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t); if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + (decay || dur));
    o.connect(g); g.connect(out || this.fx); o.start(t); o.stop(t + (decay || dur) + 0.05);
  },
  // a struck resonator: an impulse rings a bank of tuned filters (wood, leather, steel)
  ring(t, modes, gain, out) {
    const c = this.ctx, src = c.createBufferSource(); src.buffer = this.clickBuf; const g = c.createGain(); g.gain.value = gain; src.connect(g);
    for (const [freq, q, a] of modes) { const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq * (0.97 + Math.random() * 0.06); f.Q.value = q; const fg = c.createGain(); fg.gain.value = a; g.connect(f); f.connect(fg); fg.connect(out || this.dry); }
    src.start(t); src.stop(t + 0.01);
  },
  // ---- the crowd ----
  // a voice: a sawtooth with vibrato and a pitch glide, through three vowel filters. Many of them make a crowd.
  voice(t, dur, { f0 = 200, glide = 1.2, vowel = 'ah', gain = 0.03, attack = 0.3, release = 0.6, out = null }) {
    const c = this.ctx, V = { ah: [730, 1090, 2440], oh: [570, 840, 2410], oo: [300, 870, 2240], ay: [660, 1720, 2410], ee: [270, 2290, 3010] }[vowel] || [730, 1090, 2440];
    const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f0 * glide, t + attack); o.frequency.exponentialRampToValueAtTime(f0 * glide * 0.92, t + dur);
    const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = 4.5 + Math.random() * 2.5; lg.gain.value = 8 + Math.random() * 10; lfo.connect(lg); lg.connect(o.detune);
    const env = c.createGain(); env.gain.setValueAtTime(0.0001, t); env.gain.exponentialRampToValueAtTime(gain, t + attack); env.gain.setValueAtTime(gain, t + Math.max(attack, dur - release)); env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(env);
    V.forEach((fr, i) => { const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = fr * (0.95 + Math.random() * 0.1); f.Q.value = 6 + i * 2; const fg = c.createGain(); fg.gain.value = [1, 0.55, 0.22][i]; env.connect(f); f.connect(fg); fg.connect(out || this.fx); });
    o.start(t); o.stop(t + dur + 0.05); lfo.start(t); lfo.stop(t + dur + 0.05);
  },
  // applause: a shower of tiny claps whose density follows a curve
  applause(t, dur, gain, density) {
    const c = this.ctx; const n = Math.floor(dur * density * (0.5 + this.crowd)); const out = this.fx;
    for (let i = 0; i < n; i++) {
      const u = Math.random(); const tt = t + dur * (0.5 * u + 0.5 * u * u);   // more claps as it builds
      const env = Math.sin(Math.PI * Math.min(1, (tt - t) / dur));
      this.noise(tt, 0.008 + Math.random() * 0.012, { type: 'bandpass', freq: 1400 + Math.random() * 2600, q: 2.5, gain: gain * env * (0.4 + Math.random() * 0.6), attack: 0.001, white: true, out });
    }
  },
  whistle(t, gain) { const f = 2200 + Math.random() * 900; this.tone(t, 0.35 + Math.random() * 0.3, f, { gain, to: f * (1.15 + Math.random() * 0.2), attack: 0.03 }); this.tone(t + 0.4, 0.25, f * 1.25, { gain: gain * 0.7, to: f * 0.95, attack: 0.03 }); },
  // the roar: voices + applause + whistles with a swell. kind: cheer | ooh | groan | boo
  roar(t, dur, inten, kind) {
    inten *= 0.5 + 0.7 * this.crowd; if (inten <= 0.01) return;
    const n = Math.round(6 + 14 * Math.min(1, inten)), attack = kind === 'cheer' ? 0.25 + 0.3 * Math.min(1, inten) : 0.12;
    const vowel = kind === 'cheer' ? (Math.random() < 0.5 ? 'ay' : 'ah') : kind === 'ooh' ? 'oo' : kind === 'groan' ? 'oh' : 'oo';
    for (let i = 0; i < n; i++) {
      const f0 = (kind === 'boo' ? 120 : 140) + Math.random() * (kind === 'cheer' ? 260 : 150);
      const glide = kind === 'cheer' ? 1.15 + Math.random() * 0.25 : kind === 'ooh' ? 1.3 : 0.78;
      this.voice(t + Math.random() * attack * 1.2, dur * (0.7 + Math.random() * 0.3), { f0, glide, vowel, gain: 0.036 * inten / Math.sqrt(n / 10), attack: attack + Math.random() * 0.2, release: dur * 0.4 });
    }
    if (kind === 'cheer') { this.applause(t + 0.1, dur, 0.75 * inten, 90 + 120 * inten); if (inten > 0.45 && this.crowd > 0.4) for (let i = 0; i < 2 + Math.floor(inten * 4); i++) this.whistle(t + 0.3 + Math.random() * dur * 0.6, 0.012 + Math.random() * 0.015); }
    if (kind === 'boo') this.noise(t + 0.1, dur, { type: 'bandpass', freq: 280, q: 1.5, gain: 0.25 * inten, attack: 0.3 });
    if (kind === 'ooh') this.noise(t, dur * 0.8, { type: 'bandpass', freq: 600, q: 1, gain: 0.12 * inten, attack: attack, sweepTo: 350 });
  },
  cheer(t, dur, gain, big) { this.roar(t, dur, gain * (big ? 1.4 : 1), 'cheer'); },
  groan(t, gain) { this.roar(t, 1.3, gain, 'groan'); },
  boo(t, gain) { this.roar(t, 1.8, gain, 'boo'); },
  ooh(t, gain) { this.roar(t, 1.1, gain, 'ooh'); },
  murmur(t, gain) { gain *= 0.55 + 0.6 * this.crowd; for (let i = 0; i < 4; i++) this.voice(t + Math.random() * 0.2, 0.9, { f0: 130 + Math.random() * 120, glide: 1.03, vowel: 'oh', gain: gain * 0.08, attack: 0.25, release: 0.5 }); this.applause(t, 0.8, gain * 0.5, 30); },
  // ---- the field ----
  // the swing, then ash on horsehide: a broadband crack and the barrel ringing
  crack(t, power, quality) {
    quality = quality == null ? 1 : quality;   // 1 = squared up, 0.4 = off the end
    this.noise(t - 0.09, 0.1, { type: 'bandpass', freq: 500, q: 0.6, gain: 0.16 * power, attack: 0.07, sweepTo: 1600, white: true, out: this.dry });
    this.noise(t, 0.006, { type: 'highpass', freq: 3000, gain: 0.8 * power, attack: 0.0005, white: true, out: this.dry });
    this.ring(t, [[1180, 18, 0.9 * quality], [1760, 22, 0.55 * quality], [2650, 24, 0.4], [4200, 20, 0.25], [640, 10, 0.5 * (1.4 - quality)]], 1.0 * power);
    this.tone(t, 0.05, 210 * (quality > 0.7 ? 1 : 0.8), { gain: 0.35 * power, to: 80, attack: 0.001 });
    if (quality > 0.8) this.tone(t + 0.004, 0.18, 1150 + Math.random() * 60, { type: 'triangle', gain: 0.05 * power, to: 1050, attack: 0.002, out: this.dry });
  },
  pop(t, power) { this.ring(t, [[380, 6, 1], [720, 8, 0.6], [1500, 5, 0.35]], 1.4 * power); this.noise(t, 0.035, { type: 'lowpass', freq: 1200, gain: 0.6 * power, attack: 0.001, white: true, out: this.dry }); this.tone(t, 0.07, 150, { gain: 0.35 * power, to: 50, attack: 0.001, out: this.dry }); },
  clang(t, power) { this.ring(t, [[640, 40, 1], [1480, 50, 0.7], [2210, 45, 0.5], [3390, 40, 0.3]], 1.2 * power); this.noise(t, 0.03, { type: 'highpass', freq: 2500, gain: 0.5 * power, attack: 0.001, white: true, out: this.dry }); },
  roll(t, dur) { this.noise(t, dur, { type: 'lowpass', freq: 900, q: 0.5, gain: 0.14, attack: 0.03, sweepTo: 300, out: this.dry }); for (let i = 0; i < dur * 18; i++) this.noise(t + Math.random() * dur, 0.015, { type: 'bandpass', freq: 600 + Math.random() * 800, q: 3, gain: 0.08, attack: 0.002, out: this.dry }); },
  slide(t) { this.noise(t, 0.35, { type: 'bandpass', freq: 900, q: 0.8, gain: 0.35, attack: 0.02, sweepTo: 400, white: true, out: this.dry }); this.noise(t + 0.3, 0.06, { type: 'lowpass', freq: 500, gain: 0.3, attack: 0.002, out: this.dry }); },
  firework(t) { this.tone(t, 0.9, 90, { gain: 0.5, to: 35, attack: 0.002 }); this.noise(t, 0.5, { type: 'lowpass', freq: 400, gain: 0.5, attack: 0.002, white: true }); for (let i = 0; i < 26; i++) this.noise(t + 0.05 + Math.random() * 1.2, 0.012, { type: 'bandpass', freq: 2000 + Math.random() * 4000, q: 3, gain: 0.25 * (1 - i / 30), attack: 0.001, white: true }); this.tone(t - 0.9, 0.9, 400, { gain: 0.05, to: 1500, attack: 0.3, type: 'triangle' }); },
  fireworks(t, n) { for (let i = 0; i < n; i++) this.firework(t + 0.9 + i * (0.5 + Math.random() * 0.5)); },
  stomp(t) { this.tone(t, 0.14, 120, { gain: 0.6, to: 45, attack: 0.002 }); this.noise(t, 0.05, { type: 'lowpass', freq: 300, gain: 0.5, attack: 0.001, white: true }); },
  clap(t, gain) { for (let i = 0; i < 18; i++) this.noise(t + Math.random() * 0.03, 0.01 + Math.random() * 0.01, { type: 'bandpass', freq: 1500 + Math.random() * 2500, q: 2.5, gain: gain * (0.5 + Math.random() * 0.5), attack: 0.001, white: true }); },
  // ---- the organ (drawbars, percussion, a Leslie wobble) ----
  organNote(t, dur, midi, gain) {
    const c = this.ctx, f = 440 * Math.pow(2, (midi - 69) / 12), g = c.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.015); g.gain.setValueAtTime(gain, t + dur - 0.04); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.06);
    const vib = c.createOscillator(), vg = c.createGain(); vib.frequency.value = 6.4; vg.gain.value = 5; vib.connect(vg);
    const trem = c.createOscillator(), tg = c.createGain(), tb = c.createGain(); trem.frequency.value = 6.4; tg.gain.value = 0.18; tb.gain.value = 1; trem.connect(tg); tg.connect(tb.gain);
    [[0.5, 0.45], [1, 0.9], [1.5, 0.3], [2, 0.7], [3, 0.35], [4, 0.3], [5, 0.12], [6, 0.18], [8, 0.1]].forEach(([m, a]) => { const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = f * m; vg.connect(o.detune); const og = c.createGain(); og.gain.value = a * 0.28; o.connect(og); og.connect(tb); o.start(t); o.stop(t + dur + 0.1); });
    // percussion: the 2nd and 3rd harmonic click in and die away fast
    [[2, 0.5], [3, 0.35]].forEach(([m, a]) => { const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = f * m; const pg = c.createGain(); pg.gain.setValueAtTime(a * 0.6, t); pg.gain.exponentialRampToValueAtTime(0.0001, t + 0.18); o.connect(pg); pg.connect(tb); o.start(t); o.stop(t + 0.25); });
    tb.connect(g); vib.start(t); vib.stop(t + dur + 0.1); trem.start(t); trem.stop(t + dur + 0.1);
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 4200; g.connect(lp); lp.connect(this.fx);
  },
  organ(t, melody, bpm, gain) {
    const beat = 60 / bpm; let tt = t;
    for (const [n, b] of melody) { const dur = beat * b; if (n != null) (Array.isArray(n) ? n : [n]).forEach(m => this.organNote(tt, dur * 0.9, m, gain / Math.sqrt(Array.isArray(n) ? n.length : 1))); tt += dur; }
    return tt - t;
  },
  MELODY: {
    charge: [[67, 0.5], [72, 0.5], [76, 0.5], [79, 0.8], [76, 0.3], [79, 1.6]],
    takeMeOut: [[72, 1], [72, 1], [69, 0.5], [67, 0.5], [64, 0.5], [67, 1.5], [62, 2], [72, 1], [72, 1], [69, 0.5], [67, 0.5], [64, 0.5], [67, 1.5], [62, 2], [72, 1], [71, 0.5], [72, 0.5], [67, 0.5], [68, 0.5], [69, 1], [72, 1], [69, 1], [64, 1], [62, 1], [60, 2]],
    riff1: [[60, 0.25], [64, 0.25], [67, 0.25], [72, 0.25], [76, 0.25], [79, 0.75], [[72, 76, 79], 1]],
    riff2: [[67, 0.3], [67, 0.3], [67, 0.3], [63, 0.9], [65, 0.3], [67, 0.3], [70, 0.3], [67, 1]],
    riff3: [[72, 0.25], [71, 0.25], [69, 0.25], [67, 0.25], [65, 0.25], [64, 0.25], [62, 0.25], [60, 0.5], [[60, 64, 67], 1.2]],
    hatDance: [[67, 0.25], [67, 0.25], [67, 0.25], [64, 0.25], [null, 0.25], [67, 0.25], [67, 0.25], [67, 0.25], [64, 0.25], [null, 0.25], [67, 0.25], [67, 0.25], [67, 0.25], [64, 0.25], [67, 0.25], [64, 0.25], [60, 0.75]],
    hava: [[64, 0.5], [65, 0.5], [68, 0.5], [65, 0.5], [64, 0.5], [65, 0.5], [68, 1], [68, 0.5], [67, 0.5], [68, 0.5], [67, 0.5], [65, 0.5], [67, 0.5], [68, 1]],
    nanaHey: [[64, 0.5], [64, 0.5], [64, 0.5], [67, 0.5], [69, 1], [69, 0.5], [67, 0.5], [69, 0.5], [67, 1], [null, 0.5], [64, 0.5], [64, 0.5], [64, 0.5], [62, 0.5], [60, 1.5]],
    tequila: [[65, 0.25], [64, 0.25], [65, 0.25], [64, 0.25], [65, 0.5], [60, 0.5], [65, 0.25], [64, 0.25], [65, 0.25], [64, 0.25], [65, 0.5], [60, 0.5], [[65, 69], 0.5], [null, 0.25], [[65, 69], 0.5]],
    letsGo: [[67, 0.5], [64, 1], [null, 0.5], [67, 0.25], [67, 0.25], [67, 0.25], [null, 0.25]],
    fanfare: [[[60, 64, 67], 0.5], [[60, 64, 67], 0.5], [[65, 69, 72], 0.5], [[67, 71, 74], 1.5], [[72, 76, 79], 2]],
    rally: [[67, 0.4], [67, 0.4], [69, 0.4], [71, 0.4], [72, 1.2], [null, 0.4], [67, 0.4], [67, 0.4], [69, 0.4], [71, 0.4], [72, 1.2]],
    walkup1: [[60, 0.2], [63, 0.2], [65, 0.2], [66, 0.2], [67, 0.6]],
    walkup2: [[67, 0.15], [71, 0.15], [74, 0.15], [79, 0.5]],
    walkup3: [[72, 0.2], [70, 0.2], [67, 0.2], [65, 0.2], [63, 0.6]],
    chaChaCha: [[60, 0.33], [60, 0.33], [60, 0.34], [null, 0.5], [[60, 64, 67], 0.5]],
  },
  // we will rock you: stomp, stomp, clap (it came out in October 1977)
  rockYou(t, bars) { for (let i = 0; i < bars; i++) { const b = t + i * 1.2; this.stomp(b); this.stomp(b + 0.3); this.clap(b + 0.6, 0.45); } },
  letsGo(t, nick) { this.organ(t, this.MELODY.letsGo, 150, 0.1); this.clap(t + 1.0, 0.3); this.clap(t + 1.2, 0.3); this.clap(t + 1.4, 0.3); this.say('Let\'s go ' + nick + '!', 'crowd'); },
  // ---- the voices: public address, umpire, vendor ----
  // the browser's voices, best first: the natural ones modern browsers ship (but never pick by default) go to the top
  voices() {
    if (typeof speechSynthesis === 'undefined') return [];
    const score = v => (/natural|online|premium|enhanced|neural/i.test(v.name) ? 100 : 0) + (/google/i.test(v.name) ? 50 : 0) + (/en[-_]US/i.test(v.lang) ? 20 : /^en/i.test(v.lang) ? 10 : -50) + (/\b(alex|samantha|daniel|tom|aaron|guy|christopher|eric|andrew|brian|ryan|evan|davis|jason)\b/i.test(v.name) ? 30 : 0) + (/desktop|zira|espeak|compact/i.test(v.name) ? -40 : 0);
    return speechSynthesis.getVoices().filter(v => /^en/i.test(v.lang)).map(v => ({ v, s: score(v) })).sort((a, b) => b.s - a.s).map(x => x.v);
  },
  pickVoice() { const vs = this.voices(); let want = ''; try { want = typeof opt === 'function' ? opt('Voice') : ''; } catch (e) {} if (want && want !== 'Automatic') { const f = vs.find(v => v.name === want); if (f) return f; } return vs[0] || null; },
  say(text, who, force) {
    if ((!force && !this.enabled()) || typeof speechSynthesis === 'undefined' || !text) return;
    try { const m = typeof opt === 'function' ? opt('Announcer voice') : 'Big moments'; if (!force && (m === 'Off' || (who === 'batter' && m !== 'Every batter'))) return; } catch (e) { return; }
    if (who === 'batter') who = 'pa';
    try {
      if (who !== 'crowd') speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      const pick = this.pickVoice(); if (pick) u.voice = pick;
      const P = { pa: [1, 0.95, 1], ump: [0.8, 1.1, 1], vendor: [1.1, 1.05, 0.7], crowd: [1, 1, 0.8] }[who] || [1, 1, 1];
      u.pitch = P[0]; u.rate = P[1]; u.volume = P[2] * this.vol;
      speechSynthesis.speak(u);
    } catch (e) {}
  },
  // ---- the ambient crowd bed: voices that never quite stop, a little applause now and then ----
  ambient(on) {
    if (!this.init()) return; const c = this.ctx;
    if (on && !this.ambientOn) {
      this.ambientOn = true; this.ambGain = c.createGain(); this.ambGain.gain.value = 0.0001; this.ambGain.connect(this.master);
      const mk = (freq, q, g, white) => { const s = c.createBufferSource(); s.buffer = white ? this.whiteBuf : this.noiseBuf; s.loop = true; const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q; const gg = c.createGain(); gg.gain.value = g; s.connect(f); f.connect(gg); gg.connect(this.ambGain); s.start(); return gg; };
      this.ambLayers = [mk(200, 0.5, 0.9), mk(560, 1.2, 0.3), mk(900, 1.6, 0.14), mk(2400, 1.2, 0.03, true)];
      [0.11, 0.07, 0.17].forEach((hz, i) => { const lfo = c.createOscillator(), lg = c.createGain(); lfo.type = 'sine'; lfo.frequency.value = hz; lg.gain.value = [0.3, 0.12, 0.05][i]; lfo.connect(lg); lg.connect(this.ambLayers[i + 1].gain); lfo.start(); });
      this.ambGain.gain.setTargetAtTime(this.level, c.currentTime, 1.5);
      this.ambTimer = setInterval(() => { if (!this.on || gSim || !this.ambientOn) return; const t = this.ctx.currentTime; if (Math.random() < 0.5) this.applause(t, 1.2, 0.08 * this.level * 10, 25); if (Math.random() < 0.25) this.voice(t, 0.7, { f0: 180 + Math.random() * 120, glide: 1.1, vowel: 'ay', gain: 0.012 * this.level * 10, attack: 0.1, release: 0.3 }); if (Math.random() < 0.2 && this.crowd > 0.5) this.whistle(t, 0.006); }, 9000);
    } else if (!on && this.ambientOn) { this.ambGain.gain.setTargetAtTime(0.0001, c.currentTime, 0.8); }
    if (on && this.ambientOn) this.ambGain.gain.setTargetAtTime(this.level, c.currentTime, 1.2);
  },
  setLevel(x) { this.level = clamp(x, 0, 0.25); if (this.ambientOn && this.ambGain) this.ambGain.gain.setTargetAtTime(this.on ? this.level : 0.0001, this.ctx.currentTime, 1.2); },
  // ---- events ----
  // o = { home: true when the good thing happened for the home team, big: a bigger moment, nick: the home nickname, name: a player }
  play(name, delay, o) {
    if (!this.enabled() || !this.init()) return; this.resume(); o = o || {};
    const now = this.ctx.currentTime; let t = Math.max(now + (delay || 0), this.busyUntil);
    const dur = this.make(name, t, o) || 0.3;
    this.busyUntil = t + Math.min(dur, 0.9);
  },
  make(name, t, o) {
    const home = !!o.home, react = home ? 1 : 0.4, M = this.MELODY;    // the home crowd roars; a visitor's good moment gets a polite murmur
    const VEND = ['Cold beer here! Ice cold beer!', 'Peanuts! Popcorn! Cracker Jack!', 'Hot dogs! Get your hot dogs!', 'Scorecards! You can\'t tell the players without a scorecard!', 'Programs! Get your programs here!', 'Ice cream! Ice cold ice cream!'];
    switch (name) {
      case 'dice': for (let i = 0; i < 9; i++) { const s = t + i * 0.05 + Math.random() * 0.03; this.ring(s, [[900 + Math.random() * 600, 8, 0.8], [2400 + Math.random() * 1500, 6, 0.5]], 0.7); } this.ring(t + 0.52, [[1400, 10, 0.9], [3200, 8, 0.5]], 0.9); this.ring(t + 0.6, [[1200, 10, 0.9], [2900, 8, 0.5]], 0.7); return 0.7;
      case 'click': this.ring(t, [[1800, 6, 0.6], [3600, 5, 0.3]], 0.5); return 0.05;
      case 'hit': this.crack(t, 0.9, 0.85); this.roll(t + 0.3, 0.5); this.cheer(t + 0.3, 1.5, 0.3 * react, false); if (!home) this.murmur(t + 0.3, 0.2); return 0.8;
      case 'double': this.crack(t, 1.05, 1); this.cheer(t + 0.35, 2.2, 0.45 * react, home); if (home) this.organ(t + 1.6, M.walkup2, 170, 0.07); return 1.1;
      case 'triple': this.crack(t, 1.1, 1); this.ooh(t + 0.4, 0.3); this.cheer(t + 1.2, 2.8, 0.55 * react, home); return 1.3;
      case 'homer': this.crack(t, 1.35, 1); this.ooh(t + 0.3, home ? 0.5 : 0.3); this.cheer(t + 1.0, home ? 5 : 2.2, home ? 0.9 : 0.25, home); if (home) { this.organ(t + 1.8, M.charge, 175, 0.13); if (o.big) this.fireworks(t + 2.5, 3); } else this.groan(t + 1.2, 0.3); return home ? 3.4 : 1.8;
      case 'wall': this.crack(t, 1.15, 1); this.ooh(t + 0.35, 0.5); this.clang(t + 1.05, 1); this.cheer(t + 1.3, 1.8, 0.35 * react, false); return 2;
      case 'foul': this.crack(t, 0.7, 0.4); this.ooh(t + 0.25, 0.22); return 0.9;
      case 'score': this.cheer(t, home ? 2.6 : 1.2, home ? 0.6 : 0.2, home); return 1;
      case 'out': this.pop(t, 1); this.cheer(t + 0.25, 1.1, 0.22 * (home ? 1 : 0.45), false); return 0.6;
      case 'groundout': this.crack(t, 0.7, 0.5); this.roll(t + 0.1, 0.4); this.pop(t + 0.75, 1); this.cheer(t + 0.95, 1.1, 0.22 * (home ? 1 : 0.45), false); return 1.3;
      case 'flyout': this.crack(t, 0.8, 0.6); this.pop(t + 1.1, 0.9); this.cheer(t + 1.25, 1, 0.2 * (home ? 1 : 0.45), false); return 1.5;
      case 'dp': this.crack(t, 0.75, 0.5); this.pop(t + 0.55, 1); this.pop(t + 0.85, 1.1); this.cheer(t + 1.0, home ? 2.4 : 1.2, home ? 0.6 : 0.2, home); if (home) this.say('Two!', 'ump'); return 1.8;
      case 'strikeout': this.noise(t, 0.14, { type: 'bandpass', freq: 400, q: 1.5, gain: 0.3, sweepTo: 3000, white: true, out: this.dry }); this.pop(t + 0.16, 1.15); this.cheer(t + 0.45, home ? 2 : 0.9, home ? 0.5 : 0.15, false); this.say(Math.random() < 0.5 ? 'Strike three!' : 'Steerike three!', 'ump'); return 1.2;
      case 'walk': this.murmur(t, 0.4); if (!home) this.boo(t + 0.2, 0.28); this.say('Ball four.', 'ump'); return 0.9;
      case 'hbp': this.noise(t, 0.04, { type: 'lowpass', freq: 500, gain: 0.7, attack: 0.001, white: true, out: this.dry }); this.ooh(t + 0.1, 0.4); this.groan(t + 0.6, 0.25); return 1.2;
      case 'error': this.pop(t, 0.5); this.roll(t + 0.1, 0.3); if (home) this.cheer(t + 0.3, 1.4, 0.3, false); else { this.groan(t + 0.2, 0.4); this.boo(t + 0.8, 0.35); } return 1.3;
      case 'safe': this.slide(t); this.cheer(t + 0.3, 1.8, (o.big ? 0.7 : 0.45) * react, home || o.big); this.say('Safe!', 'ump'); return 1.1;
      case 'caught': this.slide(t); this.pop(t + 0.28, 1); this.cheer(t + 0.45, 1.3, home ? 0.45 : 0.15, false); this.say(Math.random() < 0.5 ? 'Out!' : 'You\'re out!', 'ump'); return 1;
      case 'inning': { const r = [M.riff1, M.riff2, M.riff3, M.hatDance, M.tequila, M.hava, M.chaChaCha][Math.floor(Math.random() * 7)]; this.organ(t + 0.2, r, 150, 0.1); this.murmur(t, 0.15); if (Date.now() - this.lastVendor > 60000 && Math.random() < 0.45) { this.lastVendor = Date.now(); setTimeout(() => this.say(VEND[Math.floor(Math.random() * VEND.length)], 'vendor'), 2500); } return 1.8; }
      case 'stretch': this.say('Ladies and gentlemen, please rise for the seventh-inning stretch.', 'pa'); this.organ(t + 3.2, M.takeMeOut, 140, 0.11); this.cheer(t + 3.2 + 17.5, 3, 0.45, true); return 3;
      case 'charge': this.organ(t, M.charge, 175, 0.12); this.cheer(t + 2.1, 1.6, 0.45, true); return 2.2;
      case 'rally': if (Math.random() < 0.5) this.organ(t, M.rally, 160, 0.09); else this.rockYou(t, 3); return 2;
      case 'letsgo': this.letsGo(t, o.nick || 'home team'); return 2;
      case 'final': this.cheer(t, home ? 4.5 : 2, home ? 0.85 : 0.35, home); if (home) { this.organ(t + 0.8, M.fanfare, 130, 0.13); this.organ(t + 4.2, M.nanaHey, 150, 0.1); } else this.organ(t + 1, M.riff3, 150, 0.09); setTimeout(() => this.say('Thank you for coming, fans. Please drive home safely.', 'pa'), home ? 9000 : 5000); return 3;
      case 'walkoff': this.ooh(t, 0.5); this.cheer(t + 0.6, 7, 1, true); this.fireworks(t + 1.2, 5); this.organ(t + 1.0, M.charge, 180, 0.14); this.organ(t + 4.0, M.fanfare, 140, 0.13); this.organ(t + 8.0, M.nanaHey, 150, 0.1); return 4;
      case 'warmup': for (let i = 0; i < 3; i++) this.pop(t + i * 0.45, 0.7); this.murmur(t, 0.12); return 1.4;
      case 'playball': this.organ(t, M.fanfare, 140, 0.12); this.cheer(t + 1.2, 2.6, 0.5, true); setTimeout(() => this.say('Play ball!', 'ump'), 1600); return 2.6;
      case 'batter': { const r = [M.walkup1, M.walkup2, M.walkup3][Math.floor(Math.random() * 3)]; if (home && Math.random() < 0.5) this.organ(t, r, 170, 0.06); if (o.name) this.say('Now batting, ' + o.name + '.', 'batter'); return 0.3; }
      case 'pa': this.tone(t, 0.35, 660, { type: 'sine', gain: 0.1 }); this.tone(t + 0.3, 0.6, 880, { type: 'sine', gain: 0.1 }); if (o.text) setTimeout(() => this.say(o.text, 'pa'), 600); return 0.9;
      case 'name': this.cheer(t, 0.9, 0.25, false); if (o.text) this.say(o.text, 'pa'); return 0.4;
      case 'star': this.cheer(t, 1.8, 0.5, true); if (o.text) this.say(o.text, 'pa'); return 0.6;
      case 'cheer': this.cheer(t, 1.8, 0.45, true); return 0.8;
      case 'murmur': this.murmur(t, 0.2); return 0.4;
      case 'tension': this.clap(t, 0.15); this.clap(t + 0.5, 0.15); this.clap(t + 1, 0.18); this.clap(t + 1.5, 0.2); return 0.5;
    }
    return 0;
  },
  toggle() { this.on = !this.on; try { localStorage.setItem('BF5_sound', this.on ? '1' : '0'); } catch (e) {} if (this.on) { this.play('click'); this.ambient(true); } else { if (this.ambientOn) this.ambient(false); try { speechSynthesis.cancel(); } catch (e) {} } },
  load() { try { this.on = localStorage.getItem('BF5_sound') !== '0'; const v = parseFloat(localStorage.getItem('BF5_vol')); if (!isNaN(v)) this.vol = v; } catch (e) {} try { if (typeof speechSynthesis !== 'undefined') { speechSynthesis.getVoices(); speechSynthesis.addEventListener('voiceschanged', () => { if (typeof curScreen !== 'undefined' && curScreen === 'options' && typeof UI !== 'undefined') UI.refresh(); }); } } catch (e) {} },
};
const sfx = (name, delay, o) => { if (/homer|walkoff|final|score|triple/.test(name) && typeof gSpark !== 'undefined') gSpark = Date.now() + 2600; return Snd.play(name, delay, o); };
