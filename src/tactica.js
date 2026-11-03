/* ===== TÁCTICA: preparación, fuertes, planes dibujados, cámara lenta y moral de los bloques =====
   · FASE DE PREPARACIÓN: al comenzar una batalla en la que participas, el combate queda congelado. Arrastra tus bloques por tu mitad del campo,
     levanta fuertes (trinchera, reducto, batería) gastando madera, materiales y pólvora de las reservas del ejército, añade cañones, o apóyate
     en los fuertes del mapa. Al pulsar «¡Comenzar!» la colocación se convierte en bonos reales de ataque y defensa.
   · PLANES POR UNIDAD: flechas de ataque, objetivo concreto, flanqueo con puntos de paso, línea defensiva y retirada; se pueden cambiar en
     pleno combate. · CÁMARA LENTA: 0 (pausa táctica), ×0,25, ×0,5 y ×1.
   · MORAL: el cansancio y la desmoralización hacen que un bloque rompa filas ante una carga de caballería; los fuertes pueden destruirse. */
const FORT_KINDS = {
  trench: {n: 'Trinchera', ic: '⛏️', w: 78, h: 14, cost: {wood: 1.5, mat: 0.6}, hp: 100, def: 0.05, need: 2, desc: 'Foso y parapeto largo: +5% de defensa si hay al menos 2 bloques tras él.'},
  redoubt: {n: 'Reducto', ic: '🏰', w: 58, h: 46, cost: {wood: 3, mat: 2.5}, hp: 190, def: 0.09, need: 2, desc: 'Fortín de tierra y madera: +9% de defensa; resiste más el cañoneo.'},
  battery: {n: 'Batería', ic: '💣', w: 48, h: 30, cost: {wood: 2, mat: 3, powder: 2}, hp: 130, def: 0.04, need: 1, guns: 2, desc: 'Plataforma con 2 cañones: +3% de ataque por cañón y +4% de defensa.'},
  fort: {n: 'Fuerte', ic: '🏯', w: 96, h: 70, cost: {}, hp: 260, def: 0.07, need: 3, guns: 1, desc: 'Fuerte permanente de la provincia: gran defensa y cañones.'}
};
const FORT_MAX = 2, FORT_GUN_COST = {wood: 1, mat: 1.5, powder: 1.5}, FORT_CAP_DEF = 0.18;
const fmtCost = c => Object.keys(c).map(k => RES_INFO[k].ic + c[k]).join(' ');
const tacCan = (ids, cost) => { const t = sideRes(ids).t; return Object.keys(cost).every(k => t[k] >= cost[k] - 1e-6); };
const sideIds = (b, s) => s === 'A' ? b.A : b.B;
const playerSide = b => b.A0 === G.player ? 'A' : b.B0 === G.player ? 'B' : null;
const tacLineBase = (b, side) => BV_W / 2 - (side === 'A' ? 1 : -1) * 36 * BV_K;
/* ---------- fuertes ---------- */
function tacAddFort(b, side, kind, x, y) {
  const K = FORT_KINDS[kind]; b.forts = b.forts || [];
  const f = {id: (b.fortSeq = (b.fortSeq || 0) + 1), side, kind, x, y, w: K.w, h: K.h, hp: K.hp, hpMax: K.hp, guns: K.guns || 0}; b.forts.push(f); return f;
}
const tacForts = (b, side) => (b.forts || []).filter(f => f.side === side && f.hp > 0);
function tacFortAt(b, x, y) { return (b.forts || []).find(f => f.hp > 0 && Math.abs(x - f.x) < f.w / 2 + 6 && Math.abs(y - f.y) < f.h / 2 + 6); }
function tacZoneOk(b, side, x, y) {
  const lo = side === 'A' ? 50 : BV_W / 2 + 30, hi = side === 'A' ? BV_W / 2 - 30 : BV_W - 50;
  return x >= lo && x <= hi && y >= 48 && y <= BV_H - 28;
}
function tacBuildFort(b, side, kind, x, y) {
  const K = FORT_KINDS[kind], ids = sideIds(b, side);
  if ((b.forts || []).filter(f => f.side === side && f.kind !== 'fort').length >= FORT_MAX) return {ok: false, msg: `Solo puedes construir ${FORT_MAX} fuertes como máximo (sin contar el fuerte de la provincia).`};
  if (!tacZoneOk(b, side, x, y)) return {ok: false, msg: 'Solo puedes construir en tu mitad del campo.'};
  const tf = battleTerrain(b), t = bvTerrAt(tf, x, y, side); if (t.water) return {ok: false, msg: 'No se puede construir en el agua.'};
  if ((b.forts || []).some(f => f.hp > 0 && Math.abs(f.x - x) < (f.w + K.w) / 2 && Math.abs(f.y - y) < (f.h + K.h) / 2)) return {ok: false, msg: 'Ya hay una obra en ese lugar.'};
  if (!tacCan(ids, K.cost)) return {ok: false, msg: `Faltan reservas: ${fmtCost(K.cost)} por división.`};
  spendSideRes(ids, K.cost); const f = tacAddFort(b, side, kind, x, y); return {ok: true, f};
}
function tacAddGun(b, f) {
  const side = f.side, ids = sideIds(b, side); if (!(f.kind === 'battery' || f.kind === 'redoubt' || f.kind === 'fort')) return {ok: false, msg: 'Solo baterías, reductos y fuertes admiten cañones.'};
  if (f.guns >= 4) return {ok: false, msg: 'Esa obra ya tiene el máximo de cañones.'};
  if (!tacCan(ids, FORT_GUN_COST)) return {ok: false, msg: `Faltan reservas: ${fmtCost(FORT_GUN_COST)} por división.`};
  spendSideRes(ids, FORT_GUN_COST); f.guns++; return {ok: true};
}
// guarnición: los bloques asignados se instalan dentro del fuerte
function tacGarrisonOf(b, f) { const out = []; sideIds(b, f.side).map(armyById).filter(Boolean).forEach(a => a.divs.forEach(d => { if (d.cust && d.cust.fort === f.id) out.push(d); })); return out; }
function tacLayoutFort(b, f) {
  const gs = tacGarrisonOf(b, f), n = gs.length; if (!n) return; const horiz = f.w >= f.h, long = horiz ? f.w : f.h, sp = Math.min(40, (long - 8) / Math.max(1, n));
  gs.forEach((d, i) => { const o = (i - (n - 1) / 2) * sp; d.cust = {abs: true, x: horiz ? f.x + o : f.x, y: horiz ? f.y : f.y + o, fort: f.id}; });
}
function tacGarrison(b, f, blk) {
  const K = FORT_KINDS[f.kind]; if (f.hp <= 0) return {ok: false, msg: 'Esa obra está destruida.'};
  if (blk.type === 'art' && f.kind === 'trench') return {ok: false, msg: 'La artillería no puede guarnecer una trinchera.'};
  const gs = tacGarrisonOf(b, f).filter(d => d !== blk.d); if (gs.length >= K.need) return {ok: false, msg: `Guarnición completa (${K.need} bloques como máximo).`};
  const old = blk.d.cust && blk.d.cust.fort; blk.d.cust = {abs: true, x: f.x, y: f.y, fort: f.id}; tacLayoutFort(b, f);
  if (old && old !== f.id) { const of = (b.forts || []).find(q => q.id === old); if (of) tacLayoutFort(b, of); }
  return {ok: true};
}
function tacRelease(b, f) { tacGarrisonOf(b, f).forEach(d => { delete d.cust; }); }
function tacDelFort(b, f) {
  tacRelease(b, f);
  if (f.kind === 'fort') return {ok: false, msg: 'Un fuerte del mapa no se puede desmontar.'};
  const K = FORT_KINDS[f.kind], ids = sideIds(b, f.side), back = {}; Object.keys(K.cost).forEach(k => { back[k] = -K.cost[k] * 0.5; }); spendSideRes(ids, back);
  b.forts = b.forts.filter(x => x !== f); return {ok: true};
}
// la IA fortifica según su estrategia y reservas
function tacAiFortify(b, side) {
  const ids = sideIds(b, side), isDef = b.att !== side, strat = (side === 'A' ? b.strA : b.strB) || 'frontal'; if (!isDef && strat !== 'hold') return;
  const dir = side === 'A' ? 1 : -1, base = tacLineBase(b, side), as = ids.map(armyById).filter(Boolean), art = as.some(a => a.divs.some(d => dKind(d) === 'art')), tf = battleTerrain(b);
  const n = isDef ? 3 : 1, ys = [BV_H * 0.28, BV_H * 0.5, BV_H * 0.72];
  for (let i = 0; i < n; i++) {
    const kind = i === 1 && art ? 'battery' : (isDef && i === 0 ? 'redoubt' : 'trench'), K = FORT_KINDS[kind], x = base - dir * (K.w / 2 + 4 + (kind === 'trench' ? 2 : 14)), y = ys[i] + (hash2(b.id, i, 5) - 0.5) * 30;
    if (!tacCan(ids, K.cost) || bvTerrAt(tf, x, y, side).water) continue; tacBuildFort(b, side, kind, x, y);
  }
}
/* ---------- bonos reales por la preparación ---------- */
function tacHpFrac(b, side) { const fs = tacForts(b, side), all = (b.forts || []).filter(f => f.side === side); const mx = all.reduce((s, f) => s + f.hpMax, 0); return mx ? fs.reduce((s, f) => s + f.hp, 0) / mx : 1; }
function tacPrepScore(V, b, side) {
  const fs = (b.forts || []).filter(f => f.side === side), dir = side === 'A' ? 1 : -1, tf = battleTerrain(b);
  const blks = V ? [...V.blocks.values()].filter(x => x.side === side) : [], L = tacLineBase(b, side); let att = 0, def = 0, fortDef = 0, fortAtt = 0;
  const pos = blks.map(k => ({k, p: bvHome(k, L)}));
  fs.forEach(f => { const K = FORT_KINDS[f.kind], occ = V ? pos.filter(o => Math.abs(o.p.x - f.x) < f.w / 2 + 26 && Math.abs(o.p.y - f.y) < f.h / 2 + 26).length : 2; const share = clamp(occ / K.need, 0, 1) * (V ? 1 : 0.8);
    fortDef += (K.def + (f.kind === 'redoubt' ? 0 : 0)) * share; fortAtt += f.guns * 0.03 * (f.kind === 'trench' ? 0 : share > 0 ? 1 : 0.5); if (f.guns) fortDef += 0.01 * f.guns * share; });
  if (V && pos.length) {
    const line = pos.filter(o => o.k.type !== 'art' && o.k.role !== 'reserve'), nl = Math.max(1, line.length);
    const onHill = line.filter(o => bvTerrAt(tf, o.p.x, o.p.y, side).hill).length / nl, onCover = line.filter(o => bvTerrAt(tf, o.p.x, o.p.y, side).cover).length / nl;
    def += 0.05 * onHill + 0.03 * onCover;
    const arts = pos.filter(o => o.k.type === 'art'), okArt = arts.length ? arts.filter(o => { const d = dir * (L - o.p.x); return d > 24 && d < 210; }).length / arts.length : 0; att += 0.04 * okArt;
    const cav = pos.filter(o => o.k.type === 'cav' || o.k.type === 'tank'); if (cav.length) att += 0.03 * (cav.filter(o => o.p.y < 130 || o.p.y > BV_H - 100).length / cav.length);
    const cover = line.reduce((s, o) => s + o.k.wid, 0) / (BV_H - 70); if (line.length >= 2 && cover < 0.5) def -= 0.04;
    if (line.length >= 3 && cover >= 0.8) def += 0.02;
  }
  return {att, def, fortDef, fortAtt};
}
function tacApplyPrep(b) {
  const V = R.bviz && R.bviz.id === b.id ? R.bviz : null; b.pb = {};
  ['A', 'B'].forEach(s => { b.pb[s] = tacPrepScore(s === playerSide(b) ? V : null, b, s); });
  b.prep = false; b.prepDone = true;
}
// modificadores que lee terrMods cada día
function tacMods(b, side) {
  const o = {att: 0, def: 0}; const pb = b.pb && b.pb[side]; if (pb) { const hf = tacHpFrac(b, side); o.att += Math.min(0.12, pb.att + Math.min(0.06, pb.fortAtt * hf)); o.def += pb.def + Math.min(FORT_CAP_DEF, pb.fortDef * hf); }
  const tc = b.tac && b.tac[side]; if (tc) { o.att += tc.att || 0; o.def += tc.def || 0; }
  return o;
}
// el cañoneo y los asaltos desgastan los fuertes del defensor
function tacFortDamage(b) {
  ['A', 'B'].forEach(side => {
    const fs = tacForts(b, side); if (!fs.length) return; const foe = side === 'A' ? 'B' : 'A', as = sideIds(b, foe).map(armyById).filter(Boolean);
    const arts = as.reduce((n, a) => n + a.divs.filter(d => dKind(d) === 'art').length, 0), push = Math.max(0, (side === 'A' ? -1 : 1) * (b.adv || 0)) * 10;
    const dmg = (2.5 + arts * 7 + push) * (0.8 + Math.random() * 0.4) / fs.length;
    fs.forEach(f => { const was = f.hp; f.hp = Math.max(0, f.hp - dmg * (f.kind === 'trench' ? 0.8 : 1)); if (was > 0 && f.hp <= 0) { tacRelease(b, f); const ev = {k: 'panic', d: b.day, t: `${FORT_KINDS[f.kind].ic} ¡Cae ${FORT_KINDS[f.kind].n.toLowerCase()} de ${G.C[side === 'A' ? b.A0 : b.B0].name}!`}; (b.log = b.log || []).push(ev); if (b.log.length > 30) b.log.shift(); } });
  });
}
/* ---------- ciclo del combate: preparación y tareas diarias ---------- */
const _battleDay0 = battleDay;
battleDay = function (b) {
  if (!b.tacInit) {
    b.tacInit = true; b.forts = b.forts || []; b.tac = {A: {att: 0, def: 0}, B: {att: 0, def: 0}};
    const pf = G.P[b.prov] && G.P[b.prov].fort || 0; if (pf > 0) { const defSide = b.att === 'A' ? 'B' : 'A', K = FORT_KINDS.fort, dir = defSide === 'A' ? 1 : -1, f = tacAddFort(b, defSide, 'fort', BV_W / 2 - dir * (112 + 12), BV_H / 2); f.hpMax = f.hp = K.hp * (0.6 + 0.4 * pf); f.guns = Math.min(4, pf); f.lvl = pf; }
    const ps = playerSide(b);
    ['A', 'B'].forEach(s => { if (s !== ps) tacAiFortify(b, s); });
    if (ps) {
      b.prep = true; b.prepT = G.date.t;
      if (!UI.battle) { UI.battle = b.id; if (typeof renderBattlePanel === 'function') renderBattlePanel(); }
      notify('war', `Preparación de la batalla de ${provName(b.prov)}: despliega tus tropas y levanta fuertes antes de comenzar.`, b.state);
    } else { tacApplyPrep(b); }
  }
  if (b.prep) { if (UI.battle !== b.id && G.date.t - (b.prepT || 0) > 3) tacApplyPrep(b); else return; }
  _battleDay0(b);
  if (b.ended) return;
  tacFortDamage(b);
  [b.A, b.B].forEach(ids => ids.map(armyById).filter(Boolean).forEach(a => { if (typeof armyBattleUse === 'function') armyBattleUse(a); }));
};
/* ---------- planes dibujados ---------- */
const PLANS = {
  attack: {n: 'Atacar', ic: '➡️', col: '#ff6a52', hint: 'Haz UN clic en el campo donde debe atacar (Mayús+clic añade puntos de paso intermedios).', multi: true, n1: 1},
  target: {n: 'Objetivo', ic: '🎯', col: '#ff3a3a', hint: 'Haz clic sobre el bloque ENEMIGO que debe atacar (la artillería dispara contra él: contrabatería si es artillería).', multi: false},
  flank: {n: 'Flanquear', ic: '↪️', col: '#ffb43c', hint: 'Haz 2 clics: primero el punto de rodeo (por un extremo) y después el flanco enemigo donde golpea (Mayús+clic añade más puntos).', multi: true, n1: 2},
  defend: {n: 'Línea defensiva', ic: '🛡️', col: '#5aa8ff', hint: 'Marca los dos extremos de la línea que debe mantener.', multi: 2},
  retreat: {n: 'Retirada', ic: '↩️', col: '#b7bcc4', hint: 'Haz clic en el punto hasta donde debe retirarse.', multi: false}
};
function tacSetPlan(V, plan) { if (!V.sel) return; V.sel.d.plan = plan; V.sel.skey = ''; plan.i = 0; }
function tacClickMap(V, b, wx, wy, dbl) {
  const dr = V.draw; if (!dr || !V.sel) return false; const P = PLANS[dr.k];
  if (dr.k === 'target') { const h = V.hover; if (h && h.side !== V.sel.side && h.mode !== 'rout') { tacSetPlan(V, {k: 'target', foe: h.d, pts: []}); V.draw = null; bvBanner(V, `🎯 ${V.sel.a.name} → ${DIVS[h.d.t].name} enemiga`, V.sel.side, ''); } else toast('🎯', 'Haz clic sobre un bloque enemigo.'); return true; }
  dr.pts.push([clamp(wx, 20, BV_W - 20), clamp(wy, 34, BV_H - 14)]);
  const sh = !!window._tacShift, done = dbl || (P.multi === true ? (!sh && dr.pts.length >= (P.n1 || 1)) : P.multi === 2 ? dr.pts.length >= 2 : true);
  if (done) { tacSetPlan(V, {k: dr.k, pts: dr.pts.slice()}); V.draw = null; bvBanner(V, `${P.ic} ${P.n}: ${V.sel.a.name}`, V.sel.side, ''); }
  return true;
}
// ejecución de un plan por un bloque: devuelve null si no hay plan activo
function bvPlanStep(V, b, blk, dt, all, home) {
  const pl = blk.d.plan; if (!pl || V.over || b.ended) return null;
  if (blk.type === 'art' && pl.k === 'target') { const f = V.blocks.get(pl.foe); if (!f || f.mode === 'rout') { delete blk.d.plan; return null; } blk.foe = f; return {mode: 'artfire', tx: blk.x, ty: blk.y, k: 0, path: null}; } const dir = blk.side === 'A' ? 1 : -1, F = blk.F, foes = all.filter(o => o.side !== blk.side && o.mode !== 'rout' && o.role !== 'reserve');
  const near = foes.reduce((m, o) => { const d = Math.hypot(o.x - blk.x, o.y - blk.y); return !m || d < m.d ? {o, d} : m; }, null);
  const contact = f => [f.x - dir * ((blk.dep + f.dep) / 2 + 7), f.y], engaged = !!near && Math.abs(near.o.x - blk.x) < (blk.dep + near.o.dep) / 2 + 10 && Math.abs(near.o.y - blk.y) < (blk.wid + near.o.wid) / 2 * 0.95;
  if (pl.k === 'target') {
    const f = V.blocks.get(pl.foe); if (!f || f.mode === 'rout') { pl.done = true; delete blk.d.plan; return null; }
    const [tx, ty] = contact(f), d = Math.hypot(tx - blk.x, ty - blk.y), eng = Math.hypot(f.x - blk.x, f.y - blk.y) < (blk.dep + f.dep) / 2 + 12; blk.foe = f;
    if (eng) return {mode: 'melee', tx: blk.x, ty: blk.y, k: 0, path: null};
    if (blk.type === 'cav') return {mode: 'gallop', tx, ty, k: 2.6, path: [[blk.x, blk.y], [tx, ty]]};
    return {mode: d < 150 ? 'fire' : 'advance', tx, ty, k: d < 150 ? 0.7 : 1.15, path: [[blk.x, blk.y], [tx, ty]]};
  }
  if (pl.k === 'attack' || pl.k === 'flank') {
    const last = pl.i >= pl.pts.length; let tx, ty, spd = 1;
    if (!last) { [tx, ty] = pl.pts[pl.i]; if (Math.hypot(tx - blk.x, ty - blk.y) < 16) { pl.i++; if (pl.i >= pl.pts.length && pl.k === 'flank') blk.flkOk = true; } } else { tx = blk.x; ty = blk.y; }
    const path = [[blk.x, blk.y]].concat(pl.pts.slice(Math.min(pl.i, pl.pts.length - 1)));
    if (pl.k === 'flank') { spd = blk.type === 'cav' ? 2.4 : blk.type === 'tank' ? 1.9 : 1.7; if (!last) return {mode: 'flank', tx, ty, k: spd, path}; blk.foe = near ? near.o : blk.foe; if (near && near.d < 200) { const [cx, cy] = contact(near.o); return {mode: engaged ? 'melee' : 'charge', tx: engaged ? blk.x : cx, ty: engaged ? blk.y : cy, k: engaged ? 0 : 3, path: null}; } return {mode: 'hold', tx: blk.x, ty: blk.y, k: 0, path: null}; }
    if (!last) return {mode: near && near.d < 150 && blk.type !== 'cav' ? 'fire' : 'advance', tx, ty, k: near && near.d < 150 ? 0.55 : 1.2, path};
    if (engaged) return {mode: 'melee', tx: blk.x, ty: blk.y, k: 0, path: null};
    return {mode: near && near.d < 170 ? 'fire' : 'hold', tx: blk.x, ty: blk.y, k: 0, path: null};
  }
  if (pl.k === 'defend') {
    const [p1, p2] = pl.pts, ti = pl.pts.length > 1 ? (blk.lane + 0.5) / Math.max(1, blk.nLane) : 0.5, mx = pl.pts.length > 1 ? p1[0] + (p2[0] - p1[0]) * ti : p1[0], my = pl.pts.length > 1 ? p1[1] + (p2[1] - p1[1]) * ti : p1[1];
    blk.defLine = true; const d = Math.hypot(mx - blk.x, my - blk.y);
    if (d > 10) return {mode: 'advance', tx: mx, ty: my, k: 1.2, path: [[blk.x, blk.y], [mx, my]]};
    if (engaged) return {mode: 'melee', tx: blk.x, ty: blk.y, k: 0, path: null};
    return {mode: near && near.d < 175 ? 'fire' : 'hold', tx: mx, ty: my, k: 0.3, path: null};
  }
  if (pl.k === 'retreat') {
    const [tx, ty] = pl.pts[0], d = Math.hypot(tx - blk.x, ty - blk.y); blk.foe = null;
    return d > 10 ? {mode: 'retreat', tx, ty, k: 1.3, path: [[blk.x, blk.y], [tx, ty]]} : {mode: 'hold', tx: blk.x, ty: blk.y, k: 0, path: null};
  }
  return null;
}
// efectos reales de los planes (flanqueos logrados, líneas defensivas) para el cálculo diario
function tacPlanFx(V, b, all) {
  const out = {A: {att: 0, def: 0}, B: {att: 0, def: 0}};
  all.forEach(blk => { const s = blk.side; if (blk.role === 'reserve' && !blk.d.plan) return;
    if (blk.defLine && blk.d.plan && blk.d.plan.k === 'defend' && blk.mode !== 'rout') out[s].def += 0.02;
    if (blk.mode === 'melee' && blk.foe) { const f = blk.foe, ang = Math.abs(bvAng(f.hd, Math.atan2(blk.y - f.y, blk.x - f.x))); if (ang > 1.9) { out[s].att += 0.03; out[f.side].def -= 0.02; } } });
  ['A', 'B'].forEach(s => { out[s].att = Math.min(0.12, out[s].att); out[s].def = clamp(out[s].def, -0.08, 0.08); });
  b.tac = out;
}
/* ---------- moral y cansancio: cargas de caballería ---------- */
function tacMorale(V, b, all, dt) {
  if (V.over || b.prep) return;
  all.forEach(blk => {
    blk.fat = clamp((blk.fat || 0) + dt * ((blk.sp || 0) / Math.max(1, blk.F.spd) * 0.012 * (blk.mode === 'gallop' || blk.mode === 'charge' ? 2 : 1) + (blk.mode === 'melee' ? 0.03 : 0) + (blk.mode === 'fire' ? 0.004 : 0) - (blk.sp < 4 && (blk.mode === 'hold' || blk.mode === 'reserve') ? 0.02 : 0)), 0, 1);
    if (blk.brk > 0) blk.brk -= dt;
    if (V.t - (blk._mt || -9) > 1.5) { blk._mt = V.t; blk.mor = typeof armyMor === 'function' ? armyMor(blk.a) : 0.8; }
    if ((blk.warnT || -99) < V.t - 9) blk.warn = false;
  });
  all.forEach(cav => {
    if ((cav.type !== 'cav' && cav.type !== 'tank') || !(cav.mode === 'gallop' || cav.mode === 'charge') || (cav.sp || 0) < 16 || cav.brk > 0) return;
    all.forEach(v => {
      if (v.side === cav.side || (v.type !== 'inf' && v.type !== 'art') || v.mode === 'rout' || v.brk > 0 || v.warn) return;
      const d = Math.hypot(v.x - cav.x, v.y - cav.y); if (d > (cav.dep + v.dep) / 2 + 46) return;
      const toC = Math.atan2(cav.y - v.y, cav.x - v.x), side = Math.abs(bvAng(v.hd, toC)), orgF = clamp(v.d.o / DIVS[v.d.t].org, 0, 1), mor = v.mor === undefined ? 0.8 : v.mor, tr = v.terr || {};
      let p = 0.08 + (1 - orgF) * 0.7 + (1 - mor) * 0.6 + (v.fat || 0) * 0.5;
      if (side > 1.9) p += 0.32; else if (side > 1.1) p += 0.14;                                  // cargados por el flanco o la espalda
      if (v.mode === 'hold' || v.defLine || v.comp < 0.9) p -= 0.22;                                 // en cuadro / línea cerrada
      if (tr.cover || tr.hill || tacFortAt(b, v.x, v.y)) p -= 0.2; if (tr.water) p += 0.1;
      if (v.type === 'art') p += 0.12; if (cav.type === 'tank') p += 0.3;
      p = clamp(p, 0.03, 0.97); v.warn = true; v.warnT = V.t;
      const cn = G.C[cav.tag].name, vn = G.C[v.tag].name;
      if (Math.random() < p) {                                                                         // rompen filas
        v.brk = 7; v.d.o = Math.max(0, v.d.o - DIVS[v.d.t].org * 0.22); v.d.s = Math.max(0, v.d.s - 0.012); v.fat = Math.min(1, (v.fat || 0) + 0.2);
        v.figs.forEach(f => { if (f.alive && !f.flee && Math.random() < 0.62) bvFlee(V, v, f, 1.1); });
        bvBanner(V, `🐎 ¡La carga de ${cn} rompe a ${vn}!`, cav.side, ''); (b.log = b.log || []).push({k: 'cav', d: b.day, t: `La caballería de ${cn} rompe una división de ${vn}: huye en desorden.`}); if (b.log.length > 30) b.log.shift();
      } else {                                                                                         // resisten y la caballería sufre
        cav.d.s = Math.max(0, cav.d.s - 0.026); cav.d.o = Math.max(0, cav.d.o - DIVS[cav.d.t].org * 0.12); cav.brk = 4; cav.fat = Math.min(1, (cav.fat || 0) + 0.25);
        bvBanner(V, `🛡️ ${vn} resiste la carga de ${cn}`, v.side, '');
      }
    });
  });
}
/* ---------- dibujo: fuertes, zonas, planes ---------- */
function tacDrawForts(g, V, b) {
  (b.forts || []).forEach(f => {
    const K = FORT_KINDS[f.kind], x = f.x, y = f.y, w = f.w, h = f.h, dead = f.hp <= 0, hpf = clamp(f.hp / f.hpMax, 0, 1), dir = f.side === 'A' ? 1 : -1, sel = V.selFort === f.id;
    g.save(); g.translate(x, y); g.globalAlpha = dead ? 0.55 : 1;
    if (dead) { g.fillStyle = 'rgba(60,44,30,.8)'; for (let i = 0; i < 14; i++) { const rx = (hash2(f.id, i, 1) - 0.5) * w, ry = (hash2(f.id, i, 2) - 0.5) * h; g.fillRect(rx, ry, 5 + hash2(f.id, i, 3) * 6, 3); } g.restore(); return; }
    g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(-w / 2 + 3, -h / 2 + 4, w, h);
    if (f.kind === 'trench') { g.fillStyle = '#2d2114'; g.fillRect(-w / 2, -h / 2 + 2, w, h - 4); g.fillStyle = '#6b5638'; g.fillRect(-w / 2, -h / 2 - 2 + (dir > 0 ? h - 2 : 0), w, 4); g.fillStyle = 'rgba(176,150,98,.9)'; for (let i = -w / 2; i < w / 2; i += 8) { g.beginPath(); g.ellipse(i + 4, dir > 0 ? h / 2 + 1 : -h / 2 - 1, 3.5, 2, 0, 0, 6.3); g.fill(); } }
    else if (f.kind === 'redoubt' || f.kind === 'fort') {
      g.fillStyle = '#5e4a30'; g.fillRect(-w / 2, -h / 2, w, h); g.fillStyle = '#3a2d1c'; g.fillRect(-w / 2 + 6, -h / 2 + 6, w - 12, h - 12); g.strokeStyle = '#8c7348'; g.lineWidth = 2; g.strokeRect(-w / 2, -h / 2, w, h);
      if (f.kind === 'fort') { g.fillStyle = '#7d7466'; [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([sx, sy]) => { g.beginPath(); g.moveTo(sx * w / 2, sy * h / 2 - 9); g.lineTo(sx * w / 2 + 9, sy * h / 2); g.lineTo(sx * w / 2, sy * h / 2 + 9); g.lineTo(sx * w / 2 - 9, sy * h / 2); g.closePath(); g.fill(); }); g.strokeStyle = '#a89a80'; g.lineWidth = 1.4; g.strokeRect(-w / 2 + 3, -h / 2 + 3, w - 6, h - 6); }
      g.fillStyle = G.C[f.side === 'A' ? b.A0 : b.B0].color; g.fillRect(-1, -h / 2 - 12, 1.5, 12); g.fillRect(0, -h / 2 - 12, 9, 6);
    } else { g.fillStyle = '#5e4a30'; g.beginPath(); g.ellipse(-dir * 4, 0, w / 2, h / 2, 0, 0, 6.3); g.fill(); g.fillStyle = '#3a2d1c'; g.beginPath(); g.ellipse(-dir * 4, 0, w / 2 - 6, h / 2 - 6, 0, 0, 6.3); g.fill(); g.strokeStyle = '#8c7348'; g.lineWidth = 1.5; g.beginPath(); g.ellipse(-dir * 4, 0, w / 2, h / 2, 0, 0, 6.3); g.stroke(); }
    for (let i = 0; i < f.guns; i++) { const gy = (i - (f.guns - 1) / 2) * 10; g.strokeStyle = '#4e5359'; g.lineWidth = 3; g.lineCap = 'round'; g.beginPath(); g.moveTo(-dir * 3, gy); g.lineTo(dir * 11, gy); g.stroke(); g.fillStyle = '#2a2018'; g.beginPath(); g.arc(-dir * 4, gy, 2.6, 0, 6.3); g.fill(); g.lineCap = 'butt'; }
    { const gn = tacGarrisonOf(b, f).length; if (gn) { g.fillStyle = 'rgba(10,12,16,.85)'; g.fillRect(-14, -h / 2 - 16, 28, 13); g.fillStyle = '#ffe9a8'; g.font = 'bold 10px sans-serif'; g.textAlign = 'center'; g.fillText('👥 ' + gn, 0, -h / 2 - 6); } }
    g.globalAlpha = 1; g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(-w / 2, h / 2 + 4, w, 4); g.fillStyle = hpf > 0.5 ? '#79c35a' : hpf > 0.25 ? '#e0b04a' : '#e8644f'; g.fillRect(-w / 2, h / 2 + 4, w * hpf, 4);
    if (sel) { g.strokeStyle = '#fff3a0'; g.setLineDash([5, 3]); g.lineWidth = 1.6; g.strokeRect(-w / 2 - 5, -h / 2 - 5, w + 10, h + 10); g.setLineDash([]); }
    g.restore();
  });
}
function tacDrawPrepZone(g, V, b) {
  if (!b.prep) return; const ps = playerSide(b); if (!ps) return; const lo = ps === 'A' ? 50 : BV_W / 2 + 30, hi = ps === 'A' ? BV_W / 2 - 30 : BV_W - 50;
  g.fillStyle = 'rgba(255,230,140,.07)'; g.fillRect(lo, 48, hi - lo, BV_H - 76); g.strokeStyle = 'rgba(255,230,140,.5)'; g.setLineDash([8, 6]); g.lineWidth = 1.4; g.strokeRect(lo, 48, hi - lo, BV_H - 76); g.setLineDash([]);
  if (V.tool && V.mouse) { const [wx, wy] = bvToWorld(V, V.mouse.x, V.mouse.y), K = FORT_KINDS[V.tool.k], ok = tacZoneOk(b, ps, wx, wy); g.globalAlpha = 0.6; g.fillStyle = ok ? '#8fd16a' : '#e8644f'; g.fillRect(wx - K.w / 2, wy - K.h / 2, K.w, K.h); g.globalAlpha = 1; g.strokeStyle = '#fff'; g.strokeRect(wx - K.w / 2, wy - K.h / 2, K.w, K.h); }
}
function tacArrow(g, pts, col, dash, w) {
  if (pts.length < 2) return; g.strokeStyle = col; g.fillStyle = col; g.lineWidth = w || 2.4; g.setLineDash(dash || []); g.lineJoin = 'round'; g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.stroke(); g.setLineDash([]);
  const a = pts[pts.length - 2], e = pts[pts.length - 1], an = Math.atan2(e[1] - a[1], e[0] - a[0]); g.beginPath(); g.moveTo(e[0] + Math.cos(an) * 9, e[1] + Math.sin(an) * 9); g.lineTo(e[0] + Math.cos(an + 2.5) * 8, e[1] + Math.sin(an + 2.5) * 8); g.lineTo(e[0] + Math.cos(an - 2.5) * 8, e[1] + Math.sin(an - 2.5) * 8); g.closePath(); g.fill();
}
function tacDrawPlans(g, V, b, all) {
  const ps = playerSide(b); if (!ps || V.replay) return;
  all.forEach(blk => { const pl = blk.d.plan; if (!pl || blk.side !== ps) return; const P = PLANS[pl.k], sel = V.sel === blk; g.globalAlpha = sel ? 1 : 0.7; const col = P.col;
    if (pl.k === 'target') { const f = V.blocks.get(pl.foe); if (f) { tacArrow(g, [[blk.x, blk.y], [f.x, f.y]], col, [], sel ? 2.8 : 2); g.strokeStyle = col; g.lineWidth = 1.6; g.beginPath(); g.arc(f.x, f.y, Math.max(f.dep, f.wid) / 2 + 8, 0, 6.3); g.stroke(); g.beginPath(); g.moveTo(f.x - 12, f.y); g.lineTo(f.x + 12, f.y); g.moveTo(f.x, f.y - 12); g.lineTo(f.x, f.y + 12); g.stroke(); } }
    else if (pl.k === 'defend') { const [p1, p2] = pl.pts.length > 1 ? pl.pts : [pl.pts[0], pl.pts[0]]; g.strokeStyle = col; g.lineWidth = 5; g.lineCap = 'round'; g.beginPath(); g.moveTo(p1[0], p1[1]); g.lineTo(p2[0], p2[1]); g.stroke(); g.lineCap = 'butt'; g.fillStyle = col; for (let i = 0; i <= 4; i++) { const t = i / 4; g.beginPath(); g.arc(p1[0] + (p2[0] - p1[0]) * t, p1[1] + (p2[1] - p1[1]) * t, 3.2, 0, 6.3); g.fill(); } }
    else { const pts = [[blk.x, blk.y]].concat(pl.pts); tacArrow(g, pts, col, pl.k === 'flank' ? [9, 5] : pl.k === 'retreat' ? [4, 5] : [], sel ? 3 : 2.2); g.fillStyle = col; pl.pts.slice(0, -1).forEach(p => { g.beginPath(); g.arc(p[0], p[1], 3, 0, 6.3); g.fill(); }); }
    g.globalAlpha = 1; });
  if (V.draw && V.draw.pts.length && V.sel) { const P = PLANS[V.draw.k], pts = [[V.sel.x, V.sel.y]].concat(V.draw.pts); if (V.mouse) { const [wx, wy] = bvToWorld(V, V.mouse.x, V.mouse.y); pts.push([wx, wy]); } tacArrow(g, pts, P.col, [3, 4], 2.4); }
}
/* ---------- terreno detallado: capas extra del fondo ---------- */
function tacBgExtras(g, V, b, H) {
  const tf = battleTerrain(b), bio = tf.bio;
  (tf.marsh || []).forEach((m, i) => { const rg = g.createRadialGradient(m.x, m.y, 4, m.x, m.y, Math.max(m.rx, m.ry)); rg.addColorStop(0, 'rgba(58,84,66,.75)'); rg.addColorStop(0.7, 'rgba(70,98,70,.55)'); rg.addColorStop(1, 'rgba(70,98,70,0)'); g.fillStyle = rg; g.beginPath(); g.ellipse(m.x, m.y, m.rx, m.ry, 0, 0, 6.3); g.fill(); g.strokeStyle = 'rgba(150,200,210,.5)'; g.lineWidth = 1; for (let k = 0; k < 16; k++) { const x = m.x + (H(k + i * 50, 91) - 0.5) * m.rx * 1.5, y = m.y + (H(k + i * 50, 92) - 0.5) * m.ry * 1.4; g.beginPath(); g.moveTo(x - 4, y); g.lineTo(x + 4, y); g.stroke(); g.strokeStyle = 'rgba(40,70,40,.8)'; g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - 5); g.stroke(); g.strokeStyle = 'rgba(150,200,210,.5)'; } });
  if (tf.pond) { const p = tf.pond; g.fillStyle = 'rgba(96,78,50,.55)'; g.beginPath(); g.ellipse(p.x, p.y, p.rx + 6, p.ry + 6, 0, 0, 6.3); g.fill(); const rg = g.createRadialGradient(p.x - p.rx * 0.2, p.y - p.ry * 0.2, 2, p.x, p.y, p.rx); rg.addColorStop(0, 'rgba(120,176,214,.95)'); rg.addColorStop(1, 'rgba(52,104,146,.95)'); g.fillStyle = rg; g.beginPath(); g.ellipse(p.x, p.y, p.rx, p.ry, 0, 0, 6.3); g.fill(); g.strokeStyle = 'rgba(235,248,255,.4)'; g.lineWidth = 1; g.beginPath(); g.ellipse(p.x, p.y, p.rx * 0.6, p.ry * 0.55, 0, 0, 6.3); g.stroke(); }
  (tf.rocks || []).forEach((r, i) => { for (let k = 0; k < 7; k++) { const x = r.x + (H(k + i * 30, 95) - 0.5) * r.r * 1.6, y = r.y + (H(k + i * 30, 96) - 0.5) * r.r * 1.2, w = 6 + H(k + i * 30, 97) * 10; g.fillStyle = 'rgba(40,36,34,.35)'; g.beginPath(); g.ellipse(x + 2, y + 3, w, w * 0.5, 0, 0, 6.3); g.fill(); g.fillStyle = bio === 8 ? 'rgba(220,224,230,.9)' : 'rgba(126,118,108,1)'; g.beginPath(); g.moveTo(x - w, y + w * 0.4); g.lineTo(x - w * 0.3, y - w * 0.7); g.lineTo(x + w * 0.6, y - w * 0.5); g.lineTo(x + w, y + w * 0.4); g.closePath(); g.fill(); g.fillStyle = 'rgba(255,255,255,.25)'; g.beginPath(); g.moveTo(x - w * 0.3, y - w * 0.7); g.lineTo(x + w * 0.6, y - w * 0.5); g.lineTo(x, y - w * 0.1); g.closePath(); g.fill(); } });
  if (tf.hamlet) { const h = tf.hamlet; tf.hamlet.houses.forEach(o => { const x = h.x + o[0], y = h.y + o[1]; g.fillStyle = 'rgba(0,0,0,.28)'; g.fillRect(x - 8 + 4, y - 6 + 4, 20, 14); g.fillStyle = '#b09a74'; g.fillRect(x - 8, y - 6, 20, 14); g.fillStyle = o[2] ? '#7a3a2a' : '#5e4a38'; g.beginPath(); g.moveTo(x - 10, y - 6); g.lineTo(x + 2, y - 15); g.lineTo(x + 14, y - 6); g.closePath(); g.fill(); g.fillStyle = '#3a2a1c'; g.fillRect(x - 1, y + 1, 4, 7); });
    g.strokeStyle = 'rgba(120,108,92,.95)'; g.lineWidth = 2.2; h.walls.forEach(wl => { g.beginPath(); g.moveTo(h.x + wl[0], h.y + wl[1]); g.lineTo(h.x + wl[2], h.y + wl[3]); g.stroke(); }); }
  (tf.hill2 ? [tf.hill2] : []).forEach(h => { const rg = g.createRadialGradient(h.x, h.y, 4, h.x, h.y, Math.max(h.rx, h.ry)); rg.addColorStop(0, 'rgba(236,222,170,.4)'); rg.addColorStop(1, 'rgba(80,60,34,0)'); g.fillStyle = rg; g.beginPath(); g.ellipse(h.x, h.y, h.rx * 1.1, h.ry * 1.1, 0, 0, 6.3); g.fill(); g.strokeStyle = 'rgba(252,238,186,.22)'; g.lineWidth = 1.1; for (let i = 0; i < 3; i++) { g.beginPath(); g.ellipse(h.x, h.y, h.rx * (1 - i * 0.25), h.ry * (1 - i * 0.25), 0, 0, 6.3); g.stroke(); } });
}
// rasgos extra deterministas (se añaden a battleTerrain)
function tacTerrainExtra(b, tf) {
  const H = k => hash2(b.id * 17 + 3, b.prov, 100 + k), bio = tf.bio, W = BV_W, Hh = BV_H, defSide = b.att === 'A' ? 'B' : 'A', dd = defSide === 'A' ? -1 : 1;
  tf.marsh = []; if ((bio === 1 || bio === 4 || bio === 6 || bio === 2) && H(1) < 0.42) { const n = 1 + (H(2) < 0.4 ? 1 : 0); for (let i = 0; i < n; i++) tf.marsh.push({x: 130 + H(3 + i) * (W - 260), y: 70 + H(6 + i) * (Hh - 140), rx: 52 + H(9 + i) * 40, ry: 30 + H(12 + i) * 24}); }
  tf.pond = H(15) < (bio === 1 || bio === 4 ? 0.28 : 0.1) ? {x: 150 + H(16) * (W - 300), y: 80 + H(17) * (Hh - 160), rx: 24 + H(18) * 20, ry: 15 + H(19) * 11} : null;
  tf.rocks = []; if ((bio === 3 || bio === 7 || bio === 8 || bio === 5) && H(20) < 0.7) { const n = 1 + Math.floor(H(21) * 3); for (let i = 0; i < n; i++) tf.rocks.push({x: 120 + H(22 + i) * (W - 240), y: 60 + H(25 + i) * (Hh - 120), r: 26 + H(28 + i) * 22}); }
  tf.hamlet = null; if ((bio === 1 || bio === 4 || bio === 2) && H(30) < 0.38) { const x = W / 2 - dd * (60 + H(31) * 70) * -1, y = 70 + H(32) * (Hh - 140); const hs = [[-18, -10, 1], [10, -14, 0], [-4, 12, 1], [22, 10, 0]]; tf.hamlet = {x, y, houses: hs, walls: [[-30, -24, 34, -24], [34, -24, 34, 26], [-30, 26, 34, 26]], side: defSide}; }
  tf.hill2 = tf.hill && H(35) < 0.35 ? {x: W / 2 - (tf.hill.x - W / 2) * 0.8 + (H(36) - 0.5) * 80, y: 80 + H(37) * (Hh - 160), rx: 44 + H(38) * 24, ry: 52 + H(39) * 24} : null;
  tf.road = (() => { const ry = BV_H * (0.58 + (hash2(1, b.id * 77 + 5, 31) - 0.5) * 0.22), P0 = [-10, ry + 14], C1 = [W * 0.3, ry - 30], C2 = [W * 0.6, ry + 40], P3 = [W + 10, ry - 8], pts = []; for (let i = 0; i <= 40; i++) { const t = i / 40, u = 1 - t; pts.push([u * u * u * P0[0] + 3 * u * u * t * C1[0] + 3 * u * t * t * C2[0] + t * t * t * P3[0], u * u * u * P0[1] + 3 * u * u * t * C1[1] + 3 * u * t * t * C2[1] + t * t * t * P3[1]]); } return {pts}; })();
}
const tacRoadAt = (tf, x, y) => { if (!tf.road) return false; let best = 1e9; tf.road.pts.forEach(p => { if (Math.abs(p[0] - x) < 30) best = Math.min(best, Math.hypot(p[0] - x, p[1] - y)); }); return best < 9; };
function tacTerrAtExtra(tf, x, y, side, o) {
  (tf.marsh || []).forEach(m => { if (((x - m.x) / m.rx) ** 2 + ((y - m.y) / m.ry) ** 2 < 1) { o.marsh = true; o.slow = Math.min(o.slow, 0.5); } });
  if (tf.pond && ((x - tf.pond.x) / tf.pond.rx) ** 2 + ((y - tf.pond.y) / tf.pond.ry) ** 2 < 1) { o.water = true; o.slow = Math.min(o.slow, 0.3); }
  (tf.rocks || []).forEach(r => { if (Math.hypot(x - r.x, y - r.y) < r.r) { o.cover = true; o.slow = Math.min(o.slow, 0.6); } });
  if (tf.hamlet && Math.abs(x - tf.hamlet.x) < 36 && Math.abs(y - tf.hamlet.y) < 30) { o.cover = true; o.village = true; }
  if (tf.hill2 && ((x - tf.hill2.x) / tf.hill2.rx) ** 2 + ((y - tf.hill2.y) / tf.hill2.ry) ** 2 < 1) o.hill = true;
  if (o.slow >= 1 && tacRoadAt(tf, x, y)) o.slow = 1.3;
}
/* ---------- ratón: arrastrar bloques, construir y dibujar planes ---------- */
function tacMouseDown(V, b, e, p) {
  if (V.replay || b.ended) return false; const ps = playerSide(b); if (!ps) return false; const [wx, wy] = bvToWorld(V, p.x, p.y);
  if (b.prep) {
    if (V.tool) { const r = tacBuildFort(b, ps, V.tool.k, wx, wy); if (!r.ok) toast('⚠️', r.msg); else { V.selFort = r.f.id; V.tool = null; } renderBattlePanel(); return true; }
    if (V.garr) { const f0 = tacFortAt(b, wx, wy); if (f0 && f0.side === ps) { if (!V.sel || V.sel.side !== ps) toast('⚠️', 'Primero selecciona uno de tus bloques.'); else { const r = tacGarrison(b, f0, V.sel); if (!r.ok) toast('⚠️', r.msg); else toast('🏰', `${V.sel.a.name} guarnece ${FORT_KINDS[f0.kind].n.toLowerCase()}.`); } renderBattlePanel(); return true; } }
    if (V.draw) return false;
    const h = V.hover; if (h && h.side === ps) { V.sel = h; V.dragBlk = h; V.selFort = null; renderBattlePanel(); return true; }
    const f = tacFortAt(b, wx, wy); if (f && f.side === ps) { V.selFort = f.id; V.sel = null; renderBattlePanel(); return true; }
  }
  return false;
}
function tacMouseMove(V, b, p) { const k = V.dragBlk; if (!k || !b.prep) return false; const ps = playerSide(b), dir = ps === 'A' ? 1 : -1, [wx, wy] = bvToWorld(V, p.x, p.y), L = tacLineBase(b, ps); const lo = ps === 'A' ? 50 : BV_W / 2 + 30, hi = ps === 'A' ? BV_W / 2 - 30 : BV_W - 50; const x = clamp(wx, lo, hi), y = clamp(wy, 48, BV_H - 28);
  const old = k.d.cust && k.d.cust.fort; k.d.cust = {dep: dir * (L - x) - k.dep / 2, y}; V.dragPos = [x, y]; if (old) { const f = (b.forts || []).find(q => q.id === old); if (f) tacLayoutFort(b, f); } return true; }
function tacMouseUp(V) { if (V.dragBlk) { const k = V.dragBlk, b = G.battles.find(x => x.id === UI.battle); V.dragBlk = null; if (b && V.dragPos) { const f = tacFortAt(b, V.dragPos[0], V.dragPos[1]); if (f && f.side === k.side) { const r = tacGarrison(b, f, k); if (!r.ok) toast('⚠️', r.msg); } } renderBattlePanel(); return true; } return false; }
/* ---------- acciones del panel ---------- */
Object.assign(ACT, {
  tacfort: d => { const V = R.bviz, b = G.battles.find(x => x.id === UI.battle); if (!V || !b || !b.prep) return; V.tool = V.tool && V.tool.k === d.k ? null : {k: d.k}; V.draw = null; renderBattlePanel(); },
  tacgun: () => { const V = R.bviz, b = G.battles.find(x => x.id === UI.battle); if (!V || !b || !b.prep) return; const f = (b.forts || []).find(x => x.id === V.selFort); if (!f) { toast('⚠️', 'Selecciona primero una obra (clic sobre ella).'); return; } const r = tacAddGun(b, f); if (!r.ok) toast('⚠️', r.msg); renderBattlePanel(); },
  tacgar: () => { const V = R.bviz, b = G.battles.find(x => x.id === UI.battle); if (!V || !b || !b.prep) return; V.garr = !V.garr; V.tool = null; V.draw = null; if (V.garr) toast('🏰', 'Selecciona un bloque tuyo y haz clic en un fuerte para guarnecerlo.'); renderBattlePanel(); },
  tacdel: () => { const V = R.bviz, b = G.battles.find(x => x.id === UI.battle); if (!V || !b || !b.prep) return; const f = (b.forts || []).find(x => x.id === V.selFort); if (!f) { toast('⚠️', 'Selecciona primero una obra.'); return; } const r = tacDelFort(b, f); if (!r.ok) toast('⚠️', r.msg); V.selFort = null; renderBattlePanel(); },
  tacstart: () => { const b = G.battles.find(x => x.id === UI.battle); if (!b || !b.prep) return; const V = R.bviz; if (V) { V.tool = null; V.dragBlk = null; V.selFort = null; } tacApplyPrep(b); const ps = playerSide(b), pb = b.pb[ps]; toast('⚔️', `¡Comienza la batalla! Preparación: ataque ${((pb.att + pb.fortAtt) * 100).toFixed(0)}% · defensa ${((pb.def + Math.min(FORT_CAP_DEF, pb.fortDef)) * 100).toFixed(0)}%.`); R.bvPrevPause = false; G.paused = false; UI.tactPaused = false; renderBattlePanel(); },
  tacplan: d => { const V = R.bviz, b = G.battles.find(x => x.id === UI.battle); if (!V || !V.sel || !b || b.ended || V.replay) return; if (V.sel.side !== playerSide(b)) return; V.tool = null;
    if (d.k === 'clear') { delete V.sel.d.plan; V.sel.skey = ''; V.draw = null; toast('🎯', 'Plan cancelado.'); } else if (d.k === 'fix') { const dr = V.draw; if (dr && dr.pts.length) { tacSetPlan(V, {k: dr.k, pts: dr.pts.slice()}); bvBanner(V, `${PLANS[dr.k].ic} ${PLANS[dr.k].n}: ${V.sel.a.name}`, V.sel.side, ''); } V.draw = null; }
    else if (PLANS[d.k]) { V.draw = V.draw && V.draw.k === d.k ? null : {k: d.k, pts: []}; if (V.draw) toast(PLANS[d.k].ic, PLANS[d.k].hint); }
    renderBattlePanel(); },
  tacctr: () => { const V = R.bviz, b = G.battles.find(x => x.id === UI.battle); if (!V || !V.sel || V.sel.type !== 'art' || !b || b.ended) return; const k = V.sel, R_ = tacArtRange(V, b, k), es = [...V.blocks.values()].filter(o => o.side !== k.side && o.type === 'art' && o.mode !== 'rout' && Math.hypot(o.x - k.x, o.y - k.y) <= R_).sort((p, q) => Math.hypot(p.x - k.x, p.y - k.y) - Math.hypot(q.x - k.x, q.y - k.y)); if (!es.length) { toast('🔇', 'No hay baterías enemigas al alcance de este bloque.'); return; } tacSetPlan(V, {k: 'target', foe: es[0].d, pts: []}); bvBanner(V, `🔇 Contrabatería: ${k.a.name}`, k.side, ''); renderBattlePanel(); },
  bvts: d => { const V = R.bviz; if (!V) return; const n = +d.n; V.ts = n; if (n === 0) { if (!G.paused) { G.paused = true; UI.tactPaused = true; } } else if (UI.tactPaused || G.paused) { const b = G.battles.find(x => x.id === UI.battle); if (!b || !b.prep) { G.paused = false; UI.tactPaused = false; R.bvPrevPause = false; } } V.last = performance.now(); renderBattlePanel(); }
});
// HTML del panel: preparación, planes y velocidad
function tacPanelHtml(b, V, sel) {
  const ps = playerSide(b); if (!ps || !V) return '';
  let h = ''; const ids = sideIds(b, ps);
  if (b.prep) {
    const t = sideRes(ids).t, chips = RES_KEYS.map(k => `<span class="rchip" data-tip="${RES_INFO[k].n} (por división)">${RES_INFO[k].ic} ${t[k].toFixed(1)}</span>`).join(''), selF = (b.forts || []).find(x => x.id === V.selFort);
    h += `<div class="prep"><div class="prep-h"><b>⚙️ Fase de preparación</b><small>El combate está detenido. Arrastra tus bloques por tu mitad del campo (zona marcada) y levanta fuertes con las reservas de tu ejército.</small></div>
    <div class="prep-r">${chips}</div><div class="prep-b">${['trench', 'redoubt', 'battery'].map(k => { const K = FORT_KINDS[k], ok = tacCan(ids, K.cost); return `<button data-act="tacfort" data-k="${k}" class="${V.tool && V.tool.k === k ? 'on' : ''} ${ok ? '' : 'nofunds'}" data-tip="<b>${K.n}</b><br>${K.desc}<br>Coste por división: ${fmtCost(K.cost)}">${K.ic} ${K.n}<small>${fmtCost(K.cost)}</small></button>`; }).join('')}
    <button data-act="tacgar" class="${V.garr ? 'on' : ''}" data-tip="<b>Guarnecer</b><br>Selecciona uno de tus bloques, pulsa este botón y haz clic en un fuerte: el bloque se instala dentro. También puedes arrastrar el bloque encima del fuerte. Capacidad: trinchera 2, reducto 2, batería 1, fuerte 3.">🏰 Guarnecer</button><button data-act="tacgun" data-tip="<b>Añadir un cañón</b> a la obra seleccionada. Cuesta ${fmtCost(FORT_GUN_COST)} por división.">➕ Cañón<small>${fmtCost(FORT_GUN_COST)}</small></button><button data-act="tacdel" data-tip="Desmonta la obra seleccionada (recuperas la mitad de los recursos).">🗑 Quitar</button></div>
    <div class="prep-s">${selF ? `Seleccionado: <b>${FORT_KINDS[selF.kind].ic} ${FORT_KINDS[selF.kind].n}</b> · cañones ${selF.guns}` : V.tool ? `Haz clic en tu zona para colocar: <b>${FORT_KINDS[V.tool.k].n}</b>` : (V.garr ? 'Modo guarnición: elige un bloque tuyo y haz clic en un fuerte para instalarlo dentro.' : (b.forts || []).some(f => f.kind === 'fort') ? 'Hay un fuerte de la provincia: arrastra un bloque encima o usa «Guarnecer».' : 'Elige una obra o arrastra un bloque.')}</div>
    <button class="primary prep-go" data-act="tacstart">▶ ¡Comenzar la batalla!</button></div>`;
  }
  if (!b.ended && !V.replay) {
    const sel2 = sel && sel.side === ps ? sel : null, cur = sel2 && sel2.d.plan;
    const art = sel2 && sel2.type === 'art';
    h += `<div class="plans"><div class="plans-h">🖊️ <b>Planes por unidad</b> <small>${sel2 ? `${DIVS[sel2.d.t].icon} ${sel2.a.name}${cur ? ` · plan: ${PLANS[cur.k].ic} ${PLANS[cur.k].n}` : ' · sin plan'}` : 'Selecciona uno de tus bloques y dibuja su flecha en el campo.'}</small></div>
    <div class="plans-b">${Object.keys(PLANS).map(k => `<button data-act="tacplan" data-k="${k}" class="${V.draw && V.draw.k === k ? 'on' : ''}" ${sel2 ? '' : 'disabled'} data-tip="<b>${PLANS[k].n}</b><br>${PLANS[k].hint}">${PLANS[k].ic} ${PLANS[k].n}</button>`).join('')}
    ${V.draw && V.draw.pts.length ? `<button data-act="tacplan" data-k="fix" class="fix">✔ Fijar</button>` : ''}${art ? `<button data-act="tacctr" data-tip="<b>Contrabatería</b><br>Apunta a la batería enemiga más cercana dentro de alcance para silenciarla.">🔇 Contrabatería</button>` : ''}<button data-act="tacplan" data-k="clear" ${cur ? '' : 'disabled'}>✖ Borrar</button></div>${V.draw ? `<div class="plans-s">${PLANS[V.draw.k].hint}</div>` : ''}</div>`;
  }
  return h;
}
function tacSpeedHtml(V) { const bb = G.battles.find(x => x.id === UI.battle); return `${bb && bb.prep && playerSide(bb) ? '<button data-act="tacstart" class="go">▶ ¡Comenzar la batalla!</button>' : ''}<span class="sep"></span><small class="dim">Velocidad:</small>${[[0, '⏸', 'Pausa táctica: nada se mueve; puedes dar órdenes'], [0.25, '🐢', 'Cámara muy lenta (×0,25)'], [0.5, '🐌', 'Cámara lenta (×0,5)'], [1, '▶', 'Velocidad normal (×1)']].map(([n, ic, tp]) => `<button data-act="bvts" data-n="${n}" class="${(V ? V.ts : 0.5) === n ? 'on' : ''}" data-tip="${tp}">${ic}${n ? ' ×' + n : ''}</button>`).join('')}`; }

const _endBattle0 = endBattle;
endBattle = function (b, winner) { [b.A, b.B].forEach(ids => ids.map(armyById).filter(Boolean).forEach(a => a.divs.forEach(d => { delete d.cust; delete d.plan; }))); _endBattle0(b, winner); };

window.addEventListener('keydown', e => { if (e.key === 'Shift') window._tacShift = true; const V = R.bviz; if (!V || !UI.battle) return;
  if (e.key === 'Escape' && (V.draw || V.tool || V.garr)) { V.draw = null; V.tool = null; V.garr = false; renderBattlePanel(); e.stopPropagation(); }
  else if (e.key === 'Enter' && V.draw && V.draw.pts.length) { ACT.tacplan({k: 'fix'}); e.stopPropagation(); } }, true);
window.addEventListener('keyup', e => { if (e.key === 'Shift') window._tacShift = false; });

/* ---------- artillería: alcance real, elección de objetivo y contrabatería ---------- */
function tacArtRange(V, b, blk) { return 300 + (G.date.y >= 1860 ? 60 : 0) + (G.date.y >= 1900 ? 100 : 0) + (blk.terr && blk.terr.hill ? 40 : 0); }
function tacArtFire(V, b, blk, dt, all) {
  const alive = blk.figs.filter(f => f.alive && !f.flee), guns = alive.filter(f => f.kind === 'gun'), crew = alive.filter(f => f.kind === 'crew');
  const was = blk.sil; blk.sil = !guns.length || crew.length < 2; if (blk.sil) { if (!was && blk.figs.length) { /* silenciada */ } return; }
  const dir = blk.side === 'A' ? 1 : -1, st = bvStrat(b, blk.side), heavy = st === 'barrage' || V.salvo[blk.side] > 0, range = tacArtRange(V, b, blk);
  blk.cd -= dt; if (blk.cd > 0) return;
  const inR = all.filter(o => o.side !== blk.side && o.mode !== 'rout' && Math.hypot(o.x - blk.x, o.y - blk.y) <= range);
  if (!inR.length) { blk.cd = 0.8; return; }
  const dist = o => Math.hypot(o.x - blk.x, o.y - blk.y), nearest = l => l.slice().sort((p, q) => dist(p) - dist(q))[0];
  let tgt = null, ctr = false; const pl = blk.d.plan;
  if (pl && pl.k === 'target') { const f = V.blocks.get(pl.foe); if (f && inR.includes(f)) { tgt = f; ctr = f.type === 'art'; } }
  if (!tgt) { const arts = inR.filter(o => o.type === 'art' && !o.sil && o.role !== 'reserve'); if (arts.length && Math.random() < 0.55) { tgt = nearest(arts); ctr = true; } }
  if (!tgt) { const hot = inR.filter(o => (o.mode === 'gallop' || o.mode === 'charge' || o.mode === 'melee') && dist(o) < 190); const lines = inR.filter(o => o.role !== 'reserve'); tgt = hot.length ? nearest(hot) : lines.length ? nearest(lines) : nearest(inR); }
  blk.cd = (heavy ? rnd(0.9, 1.5) : rnd(3, 5)) * (ctr ? 0.65 : 1); blk.tgt = tgt;
  const gn = guns[Math.floor(Math.random() * guns.length)], fg = pickFoeFig(tgt), tx = (fg ? fg.x : tgt.x) + rnd(-14, 14), ty = (fg ? fg.y : tgt.y) + rnd(-14, 14);
  bvPart(V, {k: 'shell', x: gn.x, y: gn.y, x2: tx, y2: ty, life: 0.55 + dist(tgt) / 520, s: blk.side, vt: tgt.id, ctr, stag: blk.tag}); gn.recoil = 1; bvPart(V, {k: 'flash', x: gn.x + Math.cos(blk.hd) * 12, y: gn.y + Math.sin(blk.hd) * 12, life: 0.14, big: 1}); if (typeof SFX !== 'undefined') SFX.cannon(0.8);
  for (let n = 0; n < 3; n++) bvPart(V, {k: 'smoke', x: gn.x + Math.cos(blk.hd) * 12, y: gn.y + Math.sin(blk.hd) * 12, life: 2.2, r: 5, vx: dir * 8 + V.wind * 0.5 + rnd(-4, 4)});
}
// impacto de un proyectil sobre un bloque: daño real y, contra artillería, bajas de piezas y servidores
function tacShellHit(V, b, p, all) {
  if (typeof SFX !== 'undefined') SFX.boom(0.8); V.shake = Math.min(5, (V.shake || 0) + 1.3);
  const v = all.find(x => x.id === p.vt); if (!v || v.mode === 'rout') return; const org = DIVS[v.d.t].org;
  if (v.type === 'art') {
    const cands = v.figs.filter(q => q.alive && !q.flee); if (cands.length && Math.random() < (p.ctr ? 0.5 : 0.3)) { const guns = cands.filter(q => q.kind === 'gun'), pool = guns.length && Math.random() < 0.45 ? guns : cands; bvKill(V, v, pool[Math.floor(Math.random() * pool.length)]); }
    v.d.s = Math.max(0, v.d.s - 0.006); v.d.o = Math.max(0, v.d.o - org * 0.012);
    const al = v.figs.filter(q => q.alive && !q.flee), sil = !al.some(q => q.kind === 'gun') || al.filter(q => q.kind === 'crew').length < 2;
    if (sil && !v.sil) { v.sil = true; const sn = G.C[p.stag] ? G.C[p.stag].name : '', vn = G.C[v.tag].name; bvBanner(V, `🔇 ${sn} silencia una batería de ${vn}`, v.side === 'A' ? 'B' : 'A', ''); (b.log = b.log || []).push({k: 'barrage', d: b.day, t: `Contrabatería: ${sn} silencia una batería de ${vn}.`}); if (b.log.length > 30) b.log.shift(); }
  } else { v.d.s = Math.max(0, v.d.s - 0.003); v.d.o = Math.max(0, v.d.o - org * 0.01); }
}
function tacDrawArt(g, V, b, all) {
  all.forEach(blk => { if (blk.type !== 'art') return;
    if (blk.sil) { g.font = '13px sans-serif'; g.textAlign = 'center'; g.fillStyle = 'rgba(10,12,16,.85)'; g.beginPath(); g.arc(blk.x, blk.y - blk.wid / 2 - 17, 8, 0, 6.3); g.fill(); g.fillStyle = '#fff'; g.fillText('🔇', blk.x, blk.y - blk.wid / 2 - 13); }
    if (V.sel === blk) { const r = tacArtRange(V, b, blk); g.strokeStyle = 'rgba(255,230,140,.5)'; g.setLineDash([6, 6]); g.lineWidth = 1.2; g.beginPath(); g.arc(blk.x, blk.y, r, 0, 6.3); g.stroke(); g.setLineDash([]); if (blk.tgt && V.blocks.has(blk.tgt.d)) { g.strokeStyle = 'rgba(255,90,60,.55)'; g.beginPath(); g.moveTo(blk.x, blk.y); g.lineTo(blk.tgt.x, blk.tgt.y); g.stroke(); } } });
}
