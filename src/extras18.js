/* ===== EXTRAS 18: perfiles de producción, coaliciones promovidas por el jugador, modo simple y controles táctiles del soldado ===== */

/* ---------- 1) perfiles de producción militar ---------- */
const PROD_PRESETS = [
  {id: 'auto', n: '🤖 Según déficit', d: 'Reparte las fábricas donde más falta hace el equipo (como la IA).'},
  {id: 'army', n: '🔫 Ejército', d: '40% fusiles, 35% munición, 25% artillería.', w: {rifles: .4, ammo: .35, cannons: .25}},
  {id: 'navy', n: '⚓ Armada', d: '70% buques, resto munición y artillería.', w: {ships: .7, ammo: .15, cannons: .15}},
  {id: 'air', n: '✈️ Aire', d: '60% aviones, 15% fusiles y munición, 10% ametralladoras.', w: {aircraft: .6, mgs: .1, ammo: .15, rifles: .15}}
];
function prodApplyW(c, w) {
  const m = mc(c), F = m.F || milFactories(c), ks = LINE_ORDER.filter(k => lineAvail(c, k) && w[k] > 0); if (!ks.length || F <= 0) return false;
  const tot = ks.reduce((n, k) => n + w[k], 0), f = {}; let left = F;
  ks.forEach(k => { f[k] = Math.floor(F * w[k] / tot); left -= f[k]; }); ks.sort((a, b) => w[b] - w[a]); let i = 0; while (left > 0) { f[ks[i++ % ks.length]]++; left--; }
  LINE_ORDER.forEach(k => { if (!lineAvail(c, k)) return; const L = lineOf(c, k), nf = f[k] || 0; if (nf < L.f) L.eff = Math.max(0.1, L.eff * 0.85); L.f = nf; });
  return true;
}
function prodPresetsHtml() {
  const c = me(), m = mc(c); m.pre = m.pre || [];
  return `<div class="card"><h3>📋 Perfiles de producción</h3><p class="hint">Un clic reparte todas tus fábricas militares. Guarda tu reparto actual para reutilizarlo cuando cambie la situación.</p>
  <div class="btnrow">${PROD_PRESETS.map(p => `<button data-act="prapply" data-id="${p.id}" data-tip="${p.d}">${p.n}</button>`).join('')}</div>
  ${m.pre.length ? `<div class="btnrow" style="margin-top:6px">${m.pre.map((p, i) => `<span class="chipbtn"><button data-act="prapply" data-id="u${i}" data-tip="${Object.entries(p.w).filter(e => e[1]).map(e => LINE_KINDS[e[0]].name + ' ' + e[1]).join(' · ')}">⭐ ${p.n}</button><button data-act="prdel" data-i="${i}" data-tip="Borrar perfil">✕</button></span>`).join('')}</div>` : ''}
  <div class="btnrow" style="margin-top:6px"><button data-act="prsave" ${m.pre.length >= 5 ? 'disabled' : ''}>💾 Guardar el reparto actual</button></div></div>`;
}
(function () { const t = MX_TABS.find(x => x.id === 'production'); if (!t) return; const h = t.html; t.html = function () { return h().replace('<div class="col wide">', '<div class="col wide">' + prodPresetsHtml()); }; })();
Object.assign(ACT, {
  prapply: d => { const c = me(), m = mc(c); let ok = false;
    if (d.id === 'auto') { const F = m.F || milFactories(c); LINE_ORDER.forEach(k => { if (lineAvail(c, k)) lineOf(c, k); }); aiLines(c, F, eqNeedOf(c.tag)); ok = true; }
    else if (d.id[0] === 'u') { const p = (m.pre || [])[+d.id.slice(1)]; if (p) ok = prodApplyW(c, p.w); } else { const p = PROD_PRESETS.find(x => x.id === d.id); if (p) ok = prodApplyW(c, p.w); }
    toast(ok ? '🏭' : '⚠️', ok ? 'Perfil aplicado: las fábricas se han repartido. La eficiencia se recupera con las semanas.' : 'No hay líneas disponibles para ese perfil.'); renderWindow(); },
  prsave: () => { const c = me(), m = mc(c); m.pre = m.pre || []; if (m.pre.length >= 5) return; const w = {}; let tot = 0; LINE_ORDER.forEach(k => { const L = m.lines[k]; if (L && L.f > 0) { w[k] = L.f; tot += L.f; } }); if (!tot) { toast('⚠️', 'No hay fábricas asignadas que guardar.'); return; }
    m.pre.push({n: 'Perfil ' + (m.pre.length + 1), w}); toast('💾', 'Perfil guardado.'); renderWindow(); },
  prdel: d => { const m = mc(me()); (m.pre || []).splice(+d.i, 1); renderWindow(); }
});

/* ---------- 2) el jugador promueve una coalición contra una potencia amenazante ---------- */
function coalTargets() {
  return G.tags.filter(t => t !== NONE && t !== G.player && alive(t) && G.C[t].rank <= 14 && !anyPactBetween(t, G.player, ['alliance', 'guarantee']) && !coalitionOf(t) && threatOf(G.C[t]) >= 20)
    .sort((a, b) => threatOf(G.C[b]) - threatOf(G.C[a])).slice(0, 4);
}
const _coalitionsHtml18 = coalitionsHtml;
coalitionsHtml = function () {
  const base = _coalitionsHtml18(), c = me(), L = coalTargets();
  const card = `<div class="card"><h3>🤝 Promover una coalición</h3><p class="hint">Si una potencia acumula infamia y conquistas, puedes convencer a otras (60 de influencia) de formar una coalición contra ella. La coalición actúa por su cuenta: presiona con crisis diplomáticas y acude a frenarla si hay guerra. Tú no entras en ella.</p>
    ${L.length ? L.map(t => `<div class="kv"><span>${flag(t, 'sm')} ${G.C[t].name} <small class="dim">· amenaza ${Math.round(threatOf(G.C[t]))}</small></span><button data-act="coalform" data-t="${t}" ${c.influence < 60 ? 'disabled' : ''}>Promover (60 infl.)</button></div>`).join('') : '<small class="dim">Ninguna potencia representa hoy una amenaza suficiente (índice ≥ 20) sin coalición ni lazos contigo.</small>'}</div>`;
  return base + card;
};
ACT.coalform = d => {
  const c = me(), t = d.t, T = G.C[t]; if (!T || c.influence < 60 || coalitionOf(t)) return;
  const cand = G.tags.filter(x => x !== NONE && x !== G.player && G.C[x].ai && G.C[x].rank <= 26 && coalCandidate(x, t) && relOf(x, t) < 40 && relOf(x, G.player) > -25)
    .sort((a, b) => relOf(a, t) - relOf(b, t)).slice(0, 5);
  if (cand.length < 2) { toast('🛡️', 'Casi nadie está dispuesto a oponerse a ' + T.name + ' ahora mismo.'); return; }
  c.influence -= 60; G.coals = G.coals || []; G.nextCoal = G.nextCoal || 1;
  const leader = cand.slice().sort((a, b) => armyPower(G.C[b]) - armyPower(G.C[a]))[0];
  G.coals.push({id: G.nextCoal++, target: t, leader, members: cand, age: 0, promoted: true});
  cand.forEach(m => addRel(G.player, m, 6));
  toast('🛡️', `Coalición formada contra ${T.name}: ${cand.map(m => G.C[m].name).join(', ')}.`); if (t !== G.player) logMsg(`Coalición contra ${T.name}, liderada por ${G.C[leader].name}.`); renderWindow();
};

/* ---------- 3) modo simple: oculta lo avanzado, deja lo esencial ---------- */
const _uiPrefs18 = uiPrefs;
uiPrefs = function (p) { const r = _uiPrefs18(p); document.documentElement.dataset.simple = UI_PREFS.simple === '1' ? '1' : '0'; return r; };
ACT.uisimple = () => { uiPrefs({simple: UI_PREFS.simple === '1' ? '0' : '1'}); toast('🧭', UI_PREFS.simple === '1' ? 'Modo simple: solo lo esencial. (Comercio, aire, mar, doctrinas y mapas avanzados ocultos; el piloto automático ayuda con el resto.)' : 'Modo completo: todos los sistemas visibles.'); if (typeof renderWindow === 'function') renderWindow(); };
const _gfx18 = gfxPanelHtml;
gfxPanelHtml = function () { return _gfx18().replace('<button data-act="uicompact"', `<button data-act="uisimple" class="${UI_PREFS.simple === '1' ? 'on' : ''}" data-tip="Oculta comercio, mapas avanzados y pestañas militares especializadas">Modo simple</button><button data-act="uicompact"`); };
uiPrefs();

/* ---------- 4) controles táctiles del soldado (primera persona) ---------- */
function tcBuild() {
  if (document.getElementById('sctouch')) return document.getElementById('sctouch');
  const d = document.createElement('div'); d.id = 'sctouch'; d.innerHTML = `<div class="tc-look"></div><div class="tc-joy"><i></i></div><div class="tc-btns"><button data-k="fire">🔫</button><button data-k="ads">🎯</button><button data-k="run">💨</button><button data-k="kneel">⬇</button><button data-k="flag">🚩</button><button data-k="exit">✕</button></div>`; document.body.appendChild(d);
  const key = k => document.dispatchEvent(new KeyboardEvent('keydown', {key: k, bubbles: true}));
  const look = d.querySelector('.tc-look'); let lp = null;
  look.addEventListener('pointerdown', e => { lp = {id: e.pointerId, x: e.clientX, y: e.clientY}; look.setPointerCapture(e.pointerId); e.preventDefault(); });
  look.addEventListener('pointermove', e => { const c = SOLD.on && SOLD.ctrl; if (!lp || e.pointerId !== lp.id || !c) return; const dx = e.clientX - lp.x, dy = e.clientY - lp.y; lp.x = e.clientX; lp.y = e.clientY; const k = c.ads ? 0.45 : 1; c.cyaw += dx * 0.0052 * k; c.pitch = clamp(c.pitch - dy * 0.0052 * k, -1.3, 1.3); });
  const lend = e => { if (lp && e.pointerId === lp.id) lp = null; }; look.addEventListener('pointerup', lend); look.addEventListener('pointercancel', lend);
  const joy = d.querySelector('.tc-joy'), nub = joy.querySelector('i'); let jp = null;
  const jset = (dx, dy) => { const R0 = 46, m = Math.hypot(dx, dy) || 1, s = Math.min(1, m / R0), nx = dx / m * s, ny = dy / m * s; nub.style.transform = `translate(${nx * R0}px,${ny * R0}px)`; CK.w = ny < -0.35 ? 1 : 0; CK.s = ny > 0.35 ? 1 : 0; CK.a = nx < -0.35 ? 1 : 0; CK.d = nx > 0.35 ? 1 : 0; CK.shift = (s > 0.95 && ny < -0.6) || d.dataset.run === '1' ? 1 : 0; };
  const jrel = () => { jp = null; nub.style.transform = ''; CK.w = CK.a = CK.s = CK.d = 0; CK.shift = d.dataset.run === '1' ? 1 : 0; };
  joy.addEventListener('pointerdown', e => { const r = joy.getBoundingClientRect(); jp = {id: e.pointerId, cx: r.left + r.width / 2, cy: r.top + r.height / 2}; joy.setPointerCapture(e.pointerId); jset(e.clientX - jp.cx, e.clientY - jp.cy); e.preventDefault(); });
  joy.addEventListener('pointermove', e => { if (jp && e.pointerId === jp.id) jset(e.clientX - jp.cx, e.clientY - jp.cy); });
  joy.addEventListener('pointerup', jrel); joy.addEventListener('pointercancel', jrel);
  d.querySelectorAll('.tc-btns button').forEach(b => {
    const k = b.dataset.k;
    if (k === 'fire' || k === 'ads') { const set = v => { CK[k] = v; b.classList.toggle('on', !!v); }; b.addEventListener('pointerdown', e => { set(1); b.setPointerCapture(e.pointerId); e.preventDefault(); }); b.addEventListener('pointerup', () => set(0)); b.addEventListener('pointercancel', () => set(0)); }
    else b.addEventListener('pointerdown', e => { e.preventDefault(); if (k === 'run') { d.dataset.run = d.dataset.run === '1' ? '0' : '1'; CK.shift = d.dataset.run === '1' ? 1 : 0; b.classList.toggle('on', d.dataset.run === '1'); } else if (k === 'kneel') key('z'); else if (k === 'flag') key('f'); else if (k === 'exit') { try { ctrlExit(); } catch (er) { } } });
  });
  return d;
}
setInterval(() => { try { const on = !!(SOLD.on && SOLD.ctrl) && (document.body.classList.contains('touch') || /[?&]tactil/.test(location.search)); if (!on && !document.getElementById('sctouch')) return; const d = tcBuild(); d.style.display = on ? 'block' : 'none'; if (!on) { d.dataset.run = '0'; d.querySelectorAll('.on').forEach(b => b.classList.remove('on')); } } catch (e) { } }, 400);
