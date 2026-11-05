/* ===== CAMPO 3: terreno jugable — barrancos, alturas para la artillería, puentes de pontones, sectores y línea general ===== */
const tacRavX = (tf, y) => tf.ravine.x + Math.sin(y / 70 + tf.ravine.ph) * tf.ravine.amp;
/* ---- rodear barrancos: ir al paso natural más cercano ---- */
const _tacWaypointC = tacWaypoint;
tacWaypoint = function (tf, blk, tx, ty) {
  if (tf && tf.v2 && tf.ravine) {
    const x = blk.x, y = blk.y; let hit = null;
    for (let i = 1; i <= 14; i++) { const px = x + (tx - x) * i / 14, py = y + (ty - y) * i / 14, t = bvTerrAt(tf, px, py, blk.side); if (t.water) { hit = t.ravine ? [px, py] : null; break; } }
    if (hit) {
      const r = tf.ravine, sign = x < tacRavX(tf, y) ? 1 : -1; let best = null, bc = 1e9;
      r.fords.forEach(f => { const c = Math.abs(y - f.y) + Math.abs(f.y - ty) + Math.abs(x - tacRavX(tf, f.y)) * 0.3; if (c < bc) { bc = c; best = f; } });
      const rx = tacRavX(tf, best.y), ax = rx - sign * (r.w / 2 + 22), bx = rx + sign * (r.w / 2 + 22);
      if (Math.abs(x - ax) < 30 && Math.abs(y - best.y) < best.w / 2 - 4) return [bx, best.y]; return [ax, best.y];
    }
  }
  return _tacWaypointC(tf, blk, tx, ty);
};
/* ---- fondo: el barranco ---- */
const _bvBuildBgC = bvBuildBg;
bvBuildBg = function (V, b) {
  const cv = _bvBuildBgC(V, b), tf = battleTerrain(b); if (!tf.ravine) return cv;
  const S = cv.width / BV_W, g = cv.getContext('2d'), r = tf.ravine, Hh = BV_H; g.save(); g.setTransform(S, 0, 0, S, 0, 0); g.lineCap = 'round'; g.lineJoin = 'round';
  const stroke = (w, col) => { g.strokeStyle = col; g.lineWidth = w; g.beginPath(); for (let y = -12; y <= Hh + 12; y += 6) { const x = tacRavX(tf, y); y === -12 ? g.moveTo(x, y) : g.lineTo(x, y); } g.stroke(); };
  stroke(r.w + 26, 'rgba(30,24,16,.25)'); stroke(r.w + 14, '#7a7064'); stroke(r.w + 6, '#4d453c'); stroke(r.w, '#15110d'); stroke(r.w * 0.45, '#050403');
  for (let y = 0; y < Hh; y += 9) { const x = tacRavX(tf, y), h = hash2(Math.round(y), 91, b.prov); [-1, 1].forEach(s => { g.fillStyle = h < 0.5 ? 'rgba(160,150,132,.55)' : 'rgba(40,34,28,.6)'; g.beginPath(); g.ellipse(x + s * (r.w / 2 + 4 + h * 5), y, 3 + h * 3, 2 + h * 2, h * 3, 0, 6.3); g.fill(); }); }
  r.fords.forEach(f => { const x = tacRavX(tf, f.y); g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(x - r.w / 2 - 12 + 2, f.y - f.w / 2 + 3, r.w + 24, f.w); g.fillStyle = '#7d7466'; g.fillRect(x - r.w / 2 - 12, f.y - f.w / 2, r.w + 24, f.w); g.strokeStyle = '#5a5248'; g.lineWidth = 1; for (let k = -r.w / 2 - 8; k < r.w / 2 + 8; k += 6) { g.beginPath(); g.moveTo(x + k, f.y - f.w / 2); g.lineTo(x + k, f.y + f.w / 2); g.stroke(); } });
  g.restore(); return cv;
};
/* ---- puentes de pontones ---- */
FORT_KINDS.pontoon = {n: 'Puente de pontones', ic: '🌉', w: 44, h: 38, cost: {wood: 2, mat: 2}, hp: 100, def: 0, need: 0, desc: 'Los ingenieros tienden un puente de barcas sobre el río. Tarda unos segundos en estar listo (menos con ingenieros) y lo pueden usar los dos bandos.'};
function tacPontoon(b, side, x, y) {
  const V = R.bviz, tf = battleTerrain(b); if (!tf.river) return {ok: false, msg: 'No hay un río que cruzar en este campo.'};
  const rx = tacRiverX(tf, y); if (Math.abs(x - rx) > tf.river.w / 2 + 70) return {ok: false, msg: 'Haz clic sobre el río (o cerca) donde quieras tender el puente.'};
  b.pont = b.pont || []; if (b.pont.filter(p => p.side === side).length >= 2) return {ok: false, msg: 'Solo puedes tender 2 puentes de pontones.'};
  if (tf.river.fords.some(f => Math.abs(f.y - y) < 46) || b.pont.some(p => Math.abs(p.y - y) < 46)) return {ok: false, msg: 'Ya hay un paso demasiado cerca.'};
  const K = FORT_KINDS.pontoon, ids = sideIds(b, side); if (!tacCan(ids, K.cost)) return {ok: false, msg: `Faltan reservas: ${fmtCost(K.cost)} por división.`};
  spendSideRes(ids, K.cost); const eng = ids.map(armyById).filter(Boolean).reduce((n, a) => n + a.divs.filter(d => DIVS[d.t] && DIVS[d.t].fort).length, 0);
  const p = {id: 'pt' + (b.pont.length + 1) + side, side, y: clamp(y, 70, BV_H - 50), left: 26 / (1 + 0.5 * eng), total: 26 / (1 + 0.5 * eng)}; b.pont.push(p);
  if (V) bvBanner(V, `🌉 ${G.C[side === 'A' ? b.A0 : b.B0].name} comienza a tender un puente de pontones`, side, '');
  return {ok: true, f: {id: p.id}};
}
const _tacBuildFortC = tacBuildFort;
tacBuildFort = function (b, side, kind, x, y) { return kind === 'pontoon' ? tacPontoon(b, side, x, y) : _tacBuildFortC(b, side, kind, x, y); };
function pontStep(V, b, dt) {
  if (!b.pont || b.prep || V.replay) return; const tf = V.tf || battleTerrain(b);
  b.pont.forEach(p => {
    if (p.ready) return; p.left -= dt; if (p.left > 0) return; p.ready = true; if (tf.river) tf.river.fords.push({y: p.y, w: 34, br: true, pont: true, side: p.side});
    bvBanner(V, `🌉 Puente de pontones listo (${G.C[p.side === 'A' ? b.A0 : b.B0].name})`, p.side, ''); (b.log = b.log || []).push({k: 'flank', d: b.day, t: `${G.C[p.side === 'A' ? b.A0 : b.B0].name} tiende un puente de pontones sobre el río.`}); if (b.log.length > 30) b.log.shift();
  });
}
const _bvFxUnderC = bvFxUnder;
bvFxUnder = function (g, V, b) {
  _bvFxUnderC(g, V, b); const tf = V.tf; if (!tf || !tf.river) return;
  (b.pont || []).forEach(p => {
    const x = tacRiverX(tf, p.y), w = tf.river.w + 18, k = p.ready ? 1 : 1 - clamp(p.left / p.total, 0, 1);
    for (let i = 0; i < 6 * k; i++) { const bx = x - w / 2 + (i + 0.5) / 6 * w; g.fillStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.ellipse(bx + 1, p.y + 3, 6, 3.4, 0, 0, 6.3); g.fill(); g.fillStyle = '#6b4a2a'; g.beginPath(); g.ellipse(bx, p.y, 6, 3.4, 0, 0, 6.3); g.fill(); }
    if (k > 0.2) { g.fillStyle = '#a8825a'; g.fillRect(x - w / 2, p.y - 6, w * k, 12); g.strokeStyle = '#6b4a2a'; g.lineWidth = 0.8; for (let q = 0; q < w * k; q += 5) { g.beginPath(); g.moveTo(x - w / 2 + q, p.y - 6); g.lineTo(x - w / 2 + q, p.y + 6); g.stroke(); } }
    if (!p.ready) { g.fillStyle = 'rgba(8,12,16,.8)'; g.fillRect(x - 22, p.y - 22, 44, 8); g.fillStyle = '#ffd37a'; g.fillRect(x - 21, p.y - 21, 42 * k, 6); }
  });
};
// panel de obras: botón del puente
const _tacObrasHtmlC = tacObrasHtml;
tacObrasHtml = function (b, V) {
  const ps = playerSide(b), h = _tacObrasHtmlC(b, V), tf = battleTerrain(b); if (!ps || !tf.river) return h;
  const n = (b.pont || []).filter(p => p.side === ps).length, K = FORT_KINDS.pontoon, ok = tacCan(sideIds(b, ps), K.cost);
  return (h || '') + `<div class="prep-b"><button data-act="tacfort" data-k="pontoon" class="${V.tool && V.tool.k === 'pontoon' ? 'on' : ''} ${ok ? '' : 'nofunds'}" data-tip="<b>${K.n}</b><br>${K.desc}<br>Coste ${fmtCost(K.cost)} por división. Haz clic sobre el río. (${n}/2)">🌉 Puente de pontones</button></div>`;
};
/* ---- alturas: fuego plongeante y vista sobre el arbolado ---- */
const _tacShellHitC = tacShellHit;
tacShellHit = function (V, b, p, all) {
  _tacShellHitC(V, b, p, all);
  if (p.hi) { const v = all.find(x => x.id === p.vt); if (v && v.mode !== 'rout') { v.d.s = Math.max(0, v.d.s - 0.0025); v.d.o = Math.max(0, v.d.o - DIVS[v.d.t].org * 0.008); } }
};
const _tacLosC = tacLos;
tacLos = function (tf, x1, y1, x2, y2) {
  if (tf && tf.v2 && tf.hills.some(h => inEll(x1, y1, h)) && !tf.hills.some(h => inEll(x2, y2, h))) {         // observador en una altura: ve por encima de bosques y aldeas
    const L = Math.hypot(x2 - x1, y2 - y1), n = Math.max(4, Math.round(L / 28));
    for (let i = 1; i < n; i++) { const t = i / n, x = x1 + (x2 - x1) * t, y = y1 + (y2 - y1) * t; if (tf.cliffs.some(c => inEll(x, y, c) && !inEll(x2, y2, c))) return false; }
    return true;
  }
  return _tacLosC(tf, x1, y1, x2, y2);
};
/* ---- sectores de frente y línea general ---- */
FORM.fsec = {n: 'Sector de frente', ic: '📍', col: '#7fd1ff', hint: 'Haz 2 clics: los extremos del frente que debe cubrir ESTE cuerpo. Sus regimientos se reparten por el sector, lo ocupan y lo defienden.'};
PLANS.fsec = {n: FORM.fsec.n, ic: FORM.fsec.ic, col: FORM.fsec.col, hint: FORM.fsec.hint, multi: 2};
PLANS.fgen = {n: 'Línea general', ic: '🧭', col: '#7fd1ff', hint: 'Haz 2 clics: los extremos de la línea general. Todos tus cuerpos se reparten por ella, cada uno con un sector proporcional a su tamaño.', multi: 2};
FORM_TIP.fsec = 'Reparte el cuerpo por un sector que tú marcas.';
const _bvFormSetC = bvFormSet;
bvFormSet = function (V, b, c, kind, pts, quiet, delay, mis) {
  if (kind === 'fsec' && (!pts || pts.length < 2)) { const q = pts && pts[0] ? pts[0] : [BV_W / 2, BV_H / 2]; pts = [[q[0], clamp(q[1] - 70, 40, BV_H - 40)], [q[0], clamp(q[1] + 70, 40, BV_H - 40)]]; }
  if (kind === 'fsec' && pts && pts.length >= 2) { pts = pts.slice(0, 2).sort((p, q) => p[1] - q[1]).map(p => [p[0], p[1]]); }
  const ok = _bvFormSetC(V, b, c, kind, pts, quiet, delay, mis);
  if (ok && kind === 'fsec' && b.prep) {                  // en la preparación se colocan ya en su sector
    const ls = fmLs(c), [p1, p2] = pts; ls.forEach((k, i) => { const t = (i + 0.5) / ls.length; let x = p1[0] + (p2[0] - p1[0]) * t, y = p1[1] + (p2[1] - p1[1]) * t; k.d.cust = {abs: true, x, y}; });
  }
  return ok;
};
function armyLine(V, b, pts) {
  const ps = playerSide(b), cs = (V.corps || []).filter(c => c.side === ps && fmLs(c).length >= 1).sort((p, q) => p.yc - q.yc); if (!cs.length || !pts || pts.length < 2) return;
  const [p1, p2] = pts.slice(0, 2).sort((p, q) => p[1] - q[1]), tot = cs.reduce((n, c) => n + fmLs(c).length, 0); let acc = 0;
  cs.forEach(c => { const n = fmLs(c).length, t0 = acc / tot, t1 = (acc + n) / tot; acc += n; const a = [p1[0] + (p2[0] - p1[0]) * t0, p1[1] + (p2[1] - p1[1]) * t0], e = [p1[0] + (p2[0] - p1[0]) * t1, p1[1] + (p2[1] - p1[1]) * t1], fr = b.prep ? {delay: 0, mis: false} : fmFriction(V, b, c); bvFormSet(V, b, c, 'fsec', [a, e], true, fr.delay, false); });
  bvBanner(V, '🧭 Línea general: los cuerpos ocupan su sector', ps, '');
}
const _tacSetPlanC = tacSetPlan;
tacSetPlan = function (V, plan) { if (plan.k === 'fgen') { const b = G.battles.find(x => x.id === UI.battle); if (b) armyLine(V, b, plan.pts); return; } _tacSetPlanC(V, plan); };
ACT.tacgen = () => { const V = R.bviz, b = G.battles.find(x => x.id === UI.battle); if (!V || !b || b.ended || V.replay) return; if (!V.sel) { const ps = playerSide(b), k = [...V.blocks.values()].find(x => x.side === ps && x.role === 'line'); if (k) V.sel = k; } V.draw = V.draw && V.draw.k === 'fgen' ? null : {k: 'fgen', pts: []}; if (V.draw) toast('🧭', PLANS.fgen.hint); renderBattlePanel(); };
const _tacStayBtnC = tacStayBtn;
tacStayBtn = function (V, sel, ac) {
  let h = _tacStayBtnC(V, sel, ac); const b = R.bvB, ps = b && playerSide(b); if (!b || !ps) return h;
  return h + `<div class="mform"><button data-act="tacgen" class="${V.draw && V.draw.k === 'fgen' ? 'on' : ''}" data-tip="<b>Línea general</b><br>${PLANS.fgen.hint}"><span>🧭</span>Línea general</button></div>`;
};
// el puente y la IA
const _bvGroundC = bvGround;
bvGround = function (V, b, all, dt) { _bvGroundC(V, b, all, dt); pontStep(V, b, dt); };
const _fmAiC = fmAi;
fmAi = function (V, b, all, dt) {
  _fmAiC(V, b, all, dt); const tf = V.tf; if (!tf || !tf.river || V.over || b.prep || b.day < 1) return; V._pai = (V._pai || 0) + dt; if (V._pai < 10) return; V._pai = 0;
  const ps = playerSide(b); ['A', 'B'].forEach(s => { if (s === ps || b.att !== s) return; const mine = (b.pont || []).filter(p => p.side === s).length + tf.river.fords.length; if (mine >= 3 || Math.random() > 0.3) return;
    const foes = all.filter(k => k.side !== s && k.role === 'line'); if (!foes.length) return; const y = foes.reduce((n, k) => n + k.y, 0) / foes.length + (Math.random() - 0.5) * 160; tacPontoon(b, s, tacRiverX(tf, y), y); });
};
// vista previa del sector mientras se dibuja
const _bvCorpsFlagsC = bvCorpsFlags;
bvCorpsFlags = function (g, V, b) {
  _bvCorpsFlagsC(g, V, b); const ps = playerSide(b); if (!ps) return;
  (V.corps || []).forEach(c => { const pl = b.cplan && b.cplan[c.id]; if (!pl || pl.k !== 'fsec' || c.side !== ps) return; const [p1, p2] = pl.pts; g.strokeStyle = FORM.fsec.col; g.lineWidth = 2; g.setLineDash([9, 5]); g.globalAlpha = (V.selCorps === c.id) ? 0.9 : 0.4; g.beginPath(); g.moveTo(p1[0], p1[1]); g.lineTo(p2[0], p2[1]); g.stroke(); g.setLineDash([]); g.globalAlpha = 1; g.fillStyle = FORM.fsec.col; [p1, p2].forEach(p => { g.beginPath(); g.arc(p[0], p[1], 4, 0, 6.3); g.fill(); }); });
};
