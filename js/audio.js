// audio.js — procedural WebAudio: surf wash, koto plucks, taiko
(function () {
  const H = window.H;
  let ctx = null, master, washGain, washFilter, muted = false;
  try { muted = localStorage.getItem('namiura_mute') === '1'; } catch (e) {}
  const SCALE = [293.66, 311.13, 392.0, 440.0, 466.16, 587.33, 622.25, 783.99, 880.0, 932.33]; // miyako-bushi on D

  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      ctx = new AC();
      master = ctx.createGain(); master.gain.value = muted ? 0 : 0.8; master.connect(ctx.destination);
      const len = ctx.sampleRate * 2, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
      let b = 0;
      for (let i = 0; i < len; i++) { b = 0.97 * b + 0.03 * (Math.random() * 2 - 1); d[i] = b * 6; }
      const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
      washFilter = ctx.createBiquadFilter(); washFilter.type = 'bandpass'; washFilter.frequency.value = 500; washFilter.Q.value = 0.6;
      washGain = ctx.createGain(); washGain.gain.value = 0.0;
      src.connect(washFilter); washFilter.connect(washGain); washGain.connect(master); src.start();
    } catch (e) { ctx = null; }
  }
  function wash(speed01, carve01) {
    if (!ctx) return;
    const t = ctx.currentTime;
    washGain.gain.setTargetAtTime(0.10 + 0.22 * speed01 + 0.25 * carve01, t, 0.15);
    washFilter.frequency.setTargetAtTime(380 + 900 * speed01 + 1400 * carve01, t, 0.12);
  }
  function pluck(i, vol) {
    if (!ctx) return;
    const t = ctx.currentTime, f = SCALE[Math.max(0, i) % SCALE.length];
    const o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain(), lp = ctx.createBiquadFilter();
    o.type = 'sawtooth'; o.frequency.value = f; o2.type = 'triangle'; o2.frequency.value = f * 2.005;
    lp.type = 'lowpass'; lp.frequency.setValueAtTime(4200, t); lp.frequency.exponentialRampToValueAtTime(500, t + 0.5);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol || 0.22, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
    o.connect(lp); o2.connect(lp); lp.connect(g); g.connect(master);
    o.start(t); o2.start(t); o.stop(t + 1); o2.stop(t + 1);
  }
  function taiko(vol) {
    if (!ctx) return;
    const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(48, t + 0.25);
    g.gain.setValueAtTime(vol || 0.7, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.6);
  }
  function splash(vol) {
    if (!ctx) return;
    const t = ctx.currentTime, len = ctx.sampleRate * 0.7 | 0, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
    const s = ctx.createBufferSource(); s.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 700;
    const g = ctx.createGain(); g.gain.value = vol || 0.35;
    s.connect(f); f.connect(g); g.connect(master); s.start(t);
  }
  function thunder(vol) {
    if (!ctx) return;
    const t = ctx.currentTime, len = ctx.sampleRate * 1.6 | 0, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    let b = 0;
    for (let i = 0; i < len; i++) { b = 0.985 * b + 0.015 * (Math.random() * 2 - 1); d[i] = b * 14 * Math.pow(1 - i / len, 1.5) * (0.6 + 0.4 * Math.sin(i * 0.0009)); }
    const s = ctx.createBufferSource(); s.buffer = buf;
    const g = ctx.createGain(); g.gain.value = vol || 0.6;
    s.connect(g); g.connect(master); s.start(t);
  }
  function chime() { // entering a new print: a rising koto run
    [0, 2, 3, 5, 7].forEach((n, i) => setTimeout(() => pluck(n, 0.2), i * 110));
  }
  function setMuted(m) {
    muted = m; try { localStorage.setItem('namiura_mute', m ? '1' : '0'); } catch (e) {}
    if (ctx) master.gain.setTargetAtTime(m ? 0 : 0.8, ctx.currentTime, 0.05);
  }
  function suspend(s) { if (ctx) { try { s ? ctx.suspend() : ctx.resume(); } catch (e) {} } }
  H.audio = { init, wash, pluck, taiko, splash, thunder, chime, setMuted, suspend, get muted() { return muted; } };
})();
