/* ===== AGUA DEL MAPA DE CAMPAÑA (fase 2: costa, reflejo y ríos) =====
   · Agua animada: espuma y rompientes a partir de la distancia suavizada a la costa (R.coastTex de relieve3d.js),
     reflejo del cielo según el ángulo de visión (Fresnel) y brillo del sol con oleaje que se desvanece a lo lejos.
     Calidad baja: sin reflejo ni brillo (R.waterU.waterQ = 0) y sin espuma (foamK = 0, como antes).
   · Ríos como cintas: a partir de MAP.riverPaths (addRivers), suavizados, más anchos río abajo, con un ancho mínimo
     en pantalla para que no desaparezcan al alejarse. Una sola llamada de dibujo. */

upgradeWater = function () {
  if (!R.waterMesh || R._waterUp) return; R._waterUp = true;
  Object.assign(R.waterU, {
    foamK: {value: R.lowEnd ? 0 : 1}, waterQ: {value: R.quality === 'bajo' ? 0 : 1}, coastMap: {value: R.coastTex},
    sunW: {value: reliefLightDir()}, skyZ: {value: new THREE.Color(0.42, 0.58, 0.74)}, skyH: {value: new THREE.Color(0.78, 0.86, 0.92)}
  });
  const wm = new THREE.ShaderMaterial({
    uniforms: R.waterU, transparent: true, depthWrite: false, extensions: {derivatives: true},
    vertexShader: `varying vec2 vP; varying vec2 vUv; varying vec3 vWp;
void main(){ vP = position.xy; vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0); vWp = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform float t; uniform float foamK; uniform float waterQ; uniform sampler2D coastMap; uniform vec3 sunW; uniform vec3 skyZ; uniform vec3 skyH;
varying vec2 vP; varying vec2 vUv; varying vec3 vWp;
void main(){
  float fw = length(fwidth(vP)); float near = 1.0 - smoothstep(0.04, 0.16, fw);
  float sdf = (texture2D(coastMap, vUv).r * 255.0 - 128.0) / 32.0;           // píxeles del mapa hasta la costa (< 0 en el mar)
  float sea = 1.0 - smoothstep(-0.1, 0.3, sdf), dc = max(0.0, -sdf);
  float a1 = sin(vP.x * 1.7 + t * 0.9 + sin(vP.y * 0.8 + t * 0.4) * 1.6), a2 = sin(vP.y * 2.1 - t * 0.7 + sin(vP.x * 0.6 - t * 0.3) * 1.3);
  float var = 0.45 + 0.55 * sin(vP.x * 0.23 + vP.y * 0.31 + t * 0.1) * sin(vP.x * 0.11 - vP.y * 0.17);
  float crest = smoothstep(0.62, 1.0, a1 * a2) * near * var;                  // crestas de ola (solo de cerca)
  // espuma: línea de orilla fina y rompientes paralelas a la costa que avanzan hacia tierra
  float shore = (1.0 - smoothstep(0.0, 0.55, dc)) * (0.75 + 0.25 * sin(vP.x * 7.0 + vP.y * 5.0 + t * 1.1));
  float surf = (1.0 - smoothstep(0.6, 3.6, dc)) * smoothstep(0.5, 1.0, sin(dc * 3.0 + t * 1.5 + a1 * 0.7)) * near;
  float fo = clamp(shore * (0.3 + 0.25 * near) + surf * 0.32, 0.0, 1.0) * sea * foamK;
  // reflejo del cielo (Fresnel): más fuerte cuanto más rasante es la vista
  vec3 V = normalize(cameraPosition - vWp);
  vec3 N = normalize(vec3(a2 * 0.16 * near, 1.0, a1 * 0.16 * near));
  float fres = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 4.0) * waterQ;
  vec3 sky = mix(skyZ, skyH, clamp(1.0 - V.y * 1.6, 0.0, 1.0));
  float spec = pow(max(dot(reflect(-sunW, N), V), 0.0), 90.0) * 0.55 * near * waterQ;
  float aSky = fres * 0.55 * sea, aCrest = crest * 0.16 * sea, aFoam = fo * 0.75, aSpec = spec * sea;
  float al = aSky + aCrest + aFoam + aSpec;
  vec3 col = (sky * aSky + vec3(0.8, 0.92, 1.0) * aCrest + vec3(1.0) * aFoam + vec3(1.0, 0.96, 0.85) * aSpec) / max(al, 1e-4);
  gl_FragColor = vec4(col, clamp(al, 0.0, 0.85));
}`
  });
  R.waterMesh.material.dispose(); R.waterMesh.material = wm;
};

/* ---------- ríos como cintas ---------- */
function buildRiverRibbons() {
  if (R.riverMesh || !MAP.riverPaths || !MAP.riverPaths.length) return;
  const pos = [], side = [], par = [], idx = []; let v = 0;
  const into = new Uint8Array(MAP_W * MAP_H);                                   // cauces ya dibujados: un afluente que llega engorda al principal
  MAP.riverPaths.forEach(path => path.forEach(ci => { into[ci] = Math.min(255, into[ci] + 1); }));
  for (const path of MAP.riverPaths) {
    if (path.length < 6) continue;
    // centro de los píxeles, cada 2, y dos pasadas de Chaikin para curvas suaves
    let p = []; for (let k = 0; k < path.length; k += 2) p.push([path[k] % MAP_W + 0.5, ((path[k] / MAP_W) | 0) + 0.5, k / path.length, into[path[k]]]);
    const last = path[path.length - 1]; p.push([last % MAP_W + 0.5, ((last / MAP_W) | 0) + 0.5, 1, into[last]]);
    for (let it = 0; it < 2; it++) { const q = [p[0]]; for (let k = 0; k < p.length - 1; k++) { const a = p[k], b = p[k + 1]; q.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25, a[2] * 0.75 + b[2] * 0.25, Math.max(a[3], b[3])], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75, a[2] * 0.25 + b[2] * 0.75, Math.max(a[3], b[3])]); } q.push(p[p.length - 1]); p = q; }
    let along = 0;
    for (let k = 0; k < p.length; k++) {
      const [px, py, f, n] = p[k], a = p[Math.max(0, k - 1)], b = p[Math.min(p.length - 1, k + 1)];
      const lon = xToLon(px), lat = yToLat(py); let dx = xToLon(b[0]) - xToLon(a[0]), dz = -(yToLat(b[1]) - yToLat(a[1])); const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
      if (k) along += Math.hypot(lon - xToLon(p[k - 1][0]), lat - yToLat(p[k - 1][1]));
      const hw = 0.016 + 0.034 * Math.pow(f, 0.8) + 0.012 * Math.min(3, n - 1);    // semiancho en grados: crece río abajo y con los afluentes
      const y = Math.max(terrainYPx(px, py), terrainYPx(px - dz * 1.2, py - dx * 1.2), terrainYPx(px + dz * 1.2, py + dx * 1.2)) + 0.03;
      for (const s of [-1, 1]) { pos.push(lon, y, -lat); side.push(-dz * s, dx * s); par.push(hw, along, s); }
      if (k) idx.push(v - 2, v - 1, v, v - 1, v + 1, v);
      v += 2;
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('side', new THREE.Float32BufferAttribute(side, 2)); g.setAttribute('rp', new THREE.Float32BufferAttribute(par, 3));
  g.setIndex(idx); g.computeBoundingSphere();
  R.riverU = {t: R.waterU ? R.waterU.t : {value: 0}, pxW: {value: 0.002}, flowQ: {value: R.quality === 'bajo' ? 0 : 1}};
  const m = new THREE.ShaderMaterial({
    uniforms: R.riverU, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4,
    vertexShader: `attribute vec2 side; attribute vec3 rp; uniform float pxW; varying float vS; varying float vA; varying float vFar;
void main(){
  vec4 w = modelMatrix * vec4(position, 1.0); float dist = distance(cameraPosition, w.xyz);
  float hw = max(rp.x, 0.7 * pxW * dist);                                         // nunca más fino que ~1,4 px
  w.xz += side * hw; vS = rp.z; vA = rp.y; vFar = smoothstep(70.0, 170.0, dist);
  gl_Position = projectionMatrix * viewMatrix * w;
}`,
    fragmentShader: `uniform float t; uniform float flowQ; varying float vS; varying float vA; varying float vFar;
void main(){
  float e = abs(vS);
  vec3 core = vec3(0.36, 0.62, 0.80), bank = vec3(0.16, 0.32, 0.42);
  vec3 col = mix(core, bank, smoothstep(0.55, 1.0, e));
  col += vec3(0.12, 0.14, 0.12) * smoothstep(0.7, 1.0, sin(vA * 9.0 - t * 1.6 + vS * 1.5)) * (1.0 - e) * flowQ * (1.0 - vFar);   // corriente
  float a = (1.0 - smoothstep(0.8, 1.0, e)) * mix(0.95, 0.7, vFar);
  gl_FragColor = vec4(col, a);
}`
  });
  const mesh = new THREE.Mesh(g, m); mesh.renderOrder = 1; mesh.frustumCulled = false; R.scene.add(mesh); R.riverMesh = mesh;
}

const _graphicsTickAgua = graphicsTick;
graphicsTick = function (t) {
  _graphicsTickAgua(t);
  if (!R._riversDone && R.scene) { R._riversDone = true; try { buildRiverRibbons(); } catch (e) { console.warn('ríos', e); } }
  if (R.riverU && R.camera) { const h = R.renderer.domElement.clientHeight || 700; R.riverU.pxW.value = 2 * Math.tan(R.camera.fov * Math.PI / 360) / h; }
  if (R.waterU && R.waterU.sunW) R.waterU.sunW.value.copy(reliefLightDir());
};
const _applyQualityAgua = applyQuality;
applyQuality = function (q, why) {
  _applyQualityAgua(q, why);
  if (R.waterU && R.waterU.waterQ) R.waterU.waterQ.value = R.quality === 'bajo' ? 0 : 1;
  if (R.riverU) R.riverU.flowQ.value = R.quality === 'bajo' ? 0 : 1;
};
