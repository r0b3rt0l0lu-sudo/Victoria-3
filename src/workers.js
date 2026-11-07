/* ===== WEB WORKER: la generación del mundo (relieve, estados, provincias + economía calentada) se hace en un hilo aparte =====
   Mientras tanto la página sigue respondiendo (la pantalla de carga se anima y no se «congela» el navegador unos segundos).
   El worker carga el MISMO código del juego con un DOM simulado, ejecuta buildMap() + initGame('GBR') y devuelve el mapa (typed arrays, por transferencia)
   y el estado del mundo G (clonado tal cual, así no se pierde nada de lo que calcula initGame y no se guarda). Si algo falla (sin Worker/OffscreenCanvas, sin acceso al código, error, tiempo agotado) se hace como siempre en el hilo principal.
   Desactivar: ?sinworker en la dirección o window.__NO_WORKER = true.
   La simulación diaria NO se mueve al worker: comparte con la interfaz el estado global G y las dos cosas se escriben mutuamente. */

// Arranque del worker (se convierte en texto con toString(): no puede usar nada de fuera)
function wkWorkerBoot() {
  const mk = name => { const f = function () { return mk(name); }; return new Proxy(f, {get(t, k) { if (k === Symbol.toPrimitive) return () => 0; if (k === 'then') return undefined; if (k === 'length') return 0; return mk(name); }, set() { return true; }, apply() { return mk(name); }, construct() { return mk(name); }, has() { return true; }}); };
  const mem = () => ({getItem: () => null, setItem() {}, removeItem() {}, clear() {}, key: () => null, length: 0});
  const doc = mk('document');
  self.document = new Proxy(doc, {get(t, k) { if (k === 'createElement') return tag => tag === 'canvas' ? new OffscreenCanvas(1, 1) : mk('el'); if (k === 'readyState') return 'loading'; return t[k]; }});
  self.window = self; self.localStorage = mem(); self.sessionStorage = mem(); self.devicePixelRatio = 1; self.innerWidth = 1500; self.innerHeight = 860;
  ['THREE', 'Image', 'AudioContext', 'webkitAudioContext', 'screen', 'Notification'].forEach(k => { self[k] = mk(k); });
  ['MutationObserver', 'ResizeObserver', 'IntersectionObserver', 'matchMedia', 'getComputedStyle', 'Path2D', 'HTMLElement', 'Event', 'CustomEvent', 'KeyboardEvent', 'FileReader', 'XMLHttpRequest', 'caches', 'indexedDB'].forEach(k => { if (!(k in self)) self[k] = mk(k); });
  self.requestAnimationFrame = () => 0; self.cancelAnimationFrame = () => {}; self.setTimeout = () => 0; self.setInterval = () => 0; self.__booted = true;
  const post = (o, tr) => self.postMessage(o, tr || []);
  const reseed = n => { if (!self.__seed) return; let s = n >>> 0; Math.random = () => { s = (s + 0x6D2B79F5) >>> 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };
  self.onmessage = async e => {
    const m = e.data;
    try {
      if (m.t === 'init') {
        self.__ELEV = m.elev; if (m.off) self.__WK_OFF = 1;
        if (m.mod) { try { self.__WK_EX = (await WebAssembly.instantiate(m.mod, {})).exports; } catch (err) { /* sin WebAssembly: JS (mismo resultado) */ } }
        if (m.seed) { self.__seed = m.seed; reseed(m.seed); }        // solo para pruebas: aleatoriedad reproducible
        importScripts(URL.createObjectURL(new Blob([m.src], {type: 'text/javascript'})));
        post({t: 'ready'});
      } else if (m.t === 'run') {
        post({t: 'p', msg: 'Modelando el relieve del mundo…'}); reseed(self.__seed); buildMap();
        post({t: 'p', msg: 'Poblando los estados y calentando la economía…'}); reseed(self.__seed); initGame('GBR');
        const bufs = [], seen = new Set();
        Object.keys(MAP).forEach(k => { const v = MAP[k]; if (ArrayBuffer.isView(v) && v.byteOffset === 0 && v.byteLength === v.buffer.byteLength && !seen.has(v.buffer)) { seen.add(v.buffer); bufs.push(v.buffer); } });
        post({t: 'done', map: MAP, g: G}, bufs);
      }
    } catch (err) { post({t: 'err', msg: String(err && err.stack || err)}); }
  };
}

// código del juego tal y como está cargado (página única: el bloque #game; carpeta: js/game.js, que ya está en la caché)
async function wkGameSource() {
  const g = document.getElementById('game'); if (g && g.textContent.length > 1e5) return g.textContent;
  const s = [...document.scripts].find(x => /game\.js/.test(x.src)); if (!s) return null;
  const r = await fetch(s.src); if (!r.ok) return null; return r.text();
}
function wkUsable() {
  return typeof Worker === 'function' && typeof OffscreenCanvas === 'function' && typeof Blob === 'function' && typeof URL !== 'undefined' && !window.__NO_WORKER && !/sinworker/.test(location.search);
}
// Devuelve true si el mapa y la partida inicial quedaron listos; false (o excepción) → el llamador lo hace en el hilo principal
function wkBuildWorld(progress, opt) {
  opt = opt || {};
  return new Promise(async (ok, no) => {
    let w = null, done = false, timer = 0;
    const end = (fn, v) => { if (done) return; done = true; clearTimeout(timer); try { w && w.terminate(); } catch (e) { } fn(v); };
    try {
      const src = await wkGameSource(); if (!src) return end(ok, false);
      const boot = URL.createObjectURL(new Blob(['(' + wkWorkerBoot.toString() + ')()'], {type: 'text/javascript'}));
      w = new Worker(boot); timer = setTimeout(() => end(ok, false), opt.timeout || 60000);
      w.onerror = e => end(no, new Error('worker: ' + (e.message || 'error')));
      w.onmessage = e => {
        const m = e.data;
        if (m.t === 'ready') w.postMessage({t: 'run'});
        else if (m.t === 'p') progress && progress(m.msg);
        else if (m.t === 'err') end(no, new Error(m.msg));
        else if (m.t === 'done') {
          try { Object.keys(MAP).forEach(k => delete MAP[k]); Object.assign(MAP, m.map); Object.keys(G).forEach(k => delete G[k]); Object.assign(G, m.g); if (typeof tplRegisterAll === 'function') tplRegisterAll(); /* las plantillas de división se registran en tablas del módulo (DIVS), que no viajan con G */ end(ok, true); } catch (err) { end(no, err); }
        }
      };
      w.postMessage({t: 'init', src, elev: window.__ELEV || null, mod: window.__WK_MOD || null, off: !!window.__WK_OFF, seed: opt.seed || 0});
    } catch (err) { end(no, err); }
  });
}
