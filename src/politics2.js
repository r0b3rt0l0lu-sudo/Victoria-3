/* ===== ELECCIONES Y MOVIMIENTOS POLÍTICOS ===== */
const LAWSEQ = {power: ['autocracy', 'oligarchy', 'landed_voting', 'wealth_voting', 'universal'], labor: ['no_regs', 'inspections', 'regulated'], press: ['censorship', 'limited_press', 'free_press'], religion: ['state_religion', 'tolerance', 'secular']};
const nextOpt = (c, cat) => { const q = LAWSEQ[cat], i = q.indexOf(c.laws[cat]); return i >= 0 && i < q.length - 1 ? q[i + 1] : null; };
const MOVES = {
  suffrage: {name: 'Movimiento sufragista', icon: '🗳️', desc: 'Exige ampliar el derecho al voto.', demand: c => { const o = nextOpt(c, 'power'); return o && {cat: 'power', opt: o}; },
    target: c => 8 + c.lit * 0.45 + c.radicals * 55 + (c.ig.intel ? c.ig.intel.share * 60 : 0)},
  labor: {name: 'Movimiento obrero', icon: '✊', desc: 'Sindicatos que reclaman regulación laboral.', demand: c => { const o = nextOpt(c, 'labor'); return o && {cat: 'labor', opt: o}; },
    target: c => 4 + Math.min(35, c.stats.indLevels * 0.8) + c.radicals * 70 + Math.max(0, 8 - c.stats.sol) * 4 + (c.ig.union ? c.ig.union.share * 40 : 0)},
  abolition: {name: 'Movimiento abolicionista', icon: '⛓️', desc: 'Exige acabar con la esclavitud.', demand: c => c.laws.bonded === 'slavery_legal' ? {cat: 'bonded', opt: 'slavery_banned'} : null,
    target: c => 12 + c.lit * 0.3 + (c.ig.intel ? c.ig.intel.share * 80 : 0)},
  press: {name: 'Movimiento liberal', icon: '📰', desc: 'Reclama libertad de prensa y de opinión.', demand: c => { const o = nextOpt(c, 'press'); return o && {cat: 'press', opt: o}; },
    target: c => c.lit * 0.65 + (c.ig.intel ? c.ig.intel.share * 55 : 0) + c.radicals * 20},
  secular: {name: 'Movimiento laicista', icon: '🕯️', desc: 'Pide separar la Iglesia del Estado.', demand: c => { const o = nextOpt(c, 'religion'); return o && {cat: 'religion', opt: o}; },
    target: c => c.lit * 0.35 + (c.ig.intel ? c.ig.intel.share * 40 : 0) - (c.ig.devout ? c.ig.devout.share * 60 : 0)},
  socialist: {name: 'Movimiento socialista', icon: '🚩', desc: 'Exige que el Estado intervenga en la economía.', demand: c => c.laws.economy !== 'interventionism' && c.stats.indLevels > 6 ? {cat: 'economy', opt: 'interventionism'} : null,
    target: c => c.radicals * 95 + Math.max(0, 7 - c.stats.sol) * 5},
  peasant: {name: 'Movimiento campesino', icon: '🌾', desc: 'Reclama el fin de la servidumbre.', demand: c => c.laws.agrarian === 'serfdom' ? {cat: 'agrarian', opt: 'tenant'} : null,
    target: c => c.radicals * 60 + Math.max(0, 6 - c.stats.sol) * 6 + (c.ig.rural ? c.ig.rural.share * 50 : 0)}
};
const MOVE_KEYS = Object.keys(MOVES);
function movementsMonth(c) {
  if (c.tag === NONE || !c.states.length || !c.ig) return;
  c.mov = c.mov || {};
  MOVE_KEYS.forEach(k => {
    const m = MOVES[k], d = m.demand(c); let s = c.mov[k] || 0;
    if (!d) s *= 0.8; else s += (clamp(m.target(c), 0, 100) - s) * 0.07 + (Math.random() - 0.5) * 3;
    s = clamp(s, 0, 100); c.mov[k] = Math.round(s * 10) / 10;
    if (!d || s < 50) return;
    c.legitimacy -= (s - 50) * 0.008; c.radicals = Math.min(0.9, c.radicals + (s - 50) * 0.00008);
    if (s > 85 && Math.random() < 0.05 * diffP().crisis && !G.crises.some(x => x.type === 'riots' && x.scope === c.tag)) { addCrisis('riots', c.tag, {name: 'Disturbios: ' + m.name.toLowerCase()}); c.legitimacy -= 2; }
    if (c.ai && s > 60 && Math.random() < 0.3) {
      if (!c.lawChange && Math.random() < 0.6) startLawChange(c, d.opt); else if (s > 75) { c.mov[k] = Math.max(0, s - 20); c.radicals = Math.min(0.9, c.radicals + 0.008); c.legitimacy -= 1.5; }
    }
  });
}
function movConcede(c, k) {
  const d = MOVES[k].demand(c); if (!d) return {ok: false, msg: 'Ya no hay nada que conceder.'};
  if (c.lawChange) return {ok: false, msg: 'Ya hay una reforma en debate.'};
  const r = startLawChange(c, d.opt); if (r.ok) c.mov[k] = Math.max(0, c.mov[k] - 12);
  return r.ok ? {ok: true, msg: `Inicias la reforma «${LAW[d.opt].name}» para apaciguar al movimiento.`} : r;
}
function movSuppress(c, k) {
  if (c.influence < 20) return {ok: false, msg: 'Necesitas 20 de influencia.'};
  c.influence -= 20; c.mov[k] = Math.max(0, c.mov[k] - 25); c.radicals = Math.min(0.9, c.radicals + 0.01); c.legitimacy -= 2;
  return {ok: true, msg: `${MOVES[k].name} reprimido: pierde fuerza, pero crece el malestar.`};
}
function movCoopt(c, k) {
  const cost = c.stats.income * 8; if (c.treasury < cost) return {ok: false, msg: 'Fondos insuficientes.'};
  c.treasury -= cost; c.mov[k] = Math.max(0, c.mov[k] - 15);
  return {ok: true, msg: `Sobornas y cooptas a los líderes del ${MOVES[k].name.toLowerCase()}.`};
}

/* ---------- elecciones ---------- */
const hasVote = c => ['landed_voting', 'wealth_voting', 'universal'].includes(c.laws.power);
function electionMonth(c) {
  if (!c.ig || !c.ig[IG_ORDER[0]]) return;
  if (!hasVote(c)) { c.el = null; return; }
  if (!c.el) c.el = {next: G.date.y + 1 + (c.id % 4), last: null, camp: null, campOn: false};
  const e = c.el, y = G.date.y, m = G.date.m;
  if (!e.campOn && ((y === e.next - 1 && m === 11) || (y === e.next && m < 3 && !e.campOn))) {
    e.campOn = true; e.camp = null;
    if (c.ai) { if (Math.random() < 0.4) e.camp = pick(IG_ORDER.filter(k => c.ig[k].share > 0.1)); }
    else notify('politics', 'Comienza la campaña electoral. Tienes tres meses para apoyar a un partido.');
  }
  if (y === e.next && m === 2) holdElection(c);
}
function holdElection(c) {
  const e = c.el, res = IG_ORDER.map(k => { const g = c.ig[k]; return {k, v: Math.max(0.001, g.share * (1 + g.approval / 25) * (0.82 + Math.random() * 0.36) * (e.camp === k ? 1.3 : 1))}; });
  let tot = 0; res.forEach(r => tot += r.v); res.forEach(r => r.pct = r.v / tot); res.sort((a, b) => b.pct - a.pct);
  const coal = []; let acc = 0; res.forEach((r, i) => { if (acc < 0.5 || i === 0) { coal.push(r.k); acc += r.pct; } });
  c.elBoost = c.elBoost || {};
  const prevGov = IG_ORDER.filter(k => c.ig[k].gov);
  coal.forEach(k => { c.elBoost[k] = {mult: 1.2, months: 48}; });
  prevGov.forEach(k => { if (!coal.includes(k)) c.elBoost[k] = {mult: 0.88, months: 48}; });
  const changed = prevGov[0] !== coal[0];
  c.legitimacy = Math.min(100, c.legitimacy + 2 + (c.laws.power === 'universal' ? 3 : 1));
  if (changed) c.radicals = Math.max(0, c.radicals - 0.01);
  if (e.camp && coal.includes(e.camp)) { c.prestige += 2; c.legitimacy = Math.min(100, c.legitimacy + 1.5); }
  e.last = {y: G.date.y, res: res.map(r => ({k: r.k, pct: r.pct})), coal, camp: e.camp, changed};
  e.next = G.date.y + 4; e.campOn = false; e.camp = null; cnt(c, 'elections');
  if (c.tag === G.player) notify('politics', `Elecciones: gana ${IGS[res[0].k].name} con el ${Math.round(res[0].pct * 100)}% del voto${changed ? '. ¡Cambia la mayoría de gobierno!' : '.'}`);
  else logMsg(`Elecciones en ${c.name}: gana ${IGS[res[0].k].name}.`);
  recalcMods(c);
}
function sponsorCampaign(c, ig) {
  const e = c.el; if (!e || !e.campOn) return {ok: false, msg: 'No hay campaña electoral en curso.'};
  if (e.camp) return {ok: false, msg: 'Ya apoyas a un partido en esta campaña.'};
  const cost = c.stats.income * 6;
  if (c.influence < 25 || c.treasury < cost) return {ok: false, msg: `Necesitas 25 de influencia y ${money(cost)}.`};
  c.influence -= 25; c.treasury -= cost; e.camp = ig;
  return {ok: true, msg: `Apoyas la campaña de ${IGS[ig].name}: +30% de voto.`};
}
function politics2Month(c) {
  movementsMonth(c); electionMonth(c);
  if (c.elBoost) for (const k in c.elBoost) if (--c.elBoost[k].months <= 0) delete c.elBoost[k];
}

/* ---------- interfaz ---------- */
function movTabHtml() {
  const c = me(), e = c.el;
  const igName = k => `<span class="igi" style="background:${IGS[k].color}">${IGS[k].icon}</span> ${IGS[k].name}`;
  const elect = !hasVote(c) ? `<p class="hint">Tu estructura de poder (<b>${LAW[c.laws.power].name}</b>) no celebra elecciones. Se necesita voto por propiedad, censitario o sufragio universal.</p>` : `
    <div class="kv"><span>Próximas elecciones</span><b>marzo de ${e ? e.next : '—'}</b></div>
    ${e && e.campOn ? `<div class="notice">🗳️ <b>Campaña electoral en curso.</b> Apoya a un partido (+30% de voto): ${money(c.stats.income * 6)} y 25 de influencia.</div>
      <div class="btnrow">${IG_ORDER.map(k => `<button data-act="campaign" data-k="${k}" ${e.camp ? 'disabled' : ''} class="${e.camp === k ? 'on' : ''}">${IGS[k].icon} ${IGS[k].name} ${pctS(c.ig[k].share, 0)}</button>`).join('')}</div>` : '<p class="hint">La campaña empieza tres meses antes de las elecciones.</p>'}
    ${e && e.last ? `<h4 class="sub">Resultado de ${e.last.y}</h4>${e.last.res.map(r => `<div class="kv sm"><span>${igName(r.k)}${e.last.coal.includes(r.k) ? ' ✔' : ''}</span><b>${Math.round(r.pct * 100)}%</b></div>${bar(r.pct, 0.5, e.last.coal.includes(r.k) ? 'good' : '')}`).join('')}<small class="dim">Los partidos de la coalición ganadora reciben +20% de influencia durante 4 años.</small>` : ''}`;
  const ms = MOVE_KEYS.map(k => ({k, m: MOVES[k], s: (c.mov || {})[k] || 0, d: MOVES[k].demand(c)})).filter(x => x.d || x.s > 1).sort((a, b) => b.s - a.s);
  return `<div class="cols"><div class="col"><div class="card"><h3>🗳️ Elecciones</h3>${elect}</div></div>
  <div class="col wide"><div class="card"><h3>Movimientos políticos</h3><p class="hint">Crecen con el malestar, la alfabetización y la pobreza. Por encima del 50% restan legitimidad; por encima del 85% provocan disturbios. Puedes <b>conceder</b> la reforma, <b>reprimir</b> o <b>cooptar</b> a sus líderes.</p>
   ${ms.length ? ms.map(({k, m, s, d}) => `<div class="mov"><div class="kv"><b>${m.icon} ${m.name}</b><span class="${s > 85 ? 'bad' : s > 50 ? 'warn' : ''}">${Math.round(s)}%</span></div>${bar(s, 100, s > 85 ? 'bad' : s > 50 ? 'warn' : '')}
    <small class="dim">${m.desc}${d ? ` Demanda: <b>${LAW[d.opt].name}</b>.` : ' Su demanda está satisfecha.'}</small>
    ${d ? `<div class="btnrow"><button data-act="movconcede" data-k="${k}">📜 Conceder</button><button data-act="movsupp" data-k="${k}">🛡️ Reprimir (20 infl.)</button><button data-act="movcoopt" data-k="${k}">💰 Cooptar (${money(c.stats.income * 8)})</button></div>` : ''}</div>`).join('') : '<p class="hint">No hay movimientos políticos activos.</p>'}</div></div></div>`;
}
Object.assign(ACT, {
  campaign: d => { const r = sponsorCampaign(me(), d.k); toast(r.ok ? '🗳️' : '⚠️', r.msg); renderWindow(); },
  movconcede: d => { const r = movConcede(me(), d.k); toast(r.ok ? '📜' : '⚠️', r.msg); renderWindow(); },
  movsupp: d => { const r = movSuppress(me(), d.k); toast(r.ok ? '🛡️' : '⚠️', r.msg); renderWindow(); },
  movcoopt: d => { const r = movCoopt(me(), d.k); toast(r.ok ? '💰' : '⚠️', r.msg); renderWindow(); }
});
