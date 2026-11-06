/* ===== WEBASSEMBLY: núcleos numéricos de la generación del mapa (wasm/kernels.c → wasm/kernels.wasm) =====
   El arranque (js/boot.js o el cargador del index.html único) instancia el módulo y deja sus exportaciones en window.__WK_EX.
   Si no está disponible (navegador antiguo, WebAssembly bloqueado, ?nowasm) se usa el código JS de siempre, que da EXACTAMENTE el mismo resultado. */
const wkOn = () => !!window.__WK_EX && !window.__WK_OFF;
// reserva de memoria lineal sencilla (un solo uso por llamada): devuelve punteros y vistas tipadas
function wkRun(fn) {
  const ex = window.__WK_EX; let top = ex.__heap_base.value, mem = ex.memory;
  const alloc = (T, n) => { top = (top + 7) & ~7; const p = top; top += n * T.BYTES_PER_ELEMENT; if (top > mem.buffer.byteLength) throw new Error('wasm: memoria insuficiente'); return {p, a: new T(mem.buffer, p, n)}; };
  return fn(ex, alloc);
}
function wkHeight(land, dLand, dSea, mount) {
  return wkRun((ex, al) => {
    const N = MAP_W * MAP_H, L = al(Uint8Array, N), a = al(Float32Array, N), b = al(Float32Array, N), c = al(Float32Array, N), h = al(Float32Array, N);
    L.a.set(land); a.a.set(dLand); b.a.set(dSea); c.a.set(mount); ex.k_height(MAP_W, MAP_H, L.p, a.p, b.p, c.p, h.p); return h.a.slice();
  });
}
function wkBiomes(land, h) {
  return wkRun((ex, al) => {
    const N = MAP_W * MAP_H, L = al(Uint8Array, N), H = al(Float32Array, N), B = al(Uint8Array, N), flat = l => { const f = new Float64Array(l.length * 4 || 4); l.forEach((e, i) => { f[i * 4] = e[0]; f[i * 4 + 1] = e[1]; f[i * 4 + 2] = e[2]; f[i * 4 + 3] = e[3]; }); return f; };
    const S = al(Float64Array, STEPPES.length * 4 || 4), J = al(Float64Array, JUNGLES.length * 4 || 4), D = al(Float64Array, DESERTS.length * 4 || 4);
    B.a.fill(0); L.a.set(land); H.a.set(h); S.a.set(flat(STEPPES)); J.a.set(flat(JUNGLES)); D.a.set(flat(DESERTS));
    ex.k_biomes(MAP_W, MAP_H, L.p, H.p, B.p, S.p, STEPPES.length, J.p, JUNGLES.length, D.p, DESERTS.length); return B.a.slice();
  });
}
function wkTerrain(land, h, biome, dSea) {
  return wkRun((ex, al) => {
    const N = MAP_W * MAP_H, L = al(Uint8Array, N), H = al(Float32Array, N), B = al(Uint8Array, N), S = al(Float32Array, N), T = al(Uint8Array, N * 4);
    L.a.set(land); H.a.set(h); B.a.set(biome); S.a.set(dSea); ex.k_terrain(MAP_W, MAP_H, L.p, H.p, B.p, S.p, T.p); return new Uint8ClampedArray(T.a.slice().buffer);
  });
}
