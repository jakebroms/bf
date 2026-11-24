/* sound.js: the ballpark, made with the Web Audio API (no sound files).
   A crowd that murmurs along and reacts (louder for the home team), a stadium organ
   (Charge!, Take Me Out to the Ball Game, riffs between innings), bat cracks, glove pops. */
'use strict';
const Snd = {
  ctx: null, on: true, vol: 0.8, busyUntil: 0, level: 0.1, ambientOn: false, stretchDone: -1, lastOrgan: 0,
  init() {
    if (this.ctx) return true;
    try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { this.ctx = null; return false; }
    const c = this.ctx;
    this.master = c.createGain(); this.master.gain.value = this.vol;
    this.comp = c.createDynamicsCompressor(); this.comp.threshold.value = -12; this.comp.ratio.value = 4;
    this.master.connect(this.comp); this.comp.connect(c.destination);
    this.fx = c.createGain(); this.fx.gain.value = 1; this.fx.connect(this.master);
    // a touch of stadium echo
    this.verb = c.createConvolver(); this.verb.buffer = this.impulse(1.6, 2.5); this.verbGain = c.createGain(); this.verbGain.gain.value = 0.22;
    this.fx.connect(this.verb); this.verb.connect(this.verbGain); this.verbGain.connect(this.master);
    this.noiseBuf = this.makeNoise(4);
    return true;
  },
  makeNoise(sec) { const c = this.ctx, n = Math.ceil(c.sampleRate * sec), b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0); let last = 0; for (let i = 0; i < n; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = (w * 0.5 + last * 3); } return b; },
  impulse(sec, decay) { const c = this.ctx, n = Math.ceil(c.sampleRate * sec), b = c.createBuffer(2, n, c.sampleRate); for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decay); } return b; },
  enabled() { return this.on && !gSim; },
  setVol(v) { this.vol = v; if (this.master) this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05); try { localStorage.setItem('BF5_vol', String(v)); } catch (e) {} },
  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); },
  // ---- building blocks ----
  noise(t, dur, { type = 'bandpass', freq = 1000, q = 1, gain = 0.5, attack = 0.005, sweepTo = null, out = null } = {}) {
    const c = this.ctx, src = c.createBufferSource(); src.buffer = this.noiseBuf; src.loop = true; src.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(out || this.fx); src.start(t, Math.random() * 3); src.stop(t + dur + 0.05);
  },
  tone(t, dur, freq, { type = 'sine', gain = 0.2, to = null, attack = 0.01, out = null } = {}) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t); if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(out || this.fx); o.start(t); o.stop(t + dur + 0.05);
  },
  // the crowd: layered voices (noise through formant-like filters) with a swell
  cheer(t, dur, gain, big) {
    const a = dur * 0.25;
    this.noise(t, dur, { type: 'bandpass', freq: 350, q: 0.7, gain: gain * 0.9, attack: a });
    this.noise(t, dur, { type: 'bandpass', freq: 900, q: 0.8, gain: gain * 0.7, attack: a });
    this.noise(t, dur, { type: 'bandpass', freq: 1900, q: 1, gain: gain * 0.35, attack: a });
    this.noise(t, dur, { type: 'lowpass', freq: 250, gain: gain * 0.5, attack: a });
    if (big) { for (let i = 0; i < 6; i++) { const s = t + 0.3 + Math.random() * dur * 0.6; this.tone(s, 0.25 + Math.random() * 0.3, 1800 + Math.random() * 1200, { gain: 0.03, to: 1200 + Math.random() * 800 }); } }
    for (let i = 0; i < (big ? 10 : 4); i++) { const s = t + 0.2 + Math.random() * dur * 0.7; this.noise(s, 0.12, { type: 'bandpass', freq: 2500 + Math.random() * 2000, q: 4, gain: gain * 0.25, attack: 0.02 }); }
  },
  groan(t, gain) { this.noise(t, 1.1, { type: 'bandpass', freq: 420, q: 1.5, gain, attack: 0.15, sweepTo: 260 }); this.noise(t, 1.1, { type: 'lowpass', freq: 300, gain: gain * 0.7, attack: 0.15 }); for (let i = 0; i < 5; i++) this.tone(t + 0.05 + i * 0.03, 0.9, 170 + i * 11, { type: 'sawtooth', gain: 0.012, to: 110 + i * 7 }); },
  boo(t, gain) { for (let i = 0; i < 7; i++) this.tone(t + Math.random() * 0.2, 1.3, 190 + Math.random() * 40, { type: 'sawtooth', gain: gain * 0.03, to: 150 + Math.random() * 30, attack: 0.2 }); this.noise(t, 1.4, { type: 'bandpass', freq: 300, q: 1.2, gain: gain * 0.6, attack: 0.2 }); },
  murmur(t, gain) { this.noise(t, 0.9, { type: 'bandpass', freq: 500, q: 0.8, gain, attack: 0.1 }); },
  crack(t, power) {
    // bat on ball: sharp transient, then the wood ringing
    this.noise(t, 0.012, { type: 'highpass', freq: 2500, gain: 0.9 * power, attack: 0.001 });
    this.noise(t, 0.06, { type: 'bandpass', freq: 1500, q: 2, gain: 0.7 * power, attack: 0.002 });
    this.noise(t, 0.09, { type: 'bandpass', freq: 3200, q: 3, gain: 0.35 * power, attack: 0.002 });
    this.tone(t, 0.07, 240, { gain: 0.25 * power, to: 90, attack: 0.002 });
    this.tone(t, 0.12, 1100 + Math.random() * 200, { type: 'triangle', gain: 0.08 * power, to: 700, attack: 0.003 });
  },
  pop(t, power) { this.noise(t, 0.05, { type: 'lowpass', freq: 900, q: 1, gain: 0.8 * power, attack: 0.002 }); this.noise(t, 0.02, { type: 'bandpass', freq: 2200, q: 2, gain: 0.3 * power, attack: 0.001 }); this.tone(t, 0.06, 140, { gain: 0.3 * power, to: 55, attack: 0.002 }); },
  // ---- the organ (additive, with vibrato and a little space) ----
  organNote(t, dur, midi, gain) {
    const c = this.ctx, f = 440 * Math.pow(2, (midi - 69) / 12), g = c.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.02); g.gain.setValueAtTime(gain, t + dur - 0.05); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.08);
    const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = 6; lg.gain.value = 6; lfo.connect(lg);
    [[1, 'square', 0.5], [2, 'sine', 0.35], [3, 'sine', 0.15], [0.5, 'sine', 0.25], [4, 'sine', 0.07]].forEach(([m, type, a]) => { const o = c.createOscillator(); o.type = type; o.frequency.value = f * m; lg.connect(o.detune); const og = c.createGain(); og.gain.value = a; o.connect(og); og.connect(g); o.start(t); o.stop(t + dur + 0.1); });
    lfo.start(t); lfo.stop(t + dur + 0.1);
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3200; g.connect(lp); lp.connect(this.fx);
  },
  organ(t, melody, bpm, gain) {
    // melody: [[midi or array of midis (chord), beats], ...]
    const beat = 60 / bpm; let tt = t;
    for (const [n, b] of melody) { const dur = beat * b; if (n != null) (Array.isArray(n) ? n : [n]).forEach(m => this.organNote(tt, dur * 0.92, m, gain / (Array.isArray(n) ? n.length : 1))); tt += dur; }
    return tt - t;
  },
  MELODY: {
    charge: [[67, 0.5], [72, 0.5], [76, 0.5], [79, 0.8], [76, 0.3], [79, 1.6]],
    takeMeOut: [[72, 1], [72, 1], [69, 0.5], [67, 0.5], [64, 0.5], [67, 1.5], [62, 2], [72, 1], [72, 1], [69, 0.5], [67, 0.5], [64, 0.5], [67, 1.5], [62, 2]],
    riff1: [[60, 0.25], [64, 0.25], [67, 0.25], [72, 0.25], [76, 0.25], [79, 0.75], [[72, 76, 79], 1]],
    riff2: [[67, 0.3], [67, 0.3], [67, 0.3], [63, 0.9], [65, 0.3], [67, 0.3], [70, 0.3], [67, 1]],
    riff3: [[72, 0.25], [71, 0.25], [69, 0.25], [67, 0.25], [65, 0.25], [64, 0.25], [62, 0.25], [60, 0.5], [[60, 64, 67], 1.2]],
    fanfare: [[[60, 64, 67], 0.5], [[60, 64, 67], 0.5], [[65, 69, 72], 0.5], [[67, 71, 74], 1.5], [[72, 76, 79], 2]],
    rally: [[67, 0.4], [67, 0.4], [69, 0.4], [71, 0.4], [72, 1.2], [null, 0.4], [67, 0.4], [67, 0.4], [69, 0.4], [71, 0.4], [72, 1.2]],
  },
  // ---- the ambient crowd bed ----
  ambient(on) {
    if (!this.init()) return; const c = this.ctx;
    if (on && !this.ambientOn) {
      this.ambientOn = true; this.ambGain = c.createGain(); this.ambGain.gain.value = 0.0001; this.ambGain.connect(this.master);
      const mk = (freq, q, g) => { const s = c.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true; const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q; const gg = c.createGain(); gg.gain.value = g; s.connect(f); f.connect(gg); gg.connect(this.ambGain); s.start(); return gg; };
      this.ambLayers = [mk(220, 0.5, 1), mk(520, 0.9, 0.35), mk(1100, 1.2, 0.07)];
      const lfo = c.createOscillator(), lg = c.createGain(); lfo.type = 'sine'; lfo.frequency.value = 0.13; lg.gain.value = 0.25; lfo.connect(lg); lg.connect(this.ambLayers[1].gain); lfo.start();
      this.ambGain.gain.setTargetAtTime(this.level, c.currentTime, 1.5);
    } else if (!on && this.ambientOn) { this.ambGain.gain.setTargetAtTime(0.0001, c.currentTime, 0.8); }
    if (on && this.ambientOn) this.ambGain.gain.setTargetAtTime(this.level, c.currentTime, 1.2);
  },
  setLevel(x) { this.level = clamp(x, 0, 0.25); if (this.ambientOn && this.ambGain) this.ambGain.gain.setTargetAtTime(this.on ? this.level : 0.0001, this.ctx.currentTime, 1.2); },
  // ---- events ----
  // o = { home: true when the good thing happened for the home team, big: a bigger moment }
  play(name, delay, o) {
    if (!this.enabled() || !this.init()) return; this.resume(); o = o || {};
    const now = this.ctx.currentTime; let t = Math.max(now + (delay || 0), this.busyUntil);
    const dur = this.make(name, t, o) || 0.3;
    this.busyUntil = t + Math.min(dur, 0.9);
  },
  make(name, t, o) {
    const home = !!o.home, react = home ? 1 : 0.45;    // the home crowd reacts; a visiting team's good moment gets a polite murmur
    switch (name) {
      case 'dice': for (let i = 0; i < 8; i++) { const s = t + i * 0.06 + Math.random() * 0.03; this.noise(s, 0.03, { type: 'bandpass', freq: 1800 + Math.random() * 2500, q: 5, gain: 0.9, attack: 0.002 }); this.tone(s, 0.035, 500 + Math.random() * 400, { type: 'triangle', gain: 0.12, to: 300, attack: 0.003 }); } return 0.55;
      case 'click': this.noise(t, 0.03, { freq: 2600, q: 4, gain: 0.6, attack: 0.002 }); this.tone(t, 0.04, 900, { type: 'triangle', gain: 0.08, to: 500 }); return 0.05;
      case 'hit': this.crack(t, 0.9); this.cheer(t + 0.25, 1.4, 0.25 * react, false); if (!home) this.murmur(t + 0.2, 0.15); return 0.7;
      case 'double': this.crack(t, 1.05); this.cheer(t + 0.3, 2, 0.4 * react, home); return 1;
      case 'triple': this.crack(t, 1.1); this.cheer(t + 0.3, 2.6, 0.5 * react, home); return 1.2;
      case 'homer': this.crack(t, 1.3); this.cheer(t + 0.35, home ? 4.5 : 2.2, home ? 0.75 : 0.25, home); if (home) { this.organ(t + 1.4, this.MELODY.charge, 170, 0.12); } else this.groan(t + 0.5, 0.2); return home ? 3.2 : 1.6;
      case 'score': this.cheer(t, home ? 2.4 : 1.2, home ? 0.5 : 0.18, home); return 1;
      case 'out': this.pop(t, 1); this.cheer(t + 0.2, 1, 0.18 * (home ? 1 : 0.5), false); return 0.55;
      case 'dp': this.pop(t, 1); this.pop(t + 0.32, 1.1); this.cheer(t + 0.5, home ? 2.2 : 1.2, home ? 0.55 : 0.2, home); return 1.4;
      case 'strikeout': this.noise(t, 0.16, { type: 'bandpass', freq: 500, q: 2, gain: 0.3, sweepTo: 3500 }); this.pop(t + 0.17, 1.1); this.cheer(t + 0.45, home ? 1.8 : 0.9, home ? 0.45 : 0.15, false); return 1.1;
      case 'walk': this.murmur(t, 0.35); if (!home) this.boo(t + 0.1, 0.25); return 0.8;
      case 'hbp': this.pop(t, 0.6); this.groan(t + 0.1, 0.3); return 1;
      case 'error': if (home) this.cheer(t, 1.4, 0.3, false); else { this.groan(t, 0.35); this.boo(t + 0.4, 0.3); } return 1.2;
      case 'safe': this.cheer(t, 1.6, 0.4 * react, home); return 1;
      case 'caught': this.pop(t, 1); this.cheer(t + 0.2, 1.3, home ? 0.4 : 0.15, false); return 0.9;
      case 'inning': { const r = [this.MELODY.riff1, this.MELODY.riff2, this.MELODY.riff3][Math.floor(Math.random() * 3)]; this.organ(t + 0.2, r, 150, 0.1); this.murmur(t, 0.15); return 1.6; }
      case 'stretch': this.organ(t + 0.3, this.MELODY.takeMeOut, 140, 0.11); this.cheer(t + 6.5, 2.5, 0.35, true); return 2;
      case 'charge': this.organ(t, this.MELODY.charge, 170, 0.12); this.cheer(t + 2.1, 1.4, 0.4, true); return 2;
      case 'rally': this.organ(t, this.MELODY.rally, 160, 0.09); return 2;
      case 'final': this.cheer(t, 4, home ? 0.8 : 0.35, home); if (home) this.organ(t + 0.8, this.MELODY.fanfare, 130, 0.13); else this.organ(t + 1, this.MELODY.riff3, 150, 0.09); return 3;
      case 'walkoff': this.cheer(t, 6, 0.95, true); this.organ(t + 0.6, this.MELODY.charge, 180, 0.14); this.organ(t + 3.2, this.MELODY.fanfare, 140, 0.13); return 4;
      case 'warmup': for (let i = 0; i < 3; i++) this.pop(t + i * 0.42, 0.7); this.murmur(t, 0.12); return 1.3;
      case 'playball': this.organ(t, this.MELODY.fanfare, 140, 0.12); this.cheer(t + 1.2, 2.5, 0.45, true); return 2.5;
      case 'tension': this.noise(t, 1.5, { type: 'bandpass', freq: 600, q: 1, gain: 0.12, attack: 0.5 }); return 0.5;
    }
    return 0;
  },
  toggle() { this.on = !this.on; try { localStorage.setItem('BF5_sound', this.on ? '1' : '0'); } catch (e) {} if (this.on) { this.play('click'); this.ambient(true); } else if (this.ambientOn) this.ambient(false); },
  load() { try { this.on = localStorage.getItem('BF5_sound') !== '0'; const v = parseFloat(localStorage.getItem('BF5_vol')); if (!isNaN(v)) this.vol = v; } catch (e) {} },
};
const sfx = (name, delay, o) => Snd.play(name, delay, o);
