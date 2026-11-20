/* ===== GENERACIÓN DEL MAPA v2 (mapa_v2): costas, lagos y ríos de Natural Earth, relieve real, biomas por cubierta del suelo y fronteras orgánicas =====
   Sustituye a src/mapgen.js. Depende de geo_v2.js + geo_v2_data.js + cover_v2_data.js (+ prov_seeds_v2.js), elev_data.js y de STATE_DATA (geo.js). */
const MAP = {};   // se rellena en buildMap()

function hash2(x, y, s) {
  let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
  h = (h ^ (h >>> 13)) * 1274126177 | 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
function vnoise(x, y, s) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi, s), b = hash2(xi + 1, yi, s), c = hash2(xi, yi + 1, s), d = hash2(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, y, s, oct) {
  let a = 0.5, f = 1, sum = 0, norm = 0;
  for (let i = 0; i < (oct || 5); i++) { sum += a * vnoise(x * f, y * f, s + i * 17); norm += a; a *= 0.5; f *= 2.03; }
  return sum / norm;
}
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lonToX = lon => (lon + 180) / 360 * MAP_W;
const latToY = lat => (LAT_TOP - lat) / (LAT_TOP - LAT_BOT) * MAP_H;
const xToLon = x => x / MAP_W * 360 - 180;
const yToLat = y => LAT_TOP - y / MAP_H * (LAT_TOP - LAT_BOT);

const BIOME = {OCEAN:0, GRASS:1, FOREST:2, DESERT:3, STEPPE:4, TUNDRA:5, JUNGLE:6, MOUNTAIN:7, SNOW:8};
const BIOME_COL = [[0,0,0],[122,148,86],[70,106,66],[218,194,138],[170,166,104],[152,162,142],[50,106,68],[132,122,108],[234,238,242]];


/* ---------- v2: tierra a partir de los contornos de Natural Earth ---------- */
// Se rasteriza con antialias y umbral del 45 % de cobertura; las islas menores que un píxel que contienen la semilla de un estado,
// o cuya superficie es ≥ 0,3 píxeles, conservan al menos un píxel (para que ninguna isla con nombre desaparezca).
function _ring(g, a) { for (let k = 0; k < a.length; k += 2) { const x = lonToX(a[k]), y = latToY(a[k + 1]); k ? g.lineTo(x, y) : g.moveTo(x, y); } g.closePath(); }
function rasterLand() {
  const geo = geoV2(), W = MAP_W, H = MAP_H, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d', {willReadFrequently: true});
  g.fillStyle = '#000'; g.fillRect(0, 0, W, H); g.fillStyle = '#fff';
  g.beginPath(); geo.land.forEach(a => _ring(g, a)); g.fill('nonzero');
  g.fillStyle = '#000'; g.beginPath(); geo.seas.forEach(a => _ring(g, a)); geo.lakes.forEach(a => _ring(g, a)); g.fill('nonzero');
  const d = g.getImageData(0, 0, W, H).data, land = new Uint8Array(W * H);
  for (let i = 0; i < land.length; i++) land[i] = d[i * 4] >= 115 ? 1 : 0;
  // islotes: un píxel como mínimo
  let kept = 0;
  geo.land.forEach(a => {
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9, A = 0, cx = 0, cy = 0;
    for (let k = 0; k < a.length; k += 2) { const x = lonToX(a[k]), y = latToY(a[k + 1]); if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      const k2 = (k + 2) % a.length, xb = lonToX(a[k2]), yb = latToY(a[k2 + 1]), c = x * yb - xb * y; A += c; cx += (x + xb) * c; cy += (y + yb) * c; }
    if (x1 - x0 > 3 && y1 - y0 > 3) return;
    A /= 2; if (Math.abs(A) < 0.3) return; const px = Math.min(W - 1, Math.max(0, Math.floor(Math.abs(A) > 1e-6 ? cx / (6 * A) : (x0 + x1) / 2))), py = Math.min(H - 1, Math.max(0, Math.floor(Math.abs(A) > 1e-6 ? cy / (6 * A) : (y0 + y1) / 2)));
    if (!land[py * W + px]) { land[py * W + px] = 1; kept++; }
  });
  MAP.islandsKept = kept;
  return land;
}

// Distancia (chamfer) al límite tierra/mar
function chamfer(mask, target) {
  const W = MAP_W, H = MAP_H, N = W * H, INF = 1e6;
  const dist = new Float32Array(N);
  for (let i = 0; i < N; i++) dist[i] = mask[i] === target ? INF : 0;
  const a = 1, b = 1.4142;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x; let d = dist[i]; if (d === 0) continue;
    if (x > 0) d = Math.min(d, dist[i - 1] + a);
    if (y > 0) { d = Math.min(d, dist[i - W] + a); if (x > 0) d = Math.min(d, dist[i - W - 1] + b); if (x < W - 1) d = Math.min(d, dist[i - W + 1] + b); }
    dist[i] = d;
  }
  for (let y = H - 1; y >= 0; y--) for (let x = W - 1; x >= 0; x--) {
    const i = y * W + x; let d = dist[i]; if (d === 0) continue;
    if (x < W - 1) d = Math.min(d, dist[i + 1] + a);
    if (y < H - 1) { d = Math.min(d, dist[i + W] + a); if (x < W - 1) d = Math.min(d, dist[i + W + 1] + b); if (x > 0) d = Math.min(d, dist[i + W - 1] + b); }
    dist[i] = d;
  }
  return dist;
}

/* ---------- v2: altura de juego a partir de la elevación real (ELEV, 512×205) ---------- */
// MAP.height conserva su escala: ~0,1–0,4 llanuras, > 1,8 montaña, > 3,4 − 0,02·|lat| nieve; mar < 0.
// Además MAP.elevM (metros, Float32) y MAP.slope (m/píxel) para el reparto de estados y la pintura.
let _ELEVU = null;
function _elevArrays() { if (_ELEVU) return _ELEVU; const dec = v => v instanceof Uint8Array ? v : _b64bytes(v); _ELEVU = {m: dec(ELEV.m), r: dec(ELEV.r)}; return _ELEVU; }   // base64 (archivo único) o binario (web por carpetas)
function elevMeters(x, y) {   // x, y en píxeles del mapa lógico → {m, r} en metros (bilineal)
  const E = _elevArrays(), fx = (x + 0.5) * ELEV.w / MAP_W - 0.5, fy = Math.min(ELEV.h - 1.001, Math.max(0, (y + 0.5) * ELEV.h / MAP_H - 0.5)), x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
  const g = (arr, i, j) => arr[j * ELEV.w + ((i % ELEV.w) + ELEV.w) % ELEV.w];
  const bil = arr => (g(arr, x0, y0) * (1 - tx) + g(arr, x0 + 1, y0) * tx) * (1 - ty) + (g(arr, x0, y0 + 1) * (1 - tx) + g(arr, x0 + 1, y0 + 1) * tx) * ty;
  return {m: bil(E.m) * 25, r: bil(E.r) * 10};
}
function buildHeight(land) {
  const W = MAP_W, H = MAP_H, N = W * H;
  const dLand = chamfer(land, 1), dSea = chamfer(land, 0);
  const h = new Float32Array(N), em = new Float32Array(N), mount = new Float32Array(N);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (land[i]) {
      const e = elevMeters(x, y); let m = e.m;
      if (m < 8) m = 8 + Math.min(1, dLand[i] / 6) * 40;                            // la costa real y la malla de 0,7° no coinciden: orilla baja
      const rough = Math.max(e.r, m * 0.05), n = fbm(x / 9, y / 9, 21, 3) - 0.5, ridge = 1 - Math.abs(2 * fbm(x / 22, y / 22, 79, 3) - 1);
      m = Math.max(2, m + n * rough * 1.6 + (ridge - 0.55) * rough * 1.2);
      em[i] = m; const k = Math.pow(m / 1000, 0.85);
      h[i] = 0.08 + 0.18 * smooth(0, 30, dLand[i]) + 1.15 * k; mount[i] = Math.max(0, 1.15 * k - 0.6);
    } else h[i] = -0.04 - 0.55 * smooth(0, 60, dSea[i]) - (fbm(x / 90, y / 90, 5, 3) - 0.5) * 0.12;
  }
  const slope = new Float32Array(N);
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) { const i = y * W + x; if (!land[i]) continue; slope[i] = Math.hypot(em[i + 1] - em[i - 1], em[i + W] - em[i - W]) * 0.5; }
  MAP.dLand = dLand; MAP.dSea = dSea; MAP.mount = mount; MAP.elevM = em; MAP.slope = slope;
  return h;
}

/* ---------- v2: biomas a partir de la cubierta del suelo de Natural Earth + altitud + latitud ---------- */
const COVER_TO_BIOME = [0, 1, 2, 3, 4, 5, 6, 1, 8];
function buildBiomes(land, h) {
  const W = MAP_W, H = MAP_H, N = W * H, cov = coverV2(), biome = new Uint8Array(N), em = MAP.elevM;
  for (let y = 0; y < H; y++) {
    const lat = yToLat(y), alat = Math.abs(lat);
    for (let x = 0; x < W; x++) {
      const i = y * W + x; if (!land[i]) continue;
      let b = COVER_TO_BIOME[cov[i]] || BIOME.GRASS;
      if (cov[i] === 0) b = alat > 66 ? BIOME.TUNDRA : alat < 10 ? BIOME.JUNGLE : BIOME.GRASS;     // costa de la máscara sin dato de cubierta
      const moist = fbm(x / 60, y / 60, 41, 4);
      // bosques templados de 1836–1945 (más extensos que en la cubierta actual, que muestra campos de cultivo)
      if (b === BIOME.GRASS && alat > 40 && alat < 64 && moist > 0.56) b = BIOME.FOREST;
      if (b === BIOME.GRASS && alat < 12 && moist > 0.6) b = BIOME.JUNGLE;
      const m = em[i], snowLine = alat < 30 ? 4800 : 4800 - (alat - 30) * 85;
      if (m > 1700 + Math.max(0, 30 - alat) * 15 && b !== BIOME.SNOW) b = BIOME.MOUNTAIN;
      if (m > snowLine) b = BIOME.SNOW;
      if (alat > 78) b = BIOME.SNOW;
      biome[i] = b;
    }
  }
  MAP.cover = cov;
  return biome;
}

/* ---------- colores del terreno (2048×820, compatibilidad con render.js) ---------- */
// La pintura de calidad está en pintura_v2.js (teselas, relieve sombreado de Natural Earth); aquí solo el color base del mapa lógico.
function buildTerrainColors(land, h, biome) {
  const W = MAP_W, H = MAP_H, tc = new Uint8ClampedArray(W * H * 4), em = MAP.elevM;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, xm = x > 0 ? x - 1 : x, xp = x < W - 1 ? x + 1 : x, ym = y > 0 ? y - 1 : y, yp = y < H - 1 ? y + 1 : y;
    let r, g, b;
    if (land[i]) {
      const c = BIOME_COL[biome[i]], nz = (fbm(x / 6, y / 6, 51, 3) - 0.5) * 18 + (fbm(x / 26, y / 26, 53, 3) - 0.5) * 20;
      r = c[0] + nz; g = c[1] + nz; b = c[2] + nz * 0.8;
      const sh = ((em[ym * W + xm] || em[i]) - (em[yp * W + xp] || em[i])) * 0.0011;
      const k = 1 + Math.max(-0.35, Math.min(0.35, sh)); r *= k; g *= k; b *= k;
    } else {
      const d = MAP.dSea[i], t = smooth(0, 55, d);
      r = 70 + (22 - 70) * t; g = 128 + (52 - 128) * t; b = 150 + (84 - 150) * t;
      if (d < 2.2) { r += 30; g += 30; b += 24; }
    }
    const o = i * 4; tc[o] = r; tc[o + 1] = g; tc[o + 2] = b; tc[o + 3] = 255;
  }
  addRivers(tc, land, h);
  return tc;
}

/* ---------- v2: ríos reales (Natural Earth 1:50m) ---------- */
// MAP.riverPaths: listas de píxeles de tierra de la fuente a la desembocadura (como en v1). Nuevo: MAP.riverOrder (1–6), MAP.riverName,
// MAP.riverVec (polilíneas en grados, misma orientación) y MAP.riverMask (orden máximo por píxel).
function addRivers(tc, land, h) {
  const geo = geoV2(), W = MAP_W, H = MAP_H, mask = new Uint8Array(W * H), em = MAP.elevM, dL = MAP.dLand;
  MAP.riverPaths = []; MAP.riverOrder = []; MAP.riverName = []; MAP.riverVec = [];
  const elevAtPx = (x, y) => { const xi = Math.max(0, Math.min(W - 1, x | 0)), yi = Math.max(0, Math.min(H - 1, y | 0)), i = yi * W + xi; return land[i] ? em[i] + dL[i] * 2 : -50; };
  geo.rivers.forEach((a, r) => {
    const n = a.length / 2; if (n < 2) return;
    // orientar río abajo: el extremo más bajo (o en el mar) es la desembocadura
    const e0 = elevAtPx(lonToX(a[0]), latToY(a[1])), e1 = elevAtPx(lonToX(a[a.length - 2]), latToY(a[a.length - 1]));
    let pts = a; if (e0 < e1) { pts = new Float32Array(a.length); for (let k = 0; k < n; k++) { pts[k * 2] = a[(n - 1 - k) * 2]; pts[k * 2 + 1] = a[(n - 1 - k) * 2 + 1]; } }
    const path = []; let last = -1;
    for (let k = 0; k < n - 1; k++) {
      const x0 = lonToX(pts[k * 2]), y0 = latToY(pts[k * 2 + 1]), x1 = lonToX(pts[k * 2 + 2]), y1 = latToY(pts[k * 2 + 3]), st = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * 2));
      for (let s = 0; s <= st; s++) { const x = Math.floor(x0 + (x1 - x0) * s / st), y = Math.floor(y0 + (y1 - y0) * s / st); if (x < 0 || y < 0 || x >= W || y >= H) continue; const i = y * W + x;
        if (i !== last) { if (last >= 0 && (last % W) !== x && ((last / W) | 0) !== y) { const c = ((last / W) | 0) * W + x; if (land[c]) path.push(c); }   // 4-conexo: sin huecos en diagonal
          last = i; if (land[i]) path.push(i); } }
    }
    if (path.length < 3) return;
    const o = geo.riverOrder[r]; path.forEach(i => { if (o > mask[i]) mask[i] = o; });
    MAP.riverPaths.push(path); MAP.riverOrder.push(o); MAP.riverName.push(geo.riverName[r]); MAP.riverVec.push(pts);
    path.forEach((i, k) => { const t = 0.08 + 0.04 * o, q = i * 4; tc[q] += (62 - tc[q]) * t; tc[q + 1] += (118 - tc[q + 1]) * t; tc[q + 2] += (170 - tc[q + 2]) * t; });
  });
  MAP.riverMask = mask; MAP.rivers = MAP.riverPaths.length;
}

/* ---------- v2: reparto de estados con coste anisótropo ---------- */
// Dijkstra multifuente desde las 380 semillas, solo por tierra. El coste de entrar en un píxel crece con la pendiente (las cordilleras
// frenan el avance y la frontera queda en la cresta) y es mucho mayor en los ríos de orden ≥ 3 (los frentes se detienen en la orilla y
// la frontera sigue el río). Las islas sin semilla se asignan al estado más cercano por mar.
const STATE_COST = {base: 1, noise: 0.22, slope: 1 / 70, slopeMax: 9, alt: 0.6, river: [0, 0, 3, 28, 42, 56, 70]};
function assignStates(land, h, seeds, bias) {
  if (bias === undefined && typeof STATE_BIAS_V2 !== 'undefined' && STATE_BIAS_V2.length === seeds.length) bias = STATE_BIAS_V2;
  const W = MAP_W, H = MAP_H, N = W * H, C = STATE_COST, rm = MAP.riverMask, sl = MAP.slope, em = MAP.elevM;
  const owner = new Int16Array(N).fill(-1), cost = new Float32Array(N).fill(1e9), wgt = new Float32Array(N);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x; if (!land[i]) continue;
    const lat = Math.cos(yToLat(y) * Math.PI / 180);                                           // equirrectangular: a latitudes altas un píxel mide menos
    wgt[i] = (C.base + C.noise * (fbm(x / 28, y / 28, 71, 3) - 0.5)) * (0.55 + 0.45 * lat) + Math.min(C.slopeMax, sl[i] * C.slope) + C.alt * em[i] / 1000 + C.river[rm[i]];
  }
  let cap = 1 << 22, hk = new Float32Array(cap), hi = new Int32Array(cap), hl = new Int16Array(cap), hs = 0;
  function push(k, i, s) {
    if (hs >= cap) { cap *= 2; const nk = new Float32Array(cap); nk.set(hk); hk = nk; const ni = new Int32Array(cap); ni.set(hi); hi = ni; const nl = new Int16Array(cap); nl.set(hl); hl = nl; }
    let p = hs++;
    while (p > 0) { const q = (p - 1) >> 1; if (hk[q] <= k) break; hk[p] = hk[q]; hi[p] = hi[q]; hl[p] = hl[q]; p = q; }
    hk[p] = k; hi[p] = i; hl[p] = s;
  }
  let popK = 0, popI = 0, popS = 0;
  function pop() {
    popK = hk[0]; popI = hi[0]; popS = hl[0]; hs--;
    if (hs > 0) { const k = hk[hs], i = hi[hs], s = hl[hs]; let p = 0;
      for (;;) { let c = p * 2 + 1; if (c >= hs) break; if (c + 1 < hs && hk[c + 1] < hk[c]) c++; if (hk[c] >= k) break; hk[p] = hk[c]; hi[p] = hi[c]; hl[p] = hl[c]; p = c; }
      hk[p] = k; hi[p] = i; hl[p] = s; }
  }
  // sesgo por estado (STATE_BIAS_V2, calibrado con tools/calibrar_estados.js para que cada estado conserve aprox. su superficie de v1)
  const lock = new Uint8Array(N); seeds.forEach((s, id) => { const i = s.py * W + s.px, b = bias ? bias[id] : 0; cost[i] = b; owner[i] = id; lock[i] = 1; push(b, i, id); });
  while (hs > 0) {
    pop(); const i = popI, c = popK, s = popS; if (c > cost[i]) continue;
    const x = i % W, y = (i / W) | 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      let nx = x + dx; const ny = y + dy; if (ny < 0 || ny >= H) continue;
      if (nx < 0) nx = W - 1; else if (nx >= W) nx = 0;                                           // el mapa da la vuelta en ±180° (Chukotka–Alaska no, pero sí Rusia/Fiyi)
      const j = ny * W + nx; if (!land[j] || lock[j]) continue;
      const nc = c + (dx && dy ? 1.4142 : 1) * wgt[j];
      if (nc < cost[j]) { cost[j] = nc; owner[j] = s; push(nc, j, s); }
    }
  }
  // islas sin semilla: estado más cercano por mar (BFS multifuente desde toda la tierra asignada, cruzando el agua)
  const q = new Int32Array(N), lab = new Int16Array(N).fill(-1); let qh = 0, qt = 0;
  for (let i = 0; i < N; i++) if (owner[i] >= 0) { lab[i] = owner[i]; q[qt++] = i; }
  let orphan = 0; for (let i = 0; i < N; i++) if (land[i] && owner[i] < 0) orphan++;
  MAP.orphanPx = orphan;
  if (orphan) {
    while (qh < qt) { const i = q[qh++], x = i % W; const nb = [x > 0 ? i - 1 : i + W - 1, x < W - 1 ? i + 1 : i - W + 1, i - W, i + W];
      for (const j of nb) { if (j < 0 || j >= N || lab[j] >= 0) continue; lab[j] = lab[i]; q[qt++] = j; } }
    for (let i = 0; i < N; i++) if (land[i] && owner[i] < 0) owner[i] = lab[i];
  }
  MAP.stateCost = cost;
  return owner;
}

function buildMap() {
  const t0 = performance.now(), T = {};
  const W = MAP_W, H = MAP_H, N = W * H;
  let t = performance.now(); const land = rasterLand(); MAP.land = land; T.tierra = performance.now() - t;
  t = performance.now(); const h = buildHeight(land); MAP.height = h; T.altura = performance.now() - t;
  t = performance.now(); MAP.biome = buildBiomes(land, h); T.biomas = performance.now() - t;
  t = performance.now(); MAP.terrainCol = buildTerrainColors(land, h, MAP.biome); T.colorRios = performance.now() - t;
  // semillas de estados (mismo orden y nombres que STATE_DATA). Si la coordenada cae en el agua o en un islote mientras hay una masa de
  // tierra mayor a ≤ 6 píxeles, la semilla se mueve a esa masa (p. ej. Dinamarca: 10,5° E 56° N cae en la bahía de Aarhus).
  const comp = new Int32Array(N).fill(-1), csize = [], stk = new Int32Array(N);
  for (let i0 = 0; i0 < N; i0++) { if (!land[i0] || comp[i0] >= 0) continue; const c = csize.length; let sp = 0, n = 0; stk[sp++] = i0; comp[i0] = c;
    while (sp) { const i = stk[--sp], x = i % W; n++; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const nx = x + dx, j = i + dx + dy * W; if (nx < 0 || nx >= W || j < 0 || j >= N || !land[j] || comp[j] >= 0) continue; comp[j] = c; stk[sp++] = j; } }
    csize.push(n); }
  const seeds = [], missing = [];
  STATE_DATA.split('\n').forEach(line => {
    const f = line.split('|');
    let px = Math.max(0, Math.min(W - 1, Math.round(lonToX(+f[1])))), py = Math.max(0, Math.min(H - 1, Math.round(latToY(+f[2]))));
    const i0 = py * W + px, here = land[i0] ? csize[comp[i0]] : 0;
    if (here < 60) {
      let best = -1, bs = -1e18;
      for (let r = 1; r <= 60 && (best < 0 || r <= 6); r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const x = px + dx, y = py + dy; if (x < 0 || y < 0 || x >= W || y >= H) continue; const j = y * W + x; if (!land[j]) continue;
        const sc = Math.log(csize[comp[j]] + 1) * 4 - Math.hypot(dx, dy) - (MAP.dLand && false ? 0 : 0);
        if (sc > bs) { bs = sc; best = j; }
      }
      if (best >= 0 && (here === 0 || csize[comp[best]] > here * 4)) { px = best % W; py = (best / W) | 0; }
      else if (!here) { missing.push(f[0]); console.warn('Estado sin tierra:', f[0]); }
    }
    // un píxel tierra adentro para que la semilla no quede en la orilla
    seeds.push({name: f[0], px, py, owner: f[3], pop: +f[4] || 0, res: f[5] || '', parent: f[6] || ''});
  });
  MAP.seeds = seeds; MAP.seedsMissing = missing;
  t = performance.now(); MAP.stateOf = assignStates(land, h, seeds); T.estados = performance.now() - t;
  const S = seeds.length;
  const st = seeds.map(() => ({area: 0, sx: 0, sy: 0, x0: W, x1: 0, y0: H, y1: 0, biomes: new Float32Array(9), coast: 0, neigh: new Set()}));
  const so = MAP.stateOf;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x; if (!land[i]) continue;
    const s = st[so[i]]; s.area++; s.sx += x; s.sy += y;
    if (x < s.x0) s.x0 = x; if (x > s.x1) s.x1 = x; if (y < s.y0) s.y0 = y; if (y > s.y1) s.y1 = y;
    s.biomes[MAP.biome[i]]++;
    if (MAP.dLand[i] < 2.5) s.coast++;
    if (x < W - 1 && land[i + 1] && so[i + 1] !== so[i]) { s.neigh.add(so[i + 1]); st[so[i + 1]].neigh.add(so[i]); }
    if (y < H - 1 && land[i + W] && so[i + W] !== so[i]) { s.neigh.add(so[i + W]); st[so[i + W]].neigh.add(so[i]); }
  }
  MAP.stats = st;
  const off = new Int32Array(S + 1);
  for (let s = 0; s < S; s++) off[s + 1] = off[s] + st[s].area;
  const pos = off.slice(0, S), order = new Int32Array(off[S]);
  for (let i = 0; i < N; i++) if (land[i]) order[pos[so[i]]++] = i;
  MAP.pixOff = off; MAP.pixOrder = order;
  MAP.edge = new Uint8Array(N);
  t = performance.now(); buildProvinces(); T.provincias = performance.now() - t;
  t = performance.now(); if (typeof buildBorderLines === 'function') buildBorderLines(); T.bordes = performance.now() - t;
  MAP.genMs = Math.round(performance.now() - t0); MAP.genT = T; MAP.v = 2;
  console.log('Mapa v2 generado en', MAP.genMs, 'ms; estados:', S, '; provincias:', MAP.provs.length);
}

// Bordes de estado (1) y de país (2). owners: array estado->id de país (0 = sin dueño)
function computeEdges(ownerOf) {
  const W = MAP_W, H = MAP_H, land = MAP.land, so = MAP.stateOf, e = MAP.edge;
  e.fill(0);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x; if (!land[i]) continue;
    const a = so[i];
    if (x < W - 1 && land[i + 1]) { const b = so[i + 1]; if (a !== b) { const t = ownerOf[a] !== ownerOf[b] ? 2 : 1; if (t > e[i]) e[i] = t; if (t > e[i + 1]) e[i + 1] = t; } }
    if (y < H - 1 && land[i + W]) { const b = so[i + W]; if (a !== b) { const t = ownerOf[a] !== ownerOf[b] ? 2 : 1; if (t > e[i]) e[i] = t; if (t > e[i + W]) e[i + W] = t; } }
  }
}


// Distancia normalizada (0 = entrada del invasor, 1 = fondo del estado) para dibujar el frente de guerra

