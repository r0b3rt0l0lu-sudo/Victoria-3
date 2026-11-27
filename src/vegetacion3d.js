/* ===== vegetacion3d.js — vegetación, rocas y campos para la batalla 3D de Victoria (three.js r152, todo procedural) =====
   · Hierba: matas en instancias alrededor de la cámara (celdas deterministas: no «nadan» al moverse), 3 LOD por distancia
     (7 hojas, 3 hojas, nada) y viento en el shader de vértices con rachas.
   · Árboles: roble, haya, pino, abedul, álamo y olivo. LOD0 (tronco, ramas y copa por grupos de follaje), LOD1 (≈ 60 triángulos)
     e impostor (cartel cilíndrico con la silueta horneada del LOD0, o pintada en un lienzo si no hay renderizador). Viento en la copa.
   · Arbustos, setos (a lo largo de una polilínea), 8 rocas (canto, canto anguloso, losa, afloramiento, roca partida, peña, grupo de
     cantos, roca musgosa), troncos caídos, campos de cultivo con surcos (crecido, cosechado con gavillas, arado), cráteres y huellas.
   · Variación por instancia (escala, color, giro), por bioma (templado, mediterráneo, boreal, estepa, nevado, desierto) y estación.
   · Cada objeto colocado devuelve sus datos de colisión y cobertura: {tipo, pos, radio, alto, cubre: 'pie'|'rodilla'|'tumbado'|'nada',
     bloquea (0–1: fracción de balas que para), blando}.
   Unidades: u del campo (1 u ≈ 0,6 m; medidas internas en metros). Ejes: x derecha, y arriba, z hacia el espectador.
   API: crearArbol(especie, op) · crearRoca(tipo, semilla, op) · crearVegetacion(op) → V {grupo, objetos, actualizar(cam, t), hierba, stats()}
        ESPECIES · ROCAS · pruebaVegetacion() · demoVegetacion(cont) */
(function (root) {
'use strict';
const THREE = root.THREE;
function rng(seed) { let a = (seed >>> 0) || 1; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function h2(i, j, s) { let h = Math.imul(i, 374761393) + Math.imul(j, 668265263) + Math.imul(s | 0, 2147483647); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
function n3(x, y, z, s) { const i = Math.floor(x), j = Math.floor(y), k = Math.floor(z), fx = x - i, fy = y - j, fz = z - k, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), w = fz * fz * (3 - 2 * fz);
  const H = (a, b, c) => h2(a * 7 + c * 131, b, s); const L = (a, b, t) => a + (b - a) * t;
  return L(L(L(H(i, j, k), H(i + 1, j, k), u), L(H(i, j + 1, k), H(i + 1, j + 1, k), u), v), L(L(H(i, j, k + 1), H(i + 1, j, k + 1), u), L(H(i, j + 1, k + 1), H(i + 1, j + 1, k + 1), u), v), w); }
const lerp = (a, b, t) => a + (b - a) * t;

/* ---------- fusión de geometrías con color por vértice y peso de balanceo (0 tronco firme … 1 hoja suelta) ---------- */
function Malla() { this.p = []; this.n = []; this.c = []; this.b = []; }
Malla.prototype.add = function (geo, col, bal, mat, colorFn) {
  if (!geo.attributes.normal) geo.computeVertexNormals(); const g = geo.index ? geo.toNonIndexed() : geo.clone(); if (mat) g.applyMatrix4(mat);
  const P = g.attributes.position, N = g.attributes.normal, c = new THREE.Color(col), t = new THREE.Color();
  for (let i = 0; i < P.count; i++) { const x = P.getX(i), y = P.getY(i), z = P.getZ(i); this.p.push(x, y, z); this.n.push(N.getX(i), N.getY(i), N.getZ(i));
    if (colorFn) { colorFn(t.copy(c), x, y, z, N.getY(i)); this.c.push(t.r, t.g, t.b); } else this.c.push(c.r, c.g, c.b);
    this.b.push(typeof bal === 'function' ? bal(x, y, z) : (bal || 0)); }
  return this;
};
Malla.prototype.geo = function () { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3)); g.setAttribute('balanceo', new THREE.Float32BufferAttribute(this.b, 1)); g.computeBoundingSphere(); return g; };
const M4 = (x, y, z, rx, ry, rz, sx, sy, sz) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx || 0, ry || 0, rz || 0)), new THREE.Vector3(sx || 1, sy == null ? (sx || 1) : sy, sz == null ? (sx || 1) : sz));
// follaje: icosaedro deformado con ruido; sombreado falso (más claro arriba, oscuro abajo y dentro)
function follaje(r, det, s, aplanar) { const g = new THREE.IcosahedronGeometry(r, det); const P = g.attributes.position;
  for (let i = 0; i < P.count; i++) { const x = P.getX(i), y = P.getY(i), z = P.getZ(i), k = 0.72 + 0.55 * n3(x * 1.3 + s, y * 1.3, z * 1.3, s); P.setXYZ(i, x * k, y * k * (aplanar || 1), z * k); }
  const N = new Float32Array(P.count * 3); for (let i = 0; i < P.count; i++) { const x = P.getX(i), y = P.getY(i) / (aplanar || 1) + r * 0.25, z = P.getZ(i), l = Math.hypot(x, y, z) || 1; N[i * 3] = x / l; N[i * 3 + 1] = y / l; N[i * 3 + 2] = z / l; }
  g.setAttribute('normal', new THREE.BufferAttribute(N, 3)); return g; }   // normales esféricas: copa mullida, sin facetas
const sombraCopa = (cy, rr) => (t, x, y, z, ny) => { const f = 0.62 + 0.38 * Math.min(1, Math.max(0, (y - cy + rr) / (2 * rr))) + ny * 0.12; t.multiplyScalar(Math.min(1.15, f)); };

/* ---------- especies ---------- */
const PAL = {   // [primavera, verano, otoño, invierno] del follaje; tronco
  roble: {hoja: [0x5a7a32, 0x3f5a2a, 0x8a6a2a, 0x5a4a3a], tronco: 0x4a3e32, caduco: 1},
  haya: {hoja: [0x6a8a36, 0x4a6a30, 0xa8622a, 0x6a4a34], tronco: 0x7a7670, caduco: 1},
  pino: {hoja: [0x2f4a2e, 0x2c462c, 0x2c442c, 0x2a402e], tronco: 0x6a4630},
  abedul: {hoja: [0x7a9a40, 0x6a8a3a, 0xc8a83a, 0x6a5a4a], tronco: 0xe0dcd2, caduco: 1},
  alamo: {hoja: [0x6a8a3a, 0x5a7a34, 0xc8b040, 0x6a5a46], tronco: 0x8a8478, caduco: 1},
  olivo: {hoja: [0x7a8a5a, 0x76865a, 0x748458, 0x728256], tronco: 0x5a5046}};
const ESTACION = {primavera: 0, verano: 1, otono: 2, otoño: 2, invierno: 3};
const ESPECIES = ['roble', 'haya', 'pino', 'abedul', 'alamo', 'olivo'];
const MEZCLA = {templado: {roble: 4, haya: 3, pino: 1, abedul: 1, alamo: 1}, mediterraneo: {olivo: 5, pino: 3, roble: 1, alamo: 1}, boreal: {pino: 6, abedul: 3, alamo: 1}, estepa: {abedul: 3, alamo: 3, pino: 1, roble: 1},
  nevado: {pino: 7, abedul: 2}, desierto: {olivo: 4, pino: 1}};

// crearArbol: devuelve {lod0, lod1, alto, radioCopa, radioTronco, color}; medidas en metros (la instancia escala a u)
function crearArbol(esp, op) {
  op = op || {}; const est = ESTACION[op.estacion || 'verano'] || 1, P = PAL[esp] || PAL.roble, r = rng(op.semilla || 7), nieve = op.nieve;
  const desnudo = P.caduco && est === 3, hoja = P.hoja[est];
  const L0 = new Malla(), L1 = new Malla();
  const cil = (r0, r1, h, n) => new THREE.CylinderGeometry(r1, r0, h, n, 1, true).translate(0, h / 2, 0);
  const corteza = esp === 'abedul' ? (t, x, y, z) => { if (n3(x * 5, y * 3.5, z * 5, 3) > 0.68) t.setHex(0x2a2622); } : (t, x, y, z) => { t.multiplyScalar(0.8 + 0.35 * n3(x * 8, y * 2, z * 8, 5)); };
  let alto, rc, rt;
  const copa = (M, cx, cy, cz, rr, det, ap, s) => { if (desnudo) { M.add(follaje(rr * 0.85, 0, s, ap), 0x4a3e34, 0.7, M4(cx, cy, cz), (t, x, y, z) => t.multiplyScalar(0.75 + 0.3 * n3(x, y, z, s))); return; }
    M.add(follaje(rr, det, s, ap), hoja, b => 0.6 + 0.4 * Math.min(1, Math.abs(b) / 6), M4(cx, cy, cz), sombraCopa(cy, rr * (ap || 1)));
    if (nieve && esp === 'pino') M.add(follaje(rr * 0.75, 0, s + 1, 0.4), 0xeef2f6, 0.6, M4(cx, cy + rr * 0.55, cz)); };
  const rama = (M, x0, y0, z0, len, ang, inc, rad) => { M.add(cil(rad, rad * 0.5, len, 5), P.tronco, 0.25, new THREE.Matrix4().makeTranslation(x0, y0, z0).multiply(new THREE.Matrix4().makeRotationY(ang)).multiply(new THREE.Matrix4().makeRotationZ(inc)), corteza); };
  switch (esp) {
    case 'roble': { alto = 11 + r() * 4; rt = 0.38; const ht = 3.4; L0.add(cil(rt, rt * 0.7, ht + 1, 8), P.tronco, 0, null, corteza); for (let k = 0; k < 4; k++) rama(L0, 0, ht, 0, 3.6, k * 1.6 + r(), -0.9 - r() * 0.3, 0.2);
      rc = 5.2; for (let k = 0; k < 7; k++) { const a = k * 0.9 + r(), d = k ? 2.6 + r() * 1.4 : 0; copa(L0, Math.cos(a) * d, ht + 3.6 + r() * 2.4 + (k ? 0 : 1.5), Math.sin(a) * d, 2.4 + r() * 0.9, 1, 0.85, k + 3); }
      L1.add(cil(rt, rt * 0.7, ht + 1, 4), P.tronco); copa(L1, 0, ht + 4.4, 0, 4.8, 0, 0.8, 9); break; }
    case 'haya': { alto = 17 + r() * 5; rt = 0.34; const ht = 6; L0.add(cil(rt, rt * 0.6, ht + 2, 8), P.tronco, 0, null, corteza); for (let k = 0; k < 3; k++) rama(L0, 0, ht, 0, 4, k * 2.1 + r(), -0.6, 0.16);
      rc = 4.6; for (let k = 0; k < 6; k++) { const a = k * 1.1 + r(), d = k ? 2.2 + r() : 0; copa(L0, Math.cos(a) * d, ht + 4 + k * 1.3 + r(), Math.sin(a) * d, 2.6 + r() * 0.8, 1, 1.1, k + 11); }
      L1.add(cil(rt, rt * 0.6, ht + 2, 4), P.tronco); copa(L1, 0, ht + 6, 0, 4.4, 0, 1.4, 19); break; }
    case 'pino': { alto = 16 + r() * 6; rt = 0.32; L0.add(cil(rt, 0.08, alto * 0.95, 7), P.tronco, 0, null, corteza); rc = 3.4;
      const piso = 6; for (let k = 0; k < piso; k++) { const t = k / piso, y = alto * (0.3 + t * 0.62), rr = rc * (1 - t * 0.82); const g = new THREE.ConeGeometry(rr, alto * 0.2, 8, 1, true); const Pg = g.attributes.position; for (let i = 0; i < Pg.count; i++) { const q = 0.85 + 0.3 * n3(Pg.getX(i) * 2, Pg.getY(i), Pg.getZ(i) * 2, k); Pg.setX(i, Pg.getX(i) * q); Pg.setZ(i, Pg.getZ(i) * q); }
        L0.add(g, hoja, 0.5 + t * 0.5, M4(0, y, 0, 0, k * 0.7), sombraCopa(y, alto * 0.1)); if (nieve) L0.add(new THREE.ConeGeometry(rr * 0.8, alto * 0.08, 8, 1, true), 0xeef2f6, 0.6, M4(0, y + alto * 0.07, 0)); }
      L1.add(cil(rt, 0.1, alto * 0.5, 4), P.tronco); L1.add(new THREE.ConeGeometry(rc, alto * 0.72, 6, 1, true), hoja, 0.6, M4(0, alto * 0.62, 0), sombraCopa(alto * 0.62, alto * 0.36)); break; }
    case 'abedul': { alto = 13 + r() * 4; rt = 0.2; const ht = 5; L0.add(cil(rt, 0.08, alto * 0.85, 7), P.tronco, 0, null, corteza); for (let k = 0; k < 5; k++) rama(L0, 0, ht + k * 1.2, 0, 2.6, k * 1.3 + r(), -1.0 - r() * 0.4, 0.07);
      rc = 3; for (let k = 0; k < 5; k++) { const a = k * 1.3 + r(), d = k ? 1.4 + r() : 0; copa(L0, Math.cos(a) * d, ht + 2.5 + k * 1.4, Math.sin(a) * d, 1.7 + r() * 0.5, 1, 1.25, k + 31); }
      L1.add(cil(rt, 0.1, alto * 0.7, 4), P.tronco); copa(L1, 0, ht + 5, 0, 2.9, 0, 1.6, 37); break; }
    case 'alamo': { alto = 20 + r() * 6; rt = 0.3; L0.add(cil(rt, 0.1, alto * 0.9, 7), P.tronco, 0, null, corteza); rc = 2.3;
      for (let k = 0; k < 6; k++) copa(L0, (r() - 0.5) * 0.8, alto * 0.3 + k * alto * 0.11, (r() - 0.5) * 0.8, 2.0 + r() * 0.5 - k * 0.12, 1, 1.5, k + 41);
      L1.add(cil(rt, 0.1, alto * 0.5, 4), P.tronco); copa(L1, 0, alto * 0.55, 0, 2.4, 0, 4.2, 47); break; }
    case 'olivo': { alto = 5.5 + r() * 2; rt = 0.42; rc = 3.6;
      for (let k = 0; k < 3; k++) { const a = k * 2.1 + r(); L0.add(cil(0.28, 0.16, 2.6, 6), P.tronco, 0, new THREE.Matrix4().makeRotationY(a).multiply(new THREE.Matrix4().makeRotationZ(0.25 + r() * 0.2)), (t, x, y, z) => t.multiplyScalar(0.7 + 0.5 * n3(x * 6, y * 6, z * 6, 9))); }
      for (let k = 0; k < 6; k++) { const a = k * 1.05 + r(), d = k ? 1.6 + r() * 1.2 : 0; copa(L0, Math.cos(a) * d, 3.2 + r() * 1.2, Math.sin(a) * d, 1.7 + r() * 0.6, 1, 0.7, k + 51); }
      L1.add(cil(0.35, 0.25, 2.8, 4), P.tronco); copa(L1, 0, 3.8, 0, 3.4, 0, 0.6, 57); break; }
  }
  return {especie: esp, lod0: L0.geo(), lod1: L1.geo(), alto, radioCopa: rc, radioTronco: rt, colorHoja: hoja};
}

/* ---------- rocas ---------- */
const ROCAS = ['canto', 'canto_anguloso', 'losa', 'afloramiento', 'roca_partida', 'pena', 'grupo', 'musgosa'];
const ROCA_COL = {templado: 0x8a8680, mediterraneo: 0xb0a490, boreal: 0x7a7a7c, estepa: 0x9a907e, nevado: 0x7a7c80, desierto: 0xb89a74};
function crearRoca(tipo, semilla, op) {
  op = op || {}; const r = rng(semilla || 1), base = new THREE.Color(ROCA_COL[op.bioma] || ROCA_COL.templado), M = new Malla(), musgo = new THREE.Color(0x4e6a34);
  const piedra = (rad, det, sx, sy, sz, ang, estratos, s) => { const g = new THREE.IcosahedronGeometry(rad, det), P = g.attributes.position;
    for (let i = 0; i < P.count; i++) { let x = P.getX(i), y = P.getY(i), z = P.getZ(i); const k = 0.78 + 0.45 * n3(x * 1.6 + s, y * 1.6, z * 1.6, s) * (ang ? 1.3 : 1); x *= k * sx; y *= k * sy; z *= k * sz;
      if (estratos) y = Math.round(y * estratos) / estratos + (y - Math.round(y * estratos) / estratos) * 0.3; P.setXYZ(i, x, y, z); } return g; };
  const pinta = (mus) => (t, x, y, z, ny) => { t.copy(base).multiplyScalar(0.72 + 0.4 * n3(x * 2.2, y * 2.2, z * 2.2, 13) + Math.max(-0.15, y * 0.05)); if (ny > 0.55 && n3(x * 1.4, y, z * 1.4, 17) > 0.5 - (mus || 0)) t.lerp(musgo, 0.55 + (mus || 0) * 0.3); if (y < 0.15) t.multiplyScalar(0.7); };
  let alto = 1, radio = 1, blanda = false;
  switch (tipo) {
    case 'canto': { const s = 0.8 + r() * 0.8; M.add(piedra(s, 2, 1, 0.72, 0.9, false, 0, 1), base, 0, M4(0, s * 0.45, 0), pinta()); alto = s * 1.15; radio = s * 0.95; break; }
    case 'canto_anguloso': { const s = 0.9 + r() * 0.9; const g = piedra(s, 1, 1.1, 0.85, 0.9, true, 0, 2); M.add(g, base, 0, M4(0, s * 0.5, 0, 0, r() * 3), pinta()); alto = s * 1.3; radio = s * 1.05; break; }
    case 'losa': { const s = 1.6 + r() * 1.2; M.add(piedra(s, 1, 1.2, 0.22, 0.9, true, 0, 3), base, 0, M4(0, s * 0.12, 0, (r() - 0.5) * 0.25, r() * 3, (r() - 0.5) * 0.3), pinta(0.1)); alto = s * 0.35; radio = s * 1.1; break; }
    case 'afloramiento': { const s = 2.2 + r() * 1.5; M.add(piedra(s, 2, 1.6, 0.55, 1, false, 2.2, 4), base, 0, M4(0, s * 0.18, 0, 0, r() * 3), pinta(0.15)); alto = s * 0.75; radio = s * 1.5; break; }
    case 'roca_partida': { const s = 1.1 + r() * 0.6; [-1, 1].forEach((sg, k) => { const g = piedra(s, 1, 0.55, 0.9, 0.95, true, 0, 5 + k); M.add(g, base, 0, M4(sg * s * 0.36, s * 0.55, 0, 0, 0, sg * 0.12), pinta()); }); alto = s * 1.5; radio = s; break; }
    case 'pena': { const s = 1.0 + r() * 0.5; M.add(piedra(s, 2, 0.9, 1.9, 0.8, true, 0, 6), base, 0, M4(0, s * 1.2, 0, 0, r() * 3, (r() - 0.5) * 0.15), pinta()); alto = s * 3; radio = s * 0.9; break; }
    case 'grupo': { let mx = 0; for (let k = 0; k < 4; k++) { const s = 0.3 + r() * 0.45, a = r() * 6.28, d = k ? 0.6 + r() * 0.8 : 0; M.add(piedra(s, 1, 1, 0.7, 0.9, k % 2 === 0, 0, 7 + k), base, 0, M4(Math.cos(a) * d, s * 0.4, Math.sin(a) * d), pinta()); mx = Math.max(mx, s); } alto = mx * 1.1; radio = 1.4; break; }
    default: { const s = 1 + r() * 0.7; M.add(piedra(s, 2, 1.1, 0.7, 1, false, 0, 8), base, 0, M4(0, s * 0.42, 0), pinta(0.35)); alto = s * 1.1; radio = s; }   // musgosa
  }
  return {tipo, geo: M.geo(), alto, radio, cubre: cubre(alto), bloquea: 1, blando: blanda};
}
function cubre(altoM) { return altoM >= 1.4 ? 'pie' : altoM >= 0.8 ? 'rodilla' : altoM >= 0.35 ? 'tumbado' : 'nada'; }

/* ---------- materiales con viento ---------- */
const VIENTO = {tiempo: {value: 0}, fuerza: {value: 0.6}, dir: {value: new THREE.Vector2(0.8, 0.6)}};
function matViento(op) {
  op = op || {}; const m = new THREE.MeshLambertMaterial({vertexColors: true, side: op.doble ? THREE.DoubleSide : THREE.FrontSide, alphaTest: op.alphaTest || 0, map: op.map || null, transparent: false});
  m.onBeforeCompile = sh => { sh.uniforms.uT = VIENTO.tiempo; sh.uniforms.uF = VIENTO.fuerza; sh.uniforms.uD = VIENTO.dir;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float balanceo; uniform float uT; uniform float uF; uniform vec2 uD;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
#ifdef USE_INSTANCING
  vec3 _ip = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
#else
  vec3 _ip = vec3(modelMatrix[3][0], modelMatrix[3][1], modelMatrix[3][2]);
#endif
  float _ph = dot(_ip.xz, vec2(0.071, 0.053));
  float _g = 0.55 + 0.45 * sin(uT * 0.35 + _ip.x * 0.004 + _ip.z * 0.003);        // rachas lentas que recorren el campo
  float _a = balanceo * uF * _g * (sin(uT * ${op.rapido ? '3.1' : '1.3'} + _ph) * 0.6 + sin(uT * ${op.rapido ? '5.3' : '2.7'} + _ph * 1.7) * 0.25 + 0.5);
  transformed.xz += uD * _a * ${(+(op.amp || 0.35)).toFixed(3)} * (position.y * ${(+(op.porAltura || 0.08)).toFixed(3)});`); };
  m.customProgramCacheKey = () => 'viento' + JSON.stringify(op).length + (op.rapido ? 'r' : '') + (op.amp || '') + (op.porAltura || '');
  return m;
}
// impostor: cartel que gira sobre su eje vertical hacia la cámara
function matImpostor(tex) {
  const m = new THREE.MeshLambertMaterial({map: tex, alphaTest: 0.5, side: THREE.DoubleSide});
  m.onBeforeCompile = sh => { sh.vertexShader = sh.vertexShader.replace('#include <project_vertex>', `
  vec4 _c = modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  float _sx = length(instanceMatrix[0].xyz), _sy = length(instanceMatrix[1].xyz);
  vec3 _cam = cameraPosition - _c.xyz; _cam.y = 0.0; _cam = normalize(_cam + vec3(1e-4, 0.0, 0.0));
  vec3 _der = vec3(_cam.z, 0.0, -_cam.x);
  vec4 mvPosition = viewMatrix * vec4(_c.xyz + _der * position.x * _sx + vec3(0.0, position.y * _sy, 0.0), 1.0);
  gl_Position = projectionMatrix * mvPosition;`).replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\n objectNormal = vec3(0.0, 1.0, 0.3);'); };
  m.customProgramCacheKey = () => 'impostor';
  return m;
}
// textura del impostor: horneada con el renderizador (si se da) o pintada en un lienzo
function texImpostor(arbol, renderer) {
  const W = 128, H = 256; let tex = null;
  if (renderer && root.document) try {
    const rt = new THREE.WebGLRenderTarget(W, H); const sc = new THREE.Scene(); sc.add(new THREE.HemisphereLight(0xffffff, 0x445533, 1.0)); const dl = new THREE.DirectionalLight(0xffffff, 0.9); dl.position.set(-1, 2, 2); sc.add(dl);
    sc.add(new THREE.Mesh(arbol.lod0, new THREE.MeshLambertMaterial({vertexColors: true})));
    const half = Math.max(arbol.radioCopa * 1.25, arbol.alto * 0.27), cam = new THREE.OrthographicCamera(-half, half, half * 2, 0, 0.1, 100); cam.position.set(0, 0, 40); cam.lookAt(0, 0, 0);
    const prev = renderer.getRenderTarget(), cc = renderer.getClearColor(new THREE.Color()), ca = renderer.getClearAlpha(); renderer.setRenderTarget(rt); renderer.setClearColor(0x000000, 0); renderer.clear(); renderer.render(sc, cam);
    const px = new Uint8Array(W * H * 4); renderer.readRenderTargetPixels(rt, 0, 0, W, H, px); renderer.setRenderTarget(prev); renderer.setClearColor(cc, ca); rt.dispose();
    tex = new THREE.DataTexture(px, W, H, THREE.RGBAFormat); tex.needsUpdate = true; tex.colorSpace = THREE.LinearSRGBColorSpace; /* el destino guarda color lineal */ tex.userData = {ancho: half * 2, alto: half * 2};
  } catch (e) { tex = null; }
  if (!tex && root.document) { const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d'), c = new THREE.Color(arbol.colorHoja);
    g.fillStyle = '#4a3a2c'; g.fillRect(W / 2 - 5, H * 0.55, 10, H * 0.45);
    for (let k = 0; k < 40; k++) { const a = Math.random() * 6.28, d = Math.random() * W * 0.32; g.fillStyle = `rgb(${c.r * 255 * (0.7 + Math.random() * 0.5) | 0},${c.g * 255 * (0.7 + Math.random() * 0.5) | 0},${c.b * 255 * (0.7 + Math.random() * 0.5) | 0})`; g.beginPath(); g.arc(W / 2 + Math.cos(a) * d, H * 0.35 + Math.sin(a) * d * 1.2, 14 + Math.random() * 10, 0, 6.28); g.fill(); }
    tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; const half = Math.max(arbol.radioCopa * 1.25, arbol.alto * 0.27); tex.userData = {ancho: half * 2, alto: half * 2}; }
  return tex;
}

/* ===================================================================================== */
function crearVegetacion(op) {
  op = Object.assign({semilla: 1, bioma: 'templado', estacion: 'verano', area: [0, 0, 1920, 840], alturaFn: () => 0, pesosFn: null, excluir: null, uPorMetro: 1 / 0.6,
    arboles: 600, bosques: null, rocas: 120, arbustos: 220, troncos: 25, setos: [], campos: [], crateres: [], huellas: [], renderer: null,
    distLOD: [140, 480], hierba: {radio: [70, 150], celda: 6, densidad: 9}}, op || {});
  const r = rng(op.semilla), Mu = op.uPorMetro, H = op.alturaFn, [x0, z0, x1, z1] = op.area, nieve = op.bioma === 'nevado' || (op.bioma === 'boreal' && op.estacion === 'invierno');
  const grupo = new THREE.Group(); grupo.name = 'vegetacion3d'; const objetos = [];
  const dentro = (x, z, P) => { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [xi, zi] = P[i], [xj, zj] = P[j]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) c = !c; } return c; };
  const okSuelo = (x, z) => { if (op.excluir && op.excluir(x, z)) return false; if (op.campos.some(c => dentro(x, z, c.puntos))) return false; if (op.pesosFn) { const w = op.pesosFn(x, z); if (w && (w.camino > 0.3 || w.roca > 0.6)) return false; } return true; };
  /* --- árboles: bosques (manchas) + sueltos --- */
  const mezcla = MEZCLA[op.bioma] || MEZCLA.templado, ponderada = () => { const e = Object.entries(mezcla); let s = 0; e.forEach(([, w]) => s += w); let x = r() * s; for (const [k, w] of e) { if ((x -= w) <= 0) return k; } return e[0][0]; };
  const bosques = op.bosques || Array.from({length: 3 + Math.floor(r() * 3)}, () => ({centro: [lerp(x0, x1, 0.1 + r() * 0.8), lerp(z0, z1, 0.1 + r() * 0.8)], radio: 60 + r() * 90}));
  const arboles = [];
  for (let k = 0; k < op.arboles; k++) {
    let x, z; if (r() < 0.75 && bosques.length) { const b = bosques[Math.floor(r() * bosques.length)], a = r() * 6.28, d = Math.sqrt(r()) * b.radio; x = b.centro[0] + Math.cos(a) * d; z = b.centro[1] + Math.sin(a) * d * 0.8; } else { x = lerp(x0, x1, r()); z = lerp(z0, z1, r()); }
    if (x < x0 || x > x1 || z < z0 || z > z1 || !okSuelo(x, z)) continue; const esp = ponderada(), s = 0.75 + r() * 0.5;
    arboles.push({esp, x, z, y: H(x, z) - 0.2, s, ry: r() * 6.28, tinte: 0.85 + r() * 0.3});
  }
  const tipos = {}; ESPECIES.forEach(e => { if (arboles.some(a => a.esp === e)) tipos[e] = crearArbol(e, {estacion: op.estacion, semilla: op.semilla + e.length, nieve}); });
  const matA = matViento({amp: 0.25, porAltura: 0.06}), IA = {};
  Object.entries(tipos).forEach(([e, A]) => {
    const n = arboles.filter(a => a.esp === e).length; const tex = texImpostor(A, op.renderer);
    const imp = new THREE.PlaneGeometry(1, 2); imp.translate(0, 1, 0);
    const im0 = new THREE.InstancedMesh(A.lod0, matA, n), im1 = new THREE.InstancedMesh(A.lod1, matA, n), im2 = new THREE.InstancedMesh(imp, tex ? matImpostor(tex) : new THREE.MeshLambertMaterial({color: A.colorHoja}), n);
    [im0, im1, im2].forEach((m, l) => { m.count = 0; m.castShadow = l < 2; m.receiveShadow = l < 2; m.frustumCulled = false; m.name = `arbol_${e}_lod${l}`; grupo.add(m); });
    IA[e] = {A, im: [im0, im1, im2], tex, lista: arboles.filter(a => a.esp === e)};
    IA[e].lista.forEach(a => objetos.push({tipo: 'arbol', especie: e, pos: [a.x, a.y, a.z], radio: A.radioTronco * a.s * Mu, alto: A.alto * a.s * Mu, cubre: 'pie', bloquea: 0.9, blando: false, copa: A.radioCopa * a.s * Mu}));
  });
  const _m = new THREE.Matrix4(), _c = new THREE.Color();
  function lodArboles(cx, cz) {
    Object.values(IA).forEach(({A, im, tex, lista}) => { const cnt = [0, 0, 0];
      lista.forEach(a => { const d = Math.hypot(a.x - cx, a.z - cz), l = d < op.distLOD[0] ? 0 : d < op.distLOD[1] ? 1 : 2, s = a.s * Mu;
        if (l < 2) _m.compose(new THREE.Vector3(a.x, a.y, a.z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, a.ry, 0)), new THREE.Vector3(s, s, s));
        else { const tw = tex ? tex.userData.ancho : A.radioCopa * 2.4, th = tex ? tex.userData.alto : A.alto; _m.makeScale(tw * s, th / 2 * s, 1).setPosition(a.x, a.y, a.z); }
        im[l].setMatrixAt(cnt[l], _m); im[l].setColorAt(cnt[l], _c.setScalar(a.tinte)); cnt[l]++; });
      im.forEach((m, l) => { m.count = cnt[l]; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }); });
  }
  /* --- rocas, arbustos, troncos --- */
  const rocasG = {}; const ponerInst = (geo, mat, lista, nombre, sombra) => { const im = new THREE.InstancedMesh(geo, mat, lista.length); lista.forEach((m, i) => im.setMatrixAt(i, m)); im.castShadow = sombra !== false; im.receiveShadow = true; im.name = nombre; grupo.add(im); return im; };
  const matR = new THREE.MeshLambertMaterial({vertexColors: true, flatShading: false});
  ROCAS.forEach((t, k) => { rocasG[t] = [0, 1].map(v => crearRoca(t, op.semilla * 13 + k * 7 + v, {bioma: op.bioma})); });
  const listaR = {};
  for (let k = 0; k < op.rocas; k++) { const x = lerp(x0, x1, r()), z = lerp(z0, z1, r()); if (op.excluir && op.excluir(x, z)) continue; const t = ROCAS[Math.floor(r() * ROCAS.length)], v = Math.floor(r() * 2), R = rocasG[t][v], s = (0.7 + r() * 0.7) * Mu, y = H(x, z) - 0.15 * s;
    (listaR[t + v] = listaR[t + v] || []).push(M4(x, y, z, 0, r() * 6.28, 0, s, s, s)); objetos.push({tipo: 'roca', subtipo: t, pos: [x, y, z], radio: R.radio * s, alto: R.alto * s, cubre: cubre(R.alto * s / Mu), bloquea: 1, blando: false}); }
  Object.entries(listaR).forEach(([k, L]) => ponerInst(rocasG[k.slice(0, -1)][+k.slice(-1)].geo, matR, L, 'roca_' + k));
  // arbustos
  const est = ESTACION[op.estacion] || 1, colA = [0x5a7a36, 0x4a6a30, 0x8a6a34, 0x5a4a3c][est];
  const arb = new Malla(); arb.add(follaje(1, 1, 3, 0.75), colA, 0.8, M4(0, 0.6, 0), sombraCopa(0.6, 0.8)); arb.add(follaje(0.7, 1, 5, 0.8), colA, 0.8, M4(0.6, 0.45, 0.3), sombraCopa(0.45, 0.6)); const arbG = arb.geo();
  const matB = matViento({amp: 0.4, porAltura: 0.25, rapido: true}), LA = [];
  for (let k = 0; k < op.arbustos; k++) { let x, z; if (r() < 0.6 && bosques.length) { const b = bosques[Math.floor(r() * bosques.length)], a = r() * 6.28, d = b.radio * (0.85 + r() * 0.35); x = b.centro[0] + Math.cos(a) * d; z = b.centro[1] + Math.sin(a) * d * 0.8; } else { x = lerp(x0, x1, r()); z = lerp(z0, z1, r()); }
    if (!okSuelo(x, z)) continue; const s = (0.7 + r() * 0.8) * Mu, y = H(x, z) - 0.1; LA.push(M4(x, y, z, 0, r() * 6.28, 0, s, s * (0.8 + r() * 0.4), s)); objetos.push({tipo: 'arbusto', pos: [x, y, z], radio: 1.1 * s, alto: 1.3 * s, cubre: 'rodilla', bloquea: 0.15, blando: true}); }
  if (LA.length) ponerInst(arbG, matB, LA, 'arbustos');
  // setos a lo largo de polilíneas (alto ≈ 1,8 m: tapan a un hombre de pie, paran ~50 % de las balas)
  if (op.setos.length) { const S = new Malla(); op.setos.forEach(P0 => { const P = P0.puntos || P0; for (let i = 0; i < P.length - 1; i++) { const [ax, az] = P[i], [bx, bz] = P[i + 1], L = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.round(L / (2.2 * Mu)));
      for (let k = 0; k < n; k++) { const t = (k + 0.5) / n, x = lerp(ax, bx, t), z = lerp(az, bz, t), y = H(x, z) - 0.2, ry = Math.atan2(-(bz - az), bx - ax);
        S.add(follaje(1, 1, k + i * 7, 0.9), colA, 0.5, M4(x, y + 0.9 * Mu, z, 0, ry, 0, 1.4 * Mu, 1.0 * Mu, 0.75 * Mu), sombraCopa(y + 0.9 * Mu, Mu)); }
      for (let t = 0; t < L; t += 1.4 * Mu) { const x = ax + (bx - ax) * t / L, z = az + (bz - az) * t / L, nx = -(bz - az) / L, nz = (bx - ax) / L;
        [-1, 1].forEach(sg => objetos.push({tipo: 'seto', pos: [x + nx * 1.2 * Mu * sg, H(x, z), z + nz * 1.2 * Mu * sg], radio: 0.7 * Mu, alto: 1.8 * Mu, cubre: 'pie', bloquea: 0.5, blando: true, protegeDe: [-nx * sg, -nz * sg]})); } } });
    const ms = new THREE.Mesh(S.geo(), matViento({amp: 0.15, porAltura: 0.1})); ms.castShadow = ms.receiveShadow = true; ms.name = 'setos'; grupo.add(ms); }
  // troncos caídos
  { const T = new Malla(); const corte = 0xb8a07a, corteza = 0x4a3e32;
    for (let k = 0; k < op.troncos; k++) { const x = lerp(x0, x1, r()), z = lerp(z0, z1, r()); if (!okSuelo(x, z)) continue; const L = (3 + r() * 4) * Mu, rad = (0.25 + r() * 0.2) * Mu, ry = r() * 6.28, y = H(x, z) + rad * 0.7;
      const g = new THREE.CylinderGeometry(rad * 0.85, rad, L, 8, 1, false); T.add(g, corteza, 0, M4(x, y, z, 0, ry, Math.PI / 2), (t, px, py, pz, ny) => { if (Math.abs(ny) > 0.9) t.setHex(corte); else t.multiplyScalar(0.75 + 0.4 * n3(px * 3, py * 3, pz * 3, 21)); });
      for (let b = 0; b < 2; b++) T.add(new THREE.CylinderGeometry(rad * 0.15, rad * 0.25, rad * 2.2, 5, 1, true), corteza, 0, M4(x + Math.cos(ry) * (r() - 0.5) * L * 0.6, y + rad * 1.1, z - Math.sin(ry) * (r() - 0.5) * L * 0.6, 0.4, r() * 6, 0.3));
      objetos.push({tipo: 'tronco', pos: [x, y, z], radio: L / 2, alto: rad * 2, largo: L, rot: ry, cubre: cubre(rad * 2 / Mu), bloquea: 0.9, blando: false}); }
    if (T.p.length) { const mt = new THREE.Mesh(T.geo(), new THREE.MeshLambertMaterial({vertexColors: true})); mt.castShadow = mt.receiveShadow = true; mt.name = 'troncos'; grupo.add(mt); } }
  // campos de cultivo: {puntos: [[x,z]×4] (rectángulo), cultivo: 'trigo'|'maiz'|'patata', estado: 'crecido'|'cosechado'|'arado'}
  op.campos.forEach((c, ci) => grupo.add(campo(c, ci)));
  function campo(c, ci) {
    const g = new THREE.Group(); g.name = 'campo_' + ci; const [A, B, , D] = c.puntos, ux = [B[0] - A[0], B[1] - A[1]], uz = [D[0] - A[0], D[1] - A[1]], Lx = Math.hypot(...ux), Lz = Math.hypot(...uz);
    const est2 = c.estado || (op.estacion === 'invierno' ? 'arado' : op.estacion === 'otono' || op.estacion === 'otoño' ? 'cosechado' : 'crecido'), cult = c.cultivo || 'trigo';
    const F = new Malla(), paso = 0.9 * Mu, nf = Math.floor(Lz / paso), ns = Math.max(2, Math.round(Lx / (2 * Mu))), tierra = 0x5a4632;
    for (let f = 0; f < nf; f++) { const t0 = f / nf, t1 = (f + 0.5) / nf, t2 = (f + 1) / nf, pos = [], col = [];
      for (let s = 0; s <= ns; s++) { const u = s / ns; [t0, t1, t2].forEach((t, k) => { const x = A[0] + ux[0] * u + uz[0] * t, z = A[1] + ux[1] * u + uz[1] * t; pos.push([x, H(x, z) + (k === 1 ? 0.22 * Mu : 0.02), z]); }); }
      const geo = new THREE.BufferGeometry(), arr = [];
      for (let s = 0; s < ns; s++) { const p = i => pos[s * 3 + i], q = i => pos[(s + 1) * 3 + i]; arr.push(...p(0), ...q(0), ...q(1), ...p(0), ...q(1), ...p(1), ...p(1), ...q(1), ...q(2), ...p(1), ...q(2), ...p(2)); }
      geo.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3)); F.add(geo, tierra, 0, null, (t, x, y, z, ny) => t.multiplyScalar(0.75 + 0.35 * ny + 0.15 * n3(x * 0.5, 0, z * 0.5, 31)));
    }
    const mf = new THREE.Mesh(F.geo(), new THREE.MeshLambertMaterial({vertexColors: true, side: THREE.DoubleSide})); mf.receiveShadow = true; g.add(mf);
    if (est2 !== 'arado') { const plant = new Malla(), cosecha = est2 === 'cosechado';
      const colP = cosecha ? 0xb8a060 : cult === 'trigo' ? (op.estacion === 'primavera' ? 0x6a8a3a : 0xc8a858) : cult === 'maiz' ? 0x5a7a30 : 0x4e6e34, hP = cosecha ? 0.15 : cult === 'maiz' ? 2.0 : cult === 'trigo' ? 0.9 : 0.45;
      [0, Math.PI / 2].forEach(a => { const q = new THREE.PlaneGeometry(0.6, hP, 1, 1); q.translate(0, hP / 2, 0); plant.add(q, colP, b => 0, M4(0, 0, 0, 0, a), (t, x, y) => t.multiplyScalar(0.7 + 0.5 * y / Math.max(0.1, hP))); });
      const pg = plant.geo(); pg.attributes.balanceo.array.forEach((_, i, arr2) => { arr2[i] = pg.attributes.position.getY(i) / Math.max(0.1, hP); });
      const L = []; for (let f = 0; f < nf; f++) for (let s = 0; s < Lx / (0.5 * Mu); s++) { const u = (s + 0.5) / (Lx / (0.5 * Mu)), t = (f + 0.5) / nf, x = A[0] + ux[0] * u + uz[0] * t, z = A[1] + ux[1] * u + uz[1] * t, k = h2(f, s, ci);
        L.push(M4(x, H(x, z) + 0.15 * Mu, z, 0, k * 6, 0, Mu * (0.8 + k * 0.4), Mu * (0.85 + k * 0.3), Mu)); }
      const im = new THREE.InstancedMesh(pg, matViento({amp: cult === 'maiz' ? 0.2 : 0.5, porAltura: 0.6, rapido: true, doble: true}), L.length); L.forEach((m, i) => im.setMatrixAt(i, m)); im.receiveShadow = true; im.name = 'cultivo'; g.add(im);
      if (cosecha) { const gav = new THREE.ConeGeometry(0.45, 1.3, 6); gav.translate(0, 0.65, 0); const LG = []; for (let k = 0; k < Math.floor(Lx * Lz / (90 * Mu * Mu)); k++) { const u = h2(k, 1, ci), t = h2(k, 2, ci), x = A[0] + ux[0] * u + uz[0] * t, z = A[1] + ux[1] * u + uz[1] * t; LG.push(M4(x, H(x, z), z, 0, 0, 0.1, Mu, Mu, Mu)); }
        const ig = new THREE.InstancedMesh(gav, new THREE.MeshLambertMaterial({color: 0xc8b070}), LG.length); LG.forEach((m, i) => ig.setMatrixAt(i, m)); ig.castShadow = true; ig.name = 'gavillas'; g.add(ig); } }
    objetos.push({tipo: 'campo', estado: est2, cultivo: cult, puntos: c.puntos, cubre: est2 === 'crecido' && cult === 'maiz' ? 'pie' : est2 === 'crecido' && cult === 'trigo' ? 'tumbado' : 'nada', bloquea: 0, blando: true, ocultaVista: est2 === 'crecido'});
    return g;
  }
  // cráteres de obús: malla de anillo con borde levantado (si el terreno se deformó con terreno3d, basta el anillo de tierra removida)
  op.crateres.forEach((c, k) => { const R0 = c.radio || 4 * Mu, g = new THREE.RingGeometry(R0 * 0.2, R0 * 1.5, 18, 3), P = g.attributes.position, col = [];
    g.rotateX(-Math.PI / 2); for (let i = 0; i < P.count; i++) { const x = P.getX(i) + c.pos[0], z = P.getZ(i) + c.pos[1], d = Math.hypot(P.getX(i), P.getZ(i)) / R0; P.setY(i, H(x, z) + 0.05 + (c.deformado ? 0 : (d < 1 ? -(1 - d * d) * (c.prof || 1.5) : 0.4 * Math.max(0, 1 - (d - 1) / 0.5)))); P.setX(i, x); P.setZ(i, z);
      const t = new THREE.Color(0x3a2e22).lerp(new THREE.Color(0x6a5a44), Math.min(1, d * 0.8)).multiplyScalar(0.8 + 0.4 * h2(i, k, 3)); col.push(t.r, t.g, t.b); }
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.computeVertexNormals(); const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({vertexColors: true, polygonOffset: true, polygonOffsetFactor: -2})); m.receiveShadow = true; m.name = 'crater'; grupo.add(m);
    objetos.push({tipo: 'crater', pos: [c.pos[0], H(c.pos[0], c.pos[1]), c.pos[1]], radio: R0, alto: -(c.prof || 1.5), cubre: 'tumbado', bloquea: 1, blando: false}); });
  // huellas: elipses oscuras pegadas al suelo a lo largo de recorridos
  if (op.huellas.length) { const q = new THREE.CircleGeometry(0.16, 6); q.scale(1, 1.8, 1); q.rotateX(-Math.PI / 2); const L = [];
    op.huellas.forEach(P => { for (let i = 0; i < P.length - 1; i++) { const [ax, az] = P[i], [bx, bz] = P[i + 1], len = Math.hypot(bx - ax, bz - az), ry = Math.atan2(bx - ax, bz - az), nx = (bz - az) / len, nz = -(bx - ax) / len;
      for (let t = 0, k = 0; t < len; t += 0.42 * Mu, k++) { const s = k % 2 ? 1 : -1, x = ax + (bx - ax) * t / len + nx * 0.14 * Mu * s, z = az + (bz - az) * t / len + nz * 0.14 * Mu * s; L.push(M4(x, H(x, z) + 0.03, z, 0, ry, 0, Mu, 1, Mu)); } } });
    const im = new THREE.InstancedMesh(q, new THREE.MeshBasicMaterial({color: 0x2a2018, transparent: true, opacity: 0.45, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3}), L.length); L.forEach((m, i) => im.setMatrixAt(i, m)); im.name = 'huellas'; grupo.add(im); }

  /* --- hierba alrededor de la cámara --- */
  const HB = op.hierba, colH = {templado: [0x5a7a32, 0x4e6e2c, 0x8a8a44, 0x6a6a4a], mediterraneo: [0x7a8a44, 0x8a8a4a, 0x9a8a52, 0x7a7a52], boreal: [0x4e6a34, 0x4a6432, 0x7a7444, 0x6a6a5a], estepa: [0x8a8a4a, 0x9a924e, 0xa89a5a, 0x8a8462], nevado: [0x6a7a4a, 0x6a7a4a, 0x7a7a5a, 0x9aa0a0], desierto: [0x9a8a5a, 0xa8986a, 0xa8986a, 0x9a8a62]}[op.bioma] || [0x5a7a32, 0x4e6e2c, 0x8a8a44, 0x6a6a4a];
  const mata = (n, hh) => { const M = new Malla(); for (let i = 0; i < n; i++) { const a = i / n * 6.28 + 0.3, ln = 0.08 + (i % 3) * 0.05, h = hh * (0.7 + (i % 4) * 0.12), g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute([-0.06, 0, 0, 0.06, 0, 0, Math.cos(a) * ln * 2, h, Math.sin(a) * ln * 2], 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute([0, 1, 0.2, 0, 1, 0.2, 0, 1, 0.2], 3)); M.add(g, colH[est], (x, y) => y / hh, M4(Math.cos(a) * ln, 0, Math.sin(a) * ln, 0, -a), (t, x, y) => t.multiplyScalar(0.55 + 0.7 * y / hh)); } return M.geo(); };
  const matH = matViento({amp: 0.9, porAltura: 1.0, rapido: true, doble: true}), hG = [mata(7, 0.5), mata(3, 0.45)], hIM = hG.map((g, l) => { const cap = l === 0 ? 9000 : 12000, m = new THREE.InstancedMesh(g, matH, cap); m.count = 0; m.frustumCulled = false; m.name = 'hierba_lod' + l; grupo.add(m); return m; });
  let ultimaHierba = null;
  function lodHierba(cx, cz) {
    if (!HB || nieve) return; const ce = HB.celda, R1 = HB.radio[1], R0 = HB.radio[0]; if (ultimaHierba && Math.hypot(cx - ultimaHierba[0], cz - ultimaHierba[1]) < ce * 0.5) return; ultimaHierba = [cx, cz];
    const cnt = [0, 0], i0 = Math.floor((cx - R1) / ce), i1 = Math.floor((cx + R1) / ce), j0 = Math.floor((cz - R1) / ce), j1 = Math.floor((cz + R1) / ce);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const ccx = (i + 0.5) * ce, ccz = (j + 0.5) * ce, d = Math.hypot(ccx - cx, ccz - cz); if (d > R1) continue; const l = d < R0 ? 0 : 1, n = l === 0 ? HB.densidad : Math.ceil(HB.densidad * 0.4);
      for (let k = 0; k < n; k++) { if (cnt[l] >= hIM[l].instanceMatrix.count) break; const x = i * ce + h2(i, j, k * 2 + 1) * ce, z = j * ce + h2(i, j, k * 2 + 2) * ce; if (x < x0 || x > x1 || z < z0 || z > z1) continue;
        if (op.pesosFn) { const w = op.pesosFn(x, z); if (w && (w.hierba < 0.45 || w.nieve > 0.4)) continue; } if (op.excluir && op.excluir(x, z)) continue;
        const s = Mu * (0.8 + h2(i, j, k + 50) * 0.7); _m.compose(new THREE.Vector3(x, H(x, z) - 0.05, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, h2(i, j, k + 70) * 6.28, 0)), new THREE.Vector3(s, s * (0.7 + h2(i, j, k + 90) * 0.8), s));
        hIM[l].setMatrixAt(cnt[l], _m); hIM[l].setColorAt(cnt[l], _c.setScalar(0.75 + h2(i, j, k + 110) * 0.5)); cnt[l]++; } }
    hIM.forEach((m, l) => { m.count = cnt[l]; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; });
  }
  let ultLOD = null;
  function actualizar(cam, t) {
    const cx = cam ? (cam.position ? cam.position.x : cam[0]) : (x0 + x1) / 2, cz = cam ? (cam.position ? cam.position.z : cam[1]) : (z0 + z1) / 2;
    if (t != null) VIENTO.tiempo.value = t;
    if (!ultLOD || Math.hypot(cx - ultLOD[0], cz - ultLOD[1]) > 12) { lodArboles(cx, cz); ultLOD = [cx, cz]; }
    lodHierba(cx, cz);
  }
  actualizar(null, 0);
  function stats() { let tri = 0; grupo.traverse(o => { if (!o.isMesh) return; const g = o.geometry, n = (g.index ? g.index.count : g.attributes.position.count) / 3; tri += o.isInstancedMesh ? n * o.count : n; });
    return {triangulos: Math.round(tri), arboles: arboles.length, especies: Object.keys(IA), rocas: objetos.filter(o => o.tipo === 'roca').length, objetos: objetos.length, hierba: hIM.map(m => m.count), llamadas: grupo.children.length}; }
  return {grupo, objetos, actualizar, stats, viento: VIENTO, arboles: IA, hierba: hIM};
}

/* ---------- prueba sin WebGL ---------- */
function pruebaVegetacion() {
  const out = {especies: {}, rocas: {}};
  ['verano', 'invierno'].forEach(e => ESPECIES.forEach(s => { const A = crearArbol(s, {estacion: e, semilla: 3}); out.especies[s + '_' + e] = [A.lod0.attributes.position.count / 3, A.lod1.attributes.position.count / 3, +A.alto.toFixed(1)]; }));
  ROCAS.forEach((t, k) => { const R = crearRoca(t, k + 1); out.rocas[t] = {tri: R.geo.attributes.position.count / 3, alto: +R.alto.toFixed(2), cubre: R.cubre}; });
  const V = crearVegetacion({area: [0, 0, 600, 400], arboles: 300, rocas: 60, arbustos: 80, troncos: 10, setos: [[[50, 50], [250, 60], [300, 140]]], campos: [{puntos: [[350, 200], [480, 200], [480, 300], [350, 300]], cultivo: 'trigo'}],
    crateres: [{pos: [200, 300], radio: 7}], huellas: [[[10, 10], [80, 40], [120, 120]]], alturaFn: (x, z) => Math.sin(x / 50) * 4 + Math.cos(z / 40) * 3});
  V.actualizar([300, 200], 1);
  out.escena = V.stats();
  const tiposObj = {}; V.objetos.forEach(o => { tiposObj[o.tipo] = (tiposObj[o.tipo] || 0) + 1; }); out.objetos = tiposObj;
  out.datosCompletos = V.objetos.every(o => o.tipo === 'campo' || (o.pos && o.pos.length === 3 && isFinite(o.alto) && o.cubre && o.bloquea != null));
  const lod0 = ESPECIES.map(s => out.especies[s + '_verano'][0]), lod1 = ESPECIES.map(s => out.especies[s + '_verano'][1]);
  out.ok = out.datosCompletos && Math.max(...lod0) < 2600 && Math.max(...lod1) < 300 && out.escena.hierba[0] > 0;
  return out;
}

/* ---------- demostración ---------- */
function demoVegetacion(cont) {
  const T3 = root.terreno3d, q = new URLSearchParams(location.search), bio = q.get('bioma') || 'templado', est = q.get('estacion') || 'verano';
  const D = T3.baseDemo(cont || document.body, {cam: [330, 60, 470], obj: [300, 12, 330], sombra: 260});
  const T = T3.crearTerreno({ancho: 800, fondo: 640, semilla: 4, bioma: bio, relieve: 14, caminos: [{puntos: [[0, 380], [260, 360], [520, 400], [800, 380]], ancho: 7}]});
  T.deformar(360, 300, 5, 2); T.deformar(380, 316, 4, 1.6);
  const V = crearVegetacion({semilla: 5, bioma: bio, estacion: est, area: [0, 0, 800, 640], alturaFn: T.heightAt, pesosFn: T.pesosEn, renderer: D.renderer, arboles: 700, rocas: 140, arbustos: 260,
    bosques: [{centro: [240, 200], radio: 110}, {centro: [560, 150], radio: 90}, {centro: [640, 520], radio: 80}],
    setos: [[[120, 420], [260, 430], [330, 470]], [[420, 430], [560, 440]]], campos: [{puntos: [[400, 450], [520, 450], [520, 560], [400, 560]], cultivo: 'trigo'}, {puntos: [[200, 470], [300, 470], [300, 560], [200, 560]], cultivo: 'trigo', estado: 'cosechado'}],
    crateres: [{pos: [360, 300], radio: 5, deformado: true}, {pos: [380, 316], radio: 4, deformado: true}], huellas: [[[300, 380], [330, 340], [345, 300]]]});
  T.actualizar(330, 330); D.escena.add(T.grupo, V.grupo);
  D.bucle((t, cam) => { T.actualizar(cam.position.x, cam.position.z); V.actualizar(cam, t); });
  return {T, V, D};
}

root.vegetacion3d = {crearArbol, crearRoca, crearVegetacion, ESPECIES, ROCAS, MEZCLA, VIENTO, pruebaVegetacion, demoVegetacion};
})(typeof window !== 'undefined' ? window : globalThis);
