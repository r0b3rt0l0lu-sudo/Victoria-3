/* ===== COMBATE MENOS AUTOMÁTICO =====
   1) OFENSIVA SINCRONIZADA: con varios ejércitos seleccionados, «Ofensiva sincronizada» + clic en el objetivo calcula el tiempo de marcha de cada uno y retrasa
      la salida de los más cercanos para que TODOS lleguen a la vez.
   2) CAMPAÑA: «Campaña hasta el objetivo» fija un destino permanente: el ejército lo retoma solo si se detiene, retrocede o termina una batalla, hasta llegar.
   3) FACTORES DE LA BATALLA: tabla comparativa por bando (general, suministro, moral, entrenamiento, equipo, aire, mar, terreno, atrincheramiento) en el panel de batalla
      y en el resumen final, para entender por qué se gana o se pierde. */
const PLAN = {mode: null};
function planExec(pid) {
  const list = selectedArmies(); if (!list.length) return; const m = PLAN.mode; PLAN.mode = null; document.body.classList.remove('planmode');
  if (m === 'camp') { list.forEach(a => { a.camp = {goal: pid}; orderMove(a, pid); }); toast('📌', `Campaña fijada: ${list.length} ejército(s) avanzarán hasta ${provName(pid)} y lo retomarán si se detienen.`); return; }
  const info = list.map(a => { const p = findPath(a, pid); if (!p || !p.length) return {a, eta: Infinity}; let t = 0, prev = a.loc; p.forEach(q => { t += hopDays(a, prev, q); prev = q; }); return {a, eta: t}; }).filter(x => x.eta < Infinity);
  if (!info.length) { toast('⚠️', 'Ningún ejército puede llegar a ese territorio.'); return; }
  const T = Math.max(...info.map(x => x.eta)); info.forEach(x => { const wait = Math.round(T - x.eta); x.a.sched = wait > 0 ? {t: G.date.t + wait, pid} : null; if (wait <= 0) orderMove(x.a, pid); else { x.a.path = []; x.a.dest = null; } });
  toast('🎯', `Ofensiva sincronizada: ${info.length} ejércitos llegarán a ${provName(pid)} en ~${T} días${info.some(x => x.eta < T) ? ' (los más cercanos esperan para llegar a la vez)' : ''}.`);
}
const _onMapClickC2 = window.onMapClick;
window.onMapClick = function (id, e, pid) { if (PLAN.mode && pid !== undefined && pid >= 0) { planExec(pid); return; } return _onMapClickC2(id, e, pid); };
function planDay() {
  G.armies.forEach(a => {
    if (a.sched && G.date.t >= a.sched.t) { const pid = a.sched.pid; a.sched = null; if (!a.battle) orderMove(a, pid); }
    if (a.camp && !a.battle && !a.sea && !a.landing) { if (a.loc === a.camp.goal) { a.camp = null; if (ownsArmy(a)) notify('war', `${a.name} ha alcanzado el objetivo de su campaña.`, provState(a.loc)); } else if (!(a.path && a.path.length) && !a.sched && (G.date.t + a.id) % 3 === 0) { const r = orderMove(a, a.camp.goal, true); if (!r || !r.ok) { a.camp.fail = (a.camp.fail || 0) + 1; if (a.camp.fail > 8) a.camp = null; } } }
  });
}
const _navyDayC2 = navyDay; navyDay = function () { _navyDayC2(); planDay(); };
// botones en el panel del ejército
const _renderArmyPanelC2 = renderArmyPanel;
renderArmyPanel = function () {
  _renderArmyPanelC2(); const root = $('#armypanel'), a = UI.selArmy ? armyById(UI.selArmy) : null; if (!root || !a || !ownsArmy(a) || !root.classList.contains('open') || root.querySelector('.plan-row')) return;
  const n = selectedArmies().length, row = document.createElement('div'); row.className = 'plan-row'; row.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;margin:8px 0';
  row.innerHTML = `<button data-act="plansync" ${n < 2 ? 'disabled' : ''} data-tip="Con varios ejércitos seleccionados: todos llegan a la vez al objetivo">🎯 Ofensiva sincronizada (${n})</button><button data-act="plancamp" data-tip="El ejército retoma solo su marcha hasta el objetivo">📌 Campaña hasta objetivo</button>${a.camp ? `<button data-act="plancancel">✖ Cancelar campaña</button>` : ''}`;
  root.appendChild(row);
};
Object.assign(ACT, {
  plansync: () => { PLAN.mode = 'sync'; document.body.classList.add('planmode'); toast('🎯', 'Haz clic en el territorio objetivo de la ofensiva.'); },
  plancamp: () => { PLAN.mode = 'camp'; document.body.classList.add('planmode'); toast('📌', 'Haz clic en el territorio objetivo de la campaña.'); },
  plancancel: () => { selectedArmies().forEach(a => { a.camp = null; a.sched = null; }); toast('✖', 'Campaña cancelada.'); renderArmyPanel(); }
});
document.addEventListener('keydown', e => { if (e.key === 'Escape' && PLAN.mode) { PLAN.mode = null; document.body.classList.remove('planmode'); } }, true);
(function () { const st = document.createElement('style'); st.textContent = 'body.planmode #game,body.planmode canvas{cursor:crosshair!important}'; document.head.appendChild(st); })();

/* ---------- factores de la batalla ---------- */
function battleFactors(b) {
  const sides = {A: b.A.map(armyById).filter(Boolean), B: b.B.map(armyById).filter(Boolean)}; const rows = [];
  const avg = (as, f) => { let s = 0, n = 0; as.forEach(a => { const v = f(a); if (v !== undefined && isFinite(v)) { s += v; n++; } }); return n ? s / n : null; };
  const tag = k => k === 'A' ? b.A0 : b.B0;
  const defs = [
    ['🎖️ General (ataque/defensa)', as => avg(as, a => (a.gen.atk + a.gen.def) / 2), v => v.toFixed(1) + '★', 0],
    ['📦 Suministro', as => avg(as, a => a.sup === undefined ? 1 : a.sup), v => Math.round(v * 100) + '%', 0.05],
    ['💪 Moral', as => avg(as, a => typeof morMod === 'function' ? morMod(a) : 1), v => (v >= 1 ? '+' : '') + Math.round((v - 1) * 100) + '%', 0.03],
    ['📚 Entrenamiento', as => avg(as, a => avg([a], x => a.divs.reduce((n, d) => n + trainMod(d), 0) / Math.max(1, a.divs.length))), v => (v >= 1 ? '+' : '') + Math.round((v - 1) * 100) + '%', 0.03],
    ['🔫 Equipo', as => avg(as, a => a.divs.length && typeof equipMod === 'function' ? a.divs.reduce((n, d) => n + equipMod(a.tag, d.t), 0) / a.divs.length : 1), v => Math.round(v * 100) + '%', 0.05],
    ['⛏️ Atrincheramiento', as => avg(as, a => a.dig || 0), v => v.toFixed(1), 0.5]
  ];
  defs.forEach(([name, f, fmt, eps]) => { const va = f(sides.A), vb = f(sides.B); if (va === null || vb === null) return; rows.push({name, a: fmt(va), b: fmt(vb), adv: Math.abs(va - vb) <= eps ? 0 : va > vb ? 1 : -1}); });
  try { const air = [airBonus(tag('A'), b.state), airBonus(tag('B'), b.state)], nav = [navBonus(tag('A'), b.state), navBonus(tag('B'), b.state)], pc = v => (v >= 0 ? '+' : '') + Math.round(v * 100) + '%';
    rows.push({name: '✈️ Aire', a: pc(air[0]), b: pc(air[1]), adv: Math.abs(air[0] - air[1]) < 0.02 ? 0 : air[0] > air[1] ? 1 : -1}); rows.push({name: '⚓ Mar', a: pc(nav[0]), b: pc(nav[1]), adv: Math.abs(nav[0] - nav[1]) < 0.02 ? 0 : nav[0] > nav[1] ? 1 : -1}); } catch (e) { }
  try { const ta = terrMods(b, 'A'), tb = terrMods(b, 'B'), va = b.att === 'A' ? ta.att : ta.def, vb = b.att === 'B' ? tb.att : tb.def, pc = v => (v >= 0 ? '+' : '') + Math.round(v * 100) + '%'; rows.push({name: '⛰️ Terreno', a: pc(va), b: pc(vb), adv: Math.abs(va - vb) < 0.02 ? 0 : va > vb ? 1 : -1}); } catch (e) { }
  return rows;
}
function battleFactorsHtml(b) {
  let rows; try { rows = battleFactors(b); } catch (e) { return ''; } if (!rows.length) return '';
  const A = G.C[b.A0], B = G.C[b.B0]; const score = rows.reduce((n, r) => n + r.adv, 0);
  return `<div class="bt-fact card" style="margin-top:8px"><h4 style="margin:0 0 6px">🔍 Factores de la batalla</h4><table class="tbl"><thead><tr><th></th><th class="r">${A ? A.name : 'A'}</th><th class="r">${B ? B.name : 'B'}</th></tr></thead><tbody>${rows.map(r => `<tr><td>${r.name}</td><td class="r ${r.adv > 0 ? 'good' : r.adv < 0 ? 'bad' : ''}">${r.a}${r.adv > 0 ? ' ▲' : ''}</td><td class="r ${r.adv < 0 ? 'good' : r.adv > 0 ? 'bad' : ''}">${r.b}${r.adv < 0 ? ' ▲' : ''}</td></tr>`).join('')}</tbody></table><small class="dim">${score === 0 ? 'Fuerzas equilibradas.' : `Ventaja de factores para ${score > 0 ? (A ? A.name : 'A') : (B ? B.name : 'B')} (${Math.abs(score)} de ${rows.length}).`}</small></div>`;
}
const _bsumHtmlC2 = battleSummaryHtml;
battleSummaryHtml = function (b) { const h = _bsumHtmlC2(b); return h ? h + (b.factSnap || '') : h; };
const _battleSummaryC2 = battleSummary; battleSummary = function (b, w, win, lose) { _battleSummaryC2(b, w, win, lose); try { b.factSnap = b._factLast || battleFactorsHtml(b); } catch (e) { } };
const _renderBattlePanelC2 = renderBattlePanel;
renderBattlePanel = function () {
  _renderBattlePanelC2(); const root = $('#battlepanel'); if (!root || !root.classList.contains('open')) return; const b = G.battles.find(x => x.id === UI.battle); if (!b) return;
  const now = performance.now(); if (root._fT && now - root._fT < 1500 && root.querySelector('.bt-fact')) return; root._fT = now; const html = battleFactorsHtml(b); b._factLast = html; let el = root.querySelector('.bt-fact'); if (el) el.outerHTML = html; else root.insertAdjacentHTML('beforeend', html);
};
