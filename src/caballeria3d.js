/* ===== caballeria3d.js — caballería 1836–1945 para el modo «Batalla» de Victoria (three.js r152, sin archivos externos) =====
   Amplía troops3d.js (y usa infanteria3d.js para cabezas, tocados comunes y los jinetes desmontados) sin reemplazar nada.
   registrar(Troops3D, op) añade:
   · CABALLOS: cuerpo ligero (árabe/anglo-árabe de húsares y cazadores), medio (dragones, lanceros, oficiales) y pesado (coraceros,
     caballería de reserva, generales); los 4 pelajes de troops3d (castaño, alazán, negro, tordo) con calcetines, lucero, crin y cola
     de color propio y moteado del tordo por instancia; crin, tupé y cola con ondulación secundaria en el sombreador según el aire.
     Montura y arreos por tipo: silla húngara con piel de oveja (húsares, cazadores), silla de dragón con gualdrapa, silla cosaca alta
     con cojín, fundas de pistola, portacapas, maleta, portapliegos, bolsa de pienso, cabezada con bocado y filete.
   · JINETES (rig «jinete», ≤ 20 partes, LOD0 ≤ 1 800 triángulos con el caballo, LOD1 ≤ 140, LOD2 ≤ 24):
     húsar, coracero, lancero, dragón, cazador a caballo, cosaco, caballería de reserva (carabinero / guardia pesada),
     oficial montado, general y mensajero; caballos sin jinete (cab_caballo_ligero/medio/pesado) para los que huyen o se llevan de la brida.
     Jinetes desmontados (rig «soldado», tipos inf_cab_*) con el uniforme de su arma: el dragón a pie y el jinete derribado.
   · ANIMACIONES (CLIPS.jinete y CLIPS.soldado, mismo formato): aires con sable y con lanza (parado, paso, trote sentado y levantado,
     galope, galope de carga con suspensión), rampa, giros cerrados, salto de obstáculo, paso atrás; carga con lanza (ristre → impacto →
     soltar), carga con sable (alzar, tajo, reponer), golpe a un infante y a otro jinete (emparejados, eventos coincidentes), parada entre
     jinetes, cojera, caída del caballo con el jinete derribado (grupo: caballo + jinete a pie), jinete que cae y se levanta, caballo sin
     jinete huyendo, persecución con el sable bajo, desmontar y montar, saludo y señal del oficial.
   · ESCUADRONES: formacion(tipo, n, op) devuelve posiciones relativas (línea de dos filas, columna de a cuatro, columna de escuadrones).
   Fuentes: «Ordonnance du 6 décembre 1829 sur l'exercice et les évolutions de la cavalerie»; «Instructions and Regulations for the
   Formations and Movements of the Cavalry» (1833) y «Cavalry Drill» (1896, 1912); Muybridge, «Animals in Motion» (1899) para los aires;
   Clayton, «The Dynamic Horse» (2004); Funcken y Osprey Men-at-Arms para uniformes; «aprox.» donde variaba por regimiento.
   API: registrar(Troops3D, op) → {tipos, clips} · prepararLote(lote) · marcar(lote, i, {pelaje, marcas, crin}) · TIPOS · META · TRANSICIONES ·
        rutaTransicion · GRUPOS · formacion(tipo, n, op) · demoCaballeria(cont) */
(function (root) {
'use strict';
const THREE = root.THREE;
const Z = {MAIN: 0, TRIM: 1, ACC: 2, HAT: 3, F1: 4, F2: 5, F3: 6, FIX: 12};
// aVar: 1 piel · 2 pelaje · 3–6 vello y pelo del jinete (infanteria3d) · 7–10 calcetín de cada pata (MI, MD, PI, PD) · 11 lucero
//       12 + w·0,9 crin, tupé y cola (w = peso de la ondulación, 0 en la raíz) · 13 casco del caballo
const V = {SKIN: 1, CAB: 2, CALC: 7, LUCERO: 11, CRIN: 12, CASCO: 13};
const C = {cuero: 0x5a3a22, cueroN: 0x26201c, cueroR: 0x7a4a2a, correaB: 0xe8e2d0, madera: 0x7a5232, acero: 0x9aa0a6, hierro: 0x3a3c40, laton: 0xc8a048, oro: 0xd8b04a,
  plata: 0xd8dade, bota: 0x1e1a18, negro: 0x1c1a1a, blanco: 0xece6d6, rojo: 0xa81c1c, piel: 0xe0b48c, pellejo: 0xd8ccb0, pielO: 0x2e2620, pielG: 0x4a443c, crinN: 0x16120e,
  lona: 0x8a8460, manta: 0x6a5e4a, casco: 0x2a2420, ojo: 0x16120e, hoja: 0xd8dce0, rosa: 0xc89080, caqui: 0x8a7a52};
const ERAS = ['A', 'B', 'C', 'D', 'E'];
const D2R = Math.PI / 180;

/* ===================================================================================== */
/* TIPOS DE JINETE
   cuerpo: ligero | medio | pesado · silla: hungara (piel de oveja) | dragon (gualdrapa) | cosaca · arma: sable_curvo | sable_recto | shashka |
   lanza | pica · pal: papel de la paleta de troops3d · toc(era, nat) → tocado (los de caballería se dibujan aquí; el resto, infanteria3d) */
const TOC_LINEA = (nat, era) => ({A: 'kepi', B: 'kepi', C: 'kepi', D: nat === 'PRU' || nat === 'GER' || nat === 'AUT' ? 'stahl' : nat === 'GBR' ? 'brodie' : nat === 'RUS' ? 'gorra_rusa' : 'adrian', E: nat === 'GER' || nat === 'PRU' ? 'stahl' : nat === 'RUS' || nat === 'URS' ? 'ssh40' : nat === 'GBR' ? 'brodie' : nat === 'USA' ? 'm1' : nat === 'JPN' ? 'casco_jp' : 'adrian'}[era]);
const JINETES = {
  husar: {nombre: 'Húsar', cuerpo: 'ligero', silla: 'hungara', arma: 'sable_curvo', pal: 'caballeria', eras: ['A', 'B', 'C', 'D'], carabina: e => e >= 'C',
    toc: (e, n) => e <= 'C' ? (n === 'GBR' || n === 'PRU' || n === 'GER' ? 'colback' : 'chaco') : TOC_LINEA(n, e), alamares: e => e <= 'C', pelliza: e => e <= 'B', portapliegos: e => e <= 'B'},
  coracero: {nombre: 'Coracero', cuerpo: 'pesado', silla: 'dragon', arma: 'sable_recto', pal: 'linea', eras: ['A', 'B', 'C', 'D'], coraza: e => e <= 'D',
    toc: (e, n) => e <= 'D' ? 'casco_cor' : TOC_LINEA(n, e)},
  lancero: {nombre: 'Lancero', cuerpo: 'medio', silla: 'dragon', arma: 'lanza', pal: 'caballeria', eras: ['A', 'B', 'C', 'D'], dobleCara: true, plastron: e => e <= 'C',
    toc: (e, n) => e <= 'C' ? 'czapka' : TOC_LINEA(n, e), carabina: e => e >= 'C'},
  dragon: {nombre: 'Dragón', cuerpo: 'medio', silla: 'dragon', arma: 'sable_recto', pal: 'linea', eras: ['A', 'B', 'C', 'D', 'E'], carabina: () => true, pie: true,
    toc: (e, n) => e <= 'B' ? (n === 'PRU' || n === 'GER' ? 'pickel' : 'casco_dragon') : e === 'C' ? (n === 'PRU' || n === 'GER' ? 'pickel' : n === 'FRA' ? 'casco_dragon' : 'kepi') : TOC_LINEA(n, e)},
  cazador: {nombre: 'Cazador a caballo', cuerpo: 'ligero', silla: 'hungara', arma: 'sable_curvo', pal: 'caballeria', eras: ['A', 'B', 'C', 'D'], carabina: () => true,
    toc: (e, n) => e <= 'B' ? 'chaco' : e === 'C' ? 'kepi' : TOC_LINEA(n, e)},
  cosaco: {nombre: 'Cosaco', cuerpo: 'ligero', silla: 'cosaca', arma: 'shashka', pal: 'caballeria', eras: ['A', 'B', 'C', 'D', 'E'], carabina: () => true, pica: e => e <= 'D', cherkeska: true,
    toc: (e, n) => e === 'E' ? 'kubanka' : 'papaja'},
  reserva: {nombre: 'Caballería de reserva (carabinero / guardia)', cuerpo: 'pesado', silla: 'dragon', arma: 'sable_recto', pal: 'guardia', eras: ['A', 'B', 'C'], coraza: e => e <= 'B', corazaLaton: true,
    toc: () => 'casco_carab'},
  oficial: {nombre: 'Oficial de caballería montado', cuerpo: 'medio', silla: 'dragon', arma: 'sable_recto', pal: 'linea', eras: ERAS.slice(), oficial: true,
    toc: (e, n) => e <= 'B' ? 'chaco' : e === 'C' ? 'kepi' : e === 'D' ? 'gorra' : (n === 'GER' || n === 'PRU' ? 'gorra' : 'gorra')},
  general: {nombre: 'General a caballo', cuerpo: 'pesado', silla: 'dragon', arma: 'sable_recto', pal: 'linea', eras: ERAS.slice(), oficial: true, general: true, catalejo: true,
    toc: (e, n) => e === 'A' ? 'bicornio' : e <= 'C' ? (n === 'PRU' || n === 'GER' ? 'pickel' : 'kepi') : 'gorra'},
  mensajero: {nombre: 'Mensajero a caballo', cuerpo: 'ligero', silla: 'hungara', arma: 'ninguna', pal: 'caballeria', eras: ERAS.slice(), cartera: true,
    toc: (e, n) => e <= 'C' ? 'kepi' : e === 'D' ? 'gorra' : TOC_LINEA(n, e)}
};
const CUERPO = {ligero: {k: 0.93, kz: 0.97, pata: 0.9, crin: 'larga'}, medio: {k: 1.0, kz: 1.0, pata: 1.0, crin: 'corta'}, pesado: {k: 1.1, kz: 1.03, pata: 1.12, crin: 'corta'}};

function crear(T3, INF) {
const GB = T3._dev.GeoBuilder, xf = T3._dev.xf, P = {}; T3.RIGS.jinete.forEach((p, i) => { P[p[0]] = i; });

/* ---------- caballo (cotas de troops3d: cruz 1,50 m, dorso 1,40, vientre 0,85, codo 1,0, rodilla 0,58, corvejón 0,62; mira hacia +z) ---------- */
function caballo(g, o) {
  const K = CUERPO[o.cuerpo || 'medio'], k = K.k, F = Z.FIX, hc = 0xffffff, hv = V.CAB, B = P.caballo;
  const R = (z, rx, ry, cy) => [z * K.kz, rx * k, ry * (0.96 + 0.04 * k), 0, cy];
  // tronco: grupa, costillar, cruz y pecho (sección superelíptica)
  g.loft(B, F, hc, [R(-0.78, 0.06, 0.1, 0.06), R(-0.7, 0.18, 0.23, 0.06), R(-0.5, 0.24, 0.285, 0.05), R(-0.15, 0.252, 0.28, 0.015),
    R(0.24, 0.262, 0.29, 0.02), R(0.47, 0.225, 0.3, 0.06), R(0.65, 0.15, 0.24, 0.05), R(0.74, 0.06, 0.12, 0.04)], 10, {axis: 'z', p: 2.2, capA: true, capB: true, vr: hv, a0: Math.PI / 10});
  g.loft(B, F, hc, [[0.24 * K.kz, 0.12 * k, 0.1, 0, 0.27], [0.5 * K.kz, 0.11 * k, 0.1, 0, 0.29]], 5, {axis: 'z', vr: hv});                       // cruz
  // cuello: sube 35°; en el pesado más grueso y arqueado
  const nk = o.cuerpo === 'pesado' ? 1.12 : o.cuerpo === 'ligero' ? 0.92 : 1;
  g.loft(P.cuello, F, hc, [[-0.12, 0.16 * nk, 0.25 * nk, 0, 0.0], [0.05, 0.14 * nk, 0.21 * nk, 0, -0.01], [0.3, 0.105 * nk, 0.155 * nk, 0, -0.005], [0.56, 0.08 * nk, 0.12 * nk, 0, 0.01], [0.66, 0.075, 0.11, 0, 0.02]], 8,
    {rot: [35, 0, 0], capB: true, vr: hv});
  // crin: mechones que caen a un lado (largos en el ligero, cortos/recortados en el medio y pesado; trenzada en el cosaco)
  const crest = u => xf([[0, 0.05 + u * 0.6, -0.17 * nk + u * 0.08 - Math.sin(u * Math.PI) * 0.02]], [0, 0, 0], [35, 0, 0])[0], larga = (o.crin || K.crin) === 'larga', n = larga ? 6 : 4;
  for (let i = 0; i < n; i++) { const a = crest(i / n), b = crest((i + 1) / n), dl = larga ? 0.16 : 0.08, s = i % 2 ? 1 : 1;
    const q = [[0.012, a[1] + 0.03, a[2] - 0.02], [0.012, b[1] + 0.03, b[2] - 0.02], [0.012 + 0.05 * s, b[1] - dl, b[2] - 0.04], [0.012 + 0.05 * s, a[1] - dl, a[2] - 0.04]];
    const v0 = V.CRIN, v1 = V.CRIN + 0.9;
    g.tri(q[0], q[3], q[2], P.cuello, F, 0, v0); g.tri(q[0], q[2], q[1], P.cuello, F, 0, v0);
    // la ondulación se pondera por vértice: se rehace el último par con peso
    const L = g.vr.length; g.vr[L - 5] = v1; g.vr[L - 4] = v1; g.vr[L - 2] = v1;                                   // (q3, q2 del 1.er triángulo; q2 del 2.º)
    g.quad([-0.012, a[1] + 0.03, a[2] - 0.02], [-0.012, b[1] + 0.03, b[2] - 0.02], [-0.04, b[1] - dl * 0.4, b[2] - 0.03], [-0.04, a[1] - dl * 0.4, a[2] - 0.03], P.cuello, F, 0, V.CRIN);
  }
  // cabeza (de la nuca al morro, 0,56 m, inclinada 50°); el ligero, más fina y de perfil cóncavo
  const H = (x, y, z) => xf([[x, y, z]], [0, 0, 0], [50, 0, 0])[0], hk = o.cuerpo === 'ligero' ? 0.92 : o.cuerpo === 'pesado' ? 1.06 : 1, T = P.testa;
  g.loft(T, F, hc, [[-0.06, 0.07 * hk, 0.1, 0, -0.04], [0.08, 0.1 * hk, 0.13, 0, -0.028], [0.3, 0.075 * hk, 0.098, 0, o.cuerpo === 'ligero' ? 0.006 : -0.004],
    [0.5, 0.062 * hk, 0.075, 0, -0.005], [0.56, 0.05 * hk, 0.055, 0, -0.01]], 8, {axis: 'z', rot: [50, 0, 0], capB: true, domeB: 0.02, vr: hv, p: 2.2});
  [1, -1].forEach(s => {
    const b = H(0.05 * s, 0.11, -0.04);                                                                                                    // orejas
    g.tri([b[0] - 0.025 * s, b[1], b[2] + 0.02], [b[0] + 0.02 * s, b[1], b[2] - 0.02], [b[0] + 0.015 * s, b[1] + 0.13, b[2] - 0.04], T, F, hc, hv);
    g.tri([b[0] + 0.02 * s, b[1], b[2] - 0.02], [b[0] - 0.025 * s, b[1], b[2] + 0.02], [b[0] + 0.015 * s, b[1] + 0.13, b[2] - 0.04], T, F, hc, hv);
    const e = H(0.094 * s * hk, 0.05, 0.12), e2 = H(0.089 * s * hk, 0.03, 0.15), e3 = [e[0], e[1] - 0.025, e[2] + 0.005];                // ojo
    if (s > 0) g.tri(e, e2, e3, T, F, C.ojo); else g.tri(e, e3, e2, T, F, C.ojo);
    const n0 = H(0.042 * s, 0.03, 0.53), n1 = H(0.047 * s, -0.01, 0.52), n2 = [n0[0], n0[1] - 0.02, n0[2] + 0.02];                        // ollar
    if (s > 0) g.tri(n0, n1, n2, T, F, C.ojo); else g.tri(n0, n2, n1, T, F, C.ojo);
  });
  { const a = H(-0.03, 0.105, 0.1), b = H(0.03, 0.105, 0.1), c = H(0.022, 0.08, 0.44), d = H(-0.022, 0.08, 0.44);                         // lucero / cordón (se ve blanco si la instancia lo lleva)
    g.quad([a[0], a[1] + 0.006, a[2] + 0.006], [b[0], b[1] + 0.006, b[2] + 0.006], [c[0], c[1] + 0.004, c[2] + 0.004], [d[0], d[1] + 0.004, d[2] + 0.004], T, F, hc, V.LUCERO); }
  { const fl = H(0, 0.12, 0.02), fl2 = H(0, 0.1, 0.18);                                                                                    // tupé
    g.quad([fl[0] - 0.04, fl[1], fl[2]], [fl[0] + 0.04, fl[1], fl[2]], [fl2[0] + 0.03, fl2[1] + 0.012, fl2[2]], [fl2[0] - 0.03, fl2[1] + 0.012, fl2[2]], T, F, 0, V.CRIN + 0.6); }
  // patas: antebrazo/pierna con masa muscular; caña con tendón, menudillo, cuartilla (marca blanca por pata) y casco
  const pk = K.pata, legs = [['manoIz', 'canaIz', 0, false, 1], ['manoDe', 'canaDe', 1, false, -1], ['pataIz', 'corvIz', 2, true, 1], ['pataDe', 'corvDe', 3, true, -1]];
  legs.forEach(([up, low, idx, hind]) => {
    if (!hind) g.loft(P[up], F, hc, [[-0.45, 0.043 * pk, 0.048 * pk], [-0.3, 0.054 * pk, 0.062 * pk, 0, -0.004], [-0.12, 0.068 * pk, 0.082 * pk, 0, -0.005], [0.05, 0.088 * pk, 0.115 * pk]], 6, {vr: hv});
    else g.loft(P[up], F, hc, [[-0.48, 0.045 * pk, 0.064 * pk, 0, -0.03], [-0.3, 0.062 * pk, 0.095 * pk, 0, -0.01], [-0.1, 0.092 * pk, 0.16 * pk, 0, 0.02], [0.1, 0.12 * pk, 0.21 * pk, 0, 0.03]], 6, {vr: hv});
    const y0 = hind ? -0.615 : -0.575, m = V.CALC + idx;
    const ck = o.cuerpo === 'pesado' ? 1.25 : 1;                                                                                     // cernejas del pesado: menudillo más ancho
    g.loft(P[low], F, hc, [[hind ? 0.03 : 0.0, 0.04 * pk, (hind ? 0.06 : 0.05) * pk, 0, hind ? -0.03 : 0], [y0 + 0.3, 0.034 * pk, 0.044 * pk, 0, -0.008], [y0 + 0.15, 0.041 * pk * ck, 0.052 * pk * ck, 0, -0.012],
      [y0 + 0.075, 0.036 * pk * ck, 0.04 * pk * ck, 0, 0.022]], 5, {vr: m});                                                                  // caña, menudillo y cuartilla (con la marca blanca de la pata)
    g.loft(P[low], F, C.casco, [[y0 + 0.075, 0.042 * pk, 0.046 * pk, 0, 0.03], [y0, 0.052 * pk, 0.062 * pk, 0, 0.042]], 5, {capA: true, vr: V.CASCO});                              // casco
  });
  // cola: maslo y cerdas (corta y alta en el ligero; larga en el pesado; anudada en la cosaca)
  const largo = o.cuerpo === 'pesado' ? 0.82 : o.cuerpo === 'ligero' ? 0.74 : 0.78;
  g.loft(P.cola, F, hc, [[0.02, 0.05, 0.05], [-0.18, 0.035, 0.04, 0, -0.06]], 6, {vr: hv});
  const ring = (t, r, rz, dz) => [t, r, rz, 0, dz];
  const rings = [ring(-0.12, 0.05, 0.05, -0.05), ring(-0.34, 0.085, 0.06, -0.12), ring(-0.58, 0.075, 0.05, -0.14), ring(-largo, 0.03, 0.03, -0.12)];
  // anillos con peso creciente de ondulación: se hacen por tramos para que el sombreador sepa la distancia al maslo
  for (let i = 0; i < rings.length - 1; i++) g.loft(P.cola, F, 0, [rings[i], rings[i + 1]], 5, {capB: i === rings.length - 2, p: 1.6, vr: V.CRIN + 0.3 * i});
}

/* ---------- montura y arreos (parte «silla», y = 0 en el asiento a 1,38 m; cabezada en «testa»; pretal en «caballo») ---------- */
function arreos(g, o) {
  const S = P.silla, F = Z.FIX, AB = o.era <= 'B', silla = o.silla || 'dragon', cos = silla === 'cosaca';
  const kb = CUERPO[o.cuerpo || 'medio'].k;
  if (silla === 'dragon') [1, -1].forEach(s => {                                                                                         // gualdrapa con galón (dos paños que siguen el costillar)
    const L = AB ? 0.46 : 0.34, D = AB ? 0.38 : 0.27, x0 = 0.17 * s, x1 = (0.27 * kb + 0.035) * s, x2 = (0.27 * kb + 0.045) * s;
    const q = [[x0, 0.01, -L], [x0, 0.01, L * 0.8], [x1, -D * 0.5, L * 0.78], [x1, -D * 0.5, -L * 0.97], [x2, -D, L * 0.72], [x2, -D, -L * 0.96]];
    [[0, 1, 2, 3], [3, 2, 4, 5]].forEach(([a, b, c, d]) => { if (s < 0) g.quad(q[a], q[d], q[c], q[b], S, Z.TRIM, 0); else g.quad(q[a], q[b], q[c], q[d], S, Z.TRIM, 0); });
    if (AB || o.oficial) g.strap(S, F, o.oficial ? C.oro : C.blanco, [q[5], q[4]].map(p => [p[0] + 0.004 * s, p[1] + 0.025, p[2]]), 0.035, [s, 0, 0]);
  });
  else if (silla === 'hungara') [1, -1].forEach(s => {                                                                                   // piel de oveja con dientes de lobo (borde de color)
    const q = [[0.16 * s, 0.06, -0.36], [0.16 * s, 0.06, 0.34], [(0.27 * kb + 0.03) * s, -0.24, 0.3], [(0.27 * kb + 0.03) * s, -0.24, -0.38]];
    if (s < 0) g.quad(q[0], q[3], q[2], q[1], S, F, C.pellejo); else g.quad(q[0], q[1], q[2], q[3], S, F, C.pellejo);
    for (let i = 0; i < 4; i++) { const z0 = -0.36 + i * 0.17, z1 = z0 + 0.17, zm = (z0 + z1) / 2; const xx = 0.27 * kb + 0.032, a = [xx * s, -0.24, z0 * 0.98], b = [xx * s, -0.24, z1 * 0.98], c = [(xx - 0.012) * s, -0.17, zm];
      if (s < 0) g.tri(a, b, c, S, Z.TRIM, 0); else g.tri(a, c, b, S, Z.TRIM, 0); } });
  else [1, -1].forEach(s => {                                                                                                            // cosaca: faldones cortos y alforjas
    g.quad([0.16 * s, 0.02, -0.26], [0.16 * s, 0.02, 0.22], [0.22 * s, -0.22, 0.18], [0.22 * s, -0.22, -0.22], S, F, C.cueroN); g.quad([0.16 * s, 0.02, 0.22], [0.16 * s, 0.02, -0.26], [0.22 * s, -0.22, -0.22], [0.22 * s, -0.22, 0.18], S, F, C.cueroN);
    g.box(S, F, C.cuero, [0.25 * s, -0.12, -0.36], [0.06, 0.18, 0.16], {bottom: true}); });
  // asiento, borrén y perilla (la cosaca, más alta y con cojín)
  g.loft(S, F, cos ? C.cuero : C.cueroR, [[-0.27, 0.13, 0.04, 0, 0.09], [-0.2, 0.17, 0.05, 0, 0.04], [0.05, 0.16, 0.045, 0, 0.03], [0.2, 0.12, 0.05, 0, cos ? 0.1 : 0.06], [0.26, 0.06, 0.04, 0, cos ? 0.16 : 0.1]], 6,
    {axis: 'z', capA: true, capB: true, p: 2.6});
  if (cos) g.box(S, Z.TRIM, 0, [0, 0.1, -0.03], [0.26, 0.06, 0.36], {});                                                                 // cojín (podushka)
  [1, -1].forEach(s => {
    if (!cos) { g.quad([0.17 * s, 0.03, -0.12], [0.17 * s, 0.03, 0.2], [0.2 * s, -0.22, 0.17], [0.2 * s, -0.22, -0.06], S, F, C.cueroR); g.quad([0.17 * s, 0.03, 0.2], [0.17 * s, 0.03, -0.12], [0.2 * s, -0.22, -0.06], [0.2 * s, -0.22, 0.17], S, F, C.cueroR); }
    g.strap(S, F, C.cueroN, [[0.17 * s, 0.0, 0.14], [0.255 * s, -0.4, 0.17], [0.24 * s, -0.62, 0.13]], 0.045, [s, 0, 0]);                  // cincha
    g.strap(S, F, C.cueroN, [[0.17 * s, 0.0, 0.0], [0.285 * s, -0.42, 0.08]], 0.018, [s, 0, 0]);                                           // ación
    g.box(S, F, C.hierro, [0.29 * s, -0.5, 0.1], [0.02, 0.1, 0.11], {noTop: true});                                                         // estribo
    if (!cos && o.era <= 'C') g.cyl(S, F, C.cueroN, [0.13 * s, -0.08, 0.36], 0.045, 0.035, 0.24, 5, {rot: [18, 0, 0], bottom: true});    // funda de pistola
  });
  if (silla !== 'cosaca') g.loft(S, o.era <= 'C' ? Z.TRIM : F, o.era <= 'C' ? 0 : C.lona, [[-0.2, 0.06, 0.065], [0.2, 0.06, 0.065]], 6, {axis: 'x', at: [0, 0.08, -0.36], capA: true, capB: true});   // maleta
  g.loft(S, F, o.era <= 'B' ? 0x5a5448 : C.manta, [[-0.17, 0.05, 0.05, 0, -0.04], [0, 0.055, 0.055, 0, 0.02], [0.17, 0.05, 0.05, 0, -0.04]], 5, {axis: 'x', at: [0, 0.1, 0.31], capA: true, capB: true});   // capote en la perilla
  if (o.era >= 'C' && !cos) g.loft(S, F, C.lona, [[-0.05, 0.06, 0.09], [0.05, 0.06, 0.09]], 6, {axis: 'x', at: [-0.27, -0.06, -0.2], capA: true, capB: true});   // bolsa de pienso
  // pretal (con media luna de latón en los oficiales y generales) y grupera
  [1, -1].forEach(s => g.strap(P.caballo, F, C.cueroN, [[0.15 * s, 0.2, 0.5], [0.2 * s, 0.06, 0.6], [0.11 * s, -0.04, 0.71], [0.0, -0.06, 0.75]], 0.035, [s, 0, 0.6]));
  if (o.oficial) g.octa(P.caballo, F, C.laton, [0, -0.05, 0.77], 0.035, {rz: 0.012});
  [1, -1].forEach(s => g.strap(P.caballo, F, C.cueroN, [[0.08 * s, 0.31, -0.45], [0.2 * s, 0.24, -0.66], [0.17 * s, 0.07, -0.76]], 0.03, [s, 0.6, 0]));
  // cabezada: carrillera, frontalera, muserola, bocado y filete; riendas al cuello
  const H = (x, y, z) => xf([[x, y, z]], [0, 0, 0], [50, 0, 0])[0], T = P.testa, fr = o.era <= 'B' && o.oficial ? C.laton : C.cueroN;
  [1, -1].forEach(s => { g.strap(T, F, C.cueroN, [H(0.08 * s, 0.11, -0.03), H(0.104 * s, 0.03, 0.12), H(0.075 * s, -0.04, 0.36), H(0.067 * s, -0.03, 0.45)], 0.025, [s, 0, 0]);
    g.strap(T, F, fr, [H(0.0, 0.135, 0.06), H(0.1 * s, 0.11, 0.06)], 0.025, [0, 1, 0]); });
  g.loft(T, F, C.cueroN, [[0.36, 0.074, 0.09], [0.4, 0.074, 0.09]], 8, {axis: 'z', rot: [50, 0, 0], p: 2.2});
  g.loft(T, F, C.acero, [[-0.085, 0.008, 0.008], [0.085, 0.008, 0.008]], 4, {axis: 'x', at: H(0, -0.04, 0.46)});
  [1, -1].forEach(s => g.strap(P.cuello, F, C.cueroN, [xf([[0.08 * s, 0.6, 0.12]], [0, 0, 0], [35, 0, 0])[0], [0.09 * s, 0.25, 0.28], [0.06 * s, 0.05, 0.3]], 0.02, [s, 0, 0]));
}

/* ---------- jinete: piernas fijas en la silla, torso con prendas por tipo, cabeza de infanteria3d, brazos ---------- */
const TR = [[0.0, 0.16, 0.103], [0.18, 0.174, 0.115, 0, 0.01], [0.36, 0.18, 0.118, 0, 0.006], [0.42, 0.17, 0.102, 0, -0.006], [0.47, 0.105, 0.07, 0, -0.012], [0.5, 0.06, 0.055]];
const fz = y => { const r = TR.reduce((a, b) => b[0] <= y ? b : a, TR[0]); return (r[4] || 0) + r[2]; };
function jinete(g, o) {
  const S = P.silla, T = P.torso, F = Z.FIX, coat = Z.MAIN, trim = Z.TRIM, pants = Z.ACC, AB = o.era <= 'B', t = o.tipo, J = JINETES[t];
  // piernas (asiento militar de estribo largo): muslo, pierna, bota con espuela. Húsar: pantalón ceñido y botas húngaras; cosaco: bombachos con franja
  const botaAlta = t === 'coracero' || t === 'reserva' || t === 'general' || t === 'dragon' || o.era >= 'C';
  [1, -1].forEach(s => {
    const hip = [0.1 * s, 0.1, -0.02], knee = [0.25 * s, -0.24, 0.2], ank = [0.275 * s, -0.6, 0.1];
    g.tube(S, pants, 0, hip, knee, [[0, t === 'cosaco' ? 0.1 : 0.085], [0.5, t === 'cosaco' ? 0.09 : 0.075], [1, 0.058]], 5);
    if (t === 'cosaco' || (AB && (t === 'husar' || t === 'cazador'))) g.strap(S, trim, 0, [[hip[0] + 0.07 * s, hip[1] - 0.02, hip[2]], [knee[0] + 0.055 * s, knee[1], knee[2]]], 0.022, [s, 0, 0]);   // franja / galón
    g.tube(S, botaAlta ? F : pants, botaAlta ? C.bota : 0, knee, ank, [[-0.08, botaAlta ? 0.066 : 0.056], [0.35, 0.055], [1, 0.042]], 5);
    if (t === 'husar' && AB) g.tri([knee[0] + 0.05 * s, knee[1] - 0.05, knee[2] + 0.06], [knee[0] + 0.01 * s, knee[1] - 0.02, knee[2] + 0.07], [knee[0] + 0.03 * s, knee[1] - 0.14, knee[2] + 0.05], S, F, C.oro);   // borla
    g.loft(S, F, C.bota, [[-0.07, 0.037, 0.034, 0, -0.04], [0.0, 0.044, 0.05, 0, -0.03], [0.17, 0.035, 0.022, 0, -0.06]], 5, {axis: 'z', at: [0.288 * s, -0.55, 0.1], capB: true});
    g.tube(S, F, C.acero, [0.288 * s, -0.59, 0.03], [0.288 * s, -0.59, -0.04], [[0, 0.008], [1, 0.004]], 3);                              // espuela
  });
  // torso
  const cherk = J.cherkeska, lev = t === 'general' || (o.oficial && o.era >= 'C');
  g.loft(T, coat, 0, TR, 8, {capB: true, p: 3});
  g.loft(T, coat, 0, [[-0.14, cherk ? 0.24 : 0.2, cherk ? 0.19 : 0.15, 0, -0.03], [0.04, 0.17, 0.11]], 8, {p: 2.6});                         // faldones sobre la silla
  if (cherk) g.loft(T, coat, 0, [[-0.42, 0.25, 0.18, 0, -0.06], [-0.14, 0.24, 0.19, 0, -0.03]], 8, {p: 2.4});                               // la cherkeska llega a la rodilla
  g.loft(T, o.era < 'E' ? trim : coat, 0, [[0.485, 0.07, 0.068], [0.55, 0.066, 0.064, 0, 0.004]], 6, {});                                  // cuello
  if (J.alamares && J.alamares(o.era)) {                                                                                                  // dolmán con alamares y cordones
    for (let i = 0; i < 6; i++) { const y = 0.08 + i * 0.065; g.strap(T, F, o.oficial ? C.oro : C.blanco, [[-0.11, y, fz(y) + 0.008], [0.11, y, fz(y) + 0.008]], 0.014, [0, 0, 1]); }
    [1, -1].forEach(s => g.tri([0.11 * s, 0.07, fz(0.07) + 0.006], [0.11 * s, 0.42, fz(0.42) + 0.006], [0.13 * s, 0.25, fz(0.25) + 0.002], T, F, C.oro));
    g.loft(T, Z.FIX, C.oro, [[0.02, 0.172, 0.114], [0.07, 0.174, 0.116]], 8, {p: 3, flatN: true});                                           // faja de barril
  } else if (J.coraza && J.coraza(o.era)) {
    const cc = J.corazaLaton ? C.laton : C.acero;
    g.loft(T, F, cc, [[0.04, 0.172, 0.126, 0, 0.01], [0.2, 0.187, 0.136, 0, 0.012], [0.38, 0.177, 0.122, 0, 0.0], [0.44, 0.142, 0.102]], 8, {p: 2.8});   // peto y espaldar
    [1, -1].forEach(s => g.strap(T, F, C.laton, [[0.1 * s, 0.44, 0.06], [0.14 * s, 0.44, -0.06]], 0.035, [0, 1, 0]));                       // hombreras de escamas
    g.loft(T, F, C.rojo, [[0.03, 0.175, 0.129], [0.05, 0.176, 0.13]], 8, {p: 2.8});                                                         // forro
  } else if (cherk) {                                                                                                                      // cherkeska: pecho abierto en V y cartucheras (gazyri)
    g.quad([-0.07, 0.42, fz(0.42) + 0.004], [0.0, 0.18, fz(0.18) + 0.006], [0.0, 0.18, fz(0.18) + 0.006], [0.07, 0.42, fz(0.42) + 0.004], T, F, 0x2a2420);
    g.tri([-0.07, 0.42, fz(0.42) + 0.006], [0.0, 0.2, fz(0.2) + 0.008], [0.07, 0.42, fz(0.42) + 0.006], T, Z.TRIM, 0);                     // beshmet
    [1, -1].forEach(s => { for (let i = 0; i < 5; i++) { const y = 0.25 + i * 0.035, x = 0.1 * s, z = fz(y) + 0.01; g.quad([x - 0.035 * s, y, z], [x + 0.035 * s, y, z], [x + 0.035 * s, y + 0.016, z], [x - 0.035 * s, y + 0.016, z], T, F, C.plata); } });
    g.loft(T, F, C.negro, [[0.0, 0.168, 0.112], [0.035, 0.17, 0.114]], 8, {p: 3, flatN: true}); g.box(T, F, C.plata, [0, 0.0, fz(0) + 0.01], [0.02, 0.2, 0.012], {rot: [0, 0, 8]});   // cinturón y kinzhal
  } else {
    const nb = o.era === 'E' ? 4 : 6;
    for (let i = 0; i < nb; i++) { const y = 0.07 + i * (0.36 / (nb - 1)), r = 0.012; g.tri([-r, y - r * 0.7, fz(y) + 0.006], [r, y - r * 0.7, fz(y) + 0.006], [0, y + r, fz(y) + 0.006], T, F, o.era >= 'D' ? 0x5a5440 : C.laton); }
    if (J.plastron && J.plastron(o.era)) g.quad([-0.1, 0.18, fz(0.18) + 0.004], [0.1, 0.18, fz(0.18) + 0.004], [0.12, 0.44, fz(0.44) + 0.004], [-0.12, 0.44, fz(0.44) + 0.004], T, trim, 0);
    if (t === 'dragon' || t === 'cazador' || t === 'mensajero' || o.era >= 'C') g.loft(T, F, o.oficial || o.era >= 'D' ? C.cuero : C.correaB, [[0.0, 0.165, 0.108], [0.045, 0.167, 0.11]], 8, {p: 3, flatN: true});
  }
  if (o.oficial) g.loft(T, o.general ? Z.FIX : trim, o.general ? C.oro : 0, [[0.05, 0.172, 0.115], [0.11, 0.174, 0.118]], 8, {p: 3, flatN: true});   // faja
  if (J.pelliza && J.pelliza(o.era)) {                                                                                                     // pelliza colgada del hombro izquierdo
    g.loft(T, trim, 0, [[0.02, 0.2, 0.08, 0.1, -0.05], [0.46, 0.13, 0.08, 0.08, -0.05]], 6, {rot: [0, 0, -6]});
    g.loft(T, F, C.blanco, [[0.0, 0.205, 0.085, 0.1, -0.05], [0.06, 0.205, 0.085, 0.1, -0.05]], 6, {rot: [0, 0, -6]});
  }
  if (AB && !o.oficial && t !== 'cosaco') g.strap(T, F, C.correaB, [[0.165, 0.44, 0.0], [0.05, 0.3, 0.125], [-0.1, 0.1, 0.115], [-0.17, 0.0, 0.0]], 0.045, [0, 0, 1]);   // bandolera de la cartuchera
  if (o.era >= 'D' && !o.oficial) [1, -1].forEach(s => g.box(T, F, C.cuero, [0.08 * s, 0.03, fz(0.03) + 0.02], [0.07, 0.08, 0.04], {bottom: true}));   // cartucheras de pecho
  if (o.oficial && !AB) g.strap(T, F, C.cuero, [[0.17, 0.44, 0.05], [0.0, 0.25, fz(0.25) + 0.006], [-0.15, 0.03, 0.08]], 0.035, [0, 0, 1]);   // Sam Browne
  // charreteras (oficiales A–C)
  [1, -1].forEach(s => { if (o.oficial && o.era <= 'C') g.loft(T, F, C.oro, [[0.4, 0.07, 0.065], [0.46, 0.09, 0.08]], 6, {at: [0.17 * s, 0, 0], capB: true});
    else g.box(T, o.era >= 'C' ? coat : trim, 0, [0.15 * s, 0.452, -0.004], [0.11, 0.012, 0.06], {rot: [0, 0, -28 * s]}); });
  if (J.carabina && J.carabina(o.era)) g.tube(T, F, C.hierro, [0.22, -0.12, -0.15], [-0.12, 0.52, -0.16], [[0, 0.026], [0.28, 0.03], [1, 0.012]], 4);   // carabina a la espalda
  if (J.cartera) g.box(T, F, C.cuero, [0.19, 0.04, 0.02], [0.05, 0.2, 0.24], {bottom: true});                                              // cartera de despachos
  if (J.portapliegos && J.portapliegos(o.era)) g.box(S, trim, 0, [0.33, -0.3, -0.12], [0.02, 0.3, 0.24], {rot: [0, 0, 6]});                // sabretache
  if (t === 'general') g.loft(P.antebrazoIz, F, C.laton, [[-0.04, 0.02, 0.02], [0.18, 0.016, 0.016]], 4, {axis: 'z', at: [0, -0.3, 0.03], capA: true, capB: true});   // catalejo
  // cabeza (la de infanteria3d) y tocado
  const propio = TOCADOS[o.toc];
  INF.cabeza(g, P.cabeza, {toc: propio ? null : o.toc, oficial: o.oficial, barbaFija: t === 'cosaco'});
  if (propio) propio(g, P.cabeza, o);
  // brazos: izquierdo con las riendas, derecho con el arma
  [['brazoIz', 'antebrazoIz', 1], ['brazoDe', 'antebrazoDe', -1]].forEach(([u, l, s]) => {
    g.loft(P[u], coat, 0, [[-0.28, 0.045, 0.05], [-0.17, 0.052, 0.058, 0.004 * s, 0.0], [-0.05, 0.064, 0.066, 0.006 * s, 0], [0.03, 0.056, 0.06]], 6, {capB: true, domeB: 0.02});
    g.loft(P[l], coat, 0, [[-0.215, 0.038, 0.04], [-0.12, 0.046, 0.05, 0, 0.004], [0.02, 0.046, 0.05]], 6, {});
    g.loft(P[l], cherk ? coat : trim, 0, [[-0.235, 0.044, 0.046], [-0.17, 0.05, 0.052]], 6, {capA: true});                                   // bocamanga
    const gu = o.oficial || t === 'coracero' || t === 'reserva' || AB;                                                                       // guantes de manopla blancos
    g.loft(P[l], F, gu ? C.blanco : C.piel, [[-0.3, 0.03, 0.036, 0, 0.004], [-0.235, 0.036, 0.04]], 6, {capA: true, vr: gu ? 0 : V.SKIN});
    g.tet(P[l], F, gu ? C.blanco : C.piel, [0.022 * s, -0.27, 0.025], 0.016, {vr: gu ? 0 : V.SKIN});
  });
  armaJinete(g, P.arma, J.arma === 'lanza' ? 'lanza' : J.arma, o);
  if (J.pica && J.pica(o.era) && J.arma !== 'lanza') g.cyl(S, F, C.madera, [-0.3, 0.45, -0.3], 0.014, 0.012, 2.6, 4, {rot: [-24, 0, 10]});    // pica cosaca a la espalda en la silla
  if (J.arma !== 'ninguna') {                                                                                                              // vaina (lado izquierdo)
    const curvo = J.arma === 'sable_curvo' || J.arma === 'shashka';
    g.tube(S, F, J.arma === 'shashka' ? C.cueroN : C.acero, [0.31, -0.08, 0.1], [0.34, -0.48, -0.62], [[0, 0.022], [1, 0.016]], 4);
    if (curvo) g.tube(S, F, C.acero, [0.34, -0.48, -0.62], [0.345, -0.43, -0.74], [[0, 0.016], [1, 0.01]], 3);
  }
}

/* ---------- tocados propios de la caballería (cabeza: frente a y 0,215, coronilla 0,29, radio 0,08 × 0,1) ---------- */
const TOCADOS = {
  // colback / busby: piel con bolsa de color (kolpak) y plumero
  colback: (g, h, o) => { g.cyl(h, Z.FIX, C.pielO, [0, 0.33, -0.005], 0.1, 0.108, 0.22, 8, {top: true}); g.loft(h, Z.TRIM, 0, [[0.38, 0.03, 0.03, 0.04, 0.0], [0.3, 0.045, 0.02, -0.11, -0.02]], 5, {capB: true});
    g.cyl(h, Z.FIX, o.oficial ? C.blanco : 0xd8d0c0, [-0.05, 0.47, 0.05], 0.02, 0.03, 0.12, 4, {top: true}); g.strap(h, Z.FIX, C.oro, [[-0.1, 0.36, 0.06], [0.0, 0.3, 0.11], [0.1, 0.36, 0.06]], 0.012, [0, 0, 1]); },
  // coracero: calota de acero, cimera de latón con crin negra y plumero
  casco_cor: (g, h, o) => { g.loft(h, Z.FIX, C.acero, [[0.21, 0.1, 0.12, 0, -0.01], [0.3, 0.096, 0.112, 0, -0.012], [0.36, 0.06, 0.075, 0, -0.01]], 8, {capB: true, domeB: 0.03});
    g.box(h, Z.FIX, C.laton, [0, 0.39, -0.01], [0.03, 0.06, 0.2], {taper: 0.3}); g.quad([-0.09, 0.225, 0.1], [0.09, 0.225, 0.1], [0.08, 0.205, 0.15], [-0.08, 0.205, 0.15], h, Z.FIX, C.laton);
    g.box(h, Z.FIX, C.pielO, [0, 0.27, 0.0], [0.205, 0.05, 0.24], {});                                                                    // turbante de piel
    // crin del casco: mechón que cae por la nuca con ondulación
    g.tri([-0.025, 0.41, -0.1], [0.025, 0.41, -0.1], [0.0, 0.16, -0.24], h, Z.FIX, C.crinN, V.CRIN); const L = g.vr.length; g.vr[L - 1] = V.CRIN + 0.9;
    g.tri([0.025, 0.41, -0.1], [-0.025, 0.41, -0.1], [0.0, 0.16, -0.24], h, Z.FIX, C.crinN, V.CRIN); g.vr[L + 2] = V.CRIN + 0.9;
    if (o.era <= 'B') g.cyl(h, Z.FIX, C.rojo, [0.08, 0.42, 0.02], 0.015, 0.03, 0.18, 4, {top: true}); },
  casco_dragon: (g, h, o) => { g.loft(h, Z.FIX, C.laton, [[0.21, 0.1, 0.12, 0, -0.01], [0.3, 0.096, 0.112, 0, -0.012], [0.36, 0.06, 0.075, 0, -0.01]], 8, {capB: true, domeB: 0.03});
    g.box(h, Z.FIX, C.laton, [0, 0.39, -0.01], [0.03, 0.06, 0.2], {taper: 0.3}); g.box(h, Z.FIX, 0x8a6a3a, [0, 0.27, 0.0], [0.205, 0.05, 0.24], {});   // turbante de piel de leopardo (aprox.)
    g.quad([-0.09, 0.225, 0.1], [0.09, 0.225, 0.1], [0.08, 0.205, 0.15], [-0.08, 0.205, 0.15], h, Z.FIX, C.cueroN);
    g.tri([-0.025, 0.41, -0.1], [0.025, 0.41, -0.1], [0.0, 0.14, -0.26], h, Z.FIX, C.crinN, V.CRIN); const L = g.vr.length; g.vr[L - 1] = V.CRIN + 0.9;
    g.tri([0.025, 0.41, -0.1], [-0.025, 0.41, -0.1], [0.0, 0.14, -0.26], h, Z.FIX, C.crinN, V.CRIN); g.vr[L + 2] = V.CRIN + 0.9; },
  // carabinero / guardia pesada: casco con cimera de oruga (chenille) roja
  casco_carab: (g, h, o) => { g.loft(h, Z.FIX, C.laton, [[0.21, 0.1, 0.12, 0, -0.01], [0.3, 0.096, 0.112, 0, -0.012], [0.37, 0.06, 0.075, 0, -0.01]], 8, {capB: true, domeB: 0.03});
    g.loft(h, Z.TRIM, 0, [[-0.13, 0.03, 0.04, 0.41, 0], [0.0, 0.035, 0.05, 0.43, 0], [0.13, 0.03, 0.04, 0.39, 0]], 5, {axis: 'z', capA: true, capB: true});
    g.quad([-0.09, 0.225, 0.1], [0.09, 0.225, 0.1], [0.08, 0.205, 0.15], [-0.08, 0.205, 0.15], h, Z.FIX, C.cueroN); },
  // czapka de lancero: casquete y tablero cuadrado de color, plumero
  czapka: (g, h, o) => { g.cyl(h, Z.FIX, C.negro, [0, 0.27, 0], 0.096, 0.1, 0.08, 8); g.cyl(h, Z.HAT, 0, [0, 0.34, 0], 0.07, 0.04, 0.06, 4, {a0: Math.PI / 4});
    g.box(h, Z.HAT, 0, [0, 0.42, 0], [0.17, 0.1, 0.17], {taper: -0.25, bottom: true, rot: [0, 45, 0]}); g.box(h, Z.FIX, C.oro, [0, 0.31, 0.1], [0.05, 0.05, 0.01], {});
    g.quad([-0.09, 0.225, 0.1], [0.09, 0.225, 0.1], [0.08, 0.205, 0.15], [-0.08, 0.205, 0.15], h, Z.FIX, C.cueroN);
    g.cyl(h, Z.FIX, o.oficial ? C.blanco : C.negro, [0.07, 0.52, 0.03], 0.012, 0.03, 0.16, 4, {top: true}); },
  // papaja (gorro de piel cosaco) y kubanka (más baja)
  papaja: (g, h, o) => { g.cyl(h, Z.FIX, C.pielG, [0, 0.31, -0.005], 0.104, 0.112, 0.17, 8, {top: false}); g.cyl(h, Z.TRIM, 0, [0, 0.396, -0.005], 0.1, 0.09, 0.012, 8, {top: true});
    g.strap(h, Z.FIX, C.plata, [[-0.08, 0.41, 0.0], [0.08, 0.41, 0.0]], 0.01, [0, 1, 0]); },
  kubanka: (g, h, o) => { g.cyl(h, Z.FIX, C.pielG, [0, 0.29, -0.005], 0.102, 0.106, 0.11, 8); g.cyl(h, Z.TRIM, 0, [0, 0.35, -0.005], 0.1, 0.09, 0.012, 8, {top: true}); }
};

/* ---------- armas del jinete (pivote en la empuñadura, +Y hacia la punta) ---------- */
function armaJinete(g, a, w, o) {
  const F = Z.FIX;
  switch (w) {
    case 'sable_curvo': case 'shashka':                                                                                                    // hoja curva de 0,85 m (húsar, cazador) o shashka sin guarda
      if (w === 'sable_curvo') { g.strap(a, F, C.laton, [[0, -0.05, 0.035], [0, 0.0, 0.05], [0, 0.06, 0.035]], 0.016, [1, 0, 0]); g.box(a, F, C.laton, [0, 0.06, 0], [0.012, 0.012, 0.09], {}); }
      g.box(a, F, w === 'shashka' ? C.cueroN : C.negro, [0, -0.02, 0], [0.026, 0.11, 0.032], {taper: 0.2});
      for (let i = 0; i < 3; i++) { const y0 = 0.07 + i * 0.27, y1 = y0 + 0.27, c0 = 0.012 * i * i, c1 = 0.012 * (i + 1) * (i + 1);
        g.quad([0.003, y0, c0], [0.003, y1, c1], [0.003, y1, c1 + (i === 2 ? 0.006 : 0.03)], [0.003, y0, c0 + 0.034], a, F, C.hoja); g.quad([-0.003, y0, c0], [-0.003, y0, c0 + 0.034], [-0.003, y1, c1 + (i === 2 ? 0.006 : 0.03)], [-0.003, y1, c1], a, F, C.hoja); }
      break;
    case 'sable_recto':                                                                                                                    // hoja recta de 0,97 m con guarda de cazoleta (coraceros, dragones, oficiales)
      g.cyl(a, F, C.laton, [0, 0.03, 0.02], 0.055, 0.045, 0.04, 6, {top: true}); g.box(a, F, C.negro, [0, -0.04, 0], [0.026, 0.1, 0.032], {taper: 0.2});
      g.box(a, F, C.hoja, [0, 0.55, 0.0], [0.007, 0.98, 0.034], {taper: 0.75, noTop: true}); break;
    case 'lanza': {                                                                                                                        // asta de 2,9 m (empuñadura a 1,0 m de la contera), moharra y banderola de dos puntas
      g.cyl(a, F, C.madera, [0, 0.45, 0], 0.016, 0.014, 2.9, 4); g.cyl(a, F, C.acero, [0, 1.95, 0], 0.016, 0, 0.2, 4); g.cyl(a, F, C.hierro, [0, -0.99, 0], 0.012, 0.016, 0.06, 4);
      g.strap(a, F, C.cueroN, [[0, -0.05, 0.02], [0, 0.05, 0.02]], 0.03, [0, 0, 1]);                                                          // dragona
      if (o.era <= 'C') { const y0 = 1.8, Wd = 0.34, Hh = 0.16; for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) {                    // banderola (ondula con el sombreador de troops3d)
          const x0 = i / 2 * Wd, x1 = (i + 1) / 2 * Wd, yy0 = y0 - j * Hh / 2, yy1 = y0 - (j + 1) * Hh / 2, z = j === 0 ? Z.F1 : Z.F2, cut = i === 1 ? (j === 0 ? -0.03 : 0.03) : 0;
          const A = [0, yy0, x0], Bp = [0, yy0 + (i === 1 && j === 0 ? 0 : 0), x1], Cp = [0, yy1 + cut, x1], Dp = [0, yy1, x0], W = x => [x / Wd, 0];
          g.tri(A, Dp, Cp, a, z, C.blanco, 0, W(x0), W(x0), W(x1)); g.tri(A, Cp, Bp, a, z, C.blanco, 0, W(x0), W(x1), W(x1));
          g.tri(A, Cp, Dp, a, z, C.blanco, 0, W(x0), W(x1), W(x0)); g.tri(A, Bp, Cp, a, z, C.blanco, 0, W(x0), W(x1), W(x1)); } }
      break; }
    case 'pica': g.cyl(a, F, C.madera, [0, 0.4, 0], 0.014, 0.012, 2.8, 4); g.cyl(a, F, C.acero, [0, 1.88, 0], 0.014, 0, 0.16, 4); break;
    default: break;
  }
}

/* ---------- niveles de detalle ---------- */
function lod(o, nivel) {
  const g = new GB(), F = Z.FIX, hc = 0xffffff, hv = V.CAB, K = CUERPO[o.cuerpo || 'medio'], jin = !!o.tipo, J = jin ? JINETES[o.tipo] : null;
  if (nivel === 2) {                                                                                                                       // silueta: ≤ 24
    g.box(P.caballo, F, hc, [0, -0.38, 0.05], [0.42 * K.k, 1.5, 1.55], {noTop: true, vr: hv});                                              // 8
    g.box(P.cuello, F, hc, [0, 0.38, 0.24], [0.2, 0.86, 0.36], {rot: [36, 0, 0], taper: 0.2, noTop: true, vr: hv});                          // 8
    if (jin) { g.box(P.torso, Z.MAIN, 0, [0, 0.34, 0], [0.34, 0.72, 0.22], {noTop: true, taper: 0.2}); }                                     // 8 (con el tocado arriba en el color del abrigo)
    else g.box(P.silla, Z.TRIM, 0, [0, -0.1, 0], [0.62, 0.3, 0.7], {noTop: true});
    return g;
  }
  // LOD1: ≤ 140
  g.box(P.caballo, F, hc, [0, 0.02, 0], [0.5 * K.k, 0.52, 1.44 * K.kz], {vr: hv});                                                       // 10
  g.box(P.cuello, F, hc, [0, 0.36, 0.2], [0.2 * K.k, 0.78, 0.32], {rot: [36, 0, 0], taper: 0.15, vr: hv});                                // 10
  g.box(P.testa, F, hc, [0, -0.05, 0.25], [0.15, 0.17, 0.5], {rot: [50, 0, 0], taper: 0.35, noBack: true, vr: hv});                       // 8
  g.tri([0.02, 0.56, 0.25], [0.015, 0.36, 0.38], [0.02, 0.36, 0.1], P.cuello, F, 0, V.CRIN); g.tri([-0.02, 0.56, 0.25], [-0.02, 0.36, 0.1], [-0.015, 0.36, 0.38], P.cuello, F, 0, V.CRIN);
  [['manoIz', 'canaIz', 0], ['manoDe', 'canaDe', 1], ['pataIz', 'corvIz', 2], ['pataDe', 'corvDe', 3]].forEach(([u, l, i]) => {
    const hind = i > 1; g.cyl(P[u], F, hc, [0, hind ? -0.18 : -0.2, 0], 0.05 * K.pata, hind ? 0.12 * K.pata : 0.08 * K.pata, hind ? 0.56 : 0.46, 3, {vr: hv});   // 6
    g.cyl(P[l], F, hc, [0, hind ? -0.3 : -0.28, 0], 0, 0.045, hind ? 0.62 : 0.58, 3, {vr: V.CALC + i}); });                                // 3 (cono)
  g.cyl(P.cola, F, 0, [0, -0.35, -0.1], 0.0, 0.06, 0.7, 3, {rot: [-14, 0, 0], vr: V.CRIN + 0.5});                                          // 3
  g.box(P.silla, Z.TRIM, 0, [0, -0.12, 0], [0.6, 0.28, 0.7], {noTop: true});                                                              // 8
  if (jin) {
    [1, -1].forEach(s => g.tube(P.silla, Z.ACC, 0, [0.1 * s, 0.08, 0], [0.27 * s, -0.58, 0.12], [[0, 0.07], [1, 0.05]], 3));                     // 12
    const alto = /colback|papaja|czapka|chaco|casco/.test(o.toc || ''), pielT = o.toc === 'colback' || o.toc === 'papaja';
    g.box(P.torso, Z.MAIN, 0, [0, 0.24, 0], [0.32, 0.5, 0.22], {taper: 0.15, noTop: true});                                                // 8
    g.box(P.cabeza, F, C.piel, [0, 0.12, 0.01], [0.15, 0.2, 0.18], {vr: V.SKIN, noTop: true, noBack: true});                                 // 6
    g.box(P.cabeza, pielT ? F : Z.HAT, o.toc === 'colback' ? C.pielO : o.toc === 'papaja' ? C.pielG : 0, [0, alto ? 0.32 : 0.26, 0], [0.2, alto ? 0.17 : 0.08, 0.22], {taper: o.toc === 'czapka' ? -0.4 : 0.1});   // 10
    ['brazoIz', 'brazoDe'].forEach(k => g.cyl(P[k], Z.MAIN, 0, [0, -0.14, 0], 0.05, 0.055, 0.3, 3));                                         // 12
    ['antebrazoIz', 'antebrazoDe'].forEach(k => g.cyl(P[k], Z.MAIN, 0, [0, -0.13, 0], 0, 0.045, 0.3, 3, {}));                               // 6
    if (J.arma === 'lanza') { g.cyl(P.arma, F, C.madera, [0, 0.45, 0], 0.02, 0.02, 2.9, 3); if (o.era <= 'C') g.quad([0, 1.8, 0], [0, 1.8, 0.34], [0, 1.66, 0.34], [0, 1.66, 0], P.arma, Z.F1, C.blanco); }
    else if (J.arma !== 'ninguna') g.box(P.arma, F, C.hoja, [0, 0.45, 0.01], [0.01, 0.9, 0.035], {noTop: true});                            // 6–8
  }
  return g;
}

/* ---------- catálogo ---------- */
function opciones(tipo, era, nat) {
  const J = JINETES[tipo], e = J.eras.includes(era) ? era : J.eras.reduce((a, b) => Math.abs(ERAS.indexOf(b) - ERAS.indexOf(era)) < Math.abs(ERAS.indexOf(a) - ERAS.indexOf(era)) ? b : a);
  return {tipo, era: e, nat, cuerpo: J.cuerpo, silla: J.silla, toc: J.toc(e, nat), oficial: !!J.oficial, general: !!J.general, crin: J.silla === 'cosaca' ? 'larga' : null,
    flagLayout: (T3.NACIONES[nat] || T3.NACIONES.GEN).bandera, modelo: `cab_${tipo}_${nat}_${e}`};
}
const TIPOS = {};
Object.keys(JINETES).forEach(t => { const J = JINETES[t];
  TIPOS['cab_' + t] = {rig: 'jinete', clase: 'cav', pal: J.pal, nombre: J.nombre, eras: J.eras.slice(), dobleCara: !!J.dobleCara,
    o: (era, nat) => opciones(t, era, nat || 'GEN'), build: o => { const g = new GB(); caballo(g, o); arreos(g, o); jinete(g, o); return g; }, lod: (o, l) => lod(o, l)}; });
// caballo ensillado del mismo tipo, sin jinete (mismo paño y misma paleta: para el relevo del grupo al caer el jinete)
Object.keys(JINETES).forEach(t => { const J = JINETES[t];
  TIPOS['cab_' + t + '_sin_jinete'] = {rig: 'jinete', clase: 'cav', pal: J.pal, nombre: `Caballo de ${J.nombre.toLowerCase()} sin jinete`, eras: J.eras.slice(),
    o: (era, nat) => Object.assign(opciones(t, era, nat || 'GEN'), {tipo: null, tipoSilla: t, modelo: `cabsj_${t}_${nat}_${era}`}),
    build: o => { const g = new GB(); caballo(g, o); arreos(g, o); return g; }, lod: (o, l) => lod(o, l)}; });
['ligero', 'medio', 'pesado'].forEach(c => {
  TIPOS['cab_caballo_' + c] = {rig: 'jinete', clase: 'cav', pal: 'caballeria', nombre: `Caballo ${c} ensillado sin jinete`, eras: ERAS.slice(),
    o: (era, nat) => ({era, nat: nat || 'GEN', cuerpo: c, silla: c === 'ligero' ? 'hungara' : 'dragon', modelo: `cab_caballo_${c}_${era}`}),
    build: o => { const g = new GB(); caballo(g, o); arreos(g, o); return g; }, lod: (o, l) => lod(o, l)}; });
// jinetes desmontados (rig soldado, con la variación de infanteria3d por el prefijo inf_)
Object.keys(JINETES).forEach(t => { const J = JINETES[t];
  TIPOS['inf_cab_' + t] = {rig: 'soldado', clase: 'inf', pal: J.pal, nombre: J.nombre + ' a pie', eras: J.eras.slice(),
    o: (era, nat) => { nat = nat || 'GEN'; const c = opciones(t, era, nat), base = INF.opciones(J.oficial ? 'teniente' : 'soldado', c.era, nat);
      const toc = TOCADOS[c.toc] ? null : c.toc;
      return Object.assign(base, {toc, tocCab: TOCADOS[c.toc] ? c.toc : null, rango: 'cab_' + t, mod: Object.assign({}, base.mod, {pierna: 'botas', mochila: 'no', rollo: 'ninguno', abrigo: J.cherkeska ? 'capote' : base.mod.abrigo === 'capote' ? 'guerrera' : base.mod.abrigo, cor: null}),
        arma: J.pie || J.carabina && J.carabina(c.era) ? 'carabina' : J.arma === 'lanza' ? 'sable' : J.arma === 'ninguna' ? 'ninguna' : 'sable', bayoneta: false, modelo: `infcab_${t}_${nat}_${c.era}`, oficial: !!J.oficial, nidos: false, galones: 0}); },
    build: o => { const g = INF.soldado(o); if (o.tocCab) TOCADOS[o.tocCab](g, INF.P.cabeza, o); return g; }, lod: (o, l) => INF.lod(Object.assign({}, o, {toc: o.toc || 'kepi'}), l)}; });

return {TIPOS, opciones, caballo, arreos, jinete, lod, TOCADOS, P};
}

/* ===================================================================================== */
/* VARIACIÓN POR INSTANCIA DEL CABALLO Y DEL JINETE
   iCab = (marcas: bits 0–3 calcetines MI·MD·PI·PD, bit 4 lucero · crin: 0 según el pelaje, 1 negra, 2 lavada, 3 gris ·
           aire 0–1 (lo pone setClip según el clip; mueve crin y cola) · vello + 4·pelo del jinete)
   El pelaje sigue siendo el de troops3d (iLook.z: 0 castaño, 1 alazán, 2 negro, 3 tordo); el tordo lleva moteado. */
const CRINES = [0x141010, 0xd8c8a0, 0x9a948a];
const PELOS = [0x2a1e14, 0x5a3e24, 0x8a6a3a, 0x8a8478];
function prepararLote(lote) {
  if (!lote || lote._iCab) return lote; const cap = lote.cap || lote.mesh.instanceMatrix.count, geo = lote.mesh.geometry;
  lote._iCab = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4); lote._iCab.setUsage(THREE.DynamicDrawUsage); geo.setAttribute('iCab', lote._iCab);
  const mat = lote.mesh.material, prev = mat.onBeforeCompile, key = mat.customProgramCacheKey ? mat.customProgramCacheKey() : '';
  mat.onBeforeCompile = function (sh, r) {
    if (prev) prev.call(this, sh, r);
    sh.uniforms.uCrin = {value: CRINES.map(h => new THREE.Color(h))}; sh.uniforms.uPeloJ = {value: PELOS.map(h => new THREE.Color(h))};
    sh.vertexShader = sh.vertexShader.replace('attribute vec4 iLook;', 'attribute vec4 iLook; attribute vec4 iCab; uniform vec3 uCrin[3]; uniform vec3 uPeloJ[4];\nfloat hc13(vec3 p){ p = fract(p * 0.3183 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }\nfloat bitC(float v, float b){ return mod(floor(v / exp2(b)), 2.0); }')
      .replace('vec3 pos0 = position;', `vec3 pos0 = position;
{ float vb = mod(iCab.w, 4.0);                                                // vello del jinete (como infanteria3d): 4 bigote, 5 patillas, 3 barba
  bool oculto = (aVar > 3.5 && aVar < 4.5 && vb < 0.5) || (aVar > 4.5 && aVar < 5.5 && vb < 1.5) || (aVar > 2.5 && aVar < 3.5 && vb < 2.5);
  if (oculto) pos0 = vec3(0.0, 0.2, 0.0);
  if (aVar > 11.95 && aVar < 12.95) {                                          // crin, tupé y cola: ondulación según el aire
    float w = clamp((aVar - 12.0) / 0.9, 0.0, 1.0), sp = iCab.z, ph = iAnimA.w * 6.2831 + iLook.x * 31.0;
    pos0.x += sin(uTime * (3.0 + 9.0 * sp) + position.z * 9.0 + position.y * 6.0 + ph) * w * (0.012 + 0.05 * sp);
    pos0.z -= w * sp * 0.04 * (1.0 + 0.5 * sin(uTime * 11.0 + ph)); } }`)
      .replace('vColor = zc * (', `{ float co = iLook.z;
  vec3 crin = iCab.y > 0.5 ? uCrin[int(clamp(iCab.y - 1.0, 0.0, 2.0))] : (co < 0.5 || co > 1.5 && co < 2.5 ? uCrin[0] : co < 1.5 ? zc * 0.82 : uCrin[2]);
  if (aVar > 6.5 && aVar < 10.5 && bitC(iCab.x, floor(aVar - 7.0 + 0.5)) > 0.5) zc = vec3(0.86, 0.84, 0.8);   // calcetín
  if (aVar > 10.5 && aVar < 11.5 && bitC(iCab.x, 4.0) > 0.5) zc = vec3(0.88, 0.86, 0.82);                    // lucero
  if (aVar > 11.95 && aVar < 12.95) zc = crin;
  if (aVar > 12.95 && aVar < 13.5) zc = vec3(0.17, 0.14, 0.12);                                                // casco
  if (aVar > 1.5 && aVar < 2.5 && co > 2.5) zc *= 0.86 + 0.18 * step(0.55, hc13(floor(position * 11.0) + iLook.x));   // moteado del tordo
  if (aVar > 2.5 && aVar < 6.5) zc = uPeloJ[int(clamp(floor(iCab.w / 4.0), 0.0, 3.0))]; }
vColor = zc * (`);
  };
  mat.customProgramCacheKey = () => key + '|cab3d';
  mat.needsUpdate = true; return lote;
}
function marcar(lote, i, v) { prepararLote(lote); v = v || {}; const a = lote._iCab; a.setXYZW(i, v.marcas || 0, v.crin || 0, a.getZ(i), (v.barba || 0) + 4 * (v.pelo || 0)); a.needsUpdate = true; }
function aireDe(lote, i, sp) { prepararLote(lote); lote._iCab.setZ(i, sp); lote._iCab.needsUpdate = true; }
// sorteo: la mitad sin marcas, un tercio con lucero, calcetines más frecuentes atrás (estadística orientativa de remontas)
function marcasAleatorias(rnd) { rnd = rnd || Math.random; let m = 0; if (rnd() < 0.5) { [0.15, 0.15, 0.3, 0.3].forEach((p, b) => { if (rnd() < p) m |= 1 << b; }); if (rnd() < 0.6) m |= 16; }
  return {marcas: m, crin: 0, barba: Math.floor(rnd() * 4), pelo: Math.floor(rnd() * 4)}; }

/* ===================================================================================== */
/* ANIMACIONES DEL JINETE (CLIPS.jinete; grados Euler XYZ; raíz en m).
   Caballo: caballo rx > 0 = morro abajo, rz = inclinación lateral; cuello/testa rx > 0 = bajar; patas rx < 0 = adelante; caña delantera rx > 0 =
   flexión de la rodilla (casco atrás); caña trasera rx < 0 = flexión del corvejón; cola rx > 0 = levantarla atrás.
   Las patas se resuelven por cinemática inversa de dos segmentos en el plano sagital: el casco de apoyo queda clavado en el suelo mientras el
   cuerpo avanza (con un deslizamiento controlado en los aires rápidos, porque el pivote del rig está en el codo y no en la escápula) y el de
   vuelo sigue un arco. La altura de la raíz se calcula para que todas las patas de apoyo alcancen el suelo.
   Jinete: torso rx > 0 = inclinarse; brazos como el soldado; el arma cuelga del antebrazo derecho: su giro se da como ángulo de la hoja en el
   plano sagital del mundo (0 = arriba, 90 = al frente, 180 = abajo) y se convierte restando el giro acumulado de brazo y antebrazo. */
const PATAS = {MI: {up: 'manoIz', low: 'canaIz', piv: [0.16, -0.12, 0.5], a: 0.42, b: 0.575, del: true}, MD: {up: 'manoDe', low: 'canaDe', piv: [-0.16, -0.12, 0.5], a: 0.42, b: 0.575, del: true},
  PI: {up: 'pataIz', low: 'corvIz', piv: [0.17, -0.06, -0.52], a: 0.44, b: 0.615, del: false}, PD: {up: 'pataDe', low: 'corvDe', piv: [-0.17, -0.06, -0.52], a: 0.44, b: 0.615, del: false}};
const CAB_Y = 1.12;
// ik2(dz, dy, a, b, delantera) → [ángulo superior, inferior] (grados, convenio del rig)
function ik2(dz, dy, a, b, del) {
  let d = Math.hypot(dz, dy); d = Math.min(a + b - 1e-4, Math.max(Math.abs(a - b) + 1e-3, d));
  const phi = Math.atan2(dz, -dy), al = Math.acos(Math.min(1, Math.max(-1, (a * a + d * d - b * b) / (2 * a * d)))), be = Math.acos(Math.min(1, Math.max(-1, (a * a + b * b - d * d) / (2 * a * b))));
  return del ? [-(phi + al) / D2R, (Math.PI - be) / D2R] : [-(phi - al) / D2R, -(Math.PI - be) / D2R];
}
const rotX = (p, deg) => { const c = Math.cos(deg * D2R), s = Math.sin(deg * D2R); return [p[0], p[1] * c - p[2] * s, p[1] * s + p[2] * c]; };
const rotZ = (p, deg) => { const c = Math.cos(deg * D2R), s = Math.sin(deg * D2R); return [p[0] * c - p[1] * s, p[0] * s + p[1] * c, p[2]]; };
const cuerpoRot = (p, B) => rotX(rotZ(p, B.roll || 0), B.pitch || 0), cuerpoInv = (p, B) => rotZ(rotX(p, -(B.pitch || 0)), -(B.roll || 0));
/* resolverPatas(clip, N, cuerpo, casco, op)
   cuerpo(t) → {z: avance de la raíz, y: altura (null = automática), pitch: cabeceo (°), apoyo: {MI: bool…}, alto: margen sobre el suelo en vuelo}
   casco(pata, t) → [z, y] del casco en el mundo (relativo al origen del clip) */
function resolverPatas(clip, N, cuerpo, casco, op) {
  op = op || {}; const tr = {}, root = []; Object.values(PATAS).forEach(L => { tr[L.up] = []; tr[L.low] = []; }); const pitchTr = [];
  let yPrev = 0;
  for (let i = 0; i <= N; i++) { const t = i / N, B = cuerpo(t); let y = B.y;
    if (y == null) {                                                         // altura automática: la más alta que deja llegar a todas las patas de apoyo
      y = op.base != null ? op.base : 0;
      Object.entries(PATAS).forEach(([k, L]) => { if (!B.apoyo || !B.apoyo[k]) return; const c = casco(k, t), pv = cuerpoRot(L.piv, B), dz = (B.z + pv[2]) - c[0], R = (L.a + L.b) * (op.alcance || 0.985);
        const ymax = c[1] + 0.02 + Math.sqrt(Math.max(0, R * R - dz * dz)) * Math.cos((B.roll || 0) * D2R) - (CAB_Y + pv[1]); y = Math.min(y, ymax); });
      if (B.vuelo != null) y = Math.max(y, B.vuelo);
    }
    yPrev = y; root.push([t, 0, y, B.z]); pitchTr.push([t, B.pitch || 0, 0, B.roll || 0]);
    Object.entries(PATAS).forEach(([k, L]) => { const c = casco(k, t), pv = cuerpoRot(L.piv, B), px = [pv[0], CAB_Y + y + pv[1], B.z + pv[2]], cx = L.piv[0];
      // con inclinación lateral (giros) la pata se contrarrota (rz) para seguir vertical y la IK se hace en el plano vertical
      let w = rotX([0, c[1] - px[1], c[0] - px[2]], -(B.pitch || 0)), ang = ik2(w[2], w[1], L.a, L.b, L.del);
      const abs = (ang[0] + ang[1] + (B.pitch || 0)) * D2R, lev = 0.075 * Math.abs(Math.sin(abs));                   // casco inclinado: sube lo que baja la lumbre o el talón
      if (lev > 1e-4) { w = rotX([0, c[1] + lev - px[1], c[0] - px[2]], -(B.pitch || 0)); ang = ik2(w[2], w[1], L.a, L.b, L.del); }
      tr[L.up].push([t, ang[0], 0, -(B.roll || 0)]); tr[L.low].push([t, ang[1], 0, 0]); });
  }
  Object.assign(clip.tracks, tr); clip.tracks.caballo = pitchTr; clip.root = root; return clip;
}
// aires: fase de contacto de cada casco, apoyo (fracción del ciclo), velocidad (m/s), periodo (s), agarre (fracción del avance que hace el casco clavado),
// altura del arco de vuelo delantero/trasero, elevación en la suspensión, cabeceo, cuello. Muybridge (1887) y Clayton (2004), redondeado.
const AIRES = {
  paso: {pf: 2, T: 1.1, v: 1.7, d: 0.62, f: {PI: 0, MI: 0.25, PD: 0.5, MD: 0.75}, ag: 1.0, hf: 0.13, hh: 0.1, sus: 0, pitch: 1.0, cuello: [5, 2], cola: 6},
  trote: {pf: 2, T: 0.72, v: 3.6, d: 0.42, f: {MI: 0, PD: 0, MD: 0.5, PI: 0.5}, ag: 0.85, hf: 0.24, hh: 0.18, sus: 0.045, pitch: 1.2, cuello: [1.5, 2], cola: 18},
  galope: {pf: 1, T: 0.62, v: 5.5, d: 0.36, f: {PI: 0, PD: 0.14, MI: 0.14, MD: 0.36}, ag: 0.72, hf: 0.3, hh: 0.22, sus: 0.07, pitch: 4.5, cuello: [7, 1], cola: 28},
  galope_carga: {pf: 1, T: 0.5, v: 9.0, d: 0.27, f: {PI: 0, PD: 0.1, MI: 0.3, MD: 0.4}, ag: 0.6, hf: 0.36, hh: 0.26, sus: 0.13, pitch: 5.5, cuello: [9, 1], cola: 40},
  atras: {pf: 2, T: 1.4, v: -0.75, d: 0.6, f: {MI: 0, PD: 0, MD: 0.5, PI: 0.5}, ag: 1.0, hf: 0.1, hh: 0.09, sus: 0, pitch: -1.5, cuello: [3, 2], cola: 4}
};
const enApoyo = (A, k, t) => { const s = (((t - A.f[k]) % 1) + 1) % 1; return s < A.d; };
// casco de un aire en bucle (marco del cuerpo: el cuerpo no avanza; el casco de apoyo retrocede a v·agarre)
function cascoAire(A, k, t, o) {
  o = o || {}; const L = PATAS[k], s = (((t - A.f[k]) % 1) + 1) % 1, st = A.v * A.T * A.d * A.ag * (o.paso || 1), z0 = L.piv[2] + (L.del ? 0.03 : -0.03) + (o.dz || 0);
  if (s < A.d) { const u = s / A.d; return [z0 + st / 2 - st * u, 0]; }
  const u = (s - A.d) / (1 - A.d), e = u * u * (3 - 2 * u), h = (L.del ? A.hf : A.hh) * (o.alto || 1);
  return [z0 - st / 2 + st * e + (L.del ? 0.06 : 0.02) * Math.sin(Math.PI * u) * Math.sign(A.v || 1), h * Math.pow(Math.sin(Math.PI * Math.min(1, u * 1.08)), 0.9)];
}
// ciclo de un aire: patas, cuerpo, cuello, cabeza y cola; el jinete se añade aparte
function cicloAire(nombre, ciclos, o) {
  o = o || {}; const A = AIRES[nombre], n = ciclos || 1, N = Math.round(40 * n), clip = {dur: A.T * n, loop: !o.unaVez, tracks: {}, ev: []};
  const apoyo = t => { const r = {}; Object.keys(PATAS).forEach(k => { r[k] = enApoyo(A, k, t * n); }); return r; };
  const ninguno = t => !Object.values(apoyo(t)).some(Boolean);
  // suspensión: interpola entre la altura al despegar y al aterrizar con un arco
  resolverPatas(clip, N, t => { const ap = apoyo(t), u = (t * n) % 1;
      return {z: o.avanza ? A.v * A.T * n * t : 0, pitch: (o.pitch || 0) + A.pitch * Math.sin(2 * Math.PI * A.pf * (u - 0.15)), roll: o.roll || 0, apoyo: ap, vuelo: null}; },
    (k, t) => { const c = cascoAire(A, k, t * n, o); return [c[0] + (o.avanza ? A.v * A.T * n * t : 0), c[1]]; }, {base: o.base || 0});
  // la altura en suspensión: tramos sin apoyo interpolados con arco (el resolvedor deja y = base allí)
  const R = clip.root, air = R.map(r => ninguno(r[0]));
  for (let i = 0; i < R.length; i++) if (air[i]) { let a = i, b = i; while (a > 0 && air[a]) a--; while (b < R.length - 1 && air[b]) b++;
    const u = (i - a) / Math.max(1, b - a); R[i][2] = R[a][2] + (R[b][2] - R[a][2]) * u + A.sus * 4 * u * (1 - u); }
  // con la altura nueva, re-resolver las patas en el aire (siguen su arco)
  const yAt = t => { const k = Math.min(R.length - 1, Math.round(t * N)); return R[k][2]; };
  resolverPatas(clip, N, t => { const u = (t * n) % 1; return {z: o.avanza ? A.v * A.T * n * t : 0, y: yAt(t), roll: o.roll || 0, pitch: (o.pitch || 0) + A.pitch * Math.sin(2 * Math.PI * A.pf * (u - 0.15))}; },
    (k, t) => { const c = cascoAire(A, k, t * n, o); return [c[0] + (o.avanza ? A.v * A.T * n * t : 0), c[1]]; });
  // cuello y cabeza: cabeceo (2 veces por ciclo al paso; 1 al galope), cola con inercia
  const [ca, fr] = A.cuello, cb = o.cuello || 0;
  clip.tracks.cuello = curva(N, t => [cb + ca * Math.sin(2 * Math.PI * fr * t * n + 0.6), (o.giro || 0) * 0.4, 0]);
  clip.tracks.testa = curva(N, t => [(o.testa || 0) - ca * 0.5 * Math.sin(2 * Math.PI * fr * t * n + 0.2), (o.giro || 0) * 0.3, 0]);
  clip.tracks.cola = curva(N, t => [A.cola + (o.cola || 0) + 6 * Math.sin(2 * Math.PI * t * n - 1.2), 0, 5 * Math.sin(2 * Math.PI * t * n * 0.5)]);
  Object.keys(PATAS).forEach(k => { const t0 = A.f[k]; for (let c = 0; c < n; c++) clip.ev.push([((t0 + c) / n) % 1, 'casco']); });
  clip.ev.sort((a, b) => a[0] - b[0]);
  clip.meta = {avance: o.avanza ? 0 : A.v * A.T * n, aire: nombre, ciclos: n, suspension: A.sus > 0, apoyo};
  return clip;
}
function curva(N, fn) { const tr = []; for (let i = 0; i <= N; i++) { const t = i / N, v = fn(t); tr.push([t, v[0] || 0, v[1] || 0, v[2] || 0]); } return tr; }

/* ---------- el jinete: riendas, asiento y armas ----------
   hoja(brazo, antebrazo, ángulo de la hoja en el mundo) → giro rx del arma */
const hoja = (b, a, th) => th - (b + a);
const RIENDAS = {brazoIz: [-24, 0, 8], antebrazoIz: [-62, 0, -6]};
const PORTE = {   // porte del arma derecha: [brazoDe, antebrazoDe, ángulo de la hoja]
  sable_hombro: [[-18, 0, -8], [-96, 0, 0], -22],                         // sable desenvainado «al hombro» (marcha)
  sable_alto: [[-150, 0, -30], [-45, 0, 0], -55],                         // alzado para el tajo (molinete)
  sable_tajo: [[-40, 0, -58], [-12, 0, 0], 150],                          // final del tajo, hacia abajo y adelante
  sable_frente: [[-82, 0, -6], [-8, 0, 0], 92],                           // «en avant»: brazo y punta al frente (carga a la francesa)
  sable_bajo: [[-48, 0, -10], [-30, 0, 0], 112],                          // persecución: punta baja al frente
  sable_parada: [[-120, 0, -30], [-60, 0, 0], -88],                       // parada alta (hoja horizontal sobre la cabeza, aprox.)
  sable_saludo: [[-70, 0, -12], [-118, 0, 0], -4],                        // empuñadura a la barbilla, hoja vertical
  lanza_alta: [[-10, 0, -10], [-60, 0, 0], 0],                            // lanza en la cuja, vertical
  lanza_ristre: [[-8, 0, -14], [-82, 0, 0], 95],                          // en ristre bajo el brazo
  lanza_baja: [[-20, 0, -12], [-70, 0, 0], 120],                          // punta baja tras el impacto
  nada: [[-12, 0, -8], [-55, 0, 0], 70]                                   // mano en el muslo (mensajero)
};
function jineteTracks(clip, N, porte, o) {
  o = o || {}; const T = clip.tracks, P0 = typeof porte === 'function' ? porte : () => PORTE[porte];
  T.brazoIz = curva(N, t => RIENDAS.brazoIz.map((v, i) => v + (o.riendas ? o.riendas(t)[i] || 0 : 0)));
  T.antebrazoIz = curva(N, t => RIENDAS.antebrazoIz.map((v, i) => v + (o.riendas2 ? o.riendas2(t)[i] || 0 : 0)));
  T.brazoDe = curva(N, t => P0(t)[0]); T.antebrazoDe = curva(N, t => P0(t)[1]);
  const cab = T.caballo || [[0, 0, 0, 0]];
  T.torso = curva(N, t => { const pc = muestreo(cab, t, 1); return [(o.inc || 4) - pc * 0.7 + (o.torso ? o.torso(t)[0] || 0 : 0), o.torso ? o.torso(t)[1] || 0 : 0, -muestreo(cab, t, 3) * 0.6 + (o.torso ? o.torso(t)[2] || 0 : 0)]; });
  // el ángulo de la hoja es en el mundo: se descuentan brazo, antebrazo, inclinación del torso y cabeceo del caballo
  T.arma = curva(N, t => { const p = P0(t), tx = muestreo(T.torso, t, 1), pc = muestreo(cab, t, 1); return [hoja(p[0][0] + tx + pc, p[1][0], p[2]), 0, 0]; });
  T.cabeza = curva(N, t => { const tt = T.torso[Math.min(T.torso.length - 1, Math.round(t * N))]; return [-(tt[1] - (o.inc || 4)) * 0.6 + (o.cabeza ? o.cabeza(t)[0] || 0 : 0), o.cabeza ? o.cabeza(t)[1] || 0 : 0, 0]; });
  if (o.levantado) clip.pos = Object.assign(clip.pos || {}, {torso: curva(N, t => [0, 0.07 * Math.max(0, Math.sin(2 * Math.PI * (t * o.levantado) * 1)) , 0.03 * Math.max(0, Math.sin(2 * Math.PI * t * o.levantado))])});
  else if (o.amortigua) clip.pos = Object.assign(clip.pos || {}, {torso: curva(N, t => [0, -o.amortigua * Math.max(0, Math.cos(2 * Math.PI * t * (o.ciclos || 1) * (o.frec || 2))), 0])});
  return clip;
}
// interpolación de un porte a otro (para los clips de combate): claves [[t, 'porte']]
function porteKeys(keys) { return t => { let a = keys[0], b = keys[keys.length - 1]; for (let i = 0; i < keys.length - 1; i++) if (t >= keys[i][0] && t <= keys[i + 1][0]) { a = keys[i]; b = keys[i + 1]; break; }
  const u = b[0] > a[0] ? Math.min(1, Math.max(0, (t - a[0]) / (b[0] - a[0]))) : 0, e = u * u * (3 - 2 * u), A = PORTE[a[1]], B = PORTE[b[1]];
  return [A[0].map((v, i) => v + (B[0][i] - v) * e), A[1].map((v, i) => v + (B[1][i] - v) * e), A[2] + (B[2] - A[2]) * e]; }; }
function muestreo(tr, t, k) { if (!tr || !tr.length) return 0; if (tr.length === 1 || t <= tr[0][0]) return tr[0][k]; for (let i = 0; i < tr.length - 1; i++) if (t <= tr[i + 1][0]) { const a = tr[i], b = tr[i + 1], u = (t - a[0]) / Math.max(1e-6, b[0] - a[0]); return a[k] + (b[k] - a[k]) * u; } return tr[tr.length - 1][k]; }

const CLIPS = {}, META = {}, CLIPS_S = {}, META_S = {};
function defJ(n, c, m) { const meta = Object.assign({suelo: 'pie', avance: 0, desplazamiento: [0, 0, 0], armaCompatible: ['A', 'B', 'C', 'D', 'E'], transiciones: []}, c.meta || {}, m || {}); delete c.meta;
  delete meta.apoyo; c.ev.sort((a, b) => a[0] - b[0]); meta.eventos = c.ev.map(e => e[1]); CLIPS[n] = c; META[n] = meta; }

/* ---------- pisadas explícitas (rampa, salto, caída): cada pata con sus apoyos [t0, t1, z del casco]; entre apoyos, arco de altura h ---------- */
function cascoPisadas(pl, h, t, tuck) {
  for (let i = 0; i < pl.length; i++) { const [a, b, z] = pl[i]; if (t >= a && t <= b) return [z, 0]; }
  let prev = null, next = null; pl.forEach(p => { if (p[1] < t && (!prev || p[1] > prev[1])) prev = p; if (p[0] > t && (!next || p[0] < next[0])) next = p; });
  if (!prev) return [next[2], 0]; if (!next) return [prev[2], 0];
  const u = (t - prev[1]) / Math.max(1e-6, next[0] - prev[1]), e = u * u * (3 - 2 * u), arc = [prev[2] + (next[2] - prev[2]) * e, h * Math.sin(Math.PI * u)];
  if (tuck) { const w = tuck.w(t); if (w > 0) { const q = tuck.p(t); return [arc[0] + (q[0] - arc[0]) * w, arc[1] + (q[1] - arc[1]) * w]; } }
  return arc;
}
const enPisada = (pl, t) => pl.some(p => t >= p[0] && t <= p[1]);
const sstep = (a, b, t) => { const u = Math.min(1, Math.max(0, (t - a) / (b - a))); return u * u * (3 - 2 * u); };
const lerpK = (keys, t) => { let a = keys[0], b = keys[keys.length - 1]; for (let i = 0; i < keys.length - 1; i++) if (t >= keys[i][0] && t <= keys[i + 1][0]) { a = keys[i]; b = keys[i + 1]; break; }
  const u = b[0] > a[0] ? sstep(a[0], b[0], t) : 0; return a.slice(1).map((v, i) => v + (b[i + 1] - v) * u); };

/* ===================================================================================== */
/* CLIPS DEL JINETE */
const PORTES = {'': {porte: 'sable_hombro', arma: ['sable_curvo', 'sable_recto', 'shashka', 'ninguna']}, _lanza: {porte: 'lanza_alta', arma: ['lanza']}};
Object.entries(PORTES).forEach(([suf, P0]) => {
  // parado: respiración, cabeceo, cola que espanta moscas y una pata trasera en descanso
  { const N = 80, c = {dur: 6, loop: true, tracks: {}, ev: [[0.3, 'resopla'], [0.72, 'cola']]};
    resolverPatas(c, N, t => ({z: 0, pitch: 0.4 * Math.sin(2 * Math.PI * t * 2), apoyo: {MI: true, MD: true, PI: t < 0.4 || t > 0.9, PD: true}}),
      (k, t) => { const L = PATAS[k]; if (k === 'PI') { const w = sstep(0.4, 0.48, t) * (1 - sstep(0.82, 0.9, t)); return [L.piv[2] + 0.06 * w, 0.025 * w]; } return [L.piv[2] + (L.del ? 0.02 : -0.02), 0]; });
    c.tracks.cuello = curva(N, t => [10 * sstep(0.2, 0.35, t) * (1 - sstep(0.55, 0.7, t)) + 2 * Math.sin(2 * Math.PI * t * 2), 12 * Math.sin(2 * Math.PI * t), 0]);
    c.tracks.testa = curva(N, t => [4 * Math.sin(2 * Math.PI * t * 3), 6 * Math.sin(2 * Math.PI * (t + 0.2)), 8 * Math.sin(2 * Math.PI * t * 7) * sstep(0.28, 0.3, t) * (1 - sstep(0.33, 0.36, t))]);
    c.tracks.cola = curva(N, t => [8, 0, 26 * Math.sin(2 * Math.PI * (t - 0.72) * 6) * sstep(0.68, 0.72, t) * (1 - sstep(0.82, 0.9, t))]);
    jineteTracks(c, N, P0.porte, {inc: 2, cabeza: t => [0, 18 * Math.sin(2 * Math.PI * t), 0]});
    defJ('cab_parado' + suf, c, {armaJinete: P0.arma, transiciones: ['cab_paso' + suf, 'cab_retroceso' + suf, suf ? 'cab_parado' : 'cab_oficial_senalar']}); }
  // paso, trote (sentado y levantado), galope y galope de carga
  { const c = cicloAire('paso', 2); jineteTracks(c, 80, P0.porte, {inc: 2, amortigua: 0.01, ciclos: 2, frec: 2}); defJ('cab_paso' + suf, c, {armaJinete: P0.arma, transiciones: ['cab_parado' + suf, 'cab_trote' + suf, 'cab_retroceso' + suf]}); }
  { const c = cicloAire('trote', 2); jineteTracks(c, 80, P0.porte, {inc: 4, amortigua: 0.03, ciclos: 2, frec: 2}); defJ('cab_trote' + suf, c, {armaJinete: P0.arma, transiciones: ['cab_paso' + suf, 'cab_galope' + suf, 'cab_trote_levantado' + suf]}); }
  { const c = cicloAire('trote', 2); jineteTracks(c, 80, P0.porte, {inc: 8, levantado: 2}); c.ev.push([0, 'levanta'], [0.5, 'levanta']); defJ('cab_trote_levantado' + suf, c, {armaJinete: P0.arma, transiciones: ['cab_trote' + suf, 'cab_paso' + suf]}); }
  { const c = cicloAire('galope', 2); jineteTracks(c, 80, P0.porte, {inc: 10, amortigua: 0.025, ciclos: 2, frec: 1}); defJ('cab_galope' + suf, c, {armaJinete: P0.arma, suelo: 'carrera', transiciones: ['cab_trote' + suf, 'cab_galope_carga' + suf, 'cab_giro_izq' + suf, 'cab_giro_der' + suf, 'cab_rampa' + suf, 'cab_salto' + suf]}); }
  { const c = cicloAire('galope_carga', 2, {cola: 8}); jineteTracks(c, 80, suf ? 'lanza_alta' : 'sable_frente', {inc: 20, amortigua: 0.03, ciclos: 2, frec: 1}); c.ev.push([0, 'grito']);
    defJ('cab_galope_carga' + suf, c, {armaJinete: P0.arma, suelo: 'carrera', transiciones: ['cab_galope' + suf, suf ? 'cab_lanza_ataque' : 'cab_sable_ataque', suf ? 'cab_galope_carga' : 'cab_golpe_jinete_a']}); }
  // giros cerrados al galope: el juego gira la instancia META.giro °/s; el clip inclina caballo y jinete hacia dentro y dobla el cuello
  [['izq', 1], ['der', -1]].forEach(([n, s]) => { const c = cicloAire('galope', 2, {roll: 12 * s, giro: 22 * s}); jineteTracks(c, 80, P0.porte, {inc: 10, torso: () => [0, 10 * s, 6 * s], cabeza: () => [0, 25 * s, 0]});
    defJ(`cab_giro_${n}${suf}`, c, {armaJinete: P0.arma, suelo: 'carrera', giro: 95 * s, transiciones: ['cab_galope' + suf]}); });
  // paso atrás (diagonal, a dos tiempos)
  { const c = cicloAire('atras', 1); jineteTracks(c, 40, P0.porte, {inc: -2, riendas: t => [10, 0, 0], riendas2: () => [-18, 0, 0]}); defJ('cab_retroceso' + suf, c, {armaJinete: P0.arma, transiciones: ['cab_parado' + suf]}); }
  // rampa: frenada en seco (los posteriores se meten bajo la masa y resbalan) y se encabrita
  { const N = 90, dur = 2.4, c = {dur, loop: false, tracks: {}, ev: [[0.14, 'frenazo'], [0.1, 'resbala'], [0.42, 'relincho'], [0.86, 'casco']]};
    const bz = t => 2.2 * (1 - Math.pow(1 - Math.min(1, t / 0.42), 2)), pitch = t => lerpK([[0, 2], [0.14, -6], [0.4, -8], [0.55, -42], [0.7, -40], [0.86, 2], [1, 0]], t)[0];
    const PL = {MI: [[0, 0.1, bz(0.05) + 0.62]], MD: [[0.04, 0.16, bz(0.1) + 0.6]], PI: [], PD: []}; PL.MI.push([0.86, 1, 2.2 + 0.52]); PL.MD.push([0.89, 1, 2.2 + 0.5]);
    const tuck = k => ({w: t => PATAS[k].del ? sstep(0.4, 0.5, t) * (1 - sstep(0.76, 0.86, t)) : 0, p: t => { const pv = rotX(PATAS[k].piv, pitch(t)); return [bz(t) + pv[2] + 0.28, CAB_Y + 0.3 + pv[1]]; }});
    const resbala = (k, t) => { const L = PATAS[k], z = bz(t) + L.piv[2] + 0.32 * sstep(0.08, 0.2, t) + (k === 'PD' ? 0.05 : 0); return t < 0.1 ? cascoAire(AIRES.galope, k, t * 4)[0] * 0 + [bz(t) + L.piv[2] - 0.05, 0][0] : z; };
    resolverPatas(c, N, t => ({z: bz(t), pitch: pitch(t), apoyo: {MI: enPisada(PL.MI, t), MD: enPisada(PL.MD, t), PI: true, PD: true}}),
      (k, t) => PATAS[k].del ? cascoPisadas(PL[k], 0.2, t, tuck(k)) : [resbala(k, t), 0], {base: 0.0});
    // durante el encabritado la raíz sube lo que pidan los posteriores (resolverPatas ya la limita); las manos pedalean
    c.tracks.cuello = curva(N, t => [lerpK([[0, 0], [0.14, -14], [0.5, 16], [0.7, 12], [0.86, -6], [1, 0]], t)[0], 8 * Math.sin(2 * Math.PI * t * 3) * sstep(0.45, 0.5, t) * (1 - sstep(0.75, 0.8, t)), 0]);
    c.tracks.testa = curva(N, t => [lerpK([[0, 0], [0.14, -10], [0.5, -20], [0.86, 0], [1, 0]], t)[0], 0, 0]);
    c.tracks.cola = curva(N, t => [lerpK([[0, 20], [0.4, 0], [0.55, -25], [0.86, 10], [1, 6]], t)[0], 0, 0]);
    jineteTracks(c, N, suf ? 'lanza_alta' : t => (t > 0.45 && t < 0.8 ? PORTE.sable_alto : PORTE.sable_hombro), {inc: 0, torso: t => [lerpK([[0, 6], [0.14, -14], [0.5, 30], [0.7, 28], [0.86, 0], [1, 2]], t)[0], 0, 0],
      riendas: t => [lerpK([[0, 0], [0.14, 14], [0.5, -10], [1, 0]], t)[0], 0, 0], riendas2: t => [lerpK([[0, 0], [0.14, -30], [0.5, -10], [1, 0]], t)[0], 0, 0]});
    defJ('cab_rampa' + suf, c, {armaJinete: P0.arma, desplazamiento: [0, 0, 2.2], transiciones: ['cab_parado' + suf]}); }
  // salto de un obstáculo de 1 m (seto o muro bajo) al galope: batida a 2,2 m, vuelo, recepción sobre la mano directora
  { const N = 120, dur = 1.6, v = 6.0, c = {dur, loop: false, tracks: {}, ev: [[0.3, 'batida'], [0.66, 'recepcion'], [0.71, 'casco'], [0.8, 'casco']]};
    const bz = t => v * dur * t, flight = t => sstep(0.36, 0.52, t) * (1 - sstep(0.52, 0.7, t)), pitch = t => lerpK([[0, 3], [0.26, 6], [0.36, -24], [0.5, -2], [0.62, 16], [0.72, 8], [0.85, 0], [1, 2]], t)[0];
    const pz = (k, t) => bz(t) + PATAS[k].piv[2];
    const PL = {MI: [[0, 0.09, pz('MI', 0.04)], [0.2, 0.29, pz('MI', 0.245)], [0.66, 0.78, pz('MI', 0.72)], [0.92, 1, pz('MI', 0.96)]], MD: [[0.04, 0.13, pz('MD', 0.08)], [0.23, 0.305, pz('MD', 0.265)], [0.7, 0.82, pz('MD', 0.76)], [0.95, 1, pz('MD', 0.98)]],
      PI: [[0.0, 0.05, pz('PI', 0.02) + 0.3], [0.28, 0.38, pz('PI', 0.33) + 0.25], [0.77, 0.9, pz('PI', 0.84) + 0.25]], PD: [[0.02, 0.07, pz('PD', 0.04) + 0.3], [0.3, 0.4, pz('PD', 0.35) + 0.25], [0.8, 0.93, pz('PD', 0.87) + 0.25]]};
    const tuck = k => ({w: t => PATAS[k].del ? sstep(0.32, 0.42, t) * (1 - sstep(0.56, 0.64, t)) : sstep(0.42, 0.5, t) * (1 - sstep(0.62, 0.74, t)),
      p: t => { const pv = rotX(PATAS[k].piv, pitch(t)), y = c.root ? 0 : 0; return [bz(t) + pv[2] + (PATAS[k].del ? 0.3 : -0.2), CAB_Y + yS(t) + pv[1] - (PATAS[k].del ? 0.38 : 0.45)]; }});
    const yS = t => 0.95 * Math.sin(Math.PI * sstep(0.34, 0.72, t)) * (t > 0.34 && t < 0.72 ? 1 : 0);
    resolverPatas(c, N, t => ({z: bz(t), pitch: pitch(t), apoyo: Object.fromEntries(Object.keys(PATAS).map(k => [k, enPisada(PL[k], t)])), vuelo: t > 0.38 && t < 0.66 ? yS(t) : null}),
      (k, t) => cascoPisadas(PL[k], PATAS[k].del ? 0.3 : 0.22, t, tuck(k)));
    c.tracks.cuello = curva(N, t => [lerpK([[0, 4], [0.3, -6], [0.4, 14], [0.6, 6], [0.7, -10], [0.85, 4], [1, 4]], t)[0], 0, 0]);
    c.tracks.testa = curva(N, t => [lerpK([[0, 0], [0.36, -8], [0.5, 10], [0.7, -6], [1, 0]], t)[0], 0, 0]);
    c.tracks.cola = curva(N, t => [lerpK([[0, 28], [0.36, 10], [0.5, 45], [0.66, 60], [0.8, 30], [1, 28]], t)[0], 0, 0]);
    jineteTracks(c, N, P0.porte, {inc: 0, torso: t => [lerpK([[0, 12], [0.3, 18], [0.4, 30], [0.55, 22], [0.66, 0], [0.75, 6], [1, 12]], t)[0], 0, 0], riendas: t => [lerpK([[0, 0], [0.36, -30], [0.6, -20], [0.7, 0], [1, 0]], t)[0], 0, 0]});
    defJ('cab_salto' + suf, c, {armaJinete: P0.arma, suelo: 'salto', desplazamiento: [0, 0, v * dur], obstaculo: {z: v * dur * 0.52, altura: 1.0, batida: 2.2}, transiciones: ['cab_galope' + suf]}); }
});

/* ---------- combate a caballo (un solo pase al galope de carga; 4 tiempos de galope = 2 s, 18 m) ---------- */
function cargaBase(n) { const c = cicloAire('galope_carga', n || 4, {unaVez: true, avanza: true, cola: 8}); return c; }
// carga con lanza: alta → ristre → impacto → soltar (la punta cae y se recupera) → alta
{ const c = cargaBase(4), N = 160, ti = 0.6; jineteTracks(c, N, porteKeys([[0, 'lanza_alta'], [0.22, 'lanza_alta'], [0.42, 'lanza_ristre'], [ti, 'lanza_ristre'], [ti + 0.06, 'lanza_baja'], [0.86, 'lanza_alta'], [1, 'lanza_alta']]),
    {inc: 0, torso: t => [16 + 10 * sstep(0.42, ti, t) * (1 - sstep(ti + 0.04, 0.8, t)), -8 * sstep(0.42, ti, t) * (1 - sstep(ti + 0.1, 0.86, t)), 0]});
  c.ev.push([0.42, 'ristre'], [ti, 'impacto'], [ti + 0.05, 'soltar'], [0, 'grito']);
  defJ('cab_lanza_ataque', c, {armaJinete: ['lanza'], suelo: 'carrera', pareja: {clip: 'cab_lanzado_d', desfase: null}, transiciones: ['cab_galope_carga_lanza', 'cab_galope_lanza']}); }
// carga con sable: alzar (molinete), tajo descendente al costado derecho, reponer al frente
{ const c = cargaBase(4), N = 160, ti = 0.56; jineteTracks(c, N, porteKeys([[0, 'sable_frente'], [0.3, 'sable_frente'], [0.46, 'sable_alto'], [ti - 0.02, 'sable_alto'], [ti + 0.05, 'sable_tajo'], [0.76, 'sable_frente'], [1, 'sable_frente']]),
    {inc: 0, torso: t => [20 + 10 * sstep(ti - 0.04, ti + 0.04, t) * (1 - sstep(ti + 0.06, 0.8, t)), -16 * sstep(0.4, ti, t) * (1 - sstep(ti + 0.08, 0.8, t)), -14 * sstep(ti - 0.04, ti + 0.02, t) * (1 - sstep(ti + 0.08, 0.8, t))]});
  c.ev.push([0.46, 'alzar'], [ti + 0.02, 'impacto'], [0.76, 'reponer'], [0, 'grito']);
  defJ('cab_sable_ataque', c, {armaJinete: ['sable_curvo', 'sable_recto', 'shashka'], suelo: 'carrera', pareja: {clip: 'cab_tajo_d', desfase: null}, transiciones: ['cab_galope_carga', 'cab_persecucion']}); }
// jinete contra jinete al cruzarse (derecha con derecha): golpe que alcanza y golpe parado
[['golpe', 'impacto'], ['parada', 'parada']].forEach(([n, ev]) => { const ti = 0.56;
  const A = cargaBase(4); jineteTracks(A, 160, porteKeys([[0, 'sable_frente'], [0.34, 'sable_frente'], [0.48, 'sable_alto'], [ti - 0.01, 'sable_alto'], [ti + 0.04, 'sable_tajo'], [0.78, 'sable_frente'], [1, 'sable_frente']]),
    {inc: 0, torso: t => [20, -18 * sstep(0.4, ti, t) * (1 - sstep(ti + 0.08, 0.8, t)), -12 * sstep(ti - 0.04, ti + 0.02, t) * (1 - sstep(ti + 0.08, 0.8, t))]});
  A.ev.push([ti + 0.01, ev]);
  const D = cargaBase(4);
  if (n === 'parada') jineteTracks(D, 160, porteKeys([[0, 'sable_frente'], [0.4, 'sable_frente'], [ti - 0.04, 'sable_parada'], [ti + 0.06, 'sable_parada'], [0.8, 'sable_frente'], [1, 'sable_frente']]),
    {inc: 0, torso: t => [18, -10 * sstep(0.4, ti, t) * (1 - sstep(ti + 0.08, 0.8, t)), 8 * sstep(ti, ti + 0.04, t) * (1 - sstep(ti + 0.1, 0.8, t))]});
  else jineteTracks(D, 160, porteKeys([[0, 'sable_frente'], [0.4, 'sable_frente'], [ti, 'sable_parada'], [ti + 0.08, 'sable_bajo'], [1, 'sable_bajo']]),
    {inc: 0, torso: t => [18 - 46 * sstep(ti, ti + 0.06, t) + 30 * sstep(ti + 0.1, 0.9, t), 0, 26 * sstep(ti, ti + 0.06, t) - 10 * sstep(ti + 0.2, 1, t)], cabeza: t => [-30 * sstep(ti, ti + 0.05, t), 20 * sstep(ti, ti + 0.05, t), 0],
      riendas: t => [40 * sstep(ti, ti + 0.08, t), 0, 20 * sstep(ti, ti + 0.08, t)]});
  D.ev.push([ti + 0.01, ev]); if (n === 'golpe') D.ev.push([0.9, 'cae']);
  defJ(`cab_${n}_jinete_a`, A, {armaJinete: ['sable_curvo', 'sable_recto', 'shashka'], suelo: 'carrera', pareja: {clip: `cab_${n}_jinete_d`, desfase: null}, transiciones: ['cab_galope_carga']});
  defJ(`cab_${n}_jinete_d`, D, {armaJinete: ['sable_curvo', 'sable_recto', 'shashka'], suelo: 'carrera', pareja: {clip: `cab_${n}_jinete_a`, desfase: null},
    transiciones: n === 'golpe' ? [] : ['cab_galope_carga'], grupoTras: n === 'golpe' ? {caballo: 'cab_suelto_huida', jinete: 'cab_cae_de_lado'} : null}); });
// persecución: galope tendido con el sable bajo y el cuerpo echado
{ const c = cicloAire('galope_carga', 2, {cola: 6}); jineteTracks(c, 80, 'sable_bajo', {inc: 26, amortigua: 0.03, ciclos: 2, frec: 1, cabeza: () => [-14, 0, 0]}); defJ('cab_persecucion', c, {armaJinete: ['sable_curvo', 'sable_recto', 'shashka'], suelo: 'carrera', transiciones: ['cab_sable_ataque', 'cab_galope']}); }

/* ---------- caballo herido y sin jinete ---------- */
// cojera de la mano izquierda: apoyo corto y la cabeza se levanta cuando apoya la mano dolorida
{ const A0 = AIRES.paso; AIRES.cojo = Object.assign({}, A0, {T: 1.3, v: 1.2, f: {PI: 0, MI: 0.3, PD: 0.5, MD: 0.75}});
  const c = cicloAire('cojo', 2, {cuello: 2}); const N = c.tracks.cuello.length - 1, ap = t => enApoyo(AIRES.cojo, 'MI', t * 2);
  c.tracks.cuello = c.tracks.cuello.map(k => [k[0], k[1] - 12 * (ap(k[0]) ? Math.sin(Math.PI * (((k[0] * 2 - 0.3) % 1 + 1) % 1) / AIRES.cojo.d) : 0), k[2], k[3]]);
  jineteTracks(c, 80, 'sable_hombro', {inc: 2, cabeza: () => [10, 0, 0]}); defJ('cab_cojera', c, {transiciones: ['cab_parado', 'cab_caballo_cae'], herido: true}); }
// caída del caballo herido: tropieza, dobla las manos, cae de costado (izquierdo) y queda tendido
{ const N = 100, dur = 2.2, c = {dur, loop: false, tracks: {}, ev: [[0, 'impacto'], [0.18, 'tropiezo'], [0.42, 'rodillas'], [0.66, 'cae'], [0.7, 'polvo']]};
  const K = (keys) => curva(N, t => lerpK(keys, t));
  Object.assign(c.tracks, {caballo: K([[0, 0, 0, 0], [0.2, 10, 0, 0], [0.42, 22, 0, -6], [0.66, 6, 0, -84], [1, 2, 0, -88]]),
    manoIz: K([[0, -10, 0, 0], [0.2, 10, 0, 0], [0.42, 30, 0, 0], [0.66, -30, 0, 0], [1, -40, 0, 0]]), canaIz: K([[0, 0, 0, 0], [0.2, 40, 0, 0], [0.42, 120, 0, 0], [0.66, 60, 0, 0], [1, 30, 0, 0]]),
    manoDe: K([[0, -6, 0, 0], [0.2, 4, 0, 0], [0.42, 26, 0, 0], [0.66, -10, 0, 0], [1, -24, 0, 0]]), canaDe: K([[0, 0, 0, 0], [0.24, 50, 0, 0], [0.42, 115, 0, 0], [0.66, 40, 0, 0], [1, 20, 0, 0]]),
    pataIz: K([[0, 10, 0, 0], [0.42, -20, 0, 0], [0.66, -40, 0, 0], [1, -30, 0, 0]]), corvIz: K([[0, -10, 0, 0], [0.42, -60, 0, 0], [0.66, -30, 0, 0], [1, -20, 0, 0]]),
    pataDe: K([[0, 6, 0, 0], [0.42, -26, 0, 0], [0.66, -20, 0, 0], [1, -6, 0, 0]]), corvDe: K([[0, -8, 0, 0], [0.42, -70, 0, 0], [0.66, -20, 0, 0], [1, -10, 0, 0]]),
    cuello: K([[0, 0, 0, 0], [0.2, 20, 0, 0], [0.42, 30, 10, 0], [0.66, 10, 0, 20], [0.85, -10, 0, 30], [1, 4, 0, 26]]), testa: K([[0, 0, 0, 0], [0.42, 10, 0, 0], [0.66, -10, 0, 0], [1, 6, 0, 0]]),
    cola: K([[0, 10, 0, 0], [0.42, -10, 0, 0], [0.7, 20, 0, 20], [1, 10, 0, 30]])});
  c.root = curva(N, t => [lerpK([[0, 0], [0.66, 0.2], [1, 0.25]], t)[0], 0, lerpK([[0, 0], [0.42, 1.3], [0.66, 1.9], [1, 2.0]], t)[0]]);
  jineteTracks(c, N, t => PORTE.sable_hombro, {inc: 0, torso: t => [lerpK([[0, 4], [0.2, -20], [0.42, 30], [0.66, 10], [1, 0]], t)[0], 0, lerpK([[0, 0], [0.66, 30], [1, 40]], t)[0]]});
  defJ('cab_caballo_cae', c, {suelo: 'tendido', desplazamiento: [0.25, 0, 2.0], grupo: {caballo: 'cab_caballo_*', jinete: {tipo: 'inf_cab_*', clip: 'cab_derribado', desfase: [0, 0, 0]}}, transiciones: []}); }
// caballo sin jinete huyendo: galope con la cabeza alta y sacudidas de cabeza
{ const c = cicloAire('galope', 2, {cuello: -12, testa: -10, cola: 15}); c.tracks.testa = c.tracks.testa.map(k => [k[0], k[1] + 8 * Math.sin(2 * Math.PI * k[0] * 3), 10 * Math.sin(2 * Math.PI * k[0]), k[3]]);
  jineteTracks(c, 80, 'sable_hombro', {}); defJ('cab_suelto_huida', c, {suelo: 'carrera', sinJinete: true, transiciones: ['cab_parado']}); }

/* ---------- oficial: señalar con el sable y saludo ---------- */
{ const c = {dur: 3, loop: true, tracks: {}, ev: [[0.25, 'voz']]}, N = 60; resolverPatas(c, N, () => ({z: 0, pitch: 0, apoyo: {MI: true, MD: true, PI: true, PD: true}}), (k) => [PATAS[k].piv[2] + (PATAS[k].del ? 0.02 : -0.02), 0]);
  c.tracks.cuello = curva(N, t => [-4 + 3 * Math.sin(2 * Math.PI * t), 4 * Math.sin(2 * Math.PI * t), 0]); c.tracks.cola = curva(N, t => [8, 0, 6 * Math.sin(2 * Math.PI * t)]);
  jineteTracks(c, N, porteKeys([[0, 'sable_hombro'], [0.15, 'sable_frente'], [0.75, 'sable_frente'], [0.95, 'sable_hombro'], [1, 'sable_hombro']]), {inc: 0, torso: t => [-4, -12 * sstep(0.1, 0.25, t) * (1 - sstep(0.75, 0.95, t)), 0], cabeza: t => [-8, 10, 0]});
  c.tracks.brazoDe = c.tracks.brazoDe.map(k => [k[0], k[1] - 40 * sstep(0.1, 0.25, k[0]) * (1 - sstep(0.75, 0.95, k[0])), k[2], k[3]]);
  c.tracks.arma = c.tracks.arma.map(k => [k[0], k[1] + 40 * sstep(0.1, 0.25, k[0]) * (1 - sstep(0.75, 0.95, k[0])), k[2], k[3]]);
  defJ('cab_oficial_senalar', c, {oficial: true, transiciones: ['cab_parado', 'cab_saludo_sable']}); }
{ const c = {dur: 2.6, loop: false, tracks: {}, ev: [[0.35, 'saludo']]}, N = 60; resolverPatas(c, N, () => ({z: 0, pitch: 0, apoyo: {MI: true, MD: true, PI: true, PD: true}}), (k) => [PATAS[k].piv[2] + (PATAS[k].del ? 0.02 : -0.02), 0]);
  c.tracks.cuello = curva(N, t => [2 * Math.sin(2 * Math.PI * t), 0, 0]); c.tracks.cola = curva(N, () => [8, 0, 0]);
  jineteTracks(c, N, porteKeys([[0, 'sable_hombro'], [0.25, 'sable_saludo'], [0.55, 'sable_saludo'], [0.75, 'sable_bajo'], [0.9, 'sable_bajo'], [1, 'sable_hombro']]), {inc: -2, cabeza: () => [-4, 0, 0]});
  defJ('cab_saludo_sable', c, {oficial: true, transiciones: ['cab_parado', 'cab_oficial_senalar']}); }

/* ===================================================================================== */
/* CLIPS DEL SOLDADO (jinete a pie y víctimas emparejadas). Montado: postura del jinete sobre la silla en el rig del soldado
   (raíz a 0,5 m: los hombros coinciden con los del jinete; los muslos van algo más bajos, la diferencia se ve solo en el primer fotograma del relevo). */
function soldadoClips(INF) {
  const H = INF._herramientas, PS = INF.POSES, W = PS.W, {Clip, con, mas, mezcla} = H;
  const MONT = {pelvis: [0, 0, 0], torso: [4, 0, 0], cabeza: [0, 0, 0], musloIz: [-58, 0, 16], piernaIz: [66, 0, 0], pieIz: [-6, 0, 0], musloDe: [-58, 0, -16], piernaDe: [66, 0, 0], pieDe: [-6, 0, 0],
    brazoIz: [-24, 0, 8], antebrazoIz: [-62, 0, -6], brazoDe: [-18, 0, -8], antebrazoDe: [-70, 0, 0]};
  const def = (n, C, m) => { CLIPS_S[n] = C.fin(); META_S[n] = Object.assign({suelo: 'pie', avance: 0, desplazamiento: [0, 0, 0], armaCompatible: ERAS.slice(), transiciones: []}, m || {}); META_S[n].eventos = CLIPS_S[n].ev.map(e => e[1]); };
  // derribado: sale despedido por encima del cuello y cae de bruces; se queda tendido (grupo con cab_caballo_cae)
  { const C = new Clip(2.2, false); C.k(0, MONT).k(0.2, con(MONT, {torso: [40, 0, 10], cabeza: [-20, 0, 0], brazoIz: [-120, 0, 30], brazoDe: [-120, 0, -30]}))
      .k(0.42, con(PS.BOCA_ABAJO, {pelvis: [60, 0, 20], torso: [10, 0, 0], brazoIz: [-150, 0, 40], brazoDe: [-150, 0, -40], musloIz: [-20, 0, 10], piernaIz: [40, 0, 0]})).k(0.6, PS.BOCA_ABAJO).k(1, con(PS.BOCA_ABAJO, {cabeza: [-50, 20, 0]}));
    C.a(0, W.SUELO, [-1, -1]).a(1, W.SUELO, [-1, -1]); C.oculta('arma', [[0, 0]]);
    C.r(0, 0, 0.5, -0.06).r(0.2, 0.1, 0.62, 0.8).r(0.42, 0.25, 0.0, 2.2).r(0.6, 0.3, 0, 2.5).r(1, 0.3, 0, 2.5); C.e(0, 'impacto').e(0.42, 'cae').e(0.45, 'polvo');
    def('cab_derribado', C, {suelo: 'libre', asentarDesde: 0.42, desplazamiento: [0.3, 0, 2.5], transiciones: ['cab_levantarse_derribado']}); }
  // se levanta aturdido (de bruces → a gatas → de rodillas → en pie), se sacude y desenvaina
  { const C = new Clip(3.2, false), GAT = con(PS.AGACHADO, {torso: [70, 0, 0], brazoIz: [-80, 0, 10], antebrazoIz: [-10, 0, 0], brazoDe: [-80, 0, -10], antebrazoDe: [-10, 0, 0], musloIz: [-80, 0, 8], musloDe: [-80, 0, -8], piernaIz: [100, 0, 0], piernaDe: [100, 0, 0]});
    C.k(0, con(PS.BOCA_ABAJO, {cabeza: [-50, 20, 0]})).k(0.25, con(PS.BOCA_ABAJO, {brazoIz: [-20, 0, 40], antebrazoIz: [-90, 0, 0], brazoDe: [-20, 0, -40], antebrazoDe: [-90, 0, 0], torso: [-30, 0, 0]}))
      .k(0.45, GAT).k(0.62, con(PS.RODILLA, {torso: [20, 0, 0], brazoDe: [-40, 0, -20], antebrazoDe: [-80, 0, 0]})).k(0.8, con(PS.FIRME, {torso: [12, 0, 6], cabeza: [10, 20, 0], brazoIz: [-30, 0, 30], antebrazoIz: [-110, 0, 0]})).k(1, PS.FIRME);
    C.a(0, W.SUELO, [-1, -1]).a(0.85, W.SUELO, [-1, -1]).a(0.9, W.ESP_BAJA).a(1, W.ESP_BAJA); C.oculta('arma', [[0, 0], [0.86, 1]]); C.e(0.45, 'a_gatas').e(0.62, 'rodilla').e(0.8, 'en_pie').e(0.88, 'desenvaina');
    def('cab_levantarse_derribado', C, {transiciones: ['idle', 'idle_oficial', 'huir']}); }
  // desmontar por la izquierda (pierna derecha por encima de la grupa) y montar
  { const C = new Clip(2.6, false); C.k(0, MONT).k(0.25, con(MONT, {torso: [20, 30, 0], musloDe: [-30, 0, -70], piernaDe: [20, 0, 0]})).k(0.45, con(PS.FIRME, {torso: [10, 60, 0], musloDe: [10, 0, -30], musloIz: [-30, 0, 0], piernaIz: [60, 0, 0], brazoIz: [-90, 0, 10]}))
      .k(0.7, con(PS.FIRME, {torso: [4, 80, 0], brazoIz: [-60, 0, 10], antebrazoIz: [-40, 0, 0]})).k(1, con(PS.FIRME, {brazoIz: [-50, 0, 20], antebrazoIz: [-50, 0, 0]}));
    C.a(0, W.SUELO, [-1, -1]).a(1, W.SUELO, [-1, -1]); C.oculta('arma', [[0, 0]]); C.r(0, 0, 0.5, -0.06).r(0.3, 0.25, 0.55, -0.1).r(0.5, 0.55, 0.05, -0.12).r(1, 0.6, 0, 0); C.e(0.48, 'pie_en_tierra');
    def('cab_desmontar', C, {suelo: 'libre', asentarDesde: 0.5, desplazamiento: [0.6, 0, 0], grupo: {caballo: 'cab_parado'}, transiciones: ['idle', 'cab_montar']});
    const M = new Clip(2.6, false); M.c.tracks = {}; const ks = Object.keys(C.c.tracks);
    ks.forEach(k => { M.c.tracks[k] = CLIPS_S.cab_desmontar.tracks[k].map(q => [1 - q[0]].concat(q.slice(1))).reverse(); });
    M.c.root = CLIPS_S.cab_desmontar.root.map(q => [1 - q[0]].concat(q.slice(1))).reverse(); M.c.hide = CLIPS_S.cab_desmontar.hide; M.c.ev = [[0.52, 'pie_en_estribo'], [1, 'montado']];
    def('cab_montar', M, {suelo: 'libre', asentarHasta: 0.5, transiciones: []}); }
  // cae de lado del caballo al galope (golpe recibido): se suelta por la izquierda y rueda
  { const C = new Clip(1.8, false); C.k(0, MONT).k(0.12, con(MONT, {torso: [-20, 0, 40], brazoIz: [-60, 0, 60], brazoDe: [-120, 0, -40]})).k(0.35, con(PS.TUMBADO_ESP, {pelvis: [-70, 0, 70], torso: [20, 0, 0]}))
      .k(0.6, con(PS.BOCA_ABAJO, {pelvis: [88, 0, -40]})).k(0.8, con(PS.TUMBADO_ESP, {pelvis: [10, 0, 88], torso: [10, 0, 0], musloIz: [-30, 0, 0], piernaIz: [40, 0, 0]})).k(1, con(PS.TUMBADO_ESP, {pelvis: [-88, 40, 0], cabeza: [20, 30, 0], brazoIz: [10, 0, 70]}));
    C.a(0, W.SUELO, [-1, -1]).a(1, W.SUELO, [-1, -1]); C.oculta('arma', [[0, 0]]); C.r(0, 0, 0.5, -0.06).r(0.2, 0.5, 0.3, 1.2).r(0.35, 0.9, 0, 2.2).r(0.6, 1.2, 0, 3.0).r(1, 1.3, 0, 3.4); C.e(0, 'impacto').e(0.3, 'cae').e(0.6, 'rueda');
    def('cab_cae_de_lado', C, {suelo: 'libre', asentarDesde: 0.33, desplazamiento: [1.3, 0, 3.4], transiciones: ['cab_levantarse_derribado']}); }
  // infante alanceado: aguanta con la bayoneta, la lanza le alcanza el pecho y sale despedido de espaldas
  { const C = new Clip(2.0, false), ti = 0.6, G = con(PS.TIRADOR, {musloIz: [-22, 0, 6], piernaIz: [18, 0, 0], musloDe: [12, 0, -6], torso: [10, -10, 0]});
    C.k(0, G).k(ti - 0.1, mas(G, {torso: [-6, 0, 0], cabeza: [-10, 0, 0]})).k(ti, G).k(ti + 0.04, mas(G, {torso: [-30, 0, 0], cabeza: [-30, 0, 0], brazoIz: [-40, 0, 40]}))
      .k(ti + 0.18, con(PS.TUMBADO_ESP, {pelvis: [-50, 0, 0], torso: [10, 0, 0]})).k(1, con(PS.TUMBADO_ESP, {cabeza: [30, 20, 0], brazoIz: [10, 0, 60], brazoDe: [10, 0, -50]}));
    C.a(0, W.BAYO_ALTA).a(ti, W.BAYO_ALTA).a(ti + 0.06, W.SUELO).a(1, W.SUELO); C.g(ti + 0.02, -1, -1); C.r(0, 0, 0, 0).r(ti, 0, 0, 0).r(ti + 0.18, 0, 0, -1.1).r(1, 0, 0, -1.3);
    C.e(ti, 'impacto').e(ti + 0.02, 'suelta_arma').e(ti + 0.18, 'cae');
    def('cab_lanzado_d', C, {pareja: {clip: 'cab_lanza_ataque', desfase: null}, desplazamiento: [0, 0, -1.3], transiciones: []}); }
  // infante acuchillado al paso del jinete: se cubre, recibe el tajo en el hombro, gira y cae de rodillas y de bruces
  { const C = new Clip(2.0, false), ti = 0.58, G = con(PS.TIRADOR, {torso: [8, -10, 0]});
    C.k(0, G).k(ti - 0.1, con(G, {torso: [6, 20, 0], cabeza: [-10, 20, 0], brazoIz: [-110, 0, 40], antebrazoIz: [-60, 0, 0]})).k(ti, con(G, {torso: [6, 20, 0], cabeza: [-10, 20, 0]}))
      .k(ti + 0.05, mas(G, {torso: [20, 60, 20], cabeza: [20, 20, 0]})).k(ti + 0.2, con(PS.RODILLA, {torso: [40, 40, 0]})).k(ti + 0.32, con(PS.BOCA_ABAJO, {pelvis: [80, 30, 0]})).k(1, PS.BOCA_ABAJO);
    C.a(0, W.PORTA).a(ti, AW(W.PORTA, {P: [0, 0.2, 0]})).a(ti + 0.08, W.SUELO).a(1, W.SUELO); C.g(ti + 0.03, -1, -1); C.r(0, 0, 0, 0).r(ti, 0, 0, 0).r(ti + 0.2, 0.2, 0, -0.3).r(ti + 0.32, 0.3, 0, 0.3).r(1, 0.3, 0, 0.4);
    C.e(ti, 'impacto').e(ti + 0.04, 'suelta_arma').e(ti + 0.32, 'cae');
    def('cab_tajo_d', C, {pareja: {clip: 'cab_sable_ataque', desfase: null}, desplazamiento: [0.3, 0, 0.4], transiciones: []}); }
}
const AW = (a, m) => ({P: a.P.map((v, i) => v + (m.P ? m.P[i] : 0)), R: a.R.map((v, i) => v + (m.R ? m.R[i] : 0)), g: m.g || a.g});

/* ---------- transiciones ---------- */
const TRANSICIONES = {};
function grafo() { Object.entries(Object.assign({}, META, META_S)).forEach(([n, m]) => { TRANSICIONES[n] = TRANSICIONES[n] || {}; (m.transiciones || []).forEach(t => { TRANSICIONES[n][t] = /galope|carga|persecucion|giro/.test(n + t) ? 0.15 : 0.3; }); });
  TRANSICIONES.cab_galope_carga = Object.assign(TRANSICIONES.cab_galope_carga || {}, {cab_persecucion: 0.2, cab_parada_jinete_a: 0.12, cab_parada_jinete_d: 0.12, cab_golpe_jinete_d: 0.12});
  TRANSICIONES.cab_galope = Object.assign(TRANSICIONES.cab_galope || {}, {cab_cojera: 0.4, cab_caballo_cae: 0.15});
  TRANSICIONES.cab_paso = Object.assign(TRANSICIONES.cab_paso || {}, {cab_cojera: 0.4}); }
function rutaTransicion(desde, hasta) { const cola = [[desde]], vis = new Set([desde]); while (cola.length) { const r = cola.shift(), u = r[r.length - 1]; if (u === hasta) return r.slice(1).map((c, i) => ({clip: c, mezcla: (TRANSICIONES[r[i]] || {})[c]}));
  Object.keys(TRANSICIONES[u] || {}).forEach(v => { if (!vis.has(v)) { vis.add(v); cola.push(r.concat([v])); } }); } return null; }

/* ---------- escuadrones: posiciones relativas (x a la derecha del escuadrón, z al frente; metros) ----------
   «Cavalry Drill» (1896): en línea, dos filas rodilla con rodilla (0,9–1 m por caballo) y 1 largo de caballo (2,4 m) entre filas más 0,9 m;
   oficiales 1 largo al frente, trompeta junto al jefe, guion en el centro de la primera fila. Columna de a cuatro para marchar; columna de
   escuadrones con la distancia de un frente de escuadrón (abierta) o de 12 m (cerrada). */
const GRUPOS = {
  escuadron_linea: (n, op) => { op = op || {}; const fil = Math.ceil(n / 2), dx = op.intervalo || 0.95, dz = op.distancia || 3.3, out = [];
    for (let f = 0; f < 2; f++) for (let i = 0; i < fil && out.length < n; i++) out.push({x: (i - (fil - 1) / 2) * dx, z: -f * dz, fila: f + 1, papel: f === 0 && i === Math.floor(fil / 2) ? 'guion' : 'jinete'});
    out.push({x: 0, z: 2.6, papel: 'jefe', tipo: 'cab_oficial'}, {x: -1.4, z: 2.2, papel: 'trompeta'}, {x: -fil * dx / 2 - 1.2, z: 1.2, papel: 'oficial', tipo: 'cab_oficial'}, {x: fil * dx / 2 + 1.2, z: -dz - 2.4, papel: 'oficial_cierre', tipo: 'cab_oficial'});
    return out; },
  columna_de_a_cuatro: (n, op) => { op = op || {}; const dx = op.intervalo || 0.95, dz = op.distancia || 3.0, out = [];
    for (let i = 0; i < n; i++) out.push({x: (i % 4 - 1.5) * dx, z: -Math.floor(i / 4) * dz, papel: 'jinete'}); out.unshift({x: 0, z: 3.0, papel: 'jefe', tipo: 'cab_oficial'}); return out; },
  columna_de_escuadrones: (n, op) => { op = op || {}; const esc = op.escuadrones || 4, por = Math.ceil(n / esc), frente = Math.ceil(por / 2) * (op.intervalo || 0.95), dist = op.cerrada ? 12 : frente + 6.6, out = [];
    for (let e = 0; e < esc; e++) GRUPOS.escuadron_linea(por, op).forEach(p => out.push(Object.assign({}, p, {z: p.z - e * dist, escuadron: e + 1}))); return out; }
};
function formacion(tipo, n, op) { const f = GRUPOS[tipo]; if (!f) throw new Error('formación desconocida: ' + tipo); return f(n, op); }

/* ===================================================================================== */
/* REGISTRO */
// puntos de contacto del caballo (para los clips en que se tiende) y del soldado
const PTS_CAB = [['canaIz', [0, -0.575, 0.05]], ['canaDe', [0, -0.575, 0.05]], ['corvIz', [0, -0.615, 0.04]], ['corvDe', [0, -0.615, 0.04]], ['canaIz', [0, -0.575, -0.06]], ['canaDe', [0, -0.575, -0.06]], ['corvIz', [0, -0.615, -0.07]], ['corvDe', [0, -0.615, -0.07]], ['canaIz', [0, -0.3, 0]], ['canaDe', [0, -0.3, 0]], ['corvIz', [0, -0.3, 0]], ['corvDe', [0, -0.3, 0]],
  ['caballo', [0.26, 0.0, -0.4]], ['caballo', [0.26, 0.0, 0.3]], ['caballo', [-0.26, 0.0, -0.4]], ['caballo', [-0.26, 0.0, 0.3]], ['caballo', [0, -0.27, -0.2]], ['caballo', [0, -0.27, 0.35]], ['caballo', [0, 0.28, -0.4]], ['caballo', [0, 0.28, 0.3]],
  ['caballo', [0.15, 0.2, -0.6]], ['caballo', [-0.15, 0.2, -0.6]], ['cuello', [0.1, 0.35, 0.15]], ['cuello', [-0.1, 0.35, 0.15]], ['testa', [0.08, -0.05, 0.1]], ['testa', [-0.08, -0.05, 0.1]], ['testa', [0, -0.35, 0.35]]];
const PTS_SOL = [['cabeza', [0, 0.29, 0]], ['cabeza', [0, 0.16, 0.11]], ['torso', [0.17, 0.42, 0.1]], ['torso', [-0.17, 0.42, 0.1]], ['torso', [0.17, 0.42, -0.12]], ['torso', [-0.17, 0.42, -0.12]], ['torso', [0, 0.15, 0.13]], ['torso', [0, 0.25, -0.2]],
  ['pelvis', [0.16, -0.08, -0.12]], ['pelvis', [-0.16, -0.08, -0.12]], ['pelvis', [0, -0.1, 0.12]], ['antebrazoIz', [0, -0.33, 0]], ['antebrazoDe', [0, -0.33, 0]], ['brazoIz', [0, -0.29, 0]], ['brazoDe', [0, -0.29, 0]], ['piernaIz', [0, 0, 0.07]], ['piernaDe', [0, 0, 0.07]],
  ['pieIz', [0, -0.081, -0.065]], ['pieIz', [0, -0.081, 0.175]], ['pieDe', [0, -0.081, -0.065]], ['pieDe', [0, -0.081, 0.175]]];
function minY(T3, rig, M, pts) { const IX = {}; T3.RIGS[rig].forEach((p, i) => { IX[p[0]] = i; }); let low = Infinity; pts.forEach(([p, v]) => { const o = IX[p] * 16, y = M[o + 1] * v[0] + M[o + 5] * v[1] + M[o + 9] * v[2] + M[o + 13]; if (y < low) low = y; }); return low; }
// apoya la raíz: entre t0 y t1 (con 0,04 de fundido) y = y propia − punto más bajo
function apoyar(T3, rig, clip, pts, t0, t1, N) {
  N = N || 96; const S = T3.CLIPS[rig], tmp = '__cab3d_tmp', base = clip.root && clip.root.length ? clip.root : [[0, 0, 0, 0]], out = [];
  for (let i = 0; i <= N; i++) { const t = i / N, rx = muestreo(base, t, 1), ry = muestreo(base, t, 2), rz = muestreo(base, t, 3); S[tmp] = Object.assign({}, clip, {root: [[0, rx, ry, rz]]});
    const low = minY(T3, rig, T3.poseTroop(rig, tmp, t), pts), w = Math.min(sstep(t0 - 0.04, t0, t), 1 - sstep(t1, t1 + 0.04, t));
    out.push([+t.toFixed(4), +rx.toFixed(4), +(ry - low * w).toFixed(4), +rz.toFixed(4)]); }
  delete S[tmp]; clip.root = out; return clip;
}
// posición de un punto de una parte en el instante t (marco del clip)
function punto(T3, rig, clip, parte, local, t) { const M = T3.poseTroop(rig, clip, t), i = T3.RIGS[rig].findIndex(p => p[0] === parte), o = i * 16;
  return [0, 1, 2].map(k => M[o + k] * local[0] + M[o + 4 + k] * local[1] + M[o + 8 + k] * local[2] + M[o + 12 + k]); }
let _I = null, _reg = null;
function registrar(T3, op) {
  op = op || {}; const INFm = root.infanteria3d; if (!INFm) throw new Error('caballeria3d necesita infanteria3d.js cargado antes');
  INFm.registrar(T3, op); const INF = INFm.instancia(T3); _I = _I || crear(T3, INF);
  if (!Object.keys(CLIPS_S).length) { soldadoClips(INFm); grafo(); }
  const tipos = [], clips = [], saltados = [];
  Object.entries(_I.TIPOS).forEach(([k, K]) => { if (T3.KINDS[k] && !op.reemplazar) return; T3.KINDS[k] = K; if (!T3.TROOP_KINDS.includes(k)) T3.TROOP_KINDS.push(k); tipos.push(k); });
  const SJ = T3.CLIPS.jinete, SS = T3.CLIPS.soldado;
  Object.entries(CLIPS).forEach(([n, c]) => { if (SJ[n] && !op.reemplazar) { saltados.push(n); return; } const k = JSON.parse(JSON.stringify(c)); SJ[n] = k;
    if (META[n].suelo === 'tendido') apoyar(T3, 'jinete', k, PTS_CAB, 0, 1.1); clips.push(n); });
  Object.entries(CLIPS_S).forEach(([n, c]) => { if (SS[n] && !op.reemplazar) { saltados.push(n); return; } const k = JSON.parse(JSON.stringify(c)), m = META_S[n]; INFm._herramientas.alcanzar(T3, k);
    if (m.suelo !== 'libre') INFm._herramientas.asentar(T3, n, k, {suelo: 'pie'});
    else if (m.asentarDesde != null) apoyar(T3, 'soldado', k, PTS_SOL, m.asentarDesde, 1.1); else if (m.asentarHasta != null) apoyar(T3, 'soldado', k, PTS_SOL, -0.1, m.asentarHasta);
    SS[n] = k; clips.push(n); });
  // desfases de las parejas calculados con la cinemática: la víctima se coloca donde llega la punta del arma en el impacto
  const tImp = c => (c.ev.find(e => e[0] && (e[1] === 'impacto' || e[1] === 'parada')) || [0.5])[0];
  [['cab_lanza_ataque', 'cab_lanzado_d', [0, 2.05, 0], [0, 1.25, 0.12]], ['cab_sable_ataque', 'cab_tajo_d', [0, 0.85, 0], [0, 1.45, 0.05]]].forEach(([a, d, tip, blanco]) => {
    const ti = tImp(SJ[a]), P = punto(T3, 'jinete', a, 'arma', tip, ti), dD = SS[d].root ? muestreo(SS[d].root, tImp(SS[d]), 3) : 0;
    META[a].pareja.desfase = [+(P[0] - blanco[0]).toFixed(3), +(P[2] + blanco[2] + dD).toFixed(3), 180]; META_S[d].pareja.desfase = META[a].pareja.desfase.slice(); META_S[d].pareja.relativoA = a; });
  ['golpe', 'parada'].forEach(n => { const a = `cab_${n}_jinete_a`, d = `cab_${n}_jinete_d`, ti = tImp(SJ[a]), P = punto(T3, 'jinete', a, 'arma', [0, 0.8, 0], ti), zA = muestreo(SJ[a].root, ti, 3), zD = muestreo(SJ[d].root, ti, 3);
    const des = [+Math.min(P[0] - 0.32, -1.15).toFixed(3), +(zA + zD + 0.1).toFixed(3), 180]; META[a].pareja.desfase = des; META[d].pareja.desfase = des.slice(); META[d].pareja.relativoA = a; });
  // lotes de los tipos cab_*: se preparan solos (marcas, crin, vello del jinete) y setClip pone el aire para la crin
  const TB = T3.TroopBatch.prototype;
  if (!TB._cab3d) { const add0 = TB.add, set0 = TB.setClip;
    TB.add = function (x, y, z, yaw, scale, nation, clip, o) { const cab = /^cab_/.test(this.kind); if (cab && !this._iCab) prepararLote(this);
      const i = add0.call(this, x, y, z, yaw, scale, nation, clip, o); if (cab && i >= 0) { marcar(this, i, (o && o.marcas) || (op.sortear !== false ? marcasAleatorias() : {})); aireDe(this, i, velocidadClip(clip)); } return i; };
    TB.setClip = function (i, clip, ph, blend) { const r = set0.call(this, i, clip, ph, blend); if (r && this._iCab) aireDe(this, i, velocidadClip(clip)); return r; };
    TB._cab3d = true; }
  _reg = {tipos, clips, saltados}; return _reg;
}
// 0 (parado) … 1 (galope de carga), para la ondulación de crin y cola
function velocidadClip(n) { const m = META[n]; if (m) { const A = m.aire && AIRES[m.aire]; return A ? Math.min(1, Math.abs(A.v) / 9) : /carga|ataque|jinete_|persecucion|huida|salto/.test(n) ? 1 : 0; }
  return /galope|carga|huida/.test(n) ? 0.8 : /trote/.test(n) ? 0.4 : /paso/.test(n) ? 0.15 : 0; }


/* ===================================================================================== */
/* DEMOSTRACIÓN: demoCaballeria(contenedor, {vista: 'clips' | 'tipos' | 'escuadron', clip, tipo, nat, era, t, formacion})
   Requiere Troops3D e infanteria3d. En «clips» aparecen solos el compañero (META.pareja) y el grupo del relevo (META.grupo). */
function demoCaballeria(cont, op) {
  op = op || {}; const T3 = root.Troops3D; if (!T3) throw new Error('demoCaballeria necesita Troops3D (troops3d.js)');
  registrar(T3); const q = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new Map(), arg = k => op[k] != null ? op[k] : q.get(k);
  const NAT = ['PRU', 'AUT', 'FRA', 'GBR', 'RUS', 'USA', 'CSA', 'ESP', 'ITA', 'JPN'], TJ = Object.keys(JINETES);
  const R = new THREE.WebGLRenderer({antialias: true}); R.setPixelRatio(Math.min(2, root.devicePixelRatio || 1)); R.domElement.style.cssText = 'display:block;width:100%;height:100%'; cont.appendChild(R.domElement);
  const S = new THREE.Scene(); S.background = new THREE.Color(0xc9d2d4); S.fog = new THREE.Fog(0xc9d2d4, 40, 140);
  S.add(new THREE.HemisphereLight(0xffffff, 0x5d6b48, 0.85)); const L = new THREE.DirectionalLight(0xfff1dc, 1.25); L.position.set(-4, 8, 6); S.add(L);
  // suelo con marcas cada 2 m para ver el avance
  const cv = document.createElement('canvas'); cv.width = cv.height = 64; const cx = cv.getContext('2d'); cx.fillStyle = '#86965f'; cx.fillRect(0, 0, 64, 64); cx.fillStyle = '#7a8a55'; cx.fillRect(0, 0, 64, 3); cx.fillRect(0, 0, 3, 64);
  const tx = new THREE.CanvasTexture(cv); tx.wrapS = tx.wrapT = THREE.RepeatWrapping; tx.repeat.set(200, 200); tx.colorSpace = THREE.SRGBColorSpace;
  const suelo = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshLambertMaterial({map: tx})); suelo.rotation.x = -Math.PI / 2; S.add(suelo);
  const cam = new THREE.PerspectiveCamera(32, 1, 0.1, 400); let az = 1.2, el = 0.16, dist = 8, mira = new THREE.Vector3(0, 1.1, 0);
  const sh = new T3.TroopShared(NAT.concat(['TUR', 'GEN'])); let lotes = [], moviles = [];
  const panel = document.createElement('div'); panel.style.cssText = 'position:absolute;right:8px;top:8px;z-index:6;background:#2a1d12e8;color:#f0dfb4;padding:8px 10px;font:13px Georgia,serif;border:1px solid #b08a3e;max-width:320px';
  if (getComputedStyle(cont).position === 'static') cont.style.position = 'relative'; cont.appendChild(panel);
  const sel = (id, ops, v) => `<label style="display:block;margin:3px 0">${id} <select id="c3d_${id}" style="max-width:210px">${ops.map(o => `<option ${o === v ? 'selected' : ''}>${o}</option>`).join('')}</select></label>`;
  const clips = Object.keys(CLIPS), est = {vista: arg('vista') || 'clips', clip: arg('clip') || 'cab_galope_carga', tipo: arg('tipo') || 'auto', nat: arg('nat') || 'FRA', era: arg('era') || 'A',
    formacion: arg('formacion') || 'escuadron_linea', t: arg('t') != null ? +arg('t') : null};
  panel.innerHTML = sel('vista', ['clips', 'tipos', 'escuadron'], est.vista) + sel('clip', clips, est.clip) + sel('tipo', ['auto'].concat(TJ), est.tipo) + sel('nat', NAT, est.nat) + sel('era', ERAS, est.era)
    + sel('formacion', Object.keys(GRUPOS), est.formacion)
    + `<label style="display:block;margin:3px 0">t <input id="c3d_t" type="range" min="0" max="1" step="0.005" value="${est.t == null ? 0 : est.t}" style="width:150px"> <input id="c3d_play" type="checkbox" ${est.t == null ? 'checked' : ''}> en marcha</label><div id="c3d_info" style="font-size:12px;opacity:.85;margin-top:4px"></div>`;
  const $ = id => panel.querySelector('#c3d_' + id);
  const tipoDe = cl => { if (est.tipo !== 'auto') return est.tipo; const m = META[cl] || {}; return /lanza/.test(cl) ? 'lancero' : m.oficial ? 'oficial' : /jinete_|persecucion/.test(cl) ? 'coracero' : /sable/.test(cl) ? 'husar' : 'dragon'; };
  const lote = (k, e, n, cap, lod) => { const b = new T3.TroopBatch(sh, k, e, n, cap || 8, {lod: lod || 0}); S.add(b.mesh); lotes.push(b); return b; };
  let reloj = 0, tAct = 0;
  function montar() {
    lotes.forEach(b => { S.remove(b.mesh); b.mesh.geometry.dispose(); }); lotes = []; moviles = []; const info = []; reloj = 0;
    if (est.vista === 'clips') { const c = est.clip, m = META[c], C = T3.CLIPS.jinete[c], tp = tipoDe(c), J = JINETES[tp], nat = est.nat, e = J.eras.includes(est.era) ? est.era : J.eras[J.eras.length - 1];
      const prin = m.grupo ? lote('cab_' + tp + '_sin_jinete', e, nat) : lote('cab_' + tp, e, nat); prin.add(0, 0, 0, 0, 1, nat, c, {phase: 0, h: 0, bright: 0.5, skin: 1, horse: 0});
      if (m.grupo) { const g = m.grupo.jinete; lote('inf_cab_' + tp, e, nat).add(g.desfase[0], 0, g.desfase[1], 0, 1, nat, g.clip, {phase: 0, h: 0, bright: 0.5, skin: 1}); }
      if (m.pareja && m.pareja.clip) { const d = m.pareja.desfase, o = m.pareja.clip, nat2 = NAT[(NAT.indexOf(nat) + 1) % NAT.length], jin = !!T3.CLIPS.jinete[o];
        lote(jin ? 'cab_' + (tp === 'lancero' ? 'husar' : 'dragon') : 'inf_soldado', jin ? 'B' : e, nat2).add(d[0], 0, d[1], d[2] * Math.PI / 180, 1, nat2, o, {phase: 0, h: 0, bright: 0.5, skin: 2, horse: 2}); }
      info.push(`<b>${c}</b> · ${C.dur.toFixed(2)} s ${C.loop ? '(bucle)' : ''} · ${tp}`, `eventos: ${(C.ev || []).map(x => x[1] + '@' + x[0].toFixed(2)).join(', ') || '—'}`,
        `suelo: ${m.suelo} · avance: ${(m.avance || 0).toFixed(2)} m/ciclo · desplazamiento: ${m.desplazamiento.map(v => v.toFixed(1)).join(', ')}`, m.pareja ? `pareja: ${m.pareja.clip} en [${m.pareja.desfase.join(', ')}]` : '',
        m.grupo ? `grupo: caballo sin jinete + ${m.grupo.jinete.clip}` : '', `transiciones: ${(m.transiciones || []).join(', ') || '—'}`);
      dist = m.pareja ? 13 : 8; az = 1.25; }
    else if (est.vista === 'tipos') { TJ.forEach((tp, i) => { const J = JINETES[tp], e = J.eras.includes(est.era) ? est.era : J.eras[J.eras.length - 1];
        lote('cab_' + tp, e, est.nat, 2).add((i - (TJ.length - 1) / 2) * 2.2, 0, 0, Math.PI / 2, 1, est.nat, 'cab_parado' + (J.arma === 'lanza' ? '_lanza' : ''), {phase: i / TJ.length, h: 0, bright: 0.5, skin: i % 4, horse: i % 4}); });
      info.push(`tipos · ${est.nat} · era ${est.era} (si el tipo no existe en esa era, la más cercana)`); mira.set(0, 1.2, 0); dist = 22; az = 0; el = 0.12; }
    else { const tp = est.tipo === 'auto' ? 'husar' : est.tipo, J = JINETES[tp], e = J.eras.includes(est.era) ? est.era : J.eras[J.eras.length - 1], P = formacion(est.formacion, 32), c = META[est.clip] && META[est.clip].aire && !CLIPS[est.clip].loop === false ? est.clip : est.clip;
      const L0 = lote('cab_' + tp, e, est.nat, 64, 0), L1 = lote('cab_' + tp, e, est.nat, 64, 1), LO = lote('cab_oficial', e, est.nat, 8, 0), m = META[c], C = T3.CLIPS.jinete[c];
      P.forEach((p, i) => { const b = p.tipo ? LO : (Math.hypot(p.x, p.z) < 12 ? L0 : L1), k = b.add(p.x, 0, p.z, 0, 1, est.nat, C.loop ? c : 'cab_galope' + (J.arma === 'lanza' ? '_lanza' : ''), {phase: (i * 0.137) % 1, bright: Math.random()}); moviles.push([b, k, p]); });
      info.push(`${est.formacion}: ${P.length} puestos · ${tp} · ${c}${C.loop ? '' : ' (clip de un pase: se muestra galope)'}`, 'LOD0 cerca y LOD1 en el resto; avanzan a la velocidad del clip'); dist = 30; az = 0.7; el = 0.35; }
    $('info').innerHTML = info.filter(Boolean).join('<br>');
  }
  ['vista', 'clip', 'tipo', 'nat', 'era', 'formacion'].forEach(k => $(k).onchange = () => { est[k] = $(k).value; montar(); });
  let arr = null; R.domElement.onpointerdown = e => { arr = [e.clientX, e.clientY]; }; root.addEventListener('pointerup', () => { arr = null; });
  R.domElement.onpointermove = e => { if (!arr) return; az -= (e.clientX - arr[0]) * 0.008; el = Math.max(0.02, Math.min(1.3, el + (e.clientY - arr[1]) * 0.006)); arr = [e.clientX, e.clientY]; };
  R.domElement.onwheel = e => { dist = Math.max(3, Math.min(80, dist * (1 + Math.sign(e.deltaY) * 0.1))); e.preventDefault(); };
  montar(); let prev = performance.now(), vivo = true; const m4 = new THREE.Matrix4();
  (function paso() { if (!vivo) return; const now = performance.now(), dt = Math.min(0.1, (now - prev) / 1000); prev = now; const w = cont.clientWidth || innerWidth, h = cont.clientHeight || innerHeight;
    if (R.domElement.width !== Math.round(w * R.getPixelRatio()) || R.domElement.height !== Math.round(h * R.getPixelRatio())) R.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix();
    const C = T3.CLIPS.jinete[est.clip], m = META[est.clip];
    if (est.vista === 'clips') { if ($('play').checked) { reloj += dt; tAct = C.loop ? (reloj / C.dur) % 1 : Math.min(1, (reloj % (C.dur + 1.2)) / C.dur); $('t').value = tAct; } else tAct = +$('t').value;
      sh.timeU.value = tAct * C.dur; const z = C.root ? muestreo(C.root, tAct, 3) : 0; mira.set(0, 1.1, z + (m.pareja ? (m.pareja.desfase[1] - z) * 0.3 : 0)); }
    else if (est.vista === 'escuadron') { reloj += dt; sh.timeU.value = reloj; const v = m && m.avance && C.loop ? m.avance / C.dur : 6;
      moviles.forEach(([b, k, p]) => { m4.makeTranslation(p.x, 0, p.z + v * reloj); b.mesh.setMatrixAt(k, m4); b.mesh.instanceMatrix.needsUpdate = true; }); mira.set(0, 1.0, v * reloj - 6); }
    else { reloj += dt; sh.timeU.value = reloj; }
    cam.position.set(mira.x + Math.sin(az) * Math.cos(el) * dist, mira.y + Math.sin(el) * dist, mira.z + Math.cos(az) * Math.cos(el) * dist); cam.lookAt(mira); R.render(S, cam); requestAnimationFrame(paso); })();
  return {renderer: R, escena: S, camara: cam, montar, estado: est, parar() { vivo = false; R.dispose(); }};
}

const API = {JINETES, CUERPO, AIRES, PORTE, CLIPS, META, CLIPS_S, META_S, TRANSICIONES, rutaTransicion, GRUPOS, formacion, registrar, demoCaballeria, prepararLote, marcar, marcasAleatorias, CRINES, _crear: crear, _ik2: ik2,
  _aux: {resolverPatas, cicloAire, jineteTracks, porteKeys, PATAS, CAB_Y, curva, PTS_CAB, PTS_SOL, apoyar, punto, velocidadClip}};
root.caballeria3d = API;
})(typeof window !== 'undefined' ? window : globalThis);
