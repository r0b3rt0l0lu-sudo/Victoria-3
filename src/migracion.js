/* ===== MIGRACIÓN DE POBLACIÓN =====
   Cada mes una parte de los campesinos y obreros se traslada de los estados con peor nivel de vida y más paro hacia los vecinos (del mismo país) con mejor vida y empleo:
   las ciudades industriales crecen, el campo se vacía y los estados que pierden gente acumulan malestar. Con la ley de migración «libre» también cruzan fronteras hacia países
   de mayor nivel de vida; con «fronteras cerradas» no. El movimiento es pequeño (≤1,2 % de los campesinos/obreros al mes) para no desestabilizar la simulación. */
function migScore(s) { const P = Math.max(1, popTotal(s)); return (s.solAvg || 8) - 10 * clamp((s.unemp || 0) / (P * WF), 0, 1) + (s.city ? 0.6 : 0) + ((s.b.constr || 0) > 0 ? 0.3 : 0); }
function migMonth() {
  const flows = {}; G.migLast = {};
  G.S.forEach(si => {
    if (si.owner === NONE) return; const ci = G.C[si.owner], mi = migScore(si); let best = null, bd = 0.8;
    si.neigh.forEach(j => { const sj = G.S[j]; if (sj.owner === NONE) return; const same = sj.owner === si.owner, cj = G.C[sj.owner];
      if (!same) { const li = ci.laws.migration, lj = cj.laws.migration; if (lj === 'closed_borders' || li === 'closed_borders' || !(lj === 'free_movement' || li === 'free_movement')) return; }
      const d = (migScore(sj) - mi) * (same ? 1 : 0.5); if (d > bd) { bd = d; best = sj; } });
    if (!best) return; const frac = clamp(0.0015 * bd, 0, 0.012), moved = {};
    ['peasants', 'laborers'].forEach(pr => { const n = (si.pops[pr] || 0) * frac; if (n > 5) { si.pops[pr] -= n; best.pops[pr] = (best.pops[pr] || 0) + n; moved[pr] = n; } });
    const tot = (moved.peasants || 0) + (moved.laborers || 0); if (tot <= 0) return;
    flows[si.id + '>' + best.id] = tot; G.migLast[si.id] = (G.migLast[si.id] || 0) - tot; G.migLast[best.id] = (G.migLast[best.id] || 0) + tot;
    if (si.rad !== undefined) si.rad = Math.min(1, si.rad + 0.002 * bd);
  });
  G.migFlows = Object.entries(flows).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => { const [a, b] = k.split('>'); return {from: +a, to: +b, n: v}; });
}
const _navalMonthMig = navalMonth; let _migT = -1;
navalMonth = function (c) { _navalMonthMig(c); if (_migT !== G.date.t) { _migT = G.date.t; try { migMonth(); } catch (e) { } } };
const _popsRenderMig = WINDOWS.pops.render;
WINDOWS.pops.render = function () {
  const h = _popsRenderMig.call(this), c = me(); const fl = (G.migFlows || []).filter(f => G.S[f.from].owner === c.tag || G.S[f.to].owner === c.tag).slice(0, 5);
  const card = `<div class="card"><h3>🧳 Migración</h3>${fl.length ? fl.map(f => `<div class="kv sm"><span>${G.S[f.from].name} → ${G.S[f.to].name}${G.S[f.from].owner !== G.S[f.to].owner ? ' 🌍' : ''}</span><b>${fmtN(f.n, 0)}</b></div>`).join('') : '<small class="dim">Sin movimientos importantes este mes.</small>'}<small class="dim">Los trabajadores se mudan a estados vecinos con mejor nivel de vida y menos paro. Política migratoria «libre» permite cruzar fronteras.</small></div>`;
  return h + card;
};
