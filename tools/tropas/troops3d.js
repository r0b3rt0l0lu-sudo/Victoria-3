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
const TROOP_ERAS = ['A', 'B', 'C', 'D'];
const MAXP = 20;                                     // partes máximas por figura (ancho de la textura = MAXP × 3 texeles)
const Z = {MAIN: 0, TRIM: 1, ACC: 2, HAT: 3, F1: 4, F2: 5, F3: 6, VEH: 7, FIX: 8};
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
  const i = TROOP_ERAS.indexOf(era); for (let d = 1; d < 4; d++) { const a = TROOP_ERAS[i - d], b = TROOP_ERAS[i + d]; if (a && obj[a]) return obj[a]; if (b && obj[b]) return obj[b]; }
  return null;
}
// uniformPalette(nación, época, papel) → {main, trim, accessory, hat, flag, headgear, vehicle, note}
function uniformPalette(nation, era, rol) {
  const n = NACIONES[nation] || NACIONES.GEN, base = eraOf(n, era) || eraOf(NACIONES.GEN, era);
  const R = rol && rol !== 'linea' && n.rol && n.rol[rol];
  // un papel usa su época o la más cercana anterior a D; en D (caqui/gris de campaña) solo si la define: todos visten como la línea
  const r = R ? (R[era] || (era !== 'D' ? eraOf({A: R.A, B: R.B, C: R.C}, era) : null)) : null;
  const e = r || base;
  return {main: e.c[0], trim: e.c[1], accessory: e.c[2], hat: e.c[3], flag: n.f.slice(), flagLayout: n.bandera, headgear: e.toc, vehicle: n.veh || '#6a6c52', note: e.nota || ''};
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
  if (o.mochila !== false && !o.lite) { if (AB) { g.box(P.torso, Z.FIX, C.mochila, [0, 0.28, -0.17], [0.32, 0.3, 0.11]); if (era === 'A') g.cyl(P.torso, Z.FIX, C.manta, [0, 0.46, -0.17], 0.05, 0.05, 0.32, 4, {rot: [0, 0, 90]}); } else g.box(P.torso, Z.FIX, C.lona, [0, 0.28, -0.16], [0.28, 0.26, 0.1]); }
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
    if (o.lite) { g.box(P[l], Z.FIX, era === 'D' ? C.panno : C.bota, [0, -0.22, 0.02], [0.12, 0.46, 0.15], {noTop: true, taper: 0.06}); return; }
    g.box(P[l], era === 'D' ? Z.FIX : pants, era === 'D' ? C.panno : 0, [0, -0.17, 0], [0.12, 0.36, 0.13], {noTop: true, taper: 0.06});   // D: polainas/puttees
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
  else if (t === 'coracero' && o.era !== 'D') g.box(P.torso, Z.FIX, C.acero, [0, 0.26, 0], [0.4, 0.36, 0.26], {taper: -0.08});             // coraza
  else if (t === 'general' || t === 'mariscal' || t === 'ayudante') { g.box(P.torso, Z.TRIM, 0, [0, 0.1, 0], [0.38, 0.06, 0.235], {noTop: true, rot: [0, 0, 10]}); }   // faja
  else g.box(P.torso, Z.FIX, C.cuero, [0, 0.03, 0], [0.38, 0.06, 0.24], {noTop: true});
  if (t === 'dragon' || (o.era === 'D' && (t === 'husar' || t === 'lancero' || t === 'coracero'))) g.box(P.torso, Z.FIX, C.hierro, [0.12, 0.18, -0.14], [0.05, 0.7, 0.05], {rot: [0, 0, -30]});   // carabina a la espalda
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
  if (t === 'liso' || (t === 'obus' && era !== 'D')) {
    g.box(P.cureña, Z.FIX, 0x5e6a48, [0, 0.42, -0.85], [0.22, 0.14, 2.0], {rot: [-14, 0, 0]});             // gualderas pintadas (verde oliva, aprox.)
    g.box(P.cureña, Z.FIX, 0x5e6a48, [0, 0.7, 0.15], [0.5, 0.22, 0.5]);
    g.box(P.cureña, Z.FIX, C.hierro, [0, 0.62, 0.15], [1.26, 0.08, 0.08], {noFront: true, noBack: true});
    if (t === 'liso') { g.cyl(P.tubo, Z.FIX, C.bronce, [0, 0, 0.35], 0.12, 0.085, 1.5, 8, {rot: [90, 0, 0], top: true}); g.cyl(P.tubo, Z.FIX, C.bronce, [0, 0, -0.45], 0.13, 0.11, 0.12, 6, {rot: [90, 0, 0], bottom: true}); }
    else g.cyl(P.tubo, Z.FIX, C.bronce, [0, 0.12, 0.1], 0.17, 0.15, 0.85, 8, {rot: [90 - 32, 0, 0], top: true, bottom: true});    // obús corto elevado
    wheels(0.62, C.madera);
  } else if (t === 'rc' || t === 'obus') {
    if (era === 'D') {                                                                                        // pieza de campaña con escudo (tipo 75 mm / obús de 105)
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
    if (era === 'D') {                                                                                        // Maxim / Vickers sobre trípode (sin ruedas)
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
function trackLoop(g, part, prof, w, x, zoneSide) {
  const len = []; let L = 0; for (let i = 0; i < prof.length; i++) { len.push(L); const a = prof[i], b = prof[(i + 1) % prof.length]; L += Math.hypot(a[0] - b[0], a[1] - b[1]); }
  for (let i = 0; i < prof.length; i++) {
    const a = prof[i], b = prof[(i + 1) % prof.length], u0 = len[i] * 4, u1 = (len[i] + Math.hypot(a[0] - b[0], a[1] - b[1])) * 4;
    const A0 = [x + w / 2, a[1], a[0]], B0 = [x + w / 2, b[1], b[0]], A1 = [x - w / 2, a[1], a[0]], B1 = [x - w / 2, b[1], b[0]];
    g.tri(A0, A1, B1, part, Z.FIX, C.oruga, 0, [0, u0], [0, u0], [0, u1]); g.tri(A0, B1, B0, part, Z.FIX, C.oruga, 0, [0, u0], [0, u1], [0, u1]);
  }
  [x + w / 2, x - w / 2].forEach(xx => { for (let i = 1; i < prof.length - 1; i++) { const a = prof[0], b = prof[i], c = prof[i + 1]; const pa = [xx, a[1], a[0]], pb = [xx, b[1], b[0]], pc = [xx, c[1], c[0]]; if (xx > x) g.tri(pa, pc, pb, part, zoneSide, 0); else g.tri(pa, pb, pc, part, zoneSide, 0); } });
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
  ['orugaIz', 'orugaDe'].forEach(k => trackLoop(g, P[k], [[2.05, 1.35], [1.65, 0.22], [-1.45, 0.1], [-1.9, 0.55], [-1.55, 1.05], [1.55, 1.48]], 0.34, 0, VZ));
  return g;
}
// tanque romboidal Mark I «macho» (1916): orugas alrededor del casco, barbetas laterales con cañones de 6 libras, ruedas de cola
function buildMarkI(o) {
  const g = new GeoBuilder(), P = rigIndex('markI'), VZ = Z.VEH;
  const prof = [[4.9, 2.0], [3.4, 0.05], [-3.3, 0.05], [-4.1, 1.15], [-3.8, 2.45], [3.7, 2.45]];
  ['orugaIz', 'orugaDe'].forEach(k => trackLoop(g, P[k], prof, 0.56, 0, VZ));
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
  if (o.era === 'D') { for (let r = 0; r < 3; r++) for (let i = 0; i < 6 - (r === 2 ? 1 : 0); i++) g.box(0, Z.FIX, r % 2 ? C.saco : 0x9a8c68, [-1.75 + i * 0.7 + (r % 2) * 0.35, 0.15 + r * 0.3, 0], [0.66, 0.28, 0.42], {bottom: false, noBack: r < 2}); }
  else { for (let i = 0; i < 6; i++) g.cyl(0, Z.FIX, C.mimbre, [-1.75 + i * 0.7, 0.5, 0.35], 0.32, 0.32, 1.0, 6, {top: true, topColor: C.tierra}); g.box(0, Z.FIX, C.tierra, [0, 0.45, -0.35], [4.2, 0.9, 0.8], {taperZ: 0.6}); }
  return g;
}

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
  g.cyl(P.brazoIz, Z.MAIN, 0, [0, -0.15, 0.1], 0.05, 0.06, 0.4, 3, {rot: [-35, 0, 0]});                        // 6
  g.cyl(P.brazoDe, Z.MAIN, 0, [0, -0.26, 0], 0.05, 0.06, 0.56, 3);                                            // 6
  lodWeapon(g, P.arma, {husar: 'sable', coracero: 'sable', dragon: 'sable', lancero: 'lanza', general: 'sable', ayudante: 'sable', mariscal: 'baston', estandarte: 'astil_jinete'}[o.tipo || 'husar'], o);   // 6–12
  return g;
}
function lodCannon(o, lvl) {
  const g = new GeoBuilder(), P = rigIndex('canon'), col = o.era === 'D' ? 0x5a5c4a : 0x5e6a48, mg = o.tipo === 'mg' && o.era === 'D';
  if (lvl === 2) {
    if (!mg) ['ruedaIz', 'ruedaDe'].forEach(k => g.quad([0, -0.6, -0.6], [0, -0.6, 0.6], [0, 0.6, 0.6], [0, 0.6, -0.6], P[k], Z.FIX, C.madera));
    g.quad([-0.15, 0.2, -1.8], [0.15, 0.2, -1.8], [0.15, 0.62, 0.3], [-0.15, 0.62, 0.3], P.cureña, Z.FIX, col);
    g.quad([0, -0.12, -0.6], [0, -0.12, 1.2], [0, 0.12, 1.2], [0, 0.12, -0.6], P.tubo, Z.FIX, 0x3a3c38); return g;
  }
  g.box(P.cureña, Z.FIX, col, [0, 0.42, -0.85], [0.2, 0.14, 2.0], {rot: [-14, 0, 0]});
  g.box(P.cureña, Z.FIX, col, [0, 0.7, 0.15], [0.46, 0.22, 0.5]);
  if (o.era === 'D' && o.tipo !== 'mg') g.quad([-0.52, 0.5, 0.42], [0.52, 0.5, 0.42], [0.46, 1.4, 0.42], [-0.46, 1.4, 0.42], P.cureña, Z.FIX, 0x5f6250);
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
function lodParapet(o, lvl) { const g = new GeoBuilder(); g.box(0, Z.FIX, o.era === 'D' ? C.saco : C.tierra, [0, 0.45, 0], [4.2, 0.9, 1.0], {taperZ: 0.3, noTop: lvl === 2}); return g; }

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
  oficial: {rig: 'soldado', clase: 'inf', pal: 'linea', nombre: 'Oficial a pie', o: (era, nat) => ({era, toc: era === 'D' ? 'gorra' : hg(nat, era, 'linea'), arma: 'espada', rango: 'oficial', mochila: false, charreteras: true, correaje: false, cartucheras: false, catalejo: true})},
  abanderado: {rig: 'soldado', clase: 'inf', pal: 'linea', dobleCara: true, nombre: 'Portaestandarte', o: (era, nat) => ({era, toc: hg(nat, era, 'linea'), arma: 'astil', mochila: false, correaje: false, cartucheras: false, flagLayout: (NACIONES[nat] || NACIONES.GEN).bandera, unBrazo: true})},
  zapador: {rig: 'soldado', clase: 'inf', pal: 'linea', nombre: 'Zapador / ingeniero', o: (era, nat) => ({era, toc: hg(nat, era, 'linea'), arma: 'pala', espalda: 'pala', mochila: false})},
  sanitario: {rig: 'soldado', clase: 'inf', pal: 'linea', roles: ['delante', 'detras'], nombre: 'Sanitario con camilla', o: (era, nat, rol) => ({era, toc: hg(nat, era, 'linea'), arma: rol === 'detras' ? 'ninguna' : 'camilla', mochila: false, correaje: false, cartucheras: false, brazalete: era !== 'A', unBrazo: true})},
  prisionero: {rig: 'soldado', clase: 'inf', pal: 'linea', nombre: 'Prisionero', o: (era, nat) => ({era, toc: hg(nat, era, 'linea'), arma: 'ninguna', mochila: false, cartucheras: false})},
  herido: {rig: 'soldado', clase: 'inf', pal: 'linea', nombre: 'Herido', o: (era, nat) => ({era, toc: hg(nat, era, 'linea'), arma: 'ninguna', mochila: false, cartucheras: false})},
  artillero: {rig: 'soldado', clase: 'art', pal: 'artilleria', roles: Object.keys(ROLE_ARMA), nombre: 'Servidor de pieza', o: (era, nat, rol) => ({era, lite: true, toc: hg(nat, era, 'artilleria'), arma: rol === 'cargador' && !AB(era) ? 'proyectil' : rol === 'artillero' && !AB(era) ? 'ninguna' : ROLE_ARMA[rol || 'cargador'], mochila: false})},
  husar: Object.assign(RIDER('husar', 'caballeria'), {nombre: 'Húsar'}),
  coracero: Object.assign(RIDER('coracero', 'linea', (era, nat) => era === 'D' ? hg(nat, era, 'linea') : 'casco_cor'), {nombre: 'Coracero'}),
  lancero: Object.assign(RIDER('lancero', 'caballeria', (era, nat) => era === 'D' ? hg(nat, era, 'linea') : 'czapka'), {dobleCara: true, nombre: 'Lancero'}),
  dragon: Object.assign(RIDER('dragon', 'linea', (era, nat) => AB(era) ? 'casco_dragon' : hg(nat, era, 'linea')), {nombre: 'Dragón'}),
  general: Object.assign(RIDER('general', 'estado_mayor', (era, nat) => era === 'D' ? 'gorra' : hg(nat, era, 'estado_mayor')), {nombre: 'General a caballo'}),
  ayudante: Object.assign(RIDER('ayudante', 'estado_mayor', (era, nat) => era === 'D' ? 'gorra' : hg(nat, era, 'linea')), {nombre: 'Ayudante de campo'}),
  mariscal: Object.assign(RIDER('mariscal', 'estado_mayor', era => era === 'D' ? 'gorra' : 'bicornio'), {nombre: 'Mariscal'}),
  mensajero: Object.assign(RIDER('mensajero', 'linea'), {nombre: 'Mensajero a caballo'}),
  estandarte: Object.assign(RIDER('estandarte', 'estado_mayor', (era, nat) => era === 'D' ? 'gorra' : hg(nat, era, 'linea')), {dobleCara: true, nombre: 'Estandarte de mando'}),
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
Object.values(KINDS).forEach(k => { if (k.rig === 'soldado') { k.build = buildSoldier; k.lod = lodSoldier; } k.eras = k.eras || TROOP_ERAS.slice(); });
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
const KNEEL = {musloIz: [[0, -85, 0, 4]], piernaIz: [[0, 85, 0, 0]], musloDe: [[0, -8, 0, -4]], piernaDe: [[0, 95, 0, 0]]};
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
function sampleTrack(tr, t, out, n) {                  // tr: [[t, a, b, c...]] ordenado; t en [0,1]
  if (!tr || !tr.length) { for (let i = 0; i < n; i++) out[i] = 0; return out; }
  if (tr.length === 1 || t <= tr[0][0]) { for (let i = 0; i < n; i++) out[i] = tr[0][i + 1]; return out; }
  for (let k = 0; k < tr.length - 1; k++) {
    const a = tr[k], b = tr[k + 1];
    if (t <= b[0]) { const u = smooth((t - a[0]) / Math.max(1e-6, b[0] - a[0])); for (let i = 0; i < n; i++) out[i] = a[i + 1] + (b[i + 1] - a[i + 1]) * u; return out; }
  }
  const l = tr[tr.length - 1]; for (let i = 0; i < n; i++) out[i] = l[i + 1]; return out;
}
const _r3 = [0, 0, 0], _t3 = [0, 0, 0], _t1 = [0];
function sampleStep(tr, t, out, n) { let k = 0; for (let i = 0; i < tr.length; i++) if (tr[i][0] <= t + 1e-6) k = i; for (let i = 0; i < n; i++) out[i] = tr[k][i + 1]; return out; }
// poseTroop(tipo o esqueleto, clip, fase, salida Float32Array(MAXP*16)) → matrices de cada parte en el espacio de la figura
function poseTroop(kindOrRig, clipName, phase, out) {
  const rig = RIGS[kindOrRig] ? kindOrRig : KINDS[kindOrRig].rig, parts = RIGS[rig], clip = (CLIPS[rig] || {})[clipName] || {tracks: {}};
  out = out || new Float32Array(MAXP * 16); const t = clip.loop === false ? Math.min(1, Math.max(0, phase)) : phase - Math.floor(phase);
  for (let i = 0; i < parts.length; i++) {
    const name = parts[i][0], par = parts[i][1], off = parts[i][2];
    sampleTrack(clip.tracks[name], t, _r3, 3);
    _e.set(_r3[0] * D2R, _r3[1] * D2R, _r3[2] * D2R); _q.setFromEuler(_e);
    _p.set(off[0], off[1], off[2]);
    if (par < 0 && clip.root) { sampleTrack(clip.root, t, _t3, 3); _p.x += _t3[0]; _p.y += _t3[1]; _p.z += _t3[2]; }
    if (name === 'tubo' && clip.slide) { sampleTrack(clip.slide, t, _t1, 1); _p.z += _t1[0]; }
    if (name === 'canon' && clip.gunSlide) { sampleTrack(clip.gunSlide, t, _t1, 1); _p.z += _t1[0]; }
    _m.compose(_p, _q, _s);
    if (par >= 0) { _pm.fromArray(out, par * 16); _m.premultiply(_pm); }
    _m.toArray(out, i * 16);
  }
  if (clip.tracks.armaP) ikWeapon(parts, clip, t, out);
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
// Una fila por fotograma; MAXP × 3 texeles RGBA float por fila (matriz 3×4 por parte). Bucles a 16 fps, no-bucles a 24 fps, ≤ 96 fotogramas por clip.
let _baked = null;
function bakeClips() {
  if (_baked) return _baked;
  const rows = [], index = {}; let row = 0;
  Object.keys(CLIPS).forEach(rig => {
    if (!RIGS[rig] || !RIGS[rig].length) return;
    index[rig] = {};
    Object.keys(CLIPS[rig]).forEach(cn => {
      const c = CLIPS[rig][cn]; if (!c) return;
      const frames = Math.max(2, Math.min(96, Math.round(c.dur * (c.loop === false ? 24 : 16))));
      index[rig][cn] = {row, frames, dur: c.dur, loop: c.loop !== false, tread: c.tread || 0, ev: c.ev || []};
      for (let f = 0; f < frames; f++) { const ph = c.loop === false ? f / (frames - 1) : f / frames; rows.push(poseTroop(rig, cn, ph)); }
      row += frames;
    });
  });
  const W = MAXP * 3, H = rows.length, data = new Float32Array(W * H * 4);
  rows.forEach((m, r) => { for (let p = 0; p < MAXP; p++) { const o = (r * W + p * 3) * 4, e = m.subarray(p * 16, p * 16 + 16);
    for (let i = 0; i < 3; i++) { data[o + i * 4] = e[i]; data[o + i * 4 + 1] = e[4 + i]; data[o + i * 4 + 2] = e[8 + i]; data[o + i * 4 + 3] = e[12 + i]; } } });
  const tex = new THREE.DataTexture(data, W, H, THREE.RGBAFormat, THREE.FloatType); tex.needsUpdate = true; tex.magFilter = tex.minFilter = THREE.NearestFilter;
  if (H > 4096) console.warn('troops3d: la textura de huesos tiene ' + H + ' filas (> 4096, límite de algunos móviles)');
  _baked = {tex, index, rows, W, H, bytes: data.byteLength}; return _baked;
}

/* ---------------- paletas en textura ---------------- */
// fila 0: tonos de piel (0–3) y pelajes (4–7); filas siguientes: una por nación × época × papel
const SKIN = ['#f0c8a0', '#d9a77e', '#b07a50', '#7a4e30'], HORSE = ['#8a5430', '#a8683a', '#3a322c', '#b8b0a2'];
function makePaletteTex(entries) {
  const W = 8, H = 1 + entries.length, d = new Uint8Array(W * H * 4), put = (r, c, hex) => { const v = new THREE.Color(hex), o = (r * W + c) * 4; /* Color(hex) ya es lineal (ColorManagement de r152): se guarda en sRGB */ d[o] = Math.round(Math.pow(v.r, 1 / 2.2) * 255); d[o + 1] = Math.round(Math.pow(v.g, 1 / 2.2) * 255); d[o + 2] = Math.round(Math.pow(v.b, 1 / 2.2) * 255); d[o + 3] = 255; };
  SKIN.forEach((h, i) => put(0, i, h)); HORSE.forEach((h, i) => put(0, 4 + i, h));
  entries.forEach((e, r) => { const p = uniformPalette(e[0], e[1], e[2]); [p.main, p.trim, p.accessory, p.hat, p.flag[0], p.flag[1], p.flag[2], p.vehicle].forEach((h, c) => put(r + 1, c, h)); });
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
    sh.uniforms.uBones = shared.bonesU; sh.uniforms.uBonesSize = shared.bonesSizeU; sh.uniforms.uPal = shared.palU; sh.uniforms.uPalSize = shared.palSizeU; sh.uniforms.uTime = shared.timeU; sh.uniforms.uBlend = shared.blendU; sh.uniforms.uDebug = shared.debugU;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>
uniform sampler2D uBones; uniform vec2 uBonesSize; uniform sampler2D uPal; uniform vec2 uPalSize; uniform float uTime; uniform float uBlend; uniform float uDebug;
attribute float aPart; attribute float aZone; attribute float aVar; attribute vec2 aFx;
attribute vec4 iAnimA; attribute vec4 iAnimB; attribute vec4 iLook;
varying float vTread;
vec4 bt(float x, float y) { return texture2D(uBones, vec2((x + 0.5) / uBonesSize.x, (y + 0.5) / uBonesSize.y)); }
mat4 boneAt(float row, float part) { float x = part * 3.0; vec4 a = bt(x, row), b = bt(x + 1.0, row), c = bt(x + 2.0, row);
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
vTread = aFx.y > 0.0 ? aFx.y + uTime * iLook.w : -1.0;`)
      .replace('#include <color_vertex>', `float palRow = floor(iLook.x), bright = 0.92 + fract(iLook.x) * 0.16;
vec3 zc = aZone < 7.5 ? texture2D(uPal, vec2((aZone + 0.5) / uPalSize.x, (palRow + 1.5) / uPalSize.y)).rgb : color;
if (aVar > 0.5 && aVar < 1.5) zc = texture2D(uPal, vec2((iLook.y + 0.5) / uPalSize.x, 0.5 / uPalSize.y)).rgb;
if (aVar > 1.5) zc = texture2D(uPal, vec2((4.0 + iLook.z + 0.5) / uPalSize.x, 0.5 / uPalSize.y)).rgb;
if (uDebug > 0.5 && aZone > 7.5) zc = vec3(0.55);
vColor = zc * (aZone < 2.5 || aZone > 6.5 && aZone < 7.5 ? bright : 1.0);`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vTread;')
      .replace('#include <color_fragment>', `#include <color_fragment>
if (vTread >= 0.0) diffuseColor.rgb *= 0.7 + 0.45 * step(0.5, fract(vTread));`);
  };
  mat.customProgramCacheKey = () => 'troopVAT';
  return mat;
}

/* ---------------- API: buildTroop ---------------- */
const _cache = {};
function nearestEra(K, era) { if (K.eras.includes(era)) return era; const i = TROOP_ERAS.indexOf(era); for (let d = 1; d < 4; d++) { if (K.eras.includes(TROOP_ERAS[i - d])) return TROOP_ERAS[i - d]; if (K.eras.includes(TROOP_ERAS[i + d])) return TROOP_ERAS[i + d]; } return K.eras[0]; }
// buildTroop(tipo, época, {nation, role}) → {tint, fixed, geometry, parts, clips, lod: [{level, geometry, tint, fixed, tris}×3], tris, rig, era}
function buildTroop(kind, era, opts) {
  opts = opts || {}; const K = KINDS[kind]; if (!K) throw new Error('tipo desconocido: ' + kind);
  era = nearestEra(K, era || 'A');
  const nat = opts.nation || 'GEN', o = K.o(era, nat, opts.role), key = [kind, era, o.toc || '', o.flagLayout || '', opts.role || ''].join('|');
  if (_cache[key]) return _cache[key];
  const lv = [K.build(o), K.lod(o, 1), K.lod(o, 2)].map((g, level) => ({level, geometry: g.toGeometry(), tint: g.toGeometry(z => z < 7.5), fixed: g.toGeometry(z => z >= 7.5), tris: g.tris()}));
  const res = {kind, era, rig: K.rig, parts: RIGS[K.rig].map(p => p[0]), clips: CLIP_SETS[K.rig] || [], tris: lv[0].tris, geometry: lv[0].geometry, tint: lv[0].tint, fixed: lv[0].fixed, lod: lv, headgear: o.toc || null};
  _cache[key] = res; return res;
}
// clave de geometría: las naciones con el mismo tocado (y bandera) comparten malla y lote
function troopGeoKey(kind, era, nation) { const K = KINDS[kind], e = nearestEra(K, era), o = K.o(e, nation || 'GEN'); return [kind, e, o.toc || '', o.flagLayout || ''].join('|'); }

/* ---------------- campo de tropas instanciadas (GPU) ---------------- */
// TroopShared(naciones, {eras}): eras = épocas con fila de paleta (por defecto las 4; con muchos países, pasa solo la época actual)
function TroopShared(nations, opts) {
  const baked = bakeClips(); this.baked = baked; this.nations = []; this.eras = (opts && opts.eras) || TROOP_ERAS.slice();
  this.bonesU = {value: baked.tex}; this.bonesSizeU = {value: new THREE.Vector2(baked.W, baked.H)}; this.palU = {value: null}; this.palSizeU = {value: new THREE.Vector2(8, 1)};
  this.timeU = {value: 0}; this.blendU = {value: 0.22}; this.debugU = {value: 0};
  this.addNations(nations || ['GEN']);
}
// addNations: añade naciones (p. ej. países del juego registrados en NACIONES) y rehace la textura de paletas
TroopShared.prototype.addNations = function (list) {
  list.forEach(n => { if (!this.nations.includes(n)) this.nations.push(n); }); if (!this.nations.includes('GEN')) this.nations.push('GEN');
  this.palEntries = []; this._row = {};
  this.nations.forEach(n => this.eras.forEach(e => ROLES.forEach(r => { this._row[n + e + r] = this.palEntries.length; this.palEntries.push([n, e, r]); })));
  if (this.palTex) this.palTex.dispose(); this.palTex = makePaletteTex(this.palEntries); this.palU.value = this.palTex; this.palSizeU.value.set(8, 1 + this.palEntries.length);
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
  const pal = uniformPalette(nation, t.era, K.pal), zc = [pal.main, pal.trim, pal.accessory, pal.hat, pal.flag[0], pal.flag[1], pal.flag[2], pal.vehicle].map(h => new THREE.Color(h)), skin = new THREE.Color(SKIN[1]), coat = new THREE.Color(HORSE[0]);
  this.meshes = []; this.rig = t.rig; this.kind = kind; this.cap = cap; this.count = 0; this.parts = parts; this.tris = t.lod[opts.lod || 0].tris;
  for (let p = 0; p < parts; p++) {
    const idx = []; for (let v = 0; v < pa.length; v++) if (pa[v] === p) idx.push(v); if (!idx.length) { this.meshes.push(null); continue; }
    const gp = new THREE.BufferGeometry(), pp = new Float32Array(idx.length * 3), nn = new Float32Array(idx.length * 3), cc = new Float32Array(idx.length * 3);
    idx.forEach((v, k) => { for (let j = 0; j < 3; j++) { pp[k * 3 + j] = P[v * 3 + j]; nn[k * 3 + j] = N[v * 3 + j]; } const z = Zo[v]; const c = Vr[v] === 1 ? skin : Vr[v] === 2 ? coat : z < 7.5 ? zc[z] : null; cc[k * 3] = c ? c.r : Co[v * 3]; cc[k * 3 + 1] = c ? c.g : Co[v * 3 + 1]; cc[k * 3 + 2] = c ? c.b : Co[v * 3 + 2]; });
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
  if (name === 'ametralladora') { const f = estado === 'fuego'; return [{kind: 'ametralladora', at: [0, 0, 0], clip: f ? 'fuego_mg' : 'en_bateria'}, {kind: 'artillero', role: 'tirador_mg', at: [0, era === 'D' ? -0.95 : -1.45, 0], clip: f ? 'srv_mg_tirador' : 'idle'}, {kind: 'artillero', role: 'municion', at: [0.75, era === 'D' ? -0.5 : -0.9, -40], clip: f ? 'srv_mg_municion' : 'idle'}]; }
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
  return JSON.stringify({version: 2, fps: {bucle: 16, sinBucle: 24}, convenciones: 'pistas [t, rx, ry, rz] en grados (Euler XYZ); raíz [t, x, y, z] en metros; eventos [t, nombre]; agarre [t, y mano derecha, y mano izquierda]; hide [t, visible]', partes: RIGS, clips: CLIPS}, r);
}

/* ---------------- estadísticas ---------------- */
function troopStats() {
  const out = [], LIM = {inf: [220, 60, 10], cav: [420, 120, 10], art: [700, null, null], tank: [600, null, null]};
  TROOP_KINDS.forEach(k => KINDS[k].eras.forEach(e => {
    const roles = KINDS[k].roles ? [KINDS[k].roles[0]] : [undefined];
    roles.forEach(role => { const t = buildTroop(k, e, {nation: 'GEN', role}); const verts = t.lod[0].tris * 3;
      out.push({tipo: k, epoca: e, triangulos: t.lod[0].tris, lod1: t.lod[1].tris, lod2: t.lod[2].tris, partes: RIGS[t.rig].length, clips: t.clips.length, vertices: verts, bytesInstancia: 64 + 48, limite: (LIM[KINDS[k].clase] || [])[0] || null}); });
  }));
  return out;
}

const api = {TROOP_KINDS, TROOP_ERAS, KINDS, RIGS, CLIPS, NACIONES, ROLES, MAXP, buildTroop, poseTroop, blendPose, uniformPalette, troopStats, bakeClips, makeTroopMaterial, TroopShared, TroopBatch, TroopLodSet, CpuBatch,
  TROOP_GROUPS, troopGroup, troopGeoKey, clipInfo, clipPhase, eventsBetween, exportClipsJSON, SKIN, HORSE};
root.Troops3D = api;
['TROOP_KINDS', 'TROOP_ERAS', 'buildTroop', 'poseTroop', 'blendPose', 'uniformPalette', 'troopStats'].forEach(k => { root[k] = api[k]; });
})(typeof window !== 'undefined' ? window : globalThis);
