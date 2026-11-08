/* ===== VISOR DE BATALLA EN 3D =====
   Misma simulación y mismos controles que el visor táctico 2D (battleviz.js): solo cambia cómo se dibuja el campo.
   · El terreno pintado del 2D (V.bg) se usa como textura de un suelo con relieve real (colinas, río hundido); encima: árboles, casas, muros, fuertes.
   · Cada figura del bloque se dibuja como un pequeño grupo de soldados 3D animados (marcha, fuego, carga, huida, caída…) con las tropas de troops3d.js.
   · Humo, fogonazos, obuses, explosiones, gas y lluvia son partículas 3D. Los caídos quedan en el suelo.
   · Cámara libre: arrastrar = mover · botón derecho o Mayús + arrastrar = girar · rueda = zoom · doble clic = vista completa · clic = seleccionar bloque.
   · Se dibuja con el renderizador del mapa (que está parado mientras hay una batalla abierta) y se copia al lienzo del visor, así no hay un segundo contexto WebGL.
   · Si el equipo no cumple los requisitos de las tropas 3D, o cualquier cosa falla, se vuelve solo al visor 2D (R.b3Dead = true). Botón «Vista 3D» para alternar. */
const B3 = {S: null, cam: {tx: BV_W / 2, tz: BV_H / 2, d: 900, yaw: 0, pit: 0.82}, drag: null, hoverW: null, active: false, ray: null};
const B3_S = 1.6;                                                                  // escala de las figuras (1,8 u de altura → ≈ 2,4 u del campo)
const B3_CAP = {inf: [1400, 2800, 2800], cav: [400, 900, 900], art: [300, 700, 700]};
const B3_CAV = ['husar', 'husar', 'lancero', 'dragon', 'coracero'];
const b3Pref = () => { try { const v = localStorage.getItem('victoria-bv3d'); return v === null ? null : v === '1'; } catch (e) { return null; } };
function b3Usable() { try { return !!(R.renderer && typeof t3Usable === 'function' && t3Usable() && typeof Troops3D !== 'undefined'); } catch (e) { return false; } }
function b3On() {
  if (R.bv3d === undefined) { const p = b3Pref(); R.bv3d = p === null ? R.quality !== 'bajo' : p; }
  return !!R.bv3d && !R.b3Dead && b3Usable();
}
const B3_EX = 300, B3_EZ = 260;                                                    // el suelo se prolonga más allá del campo: no hay «borde del mundo»
// altura compartida con la simulación (realismo3.js) + barranco hundido (solo visual: se cruza por los pasos)
function b3H(tf, x, z) {
  let h = bvHeight(tf, x, z);
  if (tf.ravine) { const rv = tf.ravine, dx = Math.abs(x - (rv.x + Math.sin(z / 70 + rv.ph) * rv.amp)), w = rv.w * 1.5; if (dx < w && !rv.fords.some(f => Math.abs(z - f.y) < f.w / 2 + 8)) { const k = 1 - dx / w; h -= 6.5 * k * k * (3 - 2 * k); } }
  return h;
}
const b3Rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
function b3Strip(tf) { return Object.assign({}, tf, {forests: [], orchards: [], villages: [], hills: [], hill: null, hill2: null, walls: [], farm: null, ravine: null}); }
function b3Tex(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); if (THREE.SRGBColorSpace) t.colorSpace = THREE.SRGBColorSpace; return t; }
// suelo: la textura pintada del visor 2D SIN bosques, aldeas, colinas ni textos (eso se hace en 3D), prolongada en espejo más allá del campo
function b3Ground(S, V, b) {
  const tf = S.tf, W3 = BV_W + 2 * B3_EX, H3 = BV_H + 2 * B3_EZ, cw = Math.min(R.renderer.capabilities.maxTextureSize || 2048, R.lowEnd ? 2048 : 3072), ch = Math.round(cw * H3 / W3), s = cw / W3; S.gs = s;
  const kT = b.tf, kV = V.tf, P = CanvasRenderingContext2D.prototype, ft = P.fillText, st = P.strokeText; let bg;
  try { b.tf = b3Strip(tf); V.tf = b.tf; V._bg3 = true; P.fillText = P.strokeText = function () { }; bg = bvBuildBg(V, b); }
  finally { b.tf = kT; V.tf = kV; delete V._bg3; P.fillText = ft; P.strokeText = st; }
  const base = document.createElement('canvas'); base.width = cw; base.height = ch; const g = base.getContext('2d'), fw = BV_W * s, fh = BV_H * s;
  for (let iy = -1; iy <= 1; iy++) for (let ix = -1; ix <= 1; ix++) { const dx = (B3_EX + ix * BV_W) * s, dy = (B3_EZ + iy * BV_H) * s, fx = ix !== 0, fy = iy !== 0; g.save(); g.translate(dx + (fx ? fw : 0), dy + (fy ? fh : 0)); g.scale(fx ? -1 : 1, fy ? -1 : 1); g.drawImage(bg, 0, 0, fw, fh); g.restore(); }
  bg.width = bg.height = 1;
  { const a = document.createElement('canvas'); a.width = a.height = 1; const ag = a.getContext('2d'); ag.drawImage(base, 0, 0, 1, 1); const d = ag.getImageData(0, 0, 1, 1).data; S.avg = new THREE.Color(); if (THREE.SRGBColorSpace) S.avg.setRGB(d[0] / 255, d[1] / 255, d[2] / 255, THREE.SRGBColorSpace); else S.avg.setRGB(d[0] / 255, d[1] / 255, d[2] / 255); }
  S.base = base; S.gcv = document.createElement('canvas'); S.gcv.width = cw; S.gcv.height = ch;
  S.gtex = new THREE.CanvasTexture(S.gcv); if (THREE.SRGBColorSpace) S.gtex.colorSpace = THREE.SRGBColorSpace; S.gtex.anisotropy = R.lowEnd ? 1 : 4;
  b3Compose(S);
  const NX = R.lowEnd ? 200 : 320, NZ = R.lowEnd ? 96 : 150, n = (NX + 1) * (NZ + 1), pos = new Float32Array(n * 3), uv = new Float32Array(n * 2), idx = [];
  for (let j = 0; j <= NZ; j++) for (let i = 0; i <= NX; i++) { const k = j * (NX + 1) + i, x = -B3_EX + i / NX * W3, z = -B3_EZ + j / NZ * H3; pos[k * 3] = x; pos[k * 3 + 1] = b3H(tf, x, z); pos[k * 3 + 2] = z; uv[k * 2] = i / NX; uv[k * 2 + 1] = 1 - j / NZ; }
  for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) { const a = j * (NX + 1) + i, bb = a + 1, c = a + NX + 1, d = c + 1; idx.push(a, c, bb, bb, c, d); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); geo.setIndex(idx); geo.computeVertexNormals();
  const mat = new THREE.MeshLambertMaterial({map: S.gtex});
  if (R.renderer.capabilities.isWebGL2) mat.onBeforeCompile = sh => { sh.fragmentShader = 'float vh(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }\nfloat vnoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(vh(i), vh(i + vec2(1.0, 0.0)), f.x), mix(vh(i + vec2(0.0, 1.0)), vh(i + vec2(1.0, 1.0)), f.x), f.y); }\n' + sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
    { vec2 q = vMapUv * vec2(1700.0, 800.0); float fw = fwidth(q.x); float n1 = vnoise(q * 0.5), n2 = vnoise(q * 1.7); float n = n1 * 0.65 + n2 * 0.35; diffuseColor.rgb *= 1.0 + (n - 0.5) * 0.2 * (1.0 - smoothstep(0.25, 0.8, fw)); }`); };
  S.ground = new THREE.Mesh(geo, mat); S.scene.add(S.ground);
  const sk = new THREE.Mesh(new THREE.PlaneGeometry(16000, 16000).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({color: S.avg})); sk.position.set(BV_W / 2, -0.9, BV_H / 2); S.scene.add(sk);
}
// pintura variable del suelo: suelo de bosque (verde, ardiendo o calcinado), patios de aldea y barranco
function b3Compose(S) {
  const g = S.gcv.getContext('2d'), s = S.gs, tf = S.tf, bio = S.bio; g.clearRect(0, 0, S.gcv.width, S.gcv.height); g.drawImage(S.base, 0, 0);
  const X = x => (x + B3_EX) * s, Y = z => (z + B3_EZ) * s;
  const blob = (x, y, r, sq, c, a) => { g.save(); g.translate(X(x), Y(y)); g.scale(1, sq); const rr = r * s, rg = g.createRadialGradient(0, 0, rr * 0.15, 0, 0, rr); rg.addColorStop(0, b3Rgba(c, a)); rg.addColorStop(0.7, b3Rgba(c, a * 0.85)); rg.addColorStop(1, b3Rgba(c, 0)); g.fillStyle = rg; g.beginPath(); g.arc(0, 0, rr, 0, 6.3); g.fill(); g.restore(); };
  const floor = bio === 8 ? [92, 108, 100] : bio === 7 || bio === 3 ? [96, 84, 58] : [30, 62, 36];
  (tf.forests || []).forEach(f => { if (f.burnt) blob(f.x, f.y, f.r * 1.08, 0.82, [18, 14, 10], 0.88); else if (f.fire) { blob(f.x, f.y, f.r * 1.08, 0.82, floor, 0.55); blob(f.x, f.y, f.r * 0.9, 0.82, [90, 36, 12], 0.55); } else blob(f.x, f.y, f.r * 1.08, 0.82, floor, 0.72); });
  (tf.orchards || []).forEach(f => blob(f.x, f.y, f.r * 1.05, 1, [58, 92, 48], 0.32));
  (tf.villages || []).forEach(v => blob(v.x, v.y, v.r * 1.15, 0.82, [194, 176, 140], 0.6));
  if (tf.ravine) { const rv = tf.ravine, path = () => { g.beginPath(); for (let z = -B3_EZ - 8; z <= BV_H + B3_EZ + 8; z += 8) { const x = rv.x + Math.sin(z / 70 + rv.ph) * rv.amp; z === -B3_EZ - 8 ? g.moveTo(X(x), Y(z)) : g.lineTo(X(x), Y(z)); } g.stroke(); };
    g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = 'rgba(88,72,52,.85)'; g.lineWidth = rv.w * 2.6 * s; path(); g.strokeStyle = 'rgba(52,42,32,.95)'; g.lineWidth = rv.w * 1.5 * s; path(); g.strokeStyle = 'rgba(26,21,16,.95)'; g.lineWidth = rv.w * 0.6 * s; path();
    rv.fords.forEach(f => { const x = rv.x + Math.sin(f.y / 70 + rv.ph) * rv.amp; g.fillStyle = 'rgba(150,128,90,.96)'; g.fillRect(X(x - rv.w * 1.4), Y(f.y - f.w / 2), rv.w * 2.8 * s, f.w * s); }); }
  S.gtex.needsUpdate = true;
}
// etiquetas con el nombre de las aldeas: rótulos nítidos del mismo tamaño en pantalla a cualquier distancia
function b3Label(txt) { return b3Tex(512, 96, (g, w, h) => { g.font = '700 52px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round'; g.lineWidth = 11; g.strokeStyle = 'rgba(14,12,9,.9)'; g.strokeText(txt, w / 2, h / 2 + 2); g.fillStyle = '#f6edd2'; g.fillText(txt, w / 2, h / 2 + 2); }); }
const _b3m = new THREE.Matrix4(), _b3q = new THREE.Quaternion(), _b3p = new THREE.Vector3(), _b3s = new THREE.Vector3(), _b3up = new THREE.Vector3(0, 1, 0), _b3c = new THREE.Color();
function b3Put(im, i, x, y, z, sx, sy, sz, yaw) { _b3q.setFromAxisAngle(_b3up, yaw || 0); _b3p.set(x, y, z); _b3s.set(sx, sy, sz); _b3m.compose(_b3p, _b3q, _b3s); im.setMatrixAt(i, _b3m); }
// coloca (o recoloca) los árboles: los de un bosque calcinado quedan bajos y negros
function b3PlaceTrees(S) {
  const T = S.trees, tf = S.tf, bio = S.bio; let ti = 0;
  const place = (arr, mesh) => arr.forEach((t, i) => { const fo = t[5] >= 0 ? tf.forests[t[5]] : null, burnt = !!(fo && fo.burnt), y = b3H(tf, t[0], t[1]);
    b3Put(mesh, i, t[0], y, t[1], t[2], t[2] * (burnt ? 0.35 : 0.9 + t[4] * 0.3), t[2], t[4] * 6); _b3c.setHSL(burnt ? 0.07 : (bio === 7 || bio === 3 ? 0.17 : 0.3) + (t[4] - 0.5) * 0.06, burnt ? 0.2 : 0.38, burnt ? 0.05 : 0.16 + t[4] * 0.1); mesh.setColorAt(i, _b3c);
    b3Put(T.trunk, ti, t[0], y, t[1], t[2], burnt ? t[2] * 0.5 : t[2], t[2], 0); b3Put(S.tsh, ti++, t[0] + 1, y + 0.12, t[1] + 1, burnt ? 3 : 8.5 * t[2], 1, burnt ? 3 : 8.5 * t[2], 0); });
  place(T.pines, T.cone); place(T.round, T.ball); S.tsh.instanceMatrix.needsUpdate = true; [T.cone, T.ball, T.trunk].forEach(m => { m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }); S.burnSig = S.burnSigWant === undefined ? 0 : S.burnSigWant;
}
function b3Dispose(S) {
  if (!S) return; S.scene.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) { (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { if (m.map) m.map.dispose(); m.dispose(); }); } });
}
function b3SoftTex() { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), rg = g.createRadialGradient(32, 32, 0, 32, 32, 32); rg.addColorStop(0, 'rgba(255,255,255,1)'); rg.addColorStop(0.5, 'rgba(255,255,255,.55)'); rg.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = rg; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); }
function b3Points(cap, size, additive, tex) {
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(cap * 3), 3).setUsage(THREE.DynamicDrawUsage)); geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(cap * 4), 4).setUsage(THREE.DynamicDrawUsage)); geo.setDrawRange(0, 0);
  const m = new THREE.Points(geo, new THREE.PointsMaterial({size, map: tex, vertexColors: true, transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, sizeAttenuation: true, fog: false}));
  m.frustumCulled = false; m.userData.cap = cap; m.userData.n = 0; return m;
}
const b3Push = (P, x, y, z, r, g, b, a) => { const u = P.userData; if (u.n >= u.cap) return; const p = P.geometry.attributes.position.array, c = P.geometry.attributes.color.array, i = u.n++; p[i * 3] = x; p[i * 3 + 1] = y; p[i * 3 + 2] = z; c[i * 4] = r; c[i * 4 + 1] = g; c[i * 4 + 2] = b; c[i * 4 + 3] = a; };
const b3Flush = P => { const u = P.userData; P.geometry.setDrawRange(0, u.n); P.geometry.attributes.position.needsUpdate = true; P.geometry.attributes.color.needsUpdate = true; u.n = 0; };

function b3Build(V, b) {
  const S = {bid: b.id, scene: new THREE.Scene(), sets: {}, tf: V.tf || battleTerrain(b), seed: V.seed, fortSig: null, fortG: new THREE.Group()};
  const sky = 0xa9bfcf; S.scene.background = new THREE.Color(sky); S.scene.fog = new THREE.Fog(sky, 1400, 3300); S.sky = new THREE.Color(sky);
  S.sun = new THREE.DirectionalLight(0xfff0d8, 0.88); S.sun.position.set(-500, 900, -350); S.scene.add(S.sun); S.amb = new THREE.AmbientLight(0xffffff, 0.62); S.scene.add(S.amb); S.hemi = new THREE.HemisphereLight(0xd6e4ff, 0x6a6a52, 0.34); S.scene.add(S.hemi);
  S.cam = new THREE.PerspectiveCamera(40, BV_W / BV_H, 2, 7000);
  const tf = S.tf, H = (i, k) => hash2(i, S.seed, k), bio = MAP.provs[b.prov].biome;
  S.bio = bio; S.shMat = new THREE.MeshBasicMaterial({map: b3Tex(64, 64, (g, w, h) => { const rg = g.createRadialGradient(32, 32, 2, 32, 32, 31); rg.addColorStop(0, 'rgba(255,255,255,1)'); rg.addColorStop(0.55, 'rgba(255,255,255,.6)'); rg.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = rg; g.fillRect(0, 0, w, h); }), color: 0x000000, transparent: true, opacity: 0.42, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1});
  S.shGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  b3Ground(S, V, b);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p3 = new THREE.Vector3(), s3 = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), col = new THREE.Color();
  const put = (im, i, x, y, z, sx, sy, sz, yaw) => { q.setFromAxisAngle(up, yaw || 0); p3.set(x, y, z); s3.set(sx, sy, sz); m4.compose(p3, q, s3); im.setMatrixAt(i, m4); };
  // --- árboles (mismas posiciones que los pintados en el suelo); cada uno recuerda su bosque para poder quemarse
  { const list = [], capT = R.lowEnd ? 500 : 1500;
    tf.forests.forEach((f, fi) => { const n = Math.round(f.r * 0.8), pine = bio === 5 || bio === 2 || H(fi, 9) < 0.4; for (let i = 0; i < n; i++) { const a = H(i + fi * 200, 70) * 6.283, d = Math.sqrt(H(i + fi * 200, 71)) * f.r; list.push([f.x + Math.cos(a) * d, f.y + Math.sin(a) * d * 0.8, 0.8 + H(i + fi * 200, 72) * 0.7, pine, H(i + fi * 200, 73), fi]); } });
    (tf.orchards || []).forEach((f, fi) => { const n = Math.round(f.r * 0.3); for (let i = 0; i < n; i++) { const a = H(i + fi * 90, 80) * 6.283, d = Math.sqrt(H(i + fi * 90, 81)) * f.r; list.push([f.x + Math.cos(a) * d, f.y + Math.sin(a) * d, 0.6 + H(i, 82) * 0.3, false, 0.9, -1]); } });
    if (list.length > capT) list.length = capT;
    const pines = list.filter(t => t[3]), round = list.filter(t => !t[3]);
    const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.35, 0.5, 3, 5).translate(0, 1.5, 0), new THREE.MeshLambertMaterial({color: 0x5a4430}), Math.max(1, list.length));
    const cone = new THREE.InstancedMesh(new THREE.ConeGeometry(3.2, 9, 6).translate(0, 7, 0), new THREE.MeshLambertMaterial({color: 0xffffff, flatShading: true}), Math.max(1, pines.length));
    const ball = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(3.6, 0).scale(1, 0.9, 1).translate(0, 5.6, 0), new THREE.MeshLambertMaterial({color: 0xffffff, flatShading: true}), Math.max(1, round.length));
    S.tsh = new THREE.InstancedMesh(S.shGeo, S.shMat, Math.max(1, list.length)); S.tsh.count = list.length; S.tsh.frustumCulled = false; S.scene.add(S.tsh);
    cone.count = pines.length; ball.count = round.length; trunk.count = list.length; S.trees = {pines, round, cone, ball, trunk}; S.bio = bio; [cone, ball, trunk].forEach(m => { m.frustumCulled = false; S.scene.add(m); }); b3PlaceTrees(S); }
  // --- aldeas: casas con tejado y alguna iglesia
  { const hs = []; (tf.villages || []).forEach((v, vi) => { for (let i = 0; i < v.n; i++) hs.push({x: v.x + (H(i + vi * 50, 90) - 0.5) * v.r * 1.7, z: v.y + (H(i + vi * 50, 91) - 0.5) * v.r * 1.3, w: 6 + H(i + vi * 50, 92) * 3, d: 5 + H(i + vi * 50, 93) * 3, h: 3.6 + H(i + vi * 50, 94) * 1.8, r: (H(i + vi * 50, 95) - 0.5) * 0.5, t: H(i + vi * 50, 96)}); if (v.church) hs.push({x: v.x, z: v.y, w: 5, d: 9, h: 5, r: 0, t: 0.5, church: true}); });
    if (hs.length) { const walls = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), new THREE.MeshLambertMaterial({color: 0xffffff}), hs.length), roofs = new THREE.InstancedMesh(new THREE.ConeGeometry(0.78, 1, 4).rotateY(Math.PI / 4).translate(0, 0.5, 0), new THREE.MeshLambertMaterial({color: 0xffffff, flatShading: true}), hs.length);
      hs.forEach((h, i) => { const y = b3H(tf, h.x, h.z); put(walls, i, h.x, y, h.z, h.w, h.h, h.d, h.r); col.setHSL(0.1 + h.t * 0.04, 0.25, 0.68 + h.t * 0.1); walls.setColorAt(i, col); put(roofs, i, h.x, y + h.h, h.z, h.w * 1.25, h.church ? 9 : 2.8 + h.t, h.d * 1.25, h.r); col.setHSL(h.church ? 0.6 : 0.02 + h.t * 0.04, 0.5, h.church ? 0.3 : 0.32); roofs.setColorAt(i, col); });
      [walls, roofs].forEach(m => { m.instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true; m.frustumCulled = false; S.scene.add(m); }); } }
  (tf.villages || []).forEach(v => { if (!v.name) return; const sp = new THREE.Sprite(new THREE.SpriteMaterial({map: b3Label(v.name), depthTest: false, transparent: true, sizeAttenuation: false, fog: false})); sp.scale.set(0.2, 0.0375, 1); sp.position.set(v.x, b3H(tf, v.x, v.y) + 15, v.y); sp.renderOrder = 8; S.scene.add(sp); });
  // --- muros y setos
  if ((tf.walls || []).length) { const wl = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1.5, 0.9).translate(0, 0.75, 0), new THREE.MeshLambertMaterial({color: 0x8b8678}), tf.walls.length);
    tf.walls.forEach((w, i) => { const l = Math.hypot(w.x2 - w.x1, w.y2 - w.y1), mx = (w.x1 + w.x2) / 2, mz = (w.y1 + w.y2) / 2; put(wl, i, mx, b3H(tf, mx, mz), mz, l, 1, 1, Math.atan2(-(w.y2 - w.y1), w.x2 - w.x1)); }); wl.instanceMatrix.needsUpdate = true; wl.frustumCulled = false; S.scene.add(wl); }
  // --- estandartes, placas de bloque y anillo de selección (dinámicos)
  const N = 220;
  const flagTex = b3Tex(64, 40, (g, w, h) => { g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(0,0,0,.55)'; g.lineWidth = 4; g.strokeRect(2, 2, w - 4, h - 4); g.fillStyle = 'rgba(0,0,0,.28)'; g.fillRect(0, 0, 7, h); g.fillStyle = 'rgba(255,255,255,.55)'; g.fillRect(w * 0.42, 6, 5, h - 12); g.fillRect(w * 0.3, h / 2 - 2.5, w * 0.4, 5); }),
    plateTex = b3Tex(64, 64, (g, w, h) => { g.shadowColor = '#fff'; g.shadowBlur = 12; g.fillStyle = '#fff'; g.fillRect(14, 14, w - 28, h - 28); });
  S.poles = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.14, 0.14, 8.4, 4).translate(0, 4.2, 0), new THREE.MeshLambertMaterial({color: 0x4a3a28}), N);
  S.flags = new THREE.InstancedMesh(new THREE.PlaneGeometry(3.6, 2.3).translate(1.8, 6.8, 0), new THREE.MeshBasicMaterial({map: flagTex, color: 0xffffff, side: THREE.DoubleSide}), N);
  S.flags2 = new THREE.InstancedMesh(new THREE.PlaneGeometry(3.6, 0.8).translate(1.8, 5.1, 0), new THREE.MeshBasicMaterial({color: 0xffffff, side: THREE.DoubleSide}), N);
  S.plates = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({map: plateTex, color: 0xffffff, transparent: true, opacity: 0.55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2}), N);
  S.sh = new THREE.InstancedMesh(S.shGeo, S.shMat, R.lowEnd ? 2500 : 5000); S.sh.count = 0; S.sh.frustumCulled = false; S.sh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); S.scene.add(S.sh); S.shN = 0;
  [S.poles, S.flags, S.flags2, S.plates].forEach(m => { m.count = 0; m.frustumCulled = false; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); S.scene.add(m); });
  S.ring = new THREE.Mesh(new THREE.RingGeometry(0.92, 1, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({color: 0xfff096, transparent: true, opacity: 0.9, depthTest: false, depthWrite: false})); S.ring.visible = false; S.ring.renderOrder = 9; S.scene.add(S.ring);
  S.scene.add(S.fortG);
  // --- partículas
  const tex = b3SoftTex(); S.tex = tex;
  S.smoke = b3Points(700, 9, false, tex); S.dust = b3Points(300, 7, false, tex); S.flash = b3Points(400, 4.5, true, tex); S.boom = b3Points(160, 20, true, tex); S.shell = b3Points(80, 3.2, false, tex); S.gas = b3Points(300, 24, false, tex);
  [S.smoke, S.dust, S.flash, S.boom, S.shell, S.gas].forEach(m => S.scene.add(m));
  S.rain = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(600 * 6), 3).setUsage(THREE.DynamicDrawUsage)), new THREE.LineBasicMaterial({color: 0xb4cdf5, transparent: true, opacity: 0.4, fog: false})); S.rain.frustumCulled = false; S.rain.visible = false; S.scene.add(S.rain);
  S.mats = {A: new THREE.Color(0xe8644f), B: new THREE.Color(0x6aa8e8)};
  return S;
}
// lote de tropas 3D (uno por tipo/época/tocado/papel), dentro de la escena de la batalla
function b3Set(S, kind, era, tag, role) {
  const T = Troops3D, sh = R.t3.shared, key = kind + '|' + era + '|' + T.troopGeoKey(kind, era, tag) + '|' + (role || '');
  let set = S.sets[key];
  if (!set) {
    const cls = /^(husar|lancero|dragon|coracero)$/.test(kind) ? 'cav' : /canon|obus|ametralladora|avantren|carro|carreta|artillero|tanque|mark1/.test(kind) ? 'art' : 'inf';
    set = S.sets[key] = new T.TroopLodSet(sh, kind, era, tag, B3_CAP[cls].map(n => R.lowEnd ? n >> 1 : n), {role, dist: [75, 220]}); set.meshes.forEach(m => S.scene.add(m)); set.kind = kind;
  }
  return set;
}
// fuertes (cambian durante la batalla): se rehacen solo si cambia su estado
function b3Forts(S, b) {
  const fl = b.forts || [], sig = fl.map(f => f.id + ':' + (f.hp > 0 ? 1 : 0) + ':' + f.kind + ':' + (f.garr ? 1 : 0)).join('|'); if (sig === S.fortSig) return; S.fortSig = sig;
  while (S.fortG.children.length) { const c = S.fortG.children.pop(); c.geometry.dispose(); c.material.dispose(); }
  const earth = new THREE.CylinderGeometry(0.62, 0.7071, 1, 4, 1).rotateY(Math.PI / 4).translate(0, 0.5, 0), box = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
  const add = (geo, col, x, y, z, sx, sy, sz, flat) => { const m = new THREE.Mesh(geo.clone(), new THREE.MeshLambertMaterial({color: col, flatShading: !!flat})); m.position.set(x, y, z); m.scale.set(sx, sy, sz); S.fortG.add(m); return m; };
  fl.forEach(f => { const dead = f.hp <= 0, trench = f.kind === 'trench', hh = dead ? 0.6 : trench ? 1.4 : f.kind === 'fort' ? 5.5 : 3, y = b3H(S.tf, f.x, f.y) - 0.2, col = dead ? 0x2e271f : f.kind === 'fort' ? 0x8f8168 : 0x7a6342;
    add(earth, col, f.x, y, f.y, f.w, hh, f.h, true);
    if (!dead) { add(box, trench ? 0x2c241a : 0x2f2820, f.x, y + hh - 0.05, f.y, f.w * (trench ? 0.78 : 0.62), 0.12, f.h * (trench ? 0.55 : 0.62)); }
    if (!dead && (f.kind === 'fort' || f.kind === 'redoubt')) [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([a, c]) => add(box, f.kind === 'fort' ? 0x9a8c72 : 0x6e5a3c, f.x + a * f.w * 0.46, y, f.y + c * f.h * 0.46, 3.4, hh + 2.2, 3.4, true));
    const tcol = G.C[f.side === 'A' ? b.A0 : b.B0].color, fp = new THREE.Mesh(new THREE.PlaneGeometry(3, 1.9).translate(1.5, 0, 0), new THREE.MeshBasicMaterial({color: tcol, side: THREE.DoubleSide})); fp.position.set(f.x, y + hh + 6.2, f.y); S.fortG.add(fp);
    add(new THREE.CylinderGeometry(0.13, 0.13, 6.8, 4).translate(0, 3.4, 0), 0x4a3a28, f.x, y + hh, f.y, 1, 1, 1); });
}

/* ---------- soldados ---------- */
function b3Sh(S, x, y, z, r) { if (S.shN >= S.sh.instanceMatrix.count) return; b3Put(S.sh, S.shN++, x, y + 0.14, z, r * 2.2, 1, r * 2.2, 0); }
const _b3o = {phase: 0, h: 0, bright: 0, skin: 0, horse: 0, start: null};
const _b3Cl = ['caer_muerto_atras', 'caer_muerto_adelante', 'caer_muerto_rodillas', 'caer_muerto_costado'];
function b3Clip(blk, f, era, cav) {
  const m = blk.mode, moving = (blk.sp || 0) > 8, fire = era === 'A' ? 'disparar_A' : era === 'B' ? 'disparar_B' : 'disparar_D';
  if (blk.type === 'tank') return moving ? 'avanzar' : (m === 'fire' || m === 'artfire' || m === 'fixing') ? 'disparar' : 'girar_torreta';
  if (cav) return f.flee > 0 ? 'galope' : (m === 'gallop' || m === 'charge') ? 'carga' : moving ? ((blk.sp || 0) > 40 ? 'trote' : 'paso') : 'idle';
  if (f.flee > 0 || m === 'rout' || m === 'recoil') return 'huir';
  if (m === 'charge') return 'cargar_bayoneta'; if (m === 'melee') return f.k % 2 ? 'melee_1' : 'melee_2'; if (m === 'victory') return 'celebrar';
  if (m === 'fire' || m === 'fixing' || m === 'skirmish') return moving ? 'marcha' : fire;
  return moving ? 'marcha' : 'idle';
}
function b3Fig(S, V, blk, f, era, tU, cp, ca) {
  const c = Math.cos(blk.hd), s = Math.sin(blk.hd), tag = blk.tag, tf = S.tf, cx = ca.x, cy = ca.y, cz = ca.z;
  const d3 = (x, y, z) => Math.hypot(x - cx, y - cy, z - cz);
  if (blk.type === 'art') {
    if (f.kind !== 'gun' || (!f.alive && f.dying <= 0)) return;
    const st = (blk.mode === 'artfire' || blk.mode === 'fire' || f.flash > 0) ? 'fuego' : (blk.sp || 0) > 8 ? 'marcha' : 'reposo', y = b3H(tf, f.x, f.y), yaw = Math.PI / 2 - blk.hd, c2 = Math.cos(yaw), s2 = Math.sin(yaw), h1 = hash2(blk.id, f.i, 11);
    Troops3D.troopGroup('bateria', era, st).forEach(m => { const set = b3Set(S, m.kind, era, tag, m.role), lx = m.at[0] * B3_S, lz = m.at[1] * B3_S, x = f.x + lx * c2 + lz * s2, z = f.y - lx * s2 + lz * c2;
      _b3o.phase = h1; _b3o.h = 0; _b3o.bright = (h1 * 7.3) % 1; _b3o.skin = (h1 * 4) | 0; _b3o.horse = 0; _b3o.start = null; set.add(d3(x, y, z), x, y, z, yaw + (m.at[2] || 0) * Math.PI / 180, B3_S, tag, m.clip, _b3o); b3Sh(S, x, y, z, /canon|obus|avantren/.test(m.kind) ? 2.6 : 1.0); });
    return;
  }
  const cav = blk.type === 'cav', tank = blk.type === 'tank', kind = tank ? 'tanque' : cav ? B3_CAV[blk.id % B3_CAV.length] : 'fusilero', set = b3Set(S, kind, era, tag, null);
  const m = tank ? 1 : cav ? 2 : (R.lowEnd ? 2 : 6), sp = cav ? 2.9 : tank ? 0 : 1.65 * (blk.comp || 1);
  const dyingK = !f.alive && f.dying > 0;
  for (let j = 0; j < m; j++) {
    const lx = tank || cav ? 0 : R.lowEnd ? 0 : (j < 3 ? -0.5 : 0.5) * sp * 1.1, ly = tank ? 0 : cav ? (j ? sp : -sp) : R.lowEnd ? (j ? sp / 2 : -sp / 2) : ((j % 3) - 1) * sp, x = f.x + c * lx - s * ly, z = f.y + s * lx + c * ly, y = b3H(tf, x, z);
    const h1 = hash2(blk.id * 131 + f.i, j, 11), h2 = hash2(blk.id * 131 + f.i, j, 13); _b3o.phase = h1; _b3o.h = (h2 - 0.5) * 0.12; _b3o.bright = (h1 * 7.3) % 1; _b3o.skin = (h2 * 4) | 0; _b3o.horse = (h1 * 4) | 0; _b3o.start = null;
    let yaw = Math.PI / 2 - blk.hd + (h1 - 0.5) * 0.12, clip;
    if (dyingK) { clip = tank ? 'destruido' : _b3Cl[(h2 * 4) | 0]; _b3o.start = tU - (0.8 - f.dying) * 1.5; }
    else { if (f.flee > 0) yaw = Math.atan2(f.vx, f.vy); clip = b3Clip(blk, f, era, cav); }
    set.add(d3(x, y, z), x, y, z, yaw, tank ? B3_S * 1.1 : B3_S, tag, clip, _b3o); b3Sh(S, x, y, z, tank ? 3.4 : cav ? 2.0 : 1.05);
  }
}
function b3Corpse(S, V, cpz, era, tU, ca) {
  if (cpz.kind === 'gun') return; const tag = cpz.tag || 'GEN', set = b3Set(S, 'fusilero', era, tag, null);
  for (let j = 0; j < (R.lowEnd ? 1 : 2); j++) { const x = cpz.x + (j ? 1.1 : 0), z = cpz.y + (j ? 0.7 : 0), y = b3H(S.tf, x, z), h1 = hash2(Math.round(cpz.x * 7), Math.round(cpz.y * 7), 3 + j), wounded = h1 < 0.3;
    _b3o.phase = h1; _b3o.h = 0; _b3o.bright = (h1 * 7.3) % 1; _b3o.skin = (h1 * 4) | 0; _b3o.horse = 0; _b3o.start = wounded ? null : tU - 10; set.add(Math.hypot(x - ca.x, y - ca.y, z - ca.z), x, y, z, Math.PI / 2 - (cpz.hd || 0), B3_S, tag, wounded ? 'herido' : _b3Cl[(h1 * 4) | 0], _b3o); b3Sh(S, x, y, z, 1.1); }
}

/* ---------- partículas ---------- */
function b3Parts(S, V) {
  const tf = S.tf, bg = S.sky;
  V.parts.forEach(p => { const k = clamp(p.age / p.life, 0, 1), y0 = b3H(tf, p.x, p.y);
    if (p.k === 'smoke') b3Push(S.smoke, p.x, y0 + 2.6 + p.age * 1.1, p.y, 0.88, 0.87, 0.84, 0.42 * (1 - k));
    else if (p.k === 'dust') b3Push(S.dust, p.x, y0 + 0.8 + p.age * 0.6, p.y, 0.72, 0.62, 0.46, 0.3 * (1 - k));
    else if (p.k === 'flash') b3Push(S.flash, p.x, y0 + 1.7, p.y, 1, 0.82, 0.4, 1 - k);
    else if (p.k === 'spark') b3Push(S.flash, p.x, y0 + 1 + k * (p.hot ? 3 : 7), p.y, p.hot ? 1 : 0.6, p.hot ? 0.65 : 1, p.hot ? 0.3 : 0.6, 0.9 * (1 - k));
    else if (p.k === 'boom') { b3Push(S.boom, p.x, y0 + 2 + k * 5, p.y, 1, 0.55 + 0.25 * (1 - k), 0.2, 0.9 * (1 - k)); b3Push(S.smoke, p.x, y0 + 4 + k * 9, p.y, 0.3, 0.28, 0.26, 0.5 * (1 - k)); }
    else if (p.k === 'shell') { const q = Math.min(1, k); b3Push(S.shell, p.x + (p.x2 - p.x) * q, b3H(tf, p.x2, p.y2) + 2 + Math.sin(q * 3.14) * 60, p.y + (p.y2 - p.y) * q, 0.12, 0.11, 0.1, 1); }
    else if (p.k === 'gas') b3Push(S.gas, p.x, y0 + 4, p.y, 0.72, 0.82, 0.22, 0.4 * Math.sin(Math.min(1, k) * 3.14));
    else if (p.k === 'splash') b3Push(S.dust, p.x, y0 + 1 + k * 3, p.y, 0.9, 0.95, 1, 0.5 * (1 - k)); });
  [S.smoke, S.dust, S.flash, S.boom, S.shell, S.gas].forEach(b3Flush);
  // lluvia: líneas alrededor del punto que mira la cámara
  const on = V.rain > 0; S.rain.visible = on;
  if (on) { const a = S.rain.geometry.attributes.position.array, c = B3.cam, t = V.t; for (let i = 0; i < 600; i++) { const x = c.tx + (hash2(i, 5, 9) - 0.5) * 900, z = c.tz + (hash2(i, 6, 9) - 0.5) * 600, y = 90 - ((hash2(i, 7, 9) * 90 + t * 160) % 90); a[i * 6] = x; a[i * 6 + 1] = y; a[i * 6 + 2] = z; a[i * 6 + 3] = x - 1; a[i * 6 + 4] = y - 5; a[i * 6 + 5] = z; } S.rain.geometry.attributes.position.needsUpdate = true; }
  // hora del día: el sol recorre el cielo y la luz se calienta al alba y al ocaso
  { const hr = V.hour || 12, L = bvLight(hr), ang = Math.PI * (clamp(hr, 6, 20) - 6) / 14; S.sun.position.set(-Math.cos(ang) * 700, Math.sin(ang) * 800 + 120, -350);
    S.sun.color.setRGB(1, 0.94 - 0.28 * L.warm, 0.85 - 0.5 * L.warm); S.sky.setRGB(0.66, 0.75, 0.81).lerp(_b3c.setRGB(0.85, 0.62, 0.45), L.warm * 0.6).multiplyScalar(0.45 + 0.55 * L.k); S.scene.background.copy(S.sky); S.scene.fog.color.copy(S.sky); S.hourK = L.k; }
  { const md = V.mud || 0; S.ground.material.color.setRGB(1 - 0.34 * md, 1 - 0.42 * md, 1 - 0.5 * md); }
  (S.tf.forests || []).forEach(f => { if (!f.fire) return; for (let i = 0; i < 7; i++) { const a = Math.random() * 6.28, d = Math.sqrt(Math.random()) * f.r * 0.85, x = f.x + Math.cos(a) * d, z = f.y + Math.sin(a) * d * 0.8, y = b3H(S.tf, x, z) + 3 + Math.random() * 7; b3Push(S.boom, x, y, z, 1, 0.5 + Math.random() * 0.3, 0.12, 0.55); } b3Push(S.boom, f.x, b3H(S.tf, f.x, f.y) + 6, f.y, 1, 0.45, 0.1, 0.35); });
  S.scene.fog.near = on ? 700 : 1500; S.scene.fog.far = on ? 2400 : 3600; S.amb.intensity = (on ? 0.5 : 0.62) * (0.55 + 0.45 * (S.hourK || 1)); S.hemi.intensity = (on ? 0.26 : 0.34) * (S.hourK || 1); S.sun.intensity = (on ? 0.55 : 0.88) * (S.hourK || 1);
}

/* ---------- cámara y dibujado ---------- */
function b3Camera(S, V, dt) {
  const c = B3.cam; if (V.follow && (V.sel || V.hover)) { const tg = V.sel || V.hover; c.tx += (tg.x - c.tx) * Math.min(1, dt * 4); c.tz += (tg.y - c.tz) * Math.min(1, dt * 4); c.d += (Math.min(c.d, 380) - c.d) * Math.min(1, dt * 3); }
  c.tx = clamp(c.tx, 0, BV_W); c.tz = clamp(c.tz, 0, BV_H); c.d = clamp(c.d, 25, 2600); c.pit = clamp(c.pit, 0.1, 1.5);
  const ty = b3H(S.tf, c.tx, c.tz), cp = Math.cos(c.pit), cam = S.cam;
  cam.position.set(c.tx + Math.sin(c.yaw) * cp * c.d, ty + Math.sin(c.pit) * c.d, c.tz + Math.cos(c.yaw) * cp * c.d); cam.lookAt(c.tx, ty, c.tz); cam.updateMatrixWorld();
}
const b3Ray = () => B3.ray || (B3.ray = new THREE.Raycaster());
// punto del suelo bajo una posición de pantalla (0..1)
function b3Pick(S, nx, ny) {
  const r = b3Ray(), v = new THREE.Vector2(nx * 2 - 1, -(ny * 2 - 1)); r.setFromCamera(v, S.cam); const o = r.ray.origin, d = r.ray.direction; if (d.y > -0.001) return null;
  let h = 0, x = 0, z = 0; for (let i = 0; i < 3; i++) { const t = (h - o.y) / d.y; x = o.x + d.x * t; z = o.z + d.z * t; h = b3H(S.tf, clamp(x, 0, BV_W), clamp(z, 0, BV_H)); }
  return [x, z];
}
function b3Frame(V, b, g, lines, all) {
  const S = B3.S && B3.S.bid === b.id && !B3.S.stale ? B3.S : (b3Dispose(B3.S), B3.S = b3Build(V, b));
  if (!R.t3) t3Init(); const sh = R.t3.shared, era = t3Era(), tU = performance.now() / 1000; sh.timeU.value = tU;
  const dt = Math.min(0.05, V.t - (B3.lt || V.t)) || 0.016; B3.lt = V.t;
  S.burnSigWant = V.burnSig || 0; if (S.burnSig !== S.burnSigWant) b3PlaceTrees(S);
  b3Camera(S, V, dt); b3Forts(S, b);
  Object.keys(S.sets).forEach(k => S.sets[k].begin()); S.shN = 0;
  { const fl = (S.tf.forests || []).map(f => f.burnt ? 2 : f.fire ? 1 : 0).join(''); if (fl !== S.floorSig) { S.floorSig = fl; b3Compose(S); } }
  const cp = S.cam.position, ca = {x: cp.x, y: cp.y, z: cp.z};
  const vis = all.filter(k => !(typeof tacHidden === 'function' && tacHidden(b, k)) && (typeof bvSeen !== 'function' || bvSeen(V, b, k)));
  vis.forEach(blk => blk.figs.forEach(f => { if (f.alive || f.dying > 0) b3Fig(S, V, blk, f, era, tU, null, ca); }));
  V.ghosts.forEach(blk => blk.figs.forEach(f => { if (f.alive || f.dying > 0) b3Fig(S, V, blk, f, era, tU, null, ca); }));
  V.corpses.forEach(c => b3Corpse(S, V, c, era, tU, ca));
  // estandartes y placas
  let n = 0; const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p3 = new THREE.Vector3(), s3 = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), col = new THREE.Color();
  vis.forEach(blk => { if (n >= 220) return; const y = b3H(S.tf, blk.x, blk.y), yaw = Math.PI / 2 - blk.hd;
    q.setFromAxisAngle(up, yaw + Math.PI / 2); p3.set(blk.x, y, blk.y); s3.set(1, 1, 1); m4.compose(p3, q, s3); S.poles.setMatrixAt(n, m4); S.flags.setMatrixAt(n, m4); S.flags2.setMatrixAt(n, m4); col.set(blk.color); S.flags.setColorAt(n, col); S.flags2.setColorAt(n, blk.side === 'A' ? S.mats.A : S.mats.B);
    q.setFromAxisAngle(up, yaw); p3.set(blk.x, y + 0.25, blk.y); s3.set(blk.wid + 2, 1, blk.dep + 2); m4.compose(p3, q, s3); S.plates.setMatrixAt(n, m4); S.plates.setColorAt(n, blk.side === 'A' ? S.mats.A : S.mats.B); n++; });
  S.sh.count = S.shN; S.sh.instanceMatrix.needsUpdate = true;
  [S.poles, S.flags, S.flags2, S.plates].forEach(m => { m.count = n; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; });
  const sel = V.sel && V.blocks.has(V.sel.d) ? V.sel : null; S.ring.visible = !!sel; if (sel) { const r = Math.max(sel.dep, sel.wid) / 2 + 7; S.ring.position.set(sel.x, b3H(S.tf, sel.x, sel.y) + 0.6, sel.y); S.ring.scale.set(r, 1, r); S.ring.material.opacity = 0.6 + 0.4 * Math.sin(V.t * 5); }
  b3Parts(S, V);
  // dibujado con el renderizador del mapa en la esquina de su lienzo y copia al lienzo del visor
  const r = R.renderer, dom = r.domElement, pr = r.getPixelRatio(), cssW = dom.width / pr, cssH = dom.height / pr;
  let vw = Math.min(R.lowEnd ? 960 : 1440, cssW), vh = vw * BV_H / BV_W; if (vh > cssH) { vh = cssH; vw = vh * BV_W / BV_H; } vw = Math.floor(vw); vh = Math.floor(vh);
  const vp = r.getViewport(new THREE.Vector4()); r.setScissorTest(false); r.setViewport(0, 0, vw, vh); S.cam.aspect = vw / vh; S.cam.updateProjectionMatrix();
  r.render(S.scene, S.cam);
  const pw = Math.round(vw * pr), ph = Math.round(vh * pr);
  g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(dom, 0, dom.height - ph, pw, ph, 0, 0, BV_W, BV_H);
  r.setViewport(vp); r.clear();
  // HUD del visor 2D encima; la ficha del bloque bajo el ratón se coloca donde lo proyecta la cámara 3D
  const keep = {x: V.cam.x, y: V.cam.y, z: V.cam.z}, h = V.hover; if (h) { const v = new THREE.Vector3(h.x, b3H(S.tf, h.x, h.y) + 3, h.y).project(S.cam), sx = (v.x * 0.5 + 0.5) * BV_W, sy = (-v.y * 0.5 + 0.5) * BV_H; V.cam.z = 1; V.cam.x = h.x + BV_W / 2 - sx; V.cam.y = h.y + BV_H / 2 - sy; }
  g.save(); g.scale(BV_W / 960, BV_H / 420); bvOverlay(V, b, g, lines, all); g.restore(); V.cam.x = keep.x; V.cam.y = keep.y; V.cam.z = keep.z;
  if (typeof rl3Badge === 'function') rl3Badge(g, V, b);
  g.save(); g.font = '12px sans-serif'; g.textAlign = 'left'; g.fillStyle = 'rgba(8,12,16,.7)'; g.fillRect(8, BV_H - 26, 560, 20); g.fillStyle = '#d9d2bc'; g.fillText('🧊 Vista 3D · arrastrar: mover · botón derecho o Mayús: girar · rueda: zoom · doble clic: vista completa', 14, BV_H - 12); g.restore();
}
// el dibujado 2D se sustituye por el 3D (con respaldo si algo falla)
const _b3Draw = bvDraw;
bvDraw = function (V, b, g, lines, all) {
  B3.active = false;
  if (b3On()) {
    try { B3.active = true; b3Frame(V, b, g, lines, all); return; }
    catch (e) { console.warn('Visor de batalla 3D desactivado por un error; vuelve el visor 2D.', e); R.b3Dead = true; B3.active = false; try { b3Dispose(B3.S); } catch (e2) { } B3.S = null; try { toast('⚠️', 'La vista 3D de batalla no está disponible en este equipo; se usa la vista 2D.'); } catch (e3) { } try { R.renderer.setScissorTest(false); } catch (e4) { } }
  }
  return _b3Draw(V, b, g, lines, all);
};
// con la vista 3D el «ratón» del visor 2D se calcula a partir del punto del suelo señalado
const _b3Hover = bvHover;
bvHover = function (V, all) {
  if (b3On() && B3.S) { const w = B3.hoverW; V.mouse = w ? {x: (w[0] - V.cam.x) * V.cam.z + BV_W / 2, y: (w[1] - V.cam.y) * V.cam.z + BV_H / 2} : null; }
  return _b3Hover(V, all);
};
/* ---------- ratón ---------- */
function b3Bind(cv) {
  const nrm = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height]; }, cssH = () => cv.getBoundingClientRect().height || 1;
  const pan = (dx, dy) => { const c = B3.cam, k = 2 * c.d * Math.tan(20 * Math.PI / 180) / cssH(), fx = -Math.sin(c.yaw), fz = -Math.cos(c.yaw), rx = Math.cos(c.yaw), rz = -Math.sin(c.yaw), sp = Math.sin(c.pit); c.tx += -dx * rx * k + dy * fx * k / sp; c.tz += -dx * rz * k + dy * fz * k / sp; };
  cv.addEventListener('mousedown', e => { if (!B3.active) return; e.stopImmediatePropagation(); B3.drag = {x: e.clientX, y: e.clientY, moved: 0, rot: e.button === 2 || e.shiftKey, btn: e.button}; }, true);
  cv.addEventListener('mousemove', e => {
    if (!B3.active || !B3.S) return; e.stopImmediatePropagation(); const d = B3.drag;
    if (d) { const dx = e.clientX - d.x, dy = e.clientY - d.y; d.moved += Math.abs(dx) + Math.abs(dy); d.x = e.clientX; d.y = e.clientY; if (d.rot) { B3.cam.yaw -= dx * 0.006; B3.cam.pit += dy * 0.004; } else pan(dx, dy); if (R.bviz) R.bviz.follow = false; }
    else { const [nx, ny] = nrm(e); B3.hoverW = b3Pick(B3.S, nx, ny); }
  }, true);
  cv.addEventListener('mouseleave', e => { if (B3.active) { B3.hoverW = null; } }, true);
  window.addEventListener('mouseup', e => { const d = B3.drag; if (!d) return; B3.drag = null; if (!B3.active || !B3.S) return; if (d.moved < 4 && d.btn === 0 && !d.rot) { const V = R.bviz; if (V) { const [nx, ny] = nrm(e); B3.hoverW = b3Pick(B3.S, nx, ny); V.mouse = B3.hoverW ? {x: (B3.hoverW[0] - V.cam.x) * V.cam.z + BV_W / 2, y: (B3.hoverW[1] - V.cam.y) * V.cam.z + BV_H / 2} : null; bvHover(V, [...V.blocks.values()]); bvClick(V); } } else if (d.moved >= 4) B3.noCtx = true; });
  cv.addEventListener('contextmenu', e => { if (B3.active && B3.noCtx) { B3.noCtx = false; e.stopImmediatePropagation(); } }, true);
  cv.addEventListener('wheel', e => { if (!B3.active) return; e.preventDefault(); e.stopImmediatePropagation(); B3.cam.d *= Math.exp(e.deltaY * 0.0013); if (R.bviz) R.bviz.follow = false; }, {capture: true, passive: false});
  cv.addEventListener('dblclick', e => { if (!B3.active) return; e.stopImmediatePropagation(); b3Reset(); }, true);
}
function b3Reset() { const V = R.bviz; Object.assign(B3.cam, {tx: BV_W / 2 + (V ? V.adv * 100 : 0), tz: BV_H / 2, d: 900, yaw: 0, pit: 0.82}); if (V) V.follow = false; }
const _b3Bind = bvBind;
bvBind = function (cv) { if (!cv._b3) { cv._b3 = true; b3Bind(cv); } return _b3Bind(cv); };
// botones del visor
const _b3Zoom = ACT.bvzoom, _b3Reset = ACT.bvreset;
ACT.bvzoom = function (d) { if (B3.active) { B3.cam.d = clamp(B3.cam.d * (+d.d > 0 ? 0.7 : 1 / 0.7), 35, 2600); if (R.bviz) R.bviz.follow = false; return; } return _b3Zoom(d); };
ACT.bvreset = function (d) { if (B3.active) { b3Reset(); return; } return _b3Reset(d); };
ACT.bv3d = function () {
  if (!b3Usable()) { toast('⚠️', 'La vista 3D de batalla necesita un equipo con WebGL 2 (el mismo requisito que las tropas 3D).'); return; }
  R.b3Dead = false; R.bv3d = !b3On(); try { localStorage.setItem('victoria-bv3d', R.bv3d ? '1' : '0'); } catch (e) { }
  if (R.bv3d) b3Reset(); renderBattlePanel();
};
// al cambiar de batalla o cerrar el panel se libera la escena 3D (geometrías y texturas)
setInterval(() => { if (B3.S && (!UI.battle || (R.bviz && R.bviz.id !== B3.S.bid))) { b3Dispose(B3.S); B3.S = null; B3.hoverW = null; B3.active = false; if (R.dirty !== undefined) R.dirty = true; } }, 1500);
