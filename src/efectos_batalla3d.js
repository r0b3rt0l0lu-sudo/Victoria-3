/* ===== efectos_batalla3d.js — efectos y atmósfera del modo «Batalla» de Victoria (three.js r152, todo procedural, sin texturas) =====
   Sección F del encargo. Un único gestor, crearEfectos(escena, op), con:
   · HUMO DE PÓLVORA «volumétrico»: bocanadas en billboards con ruido fbm, iluminación de esfera falsa según el sol, crecimiento, deriva con el
     viento y DISIPACIÓN con tiempo característico (más larga con aire húmedo y quieto, más corta con viento). Pólvora negra (A–C) frente a
     pólvora sin humo (D–E). Densidad consultable: humo.densidad(x, y, z) y humo.transmitancia(a, b) para la línea de vista de la IA
     (misma API que proyectiles3d y compatible con ella: conectarProyectiles() le sustituye el humo).
   · NIEBLA de la mañana (capas a ras de suelo que se levantan con la hora) y NIEBLA DE BATALLA (el humo acumulado espesa y agrisa la niebla).
   · POLVO de columnas en marcha y de la caballería (según velocidad, anchura y suelo; no hay polvo con lluvia, barro o nieve).
   · LLUVIA (gotas inclinadas por el viento) y NIEVE (copos con vaivén), movidas en la GPU alrededor de la cámara; BARRO CON HUELLAS y NIEVE
     CON RASTROS: calcos de pisadas, herraduras, rodadas y surcos de bala que se desvanecen con el tiempo (también se calculan en la GPU).
   · CHISPAS de impacto (estrías aditivas), ESTELAS de bala redonda con su REBOTE (abanico de tierra y surco en el suelo).
   · EXPLOSIÓN DE OBÚS: destello, bola de fuego, onda (anillo a ras de suelo y cúpula de choque), surtidor de terrones con física, columna de
     humo y CRÁTER (terreno3d.deformar) con mancha quemada.
   · FUEGO en edificios y bosques: llamas con parpadeo, pavesas, columna de humo negro, luces que titilan; el fuego de bosque se propaga.
   · CIELO Y LUZ: hora del día con amanecer/ocaso (sol bajo y anaranjado, sombras largas), noche con estrellas, cielo cubierto con la lluvia.
   Rendimiento: un número fijo de llamadas de dibujo (13) sea cual sea la cantidad de efectos; todo en búferes preasignados; actualizar() no
   crea objetos. Unidades: u del campo (1 u = 0,6 m).
   API: crearEfectos(escena, op) → FX · crearCielo(escena, op) · TIPOS_HUMO · pruebaEfectos() · demoEfectos(cont) */
(function (root) {
'use strict';
const THREE = root.THREE, MU = 1 / 0.6, G = 9.81 * MU;
function rng(seed) { let a = (seed >>> 0) || 1; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const clamp = (x, a, b) => x < a ? a : x > b ? b : x, lerp = (a, b, t) => a + (b - a) * t, smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const GLSL_RUIDO = `
float hh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(hh(i), hh(i + vec2(1.0, 0.0)), f.x), mix(hh(i + vec2(0.0, 1.0)), hh(i + vec2(1.0, 1.0)), f.x), f.y); }
float fbm(vec2 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++) { s += a * n2(p); p = p * 2.03 + 1.7; a *= 0.5; } return s; }`;

/* ===================================================================================== */
/* NUBE: sistema de billboards en instancias (1 llamada de dibujo). modo 'humo' (mezcla normal, iluminado) o 'brillo' (aditivo, parpadeo).
   Estado en Float32Array; las vivas se compactan cada fotograma en los atributos de instancia. */
function Nube(N, modo, U) {
  this.N = N; this.modo = modo; this.n = 0; this.cur = 0;
  this.P = new Float32Array(N * 3); this.V = new Float32Array(N * 3); this.C = new Float32Array(N * 3);
  this.edad = new Float32Array(N); this.vida = new Float32Array(N).fill(-1); this.tam0 = new Float32Array(N); this.crece = new Float32Array(N); this.den = new Float32Array(N);
  this.flota = new Float32Array(N); this.arr = new Float32Array(N); this.acop = new Float32Array(N); this.rot = new Float32Array(N); this.giro = new Float32Array(N); this.semilla = new Float32Array(N);
  this.forma = new Float32Array(N);   // humo: exponente de caída de la densidad; brillo: 0 llama, 1 destello, 2 pavesa
  this.R = new Float32Array(N);       // radio actual (para la densidad)
  const g = new THREE.InstancedBufferGeometry(), base = new THREE.PlaneGeometry(1, 1);
  g.index = base.index; g.setAttribute('position', base.attributes.position); g.setAttribute('uv', base.attributes.uv);
  this.aPos = new THREE.InstancedBufferAttribute(new Float32Array(N * 3), 3); this.aTam = new THREE.InstancedBufferAttribute(new Float32Array(N), 1);
  this.aCol = new THREE.InstancedBufferAttribute(new Float32Array(N * 4), 4); this.aVar = new THREE.InstancedBufferAttribute(new Float32Array(N * 2), 2);
  [this.aPos, this.aTam, this.aCol, this.aVar].forEach(a => a.setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('iPos', this.aPos); g.setAttribute('iTam', this.aTam); g.setAttribute('iCol', this.aCol); g.setAttribute('iVar', this.aVar); g.instanceCount = 0;
  const vs = `attribute vec3 iPos; attribute float iTam; attribute vec4 iCol; attribute vec2 iVar; varying vec2 vUv; varying vec4 vCol; varying float vSeed; varying float vFade;
    void main(){ vUv = uv - 0.5; float c = cos(iVar.x), s = sin(iVar.x); vec2 q = vec2(c * position.x - s * position.y, s * position.x + c * position.y);
      vec3 rgt = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]), up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
      vec4 mv = viewMatrix * vec4(iPos + (rgt * q.x + up * q.y) * iTam, 1.0); vFade = smoothstep(iTam * 0.15, iTam * 0.9 + 0.5, -mv.z);
      vCol = iCol; vSeed = iVar.y; gl_Position = projectionMatrix * mv; }`;
  const fsHumo = `uniform vec3 uSolV; uniform vec3 uColSol; uniform vec3 uAmb; uniform float uT; varying vec2 vUv; varying vec4 vCol; varying float vSeed; varying float vFade; ${GLSL_RUIDO}
    void main(){ float r = length(vUv) * 2.0; if (r > 1.0) discard;
      float n = fbm(vUv * 3.1 + vSeed * 17.0 + vec2(uT * 0.03, -uT * 0.05));
      float d = smoothstep(1.0, 0.15, r + (n - 0.5) * 0.95);
      vec3 N = normalize(vec3(vUv * 2.0 + (n - 0.5) * 0.6, sqrt(max(0.0, 1.0 - r * r)) + 0.2));
      float luz = 0.45 + 0.55 * clamp(dot(N, uSolV) * 0.5 + 0.5, 0.0, 1.0);
      vec3 col = vCol.rgb * (max(uAmb, vec3(0.22)) + uColSol * luz) * (0.9 + 0.2 * n); float lu = dot(col, vec3(0.3, 0.59, 0.11)); col = mix(col, vec3(lu), 0.35);
      float a = vCol.a * d * vFade; if (a < 0.004) discard; gl_FragColor = vec4(col, a); }`;
  const fsBrillo = `uniform float uT; varying vec2 vUv; varying vec4 vCol; varying float vSeed; varying float vFade; ${GLSL_RUIDO}
    void main(){ float r = length(vUv) * 2.0; if (r > 1.0) discard;
      float n = fbm(vUv * 4.0 + vec2(vSeed * 13.0, -uT * 2.5 + vSeed * 7.0));
      float a = pow(max(0.0, 1.0 - r), 1.4) * (0.55 + 0.75 * n);
      vec3 col = mix(vCol.rgb, vec3(1.0, 0.97, 0.85), smoothstep(0.55, 0.0, r) * 0.6);
      gl_FragColor = vec4(col * a * vCol.a * vFade, 1.0); }`;
  this.mat = new THREE.ShaderMaterial({uniforms: U, vertexShader: vs, fragmentShader: modo === 'brillo' ? fsBrillo : fsHumo, transparent: true, depthWrite: false,
    blending: modo === 'brillo' ? THREE.AdditiveBlending : THREE.NormalBlending, fog: false});
  this.mesh = new THREE.Mesh(g, this.mat); this.mesh.frustumCulled = false; this.mesh.name = modo === 'brillo' ? 'fx_brillo' : 'fx_humo'; this.mesh.renderOrder = modo === 'brillo' ? 4 : 3;
  // rejilla de densidad (solo humo): listas enlazadas en arrays tipados, celdas de 8 u con hash
  if (modo === 'humo') { this.celda = 8; this.NC = 4096; this.cab = new Int32Array(this.NC).fill(-1); this.sig = new Int32Array(N).fill(-1); }
}
// emite una partícula; devuelve su índice. Todo por argumentos sueltos (sin arrays temporales)
Nube.prototype.emitir = function (x, y, z, vx, vy, vz, tam, crece, vida, den, r, g, b, flota, arr, acop, forma, semilla, rot, giro) {
  let i = this.cur, k = 0; while (this.vida[i] > 0 && k < this.N) { i = (i + 1) % this.N; k++; }   // primera libre desde el cursor; si no hay, se recicla la más antigua del anillo
  this.cur = (i + 1) % this.N; const j = i * 3;
  this.P[j] = x; this.P[j + 1] = y; this.P[j + 2] = z; this.V[j] = vx; this.V[j + 1] = vy; this.V[j + 2] = vz; this.C[j] = r; this.C[j + 1] = g; this.C[j + 2] = b;
  this.edad[i] = 0; this.vida[i] = vida; this.tam0[i] = tam; this.crece[i] = crece; this.den[i] = den; this.flota[i] = flota; this.arr[i] = arr; this.acop[i] = acop; this.forma[i] = forma;
  this.semilla[i] = semilla; this.rot[i] = rot; this.giro[i] = giro; this.R[i] = tam * 0.5; return i; };
Nube.prototype.actualizar = function (dt, vx, vz, H) {
  const P = this.P, V = this.V, aP = this.aPos.array, aT = this.aTam.array, aC = this.aCol.array, aV = this.aVar.array, humo = this.modo === 'humo'; let n = 0;
  if (humo) this.cab.fill(-1);
  for (let i = 0; i < this.N; i++) { if (this.vida[i] <= 0) continue; this.edad[i] += dt; const e = this.edad[i], vi = this.vida[i]; if (e >= vi) { this.vida[i] = -1; continue; }
    const j = i * 3, k = e / vi, ac = this.acop[i], ar = this.arr[i];
    // arrastre hacia el viento (acoplamiento), flotación (+ sube, − se posa) y frenado
    V[j] += (vx * ac - V[j]) * Math.min(1, ar * dt); V[j + 2] += (vz * ac - V[j + 2]) * Math.min(1, ar * dt); V[j + 1] += (this.flota[i] - V[j + 1]) * Math.min(1, ar * dt * 0.8);
    if (!humo && this.forma[i] === 3) V[j + 1] -= G * dt;   // chispa pesada / terrón
    P[j] += V[j] * dt; P[j + 1] += V[j + 1] * dt; P[j + 2] += V[j + 2] * dt;
    if (H) { const h = H(P[j], P[j + 2]) + this.R[i] * (humo ? 0.35 : 0.1); if (P[j + 1] < h) { P[j + 1] = h; if (V[j + 1] < 0) V[j + 1] = 0; } }
    this.rot[i] += this.giro[i] * dt;
    let tam, alfa;
    if (humo) { tam = this.tam0[i] * (1 + this.crece[i] * Math.sqrt(k)); alfa = this.den[i] * Math.pow(1 - k, this.forma[i] || 1.6) * smooth(0, 0.04, k + 0.004); }
    else { const f = this.forma[i]; tam = this.tam0[i] * (f === 1 ? (1 + this.crece[i] * k) : f === 0 ? (1 - 0.7 * k) * (1 + this.crece[i] * 0.3 * Math.sin(e * 23 + this.semilla[i] * 9)) : 1); alfa = this.den[i] * (f === 1 ? (1 - k) * (1 - k) : (1 - k)); }
    this.R[i] = tam * 0.5;
    aP[n * 3] = P[j]; aP[n * 3 + 1] = P[j + 1]; aP[n * 3 + 2] = P[j + 2]; aT[n] = tam;
    // brillo: la llama pasa de amarillo a rojo oscuro con la edad
    if (!humo && this.forma[i] === 0) { aC[n * 4] = this.C[j]; aC[n * 4 + 1] = this.C[j + 1] * (1 - 0.6 * k); aC[n * 4 + 2] = this.C[j + 2] * (1 - k); }
    else { aC[n * 4] = this.C[j]; aC[n * 4 + 1] = this.C[j + 1]; aC[n * 4 + 2] = this.C[j + 2]; }
    aC[n * 4 + 3] = alfa; aV[n * 2] = this.rot[i]; aV[n * 2 + 1] = this.semilla[i];
    if (humo) { const c = this.hash(P[j], P[j + 2]); this.sig[i] = this.cab[c]; this.cab[c] = i; }
    n++; }
  this.n = n; this.mesh.geometry.instanceCount = n;
  if (n) { this.aPos.needsUpdate = this.aTam.needsUpdate = this.aCol.needsUpdate = this.aVar.needsUpdate = true; }
};
Nube.prototype.hash = function (x, z) { const ci = Math.floor(x / this.celda), cj = Math.floor(z / this.celda); return ((Math.imul(ci, 92821) ^ Math.imul(cj, 68917)) >>> 0) % this.NC; };
// densidad de humo en un punto (1/u): suma de gaussianas de las bocanadas de las 9 celdas vecinas
Nube.prototype.densidad = function (x, y, z) {
  let d = 0; const ci = Math.floor(x / this.celda), cj = Math.floor(z / this.celda);
  for (let a = ci - 1; a <= ci + 1; a++) for (let b = cj - 1; b <= cj + 1; b++) { const c = ((Math.imul(a, 92821) ^ Math.imul(b, 68917)) >>> 0) % this.NC;
    for (let i = this.cab[c]; i >= 0; i = this.sig[i]) { const j = i * 3; if (Math.floor(this.P[j] / this.celda) !== a || Math.floor(this.P[j + 2] / this.celda) !== b) continue;
      const R = Math.max(0.3, this.R[i]), dx = x - this.P[j], dy = y - this.P[j + 1], dz = z - this.P[j + 2], q = (dx * dx + dy * dy + dz * dz) / (R * R);
      if (q < 4) { const k = this.edad[i] / this.vida[i]; d += this.den[i] * Math.pow(1 - k, this.forma[i] || 1.6) * Math.exp(-q * 1.5) / R; } } }
  return d; };
// fracción de luz que pasa de a a b (1 limpio … 0 opaco); para la IA: < 0,3 → el tirador no ve
Nube.prototype.transmitancia = function (ax, ay, az, bx, by, bz, paso) {
  const L = Math.hypot(bx - ax, by - ay, bz - az); paso = paso || 2 * MU; const n = Math.max(1, Math.ceil(L / paso)); let tau = 0;
  for (let i = 0; i < n; i++) { const t = (i + 0.5) / n; tau += this.densidad(ax + (bx - ax) * t, ay + (by - ay) * t, az + (bz - az) * t) * (L / n) * 1.6; } return Math.exp(-tau); };

/* ---------- LÍNEAS aditivas en anillo (chispas y estelas): 2 vértices por segmento, color con la intensidad ya aplicada ---------- */
function Lineas(N, nombre, aditivo) {
  this.N = N; this.n = 0; const g = new THREE.BufferGeometry(); this.pos = new Float32Array(N * 6); this.col = new Float32Array(N * 8);
  g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage)); g.setAttribute('color', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage)); g.setDrawRange(0, 0);
  this.mat = new THREE.ShaderMaterial({transparent: true, depthWrite: false, blending: aditivo ? THREE.AdditiveBlending : THREE.NormalBlending, fog: false,
    vertexShader: 'attribute vec4 color; varying vec4 vC; void main(){ vC = color; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: aditivo ? 'varying vec4 vC; void main(){ gl_FragColor = vec4(vC.rgb * vC.a, 1.0); }' : 'varying vec4 vC; void main(){ gl_FragColor = vC; }'});
  this.mesh = new THREE.LineSegments(g, this.mat); this.mesh.frustumCulled = false; this.mesh.name = nombre; this.mesh.renderOrder = 5;
}
Lineas.prototype.empezar = function () { this.n = 0; };
Lineas.prototype.seg = function (ax, ay, az, bx, by, bz, r, g, b, a0, a1) { if (this.n >= this.N) return; const p = this.pos, c = this.col, i = this.n * 6, k = this.n * 8;
  p[i] = ax; p[i + 1] = ay; p[i + 2] = az; p[i + 3] = bx; p[i + 4] = by; p[i + 5] = bz; c[k] = r; c[k + 1] = g; c[k + 2] = b; c[k + 3] = a0; c[k + 4] = r; c[k + 5] = g; c[k + 6] = b; c[k + 7] = a1; this.n++; };
Lineas.prototype.terminar = function () { const g = this.mesh.geometry; g.setDrawRange(0, this.n * 2); if (this.n) { g.attributes.position.needsUpdate = true; g.attributes.color.needsUpdate = true; } };

/* ===================================================================================== */
/* PRECIPITACIÓN: lluvia (segmentos) y nieve (puntos) en una caja que sigue a la cámara; el movimiento lo hace el sombreador */
function Precipitacion(N, tipo, U) {
  const caja = tipo === 'lluvia' ? 70 : 90, r = rng(tipo === 'lluvia' ? 11 : 23), g = new THREE.BufferGeometry(), nv = tipo === 'lluvia' ? 2 : 1;
  const P = new Float32Array(N * nv * 3), S = new Float32Array(N * nv * 2);
  for (let i = 0; i < N; i++) { const x = r() * caja, y = r() * caja * 0.6, z = r() * caja, s = r(); for (let k = 0; k < nv; k++) { const q = (i * nv + k); P[q * 3] = x; P[q * 3 + 1] = y; P[q * 3 + 2] = z; S[q * 2] = s; S[q * 2 + 1] = k; } }
  g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('extra', new THREE.BufferAttribute(S, 2)); g.setDrawRange(0, 0);
  const comun = `uniform vec3 uCam; uniform float uT; uniform vec2 uViento; attribute vec2 extra; const float CAJA = ${caja.toFixed(1)};
    vec3 envolver(vec3 p){ vec3 c = vec3(CAJA, CAJA * 0.6, CAJA); vec3 o = uCam - c * 0.5; o.y = uCam.y - c.y * 0.45; return mod(p - o, c) + o; }`;
  const vs = tipo === 'lluvia' ? `${comun} uniform float uIntens; varying float vA;
    void main(){ float vel = 14.0 * ${MU.toFixed(4)} * (0.85 + 0.3 * extra.x); vec3 dir = normalize(vec3(uViento.x * 0.35, -vel, uViento.y * 0.35));
      vec3 p = envolver(position + dir * uT * vel * 1.02); if (extra.y > 0.5) p -= dir * (0.55 + 0.4 * extra.x) * ${MU.toFixed(4)};
      vA = 0.35 + 0.25 * extra.x; gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0); }`
    : `${comun} varying float vA;
    void main(){ float vel = 1.1 * ${MU.toFixed(4)} * (0.7 + 0.6 * extra.x); vec3 p = position + vec3(uViento.x * 0.4 * uT + sin(uT * 0.9 + extra.x * 30.0) * 0.6, -vel * uT, uViento.y * 0.4 * uT + cos(uT * 0.7 + extra.x * 20.0) * 0.6);
      p = envolver(p); vec4 mv = viewMatrix * vec4(p, 1.0); gl_PointSize = min(9.0, (1.0 + 1.3 * extra.x) * 110.0 / max(1.0, -mv.z)); vA = 0.9; gl_Position = projectionMatrix * mv; }`;
  const fs = tipo === 'lluvia' ? 'uniform vec3 uColLluvia; varying float vA; void main(){ gl_FragColor = vec4(uColLluvia, vA); }'
    : 'varying float vA; void main(){ vec2 d = gl_PointCoord - 0.5; float r = length(d) * 2.0; if (r > 1.0) discard; gl_FragColor = vec4(0.95, 0.96, 1.0, vA * (1.0 - r * r)); }';
  const mat = new THREE.ShaderMaterial({uniforms: U, vertexShader: vs, fragmentShader: fs, transparent: true, depthWrite: false, fog: false});
  this.mesh = tipo === 'lluvia' ? new THREE.LineSegments(g, mat) : new THREE.Points(g, mat); this.mesh.frustumCulled = false; this.mesh.name = 'fx_' + tipo; this.N = N; this.nv = nv;
}
Precipitacion.prototype.intensidad = function (k) { this.mesh.geometry.setDrawRange(0, Math.round(clamp(k, 0, 1) * this.N) * this.nv); this.mesh.visible = k > 0.001; };

/* ===================================================================================== */
/* CALCOS EN EL SUELO: pisadas (0), herraduras (1), rodadas (2), surcos de bala (3), quemado (4), charco/salpicadura (5). Se dibujan y se
   desvanecen en el sombreador; la CPU solo escribe al añadir (anillo). Superficie: 0 seco, 1 barro, 2 nieve */
function Calcos(N, U) {
  this.N = N; this.cur = 0; this.total = 0; const g = new THREE.InstancedBufferGeometry(), base = new THREE.PlaneGeometry(1, 1); base.rotateX(-Math.PI / 2);
  g.index = base.index; g.setAttribute('position', base.attributes.position); g.setAttribute('uv', base.attributes.uv);
  this.a = new THREE.InstancedBufferAttribute(new Float32Array(N * 4), 4); this.b = new THREE.InstancedBufferAttribute(new Float32Array(N * 4), 4); this.c = new THREE.InstancedBufferAttribute(new Float32Array(N * 2), 2);
  for (let i = 0; i < N; i++) this.b.array[i * 4 + 1] = -1e6;   // nacidas «hace mucho»: invisibles
  g.setAttribute('iA', this.a); g.setAttribute('iB', this.b); g.setAttribute('iC', this.c); g.instanceCount = N;
  const mat = new THREE.ShaderMaterial({uniforms: U, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4, fog: false,
    vertexShader: `attribute vec4 iA; attribute vec4 iB; attribute vec2 iC; uniform float uT; varying vec2 vUv; varying float vTipo; varying float vSup; varying float vA; varying float vSeed;
      void main(){ vUv = uv - 0.5; vTipo = iB.x; vSup = iB.w; vSeed = iC.y; float edad = uT - iB.y; vA = (1.0 - smoothstep(iB.z * 0.55, iB.z, edad)) * step(0.0, edad);
        float c = cos(iA.w), s = sin(iA.w);
        float esc = iC.x; vec2 xz = vec2(position.x * esc * (vTipo > 1.5 && vTipo < 2.5 ? 0.35 : 1.0), position.z * esc);   // rodada: estrecha y larga
        vec2 r = vec2(c * xz.x + s * xz.y, -s * xz.x + c * xz.y);
        gl_Position = projectionMatrix * viewMatrix * vec4(iA.x + r.x, iA.y, iA.z + r.y, 1.0); }`,
    fragmentShader: `uniform vec3 uColSeco; uniform vec3 uColBarro; uniform vec3 uColNieve; varying vec2 vUv; varying float vTipo; varying float vSup; varying float vA; varying float vSeed; ${GLSL_RUIDO}
      void main(){ vec2 p = vUv; float m = 0.0, borde = 0.0, n = n2(p * 9.0 + vSeed * 31.0);
        if (vTipo < 0.5) { float s = length((p - vec2(0.0, 0.12)) / vec2(0.17, 0.27)), t = length((p - vec2(0.0, -0.3)) / vec2(0.14, 0.13)); float e = min(s, t); m = 1.0 - smoothstep(0.85, 1.0, e); borde = smoothstep(0.75, 1.0, e) * (1.0 - smoothstep(1.0, 1.25, e)); }
        else if (vTipo < 1.5) { float r = length(p) * 2.0, a = atan(p.x, -p.y); m = (1.0 - smoothstep(0.82, 0.92, r)) * smoothstep(0.42, 0.52, r) * step(0.55, abs(a)); m = max(m, (1.0 - smoothstep(0.5, 0.6, r)) * 0.45); borde = (1.0 - smoothstep(0.92, 1.0, r)) * smoothstep(0.86, 0.92, r); }
        else if (vTipo < 2.5) { float x = abs(p.x) * 2.0; m = (1.0 - smoothstep(0.7, 0.95, x)) * (0.75 + 0.25 * step(0.5, fract(p.y * 9.0))); borde = smoothstep(0.85, 1.0, x); }
        else if (vTipo < 3.5) { float e = length(p / vec2(0.22, 0.5)); m = (1.0 - smoothstep(0.75, 1.0, e)) * (0.7 + 0.3 * n); borde = smoothstep(0.9, 1.0, e) * (1.0 - smoothstep(1.0, 1.4, e)); }
        else if (vTipo < 4.5) { float r = length(p) * 2.0 + (n - 0.5) * 0.5; m = (1.0 - smoothstep(0.4, 1.0, r)) * (0.6 + 0.4 * n); }
        else { float r = length(p) * 2.0; m = (1.0 - smoothstep(0.6, 1.0, r)) * 0.6; }
        vec3 col = vSup < 0.5 ? uColSeco : vSup < 1.5 ? uColBarro : uColNieve; if (vTipo > 3.5 && vTipo < 4.5) col = vec3(0.07, 0.06, 0.05);
        float a = (m * (vSup > 1.5 ? 0.55 : vSup > 0.5 ? 0.75 : 0.4) + borde * 0.25) * vA; if (a < 0.01) discard;
        vec3 c2 = mix(col, col * 1.6 + 0.1, borde);   // labio levantado más claro (barro mojado / nieve apartada)
        gl_FragColor = vec4(c2, a); }`});
  this.mesh = new THREE.Mesh(g, mat); this.mesh.frustumCulled = false; this.mesh.name = 'fx_calcos'; this.mesh.renderOrder = 1;
}
Calcos.prototype.poner = function (x, y, z, rot, tipo, esc, t0, vida, sup, semilla) {
  const i = this.cur; this.cur = (this.cur + 1) % this.N; this.total++; const A = this.a.array, B = this.b.array, Cc = this.c.array;
  A[i * 4] = x; A[i * 4 + 1] = y; A[i * 4 + 2] = z; A[i * 4 + 3] = rot; B[i * 4] = tipo; B[i * 4 + 1] = t0; B[i * 4 + 2] = vida; B[i * 4 + 3] = sup; Cc[i * 2] = esc; Cc[i * 2 + 1] = semilla;
  this.a.needsUpdate = this.b.needsUpdate = this.c.needsUpdate = true; return i; };

/* ===================================================================================== */
/* ONDAS DE CHOQUE: anillo a ras de suelo y cúpula, calculados en el sombreador a partir del instante de inicio (sin CPU por fotograma) */
function Ondas(N, U) {
  this.N = N; this.cur = 0; const mk = (base, cupula) => { const g = new THREE.InstancedBufferGeometry(); g.index = base.index; g.setAttribute('position', base.attributes.position); g.setAttribute('normal', base.attributes.normal);
    const a = new THREE.InstancedBufferAttribute(new Float32Array(N * 4), 4), b = new THREE.InstancedBufferAttribute(new Float32Array(N * 2), 2); for (let i = 0; i < N; i++) a.array[i * 4 + 3] = -1e6; g.setAttribute('iO', a); g.setAttribute('iR', b); g.instanceCount = N;
    const m = new THREE.ShaderMaterial({uniforms: U, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: cupula ? THREE.AdditiveBlending : THREE.NormalBlending, fog: false,
      vertexShader: `attribute vec4 iO; attribute vec2 iR; uniform float uT; varying float vK; varying vec3 vN; varying vec3 vV; varying float vR;
        void main(){ float k = (uT - iO.w) / iR.y; vK = k; float s = (k < 0.0 || k > 1.0) ? 0.0 : iR.x * (1.0 - pow(1.0 - k, 2.2)); vR = length(position.xz);
          vec3 p = iO.xyz + position * max(s, 0.0001); vN = normalize(mat3(viewMatrix) * normal); vec4 mv = viewMatrix * vec4(p, 1.0); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: cupula ? `varying float vK; varying vec3 vN; varying vec3 vV; void main(){ if (vK < 0.0 || vK > 1.0) discard; float f = pow(1.0 - abs(dot(vN, vV)), 3.0); gl_FragColor = vec4(vec3(1.0, 0.92, 0.8) * f * 0.55 * (1.0 - vK), 1.0); }`
        : `varying float vK; varying float vR; void main(){ if (vK < 0.0 || vK > 1.0) discard; float a = smoothstep(0.7, 0.98, vR) * (1.0 - smoothstep(0.98, 1.0, vR)) * (1.0 - vK) * 0.65; gl_FragColor = vec4(0.82, 0.76, 0.66, a); }`});
    const mesh = new THREE.Mesh(g, m); mesh.frustumCulled = false; return {mesh, a, b}; };
  const anillo = new THREE.CircleGeometry(1, 40); anillo.rotateX(-Math.PI / 2); this.anillo = mk(anillo, false); this.anillo.mesh.name = 'fx_onda_suelo';
  const cup = new THREE.SphereGeometry(1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2); this.cupula = mk(cup, true); this.cupula.mesh.name = 'fx_onda_cupula'; this.cupula.mesh.renderOrder = 6;
}
Ondas.prototype.lanzar = function (x, y, z, R, t0) { const i = this.cur; this.cur = (this.cur + 1) % this.N;
  [[this.anillo, R, 0.55], [this.cupula, R * 0.55, 0.22]].forEach(([o, r, d]) => { o.a.array[i * 4] = x; o.a.array[i * 4 + 1] = y + 0.1; o.a.array[i * 4 + 2] = z; o.a.array[i * 4 + 3] = t0; o.b.array[i * 2] = r; o.b.array[i * 2 + 1] = d; o.a.needsUpdate = o.b.needsUpdate = true; }); };

/* ===================================================================================== */
/* RESTOS CON FÍSICA (terrones, astillas, cascotes): un InstancedMesh; botan, se paran y se hunden al acabar */
function Restos(N) {
  this.N = N; this.cur = 0; this.P = new Float32Array(N * 3); this.V = new Float32Array(N * 3); this.W = new Float32Array(N * 3); this.Rt = new Float32Array(N * 3); this.vida = new Float32Array(N).fill(-1); this.edad = new Float32Array(N); this.tam = new Float32Array(N); this.quieto = new Uint8Array(N); this.col = new Float32Array(N * 3);
  const geo = new THREE.IcosahedronGeometry(1, 0); const pos = geo.attributes.position; for (let i = 0; i < pos.count; i++) pos.setXYZ(i, pos.getX(i) * (0.8 + 0.4 * ((i * 7) % 5) / 4), pos.getY(i) * 0.65, pos.getZ(i)); geo.computeVertexNormals();
  this.mesh = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({color: 0xffffff}), N); this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.mesh.count = 0; this.mesh.castShadow = true; this.mesh.frustumCulled = false; this.mesh.name = 'fx_restos';
  this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(N * 3), 3); this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._e = new THREE.Euler(); this._v = new THREE.Vector3(); this._s = new THREE.Vector3(); this._c = new THREE.Color();
}
Restos.prototype.lanzar = function (x, y, z, vx, vy, vz, tam, vida, col) { let i = this.cur, k = 0; while (this.vida[i] > 0 && k < this.N) { i = (i + 1) % this.N; k++; } this.cur = (i + 1) % this.N; const j = i * 3;
  this.P[j] = x; this.P[j + 1] = y; this.P[j + 2] = z; this.V[j] = vx; this.V[j + 1] = vy; this.V[j + 2] = vz; this.W[j] = (vx - vz) * 0.7; this.W[j + 1] = vy * 0.3; this.W[j + 2] = (vz + vx) * 0.7; this.Rt[j] = this.Rt[j + 1] = this.Rt[j + 2] = 0;
  this.vida[i] = vida; this.edad[i] = 0; this.tam[i] = tam; this.quieto[i] = 0; this._c.setHex(col); this.col[j] = this._c.r; this.col[j + 1] = this._c.g; this.col[j + 2] = this._c.b; };
Restos.prototype.actualizar = function (dt, H) { let n = 0; const m = this._m;
  for (let i = 0; i < this.N; i++) { if (this.vida[i] <= 0) continue; this.edad[i] += dt; if (this.edad[i] >= this.vida[i]) { this.vida[i] = -1; continue; } const j = i * 3;
    if (!this.quieto[i]) { this.V[j + 1] -= G * dt; this.P[j] += this.V[j] * dt; this.P[j + 1] += this.V[j + 1] * dt; this.P[j + 2] += this.V[j + 2] * dt; this.Rt[j] += this.W[j] * dt; this.Rt[j + 1] += this.W[j + 1] * dt; this.Rt[j + 2] += this.W[j + 2] * dt;
      const h = (H ? H(this.P[j], this.P[j + 2]) : 0) + this.tam[i] * 0.5; if (this.P[j + 1] < h) { this.P[j + 1] = h; if (this.V[j + 1] < -2 * MU) { this.V[j + 1] *= -0.25; this.V[j] *= 0.45; this.V[j + 2] *= 0.45; this.W[j] *= 0.5; this.W[j + 2] *= 0.5; } else this.quieto[i] = 1; } }
    const k = this.edad[i] / this.vida[i], s = this.tam[i] * (k > 0.85 ? (1 - k) / 0.15 : 1);
    this._e.set(this.Rt[j], this.Rt[j + 1], this.Rt[j + 2]); this._q.setFromEuler(this._e); this._v.set(this.P[j], this.P[j + 1], this.P[j + 2]); this._s.set(s, s, s); m.compose(this._v, this._q, this._s);
    // el color va por índice de partícula: se copia al hueco compacto n
    const ic = this.mesh.instanceColor.array; ic[n * 3] = this.col[j]; ic[n * 3 + 1] = this.col[j + 1]; ic[n * 3 + 2] = this.col[j + 2];
    this.mesh.setMatrixAt(n++, m); }
  this.mesh.count = n; if (n) { this.mesh.instanceMatrix.needsUpdate = true; this.mesh.instanceColor.needsUpdate = true; } this.n = n; };

/* ===================================================================================== */
/* NIEBLA DE SUELO: 6 capas horizontales alrededor de la cámara (una sola malla), con ruido que deriva con el viento */
function NieblaSuelo(U) {
  const capas = 12, g = new THREE.BufferGeometry(), P = [], A = [];
  for (let k = 0; k < capas; k++) { const y = k * 0.7 * MU, s = 1; P.push(-s, y, -s, s, y, s, s, y, -s, -s, y, -s, -s, y, s, s, y, s); for (let q = 0; q < 6; q++) A.push(k / (capas - 1)); }
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('capa', new THREE.Float32BufferAttribute(A, 1));
  const mat = new THREE.ShaderMaterial({uniforms: U, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false,
    vertexShader: `attribute float capa; uniform vec3 uCam; uniform float uRadioN; uniform float uSueloN; varying vec3 vW; varying float vCapa;
      void main(){ vCapa = capa; vec3 p = vec3(uCam.x + position.x * uRadioN, uSueloN + position.y, uCam.z + position.z * uRadioN); vW = p; gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0); }`,
    fragmentShader: `uniform vec3 uCam; uniform float uT; uniform vec2 uViento; uniform float uNiebla; uniform float uRadioN; uniform vec3 uColNiebla; varying vec3 vW; varying float vCapa; ${GLSL_RUIDO}
      void main(){ vec2 q = vW.xz * 0.012 + uViento * uT * 0.004 + vCapa * 3.7; float n = fbm(q) * 0.75 + fbm(q * 3.1 - uT * 0.01) * 0.25;
        float r = length(vW.xz - uCam.xz) / uRadioN; float a = uNiebla * smoothstep(0.32, 0.62, n) * (1.0 - smoothstep(0.55, 1.0, r)) * (1.0 - vCapa * 0.7) * 0.2;
        if (a < 0.004) discard; gl_FragColor = vec4(uColNiebla, a); }`});
  this.mesh = new THREE.Mesh(g, mat); this.mesh.frustumCulled = false; this.mesh.name = 'fx_niebla_suelo'; this.mesh.renderOrder = 2;
}

/* ===================================================================================== */
/* CIELO Y LUZ DEL DÍA: cúpula con degradado, disco solar, resplandor y estrellas; sol direccional, hemisférica y niebla de la escena */
const PALETA_SOL = [   // [elevación del sol en grados, color del sol, intensidad, cénit, horizonte, suelo de la hemisférica, intensidad hemisférica]
  [-18, 0x2a3a66, 0.0, 0x05070d, 0x0b1020, 0x05060a, 0.08], [-6, 0x50608a, 0.06, 0x101830, 0x2a2a48, 0x0c0c12, 0.14], [-1, 0xff7040, 0.25, 0x1c2c52, 0xc86040, 0x2a1e18, 0.25],
  [3, 0xff8a40, 0.75, 0x30507e, 0xf09050, 0x3a2a1e, 0.38], [10, 0xffc27a, 1.35, 0x4a76b0, 0xf0c090, 0x4a3a28, 0.5], [25, 0xffe8c8, 1.9, 0x5a8cd0, 0xc8dcea, 0x4e4430, 0.6],
  [60, 0xfff6ea, 2.2, 0x4f86d2, 0xbcd6ee, 0x504838, 0.65]];
function crearCielo(escena, op) {
  op = Object.assign({amanecer: 6.5, ocaso: 19.5, elevMax: 58, norte: 0, radio: 2400, sol: null, hemi: null, distSombra: 260}, op || {});
  const U = {uSolDir: {value: new THREE.Vector3(0, 1, 0)}, uCenit: {value: new THREE.Color()}, uHoriz: {value: new THREE.Color()}, uColSolC: {value: new THREE.Color()}, uNoche: {value: 0}, uNubes: {value: 0}, uT: {value: 0}};
  const g = new THREE.SphereGeometry(op.radio, 32, 16), mat = new THREE.ShaderMaterial({uniforms: U, side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }',
    fragmentShader: `uniform vec3 uSolDir; uniform vec3 uCenit; uniform vec3 uHoriz; uniform vec3 uColSolC; uniform float uNoche; uniform float uNubes; uniform float uT; varying vec3 vD; ${GLSL_RUIDO}
      void main(){ vec3 d = normalize(vD); float h = max(d.y, -0.1); vec3 c = mix(uHoriz, uCenit, pow(smoothstep(-0.05, 0.75, h), 0.6));
        float s = max(0.0, dot(d, uSolDir)); c += uColSolC * (pow(s, 900.0) * 6.0 * (1.0 - uNubes) + pow(s, 12.0) * 0.35 + pow(s, 3.0) * 0.12 * (1.0 - smoothstep(0.0, 0.4, uSolDir.y)));
        vec2 q = d.xz / max(0.08, d.y + 0.15); float nb = fbm(q * 1.4 + uT * 0.004); float cob = smoothstep(0.55 - uNubes * 0.55, 0.95 - uNubes * 0.3, nb) * smoothstep(-0.02, 0.15, d.y);
        vec3 colNube = mix(uHoriz * 1.05, vec3(0.55, 0.57, 0.6) * (0.4 + 0.6 * (1.0 - uNoche)), uNubes * 0.7) + uColSolC * pow(s, 4.0) * 0.4;
        c = mix(c, colNube, cob * (0.35 + 0.6 * uNubes));
        if (uNoche > 0.01 && d.y > 0.0) { vec2 e = floor(d.xz / (d.y + 0.3) * 260.0); float st = step(0.9965, hh(e)); c += vec3(st) * uNoche * (1.0 - cob) * 0.9; }
        gl_FragColor = vec4(c, 1.0); }`});
  const cupula = new THREE.Mesh(g, mat); cupula.name = 'fx_cielo'; cupula.frustumCulled = false; cupula.renderOrder = -10;
  const sol = op.sol || new THREE.DirectionalLight(0xffffff, 2), hemi = op.hemi || new THREE.HemisphereLight(0xbcd6ee, 0x504838, 0.6);
  if (escena) { escena.add(cupula); if (!op.sol) { escena.add(sol); escena.add(sol.target); } if (!op.hemi) escena.add(hemi); }
  const _a = new THREE.Color(), _b = new THREE.Color(), est = {hora: 12, elev: 0, nubes: 0, oscurece: 0, horizonte: new THREE.Color(), dir: new THREE.Vector3()};
  const tabla = (el, k, out) => { let i = 0; while (i < PALETA_SOL.length - 2 && el > PALETA_SOL[i + 1][0]) i++; const A = PALETA_SOL[i], B = PALETA_SOL[i + 1], t = clamp((el - A[0]) / (B[0] - A[0]), 0, 1);
    if (typeof A[k] === 'number' && k !== 2 && k !== 6) { _a.setHex(A[k]); _b.setHex(B[k]); return out.copy(_a).lerp(_b, t); } return lerp(A[k], B[k], t); };
  // hora (0–24) → posición del sol: sale por el este (+x), culmina al sur (−z), se pone por el oeste; la noche es simétrica (sol bajo el horizonte)
  function hora(h) { est.hora = h; const dia = op.ocaso - op.amanecer, f = (h - op.amanecer) / dia, el = f >= 0 && f <= 1 ? Math.sin(f * Math.PI) * op.elevMax : -Math.sin(((h - op.ocaso + 24) % 24) / (24 - dia) * Math.PI) * 30;
    est.elev = el; const az = (f >= 0 && f <= 1 ? f : (f > 1 ? 1 + (f - 1) * 0.3 : -0.3 + f * 0.3)) * Math.PI + op.norte, e = el * Math.PI / 180;
    est.dir.set(Math.cos(az) * Math.cos(e), Math.sin(e), -Math.sin(az) * Math.cos(e)).normalize(); aplicar(); return est; }
  function aplicar() { const el = est.elev, nb = est.nubes, gris = 0.62;
    tabla(el, 3, U.uCenit.value); tabla(el, 4, U.uHoriz.value); tabla(el, 1, U.uColSolC.value);
    if (nb > 0) { const lum = 0.35 + 0.65 * smooth(-8, 20, el); _a.setRGB(gris * lum, gris * lum * 1.01, gris * lum * 1.04); U.uCenit.value.lerp(_a, nb * 0.85); U.uHoriz.value.lerp(_a, nb * 0.8); }
    U.uSolDir.value.copy(est.dir); U.uNoche.value = smooth(-2, -12, el); U.uNubes.value = nb;
    sol.color.copy(U.uColSolC.value); sol.intensity = tabla(el, 2) * (1 - 0.8 * nb) * (1 - est.oscurece); hemi.color.copy(U.uCenit.value).lerp(U.uHoriz.value, 0.5); tabla(el, 5, hemi.groundColor); hemi.intensity = tabla(el, 6) * (1 - 0.2 * nb) + 0.04;
    est.horizonte.copy(U.uHoriz.value); }
  function nubes(k, osc) { est.nubes = clamp(k, 0, 1); est.oscurece = clamp(osc || 0, 0, 0.9); aplicar(); }
  // sigue a la cámara; la sombra (cámara ortográfica del sol) se centra en el objetivo y se alarga cuando el sol está bajo
  function actualizar(cam, objetivo, t) { if (cam) cupula.position.copy(cam.position); U.uT.value = t || 0;
    const ox = objetivo ? objetivo.x : cam ? cam.position.x : 0, oz = objetivo ? objetivo.z : cam ? cam.position.z : 0, oy = objetivo ? objetivo.y : 0, d = op.distSombra;
    sol.target.position.set(ox, oy, oz); sol.position.set(ox + est.dir.x * d, oy + Math.max(0.05, est.dir.y) * d, oz + est.dir.z * d); sol.target.updateMatrixWorld();
    sol.visible = est.elev > -1.5; }
  hora(op.hora != null ? op.hora : 10);
  return {cupula, sol, hemi, hora, nubes, actualizar, estado: est, uniforms: U};
}

/* ===================================================================================== */
/* GESTOR DE EFECTOS */
// tipos de humo (medidas en metros y segundos; «vida» es el tiempo de disipación con aire en calma y humedad media)
// Pólvora negra: humo blanco grisáceo, denso y persistente; la pólvora sin humo (Poudre B, 1886; cordita, 1889) deja solo un velo tenue.
const TIPOS_HUMO = {
  polvora: {col: [0.86, 0.86, 0.85], den: 0.5, tam: 1.3, crece: 3.4, vida: 45, flota: 0.22, arr: 0.7, acop: 1, forma: 1.3},
  canon: {col: [0.84, 0.84, 0.83], den: 0.62, tam: 2.6, crece: 3.6, vida: 70, flota: 0.3, arr: 0.55, acop: 1, forma: 1.2},
  sinHumo: {col: [0.78, 0.79, 0.8], den: 0.1, tam: 0.6, crece: 2.2, vida: 4, flota: 0.4, arr: 1, acop: 1, forma: 2},
  obus: {col: [0.3, 0.28, 0.26], den: 0.72, tam: 3.0, crece: 2.6, vida: 50, flota: 1.4, arr: 0.5, acop: 0.9, forma: 1.5},
  incendio: {col: [0.16, 0.15, 0.14], den: 0.62, tam: 2.0, crece: 3.2, vida: 28, flota: 2.6, arr: 0.6, acop: 0.8, forma: 1.6},
  polvo: {col: [0.64, 0.56, 0.44], den: 0.3, tam: 1.6, crece: 2.2, vida: 12, flota: -0.05, arr: 1.4, acop: 0.7, forma: 1.8},
  tierra: {col: [0.36, 0.29, 0.22], den: 0.8, tam: 1.4, crece: 1.8, vida: 3.5, flota: -2.5, arr: 0.35, acop: 0.2, forma: 1.2},
  agua: {col: [0.88, 0.9, 0.92], den: 0.55, tam: 0.9, crece: 1.6, vida: 1.6, flota: -3, arr: 0.3, acop: 0.1, forma: 1.5},
  nieve: {col: [0.94, 0.95, 0.97], den: 0.5, tam: 1.0, crece: 2, vida: 3, flota: -0.4, arr: 1, acop: 0.6, forma: 1.5},
  chimenea: {col: [0.6, 0.6, 0.61], den: 0.32, tam: 0.7, crece: 4.5, vida: 16, flota: 1.1, arr: 0.8, acop: 1, forma: 1.6}};
const COL_SUELO = {tierra: 0x5a4632, barro: 0x3e3022, piedra: 0x7a7670, nieve: 0xe8ecf0, camino: 0x8a7458, madera: 0x8a6a44, hierba: 0x4a5a30};
function crearEfectos(escena, op) {
  op = Object.assign({alturaFn: null, terreno: null, camara: null, viento: [1.2, 0.4], hora: 10, era: 'A', semilla: 1, calidad: 'alta', sol: null, hemi: null, cielo: true, gestionarNiebla: true,
    superficieFn: null, humedad: 0.5, disipacion: 1, amanecer: 6.5, ocaso: 19.5}, op || {});
  const r = rng(op.semilla), Q = op.calidad === 'baja' ? 0.4 : op.calidad === 'media' ? 0.7 : 1;
  const H = op.alturaFn || (op.terreno ? (x, z) => op.terreno.height(x, z) : () => 0);
  const U = {uT: {value: 0}, uSolV: {value: new THREE.Vector3(0, 1, 0)}, uColSol: {value: new THREE.Color(1, 1, 1)}, uAmb: {value: new THREE.Color(0.5, 0.5, 0.55)}, uCam: {value: new THREE.Vector3()},
    uViento: {value: new THREE.Vector2(1, 0)}, uColLluvia: {value: new THREE.Color(0.7, 0.74, 0.8)}, uColSeco: {value: new THREE.Color(0.3, 0.24, 0.17)}, uColBarro: {value: new THREE.Color(0.17, 0.13, 0.09)},
    uColNieve: {value: new THREE.Color(0.62, 0.68, 0.8)}, uNiebla: {value: 0}, uRadioN: {value: 420}, uSueloN: {value: 0}, uColNiebla: {value: new THREE.Color(0.85, 0.87, 0.9)}};
  const grupo = new THREE.Group(); grupo.name = 'efectos_batalla';
  const humo = new Nube(Math.round(3000 * Q), 'humo', U), brillo = new Nube(Math.round(2500 * Q), 'brillo', U), chis = new Lineas(Math.round(1500 * Q), 'fx_chispas', true), est = new Lineas(64 * 12, 'fx_estelas', false);
  const lluvia = new Precipitacion(Math.round(9000 * Q), 'lluvia', U), nieve = new Precipitacion(Math.round(9000 * Q), 'nieve', U), calcos = new Calcos(Math.round(6000 * Q), U), ondas = new Ondas(16, U), restos = new Restos(Math.round(700 * Q)), niebla = new NieblaSuelo(U);
  [humo.mesh, brillo.mesh, chis.mesh, est.mesh, lluvia.mesh, nieve.mesh, calcos.mesh, ondas.anillo.mesh, ondas.cupula.mesh, restos.mesh, niebla.mesh].forEach(m => grupo.add(m));
  lluvia.intensidad(0); nieve.intensidad(0);
  const cielo = op.cielo ? crearCielo(escena, {hora: op.hora, sol: op.sol, hemi: op.hemi, amanecer: op.amanecer, ocaso: op.ocaso}) : null;
  if (escena) escena.add(grupo);
  // luces: 2 de destello (fogonazos de cañón, explosiones) y 4 para los fuegos más cercanos
  const luces = []; for (let i = 0; i < 6; i++) { const l = new THREE.PointLight(i < 2 ? 0xffc080 : 0xff8a3a, 0, (i < 2 ? 70 : 45) * MU, 2); l.visible = false; grupo.add(l); luces.push({l, t: 0, base: 0}); }
  const clima = {lluvia: 0, nieve: 0, niebla: 0, nubes: 0, humedad: op.humedad, viento: [op.viento[0], op.viento[1]], batalla: 0};
  let t = 0; const _v = new THREE.Vector3(), _c = new THREE.Color();
  const superficie = (x, z) => { if (op.superficieFn) { const s = op.superficieFn(x, z); if (s === 'nieve') return 2; if (s === 'barro') return 1; if (s === 'agua') return 1; }
    return clima.nieve > 0.25 ? 2 : (clima.lluvia > 0.15 || clima.humedad > 0.8) ? 1 : 0; };
  const vidaHumo = base => base * op.disipacion * (0.55 + clima.humedad * 0.9) / (1 + 0.22 * Math.hypot(clima.viento[0], clima.viento[1]) / MU) * (1 - 0.35 * clima.lluvia);
  function puff(T, x, y, z, vx, vy, vz, esc, denK) { const P = TIPOS_HUMO[T], s = (esc || 1) * MU, v = vidaHumo(P.vida) * (0.75 + r() * 0.5), g = 0.94 + r() * 0.12;
    return humo.emitir(x, y, z, vx, vy, vz, P.tam * s * (0.75 + r() * 0.5), P.crece * (0.8 + r() * 0.4), v, P.den * (denK || 1) * (0.8 + r() * 0.4), P.col[0] * g, P.col[1] * g, P.col[2] * g, P.flota * MU, P.arr, P.acop, P.forma, r() * 10, r() * 6.28, (r() - 0.5) * 0.15); }
  const llama = (x, y, z, vx, vy, vz, tam, vida, R, Gc, B, forma, den) => brillo.emitir(x, y, z, vx, vy, vz, tam, forma === 1 ? 1.5 : 0.4, vida, den == null ? 1 : den, R, Gc, B, forma === 2 ? 1.2 * MU : 0.9 * MU, forma === 2 ? 0.5 : 1.2, 0.3, forma, r() * 10, r() * 6.28, (r() - 0.5) * 2);
  function destello(x, y, z, intens, dur) { const L = luces[0].t <= luces[1].t ? luces[0] : luces[1]; L.l.position.set(x, y + 1.5, z); L.base = intens; L.l.intensity = intens; L.t = dur; L.l.visible = true; }
  const terrones = (x, y, z, n, vMin, vMax, cono, col, tam) => { for (let i = 0; i < n; i++) { const a = r() * 6.283, e = (1 - r() * cono) * Math.PI / 2, v = (vMin + r() * (vMax - vMin)) * MU;
    restos.lanzar(x, y, z, Math.cos(a) * Math.cos(e) * v, Math.sin(e) * v, Math.sin(a) * Math.cos(e) * v, tam * MU * (0.5 + r()), 6 + r() * 6, col); } };
  // ---------- chispas (simulación propia; dibujo en líneas aditivas) ----------
  const NCH = chis.N, cP = new Float32Array(NCH * 3), cV = new Float32Array(NCH * 3), cVida = new Float32Array(NCH).fill(-1), cEdad = new Float32Array(NCH), cCol = new Float32Array(NCH * 3); let cCur = 0;
  function chispa(x, y, z, vx, vy, vz, vida, R, Gc, B) { const i = cCur; cCur = (cCur + 1) % NCH; const j = i * 3; cP[j] = x; cP[j + 1] = y; cP[j + 2] = z; cV[j] = vx; cV[j + 1] = vy; cV[j + 2] = vz; cVida[i] = vida; cEdad[i] = 0; cCol[j] = R; cCol[j + 1] = Gc; cCol[j + 2] = B; }
  // ---------- estelas: 64 proyectiles × 12 puntos en anillo ----------
  const NE = 64, KE = 12, eId = new Int32Array(NE).fill(-1), eP = new Float32Array(NE * KE * 3), eN = new Int32Array(NE), eCab = new Int32Array(NE), eUlt = new Float32Array(NE);
  function estela(id, x, y, z) { let s = -1, libre = -1, viejo = 0; for (let i = 0; i < NE; i++) { if (eId[i] === id) { s = i; break; } if (eId[i] < 0 && libre < 0) libre = i; if (eUlt[i] < eUlt[viejo]) viejo = i; }
    if (s < 0) { s = libre >= 0 ? libre : viejo; eId[s] = id; eN[s] = 0; eCab[s] = 0; }
    const k = (eCab[s] + 1) % KE, j = (s * KE + k) * 3; eP[j] = x; eP[j + 1] = y; eP[j + 2] = z; eCab[s] = k; eN[s] = Math.min(KE, eN[s] + 1); eUlt[s] = t; }
  // ---------- tabla de emisores con estado (polvo de columnas, rastros de pisadas): direccionamiento abierto, sin Map ----------
  const NT = 1024, tId = new Int32Array(NT).fill(-1), tX = new Float32Array(NT), tZ = new Float32Array(NT), tAcum = new Float32Array(NT), tLado = new Int8Array(NT), tT = new Float32Array(NT);
  function ranura(id) { let h = ((Math.imul(id | 0, 2654435761) >>> 0) % NT), k = 0; while (k < NT) { if (tId[h] === id) return h; if (tId[h] < 0 || t - tT[h] > 30) { tId[h] = id; tX[h] = NaN; tAcum[h] = 0; tLado[h] = 1; tT[h] = t; return h; } h = (h + 1) % NT; k++; } return 0; }

  /* ---------- API de efectos puntuales ---------- */
  // disparo: fogonazo, humo (pólvora negra hasta la época C; sin humo desde la D) y destello de luz en cañones
  function disparo(p, d, o) { o = o || {}; const arma = o.arma || 'fusil', era = o.era || op.era, esc = o.escala || 1, sinHumo = 'DE'.includes(era), canon = arma !== 'fusil' && arma !== 'pistola' && arma !== 'ametralladora';
    const k = canon ? 2.2 * esc : esc, x = p[0], y = p[1], z = p[2];
    if (!o.sinFogonazo) for (let i = 0; i < (canon ? 5 : 2); i++) { const f = (0.2 + r() * (canon ? 1.6 : 0.8)) * k; llama(x + d[0] * f, y + d[1] * f, z + d[2] * f, d[0] * 4 * k, d[1] * 4 * k, d[2] * 4 * k, (0.35 + r() * 0.5) * k * MU, 0.05 + r() * 0.05, 1, 0.75, 0.35, 1, 1); }
    if (o.humo === false) { /* solo fogonazo (el humo lo pone quien llama) */ }
    else if (sinHumo) { for (let i = 0; i < (canon ? 4 : 1); i++) puff('sinHumo', x + d[0] * k, y, z + d[2] * k, d[0] * 3, d[1] * 3 + 0.5, d[2] * 3, k); }
    else { const n = canon ? 6 : 3, T = canon ? 'canon' : 'polvora', v0 = (canon ? 14 : 7) * MU;
      for (let i = 0; i < n; i++) { const f = (i + r()) / n; puff(T, x + d[0] * f * k * 1.5, y + d[1] * f * k, z + d[2] * f * k * 1.5, d[0] * v0 * (1 - f * 0.6) + (r() - 0.5) * MU, d[1] * v0 * (1 - f) + 0.3 * MU, d[2] * v0 * (1 - f * 0.6) + (r() - 0.5) * MU, esc * (canon ? 1 : 0.9)); }
      if (!canon && era === 'A') puff('polvora', x - d[2] * 0.15 * MU, y + 0.1 * MU, z + d[0] * 0.15 * MU, 0, 0.8 * MU, 0, 0.45, 0.8); }   // bocanada de la cazoleta (llave de chispa)
    if (canon) destello(x, y, z, 18 * esc, 0.09); }
  // descarga de una línea: un fogonazo por tirador y un banco de humo continuo (submuestreado si son muchos)
  function descarga(puntos, d, o) { const n = puntos.length, paso = n > 80 ? Math.ceil(n / 80) : 1; o = o || {};
    for (let i = 0; i < n; i++) { const p = puntos[i]; llama(p[0] + d[0] * 0.8 * MU, p[1], p[2] + d[2] * 0.8 * MU, d[0] * 3 * MU, 0, d[2] * 3 * MU, (0.4 + r() * 0.3) * MU, 0.05 + r() * 0.06, 1, 0.75, 0.35, 1, 1); if (i % paso === 0) disparo(p, d, Object.assign({}, o, {sinFogonazo: true, escala: Math.sqrt(paso)})); } }
  // impacto de bala: chispas en piedra y metal, astillas en madera, tierra, agua o nieve
  function impacto(p, n, mat, esc) { esc = esc || 1; n = n || [0, 1, 0]; const x = p[0], y = p[1], z = p[2];
    if (mat === 'piedra' || mat === 'metal') { for (let i = 0; i < 10 * esc; i++) chispa(x, y, z, (n[0] * 6 + (r() - 0.5) * 10) * MU, (n[1] * 6 + r() * 6) * MU, (n[2] * 6 + (r() - 0.5) * 10) * MU, 0.2 + r() * 0.35, 1, 0.78 + r() * 0.15, 0.4);
      puff('polvo', x, y, z, n[0] * 2 * MU, n[1] * 2 * MU, n[2] * 2 * MU, 0.4 * esc, 0.8); }
    else if (mat === 'madera') { terrones(x, y, z, 5 * esc, 3, 7, 0.8, COL_SUELO.madera, 0.06); puff('polvo', x, y, z, 0, 0.5 * MU, 0, 0.3 * esc, 0.6); }
    else if (mat === 'agua') { for (let i = 0; i < 3; i++) puff('agua', x, y, z, (r() - 0.5) * MU, (4 + r() * 3) * MU, (r() - 0.5) * MU, 0.6 * esc); }
    else if (mat === 'nieve') puff('nieve', x, y, z, 0, 2 * MU, 0, 0.6 * esc);
    else if (mat !== 'carne') { puff('tierra', x, y, z, n[0] * MU, (3 + r() * 2) * MU, n[2] * MU, 0.5 * esc); puff('polvo', x, y, z, 0, 0.4 * MU, 0, 0.5 * esc, 0.7); terrones(x, y, z, 3 * esc, 2, 5, 0.6, COL_SUELO[mat] || COL_SUELO.tierra, 0.05); } }
  // rebote de bala redonda: surco en el suelo, abanico de tierra a lo largo de la trayectoria y terrones; chispas si es piedra
  function rebote(p, v, mat) { const x = p[0], z = p[2], y = H(x, z), sp = Math.hypot(v[0], v[2]) || 1, ux = v[0] / sp, uz = v[2] / sp, k = clamp(sp / (120 * MU), 0.4, 1.6), sup = superficie(x, z);
    calcos.poner(x - ux * 0.6 * MU, y + 0.02, z - uz * 0.6 * MU, Math.atan2(ux, uz), 3, 1.6 * MU * k, t, sup === 2 ? 600 : 300, sup, r());
    for (let i = 0; i < 4; i++) puff(sup === 2 ? 'nieve' : 'tierra', x, y, z, (ux * (3 + r() * 5) + (r() - 0.5) * 2) * MU * k, (2 + r() * 4) * MU * k, (uz * (3 + r() * 5) + (r() - 0.5) * 2) * MU * k, 0.7 * k);
    if (sup !== 2) puff('polvo', x + ux * MU, y, z + uz * MU, ux * 2 * MU, 0.6 * MU, uz * 2 * MU, 1.1 * k, 0.9);
    terrones(x, y + 0.2, z, Math.round(8 * k), 3, 9, 0.5, sup === 2 ? COL_SUELO.nieve : COL_SUELO[mat] || COL_SUELO.tierra, 0.07);
    if (mat === 'piedra') for (let i = 0; i < 12; i++) chispa(x, y + 0.1, z, (ux * 8 + (r() - 0.5) * 6) * MU, (2 + r() * 5) * MU, (uz * 8 + (r() - 0.5) * 6) * MU, 0.25 + r() * 0.3, 1, 0.8, 0.45); }
  // explosión de obús: destello, bola de fuego, onda, surtidor de tierra, terrones, columna de humo y cráter
  function explosion(p, o) { o = o || {}; const x = p[0], z = p[2], y = o.aire ? p[1] : H(x, z), R = (o.radio || 6) * MU, cr = o.crater == null ? (o.aire ? 0 : 1.2) : o.crater, sup = superficie(x, z);
    destello(x, y, z, 45, 0.18); llama(x, y + 0.8 * MU, z, 0, 0, 0, R * 0.9, 0.12, 1, 0.85, 0.6, 1, 1);
    for (let i = 0; i < 10; i++) { const a = r() * 6.283, e = r() * 1.2, v = (3 + r() * 6) * MU; llama(x, y + 1 * MU, z, Math.cos(a) * Math.cos(e) * v, Math.sin(e) * v + 2 * MU, Math.sin(a) * Math.cos(e) * v, (1.2 + r() * 1.6) * MU, 0.35 + r() * 0.45, 1, 0.55, 0.15, 0, 1); }
    for (let i = 0; i < 20; i++) chispa(x, y + 0.5 * MU, z, (r() - 0.5) * 50 * MU, r() * 30 * MU, (r() - 0.5) * 50 * MU, 0.3 + r() * 0.4, 1, 0.7, 0.3);
    ondas.lanzar(x, o.aire ? y : y, z, R * 2.2, t);
    if (o.aire) { for (let i = 0; i < 7; i++) puff('canon', x + (r() - 0.5) * MU, y + (r() - 0.5) * MU, z + (r() - 0.5) * MU, (r() - 0.5) * 3 * MU, (r() - 0.5) * 2 * MU, (r() - 0.5) * 3 * MU, 1.2); return; }
    const T = sup === 2 ? 'nieve' : 'tierra'; for (let i = 0; i < 16; i++) { const a = r() * 6.283, sp = r() * 4; puff(T, x + Math.cos(a) * MU, y, z + Math.sin(a) * MU, Math.cos(a) * sp * MU, (9 + r() * 16) * MU, Math.sin(a) * sp * MU, 1.4); }
    terrones(x, y + 0.5 * MU, z, 45, 6, 20, 0.6, sup === 2 ? COL_SUELO.nieve : COL_SUELO.tierra, 0.16);
    for (let i = 0; i < 9; i++) puff('obus', x + (r() - 0.5) * 2 * MU, y + (1 + i * 0.8) * MU, z + (r() - 0.5) * 2 * MU, (r() - 0.5) * 2 * MU, (2 + r() * 3) * MU, (r() - 0.5) * 2 * MU, 1.1 + i * 0.08);
    if (cr > 0 && op.terreno && op.terreno.deformar && !o.sinCrater) op.terreno.deformar(x, z, cr * MU * 1.6, cr * MU * 0.6);
    calcos.poner(x, H(x, z) + 0.05, z, r() * 6, 4, (cr > 0 ? cr * 4 : 3) * MU, t, 900, sup, r()); }
  // polvo de una tropa en marcha: llamar cada fotograma (o cada pocos) con su velocidad; id estable por unidad
  function polvo(id, x, z, o) { o = o || {}; const v = o.velocidad == null ? 1.3 : o.velocidad, w = (o.ancho || 4) * MU, tipo = o.tipo || 'infanteria', sup = superficie(x, z); if (sup !== 0 || clima.lluvia > 0.05) return 0;
    const h = ranura(id * 2 + 1); tT[h] = t; const dtp = isNaN(tX[h]) ? 1 / 60 : Math.min(0.25, t - tX[h]); tX[h] = t;
    const k = (tipo === 'caballeria' ? 3.2 : tipo === 'artilleria' ? 2.2 : tipo === 'vehiculo' ? 3 : 1) * (1 - clima.humedad * 0.8) * Q;
    tAcum[h] += v * k * (w / MU) * 0.25 * dtp; const ry = o.rumbo || 0, ux = Math.sin(ry), uz = Math.cos(ry); let n = 0;
    while (tAcum[h] >= 1) { tAcum[h] -= 1; n++; const s = (r() - 0.5) * w, f = (o.fondo || 2) * MU * r(), bx = x - uz * s - ux * f, bz = z + ux * s - uz * f;
      puff('polvo', bx, H(bx, bz) + 0.3 * MU, bz, -ux * v * 0.3 * MU, (0.3 + r() * 0.5) * MU, -uz * v * 0.3 * MU, (tipo === 'caballeria' ? 1.6 : 1) * (0.8 + r() * 0.5)); }
    return n; }
  // rastro de pisadas (pie), herraduras (casco) o rodadas (rueda): llamar con la posición; deja una marca cada zancada
  const ZANCADA = {pie: 0.78, casco: 1.4, rueda: 1.1, oruga: 0.6};
  function rastro(id, x, z, rumbo, tipo, o) { o = o || {}; const h = ranura(id * 2); tT[h] = t; const sup = o.superficie != null ? o.superficie : superficie(x, z); if (sup === 0 && !o.siempre && clima.humedad < 0.3) return false;
    const zn = (ZANCADA[tipo] || 0.8) * MU; if (!isNaN(tX[h]) && Math.hypot(x - tX[h], z - tZ[h]) < zn) return false; tX[h] = x; tZ[h] = z; tLado[h] = -tLado[h];
    const ux = Math.sin(rumbo), uz = Math.cos(rumbo), vida = sup === 2 ? 600 : sup === 1 ? 300 : 90;
    if (tipo === 'pie') { const lx = x + uz * 0.12 * MU * tLado[h], lz = z - ux * 0.12 * MU * tLado[h]; calcos.poner(lx, H(lx, lz) + 0.02, lz, rumbo, 0, 0.32 * MU, t, vida, sup, r()); }
    else if (tipo === 'casco') for (let k = -1; k <= 1; k += 2) { const lx = x + uz * 0.22 * MU * k + ux * 0.3 * MU * tLado[h] * k, lz = z - ux * 0.22 * MU * k + uz * 0.3 * MU * tLado[h] * k; calcos.poner(lx, H(lx, lz) + 0.02, lz, rumbo, 1, 0.16 * MU, t, vida, sup, r()); }
    else { const via = (o.via || (tipo === 'oruga' ? 2.4 : 1.5)) * MU / 2; for (let k = -1; k <= 1; k += 2) { const lx = x + uz * via * k, lz = z - ux * via * k; calcos.poner(lx, H(lx, lz) + 0.02, lz, rumbo, 2, zn * 1.05, t, vida, sup, r()); } }
    return true; }
  function pisada(x, z, rumbo, tipo, sup) { calcos.poner(x, H(x, z) + 0.02, z, rumbo, tipo === 'casco' ? 1 : tipo === 'rueda' ? 2 : 0, (tipo === 'casco' ? 0.16 : 0.32) * MU, t, 300, sup == null ? superficie(x, z) : sup, r()); }

  /* ---------- FUEGO: hasta 48 focos; edificio (llamas en el tejado y huecos), bosque (se extiende), hierba (frente bajo) ---------- */
  const NF = 48, fX = new Float32Array(NF), fY = new Float32Array(NF), fZ = new Float32Array(NF), fR = new Float32Array(NF), fRMax = new Float32Array(NF), fI = new Float32Array(NF), fTipo = new Int8Array(NF).fill(-1), fEdad = new Float32Array(NF), fDur = new Float32Array(NF), fAc = new Float32Array(NF * 3), fAlto = new Float32Array(NF);
  const fuego = {
    encender(p, o) { o = o || {}; let i = 0; while (i < NF && fTipo[i] >= 0) i++; if (i >= NF) { let m = 0; for (let k = 1; k < NF; k++) if (fI[k] < fI[m]) m = k; i = m; }
      const tipo = o.tipo === 'bosque' ? 1 : o.tipo === 'hierba' ? 2 : 0; fX[i] = p[0]; fZ[i] = p[2]; fY[i] = p[1] != null ? p[1] : H(p[0], p[2]); fR[i] = (o.radio || (tipo === 1 ? 4 : 3)) * MU; fRMax[i] = (o.radioMax || (tipo === 1 ? 25 : tipo === 2 ? 40 : o.radio || 3)) * MU;
      fI[i] = o.intensidad == null ? 1 : o.intensidad; fTipo[i] = tipo; fEdad[i] = 0; fDur[i] = o.duracion || (tipo === 0 ? 600 : tipo === 1 ? 900 : 180); fAlto[i] = (o.alto || (tipo === 1 ? 9 : tipo === 2 ? 0.6 : 2)) * MU; fAc[i * 3] = fAc[i * 3 + 1] = fAc[i * 3 + 2] = 0; return i; },
    apagar(i) { if (i >= 0 && i < NF) fTipo[i] = -1; },
    activos() { let n = 0; for (let i = 0; i < NF; i++) if (fTipo[i] >= 0) n++; return n; },
    // fuegos de un pueblo de pueblos3d (P.fuegos de los edificios en ruinas)
    desdePueblo(P, o) { (P.fuegos || []).forEach(f => fuego.encender(f.pos, Object.assign({tipo: 'edificio', radio: (f.tamano || 2 * MU) / MU * 1.3, alto: 2.5, intensidad: 0.8 + r() * 0.4}, o || {}))); },
    radio: i => fR[i] / MU};
  function fuegos(dt) {
    for (let i = 0; i < NF; i++) { if (fTipo[i] < 0) continue; fEdad[i] += dt; const tipo = fTipo[i], k = fEdad[i] / fDur[i]; if (k >= 1) { fTipo[i] = -1; continue; }
      const env = smooth(0, 0.04, k) * (1 - smooth(0.75, 1, k)), I = fI[i] * env; if (tipo > 0 && fR[i] < fRMax[i]) fR[i] += (tipo === 1 ? 0.12 : 0.6) * MU * dt * fI[i];
      const area = fR[i] * fR[i] / (MU * MU), tasaL = Math.min(90, 6 + area * (tipo === 2 ? 0.6 : 1.4)) * I * Q, tasaH = Math.min(10, 0.6 + area * 0.06) * I * Q, tasaP = Math.min(20, 1 + area * 0.2) * I * Q;
      fAc[i * 3] += tasaL * dt; fAc[i * 3 + 1] += tasaH * dt; fAc[i * 3 + 2] += tasaP * dt;
      while (fAc[i * 3] >= 1) { fAc[i * 3] -= 1; const a = r() * 6.283, d = (tipo === 0 ? Math.sqrt(r()) : (0.6 + 0.4 * Math.sqrt(r()))) * fR[i], x = fX[i] + Math.cos(a) * d, z = fZ[i] + Math.sin(a) * d, y = (tipo === 0 ? fY[i] : H(x, z)) + r() * fAlto[i];
        llama(x, y, z, (r() - 0.5) * 0.6 * MU + clima.viento[0] * 0.3, (1.5 + r() * 2.2) * MU, (r() - 0.5) * 0.6 * MU + clima.viento[1] * 0.3, (0.7 + r() * 1.4) * MU * (tipo === 2 ? 0.6 : 1), 0.45 + r() * 0.6, 1, 0.62 + r() * 0.2, 0.2, 0, 0.9); }
      while (fAc[i * 3 + 1] >= 1) { fAc[i * 3 + 1] -= 1; const a = r() * 6.283, d = r() * fR[i] * 0.7, x = fX[i] + Math.cos(a) * d, z = fZ[i] + Math.sin(a) * d; puff('incendio', x, (tipo === 0 ? fY[i] : H(x, z)) + fAlto[i] * 1.1, z, 0, 2 * MU, 0, tipo === 2 ? 0.8 : 1.2 + area * 0.004); }
      while (fAc[i * 3 + 2] >= 1) { fAc[i * 3 + 2] -= 1; const a = r() * 6.283, d = r() * fR[i], x = fX[i] + Math.cos(a) * d, z = fZ[i] + Math.sin(a) * d; llama(x, (tipo === 0 ? fY[i] : H(x, z)) + fAlto[i], z, (r() - 0.5) * 2 * MU, (2 + r() * 3) * MU, (r() - 0.5) * 2 * MU, 0.08 * MU, 2 + r() * 2.5, 1, 0.55, 0.15, 2, 1); } } }
  // las 4 luces de fuego van a los focos más intensos y cercanos a la cámara (selección sin listas temporales)
  const elegidos = new Int32Array(4);
  function lucesFuego(cam) { for (let s = 0; s < 4; s++) { let best = -1, bv = 0; for (let i = 0; i < NF; i++) { if (fTipo[i] < 0) continue; let ya = false; for (let q = 0; q < s; q++) if (elegidos[q] === i) ya = true; if (ya) continue;
        const d = cam ? Math.hypot(cam.position.x - fX[i], cam.position.z - fZ[i]) : 0, v = fI[i] * (1 + fR[i] / MU * 0.1) / (1 + d / 150); if (v > bv) { bv = v; best = i; } }
      elegidos[s] = best; const L = luces[2 + s]; if (best < 0) { L.l.visible = false; continue; } L.l.visible = true; const fl = 0.75 + 0.25 * Math.sin(t * 17 + s * 3) * Math.sin(t * 7.3 + s);
      L.l.position.set(fX[best], (fTipo[best] === 0 ? fY[best] : H(fX[best], fZ[best])) + fAlto[best] * 0.8, fZ[best]); L.l.intensity = 9 * fI[best] * fl * (1 + Math.min(2, fR[best] / MU / 8)); L.l.distance = (25 + fR[best] / MU * 2) * MU; } }

  /* ---------- CHIMENEAS: humo de hogar de los pueblos (P.humos de pueblos3d; construir el pueblo con {humo: false}) ---------- */
  const NHC = 256, hcX = new Float32Array(NHC), hcY = new Float32Array(NHC), hcZ = new Float32Array(NHC), hcI = new Float32Array(NHC), hcAc = new Float32Array(NHC); let nHC = 0;
  function chimeneas(P) { (P.humos || []).forEach(h => { if (nHC >= NHC) return; hcX[nHC] = h.pos[0]; hcY[nHC] = h.pos[1]; hcZ[nHC] = h.pos[2]; hcI[nHC] = h.intensidad || 1; hcAc[nHC] = (h.fase || 0); nHC++; }); return nHC; }
  function humoHogar(dt) { for (let i = 0; i < nHC; i++) { hcAc[i] += dt * 0.7 * hcI[i] * Q; while (hcAc[i] >= 1) { hcAc[i] -= 1; puff('chimenea', hcX[i], hcY[i], hcZ[i], 0, 0.8 * MU, 0, hcI[i]); } } }

  /* ---------- CLIMA, HORA Y NIEBLA ---------- */
  function ponClima(c) { Object.keys(c || {}).forEach(k => { if (k === 'viento') { clima.viento[0] = c.viento[0]; clima.viento[1] = c.viento[1]; } else clima[k] = c[k]; });
    lluvia.intensidad(clima.lluvia); nieve.intensidad(clima.nieve); if (clima.lluvia > 0.1) clima.humedad = Math.max(clima.humedad, 0.6 + clima.lluvia * 0.4);
    if (cielo) cielo.nubes(Math.max(clima.nubes, clima.lluvia * 0.95, clima.nieve * 0.85), clima.lluvia * 0.45 + clima.nieve * 0.25); return clima; }
  function hora(h) { if (cielo) cielo.hora(h); return cielo ? cielo.estado : null; }
  let nieblaEscena = null; if (escena && op.gestionarNiebla) { nieblaEscena = new THREE.FogExp2(0xbcd0e0, 0.0006); escena.fog = nieblaEscena; }

  /* ---------- BUCLE ---------- */
  function actualizar(dt, cam) {
    dt = Math.min(0.1, Math.max(0, dt)); t += dt; U.uT.value = t; const wx = clima.viento[0], wz = clima.viento[1]; U.uViento.value.set(wx, wz);
    if (cam) { U.uCam.value.copy(cam.position); cam.updateMatrixWorld(); }
    if (cielo) { cielo.actualizar(cam, null, t); const e = cielo.estado; if (cam) { _v.copy(e.dir).transformDirection(cam.matrixWorldInverse); U.uSolV.value.copy(_v); }
      U.uColSol.value.copy(cielo.sol.color).lerp(_c.setRGB(1, 1, 1), 0.45).multiplyScalar(Math.min(1.0, cielo.sol.intensity * 0.45)); U.uAmb.value.copy(cielo.hemi.color).multiplyScalar(0.25 + cielo.hemi.intensity * 0.65); }
    else if (op.sol) {   // sin cielo propio: se ilumina el humo con el sol y la luz ambiente de la escena que lo contiene
      _v.copy(op.sol.position); if (op.sol.target) _v.sub(op.sol.target.position); _v.normalize(); if (cam) _v.transformDirection(cam.matrixWorldInverse); U.uSolV.value.copy(_v);
      U.uColSol.value.copy(op.sol.color).multiplyScalar(Math.min(1, op.sol.intensity * 0.6)); U.uAmb.value.setRGB(0.42, 0.43, 0.46); if (op.hemi) U.uAmb.value.copy(op.hemi.color).multiplyScalar(0.3 + op.hemi.intensity * 0.6); if (op.ambiente) U.uAmb.value.add(_c.copy(op.ambiente.color).multiplyScalar(op.ambiente.intensity * 0.35)); }
    fuegos(dt); lucesFuego(cam); humoHogar(dt);
    humo.actualizar(dt, wx, wz, H); brillo.actualizar(dt, wx, wz, null); restos.actualizar(dt, H);
    // chispas
    chis.empezar(); for (let i = 0; i < NCH; i++) { if (cVida[i] <= 0) continue; cEdad[i] += dt; if (cEdad[i] >= cVida[i]) { cVida[i] = -1; continue; } const j = i * 3; cV[j + 1] -= G * dt; cV[j] *= 1 - dt * 1.5; cV[j + 2] *= 1 - dt * 1.5;
      cP[j] += cV[j] * dt; cP[j + 1] += cV[j + 1] * dt; cP[j + 2] += cV[j + 2] * dt; const a = 1 - cEdad[i] / cVida[i];
      chis.seg(cP[j], cP[j + 1], cP[j + 2], cP[j] - cV[j] * 0.025, cP[j + 1] - cV[j + 1] * 0.025, cP[j + 2] - cV[j + 2] * 0.025, cCol[j], cCol[j + 1], cCol[j + 2], a * 1.6, 0); }
    chis.terminar();
    // estelas: segmentos del más nuevo (opaco) al más viejo (transparente); caducan a 0,2 s sin noticias
    est.empezar(); for (let s = 0; s < NE; s++) { if (eId[s] < 0) continue; if (t - eUlt[s] > 0.2) { eId[s] = -1; continue; } const n = eN[s]; let largo = 0; for (let q = 0; q < n - 1; q++) { const k0 = (eCab[s] - q + KE) % KE, k1 = (k0 - 1 + KE) % KE, a = (s * KE + k0) * 3, b = (s * KE + k1) * 3;
      largo += Math.hypot(eP[a] - eP[b], eP[a + 1] - eP[b + 1], eP[a + 2] - eP[b + 2]); if (largo > 25 * MU) break;   // la estela visible no pasa de ~25 m
      est.seg(eP[a], eP[a + 1], eP[a + 2], eP[b], eP[b + 1], eP[b + 2], 0.3, 0.3, 0.32, 0.4 * (1 - q / (n - 1)), 0.4 * (1 - (q + 1) / (n - 1))); } }
    est.terminar();
    // luces de destello
    for (let i = 0; i < 2; i++) { const L = luces[i]; if (L.t > 0) { L.t -= dt; L.l.intensity = L.base * Math.max(0, L.t) / 0.15; if (L.t <= 0) { L.l.intensity = 0; L.l.visible = false; } } }
    // niebla de batalla: masa de humo vivo (∑ alfa·tamaño²) → 0…1, suavizada
    let masa = 0; const aC = humo.aCol.array, aT = humo.aTam.array; for (let i = 0; i < humo.n; i++) masa += aC[i * 4 + 3] * aT[i] * aT[i]; const objetivo = clamp(masa / (90000 * MU * MU / 2.78), 0, 1);
    clima.batalla += (objetivo - clima.batalla) * Math.min(1, dt * 0.3);
    if (cam) U.uSueloN.value = H(cam.position.x, cam.position.z) - 1.5 * MU; U.uNiebla.value = clima.niebla; niebla.mesh.visible = clima.niebla > 0.01;
    if (cielo) { U.uColNiebla.value.copy(cielo.estado.horizonte).lerp(_c.setRGB(0.82, 0.83, 0.85), 0.6).multiplyScalar(0.55 + 0.45 * smooth(-6, 12, cielo.estado.elev)); U.uColLluvia.value.copy(U.uAmb.value).multiplyScalar(1.4); }
    if (nieblaEscena) { nieblaEscena.density = 0.00045 + clima.niebla * 0.0042 + clima.lluvia * 0.0024 + clima.nieve * 0.003 + clima.batalla * 0.0032;
      if (cielo) nieblaEscena.color.copy(cielo.estado.horizonte).lerp(_c.setRGB(0.72, 0.72, 0.72), Math.min(1, clima.batalla * 0.8 + clima.lluvia * 0.6 + clima.niebla * 0.5)); if (escena && escena.background && escena.background.isColor) escena.background.copy(nieblaEscena.color); }
  }
  // ---------- enlace con proyectiles3d: su humo pasa a ser este; botes, impactos y explosiones añaden efectos; estelas de las balas ----------
  function conectarProyectiles(P, o) { o = o || {}; let ultimo = null;
    if (o.reemplazarHumo !== false && P.humo) { P.humo.emitir = (p, n, tam0, vida, v) => { const canon = tam0 > 1.5 * MU; for (let k = 0; k < Math.min(n, 6); k++) puff(canon ? 'canon' : 'polvora', p[0] + (r() - 0.5) * tam0, p[1], p[2] + (r() - 0.5) * tam0, v ? v[0] * (0.5 + r()) : 0, v ? v[1] * (0.5 + r()) : 0.4 * MU, v ? v[2] * (0.5 + r()) : 0, tam0 / (canon ? 2.6 : 1.3) / MU); };
      P.humo.densidad = (x, y, z) => humo.densidad(x, y, z); P.humo.transmitancia = (a, b, paso) => humo.transmitancia(a[0], a[1], a[2], b[0], b[1], b[2], paso); }
    return function paso() { const E = P.eventos; let i = E.length - 1; while (i >= 0 && E[i] !== ultimo) i--; for (let k = i + 1; k < E.length; k++) { const e = E[k];
        if (e.nombre === 'bote') { let v = null; for (let q = 0; q < P.vivos.length; q++) if (P.vivos[q].id === e.id) { v = P.vivos[q].vel; break; } rebote(e.pos, v || [1, 0, 0], e.material); }
        else if (e.nombre === 'explosion') explosion(e.pos, {radio: e.radio / MU * 0.6, aire: e.aire, sinCrater: true});
        else if (e.nombre === 'impacto' && (e.material === 'piedra' || e.material === 'metal')) impacto(e.pos, [0, 1, 0], e.material, 0.6); }
      if (E.length) ultimo = E[E.length - 1];
      for (let q = 0; q < P.vivos.length; q++) { const p = P.vivos[q]; if (p.tipo === 'bala_canon' || p.tipo === 'obus' || p.tipo === 'shrapnel' || p.tipo === 'cohete') estela(p.id, p.pos[0], p.pos[1], p.pos[2]); } }; }
  function stats() { let ll = 0; for (let i = 0; i < NCH; i++) if (cVida[i] > 0) ll++; return {humo: humo.n, brillo: brillo.n, chispas: ll, restos: restos.n || 0, calcos: Math.min(calcos.total, calcos.N), fuegos: fuego.activos(), batalla: +clima.batalla.toFixed(3),
    mallas: grupo.children.filter(o => o.isMesh || o.isLine || o.isPoints).length + (cielo ? 1 : 0)}; }
  return {grupo, cielo, humo: {emitir: puff, densidad: (x, y, z) => humo.densidad(x, y, z), transmitancia: (a, b, paso) => humo.transmitancia(a[0], a[1], a[2], b[0], b[1], b[2], paso), nube: humo},
    disparo, descarga, impacto, rebote, explosion, estela, polvo, rastro, pisada, fuego, chimeneas, clima: ponClima, estadoClima: clima, hora, actualizar, conectarProyectiles, stats, uniforms: U,
    _int: {brillo, restos, calcos, ondas, chis, lluvia, nieve, niebla, luces}, tiempo: () => t};
}

/* ===================================================================================== */
/* PRUEBA AUTOMÁTICA (Node, sin WebGL). proy = proyectiles3d (opcional) para probar el enlace */
function pruebaEfectos(proy) {
  const R = {}, fallos = [], ok = (c, m) => { if (!c) fallos.push(m); return c; };
  const plano = {height: () => 0, deformados: 0, deformar() { this.deformados++; }};
  const nueva = o => crearEfectos(new THREE.Scene(), Object.assign({terreno: plano, viento: [0, 0], humedad: 0.5}, o || {})), cam = new THREE.PerspectiveCamera(50, 1.6, 0.5, 5000);
  cam.position.set(0, 40, 120); cam.lookAt(0, 0, 0); cam.updateMatrixWorld();
  const correr = (FX, seg, dt) => { dt = dt || 1 / 30; for (let s = 0; s < seg; s += dt) FX.actualizar(dt, cam); };
  // 1) humo de pólvora negra: tapa la línea de vista y se disipa; el viento lo arrastra
  { const FX = nueva(), a = [-60 * MU, 1.6 * MU, 0], b = [60 * MU, 1.6 * MU, 0], t0 = FX.humo.transmitancia(a, b);
    const pts = []; for (let i = 0; i < 40; i++) pts.push([(i - 20) * 0.8 * MU, 1.5 * MU, -3 * MU]); FX.descarga(pts, [0, 0, 1], {era: 'B'}); correr(FX, 2);
    const t1 = FX.humo.transmitancia([0, 1.6 * MU, -40 * MU], [0, 1.6 * MU, 40 * MU]); correr(FX, 140, 0.25); const t2 = FX.humo.transmitancia([0, 1.6 * MU, -40 * MU], [0, 1.6 * MU, 40 * MU]);
    R.humo = {limpio: +t0.toFixed(3), trasDescarga: +t1.toFixed(3), a140s: +t2.toFixed(3)}; ok(t0 > 0.99, 'sin humo la vista está limpia'); ok(t1 < 0.3, 'la descarga tapa la vista (' + t1.toFixed(2) + ')'); ok(t2 > 0.9, 'el humo se disipa (' + t2.toFixed(2) + ')'); }
  { const FX = nueva({viento: [3 * MU, 0]}); FX.clima({viento: [3 * MU, 0]}); for (let i = 0; i < 10; i++) FX.disparo([0, 1.5 * MU, 0], [0, 0, 1], {era: 'A'}); correr(FX, 10);
    const N = FX.humo.nube; let sx = 0, n = 0; for (let i = 0; i < N.N; i++) if (N.vida[i] > 0) { sx += N.P[i * 3]; n++; } R.derivaViento = +(sx / n / MU).toFixed(1); ok(sx / n > 15 * MU, 'el viento arrastra el humo (' + (sx / n / MU).toFixed(1) + ' m)'); }
  { const FX = nueva(); const pts = []; for (let i = 0; i < 40; i++) pts.push([(i - 20) * 0.8 * MU, 1.5 * MU, -3 * MU]); FX.descarga(pts, [0, 0, 1], {era: 'E'}); correr(FX, 2);
    const t1 = FX.humo.transmitancia([0, 1.6 * MU, -40 * MU], [0, 1.6 * MU, 40 * MU]); R.sinHumoE = +t1.toFixed(3); ok(t1 > 0.8, 'la pólvora sin humo (época E) apenas tapa (' + t1.toFixed(2) + ')'); }
  { const vida = h => { const FX = nueva({humedad: h}); FX.disparo([0, 1.5 * MU, 0], [0, 0, 1], {era: 'A', arma: 'canon'}); const N = FX.humo.nube; let m = 0; for (let i = 0; i < N.N; i++) if (N.vida[i] > m) m = N.vida[i]; return m; };
    R.vidaHumo = {seco: +vida(0.1).toFixed(0), humedo: +vida(0.95).toFixed(0)}; ok(R.vidaHumo.humedo > R.vidaHumo.seco * 1.5, 'el aire húmedo alarga la disipación'); }
  // 2) explosión: cráter en el terreno, terrones que caen y se paran sobre el suelo, onda, calco quemado
  { const FX = nueva(); FX.explosion([0, 0, 0], {radio: 8, crater: 1.5}); correr(FX, 0.3); const nVuelo = FX._int.restos.n; correr(FX, 4);
    const Rr = FX._int.restos; let bajo = 0, quietos = 0, vivos = 0; for (let i = 0; i < Rr.N; i++) if (Rr.vida[i] > 0) { vivos++; if (Rr.P[i * 3 + 1] < -0.01) bajo++; if (Rr.quieto[i]) quietos++; }
    R.explosion = {terrones: nVuelo, quietosA4s: quietos, vivos, deformar: plano.deformados, calcos: FX.stats().calcos}; ok(plano.deformados === 1, 'la explosión hace cráter'); ok(nVuelo >= 30 && bajo === 0, 'terrones en el aire y ninguno bajo el suelo'); ok(quietos >= vivos * 0.8, 'los terrones se paran (' + quietos + '/' + vivos + ')'); }
  // 3) rebote, rastros y polvo
  { const FX = nueva(); FX.clima({lluvia: 0.6}); FX.rebote([0, 0, 0], [80 * MU, -10 * MU, 0], 'tierra'); let n = 0; for (let x = 0; x < 20 * MU; x += 0.2 * MU) { FX.actualizar(1 / 30, cam); if (FX.rastro(7, x, 0, Math.PI / 2, 'pie')) n++; }
    let nc = 0; for (let x = 0; x < 20 * MU; x += 0.3 * MU) { FX.actualizar(1 / 30, cam); if (FX.rastro(8, x, 10, Math.PI / 2, 'casco')) nc++; }
    R.rastro = {pisadasEn20m: n, pasosCaballoEn20m: nc, calcos: FX.stats().calcos}; ok(n >= 24 && n <= 28, 'una pisada por zancada en el barro (' + n + ')'); ok(nc >= 13 && nc <= 16, 'herraduras por tranco (' + nc + ')');
    const A = FX._int.calcos.b.array; ok(A[3] === 1 && A[0] === 3, 'el rebote deja surco en el barro'); }
  { const FX = nueva({humedad: 0.2}); let p = 0; for (let i = 0; i < 90; i++) { FX.actualizar(1 / 30, cam); p += FX.polvo(3, i * 0.2 * MU, 0, {velocidad: 6, ancho: 12, tipo: 'caballeria', rumbo: Math.PI / 2}); }
    const FX2 = nueva({humedad: 0.2}); FX2.clima({lluvia: 0.5}); let p2 = 0; for (let i = 0; i < 90; i++) { FX2.actualizar(1 / 30, cam); p2 += FX2.polvo(3, i * 0.2 * MU, 0, {velocidad: 6, ancho: 12, tipo: 'caballeria'}); }
    R.polvo = {caballeriaSeco3s: p, conLluvia: p2}; ok(p > 20 && p2 === 0, 'la caballería levanta polvo en seco y no con lluvia'); }
  // 4) fuego: el de bosque crece; emite llamas, humo y pavesas; desde un pueblo
  { const FX = nueva(); const id = FX.fuego.encender([0, 0, 0], {tipo: 'bosque', radio: 4}); correr(FX, 20, 0.1); const rb = FX.fuego.radio(id), st = FX.stats();
    FX.fuego.desdePueblo({fuegos: [{pos: [50, 3, 0], tamano: 2 * MU}, {pos: [80, 3, 0], tamano: 2 * MU}]}); ok(FX.chimeneas({humos: [{pos: [0, 8, 0], intensidad: 1}]}) === 1, 'chimeneas'); correr(FX, 1);
    R.fuego = {radioBosque20s: +rb.toFixed(1), llamas: st.brillo, humo: st.humo, focos: FX.fuego.activos()}; ok(rb > 5, 'el fuego de bosque se extiende'); ok(st.brillo > 25 && st.humo > 8, 'el fuego emite llamas y humo'); ok(FX.fuego.activos() === 3, 'fuegos del pueblo encendidos');
    ok(FX._int.luces.slice(2).filter(L => L.l.visible).length === 3, 'luces de fuego asignadas'); FX.fuego.apagar(id); ok(FX.fuego.activos() === 2, 'apagar'); }
  // 5) cielo: noche, amanecer cálido, mediodía alto; las nubes oscurecen
  { const FX = nueva(), C = FX.cielo; const e3 = Object.assign({}, C.hora(3)), sol3 = C.sol.intensity, noche = C.uniforms.uNoche.value; C.hora(7.2); const e7 = C.estado.elev, col7 = C.sol.color.clone(), i7 = C.sol.intensity;
    C.hora(13); const e13 = C.estado.elev, i13 = C.sol.intensity; FX.clima({lluvia: 0.8}); const i13ll = C.sol.intensity;
    R.cielo = {elev3h: +e3.elev.toFixed(1), elev7h: +e7.toFixed(1), elev13h: +e13.toFixed(1), noche3h: +noche.toFixed(2), sol7h: col7.getHexString(), intens: [+sol3.toFixed(2), +i7.toFixed(2), +i13.toFixed(2), +i13ll.toFixed(2)]};
    ok(e3.elev < 0 && noche > 0.5, 'de noche el sol está bajo el horizonte'); ok(e7 > 0 && e7 < 12 && col7.r > col7.b * 1.3, 'luz de amanecer baja y cálida'); ok(e13 > 45 && i13 > i7, 'mediodía alto y más intenso'); ok(i13ll < i13 * 0.5, 'la lluvia oscurece'); }
  // 6) carga máxima, valores finitos y llamadas de dibujo fijas
  { const FX = nueva(); const m0 = FX.stats().mallas; FX.clima({lluvia: 1, niebla: 0.8});
    for (let k = 0; k < 30; k++) { FX.explosion([(k - 15) * 10, 0, 0], {radio: 6}); FX.descarga([[k, 1, 5], [k + 1, 1, 5]], [0, 0, 1]); FX.impacto([k, 1, 0], [0, 1, 0], 'piedra'); FX.fuego.encender([k * 5, 0, 30], {tipo: 'bosque'}); FX.rebote([k, 0, 0], [50, -5, 0], 'piedra'); }
    for (let i = 0; i < 4000; i++) FX.humo.emitir('polvora', i * 0.1, 1, 0, 0, 0, 0); correr(FX, 5);
    const N = FX.humo.nube, finito = a => { for (let i = 0; i < a.length; i++) if (!isFinite(a[i])) return false; return true; };
    R.carga = Object.assign(FX.stats(), {mallasInicio: m0}); ok(FX.stats().mallas === m0 && m0 <= 13, 'llamadas de dibujo fijas (' + m0 + ')'); ok(N.n <= N.N, 'el humo no pasa de su capacidad');
    ok([N.aPos.array, N.aCol.array, N.aTam.array, FX._int.brillo.aPos.array, FX._int.chis.pos, FX._int.restos.mesh.instanceMatrix.array].every(finito), 'todos los búferes son finitos'); ok(FX.estadoClima.batalla > 0.05, 'el humo acumulado espesa la niebla de batalla (' + FX.estadoClima.batalla.toFixed(2) + ')'); }
  // 7) enlace con proyectiles3d: el humo de los disparos pasa por aquí, los botes dejan surco y las balas estela
  if (proy) { const FX = nueva(), P = proy.crearProyectiles(null, {alturaFn: () => 0, materialFn: () => 'tierra'}), paso = FX.conectarProyectiles(P);
    P.disparar('bala_canon', 'A', [0, 2 * MU, 0], [1, 0.02, 0]); let est = 0, botes = 0; for (let i = 0; i < 120; i++) { P.actualizar(1 / 30); paso(); FX.actualizar(1 / 30, cam); est = Math.max(est, FX._int.chis ? 1 : 0); }
    botes = P.eventos.filter(e => e.nombre === 'bote').length; const st = FX.stats(), surcos = Array.from({length: FX._int.calcos.N}, (_, i) => FX._int.calcos.b.array[i * 4 + 1] > -1e5 && FX._int.calcos.b.array[i * 4] === 3).filter(Boolean).length;
    R.proyectiles = {botes, surcos, humo: st.humo}; ok(botes > 0 && surcos === botes, 'cada bote deja su surco (' + surcos + '/' + botes + ')'); ok(st.humo > 0, 'el humo del cañonazo viene de efectos3d');
    const t1 = P.humo.transmitancia([-10 * MU, 2 * MU, 0], [60 * MU, 2 * MU, 0]); R.proyectiles.transmitancia = +t1.toFixed(3); ok(t1 < 1, 'la transmitancia de proyectiles3d usa este humo'); }
  return {ok: fallos.length === 0, fallos, ...R};
}

/* ===================================================================================== */
/* DEMOSTRACIÓN: demo.html?m=efectos&vista=batalla|clima|amanecer|fuego|explosion (&hora=…&lluvia=…&nieve=…&niebla=…&avance=s) */
function demoEfectos(cont) {
  cont = cont || document.body; const q = new URLSearchParams(location.search), vista = q.get('vista') || 'batalla', T3 = root.terreno3d;
  const num = (k, d) => q.get(k) != null ? +q.get(k) : d;
  const horaIni = num('hora', vista === 'amanecer' ? 7.1 : vista === 'fuego' ? 21.2 : 10.5), C0 = [520, 420];
  let D, T = null; if (T3) { T = T3.crearTerreno({ancho: 1024, fondo: 768, semilla: 9, bioma: num('nieve', 0) > 0 ? 'nevado' : 'templado', relieve: 8}); D = T3.baseDemo(cont, {cam: [C0[0] + 60, 45, C0[1] + 120], obj: [C0[0], 4, C0[1]], sombra: 300}); D.escena.add(T.grupo); }
  else { const ren = new THREE.WebGLRenderer({antialias: true}); ren.setSize(innerWidth, innerHeight); cont.appendChild(ren.domElement); const esc = new THREE.Scene(), cam = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.5, 5000); cam.position.set(C0[0] + 60, 45, C0[1] + 120); cam.lookAt(C0[0], 0, C0[1]);
    const s = new THREE.Mesh(new THREE.PlaneGeometry(2000, 2000), new THREE.MeshLambertMaterial({color: 0x5a6a3a})); s.rotation.x = -Math.PI / 2; esc.add(s); let t0 = performance.now(); const fns = [];
    D = {escena: esc, cam, bucle: f => { fns.push(f); }, mirar() {}}; (function lp() { requestAnimationFrame(lp); const t = (performance.now() - t0) / 1000; fns.forEach(f => f(t, cam)); ren.render(esc, cam); })(); }
  const H = T ? (x, z) => T.height(x, z) : () => 0;
  // la luz de baseDemo se apaga: el cielo de efectos pone sol y hemisférica
  D.escena.children.filter(o => o.isLight).forEach(l => { l.visible = false; });
  const FX = crearEfectos(D.escena, {terreno: T, alturaFn: H, hora: horaIni, era: q.get('era') || 'B', viento: [1.4, 0.5], humedad: 0.5}); FX.cielo.sol.castShadow = true; FX.cielo.sol.shadow.mapSize.set(2048, 2048);
  const sc = FX.cielo.sol.shadow.camera; sc.left = sc.bottom = -160; sc.right = sc.top = 160; sc.near = 1; sc.far = 900; sc.updateProjectionMatrix();
  FX.clima({lluvia: num('lluvia', 0), nieve: num('nieve', 0), niebla: num('niebla', vista === 'amanecer' ? 0.85 : 0), nubes: num('nubes', 0)});
  // pueblo (si está pueblos3d) con fuegos; proyectiles3d (si está) para los cañonazos reales
  let P = null; if (root.pueblos3d && T) { const plan = root.pueblos3d.planoPueblo(5, 'templado', 'C', {centro: [C0[0] - 90, C0[1] - 110], tamano: 'aldea'}); P = root.pueblos3d.buildVillage(5, 'templado', 'C', T, {plan, danos: vista === 'fuego' ? 0.9 : 0.3, humo: false}); D.escena.add(P.grupo); FX.fuego.desdePueblo(P); FX.chimeneas(P); }
  let PR = null, pasoPR = null; if (root.proyectiles3d) { PR = root.proyectiles3d.crearProyectiles(D.escena, {alturaFn: H, terreno: T, viento: [1.4, 0, 0.5], materialFn: () => num('nieve', 0) > 0.2 ? 'nieve' : 'tierra'}); pasoPR = FX.conectarProyectiles(PR); }
  if (vista === 'fuego') { FX.fuego.encender([C0[0] + 40, 0, C0[1] - 40], {tipo: 'bosque', radio: 6, radioMax: 30}); FX.fuego.encender([C0[0] - 20, 0, C0[1] + 10], {tipo: 'hierba', radio: 4}); }
  // tropas (si están los módulos): línea de infantería que hace descargas y un escuadrón al galope
  const TT = root.Troops3D, tropas = {}; const linea = []; for (let i = 0; i < 30; i++) linea.push([C0[0] - 30 + i * 1.3, 0, C0[1] + 25]); linea.forEach(p => { p[1] = H(p[0], p[2]) + 1.45 * MU; });
  if (TT && root.infanteria3d && root.caballeria3d) { try { root.infanteria3d.registrar(TT); root.caballeria3d.registrar(TT); const sh = new TT.TroopShared(['FRA', 'GBR']);
    const bi = new TT.TroopBatch(sh, 'inf_soldado', 'B', 'FRA', 30, {lod: 0}); linea.forEach((p, i) => bi.add(p[0], H(p[0], p[2]), p[2], Math.PI, 1, 'FRA', 'disparar_B', {phase: i * 0.01})); D.escena.add(bi.mesh);
    const bc = new TT.TroopBatch(sh, 'cab_husar', 'B', 'GBR', 12, {lod: 0}); for (let i = 0; i < 12; i++) bc.add((i % 6) * 2.2, 0, Math.floor(i / 6) * 3, Math.PI / 2, 1, 'GBR', 'cab_galope', {phase: i * 0.13}); D.escena.add(bc.mesh); tropas.cab = bc; tropas.sh = sh; } catch (e) { console.warn(e); } }
  const cab = {x: C0[0] - 160, z: C0[1] - 20, v: 7 * MU};   // escuadrón: centro y velocidad
  // guion automático: descargas, cañonazos, un obús, la caballería cruzando (polvo o barro), infantes que dejan huellas
  let prox = {desc: 1, canon: 2.5, obus: vista === 'explosion' ? 1 : 6, imp: 0.5};
  function guion(t, dt) {
    if (t > prox.desc) { FX.descarga(linea, [0, 0, -1], {era: q.get('era') || 'B'}); prox.desc = t + (vista === 'batalla' ? 9 : 14); }
    if (t > prox.canon) { const o = [C0[0] + 50, H(C0[0] + 50, C0[1] + 60) + 2.2, C0[1] + 60]; if (PR) PR.disparar('bala_canon', 'A', o, [-0.25, 0.02, -1], {dispersion: 0.3}); else FX.disparo(o, [-0.25, 0, -1], {arma: 'canon'}); prox.canon = t + 5; }
    if (t > prox.obus) { const x = C0[0] - 20 + Math.sin(t) * 40, z = C0[1] - 60 + Math.cos(t * 1.3) * 25; FX.explosion([x, 0, z], {radio: 7, crater: 1.3}); prox.obus = t + (vista === 'explosion' ? 3 : 7); }
    if (t > prox.imp) { FX.impacto([C0[0] - 75, H(C0[0] - 75, C0[1] - 95) + 2, C0[1] - 95], [1, 0, 0], 'piedra'); prox.imp = t + 0.7; }
    cab.x += cab.v * dt; if (cab.x > C0[0] + 200) cab.x = C0[0] - 160;
    if (tropas.cab) tropas.cab.mesh.position.set(cab.x, H(cab.x, cab.z), cab.z);
    FX.polvo(1, cab.x + 6, cab.z + 1.5, {velocidad: cab.v / MU, ancho: 10, tipo: 'caballeria', rumbo: Math.PI / 2, fondo: 6});
    for (let i = 0; i < 6; i++) FX.rastro(100 + i, cab.x + i * 2.2, cab.z + (i % 2) * 3 - 0.5 + H(0, 0) * 0, Math.PI / 2, 'casco', {siempre: true});
    for (let i = 0; i < 4; i++) { const x = C0[0] - 10 + i * 2, z = C0[1] + 60 - ((t * 1.4 * MU) % 80); FX.rastro(200 + i, x, z, Math.PI, 'pie', {siempre: true}); }
  }
  // avance previo (para capturas): simula «avance» segundos antes del primer fotograma
  let tPrev = 0; const avance = num('avance', vista === 'fuego' ? 25 : 8); for (let s = 0; s < avance; s += 1 / 20) { guion(s, 1 / 20); if (PR) { PR.actualizar(1 / 20); pasoPR(); } FX.actualizar(1 / 20, D.cam); }
  // panel
  const panel = document.createElement('div'); panel.style.cssText = 'position:fixed;right:8px;top:8px;z-index:6;background:#1a120ae0;color:#f0dfb4;border:1px solid #b08a3e;padding:8px 10px;font:13px Georgia;display:grid;grid-template-columns:auto 120px;gap:4px 8px;max-width:280px';
  const des = (et, v0, mn, mx, pasoS, fn) => { const l = document.createElement('label'); l.textContent = et; const i = document.createElement('input'); i.type = 'range'; i.min = mn; i.max = mx; i.step = pasoS; i.value = v0; i.oninput = () => fn(+i.value); panel.append(l, i); };
  des('Hora', horaIni, 0, 24, 0.1, v => FX.hora(v)); des('Lluvia', num('lluvia', 0), 0, 1, 0.05, v => FX.clima({lluvia: v})); des('Nieve', num('nieve', 0), 0, 1, 0.05, v => FX.clima({nieve: v}));
  des('Niebla', FX.estadoClima.niebla, 0, 1, 0.05, v => FX.clima({niebla: v})); des('Viento', 1.4, 0, 8, 0.1, v => FX.clima({viento: [v, v * 0.35]}));
  const bot = (et, fn) => { const b = document.createElement('button'); b.textContent = et; b.style.cssText = 'grid-column:span 2;background:#2a1d12;color:#f0dfb4;border:1px solid #b08a3e;padding:3px;font:13px Georgia;cursor:pointer'; b.onclick = fn; panel.append(b); };
  bot('Descarga', () => FX.descarga(linea, [0, 0, -1])); bot('Obús', () => FX.explosion([C0[0] + (Math.random() - 0.5) * 80, 0, C0[1] - 50], {radio: 7, crater: 1.3}));
  bot('Incendio', () => FX.fuego.encender([C0[0] + (Math.random() - 0.5) * 100, 0, C0[1] - 80], {tipo: 'bosque', radio: 5})); if (!q.get('nonav')) cont.appendChild(panel);
  D.bucle((t, cam) => { const dt = Math.min(0.1, t - tPrev); tPrev = t; guion(avance + t, dt); if (PR) { PR.actualizar(dt); pasoPR(); } FX.actualizar(dt, cam); if (P) { P.grupo.update(cam); P.actualizar(avance + t, [1.4, 0.5]); } if (T) T.actualizar(cam.position.x, cam.position.z); });
  if (q.get('mirar')) { const v = q.get('mirar').split(',').map(Number); D.mirar([v[0], v[1], v[2]], v[3], v[4], v[5]); }
  window.FX = FX; return {FX, D, T, P, PR};
}

root.efectos_batalla3d = {crearEfectos, crearCielo, TIPOS_HUMO, PALETA_SOL, pruebaEfectos, demoEfectos, _clases: {Nube, Lineas, Precipitacion, Calcos, Ondas, Restos, NieblaSuelo}};
})(typeof window !== 'undefined' ? window : globalThis);
