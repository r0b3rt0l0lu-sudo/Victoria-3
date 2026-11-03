/* ===== BANDA SONORA PROCEDURAL (WebAudio, sin archivos) =====
   Cuatro ambientes que se componen en directo con sintetizadores: MENÚ (majestuoso, re menor), PAZ (pastoral, sol mayor), GUERRA (marcha
   sombría, la menor) y BATALLA (tensa y rápida, mi menor). Cambian solos según lo que ocurre: pantalla de inicio, paz, guerra o batalla abierta.
   Además hay efectos de sonido (cañón, descargas de fusilería, corneta). El botón 🎵 de la barra superior activa o silencia todo
   y la rueda de volumen cambia el nivel. Se guarda la preferencia. */
const MUS = {ctx: null, master: null, bus: null, rev: null, nb: null, mood: null, layer: null, timer: 0, on: true, vol: 0.55, sfxT: {}, gens: 0};
try { const s = JSON.parse(localStorage.getItem('vic_mus') || 'null'); if (s) { MUS.on = s.on !== false; MUS.vol = typeof s.vol === 'number' ? s.vol : 0.55; } } catch (e) { }
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
function musInit() {
  if (MUS.ctx) { if (MUS.ctx.state === 'suspended') MUS.ctx.resume(); return !!MUS.ctx; }
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return false;
  const c = MUS.ctx = new AC(), comp = c.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 3.5;
  MUS.master = c.createGain(); MUS.master.gain.value = MUS.on ? MUS.vol : 0; MUS.master.connect(comp); comp.connect(c.destination);
  // reverberación sintética (ruido con caída exponencial)
  const len = c.sampleRate * 2.8, ir = c.createBuffer(2, len, c.sampleRate); for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
  MUS.rev = c.createConvolver(); MUS.rev.buffer = ir; const rg = c.createGain(); rg.gain.value = 0.42; MUS.rev.connect(rg); rg.connect(MUS.master);
  MUS.bus = c.createGain(); MUS.bus.gain.value = 1; MUS.bus.connect(MUS.master); MUS.bus.connect(MUS.rev);
  const nb = c.createBuffer(1, c.sampleRate, c.sampleRate), d = nb.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; MUS.nb = nb;
  if (!MUS.timer) MUS.timer = setInterval(musTick, 1000); musTick(); return true;
}
/* ---------- instrumentos ---------- */
function mOsc(L, f, t, dur, o) {
  const c = MUS.ctx, g = c.createGain(), fl = c.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = o.lp || 2000; if (o.lpEnd) { fl.frequency.setValueAtTime(o.lp || 2000, t); fl.frequency.linearRampToValueAtTime(o.lpEnd, t + dur); }
  const a = o.att || 0.02, r = o.rel || 0.3, pk = o.gain || 0.1; g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(pk, t + a); g.gain.setValueAtTime(pk, Math.max(t + a, t + dur - r)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + r * 0.5);
  (o.det || [0]).forEach(dt => { const s = c.createOscillator(); s.type = o.type || 'sawtooth'; s.frequency.value = f; s.detune.value = dt; if (o.vib) { const l = c.createOscillator(), lg = c.createGain(); l.frequency.value = 5.2; lg.gain.value = o.vib; l.connect(lg); lg.connect(s.detune); l.start(t); l.stop(t + dur + 1); } s.connect(fl); s.start(t); s.stop(t + dur + (o.rel || 0.3) + 0.2); });
  fl.connect(g); g.connect(L);
}
function mNoise(L, t, dur, o) {
  const c = MUS.ctx, s = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain(); s.buffer = MUS.nb; s.loop = true; fl.type = o.type || 'bandpass'; fl.frequency.value = o.f || 1000; fl.Q.value = o.q || 0.8;
  g.gain.setValueAtTime(o.att ? 0.0001 : (o.gain || 0.1), t); if (o.att) g.gain.linearRampToValueAtTime(o.gain || 0.1, t + o.att); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); s.connect(fl); fl.connect(g); g.connect(L); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
}
function mTimp(L, t, g) { const c = MUS.ctx, o = c.createOscillator(), gg = c.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(52, t + 0.25); gg.gain.setValueAtTime(g, t); gg.gain.exponentialRampToValueAtTime(0.0001, t + 0.9); o.connect(gg); gg.connect(L); o.start(t); o.stop(t + 1); mNoise(L, t, 0.12, {type: 'lowpass', f: 380, gain: g * 0.9}); }
function mSnare(L, t, g) { mNoise(L, t, 0.13, {type: 'highpass', f: 1800, gain: g}); const c = MUS.ctx, o = c.createOscillator(), gg = c.createGain(); o.type = 'triangle'; o.frequency.value = 190; gg.gain.setValueAtTime(g * 0.6, t); gg.gain.exponentialRampToValueAtTime(0.0001, t + 0.1); o.connect(gg); gg.connect(L); o.start(t); o.stop(t + 0.15); }
const pad = (L, notes, t, dur, g, lp) => notes.forEach(n => mOsc(L, mtof(n), t, dur, {type: 'sawtooth', det: [-7, 6], lp: lp || 900, att: Math.min(1.4, dur * 0.4), rel: 0.9, gain: g}));
const pluck = (L, n, t, g) => mOsc(L, mtof(n), t, 0.35, {type: 'triangle', lp: 3200, att: 0.005, rel: 0.5, gain: g});
const horn = (L, n, t, dur, g) => mOsc(L, mtof(n), t, dur, {type: 'sawtooth', det: [-4, 4], lp: 500, lpEnd: 1700, att: 0.12, rel: 0.25, gain: g, vib: 5});
const flute = (L, n, t, dur, g) => mOsc(L, mtof(n), t, dur, {type: 'sine', det: [0], lp: 4000, att: 0.06, rel: 0.2, gain: g, vib: 7});
const bassN = (L, n, t, dur, g) => mOsc(L, mtof(n), t, dur, {type: 'sawtooth', det: [0], lp: 260, att: 0.03, rel: 0.2, gain: g});
const strg = (L, n, t, dur, g) => mOsc(L, mtof(n), t, dur, {type: 'sawtooth', det: [-9, 9], lp: 1500, att: 0.015, rel: 0.1, gain: g});
/* ---------- partituras: 4 compases por vuelta; [corchea, nota MIDI, duración en corcheas] ---------- */
const MOODS = {
  menu: {bpm: 76, bars: [
    {bass: 38, pad: [50, 53, 57, 62], mel: [[0, 69, 4], [4, 74, 2], [6, 72, 2]]}, {bass: 34, pad: [46, 50, 53, 58], mel: [[0, 70, 4], [4, 74, 3], [7, 72, 1]]},
    {bass: 41, pad: [53, 57, 60, 65], mel: [[0, 72, 3], [3, 69, 1], [4, 77, 4]]}, {bass: 36, pad: [48, 52, 55, 60], mel: [[0, 76, 2], [2, 74, 2], [4, 72, 4]]}]},
  paz: {bpm: 84, bars: [
    {bass: 43, pad: [55, 59, 62, 67], mel: [[0, 71, 2], [2, 74, 2], [4, 79, 3], [7, 78, 1]]}, {bass: 38, pad: [50, 54, 57, 62], mel: [[0, 74, 2], [2, 78, 2], [4, 76, 4]]},
    {bass: 40, pad: [52, 55, 59, 64], mel: [[0, 71, 2], [2, 76, 2], [4, 79, 3], [7, 76, 1]]}, {bass: 36, pad: [48, 52, 55, 60], mel: [[0, 72, 2], [2, 76, 2], [4, 74, 4]]}]},
  guerra: {bpm: 96, bars: [
    {bass: 33, pad: [45, 48, 52, 57], mel: [[0, 69, 3], [3, 72, 1], [4, 76, 4]]}, {bass: 41, pad: [53, 57, 60, 65], mel: [[0, 77, 3], [3, 76, 1], [4, 72, 4]]},
    {bass: 38, pad: [50, 53, 57, 62], mel: [[0, 74, 3], [3, 77, 1], [4, 76, 4]]}, {bass: 40, pad: [52, 56, 59, 64], mel: [[0, 71, 2], [2, 76, 2], [4, 80, 4]]}]},
  batalla: {bpm: 132, bars: [
    {bass: 40, pad: [52, 55, 59, 64], mel: [[0, 76, 2], [2, 79, 2], [4, 83, 3], [7, 81, 1]]}, {bass: 36, pad: [48, 52, 55, 60], mel: [[0, 79, 2], [2, 76, 2], [4, 84, 4]]},
    {bass: 38, pad: [50, 54, 57, 62], mel: [[0, 78, 2], [2, 81, 2], [4, 85, 3], [7, 83, 1]]}, {bass: 40, pad: [52, 55, 59, 64], mel: [[0, 83, 2], [2, 79, 2], [4, 76, 4]]}]}
};
function musBar(L, mood, bar, t, e) {       // e = duración de una corchea
  const M = MOODS[mood], B = M.bars[bar % 4], n8 = (k) => t + k * e, dur = e * 8;
  if (mood === 'menu') {
    pad(L, B.pad, t, dur, 0.05, 800); bassN(L, B.bass, t, dur, 0.1); B.mel.forEach(([k, n, l]) => horn(L, n, n8(k), l * e, 0.07));
    for (let k = 0; k < 8; k++) pluck(L, B.pad[k % 4] + 12, n8(k), 0.035);
    if (bar % 2 === 0) mTimp(L, t, 0.35); if (bar % 4 === 0) mNoise(L, t, 2.2, {type: 'bandpass', f: 3500, q: 0.5, gain: 0.025, att: 1.6});
  } else if (mood === 'paz') {
    pad(L, B.pad, t, dur, 0.035, 1100); bassN(L, B.bass, t, dur, 0.07); B.mel.forEach(([k, n, l]) => flute(L, n, n8(k), l * e, 0.07));
    [0, 3, 5, 7].forEach((k, i) => pluck(L, B.pad[i % 4] + 12, n8(k), 0.04));
  } else if (mood === 'guerra') {
    pad(L, B.pad, t, dur, 0.04, 700); for (let k = 0; k < 8; k++) bassN(L, B.bass + (k % 4 === 3 ? 7 : 0), n8(k), e * 0.9, 0.09);
    B.mel.forEach(([k, n, l]) => horn(L, n - 12, n8(k), l * e, 0.08)); mTimp(L, t, 0.5); mTimp(L, n8(4), 0.42); [2, 6, 7].forEach(k => mSnare(L, n8(k), 0.06 + (k === 7 ? 0.03 : 0)));
  } else {
    pad(L, B.pad, t, dur, 0.04, 900); for (let k = 0; k < 16; k++) strg(L, B.bass + 12 + (k % 8 === 7 ? 7 : 0), t + k * e / 2, e * 0.45, 0.05);
    B.mel.forEach(([k, n, l]) => strg(L, n, n8(k), l * e, 0.045)); [0, 4].forEach(k => horn(L, B.bass + 24, n8(k), e * 1.5, 0.07)); for (let k = 0; k < 4; k++) mTimp(L, n8(k * 2), 0.5);
    [1, 3, 5, 7].forEach(k => mSnare(L, n8(k), 0.07)); if (bar % 4 === 3) for (let k = 0; k < 8; k++) mSnare(L, n8(6) + k * e / 4, 0.03 + k * 0.006);
  }
}
/* ---------- ambiente actual y cambios ---------- */
function musMoodNow() {
  if (document.body.classList.contains('starting')) return 'menu';
  if (UI.battle && typeof G !== 'undefined' && G.battles && G.battles.some(b => b.id === UI.battle)) return 'batalla';
  const c = G.C && G.C[G.player]; return c && c.wars && c.wars.length ? 'guerra' : 'paz';
}
function musSet(mood) {
  if (!MUS.ctx || MUS.mood === mood) return; const c = MUS.ctx, now = c.currentTime;
  if (MUS.layer) { const old = MUS.layer; old.gain.cancelScheduledValues(now); old.gain.setValueAtTime(old.gain.value, now); old.gain.linearRampToValueAtTime(0.0001, now + 2.2); setTimeout(() => { try { old.disconnect(); } catch (e) { } }, 3200); }
  const L = c.createGain(); L.gain.setValueAtTime(0.0001, now); L.gain.linearRampToValueAtTime(1, now + 2.4); L.connect(MUS.bus); MUS.layer = L; MUS.mood = mood; MUS.next = now + 0.2; MUS.bar = 0; MUS.gen = ++MUS.gens;
}
function musSched() {
  if (!MUS.ctx || !MUS.layer || !MUS.on) return; const c = MUS.ctx, M = MOODS[MUS.mood], e = 60 / M.bpm / 2;
  while (MUS.next < c.currentTime + 1.5) { try { musBar(MUS.layer, MUS.mood, MUS.bar, MUS.next, e); } catch (er) { } MUS.next += e * 8; MUS.bar++; }
}
function musTick() { if (!MUS.ctx) return; musSet(musMoodNow()); musSched(); }
setInterval(() => { if (MUS.ctx && MUS.on) musSched(); }, 250);
/* ---------- efectos de sonido (con límite de frecuencia) ---------- */
function sfxOk(k, ms) { const n = performance.now(); if (n - (MUS.sfxT[k] || 0) < ms) return false; MUS.sfxT[k] = n; return true; }
const SFX = {
  cannon: (v = 1) => { if (!MUS.ctx || !MUS.on || !sfxOk('cannon', 140)) return; const t = MUS.ctx.currentTime; mTimp(MUS.bus, t, 0.5 * v); mNoise(MUS.bus, t, 0.5, {type: 'lowpass', f: 700, gain: 0.35 * v}); },
  boom: (v = 1) => { if (!MUS.ctx || !MUS.on || !sfxOk('boom', 120)) return; const t = MUS.ctx.currentTime; mNoise(MUS.bus, t, 0.7, {type: 'lowpass', f: 420, gain: 0.3 * v}); mTimp(MUS.bus, t, 0.28 * v); },
  volley: (v = 1) => { if (!MUS.ctx || !MUS.on || !sfxOk('volley', 220)) return; const t = MUS.ctx.currentTime; for (let i = 0; i < 4; i++) mNoise(MUS.bus, t + i * 0.025 + Math.random() * 0.04, 0.1, {type: 'bandpass', f: 1500 + Math.random() * 1200, q: 0.7, gain: 0.09 * v}); },
  bugle: () => { if (!MUS.ctx || !MUS.on || !sfxOk('bugle', 2500)) return; const t = MUS.ctx.currentTime; [[67, 0, 0.18], [72, 0.2, 0.18], [76, 0.4, 0.5]].forEach(([n, d, l]) => mOsc(MUS.bus, mtof(n), t + d, l, {type: 'sawtooth', det: [-3, 3], lp: 1800, att: 0.02, rel: 0.12, gain: 0.07})); },
  click: () => { if (!MUS.ctx || !MUS.on || !sfxOk('click', 60)) return; mOsc(MUS.bus, 1400, MUS.ctx.currentTime, 0.04, {type: 'triangle', lp: 4000, att: 0.002, rel: 0.05, gain: 0.04}); }
};
/* ---------- control: botón 🎵 y primer gesto del usuario ---------- */
function musSave() { try { localStorage.setItem('vic_mus', JSON.stringify({on: MUS.on, vol: MUS.vol})); } catch (e) { } }
function musApply() { if (MUS.master) MUS.master.gain.setTargetAtTime(MUS.on ? MUS.vol : 0, MUS.ctx.currentTime, 0.2); document.querySelectorAll('.sndbtn').forEach(b => { b.classList.toggle('muted', !MUS.on); b.dataset.tip = `<b>Música y sonido</b><br>${MUS.on ? 'Activados' : 'Silenciados'} · volumen ${Math.round(MUS.vol * 100)}%<br><small>Clic: ${MUS.on ? 'silenciar' : 'activar'} · clic derecho: cambiar volumen</small>`; b.textContent = MUS.on ? '🎵' : '🔇'; }); }
Object.assign(ACT, {
  music: () => { musInit(); MUS.on = !MUS.on; musSave(); musApply(); if (MUS.on) { MUS.mood = null; musTick(); } },
  musvol: () => { musInit(); MUS.vol = MUS.vol >= 0.9 ? 0.2 : Math.round((MUS.vol + 0.2) * 10) / 10; MUS.on = true; musSave(); musApply(); toast('🎵', `Volumen ${Math.round(MUS.vol * 100)}%`); }
});
['pointerdown', 'keydown'].forEach(ev => window.addEventListener(ev, () => { if (!MUS.ctx && MUS.on) { musInit(); musApply(); } else if (MUS.ctx && MUS.ctx.state === 'suspended') MUS.ctx.resume(); }, {capture: true}));
document.addEventListener('contextmenu', e => { const b = e.target.closest && e.target.closest('.sndbtn'); if (b) { e.preventDefault(); ACT.musvol(); } });
setInterval(() => { document.querySelectorAll('.sndbtn').forEach(b => { if (!b._m) { b._m = 1; musApply(); } }); }, 800);
