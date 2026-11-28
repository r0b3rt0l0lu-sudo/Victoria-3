/* ===== infanteria3d.js — infantería de línea 1836–1945 para el modo «Batalla» de Victoria (three.js r152, sin archivos externos) =====
   Amplía troops3d.js sin reemplazar nada: registrar(Troops3D, op) añade
   · MODELOS: soldado de infantería por época (A–E), nación (PRU/GER, AUT, FRA, GBR, RUS/URSS, USA, CSA, ESP, ITA, JPN, TUR y genérico)
     y rango (soldado, cabo, sargento, teniente, capitán, abanderado, corneta, tambor, gaitero, zapador, tirador/jäger, granadero).
     LOD0 ≤ 900 triángulos con tocado reconocible, cuello y botonadura, correajes, cartuchera, mochila y manta o capote enrollado,
     morral, cantimplora, bayoneta y vaina, polainas/vendas/botas, distintivos de rango, instrumentos y armas por época.
     LOD1 ≤ 60 y LOD2 ≤ 10 con la silueta del tocado, de la bandera y del tambor. Tipos: inf_soldado, inf_cabo… (ver TIPOS).
   · VARIACIÓN por instancia (lotes GPU de troops3d): complexión (delgado / medio / recio), bigote, patillas o barba (vértices propios
     que se pliegan si la instancia no los lleva), color de pelo y desgaste del uniforme (barro, polvo, sangre) con un control global 0–1.
   · ANIMACIONES nuevas del soldado (formato CLIPS.soldado): marchas (ordinario, carga, gimnástico × al hombro, a la funerala, a discreción),
     descarga por filas, recarga completa de avancarga y fallos de ignición, cuadro, carga a la bayoneta, cuerpo a cuerpo emparejado,
     duelo a sable, escaramuzador apoyado, reacciones (impactos 6× por región, tambaleo, explosión, encogerse, dudar, pánico, capturado),
     vida de campamento y mando (voz de mando, catalejo, despacho, mensajero, corneta, tambor, gaita, bandera).
   Raíz asentada con la cinemática real de troops3d (pies en el suelo ± 3 cm), META por clip y grafo de transiciones.
   Fuentes de uniformes y equipo: Knötel, «Uniformenkunde»; Funcken, «L'uniforme et les armes des soldats du XIXe siècle» y «…de la guerre
   1914-18»; Osprey Men-at-Arms por ejército; reglamentos de ejercicios citados junto a cada clip. «aprox.» donde el detalle variaba por cuerpo.
   API: registrar(Troops3D, op) → {tipos, clips} · prepararLote(lote) · variar(lote, i, {complexion, barba, pelo, desgaste}) · desgaste (uniforme)
        TIPOS · META · TRANSICIONES · rutaTransicion · prueba(Troops3D) · demoInfanteria(cont) */
(function (root) {
'use strict';
const THREE = root.THREE;
const Z = {MAIN: 0, TRIM: 1, ACC: 2, HAT: 3, F1: 4, F2: 5, F3: 6, FIX: 12};
const V = {NONE: 0, SKIN: 1, BARBA: 3, BIGOTE: 4, PATILLAS: 5, PELO: 6};
const C = {cuero: 0x5a3a22, cueroN: 0x26201c, correaB: 0xe8e2d0, madera: 0x7a5232, maderaO: 0x4e3420, acero: 0x9aa0a6, hierro: 0x3a3c40, laton: 0xc8a048, oro: 0xd8b04a, plata: 0xd8dade,
  bota: 0x1e1a18, suela: 0x141210, mochila: 0x6a5238, pelleja: 0x8a6a48, manta: 0x8a7a62, gris: 0x6e6e66, lona: 0x8a8460, negro: 0x1c1a1a, blanco: 0xece6d6, rojo: 0xa81c1c, carmesi: 0x8a1c2c,
  verde: 0x3a5a32, piel: 0xe0b48c, pelo: 0x3a2a1c, ojo: 0x1a1410, boton: 0xc8a650, botonB: 0xd8d8d0, botonO: 0x5a5440, hebilla: 0xb89a50, panno: 0x5a4a3a, tartan: 0x2a3a2a, tartanR: 0x8a1c1c, venda: 0x6a6450, caqui: 0x8a7a52};

/* ===================================================================================== */
/* MODELOS POR NACIÓN Y ÉPOCA
   toc: tocado · abrigo: casaca (A, faldones) | levita (B) | guerrera (C/D) | capote (abrigo largo con los faldones recogidos) | chaqueta (E)
   pierna: polaina_b (blanca) | polaina_n (negra) | pantalon | botas | vendas | leggins (polainas de lona) · kit: A | B | C | D | E (correaje)
   cor: correajes cruzados blancos (A/B) · rollo: manta | capote_hombro (capote en bandolera, ruso) | ninguno · mochila: piel (pelleja) | cuero | lona | no */
const MOD = {
  PRU: {A: {toc: 'pickel', abrigo: 'casaca', pierna: 'pantalon', mochila: 'piel', cor: 'negro', nota: 'Waffenrock de 1842, casco de pinchos M1842, mochila de piel de becerro.'},
        B: {toc: 'pickel', abrigo: 'levita', pierna: 'pantalon', mochila: 'piel', cor: 'negro', nota: 'Waffenrock con faldas largas (1866–70), fusil de aguja Dreyse.'},
        C: {toc: 'pickel', abrigo: 'guerrera', pierna: 'botas', mochila: 'piel', nota: 'Botas altas; Gewehr 88/98; cartucheras M1887 al frente.'},
        D: {toc: 'stahl', abrigo: 'guerrera', pierna: 'botas', mochila: 'no', rollo: 'capote_mochila', nota: 'Feldgrau M1915, Stahlhelm M1916; botas (en 1917 a menudo botines y vendas).'},
        E: {toc: 'stahl', abrigo: 'chaqueta', pierna: 'botas', mochila: 'no', nota: 'Feldbluse M36, Stahlhelm M35, correaje en Y con cartucheras K98.'}},
  AUT: {A: {toc: 'chaco_aut', abrigo: 'casaca', pierna: 'pantalon', mochila: 'piel', cor: 'blanco', nota: 'Rock blanco, chacó troncocónico con visera y pompón; correajes blancos.'},
        B: {toc: 'chaco_aut', abrigo: 'levita', pierna: 'pantalon', mochila: 'piel', cor: 'blanco', nota: 'Waffenrock blanco hasta 1868; chacó M1861.'},
        C: {toc: 'kepi_aut', abrigo: 'guerrera', pierna: 'pantalon', mochila: 'piel', nota: 'Waffenrock azul oscuro (1868–1908), gorra de campaña (Feldkappe); Mannlicher M1895.'},
        D: {toc: 'stahl', abrigo: 'guerrera', pierna: 'vendas', mochila: 'lona', nota: 'Hechtgrau (gris lucio) M1908/15, Stahlhelm M1917, vendas.'}},
  FRA: {A: {toc: 'chaco', abrigo: 'capote', pierna: 'polaina_b', mochila: 'cuero', cor: 'blanco', nota: 'Capote gris azulado con faldones recogidos, pantalón garance, chacó de 1837 (quepis en campaña desde 1840).'},
        B: {toc: 'kepi', abrigo: 'capote', pierna: 'polaina_b', mochila: 'cuero', cor: 'negro', nota: 'Capote azul y pantalón garance, quepis, polainas de cuero; Chassepot.'},
        C: {toc: 'kepi', abrigo: 'capote', pierna: 'polaina_n', mochila: 'cuero', nota: 'Capote azul y pantalón garance hasta 1914; Lebel.'},
        D: {toc: 'adrian', abrigo: 'capote', pierna: 'vendas', mochila: 'lona', nota: 'Azul horizonte (1915), casco Adrian M1915, vendas.'},
        E: {toc: 'adrian', abrigo: 'capote', pierna: 'vendas', mochila: 'lona', nota: 'Caqui (1935), casco Adrian M1926, MAS 36.'}},
  GBR: {A: {toc: 'chaco', abrigo: 'casaca', pierna: 'pantalon', mochila: 'cuero', cor: 'blanco', nota: 'Casaca escarlata, correajes blancos cruzados, chacó Albert (1844).'},
        B: {toc: 'chaco', abrigo: 'guerrera', pierna: 'pantalon', mochila: 'cuero', cor: 'blanco', nota: 'Túnica escarlata (1855), chacó de 1861; Enfield 1853.'},
        C: {toc: 'casco_hs', abrigo: 'guerrera', pierna: 'polaina_n', mochila: 'cuero', nota: 'Home Service Helmet (1878), túnica roja; en campaña colonial caqui y salacot.'},
        D: {toc: 'brodie', abrigo: 'guerrera', pierna: 'vendas', mochila: 'lona', nota: 'Service Dress caqui, casco Brodie, correaje de lona P1908, vendas.'},
        E: {toc: 'brodie', abrigo: 'chaqueta', pierna: 'leggins', mochila: 'lona', nota: 'Battledress 1937, casco Mk II, correaje P1937 con polainas cortas.'}},
  RUS: {A: {toc: 'chaco', abrigo: 'casaca', pierna: 'pantalon', mochila: 'cuero', cor: 'blanco', nota: 'Casaca verde oscuro y chacó/kiwer (aprox.).'},
        B: {toc: 'kepi_bajo', abrigo: 'levita', pierna: 'botas', mochila: 'cuero', rollo: 'capote_hombro', nota: 'Quepis ruso (1862), botas, capote en bandolera.'},
        C: {toc: 'gorra_rusa', abrigo: 'guerrera', pierna: 'botas', mochila: 'no', rollo: 'capote_hombro', nota: 'Gorra sin visera, gimnastiorka, capote enrollado al hombro; Mosin-Nagant.'},
        D: {toc: 'gorra_rusa', abrigo: 'guerrera', pierna: 'botas', mochila: 'no', rollo: 'capote_hombro', nota: 'Igual en 1914–17; cascos Adrian en algunas unidades (no modelado).'},
        E: {toc: 'ssh40', abrigo: 'guerrera', pierna: 'botas', mochila: 'no', rollo: 'capote_hombro', nota: 'Gimnastiorka M35/43, casco SSh-40, rollo de capote; Mosin 91/30.'}},
  USA: {A: {toc: 'chaco', abrigo: 'casaca', pierna: 'pantalon', mochila: 'cuero', cor: 'blanco', nota: 'Casaca azul y pantalón celeste (1833–51, aprox.).'},
        B: {toc: 'gorra_campana', abrigo: 'levita', pierna: 'pantalon', mochila: 'cuero', cor: 'negro', nota: 'Sack coat azul, pantalón celeste, gorra de campaña M1858; Springfield 1861.'},
        C: {toc: 'slouch', abrigo: 'guerrera', pierna: 'leggins', mochila: 'no', rollo: 'manta_hombro', nota: 'Sombrero de campaña, camisa azul o caqui (1898), manta en bandolera; Krag.'},
        D: {toc: 'brodie', abrigo: 'guerrera', pierna: 'vendas', mochila: 'lona', nota: 'M1917, casco M1917 (Brodie), cinturón de cartuchos; Springfield/Enfield.'},
        E: {toc: 'm1', abrigo: 'chaqueta', pierna: 'leggins', mochila: 'lona', nota: 'Chaqueta M41, casco M1, polainas de lona; Garand.'}},
  CSA: {B: {toc: 'slouch', abrigo: 'levita', pierna: 'pantalon', mochila: 'no', rollo: 'manta_hombro', cor: 'negro', nota: 'Chaqueta gris o «butternut», sombrero, manta en bandolera, sin mochila (aprox.: muy variable).'}},
  ESP: {A: {toc: 'chaco', abrigo: 'levita', pierna: 'pantalon', mochila: 'cuero', cor: 'blanco', nota: 'Levita azul, pantalón rojo o garance, chacó (aprox.).'},
        B: {toc: 'ros', abrigo: 'levita', pierna: 'pantalon', mochila: 'cuero', cor: 'negro', nota: 'Ros (1855), levita azul, pantalón rojo.'},
        C: {toc: 'ros', abrigo: 'guerrera', pierna: 'pantalon', mochila: 'no', rollo: 'manta_hombro', nota: 'Rayadillo en Cuba/Filipinas (aprox.), Mauser 93.'},
        D: {toc: 'gorra', abrigo: 'guerrera', pierna: 'vendas', mochila: 'lona', nota: 'Caqui (1914–26), gorra de plato (aprox.).'},
        E: {toc: 'm33', abrigo: 'chaqueta', pierna: 'vendas', mochila: 'lona', nota: 'Casco «modelo Trubia» (aprox. con el M33), caqui.'}},
  ITA: {A: {toc: 'chaco', abrigo: 'casaca', pierna: 'pantalon', mochila: 'cuero', cor: 'blanco', nota: 'Cerdeña-Piamonte: azul oscuro, chacó (aprox.).'},
        B: {toc: 'kepi', abrigo: 'levita', pierna: 'pantalon', mochila: 'cuero', cor: 'negro', nota: 'Quepis y levita azul (1860–70).'},
        C: {toc: 'kepi', abrigo: 'guerrera', pierna: 'pantalon', mochila: 'cuero', nota: 'Azul oscuro hasta 1908; Carcano 91.'},
        D: {toc: 'adrian', abrigo: 'guerrera', pierna: 'vendas', mochila: 'lona', nota: 'Grigio-verde (1909), casco Adrian (italiano), vendas.'},
        E: {toc: 'm33', abrigo: 'guerrera', pierna: 'vendas', mochila: 'lona', nota: 'Grigio-verde, casco M33.'}},
  JPN: {B: {toc: 'kepi', abrigo: 'guerrera', pierna: 'pantalon', mochila: 'cuero', nota: 'Uniforme de estilo francés (1870–86, aprox.).'},
        C: {toc: 'kepi_bajo', abrigo: 'guerrera', pierna: 'polaina_b', mochila: 'cuero', nota: 'Azul oscuro con banda amarilla en la gorra (1886–1905); Arisaka 30.'},
        D: {toc: 'kepi_bajo', abrigo: 'guerrera', pierna: 'vendas', mochila: 'cuero', nota: 'Caqui M1906; Arisaka 38.'},
        E: {toc: 'casco_jp', abrigo: 'guerrera', pierna: 'vendas', mochila: 'lona', nota: 'Tipo 98, casco Tipo 90 con funda de tela; Arisaka 99.'}},
  TUR: {A: {toc: 'fez', abrigo: 'casaca', pierna: 'pantalon', mochila: 'cuero', cor: 'blanco', nota: 'Fez y casaca azul de estilo europeo (Nizam-ı Cedid tardío, aprox.).'}, C: {toc: 'fez', abrigo: 'guerrera', pierna: 'vendas', mochila: 'cuero', nota: 'Aprox.'}, D: {toc: 'kabalak', abrigo: 'guerrera', pierna: 'vendas', mochila: 'lona', nota: 'Enverie/kabalak (1915).'}},
  GEN: {A: {toc: 'chaco', abrigo: 'casaca', pierna: 'pantalon', mochila: 'cuero', cor: 'blanco'}, B: {toc: 'kepi', abrigo: 'levita', pierna: 'pantalon', mochila: 'cuero', cor: 'negro'}, C: {toc: 'pickel', abrigo: 'guerrera', pierna: 'pantalon', mochila: 'cuero'},
        D: {toc: 'stahl', abrigo: 'guerrera', pierna: 'vendas', mochila: 'lona'}, E: {toc: 'stahl', abrigo: 'chaqueta', pierna: 'botas', mochila: 'no'}}};
MOD.GER = MOD.PRU; MOD.URS = MOD.RUS;
const ERAS = ['A', 'B', 'C', 'D', 'E'];
function modelo(nat, era) { const m = MOD[nat] || MOD.GEN; if (m[era]) return m[era]; const i = ERAS.indexOf(era); for (let d = 1; d < 5; d++) { if (m[ERAS[i - d]]) return m[ERAS[i - d]]; if (m[ERAS[i + d]]) return m[ERAS[i + d]]; } return MOD.GEN[era]; }
// arma larga por época y nación
function armaDe(nat, era, rango) {
  if (rango === 'jager') return era === 'A' ? 'rifle_a' : era === 'B' ? 'rifle_b' : 'cerrojo';
  return era === 'A' ? 'mosquete' : era === 'B' ? 'rifle_b' : 'cerrojo';
}

/* ===================================================================================== */
function crear(T3) {
const GB = T3._dev.GeoBuilder, P = {}; T3.RIGS.soldado.forEach((p, i) => { P[p[0]] = i; });

/* ---------- cabeza: cuello, cráneo, nariz, ojos, orejas, pelo (zona de pelo variable) y vello facial plegable ---------- */
function cabeza(g, h, o) {
  const S = Z.FIX, sk = C.piel, vs = V.SKIN;
  g.loft(h, S, sk, [[-0.02, 0.05, 0.052, 0, 0.005], [0.07, 0.05, 0.055, 0, 0.01]], 6, {});
  g.loft(h, S, sk, [[0.06, 0.03, 0.03, 0, 0.07], [0.1, 0.064, 0.072, 0, 0.022], [0.17, 0.075, 0.095, 0, 0.004], [0.24, 0.077, 0.098, 0, -0.006], [0.272, 0.055, 0.07, 0, -0.01]], 6, {capA: true, capB: true, domeB: 0.02, vr: vs, a0: Math.PI / 6});
  g.loft(h, S, C.pelo, [[0.18, 0.081, 0.1, 0, -0.014], [0.258, 0.072, 0.09, 0, -0.012]], 6, {capB: true, domeB: 0.035, a0: Math.PI / 6, vr: V.PELO});
  g.tri([0, 0.2, 0.1], [0.018, 0.15, 0.106], [0, 0.145, 0.128], h, S, sk, vs); g.tri([0, 0.2, 0.1], [0, 0.145, 0.128], [-0.018, 0.15, 0.106], h, S, sk, vs);
  [1, -1].forEach(s => { g.quad([0.032 * s - 0.015, 0.196, 0.095], [0.032 * s + 0.015, 0.196, 0.095], [0.032 * s + 0.013, 0.186, 0.097], [0.032 * s - 0.013, 0.186, 0.097], h, S, C.ojo);
    g.tri([0.078 * s, 0.205, 0.0], [0.074 * s, 0.155, 0.025], [0.078 * s, 0.2, 0.03], h, S, sk, vs); });
  g.quad([-0.045, 0.214, 0.098], [0.045, 0.214, 0.098], [0.04, 0.205, 0.104], [-0.04, 0.205, 0.104], h, S, C.pelo, V.PELO);   // cejas
  // vello facial (se pliega en el sombreador si la instancia no lo lleva; con o.barbaFija se dibuja siempre)
  const vb = o.barbaFija ? V.PELO : V.BIGOTE, vp = o.barbaFija ? V.PELO : V.PATILLAS, vf = o.barbaFija ? V.PELO : V.BARBA;
  g.quad([-0.034, 0.13, 0.121], [0.034, 0.13, 0.121], [0.028, 0.116, 0.117], [-0.028, 0.116, 0.117], h, S, C.pelo, vb);
  [1, -1].forEach(s => g.quad([0.074 * s, 0.19, 0.03], [0.07 * s, 0.13, 0.05], [0.068 * s, 0.12, 0.02], [0.074 * s, 0.185, 0.0], h, S, C.pelo, vp));
  g.tri([-0.06, 0.13, 0.08], [0, 0.06, 0.1], [0, 0.11, 0.122], h, S, C.pelo, vf); g.tri([0, 0.11, 0.122], [0, 0.06, 0.1], [0.06, 0.13, 0.08], h, S, C.pelo, vf);
  g.tri([-0.06, 0.13, 0.08], [-0.05, 0.11, 0.03], [0, 0.06, 0.1], h, S, C.pelo, vf); g.tri([0.06, 0.13, 0.08], [0, 0.06, 0.1], [0.05, 0.11, 0.03], h, S, C.pelo, vf);
  if (o.toc) tocado(g, h, o.toc, o);
}

/* ---------- tocados (cabeza: frente a y 0,215, coronilla 0,29, radio 0,08 × 0,1) ---------- */
const H = Z.HAT;
function visera(g, h, y, z, w, col, ang) { w = w || 0.085; const c = col || C.cueroN, dz = 0.06, dy = -(ang == null ? 0.025 : ang); g.quad([-w, y, z], [w, y, z], [w * 0.85, y + dy, z + dz], [-w * 0.85, y + dy, z + dz], h, Z.FIX, c); g.quad([w, y, z], [-w, y, z], [-w * 0.85, y + dy, z + dz], [w * 0.85, y + dy, z + dz], h, Z.FIX, 0x2a2420); }
function placa(g, h, y, z, s, col) { g.quad([-s, y - s, z], [s, y - s, z], [s * 0.8, y + s, z - 0.004], [-s * 0.8, y + s, z - 0.004], h, Z.FIX, col || C.laton); }
function pompon(g, h, y, z, r, col, zona) { g.octa(h, zona != null ? zona : Z.FIX, col || 0, [0, y, z], r); }
function cupula(g, h, zona, col, rings, n) { g.loft(h, zona, col || 0, rings, n || 8, {capB: true, domeB: 0.02, a0: Math.PI / 8}); }
function tocado(g, h, toc, o) {
  const lujo = o.oficial;   // galón dorado en oficiales
  switch (toc) {
    case 'chaco': g.cyl(h, H, 0, [0, 0.31, -0.004], 0.094, 0.112, 0.2, 8, {top: true}); visera(g, h, 0.222, 0.088); placa(g, h, 0.3, 0.108, 0.026, o.placa || C.laton); pompon(g, h, 0.43, 0.05, 0.026, null, Z.TRIM);
      if (lujo) g.cyl(h, Z.FIX, C.oro, [0, 0.4, -0.004], 0.113, 0.113, 0.016, 8); break;
    case 'chaco_aut': g.cyl(h, Z.FIX, C.negro, [0, 0.32, -0.006], 0.097, 0.088, 0.22, 8, {top: true}); visera(g, h, 0.222, 0.088); g.octa(h, Z.FIX, C.oro, [0, 0.4, 0.086], 0.022, {rz: 0.006}); pompon(g, h, 0.44, 0.05, 0.022, 0x2a2010); if (lujo) g.cyl(h, Z.FIX, C.oro, [0, 0.415, -0.006], 0.09, 0.089, 0.018, 8); break;
    case 'kepi': g.cyl(h, Z.MAIN, 0, [0, 0.24, 0], 0.092, 0.095, 0.05, 8); g.cyl(h, H, 0, [0, 0.31, -0.012], 0.095, 0.08, 0.1, 8, {top: true, rot: [-9, 0, 0]}); visera(g, h, 0.222, 0.088);
      if (lujo || o.galon) g.cyl(h, Z.FIX, C.oro, [0, 0.265, 0], 0.096, 0.096, 0.012, 8); break;
    case 'kepi_aut': g.cyl(h, H, 0, [0, 0.27, -0.006], 0.094, 0.098, 0.12, 8, {top: true}); visera(g, h, 0.222, 0.086); g.octa(h, Z.FIX, C.oro, [0, 0.29, 0.095], 0.015); break;
    case 'kepi_bajo': g.cyl(h, Z.TRIM, 0, [0, 0.235, 0], 0.092, 0.094, 0.04, 8); g.cyl(h, H, 0, [0, 0.28, -0.004], 0.094, 0.1, 0.05, 8, {top: true}); visera(g, h, 0.222, 0.085); g.octa(h, Z.FIX, C.oro, [0, 0.27, 0.098], 0.014); break;
    case 'gorra_campana': g.cyl(h, H, 0, [0, 0.245, 0], 0.092, 0.094, 0.05, 8); g.loft(h, H, 0, [[0.27, 0.094, 0.1, 0, 0], [0.34, 0.085, 0.09, 0, 0.04], [0.37, 0.06, 0.05, 0, 0.075]], 8, {capB: true, a0: Math.PI / 8}); visera(g, h, 0.222, 0.088, 0.08, null, 0.035); break;
    case 'ros': g.cyl(h, H, 0, [0, 0.3, -0.004], 0.096, 0.1, 0.17, 8, {top: true}); visera(g, h, 0.222, 0.088); visera(g, h, 0.222, -0.088, 0.07); g.cyl(h, Z.TRIM, 0, [0, 0.37, -0.004], 0.1, 0.1, 0.02, 8); pompon(g, h, 0.4, 0.07, 0.018, null, Z.TRIM); break;
    case 'slouch': g.cyl(h, H, 0, [0, 0.255, 0], 0.18, 0.17, 0.016, 8, {top: false, bottom: true}); g.cyl(h, H, 0, [0, 0.3, 0], 0.095, 0.085, 0.09, 8, {top: true, dome: -0.02}); g.cyl(h, Z.FIX, C.negro, [0, 0.27, 0], 0.096, 0.095, 0.02, 8); break;
    case 'salacot': g.loft(h, H, 0, [[0.2, 0.15, 0.19, 0, -0.01], [0.225, 0.1, 0.12], [0.31, 0.094, 0.11], [0.35, 0.05, 0.06]], 8, {capB: true, domeB: 0.02, a0: Math.PI / 8}); break;
    case 'casco_hs': g.loft(h, H, 0, [[0.21, 0.12, 0.16, 0, 0], [0.23, 0.098, 0.12], [0.32, 0.09, 0.1], [0.36, 0.05, 0.06]], 8, {capB: true, domeB: 0.02, a0: Math.PI / 8}); g.cyl(h, Z.FIX, C.laton, [0, 0.4, 0], 0.012, 0.0, 0.07, 4); placa(g, h, 0.29, 0.118, 0.03); break;
    case 'pickel': case 'pickel_cub': { const col = toc === 'pickel_cub' ? 0x8a8462 : C.negro;
      g.loft(h, Z.FIX, col, [[0.21, 0.1, 0.12, 0, 0], [0.27, 0.095, 0.11], [0.33, 0.07, 0.08], [0.36, 0.03, 0.035]], 8, {capB: true, a0: Math.PI / 8}); visera(g, h, 0.215, 0.1, 0.08, col); visera(g, h, 0.215, -0.1, 0.07, col, 0.04);
      if (toc === 'pickel') { placa(g, h, 0.28, 0.112, 0.035, o.placa || C.laton); g.cyl(h, Z.FIX, C.laton, [0, 0.41, 0], 0.016, 0.0, 0.09, 4); } break; }
    case 'stahl': g.loft(h, H, 0, [[0.13, 0.13, 0.145, 0, -0.015], [0.17, 0.112, 0.128, 0, -0.008], [0.21, 0.104, 0.12], [0.29, 0.098, 0.112], [0.34, 0.06, 0.07]], 8, {capB: true, domeB: 0.02, a0: Math.PI / 8, inside: false}); break;
    case 'adrian': cupula(g, h, H, 0, [[0.215, 0.1, 0.12], [0.3, 0.092, 0.11], [0.34, 0.05, 0.06]]); g.quad([0, 0.35, -0.11], [0, 0.35, 0.11], [0, 0.385, 0.07], [0, 0.385, -0.07], h, H, 0); g.quad([0, 0.35, 0.11], [0, 0.35, -0.11], [0, 0.385, -0.07], [0, 0.385, 0.07], h, H, 0);
      visera(g, h, 0.218, 0.115, 0.09, 0x4a5058, 0.03); visera(g, h, 0.218, -0.115, 0.09, 0x4a5058, 0.02); placa(g, h, 0.27, 0.118, 0.018, 0x8a8a7a); break;
    case 'brodie': g.cyl(h, H, 0, [0, 0.235, 0], 0.17, 0.165, 0.012, 8, {top: false, bottom: true}); cupula(g, h, H, 0, [[0.24, 0.105, 0.12], [0.3, 0.095, 0.105], [0.32, 0.05, 0.055]]); break;
    case 'm1': g.loft(h, H, 0, [[0.16, 0.112, 0.13, 0, -0.01], [0.21, 0.104, 0.122], [0.3, 0.096, 0.11], [0.35, 0.05, 0.06]], 8, {capB: true, domeB: 0.02, a0: Math.PI / 8}); g.strap(h, Z.FIX, 0x5a5238, [[0.1, 0.2, 0.03], [0.07, 0.1, 0.05], [0, 0.07, 0.07], [-0.07, 0.1, 0.05], [-0.1, 0.2, 0.03]], 0.014, [0, -0.3, 1]); break;
    case 'ssh40': g.loft(h, H, 0, [[0.18, 0.11, 0.128, 0, -0.008], [0.22, 0.104, 0.12], [0.3, 0.096, 0.108], [0.345, 0.05, 0.055]], 8, {capB: true, domeB: 0.025, a0: Math.PI / 8}); g.octa(h, Z.FIX, C.rojo, [0, 0.29, 0.11], 0.016); break;
    case 'm33': g.loft(h, H, 0, [[0.2, 0.118, 0.14, 0, -0.01], [0.22, 0.1, 0.12], [0.3, 0.094, 0.108], [0.345, 0.05, 0.055]], 8, {capB: true, domeB: 0.02, a0: Math.PI / 8}); break;
    case 'casco_jp': g.loft(h, H, 0, [[0.2, 0.11, 0.13, 0, -0.005], [0.22, 0.1, 0.118], [0.3, 0.094, 0.106], [0.345, 0.05, 0.055]], 8, {capB: true, domeB: 0.022, a0: Math.PI / 8}); g.octa(h, Z.FIX, 0xd0b040, [0, 0.29, 0.112], 0.014, {rz: 0.004}); break;
    case 'gorra': g.cyl(h, H, 0, [0, 0.245, 0], 0.092, 0.094, 0.05, 8); g.loft(h, H, 0, [[0.265, 0.096, 0.1], [0.29, 0.125, 0.13, 0, 0.01], [0.3, 0.12, 0.125, 0, 0.012]], 8, {capB: true, a0: Math.PI / 8}); visera(g, h, 0.222, 0.088); g.octa(h, Z.FIX, C.oro, [0, 0.26, 0.098], 0.013); break;
    case 'gorra_rusa': g.cyl(h, Z.TRIM, 0, [0, 0.235, 0], 0.093, 0.095, 0.035, 8); g.cyl(h, H, 0, [0, 0.27, 0], 0.096, 0.11, 0.04, 8, {top: true}); g.octa(h, Z.FIX, C.oro, [0, 0.24, 0.097], 0.012); break;
    case 'bicornio': g.quad([-0.2, 0.25, 0.0], [0.2, 0.25, 0.0], [0.04, 0.38, 0.03], [-0.04, 0.38, 0.03], h, Z.FIX, C.negro); g.quad([0.2, 0.25, 0.0], [-0.2, 0.25, 0.0], [-0.04, 0.38, -0.03], [0.04, 0.38, -0.03], h, Z.FIX, C.negro);
      g.quad([-0.2, 0.25, 0.0], [-0.04, 0.38, 0.03], [-0.04, 0.38, -0.03], [-0.2, 0.25, 0], h, Z.FIX, C.negro); g.octa(h, Z.TRIM, 0, [0.05, 0.33, 0.03], 0.02); g.strap(h, Z.FIX, C.oro, [[-0.2, 0.252, 0.004], [0, 0.32, 0.03], [0.2, 0.252, 0.004]], 0.01, [0, 0, 1]); break;
    case 'fez': g.cyl(h, Z.FIX, 0x9a1c1c, [0, 0.28, 0], 0.09, 0.075, 0.13, 8, {top: true}); g.strap(h, Z.FIX, C.negro, [[0, 0.345, 0], [-0.04, 0.32, -0.05], [-0.06, 0.26, -0.07]], 0.02, [1, 0, 0]); break;
    case 'kabalak': g.loft(h, H, 0, [[0.21, 0.1, 0.12], [0.27, 0.11, 0.13], [0.33, 0.08, 0.09]], 8, {capB: true, a0: Math.PI / 8}); g.cyl(h, H, 0, [0, 0.24, 0], 0.1, 0.11, 0.04, 8); break;
    case 'osos': g.loft(h, Z.FIX, C.negro, [[0.2, 0.1, 0.115], [0.36, 0.118, 0.13], [0.54, 0.075, 0.08]], 8, {capB: true, domeB: 0.03, a0: Math.PI / 8}); visera(g, h, 0.22, 0.09, 0.07); g.octa(h, Z.TRIM, 0, [0.1, 0.42, 0.02], 0.022, {ry: 0.06}); break;
    case 'jagerhut': g.cyl(h, Z.FIX, 0x2a2a24, [0, 0.245, 0], 0.15, 0.15, 0.012, 8, {bottom: true}); g.cyl(h, Z.FIX, 0x2a2a24, [0, 0.3, -0.005], 0.094, 0.07, 0.11, 8, {top: true}); g.cyl(h, Z.FIX, 0x1a2a1a, [0.06, 0.38, -0.04], 0.012, 0.045, 0.16, 4, {rot: [-30, 0, -25]}); break;
    case 'bersagliere': g.cyl(h, Z.FIX, C.negro, [0, 0.25, 0], 0.17, 0.17, 0.012, 8, {bottom: true}); g.cyl(h, Z.FIX, C.negro, [0, 0.29, 0], 0.096, 0.09, 0.07, 8, {top: true});
      for (let k = 0; k < 4; k++) g.quad([0.07, 0.3, 0.02], [0.08, 0.31, -0.02], [0.2 + k * 0.01, 0.2 - k * 0.04, -0.12 + k * 0.03], [0.19, 0.21 - k * 0.04, -0.08 + k * 0.03], h, Z.FIX, 0x14221a); break;
    case 'glengarry': g.quad([0.06, 0.22, -0.1], [0.06, 0.22, 0.1], [0.0, 0.31, 0.08], [0.0, 0.31, -0.08], h, Z.FIX, 0x1a1a2a); g.quad([-0.06, 0.22, 0.1], [-0.06, 0.22, -0.1], [0.0, 0.31, -0.08], [0.0, 0.31, 0.08], h, Z.FIX, 0x1a1a2a); g.strap(h, Z.FIX, C.negro, [[0, 0.25, -0.1], [0, 0.12, -0.14]], 0.02, [1, 0, 0]); break;
    case 'bonete_plumas': g.loft(h, Z.FIX, C.negro, [[0.2, 0.098, 0.115], [0.34, 0.12, 0.135], [0.5, 0.1, 0.11], [0.56, 0.05, 0.05]], 8, {capB: true, a0: Math.PI / 8}); g.cyl(h, Z.FIX, 0xd8d0c0, [0, 0.235, 0], 0.099, 0.1, 0.04, 8); g.box(h, Z.FIX, C.blanco, [0.08, 0.42, 0.03], [0.02, 0.18, 0.04], {rot: [0, 0, -10]}); g.strap(h, Z.FIX, C.negro, [[0, 0.3, -0.11], [0, 0.12, -0.16]], 0.04, [1, 0, 0]); break;
    case 'pilotka': g.quad([0.07, 0.23, -0.1], [0.07, 0.23, 0.1], [0.0, 0.3, 0.09], [0.0, 0.3, -0.09], h, H, 0); g.quad([-0.07, 0.23, 0.1], [-0.07, 0.23, -0.1], [0.0, 0.3, -0.09], [0.0, 0.3, 0.09], h, H, 0); g.octa(h, Z.FIX, C.rojo, [0.0, 0.26, 0.1], 0.012); break;
    default: break;
  }
}
const TOC_LOD = {chaco: 'chaco', chaco_aut: 'chaco', kepi: 'kepi', kepi_aut: 'kepi', kepi_bajo: 'gorra_rusa', gorra_campana: 'kepi', ros: 'kepi', slouch: 'sombrero', salacot: 'salacot', casco_hs: 'salacot', pickel: 'pickel', pickel_cub: 'pickel',
  stahl: 'stahl', adrian: 'adrian', brodie: 'brodie', m1: 'stahl', ssh40: 'stahl', m33: 'stahl', casco_jp: 'stahl', gorra: 'gorra', gorra_rusa: 'gorra_rusa', bicornio: 'bicornio', fez: 'fez', kabalak: 'kabalak', osos: 'osos',
  jagerhut: 'sombrero', bersagliere: 'bersagliere', glengarry: 'gorra_rusa', bonete_plumas: 'osos', pilotka: 'gorra_rusa'};

/* ---------- armas (pivote en la culata, +y hacia la boca; manos en y 0,32 y 0,82 como los clips de troops3d) ---------- */
function arma(g, a, w, o) {
  o = o || {};
  switch (w) {
    case 'mosquete': case 'rifle_a': case 'rifle_b': case 'cerrojo': case 'carabina': {
      const L = w === 'mosquete' ? 1.5 : w === 'rifle_b' ? 1.4 : w === 'rifle_a' ? 1.22 : o.era === 'E' ? 1.1 : 1.25, ls = w === 'cerrojo' ? 0.42 : 0.48;
      g.box(a, Z.FIX, C.madera, [0, ls / 2, -0.012], [0.05, ls, 0.12], {taper: 0.35, taperZ: 0.55, noTop: true, bottom: true});                 // culata
      g.box(a, Z.FIX, C.maderaO, [0, ls + (L - ls - 0.12) / 2, 0.01], [0.042, L - ls - 0.12, 0.045], {noTop: true, noBottom: true});             // caja
      g.cyl(a, Z.FIX, C.hierro, [0, (ls + L) / 2 + 0.05, 0.03], 0.011, 0.01, L - ls + 0.1, 4);                                                // cañón
      if (w === 'mosquete') { g.box(a, Z.FIX, C.hierro, [-0.028, ls + 0.04, 0.02], [0.012, 0.09, 0.04], {noTop: true}); g.tet(a, Z.FIX, C.hierro, [-0.03, ls + 0.09, 0.03], 0.018); }   // llave de chispa y pie de gato
      else if (w === 'cerrojo') { g.tet(a, Z.FIX, C.hierro, [-0.04, ls + 0.06, 0.02], 0.022); g.box(a, Z.FIX, C.hierro, [0, ls + 0.12, -0.04], [0.03, 0.08, 0.04], {noTop: true}); }   // manubrio y cargador
      else g.tet(a, Z.FIX, C.hierro, [-0.03, ls + 0.04, 0.025], 0.016);                                                                      // llave de percusión
      if (w !== 'cerrojo') [0.62, 0.95].forEach(y => g.cyl(a, Z.FIX, C.laton, [0, y, 0.02], 0.026, 0.026, 0.02, 4));                        // abrazaderas
      if (o.bayoneta) { if (w === 'cerrojo') g.box(a, Z.FIX, C.acero, [0, L + 0.17, 0.035], [0.012, 0.34, 0.03], {taper: 0.7, noTop: true});
        else g.cyl(a, Z.FIX, C.acero, [0, L + 0.22, 0.045], 0.016, 0, 0.44, 3); }
      break; }
    case 'espada': g.octa(a, Z.FIX, C.laton, [0, 0.0, 0], 0.04, {ry: 0.05}); g.box(a, Z.FIX, C.laton, [0, 0.06, 0], [0.1, 0.012, 0.02]); g.box(a, Z.FIX, 0xd8dce0, [0, 0.46, 0.0], [0.024, 0.8, 0.04], {taper: 0.7, noTop: true}); break;
    case 'sable': g.octa(a, Z.FIX, C.laton, [0, 0.0, 0], 0.04, {ry: 0.05}); g.strap(a, Z.FIX, C.laton, [[0, -0.04, 0.04], [0, 0.06, 0.06]], 0.015, [1, 0, 0]); g.box(a, Z.FIX, 0xd8dce0, [0, 0.47, 0.025], [0.022, 0.84, 0.045], {taper: 0.6, rot: [7, 0, 0], noTop: true}); break;
    case 'hacha': g.cyl(a, Z.FIX, C.madera, [0, 0.42, 0], 0.016, 0.016, 0.84, 4); g.box(a, Z.FIX, C.acero, [0, 0.8, 0.07], [0.02, 0.12, 0.16], {taperZ: -0.4}); break;
    case 'corneta': g.cyl(a, Z.FIX, C.laton, [0, 0.12, 0.0], 0.008, 0.008, 0.22, 4); g.cyl(a, Z.FIX, C.laton, [0, 0.2, -0.05], 0.009, 0.009, 0.16, 4, {rot: [0, 0, 0]}); g.cyl(a, Z.FIX, C.laton, [0, 0.32, 0.0], 0.012, 0.05, 0.1, 6); g.octa(a, Z.FIX, C.laton, [0, 0.01, 0], 0.012); break;
    case 'palillo': g.cyl(a, Z.FIX, 0xc8a880, [0, 0.16, 0], 0.008, 0.006, 0.36, 3); break;
    case 'puntero': g.cyl(a, Z.FIX, C.negro, [0, 0.18, 0], 0.012, 0.016, 0.36, 4); g.cyl(a, Z.FIX, 0xd8d0c0, [0, 0.38, 0], 0.02, 0.028, 0.04, 4); break;
    case 'baston': g.cyl(a, Z.FIX, 0x3a2a1a, [0, 0.1, 0], 0.012, 0.012, 0.6, 4); g.octa(a, Z.FIX, C.plata, [0, -0.2, 0], 0.02); break;
    case 'astil': { const lay = o.flagLayout || 'horiz';
      g.cyl(a, Z.FIX, C.madera, [0, 1.2, 0], 0.018, 0.018, 2.5, 4); g.octa(a, Z.FIX, C.oro, [0, 2.5, 0], 0.05, {ry: 0.1}); g.cyl(a, Z.FIX, C.oro, [0.03, 2.3, 0], 0.01, 0.01, 0.25, 3, {rot: [0, 0, 10]});
      g.sheet(a, [0.02, 2.42, 0], 1.0, 0.8, 4, 3, (i, j) => zonaBandera(lay, i, j)); break; }
    default: break;
  }
}
function zonaBandera(lay, i, j) { return lay === 'vert' ? Z.F1 + Math.min(2, Math.floor(i * 3 / 4)) : lay === 'horiz' ? Z.F1 + j : lay === 'cruz' ? (i === 1 || j === 1 ? Z.F2 : Z.F1) : lay === 'usa' ? (i < 2 && j < 2 ? Z.F3 : (j % 2 ? Z.F2 : Z.F1)) : (i === 1 || j === 1 ? Z.F1 : Z.F2); }

/* ---------- cuerpo ---------- */
// cotas (m): pelvis 0,90; hombros 1,40; base del cuello 1,46; coronilla 1,75; tobillo 0,08 (las del soldado de troops3d)
const TR = [[0.0, 0.165, 0.105, 0, 0.0], [0.2, 0.18, 0.12, 0, 0.012], [0.36, 0.184, 0.118, 0, 0.006], [0.45, 0.14, 0.09, 0, -0.008], [0.5, 0.06, 0.055, 0, -0.005]];
const fz = (y, x) => { const r = TR.reduce((a, b) => b[0] <= y ? b : a, TR[0]); const u = Math.min(0.98, Math.abs(x) / r[1]); return (r[4] || 0) + r[2] * Math.pow(1 - Math.pow(u, 3), 1 / 3); };
function soldado(o) {
  const g = new GB(), era = o.era, AB = era === 'A' || era === 'B', M = o.mod, coat = Z.MAIN, T = Z.TRIM, pants = Z.ACC, of = o.oficial;
  /* --- pelvis y faldones según el abrigo --- */
  if (o.kilt) { g.loft(P.pelvis, Z.FIX, C.tartan, [[-0.43, 0.2, 0.15, 0, 0.0], [-0.2, 0.19, 0.13], [0.03, 0.172, 0.112]], 8, {capA: false, p: 2.4, zoneFn: (k, i) => Z.FIX});
    g.loft(P.pelvis, Z.FIX, C.tartanR, [[-0.43, 0.2, 0.15], [-0.39, 0.201, 0.151]], 8, {p: 2.4}); g.box(P.pelvis, Z.FIX, 0xd8d0c0, [0, -0.18, 0.15], [0.14, 0.18, 0.04], {taper: -0.3, noBack: true}); }   // falda escocesa y escarcela
  else g.loft(P.pelvis, pants, 0, [[-0.13, 0.15, 0.1], [-0.04, 0.174, 0.112], [0.09, 0.165, 0.105]], 6, {capA: true, p: 2.6});
  const ab = o.abrigo || M.abrigo;
  if (ab === 'casaca') [1, -1].forEach(s => { const a = [0.03 * s, 0.04, -0.112], b = [0.15 * s, 0.04, -0.09], c = [0.09 * s, -0.38, -0.17], d = [0.015 * s, -0.38, -0.165];
    if (s > 0) { g.quad(a, b, c, d, P.pelvis, coat, 0); g.quad(a, d, c, b, P.pelvis, T, 0); } else { g.quad(a, d, c, b, P.pelvis, coat, 0); g.quad(a, b, c, d, P.pelvis, T, 0); } });
  else if (!o.kilt) { const L = ab === 'levita' ? -0.34 : ab === 'capote' ? -0.42 : ab === 'guerrera' ? -0.2 : -0.13, fl = ab === 'capote' ? 0.05 : ab === 'levita' ? 0.035 : 0.02;
    g.loft(P.pelvis, coat, 0, [[L, 0.19 + fl, 0.13 + fl * 0.6, 0, -0.01], [0.06, 0.174, 0.114]], 6, {p: 2.6});
    if (ab === 'capote') [1, -1].forEach(s => g.quad([0.06 * s, L + 0.02, 0.15], [0.17 * s, L + 0.02, 0.09], [0.15 * s, L + 0.2, 0.12], [0.07 * s, L + 0.16, 0.16], P.pelvis, T, 0));   // faldones recogidos (forro a la vista)
  }
  /* --- torso --- */
  g.loft(P.torso, coat, 0, TR, 6, {capB: true, p: 3});
  if (era < 'E' || ab !== 'chaqueta') g.loft(P.torso, T, 0, [[0.485, 0.07, 0.066], [0.55, 0.066, 0.062, 0, 0.004]], 6, {});                           // cuello alto
  else g.loft(P.torso, coat, 0, [[0.46, 0.11, 0.08], [0.53, 0.072, 0.07, 0, 0.004]], 6, {});                                                        // cuello vuelto
  if (o.pechera) g.quad([-0.07, 0.08, fz(0.08, 0.07) + 0.004], [0.07, 0.08, fz(0.08, 0.07) + 0.004], [0.09, 0.44, fz(0.44, 0.09) + 0.004], [-0.09, 0.44, fz(0.44, 0.09) + 0.004], P.torso, T, 0);   // pechera
  { const dos = ab === 'capote' || (AB && o.nat === 'RUS'), bc = era >= 'D' ? C.botonO : C.boton, nb = era === 'E' ? 4 : ab === 'capote' || (AB && o.nat === 'RUS') ? 5 : 6;
    for (let i = 0; i < nb; i++) { const y = 0.07 + i * (0.36 / (nb - 1)); (dos ? [-0.055, 0.055] : [0]).forEach(x => { const z = fz(y, x) + 0.006, r = 0.013; g.tri([x - r, y - r * 0.7, z], [x + r, y - r * 0.7, z], [x, y + r, z], P.torso, Z.FIX, bc); }); } }   // botones (un triángulo: a 3 m se lee igual)
  if (era >= 'C' && ab !== 'capote') [1, -1].forEach(s => { const z = fz(0.33, 0.1) + 0.008; g.quad([0.1 * s - 0.04, 0.3, z], [0.1 * s + 0.04, 0.3, z], [0.1 * s + 0.04, 0.36, z - 0.006], [0.1 * s - 0.04, 0.36, z - 0.006], P.torso, coat, 0); });   // bolsillos de pecho
  // hombreras / nidos de golondrina (músicos) / charreteras (oficiales A–C)
  [1, -1].forEach(s => { if (o.nidos) g.loft(P.torso, T, 0, [[0.4, 0.06, 0.07], [0.46, 0.08, 0.08]], 6, {at: [0.18 * s, 0, 0], capB: true});
    else g.box(P.torso, era >= 'C' ? coat : T, 0, [0.15 * s, 0.452, -0.004], [0.11, 0.012, 0.06], {rot: [0, 0, -28 * s]}); });
  /* --- equipo --- */
  const blanco = M.cor === 'blanco', cor = blanco ? C.correaB : C.cuero;
  if (!of && !o.musico) {
    g.loft(P.torso, Z.FIX, cor, [[0.0, 0.17, 0.11], [0.045, 0.172, 0.113]], 6, {p: 3, flatN: true}); g.box(P.torso, Z.FIX, C.hebilla, [0, 0.022, fz(0.022, 0) + 0.006], [0.055, 0.045, 0.01], {noBack: true});
    if (AB && M.cor) [1, -1].forEach(s => { const pts = [[-0.17 * s, 0.03], [-0.07 * s, 0.14], [0.06 * s, 0.3], [0.165 * s, 0.44]];
      g.strap(P.torso, Z.FIX, cor, pts.map(([x, y]) => [x, y, fz(y, x) + 0.006 + (s > 0 ? 0.002 : 0)]), 0.05, [0, 0, 1]); g.strap(P.torso, Z.FIX, cor, pts.slice().reverse().map(([x, y]) => [x, y, -fz(y, x) + 0.006]), 0.05, [0, 0, -1]);
      if (s > 0) g.box(P.torso, Z.FIX, C.laton, [0, 0.215, fz(0.215, 0) + 0.012], [0.045, 0.055, 0.01], {noBack: true}); });
    if (AB) g.box(P.torso, Z.FIX, C.cueroN, [-0.12, -0.03, -0.13], [0.2, 0.13, 0.07], {bottom: true});                                         // cartuchera trasera
    else [0.08, -0.08].forEach(x => g.box(P.torso, Z.FIX, era >= 'D' && o.nat === 'GBR' ? C.lona : C.cuero, [x, 0.01, fz(0.01, x) + 0.02], [0.07, 0.08, 0.04], {bottom: true}));   // cartucheras delanteras
    g.box(P.torso, Z.FIX, C.cueroN, [0.18, -0.13, -0.06], [0.03, 0.3, 0.04], {rot: [-12, 0, 6], taper: 0.4, noTop: true});                                    // vaina de la bayoneta
    g.box(P.torso, Z.FIX, era >= 'C' ? 0x6a6448 : 0x5a4a36, [-0.2, -0.04, -0.05], [0.05, 0.14, 0.11], {taper: 0.2, bottom: true});   // cantimplora
    g.box(P.torso, Z.FIX, era >= 'C' ? C.lona : C.cuero, [0.17, -0.07, -0.05], [0.05, 0.18, 0.19], {rot: [0, 0, 4], bottom: true});              // morral
    if (era >= 'C') g.box(P.torso, Z.FIX, C.hierro, [0.17, -0.1, -0.13], [0.02, 0.2, 0.15], {rot: [0, 0, 6]});                                 // pala de zapa
    if (era >= 'D' && o.nat !== 'GBR' && o.nat !== 'USA') g.cyl(P.torso, Z.FIX, era === 'E' ? 0x5a5e4a : 0x6a6a5a, [-0.05, -0.04, -0.17], 0.05, 0.05, 0.26, 6, {top: true, bottom: true, rot: [0, 0, 90]});   // careta antigás en bote
    if (era >= 'D' && (o.nat === 'GBR' || o.nat === 'USA')) g.box(P.torso, Z.FIX, C.lona, [0, 0.2, fz(0.2, 0) + 0.04], [0.2, 0.15, 0.07], {bottom: true});   // careta antigás en bolsa de pecho
  }
  // mochila y rollo
  if (!of && !o.musico && M.mochila !== 'no' && o.mochila !== false) {
    const col = M.mochila === 'piel' ? C.pelleja : M.mochila === 'lona' ? C.lona : C.mochila;
    g.box(P.torso, Z.FIX, col, [0, 0.27, -0.18], [0.32, 0.32, 0.11], {taper: 0.04, bottom: true});
    if (era < 'D') g.loft(P.torso, Z.FIX, era === 'A' ? C.manta : 0x5a5e6a, [[-0.18, 0.05, 0.05], [0.18, 0.05, 0.05]], 6, {axis: 'x', at: [0, 0.47, -0.17], capA: true, capB: true});   // manta / capote sobre la mochila
    else g.box(P.torso, Z.FIX, C.hierro, [0, 0.4, -0.25], [0.15, 0.06, 0.04]);                                                                // marmita
    [1, -1].forEach(s => g.strap(P.torso, Z.FIX, cor, [[0.12 * s, 0.44, fz(0.44, 0.12) + 0.004], [0.12 * s, 0.25, fz(0.25, 0.12) + 0.006], [0.15 * s, 0.08, fz(0.08, 0.15) + 0.005]], 0.035, [0, 0, 1]));
  }
  const rollo = o.rollo || M.rollo;
  if (!of && (rollo === 'capote_hombro' || rollo === 'manta_hombro')) {      // capote o manta en bandolera, del hombro izquierdo a la cadera derecha
    const col = rollo === 'capote_hombro' ? 0x6a6458 : 0x7a6a50, pts = [[0.17, 0.47, 0], [0.06, 0.3, 0], [-0.08, 0.12, 0], [-0.18, 0.0, 0]];
    g.tube(P.torso, Z.FIX, col, [0.17, 0.47, fz(0.4, 0.15) + 0.03], [-0.18, 0.0, fz(0.0, 0.17) + 0.03], [[0, 0.045], [0.5, 0.052], [1, 0.045]], 6);
    g.tube(P.torso, Z.FIX, col, [-0.18, 0.0, -fz(0.0, 0.17) - 0.03], [0.17, 0.47, -fz(0.4, 0.15) - 0.03], [[0, 0.045], [0.5, 0.05], [1, 0.045]], 6);
  }
  /* --- rango --- */
  if (of) {
    if (AB) { g.loft(P.torso, Z.FIX, o.nat === 'GBR' ? C.carmesi : C.oro, [[0.03, 0.176, 0.116], [0.09, 0.18, 0.12]], 6, {p: 3, flatN: true}); g.box(P.torso, Z.FIX, o.nat === 'GBR' ? C.carmesi : C.oro, [0.15, -0.08, 0.06], [0.05, 0.2, 0.02], {rot: [0, 0, 10]});   // faja y borla
      if (era === 'A') g.quad([-0.06, 0.4, fz(0.4, 0.06) + 0.012], [0.06, 0.4, fz(0.4, 0.06) + 0.012], [0.035, 0.36, fz(0.36, 0.035) + 0.014], [-0.035, 0.36, fz(0.36, 0.035) + 0.014], P.torso, Z.FIX, C.plata); }   // gola
    else { g.loft(P.torso, Z.FIX, C.cuero, [[0.0, 0.17, 0.11], [0.045, 0.172, 0.113]], 6, {p: 3, flatN: true}); g.strap(P.torso, Z.FIX, C.cuero, [[-0.17, 0.03], [0.165, 0.44]].map(([x, y]) => [x, y, fz(y, x) + 0.006]), 0.032, [0, 0, 1]); }   // Sam Browne
    g.box(P.torso, Z.FIX, C.cueroN, [-0.19, -0.08, 0.03], [0.04, 0.14, 0.08], {bottom: true});                                                  // cartera / pistolera
    if (era >= 'D') { g.box(P.torso, Z.FIX, 0x2a2a26, [-0.05, 0.25, fz(0.25, 0.05) + 0.04], [0.11, 0.07, 0.05]); }                           // prismáticos
    if (era <= 'D') g.tube(P.pelvis, Z.FIX, era <= 'C' ? 0x3a3a3c : C.cuero, [0.19, 0.02, 0.05], [0.2, -0.72, -0.28], [[0, 0.018], [1, 0.012]], 4);   // vaina del sable
  }
  if (o.musico) {   // tahalí del instrumento
    g.strap(P.torso, Z.FIX, o.musico === 'tambor' ? C.correaB : T === Z.TRIM ? C.correaB : C.correaB, [[0.165, 0.44], [0.06, 0.3], [-0.07, 0.14], [-0.17, 0.03]].map(([x, y]) => [x, y, fz(y, x) + 0.007]), 0.045, [0, 0, 1]);
    g.loft(P.torso, Z.FIX, cor, [[0.0, 0.17, 0.11], [0.045, 0.172, 0.113]], 6, {p: 3, flatN: true});
  }
  if (o.mandil) g.quad([-0.14, 0.42, fz(0.42, 0.14) + 0.02], [0.14, 0.42, fz(0.42, 0.14) + 0.02], [0.16, -0.05, fz(-0.05, 0.16) + 0.03], [-0.16, -0.05, fz(-0.05, 0.16) + 0.03], P.torso, Z.FIX, 0xd8ccb0),
    g.quad([-0.16, 0.0, 0.16], [0.16, 0.0, 0.16], [0.17, -0.4, 0.17], [-0.17, -0.4, 0.17], P.pelvis, Z.FIX, 0xd8ccb0);                       // mandil de cuero blanco (zapadores)
  if (o.abanderado) g.strap(P.torso, Z.FIX, C.correaB, [[0.165, 0.44], [0.06, 0.3], [-0.07, 0.14], [-0.17, 0.03]].map(([x, y]) => [x, y, fz(y, x) + 0.007]), 0.06, [0, 0, 1]);
  if (o.gaita) { g.loft(P.torso, Z.FIX, C.tartan, [[-0.08, 0.07, 0.06], [0.0, 0.1, 0.08], [0.09, 0.07, 0.06]], 6, {at: [0.2, 0.22, 0.12], rot: [0, 0, -70], capA: true, capB: true});   // bolsa bajo el brazo
    [0, 1, 2].forEach(k => g.cyl(P.torso, Z.FIX, C.negro, [0.17 + k * 0.03, 0.62 + k * 0.05, -0.02 - k * 0.04], 0.012, 0.009, 0.42 + k * 0.08, 4, {rot: [-25 - k * 6, 0, 18 + k * 4]})); }   // roncones
  /* --- cabeza --- */
  cabeza(g, P.cabeza, {toc: o.toc, oficial: of, placa: o.placa, barbaFija: o.barbaFija, galon: o.galones >= 2});
  /* --- brazos (pivote en el hombro; brazo 0,29 m, antebrazo 0,27 m) --- */
  [['brazoIz', 'antebrazoIz', 1], ['brazoDe', 'antebrazoDe', -1]].forEach(([u, l, s]) => {
    g.loft(P[u], coat, 0, [[-0.29, 0.045, 0.05], [-0.12, 0.058, 0.064, 0.005 * s, 0], [0.03, 0.06, 0.064]], 6, {capB: true, domeB: 0.02});
    if (of && AB) g.loft(P[u], Z.FIX, C.oro, [[0.0, 0.08, 0.075], [0.04, 0.062, 0.058]], 6, {at: [0.012 * s, 0, 0], capB: true});           // charretera
    if (o.galones) for (let k = 0; k < o.galones; k++) { const y = -0.1 - k * 0.028, x = 0.06 * s; g.strap(P[u], Z.FIX, o.galonCol || C.oro, [[x, y, 0.035], [x + 0.003 * s, y - 0.03, 0.0], [x, y, -0.035]], 0.012, [s, 0, 0]); }   // galones de cabo / sargento
    g.loft(P[l], coat, 0, [[-0.215, 0.038, 0.04], [-0.1, 0.046, 0.05, 0, 0.004], [0.02, 0.046, 0.05]], 6, {});
    g.loft(P[l], T, 0, [[-0.235, 0.044, 0.046], [-0.17, 0.05, 0.052]], 6, {capA: true});                                                     // vuelta
    g.loft(P[l], Z.FIX, C.piel, [[-0.24, 0.032, 0.024], [-0.32, 0.042, 0.024, 0, 0.012]], 6, {capB: true, vr: V.SKIN, p: 3});                  // mano
    g.tet(P[l], Z.FIX, C.piel, [0.03 * s, -0.29, 0.034], 0.022, {rot: [-30, 0, 25 * s], vr: V.SKIN});            // pulgar
  });
  if (o.catalejo) g.loft(P.antebrazoIz, Z.FIX, C.laton, [[-0.04, 0.022, 0.022], [0.2, 0.016, 0.016]], 6, {axis: 'z', at: [0, -0.3, 0.02], capA: true, capB: true});
  if (o.musico === 'tambor') g.cyl(P.antebrazoIz, Z.FIX, 0xc8a880, [0, -0.3, 0.14], 0.008, 0.006, 0.36, 3, {rot: [90, 0, 0]});                  // palillo izquierdo
  /* --- piernas --- */
  const pie = o.pierna || M.pierna;
  [['musloIz', 'piernaIz', 'pieIz', 1], ['musloDe', 'piernaDe', 'pieDe', -1]].forEach(([u, l, f, s]) => {
    if (o.kilt) { g.loft(P[u], Z.FIX, C.piel, [[-0.43, 0.052, 0.058], [-0.1, 0.075, 0.08], [0.02, 0.085, 0.088]], 6, {vr: V.SKIN}); g.loft(P[l], Z.FIX, 0xc8b8a0, [[-0.33, 0.046, 0.052], [-0.05, 0.058, 0.064], [0.03, 0.058, 0.062]], 6, {}); }
    else { g.loft(P[u], pants, 0, [[-0.43, 0.055, 0.06], [-0.18, 0.074, 0.08, 0.005 * s, 0.004], [0.04, 0.088, 0.09]], 6, {});
      if (pie === 'botas') g.loft(P[l], Z.FIX, C.bota, [[-0.34, 0.047, 0.054], [-0.04, 0.058, 0.066], [0.03, 0.06, 0.066]], 6, {});
      else if (pie === 'vendas') { g.loft(P[l], Z.FIX, C.venda, [[-0.33, 0.044, 0.05], [-0.13, 0.054, 0.062, 0, -0.006]], 6, {}); g.loft(P[l], pants, 0, [[-0.13, 0.055, 0.064], [0.03, 0.058, 0.062]], 6, {});
        [-0.28, -0.2].forEach(y => g.strap(P[l], Z.FIX, 0x5a5440, [[0.05, y, 0.03], [-0.05, y - 0.02, 0.03]], 0.008, [0, 0, 1])); }
      else if (pie === 'polaina_b' || pie === 'polaina_n' || pie === 'leggins') { const c = pie === 'polaina_b' ? C.blanco : pie === 'polaina_n' ? C.negro : 0x8a8264;
        g.loft(P[l], Z.FIX, c, [[-0.34, 0.048, 0.054], [-0.18, 0.055, 0.062]], 6, {}); g.loft(P[l], pants, 0, [[-0.18, 0.054, 0.061], [0.03, 0.058, 0.062]], 6, {});
        for (let i = 0; i < 3; i++) g.quad([0.05 * s, -0.31 + i * 0.05, 0.0], [0.05 * s, -0.31 + i * 0.05, 0.013], [0.05 * s, -0.3 + i * 0.05, 0.013], [0.05 * s, -0.3 + i * 0.05, 0.0], P[l], Z.FIX, C.botonB); }
      else g.loft(P[l], pants, 0, [[-0.36, 0.05, 0.057], [-0.1, 0.055, 0.063], [0.03, 0.058, 0.062]], 6, {});
    }
    g.loft(P[f], Z.FIX, pie === 'botas' ? C.bota : C.cueroN, [[-0.065, 0.036, 0.034, 0, -0.045], [0.02, 0.046, 0.05, 0, -0.035], [0.175, 0.034, 0.02, 0, -0.062]], 6, {axis: 'z', capA: true, capB: true, domeB: 0.012, p: 2.4});
    g.quad([-0.04, -0.081, -0.07], [0.04, -0.081, -0.07], [0.042, -0.081, 0.19], [-0.042, -0.081, 0.19], P[f], Z.FIX, C.suela);
  });
  if (o.musico === 'tambor') { g.cyl(P.musloIz, Z.FIX, C.laton, [0.06, -0.08, 0.12], 0.17, 0.17, 0.26, 8, {rot: [0, 0, 0], top: true, topColor: 0xe8e0c8, topZone: Z.FIX}); g.cyl(P.musloIz, T, 0, [0.06, 0.06, 0.12], 0.175, 0.175, 0.04, 8); g.cyl(P.musloIz, T, 0, [0.06, -0.22, 0.12], 0.175, 0.175, 0.04, 8); }   // tambor (cuerpo de latón y aros del color de ribete)
  arma(g, P.arma, o.arma, o);
  return g;
}

/* ---------- LOD1 (≤ 60 triángulos) y LOD2 (≤ 10) ---------- */
const HAT1 = {chaco: [[0.25, 0.22, 0.25], 0.33, Z.HAT], kepi: [[0.24, 0.14, 0.25], 0.3, Z.HAT], gorra_rusa: [[0.25, 0.08, 0.25], 0.28, Z.HAT], sombrero: [[0.4, 0.09, 0.4], 0.29, Z.HAT], salacot: [[0.32, 0.16, 0.38], 0.3, Z.HAT],
  pickel: [[0.25, 0.22, 0.28], 0.32, Z.FIX, C.negro], stahl: [[0.3, 0.16, 0.32], 0.27, Z.HAT], adrian: [[0.28, 0.14, 0.34], 0.29, Z.HAT], brodie: [[0.38, 0.07, 0.38], 0.27, Z.HAT], gorra: [[0.28, 0.07, 0.3], 0.3, Z.HAT],
  bicornio: [[0.42, 0.14, 0.1], 0.31, Z.FIX, C.negro], fez: [[0.19, 0.14, 0.19], 0.29, Z.FIX, 0x9a1c1c], kabalak: [[0.24, 0.12, 0.26], 0.28, Z.HAT], osos: [[0.26, 0.36, 0.28], 0.38, Z.FIX, C.negro], bersagliere: [[0.36, 0.09, 0.36], 0.28, Z.FIX, C.negro]};
function sombrero1(g, h, toc, top) { const d = HAT1[TOC_LOD[toc] || 'kepi'] || HAT1.kepi, [s, y, z, c] = d; if (top) { const w = s[0] / 2, dd = s[2] / 2, yy = y + s[1] / 2; g.quad([-w, yy, dd], [w, yy, dd], [w, yy, -dd], [-w, yy, -dd], h, z, c || 0); return; } g.box(h, z, c || 0, [0, y, 0], s, {bottom: false}); }
function lod(o, nivel) {
  const g = new GB();
  if (nivel === 2) { g.box(P.torso, Z.MAIN, 0, [0, -0.08, 0], [0.42, 1.84, 0.26], {noTop: true, taper: -0.12}); sombrero1(g, P.cabeza, o.toc, true); return g; }   // 8 + 2
  g.box(P.torso, Z.MAIN, 0, [0, 0.12, 0], [0.44, 0.8, 0.25], {taper: -0.05});                                                              // 10
  g.octa(P.cabeza, Z.FIX, C.piel, [0, 0.12, 0.005], 0.13, {ry: 0.14, vr: V.SKIN});                                                       // 8
  if (o.toc) sombrero1(g, P.cabeza, o.toc);                                                                                               // 10
  ['musloIz', 'musloDe'].forEach(k => g.cyl(P[k], o.kilt ? Z.FIX : Z.ACC, o.kilt ? C.tartan : 0, [0, -0.43, 0.01], 0.06, 0.085, 0.9, 3));   // 12
  if (!o.unBrazo) g.cyl(P.brazoIz, Z.MAIN, 0, [0, -0.26, 0], 0.05, 0.065, 0.56, 3);                                                        // 6
  g.cyl(P.brazoDe, Z.MAIN, 0, [0, -0.26, 0], 0.05, 0.065, 0.56, 3);                                                                       // 6
  if (o.abanderado) { g.cyl(P.arma, Z.FIX, C.madera, [0, 1.25, 0], 0.025, 0.025, 2.5, 2); g.quad([0.02, 2.42, 0], [1.0, 2.42, 0], [1.0, 1.62, 0], [0.02, 1.62, 0], P.arma, Z.F1, 0); }   // 4 + 2 (el lote es de doble cara)
  else if (o.musico === 'tambor') g.cyl(P.musloIz, Z.FIX, C.laton, [0.06, -0.08, 0.12], 0.17, 0.17, 0.26, 3);                             // 6
  else if (o.arma && o.arma !== 'ninguna') { const L = {mosquete: 1.94, rifle_a: 1.5, rifle_b: 1.8, cerrojo: 1.5, espada: 0.84, sable: 0.9, hacha: 0.9, corneta: 0.35, puntero: 0.4, palillo: 0.36, baston: 0.6}[o.arma] || 1.2;
    g.cyl(P.arma, Z.FIX, o.arma === 'espada' || o.arma === 'sable' ? 0xd8dce0 : C.maderaO, [0, L / 2, 0], 0.03, 0.02, L, 3); }         // 6
  return g;
}

/* ---------- tipos (KINDS) por rango ---------- */
const RANGO = {
  soldado: {pal: 'linea', nombre: 'Soldado de infantería'},
  cabo: {pal: 'linea', nombre: 'Cabo', galones: 2, galonCol: null},
  sargento: {pal: 'linea', nombre: 'Sargento', galones: 3},
  teniente: {pal: 'linea', nombre: 'Teniente', oficial: true, arma: 'espada'},
  capitan: {pal: 'linea', nombre: 'Capitán (a pie; a caballo en caballeria3d)', oficial: true, arma: 'sable', catalejo: true},
  abanderado: {pal: 'linea', nombre: 'Portabandera', abanderado: true, arma: 'astil', dobleCara: true, unBrazo: false},
  corneta: {pal: 'linea', nombre: 'Corneta', musico: 'corneta', arma: 'corneta', nidos: true},
  tambor: {pal: 'linea', nombre: 'Tambor', musico: 'tambor', arma: 'palillo', nidos: true},
  gaitero: {pal: 'linea', nombre: 'Gaitero (regimientos escoceses)', musico: 'gaita', arma: 'puntero', gaita: true, kilt: true, naciones: ['GBR']},
  zapador: {pal: 'linea', nombre: 'Zapador (hacha y mandil)', arma: 'hacha', mandil: true, barbaFija: true},
  jager: {pal: 'ligera', nombre: 'Tirador / jäger (fusil rayado)', mochila: false},
  granadero: {pal: 'guardia', nombre: 'Granadero (gorro alto)'}};
function opciones(rango, era, nat) {
  const R = RANGO[rango], M = modelo(nat, era), AB = era === 'A' || era === 'B';
  let toc = M.toc;
  if (rango === 'granadero' && era <= 'C') toc = nat === 'GBR' || nat === 'FRA' || nat === 'RUS' || nat === 'PRU' ? (nat === 'PRU' ? 'pickel' : 'osos') : M.toc;
  if (rango === 'jager') toc = nat === 'ITA' && era <= 'C' ? 'bersagliere' : nat === 'AUT' && era <= 'B' ? 'jagerhut' : M.toc;
  if (rango === 'gaitero') toc = era <= 'C' ? 'bonete_plumas' : era === 'D' ? 'glengarry' : 'glengarry';
  if (R.oficial && era >= 'D') toc = era === 'E' && (nat === 'PRU' || nat === 'GER' || nat === 'RUS' || nat === 'URS') ? M.toc : 'gorra';
  if (R.oficial && era === 'A' && nat === 'GBR' && rango === 'capitan') toc = 'chaco';
  if (rango === 'zapador' && AB && (nat === 'FRA' || nat === 'GBR')) toc = 'osos';
  const arma = R.arma || armaDe(nat, era, rango), cabo = rango === 'cabo' || rango === 'sargento';
  return Object.assign({}, R, {era, nat, rango, mod: M, toc, arma: R.oficial && era === 'E' ? 'baston' : arma, galones: R.galones ? (era === 'A' && rango === 'cabo' ? 1 : R.galones) : 0, galonCol: cabo && era >= 'D' ? 0x5a5238 : C.oro,
    bayoneta: !R.oficial && !R.musico && rango !== 'abanderado' && rango !== 'zapador' && (AB || era === 'D'), flagLayout: (T3.NACIONES[nat] || T3.NACIONES.GEN).bandera, modelo: `${nat}_${era}_${rango}`, placa: era === 'A' && nat === 'GBR' ? C.laton : null});
}
const TIPOS = {};
Object.keys(RANGO).forEach(r => { TIPOS['inf_' + r] = {rig: 'soldado', clase: 'inf', pal: RANGO[r].pal, nombre: RANGO[r].nombre, eras: ERAS.slice(), dobleCara: !!RANGO[r].dobleCara, naciones: RANGO[r].naciones || null,
  o: (era, nat) => opciones(r, era, nat || 'GEN'), build: o => soldado(o), lod: (o, l) => lod(o, l)}; });

return {soldado, lod, opciones, TIPOS, modelo, tocado, arma, cabeza, RANGO, P};
}

/* ===================================================================================== */
/* VARIACIÓN POR INSTANCIA (lotes GPU de troops3d)
   iVar = (complexión −1 delgado … 0 medio … 1 recio, vello 0 nada · 1 bigote · 2 bigote y patillas · 3 barba, pelo 0–3, desgaste propio 0–1)
   desgaste.value (0–1, global): el juego lo sube con el tiempo de combate. Barro en las piernas, polvo en la ropa, sangre en el torso.
   Las figuras sin variar llevan complexión media y no muestran vello (los vértices de vello se pliegan). */
const desgaste = {value: 0};
const PELOS = [0x2a1e14, 0x5a3e24, 0x8a6a3a, 0x8a8478];
function prepararLote(lote) {
  if (!lote || lote._iVar) return lote; const cap = lote.cap || lote.mesh.instanceMatrix.count, geo = lote.mesh.geometry;
  lote._iVar = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4); lote._iVar.setUsage(THREE.DynamicDrawUsage); geo.setAttribute('iVar', lote._iVar);
  const mat = lote.mesh.material, prev = mat.onBeforeCompile, key = mat.customProgramCacheKey ? mat.customProgramCacheKey() : '';
  mat.onBeforeCompile = function (sh, r) {
    if (prev) prev.call(this, sh, r);
    sh.uniforms.uDesgaste = desgaste; sh.uniforms.uPelo = {value: PELOS.map(h => new THREE.Color(h))};
    sh.vertexShader = sh.vertexShader.replace('attribute vec4 iLook;', 'attribute vec4 iLook; attribute vec4 iVar; uniform float uDesgaste; uniform vec3 uPelo[4];\nfloat h13(vec3 p){ p = fract(p * 0.3183 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }')
      .replace('vec3 pos0 = position;', `vec3 pos0 = position;
{ float cx = iVar.x, ap = aPart;                                            // complexión: ensancha o estrecha torso, pelvis y miembros alrededor de su eje
  float k = ap < 1.5 ? 0.11 : (ap > 2.5 && ap < 10.5 && ap != 11.0) ? 0.08 : 0.0;
  float ax = ap > 2.5 && ap < 4.5 ? 0.205 : ap > 4.5 && ap < 6.5 ? -0.205 : ap > 6.5 && ap < 8.5 ? 0.095 : ap > 8.5 && ap < 10.5 ? -0.095 : 0.0;
  pos0.x = ax + (pos0.x - ax) * (1.0 + cx * k); pos0.z *= 1.0 + cx * k * (ap < 1.5 ? 1.2 : 1.0);
  float vb = iVar.y;                                                       // vello: 4 bigote, 5 patillas, 3 barba
  bool oculto = (aVar > 3.5 && aVar < 4.5 && vb < 0.5) || (aVar > 4.5 && aVar < 5.5 && vb < 1.5) || (aVar > 2.5 && aVar < 3.5 && vb < 2.5);
  if (oculto) pos0 = vec3(0.0, 1.62, 0.0); }`)
      .replace('vColor = zc * (', `if (aVar > 2.5) zc = uPelo[int(clamp(iVar.z, 0.0, 3.0))];
vColor = zc * (`)
      .replace('#include <color_vertex>', '#include <color_vertex>');
    sh.vertexShader = sh.vertexShader.replace(/(vColor = zc \* \([^;]*;)/, `$1
{ float w = clamp(uDesgaste * (0.55 + 0.9 * iVar.w), 0.0, 1.0);
  if (w > 0.001) { float hy = position.y, n = h13(position * 13.7 + iLook.x);
    float barro = smoothstep(0.62, 0.08, hy) * w * (0.6 + 0.4 * n);                                  // barro de las botas a las rodillas
    vColor = mix(vColor, vec3(0.16, 0.12, 0.08), barro * 0.85);
    if (aZone < 3.5) vColor = mix(vColor, vec3(0.42, 0.38, 0.31), w * 0.3);                         // polvo en la ropa
    if (aPart > 0.5 && aPart < 1.5 && n > 0.83 - 0.25 * w && w > 0.4) vColor = mix(vColor, vec3(0.22, 0.03, 0.02), (w - 0.4) * 1.3);   // sangre
    if (aVar > 0.5 && aVar < 1.5) vColor *= 1.0 - 0.25 * w * n; } }`);
  };
  mat.customProgramCacheKey = () => key + '|inf3d';
  mat.needsUpdate = true; return lote;
}
function variar(lote, i, v) { prepararLote(lote); v = v || {}; lote._iVar.setXYZW(i, v.complexion || 0, v.barba || 0, v.pelo || 0, v.desgaste != null ? v.desgaste : 0.5); lote._iVar.needsUpdate = true; }
// sorteo verosímil por época: más barbas en B, más bigotes en C–D, afeitados en E (aprox. por fotografías de la época)
function variacionAleatoria(era, rnd) { rnd = rnd || Math.random; const r = rnd(), pv = {A: [0.55, 0.25, 0.15, 0.05], B: [0.3, 0.25, 0.2, 0.25], C: [0.3, 0.45, 0.1, 0.15], D: [0.4, 0.5, 0.03, 0.07], E: [0.85, 0.13, 0.01, 0.01]}[era] || [0.5, 0.3, 0.1, 0.1];
  let acc = 0, b = 0; for (let k = 0; k < 4; k++) { acc += pv[k]; if (r < acc) { b = k; break; } }
  const c = rnd(); return {complexion: c < 0.25 ? -1 : c < 0.8 ? 0 : 1, barba: b, pelo: Math.floor(rnd() * 4), desgaste: rnd()}; }

/* ===================================================================================== */
/* ANIMACIONES (formato CLIPS.soldado de troops3d: grados Euler XYZ; armaP/armaR en el espacio del torso; agarre escalonado; raíz en m)
   Convenios del esqueleto: muslo rx < 0 = adelante; rodilla rx > 0 = flexión; pie rx > 0 = punta abajo; torso rx > 0 = inclinarse;
   cabeza rx < 0 = mirar arriba; brazo rx < 0 = levantar al frente (−90 horizontal, −170 vertical); antebrazo rx < 0 = doblar el codo;
   brazoIz rz > 0 y brazoDe rz < 0 = separar del cuerpo; ry > 0 = girar a la izquierda. El soldado mira hacia +z. */
const D2R = Math.PI / 180;
function rotDe(dx, dy, dz) { const v = new THREE.Vector3(dx, dy, dz).normalize(), q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), v), e = new THREE.Euler().setFromQuaternion(q, 'XYZ'); return [e.x / D2R, e.y / D2R, e.z / D2R]; }
// posiciones del arma (torso); g = [y mano derecha, y mano izquierda] a lo largo del arma (−1 = mano libre)
const W = {
  ORDEN: {P: [-0.27, -0.95, 0.1], R: [0, 0, 0], g: [0.92, -1]}, HOMBRO: {P: [-0.25, 0.08, 0.17], R: [-32, 0, -6], g: [0.1, -1]}, APUNTA: {P: [-0.15, 0.38, 0.06], R: [90, 3, 0], g: [0.32, 0.82]},
  LISTO: {P: [-0.12, -0.02, 0.24], R: [52, 0, -6], g: [0.42, 0.74]}, BAYO: {P: [-0.14, -0.08, 0.22], R: [76, 0, 0], g: [0.3, 0.85]}, BAYO_ALTA: {P: [-0.14, 0.02, 0.2], R: [62, 0, 0], g: [0.3, 0.85]},
  PORTA: {P: [-0.04, 0.04, 0.2], R: [8, 0, -30], g: [0.3, 0.72]}, PREPAREN: {P: [-0.12, -0.12, 0.26], R: [22, 0, -8], g: [0.34, 0.62]}, CARGA: {P: [0.02, -0.95, 0.34], R: [10, 0, 0], g: [-1, 0.95]},
  CARGA_RODILLA: {P: [0.02, -0.55, 0.36], R: [12, 0, 0], g: [-1, 0.75]}, CEBAR: {P: [-0.16, -0.12, 0.3], R: [80, 0, -8], g: [-1, 0.62]}, FUNERALA: {P: [0.13, 0.38, 0.22], R: [-143, 0, 0], g: [-1, 0.35]},
  DISCRECION: {P: [-0.25, 0.02, -0.62], R: [100, 0, 0], g: [0.7, -1]}, CUADRO1: {P: [-0.1, -0.5, 0.22], R: [48, 0, 0], g: [0.3, 0.8]}, CULATA_ARRIBA: {P: [-0.05, 0.5, 0.1], R: [-150, 0, 10], g: [1.0, 0.55]},
  HORIZONTAL: {P: [0.45, 0.25, 0.32], R: [0, 0, 90], g: [0.62, 0.15]}, ESPALDA: {P: [0.05, 0.12, -0.17], R: [0, 0, 28], g: [-1, -1]}, SUELO: {P: [0.6, -0.9, 0.5], R: [0, 0, 90], g: [-1, -1]},
  // espada / sable (empuñadura en el pivote)
  ESP_BAJA: {P: [-0.27, -0.1, 0.08], R: [180, 0, 0], g: [0, -1]}, ESP_ALTA: {P: [-0.25, 0.86, 0.12], R: [-12, 0, 8], g: [0, -1]}, ESP_FRENTE: {P: [-0.22, 0.42, 0.5], R: [84, 0, 0], g: [0, -1]},
  ESP_GUARDIA: {P: [-0.12, 0.12, 0.42], R: [40, 0, -10], g: [0, -1]}, ESP_TAJO_ARRIBA: {P: [-0.18, 0.72, 0.18], R: [-40, 0, 20], g: [0, -1]}, ESP_TAJO_ABAJO: {P: [-0.05, 0.05, 0.5], R: [110, 0, -20], g: [0, -1]},
  ESP_PARADA: {P: [-0.1, 0.48, 0.38], R: [10, 0, 75], g: [0, -1]}, ESP_ESTOCADA: {P: [-0.16, 0.36, 0.62], R: [88, 0, 0], g: [0, -1]},
  // instrumentos
  CORNETA: {P: [0.0, 0.6, 0.15], R: [72, 0, 0], g: [0.18, -1]}, CORNETA_LADO: {P: [-0.24, -0.25, 0.06], R: [180, 0, 0], g: [-1, -1]},
  CHANTER: {P: [0.02, 0.28, 0.22], R: [165, 0, 0], g: [0.3, 0.12]}, BANDERA_ALTA: {P: [-0.1, -0.1, 0.24], R: [-4, 0, -6], g: [0.95, 0.55]}, BANDERA_HOMBRO: {P: [-0.18, -0.35, 0.12], R: [-18, 0, -14], g: [0.62, -1]},
  BANDERA_ONDEA: {P: [-0.06, -0.12, 0.2], R: [-4, 0, -10], g: [0.62, 0.3]}, BANDERA_CLAVAR: {P: [-0.05, -0.2, 0.32], R: [5, 0, 0], g: [0.55, 0.85]}};
W.PALILLO_ARR = {P: [-0.03, -0.02, 0.27], R: rotDe(0.7, 0.2, -0.3), g: [0.02, -1]}; W.PALILLO_ABA = {P: [-0.02, -0.07, 0.24], R: rotDe(0.75, -0.45, -0.45), g: [0.02, -1]};
const AW = (a, m) => ({P: a.P.map((v, i) => v + (m.P ? m.P[i] : 0)), R: a.R.map((v, i) => v + (m.R ? m.R[i] : 0)), g: m.g || a.g});
// posturas del cuerpo
const PIE = {pelvis: [0, 0, 0], torso: [0, 0, 0], cabeza: [0, 0, 0], musloIz: [-3, 0, 2], musloDe: [2, 0, -2], piernaIz: [2, 0, 0], piernaDe: [2, 0, 0], pieIz: [0, 0, 0], pieDe: [0, 0, 0]};
const FIRME = Object.assign({}, PIE, {musloIz: [0, 0, 1], musloDe: [0, 0, -1], piernaIz: [0, 0, 0], piernaDe: [0, 0, 0]});
const TIRADOR = {pelvis: [0, 0, 0], musloIz: [-16, 0, 4], musloDe: [6, 0, -4], piernaIz: [6, 0, 0], piernaDe: [2, 0, 0], pieIz: [0, 0, 0], pieDe: [0, 0, 0], torso: [4, -14, 0], cabeza: [10, -4, 4]};
const RODILLA = {pelvis: [0, 0, 0], pieIz: [0, 0, 0], pieDe: [72, 0, 0], musloIz: [-85, 0, 4], piernaIz: [85, 0, 0], musloDe: [-8, 0, -4], piernaDe: [95, 0, 0], torso: [4, 0, 0], cabeza: [0, 0, 0]};
const RODILLA_TIRO = Object.assign({}, RODILLA, {torso: [6, -16, 0], cabeza: [10, -4, 4]});
const SENTADO = {pelvis: [-75, 0, 0], torso: [55, 0, 0], cabeza: [12, 0, 0], musloIz: [-25, 0, 10], musloDe: [-25, 0, -10], piernaIz: [100, 0, 0], piernaDe: [100, 0, 0], pieIz: [-10, 0, 0], pieDe: [-10, 0, 0]};
const AGACHADO = {pelvis: [10, 0, 0], torso: [22, 0, 0], cabeza: [-20, 0, 0], musloIz: [-78, 0, 8], piernaIz: [110, 0, 0], musloDe: [-50, 0, -8], piernaDe: [100, 0, 0], pieIz: [-20, 0, 0], pieDe: [10, 0, 0]};
const TUMBADO_ESP = {pelvis: [-88, 0, 0], torso: [0, 0, 0], cabeza: [30, 0, 0], musloIz: [0, 0, 6], musloDe: [0, 0, -6], piernaIz: [4, 0, 0], piernaDe: [4, 0, 0], pieIz: [-60, 0, 0], pieDe: [-60, 0, 0]};
const BOCA_ABAJO = {pelvis: [88, 0, 0], torso: [-18, 0, 0], cabeza: [-58, 0, 0], musloIz: [0, 0, 8], musloDe: [0, 0, -8], piernaIz: [12, 0, 0], piernaDe: [8, 0, 0], pieIz: [78, 0, 10], pieDe: [78, 0, -10]};
const mezcla = (a, b, k) => { const o = {}; new Set([...Object.keys(a), ...Object.keys(b)]).forEach(p => { const x = a[p] || [0, 0, 0], y = b[p] || [0, 0, 0]; o[p] = x.map((v, i) => v + (y[i] - v) * k); }); return o; };
const mas = (a, b) => { const o = Object.assign({}, a); Object.entries(b).forEach(([p, v]) => { const x = o[p] || [0, 0, 0]; o[p] = x.map((q, i) => q + v[i]); }); return o; };
const con = (a, b) => Object.assign({}, a, b);

function Clip(dur, loop) { this.c = {dur, loop, tracks: {}, ev: []}; }
Clip.prototype.k = function (t, pose) { Object.entries(pose).forEach(([p, v]) => { (this.c.tracks[p] = this.c.tracks[p] || []).push([t].concat(v)); }); return this; };
Clip.prototype.a = function (t, w, agarre) { const T = this.c.tracks; (T.armaP = T.armaP || []).push([t].concat(w.P)); (T.armaR = T.armaR || []).push([t].concat(w.R)); (T.agarre = T.agarre || []).push([t].concat(agarre || w.g)); return this; };
Clip.prototype.g = function (t, d, iz) { (this.c.tracks.agarre = this.c.tracks.agarre || []).push([t, d, iz]); return this; };
Clip.prototype.r = function (t, x, y, z) { (this.c.root = this.c.root || []).push([t, x, y || 0, z]); return this; };
Clip.prototype.e = function (t, n) { this.c.ev.push([t, n]); return this; };
Clip.prototype.oculta = function (parte, claves) { (this.c.hide = this.c.hide || {})[parte] = claves; return this; };
Clip.prototype.fin = function () { const c = this.c; Object.keys(c.tracks).forEach(k => { const tr = c.tracks[k].sort((a, b) => a[0] - b[0]); const u = []; tr.forEach(q => { if (u.length && Math.abs(u[u.length - 1][0] - q[0]) < 1e-6) u[u.length - 1] = q; else u.push(q); }); c.tracks[k] = u; });
  if (c.root) c.root.sort((a, b) => a[0] - b[0]); c.ev.sort((a, b) => a[0] - b[0]); return c; };

const CLIPS = {}, META = {};
function def(nombre, clip, meta) { CLIPS[nombre] = clip.fin(); META[nombre] = Object.assign({suelo: 'pie', avance: 0, desplazamiento: [0, 0, 0], armaCompatible: ['A', 'B', 'C', 'D', 'E'], transiciones: []}, meta || {}); META[nombre].eventos = CLIPS[nombre].ev.map(e => e[1]); }

/* ---------- ciclo de marcha ----------
   A amplitud del muslo (°), rod flexión de la rodilla en vuelo, inc inclinación del torso, brazos: qué brazos braccean ('iz', 'de', 'ambos' o null = los dos; 'ninguno' = brazos fijados por el clip)
   La raíz se asienta después (el bamboleo vertical sale solo: el pie de apoyo queda siempre en el suelo). */
function zancada(C, A, rod, inc, brazos, op) {
  op = op || {}; const N = 16, carrera = op.carrera;
  for (let i = 0; i <= N; i++) { const t = i / N, ph = 2 * Math.PI * t;
    const leg = s => { const p = ph + (s > 0 ? 0 : Math.PI), th = -A * Math.cos(p);   // izquierda adelante en t = 0
      const vuelo = Math.max(0, Math.sin(p)), kn = 6 + (carrera ? 25 : 4) * Math.max(0, -Math.sin(p)) + rod * Math.pow(vuelo, 1.5), ft = -8 * Math.max(0, Math.cos(p)) + 14 * Math.max(0, -Math.cos(p - 0.6)) * (carrera ? 1.8 : 1);
      return {th: th + (carrera ? -10 : 0), kn, ft}; };
    const L = leg(1), R = leg(-1), pose = {musloIz: [L.th, 0, 2], piernaIz: [L.kn, 0, 0], pieIz: [L.ft, 0, 0], musloDe: [R.th, 0, -2], piernaDe: [R.kn, 0, 0], pieDe: [R.ft, 0, 0],
      pelvis: [0, 4 * Math.cos(ph), -2 * Math.sin(ph)], torso: [inc + (carrera ? 3 * Math.cos(2 * ph) : 1.5 * Math.cos(2 * ph)), -4 * Math.cos(ph), 2 * Math.sin(ph)], cabeza: [-inc * 0.6, 3 * Math.cos(ph), -1.5 * Math.sin(ph)]};
    const sw = op.braceo || 18;
    if (!brazos || brazos === 'iz' || brazos === 'ambos') Object.assign(pose, {brazoIz: [-sw * Math.cos(ph + Math.PI) - (carrera ? 20 : 4), 0, 6], antebrazoIz: [-(carrera ? 80 : 18) - 8 * Math.max(0, Math.cos(ph)), 0, 0]});
    if (!brazos || brazos === 'de' || brazos === 'ambos') Object.assign(pose, {brazoDe: [-sw * Math.cos(ph) - (carrera ? 20 : 4), 0, -6], antebrazoDe: [-(carrera ? 80 : 18) - 8 * Math.max(0, Math.cos(ph + Math.PI)), 0, 0]});
    C.k(t, pose);
  }
  C.e(0, 'pisada_iz').e(0.5, 'pisada_de');
}
// marchas: paso ordinario (76/min), de carga (120/min), gimnástico (165/min); al hombro, a la funerala y a discreción
// Fuentes: «Field Exercise and Evolutions of the Army» (1833) y «Ordonnance du 4 mars 1831» (paso ordinario 76, accelerado 100–120); paso gimnástico (Francia, 1845).
[['ordinario', 76, 0.65, 22, 24, 1], ['carga', 120, 0.7, 25, 34, 4], ['gimnastico', 165, 0.85, 30, 60, 8]].forEach(([n, ppm, paso, A, rod, inc]) => {
  const dur = 2 * 60 / ppm, carrera = n === 'gimnastico';
  [['hombro', W.HOMBRO, 'iz'], ['funerala', W.FUNERALA, 'de'], ['discrecion', W.DISCRECION, 'iz']].forEach(([m, w, libre]) => {
    const C = new Clip(dur, true); zancada(C, A, rod, inc, libre, {carrera, braceo: carrera ? 35 : 18});
    const wb = carrera && m === 'hombro' ? W.PORTA : w; C.a(0, wb).a(0.5, AW(wb, {P: [0, 0.01, 0]})).a(1, wb);
    def(`marcha_${n}_${m}`, C, {suelo: carrera ? 'carrera' : 'pie', avance: 2 * paso, simetrico: true, transiciones: ['idle', `marcha_${n}_hombro`]});
  });
});

/* ---------- descarga por filas («¡Preparen! ¡Apunten! ¡Fuego!»): fila 1 de rodillas, fila 2 de pie ----------
   A: llave de chispa (amartillar al «preparen»; fogonazo en la cazoleta 0,05 s antes del disparo); B: pistón; D: cerrojo (sin cebo, recarga del cerrojo al final).
   Fuentes: «Ordonnance» de 1831 (feux de deux rangs) y «Field Exercise» (1833); el primer rango rodilla en tierra solo en el cuadro o a voluntad del jefe. */
['A', 'B', 'D'].forEach(v => [1, 2].forEach(fila => {
  const dur = v === 'D' ? 3.2 : 4.4, C = new Clip(dur, false), base = fila === 1 ? RODILLA : FIRME, tiro = fila === 1 ? RODILLA_TIRO : TIRADOR, sig = fila === 1 ? 'idle_rodilla' : 'idle';
  const tP = v === 'D' ? 0.12 : 0.15, tA = v === 'D' ? 0.38 : 0.45, tF = v === 'D' ? 0.62 : 0.7;
  C.k(0, FIRME).k(tP, fila === 1 ? mezcla(FIRME, RODILLA, 0.6) : FIRME).k(tP + 0.1, base).k(tA, tiro).k(tF, tiro).k(tF + 0.03, mas(tiro, {torso: [-4, 0, 0], cabeza: [-3, 0, 0], brazoDe: [0, 0, -3]})).k(tF + 0.1, tiro).k(1, mas(base, {torso: [3, 0, 0]}));
  C.a(0, W.HOMBRO).a(tP, W.PREPAREN).a(tP + 0.12, W.PREPAREN).a(tA, W.APUNTA).a(tF, W.APUNTA).a(tF + 0.03, AW(W.APUNTA, {P: [0, 0.02, -0.07], R: [-7, 0, 0]})).a(tF + 0.1, W.APUNTA).a(1, v === 'D' ? W.APUNTA : W.LISTO);
  C.e(tP, 'preparen'); if (v === 'A') C.e(tP + 0.08, 'amartillar'); C.e(tA, 'apunten'); if (v === 'A') C.e(tF - 0.012, 'cazoleta'); C.e(tF, 'disparo'); if (v === 'D') { C.e(0.82, 'cerrojo_atras'); C.e(0.9, 'cerrojo_adelante'); }
  if (v === 'D') { C.a(0.8, AW(W.APUNTA, {R: [-4, 0, -12]})).a(0.92, W.APUNTA); C.g(0.8, 0.5, 0.82).g(0.92, 0.32, 0.82); }
  def(`descarga_fila${fila}_${v}`, C, {armaCompatible: v === 'D' ? ['C', 'D', 'E'] : v === 'A' ? ['A'] : ['B'], transiciones: [sig, v === 'D' ? sig : `recarga_completa_${v}`], sincronizar: ['preparen', 'apunten', 'disparo']});
}));

/* ---------- recarga completa de avancarga y fallos de ignición ----------
   A (chispa, «charge en douze temps»): media monta y abrir la cazoleta, morder el cartucho, cebar, cerrar, armas al frente, verter, sacar la baqueta,
   atacar (dos golpes), devolver la baqueta, al hombro. B (pistón, Minié): sin cebar la cazoleta; al final, pistón en la chimenea.
   Unos 15–20 s por disparo: 3 tiros por minuto (el reglamento pedía 3–4; en combate, 2). */
function recargaCompleta(v) {
  const dur = v === 'A' ? 17 : 15, C = new Clip(dur, false), T = f => f, b = TIRADOR, pie = con(FIRME, {torso: [6, -8, 0], cabeza: [16, 0, 0]});
  const pasos = v === 'A' ? [[0, W.LISTO, 'media_monta'], [0.06, W.CEBAR, 'abrir_cazoleta'], [0.12, W.CEBAR, 'morder_cartucho'], [0.2, W.CEBAR, 'cebar'], [0.26, W.CEBAR, 'cerrar_cazoleta'], [0.32, W.CARGA, 'armas_al_frente'],
    [0.4, W.CARGA, 'verter'], [0.48, W.CARGA, 'baqueta_fuera'], [0.58, W.CARGA, 'atacar'], [0.66, W.CARGA, 'atacar'], [0.76, W.CARGA, 'baqueta_dentro'], [0.88, W.LISTO, 'al_hombro'], [1, W.PREPAREN, 'listo']]
    : [[0, W.LISTO, 'media_monta'], [0.08, W.CARGA, 'armas_al_frente'], [0.16, W.CARGA, 'morder_cartucho'], [0.26, W.CARGA, 'verter'], [0.36, W.CARGA, 'baqueta_fuera'], [0.48, W.CARGA, 'atacar'], [0.58, W.CARGA, 'atacar'],
      [0.7, W.CARGA, 'baqueta_dentro'], [0.8, W.CEBAR, 'piston'], [0.9, W.LISTO, 'al_hombro'], [1, W.PREPAREN, 'listo']];
  pasos.forEach(([t, w, ev]) => { C.a(t, w); if (t > 0 && t < 1) C.e(t, ev); });
  // la mano derecha: a la boca (morder), a la cazoleta (cebar), a la baqueta (sacar, atacar, devolver)
  const BD = [[0, -40, 0, -10], [0.1, -40, 0, -10]];
  const boca = t => { BD.push([t - 0.02, -60, 0, -25], [t, -70, 0, -30], [t + 0.04, -55, 0, -20]); C.k(t, {antebrazoDe: [-128, 0, 0]}); C.k(t + 0.05, {antebrazoDe: [-40, 0, 0]}); C.k(t - 0.03, {antebrazoDe: [-40, 0, 0]}); };
  const baqueta = (t0, t1) => { BD.push([t0, -90, 0, -10], [t0 + 0.03, -168, 0, -10]); for (let t = t0 + 0.08; t < t1 - 0.04; t += 0.05) BD.push([t, -120, 0, -8], [t + 0.025, -150, 0, -8]); BD.push([t1, -168, 0, -10], [t1 + 0.04, -60, 0, -10]); };
  if (v === 'A') { boca(0.12); baqueta(0.46, 0.78); C.g(0.06, -1, 0.62).g(0.3, -1, 0.62).g(0.32, -1, 0.95).g(0.84, 0.35, 0.8).g(0.9, 0.42, 0.74).g(1, 0.34, 0.62); }
  else { boca(0.16); baqueta(0.34, 0.72); C.g(0.08, -1, 0.95).g(0.78, -1, 0.62).g(0.86, 0.42, 0.74).g(1, 0.34, 0.62); }
  BD.push([1, -40, 0, -10]); BD.sort((a, b) => a[0] - b[0]).forEach(k => C.k(k[0], {brazoDe: k.slice(1)}));
  C.k(0, b).k(0.08, pie).k(0.9, pie).k(1, b);
  def(`recarga_completa_${v}`, C, {armaCompatible: [v], transiciones: [`descarga_fila2_${v}`, 'idle']});
}
recargaCompleta('A'); recargaCompleta('B');
function falloIgnicion(v) {   // A: «fogonazo en la cazoleta» sin salir el tiro; B: el pistón no detona
  const C = new Clip(5.0, false);
  C.k(0, TIRADOR).k(0.12, TIRADOR).k(0.16, mas(TIRADOR, {cabeza: [-6, 0, -4], torso: [-2, 0, 0]})).k(0.3, con(TIRADOR, {torso: [8, -8, 0], cabeza: [22, 0, 0]})).k(0.82, con(TIRADOR, {torso: [8, -8, 0], cabeza: [22, 0, 0]})).k(0.92, TIRADOR).k(1, TIRADOR);
  C.a(0, W.APUNTA).a(0.12, W.APUNTA).a(0.16, AW(W.APUNTA, {R: [-3, 0, 0]})).a(0.3, W.CEBAR).a(0.82, W.CEBAR).a(0.92, W.APUNTA).a(1, W.APUNTA);
  if (v === 'A') { C.e(0.12, 'chispa').e(0.13, 'cazoleta').e(0.18, 'fallo').e(0.36, 'abrir_cazoleta').e(0.5, 'cebar').e(0.64, 'cerrar_cazoleta').e(0.74, 'amartillar').e(0.92, 'apuntar'); }
  else { C.e(0.12, 'chasquido').e(0.18, 'fallo').e(0.4, 'quitar_piston').e(0.58, 'piston').e(0.74, 'amartillar').e(0.92, 'apuntar'); }
  [[0.3, -50, 0, -14], [0.4, -62, 0, -20], [0.5, -50, 0, -14], [0.6, -62, 0, -20], [0.7, -50, 0, -14], [0.82, -45, 0, -12]].forEach(k => C.k(k[0], {brazoDe: k.slice(1)}));
  C.g(0.3, -1, 0.62).g(0.84, 0.32, 0.82);
  def(`fallo_ignicion_${v}`, C, {armaCompatible: [v], transiciones: [`descarga_fila2_${v}`, `recarga_completa_${v}`]});
}
falloIgnicion('A'); falloIgnicion('B');

/* ---------- cuadro contra caballería: 1.ª fila rodilla en tierra con la culata apoyada y la bayoneta hacia fuera; 2.ª fila de pie ---------- */
{ const C = new Clip(1.6, false); C.k(0, FIRME).k(0.35, mezcla(FIRME, RODILLA, 0.5)).k(0.7, RODILLA).k(1, con(RODILLA, {torso: [12, 0, 0]})); C.a(0, W.HOMBRO).a(0.35, W.PREPAREN).a(0.75, W.CUADRO1).a(1, W.CUADRO1); C.e(0.3, 'rodilla').e(0.75, 'culata_en_tierra');
  def('cuadro_formar_fila1', C, {transiciones: ['cuadro_fila1']}); }
{ const C = new Clip(4, true); [0, 0.5, 1].forEach((t, i) => C.k(t, con(RODILLA, {torso: [12 + (i === 1 ? 1.5 : 0), 0, 0], cabeza: [-4 + (i === 1 ? 2 : 0), [0, 12, 0][i], 0]}))); C.a(0, W.CUADRO1).a(1, W.CUADRO1); def('cuadro_fila1', C, {transiciones: ['cuadro_romper']}); }
{ const C = new Clip(3.5, true); [0, 0.5, 1].forEach((t, i) => C.k(t, con(TIRADOR, {torso: [6, -8 + (i === 1 ? 2 : 0), 0], cabeza: [0, [0, -10, 0][i], 0]}))); C.a(0, W.BAYO_ALTA).a(0.5, AW(W.BAYO_ALTA, {P: [0, 0.01, 0.01]})).a(1, W.BAYO_ALTA); def('cuadro_fila2', C, {transiciones: ['cuadro_romper', 'descarga_fila2_A']}); }
{ const C = new Clip(1.6, false); C.k(0, RODILLA).k(0.45, mezcla(RODILLA, FIRME, 0.5)).k(0.8, FIRME).k(1, FIRME); C.a(0, W.CUADRO1).a(0.5, W.PREPAREN).a(1, W.HOMBRO); C.e(0.45, 'levantarse').e(0.95, 'al_hombro'); def('cuadro_romper', C, {transiciones: ['idle', 'marcha_ordinario_hombro']}); }

/* ---------- carga a la bayoneta ---------- */
[['trote', 0.8, 26, 50, 10, 1.9], ['galope', 0.62, 30, 70, 16, 2.4], ['grito', 0.66, 29, 64, 12, 2.2]].forEach(([n, dur, A, rod, inc, av]) => {
  const C = new Clip(dur, true); zancada(C, A, rod, inc, null, {carrera: true}); C.a(0, n === 'galope' ? W.BAYO : W.BAYO).a(0.5, AW(W.BAYO, {P: [0, 0.03, 0.03]})).a(1, W.BAYO);
  if (n === 'grito') { C.k(0, {cabeza: [-12, 0, 0]}).k(0.5, {cabeza: [-16, 0, 0]}).k(1, {cabeza: [-12, 0, 0]}); C.e(0.05, 'grito'); }
  def('carga_bayoneta_' + n, C, {suelo: 'carrera', avance: av * 2 * 0.5 * 2 / 2, simetrico: n !== 'grito', transiciones: ['cc_estocada_a', 'cc_culatazo_a', 'cc_empujon_a', 'idle']});
});

/* ---------- cuerpo a cuerpo emparejado (atacante _a, defensor _d; el defensor está a 1,4 m delante, mirando al atacante) ---------- */
const GUARDIA = con(TIRADOR, {musloIz: [-22, 0, 6], piernaIz: [18, 0, 0], musloDe: [12, 0, -6], piernaDe: [10, 0, 0], torso: [10, -10, 0], cabeza: [4, 0, 0]});
function pareja(n, dur, tImp, ataque, defensa, extra) { def(n + '_a', ataque, Object.assign({pareja: {clip: n + '_d', desfase: [0, 1.4, 180]}, transiciones: ['idle']}, extra && extra.a)); def(n + '_d', defensa, Object.assign({pareja: {clip: n + '_a', desfase: [0, 1.4, 180]}, transiciones: ['idle']}, extra && extra.d)); }
{ // estocada que alcanza: el defensor recibe en el pecho y cae de rodillas
  const d = 1.4, ti = 0.36, A = new Clip(d, false), B = new Clip(d, false);
  A.k(0, GUARDIA).k(0.22, mas(GUARDIA, {torso: [-6, 6, 0], musloIz: [8, 0, 0]})).k(ti, con(GUARDIA, {musloIz: [-40, 0, 6], piernaIz: [38, 0, 0], musloDe: [24, 0, -6], torso: [24, -16, 0]})).k(0.55, con(GUARDIA, {musloIz: [-36, 0, 6], piernaIz: [34, 0, 0], torso: [16, -10, 0]})).k(1, GUARDIA);
  A.a(0, W.BAYO).a(0.22, AW(W.BAYO, {P: [0, 0.02, -0.18]})).a(ti, AW(W.BAYO, {P: [0, 0.1, 0.3], R: [8, 0, 0]})).a(0.55, AW(W.BAYO, {P: [0, 0.06, 0.12]})).a(1, W.BAYO); A.r(0, 0, 0, 0).r(ti, 0, 0, 0.3).r(1, 0, 0, 0.25);
  B.k(0, GUARDIA).k(ti, GUARDIA).k(ti + 0.06, mas(GUARDIA, {torso: [-22, 8, 0], cabeza: [-20, 0, 0], brazoIz: [-30, 0, 20]})).k(0.62, con(RODILLA, {torso: [30, 0, 0], cabeza: [20, 0, 0]})).k(1, con(RODILLA, {torso: [45, 0, 0], cabeza: [30, 0, 0]}));
  B.a(0, W.BAYO).a(ti, W.BAYO).a(ti + 0.06, AW(W.BAYO, {P: [0.1, 0.1, -0.1], R: [-20, 0, 20]})).a(0.62, W.SUELO).a(1, W.SUELO); B.g(ti + 0.065, -1, -1); B.r(0, 0, 0, 0).r(ti + 0.1, 0, 0, -0.25).r(1, 0, 0, -0.3);
  [A, B].forEach(c => c.e(ti, 'impacto')); B.e(0.62, 'cae'); B.e(ti + 0.1, 'suelta_arma');
  pareja('cc_estocada', d, ti, A, B);
}
{ // estocada parada: el defensor desvía con un barrido del fusil y el atacante queda descubierto
  const d = 1.3, ti = 0.34, A = new Clip(d, false), B = new Clip(d, false);
  A.k(0, GUARDIA).k(0.2, mas(GUARDIA, {torso: [-6, 6, 0]})).k(ti, con(GUARDIA, {musloIz: [-38, 0, 6], piernaIz: [36, 0, 0], torso: [22, -16, 0]})).k(0.5, con(GUARDIA, {torso: [10, 14, 0], musloIz: [-30, 0, 6]})).k(1, GUARDIA);
  A.a(0, W.BAYO).a(0.2, AW(W.BAYO, {P: [0, 0.02, -0.16]})).a(ti, AW(W.BAYO, {P: [0, 0.1, 0.28]})).a(0.5, AW(W.BAYO, {P: [0.2, 0.05, 0.1], R: [0, 0, 30]})).a(1, W.BAYO); A.r(0, 0, 0, 0).r(ti, 0, 0, 0.28).r(1, 0, 0, 0.1);
  B.k(0, GUARDIA).k(0.26, GUARDIA).k(ti, mas(GUARDIA, {torso: [-4, 18, 0]})).k(0.5, mas(GUARDIA, {torso: [6, -6, 0]})).k(1, GUARDIA);
  B.a(0, W.BAYO).a(0.26, AW(W.BAYO, {P: [-0.05, 0.1, 0]})).a(ti, AW(W.BAYO, {P: [0.15, 0.15, 0.05], R: [-10, 0, 40]})).a(0.5, W.BAYO).a(1, W.BAYO);
  [A, B].forEach(c => c.e(ti, 'parada'));
  pareja('cc_parada', d, ti, A, B);
}
{ // culatazo a la cabeza
  const d = 1.6, ti = 0.42, A = new Clip(d, false), B = new Clip(d, false);
  A.k(0, GUARDIA).k(0.25, con(GUARDIA, {torso: [-8, -30, 0], musloDe: [20, 0, -8]})).k(ti, con(GUARDIA, {torso: [18, 25, 0], musloIz: [-34, 0, 6], piernaIz: [30, 0, 0]})).k(0.6, con(GUARDIA, {torso: [12, 10, 0]})).k(1, GUARDIA);
  A.a(0, W.BAYO).a(0.25, AW(W.CULATA_ARRIBA, {P: [0, -0.3, -0.1], R: [60, 0, 0]})).a(ti, W.CULATA_ARRIBA).a(0.6, AW(W.CULATA_ARRIBA, {P: [0, -0.2, 0], R: [40, 0, 0]})).a(1, W.BAYO); A.r(0, 0, 0, 0).r(ti, 0, 0, 0.2).r(1, 0, 0, 0.2);
  B.k(0, GUARDIA).k(ti, GUARDIA).k(ti + 0.05, mas(GUARDIA, {cabeza: [-30, -30, 20], torso: [-10, -20, 10]})).k(0.7, con(BOCA_ABAJO, {pelvis: [60, 40, 0], torso: [-30, 0, 0]})).k(1, con(TUMBADO_ESP, {pelvis: [-88, 30, 0]}));
  B.a(0, W.BAYO).a(ti, W.BAYO).a(ti + 0.08, W.SUELO).a(1, W.SUELO); B.g(ti + 0.01, -1, -1); B.r(0, 0, 0, 0).r(0.7, -0.3, 0, -0.6).r(1, -0.4, 0, -0.9);
  [A, B].forEach(c => c.e(ti, 'impacto')); B.e(0.7, 'cae'); B.e(ti + 0.05, 'suelta_arma');
  pareja('cc_culatazo', d, ti, A, B, {d: {suelo: 'pie'}});
}
{ // empujón con el fusil atravesado
  const d = 1.2, ti = 0.3, A = new Clip(d, false), B = new Clip(d, false);
  A.k(0, GUARDIA).k(ti, con(GUARDIA, {musloIz: [-40, 0, 6], piernaIz: [30, 0, 0], musloDe: [26, 0, -6], torso: [22, 0, 0]})).k(0.6, GUARDIA).k(1, GUARDIA);
  A.a(0, W.BAYO).a(0.15, AW(W.HORIZONTAL, {P: [0, 0, -0.1]})).a(ti, AW(W.HORIZONTAL, {P: [0, 0, 0.25]})).a(0.6, W.BAYO).a(1, W.BAYO); A.r(0, 0, 0, 0).r(ti, 0, 0, 0.4).r(1, 0, 0, 0.45);
  B.k(0, GUARDIA).k(ti, GUARDIA).k(0.45, con(FIRME, {torso: [-20, 0, 0], musloIz: [20, 0, 4], musloDe: [-30, 0, -4], piernaDe: [30, 0, 0], brazoIz: [-60, 0, 30]})).k(0.7, con(FIRME, {torso: [-6, 0, 0], musloDe: [-12, 0, 0]})).k(1, GUARDIA);
  B.a(0, W.BAYO).a(ti, W.BAYO).a(0.45, AW(W.PORTA, {P: [0, 0.2, 0]})).a(1, W.BAYO); B.r(0, 0, 0, 0).r(ti, 0, 0, 0).r(0.7, 0, 0, -0.9).r(1, 0, 0, -1.0);
  [A, B].forEach(c => c.e(ti, 'impacto')); B.e(0.5, 'tambalea');
  pareja('cc_empujon', d, ti, A, B);
}
{ // duelo de oficiales a sable: tajo de A (parada de B), contraataque de B (parada de A), estocada de A que alcanza
  const d = 3.4, A = new Clip(d, false), B = new Clip(d, false), G = con(GUARDIA, {torso: [6, -25, 0], musloIz: [-26, 0, 6]});
  const lado = (C, w, t) => C.a(t, w);
  [[0, 'ESP_GUARDIA', 'ESP_GUARDIA'], [0.12, 'ESP_TAJO_ARRIBA', 'ESP_GUARDIA'], [0.2, 'ESP_TAJO_ABAJO', 'ESP_PARADA'], [0.32, 'ESP_GUARDIA', 'ESP_GUARDIA'], [0.42, 'ESP_GUARDIA', 'ESP_TAJO_ARRIBA'], [0.5, 'ESP_PARADA', 'ESP_TAJO_ABAJO'],
    [0.62, 'ESP_GUARDIA', 'ESP_GUARDIA'], [0.72, 'ESP_GUARDIA', 'ESP_GUARDIA'], [0.8, 'ESP_ESTOCADA', 'ESP_GUARDIA'], [0.86, 'ESP_GUARDIA', 'ESP_BAJA'], [1, 'ESP_GUARDIA', 'ESP_BAJA']].forEach(([t, a, b]) => { lado(A, W[a], t); lado(B, W[b], t); });
  A.k(0, G).k(0.2, mas(G, {torso: [12, 10, 0], musloIz: [-10, 0, 0]})).k(0.5, mas(G, {torso: [-6, 0, 0]})).k(0.8, con(G, {musloIz: [-44, 0, 6], piernaIz: [40, 0, 0], torso: [22, -20, 0]})).k(1, G);
  B.k(0, G).k(0.2, mas(G, {torso: [-6, 0, 0]})).k(0.5, mas(G, {torso: [12, 10, 0]})).k(0.8, G).k(0.86, mas(G, {torso: [-20, 10, 0], cabeza: [-15, 0, 0]})).k(1, con(RODILLA, {torso: [35, 0, 0]}));
  A.r(0, 0, 0, 0).r(0.2, 0, 0, 0.15).r(0.5, 0, 0, 0.0).r(0.8, 0, 0, 0.35).r(1, 0, 0, 0.3); B.r(0, 0, 0, 0).r(0.2, 0, 0, -0.1).r(0.5, 0, 0, 0.15).r(0.8, 0, 0, 0).r(1, 0, 0, -0.15);
  [A, B].forEach(c => c.e(0.2, 'parada').e(0.5, 'parada').e(0.8, 'impacto')); B.e(0.95, 'cae');
  def('duelo_sable_a', A, {pareja: {clip: 'duelo_sable_b', desfase: [0, 1.7, 180]}, armaCompatible: ['A', 'B', 'C', 'D'], transiciones: ['idle_oficial']});
  def('duelo_sable_b', B, {pareja: {clip: 'duelo_sable_a', desfase: [0, 1.7, 180]}, armaCompatible: ['A', 'B', 'C', 'D'], transiciones: []});
}

/* ---------- escaramuzador ---------- */
{ const C = new Clip(3, true); const P0 = con(TIRADOR, {torso: [4, 6, -10], cabeza: [8, 4, 10], musloIz: [-10, 0, 10], musloDe: [8, 0, -2]}); [0, 0.5, 1].forEach((t, i) => C.k(t, mas(P0, {torso: [i === 1 ? 1 : 0, 0, 0]}))); C.r(0, 0.12, 0, 0).r(1, 0.12, 0, 0);
  C.a(0, AW(W.APUNTA, {P: [0.06, 0, 0], R: [0, 6, 0]})).a(1, AW(W.APUNTA, {P: [0.06, 0, 0], R: [0, 6, 0]})); def('apuntar_apoyado_arbol', C, {cobertura: 'arbol', transiciones: ['disparar_apoyado', 'idle']}); }
{ const C = new Clip(3, true); const P0 = con(RODILLA_TIRO, {torso: [16, -12, 0], cabeza: [4, -4, 4]}); [0, 0.5, 1].forEach((t, i) => C.k(t, mas(P0, {torso: [i === 1 ? 1 : 0, 0, 0]})));
  C.a(0, AW(W.APUNTA, {P: [0, -0.08, 0.04], R: [-4, 0, 0]})).a(1, AW(W.APUNTA, {P: [0, -0.08, 0.04], R: [-4, 0, 0]})); def('apuntar_apoyado_roca', C, {cobertura: 'roca', transiciones: ['idle_rodilla']}); }
{ const C = new Clip(2.4, false); const P = (k, t) => C.k(t, k);
  // tres zancadas de carrera, frenada y cuerpo a tierra
  for (let i = 0; i <= 6; i++) { const t = i / 6 * 0.55, ph = i * Math.PI; P(con(PIE, {musloIz: [-28 * Math.cos(ph) - 10, 0, 2], musloDe: [28 * Math.cos(ph) - 10, 0, -2], piernaIz: [30 + 40 * Math.max(0, Math.sin(ph)), 0, 0], piernaDe: [30 + 40 * Math.max(0, -Math.sin(ph)), 0, 0], torso: [18, 0, 0], cabeza: [-14, 0, 0]}), t); }
  P(con(RODILLA, {torso: [30, 0, 0]}), 0.7); P(con(BOCA_ABAJO, {pelvis: [40, 0, 0], torso: [30, 0, 0], brazoIz: [-70, 0, 10]}), 0.82); P(BOCA_ABAJO, 1);
  C.a(0, W.DISCRECION).a(0.55, W.DISCRECION).a(0.82, AW(W.LISTO, {P: [0, -0.1, 0.1]})).a(1, {P: [-0.12, 0.38, -0.05], R: [20, 0, 0], g: [0.3, 0.75]});
  C.r(0, 0, 0, 0).r(0.55, 0, 0, 2.6).r(0.7, 0, 0, 3.0).r(0.82, 0, 0, 3.3).r(1, 0, 0, 3.6); C.e(0.08, 'pisada_iz').e(0.18, 'pisada_de').e(0.27, 'pisada_iz').e(0.37, 'pisada_de').e(0.7, 'rodilla').e(0.95, 'cuerpo_a_tierra');
  def('escaramuza_salto_tumbarse', C, {suelo: 'carrera', desplazamiento: [0, 0, 3.6], transiciones: ['idle_tumbado', 'apuntar_tumbado']}); }

/* ---------- reacciones ---------- */
// impacto(nombre, {sacude: pose sumada en el instante del impacto, final: pose final, cae, sueltaArma, mano: 'iz' | 'de' (se lleva a la herida), raiz: [x, z], dur})
function impacto(n, o) {
  const d = o.dur || 1.5, C = new Clip(d, false), b = o.base || FIRME, s = mas(b, o.sacude), f = o.final || mas(b, o.recupera || {});
  C.k(0, b).k(0.06, s).k(0.18, mas(s, o.sigue || {})).k(o.cae ? 0.7 : 0.55, o.medio || mezcla(s, f, 0.6)).k(1, f);
  if (o.mano) { const B = o.mano === 'iz' ? 'brazoIz' : 'brazoDe', A2 = o.mano === 'iz' ? 'antebrazoIz' : 'antebrazoDe'; C.k(0.12, {[B]: o.manoPose || [-30, 0, o.mano === 'iz' ? -30 : 30], [A2]: [-110, 0, 0]}).k(1, {[B]: o.manoPose || [-30, 0, o.mano === 'iz' ? -30 : 30], [A2]: [-110, 0, 0]}); }
  C.a(0, W.PORTA).a(0.06, AW(W.PORTA, {P: [0, 0.04, -0.06], R: [-10, 0, 12]}));
  if (o.sueltaArma) { C.a(0.25, W.SUELO).a(1, W.SUELO); C.g(0.1, -1, -1); C.e(0.12, 'suelta_arma'); } else if (o.mano === 'de') { C.a(0.25, AW(W.PORTA, {P: [0.05, -0.15, 0]})).a(1, AW(W.PORTA, {P: [0.05, -0.15, 0]})); C.g(0.1, -1, 0.72); } else { C.a(0.4, W.PORTA).a(1, W.PORTA); }
  C.r(0, 0, 0, 0).r(0.2, (o.raiz || [0, 0])[0] * 0.6, 0, (o.raiz || [0, 0])[1] * 0.6).r(1, (o.raiz || [0, 0])[0], 0, (o.raiz || [0, 0])[1]);
  C.e(0, 'impacto'); if (o.cae) C.e(0.7, 'cae');
  def(n, C, {desplazamiento: [(o.raiz || [0, 0])[0], 0, (o.raiz || [0, 0])[1]], region: o.region, transiciones: o.cae ? [] : ['idle', 'cojear'], suelo: 'pie'});
}
// brazo (4 nuevas; ya había impacto_brazo_izq/der): sacudida, soltar el arma, girar sobre sí, agarrarse
impacto('impacto_brazo_izq_2', {region: 'brazo', sacude: {brazoIz: [20, 0, 35], torso: [-4, 18, 6]}, mano: 'de', recupera: {torso: [10, 10, 0]}});
impacto('impacto_brazo_der_2', {region: 'brazo', sacude: {brazoDe: [20, 0, -35], torso: [-4, -18, -6]}, mano: 'iz', sueltaArma: true, recupera: {torso: [10, -10, 0]}});
impacto('impacto_brazo_giro', {region: 'brazo', sacude: {torso: [0, 45, 0], pelvis: [0, 25, 0], brazoIz: [10, 0, 40]}, sigue: {torso: [0, 15, 0]}, recupera: {torso: [6, 30, 0], pelvis: [0, 20, 0]}, mano: 'de', raiz: [0.1, -0.15]});
impacto('impacto_brazo_rodilla', {region: 'brazo', sacude: {brazoDe: [25, 0, -30], torso: [6, -10, 0]}, final: con(RODILLA, {torso: [20, -10, 0]}), mano: 'iz', sueltaArma: true, dur: 1.8});
// pierna (4 nuevas): cojea, cae de rodillas, se derrumba de lado, salta a la pata coja
impacto('impacto_pierna_izq_2', {region: 'pierna', sacude: {musloIz: [-20, 0, 0], piernaIz: [50, 0, 0], torso: [14, 0, 10], pelvis: [0, 0, 8]}, final: con(RODILLA, {torso: [20, 0, 0]}), mano: 'iz', manoPose: [10, 0, 10], dur: 1.6});
impacto('impacto_pierna_der_2', {region: 'pierna', sacude: {musloDe: [-20, 0, 0], piernaDe: [50, 0, 0], torso: [14, 0, -10], pelvis: [0, 0, -8]}, final: con(RODILLA, {torso: [20, 0, 0]}), mano: 'de', manoPose: [10, 0, -10], dur: 1.6});
impacto('impacto_pierna_derrumbe', {region: 'pierna', sacude: {musloIz: [-30, 0, 0], piernaIz: [70, 0, 0], torso: [20, 0, 15]}, medio: con(RODILLA, {torso: [30, 0, 30]}), final: con(TUMBADO_ESP, {pelvis: [-80, 0, 60], torso: [20, 0, 0], musloIz: [-50, 0, 0], piernaIz: [70, 0, 0]}), cae: true, sueltaArma: true, dur: 2.0, raiz: [0.3, -0.2]});
impacto('impacto_pierna_cojea', {region: 'pierna', sacude: {musloDe: [-35, 0, 0], piernaDe: [60, 0, 0], torso: [10, 0, -12]}, sigue: {pelvis: [0, 0, -6]}, final: con(PIE, {musloDe: [-25, 0, -4], piernaDe: [45, 0, 0], torso: [8, 0, -8]}), mano: 'de', manoPose: [5, 0, -15], raiz: [0, -0.25]});
// torso (1 nueva: giro y caída de espaldas)
impacto('impacto_torso_giro', {region: 'torso', sacude: {torso: [-20, 50, 0], pelvis: [0, 30, 0], cabeza: [-20, 0, 0]}, medio: con(RODILLA, {torso: [0, 60, -20]}), final: con(TUMBADO_ESP, {pelvis: [-88, 70, 0], musloIz: [-20, 0, 10]}), cae: true, sueltaArma: true, dur: 2.0, raiz: [0.2, -0.6]});
// cabeza (4 nuevas): rozadura (se lleva la mano y sigue), golpe en el casco, lateral izq/der con caída
impacto('impacto_cabeza_rozadura', {region: 'cabeza', sacude: {cabeza: [-25, 20, 10], torso: [-8, 10, 0]}, mano: 'iz', manoPose: [-150, 0, 20], recupera: {torso: [14, 0, 0], cabeza: [20, 0, 0]}, dur: 1.8});
impacto('impacto_cabeza_casco', {region: 'cabeza', sacude: {cabeza: [-35, 0, 0], torso: [-12, 0, 0]}, sigue: {musloDe: [-10, 0, 0], piernaDe: [20, 0, 0]}, medio: con(RODILLA, {torso: [10, 0, 0], cabeza: [20, 0, 0]}), final: mas(FIRME, {torso: [4, 0, 0]}), raiz: [0, -0.3], dur: 2.2});
impacto('impacto_cabeza_izq', {region: 'cabeza', sacude: {cabeza: [-10, 0, -40], torso: [-6, -20, -20]}, medio: con(RODILLA, {torso: [10, -30, -40]}), final: con(TUMBADO_ESP, {pelvis: [-88, 0, -70], cabeza: [0, 0, -30]}), cae: true, sueltaArma: true, raiz: [-0.5, 0], dur: 1.8});
impacto('impacto_cabeza_der', {region: 'cabeza', sacude: {cabeza: [-10, 0, 40], torso: [-6, 20, 20]}, medio: con(RODILLA, {torso: [10, 30, 40]}), final: con(TUMBADO_ESP, {pelvis: [-88, 0, 70], cabeza: [0, 0, 30]}), cae: true, sueltaArma: true, raiz: [0.5, 0], dur: 1.8});
// tambaleo, caída, explosión cercana, encogerse, dudar, retroceder, pánico, capturado y escolta
{ const C = new Clip(2.0, false); C.k(0, FIRME).k(0.15, con(PIE, {musloIz: [20, 0, 6], torso: [-10, 0, 8], brazoIz: [-40, 0, 40]})).k(0.35, con(PIE, {musloDe: [25, 0, -6], piernaDe: [10, 0, 0], torso: [-8, 0, -10], brazoIz: [-30, 0, 30]})).k(0.6, con(PIE, {musloIz: [-15, 0, 4], torso: [6, 0, 4]})).k(1, FIRME);
  C.a(0, W.PORTA).a(0.15, AW(W.PORTA, {P: [0, 0.1, 0], R: [-10, 0, 20]})).a(0.6, W.PORTA).a(1, W.PORTA); C.g(0.12, 0.3, -1).g(0.6, 0.3, 0.72); C.r(0, 0, 0, 0).r(0.35, 0.1, 0, -0.5).r(0.6, 0.05, 0, -0.7).r(1, 0, 0, -0.7);
  C.e(0, 'impacto').e(0.15, 'pisada_iz').e(0.35, 'pisada_de'); def('tambaleo', C, {desplazamiento: [0, 0, -0.7], transiciones: ['idle']}); }
{ const C = new Clip(2.4, false); C.k(0, FIRME).k(0.2, con(PIE, {musloIz: [-20, 0, 6], torso: [20, 0, 6]})).k(0.4, con(PIE, {musloDe: [-30, 0, -6], piernaDe: [20, 0, 0], torso: [30, 0, -4]})).k(0.62, con(RODILLA, {torso: [40, 0, 0]})).k(0.85, con(BOCA_ABAJO, {pelvis: [60, 0, 0], torso: [0, 0, 0]})).k(1, con(BOCA_ABAJO, {cabeza: [-30, 30, 0]}));
  C.a(0, W.PORTA).a(0.4, AW(W.PORTA, {R: [30, 0, 0]})).a(0.6, W.SUELO).a(1, W.SUELO); C.g(0.45, -1, -1); C.r(0, 0, 0, 0).r(0.4, 0, 0, 0.5).r(0.62, 0, 0, 0.8).r(0.85, 0, 0, 1.2).r(1, 0, 0, 1.3);
  C.e(0, 'impacto').e(0.62, 'rodilla').e(0.85, 'cae').e(0.6, 'suelta_arma'); def('tambaleo_caida', C, {desplazamiento: [0, 0, 1.3], transiciones: ['cuerpo_inerte_adelante']}); }
{ const C = new Clip(3.6, false); C.k(0, FIRME).k(0.04, con(PIE, {torso: [-25, 0, 20], cabeza: [-20, 0, 20], brazoIz: [-60, 0, 70], brazoDe: [-60, 0, -70]})).k(0.18, con(TUMBADO_ESP, {pelvis: [-60, 0, 30], torso: [10, 0, 0], brazoIz: [-90, 0, 60], brazoDe: [-40, 0, -50]})).k(0.3, TUMBADO_ESP)
    .k(0.55, con(TUMBADO_ESP, {torso: [40, 0, 0], cabeza: [10, 10, 0], brazoIz: [40, 0, 20], antebrazoIz: [-90, 0, 0]})).k(0.75, con(SENTADO, {cabeza: [0, 25, 0], brazoDe: [-150, 0, -10], antebrazoDe: [-120, 0, 0]})).k(1, con(SENTADO, {cabeza: [10, -20, 0], torso: [40, 0, 0], brazoDe: [-150, 0, -10], antebrazoDe: [-120, 0, 0]}));
  C.a(0, W.PORTA).a(0.06, W.SUELO).a(1, W.SUELO); C.g(0.03, -1, -1); C.r(0, 0, 0, 0).r(0.18, 0.3, 0, -1.2).r(1, 0.35, 0, -1.4); C.e(0, 'onda').e(0.04, 'suelta_arma').e(0.18, 'cae').e(0.75, 'aturdido');
  def('sacudida_explosion', C, {suelo: 'pie', desplazamiento: [0.35, 0, -1.4], transiciones: ['levantarse_sentado']}); }
{ const C = new Clip(2.4, true); const E = con(AGACHADO, {torso: [45, 0, 0], cabeza: [30, 0, 0], brazoIz: [-150, 0, 30], antebrazoIz: [-130, 0, 0], brazoDe: [-150, 0, -30], antebrazoDe: [-130, 0, 0]});
  [0, 0.15, 0.3, 1].forEach((t, i) => C.k(t, mas(E, {torso: [[0, 0, 0], [6, 0, 3], [0, 0, -2], [0, 0, 0]][i], cabeza: [[0, 0, 0], [8, 0, 0], [0, 0, 0], [0, 0, 0]][i]}))); C.a(0, W.SUELO).a(1, W.SUELO); C.g(0, -1, -1); C.e(0.15, 'temblor');
  def('encogerse', C, {transiciones: ['idle', 'huida_panico']}); }
{ const C = new Clip(4.0, true); const P0 = con(FIRME, {torso: [2, 0, 0]}); C.k(0, P0).k(0.2, mas(P0, {cabeza: [0, 50, 0], torso: [0, 20, 0]})).k(0.4, P0).k(0.55, con(PIE, {musloDe: [20, 0, -4], torso: [-6, -10, 0], cabeza: [0, -40, 0]})).k(0.75, con(PIE, {torso: [6, 0, 0], cabeza: [10, 0, 0]})).k(1, P0);
  C.a(0, W.PORTA).a(0.55, AW(W.PORTA, {P: [0, 0.05, -0.05]})).a(1, W.PORTA); C.r(0, 0, 0, 0).r(0.55, 0, 0, -0.3).r(1, 0, 0, 0); C.e(0.2, 'mirar_atras').e(0.55, 'paso_atras'); def('dudar', C, {moral: 'baja', transiciones: ['retroceder', 'huida_panico', 'idle']}); }
{ const C = new Clip(1.9, true); zancada(C, -16, 18, -4, 'ambos', {braceo: 6}); C.a(0, W.PORTA).a(1, W.PORTA); C.k(0, {cabeza: [0, 20, 0]}).k(0.5, {cabeza: [0, -20, 0]}).k(1, {cabeza: [0, 20, 0]}); def('retroceder', C, {avance: -0.9, moral: 'baja', simetrico: true, transiciones: ['dudar', 'huida_panico']}); }
{ const C = new Clip(0.6, true); zancada(C, 32, 75, 14, null, {carrera: true, braceo: 55}); C.k(0, {cabeza: [-20, 30, 0]}).k(0.5, {cabeza: [-20, -10, 0]}).k(1, {cabeza: [-20, 30, 0]}); C.a(0, W.SUELO).a(1, W.SUELO); C.g(0, -1, -1); C.oculta('arma', [[0, 0]]); C.e(0.1, 'grito');
  def('huida_panico', C, {suelo: 'carrera', avance: 2.6, moral: 'rota', transiciones: ['rendirse', 'encogerse']}); }
{ const C = new Clip(1.6, true); zancada(C, 18, 18, 4, 'ninguno'); const ar = {brazoIz: [-150, 0, 40], antebrazoIz: [-140, 0, 0], brazoDe: [-150, 0, -40], antebrazoDe: [-140, 0, 0]};
  [0, 1].forEach(t => C.k(t, Object.assign({cabeza: [14, 0, 0]}, ar))); C.a(0, W.SUELO).a(1, W.SUELO); C.g(0, -1, -1); C.oculta('arma', [[0, 0]]); def('capturado_escoltado', C, {avance: 1.15, simetrico: false, pareja: {clip: 'escoltar_prisionero', desfase: [0.6, -1.6, 0]}, transiciones: ['manos_arriba']}); }
{ const C = new Clip(1.6, true); zancada(C, 18, 18, 2, 'iz'); C.a(0, AW(W.BAYO, {P: [0, -0.04, 0], R: [-12, 0, 0]})).a(1, AW(W.BAYO, {P: [0, -0.04, 0], R: [-12, 0, 0]})); def('escoltar_prisionero', C, {avance: 1.15, pareja: {clip: 'capturado_escoltado', desfase: [-0.6, 1.6, 0]}, transiciones: ['idle']}); }

/* ---------- vida de campamento y relevo ---------- */
function sentadoBucle(n, dur, brazos, ev, extra) { const C = new Clip(dur, true); brazos.forEach(([t, p]) => C.k(t, con(SENTADO, p))); C.a(0, W.SUELO).a(1, W.SUELO); C.g(0, -1, -1); C.oculta('arma', [[0, 0]]); (ev || []).forEach(([t, e]) => C.e(t, e)); def(n, C, Object.assign({suelo: 'sentado', transiciones: ['levantarse_sentado']}, extra)); }
sentadoBucle('descansar_sentado', 6, [[0, {brazoIz: [-30, 0, 20], antebrazoIz: [-40, 0, 0], brazoDe: [-30, 0, -20], antebrazoDe: [-40, 0, 0]}], [0.5, {brazoIz: [-32, 0, 20], antebrazoIz: [-44, 0, 0], brazoDe: [-30, 0, -20], antebrazoDe: [-40, 0, 0], cabeza: [20, 10, 0], torso: [58, 0, 0]}], [1, {brazoIz: [-30, 0, 20], antebrazoIz: [-40, 0, 0], brazoDe: [-30, 0, -20], antebrazoDe: [-40, 0, 0]}]], [[0.5, 'suspiro']]);
sentadoBucle('beber_sentado', 5, [[0, {brazoDe: [-30, 0, -20], antebrazoDe: [-40, 0, 0], brazoIz: [-30, 0, 20], antebrazoIz: [-40, 0, 0]}], [0.25, {brazoDe: [-70, 0, -10], antebrazoDe: [-130, 0, 0], cabeza: [-25, 0, 0], torso: [40, 0, 0]}], [0.55, {brazoDe: [-70, 0, -10], antebrazoDe: [-130, 0, 0], cabeza: [-25, 0, 0], torso: [40, 0, 0]}], [0.75, {brazoDe: [-30, 0, -20], antebrazoDe: [-40, 0, 0]}], [1, {brazoDe: [-30, 0, -20], antebrazoDe: [-40, 0, 0]}]], [[0.3, 'trago'], [0.45, 'trago']]);
sentadoBucle('fumar_pipa', 7, [[0, {brazoDe: [-45, 0, -15], antebrazoDe: [-110, 0, 0], brazoIz: [-30, 0, 20], antebrazoIz: [-40, 0, 0]}], [0.2, {brazoDe: [-50, 0, -15], antebrazoDe: [-140, 0, 0], cabeza: [-6, 0, 0]}], [0.32, {brazoDe: [-45, 0, -15], antebrazoDe: [-110, 0, 0], cabeza: [-10, 10, 0]}], [1, {brazoDe: [-45, 0, -15], antebrazoDe: [-110, 0, 0], brazoIz: [-30, 0, 20], antebrazoIz: [-40, 0, 0]}]], [[0.2, 'calada'], [0.34, 'humo']]);
sentadoBucle('escribir_carta', 6, [[0, {torso: [70, 0, 0], cabeza: [30, 0, 0], brazoIz: [-40, 0, 10], antebrazoIz: [-80, 0, 0], brazoDe: [-40, 0, -10], antebrazoDe: [-80, 0, 0]}], [0.25, {torso: [70, 0, 0], cabeza: [30, 0, 0], brazoDe: [-38, 0, -6], antebrazoDe: [-84, 0, 0]}], [0.5, {torso: [70, 0, 0], cabeza: [30, 0, 0], brazoDe: [-42, 0, -14], antebrazoDe: [-78, 0, 0]}], [1, {torso: [70, 0, 0], cabeza: [30, 0, 0], brazoIz: [-40, 0, 10], antebrazoIz: [-80, 0, 0], brazoDe: [-40, 0, -10], antebrazoDe: [-80, 0, 0]}]], [[0.6, 'pensar']]);
sentadoBucle('ser_vendado', 4, [[0, {musloIz: [-60, 0, 10], piernaIz: [60, 0, 0], musloDe: [-10, 0, -10], piernaDe: [10, 0, 0], brazoIz: [20, 0, 20], antebrazoIz: [-10, 0, 0], brazoDe: [20, 0, -20], antebrazoDe: [-10, 0, 0], torso: [30, 0, 0], cabeza: [0, 20, 0]}], [1, {musloIz: [-60, 0, 10], piernaIz: [60, 0, 0], musloDe: [-10, 0, -10], piernaDe: [10, 0, 0], brazoIz: [20, 0, 20], antebrazoIz: [-10, 0, 0], brazoDe: [20, 0, -20], antebrazoDe: [-10, 0, 0], torso: [30, 0, 0], cabeza: [0, 20, 0]}]], [[0.5, 'queja']], {pareja: {clip: 'vendar_companero', desfase: [0.55, 0.35, -110]}});
{ const C = new Clip(4, true); const P0 = con(RODILLA, {torso: [40, 0, 0], cabeza: [30, 0, 0]}); [0, 0.25, 0.5, 0.75, 1].forEach((t, i) => C.k(t, con(P0, {brazoIz: [-60 + (i % 2) * 10, 0, 10], antebrazoIz: [-60 - (i % 2) * 20, 0, 0], brazoDe: [-55 - (i % 2) * 10, 0, -10], antebrazoDe: [-70 + (i % 2) * 20, 0, 0]})));
  C.a(0, W.SUELO).a(1, W.SUELO); C.g(0, -1, -1); C.oculta('arma', [[0, 0]]); C.e(0.25, 'vuelta').e(0.75, 'vuelta'); def('vendar_companero', C, {pareja: {clip: 'ser_vendado', desfase: [-0.55, 0.35, 110]}, transiciones: ['idle']}); }
{ const C = new Clip(1.3, true); zancada(C, 16, 22, 14, 'ninguno'); [0, 1].forEach(t => C.k(t, {brazoIz: [-150, 0, 20], antebrazoIz: [-90, 0, 0], brazoDe: [-20, 0, -10], antebrazoDe: [-60, 0, 0], cabeza: [-10, 0, 0]})); C.a(0, W.ESPALDA).a(1, W.ESPALDA);
  C.e(0, 'pisada_iz').e(0.5, 'pisada_de'); def('cargar_herido', C, {avance: 1.0, pareja: {clip: 'ser_cargado', desfase: [0, 0, 0], sobreHombros: true}, transiciones: ['idle']}); }
{ const C = new Clip(1.3, true); const P0 = {pelvis: [-10, 0, 90], torso: [70, 0, 0], cabeza: [40, 0, 0], brazoIz: [10, 0, 20], antebrazoIz: [-20, 0, 0], brazoDe: [10, 0, -20], antebrazoDe: [-10, 0, 0], musloIz: [-60, 0, 0], piernaIz: [70, 0, 0], musloDe: [-50, 0, 0], piernaDe: [60, 0, 0]};
  C.k(0, P0).k(0.5, mas(P0, {brazoIz: [8, 0, 0], brazoDe: [8, 0, 0], cabeza: [6, 0, 0]})).k(1, P0); C.r(0, 0.05, 1.42, -0.05).r(0.5, 0.05, 1.46, -0.05).r(1, 0.05, 1.42, -0.05); C.a(0, W.SUELO).a(1, W.SUELO); C.g(0, -1, -1); C.oculta('arma', [[0, 0]]);
  def('ser_cargado', C, {suelo: 'libre', avance: 1.0, pareja: {clip: 'cargar_herido', desfase: [0, 0, 0]}, transiciones: []}); }
{ const C = new Clip(1.5, true); zancada(C, 18, 22, 8, 'ninguno'); [0, 0.5, 1].forEach((t, i) => C.k(t, {brazoIz: [-28, 0, 12], antebrazoIz: [-70 - (i === 1 ? 4 : 0), 0, 0], brazoDe: [-28, 0, -12], antebrazoDe: [-70 - (i === 1 ? 4 : 0), 0, 0]})); C.a(0, W.ESPALDA).a(1, W.ESPALDA);
  def('llevar_municion', C, {avance: 1.1, objeto: 'caja_municion', transiciones: ['idle']}); }
{ const C = new Clip(1.8, true); zancada(C, 14, 26, 38, 'ninguno'); [0, 0.5, 1].forEach((t, i) => C.k(t, {brazoIz: [-75, 0, 10], antebrazoIz: [-25 - (i === 1 ? 6 : 0), 0, 0], brazoDe: [-75, 0, -10], antebrazoDe: [-25 - (i === 1 ? 6 : 0), 0, 0], cabeza: [-30, 0, 0]})); C.a(0, W.ESPALDA).a(1, W.ESPALDA);
  C.e(0.25, 'esfuerzo').e(0.75, 'esfuerzo'); def('empujar_pieza', C, {avance: 0.7, pareja: {clip: null, desfase: [0, 0.8, 0], objeto: 'rueda_de_pieza'}, transiciones: ['idle']}); }
{ const C = new Clip(1.4, false); C.k(0, SENTADO).k(0.35, con(RODILLA, {torso: [35, 0, 0]})).k(0.7, con(AGACHADO, {torso: [25, 0, 0]})).k(1, FIRME); C.a(0, W.SUELO).a(0.5, W.SUELO).a(0.8, W.PORTA).a(1, W.PORTA); C.g(0, -1, -1).g(0.6, 0.3, 0.72); C.oculta('arma', [[0, 0], [0.55, 1]]);
  C.e(0.35, 'rodilla').e(0.6, 'recoge_arma').e(0.95, 'en_pie'); def('levantarse_sentado', C, {transiciones: ['idle']}); }

/* ---------- mando, música y bandera ---------- */
{ const C = new Clip(2.6, true); const P0 = con(FIRME, {musloIz: [-12, 0, 6]}); C.k(0, P0).k(0.2, mas(P0, {torso: [-4, 10, 0], cabeza: [-12, 10, 0]})).k(0.45, mas(P0, {torso: [8, -6, 0], cabeza: [-4, 0, 0], musloIz: [-10, 0, 0]})).k(0.8, P0).k(1, P0);
  C.a(0, W.ESP_BAJA).a(0.15, W.ESP_ALTA).a(0.3, W.ESP_ALTA).a(0.45, W.ESP_FRENTE).a(0.75, W.ESP_FRENTE).a(0.9, W.ESP_BAJA).a(1, W.ESP_BAJA); C.e(0.2, 'voz').e(0.45, 'voz');
  def('voz_mando', C, {armaCompatible: ['A', 'B', 'C', 'D'], rango: 'oficial', transiciones: ['idle_oficial', 'alzar_espada_cargar']}); }
{ const C = new Clip(4, true); const P0 = con(FIRME, {musloIz: [-14, 0, 6], torso: [0, 20, 0], cabeza: [0, 20, 0], brazoIz: [-92, 0, 8], antebrazoIz: [-6, 0, 0]}); C.k(0, P0).k(0.5, mas(P0, {brazoIz: [-4, 0, 0], torso: [0, -6, 0], cabeza: [0, -8, 0]})).k(1, P0);
  C.a(0, W.ESP_BAJA).a(1, W.ESP_BAJA); C.e(0.1, 'senalar'); def('senalar_catalejo', C, {rango: 'oficial', transiciones: ['observar_catalejo', 'idle_oficial']}); }
{ const C = new Clip(5, true); const P0 = con(FIRME, {cabeza: [24, 0, 0], torso: [4, 0, 0], brazoIz: [-40, 10, 20], antebrazoIz: [-90, 0, 0], brazoDe: [-40, -10, -20], antebrazoDe: [-90, 0, 0]}); C.k(0, P0).k(0.5, mas(P0, {cabeza: [6, 0, 0]})).k(1, P0);
  C.a(0, W.ESP_BAJA, [-1, -1]).a(1, W.ESP_BAJA, [-1, -1]); C.oculta('arma', [[0, 0]]); C.e(0.5, 'pasar_pagina'); def('leer_despacho', C, {rango: 'oficial', objeto: 'papel', transiciones: ['idle_oficial', 'dar_orden_mensajero']}); }
{ const C = new Clip(3, false); C.k(0, FIRME).k(0.2, con(FIRME, {brazoIz: [-85, 30, 30], antebrazoIz: [-10, 0, 0], cabeza: [0, 30, 0], torso: [0, 15, 0]})).k(0.45, con(FIRME, {brazoIz: [-85, 30, 30], antebrazoIz: [-10, 0, 0], cabeza: [0, 30, 0], torso: [0, 15, 0]}))
    .k(0.6, con(FIRME, {brazoDe: [-60, 0, -10], antebrazoDe: [-40, 0, 0]})).k(0.8, con(FIRME, {brazoDe: [-60, 0, -10], antebrazoDe: [-40, 0, 0]})).k(1, FIRME);
  C.a(0, W.ESP_BAJA).a(1, W.ESP_BAJA); C.e(0.2, 'senalar').e(0.6, 'entregar').e(0.75, 'recibido'); def('dar_orden_mensajero', C, {rango: 'oficial', pareja: {clip: 'recibir_orden', desfase: [0, 1.0, 180]}, transiciones: ['idle_oficial']}); }
{ const C = new Clip(3, false); C.k(0, FIRME).k(0.15, con(FIRME, {brazoDe: [-150, 0, -40], antebrazoDe: [-130, 0, 0]})).k(0.3, FIRME).k(0.6, con(FIRME, {brazoIz: [-60, 0, 10], antebrazoIz: [-40, 0, 0]})).k(0.8, con(FIRME, {brazoIz: [-40, 0, 10], antebrazoIz: [-90, 0, 0]})).k(1, FIRME);
  C.a(0, W.HOMBRO).a(1, W.HOMBRO); C.e(0.15, 'saludo').e(0.6, 'entregar').e(0.75, 'recibido'); def('recibir_orden', C, {pareja: {clip: 'dar_orden_mensajero', desfase: [0, 1.0, 180]}, transiciones: ['marcha_gimnastico_discrecion', 'idle']}); }
{ const C = new Clip(0.66, true); zancada(C, 28, 62, 12, 'iz', {carrera: true, braceo: 40}); C.a(0, W.ESP_ALTA).a(0.5, AW(W.ESP_ALTA, {P: [0, 0.04, 0.04], R: [8, 0, 0]})).a(1, W.ESP_ALTA); C.k(0, {cabeza: [-14, 0, 0]}).k(1, {cabeza: [-14, 0, 0]}); C.e(0.05, 'grito');
  def('alzar_espada_cargar', C, {suelo: 'carrera', avance: 2.2, rango: 'oficial', armaCompatible: ['A', 'B', 'C', 'D'], transiciones: ['voz_mando']}); }
// corneta: toques de 1,2 s con respiración entre frases; reglamentos de toques (Francia 1831, Reino Unido «Bugle sounds» 1798/1890)
{ const C = new Clip(4, true); const P0 = con(FIRME, {cabeza: [-10, 0, 0], torso: [-3, 0, 0], brazoIz: [-10, 0, 25], antebrazoIz: [-100, 0, 0]}); C.k(0, P0).k(0.15, mas(P0, {torso: [-3, 0, 0]})).k(0.5, P0).k(0.62, mas(P0, {torso: [-3, 0, 0]})).k(1, P0);
  C.a(0, W.CORNETA).a(0.48, W.CORNETA).a(0.52, AW(W.CORNETA, {P: [0, -0.06, 0.03], R: [15, 0, 0]})).a(0.56, W.CORNETA).a(1, W.CORNETA); [0.05, 0.15, 0.25, 0.35, 0.6, 0.7, 0.8].forEach(t => C.e(t, 'nota')); C.e(0.5, 'respira');
  def('corneta_tocar', C, {musico: 'corneta', transiciones: ['corneta_reposo']}); }
{ const C = new Clip(3.4, true); C.k(0, FIRME).k(0.5, mas(FIRME, {torso: [1, 0, 0]})).k(1, FIRME); C.a(0, W.CORNETA_LADO).a(1, W.CORNETA_LADO); C.g(0, -1, -1); def('corneta_reposo', C, {musico: 'corneta', transiciones: ['corneta_tocar']}); }
// tambor: redoble de marcha (2/4); el palillo derecho es el arma, el izquierdo va en la mano izquierda
function tambor(C, t0, t1, golpes) { for (let i = 0; i <= golpes; i++) { const t = t0 + (t1 - t0) * i / golpes, der = i % 2 === 0; C.a(t, der ? W.PALILLO_ABA : W.PALILLO_ARR); C.k(t, {antebrazoIz: der ? [-75, 0, 0] : [-95, 0, 0], brazoIz: [-30, 0, 18]}); if (i < golpes) C.e(t, der ? 'golpe_de' : 'golpe_iz'); } }
{ const C = new Clip(1.6, true); C.k(0, con(FIRME, {cabeza: [6, 0, 0]})).k(1, con(FIRME, {cabeza: [6, 0, 0]})); tambor(C, 0, 1, 8); def('tambor_tocar', C, {musico: 'tambor', transiciones: ['tambor_marcha']}); }
{ const C = new Clip(1.58, true); zancada(C, 22, 24, 1, 'ninguno'); tambor(C, 0, 1, 8); def('tambor_marcha', C, {musico: 'tambor', avance: 1.3, simetrico: true, transiciones: ['tambor_tocar']}); }
// gaita: puntero en las dos manos, bolsa bajo el brazo izquierdo, balanceo del cuerpo
{ const C = new Clip(2.4, true); const P0 = con(FIRME, {cabeza: [-4, 0, 0], brazoIz: [-25, 0, 22], brazoDe: [-25, 0, -12]}); C.k(0, P0).k(0.25, mas(P0, {torso: [0, 4, 2], brazoIz: [-4, 0, 0]})).k(0.75, mas(P0, {torso: [0, -4, -2]})).k(1, P0);
  C.a(0, W.CHANTER).a(1, W.CHANTER); [0, 0.25, 0.5, 0.75].forEach(t => C.e(t, 'nota')); def('gaita_tocar', C, {musico: 'gaita', transiciones: ['gaita_marcha']}); }
{ const C = new Clip(1.58, true); zancada(C, 20, 22, 0, 'ninguno'); C.a(0, W.CHANTER).a(1, W.CHANTER); [0, 0.25, 0.5, 0.75].forEach(t => C.e(t, 'nota')); def('gaita_marcha', C, {musico: 'gaita', avance: 1.3, simetrico: true, transiciones: ['gaita_tocar']}); }
// bandera: clavar el asta en el suelo y alzar la bandera
{ const C = new Clip(2.6, false); C.k(0, FIRME).k(0.3, con(FIRME, {torso: [-4, 0, 0], brazoDe: [-30, 0, -10]})).k(0.55, con(PIE, {musloIz: [-30, 0, 4], piernaIz: [30, 0, 0], torso: [24, 0, 0]})).k(0.75, con(PIE, {musloIz: [-26, 0, 4], piernaIz: [28, 0, 0], torso: [20, 0, 0]})).k(1, con(FIRME, {torso: [2, 0, 0]}));
  C.a(0, W.BANDERA_HOMBRO).a(0.3, AW(W.BANDERA_CLAVAR, {P: [0, 0.22, 0]})).a(0.55, AW(W.BANDERA_CLAVAR, {P: [0, -0.18, 0.05]})).a(0.75, AW(W.BANDERA_CLAVAR, {P: [0, -0.24, 0.05]})).a(1, AW(W.BANDERA_CLAVAR, {P: [0, -0.24, 0.0], g: [0.55, -1]}));
  C.e(0.55, 'clavar').e(0.75, 'clavar'); def('abanderado_clavar_asta', C, {abanderado: true, transiciones: ['abanderado_alzar']}); }
{ const C = new Clip(3.2, true); const P0 = con(FIRME, {musloIz: [-12, 0, 6], cabeza: [-16, 0, 0], torso: [-4, 0, 0]}); C.k(0, P0).k(0.5, mas(P0, {torso: [-3, 6, 4]})).k(1, P0);
  C.a(0, W.BANDERA_ALTA).a(0.25, AW(W.BANDERA_ALTA, {P: [0.03, 0.04, 0], R: [0, 0, 12]})).a(0.5, AW(W.BANDERA_ALTA, {P: [0, 0.06, 0], R: [0, 0, -4]})).a(0.75, AW(W.BANDERA_ALTA, {P: [-0.03, 0.04, 0], R: [0, 0, -14]})).a(1, W.BANDERA_ALTA);
  C.e(0.05, 'viva'); def('abanderado_alzar', C, {abanderado: true, transiciones: ['ondear', 'abanderado_clavar_asta']}); }

/* ---------- transiciones generales (además de META[clip].transiciones) ---------- */
const TRANSICIONES = {};
Object.entries(META).forEach(([n, m]) => { TRANSICIONES[n] = {}; (m.transiciones || []).forEach(t => { TRANSICIONES[n][t] = 0.2; }); });
Object.assign(TRANSICIONES, {idle: Object.assign(TRANSICIONES.idle || {}, {marcha_ordinario_hombro: 0.3, marcha_carga_hombro: 0.25, descarga_fila2_A: 0.2, descarga_fila2_B: 0.2, descarga_fila2_D: 0.2, cuadro_formar_fila1: 0.2, cuadro_fila2: 0.3,
  carga_bayoneta_trote: 0.25, tambaleo: 0.1, dudar: 0.3, descansar_sentado: 0.6, encogerse: 0.15, escoltar_prisionero: 0.3, capturado_escoltado: 0.3}),
  idle_oficial: {voz_mando: 0.2, senalar_catalejo: 0.2, leer_despacho: 0.3, dar_orden_mensajero: 0.2, alzar_espada_cargar: 0.2, duelo_sable_a: 0.15}, idle_rodilla: {descarga_fila1_A: 0.2, descarga_fila1_B: 0.2, descarga_fila1_D: 0.2},
  marcha_ordinario_hombro: Object.assign(TRANSICIONES.marcha_ordinario_hombro || {}, {marcha_carga_hombro: 0.3, marcha_ordinario_funerala: 0.4, marcha_ordinario_discrecion: 0.3, idle: 0.3})});
function rutaTransicion(desde, hasta) { const cola = [[desde]], vis = new Set([desde]); while (cola.length) { const r = cola.shift(), u = r[r.length - 1]; if (u === hasta) return r.slice(1).map((c, i) => ({clip: c, mezcla: (TRANSICIONES[r[i]] || {})[c]}));
  Object.keys(TRANSICIONES[u] || {}).forEach(v => { if (!vis.has(v)) { vis.add(v); cola.push(r.concat([v])); } }); } return null; }

/* ---------- manos al arma: el IK de troops3d no estira el brazo más de 0,57 m (0,29 + 0,28). Si un punto de agarre queda fuera de alcance,
   primero se acerca la mano izquierda hacia la culata (hasta y = 0,5) y después se acerca el arma a los hombros lo justo. Se hace en las claves. */
function muestreo3(tr, t) { return [1, 2, 3].map(k => muestreo(tr, t, k)); }
function escalon(tr, t) { let a = tr[0]; for (const x of tr) if (x[0] <= t + 1e-9) a = x; return a; }
function alcanzar(T3, clip, alcance) {
  const T = clip.tracks; if (!T.armaP || !T.agarre) return clip; alcance = alcance || 0.55; const NA = Math.max(48, Math.ceil(clip.dur * 60));
  const R = T3.RIGS.soldado, hom = n => { const p = R.find(q => q[0] === n)[2]; return new THREE.Vector3(p[0], p[1], p[2]); }, SD = hom('brazoDe'), SI = hom('brazoIz');
  const ts = [...new Set([].concat(T.armaP, T.armaR || [], T.agarre).map(k => +k[0].toFixed(5)).concat(Array.from({length: NA + 1}, (_, i) => +(i / NA).toFixed(5))))].sort((a, b) => a - b), P2 = [], R2 = [], G2 = [];
  const e = new THREE.Euler(), q = new THREE.Quaternion(), eje = new THREE.Vector3(), p = new THREE.Vector3(), g = new THREE.Vector3(), d = new THREE.Vector3();
  ts.forEach(t => { const P = muestreo3(T.armaP, t), Rr = T.armaR ? muestreo3(T.armaR, t) : [0, 0, 0], ag = escalon(T.agarre, t); let yd = ag[1], yi = ag[2];
    e.set(Rr[0] * D2R, Rr[1] * D2R, Rr[2] * D2R, 'XYZ'); q.setFromEuler(e); eje.set(0, 1, 0).applyQuaternion(q); p.set(P[0], P[1], P[2]);
    const lejos = (y, S) => g.copy(p).addScaledVector(eje, y).distanceTo(S) - alcance;
    if (yi >= 0) while (yi > 0.5 && lejos(yi, SI) > 0) yi = Math.max(0.5, yi - 0.02);
    for (let it = 0; it < 12; it++) { let mov = false; [[yd, SD], [yi, SI]].forEach(([y, S]) => { if (y < 0) return; const x = lejos(y, S); if (x > 1e-3) { d.copy(S).sub(g).normalize(); p.addScaledVector(d, x); mov = true; } }); if (!mov) break; }
    P2.push([t, +p.x.toFixed(4), +p.y.toFixed(4), +p.z.toFixed(4)]); R2.push([t].concat(Rr.map(v => +v.toFixed(3)))); G2.push([t, yd, +yi.toFixed(3)]); });
  T.armaP = P2; T.armaR = R2; T.agarre = G2; return clip;
}

/* ---------- asentar la raíz con la cinemática de troops3d ---------- */
const PTS = [['cabeza', [0, 0.29, 0]], ['cabeza', [0, 0.16, 0.11]], ['torso', [0.17, 0.42, 0.1]], ['torso', [-0.17, 0.42, 0.1]], ['torso', [0.17, 0.42, -0.12]], ['torso', [-0.17, 0.42, -0.12]], ['torso', [0, 0.15, 0.13]], ['torso', [0, 0.25, -0.2]],
  ['pelvis', [0.16, -0.08, -0.12]], ['pelvis', [-0.16, -0.08, -0.12]], ['pelvis', [0, -0.1, 0.12]], ['antebrazoIz', [0, -0.33, 0]], ['antebrazoDe', [0, -0.33, 0]], ['brazoIz', [0, -0.29, 0]], ['brazoDe', [0, -0.29, 0]], ['piernaIz', [0, 0, 0.07]], ['piernaDe', [0, 0, 0.07]],
  ['pieIz', [0, -0.081, -0.065]], ['pieIz', [0, -0.081, 0.175]], ['pieDe', [0, -0.081, -0.065]], ['pieDe', [0, -0.081, 0.175]]];
function bajo(T3, M) { const IX = {}; T3.RIGS.soldado.forEach((p, i) => { IX[p[0]] = i; }); let low = Infinity; PTS.forEach(([p, v]) => { const o = IX[p] * 16, y = M[o + 1] * v[0] + M[o + 5] * v[1] + M[o + 9] * v[2] + M[o + 13]; if (y < low) low = y; }); return low; }
function asentar(T3, nombre, clip, meta, N) {
  if (meta.suelo === 'libre') return clip; N = N || 96; const S = T3.CLIPS.soldado, base = (clip.root && clip.root.length) ? clip.root : [[0, 0, 0, 0]], out = [], tmp = '__inf3d_tmp';
  const rx = t => muestreo(base, t, 1), ry = t => muestreo(base, t, 2), rz = t => muestreo(base, t, 3);
  for (let i = 0; i <= N; i++) { const t = i / N; S[tmp] = Object.assign({}, clip, {root: [[0, rx(t), 0, rz(t)]]}); const M = T3.poseTroop('soldado', tmp, t); const low = bajo(T3, M);
    let y = -low; if (meta.suelo === 'carrera') y = Math.max(ry(t), -low) + Math.max(0, ry(t)); out.push([+t.toFixed(4), +rx(t).toFixed(4), +y.toFixed(4), +rz(t).toFixed(4)]); }
  delete S[tmp]; clip.root = out; return clip;
}
function muestreo(tr, t, k) { if (tr.length === 1 || t <= tr[0][0]) return tr[0][k]; for (let i = 0; i < tr.length - 1; i++) if (t <= tr[i + 1][0]) { const a = tr[i], b = tr[i + 1], u = (t - a[0]) / Math.max(1e-6, b[0] - a[0]), s = u * u * (3 - 2 * u); return a[k] + (b[k] - a[k]) * s; } return tr[tr.length - 1][k]; }

/* ===== registro (se completa con variación y animaciones en las secciones siguientes) ===== */
let _I = null;
function registrar(T3, op) {
  op = op || {}; _I = _I || crear(T3); const tipos = [];
  Object.entries(_I.TIPOS).forEach(([k, K]) => { if (T3.KINDS[k] && !op.reemplazar) return; T3.KINDS[k] = K; if (!T3.TROOP_KINDS.includes(k)) T3.TROOP_KINDS.push(k); tipos.push(k); });
  // clips nuevos (sin pisar los existentes) asentados con la cinemática real
  const S = T3.CLIPS.soldado, clips = [], saltados = [];
  Object.entries(CLIPS).forEach(([n, c]) => { if (S[n] && !op.reemplazar) { saltados.push(n); return; } const copia = JSON.parse(JSON.stringify(c)); alcanzar(T3, copia); asentar(T3, n, copia, META[n]); S[n] = copia; clips.push(n); });
  // los lotes de los tipos inf_* se preparan solos al añadir la primera figura (variación y vello plegado); add() acepta o.variacion
  const TB = T3.TroopBatch.prototype;
  if (!TB._inf3d) { const add0 = TB.add; TB.add = function (x, y, z, yaw, scale, nation, clip, o) { const inf = /^inf_/.test(this.kind); if (inf && !this._iVar) prepararLote(this);
      const i = add0.call(this, x, y, z, yaw, scale, nation, clip, o); if (inf && i >= 0) variar(this, i, (o && o.variacion) || (op.sortear !== false ? variacionAleatoria(this.era) : {})); return i; }; TB._inf3d = true; }
  return {tipos, clips, saltados};
}

/* ===================================================================================== */
/* DEMOSTRACIÓN: demoInfanteria(contenedor, {vista: 'clips' | 'naciones' | 'rangos', clip, nat, era, rango, par, t})
   Requiere Troops3D cargado. Menú para elegir clip, nación, era y rango; la pareja (cuerpo a cuerpo, escolta, vendar…) aparece sola. */
function demoInfanteria(cont, op) {
  op = op || {}; const T3 = root.Troops3D; if (!T3) throw new Error('demoInfanteria necesita Troops3D (troops3d.js)');
  registrar(T3); const q = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new Map(), arg = k => op[k] != null ? op[k] : q.get(k);
  const NAT = ['PRU', 'AUT', 'FRA', 'GBR', 'RUS', 'USA', 'CSA', 'ESP', 'ITA', 'JPN'], RANGOS = Object.keys(_I.TIPOS).map(k => k.slice(4));
  const R = new THREE.WebGLRenderer({antialias: true}); R.setPixelRatio(Math.min(2, root.devicePixelRatio || 1)); R.domElement.style.cssText = 'display:block;width:100%;height:100%'; cont.appendChild(R.domElement);
  const S = new THREE.Scene(); S.background = new THREE.Color(0xc9d2d4); S.fog = new THREE.Fog(0xc9d2d4, 30, 90);
  S.add(new THREE.HemisphereLight(0xffffff, 0x5d6b48, 0.85)); const L = new THREE.DirectionalLight(0xfff1dc, 1.25); L.position.set(-4, 8, 6); S.add(L);
  const suelo = new THREE.Mesh(new THREE.PlaneGeometry(300, 300), new THREE.MeshLambertMaterial({color: 0x86965f})); suelo.rotation.x = -Math.PI / 2; S.add(suelo);
  const cam = new THREE.PerspectiveCamera(32, 1, 0.1, 300); let az = 0.5, el = 0.18, dist = 7, mira = new THREE.Vector3(0, 0.9, 0);
  const sh = new T3.TroopShared(NAT.concat(['TUR', 'GEN'])); let lotes = [];
  const panel = document.createElement('div'); panel.style.cssText = 'position:absolute;right:8px;top:8px;z-index:6;background:#2a1d12e8;color:#f0dfb4;padding:8px 10px;font:13px Georgia,serif;border:1px solid #b08a3e;max-width:300px';
  if (getComputedStyle(cont).position === 'static') cont.style.position = 'relative'; cont.appendChild(panel);
  const sel = (id, ops, v) => `<label style="display:block;margin:3px 0">${id} <select id="i3d_${id}" style="max-width:200px">${ops.map(o => `<option ${o === v ? 'selected' : ''}>${o}</option>`).join('')}</select></label>`;
  const clips = Object.keys(CLIPS), est = {vista: arg('vista') || 'clips', clip: arg('clip') || 'cc_estocada_a', nat: arg('nat') || 'FRA', era: arg('era') || 'A', rango: arg('rango') || 'auto', t: arg('t') != null ? +arg('t') : null};
  panel.innerHTML = sel('vista', ['clips', 'naciones', 'rangos'], est.vista) + sel('clip', clips, est.clip) + sel('nat', NAT, est.nat) + sel('era', ['A', 'B', 'C', 'D', 'E'], est.era) + sel('rango', ['auto'].concat(RANGOS), est.rango)
    + `<label style="display:block;margin:3px 0">t <input id="i3d_t" type="range" min="0" max="1" step="0.01" value="${est.t == null ? 0 : est.t}" style="width:150px"> <input id="i3d_play" type="checkbox" ${est.t == null ? 'checked' : ''}> en marcha</label><div id="i3d_info" style="font-size:12px;opacity:.85;margin-top:4px"></div>`;
  const $ = id => panel.querySelector('#i3d_' + id);
  const tipoDe = cl => { const m = META[cl] || {}; if (est.rango !== 'auto') return 'inf_' + est.rango; return m.musico === 'corneta' ? 'inf_corneta' : m.musico === 'tambor' ? 'inf_tambor' : m.musico === 'gaita' ? 'inf_gaitero' : m.abanderado ? 'inf_abanderado' : m.rango === 'oficial' || /duelo/.test(cl) ? 'inf_teniente' : 'inf_soldado'; };
  const lote = (k, e, n, cap) => { const b = new T3.TroopBatch(sh, k, e, n, cap || 16, {lod: 0}); S.add(b.mesh); lotes.push(b); return b; };
  let tActual = 0, reloj = 0;
  function montar() {
    lotes.forEach(b => { S.remove(b.mesh); b.mesh.geometry.dispose(); }); lotes = []; const info = [];
    if (est.vista === 'clips') { const c = est.clip, m = META[c], C = T3.CLIPS.soldado[c], nat = tipoDe(c) === 'inf_gaitero' ? 'GBR' : est.nat;
      const ph = C.loop ? 0 : 0; lote(tipoDe(c), est.era, nat).add(0, 0, 0, 0, 1, nat, c, {phase: ph, h: 0, bright: 0.5, skin: 0});
      if (m.pareja && m.pareja.clip) { const d = m.pareja.desfase, nat2 = NAT[(NAT.indexOf(nat) + 3) % NAT.length]; lote(tipoDe(m.pareja.clip), est.era, nat2).add(d[0], 0, d[1], d[2] * Math.PI / 180, 1, nat2, m.pareja.clip, {phase: ph, h: 0, bright: 0.5, skin: 2}); }
      info.push(`<b>${c}</b> · ${C.dur.toFixed(2)} s ${C.loop ? '(bucle)' : ''}`, `eventos: ${(C.ev || []).map(e => e[1] + '@' + e[0].toFixed(2)).join(', ') || '—'}`, `armas: ${m.armaCompatible.join('')} · suelo: ${m.suelo}`, m.pareja ? `pareja: ${m.pareja.clip}` : '', `transiciones: ${m.transiciones.join(', ') || '—'}`);
      mira.set(0, 0.9, m.desplazamiento ? m.desplazamiento[2] / 2 : 0); dist = 6; }
    else if (est.vista === 'naciones') { const k = est.rango === 'auto' ? 'inf_soldado' : 'inf_' + est.rango;
      NAT.forEach((n, i) => ['A', 'B', 'C', 'D', 'E'].forEach((e, j) => lote(k, e, n, 2).add((j - 2) * 1.2, 0, -i * 1.5, 0, 1, n, 'idle', {phase: Math.random(), h: 0, bright: 0.5, skin: i % 4})));
      info.push(`${k}: naciones (filas) × eras A–E (columnas)`); mira.set(0, 0.9, -6.5); dist = 17; az = 0.35; }
    else { RANGOS.forEach((r, i) => { const n = r === 'gaitero' ? 'GBR' : est.nat; lote('inf_' + r, est.era, n, 2).add((i - (RANGOS.length - 1) / 2) * 0.95, 0, 0, 0, 1, n, /teniente|capitan/.test(r) ? 'idle_oficial' : 'idle', {phase: Math.random(), h: 0, bright: 0.5, skin: i % 4}); });
      info.push(`rangos · ${est.nat} · era ${est.era}`); mira.set(0, 0.95, 0); dist = 11.5; az = 0; }
    $('info').innerHTML = info.filter(Boolean).join('<br>'); reloj = 0;
  }
  ['vista', 'clip', 'nat', 'era', 'rango'].forEach(k => $(k).onchange = () => { est[k] = $(k).value; montar(); });
  let arr = null; R.domElement.onpointerdown = e => { arr = [e.clientX, e.clientY]; }; root.addEventListener('pointerup', () => { arr = null; });
  R.domElement.onpointermove = e => { if (!arr) return; az -= (e.clientX - arr[0]) * 0.008; el = Math.max(0.02, Math.min(1.3, el + (e.clientY - arr[1]) * 0.006)); arr = [e.clientX, e.clientY]; };
  R.domElement.onwheel = e => { dist = Math.max(2, Math.min(40, dist * (1 + Math.sign(e.deltaY) * 0.1))); e.preventDefault(); };
  montar(); let prev = performance.now(), vivo = true;
  (function paso() { if (!vivo) return; const now = performance.now(), dt = (now - prev) / 1000; prev = now; const w = cont.clientWidth || innerWidth, h = cont.clientHeight || innerHeight;
    if (R.domElement.width !== Math.round(w * R.getPixelRatio()) || R.domElement.height !== Math.round(h * R.getPixelRatio())) R.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix();
    const C = T3.CLIPS.soldado[est.clip]; if ($('play').checked) { reloj += dt; tActual = C.loop ? (reloj / C.dur) % 1 : Math.min(1, (reloj % (C.dur + 1)) / C.dur); $('t').value = tActual; } else tActual = +$('t').value;
    // el tiempo se congela en t·dur: en bucle la fase manda; en un solo pase, el inicio queda en 0
    sh.timeU.value = est.vista === 'clips' ? tActual * C.dur : now / 1000;
    cam.position.set(mira.x + Math.sin(az) * Math.cos(el) * dist, mira.y + Math.sin(el) * dist, mira.z + Math.cos(az) * Math.cos(el) * dist); cam.lookAt(mira); R.render(S, cam); requestAnimationFrame(paso); })();
  return {renderer: R, escena: S, camara: cam, montar, estado: est, parar() { vivo = false; R.dispose(); }};
}

const API = {MOD, ERAS, modelo, armaDe, Z, V, C, CLIPS, META, TRANSICIONES, rutaTransicion, POSES: {W, PIE, FIRME, TIRADOR, RODILLA, SENTADO, AGACHADO, BOCA_ABAJO, TUMBADO_ESP}, registrar, demoInfanteria, instancia: T3 => (_I = _I || crear(T3)), _herramientas: {Clip, asentar, alcanzar, mezcla, mas, con, AW, zancada}, prepararLote, variar, variacionAleatoria, desgaste, PELOS, _crear: crear};
root.infanteria3d = API;
})(typeof window !== 'undefined' ? window : globalThis);
