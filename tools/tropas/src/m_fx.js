
/* ================= v5: efectos de combate (datos + emisores baratos) =================
   Sin texturas ni modelos: cada emisor devuelve partículas {p, v, vida, tam, crece, color, alfa, grav, arrastre, tipo} que el juego dibuja con su
   sistema de puntos de textura suave (b3Push en batalla3d.js). Estilizado: polvo, astillas y una nube rojiza muy breve en el soldado, sin gore.
   Pólvora negra (A–C hasta 1886 aprox.): nube blanca densa y persistente; pólvora sin humo (Lebel 1886 en adelante, C tardía, D y E): solo bruma. */
const TROOP_FX = {
  fogonazo: {A: {tam: 0.55, vida: 0.07, color: '#ffd38a', luz: 2.2}, B: {tam: 0.5, vida: 0.06, color: '#ffd890', luz: 2.0}, C: {tam: 0.35, vida: 0.05, color: '#ffe2a8', luz: 1.4},
    D: {tam: 0.3, vida: 0.04, color: '#fff0c8', luz: 1.2}, E: {tam: 0.28, vida: 0.035, color: '#fff2d0', luz: 1.1}},
  humo: {A: {n: 14, tam: 0.35, crece: 1.6, vida: 6.5, alfa: 0.75, color: '#eeece6', deriva: 0.25, cazoleta: true}, B: {n: 12, tam: 0.32, crece: 1.5, vida: 5.5, alfa: 0.7, color: '#ecebe4', deriva: 0.25},
    C: {n: 6, tam: 0.25, crece: 1.2, vida: 3.0, alfa: 0.4, color: '#e6e6e0', deriva: 0.3}, D: {n: 2, tam: 0.15, crece: 0.8, vida: 0.9, alfa: 0.18, color: '#dcdcd8', deriva: 0.35}, E: {n: 2, tam: 0.12, crece: 0.8, vida: 0.8, alfa: 0.15, color: '#dcdcd8', deriva: 0.35}},
  expulsion: {A: {tipo: 'taco', color: '#d8ccb0', n: 1, vel: 6}, B: {tipo: 'taco', color: '#d8ccb0', n: 1, vel: 5}, C: {tipo: 'casquillo', color: '#c8a24a', n: 1, vel: 2.2},
    D: {tipo: 'casquillo', color: '#c8a24a', n: 1, vel: 2.4}, E: {tipo: 'casquillo', color: '#c8a24a', n: 1, vel: 2.6}},
  trazadora: {D: {color: '#ffb060', largo: 1.6, vel: 700, cada: 5, vida: 1.2}, E: {color: '#ff9a50', largo: 2.0, vel: 750, cada: 5, vida: 1.4}},
  impacto: {tierra: {n: 10, color: '#6a5a40', vel: 3.5, tam: 0.12, vida: 0.9, grav: 9, polvo: '#8a7a5a'}, madera: {n: 8, color: '#a07a4a', vel: 4, tam: 0.05, vida: 0.7, grav: 9, polvo: '#c0a070', astillas: true},
    muro: {n: 9, color: '#9a948a', vel: 3, tam: 0.07, vida: 0.8, grav: 9, polvo: '#c8c2b8'}, soldado: {n: 5, color: '#8a2a20', vel: 1.2, tam: 0.09, vida: 0.35, grav: 2, polvo: '#7a6a58'},
    agua: {n: 10, color: '#d8e4ea', vel: 3, tam: 0.1, vida: 0.6, grav: 9, polvo: '#e8eef0'}},
  // efectos de cámara del viewmodel al ser herido (el juego los dibuja): curvas [t (s), valor]
  camara: {herido_leve: {vineta: [[0, 0], [0.05, 0.45], [0.6, 0.25], [2.5, 0]], desenfoque: [[0, 0], [0.05, 0.3], [1.0, 0]], pitido: {vol: [[0, 0], [0.05, 0.25], [1.5, 0]], hz: 4200}, color: '#7a0a0a'},
    herido_grave: {vineta: [[0, 0], [0.05, 0.8], [1.5, 0.6], [6, 0.4]], desenfoque: [[0, 0], [0.05, 0.7], [2.0, 0.35], [6, 0.2]], pitido: {vol: [[0, 0], [0.05, 0.6], [3.0, 0.25], [6, 0]], hz: 3800}, color: '#6a0606', pulso: 1.1},
    explosion: {vineta: [[0, 0], [0.05, 0.3], [1.5, 0]], desenfoque: [[0, 0], [0.05, 0.9], [2.5, 0]], pitido: {vol: [[0, 0], [0.05, 1.0], [5.0, 0]], hz: 3500}, temblor: [[0, 0], [0.05, 1], [0.8, 0]], color: '#2a2018'},
    muerte: {vineta: [[0, 0], [0.3, 0.7], [1.8, 1.0]], desenfoque: [[0, 0], [1.0, 0.8], [1.8, 1.0]], pitido: {vol: [[0, 0], [0.2, 0.5], [1.8, 0]], hz: 3600}, color: '#200404', fundido: [[0, 0], [1.2, 0], [2.2, 1]]}}
};
function fxCurve(c, t) { if (!c) return 0; if (t <= c[0][0]) return c[0][1]; for (let i = 0; i < c.length - 1; i++) if (t <= c[i + 1][0]) { const u = (t - c[i][0]) / (c[i + 1][0] - c[i][0]); return c[i][1] + (c[i + 1][1] - c[i][1]) * u; } return c[c.length - 1][1]; }
// semilla determinista para que dos disparos seguidos no sean idénticos pero el resultado sea reproducible
function _fxRnd(seed) { let s = (seed * 9301 + 49297) % 233280; return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; }; }
// troopFxDisparo(era, boca (Vector3 o [x,y,z]), dirección, {semilla, viento:[x,z], lateral: Vector3 (derecha del arma)}) → partículas
function troopFxDisparo(era, boca, dir, o) {
  o = o || {}; const r = _fxRnd(o.semilla || 1), P = [], b = Array.isArray(boca) ? boca : [boca.x, boca.y, boca.z], d = Array.isArray(dir) ? dir : [dir.x, dir.y, dir.z];
  const F = TROOP_FX.fogonazo[era] || TROOP_FX.fogonazo.D, H = TROOP_FX.humo[era] || TROOP_FX.humo.D, w = o.viento || [0.4, 0.1];
  P.push({tipo: 'fogonazo', p: b.slice(), v: [0, 0, 0], vida: F.vida, tam: F.tam, crece: 0.4, color: F.color, alfa: 1, grav: 0, arrastre: 0, luz: F.luz});
  for (let i = 0; i < H.n; i++) { const k = 0.3 + r() * 1.7, sp = 0.15 + r() * 0.3;
    P.push({tipo: 'humo', p: [b[0] + d[0] * 0.1 * i / H.n, b[1] + d[1] * 0.1 * i / H.n, b[2] + d[2] * 0.1 * i / H.n], v: [d[0] * k + (r() - 0.5) * sp + w[0] * H.deriva, d[1] * k + 0.15 + r() * 0.2, d[2] * k + (r() - 0.5) * sp + w[1] * H.deriva],
      vida: H.vida * (0.7 + r() * 0.6), tam: H.tam * (0.7 + r() * 0.6), crece: H.crece, color: H.color, alfa: H.alfa * (0.6 + r() * 0.4), grav: -0.05, arrastre: 1.6}); }
  if (H.cazoleta && o.lateral) { const l = Array.isArray(o.lateral) ? o.lateral : [o.lateral.x, o.lateral.y, o.lateral.z];   // humo de la cazoleta junto a la cara (chispa)
    for (let i = 0; i < 3; i++) P.push({tipo: 'humo', p: [b[0] - d[0] * 1.0 + l[0] * 0.05, b[1] - d[1] * 1.0 + 0.05, b[2] - d[2] * 1.0 + l[2] * 0.05], v: [l[0] * 0.6 + (r() - 0.5) * 0.2, 0.5 + r() * 0.3, l[2] * 0.6 + (r() - 0.5) * 0.2], vida: 2.5, tam: 0.12, crece: 1.2, color: '#f0eee8', alfa: 0.7, grav: -0.1, arrastre: 2}); }
  return P;
}
// troopFxExpulsion(era, punto, derecha) → casquillo (C–E) o taco/papel (A–B)
function troopFxExpulsion(era, p, der, o) {
  o = o || {}; const r = _fxRnd(o.semilla || 3), E = TROOP_FX.expulsion[era] || TROOP_FX.expulsion.D, q = Array.isArray(p) ? p : [p.x, p.y, p.z], l = Array.isArray(der) ? der : [der.x, der.y, der.z];
  return [{tipo: E.tipo, p: q.slice(), v: [l[0] * E.vel + (r() - 0.5) * 0.4, 1.2 + r() * 0.6, l[2] * E.vel + (r() - 0.5) * 0.4], vida: E.tipo === 'taco' ? 1.2 : 2.0, tam: E.tipo === 'taco' ? 0.03 : 0.018, crece: 0, color: E.color, alfa: 1, grav: 9.8, arrastre: 0.2, gira: 20, rebota: E.tipo === 'casquillo'}];
}
// troopFxTrazadora(era, origen, destino) → segmento con estela corta (D–E); null en épocas sin trazadoras
function troopFxTrazadora(era, a, b) { const T = TROOP_FX.trazadora[era]; if (!T) return null; const A = Array.isArray(a) ? a : [a.x, a.y, a.z], B = Array.isArray(b) ? b : [b.x, b.y, b.z];
  const d = Math.hypot(B[0] - A[0], B[1] - A[1], B[2] - A[2]); return {tipo: 'trazadora', de: A, a: B, vel: T.vel, dur: d / T.vel, largo: T.largo, color: T.color, vida: Math.min(T.vida, d / T.vel)}; }
// troopFxImpacto(material: 'tierra' | 'madera' | 'muro' | 'soldado' | 'agua', punto, normal) → partículas
function troopFxImpacto(mat, p, n, o) {
  o = o || {}; const r = _fxRnd(o.semilla || 7), I = TROOP_FX.impacto[mat] || TROOP_FX.impacto.tierra, q = Array.isArray(p) ? p : [p.x, p.y, p.z], N = n ? (Array.isArray(n) ? n : [n.x, n.y, n.z]) : [0, 1, 0], P = [];
  for (let i = 0; i < I.n; i++) { const s = I.vel * (0.4 + r() * 0.8);
    P.push({tipo: I.astillas && i % 2 ? 'astilla' : 'trozo', p: q.slice(), v: [N[0] * s + (r() - 0.5) * s, N[1] * s + r() * s * 0.6, N[2] * s + (r() - 0.5) * s], vida: I.vida * (0.6 + r() * 0.6), tam: I.tam * (0.5 + r()), crece: 0, color: I.color, alfa: 1, grav: I.grav, arrastre: 0.6, gira: I.astillas ? 15 : 0}); }
  for (let i = 0; i < 3; i++) P.push({tipo: 'polvo', p: q.slice(), v: [N[0] * 0.6 + (r() - 0.5) * 0.5, N[1] * 0.6 + 0.2, N[2] * 0.6 + (r() - 0.5) * 0.5], vida: I.vida * 2, tam: I.tam * 2.5, crece: 1.4, color: I.polvo, alfa: mat === 'soldado' ? 0.45 : 0.6, grav: -0.05, arrastre: 2});
  return P;
}
// troopFxCamara(tipo, t) → {vineta, desenfoque, pitidoVol, pitidoHz, color, temblor, fundido}
function troopFxCamara(tipo, t) { const C = TROOP_FX.camara[tipo]; if (!C) return null;
  return {vineta: fxCurve(C.vineta, t) * (C.pulso ? 0.85 + 0.15 * Math.sin(t * Math.PI * 2 * C.pulso) : 1), desenfoque: fxCurve(C.desenfoque, t), pitidoVol: fxCurve(C.pitido && C.pitido.vol, t), pitidoHz: C.pitido ? C.pitido.hz : 0, color: C.color, temblor: fxCurve(C.temblor, t), fundido: fxCurve(C.fundido, t)}; }
