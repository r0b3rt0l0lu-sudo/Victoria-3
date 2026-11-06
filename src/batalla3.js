/* ===== BATALLA 3: munición, fatiga, persecución, niebla de guerra y objetivos por sede (ver ESTUDIO_BATALLA.md) =====
   · MUNICIÓN: cada regimiento lleva cartuchos (blk.ammo). Disparar los gasta; sin ellos solo queda la bayoneta. Se reponen a retaguardia si el ejército tiene pólvora.
   · FATIGA: el cansancio frena la marcha y baja la cadencia de fuego.
   · PERSECUCIÓN: la matanza tras la victoria depende de la caballería fresca, el terreno, el orden de la retirada y los puentes/vados.
   · NIEBLA: del enemigo solo ves lo que alcanzan a ver tus regimientos (menos con lluvia/niebla; más desde una altura); lo ya visto queda como un «?».
   · OBJETIVOS: cada tipo de pueblo tiene puntos que valen (puente, altura, bosques, vado, villa…); controlarlos da bonos y moral. */
/* ---------- munición y fatiga ---------- */
const AMMO_PER_SHOT = 0.0016, AMMO_LOW = 0.25;
const _bvFireB3 = bvFire;
bvFire = function (V, b, blk, dt, foes) {
  if (blk.type === 'inf' || blk.type === 'cav') {
    if (blk.ammo === undefined) blk.ammo = 1; const f0 = blk.fireAt;
    const fat = 1 - 0.25 * (blk.fat || 0), am = blk.ammo > AMMO_LOW ? 1 : blk.ammo / AMMO_LOW; blk.noAmmo = blk.ammo <= 0.01;
    if (blk.noAmmo) return;
    _bvFireB3(V, b, blk, dt * fat * am, foes); if (blk.fireAt !== f0) blk.ammo = Math.max(0, blk.ammo - AMMO_PER_SHOT * (blk.type === 'cav' ? 0.4 : 1) * (1 + (V.salvo && V.salvo[blk.side] > 0 ? 0.5 : 0)));
    return;
  }
  _bvFireB3(V, b, blk, dt, foes);
};
// sin cartuchos, la única salida es cerrar con la bayoneta
const _bvWantsAssaultB3 = bvWantsAssault;
bvWantsAssault = function (V, b, blk, st, att, foe, dt) {
  if (blk.noAmmo && foe && foe.role !== 'reserve' && blk.type === 'inf' && !blk.garr && (blk.mm === undefined || blk.mm > 0.2)) return true;
  return _bvWantsAssaultB3(V, b, blk, st, att, foe, dt);
};
const _bvSpeedMulB3 = bvSpeedMul;
bvSpeedMul = function (V, b, blk) { return _bvSpeedMulB3(V, b, blk) * (1 - 0.3 * Math.pow(blk.fat || 0, 1.4)); };
function bvAmmoStep(V, b, all, step) {
  const supplied = {}; ['A', 'B'].forEach(s => { const as = sideIds(b, s).map(armyById).filter(Boolean); supplied[s] = !as.length || as.reduce((n, a) => n + armyRes(a).powder, 0) / as.length > 0.6; });
  all.forEach(k => {
    if (k.type === 'art' || k.ammo === undefined) return;
    if (k.noAmmo) { if (k.mm !== undefined) k.mm = Math.max(0, k.mm - 0.004 * step); }                          // sin munición la moral se resiente
    const resting = k.role === 'reserve' || k.mode === 'hold' || k.mode === 'reserve' || k.garr || (k.mode === 'advance' && (k.sp || 0) < 6);
    if (resting && supplied[k.side] && k.mode !== 'melee' && k.mode !== 'rout') k.ammo = Math.min(1, k.ammo + (k.role === 'reserve' ? 0.02 : 0.006) * step);       // carros de munición a retaguardia
  });
}
/* ---------- persecución diferenciada ---------- */
const _endBattleB3 = endBattle;
endBattle = function (b, winner) {
  try {
    const V = R.bviz && R.bviz.id === b.id ? R.bviz : null, win = winner === 'A' ? 'A' : 'B', tf = battleTerrain(b); let m = 1;
    if (V) {
      const wc = [...V.blocks.values()].filter(k => k.side === win && k.type === 'cav' && k.mode !== 'rout'); if (wc.length) m *= 1.25 - 0.5 * (wc.reduce((n, k) => n + (k.fat || 0), 0) / wc.length);       // caballos reventados persiguen menos
      const lo = [...V.blocks.values()].filter(k => k.side !== win && k.role !== 'reserve'); if (lo.length) { const orderly = lo.filter(k => k.mode !== 'rout' && !(k.brk > 0)).length / lo.length; m *= 1.3 - 0.65 * orderly; }       // una retirada en orden se defiende
    }
    const cover = tf.forests.length + tf.marsh.length + tf.rocks.length + (tf.ravine ? 2 : 0); m *= 1 - 0.05 * Math.min(5, cover);
    if (tf.siteKind === 'puente' || tf.siteKind === 'vado') m *= 1.2;                                                                          // el cuello de botella del paso
    b.pursMul = clamp(m, 0.4, 1.6);
  } catch (e) { b.pursMul = 1; }
  _endBattleB3(b, winner);
};
/* ---------- niebla de guerra ---------- */
function bvSightRange(V, b) { const k = battleWeather(b).k; return k === 'fog' ? 190 : k === 'rain' || k === 'snow' ? 270 : 340; }
function bvFogOn(V, b) { return !!(V && b && !V.replay && !V.over && !b.prep && !b.ended && playerSide(b)); }
function bvFogUpdate(V, b, all) {
  V._fogT = (V._fogT || 0) + 1; if (V._fogT % 12 !== 1 && V.seen) return; const ps = playerSide(b), tf = V.tf, R0 = bvSightRange(V, b), seen = new Set(), mine = all.filter(k => k.side === ps && k.mode !== 'rout');
  const now = performance.now();
  all.forEach(e => {
    if (e.side === ps) return; let vis = (now - (e.fireAt || -1e9)) < 2500 || e.mode === 'melee';
    if (!vis) for (let i = 0; i < mine.length && !vis; i++) { const o = mine[i], d = Math.hypot(o.x - e.x, o.y - e.y), hi = tf && tf.hills.some(h => inEll(o.x, o.y, h)), r = R0 * (o.type === 'cav' ? 1.35 : 1) * (hi ? 1.3 : 1); if (d < r && (d < 110 || bvLosCached(V, b, o, e))) vis = true; }
    if (vis) { seen.add(e.id); e.last = {x: e.x, y: e.y, t: V.t, hd: e.hd}; }
  });
  V.seen = seen;
}
function bvSeen(V, b, k) { if (!bvFogOn(V, b) || k.side === playerSide(b)) return true; return !V.seen || V.seen.has(k.id); }
const _bvHoverB3 = bvHover;
bvHover = function (V, all) { const b = R.bvB; _bvHoverB3(V, b && bvFogOn(V, b) ? all.filter(k => bvSeen(V, b, k)) : all); };
// los regimientos enemigos no vistos se muestran como un «?» en su última posición conocida
const _bvCorpsFlagsB3 = bvCorpsFlags;
bvCorpsFlags = function (g, V, b) {
  _bvCorpsFlagsB3(g, V, b); if (!bvFogOn(V, b)) return;
  V.blocks.forEach(k => { if (k.side === playerSide(b) || bvSeen(V, b, k) || !k.last || V.t - k.last.t > 25 || k.mode === 'rout') return; const a = 0.55 * (1 - (V.t - k.last.t) / 25); g.globalAlpha = a; g.strokeStyle = G.C[k.tag].color; g.lineWidth = 1.3; g.setLineDash([3, 3]); g.strokeRect(k.last.x - k.wid / 2, k.last.y - k.dep / 2, k.wid, k.dep); g.setLineDash([]); g.fillStyle = '#fff'; g.font = 'bold 11px sans-serif'; g.textAlign = 'center'; g.fillText('?', k.last.x, k.last.y + 4); g.globalAlpha = 1; });
  // munición baja de tus regimientos
  V.blocks.forEach(k => { if (k.side !== playerSide(b) || k.ammo === undefined || k.ammo > AMMO_LOW || k.mode === 'rout') return; g.font = '10px sans-serif'; g.textAlign = 'center'; g.fillStyle = k.noAmmo ? '#ff6a52' : '#ffd24a'; g.fillText(k.noAmmo ? '🚫' : '•••', k.x + k.wid / 2 + 8, k.y - 2); });
};
/* ---------- objetivos por sede ---------- */
const OBJ_BONUS = 0.02, OBJ_MAX = 0.08;
function siteObjectives(tf) {
  if (tf.objs) return tf.objs; const o = [], k = tf.siteKind, t = tf.town; if (!t) return (tf.objs = o);
  o.push({id: 'town', ic: '🏘️', name: t.name, x: t.x, y: t.y, r: t.r + 24, w: k === 'amurallado' ? 2 : k === 'cruce' ? 1.5 : 1});
  if (k === 'puente' && tf.river) { const f = tf.river.fords.find(q => q.town) || tf.river.fords[0]; if (f) o.push({id: 'bridge', ic: '🌉', name: 'el puente', x: tacRiverX(tf, f.y), y: f.y, r: 62, w: 2}); }
  else if (k === 'vado' && tf.river) { const f = tf.river.fords.find(q => q.town) || tf.river.fords[0]; if (f) o.push({id: 'ford', ic: '〰️', name: 'el vado', x: tacRiverX(tf, f.y), y: f.y, r: 70, w: 1.5}); }
  else if (k === 'altura' && tf.hill) o.push({id: 'hill', ic: '⛰️', name: 'la altura', x: tf.hill.x, y: tf.hill.y, r: Math.min(tf.hill.rx, tf.hill.ry) * 0.75, w: 1.5});
  else if (k === 'bosque') tf.forests.slice(-4, -2).forEach((f, i) => o.push({id: 'for' + i, ic: '🌲', name: i ? 'el bosque sur' : 'el bosque norte', x: f.x, y: f.y, r: f.r * 0.85, w: 1}));
  return (tf.objs = o);
}
function bvObjectives(V, b, all, step) {
  const tf = V.tf; if (!tf) return; const objs = siteObjectives(tf); b.objSc = b.objSc || {A: 0, B: 0};
  objs.forEach(ob => {
    let a = 0, c = 0; all.forEach(k => { if (k.type === 'art' || k.mode === 'rout' || k.role === 'reserve') return; if (Math.hypot(k.x - ob.x, k.y - ob.y) < ob.r + k.wid * 0.3) { if (k.side === 'A') a++; else c++; } });
    const ctl = a > c ? 'A' : c > a ? 'B' : ob.ctl; if (ctl && ctl !== ob.ctl) { const first = !ob.ctl, prev = ob.ctl; ob.ctl = ctl; if (prev && typeof bvAnchorFalls === 'function' && (ob.id === 'town' || ob.id === 'hill' || ob.id === 'bridge')) bvAnchorFalls(V, b, {kind: ob.id === 'town' ? 'town' : 'village', x: ob.x, y: ob.y, r: ob.r, id: 'v' + (V.tf.town ? V.tf.town.id : 0)}, ctl, ob.name); if (!V.replay && !(first && !all.some(k => k.mode === 'melee'))) { const nm = G.C[ctl === 'A' ? b.A0 : b.B0].name; bvBanner(V, `${ob.ic} ${nm} toma ${ob.name}`, ctl, ''); (b.log = b.log || []).push({k: 'flank', d: b.day, t: `${nm} toma ${ob.name}.`}); if (b.log.length > 30) b.log.shift(); } }
    if (ob.ctl) { b.objSc[ob.ctl] += ob.w * step; all.forEach(k => { if (k.side === ob.ctl && k.mm !== undefined && k.mode !== 'rout' && Math.hypot(k.x - ob.x, k.y - ob.y) < ob.r + 20) k.mm = Math.min(1, k.mm + 0.012 * step); }); }
  });
}
const _tacPlanFxB3 = tacPlanFx;
tacPlanFx = function (V, b, all) {
  _tacPlanFxB3(V, b, all); const tf = V.tf; if (!tf || !b.tac) return;
  ['A', 'B'].forEach(s => { const w = siteObjectives(tf).filter(o => o.ctl === s).reduce((n, o) => n + o.w, 0); b.tac[s].att += Math.min(OBJ_MAX, OBJ_BONUS * w); b.tac[s].def += Math.min(OBJ_MAX, OBJ_BONUS * w); });
};
const _tacThinkB3 = tacThink;
tacThink = function (V, b, all, dt) {
  _tacThinkB3(V, b, all, dt); if (bvFogOn(V, b)) bvFogUpdate(V, b, all); if (V.over || b.prep || b.ended || V.replay || dt <= 0) return; V._b3 = (V._b3 || 0) + dt; if (V._b3 < 1) return; const step = V._b3; V._b3 = 0; bvAmmoStep(V, b, all, step); bvObjectives(V, b, all, step);
};
// marcadores de los objetivos en el campo
const _bvCorpsFlagsB3b = bvCorpsFlags;
bvCorpsFlags = function (g, V, b) {
  _bvCorpsFlagsB3b(g, V, b); const tf = V.tf; if (!tf || !tf.town) return;
  siteObjectives(tf).forEach(o => { const col = o.ctl ? G.C[o.ctl === 'A' ? b.A0 : b.B0].color : '#e8e2d0'; g.strokeStyle = col; g.globalAlpha = 0.5; g.lineWidth = 1.6; g.setLineDash([6, 6]); g.beginPath(); g.arc(o.x, o.y, o.r, 0, 6.3); g.stroke(); g.setLineDash([]); g.globalAlpha = 0.9; g.font = '13px sans-serif'; g.textAlign = 'center'; g.fillStyle = col; g.fillText(o.ic, o.x, o.y - o.r - 3); g.globalAlpha = 1; });
};
// ficha del escenario en la lista de terreno
const _terrainInfoB3 = terrainInfo;
terrainInfo = function (b) {
  const out = _terrainInfoB3(b), tf = battleTerrain(b); if (tf.site) { const K = SITE_KINDS[tf.siteKind], ob = siteObjectives(tf); out.unshift(['📍', `${tf.site.name} · ${K.n}`, `${K.d} Objetivos: ${ob.map(o => o.ic + ' ' + o.name).join(', ')}. Cada objetivo controlado da +2% de ataque y defensa (×peso, máx. 8%) y devuelve moral a quien lo ocupa.`]); }
  return out;
};
