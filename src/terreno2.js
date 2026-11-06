/* ===== TERRENO DEL CAMPO DE BATALLA (versión amplia) =====
   El campo es el doble de grande y los regimientos son pequeños: el terreno manda. Cada batalla genera, según el bioma, colinas y lomas, bosques y
   arboledas, ríos con vados y puentes, arroyos, lagos, pantanos, aldeas con iglesia, caminos, campos de cultivo, muros y setos, rocas, acantilados,
   dunas y ventisqueros. Todo tiene efecto real sobre la marcha, la cobertura y el combate, y la IA lo usa para decidir dónde y cómo luchar. */
const T2 = {  // [min, max] de cada rasgo por bioma
  1: {hills: [1, 3], forests: [3, 6], villages: [7, 11], walls: [4, 8], river: 0.6, lakes: 0.15, marsh: 0.25, fields: 40, orchards: [1, 3]},
  2: {hills: [1, 3], forests: [10, 16], villages: [3, 5], walls: [1, 3], river: 0.5, lakes: 0.15, marsh: 0.3, fields: 8, orchards: [0, 1]},
  3: {hills: [1, 2], forests: [0, 1], villages: [2, 4], walls: [0, 1], river: 0.1, lakes: 0.1, marsh: 0, fields: 0, dunes: [6, 10], rocks: [3, 5]},
  4: {hills: [2, 4], forests: [2, 3], villages: [4, 6], walls: [1, 3], river: 0.6, lakes: 0.2, marsh: 0.2, fields: 16, orchards: [0, 1]},
  5: {hills: [1, 2], forests: [3, 5], villages: [2, 3], walls: [0, 1], river: 0.4, lakes: 3, marsh: 4, fields: 0, snow: [3, 5]},
  6: {hills: [1, 3], forests: [14, 20], villages: [2, 3], walls: [0, 0], river: 0.9, lakes: 0.2, marsh: 3, fields: 0},
  7: {hills: [5, 8], forests: [3, 5], villages: [2, 3], walls: [0, 1], river: 0.4, lakes: 0.3, marsh: 0, fields: 0, rocks: [5, 8], cliffs: [3, 5]},
  8: {hills: [2, 4], forests: [4, 6], villages: [2, 3], walls: [0, 1], river: 0.3, lakes: 1, marsh: 0, fields: 0, snow: [8, 12], rocks: [3, 5]}
};
function tacRiverX(tf, y) { return tf.river.x + Math.sin(y / 90 + tf.river.ph) * tf.river.amp; }
const inEll = (x, y, e) => { const c = Math.cos(e.rot || 0), s = Math.sin(e.rot || 0), dx = x - e.x, dy = y - e.y, u = (dx * c + dy * s) / e.rx, v = (-dx * s + dy * c) / e.ry; return u * u + v * v < 1; };
function battleTerrain(b) {
  if (b.tf && b.tf.v2) return b.tf;
  const pv = MAP.provs[b.prov], bio = pv.biome, H = k => hash2(4217, b.prov + battleSite(b).i * 977, k), W = BV_W, Hh = BV_H, defSide = b.att === 'A' ? 'B' : 'A', dd = defSide === 'A' ? -1 : 1, P = T2[bio] || T2[1];
  const cnt = (r, k) => r ? r[0] + Math.floor(H(k) * (r[1] - r[0] + 1)) : 0, pos = (k, mx) => [mx + H(k) * (W - 2 * mx), 70 + H(k + 500) * (Hh - 130)];
  const tf = {v2: 1, bio, hill: null, hills: [], river: null, stream: null, forests: [], orchards: [], villages: [], lakes: [], marsh: [], rocks: [], cliffs: [], dunes: [], snow: [], walls: [], roads: [], fields: [], blocks: [], pond: null, hill2: null};
  // colinas y lomas (según el relieve real de la provincia)
  const EL = provElev(b.prov), hk = clamp(0.25 + EL.rough / 150, 0, 2.6), hsz = 1 + clamp(EL.rough / 420, 0, 0.9); tf.elev = EL;
  const nHill = EL.cls === 'llanura' ? (H(2) < 0.7 ? 0 : 1) : Math.max(EL.rough >= 60 ? 1 : 0, Math.min(9, Math.round(cnt(P.hills, 1) * hk)));
  for (let i = 0, n = nHill; i < n; i++) { const [x, y] = pos(10 + i, 150), big = bio === 7 || i === 0; tf.hills.push({x, y, rx: ((big ? 140 : 80) + H(30 + i) * (big ? 150 : 90)) * hsz, ry: ((big ? 90 : 55) + H(40 + i) * (big ? 110 : 60)) * hsz, rot: (H(50 + i) - 0.5) * 1.4}); }
  if (tf.hills.length) { const h0 = tf.hills[0]; h0.x = W / 2 + dd * (150 + H(3) * 220); h0.side = defSide; tf.hill = h0; tf.hills.forEach((h, i) => { if (i) h.side = h.x > W / 2 ? 'B' : 'A'; }); tf.hill2 = tf.hills[1] || null; }
  // río principal con vados y puentes; arroyo secundario
  if (H(60) < P.river) { const r = {x: W / 2 + (H(61) - 0.5) * 520, amp: 40 + H(62) * 70, ph: H(63) * 6.28, w: 13, fords: []}, nf = 2 + (H(64) < 0.5 ? 1 : 0); for (let i = 0; i < nf; i++) r.fords.push({y: 110 + (i + 0.2 + H(65 + i) * 0.6) * ((Hh - 220) / nf), w: 84, br: i % 2 === 0}); tf.river = r; }
  { const pr = {montaña: 0.7, colinas: 0.4, ondulado: 0.15, llanura: 0.03}[provElev(b.prov).cls] || 0.1;     // barrancos: infranqueables salvo por pasos
    if (H(800) < pr) { let rx = W / 2 + (H(801) - 0.5) * 640; if (tf.river && Math.abs(rx - tf.river.x) < 150) rx += (rx > tf.river.x ? 1 : -1) * 190; const np = 1 + (H(804) < 0.5 ? 1 : 0), passes = []; for (let i = 0; i < np; i++) passes.push({y: 120 + (i + 0.3 + H(805 + i) * 0.5) / np * (Hh - 240), w: 36, nat: true}); tf.ravine = {x: clamp(rx, 220, W - 220), amp: 18 + H(802) * 32, ph: H(803) * 6.28, w: 18, fords: passes}; } }
  if (H(70) < 0.45) tf.stream = {x: W / 2 + (H(71) - 0.5) * 900, amp: 30 + H(72) * 50, ph: H(73) * 6.28, w: 5};
  // lagos, pantanos, rocas, acantilados, dunas, nieve
  const lk = P.lakes >= 1 ? Math.floor(P.lakes) : (H(80) < P.lakes ? 1 : 0); for (let i = 0; i < lk; i++) { const [x, y] = pos(81 + i, 220); tf.lakes.push({x, y, rx: 50 + H(90 + i) * 70, ry: 32 + H(95 + i) * 40, rot: (H(99 + i) - 0.5)}); }
  const mn = P.marsh >= 1 ? Math.floor(P.marsh) : (H(100) < P.marsh ? 1 + Math.floor(H(101) * 2) : 0); for (let i = 0; i < mn; i++) { const [x, y] = pos(102 + i, 200); tf.marsh.push({x, y, rx: 70 + H(110 + i) * 80, ry: 40 + H(115 + i) * 40, rot: 0}); }
  for (let i = 0, n = cnt(P.rocks, 120); i < n; i++) { const [x, y] = pos(121 + i, 160); tf.rocks.push({x, y, r: 26 + H(135 + i) * 34}); }
  for (let i = 0, n = cnt(P.cliffs, 150); i < n; i++) { const [x, y] = pos(151 + i, 200); tf.cliffs.push({x, y, rx: 26 + H(160 + i) * 36, ry: 16 + H(165 + i) * 22, rot: (H(170 + i) - 0.5) * 2}); }
  for (let i = 0, n = cnt(P.dunes, 180); i < n; i++) { const [x, y] = pos(181 + i, 140); tf.dunes.push({x, y, rx: 80 + H(195 + i) * 90, ry: 40 + H(210 + i) * 40, rot: (H(225 + i) - 0.5) * 0.8}); }
  for (let i = 0, n = cnt(P.snow, 240); i < n; i++) { const [x, y] = pos(241 + i, 140); tf.snow.push({x, y, rx: 70 + H(260 + i) * 90, ry: 38 + H(275 + i) * 40, rot: 0}); }
  if (EL.cls === 'montaña') { for (let i = 0; i < 2; i++) { const [x, y] = pos(700 + i, 200); tf.cliffs.push({x, y, rx: 24 + H(710 + i) * 30, ry: 15 + H(715 + i) * 18, rot: (H(720 + i) - 0.5) * 2}); } for (let i = 0; i < 3; i++) { const [x, y] = pos(730 + i, 160); tf.rocks.push({x, y, r: 24 + H(740 + i) * 30}); } }
  if (EL.h > 2300) for (let i = 0; i < 4; i++) { const [x, y] = pos(750 + i, 140); tf.snow.push({x, y, rx: 70 + H(760 + i) * 90, ry: 38 + H(770 + i) * 40, rot: 0}); }
  tf.pond = tf.lakes[0] || null; tf.blocks = tf.lakes.concat(tf.cliffs);
  // bosques y arboledas
  for (let i = 0, n = cnt(P.forests, 300); i < n; i++) { const [x, y] = pos(301 + i, 90), big = bio === 2 || bio === 6; tf.forests.push({x, y, r: (big ? 55 : 34) + H(330 + i) * (big ? 80 : 46)}); }
  if (EL.h > 2300) tf.forests.length = Math.min(tf.forests.length, 1);          // por encima del límite del arbolado
  for (let i = 0, n = cnt(P.orchards, 360); i < n; i++) { const [x, y] = pos(361 + i, 120); tf.orchards.push({x, y, r: 26 + H(370 + i) * 20}); }
  // aldeas y pueblos (objetivos del combate), separados entre sí
  const nv = cnt(P.villages, 400); for (let i = 0, t = 0; i < nv && t < 80; t++) { const [x, y] = pos(401 + t * 2, 130); if (tf.villages.some(v => Math.hypot(v.x - x, v.y - y) < 150)) continue; if (tf.lakes.concat(tf.cliffs).some(e => inEll(x, y, e)) || (tf.river && Math.abs(x - tacRiverX(tf, y)) < 40)) continue; tf.villages.push({id: i, x, y, r: 34 + H(450 + i) * 16, n: 7 + Math.floor(H(470 + i) * 8), church: H(490 + i) < 0.55, big: false}); i++; }
  if (tf.villages.length) { tf.villages.slice().sort((p, q) => Math.hypot(p.x - W / 2, p.y - Hh / 2) - Math.hypot(q.x - W / 2, q.y - Hh / 2))[0].big = true; tf.villages.forEach(v => { if (v.big) { v.r += 14; v.n += 6; v.church = true; } }); }
  tf.villages.forEach(v => { v.r *= 0.74; });
  applySite(b, tf, H, bio);        // el pueblo sede de esta batalla (pueblos.js) moldea el escenario
  // caminos que unen las aldeas (de oeste a este) y salen del mapa
  const vs = tf.villages.slice().sort((p, q) => p.x - q.x); if (vs.length >= 2) { const pts = [[-20, vs[0].y + (H(500) - 0.5) * 120]].concat(vs.map(v => [v.x, v.y]), [[W + 20, vs[vs.length - 1].y + (H(501) - 0.5) * 120]]);
    const out = []; for (let i = 0; i < pts.length - 1; i++) { const a = pts[i], c = pts[i + 1], mx = (a[0] + c[0]) / 2, my = (a[1] + c[1]) / 2 + (H(510 + i) - 0.5) * 70; for (let t = 0; t <= 1; t += 0.08) { const u = 1 - t; out.push([u * u * a[0] + 2 * u * t * mx + t * t * c[0], u * u * a[1] + 2 * u * t * my + t * t * c[1]]); } } tf.roads.push({pts: out}); }
  // muros y setos, campos de cultivo (decorado)
  for (let i = 0, n = cnt(P.walls, 520); i < n; i++) { const [x, y] = pos(521 + i, 140), a = H(540 + i) * 3.14, l = 60 + H(560 + i) * 110; tf.walls.push({x1: x, y1: y, x2: x + Math.cos(a) * l, y2: y + Math.sin(a) * l}); }
  for (let i = 0; i < (P.fields || 0); i++) { const v = tf.villages[i % Math.max(1, tf.villages.length)], [x, y] = v ? [v.x + (H(600 + i) - 0.5) * 360, v.y + (H(640 + i) - 0.5) * 240] : pos(600 + i, 100); tf.fields.push({x, y, w: 50 + H(680 + i) * 80, h: 34 + H(720 + i) * 50, rot: (H(760 + i) < 0.5 ? 0.38 : -0.32) + (H(800 + i) - 0.5) * 0.2, tone: H(840 + i)}); }
  tf.farm = tf.villages[0] || null; b.tf = tf; return tf;
}
function tacRoadAt(tf, x, y) { let best = 1e9; (tf.roads || []).forEach(r => r.pts.forEach(p => { if (Math.abs(p[0] - x) < 24) best = Math.min(best, Math.hypot(p[0] - x, p[1] - y)); })); return best < 8; }
const segDist = (x, y, w) => { const dx = w.x2 - w.x1, dy = w.y2 - w.y1, l2 = dx * dx + dy * dy || 1, t = clamp(((x - w.x1) * dx + (y - w.y1) * dy) / l2, 0, 1); return Math.hypot(x - (w.x1 + t * dx), y - (w.y1 + t * dy)); };
function bvTerrAt(tf, x, y, side) {
  const o = {slow: 1, cover: false, water: false, hill: false, marsh: false, village: false, forest: false, cliff: false, road: false, steep: false};
  if (!tf || !tf.v2) return o;
  if (tf.river) { const rx = tacRiverX(tf, y); if (Math.abs(x - rx) < tf.river.w / 2 + 3 && !tf.river.fords.some(f => Math.abs(y - f.y) < f.w / 2)) { o.water = true; o.slow = 0.35; } }
  if (tf.ravine) { const rv = tf.ravine, rvx = rv.x + Math.sin(y / 70 + rv.ph) * rv.amp; if (Math.abs(x - rvx) < rv.w / 2 + 2 && !rv.fords.some(f => Math.abs(y - f.y) < f.w / 2)) { o.water = true; o.ravine = true; o.slow = 0.3; } }
  if (tf.stream) { const sx = tf.stream.x + Math.sin(y / 70 + tf.stream.ph) * tf.stream.amp; if (Math.abs(x - sx) < tf.stream.w / 2 + 2) o.slow = Math.min(o.slow, 0.6); }
  for (let i = 0; i < tf.lakes.length; i++) if (inEll(x, y, tf.lakes[i])) { o.water = true; o.slow = 0.3; }
  for (let i = 0; i < tf.cliffs.length; i++) if (inEll(x, y, tf.cliffs[i])) { o.water = true; o.cliff = true; o.slow = 0.3; }
  for (let i = 0; i < tf.hills.length; i++) { const h = tf.hills[i]; if (inEll(x, y, h)) { o.hill = true; if (h.side !== side) { o.slow = Math.min(o.slow, 0.55); o.steep = true; } else o.slow = Math.min(o.slow, 0.85); } }
  for (let i = 0; i < tf.forests.length; i++) { const f = tf.forests[i]; if (Math.hypot(x - f.x, y - f.y) < f.r * 0.92) { o.cover = true; o.forest = true; o.slow = Math.min(o.slow, 0.6); } }
  for (let i = 0; i < tf.orchards.length; i++) { const f = tf.orchards[i]; if (Math.hypot(x - f.x, y - f.y) < f.r) { o.cover = true; o.slow = Math.min(o.slow, 0.8); } }
  for (let i = 0; i < tf.villages.length; i++) { const v = tf.villages[i]; if (Math.abs(x - v.x) < v.r * 0.85 && Math.abs(y - v.y) < v.r * 0.7) { o.village = true; o.cover = true; o.slow = Math.min(o.slow, 0.85); } }
  for (let i = 0; i < tf.walls.length; i++) if (segDist(x, y, tf.walls[i]) < 4) { o.cover = true; o.slow = Math.min(o.slow, 0.8); }
  for (let i = 0; i < tf.marsh.length; i++) if (inEll(x, y, tf.marsh[i])) { o.marsh = true; o.slow = Math.min(o.slow, 0.45); }
  for (let i = 0; i < tf.rocks.length; i++) { const r = tf.rocks[i]; if (Math.hypot(x - r.x, y - r.y) < r.r) { o.cover = true; o.slow = Math.min(o.slow, 0.6); } }
  for (let i = 0; i < tf.dunes.length; i++) if (inEll(x, y, tf.dunes[i])) o.slow = Math.min(o.slow, 0.75);
  for (let i = 0; i < tf.snow.length; i++) if (inEll(x, y, tf.snow[i])) o.slow = Math.min(o.slow, 0.8);
  if (o.slow >= 1 && tacRoadAt(tf, x, y)) { o.slow = 1.3; o.road = true; }
  return o;
}
// rodear lagos y acantilados y buscar los vados del río
function tacWaypoint(tf, blk, tx, ty) {
  if (!tf || !tf.v2 || (!tf.river && !tf.blocks.length)) return null; const x = blk.x, y = blk.y; let hit = null;
  for (let i = 1; i <= 14; i++) { const px = x + (tx - x) * i / 14, py = y + (ty - y) * i / 14; if (bvTerrAt(tf, px, py, blk.side).water) { hit = [px, py]; break; } }
  if (!hit) return null;
  const blockE = tf.blocks.find(e => inEll(hit[0], hit[1], {x: e.x, y: e.y, rx: e.rx + 10, ry: e.ry + 10, rot: e.rot}));
  if (blockE) { const up = y < blockE.y ? -1 : 1; return [blockE.x - (blockE.rx + 10) * 0.2 * (x < blockE.x ? 1 : -1) * 0, blockE.y + up * (blockE.ry + 34)]; }
  if (!tf.river) return null; const r = tf.river, sign = x < tacRiverX(tf, y) ? 1 : -1; let best = null, bc = 1e9;
  r.fords.forEach(f => { const c = Math.abs(y - f.y) + Math.abs(f.y - ty) + Math.abs(x - tacRiverX(tf, f.y)) * 0.3; if (c < bc) { bc = c; best = f; } });
  const rx = tacRiverX(tf, best.y), ax = rx - sign * (r.w / 2 + 22), bx = rx + sign * (r.w / 2 + 22);
  if (Math.abs(x - ax) < 30 && Math.abs(y - best.y) < best.w / 2 - 4) return [bx, best.y]; return [ax, best.y];
}
function tacTerrainExtra() { }
function tacBgExtras() { }
function tacTerrAtExtra() { }
/* ---------- puntuación del terreno (para la IA) ---------- */
function tacTerrScore(tf, x, y, side) {
  const o = bvTerrAt(tf, x, y, side); let s = 0; if (o.water) return -8; if (o.hill) s += o.steep ? 1 : 3.2; if (o.village) s += 2.6; else if (o.cover) s += o.forest ? 1.8 : 1.4; if (o.marsh) s -= 3; if (o.road) s += 0.3; if (o.slow < 0.8) s -= 0.5;
  if (tf.river) { const d = Math.abs(x - tacRiverX(tf, y)); if (d < 90) s += 1.2; } return s;
}
/* ---------- dibujo del fondo ---------- */
const BIO_COL = {1: [118, 150, 74], 2: [84, 124, 62], 3: [196, 168, 108], 4: [138, 156, 84], 5: [128, 140, 112], 6: [62, 118, 58], 7: [112, 118, 90], 8: [214, 222, 228]};
function bvBuildBg(V, b) {
  const S = 2, cv = document.createElement('canvas'); cv.width = BV_W * S; cv.height = BV_H * S; const g = cv.getContext('2d'); g.scale(S, S);
  const tf = battleTerrain(b), bio = tf.bio, bc = BIO_COL[bio] || BIO_COL[1], H = (i, k) => hash2(i, V.seed, k), W = BV_W, Hh = BV_H, rgb = (m, a) => `rgba(${Math.min(255, bc[0] * m | 0)},${Math.min(255, bc[1] * m | 0)},${Math.min(255, bc[2] * m | 0)},${a})`;
  g.fillStyle = rgb(0.86, 1); g.fillRect(0, 0, W, Hh);
  for (let i = 0; i < 260; i++) { const x = H(i, 1) * W, y = H(i, 2) * Hh, r = 40 + H(i, 3) * 130, m = 0.78 + H(i, 4) * 0.4, rg = g.createRadialGradient(x, y, 0, x, y, r); rg.addColorStop(0, rgb(m, 0.35)); rg.addColorStop(1, rgb(m, 0)); g.fillStyle = rg; g.fillRect(x - r, y - r, r * 2, r * 2); }
  // campos de cultivo en parcelas
  tf.fields.forEach((f, i) => { g.save(); g.translate(f.x, f.y); g.rotate(f.rot); const m = 0.82 + f.tone * 0.42; g.fillStyle = rgb(m, 0.55); g.fillRect(-f.w / 2, -f.h / 2, f.w, f.h); g.strokeStyle = rgb(m * 0.7, 0.55); g.lineWidth = 0.8; g.strokeRect(-f.w / 2, -f.h / 2, f.w, f.h); g.strokeStyle = rgb(m * 0.82, 0.45); g.lineWidth = 0.6; for (let y = -f.h / 2 + 5; y < f.h / 2; y += 5) { g.beginPath(); g.moveTo(-f.w / 2, y); g.lineTo(f.w / 2, y); g.stroke(); } g.restore(); void i; });
  tf.dunes.forEach((d, i) => { g.save(); g.translate(d.x, d.y); g.rotate(d.rot); const rg = g.createRadialGradient(0, 0, 4, 0, 0, d.rx); rg.addColorStop(0, 'rgba(236,208,140,.65)'); rg.addColorStop(1, 'rgba(236,208,140,0)'); g.fillStyle = rg; g.beginPath(); g.ellipse(0, 0, d.rx, d.ry, 0, 0, 6.3); g.fill(); g.strokeStyle = 'rgba(150,118,60,.35)'; g.lineWidth = 1; for (let k = 0; k < 4; k++) { g.beginPath(); g.ellipse(0, k * 5 - 8, d.rx * (0.8 - k * 0.1), d.ry * 0.3, 0, 3.4, 6); g.stroke(); } g.restore(); void i; });
  tf.snow.forEach(d => { const rg = g.createRadialGradient(d.x, d.y, 4, d.x, d.y, d.rx); rg.addColorStop(0, 'rgba(250,252,255,.9)'); rg.addColorStop(1, 'rgba(250,252,255,0)'); g.fillStyle = rg; g.beginPath(); g.ellipse(d.x, d.y, d.rx, d.ry, 0, 0, 6.3); g.fill(); });
  tf.marsh.forEach((m, i) => { const rg = g.createRadialGradient(m.x, m.y, 4, m.x, m.y, m.rx); rg.addColorStop(0, 'rgba(52,86,70,.8)'); rg.addColorStop(0.7, 'rgba(70,104,76,.55)'); rg.addColorStop(1, 'rgba(70,104,76,0)'); g.fillStyle = rg; g.beginPath(); g.ellipse(m.x, m.y, m.rx, m.ry, 0, 0, 6.3); g.fill(); g.strokeStyle = 'rgba(150,200,215,.6)'; g.lineWidth = 1; for (let k = 0; k < 30; k++) { const x = m.x + (H(k + i * 70, 91) - 0.5) * m.rx * 1.5, y = m.y + (H(k + i * 70, 92) - 0.5) * m.ry * 1.4; g.beginPath(); g.moveTo(x - 4, y); g.lineTo(x + 4, y); g.stroke(); g.strokeStyle = 'rgba(38,70,44,.9)'; g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - 5); g.stroke(); g.strokeStyle = 'rgba(150,200,215,.6)'; } });
  // colinas con sombreado y curvas de nivel
  tf.hills.forEach(h => { g.save(); g.translate(h.x, h.y); g.rotate(h.rot || 0); const R = Math.max(h.rx, h.ry), rg = g.createRadialGradient(-h.rx * 0.2, -h.ry * 0.25, 8, 0, 0, R); rg.addColorStop(0, 'rgba(238,224,172,.5)'); rg.addColorStop(0.6, 'rgba(150,126,76,.34)'); rg.addColorStop(1, 'rgba(80,60,34,0)'); g.fillStyle = rg; g.beginPath(); g.ellipse(0, 0, h.rx * 1.12, h.ry * 1.1, 0, 0, 6.3); g.fill();
    g.fillStyle = 'rgba(40,28,14,.14)'; g.beginPath(); g.ellipse(12, 16, h.rx * 0.88, h.ry * 0.86, 0, 0, 6.3); g.fill(); g.strokeStyle = 'rgba(252,238,186,.28)'; g.lineWidth = 1.2; for (let i = 0; i < 5; i++) { g.beginPath(); g.ellipse(0, 0, h.rx * (1 - i * 0.18), h.ry * (1 - i * 0.18), 0, 0, 6.3); g.stroke(); } g.restore(); });
  tf.cliffs.forEach(c => { g.save(); g.translate(c.x, c.y); g.rotate(c.rot); g.fillStyle = 'rgba(40,36,34,.55)'; g.beginPath(); g.ellipse(2, 3, c.rx + 4, c.ry + 4, 0, 0, 6.3); g.fill(); g.fillStyle = '#6e675c'; g.beginPath(); for (let k = 0; k <= 14; k++) { const a = k / 14 * 6.283, r = 1 + (k % 2 ? 0.22 : -0.1); g.lineTo(Math.cos(a) * c.rx * r, Math.sin(a) * c.ry * r); } g.closePath(); g.fill(); g.fillStyle = 'rgba(255,255,255,.2)'; g.beginPath(); g.ellipse(-c.rx * 0.2, -c.ry * 0.25, c.rx * 0.5, c.ry * 0.3, 0, 0, 6.3); g.fill(); g.restore(); });
  tf.rocks.forEach((r, i) => { for (let k = 0; k < 8; k++) { const x = r.x + (H(k + i * 30, 95) - 0.5) * r.r * 1.6, y = r.y + (H(k + i * 30, 96) - 0.5) * r.r * 1.2, w = 5 + H(k + i * 30, 97) * 9; g.fillStyle = 'rgba(40,36,34,.35)'; g.beginPath(); g.ellipse(x + 2, y + 3, w, w * 0.5, 0, 0, 6.3); g.fill(); g.fillStyle = bio === 8 ? 'rgba(226,230,236,.95)' : 'rgba(128,120,110,1)'; g.beginPath(); g.moveTo(x - w, y + w * 0.4); g.lineTo(x - w * 0.3, y - w * 0.7); g.lineTo(x + w * 0.6, y - w * 0.5); g.lineTo(x + w, y + w * 0.4); g.closePath(); g.fill(); } });
  // lagos y ríos
  tf.lakes.forEach(l => { g.save(); g.translate(l.x, l.y); g.rotate(l.rot || 0); g.fillStyle = 'rgba(96,78,50,.5)'; g.beginPath(); g.ellipse(0, 0, l.rx + 7, l.ry + 7, 0, 0, 6.3); g.fill(); const rg = g.createRadialGradient(-l.rx * 0.2, -l.ry * 0.2, 2, 0, 0, l.rx); rg.addColorStop(0, 'rgba(124,180,216,.97)'); rg.addColorStop(1, 'rgba(52,104,146,.97)'); g.fillStyle = rg; g.beginPath(); g.ellipse(0, 0, l.rx, l.ry, 0, 0, 6.3); g.fill(); g.strokeStyle = 'rgba(235,248,255,.4)'; g.lineWidth = 1; g.beginPath(); g.ellipse(0, 0, l.rx * 0.6, l.ry * 0.55, 0, 0, 6.3); g.stroke(); g.restore(); });
  const strokeRiver = (xf, w, col, dash) => { g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = col; g.lineWidth = w; g.beginPath(); for (let y = -12; y <= Hh + 12; y += 8) { const x = xf(y); y === -12 ? g.moveTo(x, y) : g.lineTo(x, y); } g.stroke(); void dash; };
  if (tf.stream) { const s = tf.stream, xf = y => s.x + Math.sin(y / 70 + s.ph) * s.amp; strokeRiver(xf, s.w + 6, 'rgba(96,78,50,.4)'); strokeRiver(xf, s.w, 'rgba(70,128,170,.9)'); strokeRiver(xf, s.w * 0.4, 'rgba(160,205,232,.5)'); }
  if (tf.river) { const r = tf.river, xf = y => tacRiverX(tf, y); strokeRiver(xf, r.w + 14, 'rgba(96,78,50,.55)'); strokeRiver(xf, r.w, 'rgba(52,104,146,.95)'); strokeRiver(xf, r.w * 0.45, 'rgba(150,196,228,.45)');
    r.fords.forEach(f => { const x = xf(f.y); if (f.br) { g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(x - r.w / 2 - 10 + 3, f.y - 7 + 3, r.w + 20, 14); g.fillStyle = '#8a6a3c'; g.fillRect(x - r.w / 2 - 10, f.y - 7, r.w + 20, 14); g.strokeStyle = '#5a4020'; g.lineWidth = 1; for (let k = -r.w / 2 - 8; k < r.w / 2 + 8; k += 5) { g.beginPath(); g.moveTo(x + k, f.y - 7); g.lineTo(x + k, f.y + 7); g.stroke(); } } else { g.fillStyle = 'rgba(180,156,110,.85)'; g.fillRect(x - r.w / 2 - 10, f.y - f.w / 2, r.w + 20, f.w); g.fillStyle = 'rgba(120,98,64,.5)'; for (let k = 0; k < 24; k++) g.fillRect(x - r.w / 2 - 8 + H(k + f.y, 82) * (r.w + 16), f.y - f.w / 2 + H(k + f.y, 83) * f.w, 3, 2); } }); }
  // caminos
  tf.roads.forEach(r => { g.lineCap = 'round'; g.lineJoin = 'round'; [['rgba(96,78,48,.5)', 11], ['rgba(150,128,86,.55)', 6]].forEach(([c, w]) => { g.strokeStyle = c; g.lineWidth = w; g.beginPath(); r.pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.stroke(); }); });
  tf.walls.forEach(w => { g.strokeStyle = 'rgba(40,34,26,.4)'; g.lineWidth = 4; g.beginPath(); g.moveTo(w.x1 + 1, w.y1 + 2); g.lineTo(w.x2 + 1, w.y2 + 2); g.stroke(); g.strokeStyle = 'rgba(128,118,100,.95)'; g.lineWidth = 2.2; g.beginPath(); g.moveTo(w.x1, w.y1); g.lineTo(w.x2, w.y2); g.stroke(); });
  // bosques y arboledas
  const tree = (x, y, r, dark) => { g.fillStyle = 'rgba(0,0,0,.24)'; g.beginPath(); g.ellipse(x + 2, y + r * 0.7, r * 1.05, r * 0.45, 0, 0, 6.3); g.fill(); g.fillStyle = dark ? 'rgb(24,58,32)' : 'rgb(44,92,48)'; g.beginPath(); g.arc(x, y, r, 0, 6.3); g.fill(); g.fillStyle = dark ? 'rgba(46,90,50,.9)' : 'rgba(84,136,70,.9)'; g.beginPath(); g.arc(x - r * 0.25, y - r * 0.3, r * 0.62, 0, 6.3); g.fill(); };
  tf.forests.forEach((f, fi) => { const rg = g.createRadialGradient(f.x, f.y, f.r * 0.2, f.x, f.y, f.r); rg.addColorStop(0, 'rgba(18,50,28,.55)'); rg.addColorStop(1, 'rgba(18,50,28,0)'); g.fillStyle = rg; g.beginPath(); g.arc(f.x, f.y, f.r * 1.05, 0, 6.3); g.fill(); const n = Math.round(f.r * f.r / 48); for (let i = 0; i < n; i++) { const a = H(i + fi * 400, 70) * 6.283, d = Math.sqrt(H(i + fi * 400, 71)) * f.r * 0.95; tree(f.x + Math.cos(a) * d, f.y + Math.sin(a) * d * 0.85, 3.2 + H(i + fi * 400, 72) * 3.6, bio === 6 || bio === 2); } });
  tf.orchards.forEach((f, fi) => { for (let i = 0; i < 12; i++) { const a = H(i + fi * 50, 76) * 6.283, d = Math.sqrt(H(i + fi * 50, 77)) * f.r; tree(f.x + Math.cos(a) * d, f.y + Math.sin(a) * d, 3 + H(i, 78) * 2, false); } });
  // aldeas: casas pequeñas, iglesia y huertos
  tf.villages.forEach((v, vi) => { g.fillStyle = 'rgba(70,52,30,.22)'; g.beginPath(); g.ellipse(v.x, v.y + 4, v.r * 0.95, v.r * 0.72, 0, 0, 6.3); g.fill();
    for (let i = 0; i < v.n; i++) { const a = H(i + vi * 60, 5) * 6.283, d = Math.sqrt(H(i + vi * 60, 6)) * v.r * 0.78, x = v.x + Math.cos(a) * d, y = v.y + Math.sin(a) * d * 0.7, w = 8 + H(i + vi * 60, 7) * 6, h = 6 + H(i + vi * 60, 8) * 4; g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(x - w / 2 + 2, y - h / 2 + 2, w, h); g.fillStyle = H(i + vi * 60, 9) < 0.5 ? '#6d3d28' : '#7a4a30'; g.fillRect(x - w / 2, y - h / 2, w, h); g.fillStyle = 'rgba(255,230,190,.25)'; g.fillRect(x - w / 2, y - h / 2, w, 2); }
    if (v.church) { g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(v.x - 3, v.y - 3, 14, 9); g.fillStyle = '#c8b894'; g.fillRect(v.x - 4, v.y - 5, 8, 11); g.fillStyle = '#7a2c22'; g.beginPath(); g.moveTo(v.x - 5, v.y - 5); g.lineTo(v.x, v.y - 13); g.lineTo(v.x + 5, v.y - 5); g.closePath(); g.fill(); }
    g.strokeStyle = 'rgba(255,235,170,.18)'; g.setLineDash([3, 4]); g.lineWidth = 1; g.beginPath(); g.ellipse(v.x, v.y, v.r, v.r * 0.82, 0, 0, 6.3); g.stroke(); g.setLineDash([]); });
  const vg = g.createRadialGradient(W / 2, Hh / 2, Hh * 0.5, W / 2, Hh / 2, W * 0.62); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.28)'); g.fillStyle = vg; g.fillRect(0, 0, W, Hh);
  return cv;
}
/* ---------- efectos y descripción ---------- */
function terrMods(b, side) {
  const tf = battleTerrain(b), isAtt = b.att === side, st = (side === 'A' ? b.strA : b.strB) || 'frontal'; let att = 0, def = 0;
  /* las alturas ya no dan defensa plana: su valor es la artillería (alcance y fuego plongeante), la visión y las pendientes que frenan */
  if (tf.river && isAtt && b.day <= 3) att -= 0.07 * (st === 'flank' ? 0.4 : 1);
  if (tf.forests.length >= 6) { if (!isAtt) def += 0.03; if (st === 'charge') att -= 0.05; }
  if (tf.villages.length >= 3 && !isAtt) def += 0.03; if (tf.rocks.length >= 2 && !isAtt) def += 0.02; if (tf.cliffs.length && !isAtt) def += 0.02; if (tf.marsh.length && isAtt && b.day <= 3) att -= 0.02;
  if (typeof tacMods === 'function') { const pm = tacMods(b, side); att += pm.att; def += pm.def; } return {att, def};
}
function terrainInfo(b) {
  const tf = battleTerrain(b), nm = s => G.C[s === 'A' ? b.A0 : b.B0].name, out = [], n = (a) => a.length;
  if (tf.elev) out.push(['🗺️', `Relieve real: ${tf.elev.name} · ${tf.elev.h} m`, `Datos topográficos reales de la región (desnivel típico ±${tf.elev.rough} m). ${tf.elev.cls === 'montaña' ? 'Terreno de montaña: el defensor gana +3% y el atacante pierde 3%; a más de 2.300 m no hay arbolado.' : tf.elev.cls === 'colinas' ? 'Muchas colinas: el terreno elevado decide la batalla.' : tf.elev.cls === 'llanura' ? 'Llanura abierta: casi sin colinas, el fuego domina el campo.' : 'Terreno ondulado con alguna loma.'}`]);
  if (tf.hill) out.push(['⛰️', `Alturas (${n(tf.hills)})`, `La principal es de ${nm(tf.hill.side)}. NO dan defensa por sí mismas: su valor es colocar BATERÍAS arriba (alcance +30%, fuego plongeante más dañino y vista sobre bosques y aldeas). Subir una cuesta frena mucho (−45% de velocidad) y detrás de una altura no hay línea de visión.`]);
  if (tf.ravine) out.push(['🕳️', 'Barranco', 'Infranqueable: solo se cruza por los pasos naturales (pocos) y por un puente de pontones si hay río. La artillería puede batir el otro lado.']);
  if (tf.river) out.push(['🌉', 'Puentes de pontones', 'Los ingenieros pueden tender un puente de pontones en cualquier punto del río (cuesta recursos y tarda en estar listo).']);
  if (tf.river) out.push(['🌊', 'Río con vados y puentes', 'Solo se cruza por vados y puentes (los regimientos buscan el más cercano). El atacante sufre −7% de ataque los 3 primeros días.']);
  if (tf.stream) out.push(['〰️', 'Arroyo', 'Se cruza por cualquier punto pero frena (−40% de velocidad).']);
  if (n(tf.lakes)) out.push(['💧', `Lagos (${n(tf.lakes)})`, 'Infranqueables: hay que rodearlos.']);
  if (n(tf.cliffs)) out.push(['🧗', 'Acantilados', 'Infranqueables y refuerzan la defensa (+2%).']);
  if (n(tf.marsh)) out.push(['🟩', 'Pantanos', 'Avance a menos de la mitad de velocidad, sin cobertura.']);
  if (n(tf.forests)) out.push(['🌲', `Bosques (${n(tf.forests)})`, 'Cobertura para quien se sitúe dentro, pero frenan (−40%) e impiden cargar con eficacia.']);
  if (n(tf.villages)) out.push(['🏘️', `Aldeas (${n(tf.villages)})`, 'Objetivos del combate: el bando con más regimientos dentro las controla, y cada aldea controlada da cobertura, moral y bonos. +3% de defensa para el defensor.']);
  if (n(tf.walls)) out.push(['🧱', 'Muros y setos', 'Cobertura ligera para quien se resguarde tras ellos.']);
  if (n(tf.rocks)) out.push(['🪨', 'Roquedales', 'Cobertura y frenan (−40%); +2% de defensa para el defensor.']);
  if (n(tf.dunes)) out.push(['🏜️', 'Dunas', 'Terreno blando: −25% de velocidad.']);
  if (n(tf.snow)) out.push(['❄️', 'Ventisqueros', 'Nieve profunda: −20% de velocidad.']);
  if (n(tf.roads)) out.push(['🛤️', 'Caminos', 'Marcha un 30% más rápida.']);
  if ((b.forts || []).some(f => f.kind === 'fort')) { const f = b.forts.find(x => x.kind === 'fort'); out.push(['🏯', 'Fuerte de la provincia', `Fuerte nivel ${f.lvl || 1} del defensor, con ${f.guns} cañones. Se puede bombardear y destruir.`]); }
  if (!out.length) out.push(['🌾', 'Terreno abierto', 'Sin accidentes relevantes: gana el mejor ejército.']); return out;
}
// atrincheramiento del defensor (con la tecnología de trincheras llega a nivel 10 y los blindados del atacante lo reducen)
function trenchInfo(b) {
  if (G.date.y < 1900) return null;
  const ds = b.att === 'A' ? 'B' : 'A', ids = ds === 'A' ? b.A : b.B; let lv = 0; ids.forEach(id => { const a = armyById(id); if (a) lv = Math.max(lv, a.dig || 0); }); if (lv < 2) return null;
  const tag = ds === 'A' ? b.A0 : b.B0, tech = hasTech(G.C[tag], 'trench_warfare'), per = tech ? 0.05 : 0.04, arm = b['arm' + (ds === 'A' ? 'B' : 'A')] || 0, red = clamp(arm * 2, 0, 1) * 0.55, eff = lv * per * (1 - red);
  return ['⛏️', `${tech ? 'Trincheras' : 'Atrincheramiento'} nv. ${lv}`, `+${Math.round(eff * 100)}% de defensa para ${G.C[tag].name}.`];
}
