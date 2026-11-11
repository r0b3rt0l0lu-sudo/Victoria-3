
/* ================= ÉPOCA E (1937–1945): soldados, motorizados, blindados y artillería ================= */
// Mismo contrato que A–D: rig de partes rígidas, animación horneada, zonas de color. Nuevos: zonas M1–M3 (marca nacional) y VEH2
// (segundo color de camuflaje), esqueletos 'vehiculo', 'semioruga' y 'blindado', y el canal 'pos' (traslación por parte en un clip).
const CE = {goma: 0x262422, cristal: 0x2c3438, lona: 0x7c7656, oscuro: 0x34363a, faro: 0xd8d0b0, cantimplora: 0x4e5040, mascara: 0x5a5e52, proyectil: 0xb08a3a, caja: 0x5a4a30};

/* ---------- naciones (época E) ---------- */
// modelo: qué variante nacional de cada vehículo o arma usa la nación. marca: tipo y colores de la marca nacional (zonas M1–M3).
const E_GER = {c: ['#6b6e58', '#3e4a3c', '#646656', '#5c6052'], toc: 'm35', veh: '#4b5156', veh2: '#4b5156', marca: {tipo: 'balken', c: ['#1a1a1a', '#f0ece2', '#1a1a1a']},
  modelo: {equipo: 'ger', botas: true, lmg: 'mg34', camion: 'blitz', semioruga: 'sdkfz251', tanque_medio: 'pz4', cazacarros: 'stug', canon_at: 'pak36', obus: 'sfh18', tripulante: 'gorro_negro'},
  nota: 'Wehrmacht 1939: guerrera M36 feldgrau con cuello verde botella, casco M35, botas altas, máscara antigás en bote. Vehículos gris panzer (RAL 7021) hasta 1943 y cruz de balcón (Balkenkreuz). Bandera: tricolor negra-blanca-roja sin esvástica (decisión de diseño; aprox.).'};
const E_GBR = {c: ['#8a7a4e', '#7a6c44', '#8a7a4e', '#5e5c40'], toc: 'brodie', veh: '#5d6040', veh2: '#3c4230', marca: {tipo: 'roundel', c: ['#1e3a8a', '#f2f0ea', '#c8102e']},
  modelo: {equipo: 'gbr', botas: false, lmg: 'bren', camion: 'bedford', semioruga: 'm3', tanque_medio: 'crucero', cazacarros: 'generico', canon_at: '2pdr', obus: 'bl6', tripulante: 'boina'},
  nota: 'Battledress 1937 de sarga caqui, casco Brodie Mk II, polainas cortas. Vehículos Khaki Green No. 3 con manchas oscuras. Marca aprox.: escarapela (en 1940–41 se usó la franja blanca-roja-blanca). Semioruga M3 (préstamo y arriendo, 1942+) y cazacarros genérico: aprox.'};
const E_SOV = {c: ['#8a8456', '#b02020', '#7e7a50', '#4f5a32'], toc: 'ssh', veh: '#4f5a32', veh2: '#4f5a32', marca: {tipo: 'estrella', c: ['#c8202a', '#f2f0ea', '#c8202a']},
  modelo: {equipo: 'sov', botas: true, lmg: 'dp', camion: 'zis5', semioruga: 'm3', tanque_medio: 't34', cazacarros: 'su76', canon_at: '53k', obus: 'ml20', tripulante: 'casco_tanquista'},
  nota: 'Gimnastiorka caqui verdoso, casco SSh-36/39, botas; capote enrollado en bandolera. Vehículos verde 4BO y estrella roja (en 1941 muchos sin marca). Semioruga: M3 de préstamo y arriendo (aprox.; el Ejército Rojo apenas tuvo semiorugas propios).'};
NACIONES.GER = {nombre: 'Alemania (Wehrmacht)', bandera: 'horiz', veh: E_GER.veh, f: ['#141414', '#f2f0ea', '#c8202a'], E: E_GER};
NACIONES.SOV = {nombre: 'Unión Soviética', bandera: 'mono', veh: E_SOV.veh, f: ['#c8202a', '#f0c020', '#c8202a'], E: E_SOV};
NACIONES.PRU.E = E_GER; NACIONES.RUS.E = E_SOV; NACIONES.GBR.E = E_GBR;
NACIONES.FRA.E = {c: ['#8a7e56', '#5a5440', '#8a7e56', '#6a6a4c'], toc: 'adrian', veh: '#6a6a44', veh2: '#8a6e48', marca: {tipo: 'roundel', c: ['#1f3f8f', '#f2f0ea', '#c8202a']},
  modelo: {equipo: 'gbr', lmg: 'bren', camion: 'bedford', semioruga: 'm3', tanque_medio: 'somua', cazacarros: 'generico', canon_at: 'pak36', obus: 'sfh18', tripulante: 'casco_tanquista'},
  nota: 'Caqui mostaza (1935) y casco Adrian M26; vehículos con camuflaje de tres tonos (aprox.). Somua S35; resto de modelos aprox. hasta la segunda entrega.'};
NACIONES.USA.E = {c: ['#6e6646', '#5a5436', '#7a6e50', '#5a5a3a'], toc: 'm1', veh: '#4e5234', veh2: '#4e5234', marca: {tipo: 'estrella', c: ['#f2f0ea', '#f2f0ea', '#2a3c78']},
  modelo: {equipo: 'gbr', lmg: 'bren', camion: 'bedford', semioruga: 'm3', tanque_medio: 'crucero', cazacarros: 'generico', canon_at: '2pdr', obus: 'bl6', tripulante: 'casco_tanquista'},
  nota: 'Pardo oliva, casco M1 (1941), polainas de lona; estrella blanca. Modelos propios (Sherman, M3, GMC) en la segunda entrega.'};
NACIONES.ITA.E = {c: ['#7a7c62', '#b02020', '#7a7c62', '#6c6e58'], toc: 'm33', veh: '#8a7e56', veh2: '#6a6a50', marca: {tipo: 'ninguna', c: ['#f2f0ea', '#b02020', '#008c45']}, modelo: {equipo: 'gbr'},
  nota: 'Grigio-verde, casco M33; vehículos caqui sahariano. Sin marca nacional fija (marcas de unidad blancas y rojas): aprox.'};
NACIONES.JPN.E = {c: ['#8a7e4a', '#b8262c', '#8a7e4a', '#7a6e48'], toc: 'gorra_cubrenuca', veh: '#8a7a50', veh2: '#5a5a3a', marca: {tipo: 'sol', c: ['#bc002d', '#f2f0ea', '#bc002d']}, modelo: {equipo: 'gbr'},
  nota: 'Caqui amarillento M98, gorra de campaña con cubrenuca (o casco Tipo 90); tanques ocre con manchas verdes y pardas. Marca aprox.: sol rojo.'};
NACIONES.POL = {nombre: 'Polonia', bandera: 'horiz', veh: '#6a6a44', f: ['#f2f0ea', '#dc143c', '#dc143c'],
  E: {c: ['#7a7450', '#6a6440', '#7a7450', '#6a6a4a'], toc: 'm35', veh: '#6a6a44', veh2: '#8a6e48', marca: {tipo: 'ninguna', c: ['#f2f0ea', '#dc143c', '#f2f0ea']}, modelo: {equipo: 'gbr', botas: true},
    nota: 'Caqui wz.36 y casco wz.31 (aprox.: forma de M35); vehículos con camuflaje de tres tonos. El águila de la gorra no se ve a esta escala: sin marca.'}};
// variantes que solo cambian el color principal o la marca (reutilizan malla, modelos y animaciones)
const E_DERIV = {CAN: ['Canadá', E_GBR, {}], AUS: ['Australia', E_GBR, {c: ['#8a7650', '#7a6c44', '#8a7650', '#5e5c40'], toc: 'sombrero'}], SAF: ['Sudáfrica', E_GBR, {c: ['#9a8a5a', '#7a6c44', '#9a8a5a', '#5e5c40']}],
  HUN: ['Hungría', E_GER, {c: ['#7a6a48', '#5a5038', '#7a6a48', '#6a6450'], marca: {tipo: 'balken', c: ['#f2f0ea', '#1a1a1a', '#f2f0ea']}}], ROU: ['Rumanía', E_GER, {c: ['#7a7450', '#6a6440', '#7a7450', '#6a6a4a'], marca: {tipo: 'roundel', c: ['#002b7f', '#fcd116', '#ce1126']}}],
  YUG: ['Yugoslavia', E_GER, {c: ['#6a6a52', '#5a5a44', '#6a6a52', '#5e6050'], toc: 'adrian', marca: {tipo: 'roundel', c: ['#c8202a', '#1f3f8f', '#f2f0ea']}}],
  FIN: ['Finlandia', E_GER, {c: ['#7a7c74', '#5a5c54', '#7a7c74', '#5c6052'], marca: {tipo: 'ninguna', c: ['#f2f0ea', '#1f3f8f', '#f2f0ea']}}], TUR: ['Turquía', E_GER, {c: ['#7c7448', '#6a6440', '#7c7448', '#6a6a4a'], marca: {tipo: 'ninguna', c: ['#c81e2a', '#f2f0ea', '#c81e2a']}}],
  CHN: ['China (República)', E_GER, {c: ['#6a7480', '#5a6470', '#6a7480', '#5c6052'], marca: {tipo: 'sol', c: ['#1f3f8f', '#f2f0ea', '#1f3f8f']}}], GEN: ['Genérico / neutrales', E_GER, {c: ['#6a6448', '#5a5440', '#646046', '#5e5c46'], marca: {tipo: 'ninguna', c: ['#f2f0ea', '#1a1a1a', '#f2f0ea']}}]};
Object.keys(E_DERIV).forEach(tag => {
  const [nombre, base, over] = E_DERIV[tag], e = Object.assign({}, base, {modelo: Object.assign({}, base.modelo)}, over, {nota: (over.nota || 'Variante: reutiliza la malla y los modelos de ' + (base === E_GBR ? 'Reino Unido' : 'Alemania') + '; solo cambia el color principal' + (over.marca ? ' y la marca' : '') + ' (aprox.).')});
  if (!NACIONES[tag]) NACIONES[tag] = {nombre, bandera: 'horiz', veh: e.veh, f: ['#6a6448', '#e8e0c8', '#2a4a7a']};
  NACIONES[tag].E = e;
});
NACIONES.FIN.f = ['#f2f0ea', '#1f3f8f', '#f2f0ea']; NACIONES.FIN.bandera = 'cruz'; NACIONES.CAN.f = ['#c8102e', '#f2f0ea', '#c8102e']; NACIONES.AUS.f = ['#1a2a6a', '#f2f0ea', '#c8102e']; NACIONES.HUN.f = ['#ce2939', '#f2f0ea', '#477050'];
NACIONES.ROU.f = ['#002b7f', '#fcd116', '#ce1126']; NACIONES.ROU.bandera = 'vert'; NACIONES.YUG.f = ['#1f3f8f', '#f2f0ea', '#c8202a']; NACIONES.SAF.f = ['#e07020', '#f2f0ea', '#1f3f8f'];
const ED = nat => uniformPalette(nat, 'E');
const md = (nat, k, def) => (ED(nat).modelo || {})[k] || def;

/* ---------- marca nacional (calcomanía en un plano) ---------- */
// tipo: balken (cruz de balcón), roundel (escarapela), estrella, sol, ninguna. Se dibuja en el plano local XY mirando a +Z y se gira con yaw.
function nationalMark(g, part, tipo, at, yaw, s) {
  if (!tipo || tipo === 'ninguna') return;
  const P = (x, y, z) => xf([[x, y, z]], at, [0, yaw, 0])[0];
  const Q = (x0, y0, x1, y1, zone, z) => g.quad(P(x0, y0, z), P(x1, y0, z), P(x1, y1, z), P(x0, y1, z), part, zone, 0);
  const D = (r, n, zone, z) => { const c = P(0, 0, z); for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, b = (i + 1) / n * Math.PI * 2; g.tri(c, P(Math.cos(a) * r, Math.sin(a) * r, z), P(Math.cos(b) * r, Math.sin(b) * r, z), part, zone, 0); } };
  const ST = (r, zone, z) => { const c = P(0, 0, z); for (let i = 0; i < 10; i++) { const a = Math.PI / 2 + i / 10 * Math.PI * 2, b = Math.PI / 2 + (i + 1) / 10 * Math.PI * 2, ra = i % 2 ? r * 0.42 : r, rb = i % 2 ? r : r * 0.42; g.tri(c, P(Math.cos(a) * ra, Math.sin(a) * ra, z), P(Math.cos(b) * rb, Math.sin(b) * rb, z), part, zone, 0); } };
  if (tipo === 'balken') { Q(-s, -s * 0.34, s, s * 0.34, Z.M2, 0); Q(-s * 0.34, -s, s * 0.34, s, Z.M2, 0); Q(-s * 0.82, -s * 0.16, s * 0.82, s * 0.16, Z.M1, 0.006); Q(-s * 0.16, -s * 0.82, s * 0.16, s * 0.82, Z.M1, 0.006); }
  else if (tipo === 'roundel') { D(s, 6, Z.M1, 0); D(s * 0.66, 6, Z.M2, 0.005); D(s * 0.33, 6, Z.M3, 0.01); }
  else if (tipo === 'estrella') ST(s, Z.M1, 0);
  else if (tipo === 'sol') D(s * 0.8, 8, Z.M1, 0);
}

/* ---------- soldado E: equipo, cascos, armas ---------- */
function eKit(g, P, o) {
  const st = o.equipo || 'gbr';
  if (o.kitLigero) { g.tet(P.torso, Z.FIX, CE.cantimplora, [-0.2, -0.03, -0.06], 0.06); return; }
  if (st === 'ger') { g.cyl(P.torso, Z.FIX, CE.mascara, [0.02, 0.0, -0.16], 0.055, 0.055, 0.26, 4, {rot: [0, 0, 80], top: true}); g.tet(P.torso, Z.FIX, CE.cantimplora, [-0.2, -0.03, -0.06], 0.06); }
  else if (st === 'sov') { g.cyl(P.torso, Z.FIX, 0x6a6650, [0, 0.24, 0], 0.06, 0.06, 0.62, 4, {rot: [0, 0, -48], sz: 2.3}); g.tet(P.torso, Z.FIX, CE.cantimplora, [-0.2, -0.03, -0.06], 0.06); }
  else { g.box(P.torso, Z.FIX, 0x7a7050, [0, 0.3, -0.16], [0.28, 0.22, 0.1]); g.tet(P.torso, Z.FIX, CE.cantimplora, [-0.2, -0.03, -0.06], 0.06); }
}
function headgearE(g, h, toc, o) {
  const H = Z.HAT;
  if (o && o.lite && /^(m35|ssh|m1|m33)$/.test(toc)) { g.cyl(h, H, 0, [0, 0.29, 0], toc === 'ssh' ? 0.19 : 0.168, 0.12, 0.16, 6, {top: true, dome: 0.05}); return; }
  switch (toc) {
    case 'm35': g.cyl(h, H, 0, [0, 0.3, 0], 0.152, 0.13, 0.13, 6, {top: true, dome: 0.05}); g.cyl(h, H, 0, [0, 0.215, -0.012], 0.172, 0.152, 0.05, 6); break;
    case 'ssh': g.cyl(h, H, 0, [0, 0.31, 0], 0.148, 0.12, 0.14, 6, {top: true, dome: 0.05}); g.cyl(h, H, 0, [0, 0.235, 0], 0.2, 0.148, 0.03, 6); break;
    case 'm1': g.cyl(h, H, 0, [0, 0.31, 0], 0.16, 0.13, 0.14, 6, {top: true, dome: 0.05}); g.cyl(h, H, 0, [0, 0.235, 0.0], 0.185, 0.16, 0.02, 6); break;
    case 'm33': g.cyl(h, H, 0, [0, 0.31, 0], 0.15, 0.125, 0.14, 6, {top: true, dome: 0.05}); g.cyl(h, H, 0, [0, 0.235, 0], 0.175, 0.15, 0.025, 6); break;
    case 'gorra_cubrenuca': g.cyl(h, H, 0, [0, 0.3, 0], 0.13, 0.135, 0.1, 6, {top: true}); visor(g, h, 0.255, 0.13);
      g.quad([-0.13, 0.26, -0.06], [-0.13, 0.08, -0.1], [-0.13, 0.08, 0.06], [-0.13, 0.26, 0.06], h, H, 0); g.quad([0.13, 0.26, 0.06], [0.13, 0.08, 0.06], [0.13, 0.08, -0.1], [0.13, 0.26, -0.06], h, H, 0); g.quad([0.12, 0.26, -0.12], [0.12, 0.06, -0.15], [-0.12, 0.06, -0.15], [-0.12, 0.26, -0.12], h, H, 0); break;
    case 'gorro_negro': g.box(h, Z.FIX, 0x1e1e20, [0, 0.29, 0], [0.24, 0.08, 0.27], {taper: 0.4, taperZ: 0.1}); break;
    case 'boina': g.cyl(h, Z.FIX, 0x1e1e20, [0.02, 0.29, 0], 0.15, 0.13, 0.06, 6, {top: true, rot: [0, 0, -12]}); break;
    case 'casco_tanquista': g.cyl(h, Z.FIX, 0x2e2c28, [0, 0.27, 0], 0.15, 0.13, 0.13, 6, {top: true, dome: 0.04}); break;
  }
}
// ametralladoras ligeras (pivote en la culata, +Y hacia la boca; −Z es «arriba» al apuntar)
function weaponE(g, a, w, o) {
  if (w !== 'lmg') return;
  const m = o.lmg || 'bren', D = 0x2a2a2a;
  g.box(a, Z.FIX, m === 'dp' || m === 'bren' ? C.madera : D, [0, 0.16, 0.0], [0.05, 0.32, 0.1], {taper: 0.2, noTop: true});              // culata (8)
  g.box(a, Z.FIX, D, [0, 0.52, -0.01], [0.06, 0.42, 0.08], {noTop: true});                                                               // cajón de mecanismos (8)
  g.cyl(a, Z.FIX, m === 'mg34' ? 0x3a3a3a : D, [0, 0.98, -0.01], 0.028, 0.024, 0.52, 3);                                                   // cañón / camisa (6)
  [1, -1].forEach(s => g.cyl(a, Z.FIX, D, [0.05 * s, 1.0, 0.12], 0.012, 0.012, 0.3, 3, {rot: [80, 0, 14 * s]}));                         // bípode (12)
  if (m === 'bren') g.box(a, Z.FIX, D, [0, 0.6, -0.12], [0.04, 0.16, 0.14], {rot: [-25, 0, 0], noTop: true});                             // cargador curvo superior (8)
  else if (m === 'dp') g.cyl(a, Z.FIX, D, [0, 0.55, -0.075], 0.13, 0.13, 0.03, 5, {rot: [90, 0, 0], top: true});                          // tambor plano (15)
  else g.quad([0.035, 0.5, 0.04], [0.035, 0.4, 0.04], [0.12, 0.3, 0.2], [0.12, 0.42, 0.2], a, Z.FIX, C.laton);                             // cinta (MG34)
}
WEAPON_LOD.lmg = 1.24;

/* ---------- piezas reutilizables de vehículos ---------- */
const whl = (g, part, r, w, at) => g.cyl(part, Z.FIX, CE.goma, at || [0, 0, 0], r, r, w, 6, {rot: [0, 0, 90], top: true, bottom: true});
// soldado sentado (busto): 8 + 10 + 15 triángulos
function seated(g, part, at, yaw, toc) {
  g.box(part, Z.MAIN, 0, [at[0], at[1] + 0.25, at[2]], [0.36, 0.5, 0.22], {noTop: true, rot: [0, yaw, 0]});
  g.cyl(part, Z.FIX, C.piel, [at[0], at[1] + 0.6, at[2]], 0.1, 0.11, 0.2, 5, {vr: V.SKIN});
  const b = toc === 'brodie' ? 0.2 : toc === 'ssh' || toc === 'm1' ? 0.17 : 0.16;
  g.cyl(part, Z.HAT, 0, [at[0], at[1] + 0.73, at[2]], b, 0.08, 0.1, 5, {top: true});
}
// tripulante asomado por la escotilla
function crewman(g, part, hat, dy) {
  dy = dy || 0; const g2 = new GeoBuilder();
  g2.box(part, Z.MAIN, 0, [0, -0.25, 0], [0.38, 0.46, 0.24], {noTop: true}); g2.cyl(part, Z.FIX, C.piel, [0, 0.12, 0], 0.11, 0.12, 0.24, 5, {vr: V.SKIN});
  headgearE(g2, part, hat || 'casco_tanquista', {});
  for (let i = 0; i < g2.p.length; i += 3) g2.p[i + 1] += dy;
  ['p', 'n', 'part', 'zone', 'col', 'vr', 'fx'].forEach(k => { for (let i = 0; i < g2[k].length; i++) g[k].push(g2[k][i]); });      // cabeza a la altura estándar (y 0–0,25) para reutilizar los tocados
}
function decalCamo(g, part, at, yaw, w, h) {                          // mancha de camuflaje (zona VEH2; invisible si VEH2 = VEH)
  const P = (x, y) => xf([[x, y, 0]], at, [0, yaw, 0])[0];
  g.tri(P(-w, -h * 0.4), P(w * 0.7, -h), P(w, h * 0.3), part, Z.VEH2, 0); g.tri(P(-w, -h * 0.4), P(w, h * 0.3), P(-w * 0.4, h), part, Z.VEH2, 0);
}

/* ---------- esqueletos ---------- */
RIGS.vehiculo = [['chasis', -1, [0, 0, 0]], ['caja', 0, [0, 0, 0]], ['ruedaDI', 0, [0.86, 0.45, 2.05]], ['ruedaDD', 0, [-0.86, 0.45, 2.05]], ['ruedaTI', 0, [0.86, 0.45, -1.6]], ['ruedaTD', 0, [-0.86, 0.45, -1.6]],
  ['ruedaT2I', 0, [0.86, 0.45, -2.6]], ['ruedaT2D', 0, [-0.86, 0.45, -2.6]], ['tropas', 1, [0, 0, 0]]];
RIGS.semioruga = [['casco', -1, [0, 0, 0]], ['ruedaI', 0, [0.82, 0.42, 2.05]], ['ruedaD', 0, [-0.82, 0.42, 2.05]], ['orugaI', 0, [0.82, 0, 0]], ['orugaD', 0, [-0.82, 0, 0]], ['tropas', 0, [0, 0, 0]], ['mg', 0, [0, 1.95, 1.0]]];
RIGS.blindado = [['casco', -1, [0, 0, 0]], ['torreta', 0, [0, 1.6, 0]], ['canon', 1, [0, 0.62, 1.0]], ['mg', 0, [-0.45, 1.5, 2.3]], ['comandante', 1, [0, 1.15, -0.55]], ['orugaI', 0, [1.15, 0, 0]], ['orugaD', 0, [-1.15, 0, 0]]];

/* ---------- camión con tropas ---------- */
const TRUCK = {blitz: {hood: [1.12, 0.78, 1.3], hz: 2.25, taper: 0.14, cab: [1.95, 1.05, 1.2], six: false}, bedford: {hood: [1.22, 0.82, 1.25], hz: 2.28, taper: 0.02, cab: [2.0, 1.0, 1.2], six: false},
  zis5: {hood: [1.0, 0.76, 1.55], hz: 2.15, taper: 0.2, cab: [1.9, 1.05, 1.15], six: false}, gmc: {hood: [1.15, 0.85, 1.3], hz: 2.25, taper: 0.08, cab: [2.0, 1.0, 1.2], six: true}};
function buildTruck(o) {
  const g = new GeoBuilder(), P = rigIndex('vehiculo'), M = TRUCK[o.modelo] || TRUCK.blitz, VZ = Z.VEH, ch = P.caja;
  g.box(ch, Z.FIX, CE.oscuro, [0, 0.74, -0.2], [0.95, 0.18, 6.0], {noTop: true});                                      // largueros
  g.box(ch, VZ, 0, [0, 0.95 + M.hood[1] / 2, M.hz], M.hood, {taper: M.taper, taperZ: 0.04});                             // capó
  g.quad([-M.hood[0] / 2 + 0.05, 1.0, M.hz + M.hood[2] / 2 + 0.01], [M.hood[0] / 2 - 0.05, 1.0, M.hz + M.hood[2] / 2 + 0.01], [M.hood[0] / 2 - 0.08, 1.65, M.hz + M.hood[2] / 2 + 0.01], [-M.hood[0] / 2 + 0.08, 1.65, M.hz + M.hood[2] / 2 + 0.01], ch, Z.FIX, CE.oscuro);   // calandra
  [1, -1].forEach(s => { g.box(ch, VZ, 0, [0.82 * s, 1.0, 2.05], [0.42, 0.08, 1.1], {rot: [0, 0, 0], taperZ: 0.2}); g.tet(ch, Z.FIX, CE.faro, [0.55 * s, 1.25, M.hz + M.hood[2] / 2 + 0.04], 0.07); });
  const cz = M.hz - M.hood[2] / 2 - M.cab[2] / 2;
  g.box(ch, VZ, 0, [0, 1.1 + M.cab[1] / 2, cz], M.cab, {taperZ: 0.05});                                                 // cabina
  g.quad([-0.8, 1.72, cz + M.cab[2] / 2 + 0.01], [0.8, 1.72, cz + M.cab[2] / 2 + 0.01], [0.78, 2.05, cz + M.cab[2] / 2 - 0.02], [-0.78, 2.05, cz + M.cab[2] / 2 - 0.02], ch, Z.FIX, CE.cristal);
  [1, -1].forEach(s => g.quad([s * (M.cab[0] / 2 + 0.01), 1.72, cz - 0.4 * s], [s * (M.cab[0] / 2 + 0.01), 1.72, cz + 0.4 * s], [s * (M.cab[0] / 2 + 0.01), 2.02, cz + 0.4 * s], [s * (M.cab[0] / 2 + 0.01), 2.02, cz - 0.4 * s], ch, Z.FIX, CE.cristal));
  [1, -1].forEach(s => nationalMark(g, ch, o.marca, [s * (M.cab[0] / 2 + 0.02), 1.42, cz], s * 90, 0.17));
  const bz0 = cz - M.cab[2] / 2 - 0.08, bl = 3.6, bz = bz0 - bl / 2;
  g.box(ch, VZ, 0, [0, 1.25, bz], [2.2, 0.82, bl], {noTop: true});                                                       // caja de carga
  g.quad([-1.08, 1.13, bz0], [1.08, 1.13, bz0], [1.08, 1.13, bz0 - bl], [-1.08, 1.13, bz0 - bl], ch, Z.FIX, C.madera);   // suelo
  decalCamo(g, ch, [1.11, 1.38, bz - 0.4], 90, 0.6, 0.22); decalCamo(g, ch, [-1.11, 1.38, bz + 0.4], -90, 0.6, 0.22);
  g.box(ch, Z.FIX, CE.lona, [0, 2.15, bz0 - 0.85], [2.24, 1.0, 1.7], {});                                                // lona plegada sobre la mitad delantera
  [[-0.3, 0.75, -90], [-0.9, 0.75, -90], [-1.5, 0.75, -90], [-0.3, -0.75, 90], [-0.9, -0.75, 90], [-1.5, -0.75, 90]].forEach(([dz, x, y]) => seated(g, P.tropas, [x, 1.15, bz0 - 1.75 + dz], y, o.toc));
  whl(g, P.ruedaDI, 0.45, 0.24); whl(g, P.ruedaDD, 0.45, 0.24); whl(g, P.ruedaTI, 0.45, M.six ? 0.24 : 0.4); whl(g, P.ruedaTD, 0.45, M.six ? 0.24 : 0.4);
  if (M.six) { whl(g, P.ruedaT2I, 0.45, 0.24); whl(g, P.ruedaT2D, 0.45, 0.24); }
  return g;
}

/* ---------- semioruga blindado ---------- */
function buildHalftrack(o) {
  const g = new GeoBuilder(), P = rigIndex('semioruga'), VZ = Z.VEH, m = o.modelo === 'm3' ? 'm3' : 'sdkfz251', c = P.casco;
  if (m === 'sdkfz251') {
    g.box(c, VZ, 0, [0, 1.1, 2.05], [1.5, 1.0, 1.7], {taper: 0.3, taperZ: 0.15, bottom: true});                                      // morro del motor en cuña
    g.box(c, VZ, 0, [0, 1.25, -0.6], [2.0, 1.26, 3.7], {noTop: true, taper: 0.1});                                       // compartimento de tropa (costados inclinados)
    g.box(c, VZ, 0, [0, 1.95, 0.95], [1.9, 0.22, 0.5], {rot: [-30, 0, 0]});                                              // placa del conductor
  } else {
    g.box(c, VZ, 0, [0, 1.1, 2.15], [1.3, 1.05, 1.6], {bottom: true}); g.cyl(c, Z.FIX, CE.oscuro, [0, 0.7, 3.05], 0.17, 0.17, 1.2, 5, {rot: [0, 0, 90], top: true, bottom: true});   // capó y rodillo delantero
    g.box(c, VZ, 0, [0, 1.25, -0.55], [2.0, 1.3, 3.8], {noTop: true});
    g.box(c, VZ, 0, [0, 1.85, 1.15], [2.0, 0.35, 0.12], {rot: [-10, 0, 0]});                                             // parabrisas blindado
  }
  g.quad([-0.98, 0.95, 1.2], [0.98, 0.95, 1.2], [0.98, 0.95, -2.45], [-0.98, 0.95, -2.45], c, Z.FIX, CE.oscuro);
  [1, -1].forEach(s => { g.box(c, VZ, 0, [0.82 * s, 0.98, 2.05], [0.4, 0.06, 1.0], {}); nationalMark(g, c, o.marca, [s * 1.01, 1.45, -0.6], s * 90, 0.24); decalCamo(g, c, [s * 1.01, 1.4, 0.4], s * 90, 0.5, 0.2); });
  const prof = [[0.75, 0.55], [0.45, 0.08], [-2.05, 0.08], [-2.4, 0.45], [-2.1, 0.8], [0.5, 0.8]];
  ['orugaI', 'orugaD'].forEach((k, i) => { trackLoop(g, P[k], prof, 0.32, 0, Z.FIX, i ? -1 : 1, 0x45463f); [0.15, -0.55, -1.25, -1.95].forEach(z => g.disc(P[k], Z.FIX, 0x40423c, [(i ? -1 : 1) * 0.17, 0.4, z], 0.3, 6, {rot: [0, i ? 180 : 0, 0]})); });
  whl(g, P.ruedaI, 0.42, 0.2); whl(g, P.ruedaD, 0.42, 0.2);
  g.box(P.mg, VZ, 0, [0, 0.0, 0.05], [0.55, 0.42, 0.03]); g.cyl(P.mg, Z.FIX, 0x2a2a2a, [0, 0.05, 0.35], 0.03, 0.025, 0.8, 4, {rot: [90, 0, 0]});
  [[-0.2, 0.55], [-0.95, 0.55], [-1.7, 0.55], [-0.2, -0.55], [-0.95, -0.55], [-1.7, -0.55]].forEach(([z, x]) => seated(g, P.tropas, [x, 1.05, z], x > 0 ? -90 : 90, o.toc));
  return g;
}

/* ---------- tanque medio y cazacarros ---------- */
// orugas (bandas animadas por el shader), ruedas de rodaje como discos en la cara exterior
function tankRunning(g, P, prof, w, wheels, wr, sprocket) {
  ['orugaI', 'orugaD'].forEach((k, i) => {
    const s = i ? -1 : 1; trackLoop(g, P[k], prof, w, 0, Z.FIX, s, 0x45463f);
    const yb = Math.min(...prof.map(q => q[1])) + wr - 0.03;
    wheels.forEach(z => g.disc(P[k], Z.FIX, 0x3e403a, [s * (w / 2 + 0.01), yb, z], wr, wr > 0.38 ? 8 : 6, {rot: [0, i ? 180 : 0, 0]}));
    if (sprocket) sprocket.forEach(([z, y, r]) => g.disc(P[k], Z.FIX, 0x34363a, [s * (w / 2 + 0.01), y, z], r, 6, {rot: [0, i ? 180 : 0, 0]}));
  });
}
function buildMediumTank(o) {
  const g = new GeoBuilder(), P = rigIndex('blindado'), VZ = Z.VEH, m = o.modelo || 'pz4', c = P.casco, t = P.torreta, gn = P.canon;
  let hw = 1.33; const marks = (y, z, s, onTurret) => [1, -1].forEach(k => nationalMark(g, onTurret ? t : c, o.marca, onTurret ? [k * onTurret, y, z] : [k * hw, y, z], k * 90, s));
  if (m === 't34') {
    g.box(c, VZ, 0, [0, 0.8, -0.35], [2.0, 0.75, 5.9], {taperZ: 0.06});
    g.box(c, VZ, 0, [0, 1.48, -0.6], [3.0, 0.62, 4.6], {taper: 0.22, taperZ: 0.05});                                     // costados inclinados
    g.box(c, VZ, 0, [0, 1.2, 2.25], [2.6, 0.12, 1.7], {rot: [-30, 0, 0], noTop: false});                                 // glacis largo
    g.cyl(t, VZ, 0, [0, 0.42, -0.1], 0.98, 0.78, 0.62, 6, {top: true, dome: 0.05, sz: 1.15});
    g.box(gn, VZ, 0, [0, 0.0, 0.0], [0.55, 0.32, 0.3]); g.cyl(gn, VZ, 0, [0, 0, 1.3], 0.07, 0.06, 2.5, 6, {rot: [90, 0, 0], top: true});
    g.cyl(c, Z.FIX, CE.oscuro, [-0.5, 1.3, 2.75], 0.06, 0.05, 0.25, 4, {rot: [60, 0, 0]});
    tankRunning(g, P, [[2.95, 0.88], [2.65, 0.1], [-2.75, 0.1], [-3.05, 0.6], [-2.8, 0.88], [2.7, 0.92]], 0.5, [2.0, 1.0, 0.0, -1.0, -2.0], 0.41, [[2.75, 0.55, 0.32], [-2.75, 0.55, 0.25]]);
    marks(0.45, -0.1, 0.22, 0.99);
  } else if (m === 'crucero' || m === 'somua') {
    g.box(c, VZ, 0, [0, 0.95, -0.2], [2.0, 0.9, 5.8], {});
    g.box(c, VZ, 0, [0, 1.58, -0.3], [2.5, 0.4, 3.8], {taperZ: 0.1});
    g.box(c, VZ, 0, [0, 1.28, 2.55], [2.0, 0.6, 0.6], {rot: [-35, 0, 0]});
    if (m === 'somua') g.cyl(t, VZ, 0, [0, 0.48, -0.05], 0.8, 0.68, 0.72, 6, {top: true, dome: 0.08, sz: 1.2}); else g.box(t, VZ, 0, [0, 0.5, -0.05], [1.75, 0.66, 2.0], {taper: 0.28, taperZ: 0.25});
    g.box(gn, VZ, 0, [0, -0.1, 0.0], [0.5, 0.36, 0.22]); g.cyl(gn, VZ, 0, [0, -0.1, 0.95], 0.045, 0.04, 1.8, 6, {rot: [90, 0, 0], top: true});
    tankRunning(g, P, [[2.95, 1.12], [2.7, 0.12], [-2.75, 0.12], [-3.05, 0.65], [-2.85, 1.12], [2.75, 1.15]], 0.42, m === 'somua' ? [1.6, 0.8, 0.0, -0.8, -1.6] : [2.0, 0.65, -0.7, -2.05], m === 'somua' ? 0.3 : 0.46, [[2.8, 0.72, 0.3], [-2.75, 0.62, 0.25]]);
    [1, -1].forEach(s => g.box(P[s > 0 ? 'orugaI' : 'orugaD'], VZ, 0, [0, 1.26, -0.05], [0.48, 0.06, 5.8], {}));
    hw = 1.27; marks(1.15, -0.4, 0.26);
  } else {                                                                                                                // pz4 (por defecto)
    g.box(c, VZ, 0, [0, 0.95, 0.0], [1.9, 0.86, 5.6], {});
    g.box(c, VZ, 0, [0, 1.62, -0.45], [2.62, 0.55, 4.0], {});
    g.box(c, VZ, 0, [0, 1.62, 1.72], [1.95, 0.55, 0.36], {});                                                            // placa del conductor
    g.box(c, VZ, 0, [0, 1.15, 2.85], [1.9, 0.55, 0.5], {rot: [-55, 0, 0]});
    g.box(t, VZ, 0, [0, 0.62, -0.1], [1.75, 0.72, 2.2], {taper: 0.18, taperZ: 0.1});
    g.cyl(t, VZ, 0, [0, 1.06, -0.95], 0.3, 0.28, 0.24, 6, {top: true});                                                   // cúpula
    g.box(gn, VZ, 0, [0, 0.0, 0.0], [0.82, 0.42, 0.2]); g.cyl(gn, VZ, 0, [0, 0, 0.75], 0.075, 0.07, 1.3, 6, {rot: [90, 0, 0], top: true});
    tankRunning(g, P, [[3.0, 1.15], [2.72, 0.15], [-2.6, 0.15], [-3.0, 0.7], [-2.85, 1.15], [2.85, 1.25]], 0.4, [1.6, 0.55, -0.5, -1.55], 0.3, [[2.78, 0.72, 0.34], [-2.7, 0.62, 0.24]]);
    [1, -1].forEach(s => g.box(P[s > 0 ? 'orugaI' : 'orugaD'], VZ, 0, [0, 1.3, 0.0], [0.45, 0.05, 5.7], {}));
    marks(1.62, -0.6, 0.26);
  }
  [1, -1].forEach(s => decalCamo(g, c, [s * 1.28, 1.25, 1.1], s * 90, 0.7, 0.28));
  g.cyl(P.mg, Z.FIX, 0x2a2a2a, [0, 0, 0.15], 0.025, 0.022, 0.4, 4, {rot: [90, 0, 0]});
  crewman(g, P.comandante, o.tripulante);
  return g;
}
function buildTankDestroyer(o) {
  const g = new GeoBuilder(), P = rigIndex('blindado'), VZ = Z.VEH, m = o.modelo || 'stug', c = P.casco, t = P.torreta, gn = P.canon;
  g.box(c, VZ, 0, [0, 0.9, 0.0], [1.9, 0.8, 5.4], {});
  g.box(c, VZ, 0, [0, 1.12, 2.7], [1.9, 0.5, 0.5], {rot: [-50, 0, 0]});
  if (m === 'su76') {                                                                                                    // casamata abierta trasera, cañón largo de 76 mm
    g.box(t, VZ, 0, [0, -0.05, -1.2], [2.3, 0.9, 2.4], {noTop: true, taper: 0.06}); g.quad([-1.1, -0.45, -0.05], [1.1, -0.45, -0.05], [1.1, -0.45, -2.35], [-1.1, -0.45, -2.35], t, Z.FIX, CE.oscuro);
    g.box(gn, VZ, 0, [0, -0.62, -0.1], [0.6, 0.45, 0.12]); g.cyl(gn, VZ, 0, [0, -0.55, 1.0], 0.06, 0.05, 2.4, 6, {rot: [90, 0, 0], top: true});
    seated(g, t, [0.5, -0.5, -1.5], 0, o.toc); seated(g, t, [-0.5, -0.5, -1.7], 0, o.toc);
  } else {                                                                                                               // StuG III / casamata genérica: superestructura baja inclinada
    g.box(t, VZ, 0, [0, -0.05, -0.3], [2.5, 0.55, 3.4], {taper: 0.14, taperZ: 0.12});
    g.box(t, VZ, 0, [m === 'generico' ? 0 : -0.15, -0.1, 1.45], [0.85, 0.48, 0.5], {rot: [-25, 0, 0]});
    g.box(gn, VZ, 0, [m === 'generico' ? 0 : -0.15, -0.62, 0.15], [0.5, 0.38, 0.25]); g.cyl(gn, VZ, 0, [m === 'generico' ? 0 : -0.15, -0.62, m === 'generico' ? 1.25 : 0.85], 0.075, 0.065, m === 'generico' ? 2.0 : 1.3, 6, {rot: [90, 0, 0], top: true});
  }
  tankRunning(g, P, [[2.85, 0.95], [2.55, 0.12], [-2.5, 0.12], [-2.85, 0.6], [-2.7, 0.95], [2.7, 1.0]], 0.38, [1.75, 1.0, 0.25, -0.5, -1.25, -2.0], 0.28, [[2.7, 0.62, 0.3], [-2.6, 0.55, 0.24]]);
  [1, -1].forEach(s => { g.box(P[s > 0 ? 'orugaI' : 'orugaD'], VZ, 0, [0, 1.08, 0.0], [0.42, 0.05, 5.5], {}); nationalMark(g, t, o.marca, [s * (m === 'su76' ? 1.16 : 1.27), m === 'su76' ? -0.05 : -0.2, -0.5], s * 90, 0.24); decalCamo(g, c, [s * 0.96, 0.95, 1.2], s * 90, 0.6, 0.22); });
  crewman(g, P.comandante, o.tripulante, m === 'su76' ? -0.95 : -0.88);
  return g;
}

/* ---------- cañón antitanque y obús pesado ---------- */
function buildCannonE(o) {
  const g = new GeoBuilder(), P = rigIndex('canon'), m = o.modelo, pc = 0x5a5c48, pcD = 0x4a4c40;
  const wheels = r => ['ruedaIz', 'ruedaDe'].forEach(k => g.cyl(P[k], Z.FIX, CE.goma, [0, 0, 0], r, r, 0.13, 6, {rot: [0, 0, 90], top: true, bottom: true}));
  if (o.tipo === 'at') {                                                                                                  // 37–57 mm: bajo, escudo, mástiles abiertos
    [1, -1].forEach(s => g.box(P.cureña, Z.FIX, pcD, [0.35 * s, 0.32, -0.95], [0.09, 0.09, 1.8], {rot: [-8, 14 * s, 0]}));
    g.box(P.cureña, Z.FIX, C.hierro, [0, 0.42, 0.15], [1.1, 0.08, 0.1], {noFront: true, noBack: true});
    const sh = m === '2pdr' ? [1.5, 0.75] : m === '53k' ? [1.3, 0.62] : [1.25, 0.55];
    g.box(P.cureña, Z.FIX, pc, [0, 0.42 + sh[1] / 2, 0.42], [sh[0], sh[1], 0.035], {rot: [-12, 0, 0], taper: m === '53k' ? 0.15 : 0.05});
    if (m === '2pdr') [[0, -0.7], [0.55, 0.45], [-0.55, 0.45]].forEach(([x, z]) => g.box(P.cureña, Z.FIX, pcD, [x * 0.6, 0.12, z * 0.6], [0.08, 0.08, 0.9], {rot: [0, Math.atan2(x, z) * 180 / Math.PI, 0]}));
    g.box(P.tubo, Z.FIX, pcD, [0, -0.22, -0.25], [0.16, 0.16, 0.55], {bottom: true});                                   // cierre y cuna
    g.cyl(P.tubo, Z.FIX, 0x3a3c38, [0, -0.2, m === '2pdr' ? 0.95 : 0.85], 0.045, 0.035, m === '2pdr' ? 1.9 : m === '53k' ? 2.0 : 1.6, 6, {rot: [90, 0, 0], top: true});
    wheels(0.33);
  } else {                                                                                                                // obús pesado 150–155 mm con munición apilada
    const heavy = m === 'ml20' ? 1.2 : 1, el = m === 'bl6' ? 26 : 18;
    if (m === 'bl6') g.box(P.cureña, Z.FIX, pcD, [0, 0.45, -1.6], [0.36, 0.22, 3.0], {rot: [-8, 0, 0]});
    else [1, -1].forEach(s => g.box(P.cureña, Z.FIX, pcD, [0.45 * s, 0.4, -1.65], [0.14, 0.16, 3.2], {rot: [-7, 9 * s, 0]}));
    g.box(P.cureña, Z.FIX, pc, [0, 0.82, 0.05], [0.7, 0.42, 1.2], {});
    g.box(P.cureña, Z.FIX, C.hierro, [0, 0.66, 0.15], [1.42, 0.12, 0.14], {noFront: true, noBack: true});
    if (m !== 'bl6') g.box(P.cureña, Z.FIX, pc, [0, 1.25, 0.55], [1.5 * heavy, 0.9, 0.04], {rot: [-8, 0, 0], taper: 0.1});   // escudo
    g.cyl(P.tubo, Z.FIX, 0x3e403a, [0, 0.12, 1.35 * heavy], 0.11, 0.1, m === 'bl6' ? 2.4 : 3.9 * heavy, 6, {rot: [90 - el, 0, 0], top: true});
    g.cyl(P.tubo, Z.FIX, pc, [0, 0.32, 0.6], 0.09, 0.09, 1.6, 6, {rot: [90 - el, 0, 0], top: true, bottom: true});      // recuperador
    g.box(P.tubo, Z.FIX, 0x3e403a, [0, 0.0, -0.45], [0.36, 0.36, 0.5], {bottom: true});
    if (m === 'ml20') { const L = 3.9 * heavy / 2; g.box(P.tubo, Z.FIX, 0x3e403a, [0, 0.12 + Math.sin(el * D2R) * L, 1.35 * heavy + Math.cos(el * D2R) * L], [0.3, 0.22, 0.35], {rot: [-el, 0, 0]}); }   // freno de boca
    wheels(0.62);
    g.box(P.cureña, Z.FIX, CE.caja, [1.5, 0.2, -1.4], [0.6, 0.4, 0.5], {});                                              // cajas y proyectiles apilados
    [[1.3, -0.8], [1.5, -0.8]].forEach(([x, z]) => g.cyl(P.cureña, Z.FIX, CE.proyectil, [x, 0.3, z], 0.075, 0.05, 0.6, 4, {top: true}));
  }
  return g;
}

/* ---------- LOD de los vehículos E ---------- */
function lodTruck(o, lvl) {
  const g = new GeoBuilder(), P = rigIndex('vehiculo');
  if (lvl === 2) { g.box(P.caja, Z.VEH, 0, [0, 1.15, -0.3], [2.2, 2.3, 6.4], {noTop: true}); g.quad([-1.1, 2.3, 2.9], [1.1, 2.3, 2.9], [1.1, 2.3, -3.5], [-1.1, 2.3, -3.5], P.caja, Z.FIX, CE.lona); return g; }
  g.box(P.caja, Z.VEH, 0, [0, 1.3, 1.55], [1.95, 1.3, 2.7], {});
  g.box(P.caja, Z.VEH, 0, [0, 1.25, -1.6], [2.2, 0.6, 3.6], {});
  g.box(P.caja, Z.FIX, CE.lona, [0, 2.1, -0.9], [2.24, 1.0, 1.7], {});
  g.box(P.tropas, Z.MAIN, 0, [0, 1.85, -2.35], [1.8, 0.7, 1.6], {noTop: true}); g.quad([-0.9, 2.2, -1.55], [0.9, 2.2, -1.55], [0.9, 2.2, -3.15], [-0.9, 2.2, -3.15], P.tropas, Z.HAT, 0);
  ['ruedaDI', 'ruedaDD', 'ruedaTI', 'ruedaTD'].forEach(k => g.disc(P[k], Z.FIX, CE.goma, [0, 0, 0], 0.45, 5, {two: true}));
  return g;
}
function lodHalftrack(o, lvl) {
  const g = new GeoBuilder(), P = rigIndex('semioruga');
  if (lvl === 2) { g.box(P.casco, Z.VEH, 0, [0, 0.95, -0.1], [2.1, 1.9, 5.6], {noTop: true}); g.quad([-1.05, 1.9, 2.7], [1.05, 1.9, 2.7], [1.05, 1.9, -2.9], [-1.05, 1.9, -2.9], P.casco, Z.MAIN, 0); return g; }
  g.box(P.casco, Z.VEH, 0, [0, 1.3, 2.05], [1.5, 0.8, 1.7], {taper: 0.3}); g.box(P.casco, Z.VEH, 0, [0, 1.42, -0.6], [2.0, 0.92, 3.7], {});
  ['orugaI', 'orugaD'].forEach(k => g.box(P[k], Z.FIX, C.oruga, [0, 0.45, -0.8], [0.32, 0.8, 3.1], {}));
  g.disc(P.ruedaI, Z.FIX, CE.goma, [0, 0, 0], 0.42, 5, {two: true}); g.disc(P.ruedaD, Z.FIX, CE.goma, [0, 0, 0], 0.42, 5, {two: true});
  g.box(P.tropas, Z.MAIN, 0, [0, 1.95, -0.95], [1.4, 0.4, 2.4], {});
  return g;
}
function lodArmor(o, lvl) {
  const g = new GeoBuilder(), P = rigIndex('blindado'), td = o.td;
  if (lvl === 2) { g.box(P.casco, Z.VEH, 0, [0, 0.8, 0], [2.9, 1.6, 5.9], {taper: 0.12}); return g; }   // bajo y ancho: se distingue del camión (alto, con lona)
  g.box(P.casco, Z.VEH, 0, [0, 1.15, 0], [2.7, 1.3, 5.7], {taperZ: 0.05});
  if (td) g.box(P.torreta, Z.VEH, 0, [0, -0.05, -0.3], [2.4, 0.55, 3.2], {taper: 0.15}); else g.box(P.torreta, Z.VEH, 0, [0, 0.55, -0.1], [1.75, 0.72, 2.1], {taper: 0.2});
  g.cyl(P.canon, Z.VEH, 0, [0, td ? -0.6 : 0, 1.0], 0.08, 0.07, 2.0, 3, {rot: [90, 0, 0]});
  ['orugaI', 'orugaD'].forEach(k => g.box(P[k], Z.FIX, C.oruga, [0, 0.55, 0], [0.42, 1.0, 5.8], {taperZ: 0.12}));
  return g;
}

/* ---------- catálogo E ---------- */
['fusilero', 'artillero', 'obus'].forEach(k => KINDS[k].eras.push('E'));
const _ofus = KINDS.fusilero.o;
KINDS.fusilero.o = (era, nat, r) => era === 'E' ? Object.assign(_ofus(era, nat, r), {bayoneta: true, equipo: md(nat, 'equipo', 'gbr'), botas: md(nat, 'botas', false)}) : _ofus(era, nat, r);
const _oart = KINDS.artillero.o;
KINDS.artillero.o = (era, nat, rol) => era === 'E' ? Object.assign(_oart(era, nat, rol), {arma: {cargador: 'proyectil', municionero: 'proyectil', atacador: 'escobillon'}[rol] || 'ninguna', botas: md(nat, 'botas', false)}) : _oart(era, nat, rol);
KINDS.artillero.roles = KINDS.artillero.roles.concat(['atacador', 'municionero']);
const _oobus = KINDS.obus.o;
KINDS.obus.o = (era, nat) => era === 'E' ? {era, tipo: 'obus_E', modelo: md(nat, 'obus', 'sfh18')} : _oobus(era, nat);
const _bcannon = buildCannon;
KINDS.obus.build = KINDS.canon.build = o => o.era === 'E' ? buildCannonE(o) : _bcannon(o);
Object.assign(KINDS, {
  ametrallador: {rig: 'soldado', clase: 'inf', pal: 'linea', eras: ['E'], nombre: 'Ametrallador (ametralladora ligera)', build: buildSoldier, lod: lodSoldier,
    o: (era, nat) => ({era, toc: hg(nat, 'E', 'linea'), arma: 'lmg', lmg: md(nat, 'lmg', 'bren'), equipo: md(nat, 'equipo', 'gbr'), botas: md(nat, 'botas', false), mochila: false, cartucheras: false, kitLigero: true})},
  camion: {rig: 'vehiculo', clase: 'mot', pal: 'linea', eras: ['E'], nombre: 'Camión de transporte con tropas', build: buildTruck, lod: lodTruck,
    o: (era, nat) => ({era, modelo: md(nat, 'camion', 'blitz'), marca: ED(nat).markType, toc: hg(nat, 'E', 'linea')})},
  semioruga: {rig: 'semioruga', clase: 'mech', pal: 'linea', eras: ['E'], nombre: 'Semioruga blindado con 6 soldados', build: buildHalftrack, lod: lodHalftrack,
    o: (era, nat) => ({era, modelo: md(nat, 'semioruga', 'sdkfz251'), marca: ED(nat).markType, toc: hg(nat, 'E', 'linea')})},
  tanque_medio: {rig: 'blindado', clase: 'arm', pal: 'linea', eras: ['E'], nombre: 'Tanque medio', build: buildMediumTank, lod: lodArmor,
    o: (era, nat) => ({era, modelo: md(nat, 'tanque_medio', 'pz4'), marca: ED(nat).markType, tripulante: md(nat, 'tripulante', 'casco_tanquista')})},
  cazacarros: {rig: 'blindado', clase: 'arm', pal: 'linea', eras: ['E'], nombre: 'Cañón de asalto / cazacarros', build: buildTankDestroyer, lod: (o, l) => lodArmor(Object.assign({td: true}, o), l),
    o: (era, nat) => ({era, modelo: md(nat, 'cazacarros', 'stug'), marca: ED(nat).markType, tripulante: md(nat, 'tripulante', 'casco_tanquista'), toc: hg(nat, 'E', 'linea')})},
  canon_at: {rig: 'canon', clase: 'art', pal: 'artilleria', eras: ['E'], nombre: 'Cañón antitanque', build: buildCannonE, lod: lodCannon, o: (era, nat) => ({era, tipo: 'at', modelo: md(nat, 'canon_at', 'pak36')})}
});
['ametrallador', 'camion', 'semioruga', 'tanque_medio', 'cazacarros', 'canon_at'].forEach(k => { if (!TROOP_KINDS.includes(k)) TROOP_KINDS.push(k); });

/* ---------- animaciones E ---------- */
// remapea el tiempo de un clip: el instante tFrom pasa a tTo (tramos lineales); sirve para sincronizar papeles con un ciclo nuevo
function retime(c, dur, tFrom, tTo) {
  const f = t => t <= tFrom ? t / tFrom * tTo : tTo + (t - tFrom) / (1 - tFrom) * (1 - tTo), o = cp(c); o.dur = dur;
  const R = tr => tr && tr.forEach(k => { k[0] = f(k[0]); });
  Object.values(o.tracks).forEach(R); R(o.root); if (o.hide) Object.values(o.hide).forEach(R); if (o.pos) Object.values(o.pos).forEach(R); (o.ev || []).forEach(e => { e[0] = f(e[0]); });
  return o;
}
const PRONE = {pelvis: [[0, 88, 0, 0]], torso: [[0, -18, 0, 0]], cabeza: [[0, -58, 0, 0]], musloIz: [[0, 0, 0, 8]], musloDe: [[0, 0, 0, -8]], piernaIz: [[0, 12, 0, 0]], piernaDe: [[0, 8, 0, 0]]};
const PRONE_ROOT = [[0, 0, -0.76, 0.45]], APUNTA_T = {P: [-0.12, 0.38, -0.05], R: [20, 0, 0]};
Object.assign(CLIPS.soldado, {
  tumbarse: mk(1.0, false, {pelvis: [[0, 0, 0, 0], [0.4, 0, 0, 0], [1, 88, 0, 0]], torso: [[0, 0, 0, 0], [0.4, 20, 0, 0], [1, -18, 0, 0]], cabeza: [[0, 0, 0, 0], [0.4, 10, 0, 0], [1, -58, 0, 0]],
    musloIz: [[0, 0, 0, 0], [0.4, -85, 0, 4], [1, 0, 0, 8]], piernaIz: [[0, 0, 0, 0], [0.4, 85, 0, 0], [1, 12, 0, 0]], musloDe: [[0, 0, 0, 0], [0.4, -8, 0, -4], [1, 0, 0, -8]], piernaDe: [[0, 0, 0, 0], [0.4, 95, 0, 0], [1, 8, 0, 0]],
    armaP: [[0].concat(ORDEN.P), [0.4, -0.12, -0.1, 0.3], [1].concat(APUNTA_T.P)], armaR: [[0, 0, 0, 0], [0.4, 60, 0, 0], [1].concat(APUNTA_T.R)], agarre: [[0, 0.92, -1], [0.3, 0.3, 0.75]]},
    [[0.4, 'rodilla'], [0.9, 'cuerpo_a_tierra']], {root: [[0, 0, 0, 0], [0.4, 0, -0.36, 0], [1].concat(PRONE_ROOT[0].slice(1))]}),
  disparar_tumbado: mk(2.4, true, Object.assign(cp(PRONE), {armaP: [[0].concat(APUNTA_T.P), [0.22].concat(APUNTA_T.P), [0.25, -0.12, 0.3, -0.05], [0.3].concat(APUNTA_T.P), [1].concat(APUNTA_T.P)], armaR: [[0].concat(APUNTA_T.R), [0.4, 20, 0, -14], [0.6, 20, 0, -14], [0.72].concat(APUNTA_T.R)],
    agarre: [[0, 0.3, 0.75], [0.36, 0.5, 0.75], [0.62, 0.3, 0.75]]}), [[0.22, 'disparo'], [0.4, 'cerrojo_atras'], [0.56, 'cerrojo_adelante']], {root: cp(PRONE_ROOT)}),
  disparar_rafaga: mk(1.2, true, Object.assign(cp(PRONE), {armaP: [0, 0.07, 0.14, 0.21, 0.28, 0.35, 0.42, 0.5, 1].map((t, i) => [t, -0.12, i < 7 && i % 2 ? 0.355 : 0.38, -0.05]), armaR: [[0].concat(APUNTA_T.R)],
    agarre: [[0, 0.3, 0.1]], cabeza: [[0, -58, 0, 0]]}), [[0, 'rafaga'], [0.07, 'disparo'], [0.21, 'disparo'], [0.35, 'disparo'], [0.42, 'casquillos']], {root: cp(PRONE_ROOT)}),
  avance_agachado: mk(0.8, true, {musloIz: [[0, -75, 0, 4], [0.5, -25, 0, 4], [1, -75, 0, 4]], piernaIz: [[0, 70, 0, 0], [0.25, 100, 0, 0], [0.5, 50, 0, 0], [1, 70, 0, 0]], musloDe: [[0, -25, 0, -4], [0.5, -75, 0, -4], [1, -25, 0, -4]], piernaDe: [[0, 50, 0, 0], [0.5, 70, 0, 0], [0.75, 100, 0, 0], [1, 50, 0, 0]],
    torso: [[0, 35, 0, 0]], cabeza: [[0, -30, 0, 0]], armaP: [[0, -0.05, -0.15, 0.3]], armaR: [[0, 60, 0, 30]], agarre: [[0, 0.35, 0.85]]}, [[0, 'paso'], [0.5, 'paso']], {root: [[0, 0, -0.24, 0], [0.25, 0, -0.2, 0], [0.5, 0, -0.24, 0], [0.75, 0, -0.2, 0], [1, 0, -0.24, 0]]}),
  lanzar_granada: mk(1.4, false, {brazoDe: [[0, 0, 0, -4], [0.35, 50, 0, -20], [0.55, -165, 0, -10], [0.8, -60, 0, -10], [1, 0, 0, -4]], antebrazoDe: [[0, -10, 0, 0], [0.35, -100, 0, 0], [0.55, -15, 0, 0], [1, -10, 0, 0]],
    torso: [[0, 0, 0, 0], [0.35, -12, 30, 0], [0.55, 18, -20, 0], [1, 0, 0, 0]], cabeza: [[0, 0, 0, 0], [0.35, -10, -20, 0], [0.55, -10, 0, 0], [1, 0, 0, 0]],
    musloIz: [[0, -20, 0, 0], [0.55, -35, 0, 0], [1, -4, 0, 2]], piernaIz: [[0, 15, 0, 0]], musloDe: [[0, 15, 0, 0], [0.55, 20, 0, 0], [1, 2, 0, -2]],
    armaP: [[0, 0.3, -0.9, 0.12]], armaR: [[0, 0, 0, 0]], agarre: [[0, -1, 0.92]]}, [[0.55, 'lanzar']]),
  cubrirse: cp(CLIPS.soldado.ponerse_a_cubierto), morir_1: cp(CLIPS.soldado.caer_muerto_atras), morir_2: cp(CLIPS.soldado.caer_muerto_adelante), cuerpo_a_cuerpo_bayoneta: cp(CLIPS.soldado.melee_2), recarga: cp(CLIPS.soldado.recargar_D),
  disparar: cp(CLIPS.soldado.disparar_D),
  srv_at_cargador: kneel(retime(CLIPS.soldado.srv_cargador, 3.0, 0.62, 0.45)), srv_at_apuntador: kneel(retime(CLIPS.soldado.srv_apuntador, 3.0, 0.62, 0.45)), srv_at_jefe: retime(CLIPS.soldado.srv_jefe, 3.0, 0.62, 0.45),
  srv_E_cargador: retime(CLIPS.soldado.srv_cargador, 5.0, 0.62, 0.55), srv_E_atacador: retime(CLIPS.soldado.srv_escobillon, 5.0, 0.62, 0.55), srv_E_cierre: retime(CLIPS.soldado.srv_artillero, 5.0, 0.62, 0.55),
  srv_E_apuntador: retime(CLIPS.soldado.srv_apuntador, 5.0, 0.62, 0.55),
  srv_E_municionero: mk(5.0, true, {musloIz: [[0, 0, 0, 0], [0.1, -25, 0, 0], [0.2, 15, 0, 0], [0.3, -20, 0, 0], [0.4, -50, 0, 0], [0.5, -50, 0, 0], [0.6, 15, 0, 0], [0.7, -25, 0, 0], [0.8, 10, 0, 0], [0.9, 0, 0, 0]],
    musloDe: [[0, 0, 0, 0], [0.1, 15, 0, 0], [0.2, -25, 0, 0], [0.3, 15, 0, 0], [0.4, -20, 0, 0], [0.5, -20, 0, 0], [0.6, -25, 0, 0], [0.7, 15, 0, 0], [0.8, -20, 0, 0], [0.9, 0, 0, 0]],
    piernaIz: [[0, 0, 0, 0], [0.4, 60, 0, 0], [0.5, 60, 0, 0], [0.6, 10, 0, 0]], torso: [[0, 4, 0, 0], [0.4, 45, 0, 0], [0.5, 45, 0, 0], [0.6, 8, 0, 0], [1, 4, 0, 0]],
    brazoDe: [[0, -50, 0, -10], [0.35, -20, 0, -10], [0.45, -60, 0, -10], [0.6, -55, 0, -14], [1, -50, 0, -10]], antebrazoDe: [[0, -70, 0, 0], [0.45, -20, 0, 0], [0.6, -75, 0, 0], [1, -70, 0, 0]],
    brazoIz: [[0, -45, 0, 10], [0.45, -60, 0, 10], [0.6, -50, 0, 14], [1, -45, 0, 10]], antebrazoIz: [[0, -70, 0, 0], [0.45, -20, 0, 0], [0.6, -75, 0, 0], [1, -70, 0, 0]], arma: [[0, 0, 0, 0]]},
    [[0.45, 'recoge_proyectil'], [0.92, 'entrega']], {root: [[0, 0, 0, 0], [0.38, 0, 0, -1.3], [0.52, 0, -0.12, -1.3], [0.9, 0, 0, 0], [1, 0, 0, 0]], pos: {}})
});
Object.values(CLIPS.soldado).forEach(c => { if (!c.tracks.armaP && !c.tracks.arma) Object.assign(c.tracks, arm(ORDEN, [0.92, -1])); });
// cañón E: ciclos con retroceso del tubo por el canal pos
Object.assign(CLIPS.canon, {
  servicio_at: mk(3.0, true, {tubo: [[0, 2, 0, 0]]}, [[0.15, 'cargar'], [0.25, 'cierre'], [0.35, 'apuntar'], [0.45, 'fuego'], [0.47, 'retroceso'], [0.6, 'extraer_casquillo']], {pos: {tubo: [[0, 0, 0, 0], [0.44, 0, 0, 0], [0.47, 0, 0, -0.28], [0.65, 0, 0, 0], [1, 0, 0, 0]]}, root: [[0, 0, 0, 0], [0.44, 0, 0, 0], [0.48, 0, 0, -0.06], [0.7, 0, 0, 0], [1, 0, 0, 0]]}),
  servicio_E: mk(5.0, true, {tubo: [[0, 0, 0, 0]], cureña: [[0, 0, 0, 0], [0.54, 0, 0, 0], [0.57, -1.2, 0, 0], [0.7, 0, 0, 0]]}, [[0.15, 'cargar'], [0.3, 'atacar'], [0.4, 'cierre'], [0.55, 'fuego'], [0.57, 'retroceso'], [0.75, 'extraer_casquillo']],
    {pos: {tubo: [[0, 0, 0, 0], [0.54, 0, 0, 0], [0.57, 0, -0.18, -0.65], [0.8, 0, 0, 0], [1, 0, 0, 0]]}}),
  elevar_antiaereo: mk(2.0, false, {tubo: [[0, 0, 0, 0], [1, -60, 0, 0]]}, [[1, 'elevado']])
});
CLIPS.vehiculo = {
  ralenti: mk(1.0, true, {caja: [[0, 0, 0, 0.3], [0.25, 0.1, 0, -0.2], [0.5, 0, 0, 0.25], [0.75, -0.1, 0, -0.3], [1, 0, 0, 0.3]]}),
  avanzar: mk(0.9, true, {ruedaDI: [[0, 0, 0, 0], [1, 360, 0, 0]], ruedaDD: [[0, 0, 0, 0], [1, 360, 0, 0]], ruedaTI: [[0, 0, 0, 0], [1, 360, 0, 0]], ruedaTD: [[0, 0, 0, 0], [1, 360, 0, 0]], ruedaT2I: [[0, 0, 0, 0], [1, 360, 0, 0]], ruedaT2D: [[0, 0, 0, 0], [1, 360, 0, 0]],
    caja: [[0, 0.5, 0, 0.8], [0.5, -0.4, 0, -0.8], [1, 0.5, 0, 0.8]], tropas: [[0, 0, 0, 0], [0.25, 1.5, 0, 0], [0.5, 0, 0, 0], [0.75, 1.5, 0, 0], [1, 0, 0, 0]]}),
  frenar: mk(0.8, false, {caja: [[0, 0, 0, 0], [0.3, 2.5, 0, 0], [0.6, -0.8, 0, 0], [1, 0, 0, 0]]}, [[0.3, 'frenazo']]),
  descargar_tropas: mk(2.0, false, {caja: [[0, 0, 0, 0]]}, [[0.15, 'bajan'], [0.6, 'vacio']], {hide: {tropas: [[0, 1], [0.6, 0]]}}),
  cargar_tropas: mk(2.0, false, {caja: [[0, 0, 0, 0]]}, [[0.1, 'suben'], [0.8, 'lleno']], {hide: {tropas: [[0, 0], [0.8, 1]]}}),
  destruido: mk(1.5, false, {chasis: [[0, 0, 0, 0], [0.2, -6, 0, 8], [1, -3, 0, 10]], caja: [[0, 0, 0, 0], [1, 2, 0, 4]]}, [[0, 'explosion'], [0.3, 'humo']], {root: [[0, 0, 0, 0], [1, 0, -0.12, 0]], hide: {tropas: [[0, 0]]}}),
  volcado: mk(1.5, false, {chasis: [[0, 0, 0, 0], [0.6, 0, 0, 50], [1, 0, 0, 92]]}, [[0, 'explosion'], [0.9, 'vuelco']], {root: [[0, 0, 0, 0], [0.6, -0.4, 0.5, 0], [1, -0.1, 1.08, 0]], hide: {tropas: [[0, 0]]}})
};
CLIPS.semioruga = {
  ralenti: mk(1.0, true, {casco: [[0, 0, 0, 0.3], [0.5, 0, 0, -0.3], [1, 0, 0, 0.3]]}),
  avanzar: mk(1.0, true, {casco: [[0, 0.6, 0, 0], [0.5, -0.6, 0, 0], [1, 0.6, 0, 0]], ruedaI: [[0, 0, 0, 0], [1, 360, 0, 0]], ruedaD: [[0, 0, 0, 0], [1, 360, 0, 0]], tropas: [[0, 0, 0, 0], [0.5, 1.2, 0, 0], [1, 0, 0, 0]]}, [], {tread: 1}),
  frenar: mk(0.8, false, {casco: [[0, 0, 0, 0], [0.3, 2.0, 0, 0], [1, 0, 0, 0]]}, [[0.3, 'frenazo']]),
  disparar_ametralladora: mk(1.2, true, {mg: [[0, 0, -20, 0], [0.5, 0, 20, 0], [1, 0, -20, 0]]}, [[0, 'rafaga'], [0.25, 'rafaga'], [0.5, 'rafaga'], [0.75, 'rafaga']], {pos: {mg: [0, 0.06, 0.12, 0.18, 0.25].map((t, i) => [t, 0, 0, i % 2 ? -0.03 : 0])}}),
  descargar_tropas: mk(2.0, false, {casco: [[0, 0, 0, 0]]}, [[0.15, 'bajan'], [0.6, 'vacio']], {hide: {tropas: [[0, 1], [0.6, 0]]}}),
  cargar_tropas: mk(2.0, false, {casco: [[0, 0, 0, 0]]}, [[0.1, 'suben'], [0.8, 'lleno']], {hide: {tropas: [[0, 0], [0.8, 1]]}}),
  destruido: mk(1.5, false, {casco: [[0, 0, 0, 0], [0.2, -4, 0, 5], [1, -2, 0, 7]], mg: [[0, 0, 0, 0], [1, 30, 0, 40]]}, [[0, 'explosion'], [0.3, 'humo']], {root: [[0, 0, 0, 0], [1, 0, -0.1, 0]], hide: {tropas: [[0, 0]]}})
};
const HIDE_CMD = {comandante: [[0, 0]]};
CLIPS.blindado = {
  ralenti: mk(1.0, true, {casco: [[0, 0, 0, 0.2], [0.5, 0, 0, -0.2], [1, 0, 0, 0.2]], comandante: [[0, 0, 0, 0], [0.5, 0, 30, 0], [1, 0, 0, 0]]}),
  avanzar: mk(1.2, true, {casco: [[0, 0.6, 0, 0], [0.5, -0.6, 0, 0], [1, 0.6, 0, 0]], comandante: [[0, 0, 0, 0]]}, [], {root: [[0, 0, 0, 0], [0.25, 0, 0.02, 0], [0.5, 0, 0, 0], [0.75, 0, 0.02, 0], [1, 0, 0, 0]], tread: 1}),
  retroceder: mk(1.2, true, {casco: [[0, -0.6, 0, 0], [0.5, 0.6, 0, 0], [1, -0.6, 0, 0]]}, [], {tread: -1, hide: cp(HIDE_CMD)}),
  girar_sobre_el_eje: mk(1.2, true, {casco: [[0, 0, 0, 0.6], [0.5, 0, 0, -0.6], [1, 0, 0, 0.6]]}, [], {tread: 1, pivote: true, hide: cp(HIDE_CMD)}),
  girar_torreta: mk(6.0, true, {torreta: [[0, 0, 0, 0], [0.3, 0, 70, 0], [0.5, 0, 70, 0], [0.8, 0, -45, 0], [1, 0, 0, 0]]}, [[0.05, 'motor_torreta']], {hide: cp(HIDE_CMD)}),
  disparar_canon: mk(3.0, true, {torreta: [[0, 0, 0, 0]], canon: [[0, -2, 0, 0], [0.3, -2, 0, 0], [0.32, -5, 0, 0], [0.5, -2, 0, 0], [1, -2, 0, 0]], casco: [[0, 0, 0, 0], [0.3, 0, 0, 0], [0.34, -1.6, 0, 0], [0.5, 0.4, 0, 0], [0.62, 0, 0, 0]]},
    [[0.31, 'disparo'], [0.33, 'fogonazo'], [0.36, 'humo'], [0.7, 'extraer_casquillo']], {pos: {canon: [[0, 0, 0, 0], [0.3, 0, 0, 0], [0.32, 0, 0, -0.38], [0.55, 0, 0, 0], [1, 0, 0, 0]]}, hide: cp(HIDE_CMD)}),
  disparar_ametralladora: mk(0.6, true, {mg: [[0, 0, -4, 0], [0.5, 0, 4, 0], [1, 0, -4, 0]]}, [[0, 'rafaga'], [0.17, 'disparo'], [0.33, 'disparo'], [0.5, 'disparo'], [0.67, 'disparo'], [0.83, 'disparo']], {hide: cp(HIDE_CMD)}),
  inmovilizado: mk(4.0, true, {casco: [[0, 2, 0, 3]], torreta: [[0, 0, 0, 0], [0.4, 0, -25, 0], [0.8, 0, 20, 0], [1, 0, 0, 0]]}, [[0, 'humo_negro'], [0.5, 'humo_negro']], {hide: cp(HIDE_CMD)}),
  incendiado: mk(2.0, true, {casco: [[0, 2, 0, 3]], torreta: [[0, 0, 12, 0]]}, [[0, 'fuego'], [0.25, 'humo_negro'], [0.5, 'fuego'], [0.75, 'humo_negro']], {hide: cp(HIDE_CMD)}),
  destruido: mk(1.6, false, {torreta: [[0, 0, 0, 0], [0.2, -15, 40, 20], [1, -10, 35, 18]], canon: [[0, 0, 0, 0], [1, 14, 0, 0]], casco: [[0, 0, 0, 0], [0.2, -3, 0, 2], [1, 3, 0, 5]]}, [[0, 'explosion'], [0.25, 'incendio'], [0.6, 'carcasa_humeante']],
    {pos: {torreta: [[0, 0, 0, 0], [0.2, 0.15, 0.6, -0.2], [1, 0.3, 0.1, -0.4]]}, root: [[0, 0, 0, 0], [1, 0, -0.12, 0]], hide: cp(HIDE_CMD)}),
  comandante_asomado: mk(4.0, true, {comandante: [[0, 0, 0, 0], [0.3, 0, 45, 0], [0.6, 0, -45, 0], [1, 0, 0, 0]]}, [[0.3, 'observa']])
};
Object.keys(CLIPS).forEach(r => { CLIP_SETS[r] = Object.keys(CLIPS[r]); });

/* ---------- grupos E ---------- */
const _tgroup = troopGroup;
troopGroup = function (name, era, estado, opts) {
  opts = opts || {};
  if (name === 'antitanque') { const f = estado === 'fuego'; return [{kind: 'canon_at', at: [0, 0, 0], clip: f ? 'servicio_at' : 'en_bateria'}, {kind: 'artillero', role: 'apuntador', at: [0.55, -0.7, 0], clip: f ? 'srv_at_apuntador' : 'idle'}, {kind: 'artillero', role: 'cargador', at: [-0.6, -0.75, 0], clip: f ? 'srv_at_cargador' : 'idle'}, {kind: 'artillero', role: 'jefe', at: [-1.4, -1.7, 0], clip: f ? 'srv_at_jefe' : 'idle'}]; }
  if (name === 'bateria' && era === 'E') {
    const f = estado === 'fuego';
    return [{kind: 'obus', at: [0, 0, 0], clip: f ? 'servicio_E' : 'en_bateria'}, {kind: 'artillero', role: 'cargador', at: [0.9, -0.9, 90], clip: f ? 'srv_E_cargador' : 'idle'}, {kind: 'artillero', role: 'atacador', at: [-1.0, -1.4, -90], clip: f ? 'srv_E_atacador' : 'idle'},
      {kind: 'artillero', role: 'artillero', at: [-0.9, -0.4, 90], clip: f ? 'srv_E_cierre' : 'idle'}, {kind: 'artillero', role: 'apuntador', at: [-0.75, 0.6, 0], clip: f ? 'srv_E_apuntador' : 'idle'}, {kind: 'artillero', role: 'municionero', at: [1.0, -0.6, 180], clip: f ? 'srv_E_municionero' : 'idle'}];
  }
  return _tgroup(name, era, estado, opts);
};
TROOP_GROUPS.antitanque = {nombre: 'Cañón antitanque con 3 servidores', estados: ['fuego', 'reposo']};
