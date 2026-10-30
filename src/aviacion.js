/* ===== AVIACIÓN =====
   Escuadrones de cazas y bombarderos formados con el inventario nacional de aviones y desplegados en regiones aéreas (grupos de estados
   vecinos). Misiones: superioridad aérea, apoyo cercano, bombardeo estratégico e intercepción. airBonus(tag, estado) da hasta +25% de ataque
   terrestre a quien domina el cielo de la región; el apoyo cercano causa daño directo en las batallas; el bombardeo reduce la producción
   de los edificios del estado. Solo existe con las tecnologías de la Era 3 (hacia 1905-1915). */
const SQ_MAX = 100, SQ_MIN = 10;
const AIR_TYPES = {
  fighter: {name: 'Cazas', icon: '🛩️', tech: 'fighters', att: 1.0, missions: ['sup', 'intc', 'cas']},
  bomber: {name: 'Bombarderos', icon: '✈️', tech: 'bombers', att: 0.8, missions: ['cas', 'strat']}
};
const AIR_MISSIONS = {
  sup: {name: 'Superioridad aérea', icon: '🏆', desc: 'Disputa el cielo de la región: da hasta +25% de ataque terrestre a quien lo domina.'},
  cas: {name: 'Apoyo cercano', icon: '🎯', desc: 'Daño directo al enemigo en las batallas terrestres de la región.'},
  strat: {name: 'Bombardeo estratégico', icon: '💣', desc: 'Reduce la producción de los edificios de los estados enemigos de la región.'},
  intc: {name: 'Intercepción', icon: '🛡️', desc: 'Derriba bombarderos enemigos y protege tu región.'}
};
const sqPower = s => s.n * (1 + 0.18 * (s.gen || 0)) * (1 + Math.min(0.3, (s.xp || 0) * 0.002));
const airTypesOf = c => Object.keys(AIR_TYPES).filter(k => hasTech(c, AIR_TYPES[k].tech));

/* ---------- cálculos por región ---------- */
// poder de cazas de un país en una región (los de superioridad/intercepción cuentan entero; los de apoyo, la mitad)
function airFighters(tag, reg) { let p = 0; mx().sq.forEach(s => { if (s.reg !== reg || s.type !== 'fighter' || s.n <= 0) return; if (s.tag !== tag && !sameSide(tag, s.tag)) return; p += sqPower(s) * (s.mission === 'sup' || s.mission === 'intc' ? 1 : 0.5); }); return p * (1 + docMod(tag, 'air')); }
function airHostileFighters(tag, reg) { let p = 0; mx().sq.forEach(s => { if (s.reg !== reg || s.type !== 'fighter' || s.n <= 0 || !hostileTags(tag, s.tag)) return; p += sqPower(s) * (s.mission === 'sup' || s.mission === 'intc' ? 1 : 0.5) * (1 + docMod(s.tag, 'air')); }); return p; }
// dominio aéreo de un país en una región (0..1)
function airDominance(tag, reg) { const own = airFighters(tag, reg), foe = airHostileFighters(tag, reg); return own <= 0 ? 0 : clamp((own - foe) / Math.max(own, foe, 1), 0, 1); }
// gancho del combate terrestre: +ataque por superioridad aérea
function airBonus(tag, sid) { if (!G.mx || !mx().sq.length) return 0; return 0.25 * Math.pow(airDominance(tag, airRegOf(sid)), 0.8); }
// gancho del combate terrestre: daño directo del apoyo cercano (se suma al ritmo de daño)
function airCas(tag, sid) {
  if (!G.mx || !mx().sq.length) return 0; const reg = airRegOf(sid); let p = 0;
  mx().sq.forEach(s => { if (s.reg === reg && s.mission === 'cas' && s.n > 0 && (s.tag === tag || sameSide(tag, s.tag))) p += sqPower(s) * (s.type === 'bomber' ? 1 : 0.4); });
  const foe = airHostileFighters(tag, reg), prot = clamp(foe / Math.max(1, foe + p), 0, 0.6);
  return clamp(p * 0.0022 * (1 + docMod(tag, 'cas')) * (1 - prot), 0, 0.4);
}
// regiones con reconocimiento aéreo de un país (para la niebla de guerra)
function airReconRegs(tag) { const out = new Set(); mx().sq.forEach(s => { if (s.n >= SQ_MIN && (s.tag === tag || sameSide(tag, s.tag)) && airDominance(tag, s.reg) >= 0 && airHostileFighters(tag, s.reg) < sqPower(s) * 1.5) out.add(s.reg); }); return out; }

/* ---------- escuadrones ---------- */
function sqCost(c, n) { return Math.round(n * 160 * moneyPerPoint(c) / 6); }
function sqCanBuild(c, type, n) {
  const T = AIR_TYPES[type]; if (!T) return 'Tipo desconocido.';
  if (!hasTech(c, 'military_aviation') || !hasTech(c, T.tech)) return `Necesitas la tecnología ${TECH[T.tech].name}.`;
  if ((c.eq.aircraft || 0) < n) return `Faltan aviones en el inventario (${fmtN(c.eq.aircraft || 0, 0)} de ${n}). Asigna fábricas a la línea de aviones.`;
  if (c.treasury < sqCost(c, n)) return 'No tienes fondos.';
  return null;
}
function sqBuild(c, type, n, reg) {
  const err = sqCanBuild(c, type, n); if (err) return {ok: false, msg: err};
  c.eq.aircraft -= n; c.treasury -= sqCost(c, n);
  if (reg === undefined || reg === null) reg = airRegOf(c.capital);
  const gen = Math.round(mc(c).q.aircraft || 0);
  const s = {id: mx().nsq++, tag: c.tag, type, n, gen, reg, mission: type === 'fighter' ? 'sup' : 'cas', xp: 0};
  mx().sq.push(s); return {ok: true, sq: s, msg: `Escuadrón de ${AIR_TYPES[type].name.toLowerCase()} formado en la ${airReg(reg).name}.`};
}
function sqReinforce(c, s) { const need = Math.floor(Math.min(SQ_MAX - s.n, c.eq.aircraft || 0)); if (need <= 0) return 0; c.eq.aircraft -= need; s.n += need; return need; }

/* ---------- resolución diaria ---------- */
function airDay() {
  const M = mx(); if (!M.sq.length) { return; }
  const byReg = {}; M.sq.forEach(s => { if (s.n > 0) (byReg[s.reg] = byReg[s.reg] || []).push(s); });
  for (const r in byReg) {
    const list = byReg[r]; const tags = [...new Set(list.map(s => s.tag))];
    // combate aéreo entre bandos hostiles
    tags.forEach(a => tags.forEach(b => {
      if (a >= b || !hostileTags(a, b)) return;
      const fa = list.filter(s => s.tag === a), fb = list.filter(s => s.tag === b);
      const pa = fa.reduce((n, s) => n + sqPower(s) * (s.type === 'fighter' ? (s.mission === 'sup' || s.mission === 'intc' ? 1 : .5) : .25), 0) * (1 + docMod(a, 'air'));
      const pb = fb.reduce((n, s) => n + sqPower(s) * (s.type === 'fighter' ? (s.mission === 'sup' || s.mission === 'intc' ? 1 : .5) : .25), 0) * (1 + docMod(b, 'air'));
      if (pa <= 0 || pb <= 0) return;
      const hit = (sq, foeP, ownP, tag) => sq.forEach(s => { const exposed = s.type === 'bomber' && s.mission === 'strat' ? 1.4 : s.mission === 'sup' || s.mission === 'intc' ? 1 : 0.6; const k = clamp(0.012 * foeP / Math.max(30, ownP + 30), 0, 0.06) * exposed * (0.8 + Math.random() * 0.4); const lost = Math.min(s.n, Math.max(s.n > 0 && Math.random() < k * s.n ? 1 : 0, Math.round(s.n * k))); s.n -= lost; s.lost = (s.lost || 0) + lost; s.xp = (s.xp || 0) + 0.4; xpGain(tag, 'air', 0.025); });
      hit(fa, pb * (1 + docMod(b, 'intc')), pa, a); hit(fb, pa * (1 + docMod(a, 'intc')), pb, b);
    }));
    // bombardeo estratégico: reduce la producción de los estados enemigos de la región
    list.forEach(s => {
      if (s.n < SQ_MIN || s.type !== 'bomber' || s.mission !== 'strat') return;
      const states = airReg(+r).states.filter(sid => { const o = G.S[sid].owner; return o !== NONE && hostileTags(s.tag, o); }); if (!states.length) return;
      const foe = states.map(sid => G.S[sid].owner), fpow = airHostileFighters(s.tag, +r), prot = clamp(fpow / Math.max(1, fpow + sqPower(s)), 0, 0.8);
      const sid = states[(G.date.t + s.id) % states.length], S = G.S[sid];
      S.bomb = Math.min(0.5, (S.bomb || 0) + 0.0012 * sqPower(s) * (1 + docMod(s.tag, 'bomb')) * (1 - prot)); S.bombT = G.date.t; void foe;
      s.xp = (s.xp || 0) + 0.15; xpGain(s.tag, 'air', 0.015);
    });
  }
  // los estados se recuperan del bombardeo; los escuadrones vacíos desaparecen
  if (G.date.t % 3 === 0) G.S.forEach(s => { if (s.bomb) { s.bomb = Math.max(0, s.bomb - 0.008); if (s.bomb < 0.002) s.bomb = 0; } });
  M.sq = M.sq.filter(s => { if (s.n > 0 && G.C[s.tag] && G.C[s.tag].states.length) return true; if (s.tag === G.player && s.n <= 0) notify('war', `El escuadrón ${s.id} ha sido aniquilado.`); return false; });
}

/* ---------- IA ---------- */
// política industrial de la IA: invierte en fábricas aeronáuticas y de motores cuando dispone de la tecnología
function aiMilIndustry(c) {
  const lv = k => c.states.reduce((n, id) => n + (G.S[id].b[k] || 0), 0);
  const want = {aeroworks: c.rank <= 8 ? 3 : c.rank <= 20 ? 1.5 : 0, enginew: c.rank <= 8 ? 2 : c.rank <= 20 ? 1 : 0, mgworks: c.rank <= 20 ? 1 : 0};
  const tech = {aeroworks: 'military_aviation', enginew: 'internal_comb', mgworks: 'machine_guns'};
  for (const k in want) {
    if (!want[k] || !hasTech(c, tech[k]) || lv(k) >= want[k]) continue;
    const sid = c.states.filter(id => (G.S[id].cap[k] || 0) - (G.S[id].b[k] || 0) >= 0.5).sort((a, b) => (G.S[b].cap[k] || 0) - (G.S[a].cap[k] || 0))[0];
    if (sid !== undefined && c.treasury > BLD[k].cost * 400) { G.S[sid].b[k] = (G.S[sid].b[k] || 0) + 0.5; c.treasury -= BLD[k].cost * 200; }
  }
}
function aviationAI(c) {
  if (c.rank <= 20) aiMilIndustry(c);
  if (!hasTech(c, 'military_aviation') || !c.states.length) return;
  const M = mx(), mine = M.sq.filter(s => s.tag === c.tag), atWar = c.wars.length > 0;
  const types = airTypesOf(c); if (!types.length) return;
  // refuerzos
  mine.forEach(s => { if (s.n < SQ_MAX * 0.7) sqReinforce(c, s); });
  // nuevo escuadrón
  const cap = Math.min(16, 3 + Math.floor((c.stats.indLevels || 0) / 12));
  if (mine.length < cap && (c.eq.aircraft || 0) >= 40) {
    const nf = mine.filter(s => s.type === 'fighter').length, nb = mine.length - nf;
    const type = types.includes('bomber') && (nf > nb * 1.5 || !types.includes('fighter')) ? 'bomber' : (types.includes('fighter') ? 'fighter' : 'bomber');
    // región con más trabajo: frontera con enemigos en guerra o capital
    let reg = airRegOf(c.capital);
    if (atWar) { const hot = {}; G.armies.forEach(a => { if (a.tag === c.tag && !a.sea) { const r = airRegOf(provState(a.loc)); hot[r] = (hot[r] || 0) + a.divs.length; } }); let bv = 0; for (const r in hot) if (hot[r] > bv) { bv = hot[r]; reg = +r; } }
    const r = sqBuild(c, type, Math.min(SQ_MAX, Math.floor(c.eq.aircraft)), reg); if (r.ok && c.tag !== G.player) logMsg(`${c.name} forma un escuadrón de ${AIR_TYPES[type].name.toLowerCase()}.`);
  }
  // misiones
  mx().sq.filter(s => s.tag === c.tag).forEach(s => {
    if (s.type === 'fighter') s.mission = airHostileFighters(c.tag, s.reg) > 0 || atWar ? 'sup' : 'intc';
    else { const enemyStates = airReg(s.reg).states.some(sid => { const o = G.S[sid].owner; return o !== NONE && hostileTags(c.tag, o); }); const fight = G.battles.some(b => airRegOf(b.state) === s.reg); s.mission = fight ? 'cas' : enemyStates ? 'strat' : 'cas'; }
  });
}
// objetivo de producción de aviones de la IA (aviones por semana)
function aircraftWant(c) {
  if (!hasTech(c, 'military_aviation') || !airTypesOf(c).length) return 0;
  const have = (c.eq.aircraft || 0) + mx().sq.filter(s => s.tag === c.tag).reduce((n, s) => n + s.n, 0);
  const tgt = c.rank <= 8 ? 900 : c.rank <= 20 ? 420 : 120;
  return Math.max(0, tgt - have) * 2;
}
function aviationWeek() { G.tags.forEach(t => { if (t !== NONE && G.C[t].ai && G.C[t].states.length) aviationAI(G.C[t]); }); }

/* ---------- interfaz ---------- */
function aviationHtml() {
  const c = me(), M = mx(), mine = M.sq.filter(s => s.tag === G.player), ok = hasTech(c, 'military_aviation'), types = airTypesOf(c);
  const regs = airRegions().regs.filter(r => r.states.some(sid => G.S[sid].owner === G.player)).slice(0, 14);
  if (!ok) return `<div class="card"><h3>✈️ Aviación</h3><p class="hint">Aún no hay aviación en tu país. Investiga <b>Aviación Militar</b> (Era 3, hacia ${TECH.military_aviation.after}) y después <b>Cazas</b> y <b>Bombarderos</b>. Necesitarás fábricas aeronáuticas (acero, motores y tela), una línea de producción de aviones y escuadrones desplegados en regiones aéreas.</p></div>`;
  const sqRow = s => { const T = AIR_TYPES[s.type], reg = airReg(s.reg);
    return `<tr><td>${T.icon} <b>${T.name}</b> <small class="dim">#${s.id} · gen ${s.gen}</small></td><td class="r">${s.n} / ${SQ_MAX}</td><td>${reg.name.replace('Región aérea de ', '')}</td>
    <td><select data-act="sqmission" data-id="${s.id}">${T.missions.map(m => `<option value="${m}" ${s.mission === m ? 'selected' : ''}>${AIR_MISSIONS[m].icon} ${AIR_MISSIONS[m].name}</option>`).join('')}</select></td>
    <td class="r"><select data-act="sqreg" data-id="${s.id}">${airRegions().regs.filter(r => r.states.some(x => G.S[x].owner === G.player || sameSide(G.player, G.S[x].owner))).slice(0, 24).map(r => `<option value="${r.id}" ${r.id === s.reg ? 'selected' : ''}>${r.name.replace('Región aérea de ', '')}</option>`).join('')}</select> <button data-act="sqreinf" data-id="${s.id}">＋ Refuerzo</button> <button data-act="sqdel" data-id="${s.id}">✕</button></td></tr>`; };
  return `<div class="cols"><div class="col wide"><div class="card"><h3>✈️ Escuadrones</h3>${mine.length ? `<table class="tbl"><thead><tr><th>Escuadrón</th><th class="r">Aviones</th><th>Región</th><th>Misión</th><th class="r">Despliegue</th></tr></thead><tbody>${mine.map(sqRow).join('')}</tbody></table>` : '<p class="hint">No tienes escuadrones.</p>'}
    <div class="btnrow">${types.map(k => { const err = sqCanBuild(c, k, 50); return `<button data-act="sqnew" data-t="${k}" ${err ? 'disabled' : ''} ${err ? `data-tip="${escA(err)}"` : ''}>＋ ${AIR_TYPES[k].icon} Escuadrón de ${AIR_TYPES[k].name.toLowerCase()} (50 aviones · ${money(sqCost(c, 50))})</button>`; }).join('') || '<small class="dim">Investiga Cazas o Bombarderos.</small>'}</div></div>
    <div class="card"><h3>Dominio aéreo de tus regiones</h3>${regs.map(r => { const own = airFighters(G.player, r.id), foe = airHostileFighters(G.player, r.id), dom = airDominance(G.player, r.id); return `<div class="kv sm"><span>${r.name.replace('Región aérea de ', '')}</span><b>${own > 0 || foe > 0 ? `🛩️ ${Math.round(own)} vs ${Math.round(foe)} · bonificación ${Math.round(25 * Math.pow(dom, 0.8))}%` : '<span class="dim">sin escuadrones</span>'}</b></div>`; }).join('')}</div></div>
    <div class="col"><div class="card"><h3>Misiones</h3>${Object.keys(AIR_MISSIONS).map(k => `<div class="kv sm"><span>${AIR_MISSIONS[k].icon} <b>${AIR_MISSIONS[k].name}</b></span></div><small class="dim">${AIR_MISSIONS[k].desc}</small>`).join('')}
    <p class="hint">Los escuadrones pierden aviones en el combate aéreo. Con un escuadrón desplegado también obtienes reconocimiento aéreo: ves los ejércitos enemigos de esa región.</p></div>
    <div class="card"><h3>Inventario</h3><div class="kv sm"><span>✈️ Aviones disponibles</span><b>${fmtN(c.eq.aircraft || 0, 0)}</b></div><div class="kv sm"><span>🛠 Fábricas aeronáuticas</span><b>${c.states.reduce((n, id) => n + (G.S[id].b.aeroworks || 0), 0).toFixed(1)}</b></div></div></div></div>`;
}
MX_TABS.push({id: 'air', label: '✈️ Aviación', html: aviationHtml});
Object.assign(ACT, {
  sqnew: d => { const r = sqBuild(me(), d.t, 50); toast(r.ok ? '✈️' : '⚠️', r.msg); renderWindow(); },
  sqreinf: d => { const s = mx().sq.find(x => x.id === +d.id); if (s) { const n = sqReinforce(me(), s); toast(n ? '✈️' : '⚠️', n ? `+${n} aviones.` : 'No hay aviones disponibles.'); } renderWindow(); },
  sqdel: d => { const M = mx(), s = M.sq.find(x => x.id === +d.id); if (s) { me().eq.aircraft = (me().eq.aircraft || 0) + Math.floor(s.n * 0.9); M.sq = M.sq.filter(x => x !== s); } renderWindow(); },
  sqmission: (d, el) => { const s = mx().sq.find(x => x.id === +d.id); if (s && el && el.value) s.mission = el.value; renderWindow(); },
  sqreg: (d, el) => { const s = mx().sq.find(x => x.id === +d.id); if (s && el && el.value !== undefined) s.reg = +el.value; renderWindow(); }
});
