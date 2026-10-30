/* ===== MARINA DE GUERRA =====
   Astilleros y buques según la época (fragata de vela 1836 · de vapor ~1850 · acorazado ~1860 · crucero y submarino ~1900 ·
   dreadnought ~1906), flotas con almirante en zonas marítimas, misiones (patrulla, bloqueo, escolta de convoyes e incursión),
   batallas navales automáticas, y bloqueo con puntuación de guerra (blockadeScore). La superioridad naval de una zona es necesaria
   para desembarcar sin pérdidas. */
const SHIP_TYPES = {
  sail: {name: 'Fragata de vela', icon: '⛵', att: 3, def: 3, spd: 1.0, pts: 40, days: 70, raid: 1.0, tech: null, up: 260},
  steam: {name: 'Fragata de vapor', icon: '🚢', att: 5.5, def: 4.5, spd: 1.2, pts: 70, days: 85, raid: 1.1, tech: 'steam_frigate', up: 420},
  ironclad: {name: 'Acorazado', icon: '🛳️', att: 12, def: 14, spd: 1.0, pts: 170, days: 140, raid: 0.6, tech: 'ironclad', up: 900},
  cruiser: {name: 'Crucero', icon: '🚤', att: 9, def: 6.5, spd: 1.6, pts: 130, days: 110, raid: 1.8, tech: 'cruisers', up: 700},
  sub: {name: 'Submarino', icon: '🐟', att: 8, def: 1.5, spd: 0.9, pts: 90, days: 100, raid: 2.6, tech: 'submarines', up: 500},
  dread: {name: 'Acorazado dreadnought', icon: '⚓', att: 30, def: 27, spd: 1.2, pts: 420, days: 220, raid: 0.5, tech: 'dreadnought', up: 2100}
};
const SHIP_ORDER = ['sail', 'steam', 'ironclad', 'cruiser', 'sub', 'dread'];
const NAV_MISSIONS = {
  patrol: {name: 'Patrulla', icon: '🧭', desc: 'Vigila la zona y la disputa a flotas enemigas.'},
  blockade: {name: 'Bloqueo', icon: '🚧', desc: 'Corta el comercio y el suministro por mar de un país enemigo en esa zona; suma puntuación de guerra.'},
  convoy: {name: 'Escolta de convoyes', icon: '🛡️', desc: 'Protege tus transportes y tu comercio de las incursiones; asegura los desembarcos.'},
  raid: {name: 'Incursión', icon: '🏴‍☠️', desc: 'Ataca el comercio del enemigo: le cuesta ingresos cada mes.'},
  port: {name: 'En puerto', icon: '⚓', desc: 'Reparación en el puerto base.'}
};
const shipsAvail = c => SHIP_ORDER.filter(k => !SHIP_TYPES[k].tech || hasTech(c, SHIP_TYPES[k].tech));
const fleetsOf = tag => mx().fl.filter(f => f.tag === tag);
const fleetShips = f => f.ships.length;
const shipPow = (s, key) => SHIP_TYPES[s.t][key] * Math.max(0.05, s.hp);
function fleetPower(f, key) { let p = 0; f.ships.forEach(s => { p += shipPow(s, key || 'att'); }); return p * (1 + 0.04 * ((f.adm && f.adm.lvl) || 1) - 0.04) * (1 + docMod(f.tag, 'nav')); }
function zonePower(tag, zone, side) {       // side: 'own' (propio y aliados) | 'foe'
  let p = 0;
  mx().fl.forEach(f => { if (f.zone !== zone || f.tr || !f.ships.length) return; const own = f.tag === tag || sameSide(tag, f.tag), foe = hostileTags(tag, f.tag); if ((side === 'own' && own && !foe) || (side === 'foe' && foe)) p += fleetPower(f) * (f.mission === 'convoy' ? 1.2 : 1); });
  return p;
}
// ¿es segura la zona para los transportes de un país? (el enemigo no la domina)
function zoneSecure(tag, zone) { const own = zonePower(tag, zone, 'own'), foe = zonePower(tag, zone, 'foe'); return foe <= own * 0.9 + 1e-6; }
function navalControl(tag, zone) { const own = zonePower(tag, zone, 'own'), foe = zonePower(tag, zone, 'foe'); return own + foe <= 0 ? 0 : (own - foe) / Math.max(own, foe); }

/* ---------- construcción ---------- */
const navalMoney = (c, type) => Math.round(SHIP_TYPES[type].pts * 120 * moneyPerPoint(c) / 25);
function shipyardsOf(c) { return c.states.filter(id => (G.S[id].b.shipyard || 0) >= 0.3 || MAP.stats[id].provs.some(p => MAP.provs[p].port) && (G.S[id].cap.shipyard || 0) > 0); }
function portsStates(c) { return c.states.filter(id => MAP.stats[id].provs.some(p => MAP.provs[p].port)); }
function shipCanBuild(c, type, sid) {
  const T = SHIP_TYPES[type]; if (T.tech && !hasTech(c, T.tech)) return `Necesitas la tecnología ${TECH[T.tech].name}.`;
  const s = G.S[sid]; if (!s || s.owner !== c.tag) return 'Elige un estado propio con puerto.';
  if (!MAP.stats[sid].provs.some(p => MAP.provs[p].port)) return 'El estado no tiene puerto.';
  if ((s.b.shipyard || 0) < 0.1) return 'Necesitas Astilleros en ese estado.';
  if (c.treasury < navalMoney(c, type)) return 'No tienes fondos.';
  if (mx().nq.filter(q => q.tag === c.tag).length >= 12) return 'La cola de construcción está llena.';
  return null;
}
function shipOrder(c, type, sid) {
  const err = shipCanBuild(c, type, sid); if (err) return {ok: false, msg: err};
  c.treasury -= navalMoney(c, type); mx().nq.push({tag: c.tag, type, state: sid, need: SHIP_TYPES[type].pts, done: 0, age: 0, min: SHIP_TYPES[type].days});
  return {ok: true, msg: `${SHIP_TYPES[type].name} encargado en ${G.S[sid].name}.`};
}
function homeZone(c, sid) { const ps = MAP.stats[sid !== undefined ? sid : c.capital].provs.filter(p => MAP.provs[p].port); return ps.length ? seaZoneOfProv(ps[0]) : null; }
function mainPortZone(c) { const z = countryZones(c); let b = null, bv = 0; z.forEach((v, k) => { if (v > bv) { bv = v; b = k; } }); return b; }
const ADM_NAMES = ['Nelson', 'Villeneuve', 'Nakhimov', 'Tegetthoff', 'Farragut', 'Cochrane', 'Jervis', 'Duperré', 'Lazarev', 'Persano', 'Togo', 'Tirpitz', 'Beatty', 'Jellicoe', 'Fisher', 'Scheer', 'Hipper', 'Mahan', 'Dewey', 'Rodney'];
const newAdmiral = () => ({name: pick(ADM_NAMES) + ' ' + pick(['I', 'II', 'III']), lvl: 1 + Math.floor(Math.random() * 2), xp: 0});
function newFleet(tag, zone, name) {
  const M = mx(), f = {id: M.nfl++, tag, zone, ships: [], adm: newAdmiral(), mission: 'port', target: null, name: name || `${fleetsOf(tag).length + 1}.ª Flota`, tr: null};
  M.fl.push(f); return f;
}
function addShip(c, type, zone) {
  let f = mx().fl.find(x => x.tag === c.tag && x.zone === zone && !x.tr && x.ships.length < 14);
  if (!f) f = newFleet(c.tag, zone); f.ships.push({t: type, hp: 1}); return f;
}
function navalBuildWeek() {
  const M = mx();
  M.nq = M.nq.filter(q => {
    const c = G.C[q.tag]; if (!c || !c.states.length || G.S[q.state].owner !== q.tag) return false;
    q.age += 7; const yard = G.S[q.state].b.shipyard || 0, cap = 6 + yard * 5;
    const take = Math.min(q.need - q.done, c.eq.ships || 0, cap); if (take > 0) { q.done += take; c.eq.ships -= take; }
    if (q.done >= q.need - 1e-6 && q.age >= q.min) { const z = homeZone(c, q.state); if (z !== null) { addShip(c, q.type, z); if (q.tag === G.player) notify('build', `${SHIP_TYPES[q.type].name} botado en ${G.S[q.state].name}.`, q.state); } return false; }
    return true;
  });
}
function navalWantPts(c) {
  if (!portsStates(c).length) return 0;
  const have = fleetsOf(c.tag).reduce((n, f) => n + f.ships.reduce((m, s) => m + SHIP_TYPES[s.t].pts, 0), 0) + mx().nq.filter(q => q.tag === c.tag).reduce((n, q) => n + q.need - q.done, 0);
  return Math.max(0, navalTargetPts(c) - have) * 0.5;
}
function navalTargetPts(c) { const coast = portsStates(c).length; if (!coast) return 0; const r = c.rank; const base = r <= 2 ? 2400 : r <= 5 ? 1500 : r <= 10 ? 800 : r <= 20 ? 380 : r <= 40 ? 160 : 60; const era = 1 + 1.6 * clamp((G.date.y - 1836) / 70, 0, 1); return base * Math.min(1.6, 0.5 + coast / 6) * era * clamp(c.ind * 1.6 + 0.4, 0.4, 1.4); }

/* ---------- movimiento y misiones ---------- */
function fleetMove(f, zone) {
  if (zone === f.zone && !f.tr) return; const from = f.tr ? f.tr.to : f.zone;
  let spd = 9; f.ships.forEach(s => { spd = Math.min(spd, SHIP_TYPES[s.t].spd); }); if (spd === 9) spd = 1;
  const days = Math.max(2, Math.ceil(zoneDist(from, zone) / (6 * spd)));
  f.tr = {to: zone, left: days}; f.zoneFrom = f.zone;
}
function fleetMission(f, mission, target) { f.mission = mission; f.target = target || null; }

/* ---------- jornada naval ---------- */
function navyDay() {
  const M = mx(); if (!M.fl.length) return;
  // desplazamientos
  M.fl.forEach(f => { if (f.tr && --f.tr.left <= 0) { f.zone = f.tr.to; f.tr = null; } });
  // reparación y desgaste
  M.fl.forEach(f => {
    const c = G.C[f.tag]; if (!c || f.tr) return; const home = f.zone === mainPortZone(c) || countryZones(c).has(f.zone);
    const rep = f.mission === 'port' && home ? 0.03 : home ? 0.008 : 0.0005;
    f.ships.forEach(s => { s.hp = Math.min(1, s.hp + rep); });
    if (f.mission !== 'port') { f.adm.xp += 0.08; }
    if (f.adm.xp >= f.adm.lvl * 40 && f.adm.lvl < 5) { f.adm.lvl++; f.adm.xp = 0; if (f.tag === G.player) notify('war', `${f.adm.name} asciende a nivel ${f.adm.lvl}.`); }
  });
  // batallas por zona
  const byZone = {}; M.fl.forEach(f => { if (!f.tr && f.ships.length) (byZone[f.zone] = byZone[f.zone] || []).push(f); });
  for (const z in byZone) {
    const list = byZone[z], tags = [...new Set(list.map(f => f.tag))];
    tags.forEach(a => tags.forEach(b => {
      if (a >= b || !hostileTags(a, b)) return;
      const fa = list.filter(f => f.tag === a), fb = list.filter(f => f.tag === b);
      const pa = fa.reduce((n, f) => n + fleetPower(f, 'att'), 0), pb = fb.reduce((n, f) => n + fleetPower(f, 'att'), 0);
      if (pa <= 0 || pb <= 0) return;
      // flotas en puerto no salen a combatir salvo que el enemigo sea mucho más débil
      navalBattle(+z, a, fa, pa, b, fb, pb);
    }));
  }
  M.fl = M.fl.filter(f => f.ships.length && G.C[f.tag] && G.C[f.tag].states.length);
}
function navalBattle(z, a, fa, pa, b, fb, pb) {
  const hit = (fleets, foeAtt, ownDef, tag) => { let sunk = 0;
    fleets.forEach(f => f.ships = f.ships.filter(s => {
      const T = SHIP_TYPES[s.t]; const k = clamp(0.05 * foeAtt / Math.max(10, ownDef) * (6 / (6 + T.def)) * (0.7 + Math.random() * 0.6) * (1 - docMod(tag, 'navdef')), 0, 0.22);
      s.hp -= k; if (s.hp <= 0.04) { sunk++; return false; } return true; }));
    return sunk; };
  const defA = fa.reduce((n, f) => n + fleetPower(f, 'def'), 0), defB = fb.reduce((n, f) => n + fleetPower(f, 'def'), 0);
  const sb = hit(fb, pa, defB, b), sa = hit(fa, pb, defA, a);
  if (sa) xpGain(b, 'navy', sa * 1.2); if (sb) xpGain(a, 'navy', sb * 1.2); xpGain(a, 'navy', 0.05); xpGain(b, 'navy', 0.05);
  fa.concat(fb).forEach(f => { f.adm.xp += 0.5; });
  const B = mx(); B.nlog = B.nlog || []; if (sa + sb > 0) { B.nlog.unshift({z, a, b, sa, sb, date: dateStr ? dateStr() : ''}); if (B.nlog.length > 12) B.nlog.length = 12; if (a === G.player || b === G.player) notify('war', `Batalla naval en ${SEA_ZONES[z].name}: ${G.C[a].name} pierde ${sa} buques, ${G.C[b].name} pierde ${sb}.`); }
  // la flota muy dañada se retira al puerto
  [[fa, pa, pb], [fb, pb, pa]].forEach(([fl, own, foe]) => fl.forEach(f => { if (!f.ships.length) return; const avg = f.ships.reduce((n, s) => n + s.hp, 0) / f.ships.length; if (avg < 0.4 || own < foe * 0.35) { const c = G.C[f.tag]; const hz = mainPortZone(c); if (hz !== null && hz !== f.zone) { fleetMove(f, hz); f.mission = 'port'; f.target = null; } else f.mission = 'port'; } }));
}

/* ---------- bloqueo, incursiones y suministro ---------- */
// fracción de los puertos de un país bloqueados (0..1)
function blockadeFrac(tag) {
  const c = G.C[tag]; if (!c || !c.states.length) return 0; const M = mx(); if (!M.fl.length) return 0;
  const zs = countryZones(c); let tot = 0, blk = 0;
  zs.forEach((n, z) => { tot += n; const foe = fleetsBlockading(tag, z); if (foe > 0 && foe > zonePower(tag, z, 'own')) blk += n; });
  return tot ? blk / tot : 0;
}
function fleetsBlockading(tag, z) { let p = 0; mx().fl.forEach(f => { if (f.zone === z && !f.tr && f.mission === 'blockade' && f.ships.length && hostileTags(tag, f.tag) && (!f.target || f.target === tag)) p += fleetPower(f); }); return p; }
function portBlockaded(tag, pid) { if (!G.mx || !G.mx.fl.length) return false; const z = seaZoneOfProv(pid); const foe = fleetsBlockading(tag, z); return foe > 0 && foe > zonePower(tag, z, 'own'); }
// gancho de la puntuación de guerra: el bando que bloquea gana puntos
function blockadeScore(w) {
  if (!G.mx || !G.mx.fl.length) return 0;
  const side = list => { let s = 0, n = 0; list.forEach(t => { const w2 = G.C[t].stats.pop; s += blockadeFrac(t) * w2; n += w2; }); return n ? s / n : 0; };
  return Math.round(clamp(22 * (side(w.defAll) - side(w.attAll)), -22, 22));
}
function raidLoss(tag) {
  const c = G.C[tag]; let raid = 0, convoy = 0; const zs = countryZones(c);
  mx().fl.forEach(f => { if (f.tr || !f.ships.length) return;
    if (f.mission === 'raid' && hostileTags(tag, f.tag) && zs.has(f.zone) && (!f.target || f.target === tag)) f.ships.forEach(s => { raid += SHIP_TYPES[s.t].raid * (0.4 + s.hp * 0.6); });
    if ((f.mission === 'convoy' || f.mission === 'patrol') && (f.tag === tag || sameSide(tag, f.tag)) && zs.has(f.zone)) f.ships.forEach(s => { convoy += (f.mission === 'convoy' ? 1.2 : 0.6) * (0.5 + SHIP_TYPES[s.t].att / 12); }); });
  let boost = 0; mx().fl.forEach(f => { if (f.mission === 'raid') boost = Math.max(boost, 0); });
  return clamp(raid * (1 + docRaid(tag)) / (raid + convoy + 3), 0, 0.9) * (raid > 0 ? 1 : 0) + boost;
}
function docRaid(tag) { let m = 0; mx().fl.forEach(f => { if (f.mission === 'raid' && hostileTags(tag, f.tag)) m = Math.max(m, docMod(f.tag, 'raid')); }); return m; }
function navalMonth(c) {
  const M = mx(); if (c.tag === NONE) return;
  const fl = M.fl.filter(f => f.tag === c.tag); let up = 0; fl.forEach(f => f.ships.forEach(s => { up += SHIP_TYPES[s.t].up; }));
  if (up) c.treasury -= up * moneyPerPoint(c) / 200;
  if (!c.wars.length && !M.fl.some(f => f.mission === 'raid' || f.mission === 'blockade')) return;
  const inc = Math.max(0, c.stats.income) * 4.3, blk = blockadeFrac(c.tag), rd = raidLoss(c.tag);
  const loss = inc * (0.22 * blk + 0.07 * rd); if (loss > 0) { c.treasury -= loss; c.wearV = (c.wearV || 0) + (blk + rd) * 0.6; if (c.tag === G.player && loss > inc * 0.02) notify('war', `El ${blk > 0 ? 'bloqueo' : 'comercio enemigo'} te cuesta ${money(loss)} este mes.`); }
}
// los transportes de un desembarco sufren pérdidas si la zona no es segura
function navalLandingAttrition(a) {
  if (!a.sea || !G.mx || !G.mx.fl.length) return;
  const zs = [seaZoneOfProv(a.sea.from), seaZoneOfProv(a.sea.to)];
  let worst = 0; zs.forEach(z => { if (!zoneSecure(a.tag, z)) { const foe = zonePower(a.tag, z, 'foe'), own = zonePower(a.tag, z, 'own'); worst = Math.max(worst, clamp(0.05 + foe / (own + foe + 5) * 0.12, 0.05, 0.18)); } });
  if (!worst) return;
  a.divs.forEach(d => { d.s = Math.max(0, d.s - worst * (0.6 + Math.random() * 0.8)); d.o = Math.max(0, d.o - DIVS[d.t].org * worst * 0.5); });
  a.divs = a.divs.filter(d => d.s > 0.05); if (!a.divs.length) a._dead = true;
  if (a.tag === G.player && (G.date.t % 3 === 0)) notify('war', `¡${a.name} sufre pérdidas en el mar: el enemigo domina ${SEA_ZONES[zs[0]].name}! Escolta tus transportes con una flota.`);
}

/* ---------- flotas iniciales ---------- */
function initNavies() {
  const M = mx(); M.fl = []; M.nq = [];
  G.tags.forEach(t => {
    if (t === NONE) return; const c = G.C[t]; if (!c.states.length) return;
    const z = mainPortZone(c); if (z === null) return;
    const n = Math.round(navalTargetPts(c) * 0.55 / 40); if (n < 1) return;
    let left = n; while (left > 0) { const k = Math.min(left, 8 + Math.floor(Math.random() * 4)); const f = newFleet(t, z); for (let i = 0; i < k; i++) f.ships.push({t: 'sail', hp: 0.85 + Math.random() * 0.15}); left -= k; f.mission = 'port'; }
  });
  mxEnsureEq();
}
function mxEnsureEq() { G.tags.forEach(t => { if (t === NONE) return; const c = G.C[t]; c.eq = c.eq || {}; ['mgs', 'aircraft', 'ships'].forEach(g => { if (c.eq[g] === undefined) c.eq[g] = 0; }); }); }

/* ---------- IA naval ---------- */
function navalAI(c) {
  const M = mx(), fl = fleetsOf(c.tag); if (!portsStates(c).length) return;
  // construcción: el mejor casco disponible en el astillero más potente
  const avail = shipsAvail(c); if (avail.length && M.nq.filter(q => q.tag === c.tag).length < (c.rank <= 8 ? 5 : 2)) {
    const have = fleetShips(fl[0] || {ships: []}); void have;
    const raider = mc(c).doc.navy === 'raid'; const mix = Math.random();
    let type = avail[avail.length - 1]; if (type === 'dread' && Math.random() < 0.15) type = 'cruiser';
    if (raider && avail.includes('sub') && mix < 0.4) type = 'sub'; else if (raider && avail.includes('cruiser') && mix < 0.3) type = 'cruiser';
    if (avail.includes('cruiser') && mix < 0.18 && type !== 'sub') type = 'cruiser';
    const yards = portsStates(c).filter(id => (G.S[id].b.shipyard || 0) >= 0.1).sort((a, b) => (G.S[b].b.shipyard || 0) - (G.S[a].b.shipyard || 0));
    if (yards.length) shipOrder(c, type, yards[0]);
  }
  // misiones
  const enemies = G.tags.filter(o => o !== NONE && hostileTags(c.tag, o) && alive(o));
  fl.forEach(f => {
    if (f.tr) return; const power = fleetPower(f);
    if (!enemies.length) { if (f.mission !== 'port' && f.mission !== 'patrol') { f.mission = 'port'; f.target = null; } const hz = mainPortZone(c); if (hz !== null && f.zone !== hz && !f.tr) fleetMove(f, hz); return; }
    // objetivo: el enemigo con más puertos al alcance
    let tgt = null, bz = null, bs = 0; enemies.forEach(e => { countryZones(G.C[e]).forEach((n, z) => { const s = n * 2 - zoneDist(f.zone, z) * 0.1 - zonePower(c.tag, z, 'foe') * 0.01; if (s > bs) { bs = s; tgt = e; bz = z; } }); });
    if (tgt === null) { f.mission = 'port'; return; }
    const foe = zonePower(c.tag, bz, 'foe');
    if (power > foe * 1.25 + 1) { if (f.zone !== bz) fleetMove(f, bz); f.mission = f.ships.some(s => SHIP_TYPES[s.t].raid >= 1.8) && Math.random() < 0.5 ? 'raid' : 'blockade'; f.target = tgt; }
    else { const hz = mainPortZone(c); if (hz !== null && f.zone !== hz) fleetMove(f, hz); f.mission = 'patrol'; f.target = null; }
  });
  // las flotas pequeñas se agrupan en la misma zona y misión (se mantiene su identidad)
}
function navalWeek() { navalBuildWeek(); G.tags.forEach(t => { if (t !== NONE && G.C[t].ai && G.C[t].states.length) navalAI(G.C[t]); }); }

/* ---------- interfaz ---------- */
function navyHtml() {
  const c = me(), M = mx(), fl = fleetsOf(G.player), avail = shipsAvail(c), ps = portsStates(c);
  const total = fl.reduce((n, f) => n + f.ships.length, 0);
  const zoneOpts = sel => SEA_ZONES.map(z => `<option value="${z.id}" ${z.id === sel ? 'selected' : ''}>${z.name}</option>`).join('');
  const fleetRow = f => { const cnt = {}; f.ships.forEach(s => cnt[s.t] = (cnt[s.t] || 0) + 1); const avg = f.ships.reduce((n, s) => n + s.hp, 0) / Math.max(1, f.ships.length);
    return `<div class="card"><div class="kv"><b>${f.name}</b><span>${f.tr ? `⛵ en ruta a ${SEA_ZONES[f.tr.to].name} (${f.tr.left} d)` : SEA_ZONES[f.zone].name}</span></div>
    <div class="kv sm"><span>Buques</span><b>${SHIP_ORDER.filter(k => cnt[k]).map(k => SHIP_TYPES[k].icon + cnt[k]).join(' ')}</b></div>
    <div class="kv sm"><span>Casco · Poder</span><b>${Math.round(avg * 100)}% · ${f1(fleetPower(f))}</b></div><div class="kv sm"><span>Almirante</span><b>${f.adm.name} (nivel ${f.adm.lvl})</b></div>
    <div class="btnrow"><select data-act="flmove" data-id="${f.id}">${zoneOpts(f.tr ? f.tr.to : f.zone)}</select>
    <select data-act="flmis" data-id="${f.id}">${Object.keys(NAV_MISSIONS).map(k => `<option value="${k}" ${f.mission === k ? 'selected' : ''}>${NAV_MISSIONS[k].icon} ${NAV_MISSIONS[k].name}</option>`).join('')}</select>
    ${f.mission === 'blockade' || f.mission === 'raid' ? `<select data-act="fltgt" data-id="${f.id}"><option value="">— cualquier enemigo —</option>${G.tags.filter(o => o !== NONE && hostileTags(G.player, o) && alive(o)).map(o => `<option value="${o}" ${f.target === o ? 'selected' : ''}>${G.C[o].name}</option>`).join('')}</select>` : ''}</div></div>`; };
  const q = M.nq.filter(x => x.tag === G.player);
  const blk = blockadeFrac(G.player);
  return `<div class="cols"><div class="col wide"><div class="card"><h3>⚓ Flotas <small class="dim">· ${total} buques</small></h3>${fl.length ? '' : '<p class="hint">No tienes flotas. Construye buques en tus astilleros.</p>'}</div>${fl.map(fleetRow).join('')}
    <div class="card"><h3>Batallas navales recientes</h3>${(M.nlog || []).slice(0, 6).map(l => `<div class="kv sm"><span>${SEA_ZONES[l.z].name}: ${flag(l.a, 'sm')} vs ${flag(l.b, 'sm')}</span><b>−${l.sa} / −${l.sb}</b></div>`).join('') || '<small class="dim">Sin combates.</small>'}</div></div>
    <div class="col"><div class="card"><h3>Astilleros y construcción</h3>
    <div class="kv sm"><span>Tonelaje en inventario</span><b>${fmtN(c.eq.ships || 0, 0)}</b></div><div class="kv sm"><span>Niveles de astilleros</span><b>${c.states.reduce((n, id) => n + (G.S[id].b.shipyard || 0), 0).toFixed(1)}</b></div>
    ${ps.length ? `<table class="tbl"><tbody>${avail.map(k => { const T = SHIP_TYPES[k]; const sid = ps.filter(id => (G.S[id].b.shipyard || 0) >= 0.1)[0]; const err = sid === undefined ? 'Necesitas astilleros en algún estado con puerto.' : shipCanBuild(c, k, sid);
      return `<tr><td>${T.icon} <b>${T.name}</b><br><small class="dim">ataque ${T.att} · defensa ${T.def} · ${T.pts} t · ${T.days} d</small></td><td class="r"><button data-act="shipnew" data-t="${k}" ${err ? 'disabled' : ''} ${err ? `data-tip="${escA(err)}"` : ''}>＋ ${money(navalMoney(c, k))}</button></td></tr>`; }).join('')}</tbody></table>` : '<p class="hint bad">No tienes estados con puerto.</p>'}
    ${q.map(x => `<div class="kv sm"><span>${SHIP_TYPES[x.type].icon} ${SHIP_TYPES[x.type].name} · ${G.S[x.state].name}</span><b>${Math.round(x.done / x.need * 100)}%</b></div>`).join('')}
    <p class="hint">Los buques se construyen con tonelaje de la línea de <b>Buques</b> (pestaña Producción) en estados con astilleros. Las flotas navegan entre zonas marítimas; la superioridad en una zona protege tus desembarcos.</p></div>
    <div class="card"><h3>Estado del comercio</h3><div class="kv sm"><span>Bloqueo de tus puertos</span><b class="${blk > 0 ? 'bad' : ''}">${Math.round(blk * 100)}%</b></div><div class="kv sm"><span>Incursiones enemigas</span><b class="${raidLoss(G.player) > 0 ? 'bad' : ''}">${Math.round(raidLoss(G.player) * 100)}%</b></div>
    ${Object.keys(NAV_MISSIONS).map(k => `<small class="dim">${NAV_MISSIONS[k].icon} <b>${NAV_MISSIONS[k].name}:</b> ${NAV_MISSIONS[k].desc}</small>`).join('<br>')}</div></div></div>`;
}
MX_TABS.push({id: 'navy', label: '⚓ Marina', html: navyHtml});
Object.assign(ACT, {
  shipnew: d => { const c = me(), sid = portsStates(c).filter(id => (G.S[id].b.shipyard || 0) >= 0.1)[0]; const r = sid === undefined ? {ok: false, msg: 'Necesitas astilleros.'} : shipOrder(c, d.t, sid); toast(r.ok ? '⚓' : '⚠️', r.msg); renderWindow(); },
  flmove: (d, el) => { const f = mx().fl.find(x => x.id === +d.id); if (f && el) fleetMove(f, +el.value); renderWindow(); },
  flmis: (d, el) => { const f = mx().fl.find(x => x.id === +d.id); if (f && el) { f.mission = el.value; f.target = null; } renderWindow(); },
  fltgt: (d, el) => { const f = mx().fl.find(x => x.id === +d.id); if (f && el) f.target = el.value || null; renderWindow(); }
});
