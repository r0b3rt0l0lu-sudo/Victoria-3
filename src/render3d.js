/* ===== ELEMENTOS 3D DEL MAPA: ciudades con casas y campanarios, y ejércitos en miniatura ===== */
function mergeParts(parts) {
  const pos = [], nor = [];
  parts.forEach(p => {
    const g = p.geo.index ? p.geo.toNonIndexed() : p.geo.clone();
    g.applyMatrix4(p.m);
    pos.push(...g.attributes.position.array); nor.push(...g.attributes.normal.array);
    if (p.col) { p._n = g.attributes.position.count; }
  });
  const col = []; parts.forEach(p => { const c = new THREE.Color(p.col === undefined ? 0xffffff : p.col); const n = p._n || (p.geo.index ? p.geo.index.count : p.geo.attributes.position.count); for (let k = 0; k < n; k++) col.push(c.r, c.g, c.b); });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return g;
}
const mk4 = (x, y, z, rx, ry, rz) => { const m = new THREE.Matrix4(), q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rx || 0, ry || 0, rz || 0)); return m.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(1, 1, 1)); };
const BX = (w, h, d) => new THREE.BoxGeometry(w, h, d), CY = (r, h, s) => new THREE.CylinderGeometry(r, r, h, s || 6), SP = r => new THREE.SphereGeometry(r, 6, 5), CN = (r, h, s) => new THREE.ConeGeometry(r, h, s || 6);

/* ---------- ciudades ---------- */
function buildCities() {
  if (R.cityBody || !G.S || !G.S.length) return;
  const houses = [], towers = [];
  G.S.forEach(s => {
    const pop = popTotal(s) || 0; if (!pop) return;
    const prov = MAP.provs[stateCapitalProv(s.id)];
    const n = clamp(Math.round(4 + Math.sqrt(pop / 45000)), 5, 24);
    const place = (k, rmax) => {
      let px = prov.px, py = prov.py;
      if (k) { for (let t = 0; t < 4; t++) { const a = hash2(s.id, k * 7 + t, 17) * 6.283, r = 1.2 + hash2(s.id, k * 5 + t, 19) * rmax; const qx = Math.round(px0(prov) + Math.cos(a) * r), qy = Math.round(py0(prov) + Math.sin(a) * r * 0.85), qi = qy * MAP_W + qx; if (qx > 0 && qy > 0 && qx < MAP_W && qy < MAP_H && MAP.land[qi] && MAP.stateOf[qi] === s.id) { px = qx; py = qy; break; } } }
      return {x: xToLon(px), z: -yToLat(py), y: MAP.height[py * MAP_W + px] * R.exag};
    };
    for (let k = 0; k < n; k++) {
      const p = place(k, 2.2 + Math.sqrt(pop / 1e5) * 0.9), big = k < 3;
      houses.push({sid: s.id, ...p, w: 0.1 + hash2(s.id, k, 3) * 0.06 + (big ? 0.04 : 0), h: 0.05 + hash2(s.id, k, 5) * 0.05 + (big ? 0.04 : 0), rot: hash2(s.id, k, 7) * 3.14, wc: hash2(s.id, k, 9)});
    }
    if (pop > 400000) { const p = place(0, 0); towers.push({sid: s.id, x: p.x + 0.04, z: p.z - 0.03, y: p.y, h: 0.28 + Math.min(0.3, Math.sqrt(pop) / 4000)}); }
  });
  const body = new THREE.InstancedMesh(BX(1, 1, 1).translate(0, 0.5, 0), new THREE.MeshLambertMaterial({color: 0xffffff}), houses.length);
  const roof = new THREE.InstancedMesh(CN(0.85, 0.95, 4).rotateY(Math.PI / 4).translate(0, 1.47, 0), new THREE.MeshLambertMaterial({color: 0xffffff}), houses.length);
  const tg = mergeParts([{geo: CY(0.5, 1, 6).translate(0, 0.5, 0), m: new THREE.Matrix4(), col: 0xeadfc6}, {geo: CN(0.62, 0.5, 6), m: mk4(0, 1.25, 0), col: 0x9c4a3a}]);
  const tower = new THREE.InstancedMesh(tg, new THREE.MeshLambertMaterial({vertexColors: true}), Math.max(1, towers.length));
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), sc = new THREE.Vector3(), c = new THREE.Color();
  houses.forEach((h, i) => {
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), h.rot); p.set(h.x, h.y, h.z); sc.set(h.w, h.h, h.w * 0.85); m4.compose(p, q, sc); body.setMatrixAt(i, m4);
    sc.set(h.w, h.h, h.w * 0.85); const m2 = new THREE.Matrix4().compose(p, q, sc); roof.setMatrixAt(i, m2);
    c.setRGB(0.72 + h.wc * 0.14, 0.64 + h.wc * 0.1, 0.5 + h.wc * 0.1); body.setColorAt(i, c);
  });
  towers.forEach((t, i) => { p.set(t.x, t.y, t.z); q.identity(); sc.set(0.11, t.h * 0.45, 0.11); m4.compose(p, q, sc); tower.setMatrixAt(i, m4); });
  tower.count = towers.length;
  [body, roof, tower].forEach(m => { m.instanceMatrix.needsUpdate = true; R.scene.add(m); });
  R.cityBody = body; R.cityRoof = roof; R.cityTower = tower; R.cityItems = houses; R.cityMesh = body;
  updateCityColors();
}
const px0 = pv => pv.px, py0 = pv => pv.py;
function updateCityColors() {
  if (!R.cityRoof) return; const c = new THREE.Color();
  R.cityItems.forEach((it, i) => { const s = G.S[it.sid]; let r = 0.6, g = 0.26, b = 0.2; if (s.owner !== NONE && G.C[s.owner]) { const rgb = R.occRGB(s.owner); r = 0.45 * 0.6 + rgb[0] / 255 * 0.55; g = 0.45 * 0.26 + rgb[1] / 255 * 0.55; b = 0.45 * 0.2 + rgb[2] / 255 * 0.55; r *= 0.85; g *= 0.85; b *= 0.85; } c.setRGB(r, g, b); R.cityRoof.setColorAt(i, c); });
  if (R.cityRoof.instanceColor) R.cityRoof.instanceColor.needsUpdate = true;
  if (R.cityBody.instanceColor) R.cityBody.instanceColor.needsUpdate = true;
}

/* ---------- ejércitos en miniatura ---------- */
const FIG_CAP = 2500, FS = 2.7;
function buildFigures() {
  if (R.figs) return;
  const skin = 0xe3c29a, dark = 0x2a2a2e, brown = 0x6b4a2b, steel = 0x55595e;
  const inf = {tint: mergeParts([{geo: CY(0.03, 0.085, 6).translate(0, 0.0425, 0), m: new THREE.Matrix4()}]), fixed: mergeParts([{geo: SP(0.026), m: mk4(0, 0.105, 0), col: skin}, {geo: CY(0.028, 0.03, 6), m: mk4(0, 0.13, 0), col: dark}, {geo: BX(0.012, 0.012, 0.13), m: mk4(0.03, 0.07, 0.02), col: steel}])};
  const cav = {tint: mergeParts([{geo: CY(0.022, 0.07, 6), m: mk4(0, 0.17, 0)}]), fixed: mergeParts([{geo: BX(0.06, 0.06, 0.15), m: mk4(0, 0.1, 0), col: brown}, {geo: BX(0.04, 0.05, 0.07), m: mk4(0, 0.14, 0.1), col: brown}, {geo: BX(0.012, 0.07, 0.012), m: mk4(0.022, 0.035, 0.055), col: brown}, {geo: BX(0.012, 0.07, 0.012), m: mk4(-0.022, 0.035, 0.055), col: brown}, {geo: BX(0.012, 0.07, 0.012), m: mk4(0.022, 0.035, -0.055), col: brown}, {geo: BX(0.012, 0.07, 0.012), m: mk4(-0.022, 0.035, -0.055), col: brown}, {geo: SP(0.02), m: mk4(0, 0.225, 0), col: skin}, {geo: BX(0.008, 0.1, 0.008), m: mk4(0.03, 0.2, 0), col: steel}])};
  const art = {tint: mergeParts([{geo: BX(0.07, 0.03, 0.09), m: mk4(0, 0.055, -0.02)}, {geo: CY(0.022, 0.07, 6), m: mk4(0.07, 0.035, -0.04)}]), fixed: mergeParts([{geo: CY(0.04, 0.012, 8), m: mk4(0.05, 0.04, 0, 0, 0, Math.PI / 2), col: brown}, {geo: CY(0.04, 0.012, 8), m: mk4(-0.05, 0.04, 0, 0, 0, Math.PI / 2), col: brown}, {geo: CY(0.013, 0.16, 6), m: mk4(0, 0.075, 0.07, Math.PI / 2.4, 0, 0), col: steel}, {geo: SP(0.02), m: mk4(0.07, 0.085, -0.04), col: skin}])};
  R.figs = {};
  ['inf', 'cav', 'art'].forEach(k => {
    const d = {inf, cav, art}[k];
    const tint = new THREE.InstancedMesh(d.tint, new THREE.MeshLambertMaterial({color: 0xffffff}), FIG_CAP), fixed = new THREE.InstancedMesh(d.fixed, new THREE.MeshLambertMaterial({vertexColors: true}), FIG_CAP);
    tint.count = fixed.count = 0; tint.frustumCulled = fixed.frustumCulled = false; R.scene.add(tint); R.scene.add(fixed); R.figs[k] = {tint, fixed};
  });
}
function updateArmyMeshes(t) {
  if (!G.armies || !MAP.provs) return;
  if (!R.figs) { try { buildFigures(); } catch (e) { console.warn(e); R.figs = null; R.figsOff = true; return; } }
  const show = R.cam.dist < 62 && R.showFigs !== false; R.figsShown = show;
  const n = {inf: 0, cav: 0, art: 0}, m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), sc = new THREE.Vector3(1, 1, 1), c = new THREE.Color(), up = new THREE.Vector3(0, 1, 0);
  if (show) {
    const cw = R.canvas.clientWidth, ch = R.canvas.clientHeight, perProv = {};
    G.armies.forEach(a => {
      const pv = MAP.provs[a.loc]; let lon = pv.lon, lat = pv.lat, fdir = 0;
      if (a.path.length && a.hopMax > 0 && !a.battle) { const nx = MAP.provs[a.path[0]], f = clamp(1 - a.hop / a.hopMax, 0, 1); lon += (nx.lon - lon) * f; lat += (nx.lat - lat) * f; fdir = Math.atan2(nx.lon - pv.lon, -(nx.lat - pv.lat)); }
      else if (a.battle) { const b = G.battles.find(x => x.id === a.battle); fdir = b && b.A.includes(a.id) ? Math.PI / 2 : -Math.PI / 2; }
      const sp = worldToScreen(lon, 0.3, -lat); if (sp[0] < -60 || sp[0] > cw + 60 || sp[1] < -60 || sp[1] > ch + 60) return;
      const k = (perProv[a.loc] = (perProv[a.loc] || 0) + 1) - 1;
      const baseX = lon + (k % 2 ? 0.32 : -0.32) * (k ? 1 : 0), baseZ = -lat + Math.floor((k + 1) / 2) * 0.28 * (k % 2 ? 1 : -1);
      const hy = MAP.height[Math.min(MAP.height.length - 1, Math.max(0, Math.round(latToY(lat)) * MAP_W + Math.round(lonToX(lon))))] * R.exag + 0.02;
      const col = R.occRGB(a.tag); c.setRGB(col[0] / 255, col[1] / 255, col[2] / 255);
      const moving = a.path.length && !a.battle;
      a.divs.slice(0, 9).forEach((d, i) => {
        const type = d.t, row = Math.floor(i / 3), cl = i % 3, per = type === 'inf' ? 3 : type === 'cav' ? 2 : 1;
        for (let f = 0; f < per; f++) {
          if (n[type] >= FIG_CAP) return;
          const ox = ((cl - 1) * 0.2 + (f - (per - 1) / 2) * 0.075 * (type === 'art' ? 0 : 1)) * FS, oz = row * 0.17 * FS;
          const cs = Math.cos(fdir), sn = Math.sin(fdir);
          const bob = moving ? Math.abs(Math.sin(t / 130 + i * 1.7 + f)) * 0.018 : (a.battle ? Math.sin(t / 90 + i + f * 2) * 0.008 : 0);
          p.set(baseX + ox * cs - oz * sn, hy + bob, baseZ + ox * sn + oz * cs); q.setFromAxisAngle(up, -fdir); sc.set(FS, FS, FS); m4.compose(p, q, sc);
          const fg = R.figs[type], idx = n[type]++;
          fg.tint.setMatrixAt(idx, m4); fg.fixed.setMatrixAt(idx, m4); fg.tint.setColorAt(idx, c);
        }
      });
    });
  }
  ['inf', 'cav', 'art'].forEach(k => { const f = R.figs[k]; f.tint.count = f.fixed.count = n[k]; f.tint.instanceMatrix.needsUpdate = f.fixed.instanceMatrix.needsUpdate = true; if (f.tint.instanceColor) f.tint.instanceColor.needsUpdate = true; });
  R.dirty = true;
}
