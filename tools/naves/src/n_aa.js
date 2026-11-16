
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
