/* ===== GUERRA TOTAL: bloqueo submarino, convoyes, bombardeo de ciudades y movilización =====
   · BLOQUEO COMERCIAL (la «batalla del Atlántico»): cada mes, por cada par de países en guerra, se compara la fuerza de acecho del atacante (submarinos, destructores, cruceros y portaaviones
     de flotas que no están en puerto) con las escoltas del defensor (destructores, cruceros, portaaviones, radar y «patrullas» básicas). El resultado (0–85 %) multiplicado por la dependencia
     marítima del defensor (proporción de estados con puerto) es su nivel de bloqueo: reduce producción general e industrial y vacía el tesoro. Las escoltas hunden submarinos atacantes.
     «Convoyes escoltados» (c.convoy) multiplica por 1,4 las escoltas a cambio de un coste mensual del 1 % de los ingresos.
   · BOMBARDEO ESTRATÉGICO SOBRE LA POBLACIÓN: los escuadrones de bombarderos con misión estratégica sobre estados enemigos (además de dañar la producción, ya modelado en aviación)
     minan la moral civil: suben los radicales y baja la legitimidad del país bombardeado (el «Blitz»).
   · MOVILIZACIÓN TOTAL (c.totalWar): solo en guerra; economía de guerra con menor coste militar y más industria, a cambio de menos producción civil, más radicales y menos legitimidad.
   Se guarda en G.tw (por país) y c.convoy / c.totalWar. */
const TW_NAV = {sub: 1, destroyer: 0.35, cruiser: 0.3, carrier: 0.4, bb: 0.1, dread: 0.08};
const TW_ESC = {destroyer: 0.7, cruiser: 0.4, carrier: 0.5, sub: 0.15};
const twShips = (tag, tbl) => { let n = 0; (G.mx && G.mx.fl || []).forEach(f => { if (f.tag !== tag || f.port != null || f.tr) return; f.ships.forEach(s => { n += (tbl[s.t] || 0) * s.hp; }); }); return n; };
const twSeaDep = c => c.states.length ? Math.min(1, portsStates(c).length / Math.max(1, c.states.length) * 1.6) : 0;
function twEnemies(tag) { return G.tags.filter(o => o !== NONE && o !== tag && alive(o) && G.C[o].states.length && hostileTags(tag, o)); }
function twMonth() {
  if (!G.mx || !G.mx.fl || typeof hostileTags !== 'function') return; G.tw = G.tw || {};
  const raid = {}, esc = {}; G.tags.forEach(t => { if (t === NONE || !alive(t) || !G.C[t].states.length) return; raid[t] = twShips(t, TW_NAV); esc[t] = twShips(t, TW_ESC); });
  const next = {};
  Object.keys(raid).forEach(a => { if (raid[a] < 0.8) return; const enA = twEnemies(a), nE = enA.length; enA.forEach(b => {
    const cb = G.C[b], dep = twSeaDep(cb); if (dep <= 0.05) return;
    const defend = (esc[b] * (cb.convoy ? 1.4 : 1) * (hasRadar(b) ? 1.25 : 1) + 2.5), rr = raid[a] / Math.sqrt(Math.max(1, nE)), blk = Math.min(0.7, rr / (rr + defend * 1.2)) * dep;
    const o = next[b] || (next[b] = {blk: 0, by: [], blitz: 0, sunk: 0}); o.blk = Math.min(0.75, 1 - (1 - o.blk) * (1 - blk)); o.by.push(a);
    // las escoltas hunden submarinos atacantes
    const p = defend / (raid[a] + defend) * 0.18; if (Math.random() < p) { const fl = G.mx.fl.filter(f => f.tag === a && f.port == null && f.ships.some(s => s.t === 'sub')); if (fl.length) { const f = fl[Math.floor(Math.random() * fl.length)], i = f.ships.findIndex(s => s.t === 'sub'); f.ships.splice(i, 1); o.sunk++; if (a === G.player) notify('war', '⚓ Una escolta enemiga ha hundido uno de tus submarinos.'); } }
  }); });
  // bombardeo sobre la población
  (G.mx.sq || []).forEach(s => {
    if (s.n < 10 || s.type !== 'bomber' || s.mission !== 'strat' || typeof airReg !== 'function') return; const reg = airReg(s.reg); if (!reg) return;
    const vict = {}; reg.states.forEach(id => { const o = G.S[id].owner; if (o !== NONE && hostileTags(s.tag, o)) vict[o] = (vict[o] || 0) + 1; });
    Object.keys(vict).forEach(v => { const o = next[v] || (next[v] = {blk: 0, by: [], blitz: 0, sunk: 0}); o.blitz += s.n * vict[v] / Math.max(1, G.C[v].states.length); });
  });
  Object.keys(G.tw).forEach(t => { if (!next[t]) { G.tw[t].blk = 0; } });
  Object.keys(next).forEach(t => {
    const c = G.C[t], o = next[t], prev = (G.tw[t] && G.tw[t].blk) || 0; G.tw[t] = Object.assign(G.tw[t] || {}, o);
    if (o.blk > 0.02) c.treasury -= Math.max(0, (c.stats.income || 0)) * 0.12 * o.blk;
    if (o.blitz > 0) { c.radicals = Math.min(0.95, c.radicals + Math.min(0.03, o.blitz / 60 * 0.03)); c.legitimacy = Math.max(0, c.legitimacy - Math.min(1.5, o.blitz / 40)); }
    if (t === G.player && o.blk > 0.15 && Math.abs(o.blk - prev) > 0.1) notify('war', `⚓ Los submarinos enemigos estrangulan tu comercio marítimo: bloqueo del ${Math.round(o.blk * 100)} %. Refuerza las escoltas.`);
    if (t === G.player && o.blitz > 25) notify('war', '💣 Los bombardeos enemigos castigan a tu población: radicalismo y descontento en aumento.');
    recalcMods(c);
  });
  G.C && G.tags.forEach(t => { const c = G.C[t]; if (t === NONE || !c) return; if (c.convoy && c.wars.length) c.treasury -= Math.max(0, c.stats.income || 0) * 0.01; if (c.totalWar && !c.wars.length) { c.totalWar = false; recalcMods(c); if (t === G.player) notify('event', '🏭 Fin de la guerra: se desmonta la movilización total.'); }
    if (G.tw[t] && G.tw[t].blk && !next[t]) { G.tw[t].blk = 0; recalcMods(c); } });
}
const _recalcTw = recalcMods;
recalcMods = function (c) {
  _recalcTw(c); if (!c || !c.mods) return c && c.mods; const t = G.tw && G.tw[c.tag];
  if (t && t.blk > 0) { c.mods.out = (c.mods.out || 0) - 0.10 * t.blk; c.mods.indOut = (c.mods.indOut || 0) - 0.12 * t.blk; c.mods.steelOut = (c.mods.steelOut || 0) - 0.15 * t.blk; }
  if (c.totalWar) { c.mods.milCost = (c.mods.milCost || 0) - 0.15; c.mods.indOut = (c.mods.indOut || 0) + 0.08; c.mods.army = (c.mods.army || 0) + 0.08; c.mods.out = (c.mods.out || 0) - 0.05; c.mods.rad = (c.mods.rad || 0) + 0.03; c.mods.stab = (c.mods.stab || 0) - 1; }
  return c.mods;
};
function twPanel() {
  const c = G.C[G.player]; if (!c) return; const t = (G.tw && G.tw[c.tag]) || {}, en = twEnemies(c.tag);
  const rows = en.slice(0, 12).map(b => { const tb = (G.tw && G.tw[b]) || {}; return `<tr><td>${flag(b)} ${G.C[b].name}</td><td>${Math.round((tb.blk || 0) * 100)} %</td><td>${Math.round(twShips(c.tag, TW_NAV) * 10) / 10}</td></tr>`; }).join('');
  ovShow(`<h2>🌐 Guerra total</h2><p>Tu país: bloqueo comercial sufrido <b>${Math.round((t.blk || 0) * 100)} %</b> · presión de bombardeos <b>${Math.round(t.blitz || 0)}</b> · escoltas efectivas <b>${(twShips(c.tag, TW_ESC)).toFixed(1)}</b>${hasRadar(c.tag) ? ' (con radar 📡)' : ''}.</p>
  <p><small>Los submarinos, destructores y cruceros fuera de puerto asfixian el comercio enemigo; las escoltas protegen el tuyo y hunden submarinos atacantes. Los bombarderos estratégicos minan la moral civil.</small></p>
  ${en.length ? `<table style="width:100%"><tr><th align="left">Enemigo</th><th>Bloqueo que sufre</th><th>Tu fuerza de acecho</th></tr>${rows}</table>` : '<p>No estás en guerra: no hay bloqueos activos.</p>'}
  <h3>Medidas</h3><div class="btns"><button data-act="twconvoy" class="${c.convoy ? 'pri' : ''}">🚢 Convoyes escoltados: ${c.convoy ? 'ACTIVOS' : 'inactivos'}</button><button data-act="twtotal" class="${c.totalWar ? 'pri' : ''}">🏭 Movilización total: ${c.totalWar ? 'ACTIVA' : 'inactiva'}</button></div>
  <p><small>Convoyes: escoltas ×1,4, coste mensual del 1 % de los ingresos. Movilización total (solo en guerra): −15 % coste militar, +8 % industria y ejército; −5 % producción civil, más radicales y menos estabilidad.</small></p><div class="btns"><button class="pri" data-act="ovclose">Cerrar</button></div>`);
}
Object.assign(ACT, {
  totalwar: () => twPanel(),
  twconvoy: () => { const c = G.C[G.player]; c.convoy = !c.convoy; twPanel(); },
  twtotal: () => { const c = G.C[G.player]; if (!c.wars.length) { toast('⚠️', 'Solo puedes movilizar la economía durante una guerra.'); return; } c.totalWar = !c.totalWar; recalcMods(c); twPanel(); }
});
function twMenus() { menuBtn('tm-tw', '🌐', 'Guerra total', 'totalwar', '<b>Guerra total</b><br>Bloqueo submarino, convoyes, bombardeo de ciudades y movilización.'); }
const _histMonthTw = histMonth;
histMonth = function () { _histMonthTw(); try { twMonth(); } catch (e) { console.warn('tw', e); } };
