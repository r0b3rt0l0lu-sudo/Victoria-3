/* ===== MÓVIL 2: paneles de los mapas marítimo y aéreo como hoja inferior plegable, órdenes con toque, sin tooltips pegajosos, tablas desplazables =====
   · En el teléfono los paneles #seapanel y #airmappanel son una hoja sobre las barras inferiores: empiezan plegados (solo cabecera) y se despliegan al tocarla.
   · Sin botón derecho: el botón «🎯 Tocar destino» convierte el siguiente toque en el mapa en una orden (mover flotas/escuadrones o planear un desembarco).
   · En pantallas táctiles los tooltips (data-tip) no se muestran: eran una fuente de paneles que tapaban el menú. */
(function () {
  const st = document.createElement('style');
  st.textContent = `
  body.touch #tooltip{display:none!important}
  body.phone #seapanel,body.phone #airmappanel{left:6px!important;right:6px!important;width:auto!important;top:auto!important;bottom:122px!important;max-height:38vh!important;border-radius:10px 10px 6px 6px!important}
  body.phone.pl .ordbtn{bottom:12px;right:10px}
  body.phone.pl #seapanel,body.phone.pl #airmappanel{bottom:6px!important;right:auto!important;width:46vw!important;max-height:calc(100vh - 80px)!important;left:6px!important}
  body.phone #seapanel.min,body.phone #airmappanel.min{max-height:40px!important;overflow:hidden!important}
  body.phone #seapanel .sm-head,body.phone #airmappanel .sm-head{display:flex;align-items:center;justify-content:space-between;cursor:pointer;min-height:28px}
  body.phone #seapanel button,body.phone #airmappanel button{min-height:36px;padding:4px 10px}
  body.phone #seapanel input[type=checkbox],body.phone #airmappanel input[type=checkbox]{width:22px;height:22px}
  body.phone #seapanel .sm-row,body.phone #airmappanel label{padding:6px 4px!important}
  body.phone .tbl{display:block;overflow-x:auto;-webkit-overflow-scrolling:touch;max-width:100%}
  body.phone .tt-leg{display:none}
  body.phone .tt-wrap{height:calc(var(--vh,1vh)*100 - 270px)!important}
  body.phone #sealabels div{font-size:11px!important}
  body.phone .ordbtn{position:fixed;right:10px;bottom:calc(122px + 38vh + 8px);z-index:35;min-width:52px;min-height:52px;border-radius:26px;border:2px solid var(--laton-500,#b8903e);background:rgba(24,40,58,.96);color:#fff;font:700 13px sans-serif;box-shadow:0 3px 10px rgba(0,0,0,.5)}
  body.phone .ordbtn.on{background:#7d1f24;box-shadow:0 0 0 3px rgba(255,226,122,.6)}
  `;
  document.head.appendChild(st);
})();
// botón flotante «Tocar destino» (solo teléfono y modos marítimo/aéreo)
const ORD = {on: false, btn: null};
function ordBtn() {
  const show = MOV.phone && (R.mode === 'naval' || R.mode === 'air');
  if (!ORD.btn) { const b = ORD.btn = document.createElement('button'); b.className = 'ordbtn'; b.textContent = '🎯 Destino'; b.addEventListener('click', e => { e.stopPropagation(); ORD.on = !ORD.on; b.classList.toggle('on', ORD.on); b.textContent = ORD.on ? '👆 Toca el mapa' : '🎯 Destino'; if (ORD.on) toast('🎯', 'Toca un mar, región o costa: las unidades seleccionadas irán allí.'); }); document.body.appendChild(b); }
  ORD.btn.style.display = show ? 'block' : 'none'; if (!show && ORD.on) { ORD.on = false; ORD.btn.classList.remove('on'); ORD.btn.textContent = '🎯 Destino'; }
}
setInterval(ordBtn, 500);
// con «Tocar destino» activo, el clic izquierdo actúa como clic derecho (orden)
['onMapClick'].forEach(() => {
  const _c = window.onMapClick, _r = () => window.onMapRightClick;
  window.onMapClick = function (id, e, pid) { if (ORD.on && MOV.phone && (R.mode === 'naval' || R.mode === 'air')) { const f = _r(); ORD.on = false; ORD.btn.classList.remove('on'); ORD.btn.textContent = '🎯 Destino'; return f(id, e, pid); } return _c(id, e, pid); };
});
// hojas plegables: se pliegan/despliegan tocando la cabecera (la primera h3 del panel)
document.addEventListener('click', e => {
  if (!MOV.phone) return; const h = e.target.closest && e.target.closest('#seapanel > h3, #airmappanel > h3'); if (!h) return; const p = h.parentElement; p.classList.toggle('min'); p._userMin = p.classList.contains('min');
}, true);
setInterval(() => { if (!MOV.phone) return; ['seapanel', 'airmappanel'].forEach(id => { const p = document.getElementById(id); if (p && p._userMin === undefined && p.style.display !== 'none') { p.classList.add('min'); p._userMin = true; } }); }, 400);
