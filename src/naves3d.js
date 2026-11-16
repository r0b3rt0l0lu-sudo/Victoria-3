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

/* ---------- naciones: pintura de buques, aviones y defensa ---------- */
// Por nación y época hay tres dominios: mar (buques), aire (aviones) y tierra (antiaéreos y personal). c = [principal, camuflaje / superior,
// obra viva o panza, cubierta]. bandera / ensign: layout + 3 colores (respaldo si el juego no da la textura con b3FlagTex). marca: aviones.
// Fuentes: colores AP 507 de la Royal Navy; RLM 02/65/70/71 y Hellgrau/Dunkelgrau 50/51 de la Kriegsmarine; grises de los arsenales de
// Kure y Yokosuka y ameiro del A6M2 (Mitsubishi); colores aproximados donde se indica.
const DOMS = ['mar', 'aire', 'tierra'];
const NAVES_NAC = {
  GBR: {nombre: 'Reino Unido', band: '#c8102e',
    '1': {mar: {c: ['#8a8e90', '#62686c', '#5a2420', '#9a8a6a'], ens: ['cruz', '#f2f0ea', '#c8102e', '#1e2a6a'], nota: 'Gris de flota (Grand Fleet), cubiertas de teca.'},
      aire: {c: ['#5a5a3a', '#5a5a3a', '#d8d0b0', '#5a5a3a'], marca: ['roundel', '#1e3a8a', '#f2f0ea', '#c8102e'], id: '#f2f0ea', nota: 'PC10 caqui por encima y lino barnizado por debajo; escarapela RFC.'},
      tierra: {c: ['#6a6a4a', '#5a5a3a', '#6a6a4a', '#5a5a3a']}},
    '2': {mar: {c: ['#8c9398', '#5c656b', '#5e2a24', '#a08a68'], ens: ['cruz', '#f2f0ea', '#c8102e', '#1e2a6a'], nota: 'AP 507B gris medio y 507A gris oscuro; obra viva antiincrustante roja; teca en los acorazados, acero gris en los portaaviones.'},
      aire: {c: ['#3e4a2e', '#6b5a3f', '#c2c9a8', '#3e4a2e'], marca: ['roundel', '#1e3a8a', '#f2f0ea', '#c8102e'], id: '#e0b830', nota: 'Verde oscuro y tierra oscura por encima, Sky por debajo; escarapela tipo A1/B con anillo amarillo.'},
      tierra: {c: ['#6a6a4a', '#4e5236', '#6a6a4a', '#5a5a3a']}}},
  GER: {nombre: 'Alemania', band: '#3a3a3a',
    '1': {mar: {c: ['#8a9094', '#646a6e', '#5a2a24', '#a8926a'], ens: ['cruz', '#f2f0ea', '#1a1a1a', '#1a1a1a'], nota: 'Gris de la Kaiserliche Marine; Reichskriegsflagge simplificada (cruz negra sobre blanco).'},
      aire: {c: ['#5a5a6a', '#7a6a4a', '#9a9ab0', '#5a5a6a'], marca: ['balken', '#1a1a1a', '#f0ece2', '#1a1a1a'], id: '#f0ece2', nota: 'Tela de rombos (Lozenge) aproximada a dos tonos; cruz de hierro / Balkenkreuz de 1918.'},
      tierra: {c: ['#6f7462', '#5a5e50', '#6f7462', '#5a5e50']}},
    '2': {mar: {c: ['#a3a8aa', '#6a7074', '#5a2a24', '#b09a72'], ens: ['horiz', '#141414', '#f2f0ea', '#c8202a'], nota: 'Hellgrau 50 y Dunkelgrau 51; teca. Ensign: tricolor sin esvástica (decisión de diseño; aprox.).'},
      aire: {c: ['#3a4434', '#4a5038', '#a8bcc4', '#3a4434'], marca: ['balken', '#1a1a1a', '#f0ece2', '#1a1a1a'], id: '#e8c020', nota: 'RLM 70/71 en astillas por encima y RLM 65 por debajo; Balkenkreuz. Sin la esvástica de la deriva (decisión de diseño).'},
      tierra: {c: ['#5e6256', '#4b5156', '#5e6256', '#4b5156']}}},
  JPN: {nombre: 'Japón', band: '#bc002d',
    '1': {mar: {c: ['#7e8284', '#5e6264', '#6a2a22', '#9a7a52'], ens: ['disco', '#f2f0ea', '#bc002d', '#f2f0ea'], nota: 'Gris de la Armada Imperial; bandera del sol naciente simplificada (disco).'},
      aire: {c: ['#c8c0a0', '#c8c0a0', '#c8c0a0', '#c8c0a0'], marca: ['sol', '#bc002d', '#f2f0ea', '#bc002d'], id: '#f2f0ea', nota: 'Lino barnizado (aprox.).'},
      tierra: {c: ['#8a7e4a', '#7a6e48', '#8a7e4a', '#7a6e48']}},
    '2': {mar: {c: ['#7a7f80', '#5a5e60', '#6a2a22', '#8a6a4a'], ens: ['disco', '#f2f0ea', '#bc002d', '#f2f0ea'], nota: 'Gris de Kure; cubiertas de linóleo pardo y teca; cubiertas de vuelo de madera.'},
      aire: {c: ['#b8b49a', '#b8b49a', '#b8b49a', '#b8b49a'], marca: ['sol', '#bc002d', '#f2f0ea', '#bc002d'], id: '#e0b030', nota: 'A6M2 de 1941: ameiro (gris ámbar) uniforme; hinomaru; banda de identificación amarilla en el borde de ataque. Bombarderos: verde por encima.'},
      tierra: {c: ['#8a7e4a', '#6a6440', '#8a7e4a', '#7a6e48']}}},
  USA: {nombre: 'Estados Unidos', band: '#1f3f8f',
    '2': {mar: {c: ['#7c8590', '#4e5864', '#5a2a24', '#7a6a50'], ens: ['usa', '#b22234', '#f2f0ea', '#3c3b6e'], nota: 'Measure 21/22 (azul marino / gris); aprox.'},
      aire: {c: ['#4e5a6a', '#4e5a6a', '#c8ccc8', '#4e5a6a'], marca: ['estrella', '#f2f0ea', '#f2f0ea', '#1f3f8f'], id: '#f2f0ea', nota: 'Gris azulado y gris claro (Marina, 1942); estrella blanca sobre círculo azul.'},
      tierra: {c: ['#6b6438', '#5a5430', '#6b6438', '#5a5430']}}},
  FRA: {nombre: 'Francia', band: '#1f3f8f',
    '2': {mar: {c: ['#8a9094', '#626a6e', '#5a2a24', '#9a8a6a'], ens: ['vert', '#1f3f8f', '#f2f0ea', '#c8202a'], nota: 'Gris de la Marine nationale.'},
      aire: {c: ['#5a5a3a', '#7a6a4a', '#9aa4a8', '#5a5a3a'], marca: ['roundel', '#1f3f8f', '#f2f0ea', '#c8202a'], id: '#f2f0ea', nota: 'Camuflaje de tres tonos (aprox.).'},
      tierra: {c: ['#8a7e56', '#5a5440', '#8a7e56', '#5a5440']}}},
  ITA: {nombre: 'Italia', band: '#008c45',
    '2': {mar: {c: ['#9a9ea0', '#6a6e70', '#5a2a24', '#a08a68'], ens: ['vert', '#008c45', '#f2f0ea', '#cd212a'], nota: 'Gris claro; franjas rojas y blancas de identificación en el castillo (no modeladas).'},
      aire: {c: ['#8a7a4a', '#4a5a3a', '#9aa0a0', '#8a7a4a'], marca: ['roundel', '#1a1a1a', '#f2f0ea', '#1a1a1a'], id: '#f2f0ea', nota: 'Moteado (aprox.); fasces en las alas sustituidas por escarapela negra y blanca (aprox.).'},
      tierra: {c: ['#7a7c62', '#6a6c54', '#7a7c62', '#6a6c54']}}},
  SOV: {nombre: 'Unión Soviética', band: '#c8202a',
    '2': {mar: {c: ['#7e868a', '#5a6064', '#5a2a24', '#7a6a52'], ens: ['mono', '#f2f0ea', '#c8202a', '#1f3f8f'], nota: 'Gris; ensign naval blanco con franja azul (aprox.).'},
      aire: {c: ['#4a5a32', '#2e3428', '#9ab0c0', '#4a5a32'], marca: ['estrella', '#c8202a', '#f2f0ea', '#c8202a'], id: '#c8202a', nota: 'Verde AMT-4 y negro por encima, azul claro por debajo; estrella roja.'},
      tierra: {c: ['#7a7650', '#4f5a32', '#7a7650', '#4f5a32']}}},
  GEN: {nombre: 'Genérico teñible', band: '#888888',
    '2': {mar: {c: ['#8a9094', '#62686c', '#5a2a24', '#9a8a6a'], ens: ['horiz', '#6a6448', '#e8e0c8', '#2a4a7a'], nota: 'Teñible: la franja y la bandera son las del país.'},
      aire: {c: ['#5a6040', '#5a6040', '#a8b0b0', '#5a6040'], marca: ['roundel', '#2a4a7a', '#f2f0ea', '#8a3a2a'], id: '#f2f0ea', nota: 'Teñible.'},
      tierra: {c: ['#6a6448', '#5a5440', '#6a6448', '#5a5440']}}}
};
function eraOfN(n, era) { return n[era] || n[era === '1' ? '2' : '1'] || NAVES_NAC.GEN['2']; }
// navePalette(nación, época, dominio) → {main, trim, acc, deck, flag, flagLayout, band, mark, markType, id, note}
function navePalette(nation, era, dom) {
  const n = NAVES_NAC[nation] || NAVES_NAC.GEN, e = eraOfN(n, era || '2'), d = e[dom || 'mar'] || e.mar, ens = (e.mar || {}).ens || ['horiz', '#888', '#ddd', '#444'], mk = (e.aire || {}).marca || ['roundel', '#2a4a7a', '#f2f0ea', '#8a3a2a'];
  return {main: d.c[0], trim: d.c[1], acc: d.c[2], deck: d.c[3], flag: ens.slice(1), flagLayout: ens[0], band: n.band || '#888888', mark: mk.slice(1), markType: mk[0], id: (e.aire || {}).id || '#f2f0ea', note: d.nota || '',
    ensign: ens[0], trimCol: d.c[1]};
}

/* ---------- esqueletos ---------- */
const RIGS = {
  // param (7): x = tren plegado (aviones), y = retroceso de los cañones principales, z = compuertas de bombas. param2 (6): x = retroceso antiaéreo
  buque: [['casco', -1, [0, 0, 0]], ['proa', 0, [0, 0, 0]], ['popa', 0, [0, 0, 0]], ['ascensores', 0, [0, 0, 0]], ['periscopio', 0, [0, 0, 0]], ['botes', 0, [0, 0, 0]], ['param2', 0, [0, 0, 0]], ['param', 0, [0, 0, 0]]],
  avion: [['avion', -1, [0, 0, 0]], ['cuerpo', 0, [0, 0, 0]], ['alaIz', 1, [0, 0, 0]], ['alaDe', 1, [0, 0, 0]], ['libre4', 0, [0, 0, 0]], ['libre5', 0, [0, 0, 0]], ['param2', 0, [0, 0, 0]], ['param', 0, [0, 0, 0]]],
  aa: [['base', -1, [0, 0, 0]], ['libre1', 0, [0, 0, 0]], ['libre2', 0, [0, 0, 0]], ['libre3', 0, [0, 0, 0]], ['libre4', 0, [0, 0, 0]], ['libre5', 0, [0, 0, 0]], ['param2', 0, [0, 0, 0]], ['param', 0, [0, 0, 0]]]
};
const SP = {casco: 0, proa: 1, popa: 2, ascensores: 3, periscopio: 4, botes: 5};
// cuadrilátero con la normal hacia «out» (se da la vuelta si hace falta)
GB.prototype.quadO = function (a, b, c, d, zone, color, out) {
  const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
  const n = [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx];
  if (n[0] * out[0] + n[1] * out[1] + n[2] * out[2] < 0) this.quad(a, d, c, b, zone, color); else this.quad(a, b, c, d, zone, color);
};

/* ---------- casco ---------- */
// S = {L, B, D (francobordo), Df (proa), Da (popa), T (calado), split, st: [[t, manga relativa, francobordo relativo]], band}
const HULL_ST = [[-0.5, 0.72, 1.0], [-0.42, 0.9, 1.0], [-0.3, 1, 1], [-0.08, 1, 1], [0.15, 1, 1.02], [0.3, 0.92, 1.08], [0.42, 0.6, 1.18], [0.5, 0.0, 1.28]];
function hull(g, S, lvl) {
  const L = S.L, st = (S.st || HULL_ST).filter((s, i, a) => !lvl || i === 0 || i === a.length - 1 || i % 2 === 0), split = (S.split || 0) * L, bandH = S.D * (S.band != null ? S.band : 0.16);
  const P = st.map(([t, b, f]) => { const z = t * L, w = S.B / 2 * b, y = S.D * f; return {z, w, pts: lvl ? [[w, y], [w * 0.97, 0.3], [0, -S.T]] : [[w, y], [w, y - bandH], [w * 0.97, 0.3], [w * 0.82, -S.T * 0.85], [0, -S.T]]}; });
  const zones = lvl ? [Z.MAIN, Z.ACC] : [Z.MAIN, Z.MAIN, Z.ACC, Z.ACC];
  for (let i = 0; i < P.length - 1; i++) {
    const A = P[i], B = P[i + 1]; g.on((A.z + B.z) / 2 >= split ? SP.proa : SP.popa);
    [1, -1].forEach(s => { for (let k = 0; k < A.pts.length - 1; k++) {
      const a0 = [s * A.pts[k][0], A.pts[k][1], A.z], a1 = [s * A.pts[k + 1][0], A.pts[k + 1][1], A.z], b0 = [s * B.pts[k][0], B.pts[k][1], B.z], b1 = [s * B.pts[k + 1][0], B.pts[k + 1][1], B.z];
      if (A.w + B.w < 1e-3) continue; g.quadO(a0, b0, b1, a1, zones[k], 0, [s, k === A.pts.length - 2 ? -1 : 0, 0]); } });
    const dy = S.deckY != null ? S.deckY : null;
    g.quadO([A.w, dy != null ? dy : A.pts[0][1], A.z], [B.w, dy != null ? dy : B.pts[0][1], B.z], [-B.w, dy != null ? dy : B.pts[0][1], B.z], [-A.w, dy != null ? dy : A.pts[0][1], A.z], S.deckZone != null ? S.deckZone : Z.DECK, 0, [0, 1, 0]);
  }
  // espejo de popa
  const A = P[0]; g.on(SP.popa); for (let k = 0; k < A.pts.length - 1; k++) { if (A.w < 1e-3) break; g.quadO([A.pts[k][0], A.pts[k][1], A.z], [A.pts[k + 1][0], A.pts[k + 1][1], A.z], [-A.pts[k + 1][0], A.pts[k + 1][1], A.z], [-A.pts[k][0], A.pts[k][1], A.z], k < 2 ? Z.MAIN : Z.ACC, 0, [0, 0, -1]); }
  const E = P[P.length - 1]; if (E.w > 1e-3) { g.on(SP.proa); for (let k = 0; k < E.pts.length - 1; k++) g.quadO([E.pts[k][0], E.pts[k][1], E.z], [E.pts[k + 1][0], E.pts[k + 1][1], E.z], [-E.pts[k + 1][0], E.pts[k + 1][1], E.z], [-E.pts[k][0], E.pts[k][1], E.z], k < 2 ? Z.MAIN : Z.ACC, 0, [0, 0, 1]); }
  return P;
}
const partAt = (S, z) => z >= (S.split || 0) * S.L ? SP.proa : SP.popa;   // se parte por el centro (pivote de los clips)
const deckAt = (S, z) => { const st = S.st || HULL_ST, t = z / S.L; for (let i = 0; i < st.length - 1; i++) if (t <= st[i + 1][0]) { const u = (t - st[i][0]) / (st[i + 1][0] - st[i][0]); return S.D * (st[i][2] + (st[i + 1][2] - st[i][2]) * u); } return S.D; };
const beamAt = (S, z) => { const st = S.st || HULL_ST, t = z / S.L; for (let i = 0; i < st.length - 1; i++) if (t <= st[i + 1][0]) { const u = (t - st[i][0]) / (st[i + 1][0] - st[i][0]); return S.B / 2 * (st[i][1] + (st[i + 1][1] - st[i][1]) * u); } return 0; };

/* ---------- elementos ---------- */
// torre: o = {x, z, y (altura de la base sobre la cubierta, 0 = sobre la cubierta), w, h, l, n cañones, gl largo, gr radio, round, aft, sep}
function turret(g, S, o, lvl) {
  const x = o.x || 0, y = deckAt(S, o.z) + (o.y || 0), piv = [x, y, o.z], aft = !!o.aft, arc = x > 0.5 ? Math.PI / 2 : x < -0.5 ? -Math.PI / 2 : null, rst = arc != null && aft ? Math.PI : 0, kT = arc != null ? K.TURRET : aft ? K.TURRET_AFT : K.TURRET, kG = arc != null ? K.GUN : aft ? K.GUN_AFT : K.GUN, n = o.n || 2, sep = o.sep || o.w * 0.28, tr = [o.h * 0.45, o.l * 0.32];
  g.on(partAt(S, o.z));
  if (o.y > 0.3 && !lvl) g.set(0).cyl(Z.MAIN, 0, [x, y - o.y / 2, o.z], o.w * 0.42, o.w * 0.42, o.y, 6);   // barbeta
  g.set(kT, piv, null, rst, arc);
  if (o.round) g.cyl(Z.MAIN, 0, [x, y + o.h / 2, o.z], o.w * 0.55, o.w * 0.5, o.h, lvl ? 5 : 7, {top: true, sz: o.l / o.w, topZone: Z.TRIM});
  else g.box(Z.MAIN, 0, [x, y + o.h / 2, o.z - o.l * 0.05], [o.w, o.h, o.l], {taper: 0.1, taperZ: 0.12, topZone: Z.TRIM});
  (g.emit = g.emit || {torres: [], aa: []}).torres.push([x, y + tr[0], o.z + (aft ? -1 : 1) * (tr[1] + o.gl), aft ? 1 : 0]);
  g.set(kG, piv, tr, rst, arc);
  const nb = lvl ? 1 : n;
  for (let i = 0; i < nb; i++) { const bx = x + (nb === 1 ? 0 : (i - (nb - 1) / 2) * sep); g.cyl(Z.FIX, C.oscuro, [bx, y + tr[0], o.z + tr[1] + o.gl / 2], o.gr * (lvl ? 1.6 : 1), o.gr * 0.85, o.gl, lvl ? 3 : 4, {rot: [90, 0, 0]}); }
  g.set(0);
}
function aaMount(g, S, o, lvl) {                      // montaje antiaéreo abierto (escudo + 1–4 cañones)
  if (lvl) return; const y = deckAt(S, o.z) + (o.y || 0), piv = [o.x, y, o.z]; g.on(partAt(S, o.z)); (g.emit = g.emit || {torres: [], aa: []}).aa.push([o.x, y + 0.9, o.z]);
  const arc = o.x > 0.5 ? Math.PI / 2 : o.x < -0.5 ? -Math.PI / 2 : null; g.set(K.AA, piv, null, 0, arc).box(Z.MAIN, 0, [o.x, y + 0.6, o.z], [o.s * 1.2, 1.2, o.s * 0.5], {noBack: true});
  g.set(K.AAGUN, piv, [0.9, 0], 0, arc); for (let i = 0; i < (o.n || 2); i++) g.cyl(Z.FIX, C.oscuro, [o.x + (i - ((o.n || 2) - 1) / 2) * 0.45, y + 0.9, o.z + o.s * 0.6], 0.09, 0.08, o.s * 1.4, 3, {rot: [90, 0, 0]});
  g.set(0);
}
function funnel(g, S, o, lvl) {
  const y = deckAt(S, o.z) + (o.y || 0); g.on(partAt(S, o.z));
  g.cyl(Z.MAIN, 0, [o.x || 0, y + o.h / 2, o.z], o.r, o.r * (o.top || 0.92), o.h, lvl ? 5 : 8, {rot: [-(o.rake || 0), 0, 0], sz: o.sz || 1.3, top: true, topColor: C.negro, topZone: Z.FIX});
}
function block(g, S, o, lvl) {                        // superestructura: o = {x, z, y (sobre cubierta), w, h, l, taper, zone}
  const y = deckAt(S, o.z) + (o.y || 0); g.on(partAt(S, o.z));
  g.box(o.zone != null ? o.zone : Z.MAIN, o.color || 0, [o.x || 0, y + o.h / 2, o.z], [o.w, o.h, o.l], {taper: o.taper || 0, taperZ: o.taperZ != null ? o.taperZ : (o.taper || 0), noBack: false});
}
function mast(g, S, o, lvl) {
  const y = deckAt(S, o.z) + (o.y || 0); g.on(partAt(S, o.z));
  g.cyl(Z.FIX, C.mastil, [0, y + o.h / 2, o.z], o.r || 0.35, (o.r || 0.35) * 0.6, o.h, lvl ? 3 : 4, {rot: [-(o.rake || 0), 0, 0]});
  if (!lvl && o.yard) g.box(Z.FIX, C.mastil, [0, y + o.h * 0.78, o.z - Math.sin((o.rake || 0) * D2R) * o.h * 0.78], [o.yard, 0.3, 0.3]);
  if (!lvl && o.radar) { const ry = y + o.h * 0.9, piv = [0, ry, o.z - Math.sin((o.rake || 0) * D2R) * o.h * 0.9]; g.set(K.RADAR, piv).box(Z.FIX, C.mastil, [piv[0], ry + 0.9, piv[2]], [o.radar, 1.6, 0.3]); g.set(0); }
}
function ensign(g, S, z, y, w) { g.on(partAt(S, z)); g.cyl(Z.FIX, C.mastil, [0, y + w * 0.7, z], 0.15, 0.12, w * 1.4, 3); g.flag([0, y + w * 1.4, z], w, w * 0.62, S.flagLayout, [0, 90, 0]); }
function boats(g, S, z, y, n, lvl) { if (lvl) return; g.on(SP.botes); for (let i = 0; i < n; i++) { const s = i % 2 ? -1 : 1; g.box(Z.FIX, C.bote, [s * (S.B * 0.3), deckAt(S, z) + y, z - Math.floor(i / 2) * 9], [2.2, 1.2, 8], {taper: 0.15, taperZ: 0.3}); } }
function torpTubes(g, S, o, lvl) {                     // tubos lanzatorpedos (giran con el rumbo de puntería, kind torre)
  if (lvl) return; const y = deckAt(S, o.z), piv = [0, y, o.z]; g.on(partAt(S, o.z));
  g.set(K.TURRET, piv); g.cyl(Z.MAIN, 0, [0, y + 0.5, o.z], 1.2, 1.2, 1.0, 5);
  for (let i = 0; i < o.n; i++) g.cyl(Z.FIX, C.oscuro, [(i - (o.n - 1) / 2) * 0.62, y + 1.2, o.z], 0.27, 0.27, 7, 4, {rot: [90, 0, 0]});
  g.set(0);
}

/* ---------- modelos por nación ---------- */
// acorazado (bb, época 2): King George V · Bismarck · Yamato. Dreadnought (dread, época 1): Iron Duke · König · Kongō (aprox.).
const BB = {
  kgv: {L: 227, B: 31.4, D: 10, T: 9.9, nota: 'King George V (1940): torres cuádruples A e Y y doble B, 16 cañones de 133 mm en 8 torres dobles, dos chimeneas.',
    tur: [{z: 72, w: 13, h: 4, l: 14, n: 4, gl: 16, gr: 0.45}, {z: 52, y: 4, w: 11, h: 4, l: 12, n: 2, gl: 16, gr: 0.45}, {z: -74, w: 13, h: 4, l: 14, n: 4, gl: 16, gr: 0.45, aft: true}],
    sec: [[22, 1], [10, 1], [-22, 1], [-34, 1]], blocks: [{z: 30, w: 15, h: 9, l: 18}, {z: 30, y: 9, w: 9, h: 9, l: 9, taper: 0.15}, {z: -22, w: 13, h: 7, l: 26}, {z: -30, y: 7, w: 7, h: 4, l: 7}],
    fun: [{z: 10, r: 3.0, h: 13, rake: 0}, {z: -12, r: 3.0, h: 12, rake: 0}], mast: [{z: 26, h: 42, r: 0.6, yard: 10, radar: 3}, {z: -40, h: 30, r: 0.5, yard: 8}]},
  bismarck: {L: 251, B: 36, D: 10.5, T: 9.3, nota: 'Bismarck (1940): cuatro torres dobles de 380 mm (Anton, Bruno, Caesar, Dora), 12 cañones de 150 mm en 6 torres dobles, una chimenea.',
    tur: [{z: 85, w: 12, h: 4.5, l: 15, n: 2, gl: 19, gr: 0.5}, {z: 66, y: 4.5, w: 12, h: 4.5, l: 15, n: 2, gl: 19, gr: 0.5}, {z: -68, y: 4.5, w: 12, h: 4.5, l: 15, n: 2, gl: 19, gr: 0.5, aft: true}, {z: -87, w: 12, h: 4.5, l: 15, n: 2, gl: 19, gr: 0.5, aft: true}],
    sec: [[34, 1], [16, 1], [-8, 1]], blocks: [{z: 42, w: 15, h: 9, l: 20}, {z: 46, y: 9, w: 8, h: 14, l: 7, taper: 0.25}, {z: -2, w: 15, h: 6, l: 46}, {z: -42, w: 12, h: 7, l: 16}, {z: -40, y: 7, w: 6, h: 4, l: 6}],
    fun: [{z: 6, r: 4.4, h: 12, rake: 0, sz: 1.5}], mast: [{z: 22, h: 34, r: 0.6, yard: 12}, {z: -36, h: 24, r: 0.5, yard: 8}]},
  yamato: {L: 263, B: 38.9, D: 10, T: 11, nota: 'Yamato (1941): tres torres triples de 460 mm, dos torres triples de 155 mm, torre pagoda y chimenea inclinada hacia popa.',
    st: [[-0.5, 0.72, 0.92], [-0.42, 0.88, 0.95], [-0.3, 1, 0.98], [-0.08, 1, 1], [0.15, 1, 1.05], [0.3, 0.9, 1.16], [0.42, 0.55, 1.32], [0.5, 0.0, 1.48]],
    tur: [{z: 72, w: 15, h: 5, l: 17, n: 3, gl: 21, gr: 0.55, round: true}, {z: 52, y: 5, w: 15, h: 5, l: 17, n: 3, gl: 21, gr: 0.55, round: true}, {z: -66, w: 15, h: 5, l: 17, n: 3, gl: 21, gr: 0.55, round: true, aft: true}],
    sec: [[34, 0, 3], [-44, 0, 3]], blocks: [{z: 22, w: 16, h: 8, l: 26}, {z: 22, y: 8, w: 10, h: 10, l: 14, taper: 0.2}, {z: 22, y: 18, w: 6, h: 10, l: 8, taper: 0.25}, {z: 23, y: 28, w: 9, h: 2.5, l: 3}, {z: -20, w: 14, h: 6, l: 34}],
    fun: [{z: -4, r: 4.2, h: 15, rake: 22, sz: 1.4}], mast: [{z: -26, h: 22, r: 0.6, yard: 9}]}
};
function buildBattleship(o, lvl) {
  const g = new GB(), m = BB[o.modelo] || BB.kgv, S = Object.assign({flagLayout: o.flagLayout}, m); hull(g, S, lvl);
  m.blocks.forEach(b => block(g, S, b, lvl)); m.fun.forEach(f => funnel(g, S, f, lvl)); m.mast.forEach(ms => mast(g, S, ms, lvl));
  m.tur.forEach(t => turret(g, S, t, lvl));
  if (!lvl) m.sec.forEach(([z, side, n]) => { if (side) [1, -1].forEach(s => turret(g, S, {x: s * S.B * 0.3, z, y: 2.5, w: 4.2, h: 2.4, l: 5, n: n || 2, gl: 7, gr: 0.2, aft: z < 0}, lvl)); else turret(g, S, {z, y: 2.5, w: 8, h: 3, l: 9, n: n || 2, gl: 10, gr: 0.3, aft: z < 0, round: o.modelo === 'yamato'}, lvl); });
  if (!lvl) [[1, 0], [-1, 0], [1, -30], [-1, -30]].forEach(([s, dz]) => aaMount(g, S, {x: s * S.B * 0.38, z: 4 + dz, y: 0, s: 2.2, n: 2}, lvl));
  boats(g, S, -2, 0.6, lvl ? 0 : 4, lvl); ensign(g, S, -S.L / 2 + 3, deckAt(S, -S.L / 2 + 3), 7);
  return g;
}
// destructor: Tribal · Z1 (Leberecht Maass) · Fubuki
const DD = {
  tribal: {L: 115, B: 11.1, D: 5.2, T: 2.7, nota: 'Clase Tribal (1938): cuatro torres dobles de 120 mm (A, B, X, Y), un montaje cuádruple de torpedos, dos chimeneas.',
    tur: [{z: 40, w: 4.2, h: 2.4, l: 4.6, n: 2, gl: 6, gr: 0.17}, {z: 32, y: 2.2, w: 4.2, h: 2.4, l: 4.6, n: 2, gl: 6, gr: 0.17}, {z: -34, y: 2.2, w: 4.2, h: 2.4, l: 4.6, n: 2, gl: 6, gr: 0.17, aft: true}, {z: -43, w: 4.2, h: 2.4, l: 4.6, n: 2, gl: 6, gr: 0.17, aft: true}],
    blocks: [{z: 22, w: 7.5, h: 4.5, l: 9}, {z: 22, y: 4.5, w: 5, h: 3, l: 5, taper: 0.1}, {z: -20, w: 6, h: 2.6, l: 7}], fun: [{z: 10, r: 1.4, h: 7, rake: 6}, {z: -1, r: 1.4, h: 6.5, rake: 6}], mast: [{z: 18, h: 18, r: 0.3, yard: 5}], tt: [{z: -10, n: 4}]},
  z1: {L: 119, B: 11.3, D: 5.4, T: 4.0, nota: 'Zerstörer 1934: cinco cañones de 127 mm en montajes sencillos con escudo, dos montajes cuádruples de torpedos, dos chimeneas.',
    tur: [{z: 44, w: 3.4, h: 2.4, l: 4, n: 1, gl: 6, gr: 0.18}, {z: 36, y: 1.8, w: 3.4, h: 2.4, l: 4, n: 1, gl: 6, gr: 0.18}, {z: -30, y: 1.8, w: 3.4, h: 2.4, l: 4, n: 1, gl: 6, gr: 0.18, aft: true}, {z: -38, w: 3.4, h: 2.4, l: 4, n: 1, gl: 6, gr: 0.18, aft: true}, {z: -46, w: 3.4, h: 2.4, l: 4, n: 1, gl: 6, gr: 0.18, aft: true}],
    blocks: [{z: 26, w: 7, h: 4.5, l: 10}, {z: 26, y: 4.5, w: 4.5, h: 2.8, l: 4.5}, {z: -22, w: 5, h: 2.2, l: 6}], fun: [{z: 12, r: 1.6, h: 6.5, rake: 0, sz: 1.5}, {z: -2, r: 1.6, h: 6, rake: 0, sz: 1.5}], mast: [{z: 20, h: 16, r: 0.3, yard: 5}], tt: [{z: 4, n: 4}, {z: -12, n: 4}]},
  fubuki: {L: 118, B: 10.4, D: 5.5, T: 3.2, nota: 'Clase Fubuki (1928): tres torres dobles cerradas de 127 mm, tres montajes triples de torpedos de 610 mm, dos chimeneas (la delantera ancha).',
    st: [[-0.5, 0.7, 0.9], [-0.42, 0.88, 0.9], [-0.3, 1, 0.92], [-0.08, 1, 0.95], [0.15, 1, 1.1], [0.3, 0.9, 1.3], [0.42, 0.6, 1.4], [0.5, 0.0, 1.55]],
    tur: [{z: 40, w: 4.4, h: 2.6, l: 5, n: 2, gl: 6, gr: 0.17, round: true}, {z: -30, y: 2.0, w: 4.4, h: 2.6, l: 5, n: 2, gl: 6, gr: 0.17, round: true, aft: true}, {z: -40, w: 4.4, h: 2.6, l: 5, n: 2, gl: 6, gr: 0.17, round: true, aft: true}],
    blocks: [{z: 28, w: 6.5, h: 5, l: 8}, {z: 28, y: 5, w: 4.5, h: 2.5, l: 4, taper: 0.15}], fun: [{z: 14, r: 2.0, h: 6.5, rake: 8, sz: 1.3}, {z: 2, r: 1.5, h: 6, rake: 8}], mast: [{z: 22, h: 16, r: 0.3, yard: 5}], tt: [{z: 8, n: 3}, {z: -6, n: 3}, {z: -18, n: 3}]}
};
function buildDestroyer(o, lvl) {
  const g = new GB(), m = DD[o.modelo] || DD.tribal, S = Object.assign({flagLayout: o.flagLayout}, m); hull(g, S, lvl);
  m.blocks.forEach(b => block(g, S, b, lvl)); m.fun.forEach(f => funnel(g, S, f, lvl)); m.mast.forEach(ms => mast(g, S, ms, lvl)); m.tur.forEach(t => turret(g, S, t, lvl)); (m.tt || []).forEach(t => torpTubes(g, S, t, lvl));
  if (!lvl) [1, -1].forEach(s => aaMount(g, S, {x: s * 3.2, z: 4, y: 3, s: 1.2, n: 2}, lvl));
  boats(g, S, 8, 0.8, lvl ? 0 : 2, lvl); ensign(g, S, -S.L / 2 + 2, deckAt(S, -S.L / 2 + 2), 3.4);
  return g;
}
// submarino: clase T · Tipo VIIC · I-15 (B1, con hangar y catapulta)
const SUB = {
  tclass: {L: 84, B: 7.8, D: 1.8, T: 4.5, tower: {z: 6, w: 3.2, h: 4.5, l: 9}, gun: {z: 14, w: 2, h: 1.6, l: 2.4, n: 1, gl: 4.2, gr: 0.14}, nota: 'Clase T (1938): cañón de 102 mm a proa de la vela, proa bulbosa.'},
  vii: {L: 67, B: 6.2, D: 1.6, T: 4.7, tower: {z: 2, w: 2.6, h: 4, l: 8, wg: true}, gun: {z: 12, w: 1.6, h: 1.4, l: 2, n: 1, gl: 4.2, gr: 0.12}, nota: 'Tipo VIIC (1940): cañón de 88 mm a proa, «jardín de invierno» con antiaérea en la vela.'},
  i15: {L: 108, B: 9.3, D: 2.0, T: 5.1, tower: {z: 0, w: 3.4, h: 5, l: 11}, gun: {z: -16, w: 2.2, h: 1.8, l: 2.6, n: 1, gl: 5.5, gr: 0.16, aft: true}, hangar: {z: 14, w: 3.6, h: 3.4, l: 12}, nota: 'Tipo B1 (I-15, 1940): hangar para hidroavión y catapulta a proa, cañón de 140 mm a popa.'}
};
const SUB_ST = [[-0.5, 0.0, 0.6], [-0.4, 0.55, 0.85], [-0.25, 0.92, 1], [0, 1, 1], [0.25, 0.95, 1], [0.38, 0.7, 1.05], [0.46, 0.38, 1.1], [0.5, 0.0, 0.9]];
function buildSub(o, lvl) {
  const g = new GB(), m = SUB[o.modelo] || SUB.vii, S = Object.assign({flagLayout: o.flagLayout, st: SUB_ST, band: 0.3, deckZone: Z.TRIM}, m); hull(g, S, lvl);
  const T = m.tower; block(g, S, {z: T.z, w: T.w, h: T.h, l: T.l, taper: 0.12, taperZ: 0.25}, lvl);
  if (!lvl && T.wg) { block(g, S, {z: T.z - T.l * 0.6, w: T.w * 0.9, h: T.h * 0.7, l: 3}, lvl); aaMount(g, S, {x: 0, z: T.z - T.l * 0.6, y: T.h * 0.7, s: 1.0, n: 1}, lvl); }
  if (m.hangar) { block(g, S, {z: m.hangar.z, w: m.hangar.w, h: m.hangar.h, l: m.hangar.l, taper: 0.1}, lvl); if (!lvl) block(g, S, {z: m.hangar.z + 15, w: 1, h: 0.6, l: 18, zone: Z.FIX, color: C.oscuro}, lvl); }
  turret(g, S, m.gun, lvl);
  g.on(SP.periscopio); const py = deckAt(S, T.z) + T.h; g.cyl(Z.FIX, C.oscuro, [0, py + 2.5, T.z + T.l * 0.15], 0.18, 0.15, 5, 4); if (!lvl) g.cyl(Z.FIX, C.oscuro, [0.6, py + 2, T.z], 0.15, 0.12, 4, 3);
  ensign(g, S, T.z - T.l * 0.35, deckAt(S, T.z) + T.h, 2.2);
  return g;
}
// portaaviones: Illustrious · Graf Zeppelin (nunca terminado: aprox.) · Shōkaku
const CV = {
  illustrious: {L: 230, B: 29, D: 11, T: 8.5, fd: {y: 16, l: 0.9, w: 29, z0: -0.47, z1: 0.43}, isl: {x: -12, z: 12, w: 6, h: 12, l: 26, fun: true}, elev: [70, -55], closed: true, nota: 'Clase Illustrious (1940): cubierta blindada y hangar cerrado, isla a estribor con chimenea integrada.'},
  graf: {L: 262, B: 31.5, D: 11.5, T: 8.5, fd: {y: 18, l: 1.0, w: 30, z0: -0.47, z1: 0.42}, isl: {x: -13, z: 18, w: 6, h: 14, l: 30, fun: true, bigFun: true}, elev: [80, 0, -60], closed: true, nota: 'Graf Zeppelin (botado en 1938, nunca terminado): isla grande con chimenea a estribor. Aproximación.'},
  shokaku: {L: 257, B: 26, D: 10, T: 8.9, fd: {y: 17, l: 0.9, w: 29, z0: -0.46, z1: 0.38}, isl: {x: -12, z: 46, w: 4, h: 7, l: 12}, sideFun: true, elev: [70, 0, -66], wood: true, nota: 'Clase Shōkaku (1941): cubierta de vuelo de madera sobre puntales, isla pequeña a estribor y chimeneas curvadas hacia abajo por el costado.'}
};
function buildCarrier(o, lvl) {
  const g = new GB(), m = CV[o.modelo] || CV.illustrious, S = Object.assign({flagLayout: o.flagLayout}, m); hull(g, S, lvl);
  const fd = m.fd, z0 = fd.z0 * m.L, z1 = fd.z1 * m.L, lz = z1 - z0;
  // hangar (cerrado o abierto con puntales)
  const hk = m.closed ? 0.92 : 0.72, ha = (z0 + z1) / 2 - lz * hk / 2, hb = (z0 + z1) / 2 + lz * hk / 2, hw = m.B * (m.closed ? 0.86 : 0.8), hy = m.D + (fd.y - m.D) / 2;
  g.on(SP.popa); g.box(Z.MAIN, 0, [0, hy, ha / 2], [hw, fd.y - m.D, -ha], {noFront: true}); g.on(SP.proa); g.box(Z.MAIN, 0, [0, hy, hb / 2], [hw, fd.y - m.D, hb], {noBack: true});
  if (!m.closed) { if (!lvl) [z0 + 6, z1 - 6].forEach(z => [1, -1].forEach(s => g.box(Z.FIX, C.oscuro, [s * fd.w * 0.36, (m.D + fd.y) / 2, z], [0.6, fd.y - m.D, 0.6], {noTop: true}))); }
  // cubierta de vuelo (dos mitades para que se parta), marcas y ascensores
  [[z0, 0, SP.popa], [0, z1, SP.proa]].forEach(([a, b, p]) => { g.on(p); g.box(Z.MAIN, 0, [0, fd.y, (a + b) / 2], [fd.w, fd.l, b - a], {taperZ: 0, bottom: !lvl, topZone: m.wood ? Z.DECK : Z.TRIM}); });
  if (!lvl) { g.on(SP.proa); for (let z = z0 + 8; z < z1 - 6; z += 14) g.quad([0.4, fd.y + fd.l / 2 + 0.03, z], [0.4, fd.y + fd.l / 2 + 0.03, z + 7], [-0.4, fd.y + fd.l / 2 + 0.03, z + 7], [-0.4, fd.y + fd.l / 2 + 0.03, z], Z.FIX, C.blanco);
    if (o.markType === 'sol') g.disc(Z.M1, 0, [0, fd.y + fd.l / 2 + 0.04, z1 - 14], 5.5, 8, {rot: [-90, 0, 0]}); }
  m.elev.forEach((z, i) => { if (i > 1) return; g.on(SP.ascensores); g.box(Z.MAIN, 0, [0, fd.y + fd.l / 2 + 0.06, z], [12, 0.12, 13], {topZone: m.wood ? Z.TRIM : Z.FIX, topColor: 0x55595c}); });
  // isla
  const I = m.isl; g.on(partAt(S, I.z)); g.box(Z.MAIN, 0, [I.x, fd.y + I.h / 2, I.z], [I.w, I.h, I.l], {taper: 0.1, taperZ: 0.15});
  if (I.fun) g.cyl(Z.MAIN, 0, [I.x, fd.y + I.h + 3, I.z - I.l * 0.15], I.bigFun ? 3.4 : 2.4, 2.2, 7, lvl ? 5 : 8, {sz: 1.5, top: true, topColor: C.negro, topZone: Z.FIX});
  mast(g, S, {z: I.z + I.l * 0.2, y: fd.y + I.h - S.D, h: 10, r: 0.4, radar: 3.2}, lvl);
  if (m.sideFun && !lvl) [0, 8].forEach(dz => { g.on(SP.proa); g.cyl(Z.MAIN, 0, [-m.B * 0.5 - 1.5, m.D + 3, 16 + dz], 1.8, 1.8, 7, 6, {rot: [0, 0, -60], top: true, topColor: C.negro, topZone: Z.FIX}); });
  // aviones aparcados a popa (siluetas)
  if (!lvl) for (let i = 0; i < 6; i++) { const z = z0 + 14 + Math.floor(i / 3) * 13, x = (i % 3 - 1) * 9; g.on(SP.popa); g.quadO([x - 6, fd.y + 0.9, z], [x + 6, fd.y + 0.9, z], [x + 6, fd.y + 0.9, z + 2.2], [x - 6, fd.y + 0.9, z + 2.2], Z.FIX, 0x3e4436, [0, 1, 0]); g.quadO([x - 0.6, fd.y + 0.95, z - 5], [x + 0.6, fd.y + 0.95, z - 5], [x + 0.6, fd.y + 0.95, z + 4], [x - 0.6, fd.y + 0.95, z + 4], Z.FIX, 0x3e4436, [0, 1, 0]); g.quadO([x - 2.2, fd.y + 0.93, z - 4.5], [x + 2.2, fd.y + 0.93, z - 4.5], [x + 2.2, fd.y + 0.93, z - 3.3], [x - 2.2, fd.y + 0.93, z - 3.3], Z.FIX, 0x3e4436, [0, 1, 0]); }
  if (!lvl) [[1, 30], [-1, -30], [1, -40], [-1, 50]].forEach(([s, z]) => aaMount(g, S, {x: s * (fd.w / 2 - 1.5), z, y: fd.y - m.D - 1.8, s: 2, n: 2}, lvl));
  ensign(g, S, z0 + 2, fd.y - 4 - deckAt(S, z0 + 2) + deckAt(S, z0 + 2), 5);
  return g;
}
// LOD2: silueta de ≤ 12 triángulos (cubierta en punta, dos costados y una superestructura en cruz)
function shipSil(o, L, B, H, top) {
  const g = new GB(); g.on(SP.proa);
  g.poly(Z.DECK, 0, [[-B / 2, -L / 2], [B / 2, -L / 2], [B / 2, L * 0.3], [0, L / 2], [-B / 2, L * 0.3]].map(([x, z]) => [x, -z]), [0, H, 0], [-90, 0, 0]);
  [1, -1].forEach(s => g.quadO([s * B / 2, H, -L / 2], [s * B / 2, H, L * 0.3], [s * B / 2, -1, L * 0.3], [s * B / 2, -1, -L / 2], Z.MAIN, 0, [s, 0, 0]));
  g.quad([0, H, -L * 0.15], [0, H, L * 0.15], [0, H + top, L * 0.08], [0, H + top, -L * 0.08], Z.MAIN, 0); g.quad([-B * 0.3, H, 0], [B * 0.3, H, 0], [B * 0.2, H + top, 0], [-B * 0.2, H + top, 0], Z.MAIN, 0);
  return g;
}

/* ---------- aviones ---------- */
// Ejes: morro a +Z, ala izquierda (babor) a +X, arriba +Y; metros reales; origen en el cuarto de cuerda del ala.
const AP = {avion: 0, cuerpo: 1, alaIz: 2, alaDe: 3};
// fuselaje: estaciones [z, semiancho, semialto, y del centro]; n lados (6 en LOD0, 4 en LOD1). Zonas por la normal: arriba MAIN/TRIM, costados MAIN, abajo ACC
function fuselage(g, st, n, camo, x0) {
  x0 = x0 || 0; const ring = s => { const r = []; for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 + Math.PI / n - Math.PI / 2; r.push([x0 + Math.cos(a) * s[1], s[3] + Math.sin(a) * s[2], s[0]]); } return r; };
  const R = st.map(ring);
  for (let k = 0; k < st.length - 1; k++) for (let i = 0; i < n; i++) {
    const j = (i + 1) % n, a = R[k][i], b = R[k][j], c = R[k + 1][j], d = R[k + 1][i], my = (a[1] + b[1]) / 2 - (st[k][3] + st[k + 1][3]) / 2, h = (st[k][2] + st[k + 1][2]) / 2 || 1;
    const zone = my / h < -0.45 ? Z.ACC : my / h > 0.45 && camo && (k % 2) ? Z.TRIM : Z.MAIN;
    if (st[k][1] < 1e-3) g.tri(a, c, d, zone, 0); else if (st[k + 1][1] < 1e-3) g.tri(a, b, c, zone, 0); else g.quad(a, b, c, d, zone, 0);
  }
  const f = R[0]; if (st[0][1] > 1e-3) for (let i = 1; i < n - 1; i++) g.tri(f[0], f[i], f[i + 1], Z.MAIN, 0);
  const l = R[R.length - 1]; if (st[st.length - 1][1] > 1e-3) for (let i = 1; i < n - 1; i++) g.tri(l[0], l[i + 1], l[i], Z.MAIN, 0);
  return R;
}
// ala: secciones [x (envergadura), z del borde de ataque, cuerda, espesor]; s = 1 babor, −1 estribor; extradós en dos franjas (camuflaje)
function wing(g, s, secs, y0, dih, camo, flat) {
  const Y = x => y0 + Math.abs(x) * Math.tan(dih * D2R);
  const P = secs.map(([x, zl, c, th]) => ({le: [s * x, Y(x), zl], te: [s * x, Y(x), zl - c], mt: [s * x, Y(x) + th, zl - c * 0.35]}));
  for (let i = 0; i < P.length - 1; i++) {
    const A = P[i], B = P[i + 1], z1 = camo && (i + (s > 0 ? 0 : 1)) % 2 ? Z.TRIM : Z.MAIN, z2 = camo && (i + (s > 0 ? 1 : 0)) % 2 ? Z.TRIM : Z.MAIN;
    if (flat) g.quadO(A.le, B.le, B.te, A.te, Z.MAIN, 0, [0, 1, 0]);
    else { g.quadO(A.le, B.le, B.mt, A.mt, z1, 0, [0, 1, 0]); g.quadO(A.mt, B.mt, B.te, A.te, z2, 0, [0, 1, 0]); }
    g.quadO(A.le, B.le, B.te, A.te, Z.ACC, 0, [0, -1, 0]);
  }
  const E = P[P.length - 1]; if (!flat && secs[secs.length - 1][2] > 0.05) g.quadO(E.le, E.mt, E.te, E.te, Z.MAIN, 0, [s, 0, 0]);
  return {Y, P};
}
// deriva: secciones [altura, z del borde de ataque, cuerda]; espesor fijo
function fin(g, x0, y0, secs, th, zone) {
  const P = secs.map(([h, zl, c]) => ({le: [x0, y0 + h, zl], te: [x0, y0 + h, zl - c], m: zl - c * 0.35}));
  for (let i = 0; i < P.length - 1; i++) [1, -1].forEach(s => { const A = P[i], B = P[i + 1], am = [x0 + s * th, A.le[1], A.m], bm = [x0 + s * th, B.le[1], B.m];
    g.quadO(A.le, B.le, bm, am, zone || Z.MAIN, 0, [s, 0, 0]); g.quadO(am, bm, B.te, A.te, zone || Z.MAIN, 0, [s, 0, 0]); });
}
function prop(g, at, r, nb, lvl, spin) {
  g.set(K.PROP, at); g.cyl(Z.FIX, C.negro, [at[0], at[1], at[2] + 0.15], spin || r * 0.12, 0, 0.45, lvl ? 4 : 6, {rot: [90, 0, 0]});
  for (let b = 0; b < nb; b++) { const a = b / nb * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a), w = r * 0.07, P = (u, v) => [at[0] + ca * u - sa * v, at[1] + sa * u + ca * v, at[2]];
    const q = [P(0.1, -w), P(r, -w * 0.6), P(r, w * 0.6), P(0.1, w)]; g.tri(q[0], q[1], q[2], Z.FIX, C.helice); g.tri(q[0], q[2], q[3], Z.FIX, C.helice); if (!lvl) { g.tri(q[0], q[2], q[1], Z.FIX, C.helice); g.tri(q[0], q[3], q[2], Z.FIX, C.helice); } }
  g.set(0);
}
// tren: pata + rueda; eje 0 = X (se pliega hacia atrás/adelante), 1 = Z (hacia fuera/dentro); ang en rad
function gear(g, at, len, wr, axis, ang, lvl, splay) {
  if (lvl > 0 && !gear.lod1) return; g.set(K.GEAR, at, [axis, ang]);
  const bot = [at[0] + (splay || 0), at[1] - len, at[2]];
  g.box(Z.FIX, C.oscuro, [(at[0] + bot[0]) / 2, at[1] - len / 2, at[2]], [0.12 * Math.max(1, wr * 2), len, 0.12 * Math.max(1, wr * 2)], {rot: [0, 0, splay ? Math.atan2(splay, len) / D2R : 0]});
  g.cyl(Z.FIX, C.goma, bot, wr, wr, wr * 0.55, lvl ? 5 : 6, {rot: [0, 0, 90], top: true, bottom: true});
  g.set(0);
}
// marcas: escarapela (3 anillos), Balkenkreuz, hinomaru, estrella
function mark(g, type, c, U, V, r, lvl, outline) {
  const n = lvl ? 6 : 9, eps = 0.012, N = [U[1] * V[2] - U[2] * V[1], U[2] * V[0] - U[0] * V[2], U[0] * V[1] - U[1] * V[0]], at = k => [c[0] + N[0] * eps * k, c[1] + N[1] * eps * k, c[2] + N[2] * eps * k];
  if (type === 'roundel') { if (outline && !lvl) g.ring(Z.ID, 0, at(1), U, V, r * 1.18, n); g.ring(Z.M1, 0, at(2), U, V, r, n); if (!lvl || r > 0.9) g.ring(Z.M2, 0, at(3), U, V, r * 0.66, n); g.ring(Z.M3, 0, at(4), U, V, r * 0.36, n); }
  else if (type === 'balken') { const cross = (a, b) => [[-a, -b], [a, -b], [a, b], [-a, b]]; [[1.0, 0.36, Z.M2, 1], [0.86, 0.2, Z.M1, 2]].forEach(([a, b, z, k]) => { g.decal(z, 0, at(k), U, V, cross(a * r, b * r)); g.decal(z, 0, at(k), U, V, cross(b * r, a * r)); }); }
  else if (type === 'sol') { if (outline && !lvl) g.ring(Z.M2, 0, at(1), U, V, r * 1.15, n); g.ring(Z.M1, 0, at(2), U, V, r, n); }
  else if (type === 'estrella') { g.ring(Z.M3, 0, at(1), U, V, r, n); const pts = []; for (let i = 0; i < 10; i++) { const a = Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.38 : r * 0.95; pts.push([Math.cos(a) * rr, Math.sin(a) * rr]); } const c2 = at(2); for (let i = 0; i < 10; i++) g.decal(Z.M1, 0, c2, U, V, [[0, 0], pts[i], pts[(i + 1) % 10]]); }
}
const UP = {U: [1, 0, 0], V: [0, 0, -1]}, DN = {U: [1, 0, 0], V: [0, 0, 1]}, PORT = {U: [0, 0, -1], V: [0, 1, 0]}, STBD = {U: [0, 0, 1], V: [0, 1, 0]};
const ellip = (b, cr, x0, zq, n, minC, th) => { const out = []; for (let i = 0; i <= n; i++) { const x = x0 + (b - x0) * (1 - Math.pow(1 - i / n, 1.6)), c = Math.max(minC, cr * Math.sqrt(Math.max(0, 1 - Math.pow(x / b, 2)))); out.push([x, zq + c * 0.25, c, th * c / cr]); } return out; };
const tap = (pts, th) => pts.map(([x, zl, c]) => [x, zl, c, th * c / pts[0][2]]);
// torreta de bombardero: cúpula + cañones (montaje AA del avión)
function bTurret(g, at, r, ng, lvl, rest, arc) {
  g.set(K.AA, at, [0, 0], rest, arc); g.cyl(Z.FIX, C.cristal, [at[0], at[1] + r * 0.3, at[2]], r, r * 0.7, r * 0.8, lvl ? 4 : 6, {top: true});
  if (!lvl) { g.set(K.AAGUN, at, [r * 0.35, 0], rest, arc); for (let i = 0; i < ng; i++) g.cyl(Z.FIX, C.negro, [at[0] + (i - (ng - 1) / 2) * 0.16, at[1] + r * 0.35, at[2] + r + 0.4], 0.035, 0.03, 1.0, 3, {rot: [90, 0, 0]}); }
  g.set(0);
}
const PLANES = {
  spitfire: {tipo: 'caza', L: 9.12, B: 11.23, nota: 'Supermarine Spitfire Mk I (1940): ala elíptica, motor Merlin, hélice tripala, ocho ametralladoras en las alas.',
    fus: [[4.3, 0.16, 0.18, 0.02], [3.7, 0.42, 0.5, 0.0], [2.4, 0.48, 0.62, 0.05], [0.9, 0.47, 0.7, 0.08], [-0.6, 0.4, 0.62, 0.12], [-2.6, 0.27, 0.45, 0.16], [-4.3, 0.1, 0.3, 0.26], [-4.82, 0.0, 0.18, 0.3]],
    wing: () => ellip(5.6, 2.55, 0.42, 0.2, 4, 0.35, 0.16), wy: -0.42, dih: 6, tail: () => ellip(1.65, 1.05, 0.12, -3.95, 2, 0.3, 0.1), ty: 0.22, fin: [[0, -3.35, 1.4], [0.9, -3.75, 1.0], [1.35, -4.05, 0.55]],
    can: [-0.35, 0.7, 0.5, 0.36, 1.5], prop: {r: 1.65, nb: 3}, gear: {x: 0.95, z: 0.65, len: 1.25, wr: 0.33, axis: 1, out: 1}, guns: [[1.9, 0.75], [2.6, 0.6], [3.1, 0.55], [3.5, 0.5]], marks: {wing: 3.9, wr: 0.62, fus: -2.0, fr: 0.42}},
  bf109: {tipo: 'caza', L: 8.65, B: 9.87, nota: 'Messerschmitt Bf 109 E-3 (1940): ala trapezoidal de puntas cuadradas, DB 601, tren estrecho que se pliega hacia fuera. Sin esvástica en la deriva.',
    fus: [[4.1, 0.14, 0.16, 0.08], [3.5, 0.4, 0.48, 0.05], [2.2, 0.46, 0.6, 0.08], [0.8, 0.45, 0.66, 0.1], [-0.8, 0.36, 0.56, 0.14], [-2.6, 0.24, 0.42, 0.18], [-4.0, 0.09, 0.28, 0.26], [-4.55, 0.0, 0.18, 0.3]],
    wing: () => tap([[0.4, 0.62, 2.1], [4.6, 0.38, 1.25], [4.93, 0.3, 0.95]], 0.15), wy: -0.42, dih: 6.5, tail: () => tap([[0.1, -3.55, 0.95], [1.5, -3.75, 0.6]], 0.08), ty: 0.5, fin: [[0, -3.3, 1.2], [1.1, -3.7, 0.75], [1.3, -3.95, 0.4]],
    can: [-0.2, 0.68, 0.44, 0.34, 1.6, true], prop: {r: 1.55, nb: 3}, gear: {x: 0.55, z: 0.75, len: 1.2, wr: 0.3, axis: 1, out: 1, splay: 0.4}, guns: [[2.6, 0.55]], marks: {wing: 3.6, wr: 0.6, fus: -2.0, fr: 0.45}},
  zero: {tipo: 'caza', L: 9.06, B: 12.0, nota: 'Mitsubishi A6M2 tipo 0 (1941): motor radial Sakae, ala trapezoidal de punta redondeada, tren que se pliega hacia dentro.',
    fus: [[3.9, 0.55, 0.55, 0.05], [3.2, 0.62, 0.62, 0.05], [2.0, 0.55, 0.62, 0.1], [0.6, 0.5, 0.66, 0.12], [-1.0, 0.4, 0.55, 0.16], [-2.8, 0.25, 0.4, 0.2], [-4.6, 0.08, 0.26, 0.28], [-5.1, 0.0, 0.16, 0.3]],
    wing: () => tap([[0.5, 0.75, 2.65], [3.6, 0.5, 1.95], [5.4, 0.3, 1.25], [6.0, 0.02, 0.5]], 0.16), wy: -0.45, dih: 6.5, tail: () => tap([[0.1, -3.95, 1.1], [1.6, -4.15, 0.65], [2.0, -4.4, 0.35]], 0.08), ty: 0.2, fin: [[0, -3.6, 1.5], [1.0, -4.0, 1.0], [1.35, -4.35, 0.55]],
    can: [-0.6, 0.72, 0.48, 0.36, 2.2], prop: {r: 1.45, nb: 3, spin: 0.25}, gear: {x: 1.75, z: 0.6, len: 1.3, wr: 0.3, axis: 1, out: -1}, guns: [[2.3, 0.6]], marks: {wing: 4.2, wr: 0.6, fus: -2.4, fr: 0.45}},
  lancaster: {tipo: 'bombardero', L: 21.1, B: 31.1, nota: 'Avro Lancaster B.I (1942): cuatro Merlin, doble deriva, torretas de morro, dorsal y de cola (4 ametralladoras), bodega de bombas larga.',
    fus: [[10.4, 0.25, 0.3, -0.1], [9.6, 0.95, 1.0, -0.15], [7.6, 1.1, 1.3, 0.0], [3.0, 1.1, 1.5, 0.1], [-2.5, 1.0, 1.4, 0.2], [-6.5, 0.8, 1.05, 0.35], [-9.4, 0.45, 0.7, 0.6], [-10.6, 0.15, 0.4, 0.7]],
    wing: () => tap([[1.0, 2.4, 5.1], [5.6, 2.1, 4.3], [13.8, 1.0, 2.5], [15.55, 0.5, 1.2]], 0.7), wy: -0.1, dih: 2.5, tail: () => tap([[0.3, -7.7, 2.6], [4.0, -8.0, 1.8], [5.0, -8.3, 1.3]], 0.25), ty: 0.9, fin: null, fins: {x: 4.9, secs: [[-1.6, -7.6, 1.4], [0, -7.5, 2.0], [1.6, -7.8, 1.5], [2.1, -8.2, 0.8]]},
    can: [6.0, 1.45, 0.75, 0.7, 2.6], prop: {r: 1.95, nb: 3}, eng: [3.6, 7.6], engY: -0.25, engZ: 4.6, engR: 0.65, engL: 4.6, gear: {x: 3.6, z: 2.3, len: 2.9, wr: 0.8, axis: 0, out: 1}, turrets: [[0, -0.2, 10.0, 0.55, 2, 0], [0, 1.5, -1.8, 0.6, 2, 0], [0, 0.65, -10.7, 0.6, 4, Math.PI]],
    bay: {z0: 4.0, z1: -4.5, w: 0.8, y: -1.35}, marks: {wing: 11, wr: 1.3, fus: -4.0, fr: 0.95}},
  condor: {tipo: 'bombardero', L: 23.45, B: 32.85, nota: 'Focke-Wulf Fw 200 C-3 Condor (1941): avión de línea convertido en patrullero, ala baja, cuatro BMW 323 radiales, góndola ventral, torreta dorsal. Aproximación.',
    fus: [[11.7, 0.35, 0.4, 0.25], [10.8, 1.05, 1.15, 0.2], [8.0, 1.3, 1.45, 0.25], [2.0, 1.35, 1.5, 0.25], [-4.0, 1.15, 1.3, 0.35], [-8.0, 0.75, 0.95, 0.6], [-11.0, 0.3, 0.5, 0.9], [-11.8, 0.05, 0.25, 1.0]],
    wing: () => tap([[1.2, 2.6, 5.4], [6.5, 2.2, 4.3], [14.6, 1.0, 2.4], [16.4, 0.3, 1.2]], 0.7), wy: -1.0, dih: 4, tail: () => tap([[0.3, -9.1, 2.7], [4.0, -9.4, 1.8], [5.4, -9.7, 1.0]], 0.25), ty: 0.7, fin: [[0, -8.2, 3.4], [2.6, -9.2, 2.2], [3.8, -9.8, 1.2]],
    can: [9.2, 1.55, 0.9, 0.5, 2.0], prop: {r: 1.6, nb: 3, spin: 0.5}, eng: [4.2, 8.8], engY: -0.9, engZ: 4.4, engR: 0.7, engL: 3.4, radial: true, gear: {x: 4.2, z: 2.5, len: 2.4, wr: 0.75, axis: 0, out: -1}, turrets: [[0, 1.6, 7.0, 0.55, 1, 0], [0, 1.55, -2.5, 0.45, 1, Math.PI]],
    gondola: [0, -1.5, 3.0, 1.0, 0.7, 8.0], bay: {z0: 4.5, z1: 0.5, w: 0.45, y: -1.85}, marks: {wing: 12, wr: 1.25, fus: -5.0, fr: 1.0}},
  renzan: {tipo: 'bombardero', L: 22.94, B: 32.54, nota: 'Nakajima G8N1 Renzan (1944): cuatro Homare radiales, deriva única, torretas de morro, dorsales y de cola. Solo prototipos (aprox.).',
    fus: [[11.3, 0.35, 0.4, 0.0], [10.4, 0.95, 1.05, 0.0], [8.0, 1.2, 1.35, 0.1], [2.0, 1.2, 1.45, 0.15], [-4.0, 1.05, 1.25, 0.3], [-8.0, 0.7, 0.9, 0.55], [-10.8, 0.3, 0.5, 0.7], [-11.6, 0.1, 0.3, 0.75]],
    wing: () => tap([[1.1, 2.2, 4.9], [6.0, 1.9, 4.0], [14.6, 0.8, 2.0], [16.25, 0.3, 1.0]], 0.65), wy: -0.2, dih: 3, tail: () => tap([[0.3, -8.9, 2.5], [4.2, -9.2, 1.6], [5.2, -9.5, 0.9]], 0.25), ty: 0.6, fin: [[0, -7.9, 3.5], [2.8, -8.9, 2.3], [3.9, -9.6, 1.3]],
    can: [8.2, 1.4, 0.75, 0.5, 2.2], prop: {r: 1.7, nb: 4, spin: 0.5}, eng: [3.9, 8.1], engY: -0.15, engZ: 4.2, engR: 0.72, engL: 3.6, radial: true, gear: {x: 3.9, z: 2.3, len: 2.6, wr: 0.8, axis: 0, out: 1}, turrets: [[0, 0.1, 11.0, 0.5, 2, 0], [0, 1.5, 2.5, 0.55, 2, 0], [0, 0.85, -11.6, 0.55, 2, Math.PI]],
    bay: {z0: 3.5, z1: -2.5, w: 0.75, y: -1.25}, marks: {wing: 12, wr: 1.3, fus: -5.0, fr: 0.95}}
};
function buildPlane(o, lvl) {
  const g = new GB(), m = PLANES[o.modelo] || PLANES.spitfire, n = lvl ? 4 : 6, camo = !lvl, mt = o.markType || 'roundel', big = m.tipo === 'bombardero';
  g.on(AP.cuerpo); fuselage(g, lvl ? m.fus.filter((s, i) => i % 2 === 0 || i === m.fus.length - 1) : m.fus, n, camo);
  // alas
  const W = m.wing(), wsec = lvl ? [W[0], W[W.length - 1]] : W; let wy = null;
  [[1, AP.alaIz], [-1, AP.alaDe]].forEach(([s, p]) => { g.on(p); wy = wing(g, s, wsec, m.wy, m.dih, camo, lvl === 2).Y; });
  // cola
  g.on(AP.cuerpo); const T = m.tail(); [1, -1].forEach(s => wing(g, s, lvl ? [T[0], T[T.length - 1]] : T, m.ty, 0, false, lvl === 2));
  if (m.fin) fin(g, 0, m.ty, lvl ? [m.fin[0], m.fin[m.fin.length - 1]] : m.fin, big ? 0.18 : 0.08);
  if (m.fins) [1, -1].forEach(s => fin(g, s * m.fins.x, m.ty, lvl ? [m.fins.secs[0], m.fins.secs[m.fins.secs.length - 1]] : m.fins.secs, 0.15));
  // cabina
  if (lvl < 2) { const [cz, cy, cw, ch, cl, ang] = m.can; g.box(Z.FIX, C.cristal, [0, cy, cz], [cw * 2 * 0.9, ch, cl], {taper: ang ? 0.25 : 0.45, taperZ: 0.25, skewZ: ang ? 0 : -0.1}); }
  // motores, hélices y tren
  const emitM = [], emitG = [];
  if (!m.eng) { prop(g, [0, m.fus[0][3], m.fus[0][0] + 0.05], m.prop.r, m.prop.nb, lvl, m.prop.spin); emitM.push([0, m.fus[0][3], m.fus[0][0] - 0.8]);
    [1, -1].forEach(s => { g.on(s > 0 ? AP.alaIz : AP.alaDe); gear(g, [s * m.gear.x, m.wy, m.gear.z], m.gear.len, m.gear.wr, m.gear.axis, s * m.gear.out * 1.55, lvl, m.gear.splay ? s * m.gear.splay : 0); });
    g.on(AP.cuerpo); if (lvl < 2) g.cyl(Z.FIX, C.goma, [0, m.fus[m.fus.length - 2][3] - 0.35, m.fus[m.fus.length - 2][0] + 0.2], 0.1, 0.1, 0.08, 4, {rot: [0, 0, 90]});
    (m.guns || []).forEach(([x, z]) => [1, -1].forEach(s => emitG.push([s * x, m.wy + 0.05, z]))); }
  else m.eng.forEach(x => [1, -1].forEach(s => { g.on(s > 0 ? AP.alaIz : AP.alaDe); const y = wy(x) + m.engY, z = m.engZ, r = m.engR, L = m.engL;
    const st = [[z, r * (m.radial ? 1.0 : 0.55), r * (m.radial ? 1.0 : 0.65), y], [z - 0.6, r, r, y], [z - L * 0.55, r * 0.9, r * 1.0, y - r * 0.15], [z - L, r * 0.15, r * 0.3, y - r * 0.1]].map(q => [q[0], q[1], q[2], q[3]]);
    fuselage(g, lvl ? [st[0], st[1], st[3]] : st, lvl ? 4 : 6, false, s * x);
    prop(g, [s * x, y, z + 0.05], m.prop.r, m.prop.nb, lvl, m.prop.spin || r * 0.3); emitM.push([s * x, y, z - 1]);
    if (x === m.gear.x) gear(g, [s * x, y - r * 0.6, m.gear.z], m.gear.len, m.gear.wr, m.gear.axis, m.gear.out * 1.55, lvl); }));
  // torretas, góndola y bodega
  g.on(AP.cuerpo);
  (m.turrets || []).forEach(([x, y, z, r, ng, rest]) => { if (lvl < 2) bTurret(g, [x, y, z], r, ng, lvl, rest, Math.abs(z) > m.L * 0.4 ? rest : null); });   // morro y cola: sector de ±92°; dorsal: 360°
  if (m.gondola && lvl < 2) { const [x, y, z, w, h, l] = m.gondola; g.box(Z.ACC, 0, [x, y, z], [w, h, l], {taper: 0.1, taperZ: 0.2, bottom: true}); }
  if (m.bay && !lvl) { const b = m.bay; [1, -1].forEach(s => { g.set(K.DOOR, [s * b.w, b.y, 0], [1, s * 1.35]); g.quadO([0, b.y - 0.02, b.z0], [s * b.w, b.y - 0.02, b.z0], [s * b.w, b.y - 0.02, b.z1], [0, b.y - 0.02, b.z1], Z.ACC, 0, [0, -1, 0]); g.set(0); }); }
  // marcas nacionales: extradós e intradós de las alas, costados del fuselaje; franja de la deriva (RAF)
  if (lvl < 2) { const M = m.marks; [[1, AP.alaIz], [-1, AP.alaDe]].forEach(([s, p]) => { g.on(p); const xw = s * M.wing, yw = wy(M.wing), ws = W.reduce((a, q) => Math.abs(q[0] - M.wing) < Math.abs(a[0] - M.wing) ? q : a), zc = ws[1] - ws[2] * 0.4;
      const cd = Math.cos(m.dih * D2R), sd = Math.sin(m.dih * D2R) * s, Uw = [cd, sd, 0];
      mark(g, mt, [xw, yw + ws[3] * 0.85 + 0.01, zc], Uw, UP.V, M.wr, lvl); if (!lvl) mark(g, mt, [xw, yw - 0.015, zc], Uw, DN.V, M.wr, lvl); });
    g.on(AP.cuerpo); const fi = m.fus.findIndex(q => q[0] < M.fus), a = m.fus[fi - 1], b = m.fus[fi], u = (M.fus - b[0]) / (a[0] - b[0]), fw = b[1] + (a[1] - b[1]) * u, fy = b[3] + (a[3] - b[3]) * u;
    if ((mt !== 'sol' || o.fusMark !== false) && (!lvl || big)) { mark(g, mt, [fw * 0.98 + 0.01, fy, M.fus], PORT.U, PORT.V, M.fr, lvl, true); mark(g, mt, [-fw * 0.98 - 0.01, fy, M.fus], STBD.U, STBD.V, M.fr, lvl, true); }
    if (mt === 'roundel' && !lvl && m.fin) { const f0 = m.fin[0], c = [0.1, m.ty + 0.35, f0[1] - f0[2] * 0.3]; [[Z.M3, 0.35], [Z.M2, 0], [Z.M1, -0.35]].forEach(([zz, dz]) => [1, -1].forEach(s => g.decal(zz, 0, [s * (big ? 0.2 : 0.1), c[1], c[2] + dz * f0[2] * 0.5], s > 0 ? PORT.U : STBD.U, PORT.V, [[-0.18 * f0[2] * 0.5 * 2, -0.35], [0.18 * f0[2] * 0.5 * 2, -0.35], [0.18 * f0[2] * 0.5 * 2, 0.35], [-0.18 * f0[2] * 0.5 * 2, 0.35]]))); }
    if (o.idBand && !lvl) [1, -1].forEach(s => { g.on(s > 0 ? AP.alaIz : AP.alaDe); const w0 = W[0], w1 = W[Math.min(2, W.length - 1)], Y = wy; g.quadO([s * w0[0], Y(w0[0]) + 0.02, w0[1]], [s * w1[0], Y(w1[0]) + 0.02, w1[1]], [s * w1[0], Y(w1[0]) + 0.04, w1[1] - 0.25], [s * w0[0], Y(w0[0]) + 0.04, w0[1] - 0.25], Z.ID, 0, [0, 1, 0]); });
  }
  g.emit = {motores: emitM, armas: emitG, torretas: (m.turrets || []).map(t => t.slice(0, 3))};
  return g;
}

/* ---------- defensa antiaérea en tierra ---------- */
// Montajes con base fija y parte giratoria (K.AA) + cañones (K.AAGUN) que siguen la puntería AA de la instancia. Dotación: 3 artilleros de
// troops3d (servidor_pieza / artillero de la época E) en las posiciones de «crew»; no se duplica el modelo de soldado aquí.
const AA = {
  bofors: {nota: 'Bofors 40 mm L/60 (montaje Mk III británico, 1940): afuste cruciforme de cuatro brazos, sin escudo, cargador de 4 disparos encima.', n: 1, cal: 0.06, len: 3.6, ty: 1.45,
    crew: [[-1.1, -0.3, 80, 'apuntador (dirección)'], [1.1, -0.3, -80, 'apuntador (elevación)'], [0, -1.6, 0, 'cargador']]},
  flakv: {nota: '2 cm Flakvierling 38 (1940): plataforma triangular, cuatro cañones de 20 mm, escudo y asiento central del apuntador.', n: 4, cal: 0.03, len: 2.3, ty: 1.15, shield: true,
    crew: [[0, -1.2, 0, 'apuntador'], [1.4, 0.2, -90, 'cargador'], [-1.4, 0.2, 90, 'cargador']]},
  type96: {nota: 'Cañón de 25 mm tipo 96 en montaje triple (1936; Armada y defensa de bases): pedestal, tres cañones y dos asientos.', n: 3, cal: 0.035, len: 2.6, ty: 1.3,
    crew: [[-1.0, -0.4, 80, 'apuntador (dirección)'], [1.0, -0.4, -80, 'apuntador (elevación)'], [0, -1.7, 0, 'cargador']]}
};
function buildAA(o, lvl) {
  const g = new GB(), m = AA[o.modelo] || AA.bofors, piv = [0, m.ty, 0]; g.on(0);
  // base fija
  if (o.modelo === 'flakv') { g.poly(Z.MAIN, 0, [[0, 2.2], [-1.9, -1.1], [1.9, -1.1]], [0, 0.35, 0], [-90, 0, 0]); if (!lvl) [[0, 2.2], [-1.9, -1.1], [1.9, -1.1]].forEach(([x, z]) => g.cyl(Z.ACC, 0, [x, 0.15, -z], 0.2, 0.25, 0.3, 4)); }
  else if (o.modelo === 'type96') { g.cyl(Z.MAIN, 0, [0, 0.35, 0], 0.42, 0.6, 0.7, lvl ? 4 : 6, {top: true}); if (!lvl) g.cyl(Z.ACC, 0, [0, 0.05, 0], 0.75, 0.75, 0.1, 6, {top: true}); }
  else { [0, 90, 180, 270].forEach(a => g.box(Z.MAIN, 0, [Math.sin(a * D2R) * 1.4, 0.18, Math.cos(a * D2R) * 1.4], [0.22, 0.22, 2.8], {rot: [0, a, 0]})); if (!lvl) [0, 90, 180, 270].forEach(a => g.cyl(Z.ACC, 0, [Math.sin(a * D2R) * 2.75, 0.12, Math.cos(a * D2R) * 2.75], 0.22, 0.25, 0.25, 4)); g.box(Z.MAIN, 0, [0, 0.5, 0], [1.1, 0.5, 1.1]); }
  // parte giratoria
  g.set(K.AA, piv); g.cyl(Z.MAIN, 0, [0, 0.85, 0], 0.55, 0.5, 0.35, lvl ? 4 : 6, {top: true});
  g.box(Z.MAIN, 0, [0.42, 1.2, 0], [0.12, 0.6, 0.7]); g.box(Z.MAIN, 0, [-0.42, 1.2, 0], [0.12, 0.6, 0.7]);
  if (!lvl) [[0.75, -0.4], [-0.75, -0.4]].forEach(([x, z]) => { g.box(Z.ACC, 0, [x, 0.95, z], [0.4, 0.08, 0.35]); });       // asientos
  if (m.shield && lvl < 2) { g.box(Z.MAIN, 0, [0, 1.35, 0.55], [1.7, 0.9, 0.05], {noBack: false}); g.box(Z.MAIN, 0, [0.92, 1.35, 0.35], [0.05, 0.9, 0.45]); g.box(Z.MAIN, 0, [-0.92, 1.35, 0.35], [0.05, 0.9, 0.45]); }
  // cañones: giran con el rumbo AA y se elevan sobre el muñón (aux = desplazamiento del muñón respecto al pivote)
  g.set(K.AAGUN, piv, [0, 0]);
  const nb = lvl ? Math.min(m.n, 2) : m.n, pos = m.n === 4 ? [[-0.22, 0.15], [0.22, 0.15], [-0.22, -0.15], [0.22, -0.15]] : m.n === 3 ? [[-0.25, 0], [0, 0], [0.25, 0]] : [[0, 0]];
  g.box(Z.MAIN, 0, [0, m.ty, 0.2], [m.n > 1 ? 0.75 : 0.4, 0.45, 1.2], {});
  for (let i = 0; i < nb; i++) { const [x, y] = pos[i]; g.cyl(Z.FIX, C.oscuro, [x, m.ty + y, 0.8 + m.len / 2], m.cal * 1.4, m.cal, m.len, lvl ? 3 : 4, {rot: [90, 0, 0]}); if (!lvl && o.modelo === 'bofors') g.cyl(Z.FIX, C.oscuro, [x, m.ty, 0.8 + m.len + 0.15], m.cal * 2.2, m.cal * 2.2, 0.35, 5, {rot: [90, 0, 0]}); }
  if (!lvl && o.modelo === 'bofors') g.box(Z.FIX, C.laton, [0, m.ty + 0.45, 0.1], [0.2, 0.5, 0.35]);                // peine de 4 disparos
  if (!lvl && o.modelo === 'flakv') [1, -1].forEach(s => g.box(Z.FIX, C.oscuro, [s * 0.22, m.ty - 0.32, 0.4], [0.08, 0.35, 0.25])); // cargadores
  if (!lvl && o.modelo === 'type96') g.box(Z.FIX, C.oscuro, [0, m.ty + 0.32, 0.3], [0.7, 0.18, 0.3]);
  g.set(0);
  g.emit = {armas: pos.slice(0, m.n).map(([x, y]) => [x, m.ty + y, 0.8 + m.len])}; g.crew = m.crew.map(([x, z, yaw, papel]) => ({x, z, yaw, papel, kind: 'servidor_pieza'}));
  return g;
}

/* ---------- clips ---------- */
// Formato de troops3d: pistas [t, rx, ry, rz] en grados por parte; root [t, x, y, z] en metros; pos[parte] traslación; ev [t, nombre]; hide[parte] [t, visible].
// La parte «param» lleva en pos.param [t, tren, retroceso, compuertas] y «param2» [t, retroceso AA, 0, 0]. Los giros de la raíz son decorativos
// (balanceo, alabeo, picado); el juego mueve el buque o el avión por su trayectoria.
function mk(dur, loop, tracks, ev, extra) { return Object.assign({dur, loop, tracks: tracks || {}, ev: ev || []}, extra || {}); }
const wave = (n, f) => { const out = []; for (let i = 0; i <= n; i++) { const t = i / n; out.push([t].concat(f(t))); } return out; };
const S2 = t => Math.sin(t * Math.PI * 2), C2 = t => Math.cos(t * Math.PI * 2);
const pulse = (t0, t1, a) => [[0, 0, 0, 0], [t0, 0, 0, 0], [t0 + 0.02, a[0], a[1], a[2]], [t1, 0, 0, 0], [1, 0, 0, 0]];
const P_UP = [[0, 1, 0, 0]], P_DOWN = [[0, 0, 0, 0]];
const CLIPS = {};
const sea = (rA, pA, hA, ph) => ({tracks: {casco: wave(8, t => [pA * S2(t + (ph || 0.25)), 0, rA * S2(t)])}, root: wave(8, t => [0, hA * C2(t * 2), 0])});
CLIPS.buque = {
  navegar_calma: mk(8, true, sea(1.5, 0.5, 0.3).tracks, [], {root: sea(1.5, 0.5, 0.3).root}),
  navegar_marejada: mk(6, true, sea(6, 2.5, 0.8).tracks, [[0.25, 'roción'], [0.75, 'roción']], {root: sea(6, 2.5, 0.8).root}),
  navegar_tormenta: mk(5, true, sea(14, 5, 1.6).tracks, [[0.2, 'ola_rompe'], [0.7, 'ola_rompe']], {root: sea(14, 5, 1.6).root}),
  avante_toda: mk(4, true, {casco: wave(8, t => [-1.2 + 0.4 * S2(t), 0, 1.0 * S2(t)])}, [[0, 'estela'], [0.5, 'estela']]),
  girar_babor: mk(4, true, {casco: wave(4, t => [0, 0, -5 + 0.6 * S2(t)])}),
  girar_estribor: mk(4, true, {casco: wave(4, t => [0, 0, 5 + 0.6 * S2(t)])}),
  fuego_artilleria: mk(6, true, {casco: [[0, 0, 0, 0], [0.1, 0, 0, 0], [0.13, 0, 0, 1.8], [0.4, 0, 0, -0.5], [0.6, 0, 0, 0], [1, 0, 0, 0]]}, [[0.1, 'fuego'], [0.11, 'fogonazo'], [0.14, 'humo'], [0.55, 'cargar']],
    {pos: {param: [[0, 0, 0, 0], [0.1, 0, 0, 0], [0.11, 0, 1, 0], [0.3, 0, 0, 0], [1, 0, 0, 0]]}}),
  andanada: mk(3, false, {casco: [[0, 0, 0, 0], [0.1, 0, 0, 0], [0.14, 0, 0, 4], [0.45, 0, 0, -1.5], [0.8, 0, 0, 0.4], [1, 0, 0, 0]]}, [[0.1, 'fuego'], [0.1, 'fogonazo'], [0.15, 'humo'], [0.2, 'onda_agua']],
    {pos: {param: [[0, 0, 0, 0], [0.1, 0, 0, 0], [0.11, 0, 1, 0], [0.4, 0, 0, 0], [1, 0, 0, 0]]}}),
  fuego_antiaereo: mk(1.2, true, {casco: [[0, 0, 0, 0]]}, [[0, 'fuego_aa'], [0.25, 'fuego_aa'], [0.5, 'fuego_aa'], [0.75, 'fuego_aa']],
    {pos: {param2: [0, 0.02, 0.15, 0.25, 0.27, 0.4, 0.5, 0.52, 0.65, 0.75, 0.77, 0.9, 1].map((t, i) => [t, [0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0][i], 0, 0])}}),
  lanzar_torpedos: mk(3, false, {casco: [[0, 0, 0, 0], [0.3, 0, 0, 0], [0.4, 0, 0, -0.8], [1, 0, 0, 0]]}, [[0.3, 'torpedo'], [0.38, 'torpedo'], [0.46, 'torpedo'], [0.54, 'torpedo']]),
  recibir_impacto: mk(1.6, false, {casco: [[0, 0, 0, 0], [0.05, 1.5, 0, -4], [0.3, -0.8, 0, 2.5], [0.6, 0.3, 0, -1], [1, 0, 0, 0]]}, [[0, 'impacto'], [0.02, 'columna_agua'], [0.2, 'humo']], {root: [[0, 0, 0, 0], [0.05, 0, -0.6, 0], [0.4, 0, 0.2, 0], [1, 0, 0, 0]]}),
  incendio: mk(3, true, {casco: wave(6, t => [0.3 * S2(t), 0, 3 + 0.8 * S2(t)])}, [[0, 'fuego'], [0.33, 'humo_negro'], [0.66, 'fuego']]),
  escorar: mk(5, false, {casco: [[0, 0, 0, 0], [1, 1.5, 0, 18]]}, [[0, 'inundacion'], [0.5, 'humo_negro']], {root: [[0, 0, 0, 0], [1, 0, -2, 0]]}),
  hundirse_proa: mk(14, false, {casco: [[0, 0, 0, 0], [0.4, 8, 0, 4], [1, 28, 0, 9]]}, [[0, 'inundacion'], [0.3, 'vapor'], [0.8, 'remolino'], [1, 'hundido']], {root: [[0, 0, 0, 0], [0.4, 0, -4, 0], [1, 0, -38, 0]]}),
  hundirse_popa: mk(14, false, {casco: [[0, 0, 0, 0], [0.4, -8, 0, -3], [1, -32, 0, -6]]}, [[0, 'inundacion'], [0.3, 'vapor'], [0.8, 'remolino'], [1, 'hundido']], {root: [[0, 0, 0, 0], [0.4, 0, -4, 0], [1, 0, -38, 0]]}),
  volcar: mk(12, false, {casco: [[0, 0, 0, 0], [0.3, 0, 0, 25], [0.7, 2, 0, 120], [1, 4, 0, 165]]}, [[0, 'inundacion'], [0.6, 'vuelco'], [1, 'hundido']], {root: [[0, 0, 0, 0], [0.6, 0, -6, 0], [1, 0, -26, 0]]}),
  partirse: mk(14, false, {casco: [[0, 0, 0, 0], [1, 0, 0, 6]], proa: [[0, 0, 0, 0], [0.1, -4, 0, 0], [0.5, -18, 0, -3], [1, -32, 0, -6]], popa: [[0, 0, 0, 0], [0.1, 4, 0, 0], [0.5, 16, 0, 4], [1, 26, 0, 8]]},
    [[0, 'explosion_santabarbara'], [0.02, 'columna_humo'], [0.1, 'se_parte'], [0.6, 'remolino'], [1, 'hundido']],
    {root: [[0, 0, 0, 0], [0.1, 0, -2, 0], [1, 0, -42, 0]], pos: {proa: [[0, 0, 0, 0], [0.1, 0, 0, 3], [1, 0, -4, 14]], popa: [[0, 0, 0, 0], [0.1, 0, 0, -3], [1, 0, -2, -12]]}}),
  inmersion: mk(8, false, {casco: [[0, 0, 0, 0], [0.3, 4, 0, 0], [0.8, 3, 0, 0], [1, 0, 0, 0]]}, [[0, 'purga'], [0.2, 'burbujas'], [0.7, 'sumergido']], {root: [[0, 0, 0, 0], [1, 0, -12, 0]]}),
  emerger: mk(8, false, {casco: [[0, 0, 0, 0], [0.3, -5, 0, 0], [0.8, -2, 0, 0], [1, 0, 0, 0]]}, [[0, 'soplado'], [0.6, 'espuma'], [1, 'en_superficie']], {root: [[0, 0, -12, 0], [1, 0, 0, 0]]}),
  sumergido_periscopio: mk(8, true, {casco: [[0, 0, 0, 0]], periscopio: [[0, 0, 0, 0], [0.5, 0, 180, 0], [1, 0, 360, 0]]}, [[0, 'estela_periscopio']], {root: [[0, 0, -9.5, 0]], pos: {periscopio: [[0, 0, 2.5, 0]]}}),
  botar_chalupas: mk(6, false, {casco: [[0, 0, 0, 0]]}, [[0.2, 'pescantes'], [0.9, 'chalupas_al_agua']], {pos: {botes: [[0, 0, 0, 0], [0.2, 0, 1, 0], [1, 0, -11, 0]]}}),
  operar_ascensores: mk(12, true, {casco: [[0, 0, 0, 0]]}, [[0, 'ascensor_baja'], [0.5, 'ascensor_sube']], {pos: {ascensores: [[0, 0, 0, 0], [0.15, 0, 0, 0], [0.35, 0, -7, 0], [0.6, 0, -7, 0], [0.8, 0, 0, 0], [1, 0, 0, 0]]}}),
  lanzar_aviones: mk(10, true, {casco: wave(4, t => [-0.6, 0, 0.6 * S2(t)])}, [[0.1, 'despega'], [0.4, 'despega'], [0.7, 'despega']]),
  cortina_de_humo: mk(4, true, {casco: wave(4, t => [-1, 0, 0.8 * S2(t)])}, [[0, 'humo_cortina'], [0.5, 'humo_cortina']]),
  lanzar_bengala: mk(2, false, {casco: [[0, 0, 0, 0]]}, [[0.2, 'bengala']]),
  fondeado: mk(10, true, {casco: wave(4, t => [0.3 * S2(t + 0.3), 0, 0.8 * S2(t)])})
};
['navegar_calma', 'navegar_marejada', 'navegar_tormenta', 'fondeado'].forEach(k => { CLIPS.buque[k].sea = true; });
const GEAR_UP = {param: [[0, 1, 0, 0]]}, GEAR_DN = {param: [[0, 0, 0, 0]]};
CLIPS.avion = {
  en_tierra: mk(2, true, {avion: [[0, -9, 0, 0]]}, [], {pos: cp2(GEAR_DN)}),
  rodar_pista: mk(1.2, true, {avion: wave(4, t => [-9 + 0.4 * S2(t), 0, 0.6 * S2(t * 2)])}, [[0, 'polvo']], {pos: cp2(GEAR_DN)}),
  despegar: mk(6, false, {avion: [[0, -9, 0, 0], [0.35, 0, 0, 0], [0.55, -8, 0, 0], [1, -6, 0, 0]]}, [[0, 'motor_a_fondo'], [0.5, 'despegue'], [0.7, 'tren_arriba']], {pos: {param: [[0, 0, 0, 0], [0.6, 0, 0, 0], [0.9, 1, 0, 0], [1, 1, 0, 0]]}}),
  vuelo_nivelado: mk(4, true, {avion: wave(4, t => [0.6 * S2(t), 0, 1.2 * S2(t + 0.2)])}, [], {root: wave(4, t => [0, 0.3 * S2(t), 0]), pos: cp2(GEAR_UP)}),
  viraje_izquierda: mk(4, true, {avion: wave(4, t => [-3, 0, -60 + 3 * S2(t)])}, [], {pos: cp2(GEAR_UP)}),
  viraje_derecha: mk(4, true, {avion: wave(4, t => [-3, 0, 60 + 3 * S2(t)])}, [], {pos: cp2(GEAR_UP)}),
  ascenso: mk(3, true, {avion: wave(3, t => [-18, 0, 1.5 * S2(t)])}, [], {pos: cp2(GEAR_UP)}),
  picado: mk(3, true, {avion: wave(3, t => [40, 0, 1.5 * S2(t)])}, [[0, 'silbido']], {pos: cp2(GEAR_UP)}),
  tonel: mk(2.5, false, {avion: [[0, 0, 0, 0], [1, 0, 0, 360]]}, [], {pos: cp2(GEAR_UP)}),
  ataque_en_picado: mk(7, false, {avion: [[0, 0, 0, 0], [0.12, 0, 0, 170], [0.2, 65, 0, 180], [0.55, 70, 0, 180], [0.62, 70, 0, 180], [0.75, -25, 0, 180], [0.85, -25, 0, 0], [1, 0, 0, 0]]},
    [[0.15, 'frenos_de_picado'], [0.5, 'sirena'], [0.6, 'bomba'], [0.75, 'recuperacion']], {pos: {param: [[0, 1, 0, 0], [0.55, 1, 0, 0], [0.58, 1, 0, 1], [0.7, 1, 0, 0], [1, 1, 0, 0]]}}),
  disparar: mk(0.6, true, {avion: wave(4, t => [0.3 * S2(t * 3), 0, 0.3 * S2(t * 2)])}, [[0, 'rafaga'], [0.17, 'rafaga'], [0.33, 'rafaga'], [0.5, 'rafaga'], [0.67, 'rafaga'], [0.83, 'rafaga'], [0.4, 'casquillos']], {pos: cp2(GEAR_UP)}),
  disparar_torretas: mk(0.8, true, {avion: [[0, 0, 0, 0]]}, [[0, 'rafaga_torreta'], [0.25, 'rafaga_torreta'], [0.5, 'rafaga_torreta'], [0.75, 'rafaga_torreta']],
    {pos: {param: [[0, 1, 0, 0]], param2: [0, 0.02, 0.2, 0.25, 0.27, 0.45, 0.5, 0.52, 0.7, 0.75, 0.77, 0.95, 1].map((t, i) => [t, [0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0][i], 0, 0])}}),
  soltar_bombas: mk(5, false, {avion: [[0, 0, 0, 0], [0.4, 0, 0, 0], [0.75, -2, 0, 0], [1, 0, 0, 0]]}, [[0.1, 'compuertas'], [0.3, 'bomba'], [0.38, 'bomba'], [0.46, 'bomba'], [0.54, 'bomba'], [0.62, 'bomba'], [0.7, 'bomba'], [0.9, 'compuertas']],
    {pos: {param: [[0, 1, 0, 0], [0.08, 1, 0, 0], [0.22, 1, 0, 1], [0.8, 1, 0, 1], [0.95, 1, 0, 0], [1, 1, 0, 0]]}}),
  lanzar_torpedo: mk(4, false, {avion: [[0, 0, 0, 0], [0.3, 2, 0, 0], [0.45, -6, 0, 0], [1, -10, 0, 0]]}, [[0.35, 'torpedo']], {pos: cp2(GEAR_UP)}),
  lanzar_paracaidistas: mk(8, false, {avion: wave(8, t => [0.4 * S2(t * 3), 0, 1 * S2(t * 2)])}, [0.1, 0.18, 0.26, 0.34, 0.42, 0.5, 0.58, 0.66, 0.74, 0.82].map(t => [t, 'salta']).concat([[0.05, 'luz_verde']]), {pos: cp2(GEAR_UP)}),
  recibir_impacto: mk(1.2, false, {avion: [[0, 0, 0, 0], [0.06, 6, 0, -14], [0.3, -3, 0, 8], [0.6, 1, 0, -3], [1, 0, 0, 0]]}, [[0, 'impacto'], [0.05, 'chispas'], [0.1, 'restos']], {pos: cp2(GEAR_UP)}),
  humo_motor: mk(2, true, {avion: wave(4, t => [1 * S2(t), 0, 4 * S2(t + 0.2)])}, [[0, 'humo_motor'], [0.25, 'humo_motor'], [0.5, 'humo_motor'], [0.75, 'humo_motor']], {pos: cp2(GEAR_UP)}),
  incendio: mk(1.5, true, {avion: wave(4, t => [3 + 1 * S2(t), 0, 6 * S2(t + 0.2)])}, [[0, 'fuego_motor'], [0.33, 'humo_negro'], [0.66, 'fuego_motor']], {pos: cp2(GEAR_UP)}),
  caer_en_barrena: mk(2, true, {avion: wave(8, t => [55, -t * 360, 25])}, [[0, 'humo_negro'], [0.5, 'humo_negro']], {pos: cp2(GEAR_UP)}),
  partirse_ala: mk(5, false, {avion: [[0, 0, 0, 0], [0.15, 10, 0, 40], [1, 70, 0, 400]], alaDe: [[0, 0, 0, 0], [0.12, 0, 0, -20], [1, 50, 120, -420]]}, [[0, 'explosion'], [0.08, 'ala_rota'], [0.2, 'humo_negro'], [0.6, 'humo_negro']],
    {pos: {param: [[0, 1, 0, 0]], alaDe: [[0, 0, 0, 0], [0.12, 0, 0, 0], [1, -12, -40, -30]]}}),
  colision: mk(1.5, false, {avion: [[0, 0, 0, 0], [0.1, 30, 20, 60], [1, 80, 40, 180]]}, [[0, 'colision'], [0.05, 'explosion'], [0.2, 'restos']], {root: [[0, 0, 0, 0], [1, 0, -10, -6]], pos: cp2(GEAR_UP)}),
  aterrizar: mk(7, false, {avion: [[0, -2, 0, 0], [0.5, -3, 0, 0], [0.8, -9, 0, 0], [1, -9, 0, 0]]}, [[0.1, 'tren_abajo'], [0.75, 'toma'], [0.78, 'polvo']], {pos: {param: [[0, 1, 0, 0], [0.1, 1, 0, 0], [0.35, 0, 0, 0], [1, 0, 0, 0]]}}),
  apontar: mk(5, false, {avion: [[0, -6, 0, 0], [0.6, -8, 0, 2], [0.75, -11, 0, 0], [0.8, -6, 0, 0], [1, -9, 0, 0]]}, [[0.72, 'toma'], [0.74, 'cable'], [0.8, 'frenado']], {pos: cp2(GEAR_DN)})
};
CLIPS.aa = {
  reposo: mk(4, true, {base: [[0, 0, 0, 0]]}),
  disparar_AA: mk(1.2, true, {base: wave(6, t => [0.4 * Math.max(0, S2(t * 3)), 0, 0])}, [[0, 'fuego_aa'], [0.33, 'fuego_aa'], [0.66, 'fuego_aa'], [0.5, 'casquillos']],
    {pos: {param2: [0, 0.02, 0.2, 0.33, 0.35, 0.53, 0.66, 0.68, 0.86, 1].map((t, i) => [t, [0, 1, 0, 0, 1, 0, 0, 1, 0, 0][i], 0, 0])}}),
  recargar: mk(3, false, {base: [[0, 0, 0, 0]]}, [[0.3, 'cargador_fuera'], [0.7, 'cargador_dentro']]),
  destruido: mk(1.5, false, {base: [[0, 0, 0, 0], [0.2, -8, 20, 12], [1, -6, 25, 18]]}, [[0, 'explosion'], [0.3, 'humo_negro']], {root: [[0, 0, 0, 0], [1, 0, -0.2, 0]]})
};
function cp2(o) { return JSON.parse(JSON.stringify(o)); }
// clips de proyectiles del juego: «fuego» → cañones principales (emit.torres), «fuego_aa» → montajes AA, «torpedo» → tubos, «bomba» → bodega
const CLIP_SETS = {}; Object.keys(CLIPS).forEach(r => { CLIP_SETS[r] = Object.keys(CLIPS[r]); });

/* ---------- registro de tipos ---------- */
// modelos por nación (época 2 en este punto de control; la época 1 usa el de la 2 hasta la segunda entrega y lo marca como aproximación)
const SHIP_LOD2 = {acorazado: [1, 0.14, 0.05, 0.12], destructor: [1, 0.1, 0.05, 0.08], submarino: [1, 0.09, 0.03, 0.06], portaaviones: [1, 0.12, 0.07, 0.03]};
const NAVE_KINDS = {
  acorazado: {clase: 'naval', rig: 'buque', dom: 'mar', nombre: 'Acorazado', lim: [1600, 500, 12], build: buildBattleship, tabla: BB, modelos: {GBR: 'kgv', GER: 'bismarck', JPN: 'yamato', USA: 'kgv', FRA: 'bismarck', ITA: 'bismarck', SOV: 'kgv', GEN: 'kgv'}},
  destructor: {clase: 'naval', rig: 'buque', dom: 'mar', nombre: 'Destructor', lim: [900, 300, 12], build: buildDestroyer, tabla: DD, modelos: {GBR: 'tribal', GER: 'z1', JPN: 'fubuki', USA: 'tribal', FRA: 'z1', ITA: 'z1', SOV: 'tribal', GEN: 'tribal'}},
  submarino: {clase: 'naval', rig: 'buque', dom: 'mar', nombre: 'Submarino', lim: [500, 160, 12], build: buildSub, tabla: SUB, modelos: {GBR: 'tclass', GER: 'vii', JPN: 'i15', USA: 'tclass', FRA: 'tclass', ITA: 'vii', SOV: 'vii', GEN: 'vii'}},
  portaaviones: {clase: 'naval', rig: 'buque', dom: 'mar', nombre: 'Portaaviones', lim: [1600, 500, 12], build: buildCarrier, tabla: CV, modelos: {GBR: 'illustrious', GER: 'graf', JPN: 'shokaku', USA: 'shokaku', FRA: 'illustrious', ITA: 'graf', SOV: 'illustrious', GEN: 'illustrious'}},
  caza: {clase: 'aereo', rig: 'avion', dom: 'aire', nombre: 'Caza monoplano', lim: [450, 150, 12], build: buildPlane, tabla: PLANES, modelos: {GBR: 'spitfire', GER: 'bf109', JPN: 'zero', USA: 'spitfire', FRA: 'bf109', ITA: 'bf109', SOV: 'bf109', GEN: 'spitfire'}},
  bombardero_pesado: {clase: 'aereo', rig: 'avion', dom: 'aire', nombre: 'Bombardero cuatrimotor', lim: [900, 300, 12], build: buildPlane, tabla: PLANES, modelos: {GBR: 'lancaster', GER: 'condor', JPN: 'renzan', USA: 'lancaster', FRA: 'lancaster', ITA: 'condor', SOV: 'lancaster', GEN: 'lancaster'}},
  antiaereo: {clase: 'defensa', rig: 'aa', dom: 'tierra', nombre: 'Antiaéreo con dotación', lim: [500, 200, 12], build: buildAA, tabla: AA, modelos: {GBR: 'bofors', GER: 'flakv', JPN: 'type96', USA: 'bofors', FRA: 'bofors', ITA: 'flakv', SOV: 'bofors', GEN: 'bofors'}, dotacion: 3}
};
// tipos del juego → naves3d
const NAVE_MAP = {
  sail: {kind: null, nota: 'velero: época 1 (segunda entrega)'}, steam: {kind: null, nota: 'vapor: segunda entrega'}, ironclad: {kind: null, nota: 'acorazado de casamata: segunda entrega'},
  cruiser: {kind: 'destructor', nota: 'crucero: provisionalmente el destructor; modelo propio en la segunda entrega'}, sub: {kind: 'submarino'}, dread: {kind: 'acorazado', nota: 'dreadnought: modelo de 1914–18 en la segunda entrega'},
  destroyer: {kind: 'destructor'}, carrier: {kind: 'portaaviones'}, bb: {kind: 'acorazado'},
  fighter: {kind: 'caza'}, fighters: {kind: 'caza'}, bomber: {kind: 'bombardero_pesado'}, bombers: {kind: 'bombardero_pesado'}, military_aviation: {kind: 'caza'}
};
function naveModel(kind, nation) { const K = NAVE_KINDS[kind]; return K.modelos[nation] || K.modelos.GEN; }
function naveOpts(kind, era, nation) {
  const K = NAVE_KINDS[kind], pal = navePalette(nation || 'GEN', era, K.dom); return {modelo: naveModel(kind, nation), flagLayout: pal.flagLayout, markType: pal.markType, idBand: (nation === 'JPN' && kind === 'caza') || nation === 'GER' && false};
}
function naveGeoKey(kind, era, nation) { const o = naveOpts(kind, era, nation); return [kind, era === '1' ? '1' : '2', o.modelo, o.markType, o.flagLayout, o.idBand ? 'id' : ''].join('|'); }
function lod2(kind, o) {
  const K = NAVE_KINDS[kind];
  if (K.clase === 'naval') { const m = K.tabla[o.modelo]; return shipSil(o, m.L, m.B, m.D * (kind === 'portaaviones' ? 1.6 : 1), kind === 'submarino' ? m.tower.h : kind === 'portaaviones' ? 8 : m.D * 1.4); }
  const g = new GB();
  if (K.clase === 'aereo') { const m = K.tabla[o.modelo]; g.on(AP.cuerpo); g.poly(Z.MAIN, 0, [[m.B / 2, 0], [-m.B / 2, 0], [-m.B * 0.42, -m.L * 0.12], [m.B * 0.42, -m.L * 0.12]], [0, 0, m.L * 0.12], [-90, 0, 0], true);
    g.poly(Z.MAIN, 0, [[0.6, m.L / 2], [-0.6, m.L / 2], [-0.3, -m.L / 2], [0.3, -m.L / 2]], [0, 0.05, 0], [-90, 0, 0], true); g.poly(Z.MAIN, 0, [[m.B * 0.18, 0], [-m.B * 0.18, 0], [0, -m.L * 0.08]], [0, 0.1, -m.L * 0.38], [-90, 0, 0], true); return g; }
  g.box(Z.MAIN, 0, [0, 0.6, 0], [2, 1.2, 2.5], {}); return g;
}
const _cache = {};
// buildNave(tipo, época, {nation}) → {tint, fixed, geometry, parts, clips, lod: [{level, geometry, tint, fixed, tris}×3], emit, crew, nota, modelo}
function buildNave(kind, era, opts) {
  opts = opts || {}; const K = NAVE_KINDS[kind]; if (!K) throw new Error('naves3d: tipo desconocido ' + kind);
  era = era === '1' ? '1' : '2'; const nat = opts.nation || 'GEN', key = naveGeoKey(kind, era, nat); if (_cache[key]) return _cache[key];
  const o = naveOpts(kind, era, nat), gs = [K.build(o, 0), K.build(o, 1), lod2(kind, o)];
  const lv = gs.map((g, level) => ({level, geometry: g.toGeometry(), tint: g.toGeometry(z => z < 11.5), fixed: g.toGeometry(z => z >= 11.5), tris: g.tris()}));
  const m = K.tabla[o.modelo];
  const res = {kind, era, modelo: o.modelo, rig: K.rig, parts: RIGS[K.rig].map(p => p[0]), clips: CLIP_SETS[K.rig], tris: lv[0].tris, geometry: lv[0].geometry, tint: lv[0].tint, fixed: lv[0].fixed, lod: lv,
    emit: gs[0].emit || {}, crew: gs[0].crew || null, nota: (m && m.nota || '') + (era === '1' ? ' [época 1: modelo de la época 2 provisional]' : ''), eslora: m && m.L, manga: m && m.B, envergadura: m && m.B, longitud: m && m.L};
  _cache[key] = res; return res;
}

/* ---------- poses y horneado ---------- */
const _e = new THREE.Euler(), _q = new THREE.Quaternion(), _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1), _pm = new THREE.Matrix4();
function smooth(t) { return t * t * (3 - 2 * t); }
function sampleTrack(tr, t, out, n) {
  if (!tr || !tr.length) { for (let i = 0; i < n; i++) out[i] = 0; return out; }
  if (tr.length === 1 || t <= tr[0][0]) { for (let i = 0; i < n; i++) out[i] = tr[0][i + 1]; return out; }
  for (let k = 0; k < tr.length - 1; k++) { const a = tr[k], b = tr[k + 1]; if (t <= b[0]) { const u = smooth((t - a[0]) / Math.max(1e-6, b[0] - a[0])); for (let i = 0; i < n; i++) out[i] = a[i + 1] + (b[i + 1] - a[i + 1]) * u; return out; } }
  const l = tr[tr.length - 1]; for (let i = 0; i < n; i++) out[i] = l[i + 1]; return out;
}
const _r3 = [0, 0, 0], _t3 = [0, 0, 0], _t1 = [0];
function sampleStep(tr, t, out, n) { let k = 0; for (let i = 0; i < tr.length; i++) if (tr[i][0] <= t + 1e-6) k = i; for (let i = 0; i < n; i++) out[i] = tr[k][i + 1]; return out; }
// poseNave(tipo o esqueleto, clip, fase, salida Float32Array(8×16)) → matrices por parte; param y param2 llevan escalares en la traslación (sin padre)
function poseNave(kindOrRig, clipName, phase, out) {
  const rig = RIGS[kindOrRig] ? kindOrRig : NAVE_KINDS[kindOrRig].rig, parts = RIGS[rig], clip = (CLIPS[rig] || {})[clipName] || {tracks: {}};
  out = out || new Float32Array(MAXP * 16); const t = clip.loop === false ? Math.min(1, Math.max(0, phase)) : phase - Math.floor(phase);
  for (let i = 0; i < parts.length; i++) {
    const name = parts[i][0], par = parts[i][1], off = parts[i][2], isParam = i >= 6 && /^param/.test(name);
    sampleTrack(clip.tracks[name], t, _r3, 3); _e.set(_r3[0] * D2R, _r3[1] * D2R, _r3[2] * D2R); _q.setFromEuler(_e); _p.set(off[0], off[1], off[2]);
    if (par < 0 && clip.root) { sampleTrack(clip.root, t, _t3, 3); _p.x += _t3[0]; _p.y += _t3[1]; _p.z += _t3[2]; }
    if (clip.pos && clip.pos[name]) { sampleTrack(clip.pos[name], t, _t3, 3); _p.x += _t3[0]; _p.y += _t3[1]; _p.z += _t3[2]; }
    _m.compose(_p, _q, _s); if (par >= 0 && !isParam) { _pm.fromArray(out, par * 16); _m.premultiply(_pm); }
    _m.toArray(out, i * 16);
  }
  if (clip.hide) for (const name in clip.hide) { sampleStep(clip.hide[name], t, _t1, 1); if (_t1[0] > 0.5) continue; for (let i = 0; i < parts.length; i++) if (parts[i][0] === name) { const o = i * 16; out[o] = out[o + 1] = out[o + 2] = out[o + 4] = out[o + 5] = out[o + 6] = out[o + 8] = out[o + 9] = out[o + 10] = 0; } }
  return out;
}
function blendPose(a, b, k, out) { out = out || new Float32Array(a.length); for (let i = 0; i < a.length; i++) out[i] = a[i] + (b[i] - a[i]) * k; return out; }
let _baked = null;
function bakeClips() {
  if (_baked) return _baked; const rows = [], index = {}; let row = 0;
  Object.keys(CLIPS).forEach(rig => { index[rig] = {}; Object.keys(CLIPS[rig]).forEach(cn => { const c = CLIPS[rig][cn], frames = Math.max(2, Math.min(96, Math.round(c.dur * (c.loop === false ? 16 : 12))));
    index[rig][cn] = {row, frames, dur: c.dur, loop: c.loop !== false, ev: c.ev || []}; for (let f = 0; f < frames; f++) rows.push(poseNave(rig, cn, c.loop === false ? f / (frames - 1) : f / frames)); row += frames; }); });
  const FPR = Math.max(1, Math.ceil(rows.length / 2048)), W = MAXP * 3 * FPR, H = Math.ceil(rows.length / FPR), data = new Float32Array(W * H * 4);
  rows.forEach((m, r) => { const rr = Math.floor(r / FPR), cc = r - rr * FPR; for (let p = 0; p < MAXP; p++) { const o = (rr * W + cc * MAXP * 3 + p * 3) * 4, e = m.subarray(p * 16, p * 16 + 16); for (let i = 0; i < 3; i++) { data[o + i * 4] = e[i]; data[o + i * 4 + 1] = e[4 + i]; data[o + i * 4 + 2] = e[8 + i]; data[o + i * 4 + 3] = e[12 + i]; } } });
  const tex = new THREE.DataTexture(data, W, H, THREE.RGBAFormat, THREE.FloatType); tex.needsUpdate = true; tex.magFilter = tex.minFilter = THREE.NearestFilter;
  _baked = {tex, index, rows, W, H, FPR, frames: rows.length, bytes: data.byteLength}; return _baked;
}

/* ---------- paletas y banderas ---------- */
function makePaletteTex(entries) {
  const W = 12, H = entries.length, d = new Uint8Array(W * H * 4), put = (r, c, hex) => { const v = new THREE.Color(hex), o = (r * W + c) * 4; d[o] = Math.round(Math.pow(v.r, 1 / 2.2) * 255); d[o + 1] = Math.round(Math.pow(v.g, 1 / 2.2) * 255); d[o + 2] = Math.round(Math.pow(v.b, 1 / 2.2) * 255); d[o + 3] = 255; };
  entries.forEach((e, r) => { const p = navePalette(e[0], e[1], e[2]); [p.main, p.trim, p.acc, p.deck, p.flag[0], p.flag[1], p.flag[2], p.band, p.mark[0], p.mark[1], p.mark[2], p.id].forEach((h, c) => put(r, c, h)); });
  const tex = new THREE.DataTexture(d, W, H, THREE.RGBAFormat); tex.needsUpdate = true; tex.magFilter = tex.minFilter = THREE.NearestFilter; tex.colorSpace = THREE.SRGBColorSpace; return tex;
}
// atlas de banderas: 8 × 8 celdas de 128 × 80; flagSource(tag) → canvas / imagen / THREE.Texture (p. ej. b3FlagTex del juego). Sin fuente: franjas de la paleta.
function NaveFlagAtlas() { this.cells = {}; this.n = 0; if (typeof document === 'undefined') return; this.canvas = document.createElement('canvas'); this.canvas.width = 1024; this.canvas.height = 640; this.tex = new THREE.CanvasTexture(this.canvas); this.tex.colorSpace = THREE.SRGBColorSpace; }
NaveFlagAtlas.prototype.cell = function (tag, src) {
  if (this.cells[tag] != null) return this.cells[tag]; if (!src || !this.canvas || this.n >= 64) return -1;
  const img = src.isTexture ? src.image : src; if (!img) return -1; const i = this.n++, x = (i % 8) * 128, y = Math.floor(i / 8) * 80;
  this.canvas.getContext('2d').drawImage(img, x + 2, y + 2, 124, 76); this.tex.needsUpdate = true; this.cells[tag] = i; return i;
};

/* ---------- material ---------- */
// Atributos por instancia: iAnimA/iAnimB (clip actual y anterior, como troops3d), iLook = (fila de paleta + brillo, celda de bandera + 1 (0 = sin textura),
// fase de hélice, velocidad de hélice en rad/s), iAim = (rumbo torres, elevación torres, rumbo AA, elevación AA) en radianes respecto al casco;
// elevación < −0,5 = reposo (las torres vuelven a su rumbo de reposo).
function makeNaveMaterial(shared, opts) {
  opts = opts || {}; const mat = new THREE.MeshLambertMaterial({vertexColors: true, side: opts.side || THREE.FrontSide});
  mat.onBeforeCompile = sh => {
    ['uBones', 'uBonesSize', 'uFPR', 'uPal', 'uPalSize', 'uTime', 'uBlend', 'uFlags', 'uDebug'].forEach(k => { sh.uniforms[k] = shared.U[k]; });
    sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>
uniform sampler2D uBones; uniform vec2 uBonesSize; uniform float uFPR; uniform sampler2D uPal; uniform vec2 uPalSize; uniform float uTime; uniform float uBlend; uniform float uDebug;
attribute vec3 aInfo; attribute vec3 aPiv; attribute vec4 aAF;
attribute vec4 iAnimA; attribute vec4 iAnimB; attribute vec4 iLook; attribute vec4 iAim;
varying vec3 vFlag;
vec4 bt(float x, float y) { return texture2D(uBones, vec2((x + 0.5) / uBonesSize.x, (y + 0.5) / uBonesSize.y)); }
mat4 boneAt(float fr, float part) { float row = floor(fr / uFPR); float x = (fr - row * uFPR) * 24.0 + part * 3.0; vec4 a = bt(x, row), b = bt(x + 1.0, row), c = bt(x + 2.0, row);
  return mat4(a.x, b.x, c.x, 0.0, a.y, b.y, c.y, 0.0, a.z, b.z, c.z, 0.0, a.w, b.w, c.w, 1.0); }
mat4 clipBone(vec4 an, float part) {
  float fr = abs(an.y), f;
  if (an.y < 0.0) f = clamp((uTime - an.w) / an.z, 0.0, 1.0) * (fr - 1.0); else f = fract(uTime / an.z + an.w) * fr;
  float f0 = floor(f), f1 = an.y < 0.0 ? min(f0 + 1.0, fr - 1.0) : mod(f0 + 1.0, fr);
  return boneAt(an.x + f0, part) * (1.0 - (f - f0)) + boneAt(an.x + f1, part) * (f - f0);
}
mat4 animBone(float part) { mat4 m = clipBone(iAnimA, part); if (iAnimB.x >= 0.0) { float k = clamp((uTime - iAnimB.w) / uBlend, 0.0, 1.0); if (k < 1.0) m = clipBone(vec4(iAnimB.xyz, iAnimB.y < 0.0 ? -1e4 : iAnimA.w), part) * (1.0 - k) + m * k; } return m; }
vec3 rotY(vec3 v, float a) { float c = cos(a), s = sin(a); return vec3(v.x * c + v.z * s, v.y, -v.x * s + v.z * c); }
vec3 rotX(vec3 v, float a) { float c = cos(a), s = sin(a); return vec3(v.x, v.y * c - v.z * s, v.y * s + v.z * c); }
vec3 rotZ(vec3 v, float a) { float c = cos(a), s = sin(a); return vec3(v.x * c - v.y * s, v.x * s + v.y * c, v.z); }
float wrapPi(float a) { return a - 6.2831853 * floor((a + 3.1415927) / 6.2831853); }`)
      .replace('#include <beginnormal_vertex>', `mat4 bm = animBone(aPart);
vec3 prm = animBone(7.0)[3].xyz, prm2 = animBone(6.0)[3].xyz;
vec3 lp = position, ln = normal; float kd = floor(aKind + 0.5);
if (kd == 1.0 || kd == 2.0 || kd == 11.0 || kd == 12.0 || kd == 3.0 || kd == 4.0) {
  bool aa = kd == 3.0 || kd == 4.0, gun = kd == 2.0 || kd == 12.0 || kd == 4.0;
  float rest = kd > 10.5 ? 3.1415927 : aFx.x, ay = aa ? iAim.z : iAim.x, ae = aa ? iAim.w : iAim.y, yaw = rest, el = 0.0, arc = rest, lim = aa ? 3.2 : 2.6;
  if (aFx.y > 5.0) { arc = aFx.y - 10.0; lim = 1.6; }
  if (ae > -0.5) { yaw = arc + clamp(wrapPi(ay - arc), -lim, lim); el = clamp(ae, -0.09, aa ? 1.48 : 0.7); }
  lp -= aPiv;
  if (gun) { lp.y -= aAux.x; lp.z -= aAux.y; lp.z -= (aa ? prm2.x * 0.35 : prm.y * 0.9); lp = rotX(lp, -el); ln = rotX(ln, -el); lp.y += aAux.x; lp.z += aAux.y; }
  lp = rotY(lp, yaw); ln = rotY(ln, yaw); lp += aPiv;
} else if (kd == 5.0) { lp = rotY(lp - aPiv, uTime * 1.4) + aPiv; ln = rotY(ln, uTime * 1.4); }
else if (kd == 6.0) { float a = iLook.z + uTime * iLook.w; lp = rotZ(lp - aPiv, a) + aPiv; ln = rotZ(ln, a); }
else if (kd == 7.0 || kd == 8.0) { float a = (kd == 7.0 ? prm.x : prm.z) * aAux.y; lp -= aPiv; if (aAux.x < 0.5) { lp = rotX(lp, a); ln = rotX(ln, a); } else { lp = rotZ(lp, a); ln = rotZ(ln, a); } lp += aPiv; }
else if (kd == 9.0) { float u = aFx.x; lp += ln * (sin(u * 6.0 - uTime * 5.0 + iLook.z) * 0.18 + sin(u * 2.5 - uTime * 2.1) * 0.08) * u * (1.0 + aPiv.y * 0.0); }
vFlag = kd == 9.0 && iLook.y > 0.5 ? vec3((mod(iLook.y - 1.0, 8.0) + 0.02 + aFx.x * 0.96) / 8.0, 1.0 - (floor((iLook.y - 1.0) / 8.0) + 0.03 + aFx.y * 0.94) / 8.0, 1.0) : vec3(0.0);
vec3 objectNormal = normalize(mat3(bm) * ln + vec3(0.0, 1e-5, 0.0));
#ifdef USE_TANGENT
vec3 objectTangent = vec3(tangent.xyz);
#endif`)
      .replace('#include <begin_vertex>', `vec3 transformed = (bm * vec4(lp, 1.0)).xyz;`)
      .replace('#include <color_vertex>', `float aPart = aInfo.x, aZone = aInfo.y, aKind = aInfo.z; vec2 aAux = aAF.xy, aFx = aAF.zw;
float palRow = floor(iLook.x), bright = 0.93 + fract(iLook.x) * 0.14;
vec3 zc = aZone < 11.5 ? texture2D(uPal, vec2((aZone + 0.5) / uPalSize.x, (palRow + 0.5) / uPalSize.y)).rgb : color;
if (uDebug > 0.5 && aZone > 11.5) zc = vec3(0.55);
vColor = zc * (aZone < 3.5 ? bright : 1.0);`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform sampler2D uFlags;\nvarying vec3 vFlag;')
      .replace('#include <color_fragment>', `#include <color_fragment>
if (vFlag.z > 0.5) diffuseColor.rgb = texture2D(uFlags, vFlag.xy).rgb;`);
  };
  mat.customProgramCacheKey = () => 'naveVAT'; return mat;
}

/* ---------- compartido, lotes y LOD ---------- */
// NaveShared(naciones, {eras, flagSource}): textura de huesos de todos los clips, paletas (nación × época × dominio) y atlas de banderas.
function NaveShared(nations, opts) {
  opts = opts || {}; const baked = bakeClips(); this.baked = baked; this.eras = opts.eras || NAVE_ERAS.slice(); this.nations = []; this.flags = new NaveFlagAtlas(); this.flagSource = opts.flagSource || null;
  this.U = {uBones: {value: baked.tex}, uBonesSize: {value: new THREE.Vector2(baked.W, baked.H)}, uFPR: {value: baked.FPR}, uPal: {value: null}, uPalSize: {value: new THREE.Vector2(12, 1)}, uTime: {value: 0}, uBlend: {value: 0.4}, uFlags: {value: this.flags.tex || null}, uDebug: {value: 0}};
  this.timeU = this.U.uTime; this.addNations(nations || ['GEN']);
}
NaveShared.prototype.addNations = function (list) {
  list.forEach(n => { if (!this.nations.includes(n)) this.nations.push(n); }); if (!this.nations.includes('GEN')) this.nations.push('GEN');
  this.palEntries = []; this._row = {}; this.nations.forEach(n => this.eras.forEach(e => DOMS.forEach(d => { this._row[n + e + d] = this.palEntries.length; this.palEntries.push([n, e, d]); })));
  if (this.palTex) this.palTex.dispose(); this.palTex = makePaletteTex(this.palEntries); this.U.uPal.value = this.palTex; this.U.uPalSize.value.set(12, this.palEntries.length);
};
NaveShared.prototype.palRow = function (nation, era, dom) { const r = this._row[nation + era + dom]; return r != null ? r : this._row['GEN' + era + dom] || 0; };
NaveShared.prototype.flagCell = function (tag) { if (!this.flagSource) return -1; const c = this.flags.cell(tag, this.flags.cells[tag] == null ? this.flagSource(tag) : null); return c; };
NaveShared.prototype.clipInfo = function (rig, clip) { return this.baked.index[rig] && this.baked.index[rig][clip]; };
NaveShared.prototype.update = function (time) { this.U.uTime.value = time; };
const _m4 = new THREE.Matrix4(), _qq = new THREE.Quaternion(), _qa = new THREE.Quaternion(), _pp = new THREE.Vector3(), _ss = new THREE.Vector3(), _eu = new THREE.Euler(0, 0, 0, 'YXZ');
// NaveBatch: una malla instanciada por tipo + época + modelo + LOD
function NaveBatch(shared, kind, era, nation, cap, opts) {
  opts = opts || {}; const K = NAVE_KINDS[kind], t = buildNave(kind, era, {nation}), lod = opts.lod || 0, geo = t.lod[lod].geometry.clone();
  const A = (n, fill) => { const a = new THREE.InstancedBufferAttribute(new Float32Array(cap * n).fill(fill || 0), n); a.setUsage(THREE.DynamicDrawUsage); return a; };
  this.iAnimA = A(4); this.iAnimB = A(4, -1); this.iLook = A(4); this.iAim = A(4, -1);
  geo.setAttribute('iAnimA', this.iAnimA); geo.setAttribute('iAnimB', this.iAnimB); geo.setAttribute('iLook', this.iLook); geo.setAttribute('iAim', this.iAim);
  this.mesh = new THREE.InstancedMesh(geo, makeNaveMaterial(shared, {side: lod === 2 || K.clase === 'aereo' ? THREE.DoubleSide : THREE.FrontSide}), cap);
  this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.mesh.count = 0; this.mesh.frustumCulled = false;
  Object.assign(this, {shared, kind, rig: t.rig, era: t.era, cap, tris: t.lod[lod].tris, lod, dom: K.dom, info: t});
}
// add(x, y, z, rumbo, escala, nación (tag), clip, {phase | start, bright, aim: [rumbo, elev, rumboAA, elevAA], spin (rad/s), pitch, roll, quat}) → índice
NaveBatch.prototype.add = function (x, y, z, yaw, scale, nation, clip, o) {
  o = o || {}; const i = this.mesh.count; if (i >= this.cap) return -1; this.mesh.count++;
  this.setTransform(i, x, y, z, yaw, scale, o);
  this.setClip(i, clip, o.start != null ? o.start : o.phase != null ? o.phase : Math.random(), false);
  const row = this.shared.palRow(nation, this.era, this.dom), br = o.bright != null ? o.bright : Math.random(), cell = o.flag === false ? -1 : this.shared.flagCell(nation);
  this.iLook.setXYZW(i, row + 0.02 + br * 0.96 * 0.999, cell + 1, Math.random() * 6.28, o.spin != null ? o.spin : (this.dom === 'aire' ? 140 : 0));
  const a = o.aim || [0, -1, 0, -1]; this.iAim.setXYZW(i, a[0], a[1], a[2], a[3]);
  this.iLook.needsUpdate = this.iAim.needsUpdate = true; return i;
};
NaveBatch.prototype.setTransform = function (i, x, y, z, yaw, scale, o) {
  o = o || {}; if (o.quat) _qq.copy(o.quat); else { _eu.set(o.pitch || 0, yaw, o.roll || 0, 'YXZ'); _qq.setFromEuler(_eu); }
  _pp.set(x, y, z); _ss.set(scale, scale, scale); _m4.compose(_pp, _qq, _ss); this.mesh.setMatrixAt(i, _m4); this.mesh.instanceMatrix.needsUpdate = true;
};
// setAim(i, rumbo, elevación, rumboAA, elevaciónAA): radianes en el sistema del casco (0 = a proa, positivo hacia babor); elevación < −0,5 = reposo
NaveBatch.prototype.setAim = function (i, y, e, ya, ea) { this.iAim.setXYZW(i, y, e, ya != null ? ya : y, ea != null ? ea : e); this.iAim.needsUpdate = true; };
NaveBatch.prototype.setSpin = function (i, radPerSec) { this.iLook.setW(i, radPerSec); this.iLook.needsUpdate = true; };
NaveBatch.prototype.setClip = function (i, clip, phaseOrStart, blend) {
  const ci = this.shared.clipInfo(this.rig, clip); if (!ci) return false; const now = this.shared.U.uTime.value;
  if (blend) this.iAnimB.setXYZW(i, this.iAnimA.getX(i), this.iAnimA.getY(i), this.iAnimA.getZ(i), now); else this.iAnimB.setXYZW(i, -1, 0, 1, 0);
  this.iAnimA.setXYZW(i, ci.row, ci.loop ? ci.frames : -ci.frames, ci.dur, ci.loop ? (phaseOrStart || 0) : (phaseOrStart != null ? phaseOrStart : now));
  this.iAnimA.needsUpdate = this.iAnimB.needsUpdate = true; return true;
};
NaveBatch.prototype.clear = function () { this.mesh.count = 0; };
NaveBatch.prototype.dispose = function () { this.mesh.geometry.dispose(); this.mesh.material.dispose(); };
// NaveLodSet(shared, tipo, época, nación, capacidades, {dist}): mismo patrón que TroopLodSet. add(dist, x, y, z, rumbo, escala, tag, clip, opciones) → [nivel, índice]
function NaveLodSet(shared, kind, era, nation, caps, opts) {
  opts = opts || {}; caps = Array.isArray(caps) ? caps : [caps, caps, caps]; const K = NAVE_KINDS[kind];
  this.dist = opts.dist || (K.clase === 'aereo' ? [60, 220] : [120, 500]); this.batches = [0, 1, 2].map(l => new NaveBatch(shared, kind, era, nation, caps[l], {lod: l})); this.meshes = this.batches.map(b => b.mesh);
}
NaveLodSet.prototype.begin = function () { for (let l = 0; l < 3; l++) this.batches[l].mesh.count = 0; };
NaveLodSet.prototype.levelFor = function (d) { return d < this.dist[0] ? 0 : d < this.dist[1] ? 1 : 2; };
NaveLodSet.prototype.add = function (d, x, y, z, yaw, scale, tag, clip, o) { const l = this.levelFor(d); return [l, this.batches[l].add(x, y, z, yaw, scale, tag, clip, o)]; };
NaveLodSet.prototype.setClip = function (lvIdx, clip, ph, blend) { return this.batches[lvIdx[0]].setClip(lvIdx[1], clip, ph, blend); };
NaveLodSet.prototype.setAim = function (lvIdx, y, e, ya, ea) { this.batches[lvIdx[0]].setAim(lvIdx[1], y, e, ya, ea); };

/* ---------- utilidades de clips ---------- */
function clipInfo(kind, clip) { const K = NAVE_KINDS[kind] || {rig: kind}, c = (CLIPS[K.rig] || {})[clip]; return c ? {dur: c.dur, loop: c.loop !== false, ev: c.ev || []} : null; }
function clipPhase(kind, clip, time, phaseOrStart) { const c = clipInfo(kind, clip); if (!c) return 0; if (!c.loop) return Math.min(1, Math.max(0, (time - phaseOrStart) / c.dur)); const x = time / c.dur + phaseOrStart; return x - Math.floor(x); }
// eventsBetween(tipo, clip, fase0, fase1, cb(nombre, t)): eventos cruzados entre dos fases (con vuelta del bucle) para disparar partículas y sonidos
function eventsBetween(kind, clip, ph0, ph1, cb) {
  const c = clipInfo(kind, clip); if (!c) return; const ev = c.ev; if (ph1 >= ph0) { for (const e of ev) if (e[0] > ph0 && e[0] <= ph1) cb(e[1], e[0]); }
  else { for (const e of ev) if (e[0] > ph0 || e[0] <= ph1) cb(e[1], e[0]); }
}
function exportClipsJSON(space) { return JSON.stringify({version: 1, fps: {bucle: 12, sinBucle: 16}, convenciones: 'pistas [t, rx, ry, rz] en grados; root/pos [t, x, y, z] en metros; param [t, tren, retroceso, compuertas]; param2 [t, retroceso AA]; eventos [t, nombre]', partes: RIGS, clips: CLIPS}, null, space); }
function naveStats() {
  const out = []; Object.keys(NAVE_KINDS).forEach(k => ['GBR', 'GER', 'JPN'].forEach(n => { const t = buildNave(k, '2', {nation: n}); out.push({tipo: k, nacion: n, modelo: t.modelo, lod0: t.lod[0].tris, lod1: t.lod[1].tris, lod2: t.lod[2].tris, limite: NAVE_KINDS[k].lim, clips: t.clips.length}); })); return out;
}

root.naves3d = {NAVE_KINDS, NAVE_ERAS, NAVE_MAP, NAVES_NAC, buildNave, poseNave, blendPose, navePalette, naveGeoKey, naveModel, NaveShared, NaveBatch, NaveLodSet, naveStats, clipInfo, clipPhase, eventsBetween, exportClipsJSON, bakeClips, RIGS, CLIPS, CLIP_SETS, K, Z};
})(typeof window !== 'undefined' ? window : globalThis);
