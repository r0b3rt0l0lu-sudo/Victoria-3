
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
