#!/usr/bin/env python3
"""Compila src/ en dos formatos (JS y CSS minificados con esbuild si está instalado: `npm install`):
  · docs/  → WEB POR CARPETAS + PWA (por defecto): index.html mínimo + js/ css/ data/ wasm/, datos en BINARIO, caché versionada y service worker.
  · index.html (raíz) → UN SOLO ARCHIVO (three.js, datos y WebAssembly incrustados); lo usan las pruebas de tools/.
Opciones: --light (juego-ligero.html con three por CDN) · --no-single · --only-single · --no-min (sin minificar)."""
import os, re, sys, json, base64, hashlib, subprocess, struct, zlib, math, shutil
light = '--light' in sys.argv
root = os.path.dirname(os.path.abspath(__file__))
def rd(p): return open(os.path.join(root, p), encoding='utf-8').read()
def rdb(p): return open(os.path.join(root, p), 'rb').read()
ESB = os.path.join(root, 'node_modules', '.bin', 'esbuild')
def mini(txt, loader):
    """Minifica con esbuild (los nombres globales no se renombran: el juego comparte ámbito global). Sin esbuild, devuelve el texto tal cual."""
    if '--no-min' in sys.argv or not os.path.exists(ESB): return txt
    r = subprocess.run([ESB, '--minify', f'--loader={loader}', '--legal-comments=none', '--target=es2020'], input=txt, capture_output=True, text=True)
    if r.returncode != 0 or not r.stdout: print('esbuild falló, sin minificar:', r.stderr[:200]); return txt
    return r.stdout
three = rd('vendor/three.min.js')
css = mini(rd('src/style.css'), 'css')
order = ['icons.js', 'geo.js', 'data.js', 'nombres.js', 'wasmk.js', 'cities.js', 'mapgen.js', 'provinces.js', 'mapsmooth.js', 'sim.js', 'crisis.js', 'diplo.js', 'military.js', 'logistics.js', 'milecon.js', 'dcrisis.js', 'render.js', 'relieve3d.js', 'troops3d.js', 'render3d.js', 'tropas3d_mapa.js', 'ui.js', 'ui_mil.js', 'battleviz.js', 'terreno.js', 'politics2.js', 'national.js', 'peace.js', 'coalition.js', 'diplo2.js', 'landing.js', 'intel.js', 'espionaje.js', 'mil2.js', 'doctrinas.js', 'plantillas.js', 'produccion.js', 'aviacion.js', 'marina.js', 'resistencia.js', 'suministros.js', 'convoyes.js', 'tactica.js', 'tactica2.js', 'tactica3.js', 'asedios.js', 'aspecto.js', 'campo.js', 'pueblos.js', 'terreno2.js', 'elev_data.js', 'relieve.js', 'realismo.js', 'campo2.js', 'mando.js', 'linea.js', 'ejercito.js', 'campo3.js', 'batalla2.js', 'batalla3.js', 'batalla4.js', 'batalla5.js', 'batalla6.js', 'mando2.js', 'pintura.js', 'inicio.js', 'musica.js', 'guardado.js', 'ranuras.js', 'mariscales.js', 'ia_guerra.js', 'ia_operaciones.js', 'ia_v3.js', 'moral.js', 'resumenes.js', 'asesor.js', 'ofertas_paz.js', 'navalviz.js', 'graficos.js', 'agua.js', 'vegetacion.js', 'ciudades3d.js', 'rotulos.js', 'rendimiento.js', 'content.js', 'historia.js', 'escenarios.js', 'manual.js', 'realismo3.js', 'batalla3d.js', 'calidad.js', 'workers.js', 'main.js']
def cat(files): return '\n'.join(rd('src/' + f) for f in files)
def h8(b): return hashlib.sha1(b if isinstance(b, bytes) else b.encode('utf-8')).hexdigest()[:8]
SCEN_YEARS = [y for y in (1910,) if os.path.exists(os.path.join(root, 'escenarios', f'{y}.b64'))]
scen_b64 = {y: rd(f'escenarios/{y}.b64').strip() for y in SCEN_YEARS}
wasm = rdb('wasm/kernels.wasm') if os.path.exists(os.path.join(root, 'wasm', 'kernels.wasm')) else b''
# ---- elevación en binario: [w u32][h u32][m w*h][r w*h]  (se genera a partir de src/elev_data.js) ----
em = re.search(r"const ELEV = \{w: (\d+), h: (\d+), m: '([^']+)', r: '([^']+)'\}", rd('src/elev_data.js'))
elev_w, elev_h = int(em.group(1)), int(em.group(2)); elev_bin = struct.pack('<II', elev_w, elev_h) + base64.b64decode(em.group(3)) + base64.b64decode(em.group(4))
scen_bin = {y: base64.b64decode(b) for y, b in scen_b64.items()}
js_single = mini(cat(order).replace('/*SCEN_DATA*/', ','.join(f'{y}:"{b}"' for y, b in scen_b64.items())), 'js')
js_folder = mini(cat([f for f in order if f != 'elev_data.js']).replace('const SCEN_DATA = {/*SCEN_DATA*/};', 'const SCEN_DATA = (window.__SCEN || {});'), 'js')
BODY = '''<canvas id="gl"></canvas>
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
<div id="loading"><h1>VICTORIA</h1><div class="lb"><i></i></div><p id="loadtxt">Cargando…</p></div>'''
TITLE = 'Victoria — Una era de revolución (réplica web)'
# ---------- 1) UN SOLO ARCHIVO ----------
three_tag = '<script src="https://cdn.jsdelivr.net/npm/three@0.152.0/build/three.min.js"></script>' if light else '<script>' + three.replace('</script>', '<\\/script>') + '</script>'
boot_single = """<script>(function(){if(/nowasm/.test(location.search))window.__WK_OFF=1;var g=document.getElementById('game').textContent;function run(){var s=document.createElement('script');s.textContent=g;document.body.appendChild(s);}
try{var w=document.getElementById('wasm64'),b=atob(w.textContent.trim()),u=new Uint8Array(b.length);for(var i=0;i<b.length;i++)u[i]=b.charCodeAt(i);if(!u.length)throw 0;WebAssembly.instantiate(u,{}).then(function(r){window.__WK_EX=r.instance.exports;window.__WK_MOD=r.module;run();},run);}catch(e){run();}})();</script>"""
html = f'''<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{TITLE}</title>
<style>{css}</style>
</head>
<body>
{BODY}
{three_tag}
<script id="wasm64" type="text/plain">{base64.b64encode(wasm).decode()}</script>
<script id="game" type="text/plain">
{js_single.replace("</script>", "<\\/script>")}
</script>
{boot_single}
</body>
</html>
'''
out = 'juego-ligero.html' if light else 'index.html'
if light or '--no-single' not in sys.argv:
    open(os.path.join(root, out), 'w', encoding='utf-8').write(html)
    print(out, len(html) // 1024, 'KB')
# ---------- 2) WEB POR CARPETAS + PWA (docs/) ----------
if not light and '--only-single' not in sys.argv:
    d = os.path.join(root, 'docs'); os.makedirs(d, exist_ok=True)
    for sub in ('js', 'css', 'data', 'wasm'): shutil.rmtree(os.path.join(d, sub), ignore_errors=True); os.makedirs(os.path.join(d, sub))
    files = {}
    def put(rel, data): open(os.path.join(d, rel), 'wb').write(data if isinstance(data, bytes) else data.encode('utf-8')); files[rel] = h8(data)
    put('js/three.min.js', three); put('js/game.js', 'const ELEV = window.__ELEV;\n' + js_folder); put('css/style.css', css)
    put('data/elevacion.bin', elev_bin); put('wasm/kernels.wasm', wasm)
    for y in SCEN_YEARS: put(f'data/{y}.bin', scen_bin[y])
    # respaldo para abrir con doble clic (file://, donde fetch está bloqueado): los mismos datos en base64 dentro de un script
    put('js/datos-b64.js', 'window.__B64 = ' + json.dumps({'elev': base64.b64encode(elev_bin).decode(), 'wasm': base64.b64encode(wasm).decode(), 'scen': {str(y): base64.b64encode(scen_bin[y]).decode() for y in SCEN_YEARS}}) + ';')
    v = lambda rel: f'?v={files[rel]}'
    boot = r"""/* Arranque: carga el WebAssembly y los datos binarios y después el juego. Con file:// (sin servidor) usa el respaldo en base64. */
(async function () {
  var V = %s;
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
""" % json.dumps(files)
    put('js/boot.js', boot)
    shell = f'''<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#16222c">
<title>{TITLE}</title>
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" href="icon-192.png">
<link rel="stylesheet" href="css/style.css{v('css/style.css')}">
<link rel="preload" href="js/game.js{v('js/game.js')}" as="script">
</head>
<body>
{BODY}
<script src="js/boot.js{v('js/boot.js')}"></script>
<script>if('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(function(){{}});</script>
</body>
</html>
'''
    open(os.path.join(d, 'index.html'), 'w', encoding='utf-8').write(shell)
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
                    vv = abs(ax) < 0.34 and -0.42 < ay < 0.4 and abs(abs(ax) - (ay + 0.42) * 0.42) < 0.075
                    px = (232, 200, 120, 255) if vv else (base[0], base[1], base[2], 255)
                raw += bytes(px)
        def chunk(t, data): return struct.pack('>I', len(data)) + t + data + struct.pack('>I', zlib.crc32(t + data) & 0xffffffff)
        return b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 6, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(bytes(raw), 9)) + chunk(b'IEND', b'')
    for sz in (192, 512): open(os.path.join(d, f'icon-{sz}.png'), 'wb').write(png(sz))
    open(os.path.join(d, 'manifest.webmanifest'), 'w', encoding='utf-8').write(json.dumps({'name': 'Victoria — Una era de revolución', 'short_name': 'Victoria', 'start_url': './', 'scope': './', 'display': 'fullscreen', 'display_override': ['fullscreen', 'standalone'], 'orientation': 'landscape', 'background_color': '#16222c', 'theme_color': '#16222c', 'lang': 'es', 'icons': [{'src': 'icon-192.png', 'sizes': '192x192', 'type': 'image/png', 'purpose': 'any'}, {'src': 'icon-512.png', 'sizes': '512x512', 'type': 'image/png', 'purpose': 'any maskable'}]}, ensure_ascii=False, indent=1))
    build_id = h8(''.join(sorted(files.values())))
    precache = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png'] + [f'./{rel}?v={x}' for rel, x in files.items() if rel != 'js/datos-b64.js']
    open(os.path.join(d, 'sw.js'), 'w', encoding='utf-8').write(f"""// Service worker: instalable y jugable sin conexión. Caché versionada por contenido ({build_id}); red primero para recibir versiones nuevas.
const CACHE = 'victoria-{build_id}';
const FILES = {json.dumps(precache)};
self.addEventListener('install', e => {{ e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); }});
self.addEventListener('activate', e => {{ e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); }});
self.addEventListener('fetch', e => {{
  if (e.request.method !== 'GET') return;
  e.respondWith(fetch(e.request).then(r => {{ const cp = r.clone(); caches.open(CACHE).then(c => c.put(e.request, cp)); return r; }}).catch(() => caches.match(e.request).then(m => m || caches.match('./index.html'))));
}});
""")
    print('docs/ (web por carpetas + PWA)', build_id, {k: os.path.getsize(os.path.join(d, k)) // 1024 for k in files}, 'KB')
