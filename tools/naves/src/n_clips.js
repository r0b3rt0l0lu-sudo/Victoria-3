
/* ---------- clips ---------- */
// Formato de troops3d: pistas [t, rx, ry, rz] en grados por parte; root [t, x, y, z] en metros; pos[parte] traslación; ev [t, nombre]; hide[parte] [t, visible].
// La parte «param» lleva en pos.param [t, tren, retroceso, compuertas] y «param2» [t, retroceso AA, 0, 0]. Los giros de la raíz son decorativos
// (balanceo, alabeo, picado); el juego mueve el buque o el avión por su trayectoria.
function mk(dur, loop, tracks, ev, extra) { return Object.assign({dur, loop, tracks: tracks || {}, ev: ev || []}, extra || {}); }
const wave = (n, f) => { const out = []; for (let i = 0; i <= n; i++) { const t = i / n; out.push([t].concat(f(t))); } return out; };
const S2 = t => Math.sin(t * Math.PI * 2), C2 = t => Math.cos(t * Math.PI * 2);
const pulse = (t0, t1, a) => [[0, 0, 0, 0], [t0, 0, 0, 0], [t0 + 0.02, a[0], a[1], a[2]], [t1, 0, 0, 0], [1, 0, 0, 0]];
const P_UP = [[0, 1, 0, 0]], P_DOWN = [[0, 0, 0, 0]];
const CLIPS = {};
const sea = (rA, pA, hA, ph) => ({tracks: {casco: wave(8, t => [pA * S2(t + (ph || 0.25)), 0, rA * S2(t)])}, root: wave(8, t => [0, hA * C2(t * 2), 0])});
CLIPS.buque = {
  navegar_calma: mk(8, true, sea(1.5, 0.5, 0.3).tracks, [], {root: sea(1.5, 0.5, 0.3).root}),
  navegar_marejada: mk(6, true, sea(6, 2.5, 0.8).tracks, [[0.25, 'roción'], [0.75, 'roción']], {root: sea(6, 2.5, 0.8).root}),
  navegar_tormenta: mk(5, true, sea(14, 5, 1.6).tracks, [[0.2, 'ola_rompe'], [0.7, 'ola_rompe']], {root: sea(14, 5, 1.6).root}),
  avante_toda: mk(4, true, {casco: wave(8, t => [-1.2 + 0.4 * S2(t), 0, 1.0 * S2(t)])}, [[0, 'estela'], [0.5, 'estela']]),
  girar_babor: mk(4, true, {casco: wave(4, t => [0, 0, -5 + 0.6 * S2(t)])}),
  girar_estribor: mk(4, true, {casco: wave(4, t => [0, 0, 5 + 0.6 * S2(t)])}),
  fuego_artilleria: mk(6, true, {casco: [[0, 0, 0, 0], [0.1, 0, 0, 0], [0.13, 0, 0, 1.8], [0.4, 0, 0, -0.5], [0.6, 0, 0, 0], [1, 0, 0, 0]]}, [[0.1, 'fuego'], [0.11, 'fogonazo'], [0.14, 'humo'], [0.55, 'cargar']],
    {pos: {param: [[0, 0, 0, 0], [0.1, 0, 0, 0], [0.11, 0, 1, 0], [0.3, 0, 0, 0], [1, 0, 0, 0]]}}),
  andanada: mk(3, false, {casco: [[0, 0, 0, 0], [0.1, 0, 0, 0], [0.14, 0, 0, 4], [0.45, 0, 0, -1.5], [0.8, 0, 0, 0.4], [1, 0, 0, 0]]}, [[0.1, 'fuego'], [0.1, 'fogonazo'], [0.15, 'humo'], [0.2, 'onda_agua']],
    {pos: {param: [[0, 0, 0, 0], [0.1, 0, 0, 0], [0.11, 0, 1, 0], [0.4, 0, 0, 0], [1, 0, 0, 0]]}}),
  fuego_antiaereo: mk(1.2, true, {casco: [[0, 0, 0, 0]]}, [[0, 'fuego_aa'], [0.25, 'fuego_aa'], [0.5, 'fuego_aa'], [0.75, 'fuego_aa']],
    {pos: {param2: [0, 0.02, 0.15, 0.25, 0.27, 0.4, 0.5, 0.52, 0.65, 0.75, 0.77, 0.9, 1].map((t, i) => [t, [0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0][i], 0, 0])}}),
  lanzar_torpedos: mk(3, false, {casco: [[0, 0, 0, 0], [0.3, 0, 0, 0], [0.4, 0, 0, -0.8], [1, 0, 0, 0]]}, [[0.3, 'torpedo'], [0.38, 'torpedo'], [0.46, 'torpedo'], [0.54, 'torpedo']]),
  recibir_impacto: mk(1.6, false, {casco: [[0, 0, 0, 0], [0.05, 1.5, 0, -4], [0.3, -0.8, 0, 2.5], [0.6, 0.3, 0, -1], [1, 0, 0, 0]]}, [[0, 'impacto'], [0.02, 'columna_agua'], [0.2, 'humo']], {root: [[0, 0, 0, 0], [0.05, 0, -0.6, 0], [0.4, 0, 0.2, 0], [1, 0, 0, 0]]}),
  incendio: mk(3, true, {casco: wave(6, t => [0.3 * S2(t), 0, 3 + 0.8 * S2(t)])}, [[0, 'fuego'], [0.33, 'humo_negro'], [0.66, 'fuego']]),
  escorar: mk(5, false, {casco: [[0, 0, 0, 0], [1, 1.5, 0, 18]]}, [[0, 'inundacion'], [0.5, 'humo_negro']], {root: [[0, 0, 0, 0], [1, 0, -2, 0]]}),
  hundirse_proa: mk(14, false, {casco: [[0, 0, 0, 0], [0.4, 8, 0, 4], [1, 28, 0, 9]]}, [[0, 'inundacion'], [0.3, 'vapor'], [0.8, 'remolino'], [1, 'hundido']], {root: [[0, 0, 0, 0], [0.4, 0, -4, 0], [1, 0, -38, 0]]}),
  hundirse_popa: mk(14, false, {casco: [[0, 0, 0, 0], [0.4, -8, 0, -3], [1, -32, 0, -6]]}, [[0, 'inundacion'], [0.3, 'vapor'], [0.8, 'remolino'], [1, 'hundido']], {root: [[0, 0, 0, 0], [0.4, 0, -4, 0], [1, 0, -38, 0]]}),
  volcar: mk(12, false, {casco: [[0, 0, 0, 0], [0.3, 0, 0, 25], [0.7, 2, 0, 120], [1, 4, 0, 165]]}, [[0, 'inundacion'], [0.6, 'vuelco'], [1, 'hundido']], {root: [[0, 0, 0, 0], [0.6, 0, -6, 0], [1, 0, -26, 0]]}),
  partirse: mk(14, false, {casco: [[0, 0, 0, 0], [1, 0, 0, 6]], proa: [[0, 0, 0, 0], [0.1, -4, 0, 0], [0.5, -18, 0, -3], [1, -32, 0, -6]], popa: [[0, 0, 0, 0], [0.1, 4, 0, 0], [0.5, 16, 0, 4], [1, 26, 0, 8]]},
    [[0, 'explosion_santabarbara'], [0.02, 'columna_humo'], [0.1, 'se_parte'], [0.6, 'remolino'], [1, 'hundido']],
    {root: [[0, 0, 0, 0], [0.1, 0, -2, 0], [1, 0, -42, 0]], pos: {proa: [[0, 0, 0, 0], [0.1, 0, 0, 3], [1, 0, -4, 14]], popa: [[0, 0, 0, 0], [0.1, 0, 0, -3], [1, 0, -2, -12]]}}),
  inmersion: mk(8, false, {casco: [[0, 0, 0, 0], [0.3, 4, 0, 0], [0.8, 3, 0, 0], [1, 0, 0, 0]]}, [[0, 'purga'], [0.2, 'burbujas'], [0.7, 'sumergido']], {root: [[0, 0, 0, 0], [1, 0, -12, 0]]}),
  emerger: mk(8, false, {casco: [[0, 0, 0, 0], [0.3, -5, 0, 0], [0.8, -2, 0, 0], [1, 0, 0, 0]]}, [[0, 'soplado'], [0.6, 'espuma'], [1, 'en_superficie']], {root: [[0, 0, -12, 0], [1, 0, 0, 0]]}),
  sumergido_periscopio: mk(8, true, {casco: [[0, 0, 0, 0]], periscopio: [[0, 0, 0, 0], [0.5, 0, 180, 0], [1, 0, 360, 0]]}, [[0, 'estela_periscopio']], {root: [[0, 0, -9.5, 0]], pos: {periscopio: [[0, 0, 2.5, 0]]}}),
  botar_chalupas: mk(6, false, {casco: [[0, 0, 0, 0]]}, [[0.2, 'pescantes'], [0.9, 'chalupas_al_agua']], {pos: {botes: [[0, 0, 0, 0], [0.2, 0, 1, 0], [1, 0, -11, 0]]}}),
  operar_ascensores: mk(12, true, {casco: [[0, 0, 0, 0]]}, [[0, 'ascensor_baja'], [0.5, 'ascensor_sube']], {pos: {ascensores: [[0, 0, 0, 0], [0.15, 0, 0, 0], [0.35, 0, -7, 0], [0.6, 0, -7, 0], [0.8, 0, 0, 0], [1, 0, 0, 0]]}}),
  lanzar_aviones: mk(10, true, {casco: wave(4, t => [-0.6, 0, 0.6 * S2(t)])}, [[0.1, 'despega'], [0.4, 'despega'], [0.7, 'despega']]),
  cortina_de_humo: mk(4, true, {casco: wave(4, t => [-1, 0, 0.8 * S2(t)])}, [[0, 'humo_cortina'], [0.5, 'humo_cortina']]),
  lanzar_bengala: mk(2, false, {casco: [[0, 0, 0, 0]]}, [[0.2, 'bengala']]),
  fondeado: mk(10, true, {casco: wave(4, t => [0.3 * S2(t + 0.3), 0, 0.8 * S2(t)])})
};
['navegar_calma', 'navegar_marejada', 'navegar_tormenta', 'fondeado'].forEach(k => { CLIPS.buque[k].sea = true; });
const GEAR_UP = {param: [[0, 1, 0, 0]]}, GEAR_DN = {param: [[0, 0, 0, 0]]};
CLIPS.avion = {
  en_tierra: mk(2, true, {avion: [[0, -9, 0, 0]]}, [], {pos: cp2(GEAR_DN)}),
  rodar_pista: mk(1.2, true, {avion: wave(4, t => [-9 + 0.4 * S2(t), 0, 0.6 * S2(t * 2)])}, [[0, 'polvo']], {pos: cp2(GEAR_DN)}),
  despegar: mk(6, false, {avion: [[0, -9, 0, 0], [0.35, 0, 0, 0], [0.55, -8, 0, 0], [1, -6, 0, 0]]}, [[0, 'motor_a_fondo'], [0.5, 'despegue'], [0.7, 'tren_arriba']], {pos: {param: [[0, 0, 0, 0], [0.6, 0, 0, 0], [0.9, 1, 0, 0], [1, 1, 0, 0]]}}),
  vuelo_nivelado: mk(4, true, {avion: wave(4, t => [0.6 * S2(t), 0, 1.2 * S2(t + 0.2)])}, [], {root: wave(4, t => [0, 0.3 * S2(t), 0]), pos: cp2(GEAR_UP)}),
  viraje_izquierda: mk(4, true, {avion: wave(4, t => [-3, 0, -60 + 3 * S2(t)])}, [], {pos: cp2(GEAR_UP)}),
  viraje_derecha: mk(4, true, {avion: wave(4, t => [-3, 0, 60 + 3 * S2(t)])}, [], {pos: cp2(GEAR_UP)}),
  ascenso: mk(3, true, {avion: wave(3, t => [-18, 0, 1.5 * S2(t)])}, [], {pos: cp2(GEAR_UP)}),
  picado: mk(3, true, {avion: wave(3, t => [40, 0, 1.5 * S2(t)])}, [[0, 'silbido']], {pos: cp2(GEAR_UP)}),
  tonel: mk(2.5, false, {avion: [[0, 0, 0, 0], [1, 0, 0, 360]]}, [], {pos: cp2(GEAR_UP)}),
  ataque_en_picado: mk(7, false, {avion: [[0, 0, 0, 0], [0.12, 0, 0, 170], [0.2, 65, 0, 180], [0.55, 70, 0, 180], [0.62, 70, 0, 180], [0.75, -25, 0, 180], [0.85, -25, 0, 0], [1, 0, 0, 0]]},
    [[0.15, 'frenos_de_picado'], [0.5, 'sirena'], [0.6, 'bomba'], [0.75, 'recuperacion']], {pos: {param: [[0, 1, 0, 0], [0.55, 1, 0, 0], [0.58, 1, 0, 1], [0.7, 1, 0, 0], [1, 1, 0, 0]]}}),
  disparar: mk(0.6, true, {avion: wave(4, t => [0.3 * S2(t * 3), 0, 0.3 * S2(t * 2)])}, [[0, 'rafaga'], [0.17, 'rafaga'], [0.33, 'rafaga'], [0.5, 'rafaga'], [0.67, 'rafaga'], [0.83, 'rafaga'], [0.4, 'casquillos']], {pos: cp2(GEAR_UP)}),
  disparar_torretas: mk(0.8, true, {avion: [[0, 0, 0, 0]]}, [[0, 'rafaga_torreta'], [0.25, 'rafaga_torreta'], [0.5, 'rafaga_torreta'], [0.75, 'rafaga_torreta']],
    {pos: {param: [[0, 1, 0, 0]], param2: [0, 0.02, 0.2, 0.25, 0.27, 0.45, 0.5, 0.52, 0.7, 0.75, 0.77, 0.95, 1].map((t, i) => [t, [0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0][i], 0, 0])}}),
  soltar_bombas: mk(5, false, {avion: [[0, 0, 0, 0], [0.4, 0, 0, 0], [0.75, -2, 0, 0], [1, 0, 0, 0]]}, [[0.1, 'compuertas'], [0.3, 'bomba'], [0.38, 'bomba'], [0.46, 'bomba'], [0.54, 'bomba'], [0.62, 'bomba'], [0.7, 'bomba'], [0.9, 'compuertas']],
    {pos: {param: [[0, 1, 0, 0], [0.08, 1, 0, 0], [0.22, 1, 0, 1], [0.8, 1, 0, 1], [0.95, 1, 0, 0], [1, 1, 0, 0]]}}),
  lanzar_torpedo: mk(4, false, {avion: [[0, 0, 0, 0], [0.3, 2, 0, 0], [0.45, -6, 0, 0], [1, -10, 0, 0]]}, [[0.35, 'torpedo']], {pos: cp2(GEAR_UP)}),
  lanzar_paracaidistas: mk(8, false, {avion: wave(8, t => [0.4 * S2(t * 3), 0, 1 * S2(t * 2)])}, [0.1, 0.18, 0.26, 0.34, 0.42, 0.5, 0.58, 0.66, 0.74, 0.82].map(t => [t, 'salta']).concat([[0.05, 'luz_verde']]), {pos: cp2(GEAR_UP)}),
  recibir_impacto: mk(1.2, false, {avion: [[0, 0, 0, 0], [0.06, 6, 0, -14], [0.3, -3, 0, 8], [0.6, 1, 0, -3], [1, 0, 0, 0]]}, [[0, 'impacto'], [0.05, 'chispas'], [0.1, 'restos']], {pos: cp2(GEAR_UP)}),
  humo_motor: mk(2, true, {avion: wave(4, t => [1 * S2(t), 0, 4 * S2(t + 0.2)])}, [[0, 'humo_motor'], [0.25, 'humo_motor'], [0.5, 'humo_motor'], [0.75, 'humo_motor']], {pos: cp2(GEAR_UP)}),
  incendio: mk(1.5, true, {avion: wave(4, t => [3 + 1 * S2(t), 0, 6 * S2(t + 0.2)])}, [[0, 'fuego_motor'], [0.33, 'humo_negro'], [0.66, 'fuego_motor']], {pos: cp2(GEAR_UP)}),
  caer_en_barrena: mk(2, true, {avion: wave(8, t => [55, -t * 360, 25])}, [[0, 'humo_negro'], [0.5, 'humo_negro']], {pos: cp2(GEAR_UP)}),
  partirse_ala: mk(5, false, {avion: [[0, 0, 0, 0], [0.15, 10, 0, 40], [1, 70, 0, 400]], alaDe: [[0, 0, 0, 0], [0.12, 0, 0, -20], [1, 50, 120, -420]]}, [[0, 'explosion'], [0.08, 'ala_rota'], [0.2, 'humo_negro'], [0.6, 'humo_negro']],
    {pos: {param: [[0, 1, 0, 0]], alaDe: [[0, 0, 0, 0], [0.12, 0, 0, 0], [1, -12, -40, -30]]}}),
  colision: mk(1.5, false, {avion: [[0, 0, 0, 0], [0.1, 30, 20, 60], [1, 80, 40, 180]]}, [[0, 'colision'], [0.05, 'explosion'], [0.2, 'restos']], {root: [[0, 0, 0, 0], [1, 0, -10, -6]], pos: cp2(GEAR_UP)}),
  aterrizar: mk(7, false, {avion: [[0, -2, 0, 0], [0.5, -3, 0, 0], [0.8, -9, 0, 0], [1, -9, 0, 0]]}, [[0.1, 'tren_abajo'], [0.75, 'toma'], [0.78, 'polvo']], {pos: {param: [[0, 1, 0, 0], [0.1, 1, 0, 0], [0.35, 0, 0, 0], [1, 0, 0, 0]]}}),
  apontar: mk(5, false, {avion: [[0, -6, 0, 0], [0.6, -8, 0, 2], [0.75, -11, 0, 0], [0.8, -6, 0, 0], [1, -9, 0, 0]]}, [[0.72, 'toma'], [0.74, 'cable'], [0.8, 'frenado']], {pos: cp2(GEAR_DN)})
};
CLIPS.aa = {
  reposo: mk(4, true, {base: [[0, 0, 0, 0]]}),
  disparar_AA: mk(1.2, true, {base: wave(6, t => [0.4 * Math.max(0, S2(t * 3)), 0, 0])}, [[0, 'fuego_aa'], [0.33, 'fuego_aa'], [0.66, 'fuego_aa'], [0.5, 'casquillos']],
    {pos: {param2: [0, 0.02, 0.2, 0.33, 0.35, 0.53, 0.66, 0.68, 0.86, 1].map((t, i) => [t, [0, 1, 0, 0, 1, 0, 0, 1, 0, 0][i], 0, 0])}}),
  recargar: mk(3, false, {base: [[0, 0, 0, 0]]}, [[0.3, 'cargador_fuera'], [0.7, 'cargador_dentro']]),
  destruido: mk(1.5, false, {base: [[0, 0, 0, 0], [0.2, -8, 20, 12], [1, -6, 25, 18]]}, [[0, 'explosion'], [0.3, 'humo_negro']], {root: [[0, 0, 0, 0], [1, 0, -0.2, 0]]})
};
function cp2(o) { return JSON.parse(JSON.stringify(o)); }
// clips de proyectiles del juego: «fuego» → cañones principales (emit.torres), «fuego_aa» → montajes AA, «torpedo» → tubos, «bomba» → bodega
const CLIP_SETS = {}; Object.keys(CLIPS).forEach(r => { CLIP_SETS[r] = Object.keys(CLIPS[r]); });
