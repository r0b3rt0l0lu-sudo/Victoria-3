
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
