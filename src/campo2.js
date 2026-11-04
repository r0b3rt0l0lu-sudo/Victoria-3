/* ===== CAMPO DE BATALLA 2: clima, línea de visión, terreno más rico y efectos del suelo ===== */
// clima determinista de cada batalla (el mismo para la simulación diaria y para el visor)
function battleWeather(b) {
  if (b.wx) return b.wx;
  const m = G.date.m, tf = typeof battleTerrain === 'function' ? battleTerrain(b) : {bio: 1}, h = k => hash2(b.id * 17 + 3, b.prov, 900 + k);
  const winter = m === 11 || m === 0 || m === 1, autumn = m === 9 || m === 10, spring = m >= 2 && m <= 4;
  let k = 'clear', r = h(1);
  if (tf.bio === 8 || (winter && r < 0.45 && tf.bio !== 3)) k = 'snow';
  else if (tf.bio === 3) k = r < 0.12 ? 'wind' : 'clear';
  else if (r < (autumn || spring ? 0.3 : 0.18)) k = 'rain';
  else if (r < (autumn ? 0.45 : 0.3)) k = 'fog';
  else if (r < 0.4) k = 'wind';
  b.wx = {k, wind: (h(2) - 0.5) * 2, frost: winter && k !== 'snow' && tf.bio !== 3, autumn};
  return b.wx;
}
const WX_NAME = {clear: 'Despejado', rain: 'Lluvia y barro', fog: 'Niebla', snow: 'Nevada', wind: 'Viento fuerte'};
const WX_ICON = {clear: '☀️', rain: '🌧️', fog: '🌫️', snow: '❄️', wind: '💨'};
function wxMods(b) {      // velocidad de marcha, cadencia de fuego, alcance
  const k = battleWeather(b).k;
  return k === 'rain' ? {sp: 0.86, rate: 0.7, rng: 0.9} : k === 'snow' ? {sp: 0.84, rate: 0.85, rng: 0.85} : k === 'fog' ? {sp: 1, rate: 1, rng: 0.55} : {sp: 1, rate: 1, rng: 1};
}
// efectos del terreno y del tiempo en el cálculo diario
const _terrModsR = terrMods;
terrMods = function (b, side) {
  const r = _terrModsR(b, side), tf = battleTerrain(b), wx = battleWeather(b), isAtt = b.att === side, st = (side === 'A' ? b.strA : b.strB) || 'frontal';
  if (isAtt) {
    if (wx.k === 'rain') r.att -= st === 'charge' ? 0.06 : 0.035;
    if (wx.k === 'snow') r.att -= 0.03;
    if (wx.k === 'fog') r.att -= 0.02;
    const cover = tf.forests.length + tf.villages.length + tf.rocks.length + tf.walls.length + tf.hills.length;
    if (cover < 4) r.att -= 0.02 * weapLvl(side === 'A' ? b.B0 : b.A0);         // terreno abierto: el fusil moderno barre al atacante
    if (tf.river && b.day <= 5) { const n = (side === 'A' ? b.A : b.B).length; if (n >= 3) r.att -= 0.025; }       // atasco en los vados
    if (tf.marsh.length && b.day <= 4) r.att -= 0.015;
  } else {
    if (wx.k === 'fog') r.def += 0.015;
    const vil = tf.villages.filter(v => v.owner === side || (b.vill && b.vill[tf.villages.indexOf(v)] === side)).length;
    if (vil) r.def += Math.min(0.04, 0.015 * vil);
  }
  return r;
};
/* ---- línea de visión ---- */
function tacLos(tf, x1, y1, x2, y2) {
  if (!tf || !tf.v2) return true;
  const L = Math.hypot(x2 - x1, y2 - y1); if (L < 40) return true;
  const n = Math.max(4, Math.round(L / 28));
  for (let i = 1; i < n; i++) {
    const t = i / n, x = x1 + (x2 - x1) * t, y = y1 + (y2 - y1) * t;
    for (let j = 0; j < tf.forests.length; j++) { const f = tf.forests[j]; if (Math.hypot(x - f.x, y - f.y) < f.r * 0.8 && Math.hypot(x1 - f.x, y1 - f.y) > f.r * 0.8 && Math.hypot(x2 - f.x, y2 - f.y) > f.r * 0.8) return false; }
    for (let j = 0; j < tf.hills.length; j++) { const h = tf.hills[j]; if (inEll(x, y, h) && !inEll(x1, y1, h) && !inEll(x2, y2, h)) return false; }
    for (let j = 0; j < tf.cliffs.length; j++) if (inEll(x, y, tf.cliffs[j]) && !inEll(x1, y1, tf.cliffs[j]) && !inEll(x2, y2, tf.cliffs[j])) return false;
  }
  return true;
}
function bvLosCached(V, b, a, o) {      // cacheado por pareja y medio segundo
  a._los = a._los || {}; const e = a._los[o.id]; if (e && V.t - e.t < 0.6) return e.v;
  const v = tacLos(V.tf || battleTerrain(b), a.x, a.y, o.x, o.y); a._los[o.id] = {t: V.t, v}; return v;
}
/* ---- clima y fuego en el visor ---- */
function bvSpeedMul(V, b, blk) {
  const w = wxMods(b).sp; return blk.type === 'cav' && battleWeather(b).k === 'rain' ? w * 0.92 : w;
}
function bvFireMods(V, b, blk) {
  const w = wxMods(b); let rng = w.rng, rate = w.rate;
  if (blk.terr && blk.terr.hill) rng *= 1.2;
  return {rng, rate};
}
/* ---- huellas, manchas y aldeas en llamas ---- */
const _bvKillR = bvKill;
bvKill = function (V, blk, f) {
  _bvKillR(V, blk, f);
  if (!V.replay) { (V.stains = V.stains || []).push({x: f.x, y: f.y, r: 1.6 + Math.random() * 1.6}); if (V.stains.length > 420) V.stains.shift(); }
};
const _tacShellHitR = tacShellHit;
tacShellHit = function (V, b, p, all) {
  _tacShellHitR(V, b, p, all);
  const tf = V.tf || battleTerrain(b);
  tf.villages.forEach((v, i) => {
    if (Math.abs(p.x2 - v.x) < v.r && Math.abs(p.y2 - v.y) < v.r * 0.8) { V.heat = V.heat || {}; V.heat[i] = (V.heat[i] || 0) + 1; }
  });
};
function bvGround(V, b, all, dt) {
  if (V.replay) return;
  V._trT = (V._trT || 0) + dt; if (V._trT > 0.5) {
    V._trT = 0; V.tramp = V.tramp || [];
    all.forEach(blk => { if (blk.role === 'reserve' || !['advance', 'charge', 'gallop', 'retreat', 'rout', 'flank'].includes(blk.mode)) return; V.tramp.push({x: blk.x, y: blk.y, w: blk.wid * 0.9, hd: blk.hd, a: 0.2}); });
    if (V.tramp.length > 700) V.tramp.splice(0, V.tramp.length - 700);
  }
  if (V.heat) { const tf = V.tf; Object.keys(V.heat).forEach(i => { const v = tf.villages[i]; if (!v) return; if (V.heat[i] >= 4) { v.burn = true; V.heat[i] = 4; }
      if (v.burn && Math.random() < dt * 16) { const x = v.x + rnd(-v.r * 0.6, v.r * 0.6), y = v.y + rnd(-v.r * 0.4, v.r * 0.4); bvPart(V, {k: 'smoke', x, y, life: 3.4, r: 7, vx: (V.wind || 0) * 0.8 + rnd(-3, 3)}); if (Math.random() < 0.5) bvPart(V, {k: 'spark', x, y, life: 0.6, hot: 1}); } }); }
}
const _bvFxUnderR = bvFxUnder;
bvFxUnder = function (g, V, b) {
  const wx = battleWeather(b);
  (V.tramp || []).forEach(t => { t.a = Math.max(0.03, t.a - 0.0004); g.save(); g.translate(t.x, t.y); g.rotate(t.hd); g.fillStyle = wx.k === 'snow' ? `rgba(90,96,110,${t.a})` : wx.k === 'rain' ? `rgba(46,32,18,${t.a * 1.6})` : `rgba(70,56,34,${t.a})`; g.fillRect(-9, -t.w / 2, 18, t.w); g.restore(); });
  (V.stains || []).forEach(s => { g.fillStyle = 'rgba(90,22,18,.38)'; g.beginPath(); g.arc(s.x, s.y, s.r, 0, 6.3); g.fill(); });
  const tf = V.tf; if (tf) tf.villages.forEach(v => { if (!v.burn) return; const fl = 0.7 + 0.3 * Math.sin(V.t * 9 + v.x); g.fillStyle = 'rgba(24,18,12,.5)'; g.beginPath(); g.ellipse(v.x, v.y + 2, v.r * 0.9, v.r * 0.65, 0, 0, 6.3); g.fill();
    const rg = g.createRadialGradient(v.x, v.y, 2, v.x, v.y, v.r); rg.addColorStop(0, `rgba(255,170,60,${0.5 * fl})`); rg.addColorStop(1, 'rgba(255,90,20,0)'); g.fillStyle = rg; g.beginPath(); g.arc(v.x, v.y, v.r, 0, 6.3); g.fill(); });
  _bvFxUnderR(g, V, b);
};
// capa de clima en pantalla: lluvia, nieve, niebla y sombras de nubes
const _bvPostR = bvPost;
bvPost = function (g, V, b) {
  _bvPostR(g, V, b);
  const W = BV_W, H = BV_H, wx = battleWeather(b), t = V.t || 0;
  if (wx.k === 'clear' || wx.k === 'wind') {            // sombras de nubes que cruzan el campo
    for (let i = 0; i < 4; i++) { const x = ((hash2(i, b.id, 41) * (W + 500) + t * (10 + i * 3) * (1 + Math.abs(wx.wind))) % (W + 500)) - 250, y = 80 + hash2(i, b.id, 42) * (H - 160), r = 150 + hash2(i, b.id, 43) * 120, rg = g.createRadialGradient(x, y, 0, x, y, r); rg.addColorStop(0, 'rgba(10,16,26,.13)'); rg.addColorStop(1, 'rgba(10,16,26,0)'); g.fillStyle = rg; g.fillRect(x - r, y - r, r * 2, r * 2); }
  }
  if (wx.k === 'fog') {
    g.fillStyle = 'rgba(205,212,218,.28)'; g.fillRect(0, 34, W, H);
    for (let i = 0; i < 9; i++) { const x = ((hash2(i, b.id, 51) * (W + 400) + t * 14) % (W + 400)) - 200, y = 60 + hash2(i, b.id, 52) * (H - 100), r = 180 + hash2(i, b.id, 53) * 140, rg = g.createRadialGradient(x, y, 0, x, y, r); rg.addColorStop(0, 'rgba(225,230,235,.28)'); rg.addColorStop(1, 'rgba(225,230,235,0)'); g.fillStyle = rg; g.fillRect(x - r, y - r, r * 2, r * 2); }
  }
  if (wx.k === 'rain') {
    g.fillStyle = 'rgba(40,52,70,.14)'; g.fillRect(0, 34, W, H); g.strokeStyle = 'rgba(190,210,240,.38)'; g.lineWidth = 1; g.beginPath();
    for (let i = 0; i < 140; i++) { const x = (hash2(i, 7, 11) * (W + 120) + t * 90 + wx.wind * 60 * t) % (W + 120) - 60, y = (hash2(i, 9, 11) * H + t * 520) % H; g.moveTo(x, y); g.lineTo(x - 5, y + 14); } g.stroke();
  }
  if (wx.k === 'snow') {
    g.fillStyle = 'rgba(220,230,245,.1)'; g.fillRect(0, 34, W, H); g.fillStyle = 'rgba(255,255,255,.85)';
    for (let i = 0; i < 130; i++) { const x = (hash2(i, 13, 11) * (W + 60) + Math.sin(t * 0.8 + i) * 18 + t * 24 * (1 + wx.wind)) % (W + 60), y = (hash2(i, 15, 11) * H + t * (36 + (i % 5) * 8)) % H, r = 0.9 + (i % 3) * 0.5; g.beginPath(); g.arc(x, y, r, 0, 6.3); g.fill(); }
  }
  // etiqueta del tiempo
  g.font = 'bold 13px sans-serif'; g.textAlign = 'right'; g.textBaseline = 'middle'; const lbl = `${WX_ICON[wx.k]} ${WX_NAME[wx.k]}`, tw = g.measureText(lbl).width + 14;
  g.fillStyle = 'rgba(8,12,16,.7)'; g.fillRect(W - tw - 6, H - 26, tw, 20); g.fillStyle = '#e8e2cc'; g.fillText(lbl, W - 12, H - 16);
};
/* ---- fondo: textura de hierba, orillas, relieve iluminado y estaciones ---- */
const _bvBuildBgR = bvBuildBg;
bvBuildBg = function (V, b) {
  const cv = _bvBuildBgR(V, b), S = cv.width / BV_W, g = cv.getContext('2d'), tf = battleTerrain(b), wx = battleWeather(b), bc = (typeof BIO_COL !== 'undefined' && BIO_COL[tf.bio]) || [118, 150, 74];
  const H = (i, k) => hash2(i, V.seed, 700 + k);
  g.save(); g.scale(S, S);
  // textura de hierba: tallos cortos de dos tonos
  const grass = tf.bio === 3 ? 0 : tf.bio === 8 ? 0.4 : 1;
  for (let i = 0; i < 3400 * grass; i++) { const x = H(i, 1) * BV_W, y = H(i, 2) * BV_H, l = 2 + H(i, 3) * 3.5, m = H(i, 4) < 0.5 ? 0.82 : 1.2; g.strokeStyle = `rgba(${Math.min(255, bc[0] * m) | 0},${Math.min(255, bc[1] * m) | 0},${Math.min(255, bc[2] * m) | 0},.38)`; g.lineWidth = 0.7; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (H(i, 5) - 0.5) * 2, y - l); g.stroke(); }
  if (tf.bio === 3) for (let i = 0; i < 900; i++) { const x = H(i, 6) * BV_W, y = H(i, 7) * BV_H; g.fillStyle = H(i, 8) < 0.5 ? 'rgba(130,100,60,.25)' : 'rgba(240,222,170,.25)'; g.fillRect(x, y, 1.6, 1.2); }
  // orillas con cañas y barro
  const bank = (xf, w) => { for (let y = 0; y < BV_H; y += 11) { const x = xf(y), side = H(y, 9) < 0.5 ? -1 : 1, off = w / 2 + 3 + H(y, 10) * 5; g.strokeStyle = 'rgba(78,104,56,.7)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x + side * off, y); g.lineTo(x + side * off + (H(y, 11) - 0.5) * 2, y - 4 - H(y, 12) * 3); g.stroke(); g.fillStyle = 'rgba(120,96,64,.25)'; g.beginPath(); g.ellipse(x + side * (w / 2 + 2), y, 3, 5, 0, 0, 6.3); g.fill(); } };
  if (tf.river) bank(y => tacRiverX(tf, y), tf.river.w);
  if (tf.stream) bank(y => tf.stream.x + Math.sin(y / 70 + tf.stream.ph) * tf.stream.amp, tf.stream.w);
  // espuma en los vados
  if (tf.river) tf.river.fords.forEach(f => { if (f.br) return; const x = tacRiverX(tf, f.y); g.strokeStyle = 'rgba(230,242,250,.55)'; g.lineWidth = 1; for (let k = 0; k < 5; k++) { g.beginPath(); g.arc(x + (k - 2) * 6, f.y + (k % 2 ? 4 : -4), 3, 0, 3.14); g.stroke(); } });
  // relieve iluminado desde el noroeste: cara iluminada y cara en sombra
  tf.hills.forEach(h => { g.save(); g.translate(h.x, h.y); g.rotate(h.rot || 0);
    let rg = g.createRadialGradient(-h.rx * 0.35, -h.ry * 0.35, 4, -h.rx * 0.2, -h.ry * 0.2, Math.max(h.rx, h.ry) * 0.8); rg.addColorStop(0, 'rgba(255,248,200,.22)'); rg.addColorStop(1, 'rgba(255,248,200,0)'); g.fillStyle = rg; g.beginPath(); g.ellipse(0, 0, h.rx, h.ry, 0, 0, 6.3); g.fill();
    rg = g.createRadialGradient(h.rx * 0.45, h.ry * 0.45, 4, h.rx * 0.3, h.ry * 0.3, Math.max(h.rx, h.ry) * 0.75); rg.addColorStop(0, 'rgba(24,18,10,.3)'); rg.addColorStop(1, 'rgba(24,18,10,0)'); g.fillStyle = rg; g.beginPath(); g.ellipse(0, 0, h.rx, h.ry, 0, 0, 6.3); g.fill(); g.restore(); });
  // estación: otoño en los bosques, escarcha y nieve ligera en invierno
  if (wx.autumn) tf.forests.forEach((f, fi) => { for (let i = 0; i < f.r * 0.9; i++) { const a = H(i + fi * 99, 20) * 6.283, d = Math.sqrt(H(i + fi * 99, 21)) * f.r * 0.92, hue = H(i + fi * 99, 22); g.fillStyle = hue < 0.5 ? 'rgba(206,132,40,.55)' : hue < 0.8 ? 'rgba(170,70,30,.5)' : 'rgba(220,180,60,.5)'; g.beginPath(); g.arc(f.x + Math.cos(a) * d, f.y + Math.sin(a) * d, 2 + H(i, 23) * 3, 0, 6.3); g.fill(); } });
  if (wx.frost) { g.fillStyle = 'rgba(235,242,250,.14)'; g.fillRect(0, 0, BV_W, BV_H); tf.forests.forEach(f => { for (let i = 0; i < f.r * 0.6; i++) { const a = H(i, 30) * 6.283, d = Math.sqrt(H(i, 31)) * f.r * 0.9; g.fillStyle = 'rgba(245,250,255,.5)'; g.beginPath(); g.arc(f.x + Math.cos(a) * d, f.y + Math.sin(a) * d - 1.5, 2, 0, 6.3); g.fill(); } }); }
  g.restore(); return cv;
};
// la fricción: el visor acepta una multiplicación de velocidad y alcance por clima/terreno
const _bvFireR = bvFire;
bvFire = function (V, b, blk, dt, foes) {
  if (blk.type === 'inf' || blk.type === 'cav' || blk.type === 'tank') {
    const foe = blk.foe;
    if (foe && !bvLosCached(V, b, blk, foe)) { blk.fireAcc = 0; return; }       // sin línea de visión no hay fuego
    const m = bvFireMods(V, b, blk); blk._wxr = m.rng; dt *= m.rate;
  }
  _bvFireR(V, b, blk, dt, foes);
};
