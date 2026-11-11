
/* ---------------- LOD 1 (medio) y LOD 2 (silueta) ---------------- */
// Mismo esqueleto que el LOD0: la animación horneada sirve para los tres niveles.
const HAT_LOD = {   // [ancho, alto, fondo], y del centro, zona, color fijo
  chaco: [[0.28, 0.22, 0.28], 0.36, Z.HAT], kepi: [[0.26, 0.15, 0.27], 0.32, Z.HAT], pickel: [[0.3, 0.2, 0.32], 0.33, Z.FIX, C.negro], pickel_pen: [[0.3, 0.26, 0.32], 0.36, Z.FIX, C.negro],
  brodie: [[0.42, 0.08, 0.42], 0.29, Z.HAT], adrian: [[0.34, 0.14, 0.4], 0.31, Z.HAT], stahl: [[0.36, 0.18, 0.38], 0.29, Z.HAT], gorra: [[0.32, 0.08, 0.34], 0.32, Z.HAT],
  gorra_rusa: [[0.28, 0.09, 0.28], 0.3, Z.HAT], salacot: [[0.36, 0.17, 0.42], 0.32, Z.HAT], fez: [[0.22, 0.16, 0.22], 0.32, Z.HAT], sombrero: [[0.46, 0.1, 0.46], 0.3, Z.HAT],
  bersagliere: [[0.42, 0.1, 0.42], 0.3, Z.FIX, C.negro], osos: [[0.32, 0.38, 0.32], 0.43, Z.FIX, C.negro], colback: [[0.28, 0.24, 0.28], 0.37, Z.FIX, C.negro],
  casco_cor: [[0.3, 0.2, 0.34], 0.33, Z.FIX, C.acero], casco_dragon: [[0.3, 0.2, 0.34], 0.33, Z.FIX, C.laton], czapka: [[0.28, 0.24, 0.28], 0.37, Z.HAT],
  qing: [[0.44, 0.12, 0.44], 0.3, Z.HAT], kabalak: [[0.3, 0.13, 0.3], 0.31, Z.HAT], bicornio: [[0.44, 0.16, 0.12], 0.34, Z.FIX, C.negro]};
const WEAPON_LOD = {mosquete: 1.94, fusil: 1.5, espada: 0.84, sable: 0.9, astil: 2.9, lanza: 2.9, astil_jinete: 2.8, escobillon: 2.1, espeque: 1.0, botafuego: 0.9, pala: 1.1, baston: 0.4};
function lodHat(g, part, toc, top) {
  const h = HAT_LOD[toc] || HAT_LOD.chaco, [s, y, z, c] = h;
  if (top) { const w = s[0] / 2, d = s[2] / 2, yy = y + s[1] / 2; g.quad([-w, yy, d], [w, yy, d], [w, yy, -d], [-w, yy, -d], part, z, c || 0); return; }
  g.box(part, z, c || 0, [0, y, 0], s);
}
function lodWeapon(g, a, w, o) {
  const L = WEAPON_LOD[w]; if (!L) return;
  if (w === 'astil' || w === 'astil_jinete') { const y0 = w === 'astil' ? 2.86 : 1.94, lay = o.flagLayout;
    g.cyl(a, Z.FIX, C.madera, [0, L / 2, 0], 0.03, 0.03, L, 3);
    if (lay === 'horiz') g.sheet(a, [0.02, y0, 0], 1.0, 0.7, 1, 3, (i, j) => Z.F1 + j); else g.sheet(a, [0.02, y0, 0], 1.0, 0.7, 3, 1, (i, j) => flagZone(lay)(i, 0)); return; }
  g.cyl(a, Z.FIX, w === 'espada' || w === 'sable' ? 0xd8dce0 : C.maderaO, [0, L / 2 - (w === 'lanza' ? 0.4 : 0), 0], 0.03, 0.02, L, 3);
}
function lodSoldier(o, lvl) {
  const g = new GeoBuilder(), P = rigIndex('soldado');
  if (lvl === 2) {                                                         // silueta: 8 + 2 triángulos
    g.box(P.torso, Z.MAIN, 0, [0, -0.08, 0.0], [0.42, 1.84, 0.26], {noTop: true, taper: -0.12});
    lodHat(g, P.cabeza, o.toc, true); return g;
  }
  g.box(P.torso, Z.MAIN, 0, [0, 0.12, 0], [0.44, 0.8, 0.25], {taper: -0.05});                                // 10
  g.octa(P.cabeza, Z.FIX, C.piel, [0, 0.12, 0.005], 0.13, {ry: 0.14, vr: V.SKIN});                            // 8
  if (o.toc) lodHat(g, P.cabeza, o.toc);                                                                       // 10
  ['musloIz', 'musloDe'].forEach(k => g.cyl(P[k], Z.ACC, 0, [0, -0.43, 0.01], 0.06, 0.085, 0.9, 3));          // 12
  if (!o.unBrazo) ['brazoIz'].forEach(k => g.cyl(P[k], Z.MAIN, 0, [0, -0.26, 0], 0.05, 0.065, 0.56, 3));        // 6
  g.cyl(P.brazoDe, Z.MAIN, 0, [0, -0.26, 0], 0.05, 0.065, 0.56, 3);                                           // 6
  lodWeapon(g, P.arma, o.arma, o);                                                                             // 6 (bandera 12)
  if (o.arma === 'camilla') g.box(P.arma, Z.FIX, C.lona, [0, 1.15, 0.04], [0.54, 2.2, 0.12], {noTop: true});
  return g;
}
function lodRider(o, lvl) {
  const g = new GeoBuilder(), P = rigIndex('jinete');
  if (lvl === 2) {
    g.box(P.caballo, Z.FIX, 0xffffff, [0, -0.42, 0.1], [0.46, 1.5, 1.6], {noTop: true, vr: V.HORSE});            // 8: cuerpo y patas en un bloque
    g.tri([0.0, 0.0, -0.2], [0.0, 0.0, 0.2], [0.0, 0.85, 0.0], P.torso, Z.MAIN, 0); g.tri([-0.18, 0.0, 0.0], [0.18, 0.0, 0.0], [0.0, 0.85, 0.0], P.torso, Z.MAIN, 0);   // 2 (doble cara)
    return g;
  }
  g.box(P.caballo, Z.FIX, 0xffffff, [0, 0.02, 0], [0.5, 0.52, 1.4], {bottom: true, vr: V.HORSE});              // 12
  g.box(P.cuello, Z.FIX, 0xffffff, [0, 0.4, 0.22], [0.22, 0.86, 0.34], {rot: [36, 0, 0], taper: 0.1, vr: V.HORSE});   // 10
  ['manoIz', 'manoDe', 'pataIz', 'pataDe'].forEach(k => g.cyl(P[k], Z.FIX, 0xffffff, [0, -0.45, 0], 0.05, 0.08, 0.95, 3, {vr: V.HORSE}));   // 24
  g.box(P.silla, Z.ACC, 0, [0, -0.1, 0.06], [0.62, 0.3, 0.5], {noFront: false});                               // 10
  g.box(P.torso, Z.MAIN, 0, [0, 0.22, 0], [0.38, 0.46, 0.23]);                                                 // 10
  g.octa(P.cabeza, Z.FIX, C.piel, [0, 0.12, 0.005], 0.125, {ry: 0.14, vr: V.SKIN});                           // 8
  if (o.toc) lodHat(g, P.cabeza, o.toc);                                                                       // 10
  g.cyl(P.brazoIz, Z.MAIN, 0, [0, -0.15, 0.1], 0.05, 0.06, 0.4, 3, {rot: [-35, 0, 0]});                        // 6
  g.cyl(P.brazoDe, Z.MAIN, 0, [0, -0.26, 0], 0.05, 0.06, 0.56, 3);                                            // 6
  lodWeapon(g, P.arma, {husar: 'sable', coracero: 'sable', dragon: 'sable', lancero: 'lanza', general: 'sable', ayudante: 'sable', mariscal: 'baston', estandarte: 'astil_jinete'}[o.tipo || 'husar'], o);   // 6–12
  return g;
}
function lodCannon(o, lvl) {
  const g = new GeoBuilder(), P = rigIndex('canon'), col = o.era >= 'D' ? 0x5a5c4a : 0x5e6a48, mg = o.tipo === 'mg' && o.era >= 'D';
  if (lvl === 2) {
    if (!mg) ['ruedaIz', 'ruedaDe'].forEach(k => g.quad([0, -0.6, -0.6], [0, -0.6, 0.6], [0, 0.6, 0.6], [0, 0.6, -0.6], P[k], Z.FIX, C.madera));
    g.quad([-0.15, 0.2, -1.8], [0.15, 0.2, -1.8], [0.15, 0.62, 0.3], [-0.15, 0.62, 0.3], P.cureña, Z.FIX, col);
    g.quad([0, -0.12, -0.6], [0, -0.12, 1.2], [0, 0.12, 1.2], [0, 0.12, -0.6], P.tubo, Z.FIX, 0x3a3c38); return g;
  }
  g.box(P.cureña, Z.FIX, col, [0, 0.42, -0.85], [0.2, 0.14, 2.0], {rot: [-14, 0, 0]});
  g.box(P.cureña, Z.FIX, col, [0, 0.7, 0.15], [0.46, 0.22, 0.5]);
  if (o.era >= 'D' && o.tipo !== 'mg') g.quad([-0.52, 0.5, 0.42], [0.52, 0.5, 0.42], [0.46, 1.4, 0.42], [-0.46, 1.4, 0.42], P.cureña, Z.FIX, 0x5f6250);
  g.cyl(P.tubo, Z.FIX, o.tipo === 'liso' ? C.bronce : 0x3a3c38, [0, 0, 0.3], 0.1, 0.08, mg ? 0.9 : 1.6, 4, {rot: [o.tipo === 'obus' ? 58 : 90, 0, 0], top: true});
  if (!mg) ['ruedaIz', 'ruedaDe'].forEach(k => g.disc(P[k], Z.FIX, C.madera, [0, 0, 0], 0.6, 6, {two: true}));
  return g;
}
function lodTank(o, lvl, mark) {
  const g = new GeoBuilder(), P = rigIndex(mark ? 'markI' : 'tanque');
  if (mark) {
    if (lvl === 2) { g.box(P.casco, Z.VEH, 0, [0, 1.25, 0], [2.4, 2.5, 9.0], {noTop: true}); g.quad([-1.2, 2.5, 4.5], [1.2, 2.5, 4.5], [1.2, 2.5, -4.5], [-1.2, 2.5, -4.5], P.casco, Z.VEH, 0); return g; }
    g.box(P.casco, Z.VEH, 0, [0, 1.25, 0], [2.3, 2.45, 8.4], {taperZ: 0.1});
    ['sponIz', 'sponDe'].forEach(k => g.box(P[k], Z.VEH, 0, [0, 0, 0], [0.5, 1.0, 1.6], {taperZ: 0.35}));
    ['canonIz', 'canonDe'].forEach(k => g.cyl(P[k], Z.FIX, C.hierro, [0, 0, 0.45], 0.08, 0.07, 1.0, 3, {rot: [90, 0, 0]}));
    ['orugaIz', 'orugaDe'].forEach(k => g.box(P[k], Z.FIX, C.oruga, [0, 1.25, 0.4], [0.5, 2.45, 8.8], {taperZ: 0.15})); return g;
  }
  if (lvl === 2) { g.box(P.casco, Z.VEH, 0, [0, 0.95, 0], [1.6, 1.9, 4.2], {noTop: true}); g.quad([-0.45, 1.95, 0.6], [0.45, 1.95, 0.6], [0.45, 1.95, -0.3], [-0.45, 1.95, -0.3], P.casco, Z.VEH, 0); return g; }
  g.box(P.casco, Z.VEH, 0, [0, 1.05, 0.0], [0.92, 0.95, 3.2], {bottom: true, taperZ: 0.15});
  g.cyl(P.torreta, Z.VEH, 0, [0, 0.24, 0], 0.46, 0.4, 0.5, 6, {top: true});
  g.cyl(P.canon, Z.FIX, C.hierro, [0, 0, 0.3], 0.06, 0.05, 0.56, 3, {rot: [90, 0, 0]});
  ['orugaIz', 'orugaDe'].forEach(k => g.box(P[k], Z.VEH, 0, [0, 0.8, 0.1], [0.34, 1.4, 3.8], {taperZ: 0.15}));
  return g;
}
function lodTeam(o, lvl) {
  const g = new GeoBuilder(), P = rigIndex('tiro'), an = o.animal || 'caballo', col = an === 'buey' ? C.buey : 0xffffff, hv = an === 'buey' ? 0 : V.HORSE;
  const body = o.tipo === 'carreta' ? C.lona : 0x5e6a48;
  g.box(P.caja, Z.FIX, body, [0, 0.1, o.tipo === 'avantren' ? -1.0 : 0], [1.1, 0.8, o.tipo === 'avantren' ? 0.7 : 2.7], {noTop: lvl === 2});
  [1, 2].forEach(k => {
    g.box(P['an' + k], Z.FIX, col, [0, lvl === 2 ? -0.3 : 0.02, 0], [0.48, lvl === 2 ? 1.2 : 0.52, 1.36], {noTop: lvl === 2, vr: hv});
    if (lvl === 1) { g.box(P['an' + k + 'cu'], Z.FIX, col, [0, 0.4, 0.22], [0.22, 0.86, 0.34], {rot: [36, 0, 0], vr: hv}); ['mi', 'md', 'pi', 'pd'].forEach(l => g.cyl(P['an' + k + l], Z.FIX, col, [0, -0.45, 0], 0.05, 0.08, 0.95, 3, {vr: hv})); }
  });
  if (lvl === 1) ['ruedaDI', 'ruedaDD', 'ruedaTI', 'ruedaTD'].forEach(k => { if (o.tipo === 'avantren' && k[5] === 'D') return; g.disc(P[k], Z.FIX, C.madera, [0, 0, 0], 0.6, 6, {two: true}); });
  return g;
}
function lodParapet(o, lvl) { const g = new GeoBuilder(); g.box(0, Z.FIX, o.era >= 'D' ? C.saco : C.tierra, [0, 0.45, 0], [4.2, 0.9, 1.0], {taperZ: 0.3, noTop: lvl === 2}); return g; }

/* ---------------- catálogo ---------------- */
const AB = e => e === 'A' || e === 'B';
const hg = (nat, era, rol) => uniformPalette(nat, era, rol).headgear;
const RIDER = (tipo, rol, toc) => ({rig: 'jinete', clase: 'cav', pal: rol, o: (era, nat) => ({era, tipo, toc: toc ? toc(era, nat) : hg(nat, era, rol), flagLayout: (NACIONES[nat] || NACIONES.GEN).bandera, plumero: tipo === 'mariscal' && era !== 'D'}), build: buildRider, lod: lodRider});
const GUN = (tipo, eras) => ({rig: 'canon', clase: 'art', pal: 'artilleria', eras, o: era => ({era, tipo}), build: buildCannon, lod: lodCannon});
const TEAM = (tipo, animal) => ({rig: 'tiro', clase: 'tren', pal: tipo === 'carreta' ? 'linea' : 'artilleria', o: (era, nat) => ({era, tipo, animal}), build: buildTeam, lod: lodTeam});
const ROLE_ARMA = {escobillon: 'escobillon', cargador: 'bala', apuntador: 'espeque', artillero: 'botafuego', jefe: 'ninguna', tirador_mg: 'ninguna', municion: 'ninguna'};
const KINDS = {
  fusilero: {rig: 'soldado', clase: 'inf', pal: 'linea', nombre: 'Fusilero (infantería de línea)', o: (era, nat) => ({era, toc: hg(nat, era, 'linea'), arma: AB(era) ? 'mosquete' : 'fusil', bayoneta: era === 'D'})},
  granadero: {rig: 'soldado', clase: 'inf', pal: 'guardia', nombre: 'Granadero / guardia', o: (era, nat) => ({era, toc: hg(nat, era, 'guardia'), arma: AB(era) ? 'mosquete' : 'fusil', bayoneta: era === 'D', penacho: era === 'C' && hg(nat, era, 'guardia') !== 'pickel_pen'})},
  tirador: {rig: 'soldado', clase: 'inf', pal: 'ligera', nombre: 'Tirador / infantería ligera', o: (era, nat) => ({era, toc: hg(nat, era, 'ligera'), arma: 'fusil', mochila: false, correaje: false, bayoneta: era === 'D'})},
  oficial: {rig: 'soldado', clase: 'inf', pal: 'linea', nombre: 'Oficial a pie', o: (era, nat) => ({era, toc: era >= 'D' ? 'gorra' : hg(nat, era, 'linea'), arma: 'espada', rango: 'oficial', mochila: false, charreteras: true, correaje: false, cartucheras: false, catalejo: true})},
  abanderado: {rig: 'soldado', clase: 'inf', pal: 'linea', dobleCara: true, nombre: 'Portaestandarte', o: (era, nat) => ({era, toc: hg(nat, era, 'linea'), arma: 'astil', mochila: false, correaje: false, cartucheras: false, flagLayout: (NACIONES[nat] || NACIONES.GEN).bandera, unBrazo: true})},
  zapador: {rig: 'soldado', clase: 'inf', pal: 'linea', nombre: 'Zapador / ingeniero', o: (era, nat) => ({era, toc: hg(nat, era, 'linea'), arma: 'pala', espalda: 'pala', mochila: false})},
  sanitario: {rig: 'soldado', clase: 'inf', pal: 'linea', roles: ['delante', 'detras'], nombre: 'Sanitario con camilla', o: (era, nat, rol) => ({era, toc: hg(nat, era, 'linea'), arma: rol === 'detras' ? 'ninguna' : 'camilla', mochila: false, correaje: false, cartucheras: false, brazalete: era !== 'A', unBrazo: true})},
  prisionero: {rig: 'soldado', clase: 'inf', pal: 'linea', nombre: 'Prisionero', o: (era, nat) => ({era, toc: hg(nat, era, 'linea'), arma: 'ninguna', mochila: false, cartucheras: false})},
  herido: {rig: 'soldado', clase: 'inf', pal: 'linea', nombre: 'Herido', o: (era, nat) => ({era, toc: hg(nat, era, 'linea'), arma: 'ninguna', mochila: false, cartucheras: false})},
  artillero: {rig: 'soldado', clase: 'art', pal: 'artilleria', roles: Object.keys(ROLE_ARMA), nombre: 'Servidor de pieza', o: (era, nat, rol) => ({era, lite: true, toc: hg(nat, era, 'artilleria'), arma: rol === 'cargador' && !AB(era) ? 'proyectil' : rol === 'artillero' && !AB(era) ? 'ninguna' : ROLE_ARMA[rol || 'cargador'], mochila: false})},
  husar: Object.assign(RIDER('husar', 'caballeria'), {nombre: 'Húsar'}),
  coracero: Object.assign(RIDER('coracero', 'linea', (era, nat) => era >= 'D' ? hg(nat, era, 'linea') : 'casco_cor'), {nombre: 'Coracero'}),
  lancero: Object.assign(RIDER('lancero', 'caballeria', (era, nat) => era >= 'D' ? hg(nat, era, 'linea') : 'czapka'), {dobleCara: true, nombre: 'Lancero'}),
  dragon: Object.assign(RIDER('dragon', 'linea', (era, nat) => AB(era) ? 'casco_dragon' : hg(nat, era, 'linea')), {nombre: 'Dragón'}),
  general: Object.assign(RIDER('general', 'estado_mayor', (era, nat) => era >= 'D' ? 'gorra' : hg(nat, era, 'estado_mayor')), {nombre: 'General a caballo'}),
  ayudante: Object.assign(RIDER('ayudante', 'estado_mayor', (era, nat) => era >= 'D' ? 'gorra' : hg(nat, era, 'linea')), {nombre: 'Ayudante de campo'}),
  mariscal: Object.assign(RIDER('mariscal', 'estado_mayor', era => era >= 'D' ? 'gorra' : 'bicornio'), {nombre: 'Mariscal'}),
  mensajero: Object.assign(RIDER('mensajero', 'linea'), {nombre: 'Mensajero a caballo'}),
  estandarte: Object.assign(RIDER('estandarte', 'estado_mayor', (era, nat) => era >= 'D' ? 'gorra' : hg(nat, era, 'linea')), {dobleCara: true, nombre: 'Estandarte de mando'}),
  canon: Object.assign(GUN('liso', ['A', 'B']), {nombre: 'Cañón de ánima lisa'}),
  canon_rc: Object.assign(GUN('rc', ['B', 'C', 'D']), {nombre: 'Cañón rayado de retrocarga'}),
  obus: Object.assign(GUN('obus', ['A', 'B', 'C', 'D']), {nombre: 'Obús'}),
  ametralladora: Object.assign(GUN('mg', ['B', 'C', 'D']), {nombre: 'Ametralladora (Gatling / Maxim)'}),
  avantren: Object.assign(TEAM('avantren', 'caballo'), {nombre: 'Avantrén con tiro'}),
  carro_municion: Object.assign(TEAM('municion', 'caballo'), {nombre: 'Carro de munición'}),
  carreta: Object.assign(TEAM('carreta', 'mula'), {nombre: 'Carreta de suministro (mulas)'}),
  carreta_bueyes: Object.assign(TEAM('carreta', 'buey'), {nombre: 'Carreta de suministro (bueyes)'}),
  tanque: {rig: 'tanque', clase: 'tank', eras: ['D'], nombre: 'Tanque ligero tipo Renault FT', o: era => ({era}), build: buildTank, lod: (o, l) => lodTank(o, l, false)},
  mark1: {rig: 'markI', clase: 'tank', eras: ['D'], nombre: 'Tanque romboidal Mark I', o: era => ({era}), build: buildMarkI, lod: (o, l) => lodTank(o, l, true)},
  parapeto: {rig: 'estatico', clase: 'fort', nombre: 'Parapeto de fuerte', o: era => ({era}), build: buildParapet, lod: lodParapet}
};
Object.values(KINDS).forEach(k => { if (k.rig === 'soldado') { k.build = buildSoldier; k.lod = lodSoldier; } k.eras = k.eras || ['A', 'B', 'C', 'D']; });
const TROOP_KINDS = Object.keys(KINDS);
