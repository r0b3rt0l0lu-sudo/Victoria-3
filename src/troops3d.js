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
    ['brazoIz', 1, [0.205, 0.435, 0]], ['antebrazoIz', 3, [0, -0.29, 0]], ['brazoDe', 1, [-0.205, 0.435, 0]], ['antebrazoDe', 5, [0, -0.29, 0]],
    ['musloIz', 0, [0.095, -0.05, 0]], ['piernaIz', 7, [0, -0.42, 0]], ['musloDe', 0, [-0.095, -0.05, 0]], ['piernaDe', 9, [0, -0.42, 0]], ['arma', 6, [0, -0.27, 0.02]], ['pieIz', 8, [0, -0.35, 0]], ['pieDe', 10, [0, -0.35, 0]]],
  jinete: [['caballo', -1, [0, 1.12, 0]], ['cuello', 0, [0, 0.12, 0.62]], ['manoIz', 0, [0.16, -0.12, 0.5]], ['canaIz', 2, [0, -0.42, 0]], ['manoDe', 0, [-0.16, -0.12, 0.5]], ['canaDe', 4, [0, -0.42, 0]],
    ['pataIz', 0, [0.17, -0.06, -0.52]], ['corvIz', 6, [0, -0.44, 0]], ['pataDe', 0, [-0.17, -0.06, -0.52]], ['corvDe', 8, [0, -0.44, 0]], ['cola', 0, [0, 0.12, -0.72]],
    ['silla', 0, [0, 0.26, -0.02]], ['torso', 11, [0, 0.08, 0]], ['cabeza', 12, [0, 0.48, 0]], ['brazoIz', 12, [0.2, 0.425, 0]], ['brazoDe', 12, [-0.2, 0.425, 0]], ['antebrazoDe', 15, [0, -0.28, 0]], ['arma', 16, [0, -0.26, 0.02]], ['testa', 1, [0, 0.49, 0.34]], ['antebrazoIz', 14, [0, -0.28, 0]]],
  canon: [['cureña', -1, [0, 0, 0]], ['tubo', 0, [0, 0.82, 0.25]], ['ruedaIz', 0, [0.62, 0.62, 0.15]], ['ruedaDe', 0, [-0.62, 0.62, 0.15]]],
  tanque: [['casco', -1, [0, 0, 0]], ['torreta', 0, [0, 1.56, 0.15]], ['canon', 1, [0, 0.3, 0.36]], ['orugaIz', 0, [0.66, 0, 0]], ['orugaDe', 0, [-0.66, 0, 0]]],
  markI: [['casco', -1, [0, 0, 0]], ['sponIz', 0, [1.62, 1.15, 0.2]], ['canonIz', 1, [0.22, 0.05, 0.45]], ['sponDe', 0, [-1.62, 1.15, 0.2]], ['canonDe', 3, [-0.22, 0.05, 0.45]], ['orugaIz', 0, [1.12, 0, 0]], ['orugaDe', 0, [-1.12, 0, 0]], ['ruedasCola', 0, [0, 0.6, -5.1]]],
  tiro: (() => {
    const r = [['caja', -1, [0, 0.9, 0]], ['ruedaDI', 0, [0.72, -0.35, 1.0]], ['ruedaDD', 0, [-0.72, -0.35, 1.0]], ['ruedaTI', 0, [0.72, -0.25, -1.0]], ['ruedaTD', 0, [-0.72, -0.25, -1.0]]];
    [1, 2].forEach(k => { const x = k === 1 ? 0.42 : -0.42, i = r.length; r.push(['an' + k, 0, [x, 0.22, 3.1]], ['an' + k + 'cu', i, [0, 0.12, 0.62]], ['an' + k + 'mi', i, [0.16, -0.12, 0.5]], ['an' + k + 'md', i, [-0.16, -0.12, 0.5]], ['an' + k + 'pi', i, [0.17, -0.06, -0.52]], ['an' + k + 'pd', i, [-0.17, -0.06, -0.52]]); });
    [1, 2].forEach(k => { const i = r.findIndex(q => q[0] === 'an' + k + 'cu'); r.push(['an' + k + 'te', i, [0, 0.49, 0.34]]); });
    return r;
  })(),
  estatico: [['base', -1, [0, 0, 0]]]
};
function rigIndex(rig) { const m = {}; RIGS[rig].forEach((p, i) => { m[p[0]] = i; }); return m; }

/* ---------------- uniformes ---------------- */
// Paleta por época: c = [principal (casaca/guerrera), ribete/vivos, pantalón, tocado]; toc = tocado; nota = fuente o aproximación.
// rol = variantes por papel (ligera, guardia, caballeria, artilleria, estado_mayor) que sustituyen la paleta de línea.
// Fuentes generales: Knötel, «Uniformenkunde» (1890–1921); Funcken, «L'uniforme et les armes des soldats du XIXe siècle»;
// Osprey Men-at-Arms (series por ejército). Donde la fuente no es concluyente o el uniforme variaba por regimiento se marca «aprox.».
const ROLES = ['linea', 'ligera', 'guardia', 'caballeria', 'artilleria', 'estado_mayor'];
const NACIONES = {
  GBR: {nombre: 'Reino Unido', bandera: 'union', veh: '#7a7652', f: ['#c8102e', '#1a3a8a', '#ffffff'],
    A: {c: ['#b8262c', '#f2f0e6', '#2e3240', '#1c1c1e'], toc: 'chaco', nota: 'Casaca escarlata, pantalón «Oxford mixture» azul grisáceo oscuro, chacó Albert (1844).'},
    B: {c: ['#b8262c', '#f2f0e6', '#262a3a', '#1c1c1e'], toc: 'chaco', nota: 'Túnica escarlata (1855), chacó de 1861. Enfield 1853 (avancarga rayado), Snider (1866) y Martini-Henry (1871).'},
    C: {c: ['#a8925e', '#8a7a4e', '#a8925e', '#e2d6b6'], toc: 'salacot', nota: 'Caqui de campaña colonial con salacot (1885–1902); en la metrópoli seguía la túnica roja con casco de servicio (no modelado). Lee-Metford/Lee-Enfield.'},
    D: {c: ['#8a7a52', '#6e6244', '#7e7050', '#6e6c4c'], toc: 'brodie', nota: 'Caqui Service Dress 1902; casco Brodie Mk I (1915–16).'},
    rol: {ligera: {A: {c: ['#23382a', '#1c1c1e', '#23382a', '#1c1c1e'], toc: 'chaco', nota: 'Rifle Brigade / 60th Rifles: verde oscuro, correaje negro.'}, B: {c: ['#23382a', '#1c1c1e', '#23382a', '#1c1c1e'], toc: 'chaco', nota: 'Rifles: verde oscuro.'}},
      guardia: {A: {c: ['#b8262c', '#1c2a5a', '#262a3a', '#1c1c1e'], toc: 'osos', nota: 'Foot Guards: gorro de piel de oso, vueltas azules.'}, B: {c: ['#b8262c', '#1c2a5a', '#262a3a', '#1c1c1e'], toc: 'osos', nota: 'Foot Guards.'}, C: {c: ['#b8262c', '#1c2a5a', '#262a3a', '#1c1c1e'], toc: 'osos', nota: 'Foot Guards (uniforme de parada; en campaña, caqui).'}},
      caballeria: {A: {c: ['#1e2a4a', '#d8b860', '#7a2a30', '#1c1c1e'], toc: 'colback', nota: 'Húsares: dolmán azul oscuro con alamares dorados; pantalón carmesí (11th Hussars). Aprox.: varía por regimiento.'}, B: {c: ['#1e2a4a', '#d8b860', '#7a2a30', '#1c1c1e'], toc: 'colback', nota: 'Húsares, aprox.'}},
      artilleria: {A: {c: ['#1e2a48', '#b8262c', '#1e2a48', '#1c1c1e'], toc: 'chaco', nota: 'Royal Artillery: azul oscuro, cuello rojo.'}, B: {c: ['#1e2a48', '#b8262c', '#1e2a48', '#1c1c1e'], toc: 'chaco', nota: 'Royal Artillery.'}},
      estado_mayor: {A: {c: ['#b8262c', '#d8b860', '#262a3a', '#1c1c1e'], toc: 'bicornio', nota: 'Generales: escarlata con bordado dorado y sombrero de dos picos (cocked hat).'}, B: {c: ['#b8262c', '#d8b860', '#262a3a', '#1c1c1e'], toc: 'bicornio', nota: 'Generales.'}}}},
  FRA: {nombre: 'Francia', bandera: 'vert', veh: '#7c8456', f: ['#1f3f8f', '#f2f0ea', '#c8202a'],
    A: {c: ['#2f4a9a', '#b8262c', '#b8262c', '#b8262c'], toc: 'kepi', nota: 'Casaca azul real, pantalón garance (rojo rubia, 1829). Chacó hasta 1845 y quepis en campaña (aprox.: se usa el quepis).'},
    B: {c: ['#2f4a9a', '#b8262c', '#b8262c', '#b8262c'], toc: 'kepi', nota: 'Túnica azul (1860), pantalón garance, quepis. Minié y Chassepot (1866).'},
    C: {c: ['#2f4a9a', '#b8262c', '#b8262c', '#b8262c'], toc: 'kepi', nota: 'Capote azul y pantalón garance hasta 1914. Lebel (1886).'},
    D: {c: ['#8aa0b6', '#6a8098', '#8aa0b6', '#8aa0b6'], toc: 'adrian', nota: 'Azul horizonte (1915), casco Adrian M1915. En 1914 aún pantalón rojo (no modelado).'},
    rol: {ligera: {A: {c: ['#1e2848', '#e0b830', '#3a4048', '#1e2848'], toc: 'kepi', nota: 'Chasseurs à pied: azul muy oscuro, vivos amarillo jonquille, pantalón gris hierro.'}, B: {c: ['#1e2848', '#e0b830', '#3a4048', '#1e2848'], toc: 'kepi', nota: 'Chasseurs à pied.'}, C: {c: ['#1e2848', '#e0b830', '#3a4048', '#1e2848'], toc: 'kepi', nota: 'Chasseurs à pied.'}},
      guardia: {B: {c: ['#2a3a78', '#f2f0e6', '#b8262c', '#1c1c1e'], toc: 'osos', nota: 'Granaderos de la Guardia Imperial (1854–1870): gorro de piel.'}, A: {c: ['#2f4a9a', '#b8262c', '#b8262c', '#b8262c'], toc: 'kepi', nota: 'Sin guardia entre 1830 y 1854: se usa la línea.'}},
      caballeria: {A: {c: ['#8ab0d8', '#f2f0e6', '#b8262c', '#b8262c'], toc: 'colback', nota: 'Húsares: dolmán azul celeste, pantalón garance. Aprox.: varía por regimiento.'}, B: {c: ['#8ab0d8', '#f2f0e6', '#b8262c', '#b8262c'], toc: 'colback', nota: 'Húsares, aprox.'}, C: {c: ['#8ab0d8', '#f2f0e6', '#b8262c', '#b8262c'], toc: 'kepi', nota: 'Húsares con quepis (1872+), aprox.'}},
      artilleria: {A: {c: ['#1e2848', '#b8262c', '#1e2848', '#1e2848'], toc: 'kepi', nota: 'Artillería: azul oscuro con vivos rojos.'}},
      estado_mayor: {A: {c: ['#1e2848', '#d8b860', '#b8262c', '#1c1c1e'], toc: 'bicornio', nota: 'Generales: azul oscuro con hojas de roble bordadas; bicornio de gala (aprox. en campaña).'}, B: {c: ['#1e2848', '#d8b860', '#b8262c', '#b8262c'], toc: 'kepi', nota: 'Generales: quepis con hojas de roble.'}}}},
  PRU: {nombre: 'Prusia / Alemania', bandera: 'horiz', veh: '#6c7258', f: ['#141414', '#f2f0ea', '#c8202a'],
    A: {c: ['#1e2a48', '#b8262c', '#2a2c34', '#1c1c1e'], toc: 'pickel', nota: 'Azul de Prusia, cuello rojo, pantalón gris oscuro; Pickelhaube desde 1842 (antes chacó). Fusil de aguja Dreyse (1841).'},
    B: {c: ['#1e2a48', '#b8262c', '#2a2c34', '#1c1c1e'], toc: 'pickel', nota: 'Igual; Dreyse M1841/62.'},
    C: {c: ['#1e2a48', '#b8262c', '#2a2c34', '#1c1c1e'], toc: 'pickel', nota: 'Azul de Prusia hasta 1910 (feldgrau adoptado en 1910). Gewehr 88 y 98. Bandera imperial negra-blanca-roja (1871).'},
    D: {c: ['#6f7462', '#5a5e50', '#6a6e60', '#5e6456'], toc: 'stahl', nota: 'Feldgrau; Stahlhelm M1916 (1914–15: Pickelhaube con funda).'},
    rol: {ligera: {A: {c: ['#2a4430', '#b8262c', '#2a2c34', '#1c1c1e'], toc: 'chaco', nota: 'Jäger: verde oscuro con chacó.'}, B: {c: ['#2a4430', '#b8262c', '#2a2c34', '#1c1c1e'], toc: 'chaco', nota: 'Jäger.'}, C: {c: ['#2a4430', '#b8262c', '#2a2c34', '#1c1c1e'], toc: 'chaco', nota: 'Jäger.'}},
      guardia: {A: {c: ['#1e2a48', '#f2f0e6', '#2a2c34', '#1c1c1e'], toc: 'pickel_pen', nota: 'Guardia: casco con penacho (Haarbusch) y galones blancos (Litzen).'}, B: {c: ['#1e2a48', '#f2f0e6', '#2a2c34', '#1c1c1e'], toc: 'pickel_pen', nota: 'Guardia.'}, C: {c: ['#1e2a48', '#f2f0e6', '#2a2c34', '#1c1c1e'], toc: 'pickel_pen', nota: 'Guardia.'}},
      caballeria: {A: {c: ['#1e1e22', '#f2f0e6', '#2a2c34', '#1c1c1e'], toc: 'colback', nota: 'Húsares «de la Muerte» (Totenkopf): negro con alamares blancos. Aprox.: uno de varios regimientos.'}, B: {c: ['#1e1e22', '#f2f0e6', '#2a2c34', '#1c1c1e'], toc: 'colback', nota: 'Húsares, aprox.'}, C: {c: ['#1e1e22', '#f2f0e6', '#2a2c34', '#1c1c1e'], toc: 'colback', nota: 'Húsares, aprox.'}},
      artilleria: {A: {c: ['#1e2a48', '#1c1c1e', '#2a2c34', '#1c1c1e'], toc: 'pickel', nota: 'Artillería: azul con cuello negro; casco con bola en lugar de pincho (no modelado).'}},
      estado_mayor: {A: {c: ['#1e2a48', '#b8262c', '#2a2c34', '#1c1c1e'], toc: 'pickel', nota: 'Generales: azul con cuello rojo y bordado dorado, franjas rojas en el pantalón.'}, D: {c: ['#6f7462', '#b8262c', '#6a6e60', '#5e6456'], toc: 'gorra', nota: 'Generales: feldgrau con cuello rojo y gorra de plato.'}}}},
  AUT: {nombre: 'Austria / Austria-Hungría', bandera: 'horiz', veh: '#6e705a', f: ['#c8202a', '#f2f0ea', '#c8202a'],
    A: {c: ['#e8e4d8', '#b8262c', '#e8e4d8', '#1c1c1e'], toc: 'chaco', nota: 'Casaca blanca con vueltas de color de regimiento (aprox.: rojo); pantalón blanco (alemanes) o azul celeste ceñido (húngaros); chacó.'},
    B: {c: ['#e8e4d8', '#b8262c', '#8aa6c8', '#1c1c1e'], toc: 'chaco', nota: 'Túnica blanca hasta 1868; pantalón azul celeste (aprox.). Lorenz (1854), Werndl (1867).'},
    C: {c: ['#2a3450', '#b8262c', '#8aa6c8', '#2a3450'], toc: 'kepi', nota: 'Túnica azul oscuro (1868), pantalón azul celeste; Feldkappe/chacó (aprox.: quepis). Mannlicher M1895.'},
    D: {c: ['#7f8c94', '#6c7880', '#7f8c94', '#5e6456'], toc: 'stahl', nota: 'Gris lucio (hechtgrau, 1909) y gris de campaña (1915); Stahlhelm alemán desde 1916.'},
    rol: {ligera: {A: {c: ['#5e6a6e', '#3a6a3a', '#5e6a6e', '#1c1c1e'], toc: 'sombrero', nota: 'Feldjäger: gris lucio con sombrero de ala y plumas de gallo (aprox.).'}, B: {c: ['#5e6a6e', '#3a6a3a', '#5e6a6e', '#1c1c1e'], toc: 'sombrero', nota: 'Feldjäger, aprox.'}, C: {c: ['#5e6a6e', '#3a6a3a', '#5e6a6e', '#1c1c1e'], toc: 'sombrero', nota: 'Feldjäger, aprox.'}},
      caballeria: {A: {c: ['#7a9ac0', '#d8b860', '#b8262c', '#1c1c1e'], toc: 'chaco', nota: 'Húsares: azul celeste y pantalón rojo, chacó (aprox.: varía por regimiento).'}},
      artilleria: {A: {c: ['#5a4a3a', '#b8262c', '#5a4a3a', '#1c1c1e'], toc: 'chaco', nota: 'Artillería: pardo con vivos rojos.'}, C: {c: ['#5a4a3a', '#b8262c', '#5a4a3a', '#5a4a3a'], toc: 'kepi', nota: 'Artillería: pardo.'}},
      estado_mayor: {A: {c: ['#e8e4d8', '#b8262c', '#b8262c', '#1c1c1e'], toc: 'bicornio', nota: 'Generales: blanco, pantalón rojo, bicornio con plumas verdes.'}}}},
  RUS: {nombre: 'Rusia', bandera: 'horiz', veh: '#6a6a50', f: ['#f2f0ea', '#1f3f9f', '#c8202a'],
    A: {c: ['#24402e', '#b8262c', '#24402e', '#1c1c1e'], toc: 'pickel', nota: 'Verde oscuro con vivos rojos; casco con pincho (modelo 1844), antes chacó (kíver).'},
    B: {c: ['#24402e', '#b8262c', '#24402e', '#24402e'], toc: 'kepi', nota: 'Verde oscuro; quepis (1862). Berdan (1868).'},
    C: {c: ['#24402e', '#b8262c', '#24402e', '#24402e'], toc: 'gorra_rusa', nota: 'Reforma de 1881: túnica verde oscuro y gorra sin visera; guerrera caqui verdoso desde 1907. Mosin-Nagant (1891).'},
    D: {c: ['#7a7650', '#6a6644', '#7a7650', '#7a7650'], toc: 'gorra_rusa', nota: 'Gimnastiorka caqui verdoso y gorra (furazhka); casco Adrian solo en algunas unidades (no modelado).'},
    rol: {caballeria: {A: {c: ['#24402e', '#d8b860', '#24402e', '#24402e'], toc: 'pickel', nota: 'Dragones / caballería: verde oscuro (aprox.).'}},
      estado_mayor: {A: {c: ['#24402e', '#d8b860', '#24402e', '#1c1c1e'], toc: 'bicornio', nota: 'Generales: bicornio con plumas hasta 1855.'}, B: {c: ['#24402e', '#d8b860', '#24402e', '#24402e'], toc: 'gorra', nota: 'Generales: gorra de plato.'}}}},
  TUR: {nombre: 'Imperio otomano', bandera: 'mono', veh: '#7c7448', f: ['#c81e2a', '#f2f0ea', '#c81e2a'],
    A: {c: ['#26305a', '#b8262c', '#26305a', '#b02020'], toc: 'fez', nota: 'Uniforme a la europea de la reforma de Mahmud II (1826+): azul oscuro con fez rojo.'},
    B: {c: ['#26305a', '#b8262c', '#26305a', '#b02020'], toc: 'fez', nota: 'Azul oscuro, fez. Snider y Martini-Peabody (1872).'},
    C: {c: ['#26305a', '#b8262c', '#26305a', '#b02020'], toc: 'fez', nota: 'Azul oscuro, fez; Mauser 1890/1903. Caqui desde 1909.'},
    D: {c: ['#7c7448', '#6a6440', '#7c7448', '#7c7448'], toc: 'kabalak', nota: 'Caqui oliva (1909), tocado kabalak («Enveriye»).'}},
  USA: {nombre: 'Estados Unidos', bandera: 'usa', veh: '#6a6a40', f: ['#b22234', '#f2f0ea', '#3c3b6e'],
    A: {c: ['#2a3458', '#f2f0e6', '#8aa6c8', '#2a3458'], toc: 'chaco', nota: 'Casaca azul oscuro, pantalón azul celeste; chacó (1832–51) o gorra de faena (aprox.).'},
    B: {c: ['#2a3458', '#f2f0e6', '#8aa6c8', '#2a3458'], toc: 'kepi', nota: 'Unión: blusa azul oscuro (sack coat), pantalón azul celeste, quepis (forage cap). Springfield 1861.'},
    C: {c: ['#2a3458', '#d8b860', '#8aa6c8', '#6a5a40'], toc: 'sombrero', nota: 'Blusa azul oscuro (hasta 1902) y sombrero de campaña; caqui desde 1898 (no modelado). Krag-Jørgensen (1892).'},
    D: {c: ['#6b6438', '#5a5430', '#6b6438', '#6a6a40'], toc: 'brodie', nota: 'Pardo oliva (olive drab), casco M1917 (derivado del Brodie). Springfield M1903.'}},
  CSA: {nombre: 'Estados Confederados', bandera: 'aspa', veh: '#6a6a40', f: ['#b22234', '#2a3c78', '#f2f0ea'],
    B: {c: ['#8c8c84', '#e8e4d8', '#8aa6c8', '#8c8c84'], toc: 'kepi', nota: 'Gris cadete (y «butternut» pardo en la práctica), quepis. Solo 1861–1865.'}},
  ESP: {nombre: 'España', bandera: 'horiz', veh: '#6a6a48', f: ['#aa151b', '#f1bf00', '#aa151b'],
    A: {c: ['#1e2848', '#b8262c', '#8a9098', '#1e2848'], toc: 'chaco', nota: 'Levita azul turquí, pantalón gris celeste; chacó/ros (aprox.).'},
    B: {c: ['#1e2848', '#b8262c', '#b8262c', '#1e2848'], toc: 'chaco', nota: 'Azul turquí y pantalón rojo (hacia 1860), ros. Remington (1871).'},
    C: {c: ['#9aa4b0', '#b8262c', '#9aa4b0', '#d8c890'], toc: 'sombrero', nota: 'Rayadillo (lienzo a rayas azul y blanco) con sombrero de jipijapa en Cuba y Filipinas; en la Península, azul turquí y pantalón rojo (no modelado). Mauser 1893.'},
    D: {c: ['#7a7450', '#6a6440', '#7a7450', '#7a7450'], toc: 'gorra', nota: 'Caqui verdoso (1926), gorra; casco Modelo 1926 (aprox.: se usa la gorra).'}},
  ITA: {nombre: 'Italia (Cerdeña-Piamonte)', bandera: 'vert', veh: '#6e6e50', f: ['#008c45', '#f2f0ea', '#cd212a'],
    A: {c: ['#1e2a4a', '#b8262c', '#7c8aa0', '#1e2a4a'], toc: 'chaco', nota: 'Cerdeña-Piamonte: azul oscuro, pantalón gris azulado; chacó (aprox.).'},
    B: {c: ['#1e2a4a', '#b8262c', '#7c8aa0', '#1e2a4a'], toc: 'kepi', nota: 'Azul oscuro y pantalón gris azulado, quepis. Vetterli (1870).'},
    C: {c: ['#1e2a4a', '#b8262c', '#7c8aa0', '#1e2a4a'], toc: 'kepi', nota: 'Igual; Carcano (1891).'},
    D: {c: ['#7a7c62', '#6a6c54', '#7a7c62', '#6c6e58'], toc: 'adrian', nota: 'Gris verde (grigio-verde, 1909), casco Adrian italiano M1916.'},
    rol: {ligera: {A: {c: ['#1e2a4a', '#b8262c', '#1e2a4a', '#1c1c1e'], toc: 'bersagliere', nota: 'Bersaglieri: sombrero redondo con plumas de gallo.'}, B: {c: ['#1e2a4a', '#b8262c', '#1e2a4a', '#1c1c1e'], toc: 'bersagliere', nota: 'Bersaglieri.'}, C: {c: ['#1e2a4a', '#b8262c', '#1e2a4a', '#1c1c1e'], toc: 'bersagliere', nota: 'Bersaglieri.'}}}},
  JPN: {nombre: 'Japón', bandera: 'disco', veh: '#6e6a48', f: ['#f2f0ea', '#bc002d', '#f2f0ea'],
    A: {c: ['#1e2238', '#b8262c', '#1e2238', '#1e2238'], toc: 'kepi', nota: 'Aprox.: antes de 1868 no hay ejército de estilo europeo; se usa el uniforme de 1870.'},
    B: {c: ['#1e2238', '#b8262c', '#1e2238', '#1e2238'], toc: 'kepi', nota: 'Ejército imperial (1871): azul oscuro a la francesa, quepis. Murata (1880).'},
    C: {c: ['#1e2238', '#b8262c', '#1e2238', '#1e2238'], toc: 'gorra', nota: 'Azul oscuro y gorra con banda roja; caqui desde 1905 (no modelado). Arisaka (1897).'},
    D: {c: ['#7a6e48', '#b8262c', '#7a6e48', '#7a6e48'], toc: 'gorra', nota: 'Pardo caqui (1905/1930) y gorra con estrella; casco Tipo 90 (1930, no modelado).'}},
  CHN: {nombre: 'China (Qing / República)', bandera: 'mono', veh: '#6a6e5a', f: ['#f0c020', '#2a4a9a', '#c81e2a'],
    A: {c: ['#2a3048', '#b8262c', '#2a3048', '#c8b070'], toc: 'qing', nota: 'Estandarte Verde / Ocho Banderas: chaqueta con parche circular, color según la bandera; sombrero cónico. Aprox.'},
    B: {c: ['#2a3048', '#b8262c', '#2a3048', '#c8b070'], toc: 'qing', nota: 'Igual (aprox.); fusiles importados.'},
    C: {c: ['#2a3048', '#b8262c', '#2a3048', '#2a3048'], toc: 'gorra', nota: 'Nuevo Ejército (1905): azul oscuro de estilo occidental con gorra.'},
    D: {c: ['#6a7480', '#5a6470', '#6a7480', '#6a7480'], toc: 'gorra', nota: 'República (1912+): gris azulado; casco M35 alemán desde 1935 (no modelado).'}},
  SWE: {nombre: 'Suecia', bandera: 'cruz', veh: '#6e7464', f: ['#006aa7', '#fecc00', '#006aa7'],
    A: {c: ['#1e2a50', '#e0b830', '#1e2a50', '#1c1c1e'], toc: 'chaco', nota: 'Azul oscuro con vivos amarillos; casco de cuero m/1845 (aprox.: chacó).'},
    B: {c: ['#1e2a50', '#e0b830', '#1e2a50', '#1e2a50'], toc: 'kepi', nota: 'Azul oscuro, quepis (m/1854–m/1886).'},
    C: {c: ['#1e2a50', '#e0b830', '#1e2a50', '#1e2a50'], toc: 'kepi', nota: 'm/1886 azul oscuro. Mauser m/1896.'},
    D: {c: ['#6e7464', '#5e6454', '#6e7464', '#5e6454'], toc: 'stahl', nota: 'Gris de campaña m/1910; casco m/1926 (aprox.: Stahlhelm).'}},
  DEN: {nombre: 'Dinamarca', bandera: 'cruz', veh: '#747a74', f: ['#c8102e', '#f2f0ea', '#c8102e'],
    A: {c: ['#232c48', '#b8262c', '#8ea4c4', '#232c48'], toc: 'kepi', nota: 'Desde 1848: guerrera azul oscuro, pantalón azul celeste, quepis. Antes de 1848, casaca roja (no modelado).'},
    B: {c: ['#232c48', '#b8262c', '#8ea4c4', '#232c48'], toc: 'kepi', nota: 'Igual (guerra de 1864).'},
    C: {c: ['#232c48', '#b8262c', '#8ea4c4', '#232c48'], toc: 'kepi', nota: 'Igual; Krag-Jørgensen (1889).'},
    D: {c: ['#747a74', '#646a64', '#747a74', '#646a64'], toc: 'gorra', nota: 'Gris (1915/1923) y gorra; casco M1923 (no modelado).'}},
  GEN: {nombre: 'Genérico teñible', bandera: 'horiz', veh: '#6a6c52', f: ['#8a3a2a', '#e8e0c8', '#2a4a7a'],
    A: {c: ['#5a6a3a', '#d8c890', '#4a4a50', '#1c1c1e'], toc: 'chaco', nota: 'Teñible: el principal es el color del país.'},
    B: {c: ['#5a6a3a', '#d8c890', '#4a4a50', '#5a6a3a'], toc: 'kepi', nota: 'Teñible.'},
    C: {c: ['#5a6a3a', '#d8c890', '#4a4a50', '#1c1c1e'], toc: 'pickel', nota: 'Teñible.'},
    D: {c: ['#6a6448', '#5a5440', '#646046', '#5e5c46'], toc: 'stahl', nota: 'Teñible.'}}
};
function eraOf(obj, era) {                          // la época pedida o la más cercana definida
  if (!obj) return null; if (obj[era]) return obj[era];
  const i = TROOP_ERAS.indexOf(era); for (let d = 1; d < 5; d++) { const a = TROOP_ERAS[i - d], b = TROOP_ERAS[i + d]; if (a && obj[a]) return obj[a]; if (b && obj[b]) return obj[b]; }
  return null;
}
// uniformPalette(nación, época, papel) → {main, trim, accessory, hat, flag, headgear, vehicle, note}
function uniformPalette(nation, era, rol) {
  const n = NACIONES[nation] || NACIONES.GEN, base = eraOf(n, era) || eraOf(NACIONES.GEN, era);
  const R = rol && rol !== 'linea' && n.rol && n.rol[rol];
  // un papel usa su época o la más cercana anterior a D; en D (caqui/gris de campaña) solo si la define: todos visten como la línea
  const r = R ? (R[era] || (era < 'D' ? eraOf({A: R.A, B: R.B, C: R.C}, era) : null)) : null;
  const e = r || base;
  const mk = e.marca || n.marca || {tipo: 'ninguna', c: ['#1c1c1c', '#e8e4d8', '#b02020']}, veh = e.veh || n.veh || '#6a6c52';
  return {main: e.c[0], trim: e.c[1], accessory: e.c[2], hat: e.c[3], flag: (e.f || n.f).slice(), flagLayout: e.bandera || n.bandera, headgear: e.toc, vehicle: veh, vehicle2: e.veh2 || veh, mark: mk.c.slice(), markType: mk.tipo, modelo: e.modelo || {}, note: e.nota || ''};
}

/* ---------------- figuras (LOD0) ---------------- */
GeoBuilder.prototype.tet = function (part, zone, color, at, r, o) {    // tetraedro: 4 triángulos (manos)
  o = o || {}; const v = xf([[0, r, 0], [r, -r * 0.6, r * 0.6], [-r, -r * 0.6, r * 0.6], [0, -r * 0.6, -r]], at, o.rot);
  [[0, 2, 1], [0, 1, 3], [0, 3, 2], [1, 2, 3]].forEach(([a, b, c]) => this.tri(v[a], v[b], v[c], part, zone, color, o.vr)); return this;
};
function visor(g, h, y, z, w) { w = w || 0.1; g.quad([-w, y, z], [w, y, z], [w * 0.9, y - 0.03, z + 0.08], [-w * 0.9, y - 0.03, z + 0.08], h, Z.FIX, C.cueroN); }
// tocados (cabeza: y de 0,005 a 0,255, radio 0,13). Zona HAT = color de tocado de la paleta; los de cuero/piel/metal son fijos.
function headgear(g, h, toc, o) {
  o = o || {}; const lite = o.lite, H = Z.HAT;
  switch (toc) {
    case 'chaco': g.cyl(h, H, 0, [0, 0.355, 0], 0.125, 0.15, 0.2, 6, {top: true}); visor(g, h, 0.26, 0.12);
      if (!lite) { g.quad([-0.035, 0.32, 0.148], [0.035, 0.32, 0.148], [0.035, 0.4, 0.144], [-0.035, 0.4, 0.144], h, Z.FIX, C.laton); g.cyl(h, Z.TRIM, 0, [0, 0.5, 0.06], 0.035, 0.0, 0.1, 4); } break;
    case 'kepi': g.cyl(h, Z.MAIN, 0, [0, 0.285, 0], 0.13, 0.135, 0.06, 6); g.cyl(h, H, 0, [0, 0.35, -0.01], 0.135, 0.12, 0.08, 6, {top: true, rot: [-8, 0, 0]}); visor(g, h, 0.26, 0.12); break;
    case 'pickel': case 'pickel_pen': g.cyl(h, Z.FIX, C.negro, [0, 0.31, 0], 0.148, 0.12, 0.14, 6, {top: true, dome: 0.05}); visor(g, h, 0.25, 0.13);
      if (toc === 'pickel') g.cyl(h, Z.FIX, C.laton, [0, 0.47, 0], 0.028, 0, 0.13, 4); else g.cyl(h, Z.FIX, C.pluma, [0, 0.5, 0], 0.05, 0.025, 0.2, 4);
      if (!lite) g.quad([-0.04, 0.27, 0.146], [0.04, 0.27, 0.146], [0.03, 0.36, 0.13], [-0.03, 0.36, 0.13], h, Z.FIX, C.laton); break;
    case 'brodie': g.cyl(h, H, 0, [0, 0.262, 0], 0.215, 0.14, 0.025, 6); g.cyl(h, H, 0, [0, 0.315, 0], 0.14, 0.07, 0.09, 6, {top: true}); break;
    case 'adrian': g.cyl(h, H, 0, [0, 0.262, 0], 0.175, 0.14, 0.03, 6, {sz: 1.18}); g.cyl(h, H, 0, [0, 0.33, 0], 0.14, 0.08, 0.1, 6, {top: true});
      g.quad([0.012, 0.37, 0.11], [0.012, 0.37, -0.11], [0.012, 0.42, -0.08], [0.012, 0.42, 0.08], h, H, 0); g.quad([-0.012, 0.37, -0.11], [-0.012, 0.37, 0.11], [-0.012, 0.42, 0.08], [-0.012, 0.42, -0.08], h, H, 0); break;
    case 'stahl': g.cyl(h, H, 0, [0, 0.3, 0], 0.16, 0.15, 0.15, 6, {top: true, dome: 0.05}); g.cyl(h, H, 0, [0, 0.21, -0.01], 0.18, 0.165, 0.06, 6); break;
    case 'gorra': g.cyl(h, Z.TRIM, 0, [0, 0.285, 0], 0.13, 0.13, 0.06, 6); g.cyl(h, H, 0, [0, 0.33, 0.01], 0.135, 0.17, 0.035, 6, {top: true}); visor(g, h, 0.265, 0.13); break;
    case 'gorra_rusa': g.cyl(h, H, 0, [0, 0.3, 0], 0.13, 0.15, 0.08, 6, {top: true}); visor(g, h, 0.265, 0.13); break;
    case 'salacot': g.cyl(h, H, 0, [0, 0.27, 0], 0.21, 0.15, 0.06, 6, {sz: 1.2}); g.cyl(h, H, 0, [0, 0.37, 0], 0.15, 0.06, 0.14, 6, {top: true}); break;
    case 'fez': g.cyl(h, H, 0, [0, 0.32, 0], 0.125, 0.1, 0.15, 6, {top: true}); g.quad([0.0, 0.39, 0.0], [0.0, 0.39, -0.01], [0.09, 0.28, -0.11], [0.09, 0.28, -0.1], h, Z.FIX, C.negro); break;
    case 'sombrero': g.cyl(h, H, 0, [0, 0.265, 0], 0.25, 0.15, 0.025, 6); g.cyl(h, H, 0, [0, 0.33, 0], 0.145, 0.11, 0.12, 6, {top: true, dome: -0.02}); break;
    case 'bersagliere': g.cyl(h, Z.FIX, C.negro, [0, 0.265, 0], 0.23, 0.14, 0.025, 6); g.cyl(h, Z.FIX, C.negro, [0, 0.31, 0], 0.14, 0.125, 0.07, 6, {top: true});
      g.box(h, Z.FIX, 0x203a20, [-0.13, 0.32, 0.0], [0.08, 0.26, 0.16], {rot: [0, 0, 55], taper: 0.4}); break;
    case 'osos': g.cyl(h, Z.FIX, C.negro, [0, 0.42, -0.005], 0.16, 0.15, 0.36, 6, {top: true, dome: 0.06}); break;
    case 'colback': g.cyl(h, Z.FIX, C.negro, [0, 0.36, 0], 0.13, 0.145, 0.22, 6, {top: true}); g.box(h, Z.TRIM, 0, [0.08, 0.4, -0.08], [0.06, 0.16, 0.06], {rot: [0, 0, -25]}); g.cyl(h, Z.TRIM, 0, [0, 0.53, 0.04], 0.03, 0, 0.12, 4); break;
    case 'casco_cor': case 'casco_dragon': {
      const m = toc === 'casco_cor' ? C.acero : C.laton;
      g.cyl(h, Z.FIX, m, [0, 0.31, 0], 0.148, 0.13, 0.15, 6, {top: true, dome: 0.06}); visor(g, h, 0.25, 0.13);
      g.box(h, Z.FIX, C.laton, [0, 0.42, -0.02], [0.04, 0.08, 0.26], {noBack: true, noFront: true});
      g.box(h, Z.FIX, C.negro, [0, 0.27, -0.2], [0.05, 0.34, 0.06], {rot: [-10, 0, 0], noTop: true}); break; }
    case 'czapka': g.cyl(h, H, 0, [0, 0.31, 0], 0.12, 0.13, 0.12, 6); g.box(h, H, 0, [0, 0.41, 0], [0.26, 0.08, 0.26], {taper: -0.15}); visor(g, h, 0.26, 0.12); break;
    case 'qing': g.cyl(h, H, 0, [0, 0.31, 0], 0.25, 0, 0.14, 6); g.cyl(h, Z.FIX, C.rojo, [0, 0.36, 0], 0.08, 0, 0.09, 4); break;
    case 'kabalak': g.cyl(h, H, 0, [0, 0.31, 0], 0.145, 0.155, 0.12, 6, {top: true, dome: 0.03}); break;
    case 'bicornio': g.box(h, Z.FIX, C.negro, [0, 0.34, 0], [0.44, 0.16, 0.1], {taper: 0.45, taperZ: 0.7}); g.cyl(h, Z.TRIM, 0, [0, 0.45, 0.02], 0.03, 0, 0.12, 4); break;
    default: headgearE(g, h, toc, o);
  }
  if (o.plumero) g.octa(h, Z.FIX, C.pluma, [0, 0.5, 0], 0.07, {ry: 0.12});
  if (o.penacho) g.cyl(h, Z.TRIM, 0, [0, 0.55, 0.02], 0.045, 0.02, 0.18, 4);
}
// armas. Las largas tienen el pivote en la culata (y = 0) y el eje +Y hacia la boca: las coloca la pista armaP/armaR y las manos van por IK.
function weapon(g, a, w, o) {
  o = o || {};
  switch (w) {
    case 'mosquete': case 'fusil': {
      const L = w === 'mosquete' ? 1.5 : 1.22, ls = w === 'mosquete' ? 0.5 : 0.45;
      g.box(a, Z.FIX, C.madera, [0, ls / 2, -0.01], [0.06, ls, 0.12], {taper: 0.3, taperZ: 0.55, noTop: true, bottom: true});
      g.box(a, Z.FIX, C.maderaO, [0, (ls + L) / 2, 0.012], [0.045, L - ls, 0.05]);
      if (w === 'mosquete' || o.bayoneta) { const yb = L, len = w === 'mosquete' ? 0.44 : 0.36; g.cyl(a, Z.FIX, C.acero, [0, yb + len / 2, 0.03], 0.02, 0, len, 3); }
      if (w === 'fusil') g.tet(a, Z.FIX, C.acero, [-0.035, ls + 0.05, 0.012], 0.03);   // cerrojo
      break; }
    case 'sable': g.octa(a, Z.FIX, C.laton, [0, 0.0, 0], 0.04, {ry: 0.05}); g.box(a, Z.FIX, 0xd8dce0, [0, 0.47, 0.02], [0.025, 0.86, 0.05], {taper: 0.6, rot: [6, 0, 0], noTop: true}); break;
    case 'espada': g.octa(a, Z.FIX, C.laton, [0, 0.0, 0], 0.045, {ry: 0.05}); g.box(a, Z.FIX, 0xd8dce0, [0, 0.43, 0], [0.025, 0.78, 0.05], {taper: 0.7, noTop: true}); break;
    case 'baston': g.cyl(a, Z.FIX, 0x2a3a8a, [0, 0.12, 0], 0.025, 0.025, 0.42, 4, {top: true}); break;
    case 'astil': {                                                  // asta del estandarte con la bandera nacional ondeante (zonas 4–6)
      g.cyl(a, Z.FIX, C.madera, [0, 1.45, 0], 0.018, 0.018, 2.9, 4); g.octa(a, Z.FIX, C.laton, [0, 2.96, 0], 0.045, {ry: 0.08});
      g.sheet(a, [0.02, 2.86, 0], 1.1, 0.76, 3, 3, flagZone(o.flagLayout)); break; }
    case 'lanza': g.cyl(a, Z.FIX, C.madera, [0, 0.55, 0], 0.016, 0.016, 2.9, 4); g.cyl(a, Z.FIX, C.acero, [0, 2.08, 0], 0.03, 0, 0.18, 4);
      g.sheet(a, [0.01, 1.96, 0], 0.4, 0.16, 2, 1, i => Z.F1 + i); break;
    case 'astil_jinete': g.cyl(a, Z.FIX, C.madera, [0, 0.6, 0], 0.018, 0.018, 2.8, 4); g.octa(a, Z.FIX, C.laton, [0, 2.04, 0], 0.045, {ry: 0.08});
      g.sheet(a, [0.02, 1.94, 0], 0.9, 0.62, 3, 3, flagZone(o.flagLayout)); break;
    case 'escobillon': g.cyl(a, Z.FIX, C.madera, [0, 1.0, 0], 0.016, 0.016, 2.0, 4); g.cyl(a, Z.FIX, C.negro, [0, 2.06, 0], 0.045, 0.045, 0.16, 4, {top: true}); break;
    case 'botafuego': g.cyl(a, Z.FIX, C.madera, [0, 0.2, 0], 0.014, 0.014, 0.9, 4); g.tet(a, Z.FIX, 0xd06a20, [0, 0.66, 0], 0.035); break;
    case 'espeque': g.box(a, Z.FIX, C.madera, [0, 0.5, 0], [0.04, 1.0, 0.05], {taper: 0.3}); break;
    case 'bala': g.octa(a, Z.FIX, C.hierro, [0, -0.04, 0.06], 0.07); break;
    case 'proyectil': g.cyl(a, Z.FIX, C.laton, [0, 0.0, 0.07], 0.045, 0.03, 0.3, 4, {rot: [90, 0, 0], top: true}); break;
    case 'pala': g.cyl(a, Z.FIX, C.madera, [0, 0.62, 0], 0.018, 0.018, 0.95, 4); g.box(a, Z.FIX, C.hierro, [0, 0.14, 0.0], [0.2, 0.26, 0.03], {taper: -0.1}); break;
    case 'catalejo': break;
    default: weaponE(g, a, w, o); break;
    case 'camilla': {                                                // camilla con un herido: dos varales a ±0,24 a lo largo de +Y
      [0.25, -0.25].forEach(x => g.cyl(a, Z.FIX, C.madera, [x, 1.15, 0], 0.02, 0.02, 2.3, 4));
      g.quad([-0.25, 0.25, 0], [0.25, 0.25, 0], [0.25, 2.05, 0], [-0.25, 2.05, 0], a, Z.FIX, C.lona);
      g.box(a, Z.MAIN, 0, [0, 0.75, 0.1], [0.36, 0.72, 0.18]); g.tet(a, Z.FIX, C.piel, [0, 0.3, 0.12], 0.12, {vr: V.SKIN}); g.box(a, Z.ACC, 0, [0, 1.5, 0.08], [0.32, 0.8, 0.14], {noFront: true}); break; }
  }
}
function flagZone(lay) {
  return (i, j) => lay === 'vert' ? Z.F1 + i : lay === 'horiz' ? Z.F1 + j : lay === 'mono' ? Z.F1 : lay === 'cruz' ? (i === 1 || j === 1 ? Z.F2 : Z.F1)
    : lay === 'aspa' ? (i === j || i + j === 2 ? Z.F2 : Z.F1) : lay === 'disco' ? (i === 1 && j === 1 ? Z.F2 : Z.F1) : lay === 'usa' ? (i === 0 && j === 0 ? Z.F3 : j === 1 ? Z.F2 : Z.F1)
    : (i === 1 || j === 1 ? Z.F1 : Z.F2);   // union: aproximación de 3×3 (cruz roja sobre azul)
}
// soldado de pie. o = {era, toc, arma, rango, mochila, charreteras, lite, flagLayout, bayoneta, brazalete, catalejo, penacho, plumero}
function buildSoldier(o) {
  const g = new GeoBuilder(), P = rigIndex('soldado'), era = o.era, AB = era === 'A' || era === 'B', coat = Z.MAIN, pants = Z.ACC;
  // pelvis: caderas + faldones de la casaca (A) o faldón corto de la guerrera
  if (!o.lite) g.box(P.pelvis, pants, 0, [0, -0.02, 0], [0.33, 0.17, 0.21], {noTop: true});
  if (era === 'A' && !o.lite) { g.quad([-0.13, 0.02, -0.112], [0.13, 0.02, -0.112], [0.15, -0.3, -0.15], [-0.15, -0.3, -0.15], P.pelvis, coat, 0); g.quad([-0.13, 0.02, -0.112], [-0.15, -0.3, -0.15], [0.15, -0.3, -0.15], [0.13, 0.02, -0.112], P.pelvis, coat, 0); }
  else if (!o.lite) g.box(P.pelvis, coat, 0, [0, -0.04, 0], [0.36, 0.16, 0.235], {noTop: true, taper: -0.06});
  // torso
  if (o.lite) g.box(P.torso, coat, 0, [0, 0.18, 0], [0.37, 0.6, 0.22], {taper: -0.08}); else g.box(P.torso, coat, 0, [0, 0.24, 0], [0.38, 0.46, 0.23], {taper: -0.06});
  if (!o.lite) g.quad([-0.12, 0.45, 0.1], [0.12, 0.45, 0.1], [0.12, 0.5, 0.09], [-0.12, 0.5, 0.09], P.torso, Z.TRIM, 0);   // cuello
  if (AB && !o.lite && o.correaje !== false) {                                                                       // correajes blancos cruzados (A/B)
    g.quad([-0.18, 0.05, 0.127], [-0.14, 0.02, 0.127], [0.2, 0.4, 0.127], [0.17, 0.44, 0.127], P.torso, Z.FIX, C.correaB);
    g.quad([0.15, 0.02, 0.127], [0.18, 0.06, 0.127], [-0.13, 0.44, 0.127], [-0.17, 0.44, 0.127], P.torso, Z.FIX, C.correaB);
    g.quad([0.2, 0.4, -0.127], [-0.14, 0.02, -0.127], [-0.18, 0.05, -0.127], [0.17, 0.44, -0.127], P.torso, Z.FIX, C.correaB);
    g.quad([-0.13, 0.44, -0.127], [0.18, 0.06, -0.127], [0.15, 0.02, -0.127], [-0.17, 0.44, -0.127], P.torso, Z.FIX, C.correaB);
  } else if (!o.lite) {
    g.box(P.torso, Z.FIX, C.cuero, [0, 0.03, 0], [0.4, 0.06, 0.25], {noTop: true});                 // cinturón con cartucheras
    if (o.cartucheras !== false) [0.1, -0.1].forEach(x => g.quad([x - 0.045, 0.01, 0.128], [x + 0.045, 0.01, 0.128], [x + 0.045, 0.08, 0.128], [x - 0.045, 0.08, 0.128], P.torso, Z.FIX, C.cuero));
  }
  if (era === 'E' && !o.lite) eKit(g, P, o);
  else if (o.mochila !== false && !o.lite) { if (AB) { g.box(P.torso, Z.FIX, C.mochila, [0, 0.28, -0.17], [0.32, 0.3, 0.11]); if (era === 'A') g.cyl(P.torso, Z.FIX, C.manta, [0, 0.46, -0.17], 0.05, 0.05, 0.32, 4, {rot: [0, 0, 90]}); } else g.box(P.torso, Z.FIX, C.lona, [0, 0.28, -0.16], [0.28, 0.26, 0.1]); }
  if (o.espalda === 'pala') g.box(P.torso, Z.FIX, C.hierro, [0.05, 0.28, -0.17], [0.18, 0.24, 0.03], {rot: [0, 0, 15]});
  if (o.rango === 'oficial' && AB) g.box(P.torso, Z.TRIM, 0, [0, 0.12, 0.0], [0.4, 0.07, 0.245], {noTop: true, rot: [0, 0, 12]});   // faja
  // cabeza y tocado
  g.cyl(P.cabeza, Z.FIX, C.piel, [0, 0.13, 0.005], 0.13 * 0.86, 0.13, 0.25, 6, {top: !o.toc, vr: V.SKIN});
  headgear(g, P.cabeza, o.toc, o);
  // brazos (manga del color principal, mano)
  [['brazoIz', 'antebrazoIz', 1], ['brazoDe', 'antebrazoDe', -1]].forEach(([u, l, s]) => {
    g.box(P[u], coat, 0, [0, -0.14, 0], [0.11, 0.31, 0.12], {noTop: true, taper: -0.05});
    if (o.charreteras && AB) g.box(P[u], Z.TRIM, 0, [0.02 * s, 0.01, 0], [0.13, 0.03, 0.13]);
    if (o.brazalete && s > 0) g.box(P[u], Z.FIX, C.blanco, [0, -0.08, 0], [0.12, 0.07, 0.13], {noTop: true});
    g.box(P[l], coat, 0, [0, -0.11, 0], [0.095, 0.24, 0.1], {noTop: true});
    if (!o.lite) g.tet(P[l], Z.FIX, C.piel, [0, -0.27, 0.01], 0.055, {vr: V.SKIN});
  });
  if (o.brazalete) g.quad([0.06 * 1 + 0.235 - 0.235, -0.06, 0.066], [0.0, -0.06, 0.066], [0.0, -0.1, 0.066], [0.06, -0.1, 0.066], P.brazoIz, Z.FIX, C.rojo);   // cruz roja (simplificada)
  if (o.catalejo) g.cyl(P.antebrazoIz, Z.FIX, C.laton, [0, -0.28, 0.08], 0.025, 0.02, 0.24, 4, {rot: [90, 0, 0]});
  // piernas
  [['musloIz', 'piernaIz'], ['musloDe', 'piernaDe']].forEach(([u, l]) => {
    g.box(P[u], pants, 0, [0, -0.2, 0], [0.14, 0.42, 0.15], {noTop: true, taper: 0.12});
    if (o.lite) { g.box(P[l], Z.FIX, era >= 'D' ? C.panno : C.bota, [0, -0.22, 0.02], [0.12, 0.46, 0.15], {noTop: true, taper: 0.06}); return; }
    g.box(P[l], era >= 'D' ? Z.FIX : pants, era >= 'D' ? (o.botas ? C.bota : C.panno) : 0, [0, -0.17, 0], [0.12, 0.36, 0.13], {noTop: true, taper: 0.06});   // D: polainas/puttees
    g.box(P[l], Z.FIX, C.bota, [0, -0.41, 0.04], [0.12, 0.1, 0.24], {noTop: true});
  });
  weapon(g, P.arma, o.arma, o);
  return g;
}
// jinete. o = {era, toc, tipo: husar|coracero|lancero|dragon|general|ayudante|mariscal|mensajero|estandarte, flagLayout, pelaje}
function horse(g, P, o) {
  const hv = o.animal === 'buey' ? 0 : V.HORSE, hc = o.animal === 'buey' ? C.buey : 0xffffff;
  g.box(P.caballo, Z.FIX, hc, [0, 0.02, 0], [0.5, 0.52, 1.36], {taper: 0.12, bottom: true, vr: hv});
  g.box(P.caballo, Z.FIX, hc, [0, 0.0, -0.66], [0.46, 0.48, 0.12], {vr: hv, noTop: true});
  g.box(P.cuello, Z.FIX, hc, [0, 0.26, 0.1], [0.24, 0.6, 0.3], {rot: [32, 0, 0], taper: 0.15, vr: hv});
  g.box(P.cuello, Z.FIX, hc, [0, 0.6, 0.36], [0.2, 0.2, 0.52], {rot: [-28, 0, 0], taper: 0.25, taperZ: 0.1, bottom: true, vr: hv});
  g.box(P.cuello, Z.FIX, C.crin, [0, 0.36, 0.0], [0.05, 0.56, 0.1], {rot: [32, 0, 0], noFront: true, noBack: true});
  g.cyl(P.cuello, Z.FIX, hc, [0.06, 0.74, 0.22], 0.025, 0, 0.1, 3, {vr: hv}); g.cyl(P.cuello, Z.FIX, hc, [-0.06, 0.74, 0.22], 0.025, 0, 0.1, 3, {vr: hv});
  ['manoIz', 'manoDe', 'pataIz', 'pataDe'].forEach(k => g.box(P[k], Z.FIX, hc, [0, -0.2, 0], [0.12, 0.46, 0.17], {taper: 0.3, noTop: true, vr: hv}));
  ['canaIz', 'canaDe', 'corvIz', 'corvDe'].forEach(k => { g.box(P[k], Z.FIX, hc, [0, -0.2, 0], [0.075, 0.42, 0.085], {noTop: true, vr: hv}); g.box(P[k], Z.FIX, C.crin, [0, -0.44, 0.01], [0.09, 0.07, 0.11], {noTop: true}); });
  g.box(P.cola, Z.FIX, C.crin, [0, -0.25, -0.06], [0.08, 0.55, 0.1], {rot: [-18, 0, 0], taper: -0.4});
}
function buildRider(o) {
  const g = new GeoBuilder(), P = rigIndex('jinete'), AB = o.era === 'A' || o.era === 'B', t = o.tipo || 'husar', pants = Z.ACC;
  horse(g, P, o);
  // silla, gualdrapa (ribete) y piernas del jinete (fijas a la silla)
  g.box(P.silla, Z.TRIM, 0, [0, -0.04, -0.05], [0.56, 0.05, 0.62]);
  g.box(P.silla, Z.FIX, C.cuero, [0, 0.02, 0], [0.32, 0.06, 0.42]);
  [1, -1].forEach(s => {
    g.box(P.silla, pants, 0, [0.15 * s, 0.03, 0.12], [0.14, 0.13, 0.36], {rot: [8, 0, 0], noBack: true});
    g.box(P.silla, pants, 0, [0.27 * s, -0.25, 0.22], [0.12, 0.44, 0.13], {rot: [-6, 0, 10 * s], noTop: true});
    g.box(P.silla, Z.FIX, C.bota, [0.29 * s, -0.5, 0.26], [0.12, 0.14, 0.22], {noTop: true});
  });
  // torso
  g.box(P.torso, Z.MAIN, 0, [0, 0.22, 0], [0.36, 0.44, 0.22], {taper: -0.05});
  g.box(P.torso, Z.TRIM, 0, [0, 0.45, 0], [0.22, 0.05, 0.19], {noTop: true});
  if (t === 'husar' && AB) { g.quad([-0.05, 0.4, 0.112], [0.05, 0.4, 0.112], [0.05, 0.03, 0.112], [-0.05, 0.03, 0.112], P.torso, Z.TRIM, 0);   // alamares
    g.box(P.torso, Z.MAIN, 0, [0.12, 0.25, -0.05], [0.2, 0.42, 0.25], {rot: [0, 0, -8]}); }                                                   // pelliza colgada del hombro izquierdo
  else if (t === 'coracero' && o.era < 'D') g.box(P.torso, Z.FIX, C.acero, [0, 0.26, 0], [0.4, 0.36, 0.26], {taper: -0.08});             // coraza
  else if (t === 'general' || t === 'mariscal' || t === 'ayudante') { g.box(P.torso, Z.TRIM, 0, [0, 0.1, 0], [0.38, 0.06, 0.235], {noTop: true, rot: [0, 0, 10]}); }   // faja
  else g.box(P.torso, Z.FIX, C.cuero, [0, 0.03, 0], [0.38, 0.06, 0.24], {noTop: true});
  if (t === 'dragon' || (o.era >= 'D' && (t === 'husar' || t === 'lancero' || t === 'coracero'))) g.box(P.torso, Z.FIX, C.hierro, [0.12, 0.18, -0.14], [0.05, 0.7, 0.05], {rot: [0, 0, -30]});   // carabina a la espalda
  if (t === 'mensajero') g.box(P.torso, Z.FIX, C.cuero, [0.19, 0.06, 0.02], [0.06, 0.2, 0.24]);                                              // cartera
  if (t === 'general' || t === 'mariscal') { g.box(P.brazoIz, Z.TRIM, 0, [0.02, 0.01, 0], [0.13, 0.03, 0.13]); g.box(P.brazoDe, Z.TRIM, 0, [-0.02, 0.01, 0], [0.13, 0.03, 0.13]); }   // charreteras
  g.head(P.cabeza, [0, 0.13, 0.005], 0.125, 0.24, !o.toc);
  headgear(g, P.cabeza, o.toc, {plumero: o.plumero});
  g.box(P.brazoIz, Z.MAIN, 0, [0, -0.13, 0.04], [0.1, 0.3, 0.11], {rot: [-35, 0, 0]}); g.tet(P.brazoIz, Z.FIX, C.piel, [0, -0.22, 0.24], 0.05, {vr: V.SKIN});
  if (t === 'general' || t === 'mariscal') g.cyl(P.brazoIz, Z.FIX, C.laton, [0, -0.2, 0.33], 0.022, 0.018, 0.22, 4, {rot: [90, 0, 0]});   // catalejo
  g.box(P.brazoDe, Z.MAIN, 0, [0, -0.14, 0], [0.1, 0.3, 0.11], {noTop: true});
  g.box(P.antebrazoDe, Z.MAIN, 0, [0, -0.11, 0], [0.09, 0.24, 0.1], {noTop: true});
  g.tet(P.antebrazoDe, Z.FIX, C.piel, [0, -0.27, 0.01], 0.055, {vr: V.SKIN});
  weapon(g, P.arma, {husar: 'sable', coracero: 'sable', dragon: 'sable', lancero: 'lanza', general: 'sable', ayudante: 'sable', mariscal: 'baston', mensajero: 'ninguna', estandarte: 'astil_jinete'}[t], o);
  g.quad([0.1, -0.16, 0.26], [-0.1, -0.16, 0.26], [-0.08, -0.02, 1.0], [0.08, -0.02, 1.0], P.silla, Z.FIX, C.cueroN);   // riendas
  return g;
}
// pieza de artillería. o.tipo: liso (ánima lisa, 6–12 libras), rc (rayado de retrocarga), obus, mg (ametralladora)
function buildCannon(o) {
  const g = new GeoBuilder(), P = rigIndex('canon'), t = o.tipo || 'liso', era = o.era;
  const wheels = (r, col) => ['ruedaIz', 'ruedaDe'].forEach(k => g.cyl(P[k], Z.FIX, col, [0, 0, 0], r, r, 0.07, 8, {rot: [0, 0, 90], top: true, bottom: true}));
  if (t === 'liso' || (t === 'obus' && era < 'D')) {
    g.box(P.cureña, Z.FIX, 0x5e6a48, [0, 0.42, -0.85], [0.22, 0.14, 2.0], {rot: [-14, 0, 0]});             // gualderas pintadas (verde oliva, aprox.)
    g.box(P.cureña, Z.FIX, 0x5e6a48, [0, 0.7, 0.15], [0.5, 0.22, 0.5]);
    g.box(P.cureña, Z.FIX, C.hierro, [0, 0.62, 0.15], [1.26, 0.08, 0.08], {noFront: true, noBack: true});
    if (t === 'liso') { g.cyl(P.tubo, Z.FIX, C.bronce, [0, 0, 0.35], 0.12, 0.085, 1.5, 8, {rot: [90, 0, 0], top: true}); g.cyl(P.tubo, Z.FIX, C.bronce, [0, 0, -0.45], 0.13, 0.11, 0.12, 6, {rot: [90, 0, 0], bottom: true}); }
    else g.cyl(P.tubo, Z.FIX, C.bronce, [0, 0.12, 0.1], 0.17, 0.15, 0.85, 8, {rot: [90 - 32, 0, 0], top: true, bottom: true});    // obús corto elevado
    wheels(0.62, C.madera);
  } else if (t === 'rc' || t === 'obus') {
    if (era >= 'D') {                                                                                        // pieza de campaña con escudo (tipo 75 mm / obús de 105)
      g.box(P.cureña, Z.FIX, 0x5a5c4a, [0, 0.36, -1.0], [0.16, 0.12, 2.0], {rot: [-12, 0, 0]});
      g.box(P.cureña, Z.FIX, 0x5a5c4a, [0, 0.7, 0.05], [0.38, 0.24, 0.9]);
      g.box(P.cureña, Z.FIX, C.hierro, [0, 0.62, 0.15], [1.26, 0.07, 0.07], {noFront: true, noBack: true});
      g.box(P.cureña, Z.FIX, 0x5f6250, [0, 0.95, 0.42], [1.05, 0.9, 0.04], {taper: 0.12, bottom: true});      // escudo
      if (t === 'rc') { g.cyl(P.tubo, Z.FIX, 0x4a4c48, [0, 0, 0.55], 0.06, 0.055, 2.0, 6, {rot: [90, 0, 0], top: true}); g.cyl(P.tubo, Z.FIX, 0x3e403c, [0, -0.1, 0.1], 0.08, 0.08, 1.0, 6, {rot: [90, 0, 0], top: true, bottom: true}); }
      else g.cyl(P.tubo, Z.FIX, 0x4a4c48, [0, 0.12, 0.25], 0.1, 0.09, 1.4, 6, {rot: [90 - 30, 0, 0], top: true, bottom: true});
      wheels(0.6, C.maderaO);
    } else {                                                                                                  // acero de retrocarga (Krupp / De Bange, 1860–1900)
      g.box(P.cureña, Z.FIX, 0x3e4a5a, [0, 0.42, -0.85], [0.2, 0.13, 2.0], {rot: [-14, 0, 0]});
      g.box(P.cureña, Z.FIX, 0x3e4a5a, [0, 0.7, 0.15], [0.44, 0.2, 0.5]);
      g.box(P.cureña, Z.FIX, C.hierro, [0, 0.62, 0.15], [1.26, 0.07, 0.07], {noFront: true, noBack: true});
      g.cyl(P.tubo, Z.FIX, 0x2c2e30, [0, 0, 0.45], 0.08, 0.06, 1.8, 6, {rot: [90, 0, 0], top: true});
      g.box(P.tubo, Z.FIX, 0x2c2e30, [0, 0, -0.5], [0.2, 0.2, 0.22], {bottom: true});                           // cierre
      wheels(0.62, C.madera);
    }
  } else if (t === 'mg') {
    if (era >= 'D') {                                                                                        // Maxim / Vickers sobre trípode (sin ruedas)
      [[0, -0.6], [0.4, 0.3], [-0.4, 0.3]].forEach(([x, z]) => g.box(P.cureña, Z.FIX, 0x4a4c40, [x * 0.5, 0.25, z * 0.5], [0.05, 0.6, 0.05], {rot: [z < 0 ? 40 : -30, 0, -x * 50], noTop: true}));
      g.cyl(P.tubo, Z.FIX, 0x5a5e50, [0, -0.32, 0.3], 0.065, 0.06, 0.9, 6, {rot: [90, 0, 0], top: true});    // camisa de agua
      g.box(P.tubo, Z.FIX, 0x3a3c38, [0, -0.32, -0.25], [0.16, 0.18, 0.36], {bottom: true});
      g.box(P.tubo, Z.FIX, 0x6a6448, [0.18, -0.36, -0.2], [0.12, 0.14, 0.2]);                                  // caja de cinta
    } else {                                                                                                  // Gatling sobre cureña ligera
      g.box(P.cureña, Z.FIX, 0x6a6a54, [0, 0.4, -0.8], [0.18, 0.12, 1.7], {rot: [-15, 0, 0]});
      g.box(P.cureña, Z.FIX, C.hierro, [0, 0.62, 0.15], [1.26, 0.07, 0.07], {noFront: true, noBack: true});
      g.cyl(P.tubo, Z.FIX, C.laton, [0, 0, 0.25], 0.11, 0.1, 1.1, 6, {rot: [90, 0, 0], top: true});            // haz de cañones
      g.box(P.tubo, Z.FIX, 0x3a3c38, [0, 0, -0.45], [0.26, 0.26, 0.4], {bottom: true});
      g.box(P.tubo, Z.FIX, 0x6a6448, [0, 0.2, -0.35], [0.1, 0.18, 0.16], {noFront: true});                     // tolva
      wheels(0.55, C.madera);
    }
  }
  return g;
}
// tanque ligero tipo Renault FT (1917): casco, torreta giratoria, cañón de 37 mm, orugas con bandas animadas (fx.y)
function trackLoop(g, part, prof, w, x, zoneSide, side, sideColor) {
  side = side || 1;
  const len = []; let L = 0; for (let i = 0; i < prof.length; i++) { len.push(L); const a = prof[i], b = prof[(i + 1) % prof.length]; L += Math.hypot(a[0] - b[0], a[1] - b[1]); }
  for (let i = 0; i < prof.length; i++) {
    const a = prof[i], b = prof[(i + 1) % prof.length], u0 = side * (1 + len[i] * 4), u1 = side * (1 + (len[i] + Math.hypot(a[0] - b[0], a[1] - b[1])) * 4);
    const A0 = [x + w / 2, a[1], a[0]], B0 = [x + w / 2, b[1], b[0]], A1 = [x - w / 2, a[1], a[0]], B1 = [x - w / 2, b[1], b[0]];
    g.tri(A0, A1, B1, part, Z.FIX, C.oruga, 0, [0, u0], [0, u0], [0, u1]); g.tri(A0, B1, B0, part, Z.FIX, C.oruga, 0, [0, u0], [0, u1], [0, u1]);
  }
  [x + w / 2, x - w / 2].forEach(xx => { for (let i = 1; i < prof.length - 1; i++) { const a = prof[0], b = prof[i], c = prof[i + 1]; const pa = [xx, a[1], a[0]], pb = [xx, b[1], b[0]], pc = [xx, c[1], c[0]]; if (xx > x) g.tri(pa, pc, pb, part, zoneSide, sideColor || 0); else g.tri(pa, pb, pc, part, zoneSide, sideColor || 0); } });
}
function buildTank(o) {
  const g = new GeoBuilder(), P = rigIndex('tanque'), VZ = Z.VEH;
  g.box(P.casco, VZ, 0, [0, 1.05, 0.0], [0.92, 0.95, 2.5], {taper: 0.1, taperZ: 0.08});
  g.box(P.casco, VZ, 0, [0, 1.22, 1.45], [0.84, 0.62, 0.5], {rot: [-40, 0, 0], taper: 0.15});            // glacis inclinado
  g.box(P.casco, VZ, 0, [0, 0.98, -1.4], [0.86, 0.66, 0.42], {rot: [28, 0, 0]});
  g.box(P.casco, Z.FIX, C.hierro, [0, 0.62, -2.15], [0.7, 0.07, 0.75], {noFront: true, noBack: true});           // cola para cruzar trincheras
  g.cyl(P.torreta, VZ, 0, [0, 0.24, 0], 0.46, 0.4, 0.5, 8, {top: true, dome: 0.08});
  g.box(P.torreta, Z.FIX, C.negro, [0, 0.3, 0.42], [0.2, 0.06, 0.06], {noBack: true});
  g.cyl(P.canon, Z.FIX, C.hierro, [0, 0, 0.3], 0.055, 0.05, 0.56, 6, {rot: [90, 0, 0], top: true});
  ['orugaIz', 'orugaDe'].forEach((k, i) => trackLoop(g, P[k], [[2.05, 1.35], [1.65, 0.22], [-1.45, 0.1], [-1.9, 0.55], [-1.55, 1.05], [1.55, 1.48]], 0.34, 0, VZ, i ? -1 : 1));
  return g;
}
// tanque romboidal Mark I «macho» (1916): orugas alrededor del casco, barbetas laterales con cañones de 6 libras, ruedas de cola
function buildMarkI(o) {
  const g = new GeoBuilder(), P = rigIndex('markI'), VZ = Z.VEH;
  const prof = [[4.9, 2.0], [3.4, 0.05], [-3.3, 0.05], [-4.1, 1.15], [-3.8, 2.45], [3.7, 2.45]];
  ['orugaIz', 'orugaDe'].forEach((k, i) => trackLoop(g, P[k], prof, 0.56, 0, VZ, i ? -1 : 1));
  g.box(P.casco, VZ, 0, [0, 1.35, 0.1], [1.7, 1.9, 6.6], {taper: 0.0});                                        // casco central
  g.box(P.casco, VZ, 0, [0, 2.55, 2.4], [1.3, 0.6, 1.2], {noBack: true});                                       // puesto de conducción
  ['sponIz', 'sponDe'].forEach((k, i) => { const s = i ? -1 : 1; g.box(P[k], VZ, 0, [0.12 * s, 0, 0], [0.5, 1.0, 1.6], {taperZ: 0.35, taper: 0.0, bottom: true}); });
  ['canonIz', 'canonDe'].forEach(k => g.cyl(P[k], Z.FIX, C.hierro, [0, 0, 0.45], 0.075, 0.065, 1.0, 6, {rot: [90, 0, 0], top: true}));
  [0.45, -0.45].forEach(x => g.cyl(P.ruedasCola, Z.FIX, C.hierro, [x, 0, 0], 0.6, 0.6, 0.12, 6, {rot: [0, 0, 90], top: true, bottom: true}));
  g.box(P.ruedasCola, Z.FIX, C.hierro, [0, 0.3, 0.9], [0.1, 0.1, 1.6], {rot: [-15, 0, 0], noFront: true, noBack: true});
  return g;
}
// tiro: avantrén (tipo 'avantren'), carro de munición ('municion') o carreta de suministro ('carreta'); animales: caballo, mula o buey
function buildTeam(o) {
  const g = new GeoBuilder(), P = rigIndex('tiro'), t = o.tipo, an = o.animal || 'caballo', hv = an === 'buey' ? 0 : V.HORSE;
  const wheel = (k, r) => g.cyl(P[k], Z.FIX, C.madera, [0, 0, 0], r, r, 0.07, 8, {rot: [0, 0, 90], top: true, bottom: true});
  if (t === 'avantren') { g.box(P.caja, Z.FIX, 0x5e6a48, [0, 0.12, -1.0], [1.0, 0.45, 0.6], {bottom: true}); g.box(P.caja, Z.FIX, C.hierro, [0, -0.25, -1.0], [1.4, 0.07, 0.07], {noFront: true, noBack: true}); wheel('ruedaTI', 0.65); wheel('ruedaTD', 0.65); }
  else if (t === 'municion') { [[1.0], [-0.95]].forEach(([z]) => g.box(P.caja, Z.FIX, 0x5e6a48, [0, 0.12, z], [1.0, 0.42, 0.62], {bottom: true})); g.box(P.caja, Z.FIX, 0x5e6a48, [0, -0.1, 0], [0.16, 0.1, 2.6], {noFront: true}); ['ruedaDI', 'ruedaDD', 'ruedaTI', 'ruedaTD'].forEach(k => wheel(k, k[5] === 'D' ? 0.55 : 0.65)); }
  else { g.box(P.caja, Z.FIX, C.madera, [0, 0.0, 0], [1.2, 0.5, 2.8], {bottom: true});                    // carreta con toldo de lona
    g.cyl(P.caja, Z.FIX, C.lona, [0, 0.35, 0], 0.62, 0.62, 2.6, 6, {rot: [90, 0, 0], a0: 0, sz: 0.9});
    ['ruedaDI', 'ruedaDD', 'ruedaTI', 'ruedaTD'].forEach(k => wheel(k, k[5] === 'D' ? 0.55 : 0.65)); }
  g.box(P.caja, Z.FIX, C.madera, [0, -0.2, 2.3], [0.07, 0.07, 2.4], {noFront: true, noBack: true});             // lanza
  [1, 2].forEach(k => {
    const b = P['an' + k], s = an === 'mula' ? 0.86 : 1, col = an === 'buey' ? (k === 1 ? C.buey : C.bueyO) : 0xffffff, w = an === 'buey' ? 0.62 : 0.48;
    g.box(b, Z.FIX, col, [0, 0.02, 0], [w, 0.52 * s, 1.36], {taper: 0.12, bottom: true, vr: hv});
    g.box(P['an' + k + 'cu'], Z.FIX, col, [0, an === 'buey' ? 0.0 : 0.26, 0.1], [0.24, an === 'buey' ? 0.4 : 0.6, 0.3], {rot: [an === 'buey' ? 70 : 32, 0, 0], taper: 0.15, vr: hv});
    g.box(P['an' + k + 'cu'], Z.FIX, col, an === 'buey' ? [0, -0.05, 0.38] : [0, 0.6, 0.36], [0.2, 0.2, 0.46], {rot: [an === 'buey' ? 20 : -28, 0, 0], taper: 0.25, bottom: true, vr: hv});
    if (an === 'mula') [0.06, -0.06].forEach(x => g.cyl(P['an' + k + 'cu'], Z.FIX, col, [x, 0.8, 0.22], 0.03, 0, 0.22, 3, {vr: hv}));
    if (an === 'buey') [0.18, -0.18].forEach(x => g.cyl(P['an' + k + 'cu'], Z.FIX, C.blanco, [x, 0.08, 0.32], 0.03, 0, 0.26, 3, {rot: [0, 0, x > 0 ? -70 : 70]}));
    ['mi', 'md', 'pi', 'pd'].forEach(l => g.box(P['an' + k + l], Z.FIX, col, [0, -0.42, 0], [0.11, 0.9, 0.14], {taper: 0.35, noTop: true, vr: hv}));
    if (k === 1 && t !== 'carreta') {                                                                         // conductor montado en el caballo de la izquierda
      g.box(b, Z.MAIN, 0, [0, 0.62, -0.05], [0.34, 0.44, 0.22]); g.box(b, Z.ACC, 0, [0, 0.3, 0.05], [0.42, 0.14, 0.34], {noTop: true});
      g.cyl(b, Z.FIX, C.piel, [0, 0.97, -0.05], 0.1, 0.11, 0.22, 5, {vr: V.SKIN}); g.cyl(b, Z.HAT, 0, [0, 1.13, -0.05], 0.12, 0.12, 0.12, 5, {top: true});
    }
  });
  if (t === 'carreta') { g.box(P.caja, Z.MAIN, 0, [0, 0.55, 1.25], [0.34, 0.42, 0.22]); g.cyl(P.caja, Z.FIX, C.piel, [0, 0.88, 1.25], 0.1, 0.11, 0.22, 5, {vr: V.SKIN}); g.cyl(P.caja, Z.HAT, 0, [0, 1.04, 1.25], 0.12, 0.12, 0.12, 5, {top: true}); }
  return g;
}
// parapeto de fuerte: cestones y tierra (A–C) o sacos terreros (D), 4 m de frente
function buildParapet(o) {
  const g = new GeoBuilder();
  if (o.era >= 'D') { for (let r = 0; r < 3; r++) for (let i = 0; i < 6 - (r === 2 ? 1 : 0); i++) g.box(0, Z.FIX, r % 2 ? C.saco : 0x9a8c68, [-1.75 + i * 0.7 + (r % 2) * 0.35, 0.15 + r * 0.3, 0], [0.66, 0.28, 0.42], {bottom: false, noBack: r < 2}); }
  else { for (let i = 0; i < 6; i++) g.cyl(0, Z.FIX, C.mimbre, [-1.75 + i * 0.7, 0.5, 0.35], 0.32, 0.32, 1.0, 6, {top: true, topColor: C.tierra}); g.box(0, Z.FIX, C.tierra, [0, 0.45, -0.35], [4.2, 0.9, 0.8], {taperZ: 0.6}); }
  return g;
}

/* ================= v4: figuras detalladas (LOD0) =================
   Sustituye los constructores LOD0 de c_fig.js (buildSoldier, horse, buildRider, buildCannon, buildTank, buildMarkI, buildTeam) por
   versiones con anatomía modelada (secciones superelípticas con normales suaves), manos, cara, pies articulados, equipo y arreos.
   El LOD1/LOD2, las paletas, los esqueletos (más 'pieIz'/'pieDe', 'testa', 'antebrazoIz', 'an1te'/'an2te') y la API no cambian. */

// triángulo con normales por vértice (sombreado suave)
GeoBuilder.prototype.triN = function (a, b, c, na, nb, nc, part, zone, color, vr) {
  const cc = _cc.set(color || 0), r = cc.r, gg = cc.g, bl = cc.b;
  [[a, na], [b, nb], [c, nc]].forEach(([q, n]) => { this.p.push(q[0], q[1], q[2]); this.n.push(n[0], n[1], n[2]); this.part.push(part); this.zone.push(zone); this.col.push(r, gg, bl); this.vr.push(vr || 0); this.fx.push(0, 0); });
};
function _rotN(v, rot) { return rot ? xf([v], [0, 0, 0], rot)[0] : v; }
function _nrm(v) { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; }
// loft(part, zone, color, rings, n, o): sección superelíptica (exponente o.p, 2 = elipse) a lo largo de o.axis ('y' | 'z' | 'x')
//   rings: [t, rx, rz, c1, c2] → centro de la sección desplazado (c1, c2) en los otros dos ejes. o.capA / o.capB: tapa en el primer / último anillo.
//   o.zoneFn(k, i) → zona por segmento/lado (opcional). Normales suaves.
GeoBuilder.prototype.loft = function (part, zone, color, rings, n, o) {
  o = o || {};
  if (rings.length > 1 && rings[0][0] > rings[rings.length - 1][0]) { rings = rings.slice().reverse(); o = Object.assign({}, o, {capA: o.capB, capB: o.capA, domeA: o.domeB, domeB: o.domeA}); }
  const p = o.p || 2, ax = o.axis || 'y', at = o.at || [0, 0, 0], rot = o.rot, a0 = o.a0 != null ? o.a0 : 0;
  const P = (t, u, v) => ax === 'y' ? [u, t, v] : ax === 'z' ? [u, v, t] : [t, v, u];          // (u, v) = sección; orientación dextrógira
  const sgn = (ax === 'z' ? 1 : -1) * (o.inside ? -1 : 1), ns = o.inside ? -1 : 1;
  const R = rings.map((r, k) => {
    const [t, rx, rz, c1, c2] = r, prev = rings[Math.max(0, k - 1)], next = rings[Math.min(rings.length - 1, k + 1)];
    const dr = ((next[1] + next[2]) - (prev[1] + prev[2])) / 2, dt = (next[0] - prev[0]) || 1, sl = o.flatN ? 0 : -dr / dt;
    const pts = [], nms = [];
    for (let i = 0; i < n; i++) {
      const a = a0 + i / n * Math.PI * 2, c = Math.cos(a), s = Math.sin(a), e = 2 / p;
      const x = rx * Math.sign(c) * Math.pow(Math.abs(c), e) + (c1 || 0), z = rz * Math.sign(s) * Math.pow(Math.abs(s), e) + (c2 || 0);
      const gx = Math.sign(c) * Math.pow(Math.abs(c), 2 - e) / Math.max(rx, 1e-4), gz = Math.sign(s) * Math.pow(Math.abs(s), 2 - e) / Math.max(rz, 1e-4), gl = Math.hypot(gx, gz) || 1;
      pts.push(P(t, x, z)); nms.push(o.nrm ? o.nrm : _nrm(P(sl * ns, gx / gl * ns, gz / gl * ns)));
    }
    return {v: xf(pts, at, rot), n: nms.map(q => _rotN(q, rot)), c: xf([P(t, c1 || 0, c2 || 0)], at, rot)[0]};
  });
  for (let k = 0; k < R.length - 1; k++) for (let i = 0; i < n; i++) {
    const j = (i + 1) % n, A = R[k], B = R[k + 1], z = o.zoneFn ? o.zoneFn(k, i) : zone;
    if (sgn < 0) { this.triN(A.v[j], A.v[i], B.v[i], A.n[j], A.n[i], B.n[i], part, z, color, o.vr); this.triN(A.v[j], B.v[i], B.v[j], A.n[j], B.n[i], B.n[j], part, z, color, o.vr); }
    else { this.triN(A.v[i], A.v[j], B.v[j], A.n[i], A.n[j], B.n[j], part, z, color, o.vr); this.triN(A.v[i], B.v[j], B.v[i], A.n[i], B.n[j], B.n[i], part, z, color, o.vr); }
  }
  const cap = (Rk, up, dome) => { const c = Rk.c.slice(); if (dome) { const d = xf([P(dome, 0, 0)], [0, 0, 0], rot)[0]; c[0] += d[0]; c[1] += d[1]; c[2] += d[2]; }
    const cn = _nrm(_rotN(P(up ? ns : -ns, 0, 0), rot));
    for (let i = 0; i < n; i++) { const j = (i + 1) % n; if ((sgn < 0) === up) this.triN(Rk.v[j], Rk.v[i], c, dome ? Rk.n[j] : cn, dome ? Rk.n[i] : cn, cn, part, zone, color, o.vr); else this.triN(Rk.v[i], Rk.v[j], c, dome ? Rk.n[i] : cn, dome ? Rk.n[j] : cn, cn, part, zone, color, o.vr); } };
  if (o.capA) cap(R[0], false, o.domeA); if (o.capB) cap(R[R.length - 1], true, o.domeB);
  return this;
};
// tira plana (correas, cintas, galones) sobre una polilínea: pts [[x,y,z]], ancho w, normal de la cara nrm
GeoBuilder.prototype.strap = function (part, zone, color, pts, w, nrm, vr) {
  for (let k = 0; k < pts.length - 1; k++) {
    const a = pts[k], b = pts[k + 1], d = _nrm([b[0] - a[0], b[1] - a[1], b[2] - a[2]]), s = _nrm([d[1] * nrm[2] - d[2] * nrm[1], d[2] * nrm[0] - d[0] * nrm[2], d[0] * nrm[1] - d[1] * nrm[0]]), h = w / 2;
    const q = (p, m) => [p[0] + s[0] * h * m, p[1] + s[1] * h * m, p[2] + s[2] * h * m];
    this.quad(q(a, -1), q(a, 1), q(b, 1), q(b, -1), part, zone, color, vr);
  }
  return this;
};
// añade otra geometría escalada alrededor de un punto (tocados hechos para la cabeza v3 → cabeza v4, más pequeña)
function mergeScaled(g, src, c, k, dy) {
  for (let i = 0; i < src.p.length; i += 3) g.p.push(c[0] + (src.p[i] - c[0]) * k, c[1] + (src.p[i + 1] - c[1]) * k + (dy || 0), c[2] + (src.p[i + 2] - c[2]) * k);
  ['n', 'part', 'zone', 'col', 'vr', 'fx'].forEach(f => { for (let i = 0; i < src[f].length; i++) g[f].push(src[f][i]); });
}
const C4 = {pelo: 0x3a2a1c, ojo: 0x1c1610, suela: 0x1a1614, boton: 0xc8a650, botonB: 0xd8d8d0, hebilla: 0xb89a50, latonO: 0x8a6a30, crinO: 0x221c18, casco: 0x2a2420, cuerno: 0x3a3230, hierroO: 0x2c2e30, gris: 0x6a6a62};

/* ---------------- soldado ---------------- */
// cotas (m, figura de 1,74 m): pelvis 0,90; hombros 1,40; base del cuello 1,46; coronilla 1,75; tobillo 0,08

function soldierHead(g, h, o) {
  const S = Z.FIX, sk = C.piel, vs = V.SKIN;
  g.loft(h, S, sk, [[-0.03, 0.05, 0.052, 0, 0.005], [0.08, 0.05, 0.055, 0, 0.01]], 6, {});                                    // cuello
  g.loft(h, S, sk, [[0.062, 0.022, 0.02, 0, 0.075], [0.085, 0.058, 0.062, 0, 0.035], [0.135, 0.07, 0.088, 0, 0.012], [0.19, 0.076, 0.097, 0, 0.002],
    [0.235, 0.078, 0.1, 0, -0.006], [0.272, 0.058, 0.074, 0, -0.01]], 8, {capA: true, capB: true, domeB: 0.018, vr: vs, a0: Math.PI / 8});
  g.loft(h, S, C4.pelo, [[0.17, 0.081, 0.1, 0, -0.012], [0.25, 0.08, 0.1, 0, -0.01]], 8,
    {capB: true, domeB: 0.045, zoneFn: () => S, a0: Math.PI / 8, p: 2.2});                                                   // pelo (nuca y coronilla)
  g.tri([0, 0.2, 0.1], [0.018, 0.15, 0.106], [0, 0.145, 0.128], h, S, sk, vs); g.tri([0, 0.2, 0.1], [0, 0.145, 0.128], [-0.018, 0.15, 0.106], h, S, sk, vs);   // nariz
  g.tri([0.018, 0.15, 0.106], [-0.018, 0.15, 0.106], [0, 0.145, 0.128], h, S, sk, vs);
  [1, -1].forEach(s => {
    g.quad([0.032 * s - 0.016, 0.197, 0.094], [0.032 * s + 0.016, 0.197, 0.094], [0.032 * s + 0.014, 0.186, 0.096], [0.032 * s - 0.014, 0.186, 0.096], h, S, C4.ojo);   // ojos (sombra de la cuenca)
    g.quad([0.077 * s, 0.205, -0.0], [0.077 * s, 0.205, 0.03], [0.074 * s, 0.155, 0.025], [0.074 * s, 0.16, -0.008], h, S, sk, vs);   // orejas
    g.quad([0.077 * s, 0.205, 0.03], [0.077 * s, 0.205, -0.0], [0.074 * s, 0.16, -0.008], [0.074 * s, 0.155, 0.025], h, S, sk, vs);
  });
  g.quad([-0.045, 0.215, 0.097], [0.045, 0.215, 0.097], [0.04, 0.205, 0.104], [-0.04, 0.205, 0.104], h, S, C4.pelo);         // cejas
  if (o.bigote) g.quad([-0.03, 0.128, 0.122], [0.03, 0.128, 0.122], [0.026, 0.118, 0.118], [-0.026, 0.118, 0.118], h, S, C4.pelo);
  if (o.toc) { const t = new GeoBuilder(); headgear(t, h, o.toc, o); mergeScaled(g, t, [0, 0.17, 0], 0.8, 0.012); }
}
function soldierHand(g, part, y, side, grip) {
  const sk = C.piel, vs = V.SKIN;
  g.loft(part, Z.FIX, sk, [[y + 0.015, 0.032, 0.024], [y - 0.07, 0.044, 0.024, 0, 0.01]], 6, {capB: true, vr: vs, p: 3});   // palma
  if (grip) g.box(part, Z.FIX, sk, [0, y - 0.085, 0.03], [0.07, 0.04, 0.045], {rot: [-30, 0, 0], vr: vs, taper: 0.1});                          // dedos cerrados
  else g.box(part, Z.FIX, sk, [0, y - 0.105, 0.012], [0.07, 0.06, 0.03], {taper: 0.15, vr: vs});
  g.box(part, Z.FIX, sk, [0.034 * side, y - 0.05, 0.035], [0.022, 0.055, 0.024], {rot: [-30, 0, 25 * side], vr: vs, noTop: true});           // pulgar
}
function buildSoldier(o) {
  const g = new GeoBuilder(), P = rigIndex('soldado'), era = o.era, AB = era === 'A' || era === 'B', coat = Z.MAIN, pants = Z.ACC, T = Z.TRIM, lite = o.lite;
  const legCol = era === 'A' ? 'polaina' : era >= 'D' ? (o.botas ? 'bota' : 'venda') : 'pantalon';
  // --- pelvis y faldones
  g.loft(P.pelvis, pants, 0, [[-0.13, 0.15, 0.1, 0, 0.0], [-0.06, 0.175, 0.112], [0.02, 0.172, 0.11], [0.09, 0.165, 0.105]], 8, {capA: true, p: 2.6});
  if (era === 'A') {                                                                                                // casaca corta con faldones atrás (vueltas de color de ribete)
    [1, -1].forEach(s => { const a = [0.03 * s, 0.04, -0.112], b = [0.15 * s, 0.04, -0.09], c = [0.09 * s, -0.4, -0.17], d = [0.015 * s, -0.4, -0.165];
      if (s > 0) { g.quad(a, b, c, d, P.pelvis, coat, 0); g.quad(a, d, c, b, P.pelvis, T, 0); } else { g.quad(a, d, c, b, P.pelvis, coat, 0); g.quad(a, b, c, d, P.pelvis, T, 0); } });
  } else {
    const L = era === 'B' ? -0.36 : era === 'C' ? -0.24 : era === 'D' ? -0.2 : -0.13, fl = era === 'B' ? 0.035 : 0.02;  // levita (B), guerrera (C/D), chaqueta (E)
    g.loft(P.pelvis, coat, 0, [[L, 0.19 + fl, 0.13 + fl * 0.6, 0, -0.005], [0.06, 0.174, 0.114]], 8, {p: 2.6});
    g.loft(P.pelvis, coat, 0, [[L, 0.188 + fl, 0.128 + fl * 0.6, 0, -0.005], [0.06, 0.172, 0.112]], 8, {p: 2.6, inside: true});    // forro (se ve desde abajo)
    if (era === 'B' || era === 'C') g.strap(P.pelvis, T, 0, [[0, 0.0, 0.122], [0, L + 0.01, 0.135]], 0.012, [0, 0, 1]);   // ribete delantero
  }
  // --- torso (superelipse: el pecho y la espalda casi planos para que el equipo asiente)
  const TR = [[0.0, 0.165, 0.105, 0, 0.0], [0.1, 0.172, 0.112, 0, 0.006], [0.22, 0.18, 0.12, 0, 0.012], [0.34, 0.185, 0.12, 0, 0.008], [0.42, 0.172, 0.104, 0, -0.006], [0.47, 0.11, 0.072, 0, -0.012], [0.5, 0.06, 0.055, 0, -0.005]];
  if (lite) TR.splice(1, 1);
  g.loft(P.torso, coat, 0, TR, 8, {capB: true, p: 3});
  const fz = (y, x) => { const r = TR.reduce((a, b) => b[0] <= y ? b : a, TR[0]); const rx = r[1], rz = r[2]; const u = Math.min(0.98, Math.abs(x) / rx); return (r[4] || 0) + rz * Math.pow(1 - Math.pow(u, 3), 1 / 3); };
  // cuello de la casaca (alto en A–D; vuelto en E)
  if (era < 'E') g.loft(P.torso, T, 0, [[0.485, 0.07, 0.068, 0, 0.0], [0.55, 0.066, 0.064, 0, 0.004]], 8, {capA: false}); else g.loft(P.torso, coat, 0, [[0.47, 0.11, 0.08, 0, 0.0], [0.53, 0.07, 0.07, 0, 0.004]], 8, {});
  // botonadura y vistas
  if (era <= 'D' && !lite) {
    const nb = era === 'A' ? 7 : 6, bc = era >= 'D' ? 0x6a6040 : C4.boton;
    if (era === 'A') g.quad([-0.075, 0.08, fz(0.08, 0.075) + 0.004], [0.075, 0.08, fz(0.08, 0.075) + 0.004], [0.095, 0.44, fz(0.44, 0.095) + 0.004], [-0.095, 0.44, fz(0.44, 0.095) + 0.004], P.torso, T, 0);   // pechera (solapa de color)
    for (let i = 0; i < nb; i++) { const y = 0.06 + i * (0.38 / (nb - 1)), z = fz(y, 0) + 0.007, r = 0.011; g.quad([-r, y - r, z], [r, y - r, z], [r, y + r, z], [-r, y + r, z], P.torso, Z.FIX, bc); }
    if (era >= 'C') [1, -1].forEach(s => g.box(P.torso, coat, 0, [0.1 * s, 0.335, fz(0.335, 0.1) + 0.004], [0.085, 0.05, 0.012], {noBack: true, rot: [8, 0, 0]}));   // bolsillos de pecho
  }
  // hombreras (palas) con botón
  [1, -1].forEach(s => g.box(P.torso, era >= 'C' ? coat : T, 0, [0.15 * s, 0.452, -0.004], [0.11, 0.012, 0.06], {rot: [0, 0, -28 * s]}));
  // --- correaje y equipo
  const belts = (AB || era === 'C') && o.correaje !== false && !lite;
  if (era === 'E') { if (!lite) eKit(g, P, o); g.loft(P.torso, Z.FIX, C.cuero, [[0.0, 0.172, 0.112], [0.055, 0.174, 0.114]], 8, {p: 3, flatN: true}); }
  else if (!lite) {
    const bc = AB ? C.correaB : C.cuero;
    g.loft(P.torso, Z.FIX, bc, [[0.0, 0.17, 0.11], [0.05, 0.172, 0.113]], 8, {p: 3, flatN: true});                       // cinturón
    g.box(P.torso, Z.FIX, C4.hebilla, [0, 0.025, fz(0.025, 0) + 0.006], [0.06, 0.05, 0.01], {noBack: true});
    if (belts && AB) [1, -1].forEach(s => {                                                                         // correajes cruzados (cartuchera / bayoneta)
      const pts = [[-0.17 * s, 0.03, 0], [-0.07 * s, 0.14, 0], [0.06 * s, 0.3, 0], [0.165 * s, 0.44, 0]];
      g.strap(P.torso, Z.FIX, bc, pts.map(q => [q[0], q[1], fz(q[1], q[0]) + 0.006 + (s > 0 ? 0.002 : 0)]), 0.05, [0, 0, 1]);
      g.strap(P.torso, Z.FIX, bc, pts.slice().reverse().map(q => [q[0], q[1], -fz(q[1], q[0]) + 0.012 - 0.006]), 0.05, [0, 0, -1]);
      if (s > 0) g.box(P.torso, Z.FIX, C4.latonO, [0, 0.215, fz(0.215, 0) + 0.012], [0.05, 0.06, 0.01], {noBack: true});   // placa del correaje
    });
    if (o.cartucheras !== false) {
      if (AB) g.box(P.torso, Z.FIX, C.cueroN, [-0.12, -0.03, -0.13], [0.2, 0.13, 0.07], {bottom: true});            // cartuchera trasera
      else [0.11, -0.11].forEach(x => g.box(P.torso, Z.FIX, C.cuero, [x, 0.0, Math.abs(x) > 0.15 ? 0.04 : fz(0.0, x) + 0.02], [Math.abs(x) > 0.15 ? 0.04 : 0.075, 0.08, Math.abs(x) > 0.15 ? 0.09 : 0.04], {bottom: true}));
      if (o.arma === 'mosquete' || o.arma === 'fusil' || o.bayoneta) g.box(P.torso, Z.FIX, C.cueroN, [0.18, -0.12, -0.06], [0.03, 0.3, 0.04], {rot: [-12, 0, 6], taper: 0.4});   // vaina de la bayoneta
    }
    if (era >= 'B') g.loft(P.torso, Z.FIX, era >= 'C' ? 0x6a6448 : C.cuero, [[-0.07, 0.055, 0.06], [0.07, 0.055, 0.06]], 6, {at: [-0.2, -0.02, -0.06], rot: [0, 0, 90], axis: 'y', capA: true, capB: true, domeA: 0.015, domeB: 0.015, p: 2.4});   // cantimplora
    if (era >= 'B' && o.mochila !== false) g.box(P.torso, Z.FIX, era >= 'C' ? C.lona : C.cuero, [0.17, -0.06, -0.06], [0.06, 0.2, 0.2], {rot: [0, 0, 4], bottom: true});   // morral
  }
  if (o.mochila !== false && !lite && era !== 'E') {
    const pk = era === 'A' || era === 'B' ? C.mochila : C.lona;
    g.box(P.torso, Z.FIX, pk, [0, 0.28, -0.185], [0.32, 0.32, 0.12], {taper: 0.04, bottom: true});
    g.box(P.torso, Z.FIX, era >= 'C' ? 0x5a5a3e : C.cueroN, [0, 0.38, -0.24], [0.33, 0.14, 0.012], {rot: [10, 0, 0], noTop: true});   // tapa
    const rol = era === 'A' ? C.manta : 0x6a6a58;                                                                    // manta / capote enrollado
    if (era === 'A' || era === 'B') g.loft(P.torso, Z.FIX, rol, [[-0.17, 0.05, 0.05], [0.17, 0.05, 0.05]], 6, {axis: 'x', at: [0, 0.48, -0.18], capA: true, capB: true});
    else g.loft(P.torso, Z.FIX, rol, [[-0.17, 0.045, 0.045, -0.07], [-0.1, 0.05, 0.05], [0.1, 0.05, 0.05], [0.17, 0.045, 0.045, -0.07]], 6, {axis: 'x', at: [0, 0.47, -0.17], capA: true, capB: true});
    [1, -1].forEach(s => g.strap(P.torso, Z.FIX, AB ? C.correaB : C.cuero, [[0.12 * s, 0.44, fz(0.44, 0.12) + 0.004], [0.12 * s, 0.3, fz(0.3, 0.12) + 0.006], [0.15 * s, 0.1, fz(0.1, 0.15) + 0.005]], 0.035, [0, 0, 1]));   // tirantes
  }
  if (o.espalda === 'pala') { g.box(P.torso, Z.FIX, C.hierro, [0.05, 0.22, -0.26], [0.17, 0.22, 0.015], {rot: [0, 0, 15]}); g.box(P.torso, Z.FIX, C.madera, [0.0, 0.45, -0.26], [0.03, 0.3, 0.03], {rot: [0, 0, 15]}); }
  if (o.rango === 'oficial') {
    if (AB) { g.loft(P.torso, T, 0, [[0.03, 0.176, 0.116], [0.1, 0.18, 0.12]], 8, {p: 3, flatN: true}); g.box(P.torso, T, 0, [0.15, -0.08, 0.06], [0.05, 0.22, 0.02], {rot: [0, 0, 10]}); }   // faja con borlas
    else g.strap(P.torso, Z.FIX, C.cuero, [[-0.17, 0.03, 0], [0.165, 0.44, 0]].map(q => [q[0], q[1], fz(q[1], q[0]) + 0.006]), 0.035, [0, 0, 1]);   // correa Sam Browne
    g.box(P.torso, Z.FIX, C.cueroN, [-0.19, -0.1, 0.03], [0.04, 0.16, 0.08], {bottom: true});                        // pistolera / cartera
  }
  // --- cabeza
  soldierHead(g, P.cabeza, {toc: o.toc, lite, plumero: o.plumero, penacho: o.penacho, bigote: era >= 'B' && era <= 'D'});
  // --- brazos (pivote en el hombro; brazo 0,29 m, antebrazo 0,27 m)
  [['brazoIz', 'antebrazoIz', 1], ['brazoDe', 'antebrazoDe', -1]].forEach(([u, l, s]) => {
    g.loft(P[u], coat, 0, [[-0.29, 0.045, 0.05, 0, 0.0], [-0.17, 0.052, 0.058, 0.004 * s, 0.0], [-0.05, 0.066, 0.068, 0.006 * s, 0], [0.03, 0.058, 0.062, 0.0, 0.0]], 6, {capB: true, domeB: 0.02});
    if (o.charreteras) { g.loft(P[u], T, 0, [[0.03, 0.075, 0.07], [0.05, 0.06, 0.055]], 6, {at: [0.01 * s, 0, 0], capB: true}); if (AB) g.loft(P[u], Z.FIX, C.oro, [[-0.04, 0.078, 0.073], [0.03, 0.075, 0.07]], 6, {at: [0.01 * s, 0, 0]}); }
    if (o.brazalete && s > 0) g.loft(P[u], Z.FIX, C.blanco, [[-0.13, 0.056, 0.061], [-0.06, 0.06, 0.065]], 6, {});
    g.loft(P[l], coat, 0, [[-0.215, 0.038, 0.04], [-0.12, 0.046, 0.05, 0, 0.004], [0.02, 0.046, 0.05]], 6, {});
    g.loft(P[l], T, 0, [[-0.235, 0.044, 0.046], [-0.17, 0.05, 0.052]], 6, {capA: true});                               // vuelta de la manga
    soldierHand(g, P[l], -0.255, s, true);
  });
  if (o.brazalete) { g.quad([0.03, -0.088, 0.064], [-0.03, -0.088, 0.064], [-0.03, -0.102, 0.064], [0.03, -0.102, 0.064], P.brazoIz, Z.FIX, C.rojo); g.quad([0.007, -0.07, 0.065], [-0.007, -0.07, 0.065], [-0.007, -0.12, 0.065], [0.007, -0.12, 0.065], P.brazoIz, Z.FIX, C.rojo); }
  if (o.catalejo) g.loft(P.antebrazoIz, Z.FIX, C.laton, [[-0.04, 0.022, 0.022], [0.1, 0.019, 0.019], [0.2, 0.016, 0.016]], 6, {axis: 'z', at: [0, -0.3, 0.02], capA: true, capB: true});
  // --- piernas (muslo 0,42 m; pierna 0,35 m hasta el tobillo) y pies articulados
  [['musloIz', 'piernaIz', 'pieIz', 1], ['musloDe', 'piernaDe', 'pieDe', -1]].forEach(([u, l, f, s]) => {
    g.loft(P[u], pants, 0, [[-0.43, 0.055, 0.06, 0, 0.004], [-0.27, 0.066, 0.072, 0.004 * s, 0.006], [-0.1, 0.08, 0.086, 0.006 * s, 0.0], [0.04, 0.088, 0.09, 0, -0.005]], 6, {});
    const lz = legCol === 'pantalon' ? pants : Z.FIX, lc = legCol === 'polaina' ? C.negro : legCol === 'bota' ? C.bota : legCol === 'venda' ? C.panno : 0;
    if (legCol === 'pantalon' || legCol === 'venda') g.loft(P[l], legCol === 'venda' ? pants : pants, 0, [[-0.2, 0.05, 0.055], [-0.08, 0.056, 0.064, 0, -0.008], [0.03, 0.056, 0.06]], 6, {});
    else g.loft(P[l], lz, lc, [[-0.2, 0.05, 0.056], [-0.08, 0.057, 0.066, 0, -0.008], [0.03, 0.058, 0.062]], 6, {});
    // caña baja: polaina (A), pantalón sobre el botín (B/C), vendas o caña de bota (D/E)
    if (legCol === 'pantalon') g.loft(P[l], pants, 0, [[-0.37, 0.05, 0.056, 0, 0.004], [-0.2, 0.046, 0.05]], 6, {capA: false});
    else if (legCol === 'venda') { g.loft(P[l], Z.FIX, lc, [[-0.33, 0.043, 0.048], [-0.25, 0.046, 0.052], [-0.13, 0.054, 0.061, 0, -0.006]], 6, {}); [-0.3, -0.24, -0.18].forEach(y => g.strap(P[l], Z.FIX, 0x5a5440, [[0.05, y, 0.03], [-0.05, y - 0.02, 0.03]], 0.008, [0, 0, 1])); }
    else { g.loft(P[l], Z.FIX, lc, [[-0.33, 0.046, 0.052], [-0.2, 0.049, 0.055]], 6, {}); if (legCol === 'polaina') for (let i = 0; i < 4; i++) g.quad([0.045 * s + 0.004 * s, -0.31 + i * 0.07, 0.0], [0.045 * s + 0.004 * s, -0.31 + i * 0.07, 0.014], [0.045 * s + 0.004 * s, -0.3 + i * 0.07, 0.014], [0.045 * s + 0.004 * s, -0.3 + i * 0.07, 0.0], P[l], Z.FIX, C4.botonB); }
    // pie (pivote en el tobillo; suela a −0,08)
    const sh = era >= 'D' && o.botas || legCol === 'bota' ? C.bota : C.cueroN;
    g.loft(P[f], Z.FIX, sh, [[-0.065, 0.036, 0.034, 0, -0.045], [-0.01, 0.044, 0.05, 0, -0.03], [0.09, 0.047, 0.033, 0, -0.05], [0.175, 0.036, 0.02, 0, -0.062]], 6, {axis: 'z', capA: true, capB: true, domeB: 0.012, p: 2.4});
    g.quad([-0.04, -0.081, -0.07], [0.04, -0.081, -0.07], [0.042, -0.081, 0.19], [-0.042, -0.081, 0.19], P[f], Z.FIX, C4.suela); g.quad([0.04, -0.081, -0.07], [-0.04, -0.081, -0.07], [-0.042, -0.081, 0.19], [0.042, -0.081, 0.19], P[f], Z.FIX, C4.suela);
    if (legCol !== 'bota' && legCol !== 'venda') g.loft(P[f], legCol === 'polaina' ? Z.FIX : pants, legCol === 'polaina' ? C.negro : 0, [[-0.03, 0.05, 0.055], [0.04, 0.045, 0.05]], 6, {at: [0, 0, 0.0]});   // botamanga / polaina sobre el empeine
  });
  weapon(g, P.arma, o.arma, o);
  return g;
}

// tubo entre dos puntos A → B con perfil [[f (0..1), r]] (secciones circulares; o.sx ensancha en el eje lateral)
GeoBuilder.prototype.tube = function (part, zone, color, A, B, prof, n, o) {
  o = o || {}; const d = [B[0] - A[0], B[1] - A[1], B[2] - A[2]], L = Math.hypot(d[0], d[1], d[2]) || 1e-4, dir = d.map(v => v / L);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(dir[0], dir[1], dir[2])), e = new THREE.Euler().setFromQuaternion(q, 'XYZ');
  return this.loft(part, zone, color, prof.map(([f, r, rz]) => [f * L, r * (o.sx || 1), rz != null ? rz : r]), n, Object.assign({}, o, {at: A, rot: [e.x / D2R, e.y / D2R, e.z / D2R]}));
};

/* ---------------- caballo (y mula / buey de tiro) ----------------
   Cotas: cruz 1,50 m, dorso 1,40, vientre 0,85, codo 1,0, rodilla 0,58, corvejón 0,62. Mira hacia +z. Proporciones de un caballo de
   caballería de 1,52 m (15 palmos); la mula es un 8 % más baja, con orejas largas y crin corta; el buey (carreta) va aparte. */
function horse4(g, P, o) {
  const an = o.animal || 'caballo', mula = an === 'mula', hv = V.HORSE, hc = 0xffffff, cr = C4.crinO, F = Z.FIX;
  const body = P.body, neck = P.neck, head = P.head;
  g.loft(body, F, hc, [[-0.76, 0.06, 0.1, 0, 0.06], [-0.7, 0.16, 0.22, 0, 0.06], [-0.55, 0.23, 0.28, 0, 0.05], [-0.32, 0.245, 0.29, 0, 0.03], [-0.05, 0.25, 0.27, 0, 0.0],
    [0.22, 0.26, 0.29, 0, 0.02], [0.46, 0.225, 0.3, 0, 0.06], [0.64, 0.15, 0.24, 0, 0.05], [0.73, 0.06, 0.12, 0, 0.04]], 10, {axis: 'z', p: 2.2, capA: true, capB: true, vr: hv, a0: Math.PI / 10});
  g.loft(body, F, hc, [[0.25, 0.13, 0.1, 0, 0.27], [0.5, 0.12, 0.1, 0, 0.28]], 6, {axis: 'z', vr: hv});                            // cruz
  // cuello (sube hacia delante 35°) con crin
  g.loft(neck, F, hc, [[-0.12, 0.16, 0.25, 0, 0.0], [0.05, 0.14, 0.21, 0, -0.01], [0.3, 0.105, 0.155, 0, -0.005], [0.56, 0.08, 0.12, 0, 0.01], [0.66, 0.075, 0.11, 0, 0.02]], 8, {rot: [35, 0, 0], vr: hv, capB: true});
  const crest = k => xf([[0, 0.05 + k * 0.6, -0.17 + k * 0.08 + Math.sin(k * Math.PI) * -0.02]], [0, 0, 0], [35, 0, 0])[0];
  for (let i = 0; i < 4; i++) { const a = crest(i / 4), b = crest((i + 1) / 4), dl = mula ? 0.04 : 0.1;
    [[1, 0.012], [-1, -0.012]].forEach(([s, x]) => { const q = [[x, a[1] + 0.03, a[2] - 0.02], [x, b[1] + 0.03, b[2] - 0.02], [x + s * 0.05, b[1] - dl, b[2] - 0.03], [x + s * 0.05, a[1] - dl, a[2] - 0.03]]; if (s > 0) g.quad(q[0], q[3], q[2], q[1], neck, F, cr); else g.quad(q[0], q[1], q[2], q[3], neck, F, cr); }); }
  // cabeza (de la nuca al morro, 0,56 m, inclinada 50°)
  if (head != null) {
    g.loft(head, F, hc, [[-0.06, 0.07, 0.1, 0, -0.04], [0.06, 0.1, 0.13, 0, -0.03], [0.2, 0.09, 0.115, 0, -0.01], [0.36, 0.068, 0.085, 0, 0.0], [0.5, 0.064, 0.075, 0, -0.005], [0.56, 0.05, 0.055, 0, -0.01]], 8,
      {axis: 'z', rot: [50, 0, 0], capB: true, domeB: 0.02, vr: hv, p: 2.2});
    const H = (x, y, z) => xf([[x, y, z]], [0, 0, 0], [50, 0, 0])[0];
    [1, -1].forEach(s => {
      const eL = mula ? 0.22 : 0.13, b = H(0.05 * s, 0.11, -0.04);                                                              // orejas
      g.tri([b[0] - 0.025 * s, b[1], b[2] + 0.02], [b[0] + 0.02 * s, b[1], b[2] - 0.02], [b[0] + 0.015 * s, b[1] + eL, b[2] - 0.04], head, F, hc, hv);
      g.tri([b[0] + 0.02 * s, b[1], b[2] - 0.02], [b[0] - 0.025 * s, b[1], b[2] + 0.02], [b[0] + 0.015 * s, b[1] + eL, b[2] - 0.04], head, F, hc, hv);
      const e = H(0.093 * s, 0.05, 0.12), e2 = H(0.088 * s, 0.03, 0.15);                                                         // ojo
      g.tri(e, s > 0 ? e2 : [e[0], e[1] - 0.025, e[2] + 0.005], s > 0 ? [e[0], e[1] - 0.025, e[2] + 0.005] : e2, head, F, C4.ojo);
      const n0 = H(0.04 * s, 0.03, 0.53), n1 = H(0.045 * s, -0.01, 0.52);                                                       // ollar
      g.tri(n0, s > 0 ? n1 : [n0[0], n0[1] - 0.02, n0[2] + 0.02], s > 0 ? [n0[0], n0[1] - 0.02, n0[2] + 0.02] : n1, head, F, C4.ojo);
    });
    const fl = H(0, 0.12, 0.02), fl2 = H(0, 0.1, 0.16);                                                                         // tupé
    g.quad([fl[0] - 0.04, fl[1], fl[2]], [fl[0] + 0.04, fl[1], fl[2]], [fl2[0] + 0.03, fl2[1] + 0.01, fl2[2]], [fl2[0] - 0.03, fl2[1] + 0.01, fl2[2]], head, F, cr);
  }
  // patas: anteriores (antebrazo / caña) y posteriores (pierna / caña desde el corvejón); casco oscuro
  const hoof = (part, y0, back) => g.loft(part, F, C4.casco, [[y0 + 0.075, 0.042, 0.046, 0, 0.03 * back], [y0, 0.052, 0.062, 0, 0.042 * back]], 6, {capA: true});
  const low = (part, y0, hind) => { const b = hind ? -1 : 1;
    g.loft(part, F, hc, [[y0 + 0.08, 0.033, 0.034, 0, 0.026], [y0 + 0.15, 0.04, 0.05, 0, -0.012], [y0 + 0.21, 0.033, 0.04, 0, -0.004], [hind ? 0.0 : -0.03, 0.04, hind ? 0.06 : 0.05, 0, hind ? -0.03 : 0], [0.04, hind ? 0.045 : 0.05, hind ? 0.06 : 0.055, 0, hind ? -0.03 : 0]], 6, {vr: hv});
    g.loft(part, F, cr, [[y0 + 0.07, 0.036, 0.038, 0, 0.026], [y0 + 0.13, 0.042, 0.054, 0, -0.008]], 6, {});                   // cerneja
    hoof(part, y0, 1); void b; };
  if (P.fl2 != null) {
    [P.fl, P.fr].forEach(k => g.loft(k, F, hc, [[-0.42, 0.045, 0.05], [-0.36, 0.05, 0.055, 0, 0.0], [-0.15, 0.066, 0.078, 0, -0.005], [0.04, 0.085, 0.11, 0, 0.0]], 6, {vr: hv}));
    [P.fl2, P.fr2].forEach(k => low(k, -0.575, false));
    [P.hl, P.hr].forEach(k => g.loft(k, F, hc, [[-0.46, 0.046, 0.065, 0, -0.03], [-0.3, 0.06, 0.09, 0, -0.01], [-0.1, 0.09, 0.15, 0, 0.02], [0.1, 0.12, 0.2, 0, 0.03]], 6, {vr: hv}));
    [P.hl2, P.hr2].forEach(k => low(k, -0.615, true));
  } else {                                                                                                                         // tiro: pata de una pieza
    [P.fl, P.fr].forEach(k => { g.loft(k, F, hc, [[-0.86, 0.035, 0.04], [-0.6, 0.038, 0.045], [-0.42, 0.048, 0.055], [-0.15, 0.066, 0.078], [0.04, 0.085, 0.11]], 6, {vr: hv}); hoof(k, -0.995, 1); });
    [P.hl, P.hr].forEach(k => { g.loft(k, F, hc, [[-0.86, 0.035, 0.045], [-0.5, 0.045, 0.06, 0, -0.03], [-0.3, 0.06, 0.09, 0, -0.01], [-0.05, 0.1, 0.16, 0, 0.02], [0.1, 0.12, 0.2, 0, 0.03]], 6, {vr: hv}); hoof(k, -0.995, 1); });
  }
  // cola: maslo y cerdas
  if (P.tail != null) {
    g.loft(P.tail, F, hc, [[0.02, 0.05, 0.05], [-0.18, 0.035, 0.04, 0, -0.06]], 6, {vr: hv});
    g.loft(P.tail, F, cr, [[-0.12, 0.05, 0.05, 0, -0.05], [-0.35, 0.08, 0.06, 0, -0.12], [-0.6, 0.07, 0.05, 0, -0.14], [mula ? -0.62 : -0.8, 0.03, 0.03, 0, -0.12]], 6, {capB: true, p: 1.6});
  }
}
// silla y arreos (en la parte 'silla', y = 0 a 1,38 m). La gualdrapa es del color de ribete (TRIM).
function tack(g, P, o, rider) {
  const S = P.silla, F = Z.FIX, AB = o.era === 'A' || o.era === 'B';
  if (o.gualdrapa !== false) [1, -1].forEach(s => {                                                                             // gualdrapa / mantilla
    const L = AB ? 0.44 : 0.32, D = AB ? 0.36 : 0.26, q = [[0.17 * s, 0.01, -L], [0.17 * s, 0.01, L * 0.8], [0.3 * s, -D, L * 0.75], [0.3 * s, -D, -L * 0.95]];
    if (s > 0) g.quad(q[0], q[3], q[2], q[1], S, Z.TRIM, 0); else g.quad(q[0], q[1], q[2], q[3], S, Z.TRIM, 0);
    if (AB) g.strap(S, Z.FIX, C.oro, [q[3], q[2]].map(p => [p[0] + 0.003 * s, p[1] + 0.02, p[2]]), 0.03, [s, 0, 0]);
  });
  g.loft(S, F, C.cuero, [[-0.27, 0.13, 0.04, 0, 0.09], [-0.2, 0.17, 0.05, 0, 0.04], [0.05, 0.16, 0.045, 0, 0.03], [0.2, 0.12, 0.05, 0, 0.06], [0.26, 0.06, 0.04, 0, 0.1]], 8, {axis: 'z', capA: true, capB: true, p: 2.6});   // asiento, borrén y perilla
  [1, -1].forEach(s => {
    g.quad([0.17 * s, 0.03, -0.12], [0.17 * s, 0.03, 0.2], [0.2 * s, -0.24, 0.17], [0.2 * s, -0.24, -0.06], S, F, C.cuero); g.quad([0.17 * s, 0.03, 0.2], [0.17 * s, 0.03, -0.12], [0.2 * s, -0.24, -0.06], [0.2 * s, -0.24, 0.17], S, F, C.cuero);   // faldones
    g.strap(S, F, C.cueroN, [[0.17 * s, 0.0, 0.14], [0.255 * s, -0.4, 0.17], [0.24 * s, -0.62, 0.13]], 0.04, [s, 0, 0]);       // cincha
    g.strap(S, F, C.cueroN, [[0.17 * s, 0.0, 0.0], [0.27 * s, -0.4, 0.06]], 0.018, [s, 0, 0]);                                 // ación
    g.box(S, F, C.hierro, [0.275 * s, -0.47, 0.08], [0.02, 0.1, 0.11], {noTop: true});                                         // estribo
  });
  g.loft(S, Z.TRIM, 0, [[-0.2, 0.06, 0.065], [0.2, 0.06, 0.065]], 6, {axis: 'x', at: [0, 0.08, -0.34], capA: true, capB: true});   // maleta
  if (AB) g.loft(S, F, 0x5a5448, [[-0.17, 0.05, 0.05, 0, -0.04], [0, 0.055, 0.055, 0, 0.02], [0.17, 0.05, 0.05, 0, -0.04]], 6, {axis: 'x', at: [0, 0.09, 0.3], capA: true, capB: true});   // capote
  else g.loft(S, F, C.lona, [[-0.05, 0.06, 0.09], [0.05, 0.06, 0.09]], 6, {axis: 'x', at: [0.25, -0.05, 0.28], capA: true, capB: true});   // bolsa de pienso
  // pretal y cabezada
  if (P.body != null) [1, -1].forEach(s => g.strap(P.body, F, C.cueroN, [[0.15 * s, 0.18, 0.5], [0.2 * s, 0.05, 0.58], [0.1 * s, -0.04, 0.7], [0.0, -0.06, 0.74]], 0.035, [s, 0, 0.6]));
  if (P.head != null) { const H = (x, y, z) => xf([[x, y, z]], [0, 0, 0], [50, 0, 0])[0];
    [1, -1].forEach(s => { g.strap(P.head, F, C.cueroN, [H(0.08 * s, 0.11, -0.03), H(0.104 * s, 0.03, 0.12), H(0.074 * s, -0.04, 0.36), H(0.066 * s, -0.03, 0.45)], 0.025, [s, 0, 0]);   // carrillera
      g.strap(P.head, F, C.cueroN, [H(0.0, 0.135, 0.06), H(0.1 * s, 0.11, 0.06)], 0.025, [0, 1, 0]); });                     // frontalera
    g.loft(P.head, F, C.cueroN, [[0.36, 0.074, 0.09], [0.4, 0.074, 0.09]], 8, {axis: 'z', rot: [50, 0, 0], p: 2.2});        // muserola
    g.loft(P.head, F, C.acero, [[-0.08, 0.008, 0.008], [0.08, 0.008, 0.008]], 4, {axis: 'x', at: H(0, -0.04, 0.46)});         // bocado
  }
  if (rider && P.neck != null) [1, -1].forEach(s => g.strap(P.neck, F, C.cueroN, [xf([[0.07 * s, 0.6, 0.12]], [0, 0, 0], [35, 0, 0])[0], [0.09 * s, 0.25, 0.28], [0.06 * s, 0.05, 0.3]], 0.02, [s, 0, 0]));   // riendas (cuello)
}
function horse(g, P, o) {   // compatibilidad: jinete v3 → v4
  horse4(g, {body: P.caballo, neck: P.cuello, head: P.testa, fl: P.manoIz, fr: P.manoDe, fl2: P.canaIz, fr2: P.canaDe, hl: P.pataIz, hr: P.pataDe, hl2: P.corvIz, hr2: P.corvDe, tail: P.cola}, o);
}
function buildRider(o) {
  const g = new GeoBuilder(), P = rigIndex('jinete'), era = o.era, AB = era === 'A' || era === 'B', t = o.tipo || 'husar', pants = Z.ACC, coat = Z.MAIN, T = Z.TRIM;
  horse(g, P, o); tack(g, {silla: P.silla, body: P.caballo, neck: P.cuello, head: P.testa}, o, true);
  // piernas del jinete fijas en la silla (asiento militar de estribo largo): muslo, pierna, bota con espuela
  const boot = AB || t === 'coracero' || t === 'dragon' || era >= 'C';
  [1, -1].forEach(s => {
    const hip = [0.1 * s, 0.1, -0.02], knee = [0.22 * s, -0.24, 0.2], ank = [0.255 * s, -0.62, 0.1];
    g.tube(P.silla, pants, 0, hip, knee, [[0, 0.085], [0.5, 0.075], [1, 0.058]], 6);
    g.tube(P.silla, boot ? Z.FIX : pants, boot ? C.bota : 0, knee, ank, [[-0.06, boot ? 0.062 : 0.056], [0.35, 0.055], [1, 0.04]], 6);
    g.loft(P.silla, Z.FIX, C.bota, [[-0.07, 0.037, 0.034, 0, -0.04], [0.0, 0.044, 0.05, 0, -0.03], [0.17, 0.035, 0.022, 0, -0.06]], 6, {axis: 'z', at: [0.27 * s, -0.56, 0.1], capA: true, capB: true});
    g.tube(P.silla, Z.FIX, C.acero, [0.27 * s, -0.6, 0.03], [0.27 * s, -0.6, -0.04], [[0, 0.008], [1, 0.004]], 3);            // espuela
  });
  // torso y faldones de la casaca sobre la silla
  const TR = [[0.0, 0.16, 0.103], [0.12, 0.168, 0.11, 0, 0.006], [0.24, 0.178, 0.118, 0, 0.012], [0.36, 0.18, 0.118, 0, 0.006], [0.42, 0.17, 0.102, 0, -0.006], [0.47, 0.105, 0.07, 0, -0.012], [0.5, 0.06, 0.055]];
  g.loft(P.torso, coat, 0, TR, 8, {capB: true, p: 3});
  g.loft(P.torso, coat, 0, [[-0.14, 0.2, 0.15, 0, -0.03], [0.04, 0.17, 0.11]], 8, {p: 2.6});
  g.loft(P.torso, era < 'E' ? T : coat, 0, [[0.485, 0.07, 0.068], [0.55, 0.066, 0.064, 0, 0.004]], 8, {});                       // cuello
  const fz = y => 0.112 + (y > 0.2 ? 0.006 : 0);
  if (t === 'husar' && AB) {                                                                                                      // dolmán con alamares y pelliza al hombro
    for (let i = 0; i < 6; i++) { const y = 0.08 + i * 0.065; g.strap(P.torso, Z.FIX, C.oro, [[-0.11, y, fz(y) + 0.008], [0.11, y, fz(y) + 0.008]], 0.014, [0, 0, 1]); }
    g.loft(P.torso, coat, 0, [[0.02, 0.2, 0.08, 0.1, -0.05], [0.46, 0.13, 0.08, 0.08, -0.05]], 6, {rot: [0, 0, -6]});
    g.loft(P.torso, Z.FIX, C.blanco, [[0.0, 0.205, 0.085, 0.1, -0.05], [0.06, 0.205, 0.085, 0.1, -0.05]], 6, {rot: [0, 0, -6]});   // ribete de piel
  } else if (t === 'coracero' && era < 'D') {
    g.loft(P.torso, Z.FIX, C.acero, [[0.04, 0.17, 0.125, 0, 0.01], [0.2, 0.185, 0.135, 0, 0.012], [0.38, 0.175, 0.12, 0, 0.0], [0.44, 0.14, 0.1]], 8, {p: 2.8});   // peto y espaldar
    [0.1, 0.32].forEach(y => g.box(P.torso, Z.FIX, C.laton, [0, y, 0.14], [0.02, 0.02, 0.01]));
  } else {
    for (let i = 0; i < 6; i++) { const y = 0.06 + i * 0.07, r = 0.011; g.quad([-r, y - r, fz(y) + 0.006], [r, y - r, fz(y) + 0.006], [r, y + r, fz(y) + 0.006], [-r, y + r, fz(y) + 0.006], P.torso, Z.FIX, era >= 'D' ? 0x6a6040 : C4.boton); }
  }
  if (t === 'general' || t === 'mariscal' || t === 'ayudante') g.loft(P.torso, T, 0, [[0.03, 0.17, 0.115], [0.1, 0.172, 0.118]], 8, {p: 3, flatN: true});   // faja
  else g.loft(P.torso, Z.FIX, AB ? C.correaB : C.cuero, [[0.0, 0.163, 0.108], [0.05, 0.165, 0.11]], 8, {p: 3, flatN: true});
  if (AB && t !== 'general' && t !== 'mariscal') g.strap(P.torso, Z.FIX, C.correaB, [[0.165, 0.44, 0.0], [0.05, 0.3, 0.125], [-0.1, 0.1, 0.115], [-0.17, 0.0, 0.0]], 0.045, [0, 0, 1]);   // bandolera
  if (t === 'dragon' || (era >= 'D' && (t === 'husar' || t === 'lancero' || t === 'coracero'))) g.tube(P.torso, Z.FIX, C.hierro, [0.2, -0.15, -0.14], [-0.12, 0.5, -0.15], [[0, 0.025], [0.25, 0.03], [1, 0.012]], 4);   // carabina a la espalda
  if (t === 'mensajero') g.box(P.torso, Z.FIX, C.cuero, [0.19, 0.04, 0.02], [0.05, 0.2, 0.24], {bottom: true});
    if (t === 'husar' && AB) g.box(P.silla, T, 0, [0.31, -0.3, -0.12], [0.02, 0.3, 0.24], {rot: [0, 0, 6]});   // portapliegos (sabretache)
  soldierHead(g, P.cabeza, {toc: o.toc, plumero: o.plumero, bigote: true});
  // brazos: izquierdo con las riendas (codo flexionado en la pose de reposo de los clips), derecho libre
  [['brazoIz', 'antebrazoIz', 1], ['brazoDe', 'antebrazoDe', -1]].forEach(([u, l, s]) => {
    g.loft(P[u], coat, 0, [[-0.28, 0.045, 0.05], [-0.17, 0.052, 0.058, 0.004 * s, 0.0], [-0.05, 0.064, 0.066, 0.006 * s, 0], [0.03, 0.056, 0.06]], 6, {capB: true, domeB: 0.02});
    if (t === 'general' || t === 'mariscal' || (o.charreteras && AB)) g.loft(P[u], T, 0, [[0.03, 0.075, 0.07], [0.05, 0.06, 0.055]], 6, {at: [0.01 * s, 0, 0], capB: true});
    g.loft(P[l], coat, 0, [[-0.215, 0.038, 0.04], [-0.12, 0.046, 0.05, 0, 0.004], [0.02, 0.046, 0.05]], 6, {});
    g.loft(P[l], T, 0, [[-0.235, 0.044, 0.046], [-0.17, 0.05, 0.052]], 6, {capA: true});
    soldierHand(g, P[l], -0.255, s, true);
  });
  if (t === 'general' || t === 'mariscal') g.loft(P.antebrazoIz, Z.FIX, C.laton, [[-0.04, 0.02, 0.02], [0.18, 0.016, 0.016]], 6, {axis: 'z', at: [0, -0.3, 0.03], capA: true, capB: true});
  weapon(g, P.arma, {husar: 'sable', coracero: 'sable', dragon: 'sable', lancero: 'lanza', general: 'sable', ayudante: 'sable', mariscal: 'baston', mensajero: 'ninguna', estandarte: 'astil_jinete'}[t], o);
  if (t !== 'mariscal' && t !== 'mensajero') g.tube(P.silla, Z.FIX, C.acero, [0.3, -0.08, 0.08], [0.33, -0.5, -0.66], [[0, 0.022], [1, 0.016]], 4);      // vaina del sable (lado izquierdo)
  return g;
}

/* ---------------- artillería ---------------- */
// rueda de radios (plano YZ, eje X): llanta de hierro, pinas de madera, radios y cubo. ~170 triángulos
function spokeWheel(g, part, R, o) {
  o = o || {}; const n = o.n || 14, ns = o.spokes || 12, w = o.w || 0.075, rim = o.rim || 0.065, wood = o.wood || C.madera, iron = o.iron || C.hierro, x0 = o.x || 0;
  const P = (r, a, x) => [x0 + x, Math.cos(a) * r, Math.sin(a) * r];
  for (let i = 0; i < n; i++) {
    const a = i / n * Math.PI * 2, b = (i + 1) / n * Math.PI * 2, ri = R - rim, h = w / 2;
    g.quad(P(R, a, h), P(R, a, -h), P(R, b, -h), P(R, b, h), part, Z.FIX, iron);                                                 // llanta
    g.quad(P(ri, b, h), P(ri, b, -h), P(ri, a, -h), P(ri, a, h), part, Z.FIX, wood);                                              // cara interior
    g.quad(P(ri, a, h), P(R, a, h), P(R, b, h), P(ri, b, h), part, Z.FIX, wood); g.quad(P(R, a, -h), P(ri, a, -h), P(ri, b, -h), P(R, b, -h), part, Z.FIX, wood);
  }
  for (let i = 0; i < ns; i++) { const a = (i + 0.5) / ns * Math.PI * 2, d = 0.022, A = [x0 + (o.dish || 0.03), 0, 0], B = P(R - rim, a, 0);
    const t = [0, -Math.sin(a), Math.cos(a)];
    g.quad([A[0], A[1] + t[1] * d, A[2] + t[2] * d], [B[0], B[1] + t[1] * d * 0.7, B[2] + t[2] * d * 0.7], [B[0], B[1] - t[1] * d * 0.7, B[2] - t[2] * d * 0.7], [A[0], A[1] - t[1] * d, A[2] - t[2] * d], part, Z.FIX, wood);
    g.quad([A[0], A[1] - t[1] * d, A[2] - t[2] * d], [B[0], B[1] - t[1] * d * 0.7, B[2] - t[2] * d * 0.7], [B[0], B[1] + t[1] * d * 0.7, B[2] + t[2] * d * 0.7], [A[0], A[1] + t[1] * d, A[2] + t[2] * d], part, Z.FIX, wood); }
  g.loft(part, Z.FIX, wood, [[x0 - 0.12, 0.07, 0.07], [x0 - 0.03, 0.1, 0.1], [x0 + 0.06, 0.1, 0.1], [x0 + 0.14, 0.06, 0.06]], 8, {axis: 'x', capA: true, capB: true});   // cubo
  g.loft(part, Z.FIX, iron, [[x0 + 0.12, 0.065, 0.065], [x0 + 0.19, 0.04, 0.04]], 6, {axis: 'x', capB: true});                // sotrozo / tuerca del eje
}
// perfil de un tubo a lo largo de z: [[z, r]], color, tapa oscura de la boca
function barrel(g, part, prof, col, o) {
  o = o || {}; g.loft(part, Z.FIX, col, prof.map(([z, r]) => [z, r, r, 0, o.y || 0]), o.n || 10, {axis: 'z', capA: true, capB: false, at: o.at, rot: o.rot});
  const [zm, rm] = prof[prof.length - 1], bore = o.bore || rm * 0.45;
  g.loft(part, Z.FIX, col, [[zm, rm, rm, 0, o.y || 0], [zm + 0.0001, bore * 1.15, bore * 1.15, 0, o.y || 0]], o.n || 10, {axis: 'z', at: o.at, rot: o.rot, nrm: _rotN([0, 0, 1], o.rot)});
  g.loft(part, Z.FIX, 0x0c0c0c, [[zm - 0.12, bore, bore, 0, o.y || 0], [zm, bore, bore, 0, o.y || 0]], 6, {axis: 'z', inside: true, capA: true, at: o.at, rot: o.rot});
}
function buildCannon(o) {
  const g = new GeoBuilder(), P = rigIndex('canon'), t = o.tipo || 'liso', era = o.era, F = Z.FIX;
  const wheels = (R, wood, iron, n) => ['ruedaIz', 'ruedaDe'].forEach((k, i) => spokeWheel(g, P[k], R, {wood, iron, x: 0, spokes: n || 12, dish: i ? -0.03 : 0.03}));
  const axle = (col) => { g.box(P.cureña, F, col, [0, 0.62, 0.15], [1.18, 0.09, 0.11], {noFront: false}); };
  const cheeks = (col, zf, zb, yb, hgt, gap) => [1, -1].forEach(s => {                                                       // gualderas
    const x = gap * s, q = [[x, yb, zb], [x, yb + hgt * 0.7, zb], [x, 0.98, zf - 0.05], [x, 0.9, zf + 0.12], [x, 0.56, zf + 0.1]];
    for (const dx of [0.035, -0.035]) { const pts = q.map(p => [p[0] + dx * s, p[1], p[2]]); const out = (dx > 0) === (s > 0);
      for (let i = 1; i < pts.length - 1; i++) out ? g.tri(pts[0], pts[i + 1], pts[i], P.cureña, F, col) : g.tri(pts[0], pts[i], pts[i + 1], P.cureña, F, col); }
    g.quad([x + 0.035 * s, 0.98, zf - 0.05], [x - 0.035 * s, 0.98, zf - 0.05], [x - 0.035 * s, yb + hgt * 0.7, zb], [x + 0.035 * s, yb + hgt * 0.7, zb], P.cureña, F, col);
  });
  const trail = (col, iron, wdt) => {                                                                                      // contera (mástil único)
    g.tube(P.cureña, F, col, [0, 0.66, -0.15], [0, 0.1, -2.0], [[0, wdt * 0.7, wdt], [1, wdt * 0.55, wdt * 0.8]], 4, {p: 6});
    g.box(P.cureña, F, iron, [0, 0.07, -2.02], [wdt * 1.3, 0.04, 0.2], {bottom: true});                                     // contera de hierro
    g.loft(P.cureña, F, iron, [[-0.06, 0.07, 0.07], [0.06, 0.07, 0.07]], 6, {axis: 'x', at: [0, 0.3, -1.6]});               // argolla de la contera
    [1, -1].forEach(s => g.tube(P.cureña, F, iron, [0.12 * s, 0.4, -1.1], [0.12 * s, 0.4, -1.25], [[0, 0.015], [1, 0.015]], 4));   // manijas
  };
  if (t === 'liso' || (t === 'obus' && era < 'D')) {
    const W = 0x5e6a48, IR = C.hierro;
    cheeks(W, 0.4, -0.55, 0.45, 0.4, 0.16); trail(W, IR, 0.22); axle(W);
    [1, -1].forEach(s => g.box(P.cureña, F, W, [0.4 * s, 0.75, 0.15], [0.3, 0.22, 0.28], {bottom: true}));                  // cofres del eje
    g.tube(P.cureña, F, IR, [0, 0.62, -0.3], [0, 0.85, -0.3], [[0, 0.025], [1, 0.02]], 4);                                     // tornillo de puntería
    wheels(0.66, C.madera, IR, 12);
    if (t === 'liso') barrel(g, P.tubo, [[-0.62, 0.0], [-0.6, 0.035], [-0.56, 0.025], [-0.52, 0.1], [-0.49, 0.13], [-0.13, 0.124], [-0.12, 0.112], [0.5, 0.095], [0.54, 0.102], [0.57, 0.088], [0.74, 0.1], [0.8, 0.108], [0.84, 0.104]], C.bronce, {bore: 0.047});
    else barrel(g, P.tubo, [[-0.42, 0.0], [-0.4, 0.04], [-0.36, 0.12], [-0.3, 0.16], [-0.05, 0.17], [0.1, 0.16], [0.36, 0.15], [0.42, 0.165], [0.46, 0.16]], C.bronce, {bore: 0.075, rot: [-32, 0, 0], at: [0, 0.12, 0.1]});
    g.loft(P.tubo, F, C.bronce, [[-0.21, 0.045, 0.045], [0.21, 0.045, 0.045]], 6, {axis: 'x', at: t === 'liso' ? [0, 0, 0.0] : [0, 0.1, 0.05], capA: true, capB: true});   // muñones
  } else if (t === 'rc' || t === 'obus') {
    if (era >= 'D') {                                                                                                      // 75 mm / obús de 105 con freno hidroneumático y escudo
      const W = 0x5a5c4a;
      g.tube(P.cureña, F, W, [0, 0.6, -0.1], [0, 0.12, -2.0], [[0, 0.12, 0.18], [1, 0.09, 0.12]], 4, {p: 6}); g.box(P.cureña, F, C.hierro, [0, 0.1, -2.05], [0.4, 0.05, 0.22], {bottom: true});   // mástil y reja
      axle(W); g.box(P.cureña, F, W, [0, 0.8, 0.1], [0.3, 0.22, 0.7]);
      [1, -1].forEach(s => g.box(P.cureña, F, W, [0.27 * s, 0.98, 0.42], [0.55, 0.85, 0.035], {rot: [-6, 6 * s, 0], bottom: true}));   // escudo (dos hojas)
      g.box(P.cureña, F, W, [0, 0.42, 0.45], [0.95, 0.32, 0.03], {rot: [8, 0, 0]});                                            // faldón del escudo
      g.box(P.cureña, F, C.negro, [0.12, 1.2, 0.44], [0.08, 0.05, 0.05]);                                                       // mirilla
      if (t === 'rc') { barrel(g, P.tubo, [[-0.55, 0.0], [-0.54, 0.1], [-0.3, 0.1], [-0.28, 0.075], [1.0, 0.06], [1.6, 0.052], [1.64, 0.058]], 0x4a4c48, {bore: 0.038});
        g.loft(P.tubo, F, 0x3e403c, [[-0.5, 0.075, 0.075], [0.75, 0.07, 0.07]], 8, {axis: 'z', at: [0, -0.15, 0], capA: true, capB: true}); }   // cilindro del freno
      else { barrel(g, P.tubo, [[-0.4, 0.0], [-0.38, 0.14], [-0.15, 0.14], [-0.12, 0.11], [0.75, 0.095], [0.8, 0.1]], 0x4a4c48, {bore: 0.053, rot: [-30, 0, 0], at: [0, 0.12, 0.25]});
        g.loft(P.tubo, F, 0x3e403c, [[-0.3, 0.08, 0.08], [0.5, 0.075, 0.075]], 8, {axis: 'z', rot: [-30, 0, 0], at: [0, 0.0, 0.2], capA: true, capB: true}); }
      wheels(0.6, C.maderaO, 0x3a3c38, 12);
    } else {                                                                                                               // acero de retrocarga (Krupp / De Bange, 1860–1900)
      const W = 0x3e4a5a;
      cheeks(W, 0.4, -0.55, 0.45, 0.36, 0.15); trail(W, C.hierro, 0.2); axle(W);
      g.tube(P.cureña, F, C.hierro, [0, 0.62, -0.32], [0, 0.88, -0.32], [[0, 0.022], [1, 0.018]], 4);
      barrel(g, P.tubo, [[-0.62, 0.0], [-0.6, 0.12], [-0.38, 0.12], [-0.36, 0.105], [0.0, 0.1], [0.05, 0.085], [1.3, 0.062], [1.34, 0.066]], 0x2c2e30, {bore: 0.04});
      g.box(P.tubo, F, 0x4a4c50, [0, 0, -0.52], [0.24, 0.24, 0.2], {bottom: true});                                             // cierre de cuña
      g.loft(P.tubo, F, 0x2c2e30, [[-0.2, 0.04, 0.04], [0.2, 0.04, 0.04]], 6, {axis: 'x', capA: true, capB: true});
      wheels(0.62, C.madera, C.hierro, 12);
    }
  } else if (t === 'mg') {
    if (era >= 'D') {                                                                                                      // Maxim / Vickers sobre trípode
      const D = 0x4a4c40;
      [[0, -0.75], [0.42, 0.32], [-0.42, 0.32]].forEach(([x, z]) => g.tube(P.cureña, F, D, [0, 0.5, 0], [x, 0.02, z], [[0, 0.03], [1, 0.022]], 4));
      g.loft(P.cureña, F, D, [[0.42, 0.06, 0.06], [0.55, 0.05, 0.05]], 6, {capB: true});
      barrel(g, P.tubo, [[-0.02, 0.07], [0.62, 0.068], [0.66, 0.04], [0.82, 0.025]], 0x5a5e50, {bore: 0.012, y: -0.32, at: [0, 0, 0.1], n: 8});   // camisa de agua y bocacha
      g.box(P.tubo, F, 0x3a3c38, [0, -0.32, -0.22], [0.15, 0.17, 0.42], {bottom: true});                                         // cajón de mecanismos
      [1, -1].forEach(s => g.tube(P.tubo, F, 0x3a3c38, [0.06 * s, -0.32, -0.43], [0.06 * s, -0.3, -0.52], [[0, 0.016], [1, 0.016]], 4));   // empuñaduras
      g.box(P.tubo, F, 0x6a6448, [0.2, -0.38, -0.15], [0.12, 0.16, 0.24], {bottom: true});                                       // caja de cinta
      g.strap(P.tubo, F, 0x8a7a50, [[0.14, -0.32, -0.15], [0.08, -0.3, -0.12]], 0.05, [0, 1, 0]);
    } else {                                                                                                               // Gatling sobre cureña ligera: haz de 6 cañones (gira con el clip)
      const W = 0x6a6a54;
      cheeks(W, 0.35, -0.45, 0.48, 0.3, 0.13); trail(W, C.hierro, 0.18); axle(W);
      for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; g.loft(P.tubo, F, 0x3a3c38, [[-0.15, 0.022, 0.022, Math.cos(a) * 0.07, Math.sin(a) * 0.07], [0.85, 0.02, 0.02, Math.cos(a) * 0.07, Math.sin(a) * 0.07]], 5, {axis: 'z'}); }
      [-0.15, 0.4, 0.82].forEach(z => g.loft(P.tubo, F, C.laton, [[z - 0.02, 0.105, 0.105], [z + 0.02, 0.105, 0.105]], 8, {axis: 'z', capA: true, capB: true}));
      g.box(P.tubo, F, C.laton, [0, 0, -0.38], [0.24, 0.24, 0.42], {bottom: true});                                             // cuerpo de bronce
      g.box(P.tubo, F, 0x3a3c38, [0, 0.2, -0.3], [0.09, 0.18, 0.14], {noFront: true});                                        // tolva
      g.tube(P.tubo, F, C.hierro, [0.13, 0, -0.45], [0.2, -0.1, -0.45], [[0, 0.012], [1, 0.012]], 3);                            // manivela
      wheels(0.55, C.madera, C.hierro, 10);
    }
  }
  return g;
}

/* ---------------- tiros ---------------- */
// figura sentada fija (conductor): at = punto del asiento
function seatedFigure(g, part, at, o) {
  const [x, y, z] = at, M = Z.MAIN, A = Z.ACC;
  g.loft(part, M, 0, [[y + 0.02, 0.15, 0.1, x, z], [y + 0.25, 0.165, 0.11, x, z + 0.01], [y + 0.42, 0.16, 0.1, x, z - 0.005], [y + 0.5, 0.1, 0.07, x, z - 0.01], [y + 0.53, 0.05, 0.05, x, z]], 8, {capB: true, p: 3});
  const t = new GeoBuilder(); soldierHead(t, part, {toc: o.toc || 'kepi', bigote: true}); mergeScaled(g, t, [0, 0, 0], 1, 0); for (let i = g.p.length - t.p.length; i < g.p.length; i += 3) { g.p[i] += x; g.p[i + 1] += y + 0.53; g.p[i + 2] += z; }
  [1, -1].forEach(s => {
    g.tube(part, A, 0, [x + 0.09 * s, y + 0.05, z], [x + 0.2 * s, y - 0.2, z + 0.25], [[0, 0.075], [1, 0.055]], 6);
    g.tube(part, Z.FIX, C.bota, [x + 0.2 * s, y - 0.2, z + 0.25], [x + 0.24 * s, y - 0.6, z + 0.12], [[0, 0.056], [1, 0.042]], 6, {capB: true});
    g.tube(part, M, 0, [x + 0.19 * s, y + 0.44, z], [x + 0.22 * s, y + 0.22, z + 0.12], [[0, 0.055], [1, 0.045]], 6);
    g.tube(part, M, 0, [x + 0.22 * s, y + 0.22, z + 0.12], [x + 0.1 * s, y + 0.18, z + 0.36], [[0, 0.045], [1, 0.04]], 6);
    g.loft(part, Z.FIX, C.piel, [[z + 0.36, 0.035, 0.03, x + 0.1 * s, y + 0.18], [z + 0.44, 0.03, 0.025, x + 0.09 * s, y + 0.18]], 6, {axis: 'z', capB: true, vr: V.SKIN});
  });
}
function ox(g, P, k, col) {   // buey: cuerpo ancho, papada, cuernos y yugo
  const b = P['an' + k], cu = P['an' + k + 'cu'], te = P['an' + k + 'te'], F = Z.FIX;
  g.loft(b, F, col, [[-0.8, 0.08, 0.12, 0, 0.0], [-0.72, 0.24, 0.3, 0, 0.0], [-0.4, 0.3, 0.33, 0, 0.0], [0.1, 0.31, 0.34, 0, -0.02], [0.45, 0.28, 0.36, 0, 0.02], [0.66, 0.18, 0.3, 0, 0.02], [0.75, 0.08, 0.15, 0, 0.0]], 10, {axis: 'z', p: 2.3, capA: true, capB: true});
  g.loft(b, F, col, [[0.2, 0.12, 0.08, 0, 0.32], [0.55, 0.1, 0.1, 0, 0.33]], 6, {axis: 'z'});                                    // giba
  g.loft(cu, F, col, [[-0.05, 0.18, 0.26, 0, -0.02], [0.25, 0.14, 0.2, 0, 0.0], [0.42, 0.12, 0.16, 0, 0.0]], 8, {axis: 'z', rot: [-15, 0, 0], at: [0, -0.15, -0.1]});
  g.loft(cu, F, col, [[0.0, 0.03, 0.12, 0, -0.2], [0.35, 0.02, 0.08, 0, -0.18]], 4, {axis: 'z', at: [0, -0.15, 0]});              // papada
  if (te != null) {
    g.loft(te, F, col, [[-0.45, 0.1, 0.13, 0, -0.38], [-0.3, 0.12, 0.13, 0, -0.42], [-0.1, 0.09, 0.1, 0, -0.5], [0.0, 0.085, 0.08, 0, -0.54]], 8, {axis: 'z', capB: true, at: [0, 0, 0]});
    [1, -1].forEach(s => { g.tube(te, F, 0xe8dcc0, [0.1 * s, -0.27, -0.4], [0.28 * s, -0.15, -0.38], [[0, 0.03], [1, 0.012]], 4); g.tube(te, F, 0xe8dcc0, [0.28 * s, -0.15, -0.38], [0.33 * s, 0.0, -0.32], [[0, 0.012], [1, 0.0]], 4); });
    g.loft(te, F, 0x1c1610, [[-0.01, 0.05, 0.03, 0, -0.56], [0.01, 0.05, 0.03, 0, -0.56]], 6, {axis: 'z'});
  }
}
function buildTeam(o) {
  const g = new GeoBuilder(), P = rigIndex('tiro'), t = o.tipo, an = o.animal || 'caballo', F = Z.FIX, W = 0x5e6a48;
  const wheel = (k, r) => spokeWheel(g, P[k], r, {wood: C.madera, iron: C.hierro, spokes: r > 0.6 ? 12 : 10, n: 12, x: 0, dish: k.endsWith('I') ? 0.03 : -0.03});
  if (t === 'avantren') {
    g.box(P.caja, F, W, [0, 0.14, -1.0], [1.0, 0.45, 0.6], {bottom: true}); g.box(P.caja, F, 0x4a5638, [0, 0.38, -1.0], [1.04, 0.04, 0.64]);   // cofre y tapa
    [-0.3, 0.3].forEach(x => g.box(P.caja, F, C.hierro, [x, 0.2, -0.69], [0.12, 0.08, 0.02]));                                    // cerraduras
    g.box(P.caja, F, C.hierro, [0, -0.25, -1.0], [1.4, 0.08, 0.09], {noFront: true, noBack: true}); wheel('ruedaTI', 0.66); wheel('ruedaTD', 0.66);
    g.tube(P.caja, F, C.hierro, [0, -0.2, -1.32], [0, -0.32, -1.55], [[0, 0.03], [1, 0.03]], 4);                                   // gancho de enganche
  } else if (t === 'municion') {
    [1.0, -0.95].forEach(z => { g.box(P.caja, F, W, [0, 0.14, z], [1.0, 0.42, 0.62], {bottom: true}); g.box(P.caja, F, 0x4a5638, [0, 0.37, z], [1.04, 0.04, 0.66]); });
    g.box(P.caja, F, W, [0, -0.1, 0], [0.16, 0.1, 2.6], {noFront: true}); ['ruedaDI', 'ruedaDD', 'ruedaTI', 'ruedaTD'].forEach(k => wheel(k, k[5] === 'D' ? 0.56 : 0.66));
    g.box(P.caja, F, C.hierro, [0, -0.2, 1.0], [1.3, 0.08, 0.08]); g.box(P.caja, F, C.hierro, [0, -0.2, -0.95], [1.4, 0.08, 0.08]);
  } else {
    g.box(P.caja, F, C.madera, [0, -0.08, 0], [1.2, 0.1, 2.8], {bottom: true});                                                    // plataforma y adrales
    [1, -1].forEach(s => { g.box(P.caja, F, C.maderaO, [0.58 * s, 0.15, 0], [0.05, 0.36, 2.8]); for (let i = 0; i < 5; i++) g.box(P.caja, F, C.maderaO, [0.62 * s, 0.15, -1.3 + i * 0.65], [0.05, 0.4, 0.06]); });
    for (let i = 0; i < 5; i++) { const z = -1.2 + i * 0.6; g.tube(P.caja, F, C.maderaO, [0.6, 0.3, z], [0.0, 1.0, z], [[0, 0.02], [1, 0.02]], 3); g.tube(P.caja, F, C.maderaO, [0.0, 1.0, z], [-0.6, 0.3, z], [[0, 0.02], [1, 0.02]], 3); }   // arcos
    g.loft(P.caja, F, C.lona, [[-1.35, 0.64, 0.62, 0, 0.32], [-1.0, 0.66, 0.66, 0, 0.35], [1.0, 0.66, 0.66, 0, 0.35], [1.35, 0.64, 0.62, 0, 0.32]], 10, {axis: 'z', a0: 0, p: 2, zoneFn: (k, i) => Z.FIX});   // toldo
    [0.0, 0.35, -0.35].forEach((x, i) => g.box(P.caja, F, i ? C.saco : 0x7a6040, [x, 0.12, -1.25], [0.32, 0.28, 0.3]));           // carga a la vista
    ['ruedaDI', 'ruedaDD', 'ruedaTI', 'ruedaTD'].forEach(k => wheel(k, k[5] === 'D' ? 0.56 : 0.66));
    seatedFigure(g, P.caja, [0, 0.12, 1.25], {toc: o.era >= 'D' ? 'gorra' : 'kepi'});
  }
  g.tube(P.caja, F, C.madera, [0, -0.2, 0.9], [0, -0.1, 3.6], [[0, 0.045], [1, 0.035]], 6);                                        // lanza
  [1, 2].forEach(k => {
    const PM = {body: P['an' + k], neck: P['an' + k + 'cu'], head: P['an' + k + 'te'], fl: P['an' + k + 'mi'], fr: P['an' + k + 'md'], hl: P['an' + k + 'pi'], hr: P['an' + k + 'pd']};
    if (an === 'buey') { ox(g, P, k, k === 1 ? C.buey : C.bueyO); ['mi', 'md', 'pi', 'pd'].forEach(l => { g.loft(P['an' + k + l], F, k === 1 ? C.buey : C.bueyO, [[-0.86, 0.05, 0.06], [-0.5, 0.06, 0.07], [-0.1, 0.1, 0.13], [0.1, 0.13, 0.16]], 6, {}); g.loft(P['an' + k + l], F, C4.casco, [[-0.9, 0.06, 0.07], [-0.84, 0.05, 0.06]], 6, {capA: true}); });
      if (k === 1) g.box(P.an1, F, C.madera, [-0.62, 0.38, 0.6], [1.5, 0.09, 0.12]);                                             // yugo
      return; }
    horse4(g, PM, {animal: an});
    // collera, horcate, sillín de tiro y tirantes (tiros) hasta el carruaje
    g.loft(PM.neck, F, C.cueroN, [[0.02, 0.16, 0.23, 0, -0.01], [0.1, 0.15, 0.22, 0, -0.01]], 8, {rot: [35, 0, 0], p: 2.4});
    [1, -1].forEach(s => g.tube(PM.neck, F, C.latonO, [0.13 * s, -0.02, 0.18], [0.12 * s, 0.32, 0.0], [[0, 0.02], [1, 0.015]], 4));
    g.loft(PM.body, F, C.cueroN, [[-0.12, 0.27, 0.31, 0, 0.0], [-0.02, 0.27, 0.31, 0, 0.0]], 10, {axis: 'z', p: 2.2, flatN: true});   // cincha
    g.box(PM.body, F, C.cuero, [0, 0.31, -0.06], [0.24, 0.07, 0.3]);
    [1, -1].forEach(s => g.strap(PM.body, F, C.cueroN, [[0.24 * s, 0.05, 0.6], [0.27 * s, -0.02, 0.0], [0.27 * s, -0.08, -0.8], [0.25 * s, -0.2, -1.6]], 0.04, [s, 0, 0]));   // tirantes
    g.strap(PM.body, F, C.cueroN, [[0.1, 0.1, -0.74], [0.24, 0.0, -0.66], [0.27, -0.12, -0.5]], 0.05, [0, 0, -1]);                 // retranca
    if (k === 1 && t !== 'carreta') {                                                                                          // conductor montado a la izquierda
      g.loft(PM.body, F, C.cuero, [[-0.27, 0.13, 0.04, 0, 0.35], [-0.2, 0.17, 0.05, 0, 0.3], [0.05, 0.16, 0.045, 0, 0.29], [0.2, 0.12, 0.05, 0, 0.32], [0.26, 0.06, 0.04, 0, 0.36]], 8, {axis: 'z', capA: true, capB: true, p: 2.6});
      seatedFigure(g, PM.body, [0, 0.33, -0.05], {toc: o.era >= 'D' ? 'gorra' : o.era >= 'C' ? 'kepi' : 'chaco'});
    }
  });
  return g;
}

/* ---------------- carros de 1916–1918: detalle añadido sobre los cascos v3 ---------------- */
const _buildTankV3 = buildTank, _buildMarkIV3 = buildMarkI;
buildTank = function (o) {   // Renault FT: cúpula de observación, escotillas, rejillas del motor, silenciador, patín de cola, ruedas de rodaje
  const g = _buildTankV3(o), P = rigIndex('tanque'), VZ = Z.VEH, F = Z.FIX, dk = 0x2a2c28;
  g.loft(P.torreta, VZ, 0, [[0.5, 0.17, 0.17], [0.56, 0.2, 0.2], [0.62, 0.15, 0.15]], 8, {capB: true, domeB: 0.03, at: [0, 0, -0.05]});   // cúpula «champiñón»
  [0, 1, 2, 3].forEach(i => { const a = i * Math.PI / 2 + 0.4; g.box(P.torreta, F, dk, [Math.cos(a) * 0.2, 0.56, -0.05 + Math.sin(a) * 0.2], [0.06, 0.012, 0.012], {rot: [0, -a / D2R, 0]}); });   // ranuras de visión
  g.box(P.torreta, VZ, 0, [0, 0.24, -0.44], [0.36, 0.32, 0.03], {rot: [8, 0, 0]}); g.box(P.torreta, F, dk, [0.13, 0.24, -0.46], [0.03, 0.06, 0.02]);   // portón trasero
  [-0.25, 0.25].forEach(x => [0.12, 0.38].forEach(y => g.box(P.torreta, F, dk, [x, y, 0.38], [0.04, 0.012, 0.03], {rot: [0, x > 0 ? 30 : -30, 0]})));   // remaches del frente
  g.loft(P.canon, F, 0x3a3c38, [[-0.12, 0.1, 0.1], [0.04, 0.09, 0.09]], 8, {axis: 'z', capA: true, capB: true});                 // mantelete
  g.box(P.casco, VZ, 0, [0, 1.28, 1.7], [0.62, 0.04, 0.42], {rot: [-38, 0, 0]}); [0.16, -0.16].forEach(x => g.box(P.casco, F, dk, [x, 1.4, 1.62], [0.22, 0.012, 0.02], {rot: [-38, 0, 0]}));   // escotillas del conductor
  for (let i = 0; i < 6; i++) g.box(P.casco, F, dk, [0, 1.36, -0.65 - i * 0.13], [0.62, 0.02, 0.05]);                            // rejillas del motor
  g.loft(P.casco, F, 0x3a3630, [[-0.5, 0.07, 0.07], [0.4, 0.07, 0.07]], 6, {axis: 'z', at: [0.5, 1.25, -0.6], capA: true, capB: true});   // silenciador
  [1, -1].forEach(s => g.tube(P.casco, F, C.hierro, [0.32 * s, 0.85, -1.62], [0.3 * s, 0.6, -2.45], [[0, 0.03], [1, 0.03]], 4));   // largueros de la cola
  ['orugaIz', 'orugaDe'].forEach((k, j) => {
    const s = j ? -1 : 1;
    { const w0 = g.p.length; spokeWheel(g, P[k], 0.4, {n: 12, spokes: 6, wood: 0x4a4a42, iron: 0x3a3c38, x: 0.0, w: 0.12, rim: 0.08}); for (let q = w0; q < g.p.length; q += 3) { g.p[q + 1] += 1.0; g.p[q + 2] += 1.62; } }               // rueda guía delantera
    for (let i = 0; i < 8; i++) g.box(P[k], F, dk, [0.18 * s, 0.75, -1.3 + i * 0.36], [0.012, 0.03, 0.03]);                   // remaches del bastidor
  });
  return g;
};
buildMarkI = function (o) {  // Mark I: tiras de remaches, puertas de barbeta, mantelete de los cañones, respiraderos, chimenea de escape, rieles y cubierta antigranadas
  const g = _buildMarkIV3(o), P = rigIndex('markI'), VZ = Z.VEH, F = Z.FIX, dk = 0x2a2c28;
  [1, -1].forEach(s => { for (let r = 0; r < 3; r++) g.strap(P.casco, F, dk, [[0.856 * s, 0.55 + r * 0.6, -2.9], [0.856 * s, 0.55 + r * 0.6, 3.2]], 0.025, [s, 0, 0]); for (let c = 0; c < 7; c++) g.strap(P.casco, F, dk, [[0.856 * s, 0.42, -2.6 + c * 0.9], [0.856 * s, 2.28, -2.6 + c * 0.9]], 0.025, [s, 0, 0]); });
  ['sponIz', 'sponDe'].forEach((k, i) => { const s = i ? -1 : 1;
    g.box(P[k], F, dk, [0.38 * s, -0.12, -0.55], [0.02, 0.62, 0.32]);                                                          // puerta trasera de la barbeta
    g.loft(P[k], VZ, 0, [[0.0, 0.2, 0.2], [0.12, 0.17, 0.17]], 8, {axis: 'z', at: [0.22 * s, 0.05, 0.38]}); });
  ['canonIz', 'canonDe'].forEach(k => g.loft(P[k], F, 0x3a3c38, [[-0.1, 0.12, 0.12], [0.08, 0.1, 0.1]], 8, {axis: 'z', capA: true}));
  g.tube(P.casco, F, 0x3a3630, [0.3, 2.3, -1.2], [0.3, 2.95, -1.3], [[0, 0.08], [1, 0.07]], 6, {capB: true});                    // escape
  for (let i = 0; i < 4; i++) g.box(P.casco, F, dk, [-0.3, 2.31, -0.5 - i * 0.25], [0.5, 0.02, 0.1]);                            // respiraderos
  [0.6, -0.6].forEach(x => g.tube(P.casco, F, C.madera, [x, 2.32, -2.6], [x, 2.32, 2.0], [[0, 0.04], [1, 0.04]], 4));            // rieles de la cubierta
  g.loft(P.casco, F, 0x5a5c4a, [[-0.8, 0.02, 0.4], [0.8, 0.02, 0.4]], 4, {axis: 'x', at: [0, 2.85, 0.0], rot: [0, 0, 0], p: 1.4});   // red/tejadillo antigranadas
  [[0.18, 2.95], [-0.18, 2.95]].forEach(([x, z]) => g.box(P.casco, F, dk, [x, 2.66, z], [0.18, 0.04, 0.02]));                    // visores del conductor
  return g;
};

/* ---------------- LOD 1 (medio) y LOD 2 (silueta) ---------------- */
// Mismo esqueleto que el LOD0: la animación horneada sirve para los tres niveles.
const HAT_LOD = {   // [ancho, alto, fondo], y del centro, zona, color fijo
  chaco: [[0.28, 0.22, 0.28], 0.36, Z.HAT], kepi: [[0.26, 0.15, 0.27], 0.32, Z.HAT], pickel: [[0.3, 0.2, 0.32], 0.33, Z.FIX, C.negro], pickel_pen: [[0.3, 0.26, 0.32], 0.36, Z.FIX, C.negro],
  brodie: [[0.42, 0.08, 0.42], 0.29, Z.HAT], adrian: [[0.34, 0.14, 0.4], 0.31, Z.HAT], stahl: [[0.36, 0.18, 0.38], 0.29, Z.HAT], gorra: [[0.32, 0.08, 0.34], 0.32, Z.HAT],
  gorra_rusa: [[0.28, 0.09, 0.28], 0.3, Z.HAT], salacot: [[0.36, 0.17, 0.42], 0.32, Z.HAT], fez: [[0.22, 0.16, 0.22], 0.32, Z.HAT], sombrero: [[0.46, 0.1, 0.46], 0.3, Z.HAT],
  bersagliere: [[0.42, 0.1, 0.42], 0.3, Z.FIX, C.negro], osos: [[0.32, 0.38, 0.32], 0.43, Z.FIX, C.negro], colback: [[0.28, 0.24, 0.28], 0.37, Z.FIX, C.negro],
  casco_cor: [[0.3, 0.2, 0.34], 0.33, Z.FIX, C.acero], casco_dragon: [[0.3, 0.2, 0.34], 0.33, Z.FIX, C.laton], czapka: [[0.28, 0.24, 0.28], 0.37, Z.HAT],
  qing: [[0.44, 0.12, 0.44], 0.3, Z.HAT], kabalak: [[0.3, 0.13, 0.3], 0.31, Z.HAT], bicornio: [[0.44, 0.16, 0.12], 0.34, Z.FIX, C.negro]};
const WEAPON_LOD = {mosquete: 1.94, fusil: 1.5, espada: 0.84, sable: 0.9, astil: 2.9, lanza: 2.9, astil_jinete: 2.8, escobillon: 2.1, espeque: 1.0, botafuego: 0.9, pala: 1.1, baston: 0.4};
function lodHat(g, part, toc, top) {
  const h = HAT_LOD[toc] || HAT_LOD.chaco, [s, y, z, c] = h;
  if (top) { const w = s[0] / 2, d = s[2] / 2, yy = y + s[1] / 2; g.quad([-w, yy, d], [w, yy, d], [w, yy, -d], [-w, yy, -d], part, z, c || 0); return; }
  g.box(part, z, c || 0, [0, y, 0], s);
}
function lodWeapon(g, a, w, o) {
  const L = WEAPON_LOD[w]; if (!L) return;
  if (w === 'astil' || w === 'astil_jinete') { const y0 = w === 'astil' ? 2.86 : 1.94, lay = o.flagLayout;
    g.cyl(a, Z.FIX, C.madera, [0, L / 2, 0], 0.03, 0.03, L, 3);
    if (lay === 'horiz') g.sheet(a, [0.02, y0, 0], 1.0, 0.7, 1, 3, (i, j) => Z.F1 + j); else g.sheet(a, [0.02, y0, 0], 1.0, 0.7, 3, 1, (i, j) => flagZone(lay)(i, 0)); return; }
  g.cyl(a, Z.FIX, w === 'espada' || w === 'sable' ? 0xd8dce0 : C.maderaO, [0, L / 2 - (w === 'lanza' ? 0.4 : 0), 0], 0.03, 0.02, L, 3);
}
function lodSoldier(o, lvl) {
  const g = new GeoBuilder(), P = rigIndex('soldado');
  if (lvl === 2) {                                                         // silueta: 8 + 2 triángulos
    g.box(P.torso, Z.MAIN, 0, [0, -0.08, 0.0], [0.42, 1.84, 0.26], {noTop: true, taper: -0.12});
    lodHat(g, P.cabeza, o.toc, true); return g;
  }
  g.box(P.torso, Z.MAIN, 0, [0, 0.12, 0], [0.44, 0.8, 0.25], {taper: -0.05});                                // 10
  g.octa(P.cabeza, Z.FIX, C.piel, [0, 0.12, 0.005], 0.13, {ry: 0.14, vr: V.SKIN});                            // 8
  if (o.toc) lodHat(g, P.cabeza, o.toc);                                                                       // 10
  ['musloIz', 'musloDe'].forEach(k => g.cyl(P[k], Z.ACC, 0, [0, -0.43, 0.01], 0.06, 0.085, 0.9, 3));          // 12
  if (!o.unBrazo) ['brazoIz'].forEach(k => g.cyl(P[k], Z.MAIN, 0, [0, -0.26, 0], 0.05, 0.065, 0.56, 3));        // 6
  g.cyl(P.brazoDe, Z.MAIN, 0, [0, -0.26, 0], 0.05, 0.065, 0.56, 3);                                           // 6
  lodWeapon(g, P.arma, o.arma, o);                                                                             // 6 (bandera 12)
  if (o.arma === 'camilla') g.box(P.arma, Z.FIX, C.lona, [0, 1.15, 0.04], [0.54, 2.2, 0.12], {noTop: true});
  return g;
}
function lodRider(o, lvl) {
  const g = new GeoBuilder(), P = rigIndex('jinete');
  if (lvl === 2) {
    g.box(P.caballo, Z.FIX, 0xffffff, [0, -0.42, 0.1], [0.46, 1.5, 1.6], {noTop: true, vr: V.HORSE});            // 8: cuerpo y patas en un bloque
    g.tri([0.0, 0.0, -0.2], [0.0, 0.0, 0.2], [0.0, 0.85, 0.0], P.torso, Z.MAIN, 0); g.tri([-0.18, 0.0, 0.0], [0.18, 0.0, 0.0], [0.0, 0.85, 0.0], P.torso, Z.MAIN, 0);   // 2 (doble cara)
    return g;
  }
  g.box(P.caballo, Z.FIX, 0xffffff, [0, 0.02, 0], [0.5, 0.52, 1.4], {bottom: true, vr: V.HORSE});              // 12
  g.box(P.cuello, Z.FIX, 0xffffff, [0, 0.4, 0.22], [0.22, 0.86, 0.34], {rot: [36, 0, 0], taper: 0.1, vr: V.HORSE});   // 10
  ['manoIz', 'manoDe', 'pataIz', 'pataDe'].forEach(k => g.cyl(P[k], Z.FIX, 0xffffff, [0, -0.45, 0], 0.05, 0.08, 0.95, 3, {vr: V.HORSE}));   // 24
  g.box(P.silla, Z.ACC, 0, [0, -0.1, 0.06], [0.62, 0.3, 0.5], {noFront: false});                               // 10
  g.box(P.torso, Z.MAIN, 0, [0, 0.22, 0], [0.38, 0.46, 0.23]);                                                 // 10
  g.octa(P.cabeza, Z.FIX, C.piel, [0, 0.12, 0.005], 0.125, {ry: 0.14, vr: V.SKIN});                           // 8
  if (o.toc) lodHat(g, P.cabeza, o.toc);                                                                       // 10
  g.cyl(P.brazoIz, Z.MAIN, 0, [0, -0.2, 0.02], 0.05, 0.06, 0.4, 3);                        // 6
  g.cyl(P.brazoDe, Z.MAIN, 0, [0, -0.26, 0], 0.05, 0.06, 0.56, 3);                                            // 6
  lodWeapon(g, P.arma, {husar: 'sable', coracero: 'sable', dragon: 'sable', lancero: 'lanza', general: 'sable', ayudante: 'sable', mariscal: 'baston', estandarte: 'astil_jinete'}[o.tipo || 'husar'], o);   // 6–12
  return g;
}
function lodCannon(o, lvl) {
  const g = new GeoBuilder(), P = rigIndex('canon'), col = o.era >= 'D' ? 0x5a5c4a : 0x5e6a48, mg = o.tipo === 'mg' && o.era >= 'D';
  if (lvl === 2) {
    if (!mg) ['ruedaIz', 'ruedaDe'].forEach(k => g.quad([0, -0.6, -0.6], [0, -0.6, 0.6], [0, 0.6, 0.6], [0, 0.6, -0.6], P[k], Z.FIX, C.madera));
    g.quad([-0.15, 0.2, -1.8], [0.15, 0.2, -1.8], [0.15, 0.62, 0.3], [-0.15, 0.62, 0.3], P.cureña, Z.FIX, col);
    g.quad([0, -0.12, -0.6], [0, -0.12, 1.2], [0, 0.12, 1.2], [0, 0.12, -0.6], P.tubo, Z.FIX, 0x3a3c38); return g;
  }
  g.box(P.cureña, Z.FIX, col, [0, 0.42, -0.85], [0.2, 0.14, 2.0], {rot: [-14, 0, 0]});
  g.box(P.cureña, Z.FIX, col, [0, 0.7, 0.15], [0.46, 0.22, 0.5]);
  if (o.era >= 'D' && o.tipo !== 'mg') g.quad([-0.52, 0.5, 0.42], [0.52, 0.5, 0.42], [0.46, 1.4, 0.42], [-0.46, 1.4, 0.42], P.cureña, Z.FIX, 0x5f6250);
  g.cyl(P.tubo, Z.FIX, o.tipo === 'liso' ? C.bronce : 0x3a3c38, [0, 0, 0.3], 0.1, 0.08, mg ? 0.9 : 1.6, 4, {rot: [o.tipo === 'obus' ? 58 : 90, 0, 0], top: true});
  if (!mg) ['ruedaIz', 'ruedaDe'].forEach(k => g.disc(P[k], Z.FIX, C.madera, [0, 0, 0], 0.6, 6, {two: true}));
  return g;
}
function lodTank(o, lvl, mark) {
  const g = new GeoBuilder(), P = rigIndex(mark ? 'markI' : 'tanque');
  if (mark) {
    if (lvl === 2) { g.box(P.casco, Z.VEH, 0, [0, 1.25, 0], [2.4, 2.5, 9.0], {noTop: true}); g.quad([-1.2, 2.5, 4.5], [1.2, 2.5, 4.5], [1.2, 2.5, -4.5], [-1.2, 2.5, -4.5], P.casco, Z.VEH, 0); return g; }
    g.box(P.casco, Z.VEH, 0, [0, 1.25, 0], [2.3, 2.45, 8.4], {taperZ: 0.1});
    ['sponIz', 'sponDe'].forEach(k => g.box(P[k], Z.VEH, 0, [0, 0, 0], [0.5, 1.0, 1.6], {taperZ: 0.35}));
    ['canonIz', 'canonDe'].forEach(k => g.cyl(P[k], Z.FIX, C.hierro, [0, 0, 0.45], 0.08, 0.07, 1.0, 3, {rot: [90, 0, 0]}));
    ['orugaIz', 'orugaDe'].forEach(k => g.box(P[k], Z.FIX, C.oruga, [0, 1.25, 0.4], [0.5, 2.45, 8.8], {taperZ: 0.15})); return g;
  }
  if (lvl === 2) { g.box(P.casco, Z.VEH, 0, [0, 0.95, 0], [1.6, 1.9, 4.2], {noTop: true}); g.quad([-0.45, 1.95, 0.6], [0.45, 1.95, 0.6], [0.45, 1.95, -0.3], [-0.45, 1.95, -0.3], P.casco, Z.VEH, 0); return g; }
  g.box(P.casco, Z.VEH, 0, [0, 1.05, 0.0], [0.92, 0.95, 3.2], {bottom: true, taperZ: 0.15});
  g.cyl(P.torreta, Z.VEH, 0, [0, 0.24, 0], 0.46, 0.4, 0.5, 6, {top: true});
  g.cyl(P.canon, Z.FIX, C.hierro, [0, 0, 0.3], 0.06, 0.05, 0.56, 3, {rot: [90, 0, 0]});
  ['orugaIz', 'orugaDe'].forEach(k => g.box(P[k], Z.VEH, 0, [0, 0.8, 0.1], [0.34, 1.4, 3.8], {taperZ: 0.15}));
  return g;
}
function lodTeam(o, lvl) {
  const g = new GeoBuilder(), P = rigIndex('tiro'), an = o.animal || 'caballo', col = an === 'buey' ? C.buey : 0xffffff, hv = an === 'buey' ? 0 : V.HORSE;
  const body = o.tipo === 'carreta' ? C.lona : 0x5e6a48;
  g.box(P.caja, Z.FIX, body, [0, 0.1, o.tipo === 'avantren' ? -1.0 : 0], [1.1, 0.8, o.tipo === 'avantren' ? 0.7 : 2.7], {noTop: lvl === 2});
  [1, 2].forEach(k => {
    g.box(P['an' + k], Z.FIX, col, [0, lvl === 2 ? -0.3 : 0.02, 0], [0.48, lvl === 2 ? 1.2 : 0.52, 1.36], {noTop: lvl === 2, vr: hv});
    if (lvl === 1) { g.box(P['an' + k + 'cu'], Z.FIX, col, [0, 0.4, 0.22], [0.22, 0.86, 0.34], {rot: [36, 0, 0], vr: hv}); ['mi', 'md', 'pi', 'pd'].forEach(l => g.cyl(P['an' + k + l], Z.FIX, col, [0, -0.45, 0], 0.05, 0.08, 0.95, 3, {vr: hv})); }
  });
  if (lvl === 1) ['ruedaDI', 'ruedaDD', 'ruedaTI', 'ruedaTD'].forEach(k => { if (o.tipo === 'avantren' && k[5] === 'D') return; g.disc(P[k], Z.FIX, C.madera, [0, 0, 0], 0.6, 6, {two: true}); });
  return g;
}
function lodParapet(o, lvl) { const g = new GeoBuilder(); g.box(0, Z.FIX, o.era >= 'D' ? C.saco : C.tierra, [0, 0.45, 0], [4.2, 0.9, 1.0], {taperZ: 0.3, noTop: lvl === 2}); return g; }

/* ---------------- catálogo ---------------- */
const AB = e => e === 'A' || e === 'B';
const hg = (nat, era, rol) => uniformPalette(nat, era, rol).headgear;
const RIDER = (tipo, rol, toc) => ({rig: 'jinete', clase: 'cav', pal: rol, o: (era, nat) => ({era, tipo, toc: toc ? toc(era, nat) : hg(nat, era, rol), flagLayout: (NACIONES[nat] || NACIONES.GEN).bandera, plumero: tipo === 'mariscal' && era !== 'D'}), build: buildRider, lod: lodRider});
const GUN = (tipo, eras) => ({rig: 'canon', clase: 'art', pal: 'artilleria', eras, o: era => ({era, tipo}), build: buildCannon, lod: lodCannon});
const TEAM = (tipo, animal) => ({rig: 'tiro', clase: 'tren', pal: tipo === 'carreta' ? 'linea' : 'artilleria', o: (era, nat) => ({era, tipo, animal}), build: buildTeam, lod: lodTeam});
const ROLE_ARMA = {escobillon: 'escobillon', cargador: 'bala', apuntador: 'espeque', artillero: 'botafuego', jefe: 'ninguna', tirador_mg: 'ninguna', municion: 'ninguna'};
const KINDS = {
  fusilero: {rig: 'soldado', clase: 'inf', pal: 'linea', nombre: 'Fusilero (infantería de línea)', o: (era, nat) => ({era, toc: hg(nat, era, 'linea'), arma: AB(era) ? 'mosquete' : 'fusil', bayoneta: era === 'D'})},
  granadero: {rig: 'soldado', clase: 'inf', pal: 'guardia', nombre: 'Granadero / guardia', o: (era, nat) => ({era, toc: hg(nat, era, 'guardia'), arma: AB(era) ? 'mosquete' : 'fusil', bayoneta: era === 'D', penacho: era === 'C' && hg(nat, era, 'guardia') !== 'pickel_pen'})},
  tirador: {rig: 'soldado', clase: 'inf', pal: 'ligera', nombre: 'Tirador / infantería ligera', o: (era, nat) => ({era, toc: hg(nat, era, 'ligera'), arma: 'fusil', mochila: false, correaje: false, bayoneta: era === 'D'})},
  oficial: {rig: 'soldado', clase: 'inf', pal: 'linea', nombre: 'Oficial a pie', o: (era, nat) => ({era, toc: era >= 'D' ? 'gorra' : hg(nat, era, 'linea'), arma: 'espada', rango: 'oficial', mochila: false, charreteras: true, correaje: false, cartucheras: false, catalejo: true})},
  abanderado: {rig: 'soldado', clase: 'inf', pal: 'linea', dobleCara: true, nombre: 'Portaestandarte', o: (era, nat) => ({era, toc: hg(nat, era, 'linea'), arma: 'astil', mochila: false, correaje: false, cartucheras: false, flagLayout: (NACIONES[nat] || NACIONES.GEN).bandera, unBrazo: true})},
  zapador: {rig: 'soldado', clase: 'inf', pal: 'linea', nombre: 'Zapador / ingeniero', o: (era, nat) => ({era, toc: hg(nat, era, 'linea'), arma: 'pala', espalda: 'pala', mochila: false})},
  sanitario: {rig: 'soldado', clase: 'inf', pal: 'linea', roles: ['delante', 'detras'], nombre: 'Sanitario con camilla', o: (era, nat, rol) => ({era, toc: hg(nat, era, 'linea'), arma: rol === 'detras' ? 'ninguna' : 'camilla', mochila: false, correaje: false, cartucheras: false, brazalete: era !== 'A', unBrazo: true})},
  prisionero: {rig: 'soldado', clase: 'inf', pal: 'linea', nombre: 'Prisionero', o: (era, nat) => ({era, toc: hg(nat, era, 'linea'), arma: 'ninguna', mochila: false, cartucheras: false})},
  herido: {rig: 'soldado', clase: 'inf', pal: 'linea', nombre: 'Herido', o: (era, nat) => ({era, toc: hg(nat, era, 'linea'), arma: 'ninguna', mochila: false, cartucheras: false})},
  artillero: {rig: 'soldado', clase: 'art', pal: 'artilleria', roles: Object.keys(ROLE_ARMA), nombre: 'Servidor de pieza', o: (era, nat, rol) => ({era, lite: true, toc: hg(nat, era, 'artilleria'), arma: rol === 'cargador' && !AB(era) ? 'proyectil' : rol === 'artillero' && !AB(era) ? 'ninguna' : ROLE_ARMA[rol || 'cargador'], mochila: false})},
  husar: Object.assign(RIDER('husar', 'caballeria'), {nombre: 'Húsar'}),
  coracero: Object.assign(RIDER('coracero', 'linea', (era, nat) => era >= 'D' ? hg(nat, era, 'linea') : 'casco_cor'), {nombre: 'Coracero'}),
  lancero: Object.assign(RIDER('lancero', 'caballeria', (era, nat) => era >= 'D' ? hg(nat, era, 'linea') : 'czapka'), {dobleCara: true, nombre: 'Lancero'}),
  dragon: Object.assign(RIDER('dragon', 'linea', (era, nat) => AB(era) ? 'casco_dragon' : hg(nat, era, 'linea')), {nombre: 'Dragón'}),
  general: Object.assign(RIDER('general', 'estado_mayor', (era, nat) => era >= 'D' ? 'gorra' : hg(nat, era, 'estado_mayor')), {nombre: 'General a caballo'}),
  ayudante: Object.assign(RIDER('ayudante', 'estado_mayor', (era, nat) => era >= 'D' ? 'gorra' : hg(nat, era, 'linea')), {nombre: 'Ayudante de campo'}),
  mariscal: Object.assign(RIDER('mariscal', 'estado_mayor', era => era >= 'D' ? 'gorra' : 'bicornio'), {nombre: 'Mariscal'}),
  mensajero: Object.assign(RIDER('mensajero', 'linea'), {nombre: 'Mensajero a caballo'}),
  estandarte: Object.assign(RIDER('estandarte', 'estado_mayor', (era, nat) => era >= 'D' ? 'gorra' : hg(nat, era, 'linea')), {dobleCara: true, nombre: 'Estandarte de mando'}),
  canon: Object.assign(GUN('liso', ['A', 'B']), {nombre: 'Cañón de ánima lisa'}),
  canon_rc: Object.assign(GUN('rc', ['B', 'C', 'D']), {nombre: 'Cañón rayado de retrocarga'}),
  obus: Object.assign(GUN('obus', ['A', 'B', 'C', 'D']), {nombre: 'Obús'}),
  ametralladora: Object.assign(GUN('mg', ['B', 'C', 'D']), {nombre: 'Ametralladora (Gatling / Maxim)'}),
  avantren: Object.assign(TEAM('avantren', 'caballo'), {nombre: 'Avantrén con tiro'}),
  carro_municion: Object.assign(TEAM('municion', 'caballo'), {nombre: 'Carro de munición'}),
  carreta: Object.assign(TEAM('carreta', 'mula'), {nombre: 'Carreta de suministro (mulas)'}),
  carreta_bueyes: Object.assign(TEAM('carreta', 'buey'), {nombre: 'Carreta de suministro (bueyes)'}),
  tanque: {rig: 'tanque', clase: 'tank', eras: ['D'], nombre: 'Tanque ligero tipo Renault FT', o: era => ({era}), build: buildTank, lod: (o, l) => lodTank(o, l, false)},
  mark1: {rig: 'markI', clase: 'tank', eras: ['D'], nombre: 'Tanque romboidal Mark I', o: era => ({era}), build: buildMarkI, lod: (o, l) => lodTank(o, l, true)},
  parapeto: {rig: 'estatico', clase: 'fort', nombre: 'Parapeto de fuerte', o: era => ({era}), build: buildParapet, lod: lodParapet}
};
Object.values(KINDS).forEach(k => { if (k.rig === 'soldado') { k.build = buildSoldier; k.lod = lodSoldier; } k.eras = k.eras || ['A', 'B', 'C', 'D']; });
const TROOP_KINDS = Object.keys(KINDS);

/* ---------------- animaciones ---------------- */
// Pistas por parte: [t, rx, ry, rz] (grados, Euler XYZ); raíz: [t, x, y, z] (metros); eventos: [t, nombre]. Interpolación suave por fase t ∈ [0,1).
// Armas largas: armaP / armaR = posición y giro del arma en el espacio del torso; agarre = [t, y mano derecha, y mano izquierda] (escalonado;
// < 0 = esa mano libre). hide = {parte: [[t, 1 visible | 0 oculta]]} (escalonado): arma tirada, etc.
const CLIPS = {};
const cp = o => JSON.parse(JSON.stringify(o));
const ORDEN = {P: [-0.27, -0.95, 0.1], R: [0, 0, 0]}, APUNTA = {P: [-0.15, 0.38, 0.06], R: [90, 3, 0]}, HOMBRO = {P: [-0.25, 0.08, 0.17], R: [-32, 0, -6]}, BAYO = {P: [-0.14, -0.08, 0.22], R: [76, 0, 0]};
const SABLE_BAJO = {P: [-0.27, -0.1, 0.08], R: [180, 0, 0]};
const arm = (A, g) => ({armaP: [[0].concat(A.P)], armaR: [[0].concat(A.R)], agarre: [[0].concat(g)]});
const legsStand = {musloIz: [[0, -4, 0, 2]], musloDe: [[0, 2, 0, -2]]};
const KNEEL = {pieDe: [[0, 72, 0, 0]], musloIz: [[0, -85, 0, 4]], piernaIz: [[0, 85, 0, 0]], musloDe: [[0, -8, 0, -4]], piernaDe: [[0, 95, 0, 0]]};
const CROUCH = {musloIz: [[0, -78, 0, 8]], piernaIz: [[0, 118, 0, 0]], musloDe: [[0, -62, 0, -8]], piernaDe: [[0, 112, 0, 0]]};
const HIDE_ARMA = {arma: [[0, 0]]};
function mk(dur, loop, tracks, ev, extra) { return Object.assign({dur, loop, tracks, ev: ev || []}, extra || {}); }
// sub(clip, t0, t1, dur): recorta un tramo del clip y lo reescala a [0,1]
function remapTrack(tr, t0, t1, step) {
  if (!tr) return tr; const n = tr[0].length - 1, buf = new Array(n), s = t => { (step ? sampleStep : sampleTrack)(tr, t, buf, n); return buf.slice(); };
  const out = [[0].concat(s(t0))]; tr.forEach(k => { if (k[0] > t0 + 1e-6 && k[0] < t1 - 1e-6) out.push([(k[0] - t0) / (t1 - t0)].concat(k.slice(1))); }); out.push([1].concat(s(t1))); return out;
}
function sub(c, t0, t1, dur, loop) {
  const o = {dur, loop: loop !== false, tracks: {}, ev: (c.ev || []).filter(e => e[0] >= t0 && e[0] < t1).map(e => [(e[0] - t0) / (t1 - t0), e[1]])};
  Object.keys(c.tracks).forEach(k => { o.tracks[k] = remapTrack(c.tracks[k], t0, t1, k === 'agarre'); });
  if (c.root) o.root = remapTrack(c.root, t0, t1); if (c.hide) { o.hide = {}; Object.keys(c.hide).forEach(k => { o.hide[k] = remapTrack(c.hide[k], t0, t1, true); }); }
  return o;
}
function kneel(c, extra) { const o = cp(c); Object.assign(o.tracks, cp(KNEEL)); o.root = [[0, 0, -0.36, 0]]; return Object.assign(o, extra || {}); }
// marcha de cuadrúpedo: lista de patas [superior, inferior, desfase, signo de rodilla]; amp en grados
function gait(legs, amp, knee) {
  const tr = {}, N = 8;
  legs.forEach(([u, l, off, ks]) => {
    tr[u] = []; if (l) tr[l] = [];
    for (let i = 0; i <= N; i++) { const t = i / N, a = 2 * Math.PI * (t + off); tr[u].push([t, -amp * Math.cos(a), 0, 0]); if (l) tr[l].push([t, ks * knee * Math.max(0, Math.sin(a)), 0, 0]); }
  });
  return tr;
}

CLIPS.soldado = {
  idle: mk(3.4, true, Object.assign({torso: [[0, 0, 0, 0], [0.5, -2, 0, 0], [1, 0, 0, 0]], cabeza: [[0, 0, 0, 0], [0.3, 0, 14, 0], [0.55, 0, 14, 0], [0.8, 0, -6, 0], [1, 0, 0, 0]],
    brazoIz: [[0, 0, 0, 5], [0.5, 2, 0, 6], [1, 0, 0, 5]], antebrazoIz: [[0, -8, 0, 0]]}, arm(ORDEN, [0.92, -1]), legsStand)),
  idle_oficial: mk(3.4, true, Object.assign({torso: [[0, 0, 0, 0], [0.5, -2, 0, 0], [1, 0, 0, 0]], cabeza: [[0, 0, 0, 0], [0.3, 0, 18, 0], [0.55, 0, 18, 0], [0.8, 0, -10, 0], [1, 0, 0, 0]],
    brazoIz: [[0, 10, 0, 18]], antebrazoIz: [[0, -60, 0, -20]]}, arm(SABLE_BAJO, [0.0, -1]), legsStand)),
  marcha: mk(1.0, true, {musloIz: [[0, -26, 0, 0], [0.5, 22, 0, 0], [1, -26, 0, 0]], piernaIz: [[0, 6, 0, 0], [0.25, 4, 0, 0], [0.5, 10, 0, 0], [0.75, 48, 0, 0], [1, 6, 0, 0]],
    musloDe: [[0, 22, 0, 0], [0.5, -26, 0, 0], [1, 22, 0, 0]], piernaDe: [[0, 10, 0, 0], [0.25, 48, 0, 0], [0.5, 6, 0, 0], [0.75, 4, 0, 0], [1, 10, 0, 0]],
    brazoIz: [[0, 18, 0, 5], [0.5, -18, 0, 5], [1, 18, 0, 5]], antebrazoIz: [[0, -10, 0, 0], [0.5, -25, 0, 0], [1, -10, 0, 0]], torso: [[0, 3, -3, 0], [0.5, 3, 3, 0], [1, 3, -3, 0]],
    armaP: [[0].concat(HOMBRO.P)], armaR: [[0].concat(HOMBRO.R)], agarre: [[0, 0.1, -1]]}, [[0, 'paso'], [0.5, 'paso']], {root: [[0, 0, 0, 0], [0.25, 0, 0.035, 0], [0.5, 0, 0, 0], [0.75, 0, 0.035, 0], [1, 0, 0, 0]]}),
  apuntar: mk(0.5, false, Object.assign({armaP: [[0].concat(ORDEN.P), [0.5, -0.18, 0.0, 0.25], [1].concat(APUNTA.P)], armaR: [[0, 0, 0, 0], [0.5, 50, 0, 0], [1].concat(APUNTA.R)], agarre: [[0, 0.92, -1], [0.3, 0.35, 0.8]],
    cabeza: [[0, 0, 0, 0], [1, 10, -4, 4]], torso: [[0, 0, 0, 0], [1, 4, -14, 0]]}, {musloIz: [[0, 0, 0, 0], [1, -16, 0, 4]], musloDe: [[0, 0, 0, 0], [1, 6, 0, -4]]})),
  // ciclo completo del mosquete de ánima lisa (A): apuntar → fuego → bajar → morder el cartucho → cebar → cargar por la boca → baqueta → al hombro → apuntar
  disparar_A: mk(9.0, true, {
    armaP: [[0].concat(APUNTA.P), [0.10].concat(APUNTA.P), [0.115, -0.15, 0.4, -0.02], [0.14].concat(APUNTA.P), [0.2, -0.12, -0.02, 0.22], [0.36, -0.12, -0.02, 0.22], [0.42, 0.02, -0.95, 0.34], [0.78, 0.02, -0.95, 0.34], [0.84, -0.18, 0.0, 0.22], [0.92].concat(APUNTA.P), [1].concat(APUNTA.P)],
    armaR: [[0].concat(APUNTA.R), [0.10].concat(APUNTA.R), [0.115, 84, 3, 0], [0.14].concat(APUNTA.R), [0.2, 52, 0, -6], [0.36, 52, 0, -6], [0.42, 10, 0, 0], [0.78, 10, 0, 0], [0.84, 40, 0, 0], [0.92].concat(APUNTA.R), [1].concat(APUNTA.R)],
    agarre: [[0, 0.32, 0.82], [0.2, 0.42, 0.74], [0.24, -1, 0.74], [0.31, 0.47, 0.74], [0.4, -1, 0.95], [0.8, 0.35, 0.8]],
    brazoDe: [[0, -40, 0, -10], [0.24, -40, 0, -10], [0.27, -70, 0, -30], [0.3, -70, 0, -30], [0.4, -40, 0, -10], [0.44, -90, 0, -10], [0.5, -168, 0, -10], [0.54, -120, 0, -8], [0.58, -150, 0, -8], [0.62, -118, 0, -8], [0.66, -150, 0, -8], [0.72, -168, 0, -10], [0.78, -90, 0, -10], [0.8, -40, 0, -10]],
    antebrazoDe: [[0, -30, 0, 0], [0.24, -30, 0, 0], [0.27, -125, 0, 0], [0.3, -125, 0, 0], [0.4, -40, 0, 0], [0.44, -30, 0, 0], [0.5, -10, 0, 0], [0.54, -20, 0, 0], [0.58, -10, 0, 0], [0.62, -20, 0, 0], [0.66, -10, 0, 0], [0.72, -10, 0, 0], [0.78, -30, 0, 0], [1, -30, 0, 0]],
    cabeza: [[0, 10, -4, 4], [0.12, 10, -4, 4], [0.2, 10, 0, 0], [0.27, -4, 0, 0], [0.31, 16, -10, 0], [0.42, 6, 0, 0], [0.72, -6, 0, 0], [0.84, 6, 0, 0], [0.92, 10, -4, 4], [1, 10, -4, 4]],
    torso: [[0, 4, -14, 0], [0.115, 0, -14, 0], [0.14, 4, -14, 0], [0.2, 6, -6, 0], [0.42, 4, 0, 0], [0.8, 4, 0, 0], [0.92, 4, -14, 0], [1, 4, -14, 0]],
    musloIz: [[0, -16, 0, 4], [0.2, -8, 0, 3], [0.84, -8, 0, 3], [0.92, -16, 0, 4], [1, -16, 0, 4]], musloDe: [[0, 6, 0, -4], [1, 6, 0, -4]], brazoIz: [[0, -30, 0, 10]]},
    [[0.10, 'disparo'], [0.27, 'morder_cartucho'], [0.31, 'cebar'], [0.44, 'polvora'], [0.58, 'baqueta'], [0.72, 'baqueta_fuera'], [0.84, 'al_hombro'], [0.92, 'apuntar']]),
  // retrocarga de un tiro (B: Dreyse, Chassepot, Snider, Martini): fuego → bajar → abrir el cierre → cartucho → cerrar → apuntar
  disparar_B: mk(4.5, true, {
    armaP: [[0].concat(APUNTA.P), [0.10].concat(APUNTA.P), [0.115, -0.15, 0.4, -0.02], [0.14].concat(APUNTA.P), [0.25, -0.12, -0.02, 0.22], [0.62, -0.12, -0.02, 0.22], [0.75].concat(APUNTA.P), [1].concat(APUNTA.P)],
    armaR: [[0].concat(APUNTA.R), [0.10].concat(APUNTA.R), [0.115, 84, 3, 0], [0.14].concat(APUNTA.R), [0.25, 52, 0, -6], [0.62, 52, 0, -6], [0.75].concat(APUNTA.R), [1].concat(APUNTA.R)],
    agarre: [[0, 0.32, 0.82], [0.25, 0.47, 0.8], [0.3, -1, 0.8], [0.56, 0.47, 0.8], [0.7, 0.32, 0.82]],
    brazoDe: [[0, -40, 0, -10], [0.3, -40, 0, -10], [0.36, -30, 0, 10], [0.44, -30, 0, 10], [0.5, -60, 0, -10], [0.56, -40, 0, -10]], antebrazoDe: [[0, -30, 0, 0], [0.3, -30, 0, 0], [0.36, -90, 0, 0], [0.44, -90, 0, 0], [0.5, -80, 0, 0], [0.56, -30, 0, 0]],
    cabeza: [[0, 10, -4, 4], [0.14, 10, -4, 4], [0.3, 18, -6, 0], [0.62, 18, -6, 0], [0.75, 10, -4, 4], [1, 10, -4, 4]], torso: [[0, 4, -14, 0], [0.115, 0, -14, 0], [0.14, 4, -14, 0], [0.25, 6, -6, 0], [0.62, 6, -6, 0], [0.75, 4, -14, 0], [1, 4, -14, 0]],
    musloIz: [[0, -16, 0, 4], [1, -16, 0, 4]], musloDe: [[0, 6, 0, -4], [1, 6, 0, -4]], brazoIz: [[0, -30, 0, 10]]},
    [[0.10, 'disparo'], [0.3, 'abrir_cierre'], [0.4, 'cartucho'], [0.52, 'cerrar_cierre'], [0.75, 'apuntar']]),
  // fusil de cerrojo (C/D): fuego, cerrojo atrás y adelante, apuntar
  disparar_D: mk(2.4, true, {armaP: [[0].concat(APUNTA.P), [0.22].concat(APUNTA.P), [0.25, -0.15, 0.4, -0.03], [0.3].concat(APUNTA.P), [1].concat(APUNTA.P)], armaR: [[0].concat(APUNTA.R), [0.22].concat(APUNTA.R), [0.25, 85, 3, 0], [0.3].concat(APUNTA.R), [0.4, 86, 3, -14], [0.6, 86, 3, -14], [0.72].concat(APUNTA.R), [1].concat(APUNTA.R)],
    agarre: [[0, 0.3, 0.75], [0.36, 0.5, 0.75], [0.62, 0.3, 0.75]],
    cabeza: [[0, 10, -4, 4], [0.36, 4, -4, 4], [0.62, 10, -4, 4], [1, 10, -4, 4]], torso: [[0, 4, -14, 0], [0.24, 0, -14, 0], [0.32, 4, -14, 0], [1, 4, -14, 0]],
    musloIz: [[0, -16, 0, 4], [1, -16, 0, 4]], musloDe: [[0, 6, 0, -4], [1, 6, 0, -4]]},
    [[0.22, 'disparo'], [0.4, 'cerrojo_atras'], [0.56, 'cerrojo_adelante'], [0.72, 'apuntar']]),
  cargar_bayoneta: mk(0.62, true, {musloIz: [[0, -50, 0, 0], [0.5, 34, 0, 0], [1, -50, 0, 0]], piernaIz: [[0, 20, 0, 0], [0.25, 10, 0, 0], [0.5, 30, 0, 0], [0.75, 90, 0, 0], [1, 20, 0, 0]],
    musloDe: [[0, 34, 0, 0], [0.5, -50, 0, 0], [1, 34, 0, 0]], piernaDe: [[0, 30, 0, 0], [0.25, 90, 0, 0], [0.5, 20, 0, 0], [0.75, 10, 0, 0], [1, 30, 0, 0]],
    torso: [[0, 18, 0, 0], [1, 18, 0, 0]], cabeza: [[0, -14, 0, 0], [1, -14, 0, 0]],
    armaP: [[0, -0.14, -0.08, 0.22], [0.5, -0.14, -0.04, 0.26], [1, -0.14, -0.08, 0.22]], armaR: [[0, 76, 0, 0], [0.5, 80, 0, 0], [1, 76, 0, 0]], agarre: [[0, 0.3, 0.85]]},
    [[0, 'paso'], [0.5, 'paso'], [0.0, 'grito']], {root: [[0, 0, 0, 0], [0.25, 0, 0.07, 0], [0.5, 0, 0, 0], [0.75, 0, 0.07, 0], [1, 0, 0, 0]]}),
  formar: mk(1.6, false, Object.assign({musloIz: [[0, -20, 0, 0], [0.15, 14, 0, 0], [0.3, -18, 0, 0], [0.45, 8, 0, 0], [0.62, -4, 0, 2], [1, -4, 0, 2]], piernaIz: [[0, 10, 0, 0], [0.22, 40, 0, 0], [0.4, 8, 0, 0], [0.62, 0, 0, 0]],
    musloDe: [[0, 14, 0, 0], [0.15, -18, 0, 0], [0.3, 10, 0, 0], [0.45, -10, 0, 0], [0.62, 2, 0, -2], [1, 2, 0, -2]], piernaDe: [[0, 8, 0, 0], [0.12, 40, 0, 0], [0.3, 8, 0, 0], [0.5, 30, 0, 0], [0.62, 0, 0, 0]],
    cabeza: [[0, 0, 0, 0], [0.5, 0, -25, 0], [0.75, 0, -25, 0], [1, 0, 0, 0]],
    armaP: [[0].concat(HOMBRO.P), [0.6].concat(HOMBRO.P), [0.85].concat(ORDEN.P), [1].concat(ORDEN.P)], armaR: [[0].concat(HOMBRO.R), [0.6].concat(HOMBRO.R), [0.85, 0, 0, 0], [1, 0, 0, 0]], agarre: [[0, 0.1, -1], [0.7, 0.92, -1]]}),
    [[0.62, 'alto'], [0.85, 'descansen_armas']], {root: [[0, 0, 0, 0], [0.62, 0, 0, 0.35], [1, 0, 0, 0.35]]}),
  melee_1: mk(1.1, true, {armaP: [[0, -0.12, -0.04, 0.24], [0.35, -0.05, 0.25, -0.05], [0.5, -0.1, 0.25, 0.5], [0.7, -0.1, 0.1, 0.35], [1, -0.12, -0.04, 0.24]], armaR: [[0, 70, 0, 0], [0.35, -60, 0, 0], [0.5, -95, 0, 0], [0.7, -40, 0, 0], [1, 70, 0, 0]], agarre: [[0, 0.3, 0.85]],
    torso: [[0, 10, 0, 0], [0.35, 0, -25, 0], [0.5, 15, 20, 0], [1, 10, 0, 0]], musloIz: [[0, -25, 0, 0], [0.5, -35, 0, 0], [1, -25, 0, 0]], piernaIz: [[0, 15, 0, 0]], musloDe: [[0, 15, 0, 0]], piernaDe: [[0, 10, 0, 0]]},
    [[0.5, 'golpe']], {root: [[0, 0, 0, 0], [0.5, 0, -0.03, 0.15], [1, 0, 0, 0]]}),
  melee_2: mk(1.0, true, {armaP: [[0].concat(BAYO.P), [0.3, -0.14, -0.06, 0.05], [0.45, -0.12, -0.02, 0.55], [0.6, -0.14, -0.06, 0.3], [1].concat(BAYO.P)], armaR: [[0, 76, 0, 0], [0.45, 84, 0, 0], [1, 76, 0, 0]], agarre: [[0, 0.3, 0.85]],
    torso: [[0, 14, 0, 0], [0.3, 6, -10, 0], [0.45, 26, 5, 0], [1, 14, 0, 0]], musloIz: [[0, -25, 0, 0], [0.45, -45, 0, 0], [1, -25, 0, 0]], piernaIz: [[0, 15, 0, 0], [0.45, 30, 0, 0], [1, 15, 0, 0]], musloDe: [[0, 15, 0, 0], [0.45, 25, 0, 0], [1, 15, 0, 0]], piernaDe: [[0, 10, 0, 0]]},
    [[0.45, 'golpe']], {root: [[0, 0, 0, 0], [0.45, 0, -0.06, 0.25], [1, 0, 0, 0]]}),
  cuadro: kneel(mk(3.0, true, Object.assign({torso: [[0, 8, 0, 0], [0.5, 10, 0, 0], [1, 8, 0, 0]], cabeza: [[0, 4, 0, 0]]}, arm({P: [-0.12, -0.02, 0.28], R: [62, 0, 0]}, [0.3, 0.85])))),
  ponerse_a_cubierto: mk(3.0, true, Object.assign({torso: [[0, 28, 0, 0], [0.5, 30, 0, 0], [1, 28, 0, 0]], cabeza: [[0, -12, 0, 0], [0.5, -12, 14, 0], [1, -12, 0, 0]]}, cp(CROUCH), arm({P: [-0.05, -0.22, 0.28], R: [50, 0, 40]}, [0.35, 0.85])), [], {root: [[0, 0, -0.34, 0]]}),
  asomarse: mk(1.2, false, {musloIz: [[0, -78, 0, 8], [0.6, -16, 0, 4]], piernaIz: [[0, 118, 0, 0], [0.6, 0, 0, 0]], musloDe: [[0, -62, 0, -8], [0.6, 6, 0, -4]], piernaDe: [[0, 112, 0, 0], [0.6, 0, 0, 0]],
    torso: [[0, 28, 0, 0], [0.6, 4, -14, 0]], cabeza: [[0, -12, 0, 0], [0.7, 10, -4, 4]],
    armaP: [[0, -0.05, -0.22, 0.28], [0.7].concat(APUNTA.P)], armaR: [[0, 50, 0, 40], [0.7].concat(APUNTA.R)], agarre: [[0, 0.35, 0.85], [0.6, 0.32, 0.82]]},
    [[0.7, 'asomado']], {root: [[0, 0, -0.34, 0], [0.6, 0, 0, 0]]}),
  herido: mk(3.0, true, {pelvis: [[0, -10, 0, 0]], musloIz: [[0, -85, 0, 8]], piernaIz: [[0, 30, 0, 0]], musloDe: [[0, -80, 0, -8]], piernaDe: [[0, 55, 0, 0]],
    torso: [[0, 25, 0, 0], [0.5, 32, 0, 0], [1, 25, 0, 0]], cabeza: [[0, 25, 0, 0], [0.5, 30, 10, 0], [1, 25, 0, 0]], brazoIz: [[0, -30, 0, -25]], antebrazoIz: [[0, -80, 0, 0]], brazoDe: [[0, -20, 0, 10]], antebrazoDe: [[0, -70, 0, 0]]},
    [[0, 'quejido']], {root: [[0, 0, -0.74, 0]], hide: cp(HIDE_ARMA)}),
  caer_muerto_atras: mk(1.3, false, {pelvis: [[0, 0, 0, 0], [0.35, -10, 0, 0], [0.7, -70, 0, 4], [1, -88, 0, 6]], torso: [[0, 0, 0, 0], [0.3, -18, 0, 0], [1, -4, 0, 0]], cabeza: [[0, 0, 0, 0], [0.4, -30, 0, 0], [1, 6, 20, 0]],
    brazoDe: [[0, 0, 0, -4], [0.4, -100, 0, -30], [1, -160, 0, -40]], antebrazoDe: [[0, 0, 0, 0], [1, -20, 0, 0]], brazoIz: [[0, 0, 0, 4], [0.4, -60, 0, 50], [1, -120, 0, 70]],
    musloIz: [[0, 0, 0, 0], [0.35, -30, 0, 0], [1, -6, 0, 10]], piernaIz: [[0, 0, 0, 0], [0.35, 50, 0, 0], [1, 6, 0, 0]], musloDe: [[0, 0, 0, 0], [0.5, -10, 0, 0], [1, 4, 0, -6]], piernaDe: [[0, 0, 0, 0], [0.5, 30, 0, 0], [1, 10, 0, 0]],
    armaP: [[0].concat(ORDEN.P), [0.3, -0.4, -0.5, 0.5], [1, -0.6, -0.2, 1.1]], armaR: [[0, 0, 0, 0], [0.3, 20, 0, 30], [1, 90, 0, 80]], agarre: [[0, 0.92, -1], [0.08, -1, -1]]},
    [[0.0, 'impacto'], [0.72, 'cuerpo_al_suelo']], {root: [[0, 0, 0, 0], [0.35, 0, -0.1, -0.15], [0.7, 0, -0.62, -0.5], [1, 0, -0.78, -0.62]], hide: {arma: [[0, 1], [0.5, 0]]}}),
  caer_muerto_adelante: mk(1.3, false, {pelvis: [[0, 0, 0, 0], [0.35, 10, 0, 0], [0.75, 75, 0, 0], [1, 86, 0, -4]], torso: [[0, 0, 0, 0], [0.3, 25, 0, 0], [1, 4, 0, 0]], cabeza: [[0, 0, 0, 0], [1, -30, -25, 0]],
    brazoDe: [[0, 0, 0, -4], [0.5, -60, 0, -20], [1, -150, 0, -30]], brazoIz: [[0, 0, 0, 4], [0.5, -50, 0, 20], [1, -140, 0, 40]], antebrazoDe: [[0, -10, 0, 0]], antebrazoIz: [[0, -10, 0, 0]],
    musloIz: [[0, 0, 0, 0], [0.35, -25, 0, 0], [1, 0, 0, 6]], piernaIz: [[0, 0, 0, 0], [0.35, 60, 0, 0], [1, 10, 0, 0]], musloDe: [[0, 0, 0, 0], [0.5, 10, 0, 0], [1, 4, 0, -4]], piernaDe: [[0, 0, 0, 0], [0.5, 40, 0, 0], [1, 20, 0, 0]],
    armaP: [[0].concat(ORDEN.P), [0.4, -0.4, -0.6, 0.4]], armaR: [[0, 0, 0, 0], [0.4, 40, 0, 30]], agarre: [[0, 0.92, -1], [0.1, -1, -1]]},
    [[0, 'impacto'], [0.75, 'cuerpo_al_suelo']], {root: [[0, 0, 0, 0], [0.4, 0, -0.15, 0.1], [0.75, 0, -0.66, 0.45], [1, 0, -0.78, 0.55]], hide: {arma: [[0, 1], [0.45, 0]]}}),
  caer_muerto_rodillas: mk(1.8, false, {musloIz: [[0, 0, 0, 0], [0.4, -5, 0, 4], [0.6, -5, 0, 4], [1, -15, 0, 4]], piernaIz: [[0, 0, 0, 0], [0.4, 95, 0, 0], [0.6, 95, 0, 0], [1, 30, 0, 0]],
    musloDe: [[0, 0, 0, 0], [0.4, -5, 0, -4], [0.6, -5, 0, -4], [1, -10, 0, -4]], piernaDe: [[0, 0, 0, 0], [0.4, 95, 0, 0], [0.6, 95, 0, 0], [1, 25, 0, 0]],
    pelvis: [[0, 0, 0, 0], [0.6, 0, 0, 0], [1, 86, 0, 0]], torso: [[0, 0, 0, 0], [0.4, 20, 0, 0], [0.6, 12, 0, 0], [1, 4, 0, 0]], cabeza: [[0, 0, 0, 0], [0.5, 20, 0, 0], [1, -20, 20, 0]],
    brazoDe: [[0, 0, 0, -4], [0.4, -20, 0, -6], [1, -120, 0, -30]], brazoIz: [[0, 0, 0, 4], [0.4, -30, 0, 10], [1, -120, 0, 30]],
    armaP: [[0].concat(ORDEN.P), [0.3, -0.4, -0.6, 0.4]], armaR: [[0, 0, 0, 0], [0.3, 40, 0, 30]], agarre: [[0, 0.92, -1], [0.1, -1, -1]]},
    [[0, 'impacto'], [0.4, 'de_rodillas'], [0.9, 'cuerpo_al_suelo']], {root: [[0, 0, 0, 0], [0.4, 0, -0.42, 0], [0.6, 0, -0.42, 0], [1, 0, -0.78, 0.45]], hide: {arma: [[0, 1], [0.3, 0]]}}),
  caer_muerto_costado: mk(1.2, false, {pelvis: [[0, 0, 0, 0], [0.5, 0, 0, 25], [1, 0, 10, 86]], torso: [[0, 0, 0, 0], [0.4, 0, 0, 15], [1, 0, 0, -6]], cabeza: [[0, 0, 0, 0], [1, 0, 0, 20]],
    brazoDe: [[0, 0, 0, -4], [1, -40, 0, -60]], brazoIz: [[0, 0, 0, 4], [1, -10, 0, 20]], musloDe: [[0, 0, 0, 0], [1, -20, 0, -10]], piernaDe: [[0, 0, 0, 0], [1, 40, 0, 0]], musloIz: [[0, 0, 0, 0], [1, -5, 0, 0]],
    armaP: [[0].concat(ORDEN.P), [0.3, -0.5, -0.5, 0.3]], armaR: [[0, 0, 0, 0], [0.3, 30, 0, 40]], agarre: [[0, 0.92, -1], [0.1, -1, -1]]},
    [[0, 'impacto'], [0.75, 'cuerpo_al_suelo']], {root: [[0, 0, 0, 0], [0.5, 0.15, -0.3, 0], [1, 0.45, -0.78, 0]], hide: {arma: [[0, 1], [0.4, 0]]}}),
  tirar_arma: mk(0.7, false, {brazoDe: [[0, 0, 0, -4], [0.35, -90, 0, -60], [0.6, -20, 0, -10], [1, 0, 0, -4]], torso: [[0, 0, 0, 0], [0.4, 0, -30, 0], [1, 0, 20, 0]],
    armaP: [[0].concat(ORDEN.P), [0.4, -0.6, 0.2, 0.3]], armaR: [[0, 0, 0, 0], [0.4, 60, 0, -60]], agarre: [[0, 0.92, -1], [0.4, -1, -1]]},
    [[0.4, 'arma_tirada']], {hide: {arma: [[0, 1], [0.45, 0]]}}),
  huir: mk(0.6, true, {musloIz: [[0, -50, 0, 0], [0.5, 34, 0, 0], [1, -50, 0, 0]], piernaIz: [[0, 20, 0, 0], [0.25, 10, 0, 0], [0.5, 30, 0, 0], [0.75, 90, 0, 0], [1, 20, 0, 0]],
    musloDe: [[0, 34, 0, 0], [0.5, -50, 0, 0], [1, 34, 0, 0]], piernaDe: [[0, 30, 0, 0], [0.25, 90, 0, 0], [0.5, 20, 0, 0], [0.75, 10, 0, 0], [1, 30, 0, 0]],
    torso: [[0, 22, 0, 0]], cabeza: [[0, -10, 0, 0], [0.5, -10, 20, 0], [1, -10, 0, 0]],
    brazoDe: [[0, 30, 0, -6], [0.5, -50, 0, -6], [1, 30, 0, -6]], brazoIz: [[0, -50, 0, 6], [0.5, 30, 0, 6], [1, -50, 0, 6]], antebrazoDe: [[0, -70, 0, 0]], antebrazoIz: [[0, -70, 0, 0]]},
    [[0, 'paso'], [0.5, 'paso']], {root: [[0, 0, 0, 0], [0.25, 0, 0.07, 0], [0.5, 0, 0, 0], [0.75, 0, 0.07, 0], [1, 0, 0, 0]], hide: cp(HIDE_ARMA)}),
  rendirse: mk(2.0, true, Object.assign({brazoIz: [[0, -165, 0, 18], [0.5, -170, 0, 14], [1, -165, 0, 18]], brazoDe: [[0, -165, 0, -18], [0.5, -170, 0, -14], [1, -165, 0, -18]], antebrazoIz: [[0, -15, 0, 0]], antebrazoDe: [[0, -15, 0, 0]],
    cabeza: [[0, 10, 0, 0], [0.5, 14, 0, 0], [1, 10, 0, 0]]}, legsStand), [], {hide: cp(HIDE_ARMA)}),
  marcha_atado: mk(1.25, true, {musloIz: [[0, -20, 0, 0], [0.5, 16, 0, 0], [1, -20, 0, 0]], piernaIz: [[0, 6, 0, 0], [0.75, 36, 0, 0], [1, 6, 0, 0]], musloDe: [[0, 16, 0, 0], [0.5, -20, 0, 0], [1, 16, 0, 0]], piernaDe: [[0, 10, 0, 0], [0.25, 36, 0, 0], [0.5, 6, 0, 0], [1, 10, 0, 0]],
    brazoIz: [[0, 22, 0, -8]], brazoDe: [[0, 22, 0, 8]], antebrazoIz: [[0, 20, 0, -62]], antebrazoDe: [[0, 20, 0, 62]], torso: [[0, 10, 0, 0]], cabeza: [[0, 18, 0, 0]]},
    [[0, 'paso'], [0.5, 'paso']], {root: [[0, 0, 0, 0], [0.25, 0, 0.025, 0], [0.5, 0, 0, 0], [0.75, 0, 0.025, 0], [1, 0, 0, 0]], hide: cp(HIDE_ARMA)}),
  saludar: mk(2.4, true, Object.assign({armaP: [[0].concat(ORDEN.P), [0.2, -0.02, -0.38, 0.24], [0.8, -0.02, -0.38, 0.24], [1].concat(ORDEN.P)], armaR: [[0, 0, 0, 0], [0.2, -4, 0, 0], [0.8, -4, 0, 0], [1, 0, 0, 0]],
    agarre: [[0, 0.92, -1], [0.15, 0.45, 0.95], [0.85, 0.92, -1]], cabeza: [[0, 0, 0, 0], [0.2, -4, 0, 0], [0.8, -4, 0, 0], [1, 0, 0, 0]]}, legsStand), [[0.2, 'presenten_armas']]),
  saludar_espada: mk(2.4, true, Object.assign({armaP: [[0].concat(SABLE_BAJO.P), [0.2, -0.03, 0.18, 0.28], [0.8, -0.03, 0.18, 0.28], [1].concat(SABLE_BAJO.P)], armaR: [[0].concat(SABLE_BAJO.R), [0.2, -6, 0, 0], [0.8, -6, 0, 0], [1].concat(SABLE_BAJO.R)],
    agarre: [[0, 0.0, -1]], brazoIz: [[0, 6, 0, 8]]}, legsStand), [[0.2, 'saludo']]),
  celebrar: mk(1.0, true, {armaP: [[0, 0.85, 0.8, 0.08], [0.3, 0.85, 0.98, 0.08], [0.6, 0.85, 0.8, 0.08], [1, 0.85, 0.8, 0.08]], armaR: [[0, 0, 0, 90]], agarre: [[0, 1.1, 0.6]], cabeza: [[0, -20, 0, 0]],
    musloIz: [[0, -6, 0, 4], [0.3, -14, 0, 4], [0.6, -6, 0, 4]], piernaIz: [[0, 6, 0, 0], [0.3, 20, 0, 0], [0.6, 6, 0, 0]], musloDe: [[0, -6, 0, -4], [0.3, -14, 0, -4], [0.6, -6, 0, -4]], piernaDe: [[0, 6, 0, 0], [0.3, 20, 0, 0], [0.6, 6, 0, 0]]},
    [[0.3, 'hurra']], {root: [[0, 0, 0, 0], [0.3, 0, 0.1, 0], [0.6, 0, 0, 0], [1, 0, 0, 0]]}),
  ordenar: mk(2.2, true, Object.assign({brazoDe: [[0, 0, 0, -4], [0.2, -120, 10, -10], [0.6, -120, 10, -10], [0.85, -20, 0, -6], [1, 0, 0, -4]], antebrazoDe: [[0, 0, 0, 0], [0.2, -10, 0, 0], [0.6, -14, 0, 0], [1, 0, 0, 0]],
    arma: [[0, -30, 0, 0], [0.2, 10, 0, 0], [0.4, -6, 0, 0], [0.6, 10, 0, 0], [1, -30, 0, 0]], cabeza: [[0, 0, 0, 0], [0.2, -6, -20, 0], [0.6, -6, -20, 0], [1, 0, 0, 0]], torso: [[0, 0, 0, 0], [0.2, -4, -14, 0], [0.6, -4, -14, 0], [1, 0, 0, 0]],
    brazoIz: [[0, 0, 0, 4], [0.2, 10, 0, 14], [1, 0, 0, 4]], musloIz: [[0, 0, 0, 0], [0.2, -12, 0, 0], [0.8, -12, 0, 0], [1, 0, 0, 0]]}, {}), [[0.2, 'orden']]),
  observar_catalejo: mk(4.0, true, Object.assign({brazoIz: [[0, 10, 0, 18], [0.15, -112, 0, -40], [0.85, -112, 0, -40], [1, 10, 0, 18]], antebrazoIz: [[0, -60, 0, -20], [0.15, -112, 0, 0], [0.85, -112, 0, 0], [1, -60, 0, -20]],
    cabeza: [[0, 0, 0, 0], [0.15, -4, 8, 0], [0.5, -4, -8, 0], [0.85, -4, 8, 0], [1, 0, 0, 0]], torso: [[0, 0, 0, 0], [0.15, -3, 4, 0], [0.85, -3, 4, 0], [1, 0, 0, 0]]}, arm(SABLE_BAJO, [0.0, -1]), legsStand), [[0.15, 'observa']]),
  ondear: mk(2.8, true, Object.assign({armaP: [[0, -0.06, -0.12, 0.2], [0.5, -0.06, -0.1, 0.21], [1, -0.06, -0.12, 0.2]], armaR: [[0, -4, 0, -10], [0.5, -8, 0, -14], [1, -4, 0, -10]], agarre: [[0, 0.62, 0.3]],
    cabeza: [[0, -4, 0, 0], [0.5, -8, 8, 0], [1, -4, 0, 0]], torso: [[0, -3, 0, 0], [1, -3, 0, 0]]}, legsStand)),
  caer_con_estandarte: mk(1.6, false, {pelvis: [[0, 0, 0, 0], [0.35, 10, 0, 0], [0.75, 75, 0, 0], [1, 86, 0, -4]], torso: [[0, -3, 0, 0], [0.3, 25, 0, 0], [1, 4, 0, 0]], cabeza: [[0, 0, 0, 0], [1, -30, -25, 0]],
    brazoIz: [[0, 0, 0, 4], [0.5, -50, 0, 20], [1, -140, 0, 40]], musloIz: [[0, 0, 0, 0], [0.35, -25, 0, 0], [1, 0, 0, 6]], piernaIz: [[0, 0, 0, 0], [0.35, 60, 0, 0], [1, 10, 0, 0]], musloDe: [[0, 0, 0, 0], [0.5, 10, 0, 0], [1, 4, 0, -4]], piernaDe: [[0, 0, 0, 0], [0.5, 40, 0, 0], [1, 20, 0, 0]],
    armaP: [[0, -0.06, -0.12, 0.2], [0.5, -0.3, -0.1, 0.2], [1, -0.45, -0.25, 0.0]], armaR: [[0, -4, 0, -10], [0.5, 30, 0, -30], [1, 0, 0, -25]], agarre: [[0, 0.62, 0.3], [0.45, 0.62, -1]]},
    [[0, 'impacto'], [0.75, 'estandarte_al_suelo']], {root: [[0, 0, 0, 0], [0.4, 0, -0.15, 0.1], [0.75, 0, -0.66, 0.45], [1, 0, -0.78, 0.55]]}),
  recoger_estandarte: mk(1.6, false, {musloIz: [[0, -78, 0, 8], [0.45, -78, 0, 8], [1, -4, 0, 2]], piernaIz: [[0, 118, 0, 0], [0.45, 118, 0, 0], [1, 0, 0, 0]], musloDe: [[0, -62, 0, -8], [0.45, -62, 0, -8], [1, 2, 0, -2]], piernaDe: [[0, 112, 0, 0], [0.45, 112, 0, 0], [1, 0, 0, 0]],
    torso: [[0, 40, 0, 0], [0.45, 40, 0, 0], [1, -3, 0, 0]], cabeza: [[0, 20, 0, 0], [1, -4, 0, 0]],
    armaP: [[0, -0.3, -0.62, 0.5], [0.45, -0.3, -0.62, 0.5], [1, -0.06, -0.12, 0.2]], armaR: [[0, 75, 0, -20], [0.45, 75, 0, -20], [1, -4, 0, -10]], agarre: [[0, 0.62, -1], [0.4, 0.62, 0.3]]},
    [[0.4, 'recoge'], [0.95, 'enarbola']], {root: [[0, 0, -0.34, 0], [0.45, 0, -0.34, 0], [1, 0, 0, 0]]}),
  cavar: mk(1.6, true, {torso: [[0, 30, 0, 0], [0.3, 35, 0, 0], [0.6, 15, -20, 0], [0.8, 20, -20, 0], [1, 30, 0, 0]], cabeza: [[0, 20, 0, 0]],
    musloIz: [[0, -15, 0, 6]], piernaIz: [[0, 20, 0, 0]], musloDe: [[0, 10, 0, -6]], piernaDe: [[0, 10, 0, 0]],
    armaP: [[0, -0.1, -0.78, 0.5], [0.3, -0.1, -0.96, 0.55], [0.6, -0.25, -0.25, 0.4], [0.8, -0.25, -0.1, 0.45], [1, -0.1, -0.78, 0.5]], armaR: [[0, -20, 0, 0], [0.3, -15, 0, 0], [0.6, -60, 0, 30], [0.8, -80, 0, 40], [1, -20, 0, 0]], agarre: [[0, 0.95, 0.6]]},
    [[0.3, 'palada'], [0.8, 'lanza_tierra']]),
  camilla_delante: mk(1.1, true, {musloIz: [[0, -20, 0, 0], [0.5, 16, 0, 0], [1, -20, 0, 0]], piernaIz: [[0, 6, 0, 0], [0.75, 40, 0, 0], [1, 6, 0, 0]], musloDe: [[0, 16, 0, 0], [0.5, -20, 0, 0], [1, 16, 0, 0]], piernaDe: [[0, 10, 0, 0], [0.25, 40, 0, 0], [0.5, 6, 0, 0], [1, 10, 0, 0]],
    brazoIz: [[0, -8, 0, 4]], antebrazoIz: [[0, -25, 0, 0]], brazoDe: [[0, -8, 0, -4]], antebrazoDe: [[0, -25, 0, 0]], torso: [[0, 6, 0, 0]],
    armaP: [[0, 0, -0.15, 0.12], [0.25, 0, -0.12, 0.12], [0.5, 0, -0.15, 0.12], [0.75, 0, -0.12, 0.12], [1, 0, -0.15, 0.12]], armaR: [[0, -90, 0, 0]], agarre: [[0, -1, -1]]},
    [[0, 'paso'], [0.5, 'paso']], {root: [[0, 0, 0, 0], [0.25, 0, 0.025, 0], [0.5, 0, 0, 0], [0.75, 0, 0.025, 0], [1, 0, 0, 0]]}),
  camilla_detras: mk(1.1, true, {musloIz: [[0, -20, 0, 0], [0.5, 16, 0, 0], [1, -20, 0, 0]], piernaIz: [[0, 6, 0, 0], [0.75, 40, 0, 0], [1, 6, 0, 0]], musloDe: [[0, 16, 0, 0], [0.5, -20, 0, 0], [1, 16, 0, 0]], piernaDe: [[0, 10, 0, 0], [0.25, 40, 0, 0], [0.5, 6, 0, 0], [1, 10, 0, 0]],
    brazoIz: [[0, -38, 0, 4]], antebrazoIz: [[0, -32, 0, 0]], brazoDe: [[0, -38, 0, -4]], antebrazoDe: [[0, -32, 0, 0]], torso: [[0, 4, 0, 0]], cabeza: [[0, 10, 0, 0]]},
    [[0, 'paso'], [0.5, 'paso']], {root: [[0, 0, 0, 0], [0.25, 0, 0.025, 0], [0.5, 0, 0, 0], [0.75, 0, 0.025, 0], [1, 0, 0, 0]], hide: cp(HIDE_ARMA)}),
  // artillería: papeles sincronizados con 'servicio' / 'servicio_rc' de la pieza (6 s, el fuego en t = 0,62)
  srv_escobillon: mk(6.0, true, {armaP: [[0, -0.05, 0.05, 0.25], [0.08, -0.05, 0.05, 0.25], [0.14, -0.05, 0.05, 0.7], [0.2, -0.05, 0.05, 0.3], [0.28, -0.05, 0.05, 0.3], [0.34, -0.05, 0.05, 0.75], [0.42, -0.05, 0.05, 0.25], [0.5, -0.25, -0.95, 0.1], [1, -0.25, -0.95, 0.1]],
    armaR: [[0, 90, 0, 0], [0.42, 90, 0, 0], [0.5, 0, 0, 0], [0.95, 0, 0, 0], [1, 90, 0, 0]], agarre: [[0, 0.25, 0.7], [0.48, 1.0, -1]],
    torso: [[0, 10, 0, 0], [0.14, 20, 0, 0], [0.2, 8, 0, 0], [0.34, 20, 0, 0], [0.42, 8, 0, 0], [0.5, 0, 0, 0], [1, 0, 0, 0]], brazoIz: [[0, 0, 0, 6]], musloIz: [[0, -22, 0, 0], [0.48, -22, 0, 0], [0.52, 0, 0, 0], [0.95, 0, 0, 0], [1, -22, 0, 0]], musloDe: [[0, 10, 0, 0]]},
    [[0.14, 'limpiar'], [0.34, 'atacar']]),
  srv_cargador: mk(6.0, true, {brazoDe: [[0, -20, 0, -10], [0.18, -70, 0, -14], [0.3, -40, 0, -10], [0.42, -20, 0, -10], [1, -20, 0, -10]], antebrazoDe: [[0, -80, 0, 0], [0.18, -30, 0, 0], [0.3, -60, 0, 0], [0.42, -80, 0, 0], [1, -80, 0, 0]],
    torso: [[0, 0, 0, 0], [0.18, 30, 0, 0], [0.3, 6, 0, 0], [1, 0, 0, 0]], brazoIz: [[0, -20, 0, 6], [0.18, -60, 0, 6], [0.42, -20, 0, 6], [1, -20, 0, 6]], antebrazoIz: [[0, -80, 0, 0], [1, -80, 0, 0]],
    musloIz: [[0, 0, 0, 0], [0.18, -30, 0, 0], [0.42, 0, 0, 0], [1, 0, 0, 0]], piernaIz: [[0, 0, 0, 0], [0.18, 30, 0, 0], [0.42, 0, 0, 0], [1, 0, 0, 0]], arma: [[0, 0, 0, 0]]},
    [[0.2, 'cargar']], {root: [[0, 0, 0, 0], [0.18, 0, 0, 0.2], [0.3, 0, 0, 0.2], [0.42, 0, 0, 0], [1, 0, 0, 0]]}),
  srv_apuntador: mk(6.0, true, {torso: [[0, 14, 0, 0], [0.4, 14, 0, 0], [0.48, 34, 0, 0], [0.56, 34, 0, 0], [0.6, 6, 0, 0], [1, 14, 0, 0]], cabeza: [[0, 0, 0, 0], [0.48, 20, 0, 0], [0.56, 20, 0, 0], [0.6, 0, 0, 0], [1, 0, 0, 0]],
    armaP: [[0, 0.0, -0.55, 0.35], [0.48, 0.0, -0.7, 0.4], [0.52, 0.12, -0.7, 0.4], [0.56, -0.08, -0.7, 0.4], [0.6, 0.0, -0.55, 0.35], [1, 0.0, -0.55, 0.35]], armaR: [[0, 60, 0, 0], [0.48, 75, 0, 0], [0.6, 60, 0, 0], [1, 60, 0, 0]], agarre: [[0, 0.55, 0.85]],
    musloIz: [[0, -30, 0, 0], [1, -30, 0, 0]], piernaIz: [[0, 40, 0, 0], [1, 40, 0, 0]], musloDe: [[0, 10, 0, 0], [1, 10, 0, 0]]}, [[0.52, 'punteria']]),
  srv_artillero: mk(6.0, true, {brazoDe: [[0, -10, 0, -10], [0.56, -60, 0, -10], [0.62, -75, 0, -10], [0.7, -20, 0, -10], [1, -10, 0, -10]], antebrazoDe: [[0, -40, 0, 0], [0.56, -30, 0, 0], [0.62, -10, 0, 0], [0.7, -40, 0, 0], [1, -40, 0, 0]], arma: [[0, 30, 0, 0], [0.56, 60, 0, 0], [0.62, 80, 0, 0], [1, 30, 0, 0]],
    torso: [[0, 0, 0, 0], [0.6, 10, -10, 0], [0.64, -12, -10, 0], [0.7, 0, 0, 0], [1, 0, 0, 0]], cabeza: [[0, 0, 0, 0], [0.6, 0, 20, 0], [0.64, -8, 30, 0], [0.72, 0, 0, 0], [1, 0, 0, 0]],
    musloDe: [[0, 0, 0, 0], [0.56, -20, 0, 0], [0.7, 0, 0, 0], [1, 0, 0, 0]], brazoIz: [[0, 0, 0, 6], [0.62, -10, 0, 20], [0.7, 0, 0, 6], [1, 0, 0, 6]]},
    [[0.62, 'fuego']], {root: [[0, 0, 0, 0], [0.58, 0, 0, 0], [0.62, 0, 0, -0.08], [0.7, 0, 0, 0], [1, 0, 0, 0]]}),
  srv_jefe: mk(6.0, true, Object.assign({brazoDe: [[0, 0, 0, -4], [0.45, 0, 0, -4], [0.55, -150, 0, -10], [0.62, -150, 0, -10], [0.66, -80, 0, -20], [0.8, 0, 0, -4], [1, 0, 0, -4]], antebrazoDe: [[0, -10, 0, 0], [0.55, -10, 0, 0], [0.66, -10, 0, 0]],
    cabeza: [[0, 0, 0, 0], [0.3, 0, 30, 0], [0.5, 0, 0, 0], [0.7, -5, 0, 0], [1, 0, 0, 0]], brazoIz: [[0, 10, 0, 18]], antebrazoIz: [[0, -60, 0, -20]], arma: [[0, 0, 0, 0]]}, legsStand), [[0.6, 'orden_de_fuego']]),
  srv_mg_tirador: kneel(mk(0.5, true, {brazoIz: [[0, -72, 0, -8]], brazoDe: [[0, -72, 0, 8]], antebrazoIz: [[0, -22, 0, 0]], antebrazoDe: [[0, -22, 0, 0]], torso: [[0, 20, 0, 0], [0.25, 22, 1, 0], [0.5, 20, -1, 0], [0.75, 22, 1, 0], [1, 20, 0, 0]], cabeza: [[0, -4, 0, 0]], arma: [[0, 0, 0, 0]]}, [[0, 'rafaga'], [0.5, 'rafaga']])),
  srv_mg_municion: kneel(mk(2.0, true, {brazoDe: [[0, -60, 0, 20], [0.5, -55, 0, 25], [1, -60, 0, 20]], antebrazoDe: [[0, -60, 0, 0]], brazoIz: [[0, -50, 0, -20], [0.5, -58, 0, -15], [1, -50, 0, -20]], antebrazoIz: [[0, -70, 0, 0]], torso: [[0, 14, 22, 0]], cabeza: [[0, 20, 20, 0]], arma: [[0, 0, 0, 0]]}, [[0.5, 'cinta']])),
};
const S = CLIPS.soldado;
S.marcha_rapida = Object.assign(cp(S.marcha), {dur: 0.7});
S.recargar_A = sub(S.disparar_A, 0.2, 0.84, 5.8); S.recargar_D = sub(S.disparar_D, 0.32, 0.72, 1.0);
S.disparar_rodilla_A = kneel(S.disparar_A); S.disparar_rodilla_B = kneel(S.disparar_B); S.disparar_rodilla = kneel(S.disparar_D);
S.agacharse = cp(S.ponerse_a_cubierto); S.disparo_desde_parapeto = cp(S.disparar_D); S.manos_arriba = cp(S.rendirse); S.srv_caido = cp(S.caer_muerto_costado);
// clips sin arma explícita: posición de descanso (culata en el suelo)
Object.values(S).forEach(c => { if (!c.tracks.armaP && !c.tracks.arma) Object.assign(c.tracks, arm(ORDEN, [0.92, -1])); });

const J_LEGS = [['manoIz', 'canaIz', 0, -1], ['manoDe', 'canaDe', 0.5, -1], ['pataIz', 'corvIz', 0.25, 1], ['pataDe', 'corvDe', 0.75, 1]];
CLIPS.jinete = {
  idle: mk(4.0, true, {cuello: [[0, 0, 0, 0], [0.3, 8, 10, 0], [0.5, 14, 10, 0], [0.7, 4, -6, 0], [1, 0, 0, 0]], cola: [[0, 0, 0, 0], [0.4, 0, 0, 12], [0.6, 0, 0, -8], [1, 0, 0, 0]],
    brazoDe: [[0, 0, 0, -6]], antebrazoDe: [[0, -70, 0, 0]], arma: [[0, 80, 0, -10]], cabeza: [[0, 0, 0, 0], [0.6, 0, -16, 0], [1, 0, 0, 0]]}),
  paso: mk(1.2, true, Object.assign(gait(J_LEGS, 16, 45), {cuello: [[0, 0, 0, 0], [0.25, 6, 0, 0], [0.5, 0, 0, 0], [0.75, 6, 0, 0], [1, 0, 0, 0]], brazoDe: [[0, 0, 0, -6]], antebrazoDe: [[0, -70, 0, 0]], arma: [[0, 80, 0, -10]], cola: [[0, 6, 0, 4], [0.5, 6, 0, -4], [1, 6, 0, 4]]}),
    [[0, 'casco'], [0.25, 'casco'], [0.5, 'casco'], [0.75, 'casco']], {root: [[0, 0, 0, 0], [0.25, 0, 0.02, 0], [0.5, 0, 0, 0], [0.75, 0, 0.02, 0], [1, 0, 0, 0]]}),
  trote: mk(0.7, true, {manoIz: [[0, -30, 0, 0], [0.5, 22, 0, 0], [1, -30, 0, 0]], canaIz: [[0, -10, 0, 0], [0.25, -60, 0, 0], [0.5, 0, 0, 0], [1, -10, 0, 0]], pataDe: [[0, -24, 0, 0], [0.5, 26, 0, 0], [1, -24, 0, 0]], corvDe: [[0, 20, 0, 0], [0.25, 50, 0, 0], [0.5, 5, 0, 0], [1, 20, 0, 0]],
    manoDe: [[0, 22, 0, 0], [0.5, -30, 0, 0], [1, 22, 0, 0]], canaDe: [[0, 0, 0, 0], [0.5, -10, 0, 0], [0.75, -60, 0, 0], [1, 0, 0, 0]], pataIz: [[0, 26, 0, 0], [0.5, -24, 0, 0], [1, 26, 0, 0]], corvIz: [[0, 5, 0, 0], [0.5, 20, 0, 0], [0.75, 50, 0, 0], [1, 5, 0, 0]],
    cuello: [[0, 0, 0, 0], [0.25, -6, 0, 0], [0.5, 0, 0, 0], [0.75, -6, 0, 0], [1, 0, 0, 0]], torso: [[0, 4, 0, 0], [0.25, -2, 0, 0], [0.5, 4, 0, 0], [0.75, -2, 0, 0], [1, 4, 0, 0]],
    brazoDe: [[0, 0, 0, -6]], antebrazoDe: [[0, -70, 0, 0]], arma: [[0, 80, 0, -10]], cola: [[0, 20, 0, 0], [0.5, 30, 0, 0], [1, 20, 0, 0]]}, [[0, 'casco'], [0.5, 'casco']],
    {root: [[0, 0, 0, 0], [0.25, 0, 0.09, 0], [0.5, 0, 0, 0], [0.75, 0, 0.09, 0], [1, 0, 0, 0]]}),
  galope: mk(0.55, true, {caballo: [[0, 4, 0, 0], [0.3, -6, 0, 0], [0.6, 6, 0, 0], [1, 4, 0, 0]],
    manoIz: [[0, -50, 0, 0], [0.35, 30, 0, 0], [0.7, 40, 0, 0], [1, -50, 0, 0]], canaIz: [[0, -20, 0, 0], [0.35, 0, 0, 0], [0.7, -80, 0, 0], [1, -20, 0, 0]], manoDe: [[0, -40, 0, 0], [0.4, 34, 0, 0], [0.75, 30, 0, 0], [1, -40, 0, 0]], canaDe: [[0, -30, 0, 0], [0.4, 0, 0, 0], [0.75, -80, 0, 0], [1, -30, 0, 0]],
    pataIz: [[0, 40, 0, 0], [0.4, -40, 0, 0], [0.7, -10, 0, 0], [1, 40, 0, 0]], corvIz: [[0, 10, 0, 0], [0.4, 20, 0, 0], [0.7, 70, 0, 0], [1, 10, 0, 0]], pataDe: [[0, 30, 0, 0], [0.45, -36, 0, 0], [0.75, 0, 0, 0], [1, 30, 0, 0]], corvDe: [[0, 20, 0, 0], [0.45, 10, 0, 0], [0.75, 70, 0, 0], [1, 20, 0, 0]],
    cuello: [[0, -10, 0, 0], [0.3, 6, 0, 0], [0.6, -14, 0, 0], [1, -10, 0, 0]], cola: [[0, 40, 0, 0], [0.5, 30, 0, 0], [1, 40, 0, 0]], torso: [[0, 14, 0, 0], [0.3, 8, 0, 0], [0.6, 16, 0, 0], [1, 14, 0, 0]],
    brazoDe: [[0, -10, 0, -10]], antebrazoDe: [[0, -80, 0, 0]], arma: [[0, 90, 0, -10]]}, [[0, 'casco'], [0.3, 'casco'], [0.6, 'casco']],
    {root: [[0, 0, 0, 0], [0.3, 0, 0.16, 0], [0.6, 0, 0.02, 0], [1, 0, 0, 0]]}),
  frenar: mk(0.9, false, {caballo: [[0, 0, 0, 0], [0.4, -10, 0, 0], [1, -3, 0, 0]], manoIz: [[0, 0, 0, 0], [0.4, -35, 0, 0], [1, -5, 0, 0]], manoDe: [[0, 0, 0, 0], [0.4, -30, 0, 0], [1, -5, 0, 0]],
    pataIz: [[0, 0, 0, 0], [0.4, -30, 0, 0], [1, -6, 0, 0]], pataDe: [[0, 0, 0, 0], [0.4, -26, 0, 0], [1, -6, 0, 0]], corvIz: [[0, 0, 0, 0], [0.4, 40, 0, 0], [1, 8, 0, 0]], corvDe: [[0, 0, 0, 0], [0.4, 36, 0, 0], [1, 8, 0, 0]],
    cuello: [[0, 0, 0, 0], [0.4, -22, 0, 0], [1, -6, 0, 0]], torso: [[0, 8, 0, 0], [0.4, -16, 0, 0], [1, 0, 0, 0]], brazoDe: [[0, 0, 0, -6]], antebrazoDe: [[0, -70, 0, 0]], arma: [[0, 80, 0, -10]]},
    [[0.4, 'frenazo']], {root: [[0, 0, 0, 0], [0.4, 0, -0.08, 0], [1, 0, 0, 0]]}),
  encabritado: mk(1.8, false, {caballo: [[0, 0, 0, 0], [0.35, -45, 0, 0], [0.65, -45, 0, 0], [1, 0, 0, 0]], pataIz: [[0, 0, 0, 0], [0.35, 45, 0, 0], [0.65, 45, 0, 0], [1, 0, 0, 0]], pataDe: [[0, 0, 0, 0], [0.35, 42, 0, 0], [0.65, 42, 0, 0], [1, 0, 0, 0]],
    corvIz: [[0, 0, 0, 0], [0.35, 10, 0, 0], [1, 0, 0, 0]], manoIz: [[0, 0, 0, 0], [0.35, -40, 0, 0], [0.5, -20, 0, 0], [0.65, -40, 0, 0], [1, 0, 0, 0]], manoDe: [[0, 0, 0, 0], [0.35, -25, 0, 0], [0.5, -45, 0, 0], [0.65, -25, 0, 0], [1, 0, 0, 0]],
    canaIz: [[0, 0, 0, 0], [0.35, -90, 0, 0], [0.65, -90, 0, 0], [1, 0, 0, 0]], canaDe: [[0, 0, 0, 0], [0.35, -80, 0, 0], [0.65, -80, 0, 0], [1, 0, 0, 0]], cuello: [[0, 0, 0, 0], [0.35, 20, 0, 0], [0.5, 10, 10, 0], [0.65, 20, 0, 0], [1, 0, 0, 0]],
    torso: [[0, 0, 0, 0], [0.35, 32, 0, 0], [0.65, 32, 0, 0], [1, 0, 0, 0]], cola: [[0, 0, 0, 0], [0.35, -30, 0, 0], [1, 0, 0, 0]], brazoDe: [[0, 0, 0, -6], [0.35, -120, 0, -10], [0.65, -120, 0, -10], [1, 0, 0, -6]], antebrazoDe: [[0, -70, 0, 0], [0.35, -10, 0, 0], [0.65, -10, 0, 0], [1, -70, 0, 0]], arma: [[0, 80, 0, -10], [0.35, 10, 0, 0], [0.65, 10, 0, 0], [1, 80, 0, -10]]},
    [[0.3, 'relincho']], {root: [[0, 0, 0, 0], [0.35, 0, 0.22, -0.4], [0.65, 0, 0.22, -0.4], [1, 0, 0, 0]]}),
  caballo_caido: mk(1.6, false, {caballo: [[0, 0, 0, 0], [0.4, 10, 0, 0], [1, 0, 0, 80]], manoIz: [[0, 0, 0, 0], [1, -40, 0, 0]], canaIz: [[0, 0, 0, 0], [1, -30, 0, 0]], manoDe: [[0, 0, 0, 0], [1, -25, 0, 0]],
    pataIz: [[0, 0, 0, 0], [1, 30, 0, 0]], pataDe: [[0, 0, 0, 0], [1, 18, 0, 0]], cuello: [[0, 0, 0, 0], [0.4, 30, 0, 0], [1, 40, 0, 0]], torso: [[0, 0, 0, 0], [0.5, -20, 0, 0], [1, 0, 0, -40]],
    brazoDe: [[0, 0, 0, -6], [1, -40, 0, -50]], antebrazoDe: [[0, -70, 0, 0], [1, -10, 0, 0]], arma: [[0, 80, 0, -10], [1, 140, 0, 0]], cola: [[0, 0, 0, 0], [1, 30, 0, 0]]},
    [[0, 'impacto'], [0.7, 'al_suelo']], {root: [[0, 0, 0, 0], [0.4, 0, -0.25, 0.1], [1, 0.35, -0.72, 0.2]]}),
  entregar_orden: mk(2.5, true, {cuello: [[0, 0, 0, 0], [0.5, 8, 6, 0], [1, 0, 0, 0]], brazoDe: [[0, 0, 0, -6], [0.3, -80, 0, -10], [0.7, -80, 0, -10], [1, 0, 0, -6]], antebrazoDe: [[0, -70, 0, 0], [0.3, -10, 0, 0], [0.7, -10, 0, 0], [1, -70, 0, 0]],
    torso: [[0, 0, 0, 0], [0.3, 4, -15, 0], [0.7, 4, -15, 0], [1, 0, 0, 0]], cabeza: [[0, 0, 0, 0], [0.3, 0, -20, 0], [0.7, 0, -20, 0], [1, 0, 0, 0]], arma: [[0, 80, 0, -10]]}, [[0.5, 'entrega']]),
  observar_catalejo: mk(4.0, true, {cuello: [[0, 0, 0, 0], [0.5, 10, 8, 0], [1, 0, 0, 0]], brazoIz: [[0, 0, 0, 0], [0.15, -62, 0, -38], [0.85, -62, 0, -38], [1, 0, 0, 0]], cabeza: [[0, 0, 0, 0], [0.15, -3, 6, 0], [0.5, -3, -6, 0], [0.85, -3, 6, 0], [1, 0, 0, 0]],
    brazoDe: [[0, 0, 0, -6]], antebrazoDe: [[0, -70, 0, 0]], arma: [[0, 80, 0, -10]]}, [[0.15, 'observa']])
};
const Jc = CLIPS.jinete;
Jc.carga = cp(Jc.galope); Object.assign(Jc.carga.tracks, {brazoDe: [[0, -100, 0, -10]], antebrazoDe: [[0, -10, 0, 0]], arma: [[0, 10, 0, 0], [0.5, 4, 0, 0], [1, 10, 0, 0]], torso: [[0, 24, 0, 0], [0.3, 18, 0, 0], [0.6, 26, 0, 0], [1, 24, 0, 0]], cabeza: [[0, -16, 0, 0]]}); Jc.carga.ev = Jc.carga.ev.concat([[0, 'grito']]);
Jc.carga_lanza = cp(Jc.carga);
Jc.galope_largo = cp(Jc.galope); Jc.galope_largo.dur = 0.62; Object.assign(Jc.galope_largo.tracks, {torso: [[0, 22, 0, 0], [0.3, 16, 0, 0], [0.6, 24, 0, 0], [1, 22, 0, 0]], cabeza: [[0, -18, 0, 0]], brazoDe: [[0, -30, 0, -6]], antebrazoDe: [[0, -70, 0, 0]]});
Jc.galope_de_mando = cp(Jc.galope); Object.assign(Jc.galope_de_mando.tracks, {brazoDe: [[0, -160, 0, -10]], antebrazoDe: [[0, -10, 0, 0]], arma: [[0, 10, 0, 0]], cabeza: [[0, -8, -20, 0]]}); Jc.galope_de_mando.ev = Jc.galope_de_mando.ev.concat([[0.3, 'orden']]);
Jc.huida = cp(Jc.galope); Object.assign(Jc.huida.tracks, {torso: [[0, 18, 30, 0], [0.5, 20, 30, 0], [1, 18, 30, 0]], cabeza: [[0, 0, 50, 0]], brazoDe: [[0, 20, 0, -10]], antebrazoDe: [[0, -20, 0, 0]], arma: [[0, 150, 0, 0]]});
Jc.caida_del_general = cp(Jc.caballo_caido); Object.assign(Jc.caida_del_general.tracks, {torso: [[0, 0, 0, 0], [0.3, -40, 0, 0], [1, -30, 0, -60]], cabeza: [[0, 0, 0, 0], [1, -20, 20, 0]]});
Jc.abatido = cp(Jc.caballo_caido);

CLIPS.canon = {
  en_bateria: mk(4, true, {}),
  servicio: mk(6.0, true, {tubo: [[0, 4, 0, 0], [1, 4, 0, 0]], cureña: [[0, 0, 0, 0], [0.61, 0, 0, 0], [0.64, -2, 0, 0], [0.72, 0, 0, 0], [1, 0, 0, 0]]}, [[0.62, 'fuego'], [0.66, 'retroceso'], [0.85, 'volver_a_posicion']],
    {root: [[0, 0, 0, 0], [0.61, 0, 0, 0], [0.65, 0, 0, -0.45], [0.8, 0, 0, -0.45], [0.95, 0, 0, 0], [1, 0, 0, 0]]}),
  servicio_rc: mk(6.0, true, {tubo: [[0, 4, 0, 0], [1, 4, 0, 0]]}, [[0.62, 'fuego'], [0.64, 'retroceso']], {slide: [[0, 0], [0.61, 0], [0.64, -0.35], [0.8, 0], [1, 0]]}),
  remolque: mk(1.0, true, {ruedaIz: [[0, 0, 0, 0], [1, 360, 0, 0]], ruedaDe: [[0, 0, 0, 0], [1, 360, 0, 0]], cureña: [[0, 9, 0, 0]]}),
  enganchar: mk(1.2, false, {cureña: [[0, 0, 0, 0], [1, 9, 0, 0]]}, [[1, 'enganchado']]),
  desenganchar: mk(1.2, false, {cureña: [[0, 9, 0, 0], [1, 0, 0, 0]]}, [[1, 'en_bateria']]),
  fuego_mg: mk(0.5, true, {tubo: [[0, 0, 0, 0], [0.125, 0.8, 0, 90], [0.25, 0, 0, 180], [0.375, 0.8, 0, 270], [0.5, 0, 0, 360], [0.625, 0.8, 0, 450], [0.75, 0, 0, 540], [0.875, 0.8, 0, 630], [1, 0, 0, 720]]}, [[0, 'disparo'], [0.25, 'disparo'], [0.5, 'disparo'], [0.75, 'disparo']]),
  pieza_destruida: mk(1.2, false, {tubo: [[0, 0, 0, 0], [0.3, -25, 0, 8], [1, -18, 0, 10]], cureña: [[0, 0, 0, 0], [0.3, 6, 0, -10], [1, 4, 0, -14]], ruedaIz: [[0, 0, 0, 0], [0.4, 30, 0, 50], [1, 40, 0, 75]], ruedaDe: [[0, 0, 0, 0], [1, 20, 0, 0]]},
    [[0, 'explosion']], {root: [[0, 0, 0, 0], [0.3, 0, 0.1, -0.2], [1, 0, -0.15, -0.3]]})
};
CLIPS.canon.servicio_D = cp(CLIPS.canon.servicio_rc);
CLIPS.tanque = {
  avanzar: mk(1.2, true, {casco: [[0, 0.6, 0, 0], [0.5, -0.6, 0, 0], [1, 0.6, 0, 0]], torreta: [[0, 0, 0, 0]]}, [], {root: [[0, 0, 0, 0], [0.25, 0, 0.02, 0], [0.5, 0, 0, 0], [0.75, 0, 0.02, 0], [1, 0, 0, 0]], tread: 1}),
  girar_torreta: mk(6, true, {torreta: [[0, 0, 0, 0], [0.3, 0, 60, 0], [0.5, 0, 60, 0], [0.8, 0, -40, 0], [1, 0, 0, 0]]}),
  disparar: mk(3.0, true, {torreta: [[0, 0, 20, 0], [1, 0, 20, 0]], canon: [[0, -4, 0, 0], [0.3, -4, 0, 0], [0.32, -9, 0, 0], [0.5, -4, 0, 0], [1, -4, 0, 0]], casco: [[0, 0, 0, 0], [0.3, 0, 0, 0], [0.34, -1.5, 0, 0], [0.5, 0, 0, 0], [1, 0, 0, 0]]}, [[0.31, 'disparo']], {gunSlide: [[0, 0], [0.3, 0], [0.32, -0.14], [0.5, 0], [1, 0]]}),
  inmovilizado: mk(4.0, true, {torreta: [[0, 0, 0, 0], [0.4, 0, -30, 0], [0.8, 0, 25, 0], [1, 0, 0, 0]], casco: [[0, 2, 0, 3]]}, [[0, 'humo'], [0.5, 'humo']]),
  destruido: mk(1.5, false, {torreta: [[0, 0, 0, 0], [0.2, -12, 30, 18], [1, -10, 34, 22]], canon: [[0, 0, 0, 0], [1, 14, 0, 0]], casco: [[0, 0, 0, 0], [0.2, -3, 0, 2], [1, 3, 0, 5]]}, [[0, 'explosion'], [0.3, 'incendio']], {root: [[0, 0, 0, 0], [1, 0, -0.12, 0]]})
};
CLIPS.markI = {
  avanzar: mk(2.0, true, {casco: [[0, 1.0, 0, 0], [0.5, -1.0, 0, 0], [1, 1.0, 0, 0]], ruedasCola: [[0, 0, 0, 0]]}, [], {root: [[0, 0, 0, 0], [0.25, 0, 0.03, 0], [0.5, 0, 0, 0], [0.75, 0, 0.03, 0], [1, 0, 0, 0]], tread: 1}),
  disparar: mk(4.0, true, {canonIz: [[0, -3, 0, 0], [0.3, -3, 0, 0], [0.32, -8, 0, 0], [0.45, -3, 0, 0], [1, -3, 0, 0]], canonDe: [[0, -3, 0, 0], [0.62, -3, 0, 0], [0.64, -8, 0, 0], [0.78, -3, 0, 0], [1, -3, 0, 0]]}, [[0.31, 'disparo_izquierda'], [0.63, 'disparo_derecha']]),
  inmovilizado: mk(4.0, true, {casco: [[0, 2, 0, 3]], canonIz: [[0, 0, 0, 0], [0.5, 0, 20, 0], [1, 0, 0, 0]]}, [[0, 'humo'], [0.5, 'humo']]),
  destruido: mk(1.5, false, {casco: [[0, 0, 0, 0], [0.2, -4, 0, 4], [1, 5, 0, 8]], sponIz: [[0, 0, 0, 0], [1, 0, 0, 25]], canonIz: [[0, 0, 0, 0], [1, 18, 0, 0]], canonDe: [[0, 0, 0, 0], [1, 12, 0, 0]]}, [[0, 'explosion'], [0.3, 'incendio']], {root: [[0, 0, 0, 0], [1, 0, -0.2, 0]]})
};
const T_LEGS = k => [['an' + k + 'mi', null, 0, -1], ['an' + k + 'md', null, 0.5, -1], ['an' + k + 'pi', null, 0.25, 1], ['an' + k + 'pd', null, 0.75, 1]];
const WHEELS = {ruedaDI: [[0, 0, 0, 0], [1, 360, 0, 0]], ruedaDD: [[0, 0, 0, 0], [1, 360, 0, 0]], ruedaTI: [[0, 0, 0, 0], [1, 330, 0, 0]], ruedaTD: [[0, 0, 0, 0], [1, 330, 0, 0]]};
CLIPS.tiro = {
  parado: mk(4.0, true, {an1cu: [[0, 0, 0, 0], [0.4, 12, 6, 0], [0.6, 12, 6, 0], [1, 0, 0, 0]], an2cu: [[0, 6, 0, 0], [0.5, 0, -8, 0], [1, 6, 0, 0]]}),
  paso: mk(1.2, true, Object.assign(gait(T_LEGS(1), 16, 0), gait(T_LEGS(2), 16, 0), cp(WHEELS), {an1cu: [[0, 0, 0, 0], [0.25, 6, 0, 0], [0.5, 0, 0, 0], [0.75, 6, 0, 0], [1, 0, 0, 0]], an2cu: [[0, 6, 0, 0], [0.25, 0, 0, 0], [0.5, 6, 0, 0], [0.75, 0, 0, 0], [1, 6, 0, 0]]}), [[0, 'casco'], [0.5, 'casco']]),
  trote: mk(0.7, true, Object.assign(gait(T_LEGS(1).map((l, i) => [l[0], null, i === 0 || i === 3 ? 0 : 0.5, l[3]]), 26, 0), gait(T_LEGS(2).map((l, i) => [l[0], null, i === 0 || i === 3 ? 0.5 : 0, l[3]]), 26, 0), cp(WHEELS)), [[0, 'casco'], [0.5, 'casco']],
    {root: [[0, 0, 0, 0], [0.25, 0, 0.03, 0], [0.5, 0, 0, 0], [0.75, 0, 0.03, 0], [1, 0, 0, 0]]})
};
CLIPS.estatico = {reposo: mk(1, true, {})};
const CLIP_SETS = {}; Object.keys(CLIPS).forEach(r => { CLIP_SETS[r] = Object.keys(CLIPS[r]); });

/* ---------------- evaluación de poses (sin estado; sin asignaciones en el bucle) ---------------- */
const _e = new THREE.Euler(), _q = new THREE.Quaternion(), _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1), _pm = new THREE.Matrix4();
function smooth(t) { return t * t * (3 - 2 * t); }
// v4: interpolación cúbica monótona (Fritsch–Carlson) por canal. Sin sobreoscilación: dos claves iguales siguen siendo una pausa.
// En los bucles (_loopCur) la tangente atraviesa el cierre t = 1 → 0, así que el ciclo no «frena» al dar la vuelta.
var _loopCur = false;
function _slope(tr, k, i, loop) {
  const N = tr.length, v = tr[k][i + 1], D = loop ? tr[N - 1][i + 1] - tr[0][i + 1] : 0;   // D ≠ 0: giro continuo (rueda) → se «desenrolla» el cierre
  let p = k - 1, q = k + 1, tp, tq, vp, vq;
  if (p < 0) { if (!loop) return 0; p = N - 2; tp = tr[p][0] - 1; vp = tr[p][i + 1] - D; } else { tp = tr[p][0]; vp = tr[p][i + 1]; }
  if (q >= N) { if (!loop) return 0; q = 1; tq = tr[q][0] + 1; vq = tr[q][i + 1] + D; } else { tq = tr[q][0]; vq = tr[q][i + 1]; }
  const h0 = tr[k][0] - tp, h1 = tq - tr[k][0]; if (h0 <= 1e-6 || h1 <= 1e-6) return 0;
  const d0 = (v - vp) / h0, d1 = (vq - v) / h1;
  if (d0 * d1 <= 0) return 0;
  const w1 = 2 * h1 + h0, w2 = h1 + 2 * h0; return (w1 + w2) / (w1 / d0 + w2 / d1);
}
function sampleTrack(tr, t, out, n) {                  // tr: [[t, a, b, c...]] ordenado; t en [0,1]
  if (!tr || !tr.length) { for (let i = 0; i < n; i++) out[i] = 0; return out; }
  if (tr.length === 1 || t <= tr[0][0]) { for (let i = 0; i < n; i++) out[i] = tr[0][i + 1]; return out; }
  const N = tr.length, loop = _loopCur && tr[0][0] <= 1e-6 && tr[N - 1][0] >= 1 - 1e-6;
  for (let k = 0; k < N - 1; k++) {
    const a = tr[k], b = tr[k + 1];
    if (t <= b[0]) {
      const h = Math.max(1e-6, b[0] - a[0]), u = (t - a[0]) / h, u2 = u * u, u3 = u2 * u;
      const h00 = 2 * u3 - 3 * u2 + 1, h10 = u3 - 2 * u2 + u, h01 = -2 * u3 + 3 * u2, h11 = u3 - u2;
      for (let i = 0; i < n; i++) {
        out[i] = h00 * a[i + 1] + h01 * b[i + 1] + h * (h10 * _slope(tr, k, i, loop) + h11 * _slope(tr, k + 1, i, loop));
      }
      return out;
    }
  }
  const l = tr[N - 1]; for (let i = 0; i < n; i++) out[i] = l[i + 1]; return out;
}
const _r3 = [0, 0, 0], _t3 = [0, 0, 0], _t1 = [0];
function sampleStep(tr, t, out, n) { let k = 0; for (let i = 0; i < tr.length; i++) if (tr[i][0] <= t + 1e-6) k = i; for (let i = 0; i < n; i++) out[i] = tr[k][i + 1]; return out; }
// poseTroop(tipo o esqueleto, clip, fase, salida Float32Array(MAXP*16)) → matrices de cada parte en el espacio de la figura
function poseTroop(kindOrRig, clipName, phase, out) {
  const rig = RIGS[kindOrRig] ? kindOrRig : KINDS[kindOrRig].rig, parts = RIGS[rig], clip = (CLIPS[rig] || {})[clipName] || {tracks: {}};
  out = out || new Float32Array(MAXP * 16); const t = clip.loop === false ? Math.min(1, Math.max(0, phase)) : phase - Math.floor(phase); _loopCur = clip.loop !== false;
  for (let i = 0; i < parts.length; i++) {
    const name = parts[i][0], par = parts[i][1], off = parts[i][2];
    sampleTrack(clip.tracks[name], t, _r3, 3);
    _e.set(_r3[0] * D2R, _r3[1] * D2R, _r3[2] * D2R); _q.setFromEuler(_e);
    _p.set(off[0], off[1], off[2]);
    if (par < 0 && clip.root) { sampleTrack(clip.root, t, _t3, 3); _p.x += _t3[0]; _p.y += _t3[1]; _p.z += _t3[2]; }
    if (clip.pos && clip.pos[name]) { sampleTrack(clip.pos[name], t, _t3, 3); _p.x += _t3[0]; _p.y += _t3[1]; _p.z += _t3[2]; }
    if (name === 'tubo' && clip.slide) { sampleTrack(clip.slide, t, _t1, 1); _p.z += _t1[0]; }
    if (name === 'canon' && clip.gunSlide) { sampleTrack(clip.gunSlide, t, _t1, 1); _p.z += _t1[0]; }
    _m.compose(_p, _q, _s);
    if (par >= 0) { _pm.fromArray(out, par * 16); _m.premultiply(_pm); }
    _m.toArray(out, i * 16);
  }
  if (clip.tracks.armaP) ikWeapon(parts, clip, t, out);
  if (!clip.chute) for (let i = 0; i < parts.length; i++) if (parts[i][0] === 'paracaidas') { const o = i * 16; out[o] = out[o + 1] = out[o + 2] = out[o + 4] = out[o + 5] = out[o + 6] = out[o + 8] = out[o + 9] = out[o + 10] = 0; }
  if (clip.hide) for (const name in clip.hide) {               // parte oculta: escala 0 alrededor de su pivote
    sampleStep(clip.hide[name], t, _t1, 1); if (_t1[0] > 0.5) continue;
    for (let i = 0; i < parts.length; i++) if (parts[i][0] === name) { const o = i * 16; out[o] = out[o + 1] = out[o + 2] = out[o + 4] = out[o + 5] = out[o + 6] = out[o + 8] = out[o + 9] = out[o + 10] = 0; }
  }
  return out;
}
// arma colocada respecto al torso (armaP posición, armaR giro) y manos por IK de dos huesos hasta los puntos de agarre
const _T = new THREE.Matrix4(), _W = new THREE.Matrix4(), _S = new THREE.Vector3(), _E = new THREE.Vector3(), _Tg = new THREE.Vector3(), _d = new THREE.Vector3(), _pp2 = new THREE.Vector3(), _pole = new THREE.Vector3(), _dn = new THREE.Vector3(0, -1, 0), _qa = new THREE.Quaternion(), _sc1 = new THREE.Vector3(1, 1, 1);
const _gr = [0, 0], _ap = [0, 0, 0], _ar = [0, 0, 0];
function ikWeapon(parts, clip, t, out) {
  const ix = {}; parts.forEach((p, i) => { ix[p[0]] = i; });
  if (ix.arma == null || ix.torso == null) return;
  sampleTrack(clip.tracks.armaP, t, _ap, 3); sampleTrack(clip.tracks.armaR || [[0, 0, 0, 0]], t, _ar, 3); sampleStep(clip.tracks.agarre || [[0, 0.3, 0.75]], t, _gr, 2);
  _T.fromArray(out, ix.torso * 16);
  _e.set(_ar[0] * D2R, _ar[1] * D2R, _ar[2] * D2R); _q.setFromEuler(_e); _p.set(_ap[0], _ap[1], _ap[2]); _W.compose(_p, _q, _s).premultiply(_T); _W.toArray(out, ix.arma * 16);
  [['brazoDe', 'antebrazoDe', _gr[0], -1], ['brazoIz', 'antebrazoIz', _gr[1], 1]].forEach(([u, l, y, side]) => {
    if (y < 0 || ix[u] == null || ix[l] == null) return;
    _S.setFromMatrixPosition(_pm.fromArray(out, ix[u] * 16));
    _Tg.set(0, y, 0).applyMatrix4(_W);
    _pole.set(0.45 * side, -0.55, -0.25).applyMatrix4(_T); _pp2.setFromMatrixPosition(_T); _pole.sub(_pp2).add(_S);   // codo: fuera y abajo-atrás
    ik2(_S, _Tg, _pole, 0.29, 0.28, out, ix[u], ix[l]);
  });
}
function ik2(S, T, pole, l1, l2, out, iu, il) {
  _d.subVectors(T, S); let dist = _d.length(); const dir = _d.normalize(); dist = Math.min(l1 + l2 - 1e-3, Math.max(Math.abs(l1 - l2) + 1e-3, dist));
  const ca = (l1 * l1 + dist * dist - l2 * l2) / (2 * l1 * dist), sa = Math.sqrt(Math.max(0, 1 - ca * ca));
  _pp2.subVectors(pole, S); _pp2.addScaledVector(dir, -_pp2.dot(dir)).normalize();
  _E.copy(S).addScaledVector(dir, l1 * ca).addScaledVector(_pp2, l1 * sa);
  _Tg.copy(S).addScaledVector(dir, dist);
  _d.subVectors(_E, S).normalize(); _qa.setFromUnitVectors(_dn, _d); _m.compose(S, _qa, _sc1); _m.toArray(out, iu * 16);
  _d.subVectors(_Tg, _E).normalize(); _qa.setFromUnitVectors(_dn, _d); _m.compose(_E, _qa, _sc1); _m.toArray(out, il * 16);
}
// blendPose(a, b, k, salida): mezcla lineal de matrices de parte (transiciones de 0,15–0,3 s)
function blendPose(a, b, k, out) { out = out || new Float32Array(a.length); for (let i = 0; i < a.length; i++) out[i] = a[i] + (b[i] - a[i]) * k; return out; }

/* ---------------- horneado (textura de huesos) ---------------- */
// Una fila por fotograma; MAXP × 3 texeles RGBA float por fila (matriz 3×4 por parte). v4: 30 fps, ≤ 240 fotogramas por clip (TROOP_BAKE).
const TROOP_BAKE = {fps: 30, max: 240, half: true};
let _baked = null;
function bakeClips() {
  if (_baked) return _baked;
  const rows = [], index = {}; let row = 0;
  Object.keys(CLIPS).forEach(rig => {
    if (!RIGS[rig] || !RIGS[rig].length) return;
    index[rig] = {};
    const seen = new Map();
    Object.keys(CLIPS[rig]).forEach(cn => {
      const c = CLIPS[rig][cn]; if (!c) return;
      if (seen.has(c)) { index[rig][cn] = seen.get(c); return; }                       // alias (mismo objeto): se reutilizan las filas
      const frames = c.still ? 2 : Math.max(2, Math.min(TROOP_BAKE.max, Math.round(c.dur * (c.fps || TROOP_BAKE.fps))));
      index[rig][cn] = {row, frames, dur: c.dur, loop: c.loop !== false, tread: c.tread || 0, ev: c.ev || []}; seen.set(c, index[rig][cn]);
      for (let f = 0; f < frames; f++) { const ph = c.loop === false ? f / (frames - 1) : f / frames; rows.push(poseTroop(rig, cn, ph)); }
      row += frames;
    });
  });
  // FPR fotogramas por fila de textura para no pasar de 2048 filas (límite seguro en móviles)
  const FPR = Math.max(1, Math.ceil(rows.length / 2048)), W = MAXP * 3 * FPR, H = Math.ceil(rows.length / FPR), data = new Float32Array(W * H * 4);
  rows.forEach((m, r) => { const rr = Math.floor(r / FPR), cc = r - rr * FPR; for (let p = 0; p < MAXP; p++) { const o = (rr * W + cc * MAXP * 3 + p * 3) * 4, e = m.subarray(p * 16, p * 16 + 16);
    for (let i = 0; i < 3; i++) { data[o + i * 4] = e[i]; data[o + i * 4 + 1] = e[4 + i]; data[o + i * 4 + 2] = e[8 + i]; data[o + i * 4 + 3] = e[12 + i]; } } });
  // v5: media precisión (RGBA16F) en la GPU: la mitad de memoria; error < 2 mm a 4 m. TROOP_BAKE.half = false vuelve a float32
  let gpu = data, type = THREE.FloatType;
  if (TROOP_BAKE.half && THREE.DataUtils && THREE.HalfFloatType) { gpu = new Uint16Array(data.length); for (let i = 0; i < data.length; i++) gpu[i] = THREE.DataUtils.toHalfFloat(data[i]); type = THREE.HalfFloatType; }
  const tex = new THREE.DataTexture(gpu, W, H, THREE.RGBAFormat, type); tex.needsUpdate = true; tex.magFilter = tex.minFilter = THREE.NearestFilter;
  if (H > 4096 || W > 4096) console.warn('troops3d: textura de huesos de ' + W + '×' + H);
  _baked = {tex, index, rows, W, H, FPR, frames: rows.length, bytes: gpu.byteLength, half: type !== THREE.FloatType}; return _baked;
}

/* ---------------- paletas en textura ---------------- */
// fila 0: tonos de piel (0–3) y pelajes (4–7); filas siguientes: una por nación × época × papel
const SKIN = ['#f0c8a0', '#d9a77e', '#b07a50', '#7a4e30'], HORSE = ['#8a5430', '#a8683a', '#3a322c', '#b8b0a2'];
function makePaletteTex(entries) {
  const W = 12, H = 1 + entries.length, d = new Uint8Array(W * H * 4), put = (r, c, hex) => { const v = new THREE.Color(hex), o = (r * W + c) * 4; /* Color(hex) ya es lineal (ColorManagement de r152): se guarda en sRGB */ d[o] = Math.round(Math.pow(v.r, 1 / 2.2) * 255); d[o + 1] = Math.round(Math.pow(v.g, 1 / 2.2) * 255); d[o + 2] = Math.round(Math.pow(v.b, 1 / 2.2) * 255); d[o + 3] = 255; };
  SKIN.forEach((h, i) => put(0, i, h)); HORSE.forEach((h, i) => put(0, 4 + i, h));
  entries.forEach((e, r) => { const p = uniformPalette(e[0], e[1], e[2]); [p.main, p.trim, p.accessory, p.hat, p.flag[0], p.flag[1], p.flag[2], p.vehicle, p.mark[0], p.mark[1], p.mark[2], p.vehicle2].forEach((h, c) => put(r + 1, c, h)); });
  const tex = new THREE.DataTexture(d, W, H, THREE.RGBAFormat); tex.needsUpdate = true; tex.magFilter = tex.minFilter = THREE.NearestFilter; tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/* ---------------- material (GPU) ---------------- */
// Uniformes compartidos: uBones (huesos horneados), uPal (paletas), uTime. Atributos por instancia:
//   iAnimA = (fila, fotogramas (< 0 = sin bucle), duración, fase | instante de inicio), iAnimB = clip anterior (fila < 0 = sin mezcla), w = inicio de la mezcla,
//   iLook  = (fila de paleta + brillo, tono de piel, pelaje, velocidad de oruga)
function makeTroopMaterial(shared, opts) {
  opts = opts || {};
  const mat = new THREE.MeshLambertMaterial({vertexColors: true, side: opts.side || THREE.FrontSide});
  mat.onBeforeCompile = sh => {
    sh.uniforms.uBones = shared.bonesU; sh.uniforms.uBonesSize = shared.bonesSizeU; sh.uniforms.uFPR = shared.fprU; sh.uniforms.uPal = shared.palU; sh.uniforms.uPalSize = shared.palSizeU; sh.uniforms.uTime = shared.timeU; sh.uniforms.uBlend = shared.blendU; sh.uniforms.uDebug = shared.debugU;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>
uniform sampler2D uBones; uniform vec2 uBonesSize; uniform float uFPR; uniform sampler2D uPal; uniform vec2 uPalSize; uniform float uTime; uniform float uBlend; uniform float uDebug;
attribute float aPart; attribute float aZone; attribute float aVar; attribute vec2 aFx;
attribute vec4 iAnimA; attribute vec4 iAnimB; attribute vec4 iLook;
varying float vTread;
vec4 bt(float x, float y) { return texture2D(uBones, vec2((x + 0.5) / uBonesSize.x, (y + 0.5) / uBonesSize.y)); }
mat4 boneAt(float fr, float part) { float row = floor(fr / uFPR); float x = (fr - row * uFPR) * 60.0 + part * 3.0; vec4 a = bt(x, row), b = bt(x + 1.0, row), c = bt(x + 2.0, row);
  return mat4(a.x, b.x, c.x, 0.0, a.y, b.y, c.y, 0.0, a.z, b.z, c.z, 0.0, a.w, b.w, c.w, 1.0); }
mat4 clipBone(vec4 an, float part) {
  float fr = abs(an.y), f;
  if (an.y < 0.0) f = clamp((uTime - an.w) / an.z, 0.0, 1.0) * (fr - 1.0);
  else f = fract(uTime / an.z + an.w) * fr;
  float f0 = floor(f), f1 = an.y < 0.0 ? min(f0 + 1.0, fr - 1.0) : mod(f0 + 1.0, fr);
  return boneAt(an.x + f0, part) * (1.0 - (f - f0)) + boneAt(an.x + f1, part) * (f - f0);
}`)
      .replace('#include <beginnormal_vertex>', `mat4 bm = clipBone(iAnimA, aPart);
if (iAnimB.x >= 0.0) { float k = clamp((uTime - iAnimB.w) / uBlend, 0.0, 1.0); if (k < 1.0) bm = clipBone(vec4(iAnimB.xyz, iAnimB.y < 0.0 ? -1e4 : iAnimA.w), aPart) * (1.0 - k) + bm * k; }
vec3 objectNormal = normalize(mat3(bm) * normal + vec3(0.0, 1e-5, 0.0));
#ifdef USE_TANGENT
vec3 objectTangent = vec3(tangent.xyz);
#endif`)
      .replace('#include <begin_vertex>', `vec3 pos0 = position;
if (aFx.x > 0.0) { float ph = iAnimA.w * 6.2831; pos0.z += sin(aFx.x * 7.0 - uTime * 6.0 + ph) * 0.13 * aFx.x + sin(aFx.x * 3.0 - uTime * 2.3 + pos0.y * 3.0) * 0.05 * aFx.x; pos0.y += sin(aFx.x * 5.0 - uTime * 4.0 + ph) * 0.03 * aFx.x; }
vec3 transformed = (bm * vec4(pos0, 1.0)).xyz;
float sp = iLook.w, piv = step(500.0, sp); sp -= piv * 1000.0;
vTread = aFx.y != 0.0 ? abs(aFx.y) + uTime * sp * (piv > 0.5 ? sign(aFx.y) : 1.0) : -1.0;`)
      .replace('#include <color_vertex>', `float palRow = floor(iLook.x), bright = 0.92 + fract(iLook.x) * 0.16;
vec3 zc = aZone < 11.5 ? texture2D(uPal, vec2((aZone + 0.5) / uPalSize.x, (palRow + 1.5) / uPalSize.y)).rgb : color;
if (aVar > 0.5 && aVar < 1.5) zc = texture2D(uPal, vec2((iLook.y + 0.5) / uPalSize.x, 0.5 / uPalSize.y)).rgb;
if (aVar > 1.5) zc = texture2D(uPal, vec2((4.0 + iLook.z + 0.5) / uPalSize.x, 0.5 / uPalSize.y)).rgb;
if (uDebug > 0.5 && aZone > 11.5) zc = vec3(0.55);
vColor = zc * (aZone < 2.5 || (aZone > 6.5 && aZone < 7.5) || (aZone > 10.5 && aZone < 11.5) ? bright : 1.0);`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vTread;')
      .replace('#include <color_fragment>', `#include <color_fragment>
if (vTread >= 0.0) diffuseColor.rgb *= 0.7 + 0.45 * step(0.5, fract(vTread));`);
  };
  mat.customProgramCacheKey = () => 'troopVAT';
  return mat;
}

/* ---------------- API: buildTroop ---------------- */
const _cache = {};
function nearestEra(K, era) { if (K.eras.includes(era)) return era; const i = TROOP_ERAS.indexOf(era); for (let d = 1; d < 5; d++) { if (K.eras.includes(TROOP_ERAS[i - d])) return TROOP_ERAS[i - d]; if (K.eras.includes(TROOP_ERAS[i + d])) return TROOP_ERAS[i + d]; } return K.eras[0]; }
// buildTroop(tipo, época, {nation, role}) → {tint, fixed, geometry, parts, clips, lod: [{level, geometry, tint, fixed, tris}×3], tris, rig, era}
function buildTroop(kind, era, opts) {
  opts = opts || {}; const K = KINDS[kind]; if (!K) throw new Error('tipo desconocido: ' + kind);
  era = nearestEra(K, era || 'A');
  const nat = opts.nation || 'GEN', o = K.o(era, nat, opts.role), key = [kind, era, o.toc || '', o.flagLayout || '', opts.role || '', o.modelo || '', o.marca || '', o.tripulante || '', o.lmg || '', o.equipo || ''].join('|');
  if (_cache[key]) return _cache[key];
  const lv = [K.build(o), K.lod(o, 1), K.lod(o, 2)].map((g, level) => ({level, geometry: g.toGeometry(), tint: g.toGeometry(z => z < 11.5), fixed: g.toGeometry(z => z >= 11.5), tris: g.tris()}));
  const res = {kind, era, rig: K.rig, parts: RIGS[K.rig].map(p => p[0]), clips: CLIP_SETS[K.rig] || [], tris: lv[0].tris, geometry: lv[0].geometry, tint: lv[0].tint, fixed: lv[0].fixed, lod: lv, headgear: o.toc || null};
  _cache[key] = res; return res;
}
// clave de geometría: las naciones con el mismo tocado (y bandera) comparten malla y lote
function troopGeoKey(kind, era, nation) { const K = KINDS[kind], e = nearestEra(K, era), o = K.o(e, nation || 'GEN'); return [kind, e, o.toc || '', o.flagLayout || '', o.modelo || '', o.marca || '', o.tripulante || '', o.lmg || '', o.equipo || ''].join('|'); }

/* ---------------- campo de tropas instanciadas (GPU) ---------------- */
// TroopShared(naciones, {eras}): eras = épocas con fila de paleta (por defecto las 4; con muchos países, pasa solo la época actual)
function TroopShared(nations, opts) {
  const baked = bakeClips(); this.baked = baked; this.nations = []; this.eras = (opts && opts.eras) || TROOP_ERAS.slice();
  this.bonesU = {value: baked.tex}; this.bonesSizeU = {value: new THREE.Vector2(baked.W, baked.H)}; this.fprU = {value: baked.FPR}; this.palU = {value: null}; this.palSizeU = {value: new THREE.Vector2(12, 1)};
  this.timeU = {value: 0}; this.blendU = {value: 0.22}; this.debugU = {value: 0};
  this.addNations(nations || ['GEN']);
}
// addNations: añade naciones (p. ej. países del juego registrados en NACIONES) y rehace la textura de paletas
TroopShared.prototype.addNations = function (list) {
  list.forEach(n => { if (!this.nations.includes(n)) this.nations.push(n); }); if (!this.nations.includes('GEN')) this.nations.push('GEN');
  this.palEntries = []; this._row = {};
  this.nations.forEach(n => this.eras.forEach(e => ROLES.forEach(r => { this._row[n + e + r] = this.palEntries.length; this.palEntries.push([n, e, r]); })));
  if (this.palTex) this.palTex.dispose(); this.palTex = makePaletteTex(this.palEntries); this.palU.value = this.palTex; this.palSizeU.value.set(12, 1 + this.palEntries.length);
};
TroopShared.prototype.palRow = function (nation, era, rol) { const r = this._row[nation + era + (rol || 'linea')]; return r != null ? r : this._row['GEN' + era + (rol || 'linea')] || 0; };
// setEras: cambia las épocas con paleta (p. ej. al pasar de 1855 a 1856) y rehace la textura
TroopShared.prototype.setEras = function (eras) { this.eras = eras.slice(); this.addNations([]); };
TroopShared.prototype.clipInfo = function (rig, clip) { return this.baked.index[rig] && this.baked.index[rig][clip]; };
// TroopBatch: una malla instanciada por tipo + época + tocado + LOD
function TroopBatch(shared, kind, era, nation, cap, opts) {
  opts = opts || {}; const K = KINDS[kind], t = buildTroop(kind, era, {nation, role: opts.role}), lod = opts.lod || 0;
  const geo = t.lod[lod].geometry.clone();
  this.iAnimA = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4); this.iAnimB = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4).fill(-1), 4); this.iLook = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4);
  [this.iAnimA, this.iAnimB, this.iLook].forEach(a => a.setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('iAnimA', this.iAnimA); geo.setAttribute('iAnimB', this.iAnimB); geo.setAttribute('iLook', this.iLook);
  this.mesh = new THREE.InstancedMesh(geo, makeTroopMaterial(shared, {side: K.dobleCara || lod === 2 ? THREE.DoubleSide : THREE.FrontSide}), cap);
  this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  this.mesh.count = 0; this.mesh.frustumCulled = false; this.shared = shared; this.kind = kind; this.rig = t.rig; this.era = t.era; this.cap = cap; this.tris = t.lod[lod].tris; this.lod = lod; this.rol = K.pal || 'linea'; this.role = opts.role;
}
const _m4 = new THREE.Matrix4(), _qq = new THREE.Quaternion(), _pp = new THREE.Vector3(), _ss = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);
// add(x, y, z, rumbo, escala, nación, clip, {phase | start, h, bright, skin, horse, tread}) → índice. Sin opciones deterministas, se sortean.
TroopBatch.prototype.add = function (x, y, z, yaw, scale, nation, clip, o) {
  o = o || {}; const i = this.mesh.count; if (i >= this.cap) return -1; this.mesh.count++;
  const h = 1 + (o.h != null ? o.h : (Math.random() - 0.5) * 0.12);
  _qq.setFromAxisAngle(_up, yaw); _pp.set(x, y, z); _ss.set(scale * h, scale * h, scale * h); _m4.compose(_pp, _qq, _ss); this.mesh.setMatrixAt(i, _m4);
  this.setClip(i, clip, o.start != null ? o.start : o.phase != null ? o.phase : Math.random(), false);
  const row = this.shared.palRow(nation, this.era, this.rol), br = o.bright != null ? o.bright : Math.random();
  this.iLook.setXYZW(i, row + 0.02 + br * 0.96 * 0.999, o.skin != null ? o.skin : Math.floor(Math.random() * 4), o.horse != null ? o.horse : Math.floor(Math.random() * 4), o.tread || 0);
  this.iLook.needsUpdate = true; this.mesh.instanceMatrix.needsUpdate = true;
  return i;
};
// setClip(i, clip, fase (bucle) | instante de inicio en s (sin bucle), mezclar): con mezcla conserva el clip anterior durante uBlend s
TroopBatch.prototype.setClip = function (i, clip, phaseOrStart, blend) {
  const ci = this.shared.clipInfo(this.rig, clip); if (!ci) return false;
  if (blend) this.iAnimB.setXYZW(i, this.iAnimA.getX(i), this.iAnimA.getY(i), this.iAnimA.getZ(i), this.shared.timeU.value); else this.iAnimB.setXYZW(i, -1, 0, 1, 0);
  this.iAnimA.setXYZW(i, ci.row, ci.loop ? ci.frames : -ci.frames, ci.dur, ci.loop ? phaseOrStart : (phaseOrStart != null ? phaseOrStart : this.shared.timeU.value));
  this.iAnimA.needsUpdate = this.iAnimB.needsUpdate = true; return true;
};
TroopBatch.prototype.clear = function () { this.mesh.count = 0; };
TroopBatch.prototype.dispose = function () { this.mesh.geometry.dispose(); this.mesh.material.dispose(); };
// TroopLodSet: tres lotes (LOD 0/1/2) del mismo tipo; add(distancia, ...) elige el nivel. dist = [límite LOD0, límite LOD1] en unidades del mundo
function TroopLodSet(shared, kind, era, nation, caps, opts) {
  opts = opts || {}; caps = Array.isArray(caps) ? caps : [caps, caps, caps]; this.dist = opts.dist || [25, 90];
  this.batches = [0, 1, 2].map(l => new TroopBatch(shared, kind, era, nation, caps[l], {role: opts.role, lod: l}));
  this.meshes = this.batches.map(b => b.mesh);
}
TroopLodSet.prototype.begin = function () { for (let l = 0; l < 3; l++) this.batches[l].mesh.count = 0; };
TroopLodSet.prototype.levelFor = function (d) { return d < this.dist[0] ? 0 : d < this.dist[1] ? 1 : 2; };
TroopLodSet.prototype.add = function (d, x, y, z, yaw, scale, nation, clip, o) { const l = this.levelFor(d); return [l, this.batches[l].add(x, y, z, yaw, scale, nation, clip, o)]; };

/* ---------------- reserva en CPU: una malla por parte ---------------- */
function CpuBatch(kind, era, nation, cap, opts) {
  opts = opts || {}; const K = KINDS[kind], t = buildTroop(kind, era, {nation, role: opts.role}), g = t.lod[opts.lod || 0].geometry, parts = RIGS[t.rig].length, pa = g.getAttribute('aPart').array, P = g.getAttribute('position').array, N = g.getAttribute('normal').array, Co = g.getAttribute('color').array, Zo = g.getAttribute('aZone').array, Vr = g.getAttribute('aVar').array;
  const pal = uniformPalette(nation, t.era, K.pal), zc = [pal.main, pal.trim, pal.accessory, pal.hat, pal.flag[0], pal.flag[1], pal.flag[2], pal.vehicle, pal.mark[0], pal.mark[1], pal.mark[2], pal.vehicle2].map(h => new THREE.Color(h)), skin = new THREE.Color(SKIN[1]), coat = new THREE.Color(HORSE[0]);
  this.meshes = []; this.rig = t.rig; this.kind = kind; this.cap = cap; this.count = 0; this.parts = parts; this.tris = t.lod[opts.lod || 0].tris;
  for (let p = 0; p < parts; p++) {
    const idx = []; for (let v = 0; v < pa.length; v++) if (pa[v] === p) idx.push(v); if (!idx.length) { this.meshes.push(null); continue; }
    const gp = new THREE.BufferGeometry(), pp = new Float32Array(idx.length * 3), nn = new Float32Array(idx.length * 3), cc = new Float32Array(idx.length * 3);
    idx.forEach((v, k) => { for (let j = 0; j < 3; j++) { pp[k * 3 + j] = P[v * 3 + j]; nn[k * 3 + j] = N[v * 3 + j]; } const z = Zo[v]; const c = Vr[v] === 1 ? skin : Vr[v] === 2 ? coat : z < 11.5 ? zc[z] : null; cc[k * 3] = c ? c.r : Co[v * 3]; cc[k * 3 + 1] = c ? c.g : Co[v * 3 + 1]; cc[k * 3 + 2] = c ? c.b : Co[v * 3 + 2]; });
    gp.setAttribute('position', new THREE.BufferAttribute(pp, 3)); gp.setAttribute('normal', new THREE.BufferAttribute(nn, 3)); gp.setAttribute('color', new THREE.BufferAttribute(cc, 3));
    const m = new THREE.InstancedMesh(gp, new THREE.MeshLambertMaterial({vertexColors: true, side: K.dobleCara ? THREE.DoubleSide : THREE.FrontSide}), cap); m.count = 0; m.frustumCulled = false; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.meshes.push(m);
  }
  this.base = new Float32Array(cap * 16); this.anim = new Float32Array(cap * 4);   // matriz de instancia y (fila de clip, fotogramas, duración, fase)
}
CpuBatch.prototype.add = function (x, y, z, yaw, scale, clipInfo, phase) {
  const i = this.count++; _qq.setFromAxisAngle(_up, yaw); _pp.set(x, y, z); _ss.set(scale, scale, scale); _m4.compose(_pp, _qq, _ss); _m4.toArray(this.base, i * 16);
  this.anim[i * 4] = clipInfo.row; this.anim[i * 4 + 1] = clipInfo.frames; this.anim[i * 4 + 2] = clipInfo.dur; this.anim[i * 4 + 3] = phase; this.meshes.forEach(m => { if (m) m.count = this.count; });
};
// update: por instancia toma el fotograma horneado más cercano y escribe instancia × parte en cada malla (sin asignaciones)
const _bi = new THREE.Matrix4(), _bp = new THREE.Matrix4();
CpuBatch.prototype.update = function (time, baked) {
  const rows = baked.rows;
  for (let i = 0; i < this.count; i++) {
    const r = this.anim[i * 4], fr = this.anim[i * 4 + 1], f = Math.floor(((time / this.anim[i * 4 + 2] + this.anim[i * 4 + 3]) % 1) * fr), pose = rows[r + f];
    _bi.fromArray(this.base, i * 16);
    for (let p = 0; p < this.parts; p++) { const m = this.meshes[p]; if (!m) continue; _bp.fromArray(pose, p * 16).premultiply(_bi); _bp.toArray(m.instanceMatrix.array, i * 16); }
  }
  for (let p = 0; p < this.meshes.length; p++) if (this.meshes[p]) this.meshes[p].instanceMatrix.needsUpdate = true;
};

/* ---------------- grupos (pieza + servidores, general + ayudante...) ---------------- */
// troopGroup(nombre, época, estado, {pieza}) → [{kind, role, at: [x, z, rumbo en grados], clip}] en metros, relativos al centro del grupo y mirando a +Z.
// Todos los miembros deben usar la MISMA fase (o el mismo instante de inicio) para que el fuego de la pieza y los servidores coincidan.
const TROOP_GROUPS = {
  bateria: {nombre: 'Pieza con 4 servidores', estados: ['fuego', 'reposo', 'marcha']},
  ametralladora: {nombre: 'Ametralladora con 2 servidores', estados: ['fuego', 'reposo']},
  general: {nombre: 'General con ayudante', estados: ['reposo', 'marcha', 'carga', 'observar']},
  mariscal: {nombre: 'Mariscal con estandarte de mando', estados: ['reposo', 'marcha']},
  camilla: {nombre: 'Camilla con dos sanitarios', estados: ['marcha']},
  fuerte: {nombre: 'Guarnición tras el parapeto', estados: ['fuego', 'cubierto', 'asomarse']},
  tren: {nombre: 'Pieza enganchada al avantrén', estados: ['marcha', 'trote']}
};
function troopGroup(name, era, estado, opts) {
  opts = opts || {}; const AB2 = era === 'A' || era === 'B';
  if (name === 'bateria') {
    const p = opts.pieza || (AB2 ? 'canon' : 'canon_rc'), liso = p === 'canon' || (p === 'obus' && era !== 'D'), f = estado === 'fuego', m = estado === 'marcha';
    const sv = liso ? 'servicio' : 'servicio_rc', crew = liso ? [['escobillon', 'srv_escobillon', [-0.9, 2.0, -90]], ['cargador', 'srv_cargador', [0.9, 2.0, 90]], ['apuntador', 'srv_apuntador', [0.35, -1.7, 0]], ['artillero', 'srv_artillero', [-1.2, -0.6, 90]]]
      : [['jefe', 'srv_jefe', [-1.6, 0.4, 0]], ['cargador', 'srv_cargador', [0.9, -0.2, 90]], ['apuntador', 'srv_apuntador', [-0.35, -1.7, 0]], ['artillero', 'srv_artillero', [-0.9, -0.6, 90]]];
    return [{kind: p, at: [0, 0, 0], clip: f ? sv : m ? 'remolque' : 'en_bateria'}].concat(crew.map(([role, c, at]) => ({kind: 'artillero', role, at: m ? [at[0] > 0 ? 1.0 : -1.0, at[1] - 1.5, 0] : at, clip: f ? c : m ? 'marcha' : 'idle'})));
  }
  if (name === 'ametralladora') { const f = estado === 'fuego'; return [{kind: 'ametralladora', at: [0, 0, 0], clip: f ? (era >= 'D' ? 'fuego_maxim' : 'fuego_mg') : 'en_bateria'}, {kind: 'artillero', role: 'tirador_mg', at: [0, era === 'D' ? -0.95 : -1.45, 0], clip: f ? 'srv_mg_tirador' : 'idle'}, {kind: 'artillero', role: 'municion', at: [0.75, era === 'D' ? -0.5 : -0.9, -40], clip: f ? 'srv_mg_municion' : 'idle'}]; }
  if (name === 'general') { const c = {reposo: 'idle', marcha: 'paso', carga: 'galope_de_mando', observar: 'observar_catalejo'}[estado] || 'idle'; return [{kind: 'general', at: [0, 0, 0], clip: c}, {kind: 'ayudante', at: [1.6, -1.2, 0], clip: c === 'galope_de_mando' ? 'galope' : c === 'observar_catalejo' ? 'idle' : c}]; }
  if (name === 'mariscal') { const c = estado === 'marcha' ? 'paso' : 'idle'; return [{kind: 'mariscal', at: [0, 0, 0], clip: c}, {kind: 'estandarte', at: [-1.5, -1.3, 0], clip: c}]; }
  if (name === 'camilla') return [{kind: 'sanitario', role: 'delante', at: [0, 1.3, 0], clip: 'camilla_delante'}, {kind: 'sanitario', role: 'detras', at: [0, 1.3 - 2.62, 0], clip: 'camilla_detras'}];
  if (name === 'fuerte') { const c = {fuego: AB2 ? 'disparar_A' : 'disparo_desde_parapeto', cubierto: 'agacharse', asomarse: 'asomarse'}[estado] || 'agacharse'; return [{kind: 'parapeto', at: [0, 0.4, 0], clip: 'reposo'}, {kind: 'fusilero', at: [-1.0, -0.35, 0], clip: c}, {kind: 'fusilero', at: [0.9, -0.35, 0], clip: c}, {kind: 'oficial', at: [0, -1.3, 0], clip: estado === 'fuego' ? 'ordenar' : 'observar_catalejo'}]; }
  if (name === 'tren') { const c = estado === 'trote' ? 'trote' : 'paso'; return [{kind: 'avantren', at: [0, 0, 0], clip: c}, {kind: AB2 ? 'canon' : 'canon_rc', at: [0, -3.3, 180], clip: 'remolque'}]; }
  return [];
}

/* ---------------- eventos y fases (para sincronizar humo, sonido y bajas) ---------------- */
function clipInfo(kind, clip) { const K = KINDS[kind] || {rig: kind}, c = (CLIPS[K.rig] || {})[clip]; return c ? {dur: c.dur, loop: c.loop !== false, ev: c.ev || []} : null; }
// clipPhase: misma fórmula que el shader. Bucle: fract(t/dur + fase); sin bucle: clamp((t - inicio)/dur)
function clipPhase(kind, clip, time, phaseOrStart) { const c = clipInfo(kind, clip); if (!c) return 0; if (!c.loop) return Math.min(1, Math.max(0, (time - phaseOrStart) / c.dur)); const x = time / c.dur + phaseOrStart; return x - Math.floor(x); }
// eventsBetween: llama cb(nombre, t) por cada evento cruzado entre dos fases consecutivas (tiene en cuenta la vuelta del bucle)
function eventsBetween(kind, clip, ph0, ph1, cb) {
  const c = clipInfo(kind, clip); if (!c) return 0; let n = 0;
  for (let i = 0; i < c.ev.length; i++) { const t = c.ev[i][0]; const hit = ph1 >= ph0 ? (t > ph0 && t <= ph1) : (t > ph0 || t <= ph1); if (hit) { cb(c.ev[i][1], t); n++; } }
  return n;
}
function exportClipsJSON() {
  const r = (k, v) => typeof v === 'number' ? Math.round(v * 1000) / 1000 : v;
  return JSON.stringify({version: 2, fps: {bucle: TROOP_BAKE.fps, sinBucle: TROOP_BAKE.fps}, interpolacion: 'cubica monotona (Fritsch-Carlson), bucles cerrados', convenciones: 'pistas [t, rx, ry, rz] en grados (Euler XYZ); raíz [t, x, y, z] en metros; eventos [t, nombre]; agarre [t, y mano derecha, y mano izquierda]; hide [t, visible]', partes: RIGS, clips: CLIPS}, r);
}

/* ---------------- estadísticas ---------------- */
function troopStats() {
  const out = [], LIM = {inf: [1250, 60, 10], cav: [2050, 120, 10], art: [1000, null, null], tank: [1400, null, null], tren: [3200, null, null], mot: [3000, null, null], mech: [3000, null, null], arm: [1600, null, null]};   // v4: LOD0 detallado (solo de cerca)
  TROOP_KINDS.forEach(k => KINDS[k].eras.forEach(e => {
    const roles = KINDS[k].roles ? [KINDS[k].roles[0]] : [undefined];
    roles.forEach(role => { const t = buildTroop(k, e, {nation: 'GEN', role}); const verts = t.lod[0].tris * 3;
      out.push({tipo: k, epoca: e, triangulos: t.lod[0].tris, lod1: t.lod[1].tris, lod2: t.lod[2].tris, partes: RIGS[t.rig].length, clips: t.clips.length, vertices: verts, bytesInstancia: 64 + 48, limite: (LIM[KINDS[k].clase] || [])[0] || null}); });
  }));
  return out;
}


/* ================= v4: animación biomecánica =================
   Los ciclos de locomoción se generan a partir de curvas articulares de marcha y carrera humanas (cadera, rodilla, tobillo por % de ciclo;
   valores medios de laboratorio de análisis de la marcha, p. ej. Winter 1991 y Novacheck 1998, redondeados) y de los patrones de pisada de
   los aires del caballo (paso a 4 tiempos lateral, trote diagonal a 2 tiempos, galope transverso de 4 tiempos con suspensión; Muybridge 1878–87,
   Clayton 2004). La altura de la raíz se calcula por cinemática directa para que el pie (o casco) de apoyo no atraviese ni flote sobre el suelo.
   Encima se añade movimiento secundario: balanceo y rotación de la pelvis, contrarrotación del tronco, estabilización de la cabeza, braceo con
   retraso, respiración, cabeceo del cuello del caballo, cola con inercia y compensación del jinete. Los clips existentes conservan nombre,
   duración, eventos y pistas de armas: solo se sustituyen o suman pistas. */
const ANIM = {};
// curva periódica Catmull-Rom sobre una tabla de 11 valores (0 %, 10 %, … 100 %; el último = el primero)
function per(tab, t) {
  const n = tab.length - 1, x = (((t % 1) + 1) % 1) * n, i = Math.floor(x), u = x - i, p = k => tab[((k % n) + n) % n];
  const p0 = p(i - 1), p1 = p(i), p2 = p(i + 1), p3 = p(i + 2);
  return 0.5 * (2 * p1 + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u * u + (-p0 + 3 * p1 - 3 * p2 + p3) * u * u * u);
}
const curve = (N, fn) => { const tr = []; for (let i = 0; i <= N; i++) { const t = i / N, v = fn(t); tr.push([t, v[0] || 0, v[1] || 0, v[2] || 0]); } return tr; };
const TAU = Math.PI * 2, cos1 = t => Math.cos(TAU * t), sin1 = t => Math.sin(TAU * t);
// suma una capa f(t) → [rx, ry, rz] a la pista de una parte (remuestrea la pista original con la misma interpolación del horneado)
function addLayer(clip, part, fn, N) {
  N = N || 48; const tr = clip.tracks[part], b = [0, 0, 0], loop = clip.loop !== false, old = _loopCur; _loopCur = loop;
  clip.tracks[part] = curve(N, t => { sampleTrack(tr, t, b, 3); const v = fn(t); return [b[0] + (v[0] || 0), b[1] + (v[1] || 0), b[2] + (v[2] || 0)]; });
  _loopCur = old;
}
// cinemática directa del clip: punto local de una parte → mundo (sin raíz)
const _fkOut = new Float32Array(MAXP * 16);
function fkPoints(rig, clip, t, pts) {
  const tmp = '__fk', saveRoot = clip.root; CLIPS[rig][tmp] = Object.assign({}, clip, {root: null});
  poseTroop(rig, tmp, t, _fkOut); delete CLIPS[rig][tmp]; clip.root = saveRoot;
  const idx = rigIndex(rig);
  return pts.map(([part, p]) => { const o = idx[part] * 16, m = _fkOut; return [m[o] * p[0] + m[o + 4] * p[1] + m[o + 8] * p[2] + m[o + 12], m[o + 1] * p[0] + m[o + 5] * p[1] + m[o + 9] * p[2] + m[o + 13], m[o + 2] * p[0] + m[o + 6] * p[1] + m[o + 10] * p[2] + m[o + 14]]; });
}
// raíz apoyada: y = −(punto de contacto más bajo); en los tramos de suspensión (stance(t) = false) se interpola y se añade un vuelo parabólico
function groundRoot(rig, clip, contacts, N, o) {
  o = o || {}; const ys = [];
  for (let i = 0; i <= N; i++) { const t = i / N, P = fkPoints(rig, clip, t, contacts); ys.push(-Math.min(...P.map(q => q[1]))); }
  if (o.stance) {                                                     // tramos en el aire
    const air = ys.map((_, i) => !o.stance(i / N));
    for (let i = 0; i <= N; i++) if (air[i]) {
      let a = i, b = i; while (a > 0 && air[a]) a--; while (b < N && air[b]) b++;
      const u = (i - a) / Math.max(1, b - a); ys[i] = ys[a] + (ys[b] - ys[a]) * u + (o.lift || 0.04) * 4 * u * (1 - u);
    }
  }
  const base = o.base || 0, sx = o.sway || (() => 0);
  return ys.map((y, i) => [i / N, sx(i / N), y + base, 0]);
}

/* ---------- humano ---------- */
const GAIT = {
  marcha: {hip: [30, 26, 18, 10, 2, -6, -10, -2, 14, 26, 30], knee: [4, 16, 14, 8, 5, 10, 36, 58, 44, 14, 4], ank: [0, -5, 2, 6, 9, 8, -14, -8, 0, 2, 0], stance: 0.6},
  carrera: {hip: [35, 28, 16, 4, -8, -6, 14, 34, 46, 44, 35], knee: [22, 40, 36, 26, 22, 50, 88, 98, 70, 36, 22], ank: [4, 16, 18, 4, -22, -20, -6, 2, 6, 6, 4], stance: 0.38}
};
const FOOT = side => [['pie' + side, [0, -0.081, -0.065]], ['pie' + side, [0, -0.081, 0.175]], ['pie' + side, [0, -0.081, 0.06]]];
// legs(clip, tipo, o): sustituye piernas, pelvis y raíz; o.amp (escala), o.lean (inclinación del tronco), o.armSwing (brazo izquierdo libre, grados),
// o.armR (también el derecho), o.shoulder (contrarrotación de hombros), o.keepTorso (no tocar el torso)
function humanLocomotion(clip, kind, o) {
  o = o || {}; const G = GAIT[kind], A = o.amp || 1, N = 40, run = kind === 'carrera';
  const leg = (side, ph) => {
    clip.tracks['muslo' + side] = curve(N, t => [-per(G.hip, t + ph) * A + (o.hipOff || 0), 0, (side === 'Iz' ? 1 : -1) * (run ? 1 : 2)]);
    clip.tracks['pierna' + side] = curve(N, t => [per(G.knee, t + ph) * (0.6 + 0.4 * A) + (o.kneeOff || 0)]);
    clip.tracks['pie' + side] = curve(N, t => [-per(G.ank, t + ph) * Math.min(1.2, A)]);
  };
  leg('Iz', 0); leg('De', 0.5);
  const yaw = (run ? 7 : 5) * A, roll = (run ? 2 : 3);
  clip.tracks.pelvis = curve(N, t => [o.pelvisPitch || 0, -yaw * cos1(t), roll * sin1(t)]);
  if (!o.keepTorso) {
    const sh = o.shoulder != null ? o.shoulder : 4, base = clip.tracks.torso, b = [0, 0, 0];
    clip.tracks.torso = curve(N, t => { sampleTrack(base, t, b, 3); return [(o.lean || 3) + b[0] + (run ? 2.5 : 1) * Math.cos(2 * TAU * t + 0.6), b[1] + (yaw + sh) * cos1(t), b[2] - roll * 0.7 * sin1(t)]; });
  }
  const hb = clip.tracks.cabeza, h = [0, 0, 0];
  clip.tracks.cabeza = curve(N, t => { sampleTrack(hb, t, h, 3); return [h[0] - (o.lean || 3) * 0.6 - (run ? 1.5 : 0.6) * Math.cos(2 * TAU * t + 0.6), h[1] - (o.shoulder != null ? o.shoulder : 4) * 0.5 * cos1(t), h[2] + roll * 0.4 * sin1(t)]; });
  if (o.armSwing) {
    const s = o.armSwing, lag = 0.06;
    clip.tracks.brazoIz = curve(N, t => [s * cos1(t - lag), 0, 6 + 2 * sin1(t)]);
    clip.tracks.antebrazoIz = curve(N, t => [-(run ? 70 : 12) - (run ? 25 : 14) * (1 - cos1(t - lag)) / 2]);
    if (o.armR) { clip.tracks.brazoDe = curve(N, t => [-s * cos1(t - lag), 0, -6 - 2 * sin1(t)]); clip.tracks.antebrazoDe = curve(N, t => [-(run ? 70 : 12) - (run ? 25 : 14) * (1 + cos1(t - lag)) / 2]); }
  }
  clip.root = groundRoot('soldado', clip, FOOT('Iz').concat(FOOT('De')), N, {
    sway: t => (run ? 0.012 : 0.02) * sin1(t),
    stance: run ? (t => { const a = t % 1, b = (t + 0.5) % 1; return a <= G.stance + 0.01 || b <= G.stance + 0.01; }) : null, lift: 0.05});
  clip.ev = [[0, 'paso'], [0.5, 'paso']];
  return clip;
}
// respiración y micro-movimientos para clips en pie (n respiraciones por bucle)
function breathe(clip, amp) {
  const n = Math.max(1, Math.round(clip.dur / 3.6)), a = amp || 1;
  addLayer(clip, 'torso', t => [-1.1 * a * Math.sin(TAU * n * t), 0, 0]);
  addLayer(clip, 'cabeza', t => [0.7 * a * Math.sin(TAU * n * t - 0.4), 0.8 * a * Math.sin(TAU * t + 1.3), 0]);
  if (clip.tracks.brazoIz || !clip.tracks.armaP) addLayer(clip, 'brazoIz', t => [0.8 * a * Math.sin(TAU * n * t - 0.8), 0, 0.6 * a * Math.sin(TAU * n * t)]);
}
// reparto del peso en reposo: la pelvis bascula hacia la pierna de apoyo y la otra rodilla se relaja
function weightShift(clip) {
  addLayer(clip, 'pelvis', t => [0, 1.5 * Math.sin(TAU * t + 0.5), 2.2 * Math.sin(TAU * t)]);
  addLayer(clip, 'musloIz', t => [-1.5 * Math.max(0, -Math.sin(TAU * t)), 0, -2 * Math.sin(TAU * t)]);
  addLayer(clip, 'musloDe', t => [-1.5 * Math.max(0, Math.sin(TAU * t)), 0, -2 * Math.sin(TAU * t)]);
  addLayer(clip, 'piernaIz', t => [3 * Math.max(0, -Math.sin(TAU * t))]); addLayer(clip, 'piernaDe', t => [3 * Math.max(0, Math.sin(TAU * t))]);
  addLayer(clip, 'torso', t => [0, 0, -1.6 * Math.sin(TAU * t)]);
  addLayer(clip, 'cabeza', t => [0, 0, 0.8 * Math.sin(TAU * t)]);
  clip.root = curve(24, t => [0.018 * Math.sin(TAU * t), -0.003 * Math.abs(Math.sin(TAU * t)), 0]);
}
(function soldierV4() {
  const S = CLIPS.soldado;
  // marcha al hombro: brazo izquierdo braceando, fusil al hombro (IK de siempre)
  humanLocomotion(S.marcha, 'marcha', {amp: 0.85, lean: 2, armSwing: 16, shoulder: 2});
  humanLocomotion(S.marcha_rapida, 'marcha', {amp: 1.05, lean: 4, armSwing: 22, shoulder: 3});
  humanLocomotion(S.marcha_atado, 'marcha', {amp: 0.7, lean: 8, keepTorso: false, shoulder: 0});
  humanLocomotion(S.cargar_bayoneta, 'carrera', {amp: 0.9, lean: 3, shoulder: 0, pelvisPitch: 4});
  humanLocomotion(S.huir, 'carrera', {amp: 1.0, lean: 3, armSwing: 38, armR: !S.huir.tracks.armaP, shoulder: 6, pelvisPitch: 5});
  if (S.avance_agachado) humanLocomotion(S.avance_agachado, 'marcha', {amp: 0.8, lean: 28, hipOff: -32, kneeOff: 30, shoulder: 0, pelvisPitch: 8});
  ['camilla_delante', 'camilla_detras'].forEach(k => S[k] && humanLocomotion(S[k], 'marcha', {amp: 0.7, lean: 3, shoulder: 0}));
  // reposo y clips estáticos en bucle: respiración; los de pie además reparten el peso
  ['idle', 'idle_oficial', 'ordenar', 'observar_catalejo', 'ondear', 'saludar', 'saludar_espada', 'rendirse', 'manos_arriba', 'cuadro'].forEach(k => { if (!S[k]) return; breathe(S[k], 1); });
  ['idle', 'idle_oficial', 'observar_catalejo'].forEach(k => S[k] && weightShift(S[k]));
  Object.keys(S).forEach(k => { const c = S[k]; if (c.loop === false || /marcha|huir|cargar|avance|camilla|idle|ordenar|catalejo|ondear|saludar|rendirse|manos|cuadro|paracaidas|cavar|melee|cuerpo/.test(k)) return; breathe(c, 0.6); });
  // muertes: los pies se relajan (flexión plantar) al quedar tendido; impacto con temblor breve del tronco
  ['caer_muerto_atras', 'caer_muerto_adelante', 'caer_muerto_costado', 'caer_muerto_rodillas', 'morir_1', 'morir_2', 'srv_caido', 'caer_con_estandarte'].forEach(k => {
    const c = S[k]; if (!c) return;
    const boca = /adelante|morir_2|estandarte/.test(k), pf = boca ? 62 : 14, ev = boca ? 6 : 28;   // boca abajo: empeine al suelo; boca arriba: los pies caen hacia fuera
    c.tracks.pieIz = [[0, 0, 0, 0], [0.55, 6, 0, 0], [0.82, pf * 0.9, 0, ev * 0.8], [1, pf, 0, ev]]; c.tracks.pieDe = [[0, 0, 0, 0], [0.6, 8, 0, 0], [0.86, pf * 0.8, 0, -ev * 0.8], [1, pf * 0.95, 0, -ev]];
    addLayer(c, 'torso', t => { const u = t / 0.12; return t < 0.12 ? [-6 * Math.sin(Math.PI * u), 3 * Math.sin(Math.PI * u), 0] : [0, 0, 0]; }, 60);
    addLayer(c, 'cabeza', t => { const u = (t - 0.04) / 0.16; return u > 0 && u < 1 ? [-10 * Math.sin(Math.PI * u), 0, 4 * Math.sin(Math.PI * u)] : t > 0.72 && t < 0.86 ? [6 * Math.sin(Math.PI * (t - 0.72) / 0.14), 0, 0] : [0, 0, 0]; }, 60);   // latigazo y rebote al tocar el suelo
  });
  // de rodillas / cuerpo a tierra: el pie trasero apoya la punta, los tumbados con el empeine en el suelo
  Object.keys(S).forEach(k => { const c = S[k], mD = c.tracks.musloDe, pD = c.tracks.piernaDe;
    if (/tumba|tumbado/.test(k)) { c.tracks.pieIz = c.tracks.pieIz || [[0, 55, 0, 0]]; c.tracks.pieDe = c.tracks.pieDe || [[0, 55, 0, 0]]; }
    else if (mD && pD && pD.length === 1 && pD[0][1] > 80 && !c.tracks.pieDe) c.tracks.pieDe = [[0, 72, 0, 0]];
  });
})();

/* ---------- caballo ---------- */
// patas: [superior, inferior, desfase (fracción del ciclo en que el casco toca el suelo), delantera?]
const HLEGS = {LF: ['manoIz', 'canaIz', true], RF: ['manoDe', 'canaDe', true], LH: ['pataIz', 'corvIz', false], RH: ['pataDe', 'corvDe', false]};
const HOOF = {LF: ['canaIz', [0, -0.575, 0.05]], RF: ['canaDe', [0, -0.575, 0.05]], LH: ['corvIz', [0, -0.615, 0.04]], RH: ['corvDe', [0, -0.615, 0.04]]};
const AIRES = {   // fase de contacto de cada casco, apoyo (duty), amplitud de la pata (°), flexión de rodilla/corvejón (°)
  paso: {LH: 0, LF: 0.25, RH: 0.5, RF: 0.75, duty: 0.64, A: 15, Ff: 52, Fh: 40, pitch: 1.2, neck: 6, heave: 0},
  trote: {LF: 0, RH: 0, RF: 0.5, LH: 0.5, duty: 0.42, A: 21, Ff: 80, Fh: 55, pitch: 1.5, neck: 2, heave: 0.05},
  galope: {RH: 0, LH: 0.12, RF: 0.36, LF: 0.48, duty: 0.3, A: 30, Ff: 110, Fh: 70, pitch: 5, neck: 9, heave: 0.1},
  galope_largo: {RH: 0, LH: 0.11, RF: 0.33, LF: 0.44, duty: 0.27, A: 34, Ff: 115, Fh: 75, pitch: 5.5, neck: 10, heave: 0.13}
};
function horseLegs(tr, legs, cfg, N, lowerOK) {
  Object.keys(legs).forEach(k => {
    const [up, low, fore] = legs[k], ph = cfg[k], d = cfg.duty, A = cfg.A;
    const ang = t => { const s = (((t - ph) % 1) + 1) % 1;
      if (s < d) { const u = s / d; return {u: A * (-1 + 2 * u), l: fore ? -6 * Math.sin(Math.PI * u) * (u > 0.85 ? -2 : 1) : 8 * Math.sin(Math.PI * u), sw: 0}; }   // apoyo: la pata retrocede bajo el cuerpo
      const u = (s - d) / (1 - d), e = u * u * (3 - 2 * u), lift = Math.pow(Math.sin(Math.PI * Math.min(1, u * 1.15)), 1.3);
      return {u: A * (1 - 2 * e) - (fore ? 8 : 4) * Math.sin(Math.PI * u), l: fore ? cfg.Ff * lift : -cfg.Fh * lift, sw: 1};       // vuelo: la rodilla se dobla y la pata se adelanta
    };
    tr[up] = curve(N, t => [ang(t).u + (fore ? 0 : 4), 0, 0]);
    if (lowerOK && low) tr[low] = curve(N, t => [ang(t).l, 0, 0]);
    else if (!lowerOK) tr[up] = curve(N, t => { const a = ang(t); return [a.u + (fore ? 0.25 : -0.2) * a.l * 0.35, 0, 0]; });   // tiro: pata de una pieza
  });
}
function inStance(cfg, t) { return ['LF', 'RF', 'LH', 'RH'].some(k => ((((t - cfg[k]) % 1) + 1) % 1) < cfg.duty); }
function horseGait(clip, aire, o) {
  o = o || {}; const cfg = AIRES[aire], N = 48, tr = clip.tracks, isG = aire.startsWith('galope');
  horseLegs(tr, HLEGS, cfg, N, true);
  // cuerpo: cabeceo (el tercio anterior sube durante el apoyo de los posteriores), cuello y cabeza en contrafase, cola con retraso
  const fl = cfg.LF;
  tr.caballo = curve(N, t => [isG ? -cfg.pitch * Math.cos(TAU * (t - 0.2)) : cfg.pitch * Math.cos(2 * TAU * (t - fl)), 0, aire === 'paso' ? 1.2 * Math.sin(TAU * t) : 0]);
  tr.cuello = curve(N, t => [isG ? cfg.neck * Math.cos(TAU * (t - 0.35)) - 4 : cfg.neck * Math.cos(2 * TAU * (t - fl)) + (aire === 'trote' ? -4 : 0), aire === 'paso' ? 2 * Math.sin(TAU * t) : 0, 0]);
  tr.testa = curve(N, t => [isG ? -0.5 * cfg.neck * Math.cos(TAU * (t - 0.42)) - 6 : -0.4 * cfg.neck * Math.cos(2 * TAU * (t - fl - 0.06)), 0, 0]);
  tr.cola = curve(N, t => [isG ? 34 + 8 * Math.cos(TAU * (t - 0.5)) : aire === 'trote' ? 14 + 4 * Math.cos(2 * TAU * t) : 6, 0, (isG ? 3 : 7) * Math.sin(TAU * (t - 0.15))]);
  // jinete: absorbe el cabeceo con la cintura y lleva la mano de las riendas con la boca del caballo
  const lean = o.lean != null ? o.lean : isG ? 14 : aire === 'trote' ? 6 : 3, tb = tr.torso, b = [0, 0, 0];
  tr.torso = curve(N, t => { if (o.keepRider) { sampleTrack(tb, t, b, 3); } else { b[0] = lean; b[1] = 0; b[2] = 0; }
    const p = isG ? -cfg.pitch * Math.cos(TAU * (t - 0.28)) : cfg.pitch * Math.cos(2 * TAU * (t - fl - 0.08));
    return [b[0] - 0.7 * p + (aire === 'trote' ? 2 * Math.cos(2 * TAU * (t - 0.1)) : 0), b[1], b[2]]; });
  tr.cabeza = curve(N, t => [isG ? 3 * Math.cos(TAU * (t - 0.3)) - lean * 0.5 : -lean * 0.3, 0, 0]);
  if (!o.keepReins) { tr.brazoIz = curve(N, t => [-28 - (isG ? 6 * Math.cos(TAU * (t - 0.4)) : 0), 0, 6]); tr.antebrazoIz = curve(N, t => [-52 - (isG ? 10 * Math.cos(TAU * (t - 0.4)) : 0), 0, -8]); }
  clip.root = groundRoot('jinete', clip, Object.values(HOOF), N, {stance: t => inStance(cfg, t), lift: cfg.heave});
  if (aire === 'trote') clip.pos = Object.assign(clip.pos || {}, {torso: curve(N, t => [0, -0.025 * Math.max(0, Math.cos(2 * TAU * (t - 0.12))), 0])});   // trote sentado: el jinete acompaña el rebote
  clip.ev = ['LF', 'RF', 'LH', 'RH'].map(k => [cfg[k], 'casco']).filter((e, i, a) => a.findIndex(q => Math.abs(q[0] - e[0]) < 0.02) === i).sort((a, b) => a[0] - b[0]);
}
(function horseV4() {
  const J = CLIPS.jinete;
  horseGait(J.paso, 'paso', {keepRider: true}); horseGait(J.trote, 'trote', {keepRider: true});
  ['galope', 'carga', 'carga_lanza', 'galope_de_mando', 'huida'].forEach(k => J[k] && horseGait(J[k], 'galope', {keepRider: true, keepReins: !!(J[k].tracks.brazoIz && k !== 'galope')}));
  if (J.galope_largo) horseGait(J.galope_largo, 'galope_largo', {keepRider: true, keepReins: !!J.galope_largo.tracks.brazoIz});
  // reposo: cambia el peso de una mano a otra, baja y sube la cabeza, menea la cola, pisotea una vez y respira
  const I = J.idle, n = 1;
  I.tracks.cuello = [[0, 0, 0, 0], [0.18, 14, -6, 0], [0.4, 18, -8, 0], [0.55, 4, 0, 0], [0.7, -6, 8, 0], [0.85, -2, 4, 0], [1, 0, 0, 0]];
  I.tracks.testa = [[0, 0, 0, 0], [0.2, 8, 0, 0], [0.42, 10, 0, 4], [0.56, -4, 0, 0], [0.62, 6, 0, -6], [0.68, -2, 0, 0], [1, 0, 0, 0]];   // sacudida de cabeza
  I.tracks.cola = [[0, 6, 0, 0], [0.3, 8, 0, 0], [0.34, 12, 0, 22], [0.38, 10, 0, -18], [0.43, 8, 0, 10], [0.5, 6, 0, 0], [0.9, 7, 0, -4], [1, 6, 0, 0]];
  I.tracks.manoDe = [[0, 0, 0, 0], [0.74, 0, 0, 0], [0.78, -18, 0, 0], [0.82, 6, 0, 0], [0.86, 0, 0, 0], [1, 0, 0, 0]]; I.tracks.canaDe = [[0, 0, 0, 0], [0.74, 0, 0, 0], [0.78, 60, 0, 0], [0.82, 4, 0, 0], [0.86, 0, 0, 0], [1, 0, 0, 0]];   // pisotón
  I.tracks.pataIz = [[0, 0, 0, 0], [0.45, 0, 0, 0], [0.55, -6, 0, 0], [0.9, -6, 0, 0], [1, 0, 0, 0]]; I.tracks.corvIz = [[0, 0, 0, 0], [0.45, 0, 0, 0], [0.55, -18, 0, 0], [0.9, -18, 0, 0], [1, 0, 0, 0]];   // descansa un posterior
  I.tracks.caballo = curve(24, t => [0.6 * Math.sin(TAU * 3 * t), 0, 1.2 * Math.sin(TAU * t) + (t > 0.45 && t < 0.9 ? 1 : 0)]);
  void n; I.ev = [[0.82, 'casco']];
  I.root = groundRoot('jinete', I, Object.values(HOOF), 40);
  // pose de las riendas (brazo y antebrazo izquierdos) en todos los clips que no la definen
  Object.keys(J).forEach(k => { const c = J[k]; if (!c.tracks.brazoIz) c.tracks.brazoIz = [[0, -28, 0, 6]]; if (!c.tracks.antebrazoIz) c.tracks.antebrazoIz = [[0, -52, 0, -8]];
    if (c.loop !== false && !/galope|carga|huida|trote|paso/.test(k)) breathe(c, 0.7); });
})();
(function teamV4() {
  const Tc = CLIPS.tiro, L = k => ({LF: ['an' + k + 'mi', null, true], RF: ['an' + k + 'md', null, true], LH: ['an' + k + 'pi', null, false], RH: ['an' + k + 'pd', null, false]});
  [['paso', 'paso'], ['trote', 'trote']].forEach(([name, aire]) => {
    const c = Tc[name]; if (!c) return; const cfg = Object.assign({}, AIRES[aire], {A: AIRES[aire].A * 0.9});
    [1, 2].forEach(k => { const c2 = Object.assign({}, cfg); if (k === 2) ['LF', 'RF', 'LH', 'RH'].forEach(q => { c2[q] = (cfg[q] + 0.37) % 1; });   // los dos animales no pisan a la vez
      const tr = {}; horseLegs(tr, L(k), c2, 48, false); Object.assign(c.tracks, tr);
      c.tracks['an' + k + 'cu'] = curve(48, t => [cfg.neck * Math.cos(2 * TAU * (t - c2.LF)) + (aire === 'trote' ? -3 : 0), 0, 0]);
      c.tracks['an' + k + 'te'] = curve(48, t => [-0.4 * cfg.neck * Math.cos(2 * TAU * (t - c2.LF - 0.06)), 0, 0]);
      c.tracks['an' + k] = curve(48, t => [cfg.pitch * Math.cos(2 * TAU * (t - c2.LF)), 0, aire === 'paso' ? Math.sin(TAU * (t - c2.LF)) : 0]); });
  });
  if (Tc.parado) { const c = Tc.parado;
    c.tracks.an1cu = [[0, 0, 0, 0], [0.3, 12, -5, 0], [0.5, 14, -5, 0], [0.7, 2, 4, 0], [1, 0, 0, 0]]; c.tracks.an2cu = [[0, 4, 0, 0], [0.4, -4, 6, 0], [0.6, 0, 3, 0], [0.85, 10, 0, 0], [1, 4, 0, 0]];
    c.tracks.an1te = [[0, 0, 0, 0], [0.55, 0, 0, 0], [0.6, 8, 0, 5], [0.66, -3, 0, -3], [0.7, 0, 0, 0], [1, 0, 0, 0]]; c.tracks.an2te = [[0, 0, 0, 0], [0.2, 6, 0, 0], [0.5, 0, 0, 0], [1, 0, 0, 0]]; }
})();
(function artilleryV4() {
  const K = CLIPS.canon;
  // retroceso de la pieza lisa: las ruedas giran lo que recorre la cureña (0,45 m / r 0,66 m ≈ 39°), la contera salta y vuelve; los sirvientes la devuelven a batería
  const S = K.servicio; if (S) {
    S.root = [[0, 0, 0, 0], [0.61, 0, 0, 0], [0.625, 0, 0.06, -0.2], [0.65, 0, 0.0, -0.42], [0.67, 0, 0.01, -0.45], [0.8, 0, 0, -0.45], [0.95, 0, 0, 0], [1, 0, 0, 0]];
    S.tracks.ruedaIz = S.tracks.ruedaDe = [[0, 0, 0, 0], [0.61, 0, 0, 0], [0.65, -36, 0, 0], [0.67, -39, 0, 0], [0.8, -39, 0, 0], [0.95, 0, 0, 0], [1, 0, 0, 0]];
    S.tracks['cureña'] = [[0, 0, 0, 0], [0.61, 0, 0, 0], [0.625, -5, 0, 0], [0.645, 1.5, 0, 0], [0.665, -0.6, 0, 0], [0.69, 0, 0, 0], [1, 0, 0, 0]];
  }
  [['servicio_rc', 0.61], ['servicio_D', 0.61]].forEach(([k, t0]) => { const c = K[k]; if (!c) return;          // cureña rígida (C) o freno de retroceso (D): solo un estremecimiento
    c.tracks['cureña'] = [[0, 0, 0, 0], [t0, 0, 0, 0], [t0 + 0.012, k === 'servicio_D' ? -1 : -3, 0, 0], [t0 + 0.03, 0.8, 0, 0], [t0 + 0.05, 0, 0, 0], [1, 0, 0, 0]];
    c.root = [[0, 0, 0, 0], [t0, 0, 0, 0], [t0 + 0.015, 0, 0.02, k === 'servicio_D' ? -0.02 : -0.12], [t0 + 0.06, 0, 0, k === 'servicio_D' ? -0.02 : -0.12], [0.9, 0, 0, 0], [1, 0, 0, 0]];
    if (k === 'servicio_rc') c.tracks.ruedaIz = c.tracks.ruedaDe = [[0, 0, 0, 0], [t0, 0, 0, 0], [t0 + 0.015, -10, 0, 0], [0.9, 0, 0, 0], [1, 0, 0, 0]]; });
  if (K.servicio_at) K.servicio_at.tracks.ruedaIz = K.servicio_at.tracks.ruedaDe = [[0, 0, 0, 0], [0.44, 0, 0, 0], [0.48, -6, 0, 0], [0.7, 0, 0, 0], [1, 0, 0, 0]];
  if (K.fuego_mg) addLayer(K.fuego_mg, 'tubo', t => [-0.5 * Math.abs(Math.sin(TAU * 4 * t)), 0.4 * Math.sin(TAU * 2 * t), 0], 32);   // vibración del arma sobre el giro del haz
})();
// Maxim / Vickers (D): el arma no gira; retrocede el cajón con cada disparo y el trípode vibra (antes heredaba el giro del haz de la Gatling)
CLIPS.canon.fuego_maxim = mk(0.5, true, {tubo: curve(32, t => [-0.7 * Math.pow(Math.abs(Math.sin(TAU * 4 * t)), 3), 0.5 * Math.sin(TAU * 2 * t), 0]), 'cureña': curve(16, t => [0.25 * Math.sin(TAU * 4 * t), 0, 0])},
  [[0, 'disparo'], [0.25, 'disparo'], [0.5, 'disparo'], [0.75, 'disparo']], {slide: curve(32, t => [-0.012 * Math.pow(Math.abs(Math.sin(TAU * 4 * t)), 4)]).map(k => [k[0], k[1]])});

/* ================= ÉPOCA E (1937–1945): soldados, motorizados, blindados y artillería ================= */
// Mismo contrato que A–D: rig de partes rígidas, animación horneada, zonas de color. Nuevos: zonas M1–M3 (marca nacional) y VEH2
// (segundo color de camuflaje), esqueletos 'vehiculo', 'semioruga' y 'blindado', y el canal 'pos' (traslación por parte en un clip).
const CE = {goma: 0x262422, cristal: 0x2c3438, lona: 0x7c7656, oscuro: 0x34363a, faro: 0xd8d0b0, cantimplora: 0x4e5040, mascara: 0x5a5e52, proyectil: 0xb08a3a, caja: 0x5a4a30};

/* ---------- naciones (época E) ---------- */
// modelo: qué variante nacional de cada vehículo o arma usa la nación. marca: tipo y colores de la marca nacional (zonas M1–M3).
const E_GER = {c: ['#6b6e58', '#3e4a3c', '#646656', '#5c6052'], toc: 'm35', veh: '#4b5156', veh2: '#4b5156', marca: {tipo: 'balken', c: ['#1a1a1a', '#f0ece2', '#1a1a1a']},
  modelo: {equipo: 'ger', botas: true, lmg: 'mg34', camion: 'blitz', semioruga: 'sdkfz251', tanque_medio: 'pz4', cazacarros: 'stug', canon_at: 'pak36', obus: 'sfh18', tripulante: 'gorro_negro'},
  nota: 'Wehrmacht 1939: guerrera M36 feldgrau con cuello verde botella, casco M35, botas altas, máscara antigás en bote. Vehículos gris panzer (RAL 7021) hasta 1943 y cruz de balcón (Balkenkreuz). Bandera: tricolor negra-blanca-roja sin esvástica (decisión de diseño; aprox.).'};
const E_GBR = {c: ['#8a7a4e', '#7a6c44', '#8a7a4e', '#5e5c40'], toc: 'brodie', veh: '#5d6040', veh2: '#3c4230', marca: {tipo: 'roundel', c: ['#1e3a8a', '#f2f0ea', '#c8102e']},
  modelo: {equipo: 'gbr', botas: false, lmg: 'bren', camion: 'bedford', semioruga: 'm3', tanque_medio: 'crucero', cazacarros: 'generico', canon_at: '2pdr', obus: 'bl6', tripulante: 'boina'},
  nota: 'Battledress 1937 de sarga caqui, casco Brodie Mk II, polainas cortas. Vehículos Khaki Green No. 3 con manchas oscuras. Marca aprox.: escarapela (en 1940–41 se usó la franja blanca-roja-blanca). Semioruga M3 (préstamo y arriendo, 1942+) y cazacarros genérico: aprox.'};
const E_SOV = {c: ['#8a8456', '#b02020', '#7e7a50', '#4f5a32'], toc: 'ssh', veh: '#4f5a32', veh2: '#4f5a32', marca: {tipo: 'estrella', c: ['#c8202a', '#f2f0ea', '#c8202a']},
  modelo: {equipo: 'sov', botas: true, lmg: 'dp', camion: 'zis5', semioruga: 'm3', tanque_medio: 't34', cazacarros: 'su76', canon_at: '53k', obus: 'ml20', tripulante: 'casco_tanquista'},
  nota: 'Gimnastiorka caqui verdoso, casco SSh-36/39, botas; capote enrollado en bandolera. Vehículos verde 4BO y estrella roja (en 1941 muchos sin marca). Semioruga: M3 de préstamo y arriendo (aprox.; el Ejército Rojo apenas tuvo semiorugas propios).'};
NACIONES.GER = {nombre: 'Alemania (Wehrmacht)', bandera: 'horiz', veh: E_GER.veh, f: ['#141414', '#f2f0ea', '#c8202a'], E: E_GER};
NACIONES.SOV = {nombre: 'Unión Soviética', bandera: 'mono', veh: E_SOV.veh, f: ['#c8202a', '#f0c020', '#c8202a'], E: E_SOV};
NACIONES.PRU.E = E_GER; NACIONES.RUS.E = E_SOV; NACIONES.GBR.E = E_GBR;
NACIONES.FRA.E = {c: ['#8a7e56', '#5a5440', '#8a7e56', '#6a6a4c'], toc: 'adrian', veh: '#6a6a44', veh2: '#8a6e48', marca: {tipo: 'roundel', c: ['#1f3f8f', '#f2f0ea', '#c8202a']},
  modelo: {equipo: 'gbr', lmg: 'bren', camion: 'bedford', semioruga: 'm3', tanque_medio: 'somua', cazacarros: 'generico', canon_at: 'pak36', obus: 'sfh18', tripulante: 'casco_tanquista'},
  nota: 'Caqui mostaza (1935) y casco Adrian M26; vehículos con camuflaje de tres tonos (aprox.). Somua S35; resto de modelos aprox. hasta la segunda entrega.'};
NACIONES.USA.E = {c: ['#6e6646', '#5a5436', '#7a6e50', '#5a5a3a'], toc: 'm1', veh: '#4e5234', veh2: '#4e5234', marca: {tipo: 'estrella', c: ['#f2f0ea', '#f2f0ea', '#2a3c78']},
  modelo: {equipo: 'gbr', lmg: 'bren', camion: 'bedford', semioruga: 'm3', tanque_medio: 'crucero', cazacarros: 'generico', canon_at: '2pdr', obus: 'bl6', tripulante: 'casco_tanquista'},
  nota: 'Pardo oliva, casco M1 (1941), polainas de lona; estrella blanca. Modelos propios (Sherman, M3, GMC) en la segunda entrega.'};
NACIONES.ITA.E = {c: ['#7a7c62', '#b02020', '#7a7c62', '#6c6e58'], toc: 'm33', veh: '#8a7e56', veh2: '#6a6a50', marca: {tipo: 'ninguna', c: ['#f2f0ea', '#b02020', '#008c45']}, modelo: {equipo: 'gbr'},
  nota: 'Grigio-verde, casco M33; vehículos caqui sahariano. Sin marca nacional fija (marcas de unidad blancas y rojas): aprox.'};
NACIONES.JPN.E = {c: ['#8a7e4a', '#b8262c', '#8a7e4a', '#7a6e48'], toc: 'gorra_cubrenuca', veh: '#8a7a50', veh2: '#5a5a3a', marca: {tipo: 'sol', c: ['#bc002d', '#f2f0ea', '#bc002d']}, modelo: {equipo: 'gbr'},
  nota: 'Caqui amarillento M98, gorra de campaña con cubrenuca (o casco Tipo 90); tanques ocre con manchas verdes y pardas. Marca aprox.: sol rojo.'};
NACIONES.POL = {nombre: 'Polonia', bandera: 'horiz', veh: '#6a6a44', f: ['#f2f0ea', '#dc143c', '#dc143c'],
  E: {c: ['#7a7450', '#6a6440', '#7a7450', '#6a6a4a'], toc: 'm35', veh: '#6a6a44', veh2: '#8a6e48', marca: {tipo: 'ninguna', c: ['#f2f0ea', '#dc143c', '#f2f0ea']}, modelo: {equipo: 'gbr', botas: true},
    nota: 'Caqui wz.36 y casco wz.31 (aprox.: forma de M35); vehículos con camuflaje de tres tonos. El águila de la gorra no se ve a esta escala: sin marca.'}};
// variantes que solo cambian el color principal o la marca (reutilizan malla, modelos y animaciones)
const E_DERIV = {CAN: ['Canadá', E_GBR, {}], AUS: ['Australia', E_GBR, {c: ['#8a7650', '#7a6c44', '#8a7650', '#5e5c40'], toc: 'sombrero'}], SAF: ['Sudáfrica', E_GBR, {c: ['#9a8a5a', '#7a6c44', '#9a8a5a', '#5e5c40']}],
  HUN: ['Hungría', E_GER, {c: ['#7a6a48', '#5a5038', '#7a6a48', '#6a6450'], marca: {tipo: 'balken', c: ['#f2f0ea', '#1a1a1a', '#f2f0ea']}}], ROU: ['Rumanía', E_GER, {c: ['#7a7450', '#6a6440', '#7a7450', '#6a6a4a'], marca: {tipo: 'roundel', c: ['#002b7f', '#fcd116', '#ce1126']}}],
  YUG: ['Yugoslavia', E_GER, {c: ['#6a6a52', '#5a5a44', '#6a6a52', '#5e6050'], toc: 'adrian', marca: {tipo: 'roundel', c: ['#c8202a', '#1f3f8f', '#f2f0ea']}}],
  FIN: ['Finlandia', E_GER, {c: ['#7a7c74', '#5a5c54', '#7a7c74', '#5c6052'], marca: {tipo: 'ninguna', c: ['#f2f0ea', '#1f3f8f', '#f2f0ea']}}], TUR: ['Turquía', E_GER, {c: ['#7c7448', '#6a6440', '#7c7448', '#6a6a4a'], marca: {tipo: 'ninguna', c: ['#c81e2a', '#f2f0ea', '#c81e2a']}}],
  CHN: ['China (República)', E_GER, {c: ['#6a7480', '#5a6470', '#6a7480', '#5c6052'], marca: {tipo: 'sol', c: ['#1f3f8f', '#f2f0ea', '#1f3f8f']}}], GEN: ['Genérico / neutrales', E_GER, {c: ['#6a6448', '#5a5440', '#646046', '#5e5c46'], marca: {tipo: 'ninguna', c: ['#f2f0ea', '#1a1a1a', '#f2f0ea']}}]};
Object.keys(E_DERIV).forEach(tag => {
  const [nombre, base, over] = E_DERIV[tag], e = Object.assign({}, base, {modelo: Object.assign({}, base.modelo)}, over, {nota: (over.nota || 'Variante: reutiliza la malla y los modelos de ' + (base === E_GBR ? 'Reino Unido' : 'Alemania') + '; solo cambia el color principal' + (over.marca ? ' y la marca' : '') + ' (aprox.).')});
  if (!NACIONES[tag]) NACIONES[tag] = {nombre, bandera: 'horiz', veh: e.veh, f: ['#6a6448', '#e8e0c8', '#2a4a7a']};
  NACIONES[tag].E = e;
});
NACIONES.FIN.f = ['#f2f0ea', '#1f3f8f', '#f2f0ea']; NACIONES.FIN.bandera = 'cruz'; NACIONES.CAN.f = ['#c8102e', '#f2f0ea', '#c8102e']; NACIONES.AUS.f = ['#1a2a6a', '#f2f0ea', '#c8102e']; NACIONES.HUN.f = ['#ce2939', '#f2f0ea', '#477050'];
NACIONES.ROU.f = ['#002b7f', '#fcd116', '#ce1126']; NACIONES.ROU.bandera = 'vert'; NACIONES.YUG.f = ['#1f3f8f', '#f2f0ea', '#c8202a']; NACIONES.SAF.f = ['#e07020', '#f2f0ea', '#1f3f8f'];
const ED = nat => uniformPalette(nat, 'E');
const md = (nat, k, def) => (ED(nat).modelo || {})[k] || def;

/* ---------- marca nacional (calcomanía en un plano) ---------- */
// tipo: balken (cruz de balcón), roundel (escarapela), estrella, sol, ninguna. Se dibuja en el plano local XY mirando a +Z y se gira con yaw.
function nationalMark(g, part, tipo, at, yaw, s) {
  if (!tipo || tipo === 'ninguna') return;
  const P = (x, y, z) => xf([[x, y, z]], at, [0, yaw, 0])[0];
  const Q = (x0, y0, x1, y1, zone, z) => g.quad(P(x0, y0, z), P(x1, y0, z), P(x1, y1, z), P(x0, y1, z), part, zone, 0);
  const D = (r, n, zone, z) => { const c = P(0, 0, z); for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, b = (i + 1) / n * Math.PI * 2; g.tri(c, P(Math.cos(a) * r, Math.sin(a) * r, z), P(Math.cos(b) * r, Math.sin(b) * r, z), part, zone, 0); } };
  const ST = (r, zone, z) => { const c = P(0, 0, z); for (let i = 0; i < 10; i++) { const a = Math.PI / 2 + i / 10 * Math.PI * 2, b = Math.PI / 2 + (i + 1) / 10 * Math.PI * 2, ra = i % 2 ? r * 0.42 : r, rb = i % 2 ? r : r * 0.42; g.tri(c, P(Math.cos(a) * ra, Math.sin(a) * ra, z), P(Math.cos(b) * rb, Math.sin(b) * rb, z), part, zone, 0); } };
  if (tipo === 'balken') { Q(-s, -s * 0.34, s, s * 0.34, Z.M2, 0); Q(-s * 0.34, -s, s * 0.34, s, Z.M2, 0); Q(-s * 0.82, -s * 0.16, s * 0.82, s * 0.16, Z.M1, 0.006); Q(-s * 0.16, -s * 0.82, s * 0.16, s * 0.82, Z.M1, 0.006); }
  else if (tipo === 'roundel') { D(s, 6, Z.M1, 0); D(s * 0.66, 6, Z.M2, 0.005); D(s * 0.33, 6, Z.M3, 0.01); }
  else if (tipo === 'estrella') ST(s, Z.M1, 0);
  else if (tipo === 'sol') D(s * 0.8, 8, Z.M1, 0);
}

/* ---------- soldado E: equipo, cascos, armas ---------- */
function eKit(g, P, o) {   // v4: correaje de 1939–45 por escuela (fuentes: manuales de equipo Wehrmacht 1939, British Pattern 1937, RKKA 1936; M1910/M1923 EE. UU.)
  const st = o.equipo || 'gbr', F = Z.FIX, T = P.torso, web = st === 'ger' ? 0x2e2620 : st === 'sov' ? 0x5a4a32 : st === 'usa' ? 0x8a8058 : 0x9a9068;
  const can = () => { g.loft(T, F, CE.cantimplora, [[-0.08, 0.05, 0.035], [0.0, 0.06, 0.04], [0.08, 0.05, 0.035]], 6, {at: [-0.19, -0.06, -0.07], capA: true, capB: true, p: 2.4}); g.loft(T, F, 0x3a3428, [[0.075, 0.045, 0.03], [0.1, 0.04, 0.026]], 6, {at: [-0.19, -0.06, -0.07], capB: true}); };
  if (o.kitLigero) { can(); g.loft(T, F, web, [[0.0, 0.172, 0.112], [0.05, 0.174, 0.114]], 8, {p: 3, flatN: true}); return; }
  const strapsY = (w, front) => [1, -1].forEach(s => { g.strap(T, F, web, [[0.09 * s, 0.03, 0.124], [0.11 * s, 0.25, 0.13], [0.12 * s, 0.44, 0.08], [0.1 * s, 0.47, -0.04], front ? [0.08 * s, 0.3, -0.12] : [0.02, 0.25, -0.12]], w, [0, 0, 1]); });
  if (st === 'ger') {
    strapsY(0.03); [1, -1].forEach(s => [0.06, 0.12].forEach(x => g.box(T, F, 0x2e2620, [s * (x + 0.0), 0.0, 0.135], [0.055, 0.085, 0.045], {bottom: true, rot: [-6, 0, 0]})));   // 2×3 cartucheras K98
    g.loft(T, F, CE.mascara, [[-0.13, 0.055, 0.055], [-0.09, 0.06, 0.06], [0.12, 0.06, 0.06], [0.14, 0.05, 0.05]], 8, {axis: 'y', at: [0.08, -0.05, -0.16], rot: [0, 0, 10], capA: true, capB: true});   // portacaretas acanalado
    g.box(T, F, 0x6a6448, [-0.15, -0.08, -0.1], [0.07, 0.17, 0.2], {bottom: true});                                         // bolsa de pan
    g.box(T, F, 0x3a3c38, [0.19, -0.14, -0.06], [0.03, 0.2, 0.13], {rot: [0, 0, 6]}); g.tube(T, F, 0x6a5038, [0.19, -0.05, -0.06], [0.19, 0.15, -0.06], [[0, 0.016], [1, 0.016]], 4);   // pala
    can();
  } else if (st === 'sov') {
    { const pts = []; for (let i = 0; i <= 10; i++) { const a = i / 10 * Math.PI * 2; pts.push(xf([[Math.cos(a) * 0.235, 0, Math.sin(a) * 0.17]], [0, 0.25, 0], [0, 0, -42])[0]); }   // capote enrollado en bandolera (skatka)
      for (let i = 0; i < 10; i++) g.tube(T, F, 0x6a6650, pts[i], pts[i + 1], [[0, 0.055], [1, 0.055]], 6); }
    [1, -1].forEach(s => g.box(T, F, web, [0.1 * s, 0.0, 0.135], [0.08, 0.08, 0.045], {bottom: true}));
    g.box(T, F, 0x6a6448, [-0.16, -0.08, -0.1], [0.08, 0.17, 0.18], {bottom: true}); can();
  } else if (st === 'usa') {
    g.loft(T, F, web, [[-0.02, 0.18, 0.122], [0.05, 0.182, 0.124]], 8, {p: 3, flatN: true});                                  // cinto de cartuchos con bolsillos
    for (let i = 0; i < 5; i++) { const a = -0.9 + i * 0.45; g.box(T, F, web, [Math.sin(a) * 0.17, 0.0, Math.cos(a) * 0.12 + 0.012], [0.05, 0.075, 0.03], {rot: [0, a / D2R, 0], bottom: true}); }
    strapsY(0.03, true); g.box(T, F, web, [0, 0.3, -0.16], [0.24, 0.26, 0.09], {bottom: true}); can();                         // mochila de combate
  } else {
    strapsY(0.045, true); [1, -1].forEach(s => g.box(T, F, web, [0.1 * s, 0.24, 0.155], [0.12, 0.16, 0.07], {bottom: true, rot: [-4, 0, 0]}));   // cartucheras P37 al pecho
    g.loft(T, F, web, [[0.0, 0.172, 0.114], [0.06, 0.174, 0.116]], 8, {p: 3, flatN: true});
    g.box(T, F, web, [0, 0.3, -0.17], [0.28, 0.24, 0.11], {bottom: true}); g.box(T, F, 0x7a7050, [0, 0.43, -0.2], [0.29, 0.03, 0.12]);   // mochila pequeña
    can();
  }
}
function headgearE(g, h, toc, o) {
  const H = Z.HAT;
  if (o && o.lite && /^(m35|ssh|m1|m33)$/.test(toc)) { g.cyl(h, H, 0, [0, 0.29, 0], toc === 'ssh' ? 0.19 : 0.168, 0.12, 0.16, 6, {top: true, dome: 0.05}); return; }
  switch (toc) {
    case 'm35': g.cyl(h, H, 0, [0, 0.3, 0], 0.152, 0.13, 0.13, 6, {top: true, dome: 0.05}); g.cyl(h, H, 0, [0, 0.215, -0.012], 0.172, 0.152, 0.05, 6); break;
    case 'ssh': g.cyl(h, H, 0, [0, 0.31, 0], 0.148, 0.12, 0.14, 6, {top: true, dome: 0.05}); g.cyl(h, H, 0, [0, 0.235, 0], 0.2, 0.148, 0.03, 6); break;
    case 'm1': g.cyl(h, H, 0, [0, 0.31, 0], 0.16, 0.13, 0.14, 6, {top: true, dome: 0.05}); g.cyl(h, H, 0, [0, 0.235, 0.0], 0.185, 0.16, 0.02, 6); break;
    case 'm33': g.cyl(h, H, 0, [0, 0.31, 0], 0.15, 0.125, 0.14, 6, {top: true, dome: 0.05}); g.cyl(h, H, 0, [0, 0.235, 0], 0.175, 0.15, 0.025, 6); break;
    case 'gorra_cubrenuca': g.cyl(h, H, 0, [0, 0.3, 0], 0.13, 0.135, 0.1, 6, {top: true}); visor(g, h, 0.255, 0.13);
      g.quad([-0.13, 0.26, -0.06], [-0.13, 0.08, -0.1], [-0.13, 0.08, 0.06], [-0.13, 0.26, 0.06], h, H, 0); g.quad([0.13, 0.26, 0.06], [0.13, 0.08, 0.06], [0.13, 0.08, -0.1], [0.13, 0.26, -0.06], h, H, 0); g.quad([0.12, 0.26, -0.12], [0.12, 0.06, -0.15], [-0.12, 0.06, -0.15], [-0.12, 0.26, -0.12], h, H, 0); break;
    case 'gorro_negro': g.box(h, Z.FIX, 0x1e1e20, [0, 0.29, 0], [0.24, 0.08, 0.27], {taper: 0.4, taperZ: 0.1}); break;
    case 'boina': g.cyl(h, Z.FIX, 0x1e1e20, [0.02, 0.29, 0], 0.15, 0.13, 0.06, 6, {top: true, rot: [0, 0, -12]}); break;
    case 'casco_tanquista': g.cyl(h, Z.FIX, 0x2e2c28, [0, 0.27, 0], 0.15, 0.13, 0.13, 6, {top: true, dome: 0.04}); break;
  }
}
// ametralladoras ligeras (pivote en la culata, +Y hacia la boca; −Z es «arriba» al apuntar)
function weaponE(g, a, w, o) {
  if (w !== 'lmg') return;
  const m = o.lmg || 'bren', D = 0x2a2a2a;
  g.box(a, Z.FIX, m === 'dp' || m === 'bren' ? C.madera : D, [0, 0.16, 0.0], [0.05, 0.32, 0.1], {taper: 0.2, noTop: true});              // culata (8)
  g.box(a, Z.FIX, D, [0, 0.52, -0.01], [0.06, 0.42, 0.08], {noTop: true});                                                               // cajón de mecanismos (8)
  g.cyl(a, Z.FIX, m === 'mg34' ? 0x3a3a3a : D, [0, 0.98, -0.01], 0.028, 0.024, 0.52, 3);                                                   // cañón / camisa (6)
  [1, -1].forEach(s => g.cyl(a, Z.FIX, D, [0.05 * s, 1.0, 0.12], 0.012, 0.012, 0.3, 3, {rot: [80, 0, 14 * s]}));                         // bípode (12)
  if (m === 'bren') g.box(a, Z.FIX, D, [0, 0.6, -0.12], [0.04, 0.16, 0.14], {rot: [-25, 0, 0], noTop: true});                             // cargador curvo superior (8)
  else if (m === 'dp') g.cyl(a, Z.FIX, D, [0, 0.55, -0.075], 0.13, 0.13, 0.03, 5, {rot: [90, 0, 0], top: true});                          // tambor plano (15)
  else g.quad([0.035, 0.5, 0.04], [0.035, 0.4, 0.04], [0.12, 0.3, 0.2], [0.12, 0.42, 0.2], a, Z.FIX, C.laton);                             // cinta (MG34)
}
WEAPON_LOD.lmg = 1.24;

/* ---------- piezas reutilizables de vehículos ---------- */
// rueda con neumático (banda y flancos redondeados), llanta de disco y cubo — v4
const whl = (g, part, r, w, at) => { at = at || [0, 0, 0]; const h = w / 2, o = {axis: 'x', at, n: 12};
  g.loft(part, Z.FIX, CE.goma, [[-h, r * 0.7, r * 0.7], [-h * 0.8, r * 0.95, r * 0.95], [0, r, r], [h * 0.8, r * 0.95, r * 0.95], [h, r * 0.7, r * 0.7]], 12, {axis: 'x', at});
  [1, -1].forEach(s => { g.loft(part, Z.VEH, 0, [[h * s * 0.98, r * 0.7, r * 0.7], [h * s * 0.55, r * 0.15, r * 0.15]], 10, {axis: 'x', at, inside: true, nrm: [s, 0, 0]});
    g.loft(part, Z.FIX, CE.oscuro, [[h * s * 0.55, r * 0.14, r * 0.14], [h * s * 1.02, r * 0.09, r * 0.09]], 6, {axis: 'x', at, capB: true}); }); void o; };
// soldado sentado (busto): 8 + 10 + 15 triángulos
function seated(g, part, at, yaw, toc) {   // v4: busto modelado con cabeza, cara y casco nacional
  const t = new GeoBuilder(), r = [0, yaw || 0, 0];
  t.loft(part, Z.MAIN, 0, [[0.0, 0.16, 0.1], [0.25, 0.17, 0.11, 0, 0.01], [0.42, 0.165, 0.1], [0.5, 0.1, 0.07], [0.53, 0.05, 0.05]], 8, {capB: true, p: 3});
  [1, -1].forEach(s => { t.tube(part, Z.MAIN, 0, [0.19 * s, 0.44, 0], [0.21 * s, 0.2, 0.1], [[0, 0.055], [1, 0.045]], 6); t.tube(part, Z.MAIN, 0, [0.21 * s, 0.2, 0.1], [0.1 * s, 0.17, 0.33], [[0, 0.045], [1, 0.04]], 6, {capB: true}); });
  // la cabeza se construye en y 0–0,3: se sube al cuello del busto
  const head = new GeoBuilder(); soldierHead(head, part, {toc: toc || 'm35'});
  const body = t;
  for (let i = 0; i < head.p.length; i += 3) head.p[i + 1] += 0.53;
  [body, head].forEach(src => { const pp = xf(Array.from({length: src.p.length / 3}, (_, i) => [src.p[i * 3], src.p[i * 3 + 1], src.p[i * 3 + 2]]), at, r), nn = xf(Array.from({length: src.n.length / 3}, (_, i) => [src.n[i * 3], src.n[i * 3 + 1], src.n[i * 3 + 2]]), [0, 0, 0], r);
    pp.forEach(q => g.p.push(q[0], q[1], q[2])); nn.forEach(q => g.n.push(q[0], q[1], q[2])); ['part', 'zone', 'col', 'vr', 'fx'].forEach(k => { for (let i = 0; i < src[k].length; i++) g[k].push(src[k][i]); }); });
}
// tripulante asomado por la escotilla
function crewman(g, part, hat, dy) {
  dy = dy || 0; const g2 = new GeoBuilder();
  g2.loft(part, Z.MAIN, 0, [[-0.5, 0.16, 0.1], [-0.2, 0.17, 0.11, 0, 0.01], [-0.06, 0.165, 0.1], [0.0, 0.1, 0.07], [0.03, 0.05, 0.05]], 8, {capB: true, p: 3});
  [1, -1].forEach(s => g2.tube(part, Z.MAIN, 0, [0.19 * s, -0.06, 0], [0.24 * s, -0.3, 0.06], [[0, 0.055], [1, 0.05]], 6));
  const hd = new GeoBuilder(); soldierHead(hd, part, {toc: hat || 'casco_tanquista'}); 
  ['p', 'n', 'part', 'zone', 'col', 'vr', 'fx'].forEach(k => { for (let i = 0; i < hd[k].length; i++) g2[k].push(hd[k][i]); });
  for (let i = 0; i < g2.p.length; i += 3) g2.p[i + 1] += dy;
  ['p', 'n', 'part', 'zone', 'col', 'vr', 'fx'].forEach(k => { for (let i = 0; i < g2[k].length; i++) g[k].push(g2[k][i]); });      // cabeza a la altura estándar (y 0–0,25) para reutilizar los tocados
}
function decalCamo(g, part, at, yaw, w, h) {                          // mancha de camuflaje (zona VEH2; invisible si VEH2 = VEH)
  const P = (x, y) => xf([[x, y, 0]], at, [0, yaw, 0])[0];
  g.tri(P(-w, -h * 0.4), P(w * 0.7, -h), P(w, h * 0.3), part, Z.VEH2, 0); g.tri(P(-w, -h * 0.4), P(w, h * 0.3), P(-w * 0.4, h), part, Z.VEH2, 0);
}

/* ---------- esqueletos ---------- */
RIGS.vehiculo = [['chasis', -1, [0, 0, 0]], ['caja', 0, [0, 0, 0]], ['ruedaDI', 0, [0.86, 0.45, 2.05]], ['ruedaDD', 0, [-0.86, 0.45, 2.05]], ['ruedaTI', 0, [0.86, 0.45, -1.6]], ['ruedaTD', 0, [-0.86, 0.45, -1.6]],
  ['ruedaT2I', 0, [0.86, 0.45, -2.6]], ['ruedaT2D', 0, [-0.86, 0.45, -2.6]], ['tropas', 1, [0, 0, 0]]];
RIGS.semioruga = [['casco', -1, [0, 0, 0]], ['ruedaI', 0, [0.82, 0.42, 2.05]], ['ruedaD', 0, [-0.82, 0.42, 2.05]], ['orugaI', 0, [0.82, 0, 0]], ['orugaD', 0, [-0.82, 0, 0]], ['tropas', 0, [0, 0, 0]], ['mg', 0, [0, 1.95, 1.0]]];
RIGS.blindado = [['casco', -1, [0, 0, 0]], ['torreta', 0, [0, 1.6, 0]], ['canon', 1, [0, 0.62, 1.0]], ['mg', 0, [-0.45, 1.5, 2.3]], ['comandante', 1, [0, 1.15, -0.55]], ['orugaI', 0, [1.15, 0, 0]], ['orugaD', 0, [-1.15, 0, 0]]];

/* ---------- camión con tropas ---------- */
const TRUCK = {blitz: {hood: [1.12, 0.78, 1.3], hz: 2.25, taper: 0.14, cab: [1.95, 1.05, 1.2], six: false}, bedford: {hood: [1.22, 0.82, 1.25], hz: 2.28, taper: 0.02, cab: [2.0, 1.0, 1.2], six: false},
  zis5: {hood: [1.0, 0.76, 1.55], hz: 2.15, taper: 0.2, cab: [1.9, 1.05, 1.15], six: false}, gmc: {hood: [1.15, 0.85, 1.3], hz: 2.25, taper: 0.08, cab: [2.0, 1.0, 1.2], six: true}};
function buildTruck(o) {
  const g = new GeoBuilder(), P = rigIndex('vehiculo'), M = TRUCK[o.modelo] || TRUCK.blitz, VZ = Z.VEH, ch = P.caja;
  g.box(ch, Z.FIX, CE.oscuro, [0, 0.74, -0.2], [0.95, 0.18, 6.0], {noTop: true});                                      // largueros
  g.box(ch, VZ, 0, [0, 0.95 + M.hood[1] / 2, M.hz], M.hood, {taper: M.taper, taperZ: 0.04});                             // capó
  g.quad([-M.hood[0] / 2 + 0.05, 1.0, M.hz + M.hood[2] / 2 + 0.01], [M.hood[0] / 2 - 0.05, 1.0, M.hz + M.hood[2] / 2 + 0.01], [M.hood[0] / 2 - 0.08, 1.65, M.hz + M.hood[2] / 2 + 0.01], [-M.hood[0] / 2 + 0.08, 1.65, M.hz + M.hood[2] / 2 + 0.01], ch, Z.FIX, CE.oscuro);   // calandra
  [1, -1].forEach(s => { g.box(ch, VZ, 0, [0.82 * s, 1.0, 2.05], [0.42, 0.08, 1.1], {rot: [0, 0, 0], taperZ: 0.2}); g.tet(ch, Z.FIX, CE.faro, [0.55 * s, 1.25, M.hz + M.hood[2] / 2 + 0.04], 0.07); });
  const cz = M.hz - M.hood[2] / 2 - M.cab[2] / 2;
  g.box(ch, VZ, 0, [0, 1.1 + M.cab[1] / 2, cz], M.cab, {taperZ: 0.05});                                                 // cabina
  g.quad([-0.8, 1.72, cz + M.cab[2] / 2 + 0.01], [0.8, 1.72, cz + M.cab[2] / 2 + 0.01], [0.78, 2.05, cz + M.cab[2] / 2 - 0.02], [-0.78, 2.05, cz + M.cab[2] / 2 - 0.02], ch, Z.FIX, CE.cristal);
  [1, -1].forEach(s => g.quad([s * (M.cab[0] / 2 + 0.01), 1.72, cz - 0.4 * s], [s * (M.cab[0] / 2 + 0.01), 1.72, cz + 0.4 * s], [s * (M.cab[0] / 2 + 0.01), 2.02, cz + 0.4 * s], [s * (M.cab[0] / 2 + 0.01), 2.02, cz - 0.4 * s], ch, Z.FIX, CE.cristal));
  [1, -1].forEach(s => nationalMark(g, ch, o.marca, [s * (M.cab[0] / 2 + 0.02), 1.42, cz], s * 90, 0.17));
  const bz0 = cz - M.cab[2] / 2 - 0.08, bl = 3.6, bz = bz0 - bl / 2;
  g.box(ch, VZ, 0, [0, 1.25, bz], [2.2, 0.82, bl], {noTop: true});                                                       // caja de carga
  g.quad([-1.08, 1.13, bz0], [1.08, 1.13, bz0], [1.08, 1.13, bz0 - bl], [-1.08, 1.13, bz0 - bl], ch, Z.FIX, C.madera);   // suelo
  decalCamo(g, ch, [1.11, 1.38, bz - 0.4], 90, 0.6, 0.22); decalCamo(g, ch, [-1.11, 1.38, bz + 0.4], -90, 0.6, 0.22);
  g.box(ch, Z.FIX, CE.lona, [0, 2.15, bz0 - 0.85], [2.24, 1.0, 1.7], {});                                                // lona plegada sobre la mitad delantera
  [[-0.3, 0.75, -90], [-0.9, 0.75, -90], [-1.5, 0.75, -90], [-0.3, -0.75, 90], [-0.9, -0.75, 90], [-1.5, -0.75, 90]].forEach(([dz, x, y]) => seated(g, P.tropas, [x, 1.15, bz0 - 1.75 + dz], y, o.toc));
  whl(g, P.ruedaDI, 0.45, 0.24); whl(g, P.ruedaDD, 0.45, 0.24); whl(g, P.ruedaTI, 0.45, M.six ? 0.24 : 0.4); whl(g, P.ruedaTD, 0.45, M.six ? 0.24 : 0.4);
  if (M.six) { whl(g, P.ruedaT2I, 0.45, 0.24); whl(g, P.ruedaT2D, 0.45, 0.24); }
  return g;
}

/* ---------- semioruga blindado ---------- */
function buildHalftrack(o) {
  const g = new GeoBuilder(), P = rigIndex('semioruga'), VZ = Z.VEH, m = o.modelo === 'm3' ? 'm3' : 'sdkfz251', c = P.casco;
  if (m === 'sdkfz251') {
    g.box(c, VZ, 0, [0, 1.1, 2.05], [1.5, 1.0, 1.7], {taper: 0.3, taperZ: 0.15, bottom: true});                                      // morro del motor en cuña
    g.box(c, VZ, 0, [0, 1.25, -0.6], [2.0, 1.26, 3.7], {noTop: true, taper: 0.1});                                       // compartimento de tropa (costados inclinados)
    g.box(c, VZ, 0, [0, 1.95, 0.95], [1.9, 0.22, 0.5], {rot: [-30, 0, 0]});                                              // placa del conductor
  } else {
    g.box(c, VZ, 0, [0, 1.1, 2.15], [1.3, 1.05, 1.6], {bottom: true}); g.cyl(c, Z.FIX, CE.oscuro, [0, 0.7, 3.05], 0.17, 0.17, 1.2, 5, {rot: [0, 0, 90], top: true, bottom: true});   // capó y rodillo delantero
    g.box(c, VZ, 0, [0, 1.25, -0.55], [2.0, 1.3, 3.8], {noTop: true});
    g.box(c, VZ, 0, [0, 1.85, 1.15], [2.0, 0.35, 0.12], {rot: [-10, 0, 0]});                                             // parabrisas blindado
  }
  g.quad([-0.98, 0.95, 1.2], [0.98, 0.95, 1.2], [0.98, 0.95, -2.45], [-0.98, 0.95, -2.45], c, Z.FIX, CE.oscuro);
  [1, -1].forEach(s => { g.box(c, VZ, 0, [0.82 * s, 0.98, 2.05], [0.4, 0.06, 1.0], {}); nationalMark(g, c, o.marca, [s * 1.01, 1.45, -0.6], s * 90, 0.24); decalCamo(g, c, [s * 1.01, 1.4, 0.4], s * 90, 0.5, 0.2); });
  const prof = [[0.75, 0.55], [0.45, 0.08], [-2.05, 0.08], [-2.4, 0.45], [-2.1, 0.8], [0.5, 0.8]];
  ['orugaI', 'orugaD'].forEach((k, i) => { trackLoop(g, P[k], prof, 0.32, 0, Z.FIX, i ? -1 : 1, 0x45463f); [0.15, -0.55, -1.25, -1.95].forEach(z => g.disc(P[k], Z.FIX, 0x40423c, [(i ? -1 : 1) * 0.17, 0.4, z], 0.3, 6, {rot: [0, i ? 180 : 0, 0]})); });
  whl(g, P.ruedaI, 0.42, 0.2); whl(g, P.ruedaD, 0.42, 0.2);
  g.box(P.mg, VZ, 0, [0, 0.0, 0.05], [0.55, 0.42, 0.03]); g.cyl(P.mg, Z.FIX, 0x2a2a2a, [0, 0.05, 0.35], 0.03, 0.025, 0.8, 4, {rot: [90, 0, 0]});
  [[-0.2, 0.55], [-0.95, 0.55], [-1.7, 0.55], [-0.2, -0.55], [-0.95, -0.55], [-1.7, -0.55]].forEach(([z, x]) => seated(g, P.tropas, [x, 1.05, z], x > 0 ? -90 : 90, o.toc));
  return g;
}

/* ---------- tanque medio y cazacarros ---------- */
// orugas (bandas animadas por el shader), ruedas de rodaje como discos en la cara exterior
function tankRunning(g, P, prof, w, wheels, wr, sprocket) {
  ['orugaI', 'orugaD'].forEach((k, i) => {
    const s = i ? -1 : 1; trackLoop(g, P[k], prof, w, 0, Z.FIX, s, 0x45463f);
    const yb = Math.min(...prof.map(q => q[1])) + wr - 0.03;
    wheels.forEach(z => { const x = s * (w / 2 + 0.02);   // v4: rueda de rodaje con banda de goma, disco y tapacubos
      g.loft(P[k], Z.FIX, CE.goma, [[x - 0.06 * s, wr, wr], [x, wr, wr]], 10, {axis: 'x', at: [0, yb, z]});
      g.loft(P[k], Z.FIX, CE.goma, [[x, wr, wr], [x + 0.0005 * s, wr * 0.8, wr * 0.8]], 10, {axis: 'x', at: [0, yb, z], nrm: [s, 0, 0]});
      g.loft(P[k], Z.VEH, 0, [[x + 0.0005 * s, wr * 0.8, wr * 0.8], [x + 0.03 * s, wr * 0.3, wr * 0.3]], 10, {axis: 'x', at: [0, yb, z], capB: true, nrm: [s, 0, 0]}); });
    if (sprocket) sprocket.forEach(([z, y, r]) => g.disc(P[k], Z.FIX, 0x34363a, [s * (w / 2 + 0.01), y, z], r, 6, {rot: [0, i ? 180 : 0, 0]}));
  });
}
function buildMediumTank(o) {
  const g = new GeoBuilder(), P = rigIndex('blindado'), VZ = Z.VEH, m = o.modelo || 'pz4', c = P.casco, t = P.torreta, gn = P.canon;
  let hw = 1.33; const marks = (y, z, s, onTurret) => [1, -1].forEach(k => nationalMark(g, onTurret ? t : c, o.marca, onTurret ? [k * onTurret, y, z] : [k * hw, y, z], k * 90, s));
  if (m === 't34') {
    g.box(c, VZ, 0, [0, 0.8, -0.35], [2.0, 0.75, 5.9], {taperZ: 0.06});
    g.box(c, VZ, 0, [0, 1.48, -0.6], [3.0, 0.62, 4.6], {taper: 0.22, taperZ: 0.05});                                     // costados inclinados
    g.box(c, VZ, 0, [0, 1.2, 2.25], [2.6, 0.12, 1.7], {rot: [-30, 0, 0], noTop: false});                                 // glacis largo
    g.cyl(t, VZ, 0, [0, 0.42, -0.1], 0.98, 0.78, 0.62, 6, {top: true, dome: 0.05, sz: 1.15});
    g.box(gn, VZ, 0, [0, 0.0, 0.0], [0.55, 0.32, 0.3]); g.cyl(gn, VZ, 0, [0, 0, 1.3], 0.07, 0.06, 2.5, 6, {rot: [90, 0, 0], top: true});
    g.cyl(c, Z.FIX, CE.oscuro, [-0.5, 1.3, 2.75], 0.06, 0.05, 0.25, 4, {rot: [60, 0, 0]});
    tankRunning(g, P, [[2.95, 0.88], [2.65, 0.1], [-2.75, 0.1], [-3.05, 0.6], [-2.8, 0.88], [2.7, 0.92]], 0.5, [2.0, 1.0, 0.0, -1.0, -2.0], 0.41, [[2.75, 0.55, 0.32], [-2.75, 0.55, 0.25]]);
    marks(0.45, -0.1, 0.22, 0.99);
  } else if (m === 'crucero' || m === 'somua') {
    g.box(c, VZ, 0, [0, 0.95, -0.2], [2.0, 0.9, 5.8], {});
    g.box(c, VZ, 0, [0, 1.58, -0.3], [2.5, 0.4, 3.8], {taperZ: 0.1});
    g.box(c, VZ, 0, [0, 1.28, 2.55], [2.0, 0.6, 0.6], {rot: [-35, 0, 0]});
    if (m === 'somua') g.cyl(t, VZ, 0, [0, 0.48, -0.05], 0.8, 0.68, 0.72, 6, {top: true, dome: 0.08, sz: 1.2}); else g.box(t, VZ, 0, [0, 0.5, -0.05], [1.75, 0.66, 2.0], {taper: 0.28, taperZ: 0.25});
    g.box(gn, VZ, 0, [0, -0.1, 0.0], [0.5, 0.36, 0.22]); g.cyl(gn, VZ, 0, [0, -0.1, 0.95], 0.045, 0.04, 1.8, 6, {rot: [90, 0, 0], top: true});
    tankRunning(g, P, [[2.95, 1.12], [2.7, 0.12], [-2.75, 0.12], [-3.05, 0.65], [-2.85, 1.12], [2.75, 1.15]], 0.42, m === 'somua' ? [1.6, 0.8, 0.0, -0.8, -1.6] : [2.0, 0.65, -0.7, -2.05], m === 'somua' ? 0.3 : 0.46, [[2.8, 0.72, 0.3], [-2.75, 0.62, 0.25]]);
    [1, -1].forEach(s => g.box(P[s > 0 ? 'orugaI' : 'orugaD'], VZ, 0, [0, 1.26, -0.05], [0.48, 0.06, 5.8], {}));
    hw = 1.27; marks(1.15, -0.4, 0.26);
  } else {                                                                                                                // pz4 (por defecto)
    g.box(c, VZ, 0, [0, 0.95, 0.0], [1.9, 0.86, 5.6], {});
    g.box(c, VZ, 0, [0, 1.62, -0.45], [2.62, 0.55, 4.0], {});
    g.box(c, VZ, 0, [0, 1.62, 1.72], [1.95, 0.55, 0.36], {});                                                            // placa del conductor
    g.box(c, VZ, 0, [0, 1.15, 2.85], [1.9, 0.55, 0.5], {rot: [-55, 0, 0]});
    g.box(t, VZ, 0, [0, 0.62, -0.1], [1.75, 0.72, 2.2], {taper: 0.18, taperZ: 0.1});
    g.cyl(t, VZ, 0, [0, 1.06, -0.95], 0.3, 0.28, 0.24, 6, {top: true});                                                   // cúpula
    g.box(gn, VZ, 0, [0, 0.0, 0.0], [0.82, 0.42, 0.2]); g.cyl(gn, VZ, 0, [0, 0, 0.75], 0.075, 0.07, 1.3, 6, {rot: [90, 0, 0], top: true});
    tankRunning(g, P, [[3.0, 1.15], [2.72, 0.15], [-2.6, 0.15], [-3.0, 0.7], [-2.85, 1.15], [2.85, 1.25]], 0.4, [1.6, 0.55, -0.5, -1.55], 0.3, [[2.78, 0.72, 0.34], [-2.7, 0.62, 0.24]]);
    [1, -1].forEach(s => g.box(P[s > 0 ? 'orugaI' : 'orugaD'], VZ, 0, [0, 1.3, 0.0], [0.45, 0.05, 5.7], {}));
    marks(1.62, -0.6, 0.26);
  }
  [1, -1].forEach(s => decalCamo(g, c, [s * 1.28, 1.25, 1.1], s * 90, 0.7, 0.28));
  g.cyl(P.mg, Z.FIX, 0x2a2a2a, [0, 0, 0.15], 0.025, 0.022, 0.4, 4, {rot: [90, 0, 0]});
  crewman(g, P.comandante, o.tripulante);
  return g;
}
function buildTankDestroyer(o) {
  const g = new GeoBuilder(), P = rigIndex('blindado'), VZ = Z.VEH, m = o.modelo || 'stug', c = P.casco, t = P.torreta, gn = P.canon;
  g.box(c, VZ, 0, [0, 0.9, 0.0], [1.9, 0.8, 5.4], {});
  g.box(c, VZ, 0, [0, 1.12, 2.7], [1.9, 0.5, 0.5], {rot: [-50, 0, 0]});
  if (m === 'su76') {                                                                                                    // casamata abierta trasera, cañón largo de 76 mm
    g.box(t, VZ, 0, [0, -0.05, -1.2], [2.3, 0.9, 2.4], {noTop: true, taper: 0.06}); g.quad([-1.1, -0.45, -0.05], [1.1, -0.45, -0.05], [1.1, -0.45, -2.35], [-1.1, -0.45, -2.35], t, Z.FIX, CE.oscuro);
    g.box(gn, VZ, 0, [0, -0.62, -0.1], [0.6, 0.45, 0.12]); g.cyl(gn, VZ, 0, [0, -0.55, 1.0], 0.06, 0.05, 2.4, 6, {rot: [90, 0, 0], top: true});
    seated(g, t, [0.5, -0.5, -1.5], 0, o.toc); seated(g, t, [-0.5, -0.5, -1.7], 0, o.toc);
  } else {                                                                                                               // StuG III / casamata genérica: superestructura baja inclinada
    g.box(t, VZ, 0, [0, -0.05, -0.3], [2.5, 0.55, 3.4], {taper: 0.14, taperZ: 0.12});
    g.box(t, VZ, 0, [m === 'generico' ? 0 : -0.15, -0.1, 1.45], [0.85, 0.48, 0.5], {rot: [-25, 0, 0]});
    g.box(gn, VZ, 0, [m === 'generico' ? 0 : -0.15, -0.62, 0.15], [0.5, 0.38, 0.25]); g.cyl(gn, VZ, 0, [m === 'generico' ? 0 : -0.15, -0.62, m === 'generico' ? 1.25 : 0.85], 0.075, 0.065, m === 'generico' ? 2.0 : 1.3, 6, {rot: [90, 0, 0], top: true});
  }
  tankRunning(g, P, [[2.85, 0.95], [2.55, 0.12], [-2.5, 0.12], [-2.85, 0.6], [-2.7, 0.95], [2.7, 1.0]], 0.38, [1.75, 1.0, 0.25, -0.5, -1.25, -2.0], 0.28, [[2.7, 0.62, 0.3], [-2.6, 0.55, 0.24]]);
  [1, -1].forEach(s => { g.box(P[s > 0 ? 'orugaI' : 'orugaD'], VZ, 0, [0, 1.08, 0.0], [0.42, 0.05, 5.5], {}); nationalMark(g, t, o.marca, [s * (m === 'su76' ? 1.16 : 1.27), m === 'su76' ? -0.05 : -0.2, -0.5], s * 90, 0.24); decalCamo(g, c, [s * 0.96, 0.95, 1.2], s * 90, 0.6, 0.22); });
  crewman(g, P.comandante, o.tripulante, m === 'su76' ? -0.95 : -0.88);
  return g;
}

/* ---------- cañón antitanque y obús pesado ---------- */
function buildCannonE(o) {
  const g = new GeoBuilder(), P = rigIndex('canon'), m = o.modelo, pc = 0x5a5c48, pcD = 0x4a4c40;
  const wheels = r => ['ruedaIz', 'ruedaDe'].forEach(k => g.cyl(P[k], Z.FIX, CE.goma, [0, 0, 0], r, r, 0.13, 6, {rot: [0, 0, 90], top: true, bottom: true}));
  if (o.tipo === 'at') {                                                                                                  // 37–57 mm: bajo, escudo, mástiles abiertos
    [1, -1].forEach(s => g.box(P.cureña, Z.FIX, pcD, [0.35 * s, 0.32, -0.95], [0.09, 0.09, 1.8], {rot: [-8, 14 * s, 0]}));
    g.box(P.cureña, Z.FIX, C.hierro, [0, 0.42, 0.15], [1.1, 0.08, 0.1], {noFront: true, noBack: true});
    const sh = m === '2pdr' ? [1.5, 0.75] : m === '53k' ? [1.3, 0.62] : [1.25, 0.55];
    g.box(P.cureña, Z.FIX, pc, [0, 0.42 + sh[1] / 2, 0.42], [sh[0], sh[1], 0.035], {rot: [-12, 0, 0], taper: m === '53k' ? 0.15 : 0.05});
    if (m === '2pdr') [[0, -0.7], [0.55, 0.45], [-0.55, 0.45]].forEach(([x, z]) => g.box(P.cureña, Z.FIX, pcD, [x * 0.6, 0.12, z * 0.6], [0.08, 0.08, 0.9], {rot: [0, Math.atan2(x, z) * 180 / Math.PI, 0]}));
    g.box(P.tubo, Z.FIX, pcD, [0, -0.22, -0.25], [0.16, 0.16, 0.55], {bottom: true});                                   // cierre y cuna
    g.cyl(P.tubo, Z.FIX, 0x3a3c38, [0, -0.2, m === '2pdr' ? 0.95 : 0.85], 0.045, 0.035, m === '2pdr' ? 1.9 : m === '53k' ? 2.0 : 1.6, 6, {rot: [90, 0, 0], top: true});
    wheels(0.33);
  } else {                                                                                                                // obús pesado 150–155 mm con munición apilada
    const heavy = m === 'ml20' ? 1.2 : 1, el = m === 'bl6' ? 26 : 18;
    if (m === 'bl6') g.box(P.cureña, Z.FIX, pcD, [0, 0.45, -1.6], [0.36, 0.22, 3.0], {rot: [-8, 0, 0]});
    else [1, -1].forEach(s => g.box(P.cureña, Z.FIX, pcD, [0.45 * s, 0.4, -1.65], [0.14, 0.16, 3.2], {rot: [-7, 9 * s, 0]}));
    g.box(P.cureña, Z.FIX, pc, [0, 0.82, 0.05], [0.7, 0.42, 1.2], {});
    g.box(P.cureña, Z.FIX, C.hierro, [0, 0.66, 0.15], [1.42, 0.12, 0.14], {noFront: true, noBack: true});
    if (m !== 'bl6') g.box(P.cureña, Z.FIX, pc, [0, 1.25, 0.55], [1.5 * heavy, 0.9, 0.04], {rot: [-8, 0, 0], taper: 0.1});   // escudo
    g.cyl(P.tubo, Z.FIX, 0x3e403a, [0, 0.12, 1.35 * heavy], 0.11, 0.1, m === 'bl6' ? 2.4 : 3.9 * heavy, 6, {rot: [90 - el, 0, 0], top: true});
    g.cyl(P.tubo, Z.FIX, pc, [0, 0.32, 0.6], 0.09, 0.09, 1.6, 6, {rot: [90 - el, 0, 0], top: true, bottom: true});      // recuperador
    g.box(P.tubo, Z.FIX, 0x3e403a, [0, 0.0, -0.45], [0.36, 0.36, 0.5], {bottom: true});
    if (m === 'ml20') { const L = 3.9 * heavy / 2; g.box(P.tubo, Z.FIX, 0x3e403a, [0, 0.12 + Math.sin(el * D2R) * L, 1.35 * heavy + Math.cos(el * D2R) * L], [0.3, 0.22, 0.35], {rot: [-el, 0, 0]}); }   // freno de boca
    wheels(0.62);
    g.box(P.cureña, Z.FIX, CE.caja, [1.5, 0.2, -1.4], [0.6, 0.4, 0.5], {});                                              // cajas y proyectiles apilados
    [[1.3, -0.8], [1.5, -0.8]].forEach(([x, z]) => g.cyl(P.cureña, Z.FIX, CE.proyectil, [x, 0.3, z], 0.075, 0.05, 0.6, 4, {top: true}));
  }
  return g;
}

/* ---------- LOD de los vehículos E ---------- */
function lodTruck(o, lvl) {
  const g = new GeoBuilder(), P = rigIndex('vehiculo');
  if (lvl === 2) { g.box(P.caja, Z.VEH, 0, [0, 1.15, -0.3], [2.2, 2.3, 6.4], {noTop: true}); g.quad([-1.1, 2.3, 2.9], [1.1, 2.3, 2.9], [1.1, 2.3, -3.5], [-1.1, 2.3, -3.5], P.caja, Z.FIX, CE.lona); return g; }
  g.box(P.caja, Z.VEH, 0, [0, 1.3, 1.55], [1.95, 1.3, 2.7], {});
  g.box(P.caja, Z.VEH, 0, [0, 1.25, -1.6], [2.2, 0.6, 3.6], {});
  g.box(P.caja, Z.FIX, CE.lona, [0, 2.1, -0.9], [2.24, 1.0, 1.7], {});
  g.box(P.tropas, Z.MAIN, 0, [0, 1.85, -2.35], [1.8, 0.7, 1.6], {noTop: true}); g.quad([-0.9, 2.2, -1.55], [0.9, 2.2, -1.55], [0.9, 2.2, -3.15], [-0.9, 2.2, -3.15], P.tropas, Z.HAT, 0);
  ['ruedaDI', 'ruedaDD', 'ruedaTI', 'ruedaTD'].forEach(k => g.disc(P[k], Z.FIX, CE.goma, [0, 0, 0], 0.45, 5, {two: true}));
  return g;
}
function lodHalftrack(o, lvl) {
  const g = new GeoBuilder(), P = rigIndex('semioruga');
  if (lvl === 2) { g.box(P.casco, Z.VEH, 0, [0, 0.95, -0.1], [2.1, 1.9, 5.6], {noTop: true}); g.quad([-1.05, 1.9, 2.7], [1.05, 1.9, 2.7], [1.05, 1.9, -2.9], [-1.05, 1.9, -2.9], P.casco, Z.MAIN, 0); return g; }
  g.box(P.casco, Z.VEH, 0, [0, 1.3, 2.05], [1.5, 0.8, 1.7], {taper: 0.3}); g.box(P.casco, Z.VEH, 0, [0, 1.42, -0.6], [2.0, 0.92, 3.7], {});
  ['orugaI', 'orugaD'].forEach(k => g.box(P[k], Z.FIX, C.oruga, [0, 0.45, -0.8], [0.32, 0.8, 3.1], {}));
  g.disc(P.ruedaI, Z.FIX, CE.goma, [0, 0, 0], 0.42, 5, {two: true}); g.disc(P.ruedaD, Z.FIX, CE.goma, [0, 0, 0], 0.42, 5, {two: true});
  g.box(P.tropas, Z.MAIN, 0, [0, 1.95, -0.95], [1.4, 0.4, 2.4], {});
  return g;
}
function lodArmor(o, lvl) {
  const g = new GeoBuilder(), P = rigIndex('blindado'), td = o.td;
  if (lvl === 2) { g.box(P.casco, Z.VEH, 0, [0, 0.8, 0], [2.9, 1.6, 5.9], {taper: 0.12}); return g; }   // bajo y ancho: se distingue del camión (alto, con lona)
  g.box(P.casco, Z.VEH, 0, [0, 1.15, 0], [2.7, 1.3, 5.7], {taperZ: 0.05});
  if (td) g.box(P.torreta, Z.VEH, 0, [0, -0.05, -0.3], [2.4, 0.55, 3.2], {taper: 0.15}); else g.box(P.torreta, Z.VEH, 0, [0, 0.55, -0.1], [1.75, 0.72, 2.1], {taper: 0.2});
  g.cyl(P.canon, Z.VEH, 0, [0, td ? -0.6 : 0, 1.0], 0.08, 0.07, 2.0, 3, {rot: [90, 0, 0]});
  ['orugaI', 'orugaD'].forEach(k => g.box(P[k], Z.FIX, C.oruga, [0, 0.55, 0], [0.42, 1.0, 5.8], {taperZ: 0.12}));
  return g;
}

/* ---------- catálogo E ---------- */
['fusilero', 'artillero', 'obus'].forEach(k => KINDS[k].eras.push('E'));
const _ofus = KINDS.fusilero.o;
KINDS.fusilero.o = (era, nat, r) => era === 'E' ? Object.assign(_ofus(era, nat, r), {bayoneta: true, equipo: md(nat, 'equipo', 'gbr'), botas: md(nat, 'botas', false)}) : _ofus(era, nat, r);
const _oart = KINDS.artillero.o;
KINDS.artillero.o = (era, nat, rol) => era === 'E' ? Object.assign(_oart(era, nat, rol), {arma: {cargador: 'proyectil', municionero: 'proyectil', atacador: 'escobillon'}[rol] || 'ninguna', botas: md(nat, 'botas', false)}) : _oart(era, nat, rol);
KINDS.artillero.roles = KINDS.artillero.roles.concat(['atacador', 'municionero']);
const _oobus = KINDS.obus.o;
KINDS.obus.o = (era, nat) => era === 'E' ? {era, tipo: 'obus_E', modelo: md(nat, 'obus', 'sfh18')} : _oobus(era, nat);
const _bcannon = buildCannon;
KINDS.obus.build = KINDS.canon.build = o => o.era === 'E' ? buildCannonE(o) : _bcannon(o);
Object.assign(KINDS, {
  ametrallador: {rig: 'soldado', clase: 'inf', pal: 'linea', eras: ['E'], nombre: 'Ametrallador (ametralladora ligera)', build: buildSoldier, lod: lodSoldier,
    o: (era, nat) => ({era, toc: hg(nat, 'E', 'linea'), arma: 'lmg', lmg: md(nat, 'lmg', 'bren'), equipo: md(nat, 'equipo', 'gbr'), botas: md(nat, 'botas', false), mochila: false, cartucheras: false, kitLigero: true})},
  camion: {rig: 'vehiculo', clase: 'mot', pal: 'linea', eras: ['E'], nombre: 'Camión de transporte con tropas', build: buildTruck, lod: lodTruck,
    o: (era, nat) => ({era, modelo: md(nat, 'camion', 'blitz'), marca: ED(nat).markType, toc: hg(nat, 'E', 'linea')})},
  semioruga: {rig: 'semioruga', clase: 'mech', pal: 'linea', eras: ['E'], nombre: 'Semioruga blindado con 6 soldados', build: buildHalftrack, lod: lodHalftrack,
    o: (era, nat) => ({era, modelo: md(nat, 'semioruga', 'sdkfz251'), marca: ED(nat).markType, toc: hg(nat, 'E', 'linea')})},
  tanque_medio: {rig: 'blindado', clase: 'arm', pal: 'linea', eras: ['E'], nombre: 'Tanque medio', build: buildMediumTank, lod: lodArmor,
    o: (era, nat) => ({era, modelo: md(nat, 'tanque_medio', 'pz4'), marca: ED(nat).markType, tripulante: md(nat, 'tripulante', 'casco_tanquista')})},
  cazacarros: {rig: 'blindado', clase: 'arm', pal: 'linea', eras: ['E'], nombre: 'Cañón de asalto / cazacarros', build: buildTankDestroyer, lod: (o, l) => lodArmor(Object.assign({td: true}, o), l),
    o: (era, nat) => ({era, modelo: md(nat, 'cazacarros', 'stug'), marca: ED(nat).markType, tripulante: md(nat, 'tripulante', 'casco_tanquista'), toc: hg(nat, 'E', 'linea')})},
  canon_at: {rig: 'canon', clase: 'art', pal: 'artilleria', eras: ['E'], nombre: 'Cañón antitanque', build: buildCannonE, lod: lodCannon, o: (era, nat) => ({era, tipo: 'at', modelo: md(nat, 'canon_at', 'pak36')})}
});
['ametrallador', 'camion', 'semioruga', 'tanque_medio', 'cazacarros', 'canon_at'].forEach(k => { if (!TROOP_KINDS.includes(k)) TROOP_KINDS.push(k); });

/* ---------- animaciones E ---------- */
// remapea el tiempo de un clip: el instante tFrom pasa a tTo (tramos lineales); sirve para sincronizar papeles con un ciclo nuevo
function retime(c, dur, tFrom, tTo) {
  const f = t => t <= tFrom ? t / tFrom * tTo : tTo + (t - tFrom) / (1 - tFrom) * (1 - tTo), o = cp(c); o.dur = dur;
  const R = tr => tr && tr.forEach(k => { k[0] = f(k[0]); });
  Object.values(o.tracks).forEach(R); R(o.root); if (o.hide) Object.values(o.hide).forEach(R); if (o.pos) Object.values(o.pos).forEach(R); (o.ev || []).forEach(e => { e[0] = f(e[0]); });
  return o;
}
const PRONE = {pieIz: [[0, 78, 0, 10]], pieDe: [[0, 78, 0, -10]], pelvis: [[0, 88, 0, 0]], torso: [[0, -18, 0, 0]], cabeza: [[0, -58, 0, 0]], musloIz: [[0, 0, 0, 8]], musloDe: [[0, 0, 0, -8]], piernaIz: [[0, 12, 0, 0]], piernaDe: [[0, 8, 0, 0]]};
const PRONE_ROOT = [[0, 0, -0.76, 0.45]], APUNTA_T = {P: [-0.12, 0.38, -0.05], R: [20, 0, 0]};
Object.assign(CLIPS.soldado, {
  tumbarse: mk(1.0, false, {pelvis: [[0, 0, 0, 0], [0.4, 0, 0, 0], [1, 88, 0, 0]], torso: [[0, 0, 0, 0], [0.4, 20, 0, 0], [1, -18, 0, 0]], cabeza: [[0, 0, 0, 0], [0.4, 10, 0, 0], [1, -58, 0, 0]],
    musloIz: [[0, 0, 0, 0], [0.4, -85, 0, 4], [1, 0, 0, 8]], piernaIz: [[0, 0, 0, 0], [0.4, 85, 0, 0], [1, 12, 0, 0]], musloDe: [[0, 0, 0, 0], [0.4, -8, 0, -4], [1, 0, 0, -8]], piernaDe: [[0, 0, 0, 0], [0.4, 95, 0, 0], [1, 8, 0, 0]],
    armaP: [[0].concat(ORDEN.P), [0.4, -0.12, -0.1, 0.3], [1].concat(APUNTA_T.P)], armaR: [[0, 0, 0, 0], [0.4, 60, 0, 0], [1].concat(APUNTA_T.R)], agarre: [[0, 0.92, -1], [0.3, 0.3, 0.75]]},
    [[0.4, 'rodilla'], [0.9, 'cuerpo_a_tierra']], {root: [[0, 0, 0, 0], [0.4, 0, -0.36, 0], [1].concat(PRONE_ROOT[0].slice(1))]}),
  disparar_tumbado: mk(2.4, true, Object.assign(cp(PRONE), {armaP: [[0].concat(APUNTA_T.P), [0.22].concat(APUNTA_T.P), [0.25, -0.12, 0.3, -0.05], [0.3].concat(APUNTA_T.P), [1].concat(APUNTA_T.P)], armaR: [[0].concat(APUNTA_T.R), [0.4, 20, 0, -14], [0.6, 20, 0, -14], [0.72].concat(APUNTA_T.R)],
    agarre: [[0, 0.3, 0.75], [0.36, 0.5, 0.75], [0.62, 0.3, 0.75]]}), [[0.22, 'disparo'], [0.4, 'cerrojo_atras'], [0.56, 'cerrojo_adelante']], {root: cp(PRONE_ROOT)}),
  disparar_rafaga: mk(1.2, true, Object.assign(cp(PRONE), {armaP: [0, 0.07, 0.14, 0.21, 0.28, 0.35, 0.42, 0.5, 1].map((t, i) => [t, -0.12, i < 7 && i % 2 ? 0.355 : 0.38, -0.05]), armaR: [[0].concat(APUNTA_T.R)],
    agarre: [[0, 0.3, 0.1]], cabeza: [[0, -58, 0, 0]]}), [[0, 'rafaga'], [0.07, 'disparo'], [0.21, 'disparo'], [0.35, 'disparo'], [0.42, 'casquillos']], {root: cp(PRONE_ROOT)}),
  avance_agachado: mk(0.8, true, {musloIz: [[0, -75, 0, 4], [0.5, -25, 0, 4], [1, -75, 0, 4]], piernaIz: [[0, 70, 0, 0], [0.25, 100, 0, 0], [0.5, 50, 0, 0], [1, 70, 0, 0]], musloDe: [[0, -25, 0, -4], [0.5, -75, 0, -4], [1, -25, 0, -4]], piernaDe: [[0, 50, 0, 0], [0.5, 70, 0, 0], [0.75, 100, 0, 0], [1, 50, 0, 0]],
    torso: [[0, 35, 0, 0]], cabeza: [[0, -30, 0, 0]], armaP: [[0, -0.05, -0.15, 0.3]], armaR: [[0, 60, 0, 30]], agarre: [[0, 0.35, 0.85]]}, [[0, 'paso'], [0.5, 'paso']], {root: [[0, 0, -0.24, 0], [0.25, 0, -0.2, 0], [0.5, 0, -0.24, 0], [0.75, 0, -0.2, 0], [1, 0, -0.24, 0]]}),
  lanzar_granada: mk(1.4, false, {brazoDe: [[0, 0, 0, -4], [0.35, 50, 0, -20], [0.55, -165, 0, -10], [0.8, -60, 0, -10], [1, 0, 0, -4]], antebrazoDe: [[0, -10, 0, 0], [0.35, -100, 0, 0], [0.55, -15, 0, 0], [1, -10, 0, 0]],
    torso: [[0, 0, 0, 0], [0.35, -12, 30, 0], [0.55, 18, -20, 0], [1, 0, 0, 0]], cabeza: [[0, 0, 0, 0], [0.35, -10, -20, 0], [0.55, -10, 0, 0], [1, 0, 0, 0]],
    musloIz: [[0, -20, 0, 0], [0.55, -35, 0, 0], [1, -4, 0, 2]], piernaIz: [[0, 15, 0, 0]], musloDe: [[0, 15, 0, 0], [0.55, 20, 0, 0], [1, 2, 0, -2]],
    armaP: [[0, 0.3, -0.9, 0.12]], armaR: [[0, 0, 0, 0]], agarre: [[0, -1, 0.92]]}, [[0.55, 'lanzar']]),
  cubrirse: cp(CLIPS.soldado.ponerse_a_cubierto), morir_1: cp(CLIPS.soldado.caer_muerto_atras), morir_2: cp(CLIPS.soldado.caer_muerto_adelante), cuerpo_a_cuerpo_bayoneta: cp(CLIPS.soldado.melee_2), recarga: cp(CLIPS.soldado.recargar_D),
  disparar: cp(CLIPS.soldado.disparar_D),
  srv_at_cargador: kneel(retime(CLIPS.soldado.srv_cargador, 3.0, 0.62, 0.45)), srv_at_apuntador: kneel(retime(CLIPS.soldado.srv_apuntador, 3.0, 0.62, 0.45)), srv_at_jefe: retime(CLIPS.soldado.srv_jefe, 3.0, 0.62, 0.45),
  srv_E_cargador: retime(CLIPS.soldado.srv_cargador, 5.0, 0.62, 0.55), srv_E_atacador: retime(CLIPS.soldado.srv_escobillon, 5.0, 0.62, 0.55), srv_E_cierre: retime(CLIPS.soldado.srv_artillero, 5.0, 0.62, 0.55),
  srv_E_apuntador: retime(CLIPS.soldado.srv_apuntador, 5.0, 0.62, 0.55),
  srv_E_municionero: mk(5.0, true, {musloIz: [[0, 0, 0, 0], [0.1, -25, 0, 0], [0.2, 15, 0, 0], [0.3, -20, 0, 0], [0.4, -50, 0, 0], [0.5, -50, 0, 0], [0.6, 15, 0, 0], [0.7, -25, 0, 0], [0.8, 10, 0, 0], [0.9, 0, 0, 0]],
    musloDe: [[0, 0, 0, 0], [0.1, 15, 0, 0], [0.2, -25, 0, 0], [0.3, 15, 0, 0], [0.4, -20, 0, 0], [0.5, -20, 0, 0], [0.6, -25, 0, 0], [0.7, 15, 0, 0], [0.8, -20, 0, 0], [0.9, 0, 0, 0]],
    piernaIz: [[0, 0, 0, 0], [0.4, 60, 0, 0], [0.5, 60, 0, 0], [0.6, 10, 0, 0]], torso: [[0, 4, 0, 0], [0.4, 45, 0, 0], [0.5, 45, 0, 0], [0.6, 8, 0, 0], [1, 4, 0, 0]],
    brazoDe: [[0, -50, 0, -10], [0.35, -20, 0, -10], [0.45, -60, 0, -10], [0.6, -55, 0, -14], [1, -50, 0, -10]], antebrazoDe: [[0, -70, 0, 0], [0.45, -20, 0, 0], [0.6, -75, 0, 0], [1, -70, 0, 0]],
    brazoIz: [[0, -45, 0, 10], [0.45, -60, 0, 10], [0.6, -50, 0, 14], [1, -45, 0, 10]], antebrazoIz: [[0, -70, 0, 0], [0.45, -20, 0, 0], [0.6, -75, 0, 0], [1, -70, 0, 0]], arma: [[0, 0, 0, 0]]},
    [[0.45, 'recoge_proyectil'], [0.92, 'entrega']], {root: [[0, 0, 0, 0], [0.38, 0, 0, -1.3], [0.52, 0, -0.12, -1.3], [0.9, 0, 0, 0], [1, 0, 0, 0]], pos: {}})
});
Object.values(CLIPS.soldado).forEach(c => { if (!c.tracks.armaP && !c.tracks.arma) Object.assign(c.tracks, arm(ORDEN, [0.92, -1])); });
// cañón E: ciclos con retroceso del tubo por el canal pos
Object.assign(CLIPS.canon, {
  servicio_at: mk(3.0, true, {tubo: [[0, 2, 0, 0]]}, [[0.15, 'cargar'], [0.25, 'cierre'], [0.35, 'apuntar'], [0.45, 'fuego'], [0.47, 'retroceso'], [0.6, 'extraer_casquillo']], {pos: {tubo: [[0, 0, 0, 0], [0.44, 0, 0, 0], [0.47, 0, 0, -0.28], [0.65, 0, 0, 0], [1, 0, 0, 0]]}, root: [[0, 0, 0, 0], [0.44, 0, 0, 0], [0.48, 0, 0, -0.06], [0.7, 0, 0, 0], [1, 0, 0, 0]]}),
  servicio_E: mk(5.0, true, {tubo: [[0, 0, 0, 0]], cureña: [[0, 0, 0, 0], [0.54, 0, 0, 0], [0.57, -1.2, 0, 0], [0.7, 0, 0, 0]]}, [[0.15, 'cargar'], [0.3, 'atacar'], [0.4, 'cierre'], [0.55, 'fuego'], [0.57, 'retroceso'], [0.75, 'extraer_casquillo']],
    {pos: {tubo: [[0, 0, 0, 0], [0.54, 0, 0, 0], [0.57, 0, -0.18, -0.65], [0.8, 0, 0, 0], [1, 0, 0, 0]]}}),
  elevar_antiaereo: mk(2.0, false, {tubo: [[0, 0, 0, 0], [1, -60, 0, 0]]}, [[1, 'elevado']])
});
CLIPS.vehiculo = {
  ralenti: mk(1.0, true, {caja: [[0, 0, 0, 0.3], [0.25, 0.1, 0, -0.2], [0.5, 0, 0, 0.25], [0.75, -0.1, 0, -0.3], [1, 0, 0, 0.3]]}),
  avanzar: mk(0.9, true, {ruedaDI: [[0, 0, 0, 0], [1, 360, 0, 0]], ruedaDD: [[0, 0, 0, 0], [1, 360, 0, 0]], ruedaTI: [[0, 0, 0, 0], [1, 360, 0, 0]], ruedaTD: [[0, 0, 0, 0], [1, 360, 0, 0]], ruedaT2I: [[0, 0, 0, 0], [1, 360, 0, 0]], ruedaT2D: [[0, 0, 0, 0], [1, 360, 0, 0]],
    caja: [[0, 0.5, 0, 0.8], [0.5, -0.4, 0, -0.8], [1, 0.5, 0, 0.8]], tropas: [[0, 0, 0, 0], [0.25, 1.5, 0, 0], [0.5, 0, 0, 0], [0.75, 1.5, 0, 0], [1, 0, 0, 0]]}),
  frenar: mk(0.8, false, {caja: [[0, 0, 0, 0], [0.3, 2.5, 0, 0], [0.6, -0.8, 0, 0], [1, 0, 0, 0]]}, [[0.3, 'frenazo']]),
  descargar_tropas: mk(2.0, false, {caja: [[0, 0, 0, 0]]}, [[0.15, 'bajan'], [0.6, 'vacio']], {hide: {tropas: [[0, 1], [0.6, 0]]}}),
  cargar_tropas: mk(2.0, false, {caja: [[0, 0, 0, 0]]}, [[0.1, 'suben'], [0.8, 'lleno']], {hide: {tropas: [[0, 0], [0.8, 1]]}}),
  destruido: mk(1.5, false, {chasis: [[0, 0, 0, 0], [0.2, -6, 0, 8], [1, -3, 0, 10]], caja: [[0, 0, 0, 0], [1, 2, 0, 4]]}, [[0, 'explosion'], [0.3, 'humo']], {root: [[0, 0, 0, 0], [1, 0, -0.12, 0]], hide: {tropas: [[0, 0]]}}),
  volcado: mk(1.5, false, {chasis: [[0, 0, 0, 0], [0.6, 0, 0, 50], [1, 0, 0, 92]]}, [[0, 'explosion'], [0.9, 'vuelco']], {root: [[0, 0, 0, 0], [0.6, -0.4, 0.5, 0], [1, -0.1, 1.08, 0]], hide: {tropas: [[0, 0]]}})
};
CLIPS.semioruga = {
  ralenti: mk(1.0, true, {casco: [[0, 0, 0, 0.3], [0.5, 0, 0, -0.3], [1, 0, 0, 0.3]]}),
  avanzar: mk(1.0, true, {casco: [[0, 0.6, 0, 0], [0.5, -0.6, 0, 0], [1, 0.6, 0, 0]], ruedaI: [[0, 0, 0, 0], [1, 360, 0, 0]], ruedaD: [[0, 0, 0, 0], [1, 360, 0, 0]], tropas: [[0, 0, 0, 0], [0.5, 1.2, 0, 0], [1, 0, 0, 0]]}, [], {tread: 1}),
  frenar: mk(0.8, false, {casco: [[0, 0, 0, 0], [0.3, 2.0, 0, 0], [1, 0, 0, 0]]}, [[0.3, 'frenazo']]),
  disparar_ametralladora: mk(1.2, true, {mg: [[0, 0, -20, 0], [0.5, 0, 20, 0], [1, 0, -20, 0]]}, [[0, 'rafaga'], [0.25, 'rafaga'], [0.5, 'rafaga'], [0.75, 'rafaga']], {pos: {mg: [0, 0.06, 0.12, 0.18, 0.25].map((t, i) => [t, 0, 0, i % 2 ? -0.03 : 0])}}),
  descargar_tropas: mk(2.0, false, {casco: [[0, 0, 0, 0]]}, [[0.15, 'bajan'], [0.6, 'vacio']], {hide: {tropas: [[0, 1], [0.6, 0]]}}),
  cargar_tropas: mk(2.0, false, {casco: [[0, 0, 0, 0]]}, [[0.1, 'suben'], [0.8, 'lleno']], {hide: {tropas: [[0, 0], [0.8, 1]]}}),
  destruido: mk(1.5, false, {casco: [[0, 0, 0, 0], [0.2, -4, 0, 5], [1, -2, 0, 7]], mg: [[0, 0, 0, 0], [1, 30, 0, 40]]}, [[0, 'explosion'], [0.3, 'humo']], {root: [[0, 0, 0, 0], [1, 0, -0.1, 0]], hide: {tropas: [[0, 0]]}})
};
const HIDE_CMD = {comandante: [[0, 0]]};
CLIPS.blindado = {
  ralenti: mk(1.0, true, {casco: [[0, 0, 0, 0.2], [0.5, 0, 0, -0.2], [1, 0, 0, 0.2]], comandante: [[0, 0, 0, 0], [0.5, 0, 30, 0], [1, 0, 0, 0]]}),
  avanzar: mk(1.2, true, {casco: [[0, 0.6, 0, 0], [0.5, -0.6, 0, 0], [1, 0.6, 0, 0]], comandante: [[0, 0, 0, 0]]}, [], {root: [[0, 0, 0, 0], [0.25, 0, 0.02, 0], [0.5, 0, 0, 0], [0.75, 0, 0.02, 0], [1, 0, 0, 0]], tread: 1}),
  retroceder: mk(1.2, true, {casco: [[0, -0.6, 0, 0], [0.5, 0.6, 0, 0], [1, -0.6, 0, 0]]}, [], {tread: -1, hide: cp(HIDE_CMD)}),
  girar_sobre_el_eje: mk(1.2, true, {casco: [[0, 0, 0, 0.6], [0.5, 0, 0, -0.6], [1, 0, 0, 0.6]]}, [], {tread: 1, pivote: true, hide: cp(HIDE_CMD)}),
  girar_torreta: mk(6.0, true, {torreta: [[0, 0, 0, 0], [0.3, 0, 70, 0], [0.5, 0, 70, 0], [0.8, 0, -45, 0], [1, 0, 0, 0]]}, [[0.05, 'motor_torreta']], {hide: cp(HIDE_CMD)}),
  disparar_canon: mk(3.0, true, {torreta: [[0, 0, 0, 0]], canon: [[0, -2, 0, 0], [0.3, -2, 0, 0], [0.32, -5, 0, 0], [0.5, -2, 0, 0], [1, -2, 0, 0]], casco: [[0, 0, 0, 0], [0.3, 0, 0, 0], [0.34, -1.6, 0, 0], [0.5, 0.4, 0, 0], [0.62, 0, 0, 0]]},
    [[0.31, 'disparo'], [0.33, 'fogonazo'], [0.36, 'humo'], [0.7, 'extraer_casquillo']], {pos: {canon: [[0, 0, 0, 0], [0.3, 0, 0, 0], [0.32, 0, 0, -0.38], [0.55, 0, 0, 0], [1, 0, 0, 0]]}, hide: cp(HIDE_CMD)}),
  disparar_ametralladora: mk(0.6, true, {mg: [[0, 0, -4, 0], [0.5, 0, 4, 0], [1, 0, -4, 0]]}, [[0, 'rafaga'], [0.17, 'disparo'], [0.33, 'disparo'], [0.5, 'disparo'], [0.67, 'disparo'], [0.83, 'disparo']], {hide: cp(HIDE_CMD)}),
  inmovilizado: mk(4.0, true, {casco: [[0, 2, 0, 3]], torreta: [[0, 0, 0, 0], [0.4, 0, -25, 0], [0.8, 0, 20, 0], [1, 0, 0, 0]]}, [[0, 'humo_negro'], [0.5, 'humo_negro']], {hide: cp(HIDE_CMD)}),
  incendiado: mk(2.0, true, {casco: [[0, 2, 0, 3]], torreta: [[0, 0, 12, 0]]}, [[0, 'fuego'], [0.25, 'humo_negro'], [0.5, 'fuego'], [0.75, 'humo_negro']], {hide: cp(HIDE_CMD)}),
  destruido: mk(1.6, false, {torreta: [[0, 0, 0, 0], [0.2, -15, 40, 20], [1, -10, 35, 18]], canon: [[0, 0, 0, 0], [1, 14, 0, 0]], casco: [[0, 0, 0, 0], [0.2, -3, 0, 2], [1, 3, 0, 5]]}, [[0, 'explosion'], [0.25, 'incendio'], [0.6, 'carcasa_humeante']],
    {pos: {torreta: [[0, 0, 0, 0], [0.2, 0.15, 0.6, -0.2], [1, 0.3, 0.1, -0.4]]}, root: [[0, 0, 0, 0], [1, 0, -0.12, 0]], hide: cp(HIDE_CMD)}),
  comandante_asomado: mk(4.0, true, {comandante: [[0, 0, 0, 0], [0.3, 0, 45, 0], [0.6, 0, -45, 0], [1, 0, 0, 0]]}, [[0.3, 'observa']])
};
Object.keys(CLIPS).forEach(r => { CLIP_SETS[r] = Object.keys(CLIPS[r]); });

/* ---------- grupos E ---------- */
const _tgroup = troopGroup;
troopGroup = function (name, era, estado, opts) {
  opts = opts || {};
  if (name === 'antitanque') { const f = estado === 'fuego'; return [{kind: 'canon_at', at: [0, 0, 0], clip: f ? 'servicio_at' : 'en_bateria'}, {kind: 'artillero', role: 'apuntador', at: [0.55, -0.7, 0], clip: f ? 'srv_at_apuntador' : 'idle'}, {kind: 'artillero', role: 'cargador', at: [-0.6, -0.75, 0], clip: f ? 'srv_at_cargador' : 'idle'}, {kind: 'artillero', role: 'jefe', at: [-1.4, -1.7, 0], clip: f ? 'srv_at_jefe' : 'idle'}]; }
  if (name === 'bateria' && era === 'E') {
    const f = estado === 'fuego';
    return [{kind: 'obus', at: [0, 0, 0], clip: f ? 'servicio_E' : 'en_bateria'}, {kind: 'artillero', role: 'cargador', at: [0.9, -0.9, 90], clip: f ? 'srv_E_cargador' : 'idle'}, {kind: 'artillero', role: 'atacador', at: [-1.0, -1.4, -90], clip: f ? 'srv_E_atacador' : 'idle'},
      {kind: 'artillero', role: 'artillero', at: [-0.9, -0.4, 90], clip: f ? 'srv_E_cierre' : 'idle'}, {kind: 'artillero', role: 'apuntador', at: [-0.75, 0.6, 0], clip: f ? 'srv_E_apuntador' : 'idle'}, {kind: 'artillero', role: 'municionero', at: [1.0, -0.6, 180], clip: f ? 'srv_E_municionero' : 'idle'}];
  }
  return _tgroup(name, era, estado, opts);
};
TROOP_GROUPS.antitanque = {nombre: 'Cañón antitanque con 3 servidores', estados: ['fuego', 'reposo']};

/* ================= paracaidista (época E) — añadido con naves3d ================= */
// Parte nueva «paracaidas» (índice 12, hija del torso, pivote en los hombros): solo tiene geometría en el paracaidista y solo se ve en los
// clips con chute: true (descender, aterrizar). En el resto de clips del soldado poseTroop la oculta (escala 0).
RIGS.soldado.push(['paracaidas', 1, [0, 0.45, 0]]);
ROLES.push('paracaidista');
// Fuentes: Osprey Elite 31 «Allied paratroopers» y MAA 139 «German airborne troops 1939–45»; Teishin Shudan (Osprey Elite 61). Japón: aprox.
NACIONES.GBR.rol.paracaidista = {E: {c: ['#9a8a5e', '#5e5a3a', '#8a7a4e', '#5a5c40'], toc: 'casco_para', nota: 'Blusón Denison (1942) de tonos arena y pardo (manchas no modeladas: se usa el tono medio), casco HSAT Mk II sin ala, pantalón de battledress.'}};
NACIONES.GER.rol = NACIONES.GER.rol || {}; NACIONES.GER.rol.paracaidista = {E: {c: ['#7a7e68', '#565c4a', '#5e6a72', '#5c6052'], toc: 'casco_para', nota: 'Fallschirmjäger: blusón (Knochensack) verde gris, pantalón azul gris de la Luftwaffe, casco M38 sin visera ni faldón.'}};
NACIONES.PRU.rol.paracaidista = NACIONES.GER.rol.paracaidista;
NACIONES.JPN.rol = NACIONES.JPN.rol || {}; NACIONES.JPN.rol.paracaidista = {E: {c: ['#8a7e4a', '#6a6440', '#8a7e4a', '#6a6440'], toc: 'casco_para', nota: 'Teishin Shudan (1942): mono caqui y casco de paracaidista redondeado. Aprox.'}};
function paraKit(g, P) {
  // casco redondo sin ala (12) y subfusil se añaden por el tocado y el arma; aquí, el paracaídas (25 triángulos)
  const k = P.paracaidas, LON = 0x7a7458, cy = 5.4;
  g.cyl(k, Z.FIX, LON, [0, cy, 0], 2.9, 1.2, 1.3, 7, {top: true, dome: 0.35});
  [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([sx, sz]) => g.tri([sx * 0.18, 0, 0], [sx * 2.7, cy - 0.65, sz * 1.2], [sx * 2.7, cy - 0.65, sz * 1.35], k, Z.FIX, 0x5a5648));
}
function weaponSMG(g, a, o) {                                          // subfusil (Sten, MP 40, tipo 100): pivote en la culata, +Y hacia la boca
  const D = 0x2a2a2a, m = o.smg || 'sten';
  g.box(a, Z.FIX, m === 'tipo100' ? C.madera : D, [0, 0.12, 0], [0.04, 0.24, 0.07], {taper: 0.2, noTop: true});
  g.box(a, Z.FIX, D, [0, 0.38, -0.01], [0.05, 0.3, 0.06], {noTop: true});
  g.cyl(a, Z.FIX, D, [0, 0.62, -0.01], 0.02, 0.018, 0.2, 3);
  if (m === 'sten') g.box(a, Z.FIX, D, [0.09, 0.4, -0.01], [0.13, 0.04, 0.04], {noTop: true}); else g.box(a, Z.FIX, D, [0, 0.36, 0.1], [0.035, 0.05, 0.16], {noTop: true});
}
const _hgE = headgearE;
headgearE = function (g, h, toc, o) { if (toc === 'casco_para') { g.cyl(h, Z.HAT, 0, [0, 0.29, 0], 0.15, 0.115, 0.15, 6, {top: true, dome: 0.05}); return; } return _hgE(g, h, toc, o); };
const _wE = weaponE;
weaponE = function (g, a, w, o) { if (w === 'subfusil') return weaponSMG(g, a, o); return _wE(g, a, w, o); };
WEAPON_LOD.subfusil = 0.66;
KINDS.paracaidista = {rig: 'soldado', clase: 'inf', pal: 'paracaidista', eras: ['E'], dobleCara: true, nombre: 'Paracaidista',
  build: o => { const g = buildSoldier(o); paraKit(g, rigIndex('soldado')); return g; },
  lod: (o, l) => { const g = lodSoldier(o, l); if (l === 1) { const P = rigIndex('soldado'); g.cyl(P.paracaidas, Z.FIX, 0x7a7458, [0, 5.4, 0], 2.9, 1.2, 1.3, 5, {top: true}); } else if (l === 2) { const P = rigIndex('soldado'); g.box(P.paracaidas, Z.FIX, 0x7a7458, [0, 5.4, 0], [5.4, 1.2, 5.4], {taper: 0.5, taperZ: 0.5, noFront: true, noBack: true}); } return g; },
  o: (era, nat) => ({era, toc: 'casco_para', arma: 'subfusil', smg: nat === 'GER' || nat === 'PRU' ? 'mp40' : nat === 'JPN' ? 'tipo100' : 'sten', mochila: false, cartucheras: true, kitLigero: true, equipo: md(nat, 'equipo', 'gbr'), botas: true})};
if (!TROOP_KINDS.includes('paracaidista')) TROOP_KINDS.push('paracaidista');
const UP_ARMS = {brazoIz: [[0, -165, 0, 12]], brazoDe: [[0, -165, 0, -12]], antebrazoIz: [[0, -12, 0, 0]], antebrazoDe: [[0, -12, 0, 0]], arma: [[0, 0, 0, 0]]};
Object.assign(CLIPS.soldado, {
  saltar_en_paracaidas: mk(1.4, false, {pelvis: [[0, 0, 0, 0], [0.3, 25, 0, 0], [1, 10, 0, 0]], torso: [[0, 0, 0, 0], [0.3, 30, 0, 0], [1, 20, 0, 0]], cabeza: [[0, 0, 0, 0], [1, 25, 0, 0]],
    brazoIz: [[0, -40, 0, 30], [0.3, -60, 0, 40], [1, -50, 0, 35]], brazoDe: [[0, -40, 0, -30], [0.3, -60, 0, -40], [1, -50, 0, -35]], antebrazoIz: [[0, -90, 0, 0]], antebrazoDe: [[0, -90, 0, 0]],
    musloIz: [[0, 0, 0, 0], [0.3, -40, 0, 0], [1, -20, 0, 0]], musloDe: [[0, 0, 0, 0], [0.3, -40, 0, 0], [1, -20, 0, 0]], piernaIz: [[0, 0, 0, 0], [0.3, 50, 0, 0], [1, 30, 0, 0]], piernaDe: [[0, 0, 0, 0], [0.3, 50, 0, 0], [1, 30, 0, 0]], arma: [[0, 0, 0, 0]]},
    [[0.05, 'salta'], [0.9, 'cinta_estatica']], {hide: {arma: [[0, 0]]}}),
  descender_en_paracaidas: mk(3.2, true, Object.assign({pelvis: [[0, 0, 0, -4], [0.5, 0, 0, 4], [1, 0, 0, -4]], torso: [[0, 0, 0, 0]], cabeza: [[0, -15, 0, 0]],
    musloIz: [[0, -12, 0, 2], [0.5, -6, 0, 2], [1, -12, 0, 2]], musloDe: [[0, -12, 0, -2], [0.5, -6, 0, -2], [1, -12, 0, -2]], piernaIz: [[0, 18, 0, 0]], piernaDe: [[0, 18, 0, 0]]}, UP_ARMS),
    [[0, 'balanceo']], {chute: true, hide: {arma: [[0, 0]]}}),
  aterrizar: mk(1.8, false, Object.assign({pelvis: [[0, 0, 0, 0], [0.2, 30, 0, 20], [0.45, 80, 0, 40], [0.7, 30, 0, 10], [1, 0, 0, 0]], torso: [[0, 0, 0, 0], [0.45, 20, 0, 0], [1, 0, 0, 0]],
    musloIz: [[0, -12, 0, 2], [0.2, -60, 0, 0], [0.45, -30, 0, 0], [1, 0, 0, 0]], musloDe: [[0, -12, 0, -2], [0.2, -60, 0, 0], [0.45, -30, 0, 0], [1, 0, 0, 0]], piernaIz: [[0, 18, 0, 0], [0.2, 90, 0, 0], [1, 0, 0, 0]], piernaDe: [[0, 18, 0, 0], [0.2, 90, 0, 0], [1, 0, 0, 0]],
    paracaidas: [[0, 0, 0, 0], [0.2, 0, 0, 0], [0.7, 0, 0, -85], [1, 0, 0, -88]]}, UP_ARMS, {brazoIz: [[0, -165, 0, 12], [0.3, -90, 0, 20], [1, -10, 0, 8]], brazoDe: [[0, -165, 0, -12], [0.3, -90, 0, -20], [1, -10, 0, -8]]}),
    [[0.18, 'toca_suelo'], [0.45, 'rueda'], [0.9, 'libera_arnes']], {chute: true, root: [[0, 0, 0, 0], [0.2, 0, -0.35, 0], [0.45, 0, -0.75, 0], [0.75, 0, -0.3, 0], [1, 0, 0, 0]],
      pos: {paracaidas: [[0, 0, 0, 0], [0.2, 0, -0.3, 0], [0.7, -1.2, -1.0, 0], [1, -1.4, -1.25, 0]]}, hide: {arma: [[0, 0], [0.95, 1]], paracaidas: [[0, 1], [0.97, 0]]}})
});
CLIP_SETS.soldado = Object.keys(CLIPS.soldado);

/* ================= v5: combate individual del soldado (cuerpo completo, instanciado) =================
   · Mezcla de puntería: rejilla de poses absolutas (5 × 5: guiñada ±35°, cabeceo ±45°) por postura (de pie, rodilla, tumbado) y rejilla de
     disparo 3 × 3. La guiñada la reparten tronco (60 %) y arma/cabeza (40 %); el cabeceo, tronco (30 %) y arma (70 %), girando el arma
     alrededor del hombro derecho, así que la boca apunta de verdad al punto. troopAimClip(kind, era, yaw, pitch, {postura, fuego}) da el nombre.
   · Transiciones de postura, reptar, movimiento táctico, tiempos muertos, recargas por época y postura, variantes de disparo, bayoneta,
     granada, rendición y heridos.
   · Reacciones por zona y dirección (impulso con muelle amortiguado) y muertes con variantes: pie de apoyo fijo mientras toca el suelo, el
     cuerpo nunca atraviesa el suelo, el fusil se suelta, cae y rebota en el mundo, y la pose final es estable. cuerpo_inerte_* = pose final
     (2 fotogramas) para dibujar cientos de cadáveres sin coste de animación.
   Todo se genera aquí a partir de poses clave; nada se descarga. TROOP_LITE = true (R.lowEnd) omite la rejilla y las variantes y deja alias. */
const TROOP_LITE = !!((typeof globalThis !== 'undefined' && globalThis.TROOP_LITE) || (typeof window !== 'undefined' && window.TROOP_LITE));   // poner window.TROOP_LITE = true (R.lowEnd) ANTES de cargar troops3d.js
const SPARTS = ['pelvis', 'torso', 'cabeza', 'brazoIz', 'antebrazoIz', 'brazoDe', 'antebrazoDe', 'musloIz', 'piernaIz', 'musloDe', 'piernaDe', 'pieIz', 'pieDe'];
const SH_R = [-0.205, 0.435, 0];                                                       // hombro derecho en el espacio del torso
const W_ = {ORDEN: {P: ORDEN.P, R: ORDEN.R, g: [0.92, -1]}, APUNTA: {P: APUNTA.P, R: APUNTA.R, g: [0.32, 0.82]}, HOMBRO: {P: HOMBRO.P, R: HOMBRO.R, g: [0.1, -1]},
  BAYO: {P: BAYO.P, R: BAYO.R, g: [0.3, 0.85]}, PREV: {P: [-0.12, 0.05, 0.25], R: [62, 0, -28], g: [0.3, 0.78]},                  // «preparado»: fusil cruzado delante del pecho
  CARGA: {P: [-0.08, 0.02, 0.24], R: [58, 8, -40], g: [0.33, 0.8]}, CADERA: {P: [-0.16, -0.1, 0.12], R: [92, 4, 0], g: [0.28, 0.72]}};
// poses: {parte: [rx, ry, rz], W: {P, R, g}, root: [x, y, z]}
const STAND = {musloIz: [-4, 0, 2], musloDe: [2, 0, -2], W: W_.ORDEN};
const AIMS = Object.assign({}, STAND, {torso: [4, -14, 0], cabeza: [6, 12, -6], musloIz: [-10, 8, 6], musloDe: [4, 10, -6], piernaIz: [6], pieIz: [4, 0, 0], W: W_.APUNTA});   // de pie, pie izquierdo adelantado
const POSE_KNEEL = {musloIz: [-85, 0, 4], piernaIz: [85], musloDe: [-8, 0, -4], piernaDe: [95], pieDe: [72], root: [0, -0.36, 0]};
const AIMK = Object.assign({}, POSE_KNEEL, {torso: [10, -10, 0], cabeza: [4, 10, -6], W: W_.APUNTA});
const POSE_PRONE = {pieIz: [78, 0, 10], pieDe: [78, 0, -10], pelvis: [88], torso: [-18], cabeza: [-58], musloIz: [0, 0, 8], musloDe: [0, 0, -8], piernaIz: [12], piernaDe: [8], root: [0, -0.76, 0.45]};
const AIMP = Object.assign({}, POSE_PRONE, {torso: [-22, -8, 0], cabeza: [-52, 6, 0], W: {P: [-0.12, 0.38, -0.05], R: [20, 0, 0], g: [0.32, 0.82]}});
const POSE_CROUCH = {musloIz: [-78, 0, 8], piernaIz: [118], musloDe: [-62, 0, -8], piernaDe: [112], pieIz: [-20], pieDe: [-10], torso: [28], cabeza: [-24], root: [0, -0.3, 0]};
const mergeP = (...ps) => { const o = {}; ps.forEach(p => p && Object.keys(p).forEach(k => { o[k] = p[k]; })); return o; };
// seq(dur, bucle, [[t, pose]], eventos, extra) → clip. Una parte que falta en una clave conserva el valor de la clave anterior (o 0).
function seq(dur, loop, keys, ev, o) {
  const tracks = {}, names = new Set(); keys.forEach(([, p]) => Object.keys(p).forEach(k => { if (SPARTS.includes(k)) names.add(k); }));
  names.forEach(n => { let last = [0, 0, 0]; tracks[n] = keys.map(([t, p]) => { if (p[n]) last = [p[n][0] || 0, p[n][1] || 0, p[n][2] || 0]; return [t].concat(last); }); });
  if (keys.some(([, p]) => p.W)) { let w = W_.ORDEN; const ks = keys.map(([t, p]) => { if (p.W) w = p.W; return [t, w]; });
    tracks.armaP = ks.map(([t, w]) => [t].concat(w.P)); tracks.armaR = ks.map(([t, w]) => [t].concat(w.R)); tracks.agarre = ks.map(([t, w]) => [t].concat(w.g)); }
  let r = [0, 0, 0]; const root = keys.map(([t, p]) => { if (p.root) r = p.root; return [t].concat(r); });
  const c = mk(dur, loop, tracks, ev || [], Object.assign({root}, o || {}));
  return c;
}
// giro extra del arma alrededor del hombro (en el espacio del torso)
const _m4a = new THREE.Matrix4(), _m4b = new THREE.Matrix4(), _m4c = new THREE.Matrix4(), _e4 = new THREE.Euler(), _q4 = new THREE.Quaternion(), _v4 = new THREE.Vector3(), _s4 = new THREE.Vector3(1, 1, 1);
function rotW(W, yawDeg, pitchDeg, piv) {
  piv = piv || SH_R; _m4a.makeTranslation(piv[0], piv[1], piv[2]).multiply(_m4b.makeRotationY(yawDeg * D2R)).multiply(_m4c.makeRotationX(-pitchDeg * D2R)).multiply(_m4b.makeTranslation(-piv[0], -piv[1], -piv[2]));
  _e4.set(W.R[0] * D2R, W.R[1] * D2R, W.R[2] * D2R); _q4.setFromEuler(_e4); _m4b.compose(_v4.set(W.P[0], W.P[1], W.P[2]), _q4, _s4).premultiply(_m4a);
  _m4b.decompose(_v4, _q4, _s4); _e4.setFromQuaternion(_q4, 'XYZ');
  return {P: [_v4.x, _v4.y, _v4.z], R: [_e4.x / D2R, _e4.y / D2R, _e4.z / D2R], g: W.g};
}
function aimPose(base, yaw, pitch, post) {
  const p = Object.assign({}, base), add = (k, v) => { const a = (p[k] || [0, 0, 0]).slice(); a[0] = (a[0] || 0) + v[0]; a[1] = (a[1] || 0) + v[1]; a[2] = (a[2] || 0) + v[2]; p[k] = a; };
  const ty = post === 'tumbado' ? 0.35 : 0.6, tp = post === 'tumbado' ? 0.15 : 0.3;
  add('torso', [-tp * pitch, ty * yaw, 0]); add('cabeza', [-(post === 'tumbado' ? 0.5 : 0.6) * pitch, 0.15 * yaw, 0]);
  add('pelvis', [0, post === 'pie' ? 14 : post === 'rodilla' ? 10.2 : 0, 0]);   // la postura de tirador gira el arma ~14° a la izquierda: se compensa con el cuerpo para que 0/0 apunte al frente
  if (post === 'pie') { add('pelvis', [0, 0.12 * yaw, 0]); add('musloIz', [0, -0.12 * yaw, 0]); add('musloDe', [0, -0.12 * yaw, 0]); }
  p.W = rotW(base.W, (1 - ty - (post === 'pie' ? 0.12 : 0)) * yaw, (1 - tp) * pitch + (post === 'pie' ? 3.9 : post === 'rodilla' ? 9.8 : -4.2)); return p;
}
const AIM_Y = [['i35', 35], ['i17', 17.5], ['c', 0], ['d17', -17.5], ['d35', -35]], AIM_P = [['ab45', -45], ['ab22', -22.5], ['c', 0], ['ar22', 22.5], ['ar45', 45]];
const AIM_BASE = {pie: AIMS, rodilla: AIMK, tumbado: AIMP};
// ---- utilidades de suelo: puntos del cuerpo, raíz sin penetración, pie fijo
const BODY_PTS = [['cabeza', [0, 0.29, 0]], ['cabeza', [0, 0.16, 0.11]], ['torso', [0.17, 0.42, 0.1]], ['torso', [-0.17, 0.42, 0.1]], ['torso', [0.17, 0.42, -0.12]], ['torso', [-0.17, 0.42, -0.12]],
  ['torso', [0, 0.15, 0.13]], ['torso', [0, 0.25, -0.2]], ['pelvis', [0.16, -0.08, -0.12]], ['pelvis', [-0.16, -0.08, -0.12]], ['pelvis', [0, -0.1, 0.12]],
  ['antebrazoIz', [0, -0.33, 0]], ['antebrazoDe', [0, -0.33, 0]], ['brazoIz', [0, -0.29, 0]], ['brazoDe', [0, -0.29, 0]], ['piernaIz', [0, 0, 0.07]], ['piernaDe', [0, 0, 0.07]]].concat(FOOT('Iz'), FOOT('De'));
function settleRoot(clip, N, o) {
  o = o || {}; const base = clip.root, b = [0, 0, 0], out = [], old = _loopCur; _loopCur = clip.loop !== false; const pinS = o.pin;
  let pin0 = null;
  for (let i = 0; i <= N; i++) {
    const t = i / N; sampleTrack(base, t, b, 3); const P = fkPoints('soldado', clip, t, BODY_PTS); let low = Math.min(...P.map(q => q[1]));
    let y = Math.max(b[1], -low); if (o.rest != null && t >= o.rest) { const k = Math.min(1, (t - o.rest) / Math.max(0.05, 1 - o.rest)); y = y + (-low - y) * (k * k * (3 - 2 * k)); }
    let x = b[0], z = b[2];
    if (pinS) { const f = fkPoints('soldado', clip, t, [['pie' + pinS[0], [0, -0.04, 0.05]]])[0]; if (t <= pinS[1]) { if (!pin0) pin0 = [f[0], f[2]]; x -= f[0] - pin0[0]; z -= f[2] - pin0[1]; out.dx = x - b[0]; out.dz = z - b[2]; } else { x += out.dx || 0; z += out.dz || 0; } }
    out.push([t, x, y, z]);
  }
  _loopCur = old; clip.root = out.map(r => r.slice(0, 4)); return clip;
}
// arma soltada: trayectoria en el mundo (caída con un rebote y reposo tumbada) convertida al espacio del torso cuadro a cuadro
function dropWeapon(clip, tRel, N, side) {
  const ix = rigIndex('soldado'), b = [0, 0, 0], ar = [0, 0, 0]; sampleTrack(clip.tracks.armaP, tRel, b, 3); sampleTrack(clip.tracks.armaR, tRel, ar, 3);
  const tmp = Object.assign({}, clip); CLIPS.soldado.__w = tmp; const M = new Float32Array(MAXP * 16);
  poseTroop('soldado', '__w', tRel, M); const T0 = new THREE.Matrix4().fromArray(M, ix.torso * 16);
  _e4.set(ar[0] * D2R, ar[1] * D2R, ar[2] * D2R); _q4.setFromEuler(_e4); const W0 = new THREE.Matrix4().compose(new THREE.Vector3(b[0], b[1], b[2]), _q4, new THREE.Vector3(1, 1, 1)).premultiply(T0);
  const p0 = new THREE.Vector3(), q0 = new THREE.Quaternion(); W0.decompose(p0, q0, _s4);
  const qEnd = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, (side || 1) * 0.6, Math.PI / 2 * (side || 1))), pEnd = p0.clone().add(new THREE.Vector3(0.25 * (side || 1), 0, 0.3)); pEnd.y = 0.035;
  const P = [], R = [], g = []; const fall = Math.sqrt(2 * Math.max(0.05, p0.y) / 9.8) / clip.dur;
  for (let i = 0; i <= N; i++) {
    const t = i / N; if (t < tRel) continue;
    const u = Math.min(1, (t - tRel) / fall), u2 = Math.min(1, Math.max(0, (t - tRel - fall) / (fall * 0.6)));
    const pos = p0.clone().lerp(pEnd, Math.min(1, u * 0.85 + u2 * 0.15)); pos.y = u < 1 ? p0.y + (pEnd.y - p0.y) * u * u : pEnd.y + 0.06 * Math.sin(Math.PI * u2);   // cae (gravedad) y rebota una vez
    const q = q0.clone().slerp(qEnd, Math.min(1, u * 0.9 + u2 * 0.1));
    const Wm = new THREE.Matrix4().compose(pos, q, new THREE.Vector3(1, 1, 1));
    poseTroop('soldado', '__w', t, M); const Ti = new THREE.Matrix4().fromArray(M, ix.torso * 16).invert(); Wm.premultiply(Ti);
    const pp = new THREE.Vector3(), qq = new THREE.Quaternion(); Wm.decompose(pp, qq, _s4); const ee = new THREE.Euler().setFromQuaternion(qq, 'XYZ');
    P.push([t, pp.x, pp.y, pp.z]); R.push([t, ee.x / D2R, ee.y / D2R, ee.z / D2R]);
  }
  delete CLIPS.soldado.__w;
  const keepP = clip.tracks.armaP.filter(k => k[0] < tRel), keepR = clip.tracks.armaR.filter(k => k[0] < tRel);
  clip.tracks.armaP = keepP.concat(P); clip.tracks.armaR = keepR.concat(R);
  clip.tracks.agarre = (clip.tracks.agarre || [[0, 0.32, 0.82]]).filter(k => k[0] < tRel).concat([[tRel, -1, -1]]);
}
// brazos sueltos que acabarían bajo el suelo en la pose final: se busca la postura de brazo más parecida que quede apoyada encima
function fixArms(c) {
  const root = [0, 0, 0]; _loopCur = false; sampleTrack(c.root, 1, root, 3);
  ['Iz', 'De'].forEach(sd => {
    const u = 'brazo' + sd, l = 'antebrazo' + sd, tu = c.tracks[u], tl = c.tracks[l]; if (!tu || !tl) return;
    const low = () => Math.min(...fkPoints('soldado', c, 1, [[l, [0, -0.33, 0]], [l, [0, -0.15, 0]], [u, [0, -0.29, 0]]]).map(q => q[1])) + root[1];
    if (low() >= -0.01) return;
    const lu = tu[tu.length - 1].slice(1), ll = tl[tl.length - 1].slice(1), ou = tu.map(k => k.slice()), ol = tl.map(k => k.slice()); let best = null;
    const setFinal = (A, B) => { c.tracks[u] = ou.map(k => k[0] >= 0.7 ? [k[0]].concat(A) : k); c.tracks[l] = ol.map(k => k[0] >= 0.7 ? [k[0]].concat(B) : k);
      if (!c.tracks[u].some(k => k[0] >= 0.7)) c.tracks[u] = c.tracks[u].concat([[1].concat(A)]); if (!c.tracks[l].some(k => k[0] >= 0.7)) c.tracks[l] = c.tracks[l].concat([[1].concat(B)]); };
    for (let rx = -180; rx <= 90; rx += 15) for (let rz = -90; rz <= 90; rz += 15) for (const fx of [ll[0], -20, -60, -100]) {
      const A = [rx, lu[1], rz], B = [fx, ll[1], ll[2]]; setFinal(A, B); const y = low(); if (y < 0.0) continue;
      const cost = Math.abs(rx - lu[0]) + Math.abs(rz - lu[2]) + 0.5 * Math.abs(fx - ll[0]) + y * 100; if (!best || cost < best.cost) best = {cost, A, B}; }
    if (best) setFinal(best.A, best.B); else { c.tracks[u] = ou; c.tracks[l] = ol; }
  });
}
// muelle amortiguado (reacción a un impulso): f(t) = A · e^(−t/τ) · sin(ω t)
const spring = (A, w, tau, t0) => t => t < (t0 || 0) ? 0 : A * Math.exp(-(t - (t0 || 0)) / tau) * Math.sin(w * (t - (t0 || 0)));

(function tacticalV5() {
  const S = CLIPS.soldado, add = (n, c) => { S[n] = c; return c; }, alias = (n, base) => { S[n] = S[base]; };
  /* ---- rejilla de puntería y disparo ---- */
  if (!TROOP_LITE) Object.keys(AIM_BASE).forEach(post => AIM_Y.forEach(([yn, y]) => AIM_P.forEach(([pn, p]) => {
    const pp = post === 'tumbado' ? Math.max(-22.5, Math.min(22.5, p)) : p, a = aimPose(AIM_BASE[post], y, pp, post);
    const c = add('apuntar_' + post + '_' + yn + '_' + pn, seq(2.4, true, [[0, a], [1, a]], [], {still: true})); c.aim = {post, yaw: y, pitch: pp};
    if ((yn === 'i35' || yn === 'c' || yn === 'd35') && (pn === 'ab22' || pn === 'c' || pn === 'ar22')) {     // disparo 3 × 3
      const k = aimPose(Object.assign({}, AIM_BASE[post], {torso: [(AIM_BASE[post].torso || [0])[0] - 5, (AIM_BASE[post].torso || [0, 0])[1], 0]}), y, pp + 6, post);
      const f = add('disparar_' + post + '_' + yn + '_' + pn, seq(1.4, false, [[0, a], [0.06, a], [0.09, k], [0.2, aimPose(AIM_BASE[post], y, pp + 1.5, post)], [0.35, a], [1, a]], [[0.07, 'disparo']]));
      addLayer(f, 'cabeza', t => [spring(-4, 40, 0.08, 0.09)(t * 1.4), 0, 0], 42); addLayer(f, 'pelvis', t => [0, 0, spring(1.2, 30, 0.1, 0.09)(t * 1.4)], 42);
      f.aim = {post, yaw: y, pitch: pp, fuego: true};
    }
  })));
  /* ---- transiciones de postura ---- */
  const KN = mergeP(POSE_KNEEL, {W: W_.PREV}), PR = mergeP(POSE_PRONE, {W: AIMP.W});
  const st = mergeP(STAND, {W: W_.PREV});
  add('a_rodilla', settleRoot(seq(0.7, false, [[0, st], [0.35, mergeP(st, {musloIz: [-60, 0, 4], piernaIz: [70], musloDe: [-20, 0, -4], piernaDe: [80], pieDe: [20], torso: [12], root: [0, -0.2, 0.05]})], [1, KN]], [[0.8, 'rodilla']]), 30, {rest: 0.75}));
  add('de_rodilla', settleRoot(seq(0.6, false, [[0, KN], [0.45, mergeP(KN, {musloIz: [-50, 0, 4], piernaIz: [60], musloDe: [-30, 0, -4], piernaDe: [70], torso: [18], root: [0, -0.18, 0.05]})], [1, st]]), 30, {rest: 0.8}));
  add('a_tumbado', settleRoot(seq(1.3, false, [[0, st], [0.25, mergeP(KN, {torso: [20]})], [0.5, mergeP(KN, {pelvis: [30], torso: [30], brazoIz: [-60, 0, 10], antebrazoIz: [-20], root: [0, -0.45, 0.2]})],
    [0.72, mergeP(POSE_PRONE, {pelvis: [70], torso: [-5], W: W_.PREV, root: [0, -0.62, 0.38]})], [1, PR]], [[0.7, 'cuerpo_a_tierra']]), 40, {rest: 0.85}));
  add('de_tumbado', settleRoot(seq(1.2, false, [[0, PR], [0.3, mergeP(POSE_PRONE, {pelvis: [60], torso: [10], musloIz: [-60, 0, 8], piernaIz: [100], brazoIz: [-40], W: W_.PREV, root: [0, -0.6, 0.35]})],
    [0.6, mergeP(KN, {torso: [25]})], [1, st]]), 40, {rest: 0.85}));
  add('idle_rodilla', seq(4.0, true, [[0, KN], [0.5, mergeP(KN, {torso: [8, 6, 0], cabeza: [0, 14, 0]})], [1, KN]]));
  add('idle_tumbado', seq(4.0, true, [[0, PR], [0.5, mergeP(PR, {cabeza: [-50, 12, 0], torso: [-20, 3, 0]})], [1, PR]]));
  add('apuntar_rodilla', seq(0.5, false, [[0, KN], [1, AIMK]])); add('apuntar_tumbado', seq(0.5, false, [[0, PR], [1, AIMP]]));
  [S.idle_rodilla, S.idle_tumbado].forEach(c => breathe(c, 0.8));
  /* ---- reptar (arrastre de codos y rodillas, fusil en los antebrazos) ---- */
  const crawl = (dur, amp) => { const c = seq(dur, true, [[0, PR], [1, PR]]); const tw = TAU;
    c.tracks.brazoIz = curve(32, t => [-120 - amp * 25 * Math.cos(tw * t), 0, 30]); c.tracks.antebrazoIz = curve(32, t => [-70 + amp * 20 * Math.cos(tw * t)]);
    c.tracks.brazoDe = curve(32, t => [-120 + amp * 25 * Math.cos(tw * t), 0, -30]); c.tracks.antebrazoDe = curve(32, t => [-70 - amp * 20 * Math.cos(tw * t)]);
    c.tracks.musloIz = curve(32, t => [-25 * amp * Math.max(0, Math.cos(tw * t + Math.PI)) - 5, 0, 18 + 10 * amp * Math.max(0, Math.cos(tw * t + Math.PI))]); c.tracks.piernaIz = curve(32, t => [20 + 50 * amp * Math.max(0, Math.cos(tw * t + Math.PI))]);
    c.tracks.musloDe = curve(32, t => [-25 * amp * Math.max(0, Math.cos(tw * t)) - 5, 0, -18 - 10 * amp * Math.max(0, Math.cos(tw * t))]); c.tracks.piernaDe = curve(32, t => [20 + 50 * amp * Math.max(0, Math.cos(tw * t))]);
    c.tracks.pelvis = curve(32, t => [88, 4 * amp * Math.sin(tw * t), 5 * amp * Math.sin(tw * t)]); c.tracks.torso = curve(32, t => [-20, -5 * amp * Math.sin(tw * t), 0]);
    c.tracks.armaP = [[0, 0.0, 0.25, 0.25]]; c.tracks.armaR = [[0, 80, 0, 90]]; c.tracks.agarre = [[0, -1, -1]];
    c.root = curve(32, t => [0.02 * amp * Math.sin(tw * t), -0.74 + 0.02 * Math.abs(Math.sin(tw * t)), 0.45]); c.ev = [[0, 'arrastre'], [0.5, 'arrastre']]; return c; };
  add('reptar', crawl(1.6, 1)); add('reptar_rapido', crawl(1.0, 1.25));
  /* ---- movimiento táctico ---- */
  const ready = mergeP(STAND, {W: W_.PREV, torso: [6], cabeza: [-4]});
  const stepCyc = (name, dur, dir) => {                                      // paso lateral / atrás: patrón de pasos generado y pies apoyados
    const c = seq(dur, true, [[0, ready], [1, ready]]), sx = dir === 'iz' ? 1 : dir === 'de' ? -1 : 0, back = dir === 'atras';
    const lead = sx >= 0 ? 'Iz' : 'De', trail = lead === 'Iz' ? 'De' : 'Iz';
    if (back) { humanLocomotion(c, 'marcha', {amp: -0.55, lean: 4, shoulder: 0, keepTorso: true}); c.tracks.torso = [[0, 6, 0, 0]]; }
    else {
      c.tracks['muslo' + lead] = curve(32, t => [-12 * Math.max(0, Math.sin(TAU * t)), 0, (lead === 'Iz' ? 1 : -1) * (4 + 14 * Math.max(0, Math.sin(TAU * t)))]);
      c.tracks['pierna' + lead] = curve(32, t => [26 * Math.max(0, Math.sin(TAU * t))]);
      c.tracks['muslo' + trail] = curve(32, t => [-12 * Math.max(0, -Math.sin(TAU * t)), 0, (trail === 'Iz' ? 1 : -1) * (2 + 8 * Math.max(0, -Math.sin(TAU * t)))]);
      c.tracks['pierna' + trail] = curve(32, t => [26 * Math.max(0, -Math.sin(TAU * t))]);
      c.tracks.pelvis = curve(32, t => [0, 0, 3 * Math.cos(TAU * t) * sx]);
      c.root = curve(32, t => [0, 0.012 * Math.abs(Math.sin(TAU * t)), 0]);
    }
    c.ev = [[0.25, 'paso'], [0.75, 'paso']]; return add(name, c); };
  stepCyc('paso_lateral_iz', 0.9, 'iz'); stepCyc('paso_lateral_de', 0.9, 'de'); stepCyc('paso_atras', 1.0, 'atras');
  // giro en el sitio con pasos: la pelvis gira el ángulo completo; al acabar el juego suma el ángulo a la orientación y vuelve a «idle»
  [[45, 'iz_45', 0.6], [-45, 'de_45', 0.6], [90, 'iz_90', 0.8], [-90, 'de_90', 0.8], [180, '180', 1.2]].forEach(([a, n, d]) => {
    const s = Math.sign(a), L = s > 0 ? 'Iz' : 'De', R2 = s > 0 ? 'De' : 'Iz', m = {};
    m['muslo' + L] = [-22, 0, 0]; m['pierna' + L] = [40]; const m2 = {}; m2['muslo' + R2] = [-20, 0, 0]; m2['pierna' + R2] = [36];
    const c = seq(d, false, [[0, ready], [0.12, mergeP(ready, {torso: [6, a * 0.25, 0], cabeza: [-4, a * 0.25, 0]})], [0.35, mergeP(ready, m, {pelvis: [0, a * 0.5, 0], torso: [6, a * 0.15, 0]})],
      [0.7, mergeP(ready, m2, {pelvis: [0, a * 0.9, 0], torso: [6, a * 0.05, 0]})], [1, mergeP(ready, {pelvis: [0, a, 0]})]], [[0.35, 'paso'], [0.7, 'paso']]);
    c.giro = a; add('girar_' + n, settleRoot(c, 24));
  });
  // carrera agachada, a cubierto y avance a saltos (corre agachado y se tira al suelo)
  const crouchRun = humanLocomotion(seq(0.6, true, [[0, mergeP(ready, {torso: [26], cabeza: [-20]})], [1, mergeP(ready, {torso: [26], cabeza: [-20]})]]), 'carrera', {amp: 0.8, lean: 2, hipOff: -18, kneeOff: 22, shoulder: 0, keepTorso: true});
  add('correr_agachado', crouchRun);
  const cover = humanLocomotion(seq(0.55, true, [[0, mergeP(ready, {torso: [34], cabeza: [-26], brazoIz: [-150, 0, 10], antebrazoIz: [-120], W: Object.assign({}, W_.CADERA, {g: [0.3, -1]})})], [1, mergeP(ready, {torso: [34], cabeza: [-26], brazoIz: [-150, 0, 10], antebrazoIz: [-120], W: Object.assign({}, W_.CADERA, {g: [0.3, -1]})})]]),
    'carrera', {amp: 0.9, lean: 2, hipOff: -14, kneeOff: 18, shoulder: 0, keepTorso: true});
  add('correr_a_cubierto', cover);                                            // mano izquierda sujeta el casco
  add('avance_a_saltos', settleRoot(seq(2.4, false, [[0, mergeP(ready, {torso: [24]})], [0.08, mergeP(ready, {torso: [30], musloIz: [-40], piernaIz: [60], root: [0, 0, 0.3]})], [0.2, mergeP(ready, {torso: [30], musloDe: [-40], piernaDe: [60], root: [0, 0, 0.9]})],
    [0.32, mergeP(ready, {torso: [32], musloIz: [-40], piernaIz: [60], root: [0, 0, 1.6]})], [0.44, mergeP(ready, {torso: [34], musloDe: [-40], piernaDe: [60], root: [0, 0, 2.3]})],
    [0.56, mergeP(KN, {torso: [30], root: [0, -0.36, 2.8]})], [0.72, mergeP(POSE_PRONE, {pelvis: [70], W: W_.PREV, root: [0, -0.62, 3.2]})], [0.85, mergeP(PR, {root: [0, -0.76, 3.4]})], [1, mergeP(PR, {root: [0, -0.76, 3.4]})]],
    [[0.08, 'paso'], [0.2, 'paso'], [0.32, 'paso'], [0.44, 'paso'], [0.7, 'cuerpo_a_tierra']], {avance: 3.4}), 48, {rest: 0.8}));
  /* ---- tiempos muertos (variedad: cada uno con su ritmo) ---- */
  const idleB = mergeP(STAND, {W: W_.ORDEN}), sling = mergeP(STAND, {W: Object.assign({}, W_.HOMBRO, {g: [0.1, -1]})});
  add('vigilar', breatheC(seq(6.0, true, [[0, ready], [0.2, mergeP(ready, {torso: [6, 18, 0], cabeza: [-2, 26, 0]})], [0.45, mergeP(ready, {torso: [6, 18, 0], cabeza: [-6, 30, 0]})], [0.6, ready],
    [0.75, mergeP(ready, {torso: [6, -16, 0], cabeza: [-2, -28, 0]})], [0.92, mergeP(ready, {torso: [6, -14, 0], cabeza: [-4, -22, 0]})], [1, ready]])));
  add('agacharse_disparo', settleRoot(seq(1.1, false, [[0, ready], [0.1, mergeP(KN, {torso: [40], cabeza: [30, 0, 0], brazoIz: [-150, 0, 20], antebrazoIz: [-120], W: Object.assign({}, W_.PREV, {g: [0.3, -1]}), root: [0, -0.45, 0]})],
    [0.55, mergeP(KN, {torso: [38], cabeza: [25, 0, 0], brazoIz: [-150, 0, 20], antebrazoIz: [-120], W: Object.assign({}, W_.PREV, {g: [0.3, -1]}), root: [0, -0.45, 0]})], [1, mergeP(KN, {W: W_.PREV})]], [[0.05, 'sobresalto']]), 30, {rest: 0.8}));
  add('mirar_alrededor', breatheC(seq(5.0, true, [[0, idleB], [0.15, mergeP(idleB, {cabeza: [0, 40, 0], torso: [0, 10, 0]})], [0.35, mergeP(idleB, {cabeza: [-8, 45, 0], torso: [0, 12, 0]})], [0.5, idleB],
    [0.62, mergeP(idleB, {cabeza: [4, -42, 0], torso: [0, -10, 0]})], [0.8, mergeP(idleB, {cabeza: [-10, -35, 4], torso: [0, -8, 0]})], [0.9, mergeP(idleB, {cabeza: [-14, 0, 0]})], [1, idleB]])));
  add('senal', seq(1.6, false, [[0, ready], [0.2, mergeP(ready, {brazoIz: [-170, 0, 10], antebrazoIz: [-10], cabeza: [-4, 20, 0], W: Object.assign({}, W_.PREV, {g: [0.3, -1]})})],
    [0.4, mergeP(ready, {brazoIz: [-100, 0, 30], antebrazoIz: [-5], cabeza: [-4, 20, 0], W: Object.assign({}, W_.PREV, {g: [0.3, -1]})})], [0.6, mergeP(ready, {brazoIz: [-170, 0, 10], antebrazoIz: [-10], W: Object.assign({}, W_.PREV, {g: [0.3, -1]})})],
    [0.8, mergeP(ready, {brazoIz: [-90, -40, 20], antebrazoIz: [-5], W: Object.assign({}, W_.PREV, {g: [0.3, -1]})})], [1, ready]], [[0.2, 'senal']]));
  add('hablar', breatheC(seq(4.2, true, [[0, idleB], [0.1, mergeP(idleB, {cabeza: [4, 30, 0], torso: [0, 12, 0]})], [0.25, mergeP(idleB, {cabeza: [-2, 32, 4], torso: [0, 12, 0], brazoIz: [-30, 0, 18], antebrazoIz: [-80]})],
    [0.35, mergeP(idleB, {cabeza: [6, 28, -2], torso: [0, 12, 0], brazoIz: [-36, 0, 22], antebrazoIz: [-70]})], [0.5, mergeP(idleB, {cabeza: [0, 30, 0], torso: [0, 12, 0]})], [0.7, mergeP(idleB, {cabeza: [8, 26, 0], torso: [0, 10, 0]})],
    [0.8, mergeP(idleB, {cabeza: [-4, 34, 4], torso: [0, 12, 0]})], [1, idleB]], [[0.25, 'voz'], [0.8, 'voz']])));
  const handFace = {brazoIz: [-45, -25, 30], antebrazoIz: [-140, 0, 0]};
  add('fumar', breatheC(seq(7.0, true, [[0, sling], [0.15, mergeP(sling, {brazoIz: [-20, 0, 10], antebrazoIz: [-90]})], [0.24, mergeP(sling, handFace, {cabeza: [6, 0, 0]})], [0.34, mergeP(sling, handFace, {cabeza: [-6, 0, 0]})],
    [0.42, mergeP(sling, {brazoIz: [-20, 0, 10], antebrazoIz: [-90], cabeza: [-10, 0, 0]})], [0.5, mergeP(sling, {brazoIz: [-20, 0, 10], antebrazoIz: [-90], cabeza: [-4, 0, 0]})], [0.8, mergeP(sling, {brazoIz: [-10, 0, 8], antebrazoIz: [-70]})], [1, sling]],
    [[0.3, 'calada'], [0.45, 'humo']])));
  add('beber', seq(4.0, false, [[0, sling], [0.15, mergeP(sling, {brazoIz: [10, 0, 20], antebrazoIz: [-30], torso: [6, 0, 0]})], [0.3, mergeP(sling, {brazoIz: [-80, -30, 25], antebrazoIz: [-120]})],
    [0.4, mergeP(sling, {brazoIz: [-110, -30, 25], antebrazoIz: [-130], cabeza: [-35, 0, 0], torso: [-6, 0, 0]})], [0.65, mergeP(sling, {brazoIz: [-115, -30, 25], antebrazoIz: [-130], cabeza: [-40, 0, 0], torso: [-8, 0, 0]})],
    [0.78, mergeP(sling, {brazoIz: [-60, -20, 20], antebrazoIz: [-100], cabeza: [0, 0, 0]})], [0.9, mergeP(sling, {brazoIz: [10, 0, 20], antebrazoIz: [-30]})], [1, sling]], [[0.4, 'beber']]));
  add('atarse_bota', settleRoot(seq(6.0, false, [[0, idleB], [0.12, mergeP(KN, {torso: [30], W: Object.assign({}, W_.PREV, {P: [-0.4, -0.3, 0.3], R: [20, 0, 40], g: [-1, -1]})})],
    [0.25, mergeP(KN, {torso: [45], cabeza: [20], brazoIz: [-70, 0, 0], antebrazoIz: [-40], brazoDe: [-70, 0, 0], antebrazoDe: [-40], W: {P: [-0.45, -0.35, 0.3], R: [20, 0, 40], g: [-1, -1]}})],
    [0.4, mergeP(KN, {torso: [46], cabeza: [22], brazoIz: [-75, 0, 4], antebrazoIz: [-50], brazoDe: [-68, 0, -4], antebrazoDe: [-30], W: {P: [-0.45, -0.35, 0.3], R: [20, 0, 40], g: [-1, -1]}})],
    [0.55, mergeP(KN, {torso: [46], cabeza: [22], brazoIz: [-68, 0, 0], antebrazoIz: [-30], brazoDe: [-75, 0, -6], antebrazoDe: [-55], W: {P: [-0.45, -0.35, 0.3], R: [20, 0, 40], g: [-1, -1]}})],
    [0.7, mergeP(KN, {torso: [44], cabeza: [20], brazoIz: [-75, 0, 4], antebrazoIz: [-50], brazoDe: [-68, 0, -4], antebrazoDe: [-30], W: {P: [-0.45, -0.35, 0.3], R: [20, 0, 40], g: [-1, -1]}})],
    [0.85, mergeP(KN, {torso: [20], W: W_.PREV})], [1, idleB]], [[0.1, 'rodilla'], [0.88, 'levantarse']]), 48, {}));
  add('recolocar_mochila', seq(2.4, false, [[0, sling], [0.2, mergeP(sling, {brazoIz: [-20, 0, 40], antebrazoIz: [-120], torso: [8, 0, 6]})], [0.35, mergeP(sling, {brazoIz: [-25, 0, 40], antebrazoIz: [-125], torso: [10, 0, -6], root: [0, 0.02, 0]})],
    [0.5, mergeP(sling, {brazoIz: [-20, 0, 40], antebrazoIz: [-120], torso: [6, 0, 4]})], [0.7, mergeP(sling, {torso: [2, 0, 0]})], [1, sling]]));
  add('estirarse', seq(3.2, false, [[0, sling], [0.25, mergeP(sling, {brazoIz: [-175, 0, 20], antebrazoIz: [-10], torso: [-8, 0, 0], cabeza: [-15, 0, 0]})], [0.5, mergeP(sling, {brazoIz: [-170, 0, 30], antebrazoIz: [-20], torso: [-10, 0, 8], cabeza: [-12, 0, 0]})],
    [0.7, mergeP(sling, {torso: [4, 0, 0]})], [1, sling]], [[0.3, 'bostezo']]));
  /* ---- recargas por época (de pie; rodilla y tumbado más abajo). Eventos: 'cerrojo', 'carga', 'baqueta', 'cebar', 'armar' ---- */
  const pouch = {brazoDe: [20, 0, -10], antebrazoDe: [-60, 0, 0]}, mouth = {brazoDe: [-50, 30, -20], antebrazoDe: [-135, 0, 0], cabeza: [6, -10, 0]};
  const muzzle = (lift) => ({P: [-0.12, -0.35, 0.18], R: [-4, 0, 6], g: [-1, 0.75 - lift]}), rammer = {brazoDe: [-160 + 0, 0, -20], antebrazoDe: [-20]};
  const muzzleLoad = (dur, era) => seq(dur, false, [[0, AIMS], [0.06, mergeP(STAND, {W: {P: [-0.12, -0.2, 0.2], R: [10, 0, 6], g: [0.35, 0.7]}})], [0.12, mergeP(STAND, pouch, {W: muzzle(0)})],   // baja el arma, mano a la cartuchera
    [0.18, mergeP(STAND, mouth, {W: muzzle(0)})], [0.26, mergeP(STAND, {brazoDe: [-110, 10, -10], antebrazoDe: [-60], W: muzzle(0)})], [0.33, mergeP(STAND, rammer, {W: muzzle(0)})],     // muerde, vierte, saca la baqueta
    [0.42, mergeP(STAND, {brazoDe: [-130, 0, -15], antebrazoDe: [-60], W: muzzle(0)})], [0.5, mergeP(STAND, rammer, {W: muzzle(0)})], [0.56, mergeP(STAND, {brazoDe: [-130, 0, -15], antebrazoDe: [-60], W: muzzle(0)})],   // ataca dos veces
    [0.64, mergeP(STAND, rammer, {W: muzzle(0)})], [0.72, mergeP(STAND, {W: W_.CARGA})], [0.8, mergeP(STAND, {W: Object.assign({}, W_.CARGA, {g: [0.42, 0.8]})})], [0.88, mergeP(STAND, {W: W_.CARGA})], [1, AIMS]],
    [[0.12, 'cartucho'], [0.2, 'morder'], [0.26, 'polvora'], [0.42, 'baqueta'], [0.56, 'baqueta'], [0.8, era === 'A' ? 'cebar' : 'piston'], [0.88, 'armar']]);
  add('recargar_B', muzzleLoad(2.6, 'B'));
  const bolt = (dur, clip5) => seq(dur, false, [[0, AIMS], [0.1, mergeP(AIMS, {W: Object.assign({}, W_.CARGA, {g: [0.3, 0.8]})})], [0.16, mergeP(AIMS, {W: Object.assign({}, W_.CARGA, {g: [0.47, 0.8]})})],   // mano al cerrojo: arriba y atrás
    [0.24, mergeP(AIMS, {W: Object.assign({}, W_.CARGA, {g: [0.42, 0.8]})})], [0.3, mergeP(AIMS, pouch, {W: Object.assign({}, W_.CARGA, {g: [-1, 0.8]})})], [0.44, mergeP(AIMS, pouch, {W: Object.assign({}, W_.CARGA, {g: [-1, 0.8]})})],
    [0.52, mergeP(AIMS, {W: Object.assign({}, W_.CARGA, {g: [0.44, 0.8]})})], [clip5 ? 0.6 : 0.56, mergeP(AIMS, {W: Object.assign({}, W_.CARGA, {g: [0.45, 0.8]})})], [clip5 ? 0.7 : 0.62, mergeP(AIMS, {W: Object.assign({}, W_.CARGA, {g: [0.42, 0.8]})})],
    [0.76, mergeP(AIMS, {W: Object.assign({}, W_.CARGA, {g: [0.47, 0.8]})})], [0.84, mergeP(AIMS, {W: Object.assign({}, W_.CARGA, {g: [0.3, 0.8]})})], [1, AIMS]],
    [[0.16, 'cerrojo'], [0.3, 'cartuchera'], [clip5 ? 0.62 : 0.54, 'carga'], [0.78, 'cerrojo']]);
  add('recargar_C', bolt(2.0, false)); add('recargar_D', bolt(1.8, true)); add('recargar_E', bolt(2.2, true));
  add('cerrojo', seq(1.0, false, [[0, AIMS], [0.18, mergeP(AIMS, {W: Object.assign({}, W_.APUNTA, {g: [0.47, 0.82]})})], [0.32, mergeP(AIMS, {W: Object.assign(rotW(W_.APUNTA, 4, -6), {g: [0.47, 0.82]})})],
    [0.5, mergeP(AIMS, {W: Object.assign({}, W_.APUNTA, {g: [0.47, 0.82]})})], [0.7, AIMS], [1, AIMS]], [[0.25, 'cerrojo'], [0.45, 'cerrojo']]));
  const recA = S.recargar_A; alias('recargar_pie_A', 'recargar_A'); alias('recargar_pie_B', 'recargar_B'); alias('recargar_pie_C', 'recargar_C'); alias('recargar_pie_D', 'recargar_D'); alias('recargar_pie_E', 'recargar_E'); void recA;
  // rodilla (todas) y tumbado (C–E; con avancarga se rueda de costado para cargar)
  ['A', 'B', 'C', 'D', 'E'].forEach(e => { const k = kneel(S['recargar_' + e]); k.root = [[0, 0, -0.36, 0]]; add('recargar_rodilla_' + e, k); });
  ['C', 'D', 'E'].forEach(e => { const c = seq(S['recargar_' + e].dur * 1.1, false, [[0, AIMP], [0.15, mergeP(AIMP, {torso: [-26, 0, -12], W: {P: [-0.1, 0.2, 0.0], R: [40, 0, -40], g: [0.47, 0.8]}})], [0.3, mergeP(AIMP, {torso: [-26, 0, -14], brazoDe: [-20, 0, -30], antebrazoDe: [-80], W: {P: [-0.1, 0.2, 0.0], R: [40, 0, -40], g: [-1, 0.8]}})],
      [0.55, mergeP(AIMP, {torso: [-26, 0, -12], W: {P: [-0.1, 0.2, 0.0], R: [40, 0, -40], g: [0.45, 0.8]}})], [0.75, mergeP(AIMP, {torso: [-24, 0, -8], W: {P: [-0.1, 0.2, 0.0], R: [40, 0, -40], g: [0.47, 0.8]}})], [1, AIMP]],
      [[0.15, 'cerrojo'], [0.55, 'carga'], [0.75, 'cerrojo']]); add('recargar_tumbado_' + e, c); });
  ['A', 'B'].forEach(e => add('recargar_tumbado_' + e, seq(3.6, false, [[0, AIMP], [0.15, mergeP(PR, {pelvis: [88, 0, -60], torso: [-10, 0, -20], W: muzzle(0)})], [0.5, mergeP(PR, {pelvis: [88, 0, -60], torso: [-10, 0, -20], brazoDe: [-150], antebrazoDe: [-40], W: muzzle(0)})],
    [0.75, mergeP(PR, {pelvis: [88, 0, -60], torso: [-10, 0, -20], W: W_.CARGA})], [1, AIMP]], [[0.2, 'cartucho'], [0.5, 'baqueta'], [0.75, 'cebar']])));
  /* ---- variantes de disparo para enemigos ---- */
  add('apuntar_y_disparar', seq(2.2, false, [[0, ready], [0.18, AIMS], [0.4, AIMS], [0.43, aimPose(AIMS, 0, 6, 'pie')], [0.52, AIMS], [1, AIMS]], [[0.18, 'apunta'], [0.42, 'disparo']]));
  add('apuntar_y_disparar_rodilla', seq(2.2, false, [[0, KN], [0.2, AIMK], [0.4, AIMK], [0.43, aimPose(AIMK, 0, 6, 'rodilla')], [0.52, AIMK], [1, AIMK]], [[0.2, 'apunta'], [0.42, 'disparo']]));
  add('apuntar_y_disparar_tumbado', seq(2.2, false, [[0, PR], [0.2, AIMP], [0.4, AIMP], [0.43, aimPose(AIMP, 0, 4, 'tumbado')], [0.52, AIMP], [1, AIMP]], [[0.2, 'apunta'], [0.42, 'disparo']]));
  const hip = mergeP(STAND, {torso: [6, -6, 0], musloIz: [-12, 6, 6], piernaIz: [10], W: W_.CADERA});
  add('disparar_cadera', seq(1.0, true, [[0, hip], [0.05, mergeP(hip, {torso: [0, -6, 0], W: rotW(W_.CADERA, 0, 10)})], [0.25, hip], [1, hip]], [[0.04, 'disparo']]));
  const lean = mergeP(AIMS, {pelvis: [0, 0, -6], torso: [6, -18, -14], cabeza: [6, 14, 8], musloDe: [-6, 0, -12], W: rotW(W_.APUNTA, 0, 0)});   // apoyado a la izquierda de un árbol o muro
  add('disparar_apoyado', seq(2.0, true, [[0, lean], [0.1, mergeP(lean, {W: rotW(W_.APUNTA, 0, 5)})], [0.25, lean], [1, lean]], [[0.09, 'disparo']]));
  /* ---- bayoneta y granada ---- */
  const guard = mergeP(STAND, {musloIz: [-24, 0, 6], piernaIz: [20], musloDe: [12, 0, -6], piernaDe: [10], torso: [10, -10, 0], W: W_.BAYO});
  const thrust = (name, P2, R2, ev) => add(name, settleRoot(seq(1.0, false, [[0, guard], [0.22, mergeP(guard, {torso: [4, -20, 0], W: {P: [-0.18, -0.12, 0.05], R: [R2[0] - 6, 0, 0], g: [0.3, 0.85]}})],
    [0.36, mergeP(guard, {musloIz: [-40, 0, 6], piernaIz: [30], musloDe: [24, 0, -6], torso: [20, 4, 0], root: [0, -0.06, 0.32], W: {P: P2, R: R2, g: [0.3, 0.85]}})], [0.48, mergeP(guard, {torso: [18, 2, 0], root: [0, -0.06, 0.32], W: {P: P2, R: R2, g: [0.3, 0.85]}})],
    [1, mergeP(guard, {root: [0, 0, 0.1]})]], [[0.36, ev]]), 30));
  thrust('estocada_baja', [-0.12, -0.08, 0.3], [92, 0, 0], 'bayoneta'); thrust('estocada_alta', [-0.12, 0.18, 0.3], [72, 0, 0], 'bayoneta');
  add('golpe_culata', seq(1.0, false, [[0, guard], [0.25, mergeP(guard, {torso: [0, 20, 0], W: {P: [-0.2, 0.1, -0.1], R: [-40, 30, 20], g: [0.6, 0.95]}})], [0.4, mergeP(guard, {torso: [14, -25, 0], musloIz: [-34, 0, 6], W: {P: [0.05, 0.2, 0.35], R: [-150, -20, 0], g: [0.6, 0.95]}})],
    [0.55, mergeP(guard, {torso: [12, -20, 0], W: {P: [0.05, 0.18, 0.32], R: [-150, -20, 0], g: [0.6, 0.95]}})], [1, guard]], [[0.4, 'golpe']]));
  add('bayoneta_defensa', seq(1.2, false, [[0, guard], [0.2, mergeP(guard, {torso: [4, 10, 0], W: {P: [-0.05, 0.15, 0.3], R: [20, 0, 80], g: [0.3, 0.85]}})], [0.35, mergeP(guard, {torso: [4, -14, 0], root: [0, 0, -0.15], W: {P: [0.08, 0.1, 0.32], R: [20, 0, 60], g: [0.3, 0.85]}})],
    [1, guard]], [[0.3, 'parada']]));
  const gThrow = (name, base) => add(name, seq(1.6, false, [[0, mergeP(base, {W: Object.assign({}, base.W || W_.PREV, {g: [-1, 0.85]})})], [0.15, mergeP(base, {brazoDe: [20, 0, -10], antebrazoDe: [-60], W: Object.assign({}, W_.PREV, {g: [-1, 0.8]})})],
    [0.4, mergeP(base, {brazoDe: [-150, 0, -40], antebrazoDe: [-80], torso: [-10, 30, 0], W: Object.assign({}, W_.PREV, {g: [-1, 0.8]})})], [0.52, mergeP(base, {brazoDe: [-170, 0, -10], antebrazoDe: [-10], torso: [20, -30, 0], W: Object.assign({}, W_.PREV, {g: [-1, 0.8]})})],
    [0.7, mergeP(base, {brazoDe: [-40, 0, -10], antebrazoDe: [-30], torso: [16, -20, 0], W: Object.assign({}, W_.PREV, {g: [-1, 0.8]})})], [1, mergeP(base, {W: W_.PREV})]], [[0.18, 'anilla'], [0.5, 'lanzar']]));
  gThrow('lanzar_granada_pie', STAND); gThrow('lanzar_granada_rodilla', POSE_KNEEL);
  /* ---- rendición y heridos ---- */
  add('rendirse_rodillas', settleRoot(seq(2.4, false, [[0, idleB], [0.15, mergeP(STAND, {W: {P: [-0.4, -0.5, 0.4], R: [30, 0, 60], g: [-1, -1]}})], [0.45, mergeP(POSE_KNEEL, {brazoIz: [-170, 0, 25], brazoDe: [-170, 0, -25], antebrazoIz: [-30], antebrazoDe: [-30], cabeza: [12], W: {P: [-0.4, -0.5, 0.4], R: [30, 0, 60], g: [-1, -1]}})],
    [0.6, mergeP(POSE_KNEEL, {musloDe: [-85, 0, -4], piernaDe: [85], pieDe: [72], brazoIz: [-170, 0, 25], brazoDe: [-170, 0, -25], antebrazoIz: [-30], antebrazoDe: [-30], cabeza: [16], root: [0, -0.5, 0]})], [1, mergeP(POSE_KNEEL, {musloIz: [-5, 0, 6], piernaIz: [95], pieIz: [72], musloDe: [-5, 0, -6], piernaDe: [95], pieDe: [72], brazoIz: [-170, 0, 25], brazoDe: [-170, 0, -25], antebrazoIz: [-35], antebrazoDe: [-35], cabeza: [18], root: [0, -0.5, 0]})]],
    [[0.15, 'soltar_arma']], {hide: {arma: [[0, 1], [0.3, 0]]}}), 40, {rest: 0.6}));
  const drag = seq(1.8, true, [[0, mergeP(POSE_PRONE, {pelvis: [86, 0, 10], torso: [-25], brazoIz: [-140, 0, 20], antebrazoIz: [-30], brazoDe: [-100, 0, -30], antebrazoDe: [-90], musloDe: [0, 0, -5], piernaDe: [5]})],
    [0.4, mergeP(POSE_PRONE, {pelvis: [86, 0, 6], torso: [-28], brazoIz: [-100, 0, 30], antebrazoIz: [-90], brazoDe: [-100, 0, -30], antebrazoDe: [-90], musloIz: [-30, 0, 20], piernaIz: [60], musloDe: [0, 0, -5], piernaDe: [5], root: [0, -0.74, 0.55]})],
    [1, mergeP(POSE_PRONE, {pelvis: [86, 0, 10], torso: [-25], brazoIz: [-140, 0, 20], antebrazoIz: [-30], brazoDe: [-100, 0, -30], antebrazoDe: [-90], musloDe: [0, 0, -5], piernaDe: [5]})]], [[0.4, 'quejido']], {hide: {arma: [[0, 0]]}});
  add('herido_arrastrandose', drag);
  /* ---- reacciones al impacto: zona y dirección (muelle amortiguado + paso de recuperación) ---- */
  const react = (name, dur, layers, keys, ev) => { const c = seq(dur, false, keys || [[0, AIMS], [1, AIMS]], ev || [[0, 'impacto']]); Object.keys(layers).forEach(p => addLayer(c, p, t => layers[p](t * dur), 60)); return add(name, settleRoot(c, 40)); };
  const back = s => ({torso: t => [spring(-18 * s, 14, 0.18)(t), 0, 0], cabeza: t => [spring(-26 * s, 18, 0.12, 0.02)(t), 0, 0], brazoIz: t => [spring(20 * s, 12, 0.2, 0.03)(t), 0, spring(18, 12, 0.2, 0.03)(t)], brazoDe: t => [spring(16 * s, 12, 0.2, 0.03)(t), 0, spring(-18, 12, 0.2, 0.03)(t)], pelvis: t => [spring(-6 * s, 12, 0.2)(t), 0, 0]});
  react('impacto_pecho_frente', 1.0, back(1), [[0, AIMS], [0.25, mergeP(AIMS, {musloDe: [12, 10, -6], root: [0, 0, -0.18]})], [1, mergeP(AIMS, {root: [0, 0, -0.2]})]]);
  react('impacto_pecho_atras', 1.0, back(-1), [[0, AIMS], [0.25, mergeP(AIMS, {musloIz: [-28, 8, 6], piernaIz: [20], root: [0, 0, 0.2]})], [1, mergeP(AIMS, {root: [0, 0, 0.22]})]]);
  const side = s => ({torso: t => [0, spring(25 * s, 13, 0.2)(t), spring(-14 * s, 13, 0.2)(t)], cabeza: t => [0, spring(18 * s, 16, 0.15, 0.02)(t), spring(-10 * s, 16, 0.15, 0.02)(t)], pelvis: t => [0, 0, spring(6 * s, 12, 0.2)(t)]});
  react('impacto_pecho_izq', 1.0, side(-1), [[0, AIMS], [0.3, mergeP(AIMS, {musloDe: [0, 0, -14], root: [-0.15, 0, 0]})], [1, mergeP(AIMS, {root: [-0.16, 0, 0]})]]);
  react('impacto_pecho_der', 1.0, side(1), [[0, AIMS], [0.3, mergeP(AIMS, {musloIz: [0, 0, 14], root: [0.15, 0, 0]})], [1, mergeP(AIMS, {root: [0.16, 0, 0]})]]);
  react('impacto_cabeza_frente', 0.8, {cabeza: t => [spring(-40, 20, 0.1)(t), 0, 0], torso: t => [spring(-10, 12, 0.15, 0.02)(t), 0, 0]});
  react('impacto_cabeza_atras', 0.8, {cabeza: t => [spring(35, 20, 0.1)(t), 0, 0], torso: t => [spring(12, 12, 0.15, 0.02)(t), 0, 0]});
  react('impacto_vientre', 1.4, {}, [[0, AIMS], [0.15, mergeP(STAND, {torso: [40], cabeza: [20], pelvis: [-8], brazoIz: [-60, 0, -20], antebrazoIz: [-100], brazoDe: [-60, 0, 20], antebrazoDe: [-100], musloIz: [-20], piernaIz: [30], musloDe: [-14], piernaDe: [24], W: {P: [-0.3, -0.3, 0.3], R: [40, 0, 40], g: [-1, -1]}})],
    [1, mergeP(STAND, {torso: [32], cabeza: [16], pelvis: [-4], brazoIz: [-50, 0, -18], antebrazoIz: [-100], brazoDe: [-50, 0, 18], antebrazoDe: [-100], musloIz: [-18], piernaIz: [26], musloDe: [-12], piernaDe: [20], W: {P: [-0.3, -0.3, 0.3], R: [40, 0, 40], g: [-1, -1]}})]], [[0, 'impacto'], [0.2, 'quejido']]);
  const armHit = (n, side2) => react(n, 1.2, {torso: t => [0, spring(12 * side2, 14, 0.15)(t), 0]}, [[0, AIMS], [0.12, mergeP(AIMS, side2 > 0 ? {brazoIz: [10, 0, 40], antebrazoIz: [-20], W: Object.assign({}, W_.CADERA, {g: [0.3, -1]})} : {brazoDe: [10, 0, -40], antebrazoDe: [-20], W: Object.assign({}, W_.PREV, {g: [-1, 0.8]})})],
    [0.4, mergeP(STAND, side2 > 0 ? {brazoIz: [-20, 0, 10], antebrazoIz: [-60], torso: [12], W: Object.assign({}, W_.CADERA, {g: [0.3, -1]})} : {brazoDe: [-40, 30, -10], antebrazoDe: [-110], torso: [12], brazoIz: [-50, -40, 20], antebrazoIz: [-80], W: {P: [-0.3, -0.5, 0.2], R: [10, 0, 30], g: [-1, -1]}})],
    [1, mergeP(STAND, side2 > 0 ? {brazoIz: [-20, 0, 10], antebrazoIz: [-60], torso: [8], W: Object.assign({}, W_.CADERA, {g: [0.3, -1]})} : {brazoDe: [-40, 30, -10], antebrazoDe: [-110], torso: [8], brazoIz: [-50, -40, 20], antebrazoIz: [-90], W: {P: [-0.3, -0.5, 0.2], R: [10, 0, 30], g: [-1, -1]}})]]);
  armHit('impacto_brazo_izq', 1); armHit('impacto_brazo_der', -1); dropWeapon(S.impacto_brazo_der, 0.14, 60, -1); dropWeapon(S.impacto_vientre, 0.1, 60, 1);   // sueltan el fusil: cae al suelo
  const legHit = (n, L) => { const a = L === 'Iz' ? 1 : -1, o = {}; o['muslo' + L] = [-85, 0, 4 * a]; o['pierna' + L] = [85]; const other = L === 'Iz' ? 'De' : 'Iz', o2 = {}; o2['muslo' + other] = [-8, 0, -4 * a]; o2['pierna' + other] = [95]; o2['pie' + other] = [72];
    return react(n, 1.3, {}, [[0, AIMS], [0.1, mergeP(STAND, {torso: [20, 0, 10 * a], ['pierna' + L]: [40], ['muslo' + L]: [-20, 0, 6 * a], W: W_.PREV})], [0.4, mergeP(POSE_KNEEL, o, o2, {torso: [26, 0, 6 * a], brazoIz: [-20, 0, 0], W: Object.assign({}, W_.PREV, {g: [0.3, -1]})})],
      [1, mergeP(POSE_KNEEL, o, o2, {torso: [22, 0, 4 * a], W: W_.PREV})]], [[0, 'impacto'], [0.35, 'rodilla']]); };
  legHit('impacto_pierna_izq', 'De'); legHit('impacto_pierna_der', 'Iz');                // cae sobre la rodilla de la pierna herida
  add('cojear', humanLocomotion(seq(1.3, true, [[0, mergeP(STAND, {W: W_.PREV})], [1, mergeP(STAND, {W: W_.PREV})]]), 'marcha', {amp: 0.6, lean: 10, shoulder: 0}));
  addLayer(S.cojear, 'piernaDe', t => [-12 * Math.max(0, Math.sin(TAU * (t - 0.5)))]); addLayer(S.cojear, 'pelvis', t => [0, 0, 5 * Math.max(0, Math.sin(TAU * (t - 0.5)))]);
  add('herido_grave', seq(3.2, true, [[0, mergeP(POSE_PRONE, {pelvis: [40, 0, 70], torso: [20, 0, 10], brazoIz: [-60, 40, 30], antebrazoIz: [-120], brazoDe: [-40, -40, -20], antebrazoDe: [-110], musloIz: [-60], piernaIz: [70], root: [0, -0.7, 0], W: {P: [-0.6, -0.4, 0.3], R: [80, 0, 80], g: [-1, -1]}})],
    [0.5, mergeP(POSE_PRONE, {pelvis: [44, 0, 70], torso: [26, 0, 14], brazoIz: [-62, 40, 30], antebrazoIz: [-125], brazoDe: [-44, -40, -20], antebrazoDe: [-115], musloIz: [-66], piernaIz: [80], root: [0, -0.7, 0]})], [1, mergeP(POSE_PRONE, {pelvis: [40, 0, 70], torso: [20, 0, 10], brazoIz: [-60, 40, 30], antebrazoIz: [-120], brazoDe: [-40, -40, -20], antebrazoDe: [-110], musloIz: [-60], piernaIz: [70], root: [0, -0.7, 0]})]],
    [[0, 'quejido'], [0.5, 'quejido']], {hide: {arma: [[0, 0]]}}));
  settleRoot(S.herido_grave, 24, {rest: 0});
  add('herido_leve', seq(2.4, false, [[0, AIMS], [0.08, mergeP(STAND, {torso: [16, 10, 0], brazoIz: [-30, -30, -10], antebrazoIz: [-110], W: Object.assign({}, W_.CADERA, {g: [0.3, -1]})})], [0.6, mergeP(STAND, {torso: [10, 6, 0], brazoIz: [-30, -30, -10], antebrazoIz: [-115], W: Object.assign({}, W_.CADERA, {g: [0.3, -1]})})], [1, ready]], [[0, 'impacto']]));
  /* ---- muertes con variantes (pie fijo, sin atravesar el suelo, el fusil cae y rebota, pose final estable) ---- */
  const death = (name, dur, keys, o) => {
    const c = seq(dur, false, keys, [[0, 'impacto'], [o.thud || 0.7, 'golpe_suelo']], {hide: o.hide});
    if (o.layers) Object.keys(o.layers).forEach(p => addLayer(c, p, t => o.layers[p](t * dur), 60));
    settleRoot(c, 60, {rest: o.rest || 0.72, pin: o.pin});
    if (c.tracks.armaP && o.drop != null) dropWeapon(c, o.drop, 60, o.dropSide || 1);
    fixArms(c); settleRoot(c, 60, {rest: o.rest || 0.72});
    add(name, c);
    const fin = {}; Object.keys(c.tracks).forEach(k => { const b = [0, 0, 0]; if (k === 'agarre') { fin[k] = [[0, -1, -1]]; return; } _loopCur = false; sampleTrack(c.tracks[k], 1, b, 3); fin[k] = [[0, b[0], b[1], b[2]]]; });
    const rb = [0, 0, 0]; sampleTrack(c.root, 1, rb, 3);
    const still = mk(2.0, true, fin, [], {root: [[0].concat(rb)], still: true}); add('cuerpo_inerte_' + name.replace(/^muerte_/, ''), still);
    return c; };
  const DOWN_BACK = mergeP(STAND, {pelvis: [-88, 0, 6], torso: [-4], cabeza: [8, 24, 0], brazoDe: [-160, 0, -40], antebrazoDe: [-20], brazoIz: [-120, 0, 70], antebrazoIz: [-10], musloIz: [-8, 0, 10], piernaIz: [8], musloDe: [4, 0, -8], piernaDe: [12], pieIz: [14, 0, 28], pieDe: [12, 0, -26], root: [0, -0.78, -0.9]});
  const DOWN_FRONT = mergeP(STAND, {pelvis: [86, 0, -4], torso: [6], cabeza: [-40, -40, 0], brazoDe: [-30, 0, -30], antebrazoDe: [-40], brazoIz: [-150, 0, 40], antebrazoIz: [-40], musloIz: [4, 0, 8], piernaIz: [20], musloDe: [-2, 0, -6], piernaDe: [6], pieIz: [62, 0, 6], pieDe: [60, 0, -6], root: [0, -0.8, 0.95]});
  death('muerte_atras_pie', 1.6, [[0, AIMS], [0.08, mergeP(AIMS, {torso: [-14], cabeza: [-24], W: rotW(W_.APUNTA, 0, 20)})], [0.3, mergeP(STAND, {pelvis: [-12], torso: [-16], cabeza: [-20], musloIz: [-34], piernaIz: [50], musloDe: [-14], piernaDe: [36], brazoDe: [-90, 0, -30], brazoIz: [-60, 0, 40], root: [0, -0.15, -0.1]})],
    [0.55, mergeP(STAND, {pelvis: [-55, 0, 4], torso: [-10], cabeza: [-12], musloIz: [-50], piernaIz: [70], musloDe: [-30], piernaDe: [50], brazoDe: [-140, 0, -40], brazoIz: [-110, 0, 60], root: [0, -0.5, -0.5]})], [0.7, DOWN_BACK], [0.78, mergeP(DOWN_BACK, {cabeza: [-4, 20, 0], brazoIz: [-130, 0, 60]})], [1, DOWN_BACK]],
    {drop: 0.12, pin: ['De', 0.35]});
  death('muerte_atras_rodilla', 1.4, [[0, AIMK], [0.1, mergeP(AIMK, {torso: [-10], cabeza: [-20]})], [0.45, mergeP(POSE_KNEEL, {pelvis: [-40], torso: [-14], brazoDe: [-120, 0, -30], brazoIz: [-80, 0, 40], root: [0, -0.5, -0.3]})],
    [0.75, mergeP(DOWN_BACK, {musloIz: [-50, 0, 10], piernaIz: [110], pieIz: [40], root: [0, -0.78, -0.6]})], [1, mergeP(DOWN_BACK, {musloIz: [-45, 0, 14], piernaIz: [105], pieIz: [40], root: [0, -0.78, -0.6]})]], {drop: 0.1});
  death('muerte_tumbado', 1.0, [[0, AIMP], [0.15, mergeP(AIMP, {torso: [-30], cabeza: [-70]})], [0.5, mergeP(POSE_PRONE, {torso: [-4], cabeza: [-10, -40, 0], brazoIz: [-150, 0, 40], antebrazoIz: [-30], brazoDe: [-90, 0, -40], antebrazoDe: [-20], W: AIMP.W})], [1, mergeP(POSE_PRONE, {torso: [0], cabeza: [-4, -45, 0], brazoIz: [-150, 0, 40], antebrazoIz: [-30], brazoDe: [-80, 0, -40], antebrazoDe: [-20], W: AIMP.W})]],
    {drop: 0.12, thud: 0.4, rest: 0.5});
  death('muerte_adelante', 1.5, [[0, AIMS], [0.1, mergeP(AIMS, {torso: [18], cabeza: [16]})], [0.35, mergeP(STAND, {pelvis: [10], torso: [26], cabeza: [10], musloIz: [-40], piernaIz: [70], musloDe: [-30], piernaDe: [80], pieDe: [30], brazoIz: [-40, 0, 20], brazoDe: [-40, 0, -20], root: [0, -0.3, 0.15]})],
    [0.55, mergeP(STAND, {pelvis: [40], torso: [20], cabeza: [-10], musloIz: [-60], piernaIz: [100], musloDe: [-20], piernaDe: [100], pieDe: [60], brazoIz: [-110, 0, 30], antebrazoIz: [-40], brazoDe: [-100, 0, -30], antebrazoDe: [-40], root: [0, -0.5, 0.4]})],
    [0.72, DOWN_FRONT], [0.8, mergeP(DOWN_FRONT, {cabeza: [-34, -40, 0]})], [1, DOWN_FRONT]], {drop: 0.1, dropSide: -1, pin: ['Iz', 0.3]});
  [['iz', 1], ['de', -1]].forEach(([n, s]) => death('muerte_costado_' + n, 1.6, [[0, AIMS], [0.1, mergeP(AIMS, {torso: [0, 20 * s, -14 * s], cabeza: [0, 20 * s, -10 * s]})], [0.3, mergeP(STAND, {pelvis: [0, 30 * s, -18 * s], torso: [10, 20 * s, -12 * s], musloIz: [-30], piernaIz: [50], musloDe: [-30], piernaDe: [50], root: [0.1 * s, -0.2, 0]})],
    [0.55, mergeP(STAND, {pelvis: [20, 60 * s, -60 * s], torso: [10, 10 * s, -10 * s], musloIz: [-50], piernaIz: [80], musloDe: [-40], piernaDe: [70], brazoIz: [-60, 0, 50], brazoDe: [-60, 0, -50], root: [0.35 * s, -0.55, 0.1]})],
    [0.75, mergeP(STAND, {pelvis: [10, 80 * s, -88 * s], torso: [10, 0, 0], cabeza: [0, -10 * s, -20 * s], musloIz: [-40, 0, 6], piernaIz: [70], musloDe: [-20, 0, -6], piernaDe: [40], brazoIz: [-90, 0, 60], antebrazoIz: [-40], brazoDe: [-40, 0, -40], antebrazoDe: [-60], pieIz: [30], pieDe: [30], root: [0.7 * s, -0.82, 0.15]})],
    [1, mergeP(STAND, {pelvis: [10, 80 * s, -90 * s], torso: [14, 0, 0], cabeza: [0, -14 * s, -24 * s], musloIz: [-44, 0, 6], piernaIz: [76], musloDe: [-22, 0, -6], piernaDe: [44], brazoIz: [-95, 0, 60], antebrazoIz: [-45], brazoDe: [-40, 0, -40], antebrazoDe: [-60], pieIz: [30], pieDe: [30], root: [0.72 * s, -0.84, 0.15]})]],
    {drop: 0.12, dropSide: s, pin: [s > 0 ? 'Iz' : 'De', 0.25]}));
  const slump = mergeP(POSE_KNEEL, {musloIz: [-5, 0, 10], piernaIz: [150], pieIz: [72], musloDe: [-5, 0, -10], piernaDe: [150], pieDe: [72], root: [0, -0.62, 0]});
  death('muerte_rodillas', 1.8, [[0, AIMS], [0.12, mergeP(AIMS, {torso: [22], cabeza: [20]})], [0.4, mergeP(slump, {torso: [30], cabeza: [30], brazoIz: [-10, 0, 10], brazoDe: [-10, 0, -10], root: [0, -0.4, 0]})], [0.6, mergeP(slump, {torso: [36], cabeza: [40], brazoIz: [0, 0, 10], brazoDe: [0, 0, -10]})],
    [0.68, mergeP(slump, {torso: [34], cabeza: [36]})], [1, mergeP(slump, {torso: [36], cabeza: [44], brazoIz: [4, 0, 12], brazoDe: [4, 0, -12]})]], {drop: 0.15, thud: 0.4, rest: 0.6});
  death('muerte_rodillas_adelante', 2.0, [[0, AIMS], [0.15, mergeP(AIMS, {torso: [22], cabeza: [20]})], [0.4, mergeP(slump, {torso: [30], cabeza: [30], root: [0, -0.4, 0]})], [0.55, mergeP(slump, {torso: [36], cabeza: [40]})],
    [0.8, mergeP(slump, {pelvis: [60], torso: [30], cabeza: [-20, -40, 0], brazoIz: [-90, 0, 30], antebrazoIz: [-40], brazoDe: [-60, 0, -30], antebrazoDe: [-60], root: [0, -0.62, 0.3]})], [1, mergeP(slump, {pelvis: [70], torso: [24], cabeza: [-30, -40, 0], brazoIz: [-100, 0, 30], antebrazoIz: [-40], brazoDe: [-60, 0, -30], antebrazoDe: [-60], root: [0, -0.64, 0.4]})]],
    {drop: 0.18, thud: 0.8, rest: 0.82});
  const wall = mergeP(STAND, {pelvis: [-20], torso: [-14, 0, 6], cabeza: [20, 20, 10], musloIz: [-80, 0, 10], piernaIz: [70], musloDe: [-70, 0, -10], piernaDe: [50], brazoIz: [0, 0, 20], antebrazoIz: [-10], brazoDe: [0, 0, -14], antebrazoDe: [-30], root: [0, -0.55, -0.2]});
  death('muerte_muro', 2.2, [[0, AIMS], [0.1, mergeP(AIMS, {torso: [-20], cabeza: [-20], root: [0, 0, -0.12]})], [0.3, mergeP(STAND, {pelvis: [-14], torso: [-16], cabeza: [-6], brazoIz: [-20, 0, 30], brazoDe: [-20, 0, -30], root: [0, -0.05, -0.2]})],
    [0.75, wall], [0.82, mergeP(wall, {cabeza: [26, 20, 14]})], [1, mergeP(wall, {cabeza: [34, 24, 16]})]], {drop: 0.1, rest: 0.75});      // espalda contra el muro y resbala hasta quedar sentado
  death('muerte_giro', 1.6, [[0, AIMS], [0.12, mergeP(AIMS, {pelvis: [0, 40, 0], torso: [0, 30, -10]})], [0.35, mergeP(STAND, {pelvis: [10, 110, -10], torso: [10, 20, -10], musloIz: [-30], piernaIz: [50], brazoIz: [-80, 0, 70], brazoDe: [-40, 0, -50], root: [0.1, -0.2, 0]})],
    [0.7, mergeP(DOWN_FRONT, {pelvis: [86, 170, -4]})], [1, mergeP(DOWN_FRONT, {pelvis: [86, 175, -6], cabeza: [-40, 40, 0]})]], {drop: 0.14, dropSide: 1, pin: ['Iz', 0.2]});
  // los nombres antiguos (caer_muerto_*) siguen existiendo y apuntan a sus clips v4
  /* ---- alias para la gama baja: sin rejilla ni variantes ---- */
  if (TROOP_LITE) { ['estocada_alta', 'golpe_culata'].forEach(n => alias(n, 'estocada_baja'));
    [['muerte_muro', 'muerte_atras_pie'], ['muerte_giro', 'muerte_costado_iz'], ['muerte_rodillas_adelante', 'muerte_rodillas'], ['muerte_costado_de', 'muerte_costado_iz']].forEach(([a, b]) => { alias(a, b); alias('cuerpo_inerte_' + a.slice(7), 'cuerpo_inerte_' + b.slice(7)); });
    ['impacto_pecho_atras', 'impacto_pecho_izq', 'impacto_pecho_der', 'impacto_cabeza_atras'].forEach(n => alias(n, 'impacto_pecho_frente')); }
  // reposo «preparado» (fusil cruzado): punto de partida y llegada de las transiciones de postura
  const S2 = CLIPS.soldado; S2.idle_preparado = breatheC(seq(4.0, true, [[0, st], [0.5, mergeP(st, {cabeza: [2, 10, 0], torso: [1, 3, 0]})], [1, st]]));
  // costuras exactas: el primer fotograma de una transición = el del clip de origen y el último = el del clip de destino
  const at0 = (c, k, t) => { const b = [0, 0, 0]; _loopCur = c.loop !== false; const tr = k === 'root' ? c.root : c.tracks[k]; if (!tr) return null; sampleTrack(tr, t, b, 3); _loopCur = false; return b; };
  const seam = (tc, src, srcT, end) => { const keys = new Set(Object.keys(tc.tracks).concat(Object.keys(src.tracks))); keys.add('root');
    keys.forEach(k => { const v = at0(src, k, srcT) || (k === 'agarre' ? null : [0, 0, 0]); if (!v) return; let tr = k === 'root' ? tc.root : tc.tracks[k];
      if (!tr) tr = [[0, 0, 0, 0], [1, 0, 0, 0]]; tr = tr.map(q => q.slice()); const i = end ? tr.length - 1 : 0; if (tr[i][0] !== (end ? 1 : 0)) tr.splice(end ? tr.length : 0, 0, [end ? 1 : 0, 0, 0, 0]);
      const j = end ? tr.length - 1 : 0; tr[j] = [tr[j][0], v[0], v[1], v[2]]; if (k === 'root') tc.root = tr; else tc.tracks[k] = tr; }); };
  [['a_rodilla', 'idle_preparado', 'idle_rodilla'], ['de_rodilla', 'idle_rodilla', 'idle_preparado'], ['a_tumbado', 'idle_preparado', 'idle_tumbado'], ['de_tumbado', 'idle_tumbado', 'idle_preparado']].forEach(([tn, a, b]) => {
    if (!S2[tn] || !S2[a] || !S2[b]) return; seam(S2[tn], S2[a], 0, false); seam(S2[tn], S2[b], 0, true); });
})();
function breatheC(c) { breathe(c, 1); return c; }
// nombre del clip de puntería más cercano. post: 'pie' | 'rodilla' | 'tumbado'; fuego: rejilla de disparo 3 × 3
function troopAimClip(kind, era, yaw, pitch, o) {
  o = o || {}; const post = o.postura || 'pie', K = KINDS[kind] || {rig: kind}, C = CLIPS[K.rig] || {};
  if (TROOP_LITE) return o.fuego ? (C.apuntar_y_disparar ? 'apuntar_y_disparar' : 'disparar_D') : 'apuntar';
  const yaws = o.fuego ? [['i35', 35], ['c', 0], ['d35', -35]] : AIM_Y, pits = o.fuego ? [['ab22', -22.5], ['c', 0], ['ar22', 22.5]] : AIM_P;
  const near = (L, v) => L.reduce((a, b) => Math.abs(b[1] - v) < Math.abs(a[1] - v) ? b : a)[0];
  const n = (o.fuego ? 'disparar_' : 'apuntar_') + post + '_' + near(yaws, yaw || 0) + '_' + near(pits, pitch || 0);
  return C[n] ? n : (o.fuego ? 'apuntar_y_disparar' : 'apuntar');
}

/* ================= v5: modelo en primera persona (viewmodel) =================
   Una sola copia, independiente de los lotes instanciados: brazos, manos, arma con piezas móviles (cerrojo, martillo y batería, baqueta,
   cargador o peine, palanca, corredera) y un trozo de pecho con el correaje. Espacio de cámara de three.js: x a la derecha, y arriba,
   −z hacia delante. Se dibuja en un segundo pase con su propia cámara (near 0,05), así nunca lo recorta el escenario.
   Animación: clips de pistas (arma, manos, mecanismos, cámara, fov) con la interpolación cúbica monótona del horneado; los brazos se
   resuelven cada fotograma por IK de dos huesos desde hombros fijos hasta la muñeca de cada mano, y las manos van sujetas a un punto
   del arma (empuñadura, guardamanos, cerrojo, baqueta…) o libres en el espacio de cámara, con transición suave entre agarres.
   TROOP_ARMS: armas por nación y época (datos y aspecto). Fuentes: manuales de instrucción (Manual of Exercise 1833, Infantry Drill 1862,
   Exerzier-Reglement 1888/1906, Field Service Pocket Book 1914) y fichas técnicas; las simplificaciones están anotadas en INTEGRACION. */
const TROOP_ARMS = {
  // modelo: aspecto (vmWeapon); accion: tipo de recarga; recarga: segundos en el juego (equilibrio); recargaReal: aproximada histórica
  mosquete_chispa: {nombre: 'Mosquete de chispa (Charleville / Brown Bess)', calibre: '17,5–19 mm', cadencia: 3, capacidad: 1, accion: 'avancarga', ignicion: 'chispa', recarga: 3.2, recargaReal: 20, alcance: 100, bayoneta: 'cubo'},
  mosquete_percusion: {nombre: 'Mosquete de percusión (conversión 1840)', calibre: '17,5 mm', cadencia: 3, capacidad: 1, accion: 'avancarga', ignicion: 'piston', recarga: 3.2, recargaReal: 18, alcance: 150, bayoneta: 'cubo'},
  rayado_minie: {nombre: 'Fusil rayado de percusión (Enfield 1853 / Springfield 1861 / Lorenz)', calibre: '14,7–15,2 mm', cadencia: 3, capacidad: 1, accion: 'avancarga', ignicion: 'piston', recarga: 2.6, recargaReal: 20, alcance: 450, bayoneta: 'cubo'},
  dreyse: {nombre: 'Fusil de aguja Dreyse M1841', calibre: '15,4 mm', cadencia: 10, capacidad: 1, accion: 'cerrojo_simple', recarga: 2.6, recargaReal: 6, alcance: 400, bayoneta: 'cubo'},
  chassepot: {nombre: 'Chassepot M1866', calibre: '11 mm', cadencia: 10, capacidad: 1, accion: 'cerrojo_simple', recarga: 2.6, recargaReal: 6, alcance: 600, bayoneta: 'sable'},
  mauser71: {nombre: 'Mauser M1871/84', calibre: '11 mm', cadencia: 12, capacidad: 1, accion: 'cerrojo_simple', recarga: 2.0, recargaReal: 5, alcance: 600, bayoneta: 'sable'},
  lebel: {nombre: 'Lebel M1886', calibre: '8 mm', cadencia: 12, capacidad: 8, accion: 'cerrojo_tubo', recarga: 2.0, recargaReal: 25, alcance: 700, bayoneta: 'aguja'},
  mosin: {nombre: 'Mosin-Nagant M1891 / 91-30', calibre: '7,62 mm', cadencia: 12, capacidad: 5, accion: 'cerrojo_peine', recarga: 1.6, recargaReal: 5, alcance: 800, bayoneta: 'aguja'},
  trapdoor: {nombre: 'Springfield M1873 «trapdoor»', calibre: '11,6 mm (.45-70)', cadencia: 10, capacidad: 1, accion: 'trampilla', recarga: 2.0, recargaReal: 5, alcance: 600, bayoneta: 'cubo'},
  martini: {nombre: 'Martini-Henry Mk II', calibre: '11,4 mm (.577/450)', cadencia: 10, capacidad: 1, accion: 'palanca', recarga: 2.0, recargaReal: 5, alcance: 600, bayoneta: 'sable'},
  lee: {nombre: 'Lee-Metford / Lee-Enfield (SMLE)', calibre: '7,7 mm (.303)', cadencia: 15, capacidad: 10, accion: 'cerrojo_peine', recarga: 1.6, recargaReal: 6, alcance: 800, bayoneta: 'sable'},
  mauser98: {nombre: 'Gewehr 98 / Kar 98k', calibre: '7,92 mm', cadencia: 12, capacidad: 5, accion: 'cerrojo_peine', recarga: 1.6, recargaReal: 5, alcance: 800, bayoneta: 'sable'},
  mannlicher: {nombre: 'Mannlicher M1895', calibre: '8 mm', cadencia: 15, capacidad: 5, accion: 'cerrojo_peine', recarga: 1.6, recargaReal: 4, alcance: 800, bayoneta: 'sable'},
  springfield03: {nombre: 'Springfield M1903', calibre: '7,62 mm (.30-06)', cadencia: 12, capacidad: 5, accion: 'cerrojo_peine', recarga: 1.6, recargaReal: 5, alcance: 800, bayoneta: 'sable'},
  garand: {nombre: 'M1 Garand', calibre: '7,62 mm (.30-06)', cadencia: 30, capacidad: 8, accion: 'semi_enbloc', recarga: 1.0, recargaReal: 3, alcance: 450, bayoneta: 'sable'},
  svt40: {nombre: 'SVT-40 / Gewehr 43', calibre: '7,62 / 7,92 mm', cadencia: 25, capacidad: 10, accion: 'semi_cargador', recarga: 1.0, recargaReal: 3, alcance: 450, bayoneta: 'sable'},
  mp40: {nombre: 'MP 40', calibre: '9 mm', cadencia: 500, capacidad: 32, accion: 'subfusil', recarga: 1.0, recargaReal: 3, alcance: 100, bayoneta: null, cargador: 'abajo'},
  sten: {nombre: 'Sten Mk II', calibre: '9 mm', cadencia: 500, capacidad: 32, accion: 'subfusil', recarga: 1.0, recargaReal: 3, alcance: 100, bayoneta: null, cargador: 'izquierda'},
  ppsh: {nombre: 'PPSh-41', calibre: '7,62 mm', cadencia: 900, capacidad: 71, accion: 'subfusil', recarga: 1.0, recargaReal: 4, alcance: 120, bayoneta: null, cargador: 'tambor'},
  thompson: {nombre: 'Thompson M1928 / M1', calibre: '11,4 mm (.45)', cadencia: 700, capacidad: 30, accion: 'subfusil', recarga: 1.0, recargaReal: 3, alcance: 100, bayoneta: null, cargador: 'abajo'},
  pistola: {nombre: 'Pistola de oficial (Luger P08 / Webley / Lebel 1892 / M1911)', calibre: '9–11,4 mm', cadencia: 30, capacidad: 8, accion: 'pistola', recarga: 1.2, recargaReal: 3, alcance: 40, bayoneta: null}
};
// arma por nación y época (rol 'fusil' | 'subfusil' | 'semi' | 'pistola'); GEN para el resto
const TROOP_ARMS_NAT = {
  A: {GEN: 'mosquete_chispa', USA: 'mosquete_percusion', GBR: 'mosquete_chispa', PRU: 'dreyse'},
  B: {GEN: 'rayado_minie', PRU: 'dreyse', GER: 'dreyse', FRA: 'chassepot'},
  C: {GEN: 'mauser71', GER: 'mauser71', PRU: 'mauser71', FRA: 'lebel', RUS: 'mosin', GBR: 'martini', USA: 'trapdoor', AUS: 'mannlicher'},
  D: {GEN: 'mauser98', GER: 'mauser98', FRA: 'lebel', RUS: 'mosin', GBR: 'lee', USA: 'springfield03', AUS: 'mannlicher', ITA: 'mannlicher'},
  E: {GEN: 'mauser98', GER: 'mauser98', FRA: 'lebel', RUS: 'mosin', SOV: 'mosin', GBR: 'lee', USA: 'garand', ITA: 'mannlicher', JAP: 'mauser98'}
};
const TROOP_ARMS_E = {subfusil: {GEN: 'mp40', GER: 'mp40', GBR: 'sten', RUS: 'ppsh', SOV: 'ppsh', USA: 'thompson'}, semi: {GEN: 'svt40', USA: 'garand', GER: 'svt40', SOV: 'svt40', RUS: 'svt40'}};
function troopArm(nation, era, rol) {
  if (rol === 'pistola') return 'pistola';
  if (era === 'E' && TROOP_ARMS_E[rol]) return TROOP_ARMS_E[rol][nation] || TROOP_ARMS_E[rol].GEN;
  const t = TROOP_ARMS_NAT[era] || TROOP_ARMS_NAT.D; return t[nation] || t.GEN;
}

/* ---------- geometría ---------- */
// cada pieza en su propio GeoBuilder (con su pivote); los colores de zona salen de la paleta de la nación
const VMC = {madera: 0x6a4428, maderaO: 0x4a2e1a, acero: 0x3a3c40, pavon: 0x24262a, laton: 0xb8954a, hierro: 0x55575a, cuero: 0x5a3a20, latonO: 0x8a6a30, piel: 0xd8a882, pielO: 0xb98a66, cobre: 0xa0603a, papel: 0xd8ccb0, verdoso: 0x4e5240};
function vmRifleSpec(id) {
  const A = TROOP_ARMS[id] || TROOP_ARMS.mauser98, acc = A.accion, long = acc === 'avancarga';
  const s = {id, acc, L: long ? -1.12 : id === 'lee' || id === 'mosin' || id === 'lebel' ? -0.92 : -0.86, butt: 0.36, bore: 0.05, ign: A.ignicion, bands: long ? 3 : id === 'lee' ? 1 : 2, pistol: ['mauser98', 'springfield03', 'garand', 'svt40', 'lee', 'mannlicher'].includes(id),
    full: id === 'lee', mag: ['mauser98', 'springfield03', 'mannlicher'].includes(id) ? 'interno' : id === 'mosin' ? 'saliente' : id === 'lee' ? 'caja' : id === 'svt40' ? 'caja' : null, bay: A.bayoneta,
    wood: id === 'lee' || id === 'garand' ? VMC.madera : VMC.maderaO, metal: acc === 'avancarga' ? VMC.hierro : VMC.pavon};
  s.sight = {rear: [0, s.bore + 0.03, -0.22], front: [0, s.bore + 0.032, s.L + 0.03]};
  s.grips = {empunadura: {p: [0, 0, 0], r: [0, 0, 0]}, guardamanos: {p: [0, s.bore - 0.035, long ? -0.42 : -0.36], r: [0, 0, 0]}, boca: {p: [0, s.bore + 0.02, s.L + 0.02], r: [-90, 0, 0]},
    cerrojo: {p: [0.075, s.bore - 0.005, 0.04], r: [0, 0, 0]}, martillo: {p: [0.03, s.bore + 0.01, 0.06], r: [0, 0, 0]}, cargador: {p: [0, s.bore - 0.06, -0.12], r: [0, 0, 0]}};
  return s;
}
function vmBuildRifle(s) {
  const B = new GeoBuilder(), F = Z.FIX, by = s.bore, L = s.L, W = s.wood, M = s.metal;
  // culata: perfil por secciones (cantonera, garganta, empuñadura, caja, guardamanos)
  const st = s.pistol ? [[s.butt, 0.022, 0.07, 0, -0.045], [0.22, 0.02, 0.055, 0, -0.03], [0.07, 0.018, 0.032, 0, -0.012], [0.0, 0.019, 0.03, 0, -0.012], [-0.06, 0.024, 0.03, 0, 0.0], [-0.2, 0.024, 0.028, 0, 0.02]]
    : [[s.butt, 0.022, 0.075, 0, -0.06], [0.2, 0.02, 0.055, 0, -0.035], [0.06, 0.017, 0.028, 0, -0.005], [0.0, 0.018, 0.026, 0, 0.0], [-0.06, 0.024, 0.03, 0, 0.012], [-0.2, 0.024, 0.026, 0, 0.022]];
  const fore = s.full ? [[-0.2, 0.024, 0.028, 0, 0.02], [L + 0.03, 0.021, 0.022, 0, by - 0.01]] : [[-0.2, 0.024, 0.026, 0, 0.022], [L + (s.acc === 'avancarga' ? 0.1 : 0.16), 0.019, 0.019, 0, by - 0.012]];
  B.loft(0, F, W, st.concat(fore.slice(1)).map(r => [r[0], r[1], r[2], r[3], r[4]]).sort((a, b) => a[0] - b[0]), 18, {axis: 'z', capA: true, capB: true, p: 2.6});
  B.loft(0, F, s.acc === 'avancarga' ? VMC.laton : M, [[s.butt - 0.008, 0.023, 0.077, 0, s.pistol ? -0.045 : -0.06], [s.butt + 0.004, 0.022, 0.074, 0, s.pistol ? -0.045 : -0.06]], 18, {axis: 'z', capB: true, p: 2.6});   // cantonera
  // cañón y bandas
  B.loft(0, F, M, [[0.02, 0.016, 0.016, 0, by], [-0.1, 0.0145, 0.0145, 0, by], [-0.4, 0.013, 0.013, 0, by], [L + 0.05, 0.0112, 0.0112, 0, by], [L, 0.011, 0.011, 0, by]], 20, {axis: 'z', capA: true});
  B.loft(0, F, 0x0a0a0a, [[L - 0.02, 0.0065, 0.0065, 0, by], [L + 0.0005, 0.0065, 0.0065, 0, by]], 8, {axis: 'z', inside: true, capA: true});
  B.loft(0, F, M, [[L - 0.0005, 0.0068, 0.0068, 0, by], [L, 0.011, 0.011, 0, by]], 20, {axis: 'z', nrm: [0, 0, -1]});
  for (let i = 0; i < s.bands; i++) { const z = L + 0.12 + i * ((-0.2 - (L + 0.12)) / Math.max(1, s.bands)); B.loft(0, F, s.acc === 'avancarga' && i === 0 ? VMC.laton : M, [[z - 0.012, 0.027, 0.03, 0, by - 0.01], [z - 0.009, 0.028, 0.031, 0, by - 0.01], [z + 0.009, 0.028, 0.031, 0, by - 0.01], [z + 0.012, 0.027, 0.03, 0, by - 0.01]], 16, {axis: 'z', p: 2.4}); }
  // miras
  B.box(0, F, M, [0, by + 0.017, L + 0.03], [0.004, 0.012, 0.012]);                                                         // punto de mira
  if (s.acc !== 'avancarga' || s.id === 'rayado_minie') { B.box(0, F, M, [0, by + 0.016, -0.215], [0.02, 0.008, 0.06], {taper: 0.1}); B.box(0, F, M, [0, by + 0.022, -0.2], [0.018, 0.005, 0.03], {rot: [-6, 0, 0]}); B.box(0, F, M, [0.0065, by + 0.0285, -0.22], [0.005, 0.006, 0.004]); B.box(0, F, M, [-0.0065, by + 0.0285, -0.22], [0.005, 0.006, 0.004]); }   // alza con muesca
  // guardamonte y disparador
  B.tube(0, F, M, [0, -0.026, 0.03], [0, -0.07, -0.02], [[0, 0.005], [1, 0.005]], 4); B.tube(0, F, M, [0, -0.07, -0.02], [0, -0.07, -0.09], [[0, 0.005], [1, 0.005]], 4); B.tube(0, F, M, [0, -0.07, -0.09], [0, -0.03, -0.11], [[0, 0.005], [1, 0.005]], 4);
  B.box(0, F, M, [0, -0.045, -0.04], [0.004, 0.035, 0.006], {rot: [-15, 0, 0]});
  // anillas de la correa y correa colgando
  B.loft(0, F, M, [[-0.006, 0.012, 0.012], [0.006, 0.012, 0.012]], 6, {axis: 'x', at: [0, -0.04, 0.2]});
  B.strap(0, F, VMC.cuero, [[-0.026, -0.05, 0.2], [-0.03, -0.09, 0.0], [-0.03, -0.1, -0.25], [-0.028, -0.045, L + 0.32]], 0.022, [-1, 0, 0]); B.strap(0, F, VMC.cuero, [[-0.024, -0.045, L + 0.32], [-0.028, -0.1, -0.25], [-0.028, -0.09, 0.0], [-0.024, -0.05, 0.2]], 0.022, [1, 0, 0]);
  B.loft(0, F, M, [[-0.006, 0.01, 0.01], [0.006, 0.01, 0.01]], 8, {axis: 'x', at: [0, by - 0.03, L + 0.32]});   // anilla delantera
  if (s.mag === 'saliente') B.box(0, F, M, [0, -0.045, -0.07], [0.03, 0.04, 0.09], {taper: 0.15});
  if (s.mag === 'caja') B.box(0, F, M, [0, -0.06, -0.08], [0.03, 0.07, 0.08], {taper: 0.1});
  // cajón de mecanismos / llave
  if (s.acc === 'avancarga') {
    B.box(0, F, VMC.hierro, [0.022, by - 0.005, 0.0], [0.006, 0.035, 0.13], {taper: 0.15});                                // pletina
    if (s.ign === 'chispa') { B.box(0, F, M, [0.03, by + 0.012, -0.045], [0.02, 0.012, 0.03]); }                          // cazoleta
    else B.tube(0, F, M, [0.02, by + 0.006, -0.03], [0.03, by + 0.022, -0.03], [[0, 0.004], [1, 0.0035]], 4);             // chimenea del pistón
  } else { B.loft(0, F, M, [[0.06, 0.019, 0.02, 0, by], [0.045, 0.0205, 0.0215, 0, by], [-0.115, 0.0205, 0.0215, 0, by], [-0.13, 0.019, 0.02, 0, by]], 16, {axis: 'z', capA: true, capB: true});   // cajón
    [0.03, -0.1].forEach(z => B.loft(0, F, 0x8a8c90, [[-0.002, 0.004, 0.004], [0.002, 0.004, 0.004]], 8, {axis: 'x', at: [0.021, by - 0.006, z], capB: true})); }   // tornillos del cajón
  if (s.bay === 'cubo' || s.bay === 'aguja' || s.bay === 'sable') {                                                      // bayoneta calada
    const z0 = L + 0.05, len = s.bay === 'sable' ? 0.42 : s.bay === 'aguja' ? 0.5 : 0.45;
    B.loft(0, F, M, [[z0 + 0.06, 0.014, 0.014, 0, by], [z0 - 0.01, 0.014, 0.014, 0, by]], 8, {axis: 'z'});
    if (s.bay === 'sable') { B.box(0, F, M, [0, by - 0.025, z0 - 0.02], [0.012, 0.04, 0.03]); B.box(0, F, 0xb8bcc0, [0, by - 0.035, z0 - 0.03 - len / 2], [0.004, 0.026, len], {taper: 0.6}); }
    else { B.tube(0, F, M, [0, by, z0], [0, by - 0.03, z0 - 0.02], [[0, 0.006], [1, 0.006]], 4); B.tube(0, F, 0xb8bcc0, [0, by - 0.03, z0 - 0.02], [0, by - 0.03, z0 - 0.02 - len], [[0, 0.009], [1, 0.001]], 3); }
  }
  return B;
}
function vmBuildMoving(s) {   // piezas móviles: {cerrojo, martillo, bateria, baqueta, palanca, cargador}
  const out = {}, F = Z.FIX, by = s.bore, M = s.metal;
  if (s.acc.startsWith('cerrojo') || s.acc === 'semi_enbloc' || s.acc === 'semi_cargador') {
    const b = new GeoBuilder(); b.loft(0, F, 0x8a8c90, [[0.1, 0.0085, 0.0085], [-0.08, 0.0085, 0.0085]], 8, {axis: 'z', capA: true, capB: true});   // eje del cerrojo (pivote en el eje del ánima)
    if (s.acc !== 'semi_enbloc' && s.acc !== 'semi_cargador') { b.tube(0, F, 0x8a8c90, [0.0, 0.0, 0.06], [0.065, -0.012, 0.075], [[0, 0.005], [1, 0.005]], 5); b.loft(0, F, 0x8a8c90, [[-0.012, 0.012, 0.012], [0.012, 0.012, 0.012]], 8, {axis: 'x', at: [0.075, -0.014, 0.077], capA: true, capB: true}); }   // manilla y bola
    else b.box(0, F, M, [0.03, 0.0, 0.03], [0.03, 0.012, 0.03]);                                                           // palanca de montar del Garand / SVT
    out.cerrojo = {g: b, at: [0, by, 0]};
  }
  if (s.acc === 'avancarga') {
    const h = new GeoBuilder(); if (s.ign === 'chispa') { h.box(0, F, M, [0, 0.03, -0.01], [0.008, 0.06, 0.012], {rot: [-30, 0, 0]}); h.box(0, F, 0x2a2a2a, [0, 0.055, -0.03], [0.012, 0.012, 0.012]); }   // pie de gato con pedernal
    else { h.box(0, F, M, [0, 0.028, -0.012], [0.008, 0.05, 0.012], {rot: [-25, 0, 0]}); h.box(0, F, M, [0, 0.05, -0.03], [0.012, 0.01, 0.02]); }   // martillo del pistón
    out.martillo = {g: h, at: [0.03, by - 0.02, 0.03]};
    if (s.ign === 'chispa') { const f = new GeoBuilder(); f.box(0, F, M, [0, 0.02, 0], [0.018, 0.04, 0.006]); out.bateria = {g: f, at: [0.03, by + 0.005, -0.06]}; }
    const r = new GeoBuilder(); r.loft(0, F, s.ign === 'chispa' ? 0x9a9a9a : 0x8a8c90, [[0, 0.004, 0.004], [-0.95, 0.004, 0.004], [-0.97, 0.007, 0.007]], 6, {axis: 'z', capA: true, capB: true}); out.baqueta = {g: r, at: [0, by - 0.024, L_(s) + 0.02]};
  }
  if (s.acc === 'trampilla') { const t = new GeoBuilder(); t.box(0, F, M, [0, 0.0, 0.05], [0.036, 0.03, 0.11]); t.box(0, F, M, [0.012, 0.02, 0.1], [0.008, 0.04, 0.012]); out.cerrojo = {g: t, at: [0, by, -0.08]}; }   // trampilla (gira hacia delante)
  if (s.acc === 'palanca') { const p = new GeoBuilder(); p.tube(0, F, M, [0, 0, 0], [0, -0.04, 0.16], [[0, 0.006], [1, 0.005]], 5); out.palanca = {g: p, at: [0, -0.03, -0.06]};
    const bl = new GeoBuilder(); bl.box(0, F, M, [0, 0, -0.03], [0.034, 0.03, 0.08]); out.cerrojo = {g: bl, at: [0, by, -0.02]}; }
  if (s.mag === 'caja' || s.acc === 'semi_cargador') { const m = new GeoBuilder(); m.box(0, F, M, [0, -0.035, 0], [0.028, 0.07, 0.075], {taper: 0.1}); out.cargador = {g: m, at: [0, -0.03, -0.08]}; }
  return out;
}
function L_(s) { return s.L; }
// subfusiles y pistola
function vmBuildSMG(id) {
  const B = new GeoBuilder(), F = Z.FIX, P = VMC.pavon, out = {}, by = 0.04, A = TROOP_ARMS[id];
  const len = id === 'ppsh' || id === 'thompson' ? -0.5 : -0.46;
  B.loft(0, F, P, [[0.06, 0.022, 0.024, 0, by], [len + 0.15, 0.022, 0.024, 0, by]], 10, {axis: 'z', capA: true, capB: true});                         // cajón
  B.loft(0, F, P, [[len + 0.15, 0.011, 0.011, 0, by], [len, 0.01, 0.01, 0, by]], 10, {axis: 'z', capB: true});                                           // cañón
  if (id === 'ppsh') B.loft(0, F, P, [[-0.1, 0.03, 0.03, 0, by], [len + 0.02, 0.028, 0.028, 0, by]], 10, {axis: 'z', capB: true});                       // camisa perforada
  if (id === 'ppsh' || id === 'thompson') B.loft(0, F, VMC.madera, [[0.36, 0.022, 0.07, 0, -0.05], [0.12, 0.02, 0.05, 0, -0.02], [0.02, 0.02, 0.03, 0, 0.0], [-0.12, 0.024, 0.03, 0, 0.0], [-0.2, 0.022, 0.026, 0, 0.01]], 10, {axis: 'z', capA: true, capB: true, p: 2.6});
  else if (id === 'mp40') { B.tube(0, F, P, [0, -0.02, 0.06], [0, 0.0, 0.32], [[0, 0.007], [1, 0.007]], 5); B.tube(0, F, P, [0, 0.02, 0.06], [0, 0.0, 0.32], [[0, 0.007], [1, 0.007]], 5); B.box(0, F, P, [0, 0.0, 0.33], [0.04, 0.09, 0.02]); B.box(0, F, 0x2a2018, [0, -0.06, 0.0], [0.03, 0.09, 0.04], {rot: [12, 0, 0]}); }
  else { B.tube(0, F, P, [0, -0.02, 0.06], [0, -0.01, 0.32], [[0, 0.008], [1, 0.008]], 5); B.box(0, F, P, [0, -0.01, 0.33], [0.03, 0.07, 0.02]); }   // Sten: culata de tubo
  B.tube(0, F, P, [0, -0.02, 0.03], [0, -0.06, -0.04], [[0, 0.004], [1, 0.004]], 4); B.box(0, F, P, [0, -0.045, -0.01], [0.004, 0.03, 0.006]);
  B.box(0, F, P, [0, by + 0.028, len + 0.03], [0.004, 0.012, 0.01]); B.box(0, F, P, [0, by + 0.03, 0.02], [0.02, 0.014, 0.01]);
  const m = new GeoBuilder();
  if (A.cargador === 'tambor') m.loft(0, F, P, [[-0.022, 0.07, 0.07], [0.022, 0.07, 0.07]], 14, {axis: 'x', at: [0, -0.07, 0], capA: true, capB: true});
  else if (A.cargador === 'izquierda') m.box(0, F, P, [-0.11, 0, 0], [0.2, 0.03, 0.035]);
  else m.box(0, F, P, [0, -0.11, 0], [0.026, 0.2, 0.036], {taper: 0.05});
  out.cargador = {g: m, at: [A.cargador === 'izquierda' ? -0.02 : 0, by - 0.02, -0.08]};
  const c = new GeoBuilder(); c.box(0, F, 0x8a8c90, [0.02, 0, 0], [0.025, 0.01, 0.012]); out.cerrojo = {g: c, at: [0.02, by, -0.02]};
  const s = {id, acc: 'subfusil', L: len, bore: by, butt: 0.33, sight: {rear: [0, by + 0.037, 0.02], front: [0, by + 0.034, len + 0.03]},
    grips: {empunadura: {p: [0, 0, 0], r: [0, 0, 0]}, guardamanos: {p: [0, A.cargador === 'abajo' ? -0.03 : by - 0.03, A.cargador === 'abajo' ? -0.08 : -0.24], r: [0, 0, 0]}, cerrojo: {p: [0.045, by, -0.02], r: [0, 0, 0]}, cargador: {p: A.cargador === 'izquierda' ? [-0.15, by, -0.08] : [0, -0.13, -0.08], r: [0, 0, 0]}}};
  return {body: B, moving: out, spec: s};
}
function vmBuildPistol() {
  const B = new GeoBuilder(), F = Z.FIX, P = VMC.pavon, out = {};
  B.box(0, F, 0x2a2018, [0, -0.045, 0.012], [0.028, 0.1, 0.04], {rot: [14, 0, 0]}); B.box(0, F, P, [0, 0.015, -0.06], [0.026, 0.03, 0.15]);
  B.tube(0, F, P, [0, -0.015, 0.0], [0, -0.03, -0.04], [[0, 0.004], [1, 0.004]], 4);
  const sl = new GeoBuilder(); sl.box(0, F, P, [0, 0, -0.06], [0.028, 0.026, 0.17]); sl.box(0, F, P, [0, 0.016, -0.14], [0.004, 0.008, 0.008]); out.cerrojo = {g: sl, at: [0, 0.035, 0]};
  const m = new GeoBuilder(); m.box(0, F, P, [0, -0.05, 0], [0.022, 0.1, 0.03]); out.cargador = {g: m, at: [0, -0.04, 0.014]};
  return {body: B, moving: out, spec: {id: 'pistola', acc: 'pistola', L: -0.16, bore: 0.035, butt: 0.0, sight: {rear: [0, 0.055, 0.02], front: [0, 0.056, -0.14]},
    grips: {empunadura: {p: [0, 0, 0], r: [0, 0, 0]}, guardamanos: {p: [-0.02, -0.04, 0.02], r: [0, 0, 0]}, cerrojo: {p: [0, 0.05, 0.0], r: [0, 0, 0]}, cargador: {p: [0, -0.12, 0.02], r: [0, 0, 0]}}}};
}
// mano derecha que empuña (marco: objeto a lo largo de z, palma en +x); izquierda = espejo. curl: 0 abierta … 1 cerrada
function vmBuildHand(curl, left, skin, cuff) {
  const B = new GeoBuilder(), F = Z.FIX, sk = skin, r = 0.024;
  B.loft(0, F, sk, [[0.075, 0.02, 0.042, 0.035, 0.0], [0.05, 0.022, 0.045, 0.035, -0.003], [0.03, 0.022, 0.046, 0.034, -0.005], [0.005, 0.02, 0.046, 0.032, -0.012], [-0.02, 0.016, 0.044, 0.03, -0.02]], 14, {axis: 'z', capA: true, capB: true, p: 2.4});   // palma (lado +x del objeto)
  const fingers = [[-0.012, 0.02], [-0.033, 0.021], [-0.053, 0.019], [-0.07, 0.016]];                                        // z de cada dedo, grosor
  fingers.forEach(([z, w], i) => {
    let p = [0.036, -0.012, z];                                                                                                  // nudillo: sale hacia −y y se curva hacia −x
    const segs = [0.042 - i * 0.003, 0.028, 0.022];
    segs.forEach((l, k) => { const th = Math.min(Math.PI, (k + 1) * curl * 1.05 + 0.15);                                    // ángulo desde −y hacia −x
      const q2 = [p[0] - l * Math.sin(th), p[1] - l * Math.cos(th), z]; B.tube(0, F, sk, p, q2, [[0, w * 0.5], [0.5, w * 0.53], [1, w * 0.45]], 10, {capB: k === 2, domeB: k === 2 ? w * 0.35 : 0}); p = q2; });
  });
  // pulgar: por encima del objeto hacia −x
  B.tube(0, F, sk, [0.03, 0.02, 0.05], [0.006, r + 0.016, 0.02], [[0, 0.013], [0.5, 0.0125], [1, 0.011]], 10); B.tube(0, F, sk, [0.006, r + 0.016, 0.02], [-0.022, r + 0.012, 0.0 - 0.012 * curl], [[0, 0.011], [0.5, 0.0105], [1, 0.009]], 10, {capB: true, domeB: 0.004});
  // muñeca y puño de la manga
  B.loft(0, F, sk, [[0.13, 0.026, 0.03, 0.055, -0.01], [0.1, 0.024, 0.033, 0.05, -0.006], [0.075, 0.024, 0.036, 0.045, -0.004]], 14, {axis: 'z'});
  B.loft(0, cuff ? Z.TRIM : Z.MAIN, 0, [[0.19, 0.04, 0.042, 0.062, -0.012], [0.15, 0.039, 0.041, 0.06, -0.012], [0.128, 0.035, 0.037, 0.056, -0.01], [0.125, 0.03, 0.032, 0.056, -0.01]], 16, {axis: 'z', capB: true});
  for (let i = 0; i < 4; i++) B.loft(0, F, VMC.latonO, [[0.166 + i * 0.0001, 0.006, 0.006, 0.062 + 0.041 * Math.cos(i * 0.5 - 0.7), -0.012 + 0.043 * Math.sin(i * 0.5 - 0.7)], [0.17, 0.006, 0.006, 0.062 + 0.041 * Math.cos(i * 0.5 - 0.7), -0.012 + 0.043 * Math.sin(i * 0.5 - 0.7)]], 6, {axis: 'z', capB: true});   // botones del puño
  if (left) { for (let i = 0; i < B.p.length; i += 3) B.p[i] = -B.p[i]; for (let i = 0; i < B.n.length; i += 3) B.n[i] = -B.n[i];
    for (let t = 0; t < B.p.length / 9; t++) { const o = t * 9; for (const arr of [B.p, B.n, B.col]) for (let k = 0; k < 3; k++) { const a = arr[o + 3 + k]; arr[o + 3 + k] = arr[o + 6 + k]; arr[o + 6 + k] = a; } } }
  return B;
}
// GeoBuilder → BufferGeometry con colores de la paleta (zonas) o del vértice (FIX)
function vmGeo(B, pal) {
  const n = B.p.length / 3, P = new Float32Array(B.p), N = new Float32Array(B.n), Co = new Float32Array(n * 3), c = new THREE.Color();
  const zc = {[Z.MAIN]: pal.main, [Z.TRIM]: pal.trim, [Z.ACC]: pal.accessory, [Z.HAT]: pal.hat};
  for (let i = 0; i < n; i++) { const z = B.zone[i]; if (zc[z]) { c.set(zc[z]); Co[i * 3] = c.r; Co[i * 3 + 1] = c.g; Co[i * 3 + 2] = c.b; } else { Co[i * 3] = B.col[i * 3]; Co[i * 3 + 1] = B.col[i * 3 + 1]; Co[i * 3 + 2] = B.col[i * 3 + 2]; } }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.BufferAttribute(N, 3)); g.setAttribute('color', new THREE.BufferAttribute(Co, 3)); g.computeBoundingSphere(); return g;
}
function vmArmGeo(len, r0, r1, zone) { const B = new GeoBuilder(), m = (r0 + r1) / 2;   // manga con pliegues (anillos alternos)
  const R = [[-len - 0.01, r1, r1 * 1.05]]; for (let i = 1; i < 8; i++) { const f = i / 8, r = r1 + (r0 - r1) * f + (i % 2 ? 0.003 : -0.002) + Math.sin(f * Math.PI) * m * 0.08; R.push([-len - 0.01 + (len + 0.03) * f, r, r * 1.06, (i % 3 - 1) * 0.002, 0]); } R.push([0.02, r0, r0 * 1.05]);
  B.loft(0, zone, 0, R, 16, {axis: 'z', capB: true, domeB: 0.02}); return B; }
// trozo de pecho visible al mirar abajo: guerrera, correaje y cartucheras según época (espacio del cuerpo: ojos en el origen)
function vmChest(era, eq) {
  const B = new GeoBuilder(), F = Z.FIX, AB = era === 'A' || era === 'B', bc = AB ? 0xe6e2d6 : eq === 'ger' ? 0x2e2620 : 0x8a7a50;
  B.loft(0, Z.MAIN, 0, [[-0.95, 0.17, 0.11, 0, 0.0], [-0.82, 0.175, 0.116, 0, 0.006], [-0.72, 0.18, 0.12, 0, 0.012], [-0.62, 0.183, 0.121, 0, 0.01], [-0.52, 0.185, 0.12, 0, 0.008], [-0.42, 0.17, 0.1, 0, -0.006], [-0.36, 0.1, 0.07, 0, -0.012], [-0.32, 0.06, 0.055]], 20, {at: [0, 0, 0.09], p: 3, a0: Math.PI / 10});
  const fz = y => 0.09 + (y > -0.6 ? 0.125 : 0.118);
  if (AB) [1, -1].forEach(s => B.strap(0, F, bc, [[-0.17 * s, -0.92, 0], [-0.06 * s, -0.7, 0], [0.08 * s, -0.5, 0], [0.16 * s, -0.4, 0]].map(q => [q[0], q[1], fz(q[1]) + 0.004 + (s > 0 ? 0.002 : 0)]), 0.05, [0, 0, 1]));
  else { [1, -1].forEach(s => { B.strap(0, F, bc, [[0.1 * s, -0.95, fz(-0.95) + 0.005], [0.11 * s, -0.7, fz(-0.7) + 0.006], [0.12 * s, -0.44, 0.17]], 0.035, [0, 0, 1]); B.box(0, F, bc, [0.1 * s, -0.9, fz(-0.9) + 0.03], [0.07, 0.085, 0.045], {bottom: true}); }); }
  for (let i = 0; i < 4; i++) { const y = -0.88 + i * 0.12, z = fz(y) + 0.006, r = 0.011; B.quad([-r, y - r, z], [r, y - r, z], [r, y + r, z], [-r, y + r, z], 0, F, era >= 'D' ? 0x6a6040 : 0xc8a650); }
  B.loft(0, era < 'E' ? Z.TRIM : Z.MAIN, 0, [[-0.34, 0.07, 0.068, 0, 0.0], [-0.27, 0.066, 0.064, 0, 0.004]], 8, {at: [0, 0, 0.09]});
  return B;
}
// accesorios: cartucho de papel, cartucho metálico, peine, clip en bloque, granada (palo o huevo), venda
function vmProps(era, nation, arm) {
  const F = Z.FIX, P = {};
  const cart = new GeoBuilder(); if (arm.acc === 'avancarga') cart.loft(0, F, VMC.papel, [[-0.035, 0.008, 0.008], [0.035, 0.009, 0.009], [0.045, 0.006, 0.006]], 6, {axis: 'z', capA: true, capB: true});
  else { cart.loft(0, F, VMC.laton, [[0.0, 0.0065, 0.0065], [0.055, 0.0065, 0.0065]], 6, {axis: 'z', capA: true}); cart.loft(0, F, VMC.cobre, [[-0.025, 0.0042, 0.0042], [0.0, 0.0055, 0.0055]], 6, {axis: 'z', capA: true, domeA: -0.008}); }
  P.cartucho = cart;
  const pe = new GeoBuilder(); for (let i = 0; i < 5; i++) { pe.loft(0, F, VMC.laton, [[-0.03, 0.0062, 0.0062, 0.0, -0.022 + i * 0.011], [0.026, 0.0062, 0.0062, 0.0, -0.022 + i * 0.011]], 6, {axis: 'z', capA: true}); pe.loft(0, F, VMC.cobre, [[-0.052, 0.0035, 0.0035, 0, -0.022 + i * 0.011], [-0.03, 0.0055, 0.0055, 0, -0.022 + i * 0.011]], 5, {axis: 'z', capA: true}); }
  pe.box(0, F, 0x6a6c70, [0, 0, 0.03], [0.008, 0.062, 0.006]); P.peine = pe;
  const gr = new GeoBuilder();
  if (nation === 'GER' || nation === 'PRU' || nation === 'AUS') { gr.loft(0, F, VMC.madera, [[-0.2, 0.013, 0.013], [0.0, 0.014, 0.014]], 6, {axis: 'z', capA: true}); gr.loft(0, F, 0x4a5040, [[0.0, 0.032, 0.032], [0.075, 0.032, 0.032]], 10, {axis: 'z', capA: true, capB: true}); }   // granada de mango M24
  else { gr.loft(0, F, nation === 'SOV' || nation === 'RUS' ? 0x4e5a40 : 0x5a6040, [[-0.045, 0.012, 0.012], [-0.035, 0.03, 0.03], [0.0, 0.034, 0.034], [0.035, 0.03, 0.03], [0.045, 0.01, 0.01]], 10, {axis: 'z', capA: true, capB: true}); gr.box(0, F, 0x8a8c80, [0.025, 0.0, -0.02], [0.012, 0.012, 0.06]); }   // Mills / Mk 2 / F1
  P.granada = gr;
  const v = new GeoBuilder(); v.loft(0, F, 0xece6d6, [[-0.04, 0.03, 0.03], [0.04, 0.03, 0.03]], 10, {axis: 'x', capA: true, capB: true}); v.strap(0, F, 0xece6d6, [[0.0, -0.03, 0.0], [0.0, -0.1, 0.03], [0.02, -0.18, 0.02]], 0.06, [0, 0, 1]); P.venda = v;
  return P;
}

/* ---------- poses y clips del viewmodel ----------
   Espacio de cámara (m): x derecha, y arriba, −z delante. Arma: origen en la empuñadura (muñeca de la culata), boca hacia −z.
   Pistas: arma [t, x,y,z, rx,ry,rz] · manoDe/manoIz [t, espacio, x,y,z, rx,ry,rz, cierre] (espacio: 'cam' | 'arma' | pieza móvil) ·
   cerrojo [t, x,y,z, rx,ry,rz] · martillo/bateria/palanca [t, rx] · baqueta [t, x,y,z, rx,ry,rz] (espacio del arma) ·
   cargador y accesorios [t, espacio, x,y,z, rx,ry,rz, visible] · cam [t, rx,ry,rz, fov×] · ev [[t, nombre]] */
function vmPoses(s) {
  const r = s.sight.rear, f = s.sight.front, pitch = Math.atan2(f[1] - r[1], r[2] - f[2]) / D2R;
  const ads = [-r[0], -r[1] - 0.004, -0.13 - r[2], -pitch, 0, 0];
  const pist = s.acc === 'pistola', smg = s.acc === 'subfusil';
  return {
    bajo: pist ? [0.12, -0.2, -0.3, -18, 6, 4] : [0.15, -0.205, -0.3, -7, 4, 9],
    cadera: pist ? [0.1, -0.13, -0.32, 0, 3, 2] : [0.12, -0.16, -0.29, -1, 2, 5],
    ads: pist ? [0, -0.055, -0.36, 0, 0, 0] : ads,
    carrera: pist ? [0.14, -0.32, -0.22, -50, 10, 10] : [0.03, -0.3, -0.3, 30, 42, 38],
    carga: [0.02, -1.2, -0.4, 84, 12, -6],                                                              // avancarga: culata abajo, boca arriba y delante
    cerrojo: pist || smg ? [0.02, -0.16, -0.32, 8, 22, -30] : [-0.01, -0.17, -0.33, 6, 24, -34],          // mecanismo girado hacia la vista
    tumbado: pist ? [0.08, -0.12, -0.3, 0, 2, 2] : [0.1, -0.15, -0.24, -2, 2, 3],
    fuera: [0.2, -0.75, 0.0, -50, 10, 30]                                                                 // fuera de la vista (curar, muerte)
  };
}
const vmG = (s, side, curl, extra) => side === 'De' ? ['arma', 0, 0, 0, 0, 0, 0, curl == null ? 0.92 : curl] : ['arma'].concat(s.grips.guardamanos.p, extra || [0, 0, 80], [curl == null ? 0.78 : curl]);
const K = (t, a) => [t].concat(a);
function vmClipSet(s, era, nation) {
  const P = vmPoses(s), C = {}, mk2 = (dur, loop, tracks, ev, o) => Object.assign({dur, loop, tracks, ev: ev || []}, o || {});
  const GR = vmG(s, 'De'), GL = vmG(s, 'Iz'), pist = s.acc === 'pistola';
  const GLp = pist ? ['manoDe', -0.025, -0.035, 0.0, 0, 0, -20, 0.85] : GL;                               // pistola a dos manos: la izquierda envuelve a la derecha
  const hold = (pose, dur, amp, extra) => mk2(dur, true, Object.assign({arma: [0, 0.25, 0.5, 0.75, 1].map((t, i) => K(t, [pose[0] + amp * 0.3 * Math.sin(i * Math.PI / 2), pose[1] + amp * Math.sin(i * Math.PI), pose[2], pose[3] + amp * 60 * Math.sin(i * Math.PI), pose[4] + amp * 40 * Math.sin(i * Math.PI / 2), pose[5]])),
    manoDe: [K(0, GR)], manoIz: [K(0, GLp)]}, extra || {}));
  // reposo, marcha y carrera (balanceo en ocho por paso; el arma retrasa el movimiento de la cámara)
  C.idle_vm = hold(P.bajo, 4.0, 0.004);
  const bob = (pose, dur, ax, ay, rot) => mk2(dur, true, {arma: Array.from({length: 9}, (_, i) => { const t = i / 8, a = t * Math.PI * 2; return K(t, [pose[0] + ax * Math.sin(a), pose[1] - ay * Math.abs(Math.cos(a)), pose[2] + ay * 0.3 * Math.sin(2 * a), pose[3] + rot * Math.cos(2 * a), pose[4] + rot * 0.6 * Math.sin(a), pose[5] + rot * 0.8 * Math.sin(a)]); }),
    manoDe: [K(0, GR)], manoIz: [K(0, GLp)], cam: Array.from({length: 9}, (_, i) => { const a = i / 8 * Math.PI * 2; return K(i / 8, [0.4 * Math.cos(2 * a), 0, 0.3 * Math.sin(a), 1]); })}, [[0, 'paso'], [0.5, 'paso']]);
  C.marcha_vm = bob(P.bajo, 1.05, 0.012, 0.014, 1.4);
  C.carrera_vm = bob(P.carrera, 0.66, 0.03, 0.03, 3.5);
  // apuntar (cadera) y ADS: entrada, mantener y salida
  const tr2 = (a, b, dur, ev, fov) => mk2(dur, false, {arma: [K(0, a), K(0.55, [b[0] + (a[0] - b[0]) * 0.06, b[1] + (a[1] - b[1]) * 0.06, b[2], b[3], b[4], b[5]]), K(1, b)], manoDe: [K(0, GR)], manoIz: [K(0, GLp)],
    cam: fov ? [K(0, [0, 0, 0, fov[0]]), K(1, [0, 0, 0, fov[1]])] : undefined}, ev);
  C.apuntar_entrada = tr2(P.bajo, P.cadera, 0.25); C.apuntar_vm = hold(P.cadera, 3.5, 0.0025); C.apuntar_salida = tr2(P.cadera, P.bajo, 0.3);
  C.ads_entrada = tr2(P.cadera, P.ads, 0.22, [], [1, 0.78]); C.ads_vm = hold(P.ads, 3.6, 0.0012, {cam: [K(0, [0, 0, 0, 0.78])]}); C.ads_salida = tr2(P.ads, P.cadera, 0.22, [], [0.78, 1]);
  Object.keys(C).forEach(k => { if (C[k].tracks.cam === undefined) delete C[k].tracks.cam; });
  // disparo: patada (atrás y arriba), vuelta con un rebote; las armas de cerrojo encadenan el ciclo del cerrojo
  const kick = (pose, big) => { const k = big ? 1 : 0.55;
    return [K(0, pose), K(0.04, [pose[0] + 0.004 * k, pose[1] + 0.012 * k, pose[2] + 0.06 * k, pose[3] + 7 * k, pose[4] - 1.5 * k, pose[5] + 2 * k]), K(0.16, [pose[0], pose[1] + 0.004 * k, pose[2] + 0.015 * k, pose[3] + 1.5 * k, pose[4], pose[5]]), K(0.3, [pose[0], pose[1] - 0.002, pose[2] - 0.004, pose[3] - 0.6, pose[4], pose[5]]), K(0.45, pose)]; };
  const camKick = big => [K(0, [0, 0, 0, 1]), K(0.035, [big ? 2.4 : 1.2, big ? -0.4 : 0, big ? 0.6 : 0.2, 1.02]), K(0.25, [0.2, 0, 0, 1]), K(0.45, [0, 0, 0, 1])];
  const big = s.acc === 'avancarga' || s.acc === 'cerrojo_simple' || s.acc === 'trampilla' || s.acc === 'palanca';
  const shot = (pose, ads) => { const auto = s.acc === 'subfusil';
    const c = mk2(auto ? 0.12 : 0.45, auto, {arma: auto ? [K(0, pose), K(0.3, [pose[0], pose[1] + 0.006, pose[2] + 0.025, pose[3] + 2.4, pose[4] + 0.6, pose[5]]), K(1, pose)] : kick(pose, big).map(k => [k[0] / 0.45].concat(k.slice(1))),
      manoDe: [K(0, GR)], manoIz: [K(0, GLp)], cam: auto ? [K(0, [0, 0, 0, ads ? 0.78 : 1]), K(0.3, [0.5, 0.1, 0, ads ? 0.78 : 1]), K(1, [0, 0, 0, ads ? 0.78 : 1])] : camKick(big).map(k => [k[0] / 0.45, k[1], k[2], k[3], k[4] * (ads ? 0.78 : 1)])},
      auto ? [[0, 'fuego'], [0.3, 'casquillo']] : [[0, 'fuego']].concat(s.acc === 'avancarga' ? [[0.02, 'humo']] : []));
    if (s.acc === 'avancarga' && s.ign === 'chispa') c.tracks.martillo = [K(0, [0]), K(0.03, [-38]), K(1, [-38])], c.tracks.bateria = [K(0, [0]), K(0.03, [-70]), K(1, [-70])];
    if (s.acc === 'avancarga' && s.ign !== 'chispa') c.tracks.martillo = [K(0, [0]), K(0.03, [-34]), K(1, [-34])];
    if (s.acc === 'pistola') c.tracks.cerrojo = [K(0, [0, 0, 0, 0, 0, 0]), K(0.06, [0, 0, 0.05, 0, 0, 0]), K(0.2, [0, 0, 0, 0, 0, 0]), K(1, [0, 0, 0, 0, 0, 0])], c.ev.push([0.06, 'casquillo']);
    if (s.acc === 'semi_enbloc' || s.acc === 'semi_cargador') c.tracks.cerrojo = [K(0, [0, 0, 0, 0, 0, 0]), K(0.05, [0, 0, 0.09, 0, 0, 0]), K(0.16, [0, 0, 0, 0, 0, 0]), K(1, [0, 0, 0, 0, 0, 0])], c.ev.push([0.05, 'casquillo']);
    return c; };
  C.disparar_vm = shot(P.cadera, false); C.disparar_ads_vm = shot(P.ads, true);
  // ciclo del cerrojo (cerrojo_simple / tubo / peine): la mano derecha deja la empuñadura, gira la manilla, tira, empuja y baja
  const boltCycle = (t0, d, pose) => {   // devuelve claves para arma/manoDe/cerrojo en [t0, t0+d] (fracciones del clip)
    const T = f => t0 + f * d, sock = s.grips.cerrojo.p, bolt = s.acc.startsWith('cerrojo');
    return {arma: [K(T(0), pose), K(T(0.15), P.cerrojo), K(T(0.85), P.cerrojo), K(T(1), pose)],
      manoDe: [K(T(0), GR), K(T(0.12), ['cerrojo', 0.075, -0.02, 0.078, 0, 0, 30, 0.6]), K(T(0.88), ['cerrojo', 0.075, -0.02, 0.078, 0, 0, 30, 0.6]), K(T(1), GR)],
      cerrojo: bolt ? [K(T(0), [0, 0, 0, 0, 0, 0]), K(T(0.18), [0, 0, 0, 0, 0, 0]), K(T(0.32), [0, 0, 0, 0, 0, 62]), K(T(0.5), [0, 0, 0.1, 0, 0, 62]), K(T(0.68), [0, 0, 0, 0, 0, 62]), K(T(0.82), [0, 0, 0, 0, 0, 0]), K(T(1), [0, 0, 0, 0, 0, 0])] : null,
      ev: bolt ? [[T(0.32), 'cerrojo'], [T(0.5), 'casquillo'], [T(0.8), 'cerrojo']] : [], sock};
  };
  const bolted = s.acc === 'cerrojo_peine' || s.acc === 'cerrojo_tubo';
  if (bolted) {
    const b = boltCycle(0, 1, P.cadera); C.cerrojo_vm = mk2(1.0, false, {arma: b.arma, manoDe: b.manoDe, manoIz: [K(0, GL)], cerrojo: b.cerrojo}, b.ev);
    ['disparar_vm', 'disparar_ads_vm'].forEach((k, j) => {                                       // disparo + cerrojo (1,4 s)
      const c = C[k], pose = j ? P.ads : P.cadera, D = 1.45, f = 0.45 / D, b2 = boltCycle(0.36, 0.64, pose);
      c.dur = D; c.tracks.arma = c.tracks.arma.map(q => [q[0] * f].concat(q.slice(1))).concat(b2.arma.slice(1)); c.tracks.cam = c.tracks.cam.map(q => [q[0] * f].concat(q.slice(1))).concat([K(1, [0, 0, 0, j ? 0.78 : 1])]);
      c.tracks.manoDe = [K(0, GR)].concat(b2.manoDe); c.tracks.cerrojo = [K(0, [0, 0, 0, 0, 0, 0])].concat(b2.cerrojo); c.ev = c.ev.concat(b2.ev); });
  }
  // ---- recargas por mecanismo
  const R = recargaVM(s, P, GR, GL, GLp, era, nation); Object.assign(C, R);
  C.recargar_vm = R.recargar_vm;
  // ---- posturas: el arma baja y vuelve mientras la cámara cambia de altura (la altura la pone el juego)
  const dip = (dur, depth, roll, ev) => mk2(dur, false, {arma: [K(0, P.bajo), K(0.35, [P.bajo[0] + 0.02, P.bajo[1] - depth, P.bajo[2] + 0.03, P.bajo[3] - 8, P.bajo[4], P.bajo[5] + roll]), K(1, P.bajo)], manoDe: [K(0, GR)], manoIz: [K(0, GLp)],
    cam: [K(0, [0, 0, 0, 1]), K(0.4, [-2, 0, roll * 0.15, 1]), K(1, [0, 0, 0, 1])]}, ev);
  C.agacharse_vm = dip(0.45, 0.05, 6, [[0.35, 'postura']]); C.rodilla_vm = dip(0.6, 0.08, 10, [[0.5, 'rodilla']]);
  C.tumbado_vm = mk2(1.1, false, {arma: [K(0, P.bajo), K(0.3, [0.12, -0.42, 0.0, -30, 10, 30]), K(0.7, [0.1, -0.2, -0.02, -6, 4, 6]), K(1, P.tumbado)], manoDe: [K(0, GR)], manoIz: [K(0, GLp), K(0.35, ['cam', -0.2, -0.42, -0.25, 0, 0, 0, 0.3]), K(0.65, ['cam', -0.2, -0.42, -0.25, 0, 0, 0, 0.3]), K(1, GLp)],
    cam: [K(0, [0, 0, 0, 1]), K(0.5, [-6, 0, 4, 1]), K(1, [0, 0, 0, 1])]}, [[0.5, 'tumbado']]);
  C.tumbado_idle_vm = hold(P.tumbado, 4.0, 0.002);
  // cuerpo a cuerpo
  if (!pist) {
    C.golpe_culata_vm = mk2(0.85, false, {arma: [K(0, P.bajo), K(0.25, [0.22, -0.18, 0.05, 30, 70, 60]), K(0.42, [0.0, -0.08, -0.32, -40, 80, 70]), K(0.55, [0.02, -0.12, -0.25, -30, 75, 65]), K(1, P.bajo)],
      manoDe: [K(0, GR)], manoIz: [K(0, GL)], cam: [K(0, [0, 0, 0, 1]), K(0.4, [1, 6, -2, 1]), K(0.45, [3, 2, 0, 1]), K(1, [0, 0, 0, 1])]}, [[0.42, 'golpe']]);
    if (s.bay) C.bayoneta_vm = mk2(0.75, false, {arma: [K(0, P.bajo), K(0.22, [0.12, -0.2, 0.12, -4, 4, 8]), K(0.36, [0.06, -0.16, -0.36, -2, 2, 4]), K(0.5, [0.07, -0.17, -0.3, -2, 2, 4]), K(1, P.bajo)],
      manoDe: [K(0, GR)], manoIz: [K(0, GL)], cam: [K(0, [0, 0, 0, 1]), K(0.36, [-1, 0, 0, 0.97]), K(1, [0, 0, 0, 1])]}, [[0.34, 'bayoneta']]);
  }
  // granada (D y E): la izquierda baja el fusil, la derecha saca, tira de la anilla / del cordón y lanza
  if (era >= 'D') {
    const low = [-0.12, -0.42, -0.14, -40, -30, 40];
    C.lanzar_granada_vm = mk2(1.9, false, {arma: [K(0, P.bajo), K(0.15, low), K(0.85, low), K(1, P.bajo)],
      manoIz: [K(0, GL), K(0.13, GL), K(0.86, GL), K(1, GL)],
      manoDe: [K(0, GR), K(0.12, ['cam', 0.24, -0.55, 0.05, -60, 0, 0, 0.9]), K(0.3, ['cam', 0.16, -0.28, -0.25, -20, 0, 20, 0.95]), K(0.42, ['cam', 0.02, -0.22, -0.32, 0, 0, 0, 0.95]),
        K(0.58, ['cam', 0.3, 0.05, 0.12, 60, 20, 0, 0.95]), K(0.7, ['cam', 0.12, 0.08, -0.45, -40, 0, 0, 0.95]), K(0.76, ['cam', 0.06, -0.05, -0.55, -60, 0, 0, 0.2]), K(0.9, ['cam', 0.25, -0.5, -0.2, -40, 0, 0, 0.6]), K(1, GR)],
      granada: [K(0, ['manoDe', 0.02, -0.01, 0.0, 0, 0, 0, 0]), K(0.14, ['manoDe', 0.02, -0.01, 0.0, 90, 0, 0, 1]), K(0.72, ['manoDe', 0.02, -0.01, 0.0, 90, 0, 0, 1]), K(0.74, ['cam', 0.0, 0.0, -1.4, 40, 0, 0, 1]), K(0.8, ['cam', -0.02, 0.4, -4.0, 200, 0, 0, 0]), K(1, ['cam', 0, 0, -4, 0, 0, 0, 0])],
      cam: [K(0, [0, 0, 0, 1]), K(0.58, [3, 4, 0, 1]), K(0.72, [-3, -2, 0, 1]), K(1, [0, 0, 0, 1])]}, [[0.14, 'granada_saca'], [0.42, 'anilla'], [0.73, 'lanzar']]);
  }
  // curar (venda), herido, muerte, inspeccionar, salto de obstáculo
  C.curar_vm = mk2(3.4, false, {arma: [K(0, P.bajo), K(0.12, P.fuera), K(0.88, P.fuera), K(1, P.bajo)],
    manoDe: [K(0, GR), K(0.14, ['cam', 0.12, -0.36, -0.3, -30, 0, 20, 0.6]), K(0.3, ['cam', -0.02, -0.4, -0.32, -40, 30, 50, 0.6]), K(0.45, ['cam', 0.1, -0.44, -0.28, -30, -20, 20, 0.6]), K(0.6, ['cam', -0.02, -0.4, -0.32, -40, 30, 50, 0.6]), K(0.75, ['cam', 0.1, -0.44, -0.28, -30, -20, 20, 0.6]), K(0.86, ['cam', 0.12, -0.36, -0.3, -30, 0, 20, 0.6]), K(1, GR)],
    manoIz: [K(0, GL), K(0.14, ['cam', -0.1, -0.42, -0.3, -50, 0, -40, 0.4]), K(0.86, ['cam', -0.1, -0.42, -0.3, -50, 0, -40, 0.4]), K(1, GL)],
    venda: [K(0, ['manoDe', 0.0, -0.02, -0.04, 0, 0, 0, 0]), K(0.15, ['manoDe', 0.0, -0.02, -0.04, 0, 0, 0, 1]), K(0.84, ['manoDe', 0.0, -0.02, -0.04, 0, 0, 0, 1]), K(0.86, ['manoDe', 0, 0, 0, 0, 0, 0, 0])],
    cam: [K(0, [0, 0, 0, 1]), K(0.15, [-24, 0, 0, 1]), K(0.85, [-24, 0, 0, 1]), K(1, [0, 0, 0, 1])]}, [[0.15, 'venda'], [0.5, 'curar'], [0.85, 'curado']]);
  C.herido_vm = mk2(1.3, false, {arma: [K(0, P.bajo), K(0.08, [P.bajo[0] + 0.05, P.bajo[1] - 0.12, P.bajo[2] + 0.04, -24, 10, 30]), K(0.6, [P.bajo[0] + 0.04, P.bajo[1] - 0.1, P.bajo[2] + 0.03, -20, 8, 26]), K(1, P.bajo)],
    manoDe: [K(0, GR)], manoIz: [K(0, GL), K(0.1, ['cam', -0.16, -0.48, -0.08, -60, 0, -30, 0.95]), K(0.7, ['cam', -0.15, -0.46, -0.1, -60, 0, -30, 0.95]), K(1, GL)],
    cam: [K(0, [0, 0, 0, 1]), K(0.06, [-8, 3, -6, 1.03]), K(0.4, [-5, 1, -3, 1]), K(1, [0, 0, 0, 1])]}, [[0, 'impacto'], [0.1, 'agarra_herida']]);
  C.muerte_vm = mk2(2.0, false, {arma: [K(0, P.bajo), K(0.15, [0.18, -0.4, -0.05, -40, 20, 50]), K(0.4, [0.3, -1.2, -0.2, -90, 40, 120]), K(1, [0.3, -1.4, -0.2, -90, 40, 120])],
    manoDe: [K(0, GR), K(0.12, ['cam', 0.25, -0.5, -0.1, -40, 0, 0, 0.3]), K(0.5, ['cam', 0.3, -1.1, 0.0, -60, 0, 0, 0.1]), K(1, ['cam', 0.3, -1.2, 0.0, -60, 0, 0, 0.1])],
    manoIz: [K(0, GL), K(0.15, ['cam', -0.2, -0.6, -0.1, -40, 0, 0, 0.2]), K(1, ['cam', -0.3, -1.2, 0.0, -40, 0, 0, 0.1])],
    cam: [K(0, [0, 0, 0, 1]), K(0.1, [-6, 4, -8, 1.04]), K(0.55, [-35, 10, -50, 1.08]), K(0.75, [-60, 14, -78, 1.1]), K(0.8, [-55, 14, -74, 1.1]), K(1, [-58, 14, -76, 1.1])]},
    [[0, 'impacto'], [0.12, 'soltar_arma'], [0.75, 'suelo']], {final: true});
  C.inspeccionar_vm = mk2(3.2, false, {arma: [K(0, P.bajo), K(0.2, [0.05, -0.16, -0.14, 10, -40, -70]), K(0.5, [0.04, -0.15, -0.16, 12, -50, -80]), K(0.7, [0.08, -0.2, -0.1, -10, 30, 20]), K(1, P.bajo)], manoDe: [K(0, GR)], manoIz: [K(0, GL)]}, [[0.2, 'inspeccionar']]);
  C.salto_obstaculo_vm = mk2(0.9, false, {arma: [K(0, P.bajo), K(0.2, [-0.05, -0.12, -0.12, 20, -20, 60]), K(0.55, [-0.06, -0.1, -0.14, 25, -25, 65]), K(0.8, [0.12, -0.3, -0.06, -14, 8, 18]), K(1, P.bajo)],
    manoDe: [K(0, GR)], manoIz: [K(0, GL), K(0.15, ['cam', -0.3, -0.5, -0.45, -80, 0, 0, 0.2]), K(0.6, ['cam', -0.3, -0.62, -0.35, -80, 0, 0, 0.2]), K(0.85, GL), K(1, GL)],
    cam: [K(0, [0, 0, 0, 1]), K(0.3, [-14, 0, 3, 1]), K(0.6, [-6, 0, -2, 1]), K(0.8, [4, 0, 0, 1]), K(1, [0, 0, 0, 1])]}, [[0.25, 'salto'], [0.75, 'aterriza']]);
  if (pist) Object.keys(C).forEach(k => { const c = C[k]; if (c.tracks.manoIz && c.tracks.manoIz.length === 1) c.tracks.manoIz = [K(0, GLp)]; });
  return C;
}
// recargas: una secuencia por mecanismo con eventos en el instante del gesto
function recargaVM(s, P, GR, GL, GLp, era, nation) {
  const C = {}, mk2 = (dur, tracks, ev) => ({dur, loop: false, tracks, ev}), z0 = [0, 0, 0, 0, 0, 0];
  const pouch = ['cam', 0.26, -0.6, -0.05, -70, 0, 20, 0.5], mouth = ['cam', 0.05, -0.17, -0.24, -80, 0, 70, 0.95];
  if (s.acc === 'avancarga') {   // morder, (cebar), verter, baqueta (sacar, girar, atacar dos veces, devolver), (pistón), montar
    const chispa = s.ign === 'chispa', D = chispa ? 8.4 : 7.6, L = s.L, by = s.bore, bq = (z, rx) => [0, 0, z, rx || 0, 0, 0];
    const lowH = [0.06, -0.28, -0.18, -6, 0, 50];                                                    // horizontal a la cintura para cebar
    const t = chispa ? {cebar0: 0.12, cebar1: 0.22, vert: 0.3, verter: 0.36, bq0: 0.42, at1: 0.56, at2: 0.62, bq1: 0.74, mont: 0.86} : {cebar0: 0, cebar1: 0, vert: 0.12, verter: 0.22, bq0: 0.3, at1: 0.46, at2: 0.52, bq1: 0.64, pist0: 0.72, pist1: 0.8, mont: 0.88};
    const boca = s.grips.boca.p, mz = [boca[0] + 0.03, boca[1] + 0.06, boca[2]], S = t.bq1 - t.bq0, F = f => t.bq0 + f * S;
    const arma = [K(0, P.bajo), K(0.05, chispa ? lowH : P.carga)].concat(chispa ? [K(t.cebar1, lowH), K(t.vert, P.carga)] : []).concat([K(t.bq1, P.carga), K(t.pist1 || t.bq1 + 0.04, t.pist0 ? [0.05, -0.3, -0.2, 20, 10, 40] : P.carga), K(t.mont, P.cadera), K(1, P.bajo)]);
    const md = [K(0, GR), K(0.04, pouch), K(0.08, mouth), K(0.1, mouth)];
    if (chispa) md.push(K(t.cebar0, ['arma', 0.06, by + 0.04, -0.03, 0, 0, 90, 0.95]), K(t.cebar1 - 0.03, ['arma', 0.05, by + 0.05, -0.05, 0, 0, 90, 0.95]));
    md.push(K(t.vert + 0.02, ['arma', mz[0], mz[1], mz[2] + 0.02, -90, 0, 0, 0.95]), K(t.verter, ['arma', mz[0], mz[1], mz[2], -90, 0, 0, 0.95]),
      K(F(-0.04), ['baqueta', 0.0, -0.012, -0.9, 0, 0, 0, 0.95]), K(F(0.12), ['baqueta', 0.0, -0.012, -0.9, 0, 0, 0, 0.95]), K(F(0.2), ['baqueta', 0.0, -0.012, -0.485, 0, 0, 0, 0.95]), K(F(0.28), ['baqueta', 0.0, -0.012, -0.485, 0, 0, 0, 0.95]), K(F(0.36), ['baqueta', 0.0, -0.012, -0.04, 0, 0, 0, 0.95]),
      K(F(0.58), ['baqueta', 0.0, -0.012, -0.04, 0, 0, 0, 0.95]), K(F(0.66), ['baqueta', 0.0, -0.012, -0.485, 0, 0, 0, 0.95]), K(F(0.74), ['baqueta', 0.0, -0.012, -0.485, 0, 0, 0, 0.95]), K(F(0.82), ['baqueta', 0.0, -0.012, -0.9, 0, 0, 0, 0.95]), K(F(0.94), ['baqueta', 0.0, -0.012, -0.9, 0, 0, 0, 0.95]), K(F(0.98), ['arma', 0.02, by - 0.06, L + 0.3, 0, 0, 40, 0.9]));
    if (t.pist0) md.push(K(t.pist0, pouch), K(t.pist1, ['arma', 0.035, by + 0.03, -0.03, 0, 0, 70, 0.95]));
    md.push(K(t.mont - 0.02, ['arma', 0.03, by + 0.04, 0.08, 0, 0, 60, 0.9]), K(t.mont + 0.04, GR), K(1, GR));
    // baqueta: sale de los abrazaderas, se gira y entra por la boca (eje del ánima), ataca dos veces y vuelve
    const up = L - 0.99, out = -1.0;
    const baq = [K(0, bq(0)), K(F(0), bq(0)), K(F(0.12), bq(-1.0)), K(F(0.2), [0, -0.485, -1.485, 90, 0, 0]), K(F(0.28), [0, 0.024, -1.97, 180, 0, 0]), K(F(0.36), [0, 0.024, -1.32, 180, 0, 0]),
      K(t.at1, [0, 0.024, -1.08, 180, 0, 0]), K(F(0.5), [0, 0.024, -1.25, 180, 0, 0]), K(t.at2, [0, 0.024, -1.08, 180, 0, 0]), K(F(0.66), [0, 0.024, -1.97, 180, 0, 0]), K(F(0.74), [0, -0.485, -1.485, 90, 0, 0]), K(F(0.82), bq(-1.0)), K(F(0.94), bq(0)), K(1, bq(0))];
    void up;
    const tr = {arma, manoDe: md, manoIz: [K(0, GL), K(0.05, ['arma', s.grips.guardamanos.p[0], s.grips.guardamanos.p[1], s.grips.guardamanos.p[2] + 0.12, 0, 0, 80, 0.85]), K(t.mont, ['arma', s.grips.guardamanos.p[0], s.grips.guardamanos.p[1], s.grips.guardamanos.p[2] + 0.12, 0, 0, 80, 0.85]), K(1, GL)],
      baqueta: baq, martillo: [K(0, [-38]), K(0.06, [-20]), K(t.mont - 0.03, [-20]), K(t.mont, [0]), K(1, [0])],
      cartucho: [K(0, ['manoDe', 0, 0, 0, 0, 0, 0, 0]), K(0.04, ['manoDe', 0.0, -0.02, 0.0, 0, 0, 90, 1]), K(t.verter + 0.02, ['manoDe', 0.0, -0.02, 0.0, 0, 0, 90, 1]), K(t.verter + 0.03, ['manoDe', 0, 0, 0, 0, 0, 0, 0]), K(1, ['manoDe', 0, 0, 0, 0, 0, 0, 0])],
      cam: [K(0, [0, 0, 0, 1]), K(0.08, [-6, 0, 0, 1]), K(0.12, [-10, 0, 0, 1]), K(0.3, [-4, 0, 0, 1]), K(0.5, [2, 0, 0, 1]), K(t.mont, [0, 0, 0, 1]), K(1, [0, 0, 0, 1])]};
    if (chispa) tr.bateria = [K(0, [-70]), K(t.cebar1 - 0.02, [-70]), K(t.cebar1, [0]), K(1, [0])];
    const ev = [[0.04, 'cartucho'], [0.09, 'morder']].concat(chispa ? [[t.cebar0 + 0.03, 'cebar'], [t.cebar1, 'bateria']] : []).concat([[t.verter, 'carga'], [F(0.12), 'baqueta'], [t.at1, 'atacar'], [t.at2, 'atacar'], [F(0.94), 'baqueta']])
      .concat(t.pist0 ? [[t.pist1, 'piston']] : []).concat([[t.mont, 'montar'], [0.97, 'listo']]);
    C.recargar_vm = mk2(D, tr, ev);
  } else if (s.acc === 'cerrojo_simple' || s.acc === 'trampilla' || s.acc === 'palanca' || s.acc === 'cerrojo_tubo' || s.acc === 'cerrojo_peine') {
    const tubo = s.acc === 'cerrojo_tubo', peine = s.acc === 'cerrojo_peine', D = peine ? 3.2 : tubo ? 4.6 : 2.7, by = s.bore;
    const open = s.acc === 'trampilla' ? [0, 0, 0, -120, 0, 0] : s.acc === 'palanca' ? [0, -0.03, 0, -18, 0, 0] : [0, 0, 0.1, 0, 0, 62];
    const rot = s.acc === 'trampilla' || s.acc === 'palanca' ? open : [0, 0, 0, 0, 0, 62];
    const ins = peine ? ['arma', 0.0, by + 0.075, 0.02, 0, 0, 0, 0.85] : ['arma', 0.02, by + 0.04, -0.06, 0, 0, 80, 0.9];
    const T = {open: 0.12, back: 0.2, pouch: 0.32, at: 0.45, push: 0.55, close: 0.8, home: 0.92}; if (tubo) Object.assign(T, {at: 0.36, push: 0.42, close: 0.86});
    const md = [K(0, GR), K(0.06, ['cerrojo', 0.075, -0.02, 0.078, 0, 0, 30, 0.6]), K(T.back + 0.03, ['cerrojo', 0.075, -0.02, 0.078, 0, 0, 30, 0.6]), K(T.pouch, pouch), K(T.at, ins)];
    if (peine) md.push(K(T.push, ['arma', 0.0, by + 0.035, 0.02, 0, 0, 0, 0.7]), K(T.push + 0.06, ['arma', 0.0, by + 0.02, 0.02, 0, 0, 0, 0.7]));
    if (tubo) [0.52, 0.64].forEach(f => md.push(K(f - 0.06, pouch), K(f, ins)));
    md.push(K(T.close - 0.06, ['cerrojo', 0.075, -0.02, 0.078, 0, 0, 30, 0.6]), K(T.close, ['cerrojo', 0.075, -0.02, 0.078, 0, 0, 30, 0.6]), K(T.home, GR), K(1, GR));
    const tr = {arma: [K(0, P.bajo), K(0.08, P.cerrojo), K(T.home - 0.04, P.cerrojo), K(1, P.bajo)], manoDe: md, manoIz: [K(0, GL)],
      cerrojo: [K(0, z0), K(0.06, z0), K(T.open, rot), K(T.back, open), K(T.close - 0.12, open), K(T.close - 0.05, rot), K(T.close, z0), K(1, z0)],
      cartucho: peine ? undefined : [K(0, ['manoDe', 0, 0, 0, 0, 0, 0, 0]), K(T.pouch, ['manoDe', 0.0, -0.02, -0.01, 0, 0, 0, 1]), K(T.at + 0.02, ['manoDe', 0.0, -0.02, -0.01, 0, 0, 0, 1]), K(T.at + 0.03, ['manoDe', 0, 0, 0, 0, 0, 0, 0]), K(1, ['manoDe', 0, 0, 0, 0, 0, 0, 0])],
      peine: peine ? [K(0, ['manoDe', 0, 0, 0, 0, 0, 0, 0]), K(T.pouch, ['manoDe', 0.0, -0.025, -0.01, 0, 90, 0, 1]), K(T.at, ['manoDe', 0.0, -0.025, -0.01, 0, 90, 0, 1]), K(T.at + 0.01, ['arma', 0, by + 0.07, 0.02, 0, 90, 0, 1]), K(T.push + 0.06, ['arma', 0, by + 0.07, 0.02, 0, 90, 0, 1]), K(T.push + 0.1, ['arma', 0.05, by + 0.12, 0.05, 60, 90, 40, 1]), K(T.push + 0.2, ['cam', 0.3, -0.9, 0.0, 120, 0, 0, 0]), K(1, ['cam', 0.3, -0.9, 0.0, 0, 0, 0, 0])] : undefined,
      cam: [K(0, [0, 0, 0, 1]), K(0.1, [-3, -2, 1, 1]), K(T.home, [-3, -2, 1, 1]), K(1, [0, 0, 0, 1])]};
    if (s.acc === 'palanca') tr.palanca = [K(0, [0]), K(T.open, [50]), K(T.close - 0.05, [50]), K(T.close, [0]), K(1, [0])];
    Object.keys(tr).forEach(k => tr[k] === undefined && delete tr[k]);
    const ev = [[T.open, s.acc === 'palanca' ? 'palanca' : 'cerrojo'], [T.back, 'casquillo'], [T.pouch, peine ? 'peine' : 'cartucho'], [T.at + 0.02, 'carga']].concat(peine ? [[T.push + 0.06, 'carga'], [T.push + 0.12, 'peine_fuera']] : []).concat(tubo ? [[0.52, 'carga'], [0.64, 'carga']] : []).concat([[T.close, 'cerrojo'], [0.97, 'listo']]);
    C.recargar_vm = mk2(D, tr, ev);
  } else if (s.acc === 'semi_enbloc') {   // Garand: el clip vacío sale con el «ping», se mete el nuevo y el cerrojo se cierra solo
    const by = s.bore;
    C.recargar_vm = mk2(2.4, {arma: [K(0, P.bajo), K(0.08, P.cerrojo), K(0.85, P.cerrojo), K(1, P.bajo)],
      manoDe: [K(0, GR), K(0.25, pouch), K(0.48, ['arma', 0.0, by + 0.08, 0.02, 0, 0, 0, 0.85]), K(0.58, ['arma', 0.0, by + 0.02, 0.02, 0, 0, 0, 0.6]), K(0.64, ['arma', 0.04, by + 0.07, 0.05, 0, 0, 0, 0.6]), K(0.7, ['cerrojo', 0.04, -0.01, 0.03, 0, 0, 30, 0.7]), K(0.8, GR), K(1, GR)],
      manoIz: [K(0, GL)], cerrojo: [K(0, [0, 0, 0.09, 0, 0, 0]), K(0.6, [0, 0, 0.09, 0, 0, 0]), K(0.63, [0, 0, 0, 0, 0, 0]), K(1, z0)],
      peine: [K(0, ['arma', 0, by + 0.05, 0.02, 0, 90, 0, 1]), K(0.04, ['arma', 0, by + 0.05, 0.02, 0, 90, 0, 1]), K(0.12, ['cam', 0.1, 0.3, -0.4, 200, 90, 0, 1]), K(0.2, ['cam', 0.2, 0.2, -0.6, 400, 90, 0, 0]), K(0.24, ['manoDe', 0.0, -0.025, -0.01, 0, 90, 0, 1]), K(0.52, ['manoDe', 0.0, -0.025, -0.01, 0, 90, 0, 1]), K(0.55, ['arma', 0, by + 0.0, 0.02, 0, 90, 0, 1]), K(1, ['arma', 0, by + 0.0, 0.02, 0, 90, 0, 0])]},
      [[0.03, 'ping'], [0.25, 'peine'], [0.56, 'carga'], [0.63, 'cerrojo'], [0.97, 'listo']]);
  } else {   // cargador extraíble: subfusil, SVT/G43, pistola
    const by = s.bore, sock = s.grips.cargador.p, out = [sock[0], sock[1] - 0.2, sock[2] + 0.05];
    C.recargar_vm = mk2(s.acc === 'pistola' ? 1.5 : 2.2, {arma: [K(0, P.bajo), K(0.1, P.cerrojo), K(0.82, P.cerrojo), K(1, P.bajo)],
      manoDe: [K(0, GR)],
      manoIz: [K(0, GLp), K(0.12, ['cargador', 0.0, -0.06, 0.0, 0, 0, -40, 0.8]), K(0.22, ['cargador', 0.0, -0.06, 0.0, 0, 0, -40, 0.8]), K(0.36, ['cam', -0.2, -0.6, -0.05, -60, 0, -20, 0.6]), K(0.52, ['arma', out[0], out[1] + 0.05, out[2], 0, 0, -40, 0.85]), K(0.62, ['cargador', 0.0, -0.06, 0.0, 0, 0, -40, 0.8]),
        K(0.72, ['cerrojo', -0.04, 0.0, 0.02, 0, 0, -30, 0.7]), K(0.8, ['cerrojo', -0.04, 0.0, 0.02, 0, 0, -30, 0.7]), K(0.9, GLp), K(1, GLp)],
      cargador: [K(0, ['arma', 0, 0, 0, 0, 0, 0, 1]), K(0.2, ['arma', 0, 0, 0, 0, 0, 0, 1]), K(0.26, ['arma', 0, -0.12, 0.03, -10, 0, 0, 1]), K(0.34, ['cam', 0.0, -1.2, -0.2, -60, 0, 0, 1]), K(0.4, ['cam', 0.0, -1.2, -0.2, -60, 0, 0, 0]),
        K(0.41, ['manoIz', 0.0, 0.06, 0.0, 0, 0, 40, 1]), K(0.52, ['manoIz', 0.0, 0.06, 0.0, 0, 0, 40, 1]), K(0.6, ['arma', 0, -0.04, 0.0, 0, 0, 0, 1]), K(0.64, ['arma', 0, 0, 0, 0, 0, 0, 1]), K(1, ['arma', 0, 0, 0, 0, 0, 0, 1])],
      cerrojo: [K(0, z0), K(0.74, z0), K(0.78, [0, 0, s.acc === 'pistola' ? 0.05 : 0.08, 0, 0, 0]), K(0.81, z0), K(1, z0)],
      cam: [K(0, [0, 0, 0, 1]), K(0.3, [-3, 1, 2, 1]), K(0.62, [-1, 0, 0, 1]), K(1, [0, 0, 0, 1])]},
      [[0.24, 'cargador_fuera'], [0.4, 'cargador_suelo'], [0.62, 'carga'], [0.78, 'cerrojo'], [0.97, 'listo']]);
  }
  return C;
}

/* ---------- tiempo de ejecución ---------- */
const _vmM = new THREE.Matrix4(), _vmM2 = new THREE.Matrix4(), _vmQ = new THREE.Quaternion(), _vmQ2 = new THREE.Quaternion(), _vmE = new THREE.Euler(), _vmV = new THREE.Vector3(), _vmV2 = new THREE.Vector3(), _vmS = new THREE.Vector3(1, 1, 1);
const VM_SPACES = ['cam', 'arma', 'manoDe', 'manoIz', 'baqueta', 'cerrojo', 'cargador'];
function vmCompose(out, x, y, z, rx, ry, rz) { _vmE.set(rx * D2R, ry * D2R, rz * D2R, 'XYZ'); _vmQ.setFromEuler(_vmE); _vmV.set(x, y, z); return out.compose(_vmV, _vmQ, _vmS); }
// TroopViewmodel({nation, era, rol: 'fusil' | 'subfusil' | 'semi' | 'pistola', skin: 0..3, arma: id opcional})
function TroopViewmodel(o) {
  o = o || {}; this.nation = o.nation || 'GEN'; this.era = o.era || 'D'; this.rol = o.rol || 'fusil';
  this.armId = o.arma || troopArm(this.nation, this.era, this.rol); const A = TROOP_ARMS[this.armId], era = this.era;
  const pal = uniformPalette(this.nation, era, 'linea'), skin = new THREE.Color(SKIN[o.skin || 0]).getHex(), eq = pal.modelo && pal.modelo.equipo;
  let body, moving, spec;
  if (A.accion === 'subfusil') ({body, moving, spec} = vmBuildSMG(this.armId));
  else if (A.accion === 'pistola') ({body, moving, spec} = vmBuildPistol());
  else { spec = vmRifleSpec(this.armId); body = vmBuildRifle(spec); moving = vmBuildMoving(spec); if (moving.baqueta) moving.baqueta.at = [0, spec.bore - 0.024, spec.L + 0.99]; }
  this.spec = spec; this.arm = A;
  this.mat = new THREE.MeshLambertMaterial({vertexColors: true}); this.mat.name = 'troop_viewmodel';
  const mesh = (B, name) => { const m = new THREE.Mesh(vmGeo(B, pal), this.mat); m.name = name; m.frustumCulled = false; m.renderOrder = 10; return m; };
  this.group = new THREE.Group(); this.group.name = 'viewmodel';
  this.rig = new THREE.Group(); this.group.add(this.rig);                                   // balanceo, puntería y retroceso
  this.weapon = new THREE.Group(); this.weapon.add(mesh(body, 'arma')); this.rig.add(this.weapon); this.weapon.matrixAutoUpdate = false;
  this.parts = {};
  Object.keys(moving).forEach(k => { const g = new THREE.Group(), m = mesh(moving[k].g, k); g.add(m); g.userData.at = moving[k].at; g.matrixAutoUpdate = false; (k === 'cargador' ? this.rig : this.weapon).add(g); this.parts[k] = g; });
  const props = vmProps(era, this.nation, spec); this.props = {};
  Object.keys(props).forEach(k => { const g = new THREE.Group(); g.add(mesh(props[k], k)); g.visible = false; g.matrixAutoUpdate = false; this.rig.add(g); this.props[k] = g; });
  const cuff = era === 'A' || era === 'B' || era === 'C';
  this.hands = {De: new THREE.Group(), Iz: new THREE.Group()}; this.handCurl = {De: 1, Iz: 1};
  this.handMesh = {De: [0, 0.35, 0.7, 1].map(c => mesh(vmBuildHand(c, false, skin, cuff), 'manoDe')), Iz: [0, 0.35, 0.7, 1].map(c => mesh(vmBuildHand(c, true, skin, cuff), 'manoIz'))};   // 4 grados de cierre
  ['De', 'Iz'].forEach(s => { this.handMesh[s].forEach((m, i) => { m.visible = i === 3; this.hands[s].add(m); }); this.hands[s].matrixAutoUpdate = false; this.rig.add(this.hands[s]); });
  this.L1 = 0.31; this.L2 = 0.29; this.shoulder = {De: new THREE.Vector3(0.2, -0.32, 0.1), Iz: new THREE.Vector3(-0.2, -0.32, 0.1)};
  this.armSeg = {}; ['De', 'Iz'].forEach(s => { const u = mesh(vmArmGeo(this.L1, 0.058, 0.05, Z.MAIN), 'brazo' + s), f = mesh(vmArmGeo(this.L2, 0.05, 0.042, Z.MAIN), 'antebrazo' + s);
    u.matrixAutoUpdate = f.matrixAutoUpdate = false; this.rig.add(u, f); this.armSeg[s] = {u, f}; });
  this.chest = mesh(vmChest(era, eq), 'pecho'); this.group.add(this.chest);
  this.clips = vmClipSet(spec, era, this.nation); this.cur = null; this.t = 0; this.prev = null; this.blend = 0; this.queue = [];
  this.listeners = []; this.aimYaw = 0; this.aimPitch = 0; this.sway = new THREE.Vector2(); this.swayV = new THREE.Vector2(); this.camOut = {rx: 0, ry: 0, rz: 0, fov: 1};
  this.tris = 0; this.group.traverse(m => { if (m.isMesh && m.visible !== false && !/^(manoDe|manoIz)$/.test(m.name)) this.tris += m.geometry.attributes.position.count / 3; });
  this.tris += (this.handMesh.De[3].geometry.attributes.position.count + this.handMesh.Iz[3].geometry.attributes.position.count) / 3;
  this.play('idle_vm');
}
TroopViewmodel.prototype.on = function (fn) { this.listeners.push(fn); return this; };
// play(clip, {blend: s, next: clip al acabar}) · los clips sin bucle vuelven a o.next o al reposo
TroopViewmodel.prototype.play = function (name, o) {
  o = o || {}; const c = this.clips[name]; if (!c) return false;
  if (this.cur) { this.prev = {c: this.cur, t: this.t, snap: this.snapshot()}; this.blend = o.blend != null ? o.blend : 0.14; this.blendT = 0; }
  this.cur = c; this.curName = name; this.t = 0; this.next = o.next || (c.loop ? null : c.final ? null : 'idle_vm'); this._lastPh = -1; return true;
};
TroopViewmodel.prototype.clipNames = function () { return Object.keys(this.clips); };
TroopViewmodel.prototype.clipInfo = function (n) { const c = this.clips[n]; return c && {dur: c.dur, loop: !!c.loop, events: c.ev.map(e => ({t: e[0] * c.dur, fase: e[0], evento: e[1]}))}; };
// setAim(guiñada, cabeceo): mezcla de puntería aditiva (±35° / ±45°) alrededor del pecho; look(dx, dy): retraso por el giro de la cámara
TroopViewmodel.prototype.setAim = function (yaw, pitch) { this.aimYaw = Math.max(-35, Math.min(35, yaw || 0)); this.aimPitch = Math.max(-45, Math.min(45, pitch || 0)); };
TroopViewmodel.prototype.look = function (dx, dy) { this.swayV.x -= dx * 0.6; this.swayV.y -= dy * 0.6; };
TroopViewmodel.prototype.snapshot = function () { return {w: this.weapon.matrix.clone(), De: this.hands.De.matrix.clone(), Iz: this.hands.Iz.matrix.clone()}; };
const _vmOut = new Float32Array(8);
function vmSample(tr, ph, n, loop) { const old = _loopCur; _loopCur = loop; sampleTrack(tr, ph, _vmOut, n); _loopCur = old; return _vmOut; }
// matriz (espacio de cámara) de un espacio en el instante actual
TroopViewmodel.prototype._space = function (name) { if (name === 'cam') return null; if (name === 'arma') return this.weapon.matrix; if (name === 'manoDe') return this.hands.De.matrix; if (name === 'manoIz') return this.hands.Iz.matrix;
  const g = this.parts[name]; if (!g) return null; return g.parent === this.weapon ? new THREE.Matrix4().multiplyMatrices(this.weapon.matrix, g.matrix) : g.matrix; };
// pista de espacio mixto → posición, rotación y valor extra en espacio de cámara
TroopViewmodel.prototype._mixed = function (tr, ph, loop, outM) {
  const n = tr.length; let k = 0; while (k < n - 1 && tr[k + 1][0] <= ph) k++;
  const a = tr[k], b = tr[Math.min(n - 1, k + 1)], h = Math.max(1e-6, b[0] - a[0]), u = n === 1 ? 0 : Math.min(1, Math.max(0, (ph - a[0]) / h)), e = u * u * (3 - 2 * u);
  const conv = (key, m) => { vmCompose(m, key[2], key[3], key[4], key[5], key[6], key[7]); const S = this._space(key[1]); if (S) m.premultiply(S); return m; };
  const mA = conv(a, new THREE.Matrix4()), mB = conv(b, new THREE.Matrix4());
  // posición: cúbica monótona sobre las claves convertidas (los cambios de agarre siguen siendo suaves)
  const conv3 = tr.map(q => { const m = conv(q, _vmM); return [q[0], m.elements[12], m.elements[13], m.elements[14], q[8]]; });
  const p = vmSample(conv3, ph, 4, loop);
  const qa = new THREE.Quaternion().setFromRotationMatrix(mA), qb = new THREE.Quaternion().setFromRotationMatrix(mB); qa.slerp(qb, e);
  outM.compose(_vmV.set(p[0], p[1], p[2]), qa, _vmS); return p[3];
};
TroopViewmodel.prototype.update = function (dt, input) {
  input = input || {}; const c = this.cur; if (!c) return;
  this.t += dt; let ph = this.t / c.dur;
  if (ph >= 1 && !c.loop) { // eventos que faltan y paso al siguiente
    this._events(this._lastPh, 1); if (this.next) { const n = this.next; this.play(n); return this.update(0, input); } ph = 1; }
  if (c.loop) ph -= Math.floor(ph);
  if (c.loop && ph < this._lastPh) { this._events(this._lastPh, 1.0001); this._lastPh = -1e-6; }
  this._events(this._lastPh, ph); this._lastPh = ph;
  const loop = !!c.loop, T = c.tracks;
  // arma
  const a = vmSample(T.arma, ph, 6, loop); vmCompose(this.weapon.matrix, a[0], a[1], a[2], a[3], a[4], a[5]);
  // piezas móviles (en el espacio del arma, salvo el cargador que puede salir del arma)
  Object.keys(this.parts).forEach(k => { const g = this.parts[k], at = g.userData.at; let v;
    if (k === 'cargador' && T.cargador) { const vis = this._mixed(T.cargador, ph, loop, g.matrix); const m0 = vmCompose(_vmM, at[0], at[1], at[2], 0, 0, 0); g.matrix.multiply(m0); g.visible = vis > 0.5; return; }
    if (k === 'cargador') { g.matrix.multiplyMatrices(this.weapon.matrix, vmCompose(_vmM, at[0], at[1], at[2], 0, 0, 0)); g.visible = true; return; }
    if (T[k] && (k === 'martillo' || k === 'bateria' || k === 'palanca')) { v = vmSample(T[k], ph, 1, loop); vmCompose(g.matrix, at[0], at[1], at[2], v[0], 0, 0); }
    else if (T[k]) { v = vmSample(T[k], ph, 6, loop); vmCompose(g.matrix, at[0] + v[0], at[1] + v[1], at[2] + v[2], v[3], v[4], v[5]); }
    else vmCompose(g.matrix, at[0], at[1], at[2], 0, 0, 0); });
  // manos (después de arma y piezas) y accesorios
  ['De', 'Iz'].forEach(s => { const tr = T['mano' + s]; if (!tr) return; const curl = this._mixed(tr, ph, loop, this.hands[s].matrix); this.handCurl[s] = curl;
    const lvl = Math.max(0, Math.min(3, Math.round(curl * 3))); this.handMesh[s].forEach((m, i) => { m.visible = i === lvl; }); });
  Object.keys(this.props).forEach(k => { const g = this.props[k], tr = T[k]; if (!tr) { g.visible = false; return; } const vis = this._mixed(tr, ph, loop, g.matrix); g.visible = vis > 0.5; });
  // mezcla con el clip anterior (posición de arma y manos)
  if (this.prev && this.blendT < this.blend) { this.blendT += dt; const k = Math.min(1, this.blendT / this.blend), e = k * k * (3 - 2 * k);
    [[this.weapon.matrix, this.prev.snap.w], [this.hands.De.matrix, this.prev.snap.De], [this.hands.Iz.matrix, this.prev.snap.Iz]].forEach(([m, p]) => { const pa = new THREE.Vector3(), qa = new THREE.Quaternion(), pb = new THREE.Vector3(), qb = new THREE.Quaternion(), sc = new THREE.Vector3();
      p.decompose(pa, qa, sc); m.decompose(pb, qb, sc); pa.lerp(pb, e); qa.slerp(qb, e); m.compose(pa, qa, _vmS); });
    if (k >= 1) this.prev = null; }
  // brazos por IK (hombro fijo → muñeca de cada mano), con un estiramiento máximo del 8 % para no separar la mano del antebrazo
  ['De', 'Iz'].forEach(s => { const H = this.hands[s].matrix, wrist = _vmV.set(s === 'De' ? 0.055 : -0.055, -0.006, 0.15).applyMatrix4(H).clone();
    this._ik(s, this.shoulder[s], wrist); });
  // cámara: patada, balanceo y FOV del clip
  if (T.cam) { const cm = vmSample(T.cam, ph, 4, loop); this.camOut.rx = cm[0]; this.camOut.ry = cm[1]; this.camOut.rz = cm[2]; this.camOut.fov = cm[3] || 1; } else { this.camOut.rx = this.camOut.ry = this.camOut.rz = 0; this.camOut.fov = 1; }
  // balanceo por giro de cámara (muelle) + mezcla de puntería
  const sp = this.sway, sv = this.swayV; sv.x += (-sp.x * 60 - sv.x * 11) * dt; sv.y += (-sp.y * 60 - sv.y * 11) * dt; sp.x += sv.x * dt; sp.y += sv.y * dt;
  const mv = input.mover || 0, tt = performance.now ? performance.now() / 1000 : 0;
  this.rig.position.set(sp.x * 0.004, sp.y * 0.004 - (input.agachado ? 0.01 : 0), 0);
  this.rig.rotation.set((this.aimPitch * 0.25 + sp.y * 0.6) * D2R, (this.aimYaw * 0.25 + sp.x * 0.6) * D2R, (sp.x * 0.8) * D2R, 'YXZ');
  this.chest.position.set(0, mv * 0.01 * Math.sin(tt * 9), 0);
};
TroopViewmodel.prototype._ik = function (s, S, W) {
  const L1 = this.L1, L2 = this.L2; let d = _vmV2.subVectors(W, S), dist = d.length();
  if (dist > (L1 + L2) * 0.97) { S = S.clone().addScaledVector(d.clone().normalize(), Math.min(0.6, dist - (L1 + L2) * 0.97)); d = _vmV2.subVectors(W, S); dist = d.length(); }
  const dir = d.clone().normalize();
  const st = Math.min(1.08, Math.max(1, dist / (L1 + L2 - 1e-3))), l1 = L1 * st, l2 = L2 * st; dist = Math.min(l1 + l2 - 1e-4, Math.max(Math.abs(l1 - l2) + 1e-3, dist));
  const ca = (l1 * l1 + dist * dist - l2 * l2) / (2 * l1 * dist), sa = Math.sqrt(Math.max(0, 1 - ca * ca));
  const pole = new THREE.Vector3(s === 'De' ? 0.7 : -0.7, -1, 0.35).normalize(); pole.addScaledVector(dir, -pole.dot(dir)).normalize();
  const E = S.clone().addScaledVector(dir, l1 * ca).addScaledVector(pole, l1 * sa), Wc = S.clone().addScaledVector(dir, dist);
  const seg = (m, A, B, len, sc) => { const v = B.clone().sub(A).normalize(); _vmQ2.setFromUnitVectors(new THREE.Vector3(0, 0, -1), v); m.matrix.compose(A, _vmQ2, new THREE.Vector3(1, 1, sc)); };
  seg(this.armSeg[s].u, S, E, l1, st); seg(this.armSeg[s].f, E, Wc, l2, st); this.ikErr = Math.max(this.ikErr || 0, Wc.distanceTo(W));
};
TroopViewmodel.prototype._events = function (a, b) { const c = this.cur; c.ev.forEach(([t, n]) => { if (t > a && t <= b) this.listeners.forEach(fn => fn(n, {clip: this.curName, t: t * c.dur, arma: this.armId})); }); };
// dibujo en un segundo pase: misma orientación que la cámara del juego, near 0,05, sin el escenario
TroopViewmodel.prototype.render = function (renderer, gameCam) {
  if (!this.scene) { this.scene = new THREE.Scene(); this.scene.add(this.group); this.cam = new THREE.PerspectiveCamera(62, 1, 0.05, 10);
    const hl = new THREE.HemisphereLight(0xfff4e0, 0x404438, 0.85), dl = new THREE.DirectionalLight(0xfff2e0, 0.75); dl.position.set(0.5, 1, 0.3); this.scene.add(hl, dl); }
  this.cam.aspect = gameCam.aspect; this.cam.fov = (gameCam.fov || 70) * 0.9 * this.camOut.fov; this.cam.updateProjectionMatrix();
  const ac = renderer.autoClear; renderer.autoClear = false; renderer.clearDepth(); renderer.render(this.scene, this.cam); renderer.autoClear = ac;
};
TroopViewmodel.prototype.dispose = function () { this.group.traverse(m => { if (m.isMesh) m.geometry.dispose(); }); this.mat.dispose(); };
// posición de la boca del arma de una figura instanciada (para el fogonazo y el humo): kind, era, clip, fase y matriz de la instancia
const _muzOut = new Float32Array(MAXP * 16);
function troopMuzzle(kind, era, clip, phase, world, out) {
  const K = KINDS[kind]; if (!K || !CLIPS[K.rig] || !CLIPS[K.rig][clip]) return null; const ix = rigIndex(K.rig).arma; if (ix == null) return null;
  poseTroop(K.rig, clip, phase, _muzOut); const L = /mosquete/.test(K.arma || '') || era < 'C' ? 1.5 : 1.22, o = ix * 16, m = _muzOut;
  const v = (out || new THREE.Vector3()).set(m[o + 4] * L + m[o + 12], m[o + 5] * L + m[o + 13], m[o + 6] * L + m[o + 14]); return world ? v.applyMatrix4(world) : v;
}
// boca del arma (o expulsión) en espacio de cámara → con la matriz de la cámara del juego pasa a mundo
TroopViewmodel.prototype.muzzle = function (out, world) { this.rig.updateMatrix(); const v = (out || new THREE.Vector3()).set(0, this.spec.bore, this.spec.L).applyMatrix4(this.weapon.matrix).applyMatrix4(this.rig.matrix); return world ? v.applyMatrix4(world) : v; };
TroopViewmodel.prototype.ejectPort = function (out, world) { this.rig.updateMatrix(); const v = (out || new THREE.Vector3()).set(0.03, this.spec.bore, 0.0).applyMatrix4(this.weapon.matrix).applyMatrix4(this.rig.matrix); return world ? v.applyMatrix4(world) : v; };

/* ================= v5: efectos de combate (datos + emisores baratos) =================
   Sin texturas ni modelos: cada emisor devuelve partículas {p, v, vida, tam, crece, color, alfa, grav, arrastre, tipo} que el juego dibuja con su
   sistema de puntos de textura suave (b3Push en batalla3d.js). Estilizado: polvo, astillas y una nube rojiza muy breve en el soldado, sin gore.
   Pólvora negra (A–C hasta 1886 aprox.): nube blanca densa y persistente; pólvora sin humo (Lebel 1886 en adelante, C tardía, D y E): solo bruma. */
const TROOP_FX = {
  fogonazo: {A: {tam: 0.55, vida: 0.07, color: '#ffd38a', luz: 2.2}, B: {tam: 0.5, vida: 0.06, color: '#ffd890', luz: 2.0}, C: {tam: 0.35, vida: 0.05, color: '#ffe2a8', luz: 1.4},
    D: {tam: 0.3, vida: 0.04, color: '#fff0c8', luz: 1.2}, E: {tam: 0.28, vida: 0.035, color: '#fff2d0', luz: 1.1}},
  humo: {A: {n: 14, tam: 0.35, crece: 1.6, vida: 6.5, alfa: 0.75, color: '#eeece6', deriva: 0.25, cazoleta: true}, B: {n: 12, tam: 0.32, crece: 1.5, vida: 5.5, alfa: 0.7, color: '#ecebe4', deriva: 0.25},
    C: {n: 6, tam: 0.25, crece: 1.2, vida: 3.0, alfa: 0.4, color: '#e6e6e0', deriva: 0.3}, D: {n: 2, tam: 0.15, crece: 0.8, vida: 0.9, alfa: 0.18, color: '#dcdcd8', deriva: 0.35}, E: {n: 2, tam: 0.12, crece: 0.8, vida: 0.8, alfa: 0.15, color: '#dcdcd8', deriva: 0.35}},
  expulsion: {A: {tipo: 'taco', color: '#d8ccb0', n: 1, vel: 6}, B: {tipo: 'taco', color: '#d8ccb0', n: 1, vel: 5}, C: {tipo: 'casquillo', color: '#c8a24a', n: 1, vel: 2.2},
    D: {tipo: 'casquillo', color: '#c8a24a', n: 1, vel: 2.4}, E: {tipo: 'casquillo', color: '#c8a24a', n: 1, vel: 2.6}},
  trazadora: {D: {color: '#ffb060', largo: 1.6, vel: 700, cada: 5, vida: 1.2}, E: {color: '#ff9a50', largo: 2.0, vel: 750, cada: 5, vida: 1.4}},
  impacto: {tierra: {n: 10, color: '#6a5a40', vel: 3.5, tam: 0.12, vida: 0.9, grav: 9, polvo: '#8a7a5a'}, madera: {n: 8, color: '#a07a4a', vel: 4, tam: 0.05, vida: 0.7, grav: 9, polvo: '#c0a070', astillas: true},
    muro: {n: 9, color: '#9a948a', vel: 3, tam: 0.07, vida: 0.8, grav: 9, polvo: '#c8c2b8'}, soldado: {n: 5, color: '#8a2a20', vel: 1.2, tam: 0.09, vida: 0.35, grav: 2, polvo: '#7a6a58'},
    agua: {n: 10, color: '#d8e4ea', vel: 3, tam: 0.1, vida: 0.6, grav: 9, polvo: '#e8eef0'}},
  // efectos de cámara del viewmodel al ser herido (el juego los dibuja): curvas [t (s), valor]
  camara: {herido_leve: {vineta: [[0, 0], [0.05, 0.45], [0.6, 0.25], [2.5, 0]], desenfoque: [[0, 0], [0.05, 0.3], [1.0, 0]], pitido: {vol: [[0, 0], [0.05, 0.25], [1.5, 0]], hz: 4200}, color: '#7a0a0a'},
    herido_grave: {vineta: [[0, 0], [0.05, 0.8], [1.5, 0.6], [6, 0.4]], desenfoque: [[0, 0], [0.05, 0.7], [2.0, 0.35], [6, 0.2]], pitido: {vol: [[0, 0], [0.05, 0.6], [3.0, 0.25], [6, 0]], hz: 3800}, color: '#6a0606', pulso: 1.1},
    explosion: {vineta: [[0, 0], [0.05, 0.3], [1.5, 0]], desenfoque: [[0, 0], [0.05, 0.9], [2.5, 0]], pitido: {vol: [[0, 0], [0.05, 1.0], [5.0, 0]], hz: 3500}, temblor: [[0, 0], [0.05, 1], [0.8, 0]], color: '#2a2018'},
    muerte: {vineta: [[0, 0], [0.3, 0.7], [1.8, 1.0]], desenfoque: [[0, 0], [1.0, 0.8], [1.8, 1.0]], pitido: {vol: [[0, 0], [0.2, 0.5], [1.8, 0]], hz: 3600}, color: '#200404', fundido: [[0, 0], [1.2, 0], [2.2, 1]]}}
};
function fxCurve(c, t) { if (!c) return 0; if (t <= c[0][0]) return c[0][1]; for (let i = 0; i < c.length - 1; i++) if (t <= c[i + 1][0]) { const u = (t - c[i][0]) / (c[i + 1][0] - c[i][0]); return c[i][1] + (c[i + 1][1] - c[i][1]) * u; } return c[c.length - 1][1]; }
// semilla determinista para que dos disparos seguidos no sean idénticos pero el resultado sea reproducible
function _fxRnd(seed) { let s = (seed * 9301 + 49297) % 233280; return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; }; }
// troopFxDisparo(era, boca (Vector3 o [x,y,z]), dirección, {semilla, viento:[x,z], lateral: Vector3 (derecha del arma)}) → partículas
function troopFxDisparo(era, boca, dir, o) {
  o = o || {}; const r = _fxRnd(o.semilla || 1), P = [], b = Array.isArray(boca) ? boca : [boca.x, boca.y, boca.z], d = Array.isArray(dir) ? dir : [dir.x, dir.y, dir.z];
  const F = TROOP_FX.fogonazo[era] || TROOP_FX.fogonazo.D, H = TROOP_FX.humo[era] || TROOP_FX.humo.D, w = o.viento || [0.4, 0.1];
  P.push({tipo: 'fogonazo', p: b.slice(), v: [0, 0, 0], vida: F.vida, tam: F.tam, crece: 0.4, color: F.color, alfa: 1, grav: 0, arrastre: 0, luz: F.luz});
  for (let i = 0; i < H.n; i++) { const k = 0.3 + r() * 1.7, sp = 0.15 + r() * 0.3;
    P.push({tipo: 'humo', p: [b[0] + d[0] * 0.1 * i / H.n, b[1] + d[1] * 0.1 * i / H.n, b[2] + d[2] * 0.1 * i / H.n], v: [d[0] * k + (r() - 0.5) * sp + w[0] * H.deriva, d[1] * k + 0.15 + r() * 0.2, d[2] * k + (r() - 0.5) * sp + w[1] * H.deriva],
      vida: H.vida * (0.7 + r() * 0.6), tam: H.tam * (0.7 + r() * 0.6), crece: H.crece, color: H.color, alfa: H.alfa * (0.6 + r() * 0.4), grav: -0.05, arrastre: 1.6}); }
  if (H.cazoleta && o.lateral) { const l = Array.isArray(o.lateral) ? o.lateral : [o.lateral.x, o.lateral.y, o.lateral.z];   // humo de la cazoleta junto a la cara (chispa)
    for (let i = 0; i < 3; i++) P.push({tipo: 'humo', p: [b[0] - d[0] * 1.0 + l[0] * 0.05, b[1] - d[1] * 1.0 + 0.05, b[2] - d[2] * 1.0 + l[2] * 0.05], v: [l[0] * 0.6 + (r() - 0.5) * 0.2, 0.5 + r() * 0.3, l[2] * 0.6 + (r() - 0.5) * 0.2], vida: 2.5, tam: 0.12, crece: 1.2, color: '#f0eee8', alfa: 0.7, grav: -0.1, arrastre: 2}); }
  return P;
}
// troopFxExpulsion(era, punto, derecha) → casquillo (C–E) o taco/papel (A–B)
function troopFxExpulsion(era, p, der, o) {
  o = o || {}; const r = _fxRnd(o.semilla || 3), E = TROOP_FX.expulsion[era] || TROOP_FX.expulsion.D, q = Array.isArray(p) ? p : [p.x, p.y, p.z], l = Array.isArray(der) ? der : [der.x, der.y, der.z];
  return [{tipo: E.tipo, p: q.slice(), v: [l[0] * E.vel + (r() - 0.5) * 0.4, 1.2 + r() * 0.6, l[2] * E.vel + (r() - 0.5) * 0.4], vida: E.tipo === 'taco' ? 1.2 : 2.0, tam: E.tipo === 'taco' ? 0.03 : 0.018, crece: 0, color: E.color, alfa: 1, grav: 9.8, arrastre: 0.2, gira: 20, rebota: E.tipo === 'casquillo'}];
}
// troopFxTrazadora(era, origen, destino) → segmento con estela corta (D–E); null en épocas sin trazadoras
function troopFxTrazadora(era, a, b) { const T = TROOP_FX.trazadora[era]; if (!T) return null; const A = Array.isArray(a) ? a : [a.x, a.y, a.z], B = Array.isArray(b) ? b : [b.x, b.y, b.z];
  const d = Math.hypot(B[0] - A[0], B[1] - A[1], B[2] - A[2]); return {tipo: 'trazadora', de: A, a: B, vel: T.vel, dur: d / T.vel, largo: T.largo, color: T.color, vida: Math.min(T.vida, d / T.vel)}; }
// troopFxImpacto(material: 'tierra' | 'madera' | 'muro' | 'soldado' | 'agua', punto, normal) → partículas
function troopFxImpacto(mat, p, n, o) {
  o = o || {}; const r = _fxRnd(o.semilla || 7), I = TROOP_FX.impacto[mat] || TROOP_FX.impacto.tierra, q = Array.isArray(p) ? p : [p.x, p.y, p.z], N = n ? (Array.isArray(n) ? n : [n.x, n.y, n.z]) : [0, 1, 0], P = [];
  for (let i = 0; i < I.n; i++) { const s = I.vel * (0.4 + r() * 0.8);
    P.push({tipo: I.astillas && i % 2 ? 'astilla' : 'trozo', p: q.slice(), v: [N[0] * s + (r() - 0.5) * s, N[1] * s + r() * s * 0.6, N[2] * s + (r() - 0.5) * s], vida: I.vida * (0.6 + r() * 0.6), tam: I.tam * (0.5 + r()), crece: 0, color: I.color, alfa: 1, grav: I.grav, arrastre: 0.6, gira: I.astillas ? 15 : 0}); }
  for (let i = 0; i < 3; i++) P.push({tipo: 'polvo', p: q.slice(), v: [N[0] * 0.6 + (r() - 0.5) * 0.5, N[1] * 0.6 + 0.2, N[2] * 0.6 + (r() - 0.5) * 0.5], vida: I.vida * 2, tam: I.tam * 2.5, crece: 1.4, color: I.polvo, alfa: mat === 'soldado' ? 0.45 : 0.6, grav: -0.05, arrastre: 2});
  return P;
}
// troopFxCamara(tipo, t) → {vineta, desenfoque, pitidoVol, pitidoHz, color, temblor, fundido}
function troopFxCamara(tipo, t) { const C = TROOP_FX.camara[tipo]; if (!C) return null;
  return {vineta: fxCurve(C.vineta, t) * (C.pulso ? 0.85 + 0.15 * Math.sin(t * Math.PI * 2 * C.pulso) : 1), desenfoque: fxCurve(C.desenfoque, t), pitidoVol: fxCurve(C.pitido && C.pitido.vol, t), pitidoHz: C.pitido ? C.pitido.hz : 0, color: C.color, temblor: fxCurve(C.temblor, t), fundido: fxCurve(C.fundido, t)}; }

const api = {TROOP_KINDS, TROOP_ERAS, KINDS, RIGS, CLIPS, NACIONES, ROLES, MAXP, buildTroop, poseTroop, blendPose, uniformPalette, troopStats, bakeClips, makeTroopMaterial, TroopShared, TroopBatch, TroopLodSet, CpuBatch,
  TROOP_GROUPS, troopGroup, troopGeoKey, nationalMark, clipInfo, clipPhase, eventsBetween, exportClipsJSON, SKIN, HORSE, _dev: {GeoBuilder, xf}, troopAimClip, TROOP_BAKE, TroopViewmodel, TROOP_ARMS, TROOP_ARMS_NAT, TROOP_ARMS_E, troopArm, troopMuzzle, TROOP_FX, troopFxDisparo, troopFxExpulsion, troopFxTrazadora, troopFxImpacto, troopFxCamara};
root.Troops3D = api;
['TROOP_KINDS', 'TROOP_ERAS', 'buildTroop', 'poseTroop', 'blendPose', 'uniformPalette', 'troopStats'].forEach(k => { root[k] = api[k]; });
})(typeof window !== 'undefined' ? window : globalThis);
