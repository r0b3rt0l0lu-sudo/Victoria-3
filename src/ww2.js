/* ===== LA SEGUNDA GUERRA MUNDIAL (guion de la época de 1939) =====
   La partida de 1939 empieza con la invasión alemana de Polonia (ya declarada). Para que el conflicto crezca como en la historia, cada mes se comprueba una lista de agresiones
   con fecha: la Unión Soviética contra Polonia, Alemania contra Noruega, Dinamarca, Países Bajos, Bélgica y Francia, Italia contra Francia, Alemania contra la URSS y Japón contra EE. UU.
   y Reino Unido. Si el atacante o la víctima ya no existen, o no pueden declararse la guerra, el paso se salta. Solo actúa en la época de 1939 y con la regla «Eventos históricos».
   Los aliados entran por las alianzas existentes (probabilístico, como cualquier guerra). El jugador nunca recibe una declaración suya: si es el atacante, decide él. */
const WW2_STEPS = [
  {id: 'ussr_pol', y: 1939, m: 9, att: 'RUS', def: 'BAV', n: 3, msg: 'La Unión Soviética invade Polonia por el este.'},
  {id: 'ger_nor', y: 1940, m: 3, att: 'PRU', def: 'HES', n: 2, msg: 'Alemania invade Noruega.'},
  {id: 'ger_den', y: 1940, m: 3, att: 'PRU', def: 'DEN', n: 1},
  {id: 'ger_net', y: 1940, m: 4, att: 'PRU', def: 'NET', n: 1, msg: 'Alemania invade los Países Bajos.'},
  {id: 'ger_bel', y: 1940, m: 4, att: 'PRU', def: 'BEL', n: 1},
  {id: 'ger_fra', y: 1940, m: 4, att: 'PRU', def: 'FRA', n: 3, msg: 'Alemania ataca a Francia.'},
  {id: 'ita_fra', y: 1940, m: 5, att: 'SAR', def: 'FRA', n: 2, msg: 'Italia entra en la guerra contra Francia.'},
  {id: 'ger_gbr', y: 1940, m: 8, att: 'PRU', def: 'GBR', n: 3},
  {id: 'ger_rus', y: 1941, m: 5, att: 'PRU', def: 'RUS', n: 4, msg: 'Alemania rompe el pacto y ataca a la Unión Soviética.'},
  {id: 'jap_usa', y: 1941, m: 11, att: 'JAP', def: 'USA', n: 3, msg: 'Japón ataca a Estados Unidos.'},
  {id: 'jap_gbr', y: 1941, m: 11, att: 'JAP', def: 'GBR', n: 2}
];
function ww2Month() {
  if (!G.eventCool || !G.eventCool.scen1939 || !rule('hist')) return;
  WW2_STEPS.forEach(st => {
    if (histDone('ww2_' + st.id) || G.date.y < st.y || (G.date.y === st.y && G.date.m < st.m)) return;
    histMark('ww2_' + st.id);
    if (!alive(st.att) || !alive(st.def) || st.att === G.player || G.C[st.att].wars.length >= 3) return;
    G.pacts = G.pacts.filter(p => !(p.type === 'nonagg' && ((p.a === st.att && p.b === st.def) || (p.a === st.def && p.b === st.att))));
    const ids = reachableStates(st.att, st.def).slice(0, st.n).map(x => x.id); if (!ids.length) return;
    const r = declareWar(st.att, st.def, 'conquest', ids, {free: true});
    if (r.ok && st.msg) notify('war', '🌍 ' + st.msg, ids[0]);
  });
}
const _histMonth39 = histMonth;
histMonth = function () { _histMonth39(); try { ww2Month(); } catch (e) { console.warn('ww2', e); } };
