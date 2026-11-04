/* ===== REALISMO POSTNAPOLEÓNICO (ver ESTUDIO_GUERRA.md) =====
   Armas por época, coste del ataque frontal, metralla, caballería frente al fusil rayado, convergencia de ejércitos
   («marchar separados, golpear unidos») y guerrilla contra convoyes y depósitos del ocupante. */
// 0 = ánima lisa · 1 = fusil rayado · 2 = retrocarga · 3 = ametralladora / cargador
function weapLvl(tag) {
  const c = G.C[tag]; if (!c || typeof hasTech !== 'function') return 0;
  return hasTech(c, 'machine_guns') ? 3 : hasTech(c, 'breech_loaders') ? 2 : hasTech(c, 'rifled_muskets') ? 1 : 0;
}
const WEAP_NAMES = ['ánima lisa', 'fusil rayado', 'retrocarga', 'ametralladora'];
const WEAP_RANGE = [0.55, 1, 1.2, 1.3], WEAP_RATE = [0.6, 1, 1.5, 2];
function smokeless(tag) { const c = G.C[tag]; return !!c && typeof hasTech === 'function' && (hasTech(c, 'machine_guns') || hasTech(c, 'quick_firing')); }
// el ataque frontal contra fusiles modernos sale caro; el flanqueo y el hostigamiento, mucho menos
const FRONT_COST = {frontal: 1, charge: 1.35, barrage: 0.8, hold: 0.7, skirmish: 0.6, flank: 0.45};
const _sideStatsR = sideStats;
sideStats = function (b, ids, isAttacker) {
  const r = _sideStatsR(b, ids, isAttacker);
  const key = ids === b.A ? 'A' : ids === b.B ? 'B' : null; if (!key) return r;
  const opp = key === 'A' ? b.B0 : b.A0, ol = weapLvl(opp), st = b['str' + key] || 'frontal';
  if (isAttacker && ol > 0) {
    const cover = MAP.provs[b.prov] ? clamp(MAP.provs[b.prov].terr.def - 1, 0, 0.4) : 0;
    let k = 1 + 0.16 * ol * (FRONT_COST[st] || 1) * (1 + cover);
    if (r.art > 0 && b.day > 1) k *= 0.92;            // preparación artillera
    r.cas *= clamp(k, 1, 1.75);
  }
  // convergencia: ejércitos que llegan al campo desde direcciones distintas (Moltke); con Estado Mayor es más eficaz
  const dirs = new Set(); ids.forEach(id => { const a = armyById(id); if (a && a.from !== undefined && a.from !== null) dirs.add(a.from); });
  if (dirs.size >= 2) {
    const c = G.C[key === 'A' ? b.A0 : b.B0], staff = c && typeof hasTech === 'function' && hasTech(c, 'general_staff');
    const bonus = Math.min(0.15, 0.04 * (dirs.size - 1)) * (staff ? 1.5 : 0.8);
    r.F *= 1 + bonus; r.conv = bonus;
  }
  return r;
};
/* ---- viewer: alcance y cadencia por época; metralla; caballería ---- */
function bvWeap(blk) { return weapLvl(blk.tag); }
function tacCanister(V, b, blk, tgt, gn) {
  const dir = blk.side === 'A' ? 1 : -1;
  for (let i = 0; i < 7; i++) bvPart(V, {k: 'tracer', x: gn.x, y: gn.y, x2: tgt.x + rnd(-tgt.wid / 2, tgt.wid / 2), y2: tgt.y + rnd(-tgt.wid / 2, tgt.wid / 2), life: 0.12});
  for (let i = 0; i < 4; i++) bvPart(V, {k: 'smoke', x: gn.x + dir * 12, y: gn.y + rnd(-6, 6), life: 1.8, r: 6, vx: dir * 12 + rnd(-4, 4)});
  const al = tgt.figs.filter(q => q.alive && !q.flee);
  for (let i = 0; i < 3 && al.length; i++) { const q = al.splice(Math.floor(Math.random() * al.length), 1)[0]; if (q) bvKill(V, tgt, q); }
  const org = DIVS[tgt.d.t].org; tgt.d.s = Math.max(0, tgt.d.s - 0.009); tgt.d.o = Math.max(0, tgt.d.o - org * 0.03);
  if (typeof SFX !== 'undefined') SFX.cannon(1);
}
/* ---- guerrilla: los focos de resistencia hostigan convoyes y depósitos del ocupante ---- */
const _resistanceWeekR = resistanceWeek;
resistanceWeek = function () {
  _resistanceWeekR();
  const R = (G.mx && G.mx.res) || {};
  if (G.convoys && G.convoys.length) {
    const dead = new Set();
    G.convoys.forEach(cv => {
      const pid = cv.path[cv.i]; if (pid === undefined) return;
      const near = [pid, ...MAP.provs[pid].nb].reduce((m, p) => Math.max(m, G.P[p] && G.P[p].by === cv.tag ? (R[p] || 0) : 0), 0);
      if (near > 35 && Math.random() < (near - 30) / 220) {
        dead.add(cv.id);
        const msg = `Guerrilleros emboscan un convoy de ${G.C[cv.tag].name} cerca de ${provName(pid)}.`;
        if (cv.tag === G.player || G.P[pid].by === cv.tag && provOwner(pid) === G.player) notify('war', msg, provState(pid)); else if (typeof logMsg === 'function') logMsg(msg);
      }
    });
    if (dead.size) G.convoys = G.convoys.filter(cv => !dead.has(cv.id));
  }
  (G.depotList || []).slice().forEach(pid => {
    const p = G.P[pid], r = R[pid] || 0; if (!p.depot || !p.by || p.by !== p.depot || r < 50 || Math.random() > (r - 45) / 400) return;
    if (p.depot === G.player) notify('war', `Los guerrilleros incendian tu depósito de ${provName(pid)}.`, provState(pid));
    removeDepot(pid);
  });
};
