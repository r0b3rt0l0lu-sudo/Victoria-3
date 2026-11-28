/* ===== apoyo3d.js — servicios y apoyo 1836–1945 para el modo «Batalla» de Victoria (three.js r152, sin archivos externos) =====
   Amplía troops3d.js sin reemplazar nada; necesita infanteria3d.js, caballeria3d.js y artilleria3d.js cargados antes. registrar(Troops3D, op) añade:
   · SANIDAD: cirujano (mandil, sierra; brazalete de la Cruz Roja desde 1864), practicante, camilleros y camilla con herido (rig propio
     «apo_camilla», a pie entre dos camilleros), mesa de operaciones, herido en la mesa y en el suelo; ambulancia de tracción animal
     (toldo con la cruz desde la era B); camilla a lomo: mula con cacolets (heridos sentados) y con literas (heridos tendidos).
   · INTENDENCIA: carro de suministro con toldo de arcos, carro de bagajes descubierto (baúles, sacos, barriles), conductor en el pescante,
     mulas de carga (munición, víveres, cañón de montaña en dos cargas), mulas de tiro con y sin conductor, arriero que lleva la recua.
   · HERRADORES: fragua de campaña con fuelle de palanca (rig «apo_fragua»), herrero que martillea en el yunque, ayudante al fuelle y herrar
     el casco: el caballo levanta la mano y el herrador la sujeta entre las rodillas (clips emparejados, mismos eventos).
   · PAGADURÍA: mesa del pagador (cofre, libro, monedas), pagador y soldado que cobra (la entrega cae en el mismo instante).
   · PRISIONEROS: sin armas ni equipo, maniatados, con las manos en la cabeza, cojeando y sostenido por un compañero; columna con escoltas a pie
     en los flancos y a caballo en cabeza y cola (formacion('columna_prisioneros', n)) al paso del clip «escoltar_prisionero» (1,15 m/s).
   · BANDERAS: estandartes de regimiento con asta, moharra o remate (águila, corona, punta), corbatas, cordones y borlas, flecos; bandera
     clavada (nacional, de regimiento, banderín y bandera de hospital); portaestandarte a caballo. Todas ondean con el VIENTO del mundo
     (dirección y fuerza en apoyo3d.viento; sin viento cuelgan junto al asta) y se ROMPEN por impactos (agujeros, batiente deshilachado,
     chamuscado: apoyo3d.danarBandera(lote, i, daño)). El sombreador se parchea por lote, como iVar e iCab.
   · MÚSICA: tambor mayor con la maza, bombo, trompeta a caballo; formacion('banda', n) con los tambores, cornetas y gaiteros de infanteria3d.
   · PERROS (opcional): rig «perro» (13 partes): terrier, mastín y perro sanitario (era D), al paso, al trote, al galope, sentado, tumbado, ladrando.
   Fuentes: J. Letterman, «Medical Recollections of the Army of the Potomac» (1866); «Manual for the Medical Department» (EE. UU., 1861/1898);
   Larrey, «Mémoires de chirurgie militaire» (1812–1817); «Regulations for the Army Medical Department» (Reino Unido, 1859); Convenio de Ginebra
   (1864); «Quartermaster's Manual» y «Manual for Army Teamsters» (EE. UU., 1862–1916); «Manual of Horseshoeing» (EE. UU., 1890); «Queen's
   Regulations» (colores de 1858: 4 pies × 3 pies 9 pulgadas, aprox.); «Règlement sur les drapeaux» (Francia, 1880, aprox.); medidas de museo.
   API: registrar(Troops3D, op) · TIPOS · CLIPS · META · CLIPS_S · META_S · ESCENAS · formacion(tipo, n, op) · viento · danarBandera
        TRANSICIONES · rutaTransicion · demoApoyo(cont) */
(function (root) {
'use strict';
const THREE = root.THREE;
const Z = {MAIN: 0, TRIM: 1, ACC: 2, HAT: 3, F1: 4, F2: 5, F3: 6, VEH: 7, FIX: 12};
const C = {madera: 0x7a5232, maderaO: 0x4e3420, maderaC: 0x9a7448, hierro: 0x34363a, acero: 0x8a9096, cuero: 0x5a3a22, cueroN: 0x26201c, lona: 0xd8d0b4, lonaO: 0x9a9272,
  saco: 0xc8b890, rojo: 0xb01818, blanco: 0xece6d6, oro: 0xd8b04a, laton: 0xc8a048, bronce: 0xb08a48, negro: 0x1c1a1a, carbon: 0x1a1816, brasa: 0xe8641c, ascua: 0xffb040,
  piel: 0xe0b48c, venda: 0xe8e2d4, sangre: 0x5a0c0c, verdeO: 0x4a5236, cuerda: 0xb8a070, paja: 0xc8b070, moneda: 0xe0c050, papel: 0xe8e0c8, pano: 0x2e4a32,
  manta: 0x6a6458, mantaR: 0x7a3a2a, agua: 0x4a5a60, amarillo: 0xe0c020, piedra: 0x8a8678, plata: 0xd8dade, gris: 0x6e6e66, perroB: 0xe8e0d0, perroN: 0x2a2420};
const V = {SKIN: 1, PELAJE: 2};
const ERAS = ['A', 'B', 'C', 'D', 'E'];
const D2R = Math.PI / 180;
const sstep = (a, b, t) => { const u = Math.min(1, Math.max(0, (t - a) / (b - a))); return u * u * (3 - 2 * u); };
const lerpK = (keys, t) => { let a = keys[0], b = keys[keys.length - 1]; if (t <= a[0]) return a.slice(1); if (t >= b[0]) return b.slice(1);
  for (let i = 0; i < keys.length - 1; i++) if (t >= keys[i][0] && t <= keys[i + 1][0]) { a = keys[i]; b = keys[i + 1]; break; }
  const u = sstep(a[0], b[0], t); return a.slice(1).map((v, i) => v + (b[i + 1] - v) * u); };
const curva = (N, fn) => { const tr = []; for (let i = 0; i <= N; i++) { const t = i / N, v = fn(t); tr.push([+t.toFixed(5), v[0] || 0, v[1] || 0, v[2] || 0]); } return tr; };
function muestreo(tr, t, k) { if (!tr || !tr.length) return 0; if (tr.length === 1 || t <= tr[0][0]) return tr[0][k]; for (let i = 0; i < tr.length - 1; i++) if (t <= tr[i + 1][0]) { const a = tr[i], b = tr[i + 1], u = (t - a[0]) / Math.max(1e-6, b[0] - a[0]); return a[k] + (b[k] - a[k]) * u; } return tr[tr.length - 1][k]; }
const cruzRoja = e => e >= 'B';                       // Convenio de Ginebra (1864): brazalete y bandera blanca con cruz roja

/* ===================================================================================== */
/* RIGS PROPIOS (≤ 13 partes). Los vehículos usan el rig «armon» de artilleria3d (mismas ruedas de 0,65 m y mismos clips de rodar). */
const RIGS_APO = {
  apo_asta: [['base', -1, [0, 0, 0]], ['asta', 0, [0, 0, 0]]],                                                   // bandera clavada: el asta gira sobre su pie
  apo_fragua: [['base', -1, [0, 0, 0]], ['palanca', 0, [0, 1.02, -0.72]], ['fuelle', 0, [0, 0.66, -0.92]]],        // fragua: palanca del fuelle y tapa del fuelle
  apo_mesa: [['base', -1, [0, 0, 0]], ['objeto', 0, [0, 0.8, 0]]],                                               // mesa de operaciones / del pagador
  apo_camilla: [['camilla', -1, [0, 0, 0]], ['herido', 0, [0, 0.04, 0]]],                                        // camilla (raíz a la altura de las varas) y herido
  perro: [['cuerpo', -1, [0, 0.42, 0]], ['cuello', 0, [0, 0.05, 0.22]], ['cabeza', 1, [0, 0.13, 0.06]], ['mandibula', 2, [0, -0.03, 0.05]], ['cola', 0, [0, 0.05, -0.24]],
    ['manoIz', 0, [0.075, -0.04, 0.18]], ['canaIz', 5, [0, -0.2, 0]], ['manoDe', 0, [-0.075, -0.04, 0.18]], ['canaDe', 7, [0, -0.2, 0]],
    ['pataIz', 0, [0.075, -0.02, -0.2]], ['corvIz', 9, [0, -0.2, 0]], ['pataDe', 0, [-0.075, -0.02, -0.2]], ['corvDe', 11, [0, -0.2, 0]]]
};
// patas del perro (mismo convenio que el caballo de caballeria3d: rx < 0 adelante; caña delantera rx > 0 flexiona; trasera rx < 0)
const PATAS_P = {MI: {up: 'manoIz', low: 'canaIz', piv: [0.075, -0.04, 0.18], a: 0.2, b: 0.2, del: true}, MD: {up: 'manoDe', low: 'canaDe', piv: [-0.075, -0.04, 0.18], a: 0.2, b: 0.2, del: true},
  PI: {up: 'pataIz', low: 'corvIz', piv: [0.075, -0.02, -0.2], a: 0.2, b: 0.22, del: false}, PD: {up: 'pataDe', low: 'corvDe', piv: [-0.075, -0.02, -0.2], a: 0.2, b: 0.22, del: false}};
const PERRO_Y = 0.42;
// cotas de la escena de la camilla (marco de la camilla: centro entre las varas, +z hacia los pies, que van delante)
const CAM = {L: 2.3, X: 0.28, Y: 0.9, delZ: 1.15 + 0.13, trasZ: -1.15 - 0.22};
// cotas de la fragua (marco de la fragua)
const FRA = {yunque: [1.05, 0.76, 0.2], palanca: [0, 1.02, -0.72], mango: -0.85, fuelle: [0, 0.66, -0.92]};

/* ===================================================================================== */
/* GEOMETRÍA */
function crear(T3, INF, CAB, ART) {
const GB = T3._dev.GeoBuilder, xf = T3._dev.xf;
const IDX = r => { const m = {}; (T3.RIGS[r] || RIGS_APO[r]).forEach((p, i) => { m[p[0]] = i; }); return m; };
const PS = INF.P, PJ = CAB.P, PA = IDX('armon'), PF = IDX('apo_fragua'), PM = IDX('apo_mesa'), PC = IDX('apo_camilla'), PT = IDX('apo_asta'), PP = IDX('perro');
// copia una geometría en otra, en otra parte y con una transformación (rotación XYZ en grados, traslado y escala)
function fundir(g, src, part, at, rot, k) {
  k = k || 1; const r0 = rot || null;
  for (let t = 0; t < src.p.length / 9; t++) for (let j = 0; j < 3; j++) { const i = t * 9 + j * 3, v = xf([[src.p[i] * k, src.p[i + 1] * k, src.p[i + 2] * k]], at || [0, 0, 0], r0)[0], n = r0 ? xf([[src.n[i], src.n[i + 1], src.n[i + 2]]], [0, 0, 0], r0)[0] : [src.n[i], src.n[i + 1], src.n[i + 2]];
    g.p.push(v[0], v[1], v[2]); g.n.push(n[0], n[1], n[2]); g.part.push(part); g.zone.push(src.zone[t * 3 + j]); g.col.push(src.col[i], src.col[i + 1], src.col[i + 2]); g.vr.push(src.vr[t * 3 + j]); g.fx.push(src.fx[t * 6 + j * 2], src.fx[t * 6 + j * 2 + 1]); }
  return g;
}
const con = (fn) => { const g = new GB(); fn(g); return g; };
const rueda = (g, part, R, o) => ART.rueda(g, part, R, o || {});

/* ---------- banderas: lámina de dos caras con zonas por disposición (u desde el asta, v desde arriba), flecos que ondulan con ella ---------- */
function zonaB(lay, u, v) {
  switch (lay) {
    case 'vert': return Z.F1 + Math.min(2, Math.floor(u * 3));
    case 'mono': return Z.F1;
    case 'cruz': return Math.abs(u - 0.38) < 0.09 || Math.abs(v - 0.5) < 0.11 ? Z.F2 : Z.F1;
    case 'aspa': return Math.abs(u - v) < 0.13 || Math.abs(u + v - 1) < 0.13 ? Z.F2 : Z.F1;
    case 'disco': return Math.hypot(u - 0.5, (v - 0.5) * 0.66) < 0.21 ? Z.F2 : Z.F1;
    case 'usa': return u < 0.42 && v < 0.54 ? Z.F3 : (Math.floor(v * 7) % 2 ? Z.F2 : Z.F1);
    case 'union': return Math.abs(u - 0.5) < 0.08 || Math.abs(v - 0.5) < 0.1 ? Z.F1 : Math.abs(u - v) < 0.12 || Math.abs(u + v - 1) < 0.12 ? Z.F3 : Z.F2;   // cruz roja, aspas blancas, campo azul (a 7 × 5)
    default: return Z.F1 + Math.min(2, Math.floor(v * 3));
  }
}
// bandera(g, parte, [x, y, z] del ángulo superior junto al asta, ancho, alto, nx, ny, disposición, {fleco, color(u, v) → color FIX, zona(u, v), dosCaras})
// Una sola cara: los tipos con bandera son «dobleCara» (material de dos caras, como el abanderado de troops3d)
function bandera(g, part, at, w, h, nx, ny, lay, o) {
  o = o || {}; const P = (x, y) => [at[0] + x, at[1] + y, at[2]], W = x => [Math.max(0, x) / w, 0];
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const x0 = i / nx * w, x1 = (i + 1) / nx * w, y0 = -j / ny * h, y1 = -(j + 1) / ny * h, u = (i + 0.5) / nx, v = (j + 0.5) / ny;
    const zn = o.zona ? o.zona(u, v) : o.color ? Z.FIX : zonaB(lay, u, v), col = o.color ? o.color(u, v) : C.blanco, a = P(x0, y0), b = P(x1, y0), c = P(x1, y1), d = P(x0, y1);
    g.tri(a, d, c, part, zn, col, 0, W(x0), W(x0), W(x1)); g.tri(a, c, b, part, zn, col, 0, W(x0), W(x1), W(x1));
    if (o.dosCaras) { g.tri(a, c, d, part, zn, col, 0, W(x0), W(x1), W(x0)); g.tri(a, b, c, part, zn, col, 0, W(x0), W(x1), W(x1)); } }
  if (o.fleco) { const f = o.fleco, e = 0.045;                                                               // flecos: en el batiente y abajo (y arriba si o.flecoArriba)
    const tira = (A, B, Ae, Be) => { const wa = W(A[0] - at[0]), wb = W(B[0] - at[0]); g.tri(A, Be, B, part, Z.FIX, f, 0, wa, wb, wb); g.tri(A, Ae, Be, part, Z.FIX, f, 0, wa, wa, wb); if (o.dosCaras) { g.tri(A, B, Be, part, Z.FIX, f, 0, wa, wb, wb); g.tri(A, Be, Ae, part, Z.FIX, f, 0, wa, wb, wa); } };
    for (let j = 0; j < ny; j++) { const y0 = -j / ny * h, y1 = -(j + 1) / ny * h; tira(P(w, y0), P(w, y1), P(w + e, y0), P(w + e, y1)); }
    for (let i = 0; i < nx; i++) { const x0 = i / nx * w, x1 = (i + 1) / nx * w; tira(P(x0, -h), P(x1, -h), P(x0, -h - e), P(x1 + (i === nx - 1 ? e : 0), -h - e)); if (o.flecoArriba) tira(P(x1, 0), P(x0, 0), P(x1, e), P(x0, e)); } }
  return g;
}
// cordones con borlas que cuelgan del remate (fijos al asta)
function borlas(g, part, y, col, largo) { [1, -1].forEach(s => { const L = largo || 0.42; g.strap(part, Z.FIX, col, [[0.02 * s, y, 0.0], [0.05 * s, y - L * 0.5, 0.03], [0.06 * s, y - L, 0.02]], 0.012, [0, 0, 1]);
  g.cyl(part, Z.FIX, col, [0.06 * s, y - L - 0.05, 0.02], 0.028, 0.012, 0.1, 4, {top: true}); }); }
/* estandartes (asta con +Y hacia arriba; pivote en la contera, como el «astil» de infanteria3d: manos en 0,55 y 0,95)
   aguila: Francia 1804–1815 y 1852–1870 (águila dorada sobre zócalo, paño de 0,8 m con flecos y corbata) · colores: Reino Unido (corona y
   león, 1,15 × 0,95 m desde 1858; cordones carmesí y oro) · fahne: Prusia/Austria (moharra con el monograma, paño cuadrado de 1,3 m, cintas)
   · generico: moharra dorada, cordones y borlas · guion: estandarte de caballería (0,6 × 0,55 m) para el asta de jinete (contera en y = −0,9) */
const ESTANDARTES = {
  aguila: {L: 2.42, w: 0.82, h: 0.8, nx: 6, ny: 5, fleco: C.oro},
  colores: {L: 2.8, w: 1.15, h: 0.95, nx: 7, ny: 5, fleco: C.oro},
  fahne: {L: 3.0, w: 1.25, h: 1.2, nx: 7, ny: 5, fleco: C.plata},
  generico: {L: 2.7, w: 1.05, h: 0.9, nx: 7, ny: 5, fleco: C.oro, cordon: C.oro},
  guion: {L: 1.95, y0: -0.9, w: 0.6, h: 0.52, nx: 4, ny: 3, fleco: C.oro, cordon: C.oro},
  nacional: {L: 3.6, w: 1.5, h: 1.0, nx: 8, ny: 6},
  regimiento: {L: 2.9, w: 1.1, h: 0.95, nx: 7, ny: 5, fleco: C.oro, cordon: C.oro},
  banderin: {L: 2.1, w: 0.55, h: 0.4, nx: 4, ny: 2},
  hospital: {L: 3.4, w: 1.2, h: 0.85, nx: 8, ny: 6}
};
function estandarte(g, part, estilo, o) {
  const E = ESTANDARTES[estilo], y0 = E.y0 || 0, top = y0 + E.L, F = Z.FIX, lay = o.flagLayout || 'horiz';
  g.cyl(part, F, estilo === 'fahne' ? C.negro : C.maderaO, [0, (y0 + top) / 2, 0], 0.019, 0.017, E.L, 5);                                  // asta
  g.cyl(part, F, C.laton, [0, y0 + 0.02, 0], 0.022, 0.019, 0.05, 5, {bottom: true});                                                        // regatón
  let yb = top - 0.04;                                                                                                                       // ángulo superior del paño
  if (estilo === 'aguila') { g.box(part, F, C.oro, [0, top + 0.04, 0], [0.09, 0.08, 0.09], {}); g.octa(part, F, C.oro, [0, top + 0.16, 0.01], 0.05, {ry: 0.07});   // zócalo y cuerpo del águila
    [1, -1].forEach(s => g.quad([0.02 * s, top + 0.14, 0.0], [0.13 * s, top + 0.26, -0.02], [0.12 * s, top + 0.12, -0.03], [0.03 * s, top + 0.08, 0.0], part, F, C.oro));   // alas
    g.octa(part, F, C.oro, [0, top + 0.25, 0.04], 0.025); yb = top - 0.02;
    g.strap(part, F, C.blanco, [[0.02, top - 0.03, 0.02], [0.08, top - 0.25, 0.04], [0.06, top - 0.5, 0.03]], 0.06, [0, 0, 1]); g.strap(part, F, C.rojo, [[-0.02, top - 0.03, 0.02], [-0.06, top - 0.3, 0.04], [-0.03, top - 0.52, 0.03]], 0.06, [0, 0, 1]); }   // corbata
  else if (estilo === 'colores') { g.cyl(part, F, C.oro, [0, top + 0.05, 0], 0.035, 0.05, 0.08, 6, {top: true}); g.octa(part, F, C.oro, [0, top + 0.15, 0], 0.045, {ry: 0.06}); g.octa(part, F, C.rojo, [0, top + 0.11, 0], 0.04); }   // corona y león
  else if (estilo === 'fahne') { g.cyl(part, F, C.laton, [0, top + 0.12, 0], 0.035, 0.0, 0.26, 4, {}); g.box(part, F, C.laton, [0, top + 0.02, 0], [0.06, 0.05, 0.03], {});        // moharra
    [[0.03, C.negro], [-0.03, C.blanco]].forEach(([x, c]) => g.strap(part, F, c, [[x, top - 0.02, 0.02], [x * 2, top - 0.45, 0.05], [x * 2.4, top - 0.85, 0.03]], 0.05, [0, 0, 1])); }   // cintas
  else if (estilo === 'hospital' || estilo === 'nacional') g.octa(part, F, C.oro, [0, top + 0.04, 0], 0.045, {ry: 0.05});                    // perilla
  else g.cyl(part, F, C.oro, [0, top + 0.1, 0], 0.03, 0.0, 0.22, 4, {});                                                                      // moharra
  if (E.cordon) borlas(g, part, top - 0.03, E.cordon, estilo === 'guion' ? 0.25 : 0.45);
  const op = {fleco: E.fleco};
  if (estilo === 'hospital') op.color = o.era >= 'B' ? (u, v) => (Math.abs(u - 0.5) < 0.1 && Math.abs(v - 0.5) < 0.32) || (Math.abs(v - 0.5) < 0.13 && Math.abs(u - 0.5) < 0.24) ? C.rojo : C.blanco : () => C.amarillo;
  else if (estilo === 'banderin') op.zona = (u, v) => v < 0.5 ? Z.F1 : Z.F2;
  bandera(g, part, [0.02, yb, 0], E.w, E.h, E.nx, E.ny, estilo === 'colores' && lay === 'union' ? 'union' : lay, op);
  return g;
}

/* ---------- vehículos (rig armon): tren delantero con lanza; caja sobre el «arrastre» (marco del pinzote), ruedas traseras en su eje ---------- */
const AR = ART.ARMON, Wz = (x, y, z) => [x, y - AR.pinzote[1], z - AR.pinzote[2]];          // de cotas de la figura (raíz bajo el eje delantero) al marco del arrastre
function trenDelantero(g, o) {
  const A = PA.avantren, F = Z.FIX, V = Z.VEH;
  [PA.ruedaAI, PA.ruedaAD].forEach(p => rueda(g, p, AR.R, {}));
  g.loft(A, F, C.hierro, [[-0.84, 0.045, 0.045], [0.84, 0.045, 0.045]], 6, {axis: 'x', at: [0, AR.R, 0]});                                  // eje
  g.box(A, V, 0, [0, AR.R + 0.11, 0], [1.25, 0.12, 0.14], {bottom: true});                                                                   // telera
  [1, -1].forEach(s => g.box(A, V, 0, [s * 0.3, AR.R + 0.02, 0.25], [0.07, 0.08, 0.9], {rot: [0, s * 8, 0]}));                                 // tijeras
  g.box(A, V, 0, [0, AR.R + 0.0, 0.55], [1.0, 0.07, 0.07], {});                                                                              // balancín
  g.box(PA.lanza, V, 0, [0, 0, 1.35], [0.08, 0.09, 2.7], {rot: [3, 0, 0]}); g.box(PA.lanza, F, C.hierro, [0, -0.05, 2.7], [0.36, 0.03, 0.04], {});
}
function ruedasTraseras(g) { [PA.ruedaPI, PA.ruedaPD].forEach(p => rueda(g, p, AR.R, {})); g.loft(PA.arrastre, Z.FIX, C.hierro, [[-0.82, 0.045, 0.045], [0.82, 0.045, 0.045]], 6, {axis: 'x', at: [0, AR.ejeP[1], AR.ejeP[2]]}); }
// caja del carro (cotas de la figura): de z1 (delante) a z0 (detrás), suelo a y0, costados de altura hc; o.pescante: asiento delantero
function caja(g, o, z1, z0, y0, hc, ancho) {
  const A = PA.arrastre, V = Z.VEH, F = Z.FIX, L = z1 - z0, zc = (z1 + z0) / 2, w = ancho || 1.1;
  g.box(A, V, 0, Wz(0, y0 + 0.03, zc), [w, 0.06, L], {bottom: true});                                                                        // suelo
  [1, -1].forEach(s => { g.box(A, V, 0, Wz(s * w / 2, y0 + hc / 2, zc), [0.04, hc, L], {}); g.box(A, F, C.hierro, Wz(s * (w / 2 + 0.025), y0 + hc - 0.04, zc), [0.012, 0.04, L], {}); });   // costados y fleje
  g.box(A, V, 0, Wz(0, y0 + hc / 2, z1), [w, hc, 0.04], {}); g.box(A, V, 0, Wz(0, y0 + hc / 2, z0), [w, hc, 0.04], {});                    // testeros
  g.box(A, V, 0, Wz(0, y0 - 0.1, (zc + 0.78 - 0.78) - 0.0), [0.14, 0.14, L * 0.9], {});                                                     // larguero (pértiga)
  [1, -1].forEach(s => g.box(A, F, C.hierro, Wz(s * 0.42, y0 - 0.12, z0 + 0.55), [0.03, 0.3, 0.05], {}));                                     // soportes sobre el eje trasero
  if (o.pescante) { g.box(A, V, 0, Wz(0, y0 + hc + 0.12, z1 - 0.22), [w * 0.95, 0.06, 0.32], {}); g.box(A, V, 0, Wz(0, y0 + hc + 0.32, z1 - 0.38), [w * 0.95, 0.36, 0.04], {});   // asiento y respaldo
    g.box(A, V, 0, Wz(0, y0 + 0.25, z1 + 0.25), [w * 0.9, 0.04, 0.4], {rot: [-35, 0, 0]}); }                                                  // reposapiés
}
// toldo de arcos (sección semielíptica sobre los costados, frunce en los extremos)
function toldo(g, z1, z0, y0, rx, ry, col, cruz) {
  const A = PA.arrastre, F = Z.FIX, n = 8, segs = 3, P = (a, z, k) => Wz(Math.cos(a) * rx * k, y0 + Math.sin(a) * ry * k, z);
  for (let s = 0; s < segs; s++) { const za = z1 - (z1 - z0) * s / segs, zb = z1 - (z1 - z0) * (s + 1) / segs;
    for (let i = 0; i < n; i++) { const a = i / n * Math.PI, b = (i + 1) / n * Math.PI; g.quad(P(a, zb, 1), P(b, zb, 1), P(b, za, 1), P(a, za, 1), A, F, col); g.quad(P(a, za, 0.98), P(b, za, 0.98), P(b, zb, 0.98), P(a, zb, 0.98), A, F, C.lonaO); } }
  [[z1, 0.25], [z0, -0.25]].forEach(([z, d]) => { for (let i = 0; i < n; i++) { const a = i / n * Math.PI, b = (i + 1) / n * Math.PI;              // frunces (boca abierta)
    g.quad(P(a, z, 1), P(a, z + d, 0.62), P(b, z + d, 0.62), P(b, z, 1), A, F, col); g.quad(P(a, z, 1), P(b, z, 1), P(b, z + d, 0.62), P(a, z + d, 0.62), A, F, col); } });
  for (let s = 0; s <= segs; s++) { const z = z1 - (z1 - z0) * s / segs; for (let i = 0; i < n; i++) { const a = i / n * Math.PI, b = (i + 1) / n * Math.PI, e = 0.03;   // arcos
    g.quad(P(a, z - e, 1.012), P(b, z - e, 1.012), P(b, z + e, 1.012), P(a, z + e, 1.012), A, F, C.lonaO); } }
  if (cruz) [1, -1].forEach(s => { const x = s * (rx + 0.012), zc = (z1 + z0) / 2, yc = y0 + ry * 0.35, a = 0.09, b = 0.3;                     // cruz roja en los dos costados
    const Q = (dz0, dy0, dz1, dy1) => { const p = [Wz(x, yc + dy0, zc + dz0), Wz(x, yc + dy0, zc + dz1), Wz(x, yc + dy1, zc + dz1), Wz(x, yc + dy1, zc + dz0)]; g.quad(p[0], p[3], p[2], p[1], A, F, C.rojo); g.quad(p[0], p[1], p[2], p[3], A, F, C.rojo); };
    Q(-a, -b, a, b); Q(-b, -a, -a, a); Q(a, -a, b, a); });
}
function ambulancia(g, o) {
  trenDelantero(g, o); ruedasTraseras(g); const y0 = 1.02, hc = 0.42;
  caja(g, {pescante: true}, 0.05, -3.55, y0, hc, 1.15);
  toldo(g, -0.35, -3.55, y0 + hc, 0.6, 0.62, C.lona, cruzRoja(o.era));
  g.box(PA.arrastre, Z.VEH, 0, Wz(0, y0 + 0.35, -3.6), [1.0, 0.6, 0.04], {});                                                               // portón trasero
  [1, -1].forEach(s => g.box(PA.arrastre, Z.FIX, C.hierro, Wz(s * 0.4, y0 - 0.25, -3.62), [0.05, 0.05, 0.12], {}));                          // estribo
  g.cyl(PA.arrastre, Z.FIX, C.agua, Wz(0.62, y0 + 0.1, -1.0), 0.13, 0.13, 0.4, 6, {top: true, bottom: true});                                 // barril de agua
  g.box(PA.arrastre, Z.FIX, C.maderaO, Wz(-0.66, y0 + 0.1, -1.6), [0.14, 0.24, 0.6], {});                                                    // caja de botiquín
}
function carroSuministro(g, o) {
  trenDelantero(g, o); ruedasTraseras(g); const y0 = 1.02, hc = 0.6;
  caja(g, {pescante: false}, 0.15, -3.45, y0, hc, 1.1); toldo(g, 0.25, -3.55, y0 + hc - 0.05, 0.62, 0.66, o.era >= 'D' ? C.lonaO : C.lona, false);
  g.cyl(PA.arrastre, Z.FIX, C.madera, Wz(0.0, y0 + 0.05, -3.75), 0.12, 0.12, 0.6, 6, {rot: [0, 0, 90], top: true, bottom: true});          // cubo de grasa y pienso atrás
  g.box(PA.arrastre, Z.FIX, C.madera, Wz(0, y0 - 0.15, 0.3), [0.9, 0.3, 0.3], {});                                                           // caja de herramientas (delante)
}
function carroBagaje(g, o) {
  trenDelantero(g, o); ruedasTraseras(g); const y0 = 1.02, hc = 0.5, A = PA.arrastre, F = Z.FIX;
  caja(g, {pescante: true}, 0.15, -3.45, y0, hc, 1.15);
  [[-0.3, -0.75, [0.5, 0.42, 0.7], C.cueroN], [0.28, -0.7, [0.5, 0.36, 0.6], C.maderaO], [0.0, -1.55, [0.9, 0.3, 0.55], C.verdeO], [-0.25, -2.35, [0.55, 0.45, 0.5], C.madera]].forEach(([x, z, s, c]) => g.box(A, F, c, Wz(x, y0 + 0.06 + s[1] / 2, z), s, {}));   // baúles y cajas
  [[0.25, -2.4], [0.3, -2.95], [-0.25, -3.0]].forEach(([x, z]) => g.loft(A, F, C.saco, [[-0.28, 0.15, 0.13], [0, 0.2, 0.16], [0.28, 0.14, 0.12]], 6, {axis: 'z', at: Wz(x, y0 + 0.2, z), capA: true, capB: true}));   // sacos
  g.cyl(A, F, C.madera, Wz(0.25, y0 + 0.62, -1.45), 0.18, 0.18, 0.5, 7, {top: true, bottom: true, rot: [0, 0, 90]});                          // barril
  g.loft(A, F, C.lonaO, [[-0.5, 0.12, 0.12], [0.5, 0.12, 0.12]], 6, {axis: 'x', at: Wz(0, y0 + 0.7, -2.0), capA: true, capB: true});        // tiendas enrolladas
  g.strap(A, F, C.cuerda, [Wz(-0.58, y0 + 0.5, -1.0), Wz(0, y0 + 0.9, -1.4), Wz(0.58, y0 + 0.5, -1.8)], 0.02, [0, 1, 0]);                    // cuerda de amarre
}
// LOD de los vehículos: 1 ≤ 150 triángulos, 2 ≤ 30
function carroLod(o, nivel, toldoSi) {
  const g = new GB(), V = Z.VEH, F = Z.FIX, A = PA.arrastre;
  if (nivel === 2) { g.box(A, V, 0, Wz(0, 1.0, -1.7), [1.15, 0.9, 3.6], {noTop: !!toldoSi, bottom: false}); if (toldoSi) g.box(A, F, C.lona, Wz(0, 1.7, -1.75), [1.2, 0.6, 3.4], {taper: 0.4, noBack: false}); return g; }
  g.box(A, V, 0, Wz(0, 1.25, -1.7), [1.12, 0.5, 3.6], {bottom: true}); g.box(PA.lanza, V, 0, [0, 0, 1.35], [0.08, 0.09, 2.7], {noBack: true});
  if (toldoSi) g.box(A, F, C.lona, Wz(0, 1.85, -1.75), [1.2, 0.7, 3.3], {taper: 0.35});
  [PA.ruedaAI, PA.ruedaAD, PA.ruedaPI, PA.ruedaPD].forEach(p => { g.disc(p, V, 0, [0.04, 0, 0], AR.R, 8, {}); g.disc(p, V, 0, [-0.04, 0, 0], AR.R, 8, {rot: [0, 180, 0]}); });
  return g;
}

/* ---------- fragua de campaña (rig apo_fragua): fogón con brasas, fuelle de palanca, yunque sobre tajo, cubo y caja de herraduras ---------- */
function fragua(g, o) {
  const B = PF.base, F = Z.FIX, V = Z.VEH;
  [[0.62, 0.0], [-0.62, 0.0]].forEach(([x, z]) => fundir(g, con(q => rueda(q, 0, 0.6, {})), B, [x, 0.6, z], x < 0 ? [0, 180, 0] : null));                               // ruedas (quietas)
  g.loft(B, F, C.hierro, [[-0.7, 0.04, 0.04], [0.7, 0.04, 0.04]], 6, {axis: 'x', at: [0, 0.6, 0]});
  g.box(B, V, 0, [0, 0.66, 0.15], [0.95, 0.34, 0.95], {bottom: true});                                                                       // caja (carbón)
  g.box(B, F, C.hierro, [0, 0.89, 0.2], [0.9, 0.12, 0.75], {});                                                                              // fogón de chapa
  g.quad([-0.3, 0.955, 0.42], [0.3, 0.955, 0.42], [0.3, 0.955, -0.02], [-0.3, 0.955, -0.02], B, F, C.brasa);                                 // brasas
  [[-0.12, 0.08], [0.1, 0.25], [0.18, 0.05], [-0.05, 0.32]].forEach(([x, z]) => g.octa(B, F, C.carbon, [x, 0.97, z], 0.04, {ry: 0.02}));
  g.octa(B, F, C.ascua, [0.02, 0.965, 0.18], 0.05, {ry: 0.012});
  g.box(B, F, C.hierro, [0, 1.25, 0.45], [0.06, 0.6, 0.06], {}); g.box(B, F, C.hierro, [0, 1.55, 0.3], [0.5, 0.04, 0.45], {taper: 0.4});     // campana (paraviento)
  g.box(B, V, 0, [0, 0.5, -0.62], [0.7, 0.12, 0.7], {bottom: true});                                                                         // base del fuelle
  [1, -1].forEach(s => g.quad([s * 0.33, 0.56, -0.92], [s * 0.33, 0.56, -0.32], [s * 0.33, 0.68, -0.32], [s * 0.33, 0.68, -0.92], B, F, C.cuero));   // cuero del fuelle (costados)
  g.quad([0.33, 0.56, -0.32], [-0.33, 0.56, -0.32], [-0.33, 0.66, -0.32], [0.33, 0.66, -0.32], B, F, C.cuero);
  g.box(B, V, 0, [0, 0.84, -0.72], [0.08, 0.36, 0.08], {});                                                                                  // poste de la palanca
  g.box(PF.fuelle, V, 0, [0, 0.015, 0.3], [0.68, 0.03, 0.62], {});                                                                           // tapa del fuelle (bisagra atrás)
  g.box(PF.palanca, V, 0, [0, 0.0, -0.3], [0.06, 0.06, 1.15], {}); g.box(PF.palanca, V, 0, [0, 0, FRA.mango], [0.5, 0.045, 0.045], {});     // palanca y travesaño (mango)
  g.box(PF.palanca, F, C.hierro, [0, -0.17, 0.2], [0.03, 0.36, 0.03], {});                                                                   // biela a la tapa
  // yunque sobre tajo, cubo de agua, caja de herraduras
  const Y = FRA.yunque; g.cyl(B, F, C.maderaC, [Y[0], 0.27, Y[2]], 0.2, 0.19, 0.54, 7, {top: true});
  g.box(B, F, C.hierro, [Y[0], Y[1] - 0.1, Y[2]], [0.13, 0.12, 0.2], {}); g.box(B, F, C.hierro, [Y[0], Y[1] - 0.02, Y[2]], [0.16, 0.06, 0.34], {}); g.cyl(B, F, C.hierro, [Y[0], Y[1] - 0.02, Y[2] + 0.26], 0.03, 0.0, 0.18, 4, {rot: [90, 0, 0]});
  g.cyl(B, F, C.madera, [-0.95, 0.2, 0.45], 0.22, 0.24, 0.4, 7, {bottom: true}); g.disc(B, F, C.agua, [-0.95, 0.36, 0.45], 0.2, 7, {rot: [0, 0, 90]});
  g.box(B, F, C.maderaO, [1.0, 0.12, -0.45], [0.4, 0.24, 0.3], {}); [[0.92, -0.45], [1.08, -0.42]].forEach(([x, z]) => g.cyl(B, F, C.hierro, [x, 0.25, z], 0.06, 0.06, 0.015, 6, {top: true}));
  g.box(B, V, 0, [0, 0.25, 0.75], [0.08, 0.5, 0.08], {});                                                                                    // pie delantero (la lanza quitada)
}
function fraguaLod(o, nivel) { const g = new GB(), B = PF.base, V = Z.VEH, F = Z.FIX;
  if (nivel === 2) { g.box(B, V, 0, [0, 0.5, 0], [1.3, 1.0, 1.7], {}); return g; }
  g.box(B, V, 0, [0, 0.6, -0.1], [1.0, 0.7, 1.4], {}); g.quad([-0.3, 0.955, 0.42], [0.3, 0.955, 0.42], [0.3, 0.955, -0.02], [-0.3, 0.955, -0.02], B, F, C.brasa);
  [0.62, -0.62].forEach(x => { g.disc(B, V, 0, [x + 0.04 * Math.sign(x), 0.6, 0], 0.6, 8, {rot: x > 0 ? null : [0, 180, 0]}); });
  g.box(B, F, C.hierro, [FRA.yunque[0], 0.5, FRA.yunque[2]], [0.3, 0.75, 0.35], {}); g.box(PF.palanca, V, 0, [0, 0, -0.3], [0.06, 0.06, 1.15], {noBack: true}); return g; }

/* ---------- mesas (rig apo_mesa) ---------- */
function mesa(g, w, d, hgt, col) { const B = PM.base, F = Z.FIX; g.box(B, F, col || C.maderaC, [0, hgt - 0.03, 0], [w, 0.06, d], {bottom: true});
  [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([a, b]) => g.box(B, F, C.madera, [a * (w / 2 - 0.06), (hgt - 0.06) / 2, b * (d / 2 - 0.06)], [0.06, hgt - 0.06, 0.06], {noTop: true})); }
function mesaCirujano(g, o) {
  const B = PM.base, Ob = PM.objeto, F = Z.FIX; mesa(g, 2.0, 0.75, 0.8);
  g.quad([0.2, 0.802, 0.2], [0.75, 0.802, 0.24], [0.8, 0.802, -0.18], [0.3, 0.802, -0.22], B, F, C.sangre);                                 // mancha
  g.box(Ob, F, C.cueroN, [-0.75, 0.04, 0.42], [0.36, 0.08, 0.2], {}); g.box(Ob, F, C.rojo, [-0.75, 0.082, 0.42], [0.3, 0.004, 0.14], {});   // estuche de instrumentos
  g.cyl(Ob, F, C.plata, [0.7, 0.04, 0.45], 0.13, 0.16, 0.07, 8, {bottom: true}); g.disc(Ob, F, C.sangre, [0.7, 0.07, 0.45], 0.14, 8, {rot: [0, 0, 90]});   // jofaina
  g.cyl(B, F, C.madera, [0.55, 0.17, -0.0], 0.17, 0.2, 0.34, 7, {bottom: true});                                                              // cubo bajo la mesa
  g.cyl(B, F, C.maderaO, [-1.3, 0.22, 0.5], 0.16, 0.16, 0.44, 6, {top: true});                                                                 // tajo / taburete
  g.box(B, F, C.verdeO, [-1.2, 0.12, -0.7], [0.5, 0.24, 0.35], {}); g.box(B, F, C.blanco, [-1.2, 0.245, -0.7], [0.3, 0.01, 0.2], {});        // arcón de sanidad
  [[1.35, 0.6], [1.5, 0.3]].forEach(([x, z]) => g.loft(B, F, C.venda, [[-0.04, 0.05, 0.05], [0.04, 0.05, 0.05]], 6, {axis: 'x', at: [x, 0.05, z], capA: true, capB: true}));   // vendas por el suelo
  if (o.era <= 'C') { g.cyl(B, F, C.madera, [1.05, 1.0, -0.42], 0.02, 0.02, 2.0, 4); g.box(B, F, C.laton, [1.05, 1.85, -0.42], [0.12, 0.18, 0.12], {}); }   // farol en un palo
}
function mesaPagador(g, o) {
  const B = PM.base, Ob = PM.objeto, F = Z.FIX; mesa(g, 1.4, 0.7, 0.76); g.box(B, F, C.pano, [0, 0.765, 0], [1.42, 0.012, 0.72], {}); [1, -1].forEach(s => g.quad([s * 0.71, 0.76, 0.36], [s * 0.71, 0.76, -0.36], [s * 0.71, 0.55, -0.36], [s * 0.71, 0.55, 0.36], B, F, C.pano));   // tapete
  g.box(Ob, F, C.maderaO, [-0.4, 0.1, -0.12], [0.42, 0.2, 0.3], {}); [-0.55, -0.25].forEach(x => g.box(Ob, F, C.hierro, [x, 0.1, -0.12], [0.03, 0.205, 0.305], {}));   // cofre herrado
  g.box(Ob, F, C.papel, [0.15, -0.025, -0.05], [0.42, 0.012, 0.3], {rot: [0, -8, 0]}); g.box(Ob, F, C.negro, [0.15, -0.02, -0.05], [0.01, 0.016, 0.3], {rot: [0, -8, 0]});   // libro abierto
  [[-0.02, 0.04], [0.05, 0.07], [0.42, 0.15]].forEach(([x, z], i) => g.cyl(Ob, F, C.moneda, [x, -0.01 + i * 0.0, z], 0.022, 0.022, 0.04 + 0.02 * i, 6, {top: true}));   // montones de monedas
  g.cyl(Ob, F, C.negro, [0.45, -0.005, -0.15], 0.025, 0.03, 0.05, 5, {top: true});                                                            // tintero
  g.cyl(B, F, C.maderaO, [0, 0.2, -0.62], 0.16, 0.16, 0.4, 6, {top: true});                                                                  // taburete
}
function mesaLod(o, nivel, w, d, h) { const g = new GB(), B = PM.base; g.box(B, Z.FIX, C.maderaC, [0, h / 2, 0], [w, h, d], {noTop: nivel === 2 ? false : false, bottom: false}); return g; }

/* ---------- camilla con herido (rig apo_camilla; varas a lo largo de z, pies del herido hacia +z) ---------- */
function camilla(g, o) {
  const K = PC.camilla, H = PC.herido, F = Z.FIX, L = CAM.L, X = CAM.X;
  [1, -1].forEach(s => { g.cyl(K, F, C.maderaC, [s * X, 0, 0], 0.022, 0.022, L, 5, {rot: [90, 0, 0]});                                       // varas
    [0.82, -0.82].forEach(z => g.box(K, F, C.hierro, [s * X, -0.09, z], [0.025, 0.16, 0.03], {})); });                                           // patas (estribos)
  [0.85, -0.85].forEach(z => g.box(K, F, C.hierro, [0, 0, z], [2 * X, 0.02, 0.02], {}));                                                       // travesaños
  g.quad([X, 0.0, -0.92], [-X, 0.0, -0.92], [-X, -0.03, 0.92], [X, -0.03, 0.92], K, F, C.lonaO); g.quad([X, -0.03, 0.92], [-X, -0.03, 0.92], [-X, 0.0, -0.92], [X, 0.0, -0.92], K, F, C.lonaO);   // lona
  // herido tendido boca arriba (cabeza atrás, en −z): capote, manta en las piernas, vendaje en la cabeza
  g.loft(H, Z.MAIN, 0, [[-0.62, 0.15, 0.08, 0, 0.07], [-0.4, 0.18, 0.1, 0, 0.08], [-0.15, 0.17, 0.095, 0, 0.075], [0.0, 0.16, 0.09, 0, 0.07]], 7, {axis: 'z', capA: true});   // torso
  g.loft(H, Z.FIX, C.piel, [[-0.74, 0.05, 0.05, 0, 0.06], [-0.7, 0.07, 0.07, 0, 0.08]], 6, {axis: 'z', vr: V.SKIN});                         // cuello
  g.loft(H, Z.FIX, C.piel, [[-0.92, 0.07, 0.07, 0, 0.1], [-0.84, 0.095, 0.095, 0, 0.11], [-0.74, 0.08, 0.08, 0, 0.1]], 6, {axis: 'z', capA: true, capB: true, vr: V.SKIN});   // cabeza
  g.loft(H, Z.FIX, C.venda, [[-0.88, 0.1, 0.1, 0, 0.115], [-0.8, 0.1, 0.1, 0, 0.115]], 6, {axis: 'z'});                                      // vendaje
  g.loft(H, Z.FIX, o.manta || C.manta, [[-0.05, 0.2, 0.07, 0, 0.05], [0.4, 0.21, 0.08, 0, 0.06], [0.88, 0.16, 0.06, 0, 0.05]], 7, {axis: 'z', capB: true, p: 2.6});   // manta sobre las piernas
  [1, -1].forEach(s => { g.tube(H, Z.MAIN, 0, [s * 0.19, 0.07, -0.55], [s * 0.21, 0.05, -0.12], [[0, 0.05], [1, 0.042]], 5);                 // brazos a lo largo del cuerpo
    g.octa(H, Z.FIX, C.piel, [s * 0.21, 0.05, -0.06], 0.035, {vr: V.SKIN}); g.box(H, Z.FIX, C.negro, [s * 0.08, 0.08, 0.95], [0.09, 0.12, 0.1], {}); });   // manos y botas
  g.box(H, Z.FIX, C.sangre, [0.06, 0.166, -0.32], [0.12, 0.01, 0.1], {});                                                                      // sangre en el pecho
}
function camillaLod(o, nivel) { const g = new GB(), K = PC.camilla, H = PC.herido, F = Z.FIX;
  if (nivel === 2) { g.box(K, F, C.lonaO, [0, 0.05, 0], [0.6, 0.16, 2.3], {noTop: false}); return g; }
  g.box(K, F, C.lonaO, [0, -0.02, 0], [0.6, 0.04, 2.3], {}); g.box(H, Z.MAIN, 0, [0, 0.08, -0.3], [0.34, 0.16, 0.7], {}); g.box(H, F, C.manta, [0, 0.06, 0.45], [0.38, 0.12, 0.9], {}); g.octa(H, F, C.venda, [0, 0.1, -0.82], 0.1, {}); return g; }

/* ---------- asta clavada (rig apo_asta) ---------- */
function asta(g, estilo, o) { const B = PT.base, F = Z.FIX;
  [[0.12, 0.05], [-0.1, 0.1], [0.04, -0.13], [-0.08, -0.08], [0.13, -0.06]].forEach(([x, z]) => g.octa(B, F, C.piedra, [x, 0.04, z], 0.07, {ry: 0.05}));   // piedras al pie
  estandarte(g, PT.asta, estilo, o); }
function astaLod(estilo, o, nivel) { const g = new GB(), E = ESTANDARTES[estilo], F = Z.FIX;
  g.cyl(PT.asta, F, C.maderaO, [0, E.L / 2, 0], 0.03, 0.03, E.L, 3);
  if (nivel === 1) { const z = estilo === 'hospital' ? F : Z.F1, c = estilo === 'hospital' ? (o.era >= 'B' ? C.blanco : C.amarillo) : 0, a = [0.02, E.L - 0.04, 0], b = [0.02 + E.w, E.L - 0.04, 0], cc = [0.02 + E.w, E.L - 0.04 - E.h, 0], d = [0.02, E.L - 0.04 - E.h, 0];
    g.quad(a, b, cc, d, PT.asta, z, c); }
  return g; }

/* ---------- figuras a pie (rig soldado; prefijo inf_ → variación de infanteria3d) ----------
   Se parte de las opciones de infanteria3d (uniforme por nación y era) y se quita o se añade: mochila, armas, brazalete, mandil, herramientas. */
const FIG = {
  cirujano: {nombre: 'Cirujano militar (mandil y sierra)', base: 'teniente', pal: 'estado_mayor', herr: 'sierra', mandil: true, brazalete: true},
  practicante: {nombre: 'Practicante / enfermero (bolsa de curas)', base: 'soldado', herr: null, brazalete: true, bolsa: true},
  camillero: {nombre: 'Camillero', base: 'soldado', herr: null, brazalete: true},
  herrero: {nombre: 'Herrero / herrador (mandil de cuero, martillo y tenazas)', base: 'soldado', pal: 'artilleria', herr: 'martillo', mandilCuero: true, tenazas: true},
  herrador: {nombre: 'Herrador (mandil de cuero y martillo de herrar)', base: 'soldado', pal: 'artilleria', herr: 'martillo', mandilCuero: true},
  herido: {nombre: 'Herido (sin armas ni mochila, brazo vendado)', base: 'soldado', herr: null, vendaje: true},
  ayudante_herrero: {nombre: 'Ayudante del herrero (fuelle)', base: 'soldado', pal: 'artilleria', herr: null, mandilCuero: true},
  pagador: {nombre: 'Pagador / comisario de guerra', base: 'teniente', pal: 'estado_mayor', herr: 'pluma', cartera: true},
  arriero: {nombre: 'Arriero (lleva la recua del ronzal)', base: 'soldado', pal: 'artilleria', herr: 'latigo'},
  conductor: {nombre: 'Conductor de carro (en el pescante, riendas y látigo)', base: 'soldado', pal: 'artilleria', herr: 'latigo'},
  prisionero: {nombre: 'Prisionero (sin armas ni mochila)', base: 'soldado', herr: null},
  tambor_mayor: {nombre: 'Tambor mayor (maza)', base: 'sargento', herr: 'maza', tocadoAlto: true},
  bombo: {nombre: 'Bombo', base: 'soldado', herr: 'mazo_bombo', bombo: true, musico: 'bombo'},
  estandarte_aguila: {nombre: 'Portaestandarte con águila (Francia, aprox. 1804–1815 y 1852–1870)', base: 'abanderado', estandarte: 'aguila', galones: 2},
  estandarte_colores: {nombre: 'Portaestandarte con los colores del regimiento (corona y león, cordones)', base: 'abanderado', estandarte: 'colores', galones: 3},
  estandarte_fahne: {nombre: 'Portaestandarte con «Fahne» (moharra y cintas)', base: 'abanderado', estandarte: 'fahne', galones: 3},
  estandarte_generico: {nombre: 'Portaestandarte (moharra, cordones y borlas, flecos)', base: 'abanderado', estandarte: 'generico', galones: 3}
};
const HERR = {
  sierra: (g, a) => { g.box(a, Z.FIX, C.madera, [0, 0.05, 0], [0.03, 0.12, 0.055], {bottom: true}); g.box(a, Z.FIX, C.acero, [0, 0.32, 0.015], [0.004, 0.42, 0.075], {taperZ: 0.3}); g.box(a, Z.FIX, C.hierro, [0, 0.32, -0.03], [0.01, 0.42, 0.012], {}); },
  martillo: (g, a) => { g.cyl(a, Z.FIX, C.madera, [0, 0.14, 0], 0.014, 0.014, 0.34, 4); g.box(a, Z.FIX, C.hierro, [0, 0.32, 0.02], [0.035, 0.04, 0.15], {taperZ: -0.2}); },
  pluma: (g, a) => { g.cyl(a, Z.FIX, C.blanco, [0, 0.07, 0], 0.004, 0.012, 0.16, 3); },
  latigo: (g, a) => ART.latigo(g, a),
  maza: (g, a) => { g.cyl(a, Z.FIX, C.maderaO, [0, 0.35, 0], 0.016, 0.016, 1.4, 5); g.octa(a, Z.FIX, C.oro, [0, 1.1, 0], 0.06, {}); g.cyl(a, Z.FIX, C.oro, [0, -0.36, 0], 0.02, 0.012, 0.05, 5, {bottom: true});
    g.strap(a, Z.FIX, C.oro, [[0.02, 1.0, 0], [0.03, 0.7, 0.02], [0.02, 0.4, 0]], 0.012, [0, 0, 1]); g.cyl(a, Z.FIX, C.oro, [0.02, 0.36, 0], 0.024, 0.012, 0.08, 5, {top: true}); },
  mazo_bombo: (g, a) => { g.cyl(a, Z.FIX, C.madera, [0, 0.15, 0], 0.01, 0.01, 0.3, 3); g.octa(a, Z.FIX, C.blanco, [0, 0.32, 0], 0.04, {}); }
};
function figura(clave, era, nat) {
  const F = FIG[clave], base = INF.opciones(F.base, era, nat), M = Object.assign({}, base.mod, {mochila: 'no', rollo: 'ninguno'});
  const o = Object.assign(base, {rango: 'apo_' + clave, mod: M, arma: 'ninguna', bayoneta: false, herr: F.herr, modelo: `apo_${clave}_${nat}_${era}`, clave});
  if (F.tocadoAlto && era <= 'B' && /FRA|GBR|RUS|ESP|GEN|AUT/.test(nat)) o.toc = 'osos';
  if (F.musico) { o.musico = F.musico; o.nidos = true; }
  if (F.estandarte) { o.abanderado = true; o.musico = 'bandera'; o.estandarte = F.estandarte; o.galones = F.galones || 0; if (F.oficial) o.oficial = true; o.modelo += '_' + (o.flagLayout || ''); }
  if (F.mandil) o.mandil = true;
  return o;
}
// brazalete blanco con la cruz roja en el brazo izquierdo (desde 1864)
function brazalete(g) { const a = PS.brazoIz, F = Z.FIX; g.loft(a, F, C.blanco, [[-0.13, 0.066, 0.071], [-0.07, 0.066, 0.071]], 6, {});
  const Q = (y0, y1, z0, z1) => { const p = [[0.068, y0, z0], [0.068, y0, z1], [0.068, y1, z1], [0.068, y1, z0]]; g.quad(p[0], p[1], p[2], p[3], a, F, C.rojo); g.quad(p[0], p[3], p[2], p[1], a, F, C.rojo); };
  Q(-0.124, -0.076, -0.01, 0.01); Q(-0.11, -0.09, -0.026, 0.026); }
function soldadoApo(o) {
  const F = FIG[o.clave], g = INF.soldado(o);
  if (F.brazalete && cruzRoja(o.era)) brazalete(g);
  if (F.bolsa) { g.box(PS.torso, Z.FIX, C.cuero, [0.2, -0.04, 0.06], [0.06, 0.16, 0.2], {bottom: true}); g.strap(PS.torso, Z.FIX, C.cuero, [[-0.16, 0.44, 0.06], [0.0, 0.25, 0.135], [0.18, 0.05, 0.13]], 0.035, [0, 0, 1]); }
  if (F.mandilCuero) { g.quad([-0.16, 0.42, 0.15], [0.16, 0.42, 0.15], [0.18, -0.06, 0.17], [-0.18, -0.06, 0.17], PS.torso, Z.FIX, C.cuero); g.quad([-0.18, 0.0, 0.175], [0.18, 0.0, 0.175], [0.19, -0.48, 0.18], [-0.19, -0.48, 0.18], PS.pelvis, Z.FIX, C.cuero); }
  if (F.tenazas) { [1, -1].forEach(s => g.box(PS.antebrazoIz, Z.FIX, C.hierro, [0.008 * s, -0.5, 0.03], [0.012, 0.42, 0.014], {rot: [0, 0, -2 * s]})); g.box(PS.antebrazoIz, Z.FIX, C.brasa, [0, -0.73, 0.04], [0.025, 0.03, 0.12], {}); }
  if (F.vendaje) { g.loft(PS.antebrazoIz, Z.FIX, C.venda, [[-0.22, 0.05, 0.055], [-0.08, 0.056, 0.062]], 6, {}); g.strap(PS.torso, Z.FIX, C.venda, [[0.15, 0.44, 0.05], [0.0, 0.3, 0.14], [-0.14, 0.1, 0.13]], 0.06, [0, 0, 1]); }   // brazo vendado y cabestrillo
  if (F.cartera) g.box(PS.torso, Z.FIX, C.cueroN, [-0.2, -0.02, 0.05], [0.05, 0.2, 0.26], {bottom: true});
  if (F.bombo) { g.cyl(PS.torso, Z.FIX, C.laton, [0, 0.16, 0.34], 0.31, 0.31, 0.26, 10, {rot: [0, 0, 90], top: true, bottom: true, topColor: 0xe8e0c8});   // bombo (parches a los lados)
    [0.13, -0.13].forEach(x => g.cyl(PS.torso, Z.TRIM, 0, [x, 0.16, 0.34], 0.325, 0.325, 0.03, 10, {rot: [0, 0, 90]})); }
  if (o.herr) HERR[o.herr](g, PS.arma, o);
  if (o.estandarte) estandarte(g, PS.arma, o.estandarte, o);
  return g;
}
function soldadoApoLod(o, l) { const g = INF.lod(o, l);
  if (l === 1 && FIG[o.clave].bombo) g.cyl(PS.torso, Z.FIX, C.laton, [0, 0.16, 0.34], 0.3, 0.3, 0.26, 3, {rot: [0, 0, 90]});
  return g; }

/* ---------- mulas (rig jinete; prefijo cab_ → marcas de caballeria3d) ----------
   Cuerpo «mula» de caballeria3d (8 % más baja si se pone escala 0,92 en add, más estrecha), orejas largas; albarda (basto) con carga. */
function orejasMula(g) { const T = PJ.testa, F = Z.FIX, H = (x, y, z) => xf([[x, y, z]], [0, 0, 0], [50, 0, 0])[0];
  [1, -1].forEach(s => { const b = H(0.05 * s, 0.11, -0.04), a = [b[0] - 0.03 * s, b[1] - 0.01, b[2] + 0.025], c = [b[0] + 0.03 * s, b[1], b[2] - 0.03], p = [b[0] + 0.07 * s, b[1] + 0.27, b[2] - 0.1];
    g.tri(a, c, p, T, F, 0xffffff, 2); g.tri(c, a, p, T, F, 0xffffff, 2); }); }
function albarda(g, o) { const B = PJ.caballo, F = Z.FIX;
  g.loft(B, F, C.lonaO, [[-0.34, 0.26, 0.07, 0, 0.32], [-0.2, 0.28, 0.08, 0, 0.33], [0.2, 0.28, 0.08, 0, 0.33], [0.32, 0.25, 0.07, 0, 0.32]], 8, {axis: 'z', capA: true, capB: true});   // basto
  [0.2, -0.2].forEach(z => [1, -1].forEach(s => g.box(B, F, C.madera, [0.09 * s, 0.47, z], [0.035, 0.26, 0.04], {rot: [0, 0, -32 * s]})));   // aspas (crucetas)
  [1, -1].forEach(s => { g.strap(B, F, C.cueroN, [[0.24 * s, 0.3, 0.0], [0.27 * s, 0.0, 0.05], [0.12 * s, -0.27, 0.06]], 0.06, [s, 0, 0]);   // cincha
    g.strap(B, F, C.cueroN, [[0.22 * s, 0.3, 0.3], [0.21 * s, 0.1, 0.62], [0.1 * s, -0.03, 0.74], [0, -0.05, 0.77]], 0.04, [s, 0, 0.6]);      // pretal
    g.strap(B, F, C.cueroN, [[0.22 * s, 0.3, -0.3], [0.21 * s, 0.12, -0.62], [0.17 * s, 0.0, -0.74]], 0.04, [s, 0, -0.4]); });                 // retranca
  const H = (x, y, z) => xf([[x, y, z]], [0, 0, 0], [50, 0, 0])[0], T = PJ.testa;                                                            // cabezada y ronzal
  [1, -1].forEach(s => g.strap(T, F, C.cuerda, [H(0.08 * s, 0.11, -0.03), H(0.1 * s, 0.02, 0.15), H(0.07 * s, -0.04, 0.38)], 0.02, [s, 0, 0]));
  g.loft(T, F, C.cuerda, [[0.36, 0.07, 0.085], [0.39, 0.07, 0.085]], 6, {axis: 'z', rot: [50, 0, 0], p: 2.2}); }
// figura sentada (cacolet) o tendida (litera), sencilla (≈ 60 triángulos), en el marco del caballo
function heridoSentado(g, at, s) { const B = PJ.caballo, F = Z.FIX, P = (x, y, z) => [at[0] + x * s, at[1] + y, at[2] + z];
  g.box(B, Z.MAIN, 0, P(0, 0.28, 0), [0.3, 0.48, 0.2], {taper: 0.1}); g.octa(B, F, C.piel, P(0, 0.62, 0.01), 0.1, {ry: 0.12, vr: V.SKIN}); g.box(B, Z.HAT, 0, P(0, 0.73, 0), [0.2, 0.06, 0.22], {});
  g.box(B, Z.ACC, 0, P(0, 0.05, 0.18), [0.28, 0.13, 0.4], {}); g.box(B, Z.ACC, 0, P(0, -0.18, 0.38), [0.24, 0.42, 0.11], {}); g.box(B, Z.MAIN, 0, P(0.18, 0.2, 0.08), [0.08, 0.36, 0.1], {rot: [-30, 0, 0]}); g.box(B, F, C.venda, P(-0.18, 0.3, 0.05), [0.09, 0.3, 0.11], {rot: [-60, 0, 0]}); }
function heridoTendido(g, at) { const B = PJ.caballo, F = Z.FIX, P = (x, y, z) => [at[0] + x, at[1] + y, at[2] + z];
  g.box(B, Z.MAIN, 0, P(0, 0.08, 0.35), [0.32, 0.16, 0.7], {}); g.octa(B, F, C.piel, P(0, 0.12, 0.82), 0.1, {vr: V.SKIN}); g.box(B, F, C.manta, P(0, 0.07, -0.45), [0.36, 0.14, 0.9], {}); }
const CARGAS = {
  municion: (g, o) => [1, -1].forEach(s => { [0.15, -0.15].forEach(z => g.box(PJ.caballo, Z.FIX, o.era >= 'C' ? C.verdeO : C.madera, [0.39 * s, 0.2, z], [0.17, 0.32, 0.28], {bottom: true}));
    g.strap(PJ.caballo, Z.FIX, C.cuerda, [[0.3 * s, 0.4, 0.0], [0.48 * s, 0.34, 0.0], [0.48 * s, 0.04, 0.0]], 0.03, [s, 0, 0]); }),
  viveres: (g, o) => { [1, -1].forEach(s => g.loft(PJ.caballo, Z.FIX, C.saco, [[-0.3, 0.13, 0.15], [0, 0.17, 0.19], [0.3, 0.12, 0.14]], 6, {axis: 'z', at: [0.42 * s, 0.18, 0], capA: true, capB: true}));
    g.cyl(PJ.caballo, Z.FIX, C.madera, [0, 0.55, 0], 0.13, 0.13, 0.42, 7, {rot: [90, 0, 0], top: true, bottom: true}); },
  montana_tubo: (g, o) => { const b = o.era <= 'B' ? C.bronce : C.acero; g.loft(PJ.caballo, Z.FIX, b, [[-0.5, 0.1, 0.1], [-0.35, 0.095, 0.095], [0.35, 0.075, 0.075], [0.45, 0.085, 0.085]], 8, {axis: 'z', at: [0, 0.55, 0], capA: true, capB: true});
    g.disc(PJ.caballo, Z.FIX, C.negro, [0, 0.55, 0.452], 0.04, 6, {rot: [0, 90, 0]}); [1, -1].forEach(s => g.box(PJ.caballo, Z.FIX, C.madera, [0.36 * s, 0.25, 0], [0.12, 0.26, 0.4], {bottom: true})); },
  montana_ruedas: (g, o) => { [1, -1].forEach(s => fundir(g, con(q => rueda(q, 0, 0.45, {n: 10, radios: 8})), PJ.caballo, [0.4 * s, 0.25, 0], s < 0 ? [0, 180, 0] : null));
    g.loft(PJ.caballo, Z.FIX, C.hierro, [[-0.45, 0.04, 0.04], [0.45, 0.04, 0.04]], 6, {axis: 'x', at: [0, 0.52, 0]}); },
  cacolet: (g, o) => [1, -1].forEach(s => { const x = 0.5 * s; g.box(PJ.caballo, Z.FIX, C.hierro, [x, -0.08, 0.06], [0.34, 0.03, 0.34], {}); g.box(PJ.caballo, Z.FIX, C.hierro, [0.33 * s, 0.2, 0.06], [0.02, 0.6, 0.3], {});   // silla de hierro y respaldo
    g.box(PJ.caballo, Z.FIX, C.hierro, [x, -0.5, 0.3], [0.3, 0.02, 0.14], {}); heridoSentado(g, [x, -0.06, -0.02], s); }),
  litera: (g, o) => [1, -1].forEach(s => { const x = 0.52 * s; g.box(PJ.caballo, Z.FIX, C.lonaO, [x, 0.06, 0], [0.5, 0.04, 1.9], {}); [1, -1].forEach(t => g.box(PJ.caballo, Z.FIX, C.madera, [x + t * 0.25, 0.1, 0], [0.04, 0.05, 2.1], {}));
    g.box(PJ.caballo, Z.FIX, C.hierro, [0.36 * s, 0.25, 0.5], [0.03, 0.4, 0.03], {}); g.box(PJ.caballo, Z.FIX, C.hierro, [0.36 * s, 0.25, -0.5], [0.03, 0.4, 0.03], {}); heridoTendido(g, [x, 0.08, 0]); })
};
function mulaLod(o, nivel, carga) { const g = new GB(), F = Z.FIX, hc = 0xffffff, hv = 2;
  if (nivel === 2) { g.box(PJ.caballo, F, hc, [0, -0.38, 0.05], [0.38, 1.5, 1.5], {noTop: true, vr: hv}); g.box(PJ.cuello, F, hc, [0, 0.38, 0.24], [0.18, 0.86, 0.34], {rot: [36, 0, 0], taper: 0.2, noTop: true, vr: hv});
    g.box(PJ.caballo, F, carga ? C.lonaO : C.cueroN, [0, 0.3, 0], [carga && /cacolet|litera/.test(carga) ? 1.3 : 0.9, 0.42, 0.7], {noTop: true, noBottom: true}); return g; }
  const g1 = CAB.lod(Object.assign({}, o, {tipo: null}), 1); orejasMula(g1);
  if (carga === 'cacolet' || carga === 'litera') [1, -1].forEach(s => g1.box(PJ.caballo, Z.MAIN, 0, [0.52 * s, 0.25, carga === 'litera' ? 0 : 0.05], carga === 'litera' ? [0.4, 0.2, 1.8] : [0.32, 0.55, 0.36], {noTop: false}));
  else if (carga) [1, -1].forEach(s => g1.box(PJ.caballo, F, carga === 'viveres' ? C.saco : carga === 'municion' ? C.verdeO : C.acero, [0.4 * s, 0.22, 0], [0.2, 0.34, 0.6], {}));
  return g1; }

/* ---------- perros (rig perro): terrier, mastín y perro sanitario (alforjas con la cruz, era D); pelaje con la paleta de capas de troops3d ---------- */
function perro(g, o) {
  const F = Z.FIX, raza = o.raza, mas = raza !== 'terrier', k = mas ? 1.0 : 0.95, capa = raza === 'terrier' ? C.perroB : 0xffffff, vr = raza === 'terrier' ? 0 : V.PELAJE;
  g.loft(PP.cuerpo, F, capa, [[-0.3, 0.05, 0.06, 0, 0.03], [-0.25, 0.09 * k, 0.11, 0, 0.02], [-0.05, 0.1 * k, 0.12, 0, 0.0], [0.12, 0.11 * k, 0.14, 0, -0.01], [0.24, 0.1 * k, 0.12, 0, 0.02], [0.31, 0.06, 0.08, 0, 0.04]], 8, {axis: 'z', capA: true, capB: true, vr});
  if (raza === 'terrier') { g.loft(PP.cuerpo, F, C.perroN, [[-0.18, 0.094, 0.115, 0, 0.025], [0.02, 0.104, 0.125, 0, 0.02]], 8, {axis: 'z', a0: 0.3}); }   // mancha del lomo
  g.loft(PP.cuello, F, capa, [[0, 0.07, 0.075], [0.08, 0.06, 0.065], [0.17, 0.05, 0.055]], 6, {rot: [42, 0, 0], vr});                         // cuello
  g.loft(PP.cuello, F, mas ? C.cueroN : C.rojo, [[0.02, 0.075, 0.08], [0.05, 0.075, 0.08]], 6, {rot: [42, 0, 0]});                             // collar
  const mz = mas ? 0.042 : 0.032;
  g.loft(PP.cabeza, F, capa, [[-0.07, 0.05, 0.05, 0, 0.0], [-0.02, 0.07, 0.07, 0, 0.01], [0.05, 0.06, 0.055, 0, 0.0], [0.08, mz, mz, 0, -0.015], [0.17, mz * 0.85, mz * 0.8, 0, -0.02]], 7, {axis: 'z', capA: true, capB: true, vr});
  g.octa(PP.cabeza, F, C.negro, [0, -0.012, 0.175], 0.018, {});                                                                             // trufa
  [1, -1].forEach(s => { g.tri([0.045 * s, 0.035, 0.05], [0.035 * s, 0.02, 0.07], [0.05 * s, 0.015, 0.05], PP.cabeza, F, C.negro); g.tri([0.045 * s, 0.035, 0.05], [0.05 * s, 0.015, 0.05], [0.035 * s, 0.02, 0.07], PP.cabeza, F, C.negro);   // ojos
    const e = mas ? [[0.04 * s, 0.06, -0.03], [0.08 * s, 0.05, 0.0], [0.09 * s, -0.04, -0.01]] : [[0.035 * s, 0.065, -0.02], [0.06 * s, 0.06, 0.02], [0.07 * s, 0.11, 0.0]];   // orejas (caídas / dobladas)
    g.tri(e[0], e[1], e[2], PP.cabeza, F, raza === 'terrier' ? C.perroN : capa, raza === 'terrier' ? 0 : vr); g.tri(e[0], e[2], e[1], PP.cabeza, F, raza === 'terrier' ? C.perroN : capa, raza === 'terrier' ? 0 : vr); });
  g.box(PP.mandibula, F, capa, [0, -0.01, 0.06], [0.045, 0.02, 0.11], {vr});                                                                   // mandíbula
  g.box(PP.mandibula, F, C.rojo, [0, 0.002, 0.07], [0.03, 0.005, 0.07], {});                                                                    // lengua
  if (raza === 'terrier') g.loft(PP.cola, F, capa, [[0, 0.018, 0.018], [0.1, 0.012, 0.012]], 4, {rot: [-25, 0, 0], capB: true});             // cola corta, alta
  else g.loft(PP.cola, F, capa, [[0, 0.025, 0.025], [0.15, 0.02, 0.02], [0.3, 0.012, 0.012]], 5, {rot: [-135, 0, 0], capB: true, vr});           // cola larga, caída
  [['manoIz', 'canaIz', false], ['manoDe', 'canaDe', false], ['pataIz', 'corvIz', true], ['pataDe', 'corvDe', true]].forEach(([u, l, tr]) => {
    const r = tr ? [0.03, 0.06] : [0.028, 0.045], b = tr ? 0.22 : 0.2;
    g.loft(PP[u], F, capa, [[-0.2, r[0] * k, r[0] * k + 0.005], [-0.08, r[1] * 0.8 * k, r[1] * k], [0.03, r[1] * k, r[1] * k + 0.01]], 5, {vr});
    g.loft(PP[l], F, capa, [[-b + 0.02, 0.018 * k, 0.02], [-0.05, 0.022 * k, 0.026], [0.02, 0.026 * k, 0.03]], 5, {vr});
    g.box(PP[l], F, raza === 'terrier' ? C.perroB : capa, [0, -b + 0.015, 0.02], [0.045 * k, 0.03, 0.065], {bottom: true, vr}); });
  if (raza === 'sanitario') [1, -1].forEach(s => { g.box(PP.cuerpo, F, C.blanco, [0.13 * s, 0.0, 0.05], [0.04, 0.13, 0.2], {}); const x = 0.152 * s;   // alforjas con la cruz
    const Q = (y0, y1, z0, z1) => { const p = [[x, y0, z0], [x, y0, z1], [x, y1, z1], [x, y1, z0]]; g.quad(p[0], p[1], p[2], p[3], PP.cuerpo, F, C.rojo); g.quad(p[0], p[3], p[2], p[1], PP.cuerpo, F, C.rojo); };
    Q(-0.05, 0.05, 0.035, 0.065); Q(-0.015, 0.015, 0.0, 0.1); g.strap(PP.cuerpo, F, C.cuero, [[0.1 * s, 0.12, 0.05], [0.0, 0.14, 0.05]], 0.03, [0, 1, 0]); });
}
function perroLod(o, nivel) { const g = new GB(), F = Z.FIX, capa = o.raza === 'terrier' ? C.perroB : 0xffffff, vr = o.raza === 'terrier' ? 0 : V.PELAJE;
  if (nivel === 2) { g.box(PP.cuerpo, F, capa, [0, -0.1, 0.05], [0.18, 0.42, 0.7], {noBottom: true, vr}); return g; }
  g.box(PP.cuerpo, F, capa, [0, 0, 0], [0.2, 0.24, 0.62], {vr}); g.box(PP.cabeza, F, capa, [0, 0, 0.05], [0.12, 0.12, 0.24], {taperZ: 0.3, vr});
  [['manoIz', 'canaIz'], ['manoDe', 'canaDe'], ['pataIz', 'corvIz'], ['pataDe', 'corvDe']].forEach(([u, l]) => { g.cyl(PP[u], F, capa, [0, -0.1, 0], 0.03, 0.045, 0.22, 3, {vr}); g.cyl(PP[l], F, capa, [0, -0.11, 0], 0.0, 0.025, 0.22, 3, {vr}); });
  g.cyl(PP.cola, F, capa, [0, 0.08, 0], 0.02, 0.0, 0.16, 3, {rot: [o.raza === 'terrier' ? -25 : -135, 0, 0], vr}); return g; }

/* ---------- catálogo ---------- */
const TIPOS = {};
const vehiculo = (nombre, rig, build, lod, eras, extra) => Object.assign({rig, clase: 'apo', pal: 'linea', nombre, eras: eras || ERAS.slice(), o: (era, nat) => ({era, nat: nat || 'GEN', modelo: `${nombre.slice(0, 12)}_${era}`, flagLayout: (T3.NACIONES[nat] || T3.NACIONES.GEN).bandera}), build, lod}, extra || {});
TIPOS.apo_ambulancia = vehiculo('Ambulancia de tracción animal (toldo; cruz roja desde 1864)', 'armon', o => { const g = new GB(); ambulancia(g, o); return g; }, (o, l) => carroLod(o, l, true), null, {modeloK: 'ambu'});
TIPOS.apo_carro_suministro = vehiculo('Carro de suministro con toldo de arcos', 'armon', o => { const g = new GB(); carroSuministro(g, o); return g; }, (o, l) => carroLod(o, l, true));
TIPOS.apo_carro_bagaje = vehiculo('Carro de bagajes (baúles, sacos, barriles)', 'armon', o => { const g = new GB(); carroBagaje(g, o); return g; }, (o, l) => carroLod(o, l, false));
TIPOS.apo_fragua = vehiculo('Fragua de campaña (fuelle de palanca, yunque)', 'apo_fragua', o => { const g = new GB(); fragua(g, o); return g; }, (o, l) => fraguaLod(o, l));
TIPOS.apo_mesa_cirujano = vehiculo('Mesa de operaciones del puesto de socorro', 'apo_mesa', o => { const g = new GB(); mesaCirujano(g, o); return g; }, (o, l) => mesaLod(o, l, 2.0, 0.75, 0.8));
TIPOS.apo_mesa_pagador = vehiculo('Mesa del pagador (cofre, libro, monedas)', 'apo_mesa', o => { const g = new GB(); mesaPagador(g, o); return g; }, (o, l) => mesaLod(o, l, 1.4, 0.7, 0.76));
TIPOS.apo_camilla = vehiculo('Camilla con herido (la llevan dos camilleros)', 'apo_camilla', o => { const g = new GB(); camilla(g, o); return g; }, (o, l) => camillaLod(o, l));
[['nacional', 'Bandera nacional clavada'], ['regimiento', 'Bandera de regimiento clavada (flecos, cordones y borlas)'], ['banderin', 'Banderín de señalización / de compañía'], ['hospital', 'Bandera de hospital (amarilla en A; blanca con cruz roja desde 1864)']].forEach(([k, n]) => {
  TIPOS['apo_bandera_' + k] = Object.assign(vehiculo(n, 'apo_asta', o => { const g = new GB(); asta(g, k, o); return g; }, (o, l) => astaLod(k, o, l)), {bandera: true, dobleCara: true,
    o: (era, nat) => ({era, nat: nat || 'GEN', flagLayout: (T3.NACIONES[nat] || T3.NACIONES.GEN).bandera, modelo: `apoband_${k}_${era}_${k === 'hospital' ? '' : (T3.NACIONES[nat] || T3.NACIONES.GEN).bandera}`})}); });
Object.keys(FIG).forEach(k => { TIPOS['inf_apo_' + k] = {rig: 'soldado', clase: 'inf', pal: FIG[k].pal || 'linea', nombre: FIG[k].nombre, eras: k === 'estandarte_aguila' ? ['A', 'B'] : ERAS.slice(), bandera: !!FIG[k].estandarte, dobleCara: !!FIG[k].estandarte,
  o: (era, nat) => figura(k, era, nat || 'GEN'), build: o => soldadoApo(o), lod: (o, l) => soldadoApoLod(o, l)}; });
// mulas
const MULA = (era, nat, carga) => ({era, nat: nat || 'GEN', cuerpo: 'mula', silla: null, carga, modelo: `mula_${carga || 'sola'}_${era}`});
[['carga', 'municion', 'Mula de carga (cajas de munición)'], ['viveres', 'viveres', 'Mula de víveres (sacos y barril)'], ['montana_tubo', 'montana_tubo', 'Mula con el tubo del cañón de montaña'],
  ['montana_ruedas', 'montana_ruedas', 'Mula con las ruedas y el eje del cañón de montaña'], ['cacolet', 'cacolet', 'Mula con cacolets (dos heridos sentados)'], ['litera', 'litera', 'Mula con literas (dos heridos tendidos)']].forEach(([k, carga, n]) => {
  TIPOS['cab_apo_mula_' + k] = {rig: 'jinete', clase: 'cav', pal: 'linea', nombre: n, eras: ERAS.slice(), escala: 0.92, o: (era, nat) => MULA(era, nat, carga),
    build: o => { const g = new GB(); CAB.caballo(g, o); orejasMula(g); albarda(g, o); CARGAS[carga](g, o); return g; }, lod: (o, l) => mulaLod(o, l, carga)}; });
TIPOS.cab_apo_mula = {rig: 'jinete', clase: 'cav', pal: 'linea', nombre: 'Mula de reata (albarda sin carga)', eras: ERAS.slice(), escala: 0.92, o: (era, nat) => MULA(era, nat, null),
  build: o => { const g = new GB(); CAB.caballo(g, o); orejasMula(g); albarda(g, o); return g; }, lod: (o, l) => mulaLod(o, l, null)};
TIPOS.cab_apo_mula_tiro = {rig: 'jinete', clase: 'cav', pal: 'artilleria', nombre: 'Mula de tiro (arneses, sin conductor)', eras: ERAS.slice(), escala: 0.92, o: (era, nat) => Object.assign(MULA(era, nat, null), {modelo: `mulat_${era}`}),
  build: o => { const g = new GB(); CAB.caballo(g, o); ART.arneses(g, o, false); orejasMula(g); return g; }, lod: (o, l) => mulaLod(o, l, null)};
TIPOS.cab_apo_mula_tiro_conductor = {rig: 'jinete', clase: 'cav', pal: 'artilleria', nombre: 'Mula de tiro con el conductor montado (mula de varas de la izquierda)', eras: ERAS.slice(), escala: 0.92,
  o: (era, nat) => Object.assign(CAB.opciones('conductor', era, nat || 'GEN'), {cuerpo: 'mula', modelo: `mulatc_${nat}_${era}`}),
  build: o => { const g = new GB(); CAB.caballo(g, o); ART.sillaTiro(g); ART.arneses(g, o, true); orejasMula(g); CAB.jinete(g, o); ART.latigo(g, PJ.arma); return g; }, lod: (o, l) => CAB.lod(o, l)};
// jinetes de apoyo: portaestandarte (guion en el asta de jinete; clips «_lanza») y trompeta
TIPOS.cab_apo_portaestandarte = {rig: 'jinete', clase: 'cav', pal: 'caballeria', nombre: 'Portaestandarte de caballería (guion con flecos y borlas)', eras: ERAS.slice(0, 4), bandera: true, dobleCara: true,
  o: (era, nat) => Object.assign(CAB.opciones('portaestandarte', era, nat || 'GEN'), {modelo: `cabpe_${nat}_${era}`}),
  build: o => { const g = new GB(); CAB.caballo(g, o); CAB.arreos(g, o); CAB.jinete(g, o); estandarte(g, PJ.arma, 'guion', o); return g; },
  lod: (o, l) => { const g = CAB.lod(o, l); if (l === 1) { g.cyl(PJ.arma, Z.FIX, C.maderaO, [0, 0.5, 0], 0.02, 0.02, 2.85, 2); g.quad([0.02, 1.9, 0], [0.6, 1.9, 0], [0.6, 1.38, 0], [0.02, 1.38, 0], PJ.arma, Z.F1, 0); } return g; }};
TIPOS.cab_apo_trompeta = {rig: 'jinete', clase: 'cav', pal: 'caballeria', nombre: 'Trompeta de caballería', eras: ERAS.slice(), o: (era, nat) => Object.assign(CAB.opciones('trompeta', era, nat || 'GEN'), {modelo: `cabtr_${nat}_${era}`}),
  build: o => { const g = new GB(); CAB.caballo(g, o); CAB.arreos(g, o); CAB.jinete(g, o); const a = PJ.arma, F = Z.FIX;
    g.cyl(a, F, C.laton, [0, 0.14, 0], 0.008, 0.008, 0.3, 4); g.cyl(a, F, C.laton, [0.0, 0.16, 0.05], 0.009, 0.009, 0.26, 4); g.cyl(a, F, C.laton, [0, 0.33, 0.0], 0.012, 0.06, 0.12, 6); g.octa(a, F, C.laton, [0, -0.02, 0], 0.012);
    g.strap(a, F, C.rojo, [[0, 0.1, 0.03], [0.02, 0.0, 0.1], [0, -0.1, 0.06]], 0.02, [1, 0, 0]); return g; }, lod: (o, l) => CAB.lod(o, l)};
// perros
[['terrier', 'Perro (terrier, mascota del regimiento)', 0.62, ERAS], ['mastin', 'Perro (mastín / perro de guarda)', 1.05, ERAS], ['sanitario', 'Perro sanitario con alforjas (1914–1918)', 1.0, ['D', 'E']]].forEach(([r, n, esc, eras]) => {
  TIPOS['apo_perro_' + r] = {rig: 'perro', clase: 'apo', pal: 'linea', nombre: n, eras: eras.slice(), escala: esc, o: (era, nat) => ({era, nat: nat || 'GEN', raza: r, modelo: `perro_${r}`}),
    build: o => { const g = new GB(); perro(g, o); return g; }, lod: (o, l) => perroLod(o, l)}; });

return {TIPOS, FIG, ESTANDARTES, estandarte, bandera, fundir, IDX};
}

/* ===================================================================================== */
/* ANIMACIONES DE PIEZAS, VEHÍCULOS Y PERROS (datos puros; se copian en registrar). CLIPS[rig][nombre] */
const CLIPS = {}, META = {};
function defC(rig, n, c, m) { (CLIPS[rig] = CLIPS[rig] || {})[n] = c; c.ev = (c.ev || []).sort((a, b) => a[0] - b[0]);
  META[n] = Object.assign({rig, suelo: 'pie', avance: 0, desplazamiento: [0, 0, 0], armaCompatible: ERAS.slice(), transiciones: []}, m || {}); META[n].eventos = c.ev.map(e => e[1]); }
const quieto = () => ({dur: 4, loop: true, still: true, tracks: {}, ev: []});
// banderas clavadas: quieta (el viento lo pone el sombreador) y el asta que cae al suelo (impacto en el asta)
defC('apo_asta', 'apo_asta_quieta', quieto(), {transiciones: ['apo_asta_cae']});
{ const c = {dur: 1.8, loop: false, tracks: {}, ev: [[0, 'impacto'], [0.52, 'golpe_suelo']]};
  c.tracks.asta = curva(60, t => [lerpK([[0, 0], [0.06, -5], [0.52, 86], [0.62, 80], [0.74, 85], [1, 84]], t)[0], 0, 6 * sstep(0.05, 0.5, t)]);
  defC('apo_asta', 'apo_asta_cae', c, {suelo: 'libre', dano: 'asta', transiciones: []}); }
// mesas y fragua
defC('apo_mesa', 'apo_mesa_quieta', quieto());
defC('apo_fragua', 'apo_fragua_reposo', {dur: 4, loop: true, tracks: {palanca: [[0, 8, 0, 0]], fuelle: [[0, -2, 0, 0]]}, ev: []}, {transiciones: ['apo_fragua_trabajo']});
// fuelle: dos golpes de palanca por ciclo (2,4 s); al bajar la palanca por el mango se cierra la tapa y sopla (eventos «soplo» con chispas)
const FUELLE = {dur: 2.4, th: t => 11 * Math.sin(2 * Math.PI * 2 * t)};
{ const c = {dur: FUELLE.dur, loop: true, tracks: {}, ev: [[0.125, 'soplo'], [0.625, 'soplo']]};
  c.tracks.palanca = curva(48, t => [FUELLE.th(t), 0, 0]); c.tracks.fuelle = curva(48, t => [-5 + 0.45 * FUELLE.th(t), 0, 0]);
  defC('apo_fragua', 'apo_fragua_trabajo', c, {sincronizar: true, escena: 'fragua', transiciones: ['apo_fragua_reposo']}); }
// camilla: en marcha (los camilleros rompen el paso: la camilla cabecea un poco), en el suelo, recoger y posar
const CAMILLA = {dur: 1.5, yDel: t => CAM.Y + 0.012 * Math.cos(4 * Math.PI * t), yTras: t => CAM.Y + 0.012 * Math.cos(4 * Math.PI * t + Math.PI), suelo: 0.25};
{ const c = {dur: CAMILLA.dur, loop: true, tracks: {}, ev: []}, N = 48;
  c.root = curva(N, t => [0, (CAMILLA.yDel(t) + CAMILLA.yTras(t)) / 2, 0]); c.tracks.camilla = curva(N, t => [-Math.atan2(CAMILLA.yDel(t) - CAMILLA.yTras(t), CAM.L) / D2R, 0, 0]);
  c.tracks.herido = curva(N, t => [0, 0, 1.2 * Math.sin(2 * Math.PI * t)]);
  defC('apo_camilla', 'apo_camilla_marcha', c, {suelo: 'libre', avance: 1.0, escena: 'camilla', sincronizar: true, transiciones: ['apo_camilla_posar']}); }
defC('apo_camilla', 'apo_camilla_suelo', {dur: 4, loop: true, root: [[0, 0, CAMILLA.suelo, 0]], tracks: {herido: [[0, 0, 0, 0], [0.5, 0, 0, 2], [1, 0, 0, 0]]}, ev: []}, {suelo: 'libre', escena: 'camilla', transiciones: ['apo_camilla_recoger']});
// recoger (4 s): agarrar a 0,35, levantar entre 0,4 y 0,72 (los pies, delante, suben un poco antes); posar: lo mismo al revés
const RECOGER = {agarra: 0.35, sube: [0.4, 0.72], y: u => CAMILLA.suelo + (CAM.Y - CAMILLA.suelo) * sstep(0.4, 0.72, u), pitch: u => -3 * Math.sin(Math.PI * sstep(0.4, 0.72, u))};
const yHandle = (u, del) => RECOGER.y(u) + (del ? 1 : -1) * Math.sin(-RECOGER.pitch(u) * D2R) * CAM.L / 2;
[['recoger', u => u], ['posar', u => 1 - u]].forEach(([n, pr]) => { const c = {dur: 4, loop: false, tracks: {}, ev: n === 'recoger' ? [[0.35, 'agarrar'], [0.4, 'levantar'], [0.72, 'arriba']] : [[0.28, 'bajar'], [0.6, 'en_suelo'], [0.65, 'soltar']]};
  c.root = curva(80, t => [0, RECOGER.y(pr(t)), 0]); c.tracks.camilla = curva(80, t => [RECOGER.pitch(pr(t)), 0, 0]);
  defC('apo_camilla', 'apo_camilla_' + n, c, {suelo: 'libre', escena: 'camilla', sincronizar: true, transiciones: n === 'recoger' ? ['apo_camilla_marcha'] : ['apo_camilla_suelo']}); });

/* ---------- perros: patas por cinemática inversa de dos segmentos (como el caballo) ---------- */
const rotX = (p, deg) => { const c = Math.cos(deg * D2R), s = Math.sin(deg * D2R); return [p[0], p[1] * c - p[2] * s, p[1] * s + p[2] * c]; };
function ik2p(dz, dy, a, b, del) { let d = Math.hypot(dz, dy); d = Math.min(a + b - 1e-4, Math.max(Math.abs(a - b) + 1e-3, d));
  const phi = Math.atan2(dz, -dy), al = Math.acos(Math.min(1, Math.max(-1, (a * a + d * d - b * b) / (2 * a * d)))), be = Math.acos(Math.min(1, Math.max(-1, (a * a + b * b - d * d) / (2 * a * b))));
  return del ? [-(phi + al) / D2R, (Math.PI - be) / D2R] : [-(phi - al) / D2R, -(Math.PI - be) / D2R]; }
// cuerpo(t) → {y (sobre PERRO_Y; null = la más alta que deja llegar a las patas de apoyo), pitch, apoyo}; pata(k, t) → [z, y] de la almohadilla
function patasPerro(c, N, cuerpo, pata) {
  const tr = {}; Object.values(PATAS_P).forEach(L => { tr[L.up] = []; tr[L.low] = []; }); const root = [], body = [];
  for (let i = 0; i <= N; i++) { const t = i / N, B = cuerpo(t); let y = B.y;
    if (y == null) { y = B.base || 0; Object.entries(PATAS_P).forEach(([k, L]) => { if (!B.apoyo[k]) return; const p = pata(k, t), pv = rotX(L.piv, B.pitch || 0), dz = pv[2] - p[0], R = (L.a + L.b) * 0.97;
      y = Math.min(y, p[1] + Math.sqrt(Math.max(0, R * R - dz * dz)) - (PERRO_Y + pv[1])); }); if (B.vuelo != null) y = Math.max(y, B.vuelo); }
    root.push([+t.toFixed(5), 0, y, 0]); body.push([+t.toFixed(5), B.pitch || 0, B.yaw || 0, B.roll || 0]);
    Object.entries(PATAS_P).forEach(([k, L]) => { const p = pata(k, t), pv = rotX(L.piv, B.pitch || 0), w = rotX([0, p[1] - (PERRO_Y + y + pv[1]), p[0] - pv[2]], -(B.pitch || 0)), a = ik2p(w[2], w[1], L.a, L.b, L.del);
      tr[L.up].push([+t.toFixed(5), a[0], 0, 0]); tr[L.low].push([+t.toFixed(5), a[1], 0, 0]); }); }
  Object.assign(c.tracks, tr); c.tracks.cuerpo = body; c.root = root; return c;
}
const AIRES_P = {paso: {T: 0.6, v: 0.9, d: 0.62, f: {PI: 0, MI: 0.25, PD: 0.5, MD: 0.75}, ag: 1.0, h: 0.06, sus: 0, pitch: 1},
  trote: {T: 0.42, v: 2.0, d: 0.45, f: {MI: 0, PD: 0, MD: 0.5, PI: 0.5}, ag: 0.85, h: 0.08, sus: 0.012, pitch: 1.5},
  galope: {T: 0.32, v: 6.0, d: 0.3, f: {PI: 0, PD: 0.1, MD: 0.42, MI: 0.52}, ag: 0.6, h: 0.1, sus: 0.035, pitch: 6}};
function pataAire(A, k, t) { const L = PATAS_P[k], s = (((t - A.f[k]) % 1) + 1) % 1, st = A.v * A.T * A.d * A.ag, z0 = L.piv[2];
  if (s < A.d) return [z0 + st / 2 - st * s / A.d, 0]; const u = (s - A.d) / (1 - A.d), e = u * u * (3 - 2 * u); return [z0 - st / 2 + st * e, A.h * Math.sin(Math.PI * u)]; }
function perroAire(n, ciclos) { const A = AIRES_P[n], N = 40 * ciclos, c = {dur: A.T * ciclos, loop: true, tracks: {}, ev: []}, ap = (k, t) => (((t * ciclos - A.f[k]) % 1) + 1) % 1 < A.d;
  const pf = t => A.pitch * Math.sin(2 * Math.PI * t * ciclos * (n === 'galope' ? 1 : 2));
  patasPerro(c, N, t => ({y: null, base: -0.005, pitch: pf(t), apoyo: {MI: ap('MI', t), MD: ap('MD', t), PI: ap('PI', t), PD: ap('PD', t)}}), (k, t) => pataAire(A, k, t * ciclos));
  // en la suspensión (galope) la raíz sigue un arco entre el despegue y la recepción
  const R = c.root, air = R.map(r => !['MI', 'MD', 'PI', 'PD'].some(k => ap(k, r[0]))); for (let i = 0; i < R.length; i++) if (air[i]) { let a = i, b = i; while (a > 0 && air[a]) a--; while (b < R.length - 1 && air[b]) b++; const u = (i - a) / Math.max(1, b - a); R[i][2] = R[a][2] + (R[b][2] - R[a][2]) * u + A.sus * 4 * u * (1 - u); }
  if (air.some(Boolean)) { const yA = t => R[Math.min(R.length - 1, Math.round(t * N))][2]; patasPerro(c, N, t => ({y: yA(t), pitch: pf(t)}), (k, t) => pataAire(A, k, t * ciclos)); }
  c.tracks.cuello = curva(N, t => [3 * Math.sin(2 * Math.PI * t * ciclos * 2), 0, 0]); c.tracks.cabeza = curva(N, t => [-2 * Math.sin(2 * Math.PI * t * ciclos * 2 + 0.5), 0, 0]);
  c.tracks.cola = curva(N, t => [n === 'galope' ? 30 : 0, 25 * Math.sin(2 * Math.PI * t * ciclos * 3), 0]); c.tracks.mandibula = [[0, n === 'galope' ? 12 : 3, 0, 0]];
  Object.keys(PATAS_P).forEach(k => { for (let i = 0; i < ciclos; i++) c.ev.push([((A.f[k] + i) / ciclos) % 1, 'pisada']); });
  defC('perro', 'perro_' + n, c, {suelo: n === 'galope' ? 'carrera' : 'pie', avance: A.v, aire: n, transiciones: ['perro_parado'].concat(Object.keys(AIRES_P).filter(x => x !== n).map(x => 'perro_' + x))}); }
Object.keys(AIRES_P).forEach(n => perroAire(n, n === 'galope' ? 2 : 2));
const fijas = {MI: [0.18, 0], MD: [0.18, 0], PI: [-0.2, 0], PD: [-0.2, 0]}, todas = {MI: true, MD: true, PI: true, PD: true};
// parado: respira, mueve la cola y mira alrededor
{ const c = {dur: 4, loop: true, tracks: {}, ev: [[0.5, 'mira']]}, N = 60; patasPerro(c, N, t => ({y: null, base: -0.01, pitch: 0.6 * Math.sin(2 * Math.PI * t * 3), apoyo: todas}), k => fijas[k]);
  c.tracks.cuello = curva(N, t => [-6 + 4 * sstep(0.4, 0.5, t) * (1 - sstep(0.7, 0.8, t)), 25 * Math.sin(2 * Math.PI * t), 0]); c.tracks.cabeza = curva(N, t => [4, 0, 8 * Math.sin(2 * Math.PI * t * 2)]);
  c.tracks.cola = curva(N, t => [10, 30 * Math.sin(2 * Math.PI * t * 8), 0]); c.tracks.mandibula = curva(N, t => [6 + 4 * Math.sin(2 * Math.PI * t * 6), 0, 0]);
  defC('perro', 'perro_parado', c, {transiciones: ['perro_paso', 'perro_trote', 'perro_sentado', 'perro_ladrar', 'perro_tumbado']}); }
// ladrar: patas abiertas, la cabeza da un golpe y la mandíbula se abre en cada ladrido
{ const c = {dur: 1.6, loop: true, tracks: {}, ev: [[0.1, 'ladrido'], [0.35, 'ladrido'], [0.62, 'ladrido']]}, N = 64, lad = t => [0.1, 0.35, 0.62].reduce((a, t0) => a + Math.max(0, Math.sin(Math.PI * (t - t0 + 0.02) / 0.12)) * (t > t0 - 0.02 && t < t0 + 0.1 ? 1 : 0), 0);
  patasPerro(c, N, t => ({y: null, base: -0.03, pitch: -3 + 2 * lad(t), apoyo: todas}), k => k[0] === 'M' ? [0.24, 0] : [-0.22, 0]);
  c.tracks.cuello = curva(N, t => [-14 + 10 * lad(t), 0, 0]); c.tracks.cabeza = curva(N, t => [-6 + 8 * lad(t), 0, 0]); c.tracks.mandibula = curva(N, t => [4 + 30 * lad(t), 0, 0]); c.tracks.cola = curva(N, t => [35, 10 * Math.sin(2 * Math.PI * t * 4), 0]);
  defC('perro', 'perro_ladrar', c, {transiciones: ['perro_parado']}); }
// sentado (el cuerpo se levanta 38°; los cuartos traseros doblados) y tumbado (manos adelante)
{ const c = {dur: 5, loop: true, tracks: {}, ev: []}, N = 50, pitch = -38;
  patasPerro(c, N, t => ({y: null, base: -0.11, pitch, apoyo: {MI: true, MD: true, PI: false, PD: false}}), k => k[0] === 'M' ? [0.16, 0] : [-0.06, 0]);
  c.tracks.cuello = curva(N, t => [30 + 3 * Math.sin(2 * Math.PI * t), 20 * Math.sin(2 * Math.PI * t), 0]); c.tracks.cabeza = curva(N, () => [10, 0, 0]); c.tracks.cola = curva(N, t => [80, 15 * Math.sin(2 * Math.PI * t * 4), 0]); c.tracks.mandibula = curva(N, t => [8 + 3 * Math.sin(2 * Math.PI * t * 5), 0, 0]);
  defC('perro', 'perro_sentado', c, {suelo: 'sentado', transiciones: ['perro_parado', 'perro_tumbado']}); }
{ const c = {dur: 6, loop: true, tracks: {}, ev: []}, N = 40;
  patasPerro(c, N, t => ({y: -0.25, pitch: 0, apoyo: {}}), k => k[0] === 'M' ? [0.42, 0] : [-0.04, 0]);
  c.tracks.cuello = curva(N, t => [-30, 10 * Math.sin(2 * Math.PI * t), 0]); c.tracks.cabeza = curva(N, () => [30, 0, 0]); c.tracks.cola = curva(N, t => [100, 10 * Math.sin(2 * Math.PI * t * 2), 0]);
  defC('perro', 'perro_tumbado', c, {suelo: 'tendido', transiciones: ['perro_sentado', 'perro_parado']}); }

/* ===================================================================================== */
/* CLIPS DEL JINETE (caballo y mula) Y DEL SOLDADO: se construyen en registrar, con la cinemática de troops3d y las herramientas de infanteria3d
   y caballeria3d. Escenas: las figuras de una escena comparten origen y rumbo (el de la pieza: mesa, fragua, camilla, caballo herrado). */
const CLIPS_J = {}, META_J = {}, CLIPS_S = {}, META_S = {}, ESCENAS = {};
function clipsJinete(CABm) {
  const X = CABm._aux, PATAS = X.PATAS, cv = X.curva;
  // herrar: el caballo descansa la mano izquierda doblada (casco atrás y arriba, a 0,5 m) sobre los muslos del herrador
  { const N = 80, c = {dur: 4, loop: true, tracks: {}, ev: [[0.2, 'clavo'], [0.28, 'clavo'], [0.36, 'clavo'], [0.6, 'clavo'], [0.68, 'clavo'], [0.76, 'clavo'], [0.92, 'resopla']]};
    X.resolverPatas(c, N, t => ({z: 0, pitch: 0.4 * Math.sin(2 * Math.PI * t), roll: -1.5, apoyo: {MI: false, MD: true, PI: true, PD: true}}), (k, t) => k === 'MI' ? [-0.02, 0.56] : [PATAS[k].piv[2] + (PATAS[k].del ? 0.03 : -0.02), 0]);
    c.tracks.cuello = cv(N, t => [6 + 3 * Math.sin(2 * Math.PI * t), 10 * Math.sin(2 * Math.PI * t), 0]); c.tracks.testa = cv(N, t => [4, -8, 0]); c.tracks.cola = cv(N, t => [8, 0, 20 * Math.sin(2 * Math.PI * (t - 0.8) * 5) * sstep(0.78, 0.8, t) * (1 - sstep(0.9, 0.98, t))]);
    X.jineteTracks(c, N, 'nada', {}); CLIPS_J.cab_herrar = c; META_J.cab_herrar = {suelo: 'pie', avance: 0, desplazamiento: [0, 0, 0], armaCompatible: ERAS.slice(), transiciones: ['cab_parado'], escena: 'herrar', pareja: {clip: 'apo_herrar_casco', desfase: [0, 0, 0]}}; }
  // trompeta a caballo: toque de 3 s (el caballo parado) con la trompeta a la boca
  CABm.PORTE.trompeta = [[-72, 0, -14], [-112, 0, 0], 92];
  { const N = 60, c = {dur: 3, loop: true, tracks: {}, ev: [[0.15, 'nota'], [0.25, 'nota'], [0.35, 'nota'], [0.5, 'nota'], [0.6, 'nota'], [0.7, 'respira']]};
    X.resolverPatas(c, N, () => ({z: 0, pitch: 0, apoyo: {MI: true, MD: true, PI: true, PD: true}}), k => [PATAS[k].piv[2] + (PATAS[k].del ? 0.02 : -0.02), 0]);
    c.tracks.cuello = cv(N, t => [-2 + 2 * Math.sin(2 * Math.PI * t), 4 * Math.sin(2 * Math.PI * t), 0]); c.tracks.cola = cv(N, t => [8, 0, 6 * Math.sin(2 * Math.PI * t)]);
    X.jineteTracks(c, N, X.porteKeys([[0, 'nada'], [0.1, 'trompeta'], [0.8, 'trompeta'], [0.95, 'nada'], [1, 'nada']]), {inc: -3, cabeza: () => [-6, 0, 0]});
    CLIPS_J.cab_apo_trompeta_tocar = c; META_J.cab_apo_trompeta_tocar = {suelo: 'pie', avance: 0, desplazamiento: [0, 0, 0], armaCompatible: ERAS.slice(), transiciones: ['cab_parado'], tipo: 'cab_apo_trompeta'}; }
  // paso de escolta: 1,15 m/s (como la columna de prisioneros y «escoltar_prisionero»), cadencia de 1,3 s
  { CABm.AIRES.paso_escolta = Object.assign({}, CABm.AIRES.paso, {T: 1.3, v: 1.15}); const c = X.cicloAire('paso_escolta', 2); X.jineteTracks(c, 80, 'sable_hombro', {inc: 2, amortigua: 0.01, ciclos: 2, frec: 2});
    const m = c.meta; delete c.meta; delete m.apoyo; CLIPS_J.cab_apo_paso_escolta = c; META_J.cab_apo_paso_escolta = Object.assign({suelo: 'pie', desplazamiento: [0, 0, 0], armaCompatible: ERAS.slice(), transiciones: ['cab_parado', 'cab_paso'], velocidad: 1.15}, m); }
  Object.values(CLIPS_J).forEach(c => { c.ev.sort((a, b) => a[0] - b[0]); }); Object.entries(META_J).forEach(([n, m]) => { m.eventos = CLIPS_J[n].ev.map(e => e[1]); });
}

function clipsSoldado(T3, INFm) {
  const H = INFm._herramientas, PS = INFm.POSES, W = PS.W, con = H.con, mas = H.mas;
  const IXS = {}; T3.RIGS.soldado.forEach((p, i) => { IXS[p[0]] = i; });
  const eul = new THREE.Euler(), q1 = new THREE.Quaternion(), q2 = new THREE.Quaternion(), Y = new THREE.Vector3(0, 1, 0);
  // orientar: la pelvis lleva el rumbo y la postura propia de la pelvis se compone después (rama de Euler que conserva el rumbo)
  const orientar = (pose, yaw) => { const p = pose.pelvis || [0, 0, 0]; if (!p[0] && !p[1] && !p[2]) return Object.assign({}, pose, {pelvis: [0, yaw, 0]});
    q1.setFromEuler(eul.set(p[0] * D2R, p[1] * D2R, p[2] * D2R, 'XYZ')); q2.setFromAxisAngle(Y, yaw * D2R).multiply(q1); eul.setFromQuaternion(q2, 'XYZ');
    const a = [eul.x / D2R, eul.y / D2R, eul.z / D2R], b = [a[0] + 180, 180 - a[1], a[2] + 180], dist = v => Math.abs((((v - yaw) % 360) + 540) % 360 - 180);
    const sel = dist(b[1]) < dist(a[1]) ? b : a; sel[1] = yaw + ((((sel[1] - yaw) % 360) + 540) % 360 - 180); return Object.assign({}, pose, {pelvis: sel}); };
  // posturas base (sin inclinación de la pelvis: la inclinación va en el torso)
  const PIE = con(PS.FIRME, {brazoIz: [-6, 0, 8], antebrazoIz: [-14, 0, 0], brazoDe: [-6, 0, -8], antebrazoDe: [-14, 0, 0]});
  const INCL = (a, b) => con(PIE, Object.assign({torso: [a, 0, 0], cabeza: [-a * 0.5, 0, 0]}, b || {}));
  const AGACH = (b) => con(PIE, Object.assign({musloIz: [-72, 0, 10], piernaIz: [108, 0, 0], pieIz: [-30, 0, 0], musloDe: [-58, 0, -10], piernaDe: [100, 0, 0], pieDe: [-36, 0, 0], torso: [30, 0, 0], cabeza: [-20, 0, 0]}, b || {}));
  const CUCLI = (tor, b) => con(PIE, Object.assign({musloIz: [-108, 0, 16], piernaIz: [142, 0, 0], pieIz: [-34, 0, 0], musloDe: [-102, 0, -16], piernaDe: [138, 0, 0], pieDe: [-34, 0, 0], torso: [tor, 0, 0], cabeza: [-tor * 0.6, 0, 0]}, b || {}));
  const RODI = (b) => con(PS.RODILLA, Object.assign({brazoIz: [-20, 0, 10], antebrazoIz: [-40, 0, 0], brazoDe: [-20, 0, -10], antebrazoDe: [-40, 0, 0]}, b || {}));
  const SENT = (b) => con(PIE, Object.assign({pelvis: [-70, 0, 0], torso: [52, 0, 0], musloIz: [-20, 0, 10], musloDe: [-20, 0, -10], piernaIz: [20, 0, 0], piernaDe: [20, 0, 0], pieIz: [-30, 0, 0], pieDe: [-30, 0, 0]}, b || {}));
  const TEND = (b) => con(PS.TUMBADO_ESP, Object.assign({brazoIz: [-8, 0, 16], antebrazoIz: [-12, 0, 0], brazoDe: [-8, 0, -16], antebrazoDe: [-12, 0, 0]}, b || {}));
  const nrm = v => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; }, add = (a, b, k) => a.map((v, i) => v + b[i] * (k == null ? 1 : k)), sub = (a, b) => a.map((v, i) => v - b[i]);
  const giraY = (p, yaw) => { const c = Math.cos(yaw * D2R), s = Math.sin(yaw * D2R); return [p[0] * c + p[2] * s, p[1], -p[0] * s + p[2] * c]; };
  // desfase de medio ciclo de un bucle (camilleros que rompen el paso)
  const desfasar = (c, d) => Object.keys(c.tracks).forEach(k => { const u = []; c.tracks[k].map(q => [+((((q[0] + d) % 1) + 1) % 1).toFixed(6)].concat(q.slice(1))).sort((a, b) => a[0] - b[0])
    .forEach(q => { if (u.length && Math.abs(u[u.length - 1][0] - q[0]) < 1e-6) u[u.length - 1] = q; else u.push(q); }); if (u[0][0] > 1e-6) u.unshift([0].concat(u[u.length - 1].slice(1))); u.push([1].concat(u[0].slice(1))); c.tracks[k] = u; });
  // punto de una parte de un clip ya construido (CLIPS_S o del jinete) en el instante t
  const punto = (rig, set, clip, parte, local, t) => { const S = T3.CLIPS[rig], tmp = '__apo_pt', had = S[clip]; S[tmp] = had || set[clip]; const M = T3.poseTroop(rig, tmp, t), o = T3.RIGS[rig].findIndex(p => p[0] === parte) * 16; delete S[tmp];
    return [0, 1, 2].map(j => M[o + j] * local[0] + M[o + 4 + j] * local[1] + M[o + 8 + j] * local[2] + M[o + 12 + j]); };

  /* ---------- Serv: clip del soldado en el marco de la escena (raíz = posición, pelvis = rumbo); herramientas en el mundo → espacio del torso ---------- */
  function Serv(dur, loop) { this.C = new H.Clip(dur, loop !== false); this.herr = []; this.vis = []; this.dur = dur; }
  Serv.prototype.en = function (t, x, z, yaw, pose) { if (this.yaw0 != null) { while (yaw - this.yaw0 > 180) yaw -= 360; while (yaw - this.yaw0 < -180) yaw += 360; } this.yaw0 = yaw;
    const o = orientar(pose, yaw); if (this.pv) o.pelvis = o.pelvis.map((v, i) => { while (v - this.pv[i] > 180) v -= 360; while (v - this.pv[i] < -180) v += 360; return v; }); this.pv = o.pelvis;
    this.C.k(t, o); this.C.r(t, x, 0, z); return this; };
  Serv.prototype.h = function (t, p, dir, g) { this.herr.push([t, p, dir, g]); return this; };
  Serv.prototype.manos = function (t, pR, pL) { const d = sub(pL, pR); return this.h(t, pR, d, [0, Math.hypot(...d)]); };            // herramienta invisible entre las dos manos
  Serv.prototype.mano = function (t, p) { return this.h(t, p, [0, 1, 0], [0, -1]); };
  Serv.prototype.ver = function (t, v) { this.vis.push([t, v ? 1 : 0]); return this; };
  Serv.prototype.e = function (t, n) { this.C.e(t, n); return this; };
  Serv.prototype.fin = function (nombre, meta) {
    meta = meta || {}; const c = this.C.fin(), NA = Math.max(120, Math.round(this.dur * 40)), sobre = meta.sobre || 0, libre = meta.suelo === 'libre' && !sobre;
    const asent = () => { if (libre) return; H.asentar(T3, nombre, c, {suelo: 'pie'}, NA); if (sobre) c.root.forEach(k => { k[2] = +(k[2] + sobre).toFixed(4); }); };
    if (!c.root) c.root = [[0, 0, 0, 0]]; asent(); const S = T3.CLIPS.soldado, tmp = '__apo3d_tmp';
    if (this.herr.length && !meta.sinAcercar) {   // si las manos no llegan, la figura se acerca (se desplaza la raíz), no la herramienta
      S[tmp] = c; const Mt = new THREE.Matrix4(), sh = new THREE.Vector3(), adds = [];
      this.herr.forEach(([t, p, dir, g]) => { Mt.fromArray(T3.poseTroop('soldado', tmp, t), IXS.torso * 16); let dx = 0, dz = 0, peor = 0;
        [[g[0], -0.205], [g[1], 0.205]].forEach(([y, sx]) => { if (y < 0) return; sh.set(sx, 0.435, 0).applyMatrix4(Mt); const G = add(p, nrm(dir), y), d = [G[0] - sh.x, G[1] - sh.y, G[2] - sh.z], ex = Math.hypot(...d) - 0.52;
          if (ex > peor) { const h = Math.hypot(d[0], d[2]) || 1; peor = ex; dx = d[0] / h * ex; dz = d[2] / h * ex; } });
        if (peor > 0.005) adds.push([t, dx, dz]); });
      delete S[tmp];
      if (adds.length) { const off = t => { let w = 0, x = 0, z = 0; adds.forEach(([ta, ax, az]) => { const k = Math.max(0, 1 - Math.abs(t - ta) * this.dur / 0.6); if (k > 0) { w += k; x += ax * k; z += az * k; } }); return w > 0 ? [x / Math.max(1, w), z / Math.max(1, w)] : [0, 0]; };
        const base = c.root.slice(); c.root = base.map(([t, x, y, z]) => { const o = off(t); return [t, x + o[0], y, z + o[1]]; }); asent(); }
    }
    if (this.herr.length) {   // herramienta al espacio del torso (FK de troops3d con la raíz ya asentada)
      S[tmp] = c; const M = new THREE.Matrix4(), Tw = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(1, 1, 1), P = [], R = [], G = []; let prev = null;
      this.herr.sort((a, b) => a[0] - b[0]).forEach(([t, p, dir, g]) => { M.fromArray(T3.poseTroop('soldado', tmp, t), IXS.torso * 16).invert();
        q.setFromUnitVectors(Y, new THREE.Vector3(...nrm(dir))); Tw.compose(new THREE.Vector3(...p), q, sc).premultiply(M);
        const pos = new THREE.Vector3(), qq = new THREE.Quaternion(); Tw.decompose(pos, qq, new THREE.Vector3()); e.setFromQuaternion(qq, 'XYZ'); let r = [e.x / D2R, e.y / D2R, e.z / D2R];
        if (prev) r = r.map((v, i) => { while (v - prev[i] > 180) v -= 360; while (v - prev[i] < -180) v += 360; return v; }); prev = r;
        P.push([t, +pos.x.toFixed(4), +pos.y.toFixed(4), +pos.z.toFixed(4)]); R.push([t].concat(r.map(v => +v.toFixed(3)))); G.push([t].concat(g)); });
      delete S[tmp]; c.tracks.armaP = P; c.tracks.armaR = R; c.tracks.agarre = G; H.alcanzar(T3, c, 0.56);
      if (meta.objetivo !== false) meta.objetivos = this.herr.map(([t, p, dir, g]) => [t, g[0] >= 0 ? add(p, nrm(dir), g[0]) : null, g[1] >= 0 ? add(p, nrm(dir), g[1]) : null]);   // para las pruebas: dónde deben estar las manos
    }
    if (this.vis.length) c.hide = Object.assign(c.hide || {}, {arma: this.vis.sort((a, b) => a[0] - b[0])});
    c.ev.sort((a, b) => a[0] - b[0]); CLIPS_S[nombre] = c;
    META_S[nombre] = Object.assign({suelo: 'pie', avance: 0, desplazamiento: [0, 0, 0], armaCompatible: ERAS.slice(), transiciones: []}, meta); META_S[nombre].eventos = c.ev.map(x => x[1]);
    return c; };
  // clip sencillo sin herramientas en el mundo (Clip de infanteria3d) con asentado
  const simple = (nombre, C, meta) => { const c = C.fin(); H.alcanzar(T3, c, 0.56); if (!meta || meta.suelo !== 'libre') H.asentar(T3, nombre, c, {suelo: 'pie'}, Math.max(96, Math.round(c.dur * 40)));
    CLIPS_S[nombre] = c; META_S[nombre] = Object.assign({suelo: 'pie', avance: 0, desplazamiento: [0, 0, 0], armaCompatible: ERAS.slice(), transiciones: []}, meta || {}); META_S[nombre].eventos = c.ev.map(x => x[1]); return c; };
  const t24 = (n, f) => { for (let i = 0; i <= n; i++) f(i / n, i); };

  /* ---------- 1. mesa de operaciones (marco de la mesa: largo en x, 0,8 m de alto; el herido boca arriba con la cabeza hacia −x) ---------- */
  { const s = new Serv(6), B = TEND(), K = [[0, {}], [0.3, {torso: [-4, 0, 6], cabeza: [30, 30, 0], musloIz: [-35, 0, 8], piernaIz: [60, 0, 0], brazoIz: [-30, 0, 34]}], [0.42, {cabeza: [22, -18, 0], musloIz: [-22, 0, 8], piernaIz: [40, 0, 0]}],
      [0.7, {}], [0.82, {cabeza: [30, 26, 0], brazoIz: [-26, 0, 28]}], [1, {}]];
    K.forEach(([t, p]) => s.en(t, 0.05, 0, 90, con(B, p))); s.e(0.3, 'queja').e(0.82, 'queja'); s.ver(0, false);
    s.fin('apo_herido_en_mesa', {suelo: 'libre', sobre: 0.8, escena: 'mesa', tipo: 'inf_apo_herido', transiciones: []}); }
  { const T = punto('soldado', CLIPS_S, 'apo_herido_en_mesa', 'musloDe', [0, -0.24, 0.02], 0), d = nrm([0, -0.12, -1]), s = new Serv(6), X0 = [T[0], T[1], T[2] + 0.62];
    const P0 = INCL(34, {cabeza: [22, 0, 0], brazoIz: [-62, 0, 12], antebrazoIz: [-30, 0, 0]}), reposo = add(T, [0.05, 0.28, 0.32]);
    [0, 0.3, 0.55, 0.62, 0.75, 1].forEach(t => s.en(t, X0[0] + 0.1, X0[2], 180, t === 0.75 ? con(P0, {cabeza: [10, -40, 0], torso: [24, -12, 0]}) : P0));
    s.h(0, reposo, [0, 0.35, -1], [0.04, -1]).h(0.08, reposo, [0, 0.35, -1], [0.04, -1]);
    for (let t = 0.12; t <= 0.581; t += 0.02) { const k = 0.07 * Math.sin(2 * Math.PI * (t - 0.12) / 0.1); s.h(+t.toFixed(3), add(add(T, d, -0.3), [0, 0.03, 0], 1).map((v, i) => v + d[i] * k), d, [0.04, -1]); }
    [0.145, 0.245, 0.345, 0.445, 0.545].forEach(t => s.e(t, 'corte')); s.h(0.66, reposo, [0, 0.35, -1], [0.04, -1]).h(1, reposo, [0, 0.35, -1], [0.04, -1]); s.e(0.75, 'pide');
    s.fin('apo_cirujano_operar', {escena: 'mesa', tipo: 'inf_apo_cirujano', pareja: {clip: 'apo_herido_en_mesa', desfase: [0, 0, 0]}, transiciones: ['apo_cirujano_examinar']}); }
  { const s = new Serv(6), P0 = INCL(42, {cabeza: [30, 0, 0]}), ts = [0, 0.15, 0.3, 0.42, 0.55, 0.7, 0.82, 0.92, 1];
    ts.forEach(t => s.en(t, -1.32, 0, 90, t === 0.3 || t === 0.82 ? INCL(50, {cabeza: [34, 0, 0]}) : P0));
    ts.forEach(t => { const R = add(punto('soldado', CLIPS_S, 'apo_herido_en_mesa', 'brazoDe', [0, 0, 0], t), [0, 0.07, 0]), L = add(punto('soldado', CLIPS_S, 'apo_herido_en_mesa', 'brazoIz', [0, 0, 0], t), [0, 0.07, 0]); s.manos(t, R, L); });
    s.e(0.3, 'sujetar').e(0.82, 'sujetar'); s.ver(0, false);
    s.fin('apo_ayudante_sujetar', {escena: 'mesa', tipo: 'inf_apo_practicante', pareja: {clip: 'apo_herido_en_mesa', desfase: [0, 0, 0]}, transiciones: []}); }
  // examinar a un herido tendido en el suelo (5 s): el cirujano de rodillas a su derecha, las manos en el pecho
  { const s = new Serv(5); [0, 0.25, 0.5, 0.75, 1].forEach((t, i) => s.en(t, 0.05, 0, 90, TEND({torso: [i % 2 ? -3 : 0, 0, 0], cabeza: [30, i === 2 ? 25 : 10, 0]}))); s.e(0.5, 'queja'); s.ver(0, false);
    s.fin('apo_herido_tendido', {escena: 'herido', tipo: 'inf_apo_herido', transiciones: []}); }
  { const s = new Serv(5), ts = [0, 0.25, 0.5, 0.75, 1]; ts.forEach((t, i) => s.en(t, -0.3, 0.6, 180, con(PIE, {musloIz: [-78, 0, 10], piernaIz: [150, 0, 0], pieIz: [-40, 0, 0], musloDe: [-78, 0, -10], piernaDe: [150, 0, 0], pieDe: [-40, 0, 0], torso: [40 + (i % 2) * 6, 0, 0], cabeza: [26, 0, 0]})));   // de rodillas, sentado sobre los talones
    ts.forEach(t => { const a = punto('soldado', CLIPS_S, 'apo_herido_tendido', 'torso', [0.09, 0.3, 0.14], t), b = punto('soldado', CLIPS_S, 'apo_herido_tendido', 'torso', [-0.09, 0.3, 0.14], t); const [R, L] = a[0] > b[0] ? [a, b] : [b, a]; s.manos(t, R, L); });
    s.ver(0, false); s.e(0.3, 'examina'); s.fin('apo_cirujano_examinar', {escena: 'herido', tipo: 'inf_apo_cirujano', pareja: {clip: 'apo_herido_tendido', desfase: [0, 0, 0]}, transiciones: ['apo_cirujano_operar']}); }

  /* ---------- 2. camilleros (marco de la camilla; los pies del herido delante, +z) ---------- */
  [['del', CAM.delZ, CAMILLA.yDel, CAM.L / 2, 2], ['tras', CAM.trasZ, CAMILLA.yTras, -CAM.L / 2, 8]].forEach(([n, z, yh, zh, inc]) => {
    const s = new Serv(CAMILLA.dur); H.zancada(s.C, 19, 22, inc, 'ninguno', {}); if (n === 'tras') desfasar(s.C.c, 0.5);
    s.C.r(0, 0, 0, z).r(1, 0, 0, z); t24(24, t => s.h(t, [-CAM.X, yh(t), zh], [1, 0, 0], [0, 2 * CAM.X])); s.ver(0, false);
    s.fin('apo_camilla_' + n + '_marcha', {avance: 1.0, escena: 'camilla', tipo: 'inf_apo_camillero', sincronizar: true, pareja: {clip: 'apo_camilla_' + (n === 'del' ? 'tras' : 'del') + '_marcha', desfase: [0, 0, 0]}, transiciones: ['apo_camilla_' + n + '_posar']}); });
  // recoger y posar: cada extremo de la camilla sube al ritmo del hombro de su camillero (medido con la cinemática), no con una curva fija
  const poseRec = (del, u) => H.mezcla(PIE, del ? CUCLI(14) : CUCLI(42), sstep(0.15, 0.33, u) * (1 - sstep(0.4, 0.72, u))), alt = {};
  [['del', CAM.delZ, true], ['tras', CAM.trasZ, false]].forEach(([n, z, del]) => { const C = new H.Clip(4, false); t24(40, u => { C.k(u, poseRec(del, u)); C.r(u, 0, 0, z); }); const c = C.fin(); H.asentar(T3, '__apo_h', c, {suelo: 'pie'}, 160);
    T3.CLIPS.soldado.__apo_h = c; const ys = []; t24(80, u => { const M = T3.poseTroop('soldado', '__apo_h', u), o = IXS.torso * 16; ys.push(M[o + 5] * 0.435 + M[o + 13]); }); delete T3.CLIPS.soldado.__apo_h;
    const lin = u => { const f = u * 80, i = Math.min(79, Math.floor(f)); return ys[i] + (ys[i + 1] - ys[i]) * (f - i); }, a = lin(RECOGER.agarra), b = lin(0.72);
    alt[n] = u => u <= RECOGER.agarra ? CAMILLA.suelo : CAMILLA.suelo + (CAM.Y - CAMILLA.suelo) * Math.min(1, Math.max(0, (lin(u) - a) / (b - a))); });
  [['recoger', u => u], ['posar', u => 1 - u]].forEach(([acc, pr]) => { const c = T3.CLIPS.apo_camilla['apo_camilla_' + acc];
    c.root = curva(80, t => [0, (alt.del(pr(t)) + alt.tras(pr(t))) / 2, 0]); c.tracks.camilla = curva(80, t => [-Math.atan2(alt.del(pr(t)) - alt.tras(pr(t)), CAM.L) / D2R, 0, 0]); CLIPS.apo_camilla['apo_camilla_' + acc] = c;
    [['del', CAM.delZ, true], ['tras', CAM.trasZ, false]].forEach(([n, z, del]) => { const s = new Serv(4, false), zh = (del ? 1 : -1) * CAM.L / 2;
      t24(40, t => { const u = pr(t); s.en(t, 0, z, 0, poseRec(del, u)); s.h(t, [-CAM.X, alt[n](u), zh], [1, 0, 0], u >= RECOGER.agarra - 0.02 ? [0, 2 * CAM.X] : [-1, -1]); });
      if (acc === 'recoger') s.e(0.35, 'agarrar').e(0.4, 'levantar').e(0.72, 'arriba'); else s.e(0.28, 'bajar').e(0.6, 'en_suelo').e(0.65, 'soltar'); s.ver(0, false);
      s.fin(`apo_camilla_${n}_${acc}`, {escena: 'camilla', tipo: 'inf_apo_camillero', sincronizar: true, transiciones: acc === 'recoger' ? [`apo_camilla_${n}_marcha`] : []}); }); });

  /* ---------- 3. fragua: ayudante al fuelle y herrero en el yunque (marco de la fragua) ---------- */
  { const s = new Serv(FUELLE.dur); t24(24, t => { const th = FUELLE.th(t), y = FRA.palanca[1] - FRA.mango * Math.sin(th * D2R), z = FRA.palanca[2] + FRA.mango * Math.cos(th * D2R);
      s.en(t, 0, -1.84, 0, INCL(12 - 0.7 * th, {cabeza: [-4, 0, 0], musloIz: [-14, 0, 4], piernaIz: [12, 0, 0]})); s.h(t, [-0.2, y, z], [1, 0, 0], [0, 0.4]); });
    s.ver(0, false); s.e(0.125, 'soplo').e(0.625, 'soplo');
    s.fin('apo_ayudante_fuelle', {escena: 'fragua', tipo: 'inf_apo_ayudante_herrero', sincronizar: true, pareja: {clip: 'apo_fragua_trabajo', desfase: [0, 0, 0]}, transiciones: []}); }
  { const s = new Serv(FUELLE.dur), Yq = [FRA.yunque[0], FRA.yunque[1] + 0.03, FRA.yunque[2]], gs = add(Yq, nrm([0.62, 0.35, -0.3]), 0.32), golpes = [0.1, 0.35, 0.6, 0.85];
    const P0 = INCL(24, {brazoIz: [-48, 0, 14], antebrazoIz: [-38, 0, 0], musloDe: [8, 0, -4], musloIz: [-14, 0, 6]});
    t24(24, t => s.en(t, 1.64, 0.2, -90, con(P0, {torso: [24 + 6 * Math.max(...golpes.map(g => Math.exp(-Math.pow((t - g) * 30, 2)))), 0, 0]})));
    golpes.forEach(g => { const alto = add(Yq, [0.42, 0.62, -0.3]); s.h(g - 0.12, alto, [-0.25, 0.92, 0.1], [0.03, -1]).h(g - 0.03, add(Yq, [0.5, 0.42, -0.32]), [-0.6, 0.5, 0.15], [0.03, -1]).h(g, gs, sub(Yq, gs), [0.03, -1]).h(g + 0.04, add(gs, [0.03, 0.06, 0]), sub(Yq, gs), [0.03, -1]);
      s.e(g, 'golpe').e(g + 0.005, 'chispas'); });
    s.h(0, add(Yq, [0.42, 0.62, -0.3]), [-0.25, 0.92, 0.1], [0.03, -1]).h(1, add(Yq, [0.42, 0.62, -0.3]), [-0.25, 0.92, 0.1], [0.03, -1]);
    s.fin('apo_herrero_martillar', {escena: 'fragua', tipo: 'inf_apo_herrero', sincronizar: true, transiciones: []}); }

  /* ---------- 4. herrar: el herrador sujeta la mano izquierda del caballo entre las rodillas (marco del caballo) ---------- */
  { const cas = punto('jinete', CLIPS_J, 'cab_herrar', 'canaIz', [0, -0.56, 0.04], 0), pz = add(cas, [0.02, 0.02, -0.03]), gs = add(pz, nrm([0.2, 0.42, 0.3]), 0.32), s = new Serv(4);
    const P0 = con(PIE, {musloIz: [-50, 0, 12], piernaIz: [62, 0, 0], pieIz: [-14, 0, 0], musloDe: [-44, 0, -12], piernaDe: [56, 0, 0], pieDe: [-14, 0, 0], torso: [52, 0, 0], cabeza: [18, 0, 0], brazoIz: [-55, 0, 6], antebrazoIz: [-50, 0, 0]});
    const golpes = [0.2, 0.28, 0.36, 0.6, 0.68, 0.76];
    t24(40, t => s.en(t, cas[0] + 0.3, cas[2] + 0.3, 200, con(P0, {torso: [52 + 3 * Math.max(...golpes.map(g => Math.exp(-Math.pow((t - g) * 40, 2)))), 0, 0]})));
    const alto = add(pz, [0.12, 0.36, 0.32]); s.h(0, alto, [0, 1, 0.2], [0.03, -1]).h(0.12, alto, [0, 1, 0.2], [0.03, -1]);
    golpes.forEach(g => { s.h(g - 0.035, add(gs, [0.04, 0.12, 0.06]), sub(pz, gs), [0.03, -1]).h(g, gs, sub(pz, gs), [0.03, -1]); s.e(g, 'clavo'); });
    s.h(0.45, alto, [0, 1, 0.2], [0.03, -1]).h(0.5, alto, [0, 1, 0.2], [0.03, -1]).h(0.85, alto, [0, 1, 0.2], [0.03, -1]).h(1, alto, [0, 1, 0.2], [0.03, -1]);
    s.fin('apo_herrar_casco', {escena: 'herrar', tipo: 'inf_apo_herrador', sincronizar: true, pareja: {clip: 'cab_herrar', desfase: [0, 0, 0], rig: 'jinete'}, casco: cas.map(v => +v.toFixed(3)), transiciones: []}); }

  /* ---------- 5. pagaduría (marco de la mesa del pagador: el pagador detrás, el soldado delante; entrega a 0,5) ---------- */
  { const PE = [0.05, 0.9, 0.12], s = new Serv(5), libro = [0.16, 0.78, -0.04], mon = [-0.02, 0.79, 0.04];
    const SILLA = (a, b) => con(PIE, Object.assign({musloIz: [-86, 0, 8], piernaIz: [86, 0, 0], pieIz: [0, 0, 0], musloDe: [-86, 0, -8], piernaDe: [86, 0, 0], pieDe: [0, 0, 0], torso: [a, 0, 0], cabeza: [-a * 0.3, 0, 0]}, b || {}));   // sentado en el taburete
    const P0 = SILLA(26, {brazoIz: [-40, 0, 18], antebrazoIz: [-62, 0, 0], cabeza: [18, 0, 0]});
    [0, 0.3, 0.45, 0.55, 0.7, 1].forEach(t => s.en(t, 0.02, -0.56, 0, t === 0.45 || t === 0.55 ? SILLA(20, {cabeza: [-4, 0, 0]}) : P0));
    [[0, libro], [0.1, add(libro, [0.04, 0, 0.03])], [0.2, libro], [0.28, add(libro, [0.03, 0, 0.02])], [0.33, add(mon, [0, 0.06, 0])], [0.38, mon], [0.5, PE], [0.55, PE], [0.64, add(libro, [0, 0.06, 0])], [0.72, libro], [0.85, add(libro, [0.05, 0, 0.02])], [1, libro]]
      .forEach(([t, p]) => s.h(t, p, [0.1, 0.4, 1], [0.02, -1])); s.ver(0, true).ver(0.31, false).ver(0.66, true); s.e(0.38, 'coge_monedas').e(0.5, 'entrega').e(0.8, 'anota');
    s.fin('apo_pagador_pagar', {escena: 'pagaduria', tipo: 'inf_apo_pagador', sincronizar: true, pareja: {clip: 'apo_soldado_cobrar', desfase: [0, 0, 0]}, transiciones: []});
    const r = new Serv(5), Q = PIE, SAL = con(PS.FIRME, {brazoDe: [-110, 0, -70], antebrazoDe: [-125, 0, 0], cabeza: [-4, 0, 0]});
    [[0, Q], [0.1, SAL], [0.22, SAL], [0.3, Q], [0.45, INCL(30)], [0.56, INCL(30)], [0.66, con(Q, {brazoDe: [-20, 0, -12], antebrazoDe: [-80, 0, 0]})], [0.76, SAL], [0.88, SAL], [1, Q]].forEach(([t, p]) => r.en(t, 0.08, 0.72, 180, p));
    r.h(0.38, add(PE, [0, -0.25, 0.25]), [0, 0, 1], [-1, -1]).h(0.42, add(PE, [0, -0.1, 0.12]), [0, 0, 1], [0, -1]).h(0.5, PE, [0, 0, 1], [0, -1]).h(0.56, PE, [0, 0, 1], [0, -1]).h(0.6, add(PE, [0, -0.1, 0.12]), [0, 0, 1], [-1, -1]);
    r.ver(0, false); r.e(0.1, 'saludo').e(0.5, 'entrega').e(0.76, 'saludo');
    r.fin('apo_soldado_cobrar', {escena: 'pagaduria', tipo: 'inf_soldado', sincronizar: true, pareja: {clip: 'apo_pagador_pagar', desfase: [0, 0, 0]}, transiciones: ['idle']}); }

  /* ---------- 6. arriero (al paso de la mula: 2,2 s y 1,7 m/s como «cab_paso»), conductor en el pescante ---------- */
  { const C = new H.Clip(2.2, true); H.zancada(C, 25, 24, 4, 'iz', {braceo: 16});
    // dos pasos por pierna en 2,2 s: se rehace con las claves comprimidas a dos ciclos
    const c0 = C.c; Object.keys(c0.tracks).forEach(k => { const tr = c0.tracks[k].slice(0, 17); c0.tracks[k] = tr.map(q => [q[0] / 2].concat(q.slice(1))).concat(tr.slice(1).map(q => [0.5 + q[0] / 2].concat(q.slice(1)))); });
    c0.ev = [[0, 'pisada_iz'], [0.25, 'pisada_de'], [0.5, 'pisada_iz'], [0.75, 'pisada_de']];
    [0, 0.5, 1].forEach(t => C.k(t, {brazoDe: [-38, 0, -30], antebrazoDe: [-46, 0, 0], arma: [150, 0, 0]}));
    simple('apo_arriero_guiar', C, {avance: 1.7, velocidad: 1.7, tipo: 'inf_apo_arriero', pareja: {clip: 'cab_paso', desfase: [-0.75, -0.9, 0], rig: 'jinete', tipo: 'cab_apo_mula'}, transiciones: ['idle']}); }
  { const s = new Serv(1.2), base = SENT({pelvis: [-78, 0, 0], torso: [64, 0, 0], brazoIz: [-42, 0, 14], antebrazoIz: [-58, 0, 0], brazoDe: [-46, 0, -14], antebrazoDe: [-62, 0, 0], piernaIz: [78, 0, 0], piernaDe: [72, 0, 0], musloIz: [-6, 0, 8], musloDe: [-10, 0, -8], pieIz: [-10, 0, 0], pieDe: [-10, 0, 0], arma: [120, 0, 0]});
    [0, 0.25, 0.5, 0.75, 1].forEach((t, i) => { s.C.k(t, orientar(Object.assign({}, base, {torso: [64 + (i % 2) * 2, 0, i % 2 ? 1.5 : -1.5]}), 0)); s.C.r(t, 0, (i % 2) * 0.01, 0); });
    const c = s.C.fin(), Sx = T3.CLIPS.soldado; Sx.__apo_s = c; const Mz = T3.poseTroop('soldado', '__apo_s', 0), o = IXS.pelvis * 16; delete Sx.__apo_s;
    let low = Infinity; [[0.12, -0.1, -0.1], [-0.12, -0.1, -0.1], [0, -0.12, 0.05]].forEach(v => { low = Math.min(low, Mz[o + 1] * v[0] + Mz[o + 5] * v[1] + Mz[o + 9] * v[2] + Mz[o + 13]); });
    c.root = c.root.map(k => [k[0], k[1], +(k[2] - low).toFixed(4), k[3]]); c.ev = [];
    CLIPS_S.apo_conductor_pescante = c; META_S.apo_conductor_pescante = {suelo: 'libre', avance: 0, desplazamiento: [0, 0, 0], armaCompatible: ERAS.slice(), transiciones: [], tipo: 'inf_apo_conductor', marcoArmon: true,
      asientos: {apo_ambulancia: [0, 1.59, -0.17], apo_carro_bagaje: [0, 1.67, -0.07]}, nota: 'las nalgas quedan en y = 0: se coloca en META.asientos del vehículo y se mueve con él', eventos: []}; }

  /* ---------- 7. prisioneros (1,6 s y 1,15 m/s, como «escoltar_prisionero» de infanteria3d) ---------- */
  const presos = (n, C, meta) => simple(n, C, Object.assign({avance: 1.15, tipo: 'inf_apo_prisionero', pareja: {clip: 'escoltar_prisionero', desfase: [1.4, -0.6, 0], nota: 'escolta a la derecha, un poco atrás'}, transiciones: ['apo_pris_atado', 'apo_pris_manos_cabeza', 'idle']}, meta));
  { const C = new H.Clip(1.6, true); H.zancada(C, 16, 18, 6, 'ninguno'); [0, 1].forEach(t => C.k(t, {cabeza: [16, 0, 0]})); C.a(0, {P: [-0.05, -0.02, -0.21], R: [0, 0, -90], g: [0, 0.1]}).a(1, {P: [-0.05, -0.02, -0.21], R: [0, 0, -90], g: [0, 0.1]});
    C.oculta('arma', [[0, 0]]); presos('apo_pris_atado', C, {nota: 'manos atadas a la espalda'}); }
  { const C = new H.Clip(1.6, true); H.zancada(C, 15, 18, 3, 'ninguno'); [0, 1].forEach(t => C.k(t, {cabeza: [10, 0, 0]})); C.a(0, {P: [-0.075, 0.69, 0.0], R: [0, 0, -90], g: [0, 0.15]}).a(1, {P: [-0.075, 0.69, 0.0], R: [0, 0, -90], g: [0, 0.15]});
    C.oculta('arma', [[0, 0]]); presos('apo_pris_manos_cabeza', C, {}); }
  const cojear = (C, k) => { const T = C.c.tracks; T.musloDe = T.musloDe.map(q => [q[0], q[1] * 0.55, q[2], q[3]]); T.piernaDe = T.piernaDe.map(q => [q[0], 8 + (q[1] - 8) * 0.25, q[2], q[3]]);
    T.pelvis = T.pelvis.map(q => [q[0], q[1], q[2], q[3] - k * 5 * Math.max(0, Math.cos(2 * Math.PI * (q[0] + 0.5)))]); T.torso = T.torso.map(q => [q[0], q[1] + 6, q[2], q[3] + k * 7 * Math.max(0, Math.cos(2 * Math.PI * (q[0] + 0.5)))]); };
  { const C = new H.Clip(1.6, true); H.zancada(C, 15, 16, 8, 'ambos', {braceo: 8}); cojear(C, 1); [0, 1].forEach(t => C.k(t, {cabeza: [18, 0, 0]})); C.a(0, W.SUELO).a(1, W.SUELO); C.g(0, -1, -1); C.oculta('arma', [[0, 0]]); presos('apo_pris_cojo', C, {}); }
  // el que sostiene (a la izquierda) y el herido sostenido (0,48 m a su derecha, el brazo izquierdo por encima de los hombros del compañero)
  { const s = new Serv(1.6); H.zancada(s.C, 15, 16, 6, 'iz', {braceo: 10}); [0, 1].forEach(t => s.C.k(t, {brazoDe: [-20, 0, -48], antebrazoDe: [-40, 0, 0], torso: [6, 0, -4], cabeza: [10, -10, 0]})); s.C.r(0, 0, 0, 0).r(1, 0, 0, 0);
    s.fin('apo_pris_sostiene', {avance: 1.15, tipo: 'inf_apo_prisionero', pareja: {clip: 'apo_pris_sostenido', desfase: [-0.48, 0, 0]}, transiciones: []}); }
  { const s = new Serv(1.6); H.zancada(s.C, 14, 14, 10, 'de', {braceo: 6}); cojear(s.C, 1); [0, 1].forEach(t => s.C.k(t, {cabeza: [20, 12, 0], torso: [16, 0, 8]})); s.C.r(0, -0.48, 0, 0).r(1, -0.48, 0, 0);
    t24(16, t => s.h(t, add(punto('soldado', CLIPS_S, 'apo_pris_sostiene', 'brazoIz', [0, 0, 0], t), [0.02, 0.07, -0.02]), [0, 1, 0], [-1, 0])); s.ver(0, false);
    s.fin('apo_pris_sostenido', {avance: 1.15, tipo: 'inf_apo_prisionero', pareja: {clip: 'apo_pris_sostiene', desfase: [0.48, 0, 0]}, transiciones: []}); }

  /* ---------- 8. estandartes: marcha, firme, caído, tendido sin bandera y recoger la bandera caída ---------- */
  { const C = new H.Clip(1.58, true); H.zancada(C, 20, 20, -2, 'ninguno'); [0, 0.25, 0.5, 0.75, 1].forEach((t, i) => C.a(t, i % 2 ? AW_(W.BANDERA_ALTA, [0, 0.02, 0], [0, 0, i === 1 ? 4 : -4]) : W.BANDERA_ALTA)); C.k(0, {cabeza: [-10, 0, 0]}).k(1, {cabeza: [-10, 0, 0]});
    simple('apo_estandarte_marcha', C, {avance: 1.3, abanderado: true, tipo: 'inf_apo_estandarte_generico', transiciones: ['apo_estandarte_firme', 'ondear', 'apo_estandarte_caido']}); }
  { const s = new Serv(4), p = [-0.21, 0.03, 0.12], d = [0, 1, 0.04]; [0, 0.5, 1].forEach((t, i) => s.en(t, 0, 0, 0, con(PIE, {brazoIz: [-2, 0, 6], antebrazoIz: [-6, 0, 0], cabeza: [i === 1 ? 2 : 0, 0, 0]})));
    s.h(0, p, d, [1.12, -1]).h(0.5, add(p, [0, 0, 0.005]), d, [1.12, -1]).h(1, p, d, [1.12, -1]); s.fin('apo_estandarte_firme', {abanderado: true, tipo: 'inf_apo_estandarte_generico', transiciones: ['apo_estandarte_marcha', 'abanderado_alzar', 'apo_estandarte_caido']}); }
  // caído: impacto, se tambalea, cae de espaldas; el asta cae a su derecha y queda en el suelo (pie del asta en PF, dirección DF)
  const PF = [-0.62, 0.03, -0.45], DF = nrm([-0.72, 0.03, 0.69]);
  { const s = new Serv(2.6, false), K = [[0, PIE], [0.1, INCL(-14, {brazoIz: [-40, 0, 40], cabeza: [-20, 0, 0]})], [0.3, AGACH({torso: [-10, 0, -10], cabeza: [10, 0, 0]})], [0.48, con(PS.RODILLA, {torso: [-30, 0, 0], brazoIz: [-20, 0, 40]})], [0.66, TEND({cabeza: [20, 20, 0], brazoDe: [-20, 0, -40]})], [1, TEND({cabeza: [24, 25, 0], brazoDe: [-24, 0, -44]})]];
    K.forEach(([t, p], i) => s.en(t, 0, i < 2 ? 0 : -0.15 - 0.35 * Math.min(1, t / 0.66), 0, p));
    const p0 = [-0.14, 0.86, 0.26], d0 = [0.04, 1, -0.06]; s.h(0, p0, d0, [0.95, 0.55]).h(0.1, add(p0, [0, -0.02, -0.06]), [-0.1, 1, -0.1], [0.95, 0.55]).h(0.2, add(p0, [-0.06, -0.14, -0.1]), [-0.3, 1, 0.0], [-1, -1]).h(0.28, add(p0, [-0.1, -0.25, -0.15]), [-0.4, 1, 0.05], [-1, -1]);
    s.h(0.32, add(p0, [-0.12, -0.28, -0.17]), [-0.45, 1, 0.08], [-1, -1]); for (let t = 0.36; t <= 0.661; t += 0.06) { const u = sstep(0.32, 0.66, t); s.h(+t.toFixed(2), add(add(p0, [-0.12, -0.28, -0.17]), sub(PF, add(p0, [-0.12, -0.28, -0.17])), u), nrm(add([-0.45, 1, 0.08], sub(DF, [-0.45, 1, 0.08]), u)), [-1, -1]); }
    s.h(1, PF, DF, [-1, -1]); s.e(0, 'impacto').e(0.2, 'suelta_bandera').e(0.6, 'cae').e(0.66, 'cae_bandera');
    s.fin('apo_estandarte_caido', {abanderado: true, sinAcercar: true, tipo: 'inf_apo_estandarte_generico', bandera: {pie: PF, dir: DF, nota: 'el asta queda en el suelo en META.bandera (marco del caído)'}, relevo: {clip: 'apo_estandarte_tendido', recoger: 'apo_estandarte_recoger'}, transiciones: ['apo_estandarte_tendido']}); }
  { const s = new Serv(4); [0, 0.5, 1].forEach((t, i) => s.en(t, 0, -0.5, 0, TEND({cabeza: [24, 25, 0], brazoDe: [-24, 0, -44], torso: [i === 1 ? 1 : 0, 0, 0]}))); s.ver(0, false);
    s.fin('apo_estandarte_tendido', {tipo: 'inf_apo_estandarte_generico', nota: 'el caído sin la bandera: se cambia a este clip cuando otro la recoge', transiciones: []}); }
  // recoger (3,2 s, en el marco del caído): llega, se agacha junto al asta, la empuña por el medio y la alza
  { const s = new Serv(3.2, false), n = nrm([DF[2], 0, -DF[0]]), mid = add(PF, DF, 0.85), A = add(mid, n, -0.4), yaw = Math.atan2(n[0], n[2]) / D2R;   // de cara al asta, con la punta a su derecha
    const hold = add([A[0], 0, A[2]], giraY([-0.14, 0.86, 0.26], yaw)), dU = giraY([0.04, 1, -0.06], yaw);
    s.en(0, A[0], A[2], yaw, PIE).en(0.16, A[0], A[2], yaw, PIE).en(0.34, A[0], A[2], yaw, CUCLI(68)).en(0.42, A[0], A[2], yaw, CUCLI(68)).en(0.72, A[0], A[2], yaw, INCL(4)).en(0.86, A[0], A[2], yaw, con(PIE, {cabeza: [-14, 0, 0]})).en(1, A[0], A[2], yaw, con(PIE, {cabeza: [-10, 0, 0]}));
    s.h(0, PF, DF, [-1, -1]).h(0.34, PF, DF, [-1, -1]).h(0.36, PF, DF, [1.05, 0.65]).h(0.42, PF, DF, [1.05, 0.65]);
    for (let t = 0.48; t <= 0.721; t += 0.06) { const u = sstep(0.42, 0.72, t); s.h(+t.toFixed(2), add(PF, sub(hold, PF), u), nrm(add(DF, sub(dU, DF), u)), u > 0.9 ? [0.95, 0.55] : [1.05, 0.65]); }
    s.h(0.8, hold, dU, [0.95, 0.55]).h(1, hold, dU, [0.95, 0.55]); s.e(0.36, 'agarra').e(0.72, 'alza').e(0.82, 'viva');
    s.fin('apo_estandarte_recoger', {abanderado: true, marcoDe: 'apo_estandarte_caido', tipo: 'inf_apo_estandarte_generico', transiciones: ['apo_estandarte_marcha', 'abanderado_alzar']}); }

  /* ---------- 9. banda: tambor mayor, bombo y cornetas en marcha (1,58 s y 1,3 m/s, como «tambor_marcha») ---------- */
  { const s = new Serv(1.58); H.zancada(s.C, 22, 22, -3, 'iz', {braceo: 14}); s.C.r(0, 0, 0, 0).r(1, 0, 0, 0);
    t24(16, t => { const a = 14 * Math.sin(2 * Math.PI * t); s.h(t, [-0.3, 1.18, 0.3], [Math.sin(a * D2R) * 0.5, 1, 0.1], [0.0, -1]); }); s.e(0, 'pisada_iz');
    s.fin('apo_tambor_mayor_marcha', {avance: 1.3, tipo: 'inf_apo_tambor_mayor', transiciones: ['apo_tambor_mayor_senal']}); }
  { const s = new Serv(3, false); [0, 0.25, 0.6, 0.85, 1].forEach(t => s.en(t, 0, 0, 0, con(PIE, {cabeza: [t > 0.2 && t < 0.7 ? -16 : -6, 0, 0], brazoIz: [-4, 0, 10]})));
    s.h(0, [-0.3, 1.18, 0.3], [0, 1, 0.1], [0, -1]).h(0.25, [-0.26, 1.72, 0.22], [0.05, 1, 0.05], [0, -1]).h(0.6, [-0.26, 1.72, 0.22], [0.05, 1, 0.05], [0, -1]).h(0.85, [-0.3, 1.18, 0.3], [0, 1, 0.1], [0, -1]).h(1, [-0.3, 1.18, 0.3], [0, 1, 0.1], [0, -1]);
    s.e(0.25, 'senal').e(0.85, 'baja'); s.fin('apo_tambor_mayor_senal', {tipo: 'inf_apo_tambor_mayor', transiciones: ['apo_tambor_mayor_marcha']}); }
  // bombo: dos golpes por ciclo en el parche derecho (en el tiempo fuerte de cada paso)
  const bombo = (s, golpes) => { const P = [-0.16, 1.12, 0.34], gS = add(P, nrm([-1, -0.2, 0]), 0.32), gA = [-0.55, 1.28, 0.24];
    s.h(0, gA, [0.6, 0.8, 0], [0, -1]); golpes.forEach(g => { s.h(g - 0.12, gA, [0.6, 0.8, 0], [0, -1]).h(g, gS, sub(P, gS), [0, -1]).h(g + 0.06, add(gS, [-0.05, 0.03, 0]), sub(P, gS), [0, -1]); s.e(g, 'golpe'); }); s.h(1, gA, [0.6, 0.8, 0], [0, -1]); };
  { const s = new Serv(1.6); [0, 0.5, 1].forEach(t => s.en(t, 0, 0, 0, con(PIE, {cabeza: [6, 0, 0], brazoIz: [-30, 0, 30], antebrazoIz: [-80, 0, 0]}))); bombo(s, [0.14, 0.64]);
    s.fin('apo_bombo_tocar', {musico: 'bombo', tipo: 'inf_apo_bombo', transiciones: ['apo_bombo_marcha']}); }
  { const s = new Serv(1.58); H.zancada(s.C, 20, 22, -2, 'ninguno'); [0, 1].forEach(t => s.C.k(t, {brazoIz: [-30, 0, 30], antebrazoIz: [-80, 0, 0], cabeza: [4, 0, 0]})); s.C.r(0, 0, 0, 0).r(1, 0, 0, 0); bombo(s, [0.14, 0.64]);
    s.fin('apo_bombo_marcha', {avance: 1.3, musico: 'bombo', tipo: 'inf_apo_bombo', transiciones: ['apo_bombo_tocar']}); }
  { const C = new H.Clip(1.58, true); H.zancada(C, 20, 22, -2, 'ninguno'); [0, 1].forEach(t => C.k(t, {cabeza: [-10, 0, 0], torso: [-3, 0, 0], brazoIz: [-10, 0, 25], antebrazoIz: [-100, 0, 0]})); C.a(0, W.CORNETA).a(1, W.CORNETA);
    [0.05, 0.2, 0.35, 0.55, 0.7, 0.85].forEach(t => C.e(t, 'nota')); simple('apo_corneta_marcha', C, {avance: 1.3, musico: 'corneta', tipo: 'inf_corneta', transiciones: ['corneta_tocar']}); }
}
const AW_ = (a, dP, dR) => ({P: a.P.map((v, i) => v + dP[i]), R: a.R.map((v, i) => v + dR[i]), g: a.g});

/* ===================================================================================== */
/* BANDERAS CON VIENTO Y DAÑO (sombreador por lote). Sin atributo nuevo: el lote ya está al límite de 16 atributos (instanceMatrix, iVar…), así que
   fuerza local del viento (0–1,5), fase y daño (0–1) van empaquetados en iLook.w, que troops3d solo lee para las orugas (aFx.y ≠ 0, nunca en un paño).
   · La dirección y la fuerza del viento son del mundo: apoyo3d.viento.value = (x, y, z, fuerza 0–1). En cada vértice del paño se pasa el viento
     al marco de la parte (instancia · hueso) y el paño se gira alrededor del asta (+y local) hacia sotavento; con poco viento cuelga junto al asta.
   · El daño perfora agujeros (más hacia el batiente), deshilacha el batiente y chamusca el paño (descartes en el fragmento; sin texturas).
   · Solo afecta a los paños que salen del asta hacia +x local (los de troops3d, infanteria3d y este módulo). La banderola de la lanza de
     caballeria3d (hacia +z) queda con la ondulación de siempre. */
const viento = {value: new THREE.Vector4(0.8, 0, 0.6, 0.6)};
const OLA = /if \(aFx\.x > 0\.0\) \{ float ph = iAnimA\.w \* 6\.2831;[^\n]*/;
const VS_BANDERA = `vBnd = vec4(0.0, 0.0, 0.0, -1.0);
if (aFx.x > 0.0) {                                                              // apoyo3d: paño con viento del mundo
  float bw = iLook.w, bDan = mod(bw, 64.0) / 63.0, bVie = mod(floor(bw / 64.0), 32.0) / 31.0 * 1.5, bFas = floor(bw / 2048.0) / 63.0;
  float fv = clamp(uViento.w * bVie, 0.0, 1.5), ph = bFas * 6.2831 + iAnimA.w * 6.2831;
  float racha = fv * (0.8 + 0.2 * sin(uTime * 0.7 + ph) * sin(uTime * 1.9 + ph * 0.5));
  float k = aFx.x, x = pos0.x, lacio = clamp(1.0 - racha, 0.0, 1.0);
  vBnd = vec4(pos0.x, pos0.y, k, bDan);
  float ca = mix(0.1, 1.35, lacio * lacio), amp = 0.025 + 0.11 * racha;            // caída hacia el asta y amplitud de la onda
  float px = x * cos(ca), py = pos0.y - x * sin(ca);
  float pz = sin(k * 7.0 - uTime * (2.5 + 5.0 * racha) + ph) * amp * k + sin(k * 3.0 - uTime * 2.3 + pos0.y * 3.0) * 0.4 * amp * k + lacio * 0.04 * sin(x * 9.0 + pos0.y * 6.0);
  py += sin(k * 5.0 - uTime * 4.0 + ph) * 0.025 * k * racha;
  mat3 mi = mat3(instanceMatrix) * mat3(bm);
  vec3 wl = vec3(dot(mi[0], uViento.xyz), dot(mi[1], uViento.xyz), dot(mi[2], uViento.xyz));
  vec3 gl = -vec3(mi[0].y, mi[1].y, mi[2].y);                                         // la gravedad en el marco de la parte: si el asta cae, el paño cuelga
  vec2 wv = (length(wl.xz) > 1e-3 ? normalize(wl.xz) : vec2(0.0)) * (0.15 + racha) + (length(gl.xz) > 1e-3 ? normalize(gl.xz) * length(gl.xz) : vec2(0.0)) * 1.2;
  vec2 wd = length(wv) > 1e-3 ? normalize(wv) : vec2(1.0, 0.0);
  pos0 = vec3(px * wd.x - pz * wd.y, py, px * wd.y + pz * wd.x);
}`;
const FS_BANDERA = `if (vBnd.w > 0.001) { vec2 cb = floor(vBnd.xy * 9.0); float hb = hBnd(cb), dn = vBnd.w;   // apoyo3d: agujeros, batiente deshilachado, chamuscado
  if (hb < dn * 0.42 * (0.4 + vBnd.z)) discard;
  if (vBnd.z > 1.0 - dn * 0.3 * (0.4 + 0.6 * hBnd(vec2(cb.y, 7.0)))) discard;
  diffuseColor.rgb *= 1.0 - dn * 0.6 * smoothstep(0.5, 1.0, hBnd(floor(vBnd.xy * 4.0) + 3.0)); }`;
function prepararBandera(lote) {
  if (!lote || lote._iBand) return lote; const cap = lote.cap || lote.mesh.instanceMatrix.count;
  lote._iBand = new Float32Array(cap * 3);                                                     // copia en JS (fuerza, fase, daño); se empaqueta en iLook.w
  const mat = lote.mesh.material, prev = mat.onBeforeCompile, key = mat.customProgramCacheKey ? mat.customProgramCacheKey() : '';
  mat.onBeforeCompile = function (sh, r) {
    if (prev) prev.call(this, sh, r); sh.uniforms.uViento = viento;
    sh.vertexShader = sh.vertexShader.replace('attribute vec4 iLook;', 'attribute vec4 iLook; uniform vec4 uViento; varying vec4 vBnd;');
    sh.vertexShader = OLA.test(sh.vertexShader) ? sh.vertexShader.replace(OLA, VS_BANDERA) : sh.vertexShader.replace('vec3 transformed = (bm', VS_BANDERA + '\nvec3 transformed = (bm');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec4 vBnd; float hBnd(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }')
      .replace('#include <color_fragment>', '#include <color_fragment>\n' + FS_BANDERA);
  };
  mat.customProgramCacheKey = () => key + '|band3d'; mat.needsUpdate = true; return lote;
}
function empaquetar(lote, i) { const b = lote._iBand, d = Math.round(Math.max(0, Math.min(1, b[i * 3 + 2])) * 63), v = Math.round(Math.max(0, Math.min(1.5, b[i * 3])) / 1.5 * 31), f = Math.round((((b[i * 3 + 1] % 1) + 1) % 1) * 63);
  lote.iLook.setW(i, d + 64 * v + 2048 * f); lote.iLook.needsUpdate = true; }
function esBandera(lote) { if (/lancero/.test(lote.kind)) return false; const fx = lote.mesh.geometry.attributes.aFx; if (!fx) return false; for (let i = 0; i < fx.count; i++) if (fx.getX(i) > 0) return true; return false; }
// daño de una bandera (0 = intacta … 1 = hecha jirones); impactoBandera(lote, i, k) lo aumenta; vientoLocal(lote, i, f) cambia la fuerza local (abrigo, 0–1,5)
function danarBandera(lote, i, d) { if (!lote._iBand) prepararBandera(lote); lote._iBand[i * 3 + 2] = Math.max(0, Math.min(1, d)); empaquetar(lote, i); }
function impactoBandera(lote, i, k) { if (!lote._iBand) prepararBandera(lote); danarBandera(lote, i, lote._iBand[i * 3 + 2] + (k == null ? 0.12 : k)); }
function vientoLocal(lote, i, f) { if (!lote._iBand) prepararBandera(lote); lote._iBand[i * 3] = f; empaquetar(lote, i); }

/* ===================================================================================== */
/* GRUPOS Y ESCENAS
   ESCENAS: figuras que comparten origen y rumbo (los clips ya llevan cada posición); se arrancan con la misma fase / el mismo instante. */
Object.assign(ESCENAS, {
  mesa: [{tipo: 'apo_mesa_cirujano', clip: 'apo_mesa_quieta'}, {tipo: 'inf_apo_herido', clip: 'apo_herido_en_mesa'}, {tipo: 'inf_apo_cirujano', clip: 'apo_cirujano_operar'}, {tipo: 'inf_apo_practicante', clip: 'apo_ayudante_sujetar'}],
  herido: [{tipo: 'inf_apo_herido', clip: 'apo_herido_tendido'}, {tipo: 'inf_apo_cirujano', clip: 'apo_cirujano_examinar'}],
  camilla: [{tipo: 'apo_camilla', clip: 'apo_camilla_marcha'}, {tipo: 'inf_apo_camillero', clip: 'apo_camilla_del_marcha'}, {tipo: 'inf_apo_camillero', clip: 'apo_camilla_tras_marcha'}],
  camilla_recoger: [{tipo: 'apo_camilla', clip: 'apo_camilla_recoger'}, {tipo: 'inf_apo_camillero', clip: 'apo_camilla_del_recoger'}, {tipo: 'inf_apo_camillero', clip: 'apo_camilla_tras_recoger'}],
  camilla_posar: [{tipo: 'apo_camilla', clip: 'apo_camilla_posar'}, {tipo: 'inf_apo_camillero', clip: 'apo_camilla_del_posar'}, {tipo: 'inf_apo_camillero', clip: 'apo_camilla_tras_posar'}],
  fragua: [{tipo: 'apo_fragua', clip: 'apo_fragua_trabajo'}, {tipo: 'inf_apo_ayudante_herrero', clip: 'apo_ayudante_fuelle'}, {tipo: 'inf_apo_herrero', clip: 'apo_herrero_martillar'}],
  herrar: [{tipo: 'cab_caballo_medio', clip: 'cab_herrar'}, {tipo: 'inf_apo_herrador', clip: 'apo_herrar_casco'}],
  pagaduria: [{tipo: 'apo_mesa_pagador', clip: 'apo_mesa_quieta'}, {tipo: 'inf_apo_pagador', clip: 'apo_pagador_pagar'}, {tipo: 'inf_soldado', clip: 'apo_soldado_cobrar'}],
  bandera_caida: [{tipo: 'inf_apo_estandarte_generico', clip: 'apo_estandarte_caido'}],
  // al acabar «apo_estandarte_caido», el caído pasa a «apo_estandarte_tendido» (sin la bandera) y otro la recoge en su mismo marco
  bandera_recoger: [{tipo: 'inf_apo_estandarte_generico', clip: 'apo_estandarte_tendido', fondo: true}, {tipo: 'inf_apo_estandarte_generico', clip: 'apo_estandarte_recoger'}]
});
const GRUPOS = {
  // columna de prisioneros de a dos (1,3 m entre filas), escoltas a pie en los flancos cada 3 filas y a caballo en cabeza y cola, todo a 1,15 m/s
  columna_prisioneros: (n, op) => { op = op || {}; n = n || 24; const filas = Math.ceil(n / 2), dz = op.distancia || 1.3, out = [], cl = ['apo_pris_atado', 'apo_pris_manos_cabeza', 'apo_pris_atado', 'apo_pris_cojo', 'apo_pris_manos_cabeza'];
    for (let f = 0; f < filas; f++) { if (f % 5 === 3 && out.length + 2 <= n) { out.push({x: 0.5, z: -f * dz, tipo: 'inf_apo_prisionero', clip: 'apo_pris_sostiene', papel: 'prisionero', fila: f + 1}, {x: 0.02, z: -f * dz, tipo: 'inf_apo_prisionero', clip: 'apo_pris_sostenido', papel: 'herido', fila: f + 1}); continue; }
      for (let c = 0; c < 2 && out.length < n; c++) out.push({x: c ? -0.5 : 0.5, z: -f * dz, tipo: 'inf_apo_prisionero', clip: cl[(f * 2 + c) % cl.length], papel: 'prisionero', fila: f + 1}); }
    const esc = [];
    for (let f = 0; f < filas; f += 3) esc.push({x: (f / 3) % 2 ? -1.6 : 1.6, z: -f * dz - 0.4, tipo: op.escolta || 'inf_soldado', clip: 'escoltar_prisionero', papel: 'escolta'});
    esc.push({x: 0, z: 4.0, tipo: op.montada || 'cab_dragon', clip: 'cab_apo_paso_escolta', papel: 'escolta_montada'}, {x: 0, z: -(filas - 1) * dz - 4.2, tipo: op.montada || 'cab_dragon', clip: 'cab_apo_paso_escolta', papel: 'escolta_montada'});
    return out.concat(esc); },
  // banda en marcha: tambor mayor delante, filas de 4 (tambores, cornetas; gaiteros si op.gaiteros) y el bombo en el centro, todo a 1,3 m/s
  banda: (n, op) => { op = op || {}; n = n || 16; const out = [{x: 0, z: 3.2, tipo: 'inf_apo_tambor_mayor', clip: 'apo_tambor_mayor_marcha', papel: 'tambor_mayor'}], filas = Math.ceil(n / 4), mitad = Math.ceil(filas / 2);
    for (let i = 0; i < n; i++) { const f = Math.floor(i / 4), c = i % 4, gai = op.gaiteros && f >= filas - 1, tam = f < mitad;
      out.push({x: (c - 1.5) * 1.0, z: -f * 1.3, tipo: gai ? 'inf_gaitero' : tam ? 'inf_tambor' : 'inf_corneta', clip: gai ? 'gaita_marcha' : tam ? 'tambor_marcha' : 'apo_corneta_marcha', papel: gai ? 'gaitero' : tam ? 'tambor' : 'corneta'}); }
    out.push({x: 0, z: -filas * 1.3, tipo: 'inf_apo_bombo', clip: 'apo_bombo_marcha', papel: 'bombo'}); return out; },
  // tren de carros: carros a 16 m con tiro de 4 mulas (o caballos con op.caballos) al paso; conductor en el pescante si el carro lo tiene
  tren: (n, op) => { op = op || {}; n = n || 4; const tipos = op.tipos || ['apo_carro_suministro', 'apo_carro_bagaje', 'apo_ambulancia', 'apo_carro_suministro'], out = [], A = root.artilleria3d;
    for (let i = 0; i < n; i++) { const z0 = -i * 16, tv = tipos[i % tipos.length]; out.push({x: 0, z: z0, tipo: tv, clip: 'art_rodar_paso', papel: 'carro', n: i + 1});
      A.formacion('tiro', op.tiro || 4).forEach(p => out.push({x: p.x, z: z0 + p.z, tipo: op.caballos ? p.tipo : p.tipo === 'cab_tiro_conductor' ? 'cab_apo_mula_tiro_conductor' : 'cab_apo_mula_tiro', clip: 'cab_paso', papel: p.papel, n: i + 1, escala: op.caballos ? 1 : 0.92}));
      const as = META_S.apo_conductor_pescante && META_S.apo_conductor_pescante.asientos[tv]; if (as) out.push({x: as[0], y: as[1], z: z0 + as[2], tipo: 'inf_apo_conductor', clip: 'apo_conductor_pescante', papel: 'conductor', n: i + 1}); }
    return out; },
  // recua: mulas en fila a 2,4 m con el arriero junto a la cabeza de la primera, al paso (1,7 m/s)
  recua: (n, op) => { op = op || {}; n = n || 6; const cargas = op.cargas || ['carga', 'viveres', 'carga', 'montana_tubo', 'montana_ruedas', 'viveres'], out = [];
    for (let i = 0; i < n; i++) out.push({x: 0, z: -i * 2.4, tipo: 'cab_apo_mula_' + cargas[i % cargas.length], clip: 'cab_paso', papel: 'mula', escala: 0.92});
    out.push({x: 0.75, z: 0.9, tipo: 'inf_apo_arriero', clip: 'apo_arriero_guiar', papel: 'arriero'}); return out; },
  // puesto de socorro: mesa de operaciones, heridos esperando, bandera de hospital, ambulancia y camillas
  puesto_socorro: (n, op) => { op = op || {}; const out = ESCENAS.mesa.map(e => Object.assign({x: 0, z: 0, escena: 'mesa'}, e));
    ESCENAS.herido.forEach(e => out.push(Object.assign({x: 3.5, z: 1.0, escena: 'herido'}, e)));
    for (let i = 0; i < (n || 3); i++) out.push({x: -3.0 + i * 1.0, z: 3.0, rumbo: 90, tipo: 'apo_camilla', clip: 'apo_camilla_suelo', papel: 'camilla_en_espera'});
    out.push({x: -2.4, z: -2.2, tipo: 'apo_bandera_hospital', clip: 'apo_asta_quieta', papel: 'bandera'}, {x: 6, z: -4, rumbo: 90, tipo: 'apo_ambulancia', clip: 'art_rodar_parado', papel: 'ambulancia'}); return out; }
};
function formacion(tipo, n, op) { const f = GRUPOS[tipo]; if (!f) throw new Error('formación desconocida: ' + tipo); return f(n, op); }
const TRANSICIONES = {};
function grafo() { [META, META_J, META_S].forEach(M => Object.entries(M).forEach(([n, m]) => { TRANSICIONES[n] = TRANSICIONES[n] || {}; (m.transiciones || []).forEach(t => { TRANSICIONES[n][t] = /galope|cae/.test(n + t) ? 0.15 : 0.3; }); })); }
function rutaTransicion(desde, hasta) { const cola = [[desde]], vis = new Set([desde]); while (cola.length) { const r = cola.shift(), u = r[r.length - 1]; if (u === hasta) return r.slice(1).map((c, i) => ({clip: c, mezcla: (TRANSICIONES[r[i]] || {})[c]}));
  Object.keys(TRANSICIONES[u] || {}).forEach(v => { if (!vis.has(v)) { vis.add(v); cola.push(r.concat([v])); } }); } return null; }

/* ===================================================================================== */
/* REGISTRO */
let _I = null, _reg = null;
function registrar(T3, op) {
  op = op || {}; const ARTm = root.artilleria3d, CABm = root.caballeria3d, INFm = root.infanteria3d;
  if (!ARTm || !CABm || !INFm) throw new Error('apoyo3d necesita infanteria3d.js, caballeria3d.js y artilleria3d.js cargados antes');
  ARTm.registrar(T3, op);
  // cuerpo de mula (más estrecha y de patas más finas) y jinetes de apoyo en las tablas de caballeria3d
  if (!CABm.CUERPO.mula) CABm.CUERPO.mula = {k: 0.88, kz: 0.92, pata: 0.88, crin: 'corta'};
  const J = CABm.JINETES, ERA_T = ERAS.slice();
  if (!J.portaestandarte) J.portaestandarte = {nombre: 'Portaestandarte de caballería', cuerpo: 'medio', silla: 'dragon', arma: 'ninguna', pal: 'caballeria', eras: ['A', 'B', 'C', 'D'], carabina: () => false, toc: (e, n) => J.dragon.toc(e, n)};
  if (!J.trompeta) J.trompeta = {nombre: 'Trompeta de caballería', cuerpo: 'ligero', silla: 'hungara', arma: 'ninguna', pal: 'caballeria', eras: ERA_T, carabina: () => false, toc: (e, n) => J.cazador.toc(e, n)};
  Object.entries(RIGS_APO).forEach(([r, R]) => { if (!T3.RIGS[r]) T3.RIGS[r] = R; T3.CLIPS[r] = T3.CLIPS[r] || {}; });
  const ART = Object.assign({}, ARTm.instancia(), {ARMON: ARTm.ARMON});
  _I = _I || crear(T3, INFm.instancia(T3), CABm._crear(T3, INFm.instancia(T3)), ART);
  const tipos = [], clips = [], saltados = [];
  Object.entries(_I.TIPOS).forEach(([k, K]) => { if (T3.KINDS[k] && !op.reemplazar) return; T3.KINDS[k] = K; if (!T3.TROOP_KINDS.includes(k)) T3.TROOP_KINDS.push(k); tipos.push(k); });
  Object.entries(CLIPS).forEach(([rig, set]) => Object.entries(set).forEach(([n, c]) => { if (T3.CLIPS[rig][n] && !op.reemplazar) { saltados.push(n); return; } T3.CLIPS[rig][n] = JSON.parse(JSON.stringify(c)); clips.push(n); }));
  if (!Object.keys(CLIPS_J).length) clipsJinete(CABm);
  Object.entries(CLIPS_J).forEach(([n, c]) => { if (T3.CLIPS.jinete[n] === c) return; if (T3.CLIPS.jinete[n] && !op.reemplazar) { saltados.push(n); return; } T3.CLIPS.jinete[n] = c; clips.push(n); });
  if (!Object.keys(CLIPS_S).length) { clipsSoldado(T3, INFm); grafo(); }
  Object.entries(CLIPS_S).forEach(([n, c]) => { if (T3.CLIPS.soldado[n] === c) return; if (T3.CLIPS.soldado[n] && !op.reemplazar) { saltados.push(n); return; } T3.CLIPS.soldado[n] = c; clips.push(n); });
  // lotes con bandera: se preparan solos (viento y daño); add() acepta o.viento (0–1,5), o.fase y o.dano
  const TB = T3.TroopBatch.prototype;
  if (!TB._apo3d && op.viento !== false) { const add0 = TB.add;
    TB.add = function (x, y, z, yaw, scale, nation, clip, o) { if (this._esBandera == null) this._esBandera = esBandera(this); if (this._esBandera && !this._iBand) prepararBandera(this);
      const i = add0.call(this, x, y, z, yaw, scale, nation, clip, o); if (this._esBandera && i >= 0) { const b = this._iBand; b[i * 3] = o && o.viento != null ? o.viento : 1; b[i * 3 + 1] = o && o.fase != null ? o.fase : Math.random(); b[i * 3 + 2] = o && o.dano || 0; empaquetar(this, i); } return i; };
    TB._apo3d = true; }
  _reg = {tipos, clips, saltados}; return _reg;
}

/* ===================================================================================== */
/* DEMOSTRACIÓN: demoApoyo(contenedor, {vista, era, nat, viento, dir, dano, t})
   vistas: socorro · camilla · fragua · herrar · pagaduria · bandera_caida (escenas con figuras sincronizadas) · prisioneros · banda · recua · tren
   (columnas en marcha) · banderas (viento y daño con deslizadores) · perros · catalogo (todos los tipos) */
function demoApoyo(cont, op) {
  op = op || {}; const T3 = root.Troops3D; if (!T3) throw new Error('demoApoyo necesita Troops3D (troops3d.js)');
  registrar(T3); const q = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new Map(), arg = k => op[k] != null ? op[k] : q.get(k);
  const NAT = ['PRU', 'AUT', 'FRA', 'GBR', 'RUS', 'USA', 'CSA', 'ESP', 'ITA', 'JPN'], VISTAS = ['socorro', 'camilla', 'fragua', 'herrar', 'pagaduria', 'bandera_caida', 'bandera_recoger', 'prisioneros', 'banda', 'recua', 'tren', 'banderas', 'perros', 'catalogo'];
  const R = new THREE.WebGLRenderer({antialias: true}); R.setPixelRatio(Math.min(2, root.devicePixelRatio || 1)); R.domElement.style.cssText = 'display:block;width:100%;height:100%'; cont.appendChild(R.domElement);
  const S = new THREE.Scene(); S.background = new THREE.Color(0xc9d2d4); S.fog = new THREE.Fog(0xc9d2d4, 40, 160);
  S.add(new THREE.HemisphereLight(0xffffff, 0x5d6b48, 0.85)); const L = new THREE.DirectionalLight(0xfff1dc, 1.25); L.position.set(-4, 8, 6); S.add(L);
  const cv = document.createElement('canvas'); cv.width = cv.height = 64; const cx = cv.getContext('2d'); cx.fillStyle = '#86965f'; cx.fillRect(0, 0, 64, 64); cx.fillStyle = '#7a8a55'; cx.fillRect(0, 0, 64, 3); cx.fillRect(0, 0, 3, 64);
  const tx = new THREE.CanvasTexture(cv); tx.wrapS = tx.wrapT = THREE.RepeatWrapping; tx.repeat.set(200, 200); tx.colorSpace = THREE.SRGBColorSpace;
  const suelo = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshLambertMaterial({map: tx})); suelo.rotation.x = -Math.PI / 2; S.add(suelo);
  const cam = new THREE.PerspectiveCamera(32, 1, 0.1, 400); let az = 0.8, el = 0.3, dist = 9, mira = new THREE.Vector3(0, 0.8, 0);
  const sh = new T3.TroopShared(NAT.concat(['TUR', 'GEN'])); let lotes = {}, figs = [];
  const panel = document.createElement('div'); panel.style.cssText = 'position:absolute;right:8px;top:8px;z-index:6;background:#2a1d12e8;color:#f0dfb4;padding:8px 10px;font:13px Georgia,serif;border:1px solid #b08a3e;max-width:340px';
  if (getComputedStyle(cont).position === 'static') cont.style.position = 'relative'; cont.appendChild(panel);
  const sel = (id, ops, v) => `<label style="display:block;margin:3px 0">${id} <select id="p3d_${id}" style="max-width:220px">${ops.map(o => `<option ${o === v ? 'selected' : ''}>${o}</option>`).join('')}</select></label>`;
  const rango = (id, min, max, st, v) => `<label style="display:block;margin:3px 0">${id} <input id="p3d_${id}" type="range" min="${min}" max="${max}" step="${st}" value="${v}" style="width:150px"></label>`;
  const est = {vista: arg('vista') || 'socorro', era: arg('era') || 'B', nat: arg('nat') || 'FRA', viento: arg('viento') != null ? +arg('viento') : 0.6, dir: arg('dir') != null ? +arg('dir') : 70, dano: arg('dano') != null ? +arg('dano') : 0, t: arg('t') != null ? +arg('t') : null};
  panel.innerHTML = sel('vista', VISTAS, est.vista) + sel('era', ERAS, est.era) + sel('nat', NAT, est.nat) + rango('viento', 0, 1, 0.05, est.viento) + rango('dir', 0, 360, 5, est.dir) + rango('dano', 0, 1, 0.05, est.dano)
    + `<label style="display:block;margin:3px 0">t <input id="p3d_t" type="range" min="0" max="1" step="0.002" value="${est.t == null ? 0 : est.t}" style="width:160px"> <input id="p3d_play" type="checkbox" ${est.t == null ? 'checked' : ''}> en marcha</label><div id="p3d_info" style="font-size:12px;opacity:.85;margin-top:4px"></div>`;
  const $ = id => panel.querySelector('#p3d_' + id);
  const viento3 = () => { const a = est.dir * D2R; viento.value.set(Math.sin(a), 0, Math.cos(a), est.viento); };
  const lote = (k, n) => { const e = T3.KINDS[k].eras.includes(est.era) ? est.era : T3.KINDS[k].eras[T3.KINDS[k].eras.length - 1], key = k + e + n; if (!lotes[key]) { lotes[key] = new T3.TroopBatch(sh, k, e, n, 48, {lod: 0}); S.add(lotes[key].mesh); } return lotes[key]; };
  // fig: {tipo, clip, x, y, z, rumbo (°), escala, nat, v (m/s, en marcha)}
  const pon = f => { const n = f.nat || (/^inf_apo_estandarte_colores/.test(f.tipo) ? 'GBR' : f.tipo === 'inf_gaitero' ? 'GBR' : est.nat), b = lote(f.tipo, n), i = b.add(f.x || 0, f.y || 0, f.z || 0, (f.rumbo || 0) * D2R, f.escala || T3.KINDS[f.tipo].escala || 1, n, f.clip, {phase: 0, start: 0, dano: est.dano, viento: 1});
    figs.push(Object.assign({b, i}, f)); };
  let reloj = 0, actual = null, mov = 0;
  function montar() {
    Object.values(lotes).forEach(b => { S.remove(b.mesh); b.mesh.geometry.dispose(); }); lotes = {}; figs = []; reloj = 0; actual = null; mov = 0; const info = []; viento3();
    const v = est.vista;
    if (ESCENAS[v === 'socorro' ? 'mesa' : v]) { const E = v === 'socorro' ? 'mesa' : v; ESCENAS[E].forEach(f => pon(f)); const pr = ESCENAS[E].find(f => !/^apo_(mesa|asta)/.test(f.clip) && !f.fondo) || ESCENAS[E][0]; actual = T3.CLIPS[T3.KINDS[pr.tipo].rig][pr.clip];
      if (v === 'socorro') { ESCENAS.herido.forEach(f => pon(Object.assign({x: 3.4, z: 1.2}, f))); pon({tipo: 'apo_bandera_hospital', clip: 'apo_asta_quieta', x: -2.6, z: -2.0}); pon({tipo: 'apo_ambulancia', clip: 'art_rodar_parado', x: 5.5, z: -4.5, rumbo: 90});
        for (let i = 0; i < 2; i++) pon({tipo: 'apo_camilla', clip: 'apo_camilla_suelo', x: -3.2 + i * 0.9, z: 2.6, rumbo: 90}); dist = 13; mira.set(1, 0.6, 0); }
      else { dist = {fragua: 8, herrar: 6.5, camilla: 8, camilla_recoger: 8, bandera_caida: 6, bandera_recoger: 6}[v] || 7; mira.set(v === 'fragua' ? 0.4 : 0, 0.7, v === 'herrar' ? 0.3 : 0); }
      info.push(`<b>escena ${E}</b> (mismo origen y rumbo, misma fase): ${ESCENAS[E].map(f => f.clip).join(' · ')}`, `eventos: ${(actual.ev || []).map(e => e[1] + '@' + e[0].toFixed(2)).join(', ')}`); }
    else if (['prisioneros', 'banda', 'recua', 'tren'].includes(v)) { const F = {prisioneros: ['columna_prisioneros', 20, 1.15], banda: ['banda', 16, 1.3], recua: ['recua', 6, 1.7], tren: ['tren', 3, 1.7]}[v]; mov = F[2];
      formacion(F[0], F[1]).forEach(p => pon(Object.assign({}, p, {y: p.y || 0}))); info.push(`formacion('${F[0]}', ${F[1]}) a ${F[2]} m/s`); dist = v === 'tren' ? 34 : v === 'prisioneros' ? 22 : 16; az = 1.1; el = 0.22; }
    else if (v === 'banderas') { ['nacional', 'regimiento', 'banderin', 'hospital'].forEach((k, i) => pon({tipo: 'apo_bandera_' + k, clip: 'apo_asta_quieta', x: -6.5 + i * 3.2, z: 1.5}));
      ['aguila', 'colores', 'fahne', 'generico'].forEach((k, i) => pon({tipo: 'inf_apo_estandarte_' + k, clip: i % 2 ? 'apo_estandarte_firme' : 'ondear', x: -6.5 + i * 3.2, z: -4.5, nat: k === 'aguila' ? 'FRA' : k === 'colores' ? 'GBR' : k === 'fahne' ? 'PRU' : null}));
      pon({tipo: 'cab_apo_portaestandarte', clip: 'cab_parado_lanza', x: 6.5, z: -4.5}); pon({tipo: 'inf_abanderado', clip: 'ondear', x: 6.5, z: 1.5}); info.push('el viento y el daño se aplican en el sombreador: apoyo3d.viento y apoyo3d.danarBandera(lote, i, d)'); dist = 20; mira.set(0, 1.6, -1.5); az = 0.2; el = 0.14; }
    else if (v === 'perros') { [['terrier', 'perro_parado'], ['terrier', 'perro_trote'], ['mastin', 'perro_ladrar'], ['mastin', 'perro_galope'], ['sanitario', 'perro_sentado'], ['mastin', 'perro_tumbado'], ['terrier', 'perro_paso']].forEach(([r, c], i) => pon({tipo: 'apo_perro_' + r, clip: c, x: -4.5 + i * 1.5, z: 0, rumbo: 90}));
      info.push('perros: parado, trote, ladrar, galope, sentado (sanitario, era D), tumbado, paso'); dist = 9; mira.set(0, 0.35, 0); az = 0; el = 0.18; }
    else { const L2 = Object.keys(_I.TIPOS); L2.forEach((k, i) => { const K = T3.KINDS[k], rig = K.rig, cl = rig === 'soldado' ? (/estandarte/.test(k) ? 'apo_estandarte_firme' : 'idle') : rig === 'jinete' ? 'cab_parado' + (k === 'cab_apo_portaestandarte' ? '_lanza' : '') : rig === 'armon' ? 'art_rodar_parado' : rig === 'perro' ? 'perro_parado' : Object.keys(CLIPS[rig])[0];
        pon({tipo: k, clip: cl, x: (i % 8 - 3.5) * (rig === 'armon' ? 3.2 : 2.6), z: -Math.floor(i / 8) * 5, rumbo: rig === 'armon' ? 90 : 0}); }); info.push(`${L2.length} tipos`); dist = 40; mira.set(0, 0.8, -10); az = 0.3; el = 0.4; }
    $('info').innerHTML = info.join('<br>');
  }
  ['vista', 'era', 'nat'].forEach(k => $(k).onchange = () => { est[k] = $(k).value; montar(); });
  ['viento', 'dir'].forEach(k => $(k).oninput = () => { est[k] = +$(k).value; viento3(); });
  $('dano').oninput = () => { est.dano = +$('dano').value; figs.forEach(f => { if (f.b._iBand) danarBandera(f.b, f.i, est.dano); }); };
  let arr = null; R.domElement.onpointerdown = e => { arr = [e.clientX, e.clientY]; }; root.addEventListener('pointerup', () => { arr = null; });
  R.domElement.onpointermove = e => { if (!arr) return; az -= (e.clientX - arr[0]) * 0.008; el = Math.max(0.02, Math.min(1.4, el + (e.clientY - arr[1]) * 0.006)); arr = [e.clientX, e.clientY]; };
  R.domElement.onwheel = e => { dist = Math.max(2, Math.min(120, dist * (1 + Math.sign(e.deltaY) * 0.1))); e.preventDefault(); };
  montar(); let prev = performance.now(), vivo = true; const m4 = new THREE.Matrix4(), qq = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), pp = new THREE.Vector3(), ss = new THREE.Vector3();
  (function paso() { if (!vivo) return; const now = performance.now(), dt = Math.min(0.1, (now - prev) / 1000); prev = now; const w = cont.clientWidth || innerWidth, h = cont.clientHeight || innerHeight;
    if (R.domElement.width !== Math.round(w * R.getPixelRatio()) || R.domElement.height !== Math.round(h * R.getPixelRatio())) R.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix();
    reloj += dt; const C = actual;
    if (C) { let tt; if ($('play').checked) { tt = C.loop !== false ? (reloj / C.dur) % 1 : Math.min(1, (reloj % (C.dur + 1.5)) / C.dur); $('t').value = tt; } else tt = +$('t').value; sh.timeU.value = tt * C.dur; }
    else sh.timeU.value = $('play').checked ? reloj : +$('t').value * 10;
    if (mov) { const z = mov * sh.timeU.value; figs.forEach(f => { qq.setFromAxisAngle(up, (f.rumbo || 0) * D2R); const k = f.escala || T3.KINDS[f.tipo].escala || 1; m4.compose(pp.set(f.x || 0, f.y || 0, (f.z || 0) + z), qq, ss.set(k, k, k)); f.b.mesh.setMatrixAt(f.i, m4); f.b.mesh.instanceMatrix.needsUpdate = true; }); mira.set(0, 1.0, z - 4); }
    cam.position.set(mira.x + Math.sin(az) * Math.cos(el) * dist, mira.y + Math.sin(el) * dist, mira.z + Math.cos(az) * Math.cos(el) * dist); cam.lookAt(mira); R.render(S, cam); requestAnimationFrame(paso); })();
  return {renderer: R, escena: S, camara: cam, montar, estado: est, parar() { vivo = false; R.dispose(); }};
}

const API = {RIGS: RIGS_APO, CLIPS, META, CLIPS_J, META_J, CLIPS_S, META_S, ESCENAS, GRUPOS, formacion, TRANSICIONES, rutaTransicion,
  viento, danarBandera, impactoBandera, vientoLocal, prepararBandera, registrar, demoApoyo, CAM, FRA, PATAS_P, _crear: crear};
Object.defineProperty(API, 'TIPOS', {get: () => _I ? _I.TIPOS : null, enumerable: true});
root.apoyo3d = API;
})(typeof window !== 'undefined' ? window : globalThis);
