/* ===== troops3d.js — tropas 3D procedurales y animadas para Victoria (three.js r152, sin archivos externos) =====
   Técnica: «rig rígido de partes» (≤ 20 partes por figura; cada vértice pertenece a una parte).
   · GPU (por defecto): las matrices de cada parte se hornean por clip y fotograma en una textura (huesos rígidos);
     el shader de vértices elige el fotograma con el tiempo y el desfase de cada instancia y mezcla dos clips (transición).
     Coste de CPU por fotograma ≈ 0 (un uniforme); 1 llamada de dibujo por tipo de figura, época y LOD.
   · CPU (reserva, ≤ 2000 figuras o sin texturas en el shader de vértices): una InstancedMesh por parte; cada fotograma
     se escriben las matrices instancia × parte a partir de las mismas poses horneadas (sin asignaciones).
   Color: cada vértice lleva una zona: 0 principal (casaca), 1 ribete, 2 pantalón/accesorio, 3 tocado, 4–6 bandera,
   7 vehículo, ≥ 8 fijo (color propio: piel, cuero, metal, madera). Las zonas 0–7 se leen de una textura de paletas
   (una fila por nación × época × papel); piel (4 tonos) y pelaje (4) se eligen por instancia.
   Variación por instancia: altura ±6 %, brillo ±8 %, piel, pelaje, desfase.
   LOD: 0 (cerca, detalle), 1 (medio, ≤ 60 tri por soldado), 2 (silueta ≤ 10 tri). Las tres usan el mismo esqueleto
   y la misma textura de animación, así que una figura puede cambiar de LOD sin perder la fase.
   API: TROOP_KINDS, TROOP_ERAS, buildTroop, poseTroop, blendPose, uniformPalette, troopStats, TroopShared, TroopBatch,
        TroopLodSet, CpuBatch, TROOP_GROUPS, clipInfo, clipPhase, eventsBetween, exportClipsJSON. */
(function (root) {
'use strict';
const THREE = root.THREE;
const D2R = Math.PI / 180;
const TROOP_ERAS = ['A', 'B', 'C', 'D', 'E'];
const MAXP = 20;                                     // partes máximas por figura (ancho de la textura = MAXP × 3 texeles)
const Z = {MAIN: 0, TRIM: 1, ACC: 2, HAT: 3, F1: 4, F2: 5, F3: 6, VEH: 7, M1: 8, M2: 9, M3: 10, VEH2: 11, FIX: 12};   // M1–M3: marca nacional; VEH2: segundo color de camuflaje
const V = {NONE: 0, SKIN: 1, HORSE: 2};
// colores fijos (Lambert, pensados para luz cálida del noroeste)
const C = {cuero: 0x5a3a22, cueroN: 0x26201c, correaB: 0xe8e2d0, madera: 0x7a5232, maderaO: 0x4e3420, acero: 0x8a9096, hierro: 0x3a3c40, laton: 0xc8a048,
  bota: 0x221d1a, mochila: 0x6a5238, manta: 0x8a7a62, piel: 0xe0b48c, crin: 0x2a2018, cuerda: 0xb8a070, lona: 0x8a8460, oruga: 0x4a4740,
  blanco: 0xece6d6, negro: 0x1e1c1c, panno: 0x5a4a3a, cobre: 0xa86a3a, mimbre: 0x8a7048, saco: 0xa89a74, tierra: 0x6a5a3c, rojo: 0xc02020,
  pluma: 0xf0ece0, oro: 0xd8b04a, bronce: 0x8a7a50, buey: 0xb8a284, bueyO: 0x5a4030};

/* ---------------- geometría procedural ---------------- */
const _cc = new THREE.Color();
function GeoBuilder() { this.p = []; this.n = []; this.part = []; this.zone = []; this.col = []; this.vr = []; this.fx = []; }
GeoBuilder.prototype.tri = function (a, b, c, part, zone, color, vr, fxa, fxb, fxc) {
  const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
  let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
  const cc = _cc.set(color || 0), r = cc.r, g = cc.g, bl = cc.b;   // hex sRGB → lineal (como THREE.Color con gestión de color)
  [a, b, c].forEach((q, i) => { this.p.push(q[0], q[1], q[2]); this.n.push(nx, ny, nz); this.part.push(part); this.zone.push(zone); this.col.push(r, g, bl); this.vr.push(vr || 0); const f = [fxa, fxb, fxc][i] || [0, 0]; this.fx.push(f[0], f[1]); });
};
GeoBuilder.prototype.quad = function (a, b, c, d, part, zone, color, vr, fx) { this.tri(a, b, c, part, zone, color, vr, fx && fx[0], fx && fx[1], fx && fx[2]); this.tri(a, c, d, part, zone, color, vr, fx && fx[0], fx && fx[2], fx && fx[3]); };
// transforma puntos locales: rotación Euler (grados, XYZ) y traslado
function xf(pts, at, rot) {
  if (!rot) return pts.map(q => [q[0] + at[0], q[1] + at[1], q[2] + at[2]]);
  const [rx, ry, rz] = rot.map(a => a * D2R), cx = Math.cos(rx), sx = Math.sin(rx), cy = Math.cos(ry), sy = Math.sin(ry), cz = Math.cos(rz), sz = Math.sin(rz);
  return pts.map(([x, y, z]) => {                    // R = Rx · Ry · Rz (como THREE.Euler 'XYZ')
    let x1 = x * cz - y * sz, y1 = x * sz + y * cz, z1 = z;
    let x2 = x1 * cy + z1 * sy, y2 = y1, z2 = -x1 * sy + z1 * cy;
    let x3 = x2, y3 = y2 * cx - z2 * sx, z3 = y2 * sx + z2 * cx;
    return [x3 + at[0], y3 + at[1], z3 + at[2]];
  });
}
// caja (w × h × d) con techo opcional y base opcional; o.taper estrecha la cara superior (0..1)
GeoBuilder.prototype.box = function (part, zone, color, at, size, o) {
  o = o || {}; const [w, h, d] = size, t = o.taper || 0, tz = o.taperZ != null ? o.taperZ : t, x0 = w / 2, z0 = d / 2, x1 = x0 * (1 - t), z1 = z0 * (1 - tz), y0 = -h / 2, y1 = h / 2, sk = o.skewZ || 0;
  const v = xf([[-x0, y0, z0], [x0, y0, z0], [x0, y0, -z0], [-x0, y0, -z0], [-x1, y1, z1 + sk], [x1, y1, z1 + sk], [x1, y1, -z1 + sk], [-x1, y1, -z1 + sk]], at, o.rot);
  const Q = (a, b, c, d) => this.quad(v[a], v[b], v[c], v[d], part, zone, color, o.vr);
  if (!o.noFront) Q(0, 1, 5, 4); Q(1, 2, 6, 5); if (!o.noBack) Q(2, 3, 7, 6); Q(3, 0, 4, 7);
  if (!o.noTop) Q(4, 5, 6, 7); if (o.bottom) Q(3, 2, 1, 0);
  return this;
};
// prisma/cilindro de n lados: r0 abajo, r1 arriba; tapas opcionales
GeoBuilder.prototype.cyl = function (part, zone, color, at, r0, r1, h, n, o) {
  o = o || {}; const pts = [], top = [], sx = o.sx || 1, sz = o.sz || 1, a0 = o.a0 != null ? o.a0 : Math.PI / n;
  for (let i = 0; i < n; i++) { const a = a0 + i / n * Math.PI * 2; pts.push([Math.cos(a) * r0 * sx, -h / 2, Math.sin(a) * r0 * sz]); top.push([Math.cos(a) * r1 * sx, h / 2, Math.sin(a) * r1 * sz]); }
  const vb = xf(pts, at, o.rot), vt = xf(top, at, o.rot), ct = xf([[0, h / 2 + (o.dome || 0), 0]], at, o.rot)[0], cb = xf([[0, -h / 2, 0]], at, o.rot)[0];
  for (let i = 0; i < n; i++) { const j = (i + 1) % n; if (r1 > 0 && r0 > 0) this.quad(vb[j], vb[i], vt[i], vt[j], part, zone, color, o.vr); else if (r1 > 0) this.tri(cb, vt[i], vt[j], part, zone, color, o.vr); else this.tri(vb[j], vb[i], ct, part, zone, color, o.vr); }
  if (o.top && r1 > 0) for (let i = 0; i < n; i++) { const j = (i + 1) % n; this.tri(vt[j], vt[i], ct, part, o.topZone != null ? o.topZone : zone, o.topColor != null ? o.topColor : color, o.vr); }
  if (o.bottom && r0 > 0) for (let i = 0; i < n; i++) { const j = (i + 1) % n; this.tri(vb[i], vb[j], cb, part, zone, color, o.vr); }
  return this;
};
// octaedro (manos, pomos, bolas pequeñas): 8 triángulos
GeoBuilder.prototype.octa = function (part, zone, color, at, r, o) {
  o = o || {}; const ry = o.ry || r, rz = o.rz || r;
  const v = xf([[r, 0, 0], [-r, 0, 0], [0, ry, 0], [0, -ry, 0], [0, 0, rz], [0, 0, -rz]], at, o.rot);
  [[4, 0, 2], [0, 5, 2], [5, 1, 2], [1, 4, 2], [0, 4, 3], [5, 0, 3], [1, 5, 3], [4, 1, 3]].forEach(([a, b, c]) => this.tri(v[a], v[b], v[c], part, zone, color, o.vr));
  return this;
};
// disco en el plano YZ (ruedas): n triángulos por cara; o.two = dos caras
GeoBuilder.prototype.disc = function (part, zone, color, at, r, n, o) {
  o = o || {}; const pts = []; for (let i = 0; i < n; i++) { const a = (i + 0.5) / n * Math.PI * 2; pts.push([0, Math.cos(a) * r, Math.sin(a) * r]); }
  const v = xf(pts, at, o.rot), c = at;
  for (let i = 0; i < n; i++) { const j = (i + 1) % n; this.tri(c, v[i], v[j], part, zone, color, o.vr); if (o.two) this.tri(c, v[j], v[i], part, zone, color, o.vr); }
  return this;
};
GeoBuilder.prototype.head = function (part, at, r, h, top) { return this.cyl(part, Z.FIX, C.piel, at, r * 0.86, r, h, 6, {top: top !== false, dome: r * 0.25, vr: V.SKIN}); };
// lámina (bandera, banderola). fx.x = distancia al asta (0..1) → peso de la ondulación del shader. o.two = dos caras
GeoBuilder.prototype.sheet = function (part, at, w, h, nx, ny, zoneFn, o) {
  o = o || {};
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const x0 = i / nx * w, x1 = (i + 1) / nx * w, y0 = -j / ny * h, y1 = -(j + 1) / ny * h, z = zoneFn(i, j);
    const P = (x, y) => xf([[x, y, 0]], at, o.rot)[0], W = x => [x / w, 0];
    const a = P(x0, y0), b = P(x1, y0), c = P(x1, y1), d = P(x0, y1);
    this.tri(a, d, c, part, z, C.blanco, 0, W(x0), W(x0), W(x1)); this.tri(a, c, b, part, z, C.blanco, 0, W(x0), W(x1), W(x1));
    if (o.two) { this.tri(a, c, d, part, z, C.blanco, 0, W(x0), W(x1), W(x0)); this.tri(a, b, c, part, z, C.blanco, 0, W(x0), W(x1), W(x1)); }
  }
  return this;
};
GeoBuilder.prototype.tris = function () { return this.p.length / 9; };
GeoBuilder.prototype.toGeometry = function (filter) {
  const g = new THREE.BufferGeometry(), keep = [];
  for (let t = 0; t < this.p.length / 9; t++) if (!filter || filter(this.zone[t * 3])) keep.push(t);
  const P = new Float32Array(keep.length * 9), N = new Float32Array(keep.length * 9), Pa = new Float32Array(keep.length * 3), Zo = new Float32Array(keep.length * 3), Co = new Float32Array(keep.length * 9), Vr = new Float32Array(keep.length * 3), Fx = new Float32Array(keep.length * 6);
  keep.forEach((t, k) => { for (let i = 0; i < 9; i++) { P[k * 9 + i] = this.p[t * 9 + i]; N[k * 9 + i] = this.n[t * 9 + i]; Co[k * 9 + i] = this.col[t * 9 + i]; } for (let i = 0; i < 3; i++) { Pa[k * 3 + i] = this.part[t * 3 + i]; Zo[k * 3 + i] = this.zone[t * 3 + i]; Vr[k * 3 + i] = this.vr[t * 3 + i]; } for (let i = 0; i < 6; i++) Fx[k * 6 + i] = this.fx[t * 6 + i]; });
  g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.BufferAttribute(N, 3)); g.setAttribute('color', new THREE.BufferAttribute(Co, 3));
  g.setAttribute('aPart', new THREE.BufferAttribute(Pa, 1)); g.setAttribute('aZone', new THREE.BufferAttribute(Zo, 1)); g.setAttribute('aVar', new THREE.BufferAttribute(Vr, 1)); g.setAttribute('aFx', new THREE.BufferAttribute(Fx, 2));
  g.computeBoundingSphere(); return g;
};

/* ---------------- esqueletos (jerarquía de partes) ---------------- */
// [nombre, padre, desplazamiento del pivote respecto al pivote del padre]
const RIGS = {
  soldado: [['pelvis', -1, [0, 0.90, 0]], ['torso', 0, [0, 0.06, 0]], ['cabeza', 1, [0, 0.50, 0]],
    ['brazoIz', 1, [0.235, 0.44, 0]], ['antebrazoIz', 3, [0, -0.29, 0]], ['brazoDe', 1, [-0.235, 0.44, 0]], ['antebrazoDe', 5, [0, -0.29, 0]],
    ['musloIz', 0, [0.095, -0.05, 0]], ['piernaIz', 7, [0, -0.42, 0]], ['musloDe', 0, [-0.095, -0.05, 0]], ['piernaDe', 9, [0, -0.42, 0]], ['arma', 6, [0, -0.27, 0.02]]],
  jinete: [['caballo', -1, [0, 1.12, 0]], ['cuello', 0, [0, 0.12, 0.62]], ['manoIz', 0, [0.16, -0.12, 0.5]], ['canaIz', 2, [0, -0.42, 0]], ['manoDe', 0, [-0.16, -0.12, 0.5]], ['canaDe', 4, [0, -0.42, 0]],
    ['pataIz', 0, [0.17, -0.06, -0.52]], ['corvIz', 6, [0, -0.44, 0]], ['pataDe', 0, [-0.17, -0.06, -0.52]], ['corvDe', 8, [0, -0.44, 0]], ['cola', 0, [0, 0.12, -0.72]],
    ['silla', 0, [0, 0.26, -0.02]], ['torso', 11, [0, 0.08, 0]], ['cabeza', 12, [0, 0.48, 0]], ['brazoIz', 12, [0.225, 0.42, 0]], ['brazoDe', 12, [-0.225, 0.42, 0]], ['antebrazoDe', 15, [0, -0.28, 0]], ['arma', 16, [0, -0.26, 0.02]]],
  canon: [['cureña', -1, [0, 0, 0]], ['tubo', 0, [0, 0.82, 0.25]], ['ruedaIz', 0, [0.62, 0.62, 0.15]], ['ruedaDe', 0, [-0.62, 0.62, 0.15]]],
  tanque: [['casco', -1, [0, 0, 0]], ['torreta', 0, [0, 1.56, 0.15]], ['canon', 1, [0, 0.3, 0.36]], ['orugaIz', 0, [0.66, 0, 0]], ['orugaDe', 0, [-0.66, 0, 0]]],
  markI: [['casco', -1, [0, 0, 0]], ['sponIz', 0, [1.62, 1.15, 0.2]], ['canonIz', 1, [0.22, 0.05, 0.45]], ['sponDe', 0, [-1.62, 1.15, 0.2]], ['canonDe', 3, [-0.22, 0.05, 0.45]], ['orugaIz', 0, [1.12, 0, 0]], ['orugaDe', 0, [-1.12, 0, 0]], ['ruedasCola', 0, [0, 0.6, -5.1]]],
  tiro: (() => {
    const r = [['caja', -1, [0, 0.9, 0]], ['ruedaDI', 0, [0.72, -0.35, 1.0]], ['ruedaDD', 0, [-0.72, -0.35, 1.0]], ['ruedaTI', 0, [0.72, -0.25, -1.0]], ['ruedaTD', 0, [-0.72, -0.25, -1.0]]];
    [1, 2].forEach(k => { const x = k === 1 ? 0.42 : -0.42, i = r.length; r.push(['an' + k, 0, [x, 0.22, 3.1]], ['an' + k + 'cu', i, [0, 0.12, 0.62]], ['an' + k + 'mi', i, [0.16, -0.12, 0.5]], ['an' + k + 'md', i, [-0.16, -0.12, 0.5]], ['an' + k + 'pi', i, [0.17, -0.06, -0.52]], ['an' + k + 'pd', i, [-0.17, -0.06, -0.52]]); });
    return r;
  })(),
  estatico: [['base', -1, [0, 0, 0]]]
};
function rigIndex(rig) { const m = {}; RIGS[rig].forEach((p, i) => { m[p[0]] = i; }); return m; }
