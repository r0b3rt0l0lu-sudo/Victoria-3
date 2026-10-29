/* ===== BORDES SUAVIZADOS: contornos vectoriales dibujados en alta resolución sobre el mapa ===== */
const OVS = 1.5;      // factor de escala de la capa de bordes respecto a la cuadrícula lógica
// Extrae los contornos entre celdas con distinto valor, los encadena en polilíneas y las suaviza
function buildBorderLines() {
  const t0 = performance.now(), W = MAP_W, H = MAP_H, land = MAP.land, so = MAP.stateOf, po = MAP.provOf, W1 = W + 1;
  let cap = 600000, sx = new Int32Array(cap), sy = new Int32Array(cap), kind = new Uint8Array(cap), ka = new Int16Array(cap), kb = new Int16Array(cap), n = 0;
  const addSeg = (c0, c1, k, a, b) => { if (n >= cap) { cap *= 2; const g = (A, T) => { const B = new T(cap); B.set(A); return B; }; sx = g(sx, Int32Array); sy = g(sy, Int32Array); kind = g(kind, Uint8Array); ka = g(ka, Int16Array); kb = g(kb, Int16Array); } sx[n] = c0; sy[n] = c1; kind[n] = k; ka[n] = a; kb[n] = b; n++; };
  const cls = (i, j) => {    // clasificación del límite entre dos celdas vecinas: 0 costa, 1 estado, 2 provincia, -1 ninguno
    const li = land[i], lj = land[j];
    if (li !== lj) return 0;
    if (!li) return -1;
    if (so[i] !== so[j]) return 1;
    if (po[i] !== po[j]) return 2;
    return -1;
  };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (x < W - 1) { const j = i + 1, k = cls(i, j); if (k >= 0) { const a = k === 1 ? Math.min(so[i], so[j]) : k === 2 ? 0 : 0, b = k === 1 ? Math.max(so[i], so[j]) : 0; addSeg(y * W1 + x + 1, (y + 1) * W1 + x + 1, k, a, b); } }
    if (y < H - 1) { const j = i + W, k = cls(i, j); if (k >= 0) { const a = k === 1 ? Math.min(so[i], so[j]) : 0, b = k === 1 ? Math.max(so[i], so[j]) : 0; addSeg((y + 1) * W1 + x, (y + 1) * W1 + x + 1, k, a, b); } }
  }
  // grafo de esquinas
  const head = new Int32Array(W1 * (H + 1)).fill(-1), nxt = new Int32Array(n * 2), deg = new Uint8Array(W1 * (H + 1));
  for (let s = 0; s < n; s++) { for (let e = 0; e < 2; e++) { const c = e ? sy[s] : sx[s]; nxt[s * 2 + e] = head[c]; head[c] = s * 2 + e; deg[c]++; } }
  const used = new Uint8Array(n), lines = [];
  const other = (s, c) => sx[s] === c ? sy[s] : sx[s];
  const nextSeg = (c, from) => { for (let e = head[c]; e >= 0; e = nxt[e]) { const s = e >> 1; if (s !== from && !used[s] && kind[s] === kind[from] && ka[s] === ka[from] && kb[s] === kb[from]) return s; } return -1; };
  for (let s0 = 0; s0 < n; s0++) {
    if (used[s0]) continue; used[s0] = 1;
    let pts = [sx[s0], sy[s0]]; let c = sy[s0], cur = s0;
    // hacia delante
    for (;;) { if (deg[c] !== 2) break; const s = nextSeg(c, cur); if (s < 0) break; used[s] = 1; c = other(s, c); pts.push(c); cur = s; }
    // hacia atrás
    c = sx[s0]; cur = s0; const back = [];
    for (;;) { if (deg[c] !== 2) break; const s = nextSeg(c, cur); if (s < 0) break; used[s] = 1; c = other(s, c); back.push(c); cur = s; }
    if (back.length) pts = back.reverse().concat(pts);
    lines.push({k: kind[s0], a: ka[s0], b: kb[s0], p: pts});
  }
  // a coordenadas (x, y) y suavizado por media móvil
  const out = lines.map(L => {
    const P = L.p, m = P.length, xy = new Float32Array(m * 2);
    for (let i = 0; i < m; i++) { xy[i * 2] = P[i] % W1; xy[i * 2 + 1] = (P[i] / W1) | 0; }
    const closed = m > 3 && P[0] === P[m - 1];
    for (let pass = 0; pass < 3; pass++) {
      const cp = xy.slice();
      for (let i = closed ? 0 : 1; i < (closed ? m - 1 : m - 1); i++) {
        const pi = i === 0 ? m - 2 : i - 1, ni = i + 1;
        xy[i * 2] = (cp[pi * 2] + cp[i * 2] * 2 + cp[ni * 2]) / 4; xy[i * 2 + 1] = (cp[pi * 2 + 1] + cp[i * 2 + 1] * 2 + cp[ni * 2 + 1]) / 4;
      }
      if (closed) { xy[(m - 1) * 2] = xy[0]; xy[(m - 1) * 2 + 1] = xy[1]; }
    }
    return {k: L.k, a: L.a, b: L.b, xy};
  });
  MAP.borderLines = out;
  console.log('Bordes vectoriales:', n, 'segmentos,', out.length, 'polilíneas en', Math.round(performance.now() - t0), 'ms');
}
function strokeLines(g, list, scale) {
  g.beginPath();
  list.forEach(L => {
    const xy = L.xy, m = xy.length / 2; if (m < 2) return;
    g.moveTo(xy[0] * scale, xy[1] * scale);
    for (let i = 1; i < m - 1; i++) g.quadraticCurveTo(xy[i * 2] * scale, xy[i * 2 + 1] * scale, (xy[i * 2] + xy[i * 2 + 2]) / 2 * scale, (xy[i * 2 + 1] + xy[i * 2 + 3]) / 2 * scale);
    g.lineTo(xy[(m - 1) * 2] * scale, xy[(m - 1) * 2 + 1] * scale);
  });
  g.stroke();
}
function initBorderOverlay() {
  if (R.ov || !MAP.borderLines) return;
  const w = Math.round(MAP_W * OVS), h = Math.round(MAP_H * OVS);
  const mk = () => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  R.ovStatic = mk(); R.ovCv = mk(); R.ovCtx = R.ovCv.getContext('2d');
  const g = R.ovStatic.getContext('2d'); g.lineJoin = g.lineCap = 'round';
  const by = k => MAP.borderLines.filter(L => L.k === k);
  g.strokeStyle = 'rgba(26,52,74,.40)'; g.lineWidth = 1.7; strokeLines(g, by(0), OVS);                 // costa
  g.strokeStyle = 'rgba(12,14,16,.20)'; g.lineWidth = 0.6; strokeLines(g, by(2), OVS);                 // provincias
  g.strokeStyle = 'rgba(12,14,16,.40)'; g.lineWidth = 0.95; strokeLines(g, by(1), OVS);                 // estados
  R.ovTex = new THREE.CanvasTexture(R.ovCv); R.ovTex.anisotropy = Math.min(8, R.renderer.capabilities.getMaxAnisotropy());
  const mat = new THREE.MeshBasicMaterial({map: R.ovTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3});
  R.ov = new THREE.Mesh(R.mesh.geometry, mat); R.ov.renderOrder = 0; R.scene.add(R.ov);
  R.ovSig = null; redrawOverlay(true);
}
function redrawOverlay(force) {
  if (!R.ov || !G.S || !G.ownerOf) return;
  const sig = Array.from(G.ownerOf).join(',') + '|' + (R.sel === undefined ? -1 : R.sel);
  if (!force && sig === R.ovSig) return; R.ovSig = sig;
  const g = R.ovCtx; g.clearRect(0, 0, R.ovCv.width, R.ovCv.height); g.drawImage(R.ovStatic, 0, 0);
  g.lineJoin = g.lineCap = 'round';
  const own = G.ownerOf, st = MAP.borderLines.filter(L => L.k === 1);
  const country = st.filter(L => own[L.a] !== own[L.b]);
  g.strokeStyle = 'rgba(6,8,12,.28)'; g.lineWidth = 3.6; strokeLines(g, country, OVS);
  g.strokeStyle = 'rgba(14,16,22,.92)'; g.lineWidth = 1.5; strokeLines(g, country, OVS);
    if (R.sel >= 0) { const mine = st.filter(L => L.a === R.sel || L.b === R.sel); g.strokeStyle = 'rgba(255,236,170,.95)'; g.lineWidth = 1.9; strokeLines(g, mine, OVS); }
  R.ovTex.needsUpdate = true; R.dirty = true;
}
