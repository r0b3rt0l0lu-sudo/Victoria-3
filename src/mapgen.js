/* ===== GENERACIÓN PROCEDURAL DEL MAPA ===== */
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

function rasterLand() {
  const cv = document.createElement('canvas'); cv.width = MAP_W; cv.height = MAP_H;
  const g = cv.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, MAP_W, MAP_H);
  const path = (p) => { g.beginPath(); for (let i = 0; i < p.length; i += 2) { const x = lonToX(p[i]), y = latToY(p[i + 1]); i ? g.lineTo(x, y) : g.moveTo(x, y); } g.closePath(); };
  g.fillStyle = '#000';
  LAND_POLYS.forEach(p => { path(p); g.fill(); });
  g.fillStyle = '#fff';
  SEA_POLYS.forEach(p => { path(p); g.fill(); });
  const d = g.getImageData(0, 0, MAP_W, MAP_H).data;
  const land = new Uint8Array(MAP_W * MAP_H);
  for (let i = 0; i < land.length; i++) land[i] = d[i * 4] < 140 ? 1 : 0;
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

function buildHeight(land) {
  const W = MAP_W, H = MAP_H, N = W * H;
  const dLand = chamfer(land, 1);                       // para tierra: distancia al mar
  const dSea = chamfer(land, 0);                        // para mar: distancia a la tierra
  const h = new Float32Array(N);
  const mount = new Float32Array(N);                    // aporte montañoso
  const kx = W / 360, ky = H / (LAT_TOP - LAT_BOT);
  // cordilleras
  MOUNTAINS.forEach(([pts, r, ht]) => {
    for (let s = 0; s < pts.length - 2; s += 2) {
      const ax = pts[s], ay = pts[s + 1], bx = pts[s + 2], by = pts[s + 3];
      const x0 = Math.max(0, Math.floor(lonToX(Math.min(ax, bx) - r * 3))), x1 = Math.min(W - 1, Math.ceil(lonToX(Math.max(ax, bx) + r * 3)));
      const y0 = Math.max(0, Math.floor(latToY(Math.max(ay, by) + r * 3))), y1 = Math.min(H - 1, Math.ceil(latToY(Math.min(ay, by) - r * 3)));
      const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy || 1e-6;
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const lon = xToLon(x), lat = yToLat(y);
        let t = ((lon - ax) * dx + (lat - ay) * dy) / L2; t = Math.max(0, Math.min(1, t));
        const px = ax + t * dx - lon, py = ay + t * dy - lat;
        const d2 = (px * px + py * py) / (r * r);
        if (d2 > 9) continue;
        const v = ht * Math.exp(-d2) * (0.75 + 0.5 * vnoise(x / 9, y / 9, 3));
        const i = y * W + x; if (v > mount[i]) mount[i] = v;
      }
    }
  });
  PLATEAUS.forEach(([lon, lat, rx, ry, ht]) => {
    const x0 = Math.max(0, Math.floor(lonToX(lon - rx * 2))), x1 = Math.min(W - 1, Math.ceil(lonToX(lon + rx * 2)));
    const y0 = Math.max(0, Math.floor(latToY(lat + ry * 2))), y1 = Math.min(H - 1, Math.ceil(latToY(lat - ry * 2)));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const a = (xToLon(x) - lon) / rx, b = (yToLat(y) - lat) / ry;
      const v = ht * Math.exp(-(a * a + b * b) * 1.2) * (0.8 + 0.4 * vnoise(x / 14, y / 14, 7));
      const i = y * W + x; if (v > mount[i]) mount[i] = v;
    }
  });
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (land[i]) {
      const inland = smooth(0, 38, dLand[i]);
      const n = fbm(x / 70, y / 70, 11, 5);
      const m = mount[i];
      h[i] = 0.10 + 0.25 * inland + (n - 0.5) * (0.35 + 0.5 * Math.min(1, m)) + m + (fbm(x / 12, y / 12, 21, 3) - 0.5) * 0.12 * (0.3 + Math.min(1, m));
      if (h[i] < 0.06) h[i] = 0.06;
    } else {
      h[i] = -0.04 - 0.55 * smooth(0, 60, dSea[i]) - (fbm(x / 90, y / 90, 5, 3) - 0.5) * 0.12;
    }
  }
  MAP.dLand = dLand; MAP.dSea = dSea; MAP.mount = mount;
  return h;
}

function inEllipse(list, lon, lat, wob) {
  for (let k = 0; k < list.length; k++) {
    const e = list[k]; const a = (lon - e[0]) / e[2], b = (lat - e[1]) / e[3];
    if (a * a + b * b + wob < 1) return true;
  }
  return false;
}

function buildBiomes(land, h) {
  const W = MAP_W, H = MAP_H, N = W * H;
  const biome = new Uint8Array(N);
  for (let y = 0; y < H; y++) {
    const lat = yToLat(y);
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (!land[i]) continue;
      const lon = xToLon(x);
      const wob = (fbm(x / 40, y / 40, 31, 4) - 0.5) * 0.9;
      const moist = fbm(x / 110, y / 110, 41, 4);
      const alat = Math.abs(lat);
      const hh = h[i];
      let b = BIOME.GRASS;
      if (inEllipse(STEPPES, lon, lat, wob)) b = BIOME.STEPPE;
      if (alat < 62 && moist > 0.55 && b === BIOME.GRASS && alat > 38) b = BIOME.FOREST;
      if (alat >= 52 && alat < 66 && b !== BIOME.STEPPE && moist > 0.4 && lat > 0) b = BIOME.FOREST;
      if (alat > 62 && lat > 0 || (lat < -50)) b = BIOME.TUNDRA;
      if (alat > 74 || (lon < -20 && lon > -75 && lat > 60 && lat < 84 && (lat > 66 || hh > 1))) b = BIOME.SNOW;
      if (inEllipse(JUNGLES, lon, lat, wob)) b = BIOME.JUNGLE;
      if (alat < 6 && moist > 0.42) b = BIOME.JUNGLE;
      if (inEllipse(DESERTS, lon, lat, wob)) b = BIOME.DESERT;
      if (b === BIOME.GRASS && alat < 35 && moist < 0.38) b = BIOME.STEPPE;
      if (b === BIOME.GRASS && alat < 25 && moist > 0.62) b = BIOME.FOREST;
      if (hh > 1.8) b = BIOME.MOUNTAIN;
      if (hh > 3.4 - alat * 0.02) b = BIOME.SNOW;
      biome[i] = b;
    }
  }
  return biome;
}

function buildTerrainColors(land, h, biome) {
  const W = MAP_W, H = MAP_H;
  const tc = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    const xm = x > 0 ? x - 1 : x, xp = x < W - 1 ? x + 1 : x, ym = y > 0 ? y - 1 : y, yp = y < H - 1 ? y + 1 : y;
    let r, g, b;
    if (land[i]) {
      const c = BIOME_COL[biome[i]];
      const nz = (fbm(x / 6, y / 6, 51, 3) - 0.5) * 26 + (fbm(x / 26, y / 26, 53, 3) - 0.5) * 30;
      r = c[0] + nz; g = c[1] + nz; b = c[2] + nz * 0.8;
      const hh = h[i];
      const mt = smooth(1.1, 2.2, hh), sn = smooth(2.9, 3.8, hh - Math.abs(yToLat(y)) * 0.01);
      const mc = BIOME_COL[BIOME.MOUNTAIN], sc = BIOME_COL[BIOME.SNOW];
      if (biome[i] !== BIOME.SNOW && biome[i] !== BIOME.DESERT) { r += (mc[0] - r) * mt * .8; g += (mc[1] - g) * mt * .8; b += (mc[2] - b) * mt * .8; }
      r += (sc[0] - r) * sn; g += (sc[1] - g) * sn; b += (sc[2] - b) * sn;
      // sombreado de relieve (luz del noroeste)
      const sh = (h[ym * W + xm] - h[yp * W + xp]) * 55 + (h[ym * W + x] - h[yp * W + x]) * 25;
      const k = 1 + Math.max(-0.4, Math.min(0.4, sh * 0.5));
      r *= k; g *= k; b *= k;
    } else {
      const d = MAP.dSea[i];
      const t = smooth(0, 55, d);
      r = 70 + (22 - 70) * t; g = 128 + (52 - 128) * t; b = 150 + (84 - 150) * t;
      const nz = (fbm(x / 20, y / 20, 61, 3) - 0.5) * 10; r += nz; g += nz; b += nz;
      if (d < 2.2) { r += 30; g += 30; b += 24; }      // espuma costera
    }
    const o = i * 4; tc[o] = r; tc[o + 1] = g; tc[o + 2] = b; tc[o + 3] = 255;
  }
  return tc;
}

// Asignación de estados mediante Dijkstra multi-fuente restringido a la tierra
function assignStates(land, h, seeds) {
  const W = MAP_W, H = MAP_H, N = W * H;
  const owner = new Int16Array(N).fill(-1);
  const cost = new Float32Array(N).fill(1e9);
  const wgt = new Float32Array(N);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    wgt[i] = (0.72 + 0.9 * fbm(x / 28, y / 28, 71, 3)) * (1 + Math.max(0, h[i]) * 0.22);
  }
  // montículo binario con claves de coste
  let cap = 1 << 22, hk = new Float32Array(cap), hi = new Int32Array(cap), hs = 0;
  let hl = new Int16Array(cap);
  function push(k, i, s) {
    if (hs >= cap) { cap *= 2; const nk = new Float32Array(cap); nk.set(hk); hk = nk; const ni = new Int32Array(cap); ni.set(hi); hi = ni; const nl = new Int16Array(cap); nl.set(hl); hl = nl; }
    let p = hs++;
    while (p > 0) { const q = (p - 1) >> 1; if (hk[q] <= k) break; hk[p] = hk[q]; hi[p] = hi[q]; hl[p] = hl[q]; p = q; }
    hk[p] = k; hi[p] = i; hl[p] = s;
  }
  let popK = 0, popI = 0, popS = 0;
  function pop() {
    popK = hk[0]; popI = hi[0]; popS = hl[0];
    hs--;
    if (hs > 0) {
      const k = hk[hs], i = hi[hs], s = hl[hs]; let p = 0;
      for (;;) { let c = p * 2 + 1; if (c >= hs) break; if (c + 1 < hs && hk[c + 1] < hk[c]) c++; if (hk[c] >= k) break; hk[p] = hk[c]; hi[p] = hi[c]; hl[p] = hl[c]; p = c; }
      hk[p] = k; hi[p] = i; hl[p] = s;
    }
  }
  seeds.forEach((s, id) => { const i = s.py * W + s.px; cost[i] = 0; owner[i] = id; push(0, i, id); });
  while (hs > 0) {
    pop(); const i = popI, c = popK, s = popS;
    if (c > cost[i]) continue;
    const x = i % W, y = (i / W) | 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const j = ny * W + nx; if (!land[j]) continue;
      const nc = c + (dx && dy ? 1.4142 : 1) * wgt[j];
      if (nc < cost[j]) { cost[j] = nc; owner[j] = s; push(nc, j, s); }
    }
  }
  // islas sin semilla: asignar a la semilla más cercana
  const seen = new Uint8Array(N);
  const stack = new Int32Array(N);
  for (let i0 = 0; i0 < N; i0++) {
    if (!land[i0] || owner[i0] >= 0 || seen[i0]) continue;
    let sp = 0, cnt = 0, sx = 0, sy = 0; const comp = [];
    stack[sp++] = i0; seen[i0] = 1;
    while (sp) {
      const i = stack[--sp]; comp.push(i); const x = i % W, y = (i / W) | 0; cnt++; sx += x; sy += y;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const j = ny * W + nx; if (land[j] && owner[j] < 0 && !seen[j]) { seen[j] = 1; stack[sp++] = j; }
      }
    }
    const cx = sx / cnt, cy = sy / cnt; let best = 0, bd = 1e12;
    seeds.forEach((s, id) => { const d = (s.px - cx) ** 2 + (s.py - cy) ** 2; if (d < bd) { bd = d; best = id; } });
    for (let k = 0; k < comp.length; k++) owner[comp[k]] = best;
  }
  return owner;
}

function buildMap() {
  const t0 = performance.now();
  const W = MAP_W, H = MAP_H, N = W * H;
  const land = rasterLand();
  MAP.land = land;
  const h = buildHeight(land);
  MAP.height = h;
  MAP.biome = buildBiomes(land, h);
  MAP.terrainCol = buildTerrainColors(land, h, MAP.biome);

  // semillas de estados
  const lines = STATE_DATA.split('\n');
  const seeds = [];
  lines.forEach(line => {
    const f = line.split('|');
    let px = Math.round(lonToX(+f[1])), py = Math.round(latToY(+f[2]));
    px = Math.max(0, Math.min(W - 1, px)); py = Math.max(0, Math.min(H - 1, py));
    if (!land[py * W + px]) {
      let found = false;
      for (let r = 1; r < 60 && !found; r++) {
        for (let dy = -r; dy <= r && !found; dy++) for (let dx = -r; dx <= r && !found; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const x = px + dx, y = py + dy; if (x < 0 || y < 0 || x >= W || y >= H) continue;
          if (land[y * W + x]) { px = x; py = y; found = true; }
        }
      }
      if (!found) console.warn('Estado sin tierra:', f[0]);
    }
    seeds.push({name: f[0], px, py, owner: f[3], pop: +f[4] || 0, res: f[5] || ''});
  });
  MAP.seeds = seeds;
  MAP.stateOf = assignStates(land, h, seeds);

  // métricas por estado
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
  // listas de píxeles por estado
  const off = new Int32Array(S + 1);
  for (let s = 0; s < S; s++) off[s + 1] = off[s] + st[s].area;
  const pos = off.slice(0, S), order = new Int32Array(off[S]);
  for (let i = 0; i < N; i++) if (land[i]) order[pos[so[i]]++] = i;
  MAP.pixOff = off; MAP.pixOrder = order;
  MAP.edge = new Uint8Array(N);
  console.log('Mapa generado en', Math.round(performance.now() - t0), 'ms; estados:', S);
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
function computeFrontRank(sid, sideTags) {
  if (!MAP.pxRank) { MAP.pxRank = new Float32Array(MAP_W * MAP_H).fill(-1); MAP.rankFor = {}; }
  const key = [...sideTags].sort().join(',');
  if (MAP.rankFor[sid] === key) return;
  const W = MAP_W, so = MAP.stateOf, land = MAP.land, rank = MAP.pxRank;
  const off = MAP.pixOff, ord = MAP.pixOrder;
  const n = off[sid + 1] - off[sid]; if (!n) return;
  const owner = G.S.map(s => s.owner);
  const dist = new Int32Array(n).fill(-1);
  const idxOf = new Map(); for (let k = 0; k < n; k++) idxOf.set(ord[off[sid] + k], k);
  const queue = new Int32Array(n); let qh = 0, qt = 0;
  const nb = [1, -1, W, -W];
  for (let k = 0; k < n; k++) {
    const i = ord[off[sid] + k]; let seed = false;
    for (let d = 0; d < 4 && !seed; d++) { const j = i + nb[d]; if (j < 0 || j >= land.length || !land[j]) continue; const t = so[j]; if (t !== sid && sideTags.has(owner[t])) seed = true; }
    if (seed) { dist[k] = 0; queue[qt++] = k; }
  }
  if (qt === 0) { // sin frontera terrestre: desembarco desde la costa
    for (let k = 0; k < n; k++) if (MAP.dLand[ord[off[sid] + k]] < 3) { dist[k] = 0; queue[qt++] = k; }
  }
  if (qt === 0) { for (let k = 0; k < n; k++) { dist[k] = 0; queue[qt++] = k; } }
  const nb8 = [1, -1, W, -W, W + 1, W - 1, -W + 1, -W - 1];
  let mx = 1;
  while (qh < qt) {
    const k = queue[qh++]; const i = ord[off[sid] + k];
    for (let d = 0; d < 8; d++) { const j = i + nb8[d]; const kk = idxOf.get(j); if (kk !== undefined && dist[kk] < 0) { dist[kk] = dist[k] + 1; if (dist[kk] > mx) mx = dist[kk]; queue[qt++] = kk; } }
  }
  for (let k = 0; k < n; k++) rank[ord[off[sid] + k]] = (dist[k] < 0 ? mx : dist[k]) / mx;
  MAP.rankFor[sid] = key;
}
