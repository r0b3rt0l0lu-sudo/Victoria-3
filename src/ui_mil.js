/* ===== INTERFAZ MILITAR: órdenes, panel de ejército, frentes, generales y batalla con minimapa ===== */
const MODE_NAMES = {hold: '🛡 Manteniendo posición', dig: '⛏ Atrincherándose', train: '🎓 Entrenando'};
const EV_ICON = {barrage: '💥', charge: '🔥', cav: '🐎', flank: '↪️', panic: '😱', reinf: '➕', rain: '🌧️'};

function armyOrderText(a) {
  if (a.battle) return '⚔ En combate';
  if (a.joinTo) { const t = armyById(a.joinTo); return `⛓ Juntándose con ${t ? t.name : '?'}`; }
  if (a.sea) return `⛴ En el mar hacia ${provName(a.sea.to)} · ${a.sea.left} d`;
  if (a.landing) return '⚓ Esperando el embarque';
  if (a.chase) return '🎯 Persiguiendo';
  if (a.patrol && a.path.length) return '🔁 Patrullando';
  if (a.path.length) return `${a.rail ? '🚆' : a.fm ? '🥾' : '➜'} ${provName(a.dest != null ? a.dest : a.path[a.path.length - 1])} · ${armyEta(a)} d`;
  if (a.front) { const f = (G.fronts || []).find(x => x.id === a.front); if (f) return `${f.mode === 'attack' ? '⚔' : '🛡'} ${f.name}`; }
  return a.mode ? MODE_NAMES[a.mode] : 'Esperando órdenes';
}
function armyRowHtml(a) {
  const stat = a.battle ? '<span class="tag bad">⚔ En combate</span>' : `<span class="tag ${a.path.length || a.mode ? '' : 'good'}">${armyOrderText(a)}</span>`;
  return `<tr data-act="selarmy" data-id="${a.id}" class="${UI.selArmy === a.id ? 'sel' : ''}"><td><b>${a.name}</b><br><small class="dim">${a.gen.name} (nv. ${a.gen.lvl}) ${(a.gen.traits || []).map(k => GEN_TRAITS[k].icon).join('')}</small></td><td>${armyStateName(a)}</td><td class="r">${a.divs.length}</td><td class="r">${fmtN(armyMen(a) / 1000, 1)}</td><td class="r">${Math.round(armyStr(a) * 100)}%</td><td class="r">${Math.round(armyOrg(a) * 100)}%</td><td class="r">${trainName(armyTrain(a))}</td><td>${stat}</td></tr>`;
}

/* ---------- órdenes ---------- */
function selectedArmies() {
  const lead = armyById(UI.selArmy); if (!lead || lead.tag !== G.player) return [];
  return [lead].concat([...(UI.selSet || [])].map(armyById).filter(a => a && a.tag === G.player));
}
function orderArmies(pid, how) {
  const list = selectedArmies(); if (!list.length) return; const lead = list[0];
  const foe = how === 'move' ? armiesAt(pid).find(o => hostileTags(G.player, o.tag)) : null;
  let n = 0, eta = 0, err = '';
  list.forEach(a => {
    let r;
    if (how === 'wp') r = addWaypoint(a, pid);
    else if (how === 'patrol') r = orderPatrol(a, pid);
    else { if (pid === a.loc) { orderStop(a); return; } r = orderMove(a, pid, false, {fm: UI.optFm, rail: UI.optRail}); if (r.ok && foe) a.chase = foe.id; }
    if (!r.ok) { err = r.msg; return; } n++; eta = Math.max(eta, r.eta || 0);
  });
  if (err && !n) toast('⚠️', err);
  else if (n) toast(how === 'patrol' ? '🔁' : foe ? '🎯' : '➜', how === 'patrol' ? `${n > 1 ? n + ' ejércitos patrullan' : lead.name + ' patrulla'} entre dos puntos.` : how === 'wp' ? `Punto de ruta añadido (${eta} días en total).` : foe ? `${n > 1 ? 'Los ejércitos persiguen' : lead.name + ' persigue'} a ${foe.name} de ${G.C[foe.tag].name} (${eta} días).` : `${n > 1 ? n + ' ejércitos marchan' : lead.name + ' marcha'} hacia ${provName(pid)} (${eta} días${UI.optFm ? ', marcha forzada' : ''}${UI.optRail ? ', ferrocarril' : ''}).`);
  UI.moveMode = false; UI.patrolNext = false; document.body.classList.remove('movemode');
  renderArmyPanel(); R.labelsDirty = true;
}

/* ---------- panel de ejército ---------- */
function traitChips(g) { return (g.traits || []).map(k => `<span class="tchip g" data-tip="<b>${GEN_TRAITS[k].name}</b><br>${GEN_TRAITS[k].desc}">${GEN_TRAITS[k].icon}</span>`).join('') || '<small class="dim">sin rasgos</small>'; }
function renderArmyPanel() {
  const root = $('#armypanel'); if (!root) return;
  const a = UI.selArmy ? armyById(UI.selArmy) : null;
  if (!a) { UI.selArmy = null; root.classList.remove('open'); root.innerHTML = ''; return; }
  const own = a.tag === G.player, c = G.C[a.tag];
  const cnt = {}; a.divs.forEach(d => cnt[d.t] = (cnt[d.t] || 0) + 1);
  const b = a.battle ? G.battles.find(x => x.id === a.battle) : null;
  const sel = selectedArmies(), group = sel.length > 1;
  const friends = own ? G.armies.filter(o => o !== a && o.tag === a.tag && !o.battle).map(o => ({o, d: provDist(a.loc, o.loc)})).sort((x, y) => x.d - y.d).slice(0, 4) : [];
  const foes = G.armies.filter(o => hostileTags(a.tag, o.tag)).map(o => ({o, d: provDist(a.loc, o.loc)})).sort((x, y) => x.d - y.d).slice(0, 3);
  const pool = own ? genPool(c) : [];
  const fronts = own ? frontsOf(a.tag) : [];
  const tg = (on, act, label, extra) => `<button class="${on ? 'on' : ''}" data-act="${act}" ${extra || ''}>${label}</button>`;
  root.classList.add('open');
  root.innerHTML = `<div class="sp-head">${flag(a.tag, 'md')}<div><h2>${a.name}</h2><small>${c.name} · ${armyStateName(a)}</small></div><button class="x" data-act="armyclose">✕</button></div>
  <div class="gen"><b>🎖️ ${a.gen.name}</b> <small>nivel ${a.gen.lvl}</small> <span class="traits">${traitChips(a.gen)}</span>
    <div class="kv sm"><span>Ataque</span><span class="gs">${stars(a.gen.atk)}</span></div><div class="kv sm"><span>Defensa</span><span class="gs">${stars(a.gen.def)}</span></div><div class="kv sm"><span>Logística</span><span class="gs">${stars(a.gen.log)}</span></div></div>
  <div class="kv"><span>Fuerza</span><b>${Math.round(armyStr(a) * 100)}%</b></div>${bar(armyStr(a), 1, '')}
  <div class="kv"><span>Organización</span><b>${Math.round(armyOrg(a) * 100)}%</b></div>${bar(armyOrg(a), 1, 'warn')}
  <div class="kv"><span>Entrenamiento</span><b>${trainName(armyTrain(a))} (${Math.round(armyTrain(a) * 100)}%) · rinde ×${(0.75 + 0.5 * armyTrain(a)).toFixed(2)}</b></div>${bar(armyTrain(a), 1, 'blue')}
  <div class="kv"><span>Suministro</span><b class="${(a.sup === undefined ? 1 : a.sup) < 0.5 ? 'bad' : ''}">${Math.round((a.sup === undefined ? 1 : a.sup) * 100)}%${a.cut > 0 ? ` · ⚠ cercado ${a.cut}/24 d` : ''}</b></div>${bar(a.sup === undefined ? 1 : a.sup, 1, (a.sup === undefined ? 1 : a.sup) < 0.5 ? 'bad' : 'good')}
  <div class="kv"><span>Hombres</span><b>${fmtN(armyMen(a), 0)}</b></div>
  <div class="kv"><span>Composición</span><b>${Object.keys(cnt).map(k => DIVS[k].icon + ' ' + cnt[k]).join(' · ')}</b></div>
  <div class="kv"><span>Atrincheramiento</span><b>${'■'.repeat(Math.round(a.dig || 0))}${'□'.repeat(6 - Math.round(a.dig || 0))}</b></div>
  <div class="kv"><span>Orden</span><b>${armyOrderText(a)}</b></div>
  <div class="divl">${a.divs.map(d => `<div class="dv" data-tip="${DIVS[d.t].name}: fuerza ${Math.round(d.s * 100)}%, organización ${Math.round(d.o / DIVS[d.t].org * 100)}%, entrenamiento ${trainName(d.tr === undefined ? 0.5 : d.tr)}">${DIVS[d.t].icon}<i style="height:${Math.round(d.s * 100)}%"></i><u style="height:${Math.round(d.o / DIVS[d.t].org * 100)}%"></u><em style="height:${Math.round((d.tr === undefined ? 0.5 : d.tr) * 100)}%"></em></div>`).join('')}</div>
  ${own ? `<p class="hint"><b>Clic derecho</b>: mover (sobre un enemigo: perseguir). <b>Mayús + clic derecho</b>: añadir punto de ruta. <b>Ctrl/Mayús + clic en ficha</b>: grupo${group ? ` (<b>${sel.length} seleccionados</b>)` : ''}.</p>
  <div class="strpick"><small>Estrategia en combate:</small> <button class="${a.strat ? '' : 'on'}" data-act="armystrat" data-s="">🤖 Auto</button>${Object.keys(STRATS).map(k => `<button class="${a.strat === k ? 'on' : ''}" data-act="armystrat" data-s="${k}" data-tip="${STRATS[k].desc}">${STRATS[k].icon}</button>`).join('')}</div>
  <div class="ordgrid">
    ${tg(UI.moveMode, 'movemode', '🎯 Mover')}${tg(UI.optFm || a.fm, 'optfm', '🥾 Marcha forzada')}${tg(UI.optRail || a.rail, 'optrail', '🚆 Ferrocarril')}${tg(UI.patrolNext, 'patrolmode', '🔁 Patrulla')}${tg(UI.landNext, 'landmode', '⚓ Desembarco')}
    ${tg(a.mode === 'hold', 'armymode', '🛡 Mantener', 'data-m="hold"')}${tg(a.mode === 'dig', 'armymode', '⛏ Atrincherar', 'data-m="dig"')}${tg(a.mode === 'train', 'armymode', '🎓 Entrenar', 'data-m="train"')}
    <button data-act="armystop" ${a.path.length || a.joinTo || a.patrol ? '' : 'disabled'}>✋ Detener</button><button data-act="armyretreat" ${a.battle ? 'disabled' : ''}>↩ Retirada</button><button data-act="armycap" ${a.battle ? 'disabled' : ''}>★ Capital</button>
    <button data-act="armysplit" ${a.divs.length < 2 || a.battle ? 'disabled' : ''}>✂ Dividir</button><button data-act="armydisband" ${a.battle ? 'disabled' : ''}>✖ Disolver</button>${b ? `<button data-act="selbattle" data-id="${b.id}">⚔ Batalla</button>` : ''}
  </div>
  ${friends.length ? `<div class="foes"><small class="dim">Juntar ejércitos</small>${friends.map(({o}) => `<div class="kv sm"><span>${o.name} · ${o.divs.length} div. · ${provName(o.loc)}</span><button data-act="armyjoin" data-id="${o.id}" ${a.divs.length + o.divs.length > MAX_DIVS_ARMY ? 'disabled' : ''}>⛓ Juntar</button></div>`).join('')}${group ? `<button class="block" data-act="groupjoin">⛓ Juntar todo el grupo en ${a.name}</button>` : ''}</div>` : ''}
  ${fronts.length ? `<div class="foes"><small class="dim">Asignar a un frente</small>${fronts.map(f => `<div class="kv sm"><span>${f.mode === 'attack' ? '⚔' : '🛡'} ${f.name}${a.front === f.id ? ' ✔' : ''}</span><button data-act="${a.front === f.id ? 'frontremove' : 'frontadd'}" data-f="${f.id}" data-id="${a.id}">${a.front === f.id ? 'Quitar' : 'Asignar'}</button></div>`).join('')}</div>` : ''}
  ${foes.length ? `<div class="foes"><small class="dim">Enemigos cercanos</small>${foes.map(({o}) => `<div class="kv sm"><span>${flag(o.tag, 'sm')} ${o.divs.length} div. · ${provName(o.loc)}${o.path.length ? ' ➜' : ''}</span><button data-act="chase" data-id="${o.id}">🎯 Perseguir</button></div>`).join('')}</div>` : ''}
  <div class="foes"><small class="dim">General al mando</small>${pool.length ? pool.map((g, i) => `<div class="kv sm"><span>🎖️ ${g.name} nv.${g.lvl} (${g.atk}/${g.def}/${g.log}) ${(g.traits || []).map(k => GEN_TRAITS[k].icon).join('')}</span><button data-act="assigngen" data-i="${i}" ${a.battle ? 'disabled' : ''}>Asignar</button></div>`).join('') : '<small class="dim">Sin generales en reserva (pestaña Generales).</small>'}</div>` : '<p class="hint">Ejército extranjero.</p>'}
  <div class="btnrow"><button data-act="focusprov" data-id="${a.loc}">📍 Centrar</button></div>`;
}

/* ---------- pestañas de frentes y generales ---------- */
function frontStatus(f) {
  if (!f.active) return '<span class="tag">⏸ Inactivo</span>';
  if (f.mode === 'defend') return '<span class="tag good">🛡 Defendiendo</span>';
  return f.phase === 'attack' ? '<span class="tag bad">⚔ Atacando</span>' : `<span class="tag warn">⏳ Preparando · +${Math.round(0.15 * Math.min(1, f.prep / 15) * 100)}% ataque (${f.prep} d)</span>`;
}
function frontsTabHtml() {
  const list = frontsOf(G.player);
  const landHtml = landingsHtml();
  const cards = list.map(f => {
    const arms = frontArmies(f); const en = f.targets.length ? G.C[provOwner(f.targets[0])].name : (G.wars.find(w => w.attAll.includes(G.player) || w.defAll.includes(G.player)) ? 'enemigo' : '—');
    return `<div class="card front ${f.mode}"><div class="kv"><b>${f.mode === 'attack' ? '⚔' : '🛡'} ${f.name}</b>${frontStatus(f)}</div>
    <div class="kv sm"><span>Línea</span><b>${f.line.length} provincias</b></div>${f.mode === 'attack' ? `<div class="kv sm"><span>Objetivos</span><b>${f.targets.length} (${en})</b></div>` : ''}
    <div class="kv sm"><span>Ejércitos asignados</span><b>${arms.length} · ${arms.reduce((n, a) => n + a.divs.length, 0)} div.</b></div>
    <div class="chips2">${arms.map(a => `<span class="tag clk" data-act="selarmy" data-id="${a.id}">${a.name}</span>`).join('') || '<small class="dim">Sin ejércitos: selecciona uno en el mapa y pulsa «Asignar seleccionados».</small>'}</div>
    <div class="btnrow"><button data-act="frontactive" data-f="${f.id}" class="${f.active ? '' : 'primary'}">${f.active ? '⏸ Pausar' : '▶ Activar plan'}</button>${f.mode === 'attack' ? `<button data-act="frontexec" data-f="${f.id}" ${f.phase === 'attack' && f.active ? 'disabled' : ''}>⚔ Ejecutar ataque</button>` : ''}
    <button data-act="frontmode" data-f="${f.id}">${f.mode === 'attack' ? '🛡 Pasar a defensa' : '⚔ Pasar a ataque'}</button><button data-act="frontassign" data-f="${f.id}">➕ Asignar seleccionados</button><button data-act="frontfocus" data-f="${f.id}">📍</button><button data-act="frontdel" data-f="${f.id}">✖ Borrar</button></div>
    ${f.mode === 'attack' ? `<label class="chk"><input type="checkbox" data-act="frontauto" data-f="${f.id}" ${f.auto ? 'checked' : ''}> Atacar automáticamente tras 12 días de preparación</label>` : ''}</div>`;
  }).join('');
  return `<div class="cols"><div class="col wide">${cards || '<div class="card"><p class="hint">No tienes planes. Crea uno y <b>dibuja la línea sobre una frontera</b> en el mapa.</p></div>'}</div>
  <div class="col">${landHtml}<div class="card"><h3>Nuevo plan</h3>
    <button class="block" data-act="newfront" data-m="defend">🛡 Plan de defensa</button><button class="block" data-act="newfront" data-m="attack">⚔ Plan de ataque</button>
    <p class="hint"><b>Defensa:</b> dibuja una línea de provincias; los ejércitos asignados se reparten por ella según la amenaza y se atrincheran.<br><b>Ataque:</b> dibuja la línea de partida y marca con flechas las provincias enemigas. Los ejércitos se concentran (hasta +15% de ataque tras 15 días de preparación) y, al ejecutar, avanzan sobre los objetivos; la línea avanza con las conquistas.<br>Los planes se <b>activan</b> con el botón ▶.</p></div></div></div>`;
}
function generalsTabHtml() {
  const c = me(), pool = genPool(c);
  const armiesG = armiesOf(G.player);
  const row = (g, where, act) => `<tr><td><b>🎖️ ${g.name}</b><br><small class="dim">${where}</small></td><td class="r">${g.lvl}</td><td>${stars(g.atk)}</td><td>${stars(g.def)}</td><td>${stars(g.log)}</td><td>${(g.traits || []).map(k => `<span class="tag" data-tip="${GEN_TRAITS[k].desc}">${GEN_TRAITS[k].icon} ${GEN_TRAITS[k].name}</span>`).join(' ') || '<small class="dim">—</small>'}</td><td>${act || ''}</td></tr>`;
  return `<div class="card"><h3>Generales</h3><p class="hint">Cada ejército tiene un general. Sus <b>rasgos</b> dan bonificaciones al ejército (ataque, defensa, velocidad, entrenamiento…). Los generales suben de nivel ganando batallas. Puedes reclutar generales de reserva y asignarlos desde el panel de un ejército.</p>
  <table class="tbl"><thead><tr><th>General</th><th class="r">Nv.</th><th>Ataque</th><th>Defensa</th><th>Logíst.</th><th>Rasgos</th><th></th></tr></thead><tbody>
  ${armiesG.map(a => row(a.gen, a.name + ' · ' + armyStateName(a), `<button data-act="selarmy" data-id="${a.id}">Ver</button>`)).join('')}
  ${pool.map((g, i) => row(g, 'En reserva', `<button data-act="dismissgen" data-i="${i}">Retirar</button>`)).join('')}
  </tbody></table>
  <div class="btnrow"><button class="primary" data-act="recruitgen">➕ Reclutar un general (${money(recruitGeneralCost(c))} + 15 infl.)</button></div></div>
  <div class="card"><h3>Rasgos de general</h3>${TRAIT_KEYS.map(k => `<div class="kv sm"><span>${GEN_TRAITS[k].icon} <b>${GEN_TRAITS[k].name}</b></span><small>${GEN_TRAITS[k].desc}</small></div>`).join('')}</div>`;
}

/* ---------- dibujo de líneas de frente ---------- */
function startDraw(mode) {
  UI.draw = {mode, step: 'line', line: [], targets: []}; closeWindow(); renderDrawBar();
  toast(mode === 'attack' ? '⚔' : '🛡', 'Haz clic en provincias, en orden, para dibujar la línea de ' + (mode === 'attack' ? 'partida. Después marca los objetivos enemigos.' : 'defensa. Clic derecho deshace el último punto.'));
}
function drawClick(pid) {
  const d = UI.draw; if (!d) return;
  if (d.step === 'line') {
    const last = d.line[d.line.length - 1];
    if (last === pid) return;
    if (last !== undefined && !MAP.provs[last].nb.includes(pid)) {
      const p = pathProvs(last, pid, () => true, (u, v) => provDist(u, v), 400); if (p) p.forEach(q => { if (!d.line.includes(q)) d.line.push(q); }); else return;
    } else if (!d.line.includes(pid)) d.line.push(pid);
  } else {
    const o = provOwner(pid); if (o === G.player || o === NONE) { toast('⚠️', 'Marca como objetivo una provincia enemiga.'); return; }
    const i = d.targets.indexOf(pid); if (i >= 0) d.targets.splice(i, 1); else d.targets.push(pid);
  }
  renderDrawBar(); R.labelsDirty = true;
}
function drawUndo() { const d = UI.draw; if (!d) return; if (d.step === 'targets' && d.targets.length) d.targets.pop(); else if (d.step === 'targets') d.step = 'line'; else d.line.pop(); renderDrawBar(); R.labelsDirty = true; }
function neighborCountries() {
  const set = new Set(); G.C[G.player].states.forEach(sid => MAP.stats[sid].provs.forEach(pid => MAP.provs[pid].nb.forEach(q => { const o = provOwner(q); if (o !== G.player && o !== NONE) set.add(o); })));
  return [...set].sort((a, b) => (hostileTags(G.player, b) ? 1 : 0) - (hostileTags(G.player, a) ? 1 : 0));
}
function renderDrawBar() {
  const root = $('#drawbar'); if (!root) return; const d = UI.draw;
  if (!d) { root.classList.remove('open'); root.innerHTML = ''; return; }
  root.classList.add('open');
  root.innerHTML = `<b>${d.mode === 'attack' ? '⚔ Plan de ataque' : '🛡 Plan de defensa'}</b> · ${d.step === 'line' ? `Paso 1: línea (${d.line.length} provincias)` : `Paso 2: objetivos (${d.targets.length})`}
  <select id="drawauto"><option value="">Línea automática frente a…</option>${neighborCountries().map(t => `<option value="${t}">${G.C[t].name}${hostileTags(G.player, t) ? ' (en guerra)' : ''}</option>`).join('')}</select>
  <button data-act="drawundo">↶ Deshacer</button>${d.mode === 'attack' && d.step === 'line' ? '<button data-act="drawnext" ' + (d.line.length ? '' : 'disabled') + '>Siguiente: objetivos ➜</button>' : ''}<button class="primary" data-act="drawfinish" ${d.line.length ? '' : 'disabled'}>✔ Terminar</button><button data-act="drawcancel">✖ Cancelar</button>`;
}
function finishDraw() {
  const d = UI.draw; if (!d || !d.line.length) return;
  const ids = selectedArmies().map(a => a.id);
  const f = createFront(G.player, d.line, d.mode, ids, d.targets);
  UI.draw = null; renderDrawBar(); UI.winTab.mil = 'fronts'; UI.win = null; openWindow('military');
  toast('🗺️', `${f.name} creado con ${ids.length} ejército(s). Pulsa ▶ Activar plan para ponerlo en marcha.`);
  R.labelsDirty = true;
}
// capa SVG de frentes (se dibuja junto a las órdenes de movimiento)
function frontsSvg() {
  const pt = pid => { const p = MAP.provs[pid]; const s = worldToScreen(p.lon, 0.5, -p.lat); return s[0].toFixed(1) + ',' + s[1].toFixed(1); };
  let h = '<defs><marker id="arr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="#e8644f"/></marker></defs>';
  const one = (line, targets, cls, active) => {
    if (line.length) h += `<polyline class="front ${cls} ${active ? 'act' : ''}" points="${line.map(pt).join(' ')}"/>` + line.map(p => { const [x, y] = pt(p).split(','); return `<circle class="front ${cls}" cx="${x}" cy="${y}" r="4"/>`; }).join('');
    targets.forEach(t => {
      let bp = line[0], bd = 1e9; line.forEach(p => { const d = provDist(p, t); if (d < bd) { bd = d; bp = p; } });
      const [x1, y1] = (bp !== undefined ? pt(bp) : pt(t)).split(','), [x2, y2] = pt(t).split(',');
      h += `<line class="arrow ${active ? 'act' : ''}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" marker-end="url(#arr)"/>`;
    });
  };
  frontsOf(G.player).forEach(f => one(f.line, f.mode === 'attack' ? f.targets : [], f.mode === 'attack' ? 'att' : 'def', f.active));
  if (UI.draw) one(UI.draw.line, UI.draw.targets, 'draw', true);
  (G.landings || []).filter(l => l.tag === G.player).forEach(l => { const [x1, y1] = pt(l.from).split(','), [x2, y2] = pt(l.to).split(','); h += `<line class="arrow sea ${l.active ? 'act' : ''}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" marker-end="url(#arr)"/>`; });
  return h;
}

/* ---------- panel de batalla con minimapa táctico ---------- */
function renderBattlePanel() {
  const root = $('#battlepanel'); if (!root) return;
  let b = UI.battle ? G.battles.find(x => x.id === UI.battle) : null;
  if (!b && UI.battle && G.lastEnded && G.lastEnded.id === UI.battle) b = G.lastEnded;
  if (!b) { root.classList.remove('open'); root.innerHTML = ''; root.dataset.bid = ''; UI.battle = null; return; }
  const done = !!b.ended;
  const side = (ids, isAtt, tag0) => {
    const as = ids.map(armyById).filter(Boolean); let men = 0, nd = 0, str = 0, org = 0; const types = {};
    as.forEach(a => { men += armyMen(a); a.divs.forEach(d => { nd++; str += d.s; org += d.o / DIVS[d.t].org; types[d.t] = (types[d.t] || 0) + 1; }); });
    const tag = as.length ? as[0].tag : tag0;
    const st = as.length ? sideStats(b, ids, isAtt) : {F: 0, T: 0, n: 0, org: 0, tr: 1};
    return {as, men, nd, str: nd ? str / nd : 0, org: nd ? org / nd : 0, types, tag, st, gens: as.map(a => a.gen)};
  };
  const A = side(b.A, true, b.A0), B = side(b.B, false, b.B0);
  const pv = MAP.provs[b.prov], terr = pv.terr;
  const bs = (S, cls, title, isAtt, lost) => `<div class="bside ${cls}"><h4>${S.tag ? flag(S.tag, 'sm') : ''} ${S.tag ? G.C[S.tag].name : '—'} <small class="dim">${title}</small></h4>
    <div class="kv sm"><span>Divisiones</span><b>${S.nd} ${Object.keys(S.types).map(k => DIVS[k].icon + S.types[k]).join(' ')}</b></div>
    <div class="kv sm"><span>Hombres</span><b>${fmtN(S.men, 0)}</b></div>
    <div class="kv sm"><span>Fuerza</span><b>${Math.round(S.str * 100)}%</b></div>${bar(S.str, 1, '')}
    <div class="kv sm"><span>Organización</span><b>${Math.round(S.org * 100)}%</b></div>${bar(S.org, 1, 'warn')}
    <div class="kv sm"><span>Ataque · Defensa</span><b>${f1(S.st.F)} · ${f1(S.st.T)}</b></div>
    <div class="kv sm"><span>Entrenamiento medio</span><b>×${S.st.tr.toFixed(2)}</b></div>
    <div class="kv sm"><span>Combaten / reserva</span><b>${S.st.n} / ${Math.max(0, S.nd - S.st.n)}</b></div>
    <div class="kv sm"><span>Generales</span><b>${S.gens.map(g => `${g.name} ${(g.traits || []).map(k => GEN_TRAITS[k].icon).join('')}`).join(', ') || '—'}</b></div>
    <div class="kv sm"><span>Atrinch. · Suministro</span><b>${isAtt ? '—' : '+' + Math.round(Math.min(6, Math.max(0, ...S.as.map(a => a.dig || 0), 0)) * 4) + '%'} · ${S.as.length ? Math.round(S.as.reduce((x, a) => x + (a.sup === undefined ? 1 : a.sup), 0) / S.as.length * 100) + '%' : '—'}</b></div>
    <div class="kv sm"><span>Bajas</span><b class="bad">${fmtN(lost || 0, 0)}</b></div></div>`;
  const W = 520, Hh = 50;
  const hist = b.hist || [];
  const line = (i, col) => hist.length > 1 ? `<polyline fill="none" stroke="${col}" stroke-width="2" points="${hist.map((h, k) => (k / (hist.length - 1) * W).toFixed(1) + ',' + (Hh - h[i] * Hh).toFixed(1)).join(' ')}"/>` : '';
  const log = (b.log || []).slice(-6).reverse();
  root.classList.add('open');
  if (root.dataset.bid !== String(b.id)) {
    root.dataset.bid = b.id; root._sb = '';
    root.innerHTML = `<div class="sp-head"><div><h2 id="bt-title"></h2><small id="bt-sub"></small></div><button class="x" data-act="closebattle">✕</button></div>
    <canvas id="bmap" width="${BV_W}" height="${BV_H}"></canvas><div id="bt-strat"></div><div id="bt-stats"></div><div id="bt-hist"></div><div id="bt-log" class="blog"></div>`;
    R.bviz = null;
  }
  $('#bt-title').textContent = '⚔ Batalla de ' + provName(b.prov);
  $('#bt-sub').textContent = `${done ? 'Batalla finalizada' : 'Día ' + b.day} · ${BIOME_NAMES[pv.biome] || ''} · defensa ×${terr.def.toFixed(2)} · movilidad ×${terr.move.toFixed(2)}`;
  const mySide = [['A', A], ['B', B]].find(([k, S]) => S.tag === G.player), sn = k => STRATS[b['str' + k]] || STRATS.frontal;
  const sTag = (k, S) => `<span class="stc ${k === 'A' ? 'att' : 'def'}">${S.tag ? flag(S.tag, 'sm') : ''} ${sn(k).icon} <b>${sn(k).name}</b></span>`;
  let sh = `<div class="strbar">${sTag('A', A)}<span class="dim">contra</span>${sTag('B', B)}</div>`;
  if (mySide && !done) {
    const ma = (mySide[0] === 'A' ? b.A : b.B).map(armyById).filter(Boolean), cur = (ma.find(a => a.strat) || {}).strat || '';
    sh += `<div class="strpick"><small>Tu estrategia:</small> <button class="${cur === '' ? 'on' : ''}" data-act="battlestrat" data-s="">🤖 Automática</button>${Object.keys(STRATS).map(k => `<button class="${cur === k ? 'on' : ''}" data-act="battlestrat" data-s="${k}" data-tip="${STRATS[k].desc}">${STRATS[k].icon} ${STRATS[k].name}</button>`).join('')}</div>`;
  }
  if (root._sb !== sh) { root._sb = sh; $('#bt-strat').innerHTML = sh; }
  $('#bt-stats').innerHTML = `<div class="bsides">${bs(A, 'att', 'Atacante', true, b.lostA)}${bs(B, 'def', 'Defensor', false, b.lostB)}</div>`;
  $('#bt-hist').innerHTML = `<svg class="bhist" viewBox="0 0 ${W} ${Hh}" preserveAspectRatio="none">${line(0, '#e8644f')}${line(1, '#6aa8e8')}</svg>
  <small class="dim">Organización: <span style="color:#e8644f">atacante</span> · <span style="color:#6aa8e8">defensor</span> · frente: ${b.adv > 0.15 ? 'avanza el atacante' : b.adv < -0.15 ? 'avanza el defensor' : 'equilibrado'}</small>`;
  $('#bt-log').innerHTML = log.length ? log.map(e => `<div class="ev ${e.k}">${EV_ICON[e.k] || '•'} <small>día ${e.d}</small> ${e.t}</div>`).join('') : '<small class="dim">Aún no ha ocurrido nada destacable…</small>';
  bvStart();
}
function drawBattleMap(cv, b, A, B) {
  if (!cv) return; const g = cv.getContext('2d'), W = cv.width, H = cv.height, pv = MAP.provs[b.prov];
  const bc = BIOME_COL[pv.biome] || [120, 140, 90];
  const grd = g.createLinearGradient(0, 0, 0, H); grd.addColorStop(0, `rgb(${bc[0] * 0.8 | 0},${bc[1] * 0.8 | 0},${bc[2] * 0.8 | 0})`); grd.addColorStop(1, `rgb(${bc[0] * 0.55 | 0},${bc[1] * 0.55 | 0},${bc[2] * 0.55 | 0})`);
  g.fillStyle = grd; g.fillRect(0, 0, W, H);
  // relieve decorativo determinista
  for (let i = 0; i < 38; i++) {
    const x = hash2(i, b.id, 3) * W, y = 10 + hash2(i, b.id, 7) * (H - 20), t = pv.biome;
    g.fillStyle = 'rgba(0,0,0,.18)';
    if (t === 2 || t === 6) { g.beginPath(); g.moveTo(x, y - 9); g.lineTo(x - 5, y + 3); g.lineTo(x + 5, y + 3); g.fill(); }
    else if (t === 7 || t === 8) { g.beginPath(); g.moveTo(x, y - 11); g.lineTo(x - 9, y + 5); g.lineTo(x + 9, y + 5); g.fill(); }
    else { g.fillRect(x, y, 6, 1.5); }
  }
  b.advD = (b.advD === undefined ? (b.adv || 0) : b.advD + ((b.adv || 0) - b.advD) * 0.35);
  const x0 = W / 2 + b.advD * 80;
  g.strokeStyle = 'rgba(255,230,150,.55)'; g.setLineDash([6, 5]); g.beginPath(); g.moveTo(x0, 6); g.lineTo(x0, H - 6); g.stroke(); g.setLineDash([]);
  const draw = (S, dir, isAtt) => {
    const col = S.tag ? G.C[S.tag].color : '#888';
    let k = 0;
    S.as.forEach(a => a.divs.forEach(d => {
      const info = DIVS[d.t], front = k < S.st.n, i = front ? k : k - S.st.n;
      const rows = 5, cx = front ? Math.floor(i / rows) : 3 + Math.floor(i / rows), ry = i % rows;
      const x = x0 + dir * (26 + cx * 34), y = H / 2 + (ry - (rows - 1) / 2) * 33 + (cx % 2 ? 8 : 0) + (front ? 0 : 6);
      const w = 28, h = 20; g.globalAlpha = front ? 1 : 0.55;
      g.fillStyle = '#10161b'; g.fillRect(x - w / 2, y - h / 2, w, h);
      g.fillStyle = col; g.fillRect(x - w / 2 + 1, y - h / 2 + 1, w - 2, 6);
      g.strokeStyle = d.o / info.org < 0.25 ? '#ff5a3c' : '#f0e2b0'; g.lineWidth = 1; g.strokeRect(x - w / 2, y - h / 2, w, h);
      g.fillStyle = '#f5ecd0'; g.font = 'bold 9px sans-serif'; g.textAlign = 'center'; g.fillText(d.t === 'inf' ? 'INF' : d.t === 'cav' ? 'CAB' : 'ART', x, y + 5);
      g.fillStyle = '#79c35a'; g.fillRect(x - w / 2 + 1, y + h / 2 - 3, (w - 2) * d.s, 2);
      g.fillStyle = '#e0b04a'; g.fillRect(x - w / 2 + 1, y + h / 2 - 5, (w - 2) * (d.o / info.org), 1.5);
      g.globalAlpha = 1; k++;
      void isAtt;
    }));
  };
  draw(A, -1, true); draw(B, 1, false);
  // flechas de avance
  const adv = b.adv || 0, ac = adv >= 0 ? '#e8644f' : '#6aa8e8';
  g.strokeStyle = ac; g.fillStyle = ac; g.lineWidth = 3; const dir = adv >= 0 ? 1 : -1, len = 18 + Math.abs(adv) * 40;
  g.beginPath(); g.moveTo(x0 - dir * len, 14); g.lineTo(x0 + dir * len, 14); g.stroke(); g.beginPath(); g.moveTo(x0 + dir * (len + 8), 14); g.lineTo(x0 + dir * len, 9); g.lineTo(x0 + dir * len, 19); g.fill();
  // efecto del último suceso
  const fl = b.flash;
  if (fl && fl.d >= b.day - 1) {
    const ev = (b.log || [])[b.log.length - 1]; const target = fl.s; const tx = x0 + (target === 'A' ? -1 : 1) * 70;
    g.font = 'bold 13px sans-serif'; g.textAlign = 'center'; g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(W / 2 - 150, H - 30, 300, 22); g.fillStyle = '#ffe28a';
    g.fillText(`${EV_ICON[fl.k] || ''} ${({barrage: 'Cañoneo', charge: '¡Carga desesperada!', cav: 'Carga de caballería', flank: 'Flanqueo', panic: 'Pánico', reinf: 'Refuerzos', rain: 'Lluvia'})[fl.k] || ''}`, W / 2, H - 14);
    if (fl.k === 'barrage' || fl.k === 'cav' || fl.k === 'charge') {
      const ox = fl.k === 'barrage' ? x0 + (target === 'A' ? 1 : -1) * 70 : tx;
      for (let i = 0; i < 9; i++) { const rx = ox + (hash2(i, b.day, 11) - 0.5) * 90, ry = H / 2 + (hash2(i, b.day, 13) - 0.5) * 150; g.fillStyle = fl.k === 'barrage' ? 'rgba(255,150,40,.75)' : 'rgba(255,255,255,.25)'; g.beginPath(); g.arc(rx, ry, fl.k === 'barrage' ? 7 : 4, 0, 6.3); g.fill(); }
    }
    if (fl.k === 'rain') { g.strokeStyle = 'rgba(170,200,255,.5)'; for (let i = 0; i < 40; i++) { const x = hash2(i, b.day, 5) * W, y = hash2(i, b.day, 6) * H; g.beginPath(); g.moveTo(x, y); g.lineTo(x - 4, y + 10); g.stroke(); } }
    void ev;
  }
}

/* ---------- acciones ---------- */
Object.assign(ACT, {
  battlestrat: d => { const b = G.battles.find(x => x.id === UI.battle); if (!b) return; [...b.A, ...b.B].map(armyById).filter(a => a && a.tag === G.player).forEach(a => { a.strat = d.s || null; }); updateStrategies(b); renderBattlePanel(); },
  armystrat: d => { selectedArmies().forEach(a => { a.strat = d.s || null; }); renderArmyPanel(); },
  optfm: () => { UI.optFm = !UI.optFm; const l = selectedArmies(); l.forEach(a => { if (a.path.length) a.fm = UI.optFm; }); renderArmyPanel(); },
  optrail: () => { UI.optRail = !UI.optRail; renderArmyPanel(); },
  patrolmode: () => { UI.patrolNext = !UI.patrolNext; UI.moveMode = false; document.body.classList.toggle('movemode', UI.patrolNext); if (UI.patrolNext) toast('🔁', 'Modo patrulla: haz clic en el otro extremo de la ruta.'); renderArmyPanel(); },
  armymode: d => { selectedArmies().forEach(a => setMode(a, d.m)); renderArmyPanel(); R.labelsDirty = true; },
  armystop: () => { selectedArmies().forEach(orderStop); renderArmyPanel(); R.labelsDirty = true; },
  armyretreat: () => { selectedArmies().forEach(a => { const r = orderRetreat(a); if (!r.ok) toast('⚠️', r.msg); }); renderArmyPanel(); R.labelsDirty = true; },
  armycap: () => { selectedArmies().forEach(a => { const r = orderMove(a, stateCapitalProv(me().capital), false, {rail: UI.optRail, fm: UI.optFm}); if (!r.ok) toast('⚠️', r.msg); }); renderArmyPanel(); R.labelsDirty = true; },
  armyjoin: d => { const a = armyById(UI.selArmy), t = armyById(+d.id); if (a && t) { const r = orderJoin(a, t); toast(r.ok ? '⛓' : '⚠️', r.ok ? (a.loc === t.loc ? 'Fusionando…' : `${a.name} se dirige a ${t.name} para juntarse.`) : r.msg); renderArmyPanel(); } },
  groupjoin: () => { const l = selectedArmies(), lead = l[0]; l.slice(1).forEach(a => orderJoin(a, lead)); toast('⛓', `${l.length - 1} ejércitos se dirigen a ${lead.name} para fusionarse.`); renderArmyPanel(); },
  assigngen: d => { const a = armyById(UI.selArmy); if (a && assignGeneral(a, +d.i)) { toast('🎖️', `${a.gen.name} toma el mando de ${a.name}.`); renderArmyPanel(); } },
  recruitgen: () => { const r = recruitGeneral(me()); toast(r.ok ? '🎖️' : '⚠️', r.msg); renderWindow(); },
  dismissgen: d => { genPool(me()).splice(+d.i, 1); renderWindow(); },
  newfront: d => startDraw(d.m),
  drawundo: drawUndo,
  drawnext: () => { UI.draw.step = 'targets'; renderDrawBar(); toast('🎯', 'Haz clic en las provincias enemigas que quieres atacar (otro clic las quita).'); },
  drawfinish: finishDraw,
  drawcancel: () => { UI.draw = null; renderDrawBar(); R.labelsDirty = true; },
  frontactive: d => { const f = G.fronts.find(x => x.id === +d.f); if (f) { activateFront(f, !f.active); renderWindow(); } },
  frontexec: d => { const f = G.fronts.find(x => x.id === +d.f); if (f) { const r = executeAttack(f); toast(r.ok ? '⚔' : '⚠️', r.ok ? `${f.name}: ¡ofensiva en marcha!` : r.msg); renderWindow(); R.labelsDirty = true; } },
  frontmode: d => { const f = G.fronts.find(x => x.id === +d.f); if (f) { f.mode = f.mode === 'attack' ? 'defend' : 'attack'; f.phase = 'prep'; f.prep = 0; f.dirty = true; if (f.mode === 'defend') { f.name = f.name.replace('Ofensiva', 'Defensa'); } else f.name = f.name.replace('Defensa', 'Ofensiva'); renderWindow(); R.labelsDirty = true; } },
  frontassign: d => { const f = G.fronts.find(x => x.id === +d.f); if (f) { const l = selectedArmies(); l.forEach(a => addToFront(f, a)); toast('➕', l.length ? `${l.length} ejército(s) asignados a ${f.name}.` : 'Selecciona antes un ejército en el mapa.'); renderWindow(); } },
  frontadd: d => { const f = G.fronts.find(x => x.id === +d.f), a = armyById(+d.id); if (f && a) { addToFront(f, a); renderArmyPanel(); } },
  frontremove: d => { const f = G.fronts.find(x => x.id === +d.f), a = armyById(+d.id); if (f && a) { removeFromFront(f, a); renderArmyPanel(); } },
  frontfocus: d => { const f = G.fronts.find(x => x.id === +d.f); if (f && f.line.length) focusProv(f.line[Math.floor(f.line.length / 2)], 35); },
  frontdel: d => { const f = G.fronts.find(x => x.id === +d.f); if (f) { deleteFront(f); renderWindow(); R.labelsDirty = true; } },
  frontauto: d => { const f = G.fronts.find(x => x.id === +d.f); if (f) f.auto = !f.auto; }
});
document.addEventListener('change', e => {
  const el = e.target;
  if (el.id === 'drawauto' && el.value && UI.draw) { const r = autoFront(G.player, el.value); UI.draw.line = r.line; if (UI.draw.mode === 'attack') UI.draw.targets = r.targets; renderDrawBar(); R.labelsDirty = true; if (!r.line.length) toast('⚠️', 'No hay frontera con ese país.'); }
  else if (el.dataset && el.dataset.act === 'frontauto') ACT.frontauto(el.dataset);
});
