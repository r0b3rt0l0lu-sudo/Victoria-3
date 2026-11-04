/* ===== TÁCTICA II: IA de combate, fuertes ocupados y artillados, tropas comprometidas, ríos, cercos y prisioneros =====
   · La IA ejecuta las MISMAS tácticas que el jugador: guarnece sus fuertes, flanquea con la caballería, fija a los bloques débiles del rival,
     y si va a ser flanqueada se repliega, cambia de posición o cierra la brecha con reservas.
   · Los fuertes guarnecidos se dibujan con soldados dentro (la unidad desaparece del campo), sus cañones disparan a los enemigos (automático o con
     objetivo fijado), la guarnición aguanta hasta quedar sin hombres, y un fuerte vacío puede ser ocupado por el enemigo.
   · Eliges qué divisiones entran en combate; las demás quedan fuera hasta que las llames.
   · Los ríos solo se cruzan por los vados y las lagunas se rodean. Un flanqueo da bonos muy fuertes.
   · Una unidad rodeada acaba rindiéndose: prisioneros a los que puedes liberar, emplear, canjear, rescatar, reclutar o ejecutar. */
const tacFortAlive = (b, id) => (b.forts || []).some(f => f.id === id && f.hp > 0);
const tacHidden = (b, blk) => !!(blk.d.cust && blk.d.cust.fort && tacFortAlive(b, blk.d.cust.fort));
/* ---------- ríos y lagunas: solo se cruza por los vados ---------- */
function tacRiverX(tf, y) { return tf.river.x + Math.sin(y / 70 + tf.river.ph) * tf.river.amp; }
function tacWaypoint(tf, blk, tx, ty) {
  if (!tf || (!tf.river && !tf.pond)) return null; const x = blk.x, y = blk.y; let hit = null;
  for (let i = 1; i <= 14; i++) { const px = x + (tx - x) * i / 14, py = y + (ty - y) * i / 14; if (bvTerrAt(tf, px, py, blk.side).water) { hit = [px, py]; break; } }
  if (!hit) return null;
  const onRiver = tf.river && Math.abs(hit[0] - tacRiverX(tf, hit[1])) < tf.river.w / 2 + 6;
  if (onRiver) {
    const r = tf.river, sign = x < tacRiverX(tf, y) ? 1 : -1; let best = null, bc = 1e9;
    r.fords.forEach(f => { const c = Math.abs(y - f.y) + Math.abs(f.y - ty) + Math.abs(x - tacRiverX(tf, f.y)) * 0.3; if (c < bc) { bc = c; best = f; } });
    const rx = tacRiverX(tf, best.y), ax = rx - sign * (r.w / 2 + 18), bx = rx + sign * (r.w / 2 + 18);
    if (Math.abs(x - ax) < 26 && Math.abs(y - best.y) < best.w / 2 - 4) return [bx, best.y];
    return [ax, best.y];
  }
  const p = tf.pond; return [p.x, p.y + (y < p.y ? -1 : 1) * (p.ry + 24)];
}
/* ---------- fuertes: guarnición, cañones, captura, giro ---------- */
function tacFortClick(V, b, h) {
  const ps = playerSide(b); if (V.fortAim && ps) { if (h && h.side !== ps && h.mode !== 'rout') { (V.fortTgt = V.fortTgt || {})[V.fortAim] = h.d; toast('🎯', 'Los cañones del fuerte apuntan a ese bloque.'); V.fortAim = null; return true; } if (!h) { V.fortAim = null; return true; } return false; }
  if (h && !tacHidden(b, h)) return false; const [wx, wy] = bvToWorld(V, V.mouse.x, V.mouse.y), f = tacFortAt(b, wx, wy);
  if (f) { V.selFort = f.id; V.sel = null; return true; } if (h && tacHidden(b, h)) { const f2 = (b.forts || []).find(q => q.id === h.d.cust.fort); if (f2 && h.side === ps) { V.selFort = f2.id; V.sel = h; return true; } }
  return false;
}
function tacFortGuns(V, b, all, step) {
  (b.forts || []).forEach(f => {
    if (f.hp <= 0 || !f.guns) return; f._cd = (f._cd || 0) - step; if (f._cd > 0) return;
    const crewed = tacGarrisonOf(b, f).length > 0 || f.kind === 'fort', dir = f.side === 'A' ? 1 : -1, range = tacArtRange(V, b, {terr: null}) - 25;
    const foes = all.filter(o => o.side !== f.side && o.mode !== 'rout' && Math.hypot(o.x - f.x, o.y - f.y) <= range); if (!foes.length) { f._cd = 1; return; }
    let tgt = null; const man = V.fortTgt && V.fortTgt[f.id]; if (man) { tgt = foes.find(o => o.d === man) || null; if (!tgt && !all.some(o => o.d === man)) delete V.fortTgt[f.id]; }
    if (!tgt) { const arts = foes.filter(o => o.type === 'art' && !o.sil); const pool = arts.length && Math.random() < 0.5 ? arts : foes; tgt = pool.slice().sort((p, q) => Math.hypot(p.x - f.x, p.y - f.y) - Math.hypot(q.x - f.x, q.y - f.y))[0]; }
    f._cd = (3.2 + Math.random() * 2) / (crewed ? 1 : 0.35);
    for (let i = 0; i < f.guns; i++) { const gx = f.x + dir * (f.w / 2 - 4), gy = f.y + (i - (f.guns - 1) / 2) * Math.min(12, (f.h - 10) / Math.max(1, f.guns)), fg = pickFoeFig(tgt), tx = (fg ? fg.x : tgt.x) + rnd(-12, 12), ty = (fg ? fg.y : tgt.y) + rnd(-12, 12);
      bvPart(V, {k: 'shell', x: gx, y: gy, x2: tx, y2: ty, life: 0.5 + Math.hypot(tx - gx, ty - gy) / 520 + i * 0.12, s: f.side, vt: tgt.id, ctr: tgt.type === 'art', stag: G.C[f.side === 'A' ? b.A0 : b.B0].name === undefined ? '' : (f.side === 'A' ? b.A0 : b.B0)});
      bvPart(V, {k: 'flash', x: gx + dir * 6, y: gy, life: 0.14, big: 1}); for (let n = 0; n < 2; n++) bvPart(V, {k: 'smoke', x: gx + dir * 8, y: gy, life: 2.2, r: 5, vx: dir * 8 + V.wind * 0.5 + rnd(-4, 4)}); }
    if (typeof SFX !== 'undefined') SFX.cannon(0.9);
  });
}
function tacCaptureForts(V, b, all, step) {
  (b.forts || []).forEach(f => {
    if (f.hp <= 0 || tacGarrisonOf(b, f).length) { f._capT = 0; return; }
    const en = all.find(o => o.side !== f.side && o.mode !== 'rout' && o.type !== 'art' && Math.abs(o.x - f.x) < f.w / 2 + 2 && Math.abs(o.y - f.y) < f.h / 2 + 2);
    if (!en) { f._capT = 0; return; } f._capT = (f._capT || 0) + step; if (f._capT < 2.2) return;
    const old = f.side, nm = FORT_KINDS[f.kind].n.toLowerCase(); f.side = en.side; f._capT = 0; f.cap = true; tacGarrison(b, f, en);
    const nOld = G.C[old === 'A' ? b.A0 : b.B0].name, nNew = G.C[en.side === 'A' ? b.A0 : b.B0].name; bvBanner(V, `🏴 ${nNew} ocupa el ${nm} de ${nOld}`, en.side, ''); (b.log = b.log || []).push({k: 'flank', d: b.day, t: `${nNew} ocupa el ${nm} de ${nOld}: sus cañones cambian de bando.`}); if (b.log.length > 30) b.log.shift();
    if (V.fortTgt) delete V.fortTgt[f.id];
  });
}
// los cañones del fuerte también castigan cada día al enemigo en el cálculo de la batalla
function tacFortDay(b) {
  ['A', 'B'].forEach(side => { const fs = tacForts(b, side).filter(f => f.guns); if (!fs.length) return; const guns = fs.reduce((n, f) => n + f.guns * (tacGarrisonOf(b, f).length || f.kind === 'fort' ? 1 : 0.35), 0); if (!guns) return;
    const foe = side === 'A' ? 'B' : 'A', as = sideIds(b, foe).map(armyById).filter(Boolean); let k = 0, lost = 0;
    as.forEach(a => a.divs.forEach(d => { if (divFrac(d) <= 0 || k >= 3) return; k++; const org = DIVS[d.t].org; d.o = Math.max(0, d.o - org * 0.004 * guns); const sl = 0.0016 * guns; d.s = Math.max(0, d.s - sl); lost += sl * MEN_PER_DIV; }));
    if (foe === 'A') b.lostA = (b.lostA || 0) + lost; else b.lostB = (b.lostB || 0) + lost; });
}
/* ---------- flanqueo: bonos muy fuertes ---------- */
function tacPlanFx(V, b, all) {
  const out = {A: {att: 0, def: 0}, B: {att: 0, def: 0}};
  all.forEach(blk => { const s = blk.side;
    if (blk.defLine && blk.d.plan && blk.d.plan.k === 'defend' && blk.mode !== 'rout') out[s].def += 0.02;
    if (blk.garr) out[s].def += 0.015;
    if (blk.mode === 'melee' || blk.mode === 'charge' || blk.mode === 'gallop') { const f = blk.foe; if (f && f.mode !== 'rout') { const ang = Math.abs(bvAng(f.hd, Math.atan2(blk.y - f.y, blk.x - f.x))); if (ang > 1.9) { out[s].att += 0.12; out[f.side].def -= 0.1; } else if (ang > 1.1) { out[s].att += 0.06; out[f.side].def -= 0.05; } } } });
  ['A', 'B'].forEach(s => { out[s].att = Math.min(0.4, out[s].att); out[s].def = clamp(out[s].def, -0.25, 0.1); });
  b.tac = out;
}
function tacFlankShock(V, b, all, step) {
  all.forEach(blk => { if (!(blk.mode === 'melee' || blk.mode === 'charge' || blk.mode === 'gallop') || !blk.foe) return; const f = blk.foe; if (f.mode === 'rout' || f.side === blk.side) return;
    const ang = Math.abs(bvAng(f.hd, Math.atan2(blk.y - f.y, blk.x - f.x))); if (ang <= 1.1) return; const rate = ang > 1.9 ? 0.032 : 0.016;
    f.d.o = Math.max(0, f.d.o - DIVS[f.d.t].org * rate * step); f.fat = Math.min(1, (f.fat || 0) + 0.02 * step); f.flanked = V.t;
    if (ang > 1.9 && !(f.d.cust && f.d.cust.fort) && f.d.o / DIVS[f.d.t].org < 0.45 && Math.random() < 0.12 * step) { f.brk = 6; f.figs.forEach(q => { if (q.alive && !q.flee && Math.random() < 0.5) bvFlee(V, f, q, 1); }); bvBanner(V, `↪️ ¡Flanqueo! ${G.C[f.tag].name} rompe filas`, blk.side, ''); } });
}
/* ---------- cerco y rendición ---------- */
function tacEncircle(V, b, all, step) {
  all.forEach(v => {
    if (v.mode === 'rout' || v.type === 'tank') return; const E = all.filter(o => o.side !== v.side && o.mode !== 'rout' && o.role !== 'reserve' && Math.hypot(o.x - v.x, o.y - v.y) < 105); const q = new Set(); E.forEach(e => q.add(Math.floor(((Math.atan2(e.y - v.y, e.x - v.x) + Math.PI) / (Math.PI / 2)) % 4)));
    const opp = q.has(0) && q.has(2) || q.has(1) && q.has(3), orgF = v.d.o / DIVS[v.d.t].org, nearF = all.some(o => o.side === v.side && o !== v && Math.hypot(o.x - v.x, o.y - v.y) < 60 && o.mode !== 'rout');
    const closed = (q.size >= 3 || (opp && q.size >= 2 && !nearF)) && orgF < 0.7;
    v.surT = closed ? (v.surT || 0) + step : Math.max(0, (v.surT || 0) - step * 2);
    if (v.surT > 6) tacSurrender(V, b, v, E);
  });
}
function tacSurrender(V, b, v, E) {
  const cap = E.slice().sort((p, q) => Math.hypot(p.x - v.x, p.y - v.y) - Math.hypot(q.x - v.x, q.y - v.y))[0]; if (!cap) { v.surT = 0; return; }
  const men = clamp(v.d.s, 0, 1) * MEN_PER_DIV * 0.9, ctag = cap.tag; takePrisoners(ctag, v.tag, men); b.pris = b.pris || {A: 0, B: 0}; b.pris[cap.side] = (b.pris[cap.side] || 0) + Math.round(men);
  v.d.s = 0; V.blocks.delete(v.d); const cn = G.C[ctag].name, vn = G.C[v.tag].name;
  bvBanner(V, `🏳️ ${vn}: una división rodeada se rinde (${fmtN(men, 0)} prisioneros)`, cap.side, ''); (b.log = b.log || []).push({k: 'panic', d: b.day, t: `Una división de ${vn} queda cercada y se rinde ante ${cn}: ${fmtN(men, 0)} prisioneros.`}); if (b.log.length > 30) b.log.shift();
  if (v.tag === G.player || ctag === G.player) notify('war', `${cn} captura ${fmtN(men, 0)} hombres de ${vn} tras cercarlos en ${provName(b.prov)}.`, b.state);
}
/* ---------- IA táctica del combate ---------- */
function tacAiGarrison(V, b, all, s) {
  tacForts(b, s).forEach(f => { const need = FORT_KINDS[f.kind].need - tacGarrisonOf(b, f).length; for (let i = 0; i < need; i++) {
    const cands = all.filter(o => o.side === s && !o.d.cust && !o.d.plan && o.mode !== 'rout' && (f.kind === 'battery' ? o.type === 'art' : o.type !== 'art' && o.type !== 'cav')).sort((p, q) => Math.hypot(p.x - f.x, p.y - f.y) - Math.hypot(q.x - f.x, q.y - f.y));
    if (cands.length > 1 || (cands.length && s !== playerSide(b))) tacGarrison(b, f, cands[0]); } });
}
function tacAi(V, b, all, s, step) {
  const dir = s === 'A' ? 1 : -1, mine = all.filter(o => o.side === s && o.mode !== 'rout'), foes = all.filter(o => o.side !== s && o.mode !== 'rout'); if (!mine.length || !foes.length) return;
  V['aiT' + s] = (V['aiT' + s] || 0) + step; if (V['aiT' + s] < 2.4) return; V['aiT' + s] = 0;
  if (!V['aiD' + s]) { V['aiD' + s] = true; tacAiGarrison(V, b, all, s); }
  if (V.t - (V['aiG' + s] || -9) > 10) { V['aiG' + s] = V.t; tacAiGarrison(V, b, all, s); }
  const line = mine.filter(o => o.role === 'line' && !o.garr), base = line.length ? line : mine; const lx = base.reduce((n, o) => n + o.x, 0) / base.length, yMin = Math.min(...base.map(o => o.y - o.wid / 2)), yMax = Math.max(...base.map(o => o.y + o.wid / 2));
  const attacked = mine.filter(m => !m.garr && m.role !== 'reserve' && foes.some(f => f.mode !== 'rout' && Math.hypot(f.x - m.x, f.y - m.y) < 105 && Math.abs(bvAng(m.hd, Math.atan2(f.y - m.y, f.x - m.x))) > 1.4));      // golpeados por el costado o la espalda
  const flankers = foes.filter(f => (f.type === 'cav' || f.type === 'tank' || f.mode === 'flank') && (f.y < yMin - 6 || f.y > yMax + 6) && Math.abs(f.x - lx) < 240 && f.role !== 'reserve');
  const free = o => !o.garr && !o.d.plan && o.mode !== 'rout' && o.role !== 'art';
  if (V.t - (V['aiR' + s] || -9) > 3.5 && (attacked.length || flankers.length)) {
    V['aiR' + s] = V.t;
    attacked.forEach(m => { const ctx = foes.filter(f => Math.hypot(f.x - m.x, f.y - m.y) < 140).length, weak = m.d.s < 0.4 || m.d.o / DIVS[m.d.t].org < 0.35;
      if (ctx >= 2 || weak) { const mid = BV_H / 2; m.d.plan = {k: 'retreat', pts: [[clamp(m.x - dir * 70, 40, BV_W - 40), clamp(m.y + (m.y < mid ? 50 : -50), 40, BV_H - 30)]], i: 0}; m.skey = ''; if (!V.banAi || V.t - V.banAi > 6) { V.banAi = V.t; bvBanner(V, `↩️ ${G.C[m.tag].name} cambia de posición ante el flanqueo`, s, ''); } }
      else { const f = foes.filter(q => Math.hypot(q.x - m.x, q.y - m.y) < 105).sort((p, q) => Math.hypot(p.x - m.x, p.y - m.y) - Math.hypot(q.x - m.x, q.y - m.y))[0]; if (f) { m.d.plan = {k: 'target', foe: f.d, pts: [], i: 0}; m.skey = ''; } } });
    if (flankers.length) { const fl = flankers[0], top = fl.y < (yMin + yMax) / 2, ey = top ? yMin : yMax, sg = top ? 1 : -1; const guards = mine.filter(free).sort((p, q) => Math.hypot(p.x - lx, p.y - ey) - Math.hypot(q.x - lx, q.y - ey)).slice(0, 2);
      guards.forEach((m, i) => { m.d.plan = {k: 'defend', pts: [[lx - dir * 28, ey - sg * (10 + i * 40)], [lx - dir * 28, ey + sg * (30 + i * 40)]], i: 0}; m.skey = ''; }); if (guards.length && (!V.banAi || V.t - V.banAi > 6)) { V.banAi = V.t; bvBanner(V, `🛡️ ${G.C[mine[0].tag].name} refuerza el flanco amenazado`, s, ''); } }
    return;
  }
  const ratio = mine.reduce((n, o) => n + o.d.s, 0) / Math.max(0.1, foes.reduce((n, o) => n + o.d.s, 0)), att = b.att === s;
  // ofensiva: la caballería flanquea y la infantería fija a los bloques más débiles
  const flK = mine.filter(o => (o.type === 'cav' || o.type === 'tank') && free(o) && o.d.s > 0.4); const active = mine.filter(o => o.d.plan && o.d.plan.k === 'flank').length;
  if ((att || ratio > 1.15) && flK.length && active < 2) { const m = flK[0], ends = foes.filter(o => o.role !== 'reserve' && o.type !== 'art').sort((p, q) => p.y - q.y); if (ends.length) { const top = Math.abs(ends[0].y - 30) < Math.abs(ends[ends.length - 1].y - (BV_H - 30)) ? false : true; const e = top ? ends[0] : ends[ends.length - 1], ey = top ? 28 : BV_H - 26, xm = BV_W / 2;
      m.d.plan = {k: 'flank', pts: [[xm, ey], [e.x + dir * (e.dep / 2 + 8), e.y + (top ? -1 : 1) * (e.wid / 2 + 2)]], i: 0}; m.skey = ''; if (!V.banAi || V.t - V.banAi > 6) { V.banAi = V.t; bvBanner(V, `↪️ ${G.C[m.tag].name} lanza un flanqueo`, s, ''); } } }
  if (ratio > 1.0 && Math.random() < 0.55) { const idle = mine.filter(o => free(o) && o.type === 'inf' && o.role === 'line'); idle.slice(0, 2).forEach(m => { const f = foes.filter(q => q.role !== 'reserve' && Math.hypot(q.x - m.x, q.y - m.y) < 230).sort((p, q) => (p.d.s * p.d.o) - (q.d.s * q.d.o))[0]; if (f && att) { m.d.plan = {k: 'target', foe: f.d, pts: [], i: 0}; m.skey = ''; } }); }
}
function tacThink(V, b, all, dt) {
  if (V.over || b.prep || b.ended || V.replay || dt <= 0) return;
  V._th = (V._th || 0) + dt; if (V._th < 1.0) return; const step = V._th; V._th = 0;
  tacCaptureForts(V, b, all, step); tacFortGuns(V, b, all, step); tacFlankShock(V, b, all, step); if (typeof tacMoraleX === 'function') tacMoraleX(V, b, all, step); tacEncircle(V, b, all, step); if (typeof tacVillages === 'function') tacVillages(V, b, all, step);
  const ps = playerSide(b); ['A', 'B'].forEach(s => { if (s !== ps) { if (typeof tacAiAbil === 'function') tacAiAbil(V, b, all, s); if (typeof tacAiCorps === 'function') { tacAiCorps(V, b, all, s); tacAiVillages(V, b, all, s); } tacAi(V, b, all, s, step); } });
}
/* ---------- tropas comprometidas ---------- */
function tacActive(b, side) { return Math.round(sideIds(b, side).map(armyById).filter(Boolean).reduce((n, a) => n + a.divs.reduce((m, d) => m + divFrac(d), 0), 0) * 10) / 10; }
function tacAiCommit(b, side) {
  const foe = side === 'A' ? 'B' : 'A', mine = tacActive(b, side), theirs = tacActive(b, foe); if (mine <= theirs * 1.8 || mine <= 4) return;
  const keep = Math.max(4, Math.ceil(theirs * 1.25)); let act = mine; const regs = regsOfSide(b, side).filter(r => r.nk === REG_N);
  regs.slice().reverse().forEach(r => { if (act > keep && !r.out) { r.out = true; act -= 1 / REG_N; } }); regsSaveFlags(b);
}
function tacAiReinforce(b) { ['A', 'B'].forEach(side => { if (side === playerSide(b)) return; const regs = regsOfSide(b, side), outs = regs.filter(r => r.out).length; if (!outs) return; const act = tacActive(b, side), org = side === 'A' ? b.orgA : b.orgB;
  if (act <= 3 || (org !== undefined && org < 0.5)) { regs.forEach(r => { r.out = false; }); regsSaveFlags(b); (b.log = b.log || []).push({k: 'reinf', d: b.day, t: `Llegan refuerzos de la reserva de ${G.C[side === 'A' ? b.A0 : b.B0].name}.`}); if (b.log.length > 30) b.log.shift(); } }); }
function tacCommitHtml() { return ''; }
function tacFortHtml(b, V) {
  const f = (b.forts || []).find(x => x.id === V.selFort); if (!f) return ''; const K = FORT_KINDS[f.kind], ps = playerSide(b), mineF = f.side === ps, g = tacGarrisonOf(b, f).length, tgt = V.fortTgt && V.fortTgt[f.id] ? DIVS[V.fortTgt[f.id].t].name : 'automático';
  return `<div class="fortinfo"><b>${K.ic} ${K.n}</b> · ${G.C[f.side === 'A' ? b.A0 : b.B0].name}${f.cap ? ' <small class="bad">(ocupado)</small>' : ''}<small> · integridad ${Math.round(f.hp / f.hpMax * 100)}% · cañones ${f.guns} · guarnición ${g}/${K.need} · objetivo: ${tgt}</small>
  ${mineF && !b.ended ? `<div class="ordbtns">${f.guns ? `<button data-act="tacfortaim" class="${V.fortAim === f.id ? 'on' : ''}" data-tip="Elige a qué bloque enemigo disparan los cañones del fuerte.">🎯 Fijar objetivo</button><button data-act="tacfortauto">🔄 Automático</button>` : ''}${b.prep && f.kind === 'trench' ? '<button data-act="tacrot" data-tip="Gira la trinchera 90° (tecla R)">↻ Girar</button>' : ''}</div>` : ''}</div>`;
}
Object.assign(ACT, {
  tacreinf: () => { const b = G.battles.find(x => x.id === UI.battle); if (!b) return; const ps = playerSide(b); if (!ps) return; regsOfSide(b, ps).forEach(r => { r.out = false; }); regsSaveFlags(b); if (R.bviz) bvBanner(R.bviz, '📣 Llega la reserva', ps, ''); toast('📣', 'Todos tus regimientos entran en combate.'); renderBattlePanel(); },
  tacfortaim: () => { const V = R.bviz; if (!V || !V.selFort) return; V.fortAim = V.fortAim === V.selFort ? null : V.selFort; if (V.fortAim) toast('🎯', 'Haz clic sobre el bloque enemigo al que deben disparar.'); renderBattlePanel(); },
  tacfortauto: () => { const V = R.bviz; if (!V || !V.selFort) return; if (V.fortTgt) delete V.fortTgt[V.selFort]; V.fortAim = null; renderBattlePanel(); },
  tacrot: () => { const V = R.bviz, b = G.battles.find(x => x.id === UI.battle); if (!V || !b) return; const f = (b.forts || []).find(x => x.id === V.selFort); if (f && f.kind === 'trench' && b.prep && f.side === playerSide(b)) { f.rot = f.rot ? 0 : 1; const w = f.w; f.w = f.h; f.h = w; tacLayoutFort(b, f); } else { V.rot = !V.rot; toast('↻', V.rot ? 'La próxima trinchera se colocará en vertical.' : 'La próxima trinchera se colocará en horizontal.'); } renderBattlePanel(); }
});
window.addEventListener('keydown', e => { if ((e.key === 'r' || e.key === 'R') && R.bviz && UI.battle) { const b = G.battles.find(x => x.id === UI.battle); if (b && b.prep) { ACT.tacrot(); e.stopPropagation(); } } }, true);
/* ---------- ciclo diario: reservas, cañones del fuerte y compromiso de la IA ---------- */
const _battleDay2 = battleDay;
battleDay = function (b) {
  if (!b.cmInit) { b.cmInit = true; const ps = playerSide(b); ['A', 'B'].forEach(s => { if (s !== ps) tacAiCommit(b, s); }); }
  const was = b.prep; _battleDay2(b); if (was || b.ended || !G.battles.includes(b)) return;
  tacFortDay(b); tacAiReinforce(b);
};
const _endBattle2 = endBattle;
endBattle = function (b, winner) {
  [b.A, b.B].forEach(ids => ids.map(armyById).filter(Boolean).forEach(a => a.divs.forEach(d => { delete d.out; delete d.rs; if (d.rg) d.rg.forEach(r => { r.out = false; delete r.plan; delete r.cust; r.dev = 0; r.devO = 0; }); })));
  _endBattle2(b, winner);
  const ps = playerSide(b); if (ps && b.pris && (b.pris[ps] || 0) >= 600 && typeof showPrisDialog === 'function') setTimeout(() => showPrisDialog(), 400);
};
/* ---------- prisioneros: qué hacer con ellos ---------- */
function prisOwners(tag) { const c = G.C[tag]; return c && c.pris ? Object.keys(c.pris).filter(o => c.pris[o] >= 100 && G.C[o]) : []; }
function prisCardHtml() {
  const me = G.player, owners = prisOwners(me); if (!owners.length) return '<div class="card"><h3>Prisioneros</h3><small class="dim">No tienes prisioneros en este momento. Se capturan al ganar batallas y al cercar y rendir divisiones.</small></div>';
  const mkB = (o, a, ic, nm, tip) => `<button data-act="pris" data-o="${o}" data-a="${a}" data-tip="${tip}">${ic} ${nm}</button>`;
  return `<div class="card pris"><h3>⛓️ Prisioneros de guerra</h3>${owners.map(o => { const n = Math.round(G.C[me].pris[o]); return `<div class="prisrow"><div class="prishead">${flag(o, 'sm')} <b>${G.C[o].name}</b> · ${fmtN(n, 0)} hombres</div><div class="ordbtns">
    ${mkB(o, 'release', '🔓', 'Liberar', 'Los devuelves a su país: +relaciones y +prestigio, −infamia.')}${mkB(o, 'labor', '⛓️', 'Trabajos forzados', 'Obtienes £ por su trabajo. Sube la infamia y empeora la relación.')}${mkB(o, 'exchange', '🤝', 'Canjear', 'Intercambio uno por uno con los prisioneros tuyos que tenga ese país.')}${mkB(o, 'ransom', '💰', 'Rescate', 'Se los devuelves a cambio de dinero (si pueden pagarlo).')}${mkB(o, 'recruit', '⚔️', 'Reclutar', 'Una parte forma una legión de baja calidad que combate por ti. Sube la infamia.')}${mkB(o, 'execute', '☠️', 'Ejecutar', 'Gran infamia y odio del enemigo, que resiste con más rabia. Pierdes prestigio.')}</div></div>`; }).join('')}
    <small class="dim">Mientras los retengas cuentan para la puntuación de la guerra; al firmar la paz regresan a casa.</small></div>`;
}
function showPrisDialog() {
  let e = document.getElementById('prisdlg'); if (!e) { e = document.createElement('div'); e.id = 'prisdlg'; document.body.appendChild(e); }
  e.innerHTML = `<div class="pd-box">${prisCardHtml()}<button class="primary" data-act="prisclose">Continuar</button></div>`; e.style.display = 'flex';
}
function prisReturn(tag, n) { const c = G.C[tag]; if (!c || !c.states.length) return; const left = n * 0.9; c.states.slice(0, 6).forEach(id => { G.S[id].pops.peasants = (G.S[id].pops.peasants || 0) + left / Math.min(6, c.states.length); }); }
function prisAction(owner, act) {
  const me = G.player, c = G.C[me], oc = G.C[owner]; if (!c || !c.pris || !(c.pris[owner] >= 100)) return {ok: false, msg: 'No hay prisioneros.'}; const n = c.pris[owner];
  if (act === 'release') { delete c.pris[owner]; prisReturn(owner, n); addRel(me, owner, 12); c.prestige += Math.min(6, n / 6000); c.infamy = Math.max(0, (c.infamy || 0) - Math.min(2, n / 20000)); return {ok: true, msg: `Liberas a ${fmtN(n, 0)} prisioneros: ${oc.name} lo recordará.`}; }
  if (act === 'labor') { c.prisWork = c.prisWork || {}; const fresh = n - (c.prisWork[owner] || 0); if (fresh < 100) return {ok: false, msg: 'Ya los has puesto a trabajar.'}; c.prisWork[owner] = n; const gain = fresh * 1.1; c.treasury += gain; c.infamy = (c.infamy || 0) + Math.min(4, fresh / 15000); addRel(me, owner, -8); return {ok: true, msg: `Trabajos forzados: +${money(gain)}. Sube la infamia.`}; }
  if (act === 'exchange') { const theirs = (oc.pris && oc.pris[me]) || 0, k = Math.min(n, theirs); if (k < 100) return {ok: false, msg: `${oc.name} no tiene prisioneros tuyos que canjear.`}; c.pris[owner] -= k; if (c.pris[owner] < 50) delete c.pris[owner]; oc.pris[me] -= k; if (oc.pris[me] < 50) delete oc.pris[me]; prisReturn(me, k); prisReturn(owner, k); addRel(me, owner, 4); return {ok: true, msg: `Canje: ${fmtN(k, 0)} hombres de cada bando vuelven a casa.`}; }
  if (act === 'ransom') { const price = n * 1.4, pay = Math.min(price, Math.max(0, oc.treasury) * 0.5); if (pay < n * 0.3) return {ok: false, msg: `${oc.name} no puede pagar un rescate.`}; oc.treasury -= pay; c.treasury += pay; delete c.pris[owner]; prisReturn(owner, n); addRel(me, owner, 2); return {ok: true, msg: `Rescate cobrado: +${money(pay)}.`}; }
  if (act === 'recruit') { const k = Math.floor(n * 0.45 / MEN_PER_DIV); if (k < 1) return {ok: false, msg: 'Hacen falta al menos unos 2.000 prisioneros para formar una unidad.'}; const loc = c.capital >= 0 ? stateCapitalProv(c.capital) : stateCapitalProv(c.states[0]); const divs = []; for (let i = 0; i < Math.min(k, 8); i++) { const d = mkDivision('inf', 0.05); d.s = 0.55; d.o = DIVS.inf.org * 0.5; divs.push(d); } mkArmy(me, loc, divs, 'Legión de prisioneros'); delete c.pris[owner]; c.infamy = (c.infamy || 0) + 3 + n / 20000; addRel(me, owner, -25); return {ok: true, msg: `${divs.length} divisiones de prisioneros reclutadas en tu capital. Sube la infamia.`}; }
  if (act === 'execute') { delete c.pris[owner]; c.infamy = (c.infamy || 0) + Math.min(15, 6 + n / 8000); c.prestige = Math.max(0, c.prestige - Math.min(10, n / 3000)); addRel(me, owner, -60); oc.wear = Math.max(0, (oc.wear || 0) - 5); return {ok: true, msg: `Ejecutas a los prisioneros: infamia y odio de ${oc.name}.`}; }
  return {ok: false, msg: ''};
}
Object.assign(ACT, {
  pris: d => { const r = prisAction(d.o, d.a); if (r.msg) toast(r.ok ? '⛓️' : '⚠️', r.msg); const e = document.getElementById('prisdlg'); if (e && e.style.display !== 'none') showPrisDialog(); if (typeof renderWindow === 'function' && UI.win) renderWindow(); },
  prisclose: () => { const e = document.getElementById('prisdlg'); if (e) { e.style.display = 'none'; e.innerHTML = ''; } },
  prisopen: () => showPrisDialog()
});
