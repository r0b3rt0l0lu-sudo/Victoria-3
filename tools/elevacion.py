#!/usr/bin/env python3
"""Genera src/elev_data.js (altitud media y rugosidad por celda de ~0.7 grados) a partir de teselas Terrarium (AWS Terrain Tiles).
Uso: python3 tools/elevacion.py <carpeta con teselas 4_<x>_<y>.png, y=1..13>"""
import sys, math, base64, numpy as np
from PIL import Image
d = sys.argv[1]; Z = 4; N = 16; T = 256
W = N * T; rows = range(1, 14)
H = np.zeros((14 * T, W), np.float32)
for y in rows:
    for x in range(N):
        a = np.asarray(Image.open(f'{d}/4_{x}_{y}.png').convert('RGB'), np.float32)
        H[y * T:(y + 1) * T, x * T:(x + 1) * T] = a[..., 0] * 256 + a[..., 1] + a[..., 2] / 256 - 32768
CW, CH = 512, 205; LAT_TOP, LAT_BOT = 84, -60; S = 6
mean = np.zeros((CH, CW), np.uint8); rough = np.zeros((CH, CW), np.uint8)
def merc(lat): return (1 - math.log(math.tan(math.radians(lat)) + 1 / math.cos(math.radians(lat))) / math.pi) / 2 * W
for j in range(CH):
    for i in range(CW):
        xs = ((-180 + (i + (np.arange(S) + 0.5) / S) / CW * 360 + 180) / 360 * W).astype(int) % W
        ys = [int(merc(LAT_TOP - (j + (k + 0.5) / S) / CH * (LAT_TOP - LAT_BOT))) for k in range(S)]
        v = np.array([[H[min(max(y, T), 14 * T - 1), x] for x in xs] for y in ys]).ravel()
        land = v[v > 0]
        if len(land) < 3: continue
        mean[j, i] = min(255, int(land.mean() / 25)); rough[j, i] = min(255, int(land.std() / 10))
open('src/elev_data.js', 'w').write("/* Elevación real (AWS Terrain Tiles / SRTM+GEBCO). Malla 512x205 sobre el mapa del juego: altitud media (x25 m) y rugosidad (desv. típica, x10 m). Generado por tools/elevacion.py */\nconst ELEV = {w: 512, h: 205, m: '%s', r: '%s'};\n" % (base64.b64encode(mean.tobytes()).decode(), base64.b64encode(rough.tobytes()).decode()))
def at(lon, lat):
    i = int((lon + 180) / 360 * CW); j = int((LAT_TOP - lat) / (LAT_TOP - LAT_BOT) * CH); return int(mean[j, i]) * 25, int(rough[j, i]) * 10
for nm, lon, lat in [('Alpes', 8.0, 46.5), ('Holanda', 5.0, 52.2), ('Himalaya', 87, 28), ('Sahara', 10, 24), ('Meseta española', -4, 40), ('Apalaches', -80, 37), ('Pampa', -62, -34), ('Andes', -70, -30), ('Cáucaso', 44, 42.5)]:
    print(nm, at(lon, lat))
