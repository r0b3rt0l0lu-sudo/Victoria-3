/* ===== NIEBLA DE GUERRA E INTELIGENCIA =====
   - Al empezar sólo conoces parte del mundo: cuanto mayor es tu país, mayor es el radio explorado.
   - Las tropas de otros países sólo se ven en territorio propio/aliado, junto a tus ejércitos o a través de una red de agentes.
   - El servicio de inteligencia avisa de ataques, extiende la vista y permite robar tácticas al rival. */
const INTEL_LEVELS = [
  {name: 'Sin servicio', cost: 0, desc: 'No inviertes en espionaje.'},
  {name: 'Oficina de información', cost: 0.008, desc: '2 agentes. Avisa de ataques de la IA contra ti con unos días de antelación.'},
  {name: 'Servicio de inteligencia', cost: 0.016, desc: '4 agentes. Detecta tropas a 2 provincias de tu frontera.'},
  {name: 'Agencia de espionaje', cost: 0.028, desc: '6 agentes. Puede frustrar planes de ataque contra ti.'},
  {name: 'Red de espionaje mundial', cost: 0.045, desc: '8 agentes. Mayor alcance de vigilancia y espionaje más eficaz.'},
  {name: 'Servicio secreto imperial', cost: 0.07, desc: '10 agentes. Máxima eficacia en todo.'}
];
const INTEL_STEAL_DAYS = 60;
function intelOf(c) {
  if (!c.intel) c.intel = {lvl: c.ai ? (c.rank <= 8 ? 3 : c.rank <= 22 ? 2 : 1) : 0, ag: {}, steal: {}, miss: [], alert: {}};
  return c.intel;
}
const intelAgents = c => intelOf(c).lvl * 2;
const intelUsed = c => Object.values(intelOf(c).ag).reduce((s, n) => s + n, 0);
// fuerza de la red de agentes de `tag` dentro de `t` (0..1)
function intelNet(tag, t) {
  const c = G.C[tag]; if (!c) return 0; const I = intelOf(c), n = I.ag[t] || 0; if (!n) return 0;
  return clamp(Math.min(1, n * 0.34) * (0.7 + 0.06 * I.lvl) * (1 - 0.1 * intelOf(G.C[t]).lvl), 0, 1);
}
const intelReveals = (tag, t) => intelNet(tag, t) >= 0.2;

/* ---------- niebla ---------- */
function fogInit() {
  const N = MAP.provs.length, seen = new Uint8Array(N), c = G.C[G.player];
  const nT = G.tags.filter(t => t !== NONE && G.C[t].states.length).length, pct = 1 - (Math.min(c.rank, nT) - 1) / Math.max(1, nT - 1);
  const rad = 10 + 110 * Math.pow(clamp(1 - (c.rank - 1) / 35, 0, 1), 1.2); void pct;
  const own = []; c.states.forEach(sid => MAP.stats[sid].provs.forEach(p => own.push(p)));
  MAP.provs.forEach(P => { let d = 1e9; for (let i = 0; i < own.length; i++) { const q = MAP.provs[own[i]], dd = Math.hypot(P.lon - q.lon, P.lat - q.lat); if (dd < d) d = dd; } if (d <= rad) seen[P.id] = 1; });
  own.forEach(p => { seen[p] = 1; MAP.provs[p].nb.forEach(q => { seen[q] = 1; }); });
  G.fog = {p: G.player, seen, rad: Math.round(rad)};
  G.vis = null; R.needPaint = true;
}
function fogUpdate() {
  if (!G.player || !MAP.provs) return;
  if (!G.fog || G.fog.p !== G.player || G.fog.seen.length !== MAP.provs.length) fogInit();
  const me = G.player, c = G.C[me], I = intelOf(c), N = MAP.provs.length;
  const vis = G.vis && G.vis.length === N ? G.vis.fill(0) : (G.vis = new Uint8Array(N));
  const ring = (p, d) => { vis[p] = 1; if (d <= 0) return; MAP.provs[p].nb.forEach(q => { if (!vis[q] || d > 1) ring(q, d - 1); vis[q] = 1; }); };
  const depth = 1 + (I.lvl >= 2 ? 1 : 0) + (I.lvl >= 4 ? 1 : 0);
  for (let p = 0; p < N; p++) {
    const o = G.S[MAP.provs[p].s].owner, by = G.P[p].by;
    if ((o !== NONE && (o === me || sameSide(me, o))) || (by && sameSide(me, by))) { vis[p] = 1; if (o === me || (by && sameSide(me, by))) MAP.provs[p].nb.forEach(q => { vis[q] = 1; if (depth > 1) MAP.provs[q].nb.forEach(r => { vis[r] = 1; if (depth > 2) MAP.provs[r].nb.forEach(s => { vis[s] = 1; }); }); }); }
  }
  G.armies.forEach(a => { if (a.sea || !sameSide(me, a.tag)) return; vis[a.loc] = 1; MAP.provs[a.loc].nb.forEach(q => { vis[q] = 1; }); if (a.divs.some(d => d.t === 'cav')) MAP.provs[a.loc].nb.forEach(q => MAP.provs[q].nb.forEach(r => { vis[r] = 1; })); });
  if (typeof airReconRegs === 'function' && G.mx) airReconRegs(me).forEach(r => airReg(r).states.forEach(sid => MAP.stats[sid].provs.forEach(p => { vis[p] = 1; })));
  for (const t in I.ag) if (intelReveals(me, t) && G.C[t]) G.C[t].states.forEach(sid => MAP.stats[sid].provs.forEach(p => { vis[p] = 1; }));
  let fresh = 0; for (let p = 0; p < N; p++) if (vis[p] && !G.fog.seen[p]) { G.fog.seen[p] = 1; fresh++; }
  if (fresh) R.needPaint = true;
  void ring;
}
function armyVisible(a) {
  if (!G.fog || !G.player || R.fogOff) return true;
  if (a.tag === G.player || sameSide(G.player, a.tag)) return true;
  if (a.sea) return !!(G.vis && (G.vis[a.sea.from] || G.vis[a.sea.to]));
  return !G.vis || !!G.vis[a.loc];
}
const provVisible = pid => !G.fog || !G.vis || R.fogOff || !!G.vis[pid];

/* ---------- tareas diarias / semanales / mensuales ---------- */
function intelDay() {
  if (!G.player || !G.C[G.player]) return;
  if (!G.fog || (G.date.t % 2) === 0) fogUpdate();
  const I = intelOf(G.C[G.player]);
  I.miss = I.miss.filter(m => {
    if (G.date.t < m.end) return true;
    const t = G.C[m.t], p = clamp(0.3 + 0.11 * I.lvl + 0.25 * intelNet(G.player, m.t) - 0.07 * intelOf(t).lvl, 0.1, 0.92);
    if (Math.random() < p) { I.steal[m.t] = G.date.t + INTEL_STEAL_DAYS; notify('war', `🕵️ ¡Tus agentes han obtenido los planes tácticos de ${t.name}! Durante ${INTEL_STEAL_DAYS} días tus ejércitos combaten mejor contra ellos.`); }
    else { I.ag[m.t] = Math.max(0, (I.ag[m.t] || 0) - 1); addRel(G.player, m.t, -15); notify('war', `🕵️ La misión de espionaje contra ${t.name} fracasó: un agente fue capturado y las relaciones empeoran.`); }
    return false;
  });
}
function intelWeek() {
  const c = G.C[G.player]; if (!c) return; const I = intelOf(c);
  // ataques de la IA en preparación
  G.pendAtt = (G.pendAtt || []).filter(p => {
    if (G.date.t < p.at) return true;
    const A = G.C[p.a]; if (!alive(p.a) || !alive(p.d) || A.wars.length || relOf(p.a, p.d) > 40) { if (alive(p.a)) notify('diplo', `🕵️ ${A.name} renuncia a atacarte.`); return false; }
    declareWar(p.a, p.d, p.cb, p.targets, {free: p.fr}); return false;
  });
  // concentración de tropas junto a la frontera
  if (I.lvl >= 1 && c.states.length) {
    const near = new Set(); c.states.forEach(sid => MAP.stats[sid].provs.forEach(p => { near.add(p); MAP.provs[p].nb.forEach(q => { near.add(q); if (I.lvl >= 2) MAP.provs[q].nb.forEach(r => near.add(r)); }); }));
    const cnt = {}; G.armies.forEach(a => { if (a.sea || a.tag === G.player || sameSide(G.player, a.tag) || !near.has(a.loc)) return; if (!(I.lvl >= 2 || intelReveals(G.player, a.tag) || (G.vis && G.vis[a.loc]))) return; cnt[a.tag] = (cnt[a.tag] || 0) + a.divs.length; });
    for (const t in cnt) if (cnt[t] >= 4 && G.date.t - (I.alert[t] || -99) > 40) { I.alert[t] = G.date.t; notify('war', `🕵️ Inteligencia: ${G.C[t].name} concentra ${cnt[t]} divisiones junto a tu frontera.`); }
  }
}
function intelMonth(c) {
  const I = intelOf(c);
  if (c.ai) return;
  c.treasury -= Math.max(0, c.stats.income) * INTEL_LEVELS[I.lvl].cost * 4.3;
  if (I.lvl === 0) { for (const t in I.ag) delete I.ag[t]; }
  else for (const t in I.ag) { // el exceso de agentes se retira y algunos son capturados
    const lim = intelAgents(c); while (intelUsed(c) > lim) { const k = Object.keys(I.ag).find(x => I.ag[x] > 0); if (!k) break; I.ag[k]--; }
    for (let i = 0; i < (I.ag[t] || 0); i++) if (Math.random() < 0.012 * intelOf(G.C[t]).lvl * (1 - 0.1 * I.lvl)) { I.ag[t]--; addRel(c.tag, t, -6); notify('war', `🕵️ Un agente tuyo ha sido capturado en ${G.C[t].name}. Las relaciones empeoran.`); break; }
    if (!I.ag[t]) delete I.ag[t];
  }
}
// la IA va a atacar al jugador: el servicio de inteligencia avisa (y quizá lo frustra)
function intelAiAttack(a, d, cb, targets, fr) {
  if (d !== G.player) return false; const I = intelOf(G.C[d]); if (I.lvl < 1) return false;
  if (I.lvl >= 3 && Math.random() < 0.15 * (I.lvl - 2)) { notify('diplo', `🕵️ Tus agentes han frustrado un plan de ataque de ${G.C[a].name}.`); return true; }
  const days = 8 + I.lvl * 4; (G.pendAtt = G.pendAtt || []).push({a, d, cb, targets, fr, at: G.date.t + days});
  notify('diplo', `🕵️ Tus agentes advierten: ${G.C[a].name} prepara un ataque contra ti en unos ${days} días. Moviliza tropas o mejora las relaciones.`);
  return true;
}
/* ---------- acciones del jugador ---------- */
function intelSetLevel(c, n) { const I = intelOf(c); I.lvl = clamp(n | 0, 0, 5); while (intelUsed(c) > intelAgents(c)) { const k = Object.keys(I.ag).find(x => I.ag[x] > 0); I.ag[k]--; if (!I.ag[k]) delete I.ag[k]; } }
function intelSend(c, t) { const I = intelOf(c); if (intelUsed(c) >= intelAgents(c)) return {ok: false, msg: 'No tienes agentes libres. Sube el nivel del servicio.'}; if ((I.ag[t] || 0) >= 3) return {ok: false, msg: 'Ya hay 3 agentes allí.'}; I.ag[t] = (I.ag[t] || 0) + 1; G.vis = null; fogUpdate(); return {ok: true, msg: `Un agente parte hacia ${G.C[t].name}.`}; }
function intelRecall(c, t) { const I = intelOf(c); if (!I.ag[t]) return {ok: false, msg: ''}; I.ag[t]--; if (!I.ag[t]) delete I.ag[t]; return {ok: true, msg: `Un agente regresa de ${G.C[t].name}.`}; }
const stealCost = c => Math.round(Math.max(0, c.stats.income) * 0.25);
function intelSteal(c, t) {
  const I = intelOf(c); if (!(I.ag[t] > 0)) return {ok: false, msg: 'Necesitas al menos un agente en ese país.'};
  if (I.miss.some(m => m.t === t)) return {ok: false, msg: 'Ya hay una misión en curso allí.'};
  if (c.treasury < stealCost(c)) return {ok: false, msg: 'No tienes fondos para la operación.'};
  c.treasury -= stealCost(c); I.miss.push({t, end: G.date.t + 20});
  return {ok: true, msg: `Tus agentes en ${G.C[t].name} intentan robar sus planes tácticos (20 días).`};
}
const intelStealBonus = (tag, foe) => { const c = G.C[tag]; return c && c.intel && foe && c.intel.steal && c.intel.steal[foe] > G.date.t ? 0.12 : 0; };

/* ---------- pestaña de la interfaz ---------- */
function intelTabHtml() {
  const c = me(), I = intelOf(c), free = intelAgents(c) - intelUsed(c);
  const myProvs = new Set(); c.states.forEach(sid => MAP.stats[sid].provs.forEach(p => myProvs.add(p)));
  const rel = G.tags.filter(t => t !== NONE && t !== G.player && alive(t)).map(t => {
    let near = 0; G.C[t].states.forEach(sid => MAP.stats[sid].provs.forEach(p => { if (MAP.provs[p].nb.some(q => myProvs.has(q))) near = 1; }));
    return {t, sc: (near ? 100 : 0) + (hostileTags(G.player, t) ? 150 : 0) + (I.ag[t] ? 200 : 0) + (60 - Math.min(60, G.C[t].rank * 3))};
  }).sort((a, b) => b.sc - a.sc).slice(0, 18);
  return `<div class="cols"><div class="col"><div class="card"><h3>🕵️ Servicio de inteligencia</h3>
    <p class="hint">Cuanto más inviertas, más agentes tienes y más lejos ves. Coste mensual: <b>${money(Math.max(0, c.stats.income) * INTEL_LEVELS[I.lvl].cost * 4.3)}</b>.</p>
    ${INTEL_LEVELS.map((l, i) => `<button class="block ${I.lvl === i ? 'on' : ''}" data-act="intellvl" data-n="${i}"><b>${l.name}</b> <small>${i ? Math.round(l.cost * 1000) / 10 + '% de los ingresos' : 'gratis'}</small><small class="dim">${l.desc}</small></button>`).join('')}
    <div class="kv"><span>Agentes libres</span><b>${free} / ${intelAgents(c)}</b></div>
    <div class="kv"><span>Mundo explorado</span><b>${G.fog ? Math.round(G.fog.seen.reduce((s, x) => s + x, 0) / G.fog.seen.length * 100) : 0}%</b></div></div></div>
    <div class="col wide"><div class="card"><h3>Agentes en el extranjero</h3><p class="hint">Dos agentes en un país te dan <b>visión completa</b> de su territorio y sus ejércitos. Con un agente puedes <b>robar sus tácticas</b>: durante ${INTEL_STEAL_DAYS} días tus tropas atacan y defienden un 12% mejor contra ellos. Los países con buen servicio de inteligencia descubren a tus agentes.</p>
    <table class="tbl"><thead><tr><th>País</th><th class="r">Agentes</th><th class="r">Red</th><th></th></tr></thead><tbody>${rel.map(r => { const n = I.ag[r.t] || 0, st = I.steal[r.t] > G.date.t, ms = I.miss.some(m => m.t === r.t); return `<tr><td>${flag(r.t, 'sm')} <b>${G.C[r.t].name}</b> <small class="dim">${hostileTags(G.player, r.t) ? '⚔ en guerra' : ''} · inteligencia ${intelOf(G.C[r.t]).lvl}</small></td><td class="r">${n}</td><td class="r">${Math.round(intelNet(G.player, r.t) * 100)}%</td><td class="r"><button data-act="intelsend" data-t="${r.t}" ${free > 0 && n < 3 ? '' : 'disabled'}>＋</button> <button data-act="intelrecall" data-t="${r.t}" ${n ? '' : 'disabled'}>－</button> <button data-act="intelsteal" data-t="${r.t}" ${n && !ms ? '' : 'disabled'} data-tip="Cuesta ${money(stealCost(c))}">${st ? '✔ tácticas robadas (' + (I.steal[r.t] - G.date.t) + ' d)' : ms ? 'en curso…' : '📜 Robar tácticas'}</button></td></tr>`; }).join('')}</tbody></table></div></div></div>`;
}
Object.assign(ACT, {
  intellvl: d => { intelSetLevel(me(), +d.n); renderWindow(); },
  intelsend: d => { const r = intelSend(me(), d.t); toast(r.ok ? '🕵️' : '⚠️', r.msg); renderWindow(); },
  intelrecall: d => { const r = intelRecall(me(), d.t); if (r.msg) toast('🕵️', r.msg); renderWindow(); },
  intelsteal: d => { const r = intelSteal(me(), d.t); toast(r.ok ? '📜' : '⚠️', r.msg); renderWindow(); }
});
