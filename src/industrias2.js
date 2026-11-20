/* ===== INDUSTRIAS 2 · MÁS SECTORES PARA CRECER =====
   Seis industrias de consumo y de la segunda revolución industrial, con sus bienes, su demanda en la escalera de consumo
   (con fecha de entrada, para que no penalicen antes de existir) y su capacidad por estado. */
[
  {id: 'paper', name: 'Papel', base: 18, icon: '📄', color: '#e6dfc8', cat: 'Industriales'},
  {id: 'glass', name: 'Vidrio', base: 20, icon: '🪟', color: '#9ccfe0', cat: 'Industriales'},
  {id: 'canned', name: 'Conservas', base: 20, icon: '🥫', color: '#c28a5a', cat: 'Alimentos'},
  {id: 'appliances', name: 'Electrodomésticos', base: 70, icon: '📻', color: '#c9a34a', cat: 'Lujo'},
  {id: 'autos', name: 'Automóviles', base: 400, icon: '🚗', color: '#a84a4a', cat: 'Lujo'}
].forEach(g => { if (!GOOD[g.id]) { GOODS.push(g); GOOD[g.id] = g; } });

const IND2 = [
  {id: 'papermill', name: 'Fábricas de Papel', icon: '📄', grp: 'Industria', out: 'paper', inputs: {wood: 2500, coal: 400}, workers: {laborers: .85, machinists: .15}, cost: 260, cap: 'ind'},
  {id: 'glassworks', name: 'Vidrierías', icon: '🪟', grp: 'Industria', out: 'glass', inputs: {coal: 1800, saltpeter: 400}, workers: {laborers: .85, machinists: .15}, cost: 260, cap: 'ind'},
  {id: 'cannery', name: 'Conserveras', icon: '🥫', grp: 'Industria', out: 'canned', inputs: {fish: 1500, meat: 400, iron: 500}, workers: {laborers: .85, machinists: .15}, cost: 280, cap: 'ind', tech: 'refrigeration'},
  {id: 'appliworks', name: 'Fábricas de Electrodomésticos', icon: '📻', grp: 'Industria', out: 'appliances', inputs: {steel: 700, glass: 400, tools: 300}, workers: {laborers: .7, machinists: .3}, cost: 380, cap: 'ind', tech: 'electricity'},
  {id: 'autoworks', name: 'Fábricas de Automóviles', icon: '🚗', grp: 'Industria', out: 'autos', inputs: {engines: 900, steel: 1200, tools: 400, glass: 300}, workers: {laborers: .65, machinists: .35}, cost: 460, cap: 'ind', tech: 'assembly_line'}
];
IND2.forEach(b => {
  if (BLD[b.id]) return;
  BUILDINGS.push(b); BLD[b.id] = b; b.workersPerLevel = WORKERS_PER_LEVEL;
  let iv = 0; for (const g in b.inputs) iv += b.inputs[g] * GOOD[g].base;
  b.outAmt = (iv + VA_PER_WORKER * b.workersPerLevel) / GOOD[b.out].base;
});
// consumo por persona y semana; «from» = año de entrada de la demanda
[
  {g: 'paper', q: 0.006, w: 0.8, from: 0},
  {g: 'glass', q: 0.004, w: 0.7, from: 0},
  {g: 'canned', q: 0.006, w: 0.8, from: 1885},
  {g: 'appliances', q: 0.0030, w: 1, from: 1895},
  {g: 'autos', q: 0.0012, w: 1.2, from: 1908}
].forEach(l => { if (!LADDER.some(x => x.g === l.g)) LADDER.push(l); });

const _milCaps = milCaps;
milCaps = function () {
  _milCaps();
  const S = G.S; let pop = 0; S.forEach(s => pop += s.popBase * 1000);
  const q = {}; LADDER.forEach(l => { q[l.g] = l.q; });
  IND2.forEach(b => {
    const w = S.map(s => { const c = G.C[s.owner], ind = c ? c.ind : 0.05; return Math.pow(s.popBase, 1.3) * (0.25 + 3 * ind); });
    const tot = w.reduce((a, x) => a + x, 0) || 1;
    const world = pop * q[b.out] * 0.5 / b.outAmt * 1.6;    // niveles mundiales necesarios (consumo ponderado por capacidad de pago)
    S.forEach((s, i) => { s.cap[b.id] = Math.max(0.2, world * 1.4 * w[i] / tot); s.b[b.id] = 0; });
    // los bienes sin requisito tecnológico existen desde el principio con un nivel de partida
    if (!b.tech) S.forEach((s, i) => { s.b[b.id] = world * w[i] / tot / 1.4 * 0.9; });
  });
};
