/* ===== ASEDIOS DE CIUDADES IMPORTANTES =====
   Solo las CIUDADES GRANDES de provincias IMPORTANTES (la provincia capital de un estado muy poblado, la capital del país o una provincia con fuerte)
   se defienden tras sus murallas: ocuparlas ya no es cuestión de plantarse allí unos días. Al quedarse el enemigo sin oposición se abre un ASEDIO:
   · la MURALLA cae cada día (más rápido con artillería e ingenieros, más despacio si la ciudad tiene fuerte);
   · el HAMBRE sube cada día: con la comida agotada la ciudad se rinde;
   · en cualquier momento puedes ordenar el ASALTO: se libra una batalla táctica contra la guarnición, tras los muros y los cañones del fuerte
     (la muralla restante fija la integridad del fuerte). Si falla, el asedio se debilita; si triunfa, la ciudad cae.
   El resto de provincias se ocupan como siempre. */
const SIEGE_HUNGER_RATE = 1.1;
function siegeThreshold() { const y = G.date.y; if (!G._popTh || G._popTh.y !== y) { const a = G.S.map(s => s.popBase).sort((p, q) => p - q); G._popTh = {y, v: a[Math.floor(a.length * 0.9)] || 1}; } return G._popTh.v; }
function importantCity(pid) {
  const sid = provState(pid), s = G.S[sid]; if (!s || s.owner === NONE || stateCapitalProv(sid) !== pid) return false;
  const c = G.C[s.owner]; return s.popBase >= siegeThreshold() || (c && c.capital === sid && c.rank <= 20) || (G.P[pid].fort || 0) >= 2;
}
const siegeAt = pid => (G.sieges || []).find(x => x.pid === pid);
function siegeGarrison(pid) { const s = G.S[provState(pid)]; return clamp(2 + Math.floor(3 * s.popBase / siegeThreshold()) + (G.P[pid].fort || 0), 3, 9); }
function siegeStat(k) { G.siegeStats = G.siegeStats || {start: 0, assault: 0, fall: 0, hunger: 0, lifted: 0}; G.siegeStats[k]++; }
// llamado desde la ocupación: ¿resiste la ciudad? (true = aún no se puede ocupar)
function siegeBlocks(pid, enemy) {
  if (!importantCity(pid)) return false; G.sieges = G.sieges || []; let sg = siegeAt(pid);
  if (!sg) { const owner = G.S[provState(pid)].owner; sg = {pid, att: enemy.tag, owner, t0: G.date.t, walls: 100, hunger: 0, gar: siegeGarrison(pid), calm: 0}; G.sieges.push(sg); siegeStat('start');
    const msg = `${G.C[enemy.tag].name} sitia ${provName(pid)} (${G.S[provState(pid)].name}).`; if (enemy.tag === G.player || owner === G.player) notify('war', msg, provState(pid)); else logMsg(msg); }
  sg.att = enemy.tag; return !(sg.walls <= 0 || sg.hunger >= 100 || sg.fall);
}
function siegeAttackers(sg) { return G.armies.filter(a => !a.sea && a.loc === sg.pid && !a.battle && !a.garrison && hostileTags(a.tag, sg.owner)); }
function siegeDay() {
  if (!G.sieges || !G.sieges.length) return; const done = [];
  G.sieges.forEach(sg => {
    if (sg.assaulting) return;                       // durante el asalto el asedio queda en suspenso
    const here = G.armies.filter(a => !a.sea && a.loc === sg.pid), att = siegeAttackers(sg), defenders = here.some(a => !a.garrison && (a.tag === sg.owner || sameSide(a.tag, sg.owner)) && !hostileTags(a.tag, sg.owner));
    const s = G.S[provState(sg.pid)]; if (s.owner !== sg.owner || (G.P[sg.pid].by && sg.fall)) { done.push(sg); return; }
    if (!att.length || defenders) { sg.calm++; if (sg.calm >= 3) { done.push(sg); siegeStat('lifted'); const msg = `Se levanta el asedio de ${provName(sg.pid)}.`; if (sg.att === G.player || sg.owner === G.player) notify('war', msg, provState(sg.pid)); } return; } sg.calm = 0;
    att.forEach(a => { if (a.tag !== G.player && G.C[a.tag] && G.C[a.tag].ai && !sg.fall) { a.path = []; a.chase = null; } });       // la IA no abandona un asedio en marcha
    let arts = 0, eng = 0; att.forEach(a => a.divs.forEach(d => { if (dKind(d) === 'art') arts++; eng += (DIVS[d.t] && DIVS[d.t].fort) || 0; }));
    const lvl = G.P[sg.pid].fort || 0, wasW = sg.walls; sg.walls = Math.max(0, sg.walls - (1.1 + 2.7 * arts + 28 * eng) / (1 + 0.35 * lvl)); sg.hunger = Math.min(100, sg.hunger + SIEGE_HUNGER_RATE * (G.C[sg.owner].ai ? 1 : 1));
    const inv = sg.att === G.player || sg.owner === G.player;
    if (wasW > 0 && sg.walls <= 0 && inv) notify('war', `¡Brecha abierta en las murallas de ${provName(sg.pid)}! La ciudad ya puede ser tomada.`, provState(sg.pid));
    if (sg.hunger >= 100 && !sg.fall) { sg.fall = true; siegeStat('hunger'); if (inv) notify('war', `${provName(sg.pid)} se rinde por hambre.`, provState(sg.pid)); }
    // la IA asalta cuando la brecha está abierta y tiene superioridad
    if (G.C[sg.att] && G.C[sg.att].ai && sg.att !== G.player && !sg.assaulting && !sg.fall && sg.walls <= 30 && G.date.t - (sg.lastAss || -99) > 12) {
      const my = att.reduce((n, a) => n + a.divs.reduce((m, d) => m + d.s, 0), 0); if (my >= sg.gar * 0.85 * (1 - sg.hunger / 220) * 1.3) siegeAssault(sg.pid, sg.att);
    }
  });
  if (done.length) G.sieges = G.sieges.filter(x => !done.includes(x));
}
function siegeAssault(pid, tag) {
  const sg = siegeAt(pid); if (!sg || sg.assaulting || sg.fall) return {ok: false, msg: 'No hay un asedio al que asaltar.'}; const att = siegeAttackers(sg).filter(a => a.tag === tag || sameSide(a.tag, tag)); if (!att.length) return {ok: false, msg: 'No tienes tropas disponibles en la ciudad.'};
  const n = Math.max(2, Math.round(sg.gar * (1 - sg.hunger / 250))), divs = []; for (let i = 0; i < n; i++) { const t = i % 4 === 3 ? 'art' : i % 5 === 4 ? 'cav' : 'inf'; const d = mkDivision(t, 0.2); d.o = DIVS[t].org * (0.9 - sg.hunger / 400); d.s = clamp(0.95 - sg.hunger / 300, 0.5, 1); divs.push(d); }
  const g = mkArmy(sg.owner, pid, divs, `Guarnición de ${provName(pid)}`); g.garrison = true; g.arrived = G.date.t - 200; g.strat = 'hold'; sg.assaulting = true; sg.lastAss = G.date.t; siegeStat('assault');
  const msg = `${G.C[tag].name} lanza el asalto sobre ${provName(pid)}.`; if (tag === G.player || sg.owner === G.player) notify('war', msg, provState(pid)); else logMsg(msg); return {ok: true};
}
// al terminar la batalla de un asalto
function siegeResolve(b, winner) {
  const sg = siegeAt(b.prov); G.armies = G.armies.filter(a => !(a.garrison && a.loc === b.prov)); if (!sg) return; sg.assaulting = false;
  if (winner === 'A') { sg.fall = true; siegeStat('fall'); const pr = G.P[b.prov], sid = provState(b.prov); pr.by = sg.att; pr.pby = sg.att; pr.prog = OCC_DAYS; refreshStateOcc(sid); G.occList = G.occList || []; if (!G.occList.includes(b.prov)) G.occList.push(b.prov);
    const msg = `¡${provName(b.prov)} cae tras el asalto de ${G.C[sg.att].name}!`; if (sg.att === G.player || sg.owner === G.player) notify('war', msg, sid); else logMsg(msg); if (typeof onFrontChanged === 'function') onFrontChanged(new Set([sid])); }
  else { sg.walls = Math.min(100, sg.walls + 18); sg.hunger = Math.max(0, sg.hunger - 8); }
}
const _occupationDay0 = occupationDay;
occupationDay = function () { _occupationDay0(); siegeDay(); };
const _endBattle3 = endBattle;
endBattle = function (b, winner) { _endBattle3(b, winner); if (b.siege) siegeResolve(b, winner); };
function siegeInfoHtml(a) {
  const sg = siegeAt(a.loc), c = importantCity(a.loc); if (!sg && !c) return ''; const own = a.tag === G.player;
  if (!sg) return `<div class="kv"><span>Ciudad</span><b>🏰 importante: ${G.C[provOwner(a.loc)] ? 'defendida tras murallas' : ''}</b></div>`;
  const can = own && hostileTags(a.tag, sg.owner) && !sg.assaulting && !sg.fall && siegeAttackers(sg).some(x => x.tag === a.tag);
  return `<div class="kv"><span>🏰 Asedio de ${provName(a.loc)}</span><b>${G.C[sg.att].name} → ${G.C[sg.owner].name}</b></div><div class="kv"><span>Muralla</span><b class="${sg.walls <= 0 ? 'good' : ''}">${Math.round(sg.walls)}%${sg.walls <= 0 ? ' · brecha' : ''}</b></div>${bar(sg.walls / 100, 1, 'warn')}<div class="kv"><span>Hambre en la ciudad</span><b>${Math.round(sg.hunger)}%</b></div>${bar(sg.hunger / 100, 1, '')}<div class="kv"><span>Guarnición</span><b>~${sg.gar} divisiones</b></div>
  ${can ? `<div class="ordgrid"><button data-act="assault" data-tip="<b>Asalto</b><br>Batalla táctica contra la guarnición tras los muros. Con la muralla en pie los defensores tienen un fuerte con cañones.">⚔️ Asaltar la ciudad</button></div>` : ''}`;
}
function siegeMarkers() { return (G.sieges || []).filter(sg => sg.att === G.player || sg.owner === G.player || provVisible(sg.pid)).map(sg => ({id: 'sg' + sg.pid, state: provState(sg.pid), prov: sg.pid, ch: sg.walls <= 0 ? '💥' : '🏰', cls: 'siegemk', tip: `<b>Asedio de ${provName(sg.pid)}</b><br>${G.C[sg.att].name} contra ${G.C[sg.owner].name}<br>Muralla ${Math.round(sg.walls)}% · hambre ${Math.round(sg.hunger)}%`})); }
Object.assign(ACT, {assault: () => { const a = armyById(UI.selArmy); if (!a || a.tag !== G.player) return; const r = siegeAssault(a.loc, G.player); if (!r.ok) toast('⚠️', r.msg); if (typeof renderArmyPanel === 'function') renderArmyPanel(); }});
