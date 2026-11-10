/* ===== PUERTOS: llevar las flotas a puerto =====
   Una flota atracada en un puerto propio (f.port = estado) se repara mucho más deprisa (más aún con astilleros), no combate ni protege la zona
   y queda a salvo en alta mar; si el puerto cae en manos enemigas, la flota se pierde en parte. Los buques recién botados atracan en su astillero.
   La IA lleva a puerto sus flotas en paz o cuando están dañadas. */
function dockCandidates(c, f) {
  return portsStates(c).filter(id => homeZone(c, id) !== null).sort((a, b) => zoneDist(f.zone, homeZone(c, a)) - zoneDist(f.zone, homeZone(c, b)) - ((G.S[b].b.shipyard || 0) - (G.S[a].b.shipyard || 0)) * 0.6);
}
function fleetDock(f, sid) {
  const c = G.C[f.tag], s = G.S[sid]; if (!c || !s) return {ok: false, msg: 'Puerto no válido.'};
  if (s.owner !== f.tag) return {ok: false, msg: 'Solo puedes atracar en tus propios puertos.'};
  const z = homeZone(c, sid); if (z === null) return {ok: false, msg: `${s.name} no tiene puerto.`};
  if (f.tr && f.tr.to === z && f.dockTo === sid) return {ok: true};
  if (f.zone === z && !f.tr) { f.port = sid; f.dockTo = null; f.mission = 'port'; f.target = null; if (f.tag === G.player) toast('⚓', `${f.name} atraca en ${s.name}.`); return {ok: true}; }
  fleetMove(f, z); f.dockTo = sid; f.mission = 'port'; f.target = null; return {ok: true};
}
const _navyDay = navyDay;
navyDay = function () {
  const M = mx(); if (!M.fl.length) return;
  M.fl.forEach(f => {
    if (f.port != null) {                                                  // atracadas: reparación rápida; si el puerto cae, se pierde parte de la flota
      const s = G.S[f.port], c = G.C[f.tag];
      if (!s || s.owner !== f.tag || !c) { const lost = Math.ceil(f.ships.length * 0.4); f.ships.splice(0, lost); f.port = null; if (f.tag === G.player && f.ships.length) notify('war', `¡Pierdes el puerto de ${s ? s.name : '?'}! ${lost} buques de ${f.name} se pierden y el resto zarpa.`); return; }
      const rep = 0.035 + 0.02 * Math.min(3, s.b.shipyard || 0); f.ships.forEach(x => { x.hp = Math.min(1, x.hp + rep); }); f.mission = 'port';
    }
    if (f.dockTo != null && !f.tr) { const s = G.S[f.dockTo], c = G.C[f.tag]; if (s && c && s.owner === f.tag && homeZone(c, f.dockTo) === f.zone) { f.port = f.dockTo; f.mission = 'port'; if (f.tag === G.player) toast('⚓', `${f.name} atraca en ${s.name}.`); } f.dockTo = null; }
  });
  const dk = M.fl.filter(f => f.port != null); M.fl = M.fl.filter(f => f.port == null);   // las flotas atracadas quedan fuera de la zona de combate
  try { _navyDay(); } finally { M.fl = M.fl.concat(dk.filter(f => f.ships.length)); }
};
const _navalAI = navalAI;
navalAI = function (c) {
  const M = mx(), hid = c.wars.length ? [] : M.fl.filter(f => f.tag === c.tag && f.port != null);    // en paz, las flotas atracadas se quedan donde están
  if (hid.length) M.fl = M.fl.filter(f => !hid.includes(f));
  try { _navalAI(c); } finally { if (hid.length) M.fl = M.fl.concat(hid); }
  fleetsOf(c.tag).forEach(f => {
    if (f.tr) return; const avg = f.ships.reduce((n, s) => n + s.hp, 0) / Math.max(1, f.ships.length);
    if (f.port != null) { f.mission = 'port'; return; }
    if (avg < 0.55 || (!c.wars.length && f.mission === 'port')) { const cand = dockCandidates(c, f)[0]; if (cand !== undefined) fleetDock(f, cand); }
  });
};

/* ---------- agrupar flotas sueltas ---------- */
// junta las flotas ociosas (sin viaje ni órdenes de ataque) del mismo país que comparten zona y puerto, hasta 14 buques por flota
function fleetsMerge(tag) {
  const M = mx(), groups = new Map(); let n = 0;
  M.fl.forEach(f => { if (f.tag !== tag || f.tr || f.dockTo != null || !f.ships.length || (f.mission !== 'port' && f.mission !== 'patrol')) return; const k = f.zone + '|' + (f.port == null ? '' : f.port) + '|' + f.mission; (groups.get(k) || groups.set(k, []).get(k)).push(f); });
  groups.forEach(list => { if (list.length < 2) return; list.sort((a, b) => b.ships.length - a.ships.length);
    for (let i = 0; i < list.length; i++) { const a = list[i]; if (!a.ships.length) continue;
      for (let j = list.length - 1; j > i && a.ships.length < 14; j--) { const b = list[j]; if (!b.ships.length) continue; const take = Math.min(14 - a.ships.length, b.ships.length); a.ships.push(...b.ships.splice(0, take)); if (!b.ships.length) n++; } } });
  M.fl = M.fl.filter(f => f.ships.length); return n;
}
const _navalWeek39 = navalWeek;
navalWeek = function () { _navalWeek39(); if (G.week % 4 === 0) G.tags.forEach(t => { if (t !== NONE && G.C[t].ai && G.C[t].states.length) fleetsMerge(t); }); };
Object.assign(ACT, {flmerge: () => { const n = fleetsMerge(G.player); toast('⚓', n ? `Flotas agrupadas: ${n} menos.` : 'No hay flotas que agrupar (deben estar en la misma zona o puerto y sin misión de ataque).'); renderWindow(); }});
