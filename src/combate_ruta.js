/* ===== COMBATE EN RUTA =====
   Antes dos ejércitos hostiles que marchaban en sentidos opuestos por el mismo camino se cruzaban sin verse. Ahora, cuando los avances de ambos suman el trayecto completo
   (se han cruzado a mitad de camino), se libra una batalla EN ESE PUNTO del camino: se abre una batalla con `road = {from, to, t}` (t = fracción del trayecto desde `from`),
   el marcador del mapa se coloca sobre el camino, el escenario del campo es el «camino en marcha» (zonas.js) y la batalla se asigna mecánicamente a la provincia más cercana
   al punto del encuentro. Atacante: quien más había avanzado.
   Los ejércitos que llegan después a cualquiera de las dos provincias del camino y son hostiles a un bando se suman a la batalla (en el mismo día de llegada). */
const _stepMoveRoad = stepMove;
stepMove = function (a) {
  if (!a.sea && !a.battle && a.path && a.path.length && a.hopMax && !a.rail) { try { if (roadClash(a)) return; } catch (e) { console.warn('ruta', e); } }
  _stepMoveRoad(a);
};
function roadClash(a) {
  const next = a.path[0], b = G.armies.find(o => o !== a && !o.battle && !o.sea && o.path && o.path.length && o.hopMax && !o.rail && o.loc === next && o.path[0] === a.loc && hostileTags(a.tag, o.tag));
  if (!b) return false;
  const pa = 1 - Math.max(0, a.hop - 1) / a.hopMax, pb = 1 - Math.max(0, b.hop) / b.hopMax;
  if (pa + pb < 1 || pb <= 0) return false;                                    // si el otro no ha salido aún, se resuelve al llegar a su provincia
  const t = clamp((pa + 1 - pb) / 2, 0.1, 0.9), from = a.loc, Z = t < 0.5 ? from : next, att = pa >= pb ? a : b, def = att === a ? b : a;
  const bt = {id: G.nextBattleId++, prov: Z, state: provState(Z), A: [att.id], B: [def.id], A0: att.tag, B0: def.tag, day: 0, att: 'A', hist: [], road: {from, to: next, t: +t.toFixed(2)}};
  G.battles.push(bt); const origin = {[a.id]: from, [b.id]: next};
  [att, def].forEach(x => { x.from = origin[x.id]; x.loc = Z; x.battle = bt.id; x.path = []; x.hop = 0; x.dest = null; x.arrived = G.date.t; x.rest = 0; x.dig = 0; x.fm = false; });
  const msg = `¡Batalla en el camino de ${provName(from)} a ${provName(next)}! ${G.C[att.tag].name} se topa con ${G.C[def.tag].name} a mitad de marcha.`;
  if (att.tag === G.player || def.tag === G.player) notify('war', msg, bt.state); else logMsg(msg);
  return true;
}
// refuerzos: quien llega a cualquiera de las dos provincias del camino se suma a la batalla en ruta
const _createBattlesRoad = createBattles;
createBattles = function (byProv) {
  G.battles.forEach(b => {
    if (!b.road || b.ended) return;
    [b.road.from, b.road.to].forEach(pid => (byProv.get(pid) || []).forEach(a => {
      if (a.battle || a.sea || a.arrived !== G.date.t) return; const side = sideOfBattle(b, a); if (!side) return;
      b[side].push(a.id); a.battle = b.id; a.path = []; a.loc = b.prov; a.hop = 0;
      if (a.tag === G.player) notify('war', `${a.name} se suma a la batalla del camino de ${provName(b.road.from)} a ${provName(b.road.to)}.`, b.state);
    }));
  });
  const mp = new Map(); G.armies.forEach(a => { if (a.sea) return; (mp.get(a.loc) || mp.set(a.loc, []).get(a.loc)).push(a); });
  _createBattlesRoad(mp);
};
// posición del marcador de una batalla en ruta: sobre el camino, entre las dos provincias
function battleAt(b) {
  if (!b.road) return null; const A = MAP.provs[b.road.from], B = MAP.provs[b.road.to], t = b.road.t;
  return [A.lon + (B.lon - A.lon) * t, A.lat + (B.lat - A.lat) * t];
}
