/* ===== CAMPAÑAS Y OBJETIVOS + HOT-SEAT =====
   · CAMPAÑAS: al empezar (o desde ☰ → 🎯 Campaña) se puede aceptar una campaña con metas y fecha límite. Cada mes se evalúan las metas; si se cumplen todas llega la victoria
     (con puntuación según el tiempo que sobre); si vence el plazo se juzga el porcentaje de metas cumplidas; si tu país desaparece, derrota. Después puedes seguir jugando en partida libre.
     La campaña se guarda en el país del jugador (c.camp) con una «foto» inicial (estados, PIB, prestigio…) sobre la que se miden las metas relativas.
   · HOT-SEAT: 2 o más jugadores humanos en el mismo navegador, por turnos de tiempo (1, 3 o 12 meses). Al acabar el turno el juego se pausa, una pantalla opaca oculta el mapa y
     pide pasar el control; al confirmar cambia G.player y se refresca la interfaz. Los países humanos no están controlados por la IA (solo actúan en su turno). */
const OV_ID = 'ov3';
function ovShow(html, cls) {
  let e = document.getElementById(OV_ID); if (!e) { e = document.createElement('div'); e.id = OV_ID; document.body.appendChild(e); }
  e.className = 'on ' + (cls || ''); e.innerHTML = `<div class="ovbox">${html}</div>`;
}
function ovHide() { const e = document.getElementById(OV_ID); if (e) { e.className = ''; e.innerHTML = ''; } }
(function () {
  const st = document.createElement('style'); st.textContent = `#ov3{display:none;position:fixed;inset:0;z-index:9500;background:rgba(6,10,16,.72);align-items:center;justify-content:center;padding:16px;overflow:auto}
#ov3.on{display:flex}#ov3.opaque{background:#0a0e14}#ov3 .ovbox{max-width:640px;width:100%;max-height:92vh;overflow:auto;background:linear-gradient(180deg,#1e2833,#141b23);border:1px solid var(--gold,#c9a45c);border-radius:14px;padding:18px 20px;color:#e8e2d0;box-shadow:0 20px 60px rgba(0,0,0,.6)}
#ov3 h2{margin:0 0 6px;font-size:1.25em}#ov3 h3{margin:12px 0 6px;font-size:1em;color:var(--gold,#c9a45c)}#ov3 p{margin:6px 0;line-height:1.45}
#ov3 .cmp{border:1px solid rgba(255,255,255,.14);border-radius:10px;padding:10px 12px;margin:8px 0;background:rgba(255,255,255,.04)}#ov3 .cmp b{font-size:1.02em}
#ov3 .cmp ul{margin:6px 0 0;padding-left:18px}#ov3 .btns{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}
#ov3 button{padding:8px 14px;border-radius:8px;border:1px solid rgba(255,255,255,.25);background:rgba(255,255,255,.08);color:#fff;cursor:pointer;font:inherit}
#ov3 button.pri{background:#9a7b2f;border-color:#d8b95e;font-weight:600}#ov3 .ok{color:#8fd48f}#ov3 .no{color:#d98c8c}#ov3 small{opacity:.75}#ov3 select{padding:6px;border-radius:6px;background:#10161d;color:#fff;border:1px solid #556}`;
  document.head.appendChild(st);
})();
const campStart = c => ({st: c.states.length, gdp: c.stats.gdp || 1, pop: c.stats.pop || 1, pres: c.prestige || 1, rank: c.rank || 99, sol: c.stats.sol || 1, y: G.date.y, m: G.date.m});
const campFoes = (tags, frac, k) => tags.filter(t => G.C[t]).map(t => ({t: `${G.C[t].name} reducida a menos del ${Math.round(frac * 100)}% de sus estados`, ok: !alive(t) || G.C[t].states.length <= (k.foes && k.foes[t] != null ? k.foes[t] : 99) * frac, p: alive(t) ? `${G.C[t].states.length} estados` : 'eliminada'}));
const westCoast = c => c.states.some(id => { const l = stateLL(id); return l.lon < -115 && l.lat > 30 && l.lat < 50; });
const CAMPS = [
  {id: 'ascenso', ic: '📈', n: 'Ascenso de una potencia', d: 'Haz crecer tu país: más economía, más territorio y más prestigio.', yrs: {1836: 30, 1910: 20, 1939: 6},
    goals: (c, k) => [{t: 'Duplicar el PIB', ok: c.stats.gdp >= k.gdp * 2, p: `${(c.stats.gdp / k.gdp).toFixed(2)}×`}, {t: 'Aumentar un 20 % el número de estados', ok: c.states.length >= Math.ceil(k.st * 1.2), p: `${c.states.length}/${Math.ceil(k.st * 1.2)}`}, {t: 'Subir un 50 % el prestigio', ok: c.prestige >= k.pres * 1.5, p: `${Math.round(c.prestige)}/${Math.round(k.pres * 1.5)}`}]},
  {id: 'hegemonia', ic: '👑', n: 'Hegemonía mundial', d: 'Alcanza el primer puesto del mundo y consérvalo con la economía y el ejército más fuertes.', yrs: {1836: 40, 1910: 25, 1939: 7}, need: c => c.rank <= 8,
    goals: (c, k) => [{t: 'Ser la potencia nº 1 del mundo', ok: c.rank === 1, p: `puesto ${c.rank}`}, {t: 'Legitimidad por encima del 60 %', ok: c.legitimacy >= 60, p: `${Math.round(c.legitimacy)} %`}, {t: 'Mantener al menos el 90 % de tus estados', ok: c.states.length >= k.st * 0.9, p: `${c.states.length}/${Math.ceil(k.st * 0.9)}`}]},
  {id: 'imperio', ic: '🏰', n: 'Imperio', d: 'Expande tu territorio por la fuerza o la diplomacia.', yrs: {1836: 35, 1910: 15, 1939: 6},
    goals: (c, k) => [{t: 'Duplicar el número de estados', ok: c.states.length >= k.st * 2, p: `${c.states.length}/${k.st * 2}`}, {t: 'Quedar entre las 5 mayores potencias', ok: c.rank <= 5, p: `puesto ${c.rank}`}]},
  {id: 'paz', ic: '🕊️', n: 'Paz próspera', d: 'Sin guerras: bienestar, estabilidad y progreso.', yrs: {1836: 25, 1910: 15, 1939: 6},
    goals: (c, k) => [{t: 'Elevar un 30 % el nivel de vida', ok: c.stats.sol >= k.sol * 1.3, p: `${(c.stats.sol / k.sol).toFixed(2)}×`}, {t: 'Legitimidad por encima del 70 %', ok: c.legitimacy >= 70, p: `${Math.round(c.legitimacy)} %`}, {t: 'Terminar en paz', ok: !c.wars.length, p: c.wars.length ? 'en guerra' : 'en paz'}, {t: 'Crecer un 40 % el PIB', ok: c.stats.gdp >= k.gdp * 1.4, p: `${(c.stats.gdp / k.gdp).toFixed(2)}×`}]},
  {id: 'superviviente', ic: '🛡️', n: 'Sobrevivir a la tormenta', d: 'Atraviesa la era de las guerras mundiales sin perder tu país, tu capital ni tu estabilidad.', yrs: {1910: 15, 1939: 6},
    goals: (c, k) => [{t: 'Conservar al menos el 80 % de tus estados', ok: c.states.length >= k.st * 0.8, p: `${c.states.length}/${Math.ceil(k.st * 0.8)}`}, {t: 'Conservar la capital', ok: c.capital >= 0 && G.S[c.capital].owner === c.tag, p: c.capital >= 0 && G.S[c.capital].owner === c.tag ? 'en tu poder' : 'perdida'}, {t: 'No quedar sometido a otro país', ok: !c.overlord, p: c.overlord ? 'vasallo' : 'independiente'}], endOnTime: true},
  {id: 'unif_ger', ic: '🦅', n: 'La unificación alemana', d: 'Prusia debe liderar la unión de Alemania y ser una de las tres mayores potencias.', yrs: {1836: 40}, tags: ['PRU'],
    goals: (c, k) => [{t: 'Proclamar el Imperio Alemán', ok: histDone('ger'), p: histDone('ger') ? 'hecho' : 'pendiente'}, {t: 'Ser una de las 3 mayores potencias', ok: c.rank <= 3, p: `puesto ${c.rank}`}]},
  {id: 'unif_ita', ic: '🇮🇹', n: 'El Risorgimento', d: 'Cerdeña debe unificar Italia y asentarse como gran potencia.', yrs: {1836: 40}, tags: ['SAR'],
    goals: (c, k) => [{t: 'Proclamar el Reino de Italia', ok: histDone('ita'), p: histDone('ita') ? 'hecho' : 'pendiente'}, {t: 'Ser una de las 8 mayores potencias', ok: c.rank <= 8, p: `puesto ${c.rank}`}]},
  {id: 'meiji', ic: '🗾', n: 'La Restauración Meiji', d: 'Abre y moderniza Japón antes de que las potencias lo repartan.', yrs: {1836: 50}, tags: ['JAP'],
    goals: (c, k) => [{t: 'Completar la Restauración Meiji', ok: histDone('meiji'), p: histDone('meiji') ? 'hecho' : 'pendiente'}, {t: 'Triplicar el PIB', ok: c.stats.gdp >= k.gdp * 3, p: `${(c.stats.gdp / k.gdp).toFixed(2)}×`}, {t: 'Quedar entre las 8 mayores potencias', ok: c.rank <= 8, p: `puesto ${c.rank}`}]},
  {id: 'manifest', ic: '🗽', n: 'Destino manifiesto', d: 'Llega hasta el Pacífico, preserva la Unión y convierte a EE. UU. en gigante industrial.', yrs: {1836: 45}, tags: ['USA'],
    goals: (c, k) => [{t: 'Poseer territorio en la costa del Pacífico', ok: westCoast(c), p: westCoast(c) ? 'sí' : 'no'}, {t: 'Triplicar el PIB', ok: c.stats.gdp >= k.gdp * 3, p: `${(c.stats.gdp / k.gdp).toFixed(2)}×`}, {t: 'Ser una de las 3 mayores potencias', ok: c.rank <= 3, p: `puesto ${c.rank}`}]},
  {id: 'pax', ic: '🇬🇧', n: 'Pax Britannica', d: 'Mantén el primer puesto mundial y amplía tu imperio.', yrs: {1836: 45}, tags: ['GBR'],
    goals: (c, k) => [{t: 'Ser la potencia nº 1 del mundo', ok: c.rank === 1, p: `puesto ${c.rank}`}, {t: 'Aumentar un 30 % el número de estados', ok: c.states.length >= Math.ceil(k.st * 1.3), p: `${c.states.length}/${Math.ceil(k.st * 1.3)}`}, {t: 'Duplicar el PIB', ok: c.stats.gdp >= k.gdp * 2, p: `${(c.stats.gdp / k.gdp).toFixed(2)}×`}]},
  {id: 'rus_rev', ic: '❄️', n: 'Rusia ante la revolución', d: 'Evita el colapso del Imperio: guerra, hambre y revolución amenazan al zar.', yrs: {1910: 15}, tags: ['RUS'],
    goals: (c, k) => [{t: 'Mantener al menos el 75 % de tus estados', ok: c.states.length >= k.st * 0.75, p: `${c.states.length}/${Math.ceil(k.st * 0.75)}`}, {t: 'Legitimidad por encima del 45 %', ok: c.legitimacy >= 45, p: `${Math.round(c.legitimacy)} %`}], endOnTime: true},
  {id: 'gran_guerra', ic: '💥', n: 'Ganar la Gran Guerra', d: 'Gana al menos una guerra y termina con más estados que al comenzar.', yrs: {1910: 10}, tags: ['GBR', 'FRA', 'PRU', 'AUS', 'RUS', 'OTT', 'SAR', 'JAP', 'USA'],
    goals: (c, k) => [{t: 'Ganar una guerra', ok: ((c.cnt && c.cnt.warsWon) || 0) >= 1, p: `${(c.cnt && c.cnt.warsWon) || 0} ganadas`}, {t: 'Terminar con más estados que al empezar', ok: c.states.length > k.st, p: `${c.states.length}/${k.st + 1}`}]},
  {id: 'resistir', ic: '🇬🇧', n: 'Resistir y vencer', d: 'Sobrevive al ataque del Eje y derrota a Alemania.', yrs: {1939: 6}, tags: ['GBR'], foes: ['PRU'],
    goals: (c, k) => [{t: 'Conservar la capital', ok: c.capital >= 0 && G.S[c.capital].owner === c.tag, p: 'capital'}].concat(campFoes(['PRU'], 0.45, k))},
  {id: 'reich', ic: '🦅', n: 'Dominar Europa', d: 'Derrota a Francia y a Gran Bretaña y duplica tu territorio.', yrs: {1939: 6}, tags: ['PRU'], foes: ['FRA', 'GBR'],
    goals: (c, k) => [{t: 'Duplicar el número de estados', ok: c.states.length >= k.st * 2, p: `${c.states.length}/${k.st * 2}`}].concat(campFoes(['FRA', 'GBR'], 0.5, k))},
  {id: 'gpv', ic: '❄️', n: 'La Gran Guerra Patria', d: 'Sobrevive a la invasión y aplasta a Alemania.', yrs: {1939: 6}, tags: ['RUS'], foes: ['PRU'],
    goals: (c, k) => [{t: 'Conservar al menos el 70 % de tus estados', ok: c.states.length >= k.st * 0.7, p: `${c.states.length}/${Math.ceil(k.st * 0.7)}`}].concat(campFoes(['PRU'], 0.4, k))},
  {id: 'arsenal', ic: '🗽', n: 'El arsenal de la democracia', d: 'Convierte tu industria en la fábrica de los aliados y derrota a Alemania y Japón.', yrs: {1939: 6}, tags: ['USA'], foes: ['PRU', 'JAP'],
    goals: (c, k) => [{t: 'Aumentar un 50 % el PIB', ok: c.stats.gdp >= k.gdp * 1.5, p: `${(c.stats.gdp / k.gdp).toFixed(2)}×`}].concat(campFoes(['PRU', 'JAP'], 0.5, k))},
  {id: 'esfera', ic: '🌅', n: 'La esfera de coprosperidad', d: 'Domina Asia y el Pacífico antes de que la industria americana te alcance.', yrs: {1939: 6}, tags: ['JAP'],
    goals: (c, k) => [{t: 'Aumentar un 80 % el número de estados', ok: c.states.length >= Math.ceil(k.st * 1.8), p: `${c.states.length}/${Math.ceil(k.st * 1.8)}`}, {t: 'Conservar la capital', ok: c.capital >= 0 && G.S[c.capital].owner === c.tag, p: 'capital'}]}
];
const campYear = () => { const y = G.date.y; return y >= 1939 ? 1939 : y >= 1900 ? 1910 : 1836; };
const campsFor = tag => { const c = G.C[tag], ep = G.scenYear || campYear(); return CAMPS.filter(d => d.yrs[ep] && (!d.tags || d.tags.includes(tag)) && (!d.need || d.need(c))); };
const campDef = id => CAMPS.find(d => d.id === id);
function campBegin(tag, id) {
  const c = G.C[tag], d = campDef(id); if (!c || !d) return; const ep = G.scenYear || campYear(), k = campStart(c); k.foes = {}; (d.foes || []).forEach(t => { if (G.C[t]) k.foes[t] = G.C[t].states.length; });
  const end = {y: G.date.y + d.yrs[ep], m: G.date.m}; if (d.endOnTime) end.m = 12; if (ep === 1939) { end.y = Math.min(end.y, 1945); end.m = 12; }
  c.camp = {id, k, until: end, done: null}; toast('🎯', `Campaña «${d.n}» aceptada. Plazo: ${end.m}/${end.y}.`);
}
function campEval(c) { const cp = c.camp, d = cp && campDef(cp.id); return d ? d.goals(c, cp.k) : []; }
function campFinish(c, res, goals) {
  const cp = c.camp, d = campDef(cp.id), okN = goals.filter(g => g.ok).length, frac = goals.length ? okN / goals.length : 0;
  const left = (cp.until.y - G.date.y) * 12 + (cp.until.m - G.date.m), score = Math.round(frac * 100 + (res === 'win' ? Math.max(0, left) * 0.5 : 0));
  cp.done = res; cp.score = score; try { localStorage.setItem('victoria-camp-' + cp.id, String(Math.max(score, +localStorage.getItem('victoria-camp-' + cp.id) || 0))); } catch (e) { }
  const title = res === 'win' ? '🏆 ¡Victoria!' : res === 'part' ? '🥈 Victoria parcial' : '💀 Derrota';
  G.paused = true; if (typeof updateHud === 'function') updateHud();
  ovShow(`<h2>${title}</h2><p><b>${d.ic} ${d.n}</b> — ${dateStr()}</p><ul>${goals.map(g => `<li class="${g.ok ? 'ok' : 'no'}">${g.ok ? '✔' : '✘'} ${g.t} <small>(${g.p})</small></li>`).join('')}</ul><p>Puntuación: <b>${score}</b>${res === 'win' ? ' (incluye bonificación por tiempo)' : ''}.</p><div class="btns"><button class="pri" data-act="ovclose">Seguir jugando en partida libre</button></div>`);
}
function campMonth() {
  if (G.hs) return; const c = G.C[G.player]; if (!c || !c.camp || c.camp.done) return;
  const goals = campEval(c), cp = c.camp;
  if (!c.states.length) { campFinish(c, 'lose', goals); return; }
  if (goals.length && goals.every(g => g.ok) && !campDef(cp.id).endOnTime) { campFinish(c, 'win', goals); return; }
  const over = G.date.y > cp.until.y || (G.date.y === cp.until.y && G.date.m >= cp.until.m);
  if (over) { const frac = goals.filter(g => g.ok).length / Math.max(1, goals.length); campFinish(c, goals.every(g => g.ok) ? 'win' : frac >= 0.6 ? 'part' : 'lose', goals); }
}
function campPanel() {
  const c = G.C[G.player]; if (!c) return;
  if (!c.camp) { const list = campsFor(G.player); ovShow(`<h2>🎯 Campañas</h2><p>Acepta una campaña con metas y plazo. Si las cumples a tiempo, ganas. Puedes jugar también en partida libre.</p>${list.map(d => `<div class="cmp"><b>${d.ic} ${d.n}</b> <small>· plazo ${d.yrs[G.scenYear || campYear()]} años${(G.scenYear || campYear()) === 1939 ? ' (hasta 1945)' : ''}</small><p>${d.d}</p><ul>${d.goals(c, Object.assign(campStart(c), {foes: {}})).map(g => `<li>${g.t}</li>`).join('')}</ul><div class="btns"><button class="pri" data-act="campgo" data-id="${d.id}">Aceptar</button></div></div>`).join('') || '<p>No hay campañas para este país y época.</p>'}<div class="btns"><button data-act="ovclose">Partida libre</button></div>`); return; }
  const d = campDef(c.camp.id), goals = campEval(c);
  ovShow(`<h2>${d.ic} ${d.n}</h2><p>${d.d}</p><p>Plazo: <b>${c.camp.until.m}/${c.camp.until.y}</b>${c.camp.done ? ` · resultado: <b>${c.camp.done === 'win' ? 'victoria' : c.camp.done === 'part' ? 'victoria parcial' : 'derrota'}</b> (puntos ${c.camp.score})` : ''}</p><ul>${goals.map(g => `<li class="${g.ok ? 'ok' : ''}">${g.ok ? '✔' : '▫'} ${g.t} <small>(${g.p})</small></li>`).join('')}</ul><div class="btns"><button class="pri" data-act="ovclose">Cerrar</button>${c.camp.done ? '' : '<button data-act="campdrop">Abandonar campaña</button>'}</div>`);
}
/* ---------- hot-seat ---------- */
const hsHumans = () => (G.hs && G.hs.tags) || [];
function hsSetup() {
  const cur = hsHumans().length ? hsHumans() : [G.player], cand = G.tags.filter(t => t !== NONE && alive(t) && !cur.includes(t) && G.C[t].states.length >= 2).sort((a, b) => G.C[a].rank - G.C[b].rank).slice(0, 60);
  ovShow(`<h2>👥 Hot-seat</h2><p>Varios jugadores en el mismo ordenador, por turnos. Cada jugador gobierna su país durante el turno; al acabar, el mapa se oculta hasta que el siguiente confirme. Los países humanos <b>no</b> los controla la IA fuera de su turno.</p>
  <h3>Jugadores</h3><ul>${cur.map((t, i) => `<li>${i + 1}. ${flag(t)} ${G.C[t].name}${t !== G.player || cur.length > 1 ? ` <button data-act="hsdel" data-t="${t}">✕</button>` : ''}</li>`).join('')}</ul>
  <div class="btns"><select id="hs-add">${cand.map(t => `<option value="${t}">${G.C[t].name}</option>`).join('')}</select><button data-act="hsadd">+ Añadir jugador</button></div>
  <h3>Duración del turno</h3><div class="btns"><select id="hs-len">${[[1, '1 mes'], [3, '3 meses'], [12, '1 año']].map(([v, l]) => `<option value="${v}" ${G.hs && G.hs.len === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
  <div class="btns"><button class="pri" data-act="hsgo">${G.hs ? 'Aplicar cambios' : 'Activar hot-seat'}</button>${G.hs ? '<button data-act="hsoff">Desactivar</button>' : ''}<button data-act="ovclose">Cancelar</button></div>`);
}
function hsApply(tags, len) {
  const old = hsHumans(); old.forEach(t => { if (!tags.includes(t) && G.C[t] && t !== G.player) G.C[t].ai = true; });
  tags.forEach(t => { G.C[t].ai = false; });
  if (tags.length < 2) { G.hs = null; ovHide(); toast('👥', 'Hot-seat desactivado.'); return; }
  G.hs = {tags: tags.slice(), i: Math.max(0, tags.indexOf(G.player)), len, cnt: 0, round: (G.hs && G.hs.round) || 1};
  ovHide(); toast('👥', `Hot-seat activado: ${tags.map(t => G.C[t].name).join(' · ')}. Turno de ${G.C[G.player].name}.`);
}
function hsEndTurn() {
  const h = G.hs; if (!h) return; h.tags = h.tags.filter(t => alive(t) && G.C[t].states.length); if (h.tags.length < 2) { G.hs = null; toast('👥', 'Hot-seat terminado: queda un solo jugador humano.'); return; }
  h.i = (h.i + 1) % h.tags.length; if (h.i === 0) h.round++; h.cnt = 0; h.next = h.tags[h.i]; G.paused = true;
  ovShow(`<h2>👥 Cambio de turno</h2><p style="font-size:1.15em">Pasa el control a <b>${flag(h.next)} ${G.C[h.next].name}</b>.</p><p><small>${dateStr()} · ronda ${h.round}. La pantalla está oculta para que el jugador anterior no revele información.</small></p><div class="btns"><button class="pri" data-act="hsnext">Soy ${G.C[h.next].name}: empezar mi turno</button></div>`, 'opaque');
}
function hsBegin(tag) {
  G.player = tag; G.C[tag].ai = false; UI.sel = null; UI.win = null; try { closeWindow(); } catch (e) { }
  buildHud(); updateHud(); computeLabels(); try { renderStatePanel(); } catch (e) { }
  const c = G.C[tag]; focusState(c.capital >= 0 ? c.capital : c.states[0], 60); fullRepaint(); G.paused = false; ovHide();
  toast('🎩', `Turno de ${c.name} (${G.hs.len === 1 ? '1 mes' : G.hs.len === 3 ? '3 meses' : '1 año'}).`);
}
Object.assign(ACT, {
  ovclose: () => ovHide(), camp: () => campPanel(), campgo: d => { campBegin(G.player, d.id); campPanel(); }, campdrop: () => { const c = G.C[G.player]; delete c.camp; ovHide(); toast('🎯', 'Campaña abandonada.'); },
  hotseat: () => hsSetup(),
  hsadd: () => { const s = document.getElementById('hs-add'); if (!s || !s.value) return; const cur = hsHumans().length ? hsHumans().slice() : [G.player]; cur.push(s.value); G.hsDraft = cur; G.hs = G.hs || null; hsDraftShow(cur); },
  hsdel: d => { const cur = (G.hsDraft || (hsHumans().length ? hsHumans() : [G.player])).filter(t => t !== d.t); G.hsDraft = cur; hsDraftShow(cur); },
  hsgo: () => { const l = document.getElementById('hs-len'), tags = G.hsDraft || (hsHumans().length ? hsHumans() : [G.player]); hsApply(tags, l ? +l.value : 3); G.hsDraft = null; },
  hsoff: () => { hsHumans().forEach(t => { if (t !== G.player) G.C[t].ai = true; }); G.hs = null; G.hsDraft = null; ovHide(); toast('👥', 'Hot-seat desactivado: los demás países pasan a la IA.'); },
  hsnext: () => hsBegin(G.hs.next)
});
function hsDraftShow(cur) { const keep = G.hs; const tmp = G.hs; G.hs = {tags: cur, len: tmp ? tmp.len : 3}; hsSetup(); G.hs = keep; }
const _histMonthCamp = histMonth;
histMonth = function () {
  _histMonthCamp();
  try { campMonth(); } catch (e) { console.warn('camp', e); }
  if (G.hs && !G.hs.wait) { G.hs.cnt++; if (G.hs.cnt >= G.hs.len) { G.hs.wait = true; G.paused = true; } }
};
setInterval(() => { const h = G.hs; if (h && h.wait && UI.started && !G.pendingEvent && !document.querySelector('#ov3.on')) { h.wait = false; hsEndTurn(); } }, 400);
const _saveExtraCamp = saveExtra, _loadExtraCamp = loadExtra;
saveExtra = function () { const o = _saveExtraCamp(); o.hs = G.hs || null; o.scenY = G.scenYear || null; return o; };
loadExtra = function (x) { _loadExtraCamp(x); G.hs = (x && x.hs) || null; if (x && x.scenY) G.scenYear = x.scenY; };
function menuBtn(id, icon, label, act, tip) {
  if (document.getElementById(id)) return; const menu = document.getElementById('topmenu'); if (!menu) return;
  const b = document.createElement('button'); b.id = id; b.dataset.act = act; b.dataset.tip = tip; b.className = 'tm-row'; b.innerHTML = `<span class="tmi">${icon}</span><span class="tml">${label}</span>`; menu.appendChild(b);
}
function campMenus() { menuBtn('tm-camp', '🎯', 'Campaña', 'camp', '<b>Campaña</b><br>Metas, plazo y puntuación.'); menuBtn('tm-hs', '👥', 'Hot-seat', 'hotseat', '<b>Hot-seat</b><br>Varios jugadores por turnos en el mismo navegador.'); if (typeof twMenus === 'function') twMenus(); }
const _startGameCamp = startGame;
startGame = function () {
  const ep = G.date ? G.date.y : 1836; G.scenYear = ep >= 1939 ? 1939 : ep >= 1900 ? 1910 : 1836;
  _startGameCamp(); setTimeout(campMenus, 450);
  let tries = 0; const iv = setInterval(() => { tries++; const c = G.C[G.player]; if (!c || c.camp || tries > 40 || !campsFor(G.player).length) { clearInterval(iv); return; } if (tutOfferPending() || (typeof TUT !== 'undefined' && TUT.on) || document.querySelector('#ov3.on')) return; clearInterval(iv); campPanel(); }, 1500);
};
const tutOfferPending = () => !!document.getElementById('tutoffer');
const _doLoadCamp = doLoad;
doLoad = function (f) { _doLoadCamp(f); setTimeout(campMenus, 600); };
