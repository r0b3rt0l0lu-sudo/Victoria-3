/* ===== MILITAR 2 · NÚCLEO =====
   Datos nuevos (bienes, edificios, tecnologías), estado ampliado de país y de partida, regiones aéreas, zonas marítimas,
   pestañas nuevas de la ventana militar y utilidades comunes de los módulos aviacion / marina / doctrinas / plantillas /
   produccion / resistencia / mariscales. Todo lo nuevo se guarda dentro de G.mx (partida) y c.m2 (país) con valores por defecto,
   de modo que las partidas antiguas siguen cargando. */
const MX_TABS = [];          // {id, label, html()}: pestañas añadidas a «Ejército y guerra»

/* ---------- bienes nuevos ---------- */
[
  {id: 'engines', name: 'Motores', base: 40, icon: '⚙️', color: '#8a8f99', cat: 'Industriales'},
  {id: 'aircraft', name: 'Aviones', base: 3500, icon: '✈️', color: '#b9c7d6', cat: 'Militares'},
  {id: 'mgs', name: 'Ametralladoras', base: 160, icon: '🔫', color: '#6c6f78', cat: 'Militares'},
  {id: 'ships', name: 'Tonelaje naval', base: 2200, icon: '⚓', color: '#4f7aa0', cat: 'Militares'}
].forEach(g => { if (!GOOD[g.id]) { GOODS.push(g); GOOD[g.id] = g; } });

/* ---------- edificios nuevos ---------- */
[
  {id: 'enginew', name: 'Fábricas de Motores', icon: '⚙️', grp: 'Industria militar', out: 'engines', inputs: {steel: 1500, tools: 600, coal: 400}, workers: {laborers: .7, machinists: .3}, cost: 420, cap: 'ind', tech: 'internal_comb'},
  {id: 'aeroworks', name: 'Fábricas Aeronáuticas', icon: '✈️', grp: 'Industria militar', out: 'aircraft', inputs: {steel: 1200, engines: 900, fabric: 1500}, workers: {laborers: .6, machinists: .4}, cost: 520, cap: 'ind', tech: 'military_aviation'},
  {id: 'mgworks', name: 'Fábricas de Ametralladoras', icon: '🔫', grp: 'Industria militar', out: 'mgs', inputs: {steel: 1400, tools: 500}, workers: {laborers: .75, machinists: .25}, cost: 360, cap: 'ind', tech: 'machine_guns'},
  {id: 'shipyard', name: 'Astilleros', icon: '⚓', grp: 'Industria militar', out: 'ships', inputs: {wood: 3000, iron: 900, cannons: 60, fabric: 600}, workers: {laborers: .75, machinists: .25}, cost: 400, cap: 'coast'}
].forEach(b => {
  if (BLD[b.id]) return;
  BUILDINGS.push(b); BLD[b.id] = b; b.workersPerLevel = WORKERS_PER_LEVEL;
  let iv = 0; for (const g in b.inputs) iv += b.inputs[g] * GOOD[g].base;
  b.outAmt = (iv + VA_PER_WORKER * b.workersPerLevel) / GOOD[b.out].base;
});
const MIL_BUILDINGS = ['armory', 'foundry', 'powder', 'mgworks', 'aeroworks', 'shipyard', 'enginew'];

/* ---------- tecnologías nuevas ---------- */
[
  ['steam_frigate', 'Fragatas de Vapor', 1, 1.0, ['steam_engine'], {army: .01}, 'Buques de guerra con propulsión de vapor y ruedas de palas.', {after: 1848}],
  ['ironclad', 'Acorazados', 2, 1.2, ['steam_frigate', 'blast_furnace'], {army: .01}, 'Buques blindados con casco de hierro.', {after: 1858}],
  ['bolt_action', 'Fusil de Cerrojo', 2, 1.2, ['breech_loaders'], {army: .04}, 'Fusiles de repetición con cargador.', {after: 1868}],
  ['cruisers', 'Cruceros', 3, 1.2, ['ironclad', 'steel_artillery'], {army: .01}, 'Buques rápidos de gran autonomía.', {after: 1893}],
  ['submarines', 'Submarinos', 3, 1.3, ['ironclad', 'electricity', 'internal_comb'], {army: .01}, 'Buques sumergibles con torpedos.', {after: 1898}],
  ['dreadnought', 'Acorazados Dreadnought', 3, 1.4, ['cruisers', 'quick_firing'], {army: .02}, 'Artillería gruesa uniforme y turbinas: HMS Dreadnought (1906).', {after: 1904}],
  ['military_aviation', 'Aviación Militar', 3, 1.3, ['internal_comb'], {army: .01}, 'Los hermanos Wright abren la era de los aeroplanos. Desbloquea las fábricas aeronáuticas.', {after: 1903}],
  ['fighters', 'Cazas', 3, 1.3, ['military_aviation'], {army: .01}, 'Aeroplanos armados para disputar el cielo.', {after: 1910}],
  ['bombers', 'Bombarderos', 3, 1.3, ['military_aviation'], {army: .01}, 'Aeroplanos de carga para el bombardeo.', {after: 1911}],
  ['armor', 'Carros de Combate', 3, 1.5, ['motorization', 'trench_warfare'], {army: .03}, 'Vehículos oruga blindados para romper las trincheras.', {after: 1914}]
].forEach(r => {
  if (TECH[r[0]]) return;
  const t = {id: r[0], name: r[1], cat: 'Militar', era: r[2], cost: Math.round(ERAS[r[2]].base * r[3] / 10) * 10, req: r[4], fx: r[5], desc: r[6], ex: undefined, until: undefined, after: r[7].after};
  TECHS.push(t); TECH[t.id] = t;
});

/* ---------- estado ampliado ---------- */
function mx() {
  if (!G.mx) G.mx = {};
  const m = G.mx;
  if (!m.sq) { m.sq = []; m.nsq = 1; }
  if (!m.fl) { m.fl = []; m.nfl = 1; }
  if (!m.nq) m.nq = [];
  if (!m.mar) { m.mar = []; m.nmar = 1; }
  if (!m.zc) m.zc = {};
  if (!m.nlog) m.nlog = [];
  return m;
}
function mc(c) {
  if (!c.m2) c.m2 = {};
  const m = c.m2;
  if (!m.xp) m.xp = {air: 0, navy: 0};
  if (!m.doc) m.doc = {land: null, air: null, navy: null, tier: {land: 0, air: 0, navy: 0}};
  if (!m.tpl) { m.tpl = []; m.tplN = 1; }
  if (!m.lines) m.lines = {};
  if (!m.q) m.q = {};
  if (!m.aiT) m.aiT = 0;
  return m;
}
const hasTech = (c, id) => c.techs && c.techs.has(id);
const yearNow = () => G.date.y + G.date.m / 12;

/* ---------- regiones aéreas: agrupaciones de estados vecinos ---------- */
function airRegions() {
  if (MAP.air) return MAP.air;
  const S = G.S, cen = S.map(s => stateCenter(s)), n = S.length, K = Math.min(30, Math.max(8, Math.round(n / 9)));
  const seeds = []; const order = S.map((s, i) => i).sort((a, b) => S[b].popBase - S[a].popBase);
  seeds.push(order[0]);
  const md = cen.map(c => Math.hypot(c[0] - cen[order[0]][0], c[1] - cen[order[0]][1]));
  while (seeds.length < K) { let bi = 0, bv = -1; md.forEach((v, i) => { const w = v * (0.6 + Math.min(1, S[i].popBase / 4000)); if (w > bv) { bv = w; bi = i; } }); seeds.push(bi); cen.forEach((c, i) => { const d = Math.hypot(c[0] - cen[bi][0], c[1] - cen[bi][1]); if (d < md[i]) md[i] = d; }); }
  const of = new Int16Array(n);
  S.forEach((s, i) => { let b = 0, bv = 1e9; seeds.forEach((sd, k) => { const d = Math.hypot(cen[i][0] - cen[sd][0], cen[i][1] - cen[sd][1]); if (d < bv) { bv = d; b = k; } }); of[i] = b; });
  const regs = seeds.map((sd, k) => ({id: k, name: 'Región aérea de ' + S[sd].name, states: [], lon: cen[sd][0], lat: cen[sd][1], nb: new Set()}));
  S.forEach((s, i) => regs[of[i]].states.push(i));
  S.forEach((s, i) => s.neigh && s.neigh.forEach(j => { if (of[i] !== of[j]) { regs[of[i]].nb.add(of[j]); regs[of[j]].nb.add(of[i]); } }));
  regs.forEach(r => { r.nb = [...r.nb]; });
  MAP.air = {regs, of};
  return MAP.air;
}
const airRegOf = sid => airRegions().of[sid];
const airReg = id => airRegions().regs[id];

/* ---------- zonas marítimas ---------- */
const SEA_ZONES = [
  {id: 0, name: 'Mar del Norte', lon: 3, lat: 56}, {id: 1, name: 'Mar Báltico', lon: 19, lat: 58}, {id: 2, name: 'Atlántico Nordeste', lon: -8, lat: 46},
  {id: 3, name: 'Atlántico Norte', lon: -35, lat: 48}, {id: 4, name: 'Atlántico Central', lon: -38, lat: 18}, {id: 5, name: 'Atlántico Sur', lon: -18, lat: -25},
  {id: 6, name: 'Caribe y Golfo de México', lon: -78, lat: 20}, {id: 7, name: 'Mediterráneo Occidental', lon: 4, lat: 38}, {id: 8, name: 'Mediterráneo Oriental', lon: 27, lat: 34},
  {id: 9, name: 'Mar Negro', lon: 34, lat: 43}, {id: 10, name: 'Mar Rojo y Golfo Pérsico', lon: 50, lat: 18}, {id: 11, name: 'Índico Occidental', lon: 62, lat: 2},
  {id: 12, name: 'Índico Oriental', lon: 92, lat: 4}, {id: 13, name: 'Mares de China', lon: 116, lat: 20}, {id: 14, name: 'Pacífico Norte', lon: 160, lat: 40},
  {id: 15, name: 'Pacífico Oriental', lon: -120, lat: 20}, {id: 16, name: 'Pacífico Sur', lon: -95, lat: -30}, {id: 17, name: 'Mares de Oceanía', lon: 150, lat: -20},
  {id: 18, name: 'Océano Ártico', lon: 30, lat: 72}, {id: 19, name: 'Golfo de Guinea', lon: 4, lat: -2}
];
function seaZoneOfLL(lon, lat) { let b = 0, bv = 1e9; SEA_ZONES.forEach(z => { const dx = Math.min(Math.abs(lon - z.lon), 360 - Math.abs(lon - z.lon)), d = Math.hypot(dx, (lat - z.lat) * 1.2); if (d < bv) { bv = d; b = z.id; } }); return b; }
const _pz = new Map();
function seaZoneOfProv(pid) { let z = _pz.get(pid); if (z === undefined) { const p = MAP.provs[pid]; z = seaZoneOfLL(p.lon, p.lat); _pz.set(pid, z); } return z; }
function zoneDist(a, b) { const A = SEA_ZONES[a], B = SEA_ZONES[b]; return Math.hypot(Math.min(Math.abs(A.lon - B.lon), 360 - Math.abs(A.lon - B.lon)), A.lat - B.lat); }
function countryZones(c) { const z = new Map(); c.states.forEach(sid => MAP.stats[sid].provs.forEach(p => { if (MAP.provs[p].port) z.set(seaZoneOfProv(p), (z.get(seaZoneOfProv(p)) || 0) + 1); })); return z; }

/* ---------- capacidad de los edificios nuevos (llamado desde computeCaps) ---------- */
function milCaps() {
  const S = G.S;
  const w = {shipyard: [], enginew: [], aeroworks: [], mgworks: []};
  S.forEach(s => { const c = G.C[s.owner], ind = c ? c.ind : 0.05, base = Math.pow(s.popBase, 0.9) * (0.25 + 3 * ind), coast = Math.pow(MAP.stats[s.id].coast, 0.85);
    w.shipyard.push(coast * Math.pow(s.popBase, 0.5) * (0.25 + 3 * ind)); w.enginew.push(base); w.aeroworks.push(base); w.mgworks.push(base); });
  const T = {shipyard: 30, enginew: 40, aeroworks: 40, mgworks: 40};
  for (const k in w) { const tot = w[k].reduce((a, x) => a + x, 0) || 1; S.forEach((s, i) => { s.cap[k] = T[k] * w[k][i] / tot; s.b[k] = k === 'shipyard' ? s.cap[k] * 0.35 : 0; }); }
  // todo estado con puerto tiene un astillero modesto (para que las potencias menores puedan construir)
  S.forEach(s => { if (MAP.stats[s.id].provs.some(p => MAP.provs[p].port)) { s.cap.shipyard = Math.max(s.cap.shipyard || 0, 1); s.b.shipyard = Math.max(s.b.shipyard || 0, 0.3); } });
}

/* ---------- ¿cuántas fábricas militares tiene un país? ---------- */
function milFactories(c) {
  let n = 0; c.states.forEach(sid => { const b = G.S[sid].b; MIL_BUILDINGS.forEach(k => { n += b[k] || 0; }); });
  return Math.floor(n + (c.stats.indLevels || 0) * 0.08) + 2;
}

/* ---------- guardado ---------- */
function mxSave() { return G.mx || null; }
function mxLoad(x) { const fresh = !x; G.mx = x || null; mx(); MAP.air = null; if (typeof tplRegisterAll === 'function') tplRegisterAll(); G.tags.forEach(t => { if (t !== NONE) mc(G.C[t]); }); if (fresh && typeof initNavies === 'function') initNavies(); else if (typeof mxEnsureEq === 'function') mxEnsureEq(); }

/* ---------- ganchos de la simulación ---------- */
function initMil2() { G.mx = null; mx(); MAP.air = null; initNavies(); G.tags.forEach(t => { if (t !== NONE) { mc(G.C[t]); if (G.C[t].ai) aiTemplates(G.C[t]); } }); }
function mil2Day() { if (typeof airDay === 'function') { airDay(); navyDay(); docDay(); marDay(); } }
function mil2Week() { linesWeek(); aviationWeek(); navalWeek(); docWeek(); marWeek(); resistanceWeek(); resistanceAIWeek(); aiTemplatesWeek(); }
function mil2Month(c) { navalMonth(c); }
