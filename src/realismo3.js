/* ===== REALISMO 3: pendiente, barro, incendios de bosque, hora del día, heridos y enfermedad =====
   BATALLA (visor táctico, 2D y 3D):
   · Pendiente: subir una loma frena (hasta −45 %), bajarla acelera un poco. Se calcula con la altura real del escenario (bvHeight, la misma del visor 3D).
   · Barro: la lluvia lo acumula entre jornadas (b.mud) y se seca despacio; frena sobre todo a la artillería (−50 %), luego a los carros, la caballería y la infantería.
   · Incendios: un obús que cae en un bosque seco puede prenderlo; el fuego se propaga a los bosques cercanos (más con viento), quema y desmoraliza a quien esté dentro,
     frena el paso y, al apagarse, deja el bosque calcinado (sin cobertura). Con lluvia o nieve casi nunca prende.
   · Hora del día: cada jornada de batalla va del amanecer (6 h) al anochecer (20 h). Al alba y al ocaso se ve y se dispara peor; la luz del visor sigue al sol.
   CAMPAÑA (cada día, por ejército en campaña):
   · Enfermedad: depende del bioma (selva, desierto, tundra, pantano…), la estación, el hacinamiento y el suministro; descansar en territorio propio la reduce mucho.
   · Heridos: una parte de las bajas de batalla y de los enfermos queda como «recuperable» (a.wnd) y vuelve a las divisiones sin gastar población si el ejército descansa
     en territorio propio con suministro (hospital de campaña). */
// altura del terreno de una batalla: colinas del escenario, cauce hundido y ondulación suave (la usan la simulación y el visor 3D)
function bvHeight(tf, x, z) {
  let h = 0.45 * Math.sin(x * 0.021 + z * 0.017) * Math.cos(z * 0.027 - x * 0.011);
  (tf.hills || []).forEach(hl => { const dx = (x - hl.x) / hl.rx, dz = (z - hl.y) / hl.ry, d = dx * dx + dz * dz; if (d < 1) { const k = 1 - d, s = k * k * (3 - 2 * k); h += s * Math.min(30, (hl.rx + hl.ry) * 0.06); } });
  if (tf.river) { const dx = Math.abs(x - tacRiverX(tf, z)), w = tf.river.w * 2.6; if (dx < w) { const k = 1 - dx / w; h -= 1.3 * Math.min(1, k * k * (3 - 2 * k) * 2.2); } }
  return h;
}
function bvSlope(tf, blk) {           // pendiente en el sentido de la marcha (subida > 0), cacheada 0,4 s
  const now = performance.now(); if (blk._slt && now - blk._slt < 400) return blk._sl; blk._slt = now;
  const c = Math.cos(blk.hd), s = Math.sin(blk.hd); blk._sl = (bvHeight(tf, blk.x + c * 8, blk.y + s * 8) - bvHeight(tf, blk.x, blk.y)) / 8; return blk._sl;
}
const bvEll = (f, x, y) => Math.hypot(x - f.x, y - f.y) < f.r * 0.92;
const _rl3Speed = bvSpeedMul;
bvSpeedMul = function (V, b, blk) {
  let m = _rl3Speed(V, b, blk); const tf = V.tf || battleTerrain(b), sl = bvSlope(tf, blk);
  m *= sl > 0 ? clamp(1 - 2.4 * sl, 0.55, 1) : 1 + Math.min(0.1, -sl * 0.9);
  const mud = V.mud || 0; if (mud > 0.02) m *= 1 - mud * (blk.type === 'art' ? 0.5 : blk.type === 'tank' ? 0.35 : blk.type === 'cav' ? 0.25 : 0.18);
  if (tf.forests.some(f => f.fire && bvEll(f, blk.x, blk.y))) m *= 0.6;
  return m;
};
// ---- hora del día ----
function bvHour(V) { const len = Math.max(1800, typeof dayMs === 'function' ? dayMs() : 1800); return 6 + 14 * clamp((performance.now() - (V.dayT || performance.now())) / len, 0, 1); }
function bvLight(h) { return h < 8 ? {k: 0.8 + 0.2 * (h - 6) / 2, warm: 1 - (h - 6) / 2} : h < 17 ? {k: 1, warm: 0} : {k: 1 - 0.26 * (h - 17) / 3, warm: (h - 17) / 3}; }
const bvTwilight = V => { const h = V.hour || 12; return h < 7.2 || h > 18.8; };
const _rl3Sight = bvSightRange;
bvSightRange = function (V, b) { return _rl3Sight(V, b) * (bvTwilight(V) ? 0.8 : 1); };
const _rl3Fire = bvFireMods;
bvFireMods = function (V, b, blk) { const m = _rl3Fire(V, b, blk); if (bvTwilight(V)) { m.rng *= 0.85; m.rate *= 0.92; } return m; };
// ---- cobertura: un bosque calcinado ya no protege; uno en llamas frena ----
const _rl3Terr = bvTerrAt;
bvTerrAt = function (tf, x, y, side) {
  const o = _rl3Terr(tf, x, y, side); if (!tf || !tf.forests || !o.forest) return o;
  for (let i = 0; i < tf.forests.length; i++) { const f = tf.forests[i]; if (!bvEll(f, x, y)) continue; if (f.burnt) { o.forest = false; if (!o.village) o.cover = false; o.slow = Math.max(o.slow, 0.9); } else if (f.fire) o.slow = Math.min(o.slow, 0.45); }
  return o;
};
// ---- paso por fotograma: barro, incendios, hora ----
const _rl3Ground = bvGround;
bvGround = function (V, b, all, dt) {
  _rl3Ground(V, b, all, dt); if (V.replay) return;
  const tf = V.tf || battleTerrain(b), wx = battleWeather(b), rain = wx.k === 'rain' || V.rain > 0, snow = wx.k === 'snow';
  V.hour = bvHour(V);
  // barro: persistente por batalla; se carga con la lluvia y se seca poco a poco; la helada lo endurece
  if (b.mud === undefined) { const m = G.date.m, wet = (m >= 8 && m <= 10) || (m >= 2 && m <= 4); b.mud = wx.k === 'rain' ? 0.5 : snow ? 0.3 : wx.frost ? 0 : wet ? 0.12 : 0.02; }
  if (b.day !== V._mudDay) { if (V._mudDay !== undefined) b.mud = clamp(b.mud + (rain ? 0.2 : -0.08), 0, 1); V._mudDay = b.day; }
  if (V.rain > 0) b.mud = Math.min(1, b.mud + dt * 0.02);
  V.mud = wx.frost ? Math.min(b.mud, 0.1) : b.mud;
  // incendios de bosque
  let ignite = false;
  V.parts.forEach(p => { if (p.k !== 'shell' || !p.hit || p._rl) return; p._rl = 1;
    const summer = G.date.m >= 5 && G.date.m <= 8, pr = (rain ? 0.04 : snow ? 0 : 0.28 + 0.3 * (1 - V.mud) + (summer ? 0.15 : 0)) * (1 + Math.abs(wx.wind || 0) * 0.3);
    tf.forests.forEach(f => { if (!f.fire && !f.burnt && Math.hypot(p.x2 - f.x, p.y2 - f.y) < f.r && Math.random() < pr) { f.fire = {t: 0}; ignite = true; } }); });
  if (ignite && !V.replay) bvBanner(V, '🔥 Incendio en el bosque', 'A', '🔥');
  V._fireT = (V._fireT || 0) + dt; const spread = V._fireT > 1; if (spread) V._fireT = 0;
  tf.forests.forEach(f => { if (!f.fire) return; f.fire.t += dt;
    if (Math.random() < dt * 14) { const a = Math.random() * 6.28, d = Math.sqrt(Math.random()) * f.r * 0.85; bvPart(V, {k: 'smoke', x: f.x + Math.cos(a) * d, y: f.y + Math.sin(a) * d * 0.8, life: 4.2, r: 8, vx: (wx.wind || 0) * 6 + rnd(-3, 3)}); if (Math.random() < 0.4) bvPart(V, {k: 'spark', x: f.x + Math.cos(a) * d, y: f.y + Math.sin(a) * d * 0.8, life: 0.7, hot: 1}); }
    if (spread) tf.forests.forEach(g => { if (g === f || g.fire || g.burnt) return; if (Math.hypot(g.x - f.x, g.y - f.y) < f.r + g.r + 22 && Math.random() < (rain ? 0.004 : 0.03 + Math.abs(wx.wind || 0) * 0.03)) g.fire = {t: 0}; });
    all.forEach(blk => { if (blk.role === 'reserve' || !bvEll(f, blk.x, blk.y)) return; blk.d.s = Math.max(0, blk.d.s - 0.0009 * dt); blk.d.o = Math.max(0, blk.d.o - DIVS[blk.d.t].org * 0.004 * dt); if (blk.mm !== undefined) blk.mm = Math.max(0, blk.mm - 0.01 * dt);
      if (Math.random() < dt * 0.5) { const fs = blk.figs.filter(q => q.alive && !q.flee); if (fs.length) bvFlee(V, blk, fs[Math.floor(Math.random() * fs.length)], 1); } });
    if (f.fire.t > (rain ? 25 : 55)) { f.fire = null; f.burnt = true; V.burnSig = (V.burnSig || 0) + 1; } });
};
// ---- aspecto 2D: barro, bosque calcinado y llamas ----
const _rl3Under = bvFxUnder;
bvFxUnder = function (g, V, b) {
  _rl3Under(g, V, b);
  if ((V.mud || 0) > 0.04) { g.fillStyle = `rgba(74,52,30,${0.22 * V.mud})`; g.fillRect(0, 0, BV_W, BV_H); }
  const tf = V.tf; if (!tf) return;
  tf.forests.forEach(f => { if (f.burnt) { g.fillStyle = 'rgba(16,12,9,.5)'; g.beginPath(); g.ellipse(f.x, f.y, f.r * 1.02, f.r * 0.82, 0, 0, 6.3); g.fill(); }
    else if (f.fire) { const fl = 0.65 + 0.35 * Math.sin(V.t * 9 + f.x), rg = g.createRadialGradient(f.x, f.y, 2, f.x, f.y, f.r); rg.addColorStop(0, `rgba(255,150,40,${0.55 * fl})`); rg.addColorStop(0.6, `rgba(255,90,20,${0.3 * fl})`); rg.addColorStop(1, 'rgba(255,60,10,0)'); g.fillStyle = rg; g.beginPath(); g.ellipse(f.x, f.y, f.r, f.r * 0.82, 0, 0, 6.3); g.fill(); } });
};
// insignia del estado del campo: hora, barro e incendios
function rl3Badge(g, V, b) {
  if (V.replay) return; const h = V.hour || 12, hh = Math.floor(h), mm = Math.floor((h - hh) * 60), fires = (V.tf ? V.tf.forests.filter(f => f.fire).length : 0), sl = h < 8 ? '🌅' : h > 17 ? '🌇' : '☀️';
  const txt = `${sl} ${hh}:${String(mm).padStart(2, '0')}${(V.mud || 0) > 0.15 ? '  ·  🟫 Barro ' + Math.round(V.mud * 100) + '%' : ''}${fires ? '  ·  🔥 ' + fires + (fires === 1 ? ' incendio' : ' incendios') : ''}`;
  g.save(); g.font = '600 13px sans-serif'; g.textAlign = 'right'; const w = g.measureText(txt).width + 16; g.fillStyle = 'rgba(8,12,16,.72)'; g.fillRect(BV_W - 8 - w, BV_H - 26, w, 20); g.fillStyle = fires ? '#ffb27a' : '#e6e0c8'; g.fillText(txt, BV_W - 16, BV_H - 12); g.restore();
}
const _rl3Post = bvPost;
bvPost = function (g, V, b) {
  _rl3Post(g, V, b); if (V.replay) return; const h = V.hour || 12, L = bvLight(h);
  if (L.k < 1) { g.fillStyle = `rgba(${L.warm > 0.5 ? '255,120,60' : '255,190,130'},${(0.1 * L.warm).toFixed(3)})`; g.fillRect(0, 34, BV_W, BV_H - 34); g.fillStyle = `rgba(10,18,40,${(1 - L.k) * 0.45})`; g.fillRect(0, 34, BV_W, BV_H - 34); }
  rl3Badge(g, V, b);
};

/* ---------- campaña: enfermedad y heridos ---------- */
const RL3_DIS = {2: 1.3, 3: 1.5, 5: 1.4, 6: 3, 7: 0.9, 8: 1.6};      // multiplicador por bioma (selva, desierto, tundra, nieve…)
function rl3ArmyDay(a) {
  const pv = MAP.provs[a.loc]; if (!pv || !a.divs.length) return;
  const sum = a.divs.reduce((n, d) => n + d.s, 0);
  if (a._ss !== undefined && a.battle && sum < a._ss) a.wnd = (a.wnd || 0) + (a._ss - sum) * 0.28;             // parte de las bajas son heridos recuperables
  const m = G.date.m, summer = m >= 5 && m <= 8, winter = m === 11 || m <= 1, bio = pv.biome, sup = a.sup === undefined ? 1 : a.sup;
  let k = RL3_DIS[bio] || 1; if (summer && (bio === 3 || bio === 6 || bio === 4)) k *= 1.3; if (winter && (bio === 8 || bio === 5 || bio === 7)) k *= 1.5;
  if (sup < 0.6) k *= 1.6; if (sup < 0.3) k *= 1.6;
  const own = controlled(a.tag, a.loc), resting = !a.path.length && !a.battle && own; if (resting) k *= 0.35; if (a.battle) k *= 1.2;
  k *= 1 + 0.08 * Math.max(0, a.divs.length - 4);
  const loss = 0.00022 * k; let lost = 0;
  a.divs.forEach(d => { const l = Math.min(Math.max(0, d.s - 0.05), loss); if (l > 0) { d.s -= l; lost += l; } });
  a.wnd = (a.wnd || 0) + lost * 0.7;                                                                          // la mayoría de los enfermos se recupera
  if (resting && sup > 0.5 && a.wnd > 0) {                                                                    // hospital de campaña
    let heal = Math.min(a.wnd, 0.004 * a.divs.length);
    const w = a.divs.slice().sort((p, q) => p.s - q.s); for (let i = 0; i < w.length && heal > 1e-6; i++) { const g = Math.min(1 - w[i].s, heal); if (g > 0) { w[i].s += g; heal -= g; a.wnd -= g; } }
  }
  a.wnd = Math.min(a.wnd || 0, a.divs.length * 0.6); if (a.wnd < 1e-5) a.wnd = 0;
  a._dis = (a._dis || 0) * 0.97 + lost; a._ss = a.divs.reduce((n, d) => n + d.s, 0);
  if (a.tag === G.player && k >= 2.4 && a._dis > 0.012 && G.date.t % 45 === 0) notify('war', `🤒 La enfermedad diezma a ${a.name} en ${provName(a.loc)} (${pv.biome === 6 ? 'selva' : pv.biome === 3 ? 'desierto' : pv.biome === 8 ? 'frío' : 'campamento'}). Retírala a territorio propio con suministro para que se recupere.`, provState(a.loc));
}
const _rl3Supply = supplyDay;
supplyDay = function () { _rl3Supply.apply(this, arguments); try { G.armies.forEach(a => { if (!a.sea && !a._dead) rl3ArmyDay(a); }); } catch (e) { console.warn('realismo3', e); } };
