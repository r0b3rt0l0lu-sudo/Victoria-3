/* ===== LÍNEA DE BATALLA: cohesión, formaciones y maniobras de cuerpo (ver ESTUDIO_LINEA.md) =====
   Cada cuerpo es una línea con una GUÍA. Los regimientos ocupan «slots» a ambos lados de la guía; la guía avanza al paso de
   su regimiento más lento y espera a los rezagados, que aceleran. Las órdenes de maniobra mueven la guía (o la giran sobre un
   pivote) y los regimientos conservan siempre su alineación. */
const FORM = {
  fadv: {n: 'Avanzar en línea', ic: '➡️', col: '#ff6a52', hint: 'Haz UN clic donde debe llegar la línea (Mayús+clic añade puntos). El cuerpo avanza alineado, al paso de su regimiento más lento, y se detiene a disparar al llegar a alcance.'},
  fchg: {n: 'Carga en línea', ic: '🔥', col: '#ff3a3a', hint: 'Haz clic en el punto del enemigo. El cuerpo avanza alineado y carga TODO A LA VEZ al llegar a unos 100 pasos.'},
  fenv: {n: 'Envolver', ic: '🌀', col: '#ffb43c', hint: 'Haz clic MÁS ALLÁ del extremo enemigo por donde envolver. La línea gira como una puerta sobre el extremo opuesto sin romperse.'},
  fech: {n: 'Escalón', ic: '📐', col: '#ffd24a', hint: 'Haz clic en el objetivo. El ala más cercana ataca primero y las demás se escalonan detrás; se incorporan cuando la primera traba combate.'},
  fref: {n: 'Refusar flanco', ic: '🔙', col: '#5aa8ff', hint: 'Haz clic en el lado (arriba/abajo) cuyo extremo debe doblarse atrás en ángulo para proteger el flanco.'},
  frea: {n: 'Realinear', ic: '📏', col: '#9bd17a', hint: 'El cuerpo se detiene y reajusta su línea.'},
  fret: {n: 'Retirada ordenada', ic: '↩️', col: '#b7bcc4', hint: 'Haz clic en el punto de repliegue. El cuerpo se retira manteniendo la línea y de cara al enemigo.'}
};
Object.keys(FORM).forEach(k => { PLANS[k] = {n: FORM[k].n, ic: FORM[k].ic, col: FORM[k].col, hint: FORM[k].hint, multi: true, n1: 1}; });
const FORM_MAP = {attack: 'fadv', flank: 'fenv', retreat: 'fret'};          // las órdenes de cuerpo entero se traducen a maniobras de línea
const FORM_TIP = {fadv: 'Mueve el cuerpo ENTERO como una línea.', fchg: 'Avance alineado y carga simultánea.', fenv: 'Arco sobre el flanco enemigo.', fech: 'Ataque escalonado desde un extremo.', fref: 'Dobla un extremo atrás.', frea: 'Detiene y reajusta la línea.', fret: 'Repliegue sin romper la línea.'};
const fmInt = k => Math.max(22, k.wid * 0.55);
const fmRot = (a, x, y) => [Math.cos(a) * x - Math.sin(a) * y, Math.sin(a) * x + Math.cos(a) * y];
function fmLs(c) { return (c.blks || []).filter(k => k.role === 'line' && !k.d.out && k.mode !== 'rout' && !k.d.plan && !k.garr && k.type !== 'art').sort((p, q) => p.hy - q.hy); }
function fmDefaultG(V, b, c, ls) {
  const lines = {A: bvLine(V, b, 'A'), B: bvLine(V, b, 'B')}, yc = ls.reduce((n, k) => n + k.hy, 0) / ls.length;
  return {x: bvLineFor(V, b, ls[0], lines), y: yc, yc};
}
const FM_PHI = 0.62;
function fmAngle(pl, dir) { return (pl.sweep === 'top' ? 1 : -1) * dir * (pl.psi || 0); }
// posición del slot i de la formación según la guía y la maniobra
function fmSlot(c, fm, pl, ls, i) {
  const dir = c.side === 'A' ? 1 : -1, th0 = dir > 0 ? 0 : Math.PI, k = ls[i], n = ls.length;
  let lx = -(k.hdep + k.dep / 2), ly = (k.hy - fm.yc) * dir;
  if (pl.k === 'fech' && n > 1) { const r = pl.lead === 'top' ? i / (n - 1) : (n - 1 - i) / (n - 1); lx += (pl.sk || 0) * (1 - r); }
  if (pl.k === 'fref' && n > 2) {
    const m = Math.max(1, Math.round(n / 3)), grp = pl.side === 'top' ? i < m : i >= n - m;
    if (grp) { const kj = ls[pl.side === 'top' ? m : n - 1 - m], jx = -(kj.hdep + kj.dep / 2), jy = (kj.hy - fm.yc) * dir, u = Math.abs(k.hy - kj.hy); lx = jx - u * Math.sin(FM_PHI); ly = jy + (k.hy - kj.hy) * dir * Math.cos(FM_PHI); }
  }
  let [ox, oy] = fmRot(th0, lx, ly), x = fm.x + ox, y = fm.y + oy;
  if (pl.k === 'fenv') {
    const p = ls[pl.sweep === 'top' ? n - 1 : 0], [qx, qy] = fmRot(th0, -(p.hdep + p.dep / 2), (p.hy - fm.yc) * dir), px = fm.x + qx, py = fm.y + qy, [dx, dy] = fmRot(fmAngle(pl, dir), x - px, y - py);
    x = px + dx; y = py + dy;
  }
  return [x, y];
}
// ---- fijar una maniobra sobre un cuerpo ----
function bvFormSet(V, b, c, kind, pts, quiet, delay, mis) {
  const ls = fmLs(c); if (!ls.length) return false;
  c.blks.forEach(k => { if (k.role === 'line') { delete k.d.plan; delete k.d.stay; k.skey = ''; } });
  b.cplan = b.cplan || {}; const ys = ls.reduce((n, k) => n + k.y, 0) / ls.length, T = (pts && pts[0]) || [ls[0].x, ys], side = T[1] < ys ? 'top' : 'bottom';
  const pl = {k: kind, pts: (pts || []).map(p => [p[0], p[1]]), i: 0, t0: V.t + (delay || 0), done: false, st: 0, psi: 0, sweep: side, side, lead: side, msg: !!delay};
  if (mis) { pl.mis = true; pl.pts.forEach(p => { p[1] = clamp(p[1] + (Math.random() < 0.5 ? -1 : 1) * (50 + Math.random() * 45), 36, BV_H - 20); }); }
  b.cplan[c.id] = pl; delete V.fm[c.id];
  if (!quiet) { const F = FORM[kind]; bvBanner(V, delay >= 1.5 ? `✉️ Orden «${F.n}» enviada al ${corpsName(c)}: llegará en ${delay} s` : `${F.ic} ${F.n}: ${corpsName(c)}`, c.side, ''); (b.log = b.log || []).push({k: kind === 'fenv' || kind === 'fech' ? 'flank' : 'charge', d: b.day, t: `${G.C[c.tag].name}: ${corpsName(c)} ejecuta «${F.n}».`}); if (b.log.length > 30) b.log.shift(); }
  return true;
}
function fmFriction(V, b, c) {          // las órdenes tardan en llegar y a veces se malinterpretan
  const cc = G.C[c.tag], has = k => typeof hasTech === 'function' && hasTech(cc, k), cm = V.cmd && V.cmd[c.id], hq = [c.side === 'A' ? 30 : BV_W - 30, BV_H / 2], cx = cm ? cm.x : hq[0], cy = cm ? cm.y : hq[1];
  let d = 0.8 + Math.hypot(cx - hq[0], cy - hq[1]) / 280; if (has('telegraph')) d *= 0.8; if (has('general_staff')) d *= 0.6;
  const wx = battleWeather(b).k; if (wx === 'fog' || wx === 'rain') d *= 1.25;
  return {delay: +d.toFixed(1), mis: Math.random() < 0.1 * (has('general_staff') ? 0.4 : 1) * (wx === 'fog' ? 1.6 : 1)};
}
function fmEndPsi(c, fm, pl, ls) {            // ángulo final del giro para que el extremo exterior llegue al punto marcado
  const T = pl.pts[pl.pts.length - 1], n = ls.length, out = pl.sweep === 'top' ? 0 : n - 1; let best = 1e9, bp = 0.9; pl.gx = fm.x + (T[0] - fm.x) * 0.45; const fm2 = Object.assign({}, fm, {x: pl.gx});
  for (let p = 0.3; p <= 1.46; p += 0.04) { pl.psi = p; const [x, y] = fmSlot(c, fm2, pl, ls, out), d = Math.hypot(x - T[0], y - T[1]); if (d < best) { best = d; bp = p; } }
  pl.psi = 0; return clamp(bp, 0.85, 1.45);
}
// ---- actualización de la guía de un cuerpo ----
function fmUpdate(V, b, c, pl, dt, all) {
  const ls = fmLs(c); if (!ls.length) return;
  const dir = c.side === 'A' ? 1 : -1, th0 = dir > 0 ? 0 : Math.PI, n = ls.length; let fm = V.fm[c.id];
  const yc = ls.reduce((s, k) => s + k.hy, 0) / n;
  if (!fm) {
    let gx = 0, gy = 0; ls.forEach(k => { const [ox, oy] = fmRot(th0, -(k.hdep + k.dep / 2), (k.hy - yc) * dir); gx += k.x - ox; gy += k.y - oy; });
    fm = V.fm[c.id] = {x: gx / n, y: gy / n, yc};
    if (pl.k === 'fech' && pl.skew === undefined) pl.skew = Math.min(150, 26 * n);
  }
  fm.yc = yc;
  if (!pl.arr && V.t >= pl.t0) { pl.arr = true; if (pl.msg) { const F = FORM[pl.k]; bvBanner(V, pl.mis ? `⚠️ El ${corpsName(c)} entendió mal la orden «${F.n}» y se desvía` : `${F.ic} El ${corpsName(c)} recibe la orden «${F.n}»`, c.side, ''); if (pl.mis) { (b.log = b.log || []).push({k: 'panic', d: b.day, t: `Una orden mal transmitida desvía al ${corpsName(c)} de ${G.C[c.tag].name}.`}); if (b.log.length > 30) b.log.shift(); } } }
  if (pl.k === 'fenv' && pl.psiEnd === undefined) pl.psiEnd = fmEndPsi(c, fm, pl, ls);
  let lagMax = 0; ls.forEach((k, i) => { const [sx, sy] = fmSlot(c, fm, pl, ls, i); k._sx = sx; k._sy = sy; k._lag = Math.hypot(k.x - sx, k.y - sy); if (k._lag > lagMax && k.mode !== 'melee' && k.mode !== 'charge') lagMax = k._lag; });
  fm.lag = lagMax; fm.coh = clamp(1 - (lagMax - 9) / 46, 0.1, 1);
  const vb = Math.min(...ls.map(k => k.F.spd * (k.terr ? k.terr.slow : 1))) * 0.9;
  if (V.t < pl.t0) return;                                    // la orden aún no ha llegado
  if (V.t - pl.t0 > 120 && !pl.done && pl.k !== 'frea') pl.done = true;
  const foeNear = ls.reduce((m, k) => Math.min(m, k.foe && k.foe.role !== 'reserve' ? Math.hypot(k.foe.x - k.x, k.foe.y - k.y) : 1e9), 1e9);
  const stepTo = (T, sp) => { const dx = T[0] - fm.x, dy = T[1] - fm.y, d = Math.hypot(dx, dy); if (d < 6) return true; const s = Math.min(sp * dt, d); fm.x += dx / d * s; fm.y += dy / d * s; return false; };
  if (pl.k === 'fadv' || pl.k === 'fret' || pl.k === 'fech') {
    if (!pl.done) {
      const T = pl.pts[pl.i] || pl.pts[pl.pts.length - 1]; let sp = vb * fm.coh * (pl.k === 'fret' ? 0.8 : 1); if (pl.k !== 'fret' && foeNear < 125) sp *= 0.25;
      if (stepTo(T, sp)) { pl.i++; if (pl.i >= pl.pts.length) pl.done = true; }
      if (pl.k === 'fech') { const tg = foeNear < 150 ? 0 : (pl.skew || 0); pl.sk = (pl.sk || 0) + clamp(tg - (pl.sk || 0), -24 * dt, 34 * dt); }
    }
  } else if (pl.k === 'fchg') {
    if (pl.st < 2) {
      const T = pl.pts[pl.pts.length - 1]; let sp = vb * fm.coh * 1.15; if (foeNear < 135) sp *= 0.85; stepTo(T, sp);
      if (foeNear <= 118 && fm.coh >= 0.55) { pl.st = 2; pl.tc = V.t; }
    } else if (V.t - pl.tc > 16) pl.done = true;
  } else if (pl.k === 'fenv') {
    if (!pl.done) { if (pl.gx !== undefined && Math.abs(fm.x - pl.gx) > 3) fm.x += clamp(pl.gx - fm.x, -vb * 0.45 * fm.coh * dt, vb * 0.45 * fm.coh * dt); const rmax = Math.max(60, (n - 1) * (ls.length > 1 ? Math.abs(ls[n - 1].hy - ls[0].hy) / (n - 1) : 40)); pl.psi = Math.min(pl.psiEnd, (pl.psi || 0) + vb * 0.95 / rmax * fm.coh * dt); if (pl.psi >= pl.psiEnd - 1e-3) pl.done = true; }
  } else if (pl.k === 'fref') {
    const g = fmDefaultG(V, b, c, ls); fm.x = g.x; fm.y = g.y;
  } else if (pl.k === 'frea') {
    const g = fmDefaultG(V, b, c, ls); stepTo([g.x, g.y], vb * 1.3); ls.forEach(k => { k.fat = Math.max(0, (k.fat || 0) - 0.01 * dt); });
    if ((lagMax < 8 && V.t - pl.t0 > 2) || V.t - pl.t0 > 25) { delete b.cplan[c.id]; delete V.fm[c.id]; ls.forEach(k => { k.skey = ''; }); }
  }
}
// ---- orden de movimiento de un regimiento dentro de su formación ----
const _bvPlanStepL = bvPlanStep;
bvPlanStep = function (V, b, blk, dt, all, home) {
  const c = blk.corps;
  if (c && blk.role === 'line' && !blk.d.plan && b.cplan && b.cplan[c.id] && V.fm && V.fm[c.id] && blk._sx !== undefined && !V.over && !b.prep) {
    const pl = b.cplan[c.id], dir = blk.side === 'A' ? 1 : -1, foe = blk.foe, fd = foe && foe.role !== 'reserve' ? Math.hypot(foe.x - blk.x, foe.y - blk.y) : 1e9;
    let tx = blk._sx, ty = blk._sy, mode = 'advance', k = 1.05; const lag = blk._lag || 0;
    if (pl.k === 'fchg' && pl.st === 2 && foe && foe.role !== 'reserve') { tx = foe.x - dir * ((blk.dep + foe.dep) / 2 + 7); ty = foe.y; return {mode: 'charge', tx, ty, k: 3.2, path: [[blk.x, blk.y], [tx, ty]]}; }
    const eng = foe && foe.role !== 'reserve' && Math.abs(foe.x - blk.x) < (blk.dep + foe.dep) / 2 + 10 && Math.abs(foe.y - blk.y) < (blk.wid + foe.wid) / 2 * 0.95;
    if (eng && pl.k !== 'fret' && pl.k !== 'frea') return {mode: 'melee', tx: blk.x, ty: blk.y, k: 0, path: null};
    const moving = !pl.done && pl.k !== 'fref';
    if (moving) { k = lag > 14 ? 1.7 : lag > 6 ? 1.3 : 1.05; mode = pl.k === 'fret' ? 'retreat' : 'advance'; if (pl.k !== 'fret' && pl.k !== 'fenv' && fd < 125) { mode = 'fire'; k = 0.7; } }
    else { mode = fd < 175 ? 'fire' : 'hold'; k = lag > 10 ? 1.4 : 0.5; }
    const out = {mode, tx, ty, k, path: null};
    if (pl.k === 'fenv' || (pl.k === 'fref' && false)) out.hd = (dir > 0 ? 0 : Math.PI) + fmAngle(pl, dir);
    return out;
  }
  return _bvPlanStepL(V, b, blk, dt, all, home);
};
/* ---- integridad de la línea: huecos y flancos abiertos ---- */
function fmIntegrity(V, b, all, dt) {
  V._fi = (V._fi || 0) + dt; if (V._fi < 0.5) return; V._fi = 0; V.coh = V.coh || {}; b.coh = b.coh || {A: 1, B: 1};
  ['A', 'B'].forEach(s => {
    const ln = all.filter(k => k.side === s && k.role === 'line' && k.mode !== 'rout' && k.type !== 'art' && !k.garr).sort((p, q) => p.y - q.y), foes = all.filter(k => k.side !== s && k.role !== 'reserve' && k.mode !== 'rout' && k.type !== 'art');
    let exp = 0;
    ln.forEach((k, i) => {
      let up = null, dn = null; for (let j = i - 1; j >= 0; j--) if (Math.abs(ln[j].x - k.x) < 95) { up = ln[j]; break; } for (let j = i + 1; j < ln.length; j++) if (Math.abs(ln[j].x - k.x) < 95) { dn = ln[j]; break; }
      const gU = up ? (k.y - up.y) - (k.wid + up.wid) / 2 : 99, gD = dn ? (dn.y - k.y) - (k.wid + dn.wid) / 2 : 99, lim = fmInt(k) * 1.6;
      k.openU = gU > lim; k.openD = gD > lim; let ex = 0, near = 1e9;
      foes.forEach(e => {
        const dx = Math.abs(e.x - k.x); if (dx > 175) return;
        if (k.openU && ((up && e.y < k.y - k.wid * 0.5 && e.y > up.y) || (!up && e.y < k.y - k.wid * 0.45 && k.y - e.y < 200))) { ex = 1; near = Math.min(near, Math.hypot(e.x - k.x, e.y - k.y)); }
        if (k.openD && ((dn && e.y > k.y + k.wid * 0.5 && e.y < dn.y) || (!dn && e.y > k.y + k.wid * 0.45 && e.y - k.y < 200))) { ex = 1; near = Math.min(near, Math.hypot(e.x - k.x, e.y - k.y)); }
      });
      k.expo = ex; k.expoNear = near; if (ex) exp++;
    });
    V.coh[s] = ln.length ? clamp(1 - 0.85 * exp / ln.length, 0.2, 1) : 1; b.coh[s] = V.coh[s];
  });
}
// la línea rota pierde moral y recibe el flanco
const _tacMoraleXL = tacMoraleX;
tacMoraleX = function (V, b, all, step) {
  _tacMoraleXL(V, b, all, step);
  if (V.over || b.prep) return;
  all.forEach(k => { if (!k.expo || k.mm === undefined || k.mode === 'rout') return; k.mm = Math.max(0, k.mm - 0.012 * step); if (k.expoNear < 95) k.flanked = V.t; });
};
/* ---- efecto de la cohesión en el cálculo diario ---- */
const _sideStatsL = sideStats;
sideStats = function (b, ids, isAttacker) {
  const r = _sideStatsL(b, ids, isAttacker), key = ids === b.A ? 'A' : ids === b.B ? 'B' : null, co = key && b.coh ? b.coh[key] : undefined;
  if (co !== undefined && co < 1) { r.F *= 0.93 + 0.07 * co; r.T *= 0.88 + 0.12 * co; r.cas *= 1 + 0.3 * (1 - co); }
  if (key && b.cplan) { let env = 0, ref = 0; Object.keys(b.cplan).forEach(id => { const pl = b.cplan[id]; if (!id.startsWith || pl.side === undefined) return; const a = armyById(+id.split('-')[0]); if (!a || !ids.includes(a.id)) return; if (pl.k === 'fenv' && pl.done) env++; if (pl.k === 'fref') ref++; }); r.F *= 1 + Math.min(0.09, 0.03 * env); r.T *= 1 + Math.min(0.06, 0.02 * ref); }
  return r;
};
/* ---- paso por fotograma, IA y órdenes ---- */
const _bvGroundL = bvGround;
bvGround = function (V, b, all, dt) {
  _bvGroundL(V, b, all, dt);
  V.fm = V.fm || {};
  if (!V.replay && !V.over && !b.prep && b.cplan) {
    (V.corps || []).forEach(c => { const pl = b.cplan[c.id]; if (!pl) { delete V.fm[c.id]; return; } fmUpdate(V, b, c, pl, dt, all); });
    Object.keys(b.cplan).forEach(id => { if (!(V.corps || []).some(c => c.id === id)) { delete b.cplan[id]; delete V.fm[id]; } });
  }
  fmIntegrity(V, b, all, dt);
};
function fmAi(V, b, all, dt) {
  V._fai = (V._fai || 0) + dt; if (V._fai < 6) return; V._fai = 0; if (V.over || b.prep) return;
  const ps = playerSide(b); b.cplan = b.cplan || {};
  ['A', 'B'].forEach(s => {
    if (s === ps) return;
    const cs = (V.corps || []).filter(c => c.side === s && fmLs(c).length >= 2); if (!cs.length) return;
    const st = bvStrat(b, s), att = b.att === s, free = cs.filter(c => !b.cplan[c.id]), foes = all.filter(k => k.side !== s && k.role === 'line' && k.mode !== 'rout');
    if (!free.length || !foes.length) return;
    const top = Math.min(...foes.map(k => k.y)), bot = Math.max(...foes.map(k => k.y)), ex = foes.reduce((n, k) => n + k.x, 0) / foes.length, has = k => cs.some(c => b.cplan[c.id] && b.cplan[c.id].k === k);
    const ends = free.slice().sort((p, q) => p.yc - q.yc), dirSide = Math.random() < 0.5 ? 'top' : 'bottom';
    if (st === 'flank' && !has('fenv') && cs.length >= 2) { const c = dirSide === 'top' ? ends[0] : ends[ends.length - 1]; bvFormSet(V, b, c, 'fenv', [[ex, dirSide === 'top' ? top - 55 : bot + 55]]); }
    else if (att && st === 'frontal' && free.length >= 3 && !has('fech') && Math.random() < 0.18) { const c = dirSide === 'top' ? ends[0] : ends[ends.length - 1]; bvFormSet(V, b, c, 'fech', [[ex, dirSide === 'top' ? top : bot]]); }
    else if (!att && cs.length >= 2 && !has('fref') && Math.random() < 0.2) { const c = dirSide === 'top' ? ends[0] : ends[ends.length - 1]; bvFormSet(V, b, c, 'fref', [[ex, dirSide === 'top' ? 0 : BV_H]]); }
  });
}
const _tacThinkL = tacThink;
tacThink = function (V, b, all, dt) { _tacThinkL(V, b, all, dt); fmAi(V, b, all, dt); };
// las órdenes de cuerpo entero se traducen en maniobras de línea
const _tacSetPlanL = tacSetPlan;
tacSetPlan = function (V, plan) {
  const b = G.battles.find(x => x.id === UI.battle);
  if (V.sel && b) {
    const whole = V.selCorps && V.sel.corps && V.sel.corps.id === V.selCorps, c = V.sel.corps;
    if (FORM[plan.k] && c) { const fr = fmFriction(V, b, c); bvFormSet(V, b, c, plan.k, plan.pts || [], false, fr.delay, fr.mis); return; }
    if (whole && FORM_MAP[plan.k] && c) { const pts = plan.k === 'flank' ? [plan.pts[plan.pts.length - 1]] : plan.k === 'retreat' ? [plan.pts[0]] : plan.pts; const fr = fmFriction(V, b, c); if (bvFormSet(V, b, c, FORM_MAP[plan.k], pts, false, fr.delay, fr.mis)) return; }
    if (!FORM[plan.k] && c && b.cplan && b.cplan[c.id] && !whole) { /* la orden individual saca al regimiento de la formación */ }
  }
  _tacSetPlanL(V, plan);
};
const _ACTtacplanL = ACT.tacplan;
ACT.tacplan = d => {
  const V = R.bviz, b = G.battles.find(x => x.id === UI.battle);
  if (d.k === 'frea') { if (!V || !V.sel || !b || b.ended || V.replay || V.sel.side !== playerSide(b) || !V.sel.corps) return; const fr = fmFriction(V, b, V.sel.corps); bvFormSet(V, b, V.sel.corps, 'frea', [], false, fr.delay, false); renderBattlePanel(); return; }
  if (d.k === 'clear' && V && V.sel && V.sel.corps && b && b.cplan && b.cplan[V.sel.corps.id]) { delete b.cplan[V.sel.corps.id]; delete V.fm[V.sel.corps.id]; V.sel.corps.blks.forEach(k => { k.skey = ''; }); }
  _ACTtacplanL(d);
};
const _ACTtacstayL = ACT.tacstay;
ACT.tacstay = () => { const V = R.bviz, b = G.battles.find(x => x.id === UI.battle); if (V && V.sel && V.sel.corps && b && b.cplan && b.cplan[V.sel.corps.id]) { delete b.cplan[V.sel.corps.id]; delete V.fm[V.sel.corps.id]; } _ACTtacstayL(); };
// botones de maniobra en el panel
const _tacStayBtnL = tacStayBtn;
tacStayBtn = function (V, sel, ac) {
  let h = _tacStayBtnL(V, sel, ac); if (!sel && !ac) return h;
  const cur = V.selCorps && ac ? ac : sel && sel.corps ? sel.corps : null, pl = cur && R.bvB && R.bvB.cplan ? R.bvB.cplan[cur.id] : null;
  h += '<div class="mform"><small>Maniobras de línea (actúan sobre el cuerpo entero):</small>' + Object.keys(FORM).map(k => `<button data-act="tacplan" data-k="${k}" class="${V.draw && V.draw.k === k || (pl && pl.k === k) ? 'on' : ''}" ${sel ? '' : 'disabled'} data-tip="<b>${FORM[k].n}</b><br>${FORM[k].hint}"><span>${FORM[k].ic}</span>${FORM[k].n}</button>`).join('') + '</div>';
  return h;
};
/* ---- dibujo: conectores de la línea, huecos, flancos abiertos y vista previa de la maniobra ---- */
const _bvCorpsFlagsL = bvCorpsFlags;
bvCorpsFlags = function (g, V, b) {
  _bvCorpsFlagsL(g, V, b); R.bvB = b;
  const ps = playerSide(b), all = [...V.blocks.values()];
  ['A', 'B'].forEach(s => {
    const ln = all.filter(k => k.side === s && k.role === 'line' && k.mode !== 'rout' && k.type !== 'art' && !k.garr && !k.d.out).sort((p, q) => p.y - q.y), own = s === ps;
    for (let i = 1; i < ln.length; i++) { const a = ln[i - 1], k = ln[i]; if (Math.abs(a.x - k.x) > 95) continue; const gap = (k.y - a.y) - (k.wid + a.wid) / 2, bad = gap > fmInt(k) * 1.6;
      g.strokeStyle = bad ? 'rgba(255,90,70,.75)' : own ? 'rgba(150,235,150,.4)' : 'rgba(200,215,255,.2)'; g.lineWidth = bad ? 1.6 : 1.1; g.setLineDash(bad ? [4, 4] : []); g.beginPath(); g.moveTo(a.x, a.y + a.wid / 2 - 2); g.lineTo(k.x, k.y - k.wid / 2 + 2); g.stroke(); }
    g.setLineDash([]);
    ln.forEach(k => { if (!k.expo) return; g.strokeStyle = 'rgba(255,80,60,.85)'; g.lineWidth = 2; g.beginPath(); if (k.openU) { g.moveTo(k.x - k.dep / 2, k.y - k.wid / 2 - 2); g.lineTo(k.x + k.dep / 2, k.y - k.wid / 2 - 2); } if (k.openD) { g.moveTo(k.x - k.dep / 2, k.y + k.wid / 2 + 2); g.lineTo(k.x + k.dep / 2, k.y + k.wid / 2 + 2); } g.stroke(); });
  });
  (V.corps || []).forEach(c => {
    const pl = b.cplan && b.cplan[c.id], fm = V.fm && V.fm[c.id]; if (!pl || !fm || c.side !== ps) return; const F = FORM[pl.k], ls = fmLs(c); if (!F || !ls.length) return;
    const sel = V.selCorps === c.id || (V.sel && V.sel.corps && V.sel.corps.id === c.id);
    ls.forEach((k, i) => { if (k._sx === undefined) return; g.strokeStyle = F.col; g.globalAlpha = sel ? 0.55 : 0.28; g.lineWidth = 1; g.setLineDash([3, 3]); g.strokeRect(k._sx - k.dep / 2, k._sy - k.wid / 2, k.dep, k.wid); g.setLineDash([]); g.globalAlpha = 1; });
    if (V.t < pl.t0) { g.font = '15px sans-serif'; g.textAlign = 'center'; g.fillText('✉️', fm.x, fm.y - 8); }
    const T = pl.pts[Math.min(pl.i, pl.pts.length - 1)]; if (T && !pl.done) { g.strokeStyle = F.col; g.fillStyle = F.col; g.globalAlpha = 0.7; g.lineWidth = 1.6; g.setLineDash([7, 5]); g.beginPath(); g.moveTo(fm.x, fm.y); g.lineTo(T[0], T[1]); g.stroke(); g.setLineDash([]); g.beginPath(); g.arc(T[0], T[1], 6, 0, 6.3); g.fill(); g.globalAlpha = 1; g.font = '13px sans-serif'; g.textAlign = 'center'; g.fillText(F.ic, T[0], T[1] - 10); }
    if (pl.k === 'fenv' && !pl.done && ls.length > 1) { const out = pl.sweep === 'top' ? 0 : ls.length - 1, sv = pl.psi; g.strokeStyle = F.col; g.globalAlpha = 0.55; g.setLineDash([5, 4]); g.beginPath(); for (let p = sv; p <= pl.psiEnd + 0.001; p += 0.06) { pl.psi = p; const [x, y] = fmSlot(c, fm, pl, ls, out); p === sv ? g.moveTo(x, y) : g.lineTo(x, y); } g.stroke(); g.setLineDash([]); g.globalAlpha = 1; pl.psi = sv; }
    if (sel) { g.fillStyle = 'rgba(8,12,16,.8)'; const txt = `${F.ic} ${F.n} · cohesión ${Math.round((fm.coh === undefined ? 1 : fm.coh) * 100)}%${pl.done ? ' · completada' : ''}`; g.font = 'bold 10px sans-serif'; const w = g.measureText(txt).width + 10; g.fillRect(fm.x - w / 2, fm.y - 26, w, 14); g.fillStyle = '#ffe28a'; g.textAlign = 'center'; g.fillText(txt, fm.x, fm.y - 15); }
  });
};
// referencia de línea del bando: media de los regimientos de infantería sin órdenes propias
const _bvCorpsUpdateL = bvCorpsUpdate;
bvCorpsUpdate = function (V) {
  _bvCorpsUpdateL(V); V.sideCx = {}; const cp = (R.bvB && R.bvB.cplan) || {};
  ['A', 'B'].forEach(s => { const ls = [...V.blocks.values()].filter(k => k.side === s && k.role === 'line' && k.mode !== 'rout' && !k.d.plan && !k.d.stay && !k.garr && k.type === 'inf' && !(k.corps && cp[k.corps.id])); if (ls.length > 1) V.sideCx[s] = ls.reduce((n, k) => n + k.x, 0) / ls.length; });
};
