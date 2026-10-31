/* ===== HISTORIA: países dormidos, guerra civil y secesión, y eventos históricos =====
   · Países «dormidos» (sin estados al empezar): sirven de bandera a los rebeldes de una guerra civil (la Confederación, rebeldes genéricos…).
   · Guerra civil: un país con legitimidad muy baja y muchos radicales durante meses puede partirse; una región entera se separa con parte del
     ejército y el país madre le declara la guerra para recuperarla.
   · Eventos históricos con fecha: Revoluciones de 1848, unificaciones de Alemania e Italia, guerra civil americana, rebelión Taiping, Restauración Meiji.
     La IA los vive de forma automática; el jugador recibe un evento con decisiones. */
Object.assign(COUNTRY_DATA, {
  CSA: ['Estados Confederados', 'confederado', '#7d8a9e', 'h2:#a33a3a:#f2f2f2', 'República', 'Richmond', 20, 0.04, 'liberal', 100000],
  RB1: ['Rebeldes del Norte', 'rebelde', '#b5651d', 'h2:#b5651d:#222', 'Gobierno rebelde', '', 10, 0.03, 'eastern', 80000],
  RB2: ['Rebeldes del Sur', 'rebelde', '#8e4a8e', 'h2:#8e4a8e:#222', 'Gobierno rebelde', '', 10, 0.03, 'eastern', 80000],
  RB3: ['Rebeldes del Este', 'rebelde', '#3f8f8f', 'h2:#3f8f8f:#222', 'Gobierno rebelde', '', 10, 0.03, 'eastern', 80000],
  RB4: ['Rebeldes del Oeste', 'rebelde', '#a89a3a', 'h2:#a89a3a:#222', 'Gobierno rebelde', '', 10, 0.03, 'eastern', 80000],
  RB5: ['Rebeldes del Centro', 'rebelde', '#c0507a', 'h2:#c0507a:#222', 'Gobierno rebelde', '', 10, 0.03, 'eastern', 80000],
  RB6: ['Rebeldes del Litoral', 'rebelde', '#5a7fc0', 'h2:#5a7fc0:#222', 'Gobierno rebelde', '', 10, 0.03, 'eastern', 80000]
});
/* ---------- reglas de la partida (se eligen al empezar y se guardan) ---------- */
const RULE_DEFS = [
  {k: 'hist', name: 'Eventos históricos', desc: 'Unificaciones, 1848, Meiji, guerra civil americana, Taiping…'},
  {k: 'civil', name: 'Guerras civiles', desc: 'Los países en crisis profunda pueden partirse.'},
  {k: 'spy', name: 'Espionaje enemigo', desc: 'La IA puede sabotearte, financiar rebeldes o robarte tecnología.'}
];
const AGGR_NAMES = ['Pacífica', 'Normal', 'Belicosa'], AGGR_MULT = [0.5, 1, 1.6];
const defaultRules = () => ({hist: true, civil: true, spy: true, aggr: 1});
const rule = k => { const r = G.rules || (G.rules = defaultRules()); return r[k] === undefined ? defaultRules()[k] : r[k]; };
const aggrMult = () => AGGR_MULT[rule('aggr')] || 1;
const REBEL_TAGS = ['RB1', 'RB2', 'RB3', 'RB4', 'RB5', 'RB6'];
const histDone = id => G.eventCool && G.eventCool['h_' + id] !== undefined;
const histMark = id => { if (G.eventCool) G.eventCool['h_' + id] = 1e9; };
const stateLL = sid => { const p = MAP.provs[stateCapitalProv(sid)]; return p ? {lon: p.lon, lat: p.lat} : {lon: 0, lat: 0}; };
const isEuropean = c => { if (c.capital < 0) return false; const p = stateLL(c.capital); return p.lon > -15 && p.lon < 45 && p.lat > 34 && p.lat < 72; };

/* ---------- guerra civil y secesión ---------- */
// región contigua alejada de la capital (se separa de ella)
function cwRegion(tag, frac, pred) {
  const c = G.C[tag], own = new Set(c.states), cap = c.capital;
  const dist = new Map([[cap, 0]]), q = [cap];
  while (q.length) { const x = q.shift(); G.S[x].neigh.forEach(n => { if (own.has(n) && !dist.has(n)) { dist.set(n, dist.get(x) + 1); q.push(n); } }); }
  const cands = c.states.filter(id => id !== cap && (!pred || pred(id)));
  if (!cands.length) return [];
  cands.sort((a, b) => (dist.has(b) ? dist.get(b) : 99) - (dist.has(a) ? dist.get(a) : 99));
  const seed = cands[Math.floor(Math.random() * Math.min(3, cands.length))], want = Math.max(2, Math.round(c.states.length * frac));
  const out = [seed], seen = new Set(out);
  for (let i = 0; i < out.length && out.length < want; i++) G.S[out[i]].neigh.forEach(n => { if (own.has(n) && n !== cap && !seen.has(n) && (!pred || pred(n)) && out.length < want) { seen.add(n); out.push(n); } });
  return out;
}
function pickRebelTag(parent, prefer) {
  const free = t => G.C[t] && t !== NONE && t !== parent && t !== G.player && !G.C[t].states.length && !G.C[t].wars.length && !G.C[t].overlord;
  if (prefer && G.C[prefer] && free(prefer) && !(G.C[prefer].rebelUsed)) return prefer;
  return REBEL_TAGS.find(t => free(t) && !G.C[t].rebelUsed) || G.tags.find(t => free(t) && !(COUNTRY_DATA[t] && /Tierras/.test(COUNTRY_DATA[t][0])) && !REBEL_TAGS.includes(t) && t !== 'CSA') || null;
}
function startCivilWar(tag, o) {
  o = o || {}; const P = G.C[tag]; if (!P || !alive(tag) || P.states.length < 4 || P.capital < 0) return null;
  const ids = cwRegion(tag, o.frac || 0.35, o.pred); if (!ids.length) return null;
  const rt = pickRebelTag(tag, o.prefer); if (!rt) return null;
  const R = G.C[rt], share = ids.reduce((n, id) => n + popTotal(G.S[id]), 0) / Math.max(1, P.states.reduce((n, id) => n + popTotal(G.S[id]), 0));
  const cap = ids.slice().sort((a, b) => G.S[b].popBase - G.S[a].popBase)[0];
  R.techs = new Set(P.techs); R.laws = Object.assign({}, P.laws); recalcMods(R);
  R.ai = true; R.overlord = null; R.subjects = []; R.wars = []; R.claims = []; R.bloc = null; R.rebelOf = tag; R.rebelUsed = true;
  R.name = o.name || ('Rebeldes de ' + G.S[cap].name); R.adj = o.adj || 'rebelde';
  R.legitimacy = 60; R.radicals = 0.1; R.prestige = Math.round(P.prestige * 0.25) + 5; R.influence = 100;
  const tr = Math.max(0, P.treasury) * Math.min(0.6, share); R.treasury = Math.round(tr); P.treasury -= tr * 0.9;
  ids.forEach(id => transferState(G.S[id], rt));
  R.capital = cap; R.capitalName = G.S[cap].name;
  // ejércitos que estaban en la región pasan a los rebeldes; el resto se levanta con levas
  const inRegion = new Set(ids); let moved = 0;
  G.armies.forEach(a => { if (a.tag === tag && !a.sea && inRegion.has(provState(a.loc))) { a.tag = rt; a.gen = newGeneral(1, rt); moved += a.divs.length; } });
  if (moved < 6) { const k = Math.min(10, Math.max(4, Math.round(countDivs(tag) * 0.2))), divs = []; for (let i = 0; i < k; i++) divs.push(mkDivision(Math.random() < 0.8 ? 'inf' : 'cav', 0.4)); const a = mkArmy(rt, stateCapitalProv(cap), divs, '1.º Ejército Rebelde'); a.mode = 'hold'; }
  if (P.eq && R.eq) for (const g in P.eq) { const take = (P.eq[g] || 0) * Math.min(0.5, share); R.eq[g] = (R.eq[g] || 0) + take; P.eq[g] -= take; }
  if (typeof spawnLevies === 'function') try { spawnLevies(R); } catch (_) { /* sin levas */ }
  R.relations = R.relations || {}; R.relations[tag] = -90; if (P.relations) P.relations[rt] = -90;
  const w = declareWar(tag, rt, 'conquest', ids, {free: true});
  G.eventCool['cw_' + tag] = G.date.t + 365 * 25;
  if (P.cwSponsor && G.C[P.cwSponsor]) { const sp = P.cwSponsor; R.relations[sp] = 60; R.sponsor = sp; R.treasury += Math.round(Math.max(0, G.C[sp].stats.income) * 4); if (sp === G.player) notify('war', `🕵️ ¡Tus agentes lo han logrado! ${P.name} estalla en una guerra civil y ${R.name} cuenta con tu apoyo.`); P.cwSponsor = null; }
  const txt = `¡GUERRA CIVIL! ${R.name} se separa de ${P.name} con ${ids.length} ${ids.length === 1 ? 'estado' : 'estados'} (${ids.slice(0, 3).map(i => G.S[i].name).join(', ')}).`;
  notify('war', txt, cap); R.civilWar = {parent: tag, ids: ids.slice(), year: G.date.y};
  return {rt, ids, war: w && w.ok};
}
// la IA o el jugador pueden perder la partida por guerra civil: se comprueba el estrés interno cada mes
function civilWarMonth() {
  if (!rule('civil')) return;
  G.tags.forEach(t => {
    if (t === NONE) return; const c = G.C[t]; if (!c.states.length || c.states.length < 6 || c.wars.length > 1) return;
    if ((G.eventCool['cw_' + t] || 0) > G.date.t) return;
    if (((c.lowLeg || 0) >= 8 || ((c.cwSupport || 0) >= 2 && (c.lowLeg || 0) >= 4)) && c.radicals > 0.25 && Math.random() < (c.ai ? 0.18 : 0.12)) {
      const r = startCivilWar(t); if (r && t === G.player) histNotifyPlayer('h_civil', G.C[t], {rt: r.rt, n: r.ids.length, nm: G.C[r.rt].name});
    }
  });
}

/* ---------- unificaciones ---------- */
function annexWhole(leader, minor) {
  const M = G.C[minor], L = G.C[leader]; if (!M || !M.states.length || M.wars.length) return false;
  (M.subjects || []).slice().forEach(s => { if (G.C[s].overlord === minor) { G.C[s].overlord = leader; L.subjects = (L.subjects || []).concat([s]); } });
  M.subjects = []; if (M.overlord) { const O = G.C[M.overlord]; O.subjects = (O.subjects || []).filter(x => x !== minor); M.overlord = null; }
  M.states.slice().forEach(id => transferState(G.S[id], leader));
  G.armies.forEach(a => { if (a.tag === minor) { a.tag = leader; a.gen = newGeneral(1, leader); } });
  G.pacts = G.pacts.filter(p => p.a !== minor && p.b !== minor);
  L.treasury += Math.max(0, M.treasury) * 0.5; M.treasury = 0; return true;
}
function unifyNation(leader, minors, name, adj, label) {
  const L = G.C[leader]; let n = 0; minors.forEach(m => { if (annexWhole(leader, m)) n++; });
  if (!n) return 0;
  L.name = name; L.adj = adj; L.prestige += 25; L.legitimacy = Math.min(100, L.legitimacy + 10); L.radicals = Math.max(0, L.radicals - 0.05);
  addTimedFx(L, label, '🏛️', {ind: 1.04, demand: 1.02}, 120, 'El nuevo Estado nacional integra mercados y administraciones.');
  notify('event', `${label}: ${name} se proclama tras unir ${n} Estados.`, L.capital);
  return n;
}
const GER_MINORS = ['BAV', 'SAX', 'HAN', 'WUR', 'BAD', 'HES', 'MEC'], ITA_MINORS = ['TWS', 'PAP', 'TUS'];
const liveMinors = (list, leader) => list.filter(t => alive(t) && t !== leader && !G.C[t].wars.length && G.C[t].overlord !== leader);

/* ---------- Restauración Meiji ---------- */
function meijiEffect(c) {
  for (let i = 0; i < 6; i++) freeTech(c);
  addTimedFx(c, 'Restauración Meiji', '🌸', {ind: 1.10, demand: 1.03}, 180, 'Modernización acelerada: ferrocarriles, escuelas, fábricas y un ejército moderno.');
  c.prestige += 15; c.legitimacy = Math.min(100, c.legitimacy + 6); c.influence += 40;
  if (c.tag === 'JAP' && /Tokugawa/.test(c.name)) { c.name = 'Imperio del Japón'; c.adj = 'japonés'; }
  if (LAW[c.laws.education] && c.laws.education === 'no_edu' && LAW.public_edu) c.laws.education = 'public_edu';
  recalcMods(c); notify('event', `${c.name} abraza la modernización (Restauración Meiji).`, c.capital);
}

/* ---------- eventos para el jugador ---------- */
function histNotifyPlayer(id, c, ctx) {
  if (G.pendingEvent) return false;
  const e = EVENTS.find(x => x.id === id); if (!e) return false;
  G.pendingEvent = {id: e.id, title: e.title, icon: e.icon || '📰', text: e.text(c, ctx), ctx}; return true;
}
EVENTS.push(
  {id: 'h_civil', icon: '⚔️', title: '¡Guerra civil!', w: 0, cond: () => false,
    text: (c, x) => `La crisis interna ha estallado: ${x.nm} se ha separado con ${x.n} estados y se ha armado contra ti. Debes recuperarlos antes de que se consoliden.`,
    opts: [{t: 'Movilizar el ejército y aplastar la rebelión', hint: 'Ya estás en guerra contra los rebeldes', fx: c => { c.mob = Math.max(c.mob || 0, 1); }},
           {t: 'Ofrecer reformas para debilitar a los rebeldes', cost: 3, hint: '+legitimidad, −radicales', fx: c => { c.legitimacy += 6; c.radicals = Math.max(0, c.radicals - 0.06); }}]},
  {id: 'h_1848', icon: '🗽', title: 'Primavera de los pueblos (1848)', w: 0, cond: () => false,
    text: () => 'Una oleada revolucionaria recorre Europa: barricadas, constituciones y reclamos nacionales. Tus súbditos exigen libertades.',
    opts: [{t: 'Conceder una constitución', hint: '+legitimidad, la nobleza se resiente', fx: c => { c.legitimacy += 6; c.radicals = Math.max(0, c.radicals - 0.07); addIGBoost(c, 'lands', 'suppress', 12); }},
           {t: 'Reprimir con el ejército', hint: '−legitimidad, +radicales a medio plazo', fx: c => { c.legitimacy -= 4; c.radicals = Math.min(0.9, c.radicals + 0.04); c.prestige += 2; }}]},
  {id: 'h_ger_pru', icon: '🦅', title: 'La cuestión alemana', w: 0, cond: () => false,
    text: (c, x) => `Con el Zollverein y el ejército más moderno de Alemania, la unificación bajo tu corona está al alcance. ${x.n} Estados alemanes podrían integrarse.`,
    opts: [{t: 'Proclamar el Imperio Alemán', hint: 'Anexas los Estados alemanes; +prestigio', fx: (c, x) => { unifyNation(c.tag, liveMinors(GER_MINORS, c.tag), 'Imperio Alemán', 'alemán', 'Unificación alemana'); histMark('ger'); }},
           {t: 'Esperar un momento mejor', hint: 'Se repetirá más adelante', fx: () => { delete G.eventCool.h_ger; G.eventCool.h_gerWait = G.date.t + 365 * 3; }}]},
  {id: 'h_ger_minor', icon: '🦅', title: 'Prusia exige la unión alemana', w: 0, cond: () => false,
    text: () => 'Prusia, dueña del Zollverein, propone integrar tu Estado en una Alemania unida bajo su corona.',
    opts: [{t: 'Aceptar como Estado federado (vasallo de Prusia)', hint: 'Conservas tu gobierno interno; +prestigio', fx: c => { if (alive('PRU') && !c.wars.length) makeSubject('PRU', c.tag); c.prestige += 6; histMark('ger'); }},
           {t: 'Rechazar y defender tu soberanía', hint: 'Prusia te declarará la guerra', fx: c => { const r = declareWar('PRU', c.tag, 'conquest', c.states.slice(0, 3), {free: true}); if (!r.ok) notify('war', 'Prusia se echa atrás.'); c.prestige += 4; histMark('ger'); }}]},
  {id: 'h_ita_sar', icon: '🇮🇹', title: 'El Risorgimento', w: 0, cond: () => false,
    text: (c, x) => `El nacionalismo italiano pide unir la península. ${x.n} Estados italianos podrían integrarse en un Reino de Italia bajo tu corona.`,
    opts: [{t: 'Proclamar el Reino de Italia', hint: 'Anexas los Estados italianos; +prestigio', fx: c => { unifyNation(c.tag, liveMinors(ITA_MINORS, c.tag), 'Reino de Italia', 'italiano', 'Unificación italiana'); histMark('ita'); }},
           {t: 'Esperar un momento mejor', hint: 'Se repetirá más adelante', fx: () => { delete G.eventCool.h_ita; G.eventCool.h_itaWait = G.date.t + 365 * 3; }}]},
  {id: 'h_ita_minor', icon: '🇮🇹', title: 'Cerdeña propone unir Italia', w: 0, cond: () => false,
    text: () => 'El Piamonte-Cerdeña, con apoyo del nacionalismo italiano, te propone integrarte en un Reino de Italia.',
    opts: [{t: 'Aceptar como vasallo del nuevo reino', hint: 'Conservas tu gobierno interno; +prestigio', fx: c => { if (alive('SAR') && !c.wars.length) makeSubject('SAR', c.tag); c.prestige += 6; histMark('ita'); }},
           {t: 'Rechazar', hint: 'Cerdeña te declarará la guerra', fx: c => { const r = declareWar('SAR', c.tag, 'conquest', c.states.slice(0, 3), {free: true}); if (!r.ok) notify('war', 'Cerdeña se echa atrás.'); c.prestige += 4; histMark('ita'); }}]},
  {id: 'h_usciv', icon: '🗡️', title: 'Crisis de secesión', w: 0, cond: () => false,
    text: () => 'Los estados del sur, enfrentados por la esclavitud y los aranceles, amenazan con separarse de la Unión.',
    opts: [{t: 'Impedirlo por la fuerza', hint: 'Estalla la guerra civil', fx: c => { const r = startCivilWar(c.tag, civilOpts('usa')); histMark('usciv'); if (r) histNotifyPlayerLater('h_civil', c, {rt: r.rt, n: r.ids.length, nm: G.C[r.rt].name}); }},
           {t: 'Negociar una secesión pacífica', hint: 'Pierdes los estados del sur sin guerra; −prestigio', fx: c => { const o = civilOpts('usa'), ids = cwRegion(c.tag, o.frac, o.pred), rt = pickRebelTag(c.tag, 'CSA'); if (ids.length && rt) { const R = G.C[rt]; R.name = o.name; R.adj = o.adj; R.rebelOf = c.tag; R.rebelUsed = true; R.techs = new Set(c.techs); R.laws = Object.assign({}, c.laws); recalcMods(R); R.ai = true; ids.forEach(id => transferState(G.S[id], rt)); R.capital = ids[0]; R.capitalName = G.S[ids[0]].name; R.treasury = Math.round(c.treasury * 0.15); const a = mkArmy(rt, stateCapitalProv(ids[0]), [mkDivision('inf', 0.4), mkDivision('inf', 0.4), mkDivision('cav', 0.4)], '1.º Ejército'); a.mode = 'hold'; c.prestige = Math.max(0, c.prestige - 10); } histMark('usciv'); }}]},
  {id: 'h_taiping', icon: '🐉', title: 'Rebelión Taiping', w: 0, cond: () => false,
    text: () => 'Un profeta que se proclama hermano de Cristo ha levantado el sur contra la dinastía. Millones de campesinos se suman al Reino Celestial.',
    opts: [{t: 'Enviar a los ejércitos imperiales', hint: 'Guerra civil', fx: c => { const r = startCivilWar(c.tag, civilOpts('chn')); histMark('taiping'); if (r) histNotifyPlayerLater('h_civil', c, {rt: r.rt, n: r.ids.length, nm: G.C[r.rt].name}); }},
           {t: 'Alzar milicias regionales (los gobernadores se refuerzan)', cost: 2, hint: 'Guerra civil con más legitimidad interna', fx: c => { c.legitimacy += 4; const r = startCivilWar(c.tag, civilOpts('chn')); histMark('taiping'); if (r) histNotifyPlayerLater('h_civil', c, {rt: r.rt, n: r.ids.length, nm: G.C[r.rt].name}); }}]},
  {id: 'h_meiji', icon: '🌸', title: 'Llegada de los barcos negros', w: 0, cond: () => false,
    text: () => 'Una flota extranjera de vapor exige abrir los puertos. El shogunato es incapaz de resistir: o te modernizas o serás sometido.',
    opts: [{t: 'Abrir el país y modernizarlo (Restauración Meiji)', hint: '6 tecnologías gratis, +10% industria 15 años', fx: c => { meijiEffect(c); histMark('meiji'); }},
           {t: 'Mantener el aislamiento', hint: '−legitimidad; se repetirá', fx: c => { c.legitimacy -= 6; c.prestige = Math.max(0, c.prestige - 5); G.eventCool.h_meijiWait = G.date.t + 365 * 2; }}]}
);
const pendingLater = [];
function histNotifyPlayerLater(id, c, ctx) { pendingLater.push({id, tag: c.tag, ctx}); }
function civilOpts(kind) {
  if (kind === 'usa') return {prefer: 'CSA', name: 'Estados Confederados', adj: 'confederado', frac: 0.4, pred: id => { const p = stateLL(id); return p.lat < 38.5 && p.lon > -103 && p.lon < -74; }};
  return {name: 'Reino Celestial Taiping', adj: 'taiping', frac: 0.4};
}

/* ---------- calendario histórico (se llama cada mes) ---------- */
function histMonth() {
  if (!G.eventCool) return;
  const y = G.date.y, m = G.date.m, P = G.player;
  // eventos que el jugador no pudo ver por haber otro pendiente
  if (pendingLater.length && !G.pendingEvent) { const q = pendingLater.shift(); if (q.tag === P && G.C[P]) histNotifyPlayer(q.id, G.C[P], q.ctx); }
  civilWarMonth(); if (typeof cwAlertMonth === 'function') cwAlertMonth(); if (typeof spyMonth === 'function') spyMonth();
  if (!rule('hist')) return;
  const wait = k => (G.eventCool['h_' + k + 'Wait'] || 0) > G.date.t;
  // Revoluciones de 1848
  if (y === 1848 && m >= 2 && !histDone('rev48')) {
    histMark('rev48'); let any = false;
    G.tags.forEach(t => { if (t === NONE) return; const c = G.C[t]; if (!c.states.length || !isEuropean(c) || !(c.monarchy || c.laws.power === 'autocracy' || c.laws.power === 'landed_voting')) return;
      if (t === P) { any = histNotifyPlayer('h_1848', c, null); if (!any) pendingLater.push({id: 'h_1848', tag: P, ctx: null}); } else { c.radicals = Math.min(0.9, c.radicals + 0.04); c.legitimacy -= 4; } });
    notify('event', 'Estalla la Primavera de los pueblos: revoluciones por toda Europa.');
  }
  // Restauración Meiji
  if (!histDone('meiji') && !wait('meiji') && alive('JAP') && y >= 1853 && y <= 1872 && (Math.random() < 0.10 || y === 1868)) {
    const c = G.C.JAP; if (c.ai) { meijiEffect(c); histMark('meiji'); } else if (!G.pendingEvent) histNotifyPlayer('h_meiji', c, null);
  }
  // Rebelión Taiping
  if (!histDone('taiping') && alive('CHN') && y >= 1850 && y <= 1862 && G.C.CHN.states.length >= 8 && Math.random() < 0.06) {
    const c = G.C.CHN; if (c.ai) { startCivilWar('CHN', civilOpts('chn')); histMark('taiping'); } else if (!G.pendingEvent) histNotifyPlayer('h_taiping', c, null);
  }
  // guerra civil americana
  if (!histDone('usciv') && alive('USA') && G.C.CSA && y >= 1855 && y <= 1870 && G.C.USA.states.length >= 8 && Math.random() < 0.05) {
    const c = G.C.USA; if (c.ai) { startCivilWar('USA', civilOpts('usa')); histMark('usciv'); } else if (!G.pendingEvent) histNotifyPlayer('h_usciv', c, null);
  }
  // unificación alemana
  if (!histDone('ger') && !wait('ger') && alive('PRU') && y >= 1844 && y <= 1895 && G.C.PRU.rank <= 25 && !G.C.PRU.wars.length && Math.random() < 0.03) {
    const mins = liveMinors(GER_MINORS, 'PRU'); if (mins.length >= 2) {
      const pm = mins.find(t => t === P);
      if (P === 'PRU') { if (!G.pendingEvent) histNotifyPlayer('h_ger_pru', G.C.PRU, {n: mins.length}); }
      else if (pm) { if (!G.pendingEvent) histNotifyPlayer('h_ger_minor', G.C[pm], null); }
      else { unifyNation('PRU', mins, 'Imperio Alemán', 'alemán', 'Unificación alemana'); histMark('ger'); }
    }
  }
  // unificación italiana
  if (!histDone('ita') && !wait('ita') && alive('SAR') && y >= 1844 && y <= 1895 && G.C.SAR.rank <= 60 && !G.C.SAR.wars.length && Math.random() < 0.03) {
    const mins = liveMinors(ITA_MINORS, 'SAR'); if (mins.length >= 1) {
      const pm = mins.find(t => t === P);
      if (P === 'SAR') { if (!G.pendingEvent) histNotifyPlayer('h_ita_sar', G.C.SAR, {n: mins.length}); }
      else if (pm) { if (!G.pendingEvent) histNotifyPlayer('h_ita_minor', G.C[pm], null); }
      else { unifyNation('SAR', mins, 'Reino de Italia', 'italiano', 'Unificación italiana'); histMark('ita'); }
    }
  }
}

/* ---------- riesgo de guerra civil: indicador y alertas para el jugador ---------- */
function cwRisk(c) {
  const out = {pct: 0, why: []}; if (!c || !c.states.length) return out;
  if (c.states.length < 6) { out.why.push('Estado demasiado pequeño para partirse'); return out; }
  if ((G.eventCool['cw_' + c.tag] || 0) > G.date.t) { out.why.push('Acaba de superar una guerra civil'); return out; }
  let r = 0;
  const leg = clamp((45 - c.legitimacy) / 45, 0, 1); r += leg * 35; if (leg > 0.15) out.why.push(`Legitimidad baja (${Math.round(c.legitimacy)}%)`);
  const rad = clamp((c.radicals - 0.1) / 0.3, 0, 1); r += rad * 30; if (rad > 0.15) out.why.push(`Radicales ${Math.round(c.radicals * 100)}%`);
  const low = clamp((c.lowLeg || 0) / 8, 0, 1); r += low * 25; if (low > 0.2) out.why.push(`${c.lowLeg} meses con legitimidad crítica`);
  const sup = Math.min(1, (c.cwSupport || 0) / 3); r += sup * 10; if (sup > 0) out.why.push('Agentes extranjeros financian a los rebeldes');
  out.pct = Math.round(clamp(r, 0, 100)); return out;
}
function cwAlertMonth() {
  const c = G.C[G.player]; if (!c || !rule('civil')) return;
  const R = cwRisk(c), lvl = R.pct >= 85 ? 3 : R.pct >= 65 ? 2 : R.pct >= 40 ? 1 : 0, prev = c.cwAlert || 0;
  if (lvl > prev) notify('crisis', `${lvl === 3 ? '🚨' : '⚠️'} Riesgo de guerra civil ${R.pct}%: ${R.why.slice(0, 3).join(' · ')}. Sube la legitimidad (reformas, propaganda) o reduce los radicales.`);
  if (lvl > prev || R.pct < 30) c.cwAlert = R.pct < 30 ? 0 : lvl;
}
