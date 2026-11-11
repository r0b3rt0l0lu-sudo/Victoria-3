/* Arranque: carga el WebAssembly y los datos binarios y después el juego. Con file:// (sin servidor) usa el respaldo en base64. */
(async function () {
  var V = {"js/three.min.js": "b53d85dd", "js/game.js": "5c70222b", "css/style.css": "10dfa663", "data/elevacion.bin": "e00db860", "wasm/kernels.wasm": "19be9f89", "data/1910.bin": "0c59e724", "data/1939.bin": "2ad37630", "js/datos-b64.js": "1eb8a697"};
  if (/nowasm/.test(location.search)) window.__WK_OFF = 1;
  function load(src) { return new Promise(function (ok, no) { var s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = function () { no(new Error(src)); }; document.body.appendChild(s); }); }
  async function bin(rel) { var r = await fetch(rel + '?v=' + V[rel]); if (!r.ok) throw new Error(rel); return new Uint8Array(await r.arrayBuffer()); }
  function b64(s) { var a = atob(s), u = new Uint8Array(a.length); for (var i = 0; i < a.length; i++) u[i] = a.charCodeAt(i); return u; }
  var elev, wasm, scen = {};
  try {
    if (location.protocol === 'file:') throw 0;
    var r = await Promise.all([bin('data/elevacion.bin'), bin('wasm/kernels.wasm')]); elev = r[0]; wasm = r[1];
    Object.keys(V).forEach(function (k) { var m = /^data\/(\d+)\.bin$/.exec(k); if (m) scen[m[1]] = 'bin:data/' + m[1] + '.bin?v=' + V[k]; });
  } catch (e) { await load('js/datos-b64.js?v=' + V['js/datos-b64.js']); elev = b64(window.__B64.elev); wasm = b64(window.__B64.wasm); scen = window.__B64.scen; }
  var dv = new DataView(elev.buffer, elev.byteOffset), w = dv.getUint32(0, true), h = dv.getUint32(4, true), n = w * h;
  window.__ELEV = {w: w, h: h, m: elev.subarray(8, 8 + n), r: elev.subarray(8 + n, 8 + 2 * n)}; window.__SCEN = scen;
  try { if (wasm.length) var wi = await WebAssembly.instantiate(wasm, {}); window.__WK_EX = wi.instance.exports; window.__WK_MOD = wi.module; } catch (e) { console.warn('WebAssembly no disponible; se usa JS', e); }
  await load('js/three.min.js?v=' + V['js/three.min.js']); await load('js/game.js?v=' + V['js/game.js']);
})();
