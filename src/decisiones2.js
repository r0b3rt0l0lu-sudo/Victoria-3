/* ===== DECISIONES 2: árboles de más países, cadenas consecutivas con eventos y decisiones por época =====
   · Árboles nacionales para 15 países más (Austria, Italia, Suecia, Países Bajos, Bélgica, Portugal, Brasil, México, China, Argentina, Persia, Egipto, Siam, Etiopía, Grecia)
     y filas nuevas (más profundas) para los 8 que ya existían, con nodos por época (hasta 1939).
   · CADENAS: completar un nodo puede disparar un evento con decisiones; lo que elijas desbloquea (o cierra) los nodos siguientes. La IA decide sola.
   · Nuevos efectos: ['event', id] (dispara un evento), ['grant', nodo] (completa otro nodo), ['war', etiqueta, estado], ['reg', ideología]. */
const NAT_AFTER = {};
const natAdd = (tag, rows, branches) => {
  if (branches) NAT_BRANCHES[tag] = branches;
  NAT[tag] = NAT[tag] || [];
  rows.forEach(n => { NAT[tag].push({id: n[0], name: n[1], icon: n[2], b: n[3], t: n[4], days: n[5], req: n[6], excl: n[7], desc: n[8], fx: n[9]}); if (n[10]) NAT_AFTER[n[0]] = n[10]; });
};
// año mínimo de los nodos
const _natStateD2 = natState;
natState = function (c, n) { const r = _natStateD2(c, n); if (r.k === 'avail' && NAT_AFTER[n.id] && G.date.y < NAT_AFTER[n.id]) return {k: 'locked', why: `Disponible desde ${NAT_AFTER[n.id]}.`}; return r; };
// nuevos efectos
function natChain(c, id) {
  const e = EVENTS.find(x => x.id === id); if (!e) return;
  if (c.tag === G.player) { if (!histNotifyPlayer(id, c, null)) histNotifyPlayerLater(id, c, null); return; }
  if (!c.ai || !c.states.length) return; const i = Math.floor(Math.random() * e.opts.length); try { e.opts[i].fx(c, null); } catch (err) { console.warn('cadena', id, err); }
}
function natGrant(c, id) { const n = natNode(c, id); c.nat = c.nat || {done: [], cur: null}; if (n && !c.nat.done.includes(id)) { c.nat.done.push(id); applyNatFx(c, n.fx); } }
const _applyNatFxD2 = applyNatFx;
applyNatFx = function (c, fx) {
  const rest = [];
  fx.forEach(e => {
    if (e[0] === 'event') natChain(c, e[1]);
    else if (e[0] === 'grant') natGrant(c, e[1]);
    else if (e[0] === 'war') { if (alive(e[1]) && !c.wars.length) { const s = stateByName(e[2]); const r = declareWar(c.tag, e[1], 'conquest', s && s.owner === e[1] ? [s.id] : reachableStates(c.tag, e[1]).slice(0, 1).map(x => x.id), {free: true}); if (!r.ok && c.tag === G.player) notify('war', r.msg); } }
    else if (e[0] === 'reg') { if (typeof applyRegime === 'function') applyRegime(c, e[1]); }
    else rest.push(e);
  });
  return _applyNatFxD2(c, rest);
};
const _natFxTextD2 = natFxText;
natFxText = function (fx) { return fx.map(e => { if (e[0] === 'event') { const ev = EVENTS.find(x => x.id === e[1]); return '⚡ Evento: ' + (ev ? ev.title : e[1]); } if (e[0] === 'war') return '⚔️ Guerra contra ' + (G.C[e[1]] ? G.C[e[1]].name : e[1]); if (e[0] === 'grant' || e[0] === 'reg') return ''; return _natFxTextD2([e]); }).filter(Boolean).join(' · '); };

/* ---------- eventos encadenados ---------- */
const evo = (id, icon, title, text, opts) => EVENTS.push({id, icon, title, w: 0, cond: () => false, text: typeof text === 'function' ? text : () => text, opts});
evo('n_schleswig', '⚔️', 'La cuestión de Schleswig-Holstein', 'Dinamarca se anexiona Schleswig y la opinión alemana se enciende. Una guerra rápida podría resolver el asunto, o puede buscarse una salida diplomática.', [
  {t: 'Atacar a Dinamarca', hint: 'Guerra de conquista limitada; +prestigio', fx: c => { c.prestige += 8; if (alive('DEN') && !c.wars.length) declareWar(c.tag, 'DEN', 'conquest', reachableStates(c.tag, 'DEN').slice(0, 1).map(x => x.id), {free: true}); natGrant(c, 'p_danish'); }},
  {t: 'Conferencia internacional', hint: '+influencia, relaciones con las potencias', fx: c => { c.influence += 40; ['GBR', 'FRA'].forEach(t => { if (alive(t)) addRel(c.tag, t, 8); }); }}]);
evo('n_homerule', '☘️', 'La cuestión irlandesa', 'El nacionalismo irlandés exige autogobierno. La cámara está dividida entre la concesión y la mano dura.', [
  {t: 'Aprobar el Home Rule', hint: '−radicales, +legitimidad; los unionistas se enfadan', fx: c => { c.radicals = Math.max(0, c.radicals - 0.05); c.legitimacy += 5; addIGBoost(c, 'lands', 'suppress', 12); }},
  {t: 'Coerción y ley marcial', hint: '+estabilidad corta, −legitimidad', fx: c => { c.legitimacy -= 4; c.radicals = Math.min(0.9, c.radicals + 0.03); c.prestige += 2; }}]);
evo('n_dreyfus', '⚖️', 'El caso Dreyfus', 'Un oficial judío condenado sin pruebas divide a Francia entre el ejército y la república.', [
  {t: 'Revisar el proceso', hint: '+legitimidad republicana, el ejército se resiente', fx: c => { c.legitimacy += 5; c.ig.armed && (c.ig.armed.approval -= 2); c.radicals = Math.max(0, c.radicals - 0.03); }},
  {t: 'Cerrar filas con el ejército', hint: '+ejército, −legitimidad civil', fx: c => { c.legitimacy -= 3; c.radicals = Math.min(0.9, c.radicals + 0.03); c.natMods = c.natMods || {}; c.natMods.army = (c.natMods.army || 0) + 0.02; }}]);
evo('n_duma', '🏛️', 'La revolución de 1905', 'Tras la derrota y el Domingo Sangriento, huelgas generales sacuden el imperio. El zar debe decidir.', [
  {t: 'Manifiesto de octubre: Duma y libertades', hint: 'Concedes una constitución limitada', fx: c => { c.laws.power = 'landed_voting'; c.laws.press = 'limited_press'; recalcMods(c); c.legitimacy += 6; c.radicals = Math.max(0, c.radicals - 0.08); }},
  {t: 'Reprimir sin concesiones', hint: '−legitimidad; los radicales aguardan', fx: c => { c.legitimacy -= 6; c.radicals = Math.min(0.9, c.radicals + 0.05); }}]);
evo('n_youngturks', '🌙', 'Los Jóvenes Turcos', 'Oficiales reformistas exigen restaurar la constitución y modernizar el imperio.', [
  {t: 'Aceptar la constitución', hint: 'Voto censitario, más legitimidad', fx: c => { c.laws.power = 'wealth_voting'; recalcMods(c); c.legitimacy += 5; c.radicals = Math.max(0, c.radicals - 0.05); }},
  {t: 'Disolver el movimiento', hint: 'Autocracia reforzada, tensión militar', fx: c => { c.legitimacy -= 3; c.radicals = Math.min(0.9, c.radicals + 0.04); if (c.ig.armed) c.ig.armed.approval -= 2; }}]);
evo('n_meiji_war', '🎌', 'Rusia en Manchuria', 'El avance ruso por Manchuria amenaza los intereses japoneses en Corea. Tokio debe decidir entre la guerra y el acuerdo.', [
  {t: 'Preparar la guerra contra Rusia', hint: '+ejército, prestigio si vences', fx: c => { c.prestige += 6; c.natMods = c.natMods || {}; c.natMods.army = (c.natMods.army || 0) + 0.03; recalcMods(c); }},
  {t: 'Negociar un reparto de influencia', hint: '+influencia, sin riesgo', fx: c => { c.influence += 50; if (alive('RUS')) addRel(c.tag, 'RUS', 15); }}]);
evo('n_unif_it', '🇮🇹', 'Cavour y Napoleón III', 'El conde de Cavour ofrece ceder Saboya y Niza a Francia a cambio de ayuda militar contra Austria.', [
  {t: 'Pactar con Francia contra Austria', hint: 'Aliado poderoso; relaciones con Austria rotas', fx: c => { if (alive('FRA')) addRel(c.tag, 'FRA', 40); if (alive('AUS')) addRel(c.tag, 'AUS', -50); c.prestige += 6; }},
  {t: 'Seguir solos', hint: 'Sin deuda con Francia; más lento', fx: c => { c.legitimacy += 3; }}]);
evo('n_rebel_lat', '🗽', 'Independencias y caudillos', 'Los caudillos regionales desafían la autoridad del gobierno central.', [
  {t: 'Pactar con los caudillos (federalismo)', hint: '+estabilidad, −impuestos', fx: c => { c.legitimacy += 4; c.natMods = c.natMods || {}; c.natMods.tax = (c.natMods.tax || 0) - 0.02; recalcMods(c); }},
  {t: 'Centralizar por la fuerza', hint: '+impuestos, −legitimidad', fx: c => { c.legitimacy -= 4; c.radicals = Math.min(0.9, c.radicals + 0.03); c.natMods = c.natMods || {}; c.natMods.tax = (c.natMods.tax || 0) + 0.03; recalcMods(c); }}]);
evo('n_boxer', '🥊', 'Los bóxers', 'Una sociedad secreta ataca a extranjeros y cristianos. La corte duda entre apoyarla o aplastarla.', [
  {t: 'Apoyar la rebelión', hint: 'Prestigio interno; las potencias intervendrán', fx: c => { c.prestige += 3; c.legitimacy += 3; G.tags.forEach(t => { if (t !== NONE && G.C[t].rank <= 8 && t !== c.tag) addRel(c.tag, t, -20); }); }},
  {t: 'Reprimirla y pedir perdón', hint: '+relaciones con las potencias, −legitimidad', fx: c => { c.legitimacy -= 5; G.tags.forEach(t => { if (t !== NONE && G.C[t].rank <= 8 && t !== c.tag) addRel(c.tag, t, 10); }); }}]);
evo('n_depression', '📉', 'La Gran Depresión', 'El hundimiento de los mercados llena de parados las ciudades. Hay que elegir un rumbo económico.', [
  {t: 'Gasto público y obras (nuevo trato)', cost: 3, hint: '+legitimidad, −radicales; coste', fx: c => { c.legitimacy += 6; c.radicals = Math.max(0, c.radicals - 0.07); }},
  {t: 'Austeridad y patrón oro', hint: '+tesoro, +radicales', fx: c => { c.treasury += Math.max(0, c.stats.income) * 2; c.radicals = Math.min(0.9, c.radicals + 0.06); c.legitimacy -= 3; }},
  {t: 'Economía dirigida y rearme', hint: 'Corporativismo; +ejército', fx: c => { if (LAW.corporatism && c.techs.has(LAW.corporatism.tech)) { c.laws.economy = 'corporatism'; } c.natMods = c.natMods || {}; c.natMods.army = (c.natMods.army || 0) + 0.03; recalcMods(c); }}]);
evo('n_rearm', '🛡️', 'El rearme', 'Las tensiones entre potencias obligan a decidir cuánto del presupuesto va a las armas.', [
  {t: 'Rearme total', hint: '+ejército, +divisiones, −inversión', fx: c => { c.natMods = c.natMods || {}; c.natMods.army = (c.natMods.army || 0) + 0.05; c.natMods.invest = (c.natMods.invest || 0) - 0.03; recalcMods(c); if (c.capital >= 0) { const d = []; for (let i = 0; i < 4; i++) d.push(mkDivision('inf', 0.5)); mkArmy(c.tag, stateCapitalProv(c.capital), d); } }},
  {t: 'Rearme moderado', hint: '+defensa', fx: c => { c.natMods = c.natMods || {}; c.natMods.defense = (c.natMods.defense || 0) + 0.05; recalcMods(c); }}]);
evo('n_colonial', '🌍', 'La carrera colonial', 'Los mapas de África y Asia se reparten. Tu gobierno debe elegir hasta dónde llegar.', [
  {t: 'Expedición colonial', cost: 2, hint: '+prestigio, +influencia', fx: c => { c.prestige += 8; c.influence += 30; }},
  {t: 'Concentrarse en la metrópoli', hint: '+inversión', fx: c => { c.natMods = c.natMods || {}; c.natMods.invest = (c.natMods.invest || 0) + 0.03; recalcMods(c); }}]);
evo('n_land_reform', '🌾', 'La cuestión agraria', 'Los campesinos reclaman tierra. Los terratenientes se resisten.', [
  {t: 'Reforma agraria', hint: '−radicales, +producción; la nobleza protesta', fx: c => { c.laws.agrarian = LAW.commercial ? 'commercial' : c.laws.agrarian; recalcMods(c); c.radicals = Math.max(0, c.radicals - 0.06); addIGBoost(c, 'lands', 'suppress', 18); }},
  {t: 'Mantener el orden agrario', hint: '+estabilidad corta, +radicales', fx: c => { c.radicals = Math.min(0.9, c.radicals + 0.04); c.legitimacy += 1; }}]);

/* ---------- filas nuevas en los árboles existentes (más profundidad y época tardía) ---------- */
natAdd('PRU', [
  ['p_danish', 'Guerra de los Ducados', '⚔️', 0, 3, 90, ['northgerman'], [], 'Resolvemos Schleswig-Holstein por las armas o por la diplomacia.', [['event', 'n_schleswig'], ['claim', 'Holstein']], 1860],
  ['p_empire', 'Proclamación del Imperio', '👑', 0, 4, 110, ['p_danish'], [], 'El Reich unido: prestigio y reclamaciones sobre toda Alemania.', [['prestige', 25], ['mod', 'army', .03], ['claim', 'Lorena y Alsacia']], 1866],
  ['p_weltpolitik', 'Weltpolitik y flota', '🚢', 2, 3, 120, ['ironblood'], [], 'Una flota de altura para disputar el mar a Gran Bretaña.', [['tech', 'cruisers'], ['mod', 'army', .02], ['event', 'n_colonial']], 1895],
  ['p_rearm', 'Rearme del Reich', '🛡️', 2, 4, 100, [], [], 'Se rompen las cláusulas militares y se reconstruye el ejército.', [['event', 'n_rearm'], ['divs', 4]], 1933],
  ['p_anschluss', 'Anschluss y los Sudetes', '🦅', 0, 5, 90, [], [], 'La unión de los pueblos de lengua alemana, por consenso o por presión.', [['claim', 'Austria'], ['claim', 'Bohemia'], ['claim', 'Moravia'], ['prestige', 15]], 1936],
  ['p_welfare', 'Seguridad social ampliada', '🏥', 3, 3, 110, ['socialpol'], [], 'Las pensiones y la sanidad pública calman a la clase obrera.', [['mod', 'stab', 2], ['rad', -.04], ['law', 'labor', 'regulated']], 1890]
]);
natAdd('GBR', [
  ['g_homerule', 'La cuestión de Irlanda', '☘️', 2, 3, 90, [], [], 'Un dilema que durará décadas.', [['event', 'n_homerule']], 1880],
  ['g_naval', 'Carrera naval', '⚓', 1, 3, 110, ['empire'], [], 'Dos potencias navales: el patrón de dos flotas.', [['tech', 'dreadnought'], ['mod', 'defense', .03], ['prestige', 10]], 1900],
  ['g_welfare', 'Reformas liberales (1906)', '🏥', 2, 4, 100, ['suffrage2'], [], 'Pensiones y seguro de desempleo.', [['mod', 'stab', 2], ['rad', -.05], ['law', 'labor', 'regulated']], 1906],
  ['g_depress', 'Respuesta a la Gran Depresión', '📉', 0, 3, 90, [], [], 'Una elección económica crucial.', [['event', 'n_depression']], 1930],
  ['g_rearm', 'Rearme y radar', '🛡️', 3, 2, 100, [], [], 'Ampliar la RAF y la flota antes de que sea tarde.', [['event', 'n_rearm'], ['tech', 'radar']], 1935]
]);
natAdd('FRA', [
  ['f_dreyfus', 'Caso Dreyfus', '⚖️', 2, 3, 80, ['republic2'], [], 'La república se examina a sí misma.', [['event', 'n_dreyfus']], 1894],
  ['f_laicite', 'Separación Iglesia-Estado', '🕯️', 2, 4, 100, ['f_dreyfus'], [], 'El laicismo se hace ley.', [['law', 'religion', 'secular'], ['rad', -.03]], 1905],
  ['f_maginot', 'Línea Maginot', '🏰', 3, 2, 120, [], [], 'Fortificar la frontera del Rin.', [['mod', 'defense', .08], ['mod', 'milCost', .03]], 1930],
  ['f_depress', 'El Frente Popular', '🚩', 1, 3, 100, [], [], 'Respuesta a la crisis: vacaciones pagadas y semana de 40 horas.', [['event', 'n_depression']], 1935],
  ['f_colonial', 'Imperio colonial', '🌍', 3, 3, 100, ['africa'], [], 'Indochina, África y Madagascar.', [['event', 'n_colonial']], 1880]
]);
natAdd('RUS', [
  ['r_1905', 'Revolución de 1905', '💥', 0, 3, 80, [], [], 'La primera revolución rusa.', [['event', 'n_duma']], 1904],
  ['r_stolypin', 'Reformas de Stolypin', '🌾', 0, 4, 110, ['r_1905'], [], 'Campesinos propietarios y colonización de Siberia.', [['mod', 'agriOut', .06], ['event', 'n_land_reform']], 1906],
  ['r_plan', 'Planes quinquenales', '🏭', 1, 3, 120, [], [], 'La industrialización a marchas forzadas.', [['law', 'economy', 'interventionism'], ['mod', 'indOut', .08], ['rad', -.04]], 1928],
  ['r_purge', 'Purgas y control del partido', '🕶️', 3, 2, 100, [], [], 'El Estado elimina a sus opositores.', [['mod', 'stab', 3], ['legit', -3], ['mod', 'army', -.02]], 1934],
  ['r_pact', 'Pacto con Alemania', '🤝', 2, 2, 60, [], [], 'Un pacto de no agresión que reparte Europa oriental.', [['rel', 'PRU', 25], ['prestige', 6]], 1939]
]);
natAdd('OTT', [
  ['o_youngturks', 'Los Jóvenes Turcos', '🌙', 0, 3, 90, ['constit'], [], 'Oficiales reformistas toman la iniciativa.', [['event', 'n_youngturks']], 1905],
  ['o_republic', 'Reformas de Atatürk', '🏛️', 0, 4, 120, ['o_youngturks'], [], 'Abolición del sultanato, laicismo y alfabeto latino.', [['law', 'religion', 'secular'], ['law', 'education', 'public_edu'], ['mod', 'lit', .2]], 1920],
  ['o_straits', 'Control de los Estrechos', '🌊', 2, 2, 80, [], [], 'La diplomacia de los Estrechos.', [['rel', 'GBR', 10], ['prestige', 6]], 1920]
]);
natAdd('JAP', [
  ['j_russo', 'Sombra sobre Manchuria', '🎌', 2, 3, 100, ['meijiarmy'], [], 'Rusia o Japón: ¿quién controla Corea?', [['event', 'n_meiji_war']], 1895],
  ['j_zaibatsu', 'Zaibatsu y flota', '🏭', 1, 3, 110, ['bunmei'], [], 'Los grandes conglomerados modernizan la industria.', [['mod', 'indOut', .06], ['tech', 'dreadnought']], 1900],
  ['j_manchuria', 'Incidente de Mukden', '⚔️', 2, 4, 90, [], [], 'El ejército de Kwantung actúa por su cuenta.', [['mod', 'army', .04], ['claim', 'Liaoning'], ['claim', 'Heilongjiang'], ['rad', .03]], 1931],
  ['j_greater', 'Gran Asia Oriental', '🌏', 2, 5, 100, ['j_manchuria'], [], 'Una esfera de coprosperidad bajo liderazgo japonés.', [['claim', 'Zhili'], ['claim', 'Jiangsu'], ['mod', 'army', .03], ['prestige', 10]], 1936]
]);
natAdd('USA', [
  ['u_progress', 'Era progresista', '📜', 1, 3, 100, [], [], 'Regulación de los monopolios, sufragio y reformas.', [['law', 'labor', 'inspections'], ['mod', 'stab', 1], ['rad', -.03]], 1900],
  ['u_empire', 'Intervención en el Caribe', '🌴', 3, 2, 100, ['bigstick'], [], 'La doctrina Roosevelt se hace política.', [['claim', 'Cuba'], ['claim', 'Puerto Rico'], ['prestige', 10]], 1895],
  ['u_depress', 'El Nuevo Trato', '📉', 1, 4, 100, [], [], 'La respuesta de Washington a la Gran Depresión.', [['event', 'n_depression']], 1930],
  ['u_arsenal', 'Arsenal de las democracias', '🏭', 3, 3, 110, [], [], 'Reconvertir la industria para la guerra.', [['mod', 'indOut', .05], ['event', 'n_rearm']], 1938]
]);
natAdd('SPA', [
  ['s_regen', 'Regeneracionismo', '📚', 1, 2, 100, ['const37'], [], 'Tras el Desastre del 98: reformas y educación.', [['law', 'education', 'public_edu'], ['mod', 'lit', .2], ['rad', -.03]], 1898],
  ['s_republic', 'Segunda República', '🗳️', 1, 3, 100, ['s_regen'], [], 'La república con reformas sociales y agrarias.', [['law', 'power', 'universal'], ['event', 'n_land_reform']], 1931]
]);
natAdd('GEN', [
  ['g_soc1', 'Reformas laborales', '⚒️', 1, 2, 100, ['g_ref1'], [], 'Jornadas y condiciones dignas.', [['law', 'labor', 'inspections'], ['rad', -.03]], 1860],
  ['g_agr1', 'Cuestión agraria', '🌾', 0, 2, 100, ['g_ind1'], [], 'Resolver la propiedad de la tierra.', [['event', 'n_land_reform']], 1840],
  ['g_col1', 'Política colonial', '🌍', 3, 2, 100, ['g_exp1'], [], 'Una expedición colonial: prestigio o prudencia.', [['event', 'n_colonial']], 1870],
  ['g_dep1', 'Respuesta a la crisis de 1929', '📉', 0, 3, 90, [], [], 'La Gran Depresión pide decisiones.', [['event', 'n_depression']], 1930],
  ['g_reg1', 'Rearme nacional', '🛡️', 2, 2, 100, ['g_arm1'], [], 'Más gasto militar ante un mundo inestable.', [['event', 'n_rearm']], 1900],
  ['g_caud', 'Caudillos y federalismo', '🏇', 1, 3, 100, [], [], 'Equilibrar el poder central y las regiones.', [['event', 'n_rebel_lat']], 1840]
]);

/* ---------- árboles nuevos ---------- */
const _R = (id, name, icon, b, t, days, req, excl, desc, fx, after) => [id, name, icon, b, t, days, req, excl, desc, fx, after];
natAdd('AUS', [
  _R('a_bach', 'Sistema Bach', '🗂️', 0, 0, 70, [], ['a_constit'], 'Centralización absolutista de Viena.', [['mod', 'bur', .08], ['mod', 'stab', 2]]),
  _R('a_constit', 'Constitución de Febrero', '📜', 0, 1, 90, [], ['a_bach'], 'Representación imperial limitada.', [['law', 'power', 'landed_voting'], ['legit', 5]]),
  _R('a_dual', 'Compromiso austrohúngaro', '⚖️', 1, 1, 110, [], [], 'El imperio se divide en dos mitades con un monarca.', [['mod', 'stab', 2], ['mod', 'army', .02], ['prestige', 10]], 1860),
  _R('a_nat', 'Pacificar las nacionalidades', '🧩', 1, 2, 100, ['a_dual'], [], 'Autonomías para checos, croatas y polacos.', [['rad', -.05], ['mod', 'stab', 2]], 1870),
  _R('a_lomb', 'Defender Lombardía y el Véneto', '🏰', 2, 0, 80, [], [], 'Cuadrilátero y ejército de Radetzky.', [['mod', 'defense', .07], ['divs', 3]]),
  _R('a_triple', 'Alianza con Berlín', '🤝', 2, 1, 90, [], [], 'Alianza dual con Alemania.', [['rel', 'PRU', 40], ['prestige', 6]], 1879),
  _R('a_bos', 'Anexión de Bosnia', '🗺️', 3, 1, 90, [], [], 'Control de los Balcanes occidentales.', [['claim', 'Bosnia'], ['prestige', 8]], 1878),
  _R('a_railb', 'Ferrocarriles balcánicos', '🚂', 3, 0, 90, [], [], 'Salida al Egeo.', [['mod', 'infra', .06], ['mod', 'constr', .04], ['tech', 'railways']])
], ['Reforma imperial', 'Imperio de dos mitades', 'Defensa y alianzas', 'Los Balcanes']);
natAdd('SAR', [
  _R('i_stat', 'Estatuto Albertino', '📜', 0, 0, 70, [], [], 'La primera constitución de la península.', [['law', 'power', 'landed_voting'], ['legit', 5]]),
  _R('i_cavour', 'Política de Cavour', '🎩', 0, 1, 90, ['i_stat'], [], 'Modernizar para ganar prestigio y aliados.', [['mod', 'invest', .05], ['event', 'n_unif_it']]),
  _R('i_unif', 'Unificación italiana', '🇮🇹', 0, 2, 120, ['i_cavour'], [], 'Reclamaciones sobre los Estados italianos.', [['claim', 'Nápoles'], ['claim', 'Sicilia'], ['claim', 'Toscana'], ['claim', 'Estados Pontificios'], ['prestige', 15]]),
  _R('i_ind', 'Triángulo industrial', '🏭', 1, 0, 90, [], [], 'Turín, Milán y Génova.', [['mod', 'indOut', .05], ['mod', 'constr', .04]]),
  _R('i_south', 'La cuestión meridional', '🌾', 1, 1, 100, ['i_ind'], [], 'El sur olvidado.', [['event', 'n_land_reform']], 1861),
  _R('i_col', 'Colonias en África', '🌍', 2, 0, 90, [], [], 'Eritrea, Somalia y Libia.', [['claim', 'Libia'], ['event', 'n_colonial']], 1880),
  _R('i_irred', 'Irredentismo', '🗺️', 2, 1, 90, [], [], 'Trento, Trieste y Dalmacia.', [['claim', 'Dalmacia'], ['claim', 'Tirol']], 1880),
  _R('i_soc', 'Leyes sociales', '🏥', 3, 0, 90, [], [], 'Sufragio ampliado y seguros.', [['mod', 'stab', 2], ['law', 'labor', 'inspections']], 1890)
], ['Risorgimento', 'Industrialización', 'Aventura colonial', 'Reforma social']);
natAdd('SWE', [
  _R('w_scand', 'Escandinavismo', '🇸🇪', 0, 0, 80, [], [], 'Unión nórdica: cooperación con Dinamarca.', [['rel', 'DEN', 40], ['prestige', 5]]),
  _R('w_neutral', 'Política de neutralidad', '🕊️', 1, 0, 70, [], [], 'Paz armada y comercio.', [['mod', 'stab', 2], ['mod', 'invest', .04]]),
  _R('w_iron', 'Hierro de Kiruna', '⛏️', 3, 0, 90, [], [], 'El mineral que alimenta a Europa.', [['mod', 'mineOut', .08], ['mod', 'steelOut', .06]]),
  _R('w_rail', 'Red ferroviaria estatal', '🚂', 3, 1, 90, ['w_iron'], [], 'Ferrocarriles hasta el norte.', [['mod', 'infra', .08], ['tech', 'railways']]),
  _R('w_edu', 'Escuela para todos', '🎓', 2, 0, 90, [], [], 'Alfabetización universal.', [['law', 'education', 'public_edu'], ['mod', 'lit', .3]]),
  _R('w_social', 'Estado de bienestar', '🏥', 2, 1, 110, ['w_edu'], [], 'Socialdemocracia y consenso.', [['law', 'labor', 'regulated'], ['mod', 'stab', 3]], 1900)
], ['Escandinavismo', 'Neutralidad', 'Bienestar social', 'Industria del hierro']);
natAdd('NET', [
  _R('n_col', 'Sistema de cultivos en Java', '☕', 0, 0, 80, [], [], 'Las colonias financian la metrópoli.', [['mod', 'tax', .06], ['mod', 'agriOut', .04]]),
  _R('n_ethical', 'Política ética', '🌴', 0, 1, 100, ['n_col'], [], 'Reformas coloniales: educación y regadíos.', [['mod', 'lit', .1], ['prestige', 6]], 1900),
  _R('n_trade', 'Comercio mundial', '🚢', 1, 0, 80, [], [], 'Puerto de Róterdam y banca.', [['mod', 'invest', .05], ['mod', 'tax', .03]]),
  _R('n_lib', 'Constitución de Thorbecke', '📜', 2, 0, 90, [], [], 'Monarquía parlamentaria.', [['law', 'power', 'wealth_voting'], ['legit', 5]], 1848),
  _R('n_pillar', 'Pacificación de los pilares', '🧩', 2, 1, 100, ['n_lib'], [], 'Católicos, protestantes y socialistas conviven.', [['rad', -.05], ['mod', 'stab', 2]], 1917),
  _R('n_neutral', 'Neutralidad armada', '🛡️', 3, 0, 80, [], [], 'Defensa por inundación.', [['mod', 'defense', .08]])
], ['Imperio colonial', 'Comercio', 'Reformas liberales', 'Defensa']);
natAdd('BEL', [
  _R('b_ind', 'Corredor del hierro', '🏭', 0, 0, 80, [], [], 'Valonia, primera potencia industrial del continente.', [['mod', 'indOut', .07], ['mod', 'steelOut', .06], ['tech', 'blast_furnace']]),
  _R('b_rail', 'Red ferroviaria densa', '🚂', 0, 1, 90, ['b_ind'], [], 'La mayor densidad ferroviaria.', [['mod', 'infra', .08], ['tech', 'railways']]),
  _R('b_congo', 'Estado Libre del Congo', '🌍', 1, 0, 100, [], [], 'Una colonia personal del rey.', [['claim', 'Congo'], ['event', 'n_colonial']], 1880),
  _R('b_neutral', 'Neutralidad garantizada', '🛡️', 2, 0, 80, [], [], 'La neutralidad pesa menos que un ejército.', [['mod', 'defense', .06], ['rel', 'GBR', 20]]),
  _R('b_soc', 'Sufragio universal', '🗳️', 3, 0, 100, [], [], 'La huelga general por el voto.', [['law', 'power', 'universal'], ['rad', -.06]], 1893),
  _R('b_lang', 'Cuestión lingüística', '🗣️', 3, 1, 90, ['b_soc'], [], 'Flamencos y valones.', [['mod', 'stab', 1], ['rad', -.02]], 1898)
], ['Industrialización', 'Congo', 'Neutralidad', 'Reformas sociales']);
natAdd('POR', [
  _R('t_colony', 'Mapa Rosa', '🗺️', 0, 0, 90, [], [], 'Unir Angola y Mozambique.', [['claim', 'Angola'], ['claim', 'Mozambique'], ['prestige', 6]], 1875),
  _R('t_ulti', 'El Ultimátum británico', '📜', 0, 1, 80, ['t_colony'], [], 'Gran Bretaña frena las ambiciones portuguesas.', [['rel', 'GBR', -20], ['rad', .03]], 1890),
  _R('t_regen', 'Regeneración y fontismo', '🚂', 1, 0, 90, [], [], 'Ferrocarriles y obras públicas.', [['mod', 'infra', .08], ['tech', 'railways']]),
  _R('t_ally', 'La alianza más antigua', '🤝', 2, 0, 70, [], [], 'La alianza con Inglaterra.', [['rel', 'GBR', 40], ['mod', 'defense', .04]]),
  _R('t_repub', 'La República de 1910', '🗳️', 3, 0, 100, [], [], 'La caída de la monarquía.', [['law', 'power', 'wealth_voting'], ['rad', -.05]], 1908),
  _R('t_estado', 'Estado Novo', '🏴', 3, 1, 100, [], ['t_repub'], 'Un régimen autoritario y corporativo.', [['law', 'power', 'one_party'], ['law', 'economy', 'corporatism'], ['mod', 'stab', 3], ['reg', 'nationalist']], 1932)
], ['Colonias', 'Industria y obras', 'Alianzas', 'Política interior']);
natAdd('BRZ', [
  _R('z_coffee', 'Economía del café', '☕', 0, 0, 80, [], [], 'El café financia el imperio.', [['mod', 'tax', .05], ['mod', 'agriOut', .06]]),
  _R('z_rail', 'Ferrocarriles paulistas', '🚂', 0, 1, 90, ['z_coffee'], [], 'Del café al puerto de Santos.', [['mod', 'infra', .08], ['tech', 'railways']]),
  _R('z_abol', 'Abolición gradual', '⛓️', 1, 0, 100, [], [], 'Ley del Vientre Libre y Ley Áurea.', [['law', 'bonded', 'slavery_banned'], ['rad', -.05], ['ig', 'lands', .8]], 1850),
  _R('z_immig', 'Inmigración europea', '🚢', 1, 1, 90, ['z_abol'], [], 'Italianos y alemanes en las plantaciones.', [['mod', 'grow', .001], ['mod', 'out', .02]], 1870),
  _R('z_para', 'Guerra del Paraguay', '⚔️', 2, 0, 100, [], [], 'Aliarse con Argentina y Uruguay.', [['mod', 'army', .03], ['rel', 'ARG', 20], ['divs', 3]], 1860),
  _R('z_repub', 'Proclamación de la República', '🗳️', 3, 0, 100, [], [], 'El fin del Imperio.', [['law', 'power', 'landed_voting'], ['legit', 4]], 1885),
  _R('z_vargas', 'Era Vargas', '🏭', 3, 1, 100, ['z_repub'], [], 'Industrialización dirigida.', [['law', 'economy', 'interventionism'], ['mod', 'indOut', .06]], 1930)
], ['Café y progreso', 'Fin de la esclavitud', 'Guerras platenses', 'Política']);
natAdd('MEX', [
  _R('m_refor', 'La Reforma de Juárez', '📜', 0, 0, 80, [], [], 'Constitución liberal y leyes de reforma.', [['law', 'religion', 'tolerance'], ['legit', 4]], 1855),
  _R('m_pors', 'El Porfiriato', '🏴', 1, 0, 90, [], ['m_revol'], 'Orden y progreso a costa de libertades.', [['mod', 'infra', .08], ['mod', 'invest', .06], ['mod', 'rad', .03]], 1876),
  _R('m_rail', 'Ferrocarriles y capital extranjero', '🚂', 1, 1, 90, ['m_pors'], [], 'Compañías extranjeras construyen la red.', [['tech', 'railways'], ['mod', 'constr', .06]]),
  _R('m_revol', 'La Revolución', '🔥', 2, 0, 100, [], ['m_pors'], 'Madero, Villa y Zapata.', [['law', 'power', 'landed_voting'], ['event', 'n_land_reform']], 1910),
  _R('m_oil', 'Nacionalización del petróleo', '🛢️', 2, 1, 100, ['m_revol'], [], 'Cárdenas recupera los recursos del subsuelo.', [['mod', 'tax', .05], ['prestige', 6]], 1936),
  _R('m_sov', 'Defensa de la soberanía', '🛡️', 3, 0, 80, [], [], 'Contra intervenciones extranjeras.', [['mod', 'defense', .06], ['rel', 'USA', -10]])
], ['Reforma liberal', 'Porfiriato', 'Revolución mexicana', 'Soberanía']);
natAdd('CHN', [
  _R('c_self', 'Movimiento de Autofortalecimiento', '⚙️', 0, 0, 90, [], [], 'Arsenales, astilleros y telégrafos.', [['tech', 'telegraph'], ['mod', 'army', .03], ['mod', 'indOut', .03]], 1860),
  _R('c_beiyang', 'Flota de Beiyang', '⚓', 0, 1, 100, ['c_self'], [], 'Una flota moderna para el Imperio.', [['tech', 'ironclad'], ['prestige', 6]], 1875),
  _R('c_hundred', 'Reforma de los Cien Días', '📜', 1, 0, 90, [], ['c_empress'], 'Una modernización radical desde arriba.', [['law', 'education', 'public_edu'], ['mod', 'lit', .2], ['legit', 4]], 1898),
  _R('c_empress', 'La emperatriz viuda', '👑', 1, 1, 80, [], ['c_hundred'], 'La reacción conservadora.', [['mod', 'stab', 3], ['rad', .04]], 1898),
  _R('c_boxer', 'Los bóxers', '🥊', 2, 0, 90, [], [], 'La corte se pronuncia.', [['event', 'n_boxer']], 1899),
  _R('c_repub', 'Revolución de Xinhai', '🗳️', 3, 0, 100, [], [], 'Cae la dinastía.', [['law', 'power', 'oligarchy'], ['reg', 'nationalist']], 1911),
  _R('c_north', 'Expedición al Norte', '⚔️', 3, 1, 100, ['c_repub'], [], 'Reunificar a los señores de la guerra.', [['mod', 'army', .04], ['divs', 4], ['prestige', 8]], 1926)
], ['Autofortalecimiento', 'Reformas', 'Resistencia', 'República']);
natAdd('ARG', [
  _R('r_const', 'Constitución de 1853', '📜', 0, 0, 80, [], [], 'Federal y liberal.', [['law', 'power', 'landed_voting'], ['legit', 4]], 1850),
  _R('r_immig', 'Aluvión inmigratorio', '🚢', 1, 0, 90, [], [], 'Millones de europeos llegan al Plata.', [['mod', 'grow', .001], ['mod', 'indOut', .03]], 1870),
  _R('r_desert', 'Conquista del Desierto', '🏇', 2, 0, 100, [], [], 'La frontera avanza hacia la Patagonia.', [['claim', 'Patagonia'], ['divs', 3]], 1878),
  _R('r_beef', 'Granero y frigorífico', '🥩', 3, 0, 90, [], [], 'Trigo y carne para Europa.', [['mod', 'agriOut', .08], ['mod', 'tax', .04]], 1880),
  _R('r_saenz', 'Ley Sáenz Peña', '🗳️', 1, 1, 90, ['r_immig'], [], 'Voto secreto y obligatorio.', [['law', 'power', 'universal'], ['rad', -.05]], 1912)
], ['Organización nacional', 'Inmigración', 'Frontera', 'Granero del mundo']);
natAdd('PRS', [
  _R('q_amir', 'Reformas de Amir Kabir', '📜', 0, 0, 80, [], [], 'Escuelas, ejército y administración.', [['mod', 'bur', .08], ['mod', 'army', .03]], 1848),
  _R('q_const', 'Revolución Constitucional', '🗳️', 1, 0, 100, [], [], 'El Majlis y la constitución.', [['law', 'power', 'landed_voting'], ['legit', 5]], 1906),
  _R('q_oil', 'Concesión petrolífera', '🛢️', 2, 0, 90, [], [], 'El petróleo atrae a las potencias.', [['mod', 'tax', .06], ['rel', 'GBR', 15]], 1901),
  _R('q_pahlavi', 'Reza Shah y la modernización', '🏭', 0, 1, 100, [], [], 'Ferrocarril transiraní y laicismo.', [['mod', 'infra', .08], ['law', 'religion', 'tolerance'], ['mod', 'lit', .15]], 1925),
  _R('q_balance', 'Tercera potencia', '⚖️', 3, 0, 80, [], [], 'Equilibrar a Rusia y Gran Bretaña.', [['rel', 'RUS', 10], ['rel', 'GBR', 10]])
], ['Reformas', 'Constitucionalismo', 'Petróleo', 'Equilibrio']);
natAdd('EGY', [
  _R('e_ali', 'Obra de Muhammad Ali', '🏛️', 0, 0, 80, [], [], 'Ejército, escuelas y fábricas.', [['mod', 'army', .04], ['mod', 'bur', .06], ['mod', 'indOut', .03]]),
  _R('e_cotton', 'Algodón y ferrocarril', '🌱', 0, 1, 90, ['e_ali'], [], 'El algodón egipcio abastece al mundo.', [['mod', 'agriOut', .06], ['tech', 'railways']]),
  _R('e_suez', 'Canal de Suez', '🚢', 1, 0, 100, [], [], 'La arteria de Oriente.', [['mod', 'tax', .08], ['prestige', 8]], 1859),
  _R('e_debt', 'Deuda y tutela europea', '💸', 1, 1, 80, ['e_suez'], [], 'Francia y Gran Bretaña toman el control.', [['rel', 'GBR', 10], ['mod', 'tax', -.03]], 1875),
  _R('e_urabi', 'Revuelta de Urabi', '🔥', 2, 0, 80, [], [], 'Nacionalismo militar contra la tutela.', [['mod', 'army', .03], ['rad', .03]], 1879),
  _R('e_indep', 'Independencia de 1922', '🇪🇬', 3, 0, 100, [], [], 'Egipto recupera su soberanía.', [['legit', 6], ['prestige', 8]], 1922)
], ['Modernización', 'Canal y deuda', 'Nacionalismo militar', 'Independencia']);
natAdd('SIA', [
  _R('x_mongkut', 'Reformas de Mongkut', '📜', 0, 0, 80, [], [], 'Tratados con las potencias y apertura comercial.', [['mod', 'tax', .05], ['rel', 'GBR', 15]], 1855),
  _R('x_chul', 'Reformas de Chulalongkorn', '🏛️', 0, 1, 100, ['x_mongkut'], [], 'Abolición de la esclavitud y ministerios modernos.', [['law', 'bonded', 'slavery_banned'], ['mod', 'bur', .1]], 1870),
  _R('x_bamboo', 'Diplomacia del bambú', '🎋', 1, 0, 90, [], [], 'Doblarse sin romperse entre Londres y París.', [['mod', 'defense', .06], ['prestige', 5]]),
  _R('x_rail', 'Ferrocarriles reales', '🚂', 2, 0, 90, [], [], 'Unir Bangkok con el norte.', [['tech', 'railways'], ['mod', 'infra', .08]]),
  _R('x_const', 'Revolución de 1932', '🗳️', 3, 0, 100, [], [], 'Monarquía constitucional.', [['law', 'power', 'wealth_voting'], ['legit', 5]], 1932)
], ['Modernización', 'Diplomacia', 'Infraestructuras', 'Constitución']);
natAdd('ETH', [
  _R('h_unif', 'Unificación imperial', '👑', 0, 0, 90, [], [], 'El negus subordina a los ras.', [['mod', 'stab', 3], ['mod', 'army', .03]]),
  _R('h_mod', 'Modernización de Menelik', '🏭', 0, 1, 90, ['h_unif'], [], 'Telégrafo, ferrocarril y ministerios.', [['tech', 'telegraph'], ['mod', 'bur', .08]], 1890),
  _R('h_adwa', 'Victoria de Adwa', '⚔️', 1, 0, 100, [], [], 'La derrota italiana de 1896.', [['prestige', 20], ['mod', 'army', .04]], 1894),
  _R('h_arm', 'Armas europeas', '🔫', 1, 1, 90, ['h_adwa'], [], 'Fusiles modernos para el ejército imperial.', [['tech', 'rifled_muskets'], ['divs', 3]]),
  _R('h_selassie', 'Haile Selassie', '👑', 2, 0, 100, [], [], 'Una nueva constitución imperial.', [['law', 'power', 'oligarchy'], ['mod', 'lit', .1]], 1930),
  _R('h_resist', 'Resistencia ante Italia', '🛡️', 3, 0, 90, [], [], 'La amenaza fascista.', [['mod', 'defense', .08], ['rel', 'GBR', 10]], 1934)
], ['Corona', 'Armas y reformas', 'Reforma imperial', 'Resistencia']);
natAdd('GRE', [
  _R('d_megali', 'Megali Idea', '🇬🇷', 0, 0, 90, [], [], 'Unir todos los territorios griegos.', [['claim', 'Macedonia'], ['claim', 'Constantinopla'], ['prestige', 8]]),
  _R('d_ship', 'Marina mercante', '🚢', 1, 0, 90, [], [], 'La flota mercante más grande del Mediterráneo.', [['mod', 'tax', .05], ['mod', 'invest', .04]]),
  _R('d_const', 'Constitución de 1864', '📜', 2, 0, 90, [], [], 'Monarquía democrática.', [['law', 'power', 'wealth_voting'], ['legit', 5]], 1862),
  _R('d_ally', 'Alianza balcánica', '🤝', 3, 0, 90, [], [], 'Serbia, Bulgaria y Grecia contra el sultán.', [['rel', 'SER', 40], ['mod', 'army', .03]], 1910),
  _R('d_balkwar', 'Guerras balcánicas', '⚔️', 3, 1, 100, ['d_ally'], [], 'La oportunidad de ampliar fronteras.', [['divs', 3], ['claim', 'Bulgaria']], 1912)
], ['Megali Idea', 'Mar y comercio', 'Instituciones', 'Alianzas balcánicas']);
