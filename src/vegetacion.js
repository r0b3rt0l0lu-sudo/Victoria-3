/* ===== VEGETACIÓN Y SUELO DEL MAPA DE CAMPAÑA (fase 3) =====
   · Árboles instanciados (InstancedMesh): frondosos, coníferas, palmeras y matorral, colocados al cargar según el bioma,
     la altitud real (límite del bosque) y la pendiente. Solo se dibujan los cercanos a la cámara: al moverse se rellenan
     las instancias visibles (3 llamadas de dibujo como mucho), con un tope por calidad: bajo 0, medio 5000, alto 14000.
     En los modos que no son Terreno se dibujan menos (40 %) para no ensuciar los colores de los países.
   · Color por estación: copas ocres y rojizas en otoño, escarcha en invierno en las coníferas del norte.
   · En el shader del terreno (relieve3d.js): dunas en los desiertos y hielo marino polar en invierno. */
const VEG_CAP = {bajo: 0, medio: 5000, alto: 14000}, VEG_DIST = 72;
const VEG_T = {HOJA: 0, CONIFERA: 1, PALMERA: 2, MATA: 3};

function treeLineAt(lat) { const la = Math.abs(lat); return 4300 - 3800 * Math.pow(clamp((la - 10) / 62, 0, 1), 1.3); }   // ≈1900 m en los Alpes, ≈700 m en Laponia

function buildVegetationCandidates() {
  if (R.vegC) return R.vegC;
  const t0 = performance.now(), W = MAP_W, H = MAP_H, land = MAP.land, bio = MAP.biome, out = [];
  const nearRiver = new Uint8Array(W * H);
  (MAP.riverPaths || []).forEach(p => p.forEach(ci => { for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) { const j = ci + dy * W + dx; if (j >= 0 && j < W * H) nearRiver[j] = 1; } }));
  for (let y = 2; y < H - 2; y++) {
    const lat = yToLat(y), la = Math.abs(lat), tl = treeLineAt(lat);
    for (let x = 0; x < W; x++) {
      const i = y * W + x; if (!land[i] || MAP.dLand[i] < 1.5) continue;
      const b = bio[i], r = hash2(x, y, 401); let p = 0, type = VEG_T.HOJA;
      if (b === BIOME.FOREST) { p = 0.85; type = la > 47 && hash2(x, y, 403) < 0.65 ? VEG_T.CONIFERA : VEG_T.HOJA; }
      else if (b === BIOME.JUNGLE) { p = 0.95; type = VEG_T.HOJA; }
      else if (b === BIOME.TUNDRA) { p = la < 66 ? 0.35 : 0.04; type = VEG_T.CONIFERA; }
      else if (b === BIOME.GRASS) { const g = fbm(x / 18, y / 18, 409, 3); p = g > 0.57 ? 0.6 : 0.02; type = la > 52 && hash2(x, y, 405) < 0.5 ? VEG_T.CONIFERA : VEG_T.HOJA; }
      else if (b === BIOME.STEPPE) { p = 0.03; type = VEG_T.MATA; }
      else if (b === BIOME.DESERT) { p = nearRiver[i] ? 0.35 : (MAP.dLand[i] < 3 && la < 32 ? 0.04 : 0); type = VEG_T.PALMERA; }
      else if (b === BIOME.MOUNTAIN) { p = 0.3; type = la > 40 ? VEG_T.CONIFERA : VEG_T.HOJA; }
      if (!p || r > p) continue;
      const lon = xToLon(x + hash2(x, y, 407)), lt = yToLat(y + hash2(x, y, 411));
      const m = elevAt(lon, lt).h; if (m > tl) continue;
      if (type === VEG_T.HOJA && la < 24 && b !== BIOME.JUNGLE && hash2(x, y, 413) < 0.3) type = VEG_T.PALMERA;
      const px = lonToX(lon), py = latToY(lt), y0 = terrainYPx(px, py), sl = Math.abs(terrainYPx(px + 1, py) - y0) + Math.abs(terrainYPx(px, py + 1) - y0);
      if (sl > 0.12) continue;                                                     // nada de árboles en los cortados
      out.push(lon, y0, -lt, type, hash2(x, y, 415), b);
    }
  }
  R.vegC = new Float32Array(out); R.vegMs = Math.round(performance.now() - t0);
  return R.vegC;
}

function buildVegetationMeshes() {
  if (R.vegMeshes) return;
  const geo = [];
  // frondoso: octaedro achatado (8 triángulos); conífera: cono de 5 lados; palmera: estrella plana; mata: octaedro pequeño
  const hoja = new THREE.OctahedronGeometry(1, 0); hoja.scale(1, 0.75, 1); hoja.translate(0, 0.75, 0);
  const coni = new THREE.ConeGeometry(0.7, 2.2, 5, 1); coni.translate(0, 1.1, 0);
  const palm = new THREE.ConeGeometry(1.1, 0.5, 6, 1); palm.translate(0, 1.0, 0);
  const mata = new THREE.OctahedronGeometry(0.6, 0); mata.scale(1, 0.6, 1); mata.translate(0, 0.35, 0);
  [hoja, coni, palm, mata].forEach(g => geo.push(g));
  R.vegMeshes = geo.map((g, k) => {
    const m = new THREE.InstancedMesh(g, new THREE.MeshLambertMaterial({color: 0xffffff}), VEG_CAP.alto);
    m.count = 0; m.frustumCulled = false; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    m.setColorAt(0, new THREE.Color(1, 1, 1)); m.instanceColor.setUsage(THREE.DynamicDrawUsage);
    m.renderOrder = 0; R.scene.add(m); return m;
  });
}

// colores de copa por tipo, estación y latitud
function vegColor(type, rnd, lat, s, out) {
  const la = Math.abs(lat);
  if (type === VEG_T.CONIFERA) out.setRGB(0.12 + rnd * 0.05, 0.25 + rnd * 0.06, 0.17 + rnd * 0.04);
  else if (type === VEG_T.PALMERA) out.setRGB(0.36 + rnd * 0.06, 0.50 + rnd * 0.06, 0.20);
  else if (type === VEG_T.MATA) out.setRGB(0.42 + rnd * 0.08, 0.44 + rnd * 0.06, 0.24);
  else {
    out.setRGB(0.16 + rnd * 0.07, 0.34 + rnd * 0.08, 0.14 + rnd * 0.04);
    const au = s.autumn * clamp((la - 28) / 14, 0, 1);                              // otoño solo fuera de los trópicos
    if (au > 0) { const k = rnd < 0.4 ? [0.62, 0.36, 0.12] : rnd < 0.7 ? [0.55, 0.22, 0.10] : [0.66, 0.54, 0.20]; out.r += (k[0] - out.r) * au; out.g += (k[1] - out.g) * au; out.b += (k[2] - out.b) * au; }
    const bare = s.snow * clamp((la - 38) / 12, 0, 1);                                // invierno: ramas desnudas, pardo grisáceo
    if (bare > 0) { out.r += (0.36 - out.r) * bare * 0.8; out.g += (0.32 - out.g) * bare * 0.8; out.b += (0.28 - out.b) * bare * 0.8; }
  }
  const fr = s.snow * clamp((la - 44) / 14, 0, 1) * (type === VEG_T.CONIFERA ? 0.55 : 0.35);   // escarcha
  if (fr > 0) { out.r += (0.92 - out.r) * fr; out.g += (0.95 - out.g) * fr; out.b += (0.98 - out.b) * fr; }
}

function vegSeason() {
  const doy = G.date.m * 30.4 + G.date.d, st = seasonState();
  return {autumn: clamp(1 - Math.abs(doy - 290) / 55, 0, 1), snow: st.snow};
}
function refreshVegetation(force) {
  const cap = VEG_CAP[R.quality] || 0, d = R.cam.dist;
  if (!cap || d > VEG_DIST) { if (R.vegMeshes && R.vegMeshes.some(m => m.count)) { R.vegMeshes.forEach(m => { m.count = 0; }); R.dirty = true; } R._vegKey = null; return; }
  if (!R.vegC) { buildVegetationCandidates(); buildVegetationMeshes(); }
  const s = vegSeason(), sea = Math.round(s.autumn * 8) + '|' + Math.round(s.snow * 8);
  const key = [Math.round(R.cam.tx / 3), Math.round(R.cam.tz / 3), Math.round(d / 6), R.quality, R.mode === 'terrain', sea].join(',');
  if (!force && key === R._vegKey) return; R._vegKey = key;
  const C = R.vegC, n = C.length / 6, rad = d * 1.05 + 4, rad2 = rad * rad, cx = R.cam.tx, cz = R.cam.tz;
  const dens = (R.mode === 'terrain' ? 1 : 0.4) * clamp((VEG_DIST - d) / 14, 0, 1);  // se aclara al acercarse al límite (sin saltos bruscos)
  // tamaño en grados: crece un poco al alejarse para seguir leyéndose
  const sz = 0.055 + d * 0.0016;
  // primero contamos cuántos caben para repartir el tope de forma uniforme
  let inR = 0; for (let k = 0; k < n; k++) { const dx = C[k * 6] - cx, dz = C[k * 6 + 2] - cz; if (dx * dx + dz * dz < rad2) inR++; }
  const keep = Math.min(1, cap / Math.max(1, inR)) * dens;
  const cnt = [0, 0, 0, 0], mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), p = new THREE.Vector3(), col = new THREE.Color(), up = new THREE.Vector3(0, 1, 0);
  for (let k = 0; k < n; k++) {
    const o = k * 6, dx = C[o] - cx, dz = C[o + 2] - cz; if (dx * dx + dz * dz >= rad2) continue;
    const rnd = C[o + 4]; if (rnd > keep) continue;
    const ty = C[o + 3], m = R.vegMeshes[ty], c = cnt[ty]; if (c >= VEG_CAP.alto) continue;
    const s1 = sz * (0.75 + rnd * 0.6);
    q.setFromAxisAngle(up, rnd * 6.283); sc.set(s1, s1 * (0.9 + rnd * 0.3), s1); p.set(C[o], C[o + 1], C[o + 2]);
    mtx.compose(p, q, sc); m.setMatrixAt(c, mtx); vegColor(ty, (rnd * 7.13) % 1, -C[o + 2], s, col); m.setColorAt(c, col); cnt[ty]++;
  }
  R.vegMeshes.forEach((m, t) => { m.count = cnt[t]; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; });
  R.vegVisible = cnt.reduce((a, b) => a + b, 0); R.dirty = true;
}

const _graphicsTickVeg = graphicsTick;
graphicsTick = function (t) {
  _graphicsTickVeg(t);
  if (R.scene && R.mesh) { try { refreshVegetation(); } catch (e) { console.warn('vegetación', e); R.vegC = new Float32Array(0); } }
};
const _applyQualityVeg = applyQuality;
applyQuality = function (q, why) { _applyQualityVeg(q, why); if (R.vegMeshes || R.vegC) refreshVegetation(true); };
