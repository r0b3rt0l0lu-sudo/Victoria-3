/* ===== IA DE GUERRA: OPERACIONES ESTRATÉGICAS =====
   Maniobras coordinadas de varios ejércitos que la IA planifica sobre el estado general de la guerra. Cada operación reserva sus
   ejércitos (roles) y avanza por fases hasta cumplir su objetivo o fracasar por tiempo:
   · PINZA ......... dos grupos convergen sobre el mismo objetivo desde provincias distintas y llegan sincronizados (sin ataques por goteo).
   · SEÑUELO ....... un grupo pequeño amaga contra un punto fuerte para fijar las reservas enemigas mientras el grueso golpea el punto débil.
   · EMBOSCADA ..... (defensa) un cebo débil atrae a la pila enemiga a un terreno elegido, y el grueso, oculto en una provincia contigua, cae sobre ella.
   · DEFENSA ELÁSTICA (defensa en profundidad, estilo ruso) se cede espacio hacia un punto de reunión del interior y se contraataca cuando el enemigo se estira.
   · GOLPE DE MANO . (doctrina agresiva) fuerza rápida directa a una capital enemiga mal defendida. */
const OP_MAX_AGE = 60;
const OP_MAX_WAIT = {ambush: 26, elastic: 40, feint: 30, pincer: 40, blitz: 45};
function opEta(a, dest) { const p = findPath(a, dest); if (!p || !p.length) return 0; let d = 0, prev = a.loc; p.forEach(q => { d += hopDays(a, prev, q); prev = q; }); return d; }
const opArmies = ids => ids.map(armyById).filter(a => a && !a.sea);
const opPow = ids => opArmies(ids).reduce((n, a) => n + armyPow(a), 0);
const opHeld = (t, p) => !!(G.P[p].by && sameSide(t, G.P[p].by));
const opHostile = (t, p) => hostileTags(t, provOwner(p)) && !opHeld(t, p) || !!(G.P[p].by && hostileTags(t, G.P[p].by) && !sameSide(t, G.P[p].by));
// siguiente provincia hostil sin ocupar en la ruta hacia el objetivo (se avanza ocupando)
function opNextHop(t, a, final) { if (a.loc === final) return final; const pa = findPath(a, final); if (pa && pa.length) for (const q of pa) if (opHostile(t, q)) return q; return final; }
const opAng = (o, q) => Math.atan2(MAP.provs[q].lat - MAP.provs[o].lat, MAP.provs[q].lon - MAP.provs[o].lon);

function opAlive(t, op) {
  if (G.date.t - op.t0 > OP_MAX_AGE) return false;
  if (op.ph === 'wait' && G.date.t - op.t0 > (OP_MAX_WAIT[op.k] || 30)) return false;
  const ids = [].concat(...(op.roles || []).map(r => r.ids)); op.roles.forEach(r => { r.ids = r.ids.filter(id => { const a = armyById(id); return a && a.tag === t; }); });
  if (op.roles.some(r => r.must && !r.ids.length)) return false;
  void ids;
  if (op.k === 'pincer' || op.k === 'blitz' || op.k === 'feint') { const o = op.k === 'feint' ? op.o2 : op.p; if (opHeld(t, o)) return false; if (!hostileTags(t, provOwner(o)) && !(G.P[o].by && hostileTags(t, G.P[o].by))) return false; }
  return true;
}
function opRole(op, name) { return op.roles.find(r => r.n === name); }

/* ---------- ejecución de cada tipo ---------- */
function opRun(t, op, ctx, used) {
  const {orders, eArmies, capProvs} = ctx;
  op.roles.forEach(r => r.ids.forEach(id => used.add(id)));
  const A = name => opArmies(opRole(op, name) ? opRole(op, name).ids : []);
  if (op.k === 'pincer') {
    const g0 = A('g0'), g1 = A('g1'); const gs = [g0, g1];
    if (op.ph === 'assemble') {
      gs.forEach((g, i) => g.forEach(a => { if (!a.battle) orders(a, op.stage[i], 'op'); }));
      const ready = gs.map((g, i) => g.reduce((n, a) => n + (provDist(a.loc, op.stage[i]) < 1.5 ? armyPow(a) : 0), 0) >= g.reduce((n, a) => n + armyPow(a), 0) * 0.7);
      if ((ready[0] && ready[1]) || G.date.t - op.t0 > 25) {
        op.ph = 'go'; const eta = gs.map(g => Math.max(0, ...g.map(a => opEta(a, op.p)))); const mx2 = Math.max(...eta);
        op.start = eta.map(e => G.date.t + (mx2 - e));                    // el grupo más cercano espera para llegar a la vez que el más lejano
      }
    } else {
      gs.forEach((g, i) => g.forEach(a => { if (a.battle) return; if (G.date.t >= op.start[i]) { orders(a, opNextHop(t, a, op.p), 'op'); } else if (a.loc === op.stage[i] && a.mode !== 'hold') setMode(a, 'hold'); }));
    }
  } else if (op.k === 'feint') {
    const dec = A('decoy'), main = A('main'); const dsOk = dec.some(a => provDist(a.loc, op.stage) < 1.5);
    const foe = eArmies.filter(e => provDist(e.loc, op.stage) < 5).reduce((n, e) => n + armyPow(e), 0);
    dec.forEach(a => { if (a.battle) return;
      if (foe > armyPow(a) * 1.5 && dsOk) { const back = nearestOwnProv(t, a.loc); if (back !== null && back !== a.loc) orders(a, back, 'op'); }          // el señuelo no combate: se repliega ante una pila superior
      else { orders(a, op.stage, 'op'); if (a.loc === op.stage && a.mode !== 'hold') { setMode(a, 'hold'); a.strat = 'skirmish'; } } });
    if (op.ph === 'prep' && (dsOk || G.date.t - op.t0 > 6)) op.ph = 'go';
    if (op.ph === 'go') main.forEach(a => { if (!a.battle) orders(a, opNextHop(t, a, op.o2), 'op'); });
    else main.forEach(a => { if (!a.battle && a.path.length === 0 && provDist(a.loc, op.o2) > 12) { const rl = op.rally; if (rl !== undefined) orders(a, rl, 'op'); } });
  } else if (op.k === 'ambush') {
    const bait = A('bait'), main = A('main'); const S = eArmies.filter(e => provDist(e.loc, op.pb) < 9).sort((x, y) => armyPow(y) - armyPow(x))[0];
    bait.forEach(a => { if (!a.battle) { orders(a, op.pb, 'op'); if (a.loc === op.pb && a.mode !== 'hold') { setMode(a, 'hold'); a.strat = 'hold'; } } });
    const engaged = bait.some(a => a.battle) || (S && provDist(S.loc, op.pb) < 1.5);
    if (engaged && op.ph === 'wait') op.ph = 'strike';
    if (op.ph === 'wait') main.forEach(a => { if (!a.battle) { orders(a, op.pa, 'op'); if (a.loc === op.pa && a.mode !== 'hold') setMode(a, 'hold'); } });
    else { const tgt = S ? S.loc : op.pb; main.forEach(a => { if (!a.battle) orders(a, tgt, 'op'); }); if (!S && G.date.t - op.tS > 6) op.t0 = -1e9; }
    if (op.ph === 'strike' && !op.tS) op.tS = G.date.t;
  } else if (op.k === 'elastic') {
    const all = A('all'), foes = eArmies; const near = foes.filter(e => provDist(e.loc, op.f) < 22);
    const mine = all.reduce((n, a) => n + armyPow(a), 0), np = near.reduce((n, e) => n + armyPow(e), 0), stretched = near.some(e => (e.sup !== undefined && e.sup < 0.55) || provDist(e.loc, op.from) > 18);
    if (op.ph === 'wait' && (np > 0 && (mine >= np * 1.25 || (stretched && mine >= np * 0.9)))) op.ph = 'counter';
    if (op.ph === 'wait') all.forEach(a => { if (!a.battle) { orders(a, op.f, 'op'); if (a.loc === op.f && a.mode !== 'hold') setMode(a, 'hold'); } });
    else { const tgt = near.sort((x, y) => provDist(x.loc, op.f) - provDist(y.loc, op.f))[0]; if (!tgt) op.t0 = -1e9; else all.forEach(a => { if (!a.battle) orders(a, tgt.loc, 'op'); }); }
  } else if (op.k === 'blitz') {
    A('raid').forEach(a => { if (!a.battle) orders(a, opNextHop(t, a, op.p), 'op'); });
  }
}

/* ---------- planificación ---------- */
function opPlan(t, ctx, used) {
  const {c, m, doc, free, total, ratio, V, war, enemies, eArmies, pressing, capProvs} = ctx;
  const pool = free.filter(a => !used.has(a.id) && !a.battle && a.divs.length);
  if (pool.length < 2) return null;
  const mk = (k, extra) => Object.assign({k, id: (m.war.opId = (m.war.opId || 0) + 1), t0: G.date.t, roles: [], ph: 'wait'}, extra);
  const pw = a => armyPow(a), sortBy = (arr, f) => arr.slice().sort((x, y) => f(x) - f(y));
  const poolPow = pool.reduce((n, a) => n + pw(a), 0), cx = pool.reduce((n, a) => n + MAP.provs[a.loc].lon, 0) / pool.length, cy = pool.reduce((n, a) => n + MAP.provs[a.loc].lat, 0) / pool.length;
  const {objs} = aiObjs(t, pool, {V, war, enemies, doc, m, ratio});
  const S = pressing.slice().sort((x, y) => armyPow(y) - armyPow(x))[0];
  const roll = Math.random() * 1.15;                                         // no todas las ocasiones se aprovechan: a veces basta con el plan normal
  // --- EMBOSCADA: inferioridad y una pila enemiga que entra en mi territorio ---
  if (ratio < 1.05 && S && armyPow(S) >= total * 0.22 && pool.length >= 3 && roll < 0.8) {
    const nbMine = MAP.provs[S.loc].nb.filter(q => provOwner(q) === t && !capProvs.includes(q) && canEnter(t, q));
    const pbList = (provOwner(S.loc) === t ? nbMine : (S.path || []).slice(0, 4).filter(q => provOwner(q) === t)).concat(provOwner(S.loc) === t ? [] : []);
    const pb = sortBy(pbList, q => -(MAP.provs[q].terr.def))[0];
    if (pb !== undefined) {
      const pas = MAP.provs[pb].nb.filter(q => provOwner(q) === t && q !== S.loc && canEnter(t, q)); const pa = sortBy(pas, q => -provDist(q, S.loc))[0];
      if (pa !== undefined) {
        const sorted = sortBy(pool, a => provDist(a.loc, pb)); const bait = sorted.slice().sort((x, y) => pw(x) - pw(y))[0]; const main = sorted.filter(a => a !== bait);
        const mainPow = main.reduce((n, a) => n + pw(a), 0);
        if (mainPow + pw(bait) >= armyPow(S) * 0.85) return mk('ambush', {pb, pa, roles: [{n: 'bait', ids: [bait.id], must: true}, {n: 'main', ids: main.map(a => a.id), must: true}]});
      }
    }
  }
  // --- DEFENSA ELÁSTICA: doctrina de defensa en profundidad y clara inferioridad ---
  if (doc.depth >= 0.6 && ratio < 0.9 && S && pool.length >= 2 && roll < 0.9) {
    const mineProvs = []; c.states.forEach(sid => MAP.stats[sid].provs.forEach(p => { if (provOwner(p) === t) mineProvs.push(p); }));
    const away = mineProvs.filter(p => provDist(p, S.loc) > 12 && (V.get(p) || 0) >= 1).sort((x, y) => (V.get(y) || 0) / (1 + provDist(y, capProvs[0] ?? y) / 20) - (V.get(x) || 0) / (1 + provDist(x, capProvs[0] ?? x) / 20));
    const f = away[0]; if (f !== undefined) return mk('elastic', {f, from: S.loc, roles: [{n: 'all', ids: pool.map(a => a.id), must: true}]});
  }
  if (ratio < 0.9) return null;
  // --- GOLPE DE MANO sobre la capital enemiga mal defendida ---
  if (doc.aggr >= 0.75 && pool.length >= 2 && roll < 0.5) {
    for (const e of enemies) { const ce = G.C[e]; if (ce.capital < 0) continue; const cp = MAP.stats[ce.capital].provs[0]; const opp = aiEnemyPower(t, cp, 9);
      if (opp < poolPow * 0.45 && Math.hypot(MAP.provs[cp].lon - cx, MAP.provs[cp].lat - cy) < 70 && findPath(pool[0], cp)) {
        const fast = sortBy(pool, a => -(Math.min(...a.divs.map(d => DIVS[d.t].spd)))).slice(0, Math.max(2, Math.ceil(pool.length * 0.4)));
        if (fast.reduce((n, a) => n + pw(a), 0) >= Math.max(2, opp * 1.4) && opEta(fast[0], cp) <= 40) return mk('blitz', {p: cp, roles: [{n: 'raid', ids: fast.map(a => a.id), must: true}]});
      } }
  }
  if (pool.length < 3 || !objs.length) return null;
  // --- SEÑUELO: el mejor objetivo está muy defendido; se amaga allí y se golpea el flanco débil ---
  const o1 = objs.find(o => o.opp > poolPow * 0.5);
  if (o1 && roll < 0.7 && ratio < 2.4) {
    const o2 = objs.find(o => o.p !== o1.p && o.opp < o1.opp * 0.5 && provDist(o.p, o1.p) > 8 && o.feas >= 0.7 && o.v >= 2);
    if (o2) {
      const small = sortBy(pool, a => pw(a)).find(a => pw(a) >= poolPow * 0.1 && pw(a) <= poolPow * 0.35);
      if (small) {
        const stages = MAP.provs[o1.p].nb.filter(q => mineProv(t, q) || opHeld(t, q)); const stage = sortBy(stages, q => provDist(q, small.loc))[0];
        const main = pool.filter(a => a !== small);
        if (stage !== undefined && main.length) return mk('feint', {o1: o1.p, o2: o2.p, stage, ph: 'prep', rally: nearestOwnProv(t, small.loc), roles: [{n: 'decoy', ids: [small.id]}, {n: 'main', ids: main.map(a => a.id), must: true}]});
      }
    }
  }
  // --- PINZA: gran superioridad contra un objetivo defendido ---
  const tgt = objs.find(o => o.opp > 3) || objs[0];
  if (tgt && ratio >= 1.15 && pool.length >= 3 && poolPow >= tgt.opp * 1.5 && roll < 0.85) {
    const nbs = MAP.provs[tgt.p].nb.filter(q => canEnter(t, q) && !opHostile(t, q));            // provincias de partida: propias o ya ocupadas
    let best = null, bd = 0; for (let i = 0; i < nbs.length; i++) for (let j = i + 1; j < nbs.length; j++) { let d = Math.abs(opAng(tgt.p, nbs[i]) - opAng(tgt.p, nbs[j])); d = Math.min(d, 2 * Math.PI - d); if (d > bd) { bd = d; best = [nbs[i], nbs[j]]; } }
    if (best && bd > 1.4) {
      const sorted = sortBy(pool, a => provDist(a.loc, best[0]) - provDist(a.loc, best[1])); const half = Math.ceil(sorted.length / 2);
      const g0 = sorted.slice(0, half), g1 = sorted.slice(half); if (g0.length && g1.length) return mk('pincer', {p: tgt.p, stage: best, ph: 'assemble', roles: [{n: 'g0', ids: g0.map(a => a.id), must: true}, {n: 'g1', ids: g1.map(a => a.id), must: true}]});
    }
  }
  return null;
}
// punto de entrada: devuelve los ids de los ejércitos reservados por operaciones
function aiOps(t, ctx) {
  const m = ctx.m; m.war.ops = (m.war.ops || []).filter(op => opAlive(t, op)); const used = new Set();
  // si la capital corre peligro, se abortan las operaciones ofensivas: la defensa de la capital manda
  const capP = ctx.capProvs[0], capDanger = capP !== undefined && ctx.pressing.filter(e => provDist(e.loc, capP) <= 12).reduce((n, e) => n + armyPow(e), 0) >= ctx.total * 0.18;
  if (capDanger) m.war.ops = m.war.ops.filter(op => op.k === 'ambush' || op.k === 'elastic');
  ctx.capDanger = capDanger;
  m.war.ops.forEach(op => opRun(t, op, ctx, used));
  if (m.war.ops.length < 1 && !capDanger && G.date.t - (m.war.opT || -99) >= 12 && (ctx.c.aiOps !== false)) {
    const op = opPlan(t, ctx, used); if (op) { m.war.ops.push(op); m.war.opT = G.date.t; m.war.opLog = (m.war.opLog || []).concat([op.k]).slice(-12); opRun(t, op, ctx, used); }
  }
  return used;
}
