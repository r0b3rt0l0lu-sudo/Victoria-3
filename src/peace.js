/* ===== CONFERENCIAS DE PAZ: el vencedor gasta su puntuación de guerra en exigencias ===== */
const LAW_DEMANDS = {
  army: {cat: 'army', opt: 'peasant_levies', name: 'Ejército de levas campesinas (sin ejército profesional)'},
  economy: {cat: 'economy', opt: 'laissez', name: 'Apertura de mercados (laissez-faire)'},
  press: {cat: 'press', opt: 'censorship', name: 'Régimen de censura'}
};
function buildConference(w, winner) {
  const att = winner === w.att, winAll = (att ? w.attAll : w.defAll).slice(), loseAll = (att ? w.defAll : w.attAll).slice(), loseLead = att ? w.def : w.att;
  const budget = clamp(Math.abs(w.score), 30, 100), opts = [];
  G.S.forEach(s => {
    if (!loseAll.includes(s.owner)) return;
    const occ = s.occ && s.occBy && winAll.includes(s.occBy) ? s.occ : 0, target = att && w.targets.includes(s.id);
    if (occ < 0.2 && !target) return;
    const pop = popTotal(s);
    let cost = 4 + Math.sqrt(pop / 1e5) * 2.4;
    cost *= occ >= 0.5 ? 1 : occ > 0 ? 1.5 : 2.4;
    if (target) cost *= 0.5;
    if (G.C[s.owner].capital === s.id) cost *= 1.5;
    opts.push({id: 's' + s.id, type: 'state', sid: s.id, cost: Math.round(clamp(cost, 4, 40)), occ, target, pop});
  });
  opts.sort((a, b) => b.pop - a.pop); opts.length = Math.min(opts.length, 22);
  const L = G.C[loseLead], W = G.C[winner];
  opts.push({id: 'reps8', type: 'reps', weeks: 8, cost: 10}, {id: 'reps16', type: 'reps', weeks: 16, cost: 20});
  opts.push({id: 'humil', type: 'humil', cost: 12}, {id: 'trade', type: 'trade', cost: 12}, {id: 'demil', type: 'demil', cost: 15});
  Object.keys(LAW_DEMANDS).forEach(k => { if (L.laws[LAW_DEMANDS[k].cat] !== LAW_DEMANDS[k].opt) opts.push({id: 'law_' + k, type: 'law', key: k, cost: 20}); });
  if (!L.overlord && !W.overlord && L.stats.pop < W.stats.pop * 1.5) opts.push({id: 'vassal', type: 'vassal', cost: 45});
  return {w, winner, winAll, loseAll, loseLead, budget, opts, pick: new Set(), recip: {}};
}
const confSpent = c => c.opts.reduce((n, o) => n + (c.pick.has(o.id) ? o.cost : 0), 0);
function confLabel(c, o) {
  const W = G.C[c.winner], L = G.C[c.loseLead];
  if (o.type === 'state') return `Anexionar ${G.S[o.sid].name}`;
  if (o.type === 'reps') return `Reparaciones de guerra (${o.weeks} semanas de ingresos de ${L.name})`;
  if (o.type === 'humil') return `Humillar a ${L.name}: −12 prestigio para ellos, +12 para ti`;
  if (o.type === 'trade') return `Concesiones comerciales: pacto de comercio forzoso y pérdida de ingresos aduaneros`;
  if (o.type === 'demil') return `Desmilitarización: ${L.name} licencia el 60% de su ejército`;
  if (o.type === 'law') return `Imponer ley: ${LAW_DEMANDS[o.key].name}`;
  if (o.type === 'vassal') return `Convertir a ${L.name} en tu vasallo`;
  void W; return o.id;
}
// elección automática de la IA: objetivos de guerra primero, luego territorios más valiosos, luego dinero y prestigio
function aiPickDemands(c) {
  let left = c.budget;
  const val = o => o.type === 'state' ? (o.target ? 3 : 1.2) * (o.pop / 1e6 + 0.5) / o.cost * 10 : o.type === 'reps' ? 0.9 : o.type === 'humil' ? 0.7 : o.type === 'vassal' ? 0.5 : o.type === 'demil' ? 0.4 : o.type === 'trade' ? 0.3 : 0.1;
  c.opts.slice().sort((a, b) => val(b) - val(a)).forEach(o => {
    if (o.cost > left) return; if (o.type === 'reps' && c.pick.has('reps8') && o.id === 'reps16') return; if (o.type === 'law') return;
    if (o.type === 'vassal' && c.pick.size) return;
    c.pick.add(o.id); left -= o.cost;
    if (o.type === 'state') { const L = c.winAll.filter(t => t !== c.winner && alive(t)); c.recip[o.sid] = L.length && Math.random() < 0.18 ? pick(L) : c.winner; }
  });
}
function applyConference(c) {
  const w = c.w, W = G.C[c.winner], L = G.C[c.loseLead], gained = [], notes = [];
  c.opts.forEach(o => {
    if (!c.pick.has(o.id)) return;
    if (o.type === 'state') { const s = G.S[o.sid]; if (!loseAllHas(c, s.owner)) return; const r = c.recip[o.sid] || c.winner; transferState(s, r); gained.push(s.name + (r !== c.winner ? ` (para ${G.C[r].name})` : '')); }
    else if (o.type === 'reps') { const ind = Math.min(Math.max(0, L.treasury), L.stats.income * o.weeks); L.treasury -= ind; W.treasury += ind; notes.push(`reparaciones de ${money(ind)}`); }
    else if (o.type === 'humil') { W.prestige += 12; L.prestige = Math.max(0, L.prestige - 12); cnt(W, 'humiliations'); notes.push('humillación'); }
    else if (o.type === 'trade') { L.tradeLoss = Math.min(0.25, (L.tradeLoss || 0) + 0.06); makePact('trade', c.winner, c.loseLead, {forced: true}); notes.push('concesiones comerciales'); }
    else if (o.type === 'demil') { G.armies.forEach(a => { if (a.tag === c.loseLead) { a.divs = a.divs.slice(0, Math.ceil(a.divs.length * 0.4)); } }); G.armies = G.armies.filter(a => a.divs.length); L.mob = 0; notes.push('desmilitarización'); }
    else if (o.type === 'law') { const d = LAW_DEMANDS[o.key]; L.laws[d.cat] = d.opt; recalcMods(L); L.legitimacy -= 10; L.radicals = Math.min(0.9, L.radicals + 0.06); notes.push('ley impuesta'); }
    else if (o.type === 'vassal') { makeSubject(c.winner, c.loseLead); cnt(W, 'vassalsMade'); notes.push('vasallaje'); }
  });
  const att = c.winner === w.att;
  W.prestige += 6 + gained.length * 4; cnt(W, 'statesGained', gained.length); cnt(W, 'warsWon'); if (!att) cnt(W, 'defended');
  L.prestige = Math.max(0, L.prestige - 8); L.legitimacy -= 4; L.wear = Math.max(0, (L.wear || 0) - 20);
  c.winAll.forEach(t => { if (t !== c.winner && alive(t)) G.C[t].prestige += 3; });
  addRel(c.winner, c.loseLead, att ? 20 : 10);
  const txt = att ? `${W.name} vence a ${L.name}` : `${W.name} repele la invasión de ${L.name}`;
  notify('war', `Conferencia de paz: ${txt}${gained.length ? ' y se anexiona ' + gained.join(', ') : ''}${notes.length ? '. Además: ' + notes.join(', ') : ''}.`, c.pick.size && gained.length ? c.opts.find(o => o.type === 'state' && c.pick.has(o.id)).sid : undefined);
  G.tags.forEach(t => { if (t !== NONE) G.C[t].legitimacy = clamp(G.C[t].legitimacy, 0, 100); });
  recalcHostile(); evacuateForeignArmies(); if (typeof fullRepaint === 'function' && gained.length) fullRepaint();
}
const loseAllHas = (c, tag) => c.loseAll.includes(tag);
function endWar(w, winner) {
  const idx = G.wars.indexOf(w); if (idx >= 0) G.wars.splice(idx, 1);
  const conf = winner !== null && !w.auto ? buildConference(w, winner) : null;      // antes de borrar las ocupaciones
  clearOccupationKeep(w);
  w.attAll.concat(w.defAll).forEach(t => { const c = G.C[t]; c.wars = c.wars.filter(x => x !== w.id); });
  const A = G.C[w.att], D = G.C[w.def];
  if (winner === null) { notify('war', `${A.name} y ${D.name} firman una paz blanca.`); addRel(w.att, w.def, 25); return; }
  if (w.auto) { settleLegacy(w, winner); return; }
  const humanLead = !G.C[winner].ai && typeof openConference === 'function' && !G.headless;
  if (humanLead) { G.confQueue = G.confQueue || []; G.confQueue.push(conf); if (!G.conf) nextConference(); }
  else { aiPickDemands(conf); applyConference(conf); }
}
function nextConference() {
  G.conf = (G.confQueue || []).shift() || null;
  if (G.conf) { G.paused = true; openConference(); } else closeConference();
}
function settleLegacy(w, winner) {
  const A = G.C[w.att], D = G.C[w.def];
  const attWins = winner === w.att;
  const cb = CBS[w.cb];
  const occ = {};
  if (attWins) {
    const full = Math.abs(w.score) >= 85;
    let gained = [];
    if (cb.terr) {
      w.targets.forEach(sid => { const s = G.S[sid]; if (s && s.owner === w.def && (full || (s.occ || 0) >= 0.5 || w.score >= 60)) { transferState(s, w.att); gained.push(s.name); } });
      A.prestige += 6 + gained.length * 4; cnt(A, 'statesGained', gained.length);
    } else if (w.cb === 'humiliate') {
      const ind = Math.min(Math.max(0, D.treasury), D.stats.income * 8); D.treasury -= ind; A.treasury += ind;
      A.prestige += 12; D.prestige = Math.max(0, D.prestige - 12);
    } else if (w.cb === 'regime' && w.law) {
      D.laws[w.law.cat] = w.law.opt; recalcMods(D); D.legitimacy -= 12; D.radicals = Math.min(0.9, D.radicals + 0.08); A.prestige += 8;
    } else if (w.cb === 'trade') {
      const ind = Math.min(Math.max(0, D.treasury), D.stats.income * 5); D.treasury -= ind; A.treasury += ind;
      D.tradeLoss = Math.min(0.25, (D.tradeLoss || 0) + 0.06); makePact('trade', w.att, w.def, {forced: true}); A.prestige += 8;
    } else if (w.cb === 'vassal') {
      makeSubject(w.att, w.def); A.prestige += 15; cnt(A, 'vassalsMade');
    }
    D.prestige = Math.max(0, D.prestige - 8); D.legitimacy -= 4; cnt(A, 'warsWon'); if (w.cb === 'humiliate') cnt(A, 'humiliations');
    notify('war', `${A.name} ha vencido a ${D.name}${gained.length ? ' y se anexiona ' + gained.join(', ') : ' (' + cb.name + ')'}.`, w.targets[0]);
    // aliados del vencedor ganan prestigio
    w.attAll.forEach(t => { if (t !== w.att) G.C[t].prestige += 3; });
    addRel(w.att, w.def, 20);
  } else {
    const ind = Math.min(Math.max(0, A.treasury), A.stats.income * 4); A.treasury -= ind; D.treasury += ind;
    D.prestige += 8; A.prestige = Math.max(0, A.prestige - 10); A.legitimacy -= 5;
    const regained = [];
    G.S.filter(s => s.owner === w.att && (s.occ || 0) >= 0.5 && w.defAll.includes(s.occBy)).sort((x, y) => y.popBase - x.popBase).slice(0, 3).forEach(s => { transferState(s, w.def); regained.push(s.name); });
    notify('war', `${D.name} ha repelido la invasión de ${A.name}${regained.length ? ' y se anexiona ' + regained.join(', ') : ''}.`, w.cTargets[0] ?? w.targets[0]);
    addRel(w.att, w.def, 10); cnt(D, 'defended'); cnt(D, 'warsWon'); cnt(D, 'statesGained', regained.length);
  }
  G.tags.forEach(t => { if (t !== NONE) G.C[t].legitimacy = clamp(G.C[t].legitimacy, 0, 100); });
  recalcHostile(); evacuateForeignArmies();
}

/* ---------- ventana de la conferencia ---------- */
function openConference() { renderConference(); }
function closeConference() { const r = $('#confdlg'); if (r) { r.classList.remove('open'); r.innerHTML = ''; } }
function renderConference() {
  const c = G.conf, root = $('#confdlg'); if (!root) return; if (!c) { closeConference(); return; }
  const W = G.C[c.winner], L = G.C[c.loseLead], w = c.w, spent = confSpent(c), left = c.budget - spent;
  const states = c.opts.filter(o => o.type === 'state'), others = c.opts.filter(o => o.type !== 'state');
  const row = o => `<label class="cfrow ${c.pick.has(o.id) ? 'on' : ''}"><input type="checkbox" data-act="confpick" data-id="${o.id}" ${c.pick.has(o.id) ? 'checked' : ''} ${!c.pick.has(o.id) && o.cost > left ? 'disabled' : ''}>
    <span class="cfl">${confLabel(c, o)}${o.type === 'state' ? `<small class="dim"> · ${fmtN(o.pop, 1)} hab. · ${o.target ? '🎯 objetivo de guerra · ' : ''}${o.occ >= 0.5 ? 'ocupado' : o.occ > 0 ? 'ocupado en parte' : 'sin ocupar (más caro)'}</small>` : ''}</span>
    ${o.type === 'state' && c.pick.has(o.id) && c.winAll.filter(t => t !== c.winner && alive(t)).length ? `<select data-act="confrecip" data-id="${o.sid}"><option value="${c.winner}">Para mí</option>${c.winAll.filter(t => t !== c.winner && alive(t)).map(t => `<option value="${t}" ${c.recip[o.sid] === t ? 'selected' : ''}>Para ${G.C[t].name}</option>`).join('')}</select>` : ''}
    <b class="cfc">${o.cost} pts</b></label>`;
  root.classList.add('open');
  root.innerHTML = `<div class="wd"><div class="whead"><span class="wicon">🕊️</span><h2>Conferencia de paz — ${w.name || CBS[w.cb].name}</h2></div>
  <div class="wd-body"><div class="cols"><div class="col wide">
    <div class="notice">${flag(c.winner, 'sm')} <b>${W.name}</b> ha vencido a ${flag(c.loseLead, 'sm')} <b>${L.name}</b>. Gasta tus <b>puntos de guerra</b> en las exigencias que quieras.</div>
    <h4 class="sub">Territorios</h4>${states.length ? states.map(row).join('') : '<p class="hint">No hay territorios ocupados que reclamar.</p>'}
    <h4 class="sub">Otras exigencias</h4>${others.map(row).join('')}
  </div><div class="col">
    <div class="card"><h3>Puntos de guerra</h3><div class="kv"><span>Disponibles</span><b>${c.budget}</b></div><div class="kv"><span>Gastados</span><b>${spent}</b></div><div class="kv"><span>Restantes</span><b class="${left < 0 ? 'bad' : 'good'}">${left}</b></div>${bar(spent, c.budget, left < 0 ? 'bad' : 'warn')}
    <p class="hint">La puntuación de la guerra (${Math.round(Math.abs(w.score))}) fija el presupuesto. Los territorios ocupados y los objetivos de guerra son más baratos.</p>
    <div class="btnrow"><button class="primary" data-act="confsign" ${left < 0 ? 'disabled' : ''}>✍️ Firmar la paz${c.pick.size ? '' : ' (sin exigencias)'}</button></div></div>
    <div class="card"><h3>Aliados en el bando vencedor</h3>${c.winAll.filter(t => t !== c.winner).map(t => `<div class="kv sm"><span>${flag(t, 'sm')} ${G.C[t].name}</span></div>`).join('') || '<small class="dim">Ninguno.</small>'}<p class="hint">Puedes ceder territorios a tus aliados para ganar su favor.</p></div>
  </div></div></div></div>`;
}
Object.assign(ACT, {
  confpick: (d, el) => { const c = G.conf; if (!c) return; if (el.checked) c.pick.add(d.id); else c.pick.delete(d.id); renderConference(); },
  confrecip: (d, el) => { if (G.conf) G.conf.recip[+d.id] = el.value; },
  confsign: () => { const c = G.conf; if (!c || confSpent(c) > c.budget) return; applyConference(c); G.conf = null; nextConference(); if (!G.conf) { G.paused = false; updateHud(); } renderWindow && renderWindow(); }
});
