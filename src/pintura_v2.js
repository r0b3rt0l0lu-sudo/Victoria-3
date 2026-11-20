/* ===== PINTURA DEL MAPA v2: teselas vectoriales + rásteres suaves, estilos «actual» y «atlas del siglo XIX» =====
   pv2Init({relieve, relieveAlto, batimetria}) → Promise: prepara campos de color (verano/invierno), caminos vectoriales y rásteres.
   pv2PaintTile(ctx, x0, y0, s, w, h, opt): pinta la región del mapa lógico que empieza en (x0, y0) (píxeles de MAP_W×MAP_H) a s píxeles de
     pantalla por píxel lógico en un lienzo de w×h. opt = {style: 'actual'|'atlas', season: 'verano'|'invierno', layers: {...}, owner: estado→tag,
     colors: tag→'#rrggbb', year}. Todo lo nítido (costas, lagos, ríos, fronteras, rutas) es vectorial: no hay píxeles gruesos a ningún zoom.
   pv2Labels(ctx, view, opt): rótulos curvados, ciudades, capitales, puertos, rosa de los vientos y marco (capa por encima de las teselas). */
const PV2 = {ready: false};
const PV2_BIO = {   // colores por bioma [verano, invierno] (estilo actual) y tinta del atlas
  1: [[132, 152, 88], [150, 146, 112]], 2: [[78, 112, 66], [74, 96, 70]], 3: [[214, 188, 132], [204, 180, 132]], 4: [[176, 168, 106], [170, 160, 118]],
  5: [[150, 156, 134], [226, 230, 234]], 6: [[54, 106, 62], [54, 106, 62]], 7: [[138, 126, 104], [170, 168, 166]], 8: [[236, 240, 244], [244, 246, 250]]
};
const PV2_ATLAS = {papel: [236, 223, 192], mar: [196, 214, 210], marHondo: [172, 196, 196], tinta: '#3b2a1a', tinta2: 'rgba(59,42,26,0.55)', rio: '#4f7790',
  bio: {1: [226, 218, 176], 2: [196, 206, 160], 3: [238, 220, 170], 4: [230, 214, 164], 5: [220, 218, 206], 6: [184, 202, 150], 7: [214, 196, 160], 8: [246, 246, 244]}};

function pv2LoadImg(src) { return new Promise((ok, no) => { if (!src) return ok(null); const im = new Image(); im.onload = () => ok(im); im.onerror = () => ok(null); im.src = src; }); }
function _cv(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function _blur3(a, W, H, ch, r, passes) {   // desenfoque de caja separable sobre un Float32Array intercalado (ch canales)
  const tmp = new Float32Array(a.length);
  for (let p = 0; p < passes; p++) {
    for (let y = 0; y < H; y++) for (let c = 0; c < ch; c++) { let acc = 0; const row = y * W;
      for (let x = -r; x <= r; x++) acc += a[(row + Math.max(0, Math.min(W - 1, x))) * ch + c];
      for (let x = 0; x < W; x++) { tmp[(row + x) * ch + c] = acc / (2 * r + 1); acc += a[(row + Math.min(W - 1, x + r + 1)) * ch + c] - a[(row + Math.max(0, x - r)) * ch + c]; } }
    for (let x = 0; x < W; x++) for (let c = 0; c < ch; c++) { let acc = 0;
      for (let y = -r; y <= r; y++) acc += tmp[(Math.max(0, Math.min(H - 1, y)) * W + x) * ch + c];
      for (let y = 0; y < H; y++) { a[(y * W + x) * ch + c] = acc / (2 * r + 1); acc += tmp[(Math.min(H - 1, y + r + 1) * W + x) * ch + c] - tmp[(Math.max(0, y - r) * W + x) * ch + c]; } }
  }
}
// campo de color del terreno (2048×820) por estación y estilo: biomas mezclados sin cortes, tinte por altitud, nieve por estación
function pv2Field(season, style) {
  const W = MAP_W, H = MAP_H, N = W * H, land = MAP.land, bio = MAP.biome, em = MAP.elevM, f = new Float32Array(N * 3), win = season === 'invierno', atlas = style === 'atlas';
  for (let y = 0; y < H; y++) {
    const lat = yToLat(y), alat = Math.abs(lat), north = lat > 0;
    for (let x = 0; x < W; x++) {
      const i = y * W + x; if (!land[i]) continue;
      let b = bio[i]; const m = em[i], nz = fbm(x / 7, y / 7, 151, 3) - 0.5, nz2 = fbm(x / 31, y / 31, 153, 3) - 0.5;
      // invierno del hemisferio norte (enero): nieve en latitudes altas y en altura; en el sur es verano
      const wn = win && north, snowLat = 47 + nz2 * 10, snowAlt = Math.max(600, 3000 - (alat - 25) * 60);
      let c = atlas ? PV2_ATLAS.bio[b] : PV2_BIO[b][wn ? 1 : 0];
      let r = c[0], g = c[1], bl = c[2];
      if (!atlas) {
        // altitud: tierras bajas más verdes, mesetas pardas, alta montaña roca
        const k = Math.min(1, m / 2600), kr = Math.min(1, Math.max(0, (m - 1800) / 1800));
        r += (150 - r) * k * 0.35 + (128 - r) * kr * 0.5; g += (136 - g) * k * 0.35 + (124 - g) * kr * 0.5; bl += (104 - bl) * k * 0.35 + (120 - bl) * kr * 0.5;
        r += nz * 22; g += nz * 20; bl += nz * 14;
      } else { r += nz * 10; g += nz * 9; bl += nz * 7; }
      let snow = 0;
      if (b === BIOME.SNOW) snow = 1;
      else if (wn && (lat > snowLat || m > snowAlt)) snow = Math.min(1, Math.max((lat - snowLat) / 6, (m - snowAlt) / 500));
      else if (!win && m > 4200 - Math.max(0, alat - 30) * 70) snow = Math.min(1, (m - (4200 - Math.max(0, alat - 30) * 70)) / 600);
      if (win && !north && lat < -50) snow = Math.max(snow, 0.3);
      const sc = atlas ? [250, 248, 244] : [238, 242, 246];
      r += (sc[0] - r) * snow; g += (sc[1] - g) * snow; bl += (sc[2] - bl) * snow;
      f[i * 3] = r; f[i * 3 + 1] = g; f[i * 3 + 2] = bl;
    }
  }
  // extender el color de tierra hacia el mar (la costa la recorta el vector) y suavizar: biomas sin cortes
  const dl = MAP.dSea; for (let pass = 0; pass < 4; pass++) for (let i = W; i < N - W; i++) { if (land[i] || dl[i] > pass + 1.5 || f[i * 3] > 0) continue;
    let r = 0, g = 0, b = 0, n = 0; for (const j of [i - 1, i + 1, i - W, i + W]) if (f[j * 3] > 0) { r += f[j * 3]; g += f[j * 3 + 1]; b += f[j * 3 + 2]; n++; }
    if (n) { f[i * 3] = r / n; f[i * 3 + 1] = g / n; f[i * 3 + 2] = b / n; } }
  _blur3(f, W, H, 3, 1, 2);
  const cv = _cv(W, H), g = cv.getContext('2d'), im = g.createImageData(W, H);
  for (let i = 0; i < N; i++) { const o = i * 4; im.data[o] = f[i * 3]; im.data[o + 1] = f[i * 3 + 1]; im.data[o + 2] = f[i * 3 + 2]; im.data[o + 3] = f[i * 3] > 0 ? 255 : 0; }
  g.putImageData(im, 0, 0); return cv;
}
// mar: batimetría de Natural Earth (OB_LR) → plataforma clara, aguas profundas oscuras
function pv2SeaField(style, bat) {
  const W = MAP_W, H = MAP_H, N = W * H, cv = _cv(W, H), g = cv.getContext('2d'), im = g.createImageData(W, H), land = MAP.land, dS = MAP.dSea;
  let bd = null; if (bat) { const c = _cv(W, H), cg = c.getContext('2d'); cg.drawImage(bat, 0, 0, W, H); bd = cg.getImageData(0, 0, W, H).data; }
  const atlas = style === 'atlas';
  for (let i = 0; i < N; i++) {
    const x = i % W, y = (i / W) | 0, ds = dS[i];
    const bv = bd ? 165 + (bd[i * 4] - 128) / 2.5 : 0;   // batimetría normalizada (tools/raster_build.py) → valor original de OB_LR
    let depth = bd ? Math.max(0, Math.min(1, (171 - bv) / 18)) : Math.min(1, ds / 40);   // 0 plataforma … 1 abisal
    depth = Math.max(depth, Math.min(1, ds / 120)) * 0.85 + Math.min(1, ds / 40) * 0.15;
    const relief = 0, nz = (fbm(x / 18, y / 18, 161, 3) - 0.5) * 8;
    let r, gg, b;
    if (atlas) { const a = PV2_ATLAS.mar, d = PV2_ATLAS.marHondo; r = a[0] + (d[0] - a[0]) * depth; gg = a[1] + (d[1] - a[1]) * depth; b = a[2] + (d[2] - a[2]) * depth; }
    else { r = 64 + (20 - 64) * depth; gg = 128 + (50 - 128) * depth; b = 148 + (88 - 148) * depth; }
    r += relief + nz; gg += relief + nz; b += relief + nz * 0.8;
    if (land[i]) { r = 60; gg = 120; b = 140; }
    const o = i * 4; im.data[o] = r; im.data[o + 1] = gg; im.data[o + 2] = b; im.data[o + 3] = 255;
  }
  g.putImageData(im, 0, 0); return cv;
}
// textura de grano (pincelada) para el detalle a zoom cercano
function pv2Grain() {
  const S = 256, cv = _cv(S, S), g = cv.getContext('2d'), im = g.createImageData(S, S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const v = 128 + (fbm(x / 6, y / 6, 171, 3) - 0.5) * 70 + (hash2(x, y, 173) - 0.5) * 18, o = (y * S + x) * 4; im.data[o] = im.data[o + 1] = im.data[o + 2] = v; im.data[o + 3] = 255; }
  g.putImageData(im, 0, 0); return cv;
}
// tramas: dunas (arcos ondulados) y humedal (rayitas horizontales con matas)
function pv2PatternDunes() { const S = 128, c = _cv(S, S), g = c.getContext('2d'); g.strokeStyle = 'rgba(120,80,30,0.55)'; g.lineWidth = 1.1;
  for (let k = 0; k < 9; k++) { const y0 = k * 15 + 4; g.beginPath(); for (let x = 0; x <= S; x += 4) { const y = y0 + Math.sin(x / S * Math.PI * 4 + k) * 3.2; x ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke(); } return c; }
function pv2PatternMarsh() { const S = 64, c = _cv(S, S), g = c.getContext('2d'); g.strokeStyle = 'rgba(30,70,80,0.6)'; g.lineWidth = 1;
  for (let k = 0; k < 12; k++) { const x = (k * 37) % S, y = (k * 23) % S; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 9, y); g.moveTo(x + 2, y - 3); g.lineTo(x + 3, y); g.moveTo(x + 5, y - 4); g.lineTo(x + 5, y); g.moveTo(x + 8, y - 3); g.lineTo(x + 7, y); g.stroke(); } return c; }
// rayado de montaña (atlas): trazos cortos pendiente abajo donde la pendiente es fuerte
function pv2Hachures() {
  const W = MAP_W, H = MAP_H, em = MAP.elevM, land = MAP.land, out = [];
  for (let y = 2; y < H - 2; y += 1) for (let x = 2; x < W - 2; x += 1) {
    const i = y * W + x; if (!land[i] || hash2(x, y, 181) > 0.55) continue;
    const gx = (em[i + 1] - em[i - 1]) / 2, gy = (em[i + W] - em[i - W]) / 2, s = Math.hypot(gx, gy); if (s < 60) continue;
    const L = Math.min(1.6, 0.35 + s / 500), jx = (hash2(x, y, 183) - 0.5) * 0.8, jy = (hash2(x, y, 185) - 0.5) * 0.8, ux = -gx / s, uy = -gy / s;
    out.push(x + 0.5 + jx, y + 0.5 + jy, x + 0.5 + jx + ux * L, y + 0.5 + jy + uy * L, Math.min(1, s / 400));
  }
  return new Float32Array(out);
}
function pv2HachBuckets() { const hh = pv2Hachures(), B = 64, m = new Map(); for (let k = 0; k < hh.length; k += 5) { const key = Math.floor(hh[k + 1] / B) * 1000 + Math.floor(hh[k] / B); let a = m.get(key); if (!a) m.set(key, a = []); a.push(hh[k], hh[k + 1], hh[k + 2], hh[k + 3], hh[k + 4]); }
  PV2.hachB = new Map([...m].map(([k, a]) => [k, new Float32Array(a)])); PV2.hachN = hh.length / 5; }
// caminos vectoriales en coordenadas del mapa lógico
function _path(rings, closed) { const p = new Path2D(); rings.forEach(a => { for (let k = 0; k < a.length; k += 2) { const x = lonToX(a[k]), y = latToY(a[k + 1]); k ? p.lineTo(x, y) : p.moveTo(x, y); } if (closed) p.closePath(); }); return p; }
function _bbox(a) { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (let k = 0; k < a.length; k += 2) { const x = lonToX(a[k]), y = latToY(a[k + 1]); if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } return [x0, y0, x1, y1]; }

async function pv2Init(src) {
  src = src || {};
  const t0 = performance.now(), geo = geoV2();
  const [sr, srHi, bat] = await Promise.all([pv2LoadImg(src.relieve), pv2LoadImg(src.relieveAlto), pv2LoadImg(src.batimetria)]);
  PV2.sr = sr; PV2.srHi = srHi; PV2.bat = bat;
  PV2.field = {}; ['verano', 'invierno'].forEach(s => ['actual', 'atlas'].forEach(st => { PV2.field[s + st] = null; }));
  PV2.sea = {actual: pv2SeaField('actual', bat), atlas: pv2SeaField('atlas', bat)};
  PV2.grain = pv2Grain();
  PV2.landRings = geo.land.concat(geo.seas).map(a => ({a, bb: _bbox(a)}));
  PV2.lakeRings = geo.lakes.concat(geo.seas).map(a => ({a, bb: _bbox(a)}));
  PV2.landPath = _path(geo.land.concat(geo.seas), true);
  PV2.lakePath = _path(geo.lakes.concat(geo.seas), true);
  // ríos por orden (1–6) con caja para descartar los que no tocan la tesela
  PV2.rivers = (MAP.riverVec || []).map((a, k) => ({o: MAP.riverOrder[k], name: MAP.riverName[k], a, bb: _bbox(a), p: _path([a], false)}));
  PV2.hach = null;
  // regiones físicas de Natural Earth: desiertos (dunas) y deltas/marismas (trama de humedal)
  const reg = t => geo.regions.map((a, k) => ({a, bb: _bbox(a), t: geo.regionType[k]})).filter(r => t.includes(r.t));
  PV2.desertRings = reg(['desierto']); PV2.marshRings = reg(['delta', 'marisma']);
  PV2.dunes = pv2PatternDunes(); PV2.marsh = pv2PatternMarsh();
  PV2.initMs = Math.round(performance.now() - t0); PV2.ready = true;
  return PV2;
}
// camino solo con los anillos que tocan la tesela (los trazos y recortes cuestan según los vértices del camino)
function _sub(list, x0, y0, x1, y1) { const p = new Path2D(); for (const r of list) { const b = r.bb; if (b[2] < x0 || b[0] > x1 || b[3] < y0 || b[1] > y1) continue; const a = r.a; for (let k = 0; k < a.length; k += 2) { const x = lonToX(a[k]), y = latToY(a[k + 1]); k ? p.lineTo(x, y) : p.moveTo(x, y); } p.closePath(); } return p; }
function pv2FieldFor(season, style) { const k = season + style; if (!PV2.field[k]) PV2.field[k] = pv2Field(season, style); return PV2.field[k]; }
// campo político (color del dueño por estado, 2048×820) para el modo político
function pv2Political(owner, colors) {
  const key = owner.join(','); if (PV2.polKey === key) return PV2.pol;
  const W = MAP_W, H = MAP_H, N = W * H, so = MAP.stateOf, land = MAP.land, cv = PV2.pol || _cv(W, H), g = cv.getContext('2d'), im = g.createImageData(W, H);
  const rgb = {}; Object.keys(colors).forEach(t => { const n = parseInt(colors[t].slice(1), 16); rgb[t] = [n >> 16 & 255, n >> 8 & 255, n & 255]; });
  for (let i = 0; i < N; i++) { if (!land[i]) continue; const c = rgb[owner[so[i]]]; if (!c) continue; const o = i * 4; im.data[o] = c[0]; im.data[o + 1] = c[1]; im.data[o + 2] = c[2]; im.data[o + 3] = 255; }
  // extender un píxel al mar para que el recorte vectorial no deje rendijas
  for (let i = W; i < N - W; i++) { if (land[i]) continue; for (const j of [i - 1, i + 1, i - W, i + W]) if (land[j] && im.data[j * 4 + 3]) { const o = i * 4, q = j * 4; im.data[o] = im.data[q]; im.data[o + 1] = im.data[q + 1]; im.data[o + 2] = im.data[q + 2]; im.data[o + 3] = 255; break; } }
  g.putImageData(im, 0, 0); PV2.pol = cv; PV2.polKey = key; return cv;
}
// fronteras de país: polilíneas de estado (MAP.borderLines k = 1) cuyos estados tienen dueños distintos
function pv2CountryLines(owner) { const key = owner.join(','); if (PV2.clKey === key) return PV2.cl; PV2.cl = (MAP.borderLines || []).filter(L => L.k === 1 && owner[L.a] !== owner[L.b]); PV2.clKey = key; return PV2.cl; }
function _strokeLines(g, list, x0, y0, x1, y1) {
  g.beginPath();
  for (const L of list) { const xy = L.xy; if (!L.bb) { let a = 1e9, b = 1e9, c = -1e9, d = -1e9; for (let k = 0; k < xy.length; k += 2) { if (xy[k] < a) a = xy[k]; if (xy[k] > c) c = xy[k]; if (xy[k + 1] < b) b = xy[k + 1]; if (xy[k + 1] > d) d = xy[k + 1]; } L.bb = [a, b, c, d]; }
    if (L.bb[2] < x0 || L.bb[0] > x1 || L.bb[3] < y0 || L.bb[1] > y1) continue;
    g.moveTo(xy[0], xy[1]); for (let k = 2; k < xy.length; k += 2) g.lineTo(xy[k], xy[k + 1]); }
  g.stroke();
}
// ---------------- tesela ----------------
function pv2PaintTile(g, x0, y0, s, w, h, opt) {
  opt = opt || {}; const L = Object.assign({relieve: true, rios: true, lagos: true, fronteras: true, provincias: true, politico: false, rutas: false, cuadricula: false}, opt.layers || {});
  const atlas = opt.style === 'atlas', season = opt.season || 'verano', x1 = x0 + w / s, y1 = y0 + h / s, pad = 2;
  const base = g.getTransform(); g.save(); g.transform(s, 0, 0, s, -x0 * s, -y0 * s); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
  const sx0 = Math.max(0, Math.floor(x0) - pad), sy0 = Math.max(0, Math.floor(y0) - pad), sx1 = Math.min(MAP_W, Math.ceil(x1) + pad), sy1 = Math.min(MAP_H, Math.ceil(y1) + pad), sw = sx1 - sx0, sh = sy1 - sy0;
  if (sw <= 0 || sh <= 0) { g.restore(); return; }
  const M = 30 / s + 3, landP = _sub(PV2.landRings, x0 - M, y0 - M, x1 + M, y1 + M), lakeP = _sub(PV2.lakeRings, x0 - M, y0 - M, x1 + M, y1 + M);
  // 1. mar
  g.drawImage(PV2.sea[atlas ? 'atlas' : 'actual'], sx0, sy0, sw, sh, sx0, sy0, sw, sh);
  if (PV2.bat && L.relieve) { const k = PV2.bat.width / MAP_W; g.globalCompositeOperation = 'overlay'; g.globalAlpha = atlas ? 0.35 : 0.55; g.drawImage(PV2.bat, sx0 * k, sy0 * k, sw * k, sh * k, sx0, sy0, sw, sh); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; }
  // aguas someras y espuma / líneas de agua del atlas: trazos anchos del contorno bajo la tierra
  g.lineJoin = 'round'; g.lineCap = 'round';
  if (atlas) {   // líneas de agua (grabado del XIX): anillos finos de tinta paralelos a la costa, de ancho constante en pantalla
    const lay = PV2._wl || (PV2._wl = _cv(w, h)); if (lay.width !== w || lay.height !== h) { lay.width = w; lay.height = h; }
    const q = lay.getContext('2d'); q.setTransform(1, 0, 0, 1, 0, 0); q.clearRect(0, 0, w, h); q.setTransform(s, 0, 0, s, -x0 * s, -y0 * s); q.lineJoin = 'round';
    [[30, 0.16], [21, 0.2], [13.5, 0.26], [7, 0.36]].forEach(([wd, a]) => { q.globalCompositeOperation = 'source-over'; q.strokeStyle = `rgba(59,42,26,${a})`; q.lineWidth = wd / s; q.stroke(landP);
      q.globalCompositeOperation = 'destination-out'; q.strokeStyle = '#000'; q.lineWidth = (wd - 1.6) / s; q.stroke(landP); });
    q.globalCompositeOperation = 'source-over'; g.save(); g.setTransform(base); g.drawImage(lay, 0, 0); g.restore(); }
  else { g.strokeStyle = 'rgba(120,190,200,0.32)'; g.lineWidth = Math.min(2.4, 16 / s); g.stroke(landP); g.strokeStyle = 'rgba(200,236,236,0.42)'; g.lineWidth = Math.min(0.9, 5 / s); g.stroke(landP); }
  // 2. tierra (recortada por el contorno vectorial)
  g.save(); g.clip(landP, 'nonzero');
  g.drawImage(pv2FieldFor(season, atlas ? 'atlas' : 'actual'), sx0, sy0, sw, sh, sx0, sy0, sw, sh);
  if (L.politico && opt.owner && opt.colors) { g.globalAlpha = atlas ? 0.24 : Math.max(0.3, Math.min(0.5, 0.56 - s * 0.02)); g.globalCompositeOperation = atlas ? 'multiply' : 'source-over'; g.drawImage(pv2Political(opt.owner, opt.colors), sx0, sy0, sw, sh, sx0, sy0, sw, sh); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; }
  const low = opt.quality === 'bajo', sr = s > 2.2 && PV2.srHi && !low ? PV2.srHi : PV2.sr;
  if (L.relieve && sr) { const k = sr.width / MAP_W; g.globalCompositeOperation = 'overlay'; g.globalAlpha = (atlas ? 0.5 : Math.max(0.6, Math.min(0.95, 1.05 - s * 0.04))) * (opt.reliefK != null ? opt.reliefK : 1);
    g.drawImage(sr, sx0 * k, sy0 * k, sw * k, sh * k, sx0, sy0, sw, sh); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; }
  if (atlas && L.relieve && s > 0.7) { if (!PV2.hachB) pv2HachBuckets(); g.strokeStyle = 'rgba(80,58,36,0.55)'; g.lineWidth = Math.max(0.08, 0.7 / s); g.beginPath();
    const stp = s < 1.4 ? 3 : s < 3 ? 2 : 1, B = 64;
    for (let by = Math.max(0, Math.floor((y0 - 2) / B)); by <= Math.floor((y1 + 2) / B); by++) for (let bx = Math.max(0, Math.floor((x0 - 2) / B)); bx <= Math.floor((x1 + 2) / B); bx++) {
      const hh = PV2.hachB.get(by * 1000 + bx); if (!hh) continue;
      for (let k = 0; k < hh.length; k += 5 * stp) { const ax = hh[k], ay = hh[k + 1]; if (ax < x0 - 2 || ax > x1 + 2 || ay < y0 - 2 || ay > y1 + 2) continue; g.moveTo(ax, ay); g.lineTo(hh[k + 2], hh[k + 3]); } }
    g.stroke(); }
  // dunas y humedales (tramas recortadas por las regiones físicas)
  if (s > 1.2 && !low) for (const [rings, pat, a] of [[PV2.desertRings, PV2.dunes, atlas ? 0.35 : 0.22], [PV2.marshRings, PV2.marsh, atlas ? 0.55 : 0.4]]) {
    const pth = _sub(rings, x0 - 2, y0 - 2, x1 + 2, y1 + 2), pt = g.createPattern(pat, 'repeat'), mm = new DOMMatrix(); mm.scaleSelf(1 / s * (pat === PV2.dunes ? 1.6 : 1.2)); pt.setTransform(mm);
    g.save(); g.clip(pth); g.globalAlpha = a; g.globalCompositeOperation = 'multiply'; g.fillStyle = pt; g.fillRect(sx0, sy0, sw, sh); g.restore(); }
  // grano de pincelada a zoom cercano
  if (!atlas && !low && s > 1.5) { const pat = g.createPattern(PV2.grain, 'repeat'), m = new DOMMatrix(); m.scaleSelf(1 / Math.min(s, 6) * 1.5); pat.setTransform(m); g.globalCompositeOperation = 'soft-light'; g.globalAlpha = Math.min(0.5, (s - 1.5) * 0.15); g.fillStyle = pat; g.fillRect(sx0, sy0, sw, sh); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; }
  if (atlas) { const pat = g.createPattern(PV2.grain, 'repeat'), m = new DOMMatrix(); m.scaleSelf(1 / s * 2); pat.setTransform(m); g.globalCompositeOperation = 'multiply'; g.globalAlpha = 0.12; g.fillStyle = pat; g.fillRect(sx0, sy0, sw, sh); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; }
  g.restore();
  // 3. lagos y mares interiores
  if (L.lagos) { g.fillStyle = atlas ? 'rgb(190,210,206)' : 'rgb(70,128,150)'; g.fill(lakeP); g.strokeStyle = atlas ? PV2_ATLAS.tinta2 : 'rgba(200,236,236,0.5)'; g.lineWidth = Math.max(0.12, 0.9 / s); g.stroke(lakeP); }
  // 4. ríos: grosor por orden; a menos zoom solo los mayores
  if (L.rios) { const minO = s < 0.6 ? 5 : s < 1.1 ? 4 : s < 2.2 ? 3 : s < 4 ? 2 : 1;
    g.strokeStyle = atlas ? PV2_ATLAS.rio : 'rgb(76,140,170)';
    for (const r of PV2.rivers) { if (r.o < minO || r.bb[2] < x0 - 1 || r.bb[0] > x1 + 1 || r.bb[3] < y0 - 1 || r.bb[1] > y1 + 1) continue;
      g.lineWidth = ((0.35 + r.o * 0.3) / s + 0.025 * r.o) * (atlas ? 0.85 : 1); g.stroke(r.p); } }
  // 5. contorno de costa
  g.strokeStyle = atlas ? PV2_ATLAS.tinta : 'rgba(30,50,60,0.55)'; g.lineWidth = Math.max(0.09, (atlas ? 1.1 : 0.8) / s); g.stroke(landP);
  // 6. rutas (carreteras y ferrocarril)
  if (L.rutas && PV2.routes) pv2DrawRoutes(g, s, x0, y0, x1, y1, opt.year || 1836, atlas);
  // 7. fronteras: provincia < estado < país
  if (L.fronteras && MAP.borderLines) {
    g.save(); g.clip(landP, 'nonzero');
    if (L.provincias && s > 1.6 && !low) { g.setLineDash([2 / s, 2.5 / s]); g.strokeStyle = atlas ? 'rgba(59,42,26,0.35)' : 'rgba(30,30,20,0.28)'; g.lineWidth = 0.7 / s; _strokeLines(g, MAP.borderLines.filter(l => l.k === 2), x0, y0, x1, y1); g.setLineDash([]); }
    if (s > 0.55) { g.strokeStyle = atlas ? 'rgba(59,42,26,0.55)' : 'rgba(25,22,15,0.45)'; g.lineWidth = Math.max(0.05, (atlas ? 0.8 : 0.9) / s); if (atlas) g.setLineDash([3 / s, 1.6 / s]); _strokeLines(g, MAP.borderLines.filter(l => l.k === 1), x0, y0, x1, y1); g.setLineDash([]); }
    if (opt.owner) { const cl = pv2CountryLines(opt.owner);
      if (atlas) { // cinta de color a ambos lados de la frontera (atlas pintados a mano) + línea de tinta discontinua
        g.globalAlpha = 0.35; g.lineWidth = Math.max(0.35, 3.2 / s); cl.forEach(Lq => { g.strokeStyle = opt.colors[opt.owner[Lq.a]] || '#a33'; _strokeLines(g, [Lq], x0, y0, x1, y1); }); g.globalAlpha = 1;
        g.strokeStyle = PV2_ATLAS.tinta; g.lineWidth = Math.max(0.12, 1.3 / s); g.setLineDash([5 / s, 1.5 / s, 1 / s, 1.5 / s]); _strokeLines(g, cl, x0, y0, x1, y1); g.setLineDash([]); }
      else { g.strokeStyle = 'rgba(15,12,8,0.75)'; g.lineWidth = Math.max(0.12, 1.7 / s); _strokeLines(g, cl, x0, y0, x1, y1); } }
    g.restore();
  }
  // 8. cuadrícula de meridianos y paralelos (atlas)
  if (L.cuadricula || atlas) { const step = s < 1.2 ? 15 : s < 3 ? 10 : 5; g.strokeStyle = atlas ? 'rgba(59,42,26,0.22)' : 'rgba(255,255,255,0.12)'; g.lineWidth = 0.6 / s; g.beginPath();
    for (let lon = -180; lon <= 180; lon += step) { const x = lonToX(lon); if (x < x0 - 1 || x > x1 + 1) continue; g.moveTo(x, Math.max(0, y0)); g.lineTo(x, Math.min(MAP_H, y1)); }
    for (let lat = -60; lat <= 80; lat += step) { const y = latToY(lat); if (y < y0 - 1 || y > y1 + 1) continue; g.moveTo(Math.max(0, x0), y); g.lineTo(Math.min(MAP_W, x1), y); } g.stroke(); }
  g.restore();
}

// ---------------- textura completa para el juego (plano 3D) ----------------
// pv2PaintTexture(canvas, escala, opt): pinta el mapa entero en un lienzo de MAP_W·escala × MAP_H·escala (escala 1 = 2048×820 «bajo»,
// 2 = 4096×1640 «medio», 4 = 8192×3280 «alto» si la GPU admite texturas de 8192) por franjas de 1024 px para no bloquear un fotograma largo.
// Devuelve una promesa; onStrip(y0, y1) permite subir a la GPU solo la franja pintada (texSubImage2D) si se quiere.
function pv2PaintTexture(cv, scale, opt, onStrip) {
  cv.width = Math.round(MAP_W * scale); cv.height = Math.round(MAP_H * scale); const g = cv.getContext('2d', {willReadFrequently: true}), T = 1024;
  const jobs = []; for (let y = 0; y < cv.height; y += T) for (let x = 0; x < cv.width; x += T) jobs.push([x, y]);
  return new Promise(ok => { const step = () => { const t0 = performance.now();
    while (jobs.length && performance.now() - t0 < 12) { const [x, y] = jobs.shift(), w = Math.min(T, cv.width - x), h = Math.min(T, cv.height - y);
      g.save(); g.translate(x, y); g.beginPath(); g.rect(0, 0, w, h); g.clip(); pv2PaintTile(g, x / scale, y / scale, scale, w, h, opt); g.restore(); onStrip && onStrip(x, y, w, h); }
    if (jobs.length) setTimeout(step, 0); else ok(cv); }; step(); });
}
// repinta solo la caja de un estado (cambio de dueño): x0..x1, y0..y1 en píxeles lógicos

