
/* ================= paracaidista (época E) — añadido con naves3d ================= */
// Parte nueva «paracaidas» (índice 12, hija del torso, pivote en los hombros): solo tiene geometría en el paracaidista y solo se ve en los
// clips con chute: true (descender, aterrizar). En el resto de clips del soldado poseTroop la oculta (escala 0).
RIGS.soldado.push(['paracaidas', 1, [0, 0.45, 0]]);
ROLES.push('paracaidista');
// Fuentes: Osprey Elite 31 «Allied paratroopers» y MAA 139 «German airborne troops 1939–45»; Teishin Shudan (Osprey Elite 61). Japón: aprox.
NACIONES.GBR.rol.paracaidista = {E: {c: ['#9a8a5e', '#5e5a3a', '#8a7a4e', '#5a5c40'], toc: 'casco_para', nota: 'Blusón Denison (1942) de tonos arena y pardo (manchas no modeladas: se usa el tono medio), casco HSAT Mk II sin ala, pantalón de battledress.'}};
NACIONES.GER.rol = NACIONES.GER.rol || {}; NACIONES.GER.rol.paracaidista = {E: {c: ['#7a7e68', '#565c4a', '#5e6a72', '#5c6052'], toc: 'casco_para', nota: 'Fallschirmjäger: blusón (Knochensack) verde gris, pantalón azul gris de la Luftwaffe, casco M38 sin visera ni faldón.'}};
NACIONES.PRU.rol.paracaidista = NACIONES.GER.rol.paracaidista;
NACIONES.JPN.rol = NACIONES.JPN.rol || {}; NACIONES.JPN.rol.paracaidista = {E: {c: ['#8a7e4a', '#6a6440', '#8a7e4a', '#6a6440'], toc: 'casco_para', nota: 'Teishin Shudan (1942): mono caqui y casco de paracaidista redondeado. Aprox.'}};
function paraKit(g, P) {
  // casco redondo sin ala (12) y subfusil se añaden por el tocado y el arma; aquí, el paracaídas (25 triángulos)
  const k = P.paracaidas, LON = 0x7a7458, cy = 5.4;
  g.cyl(k, Z.FIX, LON, [0, cy, 0], 2.9, 1.2, 1.3, 7, {top: true, dome: 0.35});
  [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([sx, sz]) => g.tri([sx * 0.18, 0, 0], [sx * 2.7, cy - 0.65, sz * 1.2], [sx * 2.7, cy - 0.65, sz * 1.35], k, Z.FIX, 0x5a5648));
}
function weaponSMG(g, a, o) {                                          // subfusil (Sten, MP 40, tipo 100): pivote en la culata, +Y hacia la boca
  const D = 0x2a2a2a, m = o.smg || 'sten';
  g.box(a, Z.FIX, m === 'tipo100' ? C.madera : D, [0, 0.12, 0], [0.04, 0.24, 0.07], {taper: 0.2, noTop: true});
  g.box(a, Z.FIX, D, [0, 0.38, -0.01], [0.05, 0.3, 0.06], {noTop: true});
  g.cyl(a, Z.FIX, D, [0, 0.62, -0.01], 0.02, 0.018, 0.2, 3);
  if (m === 'sten') g.box(a, Z.FIX, D, [0.09, 0.4, -0.01], [0.13, 0.04, 0.04], {noTop: true}); else g.box(a, Z.FIX, D, [0, 0.36, 0.1], [0.035, 0.05, 0.16], {noTop: true});
}
const _hgE = headgearE;
headgearE = function (g, h, toc, o) { if (toc === 'casco_para') { g.cyl(h, Z.HAT, 0, [0, 0.29, 0], 0.15, 0.115, 0.15, 6, {top: true, dome: 0.05}); return; } return _hgE(g, h, toc, o); };
const _wE = weaponE;
weaponE = function (g, a, w, o) { if (w === 'subfusil') return weaponSMG(g, a, o); return _wE(g, a, w, o); };
WEAPON_LOD.subfusil = 0.66;
KINDS.paracaidista = {rig: 'soldado', clase: 'inf', pal: 'paracaidista', eras: ['E'], dobleCara: true, nombre: 'Paracaidista',
  build: o => { const g = buildSoldier(o); paraKit(g, rigIndex('soldado')); return g; },
  lod: (o, l) => { const g = lodSoldier(o, l); if (l === 1) { const P = rigIndex('soldado'); g.cyl(P.paracaidas, Z.FIX, 0x7a7458, [0, 5.4, 0], 2.9, 1.2, 1.3, 5, {top: true}); } else if (l === 2) { const P = rigIndex('soldado'); g.box(P.paracaidas, Z.FIX, 0x7a7458, [0, 5.4, 0], [5.4, 1.2, 5.4], {taper: 0.5, taperZ: 0.5, noFront: true, noBack: true}); } return g; },
  o: (era, nat) => ({era, toc: 'casco_para', arma: 'subfusil', smg: nat === 'GER' || nat === 'PRU' ? 'mp40' : nat === 'JPN' ? 'tipo100' : 'sten', mochila: false, cartucheras: true, kitLigero: true, equipo: md(nat, 'equipo', 'gbr'), botas: true})};
if (!TROOP_KINDS.includes('paracaidista')) TROOP_KINDS.push('paracaidista');
const UP_ARMS = {brazoIz: [[0, -165, 0, 12]], brazoDe: [[0, -165, 0, -12]], antebrazoIz: [[0, -12, 0, 0]], antebrazoDe: [[0, -12, 0, 0]], arma: [[0, 0, 0, 0]]};
Object.assign(CLIPS.soldado, {
  saltar_en_paracaidas: mk(1.4, false, {pelvis: [[0, 0, 0, 0], [0.3, 25, 0, 0], [1, 10, 0, 0]], torso: [[0, 0, 0, 0], [0.3, 30, 0, 0], [1, 20, 0, 0]], cabeza: [[0, 0, 0, 0], [1, 25, 0, 0]],
    brazoIz: [[0, -40, 0, 30], [0.3, -60, 0, 40], [1, -50, 0, 35]], brazoDe: [[0, -40, 0, -30], [0.3, -60, 0, -40], [1, -50, 0, -35]], antebrazoIz: [[0, -90, 0, 0]], antebrazoDe: [[0, -90, 0, 0]],
    musloIz: [[0, 0, 0, 0], [0.3, -40, 0, 0], [1, -20, 0, 0]], musloDe: [[0, 0, 0, 0], [0.3, -40, 0, 0], [1, -20, 0, 0]], piernaIz: [[0, 0, 0, 0], [0.3, 50, 0, 0], [1, 30, 0, 0]], piernaDe: [[0, 0, 0, 0], [0.3, 50, 0, 0], [1, 30, 0, 0]], arma: [[0, 0, 0, 0]]},
    [[0.05, 'salta'], [0.9, 'cinta_estatica']], {hide: {arma: [[0, 0]]}}),
  descender_en_paracaidas: mk(3.2, true, Object.assign({pelvis: [[0, 0, 0, -4], [0.5, 0, 0, 4], [1, 0, 0, -4]], torso: [[0, 0, 0, 0]], cabeza: [[0, -15, 0, 0]],
    musloIz: [[0, -12, 0, 2], [0.5, -6, 0, 2], [1, -12, 0, 2]], musloDe: [[0, -12, 0, -2], [0.5, -6, 0, -2], [1, -12, 0, -2]], piernaIz: [[0, 18, 0, 0]], piernaDe: [[0, 18, 0, 0]]}, UP_ARMS),
    [[0, 'balanceo']], {chute: true, hide: {arma: [[0, 0]]}}),
  aterrizar: mk(1.8, false, Object.assign({pelvis: [[0, 0, 0, 0], [0.2, 30, 0, 20], [0.45, 80, 0, 40], [0.7, 30, 0, 10], [1, 0, 0, 0]], torso: [[0, 0, 0, 0], [0.45, 20, 0, 0], [1, 0, 0, 0]],
    musloIz: [[0, -12, 0, 2], [0.2, -60, 0, 0], [0.45, -30, 0, 0], [1, 0, 0, 0]], musloDe: [[0, -12, 0, -2], [0.2, -60, 0, 0], [0.45, -30, 0, 0], [1, 0, 0, 0]], piernaIz: [[0, 18, 0, 0], [0.2, 90, 0, 0], [1, 0, 0, 0]], piernaDe: [[0, 18, 0, 0], [0.2, 90, 0, 0], [1, 0, 0, 0]],
    paracaidas: [[0, 0, 0, 0], [0.2, 0, 0, 0], [0.7, 0, 0, -85], [1, 0, 0, -88]]}, UP_ARMS, {brazoIz: [[0, -165, 0, 12], [0.3, -90, 0, 20], [1, -10, 0, 8]], brazoDe: [[0, -165, 0, -12], [0.3, -90, 0, -20], [1, -10, 0, -8]]}),
    [[0.18, 'toca_suelo'], [0.45, 'rueda'], [0.9, 'libera_arnes']], {chute: true, root: [[0, 0, 0, 0], [0.2, 0, -0.35, 0], [0.45, 0, -0.75, 0], [0.75, 0, -0.3, 0], [1, 0, 0, 0]],
      pos: {paracaidas: [[0, 0, 0, 0], [0.2, 0, -0.3, 0], [0.7, -1.2, -1.0, 0], [1, -1.4, -1.25, 0]]}, hide: {arma: [[0, 0], [0.95, 1]], paracaidas: [[0, 1], [0.97, 0]]}})
});
CLIP_SETS.soldado = Object.keys(CLIPS.soldado);
