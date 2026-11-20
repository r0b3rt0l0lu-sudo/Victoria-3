/* ===== BASES NAVALES: nivel de puerto, alcance y reparación =====
   Cada estado con puerto puede tener Base Naval (edificio de gobierno, nivel 0-4). El nivel multiplica la reparación de las flotas atracadas o en la zona
   y amplía su alcance: una flota a más de ALCANCE zonas de cualquier base propia o aliada sufre desgaste por falta de suministro (casco y no repara).
   alcance = 40 + 14 × (mejor nivel entre las bases cercanas). Las grandes potencias de la IA van ampliando sus bases con el tiempo. */
(function () {
  const b = {id: 'navalbase', name: 'Bases Navales', icon: '⚓', grp: 'Gobierno', out: null, workers: {soldiers: .5, laborers: .5}, cost: 260, cap: 'coast', gov: true, nav: 1};
  if (!BLD.navalbase) { BUILDINGS.push(b); BLD.navalbase = b; b.inputs = {}; b.workersPerLevel = 2000; }
})();
const _milCapsPB = milCaps;
milCaps = function () { _milCapsPB(); G.S.forEach(s => { const port = MAP.stats[s.id].provs.some(p => MAP.provs[p].port); s.cap.navalbase = port ? 4 : 0; s.b.navalbase = port ? Math.min(1.5, Math.max(0.4, Math.sqrt(s.popBase / 3000))) * (G.C[s.owner] && G.C[s.owner].rank <= 12 ? 1 : 0.5) : 0; }); };
function baseLvl(sid) {       // partidas antiguas o escenarios sin edificio: nivel por defecto según población (se fija una vez)
  const s = G.S[sid]; if (s.b.navalbase === undefined) { const port = MAP.stats[sid].provs.some(p => MAP.provs[p].port); s.cap.navalbase = port ? 4 : 0; s.b.navalbase = port ? Math.min(1.5, Math.max(0.4, Math.sqrt(s.popBase / 3000))) * (G.C[s.owner] && G.C[s.owner].rank <= 12 ? 1 : 0.5) : 0; }
  return s.b.navalbase || 0;
}
function baseZones(tag) {      // zona → mejor nivel de base propia o aliada
  const m = new Map(); G.tags.forEach(t => { if (t === NONE) return; if (!(t === tag || sameSide(tag, t))) return; G.C[t].states.forEach(id => { const L = baseLvl(id); if (L <= 0) return; MAP.stats[id].provs.forEach(p => { if (MAP.provs[p].port) { const z = seaZoneOfProv(p); m.set(z, Math.max(m.get(z) || 0, L)); } }); }); }); return m;
}
const _bzCache = {t: -1, m: {}};
function baseInfo(tag, zone) {
  if (_bzCache.t !== G.date.t) { _bzCache.t = G.date.t; _bzCache.m = {}; } let bz = _bzCache.m[tag]; if (!bz) bz = _bzCache.m[tag] = baseZones(tag);
  let best = 1e9, lv = 0; bz.forEach((L, z) => { const d = z === zone ? 0 : zoneDist(zone, z); if (d < best) { best = d; lv = L; } else if (d === best && L > lv) lv = L; });
  if (!bz.size) return {dist: 0, lvl: 0, range: 1e9}; const maxL = Math.max(0, ...bz.values()); return {dist: best, lvl: lv, range: 40 + 14 * Math.max(lv, maxL * 0.5)};
}
const _navyDayPB = navyDay;
navyDay = function () {
  _navyDayPB(); const M = mx(); if (!M.fl.length) return;
  M.fl.forEach(f => { if (f.tr || !f.ships.length) return; const c = G.C[f.tag]; if (!c) return; const bi = baseInfo(f.tag, f.zone);
    if (f.port != null || bi.dist === 0) { const rep = 0.012 * bi.lvl + (f.port != null ? 0.01 * baseLvl(f.port) : 0); if (rep > 0) f.ships.forEach(s => { s.hp = Math.min(1, s.hp + rep); }); }
    else if (bi.dist > bi.range) { f.ships.forEach(s => { s.hp -= 0.0025 * (1 + (bi.dist - bi.range) / 30); if (s.hp < 0.05) s.hp = 0.05; }); if (f.tag === G.player && !f.warnedRange && G.date.t % 5 === 0) { f.warnedRange = true; notify('war', `⚠️ ${f.name} opera fuera del alcance de tus bases navales y sufre desgaste.`); } }
    else f.warnedRange = false; });
};
// la IA amplía sus bases: las potencias navales mejoran su mejor puerto cada pocos meses
const _navalMonthPB = navalMonth;
navalMonth = function (c) {
  _navalMonthPB(c); if (!c.ai || !c.states.length || c.rank > 14 || (G.date.m + c.id) % 3) return;
  const ps = c.states.filter(id => G.S[id].cap.navalbase > 0 && G.S[id].b.navalbase < G.S[id].cap.navalbase).sort((a, b) => G.S[b].popBase - G.S[a].popBase); if (ps.length && c.treasury > 0) { const s = G.S[ps[0]]; s.b.navalbase = Math.min(s.cap.navalbase, s.b.navalbase + 0.25); }
};
