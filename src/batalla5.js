/* ===== BATALLA 5 (parte 1 del plan «más realismo»): enfilada, tiradores, calidad de tropas, munición y proyectiles de artillería =====
   · ENFILADA: disparar a lo largo de una línea (desde más allá de su extremo) es mucho más letal que de frente y no se puede devolver.
   · TIRADORES: cada cuerpo de infantería despliega una cadena de escaramuzadores que hostiga al enemigo que se acerca y se repliega ante la línea o la caballería.
   · CALIDAD: levas, reclutas, regulares y veteranos (según el entrenamiento) y el perfil de cada ejército cambian la cadencia, la moral y la respuesta a las órdenes.
   · ARTILLERÍA: munición limitada con carros que la reponen desde retaguardia, y tres proyectiles (bala, granada, metralla de bote) con efectos distintos. */
/* ---------- calidad de las tropas ---------- */
const QUAL = {
  leva: {n: 'Leva', ic: '🪵', fire: 0.78, mor: 0.82, ord: 1.4, ammo: 1.4, rec: -0.004},
  recluta: {n: 'Recluta', ic: '🌱', fire: 0.9, mor: 0.92, ord: 1.2, ammo: 1.25, rec: -0.002},
  regular: {n: 'Regular', ic: '🪖', fire: 1, mor: 1, ord: 1, ammo: 1, rec: 0},
  veterano: {n: 'Veterano', ic: '⭐', fire: 1.12, mor: 1.06, ord: 0.85, ammo: 0.9, rec: 0.004}
};
// pequeño perfil histórico por ejército (se ignoran las etiquetas que no existan)
const NAT_Q = {PRU: {fire: 0, mor: 0.03, ord: -0.1, ammo: 0}, GBR: {fire: 0.08, mor: 0.03, ord: 0, ammo: -0.05}, FRA: {fire: 0, mor: 0.02, ord: 0.05, ammo: 0}, RUS: {fire: -0.04, mor: 0.06, ord: 0.15, ammo: 0.05}, AUS: {fire: 0, mor: -0.02, ord: 0.1, ammo: 0}, USA: {fire: 0.04, mor: 0, ord: 0.05, ammo: 0}, TUR: {fire: -0.03, mor: 0.02, ord: 0.12, ammo: 0.05}};
function bvQual(k) { const d = k.d, tr = d.tr === undefined ? 0.5 : d.tr, key = d.lv ? 'leva' : tr < 0.3 ? 'recluta' : tr < 0.72 ? 'regular' : 'veterano', Q = QUAL[key], N = NAT_Q[k.tag] || {}; return {key, n: Q.n, ic: Q.ic, fire: Q.fire * (1 + (N.fire || 0)), mor: Math.min(1.1, Q.mor + (N.mor || 0)), ord: Q.ord * (1 + (N.ord || 0)), ammo: Q.ammo * (1 + (N.ammo || 0)), rec: Q.rec}; }
const _bvFireB5 = bvFire;
bvFire = function (V, b, blk, dt, foes) { if (blk.type === 'inf' || blk.type === 'cav') { const q = bvQual(blk); dt *= q.fire; } _bvFireB5(V, b, blk, dt, foes); };
const _fmFrictionB5 = fmFriction;
fmFriction = function (V, b, c) { const r = _fmFrictionB5(V, b, c), ls = (c.blks || []).filter(k => k.role === 'line'), q = ls.length ? ls.reduce((n, k) => n + bvQual(k).ord, 0) / ls.length : 1; r.delay = +(r.delay * q).toFixed(1); if (!r.mis && Math.random() < 0.04 * Math.max(0, q - 1)) r.mis = true; return r; };
function bvQualStep(V, b, all, step) { all.forEach(k => { if (k.type === 'art' || k.mm === undefined || k.mode === 'rout') return; const q = bvQual(k); if (!k.qInit) { k.qInit = 1; k.mm = clamp(k.mm * q.mor, 0, 1); } k.mm = clamp(k.mm + q.rec * step, 0, 1); }); }
/* ---------- fuego enfilado ---------- */
function tacEnfilade(V, b, all, step) {
  b.enf = b.enf || {A: 0, B: 0}; const cnt = {A: 0, B: 0}, tot = {A: 0, B: 0}, now = performance.now();
  all.forEach(f => { if (f.type !== 'art' && f.mode !== 'rout' && f.role !== 'reserve' && !f.garr) tot[f.side]++; });
  all.forEach(e => {
    if (e.mode === 'rout' || e.mode === 'melee' || e.mode === 'charge' || e.mode === 'gallop' || e.mode === 'retreat') return; const art = e.type === 'art';
    const f = art ? (now - (e.fireAt || -1e9) < 6000 ? e.tgt : null) : (e.mode === 'fire' || e.mode === 'skirmish' ? e.foe : null);
    if (!f || f.side === e.side || f.mode === 'rout' || f.type === 'art' || f.role === 'reserve' || f.garr || f.anc && !art) return;
    const dx = Math.abs(e.x - f.x), dy = Math.abs(e.y - f.y), d = Math.hypot(dx, dy); if (d > (art ? 420 : 210) || d < 25 || dy < dx * 2) return;          // el tirador está en el eje de la línea, no enfrente
    const k = art ? 1.7 : 1; cnt[f.side]++; f.enfT = V.t; f.enfFrom = {x: e.x, y: e.y};
    f.d.s = Math.max(0, f.d.s - 0.0011 * k * step); f.d.o = Math.max(0, f.d.o - DIVS[f.d.t].org * 0.006 * k * step); if (f.mm !== undefined) f.mm = Math.max(0, f.mm - 0.012 * k * step);
  });
  ['A', 'B'].forEach(s => { b.enf[s] = tot[s] ? Math.min(1, cnt[s] / tot[s] * 1.5) : 0; });
}
const _sideStatsB5 = sideStats;
sideStats = function (b, ids, isAttacker) {
  const r = _sideStatsB5(b, ids, isAttacker), key = ids === b.A ? 'A' : ids === b.B ? 'B' : null; if (!key || !b.enf) return r; const mine = b.enf[key] || 0, foe = b.enf[key === 'A' ? 'B' : 'A'] || 0;
  r.cas *= 1 + 0.4 * mine; r.T *= 1 - 0.1 * mine; r.F *= 1 + 0.08 * foe; return r;
};
/* ---------- tiradores (escaramuzadores) ---------- */
function bvScreens(V, b, all, step) {
  b.scrOff = b.scrOff || {}; const cavs = all.filter(o => o.type === 'cav' && (o.mode === 'gallop' || o.mode === 'charge'));
  (V.corps || []).forEach(c => {
    const ls = (c.blks || []).filter(k => k.role === 'line' && k.type === 'inf' && !k.garr && k.mode !== 'rout' && !k.d.out); if (ls.length < 2) { c.scr = 0; return; } if (c.scr === undefined) c.scr = 1;
    if (b.scrOff[c.id]) { c.scr = Math.max(0, c.scr - 0.3 * step); c.scrIn = true; return; }
    const cx = ls.reduce((n, k) => n + k.x, 0) / ls.length, cy = ls.reduce((n, k) => n + k.y, 0) / ls.length, foes = all.filter(o => o.side !== c.side && o.type !== 'art' && o.mode !== 'rout' && o.role !== 'reserve');
    let dn = 1e9, near = null; foes.forEach(o => { const d = Math.min(...ls.map(k => Math.hypot(k.x - o.x, k.y - o.y))); if (d < dn) { dn = d; near = o; } });
    const cav = cavs.some(o => o.side !== c.side && Math.hypot(o.x - cx, o.y - cy) < 230), melee = ls.some(k => k.mode === 'melee' || k.mode === 'charge');
    c.scrIn = dn < 115 || cav || melee;
    if (cav && c.scr > 0.3) { c.scr = Math.max(0, c.scr - 0.5); ls[0].d.s = Math.max(0, ls[0].d.s - 0.003); if (!V.replay && Math.random() < 0.5) bvBanner(V, `🐎 La caballería arrolla la cadena de tiradores del ${corpsName(c)}`, c.side === 'A' ? 'B' : 'A', ''); }
    else if (c.scrIn) c.scr = Math.max(0, c.scr - 0.18 * step);
    else if (dn < 260 && near && c.scr > 0.2) { near.d.s = Math.max(0, near.d.s - 0.0006 * c.scr * step); near.d.o = Math.max(0, near.d.o - DIVS[near.d.t].org * 0.003 * c.scr * step); near.fat = Math.min(1, (near.fat || 0) + 0.004 * step); if (near.mm !== undefined) near.mm = Math.max(0, near.mm - 0.002 * c.scr * step); }
    else if (dn > 300) c.scr = Math.min(1, c.scr + 0.03 * step);
  });
}
const _tacPlanFxB5 = tacPlanFx;
tacPlanFx = function (V, b, all) {
  _tacPlanFxB5(V, b, all); if (!b.tac) return;
  ['A', 'B'].forEach(s => { const cs = (V.corps || []).filter(c => c.side === s && c.scr > 0 && !c.scrIn); if (cs.length) b.tac[s].def += Math.min(0.03, 0.012 * cs.reduce((n, c) => n + c.scr, 0)); });          // la cadena absorbe parte del fuego
};
ACT.scrtoggle = d => { const b = G.battles.find(x => x.id === UI.battle); if (!b || b.ended) return; b.scrOff = b.scrOff || {}; if (b.scrOff[d.c]) delete b.scrOff[d.c]; else b.scrOff[d.c] = true; renderBattlePanel(); };
/* ---------- artillería: munición, carros y proyectiles ---------- */
const SH_COST = {ball: 0.035, shell: 0.05, shrap: 0.045, canister: 0.03};
const SH_NAME = {ball: 'bala maciza', shell: 'granada', shrap: 'metralla', canister: 'bote'};
function bvShellType(b, blk, t) {
  const d = Math.hypot(t.x - blk.x, t.y - blk.y), y = G.date.y;
  if (d < 130 && t.type !== 'art' && typeof tacCanister === 'function') return 'canister';
  if (t.garr || (t.terr && t.terr.village) || tacFortAt(b, t.x, t.y)) return y >= 1850 ? 'shell' : 'ball';
  if (t.type !== 'art' && y >= 1860) return 'shrap'; return 'ball';
}
const _tacArtFireB5 = tacArtFire;
tacArtFire = function (V, b, blk, dt, all) {
  if (blk.ammo === undefined) blk.ammo = 1; if (blk.ammo <= 0.02) { blk.noAmmo = true; blk.cd = Math.max(blk.cd || 0, 1.2); return; } blk.noAmmo = false;
  const n0 = V.parts.length, fa0 = blk.fireAt; _tacArtFireB5(V, b, blk, dt, all);
  if (blk.fireAt !== fa0 && blk.tgt) { const type = bvShellType(b, blk, blk.tgt); blk.ammo = Math.max(0, blk.ammo - SH_COST[type]); blk.lastSh = type; for (let i = n0; i < V.parts.length; i++) { const p = V.parts[i]; if (p.k === 'shell' && !p.sh) { p.sh = type; p.src = blk.id; } } }
};
const _tacShellHitB5 = tacShellHit;
tacShellHit = function (V, b, p, all) {
  _tacShellHitB5(V, b, p, all); if (!p.sh) return; const v = all.find(x => x.id === p.vt); if (!v || v.mode === 'rout') return;
  if (p.sh === 'ball' && v.type !== 'art' && v.comp > 0.95 && (v.mode === 'advance' || v.mode === 'charge' || v.mode === 'fire')) v.d.s = Math.max(0, v.d.s - 0.0018);          // la bala rasante atraviesa la columna compacta
  else if (p.sh === 'shell') { const f = tacFortAt(b, p.x2, p.y2); if (f) f.hp = Math.max(0, f.hp - 7); if (v.garr || (v.terr && v.terr.village) || f) { v.d.s = Math.max(0, v.d.s - 0.002); if (V.heat && v.terr && v.terr.village && V.tf) { const i = V.tf.villages.findIndex(q => Math.hypot(q.x - v.x, q.y - v.y) < q.r + 20); if (i >= 0) V.heat[i] = (V.heat[i] || 0) + 0.5; } } }
  else if (p.sh === 'shrap' && v.type !== 'art') { v.d.o = Math.max(0, v.d.o - DIVS[v.d.t].org * 0.012); v.d.s = Math.max(0, v.d.s - 0.001); if (v.mm !== undefined) v.mm = Math.max(0, v.mm - 0.02); }
};
function bvArtRestock(V, b, all, step) {
  const sup = {}; ['A', 'B'].forEach(s => { const as = sideIds(b, s).map(armyById).filter(Boolean); sup[s] = !as.length || as.reduce((n, a) => n + armyRes(a).powder, 0) / as.length > 0.6; });
  all.forEach(k => { if (k.type !== 'art' || k.ammo === undefined || k.mode === 'rout') return; const edge = k.side === 'A' ? k.x : BV_W - k.x, idle = performance.now() - (k.fireAt || -1e9) > 6000; k.wagon = false;
    if (k.ammo < 0.95 && sup[k.side] && idle) { k.ammo = Math.min(1, k.ammo + (edge < 320 ? 0.014 : 0.004) * step); k.wagon = true; } });
}
/* ---------- bucle, dibujo y panel ---------- */
const _tacThinkB5 = tacThink;
tacThink = function (V, b, all, dt) {
  _tacThinkB5(V, b, all, dt); if (V.over || b.prep || b.ended || V.replay || dt <= 0) return; V._b5 = (V._b5 || 0) + dt; if (V._b5 < 1) return; const step = V._b5; V._b5 = 0;
  bvQualStep(V, b, all, step); tacEnfilade(V, b, all, step); bvScreens(V, b, all, step); bvArtRestock(V, b, all, step);
};
// el ammo de infantería sube con la mala calidad
const _bvAmmoStepB5 = bvAmmoStep;
bvAmmoStep = function (V, b, all, step) { all.forEach(k => { if (k.type !== 'art' && k.ammo !== undefined && !k._qa) { k._qa = 1; } }); _bvAmmoStepB5(V, b, all, step); all.forEach(k => { if (k.type === 'inf' && k.ammo !== undefined && k.mode === 'fire') { const q = bvQual(k); if (q.ammo > 1) k.ammo = Math.max(0, k.ammo - 0.003 * (q.ammo - 1) * step); } }); };
const _bvCorpsFlagsB5 = bvCorpsFlags;
bvCorpsFlags = function (g, V, b) {
  _bvCorpsFlagsB5(g, V, b); const ps = playerSide(b);
  (V.corps || []).forEach(c => { if (!(c.scr > 0.05)) return; const ls = (c.blks || []).filter(k => k.role === 'line' && k.type === 'inf' && k.mode !== 'rout' && !k.garr); if (!ls.length) return; const dir = c.side === 'A' ? 1 : -1, col = G.C[c.tag].color;
    g.fillStyle = col; g.strokeStyle = 'rgba(0,0,0,.6)'; g.lineWidth = 0.5; g.globalAlpha = 0.35 + 0.55 * c.scr;
    ls.forEach(k => { const front = k.x + dir * (c.scrIn ? -k.dep * 0.2 : k.dep / 2 + 26); for (let i = 0; i < 5; i++) { const s = hash2(k.id, i, 77), px = front + dir * (s * 12 - 3) + Math.sin(V.t * 1.3 + i + k.id) * 2, py = k.y + (i - 2) * (k.wid / 5.2) + Math.cos(V.t + i) * 1.5; g.beginPath(); g.arc(px, py, 1.5, 0, 6.3); g.fill(); g.stroke(); } });
    g.globalAlpha = 1; });
  // enfilada: flechas rojas del tirador al blanco
  V.blocks.forEach(f => { if (!f.enfFrom || V.t - f.enfT > 1.6 || f.mode === 'rout') return; if (f.side !== ps && !bvSeen(V, b, f)) return; g.strokeStyle = 'rgba(255,70,50,.8)'; g.fillStyle = 'rgba(255,70,50,.9)'; g.lineWidth = 1.3; g.setLineDash([4, 3]); g.beginPath(); g.moveTo(f.enfFrom.x, f.enfFrom.y); g.lineTo(f.x, f.y); g.stroke(); g.setLineDash([]); g.font = 'bold 9px sans-serif'; g.textAlign = 'center'; g.fillText('ENFILADA', f.x, f.y - f.dep / 2 - 9); });
  // artillería: barra de munición, carros y proyectil
  V.blocks.forEach(k => { if (k.type !== 'art' || k.mode === 'rout' || k.ammo === undefined) return; const own = k.side === ps; if (own) { g.fillStyle = 'rgba(8,10,14,.7)'; g.fillRect(k.x - 12, k.y + k.dep / 2 + 11, 24, 3); g.fillStyle = k.ammo < 0.25 ? '#ff6a52' : '#d9b050'; g.fillRect(k.x - 11.5, k.y + k.dep / 2 + 11.5, 23 * k.ammo, 2); }
    if (k.wagon) { const dir = k.side === 'A' ? -1 : 1, wx = k.x + dir * 30, wy = k.y + 5; g.fillStyle = '#6b4a2a'; g.fillRect(wx - 6, wy - 3, 12, 6); g.strokeStyle = '#2a1c0e'; g.lineWidth = 0.8; g.strokeRect(wx - 6, wy - 3, 12, 6); g.fillStyle = '#222'; g.beginPath(); g.arc(wx - 4, wy + 3, 1.8, 0, 6.3); g.arc(wx + 4, wy + 3, 1.8, 0, 6.3); g.fill(); }
    if (own && k.noAmmo) { g.font = '10px sans-serif'; g.textAlign = 'center'; g.fillStyle = '#ff6a52'; g.fillText('🚫', k.x, k.y - k.dep / 2 - 6); } });
};
// panel: calidad del regimiento seleccionado y botón de tiradores por cuerpo
function bvQualBadge(sel) { const q = bvQual(sel); return `<span class="mbadge" data-tip="<b>${q.n}</b><br>Cadencia ×${q.fire.toFixed(2)} · moral ×${q.mor.toFixed(2)} · las órdenes tardan ×${q.ord.toFixed(2)}${sel.ammo !== undefined ? '<br>Munición ' + Math.round(sel.ammo * 100) + '%' : ''}">${q.ic} ${q.n}</span>`; }
