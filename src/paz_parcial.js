/* ===== PAZ PARCIAL Y CAPITULACIONES =====
   Un país que no dirige su bando puede salir de la guerra por su cuenta: paz separada (el rival dicta condiciones solo a ese país),
   retirada propia (paz blanca con coste de prestigio y relaciones) o capitulación cuando su capital cae. La guerra continúa entre el resto. */
const ppEnemies = (w, t) => w.attAll.includes(t) ? w.defAll : w.attAll;
const ppIsLead = (w, t) => t === w.att || t === w.def;
const ppEnemyLead = (w, t) => w.attAll.includes(t) ? w.def : w.att;
function ppOccShare(w, t) { const L = G.C[t].states, en = ppEnemies(w, t); if (!L.length) return 1; return L.filter(id => { const s = G.S[id]; return (s.occ || 0) >= 0.5 && en.includes(s.occBy); }).length / L.length; }
function ppCapHeld(w, t) { const s = G.S[G.C[t].capital]; return !!s && s.owner === t && (s.occ || 0) >= 0.5 && ppEnemies(w, t).includes(s.occBy); }
function partialConf(w, taker, loser) {
  const winLead = w.attAll.includes(taker) ? w.att : w.def, c = buildConference(w, winLead);
  c.opts = c.opts.filter(o => o.type !== 'law' && o.type !== 'vassal' && (o.type !== 'state' || G.S[o.sid].owner === loser));
  c.winner = taker; c.winAll = [taker]; c.loseAll = [loser]; c.loseLead = loser; c.partial = loser; c.pick = new Set(); c.recip = {};
  c.budget = clamp(Math.round(30 + ppOccShare(w, loser) * 60 + (ppCapHeld(w, loser) ? 15 : 0)), 25, 90);
  return c;
}
function clearOccFor(w, tag, enemies) {
  const ch = new Set();
  G.P.forEach((p, pid) => { const sid = provState(pid), o = G.S[sid].owner, by = p.by || p.pby; if ((p.by || p.prog > 0) && ((by === tag && enemies.includes(o)) || (enemies.includes(by) && o === tag))) { p.by = null; p.prog = 0; ch.add(sid); MAP.provs[pid].nb.forEach(q => ch.add(provState(q))); } });
  ch.forEach(sid => { const s = G.S[sid]; refreshStateOcc(sid); s._occNotified = false; });
  if (ch.size && typeof onFrontChanged === 'function') onFrontChanged(ch);
}
function detachFromWar(w, tag, taker) {
  const en = ppEnemies(w, tag).slice();
  w.attAll = w.attAll.filter(x => x !== tag); w.defAll = w.defAll.filter(x => x !== tag);
  const c = G.C[tag]; c.wars = c.wars.filter(x => x !== w.id); c.capT = 0;
  clearOccFor(w, tag, en);
  en.forEach(e => { addRel(tag, e, 8); });
  if (taker) { c.lastWar = G.date.t; if (G.C[taker]) G.C[taker].lastWar = G.date.t; }
  try { recalcHostile(); evacuateForeignArmies(); } catch (e) { }
}
const _applyConf19 = applyConference;
applyConference = function (c) { _applyConf19(c); if (c.partial) { const w = c.w; if (G.wars.includes(w)) { detachFromWar(w, c.partial, c.winner); } } };
const _renderConf19 = renderConference;
renderConference = function () { _renderConf19(); const c = G.conf; if (c && c.partial) { const h = document.querySelector('#confdlg h2'); if (h) h.textContent = 'Paz separada con ' + G.C[c.partial].name; } };
function humanTaker(t) { return !G.C[t].ai && typeof openConference === 'function' && !G.headless; }
function runPartial(w, taker, loser) {
  const conf = partialConf(w, taker, loser);
  if (humanTaker(taker)) { G.confQueue = G.confQueue || []; G.confQueue.push(conf); if (!G.conf) nextConference(); }
  else { aiPickDemands(conf); applyConference(conf); }
}
function sepAccepts(w, tag) { const ws = typeof scoreFor === 'function' ? scoreFor(w, tag) : 0; return ws <= -10 || ppCapHeld(w, tag) || ppOccShare(w, tag) >= 0.25 || (G.C[tag].wear || 0) > 70; }
function ppCapitulate(w, t) {
  const s = G.S[G.C[t].capital], by = s && ppEnemies(w, t).includes(s.occBy) ? s.occBy : ppEnemyLead(w, t);
  if (ppIsLead(w, t)) { endWar(w, ppEnemyLead(w, t)); return; }
  notify('war', `${G.C[t].name} capitula ante ${G.C[by].name}.`, G.C[t].capital);
  runPartial(w, by, t);
}
function capitWeek() {
  G.wars.slice().forEach(w => {
    if (!G.wars.includes(w)) return;
    w.attAll.concat(w.defAll).slice().forEach(t => {
      if (!G.wars.includes(w) || !G.C[t] || !alive(t)) return; const c = G.C[t], held = ppCapHeld(w, t); c.capT = held ? (c.capT || 0) + 1 : 0;
      if (t === G.player) { if (c.capT === 3) notify('war', 'Tu capital está ocupada. Puedes capitular en Ejército → Guerra para detener la sangría.', c.capital); return; }
      if (!c.ai) return;
      if ((c.capT >= (ppIsLead(w, t) ? 8 : 5)) || (ppOccShare(w, t) > 0.75 && c.capT >= 2)) ppCapitulate(w, t);
    });
  });
}
const _pow19 = peaceOffersWeek;
peaceOffersWeek = function () { _pow19(); try { capitWeek(); } catch (e) { console.warn('capitulación', e); } };
function partialBtnsHtml(w) {
  const me_ = G.player; if (!w.attAll.includes(me_) && !w.defAll.includes(me_)) return '';
  const en = ppEnemies(w, me_).filter(t => !ppIsLead(w, t) && alive(t)), held = ppCapHeld(w, me_);
  let h = en.map(t => `<button data-act="sepeace" data-w="${w.id}" data-t="${t}" data-tip="Paz solo con ${G.C[t].name}: tú dictas condiciones y sale de la guerra. El resto sigue.">🕊️ Paz con ${G.C[t].name}</button>`).join('');
  if (!ppIsLead(w, me_)) h += `<button data-act="leavewar" data-w="${w.id}" data-tip="Sales de la guerra con paz blanca: −5 prestigio y peor relación con tu líder." ${held ? 'disabled' : ''}>🚪 Retirarme</button>`;
  if (held || ppOccShare(w, me_) > 0.5) h += `<button data-act="capit" data-w="${w.id}" data-tip="Rendirte: el enemigo dicta condiciones.">🏳️ Capitular</button>`;
  return h;
}
Object.assign(ACT, {
  sepeace: d => { const w = G.wars.find(x => x.id === +d.w), t = d.t; if (!w || !alive(t) || !ppEnemies(w, G.player).includes(t)) return;
    if (!sepAccepts(w, t)) { toast('🕊️', `${G.C[t].name} se niega: aún no está lo bastante derrotado. Ocupa más territorio o gana batallas.`); return; }
    runPartial(w, G.player, t); renderWindow(); },
  leavewar: d => { const w = G.wars.find(x => x.id === +d.w); if (!w || ppIsLead(w, G.player)) return; const c = me(), lead = w.attAll.includes(G.player) ? w.att : w.def;
    c.prestige = Math.max(0, c.prestige - 5); addRel(G.player, lead, -25); detachFromWar(w, G.player, ppEnemyLead(w, G.player)); notify('war', `Te retiras de la guerra de ${G.C[lead].name}.`); renderWindow(); },
  capit: d => { const w = G.wars.find(x => x.id === +d.w); if (!w) return; if (ppIsLead(w, G.player)) { endWar(w, ppEnemyLead(w, G.player)); } else { const by = ppEnemyLead(w, G.player); G.C[G.player].capT = 0; notify('war', `Capitulas ante ${G.C[by].name}.`); if (humanTaker(by)) { runPartial(w, by, G.player); } else { const conf = partialConf(w, by, G.player); aiPickDemands(conf); applyConference(conf); } } renderWindow(); }
});
