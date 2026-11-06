/* ===== RÓTULOS, FICHAS Y PANEL GRÁFICO DEL MAPA DE CAMPAÑA (fase 6) =====
   · Rótulos de países, estados y ciudades colocados juntos, por prioridad y sin solaparse: primero los países,
     luego las ciudades importantes y las capitales, después los estados y las ciudades menores. El que choca no se pinta.
     Se anclan a la altura real del suelo y aparecen y desaparecen con un fundido según la distancia.
   · Fichas: los ejércitos del mismo país en el mismo sitio se agrupan en una sola ficha cuando hay más de 3 fichas allí
     (salvo el seleccionado y los que combaten); las flotas extranjeras que no están en guerra solo se ven de cerca.
     Al repartirse, las fichas esquivan los nombres de países y de las grandes ciudades.
   · Panel gráfico (botón ☀ junto a Q): calidad, intensidad del relieve (0–100 %), dirección de la luz,
     vegetación, caminos y ferrocarril, y nombres de estados. Se guarda en victoria-map-prefs. */

R.vegOn = true; R.roadsOn = true; R.stateNamesOn = true;

// tamaño aproximado del texto en pantalla (sin tocar el DOM)
const lblBox = (x, y, txt, fs, ls, extraH) => { const w = txt.length * fs * 0.6 + txt.length * (ls || 0) + 6, h = fs * 1.2 + (extraH || 0); return {x0: x - w / 2, x1: x + w / 2, y0: y - h / 2, y1: y + h / 2}; };
const boxHit = (a, b) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;
function lblShow(el, on, op) {
  if (on) { if (el._on !== true) { el.style.display = 'block'; el._on = true; } const o = op.toFixed(2); if (el._op !== o) { el.style.opacity = o; el._op = o; } }
  else if (el._on !== false) { el.style.display = 'none'; el._on = false; }
}
const lblY = (lon, lat) => (typeof terrainY === 'function' ? Math.max(0, terrainY(lon, lat)) : 0) + 0.2;

updateLabels = function () {
  const cw = R.canvas.clientWidth, ch = R.canvas.clientHeight;
  const pxPerDeg = (() => { const a = worldToScreen(R.cam.tx, 0, R.cam.tz), b = worldToScreen(R.cam.tx + 1, 0, R.cam.tz); return Math.abs(b[0] - a[0]); })();
  R.pxPerDeg = pxPerDeg;
  const inView = (p, mx, my) => p[0] > -mx && p[0] < cw + mx && p[1] > -my && p[1] < ch + my;
  const cand = [];
  // países: tamaño según su anchura en pantalla; se apagan al acercarse a los estados
  R.labels.forEach(l => {
    const fs = clamp(l.wDeg * pxPerDeg / (l.name.length * 0.95), 0, 30);
    if (fs < 10 || pxPerDeg >= 17) { lblShow(l.el, false); return; }
    const p = worldToScreen(l.lon, lblY(l.lon, l.lat), -l.lat); if (!inView(p, 100, 50)) { lblShow(l.el, false); return; }
    const op = Math.min(sstep01((fs - 10) / 3), sstep01((17 - pxPerDeg) / 3));
    cand.push({el: l.el, kind: 'pais', pri: 2000 + fs, x: p[0], y: p[1], fs, op, box: lblBox(p[0], p[1], l.name, fs, fs * 0.14)});
  });
  // ciudades: según su importancia y la distancia
  if (!R.cLabels && typeof buildCityLabels === 'function') { try { buildCityLabels(); } catch (e) { R.cLabels = []; } }
  const d = R.cam.dist, lim = {3: 190, 2: 95, 1: 52};
  (R.cLabels || []).forEach(l => {
    if (d > lim[l.imp]) { lblShow(l.el, false); return; }
    const p = worldToScreen(l.lon, lblY(l.lon, l.lat), -l.lat); if (!inView(p, 40, 20)) { lblShow(l.el, false); return; }
    const own = G.C[G.S[l.sid].owner], cap = !!(own && own.capital === l.sid);
    if (l.el._cap !== cap) { l.el.classList.toggle('cap', cap); l.el._cap = cap; }
    const fs = l.imp === 3 ? 16 : l.imp === 2 ? 14 : 12, y = p[1] + 15;
    const yUp = p[1] - fs - 16;                                                       // alternativa: el nombre encima del punto
    cand.push({el: l.el, kind: 'ciudad', pri: (l.imp === 3 ? 900 : l.imp === 2 ? 620 : 300) + (cap ? 200 : 0), x: p[0], y, fs, op: sstep01((lim[l.imp] - d) / (lim[l.imp] * 0.15)), box: lblBox(p[0], y + fs * 0.45, l.el.textContent, fs, fs * 0.06, 8),
      alt: {y: yUp, box: lblBox(p[0], yUp + fs * 0.55, l.el.textContent, fs, fs * 0.06, 8)}});
  });
  // estados: solo de cerca
  const showStates = pxPerDeg >= 17 && R.stateNamesOn !== false;
  R.sLabels.forEach(l => {
    if (!showStates) { lblShow(l.el, false); return; }
    const p = worldToScreen(l.lon, lblY(l.lon, l.lat), -l.lat); if (!inView(p, 60, 30)) { lblShow(l.el, false); return; }
    const fs = clamp(pxPerDeg * 0.36, 9, 15);
    cand.push({el: l.el, kind: 'estado', pri: 500 + fs, x: p[0], y: p[1], fs, op: sstep01((pxPerDeg - 17) / 4), box: lblBox(p[0], p[1], l.el.textContent, fs, 0)});
  });
  // colocación por prioridad: el que choca con uno ya colocado se oculta
  cand.sort((a, b) => b.pri - a.pri);
  const placed = []; R.labelRects = [];
  cand.forEach(c => {
    if (placed.some(b => boxHit(b, c.box))) {
      if (c.alt && !placed.some(b => boxHit(b, c.alt.box))) { c.y = c.alt.y; c.box = c.alt.box; c.up = true; }
      else { lblShow(c.el, false); return; }
    }
    if (c.kind === 'ciudad' && c.el._up !== !!c.up) { c.el._up = !!c.up; c.el.classList.toggle('up', !!c.up); }
    placed.push(c.box); if (c.pri >= 900) R.labelRects.push(c.box);
    lblShow(c.el, true, c.op);
    if (c.kind === 'pais') { const k = c.fs.toFixed(1); if (c.el._fs !== k) { c.el._fs = k; c.el.style.fontSize = k + 'px'; c.el.style.letterSpacing = (c.fs * 0.14).toFixed(1) + 'px'; } c.el.style.transform = `translate(-50%,-50%) translate(${c.x.toFixed(1)}px,${c.y.toFixed(1)}px)`; }
    else if (c.kind === 'estado') { const k = c.fs.toFixed(1); if (c.el._fs !== k) { c.el._fs = k; c.el.style.fontSize = k + 'px'; } c.el.style.transform = `translate(-50%,-50%) translate(${c.x.toFixed(1)}px,${c.y.toFixed(1)}px)`; }
    else c.el.style.transform = `translate(-50%,0) translate(${c.x.toFixed(1)}px,${c.y.toFixed(1)}px)`;
    c.el.on = true;
  });
  R.sLabels.forEach(l => { l.on = l.el._on === true; }); (R.cLabels || []).forEach(l => { l.on = l.el._on === true; });
  updateMarkers();
};
updateCityLabels = function () {};                                                // las ciudades las coloca updateLabels
function sstep01(t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }

/* ---------- fichas ---------- */
// agrupa los ejércitos del mismo país en el mismo sitio cuando hay más de 3 fichas allí
const _updateArmyTokensRot = updateArmyTokens;
updateArmyTokens = function () {
  if (G.armies) {
    const sel = window.UI && UI.selArmy, at = {};
    G.armies.forEach(a => { if (armyVisible(a) && !a.sea) (at[a.loc] = at[a.loc] || []).push(a); });
    for (const loc in at) {
      const list = at[loc]; if (list.length <= 3) continue;
      const byTag = {}; list.forEach(a => { if (a.id === sel || a.battle || a.path.length || (UI.selSet && UI.selSet.has(a.id))) return; (byTag[a.tag] = byTag[a.tag] || []).push(a); });
      for (const t in byTag) { const g = byTag[t]; if (g.length < 2) continue; g[0]._grp = {n: g.length, divs: g.reduce((s, a) => s + a.divs.length, 0)}; for (let k = 1; k < g.length; k++) g[k]._grpHide = true; }
    }
  }
  // armyVisible() decide qué se dibuja: los agrupados se ocultan solo durante esta llamada
  const _vis = armyVisible; armyVisible = a => !a._grpHide && _vis(a);
  try { _updateArmyTokensRot(); } finally { armyVisible = _vis; }
  (G.armies || []).forEach(a => {
    const el = R.ak && R.ak[a.id];
    if (el && a._grp) { const k = 'g' + a._grp.n + '|' + a._grp.divs; if (el._gk !== k || !el.querySelector('em')) { el._gk = k; const b = el.querySelector('b'); if (b) b.textContent = a._grp.divs; let em = el.querySelector('em'); if (!em) { em = document.createElement('em'); el.appendChild(em); } em.textContent = '×' + a._grp.n; el.dataset.tip = `${G.C[a.tag].name}: ${a._grp.n} ejércitos, ${a._grp.divs} divisiones. Acércate o selecciona para verlos por separado.`; } }
    else if (el && el._gk) { el._gk = null; el._k = null; const em = el.querySelector('em'); if (em) em.remove(); delete el.dataset.tip; }
    delete a._grp; delete a._grpHide;
  });
};
// flotas extranjeras sin guerra: solo de cerca (como los ejércitos)
const _updateNavyTokensRot = typeof updateNavyTokens === 'function' ? updateNavyTokens : null;
if (_updateNavyTokensRot) updateNavyTokens = function () {
  _updateNavyTokensRot();
  const zoomIn = (R.pxPerDeg || 10) >= 16;
  for (const k in R.nk || {}) {
    const el = R.nk[k], tag = el.dataset.tag;
    const keep = zoomIn || tag === G.player || el.classList.contains('fight') || (typeof hostileTags === 'function' && hostileTags(G.player, tag));
    if (!keep) { el.style.display = 'none'; el._x = null; }
  }
};
// reparto de fichas: además de no solaparse entre sí, esquivan los nombres de países y grandes ciudades
declutterTokens = function () {
  const items = [];
  [R.ak, R.nk].forEach(o => { if (o) for (const k in o) { const el = o[k]; if (el._x == null || el.style.display === 'none') continue; items.push(el); } });
  items.sort((a, b) => (b._pri || 0) - (a._pri || 0));
  const placed = [], soft = (R.labelRects || []).map(b => ({x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2, w: b.x1 - b.x0, h: b.y1 - b.y0}));
  if (R.mk) for (const k in R.mk) { const m = R.mk[k]; if (m._bx != null) placed.push({x: m._bx, y: m._by, w: 40, h: 38}); }
  const hit = (list, x, y, w, h) => list.some(q => Math.abs(q.x - x) < (q.w + w) / 2 && Math.abs(q.y - y) < (q.h + h) / 2);
  items.forEach(el => {
    if (el._k !== el._kw || !el._w || el._gk !== el._gkw) { el._kw = el._k; el._gkw = el._gk; el._w = el.offsetWidth || 54; el._h = el.offsetHeight || 22; }
    const w = el._w + 3, h = el._h + 2;
    const cands = [[0, 0]]; for (let r = 1; r <= 4; r++) cands.push([w * (r % 2), -h * Math.ceil(r / 2) * 0], [0, -r * h], [w, -r * h], [0, r * h], [w, r * h], [-w, 0], [-w, -r * h], [r * w, 0], [-r * w, 0]);   // rejilla compacta de dos columnas antes que una columna larga
    // primero un hueco libre de fichas y de rótulos; si no hay, uno libre solo de fichas
    let best = cands.find(c => !hit(placed, el._x + c[0], el._y + c[1], w, h) && !hit(soft, el._x + c[0], el._y + c[1], w, h));
    if (!best) best = cands.find(c => !hit(placed, el._x + c[0], el._y + c[1], w, h)) || cands[0];
    const x = el._x + best[0], y = el._y + best[1]; placed.push({x, y, w, h});
    el.style.transform = `translate(-50%,-50%) translate(${x.toFixed(1)}px,${y.toFixed(1)}px)`;
  });
};

/* ---------- panel gráfico ---------- */
function gfxPrefs(save) {
  try {
    const p = JSON.parse(localStorage.getItem('victoria-map-prefs') || '{}');
    if (save) { Object.assign(p, {relief: R.reliefK, lightAz: R.lightAz, veg: R.vegOn, roads: R.roadsOn, sl: R.stateNamesOn}); localStorage.setItem('victoria-map-prefs', JSON.stringify(p)); return; }
    if (typeof p.lightAz === 'number') R.lightAz = p.lightAz; if (typeof p.veg === 'boolean') R.vegOn = p.veg; if (typeof p.roads === 'boolean') R.roadsOn = p.roads; if (typeof p.sl === 'boolean') R.stateNamesOn = p.sl;
  } catch (e) {}
}
gfxPrefs(false);
function applyGfxToggles() {
  if (R.roadMesh) R.roadMesh.visible = R.roadsOn; if (R.railMesh) R.railMesh.visible = R.roadsOn;
  if (typeof refreshVegetation === 'function') refreshVegetation(true);
  R.dirty = true; R.labelsDirty = true;
}
function gfxPanelHtml() {
  const q = R.quality || 'medio', pct = Math.round((R.reliefK ?? 0.75) * 100);
  const tog = (id, on, txt) => `<label class="gfx-row gfx-tog"><input type="checkbox" data-g="${id}" ${on ? 'checked' : ''}><span>${txt}</span></label>`;
  return `<div class="gfx-h">Gráficos del mapa<button data-act="gfxpanel" aria-label="Cerrar">✕</button></div>
  <div class="gfx-row"><span>Calidad</span><div class="gfx-seg">${['bajo', 'medio', 'alto'].map(k => `<button data-act="gfxq" data-q="${k}" class="${k === q ? 'on' : ''}">${k}</button>`).join('')}</div></div>
  <label class="gfx-row"><span>Relieve <b id="gfx-rv">${pct} %</b></span><input type="range" min="0" max="100" step="5" value="${pct}" data-g="relief" aria-label="Intensidad del relieve"></label>
  <label class="gfx-row"><span>Luz desde <b id="gfx-lv">${azName(R.lightAz)}</b></span><input type="range" min="0" max="345" step="15" value="${R.lightAz}" data-g="light" aria-label="Dirección de la luz"></label>
  ${tog('veg', R.vegOn, 'Bosques y árboles')}${tog('roads', R.roadsOn, 'Caminos y ferrocarril')}${tog('sl', R.stateNamesOn, 'Nombres de estados')}
  <p class="gfx-note">El relieve sombrea el mapa sin cambiar el color de los países. En calidad baja no hay árboles.</p>`;
}
function azName(a) { return ['norte', 'nordeste', 'este', 'sudeste', 'sur', 'sudoeste', 'oeste', 'noroeste'][Math.round(((a % 360) + 360) % 360 / 45) % 8]; }
function openGfxPanel(force) {
  let p = document.getElementById('gfxpanel');
  if (p && !force) { p.remove(); document.getElementById('btn-gfx')?.classList.remove('on'); return; }
  if (!p) { p = document.createElement('div'); p.id = 'gfxpanel'; p.setAttribute('role', 'dialog'); p.setAttribute('aria-label', 'Gráficos del mapa'); document.body.appendChild(p); }
  p.innerHTML = gfxPanelHtml(); document.getElementById('btn-gfx')?.classList.add('on');
  const cc = document.getElementById('camctl');                                      // a la izquierda de los controles de cámara, sin taparlos
  if (cc) { const r = cc.getBoundingClientRect(); p.style.right = Math.max(8, innerWidth - r.left + 8) + 'px'; p.style.bottom = Math.max(8, innerHeight - r.bottom) + 'px'; }
  p.querySelectorAll('input[data-g]').forEach(inp => {
    const ev = inp.type === 'range' ? 'input' : 'change';
    inp.addEventListener(ev, () => {
      const g = inp.dataset.g;
      if (g === 'relief') { setReliefStrength(+inp.value / 100); p.querySelector('#gfx-rv').textContent = inp.value + ' %'; }
      else if (g === 'light') { setReliefLight(+inp.value, null); p.querySelector('#gfx-lv').textContent = azName(+inp.value); }
      else { R[{veg: 'vegOn', roads: 'roadsOn', sl: 'stateNamesOn'}[g]] = inp.checked; applyGfxToggles(); }
      gfxPrefs(true);
    });
    inp.addEventListener('keydown', e => e.stopPropagation());                       // las flechas no mueven la cámara mientras se ajusta
  });
}
Object.assign(ACT, {
  gfxpanel: () => openGfxPanel(false),
  gfxq: d => { const q = d.q || (d.dataset && d.dataset.q); if (!q) return; R.qualityManual = true; R.resScale = 1; applyQuality(q, 'Calidad gráfica: ' + q); saveMapPrefs(); openGfxPanel(true); }
});
function ensureGfxButton() {
  if (document.getElementById('btn-gfx')) return; const q = document.getElementById('btn-quality'); if (!q) return;
  const b = document.createElement('button'); b.id = 'btn-gfx'; b.dataset.act = 'gfxpanel'; b.dataset.tip = '<b>Gráficos del mapa</b><br>Calidad, relieve, luz, árboles, caminos y nombres.'; b.setAttribute('aria-label', 'Gráficos del mapa'); b.textContent = '☀';
  q.after(b);
  if (!document.getElementById('gfx-css')) { const st = document.createElement('style'); st.id = 'gfx-css'; st.textContent = GFX_CSS; document.head.appendChild(st); }
}
const GFX_CSS = `#gfxpanel{position:fixed;right:64px;bottom:206px;width:250px;padding:10px 12px 8px;background:rgba(18,24,30,.96);border:1px solid var(--goldd);border-radius:8px;box-shadow:0 8px 30px rgba(0,0,0,.7);z-index:60;color:var(--text);font-size:13px}
#gfxpanel .gfx-h{font-family:var(--head);color:var(--gold2);font-size:14px;letter-spacing:.06em;display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}
#gfxpanel .gfx-h button{background:none;border:0;color:var(--dim);cursor:pointer;font-size:14px}
#gfxpanel .gfx-row{display:flex;flex-direction:column;gap:4px;margin:8px 0}#gfxpanel .gfx-row b{color:var(--gold2);font-weight:700}
#gfxpanel input[type=range]{width:100%;accent-color:#c9a657}
#gfxpanel .gfx-tog{flex-direction:row;align-items:center;gap:8px;cursor:pointer}#gfxpanel .gfx-tog input{accent-color:#c9a657;width:16px;height:16px}
#gfxpanel .gfx-seg{display:flex;gap:4px}#gfxpanel .gfx-seg button{flex:1;padding:4px 0;border:1px solid var(--goldd);border-radius:5px;background:#1d262d;color:var(--text);cursor:pointer;text-transform:capitalize}
#gfxpanel .gfx-seg button.on{background:linear-gradient(#8a6f2f,#5b4818);color:#fff6d6;border-color:var(--gold2)}
#gfxpanel .gfx-note{margin:8px 0 2px;color:var(--dim);font-size:11.5px;line-height:1.4}
.atoken em{font-style:normal;font-size:10.5px;color:#e8d9a8;margin-left:1px}
.maplabel,.statelabel,.citylabel{transition:opacity .25s}
.statelabel{text-shadow:0 0 4px #000,0 0 3px #000,0 1px 2px #000}
.citylabel.up{display:flex !important;flex-direction:column-reverse;align-items:center}.citylabel.up i{margin:1px auto 0}`;

const _graphicsTickRot = graphicsTick;
graphicsTick = function (t) {
  _graphicsTickRot(t); ensureGfxButton();
  if (R.roadMesh && R.roadMesh.visible !== R.roadsOn) { R.roadMesh.visible = R.roadsOn; if (R.railMesh) R.railMesh.visible = R.roadsOn; }
};
// sin árboles si el jugador los apaga
const _refreshVegRot = refreshVegetation;
refreshVegetation = function (force) {
  if (R.vegOn === false) { if (R.vegMeshes && R.vegMeshes.some(m => m.count)) { R.vegMeshes.forEach(m => { m.count = 0; }); R.dirty = true; } R._vegKey = null; return; }
  _refreshVegRot(force);
};
