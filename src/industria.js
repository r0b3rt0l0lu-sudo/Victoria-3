/* ===== INDUSTRIA: construir fábricas e impulsar la economía =====
   Ventana propia (🏭 Industria, tecla 0) con tres pestañas:
   · CONSTRUIR: recomendaciones (qué edificio y dónde rinde más según los precios actuales, la mano de obra libre y el espacio disponible), un constructor por estado con coste real,
     rentabilidad, huecos y botón de obra, y la cola pública (subir de prioridad o cancelar).
     Rentabilidad = valor añadido por nivel a los precios de hoy / valor añadido a precios base (1,00 = normal; > 1 compensa construir).
   · IMPULSO: programas temporales que se compran con el tesoro y algo de influencia (obras públicas, fomento industrial, modernización agraria, formación técnica, estímulo
     fiscal). Duran 12 meses y tienen un enfriamiento de otros 12. Se guardan en c.prog = {id: {t0}}; sus efectos entran por ecoMods (modificadores del país).
   · RESUMEN: fábricas por tipo, ocupación, cuellos de botella (bienes caros) y producción por sectores. */
const IND_PROGS = {
  obras: {ic: '🏗️', n: 'Plan de obras públicas', wk: 10, inf: 8, mods: {constr: 0.35}, d: 'Contratas a gran escala: +35 % de puntos de construcción durante 12 meses.'},
  fomento: {ic: '🏭', n: 'Fomento industrial', wk: 12, inf: 10, mods: {indOut: 0.08, invest: 0.05}, d: 'Créditos y aranceles a la industria: +8 % de producción industrial y +5 % de inversión privada.'},
  agro: {ic: '🌾', n: 'Modernización agraria y minera', wk: 8, inf: 6, mods: {agriOut: 0.1, mineOut: 0.08}, d: 'Maquinaria y abonos: +10 % de producción agrícola y +8 % minera.'},
  educ: {ic: '🎓', n: 'Formación técnica', wk: 8, inf: 6, mods: {lit: 0.08, innov: 0.12}, d: 'Escuelas de oficios y becas: más alfabetización y más innovación.'},
  estimulo: {ic: '💸', n: 'Estímulo fiscal', wk: 6, inf: 8, mods: {invest: 0.12, out: 0.02}, d: 'Desgravaciones a la inversión: +12 % de inversión privada y +2 % de producción general.'}
};
const PROG_DAYS = 360, PROG_COOL = 720;
const progLeft = (c, id) => { const p = c.prog && c.prog[id]; return p ? p.t0 + PROG_DAYS - G.date.t : 0; };
const progReady = (c, id) => { const p = c.prog && c.prog[id]; return !p || G.date.t >= p.t0 + PROG_COOL; };
const progCost = (c, id) => Math.round(Math.max(1, c.stats.income || 0) * IND_PROGS[id].wk);
function progBuy(c, id) {
  const P = IND_PROGS[id]; if (!P) return {ok: false, msg: 'Programa desconocido.'};
  if (!progReady(c, id)) return {ok: false, msg: progLeft(c, id) > 0 ? 'Ese programa ya está en marcha.' : `Debes esperar ${Math.ceil((c.prog[id].t0 + PROG_COOL - G.date.t) / 30)} meses para repetirlo.`};
  const cost = progCost(c, id); if (c.treasury < cost) return {ok: false, msg: `Necesitas ${money(cost)} en el tesoro.`};
  if ((c.influence || 0) < P.inf) return {ok: false, msg: `Necesitas ${P.inf} de influencia.`};
  c.treasury -= cost; c.influence -= P.inf; c.prog = c.prog || {}; c.prog[id] = {t0: G.date.t}; recalcMods(c);
  return {ok: true, msg: `${P.n}: en marcha durante 12 meses.`};
}
const _ecoModsInd = ecoMods;
ecoMods = function (c) {
  const e = _ecoModsInd(c), pr = c.prog; if (!pr) return e; let m = e;
  for (const id in pr) { if (!IND_PROGS[id] || progLeft(c, id) <= 0) continue; m = m || {}; for (const k in IND_PROGS[id].mods) m[k] = (m[k] || 0) + IND_PROGS[id].mods[k]; }
  return m;
};
function progMonth(c) { if (!c.prog) return; let ch = false; for (const id in c.prog) { const p = c.prog[id]; if (G.date.t === p.t0 + PROG_DAYS || (G.date.t > p.t0 + PROG_DAYS && !p.done)) { if (!p.done) { p.done = 1; ch = true; if (c.tag === G.player) notify('event', `${IND_PROGS[id].ic} Termina el programa «${IND_PROGS[id].n}».`); } } } if (ch) recalcMods(c); }
const _histMonthInd = histMonth;
histMonth = function () { _histMonthInd(); try { G.tags.forEach(t => { if (t !== NONE && G.C[t] && G.C[t].prog) progMonth(G.C[t]); }); } catch (e) { console.warn('prog', e); } };

/* ---------- análisis de edificios ---------- */
const bldVA = b => { if (!b.out) return null; let inp = 0; for (const g in b.inputs) inp += b.inputs[g] * G.price[g]; const base = VA_PER_WORKER * b.workersPerLevel; return base > 0 ? (b.outAmt * G.price[b.out] - inp) / base : 1; };
const bldMoney = (c, b) => Math.round(projectCost(b) * moneyPerPoint(c));
const IND_CATS = {fab: ['Fábricas', g => g === 'Industria'], mil: ['Industria militar', g => g === 'Industria militar'], ext: ['Campo y minas', g => g === 'Agricultura' || g === 'Plantaciones' || g === 'Extracción'], inf: ['Infraestructura', g => g === 'Infraestructura'], all: ['Todo', () => true]};
function indCandidates(c, cat) {
  const out = [], ok = IND_CATS[cat || 'fab'][1];
  c.states.forEach(sid => {
    const s = G.S[sid]; if ((s.occ || 0) > 0.05) return;
    BUILDINGS.forEach(b => {
      if (b.gov || !ok(b.grp) || !canBuild(s, b, c) || buildRoom(s, b.id) < 1) return;
      const va = bldVA(b), un = clamp((s.unemp || 0) / Math.max(1, popTotal(s)), 0, 1), score = Math.min(va === null ? 1 : va, 3) * (1 + Math.min(1, un * 3)) * (b.out ? 1 : 0.9);
      out.push({sid, b, va, un, score});
    });
  });
  out.sort((x, y) => y.score - x.score); const per = {}, res = [];
  out.forEach(o => { per[o.b.id] = (per[o.b.id] || 0) + 1; if (per[o.b.id] <= 2 && res.length < 12) res.push(o); });
  return res;
}
const vaTxt = va => va === null ? '—' : `<b style="color:${va >= 1.15 ? '#8fd48f' : va >= 0.95 ? '#e8e2d0' : '#d98c8c'}">×${va.toFixed(2).replace('.', ',')}</b>`;
const unTxt = un => `<small>${Math.round((un || 0) * 100)} % paro</small>`;
function indQueueHtml(c) {
  const q = c.queue, pts = c.stats.constr || 0, weeks = q.reduce((n, it) => n + (it.cost - it.done), 0) / Math.max(1, pts);
  if (!q.length) return '<p class="hint">No hay obras públicas en marcha.</p>';
  return `<p class="hint">${f1(pts)} puntos por semana · cola despejada en unas ${Math.ceil(weeks)} semanas.</p><table class="tbl"><tbody>${q.map((it, i) => `<tr><td><span class="gi">${BLD[it.bld].icon}</span> ${BLD[it.bld].name}</td><td>${G.S[it.state].name}</td><td style="width:30%">${bar(it.done, it.cost, 'gold', Math.floor(it.done / it.cost * 100) + ' %')}</td><td style="white-space:nowrap">${i ? `<button data-act="indfront" data-i="${i}" data-tip="Pasa esta obra al principio de la cola">⏫</button>` : ''}<button data-act="indcancel" data-i="${i}" data-tip="Cancelar la obra">✕</button></td></tr>`).join('')}</tbody></table>`;
}
function indBuildTab(c) {
  const cat = UI.indCat || 'fab', rec = indCandidates(c, cat), sid = (UI.indS !== undefined && G.S[UI.indS] && G.S[UI.indS].owner === c.tag) ? UI.indS : (c.capital >= 0 ? c.capital : c.states[0]), s = G.S[sid];
  const chips = Object.keys(IND_CATS).map(k => `<button data-act="indcat" data-k="${k}" class="${cat === k ? 'on' : ''}">${IND_CATS[k][0]}</button>`).join('');
  const recHtml = rec.length ? `<table class="tbl"><thead><tr><th>Edificio</th><th>Estado</th><th>Rentab.</th><th>Mano de obra</th><th>Coste</th><th></th></tr></thead><tbody>${rec.map(o => `<tr><td><span class="gi">${o.b.icon}</span> ${o.b.name}</td><td>${G.S[o.sid].name}</td><td>${vaTxt(o.va)}</td><td>${unTxt(o.un)}</td><td>${money(bldMoney(c, o.b))}</td><td><button data-act="indbuild" data-id="${o.sid}" data-b="${o.b.id}">🏗️ Construir</button></td></tr>`).join('')}</tbody></table>` : '<p class="hint">No hay huecos libres de esa categoría en tus estados (o falta tecnología).</p>';
  const states = c.states.slice().sort((a, b) => popTotal(G.S[b]) - popTotal(G.S[a])).slice(0, 60);
  const rows = BUILDINGS.filter(b => !b.gov && IND_CATS[cat][1](b.grp) && canBuild(s, b, c) && ((s.cap[b.id] || 0) > 0)).map(b => { const room = buildRoom(s, b.id), have = s.b[b.id] || 0;
    return `<tr><td><span class="gi">${b.icon}</span> ${b.name}</td><td>${have} / ${s.cap[b.id] || 0}</td><td>${vaTxt(bldVA(b))}</td><td>${money(bldMoney(c, b))}</td><td>${room > 0 ? `<button data-act="indbuild" data-id="${sid}" data-b="${b.id}">🏗️ Construir</button>` : '<small class="dim">sin hueco</small>'}</td></tr>`; }).join('');
  return `<div class="card"><h3>Dónde conviene construir ahora</h3><div class="btnrow">${chips}</div><p class="hint">Ordenado por rentabilidad a los precios de hoy y por mano de obra disponible (paro). Cada obra consume puntos de construcción semanales y dinero del tesoro.</p>${recHtml}</div>
  <div class="card"><h3>Constructor por estado</h3><div class="btnrow"><select data-act="indstate" style="max-width:100%">${states.map(id => `<option value="${id}" ${id === sid ? 'selected' : ''}>${G.S[id].name} (${fmtN(popTotal(G.S[id]), 0)} hab.)</option>`).join('')}</select></div>
    ${rows ? `<table class="tbl"><thead><tr><th>Edificio</th><th>Niveles</th><th>Rentab.</th><th>Coste</th><th></th></tr></thead><tbody>${rows}</tbody></table>` : '<p class="hint">Ese estado no admite edificios de esta categoría.</p>'}</div>
  <div class="card"><h3>Cola de obras</h3>${indQueueHtml(c)}</div>`;
}
function indBoostTab(c) {
  return `<div class="card"><h3>Programas de impulso económico</h3><p class="hint">Se pagan con el tesoro y algo de influencia. Duran 12 meses; después hay un enfriamiento de otros 12 antes de repetirlos. Los efectos se suman a tus leyes y tecnologías.</p>
  ${Object.keys(IND_PROGS).map(id => { const P = IND_PROGS[id], left = progLeft(c, id), ready = progReady(c, id), cost = progCost(c, id);
    return `<div class="card" style="margin:6px 0"><div class="kv"><span><b>${P.ic} ${P.n}</b></span><b>${left > 0 ? `activo · ${Math.ceil(left / 30)} meses` : ready ? money(cost) + ' · ' + P.inf + ' infl.' : 'enfriamiento ' + Math.ceil((c.prog[id].t0 + PROG_COOL - G.date.t) / 30) + ' m.'}</b></div><p class="hint">${P.d}</p>${ready ? `<button data-act="indprog" data-id="${id}" ${c.treasury < cost || (c.influence || 0) < P.inf ? 'class="dis"' : ''}>Lanzar programa</button>` : ''}</div>`; }).join('')}</div>
  <div class="card"><h3>Otras palancas</h3><p class="hint">En <b>Finanzas → política económica</b> fijas comercio, salario mínimo, industria estatal, subsidios y racionamiento. Los grupos de interés y las leyes (Política) también cambian la inversión y la producción.</p></div>`;
}
function indSumTab(c) {
  const byB = {}; let lv = 0; c.states.forEach(id => { const s = G.S[id]; for (const b in s.b) { byB[b] = (byB[b] || 0) + s.b[b]; } });
  const ind = BUILDINGS.filter(b => !b.gov && (byB[b.id] || 0) > 0).sort((a, b) => (byB[b.id] || 0) - (byB[a.id] || 0));
  ind.forEach(b => { if (b.grp === 'Industria' || b.grp === 'Industria militar') lv += byB[b.id]; });
  const un = clamp(c.states.reduce((n, id) => n + (G.S[id].unemp || 0), 0) / Math.max(1, c.stats.pop), 0, 1);
  const scarce = GOODS.filter(g => G.price[g.id] / g.base > 1.25).sort((a, b) => G.price[b.id] / b.base - G.price[a.id] / a.base).slice(0, 8);
  return `<div class="card"><div class="kv"><span>Niveles de fábricas (industria)</span><b>${lv}</b></div><div class="kv"><span>PIB</span><b>${money(c.stats.gdp)}</b></div><div class="kv"><span>Paro medio</span><b>${Math.round(un * 100)} %</b></div><div class="kv"><span>Puntos de construcción / semana</span><b>${f1(c.stats.constr || 0)}</b></div></div>
  <div class="card"><h3>Edificios por tipo</h3><table class="tbl"><tbody>${ind.map(b => `<tr><td><span class="gi">${b.icon}</span> ${b.name}</td><td style="text-align:right"><b>${byB[b.id]}</b></td></tr>`).join('')}</tbody></table></div>
  <div class="card"><h3>Cuellos de botella (bienes caros en el mercado)</h3>${scarce.length ? `<table class="tbl"><tbody>${scarce.map(g => `<tr><td>${g.icon || ''} ${g.name}</td><td style="text-align:right"><b>×${(G.price[g.id] / g.base).toFixed(2).replace('.', ',')}</b></td></tr>`).join('')}</tbody></table><p class="hint">Un bien caro indica escasez: construir edificios que lo produzcan suele ser rentable.</p>` : '<p class="hint">Sin escaseces graves ahora mismo.</p>'}</div>`;
}
WINDOWS.industry = {title: 'Industria', icon: '🏭', render() {
  const c = me(), tab = UI.indTab || 'build';
  const tabs = [['build', '🏗️ Construir'], ['boost', '🚀 Impulso'], ['sum', '📊 Resumen']].map(([k, l]) => `<button data-act="indtab" data-t="${k}" class="${tab === k ? 'on' : ''}">${l}</button>`).join('');
  return `<div class="btnrow" style="margin-bottom:8px">${tabs}</div>${tab === 'boost' ? indBoostTab(c) : tab === 'sum' ? indSumTab(c) : indBuildTab(c)}`;
}};
MENU_ITEMS.push(['industry', '🏭', 'Industria', 'Industria', 'Construye fábricas, impulsa la economía y analiza la producción.']);
Object.assign(WIN_HELP, {industry: 'Construye fábricas, impulsa la economía y analiza la producción.'});
Object.assign(ACT, {
  indtab: d => { UI.indTab = d.t; renderWindow(true); },
  indcat: d => { UI.indCat = d.k; renderWindow(true); },
  indstate: (d, el) => { UI.indS = +el.value; renderWindow(true); },
  indbuild: d => { const c = me(), s = G.S[+d.id], b = BLD[d.b]; if (queueBuild(c, +d.id, d.b)) toast('🏗️', `${b.name} en ${s.name}: añadido a la cola (${money(bldMoney(c, b))}).`); else toast('⚠️', 'No se puede construir ahí (sin hueco o sin tecnología).'); renderWindow(true); },
  indfront: d => { const c = me(), i = +d.i; if (c.queue[i]) { const [it] = c.queue.splice(i, 1); c.queue.unshift(it); } renderWindow(true); },
  indcancel: d => { const c = me(), i = +d.i; if (c.queue[i]) { const it = c.queue[i]; if (!it.done || confirm('La obra ya tiene progreso: se perderá. ¿Cancelar?')) c.queue.splice(i, 1); } renderWindow(true); },
  indprog: d => { const r = progBuy(me(), d.id); toast(r.ok ? '🚀' : '⚠️', r.msg); renderWindow(true); }
});
document.addEventListener('keydown', e => { if (e.key === '0' && !e.ctrlKey && !e.metaKey && !e.altKey && UI.started && !/input|select|textarea/i.test((e.target && e.target.tagName) || '')) { e.preventDefault(); openWindow('industry'); } });
