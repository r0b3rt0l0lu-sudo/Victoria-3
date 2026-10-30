/* ===== OFERTAS DE PAZ INTERMEDIAS =====
   Durante una guerra, tanto el jugador como la IA pueden proponer un acuerdo de paz sin esperar a una victoria total:
   · EXIGIR   (quien va ganando) pide territorios ocupados, reparaciones, humillación…; el rival acepta si le sale a cuenta.
   · OFRECER  (quien va perdiendo) cede territorios o paga para acabar con la guerra.
   · PAZ BLANCA cuando ninguno puede imponerse.
   Las condiciones usan las mismas partidas y costes en puntos de guerra que la conferencia de paz. La aceptación depende de la
   puntuación de guerra, el cansancio, el peligro para la capital y el carácter del país. Un acuerdo aceptado termina la guerra. */
const scoreFor = (w, tag) => w.attAll.includes(tag) ? w.score : -w.score;
const warPrincipal = (w, tag) => w.attAll.includes(tag) ? w.att : w.def;
const otherPrincipal = (w, tag) => warPrincipal(w, tag) === w.att ? w.def : w.att;
const capThreat = tag => { const c = G.C[tag]; if (c.capital < 0) return 0; const s = G.S[c.capital]; if (s.owner === tag && s.occ >= 1) return 2; if (s.owner === tag && s.occ > 0) return 1; return 0; };

// términos disponibles para un acuerdo entre vencedor W y pagador P
function offerOptions(w, W) { return buildConference(w, W).opts; }
function offerCostOf(opts, ids) { return opts.reduce((n, o) => n + (ids.includes(o.id) ? o.cost : 0), 0); }

// evaluación de un acuerdo: ¿lo aceptaría el otro bando? dir: 'demand' (W exige a P) | 'offer' (P ofrece a W) | 'white'
function offerEval(w, W, P, ids, dir) {
  const opts = offerOptions(w, W), cost = offerCostOf(opts, ids), sW = scoreFor(w, W), wearP = G.C[P].wear || 0, wearW = G.C[W].wear || 0;
  const docW = typeof aiDoc === 'function' ? aiDoc(G.C[W]) : {aggr: .5};
  const mercyP = 6 + wearP * 0.24 + capThreat(P) * 9 + Math.max(0, w.weeks - 30) * 0.1;           // lo dispuesto que está P a ceder para acabar
  if (dir === 'white' || !ids.length) {
    const need = 22 + (wearP + wearW) * 0.14 + Math.min(20, w.weeks * 0.12);
    const ok = Math.abs(sW) <= need;
    return {accept: ok, cost: 0, have: need, need: Math.abs(sW), reason: ok ? '' : `Aún creen que pueden ${sW > 0 ? 'resistir' : 'imponerse'} (diferencia de ${Math.round(Math.abs(sW))} puntos frente a ${Math.round(need)} tolerables).`};
  }
  if (dir === 'demand') {
    const have = Math.max(0, sW) * 0.92 + mercyP;
    return {accept: cost <= have + 1e-6, cost, have, need: cost, reason: cost <= have ? '' : `Las exigencias (${cost} pts) superan lo que tu posición justifica (${Math.round(have)} pts).`};
  }
  // P ofrece a W: W acepta si lo que recibe compensa lo que cree poder lograr
  const want = Math.max(0, sW) * (0.5 + docW.aggr * 0.12) + 3 - wearW * 0.12 - capThreat(W) * 4;
  const ok = cost >= want - 1e-6 && sW < 92;
  return {accept: ok, cost, have: cost, need: Math.max(0, want), reason: ok ? '' : `No les basta: esperan al menos ${Math.round(Math.max(0, want))} pts y se les ofrecen ${cost}.`};
}

// aplica un acuerdo aceptado: la guerra termina y se ejecutan las condiciones elegidas
function offerApply(w, W, P, ids) {
  const tag = G.C[W].name + ' y ' + G.C[P].name; void tag;
  if (!ids.length) { endWar(w, null); return; }
  endWar(w, W, {ids, negotiated: true});
}

/* ---------- IA: construye propuestas ---------- */
function aiBuildDemand(w, W, P, limit) {
  const conf = buildConference(w, W); conf.budget = Math.max(0, limit); conf.pick = new Set(); aiPickDemands(conf);
  return [...conf.pick];
}
function aiBuildOffer(w, W, P) {      // P (el que pierde) ofrece lo mínimo que W aceptaría
  const opts = offerOptions(w, W), sW = scoreFor(w, W), docW = typeof aiDoc === 'function' ? aiDoc(G.C[W]) : {aggr: .5};
  const want = Math.max(0, sW) * (0.5 + docW.aggr * 0.12) + 3 - (G.C[W].wear || 0) * 0.12 - capThreat(W) * 4;
  const ids = []; let cost = 0; const order = opts.slice().sort((a, b) => ((a.type === 'state' ? (a.occ >= 0.5 ? 0 : 1) : 2) - (b.type === 'state' ? (b.occ >= 0.5 ? 0 : 1) : 2)) || (a.cost - b.cost));
  for (const o of order) { if (cost >= want * 1.05) break; if (o.type === 'law' || o.type === 'vassal' || o.type === 'demil') continue; if (o.type === 'reps' && ids.includes('reps8') && o.id === 'reps16') continue; ids.push(o.id); cost += o.cost; }
  return cost >= want ? ids : null;
}
function proposePeaceTo(w, from, to, dir, ids) {   // propuesta de la IA al jugador
  if (G.proposals.some(p => p.type === 'peace' && p.wid === w.id)) return false;
  G.proposals.push({id: G.nextId++, from, to, type: 'peace', wid: w.id, dir, ids, t: G.date.t});
  const W = dir === 'offer' ? to : from, P = dir === 'offer' ? from : to; const opts = offerOptions(w, W);
  notify('diplo', `✉️ ${G.C[from].name} te ${dir === 'white' ? 'propone una paz blanca' : dir === 'offer' ? 'ofrece la paz con concesiones' : 'exige condiciones de paz'} (${ids.length} condiciones). Revisa Diplomacia → Acuerdos.`);
  void opts; void P; return true;
}
function peaceOffersWeek() {
  if (G.noOffers) return;                  // (las pruebas comparativas de la IA de guerra lo desactivan)
  G.wars.slice().forEach(w => {
    if (w.auto || w.weeks < 6 || w.weeks - (w.poT || -99) < 8) return;
    const a = w.att, d = w.def; if (!alive(a) || !alive(d)) return;
    // la IA que está perdiendo y cansada ofrece concesiones; la que gana exige; en tablas, paz blanca
    const sides = [a, d].filter(t => G.C[t].ai);
    for (const S of sides) {
      const O = otherPrincipal(w, S), me = scoreFor(w, S), wear = G.C[S].wear || 0, cth = capThreat(S);
      if (G.proposals.some(p => p.type === 'peace' && p.wid === w.id)) break;
      const wantsOut = (me <= -22 && (wear > 22 || cth)) || wear >= 70 || cth >= 2 || (me <= -8 && w.weeks > 60);
      const winning = me >= 22 && (wear > 15 || w.weeks > 16);
      const stale = Math.abs(me) < 18 && w.weeks > 32 && wear > 30 && (G.C[O].wear || 0) > 25;
      let dir = null, ids = null;
      if (wantsOut && Math.random() < 0.6) { dir = 'offer'; ids = aiBuildOffer(w, O, S); }
      else if (winning && Math.random() < 0.28) { const have = me * 0.92 + 6 + (G.C[O].wear || 0) * 0.24 + capThreat(O) * 9; ids = aiBuildDemand(w, S, O, Math.min(me * 0.8, have * 0.95)); if (ids.length) dir = 'demand'; }
      else if (stale && Math.random() < 0.4) { dir = 'white'; ids = []; }
      if (!dir || (ids === null)) continue; w.poT = w.weeks;
      if (G.C[O].ai || O !== G.player) {
        // la otra parte es IA: se resuelve directamente
        const W = dir === 'offer' ? O : S, P = dir === 'offer' ? S : O; const r = offerEval(w, W, P, ids, dir);
        if (r.accept) { notify('war', `✉️ ${G.C[S].name} y ${G.C[O].name} firman la paz${ids.length ? ' con concesiones' : ' blanca'}.`); offerApply(w, W, P, ids); return; }
      } else {
        if (dir === 'white' || ids.length) proposePeaceTo(w, S, O, dir, ids);
      }
      break;
    }
  });
}

/* ---------- interfaz: diálogo de propuesta ---------- */
function ensurePeaceDlg() { let r = document.getElementById('peacedlg'); if (!r) { r = document.createElement('div'); r.id = 'peacedlg'; document.body.appendChild(r); } return r; }
function openPeaceOffer(wid, dir, preset) {
  const w = G.wars.find(x => x.id === wid); if (!w) return;
  const me = warPrincipal(w, G.player), sc = scoreFor(w, G.player);
  UI.po = {wid, dir: dir || (sc >= 15 ? 'demand' : sc <= -15 ? 'offer' : 'white'), pick: new Set(preset || []), me};
  if (!UI.po.pick.size && UI.po.dir === 'offer') { const W = otherPrincipal(w, me), ids = aiBuildOffer(w, W, me); (ids || []).forEach(i => UI.po.pick.add(i)); }
  G.paused = true; renderPeaceOffer();
}
function closePeaceOffer() { UI.po = null; const r = document.getElementById('peacedlg'); if (r) { r.classList.remove('open'); r.innerHTML = ''; } }
function renderPeaceOffer() {
  const po = UI.po, root = ensurePeaceDlg(); if (!po) { closePeaceOffer(); return; }
  const w = G.wars.find(x => x.id === po.wid); if (!w) { closePeaceOffer(); return; }
  const me = warPrincipal(w, G.player), foe = otherPrincipal(w, me), dir = po.dir, W = dir === 'offer' ? foe : me, P = dir === 'offer' ? me : foe;
  const opts = dir === 'white' ? [] : offerOptions(w, W), ids = [...po.pick].filter(i => opts.some(o => o.id === i)), cost = offerCostOf(opts, ids);
  const ev = dir === 'white' ? offerEval(w, me, foe, [], 'white') : offerEval(w, W, P, ids, dir), sc = scoreFor(w, G.player);
  const label = o => confLabel({winner: W, loseLead: P}, o);
  const row = o => `<label class="cfrow ${po.pick.has(o.id) ? 'on' : ''}"><input type="checkbox" data-act="popick" data-id="${o.id}" ${po.pick.has(o.id) ? 'checked' : ''}>
    <span class="cfl">${label(o)}${o.type === 'state' ? `<small class="dim"> · ${fmtN(o.pop, 1)} hab. · ${o.target ? '🎯 objetivo de guerra · ' : ''}${o.occ >= 0.5 ? 'ocupado' : o.occ > 0 ? 'ocupado en parte' : 'sin ocupar'}</small>` : ''}</span><b class="cfc">${o.cost} pts</b></label>`;
  const states = opts.filter(o => o.type === 'state'), others = opts.filter(o => o.type !== 'state' && o.type !== 'law');
  const pct = dir === 'white' ? clamp(0.5 + (ev.have - ev.need) / 30, 0, 1) : clamp(0.5 + (ev.have - ev.need) / Math.max(10, ev.have), 0, 1);
  root.classList.add('open');
  root.innerHTML = `<div class="wd"><div class="whead"><span class="wicon">📜</span><h2>Propuesta de paz — ${w.name || CBS[w.cb].name}</h2></div>
  <div class="wd-body"><div class="cols"><div class="col wide">
    <div class="notice">${flag(me, 'sm')} <b>${G.C[me].name}</b> frente a ${flag(foe, 'sm')} <b>${G.C[foe].name}</b> · puntuación de guerra <b class="${sc >= 0 ? 'good' : 'bad'}">${sgn(sc, 0)}</b> · semana ${w.weeks}</div>
    <div class="btnrow"><button class="${dir === 'demand' ? 'on' : ''}" data-act="podir" data-d="demand">⚔ Exigir condiciones</button><button class="${dir === 'offer' ? 'on' : ''}" data-act="podir" data-d="offer">🏳 Ofrecer concesiones</button><button class="${dir === 'white' ? 'on' : ''}" data-act="podir" data-d="white">🕊 Paz blanca</button></div>
    ${dir === 'white' ? '<p class="hint">Ambos bandos dejan las armas sin cambios de fronteras. La aceptan quienes ven la guerra sin salida.</p>' : `<h4 class="sub">${dir === 'demand' ? 'Territorios que exiges (ocupados o tus objetivos de guerra)' : 'Territorios que cedes'}</h4>${states.length ? states.map(row).join('') : '<p class="hint">No hay territorios que puedan entrar en el acuerdo.</p>'}
    <h4 class="sub">Otras condiciones</h4>${others.map(row).join('')}`}
  </div><div class="col">
    <div class="card"><h3>Probabilidad de aceptación</h3>${bar(pct, 1, pct > 0.5 ? '' : 'warn', Math.round(pct * 100) + '%')}
    <div class="kv sm"><span>${dir === 'demand' ? 'Coste de tus exigencias' : dir === 'offer' ? 'Valor de tus concesiones' : 'Diferencia de fuerzas'}</span><b>${dir === 'white' ? Math.round(ev.need) : cost + ' pts'}</b></div>
    <div class="kv sm"><span>${dir === 'demand' ? 'Lo que tu posición justifica' : dir === 'offer' ? 'Lo que esperan recibir' : 'Tolerancia'}</span><b>${Math.round(dir === 'offer' ? ev.need : ev.have)}</b></div>
    <p class="hint">${ev.accept ? '✅ Con estas condiciones es probable que acepten.' : '⚠️ ' + ev.reason}</p>
    <div class="btnrow"><button class="primary" data-act="posend" ${dir !== 'white' && !ids.length ? 'disabled' : ''}>✉️ Enviar propuesta</button><button data-act="poclose">Cancelar</button></div></div>
    <div class="card"><h3>Consejos</h3><p class="hint">Si vas ganando, exige territorios ya ocupados (cuestan menos). Si pierdes, ofrece lo que el enemigo ocupa y ya perderías. El cansancio de guerra y la amenaza sobre la capital hacen al rival más dispuesto a ceder. Si rechazan, vuelve a intentarlo en unas semanas.</p></div>
  </div></div></div></div>`;
}
// respuesta a una propuesta de la IA al jugador
function peaceProposalHtml(pp) {
  const w = G.wars.find(x => x.id === pp.wid); if (!w) return '';
  const W = pp.dir === 'offer' ? pp.to : pp.from, opts = offerOptions(w, W), labs = pp.ids.map(i => opts.find(o => o.id === i)).filter(Boolean).map(o => confLabel({winner: W, loseLead: pp.dir === 'offer' ? pp.from : pp.to}, o));
  return `<div class="card"><h3>✉️ Propuesta de paz de ${flag(pp.from, 'sm')} ${G.C[pp.from].name}</h3><p class="hint">${pp.dir === 'white' ? 'Propone una <b>paz blanca</b>: nadie cambia de fronteras.' : pp.dir === 'offer' ? 'Ofrece la paz y te <b>concede</b>:' : 'Propone la paz si <b>aceptas</b>:'}</p>${labs.map(l => `<div class="kv sm"><span>• ${l}</span></div>`).join('')}
    <div class="btnrow"><button class="primary" data-act="propeace" data-id="${pp.id}">Aceptar y terminar la guerra</button><button data-act="ponego" data-id="${pp.id}">Negociar</button><button data-act="propno" data-id="${pp.id}">Rechazar</button></div></div>`;
}
function respondPeace(id, accept) {
  const i = G.proposals.findIndex(p => p.id === id && p.type === 'peace'); if (i < 0) return; const pp = G.proposals[i]; G.proposals.splice(i, 1);
  const w = G.wars.find(x => x.id === pp.wid); if (!w) return;
  if (!accept) { addRel(G.player, pp.from, -2); return; }
  const W = pp.dir === 'offer' ? pp.to : pp.from, P = pp.dir === 'offer' ? pp.from : pp.to;
  notify('war', `Aceptas la paz con ${G.C[pp.from].name}.`); offerApply(w, W, P, pp.ids);
}
Object.assign(ACT, {
  poopen: d => openPeaceOffer(+d.id),
  podir: d => { const po = UI.po; if (!po) return; po.dir = d.d; po.pick = new Set(); const w = G.wars.find(x => x.id === po.wid); if (w && d.d === 'offer') { const ids = aiBuildOffer(w, otherPrincipal(w, po.me), po.me); (ids || []).forEach(i => po.pick.add(i)); } renderPeaceOffer(); },
  popick: (d, el) => { const po = UI.po; if (!po) return; if (el.checked) po.pick.add(d.id); else po.pick.delete(d.id); renderPeaceOffer(); },
  poclose: () => { closePeaceOffer(); G.paused = false; updateHud(); },
  posend: () => {
    const po = UI.po; if (!po) return; const w = G.wars.find(x => x.id === po.wid); if (!w) { closePeaceOffer(); return; }
    const me = po.me, foe = otherPrincipal(w, me), dir = po.dir, W = dir === 'offer' ? foe : me, P = dir === 'offer' ? me : foe, ids = dir === 'white' ? [] : [...po.pick];
    w.pcool = w.pcool || {}; if (G.date.t - (w.pcool[foe] || -99) < 14) { toast('⏳', `${G.C[foe].name} no quiere volver a negociar tan pronto (espera unas semanas).`); return; }
    const ev = offerEval(w, W, P, ids, dir);
    if (ev.accept) { closePeaceOffer(); notify('war', `✉️ ${G.C[foe].name} acepta la propuesta de paz.`); offerApply(w, W, P, ids); G.paused = false; updateHud(); renderWindow && renderWindow(); }
    else { w.pcool[foe] = G.date.t; toast('✉️', `${G.C[foe].name} rechaza la propuesta. ${ev.reason}`); closePeaceOffer(); G.paused = false; updateHud(); }
  },
  propeace: d => { respondPeace(+d.id, true); renderWindow(); },
  ponego: d => { const pp = G.proposals.find(p => p.id === +d.id); if (!pp) return; const w = G.wars.find(x => x.id === pp.wid); G.proposals = G.proposals.filter(p => p !== pp); if (w) openPeaceOffer(w.id, pp.dir === 'offer' ? 'demand' : pp.dir === 'demand' ? 'offer' : 'white'); }
});
