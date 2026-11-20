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



