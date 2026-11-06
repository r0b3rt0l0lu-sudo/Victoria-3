/* ===== BATALLA 2: tácticas más realistas (ver ESTUDIO_BATALLA.md) =====
   · CARGA: solo una oleada de asalto (la caballería y los regimientos más frescos, juntos) carga; el resto avanza detrás, apoya con fuego y mantiene la línea.
   · FLANQUEO: los regimientos que no maniobran avanzan, fijan al enemigo y cierran los huecos que dejan los flanqueadores.
   · PÁNICO: un cuerpo flanqueado, rodeado o con su ala abierta puede quebrarse entero; el pánico contagia a los cuerpos vecinos.
   · FUERTES: no se rodean. Las tropas atacan la guarnición o, si el fuerte está vacío, lo ocupan antes de seguir.
   · ÓRDENES: una sola familia de órdenes (Avanzar, Cargar, Flanquear, Mantener, Retirar, Objetivo) que se traduce a maniobra de línea si mandas a un cuerpo entero. */
/* ---------- oleada de asalto ---------- */
function bvReady(k) { return clamp(k.d.o / DIVS[k.d.t].org, 0, 1) * (k.mm === undefined ? 0.8 : k.mm + 0.2) * (0.45 + 0.55 * clamp(k.d.s, 0, 1)) * (1 - 0.4 * (k.fat || 0)); }
function bvChargeWave(V, b, blk) {
  const c = blk.corps; if (!c || blk.type === 'cav' || blk.type === 'tank') return true;
  let W = c._wave; if (W && V.t - W.t < 4) return W.ids.has(blk.id);
  const ls = (c.blks || []).filter(k => k.role === 'line' && k.type === 'inf' && !k.garr && k.mode !== 'rout' && !k.d.out); if (!ls.length) return true;
  const want = Math.max(1, Math.round(ls.length * 0.4)), prev = W ? W.ids : new Set(), keep = ls.filter(k => prev.has(k.id) && bvReady(k) > 0.3), ids = new Set(keep.map(k => k.id));
  if (ids.size < want) {                       // se completa con los más frescos y contiguos entre sí (la oleada es un bloque, no regimientos sueltos)
    const ctr = keep[0] || ls.slice().sort((p, q) => bvReady(q) - bvReady(p))[0];
    ls.filter(k => !ids.has(k.id)).sort((p, q) => (Math.abs(p.lane - ctr.lane) * 0.5 - bvReady(p) * 1.5) - (Math.abs(q.lane - ctr.lane) * 0.5 - bvReady(q) * 1.5)).slice(0, want - ids.size).forEach(k => ids.add(k.id));
  }
  if (!W || ids.size !== prev.size) { if (!W && ls.length > 1 && !V.replay) bvBanner(V, `🔥 ${ids.size} regimiento(s) del ${corpsName(c)} cargan; el resto los apoya`, c.side, ''); }
  c._wave = {ids, t: V.t}; return ids.has(blk.id);
}
/* ---------- flanqueo: los demás cierran huecos y mantienen la línea ---------- */
function bvFillY(V, b, blk, all, y0) {
  V._fill = V._fill || {}; let F = V._fill[blk.side];
  if (!F || V.t - F.t > 0.6) {
    const ls = all.filter(k => k.side === blk.side && k.role === 'line' && k.mode !== 'rout' && !k.garr && !k.isFlk && k.type !== 'art' && k.type !== 'cav' && !k.d.plan && !k.d.out).sort((p, q) => p.hy - q.hy);
    const top = 62, bot = BV_H - 46, m = new Map(); ls.forEach((k, i) => { const slot = top + (i + 0.5) * (bot - top) / ls.length; m.set(k.id, k.hy + (slot - k.hy) * 0.8); });
    F = V._fill[blk.side] = {t: V.t, m};
  }
  const y = F.m.get(blk.id); return y === undefined ? y0 : y;
}
/* ---------- fuertes: se asaltan, no se rodean ---------- */
function tacFortObjective(b, blk) {
  const dir = blk.side === 'A' ? 1 : -1; let best = null, bd = 1e9;
  (b.forts || []).forEach(f => { if (f.hp <= 0 || f.side === blk.side) return; if ((f.x - blk.x) * dir < -f.w / 2 - 12) return; const d = Math.hypot(f.x - blk.x, f.y - blk.y); if (d < 360 && d < bd) { bd = d; best = f; } });
  return best;
}
const _bvFoeB = bvFoe;
bvFoe = function (blk, all) {
  const b = R.bvB || G.battles.find(x => x.id === UI.battle); const f = b && blk.type !== 'art' && blk.role !== 'reserve' ? tacFortObjective(b, blk) : null;
  if (f) { let best = null, bc = 1e9; all.forEach(o => { if (o.side === blk.side || o.mode === 'rout') return; const gar = o.d.cust && o.d.cust.fort === f.id, d = Math.hypot(o.x - blk.x, o.y - blk.y); if (!gar && d > 60) return; const c = d - (gar ? 80 : 0); if (c < bc) { bc = c; best = o; } }); if (best) return best; }
  return _bvFoeB(blk, all);
};
// fuerte sin guarnición: los dos regimientos de infantería más cercanos lo ocupan antes de seguir adelante
function tacFortPush(V, b, blk, all, mode, dist, dir, spd) {
  if (blk.type === 'cav' || blk.type === 'tank' || blk.d.plan || blk.d.stay) return null;
  const f = tacFortObjective(b, blk); if (!f || (b.forts || []).indexOf(f) < 0) return null; if (tacGarrisonOf(b, f).length) return null;
  const T = V.t; if (!f._capAt || T - f._capAt > 2) { f._capAt = T; f._cap = all.filter(o => o.side !== f.side && o.type === 'inf' && o.role === 'line' && o.mode !== 'rout' && !o.garr && !o.d.plan).sort((p, q) => Math.hypot(p.x - f.x, p.y - f.y) - Math.hypot(q.x - f.x, q.y - f.y)).slice(0, 2).map(o => o.id); }
  if (!f._cap || f._cap.indexOf(blk.id) < 0) return null;
  const d = Math.hypot(f.x - blk.x, f.y - blk.y);
  return {mode: d < 70 ? 'charge' : 'advance', tx: f.x, ty: f.y, spd: spd * (d < 70 ? 1.4 : 1.1), path: [[blk.x, blk.y], [f.x, f.y]]};
}
// la infantería pegada a un fuerte lo desgasta (fuego, hachas, escalas) además del cañoneo diario
function tacFortSiege(V, b, all, step) {
  (b.forts || []).forEach(f => { if (f.hp <= 0) return; const n = all.filter(o => o.side !== f.side && o.mode !== 'rout' && o.type !== 'art' && Math.abs(o.x - f.x) < f.w / 2 + 40 && Math.abs(o.y - f.y) < f.h / 2 + 40).length; if (!n) return;
    const was = f.hp; f.hp = Math.max(0, f.hp - n * 1.1 * step * (f.kind === 'trench' ? 0.8 : f.kind === 'fort' ? 0.45 : 1)); if (was > 0 && f.hp <= 0) { tacRelease(b, f); (b.log = b.log || []).push({k: 'panic', d: b.day, t: `${FORT_KINDS[f.kind].ic} ¡Cae ${FORT_KINDS[f.kind].n.toLowerCase()} de ${G.C[f.side === 'A' ? b.A0 : b.B0].name} tras el asalto!`}); if (b.log.length > 30) b.log.shift(); } });
}
/* ---------- pánico de cuerpo ---------- */
function bvCorpsPanic(V, b, all, step) {
  if (V.over || b.prep || V.replay) return;
  (V.corps || []).forEach(c => {
    const ls = (c.blks || []).filter(k => k.role === 'line' && k.type !== 'art' && !k.garr && k.mode !== 'rout' && !k.d.out); if (ls.length < 2 || V.t < (c.panicUntil || 0)) return;
    if (buffOn(V, c.side, 'endure') || buffOn(V, c.side, 'inspire')) return;
    const fl = ls.filter(k => V.t - (k.flanked || -99) < 4 && !k.anc).length, ex = ls.filter(k => k.expo && !k.anc).length, rear = ls.filter(k => V.t - (k.flanked || -99) < 4 && k.foe && Math.abs(bvAng(k.hd, Math.atan2(k.foe.y - k.y, k.foe.x - k.x))) > 1.9).length;
    const score = (fl + 0.7 * ex + 0.8 * rear) / ls.length; c.threat = score; if (score < 0.4) return;
    const mm = ls.reduce((n, k) => n + (k.mm === undefined ? 0.8 : k.mm), 0) / ls.length, org = ls.reduce((n, k) => n + k.d.o / DIVS[k.d.t].org, 0) / ls.length, cm = V.cmd && V.cmd[c.id], lead = cm && cm.alive ? 0.7 : 1.15;
    const p = clamp((score - 0.3) * (0.5 + 0.9 * (1 - mm) + 0.5 * (1 - org)) * 0.16 * lead, 0, 0.5) * step;
    if (Math.random() >= p) return;
    c.panicUntil = V.t + 30; const cn = G.C[c.tag].name;
    ls.forEach(k => { if (k.type === 'tank') return; k.mm = Math.min(k.mm === undefined ? 0.8 : k.mm, 0.14); k.brk = Math.max(k.brk || 0, 5 + Math.random() * 4); k.d.o = Math.max(0, k.d.o - DIVS[k.d.t].org * 0.14); k.fat = Math.min(1, (k.fat || 0) + 0.25); k.figs.forEach(f => { if (f.alive && !f.flee && Math.random() < 0.55) bvFlee(V, k, f, 1.2); }); });
    (V.corps || []).forEach(o => { if (o === c || o.side !== c.side) return; (o.blks || []).forEach(k => { if (k.mode === 'rout' || k.garr) return; const d = Math.hypot(k.x - c.cx, k.y - ls[0].y); if (d < 260) k.mm = Math.max(0, (k.mm === undefined ? 0.8 : k.mm) - 0.16); }); });          // el pánico salta a los cuerpos vecinos
    bvBanner(V, `😱 ¡El ${corpsName(c)} de ${cn} es flanqueado y entra en pánico!`, c.side === 'A' ? 'B' : 'A', '');
    (b.log = b.log || []).push({k: 'panic', d: b.day, t: `El ${corpsName(c)} de ${cn} queda flanqueado y se quiebra entero: los regimientos huyen y los cuerpos vecinos vacilan.`}); if (b.log.length > 30) b.log.shift();
    if (typeof SFX !== 'undefined' && SFX.horn) SFX.horn(0.8);
  });
}
const _tacThinkB = tacThink;
tacThink = function (V, b, all, dt) {
  const run = !(V.over || b.prep || b.ended || V.replay || dt <= 0); _tacThinkB(V, b, all, dt);
  if (!run) return; V._bt = (V._bt || 0) + dt; if (V._bt < 1) return; const step = V._bt; V._bt = 0;
  tacFortSiege(V, b, all, step); bvCorpsPanic(V, b, all, step);
};
/* ---------- órdenes unificadas: «Cargar» para un regimiento y traducciones a maniobra de línea ---------- */
PLANS.charge = {n: 'Cargar', ic: '🔥', col: '#ff3a3a', hint: 'Haz clic en el punto del enemigo. Avanza y, al llegar a unos 130 pasos, CARGA a la bayoneta. Con un cuerpo entero seleccionado, solo carga su oleada de asalto y el resto lo apoya.', multi: true, n1: 1};
PLANS.attack.n = 'Avanzar'; PLANS.attack.hint = 'Haz UN clic donde debe llegar. Avanza, dispara al entrar en alcance y mantiene la posición (Mayús+clic añade puntos de paso). Con un cuerpo entero, avanza en línea.';
PLANS.flank.n = 'Flanquear'; PLANS.flank.hint = 'Con un regimiento: 2 clics (punto de rodeo y flanco enemigo). Con un cuerpo entero: UN clic más allá del extremo enemigo y el cuerpo envuelve sin romper la línea, mientras el resto del ejército avanza y fija al enemigo.';
PLANS.defend.n = 'Mantener'; PLANS.defend.hint = 'Haz 2 clics: los extremos del tramo de frente que debe mantener. Los regimientos se reparten por él, lo ocupan y lo defienden.';
PLANS.retreat.n = 'Retirar'; PLANS.target.n = 'Objetivo';
FORM_MAP.charge = 'fchg'; FORM_MAP.defend = 'fsec'; FORM_MAP.target = undefined;
const _bvPlanStepB = bvPlanStep;
bvPlanStep = function (V, b, blk, dt, all, home) {
  const pl = blk.d.plan;
  if (pl && pl.k === 'charge' && !V.over && !b.ended && blk.type !== 'art') {
    const dir = blk.side === 'A' ? 1 : -1, foes = all.filter(o => o.side !== blk.side && o.mode !== 'rout' && o.role !== 'reserve'), near = foes.reduce((m, o) => { const d = Math.hypot(o.x - blk.x, o.y - blk.y); return !m || d < m.d ? {o, d} : m; }, null);
    const [px, py] = pl.pts[0] || [blk.x, blk.y], dp = Math.hypot(px - blk.x, py - blk.y); blk.foe = near ? near.o : blk.foe;
    const eng = near && Math.abs(near.o.x - blk.x) < (blk.dep + near.o.dep) / 2 + 10 && Math.abs(near.o.y - blk.y) < (blk.wid + near.o.wid) / 2 * 0.95;
    if (eng) return {mode: 'melee', tx: blk.x, ty: blk.y, k: 0, path: null};
    if (near && near.d < 130) { const f = near.o; return {mode: blk.type === 'cav' ? 'gallop' : 'charge', tx: f.x - dir * ((blk.dep + f.dep) / 2 + 7), ty: f.y, k: blk.type === 'cav' ? 2.6 : 3.2, path: null}; }
    if (dp > 14) return {mode: 'advance', tx: px, ty: py, k: 1.25, path: [[blk.x, blk.y], [px, py]]};
    return {mode: 'hold', tx: blk.x, ty: blk.y, k: 0, path: null};
  }
  return _bvPlanStepB(V, b, blk, dt, all, home);
};
/* ---------- fase 2: mando por proximidad y cuadro de infantería ---------- */
// fuera del alcance de la voz y la bandera del comandante de cuerpo, los regimientos pierden moral poco a poco y tardan más en recibir órdenes
function bvCommandRange(V, b, all, step) {
  (V.corps || []).forEach(c => { const cm = V.cmd && V.cmd[c.id]; (c.blks || []).forEach(k => {
    if (k.role === 'reserve' || k.garr || k.mode === 'rout' || k.mm === undefined) { k.noCmd = false; return; }
    const far = cm && cm.alive ? Math.hypot(k.x - cm.x, k.y - cm.y) > CMD_R * 4.2 : !!(cm && !cm.alive);
    k.noCmd = far; if (far) k.mm = Math.max(0, k.mm - (cm && !cm.alive ? 0.010 : 0.006) * step);
  }); });
}
// cuadro: la infantería sin cobertura que ve venir una carga de caballería se cierra en cuadro (aguanta mejor, pero es un blanco para la artillería y no maniobra)
function bvSquares(V, b, all, step) {
  const cav = all.filter(o => o.type === 'cav' && (o.mode === 'gallop' || o.mode === 'charge') && o.mode !== 'rout');
  all.forEach(k => {
    if (k.type !== 'inf' || k.garr || k.mode === 'rout' || k.mode === 'melee' || k.brk > 0) return;
    const th = cav.find(o => o.side !== k.side && Math.hypot(o.x - k.x, o.y - k.y) < 190 && Math.hypot(o.x - k.x, o.y - k.y) > 30);
    if (th && (k.mm === undefined || k.mm > 0.25) && !(k.d.plan && k.d.plan.k === 'retreat')) { if (!(k.sq > V.t)) { k.sqNew = true; } k.sq = V.t + 4; } else if (k.sq && k.sq < V.t) k.sq = 0;
  });
}
const _tacThinkC2 = tacThink;
tacThink = function (V, b, all, dt) {
  _tacThinkC2(V, b, all, dt); if (V.over || b.prep || b.ended || V.replay || dt <= 0) return; V._ct = (V._ct || 0) + dt; if (V._ct < 1) return; const step = V._ct; V._ct = 0;
  bvCommandRange(V, b, all, step); bvSquares(V, b, all, step);
};
const _bvStepBlockC2 = bvStepBlock;
bvStepBlock = function (V, b, blk, dt, lines, all) {
  _bvStepBlockC2(V, b, blk, dt, lines, all);
  if (blk.sq > V.t && blk.mode !== 'rout' && blk.mode !== 'melee') { blk.vx *= 0.25; blk.vy *= 0.25; blk.mode = 'hold'; blk.comp += (0.75 - blk.comp) * Math.min(1, dt * 3); blk.hd = blk.hd + (Math.round(blk.hd / (Math.PI / 2)) * Math.PI / 2 - blk.hd) * Math.min(1, dt * 2); if (blk.sqNew) { blk.sqNew = false; if (!V.replay && Math.random() < 0.5) bvBanner(V, `🔲 ${G.C[blk.tag].name} forma el cuadro ante la caballería`, blk.side, ''); } }
};
const _tacShellHitC2 = tacShellHit;
tacShellHit = function (V, b, p, all) {
  _tacShellHitC2(V, b, p, all); const v = all.find(x => x.id === p.vt); if (v && v.sq > V.t && v.mode !== 'rout') { v.d.s = Math.max(0, v.d.s - 0.004); v.d.o = Math.max(0, v.d.o - DIVS[v.d.t].org * 0.012); }       // el cuadro es un blanco apretado
};
const _bvCorpsFlagsC2 = bvCorpsFlags;
bvCorpsFlags = function (g, V, b) {
  _bvCorpsFlagsC2(g, V, b);
  V.blocks.forEach(k => { if (k.sq > V.t && k.mode !== 'rout') { g.strokeStyle = 'rgba(255,240,170,.85)'; g.lineWidth = 1.4; g.setLineDash([3, 2]); g.strokeRect(k.x - k.wid / 2 - 4, k.y - k.dep / 2 - 4, k.wid + 8, k.dep + 8); g.setLineDash([]); } if (k.noCmd && k.mode !== 'rout' && k.side === playerSide(b)) { g.font = '10px sans-serif'; g.textAlign = 'center'; g.fillStyle = '#ffb347'; g.fillText('📡✖', k.x, k.y - k.dep / 2 - 6); } });
};
