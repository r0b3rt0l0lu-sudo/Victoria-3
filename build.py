#!/usr/bin/env python3
"""Compila src/ en un único index.html (three.js incrustado)."""
import os, re, sys
light = '--light' in sys.argv
root = os.path.dirname(os.path.abspath(__file__))
def rd(p): return open(os.path.join(root, p), encoding='utf-8').read()
three = rd('vendor/three.min.js')
css = rd('src/style.css')
order = ['icons.js', 'geo.js', 'data.js', 'cities.js', 'mapgen.js', 'provinces.js', 'mapsmooth.js', 'sim.js', 'crisis.js', 'diplo.js', 'military.js', 'logistics.js', 'milecon.js', 'dcrisis.js', 'render.js', 'render3d.js', 'ui.js', 'ui_mil.js', 'battleviz.js', 'politics2.js', 'national.js', 'peace.js', 'coalition.js', 'landing.js', 'intel.js', 'mil2.js', 'doctrinas.js', 'plantillas.js', 'produccion.js', 'aviacion.js', 'marina.js', 'resistencia.js', 'mariscales.js', 'ia_guerra.js', 'ia_operaciones.js', 'ofertas_paz.js', 'navalviz.js', 'graficos.js', 'rendimiento.js', 'content.js', 'manual.js', 'main.js']
js = '\n'.join(rd('src/' + f) for f in order)
html = f'''<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Victoria — Una era de revolución (réplica web)</title>
<style>{css}</style>
</head>
<body>
<canvas id="gl"></canvas>
<div id="vignette"></div><div id="labels"></div><div id="citylabels"></div><div id="markers"></div>
<div id="hud"></div>
<div id="statepanel"></div>
<div id="armypanel"></div><div id="battlepanel"></div><div id="drawbar"></div>
<div id="windows"></div>
<div id="toasts"></div>
<div id="event"></div>
<div id="tooltip"></div>
<div id="wardlg"></div><div id="confdlg"></div>
<div id="search"></div>
<div id="start"></div>
<div id="loading"><h1>VICTORIA</h1><div class="lb"><i></i></div><p id="loadtxt">Cargando…</p></div>
{'<script src="https://cdn.jsdelivr.net/npm/three@0.152.0/build/three.min.js"></script>' if light else "<script>" + three.replace("</script>", "<\\/script>") + "</script>"}
<script>
{js.replace("</script>", "<\\/script>")}
</script>
</body>
</html>
'''
out = 'juego-ligero.html' if light else 'index.html'
open(os.path.join(root, out), 'w', encoding='utf-8').write(html)
print(out, len(html) // 1024, 'KB')


# ---------- PWA instalable (carpeta docs/, lista para alojar, p. ej. en GitHub Pages) ----------
if not light:
    import json, struct, zlib, time, math
    d = os.path.join(root, 'docs'); os.makedirs(d, exist_ok=True)
    def png(size):
        raw = bytearray()
        c = size / 2.0
        for y in range(size):
            raw.append(0)
            for x in range(size):
                dx, dy = x - c + 0.5, y - c + 0.5; r = math.hypot(dx, dy) / c
                if r > 0.98: px = (0, 0, 0, 0)
                elif 0.86 < r <= 0.96: px = (201, 166, 87, 255)                       # aro dorado
                else:
                    t = min(1.0, r); base = (int(34 - 14 * t), int(52 - 18 * t), int(66 - 22 * t))
                    # estrella de cinco puntas muy simplificada: «V» dorada central
                    ax = dx / c; ay = dy / c
                    v = abs(ax) < 0.34 and -0.42 < ay < 0.4 and abs(abs(ax) - (ay + 0.42) * 0.42) < 0.075
                    px = (232, 200, 120, 255) if v else (base[0], base[1], base[2], 255)
                raw += bytes(px)
        def chunk(t, data): return struct.pack('>I', len(data)) + t + data + struct.pack('>I', zlib.crc32(t + data) & 0xffffffff)
        return b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 6, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(bytes(raw), 9)) + chunk(b'IEND', b'')
    for sz in (192, 512): open(os.path.join(d, f'icon-{sz}.png'), 'wb').write(png(sz))
    ver = str(int(time.time()))
    pwa_html = html.replace('<meta charset="utf-8">', '<meta charset="utf-8">\n<meta name="theme-color" content="#16222c">\n<link rel="manifest" href="manifest.webmanifest">\n<link rel="icon" href="icon-192.png">', 1).replace('</body>', "<script>if('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(function(){});</script>\n</body>", 1)
    open(os.path.join(d, 'index.html'), 'w', encoding='utf-8').write(pwa_html)
    open(os.path.join(d, 'manifest.webmanifest'), 'w', encoding='utf-8').write(json.dumps({'name': 'Victoria — Una era de revolución', 'short_name': 'Victoria', 'start_url': './', 'scope': './', 'display': 'fullscreen', 'display_override': ['fullscreen', 'standalone'], 'orientation': 'landscape', 'background_color': '#16222c', 'theme_color': '#16222c', 'lang': 'es', 'icons': [{'src': 'icon-192.png', 'sizes': '192x192', 'type': 'image/png', 'purpose': 'any'}, {'src': 'icon-512.png', 'sizes': '512x512', 'type': 'image/png', 'purpose': 'any maskable'}]}, ensure_ascii=False, indent=1))
    open(os.path.join(d, 'sw.js'), 'w', encoding='utf-8').write(f"""// Service worker: permite instalar el juego y jugar sin conexión.
const CACHE = 'victoria-{ver}';
const FILES = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png'];
self.addEventListener('install', e => {{ e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); }});
self.addEventListener('activate', e => {{ e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); }});
self.addEventListener('fetch', e => {{
  if (e.request.method !== 'GET') return;
  // red primero (para recibir versiones nuevas) y, si no hay conexión, la copia guardada
  e.respondWith(fetch(e.request).then(r => {{ const cp = r.clone(); caches.open(CACHE).then(c => c.put(e.request, cp)); return r; }}).catch(() => caches.match(e.request).then(m => m || caches.match('./index.html'))));
}});
""")
    print('docs/ (PWA)', os.listdir(d))
