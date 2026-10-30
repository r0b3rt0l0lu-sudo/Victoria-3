/* ===== PRODUCCIÓN MILITAR POR LÍNEAS =====
   Las fábricas militares de un país (arsenales: niveles de armerías, fundiciones, pólvora, aeronáuticas, astilleros… más una parte de su
   industria general) se reparten entre líneas de producción. Cada línea compra en el mercado los insumos (consumiendo la oferta mundial)
   y los convierte en equipo del inventario nacional. La eficiencia sube del 10% al 100% mientras se mantiene la línea y cae al cambiar
   de generación o retirar fábricas. El equipo antiguo sigue sirviendo, con penalización. */
const LINE_KINDS = {
  rifles: {name: 'Fusiles', icon: '🔫', eq: 'rifles', rate: 700, gens: [
    {n: 'Fusil de chispa', t: null}, {n: 'Fusil de percusión', t: 'percussion_cap'}, {n: 'Fusil de retrocarga', t: 'breech_loaders'}, {n: 'Fusil de cerrojo', t: 'bolt_action'}]},
  cannons: {name: 'Artillería', icon: '💣', eq: 'cannons', rate: 45, gens: [
    {n: 'Cañón de ánima lisa', t: null}, {n: 'Cañón rayado de acero', t: 'steel_artillery'}, {n: 'Cañón de tiro rápido', t: 'quick_firing'}]},
  ammo: {name: 'Munición', icon: '💥', eq: 'gunpowder', rate: 900, gens: [
    {n: 'Pólvora negra', t: null}, {n: 'Pólvora sin humo', t: 'organic_chem'}]},
  mgs: {name: 'Ametralladoras', icon: '🔫', eq: 'mgs', rate: 25, gens: [
    {n: 'Ametralladora Maxim', t: 'machine_guns'}, {n: 'Ametralladora refrigerada', t: 'trench_warfare'}]},
  aircraft: {name: 'Aviones', icon: '✈️', eq: 'aircraft', rate: 9, gens: [
    {n: 'Biplano', t: 'military_aviation'}, {n: 'Monoplano de combate', t: 'fighters'}]},
  ships: {name: 'Buques (tonelaje)', icon: '⚓', eq: 'ships', rate: 7, gens: [
    {n: 'Casco de madera', t: null}, {n: 'Casco de hierro', t: 'steam_frigate'}, {n: 'Casco de acero', t: 'ironclad'}, {n: 'Turbinas y acero reforzado', t: 'dreadnought'}]}
};
const LINE_ORDER = ['rifles', 'cannons', 'ammo', 'mgs', 'aircraft', 'ships'];
// primera generación disponible (la línea no existe sin ella) y mejor generación disponible
function lineAvail(c, k) { const g = LINE_KINDS[k].gens; return hasTech(c, g[0].t) || g[0].t === null; }
function bestGen(c, k) { const gens = LINE_KINDS[k].gens; let b = -1; gens.forEach((g, i) => { if (g.t === null || hasTech(c, g.t)) b = i; }); return b; }
function gensOf(c, k) { return LINE_KINDS[k].gens.map((g, i) => ({i, n: g.n, ok: g.t === null || hasTech(c, g.t)})).filter(g => g.ok); }
function lineOf(c, k) { const m = mc(c); if (!m.lines[k]) m.lines[k] = {f: 0, eff: 0.1, gen: Math.max(0, bestGen(c, k)), out: 0, need: 0}; return m.lines[k]; }

/* ---------- calidad del equipo almacenado ---------- */
function eqAdd(c, g, amt, gen) {
  if (!c.eq) c.eq = {}; const m = mc(c), cur = c.eq[g] || 0;
  m.q[g] = cur + amt > 0 ? ((m.q[g] || 0) * cur + gen * amt) / (cur + amt) : (m.q[g] || 0);
  c.eq[g] = cur + amt;
}
const EQ_KIND = {rifles: 'rifles', cannons: 'cannons', gunpowder: 'ammo', mgs: 'mgs', aircraft: 'aircraft', ships: 'ships'};
function eqBestGen(c, g) { const k = EQ_KIND[g]; return k ? Math.max(0, bestGen(c, k)) : 0; }
// bonificación (o penalización) del equipo de una división por su generación media; el equipo antiguo rinde peor
function qualMod(tag, type) {
  const c = G.C[tag]; if (!c || !c.m2) return 1;
  const n = DIV_NEEDS[type]; if (!n) return 1;
  const g = n.cannons && !n.rifles ? 'cannons' : (n.cannons && n.cannons > (n.rifles || 0) / 8) ? 'cannons' : 'rifles';
  const q = c.m2.q[g] || 0, best = eqBestGen(c, g);
  return clamp(1 + 0.07 * q - 0.04 * Math.max(0, best - q), 0.85, 1.25);
}

/* ---------- producción semanal ---------- */
function linesWeek() {
  G.tags.forEach(tag => {
    if (tag === NONE) return; const c = G.C[tag]; if (!c.states.length || !c.eq) return;
    const m = mc(c), F = milFactories(c), need = eqNeedOf(tag);
    LINE_ORDER.forEach(k => { if (lineAvail(c, k)) lineOf(c, k); });
    if (c.ai) aiLines(c, F, need);
    // las fábricas asignadas no pueden superar las disponibles
    let used = 0; LINE_ORDER.forEach(k => { const L = m.lines[k]; if (L) used += L.f; });
    if (used > F) { LINE_ORDER.slice().reverse().forEach(k => { const L = m.lines[k]; if (L && used > F) { const d = Math.min(L.f, used - F); L.f -= d; used -= d; } }); }
    m.free = F - used; m.F = F;
    LINE_ORDER.forEach(k => {
      const L = m.lines[k]; if (!L) return; const K = LINE_KINDS[k];
      if (L.f > 0) L.eff = Math.min(1, L.eff + 0.045 + L.f * 0.001); else L.eff = Math.max(0.1, L.eff - 0.05);
      let out = L.f * K.rate * L.eff;
      const g = K.eq, cap = Math.max(K.rate * 4, (need[g] || 0) * 3, g === 'ships' ? 1800 : g === 'aircraft' ? 700 : 0);       // no se acumula sin límite
      const stock = c.eq[g] || 0; out = Math.max(0, Math.min(out, cap - stock));
      const R = Math.max(clamp(G.ratio[g] === undefined ? 1 : G.ratio[g], 0, 1), g === 'aircraft' || g === 'mgs' ? 0.7 : 0);      // los arsenales producen aviones y ametralladoras aunque la industria civil no abastezca
      G.milD[g] = (G.milD[g] || 0) + out;
      out *= R;
      const price = G.price[g] || GOOD[g].base, cost = out * price * 0.95;
      if (cost > c.treasury * 0.4 && c.treasury > 0) out *= Math.max(0, c.treasury * 0.4 / cost); else if (c.treasury <= 0) out = 0;
      L.out = out; L.need = need[g] || 0;
      if (out > 0) { c.treasury -= out * price * 0.95; eqAdd(c, g, out, L.gen); L.made = (L.made || 0) + out; }
    });
  });
}
// asignación automática de la IA: reparte las fábricas según el déficit de cada equipo (se intenta cerrar el hueco en ~10 semanas)
function aiLines(c, F, need) {
  const gap = {rifles: (need.rifles || 0) * 1.3 - (c.eq.rifles || 0), cannons: (need.cannons || 0) * 1.3 - (c.eq.cannons || 0), ammo: (need.gunpowder || 0) * 1.3 - (c.eq.gunpowder || 0), mgs: (need.mgs || 0) * 1.3 - (c.eq.mgs || 0), aircraft: aircraftWantSafe(c), ships: shipsWant(c)};
  const ks = LINE_ORDER.filter(k => lineAvail(c, k)), f = {}; let tot = 0;
  ks.forEach(k => { f[k] = Math.max(0, Math.ceil(gap[k] / (LINE_KINDS[k].rate * 10 * 0.8))); tot += f[k]; });
  const sc = tot > F ? F / tot : 1; let used = 0;
  ks.forEach(k => { f[k] = Math.floor(f[k] * sc); used += f[k]; });
  let left = Math.min(F - used, tot - used); ks.sort((a, b) => gap[b] - gap[a]); let i = 0; while (left > 0 && ks.length && i < 400) { const k = ks[i++ % ks.length]; if (gap[k] > 0) { f[k]++; left--; } }
  ks.forEach(k => { const L = lineOf(c, k), bg = Math.max(0, bestGen(c, k)); if (L.gen < bg && (G.week + c.id) % 13 === 0) { L.gen = bg; L.eff = Math.max(0.1, L.eff * 0.5); } L.f = f[k] || 0; });
}
const shipsWant = c => typeof navalWantPts === 'function' ? navalWantPts(c) : 0;
const aircraftWantSafe = c => typeof aircraftWant === 'function' ? aircraftWant(c) : 0;

// cambios del jugador
function lineSet(c, k, d) {
  const m = mc(c), L = lineOf(c, k), F = m.F || milFactories(c); let used = 0; LINE_ORDER.forEach(x => { if (m.lines[x]) used += m.lines[x].f; });
  if (d > 0 && used < F && lineAvail(c, k)) L.f++; else if (d < 0 && L.f > 0) { L.f--; L.eff = Math.max(0.1, L.eff * 0.85); }
}
function lineGen(c, k) { const L = lineOf(c, k), gs = gensOf(c, k); if (gs.length < 2) return; const i = gs.findIndex(g => g.i === L.gen), nx = gs[(i + 1) % gs.length]; L.gen = nx.i; L.eff = Math.max(0.1, L.eff * 0.3); }

/* ---------- interfaz ---------- */
function productionHtml() {
  const c = me(), m = mc(c), F = m.F || milFactories(c), need = eqNeedOf(c.tag); let used = 0; LINE_ORDER.forEach(k => { if (m.lines[k]) used += m.lines[k].f; });
  const rows = LINE_ORDER.filter(k => lineAvail(c, k)).map(k => { const K = LINE_KINDS[k], L = lineOf(c, k), g = K.eq, have = c.eq[g] || 0, nd = need[g] || 0, def = nd - have, gs = gensOf(c, k);
    return `<tr><td>${K.icon} <b>${K.name}</b><br><small class="dim">${K.gens[L.gen].n}</small></td>
      <td class="r"><button data-act="linef" data-k="${k}" data-d="-1">−</button> <b>${L.f}</b> <button data-act="linef" data-k="${k}" data-d="1" ${used >= F ? 'disabled' : ''}>＋</button></td>
      <td>${bar(L.eff, 1, L.eff > .7 ? '' : 'warn', Math.round(L.eff * 100) + '%')}</td>
      <td class="r">${fmtN(L.out || 0, 0)} /sem</td>
      <td class="r ${def > 0 ? 'bad' : 'good'}">${fmtN(have, 0)} / ${fmtN(nd, 0)}<br><small>${def > 0 ? 'déficit ' + fmtN(def, 0) : 'cubierto'}</small></td>
      <td class="r">${gs.length > 1 ? `<button data-act="linegen" data-k="${k}" data-tip="Cambiar de generación reduce la eficiencia al 30%">Cambiar modelo</button>` : '<small class="dim">única</small>'}</td></tr>`; }).join('');
  const q = g => (c.m2.q[g] || 0).toFixed(1);
  return `<div class="cols"><div class="col wide"><div class="card"><h3>🏭 Líneas de producción militar</h3>
    <div class="kv"><span>Fábricas militares</span><b>${F} (${F - used} libres)</b></div>
    <p class="hint">Las fábricas militares (niveles de armerías, fundiciones, fábricas de pólvora, aeronáuticas y astilleros, más una parte de la industria general) se asignan a líneas. La eficiencia sube del 10% al 100% si mantienes la misma línea; cambiar de modelo o quitar fábricas la hace bajar. Cada línea compra sus insumos en el mercado mundial y lo produce en tu inventario.</p>
    <table class="tbl"><thead><tr><th>Línea</th><th class="r">Fábricas</th><th>Eficiencia</th><th class="r">Producción</th><th class="r">Inventario / necesidad</th><th></th></tr></thead><tbody>${rows}</tbody></table></div></div>
    <div class="col"><div class="card"><h3>Generación del equipo</h3>${['rifles', 'cannons', 'gunpowder', 'mgs'].filter(g => (c.eq[g] || 0) > 0).map(g => `<div class="kv sm"><span>${GOOD[g].icon} ${GOOD[g].name}</span><b>gen. media ${q(g)} / mejor ${eqBestGen(c, g)}</b></div>`).join('')}
    <p class="hint">Las generaciones nuevas dan hasta +14% de rendimiento a las divisiones; el equipo antiguo aún sirve, pero con penalización frente a lo último en tu tecnología.</p></div>
    <div class="card"><h3>Aviones y buques</h3><div class="kv sm"><span>✈️ Aviones en inventario</span><b>${fmtN(c.eq.aircraft || 0, 0)}</b></div><div class="kv sm"><span>⚓ Tonelaje en inventario</span><b>${fmtN(c.eq.ships || 0, 0)}</b></div><div class="kv sm"><span>⚙️ Ametralladoras</span><b>${fmtN(c.eq.mgs || 0, 0)}</b></div></div></div></div>`;
}
MX_TABS.push({id: 'production', label: '🏭 Producción', html: productionHtml});
Object.assign(ACT, {
  linef: d => { lineSet(me(), d.k, +d.d); renderWindow(); },
  linegen: d => { lineGen(me(), d.k); renderWindow(); }
});
