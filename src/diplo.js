/* ===== DIPLOMACIA, CASUS BELLI, ALIANZAS, BLOQUES Y GUERRA ===== */
const INIT_CLAIMS = {PRU: ['BAV', 'SAX', 'HAN', 'WUR', 'BAD', 'HES', 'MEC'], SAR: ['TWS', 'PAP', 'TUS'], AUS: ['SAR'], RUS: ['OTT'], GRE: ['OTT'], SER: ['OTT'], MEX: ['TEX'], FRA: ['BEL'], DEN: [], ARG: ['URU', 'PAR'], BRZ: ['URU'], PER: ['BOL'], CHL: ['BOL'], JAP: ['KOR'], CHN: ['KOR'], PRS: ['AFG']};

// Casus belli. terr: se eligen territorios; max(c): máximo de territorios
const CBS = {
  conquest: {name: 'Conquista', icon: '🏴', cost: 45, perState: 14, terr: true, infamy: 18, desc: 'Guerra de conquista: anexionas los territorios que elijas si vences. Genera mucha infamia.', max: c => clamp(1 + Math.floor(c.prestige / 55), 1, 4)},
  claim: {name: 'Reclamación territorial', icon: '📜', cost: 18, perState: 6, terr: true, infamy: 4, desc: 'Reclama territorios sobre los que tienes derechos (por una reclamación fabricada, histórica o por haberlos perdido).', max: c => 5},
  humiliate: {name: 'Humillación', icon: '😤', cost: 25, perState: 0, terr: false, infamy: 5, desc: 'Obliga al rival a pagar una indemnización y cederte prestigio. No hay anexiones.'},
  regime: {name: 'Cambio de régimen', icon: '🏛️', cost: 40, perState: 0, terr: false, infamy: 10, law: true, desc: 'Impones una ley al país derrotado (por ejemplo, abolir la servidumbre o instaurar el sufragio).'},
  trade: {name: 'Apertura comercial', icon: '🚢', cost: 32, perState: 0, terr: false, infamy: 8, desc: 'Obligas al rival a abrir su mercado: tratado comercial forzoso, indemnización y pérdida de recaudación durante años.'},
  vassal: {name: 'Vasallaje', icon: '👑', cost: 60, perState: 0, terr: false, infamy: 14, need: (a, d) => a.prestige > d.prestige * 1.15 && d.states.length >= 1, desc: 'El país derrotado se convierte en tu vasallo: te paga tributo y sigue tu política exterior.'},
  defense: {name: 'Guerra defensiva', icon: '🛡️', cost: 0, perState: 0, terr: false, infamy: 0, hidden: true, desc: 'Defensa de un aliado o garantizado.'}
};

const PACTS = {
  alliance: {name: 'Alianza', icon: '🤝', mutual: true, cost: 25, years: 0, desc: 'Ambos os apoyáis militarmente si uno de los dos es atacado o entra en guerra con una alianza.'},
  guarantee: {name: 'Garantía de independencia', icon: '🛡️', mutual: false, cost: 15, years: 0, desc: 'Prometes defender a un país si es atacado. Genera buenas relaciones con él.'},
  nonagg: {name: 'Pacto de no agresión', icon: '🕊️', mutual: true, cost: 10, years: 10, desc: 'Ninguno puede declarar la guerra al otro durante 10 años.'},
  trade: {name: 'Tratado comercial', icon: '📦', mutual: true, cost: 10, years: 0, desc: 'Aumenta un 3% los ingresos de ambos y reduce las sanciones comerciales.'},
  embargo: {name: 'Embargo comercial', icon: '🚫', mutual: false, cost: 12, years: 0, desc: 'Sanciona al otro país: su recaudación cae un 4% (más si varios países lo hacen).'},
  subsidy: {name: 'Subsidios', icon: '💸', mutual: false, cost: 8, years: 0, desc: 'Envías dinero semanal al otro país a cambio de mejorar sus relaciones.'},
  rival: {name: 'Rivalidad', icon: '⚔️', mutual: false, cost: 5, years: 0, desc: 'Declaras rival a otro país: las relaciones se deterioran, pero ganas prestigio si lo superas.'}
};
const BLOC_TYPES = {
  military: {name: 'Bloque militar', icon: '⚔️', desc: 'Los miembros se ayudan en las guerras del líder y se defienden entre sí. +5% de ejército a los miembros.'},
  economic: {name: 'Unión económica', icon: '💱', desc: 'Mercado común: +4% de ingresos para todos los miembros y menos sanciones.'},
  political: {name: 'Liga ideológica', icon: '🗳️', desc: 'Los miembros comparten ideales: +1 de estabilidad, menos radicalismo y mejor relación entre sí.'}
};
const BLOC_COLORS = ['#d26a5a', '#5a9ad2', '#7ac26a', '#d2b05a', '#a07ad2', '#5ad2c2', '#d27aa8', '#c28a5a'];

/* ---------- utilidades ---------- */
const relOf = (a, b) => (G.C[a].relations[b] ?? 0);
function addRel(a, b, v) {
  const A = G.C[a], B = G.C[b]; if (!A || !B || a === NONE || b === NONE) return;
  A.relations[b] = clamp((A.relations[b] ?? 0) + v, -100, 100);
  B.relations[a] = clamp((B.relations[a] ?? 0) + v, -100, 100);
}
function alive(tag) { return tag !== NONE && G.C[tag] && G.C[tag].states.length > 0; }
function pactsOf(tag) { return G.pacts.filter(p => p.a === tag || p.b === tag); }
function pactBetween(type, a, b) { return G.pacts.find(p => p.type === type && ((p.a === a && p.b === b) || (PACTS[type].mutual && p.a === b && p.b === a))); }
function anyPactBetween(a, b, types) { return G.pacts.find(p => types.includes(p.type) && ((p.a === a && p.b === b) || (p.a === b && p.b === a))); }
function allies(tag) { return G.pacts.filter(p => p.type === 'alliance' && (p.a === tag || p.b === tag)).map(p => p.a === tag ? p.b : p.a); }
function guaranteedBy(tag) { return G.pacts.filter(p => p.type === 'guarantee' && p.b === tag).map(p => p.a); }
function blocOf(tag) { const c = G.C[tag]; return c && c.bloc ? G.blocs.find(b => b.id === c.bloc) : null; }
function atWarWith(a, b) { return G.wars.some(w => (w.attAll.includes(a) && w.defAll.includes(b)) || (w.attAll.includes(b) && w.defAll.includes(a))); }
function inWar(tag) { return G.C[tag].wars.length > 0; }
function pactDays(p) { return (G.date.y - p.since.y) * 12 + (G.date.m - p.since.m); }
function armyPower(c) { return c.stats.soldiers * (1 + c.mods.army + blocArmyBonus(c)) * (0.8 + 0.4 * c.milFund) * (1 + c.lit / 400); }
function blocArmyBonus(c) { const b = blocOf(c.tag); return b && b.type === 'military' ? 0.05 : 0; }
function blocEconBonus(c) { const b = blocOf(c.tag); return b && b.type === 'economic' ? 0.04 : 0; }
function diploIncomeBonus(c) {
  let t = 0; G.pacts.forEach(p => { if (p.type === 'trade' && (p.a === c.tag || p.b === c.tag)) t += 0.03; });
  return Math.min(0.09, t) + blocEconBonus(c);
}
// Flujos de dinero entre países: subsidios, tributo y costes de guerra. Devuelve el gasto del país.
function pactMoneyFlows(c) {
  let out = 0; const inc = c.stats.income;
  G.pacts.forEach(p => { if (p.type === 'subsidy' && p.a === c.tag) { const amt = inc * 0.02 * (p.level || 1); out += amt; G.C[p.b].treasury += amt; } });
  if (c.overlord && G.C[c.overlord]) { const amt = inc * 0.12; out += amt; G.C[c.overlord].treasury += amt; }
  if (c.wars.length) out += inc * 0.05 * Math.min(2, c.wars.length);
  return out;
}

function stateCenterLL(s) { return stateCenter(s); }
function distBetween(a, b) { return distStates(a, b); }
function minDist(A, B) {
  let min = 1e9, border = false;
  A.states.forEach(i => B.states.forEach(j => { if (G.S[i].neigh.includes(j)) border = true; const d = distStates(G.S[i], G.S[j]); if (d < min) min = d; }));
  return {min, border};
}
function reachRange(c) { return c.rank <= 6 ? 42 : c.rank <= 14 ? 24 : 14; }
function canReach(a, b) {
  const A = G.C[a], B = G.C[b]; if (!A.states.length || !B.states.length) return false;
  const m = minDist(A, B);
  return m.border || m.min < reachRange(A);
}
// Estados del rival que se pueden reclamar en una guerra
function reachableStates(a, b) {
  const A = G.C[a], B = G.C[b]; const out = [];
  const R = reachRange(A);
  B.states.forEach(j => {
    const s = G.S[j]; let best = 1e9, border = false;
    A.states.concat(allies(a).flatMap(t => G.C[t].states)).forEach(i => { if (G.S[i].neigh.includes(j)) border = true; const d = distStates(G.S[i], s); if (d < best) best = d; });
    if (border || (MAP.stats[j].coast > 20 && best < R)) out.push({id: j, d: best, border});
  });
  return out.sort((x, y) => (y.border - x.border) || x.d - y.d);
}
function stateWeight(sid) { return 1 + G.S[sid].popBase / 6000; }
function claimedStates(c, victim) { return reachableStates(c.tag, victim).filter(x => c.claims.some(cl => cl.state === x.id)); }
function hasClaim(c, sid) { return c.claims.some(cl => cl.state === sid); }

/* ---------- opciones de guerra ---------- */
function cbAvailable(attTag, defTag, cbId) {
  const A = G.C[attTag], D = G.C[defTag], cb = CBS[cbId];
  if (cb.hidden) return {ok: false, why: 'Solo defensiva'};
  if (cb.need && !cb.need(A, D)) return {ok: false, why: 'No cumples los requisitos'};
  if (cbId === 'claim' && !claimedStates(A, defTag).length) return {ok: false, why: 'No tienes reclamaciones alcanzables sobre este país'};
  if (cb.terr && !reachableStates(attTag, defTag).length) return {ok: false, why: 'Sin territorios alcanzables'};
  return {ok: true};
}
function warCost(attTag, targets, cbId) {
  const cb = CBS[cbId]; let c = cb.cost;
  (targets || []).forEach(sid => c += cb.perState * stateWeight(sid));
  return Math.round(c);
}
function warBlockers(attTag, defTag) {
  const A = G.C[attTag], D = G.C[defTag];
  if (!D || !D.states.length || defTag === NONE) return 'Objetivo no válido';
  if (attTag === defTag) return 'No puedes atacarte a ti mismo';
  if (atWarWith(attTag, defTag)) return 'Ya estáis en guerra';
  if (A.overlord) return 'Un vasallo no puede declarar guerras';
  if (A.overlord === defTag || D.overlord === attTag) return 'Es tu vasallo/soberano';
  if (pactBetween('alliance', attTag, defTag)) return 'Es tu aliado. Rompe la alianza primero';
  if (pactBetween('nonagg', attTag, defTag)) return 'Pacto de no agresión vigente';
  if (A.bloc && A.bloc === D.bloc) return 'Pertenecéis al mismo bloque';
  if (!canReach(attTag, defTag)) return 'No hay un frente alcanzable';
  return null;
}

function declareWar(attTag, defTag, cbId, targets, opts) {
  opts = opts || {}; cbId = cbId || 'humiliate'; targets = (targets || []).slice();
  const A = G.C[attTag], D = G.C[defTag], cb = CBS[cbId];
  const block = warBlockers(attTag, defTag); if (block) return {ok: false, msg: block};
  const av = cbAvailable(attTag, defTag, cbId); if (!av.ok && !opts.free) return {ok: false, msg: av.why};
  if (cb.terr) {
    const valid = new Set(reachableStates(attTag, defTag).map(x => x.id));
    targets = targets.filter(t => valid.has(t) && (cbId !== 'claim' || hasClaim(A, t)));
    if (!targets.length) return {ok: false, msg: 'Elige al menos un territorio válido.'};
    if (targets.length > cb.max(A)) targets = targets.slice(0, cb.max(A));
  }
  const cost = opts.free ? 0 : warCost(attTag, targets, cbId);
  if (!opts.free && !A.ai && A.influence < cost) return {ok: false, msg: `Necesitas ${cost} de influencia.`};
  if (!A.ai && !opts.free) A.influence -= cost;
  else if (!opts.free) A.influence = Math.max(0, A.influence - cost * 0.5);
  if (cbId === 'regime' && !opts.law) opts.law = {cat: 'agrarian', opt: 'tenant'};
  const w = {id: G.nextWarId++, att: attTag, def: defTag, cb: cbId, targets, cTargets: [], score: 0, weeks: 0, attAll: [attTag], defAll: [defTag], law: opts.law || null,
    name: `${cb.name}: ${A.name} contra ${D.name}`, pa: 0, pd: 0, start: Object.assign({}, G.date)};
  // contra-objetivos del defensor: estados fronterizos del atacante
  if (cb.terr || cbId === 'vassal') {
    const back = reachableStates(defTag, attTag).slice(0, Math.max(1, targets.length)); w.cTargets = back.map(x => x.id);
  }
  G.wars.push(w);
  A.wars.push(w.id); D.wars.push(w.id);
  A.infamy += cb.infamy * (1 + targets.length * 0.3);
  addRel(attTag, defTag, -100);
  recruitSides(w);
  prepareFronts(w);
  const base = `¡${A.name} declara la guerra a ${D.name}! (${cb.name})`;
  notify('war', base, targets[0] ?? G.C[defTag].capital);
  return {ok: true, war: w};
}

function recruitSides(w) {
  const A = G.C[w.att], D = G.C[w.def];
  const tryJoin = (tag, side, p) => {
    if (!alive(tag) || w.attAll.includes(tag) || w.defAll.includes(tag)) return;
    if (G.C[tag].wars.length >= 2) return;
    if (side === 'att' && w.defAll.some(x => anyPactBetween(tag, x, ['alliance', 'nonagg']))) return;
    if (side === 'def' && w.attAll.some(x => anyPactBetween(tag, x, ['alliance']))) return;
    const C = G.C[tag];
    if (Math.random() < p || (!C.ai)) {
      (side === 'att' ? w.attAll : w.defAll).push(tag); C.wars.push(w.id);
      if (tag === G.player) notify('war', `Tu país entra en la guerra del lado de ${side === 'att' ? A.name : D.name}.`);
      else logMsg(`${C.name} se une a la guerra del lado de ${side === 'att' ? A.name : D.name}.`);
    }
  };
  const callers = (lead, side) => {
    allies(lead).forEach(t => tryJoin(t, side, side === 'def' ? 0.88 : 0.7 + relOf(lead, t) / 300));
    const b = blocOf(lead);
    if (b && b.type === 'military') b.members.forEach(t => t !== lead && tryJoin(t, side, 0.75));
    if (b && b.type === 'military' && b.leader === lead) {}
    if (side === 'def') guaranteedBy(lead).forEach(t => tryJoin(t, 'def', 0.7));
    G.C[lead].subjects?.forEach(t => tryJoin(t, side, 1));
  };
  callers(w.att, 'att'); callers(w.def, 'def');
  // el líder de un bloque militar es arrastrado por sus miembros
  [[w.att, 'att'], [w.def, 'def']].forEach(([lead, side]) => { const b = blocOf(lead); if (b && b.type === 'military' && b.leader !== lead) tryJoin(b.leader, side, 0.8); });
}

/* ---------- frentes y ocupación ---------- */
function prepareFronts(w) {
  const sideTags = (list) => new Set(list);
  w.targets.forEach(sid => { if (typeof computeFrontRank === 'function') computeFrontRank(sid, sideTags(w.attAll)); });
  w.cTargets.forEach(sid => { if (typeof computeFrontRank === 'function') computeFrontRank(sid, sideTags(w.defAll)); });
}
function setOcc(sid, frac, by, changed) {
  const s = G.S[sid]; if (!s) return;
  const f = Math.round(frac * 100) / 100;
  if ((s.occ || 0) !== f || s.occBy !== by) { s.occ = f; s.occBy = f > 0 ? by : null; changed.add(sid); }
}
function updateOccupation(w, changed) {
  const n = w.targets.length || 1, p = Math.max(0, w.score) / 100;
  w.targets.forEach((sid, i) => setOcc(sid, clamp(p * n - i, 0, 1), w.att, changed));
  const m = w.cTargets.length || 1, q = Math.max(0, -w.score) / 100;
  w.cTargets.forEach((sid, i) => setOcc(sid, clamp(q * m - i, 0, 1), w.def, changed));
}
function clearOccupation(w) {
  const ch = new Set();
  w.targets.concat(w.cTargets).forEach(sid => setOcc(sid, 0, null, ch));
  if (typeof onFrontChanged === 'function') onFrontChanged(ch);
}
function sidePower(list, def) {
  let p = 0, lg = 0, df = 0;
  list.forEach(t => { const c = G.C[t]; p += armyPower(c); lg += c.mods.logistics; df += c.mods.defense; });
  const n = Math.max(1, list.length);
  return {p, lg: lg / n, df: df / n};
}
// Avance semanal de todas las guerras
function warWeek() {
  const changed = new Set();
  for (let i = G.wars.length - 1; i >= 0; i--) {
    const w = G.wars[i];
    const A = sidePower(w.attAll), D = sidePower(w.defAll);
    const pa = A.p * (1 + A.lg * 0.5), pd = D.p * 1.1 * (1 + D.df);
    w.pa = Math.round(pa); w.pd = Math.round(pd);
    const diff = (pa - pd) / Math.max(1, pa + pd);
    w.score = clamp(w.score + diff * 4.4 + rnd(-1.4, 1.4), -100, 100);
    w.weeks++;
    // desgaste: bajas y cansancio de guerra
    w.attAll.concat(w.defAll).forEach(t => { const c = G.C[t]; c.radicals = Math.min(0.9, c.radicals + 0.0012); });
    w.defAll.concat(w.attAll).forEach(t => { const c = G.C[t]; const s = G.S[c.states[0]]; if (s && s.pops.soldiers) s.pops.soldiers *= 0.9994; });
    updateOccupation(w, changed);
    const humans = [w.att, w.def].some(t => !G.C[t].ai);
    const dead = !alive(w.att) || !alive(w.def);
    if (dead) { endWar(w, alive(w.att) ? w.att : w.def); continue; }
    if (Math.abs(w.score) >= 100 && !humans) endWar(w, w.score > 0 ? w.att : w.def);
    else if (Math.abs(w.score) >= 100 && humans) { /* los humanos deciden la paz */ }
    else if (!humans && w.weeks > 30 && Math.abs(w.score) > 55) endWar(w, w.score > 0 ? w.att : w.def);
    else if (!humans && w.weeks > 90) endWar(w, null);
    else if (humans && w.weeks > 120 && Math.abs(w.score) < 25) endWar(w, null);
  }
  if (changed.size && typeof onFrontChanged === 'function') onFrontChanged(changed);
}

/* ---------- paz y resultado ---------- */
function peaceOptions(w, tag) {
  const att = w.attAll.includes(tag); const sc = att ? w.score : -w.score;
  return {sc, label: sc > 30 ? 'Imponer la paz' : sc < -30 ? 'Pedir la paz' : 'Paz blanca'};
}
function makePeace(w) {
  const player = G.player; const mine = w.attAll.includes(player);
  const sc = mine ? w.score : -w.score;
  if (sc > 30) endWar(w, mine ? w.att : w.def);
  else if (sc < -30) endWar(w, mine ? w.def : w.att);
  else if (Math.random() < 0.55 + Math.abs(sc) / 200 || w.weeks > 40) endWar(w, null);
  else toast('🕊️', 'El enemigo rechaza la paz blanca. Insiste más adelante.');
}
function endWar(w, winner) {
  const idx = G.wars.indexOf(w); if (idx >= 0) G.wars.splice(idx, 1);
  clearOccupationKeep(w);
  w.attAll.concat(w.defAll).forEach(t => { const c = G.C[t]; c.wars = c.wars.filter(x => x !== w.id); });
  const A = G.C[w.att], D = G.C[w.def];
  if (winner === null) {
    notify('war', `${A.name} y ${D.name} firman una paz blanca.`);
    addRel(w.att, w.def, 25); return;
  }
  const attWins = winner === w.att;
  const cb = CBS[w.cb];
  const occ = {};
  if (attWins) {
    const full = Math.abs(w.score) >= 85;
    let gained = [];
    if (cb.terr) {
      w.targets.forEach(sid => { const s = G.S[sid]; if (s && s.owner === w.def && (full || (s.occ || 0) >= 0.5 || w.score >= 60)) { transferState(s, w.att); gained.push(s.name); } });
      A.prestige += 6 + gained.length * 4; cnt(A, 'statesGained', gained.length);
    } else if (w.cb === 'humiliate') {
      const ind = Math.min(Math.max(0, D.treasury), D.stats.income * 8); D.treasury -= ind; A.treasury += ind;
      A.prestige += 12; D.prestige = Math.max(0, D.prestige - 12);
    } else if (w.cb === 'regime' && w.law) {
      D.laws[w.law.cat] = w.law.opt; recalcMods(D); D.legitimacy -= 12; D.radicals = Math.min(0.9, D.radicals + 0.08); A.prestige += 8;
    } else if (w.cb === 'trade') {
      const ind = Math.min(Math.max(0, D.treasury), D.stats.income * 5); D.treasury -= ind; A.treasury += ind;
      D.tradeLoss = Math.min(0.25, (D.tradeLoss || 0) + 0.06); makePact('trade', w.att, w.def, {forced: true}); A.prestige += 8;
    } else if (w.cb === 'vassal') {
      makeSubject(w.att, w.def); A.prestige += 15; cnt(A, 'vassalsMade');
    }
    D.prestige = Math.max(0, D.prestige - 8); D.legitimacy -= 4; cnt(A, 'warsWon'); if (w.cb === 'humiliate') cnt(A, 'humiliations');
    notify('war', `${A.name} ha vencido a ${D.name}${gained.length ? ' y se anexiona ' + gained.join(', ') : ' (' + cb.name + ')'}.`, w.targets[0]);
    // aliados del vencedor ganan prestigio
    w.attAll.forEach(t => { if (t !== w.att) G.C[t].prestige += 3; });
    addRel(w.att, w.def, 20);
  } else {
    const ind = Math.min(Math.max(0, A.treasury), A.stats.income * 4); A.treasury -= ind; D.treasury += ind;
    D.prestige += 8; A.prestige = Math.max(0, A.prestige - 10); A.legitimacy -= 5;
    const regained = [];
    w.cTargets.forEach(sid => { const s = G.S[sid]; if (s && s.owner === w.att && ((s.occ || 0) >= 0.5 || w.score <= -70)) { transferState(s, w.def); regained.push(s.name); } });
    notify('war', `${D.name} ha repelido la invasión de ${A.name}${regained.length ? ' y se anexiona ' + regained.join(', ') : ''}.`, w.cTargets[0] ?? w.targets[0]);
    addRel(w.att, w.def, 10); cnt(D, 'defended'); cnt(D, 'warsWon'); cnt(D, 'statesGained', regained.length);
  }
  G.tags.forEach(t => { if (t !== NONE) G.C[t].legitimacy = clamp(G.C[t].legitimacy, 0, 100); });
}
function clearOccupationKeep(w) {
  const ch = new Set();
  w.targets.concat(w.cTargets).forEach(sid => { const s = G.S[sid]; if (s && (s.occ || 0) > 0) setOcc(sid, 0, null, ch); });
  if (ch.size && typeof onFrontChanged === 'function') onFrontChanged(ch);
}

/* ---------- vasallos ---------- */
function makeSubject(over, sub) {
  const O = G.C[over], S = G.C[sub];
  S.overlord = over; O.subjects = (O.subjects || []).concat([sub]);
  if (S.bloc) leaveBloc(sub, true);
  G.pacts = G.pacts.filter(p => !(p.type === 'alliance' && (p.a === sub || p.b === sub) && !p.forced));
  addRel(over, sub, 30);
  notify('diplo', `${S.name} se convierte en vasallo de ${O.name}.`);
}
function releaseSubject(over, sub) {
  const O = G.C[over], S = G.C[sub]; if (S.overlord !== over) return;
  S.overlord = null; O.subjects = (O.subjects || []).filter(x => x !== sub); addRel(over, sub, 20);
  notify('diplo', `${S.name} es liberado por ${O.name}.`);
}
function annexSubject(over, sub) {
  const O = G.C[over], S = G.C[sub];
  if (S.overlord !== over) return {ok: false, msg: 'No es tu vasallo.'};
  if (!O.ai && O.influence < 80) return {ok: false, msg: 'Necesitas 80 de influencia.'};
  if (!O.ai) O.influence -= 80;
  S.states.slice().forEach(id => transferState(G.S[id], over));
  O.subjects = (O.subjects || []).filter(x => x !== sub); S.overlord = null;
  O.prestige += 6; notify('diplo', `${O.name} anexiona a su vasallo ${S.name}.`);
  return {ok: true};
}

/* ---------- pactos ---------- */
// Probabilidad de que un país acepte una propuesta
function acceptChance(type, from, to, level) {
  const F = G.C[from], T = G.C[to]; const reasons = [];
  if (!alive(to)) return {p: 0, reasons: ['El país ya no existe']};
  if (T.overlord && T.overlord !== from && type !== 'trade') return {p: 0, reasons: ['Es vasallo de otro país']};
  let s = relOf(to, from);
  reasons.push(`Relaciones: ${sgn(s, 0)}`);
  const pf = armyPower(F), pt = armyPower(T);
  const ratio = pf / Math.max(1, pt);
  const commonEnemy = G.wars.some(w => (w.attAll.includes(from) && w.attAll.includes(to)) || (w.defAll.includes(from) && w.defAll.includes(to)));
  if (commonEnemy) { s += 20; reasons.push('Enemigo común: +20'); }
  if (F.profile === T.profile) { s += 6; reasons.push('Regímenes afines: +6'); }
  if (F.infamy > 30) { s -= F.infamy * 0.4; reasons.push('Infamia: ' + sgn(-F.infamy * 0.4, 0)); }
  if (atWarWith(from, to)) return {p: 0, reasons: ['Estáis en guerra']};
  if (type === 'rival' || type === 'embargo') return {p: 1, reasons: []};
  let th = 0;
  switch (type) {
    case 'alliance': th = 35; if (ratio < 0.35) { th += 15; reasons.push('Eres demasiado débil: +15 exigido'); } if (T.rank < F.rank - 6) { th -= 5; } if (inWar(to) && !commonEnemy) { th += 10; } break;
    case 'guarantee': th = pt < pf ? -10 : 15; break;
    case 'nonagg': th = 5; break;
    case 'trade': th = 0; break;
    case 'subsidy': th = -40; break;
  }
  if (anyPactBetween(from, to, ['rival']) || pactBetween('rival', to, from)) { s -= 40; reasons.push('Rivalidad: −40'); }
  const p = clamp(0.5 + (s - th) / 60, 0, 0.97);
  return {p, reasons, th};
}
function makePact(type, a, b, opts) {
  opts = opts || {};
  if (pactBetween(type, a, b)) return null;
  const def = PACTS[type];
  const p = {id: G.nextId++, type, a, b, since: {y: G.date.y, m: G.date.m}, until: def.years ? {y: G.date.y + def.years, m: G.date.m} : null, level: opts.level || 1, forced: !!opts.forced};
  G.pacts.push(p);
  const bonus = {alliance: 25, guarantee: 15, nonagg: 8, trade: 12, subsidy: 12, embargo: -35, rival: -20}[type] || 0;
  addRel(a, b, bonus);
  if (type === 'embargo') recalcTradeLoss();
  return p;
}
function breakPact(id, by) {
  const i = G.pacts.findIndex(p => p.id === id); if (i < 0) return;
  const p = G.pacts[i]; G.pacts.splice(i, 1);
  const other = p.a === by ? p.b : p.a;
  if (by && !p.forced && ['alliance', 'guarantee', 'nonagg', 'trade'].includes(p.type)) { addRel(by, other, -25); if (G.C[by]) G.C[by].prestige = Math.max(0, G.C[by].prestige - 2); }
  if (p.type === 'embargo') recalcTradeLoss();
  return p;
}
function recalcTradeLoss() {
  G.tags.forEach(t => { const c = G.C[t]; let loss = 0; G.pacts.forEach(p => { if (p.type === 'embargo' && p.b === t) loss += 0.04 * (G.C[p.a].rank <= 8 ? 1.4 : 1); }); c.tradeLoss = Math.min(0.25, loss + (c.forcedLoss || 0)); });
}
// Propuesta del jugador: se paga influencia, la IA decide
function playerProposePact(type, to, level) {
  const me_ = G.C[G.player], def = PACTS[type];
  if (me_.influence < def.cost) return {ok: false, msg: `Necesitas ${def.cost} de influencia.`};
  if (pactBetween(type, G.player, to) || (def.mutual && pactBetween(type, to, G.player))) return {ok: false, msg: 'Ya existe este acuerdo.'};
  if (type === 'alliance' && me_.overlord) return {ok: false, msg: 'Un vasallo no puede aliarse.'};
  const r = acceptChance(type, G.player, to, level);
  me_.influence -= def.cost;
  if (type === 'embargo' || type === 'rival') { makePact(type, G.player, to); return {ok: true, msg: `${def.name} establecido contra ${G.C[to].name}.`}; }
  if (Math.random() < r.p) { const p = makePact(type, G.player, to, {level}); cnt(me_, 'pactsMade'); return {ok: true, msg: `${G.C[to].name} acepta: ${def.name}.`, pact: p}; }
  return {ok: false, msg: `${G.C[to].name} rechaza la propuesta de ${def.name.toLowerCase()}.`};
}

/* ---------- reclamaciones ---------- */
function startFabricate(c, sid) {
  if (c.fabricating) return {ok: false, msg: 'Ya estás fabricando una reclamación.'};
  if (hasClaim(c, sid)) return {ok: false, msg: 'Ya tienes una reclamación sobre ese estado.'};
  const s = G.S[sid]; if (s.owner === c.tag || s.owner === NONE) return {ok: false, msg: 'Estado no válido.'};
  if (!c.ai && c.influence < 30) return {ok: false, msg: 'Necesitas 30 de influencia.'};
  if (!c.ai) c.influence -= 30;
  c.fabricating = {state: sid, months: 6};
  return {ok: true};
}
function stepFabricate(c) {
  if (!c.fabricating) return;
  if (--c.fabricating.months > 0) return;
  const sid = c.fabricating.state; c.fabricating = null;
  const s = G.S[sid]; if (!s || s.owner === c.tag) return;
  if (!hasClaim(c, sid)) c.claims.push({state: sid, perm: false});
  if (G.C[s.owner]) addRel(c.tag, s.owner, -12);
  if (c.tag === G.player) notify('diplo', `Reclamación fabricada sobre ${s.name}.`, sid);
}
function initClaims() {
  for (const tag in INIT_CLAIMS) {
    const c = G.C[tag]; if (!c) continue;
    INIT_CLAIMS[tag].forEach(ot => { const o = G.C[ot]; if (o) o.states.forEach(id => { if (!hasClaim(c, id)) c.claims.push({state: id, perm: true}); }); });
  }
}

/* ---------- bloques ---------- */
function blocMax(c) { return 3 + Math.floor(c.prestige / 40); }
function createBloc(tag, type, name, force) {
  const c = G.C[tag];
  if (c.bloc) return {ok: false, msg: 'Ya perteneces a un bloque.'};
  if (c.overlord) return {ok: false, msg: 'Un vasallo no puede liderar un bloque.'};
  if (!force && c.prestige < 30) return {ok: false, msg: 'Necesitas al menos 30 de prestigio.'};
  if (!force && !c.ai && c.influence < 60) return {ok: false, msg: 'Necesitas 60 de influencia.'};
  if (!force && !c.ai) c.influence -= 60;
  const b = {id: G.nextId++, name: name || (BLOC_TYPES[type].name + ' de ' + c.adj), type, leader: tag, members: [tag], founded: Object.assign({}, G.date), color: BLOC_COLORS[G.blocs.length % BLOC_COLORS.length]};
  G.blocs.push(b); c.bloc = b.id;
  notify('diplo', `${c.name} funda el bloque «${b.name}».`);
  return {ok: true, bloc: b};
}
function joinBloc(tag, b) {
  const c = G.C[tag]; if (c.bloc) return;
  b.members.push(tag); c.bloc = b.id;
  b.members.forEach(m => { if (m !== tag) addRel(m, tag, 18); });
  notify('diplo', `${c.name} ingresa en el bloque «${b.name}».`);
}
function leaveBloc(tag, silent) {
  const c = G.C[tag]; const b = blocOf(tag); if (!b) return;
  b.members = b.members.filter(m => m !== tag); c.bloc = null;
  if (!silent) { b.members.forEach(m => addRel(m, tag, -15)); c.prestige = Math.max(0, c.prestige - 2); notify('diplo', `${c.name} abandona el bloque «${b.name}».`); }
  if (b.leader === tag) {
    if (b.members.length) { b.leader = b.members.slice().sort((x, y) => G.C[y].prestige - G.C[x].prestige)[0]; }
    else G.blocs = G.blocs.filter(x => x !== b);
  }
  if (b.members.length === 1 && !G.C[b.members[0]].bloc === false) { /* un bloque de un solo país persiste */ }
}
function dissolveBloc(b) { b.members.slice().forEach(m => { G.C[m].bloc = null; }); G.blocs = G.blocs.filter(x => x !== b); notify('diplo', `El bloque «${b.name}» se disuelve.`); }
function blocInviteChance(b, tag) {
  const c = G.C[tag], L = G.C[b.leader];
  if (c.bloc) return {p: 0, why: 'Ya está en otro bloque'};
  if (c.overlord && c.overlord !== b.leader) return {p: 0, why: 'Es vasallo de otro país'};
  if (b.members.length >= blocMax(L)) return {p: 0, why: 'El bloque está lleno'};
  if (b.members.some(m => atWarWith(m, tag))) return {p: 0, why: 'En guerra con un miembro'};
  let s = relOf(tag, b.leader) + (G.C[tag].profile === L.profile ? 8 : 0) - (c.prestige > L.prestige ? 20 : 0);
  if (b.members.some(m => pactBetween('rival', m, tag) || pactBetween('rival', tag, m))) s -= 30;
  if (pactBetween('alliance', b.leader, tag)) s += 20;
  return {p: clamp(0.4 + (s - 25) / 60, 0.02, 0.95), why: `Relación ${sgn(s, 0)}`};
}
function playerInviteBloc(tag) {
  const b = blocOf(G.player); if (!b || b.leader !== G.player) return {ok: false, msg: 'Solo el líder puede invitar.'};
  const c = me(); if (c.influence < 20) return {ok: false, msg: 'Necesitas 20 de influencia.'};
  const r = blocInviteChance(b, tag); c.influence -= 20;
  if (Math.random() < r.p) { joinBloc(tag, b); return {ok: true, msg: `${G.C[tag].name} acepta unirse al bloque.`}; }
  return {ok: false, msg: `${G.C[tag].name} rechaza la invitación.`};
}

/* ---------- IA diplomática mensual ---------- */
function diploMonth() {
  // relaciones: decaimiento hacia 0, efectos de pactos, infamia y rivalidades
  G.tags.forEach(t => {
    if (t === NONE) return; const c = G.C[t];
    for (const o in c.relations) { let r = c.relations[o]; r *= 0.985; c.relations[o] = r; }
    c.infamy = Math.max(0, c.infamy - 0.7);
  });
  G.pacts.forEach(p => {
    if (!G.C[p.a] || !G.C[p.b]) return;
    const bonus = {alliance: 0.8, guarantee: 0.5, nonagg: 0.2, trade: 0.4, subsidy: 0.8, embargo: -1.2, rival: -1}[p.type] || 0;
    addRel(p.a, p.b, bonus);
  });
  G.blocs.forEach(b => { b.members.forEach(m => b.members.forEach(n => { if (m < n) addRel(m, n, 0.3); })); G.C[b.leader].prestige += 0.15 * b.members.length; });
  G.tags.forEach(t => { if (t !== NONE && G.C[t].infamy > 25) { const c = G.C[t]; G.tags.forEach(o => { if (o !== NONE && o !== t) { const C2 = G.C[o]; C2.relations[t] = clamp((C2.relations[t] ?? 0) - c.infamy / 90, -100, 100); } }); } });
  // caducidad de pactos y condiciones
  for (let i = G.pacts.length - 1; i >= 0; i--) {
    const p = G.pacts[i];
    if (!alive(p.a) || !alive(p.b)) { G.pacts.splice(i, 1); continue; }
    if (p.until && (G.date.y > p.until.y || (G.date.y === p.until.y && G.date.m >= p.until.m))) { G.pacts.splice(i, 1); if (p.a === G.player || p.b === G.player) notify('diplo', `Ha caducado: ${PACTS[p.type].name} entre ${G.C[p.a].name} y ${G.C[p.b].name}.`); }
    else if (['alliance', 'guarantee', 'trade', 'nonagg'].includes(p.type) && relOf(p.a, p.b) < -40 && !p.forced && Math.random() < 0.3) {
      G.pacts.splice(i, 1); if (p.a === G.player || p.b === G.player) notify('diplo', `${PACTS[p.type].name} roto por el deterioro de relaciones.`);
    }
  }
  recalcTradeLoss();
  G.tags.forEach(t => { if (t !== NONE) stepFabricate(G.C[t]); });
  // propuestas pendientes caducan
  G.proposals = G.proposals.filter(pp => G.date.t - pp.t < 180 && alive(pp.from));
  // IA
  G.tags.forEach(t => {
    const c = G.C[t]; if (t === NONE || !c.ai || !c.states.length) return;
    if (Math.random() < 0.14) aiDiploAction(c);
    if (c.bloc) aiBlocAction(c);
    else if (!c.overlord && c.rank <= 10 && c.prestige >= 30 && Math.random() < 0.015) createBloc(t, pick(['military', 'economic', 'political']));
    if (!c.fabricating && Math.random() < 0.015 && c.rank <= 18) aiFabricate(c);
    // vasallos pueden independizarse o ser anexionados por IA
    if (c.subjects && c.subjects.length && Math.random() < 0.04) { const sb = pick(c.subjects); if (G.C[sb].ai || true) { if (c.ai && Math.random() < 0.3 && sb !== G.player) annexSubject(t, sb); } }
  });
  // vasallo rebelde si el soberano se debilita
  G.tags.forEach(t => { const c = G.C[t]; if (c && c.overlord && G.C[c.overlord].rank > c.rank + 10 && Math.random() < 0.05) releaseSubject(c.overlord, t); });
  aiWarsNew();
}
function aiCandidates(c, n) {
  const out = G.tags.filter(o => o !== NONE && o !== c.tag && alive(o) && G.C[o].rank <= 40).map(o => ({o, s: relOf(c.tag, o) + (canReach(c.tag, o) ? 12 : 0) + (G.C[o].profile === c.profile ? 5 : 0) + rnd(-12, 12)})).sort((a, b) => b.s - a.s);
  return out.slice(0, n).map(x => x.o);
}
function aiDiploAction(c) {
  const cand = aiCandidates(c, 5); if (!cand.length) return;
  const o = pick(cand);
  const w = [['trade', 5], ['nonagg', 2.5], ['alliance', 2.2], ['guarantee', 1.3], ['subsidy', 0.12], ['embargo', relOf(c.tag, o) < -25 ? 1.2 : 0], ['rival', relOf(c.tag, o) < -15 ? 1 : 0]];
  let tot = w.reduce((a, x) => a + x[1], 0), r = Math.random() * tot, type = 'trade';
  for (const x of w) { if ((r -= x[1]) <= 0) { type = x[0]; break; } }
  if (pactBetween(type, c.tag, o) || (PACTS[type].mutual && pactBetween(type, o, c.tag))) return;
  if (type === 'alliance' && c.overlord) return;
  if (type === 'embargo' || type === 'rival') { if (relOf(c.tag, o) < -20) makePact(type, c.tag, o); return; }
  if (o === G.player) {
    if (G.proposals.some(pp => pp.from === c.tag && pp.type === type)) return;
    if (relOf(o, c.tag) < -5 && type !== 'trade') return;
    G.proposals.push({id: G.nextId++, from: c.tag, type, t: G.date.t});
    notify('diplo', `${c.name} te propone: ${PACTS[type].name}. Revisa Diplomacia.`);
    return;
  }
  const r2 = acceptChance(type, c.tag, o);
  if (Math.random() < r2.p * 0.8) makePact(type, c.tag, o, {level: 1});
}
function aiBlocAction(c) {
  const b = blocOf(c.tag); if (!b) return;
  if (b.leader === c.tag && Math.random() < 0.3) {
    const cand = aiCandidates(c, 6).filter(o => !G.C[o].bloc);
    for (const o of cand) { const ch = blocInviteChance(b, o); if (ch.p > 0 && o !== G.player && Math.random() < ch.p * 0.5) { joinBloc(o, b); break; } if (o === G.player && ch.p > 0.3 && !G.proposals.some(pp => pp.type === 'bloc' && pp.from === c.tag)) { G.proposals.push({id: G.nextId++, from: c.tag, type: 'bloc', bloc: b.id, t: G.date.t}); notify('diplo', `${c.name} te invita a unirte al bloque «${b.name}».`); break; } }
  } else if (b.leader !== c.tag && relOf(c.tag, b.leader) < -20 && Math.random() < 0.2) leaveBloc(c.tag);
}
function aiFabricate(c) {
  const rivals = aiCandidates(c, 12).filter(o => canReach(c.tag, o) && armyPower(G.C[o]) < armyPower(c) * 1.2 && !anyPactBetween(c.tag, o, ['alliance', 'nonagg']));
  if (!rivals.length) return;
  const o = G.C[pick(rivals)]; const rs = reachableStates(c.tag, o.tag).filter(x => !hasClaim(c, x.id));
  if (rs.length) startFabricate(c, rs[0].id);
}
function aiWarsNew() {
  if (G.wars.length >= 3) return;
  const cand = G.tags.filter(t => t !== NONE && alive(t) && G.C[t].rank <= 16 && !G.C[t].wars.length && !G.C[t].overlord);
  if (!cand.length || Math.random() > 0.08 * (G.diff >= 3 ? 1.3 : 1)) return;
  const a = pick(cand), A = G.C[a];
  const tg = G.tags.filter(t => t !== NONE && t !== a && alive(t) && !warBlockers(a, t) && armyPower(G.C[t]) * 1.5 < armyPower(A) && relOf(a, t) < 25 && !G.C[t].overlord);
  if (!tg.length) return;
  const d = pick(tg), D = G.C[d];
  const cl = claimedStates(A, d);
  let cb = 'humiliate', targets = [];
  if (cl.length && Math.random() < 0.8) { cb = 'claim'; targets = cl.slice(0, 2).map(x => x.id); }
  else {
    const roll = Math.random();
    if (roll < 0.35) { cb = 'conquest'; targets = reachableStates(a, d).slice(0, Math.min(2, CBS.conquest.max(A))).map(x => x.id); }
    else if (roll < 0.55 && CBS.vassal.need(A, D)) cb = 'vassal';
    else if (roll < 0.75) cb = 'trade';
  }
  if (cb === 'regime') return;
  declareWar(a, d, cb, targets, {free: A.influence < warCost(a, targets, cb)});
}
function respondProposal(id, accept) {
  const i = G.proposals.findIndex(p => p.id === id); if (i < 0) return;
  const p = G.proposals[i]; G.proposals.splice(i, 1);
  if (!accept) { addRel(G.player, p.from, -3); return; }
  if (!alive(p.from)) return;
  if (p.type === 'bloc') { const b = G.blocs.find(x => x.id === p.bloc); if (b) joinBloc(G.player, b); return; }
  makePact(p.type, p.from, G.player, {level: 1}); cnt(G.C[G.player], 'pactsMade');
  notify('diplo', `Aceptas: ${PACTS[p.type].name} con ${G.C[p.from].name}.`);
}
function improveRelations(c, tag) {
  if (c.influence < 20) return false;
  c.influence -= 20; addRel(c.tag, tag, 25); return true;
}
// Acciones adicionales de diplomacia
function giftMoney(c, tag) {
  const amt = c.stats.income * 1.5;
  if (c.treasury < amt) return {ok: false, msg: 'No tienes fondos suficientes.'};
  c.treasury -= amt; G.C[tag].treasury += amt; addRel(c.tag, tag, 18); return {ok: true, msg: `Envías ${money(amt)} como regalo: +18 de relación.`};
}
function insultCountry(c, tag) {
  if (c.influence < 10) return {ok: false, msg: 'Necesitas 10 de influencia.'};
  c.influence -= 10; addRel(c.tag, tag, -25); c.prestige += 0.5; return {ok: true, msg: 'El insulto ha sido recibido: −25 de relación.'};
}
