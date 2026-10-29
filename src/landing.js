/* ===== TRANSPORTES Y PLANES DE DESEMBARCO (sin flota de guerra) ===== */
const TRANSPORT_CAP = 2, TRANSPORT_DAYS = 40, LAND_PREP = 14, LAND_RANGE = 75;
const shipsOf = c => (c.ships = c.ships || {transport: 0, busy: 0});
const freeTransports = c => { const s = shipsOf(c); return s.transport - s.busy; };
const transportCost = c => Math.round(moneyPerPoint(c) * 140);
function portStates(c) { return c.states.filter(id => MAP.stats[id].provs.some(p => MAP.provs[p].port)); }
function buildTransport(c, sid) {
  const s = G.S[sid]; if (!s || s.owner !== c.tag || !MAP.stats[sid].provs.some(p => MAP.provs[p].port)) return {ok: false, msg: 'Elige un estado propio con puerto.'};
  const cost = transportCost(c); if (c.treasury < cost) return {ok: false, msg: 'No tienes fondos para un transporte.'};
  c.treasury -= cost; G.shipQ = G.shipQ || []; G.shipQ.push({tag: c.tag, state: sid, days: TRANSPORT_DAYS});
  return {ok: true, msg: `Transporte en construcción en ${s.name} (${TRANSPORT_DAYS} días).`};
}
function portProvOf(sid) { const ps = MAP.stats[sid].provs.filter(p => MAP.provs[p].port); return ps.length ? ps[0] : null; }
// ¿puede desembarcar el ejército en la provincia destino?
function landingTargetOk(tag, pid) {
  const p = MAP.provs[pid]; if (!p.port) return 'Solo se puede desembarcar en provincias costeras.';
  const o = provOwner(pid);
  if (o === tag || sameSide(tag, o)) return null;
  if (o === NONE || hostileTags(tag, o)) return null;
  return 'Solo puedes desembarcar en costas enemigas, sin dueño o aliadas.';
}
function createLanding(tag, armyIds, to) {
  G.landings = G.landings || []; G.nextLand = G.nextLand || 1;
  const arms = armyIds.map(armyById).filter(a => a && a.tag === tag);
  if (!arms.length) return {ok: false, msg: 'Selecciona al menos un ejército.'};
  const err = landingTargetOk(tag, to); if (err) return {ok: false, msg: err};
  const from = arms[0].loc; if (!MAP.provs[from].port || !controlled(tag, from)) return {ok: false, msg: 'Los ejércitos deben estar en una provincia con puerto propio.'};
  if (provDist(from, to) > LAND_RANGE) return {ok: false, msg: 'El destino está demasiado lejos para los transportes.'};
  const divs = arms.reduce((n, a) => n + a.divs.length, 0), need = Math.ceil(divs / TRANSPORT_CAP);
  const L = {id: G.nextLand++, tag, armies: arms.map(a => a.id), from, to, phase: 'prep', prep: 0, active: false, need, auto: true};
  G.landings.push(L); arms.forEach(a => { a.landing = L.id; a.joinTo = null; a.front = null; });
  return {ok: true, land: L, need};
}
function cancelLanding(L) {
  (G.landings || []).forEach(x => { if (x === L) x.cancel = true; });
  L.armies.forEach(id => { const a = armyById(id); if (a && a.landing === L.id && !a.sea) a.landing = null; });
  G.landings = G.landings.filter(x => x !== L);
}
function startLanding(L) {   // embarca y zarpa
  const c = G.C[L.tag], arms = L.armies.map(armyById).filter(a => a && a.loc === L.from && !a.battle);
  if (!arms.length) return {ok: false, msg: 'Ningún ejército está en el puerto de embarque.'};
  const divs = arms.reduce((n, a) => n + a.divs.length, 0), need = Math.ceil(divs / TRANSPORT_CAP);
  if (freeTransports(c) < need) return {ok: false, msg: `Faltan transportes: necesitas ${need} y hay ${freeTransports(c)} libres.`};
  shipsOf(c).busy += need;
  const days = Math.ceil(provDist(L.from, L.to) * 4 + 5);
  arms.forEach(a => { a.sea = {plan: L.id, from: L.from, to: L.to, left: days, total: days}; a.path = []; a.dest = null; a.mode = null; });
  L.phase = 'sea'; L.left = days; L.carried = arms.map(a => a.id); L.need = need; L.active = true;
  G.shipReturns = G.shipReturns || []; G.shipReturns.push({tag: L.tag, n: need, days: days * 2 + 2});
  if (L.tag === G.player) notify('war', `Los transportes zarpan hacia ${provName(L.to)} (${days} días).`, provState(L.to));
  return {ok: true};
}
function landingDay() {
  const q = G.shipQ || [];
  for (let i = q.length - 1; i >= 0; i--) { if (--q[i].days <= 0) { const c = G.C[q[i].tag]; if (c && c.states.length) { shipsOf(c).transport++; if (c.tag === G.player) notify('build', `Un transporte ha sido botado en ${G.S[q[i].state].name}.`); } q.splice(i, 1); } }
  const rt = G.shipReturns || [];
  for (let i = rt.length - 1; i >= 0; i--) { if (--rt[i].days <= 0) { const c = G.C[rt[i].tag]; if (c) shipsOf(c).busy = Math.max(0, shipsOf(c).busy - rt[i].n); rt.splice(i, 1); } }
  (G.landings || []).slice().forEach(L => {
    const c = G.C[L.tag]; if (!c || !c.states.length) { G.landings = G.landings.filter(x => x !== L); return; }
    L.armies = L.armies.filter(id => armyById(id));
    if (L.phase === 'prep') {
      if (!L.active) return;
      const arms = L.armies.map(armyById);
      arms.forEach(a => { if (a.loc !== L.from && !a.path.length && !a.battle && !a.sea) { const r = orderMove(a, L.from, true); if (!r.ok) L.armies = L.armies.filter(x => x !== a.id); } else if (a.loc === L.from && !a.path.length && a.mode !== 'dig') a.mode = 'hold'; });
      if (arms.some(a => a.loc === L.from)) L.prep++;
      if (L.prep >= LAND_PREP && arms.filter(a => a.loc === L.from).length >= Math.max(1, Math.ceil(arms.length * 0.6))) {
        const r = startLanding(L); if (!r.ok) { if (L.tag === G.player && L.prep % 15 === 8) notify('war', `Desembarco en ${provName(L.to)}: ${r.msg}`); }
      }
    } else if (L.phase === 'sea') {
      let any = false;
      L.carried.forEach(id => { const a = armyById(id); if (!a || !a.sea) return; any = true; if (--a.sea.left <= 0) landArmy(a, L); });
      if (!any) { G.landings = G.landings.filter(x => x !== L); }
    }
  });
}
function landArmy(a, L) {
  const to = a.sea.to; a.sea = null; a.landing = null; a.loc = to; a.from = null; a.arrived = G.date.t; a.landed = G.date.t; a.rest = 0; a.dig = 0; a.mode = null;
  a.divs.forEach(d => { d.o *= 0.55; });
  G.beach = G.beach || {}; (G.beach[a.tag] = G.beach[a.tag] || {})[to] = G.date.t + 45;
  if (a.tag === G.player || provOwner(to) === G.player) notify('war', `¡${a.name} desembarca en ${provName(to)}!`, provState(to));
  else logMsg(`${G.C[a.tag].name} desembarca en ${provName(to)}.`);
}
// cabezas de playa: suministro por mar durante 45 días
function beachSupply(tag) { const b = G.beach && G.beach[tag], out = []; if (!b) return out; for (const pid in b) { if (b[pid] > G.date.t) out.push(+pid); else delete b[pid]; } return out; }
function aiLanding(c) {
  if (!c.ai || !c.wars.length || (G.landings || []).some(l => l.tag === c.tag)) return;
  const enemies = G.tags.filter(o => hostileTags(c.tag, o) && alive(o)); if (!enemies.length) return;
  const idle = armiesOf(c.tag).filter(a => !a.battle && !a.path.length && !a.sea && MAP.provs[a.loc].port && controlled(c.tag, a.loc) && a.divs.length >= 3);
  if (!idle.length) return;
  // provincias enemigas costeras a las que no se llega por tierra
  const land = new Set(); armiesOf(c.tag).forEach(a => { const q = [a.loc]; land.add(a.loc); for (let i = 0; i < q.length && i < 900; i++) MAP.provs[q[i]].nb.forEach(n => { if (!land.has(n) && canEnter(c.tag, n)) { land.add(n); q.push(n); } }); });
  const src = idle[0]; let best = null, bd = 1e9;
  enemies.forEach(e => G.C[e].states.forEach(sid => MAP.stats[sid].provs.forEach(p => { if (!MAP.provs[p].port || land.has(p) || G.P[p].by) return; const d = provDist(src.loc, p); if (d < bd && d <= LAND_RANGE) { bd = d; best = p; } })));
  if (best === null) return;
  const need = Math.ceil(src.divs.length / TRANSPORT_CAP);
  if (freeTransports(c) < need) { if ((G.shipQ || []).filter(q => q.tag === c.tag).length < 2 && c.treasury > transportCost(c) * 2) { const ps = portStates(c); if (ps.length) buildTransport(c, pick(ps)); } return; }
  const r = createLanding(c.tag, [src.id], best); if (r.ok) r.land.active = true;
}
function aiLandingWeek() { G.tags.forEach(t => { if (t !== NONE) aiLanding(G.C[t]); }); }

/* ---------- interfaz ---------- */
function landingsHtml() {
  const c = me(), ships = shipsOf(c), mine = (G.landings || []).filter(l => l.tag === G.player), ps = portStates(c).slice(0, 8);
  return `<div class="card"><h3>⚓ Planes de desembarco</h3><p class="hint">Selecciona un ejército que esté en una provincia con puerto y pulsa <b>⚓ Desembarco</b>; luego haz clic en una costa enemiga, una isla o una costa sin dueño. Los ejércitos se concentran en el puerto, embarcan en los <b>transportes</b> y desembarcan algo desorganizados (−45% organización y −25% de ataque durante 6 días). Sin puerto propio cerca recibirán suministro por mar solo 45 días.</p>
    ${mine.length ? mine.map(l => { const arms = l.armies.map(armyById).filter(Boolean); return `<div class="card front attack"><div class="kv"><b>⚓ ${provName(l.from)} ➜ ${provName(l.to)}</b>${l.phase === 'sea' ? `<span class="tag">⛴ En el mar · ${l.left} d</span>` : l.active ? `<span class="tag warn">⏳ Preparando ${l.prep}/${LAND_PREP} d</span>` : '<span class="tag">⏸ Sin activar</span>'}</div>
      <div class="kv sm"><span>Ejércitos</span><b>${arms.length} · ${arms.reduce((n, a) => n + a.divs.length, 0)} div. · ${l.need || Math.ceil(arms.reduce((n, a) => n + a.divs.length, 0) / TRANSPORT_CAP)} transportes</b></div>
      <div class="btnrow">${l.phase === 'prep' ? `<button data-act="landgo" data-id="${l.id}" class="${l.active ? '' : 'primary'}">${l.active ? '⏸ Pausar' : '▶ Activar plan'}</button>` : ''}<button data-act="landfocus" data-id="${l.id}">📍 Destino</button>${l.phase === 'prep' ? `<button data-act="landdel" data-id="${l.id}">✖ Cancelar</button>` : ''}</div></div>`; }).join('') : '<small class="dim">No hay desembarcos planeados.</small>'}</div>
  <div class="card"><h3>Transportes</h3><div class="kv"><span>Flota de transporte</span><b>${ships.transport} (${freeTransports(c)} libres) · capacidad ${TRANSPORT_CAP} div. cada uno</b></div><div class="kv sm"><span>En construcción</span><b>${(G.shipQ || []).filter(q => q.tag === G.player).length}</b></div>
    ${ps.length ? ps.map(id => `<div class="kv sm"><span>${G.S[id].name}</span><button data-act="buildship" data-id="${id}" ${c.treasury < transportCost(c) ? 'disabled' : ''}>＋ Transporte (${money(transportCost(c))})</button></div>`).join('') : '<small class="dim">No tienes estados con puerto.</small>'}</div>`;
}
Object.assign(ACT, {
  landmode: () => { const a = armyById(UI.selArmy); if (!a || !MAP.provs[a.loc].port) { toast('⚠️', 'El ejército debe estar en una provincia con puerto.'); return; } UI.landNext = !UI.landNext; UI.moveMode = UI.patrolNext = false; document.body.classList.toggle('movemode', UI.landNext); if (UI.landNext) toast('⚓', 'Haz clic en la costa de destino (enemiga, isla o sin dueño).'); renderArmyPanel(); },
  landgo: d => { const L = (G.landings || []).find(x => x.id === +d.id); if (L) { L.active = !L.active; renderWindow(); } },
  landdel: d => { const L = (G.landings || []).find(x => x.id === +d.id); if (L) { cancelLanding(L); renderWindow(); R.labelsDirty = true; } },
  landfocus: d => { const L = (G.landings || []).find(x => x.id === +d.id); if (L) focusProv(L.to, 35); },
  buildship: d => { const r = buildTransport(me(), +d.id); toast(r.ok ? '⚓' : '⚠️', r.msg); renderWindow(); }
});
function landClick(pid) {
  UI.landNext = false; document.body.classList.remove('movemode');
  const list = selectedArmies(); const r = createLanding(G.player, list.map(a => a.id), pid);
  if (!r.ok) { toast('⚠️', r.msg); renderArmyPanel(); return; }
  toast('⚓', `Plan de desembarco creado en ${provName(pid)}: ${r.need} transportes. Actívalo en Ejército → Frentes.`);
  UI.winTab.mil = 'fronts'; UI.win = null; openWindow('military'); R.labelsDirty = true;
}
