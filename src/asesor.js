/* ===== ASESOR: «¿qué hago ahora?» =====
   Un botón 🧭 junto a los de la barra superior muestra una insignia con los avisos importantes y abre un panel con consejos priorizados según
   el estado real del país (deuda, investigación parada, obras sin cola, guerra y batallas, propuestas, riesgo de guerra civil…). Cada
   consejo lleva un botón que abre la ventana exacta donde se resuelve. Al empezar también guía los primeros pasos. */
function advisorTips(c) {
  const tips = [], add = (pri, icon, title, text, go) => tips.push(Object.assign({pri, icon, title, text}, go || {})), st = c.stats, W = (w, k, t) => ({w, k, t});
  const bal = st.income - st.expense - (c.budget.expense.constr || 0) - (c.budget.expense.pub || 0) - (c.budget.expense.interest || 0) - (c.budget.expense.army || 0) - (c.budget.expense.equip || 0);
  const mine = G.battles.filter(b => b.A0 === G.player || b.B0 === G.player || b.A.some(id => (armyById(id) || {}).tag === G.player) || b.B.some(id => (armyById(id) || {}).tag === G.player));
  // ---- urgentes ----
  if (c.treasury < 0 || (c.debt && c.debt > Math.max(1, st.income) * 12)) add(1, '💸', 'Estás endeudado', `Tu tesorería es ${money(c.treasury)} y los intereses te asfixian. Sube los impuestos o recorta gastos.`, W('budget'));
  else if (bal < 0 && c.treasury < st.income * 6) add(1, '📉', 'Gastas más de lo que ingresas', `Balance semanal ${money(bal)}. A este ritmo te quedarás sin fondos: revisa impuestos y gasto público.`, W('budget'));
  mine.forEach(b => add(1, '⚔️', `Batalla en ${provName(b.prov)}`, 'Hay un combate en el que participas. Entra al panel para ver el campo, dar órdenes a tus bloques y cambiar la estrategia.', {battle: b.id}));
  if (typeof cwRisk === 'function' && typeof rule === 'function' && rule('civil')) { const R = cwRisk(c); if (R.pct >= 40) add(1, '🚨', `Riesgo de guerra civil ${R.pct}%`, `${R.why.slice(0, 2).join(' · ')}. Sube la legitimidad con reformas o reduce los radicales.`, W('politics', 'pol', 'laws')); }
  if (c.wars.length && c.eqFill && ['rifles', 'gunpowder'].some(g => (c.eqFill[g] === undefined ? 1 : c.eqFill[g]) < 0.6)) add(1, '🔫', 'Tus tropas se quedan sin armas', 'Faltan fusiles o pólvora. Asigna más fábricas a la producción militar o compra equipo.', W('military', 'mil', 'production'));
  // ---- importantes ----
  if (!c.research && TECHS.some(t => techAvailable(c, t))) add(2, '💡', 'No estás investigando nada', 'La innovación se acumula sin usar. Elige una tecnología: las industriales mejoran toda tu economía.', W('tech'));
  if (c.queue && !c.queue.length && !(c.projects && c.projects.length) && c.treasury > st.income * 4) add(2, '🏗️', 'La cola de obras está vacía', 'Tienes fondos y capacidad de construcción sin usar. Construye fábricas, granjas o astilleros.', W('construction'));
  if (G.proposals.length) add(2, '✉️', `${G.proposals.length} propuesta${G.proposals.length > 1 ? 's' : ''} diplomática${G.proposals.length > 1 ? 's' : ''}`, 'Otros países esperan tu respuesta: tratados, alianzas o garantías.', W('diplomacy', 'dip', 'pacts'));
  if (c.legitimacy < 40 && !(typeof cwRisk === 'function' && cwRisk(c).pct >= 40)) add(2, '🏛️', 'Legitimidad baja', `Está en ${Math.round(c.legitimacy)}%: crecen los disturbios. Prueba con reformas o con los grupos de interés que te apoyan.`, W('politics', 'pol', 'igs'));
  if (c.wars.length) { const idle = armiesOf(G.player).filter(a => !a.sea && !a.battle && !a.path.length && !a.front && !a.mode).length; if (idle >= 2) add(2, '🪖', `${idle} ejércitos sin órdenes`, 'Estás en guerra y tienes tropas paradas. Dibuja un frente de ataque o de defensa, o muévelas.', W('military', 'mil', 'armies')); }
  // ---- sugerencias ----
  if (c.influence > 140) add(3, '🕊️', `Influencia sin gastar (${Math.floor(c.influence)})`, 'Úsala en reformas, en mejorar relaciones o en fabricar casus belli.', W('diplomacy', 'dip', 'world'));
  if (c.nat && !c.nat.cur && G.date.t > 90) add(3, '🌳', 'Elige una decisión nacional', 'Las decisiones dan ventajas permanentes a tu país.', W('national'));
  if (!c.wars.length && (c.stats.indLevels || 0) < 20 && c.treasury > st.income * 8) add(3, '🏭', 'Tienes ahorros: invierte en industria', 'En tiempos de paz lo que más rinde es construir y mejorar tus leyes económicas.', W('production', 'prod', 'buildings'));
  // ---- primeros pasos ----
  const early = UI.startT !== undefined && G.date.t - UI.startT < 540, seen = UI.seen || {};
  if (early) {
    if (G.paused) add(3, '▶️', 'El juego está en pausa', 'Pulsa ▶ (o la barra espaciadora) para que pase el tiempo. Las teclas , y . cambian la velocidad.', null);
    if (!seen.production) add(3, '🏭', 'Conoce tu economía', 'Mira qué produce y qué necesita tu país. Las teclas 1–9 abren las ventanas de la barra inferior.', W('production'));
    if (!seen.politics) add(3, '🏛️', 'Revisa tu política', 'Las leyes y los grupos de interés definen cuánto poder tiene tu gobierno.', W('politics'));
  }
  return tips.sort((a, b) => a.pri - b.pri).slice(0, 8);
}
let _advCache = {t: -1, n: 0, list: []};
function advisorCached() { const now = performance.now(); if (now - _advCache.t > 1500) { const c = me(); _advCache.t = now; _advCache.list = c ? advisorTips(c) : []; _advCache.n = _advCache.list.filter(t => t.pri <= 2).length; } return _advCache; }
function advisorBadge() { const b = document.getElementById('btn-advisor'); if (!b) return; const n = advisorCached().n, i = b.querySelector('.badge'); if (i) { i.textContent = n; i.style.display = n ? 'flex' : 'none'; } b.classList.toggle('alert', advisorCached().list.some(t => t.pri === 1)); }
function advisorHtml() {
  const l = advisorCached().list, P = ['', 'Urgente', 'Importante', 'Sugerencia'];
  return `<div class="adv-head"><b>🧭 Asesor</b><small>Qué conviene hacer ahora</small><button class="x" data-act="advisor">✕</button></div>
  <div class="adv-list">${l.length ? l.map(t => `<div class="tip p${t.pri}"><span class="ti">${t.icon}</span><div class="tt"><b>${t.title}</b><small>${t.text}</small><em>${P[t.pri]}</em></div>${t.w || t.battle ? `<button data-act="tipgo" ${t.battle ? `data-b="${t.battle}"` : `data-w="${t.w}"`} ${t.k ? `data-k="${t.k}" data-t="${t.t}"` : ''}>Ir</button>` : ''}</div>`).join('') : '<div class="adv-ok">✅ Todo en orden. No hay nada urgente: sigue construyendo o explora la Diplomacia.</div>'}</div>
  <small class="adv-foot">Se actualiza solo. Atajos: 1–9 abren las ventanas, F1 el manual.</small>`;
}
function advisorToggle(force) {
  let e = document.getElementById('advisor');
  if (!e) { e = document.createElement('div'); e.id = 'advisor'; document.body.appendChild(e); }
  const open = force !== undefined ? force : !e.classList.contains('open');
  e.classList.toggle('open', open); if (open) { _advCache.t = -1; e.innerHTML = advisorHtml(); }
}
Object.assign(ACT, {
  advisor: () => advisorToggle(),
  tipgo: d => {
    advisorToggle(false);
    if (d.b) { UI.battle = +d.b; renderBattlePanel(); return; }
    if (d.k) UI.winTab[d.k] = d.t; UI.win = null; openWindow(d.w);
  }
});
document.addEventListener('click', e => { const a = document.getElementById('advisor'); if (a && a.classList.contains('open') && !e.target.closest('#advisor') && !e.target.closest('#btn-advisor')) advisorToggle(false); });
// refresca el panel abierto con el estado actual (cada pocos segundos)
setInterval(() => { const a = document.getElementById('advisor'); if (a && a.classList.contains('open') && UI.started) { _advCache.t = -1; a.innerHTML = advisorHtml(); } }, 4000);
