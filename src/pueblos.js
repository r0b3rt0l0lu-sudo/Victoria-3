/* ===== PUEBLOS DE CADA PROVINCIA: sedes de batalla con nombre propio =====
   Cada provincia tiene 3 pueblos con nombre (siempre los mismos). Cada batalla se libra en uno de ellos, y cada pueblo impone su propio escenario
   (cruce de caminos, puente, altura, bosque, villa amurallada o vado), así que dos batallas en la misma provincia casi nunca se parecen.
   Los nombres salen de una lista por lengua/región (ver nameLang); las listas son de topónimos comunes de la época, no de lugares exactos. */
const TOWN_NAMES = {
  es: ['Villanueva del Campo', 'Santa Eulalia', 'Torrecilla', 'Valdemoro', 'San Millán', 'Peñafiel', 'Fuentelcarro', 'Castrojeriz', 'Villaverde', 'Navalcarnero', 'Puentecesures', 'Alcalá de Henares', 'Cantalapiedra', 'Mombeltrán', 'Almendral', 'Los Arcos', 'Monteagudo', 'La Bañeza', 'Hontanar', 'Torreblanca', 'Sotillo', 'Aldeanueva', 'Cerro Gordo', 'Valverde', 'Riofrío', 'Piedrahíta', 'San Roque', 'Carrascal', 'Mirabel', 'Bailén'],
  pt: ['Vila Nova', 'Santa Comba', 'Ponte da Barca', 'Montemor', 'São Pedro', 'Alcobaça', 'Torres Novas', 'Vila Real', 'Castelo Branco', 'Ourique', 'Ribeira', 'Penedono', 'Vimioso', 'Salvaterra', 'Fontelo', 'Aldeia Velha'],
  fr: ['Saint-Aubin', 'Villeneuve', 'Montfort', 'Beaumont', 'Châteauneuf', 'La Ferté', 'Sainte-Colombe', 'Bellevue', 'Pont-de-Vaux', 'Montmirail', 'Valmy', 'Neuville', 'Vieux-Moulin', 'Saint-Privat', 'Mouzon', 'Champaubert', 'Rocroi', 'Vaucouleurs', 'Fleury', 'Lignières', 'Saint-Cloud', 'Bourg-la-Reine', 'Marcilly', 'Étoges', 'Brienne'],
  en: ['Whitby', 'Oakham', 'Netherby', 'Ashford', 'Kingsbridge', 'Little Marsh', 'Redcliffe', 'Stonehaven', 'Hartley', 'Wetherby', 'Thornbury', 'Millbrook', 'Eastwick', 'Brampton', 'Coldstream', 'Marlow', 'Cranleigh', 'Fairford', 'Elmstead', 'Ravenscar', 'Abbotsford', 'Wickham', 'Dunmore', 'Glenrock', 'Hollin Cross'],
  us: ['Spring Creek', 'Cedar Hollow', 'Fort Harmon', 'Mill Run', 'Oak Grove', 'Rock Ford', 'New Salem', 'Pleasant Hill', 'Bull Run Crossing', 'Cross Keys', 'Antioch', 'Shiloh Church', 'Cold Harbor', 'Sharpsburg', 'Black Creek', 'Gum Springs', 'Dry Fork', 'Harper\'s Mill', 'Lone Pine', 'Bear Valley'],
  de: ['Neustadt', 'Oberdorf', 'Rosenau', 'Waldheim', 'Königshofen', 'Altenburg', 'Bad Brunn', 'Kirchhain', 'Steinau', 'Hohenfeld', 'Grünberg', 'Lindenau', 'Mühlhausen', 'Schönwald', 'Burgstädt', 'Weißenfels', 'Rothenbach', 'Eichstätt', 'Nordheim', 'Sankt Georgen', 'Hainichen', 'Dornach', 'Wartenberg', 'Zornhof', 'Lützen'],
  it: ['San Martino', 'Solferino', 'Castelfidardo', 'Villafranca', 'Monteleone', 'Ponte Vecchio', 'Santa Lucia', 'Custoza', 'Montebello', 'Borgo Nuovo', 'Casteggio', 'Rivoli', 'Montenotte', 'Calatafimi', 'Marengo', 'Pieve di Cadore', 'Torre del Greco', 'Velletri'],
  sl: ['Borodino', 'Novaya Slobodá', 'Krasnoye', 'Malo Yaroslávets', 'Bielá Tserkov', 'Gorky', 'Pokrovskoye', 'Stary Oskol', 'Zelená Hora', 'Kamenets', 'Vyazma', 'Trnovo', 'Plevna', 'Shipka', 'Gródek', 'Wola', 'Ostrolęka', 'Smolany', 'Nové Zámky', 'Sadová', 'Chlum', 'Ligny Nové', 'Dubno', 'Berezina', 'Lesnaya', 'Mogilev Pos.'],
  nd: ['Hammarby', 'Skogstorp', 'Nyborg', 'Fredrikshald', 'Storvik', 'Lundby', 'Holmgård', 'Bjørnstad', 'Dybbøl', 'Idstedt', 'Kolding', 'Vestby', 'Åkerby', 'Torsvik', 'Lillehammer', 'Sundsvall Nord'],
  tr: ['Yeni Köy', 'Karagöz', 'Hisarlık', 'Kasaba', 'Çiftlik', 'Dere Köy', 'Taşköprü', 'Kızılağaç', 'Ak Dağ', 'Bayramlı', 'Plevne Köy', 'Karaağaç', 'Pazarcık', 'Eski Hisar', 'Kayalı', 'Çayırlı', 'Nezib', 'Konya Han', 'Başköy', 'Sarıkamış'],
  gr: ['Ágios Nikólaos', 'Kastrí', 'Melissa', 'Palaiókastro', 'Chaironeia', 'Missolonghi Nord', 'Navarino', 'Skála', 'Vrysi', 'Kalavryta', 'Pirgos', 'Ioánnina Alta'],
  ar: ['Tell el-Kebir', 'Beit Zeitun', 'Qasr el-Nur', 'Ain Salim', 'Dar el-Hamra', 'Kafr Yusuf', 'Wadi Halef', 'Bab el-Sultan', 'Hisn Rumi', 'Deir Mar Elias', 'Sidi Brahim', 'Oued Zenati', 'Bir Hakeim', 'Ain Taya', 'Taza', 'Mazagran', 'Isly', 'Mers el-Kebir', 'El Alamein', 'Tanta Vieja'],
  af: ['Kwandebele', 'Mbombela', 'Ndola', 'Ulundi', 'Isandlwana', 'Rorke\'s Drift', 'Bagamoyo', 'Kasama', 'Nkandla', 'Gingindlovu', 'Majuba', 'Colenso', 'Magersfontein', 'Omdurman Sur', 'Magdala', 'Adwa', 'Kumasi', 'Sokoto Viejo', 'Ibadan', 'Abeokuta', 'Boma', 'Kuruman'],
  in: ['Ramnagar', 'Sherpur', 'Devgarh', 'Kalyanpur', 'Mirganj', 'Harihar', 'Chillianwala', 'Sobraon', 'Aliwal', 'Plassey', 'Buxar', 'Panipat', 'Gujrat', 'Nurpur', 'Bhagwanpur', 'Khanpur', 'Jhansi Sur', 'Gwalior Pet', 'Wadgaon', 'Karnal', 'Ferozeshah', 'Kotli'],
  cn: ['Wei Cun', 'Chang Ping', 'Huashan Zhen', 'Tai Zhuang', 'Jiangnan Gang', 'Shan Wan', 'Lin Xian', 'Hua Cheng', 'Dongting', 'Baili Ao', 'Shuangqiao', 'Zhenhai', 'Liaoyang Cun', 'Pyongtaek', 'Phu Bang', 'Ban Sri', 'Kam Tin', 'Hanyang Pu', 'Yunnan Zhai', 'Nanjing Men', 'Tianjin Wei'],
  jp: ['Sekigahara', 'Fushimi', 'Ueno', 'Shiroyama', 'Takase', 'Hakodate Mura', 'Aizu Mura', 'Toba', 'Kawanakajima', 'Nagashino', 'Kumamoto Bashi', 'Hara', 'Edo-gawa', 'Shimonoseki Hama'],
  la: ['San Marcos', 'Santa Rosa', 'Villa Hermosa', 'Los Álamos', 'Puente Alto', 'Chacabuco', 'Maipú', 'Ayacucho', 'Carabobo', 'Boyacá', 'Pichincha', 'Cerro Corá', 'Tuyutí', 'Curupaytí', 'Caseros', 'Pavón', 'Rancagua', 'Junín', 'San Lorenzo', 'Monte Caseros'],
  oc: ['Waitara', 'Moa Creek', 'Kauri Flat', 'Rosewood', 'Green Hills', 'Eureka Stockade', 'Gate Pa', 'Rangiriri', 'Ohaeawai', 'Bay Point', 'Lake Vale', 'Mount Hope']
};
// lengua/región a partir de la posición de la provincia
function nameLang(lon, lat) {
  if (lon < -30) return lat > 24 && lon > -130 && lon < -50 ? 'us' : lat > 40 ? 'us' : 'la';
  if (lon > 112 && lat < -8) return 'oc'; if (lon > 128 && lat > 30 && lat < 46) return 'jp';
  if (lon > 60 && lon < 95 && lat < 36) return 'in'; if (lon >= 95 || (lon > 70 && lat >= 36)) return 'cn';
  if (lat < 14 && lon > -20 && lon < 52) return 'af'; if (lat < 29 && lon > -20 && lon < 45) return 'af';
  if (lat < 38 && lon > -12 && lon < 45) return 'ar';
  if (lon < -7.5 && lat > 36 && lat < 43) return 'pt'; if (lon < 4 && lat < 44.2 && lat > 35) return 'es';
  if (lon < 3 && lat > 44.2 && lat < 49 && lon > -5.5) return 'fr';
  if (lon < 2 && lat >= 49 && lon > -11) return 'en'; if (lon < -4 && lat > 50) return 'en';
  if (lat > 55 && lon < 32) return 'nd'; if (lon < 8 && lat >= 42 && lat < 51.5) return 'fr';
  if (lon >= 8 && lon < 24 && lat >= 46 && lat < 55) return 'de'; if (lon >= 6 && lon < 19 && lat < 46.5 && lat >= 36) return 'it';
  if (lon >= 19 && lon < 30 && lat < 42) return 'gr'; if (lon >= 26 && lon < 46 && lat < 42) return 'tr'; if (lon >= 19 && lon < 26 && lat >= 40 && lat < 46) return 'tr';
  if (lon >= 24 || lat >= 46) return 'sl'; return 'de';
}
const SITE_KINDS = {
  cruce: {n: 'cruce de caminos', ic: '🛤️', d: 'Pueblo en un cruce de caminos: todo el campo es transitable y se pelea por el casco urbano del centro.'},
  puente: {n: 'puente', ic: '🌉', d: 'Un río parte el campo y el pueblo guarda el único puente fijo: quien lo tenga manda el paso.'},
  altura: {n: 'altura', ic: '⛰️', d: 'Pueblo al pie de una loma dominante: la artillería de la altura ve y alcanza más lejos.'},
  bosque: {n: 'bosque', ic: '🌲', d: 'Pueblo encajado entre dos grandes bosques: buen terreno para emboscadas y para fijar al enemigo.'},
  amurallado: {n: 'villa amurallada', ic: '🧱', d: 'Pueblo rodeado de tapias y setos: gran cobertura para quien lo guarnezca.'},
  vado: {n: 'vado', ic: '〰️', d: 'Pueblo junto a un ancho vado con marismas en las orillas: cruzarlo es lento y peligroso.'}
};
const SITE_ORDER = ['cruce', 'puente', 'altura', 'bosque', 'amurallado', 'vado'];
const _townCache = {};
// los 3 pueblos de una provincia (siempre los mismos): nombre, tipo de escenario y tamaño
function provTowns(pid) {
  if (_townCache[pid]) return _townCache[pid];
  const pv = MAP.provs[pid], lang = nameLang(pv.lon, pv.lat), pool = TOWN_NAMES[lang], out = [], used = new Set();
  const h0 = Math.floor(hash2(pid, 3301, 17) * 1e6), k0 = Math.floor(hash2(pid, 3302, 19) * SITE_ORDER.length);
  for (let i = 0; i < 3; i++) {
    let ni = (h0 + i * 7 + Math.floor(hash2(pid, i, 3303) * pool.length)) % pool.length, g = 0; while (used.has(ni) && g++ < pool.length) ni = (ni + 1) % pool.length; used.add(ni);
    let kind = SITE_ORDER[(k0 + i * 2 + 1) % SITE_ORDER.length]; if (pv.biome === 7 && i === 0) kind = 'altura'; if (pv.biome === 3 && (kind === 'bosque' || kind === 'vado')) kind = 'cruce';
    out.push({i, name: pool[ni], kind, lang});
  }
  return (_townCache[pid] = out);
}
// pueblo donde se libra una batalla concreta (se fija al empezar y se guarda en la batalla)
function battleSite(b) {
  const T = provTowns(b.prov); if (b.site === undefined) b.site = Math.floor(hash2(b.id * 31 + 7, b.prov, 3310) * T.length) % T.length;
  return T[b.site];
}
const battleTitle = b => { const s = battleSite(b); return `${s.name} · ${provName(b.prov)}`; };
// el escenario propio del pueblo: moldea el terreno ya generado alrededor del pueblo central
function applySite(b, tf, H, bio) {
  const s = battleSite(b), W = BV_W, Hh = BV_H, cx = W / 2 + (H(900) - 0.5) * 180, cy = Hh / 2 + (H(901) - 0.5) * 140, defSide = b.att === 'A' ? 'B' : 'A', dd = defSide === 'A' ? -1 : 1;
  tf.site = s;
  // el casco urbano del centro es siempre el pueblo principal (con nombre propio); se retiran aldeas pegadas al centro
  tf.villages = tf.villages.filter(v => Math.hypot(v.x - cx, v.y - cy) > 190); tf.villages.forEach(v => { v.big = false; });
  const town = {id: 99, x: cx, y: cy, r: 52, n: 15, church: true, big: true, name: s.name, main: true}; tf.villages.unshift(town); tf.villages.forEach((v, i) => { v.id = i; }); tf.town = town;
  const clearAround = (arr, x, y, r) => arr.filter(e => Math.hypot(e.x - x, e.y - y) > r + (e.r || e.rx || 30) * 0.5);
  tf.lakes = clearAround(tf.lakes, cx, cy, 140); tf.cliffs = clearAround(tf.cliffs, cx, cy, 120); tf.marsh = clearAround(tf.marsh, cx, cy, 110); tf.forests = clearAround(tf.forests, cx, cy, 100);
  const k = s.kind;
  if (k === 'puente' || k === 'vado') {
    const rx = cx + (k === 'puente' ? 80 : 95) * (H(902) < 0.5 ? -1 : 1);
    tf.river = {x: rx, amp: k === 'puente' ? 22 : 34, ph: H(903) * 6.28, w: k === 'puente' ? 13 : 17, fords: []};
    if (k === 'puente') { tf.river.fords.push({y: clamp(cy + (H(904) - 0.5) * 30, 130, Hh - 130), w: 56, br: true, town: true}); if (H(905) < 0.6) tf.river.fords.push({y: cy < Hh / 2 ? Hh - 120 : 120, w: 70, br: false}); }
    else { tf.river.fords.push({y: clamp(cy, 150, Hh - 150), w: 130, br: false, town: true}); tf.marsh.push({x: rx - 70, y: cy - 150, rx: 62, ry: 34, rot: 0}, {x: rx + 70, y: cy + 150, rx: 62, ry: 34, rot: 0}); }
    tf.stream = null; tf.villages = tf.villages.filter(v => v === town || !(Math.abs(v.x - tacRiverX(tf, v.y)) < 50));
  } else if (k === 'altura') {
    tf.hills = tf.hills.filter(h => Math.hypot(h.x - cx, h.y - cy) > 160); const hx = clamp(cx + dd * 170, 160, W - 160), h0 = {x: hx, y: cy + (H(906) - 0.5) * 60, rx: 190, ry: 120, rot: (H(907) - 0.5) * 0.5, side: defSide};
    tf.hills.unshift(h0); tf.hill = h0; tf.hills.forEach((h, i) => { if (i) h.side = h.x > W / 2 ? 'B' : 'A'; }); tf.hill2 = tf.hills[1] || null;
  } else if (k === 'bosque') {
    tf.forests.push({x: cx - 20, y: cy - 175, r: 110}, {x: cx + 10, y: cy + 175, r: 110}, {x: cx + 190, y: cy - 90, r: 62}, {x: cx - 200, y: cy + 90, r: 62});
  } else if (k === 'amurallado') {
    const R = 74; tf.walls = tf.walls.filter(w => Math.hypot((w.x1 + w.x2) / 2 - cx, (w.y1 + w.y2) / 2 - cy) > 180);
    [[-R, -R, R, -R], [-R, R, R, R], [-R, -R, -R, -R * 0.25], [-R, R * 0.25, -R, R], [R, -R, R, -R * 0.25], [R, R * 0.25, R, R]].forEach(([a, c, d, e]) => tf.walls.push({x1: cx + a, y1: cy + c, x2: cx + d, y2: cy + e})); town.r = 60;
  } else if (k === 'cruce') {
    tf.roads.push({pts: [[-20, cy], [cx - 120, cy + 10], [cx, cy], [cx + 120, cy - 10], [W + 20, cy]]}, {pts: [[cx, -10], [cx + 8, cy - 150], [cx, cy], [cx - 6, cy + 150], [cx, Hh + 10]]});
  }
  tf.blocks = tf.lakes.concat(tf.cliffs); tf.pond = tf.lakes[0] || null; tf.farm = town; tf.siteKind = k;
  // los demás pueblos de la provincia que no son la sede se nombran como aldeas vecinas
  const used = new Set([s.name]), pool = TOWN_NAMES[s.lang], others = provTowns(b.prov).filter(t => t.i !== s.i).map(t => t.name); others.forEach(n => used.add(n)); let oi = 0, pi = Math.floor(hash2(b.prov, 7, 3320) * pool.length);
  tf.villages.forEach(v => { if (v === town) return; if (oi < others.length) { v.name = others[oi++]; return; } let g = 0; while (used.has(pool[pi % pool.length]) && g++ < pool.length) pi++; v.name = pool[pi % pool.length]; used.add(v.name); pi += 3; });
}
