/* ===== SOCIEDAD 2: más regímenes, revoluciones ideológicas en fases y guerras civiles por bandos =====
   · LEYES NUEVAS: Partido Único, Consejos Obreros, Economía Planificada, Corporativismo y Propaganda de Estado.
   · REGÍMENES: el nombre y los efectos del gobierno dependen de las leyes, del grupo dominante y de la ideología triunfante (comunista, fascista, teocrática, nacionalista, junta).
   · REVOLUCIONES EN FASES (comunista desde 1870, fascista desde 1919, republicana, teocrática): agitación → insurrección → desenlace. El jugador decide en cada fase
     (reformar, reprimir, negociar, movilizar) y la IA decide sola. Si triunfa, el viejo régimen puede levantarse en una guerra civil con su propio nombre.
   · La ventana de Política muestra el régimen, sus efectos y el riesgo de cada revolución. */
(function () {
  const addOpt = (cat, o) => { const C = LAW_CATS.find(x => x.id === cat); if (C && !C.opts.some(x => x.id === o.id)) { C.opts.push(o); o.cat = cat; LAW[o.id] = o; } };
  addOpt('power', {id: 'one_party', name: 'Partido Único', fr: 0.1, mods: {stab: 5, rad: -.1, tax: .06}, tech: 'mass_mobilization', desc: 'Un solo partido controla el Estado y la vida pública.'});
  addOpt('power', {id: 'council', name: 'Consejos Obreros', fr: 0.5, mods: {stab: 1, rad: -.15, lit: .1}, tech: 'socialism', desc: 'El poder reside en consejos de obreros y soldados.'});
  addOpt('economy', {id: 'planned', name: 'Economía Planificada', mods: {tax: .12, invest: -.08, indOut: .05, out: -.03}, tech: 'socialism', desc: 'El Estado dirige la producción mediante planes.'});
  addOpt('economy', {id: 'corporatism', name: 'Corporativismo', mods: {tax: .06, invest: .08, rad: -.1, out: .01}, tech: 'nationalism', desc: 'Sindicatos y patronal integrados bajo la tutela del Estado.'});
  addOpt('press', {id: 'state_press', name: 'Propaganda de Estado', mods: {stab: 3, rad: -.1, lit: -.03}, tech: 'telephony', desc: 'Toda la información es del Estado.'});
})();

/* ---------- regímenes ---------- */
const REG_FX = {
  communist: {name: 'Dictadura del Proletariado', icon: '🚩', mods: {indOut: .05, tax: .05, lit: .08, rad: -.04, invest: -.06}, desc: 'El partido de la clase obrera dirige la economía y reprime a la burguesía.'},
  fascist: {name: 'Estado Fascista', icon: '🦅', mods: {army: .08, milCost: -.06, stab: 2, rad: -.08, lit: -.04, invest: .03}, desc: 'Nacionalismo militarista, partido único y economía corporativa.'},
  nationalist: {name: 'Régimen Nacionalista Autoritario', icon: '🏴', mods: {army: .04, stab: 2, tax: .03}, desc: 'Un caudillo y su ejército gobiernan en nombre de la nación.'},
  theocratic: {name: 'República Teocrática', icon: '🕌', mods: {stab: 3, lit: -.08, innov: -.05, rad: -.05}, desc: 'La autoridad religiosa dicta las leyes.'},
  junta: {name: 'Junta Militar', icon: '🎖️', mods: {army: .06, stab: 2, invest: -.04}, desc: 'Los militares gobiernan por decreto.'},
  republican: {name: null, icon: '🗳️', mods: {}, desc: ''}
};
const _govNameS2 = govName;
govName = function (c) {
  const base = _govNameS2(c), id = c.ideo;
  if (id === 'communist') return c.laws.power === 'council' ? 'República de Consejos' : 'Dictadura del Proletariado';
  if (id === 'fascist') return 'Estado Fascista';
  if (id === 'nationalist') return 'Régimen Nacionalista Autoritario';
  if (id === 'theocratic') return 'República Teocrática';
  if (id === 'junta') return 'Junta Militar';
  if (c.laws.power === 'one_party') return 'Estado de Partido Único';
  if (c.laws.power === 'council') return 'República de Consejos';
  if (c.overlord && alive(c.overlord) && /Monarquía|Despotismo/.test(base) === false) return base + ' (cliente)';
  return base;
};
function applyRegime(c, ideo) { c.ideo = ideo || null; c.regMods = ideo && REG_FX[ideo] ? REG_FX[ideo].mods : null; recalcMods(c); c.gov = govName(c); }

/* ---------- revoluciones ---------- */
const REVS = {
  communist: {name: 'Revolución comunista', icon: '🚩', from: 1870, rebel: ['Fuerzas contrarrevolucionarias', 'blanco'], laws: {power: 'council', economy: 'planned', labor: 'regulated', agrarian: 'tenant', press: 'state_press', education: 'public_edu', religion: 'secular'}, ig: 'union',
    prone: c => c.year >= 1870 && c.stats.indLevels >= 6 ? clamp((c.radicals - 0.14) * 3 + (c.ig.union ? c.ig.union.share * 2.2 : 0) + Math.max(0, 8 - c.stats.sol) * 0.04 - 0.15, 0, 1) : 0},
  fascist: {name: 'Revolución fascista', icon: '🦅', from: 1919, rebel: ['Resistencia democrática', 'republicano'], laws: {power: 'one_party', economy: 'corporatism', army: 'conscription', press: 'state_press', labor: 'no_regs', migration: 'closed_borders'}, ig: 'armed',
    prone: c => c.year >= 1919 ? clamp((c.radicals - 0.12) * 3 + ((c.ig.armed ? c.ig.armed.share : 0) + (c.ig.petty ? c.ig.petty.share : 0)) * 1.6 + (c.legitimacy < 50 ? 0.15 : 0) + (c.stats.sol < 7 ? 0.1 : 0) - 0.25, 0, 1) : 0},
  republican: {name: 'Revolución republicana', icon: '🗳️', from: 1836, rebel: ['Monárquicos', 'monárquico'], laws: {power: 'wealth_voting', press: 'limited_press', economy: 'laissez', religion: 'tolerance'}, ig: 'intel',
    prone: c => c.monarchy ? clamp((c.radicals - 0.13) * 3 + ((c.ig.intel ? c.ig.intel.share : 0) + (c.ig.petty ? c.ig.petty.share : 0)) * 1.8 + (c.legitimacy < 42 ? 0.15 : 0) - 0.25, 0, 1) : 0},
  theocratic: {name: 'Revolución teocrática', icon: '🕌', from: 1836, rebel: ['Partidarios del viejo orden', 'secular'], laws: {power: 'oligarchy', religion: 'state_religion', education: 'no_edu', press: 'censorship'}, ig: 'devout',
    prone: c => clamp((c.radicals - 0.14) * 3 + (c.ig.devout ? c.ig.devout.share * 2.4 : 0) + (c.laws.religion === 'secular' ? 0.15 : 0) - 0.35, 0, 1)}
};
const REV_KEYS = Object.keys(REVS);
function revPropensity(c, k) { try { c.year = G.date.y; const r = REVS[k], v = r.prone(c); return G.date.y < r.from || c.ideo === (k === 'republican' ? 'x' : k) ? 0 : v; } catch (e) { return 0; } }
EVENTS.push(
  {id: 'rev_warn', icon: '🔥', title: 'Agitación revolucionaria', w: 0, cond: () => false,
    text: (c, x) => `${REVS[x.k].icon} Crecen las huelgas, los panfletos y las conspiraciones: se prepara una ${REVS[x.k].name.toLowerCase()}. Los servicios de seguridad piden instrucciones.`,
    opts: [{t: 'Adelantarte con reformas', cost: 2, hint: '−radicales, +legitimidad; puede abortar el movimiento', fx: (c, x) => { c.radicals = Math.max(0, c.radicals - 0.06); c.legitimacy += 5; if (c.rev) { c.rev.resist += 1; if (Math.random() < 0.5) { c.rev = null; c.revCool = G.date.t + 365 * 3; } } }},
           {t: 'Reprimir a los agitadores', hint: '−legitimidad, +resistencia; los radicales se enconan', fx: c => { c.legitimacy -= 4; c.radicals = Math.min(0.9, c.radicals + 0.03); if (c.rev) c.rev.resist += 2; }},
           {t: 'Restar importancia', hint: 'Sin cambios', fx: () => { }}]},
  {id: 'rev_rise', icon: '💥', title: '¡Insurrección!', w: 0, cond: () => false,
    text: (c, x) => `Estalla la insurrección: ${REVS[x.k].name.toLowerCase()}. Las calles se llenan de milicias y parte de la guarnición vacila.`,
    opts: [{t: 'Movilizar al ejército y aplastarla', cost: 2, hint: 'Mucha resistencia, pero la sangre deja huella', fx: c => { if (c.rev) c.rev.resist += 3; c.mob = Math.max(c.mob || 0, 1); c.legitimacy -= 3; }},
           {t: 'Negociar un gobierno de concentración', hint: 'Cedes parte del programa; probabilidad alta de evitar la revolución', fx: (c, x) => { if (c.rev) { applyProgram(c, REVS[x.k].ig, false, 2); c.rev.resist += 4; c.legitimacy += 2; } }},
           {t: 'Abandonar el poder', hint: 'La revolución triunfa sin lucha', fx: c => { if (c.rev) c.rev.resist = -99; }}]}
);
function revNotify(c, id, k) {
  if (c.tag !== G.player) return;
  if (!histNotifyPlayer(id, c, {k})) histNotifyPlayerLater(id, c, {k});
}
function revStart(c, k) {
  c.rev = {k, stage: 1, left: 5 + Math.floor(Math.random() * 4), resist: 0, push: 0};
  if (c.tag === G.player) { notify('crisis', `${REVS[k].icon} Se prepara una ${REVS[k].name.toLowerCase()}. Decide cómo responder.`, c.capital); revNotify(c, 'rev_warn', k); }
  else if (isEuropean(c) || c.rank <= 20) logMsg(`${c.name}: agitación revolucionaria (${REVS[k].name.toLowerCase()}).`);
}
function revSuccessChance(c) {
  const r = c.rev, arm = c.ig.armed ? c.ig.armed.approval : 0;
  return clamp(0.3 + c.radicals * 1.4 + (50 - c.legitimacy) / 100 + r.push * 0.06 - r.resist * 0.09 - arm * 0.02 - (c.mob || 0) * 0.04, 0.03, 0.95);
}
function revMonth(c) {
  if (c.tag === NONE || !c.states.length || !c.ig || !rule('civil')) return;
  if (c.rev) {
    const r = c.rev; r.left--; c.radicals = Math.min(0.9, c.radicals + 0.004);
    if (c.ai) { r.resist += Math.random() < 0.3 ? 1 : 0; if (r.stage === 1 && r.left === 2 && Math.random() < 0.35) { c.radicals = Math.max(0, c.radicals - 0.05); c.legitimacy += 3; r.resist++; } }
    if (r.left > 0) return;
    if (r.stage === 1) { r.stage = 2; r.left = 2 + Math.floor(Math.random() * 3); if (c.tag === G.player) { notify('crisis', `💥 ¡Insurrección! ${REVS[r.k].name}. Responde sin demora.`, c.capital); revNotify(c, 'rev_rise', r.k); } return; }
    // desenlace
    const p = revSuccessChance(c), k = r.k; c.rev = null; c.revCool = G.date.t + 365 * 6;
    if (Math.random() < p) revSucceeds(c, k);
    else { c.legitimacy = clamp(c.legitimacy + 4, 0, 100); c.radicals = Math.max(0, c.radicals * 0.6); c.prestige = Math.max(0, c.prestige - 2); if (c.tag === G.player) notify('politics', `Has aplastado la ${REVS[k].name.toLowerCase()}. La calma vuelve, a un precio.`); else logMsg(`${c.name} sofoca una ${REVS[k].name.toLowerCase()}.`); }
    return;
  }
  if ((c.revCool || 0) > G.date.t || c.wars.length || c.states.length < 3) return;
  let best = null, bv = 0; REV_KEYS.forEach(k => { const v = revPropensity(c, k); if (v > bv) { bv = v; best = k; } });
  if (best && bv > 0.3 && Math.random() < (bv - 0.3) * 0.1 * diffP().crisis * (1 + (c.lowLeg || 0) / 6)) revStart(c, best);
}
function revSucceeds(c, k) {
  const R = REVS[k], old = c.gov; let civil = null;
  if (c.states.length >= 5 && Math.random() < 0.55 && typeof startCivilWar === 'function') civil = startCivilWar(c.tag, {name: R.rebel[0] + ' de ' + c.name, adj: R.rebel[1], frac: 0.3});    // el viejo régimen se levanta con sus leyes
  for (const cat in R.laws) { const o = LAW[R.laws[cat]]; if (o) c.laws[cat] = o.id; }
  if (k !== 'theocratic' || true) c.monarchy = k === 'republican' ? false : (k === 'theocratic' ? c.monarchy : false);
  applyRegime(c, k === 'republican' ? null : k); politics(c);
  c.legitimacy = 52; c.radicals = Math.min(0.9, c.radicals * 0.6); c.prestige = Math.max(0, c.prestige - 6); c.treasury -= Math.max(0, c.stats.income) * 3; c.investPool = (c.investPool || 0) * 0.5;
  G.crises.push({id: G.nextId++, type: 'strike', name: 'Convulsión revolucionaria', icon: '🔥', scope: c.tag, months: 6, left: 6, fx: {ind: 0.92, demand: 0.96}, desc: 'El orden social cambia de golpe.', started: Object.assign({}, G.date)});
  if (k === 'communist' || k === 'fascist') G.tags.forEach(o => { if (o !== NONE && o !== c.tag && alive(o)) { const O = G.C[o], opp = k === 'communist' ? (O.laws.power === 'autocracy' || O.monarchy) : (O.laws.power === 'universal' || O.laws.power === 'wealth_voting'); addRel(o, c.tag, opp ? -14 : -4); } });
  c.govHist = c.govHist || []; c.govHist.push({y: G.date.y, from: old, to: c.gov, kind: 'revolution'}); cnt(c, 'revolutions'); cnt(c, 'govChanges');
  const txt = `${R.icon} ¡${R.name} en ${c.name}! Nuevo régimen: ${c.gov}.${civil ? ` ${G.C[civil.rt].name} se levanta con ${civil.ids.length} estados.` : ''}`;
  notify('politics', txt, c.capital); if (c.tag !== G.player) logMsg(txt);
  if (civil && c.tag === G.player) histNotifyPlayerLater('h_civil', c, {rt: civil.rt, n: civil.ids.length, nm: G.C[civil.rt].name});
}
const _politics2MonthS2 = politics2Month;
politics2Month = function (c) { _politics2MonthS2(c); try { revMonth(c); } catch (e) { console.warn('revMonth', e); } };
// los regímenes ideológicos se mantienen aunque se recalculen leyes; los golpes militares dejan la huella de junta
const _govTransitionS2 = govTransition;
govTransition = function (c, ig, kind, silent) { const r = _govTransitionS2(c, ig, kind, silent); if (r && r.ok && kind === 'coup') { applyRegime(c, 'junta'); } else if (r && r.ok && kind === 'revolution') { if (ig === 'armed') applyRegime(c, 'nationalist'); else if (c.ideo) applyRegime(c, null); } return r; };

/* ---------- interfaz: tarjeta de régimen y riesgo de revolución en la ventana de Política ---------- */
function regimeCardHtml(c) {
  const fx = c.regMods || {}, ft = Object.keys(fx).length && typeof fxText === 'function' ? fxText(fx) : '';
  const rows = REV_KEYS.map(k => { const v = revPropensity(c, k); return `<div class="kv sm"><span>${REVS[k].icon} ${REVS[k].name} <small class="dim">${G.date.y < REVS[k].from ? '(desde ' + REVS[k].from + ')' : ''}</small></span><b class="${v > 0.5 ? 'bad' : ''}">${Math.round(v * 100)}%</b></div>${bar(v, 1, v > 0.5 ? 'bad' : v > 0.25 ? 'warn' : 'good')}`; }).join('');
  const rv = c.rev ? `<div class="notice bad"><b>${REVS[c.rev.k].icon} ${REVS[c.rev.k].name}: ${c.rev.stage === 1 ? 'fase de agitación' : 'insurrección'}</b><br><small>Quedan ~${c.rev.left} meses · probabilidad de triunfo ${Math.round(revSuccessChance(c) * 100)}% · resistencia ${c.rev.resist}</small></div>` : '';
  return `<div class="card"><h3>${c.ideo && REG_FX[c.ideo] ? REG_FX[c.ideo].icon : '🏛️'} Régimen: ${c.gov}</h3>${c.ideo && REG_FX[c.ideo] ? `<p class="hint">${REG_FX[c.ideo].desc}</p>${ft ? `<div class="kv sm"><span>Efectos</span><b>${ft}</b></div>` : ''}` : '<p class="hint">Las leyes y el grupo de interés dominante determinan el tipo de gobierno.</p>'}${rv}<h4>Riesgo de revolución</h4>${rows}<p class="hint">Se agravan con radicales altos, baja legitimidad, ejército descontento y pobreza. Reformar a tiempo, propaganda o represión cambian el curso.</p></div>`;
}
const _polRenderS2 = WINDOWS.politics.render;
WINDOWS.politics.render = function () { const h = _polRenderS2.call(this); if (typeof curTab === 'function' && curTab('pol', 'igs') !== 'igs') return h; const c = me(); return h + regimeCardHtml(c); };
