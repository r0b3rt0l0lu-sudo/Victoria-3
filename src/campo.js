/* ===== CAMPO DE BATALLA ESTILO MAPA DE CAMPAÑA =====
   · Cada DIVISIÓN real se parte en 3 REGIMIENTOS (cuadrados divididos en 4; la caballería, con triángulos; la artillería, con cañones pequeños).
   · Los regimientos se agrupan en CUERPOS de 5 (≈ 15.000 hombres). Cada cuerpo tiene su propia estrategia y avanza en LÍNEA.
   · No hay cuerpos de artillería: los cañones de cada división de artillería (100 piezas) se reparten por igual entre los cuerpos del ejército y,
     en cada cuerpo, puedes hacer que ACOMPAÑEN a los regimientos o agruparlos en una BATERÍA donde quieras.
   · Cada regimiento puede dejarse en RESERVA y comprometerse por separado.
   Los objetos «regimiento» reparten la fuerza y la organización de su división real, así que todo lo demás (planes, moral, fuertes, cercos) sigue
   funcionando sobre cada regimiento. */
const REG_N = 3, CORPS_REGS = 5;
function mkReg(d, i, nk) {
  const rd = {t: d.t, i, nk, dev: 0, devO: 0, out: false, tr: d.tr, lv: d.lv};
  Object.defineProperty(rd, 'par', {value: d});
  Object.defineProperty(rd, 's', {get() { return clamp(d.s + this.dev, 0, 1); }, set(v) { const cur = clamp(d.s + this.dev, 0, 1), dl = v - cur; d.s = clamp(d.s + dl / nk, 0, 1); this.dev += dl * (nk - 1) / nk; }});
  Object.defineProperty(rd, 'o', {get() { const mx = DIVS[d.t].org; return clamp(d.o + this.devO, 0, mx); }, set(v) { const mx = DIVS[d.t].org, cur = clamp(d.o + this.devO, 0, mx), dl = v - cur; d.o = clamp(d.o + dl / nk, 0, mx); this.devO += dl * (nk - 1) / nk; }});
  return rd;
}
function regsOf(d, nk) {
  nk = nk || (dKind(d) === 'art' ? 1 : REG_N); if (d.rg && d.rg.length === nk) return d.rg;
  const old = d.rg, arr = []; for (let i = 0; i < nk; i++) { const r = mkReg(d, i, nk); if (old && old[i] && old.length === nk) r.out = old[i].out; arr.push(r); }
  Object.defineProperty(d, 'rg', {value: arr, enumerable: false, writable: true, configurable: true}); if (d.rs) arr.forEach((r, i) => { r.out = !!d.rs[i]; }); return arr;
}
// cuerpos de un ejército: bloques de 5 regimientos; los cañones se reparten por igual entre los cuerpos
function corpsOfArmy(a) {
  const inf = []; a.divs.forEach(d => { if (dKind(d) !== 'art') regsOf(d).forEach(r => inf.push(r)); });
  const nC = Math.max(1, Math.ceil(inf.length / CORPS_REGS)), cs = []; for (let k = 0; k < nC; k++) cs.push({id: a.id + '-' + k, a, idx: k, n: nC, regs: inf.slice(k * CORPS_REGS, k * CORPS_REGS + CORPS_REGS), arts: []});
  a.divs.forEach(d => { if (dKind(d) === 'art') regsOf(d, nC).forEach((r, i) => cs[i].arts.push(r)); }); return cs;
}
const corpsName = c => `${c.idx + 1}.º Cuerpo`;
const corpsMen = c => Math.round(c.regs.reduce((n, r) => n + r.s * MEN_PER_DIV / REG_N, 0));
const corpsGuns = c => Math.round(c.arts.reduce((n, r) => n + r.s * 100 / c.n, 0));
function regsOfSide(b, side) { const out = []; sideIds(b, side).map(armyById).filter(Boolean).forEach(a => corpsOfArmy(a).forEach(c => { c.regs.forEach(r => out.push(r)); c.arts.forEach(r => out.push(r)); })); return out; }
/* ---------- bloques = regimientos ---------- */
function bvMakeBlock(V, it, side) {
  const type = (DIVS[it.d.t] && DIVS[it.d.t].armor >= 0.35) ? 'tank' : dKind(it.d), F = BV_FORM[type] || BV_FORM.inf;
  const blk = {id: V.nid++, d: it.d, a: it.a, side, type, F, tag: it.a.tag, color: (G.C[it.a.tag] && G.C[it.a.tag].color) || '#888', x: 0, y: BV_H / 2, hd: side === 'A' ? 0 : Math.PI, vx: 0, vy: 0, mode: 'deploy', ph: rnd(0, 6.28),
    fs: 0, figs: [], sc: 1, lane: 0, nLane: 1, role: 'line', fireAcc: rnd(0, 1), cd: rnd(0.5, 3), relief: null, comp: 1, foe: null, path: null, init: false, skey: '', dep: F.h, wid: F.w, engT: 0, hits: 0, hy: BV_H / 2, hdep: 0, rank: 0};
  const mk = (kind, k, i) => ({kind, k, i, x: 0, y: 0, vx: 0, vy: 0, alive: true, dying: 0, flee: 0, ph: rnd(0, 6.28), recoil: 0, flash: 0});
  if (type === 'art') { for (let k = 0; k < 3; k++) blk.figs.push(mk('gun', k, k)); for (let k = 0; k < 3; k++) blk.figs.push(mk('crew', k, 3 + k)); } else for (let k = 0; k < F.n; k++) blk.figs.push(mk('sol', k, k));
  return blk;
}
function bvDims(blk) { blk.dep = blk.F.h; blk.wid = blk.F.w; }
function bvSlot(blk, f) {
  const F = blk.F; let lx, ly;
  if (f.kind === 'gun') { ly = (f.k - 1) * 7; lx = 2; } else if (f.kind === 'crew') { ly = (f.k - 1) * 7; lx = -5; }
  else { const col = f.k % F.cols, row = Math.floor(f.k / F.cols); ly = (col - (F.cols - 1) / 2) * F.sx; lx = ((F.rows - 1) / 2 - row) * F.sy; }
  const c = Math.cos(blk.hd), sn = Math.sin(blk.hd); return [blk.x + c * lx - sn * ly, blk.y + sn * lx + c * ly];
}
function bvHome(blk, L) {
  const dir = blk.side === 'A' ? 1 : -1;
  if (blk.d.cust && blk.d.cust.abs) return {x: blk.d.cust.x, y: blk.d.cust.y};
  if (blk.d.cust) return {x: L - dir * (blk.d.cust.dep + blk.dep / 2), y: blk.d.cust.y};
  return {x: L - dir * (blk.hdep + blk.dep / 2), y: blk.hy};
}
function bvRelief() { }
/* ---------- sincronización: cuerpos, regimientos, reservas y artillería ---------- */
function bvSync(V, b) {
  const seen = new Set(), corps = []; b.cstr = b.cstr || {}; b.cgun = b.cgun || {};
  ['A', 'B'].forEach(side => sideIds(b, side).map(armyById).filter(Boolean).forEach(a => corpsOfArmy(a).forEach(c => { c.side = side; c.tag = a.tag; corps.push(c); })));
  V.corps = corps;
  corps.forEach(c => {
    c.blks = []; c.ablks = [];
    const mk = r => { if (r.s <= 0.02) return null; seen.add(r); let blk = V.blocks.get(r); if (!blk) { blk = bvMakeBlock(V, {d: r, a: c.a}, c.side); V.blocks.set(r, blk); } blk.a = c.a; blk.corps = c; return blk; };
    c.regs.forEach(r => { const k = mk(r); if (k) c.blks.push(k); }); c.arts.forEach(r => { const k = mk(r); if (k) c.ablks.push(k); });
  });
  ['A', 'B'].forEach(side => {
    const cs = corps.filter(c => c.side === side), ord = [], cavs = [];
    cs.forEach(c => c.blks.forEach(k => { k.reserve = !!k.d.out; if (k.reserve) return; if (k.type === 'cav') cavs.push(k); else ord.push(k); }));
    cavs.forEach((k, i) => { if (i % 2) ord.push(k); else ord.unshift(k); });                    // la caballería, a las alas
    const n = ord.length, cap = 26, R = Math.max(1, Math.ceil(n / cap)), lanes = Math.ceil(n / R), top = 58, bot = BV_H - 42, sp = (bot - top) / Math.max(1, lanes);
    ord.forEach((k, i) => { k.role = 'line'; k.rank = i % R; k.lane = Math.floor(i / R); k.nLane = lanes; k.hy = top + (k.lane + 0.5) * sp; k.hdep = k.rank * 30; });
    cs.forEach(c => {
      const ln = c.blks.filter(k => !k.reserve), rs = c.blks.filter(k => k.reserve), ys = ln.map(k => k.hy), yc = ys.length ? ys.reduce((p, v) => p + v, 0) / ys.length : BV_H / 2;
      rs.forEach((k, i) => { k.role = 'reserve'; k.lane = i; k.nLane = rs.length; k.hy = clamp(yc + (i - (rs.length - 1) / 2) * 30, 50, BV_H - 36); k.hdep = 120 + (i % 2) * 30; });
      const as = c.ablks, mode = b.cgun[c.id] || 'att', y0 = ys.length ? Math.min(...ys) : yc - 60, y1 = ys.length ? Math.max(...ys) : yc + 60; c.yc = yc; c.y0 = y0; c.y1 = y1;
      as.forEach((k, i) => { k.role = 'art'; k.lane = i; k.nLane = as.length; if (mode === 'bat') { k.hy = clamp(yc + (i - (as.length - 1) / 2) * 34, 50, BV_H - 36); k.hdep = 80; } else { k.hy = as.length > 1 ? y0 + (i + 0.5) * (y1 - y0) / as.length : yc; k.hdep = 36; } });
    });
  });
  V.blocks.forEach(blk => {     // bajas visibles: soldados vivos según la fuerza del regimiento
    const s = clamp(blk.d.s, 0, 1), kinds = blk.type === 'art' ? [['gun', 3], ['crew', 3]] : [['sol', blk.F.n]];
    kinds.forEach(([kd, tot]) => { const want = s > 0.02 ? Math.max(1, Math.ceil(tot * s - 1e-6)) : 0; const al = blk.figs.filter(f => f.kind === kd && f.alive); for (let n = al.length; n > want; n--) { const cand = blk.figs.filter(f => f.kind === kd && f.alive); bvKill(V, blk, cand[Math.floor(Math.random() * cand.length)]); } });
  });
  { const ps0 = playerSide(b); if (typeof tacAiDeploy === 'function') ['A', 'B'].forEach(s => { if (s !== ps0) tacAiDeploy(V, b, s); }); }
  V.blocks.forEach((blk, d) => { if (!seen.has(d)) { if (d.out && d.s > 0.02) { blk.role = 'reserve'; return; } blk.figs.forEach(f => { if (f.alive && !f.flee) bvFlee(V, blk, f, 1.2); }); blk.mode = 'rout'; V.ghosts.push(blk); V.blocks.delete(d); } });
}
/* ---------- estrategia y línea por cuerpo ---------- */
function bvStratC(V, b, blk) { const c = blk.corps, k = c && b.cstr && b.cstr[c.id]; return k || bvStrat(b, blk.side); }
function bvLineSt(V, b, side, st) {
  const x0 = BV_W / 2 + V.adv * 200, att = b.att === side, dir = side === 'A' ? 1 : -1, frac = clamp((performance.now() - V.dayT) / Math.max(400, dayMs()), 0, 1), dday = b.day - 1 + frac; let gap = 34;
  if (b.prep) return x0 - dir * (36 * BV_K + ((V.shift && V.shift[side]) || 0));
  if (st === 'frontal') gap = att ? 24 + 11 * Math.sin(V.t * 1.2) : 36; else if (st === 'hold') gap = att ? 52 : 74; else if (st === 'skirmish') gap = 62 + 8 * Math.sin(V.t * 1.4);
  else if (st === 'charge') gap = clamp(60 - dday * 20, 12, 60); else if (st === 'barrage') gap = b.day <= 3 ? 88 : 36; else if (st === 'flank') gap = 42;
  if (V.boost[side] > 0) gap = 10;
  return x0 - dir * (gap * BV_K + ((V.shift && V.shift[side]) || 0));
}
function bvLine(V, b, side) { return bvLineSt(V, b, side, bvStrat(b, side)); }
function bvLineFor(V, b, blk, lines) { return blk.corps && b.cstr && b.cstr[blk.corps.id] ? bvLineSt(V, b, blk.side, b.cstr[blk.corps.id]) : lines[blk.side]; }
// avance en línea: ningún regimiento se adelanta ni se rezaga del resto de su cuerpo
function bvCorpsUpdate(V) { (V.corps || []).forEach(c => { const ls = (c.blks || []).filter(k => k.role === 'line' && k.mode !== 'rout' && !k.garr); c.cx = ls.length ? ls.reduce((n, k) => n + k.x, 0) / ls.length : 0; c.nl = ls.length; }); }
/* ---------- contadores: regimientos como cuadrados divididos en 4 ---------- */
function bvPlate(g, blk, hover) {
  const x = blk.x, y = blk.y, w = blk.wid, h = blk.dep, col = blk.color, c = hexRgb(col), lite = (c[0] * 0.3 + c[1] * 0.59 + c[2] * 0.11) > 150, line = lite ? 'rgba(20,24,40,.85)' : 'rgba(255,255,255,.9)';
  const orgF = clamp(blk.d.o / DIVS[blk.d.t].org, 0, 1), sF = clamp(blk.d.s, 0, 1), eng = blk.mode === 'melee' || blk.mode === 'charge' || blk.mode === 'gallop', rt = blk.mode === 'rout' || blk.brk > 0;
  g.save(); g.translate(x, y); if (rt) g.globalAlpha = 0.6;
  if (blk.type === 'art') {
    const gn = clamp(Math.round((blk.d.nk || 1) > 1 ? 4 : 3), 1, 4), n = clamp(Math.round(sF * 3), 1, 3);
    g.fillStyle = 'rgba(20,16,10,.35)'; g.fillRect(-w / 2, -h / 2, w, h); g.strokeStyle = bvShade(col, -0.3); g.lineWidth = 0.7; g.strokeRect(-w / 2, -h / 2, w, h);
    for (let i = 0; i < n; i++) { const cx = (i - (n - 1) / 2) * 8; g.strokeStyle = '#1c1c20'; g.lineWidth = 2.6; g.lineCap = 'round'; g.beginPath(); g.moveTo(cx - 3, 0); g.lineTo(cx + 4.5, -2); g.stroke(); g.strokeStyle = col; g.lineWidth = 1.2; g.beginPath(); g.moveTo(cx - 3, 0); g.lineTo(cx + 4.5, -2); g.stroke(); g.fillStyle = '#2a2018'; g.beginPath(); g.arc(cx - 2, 2.3, 2.1, 0, 6.3); g.fill(); g.strokeStyle = '#9a8a6a'; g.lineWidth = 0.5; g.beginPath(); g.moveTo(cx - 4, 2.3); g.lineTo(cx, 2.3); g.moveTo(cx - 2, 0.3); g.lineTo(cx - 2, 4.3); g.stroke(); }
    g.lineCap = 'butt'; void gn;
    if (blk.sil) { g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(-w / 2, -h / 2, w, h); }
  } else {
    g.fillStyle = 'rgba(0,0,0,.28)'; g.fillRect(-w / 2 + 1.5, -h / 2 + 2, w, h);
    g.fillStyle = col; g.fillRect(-w / 2, -h / 2, w, h);
    g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(-w / 2, -h / 2, w, h / 2);
    g.strokeStyle = line; g.lineWidth = 1.2; g.beginPath();
    if (blk.type === 'cav') { g.moveTo(-w / 2, -h / 2); g.lineTo(w / 2, h / 2); g.moveTo(w / 2, -h / 2); g.lineTo(-w / 2, h / 2); }      // triángulos
    else if (blk.type === 'tank') { g.rect(-w / 2 + 4, -h / 2 + 6, w - 8, h - 12); g.moveTo(0, -h / 2 + 6); g.lineTo(0, -h / 2 + 1); }
    else { g.moveTo(0, -h / 2); g.lineTo(0, h / 2); g.moveTo(-w / 2, 0); g.lineTo(w / 2, 0); }                                            // cuadrado dividido en 4
    g.stroke();
    g.lineWidth = 1.4; g.strokeStyle = eng ? `rgba(255,${90 + 60 * Math.sin(performance.now() / 120) | 0},60,.95)` : orgF < 0.3 || blk.wav ? 'rgba(255,150,70,.95)' : line; g.strokeRect(-w / 2, -h / 2, w, h);
    g.fillStyle = 'rgba(8,10,14,.7)'; g.fillRect(-w / 2, h / 2 + 1, w, 2.4); g.fillStyle = sF < 0.35 ? '#e8644f' : '#79c35a'; g.fillRect(-w / 2, h / 2 + 1, w * sF, 2.4);
  }
  if (hover) { g.strokeStyle = '#fff7d0'; g.lineWidth = 1.6; g.strokeRect(-w / 2 - 2, -h / 2 - 2, w + 4, h + 4); }
  g.restore();
}
function bvFlag() { }
function bvCorpsFlags(g, V, b) {
  (V.corps || []).forEach(c => { const ls = (c.blks || []).filter(k => k.mode !== 'rout' && k.role !== 'reserve'); if (!ls.length) return; const dir = c.side === 'A' ? 1 : -1, cx = ls.reduce((n, k) => n + k.x, 0) / ls.length - dir * 34, cy = ls.reduce((n, k) => n + k.y, 0) / ls.length, col = G.C[c.tag].color, wv = Math.sin(V.t * 4 + c.idx) * 1.8;
    g.strokeStyle = '#2a2a2e'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(cx, cy + 4); g.lineTo(cx, cy - 20); g.stroke(); g.fillStyle = col; g.beginPath(); g.moveTo(cx, cy - 20); g.quadraticCurveTo(cx + 9, cy - 20 + wv, cx + 17, cy - 18.5); g.lineTo(cx + 17, cy - 9); g.quadraticCurveTo(cx + 9, cy - 9 + wv, cx, cy - 10.5); g.fill();
    g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 0.7; g.strokeRect(cx + 0.5, cy - 19.5, 16, 9); g.fillStyle = '#fff'; g.font = 'bold 7px sans-serif'; g.textAlign = 'center'; g.fillText(String(c.idx + 1), cx + 8.5, cy - 12.6); if (V.selCorps === c.id) { g.strokeStyle = '#ffe28a'; g.setLineDash([3, 3]); g.lineWidth = 1; g.strokeRect(cx - 3, cy - 23, 24, 30); g.setLineDash([]); } });
}
/* ---------- fracción comprometida, estrategias por cuerpo y aldeas ---------- */
function divFrac(d) { if (!d.rg || !d.rg.length) return 1; return d.rg.filter(r => !r.out).length / d.rg.length; }
function regsSaveFlags(b) { ['A', 'B'].forEach(s => sideIds(b, s).map(armyById).filter(Boolean).forEach(a => a.divs.forEach(d => { if (d.rg) d.rs = d.rg.map(r => !!r.out); }))); }
function tacApplyCorpsStrats(b) {
  if (!b.cstr) return;
  ['A', 'B'].forEach(s => { const cnt = {}; sideIds(b, s).map(armyById).filter(Boolean).forEach(a => corpsOfArmy(a).forEach(c => { const k = b.cstr[c.id]; if (k) cnt[k] = (cnt[k] || 0) + c.regs.length; }));
    const best = Object.keys(cnt).sort((p, q) => cnt[q] - cnt[p])[0]; if (best && b['str' + s] !== best) { b['str' + s] = best; b['ss' + s] = b.day; b.stratSeq = (b.stratSeq || 0) + 1; } });
}
const _updateStrategies0 = updateStrategies;
updateStrategies = function (b) { _updateStrategies0(b); tacApplyCorpsStrats(b); };
const _tacPlanFx3 = tacPlanFx;
tacPlanFx = function (V, b, all) { _tacPlanFx3(V, b, all); ['A', 'B'].forEach(s => { const held = (b.vill && b.vill[s]) || 0; b.tac[s].def += Math.min(0.06, held * 0.012); b.tac[s].att += Math.min(0.04, held * 0.008); }); };
function tacVillages(V, b, all) {
  const tf = V.tf; if (!tf || !tf.villages) return; b.vill = {A: 0, B: 0};
  tf.villages.forEach(v => { let a = 0, c = 0; all.forEach(o => { if (o.type === 'art' || o.mode === 'rout') return; if (Math.abs(o.x - v.x) < v.r && Math.abs(o.y - v.y) < v.r * 0.85) { if (o.side === 'A') a++; else c++; } }); if (a > c) v.ctl = 'A'; else if (c > a) v.ctl = 'B'; if (v.ctl) b.vill[v.ctl]++; });
}
/* ---------- IA: el terreno decide dónde se despliega, qué estrategia lleva cada cuerpo y qué aldeas toma ---------- */
function tacAiDeploy(V, b, s) {
  V.shift = V.shift || {}; if (V.shift[s] !== undefined) return; const tf = battleTerrain(b), dir = s === 'A' ? 1 : -1, isDef = b.att !== s; let best = 0, bs = -1e9;
  for (let sh = -60; sh <= 420; sh += 30) { const x = BV_W / 2 - dir * (36 * BV_K + sh); if (x < 160 || x > BV_W - 160) continue; let sc = 0, n = 0; for (let y = 110; y <= BV_H - 110; y += 40) { sc += tacTerrScore(tf, x, y, s); n++; } sc /= Math.max(1, n);
    const val = sc * (isDef ? 1.4 : 0.6) - (isDef ? 0.0012 * sh : 0.006 * Math.max(0, sh - 60)); if (val > bs) { bs = val; best = sh; } }
  V.shift[s] = best;
}
function tacAiCorps(V, b, all, s) {
  if (V.t - (V['aiCs' + s] || -99) < 8) return; V['aiCs' + s] = V.t; const tf = V.tf, isDef = b.att !== s, mine = all.filter(o => o.side === s), foes = all.filter(o => o.side !== s), ratio = mine.reduce((n, o) => n + o.d.s, 0) / Math.max(0.1, foes.reduce((n, o) => n + o.d.s, 0)); b.cstr = b.cstr || {};
  (V.corps || []).filter(c => c.side === s).forEach(c => { const ls = (c.blks || []).filter(k => k.role === 'line'); if (!ls.length) return; const ts = ls.reduce((n, k) => n + tacTerrScore(tf, k.x, k.y, s), 0) / ls.length, cavN = ls.filter(k => k.type === 'cav').length, arts = (c.ablks || []).length; let st = 'frontal';
    if (isDef && ts >= 1.8) st = 'hold'; else if (!isDef && b.day <= 3 && arts) st = 'barrage'; else if (!isDef && cavN >= 1 && (c.idx === 0 || c.idx === c.n - 1)) st = 'flank'; else if (!isDef && ts >= 1.2) st = 'skirmish'; else if (!isDef && ratio > 1.5) st = 'charge'; else if (isDef) st = ts >= 0.8 ? 'hold' : 'frontal';
    b.cstr[c.id] = st; }); tacApplyCorpsStrats(b);
}
function tacAiVillages(V, b, all, s) {
  if (V.t - (V['aiVl' + s] || -99) < 6 || !V.tf || !V.tf.villages.length) return; V['aiVl' + s] = V.t;
  (V.corps || []).filter(c => c.side === s).forEach(c => { const ls = (c.blks || []).filter(k => k.role === 'line' && !k.garr && !k.d.plan && k.mode !== 'rout' && k.type === 'inf'); if (ls.length < 3) return; const cx = ls.reduce((n, k) => n + k.x, 0) / ls.length, cy = ls.reduce((n, k) => n + k.y, 0) / ls.length;
    const v = V.tf.villages.filter(q => q.ctl !== s).sort((p, q) => Math.hypot(p.x - cx, p.y - cy) - Math.hypot(q.x - cx, q.y - cy))[0]; if (!v || Math.hypot(v.x - cx, v.y - cy) > 520) return;
    ls.slice(0, 2).forEach((k, i) => { k.d.plan = {k: 'defend', pts: [[v.x - 10, v.y - 8 + i * 12], [v.x + 10, v.y - 8 + i * 12]], i: 0}; k.skey = ''; }); });
}
/* ---------- panel de cuerpos ---------- */
function tacCorpsHtml(b, V) {
  const ps = playerSide(b); if (!ps || !V || !V.corps) return ''; const cs = V.corps.filter(c => c.side === ps); if (!cs.length) return '';
  const icons = {'': '🤖', frontal: '⚔️', flank: '↪️', hold: '⛰️', barrage: '💣', skirmish: '🏹', charge: '🔥'};
  return `<div class="corpsbox"><div class="commit-h">🧭 <b>Cuerpos de ejército</b> <small>Cada cuerpo (≈15.000 hombres, 5 regimientos) tiene su propia estrategia y avanza en línea. Los cañones se reparten por igual entre los cuerpos.${b.prep ? ' Marca regimientos como reserva y compromételos después uno a uno.' : ''}</small></div>
  ${cs.map(c => { const cur = (b.cstr || {})[c.id] || '', sel = V.selCorps === c.id, mode = (b.cgun || {})[c.id] || 'att', res = c.regs.filter(r => r.out).length;
    return `<div class="corps ${sel ? 'sel' : ''}"><div class="corps-h"><b>${corpsName(c)}</b><small>${c.a.name} · ${fmtN(corpsMen(c), 0)} h. · ${corpsGuns(c)} cañones${res ? ` · ${res} en reserva` : ''}</small><button data-act="corpssel" data-c="${c.id}" class="${sel ? 'on' : ''}" data-tip="Selecciona todo el cuerpo: las flechas que dibujes las seguirán todos sus regimientos, en línea.">${sel ? '✔ Seleccionado' : '👥 Seleccionar'}</button></div>
    <div class="strpick">${Object.keys(icons).map(k => `<button class="${cur === k ? 'on' : ''}" data-act="corpsstrat" data-c="${c.id}" data-s="${k}" data-tip="<b>${k ? STRATS[k].name : 'Automática'}</b><br>${k ? STRATS[k].desc : 'La estrategia la elige el ordenador según el terreno y la situación.'}">${icons[k]}</button>`).join('')}<span class="curst">${cur ? STRATS[cur].name : 'Automática'}</span></div>
    <div class="cm-army">${c.regs.map((r, i) => `<button class="dvchip ${r.out ? 'off' : 'on'}" ${b.prep || r.out ? `data-act="tacreg" data-c="${c.id}" data-i="${i}"` : 'disabled'} data-tip="<b>Regimiento ${i + 1}</b> · ${DIVS[r.t].name}<br>Fuerza ${Math.round(r.s * 100)}% · organización ${Math.round(r.o / DIVS[r.t].org * 100)}%<br>${r.out ? 'En RESERVA: clic para comprometerlo' : b.prep ? 'Entra en combate (clic para dejarlo en reserva)' : 'En combate'}">${DIVS[r.t].icon}<small>${Math.round(r.s * 100)}%</small></button>`).join('')}
    ${c.arts.length ? `<span class="gunsel"><small>💣 Cañones:</small><button class="${mode === 'att' ? 'on' : ''}" data-act="corpsgun" data-c="${c.id}" data-m="att" data-tip="Los cañones acompañan a los regimientos del cuerpo.">Acompañan</button><button class="${mode === 'bat' ? 'on' : ''}" data-act="corpsgun" data-c="${c.id}" data-m="bat" data-tip="Los cañones forman una batería detrás del cuerpo (en la preparación puedes arrastrarlos a donde quieras).">Batería</button></span>` : ''}</div></div>`; }).join('')}</div>`;
}
Object.assign(ACT, {
  corpsstrat: d => { const b = G.battles.find(x => x.id === UI.battle); if (!b) return; b.cstr = b.cstr || {}; if (d.s) b.cstr[d.c] = d.s; else delete b.cstr[d.c]; tacApplyCorpsStrats(b); renderBattlePanel(); },
  corpsgun: d => { const b = G.battles.find(x => x.id === UI.battle); if (!b) return; b.cgun = b.cgun || {}; b.cgun[d.c] = d.m; renderBattlePanel(); },
  corpssel: d => { const V = R.bviz; if (!V) return; V.selCorps = V.selCorps === d.c ? null : d.c; const c = (V.corps || []).find(q => q.id === d.c); V.sel = V.selCorps && c ? (c.blks[Math.floor(c.blks.length / 2)] || null) : V.sel; renderBattlePanel(); },
  tacreg: d => { const V = R.bviz, b = G.battles.find(x => x.id === UI.battle); if (!V || !b) return; const c = (V.corps || []).find(q => q.id === d.c); if (!c) return; const r = c.regs[+d.i]; if (!r) return;
    if (r.out) { r.out = false; toast('📣', `${corpsName(c)}: el regimiento ${+d.i + 1} entra en combate.`); } else if (b.prep) { const ps = playerSide(b); if (regsOfSide(b, ps).filter(q => !q.out && q.nk === REG_N).length <= 1) { toast('⚠️', 'Debe quedar al menos un regimiento en combate.'); return; } r.out = true; }
    regsSaveFlags(b); renderBattlePanel(); }
});
/* ---------- estandartes de cuerpo y aldeas (versión final: tamaño legible a la distancia de la cámara) ---------- */
function bvCorpsFlags(g, V, b) {
  (V.corps || []).forEach(c => {
    const ls = (c.blks || []).filter(k => k.mode !== 'rout' && k.role !== 'reserve'); if (!ls.length) return; const dir = c.side === 'A' ? 1 : -1, cx = ls.reduce((n, k) => n + k.x, 0) / ls.length - dir * 46, cy = ls.reduce((n, k) => n + k.y, 0) / ls.length, col = G.C[c.tag].color, wv = Math.sin(V.t * 4 + c.idx) * 3;
    g.fillStyle = 'rgba(0,0,0,.28)'; g.beginPath(); g.ellipse(cx + 3, cy + 6, 9, 3, 0, 0, 6.3); g.fill(); g.strokeStyle = '#2a2a2e'; g.lineWidth = 2; g.beginPath(); g.moveTo(cx, cy + 5); g.lineTo(cx, cy - 36); g.stroke();
    g.fillStyle = col; g.beginPath(); g.moveTo(cx, cy - 36); g.quadraticCurveTo(cx + 15, cy - 36 + wv, cx + 30, cy - 33); g.lineTo(cx + 30, cy - 16); g.quadraticCurveTo(cx + 15, cy - 16 + wv, cx, cy - 19); g.fill();
    g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = 1.2; g.strokeRect(cx + 1, cy - 35, 28, 18); g.fillStyle = '#fff'; g.font = 'bold 13px sans-serif'; g.textAlign = 'center'; g.fillText(String(c.idx + 1), cx + 15, cy - 22);
    if (V.selCorps === c.id) { ls.forEach(k => { g.strokeStyle = '#ffe28a'; g.setLineDash([4, 3]); g.lineWidth = 1.4; g.strokeRect(k.x - k.wid / 2 - 3, k.y - k.dep / 2 - 3, k.wid + 6, k.dep + 6); }); g.setLineDash([]); }
  });
  (V.tf && V.tf.villages || []).forEach(v => { if (!v.ctl) return; const col = G.C[v.ctl === 'A' ? b.A0 : b.B0].color, x = v.x + v.r * 0.55, y = v.y - v.r * 0.45, wv = Math.sin(V.t * 5 + v.id) * 2; g.strokeStyle = '#2a2a2e'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(x, y + 4); g.lineTo(x, y - 24); g.stroke(); g.fillStyle = col; g.beginPath(); g.moveTo(x, y - 24); g.quadraticCurveTo(x + 8, y - 24 + wv, x + 16, y - 22); g.lineTo(x + 16, y - 12); g.quadraticCurveTo(x + 8, y - 12 + wv, x, y - 14); g.fill(); g.strokeStyle = col; g.globalAlpha = 0.5; g.lineWidth = 2; g.beginPath(); g.ellipse(v.x, v.y, v.r, v.r * 0.82, 0, 0, 6.3); g.stroke(); g.globalAlpha = 1; });
}
