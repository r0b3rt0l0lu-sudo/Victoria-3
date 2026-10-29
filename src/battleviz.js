/* ===== COMBATE TÁCTICO ANIMADO: cada soldado se mueve por su cuenta según la estrategia de cada bando ===== */
const BV_W = 720, BV_H = 300;
const BV_FIGS = {inf: 10, cav: 5, art: 3};
function bvNew(b) {
  return {id: b.id, groups: new Map(), units: [], corpses: [], parts: [], t: 0, last: performance.now(), dayT: performance.now(), day: b.day, evSeq: b.evSeq || 0,
    adv: b.adv || 0, banner: null, rain: 0, man: {A: null, B: null}, boost: {A: 0, B: 0}, panic: {A: 0, B: 0}, salvo: {A: 0, B: 0}, over: null, shotAcc: {A: 0, B: 0}, seed: b.id * 77 + 5};
}
// sincroniza grupos y soldados con las divisiones reales de la batalla
function bvSync(V, b) {
  const seen = new Set();
  ['A', 'B'].forEach(side => {
    const ids = side === 'A' ? b.A : b.B, list = [];
    ids.map(armyById).filter(Boolean).forEach(a => a.divs.forEach(d => list.push({a, d})));
    const nFront = Math.min(list.length, BATTLE_WIDTH);
    list.forEach((it, i) => {
      seen.add(it.d); let g = V.groups.get(it.d);
      if (!g) {
        g = {d: it.d, side, type: it.d.t, units: [], color: G.C[it.a.tag].color};
        const nf = BV_FIGS[g.type]; for (let k = 0; k < nf; k++) { const u = {g, side, type: g.type, k, x: side === 'A' ? -20 : BV_W + 20, y: BV_H / 2, vx: 0, vy: 0, alive: true, dying: 0, flee: 0, face: side === 'A' ? 0 : Math.PI, flash: 0, ph: Math.random() * 6.28}; g.units.push(u); V.units.push(u); }
        V.groups.set(it.d, g);
      }
      g.front = i < nFront; g.idx = i; g.n = g.front ? nFront : list.length - nFront; g.ri = g.front ? i : i - nFront;
      // bajas: soldados vivos según la fuerza de la división
      const want = Math.ceil(g.units.length * clamp(it.d.s, 0, 1)), alive = g.units.filter(u => u.alive);
      for (let n = alive.length; n > want; n--) { const cand = g.units.filter(u => u.alive); const u = cand[Math.floor(Math.random() * cand.length)]; bvKill(V, u); }
    });
  });
  V.groups.forEach((g, d) => { if (!seen.has(d)) { g.units.forEach(u => { if (u.alive && !u.flee) bvFlee(V, u, 1); }); V.groups.delete(d); } });
}
function bvKill(V, u) { u.alive = false; u.dying = 0.8; V.corpses.push({x: u.x, y: u.y, side: u.side, color: u.g.color, age: 0, type: u.type}); if (V.corpses.length > 420) V.corpses.shift(); }
function bvFlee(V, u, power) { if (!u.alive) return; u.flee = 3.5; const away = u.side === 'A' ? -1 : 1; u.fvx = away * rnd(50, 120) * power + rnd(-25, 25); u.fvy = rnd(-70, 70) * power; }
function bvPart(V, p) { if (V.parts.length < 700) V.parts.push(Object.assign({age: 0}, p)); }
function bvBanner(V, text, side, icon) { V.banner = {text, side, icon, age: 0}; }
const EV_NAME = {charge: '¡Carga desesperada!', cav: 'Carga de caballería', barrage: 'Cañoneo', flank: 'Flanqueo', panic: 'Pánico', reinf: 'Refuerzos', rain: 'Lluvia'};
function bvEvent(V, b, kind, side) {
  const opp = side === 'A' ? 'B' : 'A';
  bvBanner(V, `${EV_NAME[kind] || kind} · ${G.C[(side === 'A' ? b.A0 : b.B0)].name}`, side, EV_ICON[kind]);
  if (kind === 'charge') { V.boost[side] = 2.4; }
  else if (kind === 'cav') V.man[side] = {kind: 'gallop', t: 0, dur: 2.6};
  else if (kind === 'flank') V.man[side] = {kind: 'flank', t: 0, dur: 3.4};
  else if (kind === 'barrage') V.salvo[side] = 10;
  else if (kind === 'panic') V.panic[side] = 2.4;
  else if (kind === 'rain') V.rain = 5;
  else if (kind === 'reinf') { const gs = [...V.groups.values()].filter(g => g.side === side && g.front).slice(0, 3); gs.forEach(g => { for (let n = 0; n < 2; n++) bvPart(V, {k: 'spark', x: side === 'A' ? 20 : BV_W - 20, y: rnd(40, BV_H - 40), life: 1.2}); }); }
  void opp;
}
function bvStrat(b, side) { return (side === 'A' ? b.strA : b.strB) || 'frontal'; }
// posición de la línea de cada bando según estrategia y momento
function bvLine(V, b, side) {
  const x0 = BV_W / 2 + V.adv * 85, st = bvStrat(b, side), att = b.att === side, dir = side === 'A' ? 1 : -1;
  const frac = clamp((performance.now() - V.dayT) / Math.max(400, (UI.speed ? SPEED_MS[UI.speed] : 750)), 0, 1), dday = b.day - 1 + frac;
  let gap = 34;
  if (st === 'frontal') gap = att ? 24 + 11 * Math.sin(V.t * 1.6) : 36;
  else if (st === 'hold') gap = att ? 52 : 52 + 22;
  else if (st === 'skirmish') gap = 62 + 8 * Math.sin(V.t * 2.1);
  else if (st === 'charge') gap = clamp(60 - dday * 20, 7, 60) + 4 * Math.sin(V.t * 9);
  else if (st === 'barrage') gap = b.day <= 3 ? 88 : 36;
  else if (st === 'flank') gap = 42;
  if (V.boost[side] > 0) gap = 6;
  return x0 - dir * gap;
}
function bvFrame(V, b, ctx, now) {
  const dt = Math.min(0.05, (now - V.last) / 1000); V.last = now; V.t += dt;
  if (b.day !== V.day) { V.day = b.day; V.dayT = now; }
  V.adv += ((b.adv || 0) - V.adv) * Math.min(1, dt * 2.2);
  if ((b.evSeq || 0) !== V.evSeq) { V.evSeq = b.evSeq; bvEvent(V, b, b.evK, b.evS); }
  if (!b.ended) bvSync(V, b); else if (!V.over) {
    const log = (G.battleLog || []).find(x => x.id === b.id), loserSide = log && log.winner === b.A0 ? 'B' : 'A';
    V.over = {loser: loserSide, t: 0}; bvBanner(V, `Victoria de ${G.C[loserSide === 'A' ? b.B0 : b.A0].name}`, loserSide === 'A' ? 'B' : 'A', '🏳️');
    V.units.forEach(u => { if (u.alive) { if (u.side === loserSide) bvFlee(V, u, 1.4); } });
  }
  if (V.over) V.over.t += dt;
  const lines = {A: bvLine(V, b, 'A'), B: bvLine(V, b, 'B')};
  ['A', 'B'].forEach(s => { if (V.boost[s] > 0) V.boost[s] -= dt; if (V.panic[s] > 0) V.panic[s] -= dt; if (V.man[s]) { V.man[s].t += dt; if (V.man[s].t > V.man[s].dur) V.man[s] = null; } });
  if (V.rain > 0) V.rain -= dt;
  const frac = clamp((now - V.dayT) / Math.max(400, (UI.speed ? SPEED_MS[UI.speed] : 750)), 0, 1);
  // ---- movimiento de los soldados ----
  V.units.forEach(u => {
    if (u.dying > 0) { u.dying -= dt; return; }
    if (!u.alive) return;
    const g = u.g, dir = u.side === 'A' ? 1 : -1, opp = u.side === 'A' ? 'B' : 'A', st = bvStrat(b, u.side), L = lines[u.side], LE = lines[opp];
    u.flash = Math.max(0, u.flash - dt);
    if (u.flee > 0) {       // huida descontrolada
      u.flee -= dt; u.vx += (u.fvx - u.vx) * Math.min(1, dt * 3); u.vy += (u.fvy - u.vy + rnd(-60, 60)) * Math.min(1, dt * 3);
      u.x += u.vx * dt; u.y += u.vy * dt; u.face = Math.atan2(u.vy, u.vx);
      if (V.t % 0.12 < dt) bvPart(V, {k: 'dust', x: u.x, y: u.y + 3, life: 0.7, r: 2});
      if (u.x < -30 || u.x > BV_W + 30 || u.y < 10 || u.y > BV_H - 10 || u.flee <= 0 && !V.over) { if (u.x < -30 || u.x > BV_W + 30 || u.y < 10 || u.y > BV_H - 10) { u.alive = false; u.dying = 0; u.gone = true; } else if (u.flee <= 0) { u.flee = 0; } }
      return;
    }
    // objetivo de la formación
    const nF = Math.max(1, Math.min(BATTLE_WIDTH, g.n || 1)), bandH = (BV_H - 80) / nF;
    let tx, ty, speed = 38, k = u.k, nf = g.units.length;
    if (g.front) {
      const cy = 40 + (g.ri + 0.5) * bandH;
      if (g.type === 'inf') { const col = k % 2, row = Math.floor(k / 2); tx = L - dir * (col * 8 + row % 2 * 3); ty = cy + (row - 2) * Math.min(7, bandH / 6); }
      else if (g.type === 'cav') { tx = L - dir * 22; ty = cy + (k - 2) * Math.min(8, bandH / 5); speed = 55; }
      else { tx = L - dir * 62; ty = cy + (k - 1) * Math.min(14, bandH / 3); }
    } else { const cy = 40 + ((g.ri + 0.5) / Math.max(1, g.n)) * (BV_H - 80); const col = 1 + (g.idx % 2); tx = L - dir * (90 + col * 30) - (k % 2) * 8; ty = cy + (Math.floor(k / 2) - 1) * 7; }
    // comportamiento propio de cada estrategia
    const oppSide = opp, myDef = b.att !== u.side;
    if (st === 'skirmish') { tx += Math.sin(V.t * 1.7 + u.ph) * 14 * dir; ty += Math.cos(V.t * 1.3 + u.ph * 2) * 12; speed = 55; }
    else if (st === 'frontal' && !myDef && g.front) { tx += dir * Math.max(0, Math.sin(V.t * 1.2 + g.idx)) * 8; }
    else if (st === 'charge') { speed = 90; if (g.front && V.t * 0 + (b.day > 1 || frac > 0.3)) tx += dir * 10; }
    if (V.boost[u.side] > 0 && g.front) { speed = g.type === 'cav' ? 190 : 120; tx = LE + dir * rnd(-4, 6); }
    if (V.panic[u.side] > 0 && g.front && (u.k * 7 + g.idx * 3) % 10 < 3) { tx = L - dir * 120; ty += Math.sin(u.ph) * 30; speed = 95; }
    // maniobras de la caballería (flanqueo y galope)
    const m = V.man[u.side];
    const flankStrat = st === 'flank' && g.type === 'cav' && g.front;
    if (g.type === 'cav' && (flankStrat || (m && m.kind !== 'gallop' && g.front) || (m && m.kind === 'gallop' && g.front))) {
      let p, style;
      if (m && m.kind === 'gallop') { p = m.t / m.dur; style = 'gallop'; }
      else if (m && m.kind === 'flank') { p = m.t / m.dur; style = 'flank'; }
      else { p = clamp((b.day - 1 - (b['ss' + u.side] - 1) + frac) / 2.6, 0, 1); style = 'flank'; }
      const top = (g.idx % 2 === 0) ? 18 : BV_H - 18, sx0 = L - dir * 22, sy0 = 40 + (g.ri + 0.5) * bandH;
      if (style === 'flank') {
        const ex = LE + dir * 4, ey = top < 100 ? 60 : BV_H - 60, mx = (sx0 + ex) / 2, my = top;
        const q = Math.min(1, p); tx = (1 - q) * (1 - q) * sx0 + 2 * (1 - q) * q * mx + q * q * ex; ty = (1 - q) * (1 - q) * sy0 + 2 * (1 - q) * q * my + q * q * ey + (k - 2) * 5; speed = 140;
        if (p >= 1) { tx = ex + Math.sin(V.t * 6 + u.ph) * 6; ty += Math.sin(V.t * 4 + u.ph) * 8; }
      } else { const q = p < 0.5 ? p * 2 : 2 - p * 2; tx = sx0 + (LE - sx0) * q + dir * 6 * q; ty = sy0 + (k - 2) * 6; speed = 200; }
    }
    // los grupos de artillería no avanzan
    if (g.type === 'art' && st === 'hold') { tx -= 0; }
    if (V.over && V.over.loser !== u.side) { tx += dir * 40 * Math.min(1, V.over.t / 3); }
    // la defensa "en los altos" se retrae a la loma
    if (st === 'hold' && myDef) tx += dir * -0;
    const dx = tx - u.x, dy = ty - u.y, d = Math.hypot(dx, dy) || 1;
    const want = Math.min(speed, d * 3.2);
    u.vx += (dx / d * want - u.vx) * Math.min(1, dt * 6); u.vy += (dy / d * want - u.vy) * Math.min(1, dt * 6);
    u.x += u.vx * dt; u.y += u.vy * dt;
    u.face = d > 4 ? Math.atan2(u.vy, u.vx) : (dir > 0 ? 0 : Math.PI);
  });
  // moral baja: algunos soldados rompen filas
  ['A', 'B'].forEach(s => {
    const org = s === 'A' ? b.orgA : b.orgB;
    if (!b.ended && org !== undefined && org < 0.3 && Math.random() < dt * 1.4) { const c = V.units.filter(u => u.side === s && u.alive && !u.flee && u.g.front); if (c.length) bvFlee(V, c[Math.floor(Math.random() * c.length)], 1); }
    if (V.panic[s] > 0 && Math.random() < dt * 3) { const c = V.units.filter(u => u.side === s && u.alive && !u.flee && u.g.front); if (c.length) { const u = c[Math.floor(Math.random() * c.length)]; u.flee = 1.2; u.fvx = (s === 'A' ? -1 : 1) * rnd(60, 100); u.fvy = rnd(-60, 60); } }
  });
  // ---- disparos, cañoneo y humo ----
  if (!b.ended) ['A', 'B'].forEach(s => {
    const mine = V.units.filter(u => u.side === s && u.alive && !u.flee && u.g.front && u.type !== 'art'), foe = V.units.filter(u => u.side !== s && u.alive && !u.flee), dir = s === 'A' ? 1 : -1;
    if (!mine.length || !foe.length) return;
    const st = bvStrat(b, s), close = Math.abs(lines.A - lines.B) < 150;
    V.shotAcc[s] += dt * (st === 'skirmish' ? 22 : st === 'hold' ? 16 : 13) * (close ? 1 : 0.2);
    while (V.shotAcc[s] > 1) { V.shotAcc[s]--; const u = mine[Math.floor(Math.random() * mine.length)], t = foe[Math.floor(Math.random() * foe.length)]; if (Math.abs(t.x - u.x) > 170) continue;
      bvPart(V, {k: 'flash', x: u.x + dir * 4, y: u.y, life: 0.1}); bvPart(V, {k: 'smoke', x: u.x + dir * 6, y: u.y - 1, life: 1.5, r: 3, vx: dir * 4}); bvPart(V, {k: 'tracer', x: u.x, y: u.y, x2: t.x, y2: t.y + rnd(-3, 3), life: 0.07}); u.flash = 0.12; }
    // artillería
    V.units.forEach(u => { if (u.side !== s || u.type !== 'art' || !u.alive || u.flee) return; u.cd = (u.cd === undefined ? rnd(0, 2) : u.cd) - dt;
      const heavy = st === 'barrage' || V.salvo[s] > 0; if (u.cd <= 0) { u.cd = heavy ? rnd(0.7, 1.3) : rnd(2.4, 4.2); const tx = (s === 'A' ? lines.B : lines.A) + dir * rnd(-10, 30), ty = rnd(50, BV_H - 50); bvPart(V, {k: 'shell', x: u.x, y: u.y, x2: tx, y2: ty, life: 0.8}); bvPart(V, {k: 'flash', x: u.x + dir * 10, y: u.y, life: 0.15}); bvPart(V, {k: 'smoke', x: u.x + dir * 12, y: u.y, life: 2.2, r: 5, vx: dir * 6}); u.flash = 0.2; if (V.salvo[s] > 0) V.salvo[s]--; } });
  });
  // partículas
  V.parts.forEach(p => { p.age += dt; if (p.k === 'smoke') { p.x += (p.vx || 0) * dt; p.y -= 6 * dt; } if (p.k === 'dust') p.y -= 4 * dt; if (p.k === 'shell' && p.age >= p.life && !p.hit) { p.hit = true; bvPart(V, {k: 'boom', x: p.x2, y: p.y2, life: 0.55}); bvPart(V, {k: 'smoke', x: p.x2, y: p.y2, life: 2.4, r: 6, vx: rnd(-4, 4)});
      V.units.forEach(u => { if (u.alive && Math.hypot(u.x - p.x2, u.y - p.y2) < 22 && u.side !== p.s) { u.vx += (u.x - p.x2) * 3; u.vy += (u.y - p.y2) * 3; } }); } });
  V.parts = V.parts.filter(p => p.age < p.life + (p.k === 'shell' ? 0.05 : 0));
  V.corpses.forEach(c => c.age += dt); V.units = V.units.filter(u => !u.gone && (u.alive || u.dying > 0 || u.flee > 0));
  if (V.banner) { V.banner.age += dt; if (V.banner.age > 2.8) V.banner = null; }
  bvDraw(V, b, ctx, lines);
}
function bvDraw(V, b, g, lines) {
  const W = BV_W, H = BV_H, pv = MAP.provs[b.prov], bc = BIOME_COL[pv.biome] || [110, 140, 85];
  const grd = g.createLinearGradient(0, 0, 0, H); grd.addColorStop(0, `rgb(${bc[0] * 0.78 | 0},${bc[1] * 0.78 | 0},${bc[2] * 0.78 | 0})`); grd.addColorStop(1, `rgb(${bc[0] * 0.55 | 0},${bc[1] * 0.55 | 0},${bc[2] * 0.55 | 0})`);
  g.fillStyle = grd; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 90; i++) { const x = hash2(i, V.seed, 3) * W, y = 26 + hash2(i, V.seed, 7) * (H - 30), t = pv.biome; g.fillStyle = 'rgba(0,0,0,.14)'; if (t === 2 || t === 6) { g.beginPath(); g.moveTo(x, y - 9); g.lineTo(x - 5, y + 3); g.lineTo(x + 5, y + 3); g.fill(); } else if (t === 7 || t === 8) { g.beginPath(); g.moveTo(x, y - 11); g.lineTo(x - 9, y + 5); g.lineTo(x + 9, y + 5); g.fill(); } else g.fillRect(x, y, 5, 1.4); }
  // loma de la defensa "en los altos"
  ['A', 'B'].forEach(s => { if (bvStrat(b, s) === 'hold') { const dir = s === 'A' ? 1 : -1, cx = lines[s] - dir * 26; g.fillStyle = 'rgba(70,52,30,.38)'; g.beginPath(); g.ellipse(cx, H / 2 + 6, 46, H / 2 - 36, 0, 0, 6.3); g.fill(); g.strokeStyle = 'rgba(240,220,170,.22)'; g.lineWidth = 2; g.beginPath(); g.ellipse(cx, H / 2, 40, H / 2 - 42, 0, 0, 6.3); g.stroke(); } });
  // línea central
  g.strokeStyle = 'rgba(255,230,150,.22)'; g.setLineDash([5, 6]); g.beginPath(); const mx = (lines.A + lines.B) / 2; g.moveTo(mx, 24); g.lineTo(mx, H - 4); g.stroke(); g.setLineDash([]);
  // caídos
  V.corpses.forEach(c => { g.globalAlpha = Math.max(0.15, 0.7 - c.age * 0.01); g.fillStyle = '#1c1612'; g.fillRect(c.x - 2.5, c.y - 1, 5, 2); g.fillStyle = c.color; g.fillRect(c.x - 1.5, c.y - 1, 3, 2); }); g.globalAlpha = 1;
  // partículas de fondo (humo)
  V.parts.forEach(p => { if (p.k !== 'smoke' && p.k !== 'dust') return; const k = p.age / p.life; g.globalAlpha = (p.k === 'smoke' ? 0.38 : 0.28) * (1 - k); g.fillStyle = p.k === 'smoke' ? '#b8b4ac' : '#a89878'; g.beginPath(); g.arc(p.x, p.y, (p.r || 3) * (1 + k * 2.2), 0, 6.3); g.fill(); }); g.globalAlpha = 1;
  // soldados (ordenados por y)
  const us = V.units.filter(u => u.alive || u.dying > 0).sort((a, b2) => a.y - b2.y);
  us.forEach(u => {
    const fall = u.dying > 0 ? 1 - u.dying / 0.8 : 0; if (fall > 0) g.globalAlpha = 1 - fall * 0.7;
    const col = u.g.color, x = u.x, y = u.y + (fall ? fall * 2 : 0), moving = Math.hypot(u.vx, u.vy) > 12, bob = moving ? Math.sin(V.t * 14 + u.ph) * 0.7 : 0, fl = u.flee > 0;
    g.fillStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.ellipse(x, y + 3, 3.4, 1.3, 0, 0, 6.3); g.fill();
    if (u.type === 'inf') { g.fillStyle = fl ? '#d9cfae' : col; g.strokeStyle = '#10161b'; g.lineWidth = 0.8; g.beginPath(); g.arc(x, y - 2 + bob, 2.9, 0, 6.3); g.fill(); g.stroke(); g.fillStyle = '#e3c29a'; g.fillRect(x - 0.9, y - 5.6 + bob, 1.8, 1.8); if (!fl) { g.strokeStyle = '#2a2a2e'; g.lineWidth = 1; g.beginPath(); g.moveTo(x, y - 2 + bob); g.lineTo(x + Math.cos(u.face) * 6, y - 2 + bob + Math.sin(u.face) * 6 * 0.6); g.stroke(); } }
    else if (u.type === 'cav') { g.fillStyle = '#6b4a2b'; g.beginPath(); g.ellipse(x, y - 2 + bob, 6, 2.8, Math.atan2(u.vy, u.vx || (u.side === 'A' ? 1 : -1)) * 0.4, 0, 6.3); g.fill(); g.fillStyle = col; g.beginPath(); g.arc(x, y - 5 + bob, 2.4, 0, 6.3); g.fill(); g.strokeStyle = '#d8d8e0'; g.lineWidth = 0.9; g.beginPath(); g.moveTo(x, y - 5 + bob); g.lineTo(x + Math.cos(u.face) * 7, y - 7 + bob); g.stroke(); }
    else { g.fillStyle = '#4a3a28'; g.fillRect(x - 5, y - 2, 10, 4); g.fillStyle = col; g.fillRect(x - 3, y - 3.5, 6, 2); g.strokeStyle = '#55595e'; g.lineWidth = 2.2; const dx = u.side === 'A' ? 1 : -1; g.beginPath(); g.moveTo(x, y - 2); g.lineTo(x + dx * 11, y - 3); g.stroke(); g.fillStyle = '#3a2a18'; g.beginPath(); g.arc(x - dx * 1, y + 2, 2.2, 0, 6.3); g.fill(); }
    g.globalAlpha = 1;
  });
  // proyectiles y destellos
  V.parts.forEach(p => { const k = p.age / p.life; if (p.k === 'flash') { g.fillStyle = `rgba(255,235,150,${1 - k})`; g.beginPath(); g.arc(p.x, p.y, 3.4 * (1 - k * 0.3), 0, 6.3); g.fill(); }
    else if (p.k === 'tracer') { g.strokeStyle = `rgba(255,240,180,${0.55 * (1 - k)})`; g.lineWidth = 0.7; g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x + (p.x2 - p.x) * Math.min(1, k * 2), p.y + (p.y2 - p.y) * Math.min(1, k * 2)); g.stroke(); }
    else if (p.k === 'shell') { const q = Math.min(1, k), x = p.x + (p.x2 - p.x) * q, y = p.y + (p.y2 - p.y) * q - Math.sin(q * 3.14) * 46; g.fillStyle = '#222'; g.beginPath(); g.arc(x, y, 2.2, 0, 6.3); g.fill(); g.strokeStyle = 'rgba(255,200,120,.4)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x, y); g.lineTo(x - (p.x2 - p.x) * 0.06, y + 3); g.stroke(); }
    else if (p.k === 'boom') { g.fillStyle = `rgba(255,${150 + (1 - k) * 80 | 0},40,${0.9 * (1 - k)})`; g.beginPath(); g.arc(p.x, p.y, 4 + k * 16, 0, 6.3); g.fill(); g.strokeStyle = `rgba(60,40,20,${0.6 * (1 - k)})`; g.lineWidth = 2; g.beginPath(); g.arc(p.x, p.y, 6 + k * 22, 0, 6.3); g.stroke(); }
    else if (p.k === 'spark') { g.fillStyle = `rgba(180,255,180,${1 - k})`; g.beginPath(); g.arc(p.x, p.y - k * 14, 2.5, 0, 6.3); g.fill(); } });
  if (V.rain > 0) { g.strokeStyle = 'rgba(180,205,255,.5)'; g.lineWidth = 1; for (let i = 0; i < 70; i++) { const x = ((hash2(i, 3, 9) * W * 1.2 + V.t * 140) % (W + 40)), y = ((hash2(i, 5, 9) * H * 1.2 + V.t * 420) % (H + 20)); g.beginPath(); g.moveTo(x, y); g.lineTo(x - 5, y + 11); g.stroke(); } g.fillStyle = 'rgba(40,60,90,.18)'; g.fillRect(0, 0, W, H); }
  // marcador de dominio
  const orgA = b.orgA === undefined ? 1 : b.orgA, orgB = b.orgB === undefined ? 1 : b.orgB, m = clamp(0.5 + (b.adv || 0) * 0.28 + (orgA - orgB) * 0.28, 0.04, 0.96);
  const ca = G.C[b.A0].color, cb2 = G.C[b.B0].color;
  g.fillStyle = 'rgba(8,12,16,.7)'; g.fillRect(0, 0, W, 20); g.fillStyle = ca; g.fillRect(0, 2, W * m, 6); g.fillStyle = cb2; g.fillRect(W * m, 2, W * (1 - m), 6);
  g.fillStyle = '#fff'; g.fillRect(W * m - 1, 0, 2, 10);
  g.font = 'bold 11px sans-serif'; g.textBaseline = 'middle'; g.fillStyle = '#f5ecd0'; g.textAlign = 'left'; g.fillText(`${STRATS[bvStrat(b, 'A')].icon} ${STRATS[bvStrat(b, 'A')].name}`, 6, 14); g.textAlign = 'right'; g.fillText(`${STRATS[bvStrat(b, 'B')].name} ${STRATS[bvStrat(b, 'B')].icon}`, W - 6, 14);
  g.textAlign = 'center'; g.fillStyle = '#ffe28a'; g.fillText(b.ended ? 'Batalla terminada' : m > 0.58 ? `Va ganando ${G.C[b.A0].name}` : m < 0.42 ? `Va ganando ${G.C[b.B0].name}` : 'Combate igualado', W / 2, 14);
  if (V.banner) { const k = V.banner.age, a = k < 0.3 ? k / 0.3 : k > 2.3 ? (2.8 - k) / 0.5 : 1; g.globalAlpha = clamp(a, 0, 1); g.fillStyle = 'rgba(10,12,16,.78)'; g.fillRect(W / 2 - 170, H - 46, 340, 28); g.fillStyle = V.banner.side === 'A' ? '#ffb89c' : '#a8d0ff'; g.font = 'bold 14px sans-serif'; g.textAlign = 'center'; g.fillText(`${V.banner.icon || ''} ${V.banner.text}`, W / 2, H - 31); g.globalAlpha = 1; }
}
// bucle de animación del panel
let _bvRaf = 0;
function bvStart() { if (_bvRaf) return; const loop = t => { _bvRaf = 0; const cv = document.getElementById('bmap'); if (!cv || !UI.battle) return; let b = G.battles.find(x => x.id === UI.battle); if (!b && G.lastEnded && G.lastEnded.id === UI.battle) b = G.lastEnded; if (!b) return; R.bviz = R.bviz && R.bviz.id === b.id ? R.bviz : bvNew(b); bvFrame(R.bviz, b, cv.getContext('2d'), performance.now()); _bvRaf = requestAnimationFrame(loop); }; _bvRaf = requestAnimationFrame(loop); }
