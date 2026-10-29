/* ===== SIMULACIÓN ===== */
const G = {};
const NONE = 'NON';
const WF = 0.28;                        // fracción de población en empleos formales
const TAX_LEVELS = [0.04, 0.08, 0.12, 0.17, 0.23];
const TAX_NAMES = ['Muy bajo', 'Bajo', 'Medio', 'Alto', 'Muy alto'];
const COST_PER_POINT = 4000;
const CP_MULT = 3;
const ARABLE_F = [0, 1, 0.5, 0.04, 0.7, 0.08, 0.55, 0.15, 0];
const PASTURE_F = [0, 0.5, 0.15, 0.1, 1, 0.25, 0.1, 0.35, 0];
const FOREST_F = [0, 0.12, 1, 0, 0.05, 0.25, 0.7, 0.2, 0];

const rnd = (a, b) => a + Math.random() * (b - a);
const clamp = (x, a, b) => x < a ? a : x > b ? b : x;
const pick = arr => arr[Math.floor(Math.random() * arr.length)];

function parseRes(str) {
  const o = {};
  (str || '').split(/\s+/).forEach(t => { if (t) o[t[0]] = (o[t[0]] || 0) + (+t.slice(1) || 1); });
  return o;
}

function mkCountry(tag) {
  const d = COUNTRY_DATA[tag];
  const c = {
    tag, id: 0, name: d ? d[0] : 'Tierras sin reclamar', adj: d ? d[1] : 'tribal', color: d ? d[2] : NEUTRAL_COLOR,
    flagSpec: d ? d[3] : 'h2:#8f8a74:#6f6a56', gov: d ? d[4] : 'Sin gobierno', capitalName: d ? d[5] : '',
    lit: d ? d[6] : 3, ind: d ? d[7] : 0.02, profile: d ? d[8] : 'eastern', treasury: d ? d[9] : 0,
    debt: 0, taxLevel: 2, consTax: 0, milFund: 1, eduFund: 1,
    techs: new Set(), research: null, innov: 0, innovStock: 0,
    prestige: 10, influence: 100, relations: {}, mods: {}, ig: {}, legitimacy: 55, radicals: 0.08, loyalists: 0.2,
    lawChange: null, journalDone: {}, wars: [], investPool: 0, queue: [], projects: [], cpUsed: 0, cpTotal: 0,
    stats: {pop: 0, gdp: 0, soldiers: 0, literacy: 0, sol: 0, indLevels: 0, bur: 0, burNeed: 1, income: 0, expense: 0, taxEff: 1, avgWage: 3.5, constr: 0, innovRate: 0, army: 0},
    budget: {income: {}, expense: {}}, hist: {gdp: [], pop: [], treasury: [], sol: [], prestige: []},
    ai: true, traits: [], ach: {}, cnt: {}, claims: [], boosts: [], pboosts: {}, propa: {}, mob: 0, bloc: null, overlord: null, infamy: 0, monarchy: !!(d && /Monarqu|Imperio|Shogun|Despotismo/.test(d[4])), tradeLoss: 0, fx: {}, pressure: 0, lowLeg: 0, govHist: [], fabricating: null, states: [], capital: -1, startPop: 1, rank: 99, power: 0, gdpPrev: 0, lawMods: {}, colonizing: null
  };
  c.laws = Object.assign({}, LAW_PROFILES[c.profile], LAW_OVERRIDES[tag] || {});
  return c;
}

function recalcMods(c) {
  const m = {tax: 0, bur: 0, invest: 0.12, lit: 0, grow: 0, army: 0, rad: 0, out: 0, lab: 0, stab: 0, agriOut: 0, mineOut: 0, indOut: 0, constr: 0, innov: 0, infra: 0, milCost: 0, defense: 0, logistics: 0, crisis: 0, steelOut: 0};
  for (const cat in c.laws) { const o = LAW[c.laws[cat]]; if (o) for (const k in o.mods) m[k] = (m[k] || 0) + o.mods[k]; }
  c.lawMods = Object.assign({}, m);
  c.techs.forEach(id => { const t = TECH[id]; for (const k in t.fx) m[k] = (m[k] || 0) + t.fx[k]; });
  (c.traits || []).forEach(id => { const t = typeof TRAITS !== 'undefined' && TRAITS[id]; if (t) for (const k in t.fx) m[k] = (m[k] || 0) + t.fx[k]; });
  if (c.natMods) for (const k in c.natMods) m[k] = (m[k] || 0) + c.natMods[k];
  c.mods = m;
  return m;
}

function makeState(seed, id) {
  const res = parseRes(seed.res);
  return {id, name: seed.name, owner: seed.owner || NONE, popBase: seed.pop, res, pops: {}, b: {}, cap: {}, ut: {}, incNext: {}, inc: {}, sol: {}, solAvg: 8,
    wage: 3.5, jobs: {}, fill: {}, stg: {}, unemp: 0, employed: 0, gdp: 0, dem: {}, infra: 0, rad: 0, taxPaid: 0, city: false, plan: {}, area: MAP.stats[id].area, neigh: [...MAP.stats[id].neigh], pxCentroid: null};
}

function popTotal(s) { let t = 0; for (const p in s.pops) t += s.pops[p]; return t; }

function ownerCountry(s) { return G.C[s.owner]; }

/* ---------- inicialización ---------- */
function createWorld(playerTag) {
  G.date = {y: START_YEAR, m: 0, d: 1, t: 0};
  G.player = playerTag; G.paused = true; G.speed = 2; G.week = 0; G.notifs = []; G.pendingEvent = null;
  G.log = []; G.wars = []; G.nextWarId = 1; G.eventCool = {};
  G.armies = []; G.battles = []; G.recruits = []; G.nextArmyId = 1; G.nextBattleId = 1; G.hostile = new Set(); G.occList = []; initProvinceState();
  G.milD = Object.assign({}, MIL_NEED); G.dcrises = []; G.nextDC = 1; G.sup = {}; G.fronts = []; G.nextFront = 1; G.battleLog = [];
  G.crises = []; G.diff = G.diff || 2; G.pacts = []; G.blocs = []; G.proposals = []; G.nextId = 1; G.pt = {}; G.fx = {}; G.cycle = 0;
  G.C = {};
  Object.keys(COUNTRY_DATA).forEach(t => G.C[t] = mkCountry(t));
  G.C[NONE] = mkCountry(NONE);
  G.tags = Object.keys(G.C);
  G.tags.forEach((t, i) => G.C[t].id = i + 1);
  G.S = MAP.seeds.map((s, i) => makeState(s, i));
  G.S.forEach(s => { G.C[s.owner].states.push(s.id); });
  G.tags.forEach(t => { const c = G.C[t]; c.ai = t !== playerTag; recalcMods(c); const cap = G.S.find(s => s.name === c.capitalName && s.owner === t); c.capital = cap ? cap.id : (c.states[0] ?? -1); });
  G.ownerOf = new Int16Array(G.S.length);
  refreshOwnerOf();
  G.price = {}; G.avail = {}; G.prod = {}; G.dem = {}; G.hist = {}; G.ratio = {}; G.stock = {};
  GOODS.forEach(g => { G.price[g.id] = g.base; G.hist[g.id] = []; G.ratio[g.id] = 1; G.stock[g.id] = 0; });
}

function initGame(playerTag) {
  createWorld(playerTag);
  computeCaps();
  initPops();
  initRelations();
  warmUp();
  G.tags.forEach(t => { const c = G.C[t]; c.techs = new Set(); c.research = null; c.innovStock = 0; recalcMods(c); c.treasury = t === NONE ? 0 : Math.round(c.stats.income * (6 + (COUNTRY_DATA[t] ? COUNTRY_DATA[t][9] / 300000 : 1) * 1.5)); c.startPop = Math.max(1, c.stats.pop); c.hist = {gdp: [], pop: [], treasury: [], sol: [], prestige: []}; });
  updateRanks();
  G.tags.forEach(t => { const c = G.C[t]; c.prestige = Math.round(10 + (c.power ? Math.sqrt(c.power) * 3 : 0)); c.start = {ind: c.stats.indLevels, lit: c.lit, soldiers: c.stats.soldiers, prestige: c.prestige, rank: c.rank}; });
  assignTraits(); initClaims(); seedDiplomacy(); initArmies(); initEquipment(); G.notifs.length = 0; G.log.length = 0; G.week = 0;
  logMsg('Comienza la partida en enero de ' + START_YEAR + '.');
}

function refreshOwnerOf() { G.S.forEach(s => { G.ownerOf[s.id] = G.C[s.owner].id; }); }

function computeCaps() {
  const S = G.S;
  let pop = 0; S.forEach(s => pop += s.popBase * 1000);
  const D = {}; GOODS.forEach(g => D[g.id] = 0);
  const afford = [1, 1, 1, 0.95, 0.9, 0.85, 0.7, 0.7, 0.7, 0.55, 0.5, 0.45, 0.4, 0.4, 0.4];
  const lv = {};
  for (let it = 0; it < 8; it++) {
    const need = {}; GOODS.forEach(g => need[g.id] = 0);
    LADDER.forEach((l, i) => need[l.g] += pop * l.q * afford[i]);
    for (const g in MIL_NEED) need[g] += MIL_NEED[g];
    BUILDINGS.forEach(b => { if (b.out && lv[b.id]) for (const g in b.inputs) need[g] += lv[b.id] * b.inputs[g]; });
    BUILDINGS.forEach(b => { if (b.out) lv[b.id] = need[b.out] / b.outAmt; });
  }
  G.needLevels = lv;
  // pesos
  const W = {}; BUILDINGS.forEach(b => W[b.id] = new Float32Array(S.length));
  const cosl = s => Math.cos(yToLat(MAP.stats[s.id].sy / Math.max(1, MAP.stats[s.id].area)) * Math.PI / 180);
  let maxPop = 0, sumPop = 0; S.forEach(s => { sumPop += s.popBase; });
  const arAreaTot = S.reduce((a, s) => a + areaWeight(s, ARABLE_F) * cosl(s), 0);
  S.forEach((s, i) => {
    const c = G.C[s.owner]; const ind = c.ind;
    const cl = cosl(s);
    const arable = 0.5 * areaWeight(s, ARABLE_F) * cl / arAreaTot * sumPop + 0.5 * s.popBase;
    const pasture = areaWeight(s, PASTURE_F) * cl;
    const forest = areaWeight(s, FOREST_F) * cl;
    const coast = Math.pow(MAP.stats[s.id].coast, 0.85);
    W.farm[i] = arable * (1 + 0.35 * (s.res.g || 0)) * (s.res.g ? 1 : 1);
    W.ranch[i] = pasture * (1 + 0.5 * (s.res.m || 0)) + 0.1 * s.popBase;
    W.fishing[i] = coast * (1 + 0.6 * (s.res.f || 0));
    W.logging[i] = forest * (1 + 0.5 * (s.res.w || 0));
    W.iron[i] = (s.res.i || 0); W.coal[i] = (s.res.c || 0);
    W.fruit[i] = (s.res.F || 0); W.sugar[i] = (s.res.U || 0); W.tea[i] = (s.res.T || 0); W.coffee[i] = (s.res.C || 0); W.tobacco[i] = (s.res.B || 0); W.fibers[i] = (s.res.u || 0) + 0.02 * pasture / 100;
    const indW = Math.pow(s.popBase, 1.4) * (0.25 + 3 * ind);
    ['textile', 'clothes', 'furniture', 'liquor'].forEach(k => W[k][i] = indW);
    W.tools[i] = indW * (1 + 0.4 * ((s.res.i || 0) + (s.res.c || 0)) / 4);
    W.steel[i] = indW * (1 + 0.5 * ((s.res.i || 0) + (s.res.c || 0)) / 3);
    W.constr[i] = Math.ceil(s.popBase / 500 + 1) * (0.3 + 2 * ind);
    W.railway[i] = Math.ceil(s.popBase / 900 + 1) * (0.4 + 2 * ind);
    const mineral = (s.res.i || 0) + (s.res.c || 0);
    W.saltpeter[i] = mineral * 0.6 + 0.03 * pasture / 100 + 0.01;
    W.stud[i] = pasture * (1 + 0.3 * (s.res.m || 0)) * 0.8 + 0.05 * s.popBase;
    ['powder', 'armory', 'foundry'].forEach(k => W[k][i] = indW * (1 + 0.4 * mineral / 4));
    W.admin[i] = W.barracks[i] = W.university[i] = Math.ceil(s.popBase / 450 + 1);
  });
  const K = {farm: 1.9, ranch: 2.0, fishing: 2.4, logging: 2.0, iron: 1.9, coal: 1.9, fruit: 2.3, sugar: 2.3, tea: 2.3, coffee: 2.3, tobacco: 2.3, fibers: 2.2, textile: 2.6, clothes: 2.6, furniture: 2.6, liquor: 2.6, tools: 2.6, steel: 2.6, saltpeter: 10, stud: 8, powder: 12, armory: 12, foundry: 12};
  BUILDINGS.forEach(b => {
    const w = W[b.id]; let tot = 0; for (let i = 0; i < w.length; i++) tot += w[i];
    S.forEach((s, i) => {
      let cap = 0;
      if (K[b.id]) cap = tot > 0 ? (lv[b.id] || 1) * K[b.id] * w[i] / tot : 0;
      else cap = w[i];
      s.cap[b.id] = cap;
    });
  });
  // coherencia: niveles iniciales
  S.forEach(s => {
    BUILDINGS.forEach(b => {
      const K0 = K[b.id];
      if (K0) s.b[b.id] = s.cap[b.id] / K0;
      else s.b[b.id] = 0;
    });
    if (s.cap.railway) s.b.railway = 0;
    BUILDINGS.forEach(b => { if (b.tech) s.b[b.id] = 0; });
    s.cap.railway = Math.max(s.cap.railway, 1);
    s.cap.steel = s.cap.steel; // se activa con tecnología
  });
}
function areaWeight(s, F) { const st = MAP.stats[s.id]; let a = 0; for (let b = 1; b < 9; b++) a += st.biomes[b] * F[b]; return a; }

function initPops() {
  G.S.forEach(s => {
    const c = G.C[s.owner]; const ind = c.ind;
    const urb = 0.04 + 0.4 * ind;
    const P = s.popBase * 1000;
    const sh = {aristocrats: 0.004, capitalists: 0.001 + 0.006 * ind, clergy: 0.008, officers: 0.001, bureaucrats: 0.002, shopkeepers: 0.006 + 0.05 * urb, clerks: 0.002 + 0.04 * urb,
      machinists: 0.001 + 0.04 * urb * ind, soldiers: 0.004};
    let used = 0; for (const k in sh) used += sh[k];
    const labShare = 0.1 + 0.55 * urb;
    sh.laborers = labShare; used += labShare;
    sh.peasants = 1 - used;
    s.pops = {};
    for (const k in sh) s.pops[k] = Math.max(0, P * sh[k]);
    PROF_ORDER.forEach(p => { s.inc[p] = s.pops[p] * 1.9 * PROFS[p].cons * (PROFS[p].strat === 'lower' ? 0.9 : 1); s.sol[p] = 8; });
  });
  // administración, cuarteles y universidades
  G.S.forEach(s => {
    const c = G.C[s.owner]; if (s.owner === NONE) { s.b.admin = s.b.barracks = s.b.university = 0; s.b.constr = s.cap.constr * 0.2; return; }
    const P = popTotal(s);
    s.b.admin = P * 1.9e-6 * clamp(0.55 + 0.9 * c.ind, 0.55, 1.2);
    s.b.barracks = P * (0.0035 + 0.002 * c.ind) / (2000 * 0.9);
    s.b.university = P * (0.0003 + 0.0007 * c.ind + c.lit / 100 * 0.0003) / 2000;
    s.b.constr = Math.min(s.cap.constr, 0.12 * s.cap.constr / 0.3 + P / 5000 / 20 * 0.3);
  });
}

function initRelations() {
  G.tags.forEach(a => { G.C[a].relations = {}; });
  G.tags.forEach(a => G.tags.forEach(b => { if (a !== b && a !== NONE && b !== NONE) G.C[a].relations[b] = Math.round(rnd(-10, 25)); }));
}

/* ---------- guardado y carga ---------- */
const SAVE_KEY = 'victoria-replica-save-v1';
function saveData() {
  const SK = ['owner', 'pops', 'b', 'cap', 'ut', 'inc', 'sol', 'solAvg', 'extra', 'gdp', 'unemp', 'unempU', 'bva', 'bwage', 'employed', 'taxPaid', 'infra', 'res', 'popBase'];
  const S = G.S.map(s => { const o = {}; SK.forEach(k => o[k] = s[k]); return o; });
  const C = {};
  G.tags.forEach(t => { const c = G.C[t]; C[t] = JSON.parse(JSON.stringify(c, (k, v) => v instanceof Set ? {__set: [...v]} : v)); });
  return JSON.stringify({v: 1, date: G.date, player: G.player, week: G.week, S, C, price: G.price, avail: G.avail, prod: G.prod, dem: G.dem, ratio: G.ratio, stock: G.stock, hist: G.hist, wars: G.wars, nextWarId: G.nextWarId, log: G.log.slice(0, 80), eventCool: G.eventCool, v2: 2, P: provSave(), ext: saveExtra(), armies: G.armies, battles: G.battles, recruits: G.recruits, nextArmyId: G.nextArmyId, nextBattleId: G.nextBattleId, pacts: G.pacts, blocs: G.blocs, proposals: G.proposals, crises: G.crises, diff: G.diff, nextId: G.nextId, pt: G.pt, afterPanic: G.afterPanic, potato: G.potato});
}
function loadData(text) {
  const d = JSON.parse(text, (k, v) => v && v.__set ? new Set(v.__set) : v);
  createWorld(d.player);
  d.S.forEach((o, i) => Object.assign(G.S[i], o));
  G.tags.forEach(t => { if (d.C[t]) Object.assign(G.C[t], d.C[t]); });
  G.armies = d.armies || []; G.battles = d.battles || []; G.recruits = d.recruits || []; G.nextArmyId = d.nextArmyId || 1000; G.nextBattleId = d.nextBattleId || 1000; G.hostile = new Set(); if (d.v2 === 2) provLoad(d.P); loadExtra(d.ext);
  G.pacts = d.pacts || []; G.blocs = d.blocs || []; G.proposals = d.proposals || []; G.crises = d.crises || []; G.diff = d.diff || 2; G.nextId = d.nextId || 1000; G.pt = d.pt || {}; G.afterPanic = d.afterPanic; G.potato = d.potato;
  G.date = d.date; G.week = d.week; G.wars = d.wars; G.nextWarId = d.nextWarId; G.log = d.log; G.eventCool = d.eventCool || {};
  Object.assign(G.price, d.price); Object.assign(G.avail, d.avail); Object.assign(G.prod, d.prod); Object.assign(G.dem, d.dem); Object.assign(G.ratio, d.ratio); Object.assign(G.stock, d.stock);
  GOODS.forEach(g => { G.hist[g.id] = d.hist[g.id] || []; });
  G.player = d.player;
  G.tags.forEach(t => { G.C[t].ai = t !== d.player; G.C[t].states = []; });
  G.S.forEach(s => G.C[s.owner].states.push(s.id));
  refreshOwnerOf();
  if (d.v2 !== 2) initArmies();
  if (!G.milD || !G.C[G.player].eq) initEquipment();
  G.paused = true;
  return d;
}

/* ---------- ticks ---------- */
function advanceDay() {
  const d = G.date;
  d.t++; d.d++;
  const dim = DAYS_IN_MONTH[d.m] + (d.m === 1 && isLeap(d.y) ? 1 : 0);
  let monthly = false;
  if (d.d > dim) { d.d = 1; d.m++; monthly = true; if (d.m > 11) { d.m = 0; d.y++; } }
  econDay();
  militaryDay(); natDay();
  if (d.t % 2 === 0) aiMilitary();
  if (monthly) monthlyTick();
  dailyEvents();
}
const isLeap = y => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

function warmUp() {
  for (let w = 0; w < 300; w++) {
    weeklyTick(true); GOODS.forEach(g => { const hh = G.hist[g.id]; if (w % 2 === 0) { hh.push(G.price[g.id]); if (hh.length > 220) hh.shift(); } });
    if (w % 4 === 3) { realloc(true); }
  }
  // redondear niveles
  const sr = x => { const f = Math.floor(x); return f + (Math.random() < x - f ? 1 : 0); };
  G.S.forEach(s => { BUILDINGS.forEach(b => { s.b[b.id] = sr(s.b[b.id] || 0); }); });
  for (let w = 0; w < 30; w++) { weeklyTick(false); if (w % 4 === 3) realloc(true); }
  monthlyTick(true);
}

function stateStaffing(s, c) {
  const jobs = {}, mixJobs = {};
  for (const p in PROFS) jobs[p] = 0;
  BUILDINGS.forEach(b => {
    const L = s.b[b.id]; if (!L) return;
    const w = L * b.workersPerLevel * (b.out ? (s.ut[b.id] ?? 1) : 1);
    for (const p in b.workers) jobs[p] += w * b.workers[p];
  });
  s.jobs = jobs;
  const fill = {};
  for (const p in jobs) {
    const avail = (s.pops[p] || 0) * WF;
    fill[p] = jobs[p] > 0 ? Math.min(1, avail / jobs[p]) : 1;
  }
  s.fill = fill;
  BUILDINGS.forEach(b => {
    let st = 0; for (const p in b.workers) st += b.workers[p] * fill[p];
    s.stg[b.id] = st;
  });
}

/* ---------- economía por fases (se reparte a lo largo de la semana) ---------- */
let ECX = null;
const DIFF = {
  1: {name: 'Relajada', crisis: 0.5, cost: 0.8, tax: 1.06, rate: 0.7, vol: 0.85},
  2: {name: 'Normal', crisis: 1, cost: 1.25, tax: 1, rate: 1, vol: 1},
  3: {name: 'Difícil', crisis: 1.7, cost: 1.7, tax: 0.93, rate: 1.5, vol: 1.15},
  4: {name: 'Brutal', crisis: 2.6, cost: 2.3, tax: 0.85, rate: 2.2, vol: 1.3}
};
const FX_KEYS = ['demand', 'agri', 'ind', 'mine', 'invest', 'credit'];
function diffP() { return DIFF[G.diff || 2]; }

function recalcFx() {
  const fx = {}; FX_KEYS.forEach(k => fx[k] = 1);
  const ph = G.week / 52 / 9 * Math.PI * 2 + 1;
  G.cycle = Math.sin(ph);
  fx.demand *= 1 + 0.05 * G.cycle;
  const cf = {};
  G.tags.forEach(t => { cf[t] = {}; FX_KEYS.forEach(k => cf[t][k] = 1); });
  (G.crises || []).forEach(cr => {
    if (cr.scope === 'global') G.tags.forEach(t => { const sev = t === NONE ? 1 : crisisSeverity(G.C[t]); for (const k in cr.fx) cf[t][k] *= 1 + (cr.fx[k] - 1) * sev; });
    else { const tgt = cf[cr.scope]; if (tgt) for (const k in cr.fx) tgt[k] *= (cr.fx[k] < 1 && cr.type !== 'aid') ? 1 + (cr.fx[k] - 1) * crisisSeverity(G.C[cr.scope]) : cr.fx[k]; }
  });
  G.fx = fx;
  G.tags.forEach(t => { G.C[t].fx = cf[t]; });
}

function econBegin(warm) {
  G.week++;
  recalcFx();
  const D = {}, P = {}; GOODS.forEach(g => { D[g.id] = (G.milD && G.milD[g.id]) || 0; P[g.id] = 0; });
  const cstat = {};
  G.tags.forEach(t => cstat[t] = {gdp: 0, tax: 0, ctax: 0, wages: 0, govPay: 0, ownerInc: 0, pop: 0, soldiers: 0, popSol: 0, employed: 0, workers: 0, indLevels: 0, bur: 0, constr: 0, inn: 0, spent: 0, invest: 0});
  ECX = {D, P, R: null, cstat, utTarget: {}, warm};
}

// Fase A: personal, demanda de insumos y planes de consumo
function econA(i0, i1) {
  const S = G.S, price = G.price, D = ECX.D, C = G.C;
  for (let si = i0; si < i1; si++) {
    const s = S[si];
    const c = C[s.owner];
    stateStaffing(s, c);
    const dm = G.fx.demand * c.fx.demand;
    const taxR = TAX_LEVELS[c.taxLevel] * (s.owner === NONE ? 0 : c.stats.taxEff);
    const ctax = 1 + (s.owner === NONE ? 0 : c.consTax * 0.04 * c.stats.taxEff);
    BUILDINGS.forEach(b => {
      const L = s.b[b.id]; if (!L || !b.out) return;
      const stg = s.stg[b.id] * (s.ut[b.id] ?? 1);
      for (const g in b.inputs) D[g] += L * b.inputs[g] * stg;
    });
    const plan = {};
    for (const p in s.pops) {
      const N = s.pops[p]; if (N <= 0) continue;
      let budget = (s.inc[p] || 0) * (1 - taxR) * dm;
      const svc = Math.min(budget * 0.12, budget);
      budget -= svc;
      const items = [];
      const mult = PROFS[p].cons;
      for (let i = 0; i < LADDER.length; i++) {
        const l = LADDER[i];
        const want = N * l.q * mult;
        const cost = want * price[l.g] * ctax;
        let frac = 1;
        if (budget >= cost) budget -= cost; else { frac = cost > 0 ? budget / cost : 0; budget = 0; }
        items.push({g: l.g, want, buy: want * frac});
        D[l.g] += want * frac;
        if (frac < 1) { for (let j = i + 1; j < LADDER.length; j++) items.push({g: LADDER[j].g, want: N * LADDER[j].q * mult, buy: 0}); break; }
      }
      plan[p] = {items, left: budget, svc, b0: budget};
    }
    s.plan = plan; s.ctax = ctax; s.taxR = taxR;
  }
}

// Fase intermedia: racionamiento por escasez
function econMid() {
  const D = ECX.D, price = G.price;
  const R = {};
  GOODS.forEach(g => {
    const A = G.avail[g.id] === undefined ? D[g.id] : G.avail[g.id];
    R[g.id] = D[g.id] > 0 ? Math.min(1, A / D[g.id]) : 1;
    if (!isFinite(R[g.id])) R[g.id] = 1;
  });
  G.ratio = R; G.dem = D; ECX.R = R;
  BUILDINGS.forEach(b => { if (!b.out) return; let iv = 0; for (const g in b.inputs) iv += b.inputs[g] * price[g]; const va = b.outAmt * price[b.out] - iv; const r = va / (VA_PER_WORKER * b.workersPerLevel); ECX.utTarget[b.id] = r <= 0.05 ? 0.45 : clamp(Math.pow(r, 0.7), 0.45, 1.35); });
}

// Fase B: producción, salarios, beneficios y consumo efectivo
function econB(i0, i1) {
  const S = G.S, price = G.price, C = G.C, R = ECX.R, P = ECX.P, cstat = ECX.cstat, utTarget = ECX.utTarget, D = ECX.D;
  for (let si = i0; si < i1; si++) {
    const s = S[si];
    const c = C[s.owner], cs = cstat[s.owner], m = c.mods;
    const incNext = {}; PROF_ORDER.forEach(p => incNext[p] = (s.extra && s.extra[p]) || 0); s.extra = {};
    let gdp = 0, empTot = 0;
    const radPen = 1 - 0.12 * c.radicals;
    const infraM = 1 + Math.min(0.3, (s.b.railway || 0) * 0.05) + m.infra;
    const labShare = clamp(0.65 + (m.lab || 0), 0.4, 0.85);
    const mk = mobK(c), fxA = mk * G.fx.agri * c.fx.agri * (s.occ ? 1 - 0.6 * s.occ : 1), fxM = mk * G.fx.mine * c.fx.mine * (s.occ ? 1 - 0.6 * s.occ : 1), fxI = mk * G.fx.ind * c.fx.ind * (s.occ ? 1 - 0.6 * s.occ : 1);
    BUILDINGS.forEach(b => {
      const L = s.b[b.id]; if (!L) return;
      const utb = b.out ? (s.ut[b.id] ?? 1) : 1;
      const stg = s.stg[b.id];
      const jobsW = L * b.workersPerLevel * utb;
      if (b.gov || !b.out) {
        const emp = jobsW * stg;
        if (b.gov) {
          const w = Math.max(2.4, c.stats.avgWage) * 1.05;
          const pay = emp * w * (b.id === 'barracks' ? c.milFund * (1 + (c.mods.milCost || 0)) : b.id === 'university' ? c.eduFund : 1);
          for (const p in b.workers) incNext[p] += pay * b.workers[p];
          cs.govPay += pay;
          if (b.id === 'admin') cs.bur += L * b.bur * stg;
          if (b.id === 'barracks') cs.soldiers += jobsW * b.workers.soldiers * stg;
          if (b.id === 'university') cs.inn += L * b.inn * stg;
        } else {
          const w = Math.max(2.4, c.stats.avgWage) * 0.9;
          const pay = jobsW * stg * w;
          for (const p in b.workers) incNext[p] += pay * b.workers[p];
          cs.spent += pay;
          if (b.id === 'constr') cs.constr += L * b.ctr * stg;
          if (b.id === 'railway') s.infra = L;
        }
        empTot += jobsW * stg;
        return;
      }
      let rmin = 1;
      for (const g in b.inputs) rmin = Math.min(rmin, R[g]);
      const grp = b.grp;
      const techM = (grp === 'Agricultura' || grp === 'Plantaciones') ? (1 + m.agriOut) * fxA : (grp === 'Extracción' ? (1 + m.mineOut) * fxM : (1 + m.indOut + (b.id === 'steel' ? (m.steelOut || 0) : 0)) * fxI);
      const eff = stg * rmin * utb;
      const outQ = L * b.outAmt * eff * techM * infraM * (1 + (m.out || 0)) * radPen;
      let inCost = 0;
      for (const g in b.inputs) inCost += L * b.inputs[g] * eff * price[g];
      P[b.out] += outQ;
      s.ut[b.id] = utb + (utTarget[b.id] - utb) * 0.07;
      const rev = outQ * price[b.out];
      const va = rev - inCost;
      const emp = jobsW * stg;
      const wagePool = Math.max(0, va) * labShare;
      const owners = Math.max(0, va) * (1 - labShare);
      const wage = emp > 0 ? wagePool / emp : 0;
      for (const p in b.workers) incNext[p] += wage * emp * b.workers[p];
      empTot += emp;
      const agri = grp === 'Agricultura' || grp === 'Plantaciones' || b.id === 'logging';
      incNext.aristocrats += owners * (agri ? 0.75 : 0.2);
      incNext.capitalists += owners * (agri ? 0.25 : 0.8);
      cs.ownerInc += owners;
      gdp += va;
      s.bva = s.bva || {}; s.bva[b.id] = va / L;
      s.bwage = s.bwage || {}; s.bwage[b.id] = wage;
      cs.wages += wagePool;
    });
    let svcTotal = 0;
    for (const p in s.plan) {
      const pl = s.plan[p];
      let spent = 0, sol = 0;
      pl.items.forEach((it, i) => {
        const got = it.buy * R[it.g];
        spent += got * price[it.g] * s.ctax;
        const frac = it.want > 0 ? got / it.want : 1;
        sol += LADDER[i].w * Math.min(1, frac);
        cs.ctax += got * price[it.g] * (s.ctax - 1);
      });
      s.sol[p] = 25 * sol / LADDER_W;
      const leftover = Math.max(0, pl.b0 - spent);
      const sv = (p === 'aristocrats' || p === 'capitalists') ? 0.25 : 0;
      cs.invest += leftover * sv;
      svcTotal += pl.svc + leftover * (1 - sv);
    }
    incNext.shopkeepers += svcTotal * 0.45; incNext.clerks += svcTotal * 0.25; incNext.clergy += svcTotal * 0.10; incNext.laborers += svcTotal * 0.20;
    gdp += svcTotal;
    let unemp = 0, unU = 0;
    for (const p of ['peasants', 'laborers', 'machinists']) {
      const avail = (s.pops[p] || 0) * WF;
      const used = Math.min(avail, s.jobs[p] || 0);
      const un = avail - used;
      unemp += un; if (p !== 'peasants') unU += un;
      incNext[p] += un * (p === 'peasants' ? 1.2 : 0.7);
    }
    s.unemp = unemp; s.unempU = unU; s.employed = empTot;
    s.gdp = gdp; cs.gdp += gdp;
    for (const p in incNext) { s.inc[p] = s.inc[p] * 0.55 + incNext[p] * 0.45; if (!isFinite(s.inc[p])) s.inc[p] = 0; }
    let tot = 0, solsum = 0;
    for (const p in s.pops) { tot += s.pops[p]; solsum += s.pops[p] * s.sol[p]; }
    s.solAvg = tot ? solsum / tot : 0;
    let taxIn = 0; for (const p in incNext) taxIn += incNext[p];
    const occK = s.occ ? 1 - s.occ : 1;
    cs.tax += taxIn * s.taxR * occK;
    cs.pop += tot; cs.popSol += solsum;
    s.taxPaid = taxIn * s.taxR;
    cs.indLevels += (s.b.textile || 0) + (s.b.clothes || 0) + (s.b.furniture || 0) + (s.b.tools || 0) + (s.b.liquor || 0) + (s.b.steel || 0);
  }
}

// Fase C: precios, inventarios y presupuesto de los países
function econEnd() {
  const S = G.S, price = G.price, C = G.C, D = ECX.D, P = ECX.P, cstat = ECX.cstat, warm = ECX.warm;
  const vol = warm ? 1 : diffP().vol;
  if (!G.pt) G.pt = {};
  GOODS.forEach(g => {
    const A = G.avail[g.id] === undefined ? D[g.id] : G.avail[g.id];
    const ratio = D[g.id] / Math.max(A, 1e-6);
    let pr = (G.pt[g.id] ?? price[g.id]) * (1 + 0.06 * vol * clamp(ratio - 1, -0.45, 0.9));
    pr += (g.base - pr) * 0.012;
    const tgt = clamp(pr, g.base * 0.35, g.base * 3.2);
    G.pt[g.id] = tgt;
    if (warm) price[g.id] = tgt;
    const surplus = Math.max(0, A - D[g.id]);
    G.stock[g.id] = surplus * 0.2;
    G.avail[g.id] = P[g.id] + G.stock[g.id];
    G.prod[g.id] = P[g.id];
  });
  if (warm) {
    let mp = 0; GOODS.forEach(g => mp += Math.min(1.5, price[g.id] / g.base)); mp /= GOODS.length;
    if (mp > 0.95) S.forEach(s => { const Pp = popTotal(s); const u = s.unemp / Math.max(1, Pp * WF); if (u > 0.06) { const k = 1 + 0.008 * Math.min(1, u * 1.5); BUILDINGS.forEach(b => { if (b.out && s.b[b.id] > 0 && !b.tech) s.b[b.id] = Math.min(s.cap[b.id], s.b[b.id] * k); }); } });
    BUILDINGS.forEach(b => { if (!b.out) return; const f = clamp(Math.pow(D[b.out] / Math.max(P[b.out], 1), 0.35), 0.94, 1.05); S.forEach(s => { if (s.b[b.id] > 0) s.b[b.id] = Math.min(s.cap[b.id], s.b[b.id] * f); }); });
  }
  const dp = diffP();
  G.tags.forEach(t => {
    const c = C[t], cs = cstat[t];
    const st = c.stats;
    st.pop = cs.pop; st.gdp = cs.gdp; st.soldiers = cs.soldiers; st.indLevels = cs.indLevels;
    st.sol = cs.pop ? cs.popSol / cs.pop : 0;
    st.constr = (t === NONE ? 0 : 12 + cs.constr) * (1 + c.mods.constr);
    st.bur = cs.bur * (1 + c.mods.bur) + 100;
    st.burNeed = Math.max(1, cs.pop / 1000 * 0.25);
    const eff = clamp(st.bur / st.burNeed, 0.2, 1);
    const dtx = c.ai || warm ? 1 : dp.tax;
    st.taxEff = t === NONE ? 0 : clamp((0.4 + 0.6 * eff) * (1 + c.mods.tax) * dtx * (1 - (c.tradeLoss || 0)), 0.2, 1);
    st.avgWage = cs.wages > 0 && cs.pop > 0 ? clamp(cs.wages / (cs.pop * WF), 2.4, 12) : 3.5;
    st.innovRate = (1.5 + (c.lit / 100) * 20 * (1 + 0.25 * Math.log(1 + cs.pop / 1e6)) + 3 * Math.sqrt(Math.min(cs.inn * c.eduFund, 30))) * (1 + c.mods.innov) * (c.fx.invest < 0.6 ? 0.9 : 1);
    const income = (cs.tax + cs.ctax) * (1 + diploIncomeBonus(c));
    const expense = cs.govPay;
    st.income = income; st.expense = expense;
    c.budget = {income: {tax: cs.tax, ctax: cs.ctax}, expense: {gov: cs.govPay}};
    if (t === NONE) return;
    let spentCon = govConstruct(c, st.constr, warm);
    c.budget.expense.constr = spentCon;
    const subs = warm ? 0 : pactMoneyFlows(c);
    c.budget.expense.subs = subs;
    const upkeep = warm ? 0 : armyUpkeep(c);
    c.budget.expense.army = upkeep;
    const eqs = warm ? 0 : (c.eqSpent || 0); c.budget.expense.equip = eqs;
    const free = income - expense - spentCon - subs - upkeep - eqs;
    const pub = warm ? Math.max(0, free) : (free > 0 && c.treasury > -c.stats.income * 8 ? free * 0.85 : 0);
    c.budget.expense.pub = pub;
    spreadPublic(c, pub);
    c.treasury += free - pub;
    if (c.treasury < 0) { c.debt = -c.treasury; } else c.debt = 0;
    const rate = 0.0006 * dp.rate * c.fx.credit * G.fx.credit * (1 + (c.debt / Math.max(1, income)) / 40);
    const interest = c.debt * rate;
    if (interest && !warm) { c.treasury -= interest; c.budget.expense.interest = interest; }
    c.investPool += cs.invest * 0.9 * G.fx.invest * c.fx.invest;
    privateInvest(c, warm);
    c.innovStock = (c.innovStock || 0) + st.innovRate;
    c.influence = Math.min(500, c.influence + 0.4 + c.prestige / 400);
    researchStep(c, warm);
  });
  ECX = null;
}

function weeklyTick(warm) {
  econBegin(warm);
  const N = G.S.length;
  econA(0, N); econMid(); econB(0, N); econEnd();
  if (!warm) for (const g in G.pt) G.price[g] = G.pt[g];
}

// Planificación diaria: la semana se reparte en etapas y los precios se suavizan día a día
function econDay() {
  const dow = G.date.t % 7, N = G.S.length, h = N >> 1;
  switch (dow) {
    case 0: econBegin(false); econA(0, h); break;
    case 1: if (ECX) econA(h, N); break;
    case 2: if (ECX) econMid(); break;
    case 3: if (ECX) econB(0, h); break;
    case 4: if (ECX) econB(h, N); break;
    case 5: if (ECX) { econEnd(); G.weekDone = true; } break;
    case 6: warWeek(); break;
  }
  if (G.pt) for (const g in G.pt) G.price[g] += (G.pt[g] - G.price[g]) * 0.3;
  if (dow % 3 === 0) GOODS.forEach(g => { const hh = G.hist[g.id]; hh.push(G.price[g.id]); if (hh.length > 220) hh.shift(); });
}

function spreadPublic(c, amt) {
  if (amt <= 0 || !c.states.length) return;
  let tot = 0; c.states.forEach(i => tot += popTotal(G.S[i]));
  if (tot <= 0) return;
  c.states.forEach(i => { const s = G.S[i]; for (const p in s.pops) { if (p === 'aristocrats' || p === 'capitalists') continue; addExtra(s, p, amt * s.pops[p] / tot); } });
}
/* ---------- construcción ---------- */
function projectCost(b) { return b.cost * CP_MULT; }
function moneyPerPoint(c) { return COST_PER_POINT * diffP().cost * clamp(Math.sqrt(Math.max(1, c.stats.pop) / 12e6), 0.12, 2.5); }
function addExtra(s, p, v) { s.extra = s.extra || {}; s.extra[p] = (s.extra[p] || 0) + v; }
function canBuild(s, b, c) {
  if (b.tech && !c.techs.has(b.tech)) return false;
  return true;
}
function govConstruct(c, points, warm) {
  if (!c.queue.length || warm) return 0;
  let remaining = points, spentMoney = 0;
  for (let i = 0; i < c.queue.length && remaining > 0; i++) {
    const q = c.queue[i];
    const take = Math.min(remaining, q.cost - q.done);
    q.done += take; remaining -= take; spentMoney += take * moneyPerPoint(c);
    const s = G.S[q.state];
    const w = take * moneyPerPoint(c);
    addExtra(s, 'laborers', w * 0.65); addExtra(s, 'machinists', w * 0.1); addExtra(s, 'capitalists', w * 0.25);
  }
  for (let i = c.queue.length - 1; i >= 0; i--) {
    const q = c.queue[i];
    if (q.done >= q.cost - 1e-6) {
      const s = G.S[q.state];
      s.b[q.bld] = (s.b[q.bld] || 0) + 1;
      c.queue.splice(i, 1);
      if (c.tag === G.player) notify('build', `Se completó: ${BLD[q.bld].name} en ${s.name}.`, q.state);
    }
  }
  c.cpUsed = points - remaining;
  return spentMoney;
}

function buildRoom(s, bid) { return (s.cap[bid] || 0) - (s.b[bid] || 0) - (G.C[s.owner].queue.filter(q => q.state === s.id && q.bld === bid).length) - (G.C[s.owner].projects.filter(q => q.state === s.id && q.bld === bid).length); }

function queueBuild(c, stateId, bid) {
  const s = G.S[stateId], b = BLD[bid];
  if (!canBuild(s, b, c)) return false;
  if (s.owner !== c.tag) return false;
  if (buildRoom(s, bid) < 1) return false;
  c.queue.push({state: stateId, bld: bid, cost: projectCost(b), done: 0});
  return true;
}

function privateInvest(c, warm) {
  if (warm) { c.investPool = 0; return; }
  const share = clamp(c.mods.invest, 0, 0.6);
  c.projects.forEach(p => { p.wk--; });
  for (let i = c.projects.length - 1; i >= 0; i--) {
    const p = c.projects[i];
    if (p.wk <= 0) { const s = G.S[p.state]; s.b[p.bld] = (s.b[p.bld] || 0) + 1; c.projects.splice(i, 1); }
  }
  c.investPool = Math.min(c.investPool, 5e6);
  let guard = 0;
  while (c.investPool > 0 && guard++ < 4) {
    const cand = pickInvestment(c);
    if (!cand) { c.investPool *= 0.99; break; }
    const cost = projectCost(BLD[cand.bld]) * moneyPerPoint(c);
    if (c.investPool < cost * 1.1) break;
    c.investPool -= cost;
    c.projects.push({state: cand.state, bld: cand.bld, wk: 10 + Math.floor(rnd(0, 6))});
    const s = G.S[cand.state]; addExtra(s, 'laborers', cost * 0.7); addExtra(s, 'capitalists', cost * 0.3);
  }
}

function pickInvestment(c) {
  // el mejor VA por nivel entre edificios con hueco en algún estado del país
  let best = null, bestV = 0;
  const tries = [];
  for (let k = 0; k < 14; k++) {
    if (!c.states.length) return null;
    const s = G.S[pick(c.states)];
    const cands = BUILDINGS.filter(b => b.out && canBuild(s, b, c) && buildRoom(s, b.id) >= 1);
    if (!cands.length) continue;
    cands.forEach(b => {
      let iv = 0; for (const g in b.inputs) iv += b.inputs[g] * G.price[g];
      const va = b.outAmt * G.price[b.out] - iv;
      const un = clamp(s.unemp / Math.max(1, popTotal(s) * WF), 0, 1);
      const v = va * (0.8 + Math.random() * 0.4) * (0.55 + un) * (s.stg[b.id] > 0.6 || (b.grp === 'Agricultura') ? 1 : 0.7);
      if (v > bestV) { bestV = v; best = {state: s.id, bld: b.id}; }
    });
  }
  return bestV > VA_PER_WORKER * WORKERS_PER_LEVEL * 1.05 ? best : null;
}

/* ---------- investigación ---------- */
function techCost(c, t) { return Math.round(t.cost * (1 + 0.015 * c.techs.size) / 10) * 10; }
function eraCount(c, era) { let n = 0; c.techs.forEach(id => { if (TECH[id].era === era) n++; }); return n; }
function eraUnlocked(c, era) {
  const e = ERAS[era]; if (era === 1) return true;
  return G.date.y >= e.needYear && eraCount(c, era - 1) >= e.needPrev;
}
// estado de una tecnología para un país
function techStatus(c, t) {
  if (c.techs.has(t.id)) return {k: 'done'};
  if (t.until && G.date.y > t.until) return {k: 'obsolete', why: `Obsoleta desde ${t.until}`};
  if (t.after && G.date.y < t.after) return {k: 'year', why: `Disponible desde ${t.after}`};
  if (t.ex) { const other = TECHS.find(o => o.ex === t.ex && o.id !== t.id && c.techs.has(o.id)); if (other) return {k: 'excl', why: `Excluida por ${other.name}`}; }
  if (!eraUnlocked(c, t.era)) { const e = ERAS[t.era]; return {k: 'era', why: `Era ${t.era}: año ${e.needYear} y ${e.needPrev} tecnologías de la era anterior (${eraCount(c, t.era - 1)}/${e.needPrev})`}; }
  const miss = (t.req || []).filter(r => !c.techs.has(r));
  if (miss.length) return {k: 'req', why: 'Requiere: ' + miss.map(r => TECH[r].name).join(', ')};
  return {k: 'avail'};
}
function techAvailable(c, t) { return techStatus(c, t).k === 'avail'; }
function researchStep(c, warm) {
  if (warm) return;
  if (!c.research) {
    if (c.ai) {
      const av = TECHS.filter(t => techAvailable(c, t));
      if (av.length) {
        // la IA prefiere lo barato y lo de su especialidad; ocasionalmente elige al azar
        av.sort((a, b) => a.cost * (0.8 + Math.random() * 0.5) - b.cost * (0.8 + Math.random() * 0.5));
        c.research = av[0].id;
      }
    }
    return;
  }
  const t = TECH[c.research];
  if (techStatus(c, t).k !== 'avail') { c.research = null; return; }
  const cost = techCost(c, t);
  if (c.innovStock >= cost) {
    c.innovStock -= cost; c.techs.add(t.id); c.research = null; recalcMods(c);
    if (c.tag === G.player) notify('tech', `Has descubierto: ${t.name}.`);
  }
}
function setResearch(c, id) { if (techAvailable(c, TECH[id])) { c.research = id; return true; } return false; }

/* ---------- mensual ---------- */
function updateRanks() {
  const list = G.tags.filter(t => t !== NONE).map(t => {
    const c = G.C[t]; const st = c.stats;
    c.power = Math.pow(st.gdp / 1e5, 0.8) * 0.5 + st.soldiers / 5000 * (1 + c.mods.army) * 0.6 + st.indLevels * 0.5 + c.lit * 0.15;
    return c;
  }).sort((a, b) => b.power - a.power);
  list.forEach((c, i) => c.rank = i + 1);
  G.rankList = list.map(c => c.tag);
}

function monthlyTick(init) {
  realloc(false);
  updateRanks();
  G.tags.forEach(t => {
    const c = G.C[t];
    if (t === NONE) return;
    recalcMods(c);
    politics(c);
    if (!init) { decayBoosts(c); checkRevolution(c); } else c.gov = govName(c);
    // alfabetización
    const edu = c.mods.lit + (c.techs.has('public_schools') ? 0 : 0);
    c.lit = clamp(c.lit + (0.01 + Math.max(0, edu)) * (0.2 + c.eduFund * 0.8) / 4 * 1 + c.stats.sol * 0.0008 - 0.005, 0, 99);
    if (!init) {
      c.hist.gdp.push(Math.round(c.stats.gdp)); c.hist.pop.push(Math.round(c.stats.pop)); c.hist.treasury.push(Math.round(c.treasury)); c.hist.sol.push(+c.stats.sol.toFixed(2)); c.hist.prestige.push(Math.round(c.prestige));
      ['gdp', 'pop', 'treasury', 'sol', 'prestige'].forEach(k => { if (c.hist[k].length > 240) c.hist[k].shift(); });
    }
    c.prestige = Math.max(0, c.prestige + (c.rank <= 8 ? 0.5 : c.rank <= 20 ? 0.2 : 0.05) - 0.1);
    // IA
    if (c.ai) aiMonth(c);
    if (!init) { journal(c); traitMonth(c); if (!c.ai) achMonth(c); }
  });
  if (!init) { randomEvents(); stepColonizeAll(); diploMonth(); crisisMonth(); dcrisisMonth(); }
  // crecimiento de población (mensual)
  G.S.forEach(s => {
    const c = G.C[s.owner];
    const gr = grainFulfil(s);
    let ga = 0.0095 + 0.00065 * (s.solAvg - 8) + (c.mods.grow || 0);
    if (gr < 0.7) ga -= (0.7 - gr) * 0.1;
    ga = clamp(ga, -0.03, 0.02);
    const g = ga / 12;
    for (const p in s.pops) s.pops[p] *= (1 + g);
  });
  if (!init && G.date.m === 0) yearly();
}
function grainFulfil(s) { const p = s.plan && s.plan.peasants; if (!p) return 1; const it = p.items[0]; return it && it.want > 0 ? Math.min(1, it.buy * G.ratio.grain / it.want) : 1; }

function realloc(fast) {
  G.S.forEach(s => {
    const c = G.C[s.owner];
    const P = popTotal(s);
    const fixed = ['aristocrats', 'capitalists', 'clergy', 'shopkeepers'];
    const shr = {aristocrats: 0.004, capitalists: 0.001 + 0.006 * c.ind, clergy: 0.008, shopkeepers: 0.006 + 0.05 * (0.04 + 0.4 * c.ind)};
    let used = 0;
    fixed.forEach(p => { const t = P * shr[p]; s.pops[p] += (t - s.pops[p]) * (fast ? 0.4 : 0.12); used += s.pops[p]; });
    const flex = ['peasants', 'laborers', 'machinists', 'soldiers', 'officers', 'bureaucrats', 'clerks'];
    const pw = P - used;
    const want = {};
    let sumD = 0;
    flex.forEach(p => { want[p] = p === 'peasants' ? 0 : (s.jobs[p] || 0) / WF * 1.03; if (p === 'clerks') want[p] += P * 0.0015; sumD += want[p]; });
    want.peasants = Math.max((s.jobs.peasants || 0) / WF * 1.03, 0);
    sumD += want.peasants;
    const scale = sumD > pw ? pw / sumD : 1;
    flex.forEach(p => want[p] *= scale);
    let rest = pw; flex.forEach(p => { if (p !== 'peasants') rest -= want[p]; });
    // el resto de la población rural es campesinado (subsistencia incluida)
    want.peasants = Math.max(want.peasants, rest);
    // normalizar para conservar población
    let tot = 0; flex.forEach(p => tot += want[p]);
    const k = pw / Math.max(tot, 1);
    flex.forEach(p => { const t = want[p] * k; s.pops[p] += (t - s.pops[p]) * (fast ? 0.5 : 0.2); });
  });
}

/* ---------- política ---------- */
function politics(c) {
  // fuerza política por estratos y leyes
  const pw = LAW[c.laws.power]; const fr = pw.fr;
  const stratM = {upper: 1, middle: clamp(fr * 2.5, 0.05, 1), lower: Math.max(0.003, fr * fr)};
  const clout = {}; IG_ORDER.forEach(k => clout[k] = 0);
  const solSum = {}, solN = {}; IG_ORDER.forEach(k => { solSum[k] = 0; solN[k] = 0; });
  c.states.forEach(id => {
    const s = G.S[id];
    for (const p in s.pops) {
      const N = s.pops[p], def = PROFS[p];
      const pol = N * ({aristocrats: 60, capitalists: 60, clergy: 15, officers: 25, bureaucrats: 10, shopkeepers: 6, clerks: 6, machinists: 5}[p] || 1) * stratM[def.strat] * profBoost(c, p);
      const w = 1 + Math.max(0, s.sol[p] - 8) * 0.04;
      for (const ig in def.ig) { clout[ig] += pol * w * def.ig[ig]; solSum[ig] += N * def.ig[ig] * s.sol[p]; solN[ig] += N * def.ig[ig]; }
    }
  });
  IG_ORDER.forEach(k => clout[k] *= boostMult(c, k));
  let tot = 0; IG_ORDER.forEach(k => tot += clout[k]);
  const igs = {};
  IG_ORDER.forEach(k => {
    const prev = c.ig[k] || {};
    const share = tot > 0 ? clout[k] / tot : 0;
    let ap = 0;
    for (const lid of Object.values(c.laws)) { const w = IGS[k].likes[lid]; if (w) ap += w; }
    const sol = solN[k] > 0 ? solSum[k] / solN[k] : 8;
    ap = ap * 0.55 + (sol - 9) * 0.25;
    c.boosts.forEach(b => { if (b.kind === 'ig' && b.key === k) ap += b.mode === 'boost' ? 1.5 : -2; });
    igs[k] = {share, sol, target: ap, approval: prev.approval === undefined ? ap : prev.approval + (ap - prev.approval) * 0.25, gov: false, support: 0};
  });
  // coalición de gobierno
  const sorted = IG_ORDER.slice().sort((a, b) => igs[b].share - igs[a].share);
  let acc = 0; sorted.forEach((k, i) => { if (acc < 0.5 || i === 0) { igs[k].gov = true; acc += igs[k].share; } });
  let L = 0;
  IG_ORDER.forEach(k => { const g = igs[k]; g.approval = clamp(g.approval, -10, 10); L += g.share * g.approval * (g.gov ? 1.6 : 0.7); });
  const targetLeg = clamp(48 + 2.2 * L + (c.mods.stab || 0) * 1.2 + c.prestige / 40, 0, 100);
  c.legitimacy += (targetLeg - c.legitimacy) * 0.2;
  let rad = 0.05, loy = 0.1;
  IG_ORDER.forEach(k => { const g = igs[k]; rad += g.share * Math.max(0, -g.approval) * 0.06; loy += g.share * Math.max(0, g.approval) * 0.05; });
  rad += (c.mods.rad || 0) * 0.08 + Math.max(0, (9 - c.stats.sol)) * 0.012;
  c.radicals += (clamp(rad, 0, 0.9) - c.radicals) * 0.25;
  c.loyalists += (clamp(loy, 0, 0.9) - c.loyalists) * 0.25;
  c.ig = igs;
  // reforma en curso
  if (c.lawChange) {
    c.lawChange.months--;
    if (c.lawChange.months <= 0) resolveLawChange(c);
  }
}

function lawSupport(c, optId) {
  // apoyo neto ponderado por influencia
  let sup = 0;
  IG_ORDER.forEach(k => { const g = c.ig[k]; const w = IGS[k].likes[optId] || 0; const cur = IGS[k].likes[c.laws[LAW[optId].cat]] || 0; sup += g.share * (w - cur); });
  return sup;
}
function startLawChange(c, optId) {
  const o = LAW[optId]; if (!o || c.laws[o.cat] === optId || c.lawChange) return {ok: false, msg: 'Ya hay una reforma en curso o la ley ya está vigente.'};
  if (o.tech && !c.techs.has(o.tech)) return {ok: false, msg: 'Requiere la tecnología: ' + TECH[o.tech].name + '.'};
  if (c.influence < 50) return {ok: false, msg: 'Necesitas 50 de influencia.'};
  c.influence -= 50;
  const sup = lawSupport(c, optId);
  const chance = clamp(0.5 + sup * 0.25 + (c.legitimacy - 50) / 250, 0.05, 0.97);
  c.lawChange = {opt: optId, months: 3, chance};
  return {ok: true};
}
function resolveLawChange(c) {
  const lc = c.lawChange; c.lawChange = null;
  const o = LAW[lc.opt];
  if (Math.random() < lc.chance) {
    c.laws[o.cat] = lc.opt; recalcMods(c); cnt(c, 'reforms');
    if (c.tag === G.player) notify('law', `Reforma aprobada: ${o.name}.`);
    c.prestige += 2;
  } else {
    c.radicals = Math.min(0.9, c.radicals + 0.04);
    c.legitimacy -= 3;
    if (c.tag === G.player) notify('law', `La reforma «${o.name}» ha sido bloqueada por la oposición.`);
  }
}

/* ---------- objetivos ---------- */
function journal(c) {
  JOURNAL.forEach(j => {
    if (c.journalDone[j.id]) return;
    if (j.prog(c) >= j.goal) {
      c.journalDone[j.id] = G.date.y;
      c.prestige += j.reward.prestige; c.innovStock += j.reward.innov;
      if (c.tag === G.player) notify('journal', `Objetivo cumplido: ${j.name} (+${j.reward.prestige} prestigio).`);
    }
  });
}

/* ---------- IA ---------- */
function aiMonth(c) {
  if (c.tag === NONE) return;
  // impuestos
  if (c.treasury < 0 && c.taxLevel < 4) c.taxLevel++;
  else if (c.treasury > 300000 + c.stats.pop * 0.05 && c.taxLevel > 1) c.taxLevel--;
  // construcción pública
  if (c.queue.length < 3 && c.treasury > 50000) {
    const burLow = c.stats.bur < c.stats.burNeed * 0.9;
    const options = [];
    if (burLow) options.push('admin');
    if (c.stats.innovRate < 8) options.push('university');
    options.push('constr', 'barracks', 'railway', 'admin');
    const bid = pick(options);
    const s = G.S[pick(c.states)];
    if (s && BLD[bid] && buildRoom(s, bid) >= 1 && canBuild(s, BLD[bid], c)) queueBuild(c, s.id, bid);
  }
  // reformas
  if (!c.lawChange && Math.random() < 0.015) {
    const cat = pick(LAW_CATS); const opts = cat.opts.filter(o => o.id !== c.laws[cat.id] && (!o.tech || c.techs.has(o.tech)));
    if (opts.length) { const o = pick(opts); if (lawSupport(c, o.id) > 0.3 && c.influence >= 50) startLawChange(c, o.id); }
  }
  // colonización
  if (c.ind > 0.25 && c.rank <= 12 && Math.random() < 0.035 && !c.colonizing) {
    const t = colonizeTargets(c);
    if (t.length) startColonize(c, t[Math.floor(Math.random() * Math.min(3, t.length))].id);
  }
}

/* ---------- colonización ---------- */
function colonizeTargets(c) {
  const out = [];
  const mine = c.states.map(id => G.S[id]);
  G.S.forEach(s => {
    if (s.owner !== NONE) return;
    let best = 1e9;
    mine.forEach(m => { const d = distStates(m, s); if (d < best) best = d; });
    // alcance: adyacente o hasta una distancia máxima por mar
    if (best < (c.ind > 0.3 ? 30 : 20) || s.neigh.some(n => G.S[n].owner === c.tag)) out.push({id: s.id, d: best});
  });
  return out.sort((a, b) => a.d - b.d);
}
function stateCenter(s) { const st = MAP.stats[s.id]; return [xToLon(st.sx / Math.max(1, st.area)), yToLat(st.sy / Math.max(1, st.area))]; }
function distStates(a, b) { const A = stateCenter(a), B = stateCenter(b); return Math.hypot(A[0] - B[0], A[1] - B[1]); }
function startColonize(c, sid) {
  if (c.colonizing || c.influence < 80) return false;
  c.influence -= 80; c.colonizing = {state: sid, months: 6};
  return true;
}
function stepColonize(c) {
  if (!c.colonizing) return;
  c.colonizing.months--;
  if (c.colonizing.months > 0) return;
  const s = G.S[c.colonizing.state]; c.colonizing = null;
  if (s.owner !== NONE) return;
  transferState(s, c.tag); cnt(c, 'colonies');
  c.prestige += 4;
  if (c.tag === G.player) notify('colony', `${s.name} ha sido incorporada a tus dominios.`, s.id);
  else logMsg(`${c.name} coloniza ${s.name}.`);
}

function transferState(s, tag) {
  const old = G.C[s.owner]; const nw = G.C[tag];
  s.occ = 0; s.occBy = null; clearProvOcc(s.id);
  if (old.tag !== NONE && !old.claims.some(x => x.state === s.id)) old.claims.push({state: s.id, perm: true});
  nw.claims = nw.claims.filter(x => x.state !== s.id);
  old.states = old.states.filter(i => i !== s.id);
  nw.states.push(s.id);
  s.owner = tag;
  s.b.admin = s.b.admin || 0;
  G.ownerOf[s.id] = nw.id;
  old.queue = old.queue.filter(q => q.state !== s.id); old.projects = old.projects.filter(q => q.state !== s.id);
  if (old.capital === s.id) old.capital = old.states[0] ?? -1;
  if (typeof onOwnershipChanged === 'function') onOwnershipChanged(s.id);
}

/* ---------- eventos ---------- */
function notify(type, text, state) { G.notifs.push({type, text, state, date: Object.assign({}, G.date)}); logMsg(text); }
function logMsg(text) { G.log.unshift({text, date: Object.assign({}, G.date)}); if (G.log.length > 200) G.log.pop(); }

const EVENTS = [
 {id:'harvest', title:'Mala cosecha', cond: c => c.stats.pop > 0, w: 1,
  text: c => `Una sequía ha arruinado parte de la cosecha en ${G.S[pick(c.states)].name}. Los campesinos piden ayuda al Estado.`,
  opts: [{t:'Importar grano y repartirlo', cost: 3, fx: c => { c.legitimacy += 2; }},
         {t:'Dejar que el mercado actúe', fx: c => { c.radicals = Math.min(.9, c.radicals + .03); c.legitimacy -= 2; }}]},
 {id:'strike', title:'Huelga en las fábricas', cond: c => c.stats.indLevels > 15, w: 1,
  text: c => `Los obreros de ${G.S[pick(c.states)].name} se han declarado en huelga exigiendo mejores salarios y menos horas.`,
  opts: [{t:'Negociar con los sindicatos', fx: c => { c.radicals = Math.max(0, c.radicals - .03); c.prestige += 1; }},
         {t:'Enviar al ejército', fx: c => { c.legitimacy -= 4; c.radicals = Math.min(.9, c.radicals + .02); }}]},
 {id:'cholera', title:'Brote de cólera', cond: c => c.stats.pop > 1e6, w: 1,
  text: c => `Una epidemia de cólera se extiende por ${G.S[pick(c.states)].name}.`,
  opts: [{t:'Financiar medidas sanitarias', cost: 2, fx: c => { c.legitimacy += 1; }},
         {t:'Ignorar el problema', fx: c => { c.states.forEach(i => { const s = G.S[i]; for (const p in s.pops) s.pops[p] *= 0.992; }); }}]},
 {id:'coal', title:'Descubrimiento de yacimientos', cond: c => c.states.length > 0, w: 1,
  text: c => 'Los geólogos han encontrado nuevas vetas de carbón en tu territorio.',
  opts: [{t:'¡Excelente noticia!', fx: c => { const s = G.S[pick(c.states)]; s.cap.coal = (s.cap.coal || 0) + 3; notify('event', `Nuevos yacimientos de carbón en ${s.name} (+3 niveles).`, s.id); }}]},
 {id:'panic', title:'Pánico bursátil', cond: c => c.ind > .25, w: .5,
  text: c => 'Los bancos restringen el crédito y cunde el pánico entre los inversores.',
  opts: [{t:'Rescatar a los bancos', cost: 5, fx: c => { c.investPool += c.stats.income * 3; }},
         {t:'Dejar caer a los especuladores', fx: c => { c.investPool *= .4; c.radicals = Math.min(.9, c.radicals + .02); }}]},
 {id:'reform', title:'Clamor reformista', cond: c => c.legitimacy < 60, w: 1,
  text: c => 'Panfletos y periódicos exigen una apertura del régimen. Los liberales organizan reuniones.',
  opts: [{t:'Hacer concesiones', fx: c => { c.legitimacy += 6; c.influence += 15; }},
         {t:'Reprimir a los agitadores', fx: c => { c.legitimacy -= 3; c.radicals = Math.min(.9, c.radicals + .03); c.influence += 10; }}]},
 {id:'wedding', title:'Boda real', cond: c => /Monarqu|Imperio|Shogun|Despotismo/.test(c.gov), w: .6,
  text: c => 'La casa real celebra una fastuosa boda. Las potencias envían embajadores.',
  opts: [{t:'Celebrar a lo grande', cost: 1.5, fx: c => { c.prestige += 6; }},
         {t:'Una ceremonia austera', fx: c => { c.prestige += 1; }}]},
 {id:'invention', title:'Un inventor presenta su máquina', cond: c => c.stats.indLevels > 5, w: .8,
  text: c => 'Un ingeniero local ha ideado una nueva máquina que podría mejorar la producción.',
  opts: [{t:'Financiar la patente', cost: 1, fx: c => { c.innovStock += 60; }},
         {t:'Dejar a la iniciativa privada', fx: c => { c.innovStock += 15; }}]}
];

function dailyEvents() { }

function yearly() {
  G.tags.forEach(t => { if (t !== NONE) stepColonizeYear(G.C[t]); });
}
function stepColonizeYear() { }
function stepColonizeAll() { G.tags.forEach(t => { if (t !== NONE) stepColonize(G.C[t]); }); }

