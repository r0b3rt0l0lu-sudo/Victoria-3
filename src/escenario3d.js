/* ===== escenario3d.js — escenario del campo de batalla para el modo «Batalla» de Victoria (three.js r152, todo procedural) =====
   Complementa a terreno3d.js (relieve), vegetacion3d.js (hierba, árboles básicos, rocas) y pueblos3d.js (edificios). Añade:
   · ÁRBOLES: 10 especies más — castaño, tilo, arce, sauce llorón, abeto, alerce, ciprés, alcornoque, manzano y cerezo — con
     primavera / verano / otoño / invierno (caducos desnudos con ramaje, alerce dorado en otoño, frutales en flor) y nieve.
     Mismo formato que vegetacion3d.crearArbol ({lod0, lod1, alto, radioCopa, radioTronco, colorHoja}, atributo «balanceo»).
   · SETOS con huecos (seto vivo o «bocage» sobre talud de tierra con árboles), con colisores por tramo y la lista de huecos.
   · CULTIVOS con surcos: trigo (espigas; crecido / cosechado con gavillas / arado), maíz (cañas con hojas y mazorcas), viñedo (espalderas
     con postes y alambre; desnudo en invierno), patata (caballones con matas) y pradera (matas y flores). Cubren o no según la altura.
   · FORTIFICACIÓN DE CAMPAÑA: trincheras con parapeto de sacos, revestimiento (tablas, zarzo, sacos o tierra), banqueta de tiro y
     tablones en el fondo (excava el terreno con terreno3d); alambradas (baja, alta de doble delantal, concertina) con cortes;
     caballos de frisa; abatis; gaviones; empalizadas con aspilleras; cráteres (deforman el terreno, borde de tierra removida y terrones);
     fosos (con escarpa de piedra o tierra y agua opcional); puentes de pontones (barcas, viguetas y tablero).
   · RESTOS DE BATALLA generables por parámetro (densidad, época, naciones): fusiles, mochilas, tocados por época, cajas de munición, tambores,
     ruedas rotas, cartucheras, sables; y una lista de FIGURAS para troops3d (cadáveres en poses «cuerpo_inerte_*» de infanteria3d,
     caballos caídos de caballeria3d, piezas desmontadas de artilleria3d) que poblarFiguras() convierte en lotes de instancias.
   Salidas como pueblos3d: colliders (caja / segmento / circulo, con blando, frena y salto), cover (pos, alto, protegeDe), tiradores,
   superficies (trinchera, foso, pontones), brechas (huecos de setos y alambradas), objetos y figuras. 3 LOD por pieza (THREE.LOD).
   Unidades: u del campo (1 u = 0,6 m); las medidas internas van en metros. Ejes: x derecha, y arriba, z hacia el espectador.
   API: crearEscenario(tf, op) → E · crearArbol(especie, op) · arbol(especie, op) (cualquier especie: las de vegetacion3d también)
        generarRestos(op) · poblarFiguras(figuras, Troops3D, shared) · ESPECIES · CULTIVOS · PAL · pruebaEscenario(tfFactory) · demoEscenario(cont) */
(function (root) {
'use strict';
const THREE = root.THREE, MU = 1 / 0.6;
function rng(seed) { let a = (seed >>> 0) || 1; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function h2(i, j, s) { let h = Math.imul(i | 0, 374761393) + Math.imul(j | 0, 668265263) + Math.imul(s | 0, 2147483647); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
function n3(x, y, z, s) { const i = Math.floor(x), j = Math.floor(y), k = Math.floor(z), fx = x - i, fy = y - j, fz = z - k, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), w = fz * fz * (3 - 2 * fz);
  const H = (a, b, c) => h2(a * 7 + c * 131, b, s), L = (a, b, t) => a + (b - a) * t;
  return L(L(L(H(i, j, k), H(i + 1, j, k), u), L(H(i, j + 1, k), H(i + 1, j + 1, k), u), v), L(L(H(i, j, k + 1), H(i + 1, j, k + 1), u), L(H(i, j + 1, k + 1), H(i + 1, j + 1, k + 1), u), v), w); }
const lerp = (a, b, t) => a + (b - a) * t, clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const C = {tierra: 0x6a5238, tierraO: 0x4e3c2a, tierraC: 0x8a7050, barro: 0x5a4a36, madera: 0x7a5a3a, maderaO: 0x4e3a26, maderaC: 0x9a7a52, saco: 0xa8946a, sacoO: 0x8a7a58, zarzo: 0x7a6a44,
  hierro: 0x3a3c40, oxido: 0x6a4a32, alambre: 0x4a4644, piedra: 0x8a8478, piedraO: 0x6a665e, agua: 0x3a5a66, quemado: 0x2a2622, paja: 0xc8b070, rastrojo: 0xb8a060, verde: 0x4a6a32, lona: 0x8a8460, negro: 0x1c1a1a};

/* ---------- constructor de geometría: posiciones, color por vértice y «balanceo» (0 firme … 1 suelto, para el viento) ----------
   Las coordenadas que recibe van en metros, relativas al origen de la pieza; g.m (Matrix4) las lleva al sistema de la pieza en u. */
const _c = new THREE.Color();
function Geo() { this.p = []; this.c = []; this.b = []; this.m = new THREE.Matrix4(); }
Geo.prototype.v = function (q, bal) { const e = this.m.elements, x = q[0], y = q[1], z = q[2]; this.p.push(e[0] * x + e[4] * y + e[8] * z + e[12], e[1] * x + e[5] * y + e[9] * z + e[13], e[2] * x + e[6] * y + e[10] * z + e[14]); this.c.push(_c.r, _c.g, _c.b); this.b.push(bal || 0); };
Geo.prototype.tri = function (a, b, c, col, bal) { _c.setHex(col); this.v(a, bal); this.v(b, bal); this.v(c, bal); };
Geo.prototype.quad = function (a, b, c, d, col, bal) { this.tri(a, b, c, col, bal); this.tri(a, c, d, col, bal); };
Geo.prototype.quad2 = function (a, b, c, d, col, bal) { this.quad(a, b, c, d, col, bal); this.quad(a, d, c, b, col, bal); };
// caja con el centro de la base en (x, y, z); o.ry giro; o.sinTecho; o.colTecho
Geo.prototype.caja = function (x, y, z, w, h, d, col, o) {
  o = o || {}; const cs = Math.cos(o.ry || 0), sn = Math.sin(o.ry || 0), P = (px, py, pz) => [x + px * cs + pz * sn, y + py, z - px * sn + pz * cs], bal = o.bal || 0;
  const a = P(-w / 2, 0, d / 2), b = P(w / 2, 0, d / 2), c = P(w / 2, 0, -d / 2), e = P(-w / 2, 0, -d / 2), A = P(-w / 2, h, d / 2), B = P(w / 2, h, d / 2), Cc = P(w / 2, h, -d / 2), E = P(-w / 2, h, -d / 2);
  this.quad(a, b, B, A, col, bal); this.quad(b, c, Cc, B, col, bal); this.quad(c, e, E, Cc, col, bal); this.quad(e, a, A, E, col, bal); if (!o.sinTecho) this.quad(A, B, Cc, E, o.colTecho == null ? col : o.colTecho, bal); };
// cilindro / cono de eje y
Geo.prototype.cil = function (x, y, z, r0, r1, h, n, col, o) {
  o = o || {}; for (let i = 0; i < n; i++) { const a0 = i / n * Math.PI * 2, a1 = (i + 1) / n * Math.PI * 2, p0 = [x + Math.cos(a0) * r0, y, z + Math.sin(a0) * r0], p1 = [x + Math.cos(a1) * r0, y, z + Math.sin(a1) * r0],
    q0 = [x + Math.cos(a0) * r1, y + h, z + Math.sin(a0) * r1], q1 = [x + Math.cos(a1) * r1, y + h, z + Math.sin(a1) * r1];
    if (r1 > 0.001) this.quad(p1, p0, q0, q1, col, o.bal); else this.tri(p1, p0, q0, col, o.bal); if (o.tapa && r1 > 0.001) this.tri([x, y + h, z], q1, q0, o.colTapa || col, o.bal); } };
// cilindro entre dos puntos 3D (ramas, troncos, palos, alambres gruesos); bal puede ser [balanceo en a, en b]
const _va = new THREE.Vector3(), _vb = new THREE.Vector3(), _vu = new THREE.Vector3(), _vv = new THREE.Vector3(), _vw = new THREE.Vector3();
Geo.prototype.entre = function (a, b, r0, r1, n, col, bal) {
  _va.set(...a); _vb.set(...b); _vw.subVectors(_vb, _va); const L = _vw.length(); if (L < 1e-5) return; _vw.divideScalar(L);
  _vu.set(Math.abs(_vw.y) < 0.9 ? 0 : 1, Math.abs(_vw.y) < 0.9 ? 1 : 0, 0).cross(_vw).normalize(); _vv.crossVectors(_vw, _vu);
  const b0 = Array.isArray(bal) ? bal[0] : bal || 0, b1 = Array.isArray(bal) ? bal[1] : bal || 0, P = (r, ang, t) => { const cs = Math.cos(ang) * r, sn = Math.sin(ang) * r; return [a[0] + _vw.x * L * t + _vu.x * cs + _vv.x * sn, a[1] + _vw.y * L * t + _vu.y * cs + _vv.y * sn, a[2] + _vw.z * L * t + _vu.z * cs + _vv.z * sn]; };
  for (let i = 0; i < n; i++) { const a0 = i / n * Math.PI * 2, a1 = (i + 1) / n * Math.PI * 2; _c.setHex(col);
    const p0 = P(r0, a0, 0), p1 = P(r0, a1, 0), q0 = P(r1, a0, 1), q1 = P(r1, a1, 1); this.v(p0, b0); this.v(p1, b0); this.v(q1, b1); this.v(p0, b0); this.v(q1, b1); if (r1 > 0.001) { this.v(q0, b1); } else { this.v(q0, b1); } } };
// copa / mata: icosaedro deformado con ruido; sombreado falso (más oscuro abajo); ap = achatado vertical
Geo.prototype.mata = function (cx, cy, cz, r, det, col, s, ap, bal, sx) {
  const g = new THREE.IcosahedronGeometry(r, det), P = g.attributes.position, base = new THREE.Color(col);
  for (let i = 0; i < P.count; i += 3) { const tri = [0, 1, 2].map(k => { const x = P.getX(i + k), y = P.getY(i + k), z = P.getZ(i + k), q = 0.72 + 0.55 * n3(x * 1.3 + s, y * 1.3, z * 1.3, s | 0); return [cx + x * q * (sx || 1), cy + y * q * (ap || 1), cz + z * q * (sx || 1)]; });
    const ym = (tri[0][1] + tri[1][1] + tri[2][1]) / 3, f = 0.62 + 0.42 * clamp((ym - cy + r) / (2 * r * (ap || 1)), 0, 1); _c.copy(base).multiplyScalar(Math.min(1.12, f * (0.92 + 0.16 * h2(i, s, 3))));
    tri.forEach(q => this.v(q, typeof bal === 'function' ? bal(q) : bal)); }
  g.dispose(); };
Geo.prototype.tris = function () { return this.p.length / 9; };
Geo.prototype.geometria = function () { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
  g.setAttribute('balanceo', new THREE.Float32BufferAttribute(this.b, 1)); g.computeVertexNormals(); return g; };

/* ---------- materiales: sólido, doble cara, viento (comparte los uniformes de vegetacion3d.VIENTO si está cargado), agua ---------- */
const VIENTO = (root.vegetacion3d && root.vegetacion3d.VIENTO) || {tiempo: {value: 0}, fuerza: {value: 0.6}, dir: {value: new THREE.Vector2(0.8, 0.6)}};
const _MAT = {};
function matViento(amp, doble) {
  const k = 'v' + amp + (doble ? 'd' : ''); if (_MAT[k]) return _MAT[k];
  const m = new THREE.MeshLambertMaterial({vertexColors: true, side: doble ? THREE.DoubleSide : THREE.FrontSide});
  m.onBeforeCompile = sh => { sh.uniforms.uT = VIENTO.tiempo; sh.uniforms.uF = VIENTO.fuerza; sh.uniforms.uD = VIENTO.dir;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float balanceo; uniform float uT; uniform float uF; uniform vec2 uD;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
#ifdef USE_INSTANCING
  vec3 _ip = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
#else
  vec3 _ip = vec3(modelMatrix[3][0], modelMatrix[3][1], modelMatrix[3][2]) + position * 0.02;
#endif
  float _ph = dot(_ip.xz, vec2(0.071, 0.053));
  float _g = 0.55 + 0.45 * sin(uT * 0.35 + _ip.x * 0.004 + _ip.z * 0.003);
  float _a = balanceo * uF * _g * (sin(uT * 1.7 + _ph) * 0.6 + sin(uT * 3.1 + _ph * 1.7) * 0.25 + 0.5);
  transformed.xz += uD * _a * ${(+amp).toFixed(3)};`); };
  m.customProgramCacheKey = () => 'esc_viento_' + k; return (_MAT[k] = m); }
const mat = k => _MAT[k] || (_MAT[k] = k === 'solido' ? new THREE.MeshLambertMaterial({vertexColors: true}) : k === 'doble' ? new THREE.MeshLambertMaterial({vertexColors: true, side: THREE.DoubleSide})
  : k === 'agua' ? new THREE.MeshLambertMaterial({color: C.agua, transparent: true, opacity: 0.82, depthWrite: false}) : k === 'alambre' ? new THREE.MeshLambertMaterial({color: C.alambre, side: THREE.DoubleSide})
  : new THREE.MeshLambertMaterial({vertexColors: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2}));   // 'calco': manchas sobre el suelo

/* ===================================================================================== */
/* ÁRBOLES: 10 especies nuevas con las cuatro estaciones (formato de vegetacion3d.crearArbol; medidas en metros) */
const PAL = {   // follaje [primavera, verano, otoño, invierno]; tronco; caduco; flor (primavera) y fruto (fin de verano / otoño)
  castano: {hoja: [0x6a8a34, 0x42602a, 0xa8782a, 0x5a4a3a], tronco: 0x4a3c30, caduco: 1},
  tilo: {hoja: [0x7a9a3c, 0x4e6e2e, 0xc8a83a, 0x5a4a3a], tronco: 0x5a5048, caduco: 1},
  arce: {hoja: [0x6a8e36, 0x4a6a2c, 0xb8442a, 0x5a4a3a], tronco: 0x6a5e52, caduco: 1},
  sauce: {hoja: [0x9aae5a, 0x7a9a48, 0xc0aa4a, 0x8a7a3a], tronco: 0x5a5244, caduco: 1},
  abeto: {hoja: [0x24402e, 0x22402c, 0x223e2c, 0x203a2c], tronco: 0x5a4636},
  alerce: {hoja: [0x8aa84a, 0x5a7a36, 0xd0a030, 0x6a5a48], tronco: 0x6a4a36, caduco: 1},
  cipres: {hoja: [0x2a4a2c, 0x284628, 0x284428, 0x264226], tronco: 0x5a4a3a},
  alcornoque: {hoja: [0x5a6e3a, 0x50663a, 0x4e6236, 0x4c6034], tronco: 0x4a3a30, corcho: 0xa8542a},
  manzano: {hoja: [0x7a9a42, 0x4e6e30, 0x9a8a3a, 0x5a4a3a], tronco: 0x5a4838, caduco: 1, flor: 0xf2e6ea, fruto: 0xb8302a},
  cerezo: {hoja: [0x7a8a40, 0x4a6a2e, 0xb85a2a, 0x5a4a3a], tronco: 0x4a3434, caduco: 1, flor: 0xf0b8cc}};
const ESPECIES = Object.keys(PAL);
const ESTACION = {primavera: 0, verano: 1, otono: 2, 'otoño': 2, invierno: 3};
const MEZCLA = {templado: {castano: 2, tilo: 2, arce: 2, sauce: 1, manzano: 1}, mediterraneo: {alcornoque: 4, cipres: 3, castano: 1}, boreal: {abeto: 4, alerce: 3}, estepa: {alerce: 2, tilo: 1, sauce: 1},
  nevado: {abeto: 5, alerce: 2}, japones: {cerezo: 3, arce: 2, abeto: 1}, desierto: {cipres: 1}};
function crearArbol(esp, op) {
  op = op || {}; const P = PAL[esp]; if (!P) throw new Error('escenario3d.crearArbol: especie desconocida ' + esp);
  const est = ESTACION[op.estacion || 'verano'] != null ? ESTACION[op.estacion || 'verano'] : 1, r = rng(op.semilla || 7), nieve = !!op.nieve, desnudo = P.caduco && est === 3, hoja = P.hoja[est];
  const L0 = new Geo(), L1 = new Geo(); let alto, rc, rt;
  const bal = (y0, y1) => q => clamp((q[1] - y0) / Math.max(0.1, y1 - y0), 0, 1) * 0.9 + 0.1;
  const tronco = (G, h, r0, r1, n, col) => G.cil(0, -0.3, 0, r0, r1, h + 0.3, n, col || P.tronco);
  // rama desde (0, y0, 0) con rumbo a e inclinación inc (0 = horizontal, + hacia arriba); devuelve la punta; sub = ramillas (invierno)
  const rama = (G, y0, a, inc, len, rad, sub) => { const b = [Math.cos(a) * Math.cos(inc) * len, y0 + Math.sin(inc) * len, Math.sin(a) * Math.cos(inc) * len]; G.entre([0, y0, 0], b, rad, rad * 0.4, 5, P.tronco, [0.05, 0.4]);
    if (sub) for (let k = 0; k < sub; k++) { const t = 0.45 + k / sub * 0.5, p = [b[0] * t, y0 + (b[1] - y0) * t, b[2] * t], aa = a + (r() - 0.5) * 2.2, ii = inc + 0.3 + r() * 0.5, l2 = len * (0.35 + r() * 0.2);
      G.entre(p, [p[0] + Math.cos(aa) * Math.cos(ii) * l2, p[1] + Math.sin(ii) * l2, p[2] + Math.sin(aa) * Math.cos(ii) * l2], rad * 0.35, 0.01, 3, P.tronco, [0.4, 0.8]); }
    return b; };
  // copa: mata de hojas; si desnudo, ramaje fino oscuro (mata translúcida falsa: más pequeña y oscura) y nieve en invierno
  const copa = (G, x, y, z, rr, det, ap, s, y0, y1) => {
    if (desnudo) { if (G === L1) G.mata(x, y, z, rr * 0.8, 0, 0x5a4c40, s, ap, 0.6); else if (nieve) G.mata(x, y + rr * 0.25 * (ap || 1), z, rr * 0.55, 0, 0xe8ecf0, s + 9, 0.35, 0.5); return; }
    G.mata(x, y, z, rr, det, hoja, s, ap, bal(y0, y1));
    if (G === L0 && est === 0 && P.flor) for (let k = 0; k < 5; k++) { const a = r() * 6.28, e = (r() - 0.3) * 1.2; G.mata(x + Math.cos(a) * rr * 0.8, y + e * rr * (ap || 1) * 0.7, z + Math.sin(a) * rr * 0.8, rr * 0.28, 0, P.flor, s + k + 20, 1, 0.8); }
    if (G === L0 && est >= 1 && est <= 2 && P.fruto) for (let k = 0; k < 6; k++) { const a = r() * 6.28; G.caja(x + Math.cos(a) * rr * 0.92, y - rr * 0.2 + r() * rr * 0.5, z + Math.sin(a) * rr * 0.92, 0.12, 0.12, 0.12, P.fruto, {bal: 0.8}); }
    if (nieve) G.mata(x, y + rr * 0.45 * (ap || 1), z, rr * 0.7, 0, 0xeef2f6, s + 7, 0.3, 0.6); };
  switch (esp) {
    case 'castano': { alto = 16 + r() * 5; rt = 0.55; const ht = 3.2; tronco(L0, ht + 1.5, rt, rt * 0.7, 9); tronco(L1, ht + 1.5, rt, rt * 0.7, 4); rc = 6;
      for (let k = 0; k < 5; k++) rama(L0, ht, k * 1.26 + r() * 0.5, 0.35 + r() * 0.3, 4.6, 0.24, desnudo ? 4 : 0);
      for (let k = 0; k < 8; k++) { const a = k * 0.8 + r(), d = k ? 3 + r() * 1.6 : 0; copa(L0, Math.cos(a) * d, ht + 5 + r() * 3 + (k ? 0 : 2), Math.sin(a) * d, 2.8 + r() * 0.9, 1, 0.85, k + 3, ht, alto); }
      copa(L1, 0, ht + 6.5, 0, 6.2, 0, 0.8, 9, ht, alto); break; }
    case 'tilo': { alto = 20 + r() * 6; rt = 0.45; const ht = 4; tronco(L0, alto * 0.6, rt, 0.2, 8); tronco(L1, alto * 0.5, rt, 0.2, 4); rc = 5;
      for (let k = 0; k < 6; k++) rama(L0, ht + k * 1.4, k * 2.4, 0.5, 3.4, 0.18, desnudo ? 3 : 0);
      for (let k = 0; k < 8; k++) { const a = k * 1.1 + r(), t = k / 7, d = (k ? 2.6 : 0) * Math.sin(Math.PI * (0.25 + t * 0.7)); copa(L0, Math.cos(a) * d, ht + 3 + t * (alto - ht - 5), Math.sin(a) * d, 2.9 - t * 0.9 + r() * 0.5, 1, 1.05, k + 61, ht, alto); }
      copa(L1, 0, alto * 0.6, 0, 5, 0, 1.6, 67, ht, alto); break; }
    case 'arce': { alto = 14 + r() * 4; rt = 0.4; const ht = 3; tronco(L0, ht + 2, rt, rt * 0.6, 8); tronco(L1, ht + 2, rt, rt * 0.6, 4); rc = 5.2;
      for (let k = 0; k < 5; k++) rama(L0, ht + k * 0.6, k * 1.3 + r(), 0.6 + r() * 0.3, 3.8, 0.17, desnudo ? 4 : 0);
      for (let k = 0; k < 7; k++) { const a = k * 0.95 + r(), d = k ? 2.6 + r() * 1.2 : 0; copa(L0, Math.cos(a) * d, ht + 4.5 + r() * 2.5 + (k ? 0 : 1.5), Math.sin(a) * d, 2.6 + r() * 0.7, 1, 0.95, k + 71, ht, alto); }
      copa(L1, 0, ht + 5.5, 0, 5.3, 0, 0.95, 77, ht, alto); break; }
    case 'sauce': { alto = 11 + r() * 3; rt = 0.5; const ht = 2.4; tronco(L0, ht + 1.5, rt, rt * 0.75, 8); tronco(L1, ht + 1.5, rt, rt * 0.75, 4); rc = 5.5;
      for (let k = 0; k < 6; k++) rama(L0, ht + 0.8, k * 1.05 + r() * 0.4, 0.7, 4.2, 0.2, desnudo ? 3 : 0);
      // copa colgante: matas alargadas que caen desde las puntas hasta cerca del suelo
      for (let k = 0; k < 11; k++) { const a = k * 0.57 + r() * 0.3, d = k < 3 ? 1.2 : 3.2 + r() * 1.6, yy = k < 3 ? alto - 2.5 : alto * 0.55 - r() * 1.5;
        if (desnudo) { if (k >= 3) L0.entre([Math.cos(a) * d, alto * 0.85, Math.sin(a) * d], [Math.cos(a) * (d + 0.6), 1.5 + r(), Math.sin(a) * (d + 0.6)], 0.03, 0.01, 3, 0xa89a50, [0.4, 1]); continue; }
        L0.mata(Math.cos(a) * d, yy, Math.sin(a) * d, 1.6 + r() * 0.5, 1, hoja, k + 81, k < 3 ? 1 : 2.6, q => clamp((alto - q[1]) / alto, 0, 1) * 0.9 + 0.2, 0.75); }
      if (!desnudo) L1.mata(0, alto * 0.5, 0, 5.4, 0, hoja, 87, 1.15, 0.7); else L1.mata(0, alto * 0.6, 0, 4.4, 0, 0x8a7a48, 87, 1.1, 0.6); break; }
    case 'abeto': { alto = 22 + r() * 8; rt = 0.4; tronco(L0, alto * 0.97, rt, 0.06, 7); tronco(L1, alto * 0.5, rt, 0.1, 4); rc = 3.6;
      const pisos = 9; for (let k = 0; k < pisos; k++) { const t = k / pisos, y = alto * (0.15 + t * 0.78), rr = rc * (1 - t * 0.88) + 0.3;
        L0.cil(0, y, 0, rr, 0.05, alto * 0.13, 9, hoja, {bal: 0.5 + t * 0.4}); L0.cil(0, y, 0, rr * 0.98, rr * 0.2, 0.01, 9, 0x1c3024, {bal: 0.5});   // piso y su envés oscuro
        if (nieve) L0.cil(0, y + alto * 0.045, 0, rr * 0.78, 0.05, alto * 0.06, 9, 0xeef2f6, {bal: 0.5}); }
      L1.cil(0, alto * 0.14, 0, rc, 0.05, alto * 0.86, 6, hoja, {bal: 0.6}); if (nieve) L1.cil(0, alto * 0.5, 0, rc * 0.5, 0.05, alto * 0.45, 6, 0xeef2f6, {bal: 0.6}); break; }
    case 'alerce': { alto = 20 + r() * 6; rt = 0.38; tronco(L0, alto * 0.95, rt, 0.06, 7); tronco(L1, alto * 0.55, rt, 0.1, 4); rc = 3.4;
      const pisos = 7; for (let k = 0; k < pisos; k++) { const t = k / pisos, y = alto * (0.2 + t * 0.72), rr = rc * (1 - t * 0.8) + 0.2;
        for (let j = 0; j < 4; j++) { const a = j * 1.57 + k * 0.6; rama(L0, y, a, -0.25, rr, 0.06, desnudo ? 2 : 0); }
        if (!desnudo) L0.cil(0, y - 0.3, 0, rr, 0.1, alto * 0.11, 8, hoja, {bal: 0.5 + t * 0.4}); }
      if (!desnudo) L1.cil(0, alto * 0.2, 0, rc, 0.05, alto * 0.78, 6, hoja, {bal: 0.6}); else L1.cil(0, alto * 0.2, 0, rc * 0.8, 0.05, alto * 0.78, 5, 0x6a5a48, {bal: 0.5}); break; }
    case 'cipres': { alto = 14 + r() * 6; rt = 0.3; tronco(L0, 2, rt, rt * 0.8, 6); tronco(L1, 2, rt, rt * 0.8, 3); rc = 1.5;
      for (let k = 0; k < 6; k++) { const t = k / 5, y = 1.5 + t * (alto - 3.5); L0.mata((r() - 0.5) * 0.3, y + 1.2, (r() - 0.5) * 0.3, rc * (1.05 - t * 0.55), 1, hoja, k + 91, 1.9, 0.3 + t * 0.6); }
      L1.mata(0, alto * 0.5, 0, rc, 0, hoja, 97, alto * 0.42 / rc, 0.6); break; }
    case 'alcornoque': { alto = 9 + r() * 3; rt = 0.55; const ht = 2.4; tronco(L0, ht + 0.8, rt, rt * 0.8, 8, P.tronco); L0.cil(0, 0, 0, rt + 0.02, rt * 0.92, ht * 0.75, 8, P.corcho); tronco(L1, ht + 0.8, rt, rt * 0.8, 4); rc = 5.5;
      for (let k = 0; k < 4; k++) rama(L0, ht, k * 1.57 + r() * 0.5, 0.3 + r() * 0.2, 3.6, 0.22, 0);
      for (let k = 0; k < 7; k++) { const a = k * 0.9 + r(), d = k ? 3 + r() * 1.3 : 0; copa(L0, Math.cos(a) * d, ht + 3.2 + r() * 1.5, Math.sin(a) * d, 2.4 + r() * 0.6, 1, 0.7, k + 101, ht, alto); }
      copa(L1, 0, ht + 3.6, 0, 5.4, 0, 0.6, 107, ht, alto); break; }
    case 'manzano': case 'cerezo': { const cer = esp === 'cerezo'; alto = (cer ? 7 : 5.5) + r() * 2; rt = 0.22; const ht = cer ? 1.8 : 1.3; tronco(L0, ht + 0.4, rt, rt * 0.8, 7); tronco(L1, ht + 0.4, rt, rt * 0.8, 4); rc = cer ? 4 : 3.2;
      for (let k = 0; k < 4; k++) rama(L0, ht, k * 1.57 + r() * 0.6, cer ? 0.35 : 0.55, rc * 0.85, 0.1, desnudo ? 4 : 1);
      for (let k = 0; k < 6; k++) { const a = k * 1.05 + r(), d = k ? rc * 0.55 + r() * 0.5 : 0; copa(L0, Math.cos(a) * d, ht + 1.8 + r() * 1.2, Math.sin(a) * d, 1.5 + r() * 0.5, 1, cer ? 0.65 : 0.85, k + 111, ht, alto); }
      if (!desnudo && est === 0 && P.flor) L1.mata(0, ht + 2.2, 0, rc, 0, cer ? P.flor : 0xd8e0c8, 117, cer ? 0.6 : 0.8, 0.6); else copa(L1, 0, ht + 2.2, 0, rc, 0, cer ? 0.6 : 0.8, 117, ht, alto); break; }
  }
  return {especie: esp, lod0: L0.geometria(), lod1: L1.geometria(), alto, radioCopa: rc, radioTronco: rt, colorHoja: desnudo ? 0x5a4c40 : hoja, estacion: ['primavera', 'verano', 'otono', 'invierno'][est], nieve,
    tris: [L0.tris(), L1.tris()]};
}
// cualquier especie: las de este módulo o, si no, las de vegetacion3d (roble, haya, pino, abedul, álamo, olivo)
function arbol(esp, op) { if (PAL[esp]) return crearArbol(esp, op); if (root.vegetacion3d) return root.vegetacion3d.crearArbol(esp, op); throw new Error('especie desconocida ' + esp); }
const _ARB = new Map();
function arbolCache(esp, est, nieve, semilla) { const k = esp + '|' + est + '|' + (nieve ? 1 : 0) + '|' + (semilla % 3); if (!_ARB.has(k)) { const t = arbol(esp, {estacion: est, nieve, semilla: 7 + semilla % 3}), n = g => (g.index ? g.index.count : g.attributes.position.count) / 3;
    if (!t.tris) t.tris = [n(t.lod0), n(t.lod1)]; _ARB.set(k, t); } return _ARB.get(k); }

/* ===================================================================================== */
/* PIEZAS: cada elemento del escenario es una pieza con 3 niveles de detalle (geometrías fusionadas por material + instancias).
   Los constructores trabajan en coordenadas del MUNDO (u); las medidas reales se escriben en metros × MU. */
const CAPAS = ['solido', 'doble', 'viento', 'marana', 'calco'];
function Pieza(E, tipo, cx, cz) { this.E = E; this.tipo = tipo; this.cx = cx; this.cz = cz;
  this.L = [0, 1, 2].map(() => { const o = {inst: {}}; CAPAS.forEach(k => { o[k] = new Geo(); o[k].m.makeTranslation(-cx, 0, -cz); }); return o; }); }
// pon(niveles, instancia, x, y, z, giro y, escala, giro x, giro z): las geometrías de instancia van en metros (la escala MU va en la matriz)
const _pm = new THREE.Matrix4(), _pq = new THREE.Quaternion(), _pe = new THREE.Euler(), _pv = new THREE.Vector3(), _ps = new THREE.Vector3();
Pieza.prototype.pon = function (lods, nombre, x, y, z, ry, s, rx, rz, sy) {
  _pe.set(rx || 0, ry || 0, rz || 0, 'YXZ'); _pq.setFromEuler(_pe); _pv.set(x - this.cx, y, z - this.cz); const k = (s || 1) * MU; _ps.set(k, k * (sy || 1), k); _pm.compose(_pv, _pq, _ps);
  lods.forEach(l => { (this.L[l].inst[nombre] = this.L[l].inst[nombre] || []).push(_pm.clone()); }); };
Pieza.prototype.tris = function (l) { const L = this.L[l]; return CAPAS.reduce((a, k) => a + L[k].tris(), 0) + Object.keys(L.inst).reduce((a, k) => a + L.inst[k].length * INST()[k].tris, 0); };
const M = MU;   // atajo: metros → u
// ayudas de geometría de polilíneas (mundo, u)
function recorrer(P, paso, fn) {   // fn(x, z, ux, uz, s, i) cada «paso» u a lo largo de la polilínea
  let s0 = 0; for (let i = 0; i < P.length - 1; i++) { const [ax, az] = P[i], [bx, bz] = P[i + 1], L = Math.hypot(bx - ax, bz - az); if (L < 1e-6) continue; const ux = (bx - ax) / L, uz = (bz - az) / L;
    let t = i === 0 ? 0 : (paso - (s0 % paso)) % paso; for (; t < L - 1e-6; t += paso) fn(ax + ux * t, az + uz * t, ux, uz, s0 + t, i); s0 += L; }
  if (P.length > 1) { const [ax, az] = P[P.length - 2], [bx, bz] = P[P.length - 1], L = Math.hypot(bx - ax, bz - az) || 1; return s0; } return 0; }
const largo = P => { let s = 0; for (let i = 0; i < P.length - 1; i++) s += Math.hypot(P[i + 1][0] - P[i][0], P[i + 1][1] - P[i][1]); return s; };
function enS(P, s) { for (let i = 0; i < P.length - 1; i++) { const [ax, az] = P[i], [bx, bz] = P[i + 1], L = Math.hypot(bx - ax, bz - az); if (s <= L || i === P.length - 2) { const t = clamp(s / (L || 1), 0, 1); return [ax + (bx - ax) * t, az + (bz - az) * t, (bx - ax) / (L || 1), (bz - az) / (L || 1)]; } s -= L; } return [P[0][0], P[0][1], 1, 0]; }
const centroDe = P => { let x = 0, z = 0; P.forEach(p => { x += p[0]; z += p[1]; }); return [x / P.length, z / P.length]; };
// huecos: [[s0, s1]…] en u a lo largo; n = número de huecos aleatorios de ancho w (u)
function huecosDe(def, L, r, wDef) { if (Array.isArray(def.huecos)) return def.huecos.map(h => h.slice()); const n = def.huecos | 0, out = [];
  for (let k = 0; k < n; k++) { const w = wDef * (0.8 + r() * 0.5), c = L * (k + 0.5 + (r() - 0.5) * 0.6) / n; out.push([clamp(c - w / 2, 0, L), clamp(c + w / 2, 0, L)]); } return out; }
const enHueco = (H, s) => H.some(([a, b]) => s >= a && s <= b);
// tramos continuos fuera de los huecos (para colisores por tramo)
function tramos(L, H) { const cortes = H.slice().sort((a, b) => a[0] - b[0]), out = []; let s = 0; cortes.forEach(([a, b]) => { if (a > s) out.push([s, a]); s = Math.max(s, b); }); if (s < L) out.push([s, L]); return out; }

/* ---------- geometrías de instancia (en metros; 1 llamada de dibujo por tipo y nivel) ---------- */
let _INST = null;
function INST() {
  if (_INST) return _INST; const I = {}, def = (k, fn, capa) => { const g = new Geo(); fn(g); I[k] = {geo: g.geometria(), tris: g.tris(), capa: capa || 'solido'}; };
  def('saco', g => { g.caja(0, 0, 0, 0.62, 0.15, 0.36, C.saco, {colTecho: C.sacoO}); g.caja(0, 0.15, 0, 0.56, 0.03, 0.3, C.sacoO); });                                       // saco terrero
  def('piquete', g => { g.cil(0, 0, 0, 0.04, 0.035, 1.5, 4, C.maderaO); });                                                                                                  // poste de alambrada (1,5 m)
  def('piqueteH', g => { g.entre([0, 0, 0], [0, 1.45, 0], 0.025, 0.025, 4, C.oxido); g.entre([0, 1.3, 0], [0.12, 1.42, 0], 0.012, 0.012, 3, C.oxido); });                   // piquete de hierro con ojal
  def('estaquilla', g => { g.cil(0, 0, 0, 0.035, 0.03, 0.45, 4, C.maderaO); });
  def('frisa', g => { g.entre([-2, 0.75, 0], [2, 0.75, 0], 0.13, 0.13, 6, C.maderaO); for (let k = 0; k < 6; k++) { const x = -1.6 + k * 0.64, a = k % 2 ? 0.8 : -0.8;
      g.entre([x, 0.75 - Math.sin(a) * 1.15, -Math.cos(a) * 1.15], [x, 0.75 + Math.sin(a) * 1.15, Math.cos(a) * 1.15], 0.045, 0.01, 4, C.madera); } });                 // caballo de frisa (4 m)
  def('frisa1', g => { g.entre([-2, 0.75, 0], [2, 0.75, 0], 0.13, 0.13, 4, C.maderaO); [-1.1, 0.4].forEach(x => { g.quad2([x, 0, -0.8], [x + 0.7, 0, -0.8], [x + 0.7, 1.5, 0.8], [x, 1.5, 0.8], C.madera); g.quad2([x, 0, 0.8], [x + 0.7, 0, 0.8], [x + 0.7, 1.5, -0.8], [x, 1.5, -0.8], C.madera); }); });
  def('gavion', g => { g.cil(0, 0, 0, 0.33, 0.33, 0.85, 9, C.zarzo, {tapa: true, colTapa: C.tierra}); for (let y = 0.12; y < 0.85; y += 0.2) g.cil(0, y, 0, 0.335, 0.335, 0.03, 9, 0x5a4a30); });     // cestón de mimbre lleno de tierra
  def('gavion1', g => { g.cil(0, 0, 0, 0.33, 0.33, 0.85, 5, C.zarzo, {tapa: true, colTapa: C.tierra}); });
  def('fajina', g => { g.entre([-1.4, 0, 0], [1.4, 0, 0], 0.12, 0.12, 5, 0x7a6640); });
  def('estaca', g => { g.cil(0, 0, 0, 0.12, 0.11, 2.6, 6, C.madera); g.cil(0, 2.6, 0, 0.11, 0, 0.4, 6, C.maderaC); });                                                    // tronco de empalizada aguzado
  def('estaca1', g => { g.cil(0, 0, 0, 0.12, 0, 3.0, 3, C.madera); });
  def('terron', g => { g.mata(0, 0.1, 0, 0.28, 0, C.tierraO, 5, 0.55, 0); });
  def('astilla', g => { g.caja(0, 0, 0, 0.9, 0.08, 0.12, C.maderaC, {ry: 0.3}); g.caja(0.2, 0.05, 0.1, 0.5, 0.06, 0.08, C.madera, {ry: -0.7}); });
  // cultivos (viento): espigas de trigo, rastrojo, gavilla, maíz, vid, patata, pradera
  // espiga: tallos como cintas (1 quad) y espiga como un rombo; material de doble cara
  const espiga = (g, col, colE, alto, n, s) => { const rr = rng(s); for (let k = 0; k < n; k++) { const a = k / n * 6.28 + rr(), d = 0.03 + rr() * 0.08, x = Math.cos(a) * d, z = Math.sin(a) * d, h = alto * (0.85 + rr() * 0.3), lx = (rr() - 0.5) * 0.14, lz = (rr() - 0.5) * 0.14, ox = -Math.sin(a) * 0.006, oz = Math.cos(a) * 0.006;
      g.quad([x - ox, 0, z - oz], [x + ox, 0, z + oz], [x + lx + ox, h, z + lz + oz], [x + lx - ox, h, z + lz - oz], col, 0); for (let q = g.b.length - 3; q < g.b.length; q++) g.b[q] = 0.8; g.b[g.b.length - 4] = 0.8;
      if (colE) { const t = [x + lx, h, z + lz], e = 0.018; g.quad([t[0] - ox * 3, t[1] + 0.01, t[2] - oz * 3], [t[0], t[1] - 0.01, t[2]], [t[0] + ox * 3, t[1] + 0.01, t[2] + oz * 3], [t[0] + lx * 0.1, t[1] + 0.1, t[2] + lz * 0.1], colE, 1); void e; } } };
  def('trigo', g => espiga(g, 0xb8a050, 0xd8b860, 0.95, 7, 3), 'viento'); def('trigoV', g => espiga(g, 0x6a8a3a, 0x7a9a46, 0.8, 7, 3), 'viento'); def('trigoP', g => espiga(g, 0x7a9a40, null, 0.35, 7, 3), 'viento');
  def('trigo1', g => { g.quad2([-0.3, 0, 0], [0.3, 0, 0], [0.3, 0.95, 0], [-0.3, 0.95, 0], 0xc8aa58, 0.6); g.quad2([0, 0, -0.3], [0, 0, 0.3], [0, 0.95, 0.3], [0, 0.95, -0.3], 0xb89a50, 0.6); }, 'viento');
  def('rastrojo', g => espiga(g, C.rastrojo, null, 0.15, 6, 5));
  def('gavilla', g => { g.cil(0, 0, 0, 0.22, 0.12, 0.6, 6, C.paja); g.cil(0, 0.6, 0, 0.12, 0.25, 0.4, 6, 0xd8c070, {tapa: true}); g.cil(0, 0.5, 0, 0.13, 0.13, 0.06, 6, 0x8a7040); });
  const maiz = (g, verde, seco) => { const col = seco ? 0xb8a060 : verde; g.entre([0, 0, 0], [0.04, 2.3, 0], 0.025, 0.012, 3, col, [0, 0.8]);
    for (let k = 0; k < 5; k++) { const y = 0.5 + k * 0.34, a = k * 2.4, ex = Math.cos(a), ez = Math.sin(a), L = 0.75 - k * 0.06;
      g.quad([0, y, 0], [ex * L * 0.5 - ez * 0.05, y + 0.18, ez * L * 0.5 + ex * 0.05], [ex * L, y - 0.05, ez * L], [ex * L * 0.5 + ez * 0.05, y + 0.12, ez * L * 0.5 - ex * 0.05], col, 0.3 + k * 0.1); }
    if (!seco) g.entre([0.03, 1.1, 0], [0.14, 1.4, 0.03], 0.04, 0.02, 3, 0xc8b870, [0.4, 0.5]);
    g.entre([0.04, 2.3, 0], [0.05, 2.55, 0], 0.01, 0.004, 3, 0xc8a860, [0.8, 1]); };
  def('maiz', g => maiz(g, 0x4e7a2e), 'viento'); def('maizS', g => maiz(g, 0, true), 'viento');
  def('maiz1', g => { g.quad2([-0.35, 0, 0], [0.35, 0, 0], [0.25, 2.3, 0], [-0.25, 2.3, 0], 0x4a7230, 0.6); g.quad2([0, 0, -0.35], [0, 0, 0.35], [0, 2.3, 0.25], [0, 2.3, -0.25], 0x426a2c, 0.6); }, 'viento');
  const vid = (g, hojas) => { g.entre([0, 0, 0], [0.05, 0.9, 0], 0.05, 0.04, 4, 0x5a4232); g.entre([0.05, 0.9, 0], [-0.55, 1.05, 0], 0.025, 0.02, 3, 0x5a4232, [0, 0.3]); g.entre([0.05, 0.9, 0], [0.6, 1.05, 0], 0.025, 0.02, 3, 0x5a4232, [0, 0.3]);
    if (hojas) [-0.32, 0.36].forEach((x, k) => g.mata(x, 1.15 + k * 0.1, 0, 0.4, 0, hojas, k + 4, 0.8, 0.5, 1.0)); };
  def('vid', g => vid(g, 0x4e6e2e), 'viento'); def('vidO', g => vid(g, 0xa8702a), 'viento'); def('vidD', g => vid(g, null), 'viento'); def('vidP', g => vid(g, 0x7a9a3c), 'viento');
  def('uva', g => { [-0.3, 0.2].forEach(x => g.caja(x, 0.85, 0.12, 0.1, 0.16, 0.1, 0x3a2440, {bal: 0.4})); }, 'viento');
  def('patata', g => { g.mata(0, 0.14, 0, 0.32, 0, 0x4e6e30, 11, 0.65, 0.4, 1.0); }, 'viento');
  def('patataS', g => { g.mata(0, 0.08, 0, 0.26, 0, 0x7a6a3a, 11, 0.45, 0.3); }, 'viento');
  def('pasto', g => { const rr = rng(9); for (let k = 0; k < 7; k++) { const a = k * 0.9 + rr(), x = Math.cos(a) * 0.08, z = Math.sin(a) * 0.08, h = 0.35 + rr() * 0.25, lx = Math.cos(a) * 0.15, lz = Math.sin(a) * 0.15;
      g.tri([x - 0.02, 0, z], [x + 0.02, 0, z], [x + lx, h, z + lz], 0x6a8a3a, 0); g.tri([x + 0.02, 0, z], [x - 0.02, 0, z], [x + lx, h, z + lz], 0x5a7a34, 0); } for (let k = 0; k < 7; k++) g.b[g.b.length - 1 - k * 3] = 0.9; }, 'viento');
  def('flor', g => { g.entre([0, 0, 0], [0.02, 0.45, 0], 0.006, 0.005, 3, 0x5a7a34, [0, 0.8]); g.mata(0.02, 0.47, 0, 0.04, 0, 0xe8e0d0, 3, 0.6, 1.0); }, 'viento');
  def('amapola', g => { g.entre([0, 0, 0], [0.02, 0.5, 0], 0.006, 0.005, 3, 0x5a7a34, [0, 0.8]); g.mata(0.02, 0.52, 0, 0.045, 0, 0xc8241c, 3, 0.6, 1.0); }, 'viento');
  // restos de batalla
  def('fusil', g => { g.caja(0, 0, 0, 1.45, 0.04, 0.05, 0x5a3a22); g.caja(-0.55, 0, 0, 0.35, 0.09, 0.05, 0x5a3a22); g.caja(0.3, 0.04, 0, 0.95, 0.025, 0.025, C.hierro); });          // fusil caído (mira +x)
  def('mochila', g => { g.caja(0, 0, 0, 0.36, 0.3, 0.16, 0x6a5238, {colTecho: 0x5a4430}); g.entre([-0.18, 0.33, 0], [0.18, 0.33, 0], 0.07, 0.07, 6, 0x8a7a62); });
  def('chaco', g => { g.cil(0, 0, 0, 0.11, 0.12, 0.19, 7, C.negro, {tapa: true}); g.caja(0, 0, 0.1, 0.18, 0.02, 0.08, C.negro); });
  def('kepis', g => { g.cil(0, 0, 0, 0.1, 0.085, 0.12, 7, 0x2a3a6a, {tapa: true, colTapa: 0xa83030}); g.caja(0, 0, 0.09, 0.15, 0.015, 0.07, C.negro); });
  def('pickel', g => { g.cil(0, 0, 0, 0.11, 0.1, 0.12, 7, C.negro); g.mata(0, 0.12, 0, 0.1, 0, C.negro, 2, 0.6, 0); g.cil(0, 0.17, 0, 0.02, 0.0, 0.1, 4, 0xc8a048); });
  def('casco', g => { g.mata(0, 0.0, 0, 0.15, 0, 0x4a5440, 3, 0.65, 0); g.cil(0, 0, 0, 0.17, 0.15, 0.02, 8, 0x4a5440); });
  def('caja', g => { g.caja(0, 0, 0, 0.6, 0.3, 0.35, 0x6a5a3a, {colTecho: 0x7a6a48}); g.caja(0, 0.3, 0, 0.62, 0.03, 0.37, 0x5a4a30); });
  def('tambor', g => { g.cil(0, 0, 0, 0.2, 0.2, 0.32, 9, 0x8a2a24, {tapa: true, colTapa: 0xe0d8c0}); g.cil(0, 0, 0, 0.21, 0.21, 0.04, 9, 0xc8a048); g.cil(0, 0.28, 0, 0.21, 0.21, 0.04, 9, 0xc8a048); });
  def('rueda', g => { const n = 10; for (let i = 0; i < n - 3; i++) { const a0 = i / n * 6.283, a1 = (i + 1) / n * 6.283; g.entre([Math.cos(a0) * 0.65, 0.05, Math.sin(a0) * 0.65], [Math.cos(a1) * 0.65, 0.05, Math.sin(a1) * 0.65], 0.05, 0.05, 4, 0x5a4232); }
    for (let i = 0; i < 7; i++) { const a = i / 12 * 6.283; g.entre([0, 0.05, 0], [Math.cos(a) * 0.6, 0.05, Math.sin(a) * 0.6], 0.025, 0.025, 3, 0x6a5038); } g.cil(0, 0, 0, 0.11, 0.11, 0.12, 6, 0x4a3a2a, {tapa: true}); });
  def('sable', g => { g.caja(0, 0, 0, 0.85, 0.01, 0.03, 0xb8bcc0); g.caja(-0.48, 0, 0, 0.13, 0.03, 0.05, 0xc8a048); });
  def('cartuchera', g => { g.caja(0, 0, 0, 0.22, 0.14, 0.07, 0x26201c); g.caja(0, 0.06, 0.04, 0.6, 0.012, 0.04, 0xe8e2d0, {ry: 0.4}); });
  def('cantimplora', g => { g.cil(0, 0, 0, 0.09, 0.09, 0.05, 8, 0x5a6a5a, {tapa: true}); });
  def('mancha', g => { const n = 11; for (let i = 0; i < n; i++) { const a0 = i / n * 6.283, a1 = (i + 1) / n * 6.283, f = k => 0.22 + 0.2 * h2(k % n, 1, 5) + 0.12 * h2(k % n, 7, 2), r0 = f(i), r1 = f(i + 1); g.tri([0, 0.02, 0], [Math.cos(a1) * r1, 0.02, Math.sin(a1) * r1], [Math.cos(a0) * r0 * 1.4, 0.02, Math.sin(a0) * r0], 0x3a2620); } }, 'calco');
  return (_INST = I); }

/* ===================================================================================== */
/* FORTIFICACIÓN DE CAMPAÑA */
// trinchera: {puntos, ancho (u), prof (u), lado (+1: el enemigo está a la izquierda del sentido de avance, como terreno3d), revestimiento:
//   'tablas'|'zarzo'|'sacos'|'tierra', parapeto (sacos en el borde del lado enemigo), tablones (suelo), banqueta, yaExcavada}
function trinchera(pz, d) {
  const E = pz.E, H = E.H, r = E.r, an = d.ancho || 3.4, pr = d.prof || 3.0, lado = d.lado || 1, rev = d.revestimiento || (E.eraI >= 3 ? 'tablas' : 'zarzo'), P = d.puntos;
  if (E.tf && E.tf.excavarTrinchera && !d.yaExcavada) E.tf.excavarTrinchera(P, an, pr, {parapeto: lado});
  const dw = an / 2 - 0.9, paso = 1.2 * M, Lt = largo(P);
  const G0 = pz.L[0], G1 = pz.L[1], G2 = pz.L[2], colRev = rev === 'tablas' ? C.madera : rev === 'zarzo' ? C.zarzo : C.tierraO;
  let prev = null;
  recorrer(P, paso, (x, z, ux, uz, s) => {
    const nx = -uz, nz = ux, y0 = H(x, z) + 0.03, s1 = Math.min(Lt, s + paso), [x1, z1] = enS(P, s1), y1 = H(x1, z1) + 0.03, rim = sg => Math.max(H(x + nx * sg * (an / 2 + 1.4), z + nz * sg * (an / 2 + 1.4)), y0 + 0.5 * M);
    [-1, 1].forEach(sg => { const ax = x + nx * sg * dw, az = z + nz * sg * dw, bx = x1 + nx * sg * dw, bz = z1 + nz * sg * dw, ya = rim(sg), yb = Math.max(H(x1 + nx * sg * (an / 2 + 1.4), z1 + nz * sg * (an / 2 + 1.4)), y1 + 0.5 * M);
      const Q = (G, col) => sg < 0 ? G.quad([ax, y0 - 0.1, az], [bx, y1 - 0.1, bz], [bx, yb, bz], [ax, ya, az], col) : G.quad([bx, y1 - 0.1, bz], [ax, y0 - 0.1, az], [ax, ya, az], [bx, yb, bz], col);
      if (rev !== 'sacos') Q(G0.solido, colRev); Q(G1.solido, colRev);
      if (rev === 'tablas') for (let y = y0 + 0.28 * M; y < ya - 0.1; y += 0.28 * M) G0.doble.quad(...(sg > 0 ? [[ax - nx * 0.02, y, az - nz * 0.02], [bx - nx * 0.02, y, bz - nz * 0.02], [bx - nx * 0.02, y + 0.03 * M, bz - nz * 0.02], [ax - nx * 0.02, y + 0.03 * M, az - nz * 0.02]]
        : [[bx + nx * 0.02, y, bz + nz * 0.02], [ax + nx * 0.02, y, az + nz * 0.02], [ax + nx * 0.02, y + 0.03 * M, az + nz * 0.02], [bx + nx * 0.02, y + 0.03 * M, bz + nz * 0.02]]), C.maderaO);
      if (rev === 'tablas' || rev === 'zarzo') G0.solido.caja(ax - nx * sg * 0.08 * M, y0 - 0.2, az - nz * sg * 0.08 * M, 0.12 * M, ya - y0 + 0.4, 0.12 * M, C.maderaO);   // pies derechos
      if (rev === 'sacos') for (let y = y0; y < ya - 0.05 * M; y += 0.16 * M) pz.pon([0], 'saco', ax - nx * sg * 0.15 * M, y, az - nz * sg * 0.15 * M, Math.atan2(ux, uz) + Math.PI / 2 + (r() - 0.5) * 0.15);
    });
    // suelo de tablones (enrejado) y banqueta de tiro del lado enemigo
    if (d.tablones !== false) { const ry = Math.atan2(ux, uz);   // enrejado de tablones: dos largueros y travesaños
      [-1, 1].forEach(sg => G0.solido.caja(x + ux * paso / 2 + nx * sg * 0.25 * M, y0, z + uz * paso / 2 + nz * sg * 0.25 * M, 0.08 * M, 0.08 * M, paso * 0.98, C.maderaO, {ry}));
      for (let k = 0; k < 4; k++) { const t = (k + 0.5) / 4 * paso; G0.solido.caja(x + ux * t, y0 + 0.08 * M, z + uz * t, 0.7 * M, 0.03 * M, 0.1 * M, C.maderaC, {ry}); } }
    if (d.banqueta !== false) { const bx = x + nx * lado * (dw - 0.3 * M), bz = z + nz * lado * (dw - 0.3 * M); G0.solido.caja(bx + ux * paso / 2, y0 - 0.05, bz + uz * paso / 2, 0.55 * M, 0.5 * M, paso, C.tierra, {ry: Math.atan2(ux, uz), colTecho: C.maderaC}); G1.solido.caja(bx + ux * paso / 2, y0, bz + uz * paso / 2, 0.55 * M, 0.5 * M, paso, C.tierra, {ry: Math.atan2(ux, uz)}); }
    // parapeto de sacos en el borde enemigo (3 hiladas; el LOD1 es un prisma)
    if (d.parapeto !== false) { const px = x + nx * lado * (an / 2 + 0.9), pzz = z + nz * lado * (an / 2 + 0.9), py = H(px, pzz) - 0.05 * M, ry = Math.atan2(ux, uz) + Math.PI / 2;
      for (let f = 0; f < 3; f++) for (let k = 0; k < 2; k++) { const t = (k + (f % 2) * 0.5) * paso / 2; pz.pon([0], 'saco', px + ux * t - nx * lado * f * 0.06 * M, py + f * 0.15 * M, pzz + uz * t - nz * lado * f * 0.06 * M, ry + (r() - 0.5) * 0.2); }
      G1.solido.caja(px + ux * paso / 2, py, pzz + uz * paso / 2, 0.7 * M, 0.42 * M, paso, C.saco, {ry: Math.atan2(ux, uz)});
      // cobertura y puesto de tiro sobre la banqueta (cada 2,4 m)
      if (Math.round(s / paso) % 2 === 0) { const bx = x + nx * lado * (dw - 0.3 * M), bz = z + nz * lado * (dw - 0.3 * M);
        E.S.cover.push({tipo: 'trinchera', pos: [bx, y0 + 0.5 * M, bz], alto: 'alta', protegeDe: [nx * lado, nz * lado], lados: ['izq', 'der'], capacidad: 1, pieza: pz.id});
        E.S.tiradores.push({tipo: 'banqueta', pos: [bx, y0 + 0.5 * M, bz], dir: [nx * lado, nz * lado], postura: 'pie', pieza: pz.id}); } }
    if (G2) { const mx = x + ux * paso / 2, mz = z + uz * paso / 2; G2.solido.caja(mx, y0, mz, an - 1.2, 0.05, paso, C.tierraO, {ry: Math.atan2(ux, uz), sinTecho: false}); }
  });
  E.S.superficies.push({tipo: 'trinchera', puntos: P.map(p => p.slice()), ancho: an, prof: pr, anchoUtil: dw * 2, lado, revestimiento: rev, pieza: pz.id});
}
// alambrada: {puntos, tipo: 'baja'|'alta'|'concertina', huecos (n o [[s0, s1]] en u), ancho (u)}
function alambrada(pz, d) {
  const E = pz.E, H = E.H, r = E.r, P = d.puntos, tipo = d.tipo || 'alta', Lt = largo(P), HU = huecosDe(d, Lt, r, 3 * M), w = d.ancho || (tipo === 'baja' ? 3 * M : tipo === 'concertina' ? 1 * M : 3.2 * M);
  const G0 = pz.L[0], G1 = pz.L[1], G2 = pz.L[2], hilo = (G, a, b, gr) => { const dx = b[0] - a[0], dz = b[2] - a[2], L = Math.hypot(dx, dz) || 1, ox = -dz / L * (gr || 0.012) * M, oz = dx / L * (gr || 0.012) * M;   // hilo: cinta fina vertical + horizontal
    G.doble.quad([a[0], a[1] - 0.01 * M, a[2]], [b[0], b[1] - 0.01 * M, b[2]], [b[0], b[1] + 0.01 * M, b[2]], [a[0], a[1] + 0.01 * M, a[2]], C.alambre); G.doble.quad([a[0] - ox, a[1], a[2] - oz], [b[0] - ox, b[1], b[2] - oz], [b[0] + ox, b[1], b[2] + oz], [a[0] + ox, a[1], a[2] + oz], C.alambre); };
  const banda = (G, x, z, x1, z1, ux, uz, alto, col) => { const nx = -uz, nz = ux, y = H(x, z), y1 = H(x1, z1);   // maraña lejana: dos planos translúcidos en tejado
    G.marana.quad([x - nx * w / 2, y, z - nz * w / 2], [x1 - nx * w / 2, y1, z1 - nz * w / 2], [x1, y1 + alto, z1], [x, y + alto, z], col); G.marana.quad([x, y + alto, z], [x1, y1 + alto, z1], [x1 + nx * w / 2, y1, z1 + nz * w / 2], [x + nx * w / 2, y, z + nz * w / 2], col); };
  const paso = (tipo === 'baja' ? 2 : 3) * M, altoP = tipo === 'baja' ? 0.45 * M : tipo === 'concertina' ? 0.9 * M : 1.5 * M;
  recorrer(P, paso, (x, z, ux, uz, s) => {
    if (enHueco(HU, s) || enHueco(HU, s + paso)) { if (enHueco(HU, s) && r() < 0.5) pz.pon([0], 'piqueteH', x, H(x, z) - 0.1, z, r() * 6, 1, 1.2 + r() * 0.3, 0); return; }   // en un corte: algún piquete tumbado
    const nx = -uz, nz = ux, s1 = Math.min(Lt, s + paso), [x1, z1] = enS(P, s1), y = H(x, z), y1 = H(x1, z1), hierro = E.eraI >= 3;
    if (tipo === 'alta') { pz.pon([0, 1], hierro ? 'piqueteH' : 'piquete', x, y - 0.05 * M, z, r() * 6);
      [-1, 1].forEach(sg => pz.pon([0], 'estaquilla', x + nx * sg * w / 2, H(x + nx * sg * w / 2, z + nz * sg * w / 2) - 0.1 * M, z + nz * sg * w / 2, r() * 6));
      [0.35, 0.8, 1.3].forEach(hh => hilo(G0, [x, y + hh * M, z], [x1, y1 + hh * M, z1]));
      [-1, 1].forEach(sg => { hilo(G0, [x, y + 1.4 * M, z], [x + nx * sg * w / 2, H(x + nx * sg * w / 2, z + nz * sg * w / 2) + 0.35 * M, z + nz * sg * w / 2]);   // delantales
        [0.45, 0.85].forEach(f => { const o = w / 2 * f, hh = (1.4 - 1.05 * f) * M; hilo(G0, [x + nx * sg * o, H(x + nx * sg * o, z + nz * sg * o) + hh, z + nz * sg * o], [x1 + nx * sg * o, H(x1 + nx * sg * o, z1 + nz * sg * o) + hh, z1 + nz * sg * o]); });
        hilo(G0, [x + nx * sg * w * 0.42, y + 0.7 * M, z + nz * sg * w * 0.42], [x1 + nx * sg * w * 0.08, y1 + 1.2 * M, z1 + nz * sg * w * 0.08]); });   // diagonal (aprox.)
    } else if (tipo === 'baja') { for (let k = -1; k <= 1; k++) { const ox = nx * k * w / 2 + ux * (r() - 0.5) * 0.4 * M, oz = nz * k * w / 2 + uz * (r() - 0.5) * 0.4 * M; pz.pon([0], 'estaquilla', x + ox, H(x + ox, z + oz) - 0.05 * M, z + oz, r() * 6); }
      for (let k = -1; k <= 1; k++) { const o = k * w / 2; hilo(G0, [x + nx * o, y + 0.4 * M, z + nz * o], [x1 + nx * o, y1 + 0.4 * M, z1 + nz * o]); hilo(G0, [x + nx * o, y + 0.4 * M, z + nz * o], [x1 - nx * o, y1 + 0.25 * M, z1 - nz * o]); }
    } else { const R = 0.45 * M, vueltas = 3 * paso / M, n = 7; let q0 = null;   // concertina: espiral de alambre
      for (let i = 0; i <= vueltas * n; i++) { const t = i / (vueltas * n), a = i / n * 6.283, cx = lerp(x, x1, t), cz = lerp(z, z1, t), cy = lerp(y, y1, t) + R, q = [cx + nx * Math.cos(a) * R, cy + Math.sin(a) * R, cz + nz * Math.cos(a) * R];
        if (q0) hilo(G0, q0, q); q0 = q; }
      if (Math.round(s / paso) % 2 === 0) pz.pon([0, 1], 'piqueteH', x, y - 0.05 * M, z, r() * 6, 0.7); }
    banda(G1, x, z, x1, z1, ux, uz, altoP, 0x3a3634); if (Math.round(s / paso) % 2 === 0) { const [x2, z2] = enS(P, Math.min(Lt, s + paso * 2)); banda(G2, x, z, x2, z2, ux, uz, altoP, 0x3a3634); }
  });
  tramos(Lt, HU).forEach(([a, b]) => { const [ax, az] = enS(P, a), [bx, bz] = enS(P, b); E.S.colliders.push({tipo: 'segmento', a: [ax, az], b: [bx, bz], alto: altoP, grosor: w, blando: true, frena: tipo === 'baja' ? 0.25 : 0.12, cortable: true, salto: false, pieza: pz.id, elemento: 'alambrada'}); });
  HU.forEach(([a, b]) => { const [x, z, ux, uz] = enS(P, (a + b) / 2); E.S.brechas.push({tipo: 'alambrada', centro: [x, H(x, z), z], ancho: b - a, dir: [-uz, ux], pieza: pz.id}); });
}
// caballos de frisa: {puntos} (en fila, uno cada 4,2 m) o {pos, rot}
function frisa(pz, d) {
  const E = pz.E, H = E.H, r = E.r, pon = (x, z, ry) => { const y = H(x, z); pz.pon([0], 'frisa', x, y, z, ry + (r() - 0.5) * 0.08); pz.pon([1], 'frisa1', x, y, z, ry);
    if (pz.L[2]) pz.L[2].solido.caja(x, y + 0.6 * M, z, 4 * M, 0.3 * M, 0.3 * M, C.maderaO, {ry});
    E.S.colliders.push({tipo: 'caja', centro: [x, z], ancho: 4 * M, fondo: 2 * M, rot: ry, alto: 1.5 * M, base: y, blando: false, salto: false, frena: 0, pieza: pz.id, elemento: 'frisa'}); };
  if (d.puntos) recorrer(d.puntos, 4.2 * M, (x, z, ux, uz) => pon(x + ux * 2.1 * M, z + uz * 2.1 * M, Math.atan2(-uz, ux))); else pon(d.pos[0], d.pos[1], d.rot || 0);
}
// abatis: árboles talados con las copas (ramas aguzadas) hacia el enemigo. {puntos, lado (+1 izquierda del avance), profundidad (u)}
function abatis(pz, d) {
  const E = pz.E, H = E.H, r = E.r, P = d.puntos, lado = d.lado || 1, prof = d.profundidad || 6 * M, Lt = largo(P), G0 = pz.L[0], G1 = pz.L[1], G2 = pz.L[2], seco = 0x6a5232;
  recorrer(P, 2.2 * M, (x, z, ux, uz, s) => { const nx = -uz * lado, nz = ux * lado, a = (r() - 0.5) * 0.6, dx = nx * Math.cos(a) - ux * Math.sin(a), dz = nz * Math.cos(a) - uz * Math.sin(a), L = prof * (0.7 + r() * 0.4);
    const p0 = [x, H(x, z) + 0.25 * M, z], p1 = [x + dx * L, H(x + dx * L, z + dz * L) + 0.6 * M, z + dz * L];
    G0.solido.entre(p0, p1, 0.18 * M, 0.08 * M, 6, C.maderaO); G1.solido.entre(p0, p1, 0.18 * M, 0.08 * M, 3, C.maderaO);
    for (let k = 0; k < 7; k++) { const t = 0.35 + k / 7 * 0.6, b = [lerp(p0[0], p1[0], t), lerp(p0[1], p1[1], t), lerp(p0[2], p1[2], t)], aa = (k % 2 ? 1 : -1) * (0.5 + r() * 0.6), ex = dx * Math.cos(aa) - dz * Math.sin(aa), ez = dz * Math.cos(aa) + dx * Math.sin(aa), l2 = (1.2 + r() * 1.6) * M, up = (r() - 0.2) * 1.2 * M;
      const q = [b[0] + ex * l2, b[1] + up, b[2] + ez * l2]; G0.solido.entre(b, q, 0.06 * M, 0.008 * M, 4, C.madera); if (k % 3 === 0) G1.solido.entre(b, q, 0.06 * M, 0.01, 3, C.madera);
      if (k % 2 === 0 && E.eraI < 4) G0.viento.mata(q[0], q[1], q[2], 0.45 * M, 0, seco, k + s | 0, 0.7, 0.4); }
    if (G2 && Math.round(s / (2.2 * M)) % 2 === 0) G2.solido.entre(p0, p1, 0.4 * M, 0.3 * M, 3, 0x5a4632); });
  for (let i = 0; i < P.length - 1; i++) { const [ax, az] = P[i], [bx, bz] = P[i + 1], L = Math.hypot(bx - ax, bz - az) || 1, nx = -(bz - az) / L * lado, nz = (bx - ax) / L * lado, o = prof * 0.45;
    E.S.colliders.push({tipo: 'segmento', a: [ax + nx * o, az + nz * o], b: [bx + nx * o, bz + nz * o], alto: 1.4 * M, grosor: prof * 0.9, blando: true, frena: 0.2, cortable: true, salto: false, pieza: pz.id, elemento: 'abatis'}); }
  recorrer(P, 3 * M, (x, z, ux, uz) => E.S.cover.push({tipo: 'abatis', pos: [x - uz * lado * -0.8 * M, H(x, z), z + ux * lado * -0.8 * M], alto: 'baja', protegeDe: [-uz * lado, ux * lado], lados: ['izq', 'der'], capacidad: 1, pieza: pz.id, ocultaVista: true}));
}
// gaviones: {puntos, filas (1 o 2: la segunda encima, retranqueada), fajinas, relleno (tierra detrás)}
function gaviones(pz, d) {
  const E = pz.E, H = E.H, r = E.r, P = d.puntos, filas = d.filas || 2, lado = d.lado || 1, dia = 0.66 * M;
  recorrer(P, dia * 0.98, (x, z, ux, uz, s) => { const y = H(x, z) - 0.05 * M, nx = -uz * lado, nz = ux * lado;
    pz.pon([0], 'gavion', x, y, z, r() * 6); pz.pon([1], 'gavion1', x, y, z, 0);
    if (filas > 1) { pz.pon([0], 'gavion', x - nx * 0.25 * M, y + 0.85 * M, z - nz * 0.25 * M, r() * 6); pz.pon([1], 'gavion1', x - nx * 0.25 * M, y + 0.85 * M, z - nz * 0.25 * M, 0); }
    if (d.fajinas !== false && Math.round(s / dia) % 4 === 0) pz.pon([0], 'fajina', x + ux * 1.3 * M - nx * 0.1 * M, y + 0.85 * M * filas + 0.1 * M, z + uz * 1.3 * M - nz * 0.1 * M, Math.atan2(ux, uz) - Math.PI / 2);
    if (d.relleno !== false) { const hb = 0.85 * M * filas; [0, 1].forEach(l => pz.L[l].doble.quad([x + nx * 0.3 * M, y + hb, z + nz * 0.3 * M], [x + nx * 0.3 * M + ux * dia, y + hb, z + nz * 0.3 * M + uz * dia], [x + nx * 3 * M + ux * dia, H(x + nx * 3 * M, z + nz * 3 * M) - 0.1, z + nz * 3 * M + uz * dia], [x + nx * 3 * M, H(x + nx * 3 * M, z + nz * 3 * M) - 0.1, z + nz * 3 * M], C.tierra)); }   // parapeto de tierra delante
    if (pz.L[2]) pz.L[2].solido.caja(x, y, z, dia, 0.85 * M * filas, dia, C.zarzo, {ry: Math.atan2(ux, uz)});
    if (Math.round(s / dia) % 3 === 0) E.S.cover.push({tipo: 'gavion', pos: [x - nx * 0.9 * M, H(x - nx * 0.9 * M, z - nz * 0.9 * M), z - nz * 0.9 * M], alto: filas > 1 ? 'alta' : 'baja', protegeDe: [nx, nz], lados: ['izq', 'der'], capacidad: 1, pieza: pz.id}); });
  for (let i = 0; i < P.length - 1; i++) E.S.colliders.push({tipo: 'segmento', a: P[i].slice(), b: P[i + 1].slice(), alto: 0.85 * M * filas, grosor: dia, blando: false, salto: filas < 2, pieza: pz.id, elemento: 'gaviones'});
}
// empalizada: {puntos, alto (m), aspilleras (cada n m), lado}
function empalizada(pz, d) {
  const E = pz.E, H = E.H, r = E.r, P = d.puntos, alto = d.alto || 3.0, lado = d.lado || 1, esp = 0.24 * M, cada = d.aspilleras === false ? 0 : (d.aspilleras || 2.5) * M;
  recorrer(P, esp, (x, z, ux, uz, s) => { const y = H(x, z) - 0.3 * M, k = alto / 3, nx = -uz * lado, nz = ux * lado, hueco = cada && (s % cada) < esp * 0.99;
    pz.pon([0], 'estaca', x, y, z, r() * 6, 1, (r() - 0.5) * 0.04, (r() - 0.5) * 0.04, k * (0.92 + r() * 0.12) * (hueco ? 0.42 : 1)); if (Math.round(s / esp) % 2 === 0) pz.pon([1], 'estaca1', x, y, z, 0, 1.6, 0, 0, k);
    if (hueco) { pz.pon([0], 'estaca', x, y + alto * 0.62 * M, z, r() * 6, 1, 0, 0, k * 0.3); E.S.loopholes.push({tipo: 'aspillera', pos: [x, y + 1.45 * M, z], dir: [nx, nz], planta: 0, pieza: pz.id, ancho: esp});
      E.S.tiradores.push({tipo: 'aspillera', pos: [x - nx * 0.6 * M, H(x - nx * 0.6 * M, z - nz * 0.6 * M), z - nz * 0.6 * M], dir: [nx, nz], postura: 'pie', pieza: pz.id}); }
    if (Math.round(s / esp) % 10 === 0) { const s1 = Math.min(largo(P), s + esp * 10), [x1, z1] = enS(P, s1); pz.L[0].solido.entre([x - nx * 0.15 * M, y + alto * 0.75 * M, z - nz * 0.15 * M], [x1 - nx * 0.15 * M, H(x1, z1) - 0.3 * M + alto * 0.75 * M, z1 - nz * 0.15 * M], 0.08 * M, 0.08 * M, 4, C.maderaO);
      if (pz.L[2]) pz.L[2].solido.quad([x, y, z], [x1, H(x1, z1) - 0.3 * M, z1], [x1, H(x1, z1) - 0.3 * M + alto * M, z1], [x, y + alto * M, z], C.madera); } });
  for (let i = 0; i < P.length - 1; i++) { const [ax, az] = P[i], [bx, bz] = P[i + 1], L = Math.hypot(bx - ax, bz - az) || 1, nx = -(bz - az) / L * lado, nz = (bx - ax) / L * lado;
    E.S.colliders.push({tipo: 'segmento', a: [ax, az], b: [bx, bz], alto: alto * M, grosor: 0.3 * M, blando: false, salto: false, pieza: pz.id, elemento: 'empalizada'}); }
  recorrer(P, 2.5 * M, (x, z, ux, uz) => { const nx = -uz * lado, nz = ux * lado; E.S.cover.push({tipo: 'empalizada', pos: [x - nx * 0.6 * M, H(x - nx * 0.6 * M, z - nz * 0.6 * M), z - nz * 0.6 * M], alto: 'alta', protegeDe: [nx, nz], lados: ['izq', 'der'], capacidad: 1, pieza: pz.id}); });
}
// cráter: {pos, radio (u), prof (u), yaDeformado}. Deforma el terreno (terreno3d.deformar) y pone el borde de tierra removida y terrones
function crater(pz, d) {
  const E = pz.E, r = E.r, [x, z] = d.pos, R = d.radio || 3.2 * M, p = d.prof || 1.2 * M;
  if (E.tf && E.tf.deformar && !d.yaDeformado) E.tf.deformar(x, z, R, p, 0.35);
  const H = E.H, n = Math.round(10 + R / M * 4);
  for (let k = 0; k < n; k++) { const a = k / n * 6.283 + r() * 0.4, dd = R * (0.95 + r() * 0.55), px = x + Math.cos(a) * dd, pzz = z + Math.sin(a) * dd; pz.pon(k % 3 === 0 ? [0, 1] : [0], 'terron', px, H(px, pzz) - 0.05 * M, pzz, r() * 6, 0.6 + r() * 1.1); }
  for (let k = 0; k < 3; k++) { const a = r() * 6.283, dd = R * (0.4 + r() * 1.3), px = x + Math.cos(a) * dd, pzz = z + Math.sin(a) * dd; pz.pon([0], 'astilla', px, H(px, pzz), pzz, r() * 6); }
  // (la tierra removida y quemada la pinta terreno3d.deformar en el suelo)
  E.S.cover.push({tipo: 'crater', pos: [x, H(x, z), z], alto: 'tumbado', protegeDe: null, lados: ['todos'], capacidad: Math.max(1, Math.round(R / M / 1.2)), radio: R, pieza: pz.id});
  E.S.objetos.push({tipo: 'crater', pos: [x, H(x, z), z], radio: R, prof: p});
}
// foso: {puntos, ancho (u), prof (u), agua, escarpa: 'tierra'|'piedra'}
function foso(pz, d) {
  const E = pz.E, an = d.ancho || 6 * M, pr = d.prof || 2.6 * M, P = d.puntos, piedra = d.escarpa === 'piedra';
  if (E.tf && E.tf.excavarTrinchera && !d.yaExcavado) E.tf.excavarTrinchera(P, an, pr, {parapeto: d.lado || 0});
  const H = E.H, paso = 1.6 * M, Lt = largo(P), dw = an / 2 - 0.9;
  recorrer(P, paso, (x, z, ux, uz, s) => { const nx = -uz, nz = ux, s1 = Math.min(Lt, s + paso), [x1, z1] = enS(P, s1), y0 = H(x, z), y1 = H(x1, z1);
    if (piedra) [-1, 1].forEach(sg => { const ax = x + nx * sg * dw, az = z + nz * sg * dw, bx = x1 + nx * sg * dw, bz = z1 + nz * sg * dw, ya = H(x + nx * sg * (an / 2 + 1.4), z + nz * sg * (an / 2 + 1.4)), yb = H(x1 + nx * sg * (an / 2 + 1.4), z1 + nz * sg * (an / 2 + 1.4));
      [0, 1].forEach(l => { const G = pz.L[l].solido, Q = (a, b, c, e, col) => sg < 0 ? G.quad(a, b, c, e, col) : G.quad(b, a, e, c, col); Q([ax, y0 - 0.2, az], [bx, y1 - 0.2, bz], [bx, yb + 0.15 * M, bz], [ax, ya + 0.15 * M, az], C.piedra);
        if (l === 0) for (let y = y0 + 0.45 * M; y < ya; y += 0.45 * M) Q([ax - nx * sg * 0.02, y, az - nz * sg * 0.02], [bx - nx * sg * 0.02, y, bz - nz * sg * 0.02], [bx - nx * sg * 0.02, y + 0.04 * M, bz - nz * sg * 0.02], [ax - nx * sg * 0.02, y + 0.04 * M, az - nz * sg * 0.02], C.piedraO); }); });
    if (d.agua) { const ya = Math.min(y0, y1) + pr * 0.35; [0, 1, 2].forEach(l => { if (l === 2 && Math.round(s / paso) % 2) return; const ll = l === 2 ? paso * 2 : paso, [x2, z2] = enS(P, Math.min(Lt, s + ll)), W = an / 2 - 0.3;
      pz.agua = pz.agua || [new Geo(), new Geo(), new Geo()].map(g => { g.m.makeTranslation(-pz.cx, 0, -pz.cz); return g; });
      pz.agua[l].quad([x2 + nx * W, ya, z2 + nz * W], [x2 - nx * W, ya, z2 - nz * W], [x - nx * W, ya, z - nz * W], [x + nx * W, ya, z + nz * W], C.agua); }); }
  });
  E.S.superficies.push({tipo: 'foso', puntos: P.map(p => p.slice()), ancho: an, prof: pr, agua: !!d.agua, escarpa: piedra ? 'piedra' : 'tierra', infranqueable: ['vehiculo', 'artilleria', 'caballeria'], pieza: pz.id});
}
// puente de pontones: {a: [x, z], b: [x, z], ancho (u), nivel (altura del agua, u; por defecto la más baja del recorrido + 0,4 m)}
function pontones(pz, d) {
  const E = pz.E, H = E.H, r = E.r, [ax, az] = d.a, [bx, bz] = d.b, L = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / L, uz = (bz - az) / L, nx = -uz, nz = ux, an = d.ancho || 3.6 * M, ry = Math.atan2(ux, uz);
  let fondo = 1e9; for (let t = 0; t <= 1; t += 0.05) fondo = Math.min(fondo, H(lerp(ax, bx, t), lerp(az, bz, t))); const nivel = d.nivel != null ? d.nivel : fondo + 0.5 * M;
  const yT = nivel + 0.75 * M, orillaA = H(ax, az), orillaB = H(bx, bz), hS = s => H(ax + ux * s, az + uz * s);
  // rampas rectas desde lo alto de cada orilla hasta el borde del agua; tablero horizontal sobre el agua
  let eA = 0, eB = L; for (let s = 0; s <= L; s += 0.5) if (hS(s) > nivel + 0.4 * M) eA = s; else break; for (let s = L; s >= 0; s -= 0.5) if (hS(s) > nivel + 0.4 * M) eB = s; else break;
  const yA0 = hS(0) + 0.12 * M, yB0 = hS(L) + 0.12 * M, yAt = s => s < eA ? Math.max(lerp(yA0, yT, s / (eA || 1)), hS(s) + 0.08 * M) : s > eB ? Math.max(lerp(yT, yB0, (s - eB) / ((L - eB) || 1)), hS(s) + 0.08 * M) : yT;
  const G0 = pz.L[0], G1 = pz.L[1], G2 = pz.L[2], paso = 0.5 * M;
  // barcas cada 5 m (en el agua; las de las orillas sustituidas por caballetes)
  for (let s = 5 * M; s < L - 4 * M; s += 5 * M) { const x = ax + ux * s, z = az + uz * s, yb = nivel - 0.35 * M;
    [G0, G1].forEach((G, l) => { const lb = 7 * M, wb = 1.7 * M, hb = 0.85 * M, n = l ? 1 : 3; G.solido.caja(x, yb, z, lb * 0.8, hb, wb, 0x4a3a2a, {ry, colTecho: 0x5a4632});
      [-1, 1].forEach(sg => { const ex = x + nx * sg * lb * 0.4, ez = z + nz * sg * lb * 0.4, tx = x + nx * sg * lb * 0.5, tz = z + nz * sg * lb * 0.5;   // proas
        G.solido.quad([ex - ux * wb / 2, yb, ez - uz * wb / 2], [ex + ux * wb / 2, yb, ez + uz * wb / 2], [tx, yb + hb, tz], [tx, yb + hb, tz], 0x4a3a2a); if (n > 1) G.solido.tri([ex + ux * wb / 2, yb + hb, ez + uz * wb / 2], [ex - ux * wb / 2, yb + hb, ez - uz * wb / 2], [tx, yb + hb, tz], 0x5a4632); }); });
    if (G2) G2.solido.caja(x, nivel - 0.2 * M, z, 6 * M, 0.6 * M, 1.7 * M, 0x4a3a2a, {ry}); }
  // caballetes en las orillas
  [[2 * M, orillaA], [L - 2 * M, orillaB]].forEach(([s, h]) => { const x = ax + ux * s, z = az + uz * s, y = yAt(s); [-1, 1].forEach(sg => G0.solido.caja(x + nx * sg * an * 0.45, Math.min(h, y) - 0.3 * M, z + nz * sg * an * 0.45, 0.2 * M, y - Math.min(h, y) + 0.3 * M, 0.2 * M, C.maderaO)); G0.solido.caja(x, y - 0.25 * M, z, an * 1.0, 0.2 * M, 0.25 * M, C.maderaO, {ry}); });
  // viguetas y tablero (tablones transversales), guardalados y barandilla de cuerda
  for (let s = 0; s < L - 1e-3; s += paso) { const x = ax + ux * (s + paso / 2), z = az + uz * (s + paso / 2), y = yAt(s + paso / 2), nd = y - Math.min(yAt(s), yAt(s + paso));
    G0.solido.caja(x, y - 0.06 * M, z, an, 0.08 * M, paso * 0.92, r() < 0.15 ? C.maderaO : C.maderaC, {ry, colTecho: (Math.round(s / paso) % 2) ? 0x8a6a44 : C.maderaC}); }
  [G1, G2].forEach(G => { if (!G) return; for (let s = 0; s < L - 1e-3; s += 4 * M) { const s1 = Math.min(L, s + 4 * M), x = ax + ux * (s + s1) / 2, z = az + uz * (s + s1) / 2, y = Math.min(yAt(s), yAt(s1)); G.solido.caja(x, y - 0.1 * M, z, an, 0.12 * M, s1 - s, C.maderaC, {ry}); } });
  [-1, 1].forEach(sg => { for (let s = 0; s < L - 1e-3; s += 1.5 * M) { const s1 = Math.min(L, s + 1.5 * M), p0 = [ax + ux * s + nx * sg * an * 0.48, yAt(s), az + uz * s + nz * sg * an * 0.48], p1 = [ax + ux * s1 + nx * sg * an * 0.48, yAt(s1), az + uz * s1 + nz * sg * an * 0.48];
      G0.solido.entre([p0[0], p0[1] + 0.05 * M, p0[2]], [p1[0], p1[1] + 0.05 * M, p1[2]], 0.08 * M, 0.08 * M, 4, C.maderaO);   // guardalado (viga de borde)
      if (Math.round(s / (1.5 * M)) % 2 === 0) { G0.solido.caja(p0[0], p0[1], p0[2], 0.08 * M, 0.95 * M, 0.08 * M, C.maderaO); const [x2, z2] = [ax + ux * Math.min(L, s + 3 * M) + nx * sg * an * 0.48, az + uz * Math.min(L, s + 3 * M) + nz * sg * an * 0.48];
        G0.solido.entre([p0[0], p0[1] + 0.9 * M, p0[2]], [x2, yAt(Math.min(L, s + 3 * M)) + 0.82 * M, z2], 0.02 * M, 0.02 * M, 3, 0xb8a878); } } });   // barandilla de cuerda
  E.S.superficies.push({tipo: 'pontones', a: [ax, az], b: [bx, bz], ancho: an, y: yT, nivelAgua: nivel, cargaMax: 'artilleria de campaña (aprox.)', pieza: pz.id});
  [-1, 1].forEach(sg => E.S.colliders.push({tipo: 'segmento', a: [ax + nx * sg * an * 0.5, az + nz * sg * an * 0.5], b: [bx + nx * sg * an * 0.5, bz + nz * sg * an * 0.5], alto: 1 * M, base: yT, grosor: 0.1 * M, blando: true, salto: false, pieza: pz.id, elemento: 'pontones'}));
  E.S.objetos.push({tipo: 'pontones', a: [ax, az], b: [bx, bz], nivel});
}

/* ===================================================================================== */
/* SETOS, CULTIVOS Y ÁRBOLES */
const HOJA_SETO = [0x5a7a36, 0x3e5a2a, 0x7a6a30, 0x5a4a3a];
// seto: {puntos, alto (m), huecos (n o [[s0, s1]] u), tipo: 'seto'|'bocage' (talud de tierra con seto y árboles), estacion}
function seto(pz, d) {
  const E = pz.E, H = E.H, r = E.r, P = d.puntos, bocage = d.tipo === 'bocage', alto = (d.alto || (bocage ? 1.6 : 1.8)), est = ESTACION[d.estacion || E.estacion] || 1, col = HOJA_SETO[est], Lt = largo(P);
  const HU = huecosDe(d, Lt, r, (bocage ? 4 : 3) * M), talud = bocage ? 1.2 : 0, desnudo = est === 3;
  recorrer(P, 0.9 * M, (x, z, ux, uz, s) => { if (enHueco(HU, s)) return; const nx = -uz, nz = ux, y = H(x, z) + talud * M, hh = alto * (0.85 + r() * 0.3) * M / 2;
    if (bocage) { const s1 = Math.min(Lt, s + 0.9 * M), [x1, z1] = enS(P, s1), y1 = H(x1, z1); [0, 1].forEach(l => { const G = pz.L[l].solido, T = (a, b, w, hh2) => [a + nx * w, H(a + nx * w, b + nz * w) + hh2, b + nz * w];
      G.quad(T(x, z, 1.4 * M, -0.1), T(x1, z1, 1.4 * M, -0.1), [x1 + nx * 0.6 * M, y1 + talud * M, z1 + nz * 0.6 * M], [x + nx * 0.6 * M, y, z + nz * 0.6 * M], C.tierra);
      G.quad([x - nx * 0.6 * M, y, z - nz * 0.6 * M], [x1 - nx * 0.6 * M, y1 + talud * M, z1 - nz * 0.6 * M], T(x1, z1, -1.4 * M, -0.1), T(x, z, -1.4 * M, -0.1), C.tierra);
      G.quad([x + nx * 0.6 * M, y, z + nz * 0.6 * M], [x1 + nx * 0.6 * M, y1 + talud * M, z1 + nz * 0.6 * M], [x1 - nx * 0.6 * M, y1 + talud * M, z1 - nz * 0.6 * M], [x - nx * 0.6 * M, y, z - nz * 0.6 * M], 0x5a5a30); }); }
    const ox = nx * (r() - 0.5) * 0.4 * M, oz = nz * (r() - 0.5) * 0.4 * M;
    pz.L[0].viento.mata(x + ox, y + hh * 0.9, z + oz, hh * 1.05, desnudo ? 0 : 1, desnudo ? 0x5a4a3a : col, s | 0, 1.05, q => clamp((q[1] - y) / (hh * 2), 0, 1) * 0.6, desnudo ? 0.7 : 1);
    if (Math.round(s / (0.9 * M)) % 3 === 0) pz.L[1].viento.mata(x, y + hh, z, hh * 1.25, 0, desnudo ? 0x5a4a3a : col, (s | 0) + 1, 0.85, 0.3, 1.6);
    if (Math.round(s / (0.9 * M)) % 4 === 0) { const s1 = Math.min(Lt, s + 3.6 * M), [x1, z1] = enS(P, s1); if (!enHueco(HU, s1)) pz.L[2].solido.caja((x + x1) / 2, y - 0.2, (z + z1) / 2, 1.2 * M, alto * M, Math.hypot(x1 - x, z1 - z), desnudo ? 0x4a3e32 : col, {ry: Math.atan2(ux, uz)}); }
    if (bocage && Math.round(s / (0.9 * M)) % 14 === 7 && r() < 0.8) pz.arbol(r() < 0.6 ? (E.mezcla[0] || 'castano') : 'roble', x, y - 0.3, z, est, 0.8 + r() * 0.3);
    if (Math.round(s / (0.9 * M)) % 3 === 0) [-1, 1].forEach(sg => E.S.cover.push({tipo: bocage ? 'bocage' : 'seto', pos: [x + nx * sg * (bocage ? 1.8 : 1.0) * M, H(x + nx * sg * (bocage ? 1.8 : 1.0) * M, z + nz * sg * (bocage ? 1.8 : 1.0) * M), z + nz * sg * (bocage ? 1.8 : 1.0) * M],
      alto: alto + talud >= 1.6 ? 'alta' : 'baja', protegeDe: [-nx * sg, -nz * sg], lados: ['izq', 'der'], capacidad: 1, bloquea: bocage ? 0.9 : 0.5, ocultaVista: !desnudo, pieza: pz.id})); });
  tramos(Lt, HU).forEach(([a, b]) => { const [ax, az] = enS(P, a), [bx, bz] = enS(P, b); E.S.colliders.push({tipo: 'segmento', a: [ax, az], b: [bx, bz], alto: (alto + talud) * M, grosor: (bocage ? 2.8 : 1.1) * M, blando: !bocage, frena: bocage ? 0 : 0.3, salto: !bocage && alto < 1.3, bloquea: bocage ? 0.9 : 0.5, pieza: pz.id, elemento: bocage ? 'bocage' : 'seto'}); });
  HU.forEach(([a, b]) => { const [x, z, ux, uz] = enS(P, (a + b) / 2); E.S.brechas.push({tipo: bocage ? 'bocage' : 'seto', centro: [x, H(x, z), z], ancho: b - a, dir: [-uz, ux], pieza: pz.id}); });
}
// cultivo: {puntos: [A, B, C, D] (A→B a lo largo de los surcos), cultivo: 'trigo'|'maiz'|'vinedo'|'patata'|'pradera', estado: 'crecido'|'cosechado'|'arado', estacion, maxInstancias}
const CULTIVOS = {trigo: {calle: 0.5, paso: 0.3, alto: 1.0, cubre: 'tumbado', suelo: 0x8a7448, sueloA: 0x5a4430}, maiz: {calle: 0.75, paso: 0.35, alto: 2.4, tope: 0.8, cubre: 'pie', suelo: 0x6a5436, sueloA: 0x5a4430},
  vinedo: {calle: 2.2, paso: 1.2, alto: 1.4, tope: 0.5, cubre: 'rodilla', suelo: 0x8a6e4a, sueloA: 0x6a5238}, patata: {calle: 0.75, paso: 0.4, alto: 0.45, cubre: 'nada', suelo: 0x6a5032, sueloA: 0x5a4430},
  pradera: {calle: 0.6, paso: 0.6, alto: 0.5, cubre: 'nada', suelo: 0x5a7034, sueloA: 0x5a7034}};
function cultivo(pz, d) {
  const E = pz.E, H = E.H, r = E.r, [A, B, , D] = d.puntos, tipo = d.cultivo || 'trigo', K = CULTIVOS[tipo] || CULTIVOS.trigo, est = ESTACION[d.estacion || E.estacion] != null ? ESTACION[d.estacion || E.estacion] : 1;
  let estado = d.estado || (tipo === 'pradera' || tipo === 'vinedo' ? 'crecido' : est === 3 ? 'arado' : est === 2 && tipo === 'trigo' ? 'cosechado' : 'crecido');
  const ux0 = B[0] - A[0], uz0 = B[1] - A[1], Lx = Math.hypot(ux0, uz0), ux = ux0 / Lx, uz = uz0 / Lx, vx0 = D[0] - A[0], vz0 = D[1] - A[1], Lz = Math.hypot(vx0, vz0), vx = vx0 / Lz, vz = vz0 / Lz, ry = Math.atan2(ux, uz);
  const at = (s, t) => [A[0] + ux * s + vx * t, A[1] + uz * s + vz * t], cap = d.maxInstancias || E.maxInst;
  // suelo con surcos: franjas a lo largo (LOD0 cada calle; LOD1 cada 4 calles; LOD2 un solo paño)
  const sueloCol = estado === 'crecido' && tipo !== 'pradera' ? K.suelo : estado === 'arado' ? K.sueloA : tipo === 'pradera' ? (est === 3 ? 0x6a6a44 : K.suelo) : 0x9a8a58, sg = 4 * M;
  [0, 1, 2].forEach(l => { const G = pz.L[l].calco, calle = (tipo === 'pradera' ? 4 : l === 0 ? K.calle : K.calle * 4) * M, segs = Math.max(1, Math.ceil(Lx / (l === 2 ? Lx : sg)));
    for (let t = 0; t < Lz - 1e-3; t += l === 2 ? Lz : calle) { const t1 = Math.min(Lz, t + (l === 2 ? Lz : calle)); for (let k = 0; k < segs; k++) { const s0 = Lx * k / segs, s1 = Lx * (k + 1) / segs, Q = (s, tt) => { const [x, z] = at(s, tt); return [x, H(x, z) + 0.04 * M, z]; };
      const oscuro = l < 2 && tipo !== 'pradera' && Math.round(t / calle) % 2 === 1; _c.setHex(sueloCol); G.quad(Q(s0, t), Q(s0, t1), Q(s1, t1), Q(s1, t), oscuro ? new THREE.Color(sueloCol).multiplyScalar(0.82).getHex() : sueloCol); } } });
  // caballones (patata y tierra arada): prisma bajo por surco
  if ((tipo === 'patata' || estado === 'arado') && tipo !== 'pradera') [0, 1].forEach(l => { const calle = (l ? K.calle * 2 : K.calle) * M, hc = (tipo === 'patata' ? 0.22 : 0.12) * M, segs = Math.max(1, Math.ceil(Lx / sg)), G = pz.L[l].solido;
    for (let t = calle / 2; t < Lz; t += calle) for (let k = 0; k < segs; k++) { const s0 = Lx * k / segs, s1 = Lx * (k + 1) / segs, Q = (s, tt, h) => { const [x, z] = at(s, tt); return [x, H(x, z) + h, z]; };
      G.quad(Q(s0, t - calle / 2, 0.03), Q(s0, t, hc), Q(s1, t, hc), Q(s1, t - calle / 2, 0.03), K.sueloA); G.quad(Q(s0, t, hc), Q(s0, t + calle / 2, 0.03), Q(s1, t + calle / 2, 0.03), Q(s1, t, hc), 0x6a5238); } });
  // plantas en instancias (en hileras; si pasan del tope se espacian y se agrandan las matas)
  const calle0 = K.calle * M, paso0 = K.paso * M, n0 = (Lx / paso0) * (Lz / calle0), f = tipo === 'vinedo' ? Math.max(1, n0 / (cap * (K.tope || 1))) : Math.max(1, Math.sqrt(n0 / (cap * (K.tope || 1)))), paso = paso0 * f, calle = tipo === 'vinedo' ? calle0 : calle0 * f, sMata = Math.min(1.6, 0.9 + (f - 1) * 0.35);
  const nombre = tipo === 'trigo' ? (estado === 'cosechado' ? 'rastrojo' : est === 0 ? 'trigoV' : est === 3 ? 'trigoP' : 'trigo') : tipo === 'maiz' ? (estado === 'cosechado' ? 'rastrojo' : est >= 2 ? 'maizS' : 'maiz')
    : tipo === 'vinedo' ? (est === 3 ? 'vidD' : est === 2 ? 'vidO' : est === 0 ? 'vidP' : 'vid') : tipo === 'patata' ? (est >= 2 || estado === 'cosechado' ? 'patataS' : 'patata') : 'pasto';
  const lejos = tipo === 'trigo' && estado === 'crecido' ? 'trigo1' : tipo === 'maiz' && estado === 'crecido' ? 'maiz1' : null;
  if (estado !== 'arado') { let k = 0; for (let t = calle / 2; t < Lz; t += tipo === 'pradera' ? calle * f : calle) { let j = 0;
      for (let s = paso / 2 + (tipo === 'pradera' ? r() * paso : 0); s < Lx; s += paso, j++) { const jit = tipo === 'vinedo' ? 0 : (r() - 0.5) * paso * 0.6, tj = tipo === 'pradera' ? (r() - 0.5) * calle : (r() - 0.5) * 0.06 * M, [x, z] = at(s + jit, t + tj), y = H(x, z);
        const nm = tipo === 'pradera' && r() < 0.08 ? (r() < 0.5 ? 'amapola' : 'flor') : nombre; if (tipo === 'pradera' && est === 3 && r() < 0.6) continue;
        pz.pon([0], nm, x, y, z, tipo === 'vinedo' ? ry + Math.PI / 2 : r() * 6.28, (nm === 'rastrojo' ? 1.4 : sMata) * (0.9 + r() * 0.2));
        if (tipo === 'vinedo' && est === 1 && r() < 0.6) pz.pon([0], 'uva', x, y, z, ry + Math.PI / 2, 1);
        if (lejos && (j % 3 === 0) && (k % 2 === 0)) pz.pon([1], lejos, x, y, z, r() * 3, sMata * 1.3);
      } k++;
      // viñedo: postes cada 5 m y dos alambres
      if (tipo === 'vinedo') { const postes = Math.max(2, Math.round(Lx / (5 * M))); let q0 = null; for (let i = 0; i <= postes; i++) { const [x, z] = at(Lx * i / postes, t), y = H(x, z); pz.pon([0, 1], 'piquete', x, y - 0.2 * M, z, 0, 1, 0, 0, 1.05);
        if (q0) [0.9, 1.3].forEach(hh => { pz.L[0].doble.quad([q0[0], q0[1] + hh * M, q0[2]], [x, y + hh * M, z], [x, y + hh * M + 0.02 * M, z], [q0[0], q0[1] + hh * M + 0.02 * M, q0[2]], C.alambre); }); q0 = [x, y, z]; }
        if (est !== 3) { const segs = Math.max(1, Math.ceil(Lx / sg)); for (let i = 0; i < segs; i++) { const [xa, za] = at(Lx * i / segs, t), [xb, zb] = at(Lx * (i + 1) / segs, t), G = pz.L[2].viento, G1 = pz.L[1].viento; G1.quad([xa, H(xa, za), za], [xb, H(xb, zb), zb], [xb, H(xb, zb) + 1.3 * M, zb], [xa, H(xa, za) + 1.3 * M, za], nombre === 'vidO' ? 0x8a6a30 : 0x4e6a30, 0.2); G.quad([xa, H(xa, za), za], [xb, H(xb, zb), zb], [xb, H(xb, zb) + 1.3 * M, zb], [xa, H(xa, za) + 1.3 * M, za], nombre === 'vidO' ? 0x8a6a30 : 0x4e6a30, 0.2); } } } } }
  // gavillas (trigo cosechado): hacinas en cuadrícula de ~8 m
  if (tipo === 'trigo' && estado === 'cosechado') for (let t = 4 * M; t < Lz; t += 8 * M) for (let s = 4 * M; s < Lx; s += 8 * M) { const [x, z] = at(s + (r() - 0.5) * 2 * M, t + (r() - 0.5) * 2 * M), y = H(x, z);
    pz.pon([1], 'gavilla', x, y, z, 0, 1.7); for (let k = 0; k < 5; k++) { const a = k * 1.256 + r() * 0.3; pz.pon([0], 'gavilla', x + Math.cos(a) * 0.3 * M, y, z + Math.sin(a) * 0.3 * M, r() * 6, 1, Math.cos(a) * 0.25, Math.sin(a) * 0.25); } }
  // franja alta en LOD1/LOD2 para los cultivos que tapan (maíz y trigo crecidos)
  if (estado === 'crecido' && (tipo === 'maiz' || tipo === 'trigo')) [1, 2].forEach(l => { const hh = (tipo === 'maiz' ? 2.2 : 0.9) * M, segs = Math.max(1, Math.ceil(Lx / (l === 1 ? sg : sg * 3))), filas = l === 1 ? 6 : 2, colA = tipo === 'maiz' ? (est >= 2 ? 0xa89a5a : 0x4a6e2e) : est === 0 ? 0x6a8a3a : 0xc0a458;
    for (let i = 0; i < segs; i++) for (let j = 0; j < filas; j++) { const s0 = Lx * i / segs, s1 = Lx * (i + 1) / segs, t0 = Lz * j / filas, t1 = Lz * (j + 1) / filas, Q = (s, t, h) => { const [x, z] = at(s, t); return [x, H(x, z) + h, z]; };
      pz.L[l].viento.quad(Q(s0, t0, hh), Q(s0, t1, hh), Q(s1, t1, hh), Q(s1, t0, hh), colA, 0.15); if (j === 0) pz.L[l].viento.quad(Q(s1, t0, 0), Q(s1, t0, hh), Q(s0, t0, hh), Q(s0, t0, 0), colA, 0.1); if (j === filas - 1) pz.L[l].viento.quad(Q(s0, t1, 0), Q(s0, t1, hh), Q(s1, t1, hh), Q(s1, t1, 0), colA, 0.1);
      if (i === 0) pz.L[l].viento.quad(Q(s0, t0, 0), Q(s0, t0, hh), Q(s0, t1, hh), Q(s0, t1, 0), colA, 0.1); if (i === segs - 1) pz.L[l].viento.quad(Q(s1, t1, 0), Q(s1, t1, hh), Q(s1, t0, hh), Q(s1, t0, 0), colA, 0.1); } });
  const crecido = estado === 'crecido', cubre = crecido ? K.cubre : 'nada';
  E.S.objetos.push({tipo: 'campo', cultivo: tipo, estado, estacion: ['primavera', 'verano', 'otono', 'invierno'][est], puntos: d.puntos.map(p => p.slice()), cubre: tipo === 'maiz' && est >= 2 && crecido ? 'rodilla' : cubre,
    bloquea: 0, blando: true, ocultaVista: crecido && (tipo === 'maiz' || (tipo === 'trigo' && est >= 1)), frena: tipo === 'vinedo' ? {aLoLargo: 1, aTraves: 0.55} : tipo === 'maiz' && crecido ? 0.8 : estado === 'arado' ? 0.85 : 1, direccion: [ux, uz], pieza: pz.id});
}

/* ===================================================================================== */
/* RESTOS DE BATALLA: generador por parámetro. Devuelve datos (sin geometría): props, figuras para troops3d y objetos */
const TOCADO = {A: 'chaco', B: 'kepis', C: 'pickel', D: 'casco', E: 'casco'};
const CADAVER = ['cuerpo_inerte_tumbado', 'cuerpo_inerte_adelante', 'cuerpo_inerte_atras_pie', 'cuerpo_inerte_costado_iz', 'cuerpo_inerte_costado_de', 'cuerpo_inerte_rodillas_adelante', 'cuerpo_inerte_giro'];
const PIEZA_ERA = {A: ['canon_6', 'canon_12', 'obus_campana'], B: ['canon_12', 'rayado_rc'], C: ['rayado_rc', 'gatling'], D: ['canon_75', 'obus_pesado', 'maxim'], E: ['campana_E', 'antitanque']};
const CABALLO_ERA = {A: ['husar', 'coracero', 'dragon', 'lancero'], B: ['dragon', 'cazador', 'husar'], C: ['dragon', 'cosaco', 'husar'], D: ['dragon', 'cosaco'], E: ['cosaco', 'dragon']};
function generarRestos(op) {
  op = Object.assign({centro: [0, 0], radio: 40, densidad: 0.5, era: 'B', naciones: ['FRA', 'PRU'], semilla: 5, frente: 0, forma: 'disco', largo: null}, op || {});
  const r = rng(op.semilla), era = op.era, dens = clamp(op.densidad, 0, 1), area = op.forma === 'franja' ? (op.largo || op.radio * 2) * op.radio * 2 / 1600 : Math.PI * op.radio * op.radio / 1600;   // en «parcelas» de 40×40 u
  const n = (base, k) => op[k] != null ? op[k] : Math.round(base * dens * area * (0.8 + r() * 0.4));
  const fx = Math.cos(op.frente), fz = Math.sin(op.frente);   // dirección del frente (los caídos miran sobre todo hacia el enemigo)
  const punto = () => { if (op.forma === 'franja') { const L = op.largo || op.radio * 2, s = (r() - 0.5) * L, t = (r() + r() - 1) * op.radio; return [op.centro[0] + fx * s - fz * t, op.centro[1] + fz * s + fx * t]; }
    const a = r() * 6.283, d = op.radio * Math.sqrt(r()) * (0.6 + 0.4 * r()); return [op.centro[0] + Math.cos(a) * d, op.centro[1] + Math.sin(a) * d]; };
  const props = [], figuras = [], objetos = [], pon = (nombre, p, ry, extra) => props.push(Object.assign({nombre, pos: p, ry: ry == null ? r() * 6.283 : ry, s: 1, rx: 0, rz: 0}, extra || {}));
  const nat = () => op.naciones[Math.floor(r() * op.naciones.length)], haciaEnemigo = () => Math.atan2(fx, fz) + (r() - 0.5) * 1.6 + (r() < 0.3 ? Math.PI : 0);
  // caídos (figuras de infanteria3d) con su fusil, tocado y mochila cerca; manchas oscuras debajo
  const nCad = n(14, 'cadaveres'); for (let k = 0; k < nCad; k++) { const p = punto(), nt = nat(), ry = haciaEnemigo();
    figuras.push({modulo: 'infanteria', tipo: 'inf_soldado', clip: CADAVER[Math.floor(r() * CADAVER.length)], nat: nt, era, pos: p, rot: ry});
    if (r() < 0.6) pon('mancha', [p[0] + (r() - 0.5) * 0.8, p[1] + (r() - 0.5) * 0.8], null, {s: 0.6 + r() * 0.6});
    if (r() < 0.7) pon('fusil', [p[0] + (r() - 0.5) * 2.5, p[1] + (r() - 0.5) * 2.5]); if (r() < 0.5) pon(TOCADO[era], [p[0] + (r() - 0.5) * 2.2, p[1] + (r() - 0.5) * 2.2], null, {rx: r() < 0.5 ? 1.57 : 0});
    if (r() < 0.25) pon('mochila', [p[0] + (r() - 0.5) * 2, p[1] + (r() - 0.5) * 2], null, {rz: r() < 0.5 ? 1.57 : 0}); }
  // caballos muertos (caballeria3d: tipo cab_*_sin_jinete, clip caballo_caido)
  const nCab = n(era === 'E' ? 0.6 : 2.5, 'caballos'); for (let k = 0; k < nCab; k++) { const p = punto(), cl = CABALLO_ERA[era] || CABALLO_ERA.B, t = cl[Math.floor(r() * cl.length)];
    figuras.push({modulo: 'caballeria', tipo: `cab_${t}_sin_jinete`, clip: 'caballo_caido', nat: nat(), era, pos: p, rot: r() * 6.283}); objetos.push({tipo: 'caballo_muerto', pos: p, radio: 1.4 * M});
    pon('mancha', p, null, {s: 1.3}); if (era !== 'E' && r() < 0.6) pon('sable', [p[0] + (r() - 0.5) * 3, p[1] + (r() - 0.5) * 3]); }
  // piezas abandonadas (artilleria3d: art_<pieza> con el clip art_<pieza>_desmontada) y su dotación caída
  const nCan = n(0.5, 'canones'); for (let k = 0; k < nCan; k++) { const p = punto(), ps = PIEZA_ERA[era] || PIEZA_ERA.B, pieza = ps[Math.floor(r() * ps.length)], nt = nat(), ry = r() * 6.283;
    figuras.push({modulo: 'artilleria', tipo: 'art_' + pieza, clip: `art_${pieza}_desmontada`, nat: nt, era, pos: p, rot: ry}); objetos.push({tipo: 'pieza_abandonada', pieza, pos: p, radio: 1.6 * M});
    if (r() < 0.7) figuras.push({modulo: 'artilleria', tipo: 'inf_art_escobillon', clip: 'art_srv_muerto_rueda', nat: nt, era, pos: p, rot: ry});
    for (let j = 0; j < 3; j++) pon(j ? 'caja' : 'rueda', [p[0] + (r() - 0.5) * 6, p[1] + (r() - 0.5) * 6]); }
  // equipo suelto
  const sueltos = [['fusil', 10], ['mochila', 6], [TOCADO[era], 6], ['cartuchera', 6], ['caja', 2], ['rueda', era === 'E' ? 0.4 : 1.2], ['tambor', era <= 'B' ? 1 : 0], ['sable', era <= 'C' ? 1.5 : 0], ['cantimplora', era >= 'C' ? 4 : 1.5], ['mancha', 1.5]];
  sueltos.forEach(([nm, b]) => { const c = n(b, nm === TOCADO[era] ? 'tocados' : nm === 'fusil' ? 'armas' : nm === 'mochila' ? 'mochilas' : nm + 's'); for (let k = 0; k < c; k++) pon(nm, punto(), null, nm === 'tambor' ? {rz: r() < 0.5 ? 1.57 : 0} : nm === 'mancha' ? {s: 0.5 + r() * 0.6} : null); });
  return {props, figuras, objetos, era, centro: op.centro, radio: op.radio};
}
function restos(pz, d) {
  const E = pz.E, H = E.H, R = d.props ? d : generarRestos(Object.assign({semilla: E.semilla * 13 + 7}, d));
  R.props.forEach(p => { const [x, z] = p.pos, y = H(x, z) + (p.nombre === 'mancha' ? 0.02 * M : 0.01); pz.pon(p.nombre === 'mancha' || p.nombre === 'caja' || p.nombre === 'rueda' ? [0, 1] : [0], p.nombre, x, y, z, p.ry, p.s, p.rx, p.rz); });
  R.figuras.forEach(f => { f.pos = [f.pos[0], H(f.pos[0], f.pos[1]), f.pos[1]]; E.S.figuras.push(f); });
  R.objetos.forEach(o => { const [x, z] = o.pos, y = H(x, z); E.S.objetos.push(Object.assign({}, o, {pos: [x, y, z]}));
    if (o.tipo === 'caballo_muerto') { E.S.cover.push({tipo: 'caballo_muerto', pos: [x, y, z], alto: 'tumbado', protegeDe: null, lados: ['todos'], capacidad: 1, pieza: pz.id}); E.S.colliders.push({tipo: 'circulo', centro: [x, z], radio: o.radio, alto: 1.0 * M, blando: true, salto: true, pieza: pz.id, elemento: 'caballo_muerto'}); }
    if (o.tipo === 'pieza_abandonada') { E.S.cover.push({tipo: 'pieza', pos: [x, y, z], alto: 'baja', protegeDe: null, lados: ['todos'], capacidad: 2, pieza: pz.id}); E.S.colliders.push({tipo: 'circulo', centro: [x, z], radio: o.radio, alto: 1.3 * M, blando: false, salto: false, pieza: pz.id, elemento: 'pieza_abandonada'}); } });
}

/* ===================================================================================== */
/* ESCENARIO: crearEscenario(tf, op) construye todas las piezas pedidas y devuelve el grupo y los datos de juego */
Pieza.prototype.arbol = function (esp, x, y, z, est, escala) { (this.arboles = this.arboles || []).push({esp, x, y, z, est, escala: escala || 1, ry: this.E.r() * 6.283}); };
const CONSTRUCTOR = {foso, trinchera, crater, alambrada, frisa, abatis, gaviones, empalizada, pontones, seto, cultivo, restos};
const LISTAS = [['fosos', 'foso'], ['trincheras', 'trinchera'], ['crateres', 'crater'], ['alambradas', 'alambrada'], ['frisas', 'frisa'], ['abatis', 'abatis'], ['gaviones', 'gaviones'], ['empalizadas', 'empalizada'],
  ['pontones', 'pontones'], ['setos', 'seto'], ['cultivos', 'cultivo'], ['restos', 'restos']];   // en este orden: primero lo que cambia el terreno
const ESTN = ['primavera', 'verano', 'otono', 'invierno'];
function crearEscenario(tf, op) {
  op = Object.assign({semilla: 1, era: 'C', estacion: 'verano', nieve: false, bioma: 'templado', distLOD: [160, 480], maxInst: 3000, sombras: true, arboles: []}, op || {});
  const H = (x, z) => tf ? (tf.height || tf.heightAt)(x, z) : 0, eraI = Math.max(0, 'ABCDE'.indexOf(op.era));
  const S = {colliders: [], cover: [], loopholes: [], tiradores: [], superficies: [], brechas: [], objetos: [], figuras: []};
  const mz = MEZCLA[op.bioma] || MEZCLA.templado, mezcla = Object.keys(mz).sort((a, b) => mz[b] - mz[a]);
  const E = {tf, H, r: rng(op.semilla * 977 + 13), S, eraI, era: op.era, estacion: op.estacion, nieve: op.nieve, semilla: op.semilla, mezcla, maxInst: op.maxInst};
  const piezas = [], grupo = new THREE.Group(); grupo.name = 'escenario';
  const nueva = (tipo, centro) => { const p = new Pieza(E, tipo, centro[0], centro[1]); p.id = piezas.length; piezas.push(p); return p; };
  LISTAS.forEach(([lista, tipo]) => (op[lista] || []).forEach(d => {
    const c = d.puntos ? centroDe(d.puntos) : d.pos ? d.pos : d.a ? [(d.a[0] + d.b[0]) / 2, (d.a[1] + d.b[1]) / 2] : d.centro || [0, 0];
    const pz = nueva(tipo, c); pz.def = d; CONSTRUCTOR[tipo](pz, d); }));
  // árboles sueltos: por celdas de 120 u (cada celda una pieza con su LOD)
  const celdas = new Map(); (op.arboles || []).forEach(a => { const k = Math.floor(a.pos[0] / 120) + ',' + Math.floor(a.pos[1] / 120); if (!celdas.has(k)) celdas.set(k, []); celdas.get(k).push(a); });
  celdas.forEach(L => { const pz = nueva('arboles', centroDe(L.map(a => a.pos))); L.forEach(a => { const est = ESTACION[a.estacion || op.estacion] != null ? ESTACION[a.estacion || op.estacion] : 1; pz.arbol(a.especie, a.pos[0], H(a.pos[0], a.pos[1]) - 0.2, a.pos[1], est, a.escala || (0.85 + E.r() * 0.3)); }); });
  // colisores y cobertura de los troncos
  piezas.forEach(pz => (pz.arboles || []).forEach(a => { const t = arbolCache(a.esp, ESTN[a.est], op.nieve, a.x | 0), rr = Math.max(0.2, t.radioTronco) * a.escala * M;
    S.colliders.push({tipo: 'circulo', centro: [a.x, a.z], radio: rr, alto: t.alto * a.escala * M, blando: false, salto: false, pieza: pz.id, elemento: 'arbol', especie: a.esp});
    if (t.radioTronco * a.escala >= 0.3) S.cover.push({tipo: 'arbol', pos: [a.x, a.y, a.z], alto: 'alta', protegeDe: null, lados: ['todos'], capacidad: 1, radio: rr, pieza: pz.id}); }));
  // mallas por pieza y nivel
  const I = INST(), matCapa = {solido: mat('solido'), doble: mat('doble'), viento: matViento(0.25, true), calco: mat('calco'),
    marana: _MAT.marana || (_MAT.marana = new THREE.MeshLambertMaterial({vertexColors: true, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false}))}, matArbol = matViento(0.35, false), matInstV = matViento(0.12, true);
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _v = new THREE.Vector3(), _s = new THREE.Vector3(), _y = new THREE.Vector3(0, 1, 0), tris = [0, 0, 0], porTipo = {};
  piezas.forEach(pz => {
    const lod = new THREE.LOD(); lod.name = pz.tipo + '_' + pz.id; lod.position.set(pz.cx, 0, pz.cz); pz.trisL = [0, 0, 0];
    pz.L.forEach((L, l) => { const g = new THREE.Group(); g.name = 'lod' + l;
      CAPAS.forEach(k => { if (!L[k].p.length) return; const m = new THREE.Mesh(L[k].geometria(), matCapa[k]); m.name = k; m.castShadow = op.sombras && l === 0 && k !== 'calco' && k !== 'marana'; m.receiveShadow = true; g.add(m); });
      if (pz.agua && pz.agua[l].p.length) { const m = new THREE.Mesh(pz.agua[l].geometria(), mat('agua')); m.name = 'agua'; g.add(m); }
      Object.keys(L.inst).forEach(k => { const lista = L.inst[k]; if (!lista.length) return; const cap = I[k].capa, im = new THREE.InstancedMesh(I[k].geo, cap === 'viento' ? matInstV : matCapa[cap], lista.length);
        lista.forEach((m4, i) => im.setMatrixAt(i, m4)); im.name = 'inst_' + k; im.castShadow = op.sombras && l === 0 && cap !== 'calco'; im.receiveShadow = true; im.computeBoundingSphere && im.computeBoundingSphere(); g.add(im); });
      // árboles: LOD0 de la especie en el nivel 0; su LOD1 en los niveles 1 y 2
      if (pz.arboles) { const grupos = new Map(); pz.arboles.forEach(a => { const k = a.esp + '|' + a.est + '|' + ((a.x | 0) % 3); if (!grupos.has(k)) grupos.set(k, []); grupos.get(k).push(a); });
        grupos.forEach(lista => { const a0 = lista[0], t = arbolCache(a0.esp, ESTN[a0.est], op.nieve, a0.x | 0), geo = l === 0 ? t.lod0 : t.lod1, im = new THREE.InstancedMesh(geo, matArbol, lista.length);
          lista.forEach((a, i) => { _q.setFromAxisAngle(_y, a.ry); _v.set(a.x - pz.cx, a.y, a.z - pz.cz); _s.setScalar(a.escala * M); _m.compose(_v, _q, _s); im.setMatrixAt(i, _m); });
          im.name = 'arbol_' + a0.esp; im.castShadow = op.sombras && l < 2; im.receiveShadow = true; im.computeBoundingSphere && im.computeBoundingSphere(); g.add(im); pz.trisL[l] += (l === 0 ? t.tris[0] : t.tris[1]) * lista.length; }); }
      pz.trisL[l] += pz.tris(l); tris[l] += pz.trisL[l];
      lod.addLevel(g, l === 0 ? 0 : op.distLOD[l - 1]); });
    const pt = porTipo[pz.tipo] || (porTipo[pz.tipo] = {piezas: 0, tris: [0, 0, 0]}); pt.piezas++; pz.trisL.forEach((t, i) => { pt.tris[i] += t; });
    pz.lod = lod; grupo.add(lod); });
  // bucle: viento (comparte uniformes con vegetacion3d) y LOD; sin asignaciones por fotograma
  const lods = piezas.map(p => p.lod);
  function actualizar(t, viento) { VIENTO.tiempo.value = t; if (viento) { VIENTO.dir.value.set(viento[0], viento[1]); } }
  function update(cam) { for (let i = 0; i < lods.length; i++) lods[i].update(cam); }
  grupo.update = update;
  return {grupo, piezas: piezas.map(p => ({id: p.id, tipo: p.tipo, centro: [p.cx, p.cz], tris: p.trisL, lod: p.lod, def: p.def})), colliders: S.colliders, cover: S.cover, loopholes: S.loopholes, tiradores: S.tiradores,
    superficies: S.superficies, brechas: S.brechas, objetos: S.objetos, figuras: S.figuras, actualizar, update,
    stats: {triangulos: tris, piezas: piezas.length, porTipo, colliders: S.colliders.length, cover: S.cover.length, figuras: S.figuras.length, brechas: S.brechas.length}};
}

/* ---------- figuras para troops3d: cadáveres, caballos caídos y piezas desmontadas como lotes de instancias congelados ----------
   Requiere Troops3D con infanteria3d / caballeria3d / artilleria3d registrados ANTES de crear el TroopShared (los clips se hornean ahí).
   Devuelve {grupo, lotes, omitidas}. Los clips sin bucle se ponen con un inicio muy antiguo: se ve su último fotograma. */
function poblarFiguras(figuras, T3, shared, op) {
  op = op || {}; const grupo = new THREE.Group(); grupo.name = 'figuras_restos'; const omitidas = [], cuenta = new Map(), lotes = [];
  const valida = f => { const K = T3.KINDS[f.tipo]; if (!K) return null; const rig = K.rig, cl = T3.CLIPS[rig] && T3.CLIPS[rig][f.clip]; if (!cl) return null; const era = (K.eras || []).includes(f.era) ? f.era : (K.eras || [f.era])[0]; return {K, era, loop: cl.loop}; };
  figuras.forEach(f => { const v = valida(f); if (!v) { omitidas.push(f); return; } const k = f.tipo + '|' + v.era + '|' + f.nat; if (!cuenta.has(k)) cuenta.set(k, {tipo: f.tipo, era: v.era, nat: f.nat, lista: []}); cuenta.get(k).lista.push([f, v]); });
  cuenta.forEach(c => { const b = new T3.TroopBatch(shared, c.tipo, c.era, c.nat, c.lista.length, {lod: op.lod || 0}); b.mesh.castShadow = true; b.mesh.name = 'restos_' + c.tipo;
    c.lista.forEach(([f, v]) => b.add(f.pos[0], f.pos[1], f.pos[2], f.rot, 1, f.nat, f.clip, v.loop ? {phase: 0, h: 0} : {start: -1e4, h: 0})); grupo.add(b.mesh); lotes.push(b); });
  return {grupo, lotes, omitidas};
}

/* ===================================================================================== */
/* PRUEBA AUTOMÁTICA */
const PRESUP_ARBOL = [1600, 220];
// por pieza [LOD0, LOD1, LOD2]: un campo de cultivo lleva hasta 3000 instancias de matas (el tope se reparte espaciándolas); el resto, una pieza de hasta ~250 m
const PRESUP_PIEZA = {cultivo: [100000, 20000, 4000], otra: [60000, 8000, 2000]};
function escenarioMuestra(cx, cz, op) {   // un campo de batalla con todo (lo usan la prueba y la demo); cx, cz = centro (u)
  op = op || {}; const x = cx, z = cz, est = op.estacion || 'verano';
  return Object.assign({semilla: op.semilla || 3, era: op.era || 'D', estacion: est, nieve: !!op.nieve,
    trincheras: [{puntos: [[x - 150, z + 20], [x - 90, z + 32], [x - 40, z + 18], [x + 10, z + 34], [x + 60, z + 22]], lado: -1, revestimiento: 'tablas'}, {puntos: [[x + 70, z + 30], [x + 130, z + 40]], lado: -1, revestimiento: 'sacos'}],
    alambradas: [{puntos: [[x - 150, z - 5], [x - 40, z - 8], [x + 60, z - 4]], tipo: 'alta', huecos: 2}, {puntos: [[x + 70, z + 5], [x + 140, z + 8]], tipo: 'concertina', huecos: 1}, {puntos: [[x - 150, z - 18], [x - 60, z - 20]], tipo: 'baja'}],
    frisas: [{puntos: [[x - 30, z - 30], [x + 40, z - 30]]}], abatis: [{puntos: [[x - 330, z - 10], [x - 290, z - 22], [x - 250, z - 15]], lado: 1}],
    gaviones: [{puntos: [[x - 220, z + 40], [x - 190, z + 36], [x - 170, z + 40]], lado: -1}], empalizadas: [{puntos: [[x - 340, z + 90], [x - 300, z + 80], [x - 280, z + 110], [x - 320, z + 125], [x - 340, z + 90]], lado: 1, alto: 3}],
    crateres: [[x - 20, z - 50, 6], [x + 5, z - 62, 4], [x + 30, z - 45, 8], [x - 70, z - 40, 5], [x + 80, z - 60, 4], [x - 120, z - 55, 6]].map(([a, b, rr]) => ({pos: [a, b], radio: rr, prof: rr * 0.4})),
    fosos: [{puntos: [[x + 50, z + 150], [x + 140, z + 145]], agua: true, escarpa: 'tierra'}, {puntos: [[x - 120, z + 150], [x - 40, z + 155]], escarpa: 'piedra'}], pontones: [{a: [x + 95, z + 136], b: [x + 96, z + 162]}],
    setos: [{puntos: [[x - 260, z - 120], [x - 120, z - 130], [x, z - 125]], huecos: 2}, {puntos: [[x + 20, z - 140], [x + 100, z - 150], [x + 170, z - 135]], tipo: 'bocage', huecos: 1}],
    cultivos: [['trigo', -260], ['maiz', -170], ['vinedo', -80], ['patata', 10], ['pradera', 100]].map(([c, ox]) => ({puntos: [[x + ox, z - 230], [x + ox + 80, z - 230], [x + ox + 80, z - 160], [x + ox, z - 160]], cultivo: c})),
    arboles: ESPECIES.map((e, i) => ({especie: e, pos: [x - 250 + i * 26, z + 200 + (i % 2) * 14]})),
    restos: [{centro: [x - 40, z - 25], radio: 45, densidad: 0.8, era: op.era || 'D', naciones: ['FRA', 'GER'], forma: 'franja', largo: 160, frente: Math.PI / 2}]}, op.extra || {});
}
function pruebaEscenario(tfFactory, T3) {
  const fallos = [], out = {};
  // 1) árboles: todas las especies × estaciones × nieve dentro de presupuesto y con «balanceo»
  out.arboles = []; ESPECIES.forEach(e => ESTN.forEach(s => [false, true].forEach(nv => { const t = crearArbol(e, {estacion: s, nieve: nv}); out.arboles.push({especie: e, estacion: s, nieve: nv, tris: t.tris, alto: +t.alto.toFixed(1)});
    if (t.tris[0] > PRESUP_ARBOL[0] || t.tris[1] > PRESUP_ARBOL[1] || !t.tris[1]) fallos.push(`árbol ${e}/${s}${nv ? '/nieve' : ''}: ${t.tris.join('/')} > ${PRESUP_ARBOL.join('/')}`);
    if (!t.lod0.attributes.balanceo || !t.lod1.attributes.balanceo) fallos.push('árbol sin balanceo ' + e); })));
  // 2) campo completo sobre el terreno real
  const tf = tfFactory(7), [cx, cz] = tfFactory.centro || [520, 420], def = escenarioMuestra(cx, cz, {semilla: 4});
  const tr = def.trincheras[0].puntos[2], antesT = tf.height(tr[0], tr[1]), cr = def.crateres[2].pos, antesC = tf.height(cr[0], cr[1]);
  const t0 = Date.now(), E = crearEscenario(tf, def); out.ms = Date.now() - t0; out.stats = E.stats;
  const bajaT = antesT - tf.height(tr[0], tr[1]), bajaC = antesC - tf.height(cr[0], cr[1]); out.trincheraBaja = +bajaT.toFixed(2); out.craterBaja = +bajaC.toFixed(2);
  if (bajaT < 2.0) fallos.push('la trinchera no excava el terreno (' + bajaT.toFixed(2) + ' u)'); if (bajaC < 1.5) fallos.push('el cráter no deforma el terreno (' + bajaC.toFixed(2) + ' u)');
  LISTAS.forEach(([l, t]) => { if ((def[l] || []).length && !E.stats.porTipo[t]) fallos.push('falta la pieza ' + t); }); if (!E.stats.porTipo.arboles) fallos.push('faltan los árboles');
  E.piezas.forEach(p => { if (!(p.tris[0] >= p.tris[1] && p.tris[1] >= p.tris[2])) fallos.push(`LOD no decreciente en ${p.tipo} ${p.id}: ${p.tris.join('/')}`); const lim = PRESUP_PIEZA[p.tipo] || PRESUP_PIEZA.otra; if (p.tris[0] > lim[0] || p.tris[1] > lim[1] || p.tris[2] > lim[2]) fallos.push(`pieza ${p.tipo} ${p.id} sobre presupuesto: ${p.tris.join('/')} > ${lim.join('/')}`); });
  const hu = def.alambradas.reduce((a, d) => a + (d.huecos | 0), 0) + def.setos.reduce((a, d) => a + (d.huecos | 0), 0); if (E.brechas.length !== hu) fallos.push(`brechas ${E.brechas.length} ≠ huecos pedidos ${hu}`);
  E.colliders.forEach(c => { if (!(c.tipo === 'caja' ? c.centro && c.ancho > 0 && c.fondo > 0 && isFinite(c.rot) : c.tipo === 'segmento' ? c.a && c.b && c.grosor > 0 && isFinite(c.a[0] + c.b[1]) : c.tipo === 'circulo' ? c.centro && c.radio > 0 : false)) fallos.push('collider mal formado ' + JSON.stringify(c).slice(0, 80)); });
  E.cover.forEach(c => { if (!c.pos || c.pos.length !== 3 || c.pos.some(v => !isFinite(v))) fallos.push('cobertura mal formada ' + c.tipo); });
  ['trinchera', 'foso', 'pontones'].forEach(t => { if (!E.superficies.some(s => s.tipo === t)) fallos.push('falta la superficie ' + t); });
  const tiposCult = new Set(E.objetos.filter(o => o.tipo === 'campo').map(o => o.cultivo)); ['trigo', 'maiz', 'vinedo', 'patata', 'pradera'].forEach(c => { if (!tiposCult.has(c)) fallos.push('falta el cultivo ' + c); });
  if (!E.figuras.length) fallos.push('los restos no generan figuras');
  if (T3) { const v = E.figuras.filter(f => !T3.KINDS[f.tipo] || !(T3.CLIPS[T3.KINDS[f.tipo].rig] || {})[f.clip]); out.figurasSinClip = v.length; if (v.length) fallos.push(`${v.length} figuras con tipo o clip que troops3d no conoce: ${[...new Set(v.map(f => f.tipo + '/' + f.clip))].slice(0, 4).join(' ')}`); }
  // 3) cultivos: todas las estaciones y estados sin errores y con el tope de instancias
  out.cultivos = []; const plano = {height: () => 0}; ['trigo', 'maiz', 'vinedo', 'patata', 'pradera'].forEach(c => ESTN.forEach(s => ['crecido', 'cosechado', 'arado'].forEach(st => {
    const E2 = crearEscenario(plano, {estacion: s, cultivos: [{puntos: [[0, 0], [200, 0], [200, 150], [0, 150]], cultivo: c, estado: st}]}), p = E2.piezas[0], ni = Object.values(E2.piezas[0].lod.levels[0].object.children).filter(o => o.isInstancedMesh).reduce((a, o) => a + o.count, 0);
    out.cultivos.push({cultivo: c, estacion: s, estado: st, tris: p.tris, instancias: ni}); if (ni > 3000 * 1.25 + 600) fallos.push(`cultivo ${c}/${s}/${st}: ${ni} instancias (tope 3000)`); if (p.tris[0] > PRESUP_PIEZA.cultivo[0] * 1.6 || p.tris[1] > PRESUP_PIEZA.cultivo[1]) fallos.push(`cultivo ${c}/${s}/${st}: ${p.tris.join('/')} triángulos`); })));
  return {ok: fallos.length === 0, fallos, ...out};
}

/* ===================================================================================== */
/* DEMOSTRACIÓN: demo.html?m=escenario&vista=campo|arboles|cultivos|obstaculos|restos (&estacion=…&era=…&nieve=1&seed=…) */
function demoEscenario(cont) {
  const T3 = root.terreno3d; cont = cont || document.body; const q = new URLSearchParams(location.search), vista = q.get('vista') || 'campo', est = q.get('estacion') || 'verano', era = q.get('era') || 'D', nieve = !!q.get('nieve'), seed = +(q.get('seed') || 3);
  const plano = {height: () => 0, heightAt: () => 0}, rotulos = [];
  const suelo = (D, w, d, x, z, col) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshLambertMaterial({color: col || 0x6a7a4a})); m.rotation.x = -Math.PI / 2; m.position.set(x, -0.03, z); m.receiveShadow = true; D.escena.add(m); };
  const rotulo = (D, txt, x, y, z, k) => { const c = document.createElement('canvas'); c.width = 512; c.height = 64; const g = c.getContext('2d'); g.fillStyle = '#000a'; g.fillRect(0, 0, 512, 64); g.fillStyle = '#f0dfb4'; g.font = '28px Georgia'; g.textAlign = 'center'; g.fillText(txt, 256, 42);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({map: new THREE.CanvasTexture(c), depthTest: false})); s.scale.set(16 * (k || 1), 2 * (k || 1), 1); s.position.set(x, y, z); D.escena.add(s); };
  let D, T = null, E = null, extra = {};
  if (vista === 'arboles') {
    const filas = nieve ? ['invierno'] : ESTN, paso = 26; D = T3.baseDemo(cont, {cam: [ESPECIES.length * paso / 2, 60, filas.length * paso + 70], obj: [ESPECIES.length * paso / 2 - paso / 2, 8, filas.length * paso / 2], sombra: 200});
    suelo(D, ESPECIES.length * paso + 30, filas.length * paso + 30, ESPECIES.length * paso / 2 - paso / 2, filas.length * paso / 2 - paso / 2, nieve ? 0xe8ecf0 : 0x6a7a4a);
    E = crearEscenario(plano, {nieve, distLOD: [260, 700], arboles: [].concat(...filas.map((s, j) => ESPECIES.map((e, i) => ({especie: e, pos: [i * paso, j * paso], estacion: s, escala: 1}))))});
    ESPECIES.forEach((e, i) => rotulo(D, e, i * paso, 0.5, filas.length * paso - 10)); filas.forEach((s, j) => rotulo(D, s, -paso * 0.9, 0.5, j * paso));
  } else if (vista === 'cultivos') {
    const C5 = ['trigo', 'maiz', 'vinedo', 'patata', 'pradera'], ests = ['crecido', 'cosechado', 'arado'], W = 60, Dd = 46, gap = 12;
    D = T3.baseDemo(cont, {cam: [C5.length * (W + gap) / 2, 120, ests.length * (Dd + gap) + 110], obj: [C5.length * (W + gap) / 2, 0, ests.length * (Dd + gap) / 2], sombra: 260});
    suelo(D, C5.length * (W + gap) + 40, ests.length * (Dd + gap) + 40, C5.length * (W + gap) / 2, ests.length * (Dd + gap) / 2, 0x5a6a3e);
    E = crearEscenario(plano, {estacion: est, distLOD: [220, 600], cultivos: [].concat(...ests.map((st, j) => C5.map((c, i) => { const x = i * (W + gap) + gap / 2, z = j * (Dd + gap) + gap / 2; return {puntos: [[x, z], [x + W, z], [x + W, z + Dd], [x, z + Dd]], cultivo: c, estado: c === 'pradera' || c === 'vinedo' ? 'crecido' : st}; })))});
    C5.forEach((c, i) => rotulo(D, c, i * (W + gap) + gap / 2 + W / 2, 1, ests.length * (Dd + gap) + 6, 1.4)); ests.forEach((s, j) => rotulo(D, s, -14, 1, j * (Dd + gap) + gap / 2 + Dd / 2, 1.4));
  } else {
    // campo completo (o un recorte: obstáculos / restos) sobre el terreno real
    const C0 = [520, 420]; T = T3.crearTerreno({ancho: 1024, fondo: 768, semilla: seed, bioma: nieve ? 'nevado' : 'templado', relieve: vista === 'campo' ? 10 : 3});
    const rio = {puntos: [[700, 0], [720, 200], [705, 330], [740, 520], [760, 768]], ancho: 18}; T.excavarTrinchera(rio.puntos, rio.ancho, 4, {parapeto: 0});
    const def = escenarioMuestra(C0[0], C0[1], {semilla: seed, era, estacion: est, nieve, extra: {pontones: [{a: [C0[0] + 95, C0[1] + 136], b: [C0[0] + 96, C0[1] + 162]}, {a: [708 - 21, 300], b: [708 + 21, 300]}]}});
    E = crearEscenario(T, def); T.actualizar(C0[0], C0[1]);
    const agua = new THREE.Group(); for (let i = 0; i < rio.puntos.length - 1; i++) { const [ax, az] = rio.puntos[i], [bx, bz] = rio.puntos[i + 1], l = Math.hypot(bx - ax, bz - az), m = new THREE.Mesh(new THREE.PlaneGeometry(rio.ancho + 3, l + rio.ancho), mat('agua'));
      m.rotation.order = 'YXZ'; m.rotation.y = Math.atan2(bx - ax, bz - az); m.rotation.x = -Math.PI / 2; m.position.set((ax + bx) / 2, E.superficies.find(s => s.tipo === 'pontones') ? E.superficies.find(s => s.tipo === 'pontones').nivelAgua : T.height(ax, az) + 1, (az + bz) / 2); agua.add(m); }
    D = T3.baseDemo(cont, {cam: [C0[0] + 120, 120, C0[1] + 260], obj: [C0[0], 5, C0[1]], sombra: 420}); D.escena.add(T.grupo, agua);
    if (vista === 'obstaculos') D.mirar([C0[0] - 40, T.height(C0[0] - 40, C0[1] + 10), C0[1] + 10], 0.5, 80, 0.45); if (vista === 'restos') D.mirar([C0[0] - 40, T.height(C0[0] - 40, C0[1] - 25), C0[1] - 25], 0.3, 45, 0.5);
    // figuras de los restos con troops3d (si están cargados infanteria3d, caballeria3d y artilleria3d)
    const TT = root.Troops3D; if (TT && root.infanteria3d && root.caballeria3d && root.artilleria3d) { try { root.infanteria3d.registrar(TT); root.caballeria3d.registrar(TT); root.artilleria3d.registrar(TT);
      const sh = new TT.TroopShared(['FRA', 'GER', 'PRU', 'GBR', 'RUS', 'AUT', 'USA', 'GEN']), F = poblarFiguras(E.figuras, TT, sh); D.escena.add(F.grupo); extra.figuras = F; } catch (e) { console.warn('figuras de restos', e); } }
    extra.T = T;
  }
  if (nieve && D.escena.background) { D.escena.background.setHex(0xd8dde2); D.escena.fog.color.setHex(0xd8dde2); }
  D.escena.add(E.grupo); if (q.get('mirar')) { const v = q.get('mirar').split(',').map(Number); D.mirar([v[0], v[1], v[2]], v[3], v[4], v[5]); }
  D.bucle((t, cam) => { if (T) T.actualizar(cam.position.x, cam.position.z); E.actualizar(t); E.update(cam); });
  return Object.assign({D, E, T}, extra);
}

root.escenario3d = {crearEscenario, crearArbol, arbol, generarRestos, poblarFiguras, escenarioMuestra, ESPECIES, PAL, MEZCLA, CULTIVOS, ESTACIONES: ESTN, VIENTO, PRESUP_ARBOL, PRESUP_PIEZA, pruebaEscenario, demoEscenario,
  _util: {Geo, INST, rng, recorrer, largo, enS}};
})(typeof window !== 'undefined' ? window : globalThis);
