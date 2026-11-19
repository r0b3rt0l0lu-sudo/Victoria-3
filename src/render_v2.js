/* ===== MAPA v2 EN EL JUEGO: textura del plano 3D en alta resolución pintada con pintura_v2.js =====
   Se carga DESPUÉS de render.js y de rasters_v2.js / pintura_v2.js / etiquetas_v2.js. No cambia nada de la lógica del juego:
   · Fondo físico (mar con batimetría, costa vectorial, relieve fino de Natural Earth, ríos y lagos) pintado UNA vez a 4096×1640 («medio»)
     o 8192×3280 («alto», si la GPU admite texturas de 8192); «bajo» se queda en 2048×820. Los bordes los sigue poniendo mapsmooth.js.
   · Encima, la capa de siempre por estado (modo de mapa, ocupación, hover, selección, niebla), calculada a 2048×820 como antes pero como
     relleno con transparencia, ampliada con suavizado y recortada por la costa vectorial: costas nítidas a cualquier zoom.
   · repaintState sube a la GPU solo el rectángulo del estado (texSubImage2D) en lugar de la textura entera.
   Mientras se pinta el fondo (≈ 0,4–1,5 s en segundo plano, por franjas) se ve el mapa de siempre. Desactivar: R.v2.off = true antes de initRenderer. */
R.v2 = {ready: false, scale: 1, off: false, reliefK: 0.55};
function v2Scale() { const max = R.renderer ? R.renderer.capabilities.maxTextureSize : 4096; return R.quality === 'bajo' ? 1 : R.quality === 'alto' && max >= 8192 ? 4 : 2; }
const _v1InitRenderer = initRenderer, _v1FullRepaint = fullRepaint, _v1RepaintState = repaintState;
initRenderer = function (canvas) {
  _v1InitRenderer(canvas);
  if (R.v2.off || typeof pv2Init !== 'function' || typeof RASTERS_V2 === 'undefined') return;
  const sc = v2Scale(); R.v2.scale = sc;
  pv2Init(RASTERS_V2).then(() => {
    const base = document.createElement('canvas');
    // en el juego el relieve 3D ya ilumina el terreno: el sombreado de Natural Earth se añade suave (detalle fino que la malla no tiene)
    return pv2PaintTexture(base, sc, {style: 'actual', season: 'verano', quality: R.quality, layers: {politico: false, fronteras: false, provincias: false, rutas: false, relieve: true}, reliefK: R.v2.reliefK}).then(() => {
      const hi = document.createElement('canvas'); hi.width = base.width; hi.height = base.height;
      const fill = document.createElement('canvas'); fill.width = MAP_W; fill.height = MAP_H;
      const tex = new THREE.CanvasTexture(hi); tex.anisotropy = R.tex.anisotropy; tex.colorSpace = R.tex.colorSpace; tex.generateMipmaps = true; tex.minFilter = THREE.LinearMipmapLinearFilter; tex.magFilter = THREE.LinearFilter;
      Object.assign(R.v2, {base, hi, hctx: hi.getContext('2d', {willReadFrequently: true}), fill, fctx: fill.getContext('2d'), fimg: fill.getContext('2d').createImageData(MAP_W, MAP_H), tex, ready: true});
      R.mesh.traverse(o => { if (o.isMesh && o.material && o.material.map === R.tex) { o.material.map = tex; o.material.needsUpdate = true; } });
      R.tex.dispose(); R.tex = tex; R.cv = hi;                       // el minimapa y rendimiento.js usan R.cv / R.tex
      fullRepaint();
    });
  }).catch(e => { console.warn('mapa v2: se mantiene la textura v1', e); });
};
// relleno RGBA de un píxel lógico (misma lógica que paintPixel, pero solo la capa de color, con transparencia)
function v2FillPixel(i, fill, hov, sel) {
  const d = R.v2.fimg.data, o = i * 4, pr = G.P ? G.P[MAP.provOf[i]] : null;
  let r = 0, g = 0, b = 0, a = 0;
  if (G.fog && !R.fogOff && !G.fog.seen[MAP.provOf[i]]) { d[o] = 22; d[o + 1] = 26; d[o + 2] = 34; d[o + 3] = 150; return; }
  if (fill[3] > 0) { r = fill[0] * 0.92; g = fill[1] * 0.92; b = fill[2] * 0.92; a = Math.min(0.9, fill[3] * 1.05); }
  if (pr && R.anyOcc) {
    const nbp = MAP.pnb[i], nby = nbp !== NOPROV ? G.P[nbp].by : null, by = pr.by, x = i % MAP_W, y = (i / MAP_W) | 0, st = ((x + y) >> 1) & 1;
    if (nbp !== NOPROV && by !== nby) { if (st) { r = 255; g = 232; b = 130; } else { r = 150; g = 22; b = 22; } a = 1; }
    else if (by) { const k = st ? 0.78 : 0.45, rgb = R.occRGB(by); r = a ? r * (1 - k) + rgb[0] * k : rgb[0]; g = a ? g * (1 - k) + rgb[1] * k : rgb[1]; b = a ? b * (1 - k) + rgb[2] * k : rgb[2]; a = Math.max(a, k); }
  }
  if (hov) { if (a) { r = r * 0.8 + 55; g = g * 0.8 + 55; b = b * 0.8 + 44; } else { r = 255; g = 250; b = 230; a = 0.22; } }
  if (sel) { if (a) { r = r * 0.78 + 60; g = g * 0.78 + 52; b = b * 0.78 + 28; } else { r = 255; g = 230; b = 150; a = 0.3; } }
  d[o] = r; d[o + 1] = g; d[o + 2] = b; d[o + 3] = a * 255;
}
// compone fondo + relleno en el rectángulo (píxeles lógicos) y lo sube a la GPU
function v2Compose(x0, y0, w, h, partial) {
  const V = R.v2, sc = V.scale, g = V.hctx, X = Math.floor(x0 * sc), Y = Math.floor(y0 * sc), Wd = Math.ceil(w * sc), Hd = Math.ceil(h * sc);
  // el relleno se extiende un píxel al mar: la costa vectorial lo recorta sin dejar un borde desvaído
  const d = V.fimg.data, land = MAP.land, dS = MAP.dSea, W = MAP_W;
  for (let y = Math.max(1, y0); y < Math.min(MAP_H - 1, y0 + h); y++) for (let x = Math.max(1, x0); x < Math.min(W - 1, x0 + w); x++) { const i = y * W + x; if (land[i] || dS[i] > 1.5) continue;
    for (const j of [i - 1, i + 1, i - W, i + W]) if (land[j]) { const o = i * 4, q = j * 4; d[o] = d[q]; d[o + 1] = d[q + 1]; d[o + 2] = d[q + 2]; d[o + 3] = d[q + 3]; break; } }
  V.fctx.putImageData(V.fimg, 0, 0, x0, y0, w, h);
  g.save(); g.beginPath(); g.rect(X, Y, Wd, Hd); g.clip();
  g.drawImage(V.base, X, Y, Wd, Hd, X, Y, Wd, Hd);
  g.setTransform(sc, 0, 0, sc, 0, 0); g.clip(PV2.landPath); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
  const p = 1; g.drawImage(V.fill, Math.max(0, x0 - p), Math.max(0, y0 - p), Math.min(MAP_W, w + 2 * p), Math.min(MAP_H, h + 2 * p), Math.max(0, x0 - p), Math.max(0, y0 - p), Math.min(MAP_W, w + 2 * p), Math.min(MAP_H, h + 2 * p));
  g.restore();
  if (partial && v2TexSub(X, Y, Wd, Hd)) return;
  V.tex.needsUpdate = true;
}
// subida parcial a la GPU (WebGL2, textura ya creada); si algo no cuadra se sube la textura entera
function v2TexSub(X, Y, W, H) {
  try {
    const r = R.renderer, gl = r.getContext(), p = r.properties.get(R.v2.tex); if (!p.__webglTexture || !(gl instanceof WebGL2RenderingContext)) return false;
    let img; if (W * H > 0) { const t = R.v2.sub || (R.v2.sub = document.createElement('canvas')); if (t.width < W || t.height < H) { t.width = Math.max(t.width, W); t.height = Math.max(t.height, H); R.v2.subg = null; } const tg = R.v2.subg || (R.v2.subg = t.getContext('2d')); tg.clearRect(0, 0, W, H); tg.drawImage(R.v2.hi, X, Y, W, H, 0, 0, W, H); img = tg.getImageData(0, 0, W, H); }          // región pequeña en un lienzo auxiliar (evita leer el lienzo grande)
    r.state.bindTexture(gl.TEXTURE_2D, p.__webglTexture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, R.v2.tex.flipY); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false); gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, X, R.v2.tex.flipY ? R.v2.hi.height - Y - H : Y, W, H, gl.RGBA, gl.UNSIGNED_BYTE, img);
    gl.generateMipmap(gl.TEXTURE_2D); return true;
  } catch (e) { return false; }
}
fullRepaint = function () {
  if (!R.v2.ready) return _v1FullRepaint();
  const S = G.S, off = MAP.pixOff, ord = MAP.pixOrder;
  for (let s = 0; s < S.length; s++) { const fill = stateFill(S[s]), hov = s === R.hover, sel = s === R.sel; for (let k = off[s], e = off[s + 1]; k < e; k++) v2FillPixel(ord[k], fill, hov, sel); }
  v2Compose(0, 0, MAP_W, MAP_H, false);
  R.dirty = true; R.minimapDirty = true;
  if (R.cityMesh) updateCityColors();
  if (typeof redrawOverlay === 'function') redrawOverlay(false);
};
repaintState = function (id) {
  if (!R.v2.ready) return _v1RepaintState(id);
  if (id < 0) return; const fill = stateFill(G.S[id]), off = MAP.pixOff, ord = MAP.pixOrder, st = MAP.stats[id];
  for (let k = off[id]; k < off[id + 1]; k++) v2FillPixel(ord[k], fill, id === R.hover, id === R.sel);
  const x0 = Math.max(0, st.x0 - 2), y0 = Math.max(0, st.y0 - 2), w = Math.min(MAP_W - x0, st.x1 - st.x0 + 5), h = Math.min(MAP_H - y0, st.y1 - st.y0 + 5);
  v2Compose(x0, y0, w, h, true); R.dirty = true;
};
// estilo del fondo del mapa desde los ajustes gráficos: 'actual' | 'atlas' (el modo de mapa, los rellenos y los bordes no cambian)
function v2SetStyle(style) {
  if (!R.v2.ready) return Promise.resolve(false); R.v2.style = style;
  return pv2PaintTexture(R.v2.base, R.v2.scale, {style, season: 'verano', quality: R.quality, layers: {politico: false, fronteras: false, provincias: false, rutas: false, relieve: true}, reliefK: R.v2.reliefK}).then(() => { fullRepaint(); return true; });
}

// las repintadas de estados se agrupan: varias órdenes sobre el mismo estado en un mismo instante se hacen una sola vez y con presupuesto de tiempo
const _v2RepaintNow = repaintState, V2PEND = new Set(); let v2PendT = 0;
function v2Flush() { v2PendT = 0; const t0 = performance.now(); for (const id of V2PEND) { V2PEND.delete(id); try { _v2RepaintNow(id); } catch (e) { console.warn('repaint v2', e); } if (performance.now() - t0 > 40) break; } if (V2PEND.size) v2PendT = setTimeout(v2Flush, 30); }
repaintState = function (id) { if (!R.v2.ready || id < 0) return _v2RepaintNow(id); V2PEND.add(id); if (!v2PendT) v2PendT = setTimeout(v2Flush, 30); };
const _v2FullNow = fullRepaint; fullRepaint = function () { V2PEND.clear(); return _v2FullNow.apply(this, arguments); };
