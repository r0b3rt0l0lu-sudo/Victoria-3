#!/usr/bin/env python3
"""Compila src/ en un único index.html (three.js incrustado)."""
import os, re, sys
light = '--light' in sys.argv
root = os.path.dirname(os.path.abspath(__file__))
def rd(p): return open(os.path.join(root, p), encoding='utf-8').read()
three = rd('vendor/three.min.js')
css = rd('src/style.css')
order = ['icons.js', 'geo.js', 'data.js', 'cities.js', 'mapgen.js', 'provinces.js', 'mapsmooth.js', 'sim.js', 'crisis.js', 'diplo.js', 'military.js', 'logistics.js', 'milecon.js', 'dcrisis.js', 'render.js', 'render3d.js', 'ui.js', 'ui_mil.js', 'battleviz.js', 'politics2.js', 'national.js', 'peace.js', 'coalition.js', 'landing.js', 'intel.js', 'mil2.js', 'doctrinas.js', 'plantillas.js', 'produccion.js', 'aviacion.js', 'marina.js', 'resistencia.js', 'mariscales.js', 'ia_guerra.js', 'content.js', 'manual.js', 'main.js']
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
