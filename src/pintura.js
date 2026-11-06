/* ===== PINTURA: el campo de batalla dibujado como un mapa pintado (ver ESTUDIO_MAPA.md) ===== */
// paletas por bioma: base, claro, oscuro, alturas, alturas claras, bosque, bosque claro, agua, camino, aldea
/* Paletas del campo de batalla pintado (assets/paletas_biomas.json). */
const PAL = {"1":{"b":[108,140,42],"l":[142,170,60],"d":[78,104,32],"h":[124,100,44],"hl":[176,146,70],"f":[36,74,26],"fl":[70,112,42],"w":[104,176,208],"wf":[44,90,112],"r":[154,122,72],"v":[88,52,30],"v2":[122,74,44],"wall":[140,130,112],"tree":"redondo","rock":[140,130,112],"snow":null},"2":{"b":[84,120,60],"l":[108,148,80],"d":[58,90,40],"h":[104,92,48],"hl":[150,132,72],"f":[24,60,24],"fl":[46,94,38],"w":[96,170,200],"wf":[40,78,102],"r":[134,112,74],"v":[84,50,30],"v2":[116,70,42],"wall":[128,120,106],"tree":"redondo","rock":[128,120,106],"snow":null},"3":{"b":[208,178,112],"l":[230,202,138],"d":[180,148,88],"h":[170,124,70],"hl":[220,176,104],"f":[96,112,58],"fl":[130,142,74],"w":[76,188,188],"wf":[42,110,112],"r":[164,130,86],"v":[122,80,50],"v2":[160,112,80],"wall":[176,160,128],"tree":"palmera","rock":[176,160,128],"snow":null},"4":{"b":[150,160,70],"l":[180,184,94],"d":[120,128,52],"h":[150,122,62],"hl":[196,166,90],"f":[66,92,36],"fl":[100,124,52],"w":[104,174,204],"wf":[44,90,110],"r":[138,110,64],"v":[100,62,36],"v2":[134,88,58],"wall":[140,132,112],"tree":"arbusto","rock":[140,132,112],"snow":null},"5":{"b":[120,136,108],"l":[148,164,136],"d":[92,110,84],"h":[116,108,84],"hl":[162,154,122],"f":[46,80,54],"fl":[76,110,74],"w":[118,162,190],"wf":[56,78,96],"r":[124,108,78],"v":[86,60,40],"v2":[116,84,58],"wall":[136,132,120],"tree":"pino","rock":[136,132,120],"snow":null},"6":{"b":[46,110,44],"l":[70,138,56],"d":[30,82,30],"h":[78,100,50],"hl":[114,136,78],"f":[16,60,28],"fl":[36,92,40],"w":[84,156,156],"wf":[36,80,74],"r":[122,100,64],"v":[90,56,30],"v2":[128,96,58],"wall":[124,118,96],"tree":"redondo","rock":[124,118,96],"snow":null},"7":{"b":[108,120,62],"l":[140,150,90],"d":[80,90,46],"h":[118,102,84],"hl":[170,154,126],"f":[46,80,44],"fl":[74,108,58],"w":[108,172,208],"wf":[46,86,112],"r":[124,106,78],"v":[84,56,40],"v2":[116,80,58],"wall":[138,132,120],"tree":"pino","rock":[138,132,120],"snow":[238,242,246]},"8":{"b":[214,224,232],"l":[238,243,247],"d":[182,196,210],"h":[168,178,192],"hl":[236,241,246],"f":[58,90,74],"fl":[90,122,104],"w":[150,198,224],"wf":[90,124,148],"r":[160,148,136],"v":[100,70,58],"v2":[134,104,90],"wall":[138,148,160],"tree":"pino","rock":[138,148,160],"snow":[246,249,252]}};
const PAL_LAB = {"aldea": "#f4eedb", "aldeaHalo": "#16120a", "rio": "#e8f4fa", "rioHalo": "#101e2a"};
try { document.fonts.load('600 12px Lora'); document.fonts.load('italic 500 10px Lora'); } catch (e) { }
const _rgba = (c, a, m) => { m = m || 1; return `rgba(${Math.min(255, c[0] * m) | 0},${Math.min(255, c[1] * m) | 0},${Math.min(255, c[2] * m) | 0},${a})`; };
const _mix = (a, c, t) => [a[0] + (c[0] - a[0]) * t, a[1] + (c[1] - a[1]) * t, a[2] + (c[2] - a[2]) * t];
// nombres de aldeas y ríos según la región
const NAME_POOLS = {
  eu: [['Gros', 'Neu', 'Ober', 'Alt', 'Rosen', 'Wald', 'Sankt ', 'Klein ', 'Mont', 'Bel', 'Saint-', 'Villa', 'Nova ', 'Ras', 'Stam'], ['dorf', 'hofen', 'brunn', 'heim', 'stedt', 'ville', 'mont', 'burg', 'kirchen', 'au', 'ovo', 'ice', 'grad', 'ano', 'ello']],
  am: [['San ', 'Santa ', 'Nueva ', 'Fort ', 'Port ', 'Mount ', 'Río ', 'Villa ', 'Los ', 'Cedar ', 'Spring'], ['Marcos', 'Rosa', 'Creek', 'ville', 'ton', 'field', 'Bend', 'Cruz', 'Vista', 'Hollow', 'Grove', 'Ford']],
  as: [['Chang', 'Wei', 'Hua', 'Lin', 'Shan', 'Tai', 'Jiang', 'Kam', 'Phu', 'Bang', 'Sri', 'Ban'], ['zhuang', 'cun', 'ping', 'xian', 'gang', 'pur', 'abad', 'garh', 'nagar', 'wan', 'kot', 'dong']],
  in: [['Ram', 'Shah', 'Dev', 'Kal', 'Nur', 'Bhag', 'Sher', 'Mir', 'Hari', 'Khan'], ['pur', 'abad', 'garh', 'nagar', 'gaon', 'kot', 'ganj', 'wadi', 'pet', 'halli']],
  af: [['Kwa', 'Mbo', 'Ndu', 'Sidi ', 'Ain ', 'Bir ', 'Oued ', 'Dar ', 'Ba', 'Ka'], ['nga', 'mba', 'bou', 'el-Kebir', 'Ziane', 'toun', 'ru', 'ndi', 'ma', 'sa']],
  me: [['Tell ', 'Beit ', 'Dar ', 'Kafr ', 'Ain ', 'Qasr ', 'Bab ', 'Deir ', 'Wadi ', 'Hisar'], ['Hamid', 'Sultan', 'Yusuf', 'Zeitun', 'Rumi', 'Kebir', 'Salim', 'Halef', 'Nur', 'Dagh']],
  oc: [['Wai', 'Moa', 'Kau', 'Port ', 'Mount ', 'Lake ', 'Bay of ', 'Rosewood', 'Green'], ['rau', 'kiki', 'nui', 'hills', 'vale', 'Creek', 'Point', 'ford', 'Flat', 'Downs']]
};
function nameRegion(lon, lat) {
  if (lon < -30) return 'am'; if (lon > 110 && lat < -8) return 'oc'; if (lon > 60 && lon < 95 && lat < 35) return 'in'; if (lon > 60) return 'as';
  if (lat < 12) return 'af'; if (lat < 38 && lon > -10 && lon < 60) return lon < 35 && lat > 28 && lon > -10 ? 'af' : 'me'; return 'eu';
}
function pintName(pool, h1, h2) { const [a, b] = NAME_POOLS[pool], p = a[Math.floor(h1 * a.length)], s = b[Math.floor(h2 * b.length)]; return p.endsWith(' ') || p.endsWith('-') ? p + s.charAt(0).toUpperCase() + s.slice(1) : p + s; }
bvBuildBg = function (V, b) {
  const S = 2, cv = document.createElement('canvas'), cvB = document.createElement('canvas'); cv.width = cvB.width = BV_W * S; cv.height = cvB.height = BV_H * S; let g = cv.getContext('2d'); const gB = cvB.getContext('2d'); g.setTransform(S, 0, 0, S, 0, 0); gB.setTransform(S, 0, 0, S, 0, 0);
  const tf = battleTerrain(b), bio = tf.bio, P = PAL[bio] || PAL[1], wx = typeof battleWeather === 'function' ? battleWeather(b) : {}, W = BV_W, Hh = BV_H;
  let seed = (b.prov * 7919 + 12345 + battleSite(b).i * 104729) >>> 0; const rn = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const H = (i, k) => hash2(i, 5011, b.prov * 13 + k + battleSite(b).i * 311), pv = MAP.provs[b.prov], pool = nameRegion(pv.lon, pv.lat), EL = tf.elev || {cls: 'ondulado', h: 300};
  // 1) base, manchas suaves y mosaico de parcelas
  g.fillStyle = _rgba(P.b, 1); g.fillRect(0, 0, W, Hh);
  for (let i = 0; i < 420; i++) { const x = rn() * W, y = rn() * Hh, r = 36 + rn() * 150, c = rn() < 0.5 ? P.l : P.d, rg = g.createRadialGradient(x, y, 0, x, y, r); rg.addColorStop(0, _rgba(c, 0.30)); rg.addColorStop(1, _rgba(c, 0)); g.fillStyle = rg; g.fillRect(x - r, y - r, r * 2, r * 2); }
  const mosaic = bio === 3 ? 50 : bio === 8 ? 60 : bio === 6 ? 90 : 280, th = -0.55 + rn() * 0.5;
  for (let i = 0; i < mosaic; i++) { const x = rn() * W, y = rn() * Hh, w = 36 + rn() * 70, h = 20 + rn() * 44, c = rn() < 0.5 ? P.l : P.d; g.save(); g.translate(x, y); g.rotate(th + (rn() - 0.5) * 0.35); g.transform(1, 0, 0.55, 1, 0, 0); g.fillStyle = _rgba(c, 0.11 + rn() * 0.12); g.fillRect(-w / 2, -h / 2, w, h); g.strokeStyle = _rgba(P.d, 0.06); g.lineWidth = 0.7; g.strokeRect(-w / 2, -h / 2, w, h); g.restore(); }
  tf.fields.forEach(f => { g.save(); g.translate(f.x, f.y); g.rotate(f.rot); g.fillStyle = _rgba(f.tone > 0.5 ? P.l : P.d, 0.22); g.fillRect(-f.w / 2, -f.h / 2, f.w, f.h); g.strokeStyle = _rgba(P.d, 0.18); g.lineWidth = 0.6; for (let q = -f.w / 2; q < f.w / 2; q += 6) { g.beginPath(); g.moveTo(q, -f.h / 2); g.lineTo(q, f.h / 2); g.stroke(); } g.restore(); });
  // 2) pantanos, dunas y nieve
  tf.marsh.forEach(m => { const rg = g.createRadialGradient(m.x, m.y, 4, m.x, m.y, m.rx); rg.addColorStop(0, 'rgba(58,92,84,.75)'); rg.addColorStop(0.7, 'rgba(84,116,92,.5)'); rg.addColorStop(1, 'rgba(84,116,92,0)'); g.fillStyle = rg; g.beginPath(); g.ellipse(m.x, m.y, m.rx, m.ry, 0, 0, 6.3); g.fill(); g.strokeStyle = 'rgba(40,70,40,.6)'; g.lineWidth = 0.8; for (let i = 0; i < 30; i++) { const a = rn() * 6.28, d = Math.sqrt(rn()), x = m.x + Math.cos(a) * d * m.rx * 0.9, y = m.y + Math.sin(a) * d * m.ry * 0.9; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 1, y - 4); g.stroke(); } });
  tf.dunes.forEach(d => { g.save(); g.translate(d.x, d.y); g.rotate(d.rot); const rg = g.createRadialGradient(0, 0, 4, 0, 0, d.rx); rg.addColorStop(0, 'rgba(236,208,140,.8)'); rg.addColorStop(1, 'rgba(236,208,140,0)'); g.fillStyle = rg; g.beginPath(); g.ellipse(0, 0, d.rx, d.ry, 0, 0, 6.3); g.fill(); g.strokeStyle = 'rgba(150,110,60,.4)'; g.lineWidth = 1; for (let i = -3; i <= 3; i++) { g.beginPath(); g.ellipse(0, i * d.ry * 0.28, d.rx * 0.82, d.ry * 0.16, 0, 0.1, 3.0); g.stroke(); } g.restore(); });
  // 3) alturas pintadas: relleno de color, pinceladas y sombra
  const rock = [128, 122, 110];
  tf.hills.forEach((h, hi) => {
    const mnt = EL.cls === 'montaña', hc = mnt ? _mix(P.h, rock, 0.45) : P.h, hl = mnt ? _mix(P.hl, rock, 0.35) : P.hl, R = Math.max(h.rx, h.ry);
    g.save(); g.translate(h.x, h.y); g.rotate(h.rot || 0);
    let rg = g.createRadialGradient(-h.rx * 0.2, -h.ry * 0.25, 0, 0, 0, R); rg.addColorStop(0, _rgba(hl, 0.92)); rg.addColorStop(0.5, _rgba(hc, 0.86)); rg.addColorStop(0.85, _rgba(hc, 0.4)); rg.addColorStop(1, _rgba(hc, 0));
    g.save(); g.scale(1, h.ry / h.rx); g.fillStyle = rg; g.beginPath(); g.arc(0, 0, h.rx, 0, 6.3); g.fill(); g.restore();
    for (let i = 0; i < 150; i++) { const a = rn() * 6.28, d = Math.sqrt(rn()) * 0.9, x = Math.cos(a) * d * h.rx, y = Math.sin(a) * d * h.ry, l = 5 + rn() * 11, an = -0.5 + rn() * 0.9; g.strokeStyle = rn() < 0.55 ? _rgba(hc, 0.3, 0.72) : _rgba(hl, 0.26); g.lineWidth = 1.2 + rn() * 1.6; g.lineCap = 'round'; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(an) * l, y + Math.sin(an) * l); g.stroke(); }
    rg = g.createRadialGradient(h.rx * 0.38, h.ry * 0.42, 2, h.rx * 0.3, h.ry * 0.3, R * 0.75); rg.addColorStop(0, 'rgba(36,24,10,.34)'); rg.addColorStop(1, 'rgba(36,24,10,0)'); g.save(); g.scale(1, h.ry / h.rx); g.fillStyle = rg; g.beginPath(); g.arc(0, 0, h.rx, 0, 6.3); g.fill(); g.restore();
    rg = g.createRadialGradient(-h.rx * 0.4, -h.ry * 0.4, 2, -h.rx * 0.3, -h.ry * 0.3, R * 0.6); rg.addColorStop(0, 'rgba(255,240,190,.3)'); rg.addColorStop(1, 'rgba(255,240,190,0)'); g.save(); g.scale(1, h.ry / h.rx); g.fillStyle = rg; g.beginPath(); g.arc(0, 0, h.rx, 0, 6.3); g.fill(); g.restore();
    g.restore();
  });
  tf.snow.forEach(d => { const k = bio === 8 ? 1 : 0.5, rg = g.createRadialGradient(d.x, d.y, 2, d.x, d.y, d.rx * k); rg.addColorStop(0, _rgba(P.snow || [250, 252, 255], 0.85)); rg.addColorStop(1, _rgba(P.snow || [250, 252, 255], 0)); g.fillStyle = rg; g.beginPath(); g.ellipse(d.x, d.y, d.rx * k, d.ry * k, 0, 0, 6.3); g.fill(); });
  tf.cliffs.forEach(c => { g.save(); g.translate(c.x, c.y); g.rotate(c.rot); g.scale(0.72, 0.72); g.fillStyle = 'rgba(30,26,22,.5)'; g.beginPath(); g.ellipse(2, 3, c.rx + 4, c.ry + 4, 0, 0, 6.3); g.fill(); g.fillStyle = '#6e675c'; g.beginPath(); for (let k = 0; k <= 14; k++) { const a = k / 14 * 6.283, r = 1 + (k % 2 ? 0.22 : -0.1); g.lineTo(Math.cos(a) * (c.rx + 2) * r, Math.sin(a) * (c.ry + 2) * r); } g.closePath(); g.fill(); g.fillStyle = 'rgba(210,200,180,.4)'; g.beginPath(); g.ellipse(-c.rx * 0.2, -c.ry * 0.3, c.rx * 0.55, c.ry * 0.4, 0, 0, 6.3); g.fill(); g.restore(); });
  tf.rocks.forEach(r => { for (let k = 0; k < 8; k++) { const x = r.x + (rn() - 0.5) * r.r * 1.6, y = r.y + (rn() - 0.5) * r.r * 1.2, w = 3 + rn() * 6; g.fillStyle = 'rgba(30,26,22,.3)'; g.beginPath(); g.ellipse(x + 1.5, y + 2, w, w * 0.5, 0, 0, 6.3); g.fill(); g.fillStyle = _rgba(P.rock, 1); g.beginPath(); g.ellipse(x, y, w, w * 0.62, 0, 0, 6.3); g.fill(); g.fillStyle = 'rgba(255,255,255,.22)'; g.beginPath(); g.ellipse(x - w * 0.25, y - w * 0.2, w * 0.45, w * 0.25, 0, 0, 6.3); g.fill(); } });
  // 4) agua: lagos, ríos finos, arroyos y barranco
  tf.lakes.forEach(l => { g.save(); g.translate(l.x, l.y); g.rotate(l.rot || 0); g.fillStyle = _rgba(P.w, 0.35); g.beginPath(); g.ellipse(0, 0, l.rx + 6, l.ry + 6, 0, 0, 6.3); g.fill(); const rg = g.createRadialGradient(-l.rx * 0.2, -l.ry * 0.2, 2, 0, 0, l.rx); rg.addColorStop(0, _rgba(P.w, 1, 1.12)); rg.addColorStop(1, _rgba(P.w, 1, 0.78)); g.fillStyle = rg; g.beginPath(); g.ellipse(0, 0, l.rx, l.ry, 0, 0, 6.3); g.fill(); g.strokeStyle = _rgba(P.w, 0.9, 0.45); g.lineWidth = 1.2; g.stroke(); g.restore(); });
  g.lineCap = 'round'; g.lineJoin = 'round';
  const line = (xf, w, col) => { g.strokeStyle = col; g.lineWidth = w; g.beginPath(); for (let y = -12; y <= Hh + 12; y += 5) { const x = xf(y); y === -12 ? g.moveTo(x, y) : g.lineTo(x, y); } g.stroke(); };
  if (tf.stream) { const s = tf.stream, xf = y => s.x + Math.sin(y / 70 + s.ph) * s.amp; line(xf, s.w + 3, _rgba(P.wf, 0.8)); line(xf, s.w - 1.2, _rgba(P.w, 1, 1.05)); }
  if (tf.river) {
    const r = tf.river, xf = y => tacRiverX(tf, y); line(xf, r.w + 8, 'rgba(40,52,30,.14)'); line(xf, r.w + 2.6, _rgba(P.wf, 0.95)); line(xf, r.w - 1, _rgba(P.w, 1, 1)); line(xf, (r.w - 1) * 0.4, _rgba(P.w, 0.7, 1.35));
    r.fords.forEach(f => { const x = xf(f.y); if (f.br && !f.pont) { g.fillStyle = 'rgba(0,0,0,.28)'; g.fillRect(x - r.w / 2 - 8 + 2, f.y - 5 + 2, r.w + 16, 10); g.fillStyle = '#8a6a3c'; g.fillRect(x - r.w / 2 - 8, f.y - 5, r.w + 16, 10); g.strokeStyle = '#5a4020'; g.lineWidth = 0.8; for (let q = -r.w / 2 - 6; q < r.w / 2 + 6; q += 4) { g.beginPath(); g.moveTo(x + q, f.y - 5); g.lineTo(x + q, f.y + 5); g.stroke(); } g.strokeStyle = '#4a3418'; g.beginPath(); g.moveTo(x - r.w / 2 - 8, f.y - 5); g.lineTo(x + r.w / 2 + 8, f.y - 5); g.moveTo(x - r.w / 2 - 8, f.y + 5); g.lineTo(x + r.w / 2 + 8, f.y + 5); g.stroke(); } else if (!f.pont) { g.fillStyle = _rgba(P.w, 0.5, 1.5); g.beginPath(); g.ellipse(x, f.y, r.w / 2 + 4, f.w / 2, 0, 0, 6.3); g.fill(); g.fillStyle = 'rgba(230,236,240,.7)'; for (let q = 0; q < 9; q++) { g.beginPath(); g.arc(x + (rn() - 0.5) * r.w, f.y + (rn() - 0.5) * f.w, 1.1, 0, 6.3); g.fill(); } } });
  }
  if (tf.ravine) {
    const r = tf.ravine, xf = y => tacRavX(tf, y); line(xf, r.w + 16, 'rgba(30,24,16,.2)'); line(xf, r.w + 8, '#8a7c64'); line(xf, r.w + 3, '#5a4a36'); line(xf, r.w - 2, '#1a130c'); line(xf, (r.w - 2) * 0.45, '#050403');
    for (let y = 0; y < Hh; y += 7) { const x = xf(y), h = rn(); [-1, 1].forEach(s => { g.fillStyle = h < 0.5 ? 'rgba(176,160,130,.6)' : 'rgba(54,42,30,.6)'; g.beginPath(); g.ellipse(x + s * (r.w / 2 + 3 + h * 4), y, 2.4 + h * 2.4, 1.6 + h * 1.6, h * 3, 0, 6.3); g.fill(); }); }
    r.fords.forEach(f => { const x = xf(f.y); g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(x - r.w / 2 - 9 + 2, f.y - f.w / 2 + 2, r.w + 18, f.w); g.fillStyle = '#8a8070'; g.fillRect(x - r.w / 2 - 9, f.y - f.w / 2, r.w + 18, f.w); g.strokeStyle = '#5a5248'; g.lineWidth = 0.8; for (let q = -r.w / 2 - 6; q < r.w / 2 + 6; q += 5) { g.beginPath(); g.moveTo(x + q, f.y - f.w / 2); g.lineTo(x + q, f.y + f.w / 2); g.stroke(); } });
  }
  // 5) caminos y muros
  tf.roads.forEach(r => { [['rgba(70,52,28,.22)', 3.4], [_rgba(P.r, 0.55), 1.7]].forEach(([c, w]) => { g.strokeStyle = c; g.lineWidth = w; g.beginPath(); r.pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.stroke(); }); });
  tf.walls.forEach(w => { g.strokeStyle = 'rgba(40,34,26,.35)'; g.lineWidth = 2.6; g.beginPath(); g.moveTo(w.x1 + 1, w.y1 + 1.5); g.lineTo(w.x2 + 1, w.y2 + 1.5); g.stroke(); g.strokeStyle = _rgba(P.wall, 0.95); g.lineWidth = 1.3; g.beginPath(); g.moveTo(w.x1, w.y1); g.lineTo(w.x2, w.y2); g.stroke(); });
  // 6) bosques y aldeas: capa de objetos (menos desenfocada)
  g = gB; g.lineCap = 'round'; g.lineJoin = 'round';
  const tree = (x, y, r, dk) => {
    g.fillStyle = 'rgba(0,0,0,.22)'; g.beginPath(); g.arc(x + 1.4, y + 1.6, r, 0, 6.3); g.fill();
    if (P.tree === 'pino') { g.fillStyle = _rgba(P.f, 1, dk); g.beginPath(); g.moveTo(x, y - r * 1.6); g.lineTo(x - r * 0.95, y + r * 0.9); g.lineTo(x + r * 0.95, y + r * 0.9); g.closePath(); g.fill(); g.fillStyle = _rgba(P.fl, 0.8, dk); g.beginPath(); g.moveTo(x - r * 0.1, y - r * 1.35); g.lineTo(x - r * 0.75, y + r * 0.55); g.lineTo(x - r * 0.1, y + r * 0.55); g.closePath(); g.fill(); }
    else if (P.tree === 'palmera') { g.strokeStyle = _rgba(P.fl, 1, dk); g.lineWidth = 1.1; for (let a = 0; a < 6; a++) { const an = a * 1.047 + x; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(an) * r * 1.5, y + Math.sin(an) * r * 1.5); g.stroke(); } g.fillStyle = _rgba(P.f, 1, dk); g.beginPath(); g.arc(x, y, r * 0.35, 0, 6.3); g.fill(); }
    else if (P.tree === 'arbusto') { g.fillStyle = _rgba(P.f, 1, dk); g.beginPath(); g.ellipse(x, y, r * 1.1, r * 0.75, 0, 0, 6.3); g.fill(); g.fillStyle = _rgba(P.fl, 0.85, dk); g.beginPath(); g.ellipse(x - r * 0.25, y - r * 0.2, r * 0.6, r * 0.35, 0, 0, 6.3); g.fill(); }
    else { g.fillStyle = _rgba(P.f, 1, dk); g.beginPath(); g.arc(x, y, r, 0, 6.3); g.fill(); g.fillStyle = _rgba(P.fl, 0.85, dk); g.beginPath(); g.arc(x - r * 0.3, y - r * 0.35, r * 0.55, 0, 6.3); g.fill(); }
  };
  const sparse = bio === 3 ? 0.18 : 1;
  tf.forests.forEach((f, fi) => {
    const rg = g.createRadialGradient(f.x, f.y, f.r * 0.15, f.x, f.y, f.r * 1.05); rg.addColorStop(0, _rgba(P.f, 0.7, 0.8)); rg.addColorStop(0.8, _rgba(P.f, 0.4, 0.8)); rg.addColorStop(1, _rgba(P.f, 0)); g.fillStyle = rg; g.beginPath(); g.arc(f.x, f.y, f.r * 1.05, 0, 6.3); g.fill();
    const n = Math.round(f.r * f.r / 17 * sparse); for (let i = 0; i < n; i++) { const a = rn() * 6.28, d = Math.sqrt(rn()) * f.r * 0.94; tree(f.x + Math.cos(a) * d, f.y + Math.sin(a) * d * 0.9, 2.4 + rn() * 2.2, 0.85 + rn() * 0.35); }
    if (wx.autumn) for (let i = 0; i < f.r * 0.8; i++) { const a = rn() * 6.28, d = Math.sqrt(rn()) * f.r * 0.9; g.fillStyle = rn() < 0.5 ? 'rgba(206,132,40,.55)' : rn() < 0.5 ? 'rgba(170,70,30,.5)' : 'rgba(220,180,60,.5)'; g.beginPath(); g.arc(f.x + Math.cos(a) * d, f.y + Math.sin(a) * d, 1.6 + rn() * 2, 0, 6.3); g.fill(); }
    if (wx.frost) for (let i = 0; i < f.r * 0.5; i++) { const a = rn() * 6.28, d = Math.sqrt(rn()) * f.r * 0.9; g.fillStyle = 'rgba(245,250,255,.5)'; g.beginPath(); g.arc(f.x + Math.cos(a) * d, f.y + Math.sin(a) * d - 1, 1.6, 0, 6.3); g.fill(); }
  });
  tf.orchards.forEach(f => { for (let i = 0; i < 14; i++) { const a = rn() * 6.28, d = Math.sqrt(rn()) * f.r; tree(f.x + Math.cos(a) * d, f.y + Math.sin(a) * d, 2.2 + rn() * 1.2, 1.15); } });
  // 7) aldeas: casitas oscuras y rótulo con el nombre
  const labels = [];
  tf.villages.forEach((v, vi) => {
    g.fillStyle = 'rgba(60,44,24,.18)'; g.beginPath(); g.ellipse(v.x, v.y + 3, v.r * 0.95, v.r * 0.7, 0, 0, 6.3); g.fill();
    for (let i = 0; i < v.n; i++) { const a = rn() * 6.283, d = Math.sqrt(rn()) * v.r * 0.8, x = v.x + Math.cos(a) * d, y = v.y + Math.sin(a) * d * 0.7, w = 4.5 + rn() * 4, h = 3.6 + rn() * 3, c = _mix(P.v, P.v2, rn() * 0.9); g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(x - w / 2 + 1.2, y - h / 2 + 1.4, w, h); g.fillStyle = _rgba(c, 1); g.fillRect(x - w / 2, y - h / 2, w, h); g.fillStyle = _rgba(c, 1, 1.45); g.fillRect(x - w / 2, y - h / 2, w, h * 0.42); g.strokeStyle = 'rgba(20,10,4,.7)'; g.lineWidth = 0.5; g.strokeRect(x - w / 2, y - h / 2, w, h); }
    if (v.church) { g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(v.x - 1, v.y - 1, 9, 6); g.fillStyle = '#d6c8a2'; g.fillRect(v.x - 2.5, v.y - 3.5, 5, 7.5); g.fillStyle = '#6e2a20'; g.beginPath(); g.moveTo(v.x - 3.4, v.y - 3.5); g.lineTo(v.x, v.y - 10); g.lineTo(v.x + 3.4, v.y - 3.5); g.closePath(); g.fill(); }
    g.strokeStyle = 'rgba(255,240,180,.16)'; g.setLineDash([3, 4]); g.lineWidth = 0.9; g.beginPath(); g.ellipse(v.x, v.y, v.r, v.r * 0.82, 0, 0, 6.3); g.stroke(); g.setLineDash([]);
    v.name = v.name || pintName(pool, H(vi, 1), H(vi, 2)); labels.push([v.name, v.x, v.y + v.r * 0.78 + 9, v.big ? 14 : 11.5]);
  });
  // 8) viñeta, desenfoque pictórico y rótulos nítidos
  const out = document.createElement('canvas'); out.width = cv.width; out.height = cv.height; const o = out.getContext('2d');
  o.filter = 'blur(1.6px)'; o.drawImage(cv, 0, 0); o.filter = 'blur(0.45px)'; o.drawImage(cvB, 0, 0); o.filter = 'none';
  o.setTransform(S, 0, 0, S, 0, 0);
  const vg = o.createRadialGradient(W / 2, Hh / 2, Hh * 0.55, W / 2, Hh / 2, W * 0.62); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.22)'); o.fillStyle = vg; o.fillRect(0, 0, W, Hh);
  if (wx.frost) { o.fillStyle = 'rgba(235,242,250,.12)'; o.fillRect(0, 0, W, Hh); } o.textAlign = 'center'; o.lineJoin = 'round';
  labels.forEach(([t, x, y, fs]) => { o.font = `600 ${fs}px Lora, Georgia, "Times New Roman", serif`; o.strokeStyle = PAL_LAB.aldeaHalo; o.globalAlpha = 0.85; o.lineWidth = 3; o.strokeText(t, x, y); o.globalAlpha = 1; o.fillStyle = PAL_LAB.aldea; o.fillText(t, x, y); });
  const rl = (xf, name, y0, it) => { const x = xf(y0), x2 = xf(y0 + 12), an = Math.atan2(12, x2 - x) - Math.PI / 2; o.save(); o.translate(x + 7, y0); o.rotate(an > Math.PI / 2 || an < -Math.PI / 2 ? an + Math.PI : an); o.font = `italic 500 ${it}px Lora, Georgia, serif`; o.strokeStyle = PAL_LAB.rioHalo; o.globalAlpha = 0.8; o.lineWidth = 2.6; o.strokeText(name, 0, 0); o.globalAlpha = 1; o.fillStyle = PAL_LAB.rio; o.fillText(name, 0, 0); o.restore(); };
  if (tf.river) { tf.river.name = tf.river.name || (pool === 'eu' ? 'Bach ' : pool === 'am' ? 'Río ' : pool === 'as' || pool === 'in' ? 'R. ' : 'Wadi ') + pintName(pool, H(91, 1), H(91, 2)).split(/[ -]/).pop(); rl(y => tacRiverX(tf, y), tf.river.name, 150 + H(92, 1) * 480, 10); }
  o.setTransform(1, 0, 0, 1, 0, 0); return out;
};
