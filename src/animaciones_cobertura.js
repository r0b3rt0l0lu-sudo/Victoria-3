/* ===== animaciones_cobertura.js — clips de cobertura para el rig rígido «soldado» de troops3d.js (three.js r152) =====
   Mismo formato que CLIPS.soldado de troops3d: {dur (s), loop, tracks: {parte: [[t, rx, ry, rz]…] (grados, Euler XYZ), armaP/armaR (arma respecto
   al torso, m y grados), agarre: [[t, y mano derecha, y mano izquierda]] (−1 = mano libre)}, ev: [[t, nombre]], root: [[t, x, y, z]] (m), hide}.
   Clips (fusil de avancarga «_A» y de cerrojo «_D» cuando el arma cambia el gesto):
     pegarse_pared · asomar_esquina_izq · asomar_esquina_der · esquina_izq_disparar_A/_D · esquina_der_disparar_A/_D
     agachado_muro_bajo · asomar_sobre_muro_apuntar · muro_disparar_A/_D · tras_arbol · tras_roca
     ventana_apuntar · ventana_disparar_A/_D · tumbarse · tumbado_apuntar · tumbado_recargar_A · tumbado_recargar_D
     arrastrarse · levantarse · trepar_muro · herido_arrastrado
   Biomecánica: la raíz de cada clip se asienta con cinemática directa (el punto de apoyo más bajo toca el suelo en cada instante;
   en trepar_muro el suelo incluye el muro de 1,1 m), el peso pasa a la pierna de apoyo antes de cada paso, el retroceso empuja hombro,
   torso y cabeza, y en los clips de cobertura con avancarga el soldado se expone para apuntar y disparar y se cubre para cargar
   (como los tiradores que rotaban en las aspilleras). Eventos: disparo, cargas (morder_cartucho, cebar, polvora, baqueta, baqueta_fuera,
   al_hombro, apuntar; cerrojo_atras, cerrojo_adelante), apoyo_iz/apoyo_de, paso, asomado, mirar_*, rodilla, manos, cuerpo_a_tierra, empuje.
   Transiciones: TRANSICIONES (grafo de posturas con tiempos de mezcla) y rutaTransicion(desde, hasta) → cadena de clips.
   API: CLIPS_COB · META · TRANSICIONES · rutaTransicion · registrar(Troops3D, op) · exportClipsJSON(espacio) · poseFK(clip, t)
        pruebaAnimaciones(Troops3D?) · demoAnimaciones(cont) */
(function (root) {
'use strict';
const THREE = root.THREE;
const D2R = Math.PI / 180;
// esqueleto «soldado» de troops3d (nombre, padre, desplazamiento en m)
const RIG = [['pelvis', -1, [0, 0.90, 0]], ['torso', 0, [0, 0.06, 0]], ['cabeza', 1, [0, 0.50, 0]], ['brazoIz', 1, [0.205, 0.435, 0]], ['antebrazoIz', 3, [0, -0.29, 0]], ['brazoDe', 1, [-0.205, 0.435, 0]], ['antebrazoDe', 5, [0, -0.29, 0]],
  ['musloIz', 0, [0.095, -0.05, 0]], ['piernaIz', 7, [0, -0.42, 0]], ['musloDe', 0, [-0.095, -0.05, 0]], ['piernaDe', 9, [0, -0.42, 0]], ['arma', 6, [0, -0.27, 0.02]], ['pieIz', 8, [0, -0.35, 0]], ['pieDe', 10, [0, -0.35, 0]]];
const IX = {}; RIG.forEach((p, i) => { IX[p[0]] = i; });

/* ---------- posturas y posiciones del arma (las de troops3d más algunas nuevas) ---------- */
const A = {
  APUNTA: {P: [-0.15, 0.38, 0.06], R: [90, 3, 0], g: [0.32, 0.82]}, LISTO: {P: [-0.12, -0.02, 0.24], R: [52, 0, -6], g: [0.42, 0.74]},
  PORTA: {P: [-0.04, 0.04, 0.2], R: [8, 0, -30], g: [0.3, 0.72]}, ORDEN: {P: [-0.27, -0.95, 0.1], R: [0, 0, 0], g: [0.92, -1]},
  CARGA: {P: [0.02, -0.95, 0.34], R: [10, 0, 0], g: [-1, 0.95]}, CARGA_RODILLA: {P: [0.02, -0.55, 0.36], R: [12, 0, 0], g: [-1, 0.75]},
  APUNTA_T: {P: [-0.12, 0.38, -0.05], R: [20, 0, 0], g: [0.3, 0.75]}, ESPALDA: {P: [0.05, 0.12, -0.17], R: [0, 0, 28], g: [-1, -1]},
  ARRASTRE: {P: [-0.22, 0.25, 0.05], R: [20, 0, -8], g: [0.35, -1]}, RODANDO: {P: [-0.02, -0.15, 0.22], R: [25, 0, -4], g: [-1, 0.6]}};
const PIE = {musloIz: [-4, 0, 2], musloDe: [2, 0, -2], piernaIz: [0, 0, 0], piernaDe: [0, 0, 0], pieIz: [0, 0, 0], pieDe: [0, 0, 0], pelvis: [0, 0, 0], torso: [0, 0, 0], cabeza: [0, 0, 0]};
const TIRADOR = {musloIz: [-16, 0, 4], musloDe: [6, 0, -4], piernaIz: [6, 0, 0], piernaDe: [2, 0, 0], torso: [4, -14, 0], cabeza: [10, -4, 4], pelvis: [0, 0, 0]};
const RODILLA = {pieDe: [72, 0, 0], musloIz: [-85, 0, 4], piernaIz: [85, 0, 0], musloDe: [-8, 0, -4], piernaDe: [95, 0, 0], pelvis: [0, 0, 0]};
const SEMI = {musloIz: [-34, 0, 6], piernaIz: [38, 0, 0], musloDe: [-14, 0, -6], piernaDe: [30, 0, 0], pieIz: [-8, 0, 0], pieDe: [-6, 0, 0], torso: [10, -14, 0], cabeza: [8, -4, 4], pelvis: [0, 0, 0]};
const BOCA_ABAJO = {pieIz: [78, 0, 10], pieDe: [78, 0, -10], pelvis: [88, 0, 0], torso: [-18, 0, 0], cabeza: [-58, 0, 0], musloIz: [0, 0, 8], musloDe: [0, 0, -8], piernaIz: [12, 0, 0], piernaDe: [8, 0, 0]};
const ROOT_T = [0, -0.76, 0.45];

/* ---------- utilidades para escribir clips ---------- */
// pose(t, {parte: [rx,ry,rz]}) → añade claves a las pistas
function Clip(dur, loop, extra) { this.c = Object.assign({dur, loop, tracks: {}, ev: []}, extra || {}); }
Clip.prototype.k = function (t, pose) { Object.entries(pose).forEach(([p, v]) => { const tr = this.c.tracks[p] = this.c.tracks[p] || []; tr.push([t].concat(v)); }); return this; };
Clip.prototype.arma = function (t, a, agarre) { const T = this.c.tracks; (T.armaP = T.armaP || []).push([t].concat(a.P)); (T.armaR = T.armaR || []).push([t].concat(a.R)); if (agarre !== false) (T.agarre = T.agarre || []).push([t].concat(agarre || a.g)); return this; };
Clip.prototype.raiz = function (t, x, y, z) { (this.c.root = this.c.root || []).push([t, x, y, z]); return this; };
Clip.prototype.e = function (t, n) { this.c.ev.push([t, n]); return this; };
Clip.prototype.fin = function () { const c = this.c; Object.values(c.tracks).forEach(tr => tr.sort((a, b) => a[0] - b[0])); if (c.root) c.root.sort((a, b) => a[0] - b[0]); c.ev.sort((a, b) => a[0] - b[0]);
  // pistas con una sola clave y sin bucle: se completan para que la interpolación sea estable
  return c; };
const mezclaPose = (a, b, k) => { const o = {}; new Set([...Object.keys(a), ...Object.keys(b)]).forEach(p => { const x = a[p] || [0, 0, 0], y = b[p] || [0, 0, 0]; o[p] = x.map((v, i) => v + (y[i] - v) * k); }); return o; };
const suma = (a, b) => { const o = Object.assign({}, a); Object.entries(b).forEach(([p, v]) => { const x = o[p] || [0, 0, 0]; o[p] = x.map((q, i) => q + v[i]); }); return o; };

/* ---------- ciclos de arma (mismos tiempos relativos que disparar_A / disparar_D de troops3d) ---------- */
// cicloA: aplica el ciclo de avancarga en [t0, t1] y devuelve los instantes de exposición: {exp: [[a,b],…], cub: [a,b]}
function cicloA(C, t0, t1, op) {
  op = op || {}; const L = t1 - t0, T = f => t0 + f * L, ap = op.apunta || A.APUNTA, carga = op.carga || A.CARGA, li = A.LISTO;
  C.arma(T(0), ap).arma(T(0.10), ap).arma(T(0.115), {P: [ap.P[0], ap.P[1] + 0.02, ap.P[2] - 0.07], R: [ap.R[0] - 6, ap.R[1], ap.R[2]], g: ap.g}).arma(T(0.14), ap)
   .arma(T(0.2), li).arma(T(0.36), li, [-1, 0.74]).arma(T(0.42), carga).arma(T(0.78), carga).arma(T(0.84), li).arma(T(0.92), ap).arma(T(1), ap);
  const tr = C.c.tracks; tr.agarre = tr.agarre.filter(k => k[0] < T(0.2) - 1e-6 || k[0] > T(0.84) + 1e-6); tr.agarre.push([T(0.2), 0.42, 0.74], [T(0.24), -1, 0.74], [T(0.31), 0.47, 0.74], [T(0.4), -1, 0.95], [T(0.8), 0.35, 0.8]);
  const bd = [[0, -40, 0, -10], [0.24, -40, 0, -10], [0.27, -70, 0, -30], [0.3, -70, 0, -30], [0.4, -40, 0, -10], [0.44, -90, 0, -10], [0.5, -168, 0, -10], [0.54, -120, 0, -8], [0.58, -150, 0, -8], [0.62, -118, 0, -8], [0.66, -150, 0, -8], [0.72, -168, 0, -10], [0.78, -60, 0, -10], [0.84, -40, 0, -10], [1, -40, 0, -10]];
  const ad = [[0, -30, 0, 0], [0.24, -30, 0, 0], [0.27, -125, 0, 0], [0.3, -125, 0, 0], [0.4, -40, 0, 0], [0.44, -30, 0, 0], [0.5, -10, 0, 0], [0.54, -20, 0, 0], [0.58, -10, 0, 0], [0.62, -20, 0, 0], [0.66, -10, 0, 0], [0.72, -10, 0, 0], [0.78, -30, 0, 0], [1, -30, 0, 0]];
  if (op.brazos !== false) { bd.forEach(k => C.k(T(k[0]), {brazoDe: k.slice(1)})); ad.forEach(k => C.k(T(k[0]), {antebrazoDe: k.slice(1)})); }
  [[0.10, 'disparo'], [0.27, 'morder_cartucho'], [0.31, 'cebar'], [0.44, 'polvora'], [0.58, 'baqueta'], [0.72, 'baqueta_fuera'], [0.84, 'al_hombro'], [0.92, 'apuntar']].forEach(([f, n]) => C.e(T(f), n));
  return {exp: [[T(0), T(0.14)], [T(0.92), T(1)]], cub: [T(0.2), T(0.84)]};
}
function cicloD(C, t0, t1, op) {
  op = op || {}; const L = t1 - t0, T = f => t0 + f * L, ap = op.apunta || A.APUNTA;
  C.arma(T(0), ap).arma(T(0.22), ap).arma(T(0.25), {P: [ap.P[0], ap.P[1] + 0.02, ap.P[2] - 0.07], R: [ap.R[0] - 5, ap.R[1], ap.R[2]], g: ap.g}).arma(T(0.3), ap).arma(T(0.4), {P: ap.P, R: [ap.R[0] - 4, ap.R[1], ap.R[2] - 12], g: ap.g}).arma(T(0.6), {P: ap.P, R: [ap.R[0] - 4, ap.R[1], ap.R[2] - 12], g: ap.g}).arma(T(0.72), ap).arma(T(1), ap);
  const tr = C.c.tracks; tr.agarre = tr.agarre.filter(k => k[0] < T(0.3) || k[0] > T(0.72)); tr.agarre.push([T(0.36), 0.5, ap.g[1]], [T(0.62), ap.g[0], ap.g[1]]);
  [[0.22, 'disparo'], [0.4, 'cerrojo_atras'], [0.56, 'cerrojo_adelante'], [0.72, 'apuntar']].forEach(([f, n]) => C.e(T(f), n));
  return {exp: [[T(0), T(1)]], cub: null};
}
// postura del cuerpo según exposición: expuesto en las ventanas exp y cubierto en cub; transiciones de 0,06 del ciclo
function exposicion(C, w, poseExp, poseCub, rootExp, rootCub) {
  const claves = [];
  if (!w.cub) { [0, 1].forEach(t => claves.push([t, 1])); }
  else { claves.push([0, 1], [w.exp[0][1], 1], [w.cub[0], 0], [w.cub[1], 0], [w.exp[1][0], 1], [1, 1]); }
  claves.forEach(([t, e]) => { C.k(t, e ? poseExp : poseCub); C.raiz(t, ...(e ? rootExp : rootCub)); });
}

/* ===================================================================================== */
const CLIPS_COB = {}, META = {};
function def(nombre, clip, meta) { CLIPS_COB[nombre] = clip.fin(); META[nombre] = Object.assign({suelo: true}, meta); }

// 1) pegarse a la pared: espalda contra el muro (detrás, −z), fusil terciado; mira a un lado y a otro
{ const C = new Clip(4.0, true); const base = suma(PIE, {torso: [-3, 0, 0], pelvis: [0, 0, 0]});
  [0, 0.25, 0.4, 0.55, 0.65, 0.8, 1].forEach((t, i) => C.k(t, Object.assign({}, base, {cabeza: [[0, 0, 0], [2, 35, 0], [2, 38, 0], [0, 0, 0], [2, -35, 0], [2, -38, 0], [0, 0, 0]][i], torso: [[-3, 0, 0], [-2, 4, 0], [-2, 4, 0], [-3.5, 0, 0], [-2, -4, 0], [-2, -4, 0], [-3, 0, 0]][i]})));
  C.arma(0, A.PORTA).arma(1, A.PORTA); C.raiz(0, 0, 0, -0.04).raiz(1, 0, 0, -0.04); C.e(0.3, 'mirar_izq').e(0.72, 'mirar_der');
  def('pegarse_pared', C, {postura: ['pie', 'pie'], cobertura: 'pared', arma: '-'}); }

// 2) asomarse por una esquina: el muro queda al lado; el peso pasa a la pierna del lado, se inclina y apunta
function asomar(lado) {   // lado +1: izquierda (+x)
  const s = lado, C = new Clip(1.2, false);
  const pegado = suma(PIE, {torso: [-1, 0, 0]}), fuera = {musloIz: [-10, 0, s > 0 ? 14 : 2], musloDe: [4, 0, s > 0 ? -2 : -14], piernaIz: [s > 0 ? 18 : 4, 0, 0], piernaDe: [s > 0 ? 4 : 18, 0, 0], pieIz: [-6, 0, 0], pieDe: [-4, 0, 0],
    torso: [4, s > 0 ? -6 : -18, -15 * s], cabeza: [8, s > 0 ? 2 : -6, 10 * s], pelvis: [0, 0, -4 * s]};
  C.k(0, pegado).k(0.3, suma(pegado, {musloIz: [0, 0, s > 0 ? 6 : 0], musloDe: [0, 0, s > 0 ? 0 : -6], pelvis: [0, 0, -2 * s]})).k(0.65, fuera).k(1, fuera);
  C.raiz(0, 0, 0, 0).raiz(0.3, 0.04 * s, 0, 0).raiz(0.65, 0.2 * s, 0, 0.04).raiz(1, 0.2 * s, 0, 0.04);
  C.arma(0, A.PORTA).arma(0.4, A.LISTO).arma(0.7, A.APUNTA).arma(1, A.APUNTA);
  C.e(0.3, s > 0 ? 'apoyo_iz' : 'apoyo_de').e(0.7, 'asomado');
  return {C, fuera, pegado};
}
const AIZ = asomar(1), ADE = asomar(-1);
def('asomar_esquina_izq', AIZ.C, {postura: ['pie', 'pie'], cobertura: 'esquina', lado: 'izq', arma: '-'});
def('asomar_esquina_der', ADE.C, {postura: ['pie', 'pie'], cobertura: 'esquina', lado: 'der', arma: '-'});
['izq', 'der'].forEach(l => { const s = l === 'izq' ? 1 : -1, X = l === 'izq' ? AIZ : ADE;
  { const C = new Clip(9.0, true); const w = cicloA(C, 0, 1); exposicion(C, w, X.fuera, X.pegado, [0.2 * s, 0, 0.04], [0, 0, 0]); def(`esquina_${l}_disparar_A`, C, {postura: ['pie', 'pie'], cobertura: 'esquina', lado: l, arma: 'A'}); }
  { const C = new Clip(2.4, true); const w = cicloD(C, 0, 1); exposicion(C, w, X.fuera, X.pegado, [0.2 * s, 0, 0.04], [0, 0, 0]); def(`esquina_${l}_disparar_D`, C, {postura: ['pie', 'pie'], cobertura: 'esquina', lado: l, arma: 'D'}); } });

// 3) muro bajo (≈ 1,1 m): agachado detrás; se incorpora para apuntar por encima
const AGACH = suma(RODILLA, {torso: [14, 0, 0], cabeza: [-6, 0, 0]});
{ const C = new Clip(4.0, true); [0, 0.4, 0.5, 0.62, 0.7, 1].forEach((t, i) => C.k(t, suma(AGACH, {cabeza: [[0, 0, 0], [0, 0, 0], [-18, 10, 0], [-18, -12, 0], [0, 0, 0], [0, 0, 0]][i], torso: [[0, 0, 0], [0, 0, 0], [-6, 0, 0], [-6, 0, 0], [0, 0, 0], [0, 0, 0]][i]})));
  [0, 0.5, 0.62, 1].forEach((t, i) => C.raiz(t, 0, [0, 0.05, 0.05, 0][i], 0)); C.arma(0, A.PORTA).arma(1, A.PORTA); C.e(0.5, 'mirar');
  def('agachado_muro_bajo', C, {postura: ['rodilla', 'rodilla'], cobertura: 'muro_bajo', arma: '-'}); }
{ const C = new Clip(1.0, false); C.k(0, AGACH).k(0.35, mezclaPose(AGACH, SEMI, 0.45)).k(0.75, SEMI).k(1, SEMI); C.raiz(0, 0, 0, 0).raiz(0.75, 0, 0, 0.08).raiz(1, 0, 0, 0.08);
  C.arma(0, A.PORTA).arma(0.4, A.LISTO).arma(0.8, A.APUNTA).arma(1, A.APUNTA); C.e(0.3, 'apoyo_de').e(0.8, 'apuntando');
  def('asomar_sobre_muro_apuntar', C, {postura: ['rodilla', 'semi'], cobertura: 'muro_bajo', arma: '-'}); }
{ const C = new Clip(9.0, true); const w = cicloA(C, 0, 1, {carga: A.CARGA_RODILLA}); exposicion(C, w, SEMI, AGACH, [0, 0, 0.08], [0, 0, 0]); def('muro_disparar_A', C, {postura: ['semi', 'semi'], cobertura: 'muro_bajo', arma: 'A'}); }
{ const C = new Clip(2.4, true); const w = cicloD(C, 0, 1); exposicion(C, w, SEMI, AGACH, [0, 0, 0.08], [0, 0, 0]); C.k(0.45, suma(SEMI, {torso: [3, 0, 0]})); def('muro_disparar_D', C, {postura: ['semi', 'semi'], cobertura: 'muro_bajo', arma: 'D'}); }

// 4) tras un árbol (de pie) y tras una roca (de rodillas): espera y se asoma
{ const C = new Clip(5.0, true); const asom = suma(PIE, {torso: [2, -10, 12], cabeza: [4, -18, -8], musloDe: [0, 0, -8], piernaIz: [10, 0, 0], pelvis: [0, 0, 3]});
  C.k(0, PIE).k(0.3, PIE).k(0.42, asom).k(0.58, asom).k(0.7, PIE).k(1, PIE); C.raiz(0, 0, 0, 0).raiz(0.3, 0, 0, 0).raiz(0.42, -0.14, 0, 0).raiz(0.58, -0.14, 0, 0).raiz(0.7, 0, 0, 0).raiz(1, 0, 0, 0);
  C.arma(0, A.PORTA).arma(0.32, A.PORTA).arma(0.44, A.LISTO).arma(0.56, A.LISTO).arma(0.68, A.PORTA).arma(1, A.PORTA); C.e(0.33, 'apoyo_de').e(0.45, 'asomado');
  def('tras_arbol', C, {postura: ['pie', 'pie'], cobertura: 'arbol', arma: '-'}); }
{ const C = new Clip(5.0, true); const asom = suma(RODILLA, {musloIz: [12, 0, 0], piernaIz: [-14, 0, 0], torso: [-4, 0, 0], cabeza: [-10, 0, 0]});
  C.k(0, AGACH).k(0.35, AGACH).k(0.48, asom).k(0.62, asom).k(0.75, AGACH).k(1, AGACH); [0, 0.35, 0.48, 0.62, 0.75, 1].forEach((t, i) => C.raiz(t, 0, [0, 0, 0.12, 0.12, 0, 0][i], 0));
  C.arma(0, A.PORTA).arma(1, A.PORTA); C.e(0.5, 'asomado'); def('tras_roca', C, {postura: ['rodilla', 'rodilla'], cobertura: 'roca', arma: '-'}); }

// 5) ventana: apunta con balanceo; dispara y se aparta junto al vano para cargar
{ const C = new Clip(3.0, true); [0, 0.25, 0.5, 0.75, 1].forEach((t, i) => C.k(t, suma(TIRADOR, {torso: [[0, 0, 0], [1, 2, 0], [0, 0, 0], [1, -2, 0], [0, 0, 0]][i]})));
  C.raiz(0, 0, 0, 0.1).raiz(1, 0, 0, 0.1); C.arma(0, A.APUNTA).arma(1, A.APUNTA); def('ventana_apuntar', C, {postura: ['pie', 'pie'], cobertura: 'ventana', arma: '-'}); }
{ const C = new Clip(9.0, true); const w = cicloA(C, 0, 1); const apartado = suma(PIE, {torso: [6, 30, 0], cabeza: [6, 20, 0]}); exposicion(C, w, TIRADOR, apartado, [0, 0, 0.1], [0.45, 0, -0.05]);
  C.e(0.17, 'apoyo_iz').e(0.87, 'apoyo_de'); def('ventana_disparar_A', C, {postura: ['pie', 'pie'], cobertura: 'ventana', arma: 'A'}); }
{ const C = new Clip(2.4, true); const w = cicloD(C, 0, 1); exposicion(C, w, TIRADOR, TIRADOR, [0, 0, 0.1], [0, 0, 0.1]); def('ventana_disparar_D', C, {postura: ['pie', 'pie'], cobertura: 'ventana', arma: 'D'}); }

// 6) cuerpo a tierra y tumbado
{ const C = new Clip(1.3, false); const manos = {pelvis: [35, 0, 0], torso: [40, 0, 0], cabeza: [-30, 0, 0], musloIz: [-80, 0, 6], piernaIz: [80, 0, 0], musloDe: [-30, 0, -6], piernaDe: [60, 0, 0], brazoIz: [-70, 0, 8], antebrazoIz: [-20, 0, 0], pieIz: [20, 0, 0], pieDe: [40, 0, 0]};
  C.k(0, PIE).k(0.35, suma(RODILLA, {torso: [20, 0, 0]})).k(0.62, manos).k(1, BOCA_ABAJO); C.raiz(0, 0, 0, 0).raiz(0.35, 0, -0.36, 0.05).raiz(0.62, 0, -0.45, 0.25).raiz(1, ...ROOT_T);
  C.arma(0, A.PORTA).arma(0.35, A.LISTO).arma(0.62, {P: [-0.1, -0.1, 0.3], R: [60, 0, 0], g: [0.3, -1]}).arma(1, A.APUNTA_T); C.e(0.35, 'rodilla').e(0.62, 'manos').e(0.95, 'cuerpo_a_tierra');
  def('tumbarse', C, {postura: ['pie', 'tumbado'], arma: '-'}); }
{ const C = new Clip(3.0, true); [0, 0.5, 1].forEach((t, i) => C.k(t, suma(BOCA_ABAJO, {torso: [[0, 0, 0], [1, 1.5, 0], [0, 0, 0]][i], cabeza: [[0, 0, 0], [1, 1, 0], [0, 0, 0]][i]}))); C.raiz(0, ...ROOT_T).raiz(1, ...ROOT_T); C.arma(0, A.APUNTA_T).arma(1, A.APUNTA_T);
  def('tumbado_apuntar', C, {postura: ['tumbado', 'tumbado'], arma: '-'}); }
{ // avancarga tumbado: dispara, rueda de costado para poder cargar por la boca, vuelve a apuntar
  const C = new Clip(12.0, true); const costado = suma(BOCA_ABAJO, {pelvis: [-20, 0, 0], torso: [-30, 0, -35], cabeza: [20, 0, 25], musloIz: [-35, 0, 0], piernaIz: [60, 0, 0], musloDe: [-10, 0, 0], piernaDe: [30, 0, 0]});
  C.k(0, BOCA_ABAJO).k(0.12, BOCA_ABAJO).k(0.2, costado).k(0.82, costado).k(0.9, BOCA_ABAJO).k(1, BOCA_ABAJO); C.raiz(0, ...ROOT_T).raiz(0.12, ...ROOT_T).raiz(0.2, -0.1, -0.68, 0.35).raiz(0.82, -0.1, -0.68, 0.35).raiz(0.9, ...ROOT_T).raiz(1, ...ROOT_T);
  const ap = A.APUNTA_T; C.arma(0, ap).arma(0.06, ap).arma(0.075, {P: [ap.P[0], ap.P[1] + 0.02, ap.P[2] - 0.06], R: ap.R, g: ap.g}).arma(0.1, ap).arma(0.2, A.RODANDO).arma(0.82, A.RODANDO).arma(0.9, ap).arma(1, ap);
  [[0.25, -70, 0, -30], [0.3, -70, 0, -30], [0.42, -120, 0, -10], [0.5, -160, 0, -10], [0.56, -120, 0, -10], [0.62, -160, 0, -10], [0.7, -60, 0, -10]].forEach(k => C.k(k[0], {brazoDe: k.slice(1)}));
  C.c.tracks.agarre = [[0, 0.3, 0.75], [0.2, -1, 0.6], [0.75, -1, 0.6], [0.86, 0.3, 0.75]];
  [[0.06, 'disparo'], [0.2, 'rodar'], [0.27, 'morder_cartucho'], [0.33, 'cebar'], [0.42, 'polvora'], [0.5, 'baqueta'], [0.66, 'baqueta_fuera'], [0.9, 'apuntar']].forEach(([t, n]) => C.e(t, n));
  def('tumbado_recargar_A', C, {postura: ['tumbado', 'tumbado'], arma: 'A'}); }
{ const C = new Clip(2.4, true); C.k(0, BOCA_ABAJO).k(1, BOCA_ABAJO); C.raiz(0, ...ROOT_T).raiz(1, ...ROOT_T); cicloD(C, 0, 1, {apunta: A.APUNTA_T}); C.k(0.24, {cabeza: [-54, 0, 0]}).k(0.3, {cabeza: [-58, 0, 0]});
  def('tumbado_recargar_D', C, {postura: ['tumbado', 'tumbado'], arma: 'D'}); }

// 7) arrastrarse (arrastre militar): brazo y pierna contrarios; el juego avanza 0,45 m por ciclo
{ const C = new Clip(1.6, true); const base = suma(BOCA_ABAJO, {torso: [-10, 0, 0], cabeza: [-20, 0, 0]});
  const fase = s => ({brazoIz: s ? [-150, 0, 20] : [-95, 0, 35], antebrazoIz: s ? [-40, 0, 0] : [-110, 0, 0], musloDe: s ? [-45, 0, -30] : [0, 0, -10], piernaDe: s ? [95, 0, 0] : [10, 0, 0], musloIz: s ? [0, 0, 10] : [-45, 0, 30], piernaIz: s ? [10, 0, 0] : [95, 0, 0], torso: [-10, 0, s ? -6 : 6], pelvis: [88, 0, s ? 4 : -4]});
  C.k(0, Object.assign({}, base, fase(1))).k(0.5, Object.assign({}, base, fase(0))).k(1, Object.assign({}, base, fase(1)));
  C.raiz(0, ...ROOT_T).raiz(1, ...ROOT_T); C.arma(0, A.ARRASTRE).arma(1, A.ARRASTRE); C.e(0, 'apoyo_iz').e(0.5, 'apoyo_de');
  def('arrastrarse', C, {postura: ['tumbado', 'tumbado'], arma: '-', avance: 0.45}); }

// 8) levantarse desde tumbado
{ const C = new Clip(1.4, false); const flex = {pelvis: [60, 0, 0], torso: [10, 0, 0], cabeza: [-40, 0, 0], brazoIz: [-60, 0, 10], antebrazoIz: [-10, 0, 0], musloIz: [-60, 0, 6], piernaIz: [100, 0, 0], musloDe: [-10, 0, -6], piernaDe: [30, 0, 0], pieIz: [30, 0, 0], pieDe: [70, 0, 0]};
  C.k(0, BOCA_ABAJO).k(0.3, suma(BOCA_ABAJO, {torso: [25, 0, 0], brazoIz: [-80, 0, 10]})).k(0.6, flex).k(0.8, suma(RODILLA, {torso: [12, 0, 0], brazoIz: [-20, 0, 8], antebrazoIz: [-10, 0, 0]})).k(1, Object.assign({}, PIE, {brazoIz: [0, 0, 5], antebrazoIz: [-8, 0, 0]}));
  C.raiz(0, ...ROOT_T).raiz(0.3, 0, -0.66, 0.4).raiz(0.6, 0, -0.5, 0.2).raiz(0.8, 0, -0.36, 0.05).raiz(1, 0, 0, 0);
  C.arma(0, A.APUNTA_T).arma(0.3, {P: [-0.18, 0.1, 0.1], R: [40, 0, 0], g: [0.3, -1]}).arma(0.8, A.LISTO).arma(1, A.LISTO); C.e(0.3, 'manos').e(0.6, 'rodilla').e(0.95, 'apoyo_de');
  def('levantarse', C, {postura: ['tumbado', 'pie'], arma: '-'}); }

// 9) trepar un muro de 1,1 m: manos arriba, pie al borde, sube, pasa y baja al otro lado (avance total 1,6 m)
{ const C = new Clip(2.2, false); const manos = suma(PIE, {torso: [35, 0, 0], brazoIz: [-75, 0, 10], brazoDe: [-75, 0, -10], antebrazoIz: [-20, 0, 0], antebrazoDe: [-20, 0, 0]});
  const pieArriba = Object.assign({}, manos, {musloDe: [-105, 0, -6], piernaDe: [120, 0, 0], pieDe: [-10, 0, 0], torso: [45, 0, 0]});
  const encima = {musloIz: [-60, 0, 6], piernaIz: [90, 0, 0], musloDe: [-20, 0, -6], piernaDe: [30, 0, 0], torso: [25, 0, 0], brazoIz: [-40, 0, 20], brazoDe: [-40, 0, -20], antebrazoIz: [-20, 0, 0], antebrazoDe: [-20, 0, 0], cabeza: [-10, 0, 0]};
  const baja = {musloIz: [-50, 0, 4], piernaIz: [70, 0, 0], musloDe: [-30, 0, -4], piernaDe: [60, 0, 0], torso: [18, 0, 0], brazoIz: [-30, 0, 30], brazoDe: [-30, 0, -30], cabeza: [-6, 0, 0]};
  C.k(0, PIE).k(0.22, manos).k(0.42, pieArriba).k(0.62, encima).k(0.82, baja).k(1, PIE);
  C.raiz(0, 0, 0, 0).raiz(0.22, 0, 0, 0.2).raiz(0.42, 0, 0.35, 0.45).raiz(0.62, 0, 1.0, 0.8).raiz(0.82, 0, 0.1, 1.35).raiz(1, 0, 0, 1.6);
  C.arma(0, A.ESPALDA).arma(1, A.ESPALDA); C.e(0.22, 'manos').e(0.42, 'apoyo_de').e(0.62, 'encima').e(0.82, 'apoyo_iz').e(0.95, 'apoyo_de');
  def('trepar_muro', C, {postura: ['pie', 'pie'], cobertura: 'muro_bajo', arma: '-', desplazamiento: [0, 0, 1.6], muro: {z0: 0.6, z1: 1.05, alto: 1.1}}); }

// 10) herido que se arrastra de espaldas, apoyado en los codos y empujando con una pierna
{ const C = new Clip(2.2, true); const base = {pelvis: [-82, 0, 0], torso: [45, 0, 0], cabeza: [25, 0, 0], brazoIz: [55, 0, 18], antebrazoIz: [-100, 0, 0], brazoDe: [55, 0, -18], antebrazoDe: [-100, 0, 0], musloIz: [0, 0, 6], piernaIz: [6, 0, 0], pieIz: [-60, 0, 0], pieDe: [-50, 0, 0]};
  C.k(0, Object.assign({}, base, {musloDe: [-55, 0, -8], piernaDe: [100, 0, 0], torso: [42, 0, 0]})).k(0.5, Object.assign({}, base, {musloDe: [-12, 0, -8], piernaDe: [25, 0, 0], torso: [50, 0, 0], brazoIz: [70, 0, 18], brazoDe: [70, 0, -18], antebrazoIz: [-80, 0, 0], antebrazoDe: [-80, 0, 0]})).k(1, Object.assign({}, base, {musloDe: [-55, 0, -8], piernaDe: [100, 0, 0], torso: [42, 0, 0]}));
  C.raiz(0, 0, -0.62, -0.3).raiz(1, 0, -0.62, -0.3); C.c.hide = {arma: [[0, 0]]}; C.e(0.05, 'apoyo_de').e(0.5, 'empuje');
  def('herido_arrastrado', C, {postura: ['boca_arriba', 'boca_arriba'], arma: '-', avance: -0.3}); }

/* ---------- transiciones ---------- */
const TRANSICIONES = {
  pie: {pegarse_pared: 0.3, asomar_esquina_izq: 0.2, asomar_esquina_der: 0.2, agachado_muro_bajo: 0.4, tras_arbol: 0.3, tras_roca: 0.45, ventana_apuntar: 0.3, ventana_disparar_A: 0.3, ventana_disparar_D: 0.3, tumbarse: 0.15, trepar_muro: 0.2, herido_arrastrado: 0.5},
  pegarse_pared: {asomar_esquina_izq: 0.2, asomar_esquina_der: 0.2, pie: 0.3},
  asomar_esquina_izq: {esquina_izq_disparar_A: 0.15, esquina_izq_disparar_D: 0.15, pegarse_pared: 0.3}, asomar_esquina_der: {esquina_der_disparar_A: 0.15, esquina_der_disparar_D: 0.15, pegarse_pared: 0.3},
  esquina_izq_disparar_A: {pegarse_pared: 0.3}, esquina_izq_disparar_D: {pegarse_pared: 0.3}, esquina_der_disparar_A: {pegarse_pared: 0.3}, esquina_der_disparar_D: {pegarse_pared: 0.3},
  agachado_muro_bajo: {asomar_sobre_muro_apuntar: 0.15, trepar_muro: 0.35, pie: 0.4, tumbarse: 0.3}, asomar_sobre_muro_apuntar: {muro_disparar_A: 0.15, muro_disparar_D: 0.15, agachado_muro_bajo: 0.3},
  muro_disparar_A: {agachado_muro_bajo: 0.3}, muro_disparar_D: {agachado_muro_bajo: 0.3},
  tras_arbol: {pie: 0.3}, tras_roca: {pie: 0.45, tumbarse: 0.3}, ventana_apuntar: {ventana_disparar_A: 0.2, ventana_disparar_D: 0.2, pie: 0.3}, ventana_disparar_A: {ventana_apuntar: 0.2, pie: 0.3}, ventana_disparar_D: {ventana_apuntar: 0.2, pie: 0.3},
  tumbarse: {tumbado_apuntar: 0.15}, tumbado_apuntar: {tumbado_recargar_A: 0.2, tumbado_recargar_D: 0.2, arrastrarse: 0.25, levantarse: 0.15}, tumbado_recargar_A: {tumbado_apuntar: 0.2}, tumbado_recargar_D: {tumbado_apuntar: 0.2},
  arrastrarse: {tumbado_apuntar: 0.25, levantarse: 0.2}, levantarse: {pie: 0.15}, trepar_muro: {pie: 0.15}, herido_arrastrado: {}};
function rutaTransicion(desde, hasta) { const cola = [[desde]], vist = new Set([desde]); while (cola.length) { const r = cola.shift(), u = r[r.length - 1]; if (u === hasta) return r.slice(1).map((c, i) => ({clip: c, mezcla: TRANSICIONES[r[i]][c]}));
  Object.keys(TRANSICIONES[u] || {}).forEach(v => { if (!vist.has(v)) { vist.add(v); cola.push(r.concat([v])); } }); } return null; }

/* ---------- cinemática directa propia (mismo muestreo que troops3d: Hermite con tangentes monótonas) ---------- */
let _loop = false;
function slope(tr, k, i, loop) { const N = tr.length, v = tr[k][i + 1], D = loop ? tr[N - 1][i + 1] - tr[0][i + 1] : 0; let p = k - 1, q = k + 1, tp, tq, vp, vq;
  if (p < 0) { if (!loop) return 0; p = N - 2; tp = tr[p][0] - 1; vp = tr[p][i + 1] - D; } else { tp = tr[p][0]; vp = tr[p][i + 1]; }
  if (q >= N) { if (!loop) return 0; q = 1; tq = tr[q][0] + 1; vq = tr[q][i + 1] + D; } else { tq = tr[q][0]; vq = tr[q][i + 1]; }
  const h0 = tr[k][0] - tp, h1 = tq - tr[k][0]; if (h0 <= 1e-6 || h1 <= 1e-6) return 0; const d0 = (v - vp) / h0, d1 = (vq - v) / h1; if (d0 * d1 <= 0) return 0; const w1 = 2 * h1 + h0, w2 = h1 + 2 * h0; return (w1 + w2) / (w1 / d0 + w2 / d1); }
function muestra(tr, t, out, n) { if (!tr || !tr.length) { for (let i = 0; i < n; i++) out[i] = 0; return out; } if (tr.length === 1 || t <= tr[0][0]) { for (let i = 0; i < n; i++) out[i] = tr[0][i + 1]; return out; }
  const N = tr.length, loop = _loop && tr[0][0] <= 1e-6 && tr[N - 1][0] >= 1 - 1e-6;
  for (let k = 0; k < N - 1; k++) { const a = tr[k], b = tr[k + 1]; if (t <= b[0]) { const h = Math.max(1e-6, b[0] - a[0]), u = (t - a[0]) / h, u2 = u * u, u3 = u2 * u, h00 = 2 * u3 - 3 * u2 + 1, h10 = u3 - 2 * u2 + u, h01 = -2 * u3 + 3 * u2, h11 = u3 - u2;
    for (let i = 0; i < n; i++) out[i] = h00 * a[i + 1] + h01 * b[i + 1] + h * (h10 * slope(tr, k, i, loop) + h11 * slope(tr, k + 1, i, loop)); return out; } }
  const l = tr[N - 1]; for (let i = 0; i < n; i++) out[i] = l[i + 1]; return out; }
function escalon(tr, t, out, n) { let k = 0; for (let i = 0; i < tr.length; i++) if (tr[i][0] <= t + 1e-6) k = i; for (let i = 0; i < n; i++) out[i] = tr[k][i + 1]; return out; }
const _e = new THREE.Euler(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1), _m = new THREE.Matrix4(), _pm = new THREE.Matrix4();
function poseFK(clip, t, out, sinRaiz) {
  out = out || new Float32Array(RIG.length * 16); const r3 = [0, 0, 0], t3 = [0, 0, 0]; _loop = clip.loop !== false; t = clip.loop === false ? Math.min(1, Math.max(0, t)) : t - Math.floor(t);
  RIG.forEach(([name, par, off], i) => { muestra(clip.tracks[name], t, r3, 3); _e.set(r3[0] * D2R, r3[1] * D2R, r3[2] * D2R); _q.setFromEuler(_e); _p.set(off[0], off[1], off[2]);
    if (par < 0 && clip.root && !sinRaiz) { muestra(clip.root, t, t3, 3); _p.x += t3[0]; _p.y += t3[1]; _p.z += t3[2]; }
    _m.compose(_p, _q, _s); if (par >= 0) { _pm.fromArray(out, par * 16); _m.premultiply(_pm); } _m.toArray(out, i * 16); });
  if (clip.tracks.armaP) ikArma(clip, t, out);
  return out;
}
const _T = new THREE.Matrix4(), _W = new THREE.Matrix4(), _S = new THREE.Vector3(), _Tg = new THREE.Vector3(), _pole = new THREE.Vector3(), _pp = new THREE.Vector3(), _d = new THREE.Vector3(), _E = new THREE.Vector3(), _dn = new THREE.Vector3(0, -1, 0), _qa = new THREE.Quaternion();
function ikArma(clip, t, out) {
  const ap = [0, 0, 0], ar = [0, 0, 0], g = [0, 0]; muestra(clip.tracks.armaP, t, ap, 3); muestra(clip.tracks.armaR || [[0, 0, 0, 0]], t, ar, 3); escalon(clip.tracks.agarre || [[0, 0.3, 0.75]], t, g, 2);
  _T.fromArray(out, IX.torso * 16); _e.set(ar[0] * D2R, ar[1] * D2R, ar[2] * D2R); _q.setFromEuler(_e); _p.set(...ap); _W.compose(_p, _q, _s).premultiply(_T); _W.toArray(out, IX.arma * 16);
  [['brazoDe', 'antebrazoDe', g[0], -1], ['brazoIz', 'antebrazoIz', g[1], 1]].forEach(([u, l, y, side]) => { if (y < 0) return; _S.setFromMatrixPosition(_pm.fromArray(out, IX[u] * 16)); _Tg.set(0, y, 0).applyMatrix4(_W);
    _pole.set(0.45 * side, -0.55, -0.25).applyMatrix4(_T); _pp.setFromMatrixPosition(_T); _pole.sub(_pp).add(_S);
    _d.subVectors(_Tg, _S); let dist = _d.length(); const dir = _d.normalize().clone(), l1 = 0.29, l2 = 0.28; dist = Math.min(l1 + l2 - 1e-3, Math.max(Math.abs(l1 - l2) + 1e-3, dist));
    const ca = (l1 * l1 + dist * dist - l2 * l2) / (2 * l1 * dist), sa = Math.sqrt(Math.max(0, 1 - ca * ca)); _pp.subVectors(_pole, _S); _pp.addScaledVector(dir, -_pp.dot(dir)).normalize();
    _E.copy(_S).addScaledVector(dir, l1 * ca).addScaledVector(_pp, l1 * sa); const Tg = _S.clone().addScaledVector(dir, dist);
    _d.subVectors(_E, _S).normalize(); _qa.setFromUnitVectors(_dn, _d); _m.compose(_S, _qa, _s); _m.toArray(out, IX[u] * 16); _d.subVectors(Tg, _E).normalize(); _qa.setFromUnitVectors(_dn, _d); _m.compose(_E, _qa, _s); _m.toArray(out, IX[l] * 16); });
}
// puntos de contacto del cuerpo (los de troops3d: BODY_PTS + pies)
const PTS = [['cabeza', [0, 0.29, 0]], ['cabeza', [0, 0.16, 0.11]], ['torso', [0.17, 0.42, 0.1]], ['torso', [-0.17, 0.42, 0.1]], ['torso', [0.17, 0.42, -0.12]], ['torso', [-0.17, 0.42, -0.12]], ['torso', [0, 0.15, 0.13]], ['torso', [0, 0.25, -0.2]],
  ['pelvis', [0.16, -0.08, -0.12]], ['pelvis', [-0.16, -0.08, -0.12]], ['pelvis', [0, -0.1, 0.12]], ['antebrazoIz', [0, -0.33, 0]], ['antebrazoDe', [0, -0.33, 0]], ['brazoIz', [0, -0.29, 0]], ['brazoDe', [0, -0.29, 0]], ['piernaIz', [0, 0, 0.07]], ['piernaDe', [0, 0, 0.07]],
  ['pieIz', [0, -0.081, -0.065]], ['pieIz', [0, -0.081, 0.175]], ['pieIz', [0, -0.081, 0.06]], ['pieDe', [0, -0.081, -0.065]], ['pieDe', [0, -0.081, 0.175]], ['pieDe', [0, -0.081, 0.06]]];
function puntos(M) { return PTS.map(([p, v]) => { const o = IX[p] * 16; return [M[o] * v[0] + M[o + 4] * v[1] + M[o + 8] * v[2] + M[o + 12], M[o + 1] * v[0] + M[o + 5] * v[1] + M[o + 9] * v[2] + M[o + 13], M[o + 2] * v[0] + M[o + 6] * v[1] + M[o + 10] * v[2] + M[o + 14], p]; }); }
// suelo para un clip: llano, o con el muro de trepar_muro
function sueloDe(meta) { const m = meta && meta.muro; return m ? (x, z) => (z >= m.z0 && z <= m.z1 ? m.alto : 0) : () => 0; }
// asentar: la raíz (y) se ajusta en N+1 instantes para que el punto más bajo respecto al suelo quede a 0; x, z se conservan
function asentar(clip, meta, poser, N) {
  N = N || 120; const M = new Float32Array(20 * 16), base = [0, 0, 0], suelo = sueloDe(meta), out = [];
  for (let i = 0; i <= N; i++) { const t = i / N; _loop = clip.loop !== false; muestra(clip.root, t, base, 3);
    poser(Object.assign({}, clip, {root: [[0, base[0], 0, base[2]]]}), t, M); const P = puntos(M); let low = Infinity; P.forEach(q => { low = Math.min(low, q[1] - suelo(q[0], q[2])); });
    // en trepar_muro solo se corrige hacia arriba (nunca atraviesa) y se respeta la altura escrita si es mayor (fase en el aire)
    const y = meta && meta.muro ? Math.max(base[1], -low + 0) : -low; out.push([+t.toFixed(4), +base[0].toFixed(4), +y.toFixed(4), +base[2].toFixed(4)]); }
  clip.root = out; return clip;
}
// asienta todos los clips con nuestra cinemática (si se registra con troops3d, se vuelve a asentar con su poseTroop)
Object.keys(CLIPS_COB).forEach(n => asentar(CLIPS_COB[n], META[n], (c, t, M) => poseFK(c, t, M)));

/* ---------- registro en troops3d y exportación ---------- */
function registrar(T3, op) {
  op = op || {}; if (!T3 || !T3.CLIPS || !T3.CLIPS.soldado) throw new Error('registrar: hace falta Troops3D (troops3d.js cargado)');
  const nombres = {}; const S = T3.CLIPS.soldado;
  Object.entries(CLIPS_COB).forEach(([n, c]) => { const destino = S[n] && !op.reemplazar ? n + '_v2' : n; const copia = JSON.parse(JSON.stringify(c));
    if (T3.poseTroop) { const tmp = '__cob'; asentar(copia, META[n], (cc, t, M) => { S[tmp] = cc; const out = T3.poseTroop('soldado', tmp, t); delete S[tmp]; for (let i = 0; i < RIG.length * 16; i++) M[i] = out[i]; return M; }); }
    S[destino] = copia; nombres[n] = destino; });
  return nombres;   // nombre pedido → nombre registrado (p. ej. tumbarse → tumbarse_v2 porque troops3d ya tiene uno)
}
function exportClipsJSON(espacio) {
  return JSON.stringify({version: 2, fps: {bucle: 30, sinBucle: 30}, interpolacion: 'cubica monotona (Fritsch-Carlson), bucles cerrados',
    convenciones: 'pistas [t, rx, ry, rz] en grados (Euler XYZ); raíz [t, x, y, z] en metros; eventos [t, nombre]; agarre [t, y mano derecha, y mano izquierda]; hide [t, visible]',
    partes: {soldado: RIG}, clips: {soldado: CLIPS_COB}, meta: META, transiciones: TRANSICIONES}, null, espacio);
}

/* ---------- prueba: contacto con el suelo, formato y eventos ---------- */
function pruebaAnimaciones(T3) {
  const res = {clips: {}}, M = new Float32Array(20 * 16), reg = T3 ? registrar(T3) : null;
  Object.entries(CLIPS_COB).forEach(([n, c0]) => {
    const c = reg ? T3.CLIPS.soldado[reg[n]] : c0, suelo = sueloDe(META[n]); let peorDentro = 0, peorFuera = 0, mal = 0;
    for (let i = 0; i <= 60; i++) { const t = i / 60; let P;
      if (reg) { const o = T3.poseTroop('soldado', reg[n], t); P = puntos(o); } else P = puntos(poseFK(c, t, M));
      let low = Infinity; P.forEach(q => { low = Math.min(low, q[1] - suelo(q[0], q[2])); }); peorDentro = Math.min(peorDentro, low); if (!META[n].muro) peorFuera = Math.max(peorFuera, low); if (low < -0.03 || (!META[n].muro && low > 0.03)) mal++; }
    const formato = typeof c.dur === 'number' && typeof c.loop === 'boolean' && Object.values(c.tracks).every(tr => tr.every(k => k.length === (tr === c.tracks.agarre ? 3 : 4) && k[0] >= 0 && k[0] <= 1)) && (c.ev || []).every(e => typeof e[1] === 'string');
    res.clips[n] = {dur: c.dur, bucle: c.loop, eventos: (c.ev || []).map(e => e[1]).join(','), penetracionMax: +(-peorDentro).toFixed(3), flotaMax: +peorFuera.toFixed(3), fotogramasMal: mal, formato, registrado: reg ? reg[n] : null};
  });
  const L = Object.values(res.clips); res.total = L.length; res.ok = L.every(c => c.formato && c.fotogramasMal === 0) && !!rutaTransicion('pie', 'muro_disparar_A') && !!rutaTransicion('pie', 'tumbado_recargar_D');
  res.rutaEjemplo = (rutaTransicion('pie', 'muro_disparar_A') || []).map(x => x.clip).join(' → ');
  return res;
}

/* ---------- demostración: maniquíes con los clips (usa troops3d si está cargado; si no, cinemática propia) ---------- */
function demoAnimaciones(cont) {
  const T3 = root.terreno3d, D = T3.baseDemo(cont || document.body, {cam: [0, 3.2, 9.5], obj: [0, 0.9, 0], sombra: 20}); D.escena.fog = null; D.escena.background = new THREE.Color(0xcfd6d8);
  D.cam.near = 0.05; D.cam.updateProjectionMatrix();
  const suelo = new THREE.Mesh(new THREE.PlaneGeometry(60, 30), new THREE.MeshLambertMaterial({color: 0x7a8a5a})); suelo.rotation.x = -Math.PI / 2; suelo.receiveShadow = true; D.escena.add(suelo);
  const q = new URLSearchParams(location.search), lista = (q.get('clips') || 'pegarse_pared,esquina_izq_disparar_A,muro_disparar_A,ventana_disparar_A,tras_roca,tumbado_recargar_A,arrastrarse,trepar_muro,herido_arrastrado,levantarse').split(',');
  const T = root.Troops3D, nombres = T ? registrar(T) : null;
  const CAJ = {pelvis: [[0, -0.03, 0], [0.32, 0.16, 0.2], 0x3a4a6a], torso: [[0, 0.22, 0], [0.36, 0.46, 0.22], 0x3a4a7a], cabeza: [[0, 0.13, 0.01], [0.19, 0.24, 0.22], 0xe0b48c], brazoIz: [[0, -0.145, 0], [0.1, 0.3, 0.1], 0x3a4a7a], brazoDe: [[0, -0.145, 0], [0.1, 0.3, 0.1], 0x3a4a7a],
    antebrazoIz: [[0, -0.15, 0], [0.085, 0.3, 0.085], 0x3a4a7a], antebrazoDe: [[0, -0.15, 0], [0.085, 0.3, 0.085], 0x3a4a7a], musloIz: [[0, -0.21, 0], [0.15, 0.42, 0.15], 0x8a8a8a], musloDe: [[0, -0.21, 0], [0.15, 0.42, 0.15], 0x8a8a8a],
    piernaIz: [[0, -0.17, 0], [0.12, 0.36, 0.12], 0x8a8a8a], piernaDe: [[0, -0.17, 0], [0.12, 0.36, 0.12], 0x8a8a8a], pieIz: [[0, -0.045, 0.055], [0.1, 0.075, 0.26], 0x221d1a], pieDe: [[0, -0.045, 0.055], [0.1, 0.075, 0.26], 0x221d1a], arma: [[0, 0.68, 0], [0.045, 1.42, 0.07], 0x6a4a2a]};
  const figuras = lista.map((n, i) => { const g = new THREE.Group(), partes = RIG.map(([p]) => { const [c, s, col] = CAJ[p]; const m = new THREE.Mesh(new THREE.BoxGeometry(...s).translate(...c), new THREE.MeshLambertMaterial({color: col})); m.matrixAutoUpdate = false; m.castShadow = true; g.add(m); return m; });
    const x = (i % 5 - 2) * 2.6, z = Math.floor(i / 5) * -3.2; g.position.set(x, 0, z); D.escena.add(g);
    const meta = META[n] || {}; if (meta.cobertura === 'muro_bajo' || meta.muro) { const w = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.1, 0.45), new THREE.MeshLambertMaterial({color: 0x8a8478})); w.position.set(x, 0.55, z + (meta.muro ? 0.82 : 0.62)); w.castShadow = w.receiveShadow = true; D.escena.add(w); }
    if (meta.cobertura === 'pared' || meta.cobertura === 'esquina') { const w = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.6, 0.3), new THREE.MeshLambertMaterial({color: 0xd8d0c0})); w.position.set(x + (meta.lado === 'izq' ? -0.75 : meta.lado === 'der' ? 0.75 : 0), 1.3, z + (meta.cobertura === 'pared' ? -0.35 : 0.1)); if (meta.cobertura === 'esquina') { w.scale.set(1, 1, 3); w.position.z = z - 0.2; } D.escena.add(w); w.castShadow = true; }
    if (meta.cobertura === 'ventana') { const w = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.6, 0.3), new THREE.MeshLambertMaterial({color: 0xd8d0c0})); w.position.set(x + 0.2, 1.3, z + 0.75); D.escena.add(w); const h = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.9, 0.32), new THREE.MeshBasicMaterial({color: 0x1c2228})); h.position.set(x, 1.45, z + 0.75); D.escena.add(h); }
    if (meta.cobertura === 'roca') { const r = new THREE.Mesh(new THREE.DodecahedronGeometry(0.6), new THREE.MeshLambertMaterial({color: 0x8a8680})); r.scale.set(1.3, 0.75, 0.8); r.position.set(x, 0.42, z + 0.75); D.escena.add(r); }
    return {g, partes, n, reg: nombres ? nombres[n] : n}; });
  const M = new Float32Array(20 * 16), mm = new THREE.Matrix4();
  D.bucle(t => figuras.forEach(F => { const c = CLIPS_COB[F.n]; if (!c) return; const ph = c.loop ? t / c.dur : Math.min(1, (t % (c.dur + 1.2)) / c.dur);
    const out = T ? T.poseTroop('soldado', F.reg, ph) : poseFK(c, ph, M); F.partes.forEach((m, i) => { m.matrix.fromArray(out, i * 16); }); }));
  return {D, figuras};
}

root.animacionesCobertura = {CLIPS_COB, META, TRANSICIONES, rutaTransicion, registrar, exportClipsJSON, poseFK, pruebaAnimaciones, demoAnimaciones, RIG, POSES: {A, PIE, TIRADOR, RODILLA, SEMI, BOCA_ABAJO}};
})(typeof window !== 'undefined' ? window : globalThis);
