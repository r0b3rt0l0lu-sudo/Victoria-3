/* Núcleos numéricos del juego en WebAssembly (sin libc). Reproducen BIT A BIT las versiones de JS de src/mapgen.js
   (mismos operadores en f64, sin FMA ni reasociación): el mundo generado es idéntico con o sin WebAssembly.
   Compilar: clang --target=wasm32 -O3 -ffp-contract=off -nostdlib -Wl,--no-entry -Wl,--export-dynamic ... (ver tools/compilar_wasm.sh) */
typedef unsigned char u8; typedef signed int i32; typedef unsigned int u32; typedef long long i64; typedef double f64; typedef float f32;
#define EXPORT __attribute__((export_name(#__VA_ARGS__)))
static inline i32 toint32(f64 v) { return (i32)(u32)(i64)v; }                 // ToInt32 de JS (los valores caben en i64)
static inline f64 hash2(f64 x, f64 y, f64 s) {
  i32 h = toint32(x * 374761393.0 + y * 668265263.0 + s * 2147483647.0);
  h = toint32((f64)(h ^ (i32)((u32)h >> 13)) * 1274126177.0);
  return (f64)((u32)(h ^ (i32)((u32)h >> 16))) / 4294967295.0;
}
static inline f64 vnoise(f64 x, f64 y, f64 s) {
  f64 xi = __builtin_floor(x), yi = __builtin_floor(y), xf = x - xi, yf = y - yi;
  f64 u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  f64 a = hash2(xi, yi, s), b = hash2(xi + 1, yi, s), c = hash2(xi, yi + 1, s), d = hash2(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
static f64 fbm(f64 x, f64 y, f64 s, i32 oct) {
  f64 a = 0.5, f = 1, sum = 0, norm = 0;
  for (i32 i = 0; i < oct; i++) { sum += a * vnoise(x * f, y * f, s + i * 17); norm += a; a *= 0.5; f *= 2.03; }
  return sum / norm;
}

/* Ruido fbm con caché de la retícula: los valores hash2 de cada octava se calculan una vez por fila de retícula y se reutilizan en los píxeles vecinos.
   Es exactamente la misma función que fbm(x/d, y/d, s, oct) (los mismos hash2 y las mismas operaciones), solo que sin recalcular lo ya calculado. */
#define MAXN 4096
static f64 POOL[24][2][MAXN]; static i32 PUSED;
typedef struct { f64 d, s; i32 oct, slot, cy[6], nx[6]; f64 f[6]; } NZ;
static void nz_init(NZ *n, f64 d, f64 s, i32 oct, i32 W) {
  n->d = d; n->s = s; n->oct = oct; n->slot = PUSED; PUSED += oct; f64 f = 1;
  for (i32 i = 0; i < oct; i++) { n->f[i] = f; n->nx[i] = (i32)__builtin_floor(((f64)(W - 1) / d) * f) + 3; if (n->nx[i] > MAXN) n->nx[i] = MAXN; n->cy[i] = -2147483647; f *= 2.03; }
}
static void nz_row(NZ *n, i32 i, f64 *row, i32 yi) { f64 si = n->s + i * 17; for (i32 k = 0; k < n->nx[i]; k++) row[k] = hash2((f64)k, (f64)yi, si); }
static f64 nz_eval(NZ *n, i32 x, i32 y) {
  f64 a = 0.5, sum = 0, norm = 0, X0 = x / n->d, Y0 = y / n->d;
  for (i32 i = 0; i < n->oct; i++) {
    f64 f = n->f[i], X = X0 * f, Y = Y0 * f, xi = __builtin_floor(X), yi = __builtin_floor(Y), xf = X - xi, yf = Y - yi; i32 ix = (i32)xi, iy = (i32)yi;
    f64 *r0 = POOL[n->slot + i][0], *r1 = POOL[n->slot + i][1];
    if (iy != n->cy[i]) {
      if (iy == n->cy[i] + 1) { for (i32 k = 0; k < n->nx[i]; k++) r0[k] = r1[k]; nz_row(n, i, r1, iy + 1); }
      else { nz_row(n, i, r0, iy); nz_row(n, i, r1, iy + 1); }
      n->cy[i] = iy;
    }
    f64 u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), A = r0[ix], B = r0[ix + 1], C = r1[ix], D = r1[ix + 1];
    f64 vn = A + (B - A) * u + (C - A) * v + (A - B - C + D) * u * v;
    sum += a * vn; norm += a; a *= 0.5;
  }
  return sum / norm;
}
static inline f64 fmax2(f64 a, f64 b) { return a != a || b != b ? (f64)__builtin_nan("") : (a > b ? a : (b > a ? b : (a == 0 && b == 0 ? (__builtin_signbit(a) ? b : a) : a))); }
static inline f64 fmin2(f64 a, f64 b) { return a != a || b != b ? (f64)__builtin_nan("") : (a < b ? a : (b < a ? b : (a == 0 && b == 0 ? (__builtin_signbit(a) ? a : b) : a))); }
static inline f64 smooth(f64 a, f64 b, f64 x) { f64 t = fmax2(0, fmin2(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); }
static const f64 LAT_TOP = 84, LAT_BOT = -60;
static inline f64 yToLat(f64 y, f64 H) { return LAT_TOP - y / H * (LAT_TOP - LAT_BOT); }
static inline f64 xToLon(f64 x, f64 W) { return x / W * 360 - 180; }
static inline f64 absd(f64 v) { return __builtin_fabs(v); }
static inline u8 clamp8(f64 v) { if (!(v > 0)) return 0; if (v >= 255) return 255; return (u8)__builtin_rint(v); }   // Uint8ClampedArray: redondeo al par

/* altura final: tierra (con montañas ya acumuladas en mount) y fondo marino */
__attribute__((export_name("k_height")))
void k_height(i32 W, i32 H, const u8 *land, const f32 *dLand, const f32 *dSea, const f32 *mount, f32 *h) {
  PUSED = 0; NZ n70, n12, n90; nz_init(&n70, 70, 11, 5, W); nz_init(&n12, 12, 21, 3, W); nz_init(&n90, 90, 5, 3, W);
  for (i32 y = 0; y < H; y++) for (i32 x = 0; x < W; x++) {
    i32 i = y * W + x;
    if (land[i]) {
      f64 inland = smooth(0, 38, dLand[i]);
      f64 n = nz_eval(&n70, x, y), m = mount[i];
      f64 v = 0.10 + 0.25 * inland + (n - 0.5) * (0.35 + 0.5 * fmin2(1, m)) + m + (nz_eval(&n12, x, y) - 0.5) * 0.12 * (0.3 + fmin2(1, m));
      f32 hv = (f32)v; if (hv < 0.06f) hv = 0.06f; h[i] = hv;
    } else {
      h[i] = (f32)(-0.04 - 0.55 * smooth(0, 60, dSea[i]) - (nz_eval(&n90, x, y) - 0.5) * 0.12);
    }
  }
}
/* biomas: e = [lon,lat,rx,ry]×n para estepas, junglas y desiertos */
static i32 inEll(const f64 *e, i32 n, f64 lon, f64 lat, f64 wob) {
  for (i32 k = 0; k < n; k++) { f64 a = (lon - e[k * 4]) / e[k * 4 + 2], b = (lat - e[k * 4 + 1]) / e[k * 4 + 3]; if (a * a + b * b + wob < 1) return 1; }
  return 0;
}
__attribute__((export_name("k_biomes")))
void k_biomes(i32 W, i32 H, const u8 *land, const f32 *h, u8 *biome, const f64 *steppes, i32 ns, const f64 *jungles, i32 nj, const f64 *deserts, i32 nd) {
  PUSED = 0; NZ nw, nm; nz_init(&nw, 40, 31, 4, W); nz_init(&nm, 110, 41, 4, W);
  for (i32 y = 0; y < H; y++) {
    f64 lat = yToLat(y, H);
    for (i32 x = 0; x < W; x++) {
      i32 i = y * W + x; if (!land[i]) continue;
      f64 lon = xToLon(x, W), wob = (nz_eval(&nw, x, y) - 0.5) * 0.9, moist = nz_eval(&nm, x, y), alat = absd(lat), hh = h[i];
      i32 b = 1;
      if (inEll(steppes, ns, lon, lat, wob)) b = 4;
      if (alat < 62 && moist > 0.55 && b == 1 && alat > 38) b = 2;
      if (alat >= 52 && alat < 66 && b != 4 && moist > 0.4 && lat > 0) b = 2;
      if ((alat > 62 && lat > 0) || (lat < -50)) b = 5;
      if (alat > 74 || (lon < -20 && lon > -75 && lat > 60 && lat < 84 && (lat > 66 || hh > 1))) b = 8;
      if (inEll(jungles, nj, lon, lat, wob)) b = 6;
      if (alat < 6 && moist > 0.42) b = 6;
      if (inEll(deserts, nd, lon, lat, wob)) b = 3;
      if (b == 1 && alat < 35 && moist < 0.38) b = 4;
      if (b == 1 && alat < 25 && moist > 0.62) b = 2;
      if (hh > 1.8) b = 7;
      if (hh > 3.4 - alat * 0.02) b = 8;
      biome[i] = (u8)b;
    }
  }
}
/* color base del terreno (sin ríos, que se añaden después en JS) */
static const f64 BCOL[9][3] = {{0,0,0},{122,148,86},{70,106,66},{218,194,138},{170,166,104},{152,162,142},{50,106,68},{132,122,108},{234,238,242}};
__attribute__((export_name("k_terrain")))
void k_terrain(i32 W, i32 H, const u8 *land, const f32 *h, const u8 *biome, const f32 *dSea, u8 *tc) {
  PUSED = 0; NZ t6, t26, t20; nz_init(&t6, 6, 51, 3, W); nz_init(&t26, 26, 53, 3, W); nz_init(&t20, 20, 61, 3, W);
  for (i32 y = 0; y < H; y++) for (i32 x = 0; x < W; x++) {
    i32 i = y * W + x, xm = x > 0 ? x - 1 : x, xp = x < W - 1 ? x + 1 : x, ym = y > 0 ? y - 1 : y, yp = y < H - 1 ? y + 1 : y; f64 r, g, b;
    if (land[i]) {
      const f64 *c = BCOL[biome[i]];
      f64 nz = (nz_eval(&t6, x, y) - 0.5) * 26 + (nz_eval(&t26, x, y) - 0.5) * 30;
      r = c[0] + nz; g = c[1] + nz; b = c[2] + nz * 0.8;
      f64 hh = h[i], mt = smooth(1.1, 2.2, hh), sn = smooth(2.9, 3.8, hh - absd(yToLat(y, H)) * 0.01);
      const f64 *mc = BCOL[7], *sc = BCOL[8];
      if (biome[i] != 8 && biome[i] != 3) { r += (mc[0] - r) * mt * .8; g += (mc[1] - g) * mt * .8; b += (mc[2] - b) * mt * .8; }
      r += (sc[0] - r) * sn; g += (sc[1] - g) * sn; b += (sc[2] - b) * sn;
      f64 sh = (h[ym * W + xm] - h[yp * W + xp]) * 55 + (h[ym * W + x] - h[yp * W + x]) * 25;
      f64 k = 1 + fmax2(-0.4, fmin2(0.4, sh * 0.5));
      r *= k; g *= k; b *= k;
    } else {
      f64 d = dSea[i], t = smooth(0, 55, d);
      r = 70 + (22 - 70) * t; g = 128 + (52 - 128) * t; b = 150 + (84 - 150) * t;
      f64 nz = (nz_eval(&t20, x, y) - 0.5) * 10; r += nz; g += nz; b += nz;
      if (d < 2.2) { r += 30; g += 30; b += 24; }
    }
    i32 o = i * 4; tc[o] = clamp8(r); tc[o + 1] = clamp8(g); tc[o + 2] = clamp8(b); tc[o + 3] = 255;
  }
}
