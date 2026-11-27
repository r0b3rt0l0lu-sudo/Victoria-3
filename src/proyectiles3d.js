/* ===== proyectiles3d.js — proyectiles, balística y efectos para la batalla 3D de Victoria (three.js r152, sin texturas) =====
   Física (en u; 1 u ≈ 0,6 m; gravedad y velocidades se convierten desde metros):
   · Bala redonda de cañón: esfera de hierro con resistencia del aire, vuela, BOTA en el suelo (rebote rasante: el componente normal
     se invierte con coeficiente e y el tangencial pierde por rozamiento; si entra muy picada se entierra en suelo blando), rueda y
     se para. Mata a TODOS los que cruza mientras tenga velocidad letal; cada cuerpo le resta un poco de velocidad.
   · Metralla: cono de balines (cada uno es un proyectil ligero que para en el primer cuerpo), con silbidos.
   · Obús / granada: espoleta de tiempo o de impacto → onda expansiva, fragmentos letales radiales, cráter (si hay terreno3d) y columna de humo.
   · Cohete Congreve: empuje durante unos segundos con cabeceo errático, estela de chispas y humo, a veces se desvía o revienta.
   · Bala de fusil (avancarga, Minié, cerrojo; trazadora en la época E): trayectoria con resistencia, para en el primer impacto.
   · Impactos en tierra, madera, piedra y carne (polvo, astillas, chispas, nube oscura pequeña), fogonazo de boca con luz breve.
   · Humo de pólvora persistente que se mueve con el viento y BLOQUEA LA VISIÓN: humo.transmitancia(a, b) ∈ [0,1] para la IA.
   · Retroceso del cañón: retroceso(t, era) → {desplazamiento (u), giroRuedas (rad)}; la pieza de la demo lo usa.
   Detección de impactos: barrido por segmentos (no se salta a nadie aunque vaya rápido). Se puede usar la rejilla incluida
   (RejillaSoldados: cápsulas en una rejilla espacial, consultas ~O(1)) o una función propia consulta(a, b, radio) → [{id, t, material}].
   API: crearProyectiles(escena, op) → S {disparar, fogonazo, explosion, impacto, humo, actualizar(dt), retroceso, stats, vivos}
        PARAM · RejillaSoldados · retroceso(t, era) · pruebaProyectiles() · demoProyectiles(cont) */
(function (root) {
'use strict';
const THREE = root.THREE;
const MU = 1 / 0.6;   // u por metro
function rng(seed) { let a = (seed >>> 0) || 1; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

/* ---------- parámetros físicos por tipo y época (metros, kg, s) ----------
   v0: velocidad inicial; cd·área/masa resumido en k (1/m): a = −k·|v|·v. Valores redondeados de tablas de artillería y armas de la época. */
const PARAM = {
  bala_canon: {A: {masa: 2.72, radio: 0.047, v0: 439, k: 1.1e-4, e: 0.38, roce: 0.80, angRebote: 14, vLetal: 35, perdidaCuerpo: 0.04, nombre: 'bala de 6 libras'},
               B: {masa: 5.44, radio: 0.059, v0: 440, k: 9e-5, e: 0.38, roce: 0.82, angRebote: 14, vLetal: 35, perdidaCuerpo: 0.03, nombre: 'bala de 12 libras (Napoleón)'},
               C: {masa: 6.8, radio: 0.06, v0: 460, k: 8e-5, e: 0.36, roce: 0.82, angRebote: 13, vLetal: 35, perdidaCuerpo: 0.03, nombre: 'bala sólida de práctica'}},
  metralla: {A: {balines: 41, masa: 0.08, radio: 0.019, v0: 400, k: 1.6e-3, cono: 4.5, vLetal: 60, alcance: 350, nombre: 'bote de metralla de 6 libras'},
             B: {balines: 27, masa: 0.2, radio: 0.019, v0: 420, k: 1.1e-3, cono: 4.0, vLetal: 60, alcance: 400, nombre: 'bote de metralla de 12 libras'},
             C: {balines: 300, masa: 0.012, radio: 0.007, v0: 520, k: 2.6e-3, cono: 3.0, vLetal: 70, alcance: 2500, espoleta: 1.6, nombre: 'shrapnel con espoleta de tiempo'}},
  obus: {A: {masa: 5.3, radio: 0.06, v0: 300, k: 1.1e-4, espoleta: 3.0, fragmentos: 40, radioLetal: 9, crater: 1.2, nombre: 'granada esférica (espoleta de tiempo)'},
         B: {masa: 5.9, radio: 0.042, v0: 400, k: 6e-5, impacto: true, fragmentos: 70, radioLetal: 12, crater: 1.5, nombre: 'granada rayada de percusión'},
         C: {masa: 6.5, radio: 0.0375, v0: 500, k: 4.5e-5, impacto: true, fragmentos: 150, radioLetal: 15, crater: 1.8, nombre: 'granada de 75 mm (alto explosivo)'},
         D: {masa: 6.3, radio: 0.0375, v0: 530, k: 4.5e-5, impacto: true, fragmentos: 180, radioLetal: 16, crater: 2.2, nombre: 'granada de 75–77 mm'},
         E: {masa: 6.6, radio: 0.0375, v0: 600, k: 4e-5, impacto: true, fragmentos: 220, radioLetal: 18, crater: 2.5, nombre: 'granada de 75 mm modelo 1930'}},
  cohete: {A: {masa: 5.5, radio: 0.05, v0: 40, empuje: 220, tEmpuje: 2.2, k: 2e-4, errático: 0.35, fallo: 0.08, fragmentos: 30, radioLetal: 8, crater: 1, nombre: 'cohete Congreve de 12 libras'},
           B: {masa: 7, radio: 0.05, v0: 50, empuje: 260, tEmpuje: 2.4, k: 1.8e-4, errático: 0.25, fallo: 0.05, fragmentos: 40, radioLetal: 9, crater: 1.1, nombre: 'cohete Hale'}},
  bala_fusil: {A: {masa: 0.031, radio: 0.0088, v0: 420, k: 2.4e-3, vLetal: 60, nombre: 'mosquete de ánima lisa'},
               B: {masa: 0.032, radio: 0.0074, v0: 300, k: 1.2e-3, vLetal: 60, nombre: 'bala Minié'},
               C: {masa: 0.015, radio: 0.004, v0: 630, k: 1.1e-3, vLetal: 60, nombre: 'fusil de cerrojo (Lebel, Mauser 88)'},
               D: {masa: 0.010, radio: 0.004, v0: 760, k: 1.0e-3, vLetal: 60, nombre: 'fusil de cerrojo con bala puntiaguda'},
               E: {masa: 0.0118, radio: 0.004, v0: 760, k: 1.0e-3, vLetal: 60, trazadora: 0.2, nombre: 'Mauser K98k / Lee-Enfield / M1'}}};
function param(tipo, era) { const P = PARAM[tipo]; if (!P) return null; const e = 'ABCDE'.indexOf(era); for (let i = e; i >= 0; i--) if (P['ABCDE'[i]]) return P['ABCDE'[i]]; return P[Object.keys(P)[0]]; }

/* ---------- retroceso del cañón ----------
   A–B: sin freno de retroceso, toda la cureña retrocede ~1,6–2 m y se para por rozamiento de las ruedas; C+: freno hidroneumático,
   el tubo recula ~1,1 m sobre la cuna y vuelve; la cureña apenas se mueve. */
function retroceso(t, era, rRueda) {
  const e = 'ABCDE'.indexOf(era || 'A'); rRueda = rRueda || 0.7;
  if (e <= 1) { const D = 1.8, T = 0.7; const x = t <= 0 ? 0 : t >= T ? D : D * (1 - Math.pow(1 - t / T, 2.6)); return {desplazamiento: x * MU, tubo: 0, giroRuedas: -x / rRueda}; }
  const D = 1.1, a = t <= 0 ? 0 : t < 0.12 ? D * Math.sin(t / 0.12 * Math.PI / 2) : t < 1.2 ? D * (1 - (t - 0.12) / 1.08) ** 1.6 : 0; return {desplazamiento: 0.05 * MU * Math.min(1, t * 8) * (t < 0.5 ? 1 : 0), tubo: a * MU, giroRuedas: 0};
}

/* ---------- rejilla espacial de soldados como cápsulas verticales ---------- */
function RejillaSoldados(celda) { this.c = celda || 6; this.m = new Map(); this.s = new Map(); }
RejillaSoldados.prototype.clave = function (i, j) { return i * 73856093 ^ j * 19349663; };
RejillaSoldados.prototype.insertar = function (id, x, z, y0, alto, radio, mat) {
  this.quitar(id); const o = {id, x, z, y0, alto, radio: radio || 0.28 * MU, mat: mat || 'carne'}; this.s.set(id, o);
  const i0 = Math.floor((x - o.radio) / this.c), i1 = Math.floor((x + o.radio) / this.c), j0 = Math.floor((z - o.radio) / this.c), j1 = Math.floor((z + o.radio) / this.c); o.k = [];
  for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) { const k = this.clave(i, j); if (!this.m.has(k)) this.m.set(k, []); this.m.get(k).push(o); o.k.push(k); }
};
RejillaSoldados.prototype.quitar = function (id) { const o = this.s.get(id); if (!o) return; o.k.forEach(k => { const L = this.m.get(k); const i = L.indexOf(o); if (i >= 0) L.splice(i, 1); }); this.s.delete(id); };
// segmento a→b con radio r: devuelve los cuerpos tocados ordenados por t ∈ [0,1]
RejillaSoldados.prototype.consulta = function (a, b, r) {
  const out = [], vistos = new Set(), dx = b[0] - a[0], dz = b[2] - a[2], L = Math.hypot(dx, dz), pasos = Math.max(1, Math.ceil(L / (this.c * 0.5)));
  for (let s = 0; s <= pasos; s++) { const x = a[0] + dx * s / pasos, z = a[2] + dz * s / pasos, ci = Math.floor(x / this.c), cj = Math.floor(z / this.c);
    for (let i = ci - 1; i <= ci + 1; i++) for (let j = cj - 1; j <= cj + 1; j++) { const L2 = this.m.get(this.clave(i, j)); if (!L2) continue;
      for (const o of L2) { if (vistos.has(o)) continue; vistos.add(o); const t = segCapsula(a, b, o, r); if (t != null) out.push({id: o.id, t, material: o.mat}); } } }
  return out.sort((p, q) => p.t - q.t);
};
// distancia mínima entre el segmento a-b y el eje de la cápsula (vertical, de y0 a y0+alto); devuelve t de máxima proximidad si toca
function segCapsula(a, b, o, r) {
  const R = o.radio + r, dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], ex = a[0] - o.x, ez = a[2] - o.z, A2 = dx * dx + dz * dz;
  let t = A2 > 1e-9 ? -(ex * dx + ez * dz) / A2 : 0; t = Math.max(0, Math.min(1, t));
  // refina: busca el t en [0,1] que minimiza la distancia 3D al segmento del eje (búsqueda ternaria, la función es convexa)
  const d2 = tt => { const x = a[0] + dx * tt - o.x, y = a[1] + dy * tt, z = a[2] + dz * tt - o.z, yc = Math.min(o.y0 + o.alto, Math.max(o.y0, y)); return x * x + z * z + (y - yc) * (y - yc); };
  let lo = 0, hi = 1; for (let k = 0; k < 40; k++) { const m1 = lo + (hi - lo) / 3, m2 = hi - (hi - lo) / 3; if (d2(m1) < d2(m2)) hi = m2; else lo = m1; }
  t = (lo + hi) / 2; return d2(t) <= R * R ? t : null;
}

/* ===================================================================================== */
function crearProyectiles(escena, op) {
  op = Object.assign({alturaFn: () => 0, materialFn: null, rejilla: null, consulta: null, terreno: null, viento: [1.2, 0, 0.4], semilla: 1, maxParticulas: 6000, maxHumo: 1500, luces: 2,
    alImpactar: null, alAlcanzar: null, alExplotar: null, alEvento: null, sinGraficos: !escena}, op || {});
  const r = rng(op.semilla), G = 9.81 * MU, H = op.alturaFn, vivos = [], eventos = [], traza = op.trazar ? [] : null;
  const consulta = op.consulta || (op.rejilla ? (a, b, rad) => op.rejilla.consulta(a, b, rad) : () => []);
  const matSuelo = (x, z) => op.materialFn ? op.materialFn(x, z) : 'tierra';
  const ev = (nombre, datos) => { const e = Object.assign({nombre}, datos); eventos.push(e); if (eventos.length > 500) eventos.shift(); if (op.alEvento) op.alEvento(e); return e; };
  let sig = 1;

  /* ---------- partículas (Points con sprite procedural en el shader) ---------- */
  const PT = escena ? sistemaParticulas(escena, op.maxParticulas, false) : null, PA = escena ? sistemaParticulas(escena, 2500, true) : null, HU = sistemaHumo(escena, op.maxHumo, op.viento);
  const balas = escena ? new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 8), new THREE.MeshStandardMaterial({color: 0x2a2a2c, roughness: 0.55, metalness: 0.6}), 400) : null;
  if (balas) { balas.count = 0; balas.castShadow = true; balas.frustumCulled = false; balas.name = 'balas'; escena.add(balas); }
  const trazos = escena ? (() => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(2000 * 6), 3)); g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(2000 * 6), 3));
    const m = new THREE.LineSegments(g, new THREE.LineBasicMaterial({vertexColors: true, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false})); m.frustumCulled = false; m.name = 'trazadoras'; escena.add(m); return m; })() : null;
  const ondas = []; const luces = []; if (escena) for (let i = 0; i < op.luces; i++) { const l = new THREE.PointLight(0xffb060, 0, 60 * MU, 2); escena.add(l); luces.push({l, t: 0}); }
  const chispa = (p, v, n, col, tam, vida, grav) => { if (!PA) return; for (let i = 0; i < n; i++) PA.emitir(p, [v[0] + (r() - 0.5) * tam * 30, v[1] + r() * tam * 20, v[2] + (r() - 0.5) * tam * 30], col, tam * (0.5 + r()), vida * (0.6 + r() * 0.8), grav == null ? 1 : grav, 0); };
  const polvo = (p, n, col, tam, vida, sube) => { if (!PT) return; for (let i = 0; i < n; i++) PT.emitir([p[0] + (r() - 0.5) * tam, p[1] + r() * tam * 0.3, p[2] + (r() - 0.5) * tam], [(r() - 0.5) * tam * 2, (sube || 1) * tam * (0.8 + r() * 1.6), (r() - 0.5) * tam * 2], col, tam * (0.6 + r() * 0.8), vida * (0.6 + r() * 0.8), 0.35, 1.6); };

  /* ---------- disparo ---------- */
  function disparar(tipo, era, o, d, x) {
    x = x || {}; const P = param(tipo, era); if (!P) return null; const l = Math.hypot(d[0], d[1], d[2]) || 1, dir = [d[0] / l, d[1] / l, d[2] / l];
    if (tipo === 'metralla') { const ids = []; const n = x.balines || P.balines, cono = (x.cono || P.cono) * Math.PI / 180;
      if (P.espoleta && !x.balin) { return lanzar({tipo: 'shrapnel', P, o, dir, v0: P.v0 * MU, x, era}); }
      for (let i = 0; i < n; i++) { const a = r() * Math.PI * 2, b = Math.sqrt(r()) * cono, u = perp(dir), w = cruz(dir, u), dd = [dir[0] * Math.cos(b) + (u[0] * Math.cos(a) + w[0] * Math.sin(a)) * Math.sin(b), dir[1] * Math.cos(b) + (u[1] * Math.cos(a) + w[1] * Math.sin(a)) * Math.sin(b), dir[2] * Math.cos(b) + (u[2] * Math.cos(a) + w[2] * Math.sin(a)) * Math.sin(b)];
        ids.push(lanzar({tipo: 'balin', P, o: o.slice(), dir: dd, v0: P.v0 * MU * (0.92 + r() * 0.12), x, era})); }
      ev('silbido', {pos: o, dir, n}); fogonazo(o, dir, 1.6); return ids; }
    if (tipo === 'bala_fusil' || tipo === 'bala_canon' || tipo === 'obus' || tipo === 'cohete') { const disp = (x.dispersion || 0) * Math.PI / 180; if (disp) { const u = perp(dir), w = cruz(dir, u), a = r() * 6.283, b = (r() - 0.5) * 2 * disp; for (let k = 0; k < 3; k++) dir[k] = dir[k] * Math.cos(b) + (u[k] * Math.cos(a) + w[k] * Math.sin(a)) * Math.sin(b); } }
    const id = lanzar({tipo, P, o: o.slice(), dir, v0: (x.v0 ? x.v0 : P.v0) * MU, x, era});
    if (tipo !== 'cohete') fogonazo(o, dir, tipo === 'bala_fusil' ? 0.5 : 1.8); else { if (PA) chispa(o, [0, 0, 0], 20, [1, 0.7, 0.3], 0.25, 0.5); HU.emitir(o, 6, 1.6 * MU, 25); }
    return id;
  }
  function lanzar(s) {
    const p = {id: sig++, tipo: s.tipo, era: s.era, P: s.P, pos: s.o.slice(), vel: s.dir.map(c => c * s.v0), t: 0, vivo: true, botes: 0, muertos: [], rodando: false, radio: (s.P.radio || 0.01) * MU, traza: traza ? [s.o.slice()] : null, x: s.x};
    if (s.tipo === 'cohete') { p.fase = r() * 6; p.falla = r() < s.P.fallo; }
    vivos.push(p); ev('disparo', {id: p.id, tipo: s.tipo, pos: s.o.slice()}); return p.id;
  }
  const perp = d => { const a = Math.abs(d[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]; const c = cruz(d, a), l = Math.hypot(...c); return c.map(v => v / l); };
  const cruz = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

  /* ---------- integración ---------- */
  function paso(p, dt) {
    const P = p.P, v = p.vel, sp = Math.hypot(v[0], v[1], v[2]), k = (P.k || 1e-4) / MU;      // k en 1/m → 1/u
    let ax = -k * sp * v[0], ay = -G - k * sp * v[1], az = -k * sp * v[2];
    if (p.tipo === 'cohete' && p.t < P.tEmpuje && !p.reventado) { const f = P.empuje / P.masa * MU, u = [v[0] / sp, v[1] / sp, v[2] / sp], er = P.errático; p.fase += dt * 7;
      ax += f * u[0] + Math.sin(p.fase) * f * er * 0.3; ay += f * u[1] + Math.cos(p.fase * 1.3) * f * er * 0.2 + G * 0.3; az += f * u[2] + Math.cos(p.fase) * f * er * 0.3;
      if (p.falla && p.t > P.tEmpuje * 0.4 && !p.desvio) { p.desvio = true; v[0] += (r() - 0.5) * sp * 0.8; v[1] += r() * sp * 0.4; v[2] += (r() - 0.5) * sp * 0.8; ev('cohete_desviado', {id: p.id, pos: p.pos.slice()}); }
      if (PA && r() < 0.9) chispa(p.pos, [-v[0] * 0.2, -v[1] * 0.2, -v[2] * 0.2], 2, [1, 0.75, 0.35], 0.18, 0.35, 0.3); if (r() < 0.5) HU.emitir(p.pos, 1, 0.9 * MU, 18); }
    v[0] += ax * dt; v[1] += ay * dt; v[2] += az * dt;
    const a = p.pos.slice(), b = [a[0] + v[0] * dt, a[1] + v[1] * dt, a[2] + v[2] * dt];
    // espoleta de tiempo
    if ((P.espoleta && p.tipo !== 'balin') && p.t + dt >= (p.x.espoleta || P.espoleta) && !p.x.impactoSolo) { p.pos = b; detonar(p, b, true); return; }
    // cuerpos tocados en el segmento
    const hits = consulta(a, b, p.radio);
    for (const h of hits) { if (p.muertos.includes(h.id)) continue; const spd = Math.hypot(...v) / MU, hp = [a[0] + (b[0] - a[0]) * h.t, a[1] + (b[1] - a[1]) * h.t, a[2] + (b[2] - a[2]) * h.t];
      if (p.tipo === 'obus' || p.tipo === 'cohete') { if (P.impacto || p.tipo === 'cohete') { p.pos = hp; detonar(p, hp, false); return; } }
      if (spd < (P.vLetal || 40)) break;
      p.muertos.push(h.id); ev('alcanzado', {id: p.id, objetivo: h.id, pos: hp, tipo: p.tipo, velocidad: spd}); if (op.alAlcanzar) op.alAlcanzar({id: h.id, proyectil: p.tipo, pos: hp, velocidad: spd});
      impacto(hp, [-v[0] / sp, -v[1] / sp, -v[2] / sp], h.material || 'carne', 0.6);
      if (p.tipo === 'bala_canon') { const f = 1 - P.perdidaCuerpo; v[0] *= f; v[1] *= f; v[2] *= f; }
      else { p.vivo = false; p.pos = hp; if (p.traza) p.traza.push(hp); return; } }
    // suelo
    const hb = H(b[0], b[2]);
    if (b[1] <= hb + p.radio) {
      let lo = 0, hi = 1; for (let i = 0; i < 14; i++) { const m = (lo + hi) / 2, x = a[0] + (b[0] - a[0]) * m, y = a[1] + (b[1] - a[1]) * m, z = a[2] + (b[2] - a[2]) * m; if (y <= H(x, z) + p.radio) hi = m; else lo = m; }
      const q = [a[0] + (b[0] - a[0]) * hi, 0, a[2] + (b[2] - a[2]) * hi]; q[1] = H(q[0], q[2]) + p.radio; p.pos = q; if (p.traza) p.traza.push(q.slice());
      sueloToca(p, q); return; }
    p.pos = b; if (p.traza && (p.traza.length < 2 || p.t % 0.05 < dt)) p.traza.push(b.slice());
    if (p.tipo === 'bala_canon' && PT && r() < 0.25) PT.emitir(b, [0, 0.3, 0], [0.55, 0.55, 0.55], 0.35 * MU, 0.6, 0, 1.2);
  }
  function normalSuelo(x, z) { const e = 0.5; const hx = H(x + e, z) - H(x - e, z), hz = H(x, z + e) - H(x, z - e), l = Math.hypot(hx, 2 * e, hz); return [-hx / l, 2 * e / l, -hz / l]; }
  function sueloToca(p, q) {
    const P = p.P, v = p.vel, n = normalSuelo(q[0], q[2]), sp = Math.hypot(...v), vn = v[0] * n[0] + v[1] * n[1] + v[2] * n[2], ang = Math.asin(Math.min(1, -vn / sp)) * 180 / Math.PI, mat = matSuelo(q[0], q[2]);
    if (p.tipo === 'obus' || p.tipo === 'cohete' || p.tipo === 'shrapnel') { detonar(p, q, false); return; }
    impacto(q, n, mat, p.tipo === 'bala_canon' ? 2.2 : 0.5);
    if (p.tipo === 'bala_canon') {
      const blando = mat === 'barro' || mat === 'nieve', limite = P.angRebote * (mat === 'piedra' || mat === 'camino' ? 1.6 : blando ? 0.45 : 1);
      p.botes++; ev('bote', {id: p.id, pos: q.slice(), angulo: ang, velocidad: sp / MU, material: mat});
      if (op.terreno && op.terreno.marcar) op.terreno.marcar(q[0], q[2], 1.2 * MU, 0.6);
      if (ang > limite || sp / MU < 12) {                               // entra picada o ya va despacio: se entierra o rueda hasta pararse
        if (ang > limite && sp / MU > 60) { p.vivo = false; ev('enterrada', {id: p.id, pos: q.slice()}); return; }
        p.rodando = true; v[1] = 0; const f = 0.5; v[0] *= f; v[2] *= f; if (Math.hypot(v[0], v[2]) / MU < 2) { p.vivo = false; ev('parada', {id: p.id, pos: q.slice()}); } return; }
      const e = P.e * (blando ? 0.6 : 1), roce = P.roce * (blando ? 0.8 : 1);
      for (let k = 0; k < 3; k++) { const vnk = vn * n[k]; v[k] = (v[k] - vnk) * roce - vnk * e; }
      v[0] += (r() - 0.5) * sp * 0.04; v[2] += (r() - 0.5) * sp * 0.04;      // desvío lateral por terrones
      p.pos[1] += 0.02;
    } else { p.vivo = false; }
  }
  function detonar(p, q, aire) { p.vivo = false; explosion(q, {radioLetal: p.P.radioLetal, fragmentos: p.P.fragmentos, crater: aire ? 0 : p.P.crater, aire, tipo: p.tipo, era: p.era, shrapnel: p.tipo === 'shrapnel' ? p : null}); }

  /* ---------- efectos ---------- */
  function fogonazo(p, d, esc) {
    esc = esc || 1; if (PA) { for (let i = 0; i < 8; i++) { const f = 0.3 + r() * 1.4; PA.emitir([p[0] + d[0] * f * esc, p[1] + d[1] * f * esc, p[2] + d[2] * f * esc], [d[0] * 8 * esc, d[1] * 8 * esc + 1, d[2] * 8 * esc], [1, 0.72 + r() * 0.2, 0.35], (0.6 + r() * 0.9) * esc * MU, 0.07 + r() * 0.06, 0, 0); } }
    HU.emitir([p[0] + d[0] * esc * 2, p[1] + d[1] * esc * 2, p[2] + d[2] * esc * 2], Math.round(4 * esc), 1.2 * esc * MU, 40 + r() * 30, [d[0] * 6 * esc, d[1] * 3 * esc + 0.5, d[2] * 6 * esc]);
    const L = luces.find(l => l.t <= 0) || luces[0]; if (L) { L.l.position.set(p[0], p[1] + 1, p[2]); L.l.intensity = 6 * esc; L.t = 0.07; }
    ev('fogonazo', {pos: p.slice(), escala: esc});
  }
  const COL = {tierra: [0.45, 0.36, 0.25], barro: [0.32, 0.26, 0.2], piedra: [0.62, 0.6, 0.56], madera: [0.55, 0.4, 0.25], carne: [0.28, 0.1, 0.08], nieve: [0.92, 0.93, 0.95], camino: [0.55, 0.45, 0.32], agua: [0.7, 0.75, 0.8]};
  function impacto(p, n, mat, esc) {
    esc = esc || 1; const c = COL[mat] || COL.tierra;
    if (mat === 'piedra' && PA) chispa(p, n.map(x => x * 3), 6, [1, 0.8, 0.45], 0.12, 0.25);
    if (mat === 'madera' && PT) for (let i = 0; i < 6 * esc; i++) PT.emitir(p, [n[0] * 6 + (r() - 0.5) * 8, n[1] * 6 + r() * 6, n[2] * 6 + (r() - 0.5) * 8], [0.62, 0.46, 0.28], 0.12 * MU, 0.8, 1, 0.3);
    if (mat === 'carne') { if (PT) for (let i = 0; i < 4; i++) PT.emitir(p, [n[0] * 1.5 + (r() - 0.5), n[1] * 1.5 + r(), n[2] * 1.5 + (r() - 0.5)], c, 0.35 * MU, 0.4, 0.2, 1.5); }
    else polvo(p, Math.round(5 * esc), c, 0.6 * esc * MU, 0.9 + esc * 0.4, mat === 'agua' ? 3 : 1);
    ev('impacto', {pos: p.slice(), material: mat}); if (op.alImpactar) op.alImpactar({pos: p, normal: n, material: mat});
  }
  function explosion(q, o) {
    o = o || {}; const RL = (o.radioLetal || 10) * MU, nf = o.fragmentos || 60;
    // fragmentos: segmentos radiales con alcance letal; cada uno para en el primer cuerpo (también se emiten partículas oscuras)
    const muertos = new Set();
    if (o.shrapnel) {   // shrapnel: en el aire, cono de balines hacia delante
      const pp = o.shrapnel, v = pp.vel, sp = Math.hypot(...v); disparar('metralla', 'A', q, [v[0] / sp, v[1] / sp, v[2] / sp], {balines: Math.min(120, pp.P.balines), cono: 9, balin: true}); }
    else for (let i = 0; i < nf; i++) { const a = r() * 6.283, el = (r() * 0.9 - 0.15) * Math.PI / 2, d = [Math.cos(el) * Math.cos(a), Math.sin(el), Math.cos(el) * Math.sin(a)], alc = RL * (0.5 + r() * 0.9), b = [q[0] + d[0] * alc, q[1] + 0.3 + d[1] * alc, q[2] + d[2] * alc];
      const hs = consulta([q[0], q[1] + 0.3, q[2]], b, 0.02 * MU); if (hs.length) { const h = hs[0]; if (!muertos.has(h.id)) { muertos.add(h.id); ev('alcanzado', {id: -1, objetivo: h.id, pos: b, tipo: 'fragmento'}); if (op.alAlcanzar) op.alAlcanzar({id: h.id, proyectil: 'fragmento', pos: b}); } }
      if (PT && i % 3 === 0) PT.emitir([q[0], q[1] + 0.5, q[2]], [d[0] * 40, d[1] * 40 + 8, d[2] * 40], [0.15, 0.13, 0.12], 0.12 * MU, 0.5, 1.2, 0); }
    // destello, tierra levantada, columna de humo, onda
    if (PA) for (let i = 0; i < 14; i++) PA.emitir([q[0], q[1] + 1, q[2]], [(r() - 0.5) * 30, r() * 20, (r() - 0.5) * 30], [1, 0.65, 0.3], (1.5 + r() * 2.5) * MU, 0.12 + r() * 0.12, 0, 0);
    if (!o.aire) { polvo(q, 26, COL[matSuelo(q[0], q[2])] || COL.tierra, 2.2 * MU, 2.4, 2.2); if (o.crater && op.terreno && op.terreno.deformar) op.terreno.deformar(q[0], q[2], o.crater * MU * 1.6, o.crater * MU * 0.6); }
    HU.emitir([q[0], q[1] + 2, q[2]], o.aire ? 8 : 14, (o.aire ? 3 : 2.4) * MU, 60 + r() * 40, [0, 2.5, 0]);
    if (escena) { const m = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 32), new THREE.MeshBasicMaterial({color: 0xfff0d0, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false})); m.rotation.x = -Math.PI / 2; m.position.set(q[0], q[1] + 0.4, q[2]); escena.add(m); ondas.push({m, t: 0, R: RL * 1.3}); }
    const L = luces.find(l => l.t <= 0) || luces[0]; if (L) { L.l.position.set(q[0], q[1] + 3, q[2]); L.l.intensity = 25; L.t = 0.15; }
    const e = ev('explosion', {pos: q.slice(), radio: RL, muertos: [...muertos], aire: !!o.aire}); if (op.alExplotar) op.alExplotar(e); return e;
  }

  /* ---------- bucle ---------- */
  const _m = new THREE.Matrix4();
  function actualizar(dt) {
    dt = Math.min(0.05, dt); const sub = 4;
    for (let i = vivos.length - 1; i >= 0; i--) { const p = vivos[i];
      if (p.rodando) { const v = p.vel; p.pos[0] += v[0] * dt; p.pos[2] += v[2] * dt; p.pos[1] = H(p.pos[0], p.pos[2]) + p.radio; const f = Math.max(0, 1 - dt * 1.6); v[0] *= f; v[2] *= f;
        const hits = consulta(p.pos, [p.pos[0] + v[0] * dt, p.pos[1], p.pos[2] + v[2] * dt], p.radio); hits.forEach(h => { if (!p.muertos.includes(h.id) && Math.hypot(v[0], v[2]) / MU > 8) { p.muertos.push(h.id); ev('alcanzado', {id: p.id, objetivo: h.id, pos: p.pos.slice(), tipo: 'bala_rodando'}); if (op.alAlcanzar) op.alAlcanzar({id: h.id, proyectil: 'bala_rodando', pos: p.pos}); } });
        if (Math.hypot(v[0], v[2]) / MU < 1.5) { p.vivo = false; ev('parada', {id: p.id, pos: p.pos.slice()}); } }
      else { const h = dt / sub; for (let s = 0; s < sub && p.vivo; s++) { paso(p, h); p.t += h; } }
      if (!p.vivo || p.t > 30) { if (p.traza) traza.push({id: p.id, tipo: p.tipo, puntos: p.traza, muertos: p.muertos}); vivos.splice(i, 1); } }
    if (PT) PT.actualizar(dt, op.viento); if (PA) PA.actualizar(dt, op.viento); HU.actualizar(dt);
    for (let i = ondas.length - 1; i >= 0; i--) { const o = ondas[i]; o.t += dt; const k = o.t / 0.35; o.m.scale.setScalar(Math.max(0.01, k * o.R)); o.m.material.opacity = 0.5 * (1 - k); if (k >= 1) { escena.remove(o.m); o.m.geometry.dispose(); o.m.material.dispose(); ondas.splice(i, 1); } }
    luces.forEach(L => { if (L.t > 0) { L.t -= dt; L.l.intensity *= 0.7; if (L.t <= 0) L.l.intensity = 0; } });
    if (balas) { let n = 0; vivos.forEach(p => { if (p.tipo === 'bala_canon' || p.tipo === 'obus' || p.tipo === 'cohete' || p.tipo === 'shrapnel') { const s = Math.max(p.radio, 0.06 * MU) * (p.tipo === 'cohete' ? 1.4 : 1); _m.makeScale(s, s, s).setPosition(p.pos[0], p.pos[1], p.pos[2]); balas.setMatrixAt(n++, _m); } }); balas.count = n; balas.instanceMatrix.needsUpdate = true; }
    if (trazos) { const P = trazos.geometry.attributes.position.array, C = trazos.geometry.attributes.color.array; let n = 0;
      vivos.forEach(p => { if (p.tipo !== 'bala_fusil' && p.tipo !== 'balin') return; if (n >= 2000) return; const v = p.vel, sp = Math.hypot(...v), L = Math.min(sp * 0.02, 6 * MU), tr = p.P.trazadora && (p.id % 5 === 0);
        const c = tr ? [1, 0.45, 0.2] : [0.9, 0.85, 0.7], k = tr ? 1 : 0.35; P.set([p.pos[0], p.pos[1], p.pos[2], p.pos[0] - v[0] / sp * L, p.pos[1] - v[1] / sp * L, p.pos[2] - v[2] / sp * L], n * 6); C.set([c[0] * k, c[1] * k, c[2] * k, 0, 0, 0], n * 6); n++; });
      trazos.geometry.setDrawRange(0, n * 2); trazos.geometry.attributes.position.needsUpdate = true; trazos.geometry.attributes.color.needsUpdate = true; }
  }
  function stats() { return {vivos: vivos.length, particulas: PT ? PT.vivas() + PA.vivas() : 0, humo: HU.vivas(), eventos: eventos.length}; }
  return {disparar, fogonazo, explosion, impacto, humo: HU, actualizar, retroceso, stats, vivos, eventos, trazas: traza, PARAM, param};
}

/* ---------- sistema de partículas: un único Points; sprite redondo calculado en el sombreador ---------- */
function sistemaParticulas(escena, N, aditivo) {
  const pos = new Float32Array(N * 3), col = new Float32Array(N * 4), tam = new Float32Array(N), D = [];
  for (let i = 0; i < N; i++) D.push({vida: 0, max: 1, v: [0, 0, 0], g: 0, crece: 0, t0: 1, a0: 1});
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 4)); g.setAttribute('tam', new THREE.BufferAttribute(tam, 1));
  const m = new THREE.ShaderMaterial({transparent: true, depthWrite: false, blending: aditivo ? THREE.AdditiveBlending : THREE.NormalBlending, uniforms: {uEsc: {value: 600}},
    vertexShader: 'attribute vec4 color; attribute float tam; varying vec4 vC; uniform float uEsc; void main(){ vC = color; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = tam * uEsc / max(1.0, -mv.z); gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'varying vec4 vC; void main(){ vec2 d = gl_PointCoord - 0.5; float r = length(d) * 2.0; if (r > 1.0) discard; float a = vC.a * (1.0 - r * r) ' + (aditivo ? '' : '* (0.6 + 0.4 * (1.0 - r))') + '; gl_FragColor = vec4(vC.rgb, a); }'});
  const pts = new THREE.Points(g, m); pts.frustumCulled = false; pts.renderOrder = aditivo ? 3 : 2; pts.name = aditivo ? 'chispas' : 'particulas'; escena.add(pts);
  let cur = 0, n = 0;
  return {
    emitir(p, v, c, s, vida, grav, crece) { const i = cur; cur = (cur + 1) % N; const d = D[i]; d.vida = vida; d.max = vida; d.v = v.slice(); d.g = grav || 0; d.crece = crece || 0; d.t0 = s; pos.set(p, i * 3); col.set([c[0], c[1], c[2], 1], i * 4); tam[i] = s; },
    actualizar(dt, viento) { n = 0; const G = 9.81 * MU; for (let i = 0; i < N; i++) { const d = D[i]; if (d.vida <= 0) { if (col[i * 4 + 3] !== 0) col[i * 4 + 3] = 0; continue; } n++; d.vida -= dt; const k = 1 - d.vida / d.max;
        d.v[1] -= G * d.g * dt; const arr = d.crece ? 1.2 : 0.2; d.v[0] += ((viento ? viento[0] : 0) - d.v[0]) * arr * dt * (d.crece ? 1 : 0); d.v[2] += ((viento ? viento[2] : 0) - d.v[2]) * arr * dt * (d.crece ? 1 : 0); d.v.forEach((_, q) => { d.v[q] *= 1 - Math.min(0.9, dt * (d.crece ? 1.5 : 0.3)); });
        pos[i * 3] += d.v[0] * dt; pos[i * 3 + 1] += d.v[1] * dt; pos[i * 3 + 2] += d.v[2] * dt; tam[i] = d.t0 * (1 + d.crece * k); col[i * 4 + 3] = Math.max(0, (1 - k) * (aditivo ? 1 : 0.85)); }
      g.attributes.position.needsUpdate = true; g.attributes.color.needsUpdate = true; g.attributes.tam.needsUpdate = true; },
    vivas: () => n};
}

/* ---------- humo de pólvora persistente: bocanadas grandes en una rejilla espacial; densidad y transmitancia para la línea de vista ---------- */
function sistemaHumo(escena, N, viento) {
  const B = [], celda = 12 * MU, rej = new Map();
  let pts = null, pos, col, tam;
  if (escena) { pos = new Float32Array(N * 3); col = new Float32Array(N * 4); tam = new Float32Array(N); const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 4)); g.setAttribute('tam', new THREE.BufferAttribute(tam, 1));
    const m = new THREE.ShaderMaterial({transparent: true, depthWrite: false, uniforms: {uEsc: {value: 600}},
      vertexShader: 'attribute vec4 color; attribute float tam; varying vec4 vC; varying float vS; uniform float uEsc; void main(){ vC = color; vS = position.x * 0.13 + position.z * 0.07; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = tam * uEsc / max(1.0, -mv.z); gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'varying vec4 vC; varying float vS; void main(){ vec2 d = gl_PointCoord - 0.5; float r = length(d) * 2.0; if (r > 1.0) discard; float n = 0.75 + 0.25 * sin(d.x * 9.0 + vS) * sin(d.y * 7.0 - vS); float a = vC.a * smoothstep(1.0, 0.25, r) * n; gl_FragColor = vec4(vC.rgb * (0.85 + 0.25 * (0.5 - d.y)), a); }'});
    pts = new THREE.Points(g, m); pts.frustumCulled = false; pts.renderOrder = 1; pts.name = 'humo_polvora'; escena.add(pts); }
  let cur = 0;
  const clave = (x, z) => Math.floor(x / celda) * 92821 + Math.floor(z / celda);
  function emitir(p, n, tam0, vida, v) { for (let k = 0; k < n; k++) { const i = cur; cur = (cur + 1) % N; B[i] = {p: [p[0] + (Math.random() - 0.5) * tam0, p[1] + Math.random() * tam0 * 0.4, p[2] + (Math.random() - 0.5) * tam0], v: v ? [v[0] * (0.5 + Math.random()), v[1] * (0.5 + Math.random()), v[2] * (0.5 + Math.random())] : [0, 0.4, 0], r: tam0 * (0.6 + Math.random() * 0.6), vida, max: vida, gris: 0.72 + Math.random() * 0.18}; } }
  function actualizar(dt) {
    rej.clear(); const w = viento || [1, 0, 0];
    for (let i = 0; i < N; i++) { const b = B[i]; if (!b || b.vida <= 0) { if (pts && col[i * 4 + 3]) col[i * 4 + 3] = 0; continue; }
      b.vida -= dt; const k = 1 - b.vida / b.max; b.v[0] += (w[0] - b.v[0]) * dt * 0.5; b.v[2] += (w[2] - b.v[2]) * dt * 0.5; b.v[1] *= 1 - dt * 0.4; b.p[0] += b.v[0] * dt; b.p[1] += (b.v[1] + 0.15) * dt; b.p[2] += b.v[2] * dt; b.R = b.r * (1 + k * 2.5); b.den = 0.6 * (1 - k) ** 1.5;
      const key = clave(b.p[0], b.p[2]); if (!rej.has(key)) rej.set(key, []); rej.get(key).push(b);
      if (pts) { pos.set(b.p, i * 3); col.set([b.gris, b.gris, b.gris * 1.02, Math.min(0.55, b.den)], i * 4); tam[i] = b.R * 2.2; } }
    if (pts) { pts.geometry.attributes.position.needsUpdate = true; pts.geometry.attributes.color.needsUpdate = true; pts.geometry.attributes.tam.needsUpdate = true; }
  }
  function densidad(x, y, z) { let d = 0; const ci = Math.floor(x / celda), cj = Math.floor(z / celda);
    for (let i = ci - 1; i <= ci + 1; i++) for (let j = cj - 1; j <= cj + 1; j++) { const L = rej.get(i * 92821 + j); if (!L) continue; for (const b of L) { const q = ((x - b.p[0]) ** 2 + (y - b.p[1]) ** 2 + (z - b.p[2]) ** 2) / (b.R * b.R); if (q < 4) d += b.den * Math.exp(-q * 1.5) / b.R; } } return d; }
  // fracción de luz que pasa de a a b (1 = limpio, 0 = opaco); úsala en la IA: si es < 0,3 el tirador no ve al objetivo
  function transmitancia(a, b, paso) { const L = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]); paso = paso || 2 * MU; const n = Math.max(1, Math.ceil(L / paso)); let tau = 0;
    for (let i = 0; i < n; i++) { const t = (i + 0.5) / n; tau += densidad(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t) * (L / n) * 1.6; } return Math.exp(-tau); }
  return {emitir, actualizar, densidad, transmitancia, vivas: () => B.filter(b => b && b.vida > 0).length};
}

/* ---------- prueba sin WebGL (P3) ---------- */
function pruebaProyectiles() {
  const res = {};
  // 1) bala redonda que cruza una fila: mata exactamente a los cuerpos cuya cápsula corta su trayectoria
  const R = new RejillaSoldados(6), ids = [];
  // columna en fila de a tres (hileras a lo largo de x, 0,9 m entre hombres, 0,95 m entre hileras): la bala entra en enfilada por la hilera central
  for (let f = 0; f < 3; f++) for (let i = 0; i < 30; i++) { const id = f * 100 + i, x = 200 + i * 0.9 * MU, z = 100 + (f - 1) * 0.95 * MU; R.insertar(id, x, z, 0, 1.75 * MU, 0.25 * MU); ids.push(id); }
  const S = crearProyectiles(null, {rejilla: R, trazar: true, semilla: 3});
  const o = [100, 1.2 * MU, 100.05], d = [1, 0.0, 0.0015];
  S.disparar('bala_canon', 'A', o, d); for (let k = 0; k < 400 && S.vivos.length; k++) S.actualizar(0.02);
  const tr = S.trazas[0], esperado = [];
  ids.forEach(id => { const c = R.s.get(id); for (let i = 0; i < tr.puntos.length - 1; i++) { if (segCapsula(tr.puntos[i], tr.puntos[i + 1], c, (PARAM.bala_canon.A.radio) * MU) != null) { esperado.push(id); break; } } });
  const muertos = tr.muertos.slice().sort((a, b) => a - b), esp = esperado.sort((a, b) => a - b);
  res.filaMuertos = muertos; res.filaEsperado = esp; res.filaExacta = JSON.stringify(muertos) === JSON.stringify(esp) && muertos.length >= 3;
  // 2) rebote: tiro rasante sobre llano → varios botes y la bala acaba parada o enterrada
  const S2 = crearProyectiles(null, {semilla: 5}); S2.disparar('bala_canon', 'B', [0, 2 * MU, 0], [1, 0.035, 0]); for (let k = 0; k < 2000 && S2.vivos.length; k++) S2.actualizar(0.02);
  const botes = S2.eventos.filter(e => e.nombre === 'bote'); res.botes = botes.length; res.velocidadesBote = botes.map(b => Math.round(b.velocidad)); res.alcanceM = Math.round((S2.eventos.filter(e => e.nombre === 'parada' || e.nombre === 'enterrada')[0] || {pos: [0]}).pos[0] / MU);
  res.rebotaBien = botes.length >= 2 && res.velocidadesBote.every((v, i, A) => i === 0 || v < A[i - 1]);
  // 3) fusil: para en el primer cuerpo
  const R3 = new RejillaSoldados(); [0, 1, 2].forEach(i => R3.insertar(i, 50 + i * 2 * MU, 0, 0, 1.75 * MU, 0.25 * MU)); const S3 = crearProyectiles(null, {rejilla: R3}); S3.disparar('bala_fusil', 'D', [0, 1.3 * MU, 0], [1, 0, 0]); for (let k = 0; k < 100 && S3.vivos.length; k++) S3.actualizar(0.02);
  res.fusilSoloPrimero = JSON.stringify(S3.eventos.filter(e => e.nombre === 'alcanzado').map(e => e.objetivo)) === '[0]';
  // 4) obús: explota al tocar el suelo y alcanza a cuerpos cercanos, no a los lejanos
  const R4 = new RejillaSoldados(); for (let i = 0; i < 20; i++) R4.insertar(i, 600 + (i % 5) * 3 * MU, (Math.floor(i / 5) - 2) * 3 * MU, 0, 1.75 * MU, 0.25 * MU); R4.insertar(99, 600 + 60 * MU, 0, 0, 1.75 * MU, 0.25 * MU);
  const S4 = crearProyectiles(null, {rejilla: R4, semilla: 9}); S4.explosion([606 * 1, 0, 0], {radioLetal: 15, fragmentos: 200});
  const ex = S4.eventos.find(e => e.nombre === 'explosion'); res.obusAlcanzados = ex.muertos.length; res.obusNoLejos = !ex.muertos.includes(99);
  // 5) humo: la transmitancia cae al atravesar una nube
  const S5 = crearProyectiles(null, {}); const a = [0, 1.5 * MU, 0], b = [100 * MU, 1.5 * MU, 0]; S5.actualizar(0.01); const t0 = S5.humo.transmitancia(a, b);
  for (let i = 0; i < 6; i++) S5.fogonazo([30 * MU + i * 6 * MU, 1.5 * MU, 0], [1, 0, 0], 2); S5.actualizar(0.5); const t1 = S5.humo.transmitancia(a, b);
  res.transmitancia = [+t0.toFixed(2), +t1.toFixed(2)]; res.humoTapa = t0 > 0.99 && t1 < 0.5;
  // 6) metralla: los balines salen en cono y alcanzan a varios
  const R6 = new RejillaSoldados(); for (let i = 0; i < 40; i++) R6.insertar(i, 120 * MU, (i - 20) * 0.95 * MU, 0, 1.75 * MU, 0.25 * MU); const S6 = crearProyectiles(null, {rejilla: R6, semilla: 2}); S6.disparar('metralla', 'B', [0, 1.1 * MU, 0], [1, 0.0, 0]); for (let k = 0; k < 200 && S6.vivos.length; k++) S6.actualizar(0.02);
  res.metrallaAlcanzados = new Set(S6.eventos.filter(e => e.nombre === 'alcanzado').map(e => e.objetivo)).size;
  res.retroceso = ['A', 'C'].map(e => { const r0 = retroceso(0.7, e); return [e, +(r0.desplazamiento / MU).toFixed(2), +(r0.tubo / MU).toFixed(2), +r0.giroRuedas.toFixed(2)]; });
  res.ok = res.filaExacta && res.rebotaBien && res.fusilSoloPrimero && res.obusAlcanzados > 0 && res.obusNoLejos && res.humoTapa && res.metrallaAlcanzados >= 3;
  return res;
}

/* ---------- demostración: una batería dispara bala rasa, metralla, obuses y cohetes contra filas de blancos ---------- */
function demoProyectiles(cont) {
  const T3 = root.terreno3d; const D = T3.baseDemo(cont || document.body, {cam: [120, 40, 210], obj: [200, 4, 140], sombra: 250});
  const T = T3.crearTerreno({ancho: 640, fondo: 320, semilla: 2, relieve: 4}); T.actualizar(200, 160); D.escena.add(T.grupo);
  const R = new RejillaSoldados(), blancos = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.25 * MU, 0.25 * MU, 1.75 * MU, 8).translate(0, 0.875 * MU, 0), new THREE.MeshLambertMaterial({color: 0x3a4a7a}), 240);
  let n = 0; const vivos = new Map(); for (let f = 0; f < 4; f++) for (let i = 0; i < 60; i++) { const x = 330 + f * 2.5 * MU, z = 100 + i * 0.95 * MU, y = T.heightAt(x, z); R.insertar(n, x, z, y, 1.75 * MU, 0.25 * MU); vivos.set(n, [x, y, z]); n++; }
  const actBlancos = () => { let i = 0; const m = new THREE.Matrix4(); vivos.forEach(([x, y, z], id) => { m.makeTranslation(x, y, z); blancos.setMatrixAt(i++, m); }); blancos.count = i; blancos.instanceMatrix.needsUpdate = true; }; actBlancos(); blancos.castShadow = true; D.escena.add(blancos);
  const S = crearProyectiles(D.escena, {alturaFn: T.heightAt, rejilla: R, terreno: T, alAlcanzar: h => { if (vivos.delete(h.id)) { R.quitar(h.id); actBlancos(); } }});
  // pieza: cureña, ruedas y tubo; retrocede con cada disparo
  const pieza = new THREE.Group(), tubo = new THREE.Mesh(new THREE.CylinderGeometry(0.11 * MU, 0.16 * MU, 2.2 * MU, 12).rotateZ(-Math.PI / 2).translate(1.0 * MU, 0, 0), new THREE.MeshStandardMaterial({color: 0x6a5a30, metalness: 0.7, roughness: 0.4}));
  const cur = new THREE.Mesh(new THREE.BoxGeometry(2.6 * MU, 0.3 * MU, 0.5 * MU).translate(-0.8 * MU, -0.2 * MU, 0), new THREE.MeshLambertMaterial({color: 0x4a5a3a})); tubo.position.y = 1.1 * MU; cur.position.y = 1.1 * MU; pieza.add(tubo, cur);
  const ruedas = [-1, 1].map(s => { const w = new THREE.Mesh(new THREE.TorusGeometry(0.62 * MU, 0.06 * MU, 6, 16), new THREE.MeshLambertMaterial({color: 0x3a2a1a})); w.position.set(0, 0.68 * MU, s * 0.6 * MU); pieza.add(w); return w; });
  const px = 150, pz = 150; pieza.position.set(px, T.heightAt(px, pz), pz); D.escena.add(pieza); pieza.traverse(o => { o.castShadow = true; });
  let tDisp = -1, cola = 0, ultimo = 0; const orden = ['bala_canon', 'metralla', 'obus', 'bala_canon', 'cohete', 'bala_fusil'];
  D.bucle((t, cam) => { const dt = Math.min(0.05, t - ultimo); ultimo = t;
    if (t - tDisp > 2.4) { tDisp = t; const tipo = orden[cola++ % orden.length], o = [px + 2.2 * MU, pieza.position.y + 1.1 * MU, pz], z = 120 + Math.random() * 40;
      const dir = tipo === 'obus' ? [1, 0.12, (z - pz) / 400] : tipo === 'cohete' ? [1, 0.08, (z - pz) / 300] : tipo === 'metralla' ? [1, 0.005, (z - pz) / 200] : [1, 0.012, (z - pz) / 250];
      if (tipo === 'bala_fusil') for (let k = 0; k < 12; k++) S.disparar('bala_fusil', 'E', [o[0], o[1] - 0.6 * MU, o[2] + (k - 6) * 2], [1, 0.004, (z - pz) / 250], {dispersion: 0.6}); else S.disparar(tipo, tipo === 'cohete' ? 'A' : 'B', o, dir); }
    const rc = retroceso(t - tDisp, 'B'); pieza.position.x = px - rc.desplazamiento; ruedas.forEach(w => { w.rotation.z = rc.giroRuedas; }); pieza.position.y = T.heightAt(pieza.position.x, pz);
    if (t - tDisp > 2.3) pieza.position.x = px;
    S.actualizar(dt); T.actualizar(cam.position.x, cam.position.z); });
  return {S, T, D, R};
}

root.proyectiles3d = {crearProyectiles, PARAM, param, RejillaSoldados, retroceso, segCapsula, pruebaProyectiles, demoProyectiles};
})(typeof window !== 'undefined' ? window : globalThis);
