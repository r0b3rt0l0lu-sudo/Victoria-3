/* ===== terreno3d.js — terreno por chunks para la batalla 3D de Victoria (three.js r152, sin texturas externas) =====
   · Campo de alturas único en una rejilla fina (2 u por defecto). Los chunks cercanos se mallan a 2 u y los lejanos a 8 u, todos a partir
     del mismo campo: las normales salen del gradiente del campo, así que no hay costuras de luz entre chunks de distinto detalle. Cada chunk
     lleva un faldón vertical que tapa las grietas entre resoluciones.
   · heightAt(x, z) interpola sobre los mismos triángulos que la malla fina (diagonal fija), así que en la zona activa coincide exactamente
     con lo que se ve: los pies, las cajas de las casas y las balas usan la misma altura que el dibujo.
   · Material procedural triplanar (MeshStandardMaterial + onBeforeCompile): hierba, tierra, barro con charcos, roca, camino con rodadas
     y nieve, mezclados por pesos por vértice; humedad global (lluvia) y por zona; huellas y quemado dinámicos. Recibe y proyecta sombras.
   · Utilidades: aplanar(…) plataformas para edificios, excavarTrinchera(…), deformar(…) cráteres, marcar(…) huellas, rayo(…) línea de vista.
   Unidades: u del campo (1 u ≈ 0,6 m). Ejes: x derecha, y arriba, z hacia el espectador.
   API: crearTerreno(opts) → T  ·  T.heightAt(x,z) · T.normalAt(x,z) · T.pesosEn(x,z) · T.aplanar(cx,cz,w,d,rot,margen,altura)
        T.excavarTrinchera(puntos, ancho, prof, opts) · T.deformar(x,z,radio,prof,borde) · T.marcar(x,z,radio,int,tipo) · T.rayo(o,d,max)
        T.actualizar(camX, camZ) · T.grupo · T.material · T.stats() · T.liberar()
   Demostración: demoTerreno(contenedor). Pruebas: pruebaTerreno() (sin WebGL). */
(function (root) {
'use strict';
const THREE = root.THREE;

/* ---------- ruido y azar deterministas ---------- */
function rng(seed) { let a = (seed >>> 0) || 1; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function hash2(i, j, s) { let h = Math.imul(i, 374761393) + Math.imul(j, 668265263) + Math.imul(s, 2147483647); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
function vnoise(x, z, s) { const i = Math.floor(x), j = Math.floor(z), fx = x - i, fz = z - j, u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  const a = hash2(i, j, s), b = hash2(i + 1, j, s), c = hash2(i, j + 1, s), d = hash2(i + 1, j + 1, s); return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; }
function fbm(x, z, s, oct) { let a = 0, f = 1, w = 0.5, n = 0; for (let o = 0; o < (oct || 5); o++) { a += w * vnoise(x * f, z * f, s + o * 17); n += w; f *= 2.03; w *= 0.5; } return a / n; }
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/* ---------- materiales: índices de canal ---------- */
// pesoA = hierba, tierra, barro, roca · pesoB = camino, nieve, humedad, huella/quemado
const CANAL = {hierba: 0, tierra: 1, barro: 2, roca: 3, camino: 4, nieve: 5, humedad: 6, huella: 7};
const BIOMAS = {
  templado: {hierba: [0.30, 0.42, 0.17], hierbaSeca: [0.48, 0.47, 0.25], tierra: [0.40, 0.31, 0.21], roca: [0.47, 0.45, 0.42], nieveDesde: 1e9},
  mediterraneo: {hierba: [0.45, 0.46, 0.24], hierbaSeca: [0.62, 0.55, 0.33], tierra: [0.58, 0.44, 0.29], roca: [0.62, 0.58, 0.52], nieveDesde: 1e9},
  estepa: {hierba: [0.52, 0.50, 0.28], hierbaSeca: [0.64, 0.58, 0.36], tierra: [0.52, 0.42, 0.28], roca: [0.55, 0.50, 0.44], nieveDesde: 1e9},
  boreal: {hierba: [0.26, 0.36, 0.20], hierbaSeca: [0.40, 0.42, 0.26], tierra: [0.33, 0.27, 0.20], roca: [0.42, 0.42, 0.42], nieveDesde: 60},
  nevado: {hierba: [0.36, 0.40, 0.26], hierbaSeca: [0.46, 0.46, 0.34], tierra: [0.36, 0.30, 0.24], roca: [0.40, 0.40, 0.42], nieveDesde: -1e9},
  desierto: {hierba: [0.60, 0.55, 0.33], hierbaSeca: [0.74, 0.64, 0.42], tierra: [0.76, 0.62, 0.42], roca: [0.66, 0.54, 0.42], nieveDesde: 1e9}};

/* ===================================================================================== */
function crearTerreno(o) {
  o = Object.assign({ancho: 1920, fondo: 840, x0: 0, z0: 0, res: 2, resLejos: 8, chunk: 64, radioActivo: 300, semilla: 1, bioma: 'templado', alturaBase: null,
    relieve: 26, caminos: [], agua: null, humedadGlobal: 0, faldon: 4, sombras: true}, o || {});
  const R = o.res, NX = Math.ceil(o.ancho / R) + 1, NZ = Math.ceil(o.fondo / R) + 1, B = BIOMAS[o.bioma] || BIOMAS.templado;
  const H = new Float32Array(NX * NZ), W = new Uint8Array(NX * NZ * 8), ROD = new Int8Array(NX * NZ);   // ROD: posición a través del camino (−127…127 = −2…2 m)
  const idx = (i, j) => j * NX + i, X = i => o.x0 + i * R, Zc = j => o.z0 + j * R;
  // 1) alturas
  for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) {
    const x = X(i), z = Zc(j);
    H[idx(i, j)] = o.alturaBase ? o.alturaBase(x, z) : (fbm(x / 260, z / 260, o.semilla, 5) - 0.5) * 2 * o.relieve + (fbm(x / 40, z / 40, o.semilla + 9, 3) - 0.5) * 2.2;
  }
  // 2) pesos automáticos
  const pend = (i, j) => { const a = H[idx(Math.max(0, i - 1), j)], b = H[idx(Math.min(NX - 1, i + 1), j)], c = H[idx(i, Math.max(0, j - 1))], d = H[idx(i, Math.min(NZ - 1, j + 1))]; return Math.hypot(b - a, d - c) / (2 * R); };
  for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) {
    const x = X(i), z = Zc(j), k = idx(i, j) * 8, s = pend(i, j), h = H[idx(i, j)];
    const roca = sstep(0.55, 0.95, s + (fbm(x / 30, z / 30, o.semilla + 3, 2) - 0.5) * 0.35);
    // concavidad: donde el terreno está por debajo de su entorno se acumula agua → barro
    let m = 0, n = 0; for (let dj = -3; dj <= 3; dj += 3) for (let di = -3; di <= 3; di += 3) { const ii = Math.min(NX - 1, Math.max(0, i + di)), jj = Math.min(NZ - 1, Math.max(0, j + dj)); m += H[idx(ii, jj)]; n++; }
    const conc = sstep(0.15, 1.1, m / n - h) * (1 - roca);
    const barro = Math.min(1, conc * 0.9 + sstep(0.62, 0.8, fbm(x / 55, z / 55, o.semilla + 5, 3)) * 0.6) * (1 - roca);
    const tierra = sstep(0.66, 0.8, fbm(x / 22, z / 22, o.semilla + 7, 3)) * 0.7 * (1 - roca) * (1 - barro);
    const nieve = sstep(B.nieveDesde - 6, B.nieveDesde + 6, h + (fbm(x / 18, z / 18, o.semilla + 11, 2) - 0.5) * 8) * (1 - roca * 0.6);
    const hierba = Math.max(0, 1 - roca - barro - tierra);
    W[k] = 255 * hierba; W[k + 1] = 255 * tierra; W[k + 2] = 255 * barro; W[k + 3] = 255 * roca; W[k + 4] = 0; W[k + 5] = 255 * Math.min(1, nieve); W[k + 6] = 255 * Math.min(1, conc * 1.2); W[k + 7] = 0;
  }
  // 3) caminos: polilíneas [[x,z],…] con ancho (u); se aplanan un poco en sentido transversal y llevan rodadas
  (o.caminos || []).forEach(c => pintarCamino(c.puntos || c, c.ancho || 7));
  function pintarCamino(P, ancho) {
    for (let s = 0; s < P.length - 1; s++) {
      const [ax, az] = P[s], [bx, bz] = P[s + 1], dx = bx - ax, dz = bz - az, L = Math.hypot(dx, dz) || 1, ux = dx / L, uz = dz / L, half = ancho / 2 + 3;
      const i0 = Math.max(0, Math.floor((Math.min(ax, bx) - half - o.x0) / R)), i1 = Math.min(NX - 1, Math.ceil((Math.max(ax, bx) + half - o.x0) / R));
      const j0 = Math.max(0, Math.floor((Math.min(az, bz) - half - o.z0) / R)), j1 = Math.min(NZ - 1, Math.ceil((Math.max(az, bz) + half - o.z0) / R));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        const px = X(i) - ax, pz = Zc(j) - az, t = Math.min(L, Math.max(0, px * ux + pz * uz)), cx = px - ux * t, cz = pz - uz * t, d = Math.hypot(cx, cz);
        const w = 1 - sstep(ancho / 2 - 1, ancho / 2 + 1.5, d); if (w <= 0) continue; const k = idx(i, j) * 8;
        if (w * 255 > W[k + 4]) { W[k + 4] = 255 * w; const lado = Math.sign(cx * -uz + cz * ux); ROD[idx(i, j)] = Math.max(-127, Math.min(127, Math.round(lado * d / (ancho / 2) * 127))); }
        const f = 1 - W[k + 4] / 255; W[k] *= f; W[k + 1] *= f; W[k + 3] *= f;
      }
    }
  }
  // 4) altura exacta sobre la malla fina (diagonal fija: (i,j)-(i+1,j)-(i,j+1) y (i+1,j)-(i+1,j+1)-(i,j+1))
  function heightAt(x, z) {
    let fx = (x - o.x0) / R, fz = (z - o.z0) / R; fx = Math.min(NX - 1.0001, Math.max(0, fx)); fz = Math.min(NZ - 1.0001, Math.max(0, fz));
    const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j, h00 = H[idx(i, j)], h10 = H[idx(i + 1, j)], h01 = H[idx(i, j + 1)], h11 = H[idx(i + 1, j + 1)];
    return u + v <= 1 ? h00 + (h10 - h00) * u + (h01 - h00) * v : h11 + (h01 - h11) * (1 - u) + (h10 - h11) * (1 - v);
  }
  function normalAt(x, z, out) { const e = R; const hx = heightAt(x + e, z) - heightAt(x - e, z), hz = heightAt(x, z + e) - heightAt(x, z - e); out = out || new THREE.Vector3(); return out.set(-hx, 2 * e, -hz).normalize(); }
  function pesosEn(x, z) { const i = Math.round((x - o.x0) / R), j = Math.round((z - o.z0) / R); if (i < 0 || j < 0 || i >= NX || j >= NZ) return null; const k = idx(i, j) * 8, r = {}; Object.keys(CANAL).forEach(n => { r[n] = W[k + CANAL[n]] / 255; }); return r; }

  /* ---------- material ---------- */
  const material = crearMaterial(B, o);
  const grupo = new THREE.Group(); grupo.name = 'terreno3d';
  const CH = o.chunk, CX = Math.ceil(o.ancho / CH), CZ = Math.ceil(o.fondo / CH), chunks = [];
  for (let cj = 0; cj < CZ; cj++) for (let ci = 0; ci < CX; ci++) chunks.push({ci, cj, x0: o.x0 + ci * CH, z0: o.z0 + cj * CH, res: 0, mesh: null, sucio: true});
  const chunkDe = (ci, cj) => chunks[cj * CX + ci];
  function marcarSucio(x0, z0, x1, z1) { chunks.forEach(c => { if (c.x0 <= x1 && c.x0 + CH >= x0 && c.z0 <= z1 && c.z0 + CH >= z0) c.sucio = true; }); }

  function mallaChunk(c, res) {
    const n = Math.round(CH / res), nv = (n + 1) * (n + 1), extra = 4 * (n + 1);
    const pos = new Float32Array((nv + extra) * 3), nor = new Float32Array((nv + extra) * 3), pa = new Float32Array((nv + extra) * 4), pb = new Float32Array((nv + extra) * 4), rod = new Float32Array(nv + extra);
    const _n = new THREE.Vector3(); let v = 0;
    const put = (x, z, y, nn) => {
      pos[v * 3] = x; pos[v * 3 + 1] = y; pos[v * 3 + 2] = z; normalAt(x, z, _n); nor[v * 3] = _n.x; nor[v * 3 + 1] = _n.y; nor[v * 3 + 2] = _n.z;
      const i = Math.min(NX - 1, Math.max(0, Math.round((x - o.x0) / R))), j = Math.min(NZ - 1, Math.max(0, Math.round((z - o.z0) / R))), k = idx(i, j) * 8;
      for (let q = 0; q < 4; q++) { pa[v * 4 + q] = W[k + q] / 255; pb[v * 4 + q] = W[k + 4 + q] / 255; } rod[v] = ROD[idx(i, j)] / 127; v++;
    };
    for (let b = 0; b <= n; b++) for (let a = 0; a <= n; a++) { const x = Math.min(o.x0 + o.ancho, c.x0 + a * res), z = Math.min(o.z0 + o.fondo, c.z0 + b * res); put(x, z, heightAt(x, z)); }
    const ind = [];
    for (let b = 0; b < n; b++) for (let a = 0; a < n; a++) { const p = b * (n + 1) + a; ind.push(p, p + n + 1, p + 1, p + 1, p + n + 1, p + n + 2); }
    // faldones: una tira vertical bajo cada borde (tapa grietas entre chunks de distinto detalle)
    const bordes = [[0, 0, 1, 0], [n, 0, 0, 1], [n, n, -1, 0], [0, n, 0, -1]];
    bordes.forEach(([a0, b0, da, db]) => {
      const base = v; for (let s = 0; s <= n; s++) { const p = (b0 + db * s) * (n + 1) + (a0 + da * s); put(pos[p * 3], pos[p * 3 + 2], pos[p * 3 + 1] - o.faldon); }
      for (let s = 0; s < n; s++) { const p = (b0 + db * s) * (n + 1) + (a0 + da * s), q = (b0 + db * (s + 1)) * (n + 1) + (a0 + da * (s + 1)); ind.push(p, base + s, q, q, base + s, base + s + 1); }
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos.subarray(0, v * 3), 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor.subarray(0, v * 3), 3));
    g.setAttribute('pesoA', new THREE.BufferAttribute(pa.subarray(0, v * 4), 4)); g.setAttribute('pesoB', new THREE.BufferAttribute(pb.subarray(0, v * 4), 4)); g.setAttribute('rodada', new THREE.BufferAttribute(rod.subarray(0, v), 1));
    g.setIndex(ind); g.computeBoundingSphere(); g.computeBoundingBox(); return g;
  }
  function actualizar(cx, cz) {
    if (cx == null) { cx = o.x0 + o.ancho / 2; cz = o.z0 + o.fondo / 2; }
    let rehechos = 0;
    chunks.forEach(c => {
      const dx = Math.max(0, Math.abs(cx - (c.x0 + CH / 2)) - CH / 2), dz = Math.max(0, Math.abs(cz - (c.z0 + CH / 2)) - CH / 2), res = Math.hypot(dx, dz) < o.radioActivo ? R : o.resLejos;
      if (c.mesh && c.res === res && !c.sucio) return;
      const g = mallaChunk(c, res); rehechos++;
      if (!c.mesh) { c.mesh = new THREE.Mesh(g, material); c.mesh.receiveShadow = true; c.mesh.castShadow = o.sombras; c.mesh.name = `chunk_${c.ci}_${c.cj}`; grupo.add(c.mesh); }
      else { c.mesh.geometry.dispose(); c.mesh.geometry = g; }
      c.res = res; c.sucio = false;
    });
    return rehechos;
  }

  /* ---------- edición ---------- */
  function editar(x0, z0, x1, z1, fn) {
    const i0 = Math.max(0, Math.floor((x0 - o.x0) / R)), i1 = Math.min(NX - 1, Math.ceil((x1 - o.x0) / R)), j0 = Math.max(0, Math.floor((z0 - o.z0) / R)), j1 = Math.min(NZ - 1, Math.ceil((z1 - o.z0) / R));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) fn(i, j, X(i), Zc(j), idx(i, j));
    marcarSucio(x0 - R, z0 - R, x1 + R, z1 + R);
  }
  // aplanar: rectángulo girado (rot en radianes alrededor de y); dentro queda a «altura» (por defecto la mediana del terreno bajo la planta)
  function aplanar(cx, cz, w, d, rot, margen, altura) {
    rot = rot || 0; margen = margen == null ? 4 : margen; const c = Math.cos(rot), s = Math.sin(rot), ext = Math.hypot(w, d) / 2 + margen + R * 3;
    if (altura == null) { const m = []; for (let a = -0.5; a <= 0.5; a += 0.25) for (let b = -0.5; b <= 0.5; b += 0.25) { const lx = a * w, lz = b * d; m.push(heightAt(cx + lx * c + lz * s, cz - lx * s + lz * c)); } m.sort((p, q) => p - q); altura = m[m.length >> 1]; }
    editar(cx - ext, cz - ext, cx + ext, cz + ext, (i, j, x, z, k) => {
      const px = x - cx, pz = z - cz, lx = px * c - pz * s, lz = px * s + pz * c, ex = Math.max(0, Math.abs(lx) - w / 2), ez = Math.max(0, Math.abs(lz) - d / 2), dd = Math.hypot(ex, ez);
      const lleno = R * 1.5; if (dd >= margen + lleno) return; const t = dd <= lleno ? 1 : 1 - sstep(lleno, margen + lleno, dd); H[k] = H[k] + (altura - H[k]) * t;
      if (dd <= lleno) { const q = k * 8; W[q] = W[q] * 0.4; W[q + 1] = Math.min(255, W[q + 1] + 120); }
    });
    return altura;
  }
  // trinchera: polilínea, ancho y profundidad (u); opts.parapeto: −1/1 lado del parapeto de tierra (0 = sin parapeto); devuelve puntos de cobertura
  function excavarTrinchera(P, ancho, prof, op) {
    op = op || {}; ancho = ancho || 3.2; prof = prof || 3; const par = op.parapeto == null ? 1 : op.parapeto, cov = [], CORTE = new Map(), BERMA = new Map();
    for (let s = 0; s < P.length - 1; s++) {
      const [ax, az] = P[s], [bx, bz] = P[s + 1], dx = bx - ax, dz = bz - az, L = Math.hypot(dx, dz) || 1, ux = dx / L, uz = dz / L, half = ancho / 2 + 5;
      editar(Math.min(ax, bx) - half, Math.min(az, bz) - half, Math.max(ax, bx) + half, Math.max(az, bz) + half, (i, j, x, z, k) => {
        const px = x - ax, pz = z - az, t = Math.min(L, Math.max(0, px * ux + pz * uz)), cx = px - ux * t, cz = pz - uz * t, d = Math.hypot(cx, cz), lado = Math.sign(cx * -uz + cz * ux) || 1;
        const corte = (1 - sstep(ancho / 2 - R * 0.6, ancho / 2 + R * 0.6, d)) * prof;   // paredes empinadas (la transición cubre una celda para no dentar)
        const berma = par && lado === par ? Math.max(0, 1 - Math.abs(d - ancho / 2 - 2.2) / 2.2) * prof * 0.45 : 0;
        if (corte > (CORTE.get(k) || 0)) CORTE.set(k, corte); if (berma > (BERMA.get(k) || 0)) BERMA.set(k, berma);
      });
      for (let t = 0; t < L; t += 2.2) cov.push({tipo: 'trinchera', pos: [ax + ux * t, 0, az + uz * t], alto: 'alta', normal: [-uz * par, ux * par], lados: ['izq', 'der'], capacidad: 1});
    }
    CORTE.forEach((c, k) => { if (c < 0.01) return; H[k] -= c; const q = k * 8; W[q] = 0; W[q + 1] = 200; W[q + 2] = 120; W[q + 3] = 0; W[q + 6] = 160; });
    BERMA.forEach((b, k) => { if (b < 0.01 || (CORTE.get(k) || 0) > 0.01) return; H[k] += b; const q = k * 8; W[q] *= 0.3; W[q + 1] = Math.min(255, W[q + 1] + 160); });
    cov.forEach(c => { c.pos[1] = heightAt(c.pos[0], c.pos[2]); });
    return cov;
  }
  // cráter o bache: cuenco de radio r y profundidad p con borde levantado; también ennegrece (quemado)
  function deformar(x, z, r, p, borde) {
    borde = borde == null ? 0.35 : borde;
    editar(x - r * 1.6, z - r * 1.6, x + r * 1.6, z + r * 1.6, (i, j, px, pz, k) => {
      const d = Math.hypot(px - x, pz - z) / r; if (d > 1.6) return;
      const dh = d < 1 ? -p * (1 - d * d) + borde * p * d * d * d : borde * p * Math.max(0, 1 - (d - 1) / 0.6) ** 2; H[k] += dh;
      const q = k * 8; W[q + 7] = Math.min(255, W[q + 7] + 255 * Math.max(0, 1.2 - d)); W[q] *= Math.min(1, d); W[q + 1] = Math.min(255, W[q + 1] + 255 * Math.max(0, 1.1 - d));
    });
  }
  // huellas / pisoteo / quemado sin cambiar la altura (solo color): int 0..1
  function marcar(x, z, r, int, tipo) {
    const ch = tipo === 'barro' ? 2 : 7;
    editar(x - r, z - r, x + r, z + r, (i, j, px, pz, k) => { const d = Math.hypot(px - x, pz - z) / r; if (d > 1) return; const q = k * 8; W[q + ch] = Math.min(255, W[q + ch] + 255 * int * (1 - d)); if (ch === 2) W[q] *= 1 - 0.5 * int * (1 - d); });
  }
  // rayo: primera intersección con el terreno desde o en la dirección d (normalizada), hasta max (u); null si no toca
  function rayo(or, d, max) {
    max = max || 2000; let t = 0, prev = or[1] - heightAt(or[0], or[2]); const paso = R * 0.75;
    while (t < max) { t += paso; const x = or[0] + d[0] * t, y = or[1] + d[1] * t, z = or[2] + d[2] * t, h = y - heightAt(x, z);
      if (h < 0) { let a = t - paso, b = t; for (let k = 0; k < 12; k++) { const m = (a + b) / 2, hm = or[1] + d[1] * m - heightAt(or[0] + d[0] * m, or[2] + d[2] * m); if (hm < 0) b = m; else a = m; } return {t: b, p: [or[0] + d[0] * b, or[1] + d[1] * b, or[2] + d[2] * b]}; }
      prev = h; }
    return null;
  }
  function stats() { let tri = 0, act = 0; chunks.forEach(c => { if (c.mesh) { tri += c.mesh.geometry.index.count / 3; if (c.res === R) act++; } }); return {chunks: chunks.length, activos: act, triangulos: tri, rejilla: [NX, NZ], memoriaKB: Math.round((H.byteLength + W.byteLength + ROD.byteLength) / 1024)}; }
  function liberar() { chunks.forEach(c => { if (c.mesh) { c.mesh.geometry.dispose(); grupo.remove(c.mesh); c.mesh = null; } }); material.dispose(); }
  return {heightAt, height: heightAt, normalAt, pesosEn, aplanar, excavarTrinchera, deformar, marcar, rayo, actualizar, grupo, material, stats, liberar, opciones: o, _campo: {H, W, NX, NZ, R}};
}

/* ---------- material procedural triplanar ---------- */
function crearMaterial(B, o) {
  const m = new THREE.MeshStandardMaterial({color: 0xffffff, roughness: 0.95, metalness: 0});
  const u = {uHierba: {value: new THREE.Color().setRGB(...B.hierba).convertSRGBToLinear()}, uHierbaSeca: {value: new THREE.Color().setRGB(...B.hierbaSeca).convertSRGBToLinear()}, uTierra: {value: new THREE.Color().setRGB(...B.tierra).convertSRGBToLinear()},
    uRoca: {value: new THREE.Color().setRGB(...B.roca).convertSRGBToLinear()}, uHumedad: {value: o.humedadGlobal || 0}, uEscala: {value: 1 / 0.6}};
  m.userData.uniforms = u;
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>
attribute vec4 pesoA; attribute vec4 pesoB; attribute float rodada; varying vec4 vPA; varying vec4 vPB; varying float vRod; varying vec3 vWP; varying vec3 vWN;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
vPA = pesoA; vPB = pesoB; vRod = rodada; vWP = (modelMatrix * vec4(position, 1.0)).xyz; vWN = normalize(mat3(modelMatrix) * normal);`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
uniform vec3 uHierba; uniform vec3 uHierbaSeca; uniform vec3 uTierra; uniform vec3 uRoca; uniform float uHumedad; uniform float uEscala;
varying vec4 vPA; varying vec4 vPB; varying float vRod; varying vec3 vWP; varying vec3 vWN;
float h31(vec3 p){ p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
float n3(vec3 x){ vec3 i = floor(x), f = fract(x); f = f*f*(3.0-2.0*f);
  return mix(mix(mix(h31(i), h31(i+vec3(1,0,0)), f.x), mix(h31(i+vec3(0,1,0)), h31(i+vec3(1,1,0)), f.x), f.y), mix(mix(h31(i+vec3(0,0,1)), h31(i+vec3(1,0,1)), f.x), mix(h31(i+vec3(0,1,1)), h31(i+vec3(1,1,1)), f.x), f.y), f.z); }
float fb(vec3 p){ return 0.5*n3(p) + 0.25*n3(p*2.07) + 0.125*n3(p*4.13) + 0.0625*n3(p*8.3); }
// triplanar: muestrea el ruido en los tres planos y mezcla por la normal
float tri(vec3 p, vec3 n, float s){ vec3 w = pow(abs(n), vec3(4.0)); w /= (w.x + w.y + w.z); return fb(p.yzx * s) * w.x + fb(p.xzy * s) * w.y + fb(p * s) * w.z; }
float gWet = 0.0;`);
    sh.fragmentShader = sh.fragmentShader.replace('vec4 diffuseColor = vec4( diffuse, opacity );', `
vec3 P = vWP / uEscala;               // metros
float nG = fb(P * 0.35), nF = fb(P * 2.7);
vec3 cHierba = mix(uHierba, uHierbaSeca, smoothstep(0.35, 0.75, fb(P * 0.06 + 7.0))) * (0.82 + 0.36 * nF);
cHierba *= 0.9 + 0.2 * smoothstep(0.4, 0.6, fb(vec3(P.x*0.5, 0.0, P.z*2.5)));   // vetas de siega / viento
vec3 cTierra = uTierra * (0.78 + 0.4 * fb(P * 1.3)) ;
cTierra = mix(cTierra, cTierra * 0.7, step(0.72, n3(P * 6.0)));                      // terrones
float charco = smoothstep(0.55, 0.62, fb(P * 0.45 + 3.0)) * vPA.z;
vec3 cBarro = mix(uTierra * 0.55, uTierra * 0.42, nF);
cBarro = mix(cBarro, vec3(0.30, 0.33, 0.34) * 0.8, charco);
float estr = tri(P * vec3(1.0, 3.5, 1.0), vWN, 0.9);
vec3 cRoca = uRoca * (0.62 + 0.65 * estr) * (0.85 + 0.25 * tri(P, vWN, 3.1));
cRoca = mix(cRoca, uHierba * 0.7, smoothstep(0.62, 0.8, fb(P * 0.9)) * smoothstep(0.6, 0.95, vWN.y));   // musgo arriba
float rut = 1.0 - smoothstep(0.08, 0.2, abs(abs(vRod) - 0.55));                     // dos rodadas a ±0,55 del eje
vec3 cCamino = mix(uTierra * 1.12, uTierra * 0.8, fb(P * 1.9)) * (1.0 - 0.28 * rut);
cCamino = mix(cCamino, uHierba * 0.9, smoothstep(0.1, 0.0, abs(vRod)) * 0.25);        // hierba en el centro
vec3 cNieve = vec3(0.9, 0.92, 0.95) * (0.92 + 0.1 * nF);
vec4 a = vPA; vec4 b = vPB; float sum = a.x + a.y + a.z + a.w + b.x + 0.0001;
// bordes de mezcla con ruido (no transiciones lineales)
float rn = (nG - 0.5) * 0.6;
a.w = clamp(a.w + rn * a.w, 0.0, 1.0); b.x = clamp(b.x + rn * 0.4 * b.x, 0.0, 1.0);
vec3 col = (cHierba * a.x + cTierra * a.y + cBarro * a.z + cRoca * a.w + cCamino * b.x) / sum;
col = mix(col, cNieve, smoothstep(0.35, 0.65, b.y + (nF - 0.5) * 0.5) * smoothstep(0.25, 0.7, vWN.y));
gWet = clamp(b.z * 0.7 + uHumedad + charco * 0.8, 0.0, 1.0);
col *= 1.0 - 0.35 * gWet;                                   // húmedo = más oscuro
col = mix(col, vec3(0.08, 0.07, 0.06), clamp(b.w, 0.0, 1.0) * (0.55 + 0.3 * nF));   // huellas, quemado, cráter
vec4 diffuseColor = vec4( col, opacity );`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
roughnessFactor = mix(roughnessFactor, 0.18, gWet * gWet);`);
  };
  m.customProgramCacheKey = () => 'terreno3d_v1';
  return m;
}

/* ---------- prueba sin WebGL: coherencia de alturas, aplanado, trinchera, cráter ---------- */
function pruebaTerreno() {
  const T = crearTerreno({ancho: 512, fondo: 384, semilla: 5, caminos: [{puntos: [[0, 190], [250, 170], [512, 220]], ancho: 8}]});
  T.actualizar(256, 192);
  const res = {}; let maxErr = 0, n = 0;
  T.grupo.children.forEach(m => { if (!m.geometry) return; const p = m.geometry.attributes.position, nv = (Math.round(64 / 2) + 1) ** 2; if (p.count < nv) return;
    for (let k = 0; k < nv; k += 7) { const e = Math.abs(p.getY(k) - T.heightAt(p.getX(k), p.getZ(k))); maxErr = Math.max(maxErr, e); n++; } });
  // puntos interiores de los triángulos: la altura del triángulo dibujado y heightAt deben coincidir
  const g = T.grupo.children.find(m => m.geometry.attributes.position.count > 1000).geometry, P = g.attributes.position, I = g.index.array; let maxTri = 0;
  for (let t = 0; t < 600 * 3; t += 3) { const a = I[t], b = I[t + 1], c = I[t + 2], w = [0.2, 0.3, 0.5], x = w[0] * P.getX(a) + w[1] * P.getX(b) + w[2] * P.getX(c), y = w[0] * P.getY(a) + w[1] * P.getY(b) + w[2] * P.getY(c), z = w[0] * P.getZ(a) + w[1] * P.getZ(b) + w[2] * P.getZ(c);
    maxTri = Math.max(maxTri, Math.abs(y - T.heightAt(x, z))); }
  res.errorVertices = +maxErr.toFixed(5); res.errorDentroTriangulos = +maxTri.toFixed(5); res.muestras = n;
  const h = T.aplanar(200, 150, 20, 14, 0.5, 4); let dev = 0; for (let a = -9; a <= 9; a += 1.5) for (let b = -6; b <= 6; b += 1.5) { const c = Math.cos(0.5), s = Math.sin(0.5); dev = Math.max(dev, Math.abs(T.heightAt(200 + a * c + b * s, 150 - a * s + b * c) - h)); }
  res.aplanadoDesviacion = +dev.toFixed(4);
  const antes = T.heightAt(300, 300); T.excavarTrinchera([[260, 300], [300, 300], [330, 320]], 3.2, 3, {parapeto: -1}); res.trincheraProfundidad = +(antes - T.heightAt(300, 300)).toFixed(2);
  const a2 = T.heightAt(100, 300); T.deformar(100, 300, 6, 2.5); res.craterProfundidad = +(a2 - T.heightAt(100, 300)).toFixed(2);
  const r = T.rayo([10, 200, 10], [0.6, -0.4, 0.69].map((v, i, A) => v / Math.hypot(...A)), 2000); res.rayoToca = !!r && Math.abs(r.p[1] - T.heightAt(r.p[0], r.p[2])) < 0.05;
  T.actualizar(256, 192); res.stats = T.stats();
  res.ok = res.errorVertices < 1e-4 && res.errorDentroTriangulos < 1e-3 && res.aplanadoDesviacion < 1e-3 && res.trincheraProfundidad > 2.5 && res.craterProfundidad > 1.5 && res.rayoToca;
  return res;
}

/* ---------- demostración ---------- */
function demoTerreno(cont) {
  cont = cont || document.body; const D = baseDemo(cont, {cam: [520, 160, 760], obj: [500, 10, 420], sol: [-0.5, 0.8, -0.3]});
  const T = crearTerreno({ancho: 1024, fondo: 768, semilla: 7, bioma: 'templado', relieve: 30, caminos: [{puntos: [[0, 420], [300, 380], [520, 430], [760, 400], [1024, 460]], ancho: 9}]});
  T.aplanar(520, 360, 40, 28, 0.2, 6); T.excavarTrinchera([[380, 520], [440, 540], [470, 510], [540, 540], [600, 520]], 3.4, 3.2, {parapeto: -1});
  for (let k = 0; k < 9; k++) T.deformar(620 + k * 23 % 90, 560 + (k * 37) % 60, 3 + (k % 3), 1.6 + (k % 2));
  T.marcar(500, 430, 30, 0.5, 'barro');
  T.actualizar(500, 420); D.escena.add(T.grupo);
  D.bucle((t, cam) => { T.actualizar(cam.position.x, cam.position.z); });
  return {T, D};
}
// base mínima de las demos: renderizador, luz cálida con sombra, cielo y cámara orbital (arrastrar = girar, rueda = zoom, botón derecho = desplazar)
function baseDemo(cont, op) {
  op = op || {}; const W = cont.clientWidth || innerWidth, Hh = cont.clientHeight || innerHeight;
  const r = new THREE.WebGLRenderer({antialias: true}); r.setPixelRatio(Math.min(2, devicePixelRatio || 1)); r.setSize(W, Hh); r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap; cont.appendChild(r.domElement);
  const escena = new THREE.Scene(); escena.background = new THREE.Color(0xb9c6cf); escena.fog = new THREE.Fog(0xb9c6cf, 600, 1800);
  const cam = new THREE.PerspectiveCamera(50, W / Hh, 0.5, 4000); cam.position.set(...(op.cam || [0, 50, 100]));
  const obj = new THREE.Vector3(...(op.obj || [0, 0, 0])); cam.lookAt(obj);
  escena.add(new THREE.HemisphereLight(0xdfe8f0, 0x5a4a32, 0.75));
  const sol = new THREE.DirectionalLight(0xfff1d6, 1.6); const sd = new THREE.Vector3(...(op.sol || [-0.5, 0.8, -0.3])).normalize(); sol.position.copy(obj).addScaledVector(sd, 600); sol.target.position.copy(obj);
  sol.castShadow = true; sol.shadow.mapSize.set(2048, 2048); const sc = sol.shadow.camera; sc.left = sc.bottom = -(op.sombra || 500); sc.right = sc.top = op.sombra || 500; sc.near = 10; sc.far = 1600; sol.shadow.bias = -0.0006;
  escena.add(sol, sol.target);
  // órbita
  let az = Math.atan2(cam.position.x - obj.x, cam.position.z - obj.z), el = Math.asin((cam.position.y - obj.y) / cam.position.distanceTo(obj)), dist = cam.position.distanceTo(obj), arr = null;
  const aplica = () => { cam.position.set(obj.x + dist * Math.cos(el) * Math.sin(az), obj.y + dist * Math.sin(el), obj.z + dist * Math.cos(el) * Math.cos(az)); cam.lookAt(obj); };
  r.domElement.addEventListener('pointerdown', e => { arr = {x: e.clientX, y: e.clientY, b: e.button}; r.domElement.setPointerCapture(e.pointerId); });
  r.domElement.addEventListener('pointermove', e => { if (!arr) return; const dx = e.clientX - arr.x, dy = e.clientY - arr.y; arr.x = e.clientX; arr.y = e.clientY;
    if (arr.b === 2 || e.shiftKey) { const k = dist / 600; obj.x -= (Math.cos(az) * dx) * k; obj.z += (Math.sin(az) * dx) * k; obj.x -= Math.sin(az) * dy * k; obj.z -= Math.cos(az) * dy * k; } else { az -= dx * 0.005; el = Math.min(1.45, Math.max(0.05, el + dy * 0.005)); } aplica(); });
  addEventListener('pointerup', () => { arr = null; }); r.domElement.addEventListener('contextmenu', e => e.preventDefault());
  r.domElement.addEventListener('wheel', e => { dist = Math.min(3000, Math.max(5, dist * (1 + Math.sign(e.deltaY) * 0.1))); aplica(); e.preventDefault(); }, {passive: false});
  addEventListener('resize', () => { const w = cont.clientWidth || innerWidth, h = cont.clientHeight || innerHeight; r.setSize(w, h); cam.aspect = w / h; cam.updateProjectionMatrix(); });
  const fns = []; const t0 = performance.now();
  const D = {renderer: r, escena, cam, sol, obj, bucle: f => fns.push(f), parar: false, mirar: (p, o2, d, e2) => { obj.set(...p); if (o2 != null) az = o2; if (d) dist = d; if (e2 != null) el = e2; aplica(); }};
  (function frame() { if (D.parar) return; const t = (performance.now() - t0) / 1000; fns.forEach(f => f(t, cam)); r.render(escena, cam); requestAnimationFrame(frame); })();
  return D;
}

root.terreno3d = {crearTerreno, pruebaTerreno, demoTerreno, baseDemo, BIOMAS, CANAL, _ruido: {fbm, vnoise, rng}};
})(typeof window !== 'undefined' ? window : globalThis);
