/* ===== CIUDADES, PUERTOS Y COMUNICACIONES DEL MAPA DE CAMPAÑA (fase 4) =====
   · Ciudades con núcleo denso en cuadrícula de calles, tamaño según la población y estilo según la región:
     europeo (tejas o pizarra), ruso (cúpulas de bulbo), Oriente Medio y norte de África (azoteas, cúpula y minarete),
     Asia oriental (tejados oscuros, pagoda), sur de Asia (azoteas ocres) y África subsahariana (chozas redondas).
     Aldeas pequeñas en el resto de provincias. Ya no se tiñen con el color del país: eso lo dice el mapa político.
   · Puertos: muelle, almacenes y barcos amarrados en la provincia costera de cada estado poblado.
   · Caminos entre capitales de estado vecinas (por tierra) y ferrocarril en los tramos de países con la tecnología
     «railways»; se rehace al cambiar quién la tiene. Cintas con ancho mínimo en pantalla (dos llamadas de dibujo).
   · Calidad baja: la mitad de casas, sin aldeas ni barcos. */

function cityStyle(lon, lat) {
  if (lat < 12 && lat > -36 && lon > -20 && lon < 52) return 'af';
  if (lon > 95 && lat > -12) return 'as';
  if (lon > 62 && lon <= 95 && lat < 36) return 'in';
  if (lon > -20 && lon < 62 && lat >= 12 && lat < 42 && !(lat > 35.5 && lon < 28)) return 'me';
  if (lon > 26 && lon < 180 && lat >= 44) return 'ru';
  return 'eu';
}
const CSTY = {
  eu: {wall: [0.80, 0.74, 0.62], roof: [[0.62, 0.30, 0.20], [0.34, 0.36, 0.41]], roofType: 'gable', mark: 'iglesia'},
  ru: {wall: [0.78, 0.72, 0.62], roof: [[0.36, 0.46, 0.36], [0.40, 0.38, 0.36]], roofType: 'gable', mark: 'bulbo'},
  me: {wall: [0.88, 0.80, 0.64], roof: [[0.84, 0.76, 0.60], [0.80, 0.70, 0.54]], roofType: 'flat', mark: 'mezquita'},
  as: {wall: [0.72, 0.64, 0.54], roof: [[0.27, 0.26, 0.28], [0.40, 0.22, 0.18]], roofType: 'wide', mark: 'pagoda'},
  in: {wall: [0.82, 0.68, 0.50], roof: [[0.74, 0.48, 0.32], [0.80, 0.70, 0.56]], roofType: 'flat', mark: 'cupula'},
  af: {wall: [0.60, 0.44, 0.30], roof: [[0.70, 0.58, 0.36], [0.62, 0.50, 0.30]], roofType: 'hut', mark: null}
};

buildCities = function () {
  if (R.cityBody || !G.S || !G.S.length) return;
  const low = R.quality === 'bajo', items = [], marks = [], ports = [];
  const onLand = (lon, lat) => { const x = Math.round(lonToX(lon)), y = Math.round(latToY(lat)); return x >= 0 && y >= 0 && x < MAP_W && y < MAP_H && MAP.land[y * MAP_W + x] && MAP.dLand[y * MAP_W + x] > 1; };
  const addTown = (sid, seed, lon0, lat0, n, rad, big) => {
    const sty = cityStyle(lon0, lat0), st = CSTY[sty], rot = hash2(seed, 1, 701) * 1.57, co = Math.cos(rot), si = Math.sin(rot), g = 0.078;
    const cells = []; const R2 = Math.ceil(rad / g) + 1;
    for (let a = -R2; a <= R2; a++) for (let b = -R2; b <= R2; b++) {
      const d = Math.hypot(a, b) * g; if (d > rad) continue;
      if (hash2(seed + a * 31, b, 703) < (big ? 0.16 : 0.3)) continue;                 // calles y plazas
      const jx = (hash2(seed + a, b, 705) - 0.5) * g * 0.35, jz = (hash2(seed + a, b, 707) - 0.5) * g * 0.35;
      const lon = lon0 + (a * g * co - b * g * si) + jx, lat = lat0 + (a * g * si + b * g * co) * 0.85 + jz;
      cells.push([d + hash2(seed + a, b, 709) * g * 0.8, lon, lat, a, b]);
    }
    cells.sort((p, q) => p[0] - q[0]);
    let k = 0;
    for (const [d, lon, lat, a, b] of cells) {
      if (k >= n) break; if (!onLand(lon, lat)) continue;
      const core = 1 - d / rad, r = hash2(seed + a, b, 711);
      items.push({sid, x: lon, z: -lat, y: terrainY(lon, lat), w: 0.05 + r * 0.022 + (big ? core * 0.018 : 0), h: 0.034 + r * 0.03 + (big ? core * core * 0.06 : 0),
        rot: rot + (r < 0.5 ? 0 : 1.5708), sty, wc: r, rc: hash2(seed + a, b, 713)});
      k++;
    }
    return sty;
  };
  G.S.forEach(s => {
    const pop = popTotal(s) || 0; if (!pop) return;
    const prov = MAP.provs[stateCapitalProv(s.id)], lon0 = xToLon(prov.px + 0.5), lat0 = yToLat(prov.py + 0.5);
    const n = Math.round(clamp(3 + Math.sqrt(pop / 18000), 4, 70) * (low ? 0.5 : 1)), rad = 0.13 + Math.sqrt(pop) / 6000;
    const sty = addTown(s.id, s.id * 13 + 1, lon0, lat0, n, rad, pop > 250000);
    if (pop > 380000 && CSTY[sty].mark) marks.push({sid: s.id, x: lon0 + 0.012, z: -lat0 - 0.01, y: terrainY(lon0, lat0), kind: CSTY[sty].mark, s: 1.5 + Math.min(1.2, Math.sqrt(pop) / 1800)});
    // aldeas en las demás provincias del estado
    if (!low) MAP.stats[s.id].provs.forEach((pid, j) => {
      if (pid === stateCapitalProv(s.id) || hash2(pid, 3, 715) > 0.75) return; const pv = MAP.provs[pid];
      addTown(s.id, pid * 7 + 5, xToLon(pv.px + 0.5), yToLat(pv.py + 0.5), 2 + Math.round(hash2(pid, 5, 717) * 4 + Math.min(4, pop / 600000)), 0.12, false);
    });
    // puerto
    if (pop > 120000 && typeof portProvOf === 'function') {
      const pp = portProvOf(s.id); if (pp == null) return; const pv = MAP.provs[pp];
      let best = null;                                                              // el mar más cercano a la provincia costera
      for (let r = 1; r <= 9 && !best; r++) for (let a = 0; a < 16; a++) { const x = Math.round(pv.px + Math.cos(a / 16 * 6.283) * r), y = Math.round(pv.py + Math.sin(a / 16 * 6.283) * r); if (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H) continue; if (!MAP.land[y * MAP_W + x]) { best = [x, y, a / 16 * 6.283]; break; } }
      if (!best) return;
      // punto de la orilla: retrocede hacia tierra hasta pisarla
      let sx = best[0], sy = best[1]; for (let t = 0; t < 8 && !MAP.land[Math.round(sy) * MAP_W + Math.round(sx)]; t++) { sx -= Math.cos(best[2]) * 0.5; sy -= Math.sin(best[2]) * 0.5; }
      const lon = xToLon(sx + 0.5), lat = yToLat(sy + 0.5), dlon = Math.cos(best[2]), dlat = -Math.sin(best[2]);
      ports.push({sid: s.id, lon, lat, dlon, dlat, n: Math.min(3, 1 + Math.round(pop / 900000)), y: Math.max(0.02, terrainY(lon, lat))});
    }
  });
  // geometrías
  const body = BX(1, 1, 1).translate(0, 0.5, 0);
  const geoRoof = {gable: CN(0.85, 0.7, 4).rotateY(Math.PI / 4).translate(0, 1.35, 0), wide: CN(1.05, 0.45, 4).rotateY(Math.PI / 4).translate(0, 1.22, 0), flat: BX(1.04, 0.1, 1.04).translate(0, 1.04, 0), hut: CN(0.78, 0.9, 8).translate(0, 1.4, 0)};
  const hutBody = CY(0.55, 1, 8).translate(0, 0.5, 0);
  const meshes = {}; const lam = () => new THREE.MeshLambertMaterial({color: 0xffffff});
  const count = {}; items.forEach(it => { const rt = CSTY[it.sty].roofType; count[rt] = (count[rt] || 0) + 1; });
  const bodyMesh = new THREE.InstancedMesh(body, lam(), Math.max(1, items.length - (count.hut || 0)));
  const hutMesh = new THREE.InstancedMesh(hutBody, lam(), Math.max(1, count.hut || 0));
  Object.keys(geoRoof).forEach(k => { meshes[k] = new THREE.InstancedMesh(geoRoof[k], lam(), Math.max(1, count[k] || 0)); meshes[k].count = 0; });
  bodyMesh.count = 0; hutMesh.count = 0;
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), sc = new THREE.Vector3(), c = new THREE.Color(), up = new THREE.Vector3(0, 1, 0);
  items.forEach(it => {
    const st = CSTY[it.sty], rt = st.roofType, bm = rt === 'hut' ? hutMesh : bodyMesh;
    q.setFromAxisAngle(up, it.rot); p.set(it.x, it.y, it.z); sc.set(it.w, it.h, it.w * (rt === 'hut' ? 1 : 0.8)); m4.compose(p, q, sc);
    c.setRGB(st.wall[0] * (0.9 + it.wc * 0.18), st.wall[1] * (0.9 + it.wc * 0.16), st.wall[2] * (0.9 + it.wc * 0.14)); bm.setMatrixAt(bm.count, m4); bm.setColorAt(bm.count, c); bm.count++;
    const rm = meshes[rt], rc = st.roof[it.rc < 0.7 ? 0 : 1]; c.setRGB(rc[0] * (0.88 + it.rc * 0.2), rc[1] * (0.88 + it.rc * 0.2), rc[2] * (0.88 + it.rc * 0.2)); rm.setMatrixAt(rm.count, m4); rm.setColorAt(rm.count, c); rm.count++;
  });
  // monumentos
  const MK = {
    iglesia: mergeParts([{geo: BX(0.05, 0.05, 0.1).translate(0, 0.025, 0), m: new THREE.Matrix4(), col: 0xe6dcc4}, {geo: CN(0.05, 0.035, 4).rotateY(Math.PI / 4), m: mk4(0, 0.067, 0), col: 0x7a3a2a}, {geo: BX(0.035, 0.12, 0.035).translate(0, 0.06, 0), m: mk4(0, 0, -0.06), col: 0xeadfc6}, {geo: CN(0.03, 0.07, 4).rotateY(Math.PI / 4), m: mk4(0, 0.155, -0.06), col: 0x4a4e58}]),
    bulbo: mergeParts([{geo: BX(0.07, 0.06, 0.07).translate(0, 0.03, 0), m: new THREE.Matrix4(), col: 0xf0ead8}, {geo: CY(0.02, 0.05, 8), m: mk4(0, 0.085, 0), col: 0xf0ead8}, {geo: SP(0.026), m: mk4(0, 0.125, 0), col: 0xd8b04a}, {geo: CN(0.01, 0.03, 6), m: mk4(0, 0.16, 0), col: 0xd8b04a}]),
    mezquita: mergeParts([{geo: BX(0.08, 0.04, 0.08).translate(0, 0.02, 0), m: new THREE.Matrix4(), col: 0xece2c8}, {geo: SP(0.035).scale(1, 0.8, 1), m: mk4(0, 0.05, 0), col: 0x6aa0a8}, {geo: CY(0.008, 0.14, 6).translate(0, 0.07, 0), m: mk4(0.05, 0, 0.05), col: 0xf2ead6}, {geo: CN(0.012, 0.025, 6), m: mk4(0.05, 0.152, 0.05), col: 0x6aa0a8}]),
    pagoda: mergeParts([0, 1, 2, 3].flatMap(k => [{geo: BX(0.05 - k * 0.008, 0.025, 0.05 - k * 0.008), m: mk4(0, 0.0125 + k * 0.034, 0), col: 0x8a3a2a}, {geo: CN(0.05 - k * 0.006, 0.014, 4).rotateY(Math.PI / 4), m: mk4(0, 0.03 + k * 0.034, 0), col: 0x2e2c30}])),
    cupula: mergeParts([{geo: BX(0.09, 0.035, 0.07).translate(0, 0.0175, 0), m: new THREE.Matrix4(), col: 0xf2ece0}, {geo: SP(0.032), m: mk4(0, 0.045, 0), col: 0xf6f2ea}, {geo: CY(0.007, 0.07, 6).translate(0, 0.035, 0), m: mk4(0.04, 0, 0.03), col: 0xf2ece0}, {geo: CY(0.007, 0.07, 6).translate(0, 0.035, 0), m: mk4(-0.04, 0, 0.03), col: 0xf2ece0}])
  };
  const markMeshes = {};
  Object.keys(MK).forEach(k => { const list = marks.filter(m => m.kind === k); const mm = new THREE.InstancedMesh(MK[k], new THREE.MeshLambertMaterial({vertexColors: true}), Math.max(1, list.length)); mm.count = list.length; list.forEach((m, i) => { p.set(m.x, m.y, m.z); q.identity(); sc.set(m.s, m.s, m.s); m4.compose(p, q, sc); mm.setMatrixAt(i, m4); }); markMeshes[k] = mm; });
  // puertos: muelle de piedra, dos almacenes y barcos amarrados
  const pier = mergeParts([{geo: BX(0.02, 0.012, 0.11).translate(0, 0.006, 0.055), m: new THREE.Matrix4(), col: 0x8a8274}, {geo: BX(0.045, 0.03, 0.03).translate(0, 0.015, 0), m: mk4(0.04, 0, -0.03), col: 0x9a6a4a}, {geo: BX(0.04, 0.026, 0.03).translate(0, 0.013, 0), m: mk4(-0.04, 0, -0.035), col: 0x8a5a3e}]);
  const boat = mergeParts([{geo: BX(0.018, 0.012, 0.06), m: mk4(0, 0.006, 0), col: 0x4a3524}, {geo: CY(0.0025, 0.07, 4).translate(0, 0.035, 0), m: mk4(0, 0.012, 0.005), col: 0x3a2a1a}, {geo: BX(0.002, 0.04, 0.03), m: mk4(0, 0.05, 0.005), col: 0xeee6d2}]);
  const pierMesh = new THREE.InstancedMesh(pier, new THREE.MeshLambertMaterial({vertexColors: true}), Math.max(1, ports.length));
  const boatMesh = new THREE.InstancedMesh(boat, new THREE.MeshLambertMaterial({vertexColors: true}), Math.max(1, ports.length * 3));
  pierMesh.count = ports.length; boatMesh.count = 0;
  ports.forEach((pt, i) => {
    q.setFromAxisAngle(up, Math.atan2(pt.dlon, -pt.dlat)); p.set(pt.lon, pt.y, -pt.lat); sc.set(1, 1, 1); m4.compose(p, q, sc); pierMesh.setMatrixAt(i, m4);
    if (low) return;
    for (let b = 0; b < pt.n; b++) {
      const side = b % 2 ? 1 : -1, along = 0.04 + b * 0.025, px = pt.lon + pt.dlon * along - pt.dlat * 0.025 * side, pz = -pt.lat - pt.dlat * along - pt.dlon * 0.025 * side;
      q.setFromAxisAngle(up, Math.atan2(pt.dlon, -pt.dlat) + 0.15 * side); p.set(px, 0.012, pz); m4.compose(p, q, sc); boatMesh.setMatrixAt(boatMesh.count++, m4);
    }
  });
  const all = [bodyMesh, hutMesh, ...Object.values(meshes), ...Object.values(markMeshes), pierMesh, boatMesh];
  all.forEach(m => { m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; m.frustumCulled = false; R.scene.add(m); });
  R.cityAll = all; R.cityBody = bodyMesh; R.cityRoof = meshes.gable; R.cityTower = markMeshes.iglesia; R.cityItems = items; R.cityMesh = bodyMesh; R.cityPorts = ports;
  R.cityStats = {casas: items.length, monumentos: marks.length, puertos: ports.length};
  try { buildRoads(); } catch (e) { console.warn('caminos', e); }
  updateCityVisibility(true);
};
updateCityColors = function () {};                                                  // las casas ya no llevan el color del país
updateCityVisibility = function (force) {
  const on = R.cam.dist < 36; if (!R.cityAll || (!force && R._cityOn === on)) return; R._cityOn = on;
  R.cityAll.forEach(m => { m.visible = on; }); R.dirty = true;
};

/* ---------- caminos y ferrocarriles ---------- */
function roadEdges() {
  const nodes = []; G.S.forEach(s => { if (!(popTotal(s) > 0)) return; const pv = MAP.provs[stateCapitalProv(s.id)]; nodes.push({sid: s.id, lon: xToLon(pv.px + 0.5), lat: yToLat(pv.py + 0.5)}); });
  const landLine = (a, b) => { const n = Math.ceil(Math.hypot(b.lon - a.lon, b.lat - a.lat) / 0.15); for (let k = 1; k < n; k++) { const t = k / n, x = Math.round(lonToX(a.lon + (b.lon - a.lon) * t)), y = Math.round(latToY(a.lat + (b.lat - a.lat) * t)); if (!MAP.land[y * MAP_W + x]) return false; } return true; };
  const edges = [], seen = new Set();
  nodes.forEach(a => {
    const near = nodes.filter(b => b !== a).map(b => [Math.hypot((b.lon - a.lon) * Math.cos(a.lat * Math.PI / 180), b.lat - a.lat), b]).filter(x => x[0] < 7).sort((x, y) => x[0] - y[0]).slice(0, 3);
    near.forEach(([d, b]) => { const key = Math.min(a.sid, b.sid) + '-' + Math.max(a.sid, b.sid); if (seen.has(key) || !landLine(a, b)) return; seen.add(key); edges.push([a, b]); });
  });
  return edges;
}
function ribbonPath(a, b, seed) {
  // trazado algo curvo (no una regla): punto medio desplazado y Chaikin
  const mx = (a.lon + b.lon) / 2, my = (a.lat + b.lat) / 2, dx = b.lon - a.lon, dy = b.lat - a.lat, L = Math.hypot(dx, dy) || 1, o = (hash2(seed, 7, 721) - 0.5) * 0.18 * L;
  let p = [[a.lon, a.lat], [mx - dy / L * o, my + dx / L * o], [b.lon, b.lat]];
  for (let it = 0; it < 3; it++) { const q = [p[0]]; for (let k = 0; k < p.length - 1; k++) { const u = p[k], v = p[k + 1]; q.push([u[0] * 0.75 + v[0] * 0.25, u[1] * 0.75 + v[1] * 0.25], [u[0] * 0.25 + v[0] * 0.75, u[1] * 0.25 + v[1] * 0.75]); } q.push(p[p.length - 1]); p = q; }
  const out = []; for (let k = 0; k < p.length - 1; k++) { const u = p[k], v = p[k + 1], n = Math.max(1, Math.ceil(Math.hypot(v[0] - u[0], v[1] - u[1]) / 0.12)); for (let s = 0; s < n; s++) out.push([u[0] + (v[0] - u[0]) * s / n, u[1] + (v[1] - u[1]) * s / n]); } out.push(p[p.length - 1]);
  return out;
}
function buildRibbon(lines, hw, kind) {
  const pos = [], side = [], par = [], idx = []; let v = 0;
  lines.forEach(pts => {
    let along = 0;
    for (let k = 0; k < pts.length; k++) {
      const [lon, lat] = pts[k], a = pts[Math.max(0, k - 1)], b = pts[Math.min(pts.length - 1, k + 1)];
      let dx = b[0] - a[0], dz = -(b[1] - a[1]); const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
      if (k) along += Math.hypot(lon - pts[k - 1][0], lat - pts[k - 1][1]);
      const y = Math.max(terrainY(lon, lat), terrainY(lon - dz * 0.08, lat + dx * 0.08), terrainY(lon + dz * 0.08, lat - dx * 0.08)) + 0.028;
      for (const s of [-1, 1]) { pos.push(lon, y, -lat); side.push(-dz * s, dx * s); par.push(hw, along, s); }
      if (k) idx.push(v - 2, v - 1, v, v - 1, v + 1, v);
      v += 2;
    }
  });
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('side', new THREE.Float32BufferAttribute(side, 2)); g.setAttribute('rp', new THREE.Float32BufferAttribute(par, 3)); g.setIndex(idx); g.computeBoundingSphere();
  const rail = kind === 'rail';
  const m = new THREE.ShaderMaterial({
    uniforms: R.roadU, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4,
    vertexShader: `attribute vec2 side; attribute vec3 rp; uniform float pxW; varying float vS; varying float vA; varying float vD;
void main(){ vec4 w = modelMatrix * vec4(position, 1.0); float dist = distance(cameraPosition, w.xyz); w.xz += side * max(rp.x, ${rail ? '0.75' : '0.55'} * pxW * dist); vS = rp.z; vA = rp.y; vD = dist; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform float modeK; varying float vS; varying float vA; varying float vD;
void main(){
  float e = abs(vS), edge = 1.0 - smoothstep(0.7, 1.0, e);
  ${rail ? `float tie = step(0.55, fract(vA * 40.0)) * (1.0 - smoothstep(30.0, 60.0, vD));
  vec3 col = mix(vec3(0.20, 0.18, 0.18), vec3(0.46, 0.38, 0.30), tie * step(0.35, e));
  float a = edge * mix(0.95, 0.75, smoothstep(60.0, 150.0, vD)) * (1.0 - smoothstep(150.0, 210.0, vD)) * modeK;`
    : `vec3 col = mix(vec3(0.66, 0.56, 0.40), vec3(0.42, 0.34, 0.24), smoothstep(0.5, 1.0, e));
  float a = edge * 0.7 * (1.0 - smoothstep(55.0, 95.0, vD)) * modeK;`}
  gl_FragColor = vec4(col, a);
}`
  });
  const mesh = new THREE.Mesh(g, m); mesh.renderOrder = 1; mesh.frustumCulled = false; return mesh;
}
function railKey() { return G.tags.filter(t => G.C[t] && G.C[t].techs && G.C[t].techs.has('railways')).sort().join(','); }
function buildRoads() {
  if (!R.roadU) R.roadU = {pxW: R.riverU ? R.riverU.pxW : {value: 0.002}, modeK: {value: 1}};
  if (!R.roadEdges) R.roadEdges = roadEdges().map((e, i) => ({a: e[0], b: e[1], pts: ribbonPath(e[0], e[1], i)}));
  if (!R.roadMesh) { R.roadMesh = buildRibbon(R.roadEdges.map(e => e.pts), 0.009, 'road'); R.scene.add(R.roadMesh); }
  rebuildRails();
}
function rebuildRails() {
  const key = railKey(); if (key === R._railKey) return; R._railKey = key;
  if (R.railMesh) { R.scene.remove(R.railMesh); R.railMesh.geometry.dispose(); R.railMesh.material.dispose(); R.railMesh = null; }
  const has = t => G.C[t] && G.C[t].techs && G.C[t].techs.has('railways');
  const lines = R.roadEdges.filter(e => { const oa = G.S[e.a.sid].owner, ob = G.S[e.b.sid].owner; return has(oa) && has(ob); }).map(e => e.pts);
  R.railCount = lines.length;
  if (lines.length) { R.railMesh = buildRibbon(lines, 0.012, 'rail'); R.scene.add(R.railMesh); }
  R.dirty = true;
}

const _graphicsTickCiu = graphicsTick;
graphicsTick = function (t) {
  _graphicsTickCiu(t);
  if (R.roadU) { R.roadU.modeK.value = R.mode === 'terrain' ? 1 : 0.6; if (G.date.m !== R._railMonth) { R._railMonth = G.date.m; try { rebuildRails(); } catch (e) {} } }
};
