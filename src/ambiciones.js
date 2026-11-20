/* ===== AMBICIONES NACIONALES (opcionales) =====
   Cada país puede fijarse una ambición: «Convertirse en imperio». Exige 1) recuperar todos sus territorios CORE (los estados que poseía al empezar
   y sus reclamaciones permanentes) y 2) alcanzar un tamaño y rango mínimos. Al lograrlo se transforma en imperio (nombre, prestigio, legitimidad y bonos).
   Solo una minoría de países de la IA la adopta (≈1 de cada 8 de las 30 primeras potencias) y no recibe ninguna casus belli extra: usa las reclamaciones
   que ya tenía. Para el jugador es una opción: se elige y se abandona desde el Diario. */
const AMB_EMPIRE = {states: 12, rank: 14, prestige: 40};
const ambOf = c => c.amb || (c.amb = {id: '', core: null, done: false});
function ambCore(c) {
  const a = ambOf(c); if (!a.core) a.core = c.states.slice();
  const set = new Set(a.core); (c.claims || []).forEach(x => { if (x.perm) set.add(x.state); }); return [...set];
}
function ambProgress(c) {
  const core = ambCore(c), miss = core.filter(id => G.S[id].owner !== c.tag), size = c.states.length;
  const stage1 = core.length ? (core.length - miss.length) / core.length : 1;
  return {core, miss, size, stage1, okCore: !miss.length, okSize: size >= AMB_EMPIRE.states, okRank: c.rank <= AMB_EMPIRE.rank, okPrestige: c.prestige >= AMB_EMPIRE.prestige};
}
function ambPick(c, id) { const a = ambOf(c); a.id = id; ambCore(c); if (c.tag === G.player) toast('👑', id ? 'Ambición fijada: convertirte en imperio.' : 'Has abandonado tu ambición nacional.'); return a; }
function ambEmpireName(c) {
  if (/^Imperio/.test(c.name)) return c.name; if (c.name === 'Reino Unido') return 'Imperio Británico';
  const m = c.name.match(/^(?:Reino|República|Gran Ducado|Ducado|Principado|Sultanato|Emirato|Confederación|Estados) (de la |del |de los |de )(.+)$/); if (m) return 'Imperio ' + m[1] + m[2];
  return 'Imperio de ' + c.name;
}
function ambMonth(c) {
  const a = c.amb; if (!a || !a.id || a.done || !c.states.length) return;
  const p = ambProgress(c); a.miss = p.miss.length;
  if (p.okCore && p.okSize && p.okRank && p.okPrestige) {
    a.done = G.date.y; const old = c.name; c.name = ambEmpireName(c); c.prestige += 40; c.legitimacy = Math.min(100, c.legitimacy + 8);
    c.natMods = c.natMods || {}; c.natMods.tax = (c.natMods.tax || 0) + 0.03; c.natMods.army = (c.natMods.army || 0) + 0.04; c.natMods.stab = (c.natMods.stab || 0) + 1; recalcMods(c);
    notify('crisis', `👑 ${old} se proclama ${c.name}: ha reunido sus territorios y alcanzado la grandeza imperial.`, c.capital);
    if (c.tag === G.player) toast('👑', `¡Ambición cumplida! Ahora eres el ${c.name}.`);
  } else if (c.tag === G.player && G.date.m === 0 && p.miss.length) { /* recordatorio anual */ notify('journal', `👑 Ambición imperial: te faltan ${p.miss.length} territorios core por recuperar.`); }
}
const _journalAmb = journal;
journal = function (c) { _journalAmb(c); if (c.tag === NONE) return; if (c.states.length && !c.amb) ambCore(c);
  // la IA: una minoría de grandes potencias adopta la ambición (decisión determinista por país)
  if (c.ai && c.tag !== G.player && c.amb && !c.amb.chosen && G.date.m === 6) { c.amb.chosen = 1; if (c.rank <= 30 && (c.id * 7 + 3) % 8 === 0 && c.profile !== 'serf' && !/^Imperio/.test(c.name)) ambPick(c, 'empire'); }
  ambMonth(c); };
function ambCard() {
  const c = me(), a = ambOf(c); const p = ambProgress(c); const on = a.id === 'empire';
  const tick = ok => ok ? '✔' : '✘';
  return `<div class="card"><h3>👑 Ambición nacional <small class="dim">· opcional</small></h3>${a.done ? `<div class="notice good"><b>👑 ${c.name}</b><br>Ambición cumplida en ${a.done}.</div>` :
    on ? `<div class="kv sm"><span>Territorios core recuperados</span><b>${p.core.length - p.miss.length} / ${p.core.length} ${tick(p.okCore)}</b></div>
      ${p.miss.length ? `<small class="dim">Faltan: ${p.miss.slice(0, 8).map(id => `${G.S[id].name} (${G.S[id].owner === NONE ? 'sin dueño' : G.C[G.S[id].owner].name})`).join(', ')}${p.miss.length > 8 ? '…' : ''}</small>` : ''}
      <div class="kv sm"><span>Estados (${AMB_EMPIRE.states}+)</span><b>${p.size} ${tick(p.okSize)}</b></div><div class="kv sm"><span>Rango (top ${AMB_EMPIRE.rank})</span><b>#${c.rank} ${tick(p.okRank)}</b></div><div class="kv sm"><span>Prestigio (${AMB_EMPIRE.prestige}+)</span><b>${Math.round(c.prestige)} ${tick(p.okPrestige)}</b></div>
      <div class="btnrow"><button data-act="ambdrop">Abandonar ambición</button></div>` :
    `<p class="hint">Fíjate la meta de convertirte en un <b>imperio</b>: recupera todos tus territorios core y crece hasta ${AMB_EMPIRE.states} estados, el top ${AMB_EMPIRE.rank} mundial y ${AMB_EMPIRE.prestige} de prestigio. Ganarás título imperial, +40 prestigio y bonos permanentes. No es obligatorio y no cambia nada hasta que la aceptes.</p><div class="btnrow"><button data-act="ambpick">👑 Fijar ambición imperial</button></div>`}</div>`;
}
const _jr = WINDOWS.journal.render;
WINDOWS.journal.render = function () { const h = _jr.call(this); return h.replace('<div class="cols"><div class="col wide">', '<div class="cols"><div class="col wide">' + ambCard()); };
Object.assign(ACT, {ambpick: () => { ambPick(me(), 'empire'); renderWindow(); }, ambdrop: () => { ambPick(me(), ''); renderWindow(); }});
