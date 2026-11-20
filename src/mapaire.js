/* ===== MAPA AÉREO (modo de mapa «✈️ Aéreo») =====
   Las regiones aéreas se pintan con su propio color (más intenso donde tu supremacía aérea es alta) con rótulos y fichas de escuadrones; solo se controlan
   los escuadrones. Clic en una ficha: selecciona los escuadrones de esa región (Mayús suma). Clic izquierdo en el mapa: selecciona la región. Clic derecho en una
   región: los escuadrones seleccionados se despliegan allí. Recuadro con el botón derecho: selección múltiple. */
const AM = {sel: new Set(), reg: -1, panel: null, lel: null, lroot: null, tok: {}, timer: null, raf: 0, sig: ''};
MAP_MODES.push({id: 'air', name: 'Aéreo', icon: '✈️'});
const amHue = id => (id * 47) % 360;
const _stateFillAM = stateFill;
stateFill = function (s) {
  if (R.mode !== 'air') return _stateFillAM(s);
  const r = airRegOf(s.id), sel = r === AM.reg, dom = airDominance(G.player, r), h = amHue(r) / 360;
  const f = (n, k = (n + h * 12) % 12, a = 0.5 * Math.min(0.65, 0.5), v = 0.5 - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))) => v;   // HSL→RGB
  const col = [f(0), f(8), f(4)].map(v => Math.round(v * 255)); const k = sel ? 1.25 : 1;
  return [Math.min(255, col[0] * k * (1 - dom * 0.3) + dom * 20), Math.min(255, col[1] * k + dom * 70), Math.min(255, col[2] * k * (1 - dom * 0.3)), sel ? 0.88 : 0.66];
};
const _setMapModeAM = setMapMode;
setMapMode = function (m) {
  const was = R.mode === 'air'; _setMapModeAM(m); const on = R.mode === 'air';
  if (on) { document.body.classList.add('airmode'); if (!AM.css) { AM.css = document.createElement('style'); AM.css.textContent = 'body.airmode .atoken,body.airmode .ntoken,body.airmode .marker,body.airmode #labels{display:none!important}'; document.head.appendChild(AM.css); } amPanel(true); if (!AM.timer) AM.timer = setInterval(amTick, 400); if (!AM.raf) AM.raf = requestAnimationFrame(amLoop); }
  else if (was) { document.body.classList.remove('airmode'); amPanel(false); AM.sel.clear(); clearInterval(AM.timer); AM.timer = null; if (AM.lroot) AM.lroot.style.display = 'none'; Object.values(AM.tok).forEach(e => e.remove()); AM.tok = {}; }
};
const amMine = () => mx().sq.filter(s => s.tag === G.player && s.n > 0);
function amCenter(r) { let x = 0, y = 0, n = 0; r.states.forEach(sid => { const ps = MAP.stats[sid].provs; const p = MAP.provs[ps[0]]; x += p.lon; y += p.lat; n++; }); return n ? {lon: x / n, lat: y / n} : {lon: r.lon, lat: r.lat}; }
function amTick() { if (R.mode !== 'air') return; const sig = G.date.t + '|' + AM.reg; if (sig !== AM.sig) { AM.sig = sig; fullRepaint(); } amPanel(true); }
function amLoop() {
  if (R.mode !== 'air') { AM.raf = 0; return; }
  const regs = airRegions().regs, cv = R.canvas.getBoundingClientRect(); AM.cent = AM.cent || regs.map(amCenter);
  if (!AM.lroot) { const r = AM.lroot = document.createElement('div'); r.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:6;overflow:hidden'; document.body.appendChild(r); AM.lel = regs.map(() => { const e = document.createElement('div'); e.style.cssText = 'position:absolute;left:0;top:0;white-space:nowrap;text-align:center;font:600 12px Georgia,serif;letter-spacing:.1em;text-transform:uppercase;color:#f3f7ff;text-shadow:0 0 3px #000,0 0 6px #000;transform:translate(-50%,-50%)'; r.appendChild(e); return e; }); }
  AM.lroot.style.display = 'block'; const placed = [];
  ['#airmappanel', '#minimap', '#toasts', '#menu', '#modes'].forEach(q => { const el = document.querySelector(q); if (el && el.offsetWidth) { const b = el.getBoundingClientRect(); placed.push({x0: b.left, x1: b.right, y0: b.top, y1: b.bottom}); } }); placed.push({x0: cv.left, x1: cv.right, y0: cv.top, y1: cv.top + 66}, {x0: cv.left, x1: cv.right, y0: cv.bottom - 70, y1: cv.bottom});
  regs.map(r => r.id).sort((a, b) => (b === AM.reg) - (a === AM.reg) || regs[b].states.length - regs[a].states.length).forEach(id => { const e = AM.lel[id], C = AM.cent[id], p = worldToScreen(C.lon, 0.5, -C.lat), x = p[0] + cv.left, y = p[1] + cv.top;
    if (p[2] > 1 || x < cv.left || x > cv.right || y < cv.top || y > cv.bottom) { e.style.display = 'none'; return; }
    const d = airDominance(G.player, id), txt = regs[id].name.replace('Región aérea de ', ''); const k = txt + Math.round(d * 100); if (e._k !== k) { e._k = k; e.innerHTML = txt + (d > 0 ? `<div style="font:600 11px sans-serif;color:#9dff9d">${Math.round(d * 100)}% dominio</div>` : ''); }
    e.style.display = 'block'; e.style.fontSize = id === AM.reg ? '14px' : '12px'; e.style.transform = `translate(-50%,-50%) translate(${x.toFixed(0)}px,${y.toFixed(0)}px)`;
    const w = e.offsetWidth, h = e.offsetHeight, b = {x0: x - w / 2 - 4, x1: x + w / 2 + 4, y0: y - h / 2 - 2, y1: y + h / 2 + 2};
    if (id !== AM.reg && placed.some(q => b.x0 < q.x1 && b.x1 > q.x0 && b.y0 < q.y1 && b.y1 > q.y0)) { e.style.display = 'none'; return; } placed.push(b); });
  // fichas de escuadrones (propios, y enemigos si hay reconocimiento de la región)
  const groups = {}; mx().sq.forEach(s => { if (s.n <= 0) return; const mine = s.tag === G.player || sameSide(G.player, s.tag); if (!mine && !(typeof airReconRegs === 'function' && airReconRegs(G.player).has(s.reg))) return; const k = s.tag + '|' + s.reg; (groups[k] = groups[k] || {tag: s.tag, reg: s.reg, n: 0, ids: [], fighters: 0}).n += s.n; groups[k].ids.push(s.id); if (s.type === 'fighter') groups[k].fighters += s.n; });
  const seen = new Set(); let idx = {};
  Object.keys(groups).forEach(k => { const g = groups[k], C = AM.cent[g.reg], i = idx[g.reg] = (idx[g.reg] || 0) + 1; let e = AM.tok[k]; seen.add(k);
    if (!e) { e = AM.tok[k] = document.createElement('div'); e.className = 'atokenair'; e.style.cssText = 'position:fixed;left:0;top:0;z-index:8;cursor:pointer;display:flex;align-items:center;gap:4px;background:rgba(14,24,34,.9);border:1px solid #6aa8e8;border-radius:12px;padding:1px 7px 1px 3px;color:#fff;font:700 12px sans-serif'; e.dataset.k = k; document.body.appendChild(e); }
    const p = worldToScreen(C.lon, 0.5, -C.lat), x = p[0] + cv.left + 4, y = p[1] + cv.top + 14 + (i - 1) * 24; e.style.display = p[2] > 1 ? 'none' : 'flex'; e.style.transform = `translate(-50%,-50%) translate(${x.toFixed(0)}px,${y.toFixed(0)}px)`;
    const sel = g.ids.some(id => AM.sel.has(id)); e.style.outline = sel ? '3px solid #ffe27a' : 'none'; e.style.borderColor = g.tag === G.player ? '#e0b04a' : '#6aa8e8';
    const kk = g.tag + g.n + g.fighters; if (e._k !== kk) { e._k = kk; e.innerHTML = flag(g.tag, 'sm') + `✈${g.n}`; } e._g = g; });
  for (const k in AM.tok) if (!seen.has(k)) { AM.tok[k].remove(); delete AM.tok[k]; }
  AM.raf = requestAnimationFrame(amLoop);
}
document.addEventListener('click', e => { if (R.mode !== 'air') return; const el = e.target.closest && e.target.closest('.atokenair'); if (!el || !el._g) return; e.preventDefault(); e.stopPropagation();
  const g = el._g; if (g.tag !== G.player) { toast('✈️', `${G.C[g.tag].name}: ${g.n} aviones en ${airReg(g.reg).name}.`); AM.reg = g.reg; fullRepaint(); return; }
  if (!e.shiftKey) AM.sel.clear(); g.ids.forEach(id => AM.sel.add(id)); AM.reg = g.reg; fullRepaint(); amPanel(true); }, true);
const _hoverAM = window.onMapHover;
const _clickAM = window.onMapClick;
window.onMapClick = function (id, e, pid) { if (R.mode !== 'air') return _clickAM(id, e, pid); if (id >= 0) { AM.reg = airRegOf(id); fullRepaint(); amPanel(true); } };
const _rightAM = window.onMapRightClick;
window.onMapRightClick = function (id, e, pid) {
  if (R.mode !== 'air') return _rightAM(id, e, pid); if (id < 0) return; const reg = airRegOf(id), sel = amMine().filter(s => AM.sel.has(s.id)); if (!sel.length) { AM.reg = reg; fullRepaint(); return; }
  sel.forEach(s => { s.reg = reg; }); toast('✈️', `${sel.length} escuadrón(es) se despliegan en ${airReg(reg).name}.`); AM.reg = reg; fullRepaint(); amPanel(true);
};
const _boxAM = window.onMapBoxSelect;
window.onMapBoxSelect = function (b, e) {
  if (R.mode !== 'air') return _boxAM(b, e); const x0 = Math.min(b.x0, b.x1), x1 = Math.max(b.x0, b.x1), y0 = Math.min(b.y0, b.y1), y1 = Math.max(b.y0, b.y1); if (!e.shiftKey) AM.sel.clear(); let n = 0;
  Object.values(AM.tok).forEach(el => { const r = el.getBoundingClientRect(), x = (r.left + r.right) / 2, y = (r.top + r.bottom) / 2; if (el._g && el._g.tag === G.player && x >= x0 && x <= x1 && y >= y0 && y <= y1) { el._g.ids.forEach(id => AM.sel.add(id)); n++; } });
  toast('▭', n ? `${n} grupo(s) de escuadrones seleccionados. Clic derecho en una región para desplegarlos.` : 'No hay escuadrones tuyos ahí.'); amPanel(true);
};
function amPanel(show) {
  let el = AM.panel; if (!show) { if (el) el.style.display = 'none'; return; }
  if (!el) { el = AM.panel = document.createElement('div'); el.id = 'airmappanel'; el.style.cssText = 'position:fixed;left:8px;top:96px;width:330px;max-height:calc(100vh - 230px);overflow:auto;z-index:30;background:linear-gradient(180deg,rgba(14,28,44,.96),rgba(10,20,32,.96));border:1px solid #3d6a86;border-radius:8px;padding:8px;color:#dce8f5;font-size:13px;box-shadow:0 4px 18px rgba(0,0,0,.5)'; document.body.appendChild(el);
    el.addEventListener('click', ev => { const cb = ev.target.closest('input[data-sq]'), b = ev.target.closest('[data-am]'); if (cb) { const id = +cb.dataset.sq; cb.checked ? AM.sel.add(id) : AM.sel.delete(id); amPanel(true); return; }
      if (!b) return; if (b.dataset.am === 'all') amMine().forEach(s => AM.sel.add(s.id)); else if (b.dataset.am === 'none') AM.sel.clear(); amPanel(true); });
    el.addEventListener('change', ev => { const t = ev.target; if (t.dataset && t.dataset.sqm) { const s = mx().sq.find(x => x.id === +t.dataset.sqm); if (s) { s.mission = t.value; amPanel(true); } } }); }
  el.style.display = 'block'; const mine = amMine(), r = AM.reg >= 0 ? airReg(AM.reg) : null;
  const sig = JSON.stringify([mine.map(s => [s.id, s.n, s.reg, s.mission, AM.sel.has(s.id)]), AM.reg, Math.round(G.date.t / 3)]); if (el._sig === sig) return; el._sig = sig;
  const hostile = r ? mx().sq.filter(s => s.reg === AM.reg && s.n > 0 && hostileTags(G.player, s.tag)).reduce((n, s) => n + s.n, 0) : 0;
  const info = r ? `<h3>${r.name}</h3><div class="kv sm"><span>Tu dominio aéreo</span><b>${Math.round(airDominance(G.player, AM.reg) * 100)}%</b></div><div class="kv sm"><span>Aviones enemigos visibles</span><b>${hostile}</b></div><div class="kv sm"><span>Estados</span><b>${r.states.length}</b></div>` : '<small style="opacity:.7">Clic en el mapa para elegir una región aérea.</small>';
  el.innerHTML = `<h3>✈️ Mapa aéreo <small style="opacity:.6">· solo escuadrones</small></h3><div>${info}</div><hr style="border-color:#2a4a6a"><div><b>Tus escuadrones</b> (${mine.length})</div><div><button data-am="all">Todos</button><button data-am="none">Ninguno</button></div>
    <div style="max-height:44vh;overflow:auto">${mine.map(s => { const T = AIR_TYPES[s.type]; return `<label style="display:block;padding:3px 4px;${AM.sel.has(s.id) ? 'background:#25496e' : ''}"><input type="checkbox" data-sq="${s.id}" ${AM.sel.has(s.id) ? 'checked' : ''}> ${T.icon} <b>${T.name}</b> ${s.n}/${SQ_MAX} <small style="opacity:.75">· ${airReg(s.reg).name.replace('Región aérea de ', '')}</small><br><select data-sqm="${s.id}" style="margin-left:22px">${T.missions.map(m => `<option value="${m}" ${s.mission === m ? 'selected' : ''}>${AIR_MISSIONS[m].icon} ${AIR_MISSIONS[m].name}</option>`).join('')}</select></label>`; }).join('') || '<small style="opacity:.7">No tienes escuadrones.</small>'}</div>
    <small style="opacity:.65;display:block;margin-top:6px">Clic en una ficha: seleccionar (Mayús suma) · recuadro con botón derecho · clic derecho en una región: desplegar.</small>`;
}
