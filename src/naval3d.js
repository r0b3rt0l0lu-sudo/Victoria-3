/* ===== BATALLA NAVAL EN 3D =====
   Misma batalla que el visor 2D (navalviz.js: posiciones, daños, disparos y hundimientos), pero con el mar en 3D y buques modelados:
   veleros con aparejo, vapores, acorazados con torretas, destructores, portaaviones con cubierta de vuelo, submarinos… Los cascos llevan la franja y la bandera de su país.
   Se dibuja con el renderizador del mapa en una esquina y se copia al lienzo del panel (igual que el visor 3D de tierra); el HUD 2D va encima.
   Cámara: arrastrar = girar · botón derecho = mover · rueda = zoom · doble clic = vista inicial. Se activa con el botón «Vista 3D» (comparte opción con la batalla terrestre). */
const N3 = {S: null, active: false, cam: {yaw: 0, pit: 0.3, d: 300, tx: 0, tz: 0}, drag: null, lt: 0, auto: true};
const N3_Z = 3.6, N3_Z0 = 170;               // y del visor 2D → profundidad (z) del mundo 3D
const n3W = (x, y) => [x - NV_W / 2, (y - N3_Z0) * N3_Z];
function n3Mat(c, o) { return new THREE.MeshStandardMaterial(Object.assign({color: c, roughness: 0.75, metalness: 0.15}, o || {})); }
function n3Shared() {
  if (N3.M) return N3.M;
  const bm = (c, o) => new THREE.MeshBasicMaterial(Object.assign({color: c}, o || {}));
  return N3.M = {hull: n3Mat(0x59626b), hullDk: n3Mat(0x2f353b), deck: n3Mat(0x6a6f72), deckDk: n3Mat(0x3a4046), wood: n3Mat(0x5a4330, {roughness: .9}), woodLt: n3Mat(0x8a6a48, {roughness: .9}), sail: n3Mat(0xefe6cf, {roughness: 1, side: THREE.DoubleSide}), funnel: n3Mat(0x232327), steel: n3Mat(0x7d868e, {metalness: .4}), black: n3Mat(0x151518), sub: n3Mat(0x2b3338, {roughness: .5}), white: bm(0xffffff, {transparent: true, opacity: .32, depthWrite: false, side: THREE.DoubleSide}), plane: n3Mat(0x8d949a), lineW: bm(0xf0f0f0)};
}
const n3Stripe = {};
function n3StripeMat(col) { return n3Stripe[col] || (n3Stripe[col] = new THREE.MeshBasicMaterial({color: col})); }
function n3Hull(L, H, W, sharp) {                 // casco visto desde arriba (proa en +x) extruido a lo alto
  const sh = new THREE.Shape(), hw = W / 2, b = L / 2, bs = sharp || 0.25;
  sh.moveTo(-b, -hw * 0.78); sh.lineTo(-b * 0.55, -hw); sh.lineTo(b * (1 - bs * 2), -hw); sh.quadraticCurveTo(b * 0.95, -hw * 0.6, b, 0); sh.quadraticCurveTo(b * 0.95, hw * 0.6, b * (1 - bs * 2), hw); sh.lineTo(-b * 0.55, hw); sh.lineTo(-b, hw * 0.78); sh.lineTo(-b, -hw * 0.78);
  const g = new THREE.ExtrudeGeometry(sh, {depth: H, bevelEnabled: false, curveSegments: 6}); g.rotateX(-Math.PI / 2); g.translate(0, -H * 0.38, 0); return g;
}
const n3Box = (w, h, d, m, x, y, z, parent) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); parent.add(o); return o; };
const n3Cyl = (r0, r1, h, m, x, y, z, parent, seg) => { const o = new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, h, seg || 8), m); o.position.set(x, y, z); parent.add(o); return o; };
function n3Gun(g, M, x, y, L, big, dirSign) {       // torreta con cañones (la proa mira a +x)
  const t = new THREE.Group(); t.position.set(x, y, 0); g.add(t); const w = L * 0.075 * (big ? 1.25 : 1);
  n3Box(w * 1.5, w * 0.7, w * 1.5, M.steel, 0, w * 0.35, 0, t);
  const nb = big ? 3 : 2; for (let i = 0; i < nb; i++) { const bz = (i - (nb - 1) / 2) * w * 0.5, br = n3Cyl(w * 0.1, w * 0.12, L * 0.17 * (big ? 1.15 : 0.8), M.black, 0, 0, 0, t, 6); br.rotation.z = Math.PI / 2; br.position.set(w * 0.75 + L * 0.07, w * 0.45, bz); }
  t.userData.gun = true; return t;
}
function n3Ship(type, color) {
  const M = n3Shared(), st = NV_STYLE[type] || NV_STYLE.sail, L = st.len, H = Math.max(5, st.h * 0.75), grp = new THREE.Group(), body = new THREE.Group(); grp.add(body); grp.userData.body = body;
  const stripe = n3StripeMat(color), isSub = !!st.sub, isCar = !!st.deck, isSail = type === 'sail';
  if (isSub) {
    const r = Math.max(3, st.h * 0.62), cyl = new THREE.Mesh(new THREE.CylinderGeometry(r, r, L * 0.86, 12), M.sub); cyl.rotation.z = Math.PI / 2; cyl.position.y = -r * 0.45; body.add(cyl);
    [-1, 1].forEach(sg => { const e = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 8), M.sub); e.scale.set(1.7, 1, 1); e.position.set(sg * L * 0.43, -r * 0.45, 0); body.add(e); });
    n3Box(L * 0.12, r * 1.3, r * 0.7, M.sub, L * 0.06, r * 0.8, 0, body); n3Cyl(0.35, 0.35, r * 1.2, M.black, L * 0.09, r * 1.9, 0, body, 5);
    const band = n3Box(L * 0.5, 0.5, r * 0.4, stripe, -L * 0.1, r * 0.55, 0, body); band.visible = false; grp.userData.top = r * 1.9; return grp;
  }
  const hull = new THREE.Mesh(n3Hull(L, H, L * (isCar ? 0.2 : st.len < 60 ? 0.14 : 0.17)), isSail ? M.wood : M.hull); body.add(hull);
  const band = new THREE.Mesh(n3Hull(L * 1.002, H * 0.14, L * (isCar ? 0.2 : st.len < 60 ? 0.14 : 0.17) * 1.01), stripe); band.position.y = H * 0.5; body.add(band);
  const top = H * 0.62;
  if (isSail) {
    n3Box(L * 0.55, 1.8, L * 0.1, M.woodLt, -L * 0.1, top + 0.3, 0, body); n3Box(L * 0.18, 3.2, L * 0.12, M.wood, -L * 0.4, top + 1.6, 0, body);
    const bs = n3Cyl(0.4, 0.5, L * 0.3, M.wood, L * 0.52, top + 1.6, 0, body, 5); bs.rotation.z = -1.25;
    for (let k = 0; k < 3; k++) { const mx = -L * 0.3 + k * L * 0.27, mh = L * (k === 1 ? 0.62 : 0.52); n3Cyl(0.55, 0.8, mh, M.wood, mx, top + mh / 2, 0, body, 6);
      for (let j = 0; j < 3; j++) { const sy = top + mh * (0.32 + j * 0.24), sw = L * (0.26 - j * 0.05), sl = new THREE.Mesh(new THREE.PlaneGeometry(sw, mh * 0.2, 4, 3), M.sail); sl.rotation.y = Math.PI / 2; sl.position.set(mx + 0.4, sy, 0); sl.userData.sail = true; body.add(sl); n3Cyl(0.25, 0.25, sw * 1.05, M.wood, mx, sy + mh * 0.1, 0, body, 4).rotation.x = Math.PI / 2; } }
    grp.userData.top = top + L * 0.62; grp.userData.flag = [-L * 0.3 + L * 0.27, top + L * 0.62 + 1]; return grp;
  }
  // buque de vapor / de guerra
  const W = L * (isCar ? 0.2 : st.len < 60 ? 0.14 : 0.17);
  if (isCar) {
    n3Box(L * 0.98, H * 0.18, W * 1.22, M.deckDk, -L * 0.01, top + 0.1, 0, body); n3Box(L * 0.9, 0.12, 0.8, M.lineW, 0, top + H * 0.2, 0, body);
    n3Box(L * 0.12, H * 1.1, W * 0.24, M.hull, L * 0.12, top + H * 0.75, W * 0.5, body); n3Cyl(0.5, 0.5, H * 0.9, M.steel, L * 0.12, top + H * 1.7, W * 0.5, body, 5);
    for (let i = 0; i < 9; i++) { const pl = n3Box(L * 0.05, 0.5, L * 0.06, M.plane, -L * 0.42 + i * L * 0.05, top + H * 0.3, (i % 3 - 1) * W * 0.28, body); pl.rotation.y = (i % 2) * 0.3; n3Box(0.5, 0.25, L * 0.075, M.plane, pl.position.x, top + H * 0.33, pl.position.z, body); }
    grp.userData.top = top + H * 2.2; grp.userData.flag = [L * 0.12, top + H * 2.3]; return grp;
  }
  n3Box(L * 0.2, H * 0.55, W * 0.62, M.hull, -L * 0.05, top + H * 0.28, 0, body); n3Box(L * 0.11, H * 0.4, W * 0.42, M.hullDk, -L * 0.04, top + H * 0.75, 0, body);
  let mastTop = top + H * 1.1;
  if (st.mast || st.len > 60) { const mh = H * (st.mast ? 2.6 : 2.1); n3Cyl(0.3, 0.45, mh, M.steel, L * 0.02, top + H * 0.9 + mh / 2, 0, body, 5); mastTop = top + H * 0.9 + mh; if (st.mast) n3Box(0.5, 0.4, W * 0.6, M.steel, L * 0.02, mastTop - H * 0.5, 0, body); }
  for (let k = 0; k < (st.funnels || 0); k++) n3Cyl(W * 0.13, W * 0.17, H * 1.3, M.funnel, -L * 0.17 - k * L * 0.12 + (st.funnels > 1 ? L * 0.1 : 0), top + H * 0.95, 0, body, 8);
  if (type === 'steam') { n3Cyl(0.45, 0.6, H * 3.6, M.wood, L * 0.12, top + H * 1.8, 0, body, 5); n3Cyl(0.45, 0.6, H * 2.8, M.wood, -L * 0.3, top + H * 1.4, 0, body, 5); mastTop = top + H * 3.6; }
  const nt = st.turret || 0, big = L > 80; for (let k = 0; k < nt; k++) { const fore = k % 2 === 0, idx = Math.floor(k / 2), x = fore ? L * (0.3 - idx * 0.11) : -L * (0.3 - idx * 0.1), gm = n3Gun(body, M, x, top + (k > 1 && big ? H * 0.22 : 0), L, big, 1); if (!fore) gm.rotation.y = Math.PI; }
  grp.userData.top = mastTop; grp.userData.flag = [L * 0.02, mastTop + 0.5]; return grp;
}
function n3Wake(L) { const sh = new THREE.Shape(); sh.moveTo(0, -L * 0.07); sh.lineTo(-L * 0.75, -L * 0.17); sh.lineTo(-L * 0.75, L * 0.17); sh.lineTo(0, L * 0.07); const g = new THREE.ShapeGeometry(sh); g.rotateX(-Math.PI / 2); const m = new THREE.Mesh(g, n3Shared().white); m.position.set(-L * 0.35, 0.35, 0); return m; }
function n3Build(V) {
  const S = {scene: new THREE.Scene(), ships: new Map(), parts: [], seed: V.z * 97 + 13};
  const mood = S.seed % 3, skyC = [0xa9c6dc, 0xb8b9bb, 0xe3b384][mood], fogC = [0xcbdde8, 0xc3c6c8, 0xe9c9a3][mood];
  S.scene.background = new THREE.Color(skyC); S.scene.fog = new THREE.Fog(fogC, 350, 1750);
  S.sun = new THREE.DirectionalLight(mood === 2 ? 0xffc890 : 0xfff3dc, mood === 1 ? 0.55 : 0.95); S.sun.position.set(-400, mood === 2 ? 170 : 520, -380); S.scene.add(S.sun, new THREE.AmbientLight(0xffffff, 0.55), new THREE.HemisphereLight(0xd6e8ff, 0x1d4a66, 0.4));
  S.cam = new THREE.PerspectiveCamera(42, NV_W / NV_H, 1, 7000);
  const seg = 72, geo = new THREE.PlaneGeometry(3600, 3600, seg, seg); geo.rotateX(-Math.PI / 2); S.seaGeo = geo; S.seaBase = Float32Array.from(geo.attributes.position.array);
  S.sea = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({color: 0x1f5c7d, roughness: 0.55, metalness: 0.04, flatShading: false})); S.scene.add(S.sea);
  const cv = document.createElement('canvas'); cv.width = 8; cv.height = 128; const g = cv.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 128); gr.addColorStop(0, '#' + skyC.toString(16).padStart(6, '0')); gr.addColorStop(1, '#' + fogC.toString(16).padStart(6, '0')); g.fillStyle = gr; g.fillRect(0, 0, 8, 128);
  S.skyTex = new THREE.CanvasTexture(cv); S.scene.background = S.skyTex;
  const tex = (typeof b3SoftTex === 'function') ? b3SoftTex() : null; S.tex = tex;
  S.P = {smoke: b3Points(500, 15, false, tex), fire: b3Points(200, 10, true, tex), flash: b3Points(200, 14, true, tex), boom: b3Points(100, 34, true, tex), splash: b3Points(400, 6, false, tex), shell: b3Points(60, 3.4, false, tex), debris: b3Points(200, 4, false, tex)};
  Object.values(S.P).forEach(p => S.scene.add(p));
  return S;
}
function n3Dispose(S) { if (!S) return; S.scene.traverse(o => { if (o.geometry) o.geometry.dispose(); }); }
function n3Wave(x, z, t) { return Math.sin(x * 0.021 + t * 0.9) * 1.1 + Math.sin(z * 0.017 - t * 0.7 + 1.3) * 0.9 + Math.sin((x + z) * 0.045 + t * 1.6) * 0.35; }
function n3Sea(S, t) {
  const p = S.seaGeo.attributes.position, a = p.array, b = S.seaBase; for (let i = 0; i < a.length; i += 3) a[i + 1] = n3Wave(b[i], b[i + 2], t);
  p.needsUpdate = true; S.seaGeo.computeVertexNormals();
}
function n3Near(V, x, y) { let b = null, bd = 1e9; V.ships.forEach(s => { const d = (s.x - x) * (s.x - x) + (s.y - y) * (s.y - y) * 0.4; if (d < bd) { bd = d; b = s; } }); return b; }
// cada partícula del visor 2D se convierte en una 3D colocada respecto al buque más cercano
function n3Spawn(V, p) {
  const S = N3.S; if (!S || S.parts.length > 900) return; const near = n3Near(V, p.x, p.y), r = () => Math.random() - 0.5;
  const [wx] = n3W(p.x, 0), wz0 = near ? n3W(0, near.y)[1] : 0, h0 = near ? Math.max(0, near.y - p.y) * 0.9 : 3;
  if (p.k === 'shell') { const tg = n3Near(V, p.x2, p.y2); S.parts.push({k: 'shell', x: wx, y: h0 + 4, z: wz0, tx: n3W(p.x2, 0)[0], tz: (tg ? n3W(0, tg.y)[1] : wz0) + r() * 50, life: p.life, hit: p.hit, age: 0}); return; }
  if (p.k === 'splash') { const tg = n3Near(V, p.x, p.y); for (let i = 0; i < 9; i++) S.parts.push({k: 'splash', x: wx + r() * 6, y: 0.5, z: (tg ? n3W(0, tg.y)[1] : wz0) + r() * 40, vx: r() * 8, vy: 14 + Math.random() * 12, vz: r() * 8, life: 0.9, age: 0}); return; }
  if (p.k === 'boom') { S.parts.push({k: 'boom', x: wx, y: Math.max(3, h0), z: wz0 + r() * 4, life: 0.6, age: 0}); return; }
  if (p.k === 'flash') { S.parts.push({k: 'flash', x: wx, y: Math.max(4, h0), z: wz0 + r() * 6, life: 0.14, age: 0}); return; }
  if (p.k === 'fire') { S.parts.push({k: 'fire', x: wx, y: Math.max(3, h0), z: wz0 + r() * 8, vy: 6, life: 0.7, age: 0}); return; }
  if (p.k === 'smoke') S.parts.push({k: 'smoke', x: wx, y: Math.max(3, h0), z: wz0 + r() * 6, vx: (p.vx || 0) * 0.6, vy: 5 + Math.random() * 3, vz: r() * 2, dark: p.dark, life: (p.life || 2) * 1.6, age: 0});
}
const _nvPart3 = nvPart;
nvPart = function (V, p) { _nvPart3(V, p); if (N3.active && N3.S) n3Spawn(V, p); };
function n3Sync(S, V, dt, t) {
  V.ships.forEach(s => {
    let m = S.ships.get(s.id);
    if (!m) { m = {g: new THREE.Group(), model: n3Ship(s.t, s.color), sunkDone: false, flagM: null}; m.g.add(m.model); m.g.add(n3Wake(NV_STYLE[s.t] ? NV_STYLE[s.t].len : 50)); S.ships.set(s.id, m); S.scene.add(m.g); n3Flag(m, s); if (s.sink < 0) m.g.rotation.y = s.dir > 0 ? 0 : Math.PI; }
    const [wx, wz] = n3W(s.x, s.y), y = n3Wave(wx, wz, t), ph = s.ph, sk = s.sink >= 0 ? s.sink : 0, d = s.dir, isSub = !!(NV_STYLE[s.t] && NV_STYLE[s.t].sub);
    m.g.position.set(wx, y - (isSub ? 1.2 : 0) - (sk > 0 ? sk * sk * 4 + sk * 3 : 0), wz); m.g.rotation.y = d > 0 ? 0 : Math.PI;
    m.g.rotation.z = Math.sin(t * 1.1 + ph) * 0.03 + (sk > 0 ? Math.min(1.25, sk * 0.5) * d * (isSub ? 0 : 1) : 0);          // balanceo y escora al hundirse
    m.g.rotation.x = Math.sin(t * 0.8 + ph * 1.7) * 0.02; m.g.visible = sk < 3.3;
    const wk = m.g.children[1]; if (wk) { wk.visible = sk === 0 && !isSub; wk.material.opacity = 0.2; }
    const body = m.model.userData.body; if (body) body.children.forEach(o => { if (o.userData.sail) o.rotation.z = Math.sin(t * 1.3 + ph) * 0.05; });
    if (s.sink > 0 && !m.sunkDone) { m.sunkDone = true; for (let i = 0; i < 30; i++) S.parts.push({k: 'debris', x: wx + (Math.random() - .5) * 60, y: 2, z: wz + (Math.random() - .5) * 20, vx: (Math.random() - .5) * 30, vy: 12 + Math.random() * 25, vz: (Math.random() - .5) * 20, life: 1.8, age: 0}); S.parts.push({k: 'boom', x: wx, y: 6, z: wz, life: 0.8, age: 0}); }
  });
  S.ships.forEach((m, id) => { if (!V.ships.has(id)) { S.scene.remove(m.g); S.ships.delete(id); } });
}
function n3Flag(m, s) {
  const fp = m.model.userData.flag, tag = s.tag; if (!fp || !G.C[tag]) return;
  let tex = null; try { tex = typeof b3FlagTex === 'function' ? b3FlagTex(tag) : null; } catch (e) { }
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 7, 4), n3Shared().lineW); pole.position.set(fp[0], fp[1] + 3, 0);
  const fl = new THREE.Mesh(new THREE.PlaneGeometry(7.5, 5, 6, 1), new THREE.MeshBasicMaterial(tex ? {map: tex, side: THREE.DoubleSide} : {color: s.color, side: THREE.DoubleSide})); fl.position.set(fp[0] - 3.9, fp[1] + 5.4, 0); fl.rotation.y = 0;
  m.model.add(pole, fl); m.flagM = fl;
}
function n3Parts(S, V, dt) {
  const P = S.P, sm = new THREE.Color(), fogC = S.scene.fog.color;
  for (let i = S.parts.length - 1; i >= 0; i--) {
    const p = S.parts[i]; p.age += dt; if (p.age >= p.life) { S.parts.splice(i, 1); continue; } const q = p.age / p.life;
    if (p.k === 'shell') { const x = p.x + (p.tx - p.x) * q, z = p.z + (p.tz - p.z) * q, y = p.y * (1 - q) + Math.sin(q * Math.PI) * 60; b3Push(P.shell, x, y, z, 0.07, 0.07, 0.08, 1); if (q > 0.97 && !p.d) { p.d = 1; if (p.hit) S.parts.push({k: 'boom', x: p.tx, y: 5, z: p.tz, life: 0.5, age: 0}); else for (let j = 0; j < 8; j++) S.parts.push({k: 'splash', x: p.tx + (Math.random() - .5) * 4, y: 0.5, z: p.tz, vx: (Math.random() - .5) * 8, vy: 16 + Math.random() * 12, vz: (Math.random() - .5) * 8, life: 0.9, age: 0}); } continue; }
    if (p.vx !== undefined) { p.x += p.vx * dt; p.z += (p.vz || 0) * dt; p.y += p.vy * dt; if (p.k === 'splash' || p.k === 'debris') p.vy -= 55 * dt; }
    if (p.k === 'smoke') { const v = p.dark ? 0.1 : 0.72; b3Push(P.smoke, p.x, p.y, p.z, v, v, v, 0.5 * (1 - q) * Math.min(1, q * 6)); }
    else if (p.k === 'fire') b3Push(P.fire, p.x, p.y + q * 6, p.z, 1, 0.55 + 0.3 * (1 - q), 0.15, 0.9 * (1 - q));
    else if (p.k === 'flash') b3Push(P.flash, p.x, p.y, p.z, 1, 0.9, 0.55, 1 - q);
    else if (p.k === 'boom') { b3Push(P.boom, p.x, p.y + q * 8, p.z, 1, 0.6 + 0.2 * (1 - q), 0.15, 0.95 * (1 - q)); if (!p.s) { p.s = 1; for (let j = 0; j < 3; j++) S.parts.push({k: 'smoke', x: p.x, y: p.y, z: p.z, vx: (Math.random() - .5) * 4, vy: 6, vz: (Math.random() - .5) * 4, dark: 1, life: 3, age: 0}); } }
    else if (p.k === 'splash') { if (p.y < 0.3 && p.vy < 0) { S.parts.splice(i, 1); continue; } b3Push(P.splash, p.x, Math.max(0.4, p.y), p.z, 0.95, 0.98, 1, 0.8 * (1 - q)); }
    else if (p.k === 'debris') b3Push(P.debris, p.x, Math.max(0, p.y), p.z, 0.36, 0.27, 0.18, 1 - q * 0.6);
  }
  Object.values(P).forEach(b3Flush);
}
function n3Camera(S, V, dt) {
  const c = N3.cam; if (N3.auto && !N3.drag && !N3.user) c.yaw = 0.32 * Math.sin(performance.now() / 1000 * 0.09);
  // se centra en los buques vivos
  let sx = 0, sz = 0, n = 0, span = 0; V.ships.forEach(s => { if (s.sink >= 0) return; const [x, z] = n3W(s.x, s.y); sx += x; sz += z; n++; }); if (n) { sx /= n; sz /= n; V.ships.forEach(s => { if (s.sink < 0) { const [x, z] = n3W(s.x, s.y); span = Math.max(span, Math.hypot(x - sx, z - sz)); } }); }
  if (!N3.user) { c.tx += (sx - c.tx) * Math.min(1, dt * 1.5); c.tz += (sz - c.tz) * Math.min(1, dt * 1.5); const want = clamp(110 + span * 1.05, 170, 900); if (!N3.zoomed) c.d += (want - c.d) * Math.min(1, dt * 1.2); }
  const cp = Math.cos(c.pit), sp = Math.sin(c.pit), ty = 8; S.cam.position.set(c.tx + Math.sin(c.yaw) * c.d * cp, ty + c.d * sp, c.tz + Math.cos(c.yaw) * c.d * cp); S.cam.lookAt(c.tx, ty, c.tz);
  if (S.cam.position.y < 6) S.cam.position.y = 6;
}
function n3Frame(V, r, g, dt) {
  if (!N3.S || N3.S.z !== r.z) { n3Dispose(N3.S); N3.S = n3Build(V); N3.S.z = r.z; N3.cam.tx = N3.cam.tz = 0; N3.user = false; N3.zoomed = false; }
  const S = N3.S, t = performance.now() / 1000;
  n3Sea(S, t); n3Sync(S, V, dt, t); n3Parts(S, V, dt); n3Camera(S, V, dt);
  const rd = R.renderer, dom = rd.domElement, pr = rd.getPixelRatio(), cssW = dom.width / pr, cssH = dom.height / pr;
  let vw = Math.min(R.lowEnd ? 960 : 1440, cssW), vh = vw * NV_H / NV_W; if (vh > cssH) { vh = cssH; vw = vh * NV_W / NV_H; } vw = Math.floor(vw); vh = Math.floor(vh);
  const vp = rd.getViewport(new THREE.Vector4()); rd.setScissorTest(false); rd.setViewport(0, 0, vw, vh); S.cam.aspect = vw / vh; S.cam.updateProjectionMatrix(); rd.render(S.scene, S.cam);
  const pw = Math.round(vw * pr), ph = Math.round(vh * pr); const k = g.canvas.width / NV_W; g.setTransform(k, 0, 0, k, 0, 0); g.drawImage(dom, 0, dom.height - ph, pw, ph, 0, 0, NV_W, NV_H); rd.setViewport(vp); rd.clear();
  nvHud(V, r, g);
  g.save(); g.font = '11px sans-serif'; g.textAlign = 'left'; g.fillStyle = 'rgba(8,12,16,.7)'; g.fillRect(6, NV_H - 22, 420, 17); g.fillStyle = '#d9d2bc'; g.fillText('🧊 Vista 3D · arrastrar: girar · botón derecho: mover · rueda: zoom · doble clic: restablecer', 10, NV_H - 10); g.restore();
}
function n3On() { return typeof b3On === 'function' && b3On() && !N3.dead; }
const _nvDraw3 = nvDraw;
nvDraw = function (V, r, g) {
  N3.active = false;
  if (n3On()) {
    try { const dt = Math.min(0.05, V.t - (N3.lt || V.t)) || 0.016; N3.lt = V.t; N3.active = true; n3Frame(V, r, g, dt); return; }
    catch (e) { console.warn('Vista naval 3D desactivada por un error; vuelve la vista 2D.', e); N3.dead = true; N3.active = false; try { n3Dispose(N3.S); } catch (e2) { } N3.S = null; try { toast('⚠️', 'La vista naval 3D no está disponible en este equipo; se usa la vista 2D.'); } catch (e3) { } }
  }
  return _nvDraw3(V, r, g);
};
/* ---------- ratón y táctil ---------- */
function n3Bind(cv) {
  if (cv._n3) return; cv._n3 = true;
  cv.addEventListener('mousedown', e => { if (!N3.active) return; e.preventDefault(); N3.drag = {x: e.clientX, y: e.clientY, pan: e.button === 2 || e.shiftKey}; N3.user = true; }, true);
  window.addEventListener('mousemove', e => { const d = N3.drag; if (!d || !N3.active) return; const dx = e.clientX - d.x, dy = e.clientY - d.y; d.x = e.clientX; d.y = e.clientY; const c = N3.cam;
    if (d.pan) { const k = c.d * 0.0016; c.tx += -Math.cos(c.yaw) * dx * k + Math.sin(c.yaw) * dy * k; c.tz += Math.sin(c.yaw) * dx * k + Math.cos(c.yaw) * dy * k; } else { c.yaw -= dx * 0.006; c.pit = clamp(c.pit + dy * 0.004, 0.06, 1.3); } });
  window.addEventListener('mouseup', () => { N3.drag = null; });
  cv.addEventListener('contextmenu', e => { if (N3.active) e.preventDefault(); });
  cv.addEventListener('wheel', e => { if (!N3.active) return; e.preventDefault(); N3.cam.d = clamp(N3.cam.d * Math.exp(e.deltaY * 0.0013), 40, 1800); N3.zoomed = true; }, {passive: false});
  cv.addEventListener('dblclick', () => { if (!N3.active) return; Object.assign(N3.cam, {yaw: 0, pit: 0.3}); N3.user = false; N3.zoomed = false; });
  let tp = null; cv.addEventListener('touchstart', e => { if (!N3.active) return; e.preventDefault(); N3.user = true; tp = [...e.touches].map(t => [t.clientX, t.clientY]); }, {passive: false});
  cv.addEventListener('touchmove', e => { if (!N3.active || !tp) return; e.preventDefault(); const now = [...e.touches].map(t => [t.clientX, t.clientY]), c = N3.cam;
    if (now.length === 1 && tp.length === 1) { c.yaw -= (now[0][0] - tp[0][0]) * 0.006; c.pit = clamp(c.pit + (now[0][1] - tp[0][1]) * 0.004, 0.06, 1.3); }
    else if (now.length >= 2 && tp.length >= 2) { const d0 = Math.hypot(tp[0][0] - tp[1][0], tp[0][1] - tp[1][1]), d1 = Math.hypot(now[0][0] - now[1][0], now[0][1] - now[1][1]); c.d = clamp(c.d * d0 / Math.max(8, d1), 40, 1800); N3.zoomed = true; }
    tp = now; }, {passive: false});
  cv.addEventListener('touchend', () => { tp = null; });
}
// el lienzo se crea al abrir el panel: se enlaza una vez por lienzo
(function () { const _r = renderNavalPanel; renderNavalPanel = function () { _r(); const cv = document.getElementById('nvmap'); if (cv) n3Bind(cv); if (!document.getElementById('navalpanel').classList.contains('open') && N3.S) { n3Dispose(N3.S); N3.S = null; } }; })();
// botón de la vista 3D en el panel naval
Object.assign(ACT, {nv3d: () => { if (!b3Usable()) { toast('⚠️', 'La vista 3D necesita un equipo con WebGL 2.'); return; } R.b3Dead = false; N3.dead = false; R.bv3d = !b3On(); try { localStorage.setItem('victoria-bv3d', R.bv3d ? '1' : '0'); } catch (e) { } renderNavalPanel(); }});
