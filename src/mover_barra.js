/* ===== MOVER EL EJÉRCITO SELECCIONADO EN LA BARRA INFERIOR PULSANDO UNA PROVINCIA =====
   Al elegir un ejército en la barra inferior queda en «modo mover»: el cursor es una mira, un clic en cualquier provincia le da la orden (Mayús: añade una parada a la ruta;
   clic derecho también vale) y al pasar el ratón por el mapa aparece una etiqueta con el nombre de la provincia, los días de marcha y los obstáculos del camino (ríos y cordilleras)
   o «inaccesible». Pulsar otra vez la tarjeta o Esc suelta el ejército; un clic en el mar no lo suelta. */
const _selectArmyMB = selectArmy;
selectArmy = function (id, add) {
  _selectArmyMB(id, add); const a = id ? armyById(id) : null;
  if (a && ownsArmy(a) && !add) { UI.moveMode = true; document.body.classList.add('movemode'); if (!MB.tip) { MB.tip = true; toast('🎯', 'Ejército seleccionado: haz clic en una provincia del mapa para moverlo (Mayús: añadir parada · Esc: soltar).'); } }
};
const MB = {tip: false, key: '', t: 0, el: null};
function mbEl() { if (MB.el) return MB.el; const d = document.createElement('div'); d.id = 'movehint'; d.style.cssText = 'position:fixed;z-index:60;pointer-events:none;display:none;padding:4px 9px;border-radius:5px;font:600 13px sans-serif;background:rgba(14,19,24,.92);border:1px solid #c9a657;color:#f2e6bf;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,.6)'; document.body.appendChild(d); return (MB.el = d); }
const _onMapHoverMB = window.onMapHover;
window.onMapHover = function (id, e) {
  if (_onMapHoverMB) _onMapHoverMB(id, e);
  try {
    const a = UI.selArmy ? armyById(UI.selArmy) : null; const el = mbEl();
    if (!a || !ownsArmy(a) || R.mode === 'naval' || R.mode === 'air' || UI.draw || UI.landNext || document.body.classList.contains('dragging')) { el.style.display = 'none'; return; }
    const pid = provAtWorld(screenToWorld(e.clientX, e.clientY)); MB.t = performance.now();
    if (pid < 0) { el.style.display = 'none'; return; }
    const key = a.id + ':' + pid + ':' + G.date.t;
    if (key !== MB.key && performance.now() - (MB.lc || 0) > 110) {
      MB.key = key; MB.lc = performance.now(); let txt;
      if (pid === a.loc) txt = '📍 ' + provName(pid) + ' · aquí';
      else { const p = findPath(a, pid); if (!p || !p.length) txt = '⛔ ' + provName(pid) + ' · inaccesible'; else { let d = 0, prev = a.loc, rv = 0, mt = 0; p.forEach(q => { d += hopDays(a, prev, q); if (typeof obEdge === 'function') { const ed = obEdge(prev, q); if (ed) { if (ed.river) rv++; if (ed.ridge) mt++; } } prev = q; }); txt = `🎯 ${provName(pid)} · ${d} día${d === 1 ? '' : 's'}${rv ? ' · 🌊×' + rv : ''}${mt ? ' · ⛰️×' + mt : ''}`; } }
      el.textContent = txt; el.style.borderColor = txt[0] === '⛔' ? '#e8644f' : '#c9a657';
    }
    el.style.left = Math.min(innerWidth - 240, e.clientX + 16) + 'px'; el.style.top = (e.clientY + 18) + 'px'; el.style.display = 'block';
  } catch (er) { }
};
setInterval(() => { if (MB.el && performance.now() - MB.t > 900) MB.el.style.display = 'none'; if (!UI.selArmy && !UI.patrolNext && document.body.classList.contains('movemode') && UI.moveMode) { UI.moveMode = false; document.body.classList.remove('movemode'); } }, 400);
