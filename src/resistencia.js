/* ===== RESISTENCIA EN PROVINCIAS OCUPADAS =====
   Cada provincia ocupada genera resistencia (0-100) según la cultura de sus habitantes respecto al ocupante (el estado de origen del
   territorio y su perfil cultural). Las guarniciones (divisiones del ocupante estacionadas en la provincia) la contienen. Una resistencia
   alta ataca el suministro del ocupante y, si desborda, libera la provincia. */
const RES_CAP = 100;
function resMap() { return mx().res || (mx().res = {}); }
const provRes = pid => (G.mx && G.mx.res && G.mx.res[pid]) || 0;
// afinidad cultural del territorio con el ocupante: 0.3 (son «de los suyos») … 1.5 (cultura ajena)
function cultureK(sid, occ) {
  const orig = MAP.seeds[sid] && MAP.seeds[sid].owner; if (!orig || orig === NONE) return 1.0;
  if (orig === occ) return 0.3;
  const A = G.C[orig], B = G.C[occ]; if (!A || !B) return 1.0;
  let k = A.profile === B.profile ? 0.8 : 1.4;
  const rel = A.adj && B.adj && A.adj === B.adj ? -0.2 : 0; return Math.max(0.3, k + rel);
}
function garrisonOf(pid, occ) { let n = 0; armiesAt(pid).forEach(a => { if (a.tag === occ || sameSide(a.tag, occ)) a.divs.forEach(d => { n += dKind(d) === 'inf' ? 1 : dKind(d) === 'cav' ? 0.8 : 0.3; }); }); return n; }
function resistanceWeek() {
  const R = resMap();
  const occ = []; G.P.forEach((p, pid) => { if (p.by) occ.push(pid); });
  occ.forEach(pid => {
    const pr = G.P[pid], sid = provState(pid), owner = G.S[sid].owner; if (owner === NONE || !pr.by) return;
    const k = cultureK(sid, pr.by), g = garrisonOf(pid, pr.by), rad = (G.C[owner].radicals || 0);
    const need = 0.6 + k * 0.8;                              // divisiones que hacen falta para contenerla
    let d = (k * 1.6 + rad * 2) * (1 - 0.2 * Math.min(1, g / need)) - g * 1.1;
    if ((G.S[sid].occ || 0) >= 1) d += 0.4;                    // el estado entero ocupado resiste más
    R[pid] = clamp((R[pid] || 0) + d, 0, RES_CAP);
    if (R[pid] <= 0) delete R[pid];
    if (R[pid] >= 80 && Math.random() < (R[pid] - 78) / 100 * 0.3) {          // desbordamiento: la provincia se libera
      pr.by = null; pr.prog = 0; R[pid] = 25; refreshStateOcc(sid); if (typeof onFrontChanged === 'function') onFrontChanged(new Set([sid]));
      if (owner === G.player || pr.pby === G.player) notify('war', `¡Levantamiento en ${provName(pid)}! La resistencia expulsa a la guarnición de ${G.C[pr.pby || owner].name}.`, sid);
    }
  });
  // la resistencia de provincias ya libres decae
  for (const pid in R) if (!G.P[pid].by) { R[pid] -= 4; if (R[pid] <= 0) delete R[pid]; }
}
// penalización de suministro por la resistencia del lugar donde está el ejército
function resSupplyMul(a) { const r = provRes(a.loc); return r > 40 ? 1 - 0.55 * (r - 40) / 60 : 1; }
// la IA envía guarniciones a las provincias ocupadas con más resistencia
function resistanceAI(c) {
  const hot = []; G.P.forEach((p, pid) => { if (p.by === c.tag && provRes(pid) > 45 && garrisonOf(pid, c.tag) < 1) hot.push(pid); });
  if (!hot.length) return;
  const idle = armiesOf(c.tag).filter(a => !a.battle && !a.path.length && !a.sea && !a.front && a.divs.length <= 3);
  hot.slice(0, 2).forEach(pid => { let best = null, bd = 1e9; idle.forEach(a => { const d = provDist(a.loc, pid); if (d < bd) { bd = d; best = a; } }); if (best) { orderMove(best, pid); idle.splice(idle.indexOf(best), 1); } });
}
function resistanceAIWeek() { G.tags.forEach(t => { if (t !== NONE && G.C[t].ai && G.C[t].wars.length) resistanceAI(G.C[t]); }); }

function occupationHtml() {
  const R = resMap(), mine = []; G.P.forEach((p, pid) => { if (p.by === G.player) mine.push(pid); });
  mine.sort((a, b) => provRes(b) - provRes(a));
  const lost = []; G.C[G.player].states.forEach(sid => MAP.stats[sid].provs.forEach(pid => { if (G.P[pid].by && !sameSide(G.player, G.P[pid].by)) lost.push(pid); }));
  const row = pid => { const r = provRes(pid), g = garrisonOf(pid, G.player), sid = provState(pid); return `<tr class="clk" data-act="focusprov" data-id="${pid}"><td><b>${provName(pid)}</b> <small class="dim">${G.C[G.S[sid].owner].name}</small></td><td class="r">×${cultureK(sid, G.player).toFixed(1)}</td><td>${bar(r, 100, r > 60 ? 'bad' : r > 35 ? 'warn' : '', Math.round(r) + '%')}</td><td class="r ${g < 0.8 ? 'bad' : ''}">${g.toFixed(1)}</td></tr>`; };
  return `<div class="cols"><div class="col wide"><div class="card"><h3>🏴 Provincias ocupadas por ti</h3>${mine.length ? `<table class="tbl clickable"><thead><tr><th>Provincia</th><th class="r">Hostilidad cultural</th><th>Resistencia</th><th class="r">Guarnición</th></tr></thead><tbody>${mine.slice(0, 40).map(row).join('')}</tbody></table>` : '<p class="hint">No ocupas ninguna provincia.</p>'}
    <p class="hint">Cada provincia ocupada genera resistencia según la cultura de sus habitantes frente a tu país. Estaciona divisiones (mejor infantería) para contenerla. Con más de un 40% tus ejércitos allí pierden suministro, y con más de un 80% hay riesgo de levantamiento que libera la provincia.</p></div></div>
    <div class="col"><div class="card"><h3>Tus provincias ocupadas por enemigos</h3>${lost.length ? lost.slice(0, 20).map(pid => `<div class="kv sm clk" data-act="focusprov" data-id="${pid}"><span>${provName(pid)}</span><b>${flag(G.P[pid].by, 'sm')} resistencia ${Math.round(provRes(pid))}%</b></div>`).join('') : '<p class="hint">Ninguna.</p>'}<p class="hint">Si la población resiste, el ocupante tendrá problemas: puedes recuperarla cuando se desborde.</p></div></div></div>`;
}
MX_TABS.push({id: 'occupation', label: '🏴 Ocupación', html: occupationHtml});
