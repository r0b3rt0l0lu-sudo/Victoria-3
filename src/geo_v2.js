/* ===== GEOGRAFÍA v2: decodificación de las capas de Natural Earth (geo_v2_data.js, cover_v2_data.js, prov_seeds_v2.js) =====
   geoV2() → {land, seas, lakes, rivers, regions}: cada capa es una lista de Float32Array [lon, lat, lon, lat…] (grados).
   Formato: deltas en centésimas de grado, varint zigzag, base64 (tools/geo_build.py). Todo síncrono: sirve dentro del worker de generación. */
function _b64bytes(s) {
  if (typeof atob === 'function') { const bin = atob(s), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; }
  return new Uint8Array(Buffer.from(s, 'base64'));
}
function geoDecode(layer) {
  const u = _b64bytes(layer.d), out = []; let p = 0;
  const rd = () => { let v = 0, s = 0, b; do { b = u[p++]; v |= (b & 0x7f) << s; s += 7; } while (b & 0x80); return (v >>> 1) ^ -(v & 1); };
  for (const n of layer.n) { const a = new Float32Array(n * 2); let x = 0, y = 0; for (let k = 0; k < n; k++) { x += rd(); y += rd(); a[k * 2] = x / 100; a[k * 2 + 1] = y / 100; } out.push(a); }
  return out;
}
let _GEOV = null;
function geoV2() {
  if (_GEOV) return _GEOV;
  _GEOV = {land: geoDecode(GEO2.land), seas: geoDecode(GEO2.seas), lakes: geoDecode(GEO2.lakes), rivers: geoDecode(GEO2.rivers), regions: geoDecode(GEO2.regions),
    riverOrder: GEO2.rivers.o, riverName: GEO2.rivers.name, lakeName: GEO2.lakes.name, regionType: GEO2.regions.t, regionName: GEO2.regions.name, labels: GEO2.labels};
  return _GEOV;
}
// cubierta del suelo 2048×820 (clases, ver cover_v2_data.js), remuestreada al tamaño del mapa lógico
function coverV2() {
  const u = _b64bytes(COVER2.d), W = COVER2.w, H = COVER2.h, raw = new Uint8Array(W * H); let p = 0, o = 0;
  while (p < u.length && o < raw.length) { const c = u[p++]; let v = 0, s = 0, b; do { b = u[p++]; v |= (b & 0x7f) << s; s += 7; } while (b & 0x80); raw.fill(c, o, o + v); o += v; }
  if (W === MAP_W && H === MAP_H) return raw;
  const out = new Uint8Array(MAP_W * MAP_H);
  for (let y = 0; y < MAP_H; y++) { const sy = Math.min(H - 1, (y * H / MAP_H) | 0); for (let x = 0; x < MAP_W; x++) out[y * MAP_W + x] = raw[sy * W + Math.min(W - 1, (x * W / MAP_W) | 0)]; }
  return out;
}
// semillas de provincias del mapa v1 (ids estables)
function provSeedsV1() {
  if (typeof PROV_SEEDS_V1 === 'undefined') return null;
  const u = _b64bytes(PROV_SEEDS_V1.d), a = new Uint16Array(u.buffer, u.byteOffset, u.byteLength >> 1), out = [];
  for (let k = 0; k < PROV_SEEDS_V1.n; k++) out.push({px: a[k * 3], py: a[k * 3 + 1], s: a[k * 3 + 2]});
  return out;
}
