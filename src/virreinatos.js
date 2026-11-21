/* ===== VIRREINATOS Y COLONIAS AUTÓNOMAS =====
   Al colonizar un territorio lejano (más de 16° de tus estados: otro continente o ultramar) puedes crear un VIRREINATO en vez de incorporarlo: un país nuevo, vasallo
   tuyo, con su propio gobierno, tesoro, economía y ejército, pero bajo tu control militar (sus ejércitos aparecen como tuyos y los ordenas tú; entran solos en tus guerras).
   Tres políticas de autonomía:
     0 · Control directo   — tributo 30 %, la lealtad cae (−1,2/mes): riesgo de independencia.
     1 · Autonomía moderada — tributo 15 %, la lealtad apenas cambia.
     2 · Gran autonomía     — tributo 5 %, la lealtad sube (+0,8/mes) y la colonia crece más rápido (+producción e inversión).
   La distancia y la debilidad de la metrópoli restan lealtad; si baja de 10 pueden proclamar la independencia (guerra de secesión). Con influencia 40 puedes reintegrar el virreinato.
   La metrópoli cubre los déficits de la colonia (hasta 6 semanas de ingresos). Para la IA lo decide el azar (la mitad de las colonias lejanas de las 15 primeras potencias). */
const VR = {far: 16, tribute: [0.30, 0.15, 0.05], dl: [-1.2, -0.2, 0.8], names: {SPA: 'Virreinato de', POR: 'Virreinato de', GBR: 'Dominio de', FRA: 'Colonia francesa de', NET: 'Colonia neerlandesa de', PRU: 'Protectorado de', BEL: 'Colonia belga de', SAR: 'Colonia italiana de'}};
const ownsArmy = a => !!a && (a.tag === G.player || (G.C[a.tag] && G.C[a.tag].vice && G.C[a.tag].vice.over === G.player));
const vrOf = tag => G.tags.filter(t => t !== NONE && G.C[t].vice && G.C[t].vice.over === tag && G.C[t].states.length);
function vrDist(c, sid) { let best = 1e9; c.states.forEach(id => { if (id !== sid) { const d = distStates(G.S[id], G.S[sid]); if (d < best) best = d; } }); return best; }
const vrIsFar = (c, sid) => vrDist(c, sid) > VR.far && !G.S[sid].neigh.some(n => G.S[n].owner === c.tag);
function vrShade(hex, k) { const m = /^#([0-9a-f]{6})$/i.exec(hex || ''); if (!m) return hex || '#888888'; const n = parseInt(m[1], 16); const f = v => clamp(Math.round(v * (1 + k)), 0, 255); return '#' + [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(f).map(v => v.toString(16).padStart(2, '0')).join(''); }
function vrCreate(overTag, sid, silent) {
  const O = G.C[overTag], s = G.S[sid]; if (!O || !s) return null; const tag = pickRebelTag(overTag); if (!tag) return null; const c = G.C[tag];
  c.techs = new Set(O.techs); c.laws = Object.assign({}, O.laws); c.ideo = O.ideo; recalcMods(c);
  c.ai = true; c.overlord = null; c.subjects = []; c.wars = []; c.claims = []; c.bloc = null; c.rebelUsed = true; c.rebelOf = null; c.civilWar = null;
  const pre = VR.names[overTag] || 'Gobernación de'; c.name = `${pre} ${s.name}`; c.adj = O.adj; try { c.color = vrShade(O.color, -0.2); c._rgb = null; if (O.flagSpec) c.flagSpec = JSON.parse(JSON.stringify(O.flagSpec)); } catch (e) { }
  c.legitimacy = 70; c.radicals = 0.05; c.prestige = 5; c.influence = 40; c.treasury = Math.round(Math.max(0, O.stats.income) * 4);
  transferState(s, tag); c.capital = sid; c.capitalName = s.name;
  c.vice = {over: overTag, pol: 1, loyalty: 75, born: G.date.t}; makeSubject(overTag, tag);
  const prov = MAP.stats[sid].provs[0]; const divs = [mkDivision('inf', 0.8), mkDivision('inf', 0.8)]; if (O.stats && hasTech(O, 'cavalry')) divs.push(mkDivision('cav', 0.8)); mkArmy(tag, prov, divs, '1.º Ejército Colonial');
  if (typeof spawnLevies === 'function') try { spawnLevies(c); } catch (_) { }
  if (!silent) { if (overTag === G.player) notify('colony', `👑 Nace el ${c.name}: virreinato autónomo bajo tu corona, con su propio ejército.`, sid); else logMsg(`${O.name} funda ${c.name}.`); }
  return tag;
}
function vrConvert(over, sid) { const O = G.C[over]; if (!O || G.S[sid].owner !== over || sid === O.capital || O.states.length < 2) return null; if (!vrIsFar(O, sid)) return null; return vrCreate(over, sid); }
// colonización: los territorios lejanos pueden convertirse en virreinatos
const _stepColVR = stepColonize;
stepColonize = function (c) {
  if (c.colonizing && c.colonizing.months - 1 <= 0) {
    const sid = c.colonizing.state, s = G.S[sid];
    if (s.owner === NONE && c.states.length >= 2 && vrIsFar(c, sid) && ((!c.ai && c.colMode !== 'direct') || (c.ai && c.rank <= 15 && vrOf(c.tag).length < 4 && Math.random() < 0.5))) { c.colonizing = null; if (vrCreate(c.tag, sid)) { cnt(c, 'colonies'); c.prestige += 4; return; } }
  }
  _stepColVR(c);
};
// el tributo de los virreinatos depende de su política
const _flowsVR = pactMoneyFlows;
pactMoneyFlows = function (c) {
  if (!c.vice || !G.C[c.vice.over]) return _flowsVR(c);
  const inc = c.stats.income; let out = 0; const tr = inc * VR.tribute[c.vice.pol]; out += tr; G.C[c.vice.over].treasury += tr;
  G.pacts.forEach(p => { if (p.type === 'subsidy' && p.a === c.tag) { const amt = inc * 0.02 * (p.level || 1); out += amt; G.C[p.b].treasury += amt; } });
  if (c.wars.length) out += inc * 0.05 * Math.min(2, c.wars.length); return out;
};
// la IA no mueve los ejércitos de los virreinatos del jugador
const _aiWarStepVR = aiWarStep;
aiWarStep = function (t) { const c = G.C[t]; if (c && c.vice && c.vice.over === G.player) return; return _aiWarStepVR(t); };
const _recalcVR = recalcMods;
recalcMods = function (c) { const m = _recalcVR(c); if (c.vice && c.vice.pol === 2) { m.indOut += 0.03; m.invest += 0.05; m.grow = (m.grow || 0) + 0.0004; } return m; };
function vrJoinWars(c) {
  const O = G.C[c.vice.over]; if (!O || !O.states.length) return;
  G.wars.forEach(w => { const inA = w.attAll.includes(O.tag), inD = w.defAll.includes(O.tag), cA = w.attAll.includes(c.tag), cD = w.defAll.includes(c.tag);
    if ((inA || inD) && !cA && !cD && c.wars.length < 3) { (inA ? w.attAll : w.defAll).push(c.tag); c.wars.push(w.id); if (O.tag === G.player) notify('war', `${c.name} entra en la guerra a tu lado.`); }
    else if (!(inA || inD) && (cA || cD) && O.wars.length < 3) { (cA ? w.attAll : w.defAll).push(O.tag); O.wars.push(w.id); if (O.tag === G.player) notify('war', `Defiendes a ${c.name}: entras en su guerra.`); } });
}
function vrMonth(c) {
  const v = c.vice; if (!v) return; const O = G.C[v.over]; if (!O || !O.states.length || !c.states.length) { if (!c.states.length) c.vice = null; return; }
  vrJoinWars(c);
  // el déficit de la colonia lo cubre la metrópoli
  if (c.treasury < 0 && O.treasury > 0) { const aid = Math.min(-c.treasury, Math.max(0, O.stats.income) * 6); c.treasury += aid; O.treasury -= aid; }
  const dist = vrDist(O, c.capital >= 0 ? c.capital : c.states[0]); let d = VR.dl[v.pol] - Math.min(1.2, (dist > 1e8 ? 0 : dist) / 90) + (O.rank <= 5 ? 0.4 : O.rank <= 12 ? 0.1 : -0.3) - (O.wars.length ? 0.2 : 0) - (c.scarc || 0) * 1.5;
  v.loyalty = clamp(v.loyalty + d, 0, 100);
  if (v.loyalty < 25 && v.warned !== 1) { v.warned = 1; if (O.tag === G.player) notify('crisis', `⚠️ ${c.name}: la lealtad cae (${Math.round(v.loyalty)}). Concede más autonomía o corres el riesgo de una secesión.`, c.capital); } if (v.loyalty >= 40) v.warned = 0;
  if (v.loyalty < 10 && Math.random() < 0.25 && !O.wars.some(wid => { const w = G.wars.find(x => x.id === wid); return w && w.attAll.concat(w.defAll).includes(c.tag); })) {
    const over = v.over; releaseSubject(over, c.tag); c.vice = null; c.relations = c.relations || {}; c.relations[over] = -60;
    if (alive(c.tag) && alive(over)) { const w = declareWar(c.tag, over, 'conquest', O.states.filter(id => distStates(G.S[id], G.S[c.capital]) < 8).slice(0, 2), {free: true}); void w; }
    notify('war', `🔥 ¡${c.name} proclama su independencia de ${O.name}!`, c.capital);
  }
}
const _navalMonthVR = navalMonth; navalMonth = function (c) { _navalMonthVR(c); if (c.vice) vrMonth(c); };
/* ---------- interfaz: pestaña Colonización ---------- */
function vrCard() {
  const c = me(), subs = vrOf(c.tag), far = c.states.filter(id => id !== c.capital && !G.C[G.S[id].owner].vice && vrIsFar(c, id)).slice(0, 10), mode = c.colMode === 'direct' ? 'direct' : 'vice';
  const pols = ['Control directo (tributo 30 %)', 'Autonomía moderada (tributo 15 %)', 'Gran autonomía (tributo 5 %)'];
  return `<div class="card"><h3>👑 Virreinatos y colonias autónomas</h3><p class="hint">Un territorio lejano (>${VR.far}°) puede ser un virreinato: país vasallo con su propio gobierno y ejército, que tú diriges. Más autonomía = menos tributo pero más lealtad y crecimiento.</p>
    <div class="kv"><span>Al colonizar un territorio lejano</span><select data-act="vrmode"><option value="vice" ${mode === 'vice' ? 'selected' : ''}>Crear virreinato autónomo</option><option value="direct" ${mode === 'direct' ? 'selected' : ''}>Incorporarlo directamente</option></select></div>
    ${subs.length ? `<table class="tbl"><thead><tr><th>Virreinato</th><th class="r">Lealtad</th><th>Política</th><th class="r">Ejército</th><th></th></tr></thead><tbody>${subs.map(t => { const q = G.C[t], v = q.vice, divs = armiesOf(t).reduce((n, a) => n + a.divs.length, 0);
      return `<tr><td>${flag(t, 'sm')} <b>${q.name}</b><br><small class="dim">${q.states.length} estado(s) · ${fmtN(q.stats.pop, 1)} hab. · tesoro ${money(q.treasury)}</small></td><td class="r ${v.loyalty < 30 ? 'bad' : v.loyalty > 65 ? 'good' : ''}">${Math.round(v.loyalty)}</td>
      <td><select data-act="vrpol" data-t="${t}">${pols.map((p, i) => `<option value="${i}" ${v.pol === i ? 'selected' : ''}>${p}</option>`).join('')}</select></td><td class="r">${divs} div.</td>
      <td><button data-act="focus" data-id="${q.capital}">📍</button> <button data-act="vrint" data-t="${t}" ${c.influence < 40 ? 'disabled' : ''} data-tip="Reintegra el virreinato (40 de influencia)">Reintegrar</button></td></tr>`; }).join('')}</tbody></table>` : '<small class="dim">No tienes virreinatos.</small>'}
    ${far.length ? `<h4>Estados lejanos que puedes convertir</h4>${far.map(id => `<div class="kv sm"><span>${G.S[id].name} <small class="dim">(${Math.round(vrDist(c, id))}°)</small></span><button data-act="vrnew" data-s="${id}" ${c.influence < 40 ? 'disabled' : ''}>Convertir en virreinato <small>40 inf.</small></button></div>`).join('')}` : ''}</div>`;
}
const _dipRenderVR = WINDOWS.diplomacy.render;
WINDOWS.diplomacy.render = function () { const h = _dipRenderVR.call(this); return h.includes('<h3>Colonización</h3>') ? h.replace('<div class="card"><h3>Colonización</h3>', vrCard() + '<div class="card"><h3>Colonización</h3>') : h; };
Object.assign(ACT, {
  vrmode: (d, el) => { me().colMode = el.value; renderWindow(); },
  vrpol: (d, el) => { const q = G.C[d.t]; if (q && q.vice && q.vice.over === G.player) { q.vice.pol = +el.value; recalcMods(q); toast('👑', `${q.name}: ${['control directo', 'autonomía moderada', 'gran autonomía'][q.vice.pol]}.`); } renderWindow(); },
  vrnew: d => { const c = me(); if (c.influence < 40) return; const t = vrConvert(c.tag, +d.s); if (t) c.influence -= 40; else toast('⚠️', 'No se puede convertir ese estado.'); renderWindow(); },
  vrint: d => { const c = me(), q = G.C[d.t]; if (!q || !q.vice || c.influence < 40) return; c.influence -= 40; const r = annexSubject(c.tag, d.t); if (r.ok) { q.vice = null; toast('👑', 'Virreinato reintegrado.'); } renderWindow(); }
});
// los virreinatos conservan su ejército: la IA no lo licencia por exceso ni por austeridad, y su límite de divisiones es mayor (3 + 2 por estado)
const _disbExVR = aiDisbandExcess; aiDisbandExcess = function (c) { if (c.vice) return; return _disbExVR(c); };
const _austVR = aiAusterity; aiAusterity = function (t, c) { if (c.vice) return false; return _austVR(t, c); };
const _divLimVR = divLimit; divLimit = function (c) { const v = _divLimVR(c); return c.vice ? Math.max(v, 3 + 2 * c.states.length) : v; };
