/* ===== MAPA MARÍTIMO (modo de mapa «🌊 Marítimo») =====
   Como los modos Terreno o Alianzas, pero centrado en el mar: los mares se dibujan como «provincias» (46 regiones navales con borde y nombre) coloreadas según quién
   tiene la supremacía; la tierra se atenúa, los ejércitos desaparecen y solo se controlan las flotas.
   · Clic en una ficha de flota: seleccionar (Mayús suma). Arrastrar con el botón derecho: recuadro de selección.
   · Clic izquierdo en un mar: lo selecciona (supremacía, flotas presentes). Clic derecho en un mar: las flotas seleccionadas navegan allí.
   · Panel lateral: lista de flotas, agrupar, dividir, misión, atracar en puerto. */
const SM = {sel: new Set(), zone: -1, hover: -1, mesh: null, tex: null, cv: null, zmap: null, zw: 1024, zh: 410, dirty: true, lines: [], panel: null, last: 0};
MAP_MODES.push({id: 'naval', name: 'Marítimo', icon: '🌊'});
const _stateFillSM = stateFill;
stateFill = function (s) { if (R.mode === 'naval') { const f = _stateFillSM(s); return s.owner === NONE ? [74, 80, 84, 0.5] : [f[0] * 0.35 + 52, f[1] * 0.35 + 56, f[2] * 0.35 + 60, 0.62]; } return _stateFillSM(s); };

function smBuildZmap() {
  if (SM.zmap) return; const w = SM.zw, h = SM.zh, z = new Uint8Array(w * h), n = SEA_ZONES.length;
  const lx = new Float32Array(n), ly = new Float32Array(n); SEA_ZONES.forEach((Z, i) => { lx[i] = Z.lon; ly[i] = Z.lat; });
  for (let y = 0; y < h; y++) { const lat = LAT_TOP - (y + 0.5) / h * (LAT_TOP - LAT_BOT); for (let x = 0; x < w; x++) { const lon = (x + 0.5) / w * 360 - 180; let b = 0, bv = 1e9;
    for (let i = 0; i < n; i++) { let dx = Math.abs(lon - lx[i]); if (dx > 180) dx = 360 - dx; const dy = (lat - ly[i]) * 1.2, d = dx * dx + dy * dy; if (d < bv) { bv = d; b = i; } } z[y * w + x] = b; } }
  SM.zmap = z;
}
function smEnsure() {
  if (SM.mesh) return; smBuildZmap();
  const cv = document.createElement('canvas'); cv.width = MAP_W; cv.height = MAP_H; SM.cv = cv; SM.ctx = cv.getContext('2d', {willReadFrequently: true}); SM.img = SM.ctx.createImageData(MAP_W, MAP_H);
  const tex = new THREE.CanvasTexture(cv); tex.anisotropy = 4; SM.tex = tex;
  const w = 360, d = LAT_TOP - LAT_BOT, m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({map: tex, transparent: true, depthWrite: false, fog: false}));
  m.rotation.x = -Math.PI / 2; m.position.set(0, 0.07, -(LAT_TOP + LAT_BOT) / 2); m.renderOrder = 3; m.visible = false; R.scene.add(m); SM.mesh = m;
}
function smPaint() {
  if (!SM.mesh || R.mode !== 'naval') return; SM.dirty = false; const W = MAP_W, H = MAP_H, d = SM.img.data, zw = SM.zw, zh = SM.zh, zm = SM.zmap, land = MAP.land, M = mx();
  const col = SEA_ZONES.map(Z => { const dom = seaDominant(Z.id), c = dom && G.C[dom] ? hex2rgb(/^#[0-9a-f]{6}$/i.test(G.C[dom].color) ? G.C[dom].color : '#445566') : [64, 96, 130]; return {c, dom}; });
  // bordes: celdas de la mitad de resolución cuyo vecino pertenece a otra zona (o es tierra)
  const sel = SM.zone, edge = new Uint8Array(zw * zh), glow = new Uint8Array(zw * zh);
  for (let y = 0; y < zh; y++) for (let x = 0; x < zw; x++) { const i = y * zw + x, z0 = zm[i]; if (x + 1 < zw && zm[i + 1] !== z0) { edge[i] = edge[i + 1] = 1; if (x > 0) edge[i - 1] = 1; if (x + 2 < zw) edge[i + 2] = 1; } if (y + 1 < zh && zm[i + zw] !== z0) { edge[i] = edge[i + zw] = 1; if (y > 0) edge[i - zw] = 1; if (y + 2 < zh) edge[i + 2 * zw] = 1; } }
  if (sel >= 0) { for (let y = 1; y < zh - 1; y++) for (let x = 1; x < zw - 1; x++) { const i = y * zw + x; if (edge[i] && (zm[i] === sel || zm[i + 1] === sel || zm[i - 1] === sel || zm[i + zw] === sel || zm[i - zw] === sel)) { glow[i] = 2; for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) { const j = i + dy * zw + dx; if (zm[j] === sel && glow[j] < 1) glow[j] = 1; } } } }
  for (let y = 0; y < H; y++) { const cy = Math.min(zh - 1, y >> 1); for (let x = 0; x < W; x++) { const p = y * W + x, o = p * 4;
    if (land[p]) { d[o + 3] = 0; continue; }
    const ci = cy * zw + Math.min(zw - 1, x >> 1), z = zm[ci], cc = col[z].c; let r = cc[0], g = cc[1], b = cc[2], a = col[z].dom ? 92 : 48; if (!col[z].dom) { const t = (z % 3) * 14; r += t; g += t * 0.6; b -= t * 0.5; }
    if (z === SM.hover && z !== sel) a += 26; if (z === sel) { a += 38; g = Math.min(255, g + 30); }
    if (glow[ci] === 1) { r = 40; g = 230; b = 60; a = 110; }
    if (glow[ci] === 2) { r = 56; g = 255; b = 70; a = 255; }
    else if (edge[ci]) { r = 18; g = 34; b = 60; a = 235; }
    d[o] = r; d[o + 1] = g; d[o + 2] = b; d[o + 3] = a; } }
  SM.ctx.putImageData(SM.img, 0, 0);
  const g = SM.ctx; g.textAlign = 'center'; g.textBaseline = 'middle';
  SEA_ZONES.forEach(Z => { const x = lonToX(Z.lon), y = latToY(Z.lat), big = Z.id === sel; g.font = `${big ? 'bold ' : ''}${big ? 30 : 24}px Georgia, serif`; g.fillStyle = big ? 'rgba(240,255,240,.95)' : 'rgba(215,230,250,.6)'; g.strokeStyle = 'rgba(0,10,25,.55)'; g.lineWidth = 4; const t = Z.name.toUpperCase(); g.strokeText(t, x, y); g.fillText(t, x, y);
    const dom = col[Z.id].dom; if (dom) { g.font = '20px sans-serif'; g.fillStyle = 'rgba(255,255,255,.8)'; const t2 = `${Math.round(navalSup(dom, Z.id))}% ${G.C[dom].name}`; g.strokeText(t2, x, y + 28); g.fillText(t2, x, y + 28); } });
  SM.tex.needsUpdate = true; R.dirty = true;
}
const smZoneAtWorld = wp => { if (!wp) return -1; const px = Math.floor(lonToX(wp.x)), py = Math.floor(latToY(-wp.z)); if (px < 0 || py < 0 || px >= MAP_W || py >= MAP_H || MAP.land[py * MAP_W + px]) return -1; return SM.zmap ? SM.zmap[(py >> 1) * SM.zw + (px >> 1)] : -1; };

/* ---------- activar / desactivar el modo ---------- */
const _setMapModeSM = setMapMode;
setMapMode = function (m) {
  const was = R.mode === 'naval'; _setMapModeSM(m); const on = R.mode === 'naval';
  if (on) { smEnsure(); SM.mesh.visible = true; document.body.classList.add('seamode'); SM.dirty = true; smPaint(); smPanel(true); if (!SM.timer) SM.timer = setInterval(smTick, 250); }
  else if (was) { if (SM.mesh) SM.mesh.visible = false; document.body.classList.remove('seamode'); smPanel(false); smClearLines(); SM.sel.clear(); clearInterval(SM.timer); SM.timer = null; R.dirty = true; }
};
function smTick() { if (R.mode !== 'naval') return; const sig = G.date.t + '|' + SM.zone + '|' + SM.hover; if (sig !== SM.sig) { SM.sig = sig; SM.dirty = true; } if (SM.dirty && performance.now() - SM.last > 160) { SM.last = performance.now(); smPaint(); } smPanel(true); smLines(); smMarkTokens(); }
function smMine() { return mx().fl.filter(f => f.tag === G.player); }
function smMarkTokens() { if (!R.nk) return; const mine = smMine().filter(f => SM.sel.has(f.id)); for (const k in R.nk) { const el = R.nk[k], z = +el.dataset.z; el.classList.toggle('sel', mine.some(f => f.tag === el.dataset.tag && (f.tr ? f.tr.to : f.zone) === z)); } }
// rutas de las flotas en movimiento
function smClearLines() { SM.lines.forEach(l => { R.scene.remove(l); l.geometry.dispose(); }); SM.lines = []; }
function smLines() {
  smClearLines(); const pts = [];
  mx().fl.forEach(f => { if (!f.tr || !f.ships.length || !fleetVisible(f)) return; const A = zoneAnchor(f.zone), B = zoneAnchor(f.tr.to), q = clamp(1 - f.tr.left / Math.max(1, f.tr.tot || f.tr.left + 1), 0, 1); const sel = SM.sel.has(f.id);
    const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(A.lon + (B.lon - A.lon) * q, 0.25, -(A.lat + (B.lat - A.lat) * q)), new THREE.Vector3(B.lon, 0.25, -B.lat)]);
    const l = new THREE.Line(g, new THREE.LineBasicMaterial({color: sel ? 0xffe27a : f.tag === G.player ? 0x6fc2ff : 0xff8a8a, transparent: true, opacity: 0.9, depthTest: false})); l.renderOrder = 9; R.scene.add(l); SM.lines.push(l); });
  R.dirty = true;
}

/* ---------- ratón ---------- */
const _onMapHoverSM = window.onMapHover;
window.onMapHover = function (id, e) { if (R.mode === 'naval') { const z = smZoneAtWorld(screenToWorld(e.clientX, e.clientY)); if (z !== SM.hover) { SM.hover = z; } return; } return _onMapHoverSM && _onMapHoverSM(id, e); };
const _onMapClickSM = window.onMapClick;
window.onMapClick = function (id, e, pid) {
  if (R.mode !== 'naval') return _onMapClickSM(id, e, pid);
  const z = smZoneAtWorld(screenToWorld(e.clientX, e.clientY)); if (z >= 0) SM.zone = z; else if (!e.shiftKey) { SM.sel.clear(); SM.zone = -1; } SM.dirty = true; smPanel(true);
};
const _onMapRightSM = window.onMapRightClick;
window.onMapRightClick = function (id, e, pid) {
  if (R.mode !== 'naval') return _onMapRightSM(id, e, pid);
  const z = smZoneAtWorld(screenToWorld(e.clientX, e.clientY)); if (z < 0) return;
  if (!SM.sel.size) { SM.zone = z; SM.dirty = true; return; } smOrder(z);
};
const _onMapBoxSM = window.onMapBoxSelect;
window.onMapBoxSelect = function (b, e) {
  if (R.mode !== 'naval') return _onMapBoxSM(b, e);
  const x0 = Math.min(b.x0, b.x1), x1 = Math.max(b.x0, b.x1), y0 = Math.min(b.y0, b.y1), y1 = Math.max(b.y0, b.y1), cv = R.canvas.getBoundingClientRect(); if (!e.shiftKey) SM.sel.clear(); let n = 0;
  for (const k in R.nk) { const el = R.nk[k]; if (el._x == null || el.dataset.tag !== G.player) continue; const x = el._x + cv.left, y = el._y + cv.top; if (x >= x0 && x <= x1 && y >= y0 && y <= y1) smMine().forEach(f => { if ((f.tr ? f.tr.to : f.zone) === +el.dataset.z) { SM.sel.add(f.id); n++; } }); }
  toast('▭', n ? `${n} flota(s) seleccionadas. Clic derecho en un mar para moverlas.` : 'No hay flotas tuyas en esa zona.'); smPanel(true); smMarkTokens();
};
// clic en una ficha de flota: selección (no abre el visor)
document.addEventListener('click', e => {
  if (R.mode !== 'naval') return; const el = e.target.closest && e.target.closest('.ntoken'); if (!el) return; e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
  const z = +el.dataset.z, tag = el.dataset.tag, grp = mx().fl.filter(f => f.tag === tag && (f.tr ? f.tr.to : f.zone) === z && f.ships.length);
  if (tag !== G.player) { const p = grp.reduce((n, f) => n + fleetPower(f), 0); toast('🌊', `${G.C[tag].name}: ${grp.reduce((n, f) => n + f.ships.length, 0)} buques · poder ${p.toFixed(0)} · ${SEA_ZONES[z].name}.`); SM.zone = z; return; }
  if (!e.shiftKey) SM.sel.clear(); const all = grp.every(f => SM.sel.has(f.id)); grp.forEach(f => all && e.shiftKey ? SM.sel.delete(f.id) : SM.sel.add(f.id)); SM.zone = z; SM.dirty = true; smPanel(true); smMarkTokens();
}, true);

function smOrder(z) {
  const fl = smMine().filter(f => SM.sel.has(f.id)); let n = 0, bad = 0;
  fl.forEach(f => { if (f.zone === z && !f.tr && f.port == null) return; fleetMove(f, z); const enemyZone = G.tags.some(o => o !== NONE && hostileTags(G.player, o) && alive(o) && countryZones(G.C[o]).has(z)); if (f.mission === 'port') f.mission = enemyZone ? 'blockade' : 'patrol'; f.cool = null; n++; });
  if (n) toast('🌊', `${n} flota${n > 1 ? 's' : ''} navega${n > 1 ? 'n' : ''} hacia ${SEA_ZONES[z].name}.`); SM.zone = z; SM.dirty = true; smPanel(true);
}

/* ---------- panel lateral ---------- */
function smPanel(show) {
  let el = SM.panel; if (!show) { if (el) el.style.display = 'none'; return; }
  if (!el) { el = SM.panel = document.createElement('div'); el.id = 'seapanel'; document.body.appendChild(el);
    const st = document.createElement('style'); st.textContent = '#seapanel{position:fixed;left:8px;top:96px;width:330px;max-height:calc(100vh - 230px);overflow:auto;z-index:30;background:linear-gradient(180deg,rgba(14,28,44,.96),rgba(10,20,32,.96));border:1px solid #3d6a86;border-radius:8px;padding:8px;color:#dce8f5;font-size:13px;box-shadow:0 4px 18px rgba(0,0,0,.5)}#seapanel h3{margin:0 0 6px;font-size:14px;color:#9fd0ff}#seapanel .sm-row{display:block;padding:3px 4px;border-radius:4px;cursor:pointer}#seapanel .sm-row.on{background:#25496e}#seapanel .sm-row small{display:block;opacity:.75}#seapanel button{margin:2px 2px 2px 0}.ntoken.sel{outline:3px solid #ffe27a;outline-offset:1px;z-index:5}body.seamode .atoken{display:none!important}body.seamode #labels{opacity:.2}';
    document.head.appendChild(st);
    el.addEventListener('click', ev => { const cb = ev.target.closest('input[data-fl]'), b = ev.target.closest('[data-sm]');
      if (cb) { const id = +cb.dataset.fl; cb.checked ? SM.sel.add(id) : SM.sel.delete(id); smPanel(true); smMarkTokens(); return; }
      if (!b) return; const k = b.dataset.sm, mine = smMine(), sel = mine.filter(f => SM.sel.has(f.id));
      if (k === 'all') SM.sel = new Set(mine.map(f => f.id)); else if (k === 'none') SM.sel = new Set();
      else if (k === 'merge') { const r = fleetMerge(sel); toast(r.ok ? '🔗' : '⚠️', r.msg); if (r.ok) SM.sel = new Set([r.f.id]); }
      else if (k === 'split' || k === 'splitfast') { const r = fleetSplit(sel[0], k === 'splitfast' ? 'fast' : 'half'); toast(r.ok ? '✂️' : '⚠️', r.msg); if (r.ok) SM.sel.add(r.f.id); }
      else if (k === 'dock') { sel.forEach(f => { const ps = portsStates(G.C[f.tag]); if (ps.length) { const r = fleetDock(f, ps[0]); if (!r.ok) toast('⚠️', r.msg); } }); toast('⚓', 'Flotas enviadas a puerto.'); }
      else if (k === 'setmis') { const m = el.querySelector('select[data-sm=mis]').value; sel.forEach(f => { f.mission = m; f.target = null; }); toast('🧭', `Misión asignada: ${NAV_MISSIONS[m].name}.`); }
      smPanel(true); smMarkTokens(); R.dirty = true; });
    el.addEventListener('change', () => { }); }
  el.style.display = 'block';
  const M = mx(), mine = smMine(), sel = mine.filter(f => SM.sel.has(f.id)), z = SM.zone;
  const sig = JSON.stringify([mine.map(f => [f.id, f.ships.length, f.zone, f.tr && f.tr.to, f.port, f.mission, SM.sel.has(f.id)]), z, Math.round(G.date.t / 3), z >= 0 && M.sup && M.sup[z]]); if (el._sig === sig) return; el._sig = sig;
  const row = f => { const cnt = {}; f.ships.forEach(s => cnt[s.t] = (cnt[s.t] || 0) + 1); return `<label class="sm-row ${SM.sel.has(f.id) ? 'on' : ''}"><input type="checkbox" data-fl="${f.id}" ${SM.sel.has(f.id) ? 'checked' : ''}> <b>${f.name}</b> ${NAV_MISSIONS[f.mission] ? NAV_MISSIONS[f.mission].icon : ''}<small>${SHIP_ORDER.filter(k => cnt[k]).map(k => SHIP_TYPES[k].icon + cnt[k]).join(' ')} · ${f.tr ? '→ ' + SEA_ZONES[f.tr.to].name + ' (' + f.tr.left + ' d)' : f.port != null ? '⚓ ' + G.S[f.port].name : SEA_ZONES[f.zone].name}</small></label>`; };
  const zinfo = z >= 0 ? `<h3>${SEA_ZONES[z].name}</h3>${Object.entries((M.sup && M.sup[z]) || {}).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([t, v]) => `<div class="kv sm"><span>${flag(t, 'sm')} ${G.C[t].name}</span><b>${Math.round(v)}%</b></div>`).join('') || '<small style="opacity:.7">Sin presencia naval.</small>'}<small style="opacity:.7;display:block">Supremacía ≥50 % para bloquear · ≥35 % para desembarcar con seguridad.</small>${nbActive(z) ? '<div style="color:#ff9a7a">⚔ Batalla naval en curso</div>' : ''}` : '<small style="opacity:.7">Clic en un mar para ver su supremacía.</small>';
  el.innerHTML = `<h3>🌊 Mapa marítimo <small style="opacity:.6">· solo flotas</small></h3><div>${zinfo}</div><hr style="border-color:#2a4a6a">
    <div><b>Tus flotas</b> (${mine.length})</div><div><button data-sm="all">Todas</button><button data-sm="none">Ninguna</button><button data-sm="merge" ${sel.length > 1 ? '' : 'disabled'}>🔗 Agrupar</button><button data-sm="split" ${sel.length === 1 && sel[0].ships.length > 1 ? '' : 'disabled'}>✂️ Dividir</button><button data-sm="splitfast" ${sel.length === 1 && sel[0].ships.length > 1 ? '' : 'disabled'}>⚡ Rápidos</button><button data-sm="dock" ${sel.length ? '' : 'disabled'}>⚓ A puerto</button></div>
    <div><select data-sm="mis">${Object.keys(NAV_MISSIONS).map(k => `<option value="${k}">${NAV_MISSIONS[k].icon} ${NAV_MISSIONS[k].name}</option>`).join('')}</select><button data-sm="setmis" ${sel.length ? '' : 'disabled'}>Asignar misión</button></div>
    <div style="max-height:36vh;overflow:auto">${mine.map(row).join('') || '<small style="opacity:.7">No tienes flotas.</small>'}</div>
    <small style="opacity:.65;display:block;margin-top:6px">Clic en una ficha: seleccionar (Mayús suma) · arrastra con el botón derecho: recuadro · clic derecho en un mar: navegar.</small>`;
}
