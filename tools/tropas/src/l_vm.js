
/* ================= v5: modelo en primera persona (viewmodel) =================
   Una sola copia, independiente de los lotes instanciados: brazos, manos, arma con piezas móviles (cerrojo, martillo y batería, baqueta,
   cargador o peine, palanca, corredera) y un trozo de pecho con el correaje. Espacio de cámara de three.js: x a la derecha, y arriba,
   −z hacia delante. Se dibuja en un segundo pase con su propia cámara (near 0,05), así nunca lo recorta el escenario.
   Animación: clips de pistas (arma, manos, mecanismos, cámara, fov) con la interpolación cúbica monótona del horneado; los brazos se
   resuelven cada fotograma por IK de dos huesos desde hombros fijos hasta la muñeca de cada mano, y las manos van sujetas a un punto
   del arma (empuñadura, guardamanos, cerrojo, baqueta…) o libres en el espacio de cámara, con transición suave entre agarres.
   TROOP_ARMS: armas por nación y época (datos y aspecto). Fuentes: manuales de instrucción (Manual of Exercise 1833, Infantry Drill 1862,
   Exerzier-Reglement 1888/1906, Field Service Pocket Book 1914) y fichas técnicas; las simplificaciones están anotadas en INTEGRACION. */
const TROOP_ARMS = {
  // modelo: aspecto (vmWeapon); accion: tipo de recarga; recarga: segundos en el juego (equilibrio); recargaReal: aproximada histórica
  mosquete_chispa: {nombre: 'Mosquete de chispa (Charleville / Brown Bess)', calibre: '17,5–19 mm', cadencia: 3, capacidad: 1, accion: 'avancarga', ignicion: 'chispa', recarga: 3.2, recargaReal: 20, alcance: 100, bayoneta: 'cubo'},
  mosquete_percusion: {nombre: 'Mosquete de percusión (conversión 1840)', calibre: '17,5 mm', cadencia: 3, capacidad: 1, accion: 'avancarga', ignicion: 'piston', recarga: 3.2, recargaReal: 18, alcance: 150, bayoneta: 'cubo'},
  rayado_minie: {nombre: 'Fusil rayado de percusión (Enfield 1853 / Springfield 1861 / Lorenz)', calibre: '14,7–15,2 mm', cadencia: 3, capacidad: 1, accion: 'avancarga', ignicion: 'piston', recarga: 2.6, recargaReal: 20, alcance: 450, bayoneta: 'cubo'},
  dreyse: {nombre: 'Fusil de aguja Dreyse M1841', calibre: '15,4 mm', cadencia: 10, capacidad: 1, accion: 'cerrojo_simple', recarga: 2.6, recargaReal: 6, alcance: 400, bayoneta: 'cubo'},
  chassepot: {nombre: 'Chassepot M1866', calibre: '11 mm', cadencia: 10, capacidad: 1, accion: 'cerrojo_simple', recarga: 2.6, recargaReal: 6, alcance: 600, bayoneta: 'sable'},
  mauser71: {nombre: 'Mauser M1871/84', calibre: '11 mm', cadencia: 12, capacidad: 1, accion: 'cerrojo_simple', recarga: 2.0, recargaReal: 5, alcance: 600, bayoneta: 'sable'},
  lebel: {nombre: 'Lebel M1886', calibre: '8 mm', cadencia: 12, capacidad: 8, accion: 'cerrojo_tubo', recarga: 2.0, recargaReal: 25, alcance: 700, bayoneta: 'aguja'},
  mosin: {nombre: 'Mosin-Nagant M1891 / 91-30', calibre: '7,62 mm', cadencia: 12, capacidad: 5, accion: 'cerrojo_peine', recarga: 1.6, recargaReal: 5, alcance: 800, bayoneta: 'aguja'},
  trapdoor: {nombre: 'Springfield M1873 «trapdoor»', calibre: '11,6 mm (.45-70)', cadencia: 10, capacidad: 1, accion: 'trampilla', recarga: 2.0, recargaReal: 5, alcance: 600, bayoneta: 'cubo'},
  martini: {nombre: 'Martini-Henry Mk II', calibre: '11,4 mm (.577/450)', cadencia: 10, capacidad: 1, accion: 'palanca', recarga: 2.0, recargaReal: 5, alcance: 600, bayoneta: 'sable'},
  lee: {nombre: 'Lee-Metford / Lee-Enfield (SMLE)', calibre: '7,7 mm (.303)', cadencia: 15, capacidad: 10, accion: 'cerrojo_peine', recarga: 1.6, recargaReal: 6, alcance: 800, bayoneta: 'sable'},
  mauser98: {nombre: 'Gewehr 98 / Kar 98k', calibre: '7,92 mm', cadencia: 12, capacidad: 5, accion: 'cerrojo_peine', recarga: 1.6, recargaReal: 5, alcance: 800, bayoneta: 'sable'},
  mannlicher: {nombre: 'Mannlicher M1895', calibre: '8 mm', cadencia: 15, capacidad: 5, accion: 'cerrojo_peine', recarga: 1.6, recargaReal: 4, alcance: 800, bayoneta: 'sable'},
  springfield03: {nombre: 'Springfield M1903', calibre: '7,62 mm (.30-06)', cadencia: 12, capacidad: 5, accion: 'cerrojo_peine', recarga: 1.6, recargaReal: 5, alcance: 800, bayoneta: 'sable'},
  garand: {nombre: 'M1 Garand', calibre: '7,62 mm (.30-06)', cadencia: 30, capacidad: 8, accion: 'semi_enbloc', recarga: 1.0, recargaReal: 3, alcance: 450, bayoneta: 'sable'},
  svt40: {nombre: 'SVT-40 / Gewehr 43', calibre: '7,62 / 7,92 mm', cadencia: 25, capacidad: 10, accion: 'semi_cargador', recarga: 1.0, recargaReal: 3, alcance: 450, bayoneta: 'sable'},
  mp40: {nombre: 'MP 40', calibre: '9 mm', cadencia: 500, capacidad: 32, accion: 'subfusil', recarga: 1.0, recargaReal: 3, alcance: 100, bayoneta: null, cargador: 'abajo'},
  sten: {nombre: 'Sten Mk II', calibre: '9 mm', cadencia: 500, capacidad: 32, accion: 'subfusil', recarga: 1.0, recargaReal: 3, alcance: 100, bayoneta: null, cargador: 'izquierda'},
  ppsh: {nombre: 'PPSh-41', calibre: '7,62 mm', cadencia: 900, capacidad: 71, accion: 'subfusil', recarga: 1.0, recargaReal: 4, alcance: 120, bayoneta: null, cargador: 'tambor'},
  thompson: {nombre: 'Thompson M1928 / M1', calibre: '11,4 mm (.45)', cadencia: 700, capacidad: 30, accion: 'subfusil', recarga: 1.0, recargaReal: 3, alcance: 100, bayoneta: null, cargador: 'abajo'},
  pistola: {nombre: 'Pistola de oficial (Luger P08 / Webley / Lebel 1892 / M1911)', calibre: '9–11,4 mm', cadencia: 30, capacidad: 8, accion: 'pistola', recarga: 1.2, recargaReal: 3, alcance: 40, bayoneta: null}
};
// arma por nación y época (rol 'fusil' | 'subfusil' | 'semi' | 'pistola'); GEN para el resto
const TROOP_ARMS_NAT = {
  A: {GEN: 'mosquete_chispa', USA: 'mosquete_percusion', GBR: 'mosquete_chispa', PRU: 'dreyse'},
  B: {GEN: 'rayado_minie', PRU: 'dreyse', GER: 'dreyse', FRA: 'chassepot'},
  C: {GEN: 'mauser71', GER: 'mauser71', PRU: 'mauser71', FRA: 'lebel', RUS: 'mosin', GBR: 'martini', USA: 'trapdoor', AUS: 'mannlicher'},
  D: {GEN: 'mauser98', GER: 'mauser98', FRA: 'lebel', RUS: 'mosin', GBR: 'lee', USA: 'springfield03', AUS: 'mannlicher', ITA: 'mannlicher'},
  E: {GEN: 'mauser98', GER: 'mauser98', FRA: 'lebel', RUS: 'mosin', SOV: 'mosin', GBR: 'lee', USA: 'garand', ITA: 'mannlicher', JAP: 'mauser98'}
};
const TROOP_ARMS_E = {subfusil: {GEN: 'mp40', GER: 'mp40', GBR: 'sten', RUS: 'ppsh', SOV: 'ppsh', USA: 'thompson'}, semi: {GEN: 'svt40', USA: 'garand', GER: 'svt40', SOV: 'svt40', RUS: 'svt40'}};
function troopArm(nation, era, rol) {
  if (rol === 'pistola') return 'pistola';
  if (era === 'E' && TROOP_ARMS_E[rol]) return TROOP_ARMS_E[rol][nation] || TROOP_ARMS_E[rol].GEN;
  const t = TROOP_ARMS_NAT[era] || TROOP_ARMS_NAT.D; return t[nation] || t.GEN;
}

/* ---------- geometría ---------- */
// cada pieza en su propio GeoBuilder (con su pivote); los colores de zona salen de la paleta de la nación
const VMC = {madera: 0x6a4428, maderaO: 0x4a2e1a, acero: 0x3a3c40, pavon: 0x24262a, laton: 0xb8954a, hierro: 0x55575a, cuero: 0x5a3a20, latonO: 0x8a6a30, piel: 0xd8a882, pielO: 0xb98a66, cobre: 0xa0603a, papel: 0xd8ccb0, verdoso: 0x4e5240};
function vmRifleSpec(id) {
  const A = TROOP_ARMS[id] || TROOP_ARMS.mauser98, acc = A.accion, long = acc === 'avancarga';
  const s = {id, acc, L: long ? -1.12 : id === 'lee' || id === 'mosin' || id === 'lebel' ? -0.92 : -0.86, butt: 0.36, bore: 0.05, ign: A.ignicion, bands: long ? 3 : id === 'lee' ? 1 : 2, pistol: ['mauser98', 'springfield03', 'garand', 'svt40', 'lee', 'mannlicher'].includes(id),
    full: id === 'lee', mag: ['mauser98', 'springfield03', 'mannlicher'].includes(id) ? 'interno' : id === 'mosin' ? 'saliente' : id === 'lee' ? 'caja' : id === 'svt40' ? 'caja' : null, bay: A.bayoneta,
    wood: id === 'lee' || id === 'garand' ? VMC.madera : VMC.maderaO, metal: acc === 'avancarga' ? VMC.hierro : VMC.pavon};
  s.sight = {rear: [0, s.bore + 0.03, -0.22], front: [0, s.bore + 0.032, s.L + 0.03]};
  s.grips = {empunadura: {p: [0, 0, 0], r: [0, 0, 0]}, guardamanos: {p: [0, s.bore - 0.035, long ? -0.42 : -0.36], r: [0, 0, 0]}, boca: {p: [0, s.bore + 0.02, s.L + 0.02], r: [-90, 0, 0]},
    cerrojo: {p: [0.075, s.bore - 0.005, 0.04], r: [0, 0, 0]}, martillo: {p: [0.03, s.bore + 0.01, 0.06], r: [0, 0, 0]}, cargador: {p: [0, s.bore - 0.06, -0.12], r: [0, 0, 0]}};
  return s;
}
function vmBuildRifle(s) {
  const B = new GeoBuilder(), F = Z.FIX, by = s.bore, L = s.L, W = s.wood, M = s.metal;
  // culata: perfil por secciones (cantonera, garganta, empuñadura, caja, guardamanos)
  const st = s.pistol ? [[s.butt, 0.022, 0.07, 0, -0.045], [0.22, 0.02, 0.055, 0, -0.03], [0.07, 0.018, 0.032, 0, -0.012], [0.0, 0.019, 0.03, 0, -0.012], [-0.06, 0.024, 0.03, 0, 0.0], [-0.2, 0.024, 0.028, 0, 0.02]]
    : [[s.butt, 0.022, 0.075, 0, -0.06], [0.2, 0.02, 0.055, 0, -0.035], [0.06, 0.017, 0.028, 0, -0.005], [0.0, 0.018, 0.026, 0, 0.0], [-0.06, 0.024, 0.03, 0, 0.012], [-0.2, 0.024, 0.026, 0, 0.022]];
  const fore = s.full ? [[-0.2, 0.024, 0.028, 0, 0.02], [L + 0.03, 0.021, 0.022, 0, by - 0.01]] : [[-0.2, 0.024, 0.026, 0, 0.022], [L + (s.acc === 'avancarga' ? 0.1 : 0.16), 0.019, 0.019, 0, by - 0.012]];
  B.loft(0, F, W, st.concat(fore.slice(1)).map(r => [r[0], r[1], r[2], r[3], r[4]]).sort((a, b) => a[0] - b[0]), 18, {axis: 'z', capA: true, capB: true, p: 2.6});
  B.loft(0, F, s.acc === 'avancarga' ? VMC.laton : M, [[s.butt - 0.008, 0.023, 0.077, 0, s.pistol ? -0.045 : -0.06], [s.butt + 0.004, 0.022, 0.074, 0, s.pistol ? -0.045 : -0.06]], 18, {axis: 'z', capB: true, p: 2.6});   // cantonera
  // cañón y bandas
  B.loft(0, F, M, [[0.02, 0.016, 0.016, 0, by], [-0.1, 0.0145, 0.0145, 0, by], [-0.4, 0.013, 0.013, 0, by], [L + 0.05, 0.0112, 0.0112, 0, by], [L, 0.011, 0.011, 0, by]], 20, {axis: 'z', capA: true});
  B.loft(0, F, 0x0a0a0a, [[L - 0.02, 0.0065, 0.0065, 0, by], [L + 0.0005, 0.0065, 0.0065, 0, by]], 8, {axis: 'z', inside: true, capA: true});
  B.loft(0, F, M, [[L - 0.0005, 0.0068, 0.0068, 0, by], [L, 0.011, 0.011, 0, by]], 20, {axis: 'z', nrm: [0, 0, -1]});
  for (let i = 0; i < s.bands; i++) { const z = L + 0.12 + i * ((-0.2 - (L + 0.12)) / Math.max(1, s.bands)); B.loft(0, F, s.acc === 'avancarga' && i === 0 ? VMC.laton : M, [[z - 0.012, 0.027, 0.03, 0, by - 0.01], [z - 0.009, 0.028, 0.031, 0, by - 0.01], [z + 0.009, 0.028, 0.031, 0, by - 0.01], [z + 0.012, 0.027, 0.03, 0, by - 0.01]], 16, {axis: 'z', p: 2.4}); }
  // miras
  B.box(0, F, M, [0, by + 0.017, L + 0.03], [0.004, 0.012, 0.012]);                                                         // punto de mira
  if (s.acc !== 'avancarga' || s.id === 'rayado_minie') { B.box(0, F, M, [0, by + 0.016, -0.215], [0.02, 0.008, 0.06], {taper: 0.1}); B.box(0, F, M, [0, by + 0.022, -0.2], [0.018, 0.005, 0.03], {rot: [-6, 0, 0]}); B.box(0, F, M, [0.0065, by + 0.0285, -0.22], [0.005, 0.006, 0.004]); B.box(0, F, M, [-0.0065, by + 0.0285, -0.22], [0.005, 0.006, 0.004]); }   // alza con muesca
  // guardamonte y disparador
  B.tube(0, F, M, [0, -0.026, 0.03], [0, -0.07, -0.02], [[0, 0.005], [1, 0.005]], 4); B.tube(0, F, M, [0, -0.07, -0.02], [0, -0.07, -0.09], [[0, 0.005], [1, 0.005]], 4); B.tube(0, F, M, [0, -0.07, -0.09], [0, -0.03, -0.11], [[0, 0.005], [1, 0.005]], 4);
  B.box(0, F, M, [0, -0.045, -0.04], [0.004, 0.035, 0.006], {rot: [-15, 0, 0]});
  // anillas de la correa y correa colgando
  B.loft(0, F, M, [[-0.006, 0.012, 0.012], [0.006, 0.012, 0.012]], 6, {axis: 'x', at: [0, -0.04, 0.2]});
  B.strap(0, F, VMC.cuero, [[-0.026, -0.05, 0.2], [-0.03, -0.09, 0.0], [-0.03, -0.1, -0.25], [-0.028, -0.045, L + 0.32]], 0.022, [-1, 0, 0]); B.strap(0, F, VMC.cuero, [[-0.024, -0.045, L + 0.32], [-0.028, -0.1, -0.25], [-0.028, -0.09, 0.0], [-0.024, -0.05, 0.2]], 0.022, [1, 0, 0]);
  B.loft(0, F, M, [[-0.006, 0.01, 0.01], [0.006, 0.01, 0.01]], 8, {axis: 'x', at: [0, by - 0.03, L + 0.32]});   // anilla delantera
  if (s.mag === 'saliente') B.box(0, F, M, [0, -0.045, -0.07], [0.03, 0.04, 0.09], {taper: 0.15});
  if (s.mag === 'caja') B.box(0, F, M, [0, -0.06, -0.08], [0.03, 0.07, 0.08], {taper: 0.1});
  // cajón de mecanismos / llave
  if (s.acc === 'avancarga') {
    B.box(0, F, VMC.hierro, [0.022, by - 0.005, 0.0], [0.006, 0.035, 0.13], {taper: 0.15});                                // pletina
    if (s.ign === 'chispa') { B.box(0, F, M, [0.03, by + 0.012, -0.045], [0.02, 0.012, 0.03]); }                          // cazoleta
    else B.tube(0, F, M, [0.02, by + 0.006, -0.03], [0.03, by + 0.022, -0.03], [[0, 0.004], [1, 0.0035]], 4);             // chimenea del pistón
  } else { B.loft(0, F, M, [[0.06, 0.019, 0.02, 0, by], [0.045, 0.0205, 0.0215, 0, by], [-0.115, 0.0205, 0.0215, 0, by], [-0.13, 0.019, 0.02, 0, by]], 16, {axis: 'z', capA: true, capB: true});   // cajón
    [0.03, -0.1].forEach(z => B.loft(0, F, 0x8a8c90, [[-0.002, 0.004, 0.004], [0.002, 0.004, 0.004]], 8, {axis: 'x', at: [0.021, by - 0.006, z], capB: true})); }   // tornillos del cajón
  if (s.bay === 'cubo' || s.bay === 'aguja' || s.bay === 'sable') {                                                      // bayoneta calada
    const z0 = L + 0.05, len = s.bay === 'sable' ? 0.42 : s.bay === 'aguja' ? 0.5 : 0.45;
    B.loft(0, F, M, [[z0 + 0.06, 0.014, 0.014, 0, by], [z0 - 0.01, 0.014, 0.014, 0, by]], 8, {axis: 'z'});
    if (s.bay === 'sable') { B.box(0, F, M, [0, by - 0.025, z0 - 0.02], [0.012, 0.04, 0.03]); B.box(0, F, 0xb8bcc0, [0, by - 0.035, z0 - 0.03 - len / 2], [0.004, 0.026, len], {taper: 0.6}); }
    else { B.tube(0, F, M, [0, by, z0], [0, by - 0.03, z0 - 0.02], [[0, 0.006], [1, 0.006]], 4); B.tube(0, F, 0xb8bcc0, [0, by - 0.03, z0 - 0.02], [0, by - 0.03, z0 - 0.02 - len], [[0, 0.009], [1, 0.001]], 3); }
  }
  return B;
}
function vmBuildMoving(s) {   // piezas móviles: {cerrojo, martillo, bateria, baqueta, palanca, cargador}
  const out = {}, F = Z.FIX, by = s.bore, M = s.metal;
  if (s.acc.startsWith('cerrojo') || s.acc === 'semi_enbloc' || s.acc === 'semi_cargador') {
    const b = new GeoBuilder(); b.loft(0, F, 0x8a8c90, [[0.1, 0.0085, 0.0085], [-0.08, 0.0085, 0.0085]], 8, {axis: 'z', capA: true, capB: true});   // eje del cerrojo (pivote en el eje del ánima)
    if (s.acc !== 'semi_enbloc' && s.acc !== 'semi_cargador') { b.tube(0, F, 0x8a8c90, [0.0, 0.0, 0.06], [0.065, -0.012, 0.075], [[0, 0.005], [1, 0.005]], 5); b.loft(0, F, 0x8a8c90, [[-0.012, 0.012, 0.012], [0.012, 0.012, 0.012]], 8, {axis: 'x', at: [0.075, -0.014, 0.077], capA: true, capB: true}); }   // manilla y bola
    else b.box(0, F, M, [0.03, 0.0, 0.03], [0.03, 0.012, 0.03]);                                                           // palanca de montar del Garand / SVT
    out.cerrojo = {g: b, at: [0, by, 0]};
  }
  if (s.acc === 'avancarga') {
    const h = new GeoBuilder(); if (s.ign === 'chispa') { h.box(0, F, M, [0, 0.03, -0.01], [0.008, 0.06, 0.012], {rot: [-30, 0, 0]}); h.box(0, F, 0x2a2a2a, [0, 0.055, -0.03], [0.012, 0.012, 0.012]); }   // pie de gato con pedernal
    else { h.box(0, F, M, [0, 0.028, -0.012], [0.008, 0.05, 0.012], {rot: [-25, 0, 0]}); h.box(0, F, M, [0, 0.05, -0.03], [0.012, 0.01, 0.02]); }   // martillo del pistón
    out.martillo = {g: h, at: [0.03, by - 0.02, 0.03]};
    if (s.ign === 'chispa') { const f = new GeoBuilder(); f.box(0, F, M, [0, 0.02, 0], [0.018, 0.04, 0.006]); out.bateria = {g: f, at: [0.03, by + 0.005, -0.06]}; }
    const r = new GeoBuilder(); r.loft(0, F, s.ign === 'chispa' ? 0x9a9a9a : 0x8a8c90, [[0, 0.004, 0.004], [-0.95, 0.004, 0.004], [-0.97, 0.007, 0.007]], 6, {axis: 'z', capA: true, capB: true}); out.baqueta = {g: r, at: [0, by - 0.024, L_(s) + 0.02]};
  }
  if (s.acc === 'trampilla') { const t = new GeoBuilder(); t.box(0, F, M, [0, 0.0, 0.05], [0.036, 0.03, 0.11]); t.box(0, F, M, [0.012, 0.02, 0.1], [0.008, 0.04, 0.012]); out.cerrojo = {g: t, at: [0, by, -0.08]}; }   // trampilla (gira hacia delante)
  if (s.acc === 'palanca') { const p = new GeoBuilder(); p.tube(0, F, M, [0, 0, 0], [0, -0.04, 0.16], [[0, 0.006], [1, 0.005]], 5); out.palanca = {g: p, at: [0, -0.03, -0.06]};
    const bl = new GeoBuilder(); bl.box(0, F, M, [0, 0, -0.03], [0.034, 0.03, 0.08]); out.cerrojo = {g: bl, at: [0, by, -0.02]}; }
  if (s.mag === 'caja' || s.acc === 'semi_cargador') { const m = new GeoBuilder(); m.box(0, F, M, [0, -0.035, 0], [0.028, 0.07, 0.075], {taper: 0.1}); out.cargador = {g: m, at: [0, -0.03, -0.08]}; }
  return out;
}
function L_(s) { return s.L; }
// subfusiles y pistola
function vmBuildSMG(id) {
  const B = new GeoBuilder(), F = Z.FIX, P = VMC.pavon, out = {}, by = 0.04, A = TROOP_ARMS[id];
  const len = id === 'ppsh' || id === 'thompson' ? -0.5 : -0.46;
  B.loft(0, F, P, [[0.06, 0.022, 0.024, 0, by], [len + 0.15, 0.022, 0.024, 0, by]], 10, {axis: 'z', capA: true, capB: true});                         // cajón
  B.loft(0, F, P, [[len + 0.15, 0.011, 0.011, 0, by], [len, 0.01, 0.01, 0, by]], 10, {axis: 'z', capB: true});                                           // cañón
  if (id === 'ppsh') B.loft(0, F, P, [[-0.1, 0.03, 0.03, 0, by], [len + 0.02, 0.028, 0.028, 0, by]], 10, {axis: 'z', capB: true});                       // camisa perforada
  if (id === 'ppsh' || id === 'thompson') B.loft(0, F, VMC.madera, [[0.36, 0.022, 0.07, 0, -0.05], [0.12, 0.02, 0.05, 0, -0.02], [0.02, 0.02, 0.03, 0, 0.0], [-0.12, 0.024, 0.03, 0, 0.0], [-0.2, 0.022, 0.026, 0, 0.01]], 10, {axis: 'z', capA: true, capB: true, p: 2.6});
  else if (id === 'mp40') { B.tube(0, F, P, [0, -0.02, 0.06], [0, 0.0, 0.32], [[0, 0.007], [1, 0.007]], 5); B.tube(0, F, P, [0, 0.02, 0.06], [0, 0.0, 0.32], [[0, 0.007], [1, 0.007]], 5); B.box(0, F, P, [0, 0.0, 0.33], [0.04, 0.09, 0.02]); B.box(0, F, 0x2a2018, [0, -0.06, 0.0], [0.03, 0.09, 0.04], {rot: [12, 0, 0]}); }
  else { B.tube(0, F, P, [0, -0.02, 0.06], [0, -0.01, 0.32], [[0, 0.008], [1, 0.008]], 5); B.box(0, F, P, [0, -0.01, 0.33], [0.03, 0.07, 0.02]); }   // Sten: culata de tubo
  B.tube(0, F, P, [0, -0.02, 0.03], [0, -0.06, -0.04], [[0, 0.004], [1, 0.004]], 4); B.box(0, F, P, [0, -0.045, -0.01], [0.004, 0.03, 0.006]);
  B.box(0, F, P, [0, by + 0.028, len + 0.03], [0.004, 0.012, 0.01]); B.box(0, F, P, [0, by + 0.03, 0.02], [0.02, 0.014, 0.01]);
  const m = new GeoBuilder();
  if (A.cargador === 'tambor') m.loft(0, F, P, [[-0.022, 0.07, 0.07], [0.022, 0.07, 0.07]], 14, {axis: 'x', at: [0, -0.07, 0], capA: true, capB: true});
  else if (A.cargador === 'izquierda') m.box(0, F, P, [-0.11, 0, 0], [0.2, 0.03, 0.035]);
  else m.box(0, F, P, [0, -0.11, 0], [0.026, 0.2, 0.036], {taper: 0.05});
  out.cargador = {g: m, at: [A.cargador === 'izquierda' ? -0.02 : 0, by - 0.02, -0.08]};
  const c = new GeoBuilder(); c.box(0, F, 0x8a8c90, [0.02, 0, 0], [0.025, 0.01, 0.012]); out.cerrojo = {g: c, at: [0.02, by, -0.02]};
  const s = {id, acc: 'subfusil', L: len, bore: by, butt: 0.33, sight: {rear: [0, by + 0.037, 0.02], front: [0, by + 0.034, len + 0.03]},
    grips: {empunadura: {p: [0, 0, 0], r: [0, 0, 0]}, guardamanos: {p: [0, A.cargador === 'abajo' ? -0.03 : by - 0.03, A.cargador === 'abajo' ? -0.08 : -0.24], r: [0, 0, 0]}, cerrojo: {p: [0.045, by, -0.02], r: [0, 0, 0]}, cargador: {p: A.cargador === 'izquierda' ? [-0.15, by, -0.08] : [0, -0.13, -0.08], r: [0, 0, 0]}}};
  return {body: B, moving: out, spec: s};
}
function vmBuildPistol() {
  const B = new GeoBuilder(), F = Z.FIX, P = VMC.pavon, out = {};
  B.box(0, F, 0x2a2018, [0, -0.045, 0.012], [0.028, 0.1, 0.04], {rot: [14, 0, 0]}); B.box(0, F, P, [0, 0.015, -0.06], [0.026, 0.03, 0.15]);
  B.tube(0, F, P, [0, -0.015, 0.0], [0, -0.03, -0.04], [[0, 0.004], [1, 0.004]], 4);
  const sl = new GeoBuilder(); sl.box(0, F, P, [0, 0, -0.06], [0.028, 0.026, 0.17]); sl.box(0, F, P, [0, 0.016, -0.14], [0.004, 0.008, 0.008]); out.cerrojo = {g: sl, at: [0, 0.035, 0]};
  const m = new GeoBuilder(); m.box(0, F, P, [0, -0.05, 0], [0.022, 0.1, 0.03]); out.cargador = {g: m, at: [0, -0.04, 0.014]};
  return {body: B, moving: out, spec: {id: 'pistola', acc: 'pistola', L: -0.16, bore: 0.035, butt: 0.0, sight: {rear: [0, 0.055, 0.02], front: [0, 0.056, -0.14]},
    grips: {empunadura: {p: [0, 0, 0], r: [0, 0, 0]}, guardamanos: {p: [-0.02, -0.04, 0.02], r: [0, 0, 0]}, cerrojo: {p: [0, 0.05, 0.0], r: [0, 0, 0]}, cargador: {p: [0, -0.12, 0.02], r: [0, 0, 0]}}}};
}
// mano derecha que empuña (marco: objeto a lo largo de z, palma en +x); izquierda = espejo. curl: 0 abierta … 1 cerrada
function vmBuildHand(curl, left, skin, cuff) {
  const B = new GeoBuilder(), F = Z.FIX, sk = skin, r = 0.024;
  B.loft(0, F, sk, [[0.075, 0.02, 0.042, 0.035, 0.0], [0.05, 0.022, 0.045, 0.035, -0.003], [0.03, 0.022, 0.046, 0.034, -0.005], [0.005, 0.02, 0.046, 0.032, -0.012], [-0.02, 0.016, 0.044, 0.03, -0.02]], 14, {axis: 'z', capA: true, capB: true, p: 2.4});   // palma (lado +x del objeto)
  const fingers = [[-0.012, 0.02], [-0.033, 0.021], [-0.053, 0.019], [-0.07, 0.016]];                                        // z de cada dedo, grosor
  fingers.forEach(([z, w], i) => {
    let p = [0.036, -0.012, z];                                                                                                  // nudillo: sale hacia −y y se curva hacia −x
    const segs = [0.042 - i * 0.003, 0.028, 0.022];
    segs.forEach((l, k) => { const th = Math.min(Math.PI, (k + 1) * curl * 1.05 + 0.15);                                    // ángulo desde −y hacia −x
      const q2 = [p[0] - l * Math.sin(th), p[1] - l * Math.cos(th), z]; B.tube(0, F, sk, p, q2, [[0, w * 0.5], [0.5, w * 0.53], [1, w * 0.45]], 10, {capB: k === 2, domeB: k === 2 ? w * 0.35 : 0}); p = q2; });
  });
  // pulgar: por encima del objeto hacia −x
  B.tube(0, F, sk, [0.03, 0.02, 0.05], [0.006, r + 0.016, 0.02], [[0, 0.013], [0.5, 0.0125], [1, 0.011]], 10); B.tube(0, F, sk, [0.006, r + 0.016, 0.02], [-0.022, r + 0.012, 0.0 - 0.012 * curl], [[0, 0.011], [0.5, 0.0105], [1, 0.009]], 10, {capB: true, domeB: 0.004});
  // muñeca y puño de la manga
  B.loft(0, F, sk, [[0.13, 0.026, 0.03, 0.055, -0.01], [0.1, 0.024, 0.033, 0.05, -0.006], [0.075, 0.024, 0.036, 0.045, -0.004]], 14, {axis: 'z'});
  B.loft(0, cuff ? Z.TRIM : Z.MAIN, 0, [[0.19, 0.04, 0.042, 0.062, -0.012], [0.15, 0.039, 0.041, 0.06, -0.012], [0.128, 0.035, 0.037, 0.056, -0.01], [0.125, 0.03, 0.032, 0.056, -0.01]], 16, {axis: 'z', capB: true});
  for (let i = 0; i < 4; i++) B.loft(0, F, VMC.latonO, [[0.166 + i * 0.0001, 0.006, 0.006, 0.062 + 0.041 * Math.cos(i * 0.5 - 0.7), -0.012 + 0.043 * Math.sin(i * 0.5 - 0.7)], [0.17, 0.006, 0.006, 0.062 + 0.041 * Math.cos(i * 0.5 - 0.7), -0.012 + 0.043 * Math.sin(i * 0.5 - 0.7)]], 6, {axis: 'z', capB: true});   // botones del puño
  if (left) { for (let i = 0; i < B.p.length; i += 3) B.p[i] = -B.p[i]; for (let i = 0; i < B.n.length; i += 3) B.n[i] = -B.n[i];
    for (let t = 0; t < B.p.length / 9; t++) { const o = t * 9; for (const arr of [B.p, B.n, B.col]) for (let k = 0; k < 3; k++) { const a = arr[o + 3 + k]; arr[o + 3 + k] = arr[o + 6 + k]; arr[o + 6 + k] = a; } } }
  return B;
}
// GeoBuilder → BufferGeometry con colores de la paleta (zonas) o del vértice (FIX)
function vmGeo(B, pal) {
  const n = B.p.length / 3, P = new Float32Array(B.p), N = new Float32Array(B.n), Co = new Float32Array(n * 3), c = new THREE.Color();
  const zc = {[Z.MAIN]: pal.main, [Z.TRIM]: pal.trim, [Z.ACC]: pal.accessory, [Z.HAT]: pal.hat};
  for (let i = 0; i < n; i++) { const z = B.zone[i]; if (zc[z]) { c.set(zc[z]); Co[i * 3] = c.r; Co[i * 3 + 1] = c.g; Co[i * 3 + 2] = c.b; } else { Co[i * 3] = B.col[i * 3]; Co[i * 3 + 1] = B.col[i * 3 + 1]; Co[i * 3 + 2] = B.col[i * 3 + 2]; } }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.BufferAttribute(N, 3)); g.setAttribute('color', new THREE.BufferAttribute(Co, 3)); g.computeBoundingSphere(); return g;
}
function vmArmGeo(len, r0, r1, zone) { const B = new GeoBuilder(), m = (r0 + r1) / 2;   // manga con pliegues (anillos alternos)
  const R = [[-len - 0.01, r1, r1 * 1.05]]; for (let i = 1; i < 8; i++) { const f = i / 8, r = r1 + (r0 - r1) * f + (i % 2 ? 0.003 : -0.002) + Math.sin(f * Math.PI) * m * 0.08; R.push([-len - 0.01 + (len + 0.03) * f, r, r * 1.06, (i % 3 - 1) * 0.002, 0]); } R.push([0.02, r0, r0 * 1.05]);
  B.loft(0, zone, 0, R, 16, {axis: 'z', capB: true, domeB: 0.02}); return B; }
// trozo de pecho visible al mirar abajo: guerrera, correaje y cartucheras según época (espacio del cuerpo: ojos en el origen)
function vmChest(era, eq) {
  const B = new GeoBuilder(), F = Z.FIX, AB = era === 'A' || era === 'B', bc = AB ? 0xe6e2d6 : eq === 'ger' ? 0x2e2620 : 0x8a7a50;
  B.loft(0, Z.MAIN, 0, [[-0.95, 0.17, 0.11, 0, 0.0], [-0.82, 0.175, 0.116, 0, 0.006], [-0.72, 0.18, 0.12, 0, 0.012], [-0.62, 0.183, 0.121, 0, 0.01], [-0.52, 0.185, 0.12, 0, 0.008], [-0.42, 0.17, 0.1, 0, -0.006], [-0.36, 0.1, 0.07, 0, -0.012], [-0.32, 0.06, 0.055]], 20, {at: [0, 0, 0.09], p: 3, a0: Math.PI / 10});
  const fz = y => 0.09 + (y > -0.6 ? 0.125 : 0.118);
  if (AB) [1, -1].forEach(s => B.strap(0, F, bc, [[-0.17 * s, -0.92, 0], [-0.06 * s, -0.7, 0], [0.08 * s, -0.5, 0], [0.16 * s, -0.4, 0]].map(q => [q[0], q[1], fz(q[1]) + 0.004 + (s > 0 ? 0.002 : 0)]), 0.05, [0, 0, 1]));
  else { [1, -1].forEach(s => { B.strap(0, F, bc, [[0.1 * s, -0.95, fz(-0.95) + 0.005], [0.11 * s, -0.7, fz(-0.7) + 0.006], [0.12 * s, -0.44, 0.17]], 0.035, [0, 0, 1]); B.box(0, F, bc, [0.1 * s, -0.9, fz(-0.9) + 0.03], [0.07, 0.085, 0.045], {bottom: true}); }); }
  for (let i = 0; i < 4; i++) { const y = -0.88 + i * 0.12, z = fz(y) + 0.006, r = 0.011; B.quad([-r, y - r, z], [r, y - r, z], [r, y + r, z], [-r, y + r, z], 0, F, era >= 'D' ? 0x6a6040 : 0xc8a650); }
  B.loft(0, era < 'E' ? Z.TRIM : Z.MAIN, 0, [[-0.34, 0.07, 0.068, 0, 0.0], [-0.27, 0.066, 0.064, 0, 0.004]], 8, {at: [0, 0, 0.09]});
  return B;
}
// accesorios: cartucho de papel, cartucho metálico, peine, clip en bloque, granada (palo o huevo), venda
function vmProps(era, nation, arm) {
  const F = Z.FIX, P = {};
  const cart = new GeoBuilder(); if (arm.acc === 'avancarga') cart.loft(0, F, VMC.papel, [[-0.035, 0.008, 0.008], [0.035, 0.009, 0.009], [0.045, 0.006, 0.006]], 6, {axis: 'z', capA: true, capB: true});
  else { cart.loft(0, F, VMC.laton, [[0.0, 0.0065, 0.0065], [0.055, 0.0065, 0.0065]], 6, {axis: 'z', capA: true}); cart.loft(0, F, VMC.cobre, [[-0.025, 0.0042, 0.0042], [0.0, 0.0055, 0.0055]], 6, {axis: 'z', capA: true, domeA: -0.008}); }
  P.cartucho = cart;
  const pe = new GeoBuilder(); for (let i = 0; i < 5; i++) { pe.loft(0, F, VMC.laton, [[-0.03, 0.0062, 0.0062, 0.0, -0.022 + i * 0.011], [0.026, 0.0062, 0.0062, 0.0, -0.022 + i * 0.011]], 6, {axis: 'z', capA: true}); pe.loft(0, F, VMC.cobre, [[-0.052, 0.0035, 0.0035, 0, -0.022 + i * 0.011], [-0.03, 0.0055, 0.0055, 0, -0.022 + i * 0.011]], 5, {axis: 'z', capA: true}); }
  pe.box(0, F, 0x6a6c70, [0, 0, 0.03], [0.008, 0.062, 0.006]); P.peine = pe;
  const gr = new GeoBuilder();
  if (nation === 'GER' || nation === 'PRU' || nation === 'AUS') { gr.loft(0, F, VMC.madera, [[-0.2, 0.013, 0.013], [0.0, 0.014, 0.014]], 6, {axis: 'z', capA: true}); gr.loft(0, F, 0x4a5040, [[0.0, 0.032, 0.032], [0.075, 0.032, 0.032]], 10, {axis: 'z', capA: true, capB: true}); }   // granada de mango M24
  else { gr.loft(0, F, nation === 'SOV' || nation === 'RUS' ? 0x4e5a40 : 0x5a6040, [[-0.045, 0.012, 0.012], [-0.035, 0.03, 0.03], [0.0, 0.034, 0.034], [0.035, 0.03, 0.03], [0.045, 0.01, 0.01]], 10, {axis: 'z', capA: true, capB: true}); gr.box(0, F, 0x8a8c80, [0.025, 0.0, -0.02], [0.012, 0.012, 0.06]); }   // Mills / Mk 2 / F1
  P.granada = gr;
  const v = new GeoBuilder(); v.loft(0, F, 0xece6d6, [[-0.04, 0.03, 0.03], [0.04, 0.03, 0.03]], 10, {axis: 'x', capA: true, capB: true}); v.strap(0, F, 0xece6d6, [[0.0, -0.03, 0.0], [0.0, -0.1, 0.03], [0.02, -0.18, 0.02]], 0.06, [0, 0, 1]); P.venda = v;
  return P;
}

/* ---------- poses y clips del viewmodel ----------
   Espacio de cámara (m): x derecha, y arriba, −z delante. Arma: origen en la empuñadura (muñeca de la culata), boca hacia −z.
   Pistas: arma [t, x,y,z, rx,ry,rz] · manoDe/manoIz [t, espacio, x,y,z, rx,ry,rz, cierre] (espacio: 'cam' | 'arma' | pieza móvil) ·
   cerrojo [t, x,y,z, rx,ry,rz] · martillo/bateria/palanca [t, rx] · baqueta [t, x,y,z, rx,ry,rz] (espacio del arma) ·
   cargador y accesorios [t, espacio, x,y,z, rx,ry,rz, visible] · cam [t, rx,ry,rz, fov×] · ev [[t, nombre]] */
function vmPoses(s) {
  const r = s.sight.rear, f = s.sight.front, pitch = Math.atan2(f[1] - r[1], r[2] - f[2]) / D2R;
  const ads = [-r[0], -r[1] - 0.004, -0.13 - r[2], -pitch, 0, 0];
  const pist = s.acc === 'pistola', smg = s.acc === 'subfusil';
  return {
    bajo: pist ? [0.12, -0.2, -0.3, -18, 6, 4] : [0.15, -0.205, -0.3, -7, 4, 9],
    cadera: pist ? [0.1, -0.13, -0.32, 0, 3, 2] : [0.12, -0.16, -0.29, -1, 2, 5],
    ads: pist ? [0, -0.055, -0.36, 0, 0, 0] : ads,
    carrera: pist ? [0.14, -0.32, -0.22, -50, 10, 10] : [0.03, -0.3, -0.3, 30, 42, 38],
    carga: [0.02, -1.2, -0.4, 84, 12, -6],                                                              // avancarga: culata abajo, boca arriba y delante
    cerrojo: pist || smg ? [0.02, -0.16, -0.32, 8, 22, -30] : [-0.01, -0.17, -0.33, 6, 24, -34],          // mecanismo girado hacia la vista
    tumbado: pist ? [0.08, -0.12, -0.3, 0, 2, 2] : [0.1, -0.15, -0.24, -2, 2, 3],
    fuera: [0.2, -0.75, 0.0, -50, 10, 30]                                                                 // fuera de la vista (curar, muerte)
  };
}
const vmG = (s, side, curl, extra) => side === 'De' ? ['arma', 0, 0, 0, 0, 0, 0, curl == null ? 0.92 : curl] : ['arma'].concat(s.grips.guardamanos.p, extra || [0, 0, 80], [curl == null ? 0.78 : curl]);
const K = (t, a) => [t].concat(a);
function vmClipSet(s, era, nation) {
  const P = vmPoses(s), C = {}, mk2 = (dur, loop, tracks, ev, o) => Object.assign({dur, loop, tracks, ev: ev || []}, o || {});
  const GR = vmG(s, 'De'), GL = vmG(s, 'Iz'), pist = s.acc === 'pistola';
  const GLp = pist ? ['manoDe', -0.025, -0.035, 0.0, 0, 0, -20, 0.85] : GL;                               // pistola a dos manos: la izquierda envuelve a la derecha
  const hold = (pose, dur, amp, extra) => mk2(dur, true, Object.assign({arma: [0, 0.25, 0.5, 0.75, 1].map((t, i) => K(t, [pose[0] + amp * 0.3 * Math.sin(i * Math.PI / 2), pose[1] + amp * Math.sin(i * Math.PI), pose[2], pose[3] + amp * 60 * Math.sin(i * Math.PI), pose[4] + amp * 40 * Math.sin(i * Math.PI / 2), pose[5]])),
    manoDe: [K(0, GR)], manoIz: [K(0, GLp)]}, extra || {}));
  // reposo, marcha y carrera (balanceo en ocho por paso; el arma retrasa el movimiento de la cámara)
  C.idle_vm = hold(P.bajo, 4.0, 0.004);
  const bob = (pose, dur, ax, ay, rot) => mk2(dur, true, {arma: Array.from({length: 9}, (_, i) => { const t = i / 8, a = t * Math.PI * 2; return K(t, [pose[0] + ax * Math.sin(a), pose[1] - ay * Math.abs(Math.cos(a)), pose[2] + ay * 0.3 * Math.sin(2 * a), pose[3] + rot * Math.cos(2 * a), pose[4] + rot * 0.6 * Math.sin(a), pose[5] + rot * 0.8 * Math.sin(a)]); }),
    manoDe: [K(0, GR)], manoIz: [K(0, GLp)], cam: Array.from({length: 9}, (_, i) => { const a = i / 8 * Math.PI * 2; return K(i / 8, [0.4 * Math.cos(2 * a), 0, 0.3 * Math.sin(a), 1]); })}, [[0, 'paso'], [0.5, 'paso']]);
  C.marcha_vm = bob(P.bajo, 1.05, 0.012, 0.014, 1.4);
  C.carrera_vm = bob(P.carrera, 0.66, 0.03, 0.03, 3.5);
  // apuntar (cadera) y ADS: entrada, mantener y salida
  const tr2 = (a, b, dur, ev, fov) => mk2(dur, false, {arma: [K(0, a), K(0.55, [b[0] + (a[0] - b[0]) * 0.06, b[1] + (a[1] - b[1]) * 0.06, b[2], b[3], b[4], b[5]]), K(1, b)], manoDe: [K(0, GR)], manoIz: [K(0, GLp)],
    cam: fov ? [K(0, [0, 0, 0, fov[0]]), K(1, [0, 0, 0, fov[1]])] : undefined}, ev);
  C.apuntar_entrada = tr2(P.bajo, P.cadera, 0.25); C.apuntar_vm = hold(P.cadera, 3.5, 0.0025); C.apuntar_salida = tr2(P.cadera, P.bajo, 0.3);
  C.ads_entrada = tr2(P.cadera, P.ads, 0.22, [], [1, 0.78]); C.ads_vm = hold(P.ads, 3.6, 0.0012, {cam: [K(0, [0, 0, 0, 0.78])]}); C.ads_salida = tr2(P.ads, P.cadera, 0.22, [], [0.78, 1]);
  Object.keys(C).forEach(k => { if (C[k].tracks.cam === undefined) delete C[k].tracks.cam; });
  // disparo: patada (atrás y arriba), vuelta con un rebote; las armas de cerrojo encadenan el ciclo del cerrojo
  const kick = (pose, big) => { const k = big ? 1 : 0.55;
    return [K(0, pose), K(0.04, [pose[0] + 0.004 * k, pose[1] + 0.012 * k, pose[2] + 0.06 * k, pose[3] + 7 * k, pose[4] - 1.5 * k, pose[5] + 2 * k]), K(0.16, [pose[0], pose[1] + 0.004 * k, pose[2] + 0.015 * k, pose[3] + 1.5 * k, pose[4], pose[5]]), K(0.3, [pose[0], pose[1] - 0.002, pose[2] - 0.004, pose[3] - 0.6, pose[4], pose[5]]), K(0.45, pose)]; };
  const camKick = big => [K(0, [0, 0, 0, 1]), K(0.035, [big ? 2.4 : 1.2, big ? -0.4 : 0, big ? 0.6 : 0.2, 1.02]), K(0.25, [0.2, 0, 0, 1]), K(0.45, [0, 0, 0, 1])];
  const big = s.acc === 'avancarga' || s.acc === 'cerrojo_simple' || s.acc === 'trampilla' || s.acc === 'palanca';
  const shot = (pose, ads) => { const auto = s.acc === 'subfusil';
    const c = mk2(auto ? 0.12 : 0.45, auto, {arma: auto ? [K(0, pose), K(0.3, [pose[0], pose[1] + 0.006, pose[2] + 0.025, pose[3] + 2.4, pose[4] + 0.6, pose[5]]), K(1, pose)] : kick(pose, big).map(k => [k[0] / 0.45].concat(k.slice(1))),
      manoDe: [K(0, GR)], manoIz: [K(0, GLp)], cam: auto ? [K(0, [0, 0, 0, ads ? 0.78 : 1]), K(0.3, [0.5, 0.1, 0, ads ? 0.78 : 1]), K(1, [0, 0, 0, ads ? 0.78 : 1])] : camKick(big).map(k => [k[0] / 0.45, k[1], k[2], k[3], k[4] * (ads ? 0.78 : 1)])},
      auto ? [[0, 'fuego'], [0.3, 'casquillo']] : [[0, 'fuego']].concat(s.acc === 'avancarga' ? [[0.02, 'humo']] : []));
    if (s.acc === 'avancarga' && s.ign === 'chispa') c.tracks.martillo = [K(0, [0]), K(0.03, [-38]), K(1, [-38])], c.tracks.bateria = [K(0, [0]), K(0.03, [-70]), K(1, [-70])];
    if (s.acc === 'avancarga' && s.ign !== 'chispa') c.tracks.martillo = [K(0, [0]), K(0.03, [-34]), K(1, [-34])];
    if (s.acc === 'pistola') c.tracks.cerrojo = [K(0, [0, 0, 0, 0, 0, 0]), K(0.06, [0, 0, 0.05, 0, 0, 0]), K(0.2, [0, 0, 0, 0, 0, 0]), K(1, [0, 0, 0, 0, 0, 0])], c.ev.push([0.06, 'casquillo']);
    if (s.acc === 'semi_enbloc' || s.acc === 'semi_cargador') c.tracks.cerrojo = [K(0, [0, 0, 0, 0, 0, 0]), K(0.05, [0, 0, 0.09, 0, 0, 0]), K(0.16, [0, 0, 0, 0, 0, 0]), K(1, [0, 0, 0, 0, 0, 0])], c.ev.push([0.05, 'casquillo']);
    return c; };
  C.disparar_vm = shot(P.cadera, false); C.disparar_ads_vm = shot(P.ads, true);
  // ciclo del cerrojo (cerrojo_simple / tubo / peine): la mano derecha deja la empuñadura, gira la manilla, tira, empuja y baja
  const boltCycle = (t0, d, pose) => {   // devuelve claves para arma/manoDe/cerrojo en [t0, t0+d] (fracciones del clip)
    const T = f => t0 + f * d, sock = s.grips.cerrojo.p, bolt = s.acc.startsWith('cerrojo');
    return {arma: [K(T(0), pose), K(T(0.15), P.cerrojo), K(T(0.85), P.cerrojo), K(T(1), pose)],
      manoDe: [K(T(0), GR), K(T(0.12), ['cerrojo', 0.075, -0.02, 0.078, 0, 0, 30, 0.6]), K(T(0.88), ['cerrojo', 0.075, -0.02, 0.078, 0, 0, 30, 0.6]), K(T(1), GR)],
      cerrojo: bolt ? [K(T(0), [0, 0, 0, 0, 0, 0]), K(T(0.18), [0, 0, 0, 0, 0, 0]), K(T(0.32), [0, 0, 0, 0, 0, 62]), K(T(0.5), [0, 0, 0.1, 0, 0, 62]), K(T(0.68), [0, 0, 0, 0, 0, 62]), K(T(0.82), [0, 0, 0, 0, 0, 0]), K(T(1), [0, 0, 0, 0, 0, 0])] : null,
      ev: bolt ? [[T(0.32), 'cerrojo'], [T(0.5), 'casquillo'], [T(0.8), 'cerrojo']] : [], sock};
  };
  const bolted = s.acc === 'cerrojo_peine' || s.acc === 'cerrojo_tubo';
  if (bolted) {
    const b = boltCycle(0, 1, P.cadera); C.cerrojo_vm = mk2(1.0, false, {arma: b.arma, manoDe: b.manoDe, manoIz: [K(0, GL)], cerrojo: b.cerrojo}, b.ev);
    ['disparar_vm', 'disparar_ads_vm'].forEach((k, j) => {                                       // disparo + cerrojo (1,4 s)
      const c = C[k], pose = j ? P.ads : P.cadera, D = 1.45, f = 0.45 / D, b2 = boltCycle(0.36, 0.64, pose);
      c.dur = D; c.tracks.arma = c.tracks.arma.map(q => [q[0] * f].concat(q.slice(1))).concat(b2.arma.slice(1)); c.tracks.cam = c.tracks.cam.map(q => [q[0] * f].concat(q.slice(1))).concat([K(1, [0, 0, 0, j ? 0.78 : 1])]);
      c.tracks.manoDe = [K(0, GR)].concat(b2.manoDe); c.tracks.cerrojo = [K(0, [0, 0, 0, 0, 0, 0])].concat(b2.cerrojo); c.ev = c.ev.concat(b2.ev); });
  }
  // ---- recargas por mecanismo
  const R = recargaVM(s, P, GR, GL, GLp, era, nation); Object.assign(C, R);
  C.recargar_vm = R.recargar_vm;
  // ---- posturas: el arma baja y vuelve mientras la cámara cambia de altura (la altura la pone el juego)
  const dip = (dur, depth, roll, ev) => mk2(dur, false, {arma: [K(0, P.bajo), K(0.35, [P.bajo[0] + 0.02, P.bajo[1] - depth, P.bajo[2] + 0.03, P.bajo[3] - 8, P.bajo[4], P.bajo[5] + roll]), K(1, P.bajo)], manoDe: [K(0, GR)], manoIz: [K(0, GLp)],
    cam: [K(0, [0, 0, 0, 1]), K(0.4, [-2, 0, roll * 0.15, 1]), K(1, [0, 0, 0, 1])]}, ev);
  C.agacharse_vm = dip(0.45, 0.05, 6, [[0.35, 'postura']]); C.rodilla_vm = dip(0.6, 0.08, 10, [[0.5, 'rodilla']]);
  C.tumbado_vm = mk2(1.1, false, {arma: [K(0, P.bajo), K(0.3, [0.12, -0.42, 0.0, -30, 10, 30]), K(0.7, [0.1, -0.2, -0.02, -6, 4, 6]), K(1, P.tumbado)], manoDe: [K(0, GR)], manoIz: [K(0, GLp), K(0.35, ['cam', -0.2, -0.42, -0.25, 0, 0, 0, 0.3]), K(0.65, ['cam', -0.2, -0.42, -0.25, 0, 0, 0, 0.3]), K(1, GLp)],
    cam: [K(0, [0, 0, 0, 1]), K(0.5, [-6, 0, 4, 1]), K(1, [0, 0, 0, 1])]}, [[0.5, 'tumbado']]);
  C.tumbado_idle_vm = hold(P.tumbado, 4.0, 0.002);
  // cuerpo a cuerpo
  if (!pist) {
    C.golpe_culata_vm = mk2(0.85, false, {arma: [K(0, P.bajo), K(0.25, [0.22, -0.18, 0.05, 30, 70, 60]), K(0.42, [0.0, -0.08, -0.32, -40, 80, 70]), K(0.55, [0.02, -0.12, -0.25, -30, 75, 65]), K(1, P.bajo)],
      manoDe: [K(0, GR)], manoIz: [K(0, GL)], cam: [K(0, [0, 0, 0, 1]), K(0.4, [1, 6, -2, 1]), K(0.45, [3, 2, 0, 1]), K(1, [0, 0, 0, 1])]}, [[0.42, 'golpe']]);
    if (s.bay) C.bayoneta_vm = mk2(0.75, false, {arma: [K(0, P.bajo), K(0.22, [0.12, -0.2, 0.12, -4, 4, 8]), K(0.36, [0.06, -0.16, -0.36, -2, 2, 4]), K(0.5, [0.07, -0.17, -0.3, -2, 2, 4]), K(1, P.bajo)],
      manoDe: [K(0, GR)], manoIz: [K(0, GL)], cam: [K(0, [0, 0, 0, 1]), K(0.36, [-1, 0, 0, 0.97]), K(1, [0, 0, 0, 1])]}, [[0.34, 'bayoneta']]);
  }
  // granada (D y E): la izquierda baja el fusil, la derecha saca, tira de la anilla / del cordón y lanza
  if (era >= 'D') {
    const low = [-0.12, -0.42, -0.14, -40, -30, 40];
    C.lanzar_granada_vm = mk2(1.9, false, {arma: [K(0, P.bajo), K(0.15, low), K(0.85, low), K(1, P.bajo)],
      manoIz: [K(0, GL), K(0.13, GL), K(0.86, GL), K(1, GL)],
      manoDe: [K(0, GR), K(0.12, ['cam', 0.24, -0.55, 0.05, -60, 0, 0, 0.9]), K(0.3, ['cam', 0.16, -0.28, -0.25, -20, 0, 20, 0.95]), K(0.42, ['cam', 0.02, -0.22, -0.32, 0, 0, 0, 0.95]),
        K(0.58, ['cam', 0.3, 0.05, 0.12, 60, 20, 0, 0.95]), K(0.7, ['cam', 0.12, 0.08, -0.45, -40, 0, 0, 0.95]), K(0.76, ['cam', 0.06, -0.05, -0.55, -60, 0, 0, 0.2]), K(0.9, ['cam', 0.25, -0.5, -0.2, -40, 0, 0, 0.6]), K(1, GR)],
      granada: [K(0, ['manoDe', 0.02, -0.01, 0.0, 0, 0, 0, 0]), K(0.14, ['manoDe', 0.02, -0.01, 0.0, 90, 0, 0, 1]), K(0.72, ['manoDe', 0.02, -0.01, 0.0, 90, 0, 0, 1]), K(0.74, ['cam', 0.0, 0.0, -1.4, 40, 0, 0, 1]), K(0.8, ['cam', -0.02, 0.4, -4.0, 200, 0, 0, 0]), K(1, ['cam', 0, 0, -4, 0, 0, 0, 0])],
      cam: [K(0, [0, 0, 0, 1]), K(0.58, [3, 4, 0, 1]), K(0.72, [-3, -2, 0, 1]), K(1, [0, 0, 0, 1])]}, [[0.14, 'granada_saca'], [0.42, 'anilla'], [0.73, 'lanzar']]);
  }
  // curar (venda), herido, muerte, inspeccionar, salto de obstáculo
  C.curar_vm = mk2(3.4, false, {arma: [K(0, P.bajo), K(0.12, P.fuera), K(0.88, P.fuera), K(1, P.bajo)],
    manoDe: [K(0, GR), K(0.14, ['cam', 0.12, -0.36, -0.3, -30, 0, 20, 0.6]), K(0.3, ['cam', -0.02, -0.4, -0.32, -40, 30, 50, 0.6]), K(0.45, ['cam', 0.1, -0.44, -0.28, -30, -20, 20, 0.6]), K(0.6, ['cam', -0.02, -0.4, -0.32, -40, 30, 50, 0.6]), K(0.75, ['cam', 0.1, -0.44, -0.28, -30, -20, 20, 0.6]), K(0.86, ['cam', 0.12, -0.36, -0.3, -30, 0, 20, 0.6]), K(1, GR)],
    manoIz: [K(0, GL), K(0.14, ['cam', -0.1, -0.42, -0.3, -50, 0, -40, 0.4]), K(0.86, ['cam', -0.1, -0.42, -0.3, -50, 0, -40, 0.4]), K(1, GL)],
    venda: [K(0, ['manoDe', 0.0, -0.02, -0.04, 0, 0, 0, 0]), K(0.15, ['manoDe', 0.0, -0.02, -0.04, 0, 0, 0, 1]), K(0.84, ['manoDe', 0.0, -0.02, -0.04, 0, 0, 0, 1]), K(0.86, ['manoDe', 0, 0, 0, 0, 0, 0, 0])],
    cam: [K(0, [0, 0, 0, 1]), K(0.15, [-24, 0, 0, 1]), K(0.85, [-24, 0, 0, 1]), K(1, [0, 0, 0, 1])]}, [[0.15, 'venda'], [0.5, 'curar'], [0.85, 'curado']]);
  C.herido_vm = mk2(1.3, false, {arma: [K(0, P.bajo), K(0.08, [P.bajo[0] + 0.05, P.bajo[1] - 0.12, P.bajo[2] + 0.04, -24, 10, 30]), K(0.6, [P.bajo[0] + 0.04, P.bajo[1] - 0.1, P.bajo[2] + 0.03, -20, 8, 26]), K(1, P.bajo)],
    manoDe: [K(0, GR)], manoIz: [K(0, GL), K(0.1, ['cam', -0.16, -0.48, -0.08, -60, 0, -30, 0.95]), K(0.7, ['cam', -0.15, -0.46, -0.1, -60, 0, -30, 0.95]), K(1, GL)],
    cam: [K(0, [0, 0, 0, 1]), K(0.06, [-8, 3, -6, 1.03]), K(0.4, [-5, 1, -3, 1]), K(1, [0, 0, 0, 1])]}, [[0, 'impacto'], [0.1, 'agarra_herida']]);
  C.muerte_vm = mk2(2.0, false, {arma: [K(0, P.bajo), K(0.15, [0.18, -0.4, -0.05, -40, 20, 50]), K(0.4, [0.3, -1.2, -0.2, -90, 40, 120]), K(1, [0.3, -1.4, -0.2, -90, 40, 120])],
    manoDe: [K(0, GR), K(0.12, ['cam', 0.25, -0.5, -0.1, -40, 0, 0, 0.3]), K(0.5, ['cam', 0.3, -1.1, 0.0, -60, 0, 0, 0.1]), K(1, ['cam', 0.3, -1.2, 0.0, -60, 0, 0, 0.1])],
    manoIz: [K(0, GL), K(0.15, ['cam', -0.2, -0.6, -0.1, -40, 0, 0, 0.2]), K(1, ['cam', -0.3, -1.2, 0.0, -40, 0, 0, 0.1])],
    cam: [K(0, [0, 0, 0, 1]), K(0.1, [-6, 4, -8, 1.04]), K(0.55, [-35, 10, -50, 1.08]), K(0.75, [-60, 14, -78, 1.1]), K(0.8, [-55, 14, -74, 1.1]), K(1, [-58, 14, -76, 1.1])]},
    [[0, 'impacto'], [0.12, 'soltar_arma'], [0.75, 'suelo']], {final: true});
  C.inspeccionar_vm = mk2(3.2, false, {arma: [K(0, P.bajo), K(0.2, [0.05, -0.16, -0.14, 10, -40, -70]), K(0.5, [0.04, -0.15, -0.16, 12, -50, -80]), K(0.7, [0.08, -0.2, -0.1, -10, 30, 20]), K(1, P.bajo)], manoDe: [K(0, GR)], manoIz: [K(0, GL)]}, [[0.2, 'inspeccionar']]);
  C.salto_obstaculo_vm = mk2(0.9, false, {arma: [K(0, P.bajo), K(0.2, [-0.05, -0.12, -0.12, 20, -20, 60]), K(0.55, [-0.06, -0.1, -0.14, 25, -25, 65]), K(0.8, [0.12, -0.3, -0.06, -14, 8, 18]), K(1, P.bajo)],
    manoDe: [K(0, GR)], manoIz: [K(0, GL), K(0.15, ['cam', -0.3, -0.5, -0.45, -80, 0, 0, 0.2]), K(0.6, ['cam', -0.3, -0.62, -0.35, -80, 0, 0, 0.2]), K(0.85, GL), K(1, GL)],
    cam: [K(0, [0, 0, 0, 1]), K(0.3, [-14, 0, 3, 1]), K(0.6, [-6, 0, -2, 1]), K(0.8, [4, 0, 0, 1]), K(1, [0, 0, 0, 1])]}, [[0.25, 'salto'], [0.75, 'aterriza']]);
  if (pist) Object.keys(C).forEach(k => { const c = C[k]; if (c.tracks.manoIz && c.tracks.manoIz.length === 1) c.tracks.manoIz = [K(0, GLp)]; });
  return C;
}
// recargas: una secuencia por mecanismo con eventos en el instante del gesto
function recargaVM(s, P, GR, GL, GLp, era, nation) {
  const C = {}, mk2 = (dur, tracks, ev) => ({dur, loop: false, tracks, ev}), z0 = [0, 0, 0, 0, 0, 0];
  const pouch = ['cam', 0.26, -0.6, -0.05, -70, 0, 20, 0.5], mouth = ['cam', 0.05, -0.17, -0.24, -80, 0, 70, 0.95];
  if (s.acc === 'avancarga') {   // morder, (cebar), verter, baqueta (sacar, girar, atacar dos veces, devolver), (pistón), montar
    const chispa = s.ign === 'chispa', D = chispa ? 8.4 : 7.6, L = s.L, by = s.bore, bq = (z, rx) => [0, 0, z, rx || 0, 0, 0];
    const lowH = [0.06, -0.28, -0.18, -6, 0, 50];                                                    // horizontal a la cintura para cebar
    const t = chispa ? {cebar0: 0.12, cebar1: 0.22, vert: 0.3, verter: 0.36, bq0: 0.42, at1: 0.56, at2: 0.62, bq1: 0.74, mont: 0.86} : {cebar0: 0, cebar1: 0, vert: 0.12, verter: 0.22, bq0: 0.3, at1: 0.46, at2: 0.52, bq1: 0.64, pist0: 0.72, pist1: 0.8, mont: 0.88};
    const boca = s.grips.boca.p, mz = [boca[0] + 0.03, boca[1] + 0.06, boca[2]], S = t.bq1 - t.bq0, F = f => t.bq0 + f * S;
    const arma = [K(0, P.bajo), K(0.05, chispa ? lowH : P.carga)].concat(chispa ? [K(t.cebar1, lowH), K(t.vert, P.carga)] : []).concat([K(t.bq1, P.carga), K(t.pist1 || t.bq1 + 0.04, t.pist0 ? [0.05, -0.3, -0.2, 20, 10, 40] : P.carga), K(t.mont, P.cadera), K(1, P.bajo)]);
    const md = [K(0, GR), K(0.04, pouch), K(0.08, mouth), K(0.1, mouth)];
    if (chispa) md.push(K(t.cebar0, ['arma', 0.06, by + 0.04, -0.03, 0, 0, 90, 0.95]), K(t.cebar1 - 0.03, ['arma', 0.05, by + 0.05, -0.05, 0, 0, 90, 0.95]));
    md.push(K(t.vert + 0.02, ['arma', mz[0], mz[1], mz[2] + 0.02, -90, 0, 0, 0.95]), K(t.verter, ['arma', mz[0], mz[1], mz[2], -90, 0, 0, 0.95]),
      K(F(-0.04), ['baqueta', 0.0, -0.012, -0.9, 0, 0, 0, 0.95]), K(F(0.12), ['baqueta', 0.0, -0.012, -0.9, 0, 0, 0, 0.95]), K(F(0.2), ['baqueta', 0.0, -0.012, -0.485, 0, 0, 0, 0.95]), K(F(0.28), ['baqueta', 0.0, -0.012, -0.485, 0, 0, 0, 0.95]), K(F(0.36), ['baqueta', 0.0, -0.012, -0.04, 0, 0, 0, 0.95]),
      K(F(0.58), ['baqueta', 0.0, -0.012, -0.04, 0, 0, 0, 0.95]), K(F(0.66), ['baqueta', 0.0, -0.012, -0.485, 0, 0, 0, 0.95]), K(F(0.74), ['baqueta', 0.0, -0.012, -0.485, 0, 0, 0, 0.95]), K(F(0.82), ['baqueta', 0.0, -0.012, -0.9, 0, 0, 0, 0.95]), K(F(0.94), ['baqueta', 0.0, -0.012, -0.9, 0, 0, 0, 0.95]), K(F(0.98), ['arma', 0.02, by - 0.06, L + 0.3, 0, 0, 40, 0.9]));
    if (t.pist0) md.push(K(t.pist0, pouch), K(t.pist1, ['arma', 0.035, by + 0.03, -0.03, 0, 0, 70, 0.95]));
    md.push(K(t.mont - 0.02, ['arma', 0.03, by + 0.04, 0.08, 0, 0, 60, 0.9]), K(t.mont + 0.04, GR), K(1, GR));
    // baqueta: sale de los abrazaderas, se gira y entra por la boca (eje del ánima), ataca dos veces y vuelve
    const up = L - 0.99, out = -1.0;
    const baq = [K(0, bq(0)), K(F(0), bq(0)), K(F(0.12), bq(-1.0)), K(F(0.2), [0, -0.485, -1.485, 90, 0, 0]), K(F(0.28), [0, 0.024, -1.97, 180, 0, 0]), K(F(0.36), [0, 0.024, -1.32, 180, 0, 0]),
      K(t.at1, [0, 0.024, -1.08, 180, 0, 0]), K(F(0.5), [0, 0.024, -1.25, 180, 0, 0]), K(t.at2, [0, 0.024, -1.08, 180, 0, 0]), K(F(0.66), [0, 0.024, -1.97, 180, 0, 0]), K(F(0.74), [0, -0.485, -1.485, 90, 0, 0]), K(F(0.82), bq(-1.0)), K(F(0.94), bq(0)), K(1, bq(0))];
    void up;
    const tr = {arma, manoDe: md, manoIz: [K(0, GL), K(0.05, ['arma', s.grips.guardamanos.p[0], s.grips.guardamanos.p[1], s.grips.guardamanos.p[2] + 0.12, 0, 0, 80, 0.85]), K(t.mont, ['arma', s.grips.guardamanos.p[0], s.grips.guardamanos.p[1], s.grips.guardamanos.p[2] + 0.12, 0, 0, 80, 0.85]), K(1, GL)],
      baqueta: baq, martillo: [K(0, [-38]), K(0.06, [-20]), K(t.mont - 0.03, [-20]), K(t.mont, [0]), K(1, [0])],
      cartucho: [K(0, ['manoDe', 0, 0, 0, 0, 0, 0, 0]), K(0.04, ['manoDe', 0.0, -0.02, 0.0, 0, 0, 90, 1]), K(t.verter + 0.02, ['manoDe', 0.0, -0.02, 0.0, 0, 0, 90, 1]), K(t.verter + 0.03, ['manoDe', 0, 0, 0, 0, 0, 0, 0]), K(1, ['manoDe', 0, 0, 0, 0, 0, 0, 0])],
      cam: [K(0, [0, 0, 0, 1]), K(0.08, [-6, 0, 0, 1]), K(0.12, [-10, 0, 0, 1]), K(0.3, [-4, 0, 0, 1]), K(0.5, [2, 0, 0, 1]), K(t.mont, [0, 0, 0, 1]), K(1, [0, 0, 0, 1])]};
    if (chispa) tr.bateria = [K(0, [-70]), K(t.cebar1 - 0.02, [-70]), K(t.cebar1, [0]), K(1, [0])];
    const ev = [[0.04, 'cartucho'], [0.09, 'morder']].concat(chispa ? [[t.cebar0 + 0.03, 'cebar'], [t.cebar1, 'bateria']] : []).concat([[t.verter, 'carga'], [F(0.12), 'baqueta'], [t.at1, 'atacar'], [t.at2, 'atacar'], [F(0.94), 'baqueta']])
      .concat(t.pist0 ? [[t.pist1, 'piston']] : []).concat([[t.mont, 'montar'], [0.97, 'listo']]);
    C.recargar_vm = mk2(D, tr, ev);
  } else if (s.acc === 'cerrojo_simple' || s.acc === 'trampilla' || s.acc === 'palanca' || s.acc === 'cerrojo_tubo' || s.acc === 'cerrojo_peine') {
    const tubo = s.acc === 'cerrojo_tubo', peine = s.acc === 'cerrojo_peine', D = peine ? 3.2 : tubo ? 4.6 : 2.7, by = s.bore;
    const open = s.acc === 'trampilla' ? [0, 0, 0, -120, 0, 0] : s.acc === 'palanca' ? [0, -0.03, 0, -18, 0, 0] : [0, 0, 0.1, 0, 0, 62];
    const rot = s.acc === 'trampilla' || s.acc === 'palanca' ? open : [0, 0, 0, 0, 0, 62];
    const ins = peine ? ['arma', 0.0, by + 0.075, 0.02, 0, 0, 0, 0.85] : ['arma', 0.02, by + 0.04, -0.06, 0, 0, 80, 0.9];
    const T = {open: 0.12, back: 0.2, pouch: 0.32, at: 0.45, push: 0.55, close: 0.8, home: 0.92}; if (tubo) Object.assign(T, {at: 0.36, push: 0.42, close: 0.86});
    const md = [K(0, GR), K(0.06, ['cerrojo', 0.075, -0.02, 0.078, 0, 0, 30, 0.6]), K(T.back + 0.03, ['cerrojo', 0.075, -0.02, 0.078, 0, 0, 30, 0.6]), K(T.pouch, pouch), K(T.at, ins)];
    if (peine) md.push(K(T.push, ['arma', 0.0, by + 0.035, 0.02, 0, 0, 0, 0.7]), K(T.push + 0.06, ['arma', 0.0, by + 0.02, 0.02, 0, 0, 0, 0.7]));
    if (tubo) [0.52, 0.64].forEach(f => md.push(K(f - 0.06, pouch), K(f, ins)));
    md.push(K(T.close - 0.06, ['cerrojo', 0.075, -0.02, 0.078, 0, 0, 30, 0.6]), K(T.close, ['cerrojo', 0.075, -0.02, 0.078, 0, 0, 30, 0.6]), K(T.home, GR), K(1, GR));
    const tr = {arma: [K(0, P.bajo), K(0.08, P.cerrojo), K(T.home - 0.04, P.cerrojo), K(1, P.bajo)], manoDe: md, manoIz: [K(0, GL)],
      cerrojo: [K(0, z0), K(0.06, z0), K(T.open, rot), K(T.back, open), K(T.close - 0.12, open), K(T.close - 0.05, rot), K(T.close, z0), K(1, z0)],
      cartucho: peine ? undefined : [K(0, ['manoDe', 0, 0, 0, 0, 0, 0, 0]), K(T.pouch, ['manoDe', 0.0, -0.02, -0.01, 0, 0, 0, 1]), K(T.at + 0.02, ['manoDe', 0.0, -0.02, -0.01, 0, 0, 0, 1]), K(T.at + 0.03, ['manoDe', 0, 0, 0, 0, 0, 0, 0]), K(1, ['manoDe', 0, 0, 0, 0, 0, 0, 0])],
      peine: peine ? [K(0, ['manoDe', 0, 0, 0, 0, 0, 0, 0]), K(T.pouch, ['manoDe', 0.0, -0.025, -0.01, 0, 90, 0, 1]), K(T.at, ['manoDe', 0.0, -0.025, -0.01, 0, 90, 0, 1]), K(T.at + 0.01, ['arma', 0, by + 0.07, 0.02, 0, 90, 0, 1]), K(T.push + 0.06, ['arma', 0, by + 0.07, 0.02, 0, 90, 0, 1]), K(T.push + 0.1, ['arma', 0.05, by + 0.12, 0.05, 60, 90, 40, 1]), K(T.push + 0.2, ['cam', 0.3, -0.9, 0.0, 120, 0, 0, 0]), K(1, ['cam', 0.3, -0.9, 0.0, 0, 0, 0, 0])] : undefined,
      cam: [K(0, [0, 0, 0, 1]), K(0.1, [-3, -2, 1, 1]), K(T.home, [-3, -2, 1, 1]), K(1, [0, 0, 0, 1])]};
    if (s.acc === 'palanca') tr.palanca = [K(0, [0]), K(T.open, [50]), K(T.close - 0.05, [50]), K(T.close, [0]), K(1, [0])];
    Object.keys(tr).forEach(k => tr[k] === undefined && delete tr[k]);
    const ev = [[T.open, s.acc === 'palanca' ? 'palanca' : 'cerrojo'], [T.back, 'casquillo'], [T.pouch, peine ? 'peine' : 'cartucho'], [T.at + 0.02, 'carga']].concat(peine ? [[T.push + 0.06, 'carga'], [T.push + 0.12, 'peine_fuera']] : []).concat(tubo ? [[0.52, 'carga'], [0.64, 'carga']] : []).concat([[T.close, 'cerrojo'], [0.97, 'listo']]);
    C.recargar_vm = mk2(D, tr, ev);
  } else if (s.acc === 'semi_enbloc') {   // Garand: el clip vacío sale con el «ping», se mete el nuevo y el cerrojo se cierra solo
    const by = s.bore;
    C.recargar_vm = mk2(2.4, {arma: [K(0, P.bajo), K(0.08, P.cerrojo), K(0.85, P.cerrojo), K(1, P.bajo)],
      manoDe: [K(0, GR), K(0.25, pouch), K(0.48, ['arma', 0.0, by + 0.08, 0.02, 0, 0, 0, 0.85]), K(0.58, ['arma', 0.0, by + 0.02, 0.02, 0, 0, 0, 0.6]), K(0.64, ['arma', 0.04, by + 0.07, 0.05, 0, 0, 0, 0.6]), K(0.7, ['cerrojo', 0.04, -0.01, 0.03, 0, 0, 30, 0.7]), K(0.8, GR), K(1, GR)],
      manoIz: [K(0, GL)], cerrojo: [K(0, [0, 0, 0.09, 0, 0, 0]), K(0.6, [0, 0, 0.09, 0, 0, 0]), K(0.63, [0, 0, 0, 0, 0, 0]), K(1, z0)],
      peine: [K(0, ['arma', 0, by + 0.05, 0.02, 0, 90, 0, 1]), K(0.04, ['arma', 0, by + 0.05, 0.02, 0, 90, 0, 1]), K(0.12, ['cam', 0.1, 0.3, -0.4, 200, 90, 0, 1]), K(0.2, ['cam', 0.2, 0.2, -0.6, 400, 90, 0, 0]), K(0.24, ['manoDe', 0.0, -0.025, -0.01, 0, 90, 0, 1]), K(0.52, ['manoDe', 0.0, -0.025, -0.01, 0, 90, 0, 1]), K(0.55, ['arma', 0, by + 0.0, 0.02, 0, 90, 0, 1]), K(1, ['arma', 0, by + 0.0, 0.02, 0, 90, 0, 0])]},
      [[0.03, 'ping'], [0.25, 'peine'], [0.56, 'carga'], [0.63, 'cerrojo'], [0.97, 'listo']]);
  } else {   // cargador extraíble: subfusil, SVT/G43, pistola
    const by = s.bore, sock = s.grips.cargador.p, out = [sock[0], sock[1] - 0.2, sock[2] + 0.05];
    C.recargar_vm = mk2(s.acc === 'pistola' ? 1.5 : 2.2, {arma: [K(0, P.bajo), K(0.1, P.cerrojo), K(0.82, P.cerrojo), K(1, P.bajo)],
      manoDe: [K(0, GR)],
      manoIz: [K(0, GLp), K(0.12, ['cargador', 0.0, -0.06, 0.0, 0, 0, -40, 0.8]), K(0.22, ['cargador', 0.0, -0.06, 0.0, 0, 0, -40, 0.8]), K(0.36, ['cam', -0.2, -0.6, -0.05, -60, 0, -20, 0.6]), K(0.52, ['arma', out[0], out[1] + 0.05, out[2], 0, 0, -40, 0.85]), K(0.62, ['cargador', 0.0, -0.06, 0.0, 0, 0, -40, 0.8]),
        K(0.72, ['cerrojo', -0.04, 0.0, 0.02, 0, 0, -30, 0.7]), K(0.8, ['cerrojo', -0.04, 0.0, 0.02, 0, 0, -30, 0.7]), K(0.9, GLp), K(1, GLp)],
      cargador: [K(0, ['arma', 0, 0, 0, 0, 0, 0, 1]), K(0.2, ['arma', 0, 0, 0, 0, 0, 0, 1]), K(0.26, ['arma', 0, -0.12, 0.03, -10, 0, 0, 1]), K(0.34, ['cam', 0.0, -1.2, -0.2, -60, 0, 0, 1]), K(0.4, ['cam', 0.0, -1.2, -0.2, -60, 0, 0, 0]),
        K(0.41, ['manoIz', 0.0, 0.06, 0.0, 0, 0, 40, 1]), K(0.52, ['manoIz', 0.0, 0.06, 0.0, 0, 0, 40, 1]), K(0.6, ['arma', 0, -0.04, 0.0, 0, 0, 0, 1]), K(0.64, ['arma', 0, 0, 0, 0, 0, 0, 1]), K(1, ['arma', 0, 0, 0, 0, 0, 0, 1])],
      cerrojo: [K(0, z0), K(0.74, z0), K(0.78, [0, 0, s.acc === 'pistola' ? 0.05 : 0.08, 0, 0, 0]), K(0.81, z0), K(1, z0)],
      cam: [K(0, [0, 0, 0, 1]), K(0.3, [-3, 1, 2, 1]), K(0.62, [-1, 0, 0, 1]), K(1, [0, 0, 0, 1])]},
      [[0.24, 'cargador_fuera'], [0.4, 'cargador_suelo'], [0.62, 'carga'], [0.78, 'cerrojo'], [0.97, 'listo']]);
  }
  return C;
}

/* ---------- tiempo de ejecución ---------- */
const _vmM = new THREE.Matrix4(), _vmM2 = new THREE.Matrix4(), _vmQ = new THREE.Quaternion(), _vmQ2 = new THREE.Quaternion(), _vmE = new THREE.Euler(), _vmV = new THREE.Vector3(), _vmV2 = new THREE.Vector3(), _vmS = new THREE.Vector3(1, 1, 1);
const VM_SPACES = ['cam', 'arma', 'manoDe', 'manoIz', 'baqueta', 'cerrojo', 'cargador'];
function vmCompose(out, x, y, z, rx, ry, rz) { _vmE.set(rx * D2R, ry * D2R, rz * D2R, 'XYZ'); _vmQ.setFromEuler(_vmE); _vmV.set(x, y, z); return out.compose(_vmV, _vmQ, _vmS); }
// TroopViewmodel({nation, era, rol: 'fusil' | 'subfusil' | 'semi' | 'pistola', skin: 0..3, arma: id opcional})
function TroopViewmodel(o) {
  o = o || {}; this.nation = o.nation || 'GEN'; this.era = o.era || 'D'; this.rol = o.rol || 'fusil';
  this.armId = o.arma || troopArm(this.nation, this.era, this.rol); const A = TROOP_ARMS[this.armId], era = this.era;
  const pal = uniformPalette(this.nation, era, 'linea'), skin = new THREE.Color(SKIN[o.skin || 0]).getHex(), eq = pal.modelo && pal.modelo.equipo;
  let body, moving, spec;
  if (A.accion === 'subfusil') ({body, moving, spec} = vmBuildSMG(this.armId));
  else if (A.accion === 'pistola') ({body, moving, spec} = vmBuildPistol());
  else { spec = vmRifleSpec(this.armId); body = vmBuildRifle(spec); moving = vmBuildMoving(spec); if (moving.baqueta) moving.baqueta.at = [0, spec.bore - 0.024, spec.L + 0.99]; }
  this.spec = spec; this.arm = A;
  this.mat = new THREE.MeshLambertMaterial({vertexColors: true}); this.mat.name = 'troop_viewmodel';
  const mesh = (B, name) => { const m = new THREE.Mesh(vmGeo(B, pal), this.mat); m.name = name; m.frustumCulled = false; m.renderOrder = 10; return m; };
  this.group = new THREE.Group(); this.group.name = 'viewmodel';
  this.rig = new THREE.Group(); this.group.add(this.rig);                                   // balanceo, puntería y retroceso
  this.weapon = new THREE.Group(); this.weapon.add(mesh(body, 'arma')); this.rig.add(this.weapon); this.weapon.matrixAutoUpdate = false;
  this.parts = {};
  Object.keys(moving).forEach(k => { const g = new THREE.Group(), m = mesh(moving[k].g, k); g.add(m); g.userData.at = moving[k].at; g.matrixAutoUpdate = false; (k === 'cargador' ? this.rig : this.weapon).add(g); this.parts[k] = g; });
  const props = vmProps(era, this.nation, spec); this.props = {};
  Object.keys(props).forEach(k => { const g = new THREE.Group(); g.add(mesh(props[k], k)); g.visible = false; g.matrixAutoUpdate = false; this.rig.add(g); this.props[k] = g; });
  const cuff = era === 'A' || era === 'B' || era === 'C';
  this.hands = {De: new THREE.Group(), Iz: new THREE.Group()}; this.handCurl = {De: 1, Iz: 1};
  this.handMesh = {De: [0, 0.35, 0.7, 1].map(c => mesh(vmBuildHand(c, false, skin, cuff), 'manoDe')), Iz: [0, 0.35, 0.7, 1].map(c => mesh(vmBuildHand(c, true, skin, cuff), 'manoIz'))};   // 4 grados de cierre
  ['De', 'Iz'].forEach(s => { this.handMesh[s].forEach((m, i) => { m.visible = i === 3; this.hands[s].add(m); }); this.hands[s].matrixAutoUpdate = false; this.rig.add(this.hands[s]); });
  this.L1 = 0.31; this.L2 = 0.29; this.shoulder = {De: new THREE.Vector3(0.2, -0.32, 0.1), Iz: new THREE.Vector3(-0.2, -0.32, 0.1)};
  this.armSeg = {}; ['De', 'Iz'].forEach(s => { const u = mesh(vmArmGeo(this.L1, 0.058, 0.05, Z.MAIN), 'brazo' + s), f = mesh(vmArmGeo(this.L2, 0.05, 0.042, Z.MAIN), 'antebrazo' + s);
    u.matrixAutoUpdate = f.matrixAutoUpdate = false; this.rig.add(u, f); this.armSeg[s] = {u, f}; });
  this.chest = mesh(vmChest(era, eq), 'pecho'); this.group.add(this.chest);
  this.clips = vmClipSet(spec, era, this.nation); this.cur = null; this.t = 0; this.prev = null; this.blend = 0; this.queue = [];
  this.listeners = []; this.aimYaw = 0; this.aimPitch = 0; this.sway = new THREE.Vector2(); this.swayV = new THREE.Vector2(); this.camOut = {rx: 0, ry: 0, rz: 0, fov: 1};
  this.tris = 0; this.group.traverse(m => { if (m.isMesh && m.visible !== false && !/^(manoDe|manoIz)$/.test(m.name)) this.tris += m.geometry.attributes.position.count / 3; });
  this.tris += (this.handMesh.De[3].geometry.attributes.position.count + this.handMesh.Iz[3].geometry.attributes.position.count) / 3;
  this.play('idle_vm');
}
TroopViewmodel.prototype.on = function (fn) { this.listeners.push(fn); return this; };
// play(clip, {blend: s, next: clip al acabar}) · los clips sin bucle vuelven a o.next o al reposo
TroopViewmodel.prototype.play = function (name, o) {
  o = o || {}; const c = this.clips[name]; if (!c) return false;
  if (this.cur) { this.prev = {c: this.cur, t: this.t, snap: this.snapshot()}; this.blend = o.blend != null ? o.blend : 0.14; this.blendT = 0; }
  this.cur = c; this.curName = name; this.t = 0; this.next = o.next || (c.loop ? null : c.final ? null : 'idle_vm'); this._lastPh = -1; return true;
};
TroopViewmodel.prototype.clipNames = function () { return Object.keys(this.clips); };
TroopViewmodel.prototype.clipInfo = function (n) { const c = this.clips[n]; return c && {dur: c.dur, loop: !!c.loop, events: c.ev.map(e => ({t: e[0] * c.dur, fase: e[0], evento: e[1]}))}; };
// setAim(guiñada, cabeceo): mezcla de puntería aditiva (±35° / ±45°) alrededor del pecho; look(dx, dy): retraso por el giro de la cámara
TroopViewmodel.prototype.setAim = function (yaw, pitch) { this.aimYaw = Math.max(-35, Math.min(35, yaw || 0)); this.aimPitch = Math.max(-45, Math.min(45, pitch || 0)); };
TroopViewmodel.prototype.look = function (dx, dy) { this.swayV.x -= dx * 0.6; this.swayV.y -= dy * 0.6; };
TroopViewmodel.prototype.snapshot = function () { return {w: this.weapon.matrix.clone(), De: this.hands.De.matrix.clone(), Iz: this.hands.Iz.matrix.clone()}; };
const _vmOut = new Float32Array(8);
function vmSample(tr, ph, n, loop) { const old = _loopCur; _loopCur = loop; sampleTrack(tr, ph, _vmOut, n); _loopCur = old; return _vmOut; }
// matriz (espacio de cámara) de un espacio en el instante actual
TroopViewmodel.prototype._space = function (name) { if (name === 'cam') return null; if (name === 'arma') return this.weapon.matrix; if (name === 'manoDe') return this.hands.De.matrix; if (name === 'manoIz') return this.hands.Iz.matrix;
  const g = this.parts[name]; if (!g) return null; return g.parent === this.weapon ? new THREE.Matrix4().multiplyMatrices(this.weapon.matrix, g.matrix) : g.matrix; };
// pista de espacio mixto → posición, rotación y valor extra en espacio de cámara
TroopViewmodel.prototype._mixed = function (tr, ph, loop, outM) {
  const n = tr.length; let k = 0; while (k < n - 1 && tr[k + 1][0] <= ph) k++;
  const a = tr[k], b = tr[Math.min(n - 1, k + 1)], h = Math.max(1e-6, b[0] - a[0]), u = n === 1 ? 0 : Math.min(1, Math.max(0, (ph - a[0]) / h)), e = u * u * (3 - 2 * u);
  const conv = (key, m) => { vmCompose(m, key[2], key[3], key[4], key[5], key[6], key[7]); const S = this._space(key[1]); if (S) m.premultiply(S); return m; };
  const mA = conv(a, new THREE.Matrix4()), mB = conv(b, new THREE.Matrix4());
  // posición: cúbica monótona sobre las claves convertidas (los cambios de agarre siguen siendo suaves)
  const conv3 = tr.map(q => { const m = conv(q, _vmM); return [q[0], m.elements[12], m.elements[13], m.elements[14], q[8]]; });
  const p = vmSample(conv3, ph, 4, loop);
  const qa = new THREE.Quaternion().setFromRotationMatrix(mA), qb = new THREE.Quaternion().setFromRotationMatrix(mB); qa.slerp(qb, e);
  outM.compose(_vmV.set(p[0], p[1], p[2]), qa, _vmS); return p[3];
};
TroopViewmodel.prototype.update = function (dt, input) {
  input = input || {}; const c = this.cur; if (!c) return;
  this.t += dt; let ph = this.t / c.dur;
  if (ph >= 1 && !c.loop) { // eventos que faltan y paso al siguiente
    this._events(this._lastPh, 1); if (this.next) { const n = this.next; this.play(n); return this.update(0, input); } ph = 1; }
  if (c.loop) ph -= Math.floor(ph);
  if (c.loop && ph < this._lastPh) { this._events(this._lastPh, 1.0001); this._lastPh = -1e-6; }
  this._events(this._lastPh, ph); this._lastPh = ph;
  const loop = !!c.loop, T = c.tracks;
  // arma
  const a = vmSample(T.arma, ph, 6, loop); vmCompose(this.weapon.matrix, a[0], a[1], a[2], a[3], a[4], a[5]);
  // piezas móviles (en el espacio del arma, salvo el cargador que puede salir del arma)
  Object.keys(this.parts).forEach(k => { const g = this.parts[k], at = g.userData.at; let v;
    if (k === 'cargador' && T.cargador) { const vis = this._mixed(T.cargador, ph, loop, g.matrix); const m0 = vmCompose(_vmM, at[0], at[1], at[2], 0, 0, 0); g.matrix.multiply(m0); g.visible = vis > 0.5; return; }
    if (k === 'cargador') { g.matrix.multiplyMatrices(this.weapon.matrix, vmCompose(_vmM, at[0], at[1], at[2], 0, 0, 0)); g.visible = true; return; }
    if (T[k] && (k === 'martillo' || k === 'bateria' || k === 'palanca')) { v = vmSample(T[k], ph, 1, loop); vmCompose(g.matrix, at[0], at[1], at[2], v[0], 0, 0); }
    else if (T[k]) { v = vmSample(T[k], ph, 6, loop); vmCompose(g.matrix, at[0] + v[0], at[1] + v[1], at[2] + v[2], v[3], v[4], v[5]); }
    else vmCompose(g.matrix, at[0], at[1], at[2], 0, 0, 0); });
  // manos (después de arma y piezas) y accesorios
  ['De', 'Iz'].forEach(s => { const tr = T['mano' + s]; if (!tr) return; const curl = this._mixed(tr, ph, loop, this.hands[s].matrix); this.handCurl[s] = curl;
    const lvl = Math.max(0, Math.min(3, Math.round(curl * 3))); this.handMesh[s].forEach((m, i) => { m.visible = i === lvl; }); });
  Object.keys(this.props).forEach(k => { const g = this.props[k], tr = T[k]; if (!tr) { g.visible = false; return; } const vis = this._mixed(tr, ph, loop, g.matrix); g.visible = vis > 0.5; });
  // mezcla con el clip anterior (posición de arma y manos)
  if (this.prev && this.blendT < this.blend) { this.blendT += dt; const k = Math.min(1, this.blendT / this.blend), e = k * k * (3 - 2 * k);
    [[this.weapon.matrix, this.prev.snap.w], [this.hands.De.matrix, this.prev.snap.De], [this.hands.Iz.matrix, this.prev.snap.Iz]].forEach(([m, p]) => { const pa = new THREE.Vector3(), qa = new THREE.Quaternion(), pb = new THREE.Vector3(), qb = new THREE.Quaternion(), sc = new THREE.Vector3();
      p.decompose(pa, qa, sc); m.decompose(pb, qb, sc); pa.lerp(pb, e); qa.slerp(qb, e); m.compose(pa, qa, _vmS); });
    if (k >= 1) this.prev = null; }
  // brazos por IK (hombro fijo → muñeca de cada mano), con un estiramiento máximo del 8 % para no separar la mano del antebrazo
  ['De', 'Iz'].forEach(s => { const H = this.hands[s].matrix, wrist = _vmV.set(s === 'De' ? 0.055 : -0.055, -0.006, 0.15).applyMatrix4(H).clone();
    this._ik(s, this.shoulder[s], wrist); });
  // cámara: patada, balanceo y FOV del clip
  if (T.cam) { const cm = vmSample(T.cam, ph, 4, loop); this.camOut.rx = cm[0]; this.camOut.ry = cm[1]; this.camOut.rz = cm[2]; this.camOut.fov = cm[3] || 1; } else { this.camOut.rx = this.camOut.ry = this.camOut.rz = 0; this.camOut.fov = 1; }
  // balanceo por giro de cámara (muelle) + mezcla de puntería
  const sp = this.sway, sv = this.swayV; sv.x += (-sp.x * 60 - sv.x * 11) * dt; sv.y += (-sp.y * 60 - sv.y * 11) * dt; sp.x += sv.x * dt; sp.y += sv.y * dt;
  const mv = input.mover || 0, tt = performance.now ? performance.now() / 1000 : 0;
  this.rig.position.set(sp.x * 0.004, sp.y * 0.004 - (input.agachado ? 0.01 : 0), 0);
  this.rig.rotation.set((this.aimPitch * 0.25 + sp.y * 0.6) * D2R, (this.aimYaw * 0.25 + sp.x * 0.6) * D2R, (sp.x * 0.8) * D2R, 'YXZ');
  this.chest.position.set(0, mv * 0.01 * Math.sin(tt * 9), 0);
};
TroopViewmodel.prototype._ik = function (s, S, W) {
  const L1 = this.L1, L2 = this.L2; let d = _vmV2.subVectors(W, S), dist = d.length();
  if (dist > (L1 + L2) * 0.97) { S = S.clone().addScaledVector(d.clone().normalize(), Math.min(0.6, dist - (L1 + L2) * 0.97)); d = _vmV2.subVectors(W, S); dist = d.length(); }
  const dir = d.clone().normalize();
  const st = Math.min(1.08, Math.max(1, dist / (L1 + L2 - 1e-3))), l1 = L1 * st, l2 = L2 * st; dist = Math.min(l1 + l2 - 1e-4, Math.max(Math.abs(l1 - l2) + 1e-3, dist));
  const ca = (l1 * l1 + dist * dist - l2 * l2) / (2 * l1 * dist), sa = Math.sqrt(Math.max(0, 1 - ca * ca));
  const pole = new THREE.Vector3(s === 'De' ? 0.7 : -0.7, -1, 0.35).normalize(); pole.addScaledVector(dir, -pole.dot(dir)).normalize();
  const E = S.clone().addScaledVector(dir, l1 * ca).addScaledVector(pole, l1 * sa), Wc = S.clone().addScaledVector(dir, dist);
  const seg = (m, A, B, len, sc) => { const v = B.clone().sub(A).normalize(); _vmQ2.setFromUnitVectors(new THREE.Vector3(0, 0, -1), v); m.matrix.compose(A, _vmQ2, new THREE.Vector3(1, 1, sc)); };
  seg(this.armSeg[s].u, S, E, l1, st); seg(this.armSeg[s].f, E, Wc, l2, st); this.ikErr = Math.max(this.ikErr || 0, Wc.distanceTo(W));
};
TroopViewmodel.prototype._events = function (a, b) { const c = this.cur; c.ev.forEach(([t, n]) => { if (t > a && t <= b) this.listeners.forEach(fn => fn(n, {clip: this.curName, t: t * c.dur, arma: this.armId})); }); };
// dibujo en un segundo pase: misma orientación que la cámara del juego, near 0,05, sin el escenario
TroopViewmodel.prototype.render = function (renderer, gameCam) {
  if (!this.scene) { this.scene = new THREE.Scene(); this.scene.add(this.group); this.cam = new THREE.PerspectiveCamera(62, 1, 0.05, 10);
    const hl = new THREE.HemisphereLight(0xfff4e0, 0x404438, 0.85), dl = new THREE.DirectionalLight(0xfff2e0, 0.75); dl.position.set(0.5, 1, 0.3); this.scene.add(hl, dl); }
  this.cam.aspect = gameCam.aspect; this.cam.fov = (gameCam.fov || 70) * 0.9 * this.camOut.fov; this.cam.updateProjectionMatrix();
  const ac = renderer.autoClear; renderer.autoClear = false; renderer.clearDepth(); renderer.render(this.scene, this.cam); renderer.autoClear = ac;
};
TroopViewmodel.prototype.dispose = function () { this.group.traverse(m => { if (m.isMesh) m.geometry.dispose(); }); this.mat.dispose(); };
// posición de la boca del arma de una figura instanciada (para el fogonazo y el humo): kind, era, clip, fase y matriz de la instancia
const _muzOut = new Float32Array(MAXP * 16);
function troopMuzzle(kind, era, clip, phase, world, out) {
  const K = KINDS[kind]; if (!K || !CLIPS[K.rig] || !CLIPS[K.rig][clip]) return null; const ix = rigIndex(K.rig).arma; if (ix == null) return null;
  poseTroop(K.rig, clip, phase, _muzOut); const L = /mosquete/.test(K.arma || '') || era < 'C' ? 1.5 : 1.22, o = ix * 16, m = _muzOut;
  const v = (out || new THREE.Vector3()).set(m[o + 4] * L + m[o + 12], m[o + 5] * L + m[o + 13], m[o + 6] * L + m[o + 14]); return world ? v.applyMatrix4(world) : v;
}
// boca del arma (o expulsión) en espacio de cámara → con la matriz de la cámara del juego pasa a mundo
TroopViewmodel.prototype.muzzle = function (out, world) { this.rig.updateMatrix(); const v = (out || new THREE.Vector3()).set(0, this.spec.bore, this.spec.L).applyMatrix4(this.weapon.matrix).applyMatrix4(this.rig.matrix); return world ? v.applyMatrix4(world) : v; };
TroopViewmodel.prototype.ejectPort = function (out, world) { this.rig.updateMatrix(); const v = (out || new THREE.Vector3()).set(0.03, this.spec.bore, 0.0).applyMatrix4(this.weapon.matrix).applyMatrix4(this.rig.matrix); return world ? v.applyMatrix4(world) : v; };
