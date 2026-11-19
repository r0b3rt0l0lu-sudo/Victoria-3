
/* ================= v4: animación biomecánica =================
   Los ciclos de locomoción se generan a partir de curvas articulares de marcha y carrera humanas (cadera, rodilla, tobillo por % de ciclo;
   valores medios de laboratorio de análisis de la marcha, p. ej. Winter 1991 y Novacheck 1998, redondeados) y de los patrones de pisada de
   los aires del caballo (paso a 4 tiempos lateral, trote diagonal a 2 tiempos, galope transverso de 4 tiempos con suspensión; Muybridge 1878–87,
   Clayton 2004). La altura de la raíz se calcula por cinemática directa para que el pie (o casco) de apoyo no atraviese ni flote sobre el suelo.
   Encima se añade movimiento secundario: balanceo y rotación de la pelvis, contrarrotación del tronco, estabilización de la cabeza, braceo con
   retraso, respiración, cabeceo del cuello del caballo, cola con inercia y compensación del jinete. Los clips existentes conservan nombre,
   duración, eventos y pistas de armas: solo se sustituyen o suman pistas. */
const ANIM = {};
// curva periódica Catmull-Rom sobre una tabla de 11 valores (0 %, 10 %, … 100 %; el último = el primero)
function per(tab, t) {
  const n = tab.length - 1, x = (((t % 1) + 1) % 1) * n, i = Math.floor(x), u = x - i, p = k => tab[((k % n) + n) % n];
  const p0 = p(i - 1), p1 = p(i), p2 = p(i + 1), p3 = p(i + 2);
  return 0.5 * (2 * p1 + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u * u + (-p0 + 3 * p1 - 3 * p2 + p3) * u * u * u);
}
const curve = (N, fn) => { const tr = []; for (let i = 0; i <= N; i++) { const t = i / N, v = fn(t); tr.push([t, v[0] || 0, v[1] || 0, v[2] || 0]); } return tr; };
const TAU = Math.PI * 2, cos1 = t => Math.cos(TAU * t), sin1 = t => Math.sin(TAU * t);
// suma una capa f(t) → [rx, ry, rz] a la pista de una parte (remuestrea la pista original con la misma interpolación del horneado)
function addLayer(clip, part, fn, N) {
  N = N || 48; const tr = clip.tracks[part], b = [0, 0, 0], loop = clip.loop !== false, old = _loopCur; _loopCur = loop;
  clip.tracks[part] = curve(N, t => { sampleTrack(tr, t, b, 3); const v = fn(t); return [b[0] + (v[0] || 0), b[1] + (v[1] || 0), b[2] + (v[2] || 0)]; });
  _loopCur = old;
}
// cinemática directa del clip: punto local de una parte → mundo (sin raíz)
const _fkOut = new Float32Array(MAXP * 16);
function fkPoints(rig, clip, t, pts) {
  const tmp = '__fk', saveRoot = clip.root; CLIPS[rig][tmp] = Object.assign({}, clip, {root: null});
  poseTroop(rig, tmp, t, _fkOut); delete CLIPS[rig][tmp]; clip.root = saveRoot;
  const idx = rigIndex(rig);
  return pts.map(([part, p]) => { const o = idx[part] * 16, m = _fkOut; return [m[o] * p[0] + m[o + 4] * p[1] + m[o + 8] * p[2] + m[o + 12], m[o + 1] * p[0] + m[o + 5] * p[1] + m[o + 9] * p[2] + m[o + 13], m[o + 2] * p[0] + m[o + 6] * p[1] + m[o + 10] * p[2] + m[o + 14]]; });
}
// raíz apoyada: y = −(punto de contacto más bajo); en los tramos de suspensión (stance(t) = false) se interpola y se añade un vuelo parabólico
function groundRoot(rig, clip, contacts, N, o) {
  o = o || {}; const ys = [];
  for (let i = 0; i <= N; i++) { const t = i / N, P = fkPoints(rig, clip, t, contacts); ys.push(-Math.min(...P.map(q => q[1]))); }
  if (o.stance) {                                                     // tramos en el aire
    const air = ys.map((_, i) => !o.stance(i / N));
    for (let i = 0; i <= N; i++) if (air[i]) {
      let a = i, b = i; while (a > 0 && air[a]) a--; while (b < N && air[b]) b++;
      const u = (i - a) / Math.max(1, b - a); ys[i] = ys[a] + (ys[b] - ys[a]) * u + (o.lift || 0.04) * 4 * u * (1 - u);
    }
  }
  const base = o.base || 0, sx = o.sway || (() => 0);
  return ys.map((y, i) => [i / N, sx(i / N), y + base, 0]);
}

/* ---------- humano ---------- */
const GAIT = {
  marcha: {hip: [30, 26, 18, 10, 2, -6, -10, -2, 14, 26, 30], knee: [4, 16, 14, 8, 5, 10, 36, 58, 44, 14, 4], ank: [0, -5, 2, 6, 9, 8, -14, -8, 0, 2, 0], stance: 0.6},
  carrera: {hip: [35, 28, 16, 4, -8, -6, 14, 34, 46, 44, 35], knee: [22, 40, 36, 26, 22, 50, 88, 98, 70, 36, 22], ank: [4, 16, 18, 4, -22, -20, -6, 2, 6, 6, 4], stance: 0.38}
};
const FOOT = side => [['pie' + side, [0, -0.081, -0.065]], ['pie' + side, [0, -0.081, 0.175]], ['pie' + side, [0, -0.081, 0.06]]];
// legs(clip, tipo, o): sustituye piernas, pelvis y raíz; o.amp (escala), o.lean (inclinación del tronco), o.armSwing (brazo izquierdo libre, grados),
// o.armR (también el derecho), o.shoulder (contrarrotación de hombros), o.keepTorso (no tocar el torso)
function humanLocomotion(clip, kind, o) {
  o = o || {}; const G = GAIT[kind], A = o.amp || 1, N = 40, run = kind === 'carrera';
  const leg = (side, ph) => {
    clip.tracks['muslo' + side] = curve(N, t => [-per(G.hip, t + ph) * A + (o.hipOff || 0), 0, (side === 'Iz' ? 1 : -1) * (run ? 1 : 2)]);
    clip.tracks['pierna' + side] = curve(N, t => [per(G.knee, t + ph) * (0.6 + 0.4 * A) + (o.kneeOff || 0)]);
    clip.tracks['pie' + side] = curve(N, t => [-per(G.ank, t + ph) * Math.min(1.2, A)]);
  };
  leg('Iz', 0); leg('De', 0.5);
  const yaw = (run ? 7 : 5) * A, roll = (run ? 2 : 3);
  clip.tracks.pelvis = curve(N, t => [o.pelvisPitch || 0, -yaw * cos1(t), roll * sin1(t)]);
  if (!o.keepTorso) {
    const sh = o.shoulder != null ? o.shoulder : 4, base = clip.tracks.torso, b = [0, 0, 0];
    clip.tracks.torso = curve(N, t => { sampleTrack(base, t, b, 3); return [(o.lean || 3) + b[0] + (run ? 2.5 : 1) * Math.cos(2 * TAU * t + 0.6), b[1] + (yaw + sh) * cos1(t), b[2] - roll * 0.7 * sin1(t)]; });
  }
  const hb = clip.tracks.cabeza, h = [0, 0, 0];
  clip.tracks.cabeza = curve(N, t => { sampleTrack(hb, t, h, 3); return [h[0] - (o.lean || 3) * 0.6 - (run ? 1.5 : 0.6) * Math.cos(2 * TAU * t + 0.6), h[1] - (o.shoulder != null ? o.shoulder : 4) * 0.5 * cos1(t), h[2] + roll * 0.4 * sin1(t)]; });
  if (o.armSwing) {
    const s = o.armSwing, lag = 0.06;
    clip.tracks.brazoIz = curve(N, t => [s * cos1(t - lag), 0, 6 + 2 * sin1(t)]);
    clip.tracks.antebrazoIz = curve(N, t => [-(run ? 70 : 12) - (run ? 25 : 14) * (1 - cos1(t - lag)) / 2]);
    if (o.armR) { clip.tracks.brazoDe = curve(N, t => [-s * cos1(t - lag), 0, -6 - 2 * sin1(t)]); clip.tracks.antebrazoDe = curve(N, t => [-(run ? 70 : 12) - (run ? 25 : 14) * (1 + cos1(t - lag)) / 2]); }
  }
  clip.root = groundRoot('soldado', clip, FOOT('Iz').concat(FOOT('De')), N, {
    sway: t => (run ? 0.012 : 0.02) * sin1(t),
    stance: run ? (t => { const a = t % 1, b = (t + 0.5) % 1; return a <= G.stance + 0.01 || b <= G.stance + 0.01; }) : null, lift: 0.05});
  clip.ev = [[0, 'paso'], [0.5, 'paso']];
  return clip;
}
// respiración y micro-movimientos para clips en pie (n respiraciones por bucle)
function breathe(clip, amp) {
  const n = Math.max(1, Math.round(clip.dur / 3.6)), a = amp || 1;
  addLayer(clip, 'torso', t => [-1.1 * a * Math.sin(TAU * n * t), 0, 0]);
  addLayer(clip, 'cabeza', t => [0.7 * a * Math.sin(TAU * n * t - 0.4), 0.8 * a * Math.sin(TAU * t + 1.3), 0]);
  if (clip.tracks.brazoIz || !clip.tracks.armaP) addLayer(clip, 'brazoIz', t => [0.8 * a * Math.sin(TAU * n * t - 0.8), 0, 0.6 * a * Math.sin(TAU * n * t)]);
}
// reparto del peso en reposo: la pelvis bascula hacia la pierna de apoyo y la otra rodilla se relaja
function weightShift(clip) {
  addLayer(clip, 'pelvis', t => [0, 1.5 * Math.sin(TAU * t + 0.5), 2.2 * Math.sin(TAU * t)]);
  addLayer(clip, 'musloIz', t => [-1.5 * Math.max(0, -Math.sin(TAU * t)), 0, -2 * Math.sin(TAU * t)]);
  addLayer(clip, 'musloDe', t => [-1.5 * Math.max(0, Math.sin(TAU * t)), 0, -2 * Math.sin(TAU * t)]);
  addLayer(clip, 'piernaIz', t => [3 * Math.max(0, -Math.sin(TAU * t))]); addLayer(clip, 'piernaDe', t => [3 * Math.max(0, Math.sin(TAU * t))]);
  addLayer(clip, 'torso', t => [0, 0, -1.6 * Math.sin(TAU * t)]);
  addLayer(clip, 'cabeza', t => [0, 0, 0.8 * Math.sin(TAU * t)]);
  clip.root = curve(24, t => [0.018 * Math.sin(TAU * t), -0.003 * Math.abs(Math.sin(TAU * t)), 0]);
}
(function soldierV4() {
  const S = CLIPS.soldado;
  // marcha al hombro: brazo izquierdo braceando, fusil al hombro (IK de siempre)
  humanLocomotion(S.marcha, 'marcha', {amp: 0.85, lean: 2, armSwing: 16, shoulder: 2});
  humanLocomotion(S.marcha_rapida, 'marcha', {amp: 1.05, lean: 4, armSwing: 22, shoulder: 3});
  humanLocomotion(S.marcha_atado, 'marcha', {amp: 0.7, lean: 8, keepTorso: false, shoulder: 0});
  humanLocomotion(S.cargar_bayoneta, 'carrera', {amp: 0.9, lean: 3, shoulder: 0, pelvisPitch: 4});
  humanLocomotion(S.huir, 'carrera', {amp: 1.0, lean: 3, armSwing: 38, armR: !S.huir.tracks.armaP, shoulder: 6, pelvisPitch: 5});
  if (S.avance_agachado) humanLocomotion(S.avance_agachado, 'marcha', {amp: 0.8, lean: 28, hipOff: -32, kneeOff: 30, shoulder: 0, pelvisPitch: 8});
  ['camilla_delante', 'camilla_detras'].forEach(k => S[k] && humanLocomotion(S[k], 'marcha', {amp: 0.7, lean: 3, shoulder: 0}));
  // reposo y clips estáticos en bucle: respiración; los de pie además reparten el peso
  ['idle', 'idle_oficial', 'ordenar', 'observar_catalejo', 'ondear', 'saludar', 'saludar_espada', 'rendirse', 'manos_arriba', 'cuadro'].forEach(k => { if (!S[k]) return; breathe(S[k], 1); });
  ['idle', 'idle_oficial', 'observar_catalejo'].forEach(k => S[k] && weightShift(S[k]));
  Object.keys(S).forEach(k => { const c = S[k]; if (c.loop === false || /marcha|huir|cargar|avance|camilla|idle|ordenar|catalejo|ondear|saludar|rendirse|manos|cuadro|paracaidas|cavar|melee|cuerpo/.test(k)) return; breathe(c, 0.6); });
  // muertes: los pies se relajan (flexión plantar) al quedar tendido; impacto con temblor breve del tronco
  ['caer_muerto_atras', 'caer_muerto_adelante', 'caer_muerto_costado', 'caer_muerto_rodillas', 'morir_1', 'morir_2', 'srv_caido', 'caer_con_estandarte'].forEach(k => {
    const c = S[k]; if (!c) return;
    const boca = /adelante|morir_2|estandarte/.test(k), pf = boca ? 62 : 14, ev = boca ? 6 : 28;   // boca abajo: empeine al suelo; boca arriba: los pies caen hacia fuera
    c.tracks.pieIz = [[0, 0, 0, 0], [0.55, 6, 0, 0], [0.82, pf * 0.9, 0, ev * 0.8], [1, pf, 0, ev]]; c.tracks.pieDe = [[0, 0, 0, 0], [0.6, 8, 0, 0], [0.86, pf * 0.8, 0, -ev * 0.8], [1, pf * 0.95, 0, -ev]];
    addLayer(c, 'torso', t => { const u = t / 0.12; return t < 0.12 ? [-6 * Math.sin(Math.PI * u), 3 * Math.sin(Math.PI * u), 0] : [0, 0, 0]; }, 60);
    addLayer(c, 'cabeza', t => { const u = (t - 0.04) / 0.16; return u > 0 && u < 1 ? [-10 * Math.sin(Math.PI * u), 0, 4 * Math.sin(Math.PI * u)] : t > 0.72 && t < 0.86 ? [6 * Math.sin(Math.PI * (t - 0.72) / 0.14), 0, 0] : [0, 0, 0]; }, 60);   // latigazo y rebote al tocar el suelo
  });
  // de rodillas / cuerpo a tierra: el pie trasero apoya la punta, los tumbados con el empeine en el suelo
  Object.keys(S).forEach(k => { const c = S[k], mD = c.tracks.musloDe, pD = c.tracks.piernaDe;
    if (/tumba|tumbado/.test(k)) { c.tracks.pieIz = c.tracks.pieIz || [[0, 55, 0, 0]]; c.tracks.pieDe = c.tracks.pieDe || [[0, 55, 0, 0]]; }
    else if (mD && pD && pD.length === 1 && pD[0][1] > 80 && !c.tracks.pieDe) c.tracks.pieDe = [[0, 72, 0, 0]];
  });
})();

/* ---------- caballo ---------- */
// patas: [superior, inferior, desfase (fracción del ciclo en que el casco toca el suelo), delantera?]
const HLEGS = {LF: ['manoIz', 'canaIz', true], RF: ['manoDe', 'canaDe', true], LH: ['pataIz', 'corvIz', false], RH: ['pataDe', 'corvDe', false]};
const HOOF = {LF: ['canaIz', [0, -0.575, 0.05]], RF: ['canaDe', [0, -0.575, 0.05]], LH: ['corvIz', [0, -0.615, 0.04]], RH: ['corvDe', [0, -0.615, 0.04]]};
const AIRES = {   // fase de contacto de cada casco, apoyo (duty), amplitud de la pata (°), flexión de rodilla/corvejón (°)
  paso: {LH: 0, LF: 0.25, RH: 0.5, RF: 0.75, duty: 0.64, A: 15, Ff: 52, Fh: 40, pitch: 1.2, neck: 6, heave: 0},
  trote: {LF: 0, RH: 0, RF: 0.5, LH: 0.5, duty: 0.42, A: 21, Ff: 80, Fh: 55, pitch: 1.5, neck: 2, heave: 0.05},
  galope: {RH: 0, LH: 0.12, RF: 0.36, LF: 0.48, duty: 0.3, A: 30, Ff: 110, Fh: 70, pitch: 5, neck: 9, heave: 0.1},
  galope_largo: {RH: 0, LH: 0.11, RF: 0.33, LF: 0.44, duty: 0.27, A: 34, Ff: 115, Fh: 75, pitch: 5.5, neck: 10, heave: 0.13}
};
function horseLegs(tr, legs, cfg, N, lowerOK) {
  Object.keys(legs).forEach(k => {
    const [up, low, fore] = legs[k], ph = cfg[k], d = cfg.duty, A = cfg.A;
    const ang = t => { const s = (((t - ph) % 1) + 1) % 1;
      if (s < d) { const u = s / d; return {u: A * (-1 + 2 * u), l: fore ? -6 * Math.sin(Math.PI * u) * (u > 0.85 ? -2 : 1) : 8 * Math.sin(Math.PI * u), sw: 0}; }   // apoyo: la pata retrocede bajo el cuerpo
      const u = (s - d) / (1 - d), e = u * u * (3 - 2 * u), lift = Math.pow(Math.sin(Math.PI * Math.min(1, u * 1.15)), 1.3);
      return {u: A * (1 - 2 * e) - (fore ? 8 : 4) * Math.sin(Math.PI * u), l: fore ? cfg.Ff * lift : -cfg.Fh * lift, sw: 1};       // vuelo: la rodilla se dobla y la pata se adelanta
    };
    tr[up] = curve(N, t => [ang(t).u + (fore ? 0 : 4), 0, 0]);
    if (lowerOK && low) tr[low] = curve(N, t => [ang(t).l, 0, 0]);
    else if (!lowerOK) tr[up] = curve(N, t => { const a = ang(t); return [a.u + (fore ? 0.25 : -0.2) * a.l * 0.35, 0, 0]; });   // tiro: pata de una pieza
  });
}
function inStance(cfg, t) { return ['LF', 'RF', 'LH', 'RH'].some(k => ((((t - cfg[k]) % 1) + 1) % 1) < cfg.duty); }
function horseGait(clip, aire, o) {
  o = o || {}; const cfg = AIRES[aire], N = 48, tr = clip.tracks, isG = aire.startsWith('galope');
  horseLegs(tr, HLEGS, cfg, N, true);
  // cuerpo: cabeceo (el tercio anterior sube durante el apoyo de los posteriores), cuello y cabeza en contrafase, cola con retraso
  const fl = cfg.LF;
  tr.caballo = curve(N, t => [isG ? -cfg.pitch * Math.cos(TAU * (t - 0.2)) : cfg.pitch * Math.cos(2 * TAU * (t - fl)), 0, aire === 'paso' ? 1.2 * Math.sin(TAU * t) : 0]);
  tr.cuello = curve(N, t => [isG ? cfg.neck * Math.cos(TAU * (t - 0.35)) - 4 : cfg.neck * Math.cos(2 * TAU * (t - fl)) + (aire === 'trote' ? -4 : 0), aire === 'paso' ? 2 * Math.sin(TAU * t) : 0, 0]);
  tr.testa = curve(N, t => [isG ? -0.5 * cfg.neck * Math.cos(TAU * (t - 0.42)) - 6 : -0.4 * cfg.neck * Math.cos(2 * TAU * (t - fl - 0.06)), 0, 0]);
  tr.cola = curve(N, t => [isG ? 34 + 8 * Math.cos(TAU * (t - 0.5)) : aire === 'trote' ? 14 + 4 * Math.cos(2 * TAU * t) : 6, 0, (isG ? 3 : 7) * Math.sin(TAU * (t - 0.15))]);
  // jinete: absorbe el cabeceo con la cintura y lleva la mano de las riendas con la boca del caballo
  const lean = o.lean != null ? o.lean : isG ? 14 : aire === 'trote' ? 6 : 3, tb = tr.torso, b = [0, 0, 0];
  tr.torso = curve(N, t => { if (o.keepRider) { sampleTrack(tb, t, b, 3); } else { b[0] = lean; b[1] = 0; b[2] = 0; }
    const p = isG ? -cfg.pitch * Math.cos(TAU * (t - 0.28)) : cfg.pitch * Math.cos(2 * TAU * (t - fl - 0.08));
    return [b[0] - 0.7 * p + (aire === 'trote' ? 2 * Math.cos(2 * TAU * (t - 0.1)) : 0), b[1], b[2]]; });
  tr.cabeza = curve(N, t => [isG ? 3 * Math.cos(TAU * (t - 0.3)) - lean * 0.5 : -lean * 0.3, 0, 0]);
  if (!o.keepReins) { tr.brazoIz = curve(N, t => [-28 - (isG ? 6 * Math.cos(TAU * (t - 0.4)) : 0), 0, 6]); tr.antebrazoIz = curve(N, t => [-52 - (isG ? 10 * Math.cos(TAU * (t - 0.4)) : 0), 0, -8]); }
  clip.root = groundRoot('jinete', clip, Object.values(HOOF), N, {stance: t => inStance(cfg, t), lift: cfg.heave});
  if (aire === 'trote') clip.pos = Object.assign(clip.pos || {}, {torso: curve(N, t => [0, -0.025 * Math.max(0, Math.cos(2 * TAU * (t - 0.12))), 0])});   // trote sentado: el jinete acompaña el rebote
  clip.ev = ['LF', 'RF', 'LH', 'RH'].map(k => [cfg[k], 'casco']).filter((e, i, a) => a.findIndex(q => Math.abs(q[0] - e[0]) < 0.02) === i).sort((a, b) => a[0] - b[0]);
}
(function horseV4() {
  const J = CLIPS.jinete;
  horseGait(J.paso, 'paso', {keepRider: true}); horseGait(J.trote, 'trote', {keepRider: true});
  ['galope', 'carga', 'carga_lanza', 'galope_de_mando', 'huida'].forEach(k => J[k] && horseGait(J[k], 'galope', {keepRider: true, keepReins: !!(J[k].tracks.brazoIz && k !== 'galope')}));
  if (J.galope_largo) horseGait(J.galope_largo, 'galope_largo', {keepRider: true, keepReins: !!J.galope_largo.tracks.brazoIz});
  // reposo: cambia el peso de una mano a otra, baja y sube la cabeza, menea la cola, pisotea una vez y respira
  const I = J.idle, n = 1;
  I.tracks.cuello = [[0, 0, 0, 0], [0.18, 14, -6, 0], [0.4, 18, -8, 0], [0.55, 4, 0, 0], [0.7, -6, 8, 0], [0.85, -2, 4, 0], [1, 0, 0, 0]];
  I.tracks.testa = [[0, 0, 0, 0], [0.2, 8, 0, 0], [0.42, 10, 0, 4], [0.56, -4, 0, 0], [0.62, 6, 0, -6], [0.68, -2, 0, 0], [1, 0, 0, 0]];   // sacudida de cabeza
  I.tracks.cola = [[0, 6, 0, 0], [0.3, 8, 0, 0], [0.34, 12, 0, 22], [0.38, 10, 0, -18], [0.43, 8, 0, 10], [0.5, 6, 0, 0], [0.9, 7, 0, -4], [1, 6, 0, 0]];
  I.tracks.manoDe = [[0, 0, 0, 0], [0.74, 0, 0, 0], [0.78, -18, 0, 0], [0.82, 6, 0, 0], [0.86, 0, 0, 0], [1, 0, 0, 0]]; I.tracks.canaDe = [[0, 0, 0, 0], [0.74, 0, 0, 0], [0.78, 60, 0, 0], [0.82, 4, 0, 0], [0.86, 0, 0, 0], [1, 0, 0, 0]];   // pisotón
  I.tracks.pataIz = [[0, 0, 0, 0], [0.45, 0, 0, 0], [0.55, -6, 0, 0], [0.9, -6, 0, 0], [1, 0, 0, 0]]; I.tracks.corvIz = [[0, 0, 0, 0], [0.45, 0, 0, 0], [0.55, -18, 0, 0], [0.9, -18, 0, 0], [1, 0, 0, 0]];   // descansa un posterior
  I.tracks.caballo = curve(24, t => [0.6 * Math.sin(TAU * 3 * t), 0, 1.2 * Math.sin(TAU * t) + (t > 0.45 && t < 0.9 ? 1 : 0)]);
  void n; I.ev = [[0.82, 'casco']];
  I.root = groundRoot('jinete', I, Object.values(HOOF), 40);
  // pose de las riendas (brazo y antebrazo izquierdos) en todos los clips que no la definen
  Object.keys(J).forEach(k => { const c = J[k]; if (!c.tracks.brazoIz) c.tracks.brazoIz = [[0, -28, 0, 6]]; if (!c.tracks.antebrazoIz) c.tracks.antebrazoIz = [[0, -52, 0, -8]];
    if (c.loop !== false && !/galope|carga|huida|trote|paso/.test(k)) breathe(c, 0.7); });
})();
(function teamV4() {
  const Tc = CLIPS.tiro, L = k => ({LF: ['an' + k + 'mi', null, true], RF: ['an' + k + 'md', null, true], LH: ['an' + k + 'pi', null, false], RH: ['an' + k + 'pd', null, false]});
  [['paso', 'paso'], ['trote', 'trote']].forEach(([name, aire]) => {
    const c = Tc[name]; if (!c) return; const cfg = Object.assign({}, AIRES[aire], {A: AIRES[aire].A * 0.9});
    [1, 2].forEach(k => { const c2 = Object.assign({}, cfg); if (k === 2) ['LF', 'RF', 'LH', 'RH'].forEach(q => { c2[q] = (cfg[q] + 0.37) % 1; });   // los dos animales no pisan a la vez
      const tr = {}; horseLegs(tr, L(k), c2, 48, false); Object.assign(c.tracks, tr);
      c.tracks['an' + k + 'cu'] = curve(48, t => [cfg.neck * Math.cos(2 * TAU * (t - c2.LF)) + (aire === 'trote' ? -3 : 0), 0, 0]);
      c.tracks['an' + k + 'te'] = curve(48, t => [-0.4 * cfg.neck * Math.cos(2 * TAU * (t - c2.LF - 0.06)), 0, 0]);
      c.tracks['an' + k] = curve(48, t => [cfg.pitch * Math.cos(2 * TAU * (t - c2.LF)), 0, aire === 'paso' ? Math.sin(TAU * (t - c2.LF)) : 0]); });
  });
  if (Tc.parado) { const c = Tc.parado;
    c.tracks.an1cu = [[0, 0, 0, 0], [0.3, 12, -5, 0], [0.5, 14, -5, 0], [0.7, 2, 4, 0], [1, 0, 0, 0]]; c.tracks.an2cu = [[0, 4, 0, 0], [0.4, -4, 6, 0], [0.6, 0, 3, 0], [0.85, 10, 0, 0], [1, 4, 0, 0]];
    c.tracks.an1te = [[0, 0, 0, 0], [0.55, 0, 0, 0], [0.6, 8, 0, 5], [0.66, -3, 0, -3], [0.7, 0, 0, 0], [1, 0, 0, 0]]; c.tracks.an2te = [[0, 0, 0, 0], [0.2, 6, 0, 0], [0.5, 0, 0, 0], [1, 0, 0, 0]]; }
})();
(function artilleryV4() {
  const K = CLIPS.canon;
  // retroceso de la pieza lisa: las ruedas giran lo que recorre la cureña (0,45 m / r 0,66 m ≈ 39°), la contera salta y vuelve; los sirvientes la devuelven a batería
  const S = K.servicio; if (S) {
    S.root = [[0, 0, 0, 0], [0.61, 0, 0, 0], [0.625, 0, 0.06, -0.2], [0.65, 0, 0.0, -0.42], [0.67, 0, 0.01, -0.45], [0.8, 0, 0, -0.45], [0.95, 0, 0, 0], [1, 0, 0, 0]];
    S.tracks.ruedaIz = S.tracks.ruedaDe = [[0, 0, 0, 0], [0.61, 0, 0, 0], [0.65, -36, 0, 0], [0.67, -39, 0, 0], [0.8, -39, 0, 0], [0.95, 0, 0, 0], [1, 0, 0, 0]];
    S.tracks['cureña'] = [[0, 0, 0, 0], [0.61, 0, 0, 0], [0.625, -5, 0, 0], [0.645, 1.5, 0, 0], [0.665, -0.6, 0, 0], [0.69, 0, 0, 0], [1, 0, 0, 0]];
  }
  [['servicio_rc', 0.61], ['servicio_D', 0.61]].forEach(([k, t0]) => { const c = K[k]; if (!c) return;          // cureña rígida (C) o freno de retroceso (D): solo un estremecimiento
    c.tracks['cureña'] = [[0, 0, 0, 0], [t0, 0, 0, 0], [t0 + 0.012, k === 'servicio_D' ? -1 : -3, 0, 0], [t0 + 0.03, 0.8, 0, 0], [t0 + 0.05, 0, 0, 0], [1, 0, 0, 0]];
    c.root = [[0, 0, 0, 0], [t0, 0, 0, 0], [t0 + 0.015, 0, 0.02, k === 'servicio_D' ? -0.02 : -0.12], [t0 + 0.06, 0, 0, k === 'servicio_D' ? -0.02 : -0.12], [0.9, 0, 0, 0], [1, 0, 0, 0]];
    if (k === 'servicio_rc') c.tracks.ruedaIz = c.tracks.ruedaDe = [[0, 0, 0, 0], [t0, 0, 0, 0], [t0 + 0.015, -10, 0, 0], [0.9, 0, 0, 0], [1, 0, 0, 0]]; });
  if (K.servicio_at) K.servicio_at.tracks.ruedaIz = K.servicio_at.tracks.ruedaDe = [[0, 0, 0, 0], [0.44, 0, 0, 0], [0.48, -6, 0, 0], [0.7, 0, 0, 0], [1, 0, 0, 0]];
  if (K.fuego_mg) addLayer(K.fuego_mg, 'tubo', t => [-0.5 * Math.abs(Math.sin(TAU * 4 * t)), 0.4 * Math.sin(TAU * 2 * t), 0], 32);   // vibración del arma sobre el giro del haz
})();
// Maxim / Vickers (D): el arma no gira; retrocede el cajón con cada disparo y el trípode vibra (antes heredaba el giro del haz de la Gatling)
CLIPS.canon.fuego_maxim = mk(0.5, true, {tubo: curve(32, t => [-0.7 * Math.pow(Math.abs(Math.sin(TAU * 4 * t)), 3), 0.5 * Math.sin(TAU * 2 * t), 0]), 'cureña': curve(16, t => [0.25 * Math.sin(TAU * 4 * t), 0, 0])},
  [[0, 'disparo'], [0.25, 'disparo'], [0.5, 'disparo'], [0.75, 'disparo']], {slide: curve(32, t => [-0.012 * Math.pow(Math.abs(Math.sin(TAU * 4 * t)), 4)]).map(k => [k[0], k[1]])});
