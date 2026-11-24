// Render every sound event offline and report its peak level and length, to be sure nothing is silent or broken.
const { chromium } = require('playwright'); const path = require('path');
(async () => {
  const browser = await chromium.launch(); const page = await browser.newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('file://' + path.resolve(__dirname, '..', 'BallFive_1977.html')); await page.waitForSelector('#nav');
  const res = await page.evaluate(async () => {
    const names = ['dice', 'click', 'hit', 'double', 'triple', 'homer', 'score', 'out', 'dp', 'strikeout', 'walk', 'hbp', 'error', 'safe', 'caught', 'inning', 'stretch', 'charge', 'rally', 'final', 'walkoff', 'warmup', 'playball'];
    const out = {};
    for (const n of names) {
      const ctx = new OfflineAudioContext(1, 44100 * 8, 44100);
      const S = Object.create(Snd); S.ctx = ctx; S.master = ctx.createGain(); S.master.connect(ctx.destination); S.fx = ctx.createGain(); S.fx.connect(S.master); S.noiseBuf = S.makeNoise(4);
      S.verb = null;
      try { const d = S.make(n, 0.05, { home: true }); const buf = await ctx.startRendering(); const a = buf.getChannelData(0); let peak = 0, last = 0; for (let i = 0; i < a.length; i++) { const v = Math.abs(a[i]); if (v > peak) peak = v; if (v > 0.01) last = i; } out[n] = { dur: d, peak: +peak.toFixed(3), audibleSec: +(last / 44100).toFixed(2) }; }
      catch (e) { out[n] = 'ERR ' + e.message; }
    }
    return out;
  });
  for (const k in res) console.log(k.padEnd(10), JSON.stringify(res[k]));
  console.log('errors:', errors.join('|') || 'none'); await browser.close();
})();
