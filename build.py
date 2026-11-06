#!/usr/bin/env python3
"""Compila src/ en dos formatos:
  · docs/  → WEB POR CARPETAS + PWA (por defecto): index.html pequeño + js/ css/ por separado, con caché versionada y service worker.
  · index.html (raíz) → versión de UN SOLO ARCHIVO (three.js incrustado), útil para abrir sin servidor y para las pruebas de tools/.
Opciones: --light (juego-ligero.html con three por CDN) · --no-single (no generar el index.html de la raíz) · --only-single (solo el archivo único)."""
import os, re, sys
light = '--light' in sys.argv
root = os.path.dirname(os.path.abspath(__file__))
def rd(p): return open(os.path.join(root, p), encoding='utf-8').read()
three = rd('vendor/three.min.js')
css = rd('src/style.css')
order = ['icons.js', 'geo.js', 'data.js', 'nombres.js', 'cities.js', 'mapgen.js', 'provinces.js', 'mapsmooth.js', 'sim.js', 'crisis.js', 'diplo.js', 'military.js', 'logistics.js', 'milecon.js', 'dcrisis.js', 'render.js', 'relieve3d.js', 'render3d.js', 'ui.js', 'ui_mil.js', 'battleviz.js', 'terreno.js', 'politics2.js', 'national.js', 'peace.js', 'coalition.js', 'landing.js', 'intel.js', 'espionaje.js', 'mil2.js', 'doctrinas.js', 'plantillas.js', 'produccion.js', 'aviacion.js', 'marina.js', 'resistencia.js', 'suministros.js', 'convoyes.js', 'tactica.js', 'tactica2.js', 'tactica3.js', 'asedios.js', 'aspecto.js', 'campo.js', 'pueblos.js', 'terreno2.js', 'elev_data.js', 'relieve.js', 'realismo.js', 'campo2.js', 'mando.js', 'linea.js', 'ejercito.js', 'campo3.js', 'batalla2.js', 'batalla3.js', 'batalla4.js', 'batalla5.js', 'batalla6.js', 'mando2.js', 'pintura.js', 'inicio.js', 'musica.js', 'mariscales.js', 'ia_guerra.js', 'ia_operaciones.js', 'ia_v3.js', 'moral.js', 'resumenes.js', 'asesor.js', 'ofertas_paz.js', 'navalviz.js', 'graficos.js', 'agua.js', 'vegetacion.js', 'ciudades3d.js', 'rotulos.js', 'rendimiento.js', 'content.js', 'historia.js', 'escenarios.js', 'manual.js', 'main.js']
def scen_data():
    out = []
    for y in (1910,):
        p = os.path.join(root, 'escenarios', f'{y}.b64')
        if os.path.exists(p): out.append(f'{y}:"' + open(p).read().strip() + '"')
    return ','.join(out)
js = '\n'.join(rd('src/' + f) for f in order).replace('/*SCEN_DATA*/', scen_data())
import hashlib
_i = order.index('elev_data.js')
def cat(files): return '\n'.join(rd('src/' + f) for f in files)
js_game, js_elev = cat([f for f in order if f != 'elev_data.js']), cat(['elev_data.js'])       # los datos de relieve van aparte y ANTES del juego (los módulos usan funciones hoisted entre sí: no se puede trocear el código)
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
if light or '--no-single' not in sys.argv:
    open(os.path.join(root, out), 'w', encoding='utf-8').write(html)
    print(out, len(html) // 1024, 'KB')


# ---------- WEB POR CARPETAS + PWA (docs/) ----------
if not light and '--only-single' not in sys.argv:
    import json, struct, zlib, math, shutil
    d = os.path.join(root, 'docs'); os.makedirs(d, exist_ok=True)
    for sub in ('js', 'css'): shutil.rmtree(os.path.join(d, sub), ignore_errors=True); os.makedirs(os.path.join(d, sub))
    def wr(rel, txt): open(os.path.join(d, rel), 'w', encoding='utf-8').write(txt)
    def h8(t): return hashlib.sha1(t.encode('utf-8')).hexdigest()[:8]
    # en la versión por carpetas los escenarios viven en su propio archivo (se cachea aparte y no infla el código)
    scen_ext = 'var SCEN_EXT = {' + scen_data() + '};'
    js_game_f = js_game.replace('const SCEN_DATA = {/*SCEN_DATA*/};', "const SCEN_DATA = (typeof SCEN_EXT !== 'undefined' ? SCEN_EXT : {});")
    files = [('js/three.min.js', three), ('js/elevacion.js', js_elev), ('js/escenarios.js', scen_ext), ('js/game.js', js_game_f), ('css/style.css', css)]
    ver = {}
    for rel, txt in files: wr(rel, txt); ver[rel] = h8(txt)
    build_id = h8(''.join(ver[k] for k in sorted(ver)))
    def png(size):
        raw = bytearray(); c = size / 2.0
        for y in range(size):
            raw.append(0)
            for x in range(size):
                dx, dy = x - c + 0.5, y - c + 0.5; r = math.hypot(dx, dy) / c
                if r > 0.98: px = (0, 0, 0, 0)
                elif 0.86 < r <= 0.96: px = (201, 166, 87, 255)
                else:
                    t = min(1.0, r); base = (int(34 - 14 * t), int(52 - 18 * t), int(66 - 22 * t)); ax = dx / c; ay = dy / c
                    v = abs(ax) < 0.34 and -0.42 < ay < 0.4 and abs(abs(ax) - (ay + 0.42) * 0.42) < 0.075
                    px = (232, 200, 120, 255) if v else (base[0], base[1], base[2], 255)
                raw += bytes(px)
        def chunk(t, data): return struct.pack('>I', len(data)) + t + data + struct.pack('>I', zlib.crc32(t + data) & 0xffffffff)
        return b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 6, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(bytes(raw), 9)) + chunk(b'IEND', b'')
    for sz in (192, 512): open(os.path.join(d, f'icon-{sz}.png'), 'wb').write(png(sz))
    q = lambda rel: f'{rel}?v={ver[rel]}'
    shell = f"""<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#16222c">
<title>Victoria — Una era de revolución (réplica web)</title>
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" href="icon-192.png">
<link rel="stylesheet" href="{q('css/style.css')}">
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
<script src="{q('js/three.min.js')}"></script>
<script src="{q('js/elevacion.js')}"></script>
<script src="{q('js/escenarios.js')}"></script>
<script src="{q('js/game.js')}"></script>
<script>if('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(function(){{}});</script>
</body>
</html>
"""
    wr('index.html', shell)
    wr('manifest.webmanifest', json.dumps({'name': 'Victoria — Una era de revolución', 'short_name': 'Victoria', 'start_url': './', 'scope': './', 'display': 'fullscreen', 'display_override': ['fullscreen', 'standalone'], 'orientation': 'landscape', 'background_color': '#16222c', 'theme_color': '#16222c', 'lang': 'es', 'icons': [{'src': 'icon-192.png', 'sizes': '192x192', 'type': 'image/png', 'purpose': 'any'}, {'src': 'icon-512.png', 'sizes': '512x512', 'type': 'image/png', 'purpose': 'any maskable'}]}, ensure_ascii=False, indent=1))
    precache = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png'] + [f'./{q(rel)}' for rel, _ in files]
    wr('sw.js', f"""// Service worker: instalable y jugable sin conexión. Caché versionada por contenido ({build_id}); red primero para recibir versiones nuevas.
const CACHE = 'victoria-{build_id}';
const FILES = {json.dumps(precache)};
self.addEventListener('install', e => {{ e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); }});
self.addEventListener('activate', e => {{ e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); }});
self.addEventListener('fetch', e => {{
  if (e.request.method !== 'GET') return;
  e.respondWith(fetch(e.request).then(r => {{ const cp = r.clone(); caches.open(CACHE).then(c => c.put(e.request, cp)); return r; }}).catch(() => caches.match(e.request).then(m => m || caches.match('./index.html'))));
}});
""")
    sizes = {rel: len(txt.encode('utf-8')) // 1024 for rel, txt in files}
    print('docs/ (web por carpetas + PWA)', build_id, sizes, 'index.html', len(shell) // 1024, 'KB')
