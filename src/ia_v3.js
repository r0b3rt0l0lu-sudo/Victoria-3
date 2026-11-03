/* ===== IA v3: planificación de guerras, ejército permanente y paces coherentes =====
   Cambios respecto a la IA anterior:
   · Las guerras se PLANIFICAN: el agresor solo ataca a países alcanzables (por tierra o dentro de su alcance naval), compara su fuerza (con aliados y
     preparación militar) con la del rival, descansa un año tras cada guerra, no ataca con el ejército vacío, mal financiado o amenazado por un vecino
     hostil, y elige el objetivo de mejor relación valor/riesgo entre varios candidatos.
   · Ejército permanente: en paz mantiene una fracción del límite de divisiones según la amenaza de sus vecinos (antes casi no reclutaba) y construye
     cuarteles si no tiene.
   · En la paz la IA solo exige territorios razonables: junto a sus tierras o, las potencias coloniales, colonias lejanas fuera de Europa. */
const AI_COLONIAL = new Set(['GBR', 'FRA', 'NET', 'POR', 'SPA', 'BEL', 'RUS', 'USA', 'PRU', 'AUS', 'JAP', 'SAR', 'DEN', 'SWE', 'OTT']);
const llDist = (a, b) => { const dl = Math.min(Math.abs(a.lon - b.lon), 360 - Math.abs(a.lon - b.lon)); return Math.hypot(dl, a.lat - b.lat); };
const llEurope = p => p.lon > -15 && p.lon < 45 && p.lat > 34;
// ¿puede la IA anexionar este estado? (cercanía a sus tierras, o colonia lejana no europea para potencias coloniales)
function aiMayTake(tag, sid) {
  const W = G.C[tag]; if (!W || !W.states.length) return false; const p = stateLL(sid); let dmin = 1e9;
  W.states.forEach(id => { dmin = Math.min(dmin, llDist(stateLL(id), p)); });
  if (dmin <= 22) return true;
  return AI_COLONIAL.has(tag) && !llEurope(p) && dmin <= 60;
}
const aiReadiness = c => clamp(0.35 + 0.65 * Math.min(1, countDivs(c.tag) / Math.max(4, divLimit(c) * 0.6)), 0.35, 1);
// fuerza de un bando contando a quienes probablemente se unirían: aliados, miembros de su bloque militar y, si defiende, garantes
function aiSidePower(tag, asDef) {
  const c = G.C[tag]; let p = armyPower(c) * aiReadiness(c); const seen = new Set([tag]);
  const add = (t, k) => { if (seen.has(t) || !alive(t) || G.C[t].wars.length >= 2) return; seen.add(t); p += armyPower(G.C[t]) * k * aiReadiness(G.C[t]) * (canReach(t, tag) || canReach(tag, t) ? 1 : 0.35); };
  allies(tag).forEach(a => add(a, 0.65)); const bl = blocOf(tag); if (bl && bl.type === 'military') bl.members.forEach(t => add(t, 0.5));
  if (asDef) guaranteedBy(tag).forEach(t => add(t, 0.55));
  return p;
}
// mejor plan de ataque de un país (o null si no conviene atacar)
function aiWarPlan(a) {
  const A = G.C[a]; if (!alive(a) || A.wars.length || A.overlord) return null;
  if (G.date.t - (A.lastWar === undefined ? -9999 : A.lastWar) < 365) return null;         // descanso tras la última guerra
  if ((A.wear || 0) > 25 || A.legitimacy < 35 || A.treasury < Math.max(0, A.stats.income) * 4 || A.infamy > 45) return null;
  const divs = countDivs(a), lim = divLimit(A); if (divs < Math.min(Math.floor(lim * 0.4), 6)) return null;      // sin ejército no se ataca
  const myP = aiSidePower(a); let threat = 0;
  G.tags.forEach(o => { if (o === NONE || o === a || !alive(o) || sameSide(a, o) || relOf(a, o) >= -20 || !canReach(a, o)) return; threat = Math.max(threat, armyPower(G.C[o])); });
  if (threat > myP * 0.7) return null;                                                      // un vecino hostil fuerte: primero defenderse
  let best = null;
  G.tags.forEach(d => {
    if (d === NONE || d === a || !alive(d) || G.C[d].overlord || G.C[d].wars.length >= 2 || relOf(a, d) > 40) return;
    if (warBlockers(a, d) || !canReach(a, d)) return;
    const rs = reachableStates(a, d); if (!rs.length) return;
    const ratio = myP / Math.max(1, aiSidePower(d, true)); if (ratio < 1.5) return;
    const cl = claimedStates(A, d), pool = cl.length ? cl : rs, val = pool.slice(0, 2).reduce((n, x) => n + popTotal(G.S[x.id]) / 1e5 + 1, 0);
    const sc = val * Math.min(2.5, ratio) * (cl.length ? 1.6 : 1) * (relOf(a, d) < -10 ? 1.2 : 1) * (1 - Math.min(0.5, A.infamy / 100));
    if (!best || sc > best.sc) best = {a, d, sc, cl, rs, ratio};
  });
  return best;
}
function aiWarsNewV3() {
  if (G.wars.length >= 3) return;
  const aggr = typeof aggrMult === 'function' ? aggrMult() : 1;
  const cand = G.tags.filter(t => t !== NONE && alive(t) && G.C[t].rank <= 22 && !G.C[t].wars.length && !G.C[t].overlord);
  if (!cand.length || Math.random() > 0.16 * (G.diff >= 3 ? 1.3 : 1) * aggr) return;
  let plan = null; cand.slice().sort(() => Math.random() - 0.5).slice(0, 6).forEach(a => { const p = aiWarPlan(a); if (p && (!plan || p.sc > plan.sc)) plan = p; });
  if (!plan) return;
  const A = G.C[plan.a], D = G.C[plan.d]; let cb = 'humiliate', targets = [];
  if (plan.cl.length && Math.random() < 0.8) { cb = 'claim'; targets = plan.cl.slice(0, 2).map(x => x.id); }
  else { const roll = Math.random();
    if (roll < 0.4) { cb = 'conquest'; targets = plan.rs.slice(0, Math.min(2, CBS.conquest.max(A))).map(x => x.id); }
    else if (roll < 0.55 && CBS.vassal.need(A, D)) cb = 'vassal'; else if (roll < 0.7) cb = 'trade'; }
  if (cb === 'regime') return;
  A.mob = Math.max(A.mob || 0, 1);                                                          // se prepara antes de declarar
  const fr = A.influence < warCost(plan.a, targets, cb);
  if (Math.random() < 0.35 && !crisisOf(plan.a) && !crisisOf(plan.d)) { const r = openCrisis(plan.a, plan.d, cb, targets, {free: fr, ai: true}); if (r.ok) return; }
  if (typeof intelAiAttack === 'function' && intelAiAttack(plan.a, plan.d, cb, targets, fr)) return;
  declareWar(plan.a, plan.d, cb, targets, {free: fr});
}
/* ---------- ejército permanente ---------- */
function aiStandingTarget(c) {
  let th = 0; G.tags.forEach(o => { if (o === NONE || o === c.tag || !alive(o) || sameSide(c.tag, o) || relOf(c.tag, o) >= 10 || !canReach(c.tag, o)) return; th = Math.max(th, armyPower(G.C[o]) / Math.max(1, armyPower(c))); });
  return clamp(0.3 + 0.35 * Math.min(1.5, th) + (c.rank <= 8 ? 0.1 : 0), 0.3, 0.85);
}
function aiRecruitV3(t, c) {
  const lim = divLimit(c), have = countDivs(t), target = c.wars.length ? 0.95 : aiStandingTarget(c);
  const sts = c.states.filter(id => G.S[id].b.barracks >= 1);
  if (!sts.length) { if (c.queue.length < 3 && c.treasury > 30000) { const s = G.S[c.capital >= 0 ? c.capital : c.states[0]]; if (s && buildRoom(s, 'barracks') >= 1 && canBuild(s, BLD.barracks, c)) queueBuild(c, s.id, 'barracks'); } return; }
  if (have >= lim * target || (!c.wars.length && c.treasury < Math.max(0, c.stats.income) * 3)) return;
  let n = c.wars.length ? 2 : (have < lim * target * 0.6 ? 2 : 1);
  while (n-- > 0) { const r = Math.random(); const type = typeof aiPickType === 'function' ? aiPickType(c) : (r < 0.65 ? 'inf' : r < 0.8 ? 'cav' : 'art'); recruit(c, pick(sts), type); }
}
