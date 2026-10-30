/* ===== ECONOMÍA MILITAR: cada división necesita soldados, fusiles, cañones, caballos y pólvora que fabrica la industria ===== */
const DIV_NEEDS = {
  inf: {rifles: 12000, gunpowder: 800},
  cav: {rifles: 5000, horses: 9000, gunpowder: 600},
  art: {cannons: 1500, rifles: 3500, horses: 3000, gunpowder: 4000}
};
const EQ_GOODS = ['rifles', 'cannons', 'horses', 'gunpowder', 'mgs'];
const EQ_POLICY = [
  {name: 'Normal', mult: 1.12, budget: 0.16, desc: 'Mantienes el equipo de tus divisiones con un pequeño margen.'},
  {name: 'Ampliada', mult: 1.4, budget: 0.3, desc: 'Compras más equipo para poder reclutar nuevas divisiones.'},
  {name: 'Economía de guerra', mult: 1.8, budget: 0.5, desc: 'Máxima compra de armas y pólvora, a costa del presupuesto.'}
];
// necesidades de equipo de todos los países (una sola pasada)
let _eqNeed = null, _eqNeedKey = '';
// necesidades de equipo de todos los países; se guardan en caché durante el día (se recalcula si cambian los ejércitos o las divisiones en instrucción)
function eqNeedAll() {
  const key = G.date.t + '|' + G.armies.length + '|' + G.recruits.length + '|' + (G.recruits.length ? G.recruits[G.recruits.length - 1].days : 0);
  if (_eqNeed && key === _eqNeedKey) return _eqNeed;
  const out = {};
  const add = (tag, type) => { const o = out[tag] = out[tag] || {rifles: 0, cannons: 0, horses: 0, gunpowder: 0, mgs: 0}; const n = DIV_NEEDS[type]; for (const g in n) o[g] = (o[g] || 0) + n[g]; };
  G.armies.forEach(a => a.divs.forEach(d => { if (!d.lv) add(a.tag, d.t); }));
  G.recruits.forEach(r => { if (!r.lv) add(r.tag, r.type); });
  _eqNeed = out; _eqNeedKey = key; return out;
}
function eqNeedOf(tag) { return eqNeedAll()[tag] || {rifles: 0, cannons: 0, horses: 0, gunpowder: 0, mgs: 0}; }
function initEquipment() {
  const need = eqNeedAll();
  G.tags.forEach(t => { if (t === NONE) return; const c = G.C[t], n = need[t] || {}; c.eq = {}; EQ_GOODS.forEach(g => c.eq[g] = (n[g] || 0) * 1.25); c.eqFill = {}; EQ_GOODS.forEach(g => c.eqFill[g] = 1); c.eqPolicy = 0; c.eqSpent = 0; });
  G.milD = Object.assign({}, MIL_NEED); G.shortage = {};
}
const EQ_NAME = {rifles: 'fusiles', cannons: 'cañones', horses: 'caballos', gunpowder: 'pólvora', mgs: 'ametralladoras', aircraft: 'aviones', ships: 'tonelaje'};
// ¿hay equipo de reserva para una división más?
function eqCheck(c, type) {
  if (!c.eq) return null;
  const need = eqNeedOf(c.tag), n = DIV_NEEDS[type], miss = [];
  for (const g in n) { const spare = (c.eq[g] || 0) - (need[g] || 0); if (spare < n[g] * 0.8) miss.push(`${EQ_NAME[g]} (${fmtN(Math.max(0, spare), 0)} de ${fmtN(n[g], 0)})`); }
  return miss.length ? 'Falta equipo para otra división: ' + miss.join(', ') + '. Fabrícalo o compra más.' : null;
}
function takeEquipForDiv(c, type) { return null; }
/* compra de emergencia en el mercado exterior (recargo del 30%) */
const EQ_RUSH = 1.3;
function eqMissing(c, type) { const need = eqNeedOf(c.tag), n = DIV_NEEDS[type], m = {}; for (const g in n) { const miss = Math.max(0, need[g] + n[g] * 0.8 - ((c.eq || {})[g] || 0)); if (miss > 0) m[g] = miss; } return m; }
function eqMissingCost(m) { let t = 0; for (const g in m) t += m[g] * G.price[g] * EQ_RUSH; return Math.round(t); }
function buyEquipFor(c, type) {
  const m = eqMissing(c, type), cost = eqMissingCost(m); if (!cost) return {ok: false, msg: 'Ya tienes equipo de sobra para otra división.'};
  if (c.treasury < cost) return {ok: false, msg: `Comprar el equipo cuesta ${money(cost)} y no tienes fondos.`};
  c.treasury -= cost; for (const g in m) { c.eq[g] = (c.eq[g] || 0) + m[g]; G.milD[g] = (G.milD[g] || 0) + m[g]; }
  return {ok: true, msg: `Equipo comprado para una división de ${DIVS[type].name.toLowerCase()} (${money(cost)}).`};
}
function buyGood(c, g) {
  const need = eqNeedOf(c.tag), lot = Math.max(1000, Math.round((need[g] || 0) * 0.2 / 100) * 100), cost = Math.round(lot * G.price[g] * EQ_RUSH);
  if (c.treasury < cost) return {ok: false, msg: `Un lote de ${EQ_NAME[g]} cuesta ${money(cost)} y no tienes fondos.`};
  c.treasury -= cost; c.eq[g] = (c.eq[g] || 0) + lot; G.milD[g] = (G.milD[g] || 0) + lot;
  return {ok: true, msg: `Compras ${fmtN(lot, 0)} de ${EQ_NAME[g]} por ${money(cost)}.`};
}
function equipMod(tag, type) {
  const c = G.C[tag]; if (!c || !c.eqFill) return 1;
  let f = 1; for (const g in DIV_NEEDS[type]) f = Math.min(f, c.eqFill[g] === undefined ? 1 : c.eqFill[g]);
  return 0.55 + 0.45 * Math.min(1, f);
}
// reposición de fuerza: consume equipo
function takeReplacements(tag, type, frac) {
  const c = G.C[tag]; if (!c || !c.eq) return true;
  const n = DIV_NEEDS[type], amt = {};
  for (const g in n) { amt[g] = n[g] * frac * 0.4; if ((c.eq[g] || 0) < amt[g]) return false; }
  for (const g in amt) c.eq[g] -= amt[g];
  return true;
}
function useAmmo(a) { const c = G.C[a.tag]; if (c && c.eq) c.eq.gunpowder = Math.max(0, c.eq.gunpowder - Math.min(a.divs.length, BATTLE_WIDTH) * 40); }
function eqLoss(tag, men) { const c = G.C[tag]; if (!c || !c.eq) return; c.eq.rifles = Math.max(0, c.eq.rifles - men * 1.2); c.eq.horses = Math.max(0, c.eq.horses - men * 0.3); c.eq.cannons = Math.max(0, c.eq.cannons - men * 0.03); }

function milEconWeek() {
  if (!G.milD) initEquipment();
  const need = eqNeedAll();
  G.milD = {}; EQ_GOODS.forEach(g => G.milD[g] = 0);
  G.shortage = G.shortage || {};
  EQ_GOODS.concat(['iron', 'coal', 'wood', 'saltpeter', 'steel']).forEach(g => { const r = clamp(G.ratio[g] === undefined ? 1 : G.ratio[g], 0, 1); G.shortage[g] = G.shortage[g] === undefined ? 1 : G.shortage[g] * 0.88 + 0.12 * r; });
  G.tags.forEach(t => {
    if (t === NONE) return; const c = G.C[t]; if (!c.states.length) return;
    c.eq = c.eq || {}; const n = need[t] || {};
    if (c.ai) c.eqPolicy = c.wars.length ? (c.wars.length > 1 || (c.wear || 0) > 40 ? 2 : 1) : (c.mob > 1 ? 1 : 0);
    const pol = EQ_POLICY[c.eqPolicy || 0];
    EQ_GOODS.forEach(g => { c.eq[g] = (c.eq[g] || 0) * 0.99; });
    const wants = {}; let totalCost = 0;
    EQ_GOODS.forEach(g => { const T = (n[g] || 0) * pol.mult, gap = Math.max(0, T - c.eq[g]); wants[g] = Math.min(gap, (n[g] || 0) * 0.07 + 400); totalCost += wants[g] * G.price[g]; });
    const maxSpend = Math.max(0, c.stats.income) * pol.budget + (c.wars.length ? 0 : 0);
    const k = totalCost > maxSpend && totalCost > 0 ? maxSpend / totalCost : 1;
    let spent = 0;
    EQ_GOODS.forEach(g => { const w = wants[g] * k; G.milD[g] += w; const buy = w * clamp(G.ratio[g] === undefined ? 1 : G.ratio[g], 0, 1); if (typeof eqAdd === 'function') eqAdd(c, g, buy, Math.max(0, eqBestGen(c, g) - 1)); else c.eq[g] += buy; spent += buy * G.price[g]; });
    c.eqSpent = spent;
    c.eqFill = {}; EQ_GOODS.forEach(g => c.eqFill[g] = n[g] > 0 ? clamp(c.eq[g] / n[g], 0, 1.5) : 1);
    const low = Math.min(c.eqFill.rifles, c.eqFill.gunpowder);
    c.eqLow = c.wars.length && low < 0.6 ? (c.eqLow || 0) + 1 : Math.max(0, (c.eqLow || 0) - 1);
  });
}

/* ---------- crisis por escasez de materias primas y de armamento ---------- */
const SHORT_FX = {iron: {ind: 0.95, mine: 0.98}, coal: {ind: 0.95}, wood: {ind: 0.97}, steel: {ind: 0.96}, saltpeter: {ind: 0.985}, gunpowder: {ind: 0.985}, rifles: {ind: 0.99}, cannons: {ind: 0.99}, horses: {agri: 0.97}};
Object.keys(SHORT_FX).forEach(g => { CRISIS_TYPES['short_' + g] = {name: 'Escasez de ' + GOOD[g].name.toLowerCase(), icon: GOOD[g].icon, scope: 'global', months: [6, 12], fx: SHORT_FX[g], shock: {[g]: 1.35}, w: 0, hidden: true, desc: `La oferta mundial de ${GOOD[g].name.toLowerCase()} no cubre la demanda: sube su precio y se resienten las industrias y los ejércitos que dependen de ello.`}; });
CRISIS_TYPES.arms = {name: 'Crisis de armamento', icon: '🔫', scope: 'country', months: [5, 9], fx: {ind: 0.97, demand: 0.98}, legit: -0.8, rad: 0.004, w: 0, desc: 'El ejército carece de fusiles y pólvora: las divisiones combaten mal, cunde el descontento y la industria se resiente.'};
function shortageCrisesMonth() {
  if (G.week < 20 || !G.shortage) return;
  Object.keys(SHORT_FX).forEach(g => { if ((G.shortage[g] || 1) < 0.72 && !G.crises.some(x => x.type === 'short_' + g) && Math.random() < 0.3 * diffP().crisis) addCrisis('short_' + g, 'global'); });
  G.tags.forEach(t => { if (t === NONE) return; const c = G.C[t]; if ((c.eqLow || 0) >= 8 && Math.random() < 0.3) addCrisis('arms', t); });
}
