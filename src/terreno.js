/* ===== TERRENO DEL CAMPO DE BATALLA =====
   Cada batalla tiene rasgos propios (deterministas según la provincia): una COLINA que domina uno de los bandos, un RÍO con vados, BOSQUES y
   alguna GRANJA fortificable. Tienen efecto real en el combate (modificadores de ataque y defensa) y en el visor (los bloques vadean, se
   cubren entre los árboles o suben la loma, más lentos). El panel de batalla explica qué rasgos hay y qué aportan. */
function battleTerrain(b) {
  if (b.tf) return b.tf;
  const pv = MAP.provs[b.prov], bio = pv.biome, H = k => hash2(b.id * 31 + 7, b.prov, k), W = 960, Hh = 420, defSide = b.att === 'A' ? 'B' : 'A', dd = defSide === 'A' ? -1 : 1;
  const tf = {bio, hill: null, river: null, forests: [], farm: null};
  const pHill = {7: 0.9, 8: 0.5, 5: 0.35, 4: 0.3, 1: 0.25, 2: 0.25, 3: 0.2, 6: 0.15}[bio];
  if (H(1) < (pHill === undefined ? 0.2 : pHill)) { const side = H(2) < 0.72 ? defSide : b.att, sd = side === 'A' ? -1 : 1; tf.hill = {side, x: W / 2 + sd * (70 + H(3) * 40), y: Hh / 2 + (H(4) - 0.5) * 60, rx: 84 + H(5) * 20, ry: 118 + H(6) * 30}; }
  const pRiver = {1: 0.32, 4: 0.28, 2: 0.3, 6: 0.38, 3: 0.08, 5: 0.22, 7: 0.1, 8: 0.15}[bio];
  if (H(7) < (pRiver === undefined ? 0.2 : pRiver)) tf.river = {x: W / 2 + dd * 30 + (H(8) - 0.5) * 40, amp: 16 + H(9) * 14, ph: H(10) * 6.28, w: 24, fords: [{y: Hh * (0.38 + H(11) * 0.24), w: 62}, {y: H(12) < 0.5 ? 56 : Hh - 52, w: 50}]};
  const nF = bio === 2 || bio === 6 ? 4 + Math.floor(H(13) * 3) : H(14) < 0.45 ? 1 + Math.floor(H(15) * 2) : 0;
  for (let i = 0; i < nF; i++) { const top = H(20 + i) < 0.5, r = 34 + H(30 + i) * 34; tf.forests.push({x: 90 + H(40 + i) * (W - 180), y: top ? 36 + H(50 + i) * 90 : Hh - 36 - H(50 + i) * 80, r}); }
  if ((bio === 1 || bio === 4) && H(60) < 0.5) tf.farm = {x: W / 2 + dd * (96 + H(61) * 30), y: Hh * (0.3 + H(62) * 0.4), w: 46, h: 28, side: defSide};
  b.tf = tf; return tf;
}
// modificadores reales de ataque y defensa de un bando por el terreno
function terrMods(b, side) {
  const tf = battleTerrain(b), isAtt = b.att === side, st = (side === 'A' ? b.strA : b.strB) || 'frontal'; let att = 0, def = 0;
  if (tf.hill) { if (tf.hill.side === side) def += 0.08 + (st === 'hold' ? 0.04 : 0); else att -= 0.05; }
  if (tf.river && isAtt && b.day <= 3) att -= 0.07 * (st === 'flank' ? 0.4 : 1);
  if (tf.forests.length >= 2) { if (!isAtt) def += 0.04; if (st === 'charge') att -= 0.05; }
  if (tf.farm && tf.farm.side === side) def += 0.03;
  return {att, def};
}
// descripción de los rasgos para el panel: [icono, texto, detalle]
function terrainInfo(b) {
  const tf = battleTerrain(b), nm = s => G.C[s === 'A' ? b.A0 : b.B0].name, out = [];
  if (tf.hill) out.push(['⛰️', `Colina de ${nm(tf.hill.side)}`, `${nm(tf.hill.side)}: +8% defensa (+4% más con «Aguardar en los altos»). El rival ataca cuesta arriba: −5% ataque y avanza más despacio.`]);
  if (tf.river) out.push(['🌊', 'Río con vados', 'El atacante sufre −7% de ataque los 3 primeros días mientras cruza (−3% si flanquea por los vados). Los bloques que vadean van mucho más lentos.']);
  if (tf.forests.length >= 2) out.push(['🌲', 'Bosques', 'Cobertura para el defensor (+4% defensa); las cargas pierden 5% de ataque entre los árboles.']);
  else if (tf.forests.length === 1) out.push(['🌳', 'Arboleda', 'Un bosquecillo que da cobertura y frena a quien lo cruza.']);
  if (tf.farm) out.push(['🏠', `Granja de ${nm(tf.farm.side)}`, `Punto fuerte: +3% defensa para ${nm(tf.farm.side)}.`]);
  if (!out.length) out.push(['🌾', 'Terreno abierto', 'Sin accidentes relevantes: gana el mejor ejército.']);
  return out;
}
// ¿qué hay bajo un punto del campo? (velocidad, cobertura, vado…)
function bvTerrAt(tf, x, y, side) {
  const o = {slow: 1, cover: false, water: false, hill: false};
  if (tf.river) { const rx = tf.river.x + Math.sin(y / 70 + tf.river.ph) * tf.river.amp; if (Math.abs(x - rx) < tf.river.w / 2 + 3 && !tf.river.fords.some(f => Math.abs(y - f.y) < f.w / 2)) { o.water = true; o.slow = 0.38; } }
  tf.forests.forEach(f => { if (Math.hypot(x - f.x, y - f.y) < f.r * 0.95) { o.cover = true; o.slow = Math.min(o.slow, 0.68); } });
  if (tf.hill && ((x - tf.hill.x) / tf.hill.rx) ** 2 + ((y - tf.hill.y) / tf.hill.ry) ** 2 < 1) { o.hill = true; if (tf.hill.side !== side) o.slow = Math.min(o.slow, 0.82); }
  if (tf.farm && Math.abs(x - tf.farm.x) < tf.farm.w / 2 + 6 && Math.abs(y - tf.farm.y) < tf.farm.h / 2 + 6) o.cover = true;
  return o;
}
