/* ===== SISTEMA MILITAR (Parte 1): divisiones, ejércitos, movimiento, batallas, ocupación e IA ===== */
const MEN_PER_DIV = 8000;
const DIVS = {
  inf: {name: 'Infantería de línea', icon: '🪖', att: 6, def: 9, spd: 1.0, org: 40, cost: 200, days: 24, desc: 'Barata y resistente. Fuerte en defensa.'},
  cav: {name: 'Caballería', icon: '🐎', att: 7, def: 5, spd: 1.6, org: 36, cost: 320, days: 34, desc: 'Muy rápida. Débil frente a posiciones defendidas.'},
  art: {name: 'Artillería', icon: '💣', att: 11, def: 4, spd: 0.8, org: 28, cost: 420, days: 42, desc: 'Gran poder de ataque, pero lenta y frágil.'}
};
const MAX_DIVS_ARMY = 12;
const BATTLE_WIDTH = 10;       // divisiones que combaten a la vez por bando
const GEN_SURNAMES = ['Wellesley', 'Moltke', 'Radetzky', 'Kutúzov', 'Ney', 'Soult', 'Bernadotte', 'Espartero', 'Narváez', 'Garibaldi', 'Cadorna', 'Pélissier', 'MacMahon', 'Scott', 'Taylor', 'Jackson', 'Lee', 'Ypsilanti', 'Ibrahim', 'Shimazu', 'Saigō', 'Zeng', 'Zuo', 'Xu', 'Nogi', 'Bolívar', 'Sucre', 'Santa Anna', 'Chassé', 'Dufour', 'Haynau', 'Wrangel', 'Roon', 'Steinmetz', 'Paskévich', 'Todleben', 'Napier', 'Havelock', 'Canrobert', 'Bosquet', 'Lamoricière', 'Zumalacárregui', 'Cabrera', 'Hoche', 'Kléber', 'Blücher', 'Gneisenau', 'Windischgrätz', 'Jellačić', 'Benedek'];

/* ---------- generales y rasgos ---------- */
const GEN_TRAITS = {
  offensive: {name: 'Ofensivo', icon: '⚔️', desc: '+12% de ataque', att: 0.12},
  defensive: {name: 'Defensivo', icon: '🛡️', desc: '+12% de defensa', def: 0.12},
  logistician: {name: 'Logístico', icon: '📦', desc: '+15% de velocidad y +10% de suministro', spd: 0.15, sup: 0.1},
  cavalry: {name: 'Maestro de caballería', icon: '🐎', desc: '+25% de ataque de la caballería', cav: 0.25},
  gunner: {name: 'Artillero', icon: '💣', desc: '+25% de ataque de la artillería y cañoneos más potentes', art: 0.25},
  trencher: {name: 'Fortificador', icon: '⛏️', desc: 'Se atrinchera el doble de rápido', dig: 1},
  march: {name: 'Marcha forzada', icon: '🥾', desc: 'La marcha forzada cuesta la mitad de organización', march: 0.5},
  charismatic: {name: 'Carismático', icon: '🎖️', desc: '+15% de organización y recuperación', org: 0.15},
  brave: {name: 'Temerario', icon: '🔥', desc: 'Más cargas desesperadas, con +10% de ataque', att: 0.1, brave: 1},
  trainer: {name: 'Instructor', icon: '🎓', desc: 'Las tropas se entrenan un 50% más rápido', train: 0.5}
};
const TRAIT_KEYS = Object.keys(GEN_TRAITS);
function newGeneral(lvl) {
  const r = () => 1 + Math.floor(Math.random() * 3) + (Math.random() < 0.15 ? 1 : 0);
  const g = {name: pick(GEN_SURNAMES), atk: Math.min(5, r()), def: Math.min(5, r()), log: Math.min(5, r()), xp: 0, lvl: 1, traits: []};
  if (Math.random() < 0.45) g.traits.push(pick(TRAIT_KEYS));
  if (lvl > 1) { g.lvl = lvl; g.atk = Math.min(5, g.atk + 1); if (Math.random() < 0.7) { const t = pick(TRAIT_KEYS); if (!g.traits.includes(t)) g.traits.push(t); } }
  return g;
}
function genMods(g) {
  const m = {att: 0, def: 0, spd: 0, sup: 0, cav: 0, art: 0, dig: 0, march: 1, org: 0, brave: 0, train: 0};
  (g.traits || []).forEach(k => { const t = GEN_TRAITS[k]; if (!t) return; ['att', 'def', 'spd', 'sup', 'cav', 'art', 'dig', 'org', 'brave', 'train'].forEach(x => { if (t[x]) m[x] += t[x]; }); if (t.march) m.march = t.march; });
  return m;
}
// generales de reserva del país (sin ejército)
function genPool(c) { c.gens = c.gens || []; return c.gens; }
function recruitGeneralCost(c) { return Math.round(moneyPerPoint(c) * 500); }
function recruitGeneral(c) {
  const cost = recruitGeneralCost(c);
  if (c.treasury < cost) return {ok: false, msg: 'No tienes fondos para reclutar un general.'};
  if (c.influence < 15) return {ok: false, msg: 'Necesitas 15 de influencia.'};
  if (genPool(c).length >= 8) return {ok: false, msg: 'Ya tienes 8 generales en reserva.'};
  c.treasury -= cost; c.influence -= 15; const g = newGeneral(Math.random() < 0.3 ? 2 : 1); genPool(c).push(g);
  return {ok: true, msg: `${g.name} se incorpora a la reserva de generales.`};
}
function assignGeneral(a, idx) {
  const c = G.C[a.tag], pool = genPool(c); if (idx < 0 || idx >= pool.length || a.battle) return false;
  const nw = pool.splice(idx, 1)[0]; pool.push(a.gen); a.gen = nw; return true;
}
function trainMod(d) { return 0.75 + 0.5 * (d.tr === undefined ? 0.5 : d.tr); }
const TRAIN_LEVELS = [[0.25, 'Recluta'], [0.5, 'Regular'], [0.75, 'Veterano'], [1.01, 'Élite']];
const trainName = tr => (TRAIN_LEVELS.find(l => tr < l[0]) || TRAIN_LEVELS[3])[1];
function armyTrain(a) { let t = 0; a.divs.forEach(d => t += d.tr === undefined ? 0.5 : d.tr); return a.divs.length ? t / a.divs.length : 0; }
function nextArmyId() { G.nextArmyId = (G.nextArmyId || 1); return G.nextArmyId++; }
function mkDivision(type, tr) { return {t: type, s: 1, o: DIVS[type].org, tr: tr === undefined ? 0.15 : tr}; }
function mkArmy(tag, loc, divs, name) {
  const a = {id: nextArmyId(), tag, loc, divs: divs || [], gen: newGeneral(), path: [], hop: 0, battle: null, from: null, arrived: G.date.t, rest: 0, dig: 0, sup: 1, front: null, plan: null, mode: null, fm: false, rail: false, patrol: null, joinTo: null, name: name || ''};
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
const mobK = c => (1 - 0.04 * (c.mob || 0)) * (typeof wearK === 'function' ? wearK(c) : 1);
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
  const lg = 1 + 0.1 * (a.gen.log - 1) + genMods(a.gen).spd + (typeof docMod === 'function' ? docMod(a.tag, 'spd') : 0);   // la velocidad es igual para todos los países
  const so = G.S[B.s]; const rail = (so.owner === a.tag || sameSide(a.tag, so.owner)) ? 1 - Math.min(0.35, (so.infra || 0) * 0.05) : 1;
  const mode = (a.fm ? 0.68 : 1) * (a.rail && so.owner !== NONE && (so.owner === a.tag || sameSide(a.tag, so.owner)) ? 0.35 : 1);
  return clamp(Math.round(provDist(fromId, toId) * 3.2 * B.terr.move * rail * mode / spd / lg), 2, 30);
}
const _ssCache = new Map(); let _ssSig = -1;
function sameSide(ta, tb) {
  if (ta === tb) return true;
  const sig = G.date.t * 7919 + G.wars.length * 131 + G.pacts.length * 17 + G.nextWarId;
  if (sig !== _ssSig) { _ssCache.clear(); _ssSig = sig; }
  const k = (G.C[ta].id << 10) | G.C[tb].id; let v = _ssCache.get(k);
  if (v === undefined) { v = G.wars.some(w => (w.attAll.includes(ta) && w.attAll.includes(tb)) || (w.defAll.includes(ta) && w.defAll.includes(tb))) || !!pactBetween('alliance', ta, tb); _ssCache.set(k, v); }
  return v;
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
function orderMove(a, dest, keepPlan, opts) {
  if (a.battle) return {ok: false, msg: 'El ejército está en combate.'};
  opts = opts || {};
  a.fm = !!opts.fm; a.rail = false;
  const p = findPath(a, dest);
  if (p === null) return {ok: false, msg: 'No hay un camino terrestre permitido hasta esa provincia.'};
  if (opts.rail) {
    const own = pid => { const o = provOwner(pid); return o === a.tag || sameSide(a.tag, o); };
    if (!own(a.loc) || !p.every(own)) return {ok: false, msg: 'El redespliegue ferroviario solo funciona por territorio propio o aliado.'};
    a.rail = true; a.divs.forEach(d => { d.o *= 0.85; });
  }
  a.mode = null; a.joinTo = null;
  a.path = p; a.dest = dest; a.hop = p.length ? hopDays(a, a.loc, p[0]) : 0; a.hopMax = a.hop; if (!keepPlan) { a.front = null; a.plan = null; a.chase = null; }
  return {ok: true, eta: p.reduce((t, s, i) => t + hopDays(a, i ? p[i - 1] : a.loc, s), 0)};
}
function armyEta(a) {
  if (!a.path.length) return 0; let t = a.hop; for (let i = 1; i < a.path.length; i++) t += hopDays(a, a.path[i - 1], a.path[i]); return t;
}
function stepMove(a) {
  if (a.sea || a.battle || !a.path.length) return;
  if (a.sup !== undefined && a.sup < 0.25 && Math.random() < 0.4) return;      // sin suministro avanza más despacio
  a.hop--;
  if (a.hop > 0) return;
  const next = a.path[0];
  if (!canEnter(a.tag, next)) { a.path = []; return; }
  a.from = a.loc; a.loc = next; a.arrived = G.date.t; a.path.shift();
  a.rest = 0; a.dig = 0;
  if (a.path.length) { a.hop = hopDays(a, a.loc, a.path[0]); a.hopMax = a.hop; } else { a.dest = null; a.fm = false; a.rail = false; }
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
  let F = 0, T = 0, n = 0, org = 0, orgN = 0, art = 0, cav = 0, gun = 0, brave = 0, tr = 0;
  const pv = MAP.provs[b.prov]; const terr = pv.terr;
  ids.forEach(id => {
    const a = armyById(id); if (!a) return;
    const c = G.C[a.tag], gm = genMods(a.gen);
    const dm0 = typeof docMod === 'function' ? docMod : () => 0;
    const air = typeof airBonus === 'function' ? airBonus(a.tag, b.state) : 0;
    const plan = a.plan && a.plan.ready ? 0.15 * Math.min(1, a.plan.days / 15) : 0;
    const sup = typeof supplyMod === 'function' ? supplyMod(a) : 1;
    const landPen = a.landed && G.date.t - a.landed < 6 ? 0.75 : 1;
    const dig = isAttacker ? 0 : Math.min(6, a.dig || 0) * 0.04 * (a.mode === 'hold' || a.mode === 'dig' ? 1.25 : 1);
    const am = (1 + c.mods.army + (a.gen.atk - 1) * 0.05 + gm.att + blocArmyBonus(c) + dm0(a.tag, 'att') + air + (isAttacker ? plan : 0)) * sup * landPen;
    const dm = (1 + c.mods.army * 0.6 + (c.mods.defense || 0) + (a.gen.def - 1) * 0.05 + gm.def + dm0(a.tag, 'def') + air + dig) * sup;
    brave += gm.brave; gun += gm.art;
    a.divs.forEach(d => {
      const info = DIVS[d.t];
      if (n < BATTLE_WIDTH + (terr.mnt > 0.4 ? -2 : 0)) {
        const tm = trainMod(d);
        const str = d.s * (0.55 + 0.45 * d.o / info.org) * tm * (typeof equipMod === 'function' ? equipMod(a.tag, d.t) : 1);
        const um = 1 + (d.t === 'cav' ? gm.cav : d.t === 'art' ? gm.art : 0);
        F += info.att * str * am * um; T += info.def * str * dm * (isAttacker ? 1 : terr.def);
        n++; tr += tm; if (d.t === 'art') art++; if (d.t === 'cav') cav++;
      }
      org += d.o / info.org; orgN++;
    });
  });
  return {F, T, n, org: orgN ? org / orgN : 0, art, cav, gun, brave, tr: n ? tr / n : 1};
}
// sucesos aleatorios de la batalla: cañoneo, cargas de caballería, cargas desesperadas, flanqueos…
function battleEvents(b, sa, sb) {
  const ev = {fA: 1, fB: 1, xA: 0, xB: 0, cA: 1, cB: 1};
  b.log = b.log || [];
  const say = (side, kind, text) => { b.log.push({d: b.day, k: kind, s: side, t: text}); if (b.log.length > 14) b.log.shift(); b.flash = {k: kind, s: side, d: b.day}; };
  const nm = side => G.C[(side === 'A' ? armyById(b.A[0]) : armyById(b.B[0]))?.tag || (side === 'A' ? b.A0 : b.B0)].name;
  const S = {A: sa, B: sb}, opp = s => s === 'A' ? 'B' : 'A';
  const add = (s, key, v) => { ev[key + s] = key === 'x' ? ev[key + s] + v : ev[key + s] * v; };
  if (b.day === 1) {          // cañoneo preparatorio del atacante
    const sd = b.att; if (S[sd].art > 0) { const x = Math.min(9, 2.2 * S[sd].art * (1 + S[sd].gun)); add(opp(sd), 'x', x); say(sd, 'barrage', `Cañoneo preparatorio de ${nm(sd)}: ${S[sd].art} baterías castigan las líneas enemigas.`); }
  }
  if (Math.random() > 0.3) return ev;
  const opts = [];
  ['A', 'B'].forEach(s => {
    const me = S[s], ot = S[opp(s)];
    if (me.org < 0.5 || me.brave > 0) opts.push([(me.org < 0.4 ? 3 : 1) + me.brave * 2, 'charge', s]);
    if (me.cav > 0) opts.push([2 + me.cav, 'cav', s]);
    if (me.art > 0) opts.push([2 + me.art, 'barrage', s]);
    opts.push([1.2, 'flank', s]);
    if (me.org < 0.45) opts.push([2, 'panic', s]);
    opts.push([1, 'reinf', s]);
    void ot;
  });
  opts.push([1.2, 'rain', 'A']);
  let tot = 0; opts.forEach(o => tot += o[0]); let r = Math.random() * tot, pickd = opts[0];
  for (const o of opts) { r -= o[0]; if (r <= 0) { pickd = o; break; } }
  const [, kind, s] = pickd, o = opp(s);
  if (kind === 'charge') { add(s, 'f', 1.7); add(s, 'c', 2.0); say(s, 'charge', `¡Carga desesperada de ${nm(s)}! Ataque brutal a costa de muchas bajas.`); }
  else if (kind === 'cav') { add(s, 'f', 1.3); add(o, 'x', 2.5 + (S[o].art > 0 ? 3 : 0)); say(s, 'cav', `La caballería de ${nm(s)} carga sobre el flanco${S[o].art > 0 ? ' y arrolla a la artillería' : ''}.`); }
  else if (kind === 'barrage') { add(o, 'x', Math.min(8, 1.6 * S[s].art * (1 + S[s].gun))); say(s, 'barrage', `Cañoneo de ${nm(s)}: la artillería castiga a ${nm(o)}.`); }
  else if (kind === 'flank') { add(s, 'f', 1.25); add(o, 'x', 3); say(s, 'flank', `${nm(s)} logra un flanqueo y desordena al enemigo.`); }
  else if (kind === 'panic') { add(s, 'x', 5); say(s, 'panic', `El pánico cunde en las filas de ${nm(s)}.`); }
  else if (kind === 'reinf') { add(s, 'x', -3); say(s, 'reinf', `Llegan refuerzos y levantan la moral de ${nm(s)}.`); }
  else if (kind === 'rain') { add('A', 'f', 0.85); add('B', 'f', 0.85); say('A', 'rain', 'Lluvia torrencial: el barro frena a ambos ejércitos.'); }
  return ev;
}
function battleDay(b) {
  b.day++;
  const A = b.A.map(armyById).filter(Boolean), B = b.B.map(armyById).filter(Boolean);
  if (!A.length || !B.length) { endBattle(b, A.length ? 'A' : 'B'); return; }
  const sa = sideStats(b, b.A, b.att === 'A'), sb = sideStats(b, b.B, b.att === 'B');
  const ev = battleEvents(b, sa, sb);
  const rnd1 = () => 0.85 + Math.random() * 0.3;
  const rAB = sa.F * ev.fA * rnd1() / Math.max(1, sb.T), rBA = sb.F * ev.fB * rnd1() / Math.max(1, sa.T);
  const dmg = (r) => clamp(3.3 * r, 0.4, 8);       // % de organización perdida por día
  const apply = (armies, orgLoss, extra, cas) => {
    let lost = 0;
    armies.forEach(a => {
      a.divs.forEach((d, i) => {
        if (i >= BATTLE_WIDTH) return;
        const info = DIVS[d.t];
        d.o = Math.max(0, d.o - info.org * (orgLoss + extra) / 100 * (0.8 + Math.random() * 0.4));
        const sl = (orgLoss / 100) * 0.38 * (0.6 + 0.8 * (1 - d.o / info.org)) * cas;
        d.s = Math.max(0, d.s - sl); lost += sl * MEN_PER_DIV;
        d.tr = Math.min(1, (d.tr === undefined ? 0.5 : d.tr) + 0.004);      // la experiencia de combate entrena
      });
      a.divs = a.divs.filter(d => d.s > 0.04);
      if (a.divs.length === 0) a._dead = true;
      if (typeof useAmmo === 'function') useAmmo(a);
    });
    return lost;
  };
  const lostB = apply(B, dmg(rAB), ev.xB, ev.cB), lostA = apply(A, dmg(rBA), ev.xA, ev.cA);
  b.lostA = (b.lostA || 0) + lostA; b.lostB = (b.lostB || 0) + lostB;
  A.forEach(a => bleed(a.tag, lostA / Math.max(1, A.length))); B.forEach(a => bleed(a.tag, lostB / Math.max(1, B.length)));
  b.rA = rBA; b.rB = rAB; b.orgA = sa.org; b.orgB = sb.org; b.sa = {F: sa.F, T: sa.T, n: sa.n, tr: sa.tr}; b.sb = {F: sb.F, T: sb.T, n: sb.n, tr: sb.tr};
  b.adv = clamp((b.adv || 0) + (rAB - rBA) * 0.09, -1, 1);
  b.hist = b.hist || []; b.hist.push([+sa.org.toFixed(3), +sb.org.toFixed(3)]); if (b.hist.length > 40) b.hist.shift();
  G.armies = G.armies.filter(a => !a._dead);
  const A2 = b.A.map(armyById).filter(Boolean), B2 = b.B.map(armyById).filter(Boolean);
  const oA = A2.length ? sideStats(b, b.A, true).org : 0, oB = B2.length ? sideStats(b, b.B, true).org : 0;
  if (!A2.length || !B2.length) { endBattle(b, A2.length ? 'A' : 'B'); return; }
  const th = list => list.some(a => a.mode === 'hold') ? 0.08 : 0.18;       // «mantener posición» resiste hasta el final
  if (b.day >= 5 && (oA < th(A2) || oB < th(B2))) endBattle(b, oA < oB ? 'B' : 'A');
}
// Bajas: se restan de la población de reclutamiento del país y suben el cansancio de guerra
function bleed(tag, men) {
  if (men <= 0) return;
  const c = G.C[tag]; if (!c || !c.states.length) return;
  c.cnt = c.cnt || {}; c.cnt.casualties = (c.cnt.casualties || 0) + men; if (typeof eqLoss === 'function') eqLoss(tag, men);
  c.wearV = (c.wearV || 0) + men / Math.max(1e5, c.stats.pop) * 240;
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
function armiesAt(pid) { return G.armies.filter(a => a.loc === pid && !a.sea); }
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
    landingDay(); G.armies.forEach(chaseDay); G.armies.forEach(joinDay); G.armies.forEach(patrolDay); G.armies.forEach(stepMove);
    const byProv = new Map();
    G.armies.forEach(a => { if (a.sea) return; (byProv.get(a.loc) || byProv.set(a.loc, []).get(a.loc)).push(a); });
    createBattles(byProv);
    G.battles.slice().forEach(battleDay);
    if (typeof supplyDay === 'function') supplyDay();
    G.armies.forEach(a => {
      if (a.battle) return;
      const owner = provOwner(a.loc), own = owner === a.tag || sameSide(a.tag, owner);
      a.rest++; { const gm = genMods(a.gen); const per = a.mode === 'dig' || gm.dig ? 2 : 4; if (!a.path.length && a.rest % per === 0) a.dig = Math.min(6, (a.dig || 0) + 1); }
      trainDay(a);
      if (a.fm && a.path.length) { const gm = genMods(a.gen); a.divs.forEach(d => { d.o = Math.max(0, d.o - DIVS[d.t].org * 0.012 * gm.march); }); if (armyOrg(a) < 0.35) { a.fm = false; if (a.tag === G.player) notify('war', `${a.name} cancela la marcha forzada por agotamiento.`, provState(a.loc)); } }
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
  G.armies.forEach(a => { if (!a.battle && !a.sea) (byProv.get(a.loc) || byProv.set(a.loc, []).get(a.loc)).push(a); });
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
  const eqm = typeof eqCheck === 'function' ? eqCheck(c, type) : null; if (eqm) return eqm;
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
      for (let i = 0; i < k; i++) { const r = Math.random(); divs.push(mkDivision(r < 0.7 ? 'inf' : r < 0.85 ? 'cav' : 'art', 0.4 + Math.random() * 0.3)); }
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
  G.armies.forEach(a => { if (a.tag === c.tag) a.divs.forEach(d => t += DIVS[d.t].cost * (a.mode === 'train' ? 1.4 : 1)); });
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
function saveExtra() { return {battleLog: G.battleLog || [], landings: G.landings || [], nextLand: G.nextLand || 1, shipQ: G.shipQ || [], shipReturns: G.shipReturns || [], beach: G.beach || {}, fronts: G.fronts || [], nextFront: G.nextFront || 1, dcrises: G.dcrises || [], nextDC: G.nextDC || 1, mov: G.movStore || null}; }
function loadExtra(x) { G.battleLog = (x && x.battleLog) || []; G.landings = (x && x.landings) || []; G.nextLand = (x && x.nextLand) || 1; G.shipQ = (x && x.shipQ) || []; G.shipReturns = (x && x.shipReturns) || []; G.beach = (x && x.beach) || {}; G.fronts = (x && x.fronts) || []; G.nextFront = (x && x.nextFront) || 1; G.dcrises = (x && x.dcrises) || []; G.nextDC = (x && x.nextDC) || 1; }

/* ---------- órdenes de movilidad al estilo HoI4 ---------- */
// juntar: el ejército va hacia otro propio y se fusiona al llegar
function orderJoin(a, target) {
  if (a === target || a.tag !== target.tag) return {ok: false, msg: 'No se puede juntar con ese ejército.'};
  const r = a.loc === target.loc ? {ok: true, eta: 0} : orderMove(a, target.loc);
  if (r.ok) { a.joinTo = target.id; a.front = null; a.plan = null; }
  return r;
}
function joinDay(a) {
  if (!a.joinTo || a.battle) return;
  const t = armyById(a.joinTo);
  if (!t || t.tag !== a.tag) { a.joinTo = null; return; }
  if (t.loc === a.loc && !t.battle) { if (!mergeArmies(t, a)) { a.joinTo = null; if (a.tag === G.player) notify('war', `${a.name} no cabe en ${t.name} (máx. ${MAX_DIVS_ARMY} divisiones).`, provState(a.loc)); } else if (a.tag === G.player) toastLater(`${a.name} se ha fusionado con ${t.name}.`); return; }
  if (a.dest !== t.loc && (G.date.t + a.id) % 2 === 0) { const p = findPath(a, t.loc); if (p && p.length) { a.path = p; a.dest = t.loc; if (a.hop <= 0) { a.hop = hopDays(a, a.loc, p[0]); a.hopMax = a.hop; } } }
}
function toastLater(msg) { if (typeof notify === 'function') notify('war', msg); }
function orderPatrol(a, dest) {
  const r = orderMove(a, dest); if (!r.ok) return r;
  a.patrol = [a.loc, dest]; return r;
}
function patrolDay(a) {
  if (!a.patrol || a.battle || a.path.length) return;
  const t = a.loc === a.patrol[0] ? a.patrol[1] : a.patrol[0];
  if (a.loc !== a.patrol[0] && a.loc !== a.patrol[1]) { a.patrol = null; return; }
  const keep = a.patrol; const r = orderMove(a, t, true); a.patrol = r.ok ? keep : null;
}
function orderStop(a) { a.path = []; a.dest = null; a.chase = null; a.joinTo = null; a.patrol = null; a.fm = false; a.rail = false; }
function setMode(a, mode) {          // 'hold' mantener posición · 'dig' atrincherar · 'train' entrenar · null
  if (a.battle) return;
  orderStop(a); a.mode = a.mode === mode ? null : mode; a.front = null;
}
function orderRetreat(a) {
  const h = nearestOwnProv(a.tag, a.loc); if (h === null) return {ok: false, msg: 'No hay territorio propio al que replegarse.'};
  const r = orderMove(a, h, false, {fm: true}); return r;
}
// ruta con puntos intermedios (Mayús + clic derecho añade un punto)
function addWaypoint(a, pid) {
  const last = a.path.length ? a.path[a.path.length - 1] : a.loc;
  const tmp = {tag: a.tag, divs: a.divs, gen: a.gen, loc: last, fm: a.fm, rail: false};
  const p = pathProvs(last, pid, (u, v) => canEnter(a.tag, v), (u, v) => hopDays(tmp, u, v), 6000);
  if (p === null) return {ok: false, msg: 'No hay camino hasta ese punto.'};
  const wasEmpty = !a.path.length; a.path = a.path.concat(p); a.dest = pid; a.mode = null; a.joinTo = null;
  if (wasEmpty && p.length) { a.hop = hopDays(a, a.loc, p[0]); a.hopMax = a.hop; }
  return {ok: true, eta: armyEta(a)};
}

/* ---------- entrenamiento ---------- */
function trainDay(a) {
  if (a.mode !== 'train' || a.path.length || a.battle) { if (a.mode === 'train' && a.battle) a.mode = null; return; }
  const own = provOwner(a.loc) === a.tag; if (!own) return;
  const s = G.S[provState(a.loc)], gm = genMods(a.gen), c = G.C[a.tag];
  const rate = 0.006 * (1 + gm.train) * (1 + 0.08 * Math.min(5, s.b.barracks || 0)) * (1 + (c.mods.army || 0));
  let any = false; a.divs.forEach(d => { if ((d.tr || 0) < 1) { d.tr = Math.min(1, (d.tr || 0) + rate); any = true; } });
  if (!any) { a.mode = null; if (a.tag === G.player) notify('war', `${a.name} ha completado su entrenamiento (${trainName(1)}).`, provState(a.loc)); }
}
// en paz, la IA entrena a los ejércitos que están quietos en casa
function aiTrainWeek() {
  G.armies.forEach(a => { const c = G.C[a.tag]; if (!c.ai || c.wars.length || a.battle || a.path.length || a.mode || a.front) return; if (provOwner(a.loc) === a.tag && armyTrain(a) < 0.9) a.mode = 'train'; });
}

/* ---------- frentes y planes de defensa / ataque ---------- */
// un frente es una línea de provincias a la que se asignan ejércitos; «defend» los reparte y atrinchera,
// «attack» los concentra (el plan gana hasta +15% de ataque con los días de preparación) y al ejecutarse avanza sobre los objetivos
function frontsOf(tag) { return (G.fronts || []).filter(f => f.tag === tag); }
function createFront(tag, line, mode, armyIds, targets) {
  G.fronts = G.fronts || []; G.nextFront = G.nextFront || 1;
  const f = {id: G.nextFront++, tag, name: `${mode === 'attack' ? 'Ofensiva' : 'Defensa'} ${G.nextFront - 1}`, line: line.slice(), mode, armies: armyIds.slice(), targets: (targets || []).slice(), active: false, phase: 'prep', prep: 0, asg: {}};
  G.fronts.push(f); armyIds.forEach(id => { const a = armyById(id); if (a) { a.front = f.id; a.joinTo = null; } });
  return f;
}
function deleteFront(f) {
  f.armies.forEach(id => { const a = armyById(id); if (a && a.front === f.id) { a.front = null; a.plan = null; if (a.mode === 'hold' || a.mode === 'dig') a.mode = null; } });
  G.fronts = G.fronts.filter(x => x !== f);
}
function frontArmies(f) { return f.armies.map(armyById).filter(a => a && a.tag === f.tag); }
function addToFront(f, a) { if (a.tag !== f.tag) return; if (!f.armies.includes(a.id)) f.armies.push(a.id); a.front = f.id; a.joinTo = null; a.patrol = null; f.dirty = true; }
function removeFromFront(f, a) { f.armies = f.armies.filter(id => id !== a.id); if (a.front === f.id) { a.front = null; a.plan = null; } f.dirty = true; }
// línea automática frente a un país: provincias propias adyacentes a provincias suyas y objetivos enemigos adyacentes
function autoFront(tag, enemy) {
  const line = [], targets = [];
  const mineSide = pid => { const o = provOwner(pid); return o === tag || sameSide(tag, o); };
  const seenT = new Set();
  G.C[tag].states.forEach(sid => MAP.stats[sid].provs.forEach(pid => {
    let edge = false; MAP.provs[pid].nb.forEach(q => { if (provOwner(q) === enemy && !mineSide(q)) { edge = true; if (!seenT.has(q)) { seenT.add(q); targets.push(q); } } });
    if (edge) line.push(pid);
  }));
  // ordenar la línea por proximidad para que se dibuje como una polilínea continua
  if (line.length > 2) { const out = [line.shift()]; while (line.length) { const l = out[out.length - 1]; let bi = 0, bd = 1e9; line.forEach((p, i) => { const d = provDist(l, p); if (d < bd) { bd = d; bi = i; } }); out.push(line.splice(bi, 1)[0]); } return {line: out, targets}; }
  return {line, targets};
}
function frontNeed(f, pid) {
  let need = 1; MAP.provs[pid].nb.forEach(q => { const o = provOwner(q); if (hostileTags(f.tag, o)) need += 1.2; armiesAt(q).forEach(e => { if (hostileTags(f.tag, e.tag)) need += 2 * e.divs.length / 4; }); });
  armiesAt(pid).forEach(e => { if (hostileTags(f.tag, e.tag)) need += 4; });
  return need;
}
function distributeFront(f) {
  const arms = frontArmies(f).filter(a => !a.battle); if (!arms.length || !f.line.length) return;
  const cover = {}; f.line.forEach(p => cover[p] = 0);
  const sorted = arms.slice().sort((x, y) => y.divs.length - x.divs.length);
  f.asg = {};
  sorted.forEach(a => {
    let best = f.line[0], bv = -1;
    f.line.forEach(p => { const v = frontNeed(f, p) / (1 + cover[p]) - provDist(a.loc, p) * 0.04; if (v > bv) { bv = v; best = p; } });
    cover[best] += a.divs.length; f.asg[a.id] = best;
  });
  f.dirty = false;
}
function frontTargets(f) {
  const ours = pid => { const o = provOwner(pid); const by = G.P[pid].by; return (o === f.tag || sameSide(f.tag, o)) && !(by && !sameSide(f.tag, by)) || (by && sameSide(f.tag, by)); };
  const out = [], seen = new Set();
  const base = new Set(f.line); G.P.forEach((p, pid) => { if (p.by && sameSide(f.tag, p.by)) base.add(pid); });
  base.forEach(pid => MAP.provs[pid].nb.forEach(q => { if (seen.has(q) || ours(q)) return; const o = provOwner(q); if (o !== NONE && hostileTags(f.tag, o)) { seen.add(q); out.push(q); } }));
  return out;
}
function frontsDay() {
  if (!G.fronts || !G.fronts.length) return;
  G.fronts.slice().forEach(f => {
    f.armies = f.armies.filter(id => { const a = armyById(id); return a && a.tag === f.tag; });
    const c = G.C[f.tag]; if (!c || !c.states.length) { G.fronts = G.fronts.filter(x => x !== f); return; }
    if (!f.active) return;
    const arms = frontArmies(f); if (!arms.length) return;
    if (f.mode === 'defend' || f.phase === 'prep') {
      if (f.dirty || (G.date.t + f.id) % 6 === 0) distributeFront(f);
      arms.forEach(a => {
        if (a.battle) return; const tgt = f.asg[a.id]; if (tgt === undefined) return;
        if (a.loc !== tgt) { if (!a.path.length || a.dest !== tgt) { const r = orderMove(a, tgt, true); if (!r.ok) { delete f.asg[a.id]; } else a.mode = null; a.front = f.id; } }
        else if (!a.path.length && a.mode !== 'dig') a.mode = f.mode === 'attack' ? 'dig' : 'hold';
      });
      if (f.mode === 'attack') {
        const ready = arms.filter(a => a.loc === f.asg[a.id]).length;
        if (ready) f.prep = Math.min(30, f.prep + 1);
        arms.forEach(a => { a.plan = {ready: a.loc === f.asg[a.id], days: f.prep}; });
        if (f.auto && f.prep >= 12 && ready >= arms.length * 0.7) { f.phase = 'attack'; }
      }
      return;
    }
    // fase de ataque
    let tg = f.targets.filter(p => { const o = provOwner(p); return o !== NONE && hostileTags(f.tag, o) && !(G.P[p].by && sameSide(f.tag, G.P[p].by)); });
    if (!tg.length) tg = frontTargets(f);
    f.targets = tg;
    if (!tg.length) { f.active = false; f.phase = 'prep'; f.prep = 0; arms.forEach(a => { a.plan = null; a.mode = null; }); if (f.tag === G.player) notify('war', `${f.name}: ofensiva completada, no quedan objetivos.`); return; }
    const taken = {};
    arms.forEach(a => { if (a.battle) return; if (a.path.length && a.dest !== undefined && tg.includes(a.dest)) { taken[a.dest] = (taken[a.dest] || 0) + 1; } });
    arms.forEach(a => {
      if (a.battle || a.path.length) return;
      let best = null, bv = 1e9;
      tg.forEach(p => { const v = provDist(a.loc, p) + (taken[p] || 0) * 6; if (v < bv) { bv = v; best = p; } });
      if (best !== null) { const r = orderMove(a, best, true); if (r.ok) { taken[best] = (taken[best] || 0) + 1; a.front = f.id; a.plan = {ready: true, days: f.prep}; } }
    });
    // la línea avanza con las provincias conquistadas
    if ((G.date.t + f.id) % 5 === 0) {
      const newLine = []; G.P.forEach((p, pid) => { if (p.by && sameSide(f.tag, p.by) && MAP.provs[pid].nb.some(q => hostileTags(f.tag, provOwner(q)) && !(G.P[q].by && sameSide(f.tag, G.P[q].by)))) newLine.push(pid); });
      if (newLine.length) f.line = f.line.filter(p => !(G.P[p].by && sameSide(f.tag, G.P[p].by))).concat(newLine).slice(0, 40);
    }
  });
}
function activateFront(f, on) {
  f.active = on; f.dirty = true;
  if (!on) frontArmies(f).forEach(a => { a.plan = null; if (a.mode === 'hold' || a.mode === 'dig') a.mode = null; });
}
function executeAttack(f) {
  if (f.mode !== 'attack') return {ok: false, msg: 'Este plan es de defensa.'};
  const tg = f.targets.length ? f.targets : frontTargets(f);
  if (!tg.length) return {ok: false, msg: 'No hay provincias enemigas junto a la línea (¿estás en guerra con ese país?).'};
  f.targets = tg; f.active = true; f.phase = 'attack';
  frontArmies(f).forEach(a => { if (a.mode === 'dig' || a.mode === 'hold') a.mode = null; });
  return {ok: true};
}
