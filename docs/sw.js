// Service worker: instalable y jugable sin conexión. Caché versionada por contenido (eb66c9f9); red primero para recibir versiones nuevas.
const CACHE = 'victoria-eb66c9f9';
const FILES = ["./", "./index.html", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png", "./js/three.min.js?v=b53d85dd", "./js/game.js?v=c67e2ff7", "./css/style.css?v=10dfa663", "./data/elevacion.bin?v=e00db860", "./wasm/kernels.wasm?v=19be9f89", "./data/1910.bin?v=a04eef90", "./data/1939.bin?v=4a87f533", "./js/boot.js?v=9a52ace7"];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(fetch(e.request).then(r => { const cp = r.clone(); caches.open(CACHE).then(c => c.put(e.request, cp)); return r; }).catch(() => caches.match(e.request).then(m => m || caches.match('./index.html'))));
});
