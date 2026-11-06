/* ===== BATALLA 6 (parte 2 del plan «más realismo»): mando =====
   · MENSAJEROS: las órdenes a un cuerpo las lleva un jinete desde el mariscal hasta su comandante; se ve cruzar el campo y la caballería enemiga puede interceptarlo (la orden se pierde).
   · RESERVA DEL GENERAL: «Lanzar la reserva» manda a los regimientos de reserva entrar en línea (también con mensajero); llegan frescos y suben la moral.
   · MARISCAL: cada ejército tiene un mariscal tras la línea. Si cae, el ejército entero se estremece, las órdenes se atrasan y un sucesor tarda en tomar el mando.
   · HUMO: la pólvora negra levanta una cortina que tapa la vista (más allá de ~110 px) y baja la puntería; el viento la desplaza. */
/* ---------- mariscal ---------- */
function bvMarStep(V, b, all, dt) {
  V.mar = V.mar || {}; b.marDead = b.marDead || {};
  ['A', 'B'].forEach(s => {
    const ls = all.filter(k => k.side === s && k.role === 'line' && k.mode !== 'rout' && !k.garr && k.type !== 'art'); if (!ls.length) return; const dir = s === 'A' ? 1 : -1;
    const ids = sideIds(b, s).map(armyById).filter(Boolean).sort((p, q) => q.divs.length - p.divs.length); const gen = ids[0] && ids[0].gen;
    let m = V.mar[s]; const tx = ls.reduce((n, k) => n + k.x, 0) / ls.length - dir * 135, ty = ls.reduce((n, k) => n + k.y, 0) / ls.length;
    if (!m) { m = V.mar[s] = {side: s, x: tx, y: ty, alive: !b.marDead[s], name: gen ? gen.name : 'el mariscal', lvl: gen ? gen.lvl : 1, tag: ids[0] ? ids[0].tag : (s === 'A' ? b.A0 : b.B0), dis: 0}; }
    if (!m.alive) { if (!m.succ && V.t - m.diedAt > 25) { m.succ = true; bvBanner(V, `🎖️ Un nuevo general asume el mando del ejército de ${G.C[m.tag].name}`, s, ''); } return; }
    const dx = tx - m.x, dy = ty - m.y, d = Math.hypot(dx, dy) || 1, sp = Math.min(d * 1.5, 38); m.x += dx / d * sp * dt; m.y = clamp(m.y + dy / d * sp * dt, 40, BV_H - 24);
    // riesgo: caballería enemiga encima, melé cercano y fuego (la escolta lo reduce)
    const guard = ls.filter(k => Math.hypot(k.x - m.x, k.y - m.y) < 60).length; let risk = 0;
    all.forEach(o => { if (o.side === s || o.mode === 'rout') return; const d2 = Math.hypot(o.x - m.x, o.y - m.y); if (o.type === 'cav' && (o.mode === 'gallop' || o.mode === 'charge' || o.mode === 'advance') && d2 < 50) risk += 0.1; else if (o.mode === 'melee' && d2 < 55) risk += 0.04; else if ((o.mode === 'fire' || o.mode === 'artfire') && d2 < 170) risk += 0.0006; });
    risk *= guard ? 0.5 : 1; if (risk > 0 && Math.random() < risk * dt) bvMarKill(V, b, m, all, 'cae en combate');
  });
}
function bvMarKill(V, b, m, all, how) {
  if (!m.alive) return; m.alive = false; m.diedAt = V.t; b.marDead[m.side] = true; const nm = G.C[m.tag].name;
  all.forEach(k => { if (k.side !== m.side || k.mode === 'rout' || k.mm === undefined) return; k.mm = Math.max(0.03, k.mm - (Math.hypot(k.x - m.x, k.y - m.y) < 220 ? 0.2 : 0.12)); });
  bvBanner(V, `☠️ ¡Cae el mariscal ${m.name} de ${nm}! El ejército queda sin mando supremo`, m.side, ''); (b.log = b.log || []).push({k: 'panic', d: b.day, t: `El mariscal ${m.name} (${nm}) ${how}: el ejército se estremece, las órdenes se retrasan y un sucesor tarda en tomar el mando.`}); if (b.log.length > 30) b.log.shift();
  V.shake = Math.min(5, (V.shake || 0) + 2.5); if (typeof SFX !== 'undefined' && SFX.boom) SFX.boom(0.5);
  if (V.couriers) V.couriers.forEach(c => { if (c.side === m.side && !c.done) bvCourierLost(V, b, c, 'muerto el mariscal'); });
}
const marDead = (V, s) => V.mar && V.mar[s] && !V.mar[s].alive;
// caída del mariscal: las órdenes tardan el doble hasta que hay sucesor, y siempre algo más
const _fmFrictionB6 = fmFriction;
fmFriction = function (V, b, c) { const r = _fmFrictionB6(V, b, c), m = V.mar && V.mar[c.side]; if (m && !m.alive) r.delay = +(r.delay * (m.succ ? 1.3 : 2.4)).toFixed(1); return r; };
const _sideStatsB6 = sideStats;
sideStats = function (b, ids, isAttacker) { const r = _sideStatsB6(b, ids, isAttacker), key = ids === b.A ? 'A' : ids === b.B ? 'B' : null; if (key && b.marDead && b.marDead[key]) { r.F *= 0.97; r.T *= 0.98; } return r; };
// los proyectiles que caen sobre el mariscal
const _tacShellHitB6 = tacShellHit;
tacShellHit = function (V, b, p, all) { _tacShellHitB6(V, b, p, all); if (!V.mar || V.replay) return; ['A', 'B'].forEach(s => { const m = V.mar[s]; if (m && m.alive && s !== p.s && Math.hypot(m.x - p.x2, m.y - p.y2) < 16 && Math.random() < 0.12) bvMarKill(V, b, m, all, 'cae bajo el cañoneo'); }); };
/* ---------- mensajeros ---------- */
function bvCourierPos(V, b, c) {
  const m = V.mar && V.mar[c.side], from = m && m.alive ? [m.x, m.y] : c.from, cm = c.cid && V.cmd && V.cmd[c.cid], to = c.to ? c.to : cm && cm.alive ? [cm.x, cm.y] : c.to0, p = clamp((V.t - c.t0) / Math.max(0.5, c.t1 - c.t0), 0, 1);
  return [from[0] + (to[0] - from[0]) * p, from[1] + (to[1] - from[1]) * p];
}
function bvCourierSend(V, b, o) { V.couriers = V.couriers || []; const dir = o.side === 'A' ? 1 : -1; V.couriers.push(Object.assign({t0: V.t, from: [o.side === 'A' ? 30 : BV_W - 30, BV_H / 2], done: false}, o)); }
function bvCourierLost(V, b, c, why) {
  if (c.done) return; c.done = true; c.lost = true; if (c.onLost) c.onLost();
  if (!V.replay) { bvBanner(V, `✉️ Un mensajero de ${G.C[c.tag].name} ${why}: la orden no llega`, c.side === 'A' ? 'B' : 'A', ''); (b.log = b.log || []).push({k: 'flank', d: b.day, t: `Un mensajero de ${G.C[c.tag].name} ${why}: la orden se pierde.`}); if (b.log.length > 30) b.log.shift(); }
}
function bvCouriersStep(V, b, all, dt) {
  if (!V.couriers) return; V.couriers.forEach(c => {
    if (c.done) return; const [x, y] = bvCourierPos(V, b, c); c.x = x; c.y = y;
    if (V.t >= c.t1) { c.done = true; if (c.onArrive) c.onArrive(); return; }
    all.forEach(o => { if (c.done || o.side === c.side || o.mode === 'rout' || o.role === 'reserve') return; const d = Math.hypot(o.x - x, o.y - y); if (o.type === 'cav' && d < 42 && Math.random() < 0.9 * dt * 3) bvCourierLost(V, b, c, 'es interceptado por la caballería'); else if (o.type !== 'art' && (o.mode === 'fire' || o.mode === 'melee') && d < 30 && Math.random() < 0.25 * dt) bvCourierLost(V, b, c, 'cae abatido'); });
  }); V.couriers = V.couriers.filter(c => !c.done || V.t - (c.tEnd = c.tEnd || V.t) < 0.1);
}
// toda orden de cuerpo con retraso sale con un jinete visible
const _bvFormSetB6 = bvFormSet;
bvFormSet = function (V, b, c, kind, pts, quiet, delay, mis) {
  const ok = _bvFormSetB6(V, b, c, kind, pts, quiet, delay, mis);
  if (ok && delay >= 1.5 && !b.prep && !V.replay) { const pl = b.cplan && b.cplan[c.id]; if (pl) bvCourierSend(V, b, {side: c.side, tag: c.tag, cid: c.id, t1: V.t + delay, kind: 'orden', to0: [c.cx || BV_W / 2, c.yc || BV_H / 2], onLost: () => { if (b.cplan && b.cplan[c.id] === pl) { delete b.cplan[c.id]; if (V.fm) delete V.fm[c.id]; (c.blks || []).forEach(k => { k.skey = ''; }); } }}); }
  return ok;
};
/* ---------- reserva del general ---------- */
function bvReserveList(V, b, side) { const out = []; (V.corps || []).filter(c => c.side === side).forEach(c => c.regs.forEach((r, i) => { if (r.out && r.s > 0.05) out.push({c, r, i}); })); return out; }
ACT.genres = () => {
  const V = R.bviz, b = G.battles.find(x => x.id === UI.battle); if (!V || !b || b.ended || b.prep || V.replay) return; const ps = playerSide(b); if (!ps) return;
  const list = bvReserveList(V, b, ps).filter(e => !e.r.pend); if (!list.length) { toast('⚠️', 'No tienes regimientos en reserva.'); return; }
  const c0 = list[0].c, fr = fmFriction(V, b, c0); list.forEach(e => { e.r.pend = true; });
  bvCourierSend(V, b, {side: ps, tag: c0.tag, kind: 'reserva', to: [ps === 'A' ? 60 : BV_W - 60, BV_H / 2], t1: V.t + fr.delay, onArrive: () => { list.forEach(e => { e.r.out = false; e.r.fresh = true; delete e.r.pend; }); bvBanner(V, `🎖️ ${G.C[c0.tag].name} lanza la reserva: ${list.length} regimiento(s) entran en línea`, ps, ''); }, onLost: () => { list.forEach(e => { delete e.r.pend; }); }});
  toast('🎖️', `Orden de lanzar la reserva en camino (${fr.delay} s).`); renderBattlePanel();
};
// los refuerzos que entran en línea llegan frescos
function bvFreshStep(V, b, all) { all.forEach(k => { if ((k.d.fresh || (k.enter && !k._ent)) && k.mm !== undefined && k.role === 'line') { k._ent = 1; delete k.d.fresh; k.mm = Math.min(1, k.mm + 0.18); k.fat = 0; k.d.o = Math.min(DIVS[k.d.t].org, k.d.o + DIVS[k.d.t].org * 0.1); } }); }
/* ---------- humo de pólvora ---------- */
function bvSmokeGrid(V) {
  if (V._sgT !== undefined && V.t - V._sgT < 0.4) return V._sg; const g = new Map(); V.parts.forEach(p => { if (p.k !== 'smoke' || p.age > p.life * 0.85) return; const key = Math.floor(p.x / 40) * 100 + Math.floor(p.y / 40); g.set(key, (g.get(key) || 0) + 1); }); V._sgT = V.t; return (V._sg = g);
}
const bvSmokeAt = (V, x, y) => bvSmokeGrid(V).get(Math.floor(x / 40) * 100 + Math.floor(y / 40)) || 0;
function bvSmokeBlock(V, o, e) { const d = Math.hypot(e.x - o.x, e.y - o.y); if (d < 110) return false; let n = 0; for (let i = 1; i < 6; i++) { const t = i / 6; n += bvSmokeAt(V, o.x + (e.x - o.x) * t, o.y + (e.y - o.y) * t); } return n > 12; }
const _bvFireB6 = bvFire;
bvFire = function (V, b, blk, dt, foes) { if (blk.type === 'inf' && blk.foe) { const n = bvSmokeAt(V, (blk.x + blk.foe.x) / 2, (blk.y + blk.foe.y) / 2); if (n > 4) dt *= clamp(1 - 0.02 * n, 0.65, 1); } _bvFireB6(V, b, blk, dt, foes); };
/* ---------- bucle y dibujo ---------- */
const _tacThinkB6 = tacThink;
tacThink = function (V, b, all, dt) {
  _tacThinkB6(V, b, all, dt); if (V.over || b.prep || b.ended || V.replay || dt <= 0) return;
  bvMarStep(V, b, all, dt); bvCouriersStep(V, b, all, dt); V._b6 = (V._b6 || 0) + dt; if (V._b6 >= 1) { V._b6 = 0; bvFreshStep(V, b, all); }
};
const _bvCorpsFlagsB6 = bvCorpsFlags;
bvCorpsFlags = function (g, V, b) {
  _bvCorpsFlagsB6(g, V, b); const ps = playerSide(b), mine = [...V.blocks.values()].filter(k => k.side === ps && k.mode !== 'rout');
  const seen = (x, y, side) => side === ps || mine.some(k => Math.hypot(k.x - x, k.y - y) < 230);
  ['A', 'B'].forEach(s => { const m = V.mar && V.mar[s]; if (!m || !seen(m.x, m.y, s)) return; const col = G.C[m.tag].color; g.save(); g.translate(m.x, m.y);
    if (m.alive) { g.strokeStyle = col; g.fillStyle = 'rgba(10,12,16,.75)'; g.lineWidth = 1.6; g.beginPath(); g.arc(0, 0, 7.5, 0, 6.3); g.fill(); g.stroke(); g.font = '10px sans-serif'; g.textAlign = 'center'; g.fillStyle = '#fff'; g.fillText('🎖️', 0, 3.5); if (s === ps) { g.font = '9px sans-serif'; g.fillStyle = '#ffe28a'; g.fillText(m.name, 0, -11); } }
    else { g.font = '12px sans-serif'; g.textAlign = 'center'; g.globalAlpha = Math.max(0, 1 - (V.t - m.diedAt) / 20); g.fillText('☠️', 0, 4); g.globalAlpha = 1; } g.restore(); });
  (V.couriers || []).forEach(c => { if (c.done || c.x === undefined || !seen(c.x, c.y, c.side)) return; g.fillStyle = G.C[c.tag].color; g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = 0.8; g.beginPath(); g.ellipse(c.x, c.y, 4.2, 2.4, 0, 0, 6.3); g.fill(); g.stroke(); g.font = '10px sans-serif'; g.textAlign = 'center'; g.fillStyle = '#fff'; g.fillText(c.kind === 'reserva' ? '🎖️' : '✉️', c.x, c.y - 6);
    g.strokeStyle = 'rgba(255,240,180,.35)'; g.setLineDash([2, 3]); g.beginPath(); g.moveTo(c.x, c.y); const to = c.to || (c.cid && V.cmd && V.cmd[c.cid] ? [V.cmd[c.cid].x, V.cmd[c.cid].y] : c.to0); g.lineTo(to[0], to[1]); g.stroke(); g.setLineDash([]); });
};
function bvMarHtml(b, V, ps) {
  const m = V.mar && V.mar[ps]; if (!m) return ''; const res = bvReserveList(V, b, ps).length, pend = (V.couriers || []).filter(c => !c.done && c.side === ps && c.kind === 'reserva').length;
  return `<div class="mmar"><span data-tip="El mariscal dirige el ejército desde detrás de la línea. Si cae, las órdenes tardan mucho más y la moral se hunde.">${m.alive ? `🎖️ Mariscal <b>${m.name}</b>` : `<b class="bad">☠️ ${m.name} ha caído${m.succ ? ' · nuevo general al mando' : ' · sin mando supremo'}</b>`}</span>${res && !b.prep ? `<button class="mini" data-act="genres" ${pend ? 'disabled' : ''} data-tip="<b>Lanzar la reserva</b><br>Manda entrar en línea a los ${res} regimiento(s) en reserva. Salen cuando llegue el mensajero y entran frescos (+moral).">🎖️ Lanzar la reserva (${res})</button>` : ''}</div>`;
}
