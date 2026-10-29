/* ===== COALICIONES CONTRA EL EXPANSIONISMO: las potencias se alían para frenar a quien acumula infamia o conquistas ===== */
const threatOf = c => c.infamy * 0.7 + (c.exp || 0) * 2;
const coalitionOf = tag => (G.coals || []).find(x => x.target === tag);
const inCoalition = tag => (G.coals || []).find(x => x.members.includes(tag));
function coalCandidate(tag, target) {
  if (!alive(tag) || tag === target || G.C[tag].overlord || G.C[target].overlord === tag || (G.C[target].subjects || []).includes(tag)) return false;
  if (G.C[tag].bloc && G.C[tag].bloc === G.C[target].bloc) return false;
  if (anyPactBetween(tag, target, ['alliance', 'guarantee'])) return false;
  if (!G.C[tag].ai && tag !== G.player) return false;
  return true;
}
function coalPower(list) { return crisisPower(list); }
function createCoalition(target) {
  const T = G.C[target], tp = armyPower(T) + allies(target).reduce((n, t) => n + (alive(t) ? armyPower(G.C[t]) : 0), 0);
  const cand = G.tags.filter(t => t !== NONE && G.C[t].ai && coalCandidate(t, target) && G.C[t].rank <= 22)
    .map(t => ({t, w: (relOf(t, target) < 25 ? 1.5 : 0.5) * (minDist(G.C[t], T).min < 50 ? 1.6 : 0.6) * (1 + G.C[t].rank <= 8 ? 1.3 : 1) * (0.6 + Math.random())}))
    .sort((a, b) => b.w - a.w).slice(0, 6);
  const members = cand.map(x => x.t); if (members.length < 3) return null;
  if (coalPower(members) < tp * 0.45) return null;
  const leader = members.slice().sort((a, b) => armyPower(G.C[b]) - armyPower(G.C[a]))[0];
  G.coals = G.coals || []; G.nextCoal = G.nextCoal || 1;
  const co = {id: G.nextCoal++, target, leader, members, age: 0};
  G.coals.push(co);
  const names = members.map(t => G.C[t].name).join(', ');
  if (target === G.player) notify('diplo', `¡Se forma una coalición contra ti! ${G.C[leader].name} lidera a ${names} para frenar tu expansión. Revisa Diplomacia → Coaliciones.`, G.C[leader].capital);
  else logMsg(`Coalición contra ${T.name}, liderada por ${G.C[leader].name} (${names}).`);
  return co;
}
function dissolveCoalition(co, why) {
  G.coals = G.coals.filter(x => x !== co);
  if (co.target === G.player) notify('diplo', `La coalición contra ti se disuelve${why ? ' (' + why + ')' : ''}.`);
}
function coalitionsMonth() {
  G.coals = G.coals || []; aiBullyPlayer();
  G.tags.forEach(t => { if (t !== NONE) { const c = G.C[t]; c.exp = (c.exp || 0) * 0.97; } });
  G.tags.forEach(t => {
    if (t === NONE || !alive(t)) return; const c = G.C[t], th = threatOf(c), co = coalitionOf(t);
    if (!co) { if (th >= 32 && Math.random() < clamp((th - 30) / 110, 0, 0.35)) createCoalition(t); return; }
    co.age++;
    // salen miembros reconciliados o muertos
    co.members = co.members.filter(m => alive(m) && !anyPactBetween(m, t, ['alliance', 'guarantee']) && relOf(m, t) < 48 && !(th < 18 && Math.random() < 0.2));
    // entran nuevos
    if (co.members.length < 8 && th > 28) { const cand = G.tags.filter(x => x !== NONE && !co.members.includes(x) && G.C[x].ai && G.C[x].rank <= 24 && coalCandidate(x, t) && relOf(x, t) < 30 && minDist(G.C[x], c).min < 60); if (cand.length && Math.random() < clamp((th - 26) / 140, 0, 0.3)) { const x = pick(cand); co.members.push(x); if (t === G.player) notify('diplo', `${G.C[x].name} se une a la coalición contra ti.`); } }
    if (!alive(co.leader) || !co.members.includes(co.leader)) co.leader = co.members.slice().sort((a, b) => armyPower(G.C[b]) - armyPower(G.C[a]))[0];
    if (co.members.length < 2 || (th < 14 && co.age > 12)) { dissolveCoalition(co, th < 14 ? 'ya no representas una amenaza' : 'quedan pocos miembros'); return; }
    // presión diplomática
    co.members.forEach(m => { addRel(m, t, -1.5); co.members.forEach(n => { if (m < n) addRel(m, n, 0.4); }); });
    // la IA líder presiona con una crisis diplomática cuando se siente fuerte
    const L = G.C[co.leader];
    if (L && L.ai && !crisisOf(co.leader) && !crisisOf(t) && !L.wars.length && !c.wars.some(wid => { const w = G.wars.find(x => x.id === wid); return w && w.attAll.concat(w.defAll).includes(co.leader); })) {
      const tp = armyPower(c) + allies(t).reduce((n, x) => n + (alive(x) ? armyPower(G.C[x]) : 0), 0), mp = coalPower(co.members);
      if (mp >= tp * 0.85 && th > 34 && Math.random() < 0.1 * diffP().crisis) coalitionStrike(co);
    }
  });
}
// grandes potencias hostiles intimidan al jugador si es mucho más débil
function aiBullyPlayer() {
  const P = G.C[G.player]; if (!P || crisisOf(G.player) || P.wars.length) return;
  const pp = armyPower(P) + allies(G.player).reduce((n, t) => n + (alive(t) ? armyPower(G.C[t]) : 0), 0);
  G.tags.forEach(t => {
    if (t === NONE || t === G.player || !alive(t) || crisisOf(G.player)) return; const A = G.C[t];
    if (!A.ai || A.rank > 12 || A.wars.length || A.overlord || crisisOf(t) || relOf(t, G.player) > 15) return;
    if (armyPower(A) < pp * 1.6 || !canReach(t, G.player) || anyPactBetween(t, G.player, ['alliance', 'guarantee', 'nonagg'])) return;
    if (Math.random() > 0.012 * diffP().crisis * (1 + threatOf(P) / 40)) return;
    const cb = ['claim', 'humiliate', 'trade'].find(k => cbAvailable(t, G.player, k).ok); if (!cb) return;
    const targets = CBS[cb].terr ? claimedStates(A, G.player).slice(0, 2).map(x => x.id) : [];
    const r = openCrisis(t, G.player, cb, targets, {free: true, ai: true});
    if (r.ok) notify('diplo', `${A.name}, más fuerte que tú, te presiona con una crisis diplomática (${CBS[cb].name.toLowerCase()}). Elige en Diplomacia → Crisis.`, A.capital);
  });
}
function coalitionStrike(co) {
  const L = co.leader, T = co.target, A = G.C[L];
  const cbs = ['claim', 'humiliate', 'trade', 'conquest'].filter(k => cbAvailable(L, T, k).ok && !(k === 'conquest' && A.influence < 0));
  if (!cbs.length || !canReach(L, T)) return;
  const cb = cbs[0]; let targets = [];
  if (CBS[cb].terr) targets = (cb === 'claim' ? claimedStates(A, T) : reachableStates(L, T)).slice(0, 2).map(x => x.id);
  const r = openCrisis(L, T, cb, targets, {free: true, ai: true}); if (!r.ok) return;
  co.members.forEach(m => { if (m !== L) crisisJoin(r.crisis, m, 'att', 'coalición'); });
  if (T === G.player) notify('diplo', `La coalición liderada por ${A.name} te exige ${CBS[cb].name.toLowerCase()}. ¡Elige en Diplomacia → Crisis: ceder o resistir!`, G.C[L].capital);
}
// los miembros acuden a frenar al país amenazante cuando está en guerra (o a defender a sus víctimas)
function coalitionCall(w) {
  [[w.att, 'def'], [w.def, 'att']].forEach(([tg, side]) => {
    const co = coalitionOf(tg); if (!co) return;
    co.members.forEach(m => {
      if (!alive(m) || w.attAll.includes(m) || w.defAll.includes(m) || G.C[m].wars.length >= 2) return;
      const mine = side === 'def' ? w.defAll : w.attAll;
      if (mine.some(x => anyPactBetween(m, x, ['alliance'])) && false) return;
      if (Math.random() < 0.85) { mine.push(m); G.C[m].wars.push(w.id); if (m === G.player) notify('war', 'Tu país entra en la guerra para frenar a ' + G.C[tg].name + '.'); else logMsg(`${G.C[m].name} acude desde la coalición contra ${G.C[tg].name}.`); }
    });
  });
}
function coalitionsHtml() {
  const mine = (G.coals || []).filter(x => x.target === G.player), others = (G.coals || []).filter(x => x.target !== G.player), c = me();
  const th = threatOf(c);
  const power = list => fmtN(coalPower(list), 0);
  return `<div class="card"><h3>🛡️ Amenaza que representas</h3><div class="kv"><span>Infamia</span><b class="${c.infamy > 30 ? 'bad' : ''}">${Math.round(c.infamy)}</b></div><div class="kv"><span>Expansión reciente</span><b>${Math.round(c.exp || 0)}</b></div>
    <div class="kv"><span>Índice de amenaza</span><b class="${th > 32 ? 'bad' : th > 20 ? 'warn' : 'good'}">${Math.round(th)}</b></div>${bar(th, 60, th > 32 ? 'bad' : 'warn')}
    <p class="hint">Cuando tu infamia y tus conquistas recientes suben (índice > 32), las potencias vecinas pueden <b>formar una coalición</b> para frenarte: sus miembros se acercan entre sí, empeoran sus relaciones contigo, <b>acuden a defender a tus víctimas</b> y su líder puede <b>abrirte crisis diplomáticas</b>. La infamia baja 0,7 al mes; las conquistas se olvidan poco a poco.</p>
    <div class="btnrow"><button data-act="coalinf" ${c.influence < 40 || c.infamy < 3 ? 'disabled' : ''}>🕊️ Campaña de imagen: −12 infamia (40 infl.)</button></div></div>
  ${mine.length ? mine.map(co => `<div class="war"><div class="warh">🛡️ <b>Coalición contra ti</b> <small class="dim">· ${co.age} meses · lidera ${G.C[co.leader].name}</small></div>
    <div class="kv"><span>Fuerza militar de la coalición</span><b>${power(co.members)} (tú ${fmtN(armyPower(c), 0)})</b></div><div class="wbar"><b style="width:${clamp(coalPower(co.members) / Math.max(1, coalPower(co.members) + armyPower(c)), 0, 1) * 100}%"></b></div>
    <table class="tbl"><thead><tr><th>Miembro</th><th class="r">Relación</th><th class="r">Poder</th><th></th></tr></thead><tbody>${co.members.map(m => `<tr><td>${flag(m, 'sm')} ${G.C[m].name}${m === co.leader ? ' 👑' : ''}</td><td class="r">${Math.round(relOf(m, G.player))}</td><td class="r">${fmtN(armyPower(G.C[m]), 0)}</td><td class="r"><button data-act="coalapp" data-t="${m}" ${c.influence < 25 ? 'disabled' : ''}>🤝 Apaciguar (25 infl.)</button> <button data-act="coalbribe" data-t="${m}" ${c.treasury < c.stats.income * 10 ? 'disabled' : ''}>💰 Sobornar (${money(c.stats.income * 10)})</button></td></tr>`).join('')}</tbody></table></div>`).join('') : '<div class="card"><p class="hint">No hay coaliciones contra ti. ¡De momento!</p></div>'}
  <div class="card"><h3>Otras coaliciones en el mundo</h3>${others.length ? others.map(co => `<div class="kv sm"><span>Contra ${flag(co.target, 'sm')} ${G.C[co.target].name}: ${co.members.map(m => G.C[m].name).join(', ')}</span><b>${co.age} m.</b></div>`).join('') : '<small class="dim">Ninguna.</small>'}</div>`;
}
Object.assign(ACT, {
  coalinf: () => { const c = me(); if (c.influence >= 40) { c.influence -= 40; c.infamy = Math.max(0, c.infamy - 12); toast('🕊️', 'Campaña de imagen: baja tu infamia.'); } renderWindow(); },
  coalapp: d => { const c = me(); if (c.influence < 25) return; c.influence -= 25; addRel(G.player, d.t, 30); const co = coalitionOf(G.player); if (co && relOf(d.t, G.player) > 40 && Math.random() < 0.6) { co.members = co.members.filter(x => x !== d.t); toast('🤝', `${G.C[d.t].name} abandona la coalición.`); } else toast('🤝', `Mejoran las relaciones con ${G.C[d.t].name}.`); renderWindow(); },
  coalbribe: d => { const c = me(), cost = c.stats.income * 10; if (c.treasury < cost) return; c.treasury -= cost; const co = coalitionOf(G.player); if (co && Math.random() < 0.7) { co.members = co.members.filter(x => x !== d.t); toast('💰', `${G.C[d.t].name} acepta el soborno y abandona la coalición.`); } else toast('💰', `${G.C[d.t].name} cobra pero se queda en la coalición.`); renderWindow(); }
});
