/* ===== Validación del mapa v2 (se puede llamar en el juego: mapValidate()) ===== */
function mapValidate() {
  const W = MAP_W, H = MAP_H, N = W * H, land = MAP.land, so = MAP.stateOf, S = MAP.seeds.length, P = MAP.provs.length;
  let landPx = 0; for (let i = 0; i < N; i++) landPx += land[i];
  const empty = [], frag = [], islandStates = [], seedOut = [];
  const seen = new Uint8Array(N), stack = new Int32Array(N);
  const comps = (sel, pick) => {   // componentes conexas (8-vecinos, con vuelta en ±180°) de los píxeles i con sel(i)
    const out = []; seen.fill(0);
    for (let k = 0; k < pick.length; k++) { const i0 = pick[k]; if (seen[i0]) continue; let sp = 0, n = 0; stack[sp++] = i0; seen[i0] = 1;
      while (sp) { const i = stack[--sp]; n++; const x = i % W;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { if (!dx && !dy) continue; let nx = x + dx; if (nx < 0) nx = W - 1; else if (nx >= W) nx = 0; const j = i - x + nx + dy * W; if (j < 0 || j >= N || seen[j] || !sel(j)) continue; seen[j] = 1; stack[sp++] = j; } }
      out.push({i0, n}); }
    return out;
  };
  // islas de tierra (componentes de la máscara) para distinguir «fragmento en tierra firme» de «isla del estado»
  const landComp = new Int32Array(N).fill(-1); { let c = 0; for (let i0 = 0; i0 < N; i0++) { if (!land[i0] || landComp[i0] >= 0) continue; let sp = 0; stack[sp++] = i0; landComp[i0] = c;
    while (sp) { const i = stack[--sp], x = i % W; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { if (!dx && !dy) continue; let nx = x + dx; if (nx < 0) nx = W - 1; else if (nx >= W) nx = 0; const j = i - x + nx + dy * W; if (j < 0 || j >= N || !land[j] || landComp[j] >= 0) continue; landComp[j] = c; stack[sp++] = j; } } c++; } MAP.landComps = c; }
  for (let s = 0; s < S; s++) {
    const a = MAP.pixOff[s], b = MAP.pixOff[s + 1]; if (b === a) { empty.push(MAP.seeds[s].name); continue; }
    const pick = MAP.pixOrder.subarray(a, b), cs = comps(j => so[j] === s && land[j], pick);
    const sd = MAP.seeds[s], si = sd.py * W + sd.px; if (so[si] !== s) seedOut.push(sd.name);
    if (cs.length > 1) {
      // varias piezas: ¿alguna pieza secundaria está en la misma masa de tierra que la principal? → fragmento real
      cs.sort((p, q) => q.n - p.n); const main = landComp[cs[0].i0];
      const bad = cs.slice(1).filter(c => landComp[c.i0] === main);
      if (bad.length) frag.push(sd.name + ' (' + bad.map(c => c.n).join('+') + ' px)'); else islandStates.push(sd.name);
    }
  }
  let orphan = 0; for (let i = 0; i < N; i++) if (land[i] && so[i] < 0) orphan++;
  // provincias: conexas y con el mismo número por estado que en v1
  const v1 = typeof provSeedsV1 === 'function' ? provSeedsV1() : null; let provMismatch = 0, provFrag = 0, provEmpty = 0, provWrongState = 0;
  const pp = []; for (let p = 0; p < P; p++) pp.push([]);
  for (let i = 0; i < N; i++) if (land[i]) { const p = MAP.provOf[i]; if (p === NOPROV) continue; pp[p].push(i); if (MAP.provs[p].s !== so[i]) provWrongState++; }
  for (let p = 0; p < P; p++) { if (!pp[p].length) { provEmpty++; continue; } const cs = comps(j => MAP.provOf[j] === p, pp[p]); if (cs.length > 1) { cs.sort((a, b) => b.n - a.n); if (cs.slice(1).some(c => landComp[c.i0] === landComp[cs[0].i0])) provFrag++; } }
  if (v1) { const cnt = {}; v1.forEach(q => { cnt[q.s] = (cnt[q.s] || 0) + 1; }); for (let s = 0; s < S; s++) if ((cnt[s] || 0) !== (MAP.stats[s].provs || []).length) provMismatch++; }
  // vecinos: simétricos y sin estados aislados en tierra firme
  let asym = 0, lonely = 0; MAP.stats.forEach((st, s) => { st.neigh.forEach(t => { if (!MAP.stats[t].neigh.has(s)) asym++; }); if (!st.neigh.size && st.area > 400) lonely++; });
  return {tierraPct: +(landPx / N * 100).toFixed(2), tierraPx: landPx, masasDeTierra: MAP.landComps, islotesRescatados: MAP.islandsKept, estados: S, estadosVacios: empty, estadosNoConexos: frag, estadosConIslas: islandStates.length,
    semillasFueraDeSuEstado: seedOut, semillasSinTierra: MAP.seedsMissing || [], tierraSinEstado: orphan, provincias: P, provinciasV1: v1 ? v1.length : null, estadosConDistintoNumProvincias: provMismatch,
    provinciasVacias: provEmpty, provinciasFragmentadas: provFrag, pixelesDeProvinciaEnOtroEstado: provWrongState, vecinosAsimetricos: asym, estadosSinVecinosGrandes: lonely, rios: MAP.rivers,
    generacionMs: MAP.genMs, tiempos: Object.fromEntries(Object.entries(MAP.genT || {}).map(([k, v]) => [k, Math.round(v)])), semillasProv: MAP.provSeedStats};
}
