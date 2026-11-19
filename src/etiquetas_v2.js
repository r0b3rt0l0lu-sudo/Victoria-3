/* ===== RÓTULOS Y CAPAS INFORMATIVAS DEL MAPA v2 =====
   pv2Labels(g, view, opt): dibuja en pantalla (no en teselas, para no cortar textos) los nombres de país curvados a lo largo de su forma,
   mares y océanos en cursiva, cordilleras y desiertos, estados (a zoom cercano), ciudades con icono por tamaño, capitales y puertos.
   Evita solapes por prioridad (países > mares > ciudades grandes > cordilleras > estados > ciudades menores) y se adapta al zoom.
   view = {x0, y0, s, w, h} (origen en píxeles del mapa lógico y escala en píxeles de pantalla por píxel lógico).
   pv2Cities(): coloca las ciudades del juego (CITY_NAMES) en su posición real (poblaciones de Natural Earth dentro del estado). */
const PV2L = {cities: null, countryKey: null, countries: null};
const _norm = s => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]/g, '');
function pv2Cities() {
  if (PV2L.cities) return PV2L.cities;
  const W = MAP_W, so = MAP.stateOf, land = MAP.land, out = [], places = (GEO2.places || []).map(p => ({n: p[0], ks: p[0].split('|').map(_norm), x: lonToX(p[1]), y: latToY(p[2]), pop: p[3]}));
  const capitals = new Set(typeof COUNTRY_DATA !== 'undefined' ? Object.values(COUNTRY_DATA).map(c => c[5]) : []);
  const byState = {}; places.forEach(p => { const xi = Math.floor(p.x), yi = Math.floor(p.y), i = yi * W + xi; if (xi < 0 || yi < 0 || xi >= W || yi >= MAP_H || !land[i]) return; (byState[so[i]] = byState[so[i]] || []).push(p); });
  MAP.seeds.forEach((sd, s) => {
    const cn = typeof CITY_NAMES !== 'undefined' ? CITY_NAMES[sd.name] : null; if (!cn && !capitals.has(sd.name)) return;
    const name = cn ? cn[0] : sd.name, imp = cn ? cn[1] : 1, cand = byState[s] || [], k = _norm(name);
    let best = cand.filter(p => p.ks.includes(k)).sort((a, b) => b.pop - a.pop)[0] || cand.filter(p => p.ks.some(q => k.length > 4 && q.length > 4 && (q.startsWith(k.slice(0, 5)) || k.startsWith(q.slice(0, 5))))).sort((a, b) => b.pop - a.pop)[0];
    // si no está dentro del estado (estado v2 más estrecho que la ciudad real), se busca en todo el mundo cerca de la semilla
    if (!best) best = places.filter(p => p.ks.includes(k) && Math.hypot(p.x - sd.px, p.y - sd.py) < 40).sort((a, b) => b.pop - a.pop)[0];
    if (!best && cand.length) best = cand.reduce((a, b) => b.pop > a.pop ? b : a);
    const x = best ? best.x : sd.px + 0.5, y = best ? best.y : sd.py + 0.5, i = Math.floor(y) * W + Math.floor(x);
    out.push({name, imp: capitals.has(sd.name) ? Math.max(imp, 2) : imp, cap: capitals.has(sd.name), port: MAP.dLand[i] < 2.6, x, y, s, real: !!best});
  });
  PV2L.cities = out; return out;
}
// eje medio de un conjunto de píxeles: componente principal + mediana perpendicular por tramos → polilínea suave
function _midline(pix, W) {
  // coordenadas desenvueltas respecto al primer píxel (los países que cruzan ±180°, como Rusia en Chukotka)
  const ref = pix[0] % W, X = i => { let x = i % W; if (x - ref > W / 2) x -= W; else if (ref - x > W / 2) x += W; return x; };
  let n = 0, mx = 0, my = 0; for (const i of pix) { mx += X(i); my += (i / W) | 0; n++; } mx /= n; my /= n;
  let sxx = 0, syy = 0, sxy = 0; for (const i of pix) { const dx = X(i) - mx, dy = ((i / W) | 0) - my; sxx += dx * dx; syy += dy * dy; sxy += dx * dy; }
  const ang = 0.5 * Math.atan2(2 * sxy, sxx - syy); let ux = Math.cos(ang), uy = Math.sin(ang); if (ux < 0) { ux = -ux; uy = -uy; }   // texto de izquierda a derecha
  let t0 = 1e9, t1 = -1e9; const ts = new Float32Array(pix.length), vs = new Float32Array(pix.length); let k = 0;
  for (const i of pix) { const dx = X(i) - mx, dy = ((i / W) | 0) - my, t = dx * ux + dy * uy, v = -dx * uy + dy * ux; ts[k] = t; vs[k] = v; k++; if (t < t0) t0 = t; if (t > t1) t1 = t; }
  const B = 9, bins = Array.from({length: B}, () => []); for (let j = 0; j < k; j++) bins[Math.max(0, Math.min(B - 1, Math.floor((ts[j] - t0) / (t1 - t0 + 1e-6) * B)))].push(vs[j]);
  const pts = []; bins.forEach((b, j) => { if (b.length < 3) return; b.sort((a, c) => a - c); const v = b[b.length >> 1], t = t0 + (j + 0.5) / B * (t1 - t0); pts.push([mx + ux * t - uy * v, my + uy * t + ux * v, b[b.length - 1] - b[0]]); });
  for (let pass = 0; pass < 3; pass++) for (let j = 1; j < pts.length - 1; j++) { pts[j][0] = (pts[j - 1][0] + pts[j][0] * 2 + pts[j + 1][0]) / 4; pts[j][1] = (pts[j - 1][1] + pts[j][1] * 2 + pts[j + 1][1]) / 4; }
  const thick = pts.length ? pts.reduce((a, p) => a + p[2], 0) / pts.length : 1;
  return {pts, len: t1 - t0, thick, area: n, cx: mx, cy: my};
}
function pv2LandComps() {
  if (PV2L.landComp) return PV2L.landComp; const W = MAP_W, N = W * MAP_H, land = MAP.land, lc = new Int32Array(N).fill(-1), st = new Int32Array(N); let c = 0;
  for (let i0 = 0; i0 < N; i0++) { if (!land[i0] || lc[i0] >= 0) continue; let sp = 0; st[sp++] = i0; lc[i0] = c;
    while (sp) { const i = st[--sp], x = i % W; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { let nx = x + dx; if (nx < 0) nx = W - 1; else if (nx >= W) nx = 0; const j = i - x + nx + dy * W; if (j < 0 || j >= N || !land[j] || lc[j] >= 0) continue; lc[j] = c; st[sp++] = j; } } c++; }
  return (PV2L.landComp = lc);
}
function pv2CountryShapes(owner) {
  const key = owner.join(','); if (PV2L.countryKey === key) return PV2L.countries; pv2LandComps();
  const W = MAP_W, groups = {}; owner.forEach((t, s) => { if (t) (groups[t] = groups[t] || []).push(s); });
  const out = [];
  Object.keys(groups).forEach(t => {
    // solo la masa principal (las colonias lejanas llevan su propio rótulo si son grandes): componentes por vecindad de estados
    const sts = groups[t], seen = new Set(), comps = [];
    sts.forEach(s0 => { if (seen.has(s0)) return; const c = [], st = [s0]; seen.add(s0); while (st.length) { const s = st.pop(); c.push(s); MAP.stats[s].neigh.forEach(n => { if (owner[n] === t && !seen.has(n)) { seen.add(n); st.push(n); } }); } comps.push(c); });
    comps.forEach(c => {
      // dentro de cada grupo de estados vecinos, una etiqueta por masa de tierra grande (las islas lejanas del mismo estado no desplazan el rótulo)
      const byLand = new Map(); c.forEach(s => { const a = MAP.pixOff[s], b = MAP.pixOff[s + 1], step = Math.max(1, Math.floor((b - a) / 1500));
        for (let k = a; k < b; k += step) { const i = MAP.pixOrder[k], lc = PV2L.landComp[i]; let e = byLand.get(lc); if (!e) byLand.set(lc, e = {pix: [], n: 0}); e.pix.push(i); e.n += step; } });
      const parts = [...byLand.values()].sort((a, b) => b.n - a.n); if (!parts.length) return; const big = parts[0].n;
      parts.forEach(e => { if (e.n < 40 || e.n < big * 0.3) return; const ml = _midline(e.pix, W); out.push(Object.assign(ml, {tag: t, area: e.n})); });
    });
  });
  out.sort((a, b) => b.area - a.area); PV2L.countries = out; PV2L.countryKey = key; return out;
}
// texto a lo largo de una polilínea en pantalla; devuelve las cajas de las letras o null si no cabe
function _textPath(g, text, pts, size, spacing, draw, boxes) {
  const L = [0]; for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const total = L[L.length - 1], ws = [...text].map(ch => g.measureText(ch).width + spacing), tw = ws.reduce((a, b) => a + b, 0) - spacing;
  if (tw > total * 0.98 || !pts.length) return null;
  let d = (total - tw) / 2, seg = 0; const out = [];
  for (let c = 0; c < ws.length; c++) {
    const mid = d + (ws[c] - spacing) / 2; while (seg < L.length - 2 && L[seg + 1] < mid) seg++;
    const u = (mid - L[seg]) / Math.max(1e-6, L[seg + 1] - L[seg]), x = pts[seg][0] + (pts[seg + 1][0] - pts[seg][0]) * u, y = pts[seg][1] + (pts[seg + 1][1] - pts[seg][1]) * u;
    const a = Math.atan2(pts[seg + 1][1] - pts[seg][1], pts[seg + 1][0] - pts[seg][0]); out.push([x, y, a, ws[c] - spacing]); d += ws[c];
  }
  const bx = out.map(([x, y, a, w]) => [x - w * 0.6 - size * 0.25, y - size * 0.6, x + w * 0.6 + size * 0.25, y + size * 0.6]);
  if (boxes && bx.some(b => boxes.some(q => b[0] < q[2] && b[2] > q[0] && b[1] < q[3] && b[3] > q[1]))) return null;
  if (draw) { const chs = [...text]; out.forEach(([x, y, a], c) => { g.save(); g.translate(x, y); g.rotate(a); g.strokeText(chs[c], 0, 0); g.fillText(chs[c], 0, 0); g.restore(); }); }
  if (boxes) bx.forEach(b => boxes.push(b));
  return out;
}
function _free(boxes, b) { return !boxes.some(q => b[0] < q[2] && b[2] > q[0] && b[1] < q[3] && b[3] > q[1]); }
function pv2Labels(g, view, opt) {
  opt = opt || {}; const L = Object.assign({etiquetas: true, ciudades: true, puertos: true, estados: true}, opt.layers || {}), atlas = opt.style === 'atlas', s = view.s;
  const X = x => (x - view.x0) * s, Y = y => (y - view.y0) * s, inView = (x, y, m) => X(x) > -m && Y(y) > -m && X(x) < view.w + m && Y(y) < view.h + m;
  const boxes = [], serif = '"Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif';
  g.save(); g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
  const halo = atlas ? 'rgba(236,223,192,0.85)' : 'rgba(20,18,12,0.7)';
  // 1. países (curvados por su eje)
  if (L.etiquetas && opt.owner && s < 6) {
    pv2CountryShapes(opt.owner).forEach(c => {
      const name = (opt.names && opt.names[c.tag]) || c.tag; if (!name) return;
      const pts = c.pts.map(p => [X(p[0]), Y(p[1])]); if (pts.length < 2) return; const lenS = c.len * s;
      if (!pts.some(p => p[0] > 0 && p[1] > 0 && p[0] < view.w && p[1] < view.h)) return;
      const up = name.toUpperCase(), size = Math.min(atlas ? 30 : 34, Math.max(0, Math.min(c.thick * s * 0.55, lenS * 0.8 / (up.length * 0.82))));
      if (size < 9) return;
      g.fillStyle = atlas ? 'rgba(59,42,26,0.78)' : 'rgba(250,244,226,0.9)'; g.strokeStyle = atlas ? 'rgba(236,223,192,0.6)' : 'rgba(25,20,12,0.55)';
      for (let k = 0, sz = size; k < 4 && sz >= 9; k++, sz *= 0.85) {   // si no cabe, más pequeño
        g.font = `${atlas ? '' : '600 '}${sz.toFixed(1)}px ${serif}`; g.lineWidth = Math.max(2, sz * 0.16);
        if (_textPath(g, up, pts, sz, sz * (atlas ? 0.4 : 0.22), true, boxes)) break; }
    });
  }
  // 2. mares y océanos (cursiva, curva suave según el eje de la cuenca)
  if (L.etiquetas) {
    const maxR = s < 0.7 ? 1 : s < 1.3 ? 2 : s < 2.5 ? 3 : 4;
    GEO2.labels.filter(l => l.t === 'mar' && l.r <= maxR).sort((a, b) => a.r - b.r).forEach(l => {
      const x = lonToX(l.x), y = latToY(l.y); if (!inView(x, y, 200)) return;
      const size = Math.max(10, Math.min(24, (atlas ? 20 : 18) - l.r * 2.4 + Math.log2(Math.max(0.5, s)) * 2)), name = l.n.charAt(0).toUpperCase() + l.n.slice(1);
      g.font = `italic ${size.toFixed(1)}px ${serif}`; const tw = g.measureText(name).width * 1.25 + name.length * size * 0.18;
      const a = -l.a * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a), R = tw * 1.6, pts = [];
      for (let k = -6; k <= 6; k++) { const t = k / 6 * tw * 0.6, bow = (1 - (k / 6) ** 2) * tw * 0.06; pts.push([X(x) + ca * t - sa * -bow, Y(y) + sa * t + ca * -bow]); }
      g.lineWidth = 3; g.fillStyle = atlas ? 'rgba(46,72,92,0.85)' : 'rgba(170,205,222,0.85)'; g.strokeStyle = atlas ? 'rgba(196,214,210,0.7)' : 'rgba(10,30,45,0.35)';
      _textPath(g, name, pts, size, size * 0.18, true, boxes);
    });
  }
  // 3. ciudades grandes y capitales
  const cities = L.ciudades ? pv2Cities() : [];
  const drawCity = c => {
    const x = X(c.x), y = Y(c.y), r = (c.imp + 1) * (s < 1 ? 0.9 : 1.2) + (s > 3 ? 1 : 0), size = 10 + c.imp * 1.6 + (s > 3 ? 1.5 : 0);
    g.font = `${c.cap ? '600 ' : ''}${size.toFixed(1)}px ${serif}`; const tw = g.measureText(c.name).width, bx = [x + r + 1, y - size * 0.6, x + r + 4 + tw, y + size * 0.6];
    if (!_free(boxes, [x - r, y - r, x + r, y + r]) || !_free(boxes, bx)) return;
    boxes.push([x - r, y - r, x + r, y + r], bx);
    g.fillStyle = atlas ? '#3b2a1a' : '#f6efd8'; g.strokeStyle = atlas ? '#ecdfc0' : '#1a140c'; g.lineWidth = 1.4;
    if (c.cap) { g.beginPath(); for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, rr = k % 2 ? r * 0.55 : r * 1.35; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } g.closePath(); g.fill(); g.stroke(); }
    else if (atlas) { g.beginPath(); g.arc(x, y, r * 0.75, 0, 7); g.fillStyle = '#ecdfc0'; g.fill(); g.strokeStyle = '#3b2a1a'; g.stroke(); g.beginPath(); g.arc(x, y, r * 0.3, 0, 7); g.fillStyle = '#3b2a1a'; g.fill(); }
    else { g.beginPath(); g.arc(x, y, r * 0.8, 0, 7); g.fill(); g.stroke(); }
    if (L.puertos && c.port && s > 1.3) { g.font = `${Math.round(size * 0.85)}px sans-serif`; g.fillStyle = atlas ? '#2e485c' : '#9fd0e6'; g.fillText('⚓', x - r - 7, y + 1); }
    g.font = `${c.cap ? '600 ' : ''}${size.toFixed(1)}px ${serif}`; g.textAlign = 'left'; g.lineWidth = 3; g.strokeStyle = halo; g.fillStyle = atlas ? '#2a1d10' : '#fbf5e2';
    g.strokeText(c.name, x + r + 3, y); g.fillText(c.name, x + r + 3, y); g.textAlign = 'center';
  };
  cities.filter(c => (c.cap || c.imp >= 3) && s > 0.45 && inView(c.x, c.y, 20)).sort((a, b) => b.imp - a.imp).forEach(drawCity);
  // 4. cordilleras, desiertos y otras regiones físicas
  if (L.etiquetas && s > 0.9) {
    const maxR = s < 1.6 ? 2 : s < 3 ? 3 : 5;
    GEO2.labels.filter(l => l.t !== 'mar' && l.r <= maxR && ['sierra', 'desierto', 'meseta', 'delta', 'marisma', 'tundra', 'llanura', 'cuenca', 'peninsula'].includes(l.t)).forEach(l => {
      const x = lonToX(l.x), y = latToY(l.y); if (!inView(x, y, 100)) return; const nm = l.n; if (!nm) return;
      const size = Math.max(9, Math.min(15, 15 - l.r * 1.2 + Math.log2(s))); g.font = `italic ${size.toFixed(1)}px ${serif}`;
      const a = -l.a * Math.PI / 180, tw = g.measureText(nm).width * 1.3 + nm.length * size * 0.12, ca = Math.cos(a), sa = Math.sin(a), pts = [];
      for (let k = -4; k <= 4; k++) { const t = k / 4 * tw * 0.62; pts.push([X(x) + ca * t, Y(y) + sa * t]); }
      g.lineWidth = 2.5; g.fillStyle = l.t === 'sierra' ? (atlas ? 'rgba(96,58,30,0.85)' : 'rgba(236,214,178,0.92)') : (atlas ? 'rgba(96,74,40,0.8)' : 'rgba(240,232,200,0.85)'); g.strokeStyle = atlas ? 'rgba(236,223,192,0.7)' : 'rgba(30,22,12,0.5)';
      _textPath(g, nm.toUpperCase(), pts, size, size * 0.3, true, boxes);
    });
  }
  // 5. estados (zoom cercano)
  if (L.estados && s > 2.4) {
    MAP.stats.forEach((st, sid) => { if (!st.area) return; const x = st.sx / st.area, y = st.sy / st.area; if (!inView(x, y, 40)) return;
      const nm = MAP.seeds[sid].name, w = (st.x1 - st.x0) * s; const size = Math.min(13, Math.max(9, w / (nm.length * 0.7))); if (w < nm.length * size * 0.5) return;
      g.font = `${size.toFixed(1)}px ${serif}`; const tw = g.measureText(nm).width, b = [X(x) - tw / 2, Y(y) - size * 0.6, X(x) + tw / 2, Y(y) + size * 0.6]; if (!_free(boxes, b)) return; boxes.push(b);
      g.lineWidth = 2.5; g.strokeStyle = atlas ? 'rgba(236,223,192,0.7)' : 'rgba(20,16,10,0.45)'; g.fillStyle = atlas ? 'rgba(59,42,26,0.6)' : 'rgba(246,240,220,0.7)';
      g.strokeText(nm, X(x), Y(y)); g.fillText(nm, X(x), Y(y)); });
  }
  // 6. resto de ciudades
  cities.filter(c => !(c.cap || c.imp >= 3) && s > (c.imp >= 2 ? 0.9 : 1.8) && inView(c.x, c.y, 20)).sort((a, b) => b.imp - a.imp).forEach(drawCity);
  g.restore();
  if (atlas) pv2AtlasFrame(g, view);
}
// marco con graduación y rosa de los vientos (atlas)
function pv2AtlasFrame(g, view) {
  const W = view.w, H = view.h, m = 22, s = view.s;
  g.save(); g.fillStyle = '#e8dbb8'; g.fillRect(0, 0, W, m); g.fillRect(0, H - m, W, m); g.fillRect(0, 0, m, H); g.fillRect(W - m, 0, m, H);
  g.strokeStyle = '#3b2a1a'; g.lineWidth = 1.2; g.strokeRect(m - 0.5, m - 0.5, W - 2 * m + 1, H - 2 * m + 1); g.lineWidth = 0.6; g.strokeRect(m - 5.5, m - 5.5, W - 2 * m + 11, H - 2 * m + 11);
  const step = s < 1.2 ? 10 : s < 7 ? 5 : 1; g.font = '10px Georgia, serif'; g.fillStyle = '#3b2a1a'; g.textAlign = 'center'; g.textBaseline = 'middle';
  // graduación alterna blanco/negro cada «step» grados
  for (let lon = -180; lon < 180; lon += step) { const xa = (lonToX(lon) - view.x0) * s, xb = (lonToX(lon + step) - view.x0) * s; if (xb < m || xa > W - m) continue; const a = Math.max(m, xa), b = Math.min(W - m, xb);
    if (((lon / step) | 0) % 2 === 0) { g.fillRect(a, m - 5, b - a, 4); g.fillRect(a, H - m + 1, b - a, 4); }
    if (xa >= m && xa <= W - m && (step * s * 360 / MAP_W > 42 || lon % (step * 2) === 0)) { const t = Math.abs(lon) + '°' + (lon < 0 ? 'O' : lon > 0 ? 'E' : ''); g.fillText(t, xa, 8); g.fillText(t, xa, H - 8); } }
  for (let lat = -60; lat < 84; lat += step) { const ya = (latToY(lat) - view.y0) * s, yb = (latToY(lat + step) - view.y0) * s; if (ya < m || yb > H - m) continue; const a = Math.max(m, yb), b = Math.min(H - m, ya);
    if (((lat / step) | 0) % 2 === 0) { g.fillRect(m - 5, a, 4, b - a); g.fillRect(W - m + 1, a, 4, b - a); }
    if (ya >= m && ya <= H - m) { const t = Math.abs(lat) + '°' + (lat < 0 ? 'S' : lat > 0 ? 'N' : ''); g.save(); g.translate(9, ya); g.rotate(-Math.PI / 2); g.fillText(t, 0, 0); g.restore(); g.save(); g.translate(W - 9, ya); g.rotate(Math.PI / 2); g.fillText(t, 0, 0); g.restore(); } }
  // rosa de los vientos
  const cx = W - m - 70, cy = H - m - 78, R = 46; g.translate(cx, cy);
  g.strokeStyle = '#3b2a1a'; g.lineWidth = 0.8; g.beginPath(); g.arc(0, 0, R * 0.78, 0, 7); g.stroke(); g.beginPath(); g.arc(0, 0, R * 0.7, 0, 7); g.stroke();
  for (let k = 0; k < 16; k++) { const a = k * Math.PI / 8, L = k % 4 === 0 ? R : k % 2 === 0 ? R * 0.7 : R * 0.5, w = k % 4 === 0 ? 7 : 4;
    for (const side of [1, -1]) { g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a) * L, Math.sin(a) * L); g.lineTo(Math.cos(a + side * Math.PI / 2) * w, Math.sin(a + side * Math.PI / 2) * w); g.closePath(); g.fillStyle = side > 0 ? '#3b2a1a' : '#ecdfc0'; g.fill(); g.stroke(); } }
  g.font = 'italic 600 13px Georgia, serif'; g.fillStyle = '#3b2a1a'; g.fillText('N', 0, -R - 9); g.restore();
}
// carreteras y ferrocarril: tramos entre centros de estados vecinos por tierra. railYear(a, b) → año de apertura (o Infinity).
function pv2BuildRoutes(railYear) {
  const out = [], seen = new Set();
  MAP.stats.forEach((st, a) => st.neigh.forEach(b => { if (b < a || seen.has(a * 1000 + b)) return; seen.add(a * 1000 + b);
    const A = MAP.stats[a], B = MAP.stats[b]; if (!A.area || !B.area) return; const ca = PV2L.cityOf && PV2L.cityOf[a] || [A.sx / A.area, A.sy / A.area], cb = PV2L.cityOf && PV2L.cityOf[b] || [B.sx / B.area, B.sy / B.area];
    if (Math.hypot(ca[0] - cb[0], ca[1] - cb[1]) > 60) return;
    // curva suave: punto medio desplazado por el ruido para que no parezca una regla
    const mx = (ca[0] + cb[0]) / 2 + (hash2(a, b, 191) - 0.5) * 3, my = (ca[1] + cb[1]) / 2 + (hash2(b, a, 193) - 0.5) * 3;
    out.push({a, b, p: [ca[0], ca[1], mx, my, cb[0], cb[1]], rail: railYear ? railYear(a, b) : Infinity}); }));
  PV2.routes = out; return out;
}
function pv2DrawRoutes(g, s, x0, y0, x1, y1, year, atlas) {
  const vis = r => !(Math.max(r.p[0], r.p[4]) < x0 || Math.min(r.p[0], r.p[4]) > x1 || Math.max(r.p[1], r.p[5]) < y0 || Math.min(r.p[1], r.p[5]) > y1);
  const path = list => { g.beginPath(); list.forEach(r => { g.moveTo(r.p[0], r.p[1]); g.quadraticCurveTo(r.p[2], r.p[3], r.p[4], r.p[5]); }); };
  const R = PV2.routes.filter(vis); if (s < 0.6) return;
  g.save(); g.clip(PV2.landPath);
  path(R.filter(r => !(r.rail <= year))); g.strokeStyle = atlas ? 'rgba(120,70,40,0.55)' : 'rgba(150,110,70,0.55)'; g.lineWidth = Math.max(0.08, 1.1 / s); g.setLineDash([3 / s, 2 / s]); g.stroke(); g.setLineDash([]);
  const rails = R.filter(r => r.rail <= year); path(rails); g.strokeStyle = atlas ? '#2a1d10' : '#141210'; g.lineWidth = Math.max(0.1, 2.8 / s); g.stroke();
  if (s > 1.4) { g.strokeStyle = atlas ? '#ecdfc0' : '#f2ead2'; g.lineWidth = Math.max(0.06, 1.4 / s); g.setLineDash([5 / s, 5 / s]); path(rails); g.stroke(); g.setLineDash([]); }
  g.restore();
}
