#!/usr/bin/env python3
"""Compila src/ en un único index.html (three.js incrustado)."""
import os, re
root = os.path.dirname(os.path.abspath(__file__))
def rd(p): return open(os.path.join(root, p), encoding='utf-8').read()
three = rd('vendor/three.min.js')
css = rd('src/style.css')
order = ['geo.js', 'data.js', 'mapgen.js', 'sim.js', 'render.js', 'ui.js', 'main.js']
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
<div id="labels"></div><div id="markers"></div>
<div id="hud"></div>
<div id="statepanel"></div>
<div id="windows"></div>
<div id="toasts"></div>
<div id="event"></div>
<div id="tooltip"></div>
<div id="start"></div>
<div id="loading"><h1>VICTORIA</h1><div class="lb"><i></i></div><p id="loadtxt">Cargando…</p></div>
<script>{three.replace("</script>", "<\\/script>")}</script>
<script>
{js.replace("</script>", "<\\/script>")}
</script>
</body>
</html>
'''
open(os.path.join(root, 'index.html'), 'w', encoding='utf-8').write(html)
print('index.html', len(html) // 1024, 'KB')
