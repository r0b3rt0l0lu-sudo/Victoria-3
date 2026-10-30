/* ===== IA DE GUERRA (v2) =====
   Sustituye a la IA terrestre voraz de cada ejército por una planificación estratégica por país:
   1. Valora las provincias (capital, industria y población, puertos, objetivos de guerra) y calcula el PELIGRO que suponen los ejércitos
      enemigos (distancia, destino y ruta previstos).
   2. DEFENSA con sentido: protege primero la capital y las provincias de más valor amenazadas; no malgasta tropas en territorios
      inútiles ni abandona el corazón del país por una incursión menor. Solo manda la fuerza necesaria (1,2-1,4 × el peligro).
   3. OFENSIVA coordinada: elige ejes de ataque contra objetivos valiosos (capital enemiga, objetivos de guerra, industria, puertos),
      concentra los ejércitos en un punto de reunión y avanza en bloque cuando hay superioridad; no se queda pasiva.
   4. Retirada ordenada si está en inferioridad local, y doctrina histórica por país (agresividad, defensa en profundidad, capital).
   La versión antigua sigue disponible con c.aiV = 1 (para pruebas comparativas). */
const AI_DOC = {
  PRU: {aggr: .85, capW: 1.2, depth: 0, fort: .2},      // ofensiva rápida contra la capital rival (estilo Moltke/Schlieffen)
  FRA: {aggr: .75, capW: 1.4, depth: .1, fort: .3},     // élan ofensivo, pero París es el centro de todo
  AUS: {aggr: .55, capW: 1.1, depth: .2, fort: .3},     // ejército cauto con varios frentes
  RUS: {aggr: .55, capW: .8, depth: .8, fort: .1},      // defensa en profundidad: cede espacio y contraataca
  GBR: {aggr: .45, capW: 1, depth: 0, fort: .2},        // potencia naval, ejército pequeño
  OTT: {aggr: .4, capW: 1.5, depth: .3, fort: .7},      // defensa de Constantinopla y los Estrechos
  USA: {aggr: .7, capW: .8, depth: .2, fort: .1},
  JAP: {aggr: .9, capW: 1, depth: 0, fort: .2},
  CHN: {aggr: .3, capW: 1, depth: .8, fort: .2}
};
const aiDoc = c => AI_DOC[c.tag] || {aggr: c.rank <= 12 ? .6 : .4, capW: 1.2, depth: .2, fort: c.rank > 20 ? .6 : .3};
const armyPow = a => { let p = 0; a.divs.forEach(d => { const i = DIVS[d.t] || DIVS.inf; p += d.s * (i.att + i.def) * (0.55 + 0.45 * d.o / i.org); }); return p; };
const mineProv = (t, pid) => { const o = provOwner(pid), by = G.P[pid].by; return (by && sameSide(t, by)) || ((o === t || (o !== NONE && sameSide(t, o))) && !(by && !sameSide(t, by))); };

/* ---------- valor de las provincias de un país ---------- */
function aiProvValues(tag) {
  const c = G.C[tag], V = new Map(); let tot = 0;
  c.states.forEach(sid => tot += G.S[sid].gdp + 1);
  const capProv = c.capital >= 0 ? MAP.stats[c.capital].provs : [];
  c.states.forEach(sid => { const s = G.S[sid], ps = MAP.stats[sid].provs, base = (s.gdp + 1) / Math.max(1, tot) * 100 / ps.length; ps.forEach(pid => { let v = base + (MAP.provs[pid].port ? 1.2 : 0) + (s.city ? 0.8 : 0); if (sid === c.capital) v += 6; V.set(pid, v); }); });
  if (capProv.length) { const cp = capProv[0]; V.set(cp, (V.get(cp) || 0) + 25); }
  return V;
}
function aiEnemyValue(pid, enemyTag, war) {
  const s = G.S[provState(pid)], c = G.C[s.owner]; if (!c || s.owner === NONE) return 0.5;
  let tot = 0; c.states.forEach(sid => tot += G.S[sid].gdp + 1);
  let v = (s.gdp + 1) / Math.max(1, tot) * 100 / Math.max(1, MAP.stats[s.id].provs.length) + (MAP.provs[pid].port ? 1.5 : 0) + (s.city ? 1 : 0);
  if (s.id === c.capital) v += 14 + (MAP.stats[s.id].provs[0] === pid ? 40 : 0);
  if (war && war.targets && war.targets.includes(s.id)) v += 22;
  return v;
}

/* ---------- peligro ---------- */
function aiDanger(t) {
  const D = new Map(), add = (p, v) => D.set(p, (D.get(p) || 0) + v);
  G.armies.forEach(e => {
    if (e.sea || !hostileTags(t, e.tag)) return; const pw = armyPow(e); if (pw <= 0) return;
    // alcance: 4 provincias a la redonda con peso decreciente, y el destino/ruta previstos del ejército
    const seen = new Map([[e.loc, 0]]); let fr = [e.loc]; add(e.loc, pw);
    for (let d = 1; d <= 4; d++) { const nx = []; fr.forEach(p => MAP.provs[p].nb.forEach(q => { if (!seen.has(q)) { seen.set(q, d); nx.push(q); add(q, pw / (1 + d * 0.9)); } })); fr = nx; }
    if (e.path && e.path.length) e.path.slice(0, 5).forEach((p, i) => add(p, pw * (0.9 - i * 0.12)));
  });
  return D;
}
function aiEnemyPower(t, pid, rad) {   // fuerza enemiga en la provincia y a distancia ≤ rad (grados)
  let p = 0; G.armies.forEach(e => { if (e.sea || !hostileTags(t, e.tag)) return; const d = e.loc === pid ? 0 : provDist(e.loc, pid); if (d <= rad) p += armyPow(e) * (d <= 1 ? 1 : 0.6); });
  return p;
}

/* ---------- paso estratégico por país ---------- */
function aiWarStep(t) {
  const c = G.C[t], doc = aiDoc(c), m = mc(c); m.war = m.war || {axes: [], idle: 0, last: 0};
  const enemies = G.tags.filter(o => o !== NONE && hostileTags(t, o) && G.C[o].states.length); if (!enemies.length) return;
  const mine = armiesOf(t).filter(a => !a.sea && !a.landing && a.divs.length);
  if (!mine.length) return;
  const free = mine.filter(a => !a.battle);
  const total = mine.reduce((n, a) => n + armyPow(a), 0), foe = G.armies.filter(e => hostileTags(t, e.tag) && !e.sea).reduce((n, e) => n + armyPow(e), 0);
  const allyPow = G.armies.filter(a => a.tag !== t && sameSide(t, a.tag) && !hostileTags(t, a.tag) && !a.sea && a.tag !== NONE && G.C[a.tag].wars.some(x => enemies.includes(x))).reduce((n, a) => n + armyPow(a), 0);
  const ratio = (total + allyPow * 0.7) / Math.max(1, foe);
  const V = aiProvValues(t), D = aiDanger(t), war = G.wars.find(w => w.attAll.includes(t) || w.defAll.includes(t));
  const capProvs = c.capital >= 0 ? MAP.stats[c.capital].provs : [], capP = capProvs[0];
  const committed = new Set(); let usedDef = 0;
  const orders = (a, dest, task) => { if (a.battle) return false; if (a.path.length && a.ai && a.ai.task === task && a.dest !== undefined && a.dest !== null && provDist(a.dest, dest) < 5) return true; if (a.dest === dest && a.path.length) { a.ai = {task, dest}; return true; } if (a.loc === dest) { a.ai = {task, dest}; if (!a.path.length && task === 'def' && a.mode !== 'hold') setMode(a, 'hold'); return true; } const r = orderMove(a, dest); if (r.ok) a.ai = {task, dest}; return r.ok; };

  /* ---- 1. DEFENSA: capital y provincias valiosas amenazadas ---- */
  const nodes = []; D.forEach((danger, p) => {
    if (!mineProv(t, p) || provOwner(p) !== t) return;                       // solo se defiende lo propio
    const cap = capProvs.includes(p), imp = (V.get(p) || 0.3) * (cap ? doc.capW : 1);
    if (danger < 0.8) return;
    nodes.push({p, danger, imp, score: imp * Math.min(danger, imp * 4 + danger * 0.3), cap});
  });
  nodes.sort((x, y) => y.score - x.score);
  const avgV = [...V.values()].reduce((x, y) => x + y, 0) / Math.max(1, V.size);
  let defNodes = 0;
  nodes.forEach(nd => {
    if (defNodes >= 3) return;
    const worthIt = nd.cap || nd.imp >= avgV * 1.5 || nd.imp >= 4;           // las provincias inútiles no merecen un ejército
    if (!worthIt) return;
    const near = aiEnemyPower(t, nd.p, 12);
    if (near < 0.8) return;
    let need = near * (nd.cap ? 1.5 : 1.2), got = 0;
    // ya hay tropas allí?
    free.forEach(a => { if (!committed.has(a.id) && provDist(a.loc, nd.p) < 1.5) { got += armyPow(a); } });
    const cand = free.filter(a => !committed.has(a.id)).sort((a, b) => provDist(a.loc, nd.p) - provDist(b.loc, nd.p));
    const cap = nd.cap ? 1 : 0.7;                                            // salvo la capital, no se compromete más del 70% de la fuerza
    for (const a of cand) {
      if (got >= need) break; if (usedDef + armyPow(a) > total * cap && !nd.cap) break;
      if (!nd.cap && provDist(a.loc, nd.p) > 40) continue;
      if (orders(a, nd.p, 'def')) { committed.add(a.id); got += armyPow(a); usedDef += armyPow(a); }
    }
    if (got > 0) defNodes++;
  });
  // guarnición mínima de la capital cuando el enemigo se acerca de verdad
  if (capP !== undefined && (D.get(capP) || 0) > 1.5 && !free.some(a => committed.has(a.id) && a.ai && a.ai.dest === capP)) {
    const cand = free.filter(a => !committed.has(a.id)).sort((a, b) => provDist(a.loc, capP) - provDist(b.loc, capP))[0];
    if (cand && orders(cand, capP, 'def')) committed.add(cand.id);
  }

  /* ---- 2. RETIRADA ordenada de los ejércitos en clara inferioridad ---- */
  free.forEach(a => {
    if (committed.has(a.id) || a.path.length > 0) return;
    const local = aiEnemyPower(t, a.loc, 3), mineLocal = free.filter(o => provDist(o.loc, a.loc) < 4).reduce((n, o) => n + armyPow(o), 0);
    if (local > mineLocal * 1.8 && !capProvs.includes(a.loc) && !(V.get(a.loc) > avgV * 3)) {
      const friends = free.filter(o => o !== a && provDist(o.loc, a.loc) < 25 && armyPow(o) >= armyPow(a) * 0.8).sort((x, y) => armyPow(y) - armyPow(x))[0];
      const dest = friends ? friends.loc : nearestOwnProv(t, a.loc); if (dest !== null && dest !== a.loc && orders(a, dest, 'retreat')) committed.add(a.id);
    }
  });

  /* ---- 3. OFENSIVA: ejes de ataque contra objetivos valiosos ---- */
  const striking = free.filter(a => !committed.has(a.id));
  if (!striking.length) return;
  const strike = striking.reduce((n, a) => n + armyPow(a), 0);
  const req = 1.45 - 0.7 * doc.aggr - (m.war.idle > 6 ? 0.25 : 0) - (ratio > 1.5 ? 0.15 : 0);      // superioridad local exigida
  const cx = striking.reduce((n, a) => n + MAP.provs[a.loc].lon * armyPow(a), 0) / Math.max(1e-6, strike), cy = striking.reduce((n, a) => n + MAP.provs[a.loc].lat * armyPow(a), 0) / Math.max(1e-6, strike);
  // objetivos candidatos: provincias enemigas junto a lo mío, la capital enemiga y los objetivos de guerra
  const cand = new Map(); const addC = p => { if (!cand.has(p)) cand.set(p, 1); };
  striking.forEach(a => { MAP.provs[a.loc].nb.forEach(q => { if (!mineProv(t, q) && canEnter(t, q) && (hostileTags(t, provOwner(q)) || (G.P[q].by && hostileTags(t, G.P[q].by)))) addC(q); }); });
  enemies.forEach(e => { const ce = G.C[e]; if (ce.capital >= 0) MAP.stats[ce.capital].provs.slice(0, 1).forEach(addC); });
  if (war) (war.targets || []).concat(war.cTargets || []).forEach(sid => { if (G.S[sid].owner !== t && hostileTags(t, G.S[sid].owner)) MAP.stats[sid].provs.slice(0, 2).forEach(addC); else if (G.S[sid].owner === t && G.S[sid].occ > 0) MAP.stats[sid].provs.forEach(p => { if (G.P[p].by && hostileTags(t, G.P[p].by)) addC(p); }); });
  // mis provincias ocupadas por el enemigo: reconquistarlas
  G.P.forEach((pr, p) => { if (pr.by && hostileTags(t, pr.by) && provOwner(p) === t) addC(p); });
  const objs = [];
  cand.forEach((_, p) => {
    if (mineProv(t, p) && !(G.P[p].by && hostileTags(t, G.P[p].by))) return;
    const own = provOwner(p), en = G.P[p].by && hostileTags(t, G.P[p].by) ? G.P[p].by : own;
    const v = own === t ? (V.get(p) || 1) * 1.4 + 3 : aiEnemyValue(p, own, war);
    const dist = Math.hypot(MAP.provs[p].lon - cx, MAP.provs[p].lat - cy), opp = aiEnemyPower(t, p, 9) + 0.8;
    const feas = clamp(strike / (req * opp), 0, 1.4), claim = (G.aiClaim && G.aiClaim[p] && G.aiClaim[p].t !== t && G.date.t - G.aiClaim[p].d < 8) ? 0.5 : 1;
    objs.push({p, v, dist, opp, feas, en, score: v / (1 + dist / 14) * (0.15 + feas) * claim});
  });
  objs.sort((x, y) => y.score - x.score);
  if (!objs.length) { m.war.idle++; // sin objetivo a la vista: avanzar hacia la provincia enemiga más cercana
    const eList = enemyProvList(t, enemies); striking.forEach(a => { if (a.path.length) return; let best = null, bd = 1e9; eList.forEach(pid => { const d = provDist(a.loc, pid); if (d < bd) { bd = d; best = pid; } }); if (best !== null && best !== a.loc) orders(a, best, 'adv'); }); return; }
  // ejes: se reparte la fuerza entre los mejores objetivos, cada uno con la fuerza necesaria
  let left = striking.slice(), axes = 0; const maxAxes = c.rank <= 6 ? 3 : 2;
  for (const o of objs) {
    if (!left.length || axes >= maxAxes) break;
    const need = Math.max(1.2, o.opp * req * 1.1); const grp = []; let pw = 0;
    left.sort((a, b) => provDist(a.loc, o.p) - provDist(b.loc, o.p));
    for (const a of left) { if (pw >= need * 1.25 && grp.length) break; grp.push(a); pw += armyPow(a); }
    if (pw < need * 0.6 && axes > 0) continue;                        // sin fuerza suficiente para un segundo eje
    if (pw < need * 0.75 && m.war.idle < 4 && o.opp > 4) { m.war.idle++; /* espera refuerzos: concentra en el punto de reunión */ }
    // punto de reunión: última provincia propia antes de entrar en territorio enemigo en la ruta al objetivo
    const lead = grp[0], path = findPath(lead, o.p);
    let rally = lead.loc; if (path && path.length) { for (let i = 0; i < path.length; i++) { if (!mineProv(t, path[i]) && !(G.P[path[i]].by && sameSide(t, G.P[path[i]].by))) { rally = i > 0 ? path[i - 1] : lead.loc; break; } rally = path[i]; } }
    const assembled = grp.filter(a => provDist(a.loc, rally) < 1.5).reduce((n, a) => n + armyPow(a), 0), waited = (G.date.t - (m.war.axisT || 0)) > 14;
    const advance = assembled >= pw * 0.7 || (m.war.idle > 8) || waited || o.opp < 1.5 || grp.every(a => provDist(a.loc, rally) < 1.5);
    G.aiClaim = G.aiClaim || {}; G.aiClaim[o.p] = {t, d: G.date.t};
    grp.forEach(a => { orders(a, advance ? o.p : rally, advance ? 'atk' : 'rally'); });
    if (!advance) { // reunir en un solo ejército en el punto de reunión
      const here = grp.filter(a => a.loc === rally && !a.battle).sort((x, y) => y.divs.length - x.divs.length);
      for (let i = 1; i < here.length; i++) if (here[0].divs.length + here[i].divs.length <= MAX_DIVS_ARMY) { mergeArmies(here[0], here[i]); }
    }
    left = left.filter(a => !grp.includes(a)); axes++; m.war.idle = 0; m.war.axisT = m.war.axisT || G.date.t;
  }
  // el resto: golpes de oportunidad contra provincias enemigas vacías o débiles cerca
  left.forEach(a => {
    if (a.path.length) return; let best = null, bs = 0;
    MAP.provs[a.loc].nb.forEach(q => { if (!canEnter(t, q)) return; const own = provOwner(q), enemyHeld = hostileTags(t, own) || (G.P[q].by && hostileTags(t, G.P[q].by)); if (!enemyHeld) return; const opp = aiEnemyPower(t, q, 2); if (opp * 1.2 > armyPow(a)) return; const s = aiEnemyValue(q, own, war) / (1 + opp); if (s > bs) { bs = s; best = q; } });
    if (best !== null) orders(a, best, 'opp');
  });
}
function aiWarAll() {
  if (!G.aiClaim || G.date.t % 120 === 0) G.aiClaim = {};
  G.tags.forEach(t => { if (t === NONE) return; const c = G.C[t]; if (!c.ai || !c.wars.length || (c.aiV || 2) === 1) return; if ((G.date.t + c.id) % 3 !== 0) return; aiWarStep(t); });
}
