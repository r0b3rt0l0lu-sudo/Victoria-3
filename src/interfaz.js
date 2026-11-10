/* ===== INTERFAZ SIMPLIFICADA =====
   · Barra superior: 11 botones → 4 (asesor, buscar, partidas, menú ☰). Diario, logros, manual, sonido y «salir al menú» van dentro de ☰.
     Guardar, cargar, exportar e importar eran 4 botones: ahora es uno, «Partidas» (el gestor con ranuras ya los incluye).
   · Controles del mapa: 13 → 6 (zoom, inicio, giro y ☀ «Vista y gráficos»). Inclinar, rueda, borde, animaciones, calidad y tamaño de la interfaz
     viven en el panel ☀ (junto a relieve, luz y rendimiento), en vez de repartirse en tres sitios.
   · Ventanas con muchas pestañas (Ejército, Diplomacia): primero se elige la sección y debajo solo se ven sus pestañas.
   Los botones antiguos siguen existiendo (ocultos o dentro de ☰) para que el resto del código y los atajos de teclado funcionen igual. */
function uiSimplify() {
  const tr = document.getElementById('topright'), cc = document.getElementById('camctl'); if (!tr || !cc || tr.dataset.simp) return; tr.dataset.simp = '1';
  const f = (a, w) => tr.querySelector(`[data-act="${a}"]${w ? `[data-w="${w}"]` : ''}`);
  // ---- barra superior
  const save = f('save'); if (save) { save.dataset.tip = '<b>Partidas</b><br>Guardar, cargar, exportar e importar. <small>Se guarda sola cada año.</small>'; save.setAttribute('aria-label', 'Partidas'); }
  ['exportsave', 'importsave', 'load'].forEach(a => { const b = f(a); if (b) b.classList.add('hid'); });
  const menu = document.createElement('div'); menu.id = 'topmenu';
  [[f('win', 'journal'), '📜', 'Diario'], [f('win', 'achievements'), '🏅', 'Logros'], [f('win', 'manual'), '📖', 'Manual <small>F1</small>'], [f('gomenu'), '🚪', 'Salir al menú principal']].forEach(([b, ic, lb]) => {
    if (!b) return; const snd = b.classList.contains('sndbtn'); b.className = 'tm-row' + (snd ? ' sndbtn' : ''); b.innerHTML = `<span class="tmi">${ic}</span><span class="tml">${lb}</span>`; menu.appendChild(b);
  });
  // el botón de música original (que cambia de icono por su cuenta) queda oculto; en ☰ hay una fila con etiqueta y estado
  { const mu = f('music'); if (mu) { mu.classList.add('hid'); tr.appendChild(mu); }
    const row = document.createElement('button'); row.className = 'tm-row'; row.id = 'tm-music'; row.dataset.act = 'music'; row.dataset.tip = 'Clic: silenciar o activar · clic derecho: volumen'; menu.insertBefore(row, menu.lastElementChild);
    const upd = () => { if (typeof MUS !== 'undefined') row.innerHTML = `<span class="tmi">${MUS.on ? '🎵' : '🔇'}</span><span class="tml">Música y sonido <small>${MUS.on ? 'activados' : 'silenciados'}</small></span>`; }; upd(); setInterval(upd, 500); }
  const mb = document.createElement('button'); mb.className = 'rbtn'; mb.id = 'btn-topmenu'; mb.dataset.act = 'topmenu'; mb.setAttribute('aria-label', 'Más opciones'); mb.dataset.tip = '<b>Menú</b><br>Diario, logros, manual, sonido y salir.'; mb.textContent = '☰';
  tr.appendChild(mb); tr.appendChild(menu);
  // ---- controles del mapa: solo lo que se usa constantemente
  ['tiltu', 'tiltd', 'wheelmode', 'animtoggle', 'quality', 'uisize', 'edgescroll'].forEach(a => { const b = cc.querySelector(`[data-act="${a}"]`); if (b) b.classList.add('hid'); });
  if (typeof iconize === 'function') { try { iconize(tr); } catch (e) { } }
  if (typeof trLayout === 'function') trLayout();
}
const _uiBuildHud = buildHud;
buildHud = function () { const r = _uiBuildHud.apply(this, arguments); uiSimplify(); return r; };
Object.assign(ACT, {
  topmenu: () => { const m = document.getElementById('topmenu'); if (m) m.classList.toggle('open'); try { hideTip(); } catch (e) { } }
});
// el menú ☰ se cierra al tocar fuera o al elegir una opción
document.addEventListener('pointerdown', e => { const m = document.getElementById('topmenu'); if (m && m.classList.contains('open') && !m.contains(e.target) && !e.target.closest('#btn-topmenu')) m.classList.remove('open'); }, true);
document.addEventListener('click', e => { const r = e.target.closest && e.target.closest('#topmenu .tm-row'); if (r) { const m = document.getElementById('topmenu'); if (m) m.classList.remove('open'); } }, true);
// panel ☀ «Vista y gráficos»: ahí está todo lo de la vista del mapa
if (typeof gfxPanelHtml === 'function') {
  const _uiGfx = gfxPanelHtml;
  gfxPanelHtml = function () {
    const sz = ['Normal', 'Grande', 'Enorme'][UI.sz === undefined ? 1 : UI.sz] || 'Grande', on = v => v ? ' class="on"' : '';
    const extra = `<div class="gfx-row"><span>Cámara e interfaz</span><div class="gfx-seg gfx-wrap">
      <button data-act="tiltu" data-tip="Inclinar más (R)">⤒ Inclinar</button><button data-act="tiltd" data-tip="Inclinar menos (F)">⤓ Aplanar</button>
      <button data-act="wheelmode" data-tip="Qué hace la rueda del ratón">🖱️ Rueda: ${R.wheelMode === 'pan' ? 'mover' : 'zoom'}</button>
      <button data-act="edgescroll"${on(R.edgeScroll)} data-tip="Mover el mapa al acercar el ratón al borde">⇱ Borde</button>
      <button data-act="animtoggle"${on(R.anim)} data-tip="Animación del agua y las nubes">≈ Agua y nubes</button>
      <button data-act="uisize" data-tip="Tamaño de menús y ventanas">Aa Interfaz: ${sz}</button></div></div>`;
    return _uiGfx().replace('Gráficos del mapa<', 'Vista y gráficos<').replace('<p class="gfx-note">', extra + '<p class="gfx-note">');
  };
  // tras pulsar uno de esos botones el panel se redibuja para mostrar su nuevo estado
  document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('#gfxpanel [data-act]'); if (b && /^(tiltu|tiltd|wheelmode|edgescroll|animtoggle|uisize)$/.test(b.dataset.act)) setTimeout(() => { if (document.getElementById('gfxpanel')) openGfxPanel(true); }, 60); });
}
const _uiCss = document.createElement('style'); _uiCss.textContent = `
.hid{display:none!important}
#topright{position:fixed}#topmenu{display:none;position:absolute;top:calc(100% + 8px);right:0;min-width:230px;padding:6px;background:linear-gradient(180deg,rgba(40,50,60,.98),rgba(20,26,32,.98));border:1px solid var(--gold);border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,.65);z-index:60;flex-direction:column;gap:2px}
#topmenu.open{display:flex}
#topmenu .tm-row{display:flex;align-items:center;gap:10px;width:100%;padding:9px 12px;border:0;border-radius:8px;background:none;color:var(--text);font:inherit;font-size:14px;text-align:left;cursor:pointer;box-shadow:none;height:auto}
#topmenu .tm-row:hover{background:rgba(201,166,87,.16)}#topmenu .tm-row .tmi{width:24px;text-align:center;font-size:17px}#topmenu .tm-row small{color:var(--dim)}
#topmenu .tm-row.sndbtn.muted{opacity:.6}
#gfxpanel .gfx-wrap{flex-wrap:wrap}#gfxpanel .gfx-wrap button{flex:1 1 30%;font-size:12px;padding:6px 4px;white-space:normal}#gfxpanel{max-height:calc(100vh - 90px);overflow-y:auto}`;
document.head.appendChild(_uiCss);
