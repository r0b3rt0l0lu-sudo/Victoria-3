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
// parámetros de calibración de la IA (ajustados con torneos; ver tools/prueba_ia.js)
const AI_TUNE = {tempo: 0.0, defBase: 0.9, reqBase: 1.45, ratioDef: 0.4};   // calibrado en los torneos (más ofensiva cuanto más fuerte es el país, sin descuidar la capital)
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
  const prevTask = new Map(mine.map(a => [a.id, a.ai && a.ai.task]));
  const defShare = clamp((G.aiTune || AI_TUNE).defBase - (G.aiTune || AI_TUNE).ratioDef * ratio + 0.2 * doc.fort + 0.1 * doc.depth - 0.15 * doc.aggr, 0.12, 0.9);   // cuanto más fuerte, menos se defiende y más se ataca
  const budget = total * defShare;
  const orders = (a, dest, task) => { if (a.battle) return false; if (a.path.length && a.ai && a.ai.task === task && a.dest !== undefined && a.dest !== null && provDist(a.dest, dest) < 5) return true; if (a.dest === dest && a.path.length) { a.ai = {task, dest}; return true; } if (a.loc === dest) { a.ai = {task, dest}; if (!a.path.length && task === 'def' && a.mode !== 'hold') setMode(a, 'hold'); return true; } const r = orderMove(a, dest); if (r.ok) a.ai = {task, dest}; return r.ok; };

  /* ---- 1. DEFENSA: capital y provincias valiosas con amenaza INMINENTE ---- */
  free.forEach(a => { a.ai = null; });                                            // las órdenes se reevalúan en cada ciclo
  const attacking = a => (prevTask.get(a.id) === 'atk' || prevTask.get(a.id) === 'rally') && a.path.length > 0;
  const eArmies = G.armies.filter(e => !e.sea && hostileTags(t, e.tag));
  // un ejército enemigo presiona mi territorio si ya está en él (o en su frontera) o su ruta entra en él
  const pressing = eArmies.filter(e => provOwner(e.loc) === t || (e.path && e.path.length && e.path.slice(0, 4).some(q => provOwner(q) === t)));
  const imminent = (p, r) => pressing.some(e => provDist(e.loc, p) <= (r || 9) || (e.path && e.path.slice(0, 4).includes(p)));
  /* ---- 0. OPERACIONES: maniobras coordinadas (pinza, señuelo, emboscada, defensa elástica, golpe de mano) ---- */
  if (typeof aiOps === 'function') {
    const used = aiOps(t, {c, m, doc, free, total, ratio, V, D, war, enemies, eArmies, pressing, capProvs, orders});
    used.forEach(id => committed.add(id));
  }
  /* ---- 1a. INTERCEPTAR invasores en mi territorio cuando hay superioridad (defensa activa) ---- */
  const intruders = eArmies.filter(e => provOwner(e.loc) === t && !e.battle || (provOwner(e.loc) === t && e.battle)).sort((x, y) => (V.get(y.loc) || 0) + armyPow(y) * 0.1 - (V.get(x.loc) || 0) - armyPow(x) * 0.1);
  const avgV0 = [...V.values()].reduce((x, y) => x + y, 0) / Math.max(1, V.size);
  let intercepts = 0;
  intruders.forEach(e => {
    if (intercepts >= 2) return;
    const epw = eArmies.filter(o => provDist(o.loc, e.loc) < 4).reduce((n, o) => n + armyPow(o), 0), need = epw * 1.0;                                                       // en su propio territorio el defensor tiene ventaja (terreno, suministro): basta la igualdad
    const valuable = (V.get(e.loc) || 0) >= avgV0 * 3 || capProvs.some(q => provDist(q, e.loc) < 3.5);
    if (epw < Math.max(14, total * (valuable ? 0.08 : 0.2))) return;               // no se persiguen partidas insignificantes
    if (usedDef + need > budget * (valuable ? 1.6 : 1)) return;
    const pool = free.filter(a => !committed.has(a.id) && !attacking(a) && provDist(a.loc, e.loc) < 45).sort((a, b) => provDist(a.loc, e.loc) - provDist(b.loc, e.loc));
    const avail = pool.reduce((n, a) => n + armyPow(a), 0); if (avail < need * 0.9) return;                    // sin superioridad no se sale a su encuentro
    let got = 0; for (const a of pool) { if (got >= need) break; if (orders(a, e.loc, 'int')) { committed.add(a.id); got += armyPow(a); usedDef += armyPow(a); } }
    if (got > 0) intercepts++;
  });
  const nodes = []; D.forEach((danger, p) => {
    if (provOwner(p) !== t || danger < 0.8) return;                              // solo se defiende lo propio
    const cap = capProvs.includes(p), imp = (V.get(p) || 0.3) * (cap ? doc.capW : 1);
    nodes.push({p, danger, imp, score: imp * Math.min(danger, imp * 4 + danger * 0.3), cap});
  });
  nodes.sort((x, y) => y.score - x.score);
  const avgV = [...V.values()].reduce((x, y) => x + y, 0) / Math.max(1, V.size);
  let defNodes = 0; const pressTotal = pressing.reduce((n, e) => n + armyPow(e), 0);
  nodes.forEach(nd => {
    if (usedDef >= pressTotal * 1.3 + 1) return;                                // la defensa total nunca supera 1,3 × la fuerza que presiona
    if (defNodes >= 3 || !imminent(nd.p, nd.cap ? 9 : 7)) return;
    const worthIt = nd.cap || nd.imp >= avgV * 1.8 || nd.imp >= 6;               // las provincias inútiles no merecen un ejército
    if (!worthIt) return;
    const near = pressing.filter(e => provDist(e.loc, nd.p) <= 11).reduce((n, e) => n + armyPow(e), 0);
    if (near < Math.max(0.8, total * (nd.cap ? 0.3 : 0.4))) return;                // las incursiones pequeñas las contiene la guarnición, no el ejército
    const need = near * (nd.cap ? 1.3 : 1.1); let got = 0;
    if (!nd.cap && free.some(a => committed.has(a.id) && a.ai && a.ai.task === 'int' && provDist(a.loc, nd.p) < 10)) return;
    const limit = nd.cap ? Math.max(budget, Math.min(total * 0.85, near * 1.3)) : budget;   // reserva para la ofensiva salvo amenaza máxima sobre la capital
    const cand = free.filter(a => !committed.has(a.id) && (nd.cap || !attacking(a))).sort((a, b) => provDist(a.loc, nd.p) - provDist(b.loc, nd.p));
    let usedHere = 0;
    for (const a of cand) {
      if (got >= need) break; const pw = armyPow(a);
      if (usedDef + pw > limit && got > 0) break;
      if (provDist(a.loc, nd.p) > (nd.cap ? 60 : 30)) continue;
      if (orders(a, nd.p, 'def')) { committed.add(a.id); got += pw; usedDef += pw; usedHere += pw; }
    }
    if (usedHere > 0) defNodes++;
  });
  // guarnición mínima de la capital cuando el enemigo se acerca de verdad
  if (capP !== undefined && imminent(capP, 8) && !free.some(a => committed.has(a.id) && a.ai && a.ai.dest === capP)) {
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
  const ctxO = {V, war, enemies, doc, m, ratio};
  const {objs, strike, req} = aiObjs(t, striking, ctxO);
  { const k = m.war.obj !== undefined ? objs.findIndex(o => o.p === m.war.obj) : -1; if (k > 0 && objs[k].score >= objs[0].score * 0.66 && objs[k].feas >= 0.3) { const o = objs.splice(k, 1)[0]; objs.unshift(o); } if (objs[0]) m.war.obj = objs[0].p; }   // persistencia del objetivo: no se cambia de eje por variaciones pequeñas
  m.war.dbg = {ratio: +ratio.toFixed(2), strike: +strike.toFixed(1), req: +req.toFixed(2), nObjs: objs.length, top: objs[0] ? {p: objs[0].p, sc: +objs[0].score.toFixed(2), feas: +objs[0].feas.toFixed(2), opp: +objs[0].opp.toFixed(1), v: +objs[0].v.toFixed(1)} : null, free: striking.length, def: committed.size, t: G.date.t};
  if (!objs.length) { m.war.idle++; // sin objetivo a la vista: avanzar hacia la provincia enemiga más cercana
    const eList = enemyProvList(t, enemies); striking.forEach(a => { if (a.path.length) return; let best = null, bd = 1e9; eList.forEach(pid => { const d = provDist(a.loc, pid); if (d < bd) { bd = d; best = pid; } }); if (best !== null && best !== a.loc) orders(a, best, 'adv'); }); return; }
  /* ---- 3a. TEMPO: cada ejército ocupa de inmediato la provincia enemiga contigua mejor y alcanzable (como un buen general de vanguardia) ---- */
  let left0 = striking.slice(); const taken = new Set(), usedOpp = new Set();
  striking.sort((a, b) => armyPow(b) - armyPow(a)).forEach(a => {
    if (a.battle || (a.path.length && a.ai === null && prevTask.get(a.id) === 'atk' && a.dest !== undefined && a.dest !== null && !mineProv(t, a.dest) && !(G.P[a.dest].by && sameSide(t, G.P[a.dest].by)))) { if (!a.battle) usedOpp.add(a.id); return; }   // ya va a ocupar algo: no se le cambia la orden
    let best = null, bs = 0;
    const friendsNear = free.filter(o => o !== a && provDist(o.loc, a.loc) < 5).reduce((n, o) => n + armyPow(o), 0), myPow = armyPow(a) + friendsNear * 0.6;
    MAP.provs[a.loc].nb.forEach(q => {
      if (!canEnter(t, q) || taken.has(q)) return; const own = provOwner(q), by = G.P[q].by;
      const enemyHeld = (hostileTags(t, own) && !(by && sameSide(t, by))) || (by && hostileTags(t, by) && !sameSide(t, by)); if (!enemyHeld) return;
      const opp = aiEnemyPower(t, q, 2); if (opp * (1.15 - 0.3 * doc.aggr + (G.aiTune || AI_TUNE).tempo) > myPow) return;                // solo con superioridad local
      const sc = (aiEnemyValue(q, own, war) + 2) / (1 + opp * 0.5) * (own === t ? 1.4 : 1); if (sc > bs) { bs = sc; best = q; }
    });
    if (best !== null && orders(a, best, 'atk')) { taken.add(best); usedOpp.add(a.id); }
  });
  left0 = striking.filter(a => !usedOpp.has(a.id));
  // ejes: se reparte la fuerza restante entre los mejores objetivos, cada uno con la fuerza necesaria
  let left = left0.slice(), axes = 0; const maxAxes = c.rank <= 6 ? 3 : 2;
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
    const advance = assembled >= pw * 0.7 || (m.war.idle > 8) || waited || o.opp < 1.5 || o.feas >= 1.2 || grp.every(a => provDist(a.loc, rally) < 1.5);
    G.aiClaim = G.aiClaim || {}; G.aiClaim[o.p] = {t, d: G.date.t};
    grp.forEach(a => {
      if (!advance) { orders(a, rally, 'rally'); return; }
      // se avanza ocupando provincia a provincia por la ruta (la ocupación exige permanecer unos días): primer eslabón hostil aún no ocupado
      let tgt = o.p; if (a.loc !== o.p) { const pa = findPath(a, o.p); if (pa && pa.length) { for (const q of pa) { const held = G.P[q].by && sameSide(t, G.P[q].by); const hostile = hostileTags(t, provOwner(q)) || (G.P[q].by && hostileTags(t, G.P[q].by)); if (hostile && !held) { tgt = q; break; } } } }
      orders(a, tgt, 'atk');
    });
    if (!advance) { // reunir en un solo ejército en el punto de reunión
      const here = grp.filter(a => a.loc === rally && !a.battle).sort((x, y) => y.divs.length - x.divs.length);
      for (let i = 1; i < here.length; i++) if (here[0].divs.length + here[i].divs.length <= MAX_DIVS_ARMY) { mergeArmies(here[0], here[i]); }
    }
    left = left.filter(a => !grp.includes(a)); axes++; m.war.idle = 0; m.war.axisT = m.war.axisT || G.date.t;
  }
}
/* ---------- objetivos ofensivos candidatos (capital enemiga, objetivos de guerra, provincias contiguas, reconquistas) ---------- */
function aiObjs(t, striking, ctx) {
  const {V, war, enemies, doc, m, ratio} = ctx;
  const strike = striking.reduce((n, a) => n + armyPow(a), 0);
  const req = (G.aiTune || AI_TUNE).reqBase - 0.7 * doc.aggr - (m.war.idle > 6 ? 0.25 : 0) - (ratio > 1.5 ? 0.15 : 0);      // superioridad local exigida
  const cx = striking.reduce((n, a) => n + MAP.provs[a.loc].lon * armyPow(a), 0) / Math.max(1e-6, strike), cy = striking.reduce((n, a) => n + MAP.provs[a.loc].lat * armyPow(a), 0) / Math.max(1e-6, strike);
  // objetivos candidatos: provincias enemigas junto a lo mío, la capital enemiga y los objetivos de guerra
  const cand = new Map(); const addC = p => { if (!cand.has(p)) cand.set(p, 1); };
  striking.forEach(a => { MAP.provs[a.loc].nb.forEach(q => { if (!mineProv(t, q) && canEnter(t, q) && (hostileTags(t, provOwner(q)) || (G.P[q].by && hostileTags(t, G.P[q].by)))) addC(q); }); });
  enemies.forEach(e => { const ce = G.C[e]; if (ce.capital >= 0) MAP.stats[ce.capital].provs.slice(0, 1).forEach(addC); });
  if (war) (war.targets || []).concat(war.cTargets || []).forEach(sid => { if (G.S[sid].owner !== t && hostileTags(t, G.S[sid].owner)) MAP.stats[sid].provs.slice(0, 2).forEach(addC); else if (G.S[sid].owner === t && G.S[sid].occ > 0) MAP.stats[sid].provs.forEach(p => { if (G.P[p].by && hostileTags(t, G.P[p].by)) addC(p); }); });
  // mis provincias ocupadas por el enemigo: reconquistarlas
  G.P.forEach((pr, p) => { if (pr.by && hostileTags(t, pr.by) && provOwner(p) === t) addC(p); });
  // solo objetivos alcanzables por tierra (sin camino permitido, el ejército se quedaría parado)
  const reach = new Map(); const reachable = p => { if (reach.has(p)) return reach.get(p); let ok = striking.some(a => MAP.provs[a.loc].nb.includes(p) && canEnter(t, p)); if (!ok) { const lead = striking.slice().sort((x, y) => provDist(x.loc, p) - provDist(y.loc, p))[0]; ok = !!(lead && findPath(lead, p)); } reach.set(p, ok); return ok; };
  const objs = [];
  cand.forEach((_, p) => {
    if (!reachable(p)) return;
    if (mineProv(t, p) && !(G.P[p].by && hostileTags(t, G.P[p].by))) return;
    const own = provOwner(p), en = G.P[p].by && hostileTags(t, G.P[p].by) ? G.P[p].by : own;
    const v = own === t ? (V.get(p) || 1) * 1.4 + 3 : aiEnemyValue(p, own, war);
    const dist = Math.hypot(MAP.provs[p].lon - cx, MAP.provs[p].lat - cy), opp = aiEnemyPower(t, p, 9) + 0.8;
    const feas = clamp(strike / (req * opp), 0, 1.4), claim = (G.aiClaim && G.aiClaim[p] && G.aiClaim[p].t !== t && G.date.t - G.aiClaim[p].d < 8) ? 0.5 : 1;
    objs.push({p, v, dist, opp, feas, en, score: v / (1 + dist / 14) * (0.15 + feas) * claim});
  });
  objs.sort((x, y) => y.score - x.score);
  return {objs, strike, req};
}
function aiWarAll() {
  if (!G.aiClaim || G.date.t % 120 === 0) G.aiClaim = {};
  G.tags.forEach(t => { if (t === NONE) return; const c = G.C[t]; if (!c.ai || !c.wars.length || (c.aiV || 2) === 1) return; if ((G.date.t + c.id) % 3 !== 0) return; aiWarStep(t); });
}
