/* ===== pueblos3d.js — pueblos con plano real para la batalla 3D de Victoria (three.js r152, todo procedural) =====
   buildVillage(seed, bioma, era, tf, opts) traza un plano y construye el pueblo:
   1) calle principal curva + 2–4 transversales + plaza con iglesia y pozo;
   2) parcelas a ambos lados de cada calle, con las casas mirando a la calle (sin solaparse ni invadir calles);
   3) plataforma bajo cada edificio: si tf.aplanar existe (terreno3d) se allana el terreno; en todo caso el suelo del edificio queda
      sobre el punto más alto de su planta y el zócalo baja hasta por debajo del más bajo: nunca flota ni queda enterrado;
   4) tipos: casa baja, casa de dos plantas, granja con patio y granero, posada, molino, iglesia con campanario, mansión (+ pozo);
   5) tejados a dos y cuatro aguas, chimeneas, puertas y ventanas con marco, buhardillas, vallas, muros de piedra, huertos, tumbas;
   6) estilos por bioma (centroeuropeo de entramado, mediterráneo de teja y cal, ruso de madera, inglés de ladrillo, norte nevado)
      y por época (A 1836-60, B/C 1861-1913, D/E 1914-45 con daños de guerra: boquetes, tejados hundidos, ruinas y escombros);
   7) tres niveles de detalle (THREE.LOD a nivel de pueblo: 3 mallas fusionadas por material + instancias por nivel);
   8) devuelve colliders, cover (puntos de cobertura con tipo alta/baja y lados de asomo) y loopholes (ventanas y aspilleras).
   Unidades: u del campo (1 u ≈ 0,6 m; las medidas internas están en metros y se convierten con opts.uPorMetro).
   tf: {height(x,z)} y opcionalmente {aplanar(cx,cz,w,d,rot,margen,altura)} (terreno3d.crearTerreno lo cumple).
   API: planoPueblo(seed, bioma, era, opts) · buildVillage(seed, bioma, era, tf, opts) · ESTILOS · pruebaPueblos(tf) · demoPueblos(cont) */
(function (root) {
'use strict';
const THREE = root.THREE;
function rng(seed) { let a = (seed >>> 0) || 1; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const lerp = (a, b, t) => a + (b - a) * t;

/* ---------- estilos ---------- */
const ESTILOS = {
  centroeuropeo: {muro: 0xe6dcc6, viga: 0x4a3424, tejado: 0x9a4a32, paja: 0xa8925a, zocalo: 0x8a8478, marco: 0x5a4030, puerta: 0x5a3a24, postigo: null, pend: 50, vuelo: 0.45, entramado: 1},
  mediterraneo: {muro: 0xefe9dc, viga: 0x7a6a52, tejado: 0xb8623e, paja: 0xb8623e, zocalo: 0xa89c88, marco: 0xd8d0c0, puerta: 0x5a4030, postigo: [0x3a6a8a, 0x4a7a4a, 0x6a4a3a], pend: 22, vuelo: 0.3},
  ruso: {muro: 0x7a5a3e, viga: 0x5a4230, tejado: 0x6e6c64, paja: 0x9a8a5a, zocalo: 0x7a746a, marco: 0xe0d8c8, puerta: 0x4a3424, postigo: [0x4a6a9a, 0x5a8a6a], pend: 42, vuelo: 0.5, troncos: 1},
  ingles: {muro: 0x9a4a38, viga: 0x6a3a2a, tejado: 0x4a4e56, paja: 0xa8925a, zocalo: 0x7a7470, marco: 0xece8dc, puerta: 0x2a3a2a, postigo: null, pend: 40, vuelo: 0.3, esquinas: 0xd8d0c0},
  norte: {muro: 0x8a3428, viga: 0x5a2a20, tejado: 0x3a3a3a, paja: 0x3a3a3a, zocalo: 0x6a6a68, marco: 0xece8dc, puerta: 0x2a2a2a, postigo: null, pend: 45, vuelo: 0.4, nieve: 0xeef2f6, esquinas: 0xece8dc}};
const BIOMA_ESTILO = {templado: 'centroeuropeo', centroeuropeo: 'centroeuropeo', mediterraneo: 'mediterraneo', desierto: 'mediterraneo', estepa: 'ruso', boreal: 'ruso', ruso: 'ruso', ingles: 'ingles', atlantico: 'ingles', nevado: 'norte', norte: 'norte'};
const C = {piedra: 0x8a8478, piedraO: 0x6a665e, cristal: 0x1c2228, hueco: 0x16120e, madera: 0x7a5232, maderaO: 0x4e3420, hierro: 0x3a3c40, quemado: 0x2a2622, escombro: 0x8a8070, verde: 0x4a6a32, tierra: 0x6a5238, blanco: 0xeae6da, campana: 0x8a6a2a};

/* ---------- constructor de geometría con color por vértice ---------- */
const _c = new THREE.Color();
function Geo() { this.p = []; this.c = []; this.m = new THREE.Matrix4(); this.oscurece = 0; }
Geo.prototype.tri = function (a, b, c, col) {
  _c.setHex(col); if (this.oscurece) _c.lerp(new THREE.Color(C.quemado), this.oscurece);
  const e = this.m.elements;
  [a, b, c].forEach(q => { const x = q[0], y = q[1], z = q[2]; this.p.push(e[0] * x + e[4] * y + e[8] * z + e[12], e[1] * x + e[5] * y + e[9] * z + e[13], e[2] * x + e[6] * y + e[10] * z + e[14]); this.c.push(_c.r, _c.g, _c.b); });
};
Geo.prototype.quad = function (a, b, c, d, col) { this.tri(a, b, c, col); this.tri(a, c, d, col); };
// caja con centro de la base en (x, y, z); w (x) × h (y) × d (z); o.sinBase/o.sinTecho; o.ry giro local en radianes
Geo.prototype.caja = function (x, y, z, w, h, d, col, o) {
  o = o || {}; const cs = Math.cos(o.ry || 0), sn = Math.sin(o.ry || 0), P = (px, py, pz) => [x + px * cs + pz * sn, y + py, z - px * sn + pz * cs];
  const a = P(-w / 2, 0, d / 2), b = P(w / 2, 0, d / 2), c = P(w / 2, 0, -d / 2), e = P(-w / 2, 0, -d / 2), A = P(-w / 2, h, d / 2), B = P(w / 2, h, d / 2), Cc = P(w / 2, h, -d / 2), E = P(-w / 2, h, -d / 2);
  const ct = o.colTecho == null ? col : o.colTecho;
  this.quad(a, b, B, A, col); this.quad(b, c, Cc, B, col); this.quad(c, e, E, Cc, col); this.quad(e, a, A, E, col);
  if (!o.sinTecho) this.quad(A, B, Cc, E, ct); if (o.conBase) this.quad(e, c, b, a, col);
};
// cilindro / cono de n lados
Geo.prototype.cil = function (x, y, z, r0, r1, h, n, col, o) {
  o = o || {}; for (let i = 0; i < n; i++) { const a0 = i / n * Math.PI * 2, a1 = (i + 1) / n * Math.PI * 2;
    const p0 = [x + Math.cos(a0) * r0, y, z + Math.sin(a0) * r0], p1 = [x + Math.cos(a1) * r0, y, z + Math.sin(a1) * r0], q0 = [x + Math.cos(a0) * r1, y + h, z + Math.sin(a0) * r1], q1 = [x + Math.cos(a1) * r1, y + h, z + Math.sin(a1) * r1];
    if (r1 > 0.001) this.quad(p1, p0, q0, q1, col); else this.tri(p1, p0, q0, col);
    if (o.tapa && r1 > 0.001) this.tri([x, y + h, z], q1, q0, o.colTapa || col); }
};
Geo.prototype.geometria = function () { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3)); g.computeVertexNormals(); return g; };
Geo.prototype.tris = function () { return this.p.length / 9; };

/* ---------- geometría plana: distancia de un punto a una polilínea ---------- */
function distPoli(x, z, P) { let best = 1e9; for (let i = 0; i < P.length - 1; i++) { const [ax, az] = P[i], [bx, bz] = P[i + 1], dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L2)); best = Math.min(best, Math.hypot(x - ax - dx * t, z - az - dz * t)); } return best; }
function esquinas(cx, cz, w, d, rot, m) { m = m || 0; const c = Math.cos(rot), s = Math.sin(rot), W = w / 2 + m, D = d / 2 + m; return [[-W, -D], [W, -D], [W, D], [-W, D]].map(([x, z]) => [cx + x * c + z * s, cz - x * s + z * c]); }
// separación de ejes entre dos rectángulos girados
function solapan(A, B) {
  const ejes = []; [A, B].forEach(P => { for (let i = 0; i < 2; i++) { const [ax, az] = P[i], [bx, bz] = P[i + 1]; ejes.push([-(bz - az), bx - ax]); } });
  return ejes.every(([ex, ez]) => { const pa = A.map(p => p[0] * ex + p[1] * ez), pb = B.map(p => p[0] * ex + p[1] * ez); return Math.max(...pa) > Math.min(...pb) && Math.max(...pb) > Math.min(...pa); });
}

/* ===================================================================================== */
/* PLANO: calles, plaza y parcelas (sin geometría). Sirve para crear el terreno con los caminos antes de construir. */
function planoPueblo(seed, bioma, era, op) {
  op = Object.assign({centro: [0, 0], tamano: 'pueblo', uPorMetro: 1 / 0.6, rot: null}, op || {});
  const r = rng(seed), M = op.uPorMetro, [cx0, cz0] = op.centro, rot = op.rot == null ? r() * Math.PI : op.rot, cs = Math.cos(rot), sn = Math.sin(rot);
  const T = {aldea: {L: 120, trans: 2, plaza: 10, max: 12}, pueblo: {L: 180, trans: 3, plaza: 13, max: 22}, grande: {L: 250, trans: 4, plaza: 16, max: 34}}[op.tamano] || {L: 180, trans: 3, plaza: 13, max: 22};
  const W = (x, z) => [cx0 + (x * cs + z * sn) * M, cz0 + (-x * sn + z * cs) * M];          // local (m) → mundo (u)
  // calle principal: Bézier cuadrática con curva aleatoria
  const L = T.L, curva = (r() - 0.5) * L * 0.35, prin = [];
  for (let i = 0; i <= 24; i++) { const t = i / 24, x = lerp(-L / 2, L / 2, t), z = 2 * t * (1 - t) * curva; prin.push([x, z]); }
  const calles = [{puntos: prin, ancho: 6, tipo: 'principal'}];
  const plazaL = prin[12], plaza = {c: plazaL, r: T.plaza};
  // transversales: perpendiculares a la principal en posiciones repartidas (no en la plaza)
  const usados = [12]; for (let k = 0; k < T.trans; k++) {
    let i; let tries = 0; do { i = 3 + Math.floor(r() * 19); tries++; } while (usados.some(u => Math.abs(u - i) < 4) && tries < 40); if (tries >= 40) break; usados.push(i);
    const [ax, az] = prin[i], [bx, bz] = prin[Math.min(24, i + 1)], dx = bx - ax, dz = bz - az, l = Math.hypot(dx, dz), nx = -dz / l, nz = dx / l, lado = r() < 0.5 ? -1 : 1, len = 40 + r() * 45, cur = (r() - 0.5) * 14;
    const P = []; for (let s = 0; s <= 8; s++) { const t = s / 8; P.push([ax + nx * lado * len * t + dx / l * cur * Math.sin(t * Math.PI), az + nz * lado * len * t + dz / l * cur * Math.sin(t * Math.PI)]); }
    calles.push({puntos: P, ancho: 4.5, tipo: 'transversal'});
  }
  // parcelas
  const parcelas = [], ocupado = [];
  const libre = (cx, cz, w, d, ro) => {
    const E = esquinas(cx, cz, w, d, ro, 1.2);
    if (ocupado.some(o => solapan(E, o))) return false;
    for (const c of calles) { const lim = c.ancho / 2 + 0.8; if (E.concat([[cx, cz]]).some(([x, z]) => distPoli(x, z, c.puntos) < lim)) return false;
      for (let a = 0; a < 4; a++) { const [x0, z0] = E[a], [x1, z1] = E[(a + 1) % 4]; for (let t = 0.25; t < 1; t += 0.25) if (distPoli(lerp(x0, x1, t), lerp(z0, z1, t), c.puntos) < lim) return false; } }
    if (Math.hypot(cx - plaza.c[0], cz - plaza.c[1]) < plaza.r + Math.max(w, d) * 0.5 - 1) return false;
    return true;
  };
  const poner = (tipo, cx, cz, w, d, ro, extra) => { if (!libre(cx, cz, w, d, ro)) return null; const p = Object.assign({tipo, cx, cz, w, d, rot: ro}, extra || {}); ocupado.push(esquinas(cx, cz, w, d, ro, 0.2)); parcelas.push(p); return p; };
  // iglesia: en el borde de la plaza, mirando a ella
  { const a = r() * Math.PI * 2, d = plaza.r + 14; for (let k = 0; k < 12; k++) { const aa = a + k * 0.52, x = plaza.c[0] + Math.cos(aa) * d, z = plaza.c[1] + Math.sin(aa) * d, ro = Math.atan2(plaza.c[0] - x, plaza.c[1] - z);
    if (poner('iglesia', x, z, 12, 26, ro)) break; } }
  const pozo = {tipo: 'pozo', cx: plaza.c[0] + 3, cz: plaza.c[1] + 2, w: 2, d: 2, rot: 0}; parcelas.push(pozo); ocupado.push(esquinas(pozo.cx, pozo.cz, 2.4, 2.4, 0));
  // a lo largo de cada calle, a ambos lados
  const tipos = () => { const x = r(); return x < 0.42 ? 'casa_baja' : x < 0.72 ? 'casa_dos' : x < 0.8 ? 'posada' : 'casa_baja'; };
  let posada = false;
  calles.forEach((c, ci) => {
    const P = c.puntos; let acum = 0; const segL = []; for (let i = 0; i < P.length - 1; i++) segL.push(Math.hypot(P[i + 1][0] - P[i][0], P[i + 1][1] - P[i][1]));
    const total = segL.reduce((a, b) => a + b, 0);
    [-1, 1].forEach(lado => {
      let s = 2 + r() * 4;
      while (s < total - 4 && parcelas.length < T.max * 1.6) {
        let i = 0, q = s; while (i < segL.length - 1 && q > segL[i]) { q -= segL[i]; i++; } const t = q / segL[i], [ax, az] = P[i], [bx, bz] = P[i + 1], px = lerp(ax, bx, t), pz = lerp(az, bz, t);
        const dx = (bx - ax) / segL[i], dz = (bz - az) / segL[i], nx = -dz * lado, nz = dx * lado, dPlaza = Math.hypot(px - plaza.c[0], pz - plaza.c[1]);
        let tipo = tipos(); if (!posada && dPlaza < 40 && ci === 0) { tipo = 'posada'; } if (dPlaza > L * 0.36 && r() < 0.5) tipo = 'granja';
        const dims = {casa_baja: [7 + r() * 3, 6 + r() * 1.5], casa_dos: [8 + r() * 3.5, 7 + r() * 1.5], posada: [14, 9], granja: [22, 20]}[tipo];
        const [w, d] = dims, ret = c.ancho / 2 + 1 + r() * 2.5 + d / 2, cx = px + nx * ret, cz = pz + nz * ret, ro = Math.atan2(-nx, -nz);   // +z local mira a la calle
        const p = poner(tipo, cx, cz, w, d, ro, {calle: ci, lado}); if (p && tipo === 'posada') posada = true;
        if (p && r() < 0.55 && tipo !== 'granja') { // huerto detrás
          const hd = 7 + r() * 5, hw = w * (0.8 + r() * 0.3), hx = cx - nx * (d / 2 + hd / 2 + 1), hz = cz - nz * (d / 2 + hd / 2 + 1);
          poner('huerto', hx, hz, hw, hd, ro);
        }
        s += (p ? w : 4) + 1.5 + r() * 3;
        if (parcelas.filter(p => !['huerto', 'pozo'].includes(p.tipo)).length >= T.max) break;
      }
    });
  });
  // molino y mansión en las afueras
  const fuera = (tipo, w, d, dmin) => { for (let k = 0; k < 40; k++) { const a = r() * Math.PI * 2, dd = dmin + r() * 30, x = Math.cos(a) * dd, z = Math.sin(a) * dd * 0.7; if (poner(tipo, x, z, w, d, r() * Math.PI * 2)) return true; } return false; };
  fuera('molino', 7, 7, L * 0.55); if (op.tamano !== 'aldea') fuera('mansion', 30, 26, L * 0.5);
  // a coordenadas del mundo
  const toW = p => { const [x, z] = W(p.cx, p.cz); return Object.assign({}, p, {cx: x, cz: z, w: p.w * M, d: p.d * M, rot: p.rot + rot}); };
  return {calles: calles.map(c => ({puntos: c.puntos.map(([x, z]) => W(x, z)), ancho: c.ancho * M, tipo: c.tipo})), plaza: {c: W(...plaza.c), r: plaza.r * M}, parcelas: parcelas.map(toW), rot, M, semilla: seed, bioma, era, tamano: op.tamano};
}

/* ===================================================================================== */
function buildVillage(seed, bioma, era, tf, op) {
  op = Object.assign({uPorMetro: 1 / 0.6, danos: null, plan: null, distLOD: [260, 700]}, op || {});
  const plan = op.plan || planoPueblo(seed, bioma, era, op), M = plan.M || op.uPorMetro, r = rng(seed * 7 + 3);
  const st = ESTILOS[BIOMA_ESTILO[bioma] || bioma] || ESTILOS.centroeuropeo, eraI = 'ABCDE'.indexOf(era || 'B');
  const pDanio = op.danos != null ? op.danos : [0, 0, 0, 0.4, 0.55][Math.max(0, eraI)];
  const H = (x, z) => (tf && (tf.height || tf.heightAt)) ? (tf.height || tf.heightAt)(x, z) : 0;
  // 1) allanar todas las plataformas primero (así un allanado no estropea la planta de otro edificio)
  const plataformas = [];
  if (tf && tf.aplanar) plan.parcelas.forEach(p => { if (p.tipo === 'huerto') return; const h = tf.aplanar(p.cx, p.cz, p.w + 0.6 * M, p.d + 0.6 * M, p.rot, 3 * M); plataformas.push({centro: [p.cx, p.cz], ancho: p.w, fondo: p.d, rot: p.rot, altura: h}); });
  // 2) altura de suelo y de cimiento según el terreno final
  plan.parcelas.forEach(p => { const E = esquinas(p.cx, p.cz, p.w, p.d, p.rot, 0.3 * M); const hs = []; for (let a = 0; a < 4; a++) { const [x0, z0] = E[a], [x1, z1] = E[(a + 1) % 4]; for (let t = 0; t < 1; t += 0.2) hs.push(H(lerp(x0, x1, t), lerp(z0, z1, t))); } hs.push(H(p.cx, p.cz));
    p.hMax = Math.max(...hs); p.hMin = Math.min(...hs); p.suelo = p.hMax + 0.12 * M; p.cimiento = p.hMin - 0.5 * M; });
  // 3) geometría por nivel de detalle
  const L = [0, 1, 2].map(() => ({muro: new Geo(), tejado: new Geo(), detalle: new Geo(), inst: {poste: [], planta: [], tumba: [], escombro: [], paca: []}}));
  const colliders = [], cover = [], loopholes = [], edificios = [];
  plan.parcelas.forEach((p, ix) => {
    const danio = ['huerto', 'pozo'].includes(p.tipo) ? 0 : (r() < pDanio ? (r() < 0.45 ? 2 : 1) : 0);
    const info = {tipo: p.tipo, centro: [p.cx, p.cz], rot: p.rot, ancho: p.w, fondo: p.d, suelo: p.suelo, danio, plantas: 0, alto: 0};
    for (let lod = 0; lod < 3; lod++) {
      const G = L[lod], mat = new THREE.Matrix4().makeRotationY(p.rot).setPosition(p.cx, 0, p.cz).multiply(new THREE.Matrix4().makeScale(M, M, M));
      [G.muro, G.tejado, G.detalle].forEach(g => { g.m.copy(mat); g.oscurece = danio === 2 ? 0.35 : 0; });
      const ctx = {G, lod, st, era: eraI, r: rng(seed * 131 + ix * 7 + 1), danio, p, M, suelo: (p.suelo) / M, cim: (p.cimiento) / M, w: p.w / M, d: p.d / M, salida: lod === 0 ? {colliders, cover, loopholes, info} : null, mat, Hw: H};
      ctx.H = (lx, lz) => { const [wx, wz] = aMundo(ctx, lx, lz); return H(wx, wz) / M; };
      (CONSTR[p.tipo] || CONSTR.casa_baja)(ctx);
    }
    if (!['huerto'].includes(p.tipo)) edificios.push(info);
  });
  // muros de piedra y vallas entre parcelas de la plaza: ya los añade cada constructor
  // 4) mallas
  const mats = {muro: new THREE.MeshLambertMaterial({vertexColors: true}), tejado: new THREE.MeshLambertMaterial({vertexColors: true, flatShading: true}), detalle: new THREE.MeshLambertMaterial({vertexColors: true})};
  const INST = instGeos(), tris = [], grupos = [];
  L.forEach((G, lod) => {
    const g = new THREE.Group(); g.name = 'pueblo_lod' + lod; let t = 0;
    ['muro', 'tejado', 'detalle'].forEach(k => { if (!G[k].p.length) return; const m = new THREE.Mesh(G[k].geometria(), mats[k]); m.castShadow = lod < 2; m.receiveShadow = true; m.name = k; g.add(m); t += G[k].tris(); });
    Object.keys(G.inst).forEach(k => { const L2 = G.inst[k]; if (!L2.length) return; const im = new THREE.InstancedMesh(INST[k].geo, INST[k].mat, L2.length); L2.forEach((m4, i) => im.setMatrixAt(i, m4)); im.castShadow = lod === 0; im.receiveShadow = true; im.name = 'inst_' + k; g.add(im); t += INST[k].geo.index ? INST[k].geo.index.count / 3 * L2.length : INST[k].geo.attributes.position.count / 3 * L2.length; });
    tris.push(Math.round(t)); grupos.push(g);
  });
  const lodObj = new THREE.LOD(); const cen = plan.plaza ? plan.plaza.c : [0, 0]; lodObj.position.set(cen[0], 0, cen[1]); grupos.forEach(g => g.position.set(-cen[0], 0, -cen[1]));
  lodObj.addLevel(grupos[0], 0); lodObj.addLevel(grupos[1], op.distLOD[0]); lodObj.addLevel(grupos[2], op.distLOD[1]); lodObj.name = 'pueblo';
  return {grupo: lodObj, lods: grupos, colliders, cover, loopholes, edificios, calles: plan.calles, plaza: plan.plaza, plataformas, plan, estilo: BIOMA_ESTILO[bioma] || bioma,
    stats: {triangulos: tris, edificios: edificios.filter(e => e.tipo !== 'pozo').length, danados: edificios.filter(e => e.danio).length, colliders: colliders.length, cover: cover.length, loopholes: loopholes.length}};
}

/* ---------- geometrías para instancias (en metros; la matriz de cada instancia ya incluye la escala M) ---------- */
let _INST = null;
function instGeos() {
  if (_INST) return _INST; const lam = c => new THREE.MeshLambertMaterial({color: c});
  const poste = new THREE.BoxGeometry(0.12, 1.1, 0.12); poste.translate(0, 0.55, 0);
  const planta = new THREE.OctahedronGeometry(0.28, 0); planta.scale(1, 0.7, 1); planta.translate(0, 0.18, 0);
  const tumba = new THREE.BoxGeometry(0.5, 0.8, 0.12); tumba.translate(0, 0.4, 0);
  const escombro = new THREE.OctahedronGeometry(0.75, 0); escombro.scale(1, 0.6, 1); escombro.translate(0, 0.3, 0);
  const paca = new THREE.CylinderGeometry(1.4, 2.0, 2.6, 7, 1); paca.translate(0, 1.3, 0);
  _INST = {poste: {geo: poste, mat: lam(0x6a4a30)}, planta: {geo: planta, mat: lam(0x4e7a34)}, tumba: {geo: tumba, mat: lam(0x9a968c)}, escombro: {geo: escombro, mat: lam(0x8a8070)}, paca: {geo: paca, mat: lam(0xb09a58)}};
  return _INST;
}
// matriz de instancia en coordenadas locales del edificio (metros) → mundo
function instM(ctx, x, y, z, ry, sx, sy, sz) { const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry || 0, 0)), new THREE.Vector3(sx || 1, sy || 1, sz || 1)); return ctx.mat.clone().multiply(m); }
// local (m) → mundo (u) en planta
function aMundo(ctx, x, z) { const e = ctx.mat.elements; return [e[0] * x + e[8] * z + e[12], e[2] * x + e[10] * z + e[14]]; }
function dirMundo(ctx, x, z) { const e = ctx.mat.elements, a = e[0] * x + e[8] * z, b = e[2] * x + e[10] * z, l = Math.hypot(a, b) || 1; return [a / l, b / l]; }

/* ---------- piezas comunes ---------- */
// cimiento + zócalo: de la cota del cimiento (bajo el terreno) a la del suelo + 0,35 m
function zocalo(ctx, w, d, x, z) { ctx.G.muro.caja(x || 0, ctx.cim, z || 0, w + 0.16, ctx.suelo - ctx.cim + 0.35, d + 0.16, ctx.st.zocalo); }
// paredes de una planta (con boquetes si hay daños): devuelve la cota superior
function paredes(ctx, w, d, y, h, col) {
  const G = ctx.G.muro, R = ctx.r;
  if (ctx.danio === 2) {   // ruina: muros en tramos de altura irregular, sin cara superior uniforme
    const seg = Math.max(2, Math.round(w / 2.2)), segd = Math.max(2, Math.round(d / 2.2));
    [[w, d / 2, 0], [w, -d / 2, Math.PI], [d, w / 2, -Math.PI / 2], [d, -w / 2, Math.PI / 2]].forEach(([len, off, ry], k) => {
      const n = k < 2 ? seg : segd; for (let i = 0; i < n; i++) { const hh = h * (0.25 + R() * 0.75); if (R() < 0.15) continue; const lx = -len / 2 + (i + 0.5) * len / n;
        const px = k < 2 ? lx : off, pz = k < 2 ? off : lx; G.caja(px, y, pz, k < 2 ? len / n + 0.02 : 0.45, hh, k < 2 ? 0.45 : len / n + 0.02, col); } });
    return y + h * 0.5;
  }
  G.caja(0, y, 0, w, h, d, col, {sinTecho: true});
  return y + h;
}
// tejado a dos aguas (cumbrera a lo largo de x) o a cuatro aguas; devuelve la altura de la cumbrera
function tejado(ctx, w, d, y, tipo, o) {
  o = o || {}; const st = ctx.st, G = ctx.G.tejado, v = st.vuelo, pend = (o.pend || st.pend) * Math.PI / 180, alto = Math.tan(pend) * d / 2, col = o.col || (ctx.era === 0 && st.paja && ctx.r() < 0.35 && st === ESTILOS.centroeuropeo ? st.paja : st.tejado);
  const W = w / 2 + v, D = d / 2 + v, top = y + alto, yb = y - v * Math.tan(pend);
  if (ctx.danio === 2) return y;                                    // ruina: sin tejado
  const hund = ctx.danio === 1 && ctx.lod < 2;                      // tejado hundido: falta un tramo de un faldón, quedan las vigas
  if (tipo === 'cuatro') {
    const rx = Math.max(0.01, W - D);
    G.quad([-W, yb, D], [W, yb, D], [rx, top, 0], [-rx, top, 0], col); G.quad([W, yb, -D], [-W, yb, -D], [-rx, top, 0], [rx, top, 0], col);
    G.tri([W, yb, D], [W, yb, -D], [rx, top, 0], col); G.tri([-W, yb, -D], [-W, yb, D], [-rx, top, 0], col);
  } else {
    if (hund) {
      const a = -W + ctx.r() * W * 0.6, b = a + W * (0.6 + ctx.r() * 0.5);
      G.quad([-W, yb, D], [a, yb, D], [a, top, 0], [-W, top, 0], col); if (b < W) G.quad([b, yb, D], [W, yb, D], [W, top, 0], [b, top, 0], col);
      for (let x = a + 0.6; x < Math.min(W, b); x += 1.1) ctx.G.detalle.caja(x, yb, D / 2, 0.14, 0.14, D + 0.1, C.maderaO, {});   // vigas a la vista (caja tumbada aproximada)
    } else G.quad([-W, yb, D], [W, yb, D], [W, top, 0], [-W, top, 0], col);
    G.quad([W, yb, -D], [-W, yb, -D], [-W, top, 0], [W, top, 0], col);
    const cg = o.colHastial || ctx.st.muro;                         // hastiales
    ctx.G.muro.tri([-w / 2, y, d / 2], [-w / 2, top - v * 0.2, 0], [-w / 2, y, -d / 2], cg); ctx.G.muro.tri([w / 2, y, -d / 2], [w / 2, top - v * 0.2, 0], [w / 2, y, d / 2], cg);
    if (ctx.lod === 0) { G.quad([-W, yb - 0.12, D], [W, yb - 0.12, D], [W, yb, D], [-W, yb, D], 0x3a2a1e); G.quad([W, yb - 0.12, -D], [-W, yb - 0.12, -D], [-W, yb, -D], [W, yb, -D], 0x3a2a1e); }   // canto del alero
    if (st.nieve && !hund) { const e = 0.04; G.quad([-W, yb + e + 0.1, D * 0.98], [W, yb + e + 0.1, D * 0.98], [W, top + e, 0], [-W, top + e, 0], st.nieve); G.quad([W, yb + e + 0.1, -D * 0.98], [-W, yb + e + 0.1, -D * 0.98], [-W, top + e, 0], [W, top + e, 0], st.nieve); }
  }
  return top;
}
function chimenea(ctx, x, z, ytop, h) { if (ctx.lod === 2 || ctx.danio === 2) return; const col = ctx.st === ESTILOS.ingles ? 0x8a4434 : C.piedraO; ctx.G.detalle.caja(x, ytop - 1.2, z, 0.7, 1.2 + (h || 0.9), 0.7, col); if (ctx.lod === 0) ctx.G.detalle.caja(x, ytop + (h || 0.9) - 0.05, z, 0.9, 0.14, 0.9, 0x4a4640); }
// ventana en la fachada: cara (0 frente +z, 1 detrás, 2 derecha +x, 3 izquierda); u = posición a lo largo de la cara; y = base
function ventana(ctx, w, d, cara, u, y, vw, vh, planta) {
  const st = ctx.st, G = ctx.G.detalle, e = 0.025, P = (a, b, c) => cara === 0 ? [a, b, d / 2 + c] : cara === 1 ? [-a, b, -d / 2 - c] : cara === 2 ? [w / 2 + c, b, -a] : [-w / 2 - c, b, a];
  const roto = ctx.danio && ctx.r() < 0.35, col = roto ? C.hueco : C.cristal;
  if (ctx.lod <= 1) G.quad(P(u - vw / 2, y, e * 2), P(u + vw / 2, y, e * 2), P(u + vw / 2, y + vh, e * 2), P(u - vw / 2, y + vh, e * 2), col);
  if (ctx.lod === 0) { const f = 0.12; G.quad(P(u - vw / 2 - f, y - f, e), P(u + vw / 2 + f, y - f, e), P(u + vw / 2 + f, y + vh + f, e), P(u - vw / 2 - f, y + vh + f, e), st.marco);
    G.quad(P(u - vw / 2 - f * 1.5, y - f * 1.6, e * 3), P(u + vw / 2 + f * 1.5, y - f * 1.6, e * 3), P(u + vw / 2 + f * 1.5, y - f * 0.6, e * 3), P(u - vw / 2 - f * 1.5, y - f * 0.6, e * 3), C.piedra);   // alféizar
    if (st.postigo) { const pc = st.postigo[Math.floor(ctx.r() * st.postigo.length)]; [-1, 1].forEach(s => { const x0 = u + s * (vw / 2 + 0.05), x1 = u + s * (vw / 2 + 0.05 + vw * 0.5); G.quad(P(Math.min(x0, x1), y, e * 1.5), P(Math.max(x0, x1), y, e * 1.5), P(Math.max(x0, x1), y + vh, e * 1.5), P(Math.min(x0, x1), y + vh, e * 1.5), pc); }); } }
  if (ctx.salida) { const [lx, , lz] = P(u, 0, -0.3), [ox, , oz] = P(u, 0, 1), [wx, wz] = aMundo(ctx, lx, lz), [qx, qz] = aMundo(ctx, ox, oz), dl = Math.hypot(qx - wx, qz - wz);
    ctx.salida.loopholes.push({tipo: roto ? 'boquete' : 'ventana', pos: [wx, (y + vh * 0.55) * ctx.M, wz], dir: [(qx - wx) / dl, (qz - wz) / dl], planta, edificio: ctx.salida.info.tipo, ancho: vw * ctx.M}); }
}
function puerta(ctx, w, d, u, y, pw, ph, col) {
  const G = ctx.G.detalle, e = 0.03; G.quad([u - pw / 2, y, d / 2 + e * 2], [u + pw / 2, y, d / 2 + e * 2], [u + pw / 2, y + ph, d / 2 + e * 2], [u - pw / 2, y + ph, d / 2 + e * 2], col || ctx.st.puerta);
  if (ctx.lod === 0) { G.quad([u - pw / 2 - 0.14, y, d / 2 + e], [u + pw / 2 + 0.14, y, d / 2 + e], [u + pw / 2 + 0.14, y + ph + 0.14, d / 2 + e], [u - pw / 2 - 0.14, y + ph + 0.14, d / 2 + e], ctx.st.marco); G.caja(u, y - 0.18, d / 2 + 0.3, pw + 0.4, 0.18, 0.5, C.piedra); }
  if (ctx.salida) { const [wx, wz] = aMundo(ctx, u, d / 2 + 0.5); ctx.salida.loopholes.push({tipo: 'puerta', pos: [wx, y * ctx.M, wz], dir: dirMundo(ctx, 0, 1), planta: 0, edificio: ctx.salida.info.tipo, ancho: pw * ctx.M}); }
}
// decoración de muros por estilo (entramado, troncos, esquinas de sillería)
function decoMuro(ctx, w, d, y0, h) {
  if (ctx.lod !== 0 || ctx.danio === 2) return; const st = ctx.st, G = ctx.G.detalle, e = 0.015, t = 0.16;
  const cara = (fn) => { fn((a, b, c) => [a, b, d / 2 + c]); fn((a, b, c) => [-a, b, -d / 2 - c]); };
  if (st.entramado) {
    cara(P => { [y0 + 0.05, y0 + h - t].forEach(yy => G.quad(P(-w / 2, yy, e), P(w / 2, yy, e), P(w / 2, yy + t, e), P(-w / 2, yy + t, e), st.viga));
      for (let x = -w / 2; x <= w / 2 + 0.01; x += w / Math.max(2, Math.round(w / 2.4))) { const a = Math.min(w / 2 - t, Math.max(-w / 2, x - t / 2)); G.quad(P(a, y0, e), P(a + t, y0, e), P(a + t, y0 + h, e), P(a, y0 + h, e), st.viga); }
      G.quad(P(-w / 2 + 0.1, y0 + 0.2, e), P(-w / 2 + 0.1 + t, y0 + 0.2, e), P(-w / 2 + 1.4, y0 + h - 0.3, e), P(-w / 2 + 1.4 - t, y0 + h - 0.3, e), st.viga); });
  }
  if (st.troncos) cara(P => { for (let yy = y0 + 0.3; yy < y0 + h; yy += 0.55) G.quad(P(-w / 2 - 0.1, yy, e), P(w / 2 + 0.1, yy, e), P(w / 2 + 0.1, yy + 0.07, e), P(-w / 2 - 0.1, yy + 0.07, e), st.viga); });
  if (st.esquinas) [[-1, 1], [1, 1], [1, -1], [-1, -1]].forEach(([sx, sz]) => G.caja(sx * (w / 2 - 0.1), y0, sz * (d / 2 - 0.1), 0.32, h, 0.32, st.esquinas, {sinTecho: true}));
}
// colisor y coberturas de un edificio rectangular (en metros locales)
function salidaCaja(ctx, w, d, alto) {
  const s = ctx.salida; if (!s) return; const M = ctx.M, [cx, cz] = aMundo(ctx, 0, 0);
  s.colliders.push({tipo: 'caja', centro: [cx, cz], ancho: w * M, fondo: d * M, rot: ctx.p.rot, alto: alto * M, base: ctx.p.suelo, edificio: ctx.p.tipo, blando: false});
  s.info.alto = alto * M;
  // dos puestos por esquina, pegados a cada pared, a 0,5 m del canto: protegen de lo que está al otro lado del edificio
  [[-1, 1], [1, 1], [1, -1], [-1, -1]].forEach(([sx, sz]) => {
    [[sx * (w / 2 - 0.6), sz * (d / 2 + 0.55), 0, -sz], [sx * (w / 2 + 0.55), sz * (d / 2 - 0.6), -sx, 0]].forEach(([lx, lz, fx, fz]) => {
      const [x, z] = aMundo(ctx, lx, lz), f = dirMundo(ctx, fx, fz), esq = aMundo(ctx, sx * w / 2, sz * d / 2), izq = [f[1], -f[0]], lado = (esq[0] - x) * izq[0] + (esq[1] - z) * izq[1] > 0 ? 'izq' : 'der';
      s.cover.push({tipo: 'esquina', pos: [x, ctx.Hw(x, z), z], alto: 'alta', protegeDe: f, lados: [lado], capacidad: 1, edificio: ctx.p.tipo});
    });
  });
}
// muro bajo o valla a lo largo de un segmento local (m): tipo 'piedra' | 'valla' | 'seto'
function muroBajo(ctx, x0, z0, x1, z1, tipo, alto) {
  const G = ctx.G, L = Math.hypot(x1 - x0, z1 - z0), ry = Math.atan2(-(z1 - z0), x1 - x0); alto = alto || (tipo === 'piedra' ? 1.1 : 1.05);
  const n = Math.max(1, Math.ceil(L / (ctx.lod === 0 ? (tipo === 'piedra' ? 4 : 2.6) : 7))), roto = tipo === 'piedra' && (ctx.danio || ctx.era >= 3);
  for (let k = 0; k < n; k++) {      // tramos que siguen el terreno: base bajo el punto más bajo, coronación sobre el más alto
    const ta = k / n, tb = (k + 1) / n, xa = lerp(x0, x1, ta), za = lerp(z0, z1, ta), xb = lerp(x0, x1, tb), zb = lerp(z0, z1, tb), xm = (xa + xb) / 2, zm = (za + zb) / 2;
    const ha = ctx.H(xa, za), hb = ctx.H(xb, zb), hm = ctx.H(xm, zm), lo = Math.min(ha, hb, hm) - 0.35, hi = Math.max(ha, hb, hm);
    if (tipo === 'piedra') { if (ctx.lod < 2) { const hh = hi - lo + alto * (roto && ctx.r() < 0.35 ? 0.55 : 1); G.muro.caja(xm, lo, zm, L / n + 0.05, hh, 0.55, C.piedra, {ry, colTecho: C.piedraO}); } }
    else if (tipo === 'valla') {
      if (ctx.lod === 0) { G.inst.poste.push(instM(ctx, xa, ha - 0.15, za, ry)); if (k === n - 1) G.inst.poste.push(instM(ctx, xb, hb - 0.15, zb, ry));
        [0.45, 0.85].forEach(yy => { const sv = G.detalle.m.clone(); const dy = hb - ha, len = L / n, ang = Math.atan2(dy, len);
          G.detalle.m.multiply(new THREE.Matrix4().makeTranslation(xa, ha + yy, za)).multiply(new THREE.Matrix4().makeRotationY(ry)).multiply(new THREE.Matrix4().makeRotationZ(ang)); const ll = Math.hypot(len, dy); G.detalle.quad([0, -0.04, 0.03], [ll, -0.04, 0.03], [ll, 0.04, 0.03], [0, 0.04, 0.03], C.madera); G.detalle.quad([ll, -0.04, -0.03], [0, -0.04, -0.03], [0, 0.04, -0.03], [ll, 0.04, -0.03], C.madera); G.detalle.m.copy(sv); }); }
      else if (ctx.lod === 1) G.detalle.caja(xm, lo + 0.35, zm, L / n, hi - lo + 0.6, 0.05, C.madera, {ry});
    }
  }
  if (ctx.salida) { const a = aMundo(ctx, x0, z0), b = aMundo(ctx, x1, z1), M = ctx.M; ctx.salida.colliders.push({tipo: 'segmento', a, b, alto: alto * M, grosor: (tipo === 'piedra' ? 0.55 : 0.1) * M, blando: tipo !== 'piedra', salto: alto < 1.2});
    if (tipo === 'piedra') { const nc = Math.max(1, Math.floor(L / 1.2)), nx = -(z1 - z0) / L, nz = (x1 - x0) / L;
      for (let i = 0; i < nc; i++) { const t = (i + 0.5) / nc; [-1, 1].forEach(sg => { const lx = lerp(x0, x1, t) + nx * 0.7 * sg, lz = lerp(z0, z1, t) + nz * 0.7 * sg, [x, z] = aMundo(ctx, lx, lz); ctx.salida.cover.push({tipo: 'muro_bajo', pos: [x, ctx.Hw(x, z), z], alto: 'baja', protegeDe: dirMundo(ctx, -nx * sg, -nz * sg), lados: ['arriba', 'izq', 'der'], capacidad: 1}); }); } } }
}

/* ---------- constructores por tipo (todo en metros, origen = centro de la planta, +z = fachada a la calle) ---------- */
const CONSTR = {
  casa_baja(ctx) { casa(ctx, 1); },
  casa_dos(ctx) { casa(ctx, 2); },
  posada(ctx) { casa(ctx, 2, {letrero: true}); },
  granja(ctx) {
    const w = ctx.w, d = ctx.d, r = ctx.r;   // patio cuadrado: vivienda delante, granero al fondo, muro de piedra con portón
    const sub = (fn, x, z, ww, dd, ry) => { const save = ctx.G.muro.m.clone(); const m = new THREE.Matrix4().makeRotationY(ry || 0).setPosition(x, 0, z); [ctx.G.muro, ctx.G.tejado, ctx.G.detalle].forEach(g => g.m.multiply(m)); const prev = ctx.mat; ctx.mat = ctx.mat.clone().multiply(m); const W0 = ctx.w, D0 = ctx.d; ctx.w = ww; ctx.d = dd; fn(); ctx.w = W0; ctx.d = D0; ctx.mat = prev; [ctx.G.muro, ctx.G.tejado, ctx.G.detalle].forEach(g => g.m.copy(save)); };
    sub(() => casa(ctx, 1 + (r() < 0.4 ? 1 : 0)), -w / 2 + 5, d / 2 - 4, 9, 7, 0);
    sub(() => granero(ctx), w / 2 - 6.5, -d / 2 + 5.5, 12, 9, 0);
    muroBajo(ctx, -w / 2, -d / 2, w / 2 - 13, -d / 2, 'piedra'); muroBajo(ctx, -w / 2, -d / 2, -w / 2, d / 2 - 8, 'piedra'); muroBajo(ctx, w / 2, -d / 2 + 10.5, w / 2, d / 2, 'piedra'); muroBajo(ctx, w / 2, d / 2, 2, d / 2, 'piedra');
    if (ctx.lod === 0) { ctx.G.inst.paca.push(instM(ctx, -2, ctx.H(-2, -3) - 0.2, -3, 0)); if (r() < 0.6) ctx.G.inst.paca.push(instM(ctx, 1.5, ctx.H(1.5, -4.5) - 0.2, -4.5, 0.4, 0.8, 0.8, 0.8)); }
    if (ctx.salida) ctx.salida.info.alto = 7 * ctx.M;
  },
  huerto(ctx) {
    const w = ctx.w, d = ctx.d; if (ctx.lod === 0) for (let x = -w / 2 + 0.8; x < w / 2 - 0.5; x += 0.9) for (let z = -d / 2 + 0.8; z < d / 2 - 0.5; z += 1.3) ctx.G.inst.planta.push(instM(ctx, x, ctx.H(x, z) - 0.05, z, ctx.r() * 6, 0.8 + ctx.r() * 0.5, 0.8 + ctx.r() * 0.5, 0.8 + ctx.r() * 0.5));
    if (ctx.lod <= 1) ctx.G.detalle.caja(0, ctx.cim, 0, w - 0.6, ctx.suelo - ctx.cim - 0.05, d - 0.6, C.tierra);
    muroBajo(ctx, -w / 2, -d / 2, w / 2, -d / 2, 'valla'); muroBajo(ctx, -w / 2, -d / 2, -w / 2, d / 2, 'valla'); muroBajo(ctx, w / 2, -d / 2, w / 2, d / 2, 'valla');
  },
  pozo(ctx) {
    const G = ctx.G; G.muro.cil(0, ctx.cim, 0, 0.95, 0.95, ctx.suelo - ctx.cim + 0.85, ctx.lod ? 6 : 10, C.piedra, {tapa: true, colTapa: C.hueco});
    if (ctx.lod === 0) { [-0.85, 0.85].forEach(x => G.detalle.caja(x, ctx.suelo + 0.8, 0, 0.12, 1.6, 0.12, C.madera)); G.tejado.quad([-1.2, ctx.suelo + 2.2, 0.8], [1.2, ctx.suelo + 2.2, 0.8], [1.2, ctx.suelo + 2.7, 0], [-1.2, ctx.suelo + 2.7, 0], ctx.st.tejado); G.tejado.quad([1.2, ctx.suelo + 2.2, -0.8], [-1.2, ctx.suelo + 2.2, -0.8], [-1.2, ctx.suelo + 2.7, 0], [1.2, ctx.suelo + 2.7, 0], ctx.st.tejado); }
    if (ctx.salida) { const [x, z] = aMundo(ctx, 0, 0); ctx.salida.colliders.push({tipo: 'circulo', centro: [x, z], radio: 1 * ctx.M, alto: 0.85 * ctx.M, blando: false});
      [0, 1, 2, 3].forEach(k => { const a = k * Math.PI / 2, [px, pz] = aMundo(ctx, Math.cos(a) * 1.6, Math.sin(a) * 1.6); ctx.salida.cover.push({tipo: 'pozo', pos: [px, ctx.Hw(px, pz), pz], alto: 'baja', protegeDe: dirMundo(ctx, -Math.cos(a), -Math.sin(a)), lados: ['arriba', 'izq', 'der'], capacidad: 1}); }); ctx.salida.info.alto = 0.85 * ctx.M; }
  },
  iglesia(ctx) {
    const w = ctx.w, d = ctx.d, st = ctx.st, G = ctx.G, y0 = ctx.suelo, hN = 9, tw = 5.2, tz = d / 2 - tw / 2, ruso = st === ESTILOS.ruso, med = st === ESTILOS.mediterraneo;
    const muroCol = st === ESTILOS.ingles || st === ESTILOS.norte ? 0x9a968a : st.muro;
    zocalo(ctx, w, d - tw, 0, -tw / 2); let yN = y0 + 0.35 + hN;
    const sub = (z, fn) => { const save = [G.muro.m.clone(), G.tejado.m.clone(), G.detalle.m.clone()], m = new THREE.Matrix4().makeTranslation(0, 0, z); [G.muro, G.tejado, G.detalle].forEach(g => g.m.multiply(m)); const prev = ctx.mat; ctx.mat = ctx.mat.clone().multiply(m); fn(); ctx.mat = prev; [G.muro, G.tejado, G.detalle].forEach((g, i) => g.m.copy(save[i])); };
    sub(-tw / 2, () => { yN = paredes(ctx, w, d - tw, y0 + 0.35, hN, muroCol); const s2 = ctx.w; ctx.w = d - tw; // nave: cumbrera a lo largo de z → giramos el tejado 90°
      const save = [G.tejado.m.clone(), G.muro.m.clone(), G.detalle.m.clone()], rm = new THREE.Matrix4().makeRotationY(Math.PI / 2); [G.tejado, G.muro, G.detalle].forEach(g => g.m.multiply(rm));
      tejado(ctx, d - tw, w, yN, 'dos', {pend: med ? 25 : 45, colHastial: muroCol}); [G.tejado, G.muro, G.detalle].forEach((g, i) => g.m.copy(save[i])); ctx.w = s2;
      if (ctx.lod <= 1) for (let z = -(d - tw) / 2 + 2.5; z < (d - tw) / 2 - 1.5; z += 3.2) [-1, 1].forEach(s => { const sv = ctx.salida; ctx.salida = null; ventana(ctx, w, d - tw, s > 0 ? 2 : 3, s > 0 ? -z : z, y0 + 3, 1.1, 3.2, 0); ctx.salida = sv; });
      // ábside
      if (ctx.lod < 2) G.muro.cil(0, y0 + 0.35, -(d - tw) / 2, w * 0.38, w * 0.38, hN * 0.8, ctx.lod ? 6 : 10, muroCol), G.tejado.cil(0, y0 + 0.35 + hN * 0.8, -(d - tw) / 2, w * 0.42, 0, 2.5, ctx.lod ? 6 : 10, st.tejado);
    });
    // campanario
    const hT = ruso ? 15 : 19; G.muro.caja(0, ctx.cim, tz, tw + 0.2, y0 - ctx.cim + 0.35, tw + 0.2, st.zocalo);
    const ruinaT = ctx.danio === 2; const hTr = ruinaT ? hT * 0.55 : hT; G.muro.caja(0, y0 + 0.35, tz, tw, hTr, tw, muroCol, {sinTecho: !ruinaT, colTecho: C.escombro});
    if (!ruinaT) {
      if (ctx.lod === 0) [0, 1, 2, 3].forEach(k => { const a = k * Math.PI / 2, cs = Math.cos(a), sn = Math.sin(a); G.detalle.quad(...[[-0.7, hT - 3.2], [0.7, hT - 3.2], [0.7, hT - 0.9], [-0.7, hT - 0.9]].map(([u, yy]) => [u * cs + (tw / 2 + 0.03) * sn, y0 + yy, tz + (tw / 2 + 0.03) * cs - u * sn]), C.hueco); });
      if (ruso) { G.tejado.cil(0, y0 + hT + 0.35, tz, tw * 0.45, tw * 0.62, 1.6, 10, 0x3a5a4a); G.tejado.cil(0, y0 + hT + 1.95, tz, tw * 0.62, 0.0, 3.2, 10, 0x3a5a4a); G.detalle.caja(0, y0 + hT + 5, tz, 0.12, 1.8, 0.12, 0xc8a048); }
      else if (med) { G.tejado.cil(0, y0 + hT + 0.35, tz, tw * 0.72, 0, 2.2, 4, st.tejado); }
      else { const aguja = ctx.era <= 1 ? 9 : 7; const ring = new THREE.Matrix4().makeRotationY(Math.PI / 4); const sv = G.tejado.m.clone(); G.tejado.m.multiply(new THREE.Matrix4().makeTranslation(0, 0, tz)).multiply(ring); G.tejado.cil(0, y0 + hT + 0.35, 0, tw * 0.72, 0, aguja, 4, st === ESTILOS.ingles ? 0x4a4e56 : 0x4a5a5a); G.tejado.m.copy(sv); }
    } else if (ctx.lod === 0) for (let k = 0; k < 10; k++) { const ex = (ctx.r() - 0.5) * 9, ez = tz + 3 + ctx.r() * 4; G.inst.escombro.push(instM(ctx, ex, ctx.H(ex, ez) - 0.1, ez, ctx.r() * 3, 0.5 + ctx.r(), 0.3 + ctx.r() * 0.6, 0.5 + ctx.r())); }
    puerta(ctx, w, d, 0, y0 + 0.35, 1.8, 3.2, 0x4a3020);
    // cementerio: muro de piedra alrededor de la parte trasera y lápidas
    muroBajo(ctx, -w / 2 - 5, d / 2, -w / 2 - 5, -d / 2 - 6, 'piedra'); muroBajo(ctx, -w / 2 - 5, -d / 2 - 6, w / 2 + 5, -d / 2 - 6, 'piedra'); muroBajo(ctx, w / 2 + 5, -d / 2 - 6, w / 2 + 5, d / 2, 'piedra');
    if (ctx.lod === 0) for (let k = 0; k < 14; k++) { const s = k % 2 ? 1 : -1; const tx = s * (w / 2 + 1.5 + ctx.r() * 2.5), tz2 = -d / 2 + 1 + ctx.r() * (d - 4); G.inst.tumba.push(instM(ctx, tx, ctx.H(tx, tz2) - 0.1, tz2, Math.PI / 2 + (ctx.r() - 0.5) * 0.2)); }
    if (ctx.salida) { salidaCaja(ctx, w, d, hN + 2); const s = ctx.salida; s.info.alto = (hT + 6) * ctx.M; s.info.plantas = 1;
      [0, 1, 2, 3].forEach(k => { const a = k * Math.PI / 2, [x, z] = aMundo(ctx, Math.sin(a) * tw / 2, tz + Math.cos(a) * tw / 2); s.loopholes.push({tipo: 'campanario', pos: [x, (y0 + hT - 2) * ctx.M, z], dir: dirMundo(ctx, Math.sin(a), Math.cos(a)), planta: 3, edificio: 'iglesia', ancho: 1.4 * ctx.M}); }); }
  },
  molino(ctx) {
    const G = ctx.G, st = ctx.st, y0 = ctx.suelo, h = 10, rb = 3.2, rt = 2.3, n = ctx.lod ? 6 : 10, med = st === ESTILOS.mediterraneo, col = med ? 0xefe9dc : st === ESTILOS.ruso ? 0x7a5a3e : 0xd8d0c0;
    G.muro.cil(0, ctx.cim, 0, rb + 0.15, rb + 0.15, y0 - ctx.cim + 0.35, n, st.zocalo); G.muro.cil(0, y0 + 0.35, 0, rb, rt, h, n, col);
    if (ctx.danio !== 2) { G.tejado.cil(0, y0 + h + 0.35, 0, rt + 0.3, 0, med ? 2.2 : 3.2, n, med ? 0x7a6a52 : st.tejado);
      if (ctx.lod < 2) { const ang = ctx.r() * Math.PI, ys = y0 + h - 0.6, zs = rt + 0.6; for (let k = 0; k < 4; k++) { const a = ang + k * Math.PI / 2, sv = G.detalle.m.clone(); G.detalle.m.multiply(new THREE.Matrix4().makeTranslation(0, ys, zs)).multiply(new THREE.Matrix4().makeRotationZ(a));
          G.detalle.caja(0, 0, 0, 0.25, 8.5, 0.18, C.maderaO); if (ctx.lod === 0) G.detalle.quad([0.15, 2, 0.1], [1.4, 2, 0.1], [1.4, 8.3, 0.1], [0.15, 8.3, 0.1], ctx.danio ? C.hueco : 0xd8d0b8); G.detalle.m.copy(sv); } } }
    puerta(ctx, rb * 2, rb * 2 - 0.3, 0, y0 + 0.35, 1.1, 2, null);
    if (ctx.salida) { const [x, z] = aMundo(ctx, 0, 0); ctx.salida.colliders.push({tipo: 'circulo', centro: [x, z], radio: rb * ctx.M, alto: h * ctx.M, base: ctx.p.suelo, edificio: 'molino', blando: false}); ctx.salida.info.alto = (h + 3) * ctx.M; ctx.salida.info.plantas = 3;
      [0, 1, 2].forEach(k => { const a = k * 2.1 + 0.4, [px, pz] = aMundo(ctx, Math.sin(a) * rt, Math.cos(a) * rt); ctx.salida.loopholes.push({tipo: 'aspillera', pos: [px, (y0 + 3 + k * 2.6) * ctx.M, pz], dir: dirMundo(ctx, Math.sin(a), Math.cos(a)), planta: k, edificio: 'molino', ancho: 0.4 * ctx.M}); }); }
  },
  mansion(ctx) {
    const w = 18, d = 12, y0 = ctx.suelo, st = ctx.st, G = ctx.G, pl = ctx.era >= 1 ? 3 : 2, hp = 3.6;
    const W = ctx.w, D = ctx.d; ctx.w = w; ctx.d = d;
    zocalo(ctx, w, d); let y = y0 + 0.35; const muroCol = st === ESTILOS.ruso ? 0xd8c8a8 : st === ESTILOS.norte ? 0xe8e0d0 : st.muro;
    const ytop = paredes(ctx, w, d, y, hp * pl, muroCol);
    for (let f = 0; f < pl; f++) for (let u = -w / 2 + 1.6; u <= w / 2 - 1.5; u += 2.2) { if (f === 0 && Math.abs(u) < 1.2) continue; ventana(ctx, w, d, 0, u, y + f * hp + 0.9, 1.1, 1.9, f); if (ctx.lod === 0 || f === 0) ventana(ctx, w, d, 1, u, y + f * hp + 0.9, 1.1, 1.9, f); }
    if (ctx.lod <= 1) for (let f = 0; f < pl; f++) [-2.5, 2.5].forEach(u => { ventana(ctx, w, d, 2, u, y + f * hp + 0.9, 1.1, 1.9, f); ventana(ctx, w, d, 3, u, y + f * hp + 0.9, 1.1, 1.9, f); });
    puerta(ctx, w, d, 0, y, 1.8, 2.8, null);
    if (ctx.lod === 0 && ctx.danio !== 2) { [-2.2, -0.8, 0.8, 2.2].forEach(x => G.detalle.cil(x, y, d / 2 + 1.8, 0.22, 0.2, 4.4, 6, C.blanco)); G.detalle.caja(0, y + 4.4, d / 2 + 1.1, 5.6, 0.4, 2.4, C.blanco); G.tejado.quad([-2.9, y + 4.8, d / 2 + 2.3], [2.9, y + 4.8, d / 2 + 2.3], [0, y + 6.0, d / 2 + 2.3], [0, y + 6.0, d / 2 + 2.3], C.blanco); }
    const top = tejado(ctx, w, d, ytop, 'cuatro', {pend: 32}); if (ctx.danio !== 2) { [-w / 2 + 2.5, w / 2 - 2.5].forEach(x => chimenea(ctx, x, 0, top - 0.5, 1.4));
      if (ctx.lod === 0) [-4, 0, 4].forEach(x => { G.muro.caja(x, ytop + 0.1, d / 2 - 0.6, 1.6, 1.4, 1.5, muroCol); G.tejado.quad([x - 1, ytop + 1.5, d / 2 + 0.25], [x + 1, ytop + 1.5, d / 2 + 0.25], [x, ytop + 2.3, d / 2 - 0.3], [x, ytop + 2.3, d / 2 - 0.3], st.tejado); G.detalle.quad([x - 0.4, ytop + 0.3, d / 2 + 0.17], [x + 0.4, ytop + 0.3, d / 2 + 0.17], [x + 0.4, ytop + 1.2, d / 2 + 0.17], [x - 0.4, ytop + 1.2, d / 2 + 0.17], C.cristal); }); }
    if (ctx.salida) { salidaCaja(ctx, w, d, hp * pl); ctx.salida.info.plantas = pl; }
    ctx.w = W; ctx.d = D;
    // jardín con muro y verja
    const mw = W / 2 - 0.5, md = D / 2 - 0.5; muroBajo(ctx, -mw, -md, mw, -md, 'piedra'); muroBajo(ctx, -mw, -md, -mw, md, 'piedra'); muroBajo(ctx, mw, -md, mw, md, 'piedra'); muroBajo(ctx, -mw, md, -2.5, md, 'piedra'); muroBajo(ctx, 2.5, md, mw, md, 'piedra');
    if (ctx.lod === 0) [-2.5, 2.5].forEach(x => G.muro.caja(x, ctx.cim, md, 0.8, y0 - ctx.cim + 2.4, 0.8, C.piedra));
  }
};
function granero(ctx) {
  const w = ctx.w, d = ctx.d, y0 = ctx.suelo, G = ctx.G, col = ctx.st === ESTILOS.mediterraneo ? 0xd8ccb4 : ctx.st === ESTILOS.norte ? 0x8a3428 : 0x7a5a3e;
  zocalo(ctx, w, d); const yt = paredes(ctx, w, d, y0 + 0.35, 4.2, col);
  if (ctx.lod === 0 && ctx.danio !== 2) for (let x = -w / 2; x <= w / 2; x += 0.9) { G.detalle.quad([x, y0 + 0.4, d / 2 + 0.02], [x + 0.06, y0 + 0.4, d / 2 + 0.02], [x + 0.06, yt, d / 2 + 0.02], [x, yt, d / 2 + 0.02], C.maderaO); }
  puerta(ctx, w, d, 0, y0 + 0.35, 3.2, 3.4, 0x4a3424);
  tejado(ctx, w, d, yt, 'dos', {pend: 48, colHastial: col});
  if (ctx.salida) { salidaCaja(ctx, w, d, 4.2); ctx.salida.info.plantas = 1; }
}
// casa de 1 o 2 plantas
function casa(ctx, pl, o) {
  o = o || {}; const w = ctx.w, d = ctx.d, st = ctx.st, y0 = ctx.suelo, hp = 2.9, R = ctx.r;
  zocalo(ctx, w, d); const ytop = paredes(ctx, w, d, y0 + 0.35, hp * pl, st.muro); decoMuro(ctx, w, d, y0 + 0.35, hp * pl);
  const nv = Math.max(1, Math.floor((w - 1.5) / 2.6)), du = Math.round((R() - 0.5) * (nv - 1)) * ((w - 1.5) / nv) * 0.0;
  const posV = []; for (let i = 0; i < nv + 1; i++) posV.push(-w / 2 + 0.75 + (i + 0.5) * (w - 1.5) / (nv + 1));
  const iPuerta = Math.floor(R() * posV.length);
  for (let f = 0; f < pl; f++) posV.forEach((u, i) => {
    if (f === 0 && i === iPuerta) return; const vh = st === ESTILOS.mediterraneo ? 1.1 : 1.3;
    ventana(ctx, w, d, 0, u, y0 + 0.35 + f * hp + 0.95, 0.9, vh, f);
    if (ctx.lod === 0 && (i % 2 === 0)) ventana(ctx, w, d, 1, u, y0 + 0.35 + f * hp + 0.95, 0.8, vh, f);
  });
  if (ctx.lod <= 1) for (let f = 0; f < pl; f++) { ventana(ctx, w, d, 2, 0, y0 + 0.35 + f * hp + 0.95, 0.8, 1.2, f); if (ctx.lod === 0) ventana(ctx, w, d, 3, 0, y0 + 0.35 + f * hp + 0.95, 0.8, 1.2, f); }
  puerta(ctx, w, d, posV[iPuerta], y0 + 0.35, 1.05, 2.1);
  const tipo = st === ESTILOS.mediterraneo && R() < 0.4 ? 'cuatro' : (pl === 2 && R() < 0.3 ? 'cuatro' : 'dos');
  const top = tejado(ctx, w, d, ytop, tipo);
  chimenea(ctx, (R() < 0.5 ? -1 : 1) * w * 0.28, -d * 0.12, top - 0.3, 0.9);
  if (pl === 2 && ctx.lod === 0 && tipo === 'dos' && st.pend >= 40 && ctx.danio === 0 && R() < 0.5) { const x = posV[Math.floor(posV.length / 2)] || 0, G = ctx.G; G.muro.caja(x, ytop + 0.2, d / 4 + 0.4, 1.4, 1.2, 1.2, st.muro); G.tejado.quad([x - 0.9, ytop + 1.4, d / 4 + 1.15], [x + 0.9, ytop + 1.4, d / 4 + 1.15], [x, ytop + 2.0, d / 4 + 0.6], [x, ytop + 2.0, d / 4 + 0.6], st.tejado); G.detalle.quad([x - 0.35, ytop + 0.4, d / 4 + 1.02], [x + 0.35, ytop + 0.4, d / 4 + 1.02], [x + 0.35, ytop + 1.2, d / 4 + 1.02], [x - 0.35, ytop + 1.2, d / 4 + 1.02], C.cristal); }
  if (o.letrero && ctx.lod === 0) { const G = ctx.G; G.detalle.caja(w / 2 - 1, y0 + 3.2, d / 2 + 0.6, 0.08, 0.08, 1.1, C.hierro); G.detalle.caja(w / 2 - 1, y0 + 2.4, d / 2 + 1.0, 0.06, 0.7, 0.9, 0x8a5a2a); }
  if (ctx.danio && ctx.lod === 0) for (let k = 0; k < 2 + ctx.danio * 3; k++) { const ex = (R() - 0.5) * (w + 3), ez = (R() - 0.5) * (d + 3); ctx.G.inst.escombro.push(instM(ctx, ex, Math.max(ctx.H(ex, ez), Math.abs(ex) < w / 2 && Math.abs(ez) < d / 2 ? ctx.suelo : -1e9) - 0.1, ez, R() * 3, 0.3 + R() * 0.8, 0.2 + R() * 0.4, 0.3 + R() * 0.8)); }
  if (ctx.danio === 1 && ctx.lod <= 1) { const G = ctx.G.detalle, u = (R() - 0.5) * (w - 3); G.quad([u - 1, y0 + 0.9, d / 2 + 0.06], [u + 0.8, y0 + 0.6, d / 2 + 0.06], [u + 1.1, y0 + 2.2, d / 2 + 0.06], [u - 0.6, y0 + 2.5, d / 2 + 0.06], C.hueco);
    if (ctx.salida) { const [x, z] = aMundo(ctx, u, d / 2 - 0.3); ctx.salida.loopholes.push({tipo: 'boquete', pos: [x, (y0 + 1.6) * ctx.M, z], dir: dirMundo(ctx, 0, 1), planta: 0, edificio: ctx.p.tipo, ancho: 1.6 * ctx.M}); } }
  if (ctx.salida) { salidaCaja(ctx, w, d, ctx.danio === 2 ? hp * pl * 0.5 : hp * pl); ctx.salida.info.plantas = pl; }
  // valla delantera en algunas casas
  if (R() < 0.3 && ctx.p.tipo !== 'posada') muroBajo(ctx, -w / 2, d / 2 + 1.6, w / 2, d / 2 + 1.6, st === ESTILOS.ingles || st === ESTILOS.mediterraneo ? 'piedra' : 'valla', 1.0);
}

/* ---------- prueba automática (P4): nada enterrado ni flotando; recuento de triángulos; plano sin solapes ---------- */
function pruebaPueblos(tfFactory) {
  const out = [];
  const casos = [['templado', 'B', 'grande'], ['mediterraneo', 'A', 'pueblo'], ['ruso', 'C', 'pueblo'], ['ingles', 'D', 'grande'], ['nevado', 'E', 'pueblo'], ['templado', 'E', 'aldea']];
  casos.forEach(([bio, era, tam], k) => {
    const seed = 100 + k * 17, tf = tfFactory(seed);
    const plan = planoPueblo(seed, bio, era, {centro: [tf.cx, tf.cz], tamano: tam});
    const P = buildVillage(seed, bio, era, tf, {plan});
    // comprobación de suelo: muestrea el contorno de cada edificio
    let enterrado = 0, flotando = 0, peorEnt = 0, peorFlo = 0;
    plan.parcelas.forEach(p => { if (p.tipo === 'huerto') return; const E = esquinas(p.cx, p.cz, p.w, p.d, p.rot, 0.08 * P.plan.M);
      for (let a = 0; a < 4; a++) { const [x0, z0] = E[a], [x1, z1] = E[(a + 1) % 4]; for (let t = 0; t <= 1; t += 0.1) { const h = tf.height(lerp(x0, x1, t), lerp(z0, z1, t));
        const ent = h - p.suelo, flo = p.cimiento - h; if (ent > 0.2) enterrado++; if (flo > 0.3) flotando++; peorEnt = Math.max(peorEnt, ent); peorFlo = Math.max(peorFlo, flo); } } });
    // solapes entre edificios y con calles
    let solapes = 0; const E2 = plan.parcelas.filter(p => p.tipo !== 'pozo').map(p => esquinas(p.cx, p.cz, p.w, p.d, p.rot)); for (let i = 0; i < E2.length; i++) for (let j = i + 1; j < E2.length; j++) if (solapan(E2[i], E2[j])) solapes++;
    let enCalle = 0; plan.parcelas.forEach(p => { if (p.tipo === 'pozo') return; plan.calles.forEach(c => { if (distPoli(p.cx, p.cz, c.puntos) < c.ancho / 2) enCalle++; }); });
    out.push({bioma: bio, era, tamano: tam, ...P.stats, enterrados: enterrado, flotando, peorEnterrado: +peorEnt.toFixed(3), peorFlotando: +peorFlo.toFixed(3), solapes, enCalle, tipos: [...new Set(P.edificios.map(e => e.tipo))].join(',')});
  });
  return {casos: out, ok: out.every(c => c.enterrados === 0 && c.flotando === 0 && c.solapes === 0 && c.enCalle === 0 && c.triangulos[0] <= 8000)};
}

/* ---------- demostración ---------- */
function demoPueblos(cont) {
  const T3 = root.terreno3d; cont = cont || document.body;
  const D = T3.baseDemo(cont, {cam: [700, 140, 760], obj: [520, 10, 420], sombra: 380});
  const q = new URLSearchParams(location.search), bio = q.get('bioma') || 'templado', era = q.get('era') || 'B', tam = q.get('tam') || 'grande', seed = +(q.get('seed') || 11);
  const plan = planoPueblo(seed, bio, era, {centro: [520, 420], tamano: tam});
  const T = T3.crearTerreno({ancho: 1024, fondo: 768, semilla: seed, bioma: bio === 'ingles' ? 'templado' : bio, relieve: 16, caminos: plan.calles.map(c => ({puntos: c.puntos, ancho: c.ancho}))});
  const P = buildVillage(seed, bio, era, T, {plan});
  T.actualizar(520, 420); D.escena.add(T.grupo, P.grupo);
  D.bucle((t, cam) => { T.actualizar(cam.position.x, cam.position.z); P.grupo.update(cam); });
  return {T, P, D, plan};
}

root.pueblos3d = {planoPueblo, buildVillage, ESTILOS, BIOMA_ESTILO, pruebaPueblos, demoPueblos, _util: {esquinas, solapan, distPoli}};
})(typeof window !== 'undefined' ? window : globalThis);
