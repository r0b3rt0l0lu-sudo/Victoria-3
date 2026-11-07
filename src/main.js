/* ===== ARRANQUE ===== */
function setLoad(t) { const e = document.getElementById('loadtxt'); if (e) e.textContent = t; }
// el juego puede inyectarse DESPUÉS del evento load (se carga tras el WebAssembly y los datos): arrancar ya si la página está lista
const startGameBoot = () => {
  if (window.__booted) return; window.__booted = true;
  const steps = [
    ['Modelando el relieve del mundo…', () => buildMap()],
    ['Poblando los estados y calentando la economía…', () => initGame('GBR')],
    ['Preparando el mapa 3D…', () => { initRenderer(document.getElementById('gl')); computeEdges(G.ownerOf); fullRepaint(); computeLabels(); }],
    ['Casi listo…', () => { buildStart(); document.getElementById('start').style.display = 'block'; }]
  ];
  let i = 0;
  const next = () => {
    if (i >= steps.length) { const l = document.getElementById('loading'); l.classList.add('hide'); setTimeout(() => l.remove(), 700); return; }
    setLoad(steps[i][0]);
    setTimeout(() => {
      try { steps[i][1](); } catch (e) { console.error(e); setLoad('Error: ' + e.message); document.getElementById('loading').classList.add('err'); return; }
      i++; next();
    }, 60);
  };
  next();
};
if (document.readyState === 'complete') startGameBoot(); else window.addEventListener('load', startGameBoot);
