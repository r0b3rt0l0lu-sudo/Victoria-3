
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
