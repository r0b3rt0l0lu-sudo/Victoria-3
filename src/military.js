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
  const a = {id: nextArmyId(), tag, loc, divs: divs || [], gen: newGeneral(), path: [], hop: 0, battle: null, from: null, arrived: G.date.t, rest: 0, name: name || ''};
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
function divLimit(c) { return Math.max(0, Math.floor(c.stats.soldiers / MEN_PER_DIV)); }
function armiesPower(tag) { let p = 0; armiesOf(tag).forEach(a => a.divs.forEach(d => p += d.s * (DIVS[d.t].att + DIVS[d.t].def))); return p; }

/* ---------- terreno y movimiento ---------- */
function terrainInfo(s) {
  if (s._terr) return s._terr;
  const b = MAP.stats[s.id].biomes, tot = Math.max(1, b.reduce((x, y) => x + y, 0));
  const mnt = (b[BIOME.MOUNTAIN] + b[BIOME.SNOW]) / tot, frs = b[BIOME.FOREST] / tot, jun = b[BIOME.JUNGLE] / tot, des = b[BIOME.DESERT] / tot;
  s._terr = {move: 1 + 1.4 * mnt + 0.5 * frs + 0.8 * jun + 0.4 * des, def: 1 + 0.35 * mnt + 0.12 * frs + 0.2 * jun, mnt};
  return s._terr;
}
function hopDays(a, fromId, toId) {
  const A = G.S[fromId], B = G.S[toId]; const c = G.C[a.tag];
  let spd = 9; a.divs.forEach(d => { spd = Math.min(spd, DIVS[d.t].spd); }); if (spd === 9) spd = 1;
  const lg = 1 + 0.1 * (a.gen.log - 1) + (c.mods.logistics || 0);
  return clamp(Math.round(distStates(A, B) * 1.8 * terrainInfo(B).move / spd / lg), 2, 45);
}
function sameSide(ta, tb) {
  if (ta === tb) return true;
  return G.wars.some(w => (w.attAll.includes(ta) && w.attAll.includes(tb)) || (w.defAll.includes(ta) && w.defAll.includes(tb))) || !!pactBetween('alliance', ta, tb);
}
function hostileTags(ta, tb) { return G.hostile && G.hostile.has(ta + '|' + tb); }
function canEnter(tag, sid) {
  const o = G.S[sid].owner;
  if (o === tag || o === NONE || sameSide(tag, o) || hostileTags(tag, o)) return true;
  // en guerra se puede atravesar territorio neutral, salvo el de países con pacto de no agresión, garantía o alianza con nosotros
  return G.C[tag].wars.length > 0 && !anyPactBetween(tag, o, ['nonagg', 'guarantee', 'alliance']) && !G.C[o].overlord && G.C[o].bloc !== G.C[tag].bloc;
}
function recalcHostile() {
  const h = new Set();
  G.wars.forEach(w => w.attAll.forEach(x => w.defAll.forEach(y => { h.add(x + '|' + y); h.add(y + '|' + x); })));
  G.hostile = h;
}
// Dijkstra por días de marcha entre estados (solo estados permitidos)
function findPath(a, dest) {
  if (dest === a.loc) return [];
  const dist = new Map([[a.loc, 0]]), prev = new Map(); const open = [[0, a.loc]]; const done = new Set();
  while (open.length) {
    open.sort((x, y) => x[0] - y[0]); const [d, u] = open.shift();
    if (done.has(u)) continue; done.add(u);
    if (u === dest) break;
    for (const v of G.S[u].neigh) {
      if (done.has(v) || !canEnter(a.tag, v)) continue;
      const nd = d + hopDays(a, u, v);
      if (nd < (dist.get(v) ?? 1e9)) { dist.set(v, nd); prev.set(v, u); open.push([nd, v]); }
    }
  }
  if (!prev.has(dest)) return null;
  const path = []; let cur = dest; while (cur !== a.loc) { path.unshift(cur); cur = prev.get(cur); }
  return path;
}
function orderMove(a, dest) {
  if (a.battle) return {ok: false, msg: 'El ejército está en combate.'};
  const p = findPath(a, dest);
  if (p === null) return {ok: false, msg: 'No hay un camino terrestre permitido hasta ese estado.'};
  a.path = p; a.dest = dest; a.hop = p.length ? hopDays(a, a.loc, p[0]) : 0;
  return {ok: true, eta: p.reduce((t, s, i) => t + hopDays(a, i ? p[i - 1] : a.loc, s), 0)};
}
function armyEta(a) {
  if (!a.path.length) return 0; let t = a.hop; for (let i = 1; i < a.path.length; i++) t += hopDays(a, a.path[i - 1], a.path[i]); return t;
}
function stepMove(a) {
  if (a.battle || !a.path.length) return;
  a.hop--;
  if (a.hop > 0) return;
  const next = a.path[0];
  if (!canEnter(a.tag, next)) { a.path = []; return; }
  a.from = a.loc; a.loc = next; a.arrived = G.date.t; a.path.shift();
  a.rest = 0;
  if (a.path.length) a.hop = hopDays(a, a.loc, a.path[0]); else a.dest = null;
}

/* ---------- batallas ---------- */
function sideOfBattle(b, army) {
  const hostileTo = list => list.some(id => { const o = armyById(id); return o && hostileTags(army.tag, o.tag); });
  if (hostileTo(b.A)) return 'B';
  if (hostileTo(b.B)) return 'A';
  return null;
}
function createBattles(byState) {
  byState.forEach((list, sid) => {
    if (list.length < 2) return;
    list.forEach(a => {
      if (a.battle) return;
      const foe = list.find(o => hostileTags(a.tag, o.tag));
      if (!foe) return;
      let b = foe.battle ? G.battles.find(x => x.id === foe.battle) : null;
      if (!b) {
        const attacker = a.arrived >= foe.arrived ? a : foe, defender = attacker === a ? foe : a;   // ataca quien llegó último
        b = {id: G.nextBattleId++, state: sid, A: [attacker.id], B: [defender.id], day: 0, att: 'A'};
        G.battles.push(b);
        attacker.battle = b.id; defender.battle = b.id; attacker.path = []; defender.path = [];
        const msg = `¡Batalla en ${G.S[sid].name}! ${G.C[attacker.tag].name} ataca a ${G.C[defender.tag].name}.`;
        if (attacker.tag === G.player || defender.tag === G.player) notify('war', msg, sid); else logMsg(msg);
      } else {
        const side = sideOfBattle(b, a);
        if (side) { b[side].push(a.id); a.battle = b.id; a.path = []; }
      }
    });
    // incorporar el resto de ejércitos presentes
    list.forEach(a => { if (a.battle) return; const b = G.battles.find(x => x.state === sid); if (b) { const side = sideOfBattle(b, a); if (side) { b[side].push(a.id); a.battle = b.id; a.path = []; } } });
  });
}
function sideStats(b, ids, isAttacker) {
  let F = 0, T = 0, n = 0, org = 0, orgN = 0;
  const s = G.S[b.state]; const terr = terrainInfo(s);
  ids.forEach(id => {
    const a = armyById(id); if (!a) return;
    const c = G.C[a.tag];
    const am = 1 + c.mods.army + (a.gen.atk - 1) * 0.05 + blocArmyBonus(c), dm = 1 + c.mods.army * 0.6 + (c.mods.defense || 0) + (a.gen.def - 1) * 0.05;
    a.divs.forEach(d => {
      const info = DIVS[d.t];
      if (n < BATTLE_WIDTH) {
        const str = d.s * (0.55 + 0.45 * d.o / info.org);
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
      const c = G.C[a.tag];
      let w = 0;
      a.divs.forEach((d, i) => {
        if (i >= BATTLE_WIDTH) return;
        const info = DIVS[d.t];
        d.o = Math.max(0, d.o - info.org * orgLoss / 100 * (0.8 + Math.random() * 0.4));
        const sl = (orgLoss / 100) * 0.38 * (0.6 + 0.8 * (1 - d.o / info.org));
        d.s = Math.max(0, d.s - sl); lost += sl * MEN_PER_DIV;
      });
      // las divisiones destruidas desaparecen
      a.divs = a.divs.filter(d => d.s > 0.04);
      if (a.divs.length === 0) { a._dead = true; }
      void c; void w;
    });
    return lost;
  };
  const lostB = apply(B, dmg(rAB)), lostA = apply(A, dmg(rBA));
  b.lostA = (b.lostA || 0) + lostA; b.lostB = (b.lostB || 0) + lostB;
  A.forEach(a => bleed(a.tag, lostA / Math.max(1, A.length))); B.forEach(a => bleed(a.tag, lostB / Math.max(1, B.length)));
  b.rA = rBA; b.rB = rAB; b.orgA = sa.org; b.orgB = sb.org;
  // fin del combate
  G.armies = G.armies.filter(a => !a._dead);
  const A2 = b.A.map(armyById).filter(Boolean), B2 = b.B.map(armyById).filter(Boolean);
  const oA = A2.length ? sideStats(b, b.A, true).org : 0, oB = B2.length ? sideStats(b, b.B, true).org : 0;
  if (!A2.length || !B2.length) { endBattle(b, A2.length ? 'A' : 'B'); return; }
  if (b.day >= 3 && (oA < 0.18 || oB < 0.18)) endBattle(b, oA < oB ? 'B' : 'A');
}
// Bajas: se restan de la población de reclutamiento del país
function bleed(tag, men) {
  if (men <= 0) return;
  const c = G.C[tag]; if (!c || !c.states.length) return;
  c.cnt = c.cnt || {}; c.cnt.casualties = (c.cnt.casualties || 0) + men;
  let left = men;
  for (let k = 0; k < 4 && left > 0; k++) { const s = G.S[pick(c.states)]; const take = Math.min(left, (s.pops.peasants || 0) * 0.02); s.pops.peasants -= take; left -= take; }
}
function endBattle(b, winner) {
  G.battles = G.battles.filter(x => x !== b);
  const win = (winner === 'A' ? b.A : b.B).map(armyById).filter(Boolean), lose = (winner === 'A' ? b.B : b.A).map(armyById).filter(Boolean);
  win.forEach(a => { a.battle = null; a.rest = 0; a.gen.xp += 8; if (a.gen.xp >= a.gen.lvl * 30 && a.gen.lvl < 5) { a.gen.xp = 0; a.gen.lvl++; const k = pick(['atk', 'def', 'log']); a.gen[k] = Math.min(5, a.gen[k] + 1); if (a.tag === G.player) notify('war', `${a.gen.name} sube a nivel ${a.gen.lvl}.`); } });
  lose.forEach(a => { a.battle = null; retreatArmy(a, b); });
  // puntuación de batallas en las guerras implicadas
  const wt = win[0] ? win[0].tag : null, lt = lose[0] ? lose[0].tag : null;
  if (wt && lt) G.wars.forEach(w => { const wa = w.attAll.includes(wt) && w.defAll.includes(lt), wd = w.defAll.includes(wt) && w.attAll.includes(lt); if (wa || wd) { w.bw = w.bw || {att: 0, def: 0}; if (wa) w.bw.att++; else w.bw.def++; } });
  if (win[0] && (win[0].tag === G.player || (lose[0] && lose[0].tag === G.player))) notify('war', `Batalla de ${G.S[b.state].name}: victoria de ${G.C[wt].name}.`, b.state);
}
function retreatArmy(a, b) {
  const sidesOwn = tag => sameSide(a.tag, tag);
  const nb = G.S[a.loc].neigh.filter(n => canEnter(a.tag, n) && !armiesAt(n).some(o => hostileTags(a.tag, o.tag)));
  let dest = nb.find(n => n === a.from) ?? null;
  if (dest === null) dest = nb.sort((x, y) => (sidesOwn(G.S[y].owner) ? 1 : 0) - (sidesOwn(G.S[x].owner) ? 1 : 0))[0] ?? null;
  a.path = [];
  if (dest === null) {      // rodeado: pierde parte de la fuerza y se reorganiza en el estado propio más cercano
    a.divs.forEach(d => { d.s *= 0.75; d.o *= 0.5; });
    const home = nearestOwnState(a.tag, a.loc); if (home !== null) a.loc = home;
    return;
  }
  a.loc = dest; a.from = null; a.arrived = G.date.t; a.divs.forEach(d => { d.o = Math.min(d.o, DIVS[d.t].org * 0.3); });
}
function armiesAt(sid) { return G.armies.filter(a => a.loc === sid); }
function nearestOwnState(tag, from) {
  const c = G.C[tag]; let best = null, bd = 1e9;
  c.states.forEach(id => { if (armiesAt(id).some(o => hostileTags(tag, o.tag))) return; const d = distStates(G.S[from], G.S[id]); if (d < bd) { bd = d; best = id; } });
  return best;
}

/* ---------- jornada militar ---------- */
function militaryDay() {
  if (!G.armies) return;
  if (!G.hostile) recalcHostile();
  recalcHostileIfNeeded();
  if (G.armies.length) {
    G.armies.forEach(stepMove);
    const byState = new Map();
    G.armies.forEach(a => { (byState.get(a.loc) || byState.set(a.loc, []).get(a.loc)).push(a); });
    createBattles(byState);
    G.battles.slice().forEach(battleDay);
    G.armies.forEach(a => {
      if (a.battle) return;
      const own = G.S[a.loc].owner === a.tag || sameSide(a.tag, G.S[a.loc].owner);
      a.rest++;
      a.divs.forEach(d => {
        const info = DIVS[d.t];
        d.o = Math.min(info.org, d.o + info.org * (own ? 0.06 : 0.025) * (a.path.length ? 0.4 : 1));
        if (own && d.s < 1 && !a.path.length) { const g = Math.min(1 - d.s, 0.006); const men = g * MEN_PER_DIV; const s = G.S[a.loc]; if ((s.pops.peasants || 0) > men * 4 && G.C[a.tag].treasury > -1e12) { d.s += g; s.pops.peasants -= men; } }
      });
    });
    occupationDay();
  }
  // reclutamiento en curso
  for (let i = G.recruits.length - 1; i >= 0; i--) {
    const r = G.recruits[i]; r.days--;
    if (r.days > 0) continue;
    G.recruits.splice(i, 1);
    const c = G.C[r.tag]; if (!c || !c.states.length) continue;
    const loc = G.S[r.state].owner === r.tag ? r.state : c.capital;
    let a = G.armies.find(x => x.tag === r.tag && x.loc === loc && !x.battle && x.divs.length < MAX_DIVS_ARMY && !x.path.length);
    if (!a) a = mkArmy(r.tag, loc, []);
    a.divs.push(mkDivision(r.type));
    if (r.tag === G.player) notify('war', `Nueva división de ${DIVS[r.type].name.toLowerCase()} en ${G.S[loc].name}.`, loc);
  }
  G.wars.forEach(w => { w.score = computeWarScore(w); });
}
let _hostileSig = '';
function recalcHostileIfNeeded() {
  const sig = G.wars.map(w => w.id + ':' + w.attAll.join('') + '>' + w.defAll.join('')).join(';');
  if (sig !== _hostileSig) { _hostileSig = sig; recalcHostile(); }
}

/* ---------- ocupación ---------- */
function occupationDay() {
  const changed = new Set();
  const byState = new Map();
  G.armies.forEach(a => { if (!a.battle) (byState.get(a.loc) || byState.set(a.loc, []).get(a.loc)).push(a); });
  G.S.forEach(s => {
    const owner = s.owner; if (owner === NONE) { if (s.occ) { s.occ = 0; s.occBy = null; changed.add(s.id); } return; }
    const here = byState.get(s.id) || [];
    const enemy = here.find(a => hostileTags(a.tag, owner)), friend = here.some(a => a.tag === owner || sameSide(a.tag, owner) && !hostileTags(a.tag, owner));
    let occ = s.occ || 0, by = s.occBy;
    if (enemy && !friend) {
      if (!by || by === enemy.tag || !sameSide(by, enemy.tag)) { by = enemy.tag; }
      if (occ === 0 && typeof computeFrontRank === 'function') { const w = G.wars.find(x => (x.attAll.includes(enemy.tag) && x.defAll.includes(owner)) || (x.defAll.includes(enemy.tag) && x.attAll.includes(owner))); const side = new Set(w ? (w.attAll.includes(enemy.tag) ? w.attAll : w.defAll) : [enemy.tag]); computeFrontRank(s.id, side); }
      occ = Math.min(1, occ + 0.1);
    } else if (friend && occ > 0) occ = Math.max(0, occ - 0.2);
    else if (!enemy && occ > 0 && occ < 1) occ = Math.max(0, occ - 0.1);
    occ = Math.round(occ * 100) / 100;
    if (occ !== (s.occ || 0) || (occ > 0 && by !== s.occBy)) { s.occ = occ; s.occBy = occ > 0 ? by : null; changed.add(s.id); if (occ >= 1 && !s._occNotified) { s._occNotified = true; if (owner === G.player || by === G.player) notify('war', `${G.S[s.id].name} ha sido ocupada por ${G.C[by].name}.`, s.id); } if (occ === 0) s._occNotified = false; }
  });
  if (changed.size && typeof onFrontChanged === 'function') onFrontChanged(changed);
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
  const s = G.S[sid]; c.treasury -= recruitCost(c, type); s.pops.peasants -= MEN_PER_DIV;
  G.recruits.push({tag: c.tag, state: sid, type, days: DIVS[type].days});
  return {ok: true};
}
function disbandArmy(a) {
  if (a.battle) return;
  const men = armyMen(a), s = G.S[a.loc]; if (s && s.owner === a.tag) s.pops.peasants += men * 0.8;
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
  G.armies = []; G.battles = []; G.recruits = []; G.nextArmyId = 1; G.nextBattleId = 1;
  G.tags.forEach(t => {
    if (t === NONE) return; const c = G.C[t]; if (!c.states.length) return;
    const lim = divLimit(c); let n = Math.min(Math.floor(lim * 0.7), 160); if (n < 1 && lim >= 1) n = 1; if (!n || lim < 1) return;
    const barr = c.states.filter(id => G.S[id].b.barracks >= 1);
    const homes = barr.length ? barr : [c.capital >= 0 ? c.capital : c.states[0]];
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
function aiMilitary() {
  G.tags.forEach(t => {
    if (t === NONE) return; const c = G.C[t];
    if (!c.ai || !c.wars.length) return;
    const enemies = G.tags.filter(o => hostileTags(t, o));
    if (!enemies.length) return;
    const mine = armiesOf(t).filter(a => !a.battle);
    const capital = c.capital;
    // 1) defender la capital si hay enemigos cerca
    const threat = capital >= 0 && G.S[capital].neigh.concat([capital]).some(n => armiesAt(n).some(o => hostileTags(t, o.tag)));
    mine.forEach(a => {
      if (a.path.length && !threat) return;
      if (threat && capital >= 0 && a.loc !== capital) { const near = distStates(G.S[a.loc], G.S[capital]) < 14; if (near || mine.length < 3) { orderMove(a, capital); return; } }
      if (a.path.length) return;
      // 2) atacar el estado enemigo vecino más débil / objetivo de guerra
      const strA = armyStr(a) * a.divs.length;
      if (armyOrg(a) < 0.55 && G.S[a.loc].owner === t) return;                  // se reorganiza
      const cands = [];
      const consider = sid => {
        if (!canEnter(t, sid)) return;
        const foes = armiesAt(sid).filter(o => hostileTags(t, o.tag)); const fs = foes.reduce((x, o) => x + armyStr(o) * o.divs.length, 0);
        const owner = G.S[sid].owner; const enemyOwned = owner !== NONE && hostileTags(t, owner);
        if (!enemyOwned && !foes.length) return;
        if (fs > strA * 1.3) return;
        let score = 10 - fs * 2 + (enemyOwned ? 4 : 0) + (G.S[sid].occ >= 1 && G.S[sid].occBy === t ? -8 : 0) + (G.S[sid].occ < 1 ? 2 : 0);
        G.wars.forEach(w => { if (w.targets.includes(sid) && w.attAll.includes(t)) score += 6; });
        if (enemies.some(e => G.C[e].capital === sid)) score += 5;
        cands.push({sid, score});
      };
      G.S[a.loc].neigh.forEach(consider);
      // enemigos dentro de nuestro territorio: ir a por ellos
      if (!cands.length) {
        let tgt = null, td = 1e9;
        G.armies.forEach(o => { if (!hostileTags(t, o.tag) || o.battle) return; const os = G.S[o.loc].owner; if (os !== t && !sameSide(t, os)) return; const d = distStates(G.S[a.loc], G.S[o.loc]); if (d < td && armyStr(o) * o.divs.length < strA * 1.4) { td = d; tgt = o.loc; } });
        if (tgt !== null && tgt !== a.loc) { orderMove(a, tgt); return; }
      }
      if (cands.length) { cands.sort((x, y) => y.score - x.score); orderMove(a, cands[0].sid); return; }
      // 3) marchar hacia la frontera enemiga más cercana
      let best = null, bd = 1e9;
      enemies.forEach(e => G.C[e].states.forEach(id => { if (G.S[id].occ >= 1 && G.S[id].occBy && sameSide(t, G.S[id].occBy)) return; const d = distStates(G.S[a.loc], G.S[id]) - (G.wars.some(w => w.targets.includes(id)) ? 5 : 0); if (d < bd) { bd = d; best = id; } }));
      if (best !== null && best !== a.loc) { const p = findPath(a, best); if (p && p.length) { a.path = p.slice(0, 40); a.dest = best; a.hop = hopDays(a, a.loc, p[0]); } }
    });
  });
}
function aiRecruitCountry(t) {
  const c = G.C[t]; if (!c || !c.ai || !c.states.length) return;
  const sts = c.states.filter(id => G.S[id].b.barracks >= 1); if (!sts.length) return;
  const r = Math.random(); recruit(c, pick(sts), r < 0.65 ? 'inf' : r < 0.8 ? 'cav' : 'art');
}
function aiRecruitWeek() {
  G.tags.forEach(t => {
    if (t === NONE) return; const c = G.C[t]; if (!c.ai || !c.states.length) return;
    if (!c.wars.length && Math.random() > 0.03) return;
    let n = c.wars.length ? 2 : 1;
    const sts = c.states.filter(id => G.S[id].b.barracks >= 1);
    while (n-- > 0 && sts.length) { const r = Math.random(); const type = r < 0.65 ? 'inf' : r < 0.8 ? 'cav' : 'art'; recruit(c, pick(sts), type); }
  });
}
function evacuateForeignArmies() {
  G.armies.forEach(a => {
    const o = G.S[a.loc].owner;
    if (!(o === a.tag || o === NONE || sameSide(a.tag, o) || hostileTags(a.tag, o)) && !a.battle) {
      const home = nearestOwnState(a.tag, a.loc); if (home !== null) { a.loc = home; a.path = []; a.from = null; }
    }
  });
}
function cleanupArmies() {
  G.armies = G.armies.filter(a => G.C[a.tag] && G.C[a.tag].states.length);
  G.battles = G.battles.filter(b => b.A.some(id => armyById(id)) && b.B.some(id => armyById(id)));
  G.armies.forEach(a => { if (a.battle && !G.battles.some(b => b.id === a.battle)) a.battle = null; });
}
