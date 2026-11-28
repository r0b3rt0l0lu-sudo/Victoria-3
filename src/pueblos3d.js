/* ===== pueblos3d.js (v2) — pueblos con plano real para la batalla 3D de Victoria (three.js r152, todo procedural) =====
   buildVillage(seed, bioma, era, tf, opts) traza un plano y construye el pueblo:
   1) calle principal curva + 2–5 transversales + plaza con iglesia, ayuntamiento y pozo; río opcional (opts.rio) con puente y vado;
   2) parcelas a ambos lados de cada calle, con las casas mirando a la calle (sin solaparse ni invadir calles ni el río);
   3) plataforma bajo cada edificio: si tf.aplanar existe (terreno3d) se allana el terreno; en todo caso el suelo del edificio queda
      sobre el punto más alto de su planta y el zócalo baja hasta por debajo del más bajo: nunca flota ni queda enterrado;
   4) 24 tipos: casa baja, casa de dos plantas, posada, taberna, panadería (horno), herrería (fragua), granja con patio, granja fortificada,
      hacienda (patio con soportales y azotea), casas adosadas urbanas de 2–4 plantas, almacén, establo, molino de viento, molino de agua
      (rueda que gira), iglesia con cementerio, ermita, ayuntamiento (torre del reloj, balcón), mansión, torre de vigilancia, puente de
      piedra, puente de madera, vado marcado, calvario (+ pozo y huerto);
   5) estilos por región: centroeuropeo de entramado, mediterráneo de teja y cal (azoteas), ruso de madera, inglés de ladrillo, norte
      nevado, norteamericano de tablas (porche) y japonés (madera oscura, enlucido, shoji, tejado irimoya); cubiertas de teja, pizarra,
      paja, ripia y chapa ondulada (eras C–E) con hiladas en el LOD0; chimeneas con humo; ventanas con postigos abiertos o cerrados;
   6) daños de guerra progresivos 0–3: 1 cristales rotos, postigos caídos, tejas sueltas y hollín; 2 tejado hundido, boquete en la
      fachada, chimenea rota; 3 ruina (muros en tramos, sin tejado, vigas quemadas, escombro). Con opts.separados cada edificio es un
      objeto propio y P.danarEdificio(i, nivel) lo rehace con más daño;
   7) puertas que se abren (hojas instanciadas: P.abrirPuerta(i, ángulo)), interiores de planta baja (sala, mesa, banco, hogar, mostrador,
      horno o fragua; la fachada tiene el hueco de la puerta), escaleras exteriores, escaleras de mano, azoteas y tejados transitables
      (P.tiradores), muros de cercado con brechas y vallas, calles y plaza adoquinadas, carros, barriles, cubos y pilas de leña;
   8) tres niveles de detalle (THREE.LOD a nivel de pueblo: 3 mallas fusionadas por material + instancias por nivel);
   9) devuelve colliders, cover, loopholes (como la v1) y además puertas, tiradores, escaleras, brechas, humos, fuegos, interiores,
      superficies (puentes), objetos de calle y triángulos por edificio y nivel (info.tris).
   Unidades: u del campo (1 u ≈ 0,6 m; las medidas internas están en metros y se convierten con opts.uPorMetro).
   tf: {height(x,z)} y opcionalmente {aplanar(cx,cz,w,d,rot,margen,altura)} (terreno3d.crearTerreno lo cumple).
   API (compatible con la v1): planoPueblo(seed, bioma, era, opts) · buildVillage(seed, bioma, era, tf, opts) · construirEdificio(tipo, bioma,
        era, tf, opts) · ESTILOS · BIOMA_ESTILO · TIPOS · pruebaPueblos(tf) · demoPueblos(cont) */
(function (root) {
'use strict';
const THREE = root.THREE;
function rng(seed) { let a = (seed >>> 0) || 1; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const lerp = (a, b, t) => a + (b - a) * t;

/* ---------- estilos ---------- */
const ESTILOS = {
  centroeuropeo: {muro: 0xe6dcc6, viga: 0x4a3424, tejado: 0x9a4a32, paja: 0xa8925a, zocalo: 0x8a8478, marco: 0x5a4030, puerta: 0x5a3a24, postigo: [0x3a5a3a, 0x5a3a24, 0x7a3428], pend: 50, vuelo: 0.45, entramado: 1, cubierta: 'teja', cerca: 'piedra', interiorMuro: 0xd8ccb0},
  mediterraneo: {muro: 0xefe9dc, viga: 0x7a6a52, tejado: 0xb8623e, paja: 0xb8623e, zocalo: 0xa89c88, marco: 0xd8d0c0, puerta: 0x5a4030, postigo: [0x3a6a8a, 0x4a7a4a, 0x6a4a3a], pend: 22, vuelo: 0.3, cubierta: 'teja', azotea: 0.35, cerca: 'adobe', interiorMuro: 0xece6d8},
  ruso: {muro: 0x7a5a3e, viga: 0x5a4230, tejado: 0x6e6c64, paja: 0x9a8a5a, zocalo: 0x7a746a, marco: 0xe0d8c8, puerta: 0x4a3424, postigo: [0x4a6a9a, 0x5a8a6a], pend: 42, vuelo: 0.5, troncos: 1, cubierta: 'ripia', cerca: 'valla', interiorMuro: 0x8a6a4a},
  ingles: {muro: 0x9a4a38, viga: 0x6a3a2a, tejado: 0x4a4e56, paja: 0xa8925a, zocalo: 0x7a7470, marco: 0xece8dc, puerta: 0x2a3a2a, postigo: null, pend: 40, vuelo: 0.3, esquinas: 0xd8d0c0, cubierta: 'pizarra', cerca: 'piedra', interiorMuro: 0xd8d0b8},
  norte: {muro: 0x8a3428, viga: 0x5a2a20, tejado: 0x3a3a3a, paja: 0x3a3a3a, zocalo: 0x6a6a68, marco: 0xece8dc, puerta: 0x2a2a2a, postigo: null, pend: 45, vuelo: 0.4, nieve: 0xeef2f6, esquinas: 0xece8dc, cubierta: 'pizarra', cerca: 'valla', interiorMuro: 0xc8b89a},
  americano: {muro: 0xe8e4da, viga: 0x5a4a3a, tejado: 0x4a4440, paja: 0xa8925a, zocalo: 0x8a7a6a, marco: 0xf4f0e8, puerta: 0x3a2a20, postigo: [0x1e2a1e, 0x1a1a1a, 0x2a3a4a], pend: 38, vuelo: 0.35, tablas: 1, porche: 1, cubierta: 'ripia', cerca: 'valla', interiorMuro: 0xd8ccb0},
  japones: {muro: 0xe8e2d0, viga: 0x3a2a20, tejado: 0x4a4e52, paja: 0x8a7a52, zocalo: 0x6a6660, marco: 0x3a2a20, puerta: 0x6a5a44, postigo: null, pend: 30, vuelo: 0.85, entramado: 2, shoji: 1, irimoya: 1, cubierta: 'teja_j', cerca: 'valla', interiorMuro: 0xd8ccb0}};
const BIOMA_ESTILO = {templado: 'centroeuropeo', centroeuropeo: 'centroeuropeo', mediterraneo: 'mediterraneo', desierto: 'mediterraneo', estepa: 'ruso', boreal: 'ruso', ruso: 'ruso', ingles: 'ingles', atlantico: 'ingles', nevado: 'norte', norte: 'norte',
  americano: 'americano', norteamericano: 'americano', pradera: 'americano', japones: 'japones', japon: 'japones', asia: 'japones'};
const C = {piedra: 0x8a8478, piedraO: 0x6a665e, cristal: 0x1c2228, hueco: 0x16120e, madera: 0x7a5232, maderaO: 0x4e3420, hierro: 0x3a3c40, quemado: 0x2a2622, escombro: 0x8a8070, verde: 0x4a6a32, tierra: 0x6a5238, blanco: 0xeae6da, campana: 0x8a6a2a,
  pizarra: 0x4a4e56, chapa: 0x7a7c78, oxido: 0x8a5a3a, adoquin: 0x7a766e, adoquinO: 0x6c6862, ladrillo: 0x9a4a38, adobe: 0xc8a882, hollin: 0x24201c, suelo: 0x7a5a3a, baldosa: 0x9a6a4a, brasa: 0xe8641c, agua: 0x4a5a60, shoji: 0xf0ece0, rojo: 0xa82a24, amarillo: 0xd8b040, oro: 0xc8a048};
const CUBIERTA = {teja: null, pizarra: C.pizarra, paja: 0xa8925a, ripia: null, chapa: C.chapa, teja_j: null};

/* ---------- constructor de geometría con color por vértice ---------- */
const _c = new THREE.Color(), _cq = new THREE.Color(C.quemado);
function Geo() { this.p = []; this.c = []; this.m = new THREE.Matrix4(); this.oscurece = 0; }
Geo.prototype.tri = function (a, b, c, col) {
  _c.setHex(col); if (this.oscurece) _c.lerp(_cq, this.oscurece);
  const e = this.m.elements;
  [a, b, c].forEach(q => { const x = q[0], y = q[1], z = q[2]; this.p.push(e[0] * x + e[4] * y + e[8] * z + e[12], e[1] * x + e[5] * y + e[9] * z + e[13], e[2] * x + e[6] * y + e[10] * z + e[14]); this.c.push(_c.r, _c.g, _c.b); });
};
Geo.prototype.quad = function (a, b, c, d, col) { this.tri(a, b, c, col); this.tri(a, c, d, col); };
Geo.prototype.quad2 = function (a, b, c, d, col) { this.quad(a, b, c, d, col); this.quad(a, d, c, b, col); };   // dos caras
// caja con centro de la base en (x, y, z); w (x) × h (y) × d (z); o.sinTecho/o.conBase; o.ry giro local en radianes; o.rx/o.rz inclinación
Geo.prototype.caja = function (x, y, z, w, h, d, col, o) {
  o = o || {}; const cs = Math.cos(o.ry || 0), sn = Math.sin(o.ry || 0), cx = Math.cos(o.rz || 0), sx = Math.sin(o.rz || 0), cxx = Math.cos(o.rx || 0), sxx = Math.sin(o.rx || 0);
  const P = (px, py, pz) => { let a = px * cx - py * sx, b = px * sx + py * cx, c2 = pz; const b2 = b * cxx - c2 * sxx, c3 = b * sxx + c2 * cxx; return [x + a * cs + c3 * sn, y + b2, z - a * sn + c3 * cs]; };
  const a = P(-w / 2, 0, d / 2), b = P(w / 2, 0, d / 2), c = P(w / 2, 0, -d / 2), e = P(-w / 2, 0, -d / 2), A = P(-w / 2, h, d / 2), B = P(w / 2, h, d / 2), Cc = P(w / 2, h, -d / 2), E = P(-w / 2, h, -d / 2);
  const ct = o.colTecho == null ? col : o.colTecho;
  this.quad(a, b, B, A, col); this.quad(b, c, Cc, B, col); this.quad(c, e, E, Cc, col); this.quad(e, a, A, E, col);
  if (!o.sinTecho) this.quad(A, B, Cc, E, ct); if (o.conBase) this.quad(e, c, b, a, col);
};
// cilindro / cono de n lados (eje y)
Geo.prototype.cil = function (x, y, z, r0, r1, h, n, col, o) {
  o = o || {}; for (let i = 0; i < n; i++) { const a0 = i / n * Math.PI * 2, a1 = (i + 1) / n * Math.PI * 2;
    const p0 = [x + Math.cos(a0) * r0, y, z + Math.sin(a0) * r0], p1 = [x + Math.cos(a1) * r0, y, z + Math.sin(a1) * r0], q0 = [x + Math.cos(a0) * r1, y + h, z + Math.sin(a0) * r1], q1 = [x + Math.cos(a1) * r1, y + h, z + Math.sin(a1) * r1];
    if (r1 > 0.001) this.quad(p1, p0, q0, q1, col); else this.tri(p1, p0, q0, col);
    if (o.tapa && r1 > 0.001) this.tri([x, y + h, z], q1, q0, o.colTapa || col); }
};
// cilindro tumbado a lo largo de x (troncos, ejes, rodillos)
Geo.prototype.cilX = function (x0, x1, y, z, r, n, col, tapas) {
  for (let i = 0; i < n; i++) { const a0 = i / n * Math.PI * 2, a1 = (i + 1) / n * Math.PI * 2, P = (x, a) => [x, y + Math.cos(a) * r, z + Math.sin(a) * r];
    this.quad(P(x0, a0), P(x0, a1), P(x1, a1), P(x1, a0), col); if (tapas) { this.tri([x1, y, z], P(x1, a0), P(x1, a1), col); this.tri([x0, y, z], P(x0, a1), P(x0, a0), col); } }
};
Geo.prototype.geometria = function () { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3)); g.computeVertexNormals(); return g; };
Geo.prototype.tris = function () { return this.p.length / 9; };
// con una matriz local temporal (sub-sistema de coordenadas): fn se ejecuta con g.m · m
function conMatriz(gs, m, fn) { const sv = gs.map(g => g.m.clone()); gs.forEach(g => g.m.multiply(m)); fn(); gs.forEach((g, i) => g.m.copy(sv[i])); }

/* ---------- geometría plana ---------- */
function distPoli(x, z, P) { let best = 1e9; for (let i = 0; i < P.length - 1; i++) { const [ax, az] = P[i], [bx, bz] = P[i + 1], dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L2)); best = Math.min(best, Math.hypot(x - ax - dx * t, z - az - dz * t)); } return best; }
function esquinas(cx, cz, w, d, rot, m) { m = m || 0; const c = Math.cos(rot), s = Math.sin(rot), W = w / 2 + m, D = d / 2 + m; return [[-W, -D], [W, -D], [W, D], [-W, D]].map(([x, z]) => [cx + x * c + z * s, cz - x * s + z * c]); }
function solapan(A, B) {
  const ejes = []; [A, B].forEach(P => { for (let i = 0; i < 2; i++) { const [ax, az] = P[i], [bx, bz] = P[i + 1]; ejes.push([-(bz - az), bx - ax]); } });
  return ejes.every(([ex, ez]) => { const pa = A.map(p => p[0] * ex + p[1] * ez), pb = B.map(p => p[0] * ex + p[1] * ez); return Math.max(...pa) > Math.min(...pb) && Math.max(...pb) > Math.min(...pa); });
}
// cruce de dos segmentos → [x, z, t1, t2] o null
function cruce(a, b, c, d) { const r1 = [b[0] - a[0], b[1] - a[1]], r2 = [d[0] - c[0], d[1] - c[1]], den = r1[0] * r2[1] - r1[1] * r2[0]; if (Math.abs(den) < 1e-9) return null;
  const t = ((c[0] - a[0]) * r2[1] - (c[1] - a[1]) * r2[0]) / den, u = ((c[0] - a[0]) * r1[1] - (c[1] - a[1]) * r1[0]) / den; if (t < 0 || t > 1 || u < 0 || u > 1) return null; return [a[0] + r1[0] * t, a[1] + r1[1] * t, t, u]; }

/* ---------- catálogo de tipos (medidas de planta por defecto, en m: ancho × fondo) ---------- */
const TIPOS = {
  casa_baja: {nombre: 'Casa baja', dims: r => [7 + r() * 3, 6 + r() * 1.5], interior: true},
  casa_dos: {nombre: 'Casa de dos plantas', dims: r => [8 + r() * 3.5, 7 + r() * 1.5], interior: true},
  posada: {nombre: 'Posada', dims: () => [14, 9]},
  taberna: {nombre: 'Taberna', dims: () => [10, 8], interior: true},
  panaderia: {nombre: 'Panadería (horno de leña)', dims: () => [8.5, 7], interior: true},
  herreria: {nombre: 'Herrería (fragua y cobertizo)', dims: () => [10, 8], interior: true},
  granja: {nombre: 'Granja con patio', dims: () => [22, 20]},
  granja_fortificada: {nombre: 'Granja fortificada con patio', dims: () => [26, 24]},
  hacienda: {nombre: 'Hacienda (patio con soportales, azotea)', dims: () => [24, 22]},
  adosadas: {nombre: 'Casas adosadas urbanas de 2–4 plantas', dims: r => [5.5 * (3 + Math.floor(r() * 3)), 9]},
  almacen: {nombre: 'Almacén', dims: () => [16, 10]},
  establo: {nombre: 'Establo', dims: () => [14, 7.5]},
  molino: {nombre: 'Molino de viento', dims: () => [7, 7]},
  molino_agua: {nombre: 'Molino de agua (rueda)', dims: () => [9, 8]},
  iglesia: {nombre: 'Iglesia con cementerio', dims: () => [12, 26]},
  ermita: {nombre: 'Ermita', dims: () => [6.5, 10]},
  ayuntamiento: {nombre: 'Ayuntamiento (torre del reloj y balcón)', dims: () => [16, 11], interior: true},
  mansion: {nombre: 'Mansión', dims: () => [30, 26]},
  torre_vigilancia: {nombre: 'Torre de vigilancia', dims: () => [5, 5]},
  puente_piedra: {nombre: 'Puente de piedra', dims: () => [30, 7]},
  puente_madera: {nombre: 'Puente de madera', dims: () => [26, 5]},
  vado: {nombre: 'Vado marcado', dims: () => [24, 5]},
  calvario: {nombre: 'Calvario', dims: () => [7, 7]},
  pozo: {nombre: 'Pozo', dims: () => [2, 2]}, huerto: {nombre: 'Huerto', dims: r => [8, 8]}};
TIPOS.molino_viento = TIPOS.molino;

/* ===================================================================================== */
/* PLANO: calles, plaza, río y parcelas (sin geometría). Sirve para crear el terreno con los caminos antes de construir.
   op.rio = {puntos: [[x, z]…] (mundo), ancho (u)}: el río corta las calles → puente; un vado aguas arriba o abajo; molino de agua en la orilla. */
// con río y sin giro dado: la calle principal (x local, que en el mundo va hacia (cos, −sen)) cruza el río casi en perpendicular
function rioCruza(rio, r0) { const P = rio.puntos, dx = P[P.length - 1][0] - P[0][0], dz = P[P.length - 1][1] - P[0][1]; return Math.atan2(-dx, -dz) + (r0 / Math.PI - 0.5) * 0.5; }
function planoPueblo(seed, bioma, era, op) {
  op = Object.assign({centro: [0, 0], tamano: 'pueblo', uPorMetro: 1 / 0.6, rot: null, rio: null}, op || {});
  const r = rng(seed), M = op.uPorMetro, [cx0, cz0] = op.centro, rot0 = r() * Math.PI, rot = op.rot != null ? op.rot : op.rio ? rioCruza(op.rio, rot0) : rot0, cs = Math.cos(rot), sn = Math.sin(rot), eraI = Math.max(0, 'ABCDE'.indexOf(era || 'B'));
  const estilo = BIOMA_ESTILO[bioma] || bioma;
  const T = {aldea: {L: 120, trans: 2, plaza: 10, max: 12}, pueblo: {L: 180, trans: 3, plaza: 13, max: 22}, grande: {L: 250, trans: 4, plaza: 16, max: 34}, ciudad: {L: 300, trans: 5, plaza: 18, max: 46}}[op.tamano] || {L: 180, trans: 3, plaza: 13, max: 22};
  const W = (x, z) => [cx0 + (x * cs + z * sn) * M, cz0 + (-x * sn + z * cs) * M];          // local (m) → mundo (u)
  const Lc = (xw, zw) => { const dx = (xw - cx0) / M, dz = (zw - cz0) / M; return [dx * cs - dz * sn, dx * sn + dz * cs]; };   // mundo (u) → local (m)
  const L = T.L, curva = (r() - 0.5) * L * 0.35, prin = [];
  for (let i = 0; i <= 24; i++) { const t = i / 24, x = lerp(-L / 2, L / 2, t), z = 2 * t * (1 - t) * curva; prin.push([x, z]); }
  const calles = [{puntos: prin, ancho: 6, tipo: 'principal'}];
  const plazaL = prin[12], plaza = {c: plazaL, r: T.plaza};
  const usados = [12]; for (let k = 0; k < T.trans; k++) {
    let i; let tries = 0; do { i = 3 + Math.floor(r() * 19); tries++; } while (usados.some(u => Math.abs(u - i) < 4) && tries < 40); if (tries >= 40) break; usados.push(i);
    const [ax, az] = prin[i], [bx, bz] = prin[Math.min(24, i + 1)], dx = bx - ax, dz = bz - az, l = Math.hypot(dx, dz), nx = -dz / l, nz = dx / l, lado = r() < 0.5 ? -1 : 1, len = 40 + r() * 45, cur = (r() - 0.5) * 14;
    const P = []; for (let s = 0; s <= 8; s++) { const t = s / 8; P.push([ax + nx * lado * len * t + dx / l * cur * Math.sin(t * Math.PI), az + nz * lado * len * t + dz / l * cur * Math.sin(t * Math.PI)]); }
    calles.push({puntos: P, ancho: 4.5, tipo: 'transversal'});
  }
  const rio = op.rio ? {puntos: op.rio.puntos.map(([x, z]) => Lc(x, z)), ancho: (op.rio.ancho || 14) / M} : null;
  const parcelas = [], ocupado = [];
  const libre = (cx, cz, w, d, ro, tipo) => {
    const E = esquinas(cx, cz, w, d, ro, 1.2);
    if (ocupado.some(o => solapan(E, o))) return false;
    for (const c of calles) { const lim = c.ancho / 2 + 0.8; if (E.concat([[cx, cz]]).some(([x, z]) => distPoli(x, z, c.puntos) < lim)) return false;
      for (let a = 0; a < 4; a++) { const [x0, z0] = E[a], [x1, z1] = E[(a + 1) % 4]; for (let t = 0.25; t < 1; t += 0.25) if (distPoli(lerp(x0, x1, t), lerp(z0, z1, t), c.puntos) < lim) return false; } }
    if (rio) { const lim = rio.ancho / 2 + (tipo === 'molino_agua' ? 0.3 : 2); for (let a = 0; a < 4; a++) { const [x0, z0] = E[a], [x1, z1] = E[(a + 1) % 4]; for (let t = 0; t < 1; t += 0.2) if (distPoli(lerp(x0, x1, t), lerp(z0, z1, t), rio.puntos) < lim) return false; } if (distPoli(cx, cz, rio.puntos) < lim) return false; }
    if (Math.hypot(cx - plaza.c[0], cz - plaza.c[1]) < plaza.r + Math.max(w, d) * 0.5 - 1) return false;
    return true;
  };
  const poner = (tipo, cx, cz, w, d, ro, extra) => { if (!libre(cx, cz, w, d, ro, tipo)) return null; const p = Object.assign({tipo, cx, cz, w, d, rot: ro}, extra || {}); ocupado.push(esquinas(cx, cz, w, d, ro, 0.2)); parcelas.push(p); return p; };
  const forzar = (tipo, cx, cz, w, d, ro, extra) => { const p = Object.assign({tipo, cx, cz, w, d, rot: ro}, extra || {}); ocupado.push(esquinas(cx, cz, w, d, ro, 0.2)); parcelas.push(p); return p; };
  // puentes donde las calles cruzan el río (antes que nada: tienen prioridad); el resto de parcelas evita el río
  if (rio) { calles.forEach((c, ci) => { for (let i = 0; i < c.puntos.length - 1; i++) for (let j = 0; j < rio.puntos.length - 1; j++) { const k = cruce(c.puntos[i], c.puntos[i + 1], rio.puntos[j], rio.puntos[j + 1]); if (!k) continue;
      const ux = c.puntos[i + 1][0] - c.puntos[i][0], uz = c.puntos[i + 1][1] - c.puntos[i][1], l = Math.hypot(ux, uz), rx = rio.puntos[j + 1][0] - rio.puntos[j][0], rz = rio.puntos[j + 1][1] - rio.puntos[j][1], rl = Math.hypot(rx, rz);
      const sinA = Math.abs((ux * rz - uz * rx) / (l * rl)) || 1, largo = rio.ancho / Math.max(0.5, sinA) + 12, madera = op.tamano === 'aldea' || estilo === 'ruso' || estilo === 'americano' || ci > 0;
      forzar(madera ? 'puente_madera' : 'puente_piedra', k[0], k[1], largo, c.ancho + (madera ? 0 : 1.5), Math.atan2(-uz / l, ux / l), {calle: ci, rio: true}); } });
    if (r() < 0.75) { const j = Math.floor(rio.puntos.length * (r() < 0.5 ? 0.2 : 0.8)), a = rio.puntos[Math.max(0, j - 1)], b = rio.puntos[Math.min(rio.puntos.length - 1, j + 1)], dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1, P = rio.puntos[j];
      if (!parcelas.some(p => Math.hypot(p.cx - P[0], p.cz - P[1]) < 40)) forzar('vado', P[0], P[1], rio.ancho + 10, 5, Math.atan2(-dx / l, -dz / l), {rio: true}); } }
  // iglesia y ayuntamiento: en el borde de la plaza, mirando a ella
  const enPlaza = (tipo, w, d, a0) => { for (let k = 0; k < 14; k++) { const aa = a0 + k * 0.45, dd = plaza.r + d / 2 + 1.5, x = plaza.c[0] + Math.cos(aa) * dd, z = plaza.c[1] + Math.sin(aa) * dd, ro = Math.atan2(plaza.c[0] - x, plaza.c[1] - z);
    if (poner(tipo, x, z, w, d, ro)) return true; } return false; };
  const aIg = r() * Math.PI * 2; enPlaza('iglesia', 12, 26, aIg); if (op.tamano !== 'aldea') enPlaza('ayuntamiento', 16, 11, aIg + Math.PI);
  const pozo = {tipo: 'pozo', cx: plaza.c[0] + 3, cz: plaza.c[1] + 2, w: 2, d: 2, rot: 0}; parcelas.push(pozo); ocupado.push(esquinas(pozo.cx, pozo.cz, 2.4, 2.4, 0));
  // a lo largo de cada calle, a ambos lados; los de un solo ejemplar (posada, panadería, herrería) cerca del centro
  const unico = {posada: 0, panaderia: 0, herreria: 0, taberna: 0}, urbano = op.tamano === 'grande' || op.tamano === 'ciudad';
  const tipoEn = (ci, dPlaza) => { const x = r();
    if (ci === 0 && dPlaza < 45 && !unico.posada) return 'posada'; if (ci === 0 && dPlaza < 70 && !unico.herreria && x < 0.3) return 'herreria';
    if (dPlaza < 60 && !unico.panaderia && x < 0.25) return 'panaderia'; if (dPlaza < 60 && !unico.taberna && x > 0.85) return 'taberna';
    if (urbano && dPlaza < L * 0.3 && x < 0.55) return 'adosadas';
    if (dPlaza > L * 0.36 && x < 0.45) return estilo === 'mediterraneo' && x < 0.12 ? 'hacienda' : 'granja';
    if (dPlaza > L * 0.25 && x > 0.88) return x > 0.94 ? 'almacen' : 'establo';
    return x < 0.5 ? 'casa_baja' : 'casa_dos'; };
  calles.forEach((c, ci) => {
    const P = c.puntos; const segL = []; for (let i = 0; i < P.length - 1; i++) segL.push(Math.hypot(P[i + 1][0] - P[i][0], P[i + 1][1] - P[i][1]));
    const total = segL.reduce((a, b) => a + b, 0);
    [-1, 1].forEach(lado => {
      let s = 2 + r() * 4;
      while (s < total - 4 && parcelas.length < T.max * 1.8) {
        let i = 0, q = s; while (i < segL.length - 1 && q > segL[i]) { q -= segL[i]; i++; } const t = q / segL[i], [ax, az] = P[i], [bx, bz] = P[i + 1], px = lerp(ax, bx, t), pz = lerp(az, bz, t);
        const dx = (bx - ax) / segL[i], dz = (bz - az) / segL[i], nx = -dz * lado, nz = dx * lado, dPlaza = Math.hypot(px - plaza.c[0], pz - plaza.c[1]);
        const tipo = tipoEn(ci, dPlaza), [w, d] = TIPOS[tipo].dims(r);
        const ret = c.ancho / 2 + (tipo === 'adosadas' ? 2.1 : 1 + r() * 2.5) + d / 2, cx = px + nx * ret, cz = pz + nz * ret, ro = Math.atan2(-nx, -nz);   // +z local mira a la calle
        const p = poner(tipo, cx, cz, w, d, ro, {calle: ci, lado}); if (p && unico[tipo] != null) unico[tipo] = 1;
        if (p && r() < 0.5 && /casa|taberna|panaderia/.test(tipo)) { const hd = 7 + r() * 5, hw = w * (0.8 + r() * 0.3), hx = cx - nx * (d / 2 + hd / 2 + 1), hz = cz - nz * (d / 2 + hd / 2 + 1); poner('huerto', hx, hz, hw, hd, ro); }
        s += (p ? w : 4) + (tipo === 'adosadas' && p ? 0.3 : 1.5 + r() * 3);
        if (parcelas.filter(p => !['huerto', 'pozo'].includes(p.tipo)).length >= T.max) break;
      }
    });
  });
  // afueras: molino (de agua junto al río), granja fortificada, mansión, torre de vigilancia, ermita y calvario a la salida
  const fuera = (tipo, w, d, dmin, ro) => { for (let k = 0; k < 50; k++) { const a = r() * Math.PI * 2, dd = dmin + r() * 30, x = Math.cos(a) * dd, z = Math.sin(a) * dd * 0.7; if (poner(tipo, x, z, w, d, ro == null ? r() * Math.PI * 2 : ro)) return true; } return false; };
  let molinoAgua = false;
  if (rio) for (let k = 0; k < 30 && !molinoAgua; k++) { const j = 1 + Math.floor(r() * (rio.puntos.length - 2)), a = rio.puntos[j - 1], b = rio.puntos[j + 1], dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1, s = r() < 0.5 ? 1 : -1, nx = -dz / l * s, nz = dx / l * s, P = rio.puntos[j], off = rio.ancho / 2 + 2.6 + 4.5;
    molinoAgua = !!poner('molino_agua', P[0] + nx * off, P[1] + nz * off, 9, 8, Math.atan2(nz, -nx), {rio: true}); }   // el +x local (la rueda) mira al río
  if (!molinoAgua) fuera('molino', 7, 7, L * 0.55);
  if (op.tamano !== 'aldea') { fuera('mansion', 30, 26, L * 0.5); if (r() < 0.6) fuera(estilo === 'mediterraneo' ? 'hacienda' : 'granja_fortificada', ...(estilo === 'mediterraneo' ? [24, 22] : [26, 24]), L * 0.6); }
  if (r() < (eraI >= 3 ? 0.75 : 0.45)) fuera('torre_vigilancia', 5, 5, L * 0.6);
  const extremo = (k, tipo, w, d) => { const P = prin[k], Q = prin[k === 0 ? 1 : 23], dx = P[0] - Q[0], dz = P[1] - Q[1], l = Math.hypot(dx, dz), ux = dx / l, uz = dz / l;
    for (let s = 0; s < 6; s++) { const along = 8 + s * 6, lado = (s % 2 ? -1 : 1), x = P[0] + ux * along - uz * lado * (6 + d / 2), z = P[1] + uz * along + ux * lado * (6 + d / 2); if (poner(tipo, x, z, w, d, Math.atan2(uz * lado, -ux * lado))) return; } };
  if (r() < 0.75) extremo(r() < 0.5 ? 0 : 24, 'calvario', 7, 7);
  if (op.tamano !== 'aldea' || r() < 0.5) extremo(r() < 0.5 ? 24 : 0, 'ermita', 6.5, 10);
  const toW = p => { const [x, z] = W(p.cx, p.cz); return Object.assign({}, p, {cx: x, cz: z, w: p.w * M, d: p.d * M, rot: p.rot + rot}); };
  return {calles: calles.map(c => ({puntos: c.puntos.map(([x, z]) => W(x, z)), ancho: c.ancho * M, tipo: c.tipo})), plaza: {c: W(...plaza.c), r: plaza.r * M}, parcelas: parcelas.map(toW), rot, M, semilla: seed, bioma, era, tamano: op.tamano,
    rio: op.rio ? {puntos: op.rio.puntos.map(p => p.slice()), ancho: op.rio.ancho || 14} : null};
}

/* ===================================================================================== */
/* CONSTRUCCIÓN */
const NIVEL_DANIO = r => { const x = r(); return x < 0.4 ? 1 : x < 0.72 ? 2 : 3; };
function buildVillage(seed, bioma, era, tf, op) {
  op = Object.assign({uPorMetro: 1 / 0.6, danos: null, danio: null, danioFn: null, plan: null, distLOD: [260, 700], interiores: true, adoquines: null, objetos: true, separados: false, humo: true}, op || {});
  const plan = op.plan || planoPueblo(seed, bioma, era, op), M = plan.M || op.uPorMetro, r = rng(seed * 7 + 3);
  const nombreEstilo = BIOMA_ESTILO[bioma] || bioma, st = ESTILOS[nombreEstilo] || ESTILOS.centroeuropeo, eraI = Math.max(0, 'ABCDE'.indexOf(era || 'B'));
  const pDanio = op.danos != null ? op.danos : [0, 0, 0, 0.4, 0.55][eraI];
  const H = (x, z) => (tf && (tf.height || tf.heightAt)) ? (tf.height || tf.heightAt)(x, z) : 0;
  const sinPlataforma = t => /^(huerto|puente|vado|calvario)/.test(t);
  // 1) allanar todas las plataformas primero (así un allanado no estropea la planta de otro edificio)
  const plataformas = [];
  if (tf && tf.aplanar) plan.parcelas.forEach(p => { if (sinPlataforma(p.tipo)) return; const h = tf.aplanar(p.cx, p.cz, p.w + 0.6 * M, p.d + 0.6 * M, p.rot, 3 * M); plataformas.push({centro: [p.cx, p.cz], ancho: p.w, fondo: p.d, rot: p.rot, altura: h}); });
  // 2) altura de suelo y de cimiento según el terreno final
  plan.parcelas.forEach(p => { const E = esquinas(p.cx, p.cz, p.w, p.d, p.rot, 0.3 * M); const hs = []; for (let a = 0; a < 4; a++) { const [x0, z0] = E[a], [x1, z1] = E[(a + 1) % 4]; for (let t = 0; t < 1; t += 0.2) hs.push(H(lerp(x0, x1, t), lerp(z0, z1, t))); } hs.push(H(p.cx, p.cz));
    p.hMax = Math.max(...hs); p.hMin = Math.min(...hs); p.suelo = p.hMax + 0.12 * M; p.cimiento = p.hMin - 0.5 * M; });
  // 3) daño por edificio (0–3)
  plan.parcelas.forEach((p, i) => { const sin = ['huerto', 'pozo', 'vado'].includes(p.tipo); p.danio = sin ? 0 : op.danio != null ? op.danio : op.danioFn ? (op.danioFn(p, i) | 0) : (r() < pDanio ? NIVEL_DANIO(r) : 0); });
  const S = {colliders: [], cover: [], loopholes: [], puertas: [], tiradores: [], escaleras: [], brechas: [], humos: [], fuegos: [], interiores: [], superficies: [], objetos: []}, edificios = [];
  const nuevoL = () => [0, 1, 2].map(() => ({muro: new Geo(), tejado: new Geo(), detalle: new Geo(), inst: {poste: [], planta: [], tumba: [], escombro: [], paca: [], hoja: [], barril: [], cubo: [], lena: [], carro: [], banco: [], cruz: [], baliza: []}, moviles: []}));
  const INST = instGeos(), trisInst = k => INST[k].tris;
  const cuentaTris = G => G.muro.tris() + G.tejado.tris() + G.detalle.tris() + Object.keys(G.inst).reduce((a, k) => a + G.inst[k].length * trisInst(k), 0) + G.moviles.reduce((a, mv) => a + mv.geo.tris(), 0);
  function construye(L, p, ix, salida) {
    const info = {tipo: p.tipo, indice: ix, centro: [p.cx, p.cz], rot: p.rot, ancho: p.w, fondo: p.d, suelo: p.suelo, danio: p.danio, plantas: 0, alto: 0, tris: [0, 0, 0], estilo: nombreEstilo};
    for (let lod = 0; lod < 3; lod++) {
      const G = L[lod], mat = new THREE.Matrix4().makeRotationY(p.rot).setPosition(p.cx, 0, p.cz).multiply(new THREE.Matrix4().makeScale(M, M, M)), antes = cuentaTris(G);
      [G.muro, G.tejado, G.detalle].forEach(g => { g.m.copy(mat); g.oscurece = p.danio >= 3 ? 0.35 : p.danio === 2 ? 0.12 : 0; });
      const ctx = {G, lod, st, estilo: nombreEstilo, era: eraI, r: rng(seed * 131 + ix * 7 + 1), danio: p.danio, p, M, suelo: p.suelo / M, cim: p.cimiento / M, w: p.w / M, d: p.d / M, mat, Hw: H, op, plan,
        salida: lod === 0 && salida ? Object.assign({info}, S) : null, interior: op.interiores && TIPOS[p.tipo] && TIPOS[p.tipo].interior && lod === 0 && p.danio < 3, ventanas: []};
      ctx.cubierta = cubiertaDe(ctx);
      ctx.H = (lx, lz) => { const [wx, wz] = aMundo(ctx, lx, lz); return H(wx, wz) / M; };
      (CONSTR[p.tipo] || CONSTR.casa_baja)(ctx);
      if (lod === 0 && op.objetos && /^(casa|taberna|panaderia|herreria|posada|establo|almacen)/.test(p.tipo)) objetosFachada(ctx);
      info.tris[lod] = cuentaTris(G) - antes;
    }
    return info;
  }
  // 4) mallas por nivel (+ piezas que giran)
  const mats = {muro: new THREE.MeshLambertMaterial({vertexColors: true}), tejado: new THREE.MeshLambertMaterial({vertexColors: true, flatShading: true}), detalle: new THREE.MeshLambertMaterial({vertexColors: true, side: THREE.DoubleSide})};
  const moviles = [];
  function mallas(L, nombre) {
    return L.map((G, lod) => { const g = new THREE.Group(); g.name = nombre + '_lod' + lod;
      ['muro', 'tejado', 'detalle'].forEach(k => { if (!G[k].p.length) return; const m = new THREE.Mesh(G[k].geometria(), mats[k]); m.castShadow = lod < 2; m.receiveShadow = true; m.name = k; g.add(m); });
      Object.keys(G.inst).forEach(k => { const L2 = G.inst[k]; if (!L2.length) return; const im = new THREE.InstancedMesh(INST[k].geo, INST[k].mat, L2.length); L2.forEach((m4, i) => im.setMatrixAt(i, m4)); im.castShadow = lod === 0; im.receiveShadow = true; im.name = 'inst_' + k; g.add(im); if (k === 'hoja') g.userData.hojas = im; });
      G.moviles.forEach(mv => { const m = new THREE.Mesh(mv.geo.geometria(), mats.detalle); m.position.set(...mv.centro); m.name = 'movil_' + mv.tipo; m.castShadow = lod < 2; g.add(m); moviles.push({malla: m, eje: new THREE.Vector3(...mv.eje), vel: mv.vel, fase: mv.fase, base: m.quaternion.clone()}); });
      return g; }); }
  const tris = [0, 0, 0], grupoRaiz = new THREE.Group(); grupoRaiz.name = 'pueblo_raiz';
  const cen = plan.plaza ? plan.plaza.c : [plan.parcelas[0] ? plan.parcelas[0].cx : 0, plan.parcelas[0] ? plan.parcelas[0].cz : 0];
  const nuevoLOD = (L, nombre) => { const gr = mallas(L, nombre), lo = new THREE.LOD(); lo.position.set(cen[0], 0, cen[1]); gr.forEach(g => g.position.set(-cen[0], 0, -cen[1]));
    lo.addLevel(gr[0], 0); lo.addLevel(gr[1], op.distLOD[0]); lo.addLevel(gr[2], op.distLOD[1]); lo.name = nombre; return {lod: lo, grupos: gr}; };
  let lodObj, grupos, porEdificio = [];
  const Lc = nuevoL();                                                       // calles, plaza y objetos sueltos (siempre compartido)
  if (!op.separados) { plan.parcelas.forEach((p, ix) => { const info = construye(Lc, p, ix, true); if (p.tipo !== 'huerto') edificios.push(info); });
    calles(Lc); const R = nuevoLOD(Lc, 'pueblo'); lodObj = R.lod; grupos = R.grupos; }
  else { calles(Lc); const R = nuevoLOD(Lc, 'pueblo'); lodObj = R.lod; grupos = R.grupos;
    plan.parcelas.forEach((p, ix) => { const L = nuevoL(), info = construye(L, p, ix, true); if (p.tipo !== 'huerto') edificios.push(info); const E = nuevoLOD(L, 'edificio_' + ix); grupoRaiz.add(E.lod); porEdificio[ix] = E; }); }
  grupoRaiz.add(lodObj);
  Lc.forEach((G, l) => { tris[l] += cuentaTris(G); });
  if (op.separados) edificios.forEach(e => e.tris.forEach((t, l) => { tris[l] += t; }));
  // calles adoquinadas, plaza, carros (en el mundo, en u)
  function calles(L) {
    if (!op.objetos && op.adoquines === false) return; const G = L[0], rr = rng(seed * 17 + 5), urbano = plan.tamano === 'grande' || plan.tamano === 'ciudad', ado = op.adoquines != null ? op.adoquines : plan.tamano !== 'aldea';
    [G.detalle, G.muro].forEach(g => { g.m.identity(); g.oscurece = 0; });
    if (ado && plan.plaza) { const pc = plan.plaza.c, rad = plan.tamano === 'ciudad' ? 120 : 70, paso = 1.6 * M;
      plan.calles.forEach(c => { if (c.tipo !== 'principal' && !urbano) return; const P = c.puntos, nA = Math.max(3, Math.round(c.ancho / (1.3 * M)));
        for (let i = 0; i < P.length - 1; i++) { const [ax, az] = P[i], [bx, bz] = P[i + 1], l = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / l, uz = (bz - az) / l, nx = -uz, nz = ux;
          for (let s = 0; s < l; s += paso) { const x0 = ax + ux * s, z0 = az + uz * s, s1 = Math.min(l, s + paso); if (Math.hypot(x0 - pc[0], z0 - pc[1]) > rad * M) continue; if (plan.rio && distPoli(x0, z0, plan.rio.puntos) < plan.rio.ancho / 2 + 2 * M) continue;
            for (let k = 0; k < nA; k++) { const a = -c.ancho / 2 + c.ancho * k / nA, b = a + c.ancho / nA, Q = (ss, tt) => { const x = ax + ux * ss + nx * tt, z = az + uz * ss + nz * tt; return [x, H(x, z) + 0.06 * M, z]; };
              G.detalle.quad(Q(s, a), Q(s, b), Q(s1, b), Q(s1, a), (k + Math.floor(s / paso)) % 2 ? C.adoquin : C.adoquinO); } } } });
      const rP = plan.plaza.r, nR = Math.max(3, Math.round(rP / (1.6 * M))), nS = 28;
      for (let i = 0; i < nR; i++) for (let j = 0; j < nS; j++) { const r0 = rP * i / nR, r1 = rP * (i + 1) / nR, a0 = j / nS * Math.PI * 2, a1 = (j + 1) / nS * Math.PI * 2, Q = (rr2, a) => { const x = pc[0] + Math.cos(a) * rr2, z = pc[1] + Math.sin(a) * rr2; return [x, H(x, z) + 0.07 * M, z]; };
        if (i === 0) G.detalle.tri(Q(0, 0), Q(r1, a1), Q(r1, a0), C.adoquinO); else G.detalle.quad(Q(r0, a0), Q(r1, a0), Q(r1, a1), Q(r0, a1), (i + j) % 2 ? C.adoquin : 0x807b72); } }
    if (op.objetos && plan.plaza) { const nC = 1 + Math.floor(rr() * (urbano ? 4 : 2));
      for (let k = 0; k < nC; k++) { const c = plan.calles[Math.floor(rr() * plan.calles.length)], P = c.puntos, i = 1 + Math.floor(rr() * (P.length - 2)), [ax, az] = P[i], [bx, bz] = P[i + 1], l = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / l, uz = (bz - az) / l, s = rr() < 0.5 ? 1 : -1;
        const x = ax - uz * s * (c.ancho / 2 - 1.0 * M), z = az + ux * s * (c.ancho / 2 - 1.0 * M), ry = Math.atan2(ux, uz) + (rr() - 0.5) * 0.4; if (plan.rio && distPoli(x, z, plan.rio.puntos) < plan.rio.ancho / 2 + 4 * M) continue; const m = new THREE.Matrix4().compose(new THREE.Vector3(x, H(x, z), z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry), new THREE.Vector3(M, M, M));
        G.inst.carro.push(m); S.objetos.push({tipo: 'carro', pos: [x, H(x, z), z], rot: ry}); S.colliders.push({tipo: 'caja', centro: [x, z], ancho: 1.4 * M, fondo: 3.0 * M, rot: ry, alto: 1.2 * M, base: H(x, z), edificio: 'carro', blando: true});
        S.cover.push({tipo: 'carro', pos: [x + Math.cos(ry) * 1.2 * M, H(x, z), z - Math.sin(ry) * 1.2 * M], alto: 'baja', protegeDe: [-Math.cos(ry), Math.sin(ry)], lados: ['arriba', 'izq', 'der'], capacidad: 2}); } }
  }
  // humo de las chimeneas: bocanadas instanciadas que suben y se ensanchan (sin asignaciones por fotograma)
  let humo = null; const PUFF = 6;
  if (op.humo && S.humos.length) { const geo = new THREE.IcosahedronGeometry(1, 0), mat = new THREE.MeshLambertMaterial({color: 0xb8b4ac, transparent: true, opacity: 0.42, depthWrite: false});
    humo = new THREE.InstancedMesh(geo, mat, S.humos.length * PUFF); humo.name = 'humo'; humo.frustumCulled = false; grupoRaiz.add(humo); }
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _e = new THREE.Vector3();
  function actualizar(t, viento) {
    const vx = viento ? viento[0] : 0.6, vz = viento ? viento[1] : 0.3;
    for (let i = 0; i < moviles.length; i++) { const mv = moviles[i]; _q.setFromAxisAngle(mv.eje, t * mv.vel + mv.fase); mv.malla.quaternion.copy(_q).multiply(mv.base); }
    if (humo) { for (let k = 0; k < S.humos.length; k++) { const h = S.humos[k]; for (let j = 0; j < PUFF; j++) { const f = ((t * 0.12 * h.intensidad + j / PUFF + h.fase) % 1), sc = (0.35 + f * 1.6) * M * (f > 0.85 ? (1 - f) / 0.15 : 1) * h.intensidad;
          _p.set(h.pos[0] + vx * f * 6 * M, h.pos[1] + f * 7 * M, h.pos[2] + vz * f * 6 * M); _s.set(sc, sc * 0.8, sc); _m.compose(_p, _q.identity(), _s); humo.setMatrixAt(k * PUFF + j, _m); } }
      humo.instanceMatrix.needsUpdate = true; }
  }
  // puertas: abrirPuerta(i, ángulo en radianes; + hacia dentro)
  const hojaM = new THREE.Matrix4(), hojaR = new THREE.Matrix4(), hojaS = new THREE.Matrix4();
  function abrirPuerta(i, ang) { const pu = S.puertas[i]; if (!pu) return false; pu.angulo = ang; const g = (op.separados ? porEdificio[pu.edificioIndice].grupos[0] : grupos[0]).userData.hojas; if (!g) return false;
    hojaM.fromArray(pu.base).multiply(hojaR.makeRotationY(ang)).multiply(hojaS.makeScale(pu.anchoM, pu.altoM, 0.06)); g.setMatrixAt(pu.indice, hojaM); g.instanceMatrix.needsUpdate = true; return true; }
  // daño en vivo (solo con op.separados): rehace el edificio i con el nivel pedido
  function danarEdificio(i, nivel) { if (!op.separados) return false; const p = plan.parcelas[i], E = porEdificio[i]; if (!p || !E) return false; p.danio = Math.max(0, Math.min(3, nivel | 0));
    grupoRaiz.remove(E.lod); E.grupos.forEach(g => g.traverse(o => { if (o.geometry && o.isMesh && !o.isInstancedMesh) o.geometry.dispose(); }));
    const L = nuevoL(), info = construye(L, p, i, false), E2 = nuevoLOD(L, 'edificio_' + i); grupoRaiz.add(E2.lod); porEdificio[i] = E2; const e = edificios.find(x => x.indice === i); if (e) { e.danio = p.danio; e.tris = info.tris; } return true; }
  const update = cam => { lodObj.update(cam); porEdificio.forEach(E => E && E.lod.update(cam)); };
  grupoRaiz.update = update;
  return {grupo: op.separados ? grupoRaiz : Object.assign(grupoRaiz, {}), lods: grupos, colliders: S.colliders, cover: S.cover, loopholes: S.loopholes, edificios, calles: plan.calles, plaza: plan.plaza, plataformas, plan, estilo: nombreEstilo,
    puertas: S.puertas, tiradores: S.tiradores, escaleras: S.escaleras, brechas: S.brechas, humos: S.humos, fuegos: S.fuegos, interiores: S.interiores, superficies: S.superficies, objetos: S.objetos, moviles,
    actualizar, abrirPuerta, danarEdificio, porEdificio,
    stats: {triangulos: tris, edificios: edificios.filter(e => e.tipo !== 'pozo').length, danados: edificios.filter(e => e.danio).length, colliders: S.colliders.length, cover: S.cover.length, loopholes: S.loopholes.length, puertas: S.puertas.length, tiradores: S.tiradores.length}};
}
// un solo edificio (catálogo, pruebas, o para colocarlo a mano): plan con una parcela
function construirEdificio(tipo, bioma, era, tf, op) {
  op = Object.assign({centro: [0, 0], rot: 0, uPorMetro: 1 / 0.6, semilla: 7}, op || {}); const M = op.uPorMetro, [w, d] = op.dims || TIPOS[tipo].dims(rng(op.semilla));
  const plan = {calles: [], plaza: null, parcelas: [{tipo, cx: op.centro[0], cz: op.centro[1], w: w * M, d: d * M, rot: op.rot}], rot: 0, M, semilla: op.semilla, bioma, era, tamano: 'aldea', rio: op.rio || null};
  return buildVillage(op.semilla, bioma, era, tf, Object.assign({}, op, {plan, adoquines: false}));
}
function cubiertaDe(ctx) { const st = ctx.st, t = ctx.p.tipo, R = rng((ctx.p.cx * 13 + ctx.p.cz * 7) | 0);
  if (/^(puente|vado|calvario|pozo|huerto|torre)/.test(t)) return st.cubierta;
  const rural = /casa_baja|granja|establo|granero/.test(t), nave = /almacen|establo|granja/.test(t);
  if (ctx.era === 0 && rural && /centroeuropeo|ingles|ruso/.test(ctx.estilo) && R() < (ctx.estilo === 'ruso' ? 0.55 : 0.35)) return 'paja';
  if (ctx.era >= 2 && nave && R() < 0.45) return 'chapa';
  if (ctx.era >= 3 && ctx.estilo === 'ruso' && R() < 0.35) return 'chapa';
  return st.cubierta; }
function colCubierta(ctx) { const c = ctx.cubierta; return c === 'paja' ? ctx.st.paja : CUBIERTA[c] || ctx.st.tejado; }

/* ---------- geometrías para instancias (en metros; la matriz de cada instancia ya incluye la escala M) ---------- */
let _INST = null;
function fusionar(geos) { const P = [], N = []; geos.forEach(g => { const q = g.index ? g.toNonIndexed() : g; q.computeVertexNormals(); const a = q.attributes.position.array, n = q.attributes.normal.array; for (let i = 0; i < a.length; i++) { P.push(a[i]); N.push(n[i]); } });
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); return g; }
function instGeos() {
  if (_INST) return _INST; const lam = c => new THREE.MeshLambertMaterial({color: c}), T = (g, x, y, z) => g.translate(x, y, z);
  const poste = T(new THREE.BoxGeometry(0.12, 1.1, 0.12), 0, 0.55, 0);
  const planta = new THREE.OctahedronGeometry(0.28, 0); planta.scale(1, 0.7, 1); planta.translate(0, 0.18, 0);
  const tumba = T(new THREE.BoxGeometry(0.5, 0.8, 0.12), 0, 0.4, 0);
  const escombro = new THREE.OctahedronGeometry(0.75, 0); escombro.scale(1, 0.6, 1); escombro.translate(0, 0.3, 0);
  const paca = T(new THREE.CylinderGeometry(1.4, 2.0, 2.6, 7, 1), 0, 1.3, 0);
  const hoja = T(new THREE.BoxGeometry(1, 1, 1), 0.5, 0.5, 0);                                    // hoja de puerta: bisagra en x = 0
  const barril = T(new THREE.CylinderGeometry(0.27, 0.27, 0.85, 8, 1), 0, 0.425, 0);
  const cubo = T(new THREE.CylinderGeometry(0.17, 0.13, 0.3, 6, 1, true), 0, 0.15, 0);
  const lena = fusionar([0, 1, 2].flatMap(k => [-0.5, 0, 0.5].map(x => T(new THREE.CylinderGeometry(0.1, 0.1, 1.0, 5).rotateX(Math.PI / 2), x * (1 - k * 0.15), 0.1 + k * 0.18, 0))));
  const carro = fusionar([T(new THREE.BoxGeometry(1.3, 0.12, 2.2), 0, 0.75, 0), T(new THREE.BoxGeometry(0.05, 0.4, 2.2), 0.62, 0.95, 0), T(new THREE.BoxGeometry(0.05, 0.4, 2.2), -0.62, 0.95, 0),
    T(new THREE.CylinderGeometry(0.55, 0.55, 0.08, 10).rotateZ(Math.PI / 2), 0.72, 0.55, 0.1), T(new THREE.CylinderGeometry(0.55, 0.55, 0.08, 10).rotateZ(Math.PI / 2), -0.72, 0.55, 0.1),
    T(new THREE.BoxGeometry(0.06, 0.06, 1.8), 0.3, 0.7, 1.8), T(new THREE.BoxGeometry(0.06, 0.06, 1.8), -0.3, 0.7, 1.8)]);
  const banco = fusionar([T(new THREE.BoxGeometry(1.4, 0.06, 0.32), 0, 0.45, 0), T(new THREE.BoxGeometry(0.06, 0.45, 0.28), 0.6, 0.22, 0), T(new THREE.BoxGeometry(0.06, 0.45, 0.28), -0.6, 0.22, 0)]);
  const cruz = fusionar([T(new THREE.BoxGeometry(0.14, 2.6, 0.14), 0, 1.3, 0), T(new THREE.BoxGeometry(1.2, 0.14, 0.14), 0, 1.95, 0)]);
  const baliza = fusionar([T(new THREE.CylinderGeometry(0.05, 0.06, 1.8, 5), 0, 0.9, 0), T(new THREE.CylinderGeometry(0.07, 0.07, 0.25, 5), 0, 1.55, 0)]);
  const t = g => (g.index ? g.index.count : g.attributes.position.count) / 3;
  _INST = {poste: {geo: poste, mat: lam(0x6a4a30)}, planta: {geo: planta, mat: lam(0x4e7a34)}, tumba: {geo: tumba, mat: lam(0x9a968c)}, escombro: {geo: escombro, mat: lam(0x8a8070)}, paca: {geo: paca, mat: lam(0xb09a58)},
    hoja: {geo: hoja, mat: lam(0x5a3a24)}, barril: {geo: barril, mat: lam(0x7a5230)}, cubo: {geo: cubo, mat: lam(0x6a6a66)}, lena: {geo: lena, mat: lam(0x8a6a44)}, carro: {geo: carro, mat: lam(0x6a4a2e)}, banco: {geo: banco, mat: lam(0x6a4a30)},
    cruz: {geo: cruz, mat: lam(0x4a3424)}, baliza: {geo: baliza, mat: lam(0xd8d0c0)}};
  Object.values(_INST).forEach(o => { o.tris = t(o.geo); });
  return _INST;
}
function instM(ctx, x, y, z, ry, sx, sy, sz) { const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry || 0, 0)), new THREE.Vector3(sx || 1, sy || 1, sz || 1)); return ctx.mat.clone().multiply(m); }
function aMundo(ctx, x, z) { const e = ctx.mat.elements; return [e[0] * x + e[8] * z + e[12], e[2] * x + e[10] * z + e[14]]; }
function aMundo3(ctx, x, y, z) { const e = ctx.mat.elements; return [e[0] * x + e[4] * y + e[8] * z + e[12], e[1] * x + e[5] * y + e[9] * z + e[13], e[2] * x + e[6] * y + e[10] * z + e[14]]; }
function dirMundo(ctx, x, z) { const e = ctx.mat.elements, a = e[0] * x + e[8] * z, b = e[2] * x + e[10] * z, l = Math.hypot(a, b) || 1; return [a / l, b / l]; }
// sub-sistema local: desplaza/gira el origen del edificio (granjas con varias construcciones, haciendas, adosadas)
function sub(ctx, x, z, ry, ww, dd, fn) { const m = new THREE.Matrix4().makeRotationY(ry || 0).setPosition(x, 0, z), G = ctx.G, prev = ctx.mat, W0 = ctx.w, D0 = ctx.d;
  conMatriz([G.muro, G.tejado, G.detalle], m, () => { ctx.mat = prev.clone().multiply(m); ctx.w = ww; ctx.d = dd; fn(); }); ctx.mat = prev; ctx.w = W0; ctx.d = D0; }
// pieza que gira (aspas, rueda): se dibuja en su propio Geo, centrada en el eje; eje local → mundo
function movil(ctx, tipo, centro, eje, vel, dibuja) { const cw = aMundo3(ctx, ...centro), g = new Geo(); g.m.makeTranslation(-cw[0], -cw[1], -cw[2]).multiply(ctx.mat).multiply(new THREE.Matrix4().makeTranslation(...centro));
  dibuja(g); const e = ctx.mat.elements, a = [e[0] * eje[0] + e[4] * eje[1] + e[8] * eje[2], e[1] * eje[0] + e[5] * eje[1] + e[9] * eje[2], e[2] * eje[0] + e[6] * eje[1] + e[10] * eje[2]], l = Math.hypot(...a);
  ctx.G.moviles.push({tipo, geo: g, centro: cw, eje: a.map(v => v / l), vel, fase: ctx.r() * 6.28}); return g.tris(); }

/* ---------- piezas comunes ---------- */
function zocalo(ctx, w, d, x, z) { ctx.G.muro.caja(x || 0, ctx.cim, z || 0, w + 0.16, ctx.suelo - ctx.cim + 0.35, d + 0.16, ctx.st.zocalo); }
// paredes de una planta: con daño 3, tramos irregulares; con ctx.hueco (puerta en la fachada +z) la cara delantera queda abierta
function paredes(ctx, w, d, y, h, col) {
  const G = ctx.G.muro, R = ctx.r;
  if (ctx.danio >= 3) {
    const seg = Math.max(2, Math.round(w / 2.2)), segd = Math.max(2, Math.round(d / 2.2));
    [[w, d / 2, 0], [w, -d / 2, Math.PI], [d, w / 2, -Math.PI / 2], [d, -w / 2, Math.PI / 2]].forEach(([len, off, ry], k) => {
      const n = ctx.lod === 2 ? 1 : ctx.lod === 1 ? Math.min(2, k < 2 ? seg : segd) : k < 2 ? seg : segd; for (let i = 0; i < n; i++) { const hh = h * (0.25 + R() * 0.75); if (R() < 0.15) continue; const lx = -len / 2 + (i + 0.5) * len / n;
        const px = k < 2 ? lx : off, pz = k < 2 ? off : lx; G.caja(px, y, pz, k < 2 ? len / n + 0.02 : 0.45, hh, k < 2 ? 0.45 : len / n + 0.02, col); } });
    if (ctx.lod === 0) for (let k = 0; k < 3; k++) { const x0 = (R() - 0.5) * w * 0.8; ctx.G.detalle.caja(x0, y + h * 0.15, (R() - 0.5) * d * 0.5, 0.2, 0.2, d * 0.9, C.quemado, {rx: 0, rz: 0.25 + R() * 0.3}); }   // vigas quemadas
    return y + h * 0.5;
  }
  const hu = ctx.hueco;
  if (!hu || ctx.lod > 0) { G.caja(0, y, 0, w, h, d, col, {sinTecho: true}); return y + h; }
  const a = [-w / 2, y, d / 2], b = [w / 2, y, d / 2], c = [w / 2, y, -d / 2], e = [-w / 2, y, -d / 2], A = [-w / 2, y + h, d / 2], B = [w / 2, y + h, d / 2], Cc = [w / 2, y + h, -d / 2], E = [-w / 2, y + h, -d / 2];
  G.quad(b, c, Cc, B, col); G.quad(c, e, E, Cc, col); G.quad(e, a, A, E, col);
  const u0 = hu.u - hu.pw / 2, u1 = hu.u + hu.pw / 2, yt = y + hu.ph, z = d / 2;
  G.quad([-w / 2, y, z], [u0, y, z], [u0, y + h, z], [-w / 2, y + h, z], col); G.quad([u1, y, z], [w / 2, y, z], [w / 2, y + h, z], [u1, y + h, z], col); G.quad([u0, yt, z], [u1, yt, z], [u1, y + h, z], [u0, y + h, z], col);
  const t = 0.24, jc = ctx.st.marco;                                                                  // jambas y dintel (grosor del muro)
  G.quad([u0, y, z], [u0, y, z - t], [u0, yt, z - t], [u0, yt, z], jc); G.quad([u1, y, z - t], [u1, y, z], [u1, yt, z], [u1, yt, z - t], jc); G.quad([u0, yt, z], [u0, yt, z - t], [u1, yt, z - t], [u1, yt, z], jc);
  return y + h;
}
// tejado a dos aguas (cumbrera a lo largo de x) o a cuatro aguas; cubierta con hiladas/ondas en el LOD0; devuelve la altura de la cumbrera
function tejado(ctx, w, d, y, tipo, o) {
  o = o || {}; const st = ctx.st, G = ctx.G.tejado, v = o.vuelo != null ? o.vuelo : st.vuelo, pend = (o.pend || st.pend) * Math.PI / 180, alto = Math.tan(pend) * d / 2, col = o.col || colCubierta(ctx);
  const W = w / 2 + v, D = d / 2 + v, top = y + alto, yb = y - v * Math.tan(pend);
  if (ctx.danio >= 3) return y;
  const hund = ctx.danio === 2 && ctx.lod < 2, cub = ctx.cubierta;
  if (tipo === 'cuatro') {
    const rx = Math.max(0.01, W - D);
    G.quad([-W, yb, D], [W, yb, D], [rx, top, 0], [-rx, top, 0], col); G.quad([W, yb, -D], [-W, yb, -D], [-rx, top, 0], [rx, top, 0], col);
    G.tri([W, yb, D], [W, yb, -D], [rx, top, 0], col); G.tri([-W, yb, -D], [-W, yb, D], [-rx, top, 0], col);
    if (st.irimoya && ctx.lod < 2) { const hg = Math.min(alto * 0.35, 1.2), xg = rx + (W - rx) * 0.25; [1, -1].forEach(s => ctx.G.muro.quad2([s * xg, top - hg, -D * 0.25], [s * xg, top - hg, D * 0.25], [s * rx, top, 0], [s * rx, top, 0], st.viga));
      ctx.G.detalle.caja(0, top - 0.05, 0, rx * 2 + 0.6, 0.32, 0.36, 0x3a3c3e); }                    // hastial pequeño del irimoya y cumbrera
  } else {
    if (hund) {
      const a = -W + ctx.r() * W * 0.6, b = a + W * (0.6 + ctx.r() * 0.5);
      G.quad([-W, yb, D], [a, yb, D], [a, top, 0], [-W, top, 0], col); if (b < W) G.quad([b, yb, D], [W, yb, D], [W, top, 0], [b, top, 0], col);
      for (let x = a + 0.6; x < Math.min(W, b); x += 1.1) ctx.G.detalle.caja(x, yb, D / 2, 0.14, 0.14, D + 0.1, C.maderaO, {rx: Math.atan2(alto + v * Math.tan(pend), D)});   // vigas a la vista
    } else G.quad([-W, yb, D], [W, yb, D], [W, top, 0], [-W, top, 0], col);
    G.quad([W, yb, -D], [-W, yb, -D], [-W, top, 0], [W, top, 0], col);
    const cg = o.colHastial || ctx.st.muro;
    ctx.G.muro.tri([-w / 2, y, d / 2], [-w / 2, top - v * 0.2, 0], [-w / 2, y, -d / 2], cg); ctx.G.muro.tri([w / 2, y, -d / 2], [w / 2, top - v * 0.2, 0], [w / 2, y, d / 2], cg);
    if (ctx.lod === 0) { G.quad([-W, yb - (cub === 'paja' ? 0.3 : 0.12), D], [W, yb - (cub === 'paja' ? 0.3 : 0.12), D], [W, yb, D], [-W, yb, D], cub === 'paja' ? col : 0x3a2a1e); G.quad([W, yb - (cub === 'paja' ? 0.3 : 0.12), -D], [-W, yb - (cub === 'paja' ? 0.3 : 0.12), -D], [-W, yb, -D], [W, yb, -D], cub === 'paja' ? col : 0x3a2a1e);
      hiladas(ctx, W, D, yb, top, col, hund);
      if (ctx.danio === 1) for (let k = 0; k < 2; k++) { const x = (ctx.r() - 0.5) * W * 1.4, s = 0.2 + ctx.r() * 0.5, P = (xx, ss) => [xx, yb + (top - yb) * ss + 0.03, D * (1 - ss) + 0.02]; G.quad(P(x - 0.4, s), P(x + 0.4, s), P(x + 0.4, s + 0.18), P(x - 0.4, s + 0.18), C.hueco); } }   // tejas caídas
    if (st.nieve && !hund) { const e = 0.04; G.quad([-W, yb + e + 0.1, D * 0.98], [W, yb + e + 0.1, D * 0.98], [W, top + e, 0], [-W, top + e, 0], st.nieve); G.quad([W, yb + e + 0.1, -D * 0.98], [-W, yb + e + 0.1, -D * 0.98], [-W, top + e, 0], [W, top + e, 0], st.nieve); }
  }
  return top;
}
// hiladas de teja / pizarra / ripia, ondas de chapa con óxido, caballete de paja (LOD0, sobre los dos faldones de un tejado a dos aguas)
function hiladas(ctx, W, D, yb, top, col, hund) {
  const G = ctx.G.tejado, cub = ctx.cubierta, c2 = new THREE.Color(col).multiplyScalar(0.78).getHex(), L = Math.hypot(top - yb, D), off = 0.025;
  [1, -1].forEach(sz => { if (hund && sz > 0) return; const P = (x, s, e) => { const y = yb + (top - yb) * s, z = sz * D * (1 - s); return [x, y + (e || off) * D / L, z + sz * (e || off) * (top - yb) / L]; };
    if (cub === 'chapa') { const n = Math.min(30, Math.round(2 * W / 0.55)); for (let i = 0; i <= n; i++) { const x = -W + 2 * W * i / n; const q = [P(x - 0.04, 0), P(x + 0.04, 0), P(x + 0.04, 1), P(x - 0.04, 1)]; if (sz > 0) G.quad(...q, c2); else G.quad(q[1], q[0], q[3], q[2], c2); }
      const ox = (ctx.r() - 0.5) * W; const q = [P(ox - 0.9, 0.05, 0.03), P(ox + 0.9, 0.05, 0.03), P(ox + 0.6, 0.45, 0.03), P(ox - 0.7, 0.4, 0.03)]; if (sz > 0) G.quad(...q, C.oxido); else G.quad(q[1], q[0], q[3], q[2], C.oxido); return; }
    if (cub === 'paja') { const q = [P(-W, 0.9, 0.12), P(W, 0.9, 0.12), P(W, 1, 0.12), P(-W, 1, 0.12)]; if (sz > 0) G.quad(...q, c2); else G.quad(q[1], q[0], q[3], q[2], c2); return; }
    const paso = cub === 'pizarra' ? 0.36 : cub === 'ripia' ? 0.3 : 0.42, n = Math.min(9, Math.floor(L / paso));
    for (let i = 1; i <= n; i++) { const s = i / (n + 1), q = [P(-W, s), P(W, s), P(W, s + 0.012 * paso * 10 / L), P(-W, s + 0.012 * paso * 10 / L)]; if (sz > 0) G.quad(...q, c2); else G.quad(q[1], q[0], q[3], q[2], c2); } });
  if (cub !== 'chapa') ctx.G.detalle.caja(0, top - 0.06, 0, 2 * W, 0.14, 0.22, cub === 'paja' ? c2 : new THREE.Color(col).multiplyScalar(0.7).getHex(), {});   // caballete
}
// azotea transitable con pretil (mediterránea, hacienda, adosadas): devuelve la cota del suelo de la azotea; puntos de tirador en el pretil
function azotea(ctx, w, d, y, o) {
  o = o || {}; const G = ctx.G, col = o.col || ctx.st.muro, pre = 0.95;
  if (ctx.danio >= 3) return y;
  G.muro.caja(0, y - 0.05, 0, w + 0.1, 0.25, d + 0.1, 0xb8a888, {colTecho: 0xa89878});
  if (ctx.lod < 2) [[0, d / 2, w, 0.22], [0, -d / 2, w, 0.22], [w / 2, 0, 0.22, d], [-w / 2, 0, 0.22, d]].forEach(([x, z, ww, dd]) => G.muro.caja(x, y + 0.2, z, ww, pre, dd, col, {colTecho: 0xd8d0c0}));
  if (ctx.salida) [[0, d / 2 - 0.5, 0, 1], [0, -d / 2 + 0.5, 0, -1], [w / 2 - 0.5, 0, 1, 0], [-w / 2 + 0.5, 0, -1, 0]].forEach(([lx, lz, fx, fz]) => { const [x, yy, z] = aMundo3(ctx, lx, y + 0.2, lz);
    ctx.salida.tiradores.push({tipo: 'azotea', pos: [x, yy, z], dir: dirMundo(ctx, fx, fz), alto: 'baja', edificio: ctx.p.tipo, acceso: o.acceso || null}); });
  return y + 0.2;
}
// escalera exterior adosada a la cara +x (de y0 a y1, subiendo hacia −z): peldaños macizos
function escaleraExt(ctx, w, d, y0, y1) {
  if (ctx.lod === 2 || ctx.danio >= 3) return null; const G = ctx.G.muro, h = y1 - y0, n = Math.max(4, Math.round(h / 0.2)), paso = Math.min(0.28, (d - 0.8) / n), z0 = d / 2 - 0.3;
  for (let i = 0; i < n; i++) G.caja(w / 2 + 0.55, y0, z0 - (i + 0.5) * paso, 1.0, (i + 1) * h / n, paso, ctx.st.zocalo, {colTecho: 0xa09888});
  const base = aMundo3(ctx, w / 2 + 0.55, y0, z0 + 0.4), cima = aMundo3(ctx, w / 2 + 0.55, y1, z0 - n * paso);
  if (ctx.salida) ctx.salida.escaleras.push({tipo: 'exterior', base, cima, edificio: ctx.p.tipo}); return base;
}
// escalera de mano apoyada en una pared (cara +x) hasta el alero: acceso al tejado
function escaleraMano(ctx, w, d, y0, y1, z) {
  if (ctx.lod !== 0 || ctx.danio >= 3) return null; const G = ctx.G.detalle, L = y1 - y0 + 0.4, inc = 0.28;
  [-0.22, 0.22].forEach(dz => G.caja(w / 2 + 0.25 + L * Math.sin(inc) / 2, y0, (z || 0) + dz, 0.06, L, 0.06, C.madera, {rz: inc}));
  for (let k = 1; k < L / 0.32; k++) { const yy = k * 0.32, x = w / 2 + 0.25 + L * Math.sin(inc) - yy * Math.tan(inc); G.caja(x, y0 + yy * Math.cos(inc), z || 0, 0.04, 0.04, 0.46, C.madera); }
  const base = aMundo3(ctx, w / 2 + 0.25 + L * Math.sin(inc), y0, z || 0), cima = aMundo3(ctx, w / 2, y1, z || 0);
  if (ctx.salida) { ctx.salida.escaleras.push({tipo: 'mano', base, cima, edificio: ctx.p.tipo}); ctx.salida.tiradores.push({tipo: 'tejado', pos: aMundo3(ctx, w / 2 - 0.6, y1 + 0.4, z || 0), dir: dirMundo(ctx, 1, 0), alto: 'tumbado', edificio: ctx.p.tipo, acceso: base}); }
  return base; }
function chimenea(ctx, x, z, ytop, h) {
  if (ctx.lod === 2 || ctx.danio >= 3) return; const col = ctx.st === ESTILOS.ingles || ctx.st === ESTILOS.americano ? 0x8a4434 : C.piedraO, rota = ctx.danio === 2, hh = (h || 0.9) * (rota ? 0.4 : 1);
  ctx.G.detalle.caja(x, ytop - 1.2, z, 0.7, 1.2 + hh, 0.7, col); if (ctx.lod === 0 && !rota) ctx.G.detalle.caja(x, ytop + hh - 0.05, z, 0.9, 0.14, 0.9, 0x4a4640);
  if (ctx.salida && !rota) {   // se anota siempre; el humo propio solo se dibuja con op.humo (con efectos_batalla3d: {humo: false} y FX.chimeneas(P))
     const k = /panaderia|herreria|taberna|posada/.test(ctx.p.tipo) ? 1 : 0.6; if (ctx.r() < k) ctx.salida.humos.push({pos: aMundo3(ctx, x, ytop + hh + 0.1, z), intensidad: /panaderia|herreria/.test(ctx.p.tipo) ? 1.3 : 0.8 + ctx.r() * 0.3, fase: ctx.r(), edificio: ctx.p.tipo}); }
  if (ctx.salida && ctx.danio >= 2 && ctx.r() < 0.4) ctx.salida.fuegos.push({pos: aMundo3(ctx, x * 0.5, ytop - 1, z * 0.5), tamano: 2 * ctx.M, edificio: ctx.p.tipo});
}
// ventana en la fachada: cara (0 frente +z, 1 detrás, 2 derecha +x, 3 izquierda); u = posición a lo largo de la cara; y = base
function ventana(ctx, w, d, cara, u, y, vw, vh, planta) {
  const st = ctx.st, G = ctx.G.detalle, e = 0.025, P = (a, b, c) => cara === 0 ? [a, b, d / 2 + c] : cara === 1 ? [-a, b, -d / 2 - c] : cara === 2 ? [w / 2 + c, b, -a] : [-w / 2 - c, b, a];
  const pRoto = [0, 0.6, 0.55, 0.9][ctx.danio] || 0, roto = ctx.r() < pRoto, col = roto ? C.hueco : st.shoji ? C.shoji : C.cristal;
  const Q = (a0, a1, b0, b1, cc, col2) => G.quad(P(a0, b0, cc), P(a1, b0, cc), P(a1, b1, cc), P(a0, b1, cc), col2);
  if (ctx.lod <= 1) Q(u - vw / 2, u + vw / 2, y, y + vh, e * 2, col);
  if (ctx.lod === 0) { const f = 0.12; Q(u - vw / 2 - f, u + vw / 2 + f, y - f, y + vh + f, e, st.marco);
    if (!st.shoji) Q(u - vw / 2 - f * 1.5, u + vw / 2 + f * 1.5, y - f * 1.6, y - f * 0.6, e * 3, C.piedra);   // alféizar
    if (!roto && (st.shoji || !st.postigo || ctx.sinPostigo)) { Q(u - 0.02, u + 0.02, y, y + vh, e * 2.6, st.shoji ? st.viga : st.marco); Q(u - vw / 2, u + vw / 2, y + vh * 0.5 - 0.02, y + vh * 0.5 + 0.02, e * 2.6, st.shoji ? st.viga : st.marco); }   // parteluz y travesaño (guillotina / shoji)
    if (st.postigo && !ctx.sinPostigo) { const pc = st.postigo[Math.floor(ctx.r() * st.postigo.length)], estado = ctx.danio >= 1 && ctx.r() < 0.4 ? 'caido' : ctx.r() < 0.25 ? 'cerrado' : 'abierto';
      if (estado === 'cerrado') Q(u - vw / 2, u + vw / 2, y, y + vh, e * 2.4, pc);
      else [-1, 1].forEach(s => { const x0 = u + s * (vw / 2 + 0.05), x1 = u + s * (vw / 2 + 0.05 + vw * 0.5); if (estado === 'caido' && s > 0) { G.quad(P(Math.min(x0, x1), y - 0.3, e * 4), P(Math.max(x0, x1), y - 0.1, e * 4), P(Math.max(x0, x1) - 0.1, y + vh - 0.4, e * 4), P(Math.min(x0, x1) - 0.1, y + vh - 0.5, e * 4), pc); return; }
        Q(Math.min(x0, x1), Math.max(x0, x1), y, y + vh, e * 1.5, pc); }); }
    if (ctx.danio >= 1 && ctx.r() < 0.5) Q(u - vw / 2 - 0.1, u + vw / 2 + 0.1, y + vh + 0.15, y + vh + 0.9, e * 0.6, C.hollin); }   // hollín sobre el hueco
  if (cara === 0 && planta === 0) ctx.ventanas.push([u, y, vw, vh]);
  if (ctx.salida) { const [lx, , lz] = P(u, 0, -0.3), [ox, , oz] = P(u, 0, 1), [wx, wz] = aMundo(ctx, lx, lz), [qx, qz] = aMundo(ctx, ox, oz), dl = Math.hypot(qx - wx, qz - wz);
    ctx.salida.loopholes.push({tipo: roto ? 'boquete' : 'ventana', pos: [wx, (y + vh * 0.55) * ctx.M, wz], dir: [(qx - wx) / dl, (qz - wz) / dl], planta, edificio: ctx.salida.info.tipo, ancho: vw * ctx.M}); }
}
// puerta: en el LOD0 una hoja instanciada (se abre con P.abrirPuerta) delante del hueco oscuro; con ctx.hueco la pared ya está abierta
function puerta(ctx, w, d, u, y, pw, ph, col) {
  const G = ctx.G.detalle, e = 0.03, ruina = ctx.danio >= 3;
  if (ctx.lod > 0) G.quad([u - pw / 2, y, d / 2 + e * 2], [u + pw / 2, y, d / 2 + e * 2], [u + pw / 2, y + ph, d / 2 + e * 2], [u - pw / 2, y + ph, d / 2 + e * 2], col || ctx.st.puerta);
  if (ctx.lod === 0) { if (!ctx.hueco) G.quad([u - pw / 2, y, d / 2 + e * 2], [u + pw / 2, y, d / 2 + e * 2], [u + pw / 2, y + ph, d / 2 + e * 2], [u - pw / 2, y + ph, d / 2 + e * 2], C.hueco);
    G.quad([u - pw / 2 - 0.14, y, d / 2 + e], [u + pw / 2 + 0.14, y, d / 2 + e], [u + pw / 2 + 0.14, y + ph + 0.14, d / 2 + e], [u - pw / 2 - 0.14, y + ph + 0.14, d / 2 + e], ctx.st.marco);
    G.caja(u, y - 0.18, d / 2 + 0.3, pw + 0.4, 0.18, 0.5, C.piedra);
    if (!ruina) { const ang = ctx.danio >= 2 && ctx.r() < 0.5 ? 1.3 : ctx.r() < 0.12 ? 1.1 : 0, base = ctx.mat.clone().multiply(new THREE.Matrix4().makeTranslation(u - pw / 2, y, d / 2 - (ctx.hueco ? 0.12 : -0.05)));
      const m = base.clone().multiply(new THREE.Matrix4().makeRotationY(ang)).multiply(new THREE.Matrix4().makeScale(pw, ph, 0.06)), idx = ctx.G.inst.hoja.length; ctx.G.inst.hoja.push(m);
      if (ctx.salida) { const [wx, wz] = aMundo(ctx, u, d / 2 + 0.5); ctx.salida.puertas.push({indice: idx, edificioIndice: ctx.salida.info.indice, base: base.elements.slice(), anchoM: pw, altoM: ph, angulo: ang, pos: [wx, y * ctx.M, wz], dir: dirMundo(ctx, 0, 1), ancho: pw * ctx.M, alto: ph * ctx.M, edificio: ctx.p.tipo, interior: !!ctx.hueco}); } } }
  if (ctx.salida) { const [wx, wz] = aMundo(ctx, u, d / 2 + 0.5); ctx.salida.loopholes.push({tipo: 'puerta', pos: [wx, y * ctx.M, wz], dir: dirMundo(ctx, 0, 1), planta: 0, edificio: ctx.salida.info.tipo, ancho: pw * ctx.M}); }
}
// interior de planta baja: paredes interiores (con el hueco de la puerta), suelo, techo, mesa, banco y mueble por tipo (LOD0)
function interior(ctx, w, d, y, h, tipo) {
  if (!ctx.interior || ctx.lod !== 0) return; const G = ctx.G.detalle, e = 0.24, W2 = w / 2 - e, D2 = d / 2 - e, ci = ctx.st.interiorMuro, hu = ctx.hueco, yt = y + h - 0.02;
  const suelo = /herreria|panaderia/.test(tipo) || ctx.estilo === 'mediterraneo' ? C.baldosa : C.suelo;
  G.quad([-W2, y + 0.01, D2], [W2, y + 0.01, D2], [W2, y + 0.01, -D2], [-W2, y + 0.01, -D2], suelo); G.quad([-W2, yt, -D2], [W2, yt, -D2], [W2, yt, D2], [-W2, yt, D2], 0x5a4a3a);
  G.quad([W2, y, -D2], [-W2, y, -D2], [-W2, yt, -D2], [W2, yt, -D2], ci); G.quad([-W2, y, -D2], [-W2, y, D2], [-W2, yt, D2], [-W2, yt, -D2], ci); G.quad([W2, y, D2], [W2, y, -D2], [W2, yt, -D2], [W2, yt, D2], ci);
  if (hu) { const u0 = hu.u - hu.pw / 2, u1 = hu.u + hu.pw / 2, ytt = y + hu.ph; G.quad([u0, y, D2], [-W2, y, D2], [-W2, yt, D2], [u0, yt, D2], ci); G.quad([W2, y, D2], [u1, y, D2], [u1, yt, D2], [W2, yt, D2], ci); G.quad([u1, ytt, D2], [u0, ytt, D2], [u0, yt, D2], [u1, yt, D2], ci); }
  else G.quad([-W2, y, D2], [W2, y, D2], [W2, yt, D2], [-W2, yt, D2], ci);
  ctx.ventanas.forEach(([u, vy, vw, vh]) => G.quad([u + vw / 2, vy, D2 - 0.01], [u - vw / 2, vy, D2 - 0.01], [u - vw / 2, vy + vh, D2 - 0.01], [u + vw / 2, vy + vh, D2 - 0.01], 0xa8b8c4));   // luz de las ventanas
  const mesa = (x, z, mw, md) => { G.caja(x, y + 0.72, z, mw, 0.05, md, C.madera); [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([a, b]) => G.caja(x + a * (mw / 2 - 0.06), y, z + b * (md / 2 - 0.06), 0.06, 0.72, 0.06, C.maderaO, {sinTecho: true})); };
  if (tipo === 'taberna') { G.caja(-W2 + 0.4, y, -0.5, 0.6, 1.05, d * 0.5, C.maderaO, {colTecho: C.madera}); [0.4, 1.0].forEach((z, k) => G.cil(-W2 + 0.3, y, -D2 + 0.4 + k * 0.7, 0.3, 0.3, 0.8, 6, C.madera, {tapa: true})); mesa(1.0, 0.3, 1.2, 0.8); mesa(W2 - 1, -D2 + 1.2, 1.0, 0.7); }
  else if (tipo === 'panaderia') { G.caja(0, y, -D2 + 0.7, 1.6, 1.0, 1.2, 0xb8a080, {colTecho: 0x9a8a70}); G.quad([-0.3, y + 0.4, -D2 + 1.31], [0.3, y + 0.4, -D2 + 1.31], [0.3, y + 0.8, -D2 + 1.31], [-0.3, y + 0.8, -D2 + 1.31], C.brasa); mesa(1.2, 0.6, 1.6, 0.7); }
  else if (tipo === 'herreria') { G.caja(-W2 + 0.8, y, -D2 + 0.8, 1.3, 0.85, 1.3, C.piedraO, {colTecho: C.brasa}); G.caja(0.8, y, -0.3, 0.25, 0.6, 0.25, C.maderaO); G.caja(0.8, y + 0.6, -0.3, 0.2, 0.18, 0.55, C.hierro); }
  else if (tipo === 'ayuntamiento') { mesa(0, -0.6, 2.4, 1.0); [-0.8, 0, 0.8].forEach(x => G.caja(x, y, -1.5, 0.45, 0.9, 0.45, C.madera)); }
  else { mesa(0.3, -0.4, 1.3, 0.8); G.caja(0.3, y, 0.35, 1.2, 0.45, 0.3, C.madera); G.caja(-W2 + 0.45, y, -D2 + 1.2, 0.5, 1.0, 1.2, C.piedraO, {colTecho: 0x4a4640}); G.quad([-W2 + 0.71, y + 0.15, -D2 + 0.9], [-W2 + 0.71, y + 0.15, -D2 + 1.5], [-W2 + 0.71, y + 0.65, -D2 + 1.5], [-W2 + 0.71, y + 0.65, -D2 + 0.9], C.hueco); }
  if (ctx.salida) { const [x, z] = aMundo(ctx, 0, 0); ctx.salida.interiores.push({edificio: ctx.p.tipo, edificioIndice: ctx.salida.info.indice, centro: [x, z], ancho: 2 * W2 * ctx.M, fondo: 2 * D2 * ctx.M, rot: ctx.p.rot, suelo: y * ctx.M, alto: h * ctx.M, puerta: hu ? aMundo(ctx, hu.u, d / 2) : null}); }
}
// decoración de muros por estilo (entramado, troncos, tablas, postes japoneses, esquinas de sillería)
function decoMuro(ctx, w, d, y0, h) {
  if (ctx.lod !== 0 || ctx.danio >= 3) return; const st = ctx.st, G = ctx.G.detalle, e = 0.015, t = 0.16;
  // las cuatro caras: P(a, y, c) con a a lo largo de la cara (−L/2…L/2) y c hacia fuera; L = largo de esa cara
  const caras = (fn) => { fn((a, b, c) => [a, b, d / 2 + c], w); fn((a, b, c) => [-a, b, -d / 2 - c], w); fn((a, b, c) => [w / 2 + c, b, -a], d); fn((a, b, c) => [-w / 2 - c, b, a], d); };
  if (st.entramado === 1) {
    caras((P, L) => { [y0 + 0.05, y0 + h - t].forEach(yy => G.quad(P(-L / 2, yy, e), P(L / 2, yy, e), P(L / 2, yy + t, e), P(-L / 2, yy + t, e), st.viga));
      const n = Math.max(2, Math.round(L / 2.4)), paso = L / n;
      for (let k = 0; k <= n; k++) { const a = Math.min(L / 2 - t, Math.max(-L / 2, -L / 2 + k * paso - t / 2)); G.quad(P(a, y0, e), P(a + t, y0, e), P(a + t, y0 + h, e), P(a, y0 + h, e), st.viga); }
      // riostras en los vanos de los extremos (en aspa la de la izquierda, simple la de la derecha) y un travesaño a media altura
      const x0 = -L / 2 + t, x1 = -L / 2 + paso - t / 2, x2 = L / 2 - paso + t / 2, x3 = L / 2 - t;
      G.quad(P(x0, y0 + 0.2, e), P(x0 + t, y0 + 0.2, e), P(x1, y0 + h - 0.2, e), P(x1 - t, y0 + h - 0.2, e), st.viga);
      G.quad(P(x3 - t, y0 + 0.2, e), P(x3, y0 + 0.2, e), P(x2 + t, y0 + h - 0.2, e), P(x2, y0 + h - 0.2, e), st.viga);
      if (L > 6) G.quad(P(-L / 2, y0 + h * 0.5, e), P(L / 2, y0 + h * 0.5, e), P(L / 2, y0 + h * 0.5 + 0.1, e), P(-L / 2, y0 + h * 0.5 + 0.1, e), st.viga); });
  }
  if (st.entramado === 2) caras((P, L) => { const n = Math.max(2, Math.round(L / 1.8)); for (let k = 0; k <= n; k++) { const a = Math.min(L / 2 - 0.2, Math.max(-L / 2, -L / 2 + k * L / n - 0.1)); G.quad(P(a, y0 - 0.3, e), P(a + 0.2, y0 - 0.3, e), P(a + 0.2, y0 + h, e), P(a, y0 + h, e), st.viga); }
    G.quad(P(-L / 2, y0 + h * 0.45, e), P(L / 2, y0 + h * 0.45, e), P(L / 2, y0 + h * 0.45 + 0.14, e), P(-L / 2, y0 + h * 0.45 + 0.14, e), st.viga); });
  if (st.troncos) caras((P, L) => { for (let yy = y0 + 0.3; yy < y0 + h; yy += 0.55) G.quad(P(-L / 2 - 0.1, yy, e), P(L / 2 + 0.1, yy, e), P(L / 2 + 0.1, yy + 0.07, e), P(-L / 2 - 0.1, yy + 0.07, e), st.viga); });
  if (st.troncos) [[-1, 1], [1, 1], [1, -1], [-1, -1]].forEach(([sx, sz]) => { for (let yy = y0 + 0.1; yy < y0 + h; yy += 0.55) G.caja(sx * (w / 2 + 0.12), yy, sz * (d / 2 + 0.12), 0.34, 0.3, 0.34, st.viga); });  // cabezas de tronco en las esquinas
  if (st.tablas) caras((P, L) => { for (let yy = y0 + 0.25; yy < y0 + h; yy += 0.42) G.quad(P(-L / 2, yy, e), P(L / 2, yy, e), P(L / 2, yy + 0.035, e), P(-L / 2, yy + 0.035, e), 0xc8c4ba); });
  if (st.esquinas) [[-1, 1], [1, 1], [1, -1], [-1, -1]].forEach(([sx, sz]) => G.caja(sx * (w / 2 - 0.1), y0, sz * (d / 2 - 0.1), 0.32, h, 0.32, st.esquinas, {sinTecho: true}));
}
// porche delantero (norteamericano) o veranda engawa (japonés): tarima, postes y tejadillo
function porche(ctx, w, d, y0, japones) {
  if (ctx.lod === 2 || ctx.danio >= 3) return; const G = ctx.G, pd = japones ? 1.1 : 2.2, col = japones ? 0x6a5a44 : 0xd8d4ca;
  G.muro.caja(0, ctx.cim, d / 2 + pd / 2, w + 0.2, y0 - ctx.cim + (japones ? 0.5 : 0.3), pd, col, {colTecho: japones ? 0x7a6a50 : 0xb8b0a0});
  if (ctx.lod === 0) for (let x = -w / 2 + 0.2; x <= w / 2; x += Math.max(1.6, (w - 0.4) / 4)) G.detalle.caja(x, y0 + 0.3, d / 2 + pd - 0.12, 0.14, 2.4, 0.14, japones ? ctx.st.viga : 0xf0ece4);
  if (!japones) G.tejado.quad([-w / 2 - 0.2, y0 + 2.7, d / 2 + pd + 0.3], [w / 2 + 0.2, y0 + 2.7, d / 2 + pd + 0.3], [w / 2 + 0.2, y0 + 3.3, d / 2], [-w / 2 - 0.2, y0 + 3.3, d / 2], colCubierta(ctx));
}
// colisor y coberturas de un edificio rectangular (en metros locales)
function salidaCaja(ctx, w, d, alto) {
  const s = ctx.salida; if (!s) return; const M = ctx.M, [cx, cz] = aMundo(ctx, 0, 0);
  s.colliders.push({tipo: 'caja', centro: [cx, cz], ancho: w * M, fondo: d * M, rot: ctx.p.rot, alto: alto * M, base: ctx.p.suelo, edificio: ctx.p.tipo, blando: false});
  s.info.alto = alto * M;
  [[-1, 1], [1, 1], [1, -1], [-1, -1]].forEach(([sx, sz]) => {
    [[sx * (w / 2 - 0.6), sz * (d / 2 + 0.55), 0, -sz], [sx * (w / 2 + 0.55), sz * (d / 2 - 0.6), -sx, 0]].forEach(([lx, lz, fx, fz]) => {
      const [x, z] = aMundo(ctx, lx, lz), f = dirMundo(ctx, fx, fz), esq = aMundo(ctx, sx * w / 2, sz * d / 2), izq = [f[1], -f[0]], lado = (esq[0] - x) * izq[0] + (esq[1] - z) * izq[1] > 0 ? 'izq' : 'der';
      s.cover.push({tipo: 'esquina', pos: [x, ctx.Hw(x, z), z], alto: 'alta', protegeDe: f, lados: [lado], capacidad: 1, edificio: ctx.p.tipo});
    });
  });
}
// muro bajo o valla a lo largo de un segmento local (m): 'piedra' | 'ladrillo' | 'adobe' | 'valla' | 'seto'; con brecha si hay daño (o o.brecha)
function muroBajo(ctx, x0, z0, x1, z1, tipo, alto, o) {
  o = o || {}; const G = ctx.G, L = Math.hypot(x1 - x0, z1 - z0), ry = Math.atan2(-(z1 - z0), x1 - x0), macizo = /piedra|ladrillo|adobe/.test(tipo); alto = alto || (macizo ? 1.1 : 1.05);
  const rB = rng(((x0 * 31 + z0 * 17 + x1 * 7) | 0) + ctx.p.cx * 3 | 0), conBrecha = macizo && L > 5 && (o.brecha || ctx.danio >= 2 || (ctx.era >= 3 && rB() < 0.3));
  const rangos = []; let brecha = null;
  if (conBrecha) { const bw = 1.8 + rB() * 1.4, t0 = 0.15 + rB() * (0.7 - bw / L), t1 = t0 + bw / L; rangos.push([0, t0], [t1, 1]); brecha = [t0, t1]; } else rangos.push([0, 1]);
  const col = tipo === 'ladrillo' ? C.ladrillo : tipo === 'adobe' ? C.adobe : C.piedra, colT = tipo === 'ladrillo' ? 0x7a3a2a : tipo === 'adobe' ? 0xb8987a : C.piedraO;
  rangos.forEach(([ta0, tb0]) => { const xa0 = lerp(x0, x1, ta0), za0 = lerp(z0, z1, ta0), xb0 = lerp(x0, x1, tb0), zb0 = lerp(z0, z1, tb0), Ls = L * (tb0 - ta0); if (Ls < 0.2) return;
    const n = Math.max(1, Math.ceil(Ls / (ctx.lod === 0 ? (macizo ? 4 : 2.6) : 7))), roto = macizo && (ctx.danio || ctx.era >= 3);
    for (let k = 0; k < n; k++) {
      const ta = k / n, tb = (k + 1) / n, xa = lerp(xa0, xb0, ta), za = lerp(za0, zb0, ta), xb = lerp(xa0, xb0, tb), zb = lerp(za0, zb0, tb), xm = (xa + xb) / 2, zm = (za + zb) / 2;
      const ha = ctx.H(xa, za), hb = ctx.H(xb, zb), hm = ctx.H(xm, zm), lo = Math.min(ha, hb, hm) - 0.35, hi = Math.max(ha, hb, hm);
      if (macizo) { if (ctx.lod < 2) { const hh = hi - lo + alto * (roto && ctx.r() < 0.35 ? 0.55 : 1); G.muro.caja(xm, lo, zm, Ls / n + 0.05, hh, tipo === 'piedra' ? 0.55 : 0.4, col, {ry, colTecho: colT}); } }
      else if (tipo === 'seto') { if (ctx.lod < 2) G.detalle.caja(xm, lo, zm, Ls / n + 0.1, hi - lo + 1.5, 0.9, 0x3e5a2c, {ry, colTecho: 0x4a6a34}); }
      else if (tipo === 'valla') {
        if (ctx.lod === 0) { G.inst.poste.push(instM(ctx, xa, ha - 0.15, za, ry)); if (k === n - 1) G.inst.poste.push(instM(ctx, xb, hb - 0.15, zb, ry));
          [0.45, 0.85].forEach(yy => { const dy = hb - ha, len = Ls / n, ang = Math.atan2(dy, len), ll = Math.hypot(len, dy);
            conMatriz([G.detalle], new THREE.Matrix4().makeTranslation(xa, ha + yy, za).multiply(new THREE.Matrix4().makeRotationY(ry)).multiply(new THREE.Matrix4().makeRotationZ(ang)), () => { G.detalle.quad([0, -0.04, 0.03], [ll, -0.04, 0.03], [ll, 0.04, 0.03], [0, 0.04, 0.03], C.madera); G.detalle.quad([ll, -0.04, -0.03], [0, -0.04, -0.03], [0, 0.04, -0.03], [ll, 0.04, -0.03], C.madera); }); }); }
        else if (ctx.lod === 1) G.detalle.caja(xm, lo + 0.35, zm, Ls / n, hi - lo + 0.6, 0.05, C.madera, {ry});
      }
    }
    if (ctx.salida) { const a = aMundo(ctx, xa0, za0), b = aMundo(ctx, xb0, zb0), M = ctx.M; ctx.salida.colliders.push({tipo: 'segmento', a, b, alto: (tipo === 'seto' ? 1.8 : alto) * M, grosor: (macizo ? 0.5 : tipo === 'seto' ? 0.9 : 0.1) * M, blando: !macizo, salto: alto < 1.2 && tipo !== 'seto'});
      if (macizo) { const nc = Math.max(1, Math.floor(Ls / 1.2)), nx = -(zb0 - za0) / Ls, nz = (xb0 - xa0) / Ls;
        for (let i = 0; i < nc; i++) { const t = (i + 0.5) / nc; [-1, 1].forEach(sg => { const lx = lerp(xa0, xb0, t) + nx * 0.7 * sg, lz = lerp(za0, zb0, t) + nz * 0.7 * sg, [x, z] = aMundo(ctx, lx, lz); ctx.salida.cover.push({tipo: 'muro_bajo', pos: [x, ctx.Hw(x, z), z], alto: 'baja', protegeDe: dirMundo(ctx, -nx * sg, -nz * sg), lados: ['arriba', 'izq', 'der'], capacidad: 1}); }); } } } });
  if (brecha) { const tm = (brecha[0] + brecha[1]) / 2, xm = lerp(x0, x1, tm), zm = lerp(z0, z1, tm);
    if (ctx.lod === 0) for (let k = 0; k < 3; k++) { const ex = xm + (ctx.r() - 0.5) * 1.6, ez = zm + (ctx.r() - 0.5) * 1.6; ctx.G.inst.escombro.push(instM(ctx, ex, ctx.H(ex, ez) - 0.1, ez, ctx.r() * 3, 0.4 + ctx.r() * 0.4, 0.3 + ctx.r() * 0.3, 0.4 + ctx.r() * 0.4)); }
    if (ctx.salida) ctx.salida.brechas.push({pos: (() => { const [x, z] = aMundo(ctx, xm, zm); return [x, ctx.Hw(x, z), z]; })(), ancho: L * (brecha[1] - brecha[0]) * ctx.M, dir: dirMundo(ctx, -(z1 - z0) / L, (x1 - x0) / L), edificio: ctx.p.tipo}); }
}
// barriles, pilas de leña y cubos junto a la fachada (LOD0), con su cobertura baja
function objetosFachada(ctx) {
  if (ctx.danio >= 3) return; const R = ctx.r, w = ctx.w, d = ctx.d, G = ctx.G.inst, s = R() < 0.5 ? 1 : -1, x = s * (w / 2 - 0.7), z = d / 2 + 0.55, h = ctx.H(x, z);
  const cov = (lx, lz, tipo) => { if (!ctx.salida) return; const [wx, wz] = aMundo(ctx, lx, lz + 0.7); ctx.salida.objetos.push({tipo, pos: [wx, ctx.Hw(wx, wz), wz]}); ctx.salida.cover.push({tipo, pos: [wx, ctx.Hw(wx, wz), wz], alto: 'baja', protegeDe: dirMundo(ctx, 0, -1), lados: ['arriba', 'izq', 'der'], capacidad: 1, edificio: ctx.p.tipo}); };
  const x2 = R();
  if (x2 < 0.35) { G.barril.push(instM(ctx, x, h, z, 0)); G.barril.push(instM(ctx, x + s * 0.6, h, z + 0.1, 0.5)); if (R() < 0.5) G.barril.push(instM(ctx, x + s * 0.3, h + 0.85, z + 0.05, 0.2)); cov(x, z, 'barriles'); }
  else if (x2 < 0.6) { G.lena.push(instM(ctx, s * (w / 2 + 0.3), ctx.H(s * (w / 2 + 0.3), 0), 0, Math.PI / 2, 1.6, 1.2, 1)); cov(s * (w / 2 + 0.3), 0, 'lena'); }
  else if (x2 < 0.75) G.cubo.push(instM(ctx, x, h, z, 0));
  if (/taberna|posada/.test(ctx.p.tipo)) { G.banco.push(instM(ctx, -s * (w / 2 - 1.6), ctx.H(-s * (w / 2 - 1.6), d / 2 + 0.6), d / 2 + 0.6, 0)); }
}

/* ---------- constructores por tipo (todo en metros, origen = centro de la planta, +z = fachada a la calle) ---------- */
const CONSTR = {
  casa_baja(ctx) { casa(ctx, 1); },
  casa_dos(ctx) { casa(ctx, 2); },
  posada(ctx) { casa(ctx, 2, {letrero: true, sinAzotea: true}); },
  taberna(ctx) { casa(ctx, ctx.r() < 0.5 ? 2 : 1, {letrero: true, sinAzotea: true}); },
  panaderia(ctx) { const t = casa(ctx, 1, {chimenea: [0, -ctx.d * 0.32, 1.3]}), G = ctx.G, y0 = ctx.suelo + 0.35, d = ctx.d;
    if (ctx.lod < 2 && ctx.danio < 3) { G.muro.cil(0, y0, -d / 2 - 0.55, 1.25, 0.35, 1.5, ctx.lod ? 6 : 10, 0xd8c8a8); G.tejado.cil(0, y0 + 1.5, -d / 2 - 0.55, 0.4, 0.05, 0.4, 6, C.piedraO); }   // horno de leña adosado
    if (ctx.lod === 0 && ctx.danio < 3) { G.detalle.caja(ctx.w / 2 - 0.9, y0 + 2.4, d / 2 + 0.5, 0.06, 0.06, 0.8, C.hierro); G.detalle.cil(ctx.w / 2 - 0.9, y0 + 1.9, d / 2 + 0.9, 0.28, 0.28, 0.06, 8, C.amarillo, {tapa: true}); }   // rótulo (rosca)
    return t; },
  herreria(ctx) { casa(ctx, 1, {anchoPuerta: 2.2, altoPuerta: 2.5, chimenea: [-ctx.w * 0.3, -ctx.d * 0.25, 1.6], sinAzotea: true}); const G = ctx.G, w = ctx.w, d = ctx.d, y0 = ctx.suelo + 0.35;
    if (ctx.lod < 2 && ctx.danio < 3) { G.tejado.quad([w / 2, y0 + 2.7, d / 2], [w / 2 + 3.2, y0 + 2.1, d / 2], [w / 2 + 3.2, y0 + 2.1, -d / 2], [w / 2, y0 + 2.7, -d / 2], colCubierta(ctx)); G.tejado.quad([w / 2, y0 + 2.7, -d / 2], [w / 2 + 3.2, y0 + 2.1, -d / 2], [w / 2 + 3.2, y0 + 2.1, d / 2], [w / 2, y0 + 2.7, d / 2], 0x4a3a2a);   // cobertizo de herrar
      [d / 2 - 0.2, -d / 2 + 0.2, 0].forEach(z => G.detalle.caja(w / 2 + 3.0, ctx.H(w / 2 + 3, z), z, 0.18, y0 + 2.1 - ctx.H(w / 2 + 3, z), 0.18, C.maderaO)); }
    if (ctx.lod === 0 && ctx.danio < 3) { const hx = w / 2 + 1.5, hy = ctx.H(hx, 1); G.detalle.cil(hx, hy, 1, 0.22, 0.2, 0.55, 7, C.madera, {tapa: true}); G.detalle.caja(hx, hy + 0.55, 1, 0.16, 0.14, 0.36, C.hierro);   // yunque
      G.detalle.caja(hx, ctx.H(hx, -1.5), -1.5, 0.6, 0.55, 1.4, C.maderaO, {colTecho: C.agua}); G.detalle.caja(w / 2 + 0.02, y0 + 1.6, d / 2 - 1.2, 0.04, 0.5, 0.6, C.maderaO); [0, 1, 2].forEach(k => G.detalle.cil(w / 2 + 0.07, y0 + 1.7 + k * 0.12, d / 2 - 1.2, 0.08, 0.08, 0.02, 6, C.hierro)); }   // pilón y herraduras
    if (ctx.salida && ctx.danio < 3) ctx.salida.humos.push({pos: aMundo3(ctx, -w * 0.3, y0 + 5.8, -d * 0.25), intensidad: 1.3, fase: ctx.r(), edificio: 'herreria_fragua'}); },
  granja(ctx) {
    const w = ctx.w, d = ctx.d, r = ctx.r, cerca = ctx.st.cerca === 'adobe' ? 'adobe' : 'piedra';
    sub(ctx, -w / 2 + 5, d / 2 - 4, 0, 9, 7, () => casa(ctx, 1 + (r() < 0.4 ? 1 : 0), {sinAzotea: true}));
    sub(ctx, w / 2 - 6.5, -d / 2 + 5.5, 0, 12, 9, () => granero(ctx));
    muroBajo(ctx, -w / 2, -d / 2, w / 2 - 13, -d / 2, cerca); muroBajo(ctx, -w / 2, -d / 2, -w / 2, d / 2 - 8, cerca); muroBajo(ctx, w / 2, -d / 2 + 10.5, w / 2, d / 2, cerca); muroBajo(ctx, w / 2, d / 2, 2, d / 2, cerca);
    if (ctx.lod === 0) { ctx.G.inst.paca.push(instM(ctx, -2, ctx.H(-2, -3) - 0.2, -3, 0)); if (r() < 0.6) ctx.G.inst.paca.push(instM(ctx, 1.5, ctx.H(1.5, -4.5) - 0.2, -4.5, 0.4, 0.8, 0.8, 0.8)); }
    if (ctx.salida) ctx.salida.info.alto = 7 * ctx.M;
  },
  // granja fortificada: muros de 3,2 m con aspilleras, torre sobre el portón, vivienda de dos plantas y granero dentro
  granja_fortificada(ctx) {
    const w = ctx.w, d = ctx.d, G = ctx.G, y0 = ctx.suelo, hw = 3.2, gate = 3.6, cerca = ctx.st === ESTILOS.ingles ? 'ladrillo' : ctx.st.cerca === 'adobe' ? 'adobe' : 'piedra';
    sub(ctx, -w / 2 + 6, -d / 2 + 5, 0, 10, 8, () => casa(ctx, 2, {sinAzotea: true}));
    sub(ctx, w / 2 - 7, -d / 2 + 5.5, 0, 12, 9, () => granero(ctx));
    muroBajo(ctx, -w / 2, -d / 2, w / 2, -d / 2, cerca, hw); muroBajo(ctx, -w / 2, -d / 2, -w / 2, d / 2, cerca, hw); muroBajo(ctx, w / 2, -d / 2, w / 2, d / 2, cerca, hw);
    muroBajo(ctx, -w / 2, d / 2, -gate / 2 - 2, d / 2, cerca, hw); muroBajo(ctx, gate / 2 + 2, d / 2, w / 2, d / 2, cerca, hw);
    // torre del portón (sobre el paso) con su tejado; aspilleras en los muros
    const tw = 4, ht = 7.5, ruina = ctx.danio >= 3; G.muro.caja(-gate / 2 - 1, ctx.cim, d / 2, 2, y0 - ctx.cim + (ruina ? 3 : ht), 2.2, C.piedra); G.muro.caja(gate / 2 + 1, ctx.cim, d / 2, 2, y0 - ctx.cim + (ruina ? 2 : ht), 2.2, C.piedra);
    if (!ruina) { G.muro.caja(0, y0 + 3.4, d / 2, gate, ht - 3.4, 2.2, C.piedra); const sv = ctx.st; tejado(Object.assign({}, ctx, {danio: 0}), tw + 4, 2.2, y0 + ht, 'cuatro', {pend: 35}); void sv;
      if (ctx.lod === 0) G.detalle.quad([-gate / 2, y0, d / 2 + 1.12], [gate / 2, y0, d / 2 + 1.12], [gate / 2, y0 + 3.3, d / 2 + 1.12], [-gate / 2, y0 + 3.3, d / 2 + 1.12], C.maderaO); }   // portón
    if (ctx.salida && !ruina) { ctx.salida.tiradores.push({tipo: 'torre', pos: aMundo3(ctx, 0, y0 + ht - 1.6, d / 2 + 0.2), dir: dirMundo(ctx, 0, 1), alto: 'alta', edificio: 'granja_fortificada'}); }
    const asp = (x0, z0, x1, z1, nx, nz) => { const L = Math.hypot(x1 - x0, z1 - z0), n = Math.floor(L / 3.2); for (let i = 1; i < n; i++) { const t = i / n, x = lerp(x0, x1, t), z = lerp(z0, z1, t), yy = ctx.H(x, z) + 1.5;
      if (ctx.lod === 0) { const tx = -nz, tz = nx, e = 0.3; G.detalle.quad([x + nx * e - tx * 0.06, yy, z + nz * e - tz * 0.06], [x + nx * e + tx * 0.06, yy, z + nz * e + tz * 0.06], [x + nx * e + tx * 0.06, yy + 0.6, z + nz * e + tz * 0.06], [x + nx * e - tx * 0.06, yy + 0.6, z + nz * e - tz * 0.06], C.hueco); }
      if (ctx.salida) { const [wx, wz] = aMundo(ctx, x, z); ctx.salida.loopholes.push({tipo: 'aspillera', pos: [wx, (yy + 0.3) * ctx.M, wz], dir: dirMundo(ctx, nx, nz), planta: 0, edificio: 'granja_fortificada', ancho: 0.15 * ctx.M}); } } };
    asp(-w / 2, -d / 2, w / 2, -d / 2, 0, -1); asp(-w / 2, -d / 2, -w / 2, d / 2, -1, 0); asp(w / 2, d / 2, w / 2, -d / 2, 1, 0);
    if (ctx.salida) { ctx.salida.info.alto = ht * ctx.M; ctx.salida.info.plantas = 2; }
  },
  // hacienda: cuatro alas alrededor de un patio con soportales; casa principal de dos plantas con azotea y escalera desde el patio
  hacienda(ctx) {
    const w = ctx.w, d = ctx.d, G = ctx.G, ala = 5, gate = 3.4, y0 = ctx.suelo + 0.35, colM = ctx.st.muro;
    sub(ctx, 0, -d / 2 + ala / 2 + 0.5, 0, w, ala + 1, () => { const t = casa(ctx, 2, {sinAzotea: true, azoteaForzada: true}); return t; });                       // casa principal (fondo)
    [[-1], [1]].forEach(([s]) => sub(ctx, s * (w / 2 - ala / 2), 1.5, 0, ala, d - ala * 2 - 1 + 3, () => alaSimple(ctx, 3.2)));                                     // alas laterales
    [[-1], [1]].forEach(([s]) => sub(ctx, s * (w / 4 + gate / 4), d / 2 - ala / 2, 0, w / 2 - gate / 2, ala, () => alaSimple(ctx, 3.2, true)));                       // ala delantera a los lados del zaguán
    if (ctx.danio < 3) { G.muro.caja(0, y0 + 3.0, d / 2 - ala / 2, gate + 0.2, 1.0, ala, colM); if (ctx.lod === 0) G.detalle.quad([-gate / 2, y0, d / 2 + 0.02], [gate / 2, y0, d / 2 + 0.02], [gate / 2, y0 + 3.0, d / 2 + 0.02], [-gate / 2, y0 + 3.0, d / 2 + 0.02], C.maderaO); }   // zaguán
    if (ctx.lod < 2 && ctx.danio < 3) { const zb = -d / 2 + ala + 1.5 + 1.6; for (let x = -w / 2 + ala + 1; x <= w / 2 - ala - 1 + 0.01; x += (w - 2 * ala - 2) / 4) G.detalle.caja(x, y0, zb, 0.32, 2.8, 0.32, C.blanco);   // soportales
      G.tejado.quad([-w / 2 + ala, y0 + 3.0, zb + 0.4], [w / 2 - ala, y0 + 3.0, zb + 0.4], [w / 2 - ala, y0 + 3.5, zb - 1.7], [-w / 2 + ala, y0 + 3.5, zb - 1.7], ctx.st.tejado); }
    if (ctx.lod === 0) ctx.G.inst.barril.push(instM(ctx, 2, ctx.H(2, 0), 0, 0));
    if (ctx.salida) { ctx.salida.info.alto = 6.6 * ctx.M; ctx.salida.info.plantas = 2; }
  },
  // casas adosadas urbanas: 3–5 fachadas de 2–4 plantas, comercios en la planta baja, balcones (mediterráneo) y medianeras
  adosadas(ctx) {
    const w = ctx.w, d = ctx.d, n = Math.max(2, Math.round(w / 5.5)), wi = w / n, R = ctx.r, st = ctx.st, PAL = [st.muro, 0xd8c8a8, 0xc8b090, 0xb8a890, 0xe0d4bc, 0xa88a70];
    for (let k = 0; k < n; k++) { const x = -w / 2 + wi * (k + 0.5), pl = 2 + Math.floor(R() * (ctx.era >= 2 ? 3 : 2)), col = st === ESTILOS.ingles ? [0x9a4a38, 0x8a4232, 0xa85440][k % 3] : PAL[Math.floor(R() * PAL.length)];
      sub(ctx, x, 0, 0, wi, d, () => casa(ctx, pl, {colMuro: col, adosada: true, tienda: R() < 0.5, sinInterior: k > 0, sinValla: true, balcon: st === ESTILOS.mediterraneo || R() < 0.25})); }
  },
  almacen(ctx) {
    const w = ctx.w, d = ctx.d, G = ctx.G, y0 = ctx.suelo + 0.35, h = 6, col = ctx.st === ESTILOS.ingles ? C.ladrillo : ctx.st === ESTILOS.mediterraneo ? 0xd8ccb4 : ctx.st.troncos || ctx.st.tablas ? 0x7a5a3e : 0x9a8a74;
    zocalo(ctx, w, d); const yt = paredes(ctx, w, d, y0, h, col);
    if (ctx.lod === 0 && ctx.danio < 3 && (ctx.st.tablas || ctx.st.troncos)) for (let x = -w / 2; x <= w / 2; x += 0.8) G.detalle.quad([x, y0, d / 2 + 0.02], [x + 0.05, y0, d / 2 + 0.02], [x + 0.05, yt, d / 2 + 0.02], [x, yt, d / 2 + 0.02], C.maderaO);
    puerta(ctx, w, d, 0, y0, 3.2, 3.6, 0x4a3424);
    if (ctx.lod <= 1) { [-w / 2 + 2, w / 2 - 2].forEach(u => ventana(ctx, w, d, 0, u, y0 + 3.6, 1.0, 1.0, 1)); for (let u = -d / 2 + 2; u <= d / 2 - 2; u += 3) { ventana(ctx, w, d, 2, u, y0 + 3.8, 0.9, 0.9, 1); if (ctx.lod === 0) ventana(ctx, w, d, 3, u, y0 + 3.8, 0.9, 0.9, 1); } }
    const top = tejado(ctx, w, d, yt, 'dos', {pend: 28, colHastial: col});
    if (ctx.lod === 0 && ctx.danio < 3) { G.detalle.caja(0, top - 0.6, d / 2 + 0.8, 0.22, 0.22, 1.8, C.maderaO); G.detalle.cil(0, top - 1.4, d / 2 + 1.6, 0.04, 0.04, 0.8, 4, C.hierro);   // pescante con polea
      G.detalle.quad([-0.8, yt - 2.2, d / 2 + 0.03], [0.8, yt - 2.2, d / 2 + 0.03], [0.8, yt - 0.4, d / 2 + 0.03], [-0.8, yt - 0.4, d / 2 + 0.03], C.maderaO); }
    escaleraMano(ctx, w, d, y0 - 0.35, yt, -d / 4);
    if (ctx.salida) { salidaCaja(ctx, w, d, ctx.danio >= 3 ? h * 0.5 : h); ctx.salida.info.plantas = 2; }
  },
  establo(ctx) {
    const w = ctx.w, d = ctx.d, G = ctx.G, y0 = ctx.suelo + 0.35, h = 2.9, col = ctx.st === ESTILOS.mediterraneo ? 0xd8ccb4 : ctx.st === ESTILOS.ingles ? C.ladrillo : 0x7a5a3e;
    zocalo(ctx, w, d); const yt = paredes(ctx, w, d, y0, h, col);
    const n = Math.max(3, Math.floor(w / 3.2)); for (let i = 0; i < n; i++) { const u = -w / 2 + (i + 0.5) * w / n;
      if (i === Math.floor(n / 2)) { puerta(ctx, w, d, u, y0, 1.6, 2.4, 0x4a3424); continue; }
      if (ctx.lod <= 1) ctx.G.detalle.quad([u - 0.6, y0, d / 2 + 0.05], [u + 0.6, y0, d / 2 + 0.05], [u + 0.6, y0 + 2.1, d / 2 + 0.05], [u - 0.6, y0 + 2.1, d / 2 + 0.05], C.hueco);
      if (ctx.lod === 0) ctx.G.detalle.quad([u - 0.6, y0, d / 2 + 0.07], [u + 0.6, y0, d / 2 + 0.07], [u + 0.6, y0 + 1.1, d / 2 + 0.07], [u - 0.6, y0 + 1.1, d / 2 + 0.07], 0x5a3a24); }   // media puerta de cuadra
    const top = tejado(ctx, w, d, yt, 'dos', {pend: 40, colHastial: col});
    if (ctx.lod < 2 && ctx.danio < 3) { G.muro.caja(0, yt - 0.2, d / 4 + 0.3, 1.6, 1.4, 1.4, col); G.tejado.quad([-1.0, yt + 1.2, d / 4 + 1.1], [1.0, yt + 1.2, d / 4 + 1.1], [0, yt + 1.9, d / 4 + 0.4], [0, yt + 1.9, d / 4 + 0.4], colCubierta(ctx));   // puerta del pajar
      if (ctx.lod === 0) G.detalle.quad([-0.5, yt - 0.1, d / 4 + 1.02], [0.5, yt - 0.1, d / 4 + 1.02], [0.5, yt + 1.0, d / 4 + 1.02], [-0.5, yt + 1.0, d / 4 + 1.02], C.hueco); }
    if (ctx.lod === 0) { const x = -w / 2 - 2, h0 = ctx.H(x, 1); G.detalle.caja(x, h0 - 0.2, 1, 2.2, 0.9, 1.8, 0x4a3a28, {colTecho: 0x5a4a30}); G.detalle.caja(w / 2 - 2, ctx.H(w / 2 - 2, d / 2 + 1.2), d / 2 + 1.2, 1.8, 0.5, 0.5, C.maderaO, {colTecho: C.agua}); }   // estercolero y abrevadero
    escaleraMano(ctx, w, d, y0 - 0.35, yt, -d / 4); void top;
    if (ctx.salida) { salidaCaja(ctx, w, d, ctx.danio >= 3 ? h * 0.5 : h); ctx.salida.info.plantas = 1; }
  },
  huerto(ctx) {
    const w = ctx.w, d = ctx.d; if (ctx.lod === 0) for (let x = -w / 2 + 0.8; x < w / 2 - 0.5; x += 0.9) for (let z = -d / 2 + 0.8; z < d / 2 - 0.5; z += 1.3) ctx.G.inst.planta.push(instM(ctx, x, ctx.H(x, z) - 0.05, z, ctx.r() * 6, 0.8 + ctx.r() * 0.5, 0.8 + ctx.r() * 0.5, 0.8 + ctx.r() * 0.5));
    if (ctx.lod <= 1) ctx.G.detalle.caja(0, ctx.cim, 0, w - 0.6, ctx.suelo - ctx.cim - 0.05, d - 0.6, C.tierra);
    const t = ctx.st.cerca === 'adobe' ? 'valla' : ctx.st === ESTILOS.ingles ? 'seto' : 'valla';
    muroBajo(ctx, -w / 2, -d / 2, w / 2, -d / 2, t); muroBajo(ctx, -w / 2, -d / 2, -w / 2, d / 2, t); muroBajo(ctx, w / 2, -d / 2, w / 2, d / 2, t);
  },
  pozo(ctx) {
    const G = ctx.G; G.muro.cil(0, ctx.cim, 0, 0.95, 0.95, ctx.suelo - ctx.cim + 0.85, ctx.lod ? 6 : 10, C.piedra, {tapa: true, colTapa: C.hueco});
    if (ctx.lod === 0) { [-0.85, 0.85].forEach(x => G.detalle.caja(x, ctx.suelo + 0.8, 0, 0.12, 1.6, 0.12, C.madera)); G.tejado.quad([-1.2, ctx.suelo + 2.2, 0.8], [1.2, ctx.suelo + 2.2, 0.8], [1.2, ctx.suelo + 2.7, 0], [-1.2, ctx.suelo + 2.7, 0], ctx.st.tejado); G.tejado.quad([1.2, ctx.suelo + 2.2, -0.8], [-1.2, ctx.suelo + 2.2, -0.8], [-1.2, ctx.suelo + 2.7, 0], [1.2, ctx.suelo + 2.7, 0], ctx.st.tejado); }
    if (ctx.salida) { const [x, z] = aMundo(ctx, 0, 0); ctx.salida.colliders.push({tipo: 'circulo', centro: [x, z], radio: 1 * ctx.M, alto: 0.85 * ctx.M, blando: false});
      [0, 1, 2, 3].forEach(k => { const a = k * Math.PI / 2, [px, pz] = aMundo(ctx, Math.cos(a) * 1.6, Math.sin(a) * 1.6); ctx.salida.cover.push({tipo: 'pozo', pos: [px, ctx.Hw(px, pz), pz], alto: 'baja', protegeDe: dirMundo(ctx, -Math.cos(a), -Math.sin(a)), lados: ['arriba', 'izq', 'der'], capacidad: 1}); }); ctx.salida.info.alto = 0.85 * ctx.M; }
  },
  iglesia(ctx) {
    ctx.sinPostigo = true;   // vidrieras sin postigos
    const w = ctx.w, d = ctx.d, st = ctx.st, G = ctx.G, y0 = ctx.suelo, hN = 9, tw = 5.2, tz = d / 2 - tw / 2, ruso = st === ESTILOS.ruso, med = st === ESTILOS.mediterraneo, jap = st === ESTILOS.japones;
    const muroCol = st === ESTILOS.ingles || st === ESTILOS.norte ? 0x9a968a : st === ESTILOS.americano ? 0xf0ece4 : st.muro;
    zocalo(ctx, w, d - tw, 0, -tw / 2); let yN = y0 + 0.35 + hN;
    const subZ = (z, fn) => { const m = new THREE.Matrix4().makeTranslation(0, 0, z), prev = ctx.mat; conMatriz([G.muro, G.tejado, G.detalle], m, () => { ctx.mat = prev.clone().multiply(m); fn(); }); ctx.mat = prev; };
    subZ(-tw / 2, () => { yN = paredes(ctx, w, d - tw, y0 + 0.35, hN, muroCol); const s2 = ctx.w; ctx.w = d - tw;
      const rm = new THREE.Matrix4().makeRotationY(Math.PI / 2); conMatriz([G.tejado, G.muro, G.detalle], rm, () => tejado(ctx, d - tw, w, yN, jap ? 'cuatro' : 'dos', {pend: med ? 25 : 45, colHastial: muroCol})); ctx.w = s2;
      if (ctx.lod <= 1) for (let z = -(d - tw) / 2 + 2.5; z < (d - tw) / 2 - 1.5; z += 3.2) [-1, 1].forEach(s => { const sv = ctx.salida; ctx.salida = null; ventana(ctx, w, d - tw, s > 0 ? 2 : 3, s > 0 ? -z : z, y0 + 3, 1.1, 3.2, 0); ctx.salida = sv; });
      if (ctx.lod < 2) G.muro.cil(0, y0 + 0.35, -(d - tw) / 2, w * 0.38, w * 0.38, hN * 0.8, ctx.lod ? 6 : 10, muroCol), G.tejado.cil(0, y0 + 0.35 + hN * 0.8, -(d - tw) / 2, w * 0.42, 0, 2.5, ctx.lod ? 6 : 10, st.tejado);
    });
    const hT = ruso ? 15 : 19; G.muro.caja(0, ctx.cim, tz, tw + 0.2, y0 - ctx.cim + 0.35, tw + 0.2, st.zocalo);
    const ruinaT = ctx.danio >= 3, hTr = ruinaT ? hT * 0.55 : ctx.danio === 2 ? hT * 0.85 : hT; G.muro.caja(0, y0 + 0.35, tz, tw, hTr, tw, muroCol, {sinTecho: !ruinaT && ctx.danio < 2, colTecho: C.escombro});
    if (!ruinaT && ctx.danio < 2) {
      if (ctx.lod === 0) [0, 1, 2, 3].forEach(k => { const a = k * Math.PI / 2, cs = Math.cos(a), sn = Math.sin(a); G.detalle.quad(...[[-0.7, hT - 3.2], [0.7, hT - 3.2], [0.7, hT - 0.9], [-0.7, hT - 0.9]].map(([u, yy]) => [u * cs + (tw / 2 + 0.03) * sn, y0 + yy, tz + (tw / 2 + 0.03) * cs - u * sn]), C.hueco); });
      if (ruso) { G.tejado.cil(0, y0 + hT + 0.35, tz, tw * 0.45, tw * 0.62, 1.6, 10, 0x3a5a4a); G.tejado.cil(0, y0 + hT + 1.95, tz, tw * 0.62, 0.0, 3.2, 10, 0x3a5a4a); G.detalle.caja(0, y0 + hT + 5, tz, 0.12, 1.8, 0.12, 0xc8a048); }
      else if (med || jap) { G.tejado.cil(0, y0 + hT + 0.35, tz, tw * 0.72, 0, 2.2, 4, st.tejado); }
      else { const aguja = ctx.era <= 1 ? 9 : 7; conMatriz([G.tejado], new THREE.Matrix4().makeTranslation(0, 0, tz).multiply(new THREE.Matrix4().makeRotationY(Math.PI / 4)), () => G.tejado.cil(0, y0 + hT + 0.35, 0, tw * 0.72, 0, aguja, 4, st === ESTILOS.ingles ? 0x4a4e56 : 0x4a5a5a)); }
    } else if (ctx.lod === 0) for (let k = 0; k < (ruinaT ? 10 : 4); k++) { const ex = (ctx.r() - 0.5) * 9, ez = tz + 3 + ctx.r() * 4; G.inst.escombro.push(instM(ctx, ex, ctx.H(ex, ez) - 0.1, ez, ctx.r() * 3, 0.5 + ctx.r(), 0.3 + ctx.r() * 0.6, 0.5 + ctx.r())); }
    puerta(ctx, w, d, 0, y0 + 0.35, 1.8, 3.2, 0x4a3020);
    muroBajo(ctx, -w / 2 - 5, d / 2, -w / 2 - 5, -d / 2 - 6, 'piedra'); muroBajo(ctx, -w / 2 - 5, -d / 2 - 6, w / 2 + 5, -d / 2 - 6, 'piedra'); muroBajo(ctx, w / 2 + 5, -d / 2 - 6, w / 2 + 5, d / 2, 'piedra');
    if (ctx.lod === 0) for (let k = 0; k < 14; k++) { const s = k % 2 ? 1 : -1; const tx = s * (w / 2 + 1.5 + ctx.r() * 2.5), tz2 = -d / 2 + 1 + ctx.r() * (d - 4); G.inst[k % 4 === 0 ? 'cruz' : 'tumba'].push(instM(ctx, tx, ctx.H(tx, tz2) - 0.1, tz2, Math.PI / 2 + (ctx.r() - 0.5) * 0.2, k % 4 === 0 ? 0.45 : 1, k % 4 === 0 ? 0.45 : 1, k % 4 === 0 ? 0.45 : 1)); }
    if (ctx.salida) { salidaCaja(ctx, w, d, hN + 2); const s = ctx.salida; s.info.alto = (hTr + 6) * ctx.M; s.info.plantas = 1;
      if (!ruinaT) [0, 1, 2, 3].forEach(k => { const a = k * Math.PI / 2, [x, z] = aMundo(ctx, Math.sin(a) * tw / 2, tz + Math.cos(a) * tw / 2), pos = [x, (y0 + hTr - 2) * ctx.M, z], dir = dirMundo(ctx, Math.sin(a), Math.cos(a));
        s.loopholes.push({tipo: 'campanario', pos, dir, planta: 3, edificio: 'iglesia', ancho: 1.4 * ctx.M}); s.tiradores.push({tipo: 'campanario', pos, dir, alto: 'alta', edificio: 'iglesia', acceso: aMundo3(ctx, 0, y0 + 0.35, tz)}); }); }
  },
  ermita(ctx) {
    ctx.sinPostigo = true;
    const w = ctx.w, d = ctx.d, st = ctx.st, G = ctx.G, y0 = ctx.suelo + 0.35, h = 4.2, col = st === ESTILOS.ruso ? 0xe8e0d0 : st === ESTILOS.ingles ? 0x9a968a : st.muro;
    zocalo(ctx, w, d); const yt = paredes(ctx, w, d, y0, h, col);
    conMatriz([G.tejado, G.muro, G.detalle], new THREE.Matrix4().makeRotationY(Math.PI / 2), () => { const s = ctx.w; ctx.w = d; tejado(ctx, d, w, yt, st === ESTILOS.japones ? 'cuatro' : 'dos', {pend: 38, colHastial: col}); ctx.w = s; });
    if (ctx.danio < 3) { const he = Math.tan((38) * Math.PI / 180) * w / 2; G.muro.caja(0, yt, d / 2 - 0.2, w * 0.7, he + 1.6, 0.4, col);   // espadaña con su campana
      if (ctx.lod === 0) { G.detalle.quad([-0.45, yt + he + 0.2, d / 2 + 0.01], [0.45, yt + he + 0.2, d / 2 + 0.01], [0.45, yt + he + 1.2, d / 2 + 0.01], [-0.45, yt + he + 1.2, d / 2 + 0.01], C.hueco); G.detalle.cil(0, yt + he + 0.3, d / 2, 0.28, 0.12, 0.5, 8, C.campana); }
      G.detalle.caja(0, yt + he + 1.6, d / 2 - 0.2, 0.1, 0.9, 0.1, C.hierro); G.detalle.caja(0, yt + he + 2.15, d / 2 - 0.2, 0.5, 0.1, 0.1, C.hierro);
      if (ctx.lod < 2) G.tejado.quad([-1.5, y0 + 2.8, d / 2 + 1.6], [1.5, y0 + 2.8, d / 2 + 1.6], [1.5, y0 + 3.3, d / 2], [-1.5, y0 + 3.3, d / 2], colCubierta(ctx)); }   // pórtico
    puerta(ctx, w, d, 0, y0, 1.3, 2.4, 0x4a3020); if (ctx.lod <= 1) [-1, 1].forEach(s => ventana(ctx, w, d, s > 0 ? 2 : 3, 0, y0 + 2.2, 0.5, 1.2, 0));
    if (ctx.salida) { salidaCaja(ctx, w, d, ctx.danio >= 3 ? h * 0.5 : h); ctx.salida.info.plantas = 1; }
  },
  calvario(ctx) {
    const G = ctx.G, w = ctx.w, base = ctx.H(0, 0), hMin = Math.min(ctx.H(-w / 2, -w / 2), ctx.H(w / 2, w / 2), ctx.H(-w / 2, w / 2), ctx.H(w / 2, -w / 2)) - 0.3;
    [[5.2, 0.4], [4.0, 0.8], [2.8, 1.2]].forEach(([s, y]) => G.muro.caja(0, hMin, 0, s, base - hMin + y, s, C.piedra, {colTecho: C.piedraO}));
    if (ctx.lod < 2 && ctx.danio < 3) [[-0.9, 0.8], [0, 1.15], [0.9, 0.8]].forEach(([x, k]) => G.inst.cruz ? (ctx.lod === 0 ? G.inst.cruz.push(instM(ctx, x, base + 1.2, 0, 0, k, k, k)) : G.detalle.caja(x, base + 1.2, 0, 0.16, 2.6 * k, 0.16, C.maderaO)) : 0);
    if (ctx.salida) { const [x, z] = aMundo(ctx, 0, 0); ctx.salida.colliders.push({tipo: 'caja', centro: [x, z], ancho: 5.2 * ctx.M, fondo: 5.2 * ctx.M, rot: ctx.p.rot, alto: 1.2 * ctx.M, base: base * ctx.M, edificio: 'calvario', blando: false}); ctx.salida.info.alto = 3.6 * ctx.M;
      [[0, 3.2, 0, -1], [0, -3.2, 0, 1], [3.2, 0, -1, 0], [-3.2, 0, 1, 0]].forEach(([lx, lz, fx, fz]) => { const [px, pz] = aMundo(ctx, lx, lz); ctx.salida.cover.push({tipo: 'calvario', pos: [px, ctx.Hw(px, pz), pz], alto: 'baja', protegeDe: dirMundo(ctx, fx, fz), lados: ['arriba', 'izq', 'der'], capacidad: 2}); }); }
  },
  ayuntamiento(ctx) {
    const w = ctx.w, d = ctx.d, st = ctx.st, G = ctx.G, y0 = ctx.suelo + 0.35, pl = ctx.era >= 1 ? 3 : 2, hp = 3.4, col = st === ESTILOS.ruso ? 0xd8c8a8 : st === ESTILOS.americano ? 0xe8e0d0 : st === ESTILOS.ingles ? C.ladrillo : st.muro;
    ctx.hueco = ctx.interior && ctx.danio < 3 ? {u: 0, pw: 1.8, ph: 2.8} : null;
    zocalo(ctx, w, d); const yt = paredes(ctx, w, d, y0, hp * pl, col); decoMuro(ctx, w, d, y0, hp * pl);
    for (let f = 0; f < pl; f++) for (let u = -w / 2 + 1.5; u <= w / 2 - 1.4; u += 2.2) { if (Math.abs(u) < 1.4 && f < 2) continue; ventana(ctx, w, d, 0, u, y0 + f * hp + 0.9, 1.0, 1.8, f); if (ctx.lod === 0 && f === 0) ventana(ctx, w, d, 1, u, y0 + 0.9, 1.0, 1.8, f); }
    puerta(ctx, w, d, 0, y0, 1.8, 2.8, 0x3a2418); interior(ctx, w, d, y0, hp, 'ayuntamiento'); ctx.hueco = null;
    if (ctx.danio < 3) { if (ctx.lod < 2) { G.detalle.caja(0, y0 + hp, d / 2 + 0.6, 3.0, 0.18, 1.2, C.piedra); if (ctx.lod === 0) { G.detalle.caja(0, y0 + hp + 0.18, d / 2 + 1.15, 3.0, 0.9, 0.06, C.hierro, {sinTecho: false}); G.detalle.quad([-0.6, y0 + hp, d / 2 + 0.02], [0.6, y0 + hp, d / 2 + 0.02], [0.6, y0 + hp + 2.3, d / 2 + 0.02], [-0.6, y0 + hp + 2.3, d / 2 + 0.02], C.cristal); } }   // balcón
      if (ctx.lod === 0) { G.detalle.caja(1.1, y0 + hp + 1.0, d / 2 + 1.2, 0.06, 2.2, 0.06, C.hierro, {rx: 0.6}); G.detalle.quad2([1.1, y0 + hp + 2.6, d / 2 + 2.0], [2.2, y0 + hp + 2.6, d / 2 + 2.0], [2.2, y0 + hp + 2.0, d / 2 + 2.3], [1.1, y0 + hp + 2.0, d / 2 + 2.3], ctx.op.colorBandera || C.rojo); }   // asta con bandera
      if (ctx.salida) ctx.salida.tiradores.push({tipo: 'balcon', pos: aMundo3(ctx, 0, y0 + hp + 0.2, d / 2 + 0.7), dir: dirMundo(ctx, 0, 1), alto: 'baja', edificio: 'ayuntamiento'}); }
    const top = tejado(ctx, w, d, yt, 'cuatro', {pend: 30});
    if (ctx.danio < 2) { const tw = 2.6, th = 3.4, ty = top - 1.2; G.muro.caja(0, ty, 0, tw, th, tw, col); if (ctx.lod < 2) { G.detalle.cil(0, ty + th - 1.4, tw / 2 + 0.02, 0.0, 0.0, 0, 3, C.blanco); G.detalle.quad([-0.75, ty + th - 2.1, tw / 2 + 0.03], [0.75, ty + th - 2.1, tw / 2 + 0.03], [0.75, ty + th - 0.6, tw / 2 + 0.03], [-0.75, ty + th - 0.6, tw / 2 + 0.03], C.blanco);   // reloj
        if (ctx.lod === 0) { G.detalle.quad([-0.04, ty + th - 1.35, tw / 2 + 0.04], [0.04, ty + th - 1.35, tw / 2 + 0.04], [0.04, ty + th - 0.75, tw / 2 + 0.04], [-0.04, ty + th - 0.75, tw / 2 + 0.04], C.hierro); G.detalle.quad([0, ty + th - 1.39, tw / 2 + 0.04], [0.45, ty + th - 1.39, tw / 2 + 0.04], [0.45, ty + th - 1.31, tw / 2 + 0.04], [0, ty + th - 1.31, tw / 2 + 0.04], C.hierro); } }
      conMatriz([G.tejado], new THREE.Matrix4().makeRotationY(Math.PI / 4), () => G.tejado.cil(0, ty + th, 0, tw * 0.78, 0, 2.2, 4, st.tejado));
      if (ctx.salida) ctx.salida.tiradores.push({tipo: 'torre', pos: aMundo3(ctx, 0, ty + 0.6, tw / 2), dir: dirMundo(ctx, 0, 1), alto: 'alta', edificio: 'ayuntamiento'}); }
    [-w / 2 + 2.5, w / 2 - 2.5].forEach(x => chimenea(ctx, x, -d * 0.15, top - 0.6, 1.2));
    if (ctx.salida) { salidaCaja(ctx, w, d, ctx.danio >= 3 ? hp * pl * 0.5 : hp * pl); ctx.salida.info.plantas = pl; }
  },
  // torre de vigilancia: de piedra con almenas (estilos de piedra) o de madera sobre pies derechos (ruso, americano, japonés)
  torre_vigilancia(ctx) {
    const G = ctx.G, st = ctx.st, y0 = ctx.suelo + 0.35, madera = !!(st.troncos || st.tablas || st.shoji), ruina = ctx.danio >= 3;
    if (!madera) { const h = ruina ? 5 : ctx.danio === 2 ? 9 : 11; zocalo(ctx, 4.6, 4.6); G.muro.caja(0, y0, 0, 4.4, h, 4.4, C.piedra, {colTecho: C.piedraO});
      if (!ruina && ctx.danio < 2 && ctx.lod < 2) for (let k = 0; k < 8; k++) { const a = Math.floor(k / 2), s = k % 2 ? 1 : -1, P = [[s * 1.3, 2.05], [2.05, s * 1.3], [s * 1.3, -2.05], [-2.05, s * 1.3]][a]; G.muro.caja(P[0], y0 + h, P[1], 0.6, 0.7, 0.4, C.piedra, {ry: a % 2 ? Math.PI / 2 : 0}); }   // almenas
      puerta(ctx, 4.4, 4.4, 0, y0, 1.0, 2.0, 0x4a3020); if (ctx.lod <= 1) [0, 1, 2].forEach(f => ventana(ctx, 4.4, 4.4, 2, 0, y0 + 3 + f * 2.6, 0.25, 0.9, f + 1));
      if (ctx.salida) { salidaCaja(ctx, 4.4, 4.4, h); ctx.salida.info.plantas = 3; if (!ruina) [[0, 1], [0, -1], [1, 0], [-1, 0]].forEach(([fx, fz]) => ctx.salida.tiradores.push({tipo: 'torre', pos: aMundo3(ctx, fx * 1.6, y0 + h, fz * 1.6), dir: dirMundo(ctx, fx, fz), alto: 'baja', edificio: 'torre_vigilancia', acceso: aMundo3(ctx, 0, y0, 2.4)})); }
      return; }
    const hp = ruina ? 3 : 7.2, L = 3.6; [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([a, b]) => { const x = a * L / 2, z = b * L / 2, h0 = ctx.H(x, z) - 0.3; G.muro.caja(x, h0, z, 0.24, y0 + hp - h0 + 1.1, 0.24, C.madera); });
    if (ctx.lod < 2) [2.0, 4.6].forEach(yy => { [[0, L / 2], [0, -L / 2]].forEach(([x, z]) => G.detalle.caja(x, y0 + yy, z, L, 0.12, 0.12, C.maderaO, {rz: 0.55})); [[L / 2, 0], [-L / 2, 0]].forEach(([x, z]) => G.detalle.caja(x, y0 + yy, z, 0.12, 0.12, L, C.maderaO, {rx: 0.55})); });   // riostras
    if (!ruina) { G.muro.caja(0, y0 + hp, 0, L + 0.8, 0.2, L + 0.8, C.madera); if (ctx.lod < 2) [[0, L / 2 + 0.4, L + 0.8, 0.08], [0, -L / 2 - 0.4, L + 0.8, 0.08], [L / 2 + 0.4, 0, 0.08, L + 0.8], [-L / 2 - 0.4, 0, 0.08, L + 0.8]].forEach(([x, z, ww, dd]) => G.detalle.caja(x, y0 + hp + 0.2, z, ww, 1.0, dd, C.madera));
      const sv = ctx.cubierta; tejado(ctx, L + 0.8, L + 0.8, y0 + hp + 2.2, 'cuatro', {pend: 30, vuelo: 0.4}); ctx.cubierta = sv; [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([a, b]) => G.detalle.caja(a * (L / 2 + 0.3), y0 + hp + 0.2, b * (L / 2 + 0.3), 0.12, 2.0, 0.12, C.madera)); }
    escaleraMano(Object.assign({}, ctx, {salida: null}), L, L, y0 - 0.35, y0 + hp, 0);
    if (ctx.salida) { const s = ctx.salida, [cx, cz] = aMundo(ctx, 0, 0); s.colliders.push({tipo: 'caja', centro: [cx, cz], ancho: L * ctx.M, fondo: L * ctx.M, rot: ctx.p.rot, alto: (hp + 1.2) * ctx.M, base: ctx.p.suelo, edificio: 'torre_vigilancia', blando: true}); s.info.alto = (hp + 3) * ctx.M; s.info.plantas = 1;
      s.escaleras.push({tipo: 'mano', base: aMundo3(ctx, L / 2 + 1.2, y0 - 0.35, 0), cima: aMundo3(ctx, L / 2, y0 + hp, 0), edificio: 'torre_vigilancia'});
      if (!ruina) [[0, 1], [0, -1], [1, 0], [-1, 0]].forEach(([fx, fz]) => s.tiradores.push({tipo: 'torre', pos: aMundo3(ctx, fx * 1.4, y0 + hp + 0.2, fz * 1.4), dir: dirMundo(ctx, fx, fz), alto: 'baja', edificio: 'torre_vigilancia', acceso: aMundo3(ctx, L / 2 + 1.2, y0, 0)})); }
  },
  molino(ctx) {
    const G = ctx.G, st = ctx.st, y0 = ctx.suelo, h = 10, rb = 3.2, rt = 2.3, n = ctx.lod ? 6 : 10, med = st === ESTILOS.mediterraneo, col = med ? 0xefe9dc : st === ESTILOS.ruso ? 0x7a5a3e : 0xd8d0c0, hh = ctx.danio >= 3 ? h * 0.5 : h;
    G.muro.cil(0, ctx.cim, 0, rb + 0.15, rb + 0.15, y0 - ctx.cim + 0.35, n, st.zocalo); G.muro.cil(0, y0 + 0.35, 0, rb, rb - (rb - rt) * hh / h, hh, n, col);
    if (ctx.danio < 3) { G.tejado.cil(0, y0 + h + 0.35, 0, rt + 0.3, 0, med ? 2.2 : 3.2, n, med ? 0x7a6a52 : st.tejado);
      if (ctx.lod < 2) { const ys = y0 + h - 0.6, zs = rt + 0.6, rotas = ctx.danio === 2;
        movil(ctx, 'aspas', [0, ys, zs], [0, 0, 1], rotas ? 0 : 0.9, g => { for (let k = 0; k < 4; k++) { if (rotas && k === 1) continue; conMatriz([g], new THREE.Matrix4().makeRotationZ(k * Math.PI / 2), () => {
          g.caja(0, 0, 0, 0.25, 8.5, 0.18, C.maderaO); if (ctx.lod === 0) { g.quad([0.15, 2, 0.1], [1.4, 2, 0.1], [1.4, 8.3, 0.1], [0.15, 8.3, 0.1], ctx.danio ? C.hueco : 0xd8d0b8); g.quad([1.4, 2, 0.1], [0.15, 2, 0.1], [0.15, 8.3, 0.1], [1.4, 8.3, 0.1], ctx.danio ? C.hueco : 0xd8d0b8); } }); } g.cil(0, -0.3, 0, 0.3, 0.3, 0.6, 6, C.maderaO); }); } }
    puerta(ctx, rb * 2, rb * 2 - 0.3, 0, y0 + 0.35, 1.1, 2, null);
    if (ctx.salida) { const [x, z] = aMundo(ctx, 0, 0); ctx.salida.colliders.push({tipo: 'circulo', centro: [x, z], radio: rb * ctx.M, alto: hh * ctx.M, base: ctx.p.suelo, edificio: 'molino', blando: false}); ctx.salida.info.alto = (hh + 3) * ctx.M; ctx.salida.info.plantas = 3;
      [0, 1, 2].forEach(k => { const a = k * 2.1 + 0.4, [px, pz] = aMundo(ctx, Math.sin(a) * rt, Math.cos(a) * rt); ctx.salida.loopholes.push({tipo: 'aspillera', pos: [px, (y0 + 3 + k * 2.6) * ctx.M, pz], dir: dirMundo(ctx, Math.sin(a), Math.cos(a)), planta: k, edificio: 'molino', ancho: 0.4 * ctx.M}); }); }
  },
  // molino de agua: casa de dos plantas con la rueda en la cara +x (hacia el río) y el caz de madera que le lleva el agua
  molino_agua(ctx) {
    const w = ctx.w, d = ctx.d, G = ctx.G, y0 = ctx.suelo + 0.35;
    casa(ctx, 2, {sinAzotea: true, sinValla: true, sinInterior: true, colMuro: ctx.st === ESTILOS.mediterraneo ? 0xe8dcc4 : ctx.st === ESTILOS.ruso ? 0x7a5a3e : 0xb8b0a0});
    const R = 2.6, cx = w / 2 + 0.9, cy = y0 + 0.6, ruina = ctx.danio >= 3;
    if (ctx.lod < 2 && !ruina) { movil(ctx, 'rueda', [cx, cy, 0], [1, 0, 0], ctx.danio >= 2 ? 0 : 0.7, g => { const n = ctx.lod ? 8 : 14, P = (a, r2, x) => [x, Math.cos(a) * r2, Math.sin(a) * r2];
        [-0.45, 0.45].forEach(x => { for (let i = 0; i < n; i++) { const a0 = i / n * 6.283, a1 = (i + 1) / n * 6.283; g.quad2(P(a0, R, x), P(a1, R, x), P(a1, R - 0.25, x), P(a0, R - 0.25, x), C.maderaO); } });
        for (let i = 0; i < n; i++) { const a = i / n * 6.283; conMatriz([g], new THREE.Matrix4().makeRotationX(a), () => { g.caja(0, R - 0.55, 0, 0.95, 0.6, 0.05, C.madera); if (ctx.lod === 0) g.caja(0, 0, 0, 0.08, R - 0.2, 0.08, C.maderaO); }); }
        g.cilX(-0.7, 0.7, 0, 0, 0.16, 6, C.hierro, true); });
      G.detalle.caja(cx, cy + R + 0.2, -d / 2 - 1.5, 1.0, 0.5, d + 1.2, C.maderaO, {sinTecho: false, colTecho: C.agua}); [-d / 2 - 1.5, -d / 4].forEach(z => G.detalle.caja(cx, ctx.H(cx, z) - 0.3, z, 0.2, cy + R + 0.5 - ctx.H(cx, z), 0.2, C.maderaO)); }   // caz y pies derechos
    if (ctx.salida) ctx.salida.info.alto = 6.5 * ctx.M;
  },
  mansion(ctx) {
    const w = 18, d = 12, y0 = ctx.suelo, st = ctx.st, G = ctx.G, pl = ctx.era >= 1 ? 3 : 2, hp = 3.6;
    const W = ctx.w, D = ctx.d; ctx.w = w; ctx.d = d;
    zocalo(ctx, w, d); let y = y0 + 0.35; const muroCol = st === ESTILOS.ruso ? 0xd8c8a8 : st === ESTILOS.norte ? 0xe8e0d0 : st.muro;
    const ytop = paredes(ctx, w, d, y, hp * pl, muroCol);
    for (let f = 0; f < pl; f++) for (let u = -w / 2 + 1.6; u <= w / 2 - 1.5; u += 2.2) { if (f === 0 && Math.abs(u) < 1.2) continue; ventana(ctx, w, d, 0, u, y + f * hp + 0.9, 1.1, 1.9, f); if (ctx.lod === 0 || f === 0) ventana(ctx, w, d, 1, u, y + f * hp + 0.9, 1.1, 1.9, f); }
    if (ctx.lod <= 1) for (let f = 0; f < pl; f++) [-2.5, 2.5].forEach(u => { ventana(ctx, w, d, 2, u, y + f * hp + 0.9, 1.1, 1.9, f); ventana(ctx, w, d, 3, u, y + f * hp + 0.9, 1.1, 1.9, f); });
    puerta(ctx, w, d, 0, y, 1.8, 2.8, null);
    if (ctx.lod === 0 && ctx.danio < 3) { [-2.2, -0.8, 0.8, 2.2].forEach(x => G.detalle.cil(x, y, d / 2 + 1.8, 0.22, 0.2, 4.4, 6, C.blanco)); G.detalle.caja(0, y + 4.4, d / 2 + 1.1, 5.6, 0.4, 2.4, C.blanco); G.tejado.quad([-2.9, y + 4.8, d / 2 + 2.3], [2.9, y + 4.8, d / 2 + 2.3], [0, y + 6.0, d / 2 + 2.3], [0, y + 6.0, d / 2 + 2.3], C.blanco);
      if (ctx.salida) ctx.salida.tiradores.push({tipo: 'balcon', pos: aMundo3(ctx, 0, y + 4.8, d / 2 + 1.6), dir: dirMundo(ctx, 0, 1), alto: 'baja', edificio: 'mansion'}); }
    const top = tejado(ctx, w, d, ytop, 'cuatro', {pend: 32}); if (ctx.danio < 3) { [-w / 2 + 2.5, w / 2 - 2.5].forEach(x => chimenea(ctx, x, 0, top - 0.5, 1.4));
      if (ctx.lod === 0) [-4, 0, 4].forEach(x => { G.muro.caja(x, ytop + 0.1, d / 2 - 0.6, 1.6, 1.4, 1.5, muroCol); G.tejado.quad([x - 1, ytop + 1.5, d / 2 + 0.25], [x + 1, ytop + 1.5, d / 2 + 0.25], [x, ytop + 2.3, d / 2 - 0.3], [x, ytop + 2.3, d / 2 - 0.3], st.tejado); G.detalle.quad([x - 0.4, ytop + 0.3, d / 2 + 0.17], [x + 0.4, ytop + 0.3, d / 2 + 0.17], [x + 0.4, ytop + 1.2, d / 2 + 0.17], [x - 0.4, ytop + 1.2, d / 2 + 0.17], C.cristal); }); }
    if (ctx.salida) { salidaCaja(ctx, w, d, hp * pl); ctx.salida.info.plantas = pl; }
    ctx.w = W; ctx.d = D;
    const mw = W / 2 - 0.5, md = D / 2 - 0.5, cerca = st.cerca === 'valla' ? 'piedra' : st.cerca; muroBajo(ctx, -mw, -md, mw, -md, cerca); muroBajo(ctx, -mw, -md, -mw, md, cerca); muroBajo(ctx, mw, -md, mw, md, cerca); muroBajo(ctx, -mw, md, -2.5, md, cerca); muroBajo(ctx, 2.5, md, mw, md, cerca);
    if (ctx.lod === 0) [-2.5, 2.5].forEach(x => G.muro.caja(x, ctx.cim, md, 0.8, y0 - ctx.cim + 2.4, 0.8, C.piedra));
  },
  // puentes: el eje x local va a lo largo del puente (w = largo, d = ancho del tablero); estribos en las orillas, pilas hasta el lecho
  puente_piedra(ctx) { puente(ctx, true); },
  puente_madera(ctx) { puente(ctx, false); },
  vado(ctx) {
    const w = ctx.w, d = ctx.d, G = ctx.G;
    if (ctx.lod === 0) { for (let x = -w / 2; x <= w / 2; x += 0.9) for (let z = -d / 2 + 0.5; z < d / 2; z += 1.1) { const xx = x + (ctx.r() - 0.5) * 0.4, zz = z + (ctx.r() - 0.5) * 0.4; G.inst.escombro.push(instM(ctx, xx, ctx.H(xx, zz) - 0.12, zz, ctx.r() * 3, 0.45, 0.18, 0.45)); }   // lecho de grava
      for (let x = -w / 2; x <= w / 2 + 0.01; x += 3) [-1, 1].forEach(s => { const z = s * (d / 2 + 0.3); G.inst.baliza.push(instM(ctx, x, ctx.H(x, z) - 0.3, z, 0)); G.detalle.caja(x, ctx.H(x, z) + 1.1, z, 0.13, 0.22, 0.13, C.rojo); }); }   // balizas
    else if (ctx.lod === 1) for (let x = -w / 2; x <= w / 2 + 0.01; x += 6) [-1, 1].forEach(s => G.detalle.caja(x, ctx.H(x, s * d / 2) - 0.3, s * d / 2, 0.12, 1.8, 0.12, 0xd8d0c0));
    if (ctx.salida) { const a = aMundo(ctx, -w / 2, 0), b = aMundo(ctx, w / 2, 0); ctx.salida.superficies.push({tipo: 'vado', a, b, ancho: d * ctx.M, y: null, edificio: 'vado'}); ctx.salida.info.alto = 0; }
  }
};
// ala de una sola planta (hacienda): muro, ventanitas hacia fuera, tejado de teja a un agua hacia el patio
function alaSimple(ctx, h, frente) {
  const w = ctx.w, d = ctx.d, y0 = ctx.suelo + 0.35, col = ctx.st.muro;
  zocalo(ctx, w, d); const yt = paredes(ctx, w, d, y0, h, col);
  if (ctx.lod <= 1) for (let u = -w / 2 + 1.2; u < w / 2 - 0.8; u += 3) ventana(ctx, w, d, frente ? 0 : 2, u, y0 + 1.4, 0.6, 0.9, 0);
  if (ctx.danio < 3) { const G = ctx.G.tejado, v = 0.3, col2 = colCubierta(ctx); G.quad([-w / 2 - v, yt + 0.9, d / 2 + v], [w / 2 + v, yt + 0.9, d / 2 + v], [w / 2 + v, yt - 0.1, -d / 2 - v], [-w / 2 - v, yt - 0.1, -d / 2 - v], col2);
    ctx.G.muro.tri([-w / 2, yt, d / 2], [-w / 2, yt + 0.9, d / 2], [-w / 2, yt, -d / 2], col); ctx.G.muro.tri([w / 2, yt, -d / 2], [w / 2, yt + 0.9, d / 2], [w / 2, yt, d / 2], col); ctx.G.muro.quad([-w / 2, yt, d / 2], [w / 2, yt, d / 2], [w / 2, yt + 0.9, d / 2], [-w / 2, yt + 0.9, d / 2], col); }
  if (ctx.salida) salidaCaja(ctx, w, d, h);
}
function puente(ctx, piedra) {
  const w = ctx.w, d = ctx.d, G = ctx.G, ruina = ctx.danio >= 3, hEnd = Math.max(ctx.H(-w / 2, 0), ctx.H(w / 2, 0)), lecho = Math.min(...[-0.3, -0.15, 0, 0.15, 0.3].map(t => ctx.H(t * w, 0))) - 0.6, yd = hEnd + 0.5;
  const col = piedra ? (ctx.st === ESTILOS.ingles ? 0x8a8478 : ctx.st === ESTILOS.mediterraneo ? 0xc8bca8 : C.piedra) : C.madera, nVanos = piedra ? Math.max(1, Math.min(3, Math.round((w - 10) / 9))) : 0, roto = ctx.danio >= 2;
  const luz = (w - 6) / Math.max(1, nVanos), vanoRoto = roto ? Math.floor(nVanos / 2) : -1;
  if (piedra) {
    [-1, 1].forEach(s => G.muro.caja(s * (w / 2 - 1.5), Math.min(lecho, ctx.H(s * w / 2, 0) - 1), 0, 3, yd - Math.min(lecho, ctx.H(s * w / 2, 0) - 1), d, col, {colTecho: 0x9a948a}));   // estribos
    for (let i = 0; i < nVanos; i++) { const x0 = -w / 2 + 3 + i * luz, x1 = x0 + luz, xm = (x0 + x1) / 2, flecha = Math.min(luz / 2, yd - lecho - 0.8), yA = yd - 0.6 - flecha, n = ctx.lod ? 4 : 8;
      if (i > 0) { G.muro.caja(x0, lecho - 0.5, 0, 1.6, yd - lecho, d, col); if (ctx.lod < 2) G.muro.cil(x0, lecho - 0.5, d / 2 + 0.6, 0.85, 0.2, yA - lecho + 1.5, 3, col); }   // pila y tajamar
      if (i === vanoRoto && ruina) continue;
      for (let k = 0; k < n; k++) { const a0 = Math.PI * k / n, a1 = Math.PI * (k + 1) / n, X = a => xm - Math.cos(a) * luz / 2, Y = a => yA + Math.sin(a) * flecha;
        [-1, 1].forEach(s => { const z = s * d / 2, q = [[X(a0), Y(a0), z], [X(a1), Y(a1), z], [X(a1), yd, z], [X(a0), yd, z]]; if (s > 0) G.muro.quad(...q, col); else G.muro.quad(q[1], q[0], q[3], q[2], col); });   // tímpanos
        G.muro.quad([X(a0), Y(a0), -d / 2], [X(a1), Y(a1), -d / 2], [X(a1), Y(a1), d / 2], [X(a0), Y(a0), d / 2], 0x7a766e); }   // intradós
    }
    const tramos = vanoRoto >= 0 && ruina ? [[-w / 2, -w / 2 + 3 + vanoRoto * luz], [-w / 2 + 3 + (vanoRoto + 1) * luz, w / 2]] : [[-w / 2, w / 2]];
    tramos.forEach(([a, b]) => { G.muro.caja((a + b) / 2, yd - 0.6, 0, b - a, 0.6, d, col, {colTecho: ctx.st === ESTILOS.mediterraneo ? 0xb8a890 : 0x7a766e});
      [-1, 1].forEach(s => { const roto2 = roto && ctx.r() < 0.5; G.muro.caja((a + b) / 2, yd, s * (d / 2 - 0.25), b - a, roto2 ? 0.5 : 1.0, 0.5, col, {colTecho: 0x9a948a}); }); });   // tablero y pretiles
  } else {
    const nB = Math.max(2, Math.round(w / 4)); for (let i = 0; i <= nB; i++) { const x = -w / 2 + w * i / nB, h0 = Math.min(ctx.H(x, 0) - 0.4, yd - 0.8); if (ruina && i === Math.floor(nB / 2)) continue;
      [-d / 2 + 0.3, 0, d / 2 - 0.3].forEach(z => G.muro.caja(x, h0, z, 0.3, yd - 0.45 - h0, 0.3, C.maderaO)); G.muro.caja(x, yd - 0.75, 0, 0.35, 0.3, d + 0.4, C.maderaO);
      if (ctx.lod < 2 && yd - h0 > 2.5) G.detalle.caja(x, h0 + 0.6, 0, 0.12, 0.12, d * 1.1, C.maderaO, {rx: 0.7}); }   // caballetes y riostras
    const tramos = ruina ? [[-w / 2, -w / 2 + w * Math.floor(nB / 2 - 1) / nB], [-w / 2 + w * Math.ceil(nB / 2 + 1) / nB, w / 2]] : [[-w / 2, w / 2]];
    tramos.forEach(([a, b]) => { G.muro.caja((a + b) / 2, yd - 0.45, 0, b - a, 0.18, d, C.madera, {colTecho: 0x8a6a44});
      if (ctx.lod === 0) for (let x = a; x < b; x += 0.6) G.detalle.quad([x, yd - 0.26, -d / 2], [x + 0.04, yd - 0.26, -d / 2], [x + 0.04, yd - 0.26, d / 2], [x, yd - 0.26, d / 2], C.maderaO);   // juntas del entablado
      if (ctx.lod < 2) [-1, 1].forEach(s => { G.detalle.caja((a + b) / 2, yd + 0.55, s * (d / 2 - 0.08), b - a, 0.1, 0.1, C.madera); for (let x = a; x <= b + 0.01; x += 2) G.detalle.caja(x, yd - 0.3, s * (d / 2 - 0.08), 0.12, 0.95, 0.12, C.madera); }); });   // barandillas
  }
  if (ctx.salida) { const s = ctx.salida, M = ctx.M, a = aMundo(ctx, -w / 2, 0), b = aMundo(ctx, w / 2, 0);
    s.superficies.push({tipo: piedra ? 'puente_piedra' : 'puente_madera', a, b, ancho: d * M, y: yd * M, cortado: !!ruina, edificio: piedra ? 'puente_piedra' : 'puente_madera'});
    [-1, 1].forEach(sg => { const p0 = aMundo(ctx, -w / 2, sg * (d / 2 - 0.25)), p1 = aMundo(ctx, w / 2, sg * (d / 2 - 0.25)); s.colliders.push({tipo: 'segmento', a: p0, b: p1, alto: 1.0 * M, grosor: (piedra ? 0.5 : 0.12) * M, blando: !piedra, salto: true, base: yd * M, edificio: 'puente'});
      if (piedra) for (let t = 0.15; t < 0.9; t += 0.18) { const [x, z] = aMundo(ctx, lerp(-w / 2, w / 2, t), sg * (d / 2 - 0.9)); s.cover.push({tipo: 'pretil', pos: [x, yd * M, z], alto: 'baja', protegeDe: dirMundo(ctx, 0, sg), lados: ['arriba', 'izq', 'der'], capacidad: 1, edificio: 'puente'}); } });
    s.info.alto = (yd - lecho) * M; s.info.plantas = 0; }
}
function granero(ctx) {
  const w = ctx.w, d = ctx.d, y0 = ctx.suelo, G = ctx.G, col = ctx.st === ESTILOS.mediterraneo ? 0xd8ccb4 : ctx.st === ESTILOS.norte || ctx.st === ESTILOS.americano ? 0x8a3428 : 0x7a5a3e;
  zocalo(ctx, w, d); const yt = paredes(ctx, w, d, y0 + 0.35, 4.2, col);
  if (ctx.lod === 0 && ctx.danio < 3) for (let x = -w / 2; x <= w / 2; x += 0.9) { G.detalle.quad([x, y0 + 0.4, d / 2 + 0.02], [x + 0.06, y0 + 0.4, d / 2 + 0.02], [x + 0.06, yt, d / 2 + 0.02], [x, yt, d / 2 + 0.02], C.maderaO); }
  puerta(ctx, w, d, 0, y0 + 0.35, 3.2, 3.4, 0x4a3424);
  tejado(ctx, w, d, yt, 'dos', {pend: 48, colHastial: col});
  escaleraMano(ctx, w, d, y0, yt, -d / 4);
  if (ctx.salida) { salidaCaja(ctx, w, d, 4.2); ctx.salida.info.plantas = 1; }
}
// casa de 1–4 plantas (base de casi todos los tipos): o = {letrero, tienda, balcon, colMuro, anchoPuerta, altoPuerta, chimenea: [x, z, h], sinAzotea, azoteaForzada, sinValla, sinInterior, adosada}
function casa(ctx, pl, o) {
  o = o || {}; const w = ctx.w, d = ctx.d, st = ctx.st, y0 = ctx.suelo, hp = 2.9, R = ctx.r, tipo = ctx.p.tipo, jap = st === ESTILOS.japones, yb = y0 + (jap ? 0.6 : 0.35);
  const nv = Math.max(1, Math.floor((w - 1.5) / 2.6)), posV = []; for (let i = 0; i < nv + 1; i++) posV.push(-w / 2 + 0.75 + (i + 0.5) * (w - 1.5) / (nv + 1));
  const iPuerta = o.adosada ? (posV.length > 1 ? posV.length - 1 : 0) : Math.floor(R() * posV.length), pw = o.anchoPuerta || 1.05, ph = o.altoPuerta || 2.1;
  const conInterior = ctx.interior && !o.sinInterior && ctx.danio < 3; ctx.hueco = conInterior ? {u: posV[iPuerta], pw, ph} : null;
  zocalo(ctx, w, d); const colM = o.colMuro || st.muro, ytop = paredes(ctx, w, d, yb, hp * pl, colM); decoMuro(ctx, w, d, yb, hp * pl);
  for (let f = 0; f < pl; f++) posV.forEach((u, i) => {
    if (f === 0 && i === iPuerta) return; const vh = st === ESTILOS.mediterraneo ? 1.1 : 1.3;
    if (f === 0 && o.tienda && ctx.lod <= 1) { ctx.G.detalle.quad([u - 0.95, yb + 0.5, d / 2 + 0.05], [u + 0.95, yb + 0.5, d / 2 + 0.05], [u + 0.95, yb + 2.3, d / 2 + 0.05], [u - 0.95, yb + 2.3, d / 2 + 0.05], ctx.danio ? C.hueco : C.cristal);   // escaparate
      if (ctx.lod === 0) ctx.G.detalle.quad([u - 1.1, yb + 2.4, d / 2 + 0.06], [u + 1.1, yb + 2.4, d / 2 + 0.06], [u + 1.1, yb + 2.8, d / 2 + 0.06], [u - 1.1, yb + 2.8, d / 2 + 0.06], [C.rojo, 0x2a4a6a, 0x3a5a3a][i % 3]); return; }
    ventana(ctx, w, d, 0, u, yb + f * hp + 0.95, 0.9, vh, f);
    if (ctx.lod === 0 && (i % 2 === 0)) ventana(ctx, w, d, 1, u, yb + f * hp + 0.95, 0.8, vh, f);
    if (o.balcon && f >= 1 && ctx.lod === 0 && ctx.danio < 3) { ctx.G.detalle.caja(u, yb + f * hp + 0.85, d / 2 + 0.35, 1.3, 0.1, 0.7, C.piedra); ctx.G.detalle.caja(u, yb + f * hp + 0.95, d / 2 + 0.68, 1.3, 0.9, 0.04, C.hierro);
      if (ctx.salida) ctx.salida.tiradores.push({tipo: 'balcon', pos: aMundo3(ctx, u, yb + f * hp + 0.95, d / 2 + 0.4), dir: dirMundo(ctx, 0, 1), alto: 'baja', edificio: tipo}); }
  });
  if (ctx.lod <= 1 && !o.adosada) for (let f = 0; f < pl; f++) { ventana(ctx, w, d, 2, 0, yb + f * hp + 0.95, 0.8, 1.2, f); if (ctx.lod === 0) ventana(ctx, w, d, 3, 0, yb + f * hp + 0.95, 0.8, 1.2, f); }
  puerta(ctx, w, d, posV[iPuerta], yb, pw, ph);
  interior(ctx, w, d, yb, hp, tipo); ctx.hueco = null;
  const azo = !o.sinAzotea && (o.azoteaForzada || (st.azotea && R() < st.azotea));
  let top;
  if (azo) { const acc = o.adosada ? null : escaleraExt(ctx, w, d, yb - 0.35, ytop); top = azotea(ctx, w, d, ytop, {acceso: acc, col: colM}); }
  else { const tipoT = jap ? 'cuatro' : st === ESTILOS.mediterraneo && R() < 0.4 && !o.adosada ? 'cuatro' : (pl === 2 && R() < 0.3 && !o.adosada ? 'cuatro' : 'dos'); top = tejado(ctx, w, d, ytop, tipoT, {colHastial: colM});
    if (!jap) chimenea(ctx, o.chimenea ? o.chimenea[0] : (R() < 0.5 ? -1 : 1) * w * 0.28, o.chimenea ? o.chimenea[1] : -d * 0.12, top - 0.3, o.chimenea ? o.chimenea[2] : 0.9);
    if (pl >= 2 && ctx.lod === 0 && tipoT === 'dos' && st.pend >= 40 && ctx.danio === 0 && R() < 0.5) { const x = posV[Math.floor(posV.length / 2)] || 0, G = ctx.G; G.muro.caja(x, ytop + 0.2, d / 4 + 0.4, 1.4, 1.2, 1.2, colM); G.tejado.quad([x - 0.9, ytop + 1.4, d / 4 + 1.15], [x + 0.9, ytop + 1.4, d / 4 + 1.15], [x, ytop + 2.0, d / 4 + 0.6], [x, ytop + 2.0, d / 4 + 0.6], colCubierta(ctx)); G.detalle.quad([x - 0.35, ytop + 0.4, d / 4 + 1.02], [x + 0.35, ytop + 0.4, d / 4 + 1.02], [x + 0.35, ytop + 1.2, d / 4 + 1.02], [x - 0.35, ytop + 1.2, d / 4 + 1.02], C.cristal);
      if (ctx.salida) ctx.salida.tiradores.push({tipo: 'buhardilla', pos: aMundo3(ctx, x, ytop + 0.6, d / 4 + 0.9), dir: dirMundo(ctx, 0, 1), alto: 'alta', edificio: tipo}); } }
  if (st.porche && !o.adosada && pl <= 2) porche(ctx, w, d, yb, false); else if (jap) porche(ctx, w, d, yb, true);
  if (o.letrero && ctx.lod === 0) { const G = ctx.G; G.detalle.caja(w / 2 - 1, yb + 2.85, d / 2 + 0.6, 0.08, 0.08, 1.1, C.hierro); G.detalle.caja(w / 2 - 1, yb + 2.05, d / 2 + 1.0, 0.06, 0.7, 0.9, 0x8a5a2a); }
  if (ctx.danio && ctx.lod === 0) for (let k = 0; k < 1 + ctx.danio * 3; k++) { const ex = (R() - 0.5) * (w + 3), ez = (R() - 0.5) * (d + 3); ctx.G.inst.escombro.push(instM(ctx, ex, Math.max(ctx.H(ex, ez), Math.abs(ex) < w / 2 && Math.abs(ez) < d / 2 ? ctx.suelo : -1e9) - 0.1, ez, R() * 3, 0.3 + R() * 0.8, 0.2 + R() * 0.4, 0.3 + R() * 0.8)); }
  if (ctx.danio === 2 && ctx.lod <= 1) { const G = ctx.G.detalle, u = (R() - 0.5) * (w - 3); G.quad([u - 1, yb + 0.55, d / 2 + 0.06], [u + 0.8, yb + 0.25, d / 2 + 0.06], [u + 1.1, yb + 1.85, d / 2 + 0.06], [u - 0.6, yb + 2.15, d / 2 + 0.06], C.hueco);
    if (ctx.salida) { const [x, z] = aMundo(ctx, u, d / 2 - 0.3); ctx.salida.loopholes.push({tipo: 'boquete', pos: [x, (yb + 1.25) * ctx.M, z], dir: dirMundo(ctx, 0, 1), planta: 0, edificio: tipo, ancho: 1.6 * ctx.M}); } }
  if (ctx.salida) { salidaCaja(ctx, w, d, ctx.danio >= 3 ? hp * pl * 0.5 : hp * pl); ctx.salida.info.plantas = Math.max(ctx.salida.info.plantas || 0, pl); }
  if (!o.sinValla && !o.adosada && R() < 0.3 && /casa/.test(tipo)) muroBajo(ctx, -w / 2, d / 2 + 1.6, w / 2, d / 2 + 1.6, st === ESTILOS.ingles || st === ESTILOS.mediterraneo ? (st.cerca === 'adobe' ? 'adobe' : 'piedra') : st === ESTILOS.americano ? 'valla' : 'valla', 1.0);
  return top;
}

/* ===================================================================================== */
/* PRUEBA AUTOMÁTICA: presupuestos por edificio, nada enterrado ni flotando, sin solapes, nada sobre calles ni sobre el río */
// presupuesto de triángulos por edificio [LOD0, LOD1, LOD2]. Casas y edificios sueltos: 3500/1200/400 (lo que pide el encargo).
// Los conjuntos con patio o varias piezas (granjas, hacienda, mansión, iglesia con cementerio, fila de adosadas, puente de piedra) son
// varios edificios en una parcela: se les da el doble y se dice así en la documentación.
const PRESUP = {base: [3500, 1200, 400], conjunto: [7000, 2400, 800]};
const CONJUNTOS = /^(granja|granja_fortificada|hacienda|mansion|iglesia|adosadas|puente_piedra)$/;
const presupuesto = t => CONJUNTOS.test(t) ? PRESUP.conjunto : PRESUP.base;
// tfFactory(semilla, plano, bioma) → terreno con los caminos del plano (y el cauce del río si lo hay); tfFactory.centro = [x, z] opcional
// terreno de muestra para el catálogo: plano, con un cauce de río a lo largo de z en x = x0 (para puentes, vados y molino de agua)
function cauceMuestra(x0, ancho, prof) { const h = (x, z) => { const u = Math.abs(x - x0) / (ancho / 2); return u >= 1.6 ? 0 : -prof * (u < 1 ? 1 : 1 - (u - 1) / 0.6); }; return {height: h, heightAt: h, aplanar: () => 0}; }
const conCauce = t => /^(puente|vado|molino_agua)/.test(t);
function pruebaPueblos(tfFactory) {
  const out = [], fallos = [];
  // 1) catálogo: cada tipo × estilo × daño sobre terreno plano (presupuestos por edificio)
  const plano = {height: () => 0, aplanar: () => 0}, catalogo = [];
  const tipos = Object.keys(TIPOS).filter(t => t !== 'molino_viento' && t !== 'huerto'), estilos = Object.keys(ESTILOS), eras = ['A', 'C', 'E'];
  tipos.forEach(t => estilos.forEach((e, ie) => [0, 1, 2, 3].forEach(dn => { const era = eras[(ie + dn) % 3];
    const P = construirEdificio(t, e, era, conCauce(t) ? cauceMuestra(t === 'molino_agua' ? 7.1 / 0.6 + 12 : 0, 24, t === 'vado' ? 1.2 : 5) : plano, {danio: dn, semilla: 3 + ie * 5 + dn, humo: false}), ed = P.edificios[0], tr = ed ? ed.tris : [0, 0, 0], lim = presupuesto(t);
    const ok = tr[0] <= lim[0] && tr[1] <= lim[1] && tr[2] <= lim[2] && tr[0] > 0;
    catalogo.push({tipo: t, estilo: e, era, danio: dn, tris: tr, ok}); if (!ok) fallos.push(`presupuesto ${t}/${e}/${era}/daño ${dn}: ${tr.join('/')} > ${lim.join('/')}`); })));
  // 2) pueblos completos sobre el terreno real
  const casos = [['templado', 'B', 'grande', null], ['mediterraneo', 'A', 'pueblo', null], ['ruso', 'C', 'pueblo', 'rio'], ['ingles', 'D', 'grande', null], ['nevado', 'E', 'pueblo', null],
    ['templado', 'E', 'aldea', 'rio'], ['americano', 'B', 'pueblo', 'rio'], ['japones', 'E', 'pueblo', null], ['mediterraneo', 'C', 'ciudad', null], ['templado', 'D', 'ciudad', 'rio']];
  casos.forEach(([bio, era, tam, conRio], k) => {
    const seed = 100 + k * 17, [cx, cz] = tfFactory.centro || [520, 420];
    const rio = conRio ? {puntos: [[cx + 10, cz - 400], [cx + 70, cz - 120], [cx + 55, cz + 120], [cx + 110, cz + 400]], ancho: 16} : null;
    const plan = planoPueblo(seed, bio, era, {centro: [cx, cz], tamano: tam, rio}), tf = tfFactory(seed, plan, bio);
    const P = buildVillage(seed, bio, era, tf, {plan});
    let enterrado = 0, flotando = 0, peorEnt = 0, peorFlo = 0;
    plan.parcelas.forEach(p => { if (/^(huerto|puente|vado|calvario)/.test(p.tipo)) return; const E = esquinas(p.cx, p.cz, p.w, p.d, p.rot, 0.08 * P.plan.M);
      for (let a = 0; a < 4; a++) { const [x0, z0] = E[a], [x1, z1] = E[(a + 1) % 4]; for (let t = 0; t <= 1; t += 0.1) { const h = tf.height(lerp(x0, x1, t), lerp(z0, z1, t));
        const ent = h - p.suelo, flo = p.cimiento - h; if (ent > 0.2) enterrado++; if (flo > 0.3) flotando++; peorEnt = Math.max(peorEnt, ent); peorFlo = Math.max(peorFlo, flo); } } });
    const sinPozo = plan.parcelas.filter(p => p.tipo !== 'pozo'); let solapes = 0; const E2 = sinPozo.map(p => esquinas(p.cx, p.cz, p.w, p.d, p.rot));
    for (let i = 0; i < E2.length; i++) for (let j = i + 1; j < E2.length; j++) if (solapan(E2[i], E2[j])) solapes++;
    let enCalle = 0, enRio = 0; sinPozo.forEach(p => { if (/^(puente|vado)/.test(p.tipo)) return; plan.calles.forEach(c => { if (distPoli(p.cx, p.cz, c.puntos) < c.ancho / 2) enCalle++; }); if (rio && distPoli(p.cx, p.cz, rio.puntos) < rio.ancho / 2 + 1) enRio++; });
    const sobre = P.edificios.filter(e => e.tris[0] > presupuesto(e.tipo)[0] || e.tris[1] > presupuesto(e.tipo)[1] || e.tris[2] > presupuesto(e.tipo)[2]).map(e => `${e.tipo}:${e.tris.join('/')}`);
    const puentes = plan.parcelas.filter(p => /^puente/.test(p.tipo)).length;
    const c = {bioma: bio, estilo: P.estilo, era, tamano: tam, rio: !!rio, ...P.stats, enterrados: enterrado, flotando, peorEnterrado: +peorEnt.toFixed(3), peorFlotando: +peorFlo.toFixed(3), solapes, enCalle, enRio, puentes, sobrePresupuesto: sobre,
      tipos: [...new Set(P.edificios.map(e => e.tipo))].sort().join(',')};
    out.push(c);
    if (enterrado || flotando) fallos.push(`${bio}/${era}/${tam}: ${enterrado} puntos enterrados, ${flotando} flotando`);
    if (solapes || enCalle || enRio) fallos.push(`${bio}/${era}/${tam}: solapes ${solapes}, en calle ${enCalle}, en río ${enRio}`);
    if (rio && !puentes) fallos.push(`${bio}/${era}/${tam}: hay río y ninguna calle tiene puente`);
    if (sobre.length) fallos.push(`${bio}/${era}/${tam}: sobre presupuesto ${sobre.join(' ')}`);
    // coherencia de salidas
    P.colliders.forEach(cl => { if (!['caja', 'segmento', 'circulo'].includes(cl.tipo)) fallos.push('collider de tipo raro ' + cl.tipo); });
    P.tiradores.forEach(tr => { if (!tr.pos || tr.pos.some(v => !isFinite(v))) fallos.push('tirador sin posición'); });
  });
  const tiposVistos = new Set(); out.forEach(c => c.tipos.split(',').forEach(t => tiposVistos.add(t)));
  return {casos: out, catalogo, fallos, tiposVistos: [...tiposVistos].sort(), ok: fallos.length === 0};
}

/* ===================================================================================== */
/* DEMOSTRACIÓN: demo.html?m=pueblos&vista=pueblo|catalogo|danos|estilos|rio (&bioma=…&era=…&tam=…&seed=…&noche=1) */
function demoPueblos(cont) {
  const T3 = root.terreno3d; cont = cont || document.body;
  const q = new URLSearchParams(location.search), vista = q.get('vista') || 'pueblo', bio = q.get('bioma') || 'templado', era = q.get('era') || 'B', tam = q.get('tam') || 'grande', seed = +(q.get('seed') || 11);
  const plano = {height: () => 0, aplanar: () => 0}, actualizables = [];
  let D, T = null, extra = {};
  const suelo = (D, w, d, x, z, col) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshLambertMaterial({color: col || 0x6a7a4a})); m.rotation.x = -Math.PI / 2; m.position.set(x, -0.02, z); m.receiveShadow = true; D.escena.add(m); };
  const rotulo = (D, txt, x, y, z) => { const c = document.createElement('canvas'); c.width = 512; c.height = 64; const g = c.getContext('2d'); g.fillStyle = '#000a'; g.fillRect(0, 0, 512, 64); g.fillStyle = '#f0dfb4'; g.font = '28px Georgia'; g.textAlign = 'center'; g.fillText(txt, 256, 42);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({map: new THREE.CanvasTexture(c), depthTest: false})); s.scale.set(14, 1.75, 1); s.position.set(x, y, z); D.escena.add(s); };
  if (vista === 'catalogo' || vista === 'danos' || vista === 'estilos') {
    const lista = vista === 'catalogo' ? Object.keys(TIPOS).filter(t => t !== 'molino_viento' && t !== 'pozo') : vista === 'danos' ? [0, 1, 2, 3] : Object.keys(ESTILOS);
    const cols = vista === 'catalogo' ? 6 : 4, paso = vista === 'catalogo' ? 64 : 46, filas = Math.ceil(lista.length / cols);
    const W = cols * paso, Dd = filas * paso;
    D = T3.baseDemo(cont, {cam: [W / 2, W * 0.55, Dd + W * 0.45], obj: [W / 2 - paso / 2, 0, Dd / 2 - paso / 2], sombra: Math.max(W, Dd)});
    // suelo por casillas; en los tipos con cauce, dos orillas y el lecho con agua
    lista.forEach((it, i) => { const x = (i % cols) * paso, z = Math.floor(i / cols) * paso;
      if (vista !== 'catalogo' || !conCauce(it)) { suelo(D, paso, paso, x, z); return; }
      const xr = x + (it === 'molino_agua' ? 7.1 / 0.6 + 12 : 0), a = x - paso / 2, b = x + paso / 2, g0 = xr - 19.2, g1 = xr + 19.2;
      if (g0 > a) suelo(D, g0 - a, paso, (a + g0) / 2, z); if (b > g1) suelo(D, b - g1, paso, (g1 + b) / 2, z);
      const pr = it === 'vado' ? 1.2 : 5, tf = cauceMuestra(xr, 24, pr), N = 24, P = [], u = k => Math.max(a, g0) + (Math.min(b, g1) - Math.max(a, g0)) * k / N;
      for (let k = 0; k < N; k++) { const u0 = u(k), u1 = u(k + 1), h0 = tf.height(u0, 0), h1 = tf.height(u1, 0);
        P.push(u0, h0, z - paso / 2, u0, h0, z + paso / 2, u1, h1, z + paso / 2, u0, h0, z - paso / 2, u1, h1, z + paso / 2, u1, h1, z - paso / 2); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.computeVertexNormals();
      const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({color: 0x6a5a3e, side: THREE.DoubleSide})); m.receiveShadow = true; D.escena.add(m);
      const ag = new THREE.Mesh(new THREE.PlaneGeometry(26, paso), new THREE.MeshLambertMaterial({color: 0x3a5a6a, transparent: true, opacity: 0.85})); ag.rotation.x = -Math.PI / 2; ag.position.set(xr, -pr * 0.68, z); D.escena.add(ag); });
    const tipoD = q.get('tipo') || 'casa_dos', estD = q.get('estilo') || bio;
    lista.forEach((it, i) => { const x = (i % cols) * paso, z = Math.floor(i / cols) * paso;
      const P = vista === 'catalogo' ? construirEdificio(it, bio, era, conCauce(it) ? cauceMuestra(x + (it === 'molino_agua' ? 7.1 / 0.6 + 12 : 0), 24, it === 'vado' ? 1.2 : 5) : plano, {centro: [x, z], danio: +(q.get('dano') || 0), semilla: 5 + i})
        : vista === 'danos' ? construirEdificio(tipoD, estD, era, plano, {centro: [x, z], danio: it, semilla: 9})
        : construirEdificio(tipoD, it, era, plano, {centro: [x, z], danio: +(q.get('dano') || 0), semilla: 9});
      D.escena.add(P.grupo); actualizables.push(P);
      rotulo(D, vista === 'catalogo' ? TIPOS[it].nombre : vista === 'danos' ? 'Daño ' + it : it, x, 1, z + paso * 0.42); });
  } else {
    // pueblo sobre el terreno real (con río en la vista «rio»)
    const C0 = [520, 420], rio = vista === 'rio' || q.get('rio') ? {puntos: [[560, 0], [625, 300], [610, 540], [670, 768]], ancho: 16} : null;
    const plan = planoPueblo(seed, bio, era, {centro: C0, tamano: tam, rio});
    D = T3.baseDemo(cont, {cam: [C0[0] + 180, 140, C0[1] + 300], obj: [C0[0], 10, C0[1]], sombra: 380});
    const caminos = plan.calles.map(c => ({puntos: c.puntos, ancho: c.ancho}));
    T = T3.crearTerreno({ancho: 1024, fondo: 768, semilla: seed, bioma: /ingles|americano|japones/.test(bio) ? 'templado' : bio, relieve: 16, caminos});
    if (rio) { T.excavarTrinchera(rio.puntos, rio.ancho, 3.2, {parapeto: 0}); const ag = new THREE.Group(); ag.name = 'agua';
      for (let i = 0; i < rio.puntos.length - 1; i++) { const [ax, az] = rio.puntos[i], [bx, bz] = rio.puntos[i + 1], l = Math.hypot(bx - ax, bz - az);
        const m = new THREE.Mesh(new THREE.PlaneGeometry(rio.ancho + 2, l + rio.ancho), new THREE.MeshLambertMaterial({color: 0x3a5a6a, transparent: true, opacity: 0.85})); m.rotation.order = 'YXZ'; m.rotation.y = Math.atan2(bx - ax, bz - az); m.rotation.x = -Math.PI / 2;
        m.position.set((ax + bx) / 2, Math.min(T.height(ax, az), T.height(bx, bz)) + 1.2, (az + bz) / 2); ag.add(m); } D.escena.add(ag); }
    const P = buildVillage(seed, bio, era, T, {plan, danos: q.get('danos') != null ? +q.get('danos') : null});
    T.actualizar(C0[0], C0[1]); D.escena.add(T.grupo, P.grupo); actualizables.push(P); extra = {plan, P};
    if (vista === 'rio') { const pu = plan.parcelas.find(p => /^puente/.test(p.tipo)); if (pu) D.mirar([pu.cx, T.height(pu.cx, pu.cz), pu.cz], 0.9, 110, 0.45); }
    // abre y cierra las puertas poco a poco (prueba de abrirPuerta)
    D.bucle(t => { for (let i = 0; i < P.puertas.length; i += 3) P.abrirPuerta(i, (Math.sin(t * 0.8 + i) * 0.5 + 0.5) * 1.4); });
  }
  if (q.get('noche')) { D.escena.background.setHex(0x101820); D.escena.fog.color.setHex(0x101820); D.escena.children.forEach(o => { if (o.isLight) o.intensity *= 0.25; }); }
  if (q.get('mirar')) { const v = q.get('mirar').split(',').map(Number); D.mirar([v[0], v[1], v[2]], v[3], v[4], v[5]); }
  D.bucle((t, cam) => { if (T) T.actualizar(cam.position.x, cam.position.z); for (let i = 0; i < actualizables.length; i++) { actualizables[i].grupo.update(cam); actualizables[i].actualizar(t); } });
  return Object.assign({T, D, pueblos: actualizables}, extra);
}

root.pueblos3d = {planoPueblo, buildVillage, construirEdificio, ESTILOS, BIOMA_ESTILO, TIPOS, PRESUP, pruebaPueblos, demoPueblos, _util: {esquinas, solapan, distPoli, rng}};
})(typeof window !== 'undefined' ? window : globalThis);
