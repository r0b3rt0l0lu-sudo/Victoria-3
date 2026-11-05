/* ===== VISOR TÁCTICO POR BLOQUES =====
   Cada división real es un BLOQUE (un cuadrado de soldados en formación). Cada bloque tiene su propio estado y su propia orden dentro de
   la estrategia de su bando: unos fijan al enemigo, otros flanquean, otros hostigan, cargan o se repliegan, y la reserva releva a los
   bloques agotados. Los soldados siguen su casilla dentro del bloque; las bajas, la organización y las rotas vienen de la batalla real.
   Pasa el ratón por un bloque para ver su general, fuerza, organización, moral y orden actual. */
const BV_W = 1920, BV_H = 840, BV_K = 2.4;
const BV_FORM = {
  inf: {n: 6, cols: 3, rows: 2, sx: 6, sy: 7, spd: 32, w: 26, h: 22},
  cav: {n: 4, cols: 4, rows: 1, sx: 5.5, sy: 7, spd: 70, w: 26, h: 22},
  art: {n: 3, cols: 3, rows: 1, sx: 7, sy: 7, spd: 18, w: 24, h: 18},
  tank: {n: 3, cols: 3, rows: 1, sx: 8, sy: 8, spd: 44, w: 26, h: 22}
};
const BV_KIND = {inf: 'Infantería', cav: 'Caballería', art: 'Artillería', tank: 'Carros de combate'};
const BV_STATUS = {deploy: 'Desplegándose', advance: 'Avanzando', hold: 'Manteniendo la línea', fire: 'Fuego de fusilería', melee: 'Cuerpo a cuerpo', charge: '¡A la carga!', flank: 'Flanqueando', fixing: 'Fijando al enemigo',
  skirmish: 'Hostigando', retreat: 'Replegándose', reserve: 'En reserva', artfire: 'Bombardeando', rout: '¡En desbandada!', victory: 'Victoria', gallop: 'Carga de caballería', recoil: 'Retrocede, presa del pánico'};
const BV_PHASE = {melee: 'combate', fire: 'combate', charge: 'combate', gallop: 'combate', artfire: 'combate', flank: 'maniobra', advance: 'maniobra', skirmish: 'maniobra', fixing: 'maniobra', deploy: 'maniobra', hold: 'línea', reserve: 'reserva', retreat: 'retirada', recoil: 'retirada', rout: 'retirada', victory: 'línea'};
const bvAng = (a, b) => { let d = (b - a) % 6.2832; if (d > 3.1416) d -= 6.2832; if (d < -3.1416) d += 6.2832; return d; };
function bvShade(hex, f) {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return hex; const n = parseInt(hex.slice(1), 16), r = n >> 16 & 255, g = n >> 8 & 255, b = n & 255, m = f < 0 ? 0 : 255, k = Math.abs(f);
  return `rgb(${Math.round(r + (m - r) * k)},${Math.round(g + (m - g) * k)},${Math.round(b + (m - b) * k)})`;
}
function bvNew(b) {
  return {id: b.id, blocks: new Map(), ghosts: [], corpses: [], parts: [], rings: [], t: 0, last: performance.now(), dayT: performance.now(), day: b.day, evSeq: b.evSeq || 0, adv: b.adv || 0, banner: null, rain: 0,
    boost: {A: 0, B: 0}, panic: {A: 0, B: 0}, salvo: {A: 0, B: 0}, man: {A: null, B: null}, over: null, mouse: null, hover: null, bg: null, cam: {z: 1, x: BV_W / 2, y: BV_H / 2}, follow: false, replay: null, rec: {snaps: [], corp: [], parts: [], info: new Map(), last: -1, after: 0}, seed: b.id * 77 + 5, nid: 1, relT: {A: 3, B: 4.5}, wind: (b.id % 2 ? 1 : -1) * 6, sel: null, ts: 0.5, tool: null, draw: null, selFort: null, dragBlk: null};
}
/* ---------- bloques y soldados ---------- */
function bvMakeBlock(V, it, side) {
  const type = (DIVS[it.d.t] && DIVS[it.d.t].armor >= 0.35) ? 'tank' : dKind(it.d), F = BV_FORM[type] || BV_FORM.inf;
  const blk = {id: V.nid++, d: it.d, a: it.a, side, type, F, tag: it.a.tag, color: (G.C[it.a.tag] && G.C[it.a.tag].color) || '#888', x: 0, y: BV_H / 2, hd: side === 'A' ? 0 : Math.PI, vx: 0, vy: 0, mode: 'deploy', ph: rnd(0, 6.28),
    fs: 0, figs: [], sc: 0.9, lane: 0, nLane: 1, role: 'line', fireAcc: rnd(0, 1), cd: rnd(0.5, 3), relief: null, comp: 1, foe: null, path: null, init: false, skey: '', dep: 24, wid: 40, engT: 0, hits: 0};
  const mk = (kind, k, i) => ({kind, k, i, x: 0, y: 0, vx: 0, vy: 0, alive: true, dying: 0, flee: 0, ph: rnd(0, 6.28), recoil: 0, flash: 0});
  if (type === 'art') { for (let k = 0; k < 3; k++) blk.figs.push(mk('gun', k, k)); for (let k = 0; k < 6; k++) blk.figs.push(mk('crew', k, 3 + k)); }
  else for (let k = 0; k < F.n; k++) blk.figs.push(mk('sol', k, k));
  return blk;
}
function bvSlot(blk, f) {
  const F = blk.F, s = blk.sc * blk.comp; let lx, ly;
  if (f.kind === 'gun') { ly = (f.k - 1) * F.sx * s; lx = 3 * s; }
  else if (f.kind === 'crew') { const gk = Math.floor(f.k / 2), sd = f.k % 2 ? 1 : -1; ly = (gk - 1) * F.sx * s + sd * 4.5 * s; lx = -6.5 * s; }
  else { const col = f.k % F.cols, row = Math.floor(f.k / F.cols); ly = (col - (F.cols - 1) / 2) * F.sx * s; lx = ((F.rows - 1) / 2 - row) * F.sy * s; }
  const c = Math.cos(blk.hd), sn = Math.sin(blk.hd);
  return [blk.x + c * lx - sn * ly, blk.y + sn * lx + c * ly];
}
function bvDims(blk) { const F = blk.F, s = blk.sc * blk.comp; blk.dep = (blk.type === 'art' ? 2.2 : F.rows) * F.sy * s + 4; blk.wid = (F.cols * F.sx) * s + 4; }
function bvKill(V, blk, f) {
  f.alive = false; f.dying = 0.8; blk.hits++;
  const cp = {x: f.x, y: f.y, color: blk.color, age: 0, hd: blk.hd + rnd(-0.6, 0.6), kind: f.kind}; V.corpses.push(cp); if (V.corpses.length > 520) V.corpses.shift(); if (!V.replay && V.rec.corp.length < 4000) V.rec.corp.push(Object.assign({t: V.t}, cp));
  // la baja tiene un causante visible: un tirador enemigo cercano
  let best = null, bd = 1e9; V.blocks.forEach(o => { if (o.side === blk.side || o.role === 'reserve') return; const d = Math.hypot(o.x - f.x, o.y - f.y); if (d < bd && d < 230) { bd = d; best = o; } });
  if (best && Math.random() < 0.7) { const sh = best.figs.filter(q => q.alive && !q.flee); if (sh.length) { const q = sh[Math.floor(Math.random() * sh.length)]; bvPart(V, {k: 'tracer', x: q.x, y: q.y, x2: f.x, y2: f.y, life: 0.09}); bvPart(V, {k: 'flash', x: q.x, y: q.y, life: 0.1}); } }
}
function bvFlee(V, blk, f, power) { if (!f.alive) return; f.flee = 3.6; const away = blk.side === 'A' ? -1 : 1; f.fvx = away * rnd(40, 100) * power + rnd(-25, 25); f.fvy = rnd(-60, 60) * power; }
function bvPart(V, p) { if (V.parts.length < 900) V.parts.push(Object.assign({age: 0}, p)); if (!V.replay && p.k !== 'dust' && V.rec.parts.length < 9000) V.rec.parts.push(Object.assign({}, p, {t: V.t})); }
function bvBanner(V, text, side, icon) { V.banner = {text, side, icon, age: 0}; }
const EV_NAME = {gas: 'Ataque con gas', charge: '¡Carga desesperada!', cav: 'Carga de caballería', barrage: 'Cañoneo', flank: 'Flanqueo', panic: 'Pánico', reinf: 'Refuerzos', rain: 'Lluvia'};
function bvEvent(V, b, kind, side) {
  if (typeof SFX !== 'undefined' && (kind === 'cav' || kind === 'charge' || kind === 'flank')) SFX.bugle();
  bvBanner(V, `${EV_NAME[kind] || kind} · ${G.C[(side === 'A' ? b.A0 : b.B0)].name}`, side, EV_ICON[kind]);
  if (kind === 'charge') V.boost[side] = 2.6;
  else if (kind === 'cav') V.man[side] = {kind: 'gallop', t: 0, dur: 3.4};
  else if (kind === 'flank') V.man[side] = {kind: 'flank', t: 0, dur: 4.5};
  else if (kind === 'barrage') V.salvo[side] = 10;
  else if (kind === 'panic') V.panic[side] = 2.6;
  else if (kind === 'rain') V.rain = 6;
  else if (kind === 'gas') V.gas = {side, t: 0, dur: 9};
  else if (kind === 'reinf') V.blocks.forEach(bk => { if (bk.side === side && bk.role !== 'reserve') for (let n = 0; n < 2; n++) bvPart(V, {k: 'spark', x: bk.x + rnd(-10, 10), y: bk.y - 6, life: 1.1}); });
  const mx = BV_W / 2 + V.adv * 100, dirS = side === 'A' ? 1 : -1; V.rings.push({x: mx + dirS * 40, y: BV_H / 2, r: 46, age: 0, life: 2.4});
}
function bvStrat(b, side) { return (side === 'A' ? b.strA : b.strB) || 'frontal'; }
// posición de la línea de cada bando según estrategia y momento (la distancia se escala al tamaño del campo)
function bvLine(V, b, side) {
  const x0 = BV_W / 2 + V.adv * 100, st = bvStrat(b, side), att = b.att === side, dir = side === 'A' ? 1 : -1;
  const frac = clamp((performance.now() - V.dayT) / Math.max(400, dayMs()), 0, 1), dday = b.day - 1 + frac;
  let gap = 34;
  if (b.prep) return x0 - dir * 36 * BV_K;
  if (st === 'frontal') gap = att ? 24 + 11 * Math.sin(V.t * 1.2) : 36;
  else if (st === 'hold') gap = att ? 52 : 74;
  else if (st === 'skirmish') gap = 62 + 8 * Math.sin(V.t * 1.4);
  else if (st === 'charge') gap = clamp(60 - dday * 20, 12, 60);
  else if (st === 'barrage') gap = b.day <= 3 ? 88 : 36;
  else if (st === 'flank') gap = 42;
  if (V.boost[side] > 0) gap = 10;
  return x0 - dir * gap * BV_K;
}
/* ---------- sincronización con la batalla real ---------- */
function bvSync(V, b) {
  const seen = new Set();
  ['A', 'B'].forEach(side => {
    const ids = side === 'A' ? b.A : b.B, list = [];
    ids.map(armyById).filter(Boolean).forEach(a => a.divs.forEach(d => { if (!d.out) list.push({a, d}); }));
    const nFront = Math.min(list.length, BATTLE_WIDTH);
    const blks = list.map((it, i) => { seen.add(it.d); let blk = V.blocks.get(it.d); if (!blk) { blk = bvMakeBlock(V, it, side); V.blocks.set(it.d, blk); } blk.a = it.a; blk.front0 = i < nFront; return blk; });
    // relevos: el bloque agotado cede su sitio a uno de reserva
    let front = blks.filter(x => x.front0); const res0 = blks.filter(x => !x.front0), used = new Set();
    front = front.map(x => { if (x.relief !== 'out') return x; const rep = res0.find(r => r.relief === 'in' && r.type === x.type && !used.has(r)); if (rep) { used.add(rep); return rep; } return x; });
    const inFront = new Set(front), res = blks.filter(x => !inFront.has(x));
    let line = front.filter(x => x.type !== 'art'), art = front.filter(x => x.type === 'art');
    if (!line.length) { line = art; art = []; }
    const cav = line.filter(x => x.type === 'cav' || x.type === 'tank'), inf = line.filter(x => x.type !== 'cav' && x.type !== 'tank'), ord = inf.slice();
    cav.forEach((c, i) => { if (i % 2) ord.push(c); else ord.unshift(c); });          // la caballería en las alas
    const laneH = (BV_H - 92) / Math.max(1, ord.length), scL = clamp(laneH / 52, 0.62, 1.3);
    ord.forEach((x, i) => { x.role = 'line'; x.lane = i; x.nLane = ord.length; x.sc = scL; });
    art.forEach((x, i) => { x.role = 'art'; x.lane = i; x.nLane = art.length; x.sc = Math.min(scL, 1.1); });
    const scR = clamp(((BV_H - 92) / Math.max(1, res.length)) / 56, 0.62, 1.1);
    res.forEach((x, i) => { x.role = 'reserve'; x.lane = i; x.nLane = res.length; x.sc = scR; });
    blks.forEach(blk => {   // bajas: soldados vivos según la fuerza de la división
      const s = clamp(blk.d.s, 0, 1), kinds = blk.type === 'art' ? [['gun', 3], ['crew', 6]] : [['sol', blk.F.n]];
      kinds.forEach(([kd, tot]) => { const want = s > 0.02 ? Math.max(1, Math.ceil(tot * s - 1e-6)) : 0; const alive = blk.figs.filter(f => f.kind === kd && f.alive); for (let n = alive.length; n > want; n--) { const cand = blk.figs.filter(f => f.kind === kd && f.alive); bvKill(V, blk, cand[Math.floor(Math.random() * cand.length)]); } });
    });
  });
  V.blocks.forEach((blk, d) => { if (!seen.has(d) && d.out) { V.blocks.delete(d); return; } if (!seen.has(d)) { blk.figs.forEach(f => { if (f.alive && !f.flee) bvFlee(V, blk, f, 1.2); }); blk.mode = 'rout'; V.ghosts.push(blk); V.blocks.delete(d); } });
}
// relevos entre bloques agotados y de reserva
function bvRelief(V, b, dt) {
  ['A', 'B'].forEach(side => {
    V.relT[side] -= dt; if (V.relT[side] > 0) return; V.relT[side] = 2.5;
    const all = [...V.blocks.values()].filter(x => x.side === side && x.type === 'inf');
    const weak = all.filter(x => x.role === 'line' && x.d.o / DIVS[x.d.t].org < 0.3 && x.relief !== 'out').sort((p, q) => p.d.o - q.d.o)[0];
    const fresh = all.filter(x => x.role === 'reserve' && x.d.o / DIVS[x.d.t].org > 0.5 && x.relief !== 'in')[0];
    if (weak && fresh) { weak.relief = 'out'; fresh.relief = 'in'; bvBanner(V, `Relevo de tropas · ${G.C[weak.tag].name}`, side, '🔄'); }
  });
}
/* ---------- comportamiento de cada bloque ---------- */
function bvHome(blk, L) {
  if (blk.d.cust && blk.d.cust.abs) return {x: blk.d.cust.x, y: blk.d.cust.y};
  if (blk.d.cust) return {x: L - (blk.side === 'A' ? 1 : -1) * (blk.d.cust.dep + blk.dep / 2), y: blk.d.cust.y};
  const dir = blk.side === 'A' ? 1 : -1, top = 54, bot = BV_H - 38, n = Math.max(1, blk.nLane); let depth, y;
  if (blk.role === 'line') { y = top + (blk.lane + 0.5) * (bot - top) / n; depth = 0; }
  else if (blk.role === 'art') { y = top + 24 + (blk.lane + 0.5) * (bot - top - 48) / n; depth = 78 + (blk.lane % 2) * 18; }
  else { y = top + (blk.lane + 0.5) * (bot - top) / n; depth = 128 + (blk.lane % 2) * 28; }
  return {x: L - dir * (depth + blk.dep / 2), y};
}
function bvFoe(blk, all) {
  let best = null, bc = 1e9;
  all.forEach(o => { if (o.side === blk.side || o.mode === 'rout') return; let c = Math.hypot(o.x - blk.x, o.y - blk.y) + Math.abs(o.y - blk.y) * 0.4;
    if (o.role === 'reserve') c += 90; if (blk.type === 'cav' && o.type === 'art') c -= 70; if (blk.type !== 'cav' && o.type === 'art') c += 25; if (c < bc) { bc = c; best = o; } });
  return best;
}
function bvOrder(blk) { const o = blk.d.ord; return o && G.date.t <= o.until && ORDERS[o.k] ? o : null; }
function bvStepBlock(V, b, blk, dt, lines, all) {
  const od = bvOrder(blk), side = blk.side, dir = side === 'A' ? 1 : -1, opp = side === 'A' ? 'B' : 'A', st = blk.venge > V.t ? 'charge' : od && od.k === 'charge' ? 'charge' : od && od.k === 'hold' ? 'hold' : bvStratC(V, b, blk), att = b.att === side, L = bvLineFor(V, b, blk, lines), LE = lines[opp];
  const skey = st + '|' + blk.role; if (blk.skey !== skey) { blk.skey = skey; blk.fs = 0; blk.path = null; }
  blk.defLine = !!(blk.d.plan && blk.d.plan.k === 'defend');
  const compT = ((st === 'hold' && !att) || (od && od.k === 'hold') || blk.defLine) && blk.role === 'line' ? 0.8 : 1; blk.comp += (compT - blk.comp) * Math.min(1, dt * 1.5); bvDims(blk);
  const home = bvHome(blk, L), F = blk.F, orgF = clamp(blk.d.o / DIVS[blk.d.t].org, 0, 1), t = V.t, foe = bvFoe(blk, all); blk.foe = foe;
  let tx = home.x, ty = home.y, spd = F.spd, mode = 'hold', engaged = false, path = null, pp = null;
  const dist = foe ? Math.hypot(foe.x - blk.x, foe.y - blk.y) : 1e9;
  if (foe && foe.role !== 'reserve') { const reach = (blk.dep + foe.dep) / 2 + 4; engaged = Math.abs(foe.x - blk.x) < reach + 6 && Math.abs(foe.y - blk.y) < (blk.wid + foe.wid) / 2 * 0.95; }
  const contact = f => [f.x - dir * ((blk.dep + f.dep) / 2 + 7), f.y];
  const man = V.man[side], boosting = V.boost[side] > 0;
  if (V.over) {            // fin de la batalla
    if (V.over.loser === side) { mode = 'retreat'; tx = home.x - dir * 400; spd = F.spd * 1.4; } else { mode = 'victory'; tx = home.x + dir * 30; spd = F.spd * 0.6; }
  } else if (b.prep) { mode = 'deploy'; spd = F.spd * 5;
  } else if (blk.brk > 0) { mode = 'retreat'; tx = home.x - dir * 210; spd = F.spd * 1.5;
  } else if (blk.d.cust && blk.d.cust.fort && !(blk.d.plan && blk.d.plan.k !== 'target') && tacFortAlive(b, blk.d.cust.fort)) { mode = (blk.foe && Math.hypot(blk.foe.x - blk.x, blk.foe.y - blk.y) < 190 && blk.foe.role !== 'reserve') ? 'fire' : 'hold'; spd = F.spd * 3; blk.garr = true;
  } else if ((pp = bvPlanStep(V, b, blk, dt, all, home)) !== null) { mode = pp.mode; tx = pp.tx; ty = pp.ty; spd = F.spd * pp.k; path = pp.path;
  } else if (blk.role === 'reserve') {
    mode = 'reserve'; tx = home.x + Math.sin(t * 0.5 + blk.ph) * 3; ty = home.y + Math.cos(t * 0.4 + blk.ph) * 2;
    if (blk.relief === 'in') { mode = 'advance'; spd = F.spd * 1.3; }
  } else if (blk.role === 'art') {
    mode = 'artfire'; if (st === 'barrage') tx += dir * 36; if (st === 'hold' && !att) tx -= dir * 6;
  } else {
    // ---- bloque de línea: su estrategia se traduce en una orden propia para cada uno ----
    const flankers = (() => { if (st !== 'flank' && !(man && man.kind === 'flank') && !(od && od.k === 'flank')) return false; if (od && od.k === 'flank') return true; const hasCav = all.some(o => o.side === side && o.role === 'line' && o.type === 'cav'); return blk.type === 'cav' || blk.type === 'tank' || (!hasCav && st === 'flank' && blk.nLane >= 3 && (blk.lane === 0 || blk.lane === blk.nLane - 1)); })();
    if (od && od.k === 'withdraw') { mode = 'retreat'; tx = home.x - dir * 140; spd = F.spd * 1.2; }
    else if (V.gas && V.gas.side !== side && V.gas.t < 5 && Math.sin(blk.ph * 5 + blk.id) > 0.1) { mode = 'recoil'; tx = L - dir * 70; spd = F.spd * 1.5; if (Math.random() < dt * 3) { const fs = blk.figs.filter(f => f.alive && !f.flee); if (fs.length) bvFlee(V, blk, fs[Math.floor(Math.random() * fs.length)], 0.6); } }
    else if (V.panic[side] > 0 && Math.sin(blk.ph * 7 + blk.id) > 0.45) { mode = 'recoil'; tx = L - dir * 120; spd = F.spd * 3; }
    else if (false) { }
    else if (flankers && foe) {
      const edgeTop = blk.lane < blk.nLane / 2 || blk.type === 'cav' && blk.lane === 0, ey = edgeTop ? 26 : BV_H - 24, xm = (L + LE) / 2;
      const ends = all.filter(o => o.side !== side && o.role === 'line' && o.mode !== 'rout'); let tf = null; ends.forEach(o => { if (!tf || (edgeTop ? o.y < tf.y : o.y > tf.y)) tf = o; });
      const f2 = tf || foe; spd = F.spd * (blk.type === 'cav' ? 2.4 : blk.type === 'tank' ? 1.9 : 1.7);
      if (blk.fs === 0) { tx = xm; ty = ey; mode = 'flank'; if (Math.hypot(blk.x - xm, blk.y - ey) < 26) blk.fs = 1; path = [[blk.x, blk.y], [xm, ey], [f2.x + dir * (f2.dep / 2 + 6), f2.y + (edgeTop ? -1 : 1) * (f2.wid / 2 + 2)]]; }
      else if (blk.fs === 1) { tx = f2.x + dir * (f2.dep / 2 + 6); ty = f2.y + (edgeTop ? -1 : 1) * (f2.wid / 2 + 2); mode = 'flank'; if (Math.hypot(blk.x - tx, blk.y - ty) < 30) blk.fs = 2; path = [[blk.x, blk.y], [tx, ty]]; }
      else { mode = 'melee'; tx = blk.x; ty = blk.y; blk.foe = f2; }
    } else if (st === 'flank' && !flankers) { mode = engaged ? 'melee' : 'fixing'; tx = home.x; if (dist < 140) mode = 'fire'; }
    else if (man && man.kind === 'gallop' && blk.type === 'cav' && foe) { const p = man.t / man.dur; spd = F.spd * 3.4; if (p < 0.55) { [tx, ty] = contact(foe); mode = 'gallop'; path = [[blk.x, blk.y], [tx, ty]]; } else { mode = 'advance'; } }
    else if (st === 'charge' || boosting) {
      mode = 'charge'; spd = F.spd * (blk.type === 'cav' ? 2.6 : 3.4); if (foe && foe.role !== 'reserve') { [tx, ty] = contact(foe); path = [[blk.x, blk.y], [tx, ty]]; } else tx = LE;
    } else if (st === 'skirmish') {
      const T = 8, ph = ((t + blk.ph * 2) % T) / T; spd = F.spd * 1.6;
      if (ph < 0.42) { mode = 'skirmish'; tx = home.x + dir * 24; } else if (ph < 0.6) { mode = 'fire'; tx = blk.x; } else { mode = 'retreat'; tx = home.x - dir * 30; spd = F.spd * 1.2; }
      ty = home.y + Math.sin(t * 1.1 + blk.ph) * 6;
    } else if (st === 'barrage') { mode = b.day <= 3 ? 'hold' : 'advance'; if (dist < 150) mode = 'fire'; }
    else if (st === 'hold') { mode = att ? (dist < 160 ? 'fire' : 'advance') : 'hold'; if (!att && dist < 160) mode = 'fire'; if (mode === 'fire' && att && typeof bvWantsAssault === 'function' && bvWantsAssault(V, b, blk, st, att, foe, dt)) { mode = 'charge'; spd = F.spd * 1.9; [tx, ty] = contact(foe); path = [[blk.x, blk.y], [tx, ty]]; blk.asl = true; } }
    else { mode = dist < 150 ? 'fire' : 'advance'; if (att) tx += dir * Math.max(0, Math.sin(t * 1.0 + blk.ph)) * 8; if (mode === 'fire' && typeof bvWantsAssault === 'function' && bvWantsAssault(V, b, blk, st, att, foe, dt)) { mode = 'charge'; spd = F.spd * 1.9; [tx, ty] = contact(foe); path = [[blk.x, blk.y], [tx, ty]]; blk.asl = true; } }
    if (engaged && (st === 'charge' || boosting) && mode !== 'retreat' && mode !== 'recoil') { if (mode !== 'gallop') mode = 'melee'; if (mode === 'melee') { tx = blk.x; ty = blk.y; } }
    else if (engaged && mode === 'gallop') { /* la carga de caballería choca y vuelve */ }
    else if (engaged && blk.asl && mode !== 'retreat' && mode !== 'recoil') { mode = 'melee'; tx = blk.x; ty = blk.y; }
    else if (engaged && foe && foe.foe === blk && (foe.mode === 'melee' || foe.mode === 'charge' || foe.mode === 'gallop') && mode !== 'retreat' && mode !== 'recoil') { mode = 'melee'; tx = blk.x; ty = blk.y; }      // quien recibe la carga responde cuerpo a cuerpo
  }
  if (blk.d.stay && blk.role === 'line' && !V.over && !b.prep && !(blk.venge > V.t) && mode !== 'retreat' && mode !== 'rout') {       // «mantener posición»: solo se mueve ante una necesidad ofensiva
    const s0 = blk.d.stay, near = foe && foe.role !== 'reserve' && dist < 110;
    if (!near) { if (['advance', 'charge', 'flank', 'gallop', 'skirmish', 'fixing', 'melee', 'recoil'].includes(mode) || mode === 'hold' || mode === 'fire') { mode = foe && dist < 170 ? 'fire' : 'hold'; tx = s0.x; ty = s0.y; path = null; spd = F.spd * 1.2; } }
  }
  if (mode !== 'charge' && mode !== 'melee') blk.asl = false; if (mode !== 'fire') blk.fireT = 0;
  blk.path = path;
  // ---- movimiento (el terreno frena: vado, bosque, cuesta) ----
  if (blk.enter) { if ((blk.edge ? Math.hypot(blk.x - home.x, blk.y - home.y) : Math.abs(blk.x - home.x)) > 90) { spd *= 2.8; if (mode === 'hold' || mode === 'reserve' || mode === 'artfire') { mode = 'advance'; tx = home.x; ty = home.y; } } else blk.enter = false; }       // los refuerzos entran por el margen
  if (blk.corps && blk.corps.nl > 1 && blk.role === 'line' && !blk.d.plan && !(b.cplan && b.cplan[blk.corps.id])) {       // la línea avanza unida: nadie se adelanta ni se rezaga
    const chg = mode === 'charge' && dist > 95 && blk.type === 'inf';
    if (mode === 'advance' || mode === 'fire' || chg) { const ref = V.sideCx && V.sideCx[side] !== undefined ? V.sideCx[side] : blk.corps.cx, lead = (blk.x - ref) * dir, th = chg ? 6 : 10; if (lead > th) spd *= chg ? 0.22 : 0.35; else if (lead < -th) spd *= chg ? 1.4 : 1.35; }
  }       // avance en línea
  blk.terr = bvTerrAt(V.tf, blk.x, blk.y, side); if (b.forts && typeof tacFortAt === 'function' && tacFortAt(b, blk.x, blk.y)) blk.terr.cover = true; spd *= blk.terr.slow;
  if (blk.terr.water && (blk.sp || 0) > 5 && Math.random() < dt * 14) bvPart(V, {k: 'splash', x: blk.x + rnd(-blk.dep / 2, blk.dep / 2), y: blk.y + rnd(-blk.wid / 2, blk.wid / 2), life: 0.6});
  if (typeof tacWaypoint === 'function') { const wp = tacWaypoint(V.tf, blk, tx, ty); if (wp) { tx = wp[0]; ty = wp[1]; } }
  const wasW = blk.terr && blk.terr.water;
  const dx = tx - blk.x, dy = ty - blk.y, d = Math.hypot(dx, dy) || 1, want = Math.min(spd, d * 2.4);
  blk.vx += (dx / d * want - blk.vx) * Math.min(1, dt * 2.6); blk.vy += (dy / d * want - blk.vy) * Math.min(1, dt * 2.6);
  if (!blk.init) { blk.init = true; const off = b.day > 1 ? 0 : 260; if (blk.enter) { if (blk.edge) { blk.x = clamp(home.x - dir * 20 + rnd(-40, 40), 20, BV_W - 20); blk.y = blk.edge === 'top' ? 36 : BV_H - 24; } else { blk.x = dir > 0 ? 6 : BV_W - 6; blk.y = home.y + rnd(-8, 8); } } else { blk.x = home.x - dir * off + rnd(-8, 8); blk.y = home.y + rnd(-10, 10); } blk.figs.forEach(f => { const s = bvSlot(blk, f); f.x = s[0] + rnd(-3, 3); f.y = s[1] + rnd(-3, 3); }); }
  blk.x += blk.vx * dt; blk.y += blk.vy * dt; blk.y = clamp(blk.y, 30, BV_H - 22);
  if (!wasW && V.tf && bvTerrAt(V.tf, blk.x, blk.y, side).water) { blk.x -= blk.vx * dt; blk.y -= blk.vy * dt; blk.vx *= 0.15; blk.vy *= 0.15; }       // no se cruza el agua fuera de los vados
  const sp = Math.hypot(blk.vx, blk.vy); blk.sp = sp;
  // orientación: hacia el enemigo cuando está cerca; hacia donde marcha en las maniobras
  let wantH = dir > 0 ? 0 : Math.PI;
  if (mode === 'flank' || mode === 'gallop' || (mode === 'charge' && sp > 8)) wantH = Math.atan2(blk.vy, blk.vx);
  else if (blk.foe && dist < 220 && blk.role !== 'reserve') wantH = Math.atan2(blk.foe.y - blk.y, blk.foe.x - blk.x);
  else if (mode === 'retreat' && blk.role !== 'line') wantH = dir > 0 ? 0 : Math.PI;
  else if (mode === 'retreat' || mode === 'recoil') wantH = dir > 0 ? 0 : Math.PI;      // se repliegan de cara al enemigo
  if (pp && pp.hd !== undefined && mode !== 'melee' && mode !== 'charge') wantH = pp.hd;
  blk.hd += clamp(bvAng(blk.hd, wantH), -2.2 * dt, 2.2 * dt);
  // el bloque atacado por un flanco se vuelve hacia el agresor
  if (mode === 'melee' && blk.foe && blk.foe.fs === 2 && blk.foe.foe === blk) blk.hd += clamp(bvAng(blk.hd, Math.atan2(blk.foe.y - blk.y, blk.foe.x - blk.x)), -1.4 * dt, 1.4 * dt);
  blk.mode = mode; blk.engT = mode === 'melee' || mode === 'charge' ? blk.engT + dt : 0;
  // polvo de la marcha
  if (sp > 14 && Math.random() < dt * 9) bvPart(V, {k: 'dust', x: blk.x - Math.cos(blk.hd) * blk.dep / 2, y: blk.y + rnd(-blk.wid / 2, blk.wid / 2) + 3, life: 0.9, r: 2 + sp / 20});
}
// separación entre bloques (no se solapan salvo los que están trabados en combate)
function bvSeparate(all, dt) {
  for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) {
    const a = all[i], c = all[j]; if (a.side === c.side && ((a.d.cust && a.d.cust.fort) || (c.d.cust && c.d.cust.fort))) continue; if (a.side !== c.side && (a.mode === 'melee' || c.mode === 'melee' || a.mode === 'charge' || c.mode === 'charge' || a.mode === 'gallop')) continue;
    const ox = (a.dep + c.dep) / 2 - Math.abs(a.x - c.x), oy = (a.wid + c.wid) / 2 - Math.abs(a.y - c.y);
    if (ox > 0 && oy > 0) { const push = Math.min(ox, oy) * 0.5 * Math.min(1, dt * 4); if (oy <= ox) { const s = a.y < c.y ? -1 : 1; a.y += s * push; c.y -= s * push; } else { const s = a.x < c.x ? -1 : 1; a.x += s * push * 0.6; c.x -= s * push * 0.6; } }
  }
}
function bvStepFigs(V, b, blk, dt, ghost) {
  const moving = (blk.sp || 0) > 8, engaged = blk.mode === 'melee' || blk.mode === 'charge' || blk.mode === 'gallop', t = V.t;
  blk.figs.forEach(f => {
    if (f.dying > 0) { f.dying -= dt; return; }
    if (!f.alive) return;
    f.flash = Math.max(0, f.flash - dt); f.recoil = Math.max(0, f.recoil - dt * 4);
    if (f.flee > 0) {       // huida descontrolada
      f.flee -= dt; f.vx += (f.fvx - f.vx) * Math.min(1, dt * 3); f.vy += (f.fvy - f.vy + rnd(-50, 50)) * Math.min(1, dt * 3); f.x += f.vx * dt; f.y += f.vy * dt;
      if (Math.random() < dt * 4) bvPart(V, {k: 'dust', x: f.x, y: f.y + 3, life: 0.6, r: 2});
      if (f.x < -30 || f.x > BV_W + 30 || f.y < 12 || f.y > BV_H - 6) { f.alive = false; f.dying = 0; f.gone = true; }
      return;
    }
    if (ghost) return;
    const s = bvSlot(blk, f); let sx = s[0], sy = s[1];
    if (engaged && f.kind === 'sol' && Math.floor(f.k / blk.F.cols) === 0) { const c = Math.cos(blk.hd), sn = Math.sin(blk.hd), lunge = Math.max(0, Math.sin(t * 8 + f.ph)) * 3.5; sx += c * lunge; sy += sn * lunge; if (Math.random() < dt * 1.2) bvPart(V, {k: 'spark', x: sx + c * 4, y: sy + sn * 4, life: 0.35, hot: 1}); }
    if (moving && f.kind !== 'gun') { sx += Math.sin(t * 9 + f.ph) * 0.6; sy += Math.cos(t * 7 + f.ph) * 0.5; } else if (f.kind !== 'gun') { sx += Math.sin(t * 1.3 + f.ph) * 0.5; sy += Math.cos(t * 1.1 + f.ph * 2) * 0.4; }
    const k = Math.min(1, dt * (moving ? 5 : 7)); f.x += (sx - f.x) * k; f.y += (sy - f.y) * k;
  });
}
/* ---------- fuego de fusilería y artillería ---------- */
function bvFire(V, b, blk, dt, foes) {
  if (blk.mode === 'rout' || blk.mode === 'retreat' || V.over && V.over.loser === blk.side) return;
  if (blk.type === 'art' && typeof tacArtFire === 'function') { tacArtFire(V, b, blk, dt, foes); return; }
  const dir = blk.side === 'A' ? 1 : -1, st = bvStratC(V, b, blk), foe = blk.foe; if (!foe) return;
  const alive = blk.figs.filter(f => f.alive && !f.flee); if (!alive.length) return;
  const fd = Math.hypot(foe.x - blk.x, foe.y - blk.y);
  if (blk.type === 'art') {
    const heavy = st === 'barrage' || V.salvo[blk.side] > 0; blk.cd -= dt;
    if (blk.cd <= 0 && fd < 420) { blk.cd = heavy ? rnd(0.9, 1.5) : rnd(3, 5); const guns = alive.filter(f => f.kind === 'gun'); if (!guns.length) return; const gn = guns[Math.floor(Math.random() * guns.length)];
      const tgt = V.blocks.size ? pickFoeFig(foe) : null, tx = (tgt ? tgt.x : foe.x) + rnd(-14, 14), ty = (tgt ? tgt.y : foe.y) + rnd(-14, 14);
      bvPart(V, {k: 'shell', x: gn.x, y: gn.y, x2: tx, y2: ty, life: 0.85, s: blk.side}); gn.recoil = 1; bvPart(V, {k: 'flash', x: gn.x + Math.cos(blk.hd) * 12, y: gn.y + Math.sin(blk.hd) * 12, life: 0.14, big: 1});
      for (let n = 0; n < 3; n++) bvPart(V, {k: 'smoke', x: gn.x + Math.cos(blk.hd) * 12, y: gn.y + Math.sin(blk.hd) * 12, life: 2.2, r: 5, vx: dir * 8 + V.wind * 0.5 + rnd(-4, 4)}); }
    return;
  }
  if (blk.type !== 'inf' && blk.type !== 'cav' && blk.type !== 'tank') return;
  if (blk.mode === 'melee' || blk.mode === 'charge' || blk.mode === 'gallop' || blk.mode === 'recoil') return;
  const wl = typeof bvWeap === 'function' ? bvWeap(blk) : 1; if (fd > 190 * WEAP_RANGE[wl] * (blk._wxr || 1)) return;
  const rate = WEAP_RATE[wl] * (st === 'skirmish' ? 7 : st === 'hold' ? 5 : 4) * alive.length * 0.22 * (blk.type === 'cav' ? 0.3 : blk.type === 'tank' ? 0.5 : 1) * (blk.mode === 'fire' ? 1.6 : 0.7);
  blk.fireAcc += dt * rate;
  while (blk.fireAcc > 1) { blk.fireAcc--;
    const front = alive.filter(f => f.kind === 'sol' && Math.floor(f.k / blk.F.cols) <= 1), pool = front.length ? front : alive, u = pool[Math.floor(Math.random() * pool.length)], tg = pickFoeFig(foe); if (!tg) break;
    const face = Math.cos(blk.hd) >= 0 ? 1 : -1, fx = blk.x + face * (blk.dep / 2 + 1), fy = blk.y + rnd(-blk.wid / 2, blk.wid / 2); blk.fireAt = performance.now();
    bvPart(V, {k: 'flash', x: fx + face * 2, y: fy, life: 0.14, big: 1}); if (!(typeof smokeless === 'function' && smokeless(blk.tag))) { bvPart(V, {k: 'smoke', x: fx + face * 4, y: fy - 1, life: 2.1, r: 6, vx: dir * 6 + V.wind * 0.6}); bvPart(V, {k: 'smoke', x: fx + face * 9, y: fy + rnd(-3, 3), life: 1.5, r: 4, vx: dir * 7 + V.wind * 0.6}); } bvPart(V, {k: 'tracer', x: fx, y: fy, x2: tg.x, y2: tg.y + rnd(-3, 3), life: 0.1}); u.flash = 0.12; if (typeof SFX !== 'undefined') SFX.volley(); }
}
function pickFoeFig(blk) { const l = blk.figs.filter(f => f.alive); return l.length ? l[Math.floor(Math.random() * l.length)] : null; }
/* ---------- bucle ---------- */
function bvFrame(V, b, ctx, now) {
  if (V.replay) { bvReplayFrame(V, b, ctx, now); return; }
  const dt = Math.min(0.05, (now - V.last) / 1000) * (V.ts === undefined ? 1 : V.ts); V.last = now; V.t += dt;
  if (b.day !== V.day) { V.day = b.day; V.dayT = now; }
  V.adv += ((b.adv || 0) - V.adv) * Math.min(1, dt * 2.2);
  if ((b.evSeq || 0) !== V.evSeq) { V.evSeq = b.evSeq; bvEvent(V, b, b.evK, b.evS); }
  if (!b.ended) bvSync(V, b); else if (!V.over) {
    const log = (G.battleLog || []).find(x => x.id === b.id), loserSide = log && log.winner === b.A0 ? 'B' : 'A';
    V.over = {loser: loserSide, t: 0}; bvBanner(V, `Victoria de ${G.C[loserSide === 'A' ? b.B0 : b.A0].name}`, loserSide === 'A' ? 'B' : 'A', '🏳️');
    V.blocks.forEach(blk => { if (blk.side === loserSide) blk.figs.forEach(f => { if (f.alive && !f.flee && Math.random() < 0.75) bvFlee(V, blk, f, 1.3); }); });
  }
  if (V.over) V.over.t += dt;
  ['A', 'B'].forEach(s => { if (V.boost[s] > 0) V.boost[s] -= dt; if (V.panic[s] > 0) V.panic[s] -= dt; if (V.salvo[s] > 0) V.salvo[s] -= dt; if (V.man[s]) { V.man[s].t += dt; if (V.man[s].t > V.man[s].dur) V.man[s] = null; } });
  if (V.rain > 0) V.rain -= dt; if (V.shake > 0) V.shake = Math.max(0, V.shake - dt * 6);
  if (V.gas) { V.gas.t += dt; const gs = V.gas.side, gd = gs === 'A' ? 1 : -1, x0 = BV_W / 2 + V.adv * 100; if (Math.random() < dt * 22) bvPart(V, {k: 'gas', x: x0 - gd * 90 + rnd(-20, 20), y: rnd(50, BV_H - 36), life: 6, r: rnd(14, 24), vx: gd * rnd(16, 26)}); if (V.gas.t > V.gas.dur) V.gas = null; }
  V.tf = battleTerrain(b);
  const lines = {A: bvLine(V, b, 'A'), B: bvLine(V, b, 'B')}, all = [...V.blocks.values()];
  if (!V.over) bvRelief(V, b, dt);
  if (typeof bvCorpsUpdate === 'function') bvCorpsUpdate(V);
  all.forEach(blk => bvStepBlock(V, b, blk, dt * (typeof bvSpeedMul === 'function' ? bvSpeedMul(V, b, blk) : 1), lines, all)); bvSeparate(all, dt); if (typeof bvGround === 'function') bvGround(V, b, all, dt);
  if (typeof tacThink === 'function') tacThink(V, b, all, dt);
  if (typeof tacMorale === 'function') { tacMorale(V, b, all, dt); V._pfx = (V._pfx || 0) + dt; if (V._pfx > 1) { V._pfx = 0; tacPlanFx(V, b, all); } }
  all.forEach(blk => bvStepFigs(V, b, blk, dt)); V.ghosts.forEach(blk => bvStepFigs(V, b, blk, dt, true));
  V.ghosts = V.ghosts.filter(blk => blk.figs.some(f => f.alive || f.dying > 0));
  if (!b.ended) all.forEach(blk => bvFire(V, b, blk, dt, all));
  // moral baja: algunos soldados rompen filas
  ['A', 'B'].forEach(s => { const org = s === 'A' ? b.orgA : b.orgB;
    if (!b.ended && org !== undefined && org < 0.15 && Math.random() < dt * 1.2) { const c = all.filter(x => x.side === s && x.role === 'line' && !(x.d.cust && x.d.cust.fort)); if (c.length) { const blk = c[Math.floor(Math.random() * c.length)], fs = blk.figs.filter(f => f.alive && !f.flee); if (fs.length) bvFlee(V, blk, fs[Math.floor(Math.random() * fs.length)], 1); } } });
  // partículas
  V.parts.forEach(p => { p.age += dt; if (p.k === 'smoke') { p.x += (p.vx || 0) * dt; p.y -= 6 * dt; } if (p.k === 'dust') { p.y -= 4 * dt; p.x += V.wind * 0.3 * dt; }
    if (p.k === 'gas') { p.x += p.vx * dt; p.y += Math.sin(p.age * 1.4 + p.x * 0.02) * 4 * dt; }
    if (p.k === 'shell' && p.age >= p.life && !p.hit) { p.hit = true; (V.craters = V.craters || []).push({x: p.x2, y: p.y2, r: 2.5 + Math.random() * 3}); if (V.craters.length > 90) V.craters.shift(); if (p.vt && typeof tacShellHit === 'function') tacShellHit(V, b, p, all); bvPart(V, {k: 'boom', x: p.x2, y: p.y2, life: 0.6}); bvPart(V, {k: 'smoke', x: p.x2, y: p.y2, life: 2.8, r: 7, vx: rnd(-5, 5) + V.wind * 0.5});
      for (let n = 0; n < 5; n++) bvPart(V, {k: 'spark', x: p.x2 + rnd(-8, 8), y: p.y2 + rnd(-8, 8), life: 0.45, hot: 1});
      all.forEach(blk => { if (blk.side === p.s) return; blk.figs.forEach(f => { if (f.alive && !f.flee && Math.hypot(f.x - p.x2, f.y - p.y2) < 26) { f.x += (f.x - p.x2) * 0.45; f.y += (f.y - p.y2) * 0.45; } }); }); } });
  V.parts = V.parts.filter(p => p.age < p.life + (p.k === 'shell' ? 0.05 : 0));
  V.corpses.forEach(c => c.age += dt); all.forEach(blk => { blk.figs = blk.figs.filter(f => !f.gone && (f.alive || f.dying > 0 || f.flee > 0)); });
  V.rings.forEach(r => r.age += dt); V.rings = V.rings.filter(r => r.age < r.life);
  if (V.banner) { V.banner.age += dt; if (V.banner.age > 2.8) V.banner = null; }
  if (V.sel && !V.blocks.has(V.sel.d)) V.sel = null;
  bvCamStep(V, dt); bvHover(V, all);
  if (!V.over || V.over.t < 8) bvRecSnap(V, b, all, lines);
  bvDraw(V, b, ctx, lines, all);
}
/* ---------- cámara: zoom, desplazamiento y seguimiento ---------- */
const bvToWorld = (V, sx, sy) => [(sx - BV_W / 2) / V.cam.z + V.cam.x, (sy - BV_H / 2) / V.cam.z + V.cam.y];
function bvClampCam(V) { const c = V.cam; c.z = clamp(c.z, 1, 5.5); const hx = BV_W / 2 / c.z, hy = BV_H / 2 / c.z; c.x = clamp(c.x, hx, BV_W - hx); c.y = clamp(c.y, hy, BV_H - hy); }
function bvCamStep(V, dt) {
  const c = V.cam; if (V.follow) { const tg = V.sel || V.hover || null; if (tg) { c.z += (Math.max(c.z, 2) - c.z) * Math.min(1, dt * 3); c.x += (tg.x - c.x) * Math.min(1, dt * 4); c.y += (tg.y - c.y) * Math.min(1, dt * 4); } }
  bvClampCam(V);
}
function bvZoomAt(V, factor, sx, sy) { const c = V.cam, [wx, wy] = bvToWorld(V, sx === undefined ? BV_W / 2 : sx, sy === undefined ? BV_H / 2 : sy); c.z = clamp(c.z * factor, 1, 5.5); const sxx = sx === undefined ? BV_W / 2 : sx, syy = sy === undefined ? BV_H / 2 : sy; c.x = wx - (sxx - BV_W / 2) / c.z; c.y = wy - (syy - BV_H / 2) / c.z; bvClampCam(V); }
function bvHover(V, all) {
  V.hover = null; if (!V.mouse) return; const [wx, wy] = bvToWorld(V, V.mouse.x, V.mouse.y); let bd = 1e9;
  all.forEach(blk => { const d = Math.hypot(blk.x - wx, blk.y - wy), r = Math.max(blk.dep, blk.wid) / 2 + 6; if (d < r && d < bd) { bd = d; V.hover = blk; } });
}
/* ---------- trincheras ---------- */
function bvTrenchLevel(V, b, side) {
  let lv = 0; (side === 'A' ? b.A : b.B).forEach(id => { const a = armyById(id); if (a) lv = Math.max(lv, a.dig || 0); }); return lv;
}
function bvTrenches(g, V, b, lines) {
  if (G.date.y < 1900) return;                  // sin trincheras de campaña hasta 1900
  const side = b.att === 'A' ? 'B' : 'A', dir = side === 'A' ? 1 : -1; V.dig = V.dig || {A: 0, B: 0}; if (V.t - (V.digT || -9) > 0.5) { V.digT = V.t; V.dig[side] = bvTrenchLevel(V, b, side); }
  const lv = V.dig[side]; if (lv < 2) return; const tech = G.C[side === 'A' ? b.A0 : b.B0] && hasTech(G.C[side === 'A' ? b.A0 : b.B0], 'trench_warfare');
  const x = lines[side] - dir * 18, w = 5 + lv * (tech ? 0.7 : 0.4), top = 46, bot = BV_H - 28;
  const path = () => { g.beginPath(); for (let y = top, i = 0; y <= bot; y += 14, i++) { const px = x + (tech ? (i % 2 ? 4 : -4) : 0); i ? g.lineTo(px, y) : g.moveTo(px, y); } };
  g.lineCap = 'butt'; g.lineJoin = 'miter'; g.strokeStyle = 'rgba(40,28,16,.55)'; g.lineWidth = w + 5; path(); g.stroke(); g.strokeStyle = tech ? '#2a1d12' : '#4a3a28'; g.lineWidth = w; path(); g.stroke();
  g.fillStyle = 'rgba(176,150,98,.85)'; for (let y = top; y <= bot; y += 9) { g.beginPath(); g.ellipse(x + dir * (w / 2 + 3), y, 3, 2, 0, 0, 6.3); g.fill(); }
  if (tech && lv >= 4) { const wx = x + dir * 30; g.strokeStyle = 'rgba(190,190,200,.7)'; g.lineWidth = 0.9; g.beginPath(); g.moveTo(wx, top); g.lineTo(wx, bot); g.stroke(); for (let y = top; y <= bot; y += 10) { g.beginPath(); g.moveTo(wx - 3, y - 3); g.lineTo(wx + 3, y + 3); g.moveTo(wx - 3, y + 3); g.lineTo(wx + 3, y - 3); g.stroke(); } }
}
/* ---------- dibujo ---------- */
// terreno prerrenderizado una sola vez por batalla (más resolución para poder acercar la cámara)
function bvBuildBg(V, b) {
  const S = 3, cv = document.createElement('canvas'); cv.width = BV_W * S; cv.height = BV_H * S; const g = cv.getContext('2d'); g.scale(S, S);
  const pv = MAP.provs[b.prov], bio = pv.biome, bc = BIOME_COL[bio] || [110, 140, 85], H = (i, k) => hash2(i, V.seed, k), rgb = (m, a) => `rgba(${Math.min(255, bc[0] * m | 0)},${Math.min(255, bc[1] * m | 0)},${Math.min(255, bc[2] * m | 0)},${a})`;
  const grd = g.createLinearGradient(0, 0, 0, BV_H); grd.addColorStop(0, rgb(0.86, 1)); grd.addColorStop(0.5, rgb(0.74, 1)); grd.addColorStop(1, rgb(0.58, 1)); g.fillStyle = grd; g.fillRect(0, 0, BV_W, BV_H);
  for (let i = 0; i < 150; i++) { const x = H(i, 1) * BV_W, y = H(i, 2) * BV_H, r = 18 + H(i, 3) * 60, m = 0.7 + H(i, 4) * 0.5, rg = g.createRadialGradient(x, y, 0, x, y, r); rg.addColorStop(0, rgb(m, 0.22)); rg.addColorStop(1, rgb(m, 0)); g.fillStyle = rg; g.fillRect(x - r, y - r, r * 2, r * 2); }
  if (bio === 1 || bio === 4 || bio === 5) { for (let i = 0; i < 700; i++) { const x = H(i, 5) * BV_W, y = 24 + H(i, 6) * (BV_H - 24); g.strokeStyle = H(i, 7) > 0.5 ? rgb(0.62, 0.35) : rgb(1.2, 0.3); g.lineWidth = 1; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (H(i, 8) - 0.5) * 3, y - 2 - H(i, 9) * 3); g.stroke(); } }
  if (bio === 1) { for (let i = 0; i < 5; i++) { const x = (i % 2 ? 0.02 : 0.74) * BV_W + H(i, 20) * 60, y = 34 + H(i, 21) * (BV_H - 130), w = 120 + H(i, 22) * 90, h = 50 + H(i, 23) * 40; g.fillStyle = `rgba(${150 + H(i, 24) * 60 | 0},${160 + H(i, 25) * 40 | 0},70,.16)`; g.fillRect(x, y, w, h); g.strokeStyle = 'rgba(70,55,30,.25)'; g.lineWidth = 1; g.strokeRect(x, y, w, h); for (let r = 0; r < h; r += 7) { g.strokeStyle = 'rgba(60,70,30,.16)'; g.beginPath(); g.moveTo(x, y + r); g.lineTo(x + w, y + r); g.stroke(); } } }
  if (bio === 3) { for (let i = 0; i < 40; i++) { const x = H(i, 5) * BV_W, y = 26 + H(i, 6) * (BV_H - 30); g.strokeStyle = 'rgba(120,90,50,.22)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 24, y - 6, x + 52, y); g.stroke(); } }
  if (bio === 8) { for (let i = 0; i < 240; i++) { g.fillStyle = 'rgba(255,255,255,.5)'; g.fillRect(H(i, 5) * BV_W, H(i, 6) * BV_H, 1.5, 1.5); } }
  // camino de tierra que cruza el campo
  const ry = BV_H * (0.58 + (H(1, 31) - 0.5) * 0.22); g.strokeStyle = 'rgba(96,78,48,.42)'; g.lineWidth = 15; g.lineCap = 'round'; g.beginPath(); g.moveTo(-10, ry + 14); g.bezierCurveTo(BV_W * 0.3, ry - 30, BV_W * 0.6, ry + 40, BV_W + 10, ry - 8); g.stroke();
  g.strokeStyle = 'rgba(140,118,78,.28)'; g.lineWidth = 8; g.beginPath(); g.moveTo(-10, ry + 14); g.bezierCurveTo(BV_W * 0.3, ry - 30, BV_W * 0.6, ry + 40, BV_W + 10, ry - 8); g.stroke();
  const tree = (x, y, r, dark) => { g.fillStyle = 'rgba(0,0,0,.22)'; g.beginPath(); g.ellipse(x + 3, y + r * 0.7, r * 1.05, r * 0.45, 0, 0, 6.3); g.fill(); g.fillStyle = dark ? 'rgba(26,62,34,1)' : 'rgba(44,92,48,1)'; g.beginPath(); g.arc(x, y, r, 0, 6.3); g.fill(); g.fillStyle = dark ? 'rgba(48,92,52,.9)' : 'rgba(84,136,70,.9)'; g.beginPath(); g.arc(x - r * 0.25, y - r * 0.3, r * 0.62, 0, 6.3); g.fill(); };
  // rasgos reales del terreno de esta batalla: colina, bosques, río con vados y granja
  const tf = battleTerrain(b);
  if (tf.hill) { const h = tf.hill, rg = g.createRadialGradient(h.x - h.rx * 0.2, h.y - h.ry * 0.25, 8, h.x, h.y, Math.max(h.rx, h.ry)); rg.addColorStop(0, 'rgba(238,224,172,.45)'); rg.addColorStop(0.6, 'rgba(150,126,76,.32)'); rg.addColorStop(1, 'rgba(80,60,34,0)'); g.fillStyle = rg; g.beginPath(); g.ellipse(h.x, h.y, h.rx * 1.14, h.ry * 1.1, 0, 0, 6.3); g.fill();
    g.fillStyle = 'rgba(40,28,14,.13)'; g.beginPath(); g.ellipse(h.x + 10, h.y + 14, h.rx * 0.9, h.ry * 0.88, 0, 0, 6.3); g.fill(); g.strokeStyle = 'rgba(252,238,186,.24)'; g.lineWidth = 1.2; for (let i = 0; i < 5; i++) { g.beginPath(); g.ellipse(h.x, h.y, h.rx * (1 - i * 0.18), h.ry * (1 - i * 0.18), 0, 0, 6.3); g.stroke(); } }
  tf.forests.forEach((f, fi) => { const n = Math.round(f.r * 0.8); for (let i = 0; i < n; i++) { const a = H(i + fi * 200, 70) * 6.283, d = Math.sqrt(H(i + fi * 200, 71)) * f.r; tree(f.x + Math.cos(a) * d, f.y + Math.sin(a) * d * 0.8, 4.5 + H(i + fi * 200, 72) * 5.5, bio === 6); } });
  if (tf.river) { const r = tf.river, pts = []; for (let y = -10; y <= BV_H + 10; y += 6) pts.push([r.x + Math.sin(y / 70 + r.ph) * r.amp, y]);
    const path = () => { g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); };
    g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = 'rgba(96,78,50,.55)'; g.lineWidth = r.w + 10; path(); g.stroke(); g.strokeStyle = 'rgba(52,104,146,.92)'; g.lineWidth = r.w; path(); g.stroke(); g.strokeStyle = 'rgba(150,196,228,.45)'; g.lineWidth = r.w * 0.45; path(); g.stroke(); g.strokeStyle = 'rgba(235,248,255,.35)'; g.lineWidth = 1; for (let i = 0; i < 40; i++) { const y = H(i, 80) * BV_H, x = r.x + Math.sin(y / 70 + r.ph) * r.amp + (H(i, 81) - 0.5) * r.w * 0.6; g.beginPath(); g.moveTo(x - 4, y); g.lineTo(x + 4, y + 1); g.stroke(); }
    r.fords.forEach(f => { const x = r.x + Math.sin(f.y / 70 + r.ph) * r.amp; g.fillStyle = 'rgba(176,152,108,.8)'; g.fillRect(x - r.w / 2 - 8, f.y - f.w / 2, r.w + 16, f.w); g.fillStyle = 'rgba(120,98,64,.5)'; for (let i = 0; i < 14; i++) g.fillRect(x - r.w / 2 - 6 + H(i + f.y, 82) * (r.w + 12), f.y - f.w / 2 + H(i + f.y, 83) * f.w, 3, 2); g.strokeStyle = 'rgba(70,52,30,.5)'; g.lineWidth = 1; g.strokeRect(x - r.w / 2 - 8, f.y - f.w / 2, r.w + 16, f.w); }); }
  if (tf.farm) { const f = tf.farm, x = f.x - f.w / 2, y = f.y - f.h / 2; g.fillStyle = 'rgba(0,0,0,.28)'; g.fillRect(x + 5, y + 5, f.w, f.h); g.fillStyle = '#a58a62'; g.fillRect(x, y, f.w, f.h); g.fillStyle = '#7a3a2a'; g.beginPath(); g.moveTo(x - 4, y); g.lineTo(x + f.w / 2, y - 15); g.lineTo(x + f.w + 4, y); g.fill(); g.fillStyle = '#3a2a1c'; g.fillRect(x + f.w / 2 - 4, y + f.h - 14, 8, 14); g.strokeStyle = 'rgba(90,66,40,.7)'; g.lineWidth = 1.2; g.strokeRect(x - 12, y - 10, f.w + 24, f.h + 20); }
  if (typeof tacBgExtras === 'function') tacBgExtras(g, V, b, H);
  // vegetación y rocas por bioma
  const nT = bio === 2 || bio === 6 ? 50 : bio === 1 ? 14 : bio === 4 ? 9 : 5;
  for (let i = 0; i < nT; i++) { const band = H(i, 40) < 0.7, x = H(i, 41) * BV_W, y = band ? (H(i, 42) < 0.5 ? 26 + H(i, 43) * 52 : BV_H - 16 - H(i, 43) * 48) : 70 + H(i, 44) * (BV_H - 140); if (Math.abs(y - ry) < 14 && bio !== 6) continue; tree(x, y, 5 + H(i, 45) * 7, bio === 6); }
  if (bio === 7 || bio === 8) { for (let i = 0; i < 16; i++) { const x = H(i, 51) * BV_W, y = H(i, 52) < 0.5 ? 24 + H(i, 53) * 54 : BV_H - 20 - H(i, 53) * 50, w = 16 + H(i, 54) * 30; g.fillStyle = 'rgba(40,36,34,.35)'; g.beginPath(); g.moveTo(x - w, y + w * 0.5); g.lineTo(x - w * 0.2, y - w * 0.9); g.lineTo(x + w * 0.3, y - w * 0.4); g.lineTo(x + w, y + w * 0.5); g.closePath(); g.fill(); g.fillStyle = bio === 8 ? 'rgba(255,255,255,.55)' : 'rgba(200,190,170,.35)'; g.beginPath(); g.moveTo(x - w * 0.2, y - w * 0.9); g.lineTo(x + w * 0.3, y - w * 0.4); g.lineTo(x - w * 0.25, y - w * 0.3); g.closePath(); g.fill(); } }
  // una granja o ruina en un extremo
  const vg = g.createRadialGradient(BV_W / 2, BV_H / 2, BV_H * 0.4, BV_W / 2, BV_H / 2, BV_W * 0.62); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.42)'); g.fillStyle = vg; g.fillRect(0, 0, BV_W, BV_H);
  return cv;
}
function bvPlate(g, blk, hover) {
  const c = Math.cos(blk.hd), s = Math.sin(blk.hd), hw = blk.dep / 2 + 2, hh = blk.wid / 2 + 2, pr = (x, y) => [blk.x + c * x - s * y, blk.y + s * x + c * y];
  const P = [pr(-hw, -hh), pr(hw, -hh), pr(hw, hh), pr(-hw, hh)], orgF = clamp(blk.d.o / DIVS[blk.d.t].org, 0, 1), eng = blk.mode === 'melee' || blk.mode === 'charge' || blk.mode === 'gallop';
  g.beginPath(); P.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.closePath();
  g.globalAlpha = blk.role === 'reserve' ? 0.1 : 0.17; g.fillStyle = blk.color; g.fill(); g.globalAlpha = 1;
  g.lineWidth = hover ? 1.8 : 1; g.strokeStyle = eng ? `rgba(255,${90 + 60 * Math.sin(performance.now() / 120) | 0},60,.95)` : orgF < 0.3 ? 'rgba(255,130,70,.9)' : hover ? '#fff7d0' : bvShade(blk.color, 0.35); g.globalAlpha = hover ? 1 : 0.7; g.stroke(); g.globalAlpha = 1;
  return P;
}
function bvFig(g, V, blk, f) {
  if (typeof bvFigNew === 'function' && bvFigNew(g, V, blk, f)) return;
  const s = blk.sc, x = f.x, y = f.y, fall = f.dying > 0 ? 1 - f.dying / 0.8 : 0, hd = blk.hd, ca = Math.cos(hd), sa = Math.sin(hd), moving = (blk.sp || 0) > 8 || f.flee > 0, bob = moving ? Math.sin(V.t * 13 + f.ph) * 0.7 : 0, col = blk.color;
  if (fall) g.globalAlpha = 1 - fall * 0.6;
  g.fillStyle = 'rgba(0,0,0,.32)'; g.beginPath(); g.ellipse(x + 0.8, y + 3 * s, 3.6 * s, 1.4 * s, 0, 0, 6.3); g.fill();
  if (f.kind === 'sol' && blk.type === 'inf') {
    const fl = f.flee > 0;
    g.strokeStyle = '#2b2a2e'; g.lineWidth = 1.1 * s; g.beginPath(); g.moveTo(x - ca * 1.5, y - 2.4 * s + bob - sa * 1.5); g.lineTo(x + ca * 7 * s, y - 2.4 * s + bob + sa * 7 * s); g.stroke();       // fusil
    if (f.flash > 0) { g.strokeStyle = 'rgba(255,230,150,.8)'; g.beginPath(); g.moveTo(x + ca * 7 * s, y - 2.4 * s + sa * 7 * s); g.lineTo(x + ca * 11 * s, y - 2.4 * s + sa * 11 * s); g.stroke(); }
    g.fillStyle = bvShade(col, -0.45); g.fillRect(x - 2.5 * s, y - 3.4 * s + bob, 5 * s, 5.6 * s); g.fillStyle = fl ? '#d9cfae' : col; g.fillRect(x - 2.1 * s, y - 3.1 * s + bob, 4.2 * s, 4.8 * s);
    g.fillStyle = 'rgba(255,255,255,.7)'; g.fillRect(x - 2.1 * s, y - 3.1 * s + bob, 4.2 * s, 0.9 * s); g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 0.6 * s; g.beginPath(); g.moveTo(x - 2 * s, y - 3 * s + bob); g.lineTo(x + 2 * s, y + 1.5 * s + bob); g.stroke();
    g.fillStyle = '#e7c9a6'; g.beginPath(); g.arc(x, y - 4.4 * s + bob, 1.55 * s, 0, 6.3); g.fill(); g.fillStyle = '#17181c'; g.fillRect(x - 1.5 * s, y - 6.4 * s + bob, 3 * s, 1.9 * s);
  } else if (f.kind === 'sol' && blk.type === 'tank') {
    const mv = moving ? Math.sin(V.t * 22 + f.ph) * 0.5 : 0;
    g.save(); g.translate(x, y - 2 * s); g.rotate(hd);
    g.fillStyle = '#2a2c27'; g.fillRect(-8 * s, -5.4 * s, 16 * s, 2.6 * s); g.fillRect(-8 * s, 2.8 * s, 16 * s, 2.6 * s);
    g.fillStyle = '#3d3f37'; for (let i = -3; i <= 3; i++) { g.fillRect((i * 2.2 - 0.6 + mv) * s, -5.4 * s, 1.1 * s, 2.6 * s); g.fillRect((i * 2.2 - 0.6 - mv) * s, 2.8 * s, 1.1 * s, 2.6 * s); }
    g.fillStyle = bvShade(col, -0.35); g.fillRect(-7 * s, -3.2 * s, 14 * s, 6.4 * s); g.fillStyle = col; g.fillRect(-6.4 * s, -2.7 * s, 12.8 * s, 5.4 * s);
    g.fillStyle = bvShade(col, -0.2); g.beginPath(); g.arc(0.5 * s, 0, 3.1 * s, 0, 6.3); g.fill(); g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(-6.4 * s, -2.7 * s, 12.8 * s, 0.8 * s);
    g.strokeStyle = '#33363a'; g.lineWidth = 1.6 * s; g.beginPath(); g.moveTo(2 * s, 0); g.lineTo(11.5 * s - f.recoil * 2, 0); g.stroke(); g.restore();
  } else if (f.kind === 'sol') {   // jinete
    const hc = ['#6b4a2b', '#2e2420', '#8b6a44', '#c9c0ae'][Math.floor(f.ph * 3) % 4], an = Math.atan2(blk.vy || sa, blk.vx || ca) * 0.35;
    g.fillStyle = hc; g.beginPath(); g.ellipse(x, y - 2 * s + bob, 7.4 * s, 3.4 * s, an, 0, 6.3); g.fill(); g.fillStyle = bvShade(hc, -0.3); g.beginPath(); g.ellipse(x + ca * 6.2 * s, y - 3.5 * s + bob + sa * 2, 2.4 * s, 1.8 * s, an, 0, 6.3); g.fill();
    if (moving) { g.strokeStyle = bvShade(hc, -0.4); g.lineWidth = 1; const lg = Math.sin(V.t * 18 + f.ph) * 2; g.beginPath(); g.moveTo(x - 3 * s, y + bob); g.lineTo(x - 3 * s + lg, y + 3 * s); g.moveTo(x + 3 * s, y + bob); g.lineTo(x + 3 * s - lg, y + 3 * s); g.stroke(); }
    g.fillStyle = col; g.fillRect(x - 1.8 * s, y - 6.2 * s + bob, 3.6 * s, 4.6 * s); g.fillStyle = '#e7c9a6'; g.beginPath(); g.arc(x, y - 7.2 * s + bob, 1.5 * s, 0, 6.3); g.fill(); g.fillStyle = '#17181c'; g.fillRect(x - 1.4 * s, y - 9 * s + bob, 2.8 * s, 1.7 * s);
    g.strokeStyle = '#dfe3ea'; g.lineWidth = 0.9; g.beginPath(); g.moveTo(x + 1 * s, y - 5 * s + bob); g.lineTo(x + 1 * s + ca * 9 * s, y - 5 * s + bob + sa * 9 * s); g.stroke();
  } else if (f.kind === 'gun') {
    const rc = f.recoil * 3;
    g.fillStyle = '#4a3a28'; g.fillRect(x - 5 * s - ca * rc, y - 2 * s - sa * rc, 10 * s, 4 * s); g.fillStyle = '#2a2018'; g.beginPath(); g.arc(x - 2 * s, y + 2 * s, 2.6 * s, 0, 6.3); g.fill(); g.beginPath(); g.arc(x + 2 * s, y - 2 * s, 2.6 * s, 0, 6.3); g.fill();
    g.strokeStyle = '#4e5359'; g.lineWidth = 3 * s; g.lineCap = 'round'; g.beginPath(); g.moveTo(x - ca * rc, y - 1 * s - sa * rc); g.lineTo(x + ca * 11 * s - ca * rc, y - 1 * s + sa * 11 * s - sa * rc); g.stroke(); g.lineCap = 'butt';
    g.fillStyle = col; g.fillRect(x - 3 * s, y - 3.4 * s, 6 * s, 1.8 * s);
  } else {   // servidor de la pieza
    g.fillStyle = bvShade(col, -0.4); g.fillRect(x - 2.3 * s, y - 3.2 * s + bob, 4.6 * s, 5 * s); g.fillStyle = col; g.fillRect(x - 1.9 * s, y - 2.9 * s + bob, 3.8 * s, 4.2 * s); g.fillStyle = '#e7c9a6'; g.beginPath(); g.arc(x, y - 4.2 * s + bob, 1.4 * s, 0, 6.3); g.fill(); g.fillStyle = '#17181c'; g.fillRect(x - 1.4 * s, y - 5.9 * s + bob, 2.8 * s, 1.6 * s);
  }
  g.globalAlpha = 1;
}
function bvFlag(g, V, blk, over, win) {
  const c = Math.cos(blk.hd), s = Math.sin(blk.hd), bx = blk.x + c * blk.dep / 2 * 0.55, by = blk.y + s * blk.dep / 2 * 0.55 - 3, h = (win ? 20 : 14) * Math.max(0.8, blk.sc), w = (win ? 14 : 11) * Math.max(0.8, blk.sc), wave = Math.sin(V.t * 5 + blk.ph) * 1.6;
  g.strokeStyle = '#2a2a2e'; g.lineWidth = 1.1; g.beginPath(); g.moveTo(bx, by); g.lineTo(bx, by - h); g.stroke();
  g.fillStyle = blk.color; g.beginPath(); g.moveTo(bx, by - h); g.quadraticCurveTo(bx + w * 0.5, by - h + wave, bx + w, by - h + 1.5); g.lineTo(bx + w, by - h + 7); g.quadraticCurveTo(bx + w * 0.5, by - h + 7 + wave, bx, by - h + 6); g.fill();
  g.fillStyle = 'rgba(255,255,255,.75)'; g.fillRect(bx + 0.5, by - h + 2.6, w - 1, 1.3);
  g.font = `${Math.round(7 + blk.sc * 2)}px sans-serif`; g.textAlign = 'center'; g.fillStyle = '#fff'; g.fillText(DIVS[blk.d.t].icon, bx + w + 5, by - h + 6);
}
function bvDraw(V, b, g, lines, all) {
  { const k = g.canvas.width / BV_W; g.setTransform(k, 0, 0, k, 0, 0); }
  const W = BV_W, H = BV_H, cam = V.cam;
  const shx = V.shake > 0.05 ? (Math.random() - 0.5) * V.shake * 2.2 : 0, shy = V.shake > 0.05 ? (Math.random() - 0.5) * V.shake * 2.2 : 0;
  g.save(); g.translate(W / 2 + shx, H / 2 + shy); g.scale(cam.z, cam.z); g.translate(-cam.x, -cam.y);
  if (!V.bg) V.bg = bvBuildBg(V, b); g.drawImage(V.bg, 0, 0, W, H);
  // loma de la defensa «en los altos»
  ['A', 'B'].forEach(s => { if (bvStrat(b, s) === 'hold' && !V.tf.hill) { const dir = s === 'A' ? 1 : -1, cx = lines[s] - dir * 34, rg = g.createRadialGradient(cx, H / 2, 10, cx, H / 2, 150); rg.addColorStop(0, 'rgba(210,190,130,.34)'); rg.addColorStop(0.6, 'rgba(120,96,56,.26)'); rg.addColorStop(1, 'rgba(70,52,30,0)'); g.fillStyle = rg; g.beginPath(); g.ellipse(cx, H / 2 + 4, 90, H / 2 - 40, 0, 0, 6.3); g.fill();
    g.strokeStyle = 'rgba(245,225,170,.2)'; g.lineWidth = 1.2; for (let i = 1; i <= 3; i++) { g.beginPath(); g.ellipse(cx, H / 2 + 4, 90 - i * 22, H / 2 - 40 - i * 34, 0, 0, 6.3); g.stroke(); } } });
  bvTrenches(g, V, b, lines);
  if (typeof bvFxUnder === 'function') bvFxUnder(g, V, b);
  if (typeof tacDrawPrepZone === 'function') { tacDrawPrepZone(g, V, b); tacDrawForts(g, V, b); }
  // línea de contacto
  g.strokeStyle = 'rgba(255,230,150,.16)'; g.setLineDash([5, 7]); g.beginPath(); const mx = (lines.A + lines.B) / 2; g.moveTo(mx, 30); g.lineTo(mx, H - 4); g.stroke(); g.setLineDash([]);
  // caídos
  V.corpses.forEach(c => { g.save(); g.translate(c.x, c.y); g.rotate(c.hd + 1.57); g.globalAlpha = Math.max(0.2, 0.8 - c.age * 0.008); g.fillStyle = '#1c1612'; g.fillRect(-1.2, -3, 2.8, 6); g.fillStyle = c.color; g.fillRect(-0.9, -2.3, 2, 3); g.restore(); }); g.globalAlpha = 1;
  // humo y polvo (capa baja)
  V.parts.forEach(p => { if (p.k === 'gas') { const k = p.age / p.life; g.globalAlpha = 0.5 * Math.sin(Math.min(1, k) * 3.14); g.fillStyle = '#b6d13a'; g.beginPath(); g.arc(p.x, p.y, p.r * (1 + k * 1.6), 0, 6.3); g.fill(); g.globalAlpha = 1; return; }
    if (p.k !== 'smoke' && p.k !== 'dust') return; const k = p.age / p.life; g.globalAlpha = (p.k === 'smoke' ? 0.34 : 0.26) * (1 - k); g.fillStyle = p.k === 'smoke' ? '#c9c6be' : '#b09a76'; g.beginPath(); g.arc(p.x, p.y, (p.r || 3) * (1 + k * 2.2), 0, 6.3); g.fill(); }); g.globalAlpha = 1;
  // casillas de los bloques y órdenes en curso
  const blocks = all.filter(k => !(typeof tacHidden === 'function' && tacHidden(b, k))).sort((a, c) => a.y - c.y);
  blocks.forEach(blk => { bvPlate(g, blk, V.hover === blk); });
  if (V.sel && V.blocks.has(V.sel.d)) { const s = V.sel, pulse = 0.6 + 0.4 * Math.sin(V.t * 5), c = Math.cos(s.hd), sn = Math.sin(s.hd), hw = s.dep / 2 + 7, hh2 = s.wid / 2 + 7, pr = (x, y) => [s.x + c * x - sn * y, s.y + sn * x + c * y];
    g.strokeStyle = `rgba(255,240,150,${pulse})`; g.lineWidth = 2; g.setLineDash([7, 4]); g.beginPath(); [pr(-hw, -hh2), pr(hw, -hh2), pr(hw, hh2), pr(-hw, hh2)].forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.closePath(); g.stroke(); g.setLineDash([]); }
  blocks.forEach(blk => { if (!blk.path || blk.path.length < 2) return; g.strokeStyle = blk.side === 'A' ? 'rgba(255,170,140,.5)' : 'rgba(150,200,255,.5)'; g.fillStyle = g.strokeStyle; g.lineWidth = 1.6; g.setLineDash([6, 5]); g.beginPath(); blk.path.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.stroke(); g.setLineDash([]);
    const a = blk.path[blk.path.length - 2], e = blk.path[blk.path.length - 1], an = Math.atan2(e[1] - a[1], e[0] - a[0]); g.beginPath(); g.moveTo(e[0] + Math.cos(an) * 8, e[1] + Math.sin(an) * 8); g.lineTo(e[0] + Math.cos(an + 2.5) * 7, e[1] + Math.sin(an + 2.5) * 7); g.lineTo(e[0] + Math.cos(an - 2.5) * 7, e[1] + Math.sin(an - 2.5) * 7); g.fill(); });
  if (typeof tacDrawPlans === 'function') { tacDrawArt(g, V, b, all); tacDrawPlans(g, V, b, all); }
  // soldados (ordenados por y)
  // los regimientos se dibujan como contadores; los soldados individuales ya no se pintan
  // barras de fuerza/organización y banderines
  blocks.forEach(blk => { const c = Math.cos(blk.hd), s = Math.sin(blk.hd), by = blk.y + Math.abs(s) * blk.dep / 2 + Math.abs(c) * blk.wid / 2 + 5; if (blk.role !== 'reserve' || V.hover === blk) { const w = Math.max(24, blk.wid * 0.8), x0 = blk.x - w / 2, org = clamp(blk.d.o / DIVS[blk.d.t].org, 0, 1);
      g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(x0 - 1, by - 1, w + 2, 8.5); g.fillStyle = '#79c35a'; g.fillRect(x0, by, w * clamp(blk.d.s, 0, 1), 2); g.fillStyle = org < 0.3 ? '#e8644f' : '#e0b04a'; g.fillRect(x0, by + 2.5, w * org, 2); const mmv = blk.mm === undefined ? 0.8 : blk.mm; g.fillStyle = mmv < 0.3 ? '#ff5a46' : '#5aa8ff'; g.fillRect(x0, by + 5, w * clamp(mmv, 0, 1), 2); }
    if (blk.brk > 0 || blk.wav) { g.font = '12px sans-serif'; g.textAlign = 'center'; g.fillStyle = '#fff'; g.fillText(blk.brk > 0 ? '😱' : '😰', blk.x, blk.y - blk.wid / 2 - 5); }
    bvFlag(g, V, blk, V.over, V.over && V.over.loser !== blk.side);
    const od = bvOrder(blk); if (od) { const left = Math.max(1, Math.ceil(od.until - G.date.t)); g.fillStyle = 'rgba(10,12,16,.85)'; g.beginPath(); g.arc(blk.x, blk.y - blk.wid / 2 - 17, 8, 0, 6.3); g.fill(); g.strokeStyle = '#ffe28a'; g.lineWidth = 1.2; g.stroke(); g.font = '10px sans-serif'; g.textAlign = 'center'; g.fillStyle = '#fff'; g.fillText(ORDERS[od.k].icon, blk.x, blk.y - blk.wid / 2 - 17); g.font = 'bold 8px sans-serif'; g.fillStyle = '#ffe28a'; g.fillText(left + 'd', blk.x + 12, blk.y - blk.wid / 2 - 10); } });
  if (typeof bvCorpsFlags === 'function') bvCorpsFlags(g, V, b);
  // destellos, trazadoras y proyectiles
  V.parts.forEach(p => { const k = p.age / p.life;
    if (p.k === 'flash') { g.fillStyle = `rgba(255,235,150,${1 - k})`; g.beginPath(); g.arc(p.x, p.y, (p.big ? 6 : 3.2) * (1 - k * 0.3), 0, 6.3); g.fill(); }
    else if (p.k === 'tracer') { g.strokeStyle = `rgba(255,240,180,${0.6 * (1 - k)})`; g.lineWidth = 0.7; g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x + (p.x2 - p.x) * Math.min(1, k * 2), p.y + (p.y2 - p.y) * Math.min(1, k * 2)); g.stroke(); }
    else if (p.k === 'shell') { const q = Math.min(1, k), x = p.x + (p.x2 - p.x) * q, y = p.y + (p.y2 - p.y) * q - Math.sin(q * 3.14) * 54; g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.ellipse(p.x + (p.x2 - p.x) * q, p.y + (p.y2 - p.y) * q + 2, 2.4, 1, 0, 0, 6.3); g.fill(); g.fillStyle = '#1c1c1e'; g.beginPath(); g.arc(x, y, 2.4, 0, 6.3); g.fill(); g.strokeStyle = 'rgba(255,200,120,.45)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x, y); g.lineTo(x - (p.x2 - p.x) * 0.05, y + 5); g.stroke(); }
    else if (p.k === 'boom') { g.fillStyle = `rgba(255,${150 + (1 - k) * 80 | 0},40,${0.9 * (1 - k)})`; g.beginPath(); g.arc(p.x, p.y, 4 + k * 18, 0, 6.3); g.fill(); g.strokeStyle = `rgba(70,46,22,${0.6 * (1 - k)})`; g.lineWidth = 2; g.beginPath(); g.arc(p.x, p.y, 7 + k * 26, 0, 6.3); g.stroke(); }
    else if (p.k === 'splash') { g.strokeStyle = `rgba(230,245,255,${0.8 * (1 - k)})`; g.lineWidth = 1; g.beginPath(); g.arc(p.x, p.y, 2 + k * 7, 0, 6.3); g.stroke(); g.fillStyle = `rgba(230,245,255,${0.7 * (1 - k)})`; g.fillRect(p.x - 0.8, p.y - k * 6, 1.6, 2); }
    else if (p.k === 'spark') { g.fillStyle = p.hot ? `rgba(255,${200 - k * 90 | 0},90,${1 - k})` : `rgba(180,255,180,${1 - k})`; g.beginPath(); g.arc(p.x, p.y - k * (p.hot ? 4 : 14), p.hot ? 1.3 : 2.5, 0, 6.3); g.fill(); } });
  V.rings.forEach(r => { const k = r.age / r.life; g.globalAlpha = (k < 0.2 ? k / 0.2 : 1 - (k - 0.2) / 0.8) * 0.7; g.strokeStyle = '#fff3c0'; g.lineWidth = 3; g.beginPath(); g.arc(r.x, r.y, r.r * (0.8 + 0.3 * k), 0, 6.3); g.stroke(); g.globalAlpha = 1; });
  if (V.rain > 0) { g.strokeStyle = 'rgba(180,205,255,.45)'; g.lineWidth = 1; for (let i = 0; i < 90; i++) { const x = ((hash2(i, 3, 9) * W * 1.2 + V.t * 140) % (W + 40)), y = ((hash2(i, 5, 9) * H * 1.2 + V.t * 420) % (H + 20)); g.beginPath(); g.moveTo(x, y); g.lineTo(x - 5, y + 11); g.stroke(); } g.fillStyle = 'rgba(40,60,90,.16)'; g.fillRect(0, 0, W, H); }
  if (typeof bvFxOver === 'function') bvFxOver(g, V, b, W, H);
  g.restore();
  if (typeof bvPost === 'function') bvPost(g, V, b);
  g.save(); g.scale(BV_W / 960, BV_H / 420); bvOverlay(V, b, g, lines, all); g.restore();
}
function bvOverlay(V, b, g, lines, all) {
  const W = 960, H = 420, men = s => Math.round(all.filter(x => x.side === s).reduce((n, x) => n + clamp(x.d.s, 0, 1) * MEN_PER_DIV, 0));
  const orgA = b.orgA === undefined ? 1 : b.orgA, orgB = b.orgB === undefined ? 1 : b.orgB, m = clamp(0.5 + (b.adv || 0) * 0.28 + (orgA - orgB) * 0.28, 0.04, 0.96), ca = G.C[b.A0].color, cb2 = G.C[b.B0].color;
  g.fillStyle = 'rgba(8,12,16,.82)'; g.fillRect(0, 0, W, 34); g.fillStyle = ca; g.fillRect(0, 2, W * m, 6); g.fillStyle = cb2; g.fillRect(W * m, 2, W * (1 - m), 6); g.fillStyle = '#fff'; g.fillRect(W * m - 1, 0, 2, 11);
  g.font = 'bold 16px sans-serif'; g.textBaseline = 'middle'; g.fillStyle = '#f5ecd0'; g.textAlign = 'left'; g.fillText(`${G.C[b.A0].name} · ${fmtN(men('A'), 0)} h.`, 8, 23); g.textAlign = 'right'; g.fillText(`${fmtN(men('B'), 0)} h. · ${G.C[b.B0].name}`, W - 8, 23);
  g.textAlign = 'center'; g.fillStyle = '#ffe28a'; g.fillText(b.ended ? 'Batalla terminada' : m > 0.58 ? `Va ganando ${G.C[b.A0].name}` : m < 0.42 ? `Va ganando ${G.C[b.B0].name}` : 'Combate igualado', W / 2, 23);
  if (b.prep) { g.fillStyle = 'rgba(30,22,6,.82)'; g.fillRect(W / 2 - 190, 40, 380, 26); g.fillStyle = '#ffd37a'; g.font = 'bold 15px sans-serif'; g.textAlign = 'center'; g.fillText('⚙️ FASE DE PREPARACIÓN · despliega y fortifica', W / 2, 53); }
  // estrategia y reparto de órdenes de cada bando
  ['A', 'B'].forEach(s => { const st = STRATS[bvStrat(b, s)], cnt = {}; all.forEach(x => { if (x.side === s) cnt[BV_PHASE[x.mode] || 'línea'] = (cnt[BV_PHASE[x.mode] || 'línea'] || 0) + 1; });
    const txt = `${st.icon} ${st.name}`, sub = Object.keys(cnt).map(k => `${cnt[k]} ${k}`).join(' · '), left = s === 'A';
    g.font = 'bold 14.5px sans-serif'; const tw = Math.max(g.measureText(txt).width, 0) + 16; g.font = '12.5px sans-serif'; const sw = g.measureText(sub).width + 16, bw = Math.max(tw, sw), x = left ? 8 : W - 8 - bw;
    g.fillStyle = 'rgba(8,12,16,.7)'; g.fillRect(x, 40, bw, 38); g.fillStyle = s === 'A' ? '#e8644f' : '#6aa8e8'; g.fillRect(left ? x : x + bw - 3, 40, 3, 38);
    g.textAlign = left ? 'left' : 'right'; const tx = left ? x + 10 : x + bw - 10; g.font = 'bold 14.5px sans-serif'; g.fillStyle = '#f5ecd0'; g.fillText(txt, tx, 53); g.font = '12.5px sans-serif'; g.fillStyle = '#b9c0c8'; g.fillText(sub, tx, 70); });
  if (V.banner) { const k = V.banner.age, a = k < 0.3 ? k / 0.3 : k > 2.3 ? (2.8 - k) / 0.5 : 1; g.globalAlpha = clamp(a, 0, 1); g.fillStyle = 'rgba(10,12,16,.82)'; g.fillRect(W / 2 - 200, H - 50, 400, 32); g.fillStyle = V.banner.side === 'A' ? '#ffb89c' : '#a8d0ff'; g.font = 'bold 17px sans-serif'; g.textAlign = 'center'; g.fillText(`${V.banner.icon || ''} ${V.banner.text}`, W / 2, H - 33); g.globalAlpha = 1; }
  { const hint = V.draw && PLANS[V.draw.k] ? `${PLANS[V.draw.k].ic} ${PLANS[V.draw.k].hint}  (Esc cancela)` : V.tool ? 'Haz clic en tu zona para construir (Esc cancela)' : V.garr ? '🏰 Elige un bloque tuyo y haz clic en un fuerte' : ''; if (hint) { g.font = 'bold 13px sans-serif'; const w = g.measureText(hint).width + 24; g.fillStyle = 'rgba(10,12,16,.9)'; g.fillRect(W / 2 - w / 2, H - 30, w, 24); g.strokeStyle = '#ffd37a'; g.lineWidth = 1; g.strokeRect(W / 2 - w / 2, H - 30, w, 24); g.fillStyle = '#ffe9a8'; g.textAlign = 'center'; g.fillText(hint, W / 2, H - 18); } }
  // ficha del bloque bajo el ratón
  const h = V.hover; if (h) {
    const orgF = clamp(h.d.o / DIVS[h.d.t].org, 0, 1), mor = h.mm !== undefined ? h.mm : typeof armyMor === 'function' ? armyMor(h.a) : 0.8, gen = h.a.gen || {name: '—', lvl: 1};
    const lines2 = [`${DIVS[h.d.t].icon} ${BV_KIND[h.type] || DIVS[h.d.t].name} · ${G.C[h.tag].name}`, `${h.a.name} · Gral. ${gen.name} (nv. ${gen.lvl})`, `Fuerza ${Math.round(clamp(h.d.s, 0, 1) * 100)}% · ${fmtN(clamp(h.d.s, 0, 1) * MEN_PER_DIV, 0)} hombres`, `Organización ${Math.round(orgF * 100)}% · Moral ${Math.round(mor * 100)}%${h.brk > 0 ? ' (¡rota!)' : h.wav ? ' (vacilante)' : ''}`, `Orden: ${BV_STATUS[h.mode] || h.mode}${bvOrder(h) ? ' · ' + ORDERS[bvOrder(h).k].icon + ' ' + ORDERS[bvOrder(h).k].name : ''}`, `Terreno: ${h.terr && h.terr.water ? 'vadeando el río (muy lento)' : h.terr && h.terr.cover ? 'entre los árboles (cobertura)' : h.terr && h.terr.hill ? 'en la colina' : 'campo abierto'}`];
    g.font = '13px sans-serif'; const w = Math.max(...lines2.map(t => g.measureText(t).width)) + 20, hh = lines2.length * 17 + 14; const cz = V.cam.z, shx = ((h.x - V.cam.x) * cz + BV_W / 2) / 2, shy = ((h.y - V.cam.y) * cz + BV_H / 2) / 2; let x = clamp(shx + 36 * Math.min(cz, 1.5), 6, W - w - 6), y = clamp(shy - hh / 2, 40, H - hh - 6);
    g.fillStyle = 'rgba(14,18,24,.94)'; g.fillRect(x, y, w, hh); g.strokeStyle = h.color; g.lineWidth = 1.5; g.strokeRect(x, y, w, hh); g.textAlign = 'left';
    lines2.forEach((t, i) => { g.fillStyle = i === 0 ? '#ffe28a' : i === 4 ? '#9fd3ff' : i === 5 ? '#a9d98c' : '#e6e1d0'; g.font = i === 0 ? 'bold 13.5px sans-serif' : '13px sans-serif'; g.fillText(t, x + 10, y + 16 + i * 17); });
  }
}
/* ---------- grabación y repetición de la batalla ---------- */
const BV_MODES = Object.keys(BV_STATUS);
function bvRecSnap(V, b, all, lines) {
  const R_ = V.rec; if (V.replay || V.t - R_.last < 0.2 || R_.snaps.length > 7000) return; R_.last = V.t;
  const bl = []; all.concat(V.ghosts).forEach(blk => {
    if (!R_.info.has(blk.id)) R_.info.set(blk.id, {side: blk.side, type: blk.type, color: blk.color, tag: blk.tag, dt: blk.d.t, name: blk.a.name, gen: blk.a.gen ? {name: blk.a.gen.name, lvl: blk.a.gen.lvl} : null});
    let mask = 0; const fl = []; blk.figs.forEach(f => { if (f.alive && f.flee <= 0 && f.dying <= 0) mask |= (1 << f.i); else if (f.alive && f.flee > 0 && fl.length < 16) fl.push([f.i, Math.round(f.x), Math.round(f.y)]); });
    bl.push([blk.id, +blk.x.toFixed(1), +blk.y.toFixed(1), +blk.hd.toFixed(2), +blk.sc.toFixed(2), +blk.comp.toFixed(2), mask, +clamp(blk.d.s, 0, 1).toFixed(2), +clamp(blk.d.o / DIVS[blk.d.t].org, 0, 1).toFixed(2), Math.max(0, BV_MODES.indexOf(blk.mode)), fl, Math.round(blk.sp || 0)]);
  });
  R_.snaps.push({t: +V.t.toFixed(2), b: bl, lA: Math.round(lines.A), lB: Math.round(lines.B), sa: bvStrat(b, 'A'), sb: bvStrat(b, 'B'), adv: +V.adv.toFixed(3), oa: b.orgA === undefined ? 1 : b.orgA, ob: b.orgB === undefined ? 1 : b.orgB, day: b.day});
}
function bvReplayStart(V, b) {
  const S = V.rec.snaps; if (S.length < 3) return false;
  const VR = bvNew(b); VR.bg = V.bg; VR.tf = V.tf; VR.cam = V.cam; VR.id = V.id; VR.seed = V.seed; VR.wind = V.wind;
  V.replay = {t: 0, speed: 1, playing: true, dur: S[S.length - 1].t, ptr: 0, pp: 0, cp: 0, vb: new Map(), VR}; V.last = performance.now(); return true;
}
function bvReplayStop(V) { V.replay = null; V.last = performance.now(); }
function bvReplayRestart(V) { const rp = V.replay, VR = rp.VR; rp.t = 0; rp.ptr = 0; rp.pp = 0; rp.cp = 0; rp.vb.clear(); VR.blocks.clear(); VR.parts = []; VR.corpses = []; rp.playing = true; }
function bvReplayFrame(V, b, g, now) {
  const rp = V.replay, VR = rp.VR, dt = Math.min(0.05, (now - V.last) / 1000); V.last = now; const S = V.rec.snaps; let pdt = 0;
  if (rp.playing) { rp.t += dt * rp.speed; pdt = dt * rp.speed; } if (rp.t >= rp.dur) { rp.t = rp.dur; rp.playing = false; }
  while (rp.ptr < S.length - 2 && S[rp.ptr + 1].t <= rp.t) rp.ptr++;
  const a = S[rp.ptr], c = S[Math.min(rp.ptr + 1, S.length - 1)], f = c.t > a.t ? clamp((rp.t - a.t) / (c.t - a.t), 0, 1) : 0, cm = c.m || (c.m = new Map(c.b.map(e => [e[0], e]))), present = new Set();
  a.b.forEach(ea => {
    const id = ea[0], ec = cm.get(id) || ea, inf = V.rec.info.get(id); present.add(id); let blk = rp.vb.get(id);
    if (!blk) { const F = BV_FORM[inf.type] || BV_FORM.inf; blk = {id, side: inf.side, type: inf.type, F, color: inf.color, tag: inf.tag, a: {name: inf.name, gen: inf.gen}, d: {t: inf.dt, s: 1, o: 1}, figs: [], x: ea[1], y: ea[2], hd: ea[3], sc: ea[4], comp: ea[5], vx: 0, vy: 0, sp: 0, mode: 'hold', role: 'line', ph: rnd(0, 6.28), dep: 20, wid: 30, init: false};
      const mk = (kind, k, i) => ({kind, k, i, x: 0, y: 0, vx: 0, vy: 0, alive: true, dying: 0, flee: 0, ph: rnd(0, 6.28), recoil: 0, flash: 0});
      if (inf.type === 'art') { for (let k = 0; k < 3; k++) blk.figs.push(mk('gun', k, k)); for (let k = 0; k < 6; k++) blk.figs.push(mk('crew', k, 3 + k)); } else for (let k = 0; k < F.n; k++) blk.figs.push(mk('sol', k, k));
      rp.vb.set(id, blk); }
    VR.blocks.set(id, blk);
    blk.x = ea[1] + (ec[1] - ea[1]) * f; blk.y = ea[2] + (ec[2] - ea[2]) * f; blk.hd = ea[3] + bvAng(ea[3], ec[3]) * f; blk.sc = ea[4]; blk.comp = ea[5]; blk.d.s = ea[7]; blk.d.o = ea[8] * DIVS[inf.dt].org; blk.mode = BV_MODES[ea[9]] || 'hold'; blk.sp = ea[11];
    blk.role = blk.mode === 'reserve' ? 'reserve' : blk.type === 'art' ? 'art' : 'line'; bvDims(blk);
    const mask = ea[6], fl = ea[10];
    blk.figs.forEach(fg => {
      if (fg.dying > 0) { fg.dying -= dt; return; }
      const flr = fl.find(q => q[0] === fg.i);
      if (flr) { fg.alive = true; fg.flee = 1; fg.x += (flr[1] - fg.x) * Math.min(1, dt * 10); fg.y += (flr[2] - fg.y) * Math.min(1, dt * 10); return; }
      fg.flee = 0;
      if (mask & (1 << fg.i)) { fg.alive = true; const s = bvSlot(blk, fg); if (!blk.init) { fg.x = s[0]; fg.y = s[1]; } else { fg.x += (s[0] - fg.x) * Math.min(1, dt * 12); fg.y += (s[1] - fg.y) * Math.min(1, dt * 12); } }
      else if (fg.alive) { fg.alive = false; fg.dying = 0.5; } });
    blk.init = true;
  });
  [...VR.blocks.keys()].forEach(id => { if (!present.has(id)) VR.blocks.delete(id); });
  const P = V.rec.parts, C = V.rec.corp;
  while (rp.pp < P.length && P[rp.pp].t <= rp.t) { VR.parts.push(Object.assign({}, P[rp.pp], {age: 0})); rp.pp++; }
  while (rp.cp < C.length && C[rp.cp].t <= rp.t) { VR.corpses.push(Object.assign({}, C[rp.cp], {age: 0})); rp.cp++; }
  VR.parts.forEach(p => { p.age += pdt; if (p.k === 'smoke') { p.x += (p.vx || 0) * pdt; p.y -= 6 * pdt; } }); VR.parts = VR.parts.filter(p => p.age < p.life + 0.05); VR.corpses.forEach(cc => { cc.age += pdt; });
  VR.t = rp.t; VR.adv = a.adv + (c.adv - a.adv) * f; VR.over = null; VR.banner = null; VR.rain = 0; VR.sel = null;
  const bRep = Object.assign({}, b, {strA: a.sa, strB: a.sb, adv: VR.adv, orgA: a.oa + (c.oa - a.oa) * f, orgB: a.ob + (c.ob - a.ob) * f, ended: false, day: a.day}), lines = {A: a.lA + (c.lA - a.lA) * f, B: a.lB + (c.lB - a.lB) * f}, all = [...VR.blocks.values()];
  bvCamStep(VR, dt); VR.mouse = V.mouse; bvHover(VR, all); bvDraw(VR, bRep, g, lines, all);
  const W = BV_W, H = BV_H; g.fillStyle = 'rgba(10,12,16,.8)'; g.fillRect(W / 2 - 92, 40, 184, 24); g.fillStyle = '#ffd37a'; g.font = 'bold 14px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(`⏪ REPETICIÓN ×${rp.speed}${rp.playing ? '' : ' · fin'}`, W / 2, 52);
  g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(16, H - 14, W - 32, 7); g.fillStyle = '#ffd37a'; g.fillRect(16, H - 14, (W - 32) * clamp(rp.t / Math.max(0.1, rp.dur), 0, 1), 7);
}
/* ---------- ratón: clic, arrastre y rueda ---------- */
function bvClick(V) {
  if (V.replay) return; const h = V.hover;
  { const bb = G.battles.find(x => x.id === UI.battle); if (bb && V.draw && !bb.ended && V.mouse && typeof tacClickMap === 'function') { const [wx, wy] = bvToWorld(V, V.mouse.x, V.mouse.y); if (tacClickMap(V, bb, wx, wy)) { renderBattlePanel(); return; } } }
  { const bb2 = G.battles.find(x => x.id === UI.battle); if (bb2 && V.mouse && typeof tacFortClick === 'function' && tacFortClick(V, bb2, h)) { renderBattlePanel(); return; } }
  if (h && h.tag === G.player && !V.over) { V.sel = V.sel === h ? null : h; V.selCorps = null; } else if (!h) { V.sel = null; V.selCorps = null; }
  if (typeof renderBattlePanel === 'function') renderBattlePanel();
}
function bvBind(cv) {
  if (cv._bvb) return; cv._bvb = true;
  const pos = e => { const r = cv.getBoundingClientRect(); return {x: (e.clientX - r.left) / r.width * BV_W, y: (e.clientY - r.top) / r.height * BV_H}; };
  cv.addEventListener('mousemove', e => { if (R.bviz) R.bviz.mouse = pos(e); }); cv.addEventListener('mouseleave', () => { if (R.bviz) R.bviz.mouse = null; });
  cv.addEventListener('contextmenu', e => { e.preventDefault(); const V = R.bviz; if (V && (V.draw || V.tool)) { V.draw = null; V.tool = null; renderBattlePanel(); } });
  cv.addEventListener('mousedown', e => { const V = R.bviz; if (!V || e.button !== 0) return; { const bb = G.battles.find(x => x.id === UI.battle); if (bb && typeof tacMouseDown === 'function' && tacMouseDown(V, bb, e, pos(e))) { window._bvDrag = null; return; } } const r = cv.getBoundingClientRect(); window._bvDrag = {x0: e.clientX, y0: e.clientY, cx: V.cam.x, cy: V.cam.y, w: r.width, moved: false}; });
  cv.addEventListener('wheel', e => { const V = R.bviz; if (!V) return; e.preventDefault(); const p = pos(e); bvZoomAt(V, e.deltaY < 0 ? 1.2 : 1 / 1.2, p.x, p.y); V.follow = false; }, {passive: false});
  cv.addEventListener('dblclick', () => { const V = R.bviz; if (V && V.draw && V.draw.pts.length) { ACT.tacplan({k: 'fix'}); return; } if (V) { V.cam.z = 1; V.cam.x = BV_W / 2; V.cam.y = BV_H / 2; V.follow = false; } });
  if (!window._bvWin) { window._bvWin = true;
    window.addEventListener('mousemove', e => { const V0 = R.bviz; if (V0 && V0.dragBlk) { const cv0 = document.getElementById('bmap'), bb = G.battles.find(x => x.id === UI.battle); if (cv0 && bb) { const r0 = cv0.getBoundingClientRect(); tacMouseMove(V0, bb, {x: (e.clientX - r0.left) / r0.width * BV_W, y: (e.clientY - r0.top) / r0.height * BV_H}); } return; } const d = window._bvDrag, V = R.bviz; if (!d || !V) return; const dx = e.clientX - d.x0, dy = e.clientY - d.y0; if (Math.hypot(dx, dy) > 4) d.moved = true;
      if (d.moved && V.cam.z > 1) { const k = BV_W / d.w; V.cam.x = d.cx - dx * k / V.cam.z; V.cam.y = d.cy - dy * k / V.cam.z; V.follow = false; bvClampCam(V); } });
    window.addEventListener('mouseup', () => { if (R.bviz && typeof tacMouseUp === 'function' && tacMouseUp(R.bviz)) return; const d = window._bvDrag; window._bvDrag = null; if (d && !d.moved && R.bviz) bvClick(R.bviz); }); }
}
Object.assign(ACT, {
  bvzoom: d => { const V = R.bviz; if (V) { bvZoomAt(V, +d.d > 0 ? 1.4 : 1 / 1.4); V.follow = false; } },
  bvreset: () => { const V = R.bviz; if (V) { V.cam.z = 1; V.cam.x = BV_W / 2; V.cam.y = BV_H / 2; V.follow = false; renderBattlePanel(); } },
  bvfollow: () => { const V = R.bviz; if (V) { V.follow = !V.follow; renderBattlePanel(); } },
  bvreplay: () => { const V = R.bviz, b = G.battles.find(x => x.id === UI.battle) || G.lastEnded; if (V && b && bvReplayStart(V, b)) renderBattlePanel(); else toast('⚠️', 'No hay suficiente batalla grabada para repetirla.'); },
  bvrpause: () => { const V = R.bviz; if (V && V.replay) { if (!V.replay.playing && V.replay.t >= V.replay.dur - 0.01) bvReplayRestart(V); else V.replay.playing = !V.replay.playing; renderBattlePanel(); } },
  bvrspeed: d => { const V = R.bviz; if (V && V.replay) { V.replay.speed = +d.n; renderBattlePanel(); } },
  bvrexit: () => { const V = R.bviz; if (V) { bvReplayStop(V); renderBattlePanel(); } },
  bvgas: () => { const b = G.battles.find(x => x.id === UI.battle); if (!b) return; const side = b.A0 === G.player ? 'A' : b.B0 === G.player ? 'B' : null; if (!side) { toast('⚠️', 'Solo el líder de cada bando puede ordenar un ataque con gas.'); return; } const r = launchGas(b, side); if (!r.ok) toast('⚠️', r.msg); renderBattlePanel(); },
  bvorder: d => {
    const V = R.bviz, b = G.battles.find(x => x.id === UI.battle); if (!V || !V.sel || !b || b.ended) return; const dv = V.sel.d;
    if (d.k === 'cancel') { delete dv.ord; if (dv.par) delete dv.par.ord; toast('🎯', 'Orden cancelada.'); }
    else if (ORDERS[d.k]) { dv.ord = {k: d.k, until: G.date.t + 4}; if (dv.par) dv.par.ord = dv.ord; bvBanner(V, `${ORDERS[d.k].icon} ${ORDERS[d.k].name}: ${V.sel.a.name}`, V.sel.side, ''); toast(ORDERS[d.k].icon, `${V.sel.a.name}: ${ORDERS[d.k].name} durante 4 días.`); }
    renderBattlePanel();
  }
});
// bucle de animación del panel
let _bvRaf = 0;
function bvStart() { if (_bvRaf) return; const loop = t => { _bvRaf = 0; const cv = document.getElementById('bmap'); if (!cv || !UI.battle) return; let b = G.battles.find(x => x.id === UI.battle); if (!b && G.lastEnded && G.lastEnded.id === UI.battle) b = G.lastEnded; if (!b) return; R.bviz = R.bviz && R.bviz.id === b.id ? R.bviz : bvNew(b); bvBind(cv); bvFrame(R.bviz, b, cv.getContext('2d'), performance.now()); _bvRaf = requestAnimationFrame(loop); }; _bvRaf = requestAnimationFrame(loop); }
