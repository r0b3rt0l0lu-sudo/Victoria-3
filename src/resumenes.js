/* ===== RESÚMENES DE BATALLA Y DE GUERRA =====
   · Al terminar cada batalla se guarda un informe (bajas, divisiones y prisioneros, generales caídos, momentos clave, terreno y estrategias)
     que el panel de batalla muestra en cuanto acaba; las últimas batallas del jugador se pueden reabrir desde Ejército → Guerras.
   · Al terminar una guerra en la que participas aparece un informe con resultado, duración, batallas, bajas, prisioneros y ocupaciones. */
const fmtDays = d => d >= 60 ? `${Math.round(d / 30)} meses` : `${Math.round(d)} días`;

/* ---------- batalla ---------- */
function battleInit(b, A, B) { if (!b.d0) b.d0 = {A: A.reduce((n, a) => n + a.divs.length, 0), B: B.reduce((n, a) => n + a.divs.length, 0), mA: A.reduce((n, a) => n + armyMen(a), 0), mB: B.reduce((n, a) => n + armyMen(a), 0)}; }
function battleSummary(b, winner, win, lose) {
  const cnt = ids => ids.map(armyById).filter(Boolean).reduce((n, a) => n + a.divs.length, 0), men = ids => ids.map(armyById).filter(Boolean).reduce((n, a) => n + armyMen(a), 0);
  const mine = b.A.some(id => (armyById(id) || {}).tag === G.player) ? 'A' : b.B.some(id => (armyById(id) || {}).tag === G.player) ? 'B' : null;
  b.sum = {winner, tagW: winner === 'A' ? b.A0 : b.B0, tagL: winner === 'A' ? b.B0 : b.A0, days: b.day, lost: {A: Math.round(b.lostA || 0), B: Math.round(b.lostB || 0)}, d0: b.d0 || {A: 0, B: 0, mA: 0, mB: 0}, d1: {A: cnt(b.A), B: cnt(b.B)}, m1: {A: men(b.A), B: men(b.B)},
    pris: b.pris || {A: 0, B: 0}, gens: (b.gens || []).slice(), ev: (b.log || []).slice(-6), strat: {A: b.strA || 'frontal', B: b.strB || 'frontal'}, terr: typeof terrainInfo === 'function' ? terrainInfo(b) : [], mine, date: dateStr()};
  (G.endedList = G.endedList || []).unshift(b); if (G.endedList.length > 12) G.endedList.pop();
}
// acumula las bajas y batallas en la guerra a la que pertenece
function warBattleStat(w, attWon, b) {
  w.cas = w.cas || {att: 0, def: 0}; w.bat = (w.bat || 0) + 1;
  const lostA = Math.round(b.lostA || 0), lostB = Math.round(b.lostB || 0);       // A = atacante de la batalla
  const sideOfA = w.attAll.includes((armyById(b.A[0]) || {}).tag || b.A0) ? 'att' : 'def';
  w.cas[sideOfA] += lostA; w.cas[sideOfA === 'att' ? 'def' : 'att'] += lostB; void attWon;
}
const BS_STRAT = k => STRATS[k] ? `${STRATS[k].icon} ${STRATS[k].name}` : k;
function battleSummaryHtml(b) {
  const s = b.sum; if (!s) return '';
  const res = !s.mine ? 'neutral' : s.mine === s.winner ? 'win' : 'lose', nm = t => G.C[t].name, men = n => fmtN(n, 0);
  const title = res === 'win' ? `¡Victoria de ${nm(s.tagW)}!` : res === 'lose' ? `Derrota: ${nm(s.tagW)} se impone` : `Victoria de ${nm(s.tagW)}`;
  const icon = res === 'win' ? '🏆' : res === 'lose' ? '💀' : '📋';
  const lostW = s.lost[s.winner], lostL = s.lost[s.winner === 'A' ? 'B' : 'A'], dW = s.d0[s.winner] - s.d1[s.winner], dL = s.d0[s.winner === 'A' ? 'B' : 'A'] - s.d1[s.winner === 'A' ? 'B' : 'A'];
  const w = G.wars.find(x => (x.attAll.includes(s.tagW) && x.defAll.includes(s.tagL)) || (x.defAll.includes(s.tagW) && x.attAll.includes(s.tagL)));
  const pr = s.pris[s.winner];
  const cell = (lab, v, cls) => `<div class="bsum-c"><small>${lab}</small><b class="${cls || ''}">${v}</b></div>`;
  return `<div class="bsum ${res}"><div class="bsum-head"><span class="bsum-ic">${icon}</span><div><b>${title}</b><small>Batalla de ${provName(b.prov)} · ${s.date} · duró ${fmtDays(s.days)}</small></div></div>
    <div class="bsum-grid">
      ${cell(`Bajas de ${nm(s.tagW)}`, men(lostW), lostW > lostL ? 'bad' : '')}${cell(`Bajas de ${nm(s.tagL)}`, men(lostL), 'bad')}
      ${cell('Divisiones destruidas', `${nm(s.tagW)} ${Math.max(0, dW)} · ${nm(s.tagL)} ${Math.max(0, dL)}`)}${cell('Prisioneros capturados', pr ? `${men(pr)} por ${nm(s.tagW)}` : '—')}
      ${cell('Estrategias', `${BS_STRAT(s.strat.A)} / ${BS_STRAT(s.strat.B)}`)}${cell('Terreno', s.terr.map(t => t[0] + ' ' + t[1]).join(' · ') || 'Abierto')}
    </div>
    ${s.gens.length ? `<div class="bsum-gens">${s.gens.map(g => `🎖️ ${nm(g.tag)}: el general <b>${g.name}</b> cae en combate.`).join('<br>')}</div>` : ''}
    ${s.ev.length ? `<div class="bsum-ev"><small>Momentos clave</small>${s.ev.map(e => `<div>${EV_ICON[e.k] || '•'} <small>día ${e.d}</small> ${e.t}</div>`).join('')}</div>` : ''}
    ${w ? `<div class="bsum-war">⚔ ${w.name}: batallas ganadas ${(w.bw || {att: 0}).att}–${(w.bw || {def: 0}).def} · puntuación ${w.score > 0 ? '+' : ''}${w.score}</div>` : ''}</div>`;
}

/* ---------- guerra ---------- */
function warReport(w, winner) {
  const mine = w.attAll.includes(G.player) ? 'att' : w.defAll.includes(G.player) ? 'def' : null;
  const occ = (owners, by) => { let n = 0; owners.forEach(t => G.C[t].states.forEach(id => { const s = G.S[id]; if (s.occ >= 1 && s.occBy && by.includes(s.occBy)) n++; })); return n; };
  const held = (hs, os) => typeof prisHeldFrom === 'function' ? Math.round(prisHeldFrom(hs, os)) : 0;
  const side = winner === null ? null : (winner === w.att ? 'att' : 'def');
  return {id: w.id, name: w.name, cb: w.cb, att: w.att, def: w.def, attAll: w.attAll.slice(), defAll: w.defAll.slice(), mine, result: winner === null ? 'draw' : !mine ? 'neutral' : side === mine ? 'win' : 'lose', side,
    days: Math.round((w.weeks || 0) * 7), score: w.score, bat: w.bat || 0, bw: Object.assign({att: 0, def: 0}, w.bw), cas: Object.assign({att: 0, def: 0}, w.cas), pris: {att: held(w.attAll, w.defAll), def: held(w.defAll, w.attAll)},
    occ: {att: occ(w.defAll, w.attAll), def: occ(w.attAll, w.defAll)}, targets: (w.targets || []).map(id => G.S[id] ? G.S[id].name : '').filter(Boolean), date: dateStr()};
}
function showWarSummary(r) {
  let e = document.getElementById('warsum'); if (!e) { e = document.createElement('div'); e.id = 'warsum'; document.body.appendChild(e); }
  const me = r.mine, you = me || 'att', foe = you === 'att' ? 'def' : 'att', names = l => l.map(t => `${flag(t, 'sm')} ${G.C[t].name}`).join(', ');
  const head = r.result === 'win' ? ['🏆', 'VICTORIA', 'win'] : r.result === 'lose' ? ['💀', 'DERROTA', 'lose'] : r.result === 'draw' ? ['🕊️', 'PAZ BLANCA', 'draw'] : ['📜', 'FIN DE LA GUERRA', 'draw'];
  const c = (lab, v, cls) => `<div class="ws-c"><small>${lab}</small><b class="${cls || ''}">${v}</b></div>`, sc = me === 'def' ? -r.score : r.score;
  e.innerHTML = `<div class="ws-card ${head[2]}"><div class="ws-top"><span class="ws-ic">${head[0]}</span><div><small>Resumen de la guerra</small><h2>${head[1]}</h2></div></div>
    <div class="ws-title">${CBS[r.cb] ? CBS[r.cb].icon : '⚔'} ${r.name || (G.C[r.att].name + ' contra ' + G.C[r.def].name)}</div>
    <div class="ws-sides"><div><small>Tu bando</small>${names(me === 'def' ? r.defAll : r.attAll)}</div><div><small>Enemigos</small>${names(me === 'def' ? r.attAll : r.defAll)}</div></div>
    <div class="ws-grid">${c('Duración', fmtDays(r.days))}${c('Batallas (ganadas–perdidas)', `${r.bw[you]}–${r.bw[foe]} de ${r.bat}`)}${c('Bajas propias', fmtN(r.cas[you], 0), 'bad')}${c('Bajas enemigas', fmtN(r.cas[foe], 0), 'good')}${c('Prisioneros (que tienes · que tiene el enemigo)', `${fmtN(r.pris[you], 0)} · ${fmtN(r.pris[foe], 0)}`)}${c('Territorio ocupado (tuyo · enemigo)', `${r.occ[foe]} · ${r.occ[you]} estados`)}${c('Puntuación final', (sc > 0 ? '+' : '') + sc, sc >= 0 ? 'good' : 'bad')}${c('Fecha', r.date)}</div>
    ${r.targets.length ? `<div class="ws-goal"><small>Objetivos de guerra</small> ${r.targets.join(', ')}</div>` : ''}
    <p class="ws-note">${r.result === 'win' && r.mine === 'att' && r.targets.length ? 'Como vencedor, decides los términos de la paz en la conferencia.' : r.result === 'win' ? 'Has salido victorioso.' : r.result === 'lose' ? 'Los vencedores impondrán los términos de la paz.' : r.result === 'draw' ? 'Nadie obtiene nada: las fronteras no cambian.' : ''}</p>
    <button class="primary" data-act="closewarsum">Continuar</button></div>`;
  e.style.display = 'flex';
}
Object.assign(ACT, {closewarsum: () => { const e = document.getElementById('warsum'); if (e) { e.style.display = 'none'; e.innerHTML = ''; } }});

function recentBattlesHtml() {
  const l = (G.endedList || []).filter(b => b.sum && b.sum.mine).slice(0, 8);
  return `<div class="card"><h3>Batallas recientes</h3>${l.length ? l.map(b => { const s = b.sum, win = s.mine === s.winner; return `<div class="kv sm clk" data-act="selbattle" data-id="${b.id}"><span>${win ? '🏆' : '💀'} ${provName(b.prov)} <small class="dim">${s.date}</small></span><b>${fmtN(s.lost[s.mine], 0)} bajas · 📋 resumen</b></div>`; }).join('') : '<small class="dim">Aún no has librado ninguna batalla en esta sesión.</small>'}</div>`;
}
