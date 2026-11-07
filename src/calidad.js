/* ===== RENDIMIENTO Y CALIDAD: panel de opciones + contador en pantalla (F3) =====
   Amplía el botón Q y el panel ☀: resolución, límite de fotogramas, sombras, tropas 3D / sencillas / ocultas, agua y nubes.
   El contador mide fotogramas, tiempo de dibujado, tiempo de simulación por día y memoria, y puede copiar un informe para diagnosticar un equipo concreto.
   Todo se guarda en el navegador (victoria-perf). «Automático» devuelve el control al ajuste automático de rendimiento.js. */
const PERF = {dts: [], simMs: 0, simMax: 0, simN: 0, simT: 0, draws: 0, fps: 0, dfps: 0, ft: 0, p95: 0, slow: 0, t0: 0, rn0: 0, mem: 0, show: false};
const PERF_KEY = 'victoria-perf';
function perfLoad() { try { const p = JSON.parse(localStorage.getItem(PERF_KEY) || '{}'); R.resUser = p.res || null; R.fpsCap = p.cap || 0; R.shadowsUser = p.sh === undefined ? null : p.sh; R.figMode = p.fig || '3d'; R.animUser = p.anim === undefined ? null : p.anim; PERF.show = !!p.show; } catch (e) { } }
function perfSave() { try { localStorage.setItem(PERF_KEY, JSON.stringify({res: R.resUser || null, cap: R.fpsCap || 0, sh: R.shadowsUser, fig: R.figMode, anim: R.animUser, show: PERF.show})); } catch (e) { } }
perfLoad();
// ---- medición ----
const _perfAD = advanceDay;
advanceDay = function () { const t0 = performance.now(); try { return _perfAD.apply(this, arguments); } finally { const d = performance.now() - t0; PERF.simT += d; PERF.simN++; PERF.simMs = PERF.simMs ? PERF.simMs * 0.95 + d * 0.05 : d; if (d > PERF.simMax) PERF.simMax = d; } };
const _perfOF = window.onFrame; let _pLast = 0;
window.onFrame = function (t) { if (_pLast) { const d = t - _pLast; PERF.dts.push(d); if (PERF.dts.length > 180) PERF.dts.shift(); if (d > 50) PERF.slow++; } _pLast = t; return _perfOF && _perfOF.apply(this, arguments); };
function perfStats() {
  const a = PERF.dts.slice(), n = a.length || 1, avg = a.reduce((x, y) => x + y, 0) / n, s = a.sort((x, y) => x - y);
  PERF.ft = avg; PERF.fps = avg ? 1000 / avg : 0; PERF.p95 = s.length ? s[Math.min(s.length - 1, Math.floor(s.length * 0.95))] : 0;
  const now = performance.now(); if (now - PERF.t0 > 1000) { PERF.dfps = (R.rn - PERF.rn0) * 1000 / (now - PERF.t0); PERF.t0 = now; PERF.rn0 = R.rn || 0; }
  try { PERF.mem = performance.memory ? performance.memory.usedJSHeapSize / 1048576 : 0; } catch (e) { PERF.mem = 0; }
  return PERF;
}
// ---- aplicar opciones ----
function perfApply() {
  try {
    if (R.resUser) { R.resScale = R.resUser; if (typeof resizeRenderer === 'function') resizeRenderer(); }
    if (typeof applyShadows === 'function' && R.sun) applyShadows();
    const m = R.figMode || '3d'; R.tropas3dOff = m !== '3d'; R.showFigs = m !== 'off'; if (R.t3) R.t3.group.visible = m === '3d';
    if (R.animUser !== null && R.animUser !== undefined && !!R.anim !== !!R.animUser && R.waterMesh) ACT.animtoggle();
    R.dirty = true;
  } catch (e) { console.warn('perfApply', e); }
}
const _perfAQ = applyQuality;
applyQuality = function () { const r = _perfAQ.apply(this, arguments); perfApply(); return r; };
setTimeout(() => { if (R.renderer) perfApply(); }, 2500);
// ---- contador en pantalla ----
function perfBoxUpdate() {
  let b = document.getElementById('perfbox');
  if (!PERF.show) { if (b) b.remove(); return; }
  if (!b) { b = document.createElement('div'); b.id = 'perfbox'; document.body.appendChild(b); }
  const p = perfStats(), cls = p.fps >= 50 ? 'ok' : p.fps >= 28 ? 'mid' : 'bad';
  b.className = cls; b.textContent = `${Math.round(p.fps)} fps · ${p.ft.toFixed(0)} ms · día ${PERF.simMs.toFixed(1)} ms${p.mem ? ' · ' + Math.round(p.mem) + ' MB' : ''}`;
}
// ---- panel ----
const perfSeg = (k, opts, cur) => `<div class="pf-seg">${opts.map(([v, l]) => `<button data-act="perfset" data-k="${k}" data-v="${v}" class="${String(cur) === String(v) ? 'on' : ''}">${l}</button>`).join('')}</div>`;
function perfPanelHtml() {
  const hw = (R.hw && R.hw.hw) || hwProbe(), gpu = (R.hw && R.hw.gpu) || '', res = Math.round((R.resScale || 1) * 100), auto = !R.resUser;
  const q = R.qualityManual ? R.quality : 'auto';
  return `<div class="pf-h">Rendimiento y calidad<button data-act="perfpanel" aria-label="Cerrar">✕</button></div>
  <div class="pf-row"><span>Calidad general</span>${perfSeg('q', [['auto', 'Auto'], ['bajo', 'Baja'], ['medio', 'Media'], ['alto', 'Alta']], q)}</div>
  <div class="pf-row"><span>Resolución <b id="pf-resv">${auto ? 'auto · ' : ''}${res} %</b></span><input type="range" min="40" max="100" step="5" value="${res}" data-pf="res" aria-label="Resolución del mapa"><label class="pf-tog"><input type="checkbox" data-pf="resauto" ${auto ? 'checked' : ''}> Ajustar sola según la carga</label></div>
  <div class="pf-row"><span>Límite de fotogramas</span>${perfSeg('cap', [[0, 'Libre'], [60, '60'], [30, '30']], R.fpsCap || 0)}</div>
  <div class="pf-row"><span>Sombras</span>${perfSeg('sh', [['auto', 'Auto'], ['1', 'Sí'], ['0', 'No']], R.shadowsUser == null ? 'auto' : R.shadowsUser ? 1 : 0)}</div>
  <div class="pf-row"><span>Tropas en el mapa</span>${perfSeg('fig', [['3d', '3D'], ['simple', 'Sencillas'], ['off', 'Ocultas']], R.figMode || '3d')}</div>
  <label class="pf-tog"><input type="checkbox" data-pf="anim" ${R.anim ? 'checked' : ''}> Agua y nubes animadas</label>
  <label class="pf-tog"><input type="checkbox" data-pf="show" ${PERF.show ? 'checked' : ''}> Contador en pantalla <small>(F3)</small></label>
  <div class="pf-stats" id="pf-stats"></div>
  <div class="pf-btns"><button data-act="perfcopy">📋 Copiar informe</button><button data-act="perfreset">↺ Restablecer</button></div>
  <p class="pf-note">${gpu ? gpu.replace(/\(.*?\)/g, '').slice(0, 44) + ' · ' : ''}${hw.cores} núcleos${hw.mem ? ' · ' + hw.mem + ' GB' : ''}${hw.cros ? ' · ChromeOS' : ''}. Si va a tirones: Calidad baja, tropas sencillas, límite 30.</p>`;
}
function perfStatsHtml() {
  const p = perfStats(), row = (l, v, c) => `<div class="pf-kv"><span>${l}</span><b class="${c || ''}">${v}</b></div>`, f = p.fps;
  return row('Fotogramas', Math.round(f) + ' / s', f >= 50 ? 'ok' : f >= 28 ? 'mid' : 'bad') + row('Dibujados (solo si la imagen cambia)', Math.round(p.dfps) + ' / s') + row('Tiempo por fotograma', `${p.ft.toFixed(1)} ms · peor 5 %: ${p.p95.toFixed(0)} ms`, p.p95 > 50 ? 'bad' : p.p95 > 28 ? 'mid' : 'ok')
    + row('Dibujado (CPU)', (R.renderMs || 0).toFixed(1) + ' ms') + row('GPU (estimado)', R.gpuMs ? R.gpuMs.toFixed(1) + ' ms' : '—') + row('Simulación por día', `${PERF.simMs.toFixed(1)} ms · máx ${PERF.simMax.toFixed(0)} ms`, PERF.simMs > 25 ? 'bad' : PERF.simMs > 10 ? 'mid' : 'ok')
    + row('Fotogramas lentos (>50 ms)', PERF.slow) + (p.mem ? row('Memoria JS', Math.round(p.mem) + ' MB', p.mem > 900 ? 'bad' : p.mem > 500 ? 'mid' : '') : '') + row('Resolución · calidad', Math.round((R.resScale || 1) * 100) + ' % · ' + (R.quality || '—'));
}
let _pfTimer = 0;
function perfOpen() {
  let p = document.getElementById('perfpanel');
  if (p) { p.remove(); clearInterval(_pfTimer); return; }
  p = document.createElement('div'); p.id = 'perfpanel'; p.setAttribute('role', 'dialog'); p.setAttribute('aria-label', 'Rendimiento y calidad'); document.body.appendChild(p);
  const draw = () => { p.innerHTML = perfPanelHtml(); perfBind(p); perfLive(); };
  p._draw = draw; draw();
  const cc = document.getElementById('camctl'); if (cc && innerWidth > 640) { const r = cc.getBoundingClientRect(); p.style.right = Math.max(8, innerWidth - r.left + 8) + 'px'; }      // a la izquierda de los controles de cámara
  clearInterval(_pfTimer); _pfTimer = setInterval(() => { if (!document.getElementById('perfpanel')) { clearInterval(_pfTimer); return; } perfLive(); }, 500);
}
function perfLive() { const e = document.getElementById('pf-stats'); if (e) e.innerHTML = perfStatsHtml(); }
function perfRedraw() { const p = document.getElementById('perfpanel'); if (p && p._draw) p._draw(); }
function perfBind(p) {
  p.querySelectorAll('input[data-pf]').forEach(inp => {
    inp.addEventListener('keydown', e => e.stopPropagation());
    inp.addEventListener(inp.type === 'range' ? 'input' : 'change', () => {
      const k = inp.dataset.pf;
      if (k === 'res') { R.resUser = +inp.value / 100; R.resScale = R.resUser; resizeRenderer(); const v = p.querySelector('#pf-resv'); if (v) v.textContent = inp.value + ' %'; const c = p.querySelector('[data-pf=resauto]'); if (c) c.checked = false; }
      else if (k === 'resauto') { if (inp.checked) { R.resUser = null; R.resScale = 1; resizeRenderer(); } else R.resUser = R.resScale || 1; }
      else if (k === 'anim') { R.animUser = inp.checked; perfApply(); }
      else if (k === 'show') { PERF.show = inp.checked; perfBoxUpdate(); }
      perfSave();
    });
  });
}
Object.assign(ACT, {
  perfpanel: () => perfOpen(),
  perfset: d => {
    const k = d.k, v = d.v;
    if (k === 'q') { if (v === 'auto') { R.qualityManual = false; R._aqDone = false; R.resUser = null; try { localStorage.removeItem('victoria-autoq'); } catch (e) { } toast('🎞️', 'Calidad automática: se medirá de nuevo el rendimiento.'); autoQualityInit(); } else { R.qualityManual = true; R.resScale = 1; applyQuality(v, 'Calidad gráfica: ' + v); } saveMapPrefs(); }
    else if (k === 'cap') R.fpsCap = +v; else if (k === 'sh') { R.shadowsUser = v === 'auto' ? null : v === '1'; perfApply(); } else if (k === 'fig') { R.figMode = v; perfApply(); }
    perfSave(); R.dirty = true; perfRedraw();
  },
  perfcopy: () => {
    const p = perfStats(), hw = (R.hw && R.hw.hw) || hwProbe(), gpu = (R.hw && R.hw.gpu) || gpuName();
    const t = ['Victoria · informe de rendimiento', 'Fecha: ' + new Date().toISOString().slice(0, 19), `Equipo: ${hw.cores} núcleos, ${hw.mem} GB, ${hw.cros ? 'ChromeOS' : hw.android ? 'Android' : 'otro'}, pantalla ${hw.w}×${hw.h} @${hw.dpr}`, 'GPU: ' + gpu,
      `Calidad: ${R.quality}${R.qualityManual ? ' (manual)' : ' (auto)'} · resolución ${Math.round((R.resScale || 1) * 100)} % · tropas ${R.figMode || '3d'} · límite ${R.fpsCap || 'libre'} · sombras ${R.shadowsUser == null ? 'auto' : R.shadowsUser}`,
      `Fotogramas: ${p.fps.toFixed(0)}/s · ${p.ft.toFixed(1)} ms · peor 5 % ${p.p95.toFixed(0)} ms · lentos ${PERF.slow} · dibujados ${p.dfps.toFixed(0)}/s`, `Dibujado ${(R.renderMs || 0).toFixed(1)} ms · GPU ${(R.gpuMs || 0).toFixed(1)} ms · prueba inicial ${R.benchMs ? R.benchMs.toFixed(1) + ' ms' : '—'}`,
      `Simulación: ${PERF.simMs.toFixed(1)} ms/día (máx ${PERF.simMax.toFixed(0)} ms, ${PERF.simN} días medidos)`, `Memoria JS: ${p.mem ? Math.round(p.mem) + ' MB' : 'no disponible'}`, `Mundo: ${G.date.y}, ${G.armies.length} ejércitos, ${G.battles.length} batallas`, `Worker: ${R.worldByWorker ? 'sí' : 'no'} · Troops3D: ${R.tropas3dOff ? 'no' : 'sí'}`].join('\n');
    const done = () => toast('📋', 'Informe de rendimiento copiado.'); try { navigator.clipboard.writeText(t).then(done, () => { window.prompt('Copia el informe:', t); }); } catch (e) { window.prompt('Copia el informe:', t); }
  },
  perfreset: () => { R.resUser = null; R.fpsCap = 0; R.shadowsUser = null; R.figMode = '3d'; R.animUser = null; PERF.show = false; perfSave(); perfBoxUpdate(); ACT.perfset({k: 'q', v: 'auto'}); }
});
setInterval(() => { if (PERF.show) perfBoxUpdate(); }, 500);
window.addEventListener('keydown', e => { if (e.key === 'F3' && UI.started) { e.preventDefault(); PERF.show = !PERF.show; perfSave(); perfBoxUpdate(); const c = document.querySelector('#perfpanel [data-pf=show]'); if (c) c.checked = PERF.show; } });
if (PERF.show) setTimeout(perfBoxUpdate, 500);
// acceso desde el panel ☀ (gráficos del mapa)
if (typeof gfxPanelHtml === 'function') { const _gh = gfxPanelHtml; gfxPanelHtml = function () { return _gh().replace(/(<p class="gfx-note">)/, '<button class="gfx-perf" data-act="perfpanel">📊 Rendimiento y contador…</button>$1'); }; }
const _perfCss = document.createElement('style'); _perfCss.textContent = `
#perfpanel{position:fixed;right:64px;bottom:196px;width:300px;max-height:calc(100vh - 290px);min-height:220px;overflow-y:auto;z-index:121;padding:10px 12px 10px;border-radius:10px;border:1px solid rgba(201,166,87,.5);background:rgba(12,17,23,.96);box-shadow:0 8px 30px rgba(0,0,0,.55);color:var(--text);font-size:12.5px}
#perfpanel .pf-h{font-family:var(--head);color:var(--gold2);font-size:14px;letter-spacing:.06em;display:flex;justify-content:space-between;align-items:center;margin-bottom:4px}
#perfpanel .pf-h button{background:none;border:0;color:var(--dim);cursor:pointer;font-size:14px}
#perfpanel .pf-row{display:flex;flex-direction:column;gap:4px;margin:8px 0}#perfpanel .pf-row b{color:var(--gold2);font-weight:600}
#perfpanel .pf-seg{display:flex;gap:4px}#perfpanel .pf-seg button{flex:1;padding:4px 0;border:1px solid var(--goldd);border-radius:6px;background:rgba(30,38,48,.9);color:var(--text);font:inherit;font-size:12px;cursor:pointer}
#perfpanel .pf-seg button.on{background:linear-gradient(#8a6f2f,#5b4818);color:#fff6d6;border-color:var(--gold2)}
#perfpanel input[type=range]{width:100%;accent-color:#c9a657}#perfpanel .pf-tog{display:flex;align-items:center;gap:8px;margin:6px 0;cursor:pointer}#perfpanel .pf-tog input{accent-color:#c9a657}
#perfpanel .pf-stats{margin:8px 0;padding:6px 8px;border-radius:8px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08)}
#perfpanel .pf-kv{display:flex;justify-content:space-between;gap:8px;padding:1.5px 0}#perfpanel .pf-kv span{color:var(--dim)}#perfpanel .pf-kv b{font-weight:600;text-align:right}
#perfpanel .ok{color:#8fd48f}#perfpanel .mid{color:#e6c35c}#perfpanel .bad{color:#ef7f6f}
#perfpanel .pf-btns{display:flex;gap:6px}#perfpanel .pf-btns button,.gfx-perf{flex:1;padding:6px 8px;border-radius:7px;border:1px solid rgba(201,166,87,.45);background:rgba(30,38,48,.9);color:var(--text);font:inherit;font-size:12px;cursor:pointer}
#perfpanel .pf-btns button:hover,.gfx-perf:hover{border-color:var(--gold2)}.gfx-perf{width:100%;margin:6px 0 2px}
#perfpanel .pf-note{margin:8px 0 0;color:var(--dim);font-size:11.5px;line-height:1.4}
#perfbox{position:fixed;left:8px;bottom:74px;z-index:119;padding:2px 8px;border-radius:6px;background:rgba(8,12,16,.78);border:1px solid rgba(255,255,255,.15);font:600 11.5px/1.5 ui-monospace,Consolas,monospace;pointer-events:none;white-space:nowrap}
#perfbox.ok{color:#8fd48f}#perfbox.mid{color:#e6c35c}#perfbox.bad{color:#ef7f6f}
@media (max-width:1280px){#perfpanel{max-height:calc(100vh - 330px)}}
@media (max-width:640px){#perfpanel{right:8px;left:8px;width:auto;bottom:8px;max-height:calc(100vh - 140px)}}`;
document.head.appendChild(_perfCss);
