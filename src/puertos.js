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
