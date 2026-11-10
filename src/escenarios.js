/* ===== ÉPOCAS ALTERNATIVAS: 1836 (clásica), 1910, 1939 (Segunda Guerra Mundial) y 2020 (actual) =====
   1939 y 2020 salen del mundo de 1910 con el reparto territorial de cada época fijado a mano (tools/anclar_epoca.js), naciones nuevas (Polonia, India, Israel…),
   tecnologías de las eras 4 y 5 (eras45.js) y alianzas; la economía es la simulada, no una recreación estadística.
   El mundo de 1910 es una instantánea (gzip + base64) de una simulación de la IA desde 1836, generadas con tools/generar_escenario.js
   y con el reparto territorial de 1910-1914 fijado a partir de mapas históricos (tools/anclar_1910.js). Se incrustan en el HTML y se cargan como una partida guardada: eliges la época, el mundo cambia y
   después eliges país (solo los que existen en esa fecha). */
const SCEN_DATA = {/*SCEN_DATA*/};
const SCEN_LIST = [
  [1836, '1836', 'Clásica', 'El mundo al empezar la era industrial: imperios coloniales, monarquías absolutas y mucho por construir.'],
  [1910, '1910', 'La víspera de la Gran Guerra', 'Imperios coloniales en su apogeo, Alemania e Italia unidas, dos bloques de alianzas en Europa y aviones, acorazados y ametralladoras en el horizonte.'],
  [1939, '1939', 'La Segunda Guerra Mundial', '1 de septiembre de 1939: Alemania invade Polonia y Reino Unido y Francia están obligados a responder. Carros mecanizados, radar, portaaviones y submarinos; el Eje, los Aliados y la Unión Soviética.'],
  [2020, '2020', 'El mundo actual', 'Un mundo de unos 90 estados soberanos: superpotencias, la OTAN, potencias emergentes y rivalidades abiertas. Misiles guiados, superportaaviones, submarinos nucleares, drones y guerra cibernética.']
].filter(e => e[0] === 1836 || SCEN_DATA[e[0]]);
async function scenUnzip(src) {
  // src: base64 (archivo único), Uint8Array o «bin:ruta» (web por carpetas: se descarga solo al elegir la época)
  let bin;
  if (src instanceof Uint8Array) bin = src; else if (typeof src === 'string' && src.slice(0, 4) === 'bin:') { const r = await fetch(src.slice(4)); if (!r.ok) throw new Error('No se pudo descargar la época.'); bin = new Uint8Array(await r.arrayBuffer()); } else bin = Uint8Array.from(atob(src), c => c.charCodeAt(0));
  const stream = new Blob([bin]).stream().pipeThrough(new DecompressionStream('gzip'));
  return await new Response(stream).text();
}
function scenLoading(txt) {
  let e = document.getElementById('scenload');
  if (!txt) { if (e) e.remove(); return; }
  if (!e) { e = document.createElement('div'); e.id = 'scenload'; document.body.appendChild(e); }
  e.innerHTML = `<div><b>${txt}</b><i></i></div>`;
}
// los mundos simulados dejan a algunos países sin ejército: se les reparte uno acorde a su límite (60% de las divisiones posibles, máx. 120)
function scenArmies() {
  G.tags.forEach(t => {
    if (t === NONE) return; const c = G.C[t]; if (!c.states.length) return;
    const lim = divLimit(c); let n = Math.min(Math.max(Math.floor(lim * 0.6), Math.min(lim, 3)), 120) - countDivs(t); if (n < 1 || (n < 4 && countDivs(t) > 0)) return;
    const barr = c.states.filter(id => G.S[id].b.barracks >= 1), homes = (barr.length ? barr : [c.capital >= 0 ? c.capital : c.states[0]]).map(stateCapitalProv); let hi = 0;
    while (n > 0) { const k = Math.min(n, 6 + Math.floor(Math.random() * 3)), divs = []; for (let i = 0; i < k; i++) { const r = Math.random(); divs.push(mkDivision(r < 0.7 ? 'inf' : r < 0.85 ? 'cav' : 'art', 0.4 + Math.random() * 0.3)); } mkArmy(t, homes[hi++ % homes.length], divs); n -= k; }
    if (c.eq) { const need = eqNeedOf(t); EQ_GOODS.forEach(g => { c.eq[g] = Math.max(c.eq[g] || 0, (need[g] || 0) * 1.15); }); }
  });
}
// épocas modernas: la IA recibe plantillas y buques de su tecnología, y parte de sus ejércitos y flotas se renueva
function scenModernize(year) {
  tplRegisterAll();
  G.tags.forEach(t => {
    if (t === NONE) return; const c = G.C[t]; if (!c.states.length) return;
    try { aiTemplates(c); } catch (e) { }
    const top = mc(c).tpl.filter(x => x.ai !== undefined && x.ai >= 3).sort((a, b) => b.ai - a.ai).slice(0, 2); if (!top.length) return;
    const frac = (c.rank <= 10 ? 0.7 : c.rank <= 25 ? 0.45 : 0.2) + (year >= 2000 ? 0.15 : 0);
    G.armies.forEach(a => { if (a.tag !== t || a.sea) return; a.divs.forEach(d => { if ((d.t === 'inf' || d.t === 'cav' || d.t === 'art') && Math.random() < (d.t === 'cav' ? frac * 0.9 : frac)) d.t = pick(top).key; }); });
  });
  if (!G.mx || !G.mx.fl) return;
  G.mx.fl.forEach(f => { const c = G.C[f.tag]; if (!c) return; const av = shipsAvail(c);
    f.ships.forEach(s => {
      if (['sail', 'steam', 'ironclad', 'cruiser'].includes(s.t)) { if (av.includes('aegis') && Math.random() < 0.5) s.t = 'aegis'; else if (av.includes('destroyer')) s.t = 'destroyer'; else if (av.includes('cruiser')) s.t = 'cruiser'; }
      else if (s.t === 'dread') { if (av.includes('scarrier') && Math.random() < 0.3) s.t = 'scarrier'; else if (av.includes('carrier') && Math.random() < 0.4) s.t = 'carrier'; else if (av.includes('bb')) s.t = 'bb'; }
      else if (s.t === 'sub' && av.includes('nsub') && Math.random() < 0.5) s.t = 'nsub';
      s.hp = Math.max(s.hp, 0.8);
    }); });
}
async function scenarioSwitch(year) {
  if (UI.scenBusy || UI.started) return; if (G.date && G.date.y === year) return;
  UI.scenBusy = true; scenLoading(year === 1836 ? 'Preparando el mundo de 1836…' : `Cargando el mundo de ${year}…`);
  await new Promise(r => setTimeout(r, 60));
  try {
    if (year === 1836) initGame('GBR');
    else {
      if (typeof DecompressionStream === 'undefined') throw new Error('Tu navegador no admite descomprimir las épocas (usa Chrome, Edge o Firefox recientes).');
      loadData(await scenUnzip(SCEN_DATA[year]));
      updateRanks(); scenArmies(); if (year >= 1939) scenModernize(year);
      // el jugador empieza de cero: objetivos, logros y estadísticas de partida
      G.tags.forEach(t => { const c = G.C[t]; if (t === NONE) return; c.journalDone = {}; c.ach = {}; c.cnt = {}; c.start = {ind: c.stats.indLevels, lit: c.lit, soldiers: c.stats.soldiers, prestige: c.prestige, rank: c.rank}; });
      G.notifs = []; G.log = []; logMsg(`Comienza la partida en ${year}.`);
    }
    G.paused = true; computeEdges(G.ownerOf); fullRepaint(); computeLabels(); buildStart();
  } catch (e) { console.error(e); toast('⚠️', 'No se pudo cargar la época: ' + e.message); }
  UI.scenBusy = false; scenLoading(null);
}
function scenBarHtml() {
  if (SCEN_LIST.length < 2) return '';
  return `<div class="st-epochs"><small>Época</small><div class="seg" id="st-epoch">${SCEN_LIST.map(([y, lab, sub, desc]) => `<button data-act="scen" data-y="${y}" class="${G.date && G.date.y === y ? 'on' : ''}" data-tip="<b>${y} · ${sub}</b><br>${desc}">${lab}<small>${sub}</small></button>`).join('')}</div></div>`;
}
Object.assign(ACT, {scen: d => scenarioSwitch(+d.y)});
