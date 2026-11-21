/* ===== ALERTAS Y OPORTUNIDADES · TUTORIALES CORTOS · PILOTO AUTOMÁTICO =====
   1) Amplía el asesor 🧭 con alertas de los sistemas nuevos (escasez por bloqueo, convoyes sin escolta, lealtad de virreinatos, flotas fuera de alcance,
      ejércitos sin suministro, dominio aéreo/naval perdido, oportunidades de comercio y colonización) y botón «Ir» que lleva al problema.
   2) Tutoriales cortos (3 pasos) la primera vez que abres el mapa marítimo, el aéreo, el comercio, los virreinatos, el árbol tecnológico y la barra de ejércitos.
   3) Piloto automático (en el panel del asesor): la IA gestiona por ti la investigación, las obras, la política económica y el reclutamiento, a tu elección. */
const TIPX = {
  navy: () => ACT.mode({m: 'naval'}), air: () => ACT.mode({m: 'air'}),
  army: d => { const a = armiesOf(G.player).filter(x => !x.sea && x.sup !== undefined && x.sup < 0.45)[0] || armiesOf(G.player)[0]; if (a) { selectArmy(a.id); focusProv(a.loc, 40); } },
  fleet: () => { UI.winTab.mil = 'navy'; UI.win = null; openWindow('military'); }
};
const _advisorTips = advisorTips;
advisorTips = function (c) {
  const tips = _advisorTips(c), add = (pri, icon, title, text, go) => tips.push(Object.assign({pri, icon, title, text}, go || {})), W = (w, k, t) => ({w, k, t}), M = G.mx || {};
  try {
    if ((c.scarc || 0) > 0.15) add(1, '🚧', `Escasez por bloqueo (${Math.round(c.scarc * 100)} %)`, 'Los puertos están cercados: sube el malestar y baja la producción. Rompe el bloqueo con una flota superior o compra alimentos por tierra.', {x: 'navy'});
    const cvs = (M.cvs || []).filter(x => x.tag === G.player && !x.land);
    const bad = cvs.filter(x => (M.fl || []).some(f => f.zone === x.zone && !f.tr && f.port == null && f.ships.length && hostileTags(G.player, f.tag)) && !(M.fl || []).some(f => f.escort === x.id));
    if (bad.length) add(1, '🚢', `${bad.length} convoy${bad.length > 1 ? 'es' : ''} en peligro`, 'Hay flotas enemigas en su ruta y no llevan escolta: se hundirán con la carga. Asigna una escolta.', W('trade'));
    c.states.forEach(() => { });
    const lo = vrOf(G.player).filter(t => G.C[t].vice.loyalty < 30); if (lo.length) add(2, '👑', `Lealtad baja en ${G.C[lo[0]].name}`, 'Concede más autonomía o corres el riesgo de una secesión.', W('diplomacy', 'dip', 'colony'));
    const far = (M.fl || []).filter(f => f.tag === G.player && f.warnedRange); if (far.length) add(2, '⚓', `${far.length} flota${far.length > 1 ? 's' : ''} fuera de alcance`, 'Operan lejos de tus bases navales y sufren desgaste. Construye bases o repliégalas.', {x: 'fleet'});
    const low = armiesOf(G.player).filter(a => !a.sea && a.sup !== undefined && a.sup < 0.45 && a.divs.length); if (low.length) add(2, '📦', `${low.length} ejército${low.length > 1 ? 's' : ''} sin suministros`, 'Pierden fuerza y organización. Acerca depósitos, mejora el ferrocarril o repliégalos.', {x: 'army'});
    if (c.wars.length && G.mx && G.mx.sq && G.mx.sq.length) { const regs = new Set(); armiesOf(G.player).forEach(a => { if (!a.sea) regs.add(airRegOf(provState(a.loc))); }); let worst = null; regs.forEach(r => { const b = airBonus(G.player, MAP.air.regs[r].states[0]); if (b < -0.06 && (!worst || b < worst.b)) worst = {r, b}; }); if (worst) add(2, '✈️', 'El enemigo domina el aire sobre tus ejércitos', `Tus tropas pierden hasta un ${Math.round(-worst.b * 100)} %. Refuerza tus cazas en esa región.`, {x: 'air'}); }
    if (c.wars.length) { const nv = c.states.filter(id => typeof navBonus === 'function' && navBonus(G.player, id) < -0.06); if (nv.length) add(2, '🌊', 'El enemigo domina la costa', 'Hay estados costeros con inferioridad naval: bombardeo e interdicción. Envía flotas a esos mares.', {x: 'navy'}); }
    if (!cvs.length && c.treasury > c.stats.income * 10 && TR_GOODS.some(g => G.ratio[g] !== undefined && G.ratio[g] < 0.8)) { const g = TR_GOODS.find(x => G.ratio[x] !== undefined && G.ratio[x] < 0.8); add(3, '🛒', `Oportunidad de comercio: ${GOOD[g].name.toLowerCase()}`, 'Hay déficit mundial. Compra a un país con excedentes (por tierra no necesitas convoyes).', W('trade')); }
    if (c.influence >= 80 && !c.colonizing && colonizeTargets(c).length) add(3, '🗺️', 'Colonización disponible', 'Hay territorios libres a tu alcance; los lejanos pueden ser virreinatos autónomos.', W('diplomacy', 'dip', 'colony'));
    if (c.amb && c.amb.id && !c.amb.done) { const p = ambProgress(c); if (p.miss.length) add(3, '👑', `Ambición imperial: faltan ${p.miss.length} territorios core`, 'Recupéralos para proclamarte imperio.', W('journal')); }
  } catch (e) { }
  return tips.sort((a, b) => a.pri - b.pri).slice(0, 10);
};

/* ---------- tutoriales cortos ---------- */
const COACH = {done: {}, el: null, q: null};
try { COACH.done = JSON.parse(localStorage.getItem('vic_coach') || '{}'); } catch (e) { }
const COACH_TXT = {
  naval: ['🌊 Mapa marítimo', ['Los mares son regiones con borde y nombre; el color indica quién domina (supremacía).', 'Clic en una ficha selecciona la flota (Mayús suma; recuadro con el botón derecho).', 'Clic derecho en un mar la envía allí. Con ≥50 % de supremacía puedes bloquear; con ≥35 % desembarcar con seguridad.']],
  air: ['✈️ Mapa aéreo', ['Las regiones aéreas se colorean según tu dominio del aire.', 'Selecciona fichas de escuadrones y haz clic derecho en una región para desplegarlos.', 'Quien domina el aire gana hasta +25 % en tierra; quien lo pierde, hasta −18 %.']],
  trade: ['🚢 Comercio exterior', ['Elige mercancía y vendedor: «Oferta» es lo que puede vender este mes.', 'Por tierra no necesitas convoyes; por mar compra convoyes y asígnales una escolta.', 'Los contratos mensuales repiten el pedido solos. Las flotas enemigas hunden los convoyes sin escolta.']],
  colony: ['👑 Virreinatos', ['Un territorio lejano puede ser un virreinato: país vasallo con su ejército, que diriges tú.', 'La política de autonomía cambia el tributo y la lealtad.', 'Con la lealtad por debajo de 10 puede proclamar la independencia.']],
  tech: ['🌳 Árbol de tecnologías', ['Las tecnologías doradas están disponibles; las flechas muestran los requisitos.', 'Pasa el ratón (o mantén pulsado) para ver sus efectos.', 'Las eras avanzadas exigen año y progreso previo.']],
  bar: ['🎖️ Barra de ejércitos', ['Cada tarjeta es un ejército con el retrato de su general y sus barras de fuerza y organización.', 'Clic selecciona (Mayús suma), doble clic centra el mapa, clic derecho detiene.', 'Selecciona y haz clic derecho en el mapa para moverlo.']]
};
function coach(id) {
  if (COACH.done[id] || !COACH_TXT[id] || !UI.started || document.body.classList.contains('starting')) return; COACH.done[id] = 1; try { localStorage.setItem('vic_coach', JSON.stringify(COACH.done)); } catch (e) { }
  const [title, steps] = COACH_TXT[id]; let i = 0, el = COACH.el; if (!el) { el = COACH.el = document.createElement('div'); el.id = 'coach'; el.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);bottom:200px;z-index:80;max-width:min(440px,92vw);background:linear-gradient(180deg,#3a2a1c,#1f160e);border:2px solid #b8903e;border-radius:8px;padding:12px 14px;color:#f3e6c0;box-shadow:0 8px 28px rgba(0,0,0,.6);font:14px/1.4 sans-serif'; document.body.appendChild(el); }
  const draw = () => { el.style.display = 'block'; el.innerHTML = `<b style="color:#e0c27a;font-size:15px">${title}</b> <small style="opacity:.7">· ${i + 1}/${steps.length}</small><p style="margin:6px 0 10px">${steps[i]}</p><div style="display:flex;gap:8px;justify-content:flex-end"><button data-c="skip">Saltar</button><button data-c="next" style="border-color:#e0c27a">${i + 1 < steps.length ? 'Siguiente' : '¡Entendido!'}</button></div>`; };
  el.onclick = e => { const b = e.target.closest('button'); if (!b) return; if (b.dataset.c === 'skip' || ++i >= steps.length) el.style.display = 'none'; else draw(); }; draw();
}
const _setMapModeCo = setMapMode; setMapMode = function (m) { _setMapModeCo(m); if (m === 'naval') coach('naval'); else if (m === 'air') coach('air'); };
const _openWinCo = openWindow; openWindow = function (id) { _openWinCo(id); if (id === 'trade') coach('trade'); else if (id === 'tech') coach('tech'); };
const _vrCardCo = vrCard; vrCard = function () { setTimeout(() => coach('colony'), 300); return _vrCardCo(); };
setInterval(() => { if (typeof abArmies === 'function' && UI.started && !UI.win && abArmies().length && G.date.t > 20) coach('bar'); }, 3000);

/* ---------- piloto automático ---------- */
const AUTO_OPTS = [['research', '💡 Investigación'], ['build', '🏗️ Obras e inversión'], ['eco', '🎚️ Política económica'], ['recruit', '🪖 Reclutamiento y desmovilización'], ['deficit', '📈 Corregir déficits de producción']];
const autoOf = c => c.auto || (c.auto = {});
function autoMonth(c) {
  if (c.tag !== G.player || !c.auto) return; const a = c.auto;
  try {
    if (a.research && !c.research) { const av = TECHS.filter(t => techAvailable(c, t)).sort((x, y) => (x.cat === 'Producción' ? 0 : 1) - (y.cat === 'Producción' ? 0 : 1) || techCost(c, x) - techCost(c, y)); if (av.length) setResearch(c, av[0].id); }
    if (a.build && c.queue.length < 3 && c.treasury > Math.max(1, c.stats.income) * 3) { for (let k = 0; k < 2; k++) { const cand = pickInvestment(c); if (cand) queueBuild(c, cand.state, cand.bld); } }
    if (a.deficit && c.queue.length < 4 && c.treasury > Math.max(1, c.stats.income) * 3) { const need = GOODS.filter(g => G.ratio[g.id] !== undefined && G.ratio[g.id] < 0.85 && BUILDINGS.some(b => b.out === g.id && canBuild(null, b, c))).sort((x, y) => G.ratio[x.id] - G.ratio[y.id]).slice(0, 2);
      need.forEach(g => { const bs = BUILDINGS.filter(b => b.out === g.id && canBuild(null, b, c)); let best = null, bv = 0; c.states.forEach(id => { const s = G.S[id]; bs.forEach(b => { const room = buildRoom(s, b.id); if (room >= 1 && room > bv) { bv = room; best = {id, b: b.id}; } }); }); if (best) queueBuild(c, best.id, best.b); }); }
    if (a.eco && typeof ecoAI === 'function' && c.influence > 20) ecoAI(c);
    if (a.recruit && typeof aiRecruitV3 === 'function') { aiRecruitV3(c.tag, c); if (typeof aiDisbandExcess === 'function') aiDisbandExcess(c); }
  } catch (e) { }
}
const _navalMonthAuto = navalMonth; navalMonth = function (c) { _navalMonthAuto(c); autoMonth(c); };
const _advisorHtmlAuto = advisorHtml;
advisorHtml = function () {
  const c = me(), a = autoOf(c);
  return _advisorHtmlAuto().replace('<small class="adv-foot">', `<div class="adv-auto" style="padding:8px 10px;border-top:1px solid rgba(255,255,255,.12)"><b>🧑‍✈️ Piloto automático</b><small style="display:block;opacity:.7;margin-bottom:4px">La IA gestiona esto por ti cada mes.</small>${AUTO_OPTS.map(([k, n]) => `<label style="display:block;padding:2px 0"><input type="checkbox" data-act="autotog" data-k="${k}" ${a[k] ? 'checked' : ''}> ${n}</label>`).join('')}<div style="margin-top:4px"><button data-act="autoall">Modo simple (todo)</button> <button data-act="autonone">Manual</button></div></div><small class="adv-foot">`);
};
Object.assign(ACT, {
  autotog: (d, el) => { autoOf(me())[d.k] = !!(el && el.checked); },
  autoall: () => { const a = autoOf(me()); AUTO_OPTS.forEach(([k]) => a[k] = true); toast('🧑‍✈️', 'Modo simple: la IA gestiona investigación, obras, economía y reclutamiento.'); _advCache.t = -1; const e = document.getElementById('advisor'); if (e) e.innerHTML = advisorHtml(); },
  autonone: () => { me().auto = {}; toast('🧑‍✈️', 'Piloto automático desactivado.'); _advCache.t = -1; const e = document.getElementById('advisor'); if (e) e.innerHTML = advisorHtml(); }
});
