/* ===== ARRANQUE ===== */
function setLoad(t) { const e = document.getElementById('loadtxt'); if (e) e.textContent = t; }
// el juego puede inyectarse DESPUÉS del evento load (se carga tras el WebAssembly y los datos): arrancar ya si la página está lista
const startGameBoot = () => {
  if (window.__booted) return; window.__booted = true;
  const pause = () => new Promise(r => setTimeout(r, 60));
  const steps = [
    ['Modelando el relieve del mundo…', async () => {
      // con Web Worker el relieve, los estados y la economía se generan fuera del hilo principal; si no se puede, como siempre
      let ok = false;
      if (wkUsable()) { try { ok = await wkBuildWorld(setLoad); } catch (e) { console.warn('Web Worker no disponible; se genera el mundo en el hilo principal.', e); } }
      if (ok) { R.worldByWorker = true; return; }
      setLoad('Modelando el relieve del mundo…'); await pause(); buildMap();
      setLoad('Poblando los estados y calentando la economía…'); await pause(); initGame('GBR');
    }],
    ['Preparando el mapa 3D…', () => { initRenderer(document.getElementById('gl')); computeEdges(G.ownerOf); fullRepaint(); computeLabels(); }],
    ['Casi listo…', () => { buildStart(); document.getElementById('start').style.display = 'block'; }]
  ];
  let i = 0;
  const next = () => {
    if (i >= steps.length) { const l = document.getElementById('loading'); l.classList.add('hide'); setTimeout(() => l.remove(), 700); return; }
    setLoad(steps[i][0]);
    setTimeout(() => {
      Promise.resolve().then(() => steps[i][1]()).then(() => { i++; next(); }, e => { console.error(e); setLoad('Error: ' + e.message); document.getElementById('loading').classList.add('err'); });
    }, 60);
  };
  next();
};
if (document.readyState === 'complete') startGameBoot(); else window.addEventListener('load', startGameBoot);
