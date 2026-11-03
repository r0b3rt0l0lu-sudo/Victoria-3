/* ===== SUMINISTROS POR EJÉRCITO Y RUTAS DE ABASTECIMIENTO =====
   Cada ejército lleva sus propias reservas (por división): comida, agua, pólvora, madera y materiales de fortificación. Se gastan cada día
   (más al marchar, en el desierto o combatiendo) y SOLO se reponen si existe una ruta de suministro SEGURA: una cadena de provincias desde
   el ejército hasta un centro de suministro propio (capital, puerto o red controlada) sin tropas enemigas ni territorio ocupado por el medio.
   Sin ruta segura el ejército vive de lo que encuentra (muy poco), y al agotarse la comida o el agua pierde organización y fuerza; sin
   pólvora dispara a medias; sin madera y materiales no puede levantar fuertes en la batalla. */
const RES_KEYS = ['food', 'water', 'powder', 'wood', 'mat'];
const RES_INFO = {
  food: {n: 'Comida', ic: '🌾', cap: 30, col: '#c9a64a'}, water: {n: 'Agua', ic: '💧', cap: 20, col: '#4aa3d9'}, powder: {n: 'Pólvora', ic: '💥', cap: 20, col: '#9a9a9a'},
  wood: {n: 'Madera', ic: '🪵', cap: 12, col: '#a0703c'}, mat: {n: 'Materiales de fortificación', ic: '🧱', cap: 10, col: '#c26a52'}
};
function armyRes(a) { if (!a.res) a.res = {food: 24, water: 16, powder: 15, wood: 7, mat: 5}; return a.res; }
// índice día a día: qué bandos hay en cada provincia
function resHostIdx() {
  const m = new Map(); G.armies.forEach(o => { if (o.sea) return; let s = m.get(o.loc); if (!s) m.set(o.loc, s = new Set()); s.add(o.tag); }); return m;
}
const resHostile = (tag, pid, idx) => { const s = idx.get(pid); if (s) for (const t of s) if (t !== tag && hostileTags(tag, t)) return true; const by = G.P[pid].by; return !!(by && hostileTags(tag, by)); };
// ruta desde el ejército hacia el centro de suministro, siguiendo el gradiente de la red; es «segura» si ninguna provincia del trayecto está amenazada
function supplyRouteOf(a, idx) {
  const lvl = G.sup && G.sup[a.tag] ? G.sup[a.tag].m : null, path = [a.loc];
  if (!lvl) return {path, ok: true, safe: true, cutAt: -1};
  const seen = new Set([a.loc]); let cur = a.loc;
  for (let i = 0; i < 45; i++) {
    const v = lvl.get(cur) || 0; let best = -1, bv = v + 1e-6;
    MAP.provs[cur].nb.forEach(q => { const w = lvl.get(q) || 0; if (w > bv && !seen.has(q)) { bv = w; best = q; } });
    if (best < 0) break; path.push(best); seen.add(best); cur = best;
  }
  const ok = (lvl.get(cur) || 0) >= 0.5 && (lvl.get(a.loc) || 0) > 0.08;
  let cutAt = -1;
  for (let i = a.battle ? 1 : 0; i < path.length; i++) if (resHostile(a.tag, path[i], idx) && !(i === 0 && !a.battle && !armiesHostileAt(a, idx))) { cutAt = i; break; }
  return {path, ok, safe: ok && cutAt < 0, cutAt};
}
function armiesHostileAt(a, idx) { const s = idx.get(a.loc); if (s) for (const t of s) if (t !== a.tag && hostileTags(a.tag, t)) return true; return false; }
function resCons(a) {
  const bio = MAP.provs[a.loc].biome, moving = a.path && a.path.length > 0 && !a.battle, dig = a.mode === 'dig';
  return {food: moving ? 1.15 : 1, water: (bio === 3 ? 1.7 : 1) * (moving ? 1.1 : 1), powder: 0.04, wood: dig ? 0.5 : 0.05, mat: dig ? 0.12 : 0.02};
}
function armyResDay(a, idx) {
  const r = armyRes(a), rt = a.rt = supplyRouteOf(a, idx), bio = MAP.provs[a.loc].biome, use = resCons(a), lvl = clamp(a.sup === undefined ? 1 : a.sup, 0, 1);
  RES_KEYS.forEach(k => { r[k] = Math.max(0, r[k] - use[k]); });
  if (rt.safe) { const f = (0.4 + lvl * 0.8) * (typeof resTrickle === 'function' ? resTrickle(a) : 1); r.food += 3 * f; r.water += 3 * f; r.powder += 1.6 * f; r.wood += 1.1 * f; r.mat += 0.8 * f; }
  else { r.food += 0.25; if (bio !== 3) r.water += 0.8; if (bio === 2 || bio === 6) r.wood += 0.5; }          // forrajeo: casi nada
  RES_KEYS.forEach(k => { r[k] = clamp(r[k], 0, RES_INFO[k].cap); });
  let k = (r.food <= 0 ? 1 : 0) + (r.water <= 0 ? 1.6 : 0);
  if (k > 0) { a.divs.forEach(d => { d.o = Math.max(0, d.o - DIVS[d.t].org * 0.022 * k); d.s = Math.max(0, d.s - 0.0025 * k); }); a.divs = a.divs.filter(d => d.s > 0.04); if (!a.divs.length) a._dead = true; }
  // aviso al jugador (una vez cada mes por ejército)
  if (a.tag === G.player && (G.date.t - (a._resWarn || -99) > 30)) {
    const low = RES_KEYS.filter(q => q !== 'wood' && q !== 'mat' && r[q] < RES_INFO[q].cap * 0.2);
    if (low.length) { a._resWarn = G.date.t; notify('war', `${a.name}: reservas bajas de ${low.map(q => RES_INFO[q].n.toLowerCase()).join(' y ')}${rt.safe ? '' : ' y la ruta de suministro está cortada'}.`, provState(a.loc)); }
  }
}
function resDay() {
  const idx = resHostIdx(); G.armies.forEach(a => { if (a.sea) return; armyResDay(a, idx); });
  if (G.armies.some(a => a._dead)) { G.armies = G.armies.filter(a => !a._dead); G.battles = G.battles.filter(b => b.A.some(armyById) && b.B.some(armyById)); }
}
const _supplyDay0 = supplyDay;
supplyDay = function () { _supplyDay0(); resDay(); };
// gasto de pólvora en combate (por división, cada día de batalla)
function armyBattleUse(a) { const r = armyRes(a), art = a.divs.length ? a.divs.filter(d => dKind(d) === 'art').length / a.divs.length : 0; r.powder = Math.max(0, r.powder - (0.75 + art * 1.1)); r.food = Math.max(0, r.food - 0.15); }
const resPowderMod = a => { const p = armyRes(a).powder; return p >= 6 ? 1 : p > 1 ? 0.88 + (p - 1) / 5 * 0.12 : 0.62; };
// total (por división media) de un bando, para gastar en fuertes
function sideRes(ids) { const as = ids.map(armyById).filter(Boolean), n = as.reduce((s, a) => s + a.divs.length, 0) || 1, t = {}; RES_KEYS.forEach(k => { t[k] = as.reduce((s, a) => s + armyRes(a)[k] * a.divs.length, 0) / n; }); return {t, as, n}; }
function spendSideRes(ids, cost) { const {as, n} = sideRes(ids); as.forEach(a => { RES_KEYS.forEach(k => { if (cost[k]) armyRes(a)[k] = Math.max(0, armyRes(a)[k] - cost[k]); }); }); void n; }
function resBarsHtml(a) {
  const r = armyRes(a), rt = a.rt;
  const rows = RES_KEYS.map(k => { const i = RES_INFO[k], f = r[k] / i.cap; return `<div class="resrow" data-tip="<b>${i.n}</b><br>${Math.round(r[k] * 10) / 10} de ${i.cap} (por división)"><span>${i.ic}</span><i><b style="width:${Math.round(f * 100)}%;background:${f < 0.2 ? '#e8644f' : i.col}"></b></i></div>`; }).join('');
  const st = !rt ? '<span class="dim">calculando…</span>' : rt.safe ? `<span class="good">✔ segura (${rt.path.length - 1} prov.)</span>` : !rt.ok ? '<span class="bad">✖ sin red de suministro</span>' : `<span class="bad">⚠ cortada${rt.cutAt >= 0 ? ' en ' + provName(rt.path[rt.cutAt]) : ''}</span>`;
  return `<div class="kv"><span>Ruta de suministro</span><b>${st}</b></div><div class="resbox">${rows}</div>`;
}
// líneas de las rutas de suministro en el mapa (SVG), para el ejército seleccionado y los propios con ruta cortada
function supplyRoutesSvg() {
  let h = ''; const sel = window.UI && UI.selArmy;
  G.armies.forEach(a => {
    if (a.sea || a.tag !== G.player || !a.rt || a.rt.path.length < 2) return; if (!(a.id === sel || !a.rt.safe || UI.showRoutes)) return; if (typeof armyVisible === 'function' && !armyVisible(a)) return;
    const pts = a.rt.path.map(pid => { const pv = MAP.provs[pid], p = worldToScreen(pv.lon, 0.5, -pv.lat); return p[0].toFixed(1) + ',' + p[1].toFixed(1); }), last = pts[pts.length - 1].split(',');
    h += `<polyline points="${pts.join(' ')}" class="sroute ${a.rt.safe ? 'ok' : 'cut'}"/><text x="${last[0]}" y="${last[1]}" class="sdepot">🏭</text>`;
    if (!a.rt.safe && a.rt.cutAt >= 0) { const pv = MAP.provs[a.rt.path[a.rt.cutAt]], p = worldToScreen(pv.lon, 0.5, -pv.lat); h += `<text x="${p[0].toFixed(1)}" y="${p[1].toFixed(1)}" class="sdepot cutx">✖</text>`; }
  });
  return h;
}
Object.assign(ACT, {showroutes: () => { UI.showRoutes = !UI.showRoutes; R.dirty = true; if (typeof drawOrders === 'function') drawOrders(); }});
