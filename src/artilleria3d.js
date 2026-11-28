/* ===== artilleria3d.js — artillería 1836–1945 para el modo «Batalla» de Victoria (three.js r152, sin archivos externos) =====
   Amplía troops3d.js sin reemplazar nada (usa infanteria3d.js para los servidores y caballeria3d.js para el tiro). registrar(Troops3D, op) añade:
   · PIEZAS (rigs propios «p_*», ≤ 9 partes: cureña, cuna, tubo, cierre, ruedas, haz de cañones, manivela, proyectil; LOD0 ≤ 1 500):
     cañón de bronce de 6 y de 12 libras, obús de campaña, cañón rayado de retrocarga (B sin freno; C con freno de muelles/hidráulico y arado),
     cañón de 75 con freno hidroneumático y escudo, obús pesado, cañón de campaña de la SGM, cañón de montaña, antitanque de 37–50 mm,
     cañón de asedio de 24 libras con cureña de asedio, mortero de bronce y mortero de trinchera, cohete Congreve con su caballete,
     ametralladoras Gatling, Maxim, Vickers y MG 34/42.
   · PIEZA ENGANCHADA (rig «armon»): avantrén con lanza y cofre, pieza a remolque con la contera en el pinzote; carro de municiones;
     avantrén solo. Tiro de 4–6 caballos (caballos de varas, de en medio y de guía) con conductores montados en los de la izquierda.
   · SERVICIO DE PIEZA: secuencias sincronizadas de 3 a 7 servidores + jefe (mismos eventos en los mismos instantes que el clip de la pieza):
     avancarga (escobillar, cargar el saquete, atacar, tapar y pinchar el oído, cebar, apuntar con el tornillo, dar fuego con el tirafrictor,
     retroceso y devolver la pieza a batería), retrocarga (abrir el cierre, cargar el proyectil y la carga, cerrar, apuntar, fuego con cordón;
     retroceso del tubo sobre la cuna), tiro rápido (75), antitanque, morteros, cohetes, ametralladoras (tirador, proveedor; manivela).
   · MOVIMIENTO: rodar al paso, al trote y al galope de batería (ruedas que giran sin resbalar), desenganchar y enganchar (la pieza gira
     sobre su eje y los servidores llevan la contera), servidores sentados en los cofres; grupos de tiro y de batería con posiciones relativas.
   · REACCIONES: rueda rota, pieza desmontada (cureña partida), servidores muertos y heridos junto a la pieza, explosión del cofre de
     municiones, tiro de metralla («bote») con META.metralla. Eventos y puntos (boca, oído, cofre) para el módulo de efectos.
   Fuentes: «Instruction for Field Artillery» (EE. UU., 1864); «Aide-mémoire à l'usage des officiers d'artillerie» (1844, 1856); «Manual of Field
   Artillery» (Reino Unido, 1871); «Règlement sur le service des bouches à feu de campagne» (Francia, 1905, para el 75); «Field Artillery
   Training» (1914, 1939); H. Müller, «Die Entwickelung der Feldartillerie» (1893); dimensiones de piezas de los aide-mémoire y de museos (aprox.).
   API: registrar(Troops3D, op) · TIPOS · PIEZAS · META · DOTACIONES · dotacion(pieza, ciclo) · formacion(tipo, n, op) · boca(T3, tipo, clip, t)
        TRANSICIONES · rutaTransicion · demoArtilleria(cont) */
(function (root) {
'use strict';
const THREE = root.THREE;
const Z = {MAIN: 0, TRIM: 1, ACC: 2, HAT: 3, F1: 4, VEH: 7, FIX: 12};
const C = {bronce: 0xb08a48, bronceO: 0x8a6a34, hierro: 0x34363a, acero: 0x5a5e62, aceroC: 0x8a9096, madera: 0x7a5232, maderaO: 0x4e3420, cuero: 0x5a3a22, cueroN: 0x26201c,
  laton: 0xc8a048, negro: 0x1c1a1a, goma: 0x222220, lona: 0x8a8460, lana: 0xd8d0b8, cuerda: 0xb8a070, rojo: 0xa82020, saco: 0xc8b890, humo: 0x2a2a2a, blanco: 0xece6d6, verdeO: 0x4a5236};
const ERAS = ['A', 'B', 'C', 'D', 'E'];
const D2R = Math.PI / 180;

/* ===================================================================================== */
/* RIGS DE PIEZA: misma lista de partes, pivotes según la familia.
   cureña (raíz en el suelo bajo el eje) · cuna (muñones: elevación; en avancarga sin cuna lleva el tubo) · tubo (retrocede sobre la cuna) ·
   cierre (bloque de cierre / palanca de montar) · ruedaIz / ruedaDe · giro (haz de cañones de la Gatling) · manivela · proyectil (cohete) */
const FAM = {
  p_campana: {R: 0.65, ruedaX: 0.72, cuna: [0, 1.0, 0.1], cierre: [0, 0, -0.55], manivela: [-0.3, -0.04, -0.2], proyectil: [0, 0, 1.6]},
  p_asedio: {R: 0.78, ruedaX: 0.84, cuna: [0, 1.32, 0.15], cierre: [0, 0, -0.9], manivela: [-0.3, -0.05, -0.3], proyectil: [0, 0, 2.6]},
  p_montana: {R: 0.45, ruedaX: 0.52, cuna: [0, 0.72, 0.08], cierre: [0, 0, -0.42], manivela: [-0.22, -0.04, -0.15], proyectil: [0, 0, 1.0]},
  p_mortero: {R: 0.3, ruedaX: 0.4, cuna: [0, 0.34, 0.0], cierre: [0, 0, -0.2], manivela: [-0.2, 0, 0], proyectil: [0, 0, 0.6]},
  p_mortero_ligero: {R: 0.2, ruedaX: 0.3, cuna: [0, 0.06, -0.3], cierre: [0, 0, 0], manivela: [-0.15, 0.5, 0.2], proyectil: [0, 0, 1.2]},
  p_cohete: {R: 0.2, ruedaX: 0.3, cuna: [0, 1.25, 0.1], cierre: [0, 0, -0.3], manivela: [0, 0, 0], proyectil: [0, 0.06, 0.4]},
  p_mg: {R: 0.24, ruedaX: 0.34, cuna: [0, 0.42, 0.0], cierre: [0, 0.04, -0.36], manivela: [-0.12, 0, -0.3], proyectil: [0, 0, 0.75]}
};
function rigPieza(f) { const F = FAM[f];
  return [['cureña', -1, [0, 0, 0]], ['cuna', 0, F.cuna], ['tubo', 1, [0, 0, 0]], ['cierre', 2, F.cierre], ['ruedaIz', 0, [F.ruedaX, F.R, 0]], ['ruedaDe', 0, [-F.ruedaX, F.R, 0]],
    ['giro', 2, [0, 0, 0.3]], ['manivela', 1, F.manivela], ['proyectil', 1, F.proyectil]]; }
// pieza enganchada: avantrén (raíz bajo su eje), ruedas, lanza, la pieza (o el carro) colgada del pinzote y sus ruedas
const ARMON = {R: 0.65, ruedaX: 0.76, pinzote: [0, 0.68, -0.78], ejeP: [0, -0.03, -2.6], ruedaPX: 0.72};
const RIG_ARMON = [['avantren', -1, [0, 0, 0]], ['ruedaAI', 0, [ARMON.ruedaX, ARMON.R, 0]], ['ruedaAD', 0, [-ARMON.ruedaX, ARMON.R, 0]], ['lanza', 0, [0, 0.62, 0.55]],
  ['arrastre', 0, ARMON.pinzote], ['ruedaPI', 4, [ARMON.ruedaPX, ARMON.ejeP[1], ARMON.ejeP[2]]], ['ruedaPD', 4, [-ARMON.ruedaPX, ARMON.ejeP[1], ARMON.ejeP[2]]]];

/* ---------- piezas (marco de la cureña; boca hacia +z; el tubo se dibuja en el marco de la cuna o del tubo) ---------- */
const PIEZAS = {
  canon_6: {nombre: 'Cañón de bronce de 6 libras (sistema An XI / 1841, aprox.)', fam: 'p_campana', eras: ['A'], ciclo: 'A', calibre: 0.095, L: 1.55, Lc: 2.3, elev: 2, metralla: {balas: 41, cono: 8, alcance: 350}},
  canon_12: {nombre: 'Cañón de bronce de 12 libras («Napoleón» 1857 / Gribeauval, aprox.)', fam: 'p_campana', eras: ['A', 'B'], ciclo: 'A', calibre: 0.117, L: 1.66, Lc: 2.45, elev: 2, metralla: {balas: 27, cono: 9, alcance: 400}},
  obus_campana: {nombre: 'Obús de campaña de bronce (24 libras / 15 cm, aprox.)', fam: 'p_campana', eras: ['A', 'B'], ciclo: 'A', calibre: 0.15, L: 1.05, Lc: 2.3, elev: 10, metralla: {balas: 48, cono: 12, alcance: 300}},
  rayado_rc: {nombre: 'Cañón rayado de retrocarga (Krupp C/64 en B; con freno y arado en C)', fam: 'p_campana', eras: ['B', 'C'], ciclo: 'B', calibre: 0.08, L: 2.0, Lc: 2.6, elev: 3},
  canon_75: {nombre: 'Cañón de 75 mm de tiro rápido (mle 1897; freno hidroneumático, escudo)', fam: 'p_campana', eras: ['D', 'E'], ciclo: 'R', calibre: 0.075, L: 2.7, Lc: 2.7, elev: 4},
  obus_pesado: {nombre: 'Obús pesado de 15 cm (sFH 13 / 6 pulgadas 26 cwt, aprox.)', fam: 'p_campana', eras: ['D', 'E'], ciclo: 'C', calibre: 0.15, L: 2.1, Lc: 3.1, elev: 22},
  campana_E: {nombre: 'Cañón-obús de campaña de la SGM (leFH 18 / 25 libras, aprox.)', fam: 'p_campana', eras: ['E'], ciclo: 'E', calibre: 0.105, L: 2.6, Lc: 3.2, elev: 10},
  gatling: {nombre: 'Ametralladora Gatling (1865–1890) en cureña de campaña', fam: 'p_campana', eras: ['B', 'C'], ciclo: 'G', calibre: 0.011, L: 1.1, Lc: 2.1, elev: 1},
  asedio_24: {nombre: 'Cañón de asedio de 24 libras con cureña de asedio', fam: 'p_asedio', eras: ['A', 'B'], ciclo: 'A', calibre: 0.15, L: 2.9, Lc: 3.3, elev: 3, metralla: {balas: 48, cono: 7, alcance: 450}},
  montana: {nombre: 'Cañón de montaña (obús de 12 libras 1841 en A–B; 7,5 cm con escudo en C–D)', fam: 'p_montana', eras: ['A', 'B', 'C', 'D'], ciclo: 'M', calibre: 0.075, L: 0.95, Lc: 1.5, elev: 6, metralla: {balas: 24, cono: 12, alcance: 250}},
  antitanque: {nombre: 'Cañón antitanque de 37–50 mm (Pak 36/38, aprox.)', fam: 'p_montana', eras: ['E'], ciclo: 'T', calibre: 0.05, L: 2.2, Lc: 2.1, elev: 1},
  mortero: {nombre: 'Mortero de bronce en afuste de madera (tipo Coehorn / 8 pulgadas)', fam: 'p_mortero', eras: ['A', 'B'], ciclo: 'MA', calibre: 0.2, L: 0.6, Lc: 0.8, elev: 45},
  mortero_ligero: {nombre: 'Mortero de trinchera de avancarga por gravedad (Stokes / 81 mm)', fam: 'p_mortero_ligero', eras: ['D', 'E'], ciclo: 'MD', calibre: 0.081, L: 1.2, Lc: 0.6, elev: 0},
  congreve: {nombre: 'Cohete Congreve con caballete de lanzamiento', fam: 'p_cohete', eras: ['A'], ciclo: 'K', calibre: 0.08, L: 0.6, Lc: 1.2, elev: 12},
  maxim: {nombre: 'Ametralladora Maxim en afuste de ruedas con escudo (Sokolov / MG 08 en trineo, aprox.)', fam: 'p_mg', eras: ['C', 'D'], ciclo: 'MG', calibre: 0.008, L: 1.1, Lc: 0.9, elev: 0},
  vickers: {nombre: 'Ametralladora Vickers en trípode', fam: 'p_mg', eras: ['D', 'E'], ciclo: 'MG', calibre: 0.0077, L: 1.1, Lc: 0.9, elev: 0},
  mg34: {nombre: 'Ametralladora MG 34/42 en afuste Lafette', fam: 'p_mg', eras: ['E'], ciclo: 'MG', calibre: 0.0079, L: 1.2, Lc: 0.9, elev: 0}
};
// transformación de la pieza (marco de su cureña) al marco del «arrastre» (pinzote): girada 180°, contera levantada hasta el pinzote
function marcoRemolque(tipo) { const D = PIEZAS[tipo], Fm = FAM[D.fam], L = D.Lc, eje = new THREE.Vector3(0, Fm.R, 0);
  const ejeP = new THREE.Vector3(...ARMON.ejeP), ang = Math.atan2(ARMON.pinzote[1] - 0.1 - (Fm.R - ARMON.R), L);   // eleva la contera
  const M = new THREE.Matrix4().makeRotationY(Math.PI).premultiply(new THREE.Matrix4().makeRotationX(-ang));
  // la rueda de la pieza (en eje) queda en ejeP del arrastre
  const e2 = eje.clone().applyMatrix4(M); M.premultiply(new THREE.Matrix4().makeTranslation(ejeP.x - e2.x, ejeP.y + ARMON.R - Fm.R * 0 - e2.y + (Fm.R - ARMON.R), ejeP.z - e2.z)); return M; }

/* ===================================================================================== */
/* GEOMETRÍA */
function crear(T3, INF, CAB, CAB_J) {
const GB = T3._dev.GeoBuilder, xf = T3._dev.xf;
const IDX = r => { const m = {}; (T3.RIGS[r] || (r === 'armon' ? RIG_ARMON : rigPieza(r))).forEach((p, i) => { m[p[0]] = i; }); return m; };

// rueda de radios (eje X): llanta de hierro, pinas, radios en cruz y cubo. o.disco: rueda de chapa con neumático (SGM). ~150 triángulos
function rueda(g, part, R, o) {
  o = o || {}; const F = Z.FIX, w = o.w || 0.075, h = w / 2, n = o.n || 12, rim = o.rim || 0.07, ri = R - rim, P = (r, a, x) => [x, Math.cos(a) * r, Math.sin(a) * r];
  if (o.disco) {
    g.loft(part, F, C.goma, [[-h * 1.6, R * 0.82, R * 0.82], [-h * 1.6, R, R], [h * 1.6, R, R], [h * 1.6, R * 0.82, R * 0.82]], 12, {axis: 'x'});
    [1, -1].forEach(s => g.disc(part, Z.VEH, 0, [s * h * 1.2, 0, 0], R * 0.82, 10, {rot: s > 0 ? null : [0, 180, 0]}));
    g.loft(part, F, C.acero, [[-0.08, 0.07, 0.07], [0.1, 0.06, 0.06]], 6, {axis: 'x', capA: true, capB: true}); return g;
  }
  for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, b = (i + 1) / n * Math.PI * 2;
    g.quad(P(R, a, h), P(R, a, -h), P(R, b, -h), P(R, b, h), part, F, C.hierro);                                                        // llanta
    g.quad(P(ri, a, h), P(R, a, h), P(R, b, h), P(ri, b, h), part, Z.VEH, 0); g.quad(P(R, a, -h), P(ri, a, -h), P(ri, b, -h), P(R, b, -h), part, Z.VEH, 0);   // pinas
    if (!o.ligera) g.quad(P(ri, b, h), P(ri, b, -h), P(ri, a, -h), P(ri, a, h), part, Z.VEH, 0); }
  const ns = o.radios || 12;
  for (let i = 0; i < ns; i++) { const a = (i + 0.5) / ns * Math.PI * 2, d = 0.02, A = [0.03, 0, 0], B = P(ri, a, 0), t = [0, -Math.sin(a), Math.cos(a)];
    g.quad([A[0], A[1] + t[1] * d, A[2] + t[2] * d], [B[0], B[1] + t[1] * d * 0.7, B[2] + t[2] * d * 0.7], [B[0], B[1] - t[1] * d * 0.7, B[2] - t[2] * d * 0.7], [A[0], A[1] - t[1] * d, A[2] - t[2] * d], part, Z.VEH, 0);
    g.quad([A[0], A[1] - t[1] * d, A[2] - t[2] * d], [B[0], B[1] - t[1] * d * 0.7, B[2] - t[2] * d * 0.7], [B[0], B[1] + t[1] * d * 0.7, B[2] + t[2] * d * 0.7], [A[0], A[1] + t[1] * d, A[2] + t[2] * d], part, Z.VEH, 0); }
  g.loft(part, Z.VEH, 0, [[-0.12, 0.07, 0.07], [-0.03, 0.1, 0.1], [0.06, 0.1, 0.1], [0.13, 0.06, 0.06]], 6, {axis: 'x', capA: true, capB: true});
  g.loft(part, F, C.hierro, [[0.12, 0.06, 0.06], [0.18, 0.04, 0.04]], 6, {axis: 'x', capB: true});
  return g;
}
// tubo a lo largo de z: perfil [[z, r]], boca con ánima oscura; o.y, o.at, o.rot, o.n
function tubo(g, part, prof, col, o) {
  o = o || {}; const n = o.n || 10, F = Z.FIX;
  g.loft(part, F, col, prof.map(([z, r]) => [z, r, r, 0, o.y || 0]), n, {axis: 'z', capA: true, at: o.at, rot: o.rot});
  const [zm, rm] = prof[prof.length - 1], bore = o.anima || rm * 0.5;
  g.loft(part, F, C.negro, [[zm + 0.001, bore, bore, 0, o.y || 0], [zm - 0.06, bore, bore, 0, o.y || 0]], n, {axis: 'z', at: o.at, rot: o.rot, inside: true, capB: true});
  g.loft(part, F, col, [[zm, rm, rm, 0, o.y || 0], [zm + 0.0005, bore, bore, 0, o.y || 0]], n, {axis: 'z', at: o.at, rot: o.rot, flatN: true});
  return g;
}
const munones = (g, part, r, x, col) => g.loft(part, Z.FIX, col, [[-x, r, r], [x, r, r]], 6, {axis: 'x', capA: true, capB: true});
// gualderas (flasco) de una cureña de madera: dos tablones desde el eje hasta la contera, que se juntan atrás
function flasco(g, part, o) {
  const F = Z.FIX, ye = o.yEje, L = o.L, sep = o.sep, sepC = o.sepC || 0.12, h = o.h || 0.32, t = o.t || 0.08, zf = o.zf || 0.35, yC = o.yC || 0.12, V = Z.VEH;
  [1, -1].forEach(s => { const a = [s * sep, ye + 0.2, zf], b = [s * sepC, yC + h * 0.6, -L], d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], len = Math.hypot(...d), rx = Math.atan2(-d[1], -d[2]) / D2R, ry = Math.atan2(d[0], -d[2]) / D2R;
    g.box(part, V, 0, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], [t, h, len], {rot: [rx, -ry, 0], bottom: true}); });
  g.box(part, V, 0, [0, yC + 0.05, -L + 0.15], [sepC * 2 + 0.08, 0.16, 0.32], {bottom: true});                                       // contera
  g.box(part, F, C.hierro, [0, yC - 0.02, -L], [0.1, 0.05, 0.08], {});                                                               // argolla de la contera (luneta)
  g.box(part, V, 0, [0, ye, 0], [sep * 2 + 0.3, 0.14, 0.14], {bottom: true});                                                        // eje (gualdera del eje)
  g.loft(part, F, C.hierro, [[-(o.ejeX || 0.8), 0.045, 0.045], [o.ejeX || 0.8, 0.045, 0.045]], 6, {axis: 'x', at: [0, ye, 0]});
  for (let i = 1; i <= 2; i++) { const z = -L * i / 3, x = sep + (sepC - sep) * i / 3; g.box(part, V, 0, [0, ye + 0.2 - (ye + 0.2 - yC - h * 0.6) * i / 3, z], [x * 2, 0.08, 0.1], {}); }   // telera
}
// tornillo de puntería bajo la culata
const tornillo = (g, part, at) => { g.cyl(part, Z.FIX, C.hierro, at, 0.018, 0.018, 0.3, 4, {}); g.box(part, Z.FIX, C.hierro, [at[0], at[1] - 0.1, at[2]], [0.18, 0.02, 0.02], {}); };
// accesorios en la cureña: cubo de la lanada, espeque en la contera, cofres de eje
const cubo = (g, part, at) => g.cyl(part, Z.FIX, C.maderaO, at, 0.08, 0.1, 0.22, 6, {top: true, bottom: true});
const espeque = (g, part, at, rot) => g.cyl(part, Z.FIX, C.madera, at, 0.02, 0.025, 1.2, 4, {rot});

function pieza(g, tipo, o, P) {
  const D = PIEZAS[tipo], F = Z.FIX, V = Z.VEH, Fm = FAM[D.fam], cu = Fm.cuna, era = o.era, br = era <= 'B' && /canon_|obus_c|asedio|montana|mortero$/.test(tipo) && !(tipo === 'montana' && era >= 'C');
  const colT = br ? C.bronce : C.acero, ye = Fm.R;
  // ruedas
  if (!/mortero|congreve|vickers|mg34/.test(tipo)) { const R = Fm.R, disco = tipo === 'antitanque' || tipo === 'campana_E';
    [P.ruedaIz, P.ruedaDe].forEach((p, i) => rueda(g, p, R, {disco, w: tipo === 'asedio_24' ? 0.1 : 0.075, radios: tipo === 'maxim' ? 8 : R > 0.6 ? 12 : 10, ligera: R < 0.5, n: R < 0.4 ? 10 : 12})); }
  const T = P.tubo, Cu = P.cuna, Cr = P.cureña;
  switch (tipo) {
    case 'canon_6': case 'canon_12': case 'obus_campana': case 'asedio_24': {
      // tubo de bronce (o hierro en el de asedio): cascabel, culata, refuerzos, caña y brocal; los muñones en la cuna
      const L = D.L, r0 = D.calibre * 0.95 + (tipo === 'asedio_24' ? 0.08 : 0.055), rb = r0 * 0.78, zb = -L * 0.38, zf = L * 0.62, obus = tipo === 'obus_campana';
      const prof = obus ? [[zb - 0.08, 0.05], [zb - 0.02, r0 * 0.9], [zb, r0], [zb + 0.25, r0 * 0.96], [zb + 0.32, r0 * 1.04], [zf - 0.12, r0 * 0.98], [zf - 0.06, r0 * 1.08], [zf, r0 * 1.05]]
        : [[zb - 0.1, 0.045], [zb - 0.03, r0 * 0.72], [zb, r0], [zb + L * 0.33, r0 * 0.94], [zb + L * 0.35, r0 * 0.86], [zf - 0.16, rb * 0.82], [zf - 0.07, rb * 0.95], [zf, rb * 0.9]];
      tubo(g, T, prof, tipo === 'asedio_24' && era === 'B' ? C.hierro : C.bronce, {n: 10, anima: D.calibre / 2});
      g.octa(T, F, C.bronce, [0, 0, zb - 0.13], 0.05);                                                                                       // botón del cascabel
      munones(g, T, 0.045, r0 + 0.07, tipo === 'asedio_24' && era === 'B' ? C.hierro : C.bronce);
      if (!obus) [1, -1].forEach(s => g.box(T, F, C.bronce, [s * 0.05, r0 * 0.92, 0.02], [0.03, 0.05, 0.1], {}));                           // asas (delfines)
      g.box(T, F, C.bronceO, [0, r0 * 0.98, zb + 0.1], [0.04, 0.03, 0.04], {});                                                              // oído
      const L2 = D.Lc, sep = tipo === 'asedio_24' ? 0.3 : 0.22;
      flasco(g, Cr, {yEje: ye, L: L2, sep, sepC: 0.12, h: tipo === 'asedio_24' ? 0.42 : 0.3, t: 0.085, zf: 0.3, yC: 0.1, ejeX: Fm.ruedaX + 0.06});
      tornillo(g, Cr, [0, ye + 0.22, -0.5]);
      cubo(g, Cr, [0, 0.4, -L2 * 0.55]); espeque(g, Cr, [0.18, ye * 0.5, -L2 * 0.7], [80, 0, 0]);
      if (era === 'A' && tipo !== 'asedio_24') [1, -1].forEach(s => g.box(Cr, V, 0, [s * 0.42, ye + 0.12, 0], [0.34, 0.24, 0.3], {bottom: true}));   // cofres de eje
      if (tipo === 'asedio_24') g.box(Cr, F, C.maderaO, [0, 0.02, 0], [2.6, 0.04, 3.6], {});                                               // explanada de tablones
      break; }
    case 'rayado_rc': {
      const L = D.L, zb = -0.62, zf = L - 0.62;
      tubo(g, T, [[zb, 0.11], [zb + 0.55, 0.11], [zb + 0.62, 0.095], [zf - 0.05, 0.065], [zf, 0.07]], C.acero, {n: 10, anima: 0.04});
      g.box(P.cierre, F, C.aceroC, [0, 0, 0.02], [0.26, 0.17, 0.12], {});                                                               // cierre de cuña (Krupp)
      g.box(P.cierre, F, C.hierro, [-0.15, 0.0, 0.02], [0.05, 0.05, 0.05], {});
      munones(g, T, 0.04, 0.16, C.acero);
      if (era === 'C') { g.box(Cu, F, C.acero, [0, -0.12, 0.25], [0.12, 0.1, 1.1], {}); g.cyl(Cu, F, C.aceroC, [0, -0.12, 0.25], 0.04, 0.04, 1.0, 6, {rot: [90, 0, 0]}); }   // cuna con freno
      const L2 = D.Lc; g.box(Cr, V, 0, [0, ye - 0.02, -L2 * 0.45], [0.24, 0.22, L2 * 1.0], {rot: [-15, 0, 0], bottom: true});              // contera de cajón
      [1, -1].forEach(s => g.box(Cr, V, 0, [s * 0.16, ye + 0.18, -0.05], [0.06, 0.34, 0.7], {bottom: true}));
      g.loft(Cr, F, C.hierro, [[-0.82, 0.045, 0.045], [0.82, 0.045, 0.045]], 6, {axis: 'x', at: [0, ye, 0]});
      if (era === 'C') g.box(Cr, F, C.hierro, [0, 0.12, -L2 + 0.05], [0.36, 0.26, 0.04], {rot: [30, 0, 0]});                               // arado
      tornillo(g, Cr, [0, ye + 0.2, -0.45]); [1, -1].forEach(s => g.box(Cr, V, 0, [s * 0.35, ye + 0.15, 0.02], [0.3, 0.22, 0.26], {bottom: true}));   // asientos-cofre
      break; }
    case 'canon_75': case 'obus_pesado': case 'campana_E': {
      const L = D.L, pesado = tipo === 'obus_pesado', e = tipo === 'campana_E', rT = pesado ? 0.12 : e ? 0.075 : 0.06, zb = pesado ? -0.75 : -0.6, zf = L + zb;
      tubo(g, T, [[zb, rT * 1.6], [zb + 0.35, rT * 1.6], [zb + 0.4, rT * 1.25], [zf - (e ? 0.25 : 0.05), rT], [zf - (e ? 0.25 : 0), rT * 1.05]].concat(e ? [[zf - 0.24, rT * 1.4], [zf, rT * 1.4]] : []), C.acero, {n: 10, anima: D.calibre / 2});   // e: freno de boca
      g.box(P.cierre, F, C.aceroC, [0, 0, 0.03], [rT * 3.2, rT * 3.2, 0.1], {});                                                         // cierre (excéntrico Nordenfelt / de tornillo)
      g.cyl(P.cierre, F, C.hierro, [-rT * 1.7, 0, 0.03], 0.02, 0.02, 0.18, 4, {rot: [0, 0, 90]});                                           // palanca
      // cuna con los cilindros del freno y del recuperador (no retroceden)
      g.box(Cu, F, C.acero, [0, -rT * 1.9, 0.15], [rT * 2.4, rT * 2.2, L * 0.62], {});
      g.cyl(Cu, F, C.aceroC, [0, -rT * 1.9, 0.15 + L * 0.32], rT * 0.8, rT * 0.8, 0.08, 6, {rot: [90, 0, 0]});
      munones(g, Cu, 0.05, rT * 1.5 + 0.08, C.acero);
      g.box(Cu, F, C.negro, [-rT * 2.2, 0.1, -0.15], [0.06, 0.08, 0.22], {});                                                              // alza panorámica / goniómetro
      // escudo, eje, contera y arado
      if (!pesado) { const W = e ? 1.7 : 1.6; [1, -1].forEach(s => g.box(Cr, V, 0, [s * (W / 4 + 0.08), ye + 0.45, 0.35], [W / 2 - 0.1, 0.95, 0.03], {rot: [-8, 0, 0], bottom: true}));
        g.box(Cr, V, 0, [0, ye + 0.08, 0.36], [0.2, 0.25, 0.03], {rot: [-8, 0, 0]}); }
      g.loft(Cr, F, C.hierro, [[-0.84, 0.05, 0.05], [0.84, 0.05, 0.05]], 6, {axis: 'x', at: [0, ye, 0]});
      g.box(Cr, V, 0, [0, ye + 0.12, -0.05], [0.4, 0.24, 0.5], {bottom: true});
      if (e) [1, -1].forEach(s => g.box(Cr, V, 0, [s * 0.25, ye * 0.5, -D.Lc * 0.5], [0.12, 0.16, D.Lc], {rot: [-11, -s * 9, 0], bottom: true}));   // contera abierta (mástiles)
      else g.box(Cr, V, 0, [0, ye * 0.5, -D.Lc * 0.5], [pesado ? 0.34 : 0.2, 0.2, D.Lc], {rot: [-12, 0, 0], bottom: true});
      g.box(Cr, F, C.hierro, [0, 0.12, -D.Lc + 0.05], [pesado ? 0.5 : 0.4, 0.3, 0.04], {rot: [30, 0, 0]});                                // arado
      if (tipo === 'canon_75') [1, -1].forEach(s => { g.box(Cr, F, C.hierro, [s * 0.32, ye - 0.05, 0.1], [0.24, 0.04, 0.24], {}); g.box(Cr, F, C.hierro, [s * 0.75, 0.05, 0.05], [0.08, 0.1, 0.3], {}); });   // asientos y zapatas de freno
      if (pesado) [1, -1].forEach(s => g.box(Cr, V, 0, [s * 0.18, ye + 0.15, 0.1], [0.05, 0.36, 0.9], {bottom: true}));
      break; }
    case 'gatling': {
      for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2, x = Math.cos(a) * 0.05, y = Math.sin(a) * 0.05; g.cyl(P.giro, F, C.acero, [x, y, 0.25], 0.011, 0.011, 1.0, 4, {rot: [90, 0, 0]}); }
      [0.05, 0.55].forEach(z => g.cyl(P.giro, F, C.bronce, [0, 0, z], 0.075, 0.075, 0.05, 8, {rot: [90, 0, 0]}));
      g.loft(T, F, C.bronce, [[-0.55, 0.11, 0.11], [-0.25, 0.11, 0.11], [-0.2, 0.08, 0.08]], 8, {axis: 'z', capA: true});                     // cárter
      g.box(T, F, C.bronce, [0, 0.13, -0.38], [0.06, 0.12, 0.14], {}); g.box(T, F, C.laton, [0, 0.26, -0.38], [0.08, 0.16, 0.08], {});   // tolva
      g.cyl(P.manivela, F, C.hierro, [0, 0, 0], 0.012, 0.012, 0.08, 4, {rot: [0, 0, 90]}); g.box(P.manivela, F, C.hierro, [-0.04, -0.08, 0], [0.02, 0.16, 0.02], {}); g.cyl(P.manivela, F, C.madera, [-0.07, -0.15, 0], 0.015, 0.015, 0.06, 4, {rot: [0, 0, 90]});
      munones(g, Cu, 0.035, 0.16, C.bronce); g.box(Cu, F, C.bronce, [0, -0.06, -0.2], [0.2, 0.08, 0.5], {});
      flasco(g, Cr, {yEje: ye, L: D.Lc, sep: 0.16, sepC: 0.1, h: 0.26, t: 0.07, zf: 0.25, yC: 0.1, ejeX: 0.78}); tornillo(g, Cr, [0, ye + 0.15, -0.3]);
      break; }
    case 'montana': case 'antitanque': {
      const at = tipo === 'antitanque', L = D.L, zb = at ? -0.55 : -0.32, zf = L + zb, bronce = !at && era <= 'B', r = at ? 0.04 : 0.075;
      tubo(g, T, at ? [[zb, 0.075], [zb + 0.3, 0.075], [zb + 0.35, 0.05], [zf - 0.2, 0.04], [zf - 0.2, 0.065], [zf, 0.065]] : [[zb - 0.06, 0.04], [zb, r + 0.03], [zb + 0.3, r + 0.025], [zf - 0.06, r], [zf, r + 0.012]], bronce ? C.bronce : C.acero, {n: 8, anima: D.calibre / 2});
      munones(g, at ? Cu : T, 0.03, 0.12, bronce ? C.bronce : C.acero);
      if (at || era >= 'C') { g.box(P.cierre, F, C.aceroC, [0, 0, 0.02], [0.12, 0.12, 0.08], {}); g.box(Cu, F, C.acero, [0, -0.1, 0.05], [0.12, 0.1, 0.8], {}); }
      if (at || era >= 'C') { [1, -1].forEach(s => g.box(Cr, V, 0, [s * 0.42, ye + 0.38, 0.25], [0.68, at ? 0.62 : 0.7, 0.02], {rot: [-10, 0, 0], bottom: true})); }   // escudo (doble en el antitanque)
      if (at) [1, -1].forEach(s => g.box(Cr, V, 0, [s * 0.24, ye * 0.45, -D.Lc * 0.5], [0.07, 0.09, D.Lc], {rot: [-8, -s * 12, 0], bottom: true}));
      else flasco(g, Cr, {yEje: ye, L: D.Lc, sep: 0.14, sepC: 0.09, h: 0.2, t: 0.05, zf: 0.2, yC: 0.07, ejeX: 0.58});
      if (at) g.loft(Cr, F, C.hierro, [[-0.6, 0.035, 0.035], [0.6, 0.035, 0.035]], 6, {axis: 'x', at: [0, ye, 0]});
      tornillo(g, Cr, [0, ye + 0.14, -0.25]);
      break; }
    case 'mortero': {
      tubo(g, T, [[-0.25, 0.14], [-0.18, 0.2], [0.05, 0.19], [0.28, 0.16], [0.35, 0.18]], C.bronce, {n: 10, anima: D.calibre / 2});
      munones(g, T, 0.045, 0.24, C.bronce);
      g.box(Cr, V, 0, [0, 0.17, 0], [0.7, 0.3, 1.0], {bottom: true}); [1, -1].forEach(s => g.box(Cr, V, 0, [s * 0.27, 0.36, 0], [0.12, 0.14, 0.5], {}));
      g.box(Cr, F, C.madera, [0, 0.36, 0.38], [0.24, 0.1, 0.16], {rot: [20, 0, 0]});                                                     // cuña de puntería
      break; }
    case 'mortero_ligero': {
      // el tubo sale de la placa: la cuna pivota en la base; el tubo se dibuja a lo largo de +z y la cuna lo inclina
      tubo(g, T, [[0.0, 0.055], [0.06, 0.05], [D.L, 0.048]], era === 'E' ? C.verdeO : C.acero, {n: 8, anima: D.calibre / 2});
      g.octa(T, F, C.acero, [0, 0, -0.01], 0.06);
      g.box(Cr, F, C.acero, [0, 0.02, -0.3], [0.5, 0.04, 0.4], {});                                                                      // placa base
      [1, -1].forEach(s => g.tube(Cr, F, C.acero, [s * 0.28, 0, 0.45], [0, 0.72, 0.42], [[0, 0.018], [1, 0.016]], 4));                    // bípode
      g.box(Cr, F, C.acero, [0, 0.74, 0.42], [0.12, 0.06, 0.06], {}); g.cyl(Cr, F, C.hierro, [0.02, 0.6, 0.42], 0.012, 0.012, 0.3, 4, {});
      break; }
    case 'congreve': {
      [[0.5, -0.5], [-0.5, -0.5], [0, 0.75]].forEach(([x, z]) => g.tube(Cr, F, C.madera, [x, 0, z], [0, 1.25, 0.05], [[0, 0.03], [1, 0.022]], 4));   // caballete (trípode)
      g.box(Cu, F, C.hierro, [0, 0.0, 0.4], [0.12, 0.05, 2.4], {rot: [0, 0, 0]}); [1, -1].forEach(s => g.box(Cu, F, C.hierro, [s * 0.065, 0.05, 0.4], [0.015, 0.08, 2.4], {}));   // canal
      tubo(g, P.proyectil, [[-0.2, 0.05], [0.25, 0.05], [0.4, 0.0]], C.hierro, {n: 6});                                                  // cohete de 12 libras
      g.cyl(P.proyectil, F, C.madera, [0, 0.0, -1.7], 0.012, 0.012, 3.0, 4, {rot: [90, 0, 0]});                                          // vara de guía
      break; }
    case 'maxim': case 'vickers': case 'mg34': {
      const mg = tipo === 'mg34';
      if (mg) { g.box(T, F, C.negro, [0, 0, 0], [0.06, 0.08, 0.7], {}); g.cyl(T, F, C.negro, [0, 0, 0.6], 0.022, 0.018, 0.5, 6, {rot: [90, 0, 0]}); g.box(T, F, C.maderaO, [0, -0.03, -0.45], [0.05, 0.12, 0.3], {taper: 0.2});
        g.box(T, F, C.negro, [0.06, -0.02, 0.05], [0.04, 0.1, 0.14], {}); }                                                                // cinta / tambor
      else { g.box(T, F, C.bronce, [0, 0, -0.18], [0.11, 0.14, 0.4], {}); tubo(g, T, [[0.0, 0.055], [0.62, 0.055], [0.65, 0.03], [0.75, 0.022]], tipo === 'vickers' ? C.acero : C.bronce, {n: 8, anima: 0.006});   // cajón y camisa de agua
        [1, -1].forEach(s => g.box(T, F, C.madera, [s * 0.05, 0, -0.42], [0.025, 0.06, 0.06], {})); }                                      // empuñaduras de pala
      g.box(P.cierre, F, C.hierro, [0, 0, 0], [0.03, 0.03, 0.08], {});
      if (tipo === 'maxim') { g.box(Cr, F, C.verdeO, [0, 0.18, 0.05], [0.28, 0.08, 0.7], {}); g.box(Cr, Z.VEH, 0, [0, 0.62, 0.32], [0.5, 0.42, 0.02], {rot: [-8, 0, 0]});   // afuste de ruedas y escudo
        g.box(Cr, F, C.verdeO, [0, 0.08, -0.6], [0.08, 0.06, 0.7], {rot: [-6, 0, 0]}); g.cyl(Cr, F, C.hierro, [0, 0.3, 0], 0.03, 0.03, 0.22, 6, {}); }
      else { [[0.32, 0.25], [-0.32, 0.25], [0, -0.55]].forEach(([x, z]) => g.tube(Cr, F, mg ? C.verdeO : C.acero, [x * (mg ? 1.2 : 1), 0, z * (mg ? 1.3 : 1)], [0, 0.36, 0], [[0, 0.016], [1, 0.022]], 4));
        g.cyl(Cr, F, mg ? C.verdeO : C.acero, [0, 0.38, 0], 0.04, 0.035, 0.08, 6, {}); }
      if (tipo === 'vickers') { g.cyl(Cr, F, C.verdeO, [0.35, 0.12, 0.1], 0.08, 0.08, 0.28, 6, {top: true}); }                              // bidón del condensador
      g.box(Cr, F, tipo === 'mg34' ? C.verdeO : C.madera, [-0.35, 0.08, 0.05], [0.12, 0.16, 0.28], {bottom: true});                    // caja de munición
      break; }
  }
  return g;
}
// LOD de pieza: LOD1 ≤ 150, LOD2 ≤ 30
function piezaLod(tipo, o, nivel, P) {
  const g = new GB(), D = PIEZAS[tipo], Fm = FAM[D.fam], F = Z.FIX, V = Z.VEH, R = Fm.R, col = o.era <= 'B' && /canon_|obus_c|asedio|montana|mortero$/.test(tipo) ? C.bronce : C.acero, rueda_ = !/mortero|congreve|vickers|mg34/.test(tipo);
  const Lt = D.L, zb = -Lt * 0.35;
  if (nivel === 2) {
    g.box(P.tubo, F, col, [0, 0, zb + Lt / 2], [D.calibre + 0.12, D.calibre + 0.12, Lt], {noTop: false, noBack: true});                  // 8
    if (rueda_) [P.ruedaIz, P.ruedaDe].forEach(p => g.disc(p, V, 0, [0, 0, 0], R, 5, {two: true}));                                          // 20
    else g.box(P.cureña, V, 0, [0, 0.15, 0], [0.5, 0.3, 0.8], {noTop: true});
    return g;
  }
  g.cyl(P.tubo, F, col, [0, 0, zb + Lt / 2], (D.calibre + 0.14) / 2, (D.calibre + 0.1) / 2, Lt, 6, {rot: [90, 0, 0]});                       // 12
  if (rueda_) { [P.ruedaIz, P.ruedaDe].forEach(p => { g.disc(p, V, 0, [0.03, 0, 0], R, 10, {}); g.disc(p, V, 0, [-0.03, 0, 0], R, 10, {rot: [0, 180, 0]});
      g.loft(p, F, C.hierro, [[-0.04, R, R], [0.04, R, R]], 10, {axis: 'x'}); });                                                             // 40 × 2
    g.box(P.cureña, V, 0, [0, R * 0.6, -D.Lc * 0.45], [0.3, 0.18, D.Lc], {rot: [-10, 0, 0], bottom: true});                                // 12
    g.box(P.cureña, F, C.hierro, [0, R, 0], [Fm.ruedaX * 2, 0.06, 0.06], {});                                                               // 10
    if (/75|campana_E|antitanque|maxim/.test(tipo) || (tipo === 'montana' && o.era >= 'C')) g.box(P.cureña, V, 0, [0, R + 0.4, 0.3], [1.4, 0.8, 0.03], {noBack: true});   // escudo 8
  } else g.box(P.cureña, tipo === 'congreve' ? F : V, tipo === 'congreve' ? C.madera : 0, [0, 0.2, 0], [0.6, 0.4, 0.9], {});
  return g;
}

/* ---------- avantrén, pieza enganchada y carro de municiones (rig «armon») ---------- */
const PA = IDX('armon');
function avantren(g, o) {
  const A = PA.avantren, V = Z.VEH, F = Z.FIX;
  [PA.ruedaAI, PA.ruedaAD].forEach(p => rueda(g, p, ARMON.R, {}));
  g.loft(A, F, C.hierro, [[-0.84, 0.045, 0.045], [0.84, 0.045, 0.045]], 6, {axis: 'x', at: [0, ARMON.R, 0]});
  g.box(A, V, 0, [0, ARMON.R + 0.1, 0], [1.2, 0.12, 0.14], {bottom: true});                                                                // gualdera del eje
  g.box(A, V, 0, [0, ARMON.R + 0.4, -0.05], [1.05, 0.44, 0.56], {bottom: true});                                                           // cofre de municiones
  g.box(A, V, 0, [0, ARMON.R + 0.64, -0.05], [1.1, 0.05, 0.62], {});                                                                       // tapa (asiento de tres sirvientes)
  [1, -1].forEach(s => { g.box(A, V, 0, [s * 0.35, ARMON.R + 0.08, -0.35], [0.08, 0.1, 0.9], {}); g.box(A, F, C.hierro, [s * 0.5, ARMON.R + 0.68, 0.22], [0.12, 0.02, 0.12], {}); });   // tijeras y estribos
  g.box(A, V, 0, [0, ARMON.R + 0.08, 0.5], [1.1, 0.08, 0.08], {});                                                                         // balancín (volea)
  g.box(A, F, C.hierro, [0, 0.66, -0.78], [0.06, 0.06, 0.12], {});                                                                         // pinzote
  if (o.era <= 'B') g.box(A, F, C.lona, [0, ARMON.R + 0.7, -0.3], [0.9, 0.08, 0.14], {});                                                // capotes enrollados
  g.box(PA.lanza, V, 0, [0, 0, 1.35], [0.08, 0.09, 2.7], {rot: [3, 0, 0]}); g.box(PA.lanza, F, C.hierro, [0, -0.05, 2.7], [0.36, 0.03, 0.04], {});   // lanza y cadenas de las varas
}
// copia la geometría de una pieza en otro GeoBuilder cambiando la parte y aplicando una transformación rígida
function copiar(src, dst, mapa) {
  const v = new THREE.Vector3(), n = new THREE.Vector3(), nm = new THREE.Matrix3();
  for (let t = 0; t < src.p.length / 9; t++) { const pa = src.part[t * 3], m = mapa[pa]; if (!m) continue; nm.getNormalMatrix(m.M);
    for (let k = 0; k < 3; k++) { const i = t * 9 + k * 3; v.set(src.p[i], src.p[i + 1], src.p[i + 2]).applyMatrix4(m.M); n.set(src.n[i], src.n[i + 1], src.n[i + 2]).applyMatrix3(nm).normalize();
      dst.p.push(v.x, v.y, v.z); dst.n.push(n.x, n.y, n.z); dst.part.push(m.a); dst.zone.push(src.zone[t * 3 + k]); dst.col.push(src.col[i], src.col[i + 1], src.col[i + 2]); dst.vr.push(src.vr[t * 3 + k]); dst.fx.push(src.fx[t * 6 + k * 2], src.fx[t * 6 + k * 2 + 1]); } }
}
function enganchado(g, tipo, o) {
  avantren(g, o); const fam = PIEZAS[tipo].fam, src = new GB(), Pp = IDX(fam); pieza(src, tipo, o, Pp);
  const M = marcoRemolque(tipo), id = new THREE.Matrix4(), cuna = new THREE.Matrix4().makeTranslation(...FAM[fam].cuna).premultiply(M);
  const cierre = new THREE.Matrix4().makeTranslation(...FAM[fam].cierre).premultiply(cuna), man = new THREE.Matrix4().makeTranslation(...FAM[fam].manivela).premultiply(cuna), giro = new THREE.Matrix4().makeTranslation(0, 0, 0.3).premultiply(cuna);
  const mapa = {}; mapa[Pp.cureña] = {a: PA.arrastre, M}; mapa[Pp.cuna] = {a: PA.arrastre, M: cuna}; mapa[Pp.tubo] = {a: PA.arrastre, M: cuna}; mapa[Pp.cierre] = {a: PA.arrastre, M: cierre};
  mapa[Pp.giro] = {a: PA.arrastre, M: giro}; mapa[Pp.manivela] = {a: PA.arrastre, M: man}; mapa[Pp.ruedaIz] = {a: PA.ruedaPD, M: id}; mapa[Pp.ruedaDe] = {a: PA.ruedaPI, M: id};
  copiar(src, g, mapa); return g;
}
// carro de municiones (cajón de dos cofres sobre su propio eje, colgado del avantrén)
function carro(g, o) {
  avantren(g, o); const Ar = PA.arrastre, V = Z.VEH, F = Z.FIX, ez = ARMON.ejeP[2], ye = ARMON.ejeP[1] + ARMON.R;
  [PA.ruedaPI, PA.ruedaPD].forEach(p => rueda(g, p, ARMON.R, {}));
  g.loft(Ar, F, C.hierro, [[-0.82, 0.045, 0.045], [0.82, 0.045, 0.045]], 6, {axis: 'x', at: [0, ARMON.ejeP[1], ez]});
  g.box(Ar, V, 0, [0, -0.05, -1.1], [0.14, 0.12, 2.2], {bottom: true});                                                                     // vara (lanza de cola)
  [-0.35, 0.3].forEach(dz => { g.box(Ar, V, 0, [0, ye - 0.25 + 0.0, ez + dz - 0.0], [1.05, 0.44, 0.56], {bottom: true}); g.box(Ar, V, 0, [0, ye, ez + dz], [1.1, 0.05, 0.62], {}); });   // dos cofres
  g.box(Ar, F, C.madera, [0, ye - 0.35, ez - 0.95], [0.12, 0.1, 0.5], {}); g.cyl(Ar, F, C.negro, [0, ye - 0.35, ez - 1.25], 0.2, 0.2, 0.12, 8, {rot: [0, 0, 90]});   // rueda de repuesto (aprox.)
}
function armonLod(o, nivel, que) {
  const g = new GB(), V = Z.VEH, F = Z.FIX;
  if (nivel === 2) { g.box(PA.avantren, V, 0, [0, 0.6, 0], [1.4, 0.9, 0.7], {noTop: false, noBack: true}); if (que !== 'avantren') g.box(PA.arrastre, que === 'carro' ? V : F, que === 'carro' ? 0 : C.acero, [0, 0.0, -2.2], [1.3, 0.9, 1.6], {noTop: true}); return g; }
  g.box(PA.avantren, V, 0, [0, ARMON.R + 0.35, -0.05], [1.05, 0.6, 0.56], {bottom: true}); g.box(PA.lanza, V, 0, [0, 0, 1.35], [0.08, 0.09, 2.7], {noBack: true});
  [PA.ruedaAI, PA.ruedaAD].concat(que !== 'avantren' ? [PA.ruedaPI, PA.ruedaPD] : []).forEach(p => { g.disc(p, V, 0, [0.03, 0, 0], ARMON.R, 8, {}); g.disc(p, V, 0, [-0.03, 0, 0], ARMON.R, 8, {rot: [0, 180, 0]}); });
  if (que === 'carro') g.box(PA.arrastre, V, 0, [0, ARMON.ejeP[1] + ARMON.R - 0.2, ARMON.ejeP[2]], [1.05, 0.5, 1.2], {bottom: true});
  else if (que !== 'avantren') { g.box(PA.arrastre, V, 0, [0, -0.1, -1.4], [0.3, 0.16, 2.6], {rot: [-12, 0, 0]}); g.cyl(PA.arrastre, F, C.acero, [0, 0.3, -3.2], 0.09, 0.07, 1.8, 6, {rot: [-80, 0, 0]}); }
  return g;
}

/* ---------- servidores: herramientas en la parte «arma» del soldado (pivote en un extremo, +Y hacia el otro) ---------- */
const PS = INF.P;
const HERR = {
  escobillon: (g, a) => { g.cyl(a, Z.FIX, C.madera, [0, 1.05, 0], 0.018, 0.018, 2.1, 4); g.cyl(a, Z.FIX, C.lana, [0, 2.12, 0], 0.06, 0.06, 0.24, 6, {top: true});   // lanada y atacador
    g.cyl(a, Z.FIX, C.madera, [0, 0.0, 0], 0.055, 0.055, 0.08, 6, {bottom: true}); },
  saquete: (g, a) => { g.cyl(a, Z.FIX, C.saco, [0, 0.0, 0], 0.055, 0.055, 0.22, 6, {top: true, bottom: true}); g.octa(a, Z.FIX, C.hierro, [0, 0.15, 0], 0.055); },   // saquete y bala sobre el salero
  espeque: (g, a) => g.cyl(a, Z.FIX, C.madera, [0, 0.6, 0], 0.022, 0.028, 1.2, 4),
  cordon: (g, a) => { g.cyl(a, Z.FIX, C.madera, [0, 0, 0], 0.014, 0.014, 0.12, 4, {rot: [0, 0, 90]}); g.cyl(a, Z.FIX, C.cuerda, [0, 0.55, 0], 0.005, 0.005, 1.1, 3); },   // tirafrictor
  proyectil: (g, a, o) => { const r = o.era === 'B' || o.era === 'C' ? 0.045 : o.era === 'E' ? 0.055 : 0.04; g.cyl(a, Z.FIX, o.era >= 'D' ? C.laton : C.hierro, [0, 0.0, 0], r, r, 0.3, 6, {bottom: true}); g.cyl(a, Z.FIX, C.verdeO, [0, 0.25, 0], r, 0.012, 0.2, 6, {}); },
  bomba: (g, a, o) => { if (o.era >= 'D') { g.cyl(a, Z.FIX, C.verdeO, [0, 0.1, 0], 0.04, 0.04, 0.3, 6, {top: true, bottom: true}); g.cyl(a, Z.FIX, C.verdeO, [0, -0.1, 0], 0.02, 0.02, 0.12, 4, {}); }
    else g.octa(a, Z.FIX, C.hierro, [0, 0, 0], 0.1); },
  cohete: (g, a) => { g.cyl(a, Z.FIX, C.hierro, [0, 0.25, 0], 0.05, 0.05, 0.5, 6, {}); g.cyl(a, Z.FIX, C.madera, [0, -1.0, 0], 0.012, 0.012, 2.0, 4); },
  caja: (g, a) => g.box(a, Z.FIX, C.verdeO, [0, -0.06, 0], [0.1, 0.16, 0.28], {bottom: true}),
  botafuego: (g, a) => { g.cyl(a, Z.FIX, C.madera, [0, 0.45, 0], 0.012, 0.012, 0.9, 4); g.cyl(a, Z.FIX, C.rojo, [0, 0.95, 0], 0.012, 0.004, 0.1, 4); }
};
// papeles: herramienta, nombre, si es jefe
const ROLES = {
  jefe: {nombre: 'Jefe de pieza', herr: null, jefe: true}, escobillon: {nombre: 'Sirviente n.º 1 (escobillón y atacador)', herr: 'escobillon'},
  cargador: {nombre: 'Sirviente n.º 2 (cargador)', herr: 'saquete'}, cebador: {nombre: 'Sirviente n.º 3 (oído y espeque)', herr: 'espeque'},
  tirador: {nombre: 'Sirviente n.º 4 (cebo y tirafrictor)', herr: 'cordon'}, municionero: {nombre: 'Municionero', herr: 'saquete'},
  apuntador: {nombre: 'Apuntador', herr: null}, cierre: {nombre: 'Sirviente del cierre', herr: 'cordon'}, cargador_rc: {nombre: 'Cargador (retrocarga)', herr: 'proyectil'},
  municionero_rc: {nombre: 'Municionero (retrocarga)', herr: 'proyectil'}, bombero: {nombre: 'Cargador de mortero', herr: 'bomba'}, cohetero: {nombre: 'Cohetero', herr: 'cohete'},
  botafuego: {nombre: 'Tirador con botafuego', herr: 'botafuego'}, mg_tirador: {nombre: 'Tirador de ametralladora', herr: null}, mg_proveedor: {nombre: 'Proveedor de ametralladora', herr: 'caja'}
};
function servidor(rol, era, nat) {
  const R = ROLES[rol], base = INF.opciones(R.jefe ? 'sargento' : 'soldado', era, nat);
  return Object.assign(base, {rango: 'art_' + rol, arma: R.jefe ? (era === 'E' ? 'ninguna' : 'sable') : 'ninguna', bayoneta: false, herr: R.herr,
    mod: Object.assign({}, base.mod, {mochila: 'no', rollo: era <= 'B' ? 'manta' : 'ninguno'}), modelo: `art_${rol}_${nat}_${era}`, galones: R.jefe ? base.galones : 0});
}

/* ---------- conductor del tiro (tipo de jinete de caballeria3d) y arneses de tiro ---------- */
function arneses(g, o, conductor) {
  const P = CAB.P, F = Z.FIX, N = xf([[0, 0.06, 0.02]], [0, 0, 0], [35, 0, 0])[0];
  // collera y horcate (latón en las puntas) en la base del cuello
  g.loft(P.cuello, F, C.cuero, [[-0.02, 0.19, 0.27, 0, -0.02], [0.08, 0.17, 0.24, 0, -0.02]], 8, {rot: [35, 0, 0], at: [0, 0, 0]});
  [1, -1].forEach(s => { g.tube(P.cuello, F, C.madera, [s * 0.19, 0.0, 0.05], [s * 0.15, 0.32, -0.05], [[0, 0.02], [1, 0.016]], 4); g.octa(P.cuello, F, C.laton, [s * 0.15, 0.34, -0.06], 0.025); });
  // tirantes: de la collera por los costados hasta el balancín del par de atrás (1,9 m detrás del pecho)
  [1, -1].forEach(s => { g.strap(P.caballo, F, C.cueroN, [[s * 0.25, 0.02, 0.62], [s * 0.29, -0.02, 0.0], [s * 0.28, -0.04, -0.7], [s * 0.3, -0.12, -1.9]], 0.04, [s, 0, 0]);
    g.strap(P.caballo, F, C.cueroN, [[s * 0.18, 0.24, 0.1], [s * 0.27, -0.05, 0.08], [s * 0.15, -0.28, 0.08]], 0.05, [s, 0, 0]);       // sotabarba / ventrera
    g.strap(P.caballo, F, C.cueroN, [[s * 0.1, 0.3, -0.58], [s * 0.26, 0.05, -0.7], [s * 0.24, -0.1, -0.62]], 0.05, [s, 0, 0.3]); });  // retranca
  if (!conductor) g.box(P.caballo, F, C.cuero, [0, 0.3, 0.06], [0.22, 0.06, 0.3], {});                                                    // sillín de tiro
  const H = (x, y, z) => xf([[x, y, z]], [0, 0, 0], [50, 0, 0])[0], T = P.testa;                                                          // cabezada con anteojeras
  [1, -1].forEach(s => { g.strap(T, F, C.cueroN, [H(0.08 * s, 0.11, -0.03), H(0.104 * s, 0.03, 0.12), H(0.075 * s, -0.04, 0.36)], 0.025, [s, 0, 0]); g.box(T, F, C.cueroN, H(0.105 * s, 0.06, 0.13), [0.01, 0.07, 0.07], {}); });
  g.loft(T, F, C.cueroN, [[0.36, 0.074, 0.09], [0.4, 0.074, 0.09]], 6, {axis: 'z', rot: [50, 0, 0], p: 2.2});
  void N;
}
// silla sencilla del conductor (sin gualdrapa: el arnés ya lleva la cabezada)
function sillaTiro(g) { const S = CAB.P.silla, F = Z.FIX;
  g.loft(S, F, C.cuero, [[-0.26, 0.13, 0.04, 0, 0.08], [-0.18, 0.16, 0.05, 0, 0.03], [0.12, 0.15, 0.045, 0, 0.03], [0.25, 0.08, 0.04, 0, 0.09]], 6, {axis: 'z', capA: true, capB: true, p: 2.6});
  [1, -1].forEach(s => { g.strap(S, F, C.cueroN, [[0.17 * s, 0.0, 0.0], [0.285 * s, -0.42, 0.08]], 0.018, [s, 0, 0]); g.box(S, F, C.hierro, [0.29 * s, -0.5, 0.1], [0.02, 0.1, 0.11], {noTop: true});
    g.box(S, F, C.lona, [0.2 * s, -0.08, -0.25], [0.06, 0.2, 0.22], {}); }); }
const latigo = (g, a) => { g.cyl(a, Z.FIX, C.cueroN, [0, 0.4, 0], 0.01, 0.006, 0.8, 3); g.tube(a, Z.FIX, C.cuero, [0, 0.8, 0], [0, 1.1, -0.35], [[0, 0.004], [1, 0.002]], 3); };

/* ---------- catálogo ---------- */
const TIPOS = {};
const veh = (n, f) => ({rig: f, clase: 'art', pal: 'artilleria', ...n});
Object.entries(PIEZAS).forEach(([k, D]) => { const P = IDX(D.fam);
  TIPOS['art_' + k] = veh({nombre: D.nombre, eras: D.eras.slice(), o: (era, nat) => ({era, nat: nat || 'GEN', tipo: k, modelo: `art_${k}_${era}`}), build: o => pieza(new GB(), k, o, P), lod: (o, l) => piezaLod(k, o, l, P)}, D.fam);
  if (D.fam === 'p_campana') TIPOS[`art_${k}_enganchado`] = veh({nombre: D.nombre + ' enganchado al avantrén', eras: D.eras.slice(), o: (era, nat) => ({era, nat: nat || 'GEN', tipo: k, modelo: `arme_${k}_${era}`}),
    build: o => enganchado(new GB(), k, o), lod: (o, l) => armonLod(o, l, 'pieza')}, 'armon'); });
TIPOS.art_avantren = veh({nombre: 'Avantrén suelto', eras: ['A', 'B', 'C', 'D', 'E'], o: (era, nat) => ({era, nat: nat || 'GEN', modelo: `armav_${era}`}), build: o => { const g = new GB(); avantren(g, o); return g; }, lod: (o, l) => armonLod(o, l, 'avantren')}, 'armon');
TIPOS.art_carro_municion = veh({nombre: 'Carro de municiones (avantrén y cajón)', eras: ['A', 'B', 'C', 'D', 'E'], o: (era, nat) => ({era, nat: nat || 'GEN', modelo: `armca_${era}`}), build: o => { const g = new GB(); carro(g, o); return g; }, lod: (o, l) => armonLod(o, l, 'carro')}, 'armon');
// servidores (rig soldado; prefijo inf_ → variación de infanteria3d)
Object.entries(ROLES).forEach(([r, R]) => { TIPOS['inf_art_' + r] = {rig: 'soldado', clase: 'art', pal: 'artilleria', nombre: R.nombre, eras: ERAS.slice(),
  o: (era, nat) => servidor(r, era, nat || 'GEN'), build: o => { const g = INF.soldado(o); if (o.herr) HERR[o.herr](g, PS.arma, o); return g; }, lod: (o, l) => INF.lod(o, l)}; });
// tiro: caballo de tiro con conductor (caballo de la izquierda) y caballo de mano (derecha); prefijo cab_ → marcas de caballeria3d
CAB_J.conductor = {nombre: 'Conductor de artillería', cuerpo: 'pesado', silla: 'dragon', arma: 'ninguna', pal: 'artilleria', eras: ERAS.slice(), carabina: () => false,
  toc: (e, n) => e <= 'B' ? 'kepi' : e === 'C' ? (n === 'PRU' || n === 'GER' ? 'pickel' : 'kepi') : e === 'D' ? (n === 'GBR' ? 'brodie' : n === 'PRU' || n === 'GER' ? 'stahl' : 'adrian') : (n === 'USA' ? 'm1' : n === 'URS' || n === 'RUS' ? 'ssh40' : n === 'GBR' ? 'brodie' : 'stahl')};
TIPOS.cab_tiro_conductor = {rig: 'jinete', clase: 'cav', pal: 'artilleria', nombre: 'Caballo de tiro con conductor', eras: ERAS.slice(),
  o: (era, nat) => Object.assign(CAB.opciones('conductor', era, nat || 'GEN'), {cuerpo: 'pesado', modelo: `tiroc_${nat}_${era}`}),
  build: o => { const g = new GB(); CAB.caballo(g, o); sillaTiro(g); arneses(g, o, true); CAB.jinete(g, o); latigo(g, CAB.P.arma); return g; }, lod: (o, l) => CAB.lod(o, l)};
TIPOS.cab_tiro_mano = {rig: 'jinete', clase: 'cav', pal: 'artilleria', nombre: 'Caballo de tiro de mano (sin jinete)', eras: ERAS.slice(),
  o: (era, nat) => ({era, nat: nat || 'GEN', cuerpo: 'pesado', modelo: `tirom_${era}`}), build: o => { const g = new GB(); CAB.caballo(g, o); arneses(g, o, false); return g; }, lod: (o, l) => CAB.lod(o, l)};

return {TIPOS, pieza, piezaLod, enganchado, carro, avantren, IDX, PA, marcoRemolque, rueda, tubo, arneses, sillaTiro, latigo, HERR};
}

/* ===================================================================================== */
/* PUNTOS DE CADA PIEZA (marco de la cuna o de la cureña) para colocar herramientas, servidores, humo y fogonazo */
function puntos(tipo) {
  const D = PIEZAS[tipo], L = D.L, F = FAM[D.fam];
  let boca, culata, oido = null;
  if (/^(canon_6|canon_12|obus_campana|asedio_24)$/.test(tipo)) { const r0 = D.calibre * 0.95 + (tipo === 'asedio_24' ? 0.08 : 0.055); boca = [0, 0, L * 0.62]; culata = [0, 0, -L * 0.38]; oido = [0, r0 * 0.98 + 0.015, -L * 0.38 + 0.1]; }
  else if (tipo === 'rayado_rc') { boca = [0, 0, L - 0.62]; culata = [0, 0, -0.62]; }
  else if (/75|pesado|campana_E/.test(tipo)) { const zb = tipo === 'obus_pesado' ? -0.75 : -0.6; boca = [0, 0, L + zb]; culata = [0, 0, zb]; }
  else if (tipo === 'gatling') { boca = [0, 0, 1.05]; culata = [0, 0.26, -0.38]; }
  else if (tipo === 'montana' || tipo === 'antitanque') { const zb = tipo === 'antitanque' ? -0.55 : -0.32; boca = [0, 0, L + zb]; culata = [0, 0, zb]; oido = tipo === 'montana' ? [0, 0.1, zb + 0.08] : null; }
  else if (tipo === 'mortero') { boca = [0, 0, 0.35]; culata = [0, 0, -0.25]; oido = [0, 0.2, -0.18]; }
  else if (tipo === 'mortero_ligero') { boca = [0, 0, L]; culata = [0, 0, 0]; }
  else if (tipo === 'congreve') { boca = [0, 0.06, 1.6]; culata = [0, 0.06, -0.8]; }
  else { boca = [0, 0, tipo === 'mg34' ? 0.85 : 0.75]; culata = [0, 0, -0.42]; }
  return {boca, culata, oido, contera: [0, 0.1, -D.Lc], cuna: F.cuna};
}
// al marco de la pieza (con la elevación de reposo y sin retroceso)
function enPieza(tipo, local, elev) { const F = FAM[PIEZAS[tipo].fam], e = (elev != null ? elev : PIEZAS[tipo].elev) * D2R, c = Math.cos(e), s = Math.sin(e);
  return [F.cuna[0] + local[0], F.cuna[1] + local[1] * c + local[2] * s, F.cuna[2] - local[1] * s + local[2] * c]; }
const ELEV_REPOSO = {mortero: 45, mortero_ligero: 60, congreve: 15};
const elevDe = k => ELEV_REPOSO[k] != null ? ELEV_REPOSO[k] : PIEZAS[k].elev;

/* ===================================================================================== */
/* ANIMACIONES */
const CLIPS = {}, META = {};               // CLIPS[rig][nombre]
const sstep = (a, b, t) => { const u = Math.min(1, Math.max(0, (t - a) / (b - a))); return u * u * (3 - 2 * u); };
const lerpK = (keys, t) => { let a = keys[0], b = keys[keys.length - 1]; if (t <= a[0]) return a.slice(1); if (t >= b[0]) return b.slice(1);
  for (let i = 0; i < keys.length - 1; i++) if (t >= keys[i][0] && t <= keys[i + 1][0]) { a = keys[i]; b = keys[i + 1]; break; }
  const u = sstep(a[0], b[0], t); return a.slice(1).map((v, i) => v + (b[i + 1] - v) * u); };
const curva = (N, fn) => { const tr = []; for (let i = 0; i <= N; i++) { const t = i / N, v = fn(t); tr.push([+t.toFixed(5), v[0] || 0, v[1] || 0, v[2] || 0]); } return tr; };
function defC(rig, n, c, m) { (CLIPS[rig] = CLIPS[rig] || {})[n] = c; c.ev = (c.ev || []).sort((a, b) => a[0] - b[0]);
  META[n] = Object.assign({rig, suelo: 'pie', avance: 0, desplazamiento: [0, 0, 0], armaCompatible: ERAS.slice(), transiciones: []}, m || {}); META[n].eventos = c.ev.map(e => e[1]); }

/* ---------- duraciones de los ciclos (s) y eventos comunes a la pieza y a la dotación ----------
   A avancarga: 2,5 disparos/min apuntados («Instruction for Field Artillery», 1864: 2 por minuto con puntería, 4 sin ella)
   B retrocarga sin freno: 5/min · C pesado: 4/min · E SGM: 6–8/min · R 75 mle 1897: 12–15/min · T antitanque: 12/min
   MA mortero de bronce: 1 cada 30 s · MD mortero de trinchera: 15–20/min · K cohete: 4/min · G Gatling, MG: ráfagas */
const CICLOS = {
  A: {dur: 24, ev: [[0, 'disparo'], [0.07, 'devolver'], [0.18, 'tapar_oido'], [0.19, 'escobillar'], [0.28, 'entrega'], [0.33, 'cargar'], [0.36, 'atacar'], [0.46, 'pinchar'], [0.5, 'apuntar'], [0.72, 'cebar'], [0.8, 'listo'], [0.96, 'fuego']]},
  M: {dur: 18, ev: [[0, 'disparo'], [0.07, 'devolver'], [0.18, 'tapar_oido'], [0.19, 'escobillar'], [0.28, 'entrega'], [0.33, 'cargar'], [0.36, 'atacar'], [0.46, 'pinchar'], [0.5, 'apuntar'], [0.72, 'cebar'], [0.8, 'listo'], [0.96, 'fuego']]},
  B: {dur: 12, ev: [[0, 'disparo'], [0.08, 'devolver'], [0.24, 'abrir_cierre'], [0.3, 'entrega'], [0.4, 'cargar'], [0.5, 'cerrar'], [0.55, 'apuntar'], [0.85, 'listo'], [0.96, 'fuego']]},
  C: {dur: 15, ev: [[0, 'disparo'], [0.02, 'retroceso'], [0.2, 'abrir_cierre'], [0.24, 'extraer'], [0.3, 'entrega'], [0.4, 'cargar'], [0.5, 'cerrar'], [0.55, 'apuntar'], [0.85, 'listo'], [0.96, 'fuego']]},
  E: {dur: 8, ev: [[0, 'disparo'], [0.02, 'retroceso'], [0.2, 'abrir_cierre'], [0.24, 'extraer'], [0.3, 'entrega'], [0.4, 'cargar'], [0.5, 'cerrar'], [0.55, 'apuntar'], [0.85, 'listo'], [0.96, 'fuego']]},
  R: {dur: 4.5, ev: [[0, 'disparo'], [0.02, 'retroceso'], [0.2, 'abrir_cierre'], [0.24, 'extraer'], [0.3, 'entrega'], [0.4, 'cargar'], [0.5, 'cerrar'], [0.55, 'apuntar'], [0.85, 'listo'], [0.96, 'fuego']]},
  T: {dur: 4.5, ev: [[0, 'disparo'], [0.02, 'retroceso'], [0.2, 'abrir_cierre'], [0.24, 'extraer'], [0.3, 'entrega'], [0.4, 'cargar'], [0.5, 'cerrar'], [0.55, 'apuntar'], [0.85, 'listo'], [0.96, 'fuego']]},
  MA: {dur: 30, ev: [[0, 'disparo'], [0.1, 'escobillar'], [0.3, 'entrega'], [0.38, 'cargar'], [0.5, 'apuntar'], [0.72, 'cebar'], [0.84, 'listo'], [0.97, 'fuego']]},
  MD: {dur: 3.6, ev: [[0, 'cargar'], [0.07, 'disparo'], [0.45, 'entrega'], [0.8, 'listo']]},
  K: {dur: 15, ev: [[0, 'disparo'], [0.3, 'entrega'], [0.38, 'cargar'], [0.55, 'apuntar'], [0.8, 'cebar'], [0.84, 'listo']]},
  G: {dur: 3, ev: [[0, 'rafaga'], [0.5, 'cargar'], [0.5, 'rafaga']]},
  MG: {dur: 3, ev: [[0, 'rafaga'], [0.7, 'cinta']]}
};
const RETROCESO = {canon_6: 1.2, canon_12: 1.5, obus_campana: 1.0, asedio_24: 1.8, montana: 0.8, rayado_rc: 1.3, mortero: 0.25, gatling: 0.0, maxim: 0.0, vickers: 0, mg34: 0};
const RET_TUBO = {canon_75: 1.15, obus_pesado: 1.0, campana_E: 0.9, antitanque: 0.55, rayado_rc: 0.4};

/* ---------- clips de pieza ---------- */
function clipsPieza(k) {
  const D = PIEZAS[k], F = FAM[D.fam], rig = D.fam, el = elevDe(k), R = F.R, ruedas = !/mortero|congreve|vickers|mg34/.test(k), ciclo = CICLOS[D.ciclo], N = 160;
  const reposo = {dur: 4, loop: true, tracks: {cuna: [[0, -el, 0, 0]]}, ev: []};
  if (k === 'congreve') reposo.tracks.proyectil = [[0, 0, 0, 0]];
  defC(rig, `art_${k}_reposo`, reposo, {pieza: k, transiciones: [`art_${k}_servicio`]});
  // servicio: retroceso de la cureña (sin freno) y vuelta a batería, o retroceso del tubo sobre la cuna (con freno), cierre, puntería
  const c = {dur: ciclo.dur, loop: true, tracks: {}, ev: ciclo.ev.map(e => e.slice())}, ret = RETROCESO[k] || 0, rt = RET_TUBO[k] && !(k === 'rayado_rc') ? RET_TUBO[k] : 0;
  const zR = t => ret ? -ret * (t < 0.04 ? 1 - Math.pow(1 - t / 0.04, 2) : 1 - sstep(D.ciclo === 'B' ? 0.08 : 0.07, D.ciclo === 'B' ? 0.2 : 0.17, t)) : 0;
  c.root = curva(N, t => [0, k === 'mortero' && t < 0.05 ? 0.02 * Math.sin(Math.PI * t / 0.05) : 0, zR(t)]);
  if (ruedas) { const rr = t => zR(t) / R / D2R; c.tracks.ruedaIz = curva(N, t => [rr(t), 0, 0]); c.tracks.ruedaDe = curva(N, t => [rr(t), 0, 0]); }
  // puntería: elevación (tornillo) y dirección (espeque en la contera o volantes)
  const apA = D.ciclo === 'A' || D.ciclo === 'M' ? [0.5, 0.7] : [0.55, 0.82];
  c.tracks.cuna = curva(N, t => [-el - (t > apA[0] && t < apA[1] ? 0.8 * Math.sin(Math.PI * (t - apA[0]) / (apA[1] - apA[0])) : 0) + (t < 0.03 && !ret && !rt && /mg|maxim|vickers|gatling/.test(k) === false ? 1.5 * Math.sin(Math.PI * t / 0.03) : 0), 0, 0]);
  c.tracks['cureña'] = curva(N, t => [t < 0.03 && (rt || k === 'mortero_ligero') ? -1.2 * Math.sin(Math.PI * t / 0.03) : 0, t > apA[0] && t < apA[1] ? 1.2 * Math.sin(2 * Math.PI * (t - apA[0]) / (apA[1] - apA[0])) : 0, 0]);
  if (rt) { c.pos = {tubo: curva(N, t => [0, 0, t < 0.02 ? -rt * Math.sin(Math.PI / 2 * t / 0.02) : -rt * (1 - sstep(0.02, D.ciclo === 'R' || D.ciclo === 'T' ? 0.12 : 0.16, t))])}; }
  if (k === 'rayado_rc') c.pos = {tubo: curva(N, () => [0, 0, 0])};
  if (/[BCERT]/.test(D.ciclo) && D.ciclo.length === 1) c.tracks.cierre = curva(N, t => [0, 0, 0]), c.pos = Object.assign(c.pos || {}, {cierre: curva(N, t => [-0.18 * sstep(0.2, 0.24, t) * (1 - sstep(0.48, 0.52, t)), 0, 0])});
  if (k === 'mortero_ligero') { c.tracks.cuna = curva(N, t => [-el + (t > 0.07 && t < 0.1 ? 1.5 : 0), 0, 0]); c.pos = {tubo: curva(N, t => [0, 0, t > 0.07 && t < 0.12 ? -0.03 * Math.sin(Math.PI * (t - 0.07) / 0.05) : 0])}; }
  if (k === 'congreve') { c.pos = {proyectil: curva(N, t => [0, 0, t < 0.05 ? 40 * t * t / 0.0025 * 0.05 : 0])}; c.hide = {proyectil: [[0, 1], [0.04, 0], [0.38, 1]]}; c.tracks.proyectil = [[0, 0, 0, 0]]; }
  if (D.ciclo === 'G') { c.tracks.giro = curva(N, t => [0, 0, 720 * t]); c.tracks.manivela = curva(N, t => [-720 * t, 0, 0]); c.tracks.cuna = curva(N, t => [-el + 0.3 * Math.sin(2 * Math.PI * t * 8), 2 * Math.sin(2 * Math.PI * t), 0]); }
  if (D.ciclo === 'MG') { c.pos = {tubo: curva(N, t => [0, 0, t < 0.6 ? -0.012 * Math.abs(Math.sin(Math.PI * t * 40)) : 0])}; c.tracks.cuna = curva(N, t => [-el + (t < 0.6 ? 0.6 * Math.sin(2 * Math.PI * t * 12) : 0), t < 0.6 ? 4 * Math.sin(2 * Math.PI * t / 0.6 - 1.2) : 0, 0]);
    c.ev = [[0, 'rafaga'], [0.1, 'rafaga'], [0.2, 'rafaga'], [0.3, 'rafaga'], [0.4, 'rafaga'], [0.5, 'rafaga'], [0.7, 'cinta']]; }
  if (D.ciclo === 'G') c.ev = [[0, 'rafaga'], [0.125, 'rafaga'], [0.25, 'rafaga'], [0.375, 'rafaga'], [0.5, 'cargar'], [0.5, 'rafaga'], [0.625, 'rafaga'], [0.75, 'rafaga'], [0.875, 'rafaga']];
  defC(rig, `art_${k}_servicio`, c, {pieza: k, ciclo: D.ciclo, sincronizar: true, retroceso: ret, retrocesoTubo: rt, transiciones: [`art_${k}_reposo`]});
  // metralla («bote»): un disparo con retroceso; el juego dispara el cono con META.metralla
  if (D.metralla) { const m = {dur: 3, loop: false, tracks: {cuna: [[0, -el, 0, 0]]}, ev: [[0, 'disparo'], [0, 'metralla']]}, zr = t => -ret * Math.min(1, 1 - Math.pow(1 - Math.min(1, t / 0.12), 2));
    m.root = curva(60, t => [0, 0, zr(t)]); if (ruedas) { m.tracks.ruedaIz = curva(60, t => [zr(t) / R / D2R, 0, 0]); m.tracks.ruedaDe = m.tracks.ruedaIz; }
    defC(rig, `art_${k}_metralla`, m, {pieza: k, metralla: D.metralla, desplazamiento: [0, 0, -ret], transiciones: [`art_${k}_servicio`]}); }
  // daños: rueda rota (la cureña se vence sobre el eje roto) y pieza desmontada (cureña partida, el tubo cae)
  if (ruedas) {
    const rr = {dur: 2.2, loop: false, tracks: {cuna: [[0, -el, 0, 0]]}, ev: [[0, 'impacto'], [0.1, 'rueda_rota'], [0.45, 'cae']]};
    rr.tracks.ruedaDe = curva(60, t => [30 * sstep(0.05, 0.5, t), 20 * sstep(0.05, 0.4, t), -75 * sstep(0.08, 0.45, t)]);
    rr.pos = {ruedaDe: curva(60, t => [-0.25 * sstep(0.05, 0.45, t), -(R * 0.9) * sstep(0.08, 0.45, t), -0.2 * sstep(0.05, 0.45, t)])};
    rr.tracks['cureña'] = curva(60, t => [3 * sstep(0.1, 0.45, t), -6 * sstep(0.1, 0.5, t), -lerpK([[0, 0], [0.12, 0], [0.42, 21], [0.5, 18], [1, 19]], t)[0] * (R / 0.65 * 0.9 + 0.1)]);
    defC(rig, `art_${k}_rueda_rota`, rr, {pieza: k, suelo: 'apoyado', dano: 'rueda', transiciones: []});
    const dm = {dur: 2.6, loop: false, tracks: {}, ev: [[0, 'impacto'], [0.08, 'astillas'], [0.4, 'cae_tubo'], [0.55, 'cae']]};
    dm.tracks.cuna = curva(70, t => [lerpK([[0, -el], [0.1, -el - 25], [0.4, 30], [0.55, 14], [1, 16]], t)[0], 12 * sstep(0.1, 0.5, t), 20 * sstep(0.1, 0.45, t)]);
    dm.pos = {cuna: curva(70, t => { const u = sstep(0.08, 0.42, t); return [0.3 * u, -(F.cuna[1] - 0.15) * u + 0.3 * Math.sin(Math.PI * Math.min(1, t / 0.3)) * (1 - u), 0.6 * u]; })};
    dm.tracks['cureña'] = curva(70, t => [lerpK([[0, 0], [0.1, 0], [0.5, -10], [1, -9]], t)[0], 0, -12 * sstep(0.2, 0.55, t)]);
    dm.tracks.ruedaIz = curva(70, t => [0, 0, 25 * sstep(0.15, 0.55, t)]);
    defC(rig, `art_${k}_desmontada`, dm, {pieza: k, suelo: 'apoyado', dano: 'desmontada', transiciones: []});
  }
}
Object.keys(PIEZAS).forEach(clipsPieza);

/* ---------- pieza enganchada (rig armon): rodar sin resbalar, giros, desenganchar/enganchar y explosión del cofre ----------
   Avantrén y pieza con ruedas de 0,65 m de radio (intercambiables, como en el material de campaña): un ciclo = una vuelta = 4,08 m. */
const VUELTA = 2 * Math.PI * ARMON.R;
[['paso', 1.7], ['trote', 3.6], ['galope', 5.5]].forEach(([n, v]) => { const dur = VUELTA / v, N = 48, bote = n === 'paso' ? 0.004 : n === 'trote' ? 0.012 : 0.02;
  const c = {dur, loop: true, tracks: {}, ev: [[0, 'vuelta']]};
  ['ruedaAI', 'ruedaAD', 'ruedaPI', 'ruedaPD'].forEach(r => { c.tracks[r] = curva(N, t => [360 * t, 0, 0]); });
  c.root = curva(N, t => [0, bote * Math.abs(Math.sin(2 * Math.PI * t * 3)), 0]);
  c.tracks.avantren = curva(N, t => [0.15 * Math.sin(2 * Math.PI * t * 3 + 0.4) * (bote / 0.01), 0, 0]);
  c.tracks.arrastre = curva(N, t => [0, 0.6 * Math.sin(2 * Math.PI * t) * (bote / 0.01), 0]);
  c.tracks.lanza = curva(N, t => [1.2 * Math.sin(2 * Math.PI * t * 3) * (bote / 0.01), 0, 0]);
  defC('armon', 'art_rodar_' + n, c, {avance: VUELTA, velocidad: v, ruedaR: ARMON.R, transiciones: ['art_rodar_paso', 'art_rodar_trote', 'art_rodar_galope', 'art_rodar_parado', 'art_rodar_giro_izq', 'art_rodar_giro_der'].filter(x => x !== 'art_rodar_' + n)}); });
defC('armon', 'art_rodar_parado', {dur: 4, loop: true, tracks: {lanza: [[0, 1, 0, 0], [0.5, 1.5, 0, 0], [1, 1, 0, 0]]}, ev: []}, {transiciones: ['art_rodar_paso', 'art_explota']});
// giro al trote: el juego gira el avantrén META.giro °/s; la pieza remolcada abre ángulo en el pinzote y la rueda interior gira menos
[['izq', 1], ['der', -1]].forEach(([n, s]) => { const v = 3.6, dur = VUELTA / v, N = 48, c = {dur, loop: true, tracks: {}, ev: [[0, 'vuelta']]}, w = 30 * D2R, rad = v / w, di = 1 - ARMON.ruedaX / rad, de = 1 + ARMON.ruedaX / rad;
  c.tracks[s > 0 ? 'ruedaAI' : 'ruedaAD'] = curva(N, t => [360 * t * di, 0, 0]); c.tracks[s > 0 ? 'ruedaAD' : 'ruedaAI'] = curva(N, t => [360 * t * de, 0, 0]);
  c.tracks.ruedaPI = curva(N, t => [360 * t * (s > 0 ? di : de), 0, 0]); c.tracks.ruedaPD = curva(N, t => [360 * t * (s > 0 ? de : di), 0, 0]);
  c.tracks.arrastre = curva(N, () => [0, -s * 16, 0]); c.tracks.lanza = curva(N, () => [1, s * 8, 0]);
  defC('armon', 'art_rodar_giro_' + n, c, {avance: VUELTA, giro: 30 * s, transiciones: ['art_rodar_trote']}); });
/* desenganchar (8 s): dos servidores levantan la contera del pinzote, la pieza gira 180° sobre su eje y la contera baja al suelo; al acabar,
   relevo: la pieza queda como figura propia (art_<pieza>, rumbo igual al del avantrén, en META.relevo.pieza) y el avantrén sigue solo */
function desenganche(k) {
  const N = 120, dur = 8, c = {dur, loop: false, tracks: {}, ev: [[0.08, 'agarrar_contera'], [0.18, 'sacar_del_pinzote'], [0.3, 'girar_pieza'], [0.78, 'contera_al_suelo'], [0.9, 'en_bateria']]};
  // la pieza (arrastre) gira alrededor de su eje (no del pinzote): pos = eje − R·eje; y al final se baja la contera (pieza horizontal)
  const D = PIEZAS[k], Fm = FAM[D.fam], eje = new THREE.Vector3(...ARMON.ejeP), q = new THREE.Quaternion(), e = new THREE.Euler(), M0 = marcoRemolque(k);
  const lev = Math.atan2(ARMON.pinzote[1] - 0.1 - (Fm.R - ARMON.R), D.Lc) / D2R;
  const ang = t => ({yaw: 180 * sstep(0.3, 0.75, t), pitch: lerpK([[0, 0], [0.18, 3], [0.3, 4], [0.75, 4], [0.9, -lev], [1, -lev]], t)[0], dz: -0.35 * sstep(0.18, 0.3, t)});
  const tr = [], ps = [];
  for (let i = 0; i <= N; i++) { const t = i / N, a = ang(t); e.set(-a.pitch * D2R, a.yaw * D2R, 0, 'YXZ'); q.setFromEuler(e); e.setFromQuaternion(q, 'XYZ');
    const p = eje.clone().sub(eje.clone().applyQuaternion(q)); tr.push([+t.toFixed(4), e.x / D2R, e.y / D2R, e.z / D2R]); ps.push([+t.toFixed(4), p.x, p.y, p.z + a.dz]); }
  c.tracks.arrastre = tr; c.pos = {arrastre: ps}; c.tracks.lanza = [[0, 1, 0, 0]];
  // las ruedas de la pieza ruedan lo que gira (giro sobre el eje: una adelante y otra atrás)
  const arco = Math.PI * ARMON.ruedaPX / ARMON.R / D2R; c.tracks.ruedaPI = curva(60, t => [arco * sstep(0.3, 0.75, t), 0, 0]); c.tracks.ruedaPD = curva(60, t => [-arco * sstep(0.3, 0.75, t), 0, 0]);
  // posición final de la pieza en el marco del avantrén: su eje en ejeP + dz, rumbo 0 (boca hacia +z)
  const ejeFin = [0, 0, ARMON.ejeP[2] - 0.35];
  defC('armon', `art_${k}_desenganchar`, c, {pieza: k, relevo: {pieza: `art_${k}`, desfase: [0, ejeFin[2], 0], clip: `art_${k}_reposo`, avantren: 'art_avantren'}, transiciones: [], dotacion: [`art_contera_iz_${k}`, `art_contera_de_${k}`]});
  // enganchar: el mismo movimiento al revés
  const r = {dur, loop: false, tracks: {}, ev: [[0.1, 'agarrar_contera'], [0.22, 'girar_pieza'], [0.82, 'al_pinzote'], [0.92, 'enganchada']]};
  Object.entries(c.tracks).forEach(([kk, v]) => { r.tracks[kk] = v.map(q2 => [+(1 - q2[0]).toFixed(4)].concat(q2.slice(1))).reverse(); });
  r.pos = {arrastre: c.pos.arrastre.map(q2 => [+(1 - q2[0]).toFixed(4)].concat(q2.slice(1))).reverse()};
  defC('armon', `art_${k}_enganchar`, r, {pieza: k, previo: {pieza: `art_${k}`, desfase: [0, ejeFin[2], 0]}, transiciones: ['art_rodar_paso', 'art_rodar_trote'], dotacion: [`art_contera_iz_${k}_eng`, `art_contera_de_${k}_eng`]});
  void M0;
}
Object.entries(PIEZAS).forEach(([k, D]) => { if (D.fam === 'p_campana') desenganche(k); });
// explosión del cofre (avantrén, carro de municiones o pieza enganchada): la tapa y el cajón saltan, las ruedas se sueltan
{ const N = 80, c = {dur: 3, loop: false, tracks: {}, ev: [[0, 'impacto'], [0.04, 'explosion'], [0.06, 'onda'], [0.5, 'restos'], [0.7, 'fuego']]};
  c.tracks.arrastre = curva(N, t => [lerpK([[0, 0], [0.04, 0], [0.3, -70], [0.6, -170], [1, -175]], t)[0], 30 * sstep(0.04, 0.6, t), 40 * sstep(0.04, 0.6, t)]);
  c.pos = {arrastre: curva(N, t => { const u = Math.min(1, Math.max(0, (t - 0.04) / 0.5)); return [0.6 * u, 3.2 * u - 3.4 * u * u + (u >= 1 ? -0.2 : 0), -1.2 * u]; }),
    ruedaAI: curva(N, t => { const u = Math.min(1, Math.max(0, (t - 0.04) / 0.45)); return [1.5 * u, 1.6 * u - 2.0 * u * u, 0.3 * u]; }), ruedaPD: curva(N, t => { const u = Math.min(1, Math.max(0, (t - 0.04) / 0.5)); return [-1.8 * u, 1.2 * u - 1.6 * u * u, -0.5 * u]; })};
  c.tracks.ruedaAI = curva(N, t => [0, 0, 85 * sstep(0.04, 0.45, t)]); c.tracks.ruedaPD = curva(N, t => [0, 0, -85 * sstep(0.04, 0.5, t)]);
  c.tracks.avantren = curva(N, t => [-8 * sstep(0.04, 0.2, t), 0, 12 * sstep(0.04, 0.3, t)]); c.tracks.lanza = curva(N, t => [12 * sstep(0.05, 0.3, t), 0, 0]);
  defC('armon', 'art_explota', c, {suelo: 'apoyado', dano: 'explosion', radio: 12, transiciones: []}); }

/* ===================================================================================== */
/* DOTACIONES: clips del soldado en el MARCO DE LA PIEZA (cada servidor se coloca en el origen de la pieza, con su rumbo; el clip lleva la
   posición y la orientación). Las herramientas se colocan en el mundo (boca, oído, cierre, rueda, contera, avantrén) y se convierten al
   espacio del torso con la cinemática de troops3d; las manos van por IK. Los eventos comunes con la pieza caen en los mismos instantes. */
const CLIPS_S = {}, META_S = {}, DOTACIONES = {};
function servidores(T3, INFm) {
  const H = INFm._herramientas, PS = INFm.POSES, W = PS.W, con = H.con;
  const IXS = {}; T3.RIGS.soldado.forEach((p, i) => { IXS[p[0]] = i; });
  const eul = new THREE.Euler(), q1 = new THREE.Quaternion(), q2 = new THREE.Quaternion(), Y = new THREE.Vector3(0, 1, 0);
  // orientar: la pelvis (raíz) lleva el rumbo; la postura propia de la pelvis se compone después
  const orientar = (pose, yaw) => { const p = pose.pelvis || [0, 0, 0]; q1.setFromEuler(eul.set(p[0] * D2R, p[1] * D2R, p[2] * D2R, 'XYZ')); q2.setFromAxisAngle(Y, yaw * D2R).multiply(q1);
    if (!p[0] && !p[1] && !p[2]) return Object.assign({}, pose, {pelvis: [0, yaw, 0]});
    // de las dos soluciones XYZ, la que conserva el rumbo (evita que el cuerpo se «tumbe» al interpolar rumbos de más de 90°)
    eul.setFromQuaternion(q2, 'XYZ'); const a = [eul.x / D2R, eul.y / D2R, eul.z / D2R], b = [a[0] + 180, 180 - a[1], a[2] + 180], dist = v => Math.abs((((v - yaw) % 360) + 540) % 360 - 180);
    const sel = dist(b[1]) < dist(a[1]) ? b : a; sel[1] = yaw + ((((sel[1] - yaw) % 360) + 540) % 360 - 180); return Object.assign({}, pose, {pelvis: sel}); };
  // posturas sin inclinación de la pelvis (la inclinación va en el torso para que el rumbo no la tuerza)
  const PIE = con(PS.FIRME, {brazoIz: [-6, 0, 8], antebrazoIz: [-14, 0, 0], brazoDe: [-6, 0, -8], antebrazoDe: [-14, 0, 0]});
  const INCL = (a, b) => con(PIE, Object.assign({torso: [a, 0, 0], cabeza: [-a * 0.5, 0, 0]}, b || {}));
  const AGACH = (b) => con(PIE, Object.assign({musloIz: [-72, 0, 10], piernaIz: [108, 0, 0], pieIz: [-30, 0, 0], musloDe: [-58, 0, -10], piernaDe: [100, 0, 0], pieDe: [-36, 0, 0], torso: [30, 0, 0], cabeza: [-20, 0, 0]}, b || {}));
  const RODI = (b) => con(PS.RODILLA, Object.assign({brazoIz: [-20, 0, 10], antebrazoIz: [-40, 0, 0], brazoDe: [-20, 0, -10], antebrazoDe: [-40, 0, 0]}, b || {}));
  const EMPUJA = con(PIE, {torso: [38, 0, 0], cabeza: [-25, 0, 0], musloIz: [-34, 0, 4], piernaIz: [40, 0, 0], musloDe: [26, 0, -4], piernaDe: [6, 0, 0], pieDe: [14, 0, 0], brazoIz: [-75, 0, 8], antebrazoIz: [-20, 0, 0], brazoDe: [-75, 0, -8], antebrazoDe: [-20, 0, 0]});
  const SENT = (b) => con(PIE, Object.assign({pelvis: [-70, 0, 0], torso: [52, 0, 0], musloIz: [-20, 0, 10], musloDe: [-20, 0, -10], piernaIz: [20, 0, 0], piernaDe: [20, 0, 0], pieIz: [-30, 0, 0], pieDe: [-30, 0, 0]}, b || {}));
  const PANZA = (b) => con(PS.BOCA_ABAJO, Object.assign({torso: [-26, 0, 0], cabeza: [-50, 0, 0]}, b || {}));
  const zancada = (f, run) => { const a = run ? 30 : 22, s = Math.cos(f * Math.PI); return {musloIz: [-a * s - (run ? 8 : 0), 0, 3], piernaIz: [(run ? 30 : 8) + (s < 0 ? (run ? 60 : 30) : 0), 0, 0], pieIz: [0, 0, 0],
    musloDe: [a * s - (run ? 8 : 0), 0, -3], piernaDe: [(run ? 30 : 8) + (s > 0 ? (run ? 60 : 30) : 0), 0, 0], pieDe: [0, 0, 0], torso: [run ? 12 : 3, 0, 0], brazoIz: [a * 0.8 * s, 0, 8], antebrazoIz: [run ? -80 : -20, 0, 0], brazoDe: [-a * 0.8 * s, 0, -8], antebrazoDe: [run ? -80 : -20, 0, 0]}; };

  function Serv(dur, loop) { this.C = new H.Clip(dur, loop !== false); this.herr = []; this.vis = []; this.dur = dur; }
  Serv.prototype.en = function (t, x, z, yaw, pose) { if (this.yaw0 != null) { while (yaw - this.yaw0 > 180) yaw -= 360; while (yaw - this.yaw0 < -180) yaw += 360; } this.yaw0 = yaw;
    const o = orientar(pose, yaw); if (this.pv) o.pelvis = o.pelvis.map((v, i) => { while (v - this.pv[i] > 180) v -= 360; while (v - this.pv[i] < -180) v += 360; return v; }); this.pv = o.pelvis;
    this.C.k(t, o); this.C.r(t, x, 0, z); return this; };
  Serv.prototype.camina = function (t0, t1, a, b, o) { o = o || {}; const d = Math.hypot(b[0] - a[0], b[1] - a[1]), v = d / ((t1 - t0) * this.dur), run = v > 1.8, n = Math.max(2, Math.round(d / (run ? 0.9 : 0.65)));
    const yaw = Math.atan2(b[0] - a[0], b[1] - a[1]) / D2R;
    for (let i = 0; i <= n; i++) { const u = i / n, t = t0 + (t1 - t0) * u, p = Object.assign(zancada(i, run), o.pose || {}); if (i === 0 || i === n) Object.assign(p, {musloIz: [-4, 0, 3], piernaIz: [6, 0, 0], musloDe: [4, 0, -3], piernaDe: [6, 0, 0]});
      this.en(t, a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, o.yaw != null ? o.yaw : yaw, p); }
    return this; };
  // herramienta: p (pivote) y dir (+Y de la herramienta) en el marco de la pieza; g = [mano derecha, mano izquierda] a lo largo de la herramienta
  Serv.prototype.h = function (t, p, dir, g) { this.herr.push([t, p, dir, g]); return this; };
  Serv.prototype.ver = function (t, v) { this.vis.push([t, v ? 1 : 0]); return this; };
  Serv.prototype.e = function (t, n) { this.C.e(t, n); return this; };
  Serv.prototype.fin = function (T3, nombre, meta) {
    const c = this.C.fin(), NA = Math.max(120, Math.round(this.dur * 40)), suelo = {suelo: meta && meta.suelo || 'pie'}; H.asentar(T3, nombre, c, suelo, NA);
    const S = T3.CLIPS.soldado, tmp = '__art3d_tmp';
    if (this.herr.length) {   // si las manos no llegan a la herramienta, el servidor se acerca (se desplaza la raíz), no la herramienta
      S[tmp] = c; const Mt = new THREE.Matrix4(), shoulder = new THREE.Vector3(), add = [];
      this.herr.forEach(([t, p, dir, g]) => { const m = T3.poseTroop('soldado', tmp, t); Mt.fromArray(m, IXS.torso * 16); let dx = 0, dz = 0, peor = 0;
        [[g[0], -0.205], [g[1], 0.205]].forEach(([y, sx]) => { if (y < 0) return; shoulder.set(sx, 0.435, 0).applyMatrix4(Mt); const G = p.map((v, i) => v + dir[i] / Math.hypot(...dir) * y), d = [G[0] - shoulder.x, G[1] - shoulder.y, G[2] - shoulder.z], L = Math.hypot(...d), ex = L - 0.5;
          if (ex > peor) { const h = Math.hypot(d[0], d[2]) || 1; peor = ex; dx = d[0] / h * ex; dz = d[2] / h * ex; } });
        if (peor > 0.005) add.push([t, dx, dz]); });
      delete S[tmp];
      if (add.length) { const base = c.root.slice(), at = t => { const tr = base; for (let j = 0; j < tr.length - 1; j++) if (t <= tr[j + 1][0]) { const a = tr[j], b = tr[j + 1], u = (t - a[0]) / Math.max(1e-6, b[0] - a[0]); return [a[1] + (b[1] - a[1]) * u, a[3] + (b[3] - a[3]) * u]; } return [tr[tr.length - 1][1], tr[tr.length - 1][3]]; };
        // desplazamiento suave: se interpola entre las claves de herramienta (y vuelve a 0 lejos de ellas)
        const off = t => { let w = 0, x = 0, z = 0; add.forEach(([ta, ax, az]) => { const k = Math.max(0, 1 - Math.abs(t - ta) * this.dur / 0.6); if (k > 0) { w += k; x += ax * k; z += az * k; } }); return w > 0 ? [x / Math.max(1, w), z / Math.max(1, w)] : [0, 0]; };
        c.root = base.map(([t, x, y, z]) => { const o = off(t); return [t, x + o[0], y, z + o[1]]; }); H.asentar(T3, nombre, c, suelo, NA); }
    }
    if (this.herr.length) {   // herramienta al espacio del torso (FK de troops3d con la raíz ya asentada)
      S[tmp] = c; const M = new THREE.Matrix4(), Tw = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(1, 1, 1);
      const P = [], R = [], G = []; let prev = null;
      this.herr.sort((a, b) => a[0] - b[0]).forEach(([t, p, dir, g]) => { const m = T3.poseTroop('soldado', tmp, t); M.fromArray(m, IXS.torso * 16).invert();
        q.setFromUnitVectors(Y, new THREE.Vector3(...dir).normalize()); Tw.compose(new THREE.Vector3(...p), q, sc).premultiply(M);
        const pos = new THREE.Vector3(), qq = new THREE.Quaternion(); Tw.decompose(pos, qq, new THREE.Vector3()); e.setFromQuaternion(qq, 'XYZ'); let r = [e.x / D2R, e.y / D2R, e.z / D2R];
        if (prev) r = r.map((v, i) => { while (v - prev[i] > 180) v -= 360; while (v - prev[i] < -180) v += 360; return v; }); prev = r;
        P.push([t, pos.x, pos.y, pos.z]); R.push([t].concat(r)); G.push([t].concat(g)); });
      delete S[tmp]; c.tracks.armaP = P; c.tracks.armaR = R; c.tracks.agarre = G; H.alcanzar(T3, c, 0.56);
    }
    if (this.vis.length) c.hide = Object.assign(c.hide || {}, {arma: this.vis.sort((a, b) => a[0] - b[0])});
    c.ev.sort((a, b) => a[0] - b[0]); CLIPS_S[nombre] = c;
    META_S[nombre] = Object.assign({suelo: 'pie', avance: 0, desplazamiento: [0, 0, 0], armaCompatible: ERAS.slice(), transiciones: [], marcoPieza: true}, meta || {}); META_S[nombre].eventos = c.ev.map(x => x[1]);
    return c; };

  /* ---------- avancarga (A, M): jefe, n.º 1 a 6 ---------- */
  function avancarga(k) {
    const D = PIEZAS[k], ci = CICLOS[D.ciclo], dur = ci.dur, pt = puntos(k), el = elevDe(k), B = enPieza(k, pt.boca, el), Cu = enPieza(k, pt.culata, el), O = enPieza(k, pt.oido || pt.culata, el);
    const ax = [0, Math.sin(el * D2R), Math.cos(el * D2R)], dentro = ax.map(v => -v), ret = RETROCESO[k] || 0, Lc = D.Lc, F = FAM[D.fam], xr = F.ruedaX + 0.3, hB = B[1];
    const zR = t => ret ? -ret * (t < 0.04 ? 1 - Math.pow(1 - t / 0.04, 2) : 1 - sstep(0.07, 0.17, t)) : 0;
    const xb = Math.max(0, (1.02 - hB) * 95), INCLb = (a, b) => INCL(a + xb, b), prof = Math.min(D.L * 0.85, 1.55), add = (a, b, k2) => a.map((v, i) => v + b[i] * (k2 == null ? 1 : k2)), sfx = '_' + k, dot = [];
    const ev = n => ci.ev.find(e => e[1] === n)[0];
    // n.º 1 — escobillón: lanada (punta dentro, +Y hacia dentro) y atacador (pivote dentro, +Y hacia fuera)
    { const s = new Serv(dur), P1 = [-0.55, B[2] + 0.25], Pc = [-1.25, B[2] - 0.3], up = (x, z, yaw) => [add([x, 0.04, z], [Math.cos(yaw * D2R) * -0.22 * -1, 0, 0]), [0, 1, 0], [1.15, -1]];
      const reposo = (t, x, z, yaw) => { const [p, d, g] = up(x, z, yaw); s.h(t, [x + (yaw > 0 ? 0 : 0) - 0.0, 0.04, z - 0.25 * Math.sin(yaw * D2R) + 0.0].map((v, i) => i === 0 ? x - 0.25 * Math.cos(yaw * D2R) * 0 + (yaw === 90 ? 0 : 0) : v), d, g); };
      const descanso = (t, x, z) => s.h(t, [x, 0.05, z + 0.28], [0, 1, 0], [1.15, -1]);
      s.en(0, Pc[0], Pc[1], 90, INCL(2)).en(0.17, Pc[0], Pc[1], 90, INCL(2)); descanso(0, Pc[0], Pc[1]); descanso(0.17, Pc[0], Pc[1]);
      s.camina(0.17, 0.185, Pc, P1, {yaw: 90}); descanso(0.185, P1[0], P1[1]);
      // escobillar
      const lan = (t, d) => s.h(t, add(B, dentro, d - 2.3), dentro, [Math.max(0.1, 2.3 - d - 0.75), 2.3 - d - 0.2]);
      s.en(0.19, P1[0], P1[1], 90, INCLb(12)); lan(0.19, 0.05); lan(0.215, prof * 0.7); lan(0.23, prof);
      for (let i = 0; i < 3; i++) { lan(0.24 + i * 0.012, prof - 0.08 * (i % 2)); }
      s.en(0.25, P1[0], P1[1], 90, INCLb(16)); lan(0.275, prof); s.e(0.22, 'giro').e(0.26, 'giro');
      s.h(0.3, add(B, dentro, 0.1 - 2.3), dentro, [0.7, 1.3]); s.en(0.3, P1[0], P1[1], 90, INCLb(8));
      // volteo del escobillón (vertical) y atacar
      s.h(0.32, [P1[0] + 0.25, 0.25, P1[1] + 0.1], [0, 1, 0], [0.9, 1.4]); s.h(0.335, [P1[0] + 0.3, 1.6, P1[1] + 0.1], [0, -1, 0], [0.5, 1.0]);
      const ata = (t, d) => s.h(t, add(B, dentro, d), ax, [d + 0.45, d + 0.95]);
      ata(0.35, 0.05); ata(0.38, prof * 0.8); ata(0.4, prof); ata(0.41, prof - 0.25); ata(0.42, prof); ata(0.44, prof * 0.4); ata(0.46, 0.0);
      s.en(0.38, P1[0], P1[1], 90, INCLb(18)).en(0.42, P1[0], P1[1], 90, INCLb(14)).e(0.36, 'atacar').e(0.4, 'golpe').e(0.42, 'golpe');
      s.h(0.48, [P1[0] + 0.3, 1.4, P1[1] + 0.1], [0, -1, 0], [0.4, 0.9]); descanso(0.5, P1[0], P1[1]); s.en(0.5, P1[0], P1[1], 90, INCL(2));
      s.en(0.8, P1[0], P1[1], 90, INCL(2)); descanso(0.8, P1[0], P1[1]); s.camina(0.8, 0.84, P1, Pc, {yaw: 90}); descanso(0.84, Pc[0], Pc[1]); s.en(1, Pc[0], Pc[1], 90, INCL(2)); descanso(1, Pc[0], Pc[1]);
      s.e(0, 'disparo').e(ev('escobillar'), 'escobillar').e(0.8, 'listo');
      s.fin(T3, 'art_A_escobillon' + sfx, {pieza: k, ciclo: D.ciclo, rol: 'escobillon', tipo: 'inf_art_escobillon', sincronizar: true, contactos: [[0.23, 'punta', 'boca_dentro'], [0.4, 'pivote', 'boca_dentro']]});
      dot.push({rol: 'escobillon', tipo: 'inf_art_escobillon', clip: 'art_A_escobillon' + sfx}); }
    // n.º 2 — cargador: recibe el saquete del n.º 5 y lo introduce por la boca
    { const s = new Serv(dur), P2 = [0.55, B[2] + 0.25], Pc = [1.25, B[2] - 0.3];
      s.en(0, Pc[0], Pc[1], -90, INCL(2)).en(0.17, Pc[0], Pc[1], -90, INCL(2)); s.camina(0.17, 0.19, Pc, P2, {yaw: -90}); s.en(0.26, P2[0], P2[1], -90, PIE);
      s.en(0.28, P2[0], P2[1], -150, INCLb(6, {brazoIz: [-60, 0, 0], brazoDe: [-60, 0, 0]})); s.en(0.31, P2[0], P2[1], -90, INCLb(10)); s.en(0.335, P2[0], P2[1], -90, INCLb(16)).en(0.36, P2[0], P2[1], -90, PIE);
      const sq = (t, p, d) => s.h(t, p, d, [0.02, 0.12]);
      sq(0.28, [0.85, 1.05, B[2] - 0.25], [0, 0, 1]); sq(0.3, [0.4, 1.1, B[2] + 0.25], [-1, 0, 0]); sq(0.32, add(B, ax, 0.12), dentro); sq(0.335, add(B, dentro, 0.12), dentro);
      s.ver(0, 0).ver(0.28, 1).ver(0.345, 0); s.en(0.8, P2[0], P2[1], -90, PIE); s.camina(0.8, 0.84, P2, Pc, {yaw: -90}); s.en(1, Pc[0], Pc[1], -90, INCL(2));
      s.e(0, 'disparo').e(ev('entrega'), 'entrega').e(ev('cargar'), 'cargar').e(0.8, 'listo');
      s.fin(T3, 'art_A_cargador' + sfx, {pieza: k, ciclo: D.ciclo, rol: 'cargador', tipo: 'inf_art_cargador', sincronizar: true, contactos: [[0.335, 'centro', 'boca_dentro']]});
      dot.push({rol: 'cargador', tipo: 'inf_art_cargador', clip: 'art_A_cargador' + sfx}); }
    // n.º 3 — tapa el oído, pincha el cartucho y dirige la contera con el espeque; ayuda a devolver la pieza con el espeque en los rayos
    { const s = new Serv(dur), P3 = [-0.4, Cu[2] - 0.5], Pc = [-xr - 0.15, Cu[2] - 0.6], Ctz = -Lc;
      s.en(0, Pc[0], Pc[1], 20, PIE); s.h(0, [Pc[0] - 0.15, 0.02, Pc[1] + 0.05], [0, 1, 0], [0.9, -1]);
      // devolver: el espeque entre los rayos de la rueda derecha, empujando con la pieza
      const rueda = t => [-F.ruedaX, F.R, zR(t)];
      [0.07, 0.12, 0.17].forEach((t, i) => { const w = rueda(t); s.en(t, -xr - 0.1, w[2] - 0.75, 0, i === 0 ? INCL(20) : EMPUJA); s.h(t, [-xr + 0.05, 0.95, w[2] - 0.5], [0.2, -0.45, 0.6], [0.05, 0.4]); });
      s.camina(0.17, 0.18, [-xr - 0.1, -0.75], P3, {yaw: 0}); s.h(0.18, [P3[0] - 0.2, 0.02, P3[1]], [0, 1, 0], [-1, 0.9]);
      // tapar el oído con el pulgar (mano derecha libre sobre el oído)
      const tapa = INCL(28, {brazoDe: [-62, 0, 18], antebrazoDe: [-30, 0, 0], cabeza: [-6, 0, 0]});
      s.en(0.19, P3[0], P3[1], 8, tapa).en(0.45, P3[0], P3[1], 8, tapa).en(0.46, P3[0], P3[1], 8, INCL(30, {brazoDe: [-70, 0, 18], antebrazoDe: [-40, 0, 0]})).en(0.48, P3[0], P3[1], 8, INCL(4));
      s.h(0.45, [P3[0] - 0.2, 0.02, P3[1]], [0, 1, 0], [-1, 0.9]);
      // contera: el espeque en la argolla para dar dirección (señales del jefe)
      const Pt = [-0.42, Ctz - 0.45]; s.camina(0.48, 0.52, P3, Pt, {}); s.en(0.53, Pt[0], Pt[1], 10, INCL(30));
      const palanca = (t, dx) => s.h(t, [-0.32 + dx, 0.95, Ctz - 0.2], [0.25 - dx, -0.75, 0.45], [0.05, 0.42]);
      palanca(0.53, 0); s.en(0.57, Pt[0] + 0.05, Pt[1], 10, INCL(36)); palanca(0.57, 0.1); s.en(0.62, Pt[0] - 0.05, Pt[1], 10, INCL(30)); palanca(0.62, -0.08); palanca(0.68, 0); s.en(0.68, Pt[0], Pt[1], 10, INCL(20));
      s.e(0.57, 'palanca').e(0.62, 'palanca');
      s.camina(0.7, 0.76, Pt, P3, {}); s.h(0.76, [P3[0] - 0.2, 0.02, P3[1]], [0, 1, 0], [-1, 0.9]); s.camina(0.8, 0.84, P3, Pc, {}); s.en(1, Pc[0], Pc[1], 20, PIE); s.h(1, [Pc[0] - 0.15, 0.02, Pc[1] + 0.05], [0, 1, 0], [0.9, -1]);
      s.e(0, 'disparo').e(ev('devolver'), 'devolver').e(ev('tapar_oido'), 'tapar_oido').e(ev('pinchar'), 'pinchar').e(ev('apuntar'), 'apuntar').e(0.8, 'listo');
      s.fin(T3, 'art_A_cebador' + sfx, {pieza: k, ciclo: D.ciclo, rol: 'cebador', tipo: 'inf_art_cebador', sincronizar: true});
      dot.push({rol: 'cebador', tipo: 'inf_art_cebador', clip: 'art_A_cebador' + sfx}); }
    // n.º 4 — empuja la rueda izquierda, ceba con el estopín y da fuego con el tirafrictor desde un lado
    { const s = new Serv(dur), P4 = [0.4, Cu[2] - 0.5], Pf = [xr + 0.7, Cu[2] - 1.1], cord = (t, mano) => { const u = [mano[0] - O[0], mano[1] - O[1], mano[2] - O[2]], l = Math.hypot(...u), d = u.map(v => -v / l); s.h(t, add(O, u, Math.min(1, 1.1 / l)), d, [0.0, -1]); };
      s.en(0, Pf[0], Pf[1], -55, INCL(4, {brazoDe: [-40, 0, -30], antebrazoDe: [-10, 0, 0]})); cord(0, [Pf[0] - 0.35, 1.0, Pf[1] + 0.25]); s.en(0.02, Pf[0], Pf[1], -55, INCL(-4)); cord(0.02, [Pf[0] - 0.2, 1.0, Pf[1]]);
      s.ver(0, 1).ver(0.05, 0);
      [0.07, 0.12, 0.17].forEach((t, i) => { const z = zR(t); s.en(t, xr + 0.1, z - 0.75, 0, i === 0 ? INCL(20) : EMPUJA); });
      s.camina(0.17, 0.19, [xr + 0.1, -0.75], P4, {}); s.en(0.7, P4[0], P4[1], -5, PIE);
      s.en(0.72, P4[0] - 0.15, P4[1] + 0.2, -10, INCL(26, {brazoDe: [-65, 0, -10], antebrazoDe: [-35, 0, 0]})).ver(0.71, 1); cord(0.72, add(O, [0.0, 0.08, -0.02])); s.h(0.721, add(O, [0, 0.05, -0.02]), [0.3, 0.5, -0.7], [0.0, -1]);
      s.camina(0.74, 0.8, [P4[0] - 0.15, P4[1] + 0.2], Pf, {}); cord(0.8, [Pf[0] - 0.3, 1.0, Pf[1] + 0.25]); s.en(0.84, Pf[0], Pf[1], -55, INCL(4, {brazoDe: [-40, 0, -30], antebrazoDe: [-10, 0, 0]}));
      cord(0.99, [Pf[0] - 0.35, 1.0, Pf[1] + 0.25]); s.en(1, Pf[0], Pf[1], -55, INCL(4, {brazoDe: [-40, 0, -30], antebrazoDe: [-10, 0, 0]})); cord(1, [Pf[0] - 0.35, 1.0, Pf[1] + 0.25]);
      s.e(0, 'disparo').e(0, 'tirar').e(ev('devolver'), 'devolver').e(ev('cebar'), 'cebar').e(0.8, 'listo');
      s.fin(T3, 'art_A_tirador' + sfx, {pieza: k, ciclo: D.ciclo, rol: 'tirador', tipo: 'inf_art_tirador', sincronizar: true});
      dot.push({rol: 'tirador', tipo: 'inf_art_tirador', clip: 'art_A_tirador' + sfx}); }
    // n.º 5 — municionero: corre al avantrén (5 m detrás de la contera), recoge el saquete del n.º 6 y lo entrega al n.º 2
    const AV = [0.9, -Lc - 5.2];
    { const s = new Serv(dur), P5 = [1.2, B[2] - 0.5], H5 = [0.85, 1.05, B[2] - 0.25];
      s.en(0, P5[0], P5[1], -160, PIE); s.camina(0.02, 0.12, P5, [AV[0] + 0.2, AV[1] + 0.6]); s.en(0.135, AV[0] + 0.2, AV[1] + 0.6, 180, INCL(10, {brazoIz: [-60, 0, 0], brazoDe: [-60, 0, 0]}));
      s.camina(0.14, 0.26, [AV[0] + 0.2, AV[1] + 0.6], P5); s.en(0.28, P5[0], P5[1], -90, INCL(8)); s.en(0.3, P5[0], P5[1], -160, PIE); s.en(1, P5[0], P5[1], -160, PIE);
      s.h(0.13, [AV[0] + 0.2, 1.0, AV[1] + 0.95], [0, 0, 1], [0.02, 0.12]); s.h(0.26, [P5[0] - 0.1, 1.0, P5[1] + 0.3], [0, 0, 1], [0.02, 0.12]); s.h(0.28, H5, [0, 0, 1], [0.02, 0.12]);
      s.ver(0, 0).ver(0.13, 1).ver(0.285, 0); s.e(0, 'disparo').e(ev('entrega'), 'entrega');
      s.fin(T3, 'art_A_municionero' + sfx, {pieza: k, ciclo: D.ciclo, rol: 'municionero', tipo: 'inf_art_municionero', sincronizar: true});
      dot.push({rol: 'municionero', tipo: 'inf_art_municionero', clip: 'art_A_municionero' + sfx}); }
    // n.º 6 — en el cofre del avantrén: saca el saquete, le pone la espoleta (granada) y lo da al n.º 5
    { const s = new Serv(dur), P6 = [AV[0] - 0.35, AV[1] + 1.1];
      s.en(0, P6[0], P6[1], 180, INCL(30, {brazoIz: [-60, 0, 10], brazoDe: [-60, 0, -10]})).en(0.06, P6[0], P6[1], 180, INCL(40, {brazoIz: [-70, 0, 10], brazoDe: [-70, 0, -10]})).en(0.1, P6[0], P6[1], 120, INCL(8));
      s.en(0.13, P6[0], P6[1], 100, INCL(10, {brazoIz: [-60, 0, 0]})).en(0.16, P6[0], P6[1], 180, INCL(30)).en(1, P6[0], P6[1], 180, INCL(30, {brazoIz: [-60, 0, 10], brazoDe: [-60, 0, -10]}));
      s.h(0.08, [P6[0] + 0.05, 1.0, P6[1] - 0.4], [1, 0, 0], [0.02, 0.12]); s.h(0.13, [AV[0] + 0.2, 1.0, AV[1] + 0.95], [0, 0, 1], [0.02, 0.12]); s.ver(0, 0).ver(0.07, 1).ver(0.135, 0);
      s.e(0, 'disparo').e(0.13, 'entrega_avantren');
      s.fin(T3, 'art_A_avantren' + sfx, {pieza: k, ciclo: D.ciclo, rol: 'municionero_avantren', tipo: 'inf_art_municionero', sincronizar: true});
      dot.push({rol: 'municionero_avantren', tipo: 'inf_art_municionero', clip: 'art_A_avantren' + sfx}); }
    // jefe de pieza: apunta por encima de la culata, mueve el tornillo de puntería y manda «¡fuego!»
    { const s = new Serv(dur), PJ = [xr + 0.2, -Lc + 0.7], PA = [0.0, Cu[2] - 0.8], esp = W.ESP_BAJA;
      s.en(0, PJ[0], PJ[1], -20, PIE).en(0.48, PJ[0], PJ[1], -20, PIE); s.camina(0.48, 0.52, PJ, PA, {}); s.en(0.53, PA[0], PA[1], 0, AGACH({torso: [22, 0, 0], cabeza: [-30, 0, 0]}));
      s.en(0.58, PA[0], PA[1], 0, AGACH({torso: [30, 0, 0], brazoDe: [-50, 0, -6], antebrazoDe: [-30, 0, 0]})).en(0.6, PA[0], PA[1], 0, AGACH({torso: [30, 0, 0], brazoDe: [-50, 0, -6], antebrazoDe: [-60, 0, 0]}));
      s.en(0.63, PA[0], PA[1], 0, AGACH({torso: [22, 0, 0], brazoIz: [-80, 0, 50], antebrazoIz: [-10, 0, 0]})).en(0.66, PA[0], PA[1], 0, AGACH({torso: [22, 0, 0], brazoIz: [-80, 0, -10], antebrazoIz: [-10, 0, 0]}));
      s.en(0.68, PA[0], PA[1], 0, PIE); s.camina(0.69, 0.74, PA, PJ, {}); s.en(0.8, PJ[0], PJ[1], -20, PIE);
      s.en(0.88, PJ[0], PJ[1], -20, con(PIE, {brazoDe: [-150, 0, -10], antebrazoDe: [-20, 0, 0]})).en(0.96, PJ[0], PJ[1], -20, con(PIE, {brazoDe: [-40, 0, -10], antebrazoDe: [-20, 0, 0], torso: [6, 0, 0]})).en(1, PJ[0], PJ[1], -20, PIE);
      s.e(0, 'disparo').e(ev('apuntar'), 'apuntar').e(0.63, 'derecha').e(0.66, 'izquierda').e(ev('listo'), 'listo').e(ev('fuego'), 'fuego');
      s.fin(T3, 'art_A_jefe' + sfx, {pieza: k, ciclo: D.ciclo, rol: 'jefe', tipo: 'inf_art_jefe', sincronizar: true});
      dot.push({rol: 'jefe', tipo: 'inf_art_jefe', clip: 'art_A_jefe' + sfx}); }
    DOTACIONES[k] = {pieza: 'art_' + k, clipPieza: `art_${k}_servicio`, ciclo: D.ciclo, servidores: dot, avantren: {tipo: 'art_avantren', desfase: [0, AV[1] - 0.8, 180]}};
  }
  ['canon_6', 'canon_12', 'obus_campana', 'asedio_24', 'montana'].forEach(avancarga);

  /* ---------- retrocarga (B sin freno; C, E, R, T con retroceso del tubo): jefe, apuntador, cierre, cargador, municionero(s) ---------- */
  function retrocarga(k) {
    const D = PIEZAS[k], ci = CICLOS[D.ciclo], dur = ci.dur, pt = puntos(k), el = elevDe(k), Cu = enPieza(k, pt.culata, el), ax = [0, Math.sin(el * D2R), Math.cos(el * D2R)], Lc = D.Lc, F = FAM[D.fam], xr = F.ruedaX + 0.3;
    const B = D.ciclo === 'B', ret = B ? RETROCESO[k] : 0, zR = t => ret ? -ret * (t < 0.04 ? 1 - Math.pow(1 - t / 0.04, 2) : 1 - sstep(0.08, 0.2, t)) : 0, ev = n => (ci.ev.find(e => e[1] === n) || [null])[0];
    const sfx = '_' + k, dot = [], bajo = k === 'antitanque' || F.R < 0.5, add = (a, b, s2) => a.map((v, i) => v + b[i] * (s2 == null ? 1 : s2)), AV = [-1.6, -Lc - 2.2];
    const postura = bajo ? RODI : (b) => INCL(10, b);
    // apuntador (izquierda de la culata): volantes de elevación y dirección, ojo en el alza
    { const s = new Serv(dur), PA = [0.48, Cu[2] - 0.15], Pc = [xr + 0.2, Cu[2] - 0.5];
      if (B) { s.en(0, Pc[0], Pc[1], -10, PIE); [0.08, 0.14, 0.2].forEach((t, i) => s.en(t, xr + 0.1, zR(t) - 0.75, 0, i ? EMPUJA : INCL(20))); s.camina(0.2, 0.24, [xr + 0.1, -0.75], PA, {}); }
      else s.en(0, PA[0], PA[1], 0, postura({cabeza: [-8, 0, 0]})).en(0.06, PA[0], PA[1], 0, postura({torso: [0, 0, 0]}));
      const vol = (t, a) => s.en(t, PA[0], PA[1], -5, (bajo ? RODI : AGACH)({torso: [26, 0, 0], cabeza: [-24, 0, 0], brazoDe: [-70 + a, 0, -20], antebrazoDe: [-50 - a, 0, 0], brazoIz: [-60 - a, 0, 10], antebrazoIz: [-60 + a, 0, 0]}));
      vol(0.55, 0); vol(0.62, 10); vol(0.68, -10); vol(0.75, 10); vol(0.82, 0); s.en(0.86, PA[0], PA[1], 0, postura()); s.en(B ? 0.92 : 1, B ? Pc[0] : PA[0], B ? Pc[1] : PA[1], 0, postura());
      if (B) { s.camina(0.88, 0.92, PA, Pc, {}); s.en(1, Pc[0], Pc[1], -10, PIE); }
      s.e(0, 'disparo').e(ev('apuntar'), 'apuntar').e(ev('listo'), 'listo'); if (B) s.e(ev('devolver'), 'devolver');
      s.fin(T3, 'art_RC_apuntador' + sfx, {pieza: k, ciclo: D.ciclo, rol: 'apuntador', tipo: 'inf_art_apuntador', sincronizar: true}); dot.push({rol: 'apuntador', tipo: 'inf_art_apuntador', clip: 'art_RC_apuntador' + sfx}); }
    // cierre (derecha): abre y cierra el cierre, y da fuego con el cordón
    { const s = new Serv(dur), PC = [-0.5, Cu[2] - 0.25], Pf = [-0.95, Cu[2] - 0.95], Pin = add(Cu, [-0.05, 0.0, -0.06]), cord = (t, mano) => { const u = [mano[0] - Pin[0], mano[1] - Pin[1], mano[2] - Pin[2]], l = Math.hypot(...u); s.h(t, add(Pin, u, Math.min(1, 0.9 / l)), u.map(v => -v / l), [0.0, -1]); };
      const brazoCierre = a => (bajo ? RODI : INCL)(bajo ? {brazoIz: [-70, 0, 20 + a], antebrazoIz: [-30, 0, 0]} : 16, bajo ? undefined : {brazoIz: [-70, 0, 20 + a], antebrazoIz: [-30, 0, 0]});
      if (B) { s.en(0, -xr - 0.2, Cu[2] - 0.5, 10, PIE); [0.08, 0.14, 0.2].forEach((t, i) => s.en(t, -xr - 0.1, zR(t) - 0.75, 0, i ? EMPUJA : INCL(20))); s.camina(0.2, 0.23, [-xr - 0.1, -0.75], PC, {}); s.ver(0, 0); }
      else { s.en(0, Pf[0], Pf[1], 20, PIE); cord(0, [Pf[0] + 0.15, 0.95, Pf[1] + 0.3]); s.en(0.03, Pf[0], Pf[1], 20, INCL(-4)); s.ver(0.08, 0); s.camina(0.08, 0.18, Pf, PC, {}); }
      s.en(0.21, PC[0], PC[1], 10, brazoCierre(0)).en(0.24, PC[0], PC[1], 10, brazoCierre(-40)).en(0.3, PC[0], PC[1], 10, brazoCierre(-40)).en(0.48, PC[0], PC[1], 10, brazoCierre(-40)).en(0.51, PC[0], PC[1], 10, brazoCierre(0));
      s.en(0.86, PC[0], PC[1], 10, PIE).ver(0.86, 1); cord(0.86, add(Pin, [-0.1, 0.05, -0.1])); s.camina(0.87, 0.93, PC, Pf, {}); cord(0.93, [Pf[0] + 0.15, 0.95, Pf[1] + 0.3]); s.en(1, Pf[0], Pf[1], 20, PIE); cord(1, [Pf[0] + 0.15, 0.95, Pf[1] + 0.3]);
      if (B) s.ver(1, 1); s.e(0, 'disparo').e(0, 'tirar').e(ev('abrir_cierre'), 'abrir_cierre').e(ev('cerrar'), 'cerrar').e(ev('listo'), 'listo'); if (B) s.e(ev('devolver'), 'devolver');
      s.fin(T3, 'art_RC_cierre' + sfx, {pieza: k, ciclo: D.ciclo, rol: 'cierre', tipo: 'inf_art_cierre', sincronizar: true}); dot.push({rol: 'cierre', tipo: 'inf_art_cierre', clip: 'art_RC_cierre' + sfx}); }
    // cargador: recibe el proyectil y lo introduce en la recámara
    { const s = new Serv(dur), PG = [-0.95, Cu[2] - 0.85], PL = [Cu[1] < 0.85 ? -0.24 : -0.32, Cu[2] - 0.75], pr = (t, p, d) => s.h(t, p, d, [0.06, 0.2]);
      s.en(0, PG[0], PG[1], 20, postura()).en(0.26, PG[0], PG[1], -60, postura()).en(0.3, PG[0], PG[1], -60, postura({brazoIz: [-60, 0, 0], brazoDe: [-60, 0, 0]}));
      const xc = Math.max(0, (1.0 - Cu[1]) * 95); s.camina(0.32, 0.36, PG, PL, {yaw: 10}); s.en(0.38, PL[0], PL[1], 10, INCL(24 + xc)).en(0.41, PL[0], PL[1] + 0.12, 10, INCL(32 + xc)).en(0.44, PL[0], PL[1], 10, PIE); s.camina(0.45, 0.5, PL, PG, {yaw: 20}); s.en(1, PG[0], PG[1], 20, postura());
      pr(0.3, [-1.15, 0.95, Cu[2] - 1.05], [0, 0, 1]); pr(0.36, add(Cu, ax, -0.55), ax); pr(0.4, add(Cu, ax, -0.05), ax); pr(0.41, add(Cu, ax, 0.12), ax); s.ver(0, 0).ver(0.3, 1).ver(0.415, 0);
      s.e(0, 'disparo').e(ev('entrega'), 'entrega').e(ev('cargar'), 'cargar');
      s.fin(T3, 'art_RC_cargador' + sfx, {pieza: k, ciclo: D.ciclo, rol: 'cargador', tipo: 'inf_art_cargador_rc', sincronizar: true, contactos: [[0.41, 'centro', 'culata_dentro']]}); dot.push({rol: 'cargador', tipo: 'inf_art_cargador_rc', clip: 'art_RC_cargador' + sfx}); }
    // municionero: del carro (o de los nichos) al cargador
    { const s = new Serv(dur), PM = [-1.35, Cu[2] - 1.2], H = [-1.15, 0.95, Cu[2] - 1.05];
      s.en(0, AV[0], AV[1], 160, INCL(30)).en(0.08, AV[0], AV[1], 160, INCL(40, {brazoIz: [-70, 0, 0], brazoDe: [-70, 0, 0]})); s.camina(0.12, 0.27, AV, PM, {}); s.en(0.29, PM[0], PM[1], 60, INCL(8)); s.camina(0.33, 0.48, PM, AV, {}); s.en(1, AV[0], AV[1], 160, INCL(30));
      s.h(0.1, [AV[0] + 0.1, 0.95, AV[1] - 0.3], [1, 0, 0], [0.06, 0.2]); s.h(0.27, [PM[0] + 0.15, 0.95, PM[1] + 0.2], [0, 0, 1], [0.06, 0.2]); s.h(0.3, H, [0, 0, 1], [0.06, 0.2]); s.ver(0, 0).ver(0.09, 1).ver(0.305, 0);
      s.e(0, 'disparo').e(ev('entrega'), 'entrega');
      s.fin(T3, 'art_RC_municionero' + sfx, {pieza: k, ciclo: D.ciclo, rol: 'municionero', tipo: 'inf_art_municionero_rc', sincronizar: true}); dot.push({rol: 'municionero', tipo: 'inf_art_municionero_rc', clip: 'art_RC_municionero' + sfx}); }
    // jefe: observa con prismáticos (D–E) o con el sable (B–C) y manda el fuego
    { const s = new Serv(dur), PJ = [xr + 0.5, -Lc + 0.6], pris = D.eras[0] >= 'D';
      const obs = pris ? PIE => con(PIE, {brazoIz: [-120, 0, 30], antebrazoIz: [-120, 0, 0], brazoDe: [-120, 0, -30], antebrazoDe: [-120, 0, 0], cabeza: [-4, 0, 0]}) : x => x;
      s.en(0, PJ[0], PJ[1], -10, obs(PIE)).en(0.5, PJ[0], PJ[1], -10, obs(PIE)).en(0.6, PJ[0], PJ[1], -30, PIE).en(0.86, PJ[0], PJ[1], -20, con(PIE, {brazoDe: [-150, 0, -10], antebrazoDe: [-20, 0, 0]}));
      s.en(0.96, PJ[0], PJ[1], -20, con(PIE, {brazoDe: [-40, 0, -10], antebrazoDe: [-20, 0, 0], torso: [6, 0, 0]})).en(1, PJ[0], PJ[1], -10, obs(PIE));
      s.e(0, 'disparo').e(ev('listo'), 'listo').e(ev('fuego'), 'fuego');
      s.fin(T3, 'art_RC_jefe' + sfx, {pieza: k, ciclo: D.ciclo, rol: 'jefe', tipo: 'inf_art_jefe', sincronizar: true}); dot.push({rol: 'jefe', tipo: 'inf_art_jefe', clip: 'art_RC_jefe' + sfx}); }
    DOTACIONES[k] = {pieza: 'art_' + k, clipPieza: `art_${k}_servicio`, ciclo: D.ciclo, servidores: dot, avantren: {tipo: k === 'antitanque' ? null : 'art_carro_municion', desfase: [AV[0] - 1.2, AV[1] - 0.6, 180]}};
  }
  ['rayado_rc', 'canon_75', 'obus_pesado', 'campana_E', 'antitanque'].forEach(retrocarga);

  /* ---------- morteros, cohetes y ametralladoras ---------- */
  { // mortero de bronce (MA): el bombero mete la bomba, el botafuego enciende espoleta y oído
    const k = 'mortero', D = PIEZAS[k], dur = CICLOS.MA.dur, el = elevDe(k), pt = puntos(k), Bq = enPieza(k, pt.boca, el), O = enPieza(k, pt.oido, el), dot = [], dn = [0, -Math.sin(el * D2R), -Math.cos(el * D2R)];
    { const s = new Serv(dur), P = [0.75, 0.6], Rv = [1.6, -2.5];
      s.en(0, P[0], P[1], -120, PIE); s.camina(0.05, 0.18, P, Rv); s.en(0.2, Rv[0], Rv[1], 160, INCL(40)); s.camina(0.22, 0.34, Rv, P); s.en(0.36, P[0], P[1], -120, INCL(30)).en(0.4, P[0] - 0.2, P[1], -120, INCL(40)).en(0.45, P[0], P[1], -120, PIE).en(1, P[0], P[1], -120, PIE);
      s.h(0.21, [Rv[0] - 0.1, 0.6, Rv[1] - 0.3], [0, 1, 0], [0.0, 0.0]); s.h(0.34, [P[0] - 0.2, 0.95, P[1] - 0.2], [0, 1, 0], [0, 0]); s.h(0.38, [Bq[0], Bq[1] + 0.12, Bq[2] + 0.1], [0, 1, 0], [0, 0]); s.h(0.395, Bq.map((v, i) => v + dn[i] * 0.2), [0, 1, 0], [0, 0]);
      s.ver(0, 0).ver(0.2, 1).ver(0.4, 0); s.e(0, 'disparo').e(0.3, 'entrega').e(0.38, 'cargar');
      s.fin(T3, 'art_MA_bombero', {pieza: k, ciclo: 'MA', rol: 'bombero', tipo: 'inf_art_bombero', sincronizar: true}); dot.push({rol: 'bombero', tipo: 'inf_art_bombero', clip: 'art_MA_bombero'}); }
    { const s = new Serv(dur), P = [-0.7, -0.5], botaf = (t, a) => s.h(t, a, [O[0] - a[0], O[1] - a[1], O[2] - a[2]], [0.0, -1]);
      s.en(0, -1.8, -1.8, 30, INCL(4)); s.camina(0.6, 0.68, [-1.8, -1.8], P); s.en(0.72, P[0], P[1], 45, INCL(34)); botaf(0.72, [P[0] + 0.3, 1.0, P[1] + 0.2]); botaf(0.74, [O[0] - 0.4, O[1] + 0.35, O[2] - 0.35]);
      s.en(0.78, P[0], P[1], 45, INCL(30)); botaf(0.78, [O[0] - 0.4, O[1] + 0.35, O[2] - 0.35]); s.camina(0.8, 0.9, P, [-1.8, -1.8]); s.en(1, -1.8, -1.8, 30, INCL(4)); botaf(0.9, [-1.6, 1.0, -1.6]); botaf(1, [-1.6, 1.0, -1.6]);
      s.e(0, 'disparo').e(0.72, 'cebar').e(0.74, 'encender').e(0.84, 'listo');
      s.fin(T3, 'art_MA_botafuego', {pieza: k, ciclo: 'MA', rol: 'botafuego', tipo: 'inf_art_botafuego', sincronizar: true}); dot.push({rol: 'botafuego', tipo: 'inf_art_botafuego', clip: 'art_MA_botafuego'}); }
    { const s = new Serv(dur), P = [0.0, -1.3];
      s.en(0, P[0], P[1], 0, PIE).en(0.48, P[0], P[1], 0, PIE).en(0.52, P[0], P[1] + 0.3, 0, AGACH({torso: [36, 0, 0]})).en(0.6, P[0], P[1] + 0.3, 0, AGACH({torso: [36, 0, 0], brazoDe: [-70, 0, 0], antebrazoDe: [-30, 0, 0]}));
      s.en(0.66, P[0], P[1] + 0.3, 0, AGACH({torso: [36, 0, 0], brazoDe: [-70, 0, 0], antebrazoDe: [-60, 0, 0]})).en(0.7, P[0], P[1], 0, PIE).en(0.97, P[0], P[1], 0, con(PIE, {brazoDe: [-150, 0, -10]})).en(1, P[0], P[1], 0, PIE);
      s.e(0, 'disparo').e(0.5, 'apuntar').e(0.84, 'listo').e(0.97, 'fuego');
      s.fin(T3, 'art_MA_jefe', {pieza: k, ciclo: 'MA', rol: 'jefe', tipo: 'inf_art_jefe', sincronizar: true}); dot.push({rol: 'jefe', tipo: 'inf_art_jefe', clip: 'art_MA_jefe'}); }
    DOTACIONES[k] = {pieza: 'art_' + k, clipPieza: `art_${k}_servicio`, ciclo: 'MA', servidores: dot};
  }
  { // mortero de trinchera (MD): suelta la bomba por la boca y se agacha; el municionero le pasa la siguiente
    const k = 'mortero_ligero', dur = CICLOS.MD.dur, el = elevDe(k), pt = puntos(k), Bq = enPieza(k, pt.boca, el), dot = [], dn = [0, -Math.sin(el * D2R), -Math.cos(el * D2R)];
    { const s = new Serv(dur), P = [-0.45, 0.4], bo = (t, p) => s.h(t, p, [0, 1, 0], [0, 0]);
      s.en(0, P[0], P[1], 80, RODI({torso: [20, 0, 0], brazoIz: [-120, 0, 10], brazoDe: [-120, 0, -10]})).en(0.03, P[0], P[1], 80, RODI({torso: [40, 0, 0], cabeza: [20, 0, 0], brazoIz: [-150, 0, 40], antebrazoIz: [-140, 0, 0], brazoDe: [-150, 0, -40], antebrazoDe: [-140, 0, 0]}));
      s.en(0.25, P[0], P[1], 80, RODI({torso: [40, 0, 0], cabeza: [20, 0, 0], brazoIz: [-150, 0, 40], antebrazoIz: [-140, 0, 0], brazoDe: [-150, 0, -40], antebrazoDe: [-140, 0, 0]})).en(0.35, P[0], P[1], 120, RODI({torso: [10, 0, 0]}));
      s.en(0.45, P[0], P[1], 150, RODI({torso: [16, 0, 0]})).en(0.6, P[0], P[1], 90, RODI({torso: [16, 0, 0]})).en(0.85, P[0], P[1], 80, RODI({torso: [20, 0, 0]})).en(1, P[0], P[1], 80, RODI({torso: [20, 0, 0], brazoIz: [-120, 0, 10], brazoDe: [-120, 0, -10]}));
      bo(0, [Bq[0], Bq[1] + 0.18, Bq[2]]); bo(0.015, Bq.map((v, i) => v + dn[i] * 0.15)); bo(0.45, [P[0] - 0.05, 0.8, P[1] - 0.45]); bo(0.6, [P[0] + 0.3, 0.75, P[1] + 0.1]); bo(0.9, [Bq[0], Bq[1] + 0.25, Bq[2]]); bo(1, [Bq[0], Bq[1] + 0.18, Bq[2]]);
      s.ver(0, 1).ver(0.02, 0).ver(0.45, 1); s.e(0, 'cargar').e(0.07, 'disparo').e(0.45, 'entrega').e(0.8, 'listo');
      s.fin(T3, 'art_MD_cargador', {pieza: k, ciclo: 'MD', rol: 'bombero', tipo: 'inf_art_bombero', sincronizar: true}); dot.push({rol: 'bombero', tipo: 'inf_art_bombero', clip: 'art_MD_cargador'}); }
    { const s = new Serv(dur), P = [-0.55, -0.6];
      s.en(0, P[0], P[1], -160, RODI({torso: [40, 0, 0], brazoIz: [-60, 0, 0], brazoDe: [-60, 0, 0]})).en(0.3, P[0], P[1], 20, RODI({torso: [10, 0, 0]})).en(0.45, P[0], P[1], 20, RODI({torso: [14, 0, 0]})).en(0.55, P[0], P[1], -160, RODI({torso: [30, 0, 0]})).en(1, P[0], P[1], -160, RODI({torso: [40, 0, 0], brazoIz: [-60, 0, 0], brazoDe: [-60, 0, 0]}));
      s.h(0.2, [P[0] - 0.1, 0.4, P[1] - 0.4], [0, 1, 0], [0, 0]); s.h(0.32, [P[0] + 0.05, 0.75, P[1] + 0.35], [0, 1, 0], [0, 0]); s.h(0.45, [-0.5, 0.8, -0.05], [0, 1, 0], [0, 0]); s.ver(0, 0).ver(0.18, 1).ver(0.455, 0);
      s.e(0.07, 'disparo').e(0.45, 'entrega');
      s.fin(T3, 'art_MD_municionero', {pieza: k, ciclo: 'MD', rol: 'municionero', tipo: 'inf_art_bombero', sincronizar: true}); dot.push({rol: 'municionero', tipo: 'inf_art_bombero', clip: 'art_MD_municionero'}); }
    { const s = new Serv(dur), P = [0.45, 0.55];
      s.en(0, P[0], P[1], -100, RODI({torso: [12, 0, 0]})).en(0.07, P[0], P[1], -100, RODI({torso: [12, 0, 0], cabeza: [10, 30, 0]})).en(0.6, P[0], P[1], -100, RODI({torso: [30, 0, 0], brazoDe: [-60, 0, 0], antebrazoDe: [-40, 0, 0]}))
        .en(0.7, P[0], P[1], -100, RODI({torso: [30, 0, 0], brazoDe: [-60, 0, 0], antebrazoDe: [-70, 0, 0]})).en(0.8, P[0], P[1], -100, RODI({torso: [12, 0, 0]})).en(1, P[0], P[1], -100, RODI({torso: [12, 0, 0]}));
      s.e(0.07, 'disparo').e(0.8, 'listo');
      s.fin(T3, 'art_MD_apuntador', {pieza: k, ciclo: 'MD', rol: 'apuntador', tipo: 'inf_art_apuntador', sincronizar: true}); dot.push({rol: 'apuntador', tipo: 'inf_art_apuntador', clip: 'art_MD_apuntador'}); }
    DOTACIONES[k] = {pieza: 'art_' + k, clipPieza: `art_${k}_servicio`, ciclo: 'MD', servidores: dot};
  }
  { // cohete Congreve (K): el cohetero coloca el cohete en el canal; el botafuego lo enciende y se retira
    const k = 'congreve', dur = CICLOS.K.dur, el = elevDe(k), F = FAM.p_cohete, dot = [], rq = enPieza(k, [0, 0.06, 0.25], el), ax = [0, Math.sin(el * D2R), Math.cos(el * D2R)], cola = enPieza(k, [0, 0.06, -0.2], el);
    { const s = new Serv(dur), P = [0.7, -0.6], Rv = [2.0, -3.5];
      s.en(0, Rv[0], Rv[1], 0, PIE).en(0.06, Rv[0], Rv[1], 160, INCL(40)); s.camina(0.12, 0.3, Rv, P); s.en(0.34, P[0], P[1], -60, INCL(20)).en(0.39, P[0], P[1], -60, INCL(26)); s.camina(0.42, 0.55, P, Rv); s.en(1, Rv[0], Rv[1], 0, PIE);
      s.h(0.1, [Rv[0] + 0.1, 1.0, Rv[1] + 0.25], [0, 0.3, 1], [0.0, 0.3]); s.h(0.3, [P[0] - 0.1, 1.1, P[1] + 0.3], [-0.5, 0.2, 1], [0.0, 0.3]); s.h(0.38, rq, ax, [0.0, 0.3]); s.ver(0, 0).ver(0.08, 1).ver(0.385, 0);
      s.e(0, 'disparo').e(0.3, 'entrega').e(0.38, 'cargar');
      s.fin(T3, 'art_K_cohetero', {pieza: k, ciclo: 'K', rol: 'cohetero', tipo: 'inf_art_cohetero', sincronizar: true}); dot.push({rol: 'cohetero', tipo: 'inf_art_cohetero', clip: 'art_K_cohetero'}); }
    { const s = new Serv(dur), P = [-0.5, -0.9], Sg = [-3.0, -4.0], bf = (t, a) => s.h(t, a, [cola[0] - a[0], cola[1] - a[1], cola[2] - a[2]], [0, -1]);
      s.en(0, Sg[0], Sg[1], 30, INCL(4)); bf(0, [Sg[0] + 0.3, 1.0, Sg[1] + 0.2]); s.en(0.55, Sg[0], Sg[1], 30, INCL(4)); bf(0.55, [Sg[0] + 0.3, 1.0, Sg[1] + 0.2]); s.camina(0.6, 0.76, Sg, P);
      s.en(0.8, P[0], P[1], 20, INCL(30)); bf(0.8, [cola[0] - 0.3, cola[1] + 0.2, cola[2] - 0.5]); bf(0.76, [P[0] + 0.3, 1.0, P[1] + 0.2]); s.camina(0.84, 0.97, P, Sg); s.en(1, Sg[0], Sg[1], 30, INCL(4)); bf(0.97, [Sg[0] + 0.3, 1.0, Sg[1] + 0.2]); bf(1, [Sg[0] + 0.3, 1.0, Sg[1] + 0.2]);
      s.e(0, 'disparo').e(0.8, 'cebar').e(0.84, 'listo');
      s.fin(T3, 'art_K_botafuego', {pieza: k, ciclo: 'K', rol: 'botafuego', tipo: 'inf_art_botafuego', sincronizar: true}); dot.push({rol: 'botafuego', tipo: 'inf_art_botafuego', clip: 'art_K_botafuego'}); }
    DOTACIONES[k] = {pieza: 'art_' + k, clipPieza: `art_${k}_servicio`, ciclo: 'K', servidores: dot};
  }
  // ametralladoras (MG): tirador con las manos en las empuñaduras, proveedor que guía la cinta, jefe con prismáticos; Gatling: manivela y cargador
  ['maxim', 'vickers', 'mg34'].forEach(k => {
    const dur = CICLOS.MG.dur, dot = [], tumb = k === 'mg34', pt = puntos(k), Cu = enPieza(k, pt.culata, 0);
    { const s = new Serv(dur), P = tumb ? [0.05, Cu[2] - 1.15] : [0.0, Cu[2] - 0.62];
      const base = tumb ? PANZA({brazoIz: [-150, 0, 18], antebrazoIz: [-20, 0, 0], brazoDe: [-150, 0, -18], antebrazoDe: [-20, 0, 0], cabeza: [-54, 0, 0]}) : SENT({torso: [62, 0, 0], cabeza: [-30, 0, 0], brazoIz: [-80, 0, 14], antebrazoIz: [-30, 0, 0], brazoDe: [-80, 0, -14], antebrazoDe: [-30, 0, 0]});
      for (let i = 0; i <= 12; i++) { const t = i / 12 * 0.6, j = i % 2 ? 1.5 : -1.5; s.en(t, P[0], P[1] - (i % 2 ? 0.008 : 0), 0, Object.assign({}, base, {torso: [base.torso[0] + j * 0.6, 4 * Math.sin(2 * Math.PI * t / 0.6 - 1.2), 0]})); }
      s.en(0.7, P[0], P[1], 0, base).en(1, P[0], P[1], 0, base); s.e(0, 'rafaga').e(0.3, 'rafaga');
      s.fin(T3, 'art_MG_tirador_' + k, {pieza: k, ciclo: 'MG', rol: 'tirador', tipo: 'inf_art_mg_tirador', sincronizar: true}); dot.push({rol: 'tirador', tipo: 'inf_art_mg_tirador', clip: 'art_MG_tirador_' + k}); }
    { const s = new Serv(dur), P = tumb ? [0.6, Cu[2] - 0.95] : [0.5, Cu[2] + 0.05];
      const b = (a) => tumb ? PANZA({brazoDe: [-130, 0, -30 + a], antebrazoDe: [-40, 0, 0], brazoIz: [-120, 0, 30], antebrazoIz: [-30, 0, 0]}) : RODI({torso: [20, -30, 0], brazoDe: [-60, 0, -30 + a], antebrazoDe: [-50, 0, 0], brazoIz: [-50, 0, 10], antebrazoIz: [-70, 0, 0]});
      const yw = tumb ? -12 : -80; s.en(0, P[0], P[1], yw, b(0)).en(0.3, P[0], P[1], yw, b(10)).en(0.6, P[0], P[1], yw, b(0)).en(0.7, P[0], P[1], yw, b(-15)).en(1, P[0], P[1], yw, b(0)); s.h(0, [P[0] - 0.15, 0.25, P[1] + 0.1], [0, 1, 0], [-1, -1]); s.ver(0, 0); s.e(0.7, 'cinta');
      s.fin(T3, 'art_MG_proveedor_' + k, {pieza: k, ciclo: 'MG', rol: 'proveedor', tipo: 'inf_art_mg_proveedor', sincronizar: true}); dot.push({rol: 'proveedor', tipo: 'inf_art_mg_proveedor', clip: 'art_MG_proveedor_' + k}); }
    { const s = new Serv(dur), P = tumb ? [-0.75, Cu[2] - 1.5] : [-0.9, Cu[2] - 1.0], ob = tumb ? PANZA({brazoIz: [-150, 0, 30], antebrazoIz: [-130, 0, 0], brazoDe: [-150, 0, -30], antebrazoDe: [-130, 0, 0]}) : RODI({brazoIz: [-120, 0, 30], antebrazoIz: [-125, 0, 0], brazoDe: [-120, 0, -30], antebrazoDe: [-125, 0, 0], cabeza: [-6, 0, 0]});
      s.en(0, P[0], P[1], 10, ob).en(0.5, P[0], P[1], 16, ob).en(1, P[0], P[1], 10, ob);
      s.fin(T3, 'art_MG_jefe_' + k, {pieza: k, ciclo: 'MG', rol: 'jefe', tipo: 'inf_art_jefe', sincronizar: true}); dot.push({rol: 'jefe', tipo: 'inf_art_jefe', clip: 'art_MG_jefe_' + k}); }
    DOTACIONES[k] = {pieza: 'art_' + k, clipPieza: `art_${k}_servicio`, ciclo: 'MG', servidores: dot};
  });
  { const k = 'gatling', dur = CICLOS.G.dur, dot = [], pt = puntos(k), Cu = enPieza(k, pt.culata, PIEZAS[k].elev), F = FAM.p_campana;
    { const s = new Serv(dur), P = [-0.62, -0.45];
      for (let i = 0; i <= 8; i++) { const a = i / 8 * 2 * Math.PI * 2; s.en(i / 8, P[0], P[1], 70, INCL(12, {brazoDe: [-60 - 22 * Math.sin(a), 0, -10], antebrazoDe: [-50 - 30 * Math.cos(a), 0, 0]})); }
      s.e(0, 'rafaga').e(0.5, 'rafaga'); s.fin(T3, 'art_G_manivela', {pieza: k, ciclo: 'G', rol: 'manivela', tipo: 'inf_art_apuntador', sincronizar: true}); dot.push({rol: 'manivela', tipo: 'inf_art_apuntador', clip: 'art_G_manivela'}); }
    { const s = new Serv(dur), P = [0.5, -0.65], top = [Cu[0], Cu[1] + 0.2, Cu[2]];
      s.en(0, P[0], P[1], -40, INCL(6)).en(0.35, P[0], P[1], -40, INCL(14)).en(0.5, P[0], P[1], -40, INCL(24)).en(0.6, P[0], P[1], -120, INCL(30)).en(0.85, P[0], P[1], -40, INCL(10)).en(1, P[0], P[1], -40, INCL(6));
      s.h(0, [P[0] - 0.1, 1.05, P[1] + 0.25], [0, 1, 0], [0, 0.08]); s.h(0.35, [top[0] + 0.15, top[1] + 0.25, top[2]], [0, 1, 0], [0, 0.08]); s.h(0.5, [top[0], top[1] + 0.1, top[2]], [0, 1, 0], [0, 0.08]);
      s.h(0.7, [P[0] + 0.3, 1.0, P[1] - 0.3], [0, 1, 0], [0, 0.08]); s.h(0.9, [P[0] - 0.1, 1.05, P[1] + 0.25], [0, 1, 0], [0, 0.08]); s.ver(0, 1).ver(0.5, 0).ver(0.72, 1);
      s.e(0.5, 'cargar'); s.fin(T3, 'art_G_cargador', {pieza: k, ciclo: 'G', rol: 'cargador', tipo: 'inf_art_mg_proveedor', sincronizar: true}); dot.push({rol: 'cargador', tipo: 'inf_art_mg_proveedor', clip: 'art_G_cargador'}); }
    { const s = new Serv(dur), P = [0.0, -PIEZAS[k].Lc - 0.5];
      s.en(0, P[0], P[1], 0, AGACH({torso: [20, 0, 0]})).en(0.5, P[0], P[1], 3, AGACH({torso: [20, 0, 0]})).en(1, P[0], P[1], 0, AGACH({torso: [20, 0, 0]}));
      s.fin(T3, 'art_G_apuntador', {pieza: k, ciclo: 'G', rol: 'apuntador', tipo: 'inf_art_jefe', sincronizar: true}); dot.push({rol: 'apuntador', tipo: 'inf_art_jefe', clip: 'art_G_apuntador'}); }
    DOTACIONES[k] = {pieza: 'art_' + k, clipPieza: `art_${k}_servicio`, ciclo: 'G', servidores: dot, avantren: {tipo: 'art_avantren', desfase: [0, -PIEZAS[k].Lc - 5, 180]}};
  }

  /* ---------- enganchar y desenganchar: dos servidores llevan la contera (siguen su trayectoria real) ---------- */
  Object.entries(PIEZAS).forEach(([k, D]) => { if (D.fam !== 'p_campana') return; const clip = `art_${k}_desenganchar`, A = T3.CLIPS.armon[clip], IXA = {}; T3.RIGS.armon.forEach((p, i) => { IXA[p[0]] = i; });
    const M = new THREE.Matrix4(), v = new THREE.Vector3(), lun = (t, rev) => { const m = T3.poseTroop('armon', clip, rev ? 1 - t : t); M.fromArray(m, IXA.arrastre * 16);
      // la luneta de la contera en el marco del arrastre: marcoRemolque lleva el punto [0, 0.1, −Lc] de la pieza
      v.set(0, 0.1, -D.Lc).applyMatrix4(marcoRemolque(k)).applyMatrix4(M); return [v.x, v.y, v.z]; };
    [['iz', 1], ['de', -1]].forEach(([n, sg]) => [false, true].forEach(rev => { const s = new Serv(8, false), N = 16;
      for (let i = 0; i <= N; i++) { const t = i / N, L = lun(t, rev), fase = rev ? 1 - t : t, sujeta = fase > 0.08 && fase < 0.86, x = L[0] + sg * 0.42, z = L[2] - 0.1;
        const yawL = Math.atan2(-L[0], -L[2] + ARMON.ejeP[2]) / D2R;
        s.en(t, x, z, sujeta ? -sg * 90 + yawL * 0 : -sg * 70, sujeta ? (L[1] > 0.4 ? INCL(14, {brazoIz: [-50, 0, -sg * 10], antebrazoIz: [-20, 0, 0], brazoDe: [-50, 0, sg * 10], antebrazoDe: [-20, 0, 0]}) : INCL(46, {brazoIz: [-70, 0, 0], brazoDe: [-70, 0, 0]})) : PIE); }
      s.e(rev ? 0.1 : 0.08, 'agarrar_contera');
      s.fin(T3, `art_contera_${n}_${k}${rev ? '_eng' : ''}`, {pieza: k, rol: 'contera_' + n, tipo: 'inf_art_cebador', marcoArmon: true, sincronizar: true}); })); });
  /* ---------- sentado en el cofre del avantrén (bote del rodar), heridos y muertos junto a la pieza ---------- */
  { const s = new Serv(1.13), base = SENT({pelvis: [-80, 0, 0], torso: [66, 0, 0], brazoIz: [-40, 0, 20], antebrazoIz: [-60, 0, 0], brazoDe: [-40, 0, -20], antebrazoDe: [-60, 0, 0], piernaIz: [85, 0, 0], piernaDe: [85, 0, 0], musloIz: [-8, 0, 10], musloDe: [-8, 0, -10], pieIz: [-10, 0, 0], pieDe: [-10, 0, 0]});
    [0, 0.33, 0.66, 1].forEach((t, i) => { s.C.k(t, orientar(Object.assign({}, base, {torso: [66 + (i % 2) * 3, 0, 0]}), 0)); s.C.r(t, 0, (i % 2) * 0.012, -0.05); });
    const c = s.C.fin(), Sx = T3.CLIPS.soldado; Sx.__art3d_s = c; const Mz = T3.poseTroop('soldado', '__art3d_s', 0), o = IXS.pelvis * 16;
    let low = Infinity; [[0.12, -0.1, -0.1], [-0.12, -0.1, -0.1], [0, -0.12, 0.05]].forEach(v => { low = Math.min(low, Mz[o + 1] * v[0] + Mz[o + 5] * v[1] + Mz[o + 9] * v[2] + Mz[o + 13]); }); delete Sx.__art3d_s;
    const asiento = ARMON.R + 0.665; c.root = c.root.map(k => [k[0], k[1], k[2] + asiento - low, k[3]]);   /* las nalgas sobre la tapa del cofre */
    CLIPS_S.art_sentado_cofre = c; META_S.art_sentado_cofre = {suelo: 'libre', avance: 0, desplazamiento: [0, 0, 0], armaCompatible: ERAS.slice(), transiciones: [], marcoArmon: true, puestos: [[0.38, 0, -0.05], [0, 0, -0.05], [-0.38, 0, -0.05]], eventos: []}; }
  { const s = new Serv(2.6, false), P = [-1.15, 0.25]; s.en(0, P[0], P[1], 90, PIE).en(0.08, P[0], P[1] - 0.1, 90, INCL(-20, {brazoIz: [-60, 0, 40], brazoDe: [-60, 0, -40]})).en(0.35, P[0] - 0.05, P[1] - 0.2, 90, AGACH({torso: [-10, 0, 0], cabeza: [20, 0, 0]}))
      .en(0.6, P[0] - 0.2, P[1] - 0.2, 90, SENT({torso: [20, 0, 10], cabeza: [40, 30, 0], brazoIz: [10, 0, 30], antebrazoIz: [-10, 0, 0], brazoDe: [10, 0, -30], antebrazoDe: [-10, 0, 0], musloIz: [-60, 0, 20], piernaIz: [60, 0, 0]})).en(1, P[0] - 0.2, P[1] - 0.2, 90, SENT({torso: [10, 0, 16], cabeza: [50, 40, 0], brazoIz: [16, 0, 30], antebrazoIz: [-6, 0, 0], brazoDe: [16, 0, -30], antebrazoDe: [-6, 0, 0], musloIz: [-50, 0, 22], piernaIz: [50, 0, 0], musloDe: [-30, 0, -10], piernaDe: [30, 0, 0]}));
    s.e(0, 'impacto').e(0.6, 'cae'); s.fin(T3, 'art_srv_muerto_rueda', {rol: 'cualquiera', marcoPieza: true, junto: 'rueda derecha (pieza de campaña)', transiciones: []}); }
  { const s = new Serv(4); const b = a => SENT({torso: [40 + a, 0, 0], cabeza: [20, 0, 0], musloIz: [-40, 0, 14], piernaIz: [70, 0, 0], musloDe: [-10, 0, -10], piernaDe: [10, 0, 0], brazoIz: [-20, 0, 10], antebrazoIz: [-70, 0, 0], brazoDe: [-30, 0, -10], antebrazoDe: [-60 - a, 0, 0]});
    s.en(0, -1.6, -1.6, 60, b(0)).en(0.5, -1.6, -1.6, 60, b(6)).en(1, -1.6, -1.6, 60, b(0)); s.e(0.5, 'queja');
    s.fin(T3, 'art_srv_herido_sentado', {rol: 'cualquiera', marcoPieza: true, junto: 'detrás de la rueda derecha', transiciones: []}); }
}

/* ---------- grupos: tiro de 4 o 6 caballos, batería en línea y columna de batería (marco del avantrén / de la batería) ----------
   «Instruction for Field Artillery» (1864): parejas de varas, de en medio y de guía, conductor en el caballo de la izquierda; 14 yardas (≈ 13 m)
   de intervalo entre piezas en batería; el avantrén a 6 yardas detrás de la contera y el carro 11 yardas detrás del avantrén. */
const GRUPOS = {
  tiro: (n, op) => { op = op || {}; const pares = Math.max(2, Math.min(3, Math.round((n || 6) / 2))), out = [], zs = [2.95, 6.15, 9.35], x = 0.62;
    for (let i = 0; i < pares; i++) { const nombre = ['varas', 'medio', 'guia'][i === 0 ? 0 : pares === 2 ? 2 : i]; out.push({x, z: zs[i], tipo: 'cab_tiro_conductor', papel: 'conductor_' + nombre}, {x: -x, z: zs[i], tipo: 'cab_tiro_mano', papel: 'mano_' + nombre}); }
    return out; },
  bateria: (n, op) => { op = op || {}; const piezas = n || 6, iv = op.intervalo || 13, out = [];
    for (let i = 0; i < piezas; i++) { const x = (i - (piezas - 1) / 2) * iv; out.push({x, z: 0, papel: 'pieza', n: i + 1}, {x, z: -(op.avantren || 8.0), papel: 'avantren', n: i + 1, rumbo: 180}, {x, z: -(op.avantren || 8.0) - 10, papel: 'carro', n: i + 1, rumbo: 180}); }
    out.push({x: 0, z: -4, papel: 'capitan'}); return out; },
  columna_bateria: (n, op) => { const piezas = n || 6, out = []; for (let i = 0; i < piezas; i++) out.push({x: 0, z: -i * 22, papel: 'pieza_enganchada', n: i + 1}, {x: 0, z: -i * 22 - 11, papel: 'carro', n: i + 1}); return out; }
};
function formacion(tipo, n, op) { const f = GRUPOS[tipo]; if (!f) throw new Error('formación desconocida: ' + tipo); return f(n, op); }
const TRANSICIONES = {};
function grafo() { Object.entries(Object.assign({}, META, META_S)).forEach(([n, m]) => { TRANSICIONES[n] = TRANSICIONES[n] || {}; (m.transiciones || []).forEach(t => { TRANSICIONES[n][t] = 0.3; }); }); }
function rutaTransicion(desde, hasta) { const cola = [[desde]], vis = new Set([desde]); while (cola.length) { const r = cola.shift(), u = r[r.length - 1]; if (u === hasta) return r.slice(1).map((c, i) => ({clip: c, mezcla: (TRANSICIONES[r[i]] || {})[c]}));
  Object.keys(TRANSICIONES[u] || {}).forEach(v => { if (!vis.has(v)) { vis.add(v); cola.push(r.concat([v])); } }); } return null; }
// boca de fuego de la pieza en el instante t de un clip (marco de la figura): para humo, fogonazo y metralla
function boca(T3, tipo, clip, t) { const k = tipo.replace(/^art_/, '').replace(/_enganchado$/, ''), D = PIEZAS[k], rig = D.fam, M = T3.poseTroop(rig, clip, t), i = T3.RIGS[rig].findIndex(p => p[0] === 'tubo'), o = i * 16, pb = puntos(k).boca;
  const dirL = [0, 0, 1]; return {p: [0, 1, 2].map(j => M[o + j] * pb[0] + M[o + 4 + j] * pb[1] + M[o + 8 + j] * pb[2] + M[o + 12 + j]), dir: [0, 1, 2].map(j => M[o + 8 + j] * dirL[2])}; }

/* ===================================================================================== */
/* REGISTRO */
let _I = null;
function registrar(T3, op) {
  op = op || {}; const CABm = root.caballeria3d, INFm = root.infanteria3d; if (!CABm || !INFm) throw new Error('artilleria3d necesita infanteria3d.js y caballeria3d.js cargados antes');
  CABm.registrar(T3, op);
  Object.keys(FAM).forEach(f => { if (!T3.RIGS[f]) T3.RIGS[f] = rigPieza(f); T3.CLIPS[f] = T3.CLIPS[f] || {}; }); if (!T3.RIGS.armon) T3.RIGS.armon = RIG_ARMON; T3.CLIPS.armon = T3.CLIPS.armon || {};
  _I = _I || crear(T3, INFm.instancia(T3), CABm._crear(T3, INFm.instancia(T3)), CABm.JINETES); const tipos = [], clips = [], saltados = [];
  Object.entries(_I.TIPOS).forEach(([k, K]) => { if (T3.KINDS[k] && !op.reemplazar) return; T3.KINDS[k] = K; if (!T3.TROOP_KINDS.includes(k)) T3.TROOP_KINDS.push(k); tipos.push(k); });
  Object.entries(CLIPS).forEach(([rig, set]) => Object.entries(set).forEach(([n, c]) => { if (T3.CLIPS[rig][n] && !op.reemplazar) { saltados.push(n); return; } T3.CLIPS[rig][n] = JSON.parse(JSON.stringify(c));
    if (META[n].suelo === 'apoyado') apoyarPieza(T3, rig, T3.CLIPS[rig][n]); clips.push(n); }));
  if (!Object.keys(CLIPS_S).length) { servidores(T3, INFm); grafo(); }
  Object.entries(CLIPS_S).forEach(([n, c]) => { if (T3.CLIPS.soldado[n] === c) return; if (T3.CLIPS.soldado[n] && !op.reemplazar) { saltados.push(n); return; } T3.CLIPS.soldado[n] = c; clips.push(n); });
  return {tipos, clips, saltados};
}
// apoya en el suelo las piezas que se vencen o vuelcan (ruedas, ejes, contera, tubo)
function apoyarPieza(T3, rig, clip) {
  const R = T3.RIGS[rig], IX = {}; R.forEach((p, i) => { IX[p[0]] = i; }); const tmp = '__art3d_ap', S = T3.CLIPS[rig], base = clip.root && clip.root.length ? clip.root : [[0, 0, 0, 0]], out = [], N = 200;
  const pts = rig === 'armon' ? [['avantren', [0.5, 0.7, 0.3]], ['avantren', [-0.5, 0.7, 0.3]], ['avantren', [0, 0.25, -0.3]], ...['ruedaAI', 'ruedaAD', 'ruedaPI', 'ruedaPD'].flatMap(w => Array.from({length: 24}, (_, i) => [w, [0, 0.65 * Math.cos(i / 24 * 2 * Math.PI), 0.65 * Math.sin(i / 24 * 2 * Math.PI)]])), ['arrastre', [0.5, 0.3, -1.5]], ['arrastre', [-0.5, 0.3, -1.5]], ['arrastre', [0, -0.2, -2.5]], ['lanza', [0, 0, 2.7]]]
    : [['ruedaIz', [0, -1, 0]], ['ruedaDe', [0, -1, 0]], ['ruedaIz', [0, 0, -1]], ['ruedaDe', [0, 0, -1]], ['ruedaIz', [0, 0, 1]], ['ruedaDe', [0, 0, 1]], ['cureña', [0, 0.1, -2.4]], ['cureña', [0.3, 0.3, 0]], ['cureña', [-0.3, 0.3, 0]], ['cureña', [0, 0.1, -1.4]], ['cuna', [0, 0, 1.2]], ['cuna', [0, 0, -0.6]], ['cuna', [0, 0.15, 0.3]]];
  const rr = FAMr(rig);
  for (let i = 0; i <= N; i++) { const t = i / N, sx = muestreoR(base, t, 1), sy = muestreoR(base, t, 2), sz = muestreoR(base, t, 3); S[tmp] = Object.assign({}, clip, {root: [[0, sx, sy, sz]]}); const M = T3.poseTroop(rig, tmp, t); let low = Infinity;
    pts.forEach(([p, v]) => { const vv = /rueda/.test(p) && rig !== 'armon' ? v.map(x => x * rr) : v, o = IX[p] * 16, y = M[o + 1] * vv[0] + M[o + 5] * vv[1] + M[o + 9] * vv[2] + M[o + 13]; if (y < low) low = y; });
    out.push([+t.toFixed(4), +sx.toFixed(4), +(sy - low).toFixed(4), +sz.toFixed(4)]); }
  delete S[tmp]; clip.root = out; return clip;
}
const FAMr = rig => FAM[rig] ? FAM[rig].R : 0.65;
function muestreoR(tr, t, k) { if (tr.length === 1 || t <= tr[0][0]) return tr[0][k]; for (let i = 0; i < tr.length - 1; i++) if (t <= tr[i + 1][0]) { const a = tr[i], b = tr[i + 1], u = (t - a[0]) / Math.max(1e-6, b[0] - a[0]); return a[k] + (b[k] - a[k]) * u; } return tr[tr.length - 1][k]; }
/* ===================================================================================== */
/* DEMOSTRACIÓN: demoArtilleria(contenedor, {vista: 'servicio' | 'marcha' | 'desenganchar' | 'piezas' | 'danos', pieza, era, nat, aire, t}) */
function demoArtilleria(cont, op) {
  op = op || {}; const T3 = root.Troops3D; if (!T3) throw new Error('demoArtilleria necesita Troops3D (troops3d.js)');
  registrar(T3); const q = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new Map(), arg = k => op[k] != null ? op[k] : q.get(k);
  const NAT = ['PRU', 'AUT', 'FRA', 'GBR', 'RUS', 'USA', 'CSA', 'ESP', 'ITA', 'JPN'], PZ = Object.keys(PIEZAS);
  const R = new THREE.WebGLRenderer({antialias: true}); R.setPixelRatio(Math.min(2, root.devicePixelRatio || 1)); R.domElement.style.cssText = 'display:block;width:100%;height:100%'; cont.appendChild(R.domElement);
  const S = new THREE.Scene(); S.background = new THREE.Color(0xc9d2d4); S.fog = new THREE.Fog(0xc9d2d4, 40, 160);
  S.add(new THREE.HemisphereLight(0xffffff, 0x5d6b48, 0.85)); const L = new THREE.DirectionalLight(0xfff1dc, 1.25); L.position.set(-4, 8, 6); S.add(L);
  const cv = document.createElement('canvas'); cv.width = cv.height = 64; const cx = cv.getContext('2d'); cx.fillStyle = '#86965f'; cx.fillRect(0, 0, 64, 64); cx.fillStyle = '#7a8a55'; cx.fillRect(0, 0, 64, 3); cx.fillRect(0, 0, 3, 64);
  const tx = new THREE.CanvasTexture(cv); tx.wrapS = tx.wrapT = THREE.RepeatWrapping; tx.repeat.set(200, 200); tx.colorSpace = THREE.SRGBColorSpace;
  const suelo = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshLambertMaterial({map: tx})); suelo.rotation.x = -Math.PI / 2; S.add(suelo);
  const cam = new THREE.PerspectiveCamera(32, 1, 0.1, 400); let az = 0.9, el = 0.32, dist = 12, mira = new THREE.Vector3(0, 0.8, -1.5);
  const sh = new T3.TroopShared(NAT.concat(['TUR', 'GEN'])); let lotes = [], moviles = [];
  const panel = document.createElement('div'); panel.style.cssText = 'position:absolute;right:8px;top:8px;z-index:6;background:#2a1d12e8;color:#f0dfb4;padding:8px 10px;font:13px Georgia,serif;border:1px solid #b08a3e;max-width:330px';
  if (getComputedStyle(cont).position === 'static') cont.style.position = 'relative'; cont.appendChild(panel);
  const sel = (id, ops, v) => `<label style="display:block;margin:3px 0">${id} <select id="a3d_${id}" style="max-width:220px">${ops.map(o => `<option ${o === v ? 'selected' : ''}>${o}</option>`).join('')}</select></label>`;
  const est = {vista: arg('vista') || 'servicio', pieza: arg('pieza') || 'canon_12', era: arg('era') || '', nat: arg('nat') || 'FRA', aire: arg('aire') || 'trote', t: arg('t') != null ? +arg('t') : null};
  panel.innerHTML = sel('vista', ['servicio', 'marcha', 'desenganchar', 'piezas', 'danos'], est.vista) + sel('pieza', PZ, est.pieza) + sel('era', ['', 'A', 'B', 'C', 'D', 'E'], est.era) + sel('nat', NAT, est.nat) + sel('aire', ['paso', 'trote', 'galope'], est.aire)
    + `<label style="display:block;margin:3px 0">t <input id="a3d_t" type="range" min="0" max="1" step="0.002" value="${est.t == null ? 0 : est.t}" style="width:160px"> <input id="a3d_play" type="checkbox" ${est.t == null ? 'checked' : ''}> en marcha</label><div id="a3d_info" style="font-size:12px;opacity:.85;margin-top:4px"></div>`;
  const $ = id => panel.querySelector('#a3d_' + id);
  const lote = (k, e, n, cap) => { const b = new T3.TroopBatch(sh, k, e, n, cap || 4, {lod: 0}); S.add(b.mesh); lotes.push(b); return b; };
  let reloj = 0, actual = null; const ag = (b, cl, i) => b.add(0, 0, 0, 0, 1, est.nat, cl, {phase: 0, skin: (i || 0) % 4});   // actual = clip que manda el tiempo (para el deslizador)
  function eraDe(k) { const E = PIEZAS[k].eras; return E.includes(est.era) ? est.era : E[0]; }
  function montar() {
    lotes.forEach(b => { S.remove(b.mesh); b.mesh.geometry.dispose(); }); lotes = []; moviles = []; const info = []; reloj = 0; actual = null;
    const k = est.pieza, D = PIEZAS[k], e = eraDe(k), n = est.nat, Dt = DOTACIONES[k];
    if (est.vista === 'servicio') { const cl = `art_${k}_servicio`, C = T3.CLIPS[D.fam][cl]; actual = C; ag(lote('art_' + k, e, n), cl);
      (Dt ? Dt.servidores : []).forEach((sv, i) => ag(lote(sv.tipo, e, n), sv.clip, i));
      if (Dt && Dt.avantren && Dt.avantren.tipo) { const d = Dt.avantren.desfase; lote(Dt.avantren.tipo, e, n).add(d[0], 0, d[1], d[2] * D2R, 1, n, 'art_rodar_parado', {phase: 0}); }
      info.push(`<b>${D.nombre}</b> · era ${e} · ciclo ${D.ciclo} de ${C.dur} s`, `dotación: ${(Dt ? Dt.servidores : []).map(s => s.rol).join(', ')}`, `eventos: ${C.ev.map(x => x[1] + '@' + x[0].toFixed(2)).join(', ')}`);
      mira.set(0, 0.8, -1.5); dist = /mortero|mg34|vickers|maxim/.test(k) ? 7 : 13; }
    else if (est.vista === 'marcha') { const cf = D.fam === 'p_campana', kind = cf ? `art_${k}_enganchado` : 'art_carro_municion', cl = 'art_rodar_' + est.aire, C = T3.CLIPS.armon[cl], ca = 'cab_' + est.aire, M = META[cl];
      actual = C; const bv = lote(kind, e, n); bv.add(0, 0, 0, 0, 1, n, cl, {phase: 0}); moviles.push([bv, cl, C]);
      formacion('tiro', 6).forEach((p, i) => { const b = lote(p.tipo, e, n); b.add(p.x, 0, p.z, 0, 1, n, ca, {phase: (i * 0.13) % 1, horse: i % 4}); moviles.push([b, null, null, i, p]); });
      META_S.art_sentado_cofre.puestos.forEach(p => { const b = lote('inf_art_apuntador', e, n); b.add(p[0], 0, p[2], 0, 1, n, 'art_sentado_cofre', {phase: Math.random()}); moviles.push([b, null, null, 0, {x: p[0], z: p[2]}]); });
      info.push(`${cf ? D.nombre : 'carro de municiones (esta pieza no va en avantrén de campaña)'} · tiro de 6 al ${est.aire}`, `${M.velocidad} m/s; una vuelta de rueda (4,08 m) por ciclo; los cascos de caballeria3d`); dist = 18; az = 1.3; el = 0.2; }
    else if (est.vista === 'desenganchar') { const kk = D.fam === 'p_campana' ? k : 'canon_12', cl = `art_${kk}_desenganchar`, C = T3.CLIPS.armon[cl]; actual = C; ag(lote(`art_${kk}_enganchado`, eraDe(kk), n), cl);
      ['iz', 'de'].forEach(s => ag(lote('inf_art_cebador', eraDe(kk), n), `art_contera_${s}_${kk}`));
      info.push(`desenganchar ${PIEZAS[kk].nombre}: la contera sale del pinzote, la pieza gira 180° sobre su eje y queda en batería`, `relevo al acabar: ${META[cl].relevo.pieza} en [${META[cl].relevo.desfase.join(', ')}]`); mira.set(0, 0.6, -2.5); dist = 11; }
    else if (est.vista === 'piezas') { const lista = PZ.filter(x => !est.era || PIEZAS[x].eras.includes(est.era)); lista.forEach((x, i) => { const C = T3.CLIPS[PIEZAS[x].fam][`art_${x}_reposo`]; lote('art_' + x, eraDe(x), n).add((i - (lista.length - 1) / 2) * 3.4, 0, 0, 0.6, 1, n, `art_${x}_reposo`, {phase: 0}); });
      info.push(`${lista.length} piezas${est.era ? ' de la era ' + est.era : ''}`); mira.set(0, 0.6, 0); dist = 4 + lista.length * 2.2; az = 0; el = 0.25; }
    else { const kk = D.fam === 'p_campana' ? k : 'canon_12', ee = eraDe(kk);
      [[`art_${kk}_rueda_rota`, -4.5], [`art_${kk}_desmontada`, 0], ['art_explota', 6]].forEach(([cl, x]) => { const rig = cl === 'art_explota' ? 'armon' : PIEZAS[kk].fam, C = T3.CLIPS[rig][cl], kind = rig === 'armon' ? 'art_carro_municion' : 'art_' + kk;
        lote(kind, ee, n).add(x, 0, 0, 0, 1, n, cl, {phase: 0}); });
      lote('inf_art_escobillon', ee, n).add(0, 0, 0, 0, 1, n, 'art_srv_muerto_rueda', {phase: 0}); actual = T3.CLIPS[PIEZAS[kk].fam][`art_${kk}_desmontada`];
      const b2 = lote('inf_art_cargador', ee, n); b2.add(0, 0, 0, 0, 1, n, 'art_srv_herido_sentado', {phase: 0});
      info.push('rueda rota · pieza desmontada (cureña partida) · explosión del cofre (carro) · muerto junto a la rueda · herido'); mira.set(0, 0.6, 0); dist = 16; az = 0.3; }
    $('info').innerHTML = info.filter(Boolean).join('<br>');
  }
  ['vista', 'pieza', 'era', 'nat', 'aire'].forEach(k => $(k).onchange = () => { est[k] = $(k).value; montar(); });
  let arr = null; R.domElement.onpointerdown = e => { arr = [e.clientX, e.clientY]; }; root.addEventListener('pointerup', () => { arr = null; });
  R.domElement.onpointermove = e => { if (!arr) return; az -= (e.clientX - arr[0]) * 0.008; el = Math.max(0.02, Math.min(1.4, el + (e.clientY - arr[1]) * 0.006)); arr = [e.clientX, e.clientY]; };
  R.domElement.onwheel = e => { dist = Math.max(3, Math.min(120, dist * (1 + Math.sign(e.deltaY) * 0.1))); e.preventDefault(); };
  montar(); let prev = performance.now(), vivo = true; const m4 = new THREE.Matrix4();
  (function paso() { if (!vivo) return; const now = performance.now(), dt = Math.min(0.1, (now - prev) / 1000); prev = now; const w = cont.clientWidth || innerWidth, h = cont.clientHeight || innerHeight;
    if (R.domElement.width !== Math.round(w * R.getPixelRatio()) || R.domElement.height !== Math.round(h * R.getPixelRatio())) R.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix();
    reloj += dt; const C = actual; let tt;
    if (C) { if ($('play').checked) { tt = C.loop !== false ? (reloj / C.dur) % 1 : Math.min(1, (reloj % (C.dur + 1.5)) / C.dur); $('t').value = tt; } else tt = +$('t').value;
      // en «servicio» y «desenganchar» todos los clips comparten el tiempo del clip principal (misma duración): fase fija y reloj común
      sh.timeU.value = tt * C.dur;   // todas las figuras empiezan con fase / inicio 0: comparten el tiempo del clip principal (misma duración)
    } else sh.timeU.value = reloj;
    if (est.vista === 'marcha') { sh.timeU.value = reloj; const v = META['art_rodar_' + est.aire].velocidad, z = v * reloj; moviles.forEach(([b, cl, CC, i, p]) => { m4.makeTranslation(p ? p.x : 0, 0, (p ? p.z : 0) + z); b.mesh.setMatrixAt(0, m4); b.mesh.instanceMatrix.needsUpdate = true; });
      mira.set(0, 1.0, z + 3); }
    cam.position.set(mira.x + Math.sin(az) * Math.cos(el) * dist, mira.y + Math.sin(el) * dist, mira.z + Math.cos(az) * Math.cos(el) * dist); cam.lookAt(mira); R.render(S, cam); requestAnimationFrame(paso); })();
  return {renderer: R, escena: S, camara: cam, montar, estado: est, parar() { vivo = false; R.dispose(); }};
}

const API = {PIEZAS, FAM, CICLOS, CLIPS, META, CLIPS_S, META_S, DOTACIONES, TRANSICIONES, rutaTransicion, GRUPOS, formacion, boca, puntos, enPieza, elevDe, registrar, demoArtilleria, _crear: crear, instancia: () => _I, ARMON};
root.artilleria3d = API;
})(typeof window !== 'undefined' ? window : globalThis);
