
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
