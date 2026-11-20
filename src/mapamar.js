/* ===== MAPA MARÍTIMO =====
   Vista solo de mar: únicamente aparecen flotas (tuyas y enemigas). Se seleccionan con clic (Mayús o arrastrar un recuadro para varias),
   se agrupan o dividen, y con clic en un mar se les ordena navegar (clic derecho = patrullar, bloquear según la misión elegida).
   Colorea cada mar según quién tiene la supremacía naval y muestra el reparto de poder. Tecla Ñ o menú «Mapa marítimo». */
const SM = {open: false, sel: new Set(), zx: 0.5, zy: 0.5, k: 1, land: null, hover: -1, drag: null, box: null, W: 0, H: 0};
MENU_ITEMS.push(['seamap', '🌊', 'Mar', 'Mapa marítimo', 'Mapa solo de mares: flotas, supremacía naval, agrupar escuadrones y ordenar movimientos.']);
const _openWindowSM = openWindow;
openWindow = function (id) { if (id === 'seamap') { seaMapToggle(); return; } if (SM.open) seaMapClose(); return _openWindowSM(id); };
const _fleetMoveSM = fleetMove;
fleetMove = function (f, z) { const had = f.tr; _fleetMoveSM(f, z); if (f.tr && f.tr !== had) f.tr.tot = f.tr.left; };

function smBuildLand() {
  if (SM.land || !MAP.land) return;
  const w = 1024, h = 410, cv = document.createElement('canvas'); cv.width = w; cv.height = h; const g = cv.getContext('2d'), im = g.createImageData(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const l = MAP.land[(y * 2) * MAP_W + x * 2] || MAP.land[(y * 2 + 1) * MAP_W + x * 2 + 1], i = (y * w + x) * 4; if (l) { im.data[i] = 118; im.data[i + 1] = 128; im.data[i + 2] = 104; im.data[i + 3] = 255; } }
  g.putImageData(im, 0, 0); SM.land = cv;
}
function smXY(lon, lat) { return [lonToX(lon) / MAP_W, latToY(lat) / MAP_H]; }
const SM_AR = MAP_H / MAP_W;
function smScreen(nx, ny) { return [(nx - SM.zx) * SM.W * SM.k + SM.W / 2, (ny - SM.zy) * SM.W * SM.k * SM_AR + SM.H / 2]; }
function smWorld(px, py) { return [(px - SM.W / 2) / (SM.W * SM.k) + SM.zx, (py - SM.H / 2) / (SM.W * SM.k * SM_AR) + SM.zy]; }
function smZoneAt(px, py) { const [nx, ny] = smWorld(px, py); const lon = nx * 360 - 180, lat = LAT_TOP - ny * (LAT_TOP - LAT_BOT); return seaZoneOfLL(lon, lat); }
function smZoneCenter(z) { const Z = SEA_ZONES[z]; return smXY(Z.lon, Z.lat); }
// posición de cada ficha: en el centro del mar (o a medio camino si navega) con un pequeño desplazamiento por flota
function smTokens() {
  const M = mx(), out = [], cnt = {};
  M.fl.forEach(f => {
    if (!f.ships.length) return; let nx, ny, z = f.zone;
    if (f.tr) { const a = smZoneCenter(f.zone), b = smZoneCenter(f.tr.to), tot = f.tr.tot || f.tr.left + 1, p = clamp(1 - f.tr.left / tot, 0, 1); nx = a[0] + (b[0] - a[0]) * p; ny = a[1] + (b[1] - a[1]) * p; if (Math.abs(a[0] - b[0]) > 0.5) { nx = a[0] + (b[0] - a[0]) * p; } z = -1; }
    else { const c = smZoneCenter(z); const key = z; const n = cnt[key] = (cnt[key] || 0) + 1; const ang = n * 2.4; nx = c[0] + Math.cos(ang) * 0.012 * Math.ceil(n / 3) * (f.port != null ? 0.6 : 1); ny = c[1] + Math.sin(ang) * 0.02 * Math.ceil(n / 3); }
    out.push({f, nx, ny});
  });
  return out;
}
function seaMapDraw() {
  const cv = SM.cv; if (!cv) return; const g = cv.getContext('2d'), W = SM.W = cv.width, H = SM.H = cv.height; smBuildLand();
  g.fillStyle = '#10243a'; g.fillRect(0, 0, W, H);
  const [x0, y0] = smScreen(0, 0), [x1, y1] = smScreen(1, 1);
  g.imageSmoothingEnabled = true; if (SM.land) { g.globalAlpha = 1; g.drawImage(SM.land, x0, y0, x1 - x0, y1 - y0); }
  // supremacía por mar: puntos de color sobre el centro + etiqueta
  const M = mx(); g.textAlign = 'center';
  SEA_ZONES.forEach(Z => {
    const [nx, ny] = smZoneCenter(Z.id), [px, py] = smScreen(nx, ny), dom = seaDominant(Z.id), col = dom && G.C[dom] ? G.C[dom].color : '#456';
    g.beginPath(); g.arc(px, py, 26 * Math.min(2.5, SM.k) * (SM.W / 1100), 0, 6.283); const rgb = hex2rgb(/^#[0-9a-f]{6}$/i.test(col) ? col : '#445566').join(','); g.fillStyle = `rgba(${rgb},${SM.hover === Z.id ? 0.4 : 0.2})`; g.fill(); g.strokeStyle = `rgba(${rgb},0.7)`; g.lineWidth = 1; g.stroke();
    g.fillStyle = '#9fc4e8'; g.font = `${Math.max(10, 11 * Math.min(1.6, SM.k))}px sans-serif`; g.fillText(Z.name, px, py - 30 * Math.min(2.5, SM.k) * (SM.W / 1100) - 4);
    if (dom) { g.fillStyle = '#fff'; g.font = `bold ${Math.max(10, 11 * Math.min(1.5, SM.k))}px sans-serif`; g.fillText(`${G.C[dom].name.slice(0, 12)} ${Math.round(navalSup(dom, Z.id))}%`, px, py + 36 * Math.min(2.5, SM.k) * (SM.W / 1100) + 8); }
  });
  // rutas de los seleccionados
  const toks = smTokens(); g.lineWidth = 2; g.setLineDash([6, 5]);
  toks.forEach(t => { if (!t.f.tr) return; const b = smZoneCenter(t.f.tr.to), [qx, qy] = smScreen(b[0], b[1]), [px, py] = smScreen(t.nx, t.ny); g.strokeStyle = SM.sel.has(t.f.id) ? '#ffe27a' : (t.f.tag === G.player ? '#7ac0ff' : '#ff8a8a'); g.beginPath(); g.moveTo(px, py); g.lineTo(qx, qy); g.stroke(); });
  g.setLineDash([]);
  SM.tok = [];
  toks.forEach(t => {
    const [px, py] = smScreen(t.nx, t.ny), c = G.C[t.f.tag], mine = t.f.tag === G.player, sel = SM.sel.has(t.f.id), w = 34, h = 20;
    g.fillStyle = c ? c.color : '#888'; g.strokeStyle = sel ? '#ffe27a' : (mine ? '#fff' : '#000'); g.lineWidth = sel ? 3 : 1.5;
    g.beginPath(); g.roundRect(px - w / 2, py - h / 2, w, h, 4); g.fill(); g.stroke();
    g.fillStyle = '#fff'; g.font = 'bold 12px sans-serif'; g.textAlign = 'center'; g.shadowColor = '#000'; g.shadowBlur = 3; g.fillText((t.f.port != null ? '⚓' : '') + t.f.ships.length, px, py + 4); g.shadowBlur = 0;
    SM.tok.push({id: t.f.id, px, py, w, h});
  });
  if (SM.box) { const b = SM.box; g.strokeStyle = '#ffe27a'; g.setLineDash([4, 3]); g.strokeRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0); g.setLineDash([]); }
  seaMapSide();
}
function seaMapSide() {
  const el = SM.side; if (!el) return; const M = mx(), mine = M.fl.filter(f => f.tag === G.player), sel = mine.filter(f => SM.sel.has(f.id));
  const hz = SM.hover >= 0 ? SM.hover : (sel[0] ? sel[0].zone : -1);
  const supHtml = hz >= 0 ? `<div class="card"><h3>${SEA_ZONES[hz].name}</h3>${Object.entries((M.sup && M.sup[hz]) || {}).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([t, v]) => `<div class="kv sm"><span>${flag(t, 'sm')} ${G.C[t].name}</span><b>${Math.round(v)}%</b></div>`).join('') || '<small class="dim">Sin presencia naval.</small>'}<small class="dim">Supremacía: hace falta ≥50 % para bloquear y ≥35 % para desembarcar con seguridad.</small></div>` : '';
  const row = f => { const cnt = {}; f.ships.forEach(s => cnt[s.t] = (cnt[s.t] || 0) + 1); return `<label class="sm-row ${SM.sel.has(f.id) ? 'on' : ''}"><input type="checkbox" data-fl="${f.id}" ${SM.sel.has(f.id) ? 'checked' : ''}> <b>${f.name}</b> <small>${SHIP_ORDER.filter(k => cnt[k]).map(k => SHIP_TYPES[k].icon + cnt[k]).join(' ')} · ${f.tr ? '→ ' + SEA_ZONES[f.tr.to].name : f.port != null ? '⚓ puerto' : SEA_ZONES[f.zone].name}</small></label>`; };
  el.innerHTML = `<div class="card"><h3>Tus flotas <small class="dim">(${mine.length})</small></h3><div class="btnrow"><button data-sm="all">Todas</button><button data-sm="none">Ninguna</button><button data-sm="merge" ${sel.length > 1 ? '' : 'disabled'} data-tip="Junta las flotas seleccionadas de una misma zona en una sola escuadra.">🔗 Agrupar</button><button data-sm="split" ${sel.length === 1 && sel[0].ships.length > 1 ? '' : 'disabled'} data-tip="Divide la flota en dos escuadras.">✂️ Dividir</button><button data-sm="splitfast" ${sel.length === 1 && sel[0].ships.length > 1 ? '' : 'disabled'} data-tip="Separa los buques rápidos (cruceros, vapor) para incursiones.">⚡ Rápidos</button></div>
    <div class="btnrow"><select data-sm="mis">${Object.keys(NAV_MISSIONS).map(k => `<option value="${k}">${NAV_MISSIONS[k].icon} ${NAV_MISSIONS[k].name}</option>`).join('')}</select><button data-sm="setmis" ${sel.length ? '' : 'disabled'}>Asignar misión</button></div>
    <div class="scrollable" style="max-height:34vh;overflow:auto">${mine.map(row).join('') || '<small class="dim">No tienes flotas.</small>'}</div></div>${supHtml}
    <p class="hint">Clic en una ficha para seleccionar (Mayús: varias; arrastra en el mar para un recuadro). Clic en un mar: las flotas seleccionadas navegan allí. Rueda: zoom · arrastrar con botón central o derecho: mover.</p>`;
}
function seaMapOpen() {
  if (SM.open) return; SM.open = true; if (UI.win) closeWindow();
  const d = document.createElement('div'); d.id = 'seamap'; d.style.cssText = 'position:fixed;inset:0;z-index:70;background:#0a1624;display:flex;flex-direction:column;color:#dce8f5';
  d.innerHTML = `<div style="display:flex;align-items:center;gap:12px;padding:8px 14px;background:#0f2238;border-bottom:1px solid #2a4a6a"><b style="font-size:18px">🌊 Mapa marítimo</b><small style="opacity:.7">solo flotas · supremacía naval por mar</small><span style="flex:1"></span><button id="sm-close">✕ Cerrar (Esc)</button></div>
  <div style="flex:1;display:flex;min-height:0"><canvas id="sm-cv" style="flex:1;min-width:0;display:block"></canvas><style>#seamap .sm-row{display:block;padding:3px 4px;border-radius:4px;cursor:pointer}#seamap .sm-row.on{background:#25496e}#seamap .sm-row small{display:block;opacity:.75}</style><div id="sm-side" style="width:340px;max-width:42vw;overflow:auto;padding:8px;background:#0c1c30;border-left:1px solid #2a4a6a"></div></div>`;
  document.body.appendChild(d); SM.el = d; SM.cv = d.querySelector('#sm-cv'); SM.side = d.querySelector('#sm-side');
  const fit = () => { const r = SM.cv.getBoundingClientRect(); SM.cv.width = Math.max(300, Math.floor(r.width)); SM.cv.height = Math.max(200, Math.floor(r.height)); SM.W = SM.cv.width; SM.H = SM.cv.height; };
  fit(); SM.fit = fit; window.addEventListener('resize', fit);
  d.querySelector('#sm-close').onclick = seaMapClose;
  const cv = SM.cv; const pos = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * cv.width / r.width, (e.clientY - r.top) * cv.height / r.height]; };
  const tokAt = (x, y) => (SM.tok || []).slice().reverse().find(t => Math.abs(x - t.px) <= t.w / 2 && Math.abs(y - t.py) <= t.h / 2);
  cv.addEventListener('contextmenu', e => e.preventDefault());
  cv.addEventListener('wheel', e => { e.preventDefault(); const [x, y] = pos(e), [wx, wy] = smWorld(x, y); SM.k = clamp(SM.k * (e.deltaY < 0 ? 1.15 : 1 / 1.15), 1, 8); const [nx, ny] = smWorld(x, y); SM.zx += wx - nx; SM.zy += wy - ny; seaMapDraw(); }, {passive: false});
  cv.addEventListener('mousedown', e => { const [x, y] = pos(e); if (e.button === 1 || e.button === 2) { SM.drag = {x, y, zx: SM.zx, zy: SM.zy}; return; } const t = tokAt(x, y); if (t) { SM.tokDown = t; return; } SM.box = {x0: x, y0: y, x1: x, y1: y, shift: e.shiftKey}; });
  window.addEventListener('mousemove', SM.mm = e => { if (!SM.open) return; const [x, y] = pos(e);
    if (SM.drag) { SM.zx = SM.drag.zx - (x - SM.drag.x) / (SM.W * SM.k); SM.zy = SM.drag.zy - (y - SM.drag.y) / (SM.W * SM.k * SM_AR); seaMapDraw(); return; }
    if (SM.box) { SM.box.x1 = x; SM.box.y1 = y; seaMapDraw(); return; }
    const h = smZoneAt(x, y); if (h !== SM.hover) { SM.hover = h; seaMapDraw(); } });
  window.addEventListener('mouseup', SM.mu = e => { if (!SM.open) return; const [x, y] = pos(e);
    if (SM.drag) { SM.drag = null; return; }
    if (SM.tokDown) { const t = SM.tokDown; SM.tokDown = null; const f = mx().fl.find(q => q.id === t.id); if (f && f.tag === G.player) { if (e.shiftKey) { SM.sel.has(f.id) ? SM.sel.delete(f.id) : SM.sel.add(f.id); } else { SM.sel = new Set([f.id]); } } else if (f) toast('🌊', `${f.name} (${G.C[f.tag].name}): ${f.ships.length} buques · ${fleetPower(f).toFixed(0)} de poder.`); seaMapDraw(); return; }
    if (SM.box) { const b = SM.box; SM.box = null; if (Math.hypot(b.x1 - b.x0, b.y1 - b.y0) > 8) { if (!b.shift) SM.sel = new Set(); (SM.tok || []).forEach(t => { if (t.px >= Math.min(b.x0, b.x1) && t.px <= Math.max(b.x0, b.x1) && t.py >= Math.min(b.y0, b.y1) && t.py <= Math.max(b.y0, b.y1)) { const f = mx().fl.find(q => q.id === t.id); if (f && f.tag === G.player) SM.sel.add(f.id); } }); }
      else if (SM.sel.size) { const z = smZoneAt(x, y); seaMapOrder(z); } seaMapDraw(); } });
  window.addEventListener('keydown', SM.kd = e => { if (SM.open && e.key === 'Escape') { e.stopPropagation(); seaMapClose(); } }, true);
  SM.side.addEventListener('click', e => { const b = e.target.closest('[data-sm]'); const cb = e.target.closest('input[data-fl]');
    if (cb) { const id = +cb.dataset.fl; cb.checked ? SM.sel.add(id) : SM.sel.delete(id); seaMapDraw(); return; }
    if (!b) return; const k = b.dataset.sm, M = mx(), mine = M.fl.filter(f => f.tag === G.player), sel = mine.filter(f => SM.sel.has(f.id));
    if (k === 'all') SM.sel = new Set(mine.map(f => f.id)); else if (k === 'none') SM.sel = new Set();
    else if (k === 'merge') { const r = fleetMerge(sel); toast(r.ok ? '🔗' : '⚠️', r.msg); if (r.ok) SM.sel = new Set([r.f.id]); }
    else if (k === 'split' || k === 'splitfast') { const r = fleetSplit(sel[0], k === 'splitfast' ? 'fast' : 'half'); toast(r.ok ? '✂️' : '⚠️', r.msg); if (r.ok) SM.sel.add(r.f.id); }
    else if (k === 'setmis') { const m = SM.side.querySelector('select[data-sm=mis]').value; sel.forEach(f => { f.mission = m; f.target = null; }); toast('🧭', `Misión asignada: ${NAV_MISSIONS[m].name}.`); }
    seaMapDraw(); });
  SM.timer = setInterval(() => { if (SM.open) seaMapDraw(); }, 700); seaMapDraw();
}
function seaMapOrder(z) {
  const M = mx(); let n = 0; const fl = M.fl.filter(f => f.tag === G.player && SM.sel.has(f.id));
  fl.forEach(f => { if (f.zone === z && !f.tr && f.port == null) return; fleetMove(f, z); const enemyZone = G.tags.some(o => o !== NONE && hostileTags(G.player, o) && alive(o) && countryZones(G.C[o]).has(z)); if (f.mission === 'port') f.mission = enemyZone ? 'blockade' : 'patrol'; n++; });
  if (n) toast('🌊', `${n} flota${n > 1 ? 's' : ''} navega${n > 1 ? 'n' : ''} hacia ${SEA_ZONES[z].name}.`);
}
function seaMapClose() { if (!SM.open) return; SM.open = false; clearInterval(SM.timer); window.removeEventListener('mousemove', SM.mm); window.removeEventListener('mouseup', SM.mu); window.removeEventListener('keydown', SM.kd, true); window.removeEventListener('resize', SM.fit); if (SM.el) SM.el.remove(); SM.el = SM.cv = SM.side = null; }
function seaMapToggle() { SM.open ? seaMapClose() : seaMapOpen(); }
