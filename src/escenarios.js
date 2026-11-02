/* ===== ÉPOCAS ALTERNATIVAS: 1836 (clásica) y 1910 =====
   El mundo de 1910 es una instantánea (gzip + base64) de una simulación de la IA desde 1836, generadas con tools/generar_escenario.js
   y con el reparto territorial de 1910-1914 fijado a partir de mapas históricos (tools/anclar_1910.js). Se incrustan en el HTML y se cargan como una partida guardada: eliges la época, el mundo cambia y
   después eliges país (solo los que existen en esa fecha). */
const SCEN_DATA = {/*SCEN_DATA*/};
const SCEN_LIST = [
  [1836, '1836', 'Clásica', 'El mundo al empezar la era industrial: imperios coloniales, monarquías absolutas y mucho por construir.'],
  [1910, '1910', 'La víspera de la Gran Guerra', 'Imperios coloniales en su apogeo, Alemania e Italia unidas, dos bloques de alianzas en Europa y aviones, acorazados y ametralladoras en el horizonte.']
].filter(e => e[0] === 1836 || SCEN_DATA[e[0]]);
async function scenUnzip(b64) {
  const bin = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
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
async function scenarioSwitch(year) {
  if (UI.scenBusy || UI.started) return; if (G.date && G.date.y === year) return;
  UI.scenBusy = true; scenLoading(year === 1836 ? 'Preparando el mundo de 1836…' : `Cargando el mundo de ${year}…`);
  await new Promise(r => setTimeout(r, 60));
  try {
    if (year === 1836) initGame('GBR');
    else {
      if (typeof DecompressionStream === 'undefined') throw new Error('Tu navegador no admite descomprimir las épocas (usa Chrome, Edge o Firefox recientes).');
      loadData(await scenUnzip(SCEN_DATA[year]));
      updateRanks(); scenArmies();
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
