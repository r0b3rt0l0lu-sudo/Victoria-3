/* ===== MÚSICA 2: ambientes nuevos y selección dinámica =====
   Se suman a MENÚ, PAZ, GUERRA y BATALLA cinco ambientes compuestos en directo:
   · MAR (re dórico, ondulante, con oleaje) — mapa marítimo, flotas en el mar y puertos.
   · BATALLA NAVAL (re menor, timbales y cuerdas, cañonazos) — cuando hay un combate naval abierto.
   · AIRE (mi menor, ostinato rápido de púas y cuerdas agudas) — mapa aéreo y guerra aérea.
   · CRISIS (cromatismos lentos y latido grave) — escasez grave, riesgo de guerra civil, revolución o rebeldes.
   · VICTORIA (sol mayor, fanfarria de metales) — unos 25 s tras ganar una batalla o una guerra.
   La prioridad es: menú › victoria › batalla naval › batalla terrestre › crisis › mapa aéreo › mapa marítimo › guerra › paz. */
Object.assign(MOODS, {
  mar: {bpm: 72, bars: [
    {bass: 38, pad: [50, 53, 57, 62], mel: [[0, 69, 3], [3, 72, 2], [5, 74, 3]]}, {bass: 36, pad: [48, 52, 55, 60], mel: [[0, 67, 3], [3, 71, 2], [5, 72, 3]]},
    {bass: 34, pad: [46, 50, 53, 58], mel: [[0, 65, 3], [3, 69, 2], [5, 70, 3]]}, {bass: 33, pad: [45, 48, 52, 57], mel: [[0, 64, 2], [2, 67, 2], [4, 69, 4]]}]},
  mar_batalla: {bpm: 120, bars: [
    {bass: 38, pad: [50, 53, 57, 62], mel: [[0, 74, 2], [2, 77, 2], [4, 81, 4]]}, {bass: 34, pad: [46, 50, 53, 58], mel: [[0, 77, 2], [2, 74, 2], [4, 82, 4]]},
    {bass: 36, pad: [48, 51, 55, 60], mel: [[0, 76, 2], [2, 79, 2], [4, 84, 4]]}, {bass: 33, pad: [45, 48, 52, 57], mel: [[0, 81, 2], [2, 77, 2], [4, 76, 4]]}]},
  aire: {bpm: 112, bars: [
    {bass: 40, pad: [52, 55, 59, 64], mel: [[0, 76, 1], [2, 79, 1], [4, 83, 2], [6, 79, 2]]}, {bass: 36, pad: [48, 52, 55, 60], mel: [[0, 79, 1], [2, 76, 1], [4, 84, 2], [6, 83, 2]]},
    {bass: 38, pad: [50, 54, 57, 62], mel: [[0, 78, 1], [2, 81, 1], [4, 85, 2], [6, 81, 2]]}, {bass: 35, pad: [47, 51, 54, 59], mel: [[0, 83, 1], [2, 79, 1], [4, 78, 2], [6, 76, 2]]}]},
  crisis: {bpm: 58, bars: [
    {bass: 31, pad: [43, 46, 49, 52], mel: [[0, 61, 6]]}, {bass: 30, pad: [42, 45, 48, 51], mel: [[0, 60, 4], [4, 63, 4]]},
    {bass: 29, pad: [41, 44, 47, 50], mel: [[0, 59, 6]]}, {bass: 30, pad: [42, 46, 49, 52], mel: [[0, 62, 3], [4, 61, 4]]}]},
  victoria: {bpm: 100, bars: [
    {bass: 43, pad: [55, 59, 62, 67], mel: [[0, 67, 1], [1, 71, 1], [2, 74, 2], [4, 79, 4]]}, {bass: 48, pad: [60, 64, 67, 72], mel: [[0, 76, 2], [2, 79, 2], [4, 83, 4]]},
    {bass: 45, pad: [57, 60, 64, 69], mel: [[0, 76, 2], [2, 74, 2], [4, 72, 4]]}, {bass: 43, pad: [55, 59, 62, 67], mel: [[0, 74, 2], [2, 79, 2], [4, 83, 4]]}]}
});
const _musBar2 = musBar;
musBar = function (L, mood, bar, t, e) {
  if (!['mar', 'mar_batalla', 'aire', 'crisis', 'victoria'].includes(mood)) return _musBar2(L, mood, bar, t, e);
  const B = MOODS[mood].bars[bar % 4], n8 = k => t + k * e, dur = e * 8;
  if (mood === 'mar') {
    pad(L, B.pad, t, dur, 0.04, 950); bassN(L, B.bass, t, dur, 0.08); B.mel.forEach(([k, n, l]) => { flute(L, n, n8(k), l * e, 0.06); horn(L, n - 12, n8(k), l * e, 0.03); });
    for (let k = 0; k < 8; k++) pluck(L, B.pad[k % 4] + 12 + (k > 3 ? 12 : 0), n8(k), 0.03);                               // arpegio como olas
    mNoise(L, t, e * 7, {type: 'bandpass', f: 600 + 300 * (bar % 2), q: 0.4, gain: 0.03, att: e * 3});                  // oleaje
    if (bar % 4 === 0) mTimp(L, t, 0.25);
  } else if (mood === 'mar_batalla') {
    pad(L, B.pad, t, dur, 0.04, 900); for (let k = 0; k < 16; k++) strg(L, B.bass + 12 + (k % 8 === 7 ? 5 : 0), t + k * e / 2, e * 0.45, 0.05);
    B.mel.forEach(([k, n, l]) => horn(L, n - 12, n8(k), l * e, 0.07)); for (let k = 0; k < 8; k += 2) mTimp(L, n8(k), 0.5); [3, 7].forEach(k => mSnare(L, n8(k), 0.06));
    mNoise(L, n8(bar % 2 ? 2 : 5), 0.5, {type: 'lowpass', f: 600, gain: 0.12});                                                 // cañonazo lejano
  } else if (mood === 'aire') {
    pad(L, B.pad, t, dur, 0.035, 1300); for (let k = 0; k < 16; k++) pluck(L, B.pad[k % 4] + 12 + (k % 3 === 2 ? 5 : 0), t + k * e / 2, 0.035 + (k % 4 === 0 ? 0.02 : 0));
    B.mel.forEach(([k, n, l]) => strg(L, n, n8(k), l * e, 0.05)); bassN(L, B.bass, t, e * 4, 0.08); bassN(L, B.bass + 7, n8(4), e * 4, 0.08); [0, 4].forEach(k => mTimp(L, n8(k), 0.3));
    mNoise(L, t, e * 8, {type: 'highpass', f: 2500, q: 0.4, gain: 0.015, att: e * 2});                                         // zumbido de motores
  } else if (mood === 'crisis') {
    pad(L, B.pad, t, dur, 0.05, 520); B.mel.forEach(([k, n, l]) => strg(L, n, n8(k), l * e, 0.04)); bassN(L, B.bass, t, dur, 0.1);
    mTimp(L, t, 0.45); mTimp(L, n8(1.2), 0.3); mTimp(L, n8(4), 0.45); mTimp(L, n8(5.2), 0.3);                                  // latido
    if (bar % 2) mNoise(L, t, e * 6, {type: 'lowpass', f: 300, gain: 0.04, att: e * 3});
  } else {
    pad(L, B.pad, t, dur, 0.05, 1500); bassN(L, B.bass, t, dur, 0.1); B.mel.forEach(([k, n, l]) => { horn(L, n, n8(k), l * e, 0.09); horn(L, n - 12, n8(k), l * e, 0.05); });
    mTimp(L, t, 0.5); mTimp(L, n8(4), 0.4); [2, 6].forEach(k => mSnare(L, n8(k), 0.06)); for (let k = 0; k < 8; k += 2) pluck(L, B.pad[(k / 2) % 4] + 12, n8(k), 0.04);
  }
};
const _musMoodNow2 = musMoodNow;
musMoodNow = function () {
  const base = _musMoodNow2(); if (base === 'menu') return 'menu'; const c = G.C && G.C[G.player]; if (!c) return base;
  if (MUS.vicUntil && performance.now() < MUS.vicUntil) return 'victoria';
  if (typeof UI.nb !== 'undefined' && UI.nb !== null && G.mx && G.mx.nb && G.mx.nb[UI.nb] && typeof nbActive === 'function' && nbActive(UI.nb)) return 'mar_batalla';
  if (base === 'batalla') return 'batalla';
  if ((c.scarc || 0) > 0.4 || c.rev || (G.crises && G.crises.some(x => x.scope === G.player && /riots|civil|revol/i.test(x.type))) || (typeof cwRisk === 'function' && typeof rule === 'function' && rule('civil') && cwRisk(c).pct >= 60)) return 'crisis';
  if (R.mode === 'air') return 'aire'; if (R.mode === 'naval') return 'mar';
  return base;
};
// fanfarria al ganar una batalla (del jugador) y al terminar una guerra a su favor
const _battleSummaryMus = battleSummary;
battleSummary = function (b, winner, win, lose) {
  _battleSummaryMus(b, winner, win, lose);
  try {
    const mine = b.A.some(id => (armyById(id) || {}).tag === G.player) ? 'A' : b.B.some(id => (armyById(id) || {}).tag === G.player) ? 'B' : null;
    if (mine && mine === winner) { MUS.vicUntil = performance.now() + 24000; if (MUS.ctx && MUS.on) musTick(); }
  } catch (e) { }
};
