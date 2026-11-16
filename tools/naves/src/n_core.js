/* ===== naves3d.js — buques, aviones y defensa antiaérea 3D para Victoria (three.js r152, sin archivos externos) =====
   Misma técnica que troops3d.js, adaptada a máquinas:
   · Esqueleto pequeño (≤ 8 partes) cuyas matrices se hornean por clip en una textura (balanceo, cabeceo, hundimiento, partirse en dos,
     inmersión, alabeo, picado, barrena, ascensores…). Una parte «param» no tiene geometría: su traslación lleva 3 escalares por fotograma
     (x = tren de aterrizaje plegado, y = retroceso de los cañones, z = compuertas de bombas).
   · Movimiento procedural por vértice en el shader, sin huesos: cada vértice lleva un tipo (aKind) y un pivote (aPiv):
       1/11 torre (giro = rumbo de puntería de la instancia; 11 = mira a popa en reposo)   2/12 cañón de torre (giro + elevación + retroceso)
       3 montaje antiaéreo (giro AA)   4 cañón antiaéreo (giro + elevación AA + retroceso)   5 radar (gira en Y)   6 hélice (gira en Z con la
       velocidad de la instancia)   7 tren de aterrizaje (se pliega con param.x)   8 compuerta de bombas (param.z)   9 bandera (ondea).
     La puntería es por instancia (iAim = rumbo y elevación de las torres, rumbo y elevación de la AA), así que cada buque o avión apunta a su
     blanco sin hornear nada: la CPU solo escribe 4 números por instancia cuando cambia el blanco.
   · Colores por zona (0 pintura principal, 1 camuflaje / superficie superior, 2 obra viva o panza, 3 cubierta, 4–6 bandera, 7 franja
     nacional, 8–10 marca nacional, 11 banda de identificación, ≥ 12 fijo) leídos de una textura de paletas por nación y época.
   API: NAVE_KINDS, NAVE_ERAS, buildNave, poseNave, blendPose, navePalette, naveGeoKey, NaveShared, NaveBatch, NaveLodSet, naveStats,
        clipInfo, clipPhase, eventsBetween, exportClipsJSON, NAVE_MAP (tipos del juego → tipos de naves3d). */
(function (root) {
'use strict';
const THREE = root.THREE, D2R = Math.PI / 180;
const NAVE_ERAS = ['1', '2'];
const MAXP = 8, PARAM = 7;                              // la parte 7 de cada esqueleto es «param»
const Z = {MAIN: 0, TRIM: 1, ACC: 2, DECK: 3, F1: 4, F2: 5, F3: 6, BAND: 7, M1: 8, M2: 9, M3: 10, ID: 11, FIX: 12};
const K = {NONE: 0, TURRET: 1, GUN: 2, AA: 3, AAGUN: 4, RADAR: 5, PROP: 6, GEAR: 7, DOOR: 8, FLAG: 9, TURRET_AFT: 11, GUN_AFT: 12};
const C = {acero: 0x6e7478, oscuro: 0x2c3034, negro: 0x1a1a1c, madera: 0x9a7a52, cristal: 0x3a4a56, goma: 0x222222, laton: 0xb89848, blanco: 0xe8e6de,
  helice: 0x2a2826, mastil: 0x5a5e62, lona: 0x8a8466, rojo: 0xb02020, piel: 0xe0b48c, bote: 0xd8d4c8};

/* ---------- geometría con atributos de animación procedural ---------- */
const _cc = new THREE.Color();
function xf(pts, at, rot) {
  if (!rot) return pts.map(q => [q[0] + at[0], q[1] + at[1], q[2] + at[2]]);
  const [rx, ry, rz] = rot.map(a => a * D2R), cx = Math.cos(rx), sx = Math.sin(rx), cy = Math.cos(ry), sy = Math.sin(ry), cz = Math.cos(rz), sz = Math.sin(rz);
  return pts.map(([x, y, z]) => { let x1 = x * cz - y * sz, y1 = x * sz + y * cz, z1 = z; let x2 = x1 * cy + z1 * sy, y2 = y1, z2 = -x1 * sy + z1 * cy; return [x2 + at[0], y2 * cx - z2 * sx + at[1], y2 * sx + z2 * cx + at[2]]; });
}
function GB() { this.p = []; this.n = []; this.part = []; this.zone = []; this.col = []; this.kind = []; this.piv = []; this.aux = []; this.fx = []; this.ctx = {k: 0, piv: [0, 0, 0], aux: [0, 0], part: 0, fx: null}; }
// set(tipo, pivote, aux, rumboReposo): rumboReposo (rad) se guarda en aFx.x para torres y montajes (0 = a proa)
// arco (opcional): centro del sector de tiro de un montaje lateral o de una torreta de avión; se guarda en aFx.y + 10 (límite ±1,6 rad)
GB.prototype.set = function (k, piv, aux, rest, arc) { this.ctx.k = k || 0; this.ctx.piv = piv || [0, 0, 0]; this.ctx.aux = aux || [0, 0]; this.ctx.fx = rest || arc != null ? [rest || 0, arc != null ? arc + 10 : 0] : null; return this; };
GB.prototype.on = function (part) { this.ctx.part = part; return this; };
GB.prototype.tri = function (a, b, c, zone, color, fa, fb, fc) {
  const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
  let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
  const cc = _cc.set(color || 0), x = this.ctx;
  [a, b, c].forEach((q, i) => { this.p.push(q[0], q[1], q[2]); this.n.push(nx, ny, nz); this.part.push(x.part); this.zone.push(zone); this.col.push(cc.r, cc.g, cc.b); this.kind.push(x.k); this.piv.push(x.piv[0], x.piv[1], x.piv[2]); this.aux.push(x.aux[0], x.aux[1]); const f = [fa, fb, fc][i] || x.fx || [0, 0]; this.fx.push(f[0], f[1]); });
};
GB.prototype.quad = function (a, b, c, d, zone, color) { this.tri(a, b, c, zone, color); this.tri(a, c, d, zone, color); };
GB.prototype.box = function (zone, color, at, size, o) {
  o = o || {}; const [w, h, d] = size, t = o.taper || 0, tz = o.taperZ != null ? o.taperZ : t, x0 = w / 2, z0 = d / 2, x1 = x0 * (1 - t), z1 = z0 * (1 - tz), y0 = -h / 2, y1 = h / 2, sk = o.skewZ || 0, bt = o.bottomTaper || 0;
  const v = xf([[-x0 * (1 - bt), y0, z0], [x0 * (1 - bt), y0, z0], [x0 * (1 - bt), y0, -z0], [-x0 * (1 - bt), y0, -z0], [-x1, y1, z1 + sk], [x1, y1, z1 + sk], [x1, y1, -z1 + sk], [-x1, y1, -z1 + sk]], at, o.rot);
  const Q = (a, b, c, d, zz) => this.quad(v[a], v[b], v[c], v[d], zz != null ? zz : zone, color);
  if (!o.noFront) Q(0, 1, 5, 4); Q(1, 2, 6, 5); if (!o.noBack) Q(2, 3, 7, 6); Q(3, 0, 4, 7);
  if (!o.noTop) { if (o.topColor != null) this.quad(v[4], v[5], v[6], v[7], o.topZone != null ? o.topZone : zone, o.topColor); else Q(4, 5, 6, 7, o.topZone); } if (o.bottom) Q(3, 2, 1, 0);
  return this;
};
GB.prototype.cyl = function (zone, color, at, r0, r1, h, n, o) {
  o = o || {}; const pts = [], top = [], sx = o.sx || 1, sz = o.sz || 1, a0 = o.a0 != null ? o.a0 : Math.PI / n;
  for (let i = 0; i < n; i++) { const a = a0 + i / n * Math.PI * 2; pts.push([Math.cos(a) * r0 * sx, -h / 2, Math.sin(a) * r0 * sz]); top.push([Math.cos(a) * r1 * sx, h / 2, Math.sin(a) * r1 * sz]); }
  const vb = xf(pts, at, o.rot), vt = xf(top, at, o.rot), ct = xf([[0, h / 2 + (o.dome || 0), 0]], at, o.rot)[0], cb = xf([[0, -h / 2, 0]], at, o.rot)[0];
  for (let i = 0; i < n; i++) { const j = (i + 1) % n; if (r1 > 0 && r0 > 0) this.quad(vb[j], vb[i], vt[i], vt[j], zone, color); else if (r1 > 0) this.tri(cb, vt[i], vt[j], zone, color); else this.tri(vb[j], vb[i], ct, zone, color); }
  if (o.top && r1 > 0) for (let i = 0; i < n; i++) { const j = (i + 1) % n; this.tri(vt[j], vt[i], ct, o.topZone != null ? o.topZone : zone, o.topColor != null ? o.topColor : color); }
  if (o.bottom && r0 > 0) for (let i = 0; i < n; i++) { const j = (i + 1) % n; this.tri(vb[i], vb[j], cb, zone, color); }
  return this;
};
// disco en el plano local XY (normal +Z), girado con rot; dos caras si o.two
GB.prototype.disc = function (zone, color, at, r, n, o) {
  o = o || {}; const P = (x, y) => xf([[x, y, o.z || 0]], at, o.rot)[0], c = P(0, 0);
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2, b = ((i + 1) / n) * Math.PI * 2, p = P(Math.cos(a) * r, Math.sin(a) * r), q = P(Math.cos(b) * r, Math.sin(b) * r); this.tri(c, p, q, zone, color); if (o.two) this.tri(c, q, p, zone, color); }
  return this;
};
// polígono plano (lista de [x, y] en el plano local XY), en abanico; normal +Z
GB.prototype.poly = function (zone, color, pts2, at, rot, two) {
  const P = xf(pts2.map(q => [q[0], q[1], 0]), at, rot);
  for (let i = 1; i < P.length - 1; i++) { this.tri(P[0], P[i], P[i + 1], zone, color); if (two) this.tri(P[0], P[i + 1], P[i], zone, color); }
  return this;
};
// calcomanía plana: puntos 2D sobre la base (U, V) centrada en c; normal = U × V
GB.prototype.decal = function (zone, color, c, U, V, pts2) {
  const P = pts2.map(([a, b]) => [c[0] + U[0] * a + V[0] * b, c[1] + U[1] * a + V[1] * b, c[2] + U[2] * a + V[2] * b]);
  for (let i = 1; i < P.length - 1; i++) this.tri(P[0], P[i], P[i + 1], zone, color); return this;
};
GB.prototype.ring = function (zone, color, c, U, V, r, n) { const pts = []; for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; pts.push([Math.cos(a) * r, Math.sin(a) * r]); } return this.decal(zone, color, c, U, V, pts); };
GB.prototype.tris = function () { return this.p.length / 9; };
// atributos empaquetados (WebGL1 garantiza 16): aInfo = (parte, zona, tipo), aPiv = pivote, aAF = (aux.x, aux.y, fx.x, fx.y)
GB.prototype.toGeometry = function (filter) {
  const g = new THREE.BufferGeometry(), keep = []; for (let t = 0; t < this.p.length / 9; t++) if (!filter || filter(this.zone[t * 3])) keep.push(t);
  const N = keep.length * 3, A = n => new Float32Array(N * n), out = {position: A(3), normal: A(3), color: A(3), aInfo: A(3), aPiv: A(3), aAF: A(4)};
  keep.forEach((t, k) => { for (let v = 0; v < 3; v++) { const s = t * 3 + v, d = k * 3 + v;
    for (let i = 0; i < 3; i++) { out.position[d * 3 + i] = this.p[s * 3 + i]; out.normal[d * 3 + i] = this.n[s * 3 + i]; out.color[d * 3 + i] = this.col[s * 3 + i]; out.aPiv[d * 3 + i] = this.piv[s * 3 + i]; }
    out.aInfo[d * 3] = this.part[s]; out.aInfo[d * 3 + 1] = this.zone[s]; out.aInfo[d * 3 + 2] = this.kind[s]; out.aAF[d * 4] = this.aux[s * 2]; out.aAF[d * 4 + 1] = this.aux[s * 2 + 1]; out.aAF[d * 4 + 2] = this.fx[s * 2]; out.aAF[d * 4 + 3] = this.fx[s * 2 + 1]; } });
  Object.keys(out).forEach(k => g.setAttribute(k, new THREE.BufferAttribute(out[k], k === 'aAF' ? 4 : 3)));
  g.computeBoundingSphere(); return g;
};
// bandera: lámina con u (distancia al asta, peso de la ondulación) y v; zonas por franjas como respaldo si no hay textura
GB.prototype.flag = function (at, w, h, layout, rot) {
  const prev = this.ctx.k; this.ctx.k = K.FLAG; const nx = 3, ny = 2;
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const x0 = i / nx * w, x1 = (i + 1) / nx * w, y0 = -j / ny * h, y1 = -(j + 1) / ny * h, z = layout === 'vert' ? Z.F1 + i : layout === 'horiz' ? Z.F1 + Math.min(2, j * 2) : Z.F1 + (i + j) % 2;
    const P = (x, y) => xf([[x, y, 0]], at, rot)[0], U = (x, y) => [x / w, -y / h];
    const a = P(x0, y0), b = P(x1, y0), c = P(x1, y1), d = P(x0, y1);
    this.tri(a, d, c, z, C.blanco, U(x0, y0), U(x0, y1), U(x1, y1)); this.tri(a, c, b, z, C.blanco, U(x0, y0), U(x1, y1), U(x1, y0));
    this.tri(a, c, d, z, C.blanco, U(x0, y0), U(x1, y1), U(x0, y1)); this.tri(a, b, c, z, C.blanco, U(x0, y0), U(x1, y0), U(x1, y1));
  }
  this.ctx.k = prev; return this;
};
