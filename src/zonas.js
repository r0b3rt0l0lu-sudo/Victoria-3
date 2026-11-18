/* ===== MÁS ZONAS DE COMBATE =====
   Amplía las sedes de batalla de pueblos.js (cruce, puente, altura, bosque, villa amurallada y vado) con ocho escenarios nuevos que moldean el terreno ya generado:
   · desfiladero (paso estrecho entre riscos), castillo en la colina, calzada entre marismas, llanura abierta, cantera y ruinas, oasis y dunas (solo desierto),
     paso nevado (solo nieve/alta montaña) y CAMINO (solo para batallas en ruta, ver combate_ruta.js: setos y zanjas a ambos lados de un camino con una venta).
   Cada provincia sigue teniendo 3 sedes fijas, pero ahora el reparto entre 13 tipos hace que casi nunca coincidan dos batallas seguidas. Cada tipo añade su propio objetivo
   (se controla con las unidades y da bonificaciones, como el puente o la altura). */
const ZONAS = {
  desfiladero: {n: 'desfiladero', ic: '🏔️', d: 'Un paso estrecho entre riscos: el frente es angosto, no hay flancos y manda la artillería.'},
  fortaleza: {n: 'castillo en la colina', ic: '🏰', d: 'Un castillo corona la loma sobre el pueblo: quien lo guarnece domina el campo y es muy difícil de desalojar.'},
  calzada: {n: 'calzada entre marismas', ic: '🛣️', d: 'Las marismas a ambos lados dejan una sola calzada firme: avanzar fuera de ella es lento y peligroso.'},
  llanura: {n: 'llanura abierta', ic: '🌾', d: 'Terreno despejado sin apenas cobertura: ganan la caballería, el fuego y la maniobra.'},
  pedregal: {n: 'cantera y ruinas', ic: '🪨', d: 'Rocas, canteras y muros derruidos dan cobertura dispersa y rompen las líneas de marcha.'},
  camino: {n: 'camino en marcha', ic: '🐎', d: 'Dos ejércitos se encuentran de camino: un camino estrecho con setos y zanjas y una venta en medio.'},
  oasis: {n: 'oasis y dunas', ic: '🏜️', d: 'Dunas altas rodean un oasis: el agua y las palmeras son el objetivo.'},
  ventisca: {n: 'paso nevado', ic: '❄️', d: 'Ventisqueros y roca helada estrechan el paso; moverse cuesta el doble.'}
};
Object.assign(SITE_KINDS, ZONAS);
['desfiladero', 'fortaleza', 'calzada', 'llanura', 'pedregal', 'oasis', 'ventisca'].forEach(k => SITE_ORDER.push(k));
const zonaOk = (k, bio) => k === 'oasis' ? bio === 3 : k === 'ventisca' ? (bio === 5 || bio === 8) : k === 'calzada' ? ![3, 7, 8].includes(bio) : k === 'llanura' ? ![2, 7, 8].includes(bio) : k === 'desfiladero' ? bio !== 3 : true;
const _provTownsZ = provTowns;
provTowns = function (pid) {
  const fresh = !_townCache[pid], T = _provTownsZ(pid);
  if (fresh) { const bio = MAP.provs[pid].biome; T.forEach(t => { if (!zonaOk(t.kind, bio)) t.kind = bio === 3 ? (t.i % 2 ? 'cruce' : 'oasis') : bio === 8 || bio === 5 ? 'ventisca' : 'cruce'; }); }
  return T;
};
// sede de las batallas en ruta (no pertenece a ninguno de los 3 pueblos de la provincia)
function roadSite(b) {
  if (b._rs) return b._rs; const pv = MAP.provs[b.prov];
  return (b._rs = {i: 50 + (b.id % 47), name: `Camino hacia ${provName(b.road.to).replace(/ \(prov\. \d+\)/, '')}`, kind: 'camino', lang: nameLang(pv.lon, pv.lat)});
}
function zonaShape(b, tf, H, k) {
  const W = BV_W, Hh = BV_H, town = tf.town, cx = town.x, cy = town.y, defSide = b.att === 'A' ? 'B' : 'A';
  const near = (e, r) => Math.hypot(e.x - cx, e.y - cy) < r;
  if (k === 'desfiladero') {
    tf.forests = tf.forests.filter(f => Math.abs(f.y - cy) > 230); tf.hills = tf.hills.filter(h => Math.abs(h.y - cy) > 200 || tf.hills.length < 2); tf.cliffs = tf.cliffs.filter(c => Math.abs(c.y - cy) > 230); tf.lakes = tf.lakes.filter(l => Math.abs(l.y - cy) > 190); tf.marsh = tf.marsh.filter(m => Math.abs(m.y - cy) > 160);
    for (let x = 40, i = 0; x < W - 40; x += 105, i++) {
      tf.cliffs.push({x: x + (H(910 + i) - 0.5) * 30, y: cy - 175 + (H(920 + i) - 0.5) * 36, rx: 66 + H(930 + i) * 32, ry: 38 + H(940 + i) * 26, rot: (H(950 + i) - 0.5) * 0.6},
        {x: x + 52 + (H(960 + i) - 0.5) * 30, y: cy + 175 + (H(970 + i) - 0.5) * 36, rx: 66 + H(980 + i) * 32, ry: 38 + H(990 + i) * 26, rot: (H(1000 + i) - 0.5) * 0.6});
    }
    tf.roads.push({pts: [[-20, cy], [cx - 200, cy + 14], [cx, cy], [cx + 200, cy - 14], [W + 20, cy]]}); town.r = 44;
  } else if (k === 'fortaleza') {
    tf.hills = tf.hills.filter(h => !near(h, 170)); const h0 = {x: cx, y: cy, rx: 185, ry: 128, rot: 0, side: defSide}; tf.hills.unshift(h0); tf.hill = h0; tf.hills.forEach((h, i) => { if (i) h.side = h.x > W / 2 ? 'B' : 'A'; }); tf.hill2 = tf.hills[1] || null;
    const R = 58; tf.walls = tf.walls.filter(w => Math.hypot((w.x1 + w.x2) / 2 - cx, (w.y1 + w.y2) / 2 - cy) > 160);
    [[-R, -R, R, -R], [-R, R, R, R], [-R, -R, -R, -R * 0.25], [-R, R * 0.25, -R, R], [R, -R, R, -R * 0.25], [R, R * 0.25, R, R]].forEach(([a, c, d, e]) => tf.walls.push({x1: cx + a, y1: cy + c, x2: cx + d, y2: cy + e})); town.r = 46;
  } else if (k === 'calzada') {
    tf.forests = tf.forests.filter(f => Math.abs(f.y - cy) > 230); tf.hills = tf.hills.filter(h => Math.abs(h.y - cy) > 220 || tf.hills.length < 2); tf.river = null; tf.stream = null; tf.marsh = [];
    tf.roads.push({pts: [[-20, cy], [cx - 260, cy - 20], [cx, cy], [cx + 260, cy + 20], [W + 20, cy]]});
    for (let i = 0; i < 9; i++) { const x = 90 + i * 215; tf.marsh.push({x, y: cy - 165 - H(1010 + i) * 40, rx: 120 + H(1020 + i) * 50, ry: 70 + H(1030 + i) * 26, rot: (H(1040 + i) - 0.5) * 0.4}, {x: x + 100, y: cy + 165 + H(1050 + i) * 40, rx: 120 + H(1060 + i) * 50, ry: 70 + H(1070 + i) * 26, rot: (H(1080 + i) - 0.5) * 0.4}); }
  } else if (k === 'llanura') {
    tf.forests = []; tf.orchards = []; tf.walls = []; tf.rocks = []; tf.cliffs = []; tf.hills = tf.hills.slice(0, 1).map(h => Object.assign(h, {rx: h.rx * 0.6, ry: h.ry * 0.6})); tf.hill = tf.hills[0] || tf.hill; tf.hill2 = null; tf.villages = [town];
  } else if (k === 'pedregal') {
    tf.forests = tf.forests.filter(f => !near(f, 190));
    for (let i = 0; i < 11; i++) { const a = H(1100 + i) * 6.28, d = 120 + H(1110 + i) * 230, x = clamp(cx + Math.cos(a) * d, 60, W - 60), y = clamp(cy + Math.sin(a) * d * 0.6, 60, Hh - 60); tf.rocks.push({x, y, r: 22 + H(1120 + i) * 28}); }
    for (let i = 0; i < 2; i++) tf.cliffs.push({x: clamp(cx + (i ? 1 : -1) * (200 + H(1130 + i) * 120), 80, W - 80), y: cy + (H(1140 + i) - 0.5) * 220, rx: 40 + H(1150 + i) * 30, ry: 24 + H(1160 + i) * 18, rot: (H(1170 + i) - 0.5)});
    [[-90, -40, -30, -48], [30, 60, 100, 52], [-60, 80, 10, 90], [60, -80, 120, -72]].forEach(([a, c, d, e]) => tf.walls.push({x1: cx + a, y1: cy + c, x2: cx + d, y2: cy + e}));
  } else if (k === 'camino') {
    town.name = 'la venta del camino'; town.r = 30; town.n = 5; town.church = false; tf.villages = [town];
    tf.forests = tf.forests.filter(f => Math.abs(f.y - cy) > 160); tf.cliffs = tf.cliffs.filter(c => Math.abs(c.y - cy) > 160); tf.marsh = tf.marsh.filter(m => Math.abs(m.y - cy) > 140);
    for (let i = 0; i < 6; i++) { const x = 110 + i * 330; tf.forests.push({x: x + (H(1180 + i) - 0.5) * 60, y: cy - 215 - H(1190 + i) * 40, r: 78 + H(1200 + i) * 30}, {x: x + 120, y: cy + 215 + H(1210 + i) * 40, r: 78 + H(1220 + i) * 30}); }
    tf.roads.push({pts: [[-20, cy + 20], [cx - 300, cy - 15], [cx, cy], [cx + 300, cy + 15], [W + 20, cy - 20]]});
    for (let x = 40, i = 0; x < W - 80; x += 140, i++) { if (Math.abs(x + 50 - cx) < 90) continue; if (H(1230 + i) < 0.78) tf.walls.push({x1: x, y1: cy - 72 + (x - cx) * 0.02, x2: x + 100, y2: cy - 72 + (x + 100 - cx) * 0.02}); if (H(1240 + i) < 0.78) tf.walls.push({x1: x + 40, y1: cy + 74 + (x - cx) * 0.02, x2: x + 140, y2: cy + 74 + (x + 100 - cx) * 0.02}); }
  } else if (k === 'oasis') {
    tf.lakes.push({x: cx + 95, y: cy - 60, rx: 56, ry: 36, rot: 0.2}); tf.forests.push({x: cx + 95, y: cy - 60, r: 44}, {x: cx - 20, y: cy + 90, r: 34});
    for (let i = 0; i < 6; i++) tf.dunes.push({x: 120 + H(1250 + i) * (W - 240), y: 110 + H(1260 + i) * (Hh - 220), rx: 100 + H(1270 + i) * 90, ry: 44 + H(1280 + i) * 36, rot: (H(1290 + i) - 0.5) * 0.8});
  } else if (k === 'ventisca') {
    for (let i = 0; i < 9; i++) tf.snow.push({x: 100 + H(1300 + i) * (W - 200), y: 100 + H(1310 + i) * (Hh - 200), rx: 90 + H(1320 + i) * 100, ry: 44 + H(1330 + i) * 40, rot: 0});
    for (let i = 0; i < 3; i++) tf.cliffs.push({x: clamp(cx + (i - 1) * 260 + (H(1340 + i) - 0.5) * 80, 90, W - 90), y: i === 1 ? cy - 190 : cy + 170, rx: 44 + H(1350 + i) * 30, ry: 24 + H(1360 + i) * 18, rot: (H(1370 + i) - 0.5)});
  }
}
const _applySiteZ = applySite;
applySite = function (b, tf, H, bio) {
  _applySiteZ(b, tf, H, bio); const k = tf.siteKind; if (!ZONAS[k] || !tf.town) return;
  zonaShape(b, tf, H, k); tf.blocks = tf.lakes.concat(tf.cliffs); tf.pond = tf.lakes[0] || null;
};
// objetivos propios de cada sede nueva
const _siteObjZ = siteObjectives;
siteObjectives = function (tf) {
  if (tf.objs) return tf.objs; const o = _siteObjZ(tf), k = tf.siteKind, t = tf.town; if (!t || !ZONAS[k]) return o;
  const add = (id, ic, name, x, y, r, w) => o.push({id, ic, name, x, y, r, w});
  if (k === 'desfiladero') add('pass', '🏔️', 'el desfiladero', t.x, t.y, 130, 2);
  else if (k === 'fortaleza' && tf.hill) { add('castle', '🏰', 'el castillo', t.x, t.y, 70, 2.5); }
  else if (k === 'calzada') add('causeway', '🛣️', 'la calzada', t.x, t.y, 150, 2);
  else if (k === 'pedregal') add('ruins', '🪨', 'las ruinas', t.x - 20, t.y + 60, 80, 1.5);
  else if (k === 'camino') { o[0].w = 1.5; add('xroad', '🐎', 'el camino', t.x - 260, t.y, 90, 1); add('xroad2', '🐎', 'el camino', t.x + 260, t.y, 90, 1); }
  else if (k === 'oasis') { const l = tf.lakes[tf.lakes.length - 1]; if (l) add('oasis', '🌴', 'el oasis', l.x, l.y, 90, 2); }
  else if (k === 'ventisca') add('snowpass', '❄️', 'el paso', t.x, t.y, 120, 1.5);
  return o;
};
