/* ===== ECONOMÍA 2: palancas de política económica =====
   Cada país tiene c.eco con estas decisiones (se editan en Presupuesto → «Política económica»; cambiarlas cuesta influencia y no puede repetirse hasta pasados 6 meses):
   · POLÍTICA COMERCIAL: libre comercio · moderada · proteccionista · autarquía.     · SALARIO MÍNIMO: ninguno · bajo · alto (más peso del trabajo en el valor añadido).
   · INDUSTRIA ESTATAL: el Estado se queda con una parte de los beneficios industriales (menos inversión privada).
   · SUBSIDIO ALIMENTARIO: los alimentos y la ropa básica cuestan menos a la población y paga el Estado.
   · RACIONAMIENTO: menos consumo civil, más estabilidad de guerra y menos coste militar.     · PRIORIDAD DE INVERSIÓN: sector favorito de las nuevas construcciones.
   · PLANIFICACIÓN (con Economía Planificada): industria pesada, bienes de consumo, agricultura o armamento.     · BONOS: financiación inmediata a devolver con interés en un año.
   Los efectos pasan a c.mods (ecoMods), a la economía (sim.js: subsidios, industria estatal, racionamiento y prioridad) y a la satisfacción de los grupos de interés. */
const EC_SUB = [0, 0.2, 0.4, 0.6], EC_STATE = [0, 0.2, 0.4, 0.6], EC_STAPLE = {grain: 1, meat: 1, fish: 1, fruit: 1, fabric: 1, clothes: 1, coal: 1};
const EC_TRADE = [
  {name: 'Libre comercio', icon: '🕊️', mods: {invest: .06, tax: -.04, innov: .03, indOut: -.015}, ig: {indus: 1.2, lands: -0.6, union: -0.4}, desc: 'Sin aranceles: más inversión e innovación, menos recaudación y presión sobre la industria local.'},
  {name: 'Comercio moderado', icon: '⚖️', mods: {}, ig: {}, desc: 'Aranceles bajos y tratados.'},
  {name: 'Proteccionismo', icon: '🛡️', mods: {tax: .05, indOut: .03, invest: -.03, innov: -.01}, ig: {indus: 0.4, lands: 0.4, union: 0.3}, desc: 'Aranceles altos: protegen la industria y llenan el tesoro, a costa de inversión y relaciones.'},
  {name: 'Autarquía', icon: '🔒', mods: {tax: .08, indOut: .05, invest: -.08, innov: -.04, grow: -.0003}, ig: {indus: -0.5, intel: -0.6, armed: 0.4}, desc: 'Autosuficiencia nacional: fuerte industria y control, con atraso e ineficiencia.'}
];
const EC_WAGE = [
  {name: 'Ninguno', mods: {}, ig: {}, desc: 'El mercado fija los salarios.'},
  {name: 'Salario mínimo bajo', mods: {lab: .04, rad: -.06, out: -.005}, ig: {union: 0.5, indus: -0.3}, desc: 'Un suelo salarial modesto.'},
  {name: 'Salario mínimo alto', mods: {lab: .09, rad: -.14, out: -.015, invest: -.03}, ig: {union: 1, indus: -0.9, petty: -0.2}, desc: 'Más sueldo para los obreros, menos beneficio e inversión.'}
];
const EC_PLAN = {
  heavy: {name: 'Industria pesada', icon: '🏭', mods: {indOut: .07, steelOut: .06, out: -.02}},
  consumer: {name: 'Bienes de consumo', icon: '🧵', mods: {lab: .03, rad: -.08, indOut: .02}},
  agri: {name: 'Agricultura', icon: '🌾', mods: {agriOut: .08, mineOut: -.02}},
  military: {name: 'Armamento', icon: '🔫', mods: {army: .05, milCost: -.06, indOut: .03, rad: .05}}
};
const EC_PRIO = ['', 'Agricultura', 'Industria', 'Extracción', 'Infraestructura'];
const ecoOf = c => c.eco || (c.eco = {trade: 1, wage: 0, state: 0, sub: 0, ration: 0, prio: '', plan: '', last: {}});
const planned = c => c.laws && (c.laws.economy === 'planned' || c.ideo === 'communist');
function ecoMods(c) {
  const e = c.eco; if (!e) return null; const m = {}, add = o => { for (const k in o) m[k] = (m[k] || 0) + o[k]; };
  add(EC_TRADE[e.trade || 0].mods); add(EC_WAGE[e.wage || 0].mods);
  if (e.state) add({invest: -0.035 * e.state, tax: 0.01 * e.state});
  if (e.ration) add({stab: e.ration, defense: 0.02 * e.ration, milCost: -0.03 * e.ration, lit: -0.01 * e.ration, rad: 0.03 * e.ration});
  if (e.plan && planned(c) && EC_PLAN[e.plan]) add(EC_PLAN[e.plan].mods);
  if (planned(c)) add({invest: -0.02});
  return m;
}
function ecoPrio(c, b) {
  const p = c.eco && c.eco.prio; if (!p) return 1;
  if (p === 'Infraestructura') return b.grp === 'Infraestructura' || b.id === 'railway' || b.id === 'port' ? 1.8 : 0.9;
  return b.grp === p ? 1.7 : 0.9;
}
function ecoCan(c, key, v) {
  const e = ecoOf(c);
  if (!c.ai && (e.last[key] || -999) + 180 > G.date.t) return {ok: false, msg: `Debes esperar ${Math.ceil(((e.last[key] || 0) + 180 - G.date.t) / 30)} meses para cambiar de nuevo esta política.`};
  if (key === 'plan' && v && !planned(c)) return {ok: false, msg: 'La planificación exige Economía Planificada o un régimen comunista.'};
  if (key === 'ration' && v && !c.wars.length && v > 1) return {ok: false, msg: 'El racionamiento intenso solo se justifica en guerra.'};
  if (e[key] === v) return {ok: false, msg: ''};
  const cost = key === 'ration' ? 8 : 15; if (!c.ai && c.influence < cost) return {ok: false, msg: `Necesitas ${cost} de influencia.`};
  return {ok: true, cost};
}
function ecoSet(c, key, v) {
  const e = ecoOf(c), r = ecoCan(c, key, v); if (!r.ok) return r;
  if (!c.ai) c.influence -= r.cost; e[key] = v; e.last[key] = G.date.t; recalcMods(c);
  if (!c.ai) { const ig = key === 'trade' ? EC_TRADE[v].ig : key === 'wage' ? EC_WAGE[v].ig : {}; for (const k in ig) if (c.ig[k]) c.ig[k].approval += ig[k]; }
  return {ok: true, msg: 'Política económica actualizada.'};
}
/* ---------- efectos mensuales ---------- */
function ecoMonth(c) {
  const e = c.eco; if (!e || !c.states.length) return;
  if (e.state) { if (c.ig.indus) c.ig.indus.approval -= 0.05 * e.state; if (c.ig.union) c.ig.union.approval += 0.03 * e.state; }
  if (e.sub) { if (c.ig.rural) c.ig.rural.approval += 0.04 * e.sub; if (c.ig.union) c.ig.union.approval += 0.03 * e.sub; c.radicals = Math.max(0, c.radicals - 0.0008 * e.sub); }
  if (e.ration) { c.legitimacy -= 0.15 * (c.wars.length ? e.ration * 0.4 : e.ration * 1.6); c.radicals = Math.min(0.9, c.radicals + 0.0006 * e.ration * (c.wars.length ? 0.5 : 1.5)); }
  if (e.wage === 2 && c.ig.indus) c.ig.indus.approval -= 0.04;
  if (e.trade === 3 && c.ig.intel) c.ig.intel.approval -= 0.04;
  if (e.plan && !planned(c)) e.plan = '';
  // bonos
  if (e.bonds && e.bonds.length) { let pay = 0; e.bonds = e.bonds.filter(b => { pay += b.pay; return --b.left > 0; }); c.treasury -= pay; c.budget && c.budget.expense && (c.budget.expense.bonds = pay); if (!e.bonds.length) c.bondDebt = 0; else c.bondDebt = e.bonds.reduce((n, b) => n + b.pay * b.left, 0); }
  // la IA ajusta su política según su perfil y su situación
  if (c.ai && c.tag !== G.player && G.date.m === (c.id % 12)) ecoAI(c);
}
function ecoAI(c) {
  const e = ecoOf(c), want = {};
  want.trade = c.profile === 'liberal' || c.profile === 'republic' ? (c.rank <= 6 ? 0 : 1) : c.profile === 'eastern' || c.profile === 'serf' ? 2 : 1;
  if (c.treasury < 0 && c.wars.length) want.ration = 1; else if (!c.wars.length) want.ration = 0;
  want.state = planned(c) ? 2 : c.ideo === 'fascist' ? 1 : 0;
  want.sub = c.radicals > 0.25 && c.treasury > 0 ? 1 : (c.radicals < 0.1 ? 0 : e.sub);
  want.wage = c.laws.labor === 'regulated' ? 1 : 0;
  if (planned(c)) want.plan = c.wars.length ? 'military' : 'heavy';
  if (G.date.y >= 1900 && c.rank <= 8 && c.laws.economy === 'laissez') want.trade = 0;
  for (const k in want) { if (e[k] !== want[k]) { e[k] = want[k]; e.last[k] = G.date.t; } }
  recalcMods(c);
}
const _politics2MonthE2 = politics2Month;
politics2Month = function (c) { _politics2MonthE2(c); try { ecoMonth(c); } catch (err) { console.warn('ecoMonth', err); } };
function ecoBonds(c, weeks) {
  const e = ecoOf(c), inc = Math.max(0, c.stats.income), cur = (e.bonds || []).reduce((n, b) => n + b.amt, 0);
  if (cur + inc * weeks > inc * 10) return {ok: false, msg: 'Ya tienes demasiados bonos en circulación (máx. 10 semanas de ingresos).'};
  const amt = inc * weeks; e.bonds = e.bonds || []; c.treasury += amt; e.bonds.push({amt, pay: amt * 1.18 / 12, left: 12});
  c.prestige = Math.max(0, c.prestige - 1); return {ok: true, msg: `Emites bonos por ${money(amt)}: se devolverán con un 18% de interés en 12 meses.`};
}
/* ---------- interfaz ---------- */
function ecoCardHtml(c) {
  const e = ecoOf(c), seg = (key, names, cur, extra) => `<span class="seg sm">${names.map((n, i) => `<button class="${cur === i ? 'on' : ''}" data-act="eco" data-k="${key}" data-v="${i}" ${extra && extra[i] ? `data-tip="${escA(extra[i])}"` : ''}>${n}</button>`).join('')}</span>`;
  const bonds = (e.bonds || []).reduce((n, b) => n + b.pay * b.left, 0), dis = !planned(c);
  return `<div class="card"><h3>🎚️ Política económica</h3><p class="hint">Cada cambio cuesta influencia y no puede repetirse hasta pasados 6 meses.</p>
  <div class="kv"><span>🚢 Comercio</span>${seg('trade', EC_TRADE.map(t => t.icon + ' ' + t.name), e.trade, EC_TRADE.map(t => t.desc))}</div>
  <div class="kv"><span>💶 Salario mínimo</span>${seg('wage', EC_WAGE.map(t => t.name), e.wage, EC_WAGE.map(t => t.desc))}</div>
  <div class="kv"><span>🏭 Industria estatal</span>${seg('state', ['0%', '20%', '40%', '60%'], e.state, ['Todo en manos privadas', 'El Estado se queda el 20% de los beneficios industriales', '40% de los beneficios', '60% de los beneficios: casi un monopolio estatal'])}</div>
  <div class="kv"><span>🍞 Subsidio alimentario</span>${seg('sub', ['0%', '20%', '40%', '60%'], e.sub, ['Sin subsidio', 'La población paga un 20% menos por alimentos y ropa básica: lo cubre el Estado', '40% menos', '60% menos (muy caro)'])}</div>
  <div class="kv"><span>🥫 Racionamiento</span>${seg('ration', ['Ninguno', 'Leve', 'Intenso'], e.ration, ['Consumo libre', '−8% de consumo civil: +1 estabilidad, defensa y menor coste militar', '−16% de consumo civil: +2 estabilidad (solo en guerra)'])}</div>
  <div class="kv"><span>🏗️ Prioridad de inversión</span><span><select data-act="ecoprio">${EC_PRIO.map(p => `<option value="${p}" ${e.prio === p ? 'selected' : ''}>${p || 'Sin prioridad'}</option>`).join('')}</select></span></div>
  <div class="kv"><span>📋 Planificación</span>${seg('plan', ['Ninguna'].concat(Object.keys(EC_PLAN).map(k => EC_PLAN[k].icon + ' ' + EC_PLAN[k].name)), e.plan ? Object.keys(EC_PLAN).indexOf(e.plan) + 1 : 0, dis ? ['Requiere Economía Planificada o régimen comunista'] : null)}</div>
  <div class="kv"><span>📜 Bonos del Estado</span><span><button data-act="ecobond" data-w="2">+2 sem.</button> <button data-act="ecobond" data-w="4">+4 sem.</button> <button data-act="ecobond" data-w="8">+8 sem.</button></span></div>
  ${bonds > 0 ? `<div class="kv sm"><span>Por devolver</span><b>${money(bonds)}</b></div>` : ''}</div>`;
}
const _budgetRenderE2 = WINDOWS.budget.render;
WINDOWS.budget.render = function () { const h = _budgetRenderE2.call(this); return h + ecoCardHtml(me()); };
Object.assign(ACT, {
  eco: d => { const c = me(), k = d.k; let v = +d.v; if (k === 'plan') v = v === 0 ? '' : Object.keys(EC_PLAN)[v - 1]; const r = ecoSet(c, k, v); if (r.msg) toast(r.ok ? '🎚️' : '⚠️', r.msg); renderWindow(true); },
  ecoprio: (d, el) => { const c = me(), r = ecoSet(c, 'prio', el ? el.value : ''); if (r.msg) toast(r.ok ? '🏗️' : '⚠️', r.msg); renderWindow(true); },
  ecobond: d => { const r = ecoBonds(me(), +d.w); toast(r.ok ? '📜' : '⚠️', r.msg); renderWindow(true); }
});
