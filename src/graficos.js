/* ===== GRÁFICOS DEL MAPA 3D =====
   · Estaciones: nieve que avanza en invierno desde las latitudes altas y las montañas, tonos de primavera/otoño y sol más bajo en invierno.
   · Agua: espuma animada en las costas (máscara calculada desde la distancia a tierra), destellos y oleaje.
   · Industria: chimeneas en los estados industrializados (crecen con la industria) que echan humo.
   · Guerra: aviones en círculo sobre las regiones aéreas con escuadrones y fuego en los estados bombardeados.
   · Sombras suaves del relieve y las figuras en calidad Alta. */
const SEASON_NAMES = ['invierno', 'primavera', 'verano', 'otoño'];
// fase del año: 0 = pleno invierno (enero), 0.5 = pleno verano
function yearPhase() { const doy = G.date.m * 30.4 + G.date.d; return 0.5 - 0.5 * Math.cos((doy - 15) / 365 * 6.2832); }
function seasonState() {
  const ph = yearPhase(), winter = 1 - ph, doy = G.date.m * 30.4 + G.date.d;
  const autumn = clamp(1 - Math.abs(doy - 290) / 55, 0, 1), spring = clamp(1 - Math.abs(doy - 110) / 55, 0, 1);
  return {winter, snow: clamp((winter - 0.35) / 0.65, 0, 1), tint: [1 + autumn * 0.09 - winter * 0.05 + spring * -0.01, 1 - autumn * 0.02 + spring * 0.05 + (1 - winter) * 0.0 - winter * 0.01, 1 - autumn * 0.14 + winter * 0.07 - spring * 0.03], sunY: 70 + ph * 40, sunI: 0.62 + ph * 0.22};
}
function updateSeason() {
  if (!R.detailU || !R.detailU.snowK) return; const s = seasonState();
  const q = Math.round(s.snow * 50) + '|' + G.date.m; if (R._seasonKey === q) return; R._seasonKey = q;
  R.detailU.snowK.value = s.snow * (R.mode === 'terrain' ? 1 : 0.6); R.detailU.seasonTint.value.set(s.tint[0], s.tint[1], s.tint[2]);
  if (R.sun) { R.sun.position.y = s.sunY; R.sun.intensity = s.sunI; R.sun.color.setRGB(1, 0.94 - s.winter * 0.05, 0.84 + (1 - s.winter) * 0.06); }
  R.dirty = true;
}

/* ---------- agua: espuma de costa y destellos ---------- */
function buildFoamTexture() {
  const W = 1024, H = 410, cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d'), im = g.createImageData(W, H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = Math.floor(y * MAP_H / H) * MAP_W + Math.floor(x * MAP_W / W); const d = MAP.land[i] ? 0 : MAP.dSea[i]; const o = (y * W + x) * 4; const v = Math.min(255, d * 26); im.data[o] = v; im.data[o + 1] = v; im.data[o + 2] = v; im.data[o + 3] = 255; }
  g.putImageData(im, 0, 0); const t = new THREE.CanvasTexture(cv); t.minFilter = THREE.LinearFilter; t.magFilter = THREE.LinearFilter; t.generateMipmaps = false; return t;
}
function upgradeWater() {
  if (!R.waterMesh || R._waterUp) return; R._waterUp = true;
  const foam = buildFoamTexture(), w = 360, d = LAT_TOP - LAT_BOT;
  R.waterU.foam = {value: foam}; R.waterU.ext = {value: new THREE.Vector2(w, d)};
  const wm = new THREE.ShaderMaterial({
    uniforms: R.waterU, transparent: true, depthWrite: false,
    vertexShader: 'varying vec2 vP; varying vec2 vUv; void main(){ vP = position.xz; vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform float t; uniform sampler2D foam; varying vec2 vP; varying vec2 vUv; void main(){ ' +
      'float a = sin(vP.x*1.7 + t*0.9 + sin(vP.y*0.8 + t*0.4)*1.6) * sin(vP.y*2.1 - t*0.7 + sin(vP.x*0.6 - t*0.3)*1.3); float s = smoothstep(0.62, 1.0, a);' +
      'float d = texture2D(foam, vec2(vUv.x, vUv.y)).r * 9.8;' +               // distancia a la costa en píxeles del mapa
      'float sea = step(0.01, d);' +
      'float wave = sin(d*2.4 - t*1.5 + sin(vP.x*3.0+t*0.5)*0.9);' +
      'float band = (1.0 - smoothstep(0.0, 3.4, d)) * (0.5 + 0.5*wave);' +
      'float edge = (1.0 - smoothstep(0.0, 1.1, d + 0.3*sin(vP.x*9.0 + t*1.2)));' +
      'float fo = clamp(band*0.5 + edge*0.55, 0.0, 1.0) * sea;' +
      'float glint = smoothstep(0.93, 1.0, sin(vP.x*5.3 + t*1.9) * sin(vP.y*4.7 - t*1.4)) * 0.18 * sea;' +
      'vec3 col = mix(vec3(0.75,0.9,1.0), vec3(1.0), fo); float al = s*0.2*sea + fo*0.5 + glint + (sin(vP.x*0.35 + t*0.15)*0.5+0.5)*0.03*sea; gl_FragColor = vec4(col, clamp(al, 0.0, 0.85)); }'
  });
  R.waterMesh.material.dispose(); R.waterMesh.material = wm;
}

/* ---------- chimeneas con humo en los estados industrializados ---------- */
function industryLevels(s) { let n = 0; BUILDINGS.forEach(b => { if (b.grp === 'Industria' || b.grp === 'Industria militar') n += s.b[b.id] || 0; }); return n; }
function buildChimneys() {
  if (!R.cityItems) return; const items = [];
  G.S.forEach(s => { const lv = industryLevels(s); const n = clamp(Math.round(lv / 7), 0, 6); if (!n) return; const prov = MAP.provs[stateCapitalProv(s.id)];
    for (let k = 0; k < n; k++) { const a = hash2(s.id, k, 31) * 6.283, r = 0.35 + hash2(s.id, k, 33) * 0.9; const lon = xToLon(prov.px) + Math.cos(a) * r, lat = yToLat(prov.py) + Math.sin(a) * r * 0.7; const px = Math.round(lonToX(lon)), py = Math.round(latToY(lat)); if (px < 0 || py < 0 || px >= MAP_W || py >= MAP_H || !MAP.land[py * MAP_W + px]) continue; items.push({x: lon, z: -lat, y: MAP.height[py * MAP_W + px] * R.exag, h: 0.16 + hash2(s.id, k, 35) * 0.12, sid: s.id}); } });
  R.chimItems = items;
  if (!R.chimMesh) { const g = mergeParts([{geo: CY(0.014, 0.2, 7).translate(0, 0.1, 0), m: new THREE.Matrix4(), col: 0x8a4a38}, {geo: CY(0.017, 0.02, 7), m: mk4(0, 0.205, 0), col: 0x2a2a2e}, {geo: BX(0.07, 0.05, 0.06), m: mk4(0.05, 0.025, 0), col: 0x6a5a4a}]);
    R.chimMesh = new THREE.InstancedMesh(g, new THREE.MeshLambertMaterial({vertexColors: true}), 700); R.chimMesh.frustumCulled = false; R.scene.add(R.chimMesh); }
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), sc = new THREE.Vector3();
  items.slice(0, 700).forEach((c, i) => { p.set(c.x, c.y, c.z); sc.set(1, c.h / 0.2, 1); m4.compose(p, q, sc); R.chimMesh.setMatrixAt(i, m4); }); R.chimMesh.count = Math.min(700, items.length); R.chimMesh.instanceMatrix.needsUpdate = true; R.dirty = true;
}
// humo: se emite desde algunas chimeneas cercanas a la cámara (se llama desde updateSmoke)
function chimneySmoke() {
  if (!R.chimItems || !R.chimItems.length || !R.puffs || R.cam.dist > 55) return false; let any = false;
  const cx = R.cam.tx, cz = R.cam.tz, r = Math.max(10, R.cam.dist * 0.7);
  for (let n = 0; n < 4; n++) { const c = R.chimItems[Math.floor(Math.random() * R.chimItems.length)]; if (Math.abs(c.x - cx) > r || Math.abs(c.z - cz) > r * 0.8) continue;
    const pf = R.puffs.find(p => !p.alive && !p.fire); if (!pf) break; pf.alive = true; pf.age = 0; pf.life = 2.2 + Math.random() * 1.2; pf.x = c.x; pf.z = c.z; pf.y = c.y + c.h; pf.sp.visible = true; pf.small = true; any = true; }
  return any;
}

/* ---------- aviones sobre las regiones aéreas y fuego en estados bombardeados ---------- */
function buildPlanes() {
  if (R.planeMesh) return;
  const g = mergeParts([{geo: BX(0.09, 0.012, 0.012), m: new THREE.Matrix4(), col: 0xdad6c8}, {geo: BX(0.016, 0.004, 0.12), m: mk4(0.005, 0, 0), col: 0xcfc9b6}, {geo: BX(0.012, 0.03, 0.004), m: mk4(-0.04, 0.012, 0), col: 0xdad6c8}, {geo: BX(0.008, 0.004, 0.05), m: mk4(-0.04, 0.005, 0), col: 0xcfc9b6}]);
  R.planeMesh = new THREE.InstancedMesh(g, new THREE.MeshLambertMaterial({vertexColors: true}), 120); R.planeMesh.count = 0; R.planeMesh.frustumCulled = false; R.scene.add(R.planeMesh);
}
function updatePlanes(t) {
  if (!G.mx || !G.mx.sq) return; if (!R.planeMesh) { try { buildPlanes(); } catch (e) { R.planeMesh = null; return; } }
  const show = R.cam.dist < 130, m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), sc = new THREE.Vector3(3.2, 3.2, 3.2), up = new THREE.Vector3(0, 1, 0); let n = 0;
  if (show) { const myRegs = new Set(); G.mx.sq.forEach(s => { if (s.tag === G.player) myRegs.add(s.reg); }); G.C[G.player].states.forEach(sid => myRegs.add(airRegOf(sid)));
    G.mx.sq.forEach(s => { if (s.n <= 0 || n >= 118) return; const mine = s.tag === G.player || sameSide(G.player, s.tag); if (!mine && !myRegs.has(s.reg)) return; const reg = airReg(s.reg); const k = Math.min(4, 1 + Math.floor(s.n / 35));
      for (let i = 0; i < k && n < 118; i++) { const an = t / (1500 + (s.id % 5) * 300) + i * 6.283 / k + s.id, R0 = 1.4 + (s.id % 3) * 0.6 + i * 0.2; p.set(reg.lon + Math.cos(an) * R0 * 1.6, 1.3 + Math.sin(t / 900 + i) * 0.06, -reg.lat + Math.sin(an) * R0); q.setFromAxisAngle(up, -an - Math.PI / 2); m4.compose(p, q, sc); R.planeMesh.setMatrixAt(n++, m4); } }); }
  R.planeMesh.count = n; R.planeMesh.instanceMatrix.needsUpdate = true; if (n) R.dirty = true;
}
function bombFire() {
  if (!R.puffs || R.cam.dist > 90) return false; let any = false;
  G.S.forEach(s => { if (!s.bomb || s.bomb < 0.06 || Math.random() > 0.25) return; const prov = MAP.provs[stateCapitalProv(s.id)]; if (Math.abs(prov.lon - R.cam.tx) > R.cam.dist || Math.abs(prov.lat + R.cam.tz) > R.cam.dist * 0.8) return;
    const fire = Math.random() < 0.4, pf = R.puffs.find(p => !p.alive && p.fire === fire); if (!pf) return; pf.alive = true; pf.age = 0; pf.life = fire ? 0.6 : 2.6; pf.x = prov.lon + (Math.random() - 0.5) * 0.8; pf.z = -prov.lat + (Math.random() - 0.5) * 0.6; pf.y = MAP.height[prov.py * MAP_W + prov.px] * R.exag + 0.1; pf.sp.visible = true; any = true; });
  return any;
}

/* ---------- sombras suaves (calidad Alta) ---------- */
function applyShadows() {
  const on = R.quality === 'alto'; if (R._shadowOn === on || !R.sun) return; R._shadowOn = on;
  R.renderer.shadowMap.enabled = on; R.renderer.shadowMap.type = THREE.PCFSoftShadowMap; R.sun.castShadow = on;
  if (on) { R.sun.shadow.mapSize.set(2048, 2048); R.sun.shadow.bias = -0.0006; R.sun.shadow.normalBias = 0.02; }
  (R.chunks || []).forEach(c => { /* las mallas se marcan al crearlas */ }); R.mesh.children.forEach(m => { m.castShadow = on; m.receiveShadow = on; m.material.needsUpdate = true; });
  [R.figs && R.figs.inf, R.figs && R.figs.cav, R.figs && R.figs.art].forEach(f => { if (f) { f.tint.castShadow = f.fixed.castShadow = on; } });
  R.dirty = true;
}
function updateShadowFrustum() {
  if (!R.sun || !R._shadowOn) return; const d = clamp(R.cam.dist * 0.55, 14, 90), sh = R.sun.shadow.camera;
  R.sun.target.position.set(R.cam.tx, 0, R.cam.tz); R.sun.target.updateMatrixWorld(); R.sun.position.set(R.cam.tx - 50, R.sun.position.y > 30 ? R.sun.position.y : 70, R.cam.tz - 30);
  if (sh.right !== d) { sh.left = -d; sh.right = d; sh.top = d; sh.bottom = -d; sh.near = 1; sh.far = 300; sh.updateProjectionMatrix(); }
}
// llamado cada cierto tiempo desde el bucle de dibujado
function graphicsTick(t) {
  if (!R.scene || !R.mesh) return;
  if (!R._gInit) { R._gInit = true; try { upgradeWater(); } catch (e) { console.warn('agua', e); } R.sun = R.scene.children.find(o => o.isDirectionalLight); }
  if (!R._chimDone && R.cityItems) { R._chimDone = true; try { buildChimneys(); } catch (e) { console.warn('chimeneas', e); } }
  if (G.date.m !== R._chimMonth && R.cityItems) { R._chimMonth = G.date.m; try { buildChimneys(); } catch (e) {} }
  updateSeason(); applyShadows(); updateShadowFrustum();
}
