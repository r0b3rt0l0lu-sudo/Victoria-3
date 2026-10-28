/* ===== SISTEMA MILITAR (Parte 1): divisiones, ejércitos, movimiento, batallas, ocupación e IA ===== */
const MEN_PER_DIV = 8000;
const DIVS = {
  inf: {name: 'Infantería de línea', icon: '🪖', att: 6, def: 9, spd: 1.0, org: 40, cost: 200, days: 14, desc: 'Barata y resistente. Fuerte en defensa.'},
  cav: {name: 'Caballería', icon: '🐎', att: 7, def: 5, spd: 1.6, org: 36, cost: 320, days: 20, desc: 'Muy rápida. Débil frente a posiciones defendidas.'},
  art: {name: 'Artillería', icon: '💣', att: 11, def: 4, spd: 0.8, org: 28, cost: 420, days: 25, desc: 'Gran poder de ataque, pero lenta y frágil.'}
};
const MAX_DIVS_ARMY = 12;
const BATTLE_WIDTH = 10;       // divisiones que combaten a la vez por bando
const GEN_SURNAMES = ['Wellesley', 'Moltke', 'Radetzky', 'Kutúzov', 'Ney', 'Soult', 'Bernadotte', 'Espartero', 'Narváez', 'Garibaldi', 'Cadorna', 'Pélissier', 'MacMahon', 'Scott', 'Taylor', 'Jackson', 'Lee', 'Ypsilanti', 'Ibrahim', 'Shimazu', 'Saigō', 'Zeng', 'Zuo', 'Xu', 'Nogi', 'Bolívar', 'Sucre', 'Santa Anna', 'Chassé', 'Dufour', 'Haynau', 'Wrangel', 'Roon', 'Steinmetz', 'Paskévich', 'Todleben', 'Napier', 'Havelock', 'Canrobert', 'Bosquet', 'Lamoricière', 'Zumalacárregui', 'Cabrera', 'Hoche', 'Kléber', 'Blücher', 'Gneisenau', 'Windischgrätz', 'Jellačić', 'Benedek'];

function newGeneral() {
  const r = () => 1 + Math.floor(Math.random() * 3) + (Math.random() < 0.15 ? 1 : 0);
  return {name: pick(GEN_SURNAMES), atk: Math.min(5, r()), def: Math.min(5, r()), log: Math.min(5, r()), xp: 0, lvl: 1};
}
function nextArmyId() { G.nextArmyId = (G.nextArmyId || 1); return G.nextArmyId++; }
function mkDivision(type) { return {t: type, s: 1, o: DIVS[type].org}; }
function mkArmy(tag, loc, divs, name) {
  const a = {id: nextArmyId(), tag, loc, divs: divs || [], gen: newGeneral(), path: [], hop: 0, battle: null, from: null, arrived: G.date.t, rest: 0, dig: 0, sup: 1, front: null, plan: null, name: name || ''};
  if (!a.name) a.name = `${armyOrdinal(tag)}.º Ejército`;
  G.armies.push(a); return a;
}
function armyOrdinal(tag) { return G.armies.filter(x => x.tag === tag).length + 1; }
const armiesOf = tag => G.armies.filter(a => a.tag === tag);
const armyById = id => G.armies.find(a => a.id === id);
function armyStr(a) { let t = 0; a.divs.forEach(d => t += d.s); return a.divs.length ? t / a.divs.length : 0; }
function armyOrg(a) { let t = 0; a.divs.forEach(d => t += d.o / DIVS[d.t].org); return a.divs.length ? t / a.divs.length : 0; }
function armyMen(a) { let t = 0; a.divs.forEach(d => t += d.s * MEN_PER_DIV); return Math.round(t); }
function countDivs(tag) { let n = 0; G.armies.forEach(a => { if (a.tag === tag) n += a.divs.length; }); G.recruits.forEach(r => { if (r.tag === tag) n++; }); return n; }
const MOB_LEVELS = [
  {name: 'Solo soldados profesionales', pct: 0, desc: 'Solo se recluta con la población de soldados de los cuarteles.'},
  {name: 'Voluntarios', pct: 0.01, desc: 'Movilizas un 1% de la población. Efecto económico leve.'},
  {name: 'Servicio limitado', pct: 0.025, desc: 'Un 2,5% de la población. Menos mano de obra y algo de malestar.'},
  {name: 'Conscripción', pct: 0.05, desc: 'Un 5% de la población. La producción y la legitimidad sufren.'},
  {name: 'Movilización total', pct: 0.10, desc: 'Un 10% de la población. Economía de guerra total: producción muy reducida y mucho malestar.'}
];
function divLimit(c) { return Math.max(0, Math.floor((c.stats.soldiers + c.stats.pop * MOB_LEVELS[c.mob || 0].pct) / MEN_PER_DIV)); }
const mobK = c => 1 - 0.04 * (c.mob || 0);
function setMobilization(c, lvl) {
  lvl = clamp(lvl | 0, 0, 4); if (lvl === (c.mob || 0)) return {ok: false, msg: ''};
  if (lvl > (c.mob || 0)) { const cost = c.stats.income * 0.5 * (lvl - (c.mob || 0)); if (!c.ai && c.treasury < cost) return {ok: false, msg: 'No tienes fondos para movilizar.'}; if (!c.ai) c.treasury -= cost; c.legitimacy -= 1.5 * (lvl - (c.mob || 0)); }
  c.mob = lvl; return {ok: true, msg: `Movilización: ${MOB_LEVELS[lvl].name}.`};
}
// efectos mensuales de la movilización
function mobilizationMonth(c) {
  const m = c.mob || 0; if (!m) return;
  c.radicals = Math.min(0.9, c.radicals + 0.0025 * m); c.legitimacy -= 0.25 * m;
  if (!c.ai) c.treasury -= c.stats.income * 0.12 * m;
  if (c.ai && !c.wars.length && Math.random() < 0.35) c.mob = Math.max(0, m - 1);       // la IA desmoviliza en paz
}
function armiesPower(tag) { let p = 0; armiesOf(tag).forEach(a => a.divs.forEach(d => p += d.s * (DIVS[d.t].att + DIVS[d.t].def))); return p; }


/* ---------- terreno y movimiento (sobre provincias) ---------- */
const armyState = a => provState(a.loc);
const armyStateName = a => { const p = MAP.provs[a.loc]; return G.S[p.s].name + (MAP.stats[p.s].provs.length > 1 ? ' (prov. ' + (MAP.stats[p.s].provs.indexOf(a.loc) + 1) + ')' : ''); };
const provName = pid => { const p = MAP.provs[pid]; return G.S[p.s].name + (MAP.stats[p.s].provs.length > 1 ? ' (prov. ' + (MAP.stats[p.s].provs.indexOf(pid) + 1) + ')' : ''); };
function hopDays(a, fromId, toId) {
  const B = MAP.provs[toId]; const c = G.C[a.tag];
  let spd = 9; a.divs.forEach(d => { spd = Math.min(spd, DIVS[d.t].spd); }); if (spd === 9) spd = 1;
  const lg = 1 + 0.1 * (a.gen.log - 1) + (typeof docMod === 'function' ? docMod(a.tag, 'spd') : 0);   // la velocidad es igual para todos los países
  const so = G.S[B.s]; const rail = (so.owner === a.tag || sameSide(a.tag, so.owner)) ? 1 - Math.min(0.35, (so.infra || 0) * 0.05) : 1;
  return clamp(Math.round(provDist(fromId, toId) * 1.9 * B.terr.move * rail / spd / lg), 1, 16);
}
function sameSide(ta, tb) {
  if (ta === tb) return true;
  return G.wars.some(w => (w.attAll.includes(ta) && w.attAll.includes(tb)) || (w.defAll.includes(ta) && w.defAll.includes(tb))) || !!pactBetween('alliance', ta, tb);
}
function hostileTags(ta, tb) { return G.hostile && G.hostile.has(ta + '|' + tb); }
function canEnterState(tag, sid) {
  const o = G.S[sid].owner;
  if (o === tag || o === NONE || sameSide(tag, o) || hostileTags(tag, o)) return true;
  // en guerra se puede atravesar territorio neutral, salvo el de países con pacto de no agresión, garantía o alianza con nosotros
  return G.C[tag].wars.length > 0 && !anyPactBetween(tag, o, ['nonagg', 'guarantee', 'alliance']) && !G.C[o].overlord && G.C[o].bloc !== G.C[tag].bloc;
}
const canEnter = (tag, pid) => canEnterState(tag, provState(pid));
function recalcHostile() {
  const h = new Set();
  G.wars.forEach(w => w.attAll.forEach(x => w.defAll.forEach(y => { h.add(x + '|' + y); h.add(y + '|' + x); })));
  G.hostile = h;
}
function findPath(a, dest) {
  if (dest === a.loc) return [];
  return pathProvs(a.loc, dest, (u, v) => canEnter(a.tag, v), (u, v) => hopDays(a, u, v), 6000);
}
function orderMove(a, dest, keepPlan) {
  if (a.battle) return {ok: false, msg: 'El ejército está en combate.'};
  const p = findPath(a, dest);
  if (p === null) return {ok: false, msg: 'No hay un camino terrestre permitido hasta esa provincia.'};
  a.path = p; a.dest = dest; a.hop = p.length ? hopDays(a, a.loc, p[0]) : 0; a.hopMax = a.hop; if (!keepPlan) { a.front = null; a.plan = null; a.chase = null; }
  return {ok: true, eta: p.reduce((t, s, i) => t + hopDays(a, i ? p[i - 1] : a.loc, s), 0)};
}
function armyEta(a) {
  if (!a.path.length) return 0; let t = a.hop; for (let i = 1; i < a.path.length; i++) t += hopDays(a, a.path[i - 1], a.path[i]); return t;
}
function stepMove(a) {
  if (a.battle || !a.path.length) return;
  if (a.sup !== undefined && a.sup < 0.25 && Math.random() < 0.4) return;      // sin suministro avanza más despacio
  a.hop--;
  if (a.hop > 0) return;
  const next = a.path[0];
  if (!canEnter(a.tag, next)) { a.path = []; return; }
  a.from = a.loc; a.loc = next; a.arrived = G.date.t; a.path.shift();
  a.rest = 0; a.dig = 0;
  if (a.path.length) { a.hop = hopDays(a, a.loc, a.path[0]); a.hopMax = a.hop; } else a.dest = null;
}
// persecución: se reajusta el camino hacia el ejército enemigo perseguido
function chaseDay(a) {
  if (!a.chase || a.battle) return;
  const t = armyById(a.chase);
  if (!t || !hostileTags(a.tag, t.tag)) { a.chase = null; return; }
  if (a.dest !== t.loc && (G.date.t + a.id) % 2 === 0) { const p = findPath(a, t.loc); if (p && p.length) { const keep = a.hop; a.path = p; a.dest = t.loc; if (a.hop <= 0 || !a.hopMax) { a.hop = hopDays(a, a.loc, p[0]); a.hopMax = a.hop; } else a.hop = keep; } }
}

/* ---------- batallas ---------- */
function sideOfBattle(b, army) {
  const hostileTo = list => list.some(id => { const o = armyById(id); return o && hostileTags(army.tag, o.tag); });
  if (hostileTo(b.A)) return 'B';
  if (hostileTo(b.B)) return 'A';
  return null;
}
function createBattles(byProv) {
  byProv.forEach((list, pid) => {
    if (list.length < 2) return;
    list.forEach(a => {
      if (a.battle) return;
      const foe = list.find(o => hostileTags(a.tag, o.tag));
      if (!foe) return;
      let b = foe.battle ? G.battles.find(x => x.id === foe.battle) : null;
      if (!b) {
        const attacker = a.arrived >= foe.arrived ? a : foe, defender = attacker === a ? foe : a;   // ataca quien llegó último
        b = {id: G.nextBattleId++, prov: pid, state: provState(pid), A: [attacker.id], B: [defender.id], A0: attacker.tag, B0: defender.tag, day: 0, att: 'A', hist: []};
        G.battles.push(b);
        attacker.battle = b.id; defender.battle = b.id; attacker.path = []; defender.path = [];
        const msg = `¡Batalla en ${provName(pid)}! ${G.C[attacker.tag].name} ataca a ${G.C[defender.tag].name}.`;
        if (attacker.tag === G.player || defender.tag === G.player) notify('war', msg, b.state); else logMsg(msg);
      } else {
        const side = sideOfBattle(b, a);
        if (side) { b[side].push(a.id); a.battle = b.id; a.path = []; }
      }
    });
    list.forEach(a => { if (a.battle) return; const b = G.battles.find(x => x.prov === pid); if (b) { const side = sideOfBattle(b, a); if (side) { b[side].push(a.id); a.battle = b.id; a.path = []; } } });
  });
}
function sideStats(b, ids, isAttacker) {
  let F = 0, T = 0, n = 0, org = 0, orgN = 0;
  const pv = MAP.provs[b.prov]; const terr = pv.terr;
  ids.forEach(id => {
    const a = armyById(id); if (!a) return;
    const c = G.C[a.tag];
    const dm0 = typeof docMod === 'function' ? docMod : () => 0;
    const air = typeof airBonus === 'function' ? airBonus(a.tag, b.state) : 0;
    const plan = a.plan && a.plan.ready ? 0.15 * Math.min(1, a.plan.days / 15) : 0;
    const sup = typeof supplyMod === 'function' ? supplyMod(a) : 1;
    const dig = isAttacker ? 0 : Math.min(5, a.dig || 0) * 0.04;
    const am = (1 + c.mods.army + (a.gen.atk - 1) * 0.05 + blocArmyBonus(c) + dm0(a.tag, 'att') + air + (isAttacker ? plan : 0)) * sup;
    const dm = (1 + c.mods.army * 0.6 + (c.mods.defense || 0) + (a.gen.def - 1) * 0.05 + dm0(a.tag, 'def') + air + dig) * sup;
    a.divs.forEach(d => {
      const info = DIVS[d.t];
      if (n < BATTLE_WIDTH + (terr.mnt > 0.4 ? -2 : 0)) {
        const str = d.s * (0.55 + 0.45 * d.o / info.org) * (typeof equipMod === 'function' ? equipMod(a.tag, d.t) : 1);
        F += info.att * str * am; T += info.def * str * dm * (isAttacker ? 1 : terr.def);
        n++;
      }
      org += d.o / info.org; orgN++;
    });
  });
  return {F, T, n, org: orgN ? org / orgN : 0};
}
function battleDay(b) {
  b.day++;
  const A = b.A.map(armyById).filter(Boolean), B = b.B.map(armyById).filter(Boolean);
  if (!A.length || !B.length) { endBattle(b, A.length ? 'A' : 'B'); return; }
  const sa = sideStats(b, b.A, b.att === 'A'), sb = sideStats(b, b.B, b.att === 'B');
  const rnd1 = () => 0.85 + Math.random() * 0.3;
  const rAB = sa.F * rnd1() / Math.max(1, sb.T), rBA = sb.F * rnd1() / Math.max(1, sa.T);
  const dmg = (r) => clamp(5.5 * r, 0.6, 13);       // % de organización perdida por día
  const apply = (armies, orgLoss) => {
    let lost = 0;
    armies.forEach(a => {
      a.divs.forEach((d, i) => {
        if (i >= BATTLE_WIDTH) return;
        const info = DIVS[d.t];
        d.o = Math.max(0, d.o - info.org * orgLoss / 100 * (0.8 + Math.random() * 0.4));
        const sl = (orgLoss / 100) * 0.38 * (0.6 + 0.8 * (1 - d.o / info.org));
        d.s = Math.max(0, d.s - sl); lost += sl * MEN_PER_DIV;
      });
      a.divs = a.divs.filter(d => d.s > 0.04);
      if (a.divs.length === 0) a._dead = true;
      if (typeof useAmmo === 'function') useAmmo(a);
    });
    return lost;
  };
  const lostB = apply(B, dmg(rAB)), lostA = apply(A, dmg(rBA));
  b.lostA = (b.lostA || 0) + lostA; b.lostB = (b.lostB || 0) + lostB;
  A.forEach(a => bleed(a.tag, lostA / Math.max(1, A.length))); B.forEach(a => bleed(a.tag, lostB / Math.max(1, B.length)));
  b.rA = rBA; b.rB = rAB; b.orgA = sa.org; b.orgB = sb.org; b.sa = {F: sa.F, T: sa.T, n: sa.n}; b.sb = {F: sb.F, T: sb.T, n: sb.n};
  b.hist = b.hist || []; b.hist.push([+sa.org.toFixed(3), +sb.org.toFixed(3)]); if (b.hist.length > 40) b.hist.shift();
  G.armies = G.armies.filter(a => !a._dead);
  const A2 = b.A.map(armyById).filter(Boolean), B2 = b.B.map(armyById).filter(Boolean);
  const oA = A2.length ? sideStats(b, b.A, true).org : 0, oB = B2.length ? sideStats(b, b.B, true).org : 0;
  if (!A2.length || !B2.length) { endBattle(b, A2.length ? 'A' : 'B'); return; }
  if (b.day >= 3 && (oA < 0.18 || oB < 0.18)) endBattle(b, oA < oB ? 'B' : 'A');
}
// Bajas: se restan de la población de reclutamiento del país y suben el cansancio de guerra
function bleed(tag, men) {
  if (men <= 0) return;
  const c = G.C[tag]; if (!c || !c.states.length) return;
  c.cnt = c.cnt || {}; c.cnt.casualties = (c.cnt.casualties || 0) + men;
  c.wearV = (c.wearV || 0) + men / Math.max(1e5, c.stats.pop) * 40;
  let left = men;
  for (let k = 0; k < 4 && left > 0; k++) { const s = G.S[pick(c.states)]; const take = Math.min(left, (s.pops.peasants || 0) * 0.02); s.pops.peasants -= take; left -= take; }
}
function endBattle(b, winner) {
  G.battles = G.battles.filter(x => x !== b);
  const fa = (armyById(b.A[0]) || {}).tag, fb = (armyById(b.B[0]) || {}).tag;
  G.battleLog = G.battleLog || []; G.battleLog.unshift({id: b.id, prov: b.prov, state: b.state, A: b.A0 || fa, B: b.B0 || fb, winner: winner === 'A' ? (b.A0 || fa) : (b.B0 || fb), days: b.day, lostA: Math.round(b.lostA || 0), lostB: Math.round(b.lostB || 0), date: dateStr ? dateStr() : ''}); if (G.battleLog.length > 25) G.battleLog.length = 25;
  b.ended = true; G.lastEnded = b;
  const win = (winner === 'A' ? b.A : b.B).map(armyById).filter(Boolean), lose = (winner === 'A' ? b.B : b.A).map(armyById).filter(Boolean);
  win.forEach(a => { a.battle = null; a.rest = 0; a.gen.xp += 8; gainXp(a.tag, 1.5); if (a.gen.xp >= a.gen.lvl * 30 && a.gen.lvl < 5) { a.gen.xp = 0; a.gen.lvl++; const k = pick(['atk', 'def', 'log']); a.gen[k] = Math.min(5, a.gen[k] + 1); if (a.tag === G.player) notify('war', `${a.gen.name} sube a nivel ${a.gen.lvl}.`); } });
  lose.forEach(a => { a.battle = null; gainXp(a.tag, 0.5); retreatArmy(a, b); generalFate(a, b); });
  const wt = win[0] ? win[0].tag : null, lt = lose[0] ? lose[0].tag : null;
  if (wt && lt) G.wars.forEach(w => { const wa = w.attAll.includes(wt) && w.defAll.includes(lt), wd = w.defAll.includes(wt) && w.attAll.includes(lt); if (wa || wd) { w.bw = w.bw || {att: 0, def: 0}; if (wa) w.bw.att++; else w.bw.def++; } });
  if (win[0] && (win[0].tag === G.player || (lose[0] && lose[0].tag === G.player))) notify('war', `Batalla de ${provName(b.prov)}: victoria de ${G.C[wt].name}.`, b.state);
}
// experiencia militar nacional (para doctrinas)
function gainXp(tag, n) { const c = G.C[tag]; if (c) c.mxp = (c.mxp || 0) + n; }
// el general derrotado puede morir o ser capturado
function generalFate(a, b) {
  if (Math.random() > 0.035) return;
  const old = a.gen.name; a.gen = newGeneral();
  if (a.tag === G.player) notify('war', `El general ${old} ha muerto en combate. ${a.gen.name} toma el mando de ${a.name}.`, b.state);
}
function retreatArmy(a, b) {
  const sidesOwn = tag => sameSide(a.tag, tag);
  const nb = MAP.provs[a.loc].nb.filter(n => canEnter(a.tag, n) && !armiesAt(n).some(o => hostileTags(a.tag, o.tag)));
  let dest = nb.find(n => n === a.from) ?? null;
  if (dest === null) dest = nb.sort((x, y) => (sidesOwn(provOwner(y)) ? 1 : 0) - (sidesOwn(provOwner(x)) ? 1 : 0))[0] ?? null;
  a.path = []; a.dig = 0;
  if (dest === null) {      // rodeado: pierde parte de la fuerza y se rinde parcialmente
    a.divs.forEach(d => { d.s *= 0.7; d.o *= 0.4; });
    a.divs = a.divs.filter(d => d.s > 0.1);
    const home = nearestOwnProv(a.tag, a.loc); if (home !== null) a.loc = home;
    return;
  }
  a.loc = dest; a.from = null; a.arrived = G.date.t; a.divs.forEach(d => { d.o = Math.min(d.o, DIVS[d.t].org * 0.3); });
}
function armiesAt(pid) { return G.armies.filter(a => a.loc === pid); }
function nearestOwnProv(tag, from) {
  const c = G.C[tag]; let best = null, bd = 1e9;
  c.states.forEach(sid => MAP.stats[sid].provs.forEach(id => { if (armiesAt(id).some(o => hostileTags(tag, o.tag))) return; const d = provDist(from, id); if (d < bd) { bd = d; best = id; } }));
  return best;
}

/* ---------- jornada militar ---------- */
function militaryDay() {
  if (!G.armies) return;
  if (!G.hostile) recalcHostile();
  recalcHostileIfNeeded();
  if (G.armies.length) {
    G.armies.forEach(chaseDay); G.armies.forEach(stepMove);
    const byProv = new Map();
    G.armies.forEach(a => { (byProv.get(a.loc) || byProv.set(a.loc, []).get(a.loc)).push(a); });
    createBattles(byProv);
    G.battles.slice().forEach(battleDay);
    if (typeof supplyDay === 'function') supplyDay();
    G.armies.forEach(a => {
      if (a.battle) return;
      const owner = provOwner(a.loc), own = owner === a.tag || sameSide(a.tag, owner);
      a.rest++; if (!a.path.length && a.rest % 4 === 0) a.dig = Math.min(5, (a.dig || 0) + 1);
      const supK = Math.max(0.2, a.sup === undefined ? 1 : a.sup);
      a.divs.forEach(d => {
        const info = DIVS[d.t];
        d.o = Math.min(info.org, d.o + info.org * (own ? 0.06 : 0.025) * (a.path.length ? 0.4 : 1) * supK);
        if (own && d.s < 1 && !a.path.length && a.sup > 0.5) { const g = Math.min(1 - d.s, 0.006); const men = g * MEN_PER_DIV; const s = G.S[provState(a.loc)]; if ((s.pops.peasants || 0) > men * 4 && (typeof takeReplacements !== 'function' || takeReplacements(a.tag, d.t, g))) { d.s += g; s.pops.peasants -= men; } }
      });
    });
    occupationDay();
    if (typeof frontsDay === 'function') frontsDay();
  }
  for (let i = G.recruits.length - 1; i >= 0; i--) {
    const r = G.recruits[i]; r.days--;
    if (r.days > 0) continue;
    G.recruits.splice(i, 1);
    const c = G.C[r.tag]; if (!c || !c.states.length) continue;
    const sid = G.S[r.state].owner === r.tag ? r.state : c.capital;
    const loc = stateCapitalProv(sid);
    let a = G.armies.find(x => x.tag === r.tag && x.loc === loc && !x.battle && x.divs.length < MAX_DIVS_ARMY && !x.path.length);
    if (!a) a = mkArmy(r.tag, loc, []);
    a.divs.push(mkDivision(r.type));
    if (r.tag === G.player) notify('war', `Nueva división de ${DIVS[r.type].name.toLowerCase()} en ${G.S[sid].name}.`, sid);
  }
  G.wars.forEach(w => { w.score = computeWarScore(w); });
}
let _hostileSig = '';
function recalcHostileIfNeeded() {
  const sig = G.wars.map(w => w.id + ':' + w.attAll.join('') + '>' + w.defAll.join('')).join(';');
  if (sig !== _hostileSig) { _hostileSig = sig; recalcHostile(); }
}

/* ---------- ocupación por provincias ---------- */
function occupationDay() {
  const changedProv = new Set(), changedState = new Set();
  const byProv = new Map();
  G.armies.forEach(a => { if (!a.battle) (byProv.get(a.loc) || byProv.set(a.loc, []).get(a.loc)).push(a); });
  // solo se revisan las provincias con tropas y las que tienen una ocupación en curso
  const check = new Set(byProv.keys()); G.occList = (G.occList || []).filter(pid => G.P[pid].by || G.P[pid].prog > 0); G.occList.forEach(p => check.add(p));
  check.forEach(pid => {
    const pr = G.P[pid], sid = provState(pid), s = G.S[sid], owner = s.owner;
    if (owner === NONE) { if (pr.by) { pr.by = null; pr.prog = 0; changedProv.add(pid); } return; }
    const here = byProv.get(pid) || [];
    const enemy = here.find(a => hostileTags(a.tag, owner)), friend = here.some(a => a.tag === owner || (sameSide(a.tag, owner) && !hostileTags(a.tag, owner)));
    const before = pr.by;
    if (enemy && !friend) {
      if (!pr.by || (pr.by !== enemy.tag && !sameSide(pr.by, enemy.tag))) { if (pr.by) { pr.by = null; pr.prog = 0; } }
      if (!pr.by) { pr.prog = (pr.prog || 0) + 1; pr.pby = enemy.tag; if (pr.prog >= OCC_DAYS) { pr.by = enemy.tag; pr.prog = OCC_DAYS; } }
    } else if (friend && (pr.by || pr.prog > 0)) { pr.prog = Math.max(0, pr.prog - 2); if (pr.prog <= 0 || pr.by) { if (pr.by && pr.prog <= OCC_DAYS - 3) { pr.by = null; pr.prog = 0; } } }
    if (pr.by !== before) { changedProv.add(pid); changedState.add(sid); }
    if ((pr.by || pr.prog > 0) && !G.occList.includes(pid)) G.occList.push(pid);
  });
  const sts = new Set(); changedProv.forEach(pid => sts.add(provState(pid)));
  sts.forEach(sid => {
    const s = G.S[sid], was = s.occ || 0;
    refreshStateOcc(sid);
    if ((s.occ || 0) >= 1 && !s._occNotified) { s._occNotified = true; if (s.owner === G.player || s.occBy === G.player) notify('war', `${s.name} ha sido ocupada por ${G.C[s.occBy].name}.`, sid); }
    if ((s.occ || 0) === 0) s._occNotified = false;
    void was; changedState.add(sid);
  });
  if (changedProv.size) { const ids = new Set(changedState); changedProv.forEach(pid => MAP.provs[pid].nb.forEach(q => ids.add(provState(q)))); if (typeof onFrontChanged === 'function') onFrontChanged(ids); }
}

/* ---------- puntuación de guerra a partir de hechos ---------- */
function computeWarScore(w) {
  const frac = (ownersList, occList) => {
    let occ = 0, tot = 0;
    ownersList.forEach(t => G.C[t].states.forEach(id => { const s = G.S[id]; tot += s.popBase + 1; if (s.occ > 0 && s.occBy && occList.includes(s.occBy)) occ += (s.popBase + 1) * s.occ; }));
    return tot ? occ / tot : 0;
  };
  const oDef = frac(w.defAll, w.attAll), oAtt = frac(w.attAll, w.defAll);
  let sc = 120 * (oDef - oAtt);
  const cap = (leader, by) => { const c = G.C[leader]; const s = G.S[c.capital]; return s && s.owner === leader && s.occ >= 1 && by.includes(s.occBy); };
  if (cap(w.def, w.attAll)) sc += 25; if (cap(w.att, w.defAll)) sc -= 25;
  w.targets.forEach(sid => { const s = G.S[sid]; if (s.owner === w.def && s.occ >= 1) sc += 10; });
  const bw = w.bw || {att: 0, def: 0}; sc += clamp((bw.att - bw.def) * 1.5, -15, 15);
  if (typeof blockadeScore === 'function') sc += blockadeScore(w);
  return clamp(Math.round(sc), -100, 100);
}
function sideStrength(list) { let t = 0; list.forEach(tag => armiesOf(tag).forEach(a => a.divs.forEach(d => t += d.s * DIVS[d.t].att))); return Math.round(t); }

/* ---------- reclutamiento ---------- */
function recruitCost(c, type) { return Math.round(DIVS[type].cost * moneyPerPoint(c)); }
function canRecruit(c, sid, type) {
  const s = G.S[sid];
  if (!s || s.owner !== c.tag) return 'Ese estado no es tuyo.';
  if (!(s.b.barracks >= 1)) return 'El estado necesita Cuarteles.';
  if (countDivs(c.tag) >= divLimit(c)) return `Has alcanzado el máximo de divisiones (${divLimit(c)}). Construye más cuarteles.`;
  if ((s.pops.peasants || 0) < MEN_PER_DIV * 6) return 'No hay suficiente población en el estado.';
  if (c.treasury < recruitCost(c, type)) return 'No tienes fondos suficientes.';
  return null;
}
function recruit(c, sid, type) {
  const err = canRecruit(c, sid, type); if (err) return {ok: false, msg: err};
  const s = G.S[sid]; if (typeof takeEquipForDiv === 'function') { const m = takeEquipForDiv(c, type); if (m) return {ok: false, msg: m}; } c.treasury -= recruitCost(c, type); s.pops.peasants -= MEN_PER_DIV;
  G.recruits.push({tag: c.tag, state: sid, type, days: DIVS[type].days});
  return {ok: true};
}
function disbandArmy(a) {
  if (a.battle) return;
  const men = armyMen(a), s = G.S[provState(a.loc)]; if (s && s.owner === a.tag) s.pops.peasants += men * 0.8;
  G.armies = G.armies.filter(x => x !== a);
}
function splitArmy(a) {
  if (a.divs.length < 2 || a.battle) return null;
  const half = a.divs.splice(Math.ceil(a.divs.length / 2));
  const n = mkArmy(a.tag, a.loc, half); n.gen = newGeneral(); return n;
}
function mergeArmies(a, b) {
  if (a === b || a.loc !== b.loc || a.tag !== b.tag || a.battle || b.battle) return false;
  if (a.divs.length + b.divs.length > MAX_DIVS_ARMY) return false;
  a.divs = a.divs.concat(b.divs); G.armies = G.armies.filter(x => x !== b); return true;
}


/* ---------- ejércitos iniciales ---------- */
function initArmies() {
  G.armies = []; G.battles = []; G.recruits = []; G.nextArmyId = 1; G.nextBattleId = 1; G.occList = [];
  initProvinceState();
  G.tags.forEach(t => {
    if (t === NONE) return; const c = G.C[t]; if (!c.states.length) return;
    const lim = divLimit(c); let n = Math.min(Math.floor(lim * 0.7), 160); if (n < 1 && lim >= 1) n = 1; if (!n || lim < 1) return;
    const barr = c.states.filter(id => G.S[id].b.barracks >= 1);
    const homes = (barr.length ? barr : [c.capital >= 0 ? c.capital : c.states[0]]).map(stateCapitalProv);
    let hi = 0;
    while (n > 0) {
      const k = Math.min(n, 6 + Math.floor(Math.random() * 3)); const divs = [];
      for (let i = 0; i < k; i++) { const r = Math.random(); divs.push(mkDivision(r < 0.7 ? 'inf' : r < 0.85 ? 'cav' : 'art')); }
      mkArmy(t, homes[hi++ % homes.length], divs); n -= k;
    }
  });
  recalcHostile();
}

/* ---------- IA militar ---------- */
function enemyProvList(t, enemies) {
  const out = [];
  enemies.forEach(e => G.C[e].states.forEach(id => MAP.stats[id].provs.forEach(pid => { const pr = G.P[pid]; if (pr.by && sameSide(t, pr.by)) return; out.push(pid); })));
  return out;
}
function aiMilitary() {
  const byP = new Map(); G.armies.forEach(a => { (byP.get(a.loc) || byP.set(a.loc, []).get(a.loc)).push(a); });
  const armiesAt = pid => byP.get(pid) || [];
  G.tags.forEach(t => {
    if (t === NONE) return; const c = G.C[t];
    if (!c.ai || !c.wars.length) return;
    const enemies = G.tags.filter(o => hostileTags(t, o));
    if (!enemies.length) return;
    const mine = armiesOf(t).filter(a => !a.battle);
    const capital = c.capital; const capP = capital >= 0 ? stateCapitalProv(capital) : -1;
    const capNear = capital >= 0 ? new Set(MAP.stats[capital].provs.concat(...MAP.stats[capital].provs.map(p => MAP.provs[p].nb))) : new Set();
    const threat = capital >= 0 && [...capNear].some(n => armiesAt(n).some(o => hostileTags(t, o.tag)));
    let eList = null;
    mine.forEach(a => {
      if (a.front) return;
      if (a.path.length && !threat) return;
      if (threat && capP >= 0 && !capNear.has(a.loc)) { const near = provDist(a.loc, capP) < 12; if (near || mine.length < 3) { orderMove(a, capP); return; } }
      if (a.path.length) return;
      const strA = armyStr(a) * a.divs.length;
      if ((armyOrg(a) < 0.55 || (a.sup !== undefined && a.sup < 0.4)) && provOwner(a.loc) === t) return;
      const cands = [];
      MAP.provs[a.loc].nb.forEach(pid => {
        if (!canEnter(t, pid)) return;
        const foes = armiesAt(pid).filter(o => hostileTags(t, o.tag)); const fs = foes.reduce((x, o) => x + armyStr(o) * o.divs.length, 0);
        const owner = provOwner(pid); const enemyOwned = owner !== NONE && hostileTags(t, owner);
        if (!enemyOwned && !foes.length) return;
        if (fs > strA * 1.3) return;
        const pr = G.P[pid];
        let score = 10 - fs * 2 + (enemyOwned ? 4 : 0) + (pr.by && sameSide(t, pr.by) ? -8 : 0) + (!pr.by ? 2 : 0);
        const sid = provState(pid);
        G.wars.forEach(w => { if (w.targets.includes(sid) && w.attAll.includes(t)) score += 6; });
        if (enemies.some(e => G.C[e].capital === sid)) score += 5;
        cands.push({pid, score});
      });
      if (!cands.length) {
        let tgt = null, td = 1e9;
        G.armies.forEach(o => { if (!hostileTags(t, o.tag) || o.battle) return; const os = provOwner(o.loc); if (os !== t && !sameSide(t, os)) return; const d = provDist(a.loc, o.loc); if (d < td && armyStr(o) * o.divs.length < strA * 1.4) { td = d; tgt = o.loc; } });
        if (tgt !== null && tgt !== a.loc) { orderMove(a, tgt); return; }
      }
      if (cands.length) { cands.sort((x, y) => y.score - x.score); orderMove(a, cands[0].pid); return; }
      eList = eList || enemyProvList(t, enemies);
      let best = null, bd = 1e9;
      eList.forEach(pid => { const d = provDist(a.loc, pid) - (G.wars.some(w => w.targets.includes(provState(pid))) ? 4 : 0); if (d < bd) { bd = d; best = pid; } });
      if (best !== null && best !== a.loc) { const p = findPath(a, best); if (p && p.length) { a.path = p.slice(0, 60); a.dest = best; a.hop = hopDays(a, a.loc, p[0]); } }
    });
  });
}
function aiRecruitCountry(t) {
  const c = G.C[t]; if (!c || !c.ai || !c.states.length) return;
  const sts = c.states.filter(id => G.S[id].b.barracks >= 1); if (!sts.length) return;
  const r = Math.random(); recruit(c, pick(sts), r < 0.65 ? 'inf' : r < 0.8 ? 'cav' : 'art');
}
// mantenimiento semanal de las divisiones (más caro en guerra y con alta movilización)
function armyUpkeep(c) {
  let t = 0; const k = moneyPerPoint(c);
  G.armies.forEach(a => { if (a.tag === c.tag) a.divs.forEach(d => t += DIVS[d.t].cost); });
  return t * k * 0.006 * (1 + (c.mods.milCost || 0)) * (c.milFund || 1) * (c.wars.length ? 1.4 : 1) * (1 + 0.1 * (c.mob || 0));
}
function aiDisbandExcess(c) {
  if (c.wars.length || countDivs(c.tag) <= divLimit(c) * 0.9) return;
  const a = armiesOf(c.tag).filter(x => !x.battle && !x.path.length && provOwner(x.loc) === c.tag)[0]; if (!a) return;
  a.divs.pop(); if (!a.divs.length) G.armies = G.armies.filter(x => x !== a);
}
function aiRecruitWeek() {
  G.tags.forEach(t => {
    if (t === NONE) return; const c = G.C[t]; if (!c.ai || !c.states.length) return;
    if (c.wars.length && (c.mob || 0) < (c.legitimacy < 40 ? 2 : 3)) setMobilization(c, (c.mob || 0) + 1);
    aiDisbandExcess(c);
    if (!c.wars.length && (Math.random() > 0.03 || countDivs(t) >= divLimit(c) * 0.6)) return;
    let n = c.wars.length ? 2 : 1;
    const sts = c.states.filter(id => G.S[id].b.barracks >= 1);
    while (n-- > 0 && sts.length) { const r = Math.random(); const type = r < 0.65 ? 'inf' : r < 0.8 ? 'cav' : 'art'; recruit(c, pick(sts), type); }
  });
}
function evacuateForeignArmies() {
  G.armies.forEach(a => {
    const o = provOwner(a.loc);
    if (!(o === a.tag || o === NONE || sameSide(a.tag, o) || hostileTags(a.tag, o)) && !a.battle) {
      const home = nearestOwnProv(a.tag, a.loc); if (home !== null) { a.loc = home; a.path = []; a.from = null; }
    }
  });
}
function cleanupArmies() {
  G.armies = G.armies.filter(a => G.C[a.tag] && G.C[a.tag].states.length);
  G.battles = G.battles.filter(b => b.A.some(id => armyById(id)) && b.B.some(id => armyById(id)));
  G.armies.forEach(a => { if (a.battle && !G.battles.some(b => b.id === a.battle)) a.battle = null; });
}

/* ---------- guardado de datos militares ---------- */
function provSave() { const o = []; G.P.forEach((p, i) => { if (p.by || p.prog || p.fort) o.push([i, p.by, p.prog, p.pby || null, p.fort || 0]); }); return o; }
function provLoad(list) { initProvinceState(); (list || []).forEach(([i, by, prog, pby, fort]) => { const p = G.P[i]; if (p) { p.by = by; p.prog = prog; p.pby = pby; p.fort = fort; } }); G.occList = (list || []).map(x => x[0]); G.S.forEach(s => refreshStateOcc(s.id)); }
function saveExtra() { return {battleLog: G.battleLog || []}; }
function loadExtra(x) { G.battleLog = (x && x.battleLog) || []; }
