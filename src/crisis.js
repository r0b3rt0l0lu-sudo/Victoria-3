/* ===== CRISIS ECONÓMICAS, PATROCINIO DE GRUPOS Y CAMBIOS DE GOBIERNO ===== */
const CRISIS_TYPES = {
  panic: {name: 'Pánico financiero', icon: '📉', scope: 'global', months: [10, 18], fx: {invest: 0.45, credit: 2.4, demand: 0.93}, w: 1.0,
    desc: 'Los bancos restringen el crédito y la inversión se desploma. El consumo cae y los intereses de la deuda se disparan.'},
  famine: {name: 'Malas cosechas', icon: '🌾', scope: 'global', months: [8, 14], fx: {agri: 0.80}, shock: {grain: 1.5, meat: 1.2}, w: 0.9,
    desc: 'Una sequía o plaga reduce la producción agrícola en todo el mundo y encarece los alimentos.'},
  depression: {name: 'Gran depresión', icon: '🏚️', scope: 'global', months: [20, 34], fx: {demand: 0.86, ind: 0.94, invest: 0.7}, w: 0.5, needs: 'afterPanic',
    desc: 'Tras el pánico, la demanda se estanca durante años: menos consumo, menos industria y menos inversión.'},
  rail_bubble: {name: 'Burbuja especulativa', icon: '🎈', scope: 'global', months: [12, 20], fx: {invest: 0.6, demand: 0.95, credit: 1.6}, w: 0.6, needs: 'railways',
    desc: 'La especulación con acciones ferroviarias estalla y arrastra a bancos y empresas.'},
  coal_shock: {name: 'Crisis de materias primas', icon: '⛏️', scope: 'global', months: [8, 12], fx: {mine: 0.9, ind: 0.97}, shock: {coal: 1.7, iron: 1.4}, w: 0.6,
    desc: 'Escasez de carbón y hierro: los precios de las materias primas se disparan.'},
  currency: {name: 'Crisis monetaria', icon: '💱', scope: 'country', months: [10, 20], fx: {demand: 0.9, credit: 2.0, invest: 0.7}, legit: -0.7,
    desc: 'La deuda pública es insostenible: los acreedores exigen intereses altísimos y la moneda se hunde.'},
  strike: {name: 'Huelga general', icon: '✊', scope: 'country', months: [4, 8], fx: {ind: 0.82, demand: 0.97}, legit: -0.5, rad: 0.004,
    desc: 'Los obreros paralizan las fábricas y las minas exigiendo reformas.'},
  epidemic: {name: 'Epidemia', icon: '☣️', scope: 'country', months: [4, 9], fx: {demand: 0.96, agri: 0.95}, legit: -0.2, pop: 0.0012,
    desc: 'Una epidemia asola las ciudades y reduce la población y la actividad.'},
  local_famine: {name: 'Hambruna', icon: '💀', scope: 'country', months: [9, 16], fx: {agri: 0.70, demand: 0.95}, legit: -0.6, pop: 0.0020, rad: 0.003,
    desc: 'El hambre mata a miles de personas y desestabiliza al gobierno.'},
  bankruptcy: {name: 'Bancarrota del Estado', icon: '🏦', scope: 'country', months: [12, 24], fx: {demand: 0.85, invest: 0.4, credit: 3}, legit: -1.2, rad: 0.005,
    desc: 'El Estado suspende pagos: se pierde la confianza internacional y la economía se contrae.'},
  aid: {name: 'Plan de estímulo', icon: '💊', scope: 'country', months: [8, 8], fx: {demand: 1.05, invest: 1.2}, w: 0, hidden: true, desc: 'Medidas de apoyo extraordinarias.'}
};

function crisisSeverity(c) { return clamp(1 - (c.mods.crisis || 0), 0.35, 1); }
function addCrisis(typeId, scope, extra) {
  const t = CRISIS_TYPES[typeId];
  if (G.crises.some(c => c.type === typeId && c.scope === scope)) return null;
  const months = Math.round(rnd(t.months[0], t.months[1]));
  const cr = {id: G.nextId++, type: typeId, name: t.name, icon: t.icon, scope, months, left: months, fx: Object.assign({}, t.fx), desc: t.desc, started: Object.assign({}, G.date)};
  if (extra) Object.assign(cr, extra);
  G.crises.push(cr);
  if (t.shock) for (const g in t.shock) { G.pt[g] = (G.pt[g] ?? G.price[g]) * t.shock[g]; G.price[g] *= 1 + (t.shock[g] - 1) * 0.4; }
  const sc = scope === 'global' ? 'el mundo' : G.C[scope].name;
  if (scope === 'global' || scope === G.player) notify('crisis', `${t.icon} ${t.name} en ${sc}: ${t.desc}`);
  else if (!t.hidden) logMsg(`${t.name} en ${sc}.`);
  return cr;
}

function crisisMonth() {
  const dp = diffP();
  // avance y caducidad
  for (let i = G.crises.length - 1; i >= 0; i--) {
    const cr = G.crises[i]; cr.left--;
    const t = CRISIS_TYPES[cr.type];
    if (cr.scope !== 'global') {
      const c = G.C[cr.scope];
      if (t.legit) c.legitimacy = Math.max(0, c.legitimacy + t.legit * (cr.type === 'aid' ? 0 : 1));
      if (t.rad) c.radicals = Math.min(0.9, c.radicals + t.rad);
      if (t.pop) c.states.forEach(id => { const s = G.S[id]; for (const p in s.pops) s.pops[p] *= (1 - t.pop); });
    } else {
      G.tags.forEach(tag => { if (tag !== NONE) G.C[tag].legitimacy -= 0.12; });
    }
    if (cr.left <= 0) {
      G.crises.splice(i, 1);
      if (cr.type === 'panic') G.afterPanic = G.date.t;
      if (cr.scope === 'global' || cr.scope === G.player) { if (cr.type !== 'aid') { notify('crisis', `Termina: ${cr.name}.`); cnt(G.C[G.player], 'crisesEnded'); } }
    }
  }
  // crisis globales aleatorias
  const stress = 1 + Math.max(0, -G.cycle) * 1.2;
  if (Math.random() < 0.05 * dp.crisis * stress && G.crises.filter(c => c.scope === 'global').length < 2) {
    const yr = G.date.y;
    const ok = Object.keys(CRISIS_TYPES).filter(id => {
      const t = CRISIS_TYPES[id]; if (t.scope !== 'global' || !t.w) return false;
      if (G.crises.some(c => c.type === id)) return false;
      if (t.needs === 'afterPanic') return G.afterPanic && G.date.t - G.afterPanic < 365 * 2;
      if (t.needs === 'railways') return G.C[G.rankList[0]].techs.has('railways') || yr > 1850;
      return true;
    });
    if (ok.length) {
      let tot = 0; ok.forEach(id => tot += CRISIS_TYPES[id].w * (id === 'panic' && G.cycle > 0.5 ? 2 : 1));
      let r = Math.random() * tot, chosen = ok[0];
      for (const id of ok) { r -= CRISIS_TYPES[id].w * (id === 'panic' && G.cycle > 0.5 ? 2 : 1); if (r <= 0) { chosen = id; break; } }
      addCrisis(chosen, 'global');
    }
  }
  // hambruna histórica de la patata (1845-1847)
  if (G.date.y === 1845 && G.date.m === 8 && !G.potato) { G.potato = true; ['GBR', 'NET', 'BEL', 'PRU'].forEach(t => { if (G.C[t] && G.C[t].states.length) addCrisis('local_famine', t, {months: 22, left: 22, name: 'Gran Hambruna de la patata'}); }); }
  // crisis nacionales
  G.tags.forEach(t => {
    if (t === NONE) return; const c = G.C[t]; if (!c.states.length) return;
    const income = Math.max(1, c.stats.income);
    const ratio = c.debt / income;
    // contador de legitimidad baja
    c.lowLeg = c.legitimacy < 32 ? (c.lowLeg || 0) + 1 : Math.max(0, (c.lowLeg || 0) - 1);
    if (ratio > 26 * (c.mods.crisis ? 1 + c.mods.crisis : 1) && Math.random() < 0.2) addCrisis('currency', t);
    if (ratio > 70 && !G.crises.some(x => x.type === 'bankruptcy' && x.scope === t)) { addCrisis('bankruptcy', t); c.treasury = 0; c.debt = 0; c.prestige = Math.max(0, c.prestige - 15); c.investPool = 0; }
    if (c.radicals > 0.22 && c.stats.indLevels > 10 && Math.random() < 0.03 * dp.crisis) addCrisis('strike', t);
    if (c.stats.pop > 8e5 && Math.random() < 0.0014 * dp.crisis * (1 - Math.min(0.7, c.mods.grow * 80))) addCrisis('epidemic', t);
    if (c.stats.sol < 6 && Math.random() < 0.006 * dp.crisis) addCrisis('local_famine', t);
    // ciclo recesivo: la inversión de los capitalistas se evapora en las depresiones
    if (G.crises.some(x => x.type === 'depression')) c.investPool *= 0.9;
  });
}

// Respuestas del jugador a las crisis
function respondCrisis(kind) {
  const c = me(); const inc = Math.max(1, c.stats.income);
  const cost = {bailout: inc * 5, stimulus: inc * 3, austerity: 0}[kind];
  if (c.treasury < cost && kind !== 'austerity') return {ok: false, msg: 'No tienes fondos suficientes.'};
  c.treasury -= cost;
  if (kind === 'bailout') {
    G.crises.forEach(cr => { if (['panic', 'currency', 'bankruptcy', 'rail_bubble'].includes(cr.type) && (cr.scope === c.tag || cr.scope === 'global')) cr.left = Math.max(1, Math.round(cr.left * 0.7)); });
    c.investPool += inc * 3; addCrisis('aid', c.tag);
    return {ok: true, msg: 'Rescate bancario aplicado: las crisis financieras serán más cortas.'};
  }
  if (kind === 'stimulus') { addCrisis('aid', c.tag); return {ok: true, msg: 'Plan de estímulo: más demanda e inversión durante 8 meses.'}; }
  if (kind === 'austerity') { c.treasury += inc * 2; c.radicals = Math.min(0.9, c.radicals + 0.03); c.legitimacy -= 3; c.taxLevel = Math.min(4, c.taxLevel + 1); return {ok: true, msg: 'Austeridad: recaudas más, pero aumenta el malestar social.'}; }
  return {ok: false, msg: ''};
}

/* ---------- patrocinio de grupos (boosts) ---------- */
function boostMult(c, ig) { let m = 1; c.boosts.forEach(b => { if (b.kind === 'ig' && b.key === ig) m *= b.mult; }); return m; }
function profBoost(c, p) { return c.pboosts[p] ? c.pboosts[p].mult : 1; }
function sponsorIG(c, ig, mode) {
  const cost = 35, money_ = c.stats.income * 2;
  if (!c.ai && c.influence < cost) return {ok: false, msg: `Necesitas ${cost} de influencia.`};
  if (!c.ai && c.treasury < money_) return {ok: false, msg: 'Fondos insuficientes.'};
  if (c.boosts.filter(b => b.kind === 'ig').length >= 3) return {ok: false, msg: 'Ya hay 3 grupos bajo patrocinio.'};
  if (c.boosts.some(b => b.kind === 'ig' && b.key === ig)) return {ok: false, msg: 'Ese grupo ya está siendo patrocinado o reprimido.'};
  if (!c.ai) { c.influence -= cost; c.treasury -= money_; }
  c.boosts.push({kind: 'ig', key: ig, mult: mode === 'boost' ? 1.45 : 0.55, months: 12, mode});
  if (mode === 'suppress') { c.radicals = Math.min(0.9, c.radicals + 0.01); c.legitimacy -= 1.5; }
  return {ok: true, msg: mode === 'boost' ? `${IGS[ig].name} gana influencia durante 12 meses.` : `${IGS[ig].name} es reprimido durante 12 meses.`};
}
function sponsorProf(c, p, mode) {
  const cost = 25;
  if (!c.ai && c.influence < cost) return {ok: false, msg: `Necesitas ${cost} de influencia.`};
  if (c.pboosts[p]) return {ok: false, msg: 'Ese grupo ya está siendo patrocinado.'};
  if (Object.keys(c.pboosts).length >= 3) return {ok: false, msg: 'Máximo 3 grupos de población patrocinados.'};
  if (!c.ai) c.influence -= cost;
  c.pboosts[p] = {mult: mode === 'boost' ? 1.6 : 0.5, months: 12, mode};
  return {ok: true, msg: `${PROFS[p].name}: ${mode === 'boost' ? 'más peso político' : 'menos peso político'} durante 12 meses.`};
}
// Patrocinar un grupo en otro país (subversión)
function sponsorAbroad(c, tag, ig) {
  const T = G.C[tag]; const cost = 50;
  if (!c.ai && c.influence < cost) return {ok: false, msg: `Necesitas ${cost} de influencia.`};
  if (!alive(tag) || tag === c.tag) return {ok: false, msg: 'Objetivo no válido.'};
  if (T.boosts.some(b => b.kind === 'ig' && b.key === ig)) return {ok: false, msg: 'Ese grupo ya está siendo manipulado.'};
  if (!c.ai) c.influence -= cost;
  T.boosts.push({kind: 'ig', key: ig, mult: 1.5, months: 12, mode: 'boost', source: c.tag});
  const caught = Math.random() < 0.35;
  if (caught) { addRel(c.tag, tag, -35); notify('diplo', `${T.name} descubre que ${c.name} patrocinaba a ${IGS[ig].name} y exige explicaciones.`); }
  return {ok: true, msg: caught ? `${IGS[ig].name} en ${T.name} gana peso, pero tu injerencia ha sido descubierta.` : `${IGS[ig].name} en ${T.name} gana peso político durante 12 meses.`};
}
function decayBoosts(c) {
  c.boosts = c.boosts.filter(b => --b.months > 0);
  for (const p in c.pboosts) if (--c.pboosts[p].months <= 0) delete c.pboosts[p];
}

/* ---------- ideologías y gobierno ---------- */
const IG_PROGRAMS = {
  lands: {power: 'oligarchy', agrarian: 'serfdom', press: 'censorship', economy: 'mercantilism', religion: 'state_religion', tax: 'percapita'},
  indus: {power: 'wealth_voting', economy: 'laissez', labor: 'no_regs', agrarian: 'commercial', migration: 'free_movement', press: 'limited_press'},
  intel: {power: 'wealth_voting', press: 'free_press', education: 'public_edu', religion: 'secular', bonded: 'slavery_banned', agrarian: 'commercial'},
  petty: {power: 'wealth_voting', tax: 'proportional', press: 'limited_press', economy: 'interventionism', migration: 'controlled', education: 'elite_edu'},
  devout: {power: 'oligarchy', religion: 'state_religion', education: 'no_edu', press: 'censorship', migration: 'closed_borders', economy: 'mercantilism'},
  armed: {power: 'autocracy', army: 'conscription', press: 'censorship', migration: 'closed_borders', economy: 'mercantilism', tax: 'proportional'},
  union: {power: 'universal', labor: 'regulated', tax: 'graduated', economy: 'interventionism', education: 'public_edu', agrarian: 'tenant'},
  rural: {agrarian: 'tenant', army: 'peasant_levies', tax: 'proportional', power: 'landed_voting', bonded: 'slavery_banned', labor: 'no_regs'}
};
function govName(c) {
  const pw = c.laws.power, mon = c.monarchy;
  const sh = {}; IG_ORDER.forEach(k => sh[k] = c.ig[k] ? c.ig[k].share : 0);
  const dom = IG_ORDER.slice().sort((a, b) => sh[b] - sh[a])[0];
  switch (pw) {
    case 'autocracy': return mon ? (c.ai || true ? (c.profile === 'eastern' ? 'Despotismo Oriental' : 'Monarquía Absoluta') : 'Monarquía Absoluta') : dom === 'armed' ? 'Dictadura Militar' : dom === 'devout' ? 'Teocracia' : dom === 'union' ? 'Dictadura del Proletariado' : 'Despotismo';
    case 'oligarchy': return dom === 'devout' ? 'Teocracia' : mon ? 'Monarquía Oligárquica' : 'República Oligárquica';
    case 'landed_voting': case 'wealth_voting': return dom === 'union' ? 'República Socialista' : mon ? 'Monarquía Constitucional' : 'República Liberal';
    case 'universal': return dom === 'union' ? 'República Socialista' : mon ? 'Monarquía Parlamentaria' : 'República Democrática';
  }
  return c.gov;
}
function applyProgram(c, ig, force, maxChanges) {
  const prog = IG_PROGRAMS[ig]; let n = 0;
  for (const cat in prog) {
    if (maxChanges && n >= maxChanges) break;
    const opt = LAW[prog[cat]]; if (!opt || c.laws[cat] === opt.id) continue;
    if (!force && opt.tech && !c.techs.has(opt.tech)) continue;
    c.laws[cat] = opt.id; n++;
  }
  recalcMods(c); c.lawChange = null;
  return n;
}
// Probabilidad de cada vía de cambio de gobierno
function transitionOptions(c, ig) {
  const g = c.ig[ig]; const share = g ? g.share : 0; const out = [];
  const demo = ['landed_voting', 'wealth_voting', 'universal'].includes(c.laws.power);
  out.push({kind: 'election', name: 'Convocar elecciones', cost: 40, ok: demo, why: demo ? '' : 'Requiere un sistema con voto', p: clamp((share - 0.10) / 0.22 + 0.1, 0.05, 0.95), desc: 'Cambio pacífico: el grupo adopta parte de su programa.'});
  const armedShare = c.ig.armed ? c.ig.armed.share : 0;
  out.push({kind: 'coup', name: 'Golpe de Estado', cost: 60, ok: ig === 'armed' && armedShare >= 0.05, why: ig === 'armed' ? (armedShare >= 0.05 ? '' : 'Las fuerzas armadas tienen muy poca influencia') : 'Solo el ejército puede dar un golpe', p: clamp(0.15 + armedShare * 1.6 + c.radicals * 0.5 + (c.legitimacy < 40 ? 0.15 : 0), 0.05, 0.9), desc: 'Instaura una dictadura militar con un programa autoritario.'});
  out.push({kind: 'revolution', name: 'Revolución', cost: 80, ok: c.radicals >= 0.14 && ig !== 'armed', why: c.radicals >= 0.14 ? (ig === 'armed' ? 'Usa la vía del golpe' : '') : 'Hay muy pocos radicales (mín. 14%)', p: clamp(0.15 + share * 1.1 + c.radicals * 1.2 + (c.legitimacy < 35 ? 0.15 : 0) - 0.1, 0.05, 0.9), desc: 'Derroca al gobierno: programa completo, gran inestabilidad y posible guerra civil.'});
  return out;
}
function govTransition(c, ig, kind, silent) {
  const opts = transitionOptions(c, ig), o = opts.find(x => x.kind === kind);
  if (!o || !o.ok) return {ok: false, msg: o ? o.why : 'Opción no válida'};
  if (!c.ai && c.influence < o.cost) return {ok: false, msg: `Necesitas ${o.cost} de influencia.`};
  if (!c.ai) c.influence -= o.cost;
  const old = c.gov;
  if (Math.random() > o.p) {
    c.legitimacy -= kind === 'election' ? 3 : 14; c.radicals = Math.min(0.9, c.radicals + (kind === 'election' ? 0.01 : 0.05)); c.prestige = Math.max(0, c.prestige - (kind === 'election' ? 0 : 6));
    if (kind === 'coup' && c.ig.armed) c.ig.armed.approval -= 4;
    return {ok: false, msg: kind === 'election' ? 'Las elecciones no cambian el equilibrio de poder.' : 'El intento fracasa y la represión aumenta el malestar.', failed: true};
  }
  let msg = '';
  if (kind === 'election') { const n = applyProgram(c, ig, false, 3); msg = `Las elecciones dan el poder a ${IGS[ig].name}: ${n} reformas.`; c.legitimacy = Math.min(100, c.legitimacy + 3); }
  else if (kind === 'coup') { applyProgram(c, 'armed', true); c.legitimacy = 48; c.prestige = Math.max(0, c.prestige - 3); c.radicals = Math.min(0.9, c.radicals + 0.03); msg = 'El ejército toma el poder.'; }
  else {
    applyProgram(c, ig, true); c.legitimacy = 50; c.prestige = Math.max(0, c.prestige - 10);
    c.treasury -= c.stats.income * 4; c.investPool *= 0.4; c.radicals = Math.min(0.9, c.radicals * 0.7);
    if (['intel', 'union', 'petty', 'rural'].includes(ig)) c.monarchy = false;
    if (Math.random() < 0.35 && c.states.length > 3) {
      const lost = c.states.filter(id => id !== c.capital).sort(() => Math.random() - 0.5).slice(0, 1 + Math.floor(Math.random() * 2));
      lost.forEach(id => transferState(G.S[id], NONE));
      msg = `La revolución triunfa, pero estalla una guerra civil: ${lost.map(id => G.S[id].name).join(', ')} se independizan.`;
    } else msg = `La revolución de ${IGS[ig].name} triunfa.`;
    G.crises.push({id: G.nextId++, type: 'strike', name: 'Convulsión revolucionaria', icon: '🔥', scope: c.tag, months: 8, left: 8, fx: {ind: 0.9, demand: 0.95}, desc: 'El orden social está alterado tras la revolución.', started: Object.assign({}, G.date)});
  }
  c.ig = c.ig || {}; politics(c);
  c.gov = govName(c);
  c.govHist.push({y: G.date.y, from: old, to: c.gov, kind}); cnt(c, 'govChanges'); if (kind === 'revolution') cnt(c, 'revolutions');
  if (!silent) notify('politics', `${c.name}: ${msg} Nuevo régimen: ${c.gov}.`);
  return {ok: true, msg};
}
// Comprobación mensual de revoluciones espontáneas y golpes
function checkRevolution(c) {
  if (c.tag === NONE) return;
  c.gov = govName(c);
  if (c.lowLeg >= 6 && c.radicals > 0.18 && Math.random() < 0.18) {
    // el grupo opositor con más fuerza y peor aprobación derroca al gobierno
    const opp = IG_ORDER.filter(k => c.ig[k] && !c.ig[k].gov && k !== 'armed').sort((a, b) => (c.ig[b].share * (1 - c.ig[b].approval * 0.1)) - (c.ig[a].share * (1 - c.ig[a].approval * 0.1)))[0];
    if (opp) { c.lowLeg = 0; const old = c.influence; c.influence = 999; const r = govTransition(c, opp, 'revolution', false); c.influence = old; return; }
  }
  if (c.ai && c.ig.armed && c.ig.armed.share > 0.22 && c.legitimacy < 42 && c.laws.power !== 'autocracy' && Math.random() < 0.02) { const old = c.influence; c.influence = 999; govTransition(c, 'armed', 'coup', false); c.influence = old; }
}
function ideologyTable(c) {
  const t = {};
  IG_ORDER.forEach(k => { const g = c.ig[k]; if (!g) return; const id = IGS[k].ideo; t[id] = t[id] || {name: id, share: 0, igs: []}; t[id].share += g.share; t[id].igs.push(k); });
  return Object.values(t).sort((a, b) => b.share - a.share);
}

/* ---------- diplomacia inicial ---------- */
function seedDiplomacy() {
  const mk = (type, a, b) => { if (G.C[a] && G.C[b]) makePact(type, a, b, {forced: true}); };
  mk('alliance', 'GBR', 'POR'); mk('guarantee', 'GBR', 'POR'); mk('trade', 'GBR', 'NET'); mk('trade', 'GBR', 'USA'); mk('trade', 'FRA', 'BEL');
  mk('nonagg', 'RUS', 'PRU'); mk('nonagg', 'AUS', 'PRU'); mk('alliance', 'FRA', 'SPA'); mk('guarantee', 'GBR', 'BEL'); mk('guarantee', 'FRA', 'BEL');
  mk('rival', 'GBR', 'RUS'); mk('rival', 'RUS', 'OTT'); mk('rival', 'FRA', 'GBR'); mk('rival', 'AUS', 'SAR'); mk('rival', 'CHN', 'JAP');
  const bloc = (name, type, leader, members) => { if (!G.C[leader]) return; const r = createBloc(leader, type, name, true); if (r.ok) members.forEach(m => { if (G.C[m] && !G.C[m].bloc) joinBloc(m, r.bloc); }); };
  const sv = G.log.length;
  bloc('Zollverein', 'economic', 'PRU', ['BAV', 'SAX', 'WUR', 'BAD', 'HES']);
  bloc('Santa Alianza', 'political', 'RUS', ['AUS']);
  G.log.length = Math.max(0, G.log.length - (G.log.length - sv)); G.notifs.length = 0;
  G.C.RUS.prestige += 0;
  G.tags.forEach(t => { if (t !== NONE) { const c = G.C[t]; if (c.bloc) c.relations && null; } });
  ['GBR', 'FRA'].forEach(t => { G.C[t].relations.RUS = (G.C[t].relations.RUS || 0) - 25; });
}
