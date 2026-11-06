/* ===== EJÉRCITO: órdenes coordinadas, segunda línea y persecución tras la victoria ===== */
const ARMY_ORD = {
  aenvT: {ic: '🌀', n: 'Envolver por arriba', tip: 'El cuerpo del ala superior envuelve el flanco enemigo; el centro fija al enemigo y el ala opuesta se rehúsa.'},
  aenvB: {ic: '🌀', n: 'Envolver por abajo', tip: 'El cuerpo del ala inferior envuelve; el centro fija al enemigo y el ala opuesta se rehúsa.'},
  adbl: {ic: '🦀', n: 'Doble envolvimiento', tip: 'Las dos alas envuelven mientras el centro fija al enemigo (tipo Cannae).'},
  aesc: {ic: '📐', n: 'Orden oblicuo', tip: 'Los cuerpos entran en combate de uno en uno desde el extremo superior (cada 7 s); el último se rehúsa.'},
  adef: {ic: '🛡️', n: 'Línea defensiva', tip: 'Los extremos se doblan atrás (flancos rehusados), el centro se realinea y despliega una segunda línea.'},
  a2l: {ic: '🧱', n: 'Segunda línea', tip: 'Alterna: activa o desactiva la segunda línea (apoyos 100 pasos detrás que releven a los regimientos agotados) en todos los cuerpos.'},
  area: {ic: '📏', n: 'Realinear ejército', tip: 'Todos los cuerpos se detienen y reajustan la línea.'}
};
function armyOrder(V, b, kind) {
  const ps = playerSide(b), cs = (V.corps || []).filter(c => c.side === ps && fmLs(c).length >= 1).sort((p, q) => p.yc - q.yc);
  if (kind === 'a2l') { b.sup = b.sup || {}; const on = !cs.every(c => b.sup[c.id]); cs.forEach(c => { if (on) b.sup[c.id] = true; else { delete b.sup[c.id]; c.regs.forEach(r => { delete r.sup; }); } }); toast('🧱', on ? 'Segunda línea desplegada en todos los cuerpos.' : 'Segunda línea disuelta.'); return; }
  if (cs.length < 2) { toast('⚠️', 'Necesitas al menos 2 cuerpos en la línea para dar una orden de ejército.'); return; }
  const foes = [...V.blocks.values()].filter(k => k.side !== ps && k.role === 'line' && k.mode !== 'rout'); if (!foes.length) return;
  const top = Math.min(...foes.map(k => k.y)), bot = Math.max(...foes.map(k => k.y)), ex = foes.reduce((n, k) => n + k.x, 0) / foes.length, dir = ps === 'A' ? 1 : -1, n = cs.length;
  const mid = cs.slice(1, n - 1), first = cs[0], last = cs[n - 1], fix = c => { const l = fmLs(c), x = l.reduce((m, k) => m + k.x, 0) / l.length; return [[x + dir * 70, c.yc]]; };
  const send = (c, k, pts, extraDelay) => { const fr = fmFriction(V, b, c); bvFormSet(V, b, c, k, pts, true, fr.delay + (extraDelay || 0), fr.mis); };
  if (kind === 'aenvT' || kind === 'aenvB') { const topS = kind === 'aenvT', wing = topS ? first : last, other = topS ? last : first; send(wing, 'fenv', [[ex, topS ? top - 55 : bot + 55]]); send(other, 'fref', [[ex, topS ? BV_H : 0]]); mid.forEach(c => send(c, 'fadv', fix(c), 4)); }
  else if (kind === 'adbl') { send(first, 'fenv', [[ex, top - 55]]); send(last, 'fenv', [[ex, bot + 55]]); mid.forEach(c => send(c, 'fadv', fix(c), 4)); }
  else if (kind === 'aesc') { cs.forEach((c, i) => { if (i === n - 1) send(c, 'fref', [[ex, BV_H]]); else send(c, 'fech', [[ex, c.yc]], i * 7); }); }
  else if (kind === 'adef') { send(first, 'fref', [[ex, 0]]); send(last, 'fref', [[ex, BV_H]]); mid.forEach(c => send(c, 'frea', [])); b.sup = b.sup || {}; mid.forEach(c => { b.sup[c.id] = true; }); }
  else if (kind === 'area') cs.forEach(c => send(c, 'frea', []));
  const A = ARMY_ORD[kind]; bvBanner(V, `${A.ic} Orden de ejército: ${A.n}`, ps, ''); (b.log = b.log || []).push({k: 'flank', d: b.day, t: `${G.C[cs[0].tag].name}: orden de ejército «${A.n}».`}); if (b.log.length > 30) b.log.shift();
}
ACT.armyord = d => { const V = R.bviz, b = G.battles.find(x => x.id === UI.battle); if (!V || !b || b.ended || V.replay || b.prep) return; armyOrder(V, b, d.k); renderBattlePanel(); };
ACT.corpsup = () => {
  const V = R.bviz, b = G.battles.find(x => x.id === UI.battle); if (!V || !V.sel || !V.sel.corps || !b || b.ended || V.replay || V.sel.side !== playerSide(b)) return;
  const c = V.sel.corps; b.sup = b.sup || {}; if (b.sup[c.id]) { delete b.sup[c.id]; c.regs.forEach(r => { delete r.sup; }); } else b.sup[c.id] = true;
  toast('🧱', b.sup[c.id] ? `${corpsName(c)}: segunda línea desplegada.` : `${corpsName(c)}: segunda línea disuelta.`); renderBattlePanel();
};
// ---- segunda línea: apoyos detrás que releven a los regimientos agotados ----
const _bvSyncE = bvSync;
bvSync = function (V, b) {
  _bvSyncE(V, b);
  if (!b.sup || b.prep) return;
  (V.corps || []).forEach(c => {
    if (!b.sup[c.id]) return;
    const ls = c.blks.filter(k => k.role === 'line' && !k.d.out && k.type === 'inf').sort((p, q) => p.hy - q.hy), n = ls.length; if (n < 4) return;
    const m = Math.max(1, Math.floor(n * 0.4)); let sups = ls.filter(k => k.d.sup);
    if (sups.length > m) sups.slice(m).forEach(k => { delete k.d.sup; }); else if (sups.length < m) ls.filter(k => !k.d.sup).sort((p, q) => (q.d.s + q.d.o / DIVS[q.d.t].org) - (p.d.s + p.d.o / DIVS[p.d.t].org)).slice(0, m - sups.length).forEach(k => { k.d.sup = true; });
    const front = ls.filter(k => !k.d.sup), sp = ls.filter(k => k.d.sup), nf = front.length; if (nf < 2) return;
    const yA = ls[0].hy, yB = ls[n - 1].hy, step = (yB - yA) / (nf - 1);
    front.forEach((k, i) => { k.hy = yA + i * step; k.hdep = 0; });
    sp.forEach((k, j) => { const i = Math.min(nf - 2, Math.round(j * (nf - 1) / Math.max(1, sp.length))); k.hy = (front[i].hy + front[i + 1].hy) / 2; k.hdep = 105; k.supPos = true; });
    ls.forEach(k => { if (!k.d.sup) k.supPos = false; });
  });
};
function supFeed(V, b, all, dt) {
  if (!b.sup || V.over || b.prep || V.replay) return; V._sf = (V._sf || 0) + dt; if (V._sf < 1.5) return; V._sf = 0;
  (V.corps || []).forEach(c => {
    if (!b.sup[c.id]) return;
    const ls = c.blks.filter(k => k.role === 'line' && !k.d.out && k.type === 'inf'), front = ls.filter(k => !k.d.sup), sups = ls.filter(k => k.d.sup && k.d.s > 0.35 && k.d.o / DIVS[k.d.t].org > 0.45 && k.mode !== 'rout' && !(k.brk > 0));
    if (!sups.length) return;
    const weak = front.filter(k => k.mode !== 'rout' && (k.d.s < 0.45 || k.d.o / DIVS[k.d.t].org < 0.28 || k.brk > 0)).sort((p, q) => p.d.s - q.d.s)[0];
    if (!weak) return; const s = sups.sort((p, q) => Math.hypot(p.hy - weak.hy, 0) - Math.hypot(q.hy - weak.hy, 0))[0];
    weak.d.sup = true; delete s.d.sup; bvBanner(V, `🧱 La segunda línea releva a un regimiento de ${G.C[weak.tag].name}`, weak.side, '');
  });
}
// ---- persecución tras la victoria ----
const _endBattleX = endBattle;
endBattle = function (b, winner) {
  const win = (winner === 'A' ? b.A : b.B).map(armyById).filter(Boolean), lose = (winner === 'A' ? b.B : b.A).map(armyById).filter(Boolean);
  const cavOk = d => dKind(d) === 'cav' && d.s > 0.3 && d.o > DIVS[d.t].org * 0.25, cavN = win.reduce((n, a) => n + a.divs.filter(cavOk).length, 0), lcav = lose.reduce((n, a) => n + a.divs.filter(d => dKind(d) === 'cav' && d.s > 0.3).length, 0);
  _endBattleX(b, winner);
  [...win, ...lose].forEach(a => a.divs.forEach(d => { if (d.rg) d.rg.forEach(r => { delete r.sup; }); }));
  if (!cavN || !lose.length) return;
  const wk = typeof battleWeather === 'function' ? battleWeather(b).k : 'clear', f = wk === 'fog' ? 0.6 : wk === 'rain' || wk === 'snow' ? 0.75 : 1, p = clamp(0.045 * cavN * f * (1 - Math.min(0.6, lcav * 0.15)), 0, 0.28);
  if (p < 0.01) return; let men = 0, guns = 0;
  lose.forEach(a => {
    if (!G.armies.includes(a)) return;
    a.divs.forEach(d => { const dm = d.s * p * 0.7; d.s = Math.max(0, d.s - dm); men += dm * MEN_PER_DIV; d.o = Math.max(0, d.o * (1 - p)); });
    const art = a.divs.filter(d => dKind(d) === 'art'); art.forEach(d => { if (Math.random() < Math.min(0.6, p * 3)) { d.s = 0; guns++; } });
    a.divs = a.divs.filter(d => d.s > 0.04); if (!a.divs.length) a._dead = true;
  });
  G.armies = G.armies.filter(a => !a._dead);
  win.forEach(a => a.divs.forEach(d => { if (dKind(d) === 'cav') d.o = Math.max(0, d.o - DIVS[d.t].org * 0.14); }));
  men = Math.round(men); b.pursuit = {men, guns, cav: cavN}; b.lostB = (b.lostB || 0) + (winner === 'A' ? men : 0); b.lostA = (b.lostA || 0) + (winner === 'A' ? 0 : men);
  const lt = lose[0].tag, wt = win[0].tag; if (typeof bleed === 'function') bleed(lt, men);
  const msg = `La caballería de ${G.C[wt].name} persigue a los derrotados de ${G.C[lt].name}: ${fmtN(men, 0)} bajas y ${guns} batería${guns === 1 ? '' : 's'} capturada${guns === 1 ? '' : 's'}.`;
  (b.log = b.log || []).push({k: 'cav', d: b.day, t: msg}); if (b.log.length > 30) b.log.shift(); if (wt === G.player || lt === G.player) notify('war', msg, b.state);
};
// en el visor, la caballería vencedora galopa tras los fugitivos
const _bvGroundX = bvGround;
bvGround = function (V, b, all, dt) {
  _bvGroundX(V, b, all, dt); supFeed(V, b, all, dt);
  if (V.over && V.over.t < 16 && !V.replay) {
    const win = V.over.loser === 'A' ? 'B' : 'A';
    if (b.pursuit && !V._purMsg && V.over.t > 1.5) { V._purMsg = 1; bvBanner(V, `🐎 La caballería de ${G.C[win === 'A' ? b.A0 : b.B0].name} persigue a los fugitivos`, win, ''); }
    all.forEach(k => { if (k.side !== win || k.type !== 'cav' || k.mode !== 'gallop') return; all.forEach(o => { if (o.side === win || o.mode === 'rout' && !o.figs.some(f => f.alive)) return; if (Math.hypot(o.x - k.x, o.y - k.y) < 34 && Math.random() < dt * 3) { const al = o.figs.filter(f => f.alive && !f.flee).concat(o.figs.filter(f => f.alive)); if (al.length) { bvKill(V, o, al[Math.floor(Math.random() * al.length)]); bvPart(V, {k: 'spark', x: o.x + rnd(-8, 8), y: o.y + rnd(-8, 8), life: 0.4, hot: 1}); } } }); });
  }
};
// la IA despliega segunda línea al defender
const _fmAiE = fmAi;
fmAi = function (V, b, all, dt) {
  _fmAiE(V, b, all, dt); if (V.over || b.prep) return; V._sai = (V._sai || 0) + dt; if (V._sai < 9) return; V._sai = 0;
  const ps = playerSide(b); b.sup = b.sup || {};
  ['A', 'B'].forEach(s => { if (s === ps || (b.att === s && Math.random() < 0.7)) return; (V.corps || []).filter(c => c.side === s && c.blks.length >= 4 && !b.sup[c.id]).slice(0, 1).forEach(c => { b.sup[c.id] = true; }); });
};
