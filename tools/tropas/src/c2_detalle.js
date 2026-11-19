
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
function torsoW(y) { return y < 0.22 ? 0.165 + 0.07 * y : y < 0.42 ? 0.18 + 0.1 * (y - 0.22) : 0.2; }
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
