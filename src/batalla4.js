/* ===== BATALLA 4: ciudades y fuertes como ANCLAJES de línea (ver ESTUDIO_BATALLA.md) =====
   · Un regimiento pegado a un pueblo o fuerte propio tiene ese costado «anclado»: el golpe de flanco no le hace el efecto de siempre, su moral sube y la línea
     que se apoya en él no cuenta como flanco abierto (solo la espalda sigue siendo vulnerable).
   · Pero un ancla es también el punto débil: al caer, los regimientos que se apoyaban en ella quedan con el flanco al aire, el que la toma recibe un chute de moral y
     despojos (comida y pólvora) y los defensores sufren; así que atacarla compensa. La IA defiende los anclajes y asalta los del enemigo. */
const ANCHOR_KIND_W = {town: 1, fort: 1.2, village: 0.7};
function bvAnchors(V, b) {
  if (V._anc && V.t - V._anc.t < 0.5) return V._anc.list; const tf = V.tf, list = [];
  if (tf && tf.villages) tf.villages.forEach(v => { const ob = tf.town === v && typeof siteObjectives === 'function' ? siteObjectives(tf).find(o => o.id === 'town') : null; list.push({id: 'v' + v.id, kind: v === tf.town ? 'town' : 'village', x: v.x, y: v.y, r: v.r + 16, ctl: v === tf.town && ob ? ob.ctl : v.ctl, v}); });
  (b.forts || []).forEach(f => { if (f.hp > 0 && f.kind !== 'trench') list.push({id: 'f' + f.id, kind: 'fort', x: f.x, y: f.y, r: Math.max(f.w, f.h) / 2 + 16, ctl: f.side, f}); });
  V._anc = {t: V.t, list}; return list;
}
// ¿le sirve este ancla a este bando? (la suya, o un pueblo sin dueño en el que ya está)
const bvAnchorOwn = (a, side) => a.ctl === side || (!a.ctl && a.kind !== 'fort');
function bvAnchorMark(V, b, all) {
  const list = bvAnchors(V, b);
  all.forEach(k => {
    k.anc = null; if (k.type === 'art' || k.mode === 'rout' || k.role === 'reserve' || k.garr) return;
    let best = null, bd = 1e9; list.forEach(a => { if (!bvAnchorOwn(a, k.side)) return; const d = Math.hypot(k.x - a.x, k.y - a.y) - a.r - k.wid * 0.5; if (d < 18 && d < bd) { bd = d; best = a; } }); if (best) k.anc = best;
  });
}
// el golpe de flanco no cuenta contra un regimiento anclado (la espalda sí)
const _tacFlankShockB4 = tacFlankShock;
tacFlankShock = function (V, b, all, step) {
  _tacFlankShockB4(V, b, all.filter(blk => { const f = blk.foe; if (!f || !f.anc || f.side === blk.side) return true; const ang = Math.abs(bvAng(f.hd, Math.atan2(blk.y - f.y, blk.x - f.x))); return ang > 1.9; }), step);
};
// la línea apoyada en un ancla no tiene flanco abierto
const _fmIntegrityB4 = fmIntegrity;
fmIntegrity = function (V, b, all, dt) {
  const ran = (V._fi || 0) + dt >= 0.5; _fmIntegrityB4(V, b, all, dt); if (!ran) return;
  ['A', 'B'].forEach(s => { const ln = all.filter(k => k.side === s && k.role === 'line' && k.mode !== 'rout' && k.type !== 'art' && !k.garr); let exp = 0; ln.forEach(k => { if (k.anc && k.expo) { k.expo = 0; k.openU = k.openD = false; } if (k.expo) exp++; }); V.coh[s] = ln.length ? clamp(1 - 0.85 * exp / ln.length, 0.2, 1) : 1; b.coh[s] = V.coh[s]; });
};
// despojos y choque moral cuando un ancla cambia de manos
function bvAnchorFalls(V, b, a, winner, name) {
  const loser = winner === 'A' ? 'B' : 'A', all = [...V.blocks.values()];
  all.forEach(k => { if (k.mode === 'rout' || k.mm === undefined) return; if (k.side === winner) k.mm = Math.min(1, k.mm + 0.14); else { k.mm = Math.max(0, k.mm - (Math.hypot(k.x - a.x, k.y - a.y) < a.r + 150 ? 0.24 : 0.1)); if (k.anc && k.anc.id === a.id) { k.d.o = Math.max(0, k.d.o - DIVS[k.d.t].org * 0.2); k.d.s = Math.max(0, k.d.s - 0.015); } } });
  const spoil = a.kind === 'fort' ? 3 : a.kind === 'town' ? 2.5 : 1.2;
  sideIds(b, winner).map(armyById).filter(Boolean).forEach(x => { const r = armyRes(x); r.food += spoil; r.powder += spoil * 0.8; });
  sideIds(b, loser).map(armyById).filter(Boolean).forEach(x => { const r = armyRes(x); r.food = Math.max(0, r.food - spoil); r.powder = Math.max(0, r.powder - spoil * 0.8); });
  const nm = G.C[winner === 'A' ? b.A0 : b.B0].name, ln = G.C[loser === 'A' ? b.A0 : b.B0].name;
  (b.log = b.log || []).push({k: 'panic', d: b.day, t: `${nm} se hace con ${name}: ${ln} pierde su apoyo, el flanco queda al aire y deja víveres y pólvora en manos del vencedor.`}); if (b.log.length > 30) b.log.shift();
  V.shake = Math.max(V.shake || 0, 1.5);
}
// fuertes capturados
const _tacCaptureFortsB4 = tacCaptureForts;
tacCaptureForts = function (V, b, all, step) {
  const before = (b.forts || []).map(f => f.side); _tacCaptureFortsB4(V, b, all, step);
  (b.forts || []).forEach((f, i) => { if (f.side !== before[i]) bvAnchorFalls(V, b, {kind: 'fort', x: f.x, y: f.y, r: Math.max(f.w, f.h) / 2 + 16, id: 'f' + f.id}, f.side, FORT_KINDS[f.kind].n.toLowerCase()); });
};
/* ---------- IA: defiende sus anclajes y asalta los del enemigo ---------- */
function bvAnchorAi(V, b, all, s) {
  V['anT' + s] = (V['anT' + s] || 0) + 1; if (V['anT' + s] < 4) return; V['anT' + s] = 0;
  const dir = s === 'A' ? 1 : -1, att = b.att === s, list = bvAnchors(V, b), free = all.filter(o => o.side === s && o.type === 'inf' && o.role === 'line' && !o.garr && o.mode !== 'rout' && !o.d.plan);
  const mineStr = all.filter(o => o.side === s && o.mode !== 'rout').reduce((n, o) => n + o.d.s, 0), foeStr = all.filter(o => o.side !== s && o.mode !== 'rout').reduce((n, o) => n + o.d.s, 0), ratio = mineStr / Math.max(0.1, foeStr);
  // defensa: los dos regimientos más cercanos de un pueblo/fuerte propio se plantan en su borde delantero
  list.filter(a => a.kind !== 'village' && bvAnchorOwn(a, s) && (a.ctl === s || !att)).forEach(a => {
    const held = all.filter(o => o.side === s && o.d.stay && o.d.anchorId === a.id).length; if (held >= 2) return;
    free.filter(o => !o.d.stay).sort((p, q) => Math.hypot(p.x - a.x, p.y - a.y) - Math.hypot(q.x - a.x, q.y - a.y)).slice(0, 2 - held).forEach((o, i) => { if (Math.hypot(o.x - a.x, o.y - a.y) > a.r + 260) return; o.d.stay = {x: a.x + dir * a.r * 0.55, y: a.y + (i ? 1 : -1) * a.r * 0.55}; o.d.anchorId = a.id; o.skey = ''; });
  });
  // ataque: con ventaja o como atacante, tres regimientos cargan contra un ancla enemiga (los fuertes vacíos ya los ocupa tacFortPush)
  if (att || ratio > 1.1) {
    const tgt = list.filter(a => a.kind !== 'village' && !bvAnchorOwn(a, s) && a.ctl && a.ctl !== s).sort((p, q) => Math.abs(p.x - BV_W / 2) - Math.abs(q.x - BV_W / 2))[0];
    if (tgt) { const busy = all.filter(o => o.side === s && o.d.plan && o.d.plan.anc === tgt.id).length; if (busy < 3) free.sort((p, q) => Math.hypot(p.x - tgt.x, p.y - tgt.y) - Math.hypot(q.x - tgt.x, q.y - tgt.y)).slice(0, 3 - busy).forEach(o => { delete o.d.stay; o.d.plan = {k: 'charge', pts: [[tgt.x - dir * (tgt.r * 0.6), tgt.y + (Math.random() - 0.5) * tgt.r]], i: 0, anc: tgt.id}; o.skey = ''; }); }
  }
  // limpieza: planes de asalto a un ancla que ya es nuestra
  all.forEach(o => { if (o.side === s && o.d.plan && o.d.plan.anc) { const a = list.find(q => q.id === o.d.plan.anc); if (!a || a.ctl === s) { delete o.d.plan; o.skey = ''; } } if (o.side === s && o.d.stay && o.d.anchorId) { const a = list.find(q => q.id === o.d.anchorId); if (!a || !bvAnchorOwn(a, s)) { delete o.d.stay; delete o.d.anchorId; o.skey = ''; } } });
}
const _tacThinkB4 = tacThink;
tacThink = function (V, b, all, dt) {
  _tacThinkB4(V, b, all, dt); if (V.over || b.prep || b.ended || V.replay || dt <= 0) return; V._b4 = (V._b4 || 0) + dt; if (V._b4 < 1) return; const step = V._b4; V._b4 = 0;
  bvAnchorMark(V, b, all);
  all.forEach(k => { if (k.anc && k.mm !== undefined && k.mode !== 'rout') k.mm = Math.min(1, k.mm + 0.008 * ANCHOR_KIND_W[k.anc.kind] * step); });          // quien se apoya en un ancla se siente seguro
  const ps = playerSide(b); ['A', 'B'].forEach(s => { if (s !== ps) bvAnchorAi(V, b, all, s); });
};
// bono diario de defensa por tener la línea anclada
const _tacPlanFxB4 = tacPlanFx;
tacPlanFx = function (V, b, all) {
  _tacPlanFxB4(V, b, all); if (!b.tac) return;
  ['A', 'B'].forEach(s => { const n = all.filter(k => k.side === s && k.anc).reduce((m, k) => m + ANCHOR_KIND_W[k.anc.kind], 0); b.tac[s].def += Math.min(0.06, 0.012 * n); });
};
// marca ⚓ sobre los regimientos anclados de tu bando
const _bvCorpsFlagsB4 = bvCorpsFlags;
bvCorpsFlags = function (g, V, b) {
  _bvCorpsFlagsB4(g, V, b); const ps = playerSide(b);
  V.blocks.forEach(k => { if (!k.anc || k.mode === 'rout' || k.side !== ps) return; g.font = '11px sans-serif'; g.textAlign = 'center'; g.fillStyle = '#9fe0ff'; g.fillText('⚓', k.x, k.y - k.dep / 2 - 6); g.strokeStyle = 'rgba(159,224,255,.5)'; g.lineWidth = 1; g.setLineDash([2, 3]); g.beginPath(); g.moveTo(k.x, k.y); g.lineTo(k.anc.x, k.anc.y); g.stroke(); g.setLineDash([]); });
};
