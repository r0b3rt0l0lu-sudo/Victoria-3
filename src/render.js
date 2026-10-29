/* ===== RENDER 3D DEL MAPA (three.js) ===== */
const R = {occ: {}, mode: 'political', hover: -1, sel: -1, dirty: true, labelsDirty: true, cam: {tx: 12, tz: -52, dist: 120, tilt: 0.78, yaw: 0}, exag: 0.55};
const MAP_MODES = [
  {id: 'political', name: 'Político', icon: '🏴'},
  {id: 'terrain', name: 'Terreno', icon: '⛰️'},
  {id: 'population', name: 'Población', icon: '👥'},
  {id: 'sol', name: 'Nivel de vida', icon: '💰'},
  {id: 'literacy', name: 'Alfabetización', icon: '📖'},
  {id: 'prosperity', name: 'Prosperidad', icon: '📈'},
  {id: 'radicals', name: 'Malestar', icon: '🔥'},
  {id: 'diplomacy', name: 'Relaciones', icon: '🤝'},
  {id: 'blocs', name: 'Bloques y alianzas', icon: '🏳️'}
];

function hex2rgb(h) { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
function ramp(stops, t) {
  t = clamp(t, 0, 1) * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(t)), f = t - i, a = stops[i], b = stops[i + 1];
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
}
const RAMP_HEAT = [[236, 226, 160], [226, 168, 84], [196, 96, 60], [120, 36, 36]];
const RAMP_SOL = [[168, 52, 52], [214, 150, 66], [220, 208, 90], [100, 168, 82], [52, 130, 100]];
const RAMP_BLUE = [[190, 206, 220], [102, 150, 196], [48, 98, 160], [24, 48, 110]];
const RAMP_RAD = [[120, 168, 96], [220, 208, 90], [208, 110, 60], [150, 30, 30]];

function stateFill(s) {
  // devuelve [r, g, b, alpha]
  const c = G.C[s.owner];
  switch (R.mode) {
    case 'political': { if (s.owner === NONE) return [...hex2rgb(NEUTRAL_COLOR), 0.28]; return [...(c._rgb || (c._rgb = hex2rgb(c.color))), 0.72]; }
    case 'terrain': return [0, 0, 0, 0];
    case 'population': { const d = s.popBase * 1000 / Math.max(1, MAP.stats[s.id].area * Math.cos(yToLat(MAP.stats[s.id].sy / Math.max(1, MAP.stats[s.id].area)) * Math.PI / 180)); return [...ramp(RAMP_HEAT, Math.sqrt(d / 380)), 0.85]; }
    case 'sol': return [...ramp(RAMP_SOL, s.solAvg / 20), 0.82];
    case 'literacy': { const l = c.lit * (0.7 + 0.6 * clamp(G.C[s.owner].ind * 2, 0, 1)) ; return [...ramp(RAMP_BLUE, l / 90), 0.8]; }
    case 'prosperity': { const g = s.gdp / Math.max(1, popTotal(s)); return [...ramp(RAMP_BLUE, (g - 0.6) / 2.2), 0.82]; }
    case 'radicals': return [...ramp(RAMP_RAD, c.radicals / 0.4), s.owner === NONE ? 0.2 : 0.82];
    case 'blocs': {
      if (s.owner === NONE) return [...hex2rgb(NEUTRAL_COLOR), 0.18];
      const b = blocOf(s.owner);
      if (b) return [...(b._rgb || (b._rgb = hex2rgb(b.color))), 0.86];
      return [150, 150, 150, 0.35];
    }
    case 'diplomacy': {
      const me = G.C[G.player];
      if (s.owner === G.player) return [90, 140, 200, 0.85];
      if (s.owner === NONE) return [...hex2rgb(NEUTRAL_COLOR), 0.2];
      if (me.overlord === s.owner || G.C[s.owner].overlord === G.player) return [150, 90, 200, 0.85];
      if (pactBetween('alliance', G.player, s.owner)) return [60, 130, 220, 0.9];
      if (pactBetween('guarantee', G.player, s.owner) || pactBetween('guarantee', s.owner, G.player)) return [60, 190, 200, 0.85];
      if (pactBetween('embargo', G.player, s.owner) || pactBetween('embargo', s.owner, G.player)) return [140, 60, 140, 0.85];
      if (pactBetween('rival', G.player, s.owner)) return [230, 120, 40, 0.85];
      const rel = me.relations[s.owner] ?? 0;
      const war = G.wars.some(w => (w.att === G.player && w.def === s.owner) || (w.def === G.player && w.att === s.owner));
      if (war) return [190, 40, 40, 0.9];
      return [...ramp([[190, 70, 60], [200, 190, 120], [90, 170, 100]], (rel + 60) / 160), 0.8];
    }
  }
  return [0, 0, 0, 0];
}

function initRenderer(canvas) {
  const W = MAP_W, H = MAP_H;
  R.canvas = canvas;
  R.renderer = new THREE.WebGLRenderer({canvas, antialias: true, preserveDrawingBuffer: true});
  R.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  R.scene = new THREE.Scene();
  R.scene.background = new THREE.Color(0x14222c);
  R.camera = new THREE.PerspectiveCamera(32, 1, 0.5, 900);
  // textura compuesta
  R.cv = document.createElement('canvas'); R.cv.width = W; R.cv.height = H;
  R.ctx = R.cv.getContext('2d');
  R.img = R.ctx.createImageData(W, H);
  R.tex = new THREE.CanvasTexture(R.cv);
  R.tex.anisotropy = Math.min(8, R.renderer.capabilities.getMaxAnisotropy());
  R.tex.colorSpace = THREE.SRGBColorSpace || undefined;
  R.tex.generateMipmaps = true;
  R.tex.minFilter = THREE.LinearMipmapLinearFilter;
  R.tex.magFilter = THREE.LinearFilter;
  // geometría con relieve
  const nx = 720, nz = 288;
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array((nx + 1) * (nz + 1) * 3), uv = new Float32Array((nx + 1) * (nz + 1) * 2);
  const hgt = MAP.height;
  const hs = (px, py) => {
    px = clamp(px, 0, W - 1.001); py = clamp(py, 0, H - 1.001);
    const x0 = px | 0, y0 = py | 0, fx = px - x0, fy = py - y0, i = y0 * W + x0;
    return (hgt[i] * (1 - fx) + hgt[i + 1] * fx) * (1 - fy) + (hgt[i + W] * (1 - fx) + hgt[i + W + 1] * fx) * fy;
  };
  let k = 0, u = 0;
  for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) {
    const fx = i / nx, fy = j / nz;
    const lon = -180 + fx * 360, lat = LAT_TOP - fy * (LAT_TOP - LAT_BOT);
    const h = hs(fx * (W - 1), fy * (H - 1));
    pos[k++] = lon; pos[k++] = (h > 0 ? h * R.exag : h * 0.35); pos[k++] = -lat;
    uv[u++] = fx; uv[u++] = 1 - fy;
  }
  const idx = new Uint32Array(nx * nz * 6); let q = 0;
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const a = j * (nx + 1) + i, b = a + 1, c = a + nx + 1, d = c + 1;
    idx[q++] = a; idx[q++] = c; idx[q++] = b; idx[q++] = b; idx[q++] = c; idx[q++] = d;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  geo.computeVertexNormals();
  // textura de detalle que se repite: oculta el aspecto pixelado al acercar la cámara
  const dc = document.createElement('canvas'); dc.width = dc.height = 128; const dg = dc.getContext('2d'), di = dg.createImageData(128, 128);
  for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) { const v = 0.5 * hash2(x, y, 41) + 0.5 * vnoise(x / 6, y / 6, 43); const o = (y * 128 + x) * 4; di.data[o] = di.data[o + 1] = di.data[o + 2] = v * 255; di.data[o + 3] = 255; }
  dg.putImageData(di, 0, 0); R.detail = new THREE.CanvasTexture(dc); R.detail.wrapS = R.detail.wrapT = THREE.RepeatWrapping;
  const mat = new THREE.MeshLambertMaterial({map: R.tex});
  mat.onBeforeCompile = sh => {
    sh.uniforms.detailMap = {value: R.detail}; R.detailU = sh.uniforms;
    sh.uniforms.detailK = {value: 1}; 
    sh.fragmentShader = sh.fragmentShader.replace('#include <map_pars_fragment>', '#include <map_pars_fragment>\nuniform sampler2D detailMap; uniform float detailK;')
      .replace('#include <map_fragment>', '#include <map_fragment>\n float dt = texture2D(detailMap, vMapUv * vec2(130.0, 52.0)).r; float dt2 = texture2D(detailMap, vMapUv * vec2(21.0, 8.4)).r; diffuseColor.rgb *= 1.0 + detailK * ((dt - 0.5) * 0.28 + (dt2 - 0.5) * 0.18);');
  };
  R.mesh = new THREE.Mesh(geo, mat);
  R.scene.add(R.mesh);
  R.scene.add(new THREE.AmbientLight(0xffffff, 0.8));
  const dl = new THREE.DirectionalLight(0xfff0d8, 0.78); dl.position.set(-60, 90, -40); R.scene.add(dl);
  R.scene.fog = new THREE.Fog(0x14222c, 170, 560);
  buildWaterAndClouds();
  // marco alrededor del mapa
  const frame = new THREE.Mesh(new THREE.PlaneGeometry(2000, 1200), new THREE.MeshBasicMaterial({color: 0x101a22}));
  frame.rotation.x = -Math.PI / 2; frame.position.y = -2; R.scene.add(frame);
  R.raycaster = new THREE.Raycaster();
  R.plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.2);
  R.labelRoot = document.getElementById('labels');
  R.markerRoot = document.getElementById('markers');
  setupControls();
  resizeRenderer();
  window.addEventListener('resize', resizeRenderer);
  fullRepaint(); initBorderOverlay();
  requestAnimationFrame(frame_);
}

/* ---------- agua animada, nubes, ciudades ---------- */
function buildWaterAndClouds() {
  const w = 360, d = LAT_TOP - LAT_BOT;
  R.waterU = {t: {value: 0}};
  const wm = new THREE.ShaderMaterial({
    uniforms: R.waterU, transparent: true, depthWrite: false,
    vertexShader: 'varying vec2 vP; void main(){ vP = position.xz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform float t; varying vec2 vP; void main(){ float a = sin(vP.x*1.7 + t*0.9 + sin(vP.y*0.8 + t*0.4)*1.6) * sin(vP.y*2.1 - t*0.7 + sin(vP.x*0.6 - t*0.3)*1.3); float s = smoothstep(0.55, 1.0, a); float g = sin(vP.x*0.35 + t*0.15)*0.5+0.5; gl_FragColor = vec4(0.75,0.9,1.0, s*0.22 + g*0.04); }'
  });
  const wp = new THREE.Mesh(new THREE.PlaneGeometry(w, d), wm); wp.rotation.x = -Math.PI / 2; wp.position.set(0, 0.012, -(LAT_TOP + LAT_BOT) / 2); wp.renderOrder = 1; R.scene.add(wp); R.waterMesh = wp;
  // nubes: textura procedural
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 256; const g = cv.getContext('2d'), im = g.createImageData(512, 256);
  for (let y = 0; y < 256; y++) for (let x = 0; x < 512; x++) { const v = fbm(x / 60, y / 40, 313, 5); const a = clamp((v - 0.52) * 4.2, 0, 1); const o = (y * 512 + x) * 4; im.data[o] = 245; im.data[o + 1] = 248; im.data[o + 2] = 252; im.data[o + 3] = a * 255; }
  g.putImageData(im, 0, 0);
  const ct = new THREE.CanvasTexture(cv); ct.wrapS = ct.wrapT = THREE.RepeatWrapping; ct.repeat.set(2.4, 1.2);
  const cm = new THREE.MeshBasicMaterial({map: ct, transparent: true, opacity: 0.4, depthWrite: false, fog: false});
  const cp = new THREE.Mesh(new THREE.PlaneGeometry(w, d), cm); cp.rotation.x = -Math.PI / 2; cp.position.set(0, 3.2, -(LAT_TOP + LAT_BOT) / 2); cp.renderOrder = 2; R.scene.add(cp); R.cloudMesh = cp; R.cloudTex = ct;
  R.anim = true;
}
function animateMap(t) {
  if (!R.anim || !R.waterU) return false;
  R.waterU.t.value = t / 1000; R.cloudTex.offset.x = (t / 1000) * 0.0016; R.cloudTex.offset.y = (t / 1000) * 0.0004;
  const k = clamp((R.cam.dist - 45) / 70, 0, 1); R.cloudMesh.material.opacity = 0.42 * k; R.cloudMesh.visible = k > 0.02;
  return true;
}
function resizeRenderer() {
  const w = window.innerWidth, h = window.innerHeight;
  R.renderer.setSize(w, h, false);
  R.camera.aspect = w / h; R.camera.updateProjectionMatrix();
  R.dirty = true; R.labelsDirty = true;
}

function updateCamera() {
  const c = R.cam;
  c.dist = clamp(c.dist, 6, 420);
  c.tilt = clamp(c.tilt, 0.08, 1.3);
  const lim = 360 / 2 - 8;
  c.tx = clamp(c.tx, -lim, lim); c.tz = clamp(c.tz, -88, 66);
  const ct = Math.cos(c.tilt), st = Math.sin(c.tilt);
  R.camera.position.set(c.tx + Math.sin(c.yaw) * st * c.dist, ct * c.dist, c.tz + Math.cos(c.yaw) * st * c.dist);
  R.camera.lookAt(c.tx, 0, c.tz);
  R.camera.updateMatrixWorld();
}

function screenToWorld(cx, cy) {
  const r = R.canvas.getBoundingClientRect();
  const ndc = new THREE.Vector2(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
  R.raycaster.setFromCamera(ndc, R.camera);
  const p = new THREE.Vector3();
  return R.raycaster.ray.intersectPlane(R.plane, p) ? p : null;
}
function worldToScreen(x, y, z) {
  const v = new THREE.Vector3(x, y, z).project(R.camera);
  return [(v.x * 0.5 + 0.5) * R.canvas.clientWidth, (-v.y * 0.5 + 0.5) * R.canvas.clientHeight, v.z];
}
function stateAtWorld(p) {
  if (!p) return -1;
  const px = Math.floor(lonToX(p.x)), py = Math.floor(latToY(-p.z));
  if (px < 0 || py < 0 || px >= MAP_W || py >= MAP_H) return -1;
  const i = py * MAP_W + px;
  return MAP.land[i] ? MAP.stateOf[i] : -1;
}

function camChanged() { updateCamera(); R.dirty = true; R.labelsDirty = true; }
function zoomAt(cx, cy, factor) {
  const before = cx === undefined ? null : screenToWorld(cx, cy);
  R.cam.dist *= factor; updateCamera();
  if (before) { const after = screenToWorld(cx, cy); if (after) { R.cam.tx += before.x - after.x; R.cam.tz += before.z - after.z; } }
  camChanged();
}
function camZoom(f) { zoomAt(R.canvas.clientWidth / 2, R.canvas.clientHeight / 2, f); }
function camHome() { R.cam.tx = 12; R.cam.tz = -52; R.cam.dist = 130; R.cam.tilt = 0.78; R.cam.yaw = 0; camChanged(); }
function camRotate(d) { R.cam.yaw += d; camChanged(); }
function camTilt(d) { R.cam.tilt += d; camChanged(); }
function loadMapPrefs() { try { const p = JSON.parse(localStorage.getItem('victoria-map-prefs') || '{}'); R.wheelMode = p.wheelMode || 'zoom'; R.edgeScroll = !!p.edgeScroll; } catch (e) { R.wheelMode = 'zoom'; R.edgeScroll = false; } }
function saveMapPrefs() { try { localStorage.setItem('victoria-map-prefs', JSON.stringify({wheelMode: R.wheelMode, edgeScroll: R.edgeScroll})); } catch (e) {} }

function setupControls() {
  const cv = R.canvas; const pts = new Map(); let drag = null, pinch = null;
  loadMapPrefs();
  cv.style.touchAction = 'none';
  cv.addEventListener('contextmenu', e => e.preventDefault());
  const mid = () => { const a = [...pts.values()]; return {x: (a[0].x + a[1].x) / 2, y: (a[0].y + a[1].y) / 2, d: Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y)}; };
  cv.addEventListener('pointerdown', e => {
    try { cv.setPointerCapture(e.pointerId); } catch (_) {}
    pts.set(e.pointerId, {x: e.clientX, y: e.clientY});
    if (pts.size === 1) drag = {x: e.clientX, y: e.clientY, btn: e.button, moved: false, world: screenToWorld(e.clientX, e.clientY), yaw: R.cam.yaw, tilt: R.cam.tilt, touch: e.pointerType !== 'mouse'};
    else if (pts.size === 2) { drag = null; pinch = mid(); }
    R.hasFocusCanvas = true;
  });
  cv.addEventListener('pointermove', e => {
    R.mouse = {x: e.clientX, y: e.clientY};
    if (pts.has(e.pointerId)) pts.set(e.pointerId, {x: e.clientX, y: e.clientY});
    if (pinch && pts.size >= 2) {
      const m = mid();
      const before = screenToWorld(pinch.x, pinch.y);
      R.cam.dist *= pinch.d / Math.max(10, m.d); updateCamera();
      const after = screenToWorld(pinch.x, pinch.y);
      if (before && after) { R.cam.tx += before.x - after.x; R.cam.tz += before.z - after.z; }
      const w1 = screenToWorld(pinch.x, pinch.y), w2 = screenToWorld(m.x, m.y);
      if (w1 && w2) { R.cam.tx += w1.x - w2.x; R.cam.tz += w1.z - w2.z; }
      pinch = m; camChanged(); return;
    }
    if (drag) {
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (Math.abs(dx) + Math.abs(dy) > (drag.touch ? 10 : 4)) drag.moved = true;
      if (drag.moved) {
        if (drag.btn === 2 || e.shiftKey) { R.cam.yaw = drag.yaw - dx * 0.005; R.cam.tilt = drag.tilt + dy * 0.004; camChanged(); }
        else if (drag.world) { const cur = screenToWorld(e.clientX, e.clientY); if (cur) { R.cam.tx += drag.world.x - cur.x; R.cam.tz += drag.world.z - cur.z; camChanged(); } }
        document.body.classList.add('dragging'); hideTipSafe();
        return;
      }
    }
    if (e.pointerType === 'mouse' && !drag) {
      const id = stateAtWorld(screenToWorld(e.clientX, e.clientY));
      setHover(id);
      if (window.onMapHover) window.onMapHover(id, e);
    }
  });
  const end = e => {
    pts.delete(e.pointerId); if (pts.size < 2) pinch = null;
    if (drag && !drag.moved && drag.btn === 0 && e.type === 'pointerup') {
      const wp = screenToWorld(e.clientX, e.clientY), id = stateAtWorld(wp);
      if (window.onMapClick) window.onMapClick(id, e, provAtWorld(wp));
    }
    if (drag && !drag.moved && drag.btn === 2 && e.type === 'pointerup') {
      const wp = screenToWorld(e.clientX, e.clientY), id = stateAtWorld(wp);
      if (window.onMapRightClick) window.onMapRightClick(id, e, provAtWorld(wp));
    }
    if (pts.size === 0) { drag = null; document.body.classList.remove('dragging'); }
  };
  cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
  cv.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse' && !drag) { setHover(-1); if (window.onMapHover) window.onMapHover(-1, e); } R.mouse = null; });
  cv.addEventListener('dblclick', e => zoomAt(e.clientX, e.clientY, e.shiftKey ? 1.7 : 0.55));
  cv.addEventListener('wheel', e => {
    e.preventDefault();
    let dy = e.deltaY, dx = e.deltaX;
    if (e.deltaMode === 1) { dy *= 16; dx *= 16; } else if (e.deltaMode === 2) { dy *= 400; dx *= 400; }
    if (e.ctrlKey) { zoomAt(e.clientX, e.clientY, Math.exp(dy * 0.012)); return; }   // pellizco del panel táctil
    if (R.wheelMode === 'pan') {
      const k = R.cam.dist * 0.0016; const cy = Math.cos(R.cam.yaw), sy = Math.sin(R.cam.yaw);
      R.cam.tx += (dx * cy + dy * sy) * k; R.cam.tz += (-dx * sy + dy * cy) * k; camChanged();
    } else zoomAt(e.clientX, e.clientY, Math.exp(clamp(dy, -240, 240) * 0.0016));
  }, {passive: false});
  const keys = {};
  window.addEventListener('keydown', e => { if (/input|textarea|select/i.test(e.target.tagName)) return; keys[e.key.toLowerCase()] = true; });
  window.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });
  window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
  R.keys = keys;
}
function hideTipSafe() { const t = document.getElementById('tooltip'); if (t) t.style.display = 'none'; }

function edgeScrollStep(dt) {
  if (!R.edgeScroll || !R.mouse || document.body.classList.contains('dragging')) return;
  const w = R.canvas.clientWidth, h = R.canvas.clientHeight, m = R.mouse, E = 10;
  let dx = 0, dz = 0;
  if (m.x < E) dx = -1; else if (m.x > w - E) dx = 1;
  if (m.y < E) dz = -1; else if (m.y > h - E) dz = 1;
  if (!dx && !dz) return;
  const sp = R.cam.dist * 0.7 * dt, cy = Math.cos(R.cam.yaw), sy = Math.sin(R.cam.yaw);
  R.cam.tx += (dx * cy + dz * sy) * sp; R.cam.tz += (-dx * sy + dz * cy) * sp; camChanged();
}
function keyboardPan(dt) {
  edgeScrollStep(dt);
  const k = R.keys; if (!k) return;
  const sp = R.cam.dist * 0.6 * dt;
  let dx = 0, dz = 0;
  if (k['a'] || k['arrowleft']) dx -= 1; if (k['d'] || k['arrowright']) dx += 1;
  if (k['w'] || k['arrowup']) dz -= 1; if (k['s'] || k['arrowdown']) dz += 1;
  if (k['q']) R.cam.yaw += dt; if (k['e']) R.cam.yaw -= dt;
  if (k['r']) R.cam.tilt += dt * 0.6; if (k['f']) R.cam.tilt -= dt * 0.6;
  if (dx || dz || k['q'] || k['e'] || k['r'] || k['f']) {
    const cy = Math.cos(R.cam.yaw), sy = Math.sin(R.cam.yaw);
    R.cam.tx += (dx * cy + dz * sy) * sp; R.cam.tz += (-dx * sy + dz * cy) * sp;
    updateCamera(); R.dirty = true; R.labelsDirty = true;
  }
  if (k['+'] || k['=']) { R.cam.dist *= 1 - dt * 1.2; updateCamera(); R.dirty = true; R.labelsDirty = true; }
  if (k['-']) { R.cam.dist *= 1 + dt * 1.2; updateCamera(); R.dirty = true; R.labelsDirty = true; }
}

function focusProv(pid, dist) { const p = MAP.provs[pid]; R.cam.tx = p.lon; R.cam.tz = -p.lat; if (dist) R.cam.dist = dist; updateCamera(); R.dirty = true; R.labelsDirty = true; }
function focusState(id, dist) {
  const s = G.S[id]; const c = stateCenter(s);
  R.cam.tx = c[0]; R.cam.tz = -c[1]; if (dist) R.cam.dist = dist;
  updateCamera(); R.dirty = true; R.labelsDirty = true;
}
function focusLonLat(lon, lat, dist) { R.cam.tx = lon; R.cam.tz = -lat; if (dist) R.cam.dist = dist; updateCamera(); R.dirty = true; R.labelsDirty = true; }

/* ---------- pintado ---------- */
R.occRGB = tag => (R._rgb = R._rgb || {})[tag] || (R._rgb[tag] = hex2rgb(G.C[tag].color));
function paintPixel(i, fill, hov, sel) {
  const tc = MAP.terrainCol, d = R.img.data, o = i * 4;
  let r = tc[o], g = tc[o + 1], b = tc[o + 2];
  const pr = G.P ? G.P[MAP.provOf[i]] : null;
  const gn = (((i * 2246822519) >>> 0) & 255) / 255 - 0.5; r += gn * 7; g += gn * 7; b += gn * 7;
  if (fill[3] > 0) {
    const a = fill[3];
    // modula con la luminancia del terreno para conservar el relieve
    const lum = 0.55 + 0.9 * ((r * 0.3 + g * 0.59 + b * 0.11) / 255);
    r = r * (1 - a) + fill[0] * lum * a; g = g * (1 - a) + fill[1] * lum * a; b = b * (1 - a) + fill[2] * lum * a;
  }
  if (pr && R.anyOcc) {
    const nbp = MAP.pnb[i], nby = nbp !== NOPROV ? G.P[nbp].by : null, by = pr.by;
    const x = i % MAP_W, y = (i / MAP_W) | 0, st = ((x + y) >> 1) & 1;
    if (nbp !== NOPROV && by !== nby) { if (st) { r = 255; g = 232; b = 130; } else { r = 150; g = 22; b = 22; } }
    else if (by) { const k = st ? 0.78 : 0.45, rgb = R.occRGB(by); r = r * (1 - k) + rgb[0] * k; g = g * (1 - k) + rgb[1] * k; b = b * (1 - k) + rgb[2] * k; }
  }
  const e = 0;
  if (hov) { r = r * 0.8 + 55; g = g * 0.8 + 55; b = b * 0.8 + 44; }
  if (sel) { r = r * 0.78 + 60; g = g * 0.78 + 52; b = b * 0.78 + 28; if (e) { r = 255; g = 236; b = 170; } }
  d[o] = r; d[o + 1] = g; d[o + 2] = b; d[o + 3] = 255;
}

function fullRepaint() {
  const S = G.S, land = MAP.land, d = R.img.data, tc = MAP.terrainCol;
  if (!R.oceanInit) { for (let i = 0; i < land.length; i++) if (!land[i]) { const o = i * 4; d[o] = tc[o]; d[o + 1] = tc[o + 1]; d[o + 2] = tc[o + 2]; d[o + 3] = 255; } R.oceanInit = true; }
  const off = MAP.pixOff, ord = MAP.pixOrder;
  for (let s = 0; s < S.length; s++) {
    const fill = stateFill(S[s]), hov = s === R.hover, sel = s === R.sel;
    for (let k = off[s], e = off[s + 1]; k < e; k++) paintPixel(ord[k], fill, hov, sel);
  }
  R.ctx.putImageData(R.img, 0, 0);
  R.tex.needsUpdate = true; R.dirty = true; R.minimapDirty = true;
  if (R.cityMesh) updateCityColors();
  if (typeof redrawOverlay === 'function') redrawOverlay(false);
}

function repaintState(id) {
  if (id < 0) return;
  const fill = stateFill(G.S[id]);
  const off = MAP.pixOff, ord = MAP.pixOrder;
  // región mínima
  const st = MAP.stats[id];
  for (let k = off[id]; k < off[id + 1]; k++) paintPixel(ord[k], fill, id === R.hover, id === R.sel);
  const x0 = Math.max(0, st.x0 - 2), y0 = Math.max(0, st.y0 - 2), w = Math.min(MAP_W - x0, st.x1 - st.x0 + 5), h = Math.min(MAP_H - y0, st.y1 - st.y0 + 5);
  R.ctx.putImageData(R.img, 0, 0, x0, y0, w, h);
  R.tex.needsUpdate = true; R.dirty = true;
}
function setHover(id) {
  if (id === R.hover) return; R.hoverWant = id;
  if (R.hoverTimer) return;
  R.hoverTimer = setTimeout(() => { R.hoverTimer = null; const nw = R.hoverWant; if (nw === R.hover) return; const old = R.hover; R.hover = nw; repaintState(old); repaintState(nw); }, 45);
}
function onFrontChanged(ids) {
  R.anyOcc = G.P.some(p => p.by);
  ids.forEach(sid => { if (G.S[sid]) repaintState(sid); });
}
function setSelected(id) { const old = R.sel; R.sel = id; repaintState(old); repaintState(id); if (typeof redrawOverlay === 'function') redrawOverlay(false); }
function setMapMode(m) { R.mode = m; fullRepaint(); }

function onOwnershipChanged(sid) {
  computeEdges(G.ownerOf); if (R.cityMesh) updateCityColors();
  fullRepaint(); R.labelsDirty = true; computeLabels();
}

/* ---------- etiquetas ---------- */
function computeLabels() {
  R.labels = [];
  const seen = new Set();
  const byOwner = {};
  G.S.forEach(s => (byOwner[s.owner] = byOwner[s.owner] || []).push(s));
  for (const tag in byOwner) {
    if (tag === NONE) continue;
    const list = byOwner[tag]; const set = new Set(list.map(s => s.id));
    let best = null;
    list.forEach(s0 => {
      if (seen.has(s0.id)) return;
      const comp = []; const stack = [s0.id]; seen.add(s0.id);
      while (stack.length) { const id = stack.pop(); comp.push(G.S[id]); G.S[id].neigh.forEach(n => { if (set.has(n) && !seen.has(n)) { seen.add(n); stack.push(n); } }); }
      const area = comp.reduce((a, s) => a + MAP.stats[s.id].area, 0);
      const score = comp.reduce((a, s) => a + s.popBase, 0) + (comp.some(s => s.id === G.C[tag].capital) ? 1e9 : 0);
      if (!best || score > best.score) best = {comp, area, score};
    });
    if (!best) continue;
    let sx = 0, sy = 0, a = 0, x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    best.comp.forEach(s => { const st = MAP.stats[s.id]; sx += st.sx; sy += st.sy; a += st.area; x0 = Math.min(x0, st.x0); x1 = Math.max(x1, st.x1); y0 = Math.min(y0, st.y0); y1 = Math.max(y1, st.y1); });
    const lon = xToLon(sx / a), lat = yToLat(sy / a);
    const c = G.C[tag];
    R.labels.push({tag, name: c.name.toUpperCase(), lon, lat, wDeg: (x1 - x0) / MAP_W * 360, hDeg: (y1 - y0) / MAP_H * 144, area: best.area, el: null});
  }
  R.labelRoot.innerHTML = '';
  R.labels.forEach(l => { const el = document.createElement('div'); el.className = 'maplabel'; el.textContent = l.name; R.labelRoot.appendChild(el); l.el = el; });
  R.sLabels = G.S.map(s => { const c = stateCenter(s); const el = document.createElement('div'); el.className = 'statelabel'; el.textContent = s.name; R.labelRoot.appendChild(el); return {lon: c[0], lat: c[1], el, id: s.id}; });
  R.labelsDirty = true;
}

function updateLabels() {
  const cw = R.canvas.clientWidth, ch = R.canvas.clientHeight;
  const pxPerDeg = (() => { const a = worldToScreen(R.cam.tx, 0, R.cam.tz), b = worldToScreen(R.cam.tx + 1, 0, R.cam.tz); return Math.abs(b[0] - a[0]); })();
  R.pxPerDeg = pxPerDeg;
  R.labels.forEach(l => {
    const p = worldToScreen(l.lon, 0.2, -l.lat);
    const wpx = l.wDeg * pxPerDeg;
    const fs = clamp(wpx / (l.name.length * 0.95), 0, 30);
    const on = fs >= 10 && p[0] > -100 && p[0] < cw + 100 && p[1] > -50 && p[1] < ch + 50 && pxPerDeg < 17;
    if (on) { l.el.style.display = 'block'; l.el.style.fontSize = fs.toFixed(1) + 'px'; l.el.style.transform = `translate(-50%,-50%) translate(${p[0].toFixed(1)}px,${p[1].toFixed(1)}px)`; l.el.style.letterSpacing = (fs * 0.14).toFixed(1) + 'px'; } else l.el.style.display = 'none';
  });
  const showStates = pxPerDeg >= 17;
  R.sLabels.forEach(l => {
    if (!showStates) { if (l.on) { l.el.style.display = 'none'; l.on = false; } return; }
    const p = worldToScreen(l.lon, 0.2, -l.lat);
    const on = p[0] > -60 && p[0] < cw + 60 && p[1] > -30 && p[1] < ch + 30;
    if (on) { l.el.style.display = 'block'; l.el.style.fontSize = clamp(pxPerDeg * 0.36, 9, 15) + 'px'; l.el.style.transform = `translate(-50%,-50%) translate(${p[0].toFixed(1)}px,${p[1].toFixed(1)}px)`; l.on = true; }
    else if (l.on) { l.el.style.display = 'none'; l.on = false; }
  });
  // marcadores
  updateMarkers(); if (typeof updateCityLabels === 'function') updateCityLabels();
}

function updateArmyTokens() {
  if (!G.armies) return;
  R.ak = R.ak || {};
  const px = R.pxPerDeg || 10, zoomIn = px >= 16;
  const sel = window.UI && UI.selArmy;
  const wanted = new Map(), perState = {};
  G.armies.forEach(a => {
    const mine = a.tag === G.player, atWar = !mine && hostileTags(G.player, a.tag);
    if (!(mine || a.battle || a.id === sel || atWar || zoomIn)) return;
    (perState[a.loc] = perState[a.loc] || []).push(a);
  });
  for (const sid in perState) perState[sid].forEach((a, i) => wanted.set(a.id, [a, i, perState[sid].length]));
  for (const k in R.ak) if (!wanted.has(+k)) { R.ak[k].remove(); delete R.ak[k]; }
  const cw = R.canvas.clientWidth, ch = R.canvas.clientHeight;
  wanted.forEach(([a, i, n]) => {
    let el = R.ak[a.id];
    if (!el) { el = document.createElement('div'); el.className = 'atoken'; el.dataset.aid = a.id; el.dataset.act = 'seltoken'; el.dataset.id = a.id; R.markerRoot.appendChild(el); R.ak[a.id] = el; }
    const pv = MAP.provs[a.loc]; let plon = pv.lon, plat = pv.lat;
    if (a.sea) { const sf = MAP.provs[a.sea.from], st = MAP.provs[a.sea.to], f = clamp(1 - a.sea.left / a.sea.total, 0, 1); plon = sf.lon + (st.lon - sf.lon) * f; plat = sf.lat + (st.lat - sf.lat) * f; }
    else if (a.path.length && a.hopMax > 0 && !a.battle) { const nx = MAP.provs[a.path[0]], f = clamp(1 - a.hop / a.hopMax, 0, 1); plon += (nx.lon - plon) * f; plat += (nx.lat - plat) * f; }
    const p = worldToScreen(plon, R.cam.dist < 62 ? 1.0 : 0.5, -plat);
    const off = (i - (n - 1) / 2) * 30;
    const x = p[0] + off, y = p[1] + (a.tag === G.player ? 0 : 0);
    if (x < -40 || x > cw + 40 || y < -40 || y > ch + 40) { el.style.display = 'none'; return; }
    el.style.display = 'flex';
    const key = G.player + a.tag + a.divs.length + (a.sea ? 'z' : '') + (a.battle ? 'b' : '') + (a.id === sel ? 's' : '') + (a.path.length ? 'm' : '') + (window.UI && UI.selSet && UI.selSet.has(a.id) ? 'g' : '') + Math.round(armyStr(a) * 10);
    if (el._k !== key) {
      el._k = key; el.className = 'atoken' + (UI.selSet && UI.selSet.has(a.id) ? ' sel2' : '') + (a.tag === G.player ? ' mine' : '') + (a.id === sel ? ' sel' : '') + (a.battle ? ' fight' : '') + (a.sea ? ' sea' : '') + (a.path.length ? ' moving' : '');
      el.innerHTML = flag(a.tag, 'sm') + `<b>${a.divs.length}</b>` + `<i style="width:${Math.round(armyStr(a) * 100)}%"></i>` + (a.battle ? '<u>⚔</u>' : '');
    }
    el.style.transform = `translate(-50%,-50%) translate(${x.toFixed(1)}px,${y.toFixed(1)}px)`;
  });
  drawOrders();
}
function drawOrders() {
  let svg = R.ordSvg;
  if (!svg) { svg = R.ordSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('class', 'orders'); R.markerRoot.insertBefore(svg, R.markerRoot.firstChild); }
  const sel = window.UI && UI.selArmy; let h = '';
  G.armies.forEach(a => {
    const foe = a.tag !== G.player && hostileTags(G.player, a.tag);
    if (!a.path.length || !(a.tag === G.player || a.id === sel || foe)) return;
    const pts = [a.loc].concat(a.path).map(pid => { const pv = MAP.provs[pid]; const p = worldToScreen(pv.lon, 0.5, -pv.lat); return p[0].toFixed(1) + ',' + p[1].toFixed(1); });
    const last = pts[pts.length - 1].split(',');
    const cl = (a.id === sel ? 'sel' : '') + (foe ? ' foe' : '') + (a.chase ? ' chase' : '');
    h += `<polyline points="${pts.join(' ')}" class="${cl}"/><circle cx="${last[0]}" cy="${last[1]}" r="5" class="${cl}"/>`;
  });
  svg.innerHTML = (typeof frontsSvg === 'function' ? frontsSvg() : '') + h;
}

function updateMarkers() {
  if (!R.markerRoot) return;
  const want = [];
  G.battles.forEach(b => { if (G.S[b.state]) want.push({id: 'bt' + b.id, state: b.state, prov: b.prov, ch: '⚔️', cls: 'war'}); });
  const me = G.C[G.player];
  if (me && me.capital >= 0) want.push({id: 'cap', state: me.capital, ch: '★', cls: 'cap'});
  if (me && me.colonizing) want.push({id: 'col', state: me.colonizing.state, ch: '⚓', cls: 'col'});
  R.mk = R.mk || {};
  const ids = new Set(want.map(w => w.id));
  updateArmyTokens(); if (!R.anim) updateArmyMeshes(performance.now());
  for (const k in R.mk) if (!ids.has(k)) { R.mk[k].remove(); delete R.mk[k]; }
  want.forEach(w => {
    let el = R.mk[w.id]; if (!el) { el = document.createElement('div'); el.className = 'marker ' + w.cls; el.textContent = w.ch; if (w.id.startsWith('bt')) { el.dataset.act = 'selbattle'; el.dataset.id = w.id.slice(2); } R.markerRoot.appendChild(el); R.mk[w.id] = el; }
    const c = w.prov !== undefined ? [MAP.provs[w.prov].lon, MAP.provs[w.prov].lat] : stateCenter(G.S[w.state]); const p = worldToScreen(c[0], 0.6, -c[1]);
    el.style.transform = `translate(-50%,-100%) translate(${p[0].toFixed(1)}px,${p[1].toFixed(1)}px)`;
  });
}

/* ---------- minimapa ---------- */
function drawMinimap() {
  const mm = document.getElementById('minimap'); if (!mm) return;
  const ctx = mm.getContext('2d'); const w = mm.width, h = mm.height;
  if (R.minimapDirty) { ctx.drawImage(R.cv, 0, 0, w, h); R.minimapDirty = false; R.mmCache = ctx.getImageData(0, 0, w, h); }
  else if (R.mmCache) ctx.putImageData(R.mmCache, 0, 0);
  // región visible
  const corners = [[0, 0], [R.canvas.clientWidth, 0], [R.canvas.clientWidth, R.canvas.clientHeight], [0, R.canvas.clientHeight]].map(([x, y]) => screenToWorld(x, y));
  ctx.strokeStyle = '#f5e6b0'; ctx.lineWidth = 1.5; ctx.beginPath();
  let ok = true;
  corners.forEach((p, i) => { if (!p) { ok = false; return; } const x = (p.x + 180) / 360 * w, y = (LAT_TOP + p.z) / (LAT_TOP - LAT_BOT) * h; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
  if (ok) { ctx.closePath(); ctx.stroke(); }
}

let _lastT = 0;
function frame_(t) {
  const dt = Math.min(0.1, (t - _lastT) / 1000); _lastT = t;
  keyboardPan(dt);
  if (R.cityMesh === undefined && G.S && G.S.length && MAP.provs) { try { buildCities(); } catch (e) { console.warn(e); } R.cityMesh = R.cityMesh || null; R.dirty = true; }
  if ((R.anim || R.smokeOn || (G.battles && G.battles.length)) && t - (R.lastAnim || 0) > 55) { R.lastAnim = t; if (R.anim && animateMap(t)) R.dirty = true; R.smokeOn = updateSmoke(t); if (R.smokeOn) R.dirty = true; updateCityVisibility(); if (G.armies && G.armies.length && (R.cam.dist < 62 || R.figsShown)) updateArmyMeshes(t); }
  if (R.dirty || R.labelsDirty) {
    updateCamera(); if (typeof updateCityVisibility === 'function') updateCityVisibility();
    const t0 = performance.now(); R.renderer.render(R.scene, R.camera);
    R.renderMs = (R.renderMs || 10) * 0.9 + (performance.now() - t0) * 0.1;
    if (R.anim && R.renderMs > 45 && t > 8000) { R.anim = false; R.waterMesh.visible = false; R.cloudMesh.visible = false; if (typeof syncCamBtns === 'function') syncCamBtns(); }
    if (R.labelsDirty) { updateLabels(); R.labelsDirty = false; }
    drawMinimap();
    R.dirty = false;
  }
  if (window.onFrame) window.onFrame(t);
  requestAnimationFrame(frame_);
}

function focusCountry(tag, dist) {
  const c = G.C[tag]; if (!c || !c.states.length) return;
  const id = c.capital >= 0 && G.S[c.capital].owner === tag ? c.capital : c.states[0];
  focusState(id, dist || 60);
}
