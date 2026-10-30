#!/usr/bin/env python3
"""Comprueba la sintaxis de todo el JavaScript del juego (equivale a «npm run comprobar» en este repositorio)."""
import re, subprocess, sys, tempfile, os
src = open(os.path.join(os.path.dirname(__file__), '..', 'build.py'), encoding='utf-8').read()
m = re.search(r"order = \[(.*?)\]", src, re.S)
order = re.findall(r"'([^']+)'", m.group(1))
root = os.path.join(os.path.dirname(__file__), '..', 'src')
errs = 0
js = ''
for f in order:
    t = open(os.path.join(root, f), encoding='utf-8').read()
    r = subprocess.run(['node', '--check', '-'], input=t, capture_output=True, text=True) if False else None
    js += t + '\n'
with tempfile.NamedTemporaryFile('w', suffix='.js', delete=False, encoding='utf-8') as fh:
    fh.write(js); path = fh.name
r = subprocess.run(['node', '--check', path], capture_output=True, text=True)
if r.returncode:
    print(r.stderr); errs = 1
os.unlink(path)
print('comprobar: %d errores' % errs)
sys.exit(errs)
