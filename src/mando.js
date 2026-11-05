/* ===== MANDO EN EL CAMPO: llegada por flancos, comandantes de cuerpo y «mantener posición» ===== */
/* ---- 1) los ejércitos que convergen desde otro lado entran por ese margen del campo ---- */
function bvEdgeFor(b, a) {
  b.edges = b.edges || {}; if (a.id in b.edges) return b.edges[a.id];
  let e = null; const side = (b.A || []).includes(a.id) ? 'A' : 'B', ids = (side === 'A' ? b.A : b.B).map(armyById).filter(Boolean);
  const vec = x => {
    if (x.from === undefined || x.from === null || x.from === x.loc || G.date.t - (x.arrived === undefined ? -99 : x.arrived) > 6) return null;
    const F = MAP.provs[x.from], L = MAP.provs[x.loc]; if (!F || !L) return null;
    const dx = F.lon - L.lon, dy = -(F.lat - L.lat), n = Math.hypot(dx, dy); return n ? [dx / n, dy / n] : null;
  };
  const main = ids.filter(x => vec(x)).sort((p, q) => q.divs.length - p.divs.length)[0];
  if (main && main !== a && vec(a)) {
    const m = vec(main), v = vec(a), cos = m[0] * v[0] + m[1] * v[1], cr = m[0] * v[1] - m[1] * v[0];
    if (cos < 0.57 && cos > -0.7) e = cr > 0 ? (side === 'A' ? 'top' : 'bottom') : (side === 'A' ? 'bottom' : 'top');
  }
  b.edges[a.id] = e; return e;
}
function bvEdgeNotice(V, b, a, blk) {
  V._edgeMsg = V._edgeMsg || {}; if (V._edgeMsg[a.id]) return; V._edgeMsg[a.id] = 1;
  const txt = `${a.name} converge por el flanco ${blk.edge === 'top' ? 'norte' : 'sur'}`;
  bvBanner(V, '🧭 ' + txt, blk.side, ''); (b.log = b.log || []).push({k: 'flank', d: b.day, t: txt + '.'}); if (b.log.length > 30) b.log.shift();
}
/* ---- 2) comandante de cada cuerpo: una bolita que recorre sus regimientos ---- */
const CMD_R = 85;
function bvCmdName(b, c) { return GEN_SURNAMES[Math.floor(hash2(b.id, c.a.id.length + c.idx, 31) * GEN_SURNAMES.length)]; }
function bvCmdStep(V, b, all, dt) {
  if (V.replay || V.over || b.prep) return;
  V.cmd = V.cmd || {}; b.cmd = b.cmd || {A: {dead: 0, venge: 0, vday: 0}, B: {dead: 0, venge: 0, vday: 0}}; b.cmdDead = b.cmdDead || {};
  (V.corps || []).forEach(c => {
    const ls = c.blks.filter(k => k.mode !== 'rout' && k.role !== 'reserve' && !k.d.out); if (!ls.length) return;
    let cm = V.cmd[c.id]; const dir = c.side === 'A' ? 1 : -1;
    if (!cm) {
      if (b.cmdDead[c.id]) return;
      const cx = ls.reduce((n, k) => n + k.x, 0) / ls.length - dir * 40, cy = ls.reduce((n, k) => n + k.y, 0) / ls.length;
      cm = V.cmd[c.id] = {id: c.id, side: c.side, name: bvCmdName(b, c), corps: c.idx + 1, x: cx, y: cy, alive: true, T: 0, tgt: null, tag: c.tag};
    }
    if (!cm.alive) return;
    cm.T -= dt;
    if (cm.T <= 0 || !cm.tgt || !ls.includes(cm.tgt)) {          // visita primero a quien más lo necesita
      const w = ls.map(k => 1 + (1 - (k.mm === undefined ? 0.8 : k.mm)) * 4 + (k.mode === 'melee' || k.mode === 'fire' ? 0.8 : 0) + (k.brk > 0 ? 1.5 : 0)); let r = Math.random() * w.reduce((p, v) => p + v, 0), i = 0;
      for (; i < ls.length - 1; i++) { r -= w[i]; if (r <= 0) break; } cm.tgt = ls[i]; cm.T = rnd(5, 9);
    }
    const t = cm.tgt, tx = t.x - dir * ((t.dep || 20) / 2 + 9), ty = t.y, dx = tx - cm.x, dy = ty - cm.y, d = Math.hypot(dx, dy) || 1, sp = Math.min(d * 2, 62);
    cm.x += dx / d * sp * dt; cm.y += dy / d * sp * dt; cm.y = clamp(cm.y, 34, BV_H - 18);
    // moral y valentía de quienes lo rodean
    ls.forEach(k => {
      if (Math.hypot(k.x - cm.x, k.y - cm.y) > CMD_R) return; k.cmdN = V.t;
      if (k.mm === undefined) return; k.mm = Math.min(1, k.mm + 0.035 * dt); if (k.mm < 0.12) k.mm = 0.12; k.fat = Math.max(0, (k.fat || 0) - 0.006 * dt);
    });
    // riesgo: fuego y cuerpo a cuerpo cerca de él
    let risk = 0; const wl = weapLvl(c.side === 'A' ? b.B0 : b.A0);
    all.forEach(o => { if (o.side === c.side || o.mode === 'rout') return; const d2 = Math.hypot(o.x - cm.x, o.y - cm.y); if (o.mode === 'melee' && d2 < 60) risk += 0.008; else if ((o.mode === 'fire' || o.mode === 'artfire') && d2 < 160) risk += 0.001 * (1 + wl * 0.3); });
    if (risk > 0 && Math.random() < risk * dt) bvCmdKill(V, b, cm, c, ls, 'cae en combate');
  });
}
function bvCmdKill(V, b, cm, c, ls, how) {
  if (!cm.alive) return; cm.alive = false; cm.diedAt = V.t; b.cmdDead[c.id] = true;
  const side = cm.side, st = b.cmd[side]; st.dead++;
  const org = ls.reduce((n, k) => n + k.d.o / DIVS[k.d.t].org, 0) / ls.length, mor = ls.reduce((n, k) => n + (k.mm === undefined ? 0.8 : k.mm), 0) / ls.length;
  const venge = org > 0.35 && mor > 0.3 && Math.random() < 0.4 + (ls.some(k => k.type === 'cav') ? 0.1 : 0);
  c.blks.forEach(k => { if (k.mode === 'rout' || k.role === 'reserve') return; const near = Math.hypot(k.x - cm.x, k.y - cm.y) < 140; if (k.mm !== undefined) k.mm = Math.max(0.02, k.mm - (near ? 0.26 : 0.14)); if (venge) k.venge = V.t + 16; });
  const nm = G.C[cm.tag].name, rank = 'general';
  if (venge) { st.venge++; st.vday = b.day + 2; bvBanner(V, `⚔️ ¡Cae el ${rank} ${cm.name}! El ${cm.corps}.º Cuerpo de ${nm} se lanza a la carga por venganza`, side, '☠️'); (b.log = b.log || []).push({k: 'charge', d: b.day, t: `Cae el ${rank} ${cm.name} (${cm.corps}.º Cuerpo de ${nm}) y sus hombres cargan despiadadamente en venganza.`}); }
  else { bvBanner(V, `☠️ Cae el ${rank} ${cm.name}, comandante del ${cm.corps}.º Cuerpo de ${nm}: la moral se resiente`, side, ''); (b.log = b.log || []).push({k: 'panic', d: b.day, t: `Cae el ${rank} ${cm.name} (${cm.corps}.º Cuerpo de ${nm}); la moral del cuerpo se hunde.`}); }
  if (b.log.length > 30) b.log.shift(); V.shake = Math.min(5, (V.shake || 0) + 2); if (typeof SFX !== 'undefined' && SFX.boom) SFX.boom(0.5);
}
// los proyectiles que caen sobre el comandante
const _tacShellHitM = tacShellHit;
tacShellHit = function (V, b, p, all) {
  _tacShellHitM(V, b, p, all);
  if (!V.cmd || V.replay) return;
  Object.values(V.cmd).forEach(cm => { if (!cm.alive || cm.side === (p.s || (cm.side === 'A' ? 'B' : 'A'))) return; if (Math.hypot(cm.x - p.x2, cm.y - p.y2) < 18 && Math.random() < 0.2) { const c = (V.corps || []).find(q => q.id === cm.id); if (c) bvCmdKill(V, b, cm, c, c.blks.filter(k => k.mode !== 'rout' && k.role !== 'reserve'), 'metralla'); } });
};
const _bvGroundM = bvGround;
bvGround = function (V, b, all, dt) { _bvGroundM(V, b, all, dt); bvCmdStep(V, b, all, dt); };
// dibujo: la bolita, su aura y el recuerdo del caído
const _bvCorpsFlagsM = bvCorpsFlags;
bvCorpsFlags = function (g, V, b) {
  _bvCorpsFlagsM(g, V, b);
  Object.values(V.cmd || {}).forEach(cm => {
    const col = G.C[cm.tag] ? G.C[cm.tag].color : '#fff';
    if (!cm.alive) { const k = (V.t - cm.diedAt) / 14; if (k > 1) return; g.globalAlpha = 1 - k; g.fillStyle = '#e8e2cc'; g.font = 'bold 13px sans-serif'; g.textAlign = 'center'; g.fillText('✝', cm.x, cm.y + 4); g.globalAlpha = 1; return; }
    if (V.selCorps === cm.id) { g.strokeStyle = 'rgba(255,226,138,.45)'; g.setLineDash([4, 5]); g.lineWidth = 1; g.beginPath(); g.arc(cm.x, cm.y, CMD_R, 0, 6.3); g.stroke(); g.setLineDash([]); }
    g.fillStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.ellipse(cm.x + 2, cm.y + 4, 6, 3, 0, 0, 6.3); g.fill();
    g.fillStyle = col; g.beginPath(); g.arc(cm.x, cm.y, 5.6, 0, 6.3); g.fill(); g.strokeStyle = '#f5d76e'; g.lineWidth = 1.8; g.stroke();
    g.fillStyle = '#fff'; g.font = 'bold 7px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('★', cm.x, cm.y + 0.5);
    if (V.selCorps === cm.id || (V.sel && V.sel.corps && V.sel.corps.id === cm.id)) { g.font = 'bold 9px sans-serif'; const w = g.measureText(cm.name).width + 8; g.fillStyle = 'rgba(8,12,16,.8)'; g.fillRect(cm.x - w / 2, cm.y - 20, w, 12); g.fillStyle = '#ffe28a'; g.fillText(cm.name, cm.x, cm.y - 14); }
    g.textBaseline = 'alphabetic';
  });
};
// versión abstracta (sin visor abierto): el comandante también puede caer en el cálculo diario
const _battleDayM = battleDay;
battleDay = function (b) {
  _battleDayM(b);
  if (b.ended || (typeof R !== 'undefined' && R.bviz && R.bviz.id === b.id && !R.bviz.replay)) return;
  b.cmd = b.cmd || {A: {dead: 0, venge: 0, vday: 0}, B: {dead: 0, venge: 0, vday: 0}};
  ['A', 'B'].forEach(s => {
    const st = b.cmd[s], armies = (s === 'A' ? b.A : b.B).map(armyById).filter(Boolean); if (!armies.length || st.dead >= 3) return;
    const n = armies.reduce((m, a) => m + Math.ceil(a.divs.length / 5), 0), risk = 0.012 * n * (typeof weapLvl === 'function' ? 1 + weapLvl(s === 'A' ? b.B0 : b.A0) * 0.3 : 1);
    if (Math.random() < Math.min(0.2, risk)) { st.dead++; armies.forEach(a => { if (typeof armyMor === 'function') a.mor = Math.max(0, armyMor(a) - 0.04); });
      const venge = Math.random() < 0.4; if (venge) { st.venge++; st.vday = b.day + 2; }
      const nm = G.C[s === 'A' ? b.A0 : b.B0].name; (b.log = b.log || []).push({k: venge ? 'charge' : 'panic', d: b.day, t: venge ? `Cae un comandante de cuerpo de ${nm}; sus hombres cargan en venganza.` : `Cae un comandante de cuerpo de ${nm}; la moral se resiente.`}); if (b.log.length > 30) b.log.shift(); }
  });
};
// efecto de los comandantes caídos y de la venganza en el cálculo diario
const _sideStatsM = sideStats;
sideStats = function (b, ids, isAttacker) {
  const r = _sideStatsM(b, ids, isAttacker), key = ids === b.A ? 'A' : ids === b.B ? 'B' : null, st = key && b.cmd && b.cmd[key];
  if (st) { if (st.dead) r.F *= 1 - 0.025 * Math.min(3, st.dead); if (st.venge && b.day <= st.vday) r.F *= 1.06; }
  return r;
};
/* ---- 3) «Mantener posición»: el regimiento no se mueve salvo necesidad ofensiva ---- */
function tacStayBtn(V, sel, ac) {
  if (!sel && !ac) return '';
  const grp = V.selCorps && ac ? ac.blks : sel ? [sel] : [], on = grp.length && grp.every(k => k.d.stay);
  return `<button data-act="tacstay" class="${on ? 'on' : ''}" ${sel || ac ? '' : 'disabled'} data-tip="<b>Mantener posición</b><br>Los regimientos seleccionados se quedan donde están: solo se mueven si el enemigo llega a su alcance (para cargar o rechazarlo) y después vuelven. Púlsalo otra vez para soltarlos."><span>📍</span>Quedarse</button>`;
}
ACT.tacstay = () => {
  const V = R.bviz, b = G.battles.find(x => x.id === UI.battle); if (!V || !V.sel || !b || b.ended || V.replay || V.sel.side !== playerSide(b)) return;
  const grp = (V.selCorps && V.sel.corps && V.sel.corps.id === V.selCorps ? V.sel.corps.blks : [V.sel]).filter(k => k.mode !== 'rout'), on = grp.every(k => k.d.stay);
  grp.forEach(k => { if (on) delete k.d.stay; else { k.d.stay = {x: k.x, y: k.y}; delete k.d.plan; } k.skey = ''; });
  toast(on ? '🚶' : '📍', on ? 'Tropas liberadas: vuelven a obedecer la estrategia.' : `${grp.length} regimiento(s) mantienen la posición.`); renderBattlePanel();
};
// al acabar la batalla se sueltan
const _endBattleM = endBattle;
endBattle = function (b, winner) { _endBattleM(b, winner); [...(b.A || []), ...(b.B || [])].map(armyById).filter(Boolean).forEach(a => a.divs.forEach(d => { if (d.rg) d.rg.forEach(r => { delete r.stay; }); delete d.stay; })); };
