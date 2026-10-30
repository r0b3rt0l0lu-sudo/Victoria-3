/* ===== EVENTOS AMPLIADOS, RASGOS NACIONALES Y LOGROS ===== */
const cnt = (c, k, n) => { c.cnt = c.cnt || {}; c.cnt[k] = (c.cnt[k] || 0) + (n === undefined ? 1 : n); return c.cnt[k]; };
const cntOf = (c, k) => (c.cnt && c.cnt[k]) || 0;
const wkInc = (c, n) => c.stats.income * n;
function popShock(c, f, ids) { (ids || c.states).forEach(id => { const s = G.S[id]; for (const p in s.pops) s.pops[p] *= f; }); }
function addIGBoost(c, ig, mode, months) { c.boosts.push({kind: 'ig', key: ig, mult: mode === 'boost' ? 1.45 : 0.55, months: months || 12, mode}); }
function randState(c, notCapital) { const l = c.states.filter(id => !notCapital || id !== c.capital); return l.length ? G.S[pick(l)] : null; }
function freeTech(c) {
  const av = TECHS.filter(t => techAvailable(c, t)); if (!av.length) { c.innovStock += 400; return null; }
  const t = pick(av); c.techs.add(t.id); if (c.research === t.id) c.research = null; recalcMods(c); return t;
}
function addTimedFx(c, name, icon, fx, months, desc) {
  const cr = {id: G.nextId++, type: 'aid', name, icon, scope: c.tag, months, left: months, fx, desc: desc || '', started: Object.assign({}, G.date)};
  G.crises.push(cr); return cr;
}
function threatenerFor(c) {
  return G.rankList.slice(0, 8).find(t => t !== c.tag && alive(t) && !warBlockers(t, c.tag) && armyPower(G.C[t]) > armyPower(c) * 1.35 && !anyPactBetween(t, c.tag, ['alliance', 'nonagg', 'guarantee']) && relOf(t, c.tag) < 30 && c.states.length >= 2);
}

EVENTS.push(
 {id: 'gold_rush', icon: '⛏️', title: 'Fiebre del oro', w: 0.8, cond: c => c.stats.pop > 1e6,
  text: c => 'Se han descubierto filones de oro en una región remota y miles de aventureros acuden en masa.',
  opts: [{t: 'Monopolio estatal sobre las minas', cost: 2, hint: '+12 semanas de ingresos, +3 prestigio, los terratenientes se enojan', fx: c => { c.treasury += wkInc(c, 12); c.prestige += 3; addIGBoost(c, 'lands', 'suppress', 6); }},
         {t: 'Libre explotación para particulares', hint: '+5 semanas de ingresos y más inversión privada', fx: c => { c.treasury += wkInc(c, 5); c.investPool += wkInc(c, 6); const s = randState(c); if (s) for (const p in s.pops) s.pops[p] *= 1.008; }}]},
 {id: 'potato_blight', icon: '🥔', title: 'Plaga en los cultivos', w: 0.7, cond: c => c.stats.sol < 12 && c.stats.pop > 2e6,
  text: c => 'Un hongo desconocido pudre las cosechas. El campo se llena de familias hambrientas y empiezan los rumores de revuelta.',
  opts: [{t: 'Importar grano y abrir graneros públicos', cost: 6, hint: 'Evita la hambruna; +legitimidad', fx: c => { c.legitimacy += 4; }},
         {t: 'Confiar en la caridad privada', hint: 'Hambruna nacional durante 12 meses; más radicales', fx: c => { addCrisis('local_famine', c.tag, {months: 12, left: 12}); c.radicals = Math.min(0.9, c.radicals + 0.05); }}]},
 {id: 'palace_coup', icon: '🗡️', title: 'Conspiración en palacio', w: 0.8, cond: c => c.legitimacy < 55 && ['autocracy', 'oligarchy'].includes(c.laws.power),
  text: c => 'Un grupo de generales y cortesanos prepara el derrocamiento del gobierno. La conjura ha sido descubierta a tiempo… o eso dicen.',
  opts: [{t: 'Purgar a los conspiradores', hint: '−4 legitimidad, +radicales, las Fuerzas Armadas pierden peso', fx: c => { c.legitimacy -= 4; c.radicals = Math.min(0.9, c.radicals + 0.04); addIGBoost(c, 'armed', 'suppress', 12); }},
         {t: 'Comprar su lealtad con cargos y pagas', cost: 3, hint: 'Las Fuerzas Armadas ganan influencia; +4 legitimidad', fx: c => { addIGBoost(c, 'armed', 'boost', 12); c.legitimacy += 4; }},
         {t: 'Hacer concesiones constitucionales', hint: 'Reduce el radicalismo pero debilita a los terratenientes', fx: c => { c.radicals = Math.max(0, c.radicals - 0.04); c.legitimacy += 6; addIGBoost(c, 'lands', 'suppress', 12); }}]},
 {id: 'assassination', icon: '💥', title: 'Atentado contra el gobierno', w: 0.7, cond: c => c.radicals > 0.14,
  text: c => 'Un anarquista ha atentado contra un alto cargo del gobierno. La sociedad exige respuestas.',
  opts: [{t: 'Reforzar la policía y la vigilancia', cost: 3, hint: '−2% radicales, +prestigio interno', fx: c => { c.radicals = Math.max(0, c.radicals - 0.025); c.legitimacy += 2; }},
         {t: 'Culpar a la oposición y endurecer la censura', hint: '+legitimidad a corto plazo, pero +5% radicales', fx: c => { c.legitimacy += 5; c.radicals = Math.min(0.9, c.radicals + 0.05); if (LAW.censorship) c.laws.press = 'censorship'; recalcMods(c); }}]},
 {id: 'world_fair', icon: '🎡', title: 'Gran Exposición Universal', w: 0.6, cond: c => c.stats.indLevels > 25 && c.rank <= 14,
  text: c => 'Tu país puede organizar una gran exposición internacional con los últimos adelantos de la técnica.',
  opts: [{t: 'Organizarla con fastuosidad', cost: 6, hint: '+15 prestigio, +300 de innovación, mejora relaciones con las potencias', fx: c => { c.prestige += 15; c.innovStock += 300; G.rankList.slice(0, 10).forEach(t => { if (t !== c.tag) addRel(c.tag, t, 6); }); }},
         {t: 'Participar con un pabellón modesto', cost: 1, hint: '+4 prestigio', fx: c => { c.prestige += 4; c.innovStock += 60; }}]},
 {id: 'genius', icon: '🔬', title: 'Un genio científico', w: 0.7, cond: c => c.lit > 25,
  text: c => 'Un joven inventor ofrece sus servicios al Estado… o a una potencia extranjera.',
  opts: [{t: 'Patrocinar su laboratorio', cost: 3, hint: 'Obtienes una tecnología gratis', fx: c => { const t = freeTech(c); if (t) notify('tech', `El genio revoluciona el país: ${t.name}.`); }},
         {t: 'Dejar que emigre', hint: '−2 prestigio', fx: c => { c.prestige = Math.max(0, c.prestige - 2); }}]},
 {id: 'capital_fire', icon: '🔥', title: 'Gran incendio en la capital', w: 0.6, cond: c => c.capital >= 0 && G.S[c.capital].owner === c.tag,
  text: c => `Un incendio devora los barrios más populosos de ${G.S[c.capital].name}. Miles de familias lo han perdido todo.`,
  opts: [{t: 'Reconstruir con financiación estatal', cost: 5, hint: 'Se limita el daño y sube la legitimidad', fx: c => { popShock(c, 0.999, [c.capital]); c.legitimacy += 4; }},
         {t: 'Dejar la reconstrucción a la iniciativa privada', hint: '−3% población en la capital, −4 legitimidad', fx: c => { popShock(c, 0.97, [c.capital]); c.legitimacy -= 4; c.investPool *= 0.8; }}]},
 {id: 'earthquake', icon: '🌋', title: 'Terremoto', w: 0.5, cond: c => c.states.length > 2,
  ctx: c => ({sid: randState(c).id}),
  text: (c, x) => `Un violento terremoto sacude ${G.S[x.sid].name}. Hay miles de muertos y las comunicaciones están cortadas.`,
  opts: [{t: 'Enviar ayuda y reconstruir', cost: 4, hint: '+3 legitimidad', fx: (c, x) => { popShock(c, 0.995, [x.sid]); c.legitimacy += 3; }},
         {t: 'Limitarse a enviar condolencias', hint: '−2% población, −5 legitimidad, +radicales', fx: (c, x) => { popShock(c, 0.98, [x.sid]); c.legitimacy -= 5; c.radicals = Math.min(0.9, c.radicals + 0.04); }}]},
 {id: 'ultimatum', icon: '📜', title: 'Ultimátum de una gran potencia', w: 1.3, cond: c => !!threatenerFor(c),
  ctx: c => { const agg = threatenerFor(c); const rs = reachableStates(agg, c.tag); return {agg, sid: (rs[0] || {id: c.states[0]}).id}; },
  text: (c, x) => `${G.C[x.agg].name} exige la cesión de <b>${G.S[x.sid].name}</b> y amenaza con invadir si no la obtiene en un mes. Su ejército es mucho más fuerte que el tuyo.`,
  opts: [{t: 'Ceder el territorio', hint: '−10 prestigio, −8 legitimidad, pierdes el estado', fx: (c, x) => { transferState(G.S[x.sid], x.agg); c.prestige = Math.max(0, c.prestige - 10); c.legitimacy -= 8; addRel(c.tag, x.agg, 10); }},
         {t: 'Pagar un tributo para evitar la guerra', cost: 8, hint: '−4 prestigio, evita la guerra', fx: (c, x) => { G.C[x.agg].treasury += wkInc(c, 8); c.prestige = Math.max(0, c.prestige - 4); addRel(c.tag, x.agg, 8); }},
         {t: 'Rechazar y prepararse para la guerra', hint: 'El agresor te declara la guerra (tus aliados te apoyarán)', fx: (c, x) => { c.prestige += 3; c.radicals = Math.max(0, c.radicals - 0.02); const r = declareWar(x.agg, c.tag, 'conquest', [x.sid], {free: true}); if (!r.ok) notify('war', 'El agresor se echa atrás.'); }}]},
 {id: 'separatists', icon: '🏴', title: 'Movimiento separatista', w: 1.0, cond: c => c.states.length >= 5 && c.legitimacy < 55 && c.radicals > 0.12,
  ctx: c => ({sid: randState(c, true).id}),
  text: (c, x) => `Los nacionalistas de ${G.S[x.sid].name} exigen la independencia y han tomado edificios públicos.`,
  opts: [{t: 'Conceder autonomía y ayudas', cost: 4, hint: '+4 legitimidad, el estado sigue siendo tuyo', fx: c => { c.legitimacy += 4; c.radicals = Math.max(0, c.radicals - 0.02); }},
         {t: 'Reprimir con el ejército', hint: '+5% radicales, −3 legitimidad; −0,5% soldados', fx: (c, x) => { c.radicals = Math.min(0.9, c.radicals + 0.05); c.legitimacy -= 3; popShock(c, 0.9995, [x.sid]); }},
         {t: 'Dejarlos marchar', hint: 'Pierdes el estado; −5 prestigio', fx: (c, x) => { const s = G.S[x.sid]; if (s.owner === c.tag) { transferState(s, NONE); c.prestige = Math.max(0, c.prestige - 5); } }}]},
 {id: 'immigration', icon: '🚢', title: 'Ola migratoria', w: 0.7, cond: c => c.laws.migration !== 'closed_borders' && c.stats.sol > 8,
  text: c => 'Miles de emigrantes, huyendo del hambre o de las guerras, llegan a tus puertos.',
  opts: [{t: 'Acogerlos y asentarlos', cost: 2, hint: '+2% población en un estado, más mano de obra', fx: c => { const s = randState(c); if (s) for (const p in s.pops) s.pops[p] *= 1.02; }},
         {t: 'Cerrar los puertos', hint: '+1 legitimidad entre los conservadores', fx: c => { c.legitimacy += 1; addIGBoost(c, 'lands', 'boost', 6); }}]},
 {id: 'bank_scandal', icon: '🏦', title: 'Escándalo bancario', w: 0.7, cond: c => c.investPool > wkInc(c, 4),
  text: c => 'Un gran banco ha quebrado tras descubrirse fraudes. Los ahorradores asaltan sus oficinas.',
  opts: [{t: 'Rescatar al banco con dinero público', cost: 6, hint: 'Se conserva la inversión privada', fx: c => { c.legitimacy -= 2; }},
         {t: 'Dejarlo caer', hint: 'La inversión privada cae un 70%; +radicales', fx: c => { c.investPool *= 0.3; c.radicals = Math.min(0.9, c.radicals + 0.03); }}]},
 {id: 'bumper_harvest', icon: '🌽', title: 'Cosecha excepcional', w: 0.9, cond: c => c.stats.pop > 1e6,
  text: c => 'Un clima benigno ha dado unas cosechas extraordinarias. Los graneros rebosan.',
  opts: [{t: 'Subsidiar el consumo y exportar el excedente', cost: 1, hint: '+8% de consumo durante 8 meses', fx: c => { addTimedFx(c, 'Cosecha excepcional', '🌽', {demand: 1.06, agri: 1.1}, 8, 'Alimentos baratos y abundantes.'); c.legitimacy += 3; }},
         {t: 'Almacenar para tiempos peores', hint: '+4 semanas de ingresos', fx: c => { c.treasury += wkInc(c, 4); }}]},
 {id: 'dynastic_marriage', icon: '💍', title: 'Matrimonio dinástico', w: 0.8, cond: c => c.monarchy && G.rankList.slice(0, 8).some(t => t !== c.tag && !pactBetween('alliance', c.tag, t)),
  ctx: c => ({p: G.rankList.slice(0, 8).filter(t => t !== c.tag && alive(t))[Math.floor(Math.random() * 5)] || G.rankList[0]}),
  text: (c, x) => `La casa real de ${G.C[x.p].name} propone un matrimonio entre ambas familias.`,
  opts: [{t: 'Aceptar y sellar una alianza', hint: 'Relación +40 y alianza si lo aceptan', fx: (c, x) => { addRel(c.tag, x.p, 40); if (!pactBetween('alliance', c.tag, x.p) && alive(x.p) && !c.overlord) makePact('alliance', c.tag, x.p); c.prestige += 4; }},
         {t: 'Declinar con cortesía', hint: 'Sin consecuencias', fx: c => {}}]},
 {id: 'mutiny', icon: '🎖️', title: 'Motín militar', w: 0.8, cond: c => c.ig.armed && c.ig.armed.approval < 1 && c.stats.soldiers > 20000,
  text: c => 'Los soldados llevan meses sin cobrar la paga y se niegan a obedecer a sus oficiales.',
  opts: [{t: 'Pagar atrasos y subir las pagas', cost: 4, hint: 'Más financiación militar (125%); ejército contento', fx: c => { c.milFund = 1.25; addIGBoost(c, 'armed', 'boost', 12); }},
         {t: 'Fusilar a los cabecillas', hint: '−3 legitimidad, +radicales, −1% soldados', fx: c => { c.legitimacy -= 3; c.radicals = Math.min(0.9, c.radicals + 0.03); popShock(c, 0.999); }}]},
 {id: 'industrial_accident', icon: '🏭', title: 'Catástrofe industrial', w: 0.8, cond: c => c.stats.indLevels > 12,
  text: c => 'Una explosión en una gran fábrica ha matado a cientos de obreros. La prensa exige una regulación.',
  opts: [{t: 'Imponer inspecciones de seguridad', cost: 2, hint: 'Mejora la aprobación de los sindicatos; −2% producción industrial 6 meses', fx: c => { addIGBoost(c, 'union', 'boost', 12); addTimedFx(c, 'Nuevas normas de seguridad', '🛡️', {ind: 0.98}, 6); c.radicals = Math.max(0, c.radicals - 0.02); }},
         {t: 'Culpar a los trabajadores', hint: '+5% radicales; los industriales te apoyan', fx: c => { c.radicals = Math.min(0.9, c.radicals + 0.05); addIGBoost(c, 'indus', 'boost', 12); }}]},
 {id: 'industrial_espionage', icon: '🕵️', title: 'Espionaje industrial', w: 0.7, cond: c => G.rankList.slice(0, 5).some(t => t !== c.tag && G.C[t].techs.size > c.techs.size + 3),
  ctx: c => ({v: G.rankList.slice(0, 5).find(t => t !== c.tag && G.C[t].techs.size > c.techs.size + 3)}),
  text: (c, x) => `Tus agentes han conseguido los planos de una máquina revolucionaria de ${G.C[x.v].name}.`,
  opts: [{t: 'Copiarlos', hint: '+400 innovación; relación −15 con ' + 'el propietario', fx: (c, x) => { c.innovStock += 400; addRel(c.tag, x.v, -15); }},
         {t: 'Devolverlos como gesto de buena fe', hint: '+4 prestigio, relación +10', fx: (c, x) => { c.prestige += 4; addRel(c.tag, x.v, 10); }}]},
 {id: 'colonial_revolt', icon: '🔥', title: 'Rebelión en una provincia lejana', w: 0.7, cond: c => c.states.length > 4 && c.stats.sol < 14,
  ctx: c => ({sid: randState(c, true).id}),
  text: (c, x) => `${G.S[x.sid].name} se alza contra el gobierno, harta de impuestos y abusos.`,
  opts: [{t: 'Enviar tropas', cost: 3, hint: '−1% población allí, +2 legitimidad', fx: (c, x) => { popShock(c, 0.99, [x.sid]); c.legitimacy += 2; }},
         {t: 'Negociar y reducir los impuestos', hint: 'Tu recaudación cae un 3% durante 12 meses', fx: c => { addTimedFx(c, 'Rebaja fiscal pactada', '📉', {demand: 1.02}, 12); c.legitimacy += 3; c.taxLevel = Math.max(0, c.taxLevel - 1); }}]},
 {id: 'trade_boom', icon: '🚢', title: 'Boom comercial', w: 0.8, cond: c => c.stats.gdp > 0 && G.cycle > -0.2,
  text: c => 'Los mercados internacionales piden tus productos y los puertos viven una actividad frenética.',
  opts: [{t: 'Ampliar puertos y muelles', cost: 3, hint: '+5% consumo y +20% inversión durante 8 meses', fx: c => { addTimedFx(c, 'Boom comercial', '🚢', {demand: 1.05, invest: 1.2}, 8, 'El comercio exterior prospera.'); }},
         {t: 'Gravar el tráfico con aranceles', hint: '+5 semanas de ingresos; −3% consumo 6 meses', fx: c => { c.treasury += wkInc(c, 5); addTimedFx(c, 'Aranceles al comercio', '🚫', {demand: 0.97}, 6); }}]},
 {id: 'church_conflict', icon: '⛪', title: 'Conflicto con la Iglesia', w: 0.6, cond: c => c.laws.religion !== 'state_religion',
  text: c => 'El clero denuncia las nuevas ideas liberales y llama a los fieles a la desobediencia.',
  opts: [{t: 'Reconciliarse con la Iglesia', cost: 2, hint: 'El clero gana influencia 12 meses', fx: c => { addIGBoost(c, 'devout', 'boost', 12); c.legitimacy += 2; addIGBoost(c, 'intel', 'suppress', 12); }},
         {t: 'Confrontar y recortar sus privilegios', hint: 'El clero pierde influencia; +radicales', fx: c => { addIGBoost(c, 'devout', 'suppress', 12); addIGBoost(c, 'intel', 'boost', 12); c.radicals = Math.min(0.9, c.radicals + 0.02); }}]},
 {id: 'nationalist_wave', icon: '🚩', title: 'Ola nacionalista', w: 0.7, cond: c => c.techs.has('nationalism') || c.ig.armed && c.ig.armed.share > 0.1,
  text: c => 'Un fervor patriótico recorre el país. Asociaciones, periódicos y cuarteles claman por la grandeza nacional.',
  opts: [{t: 'Alentarlo', hint: '+10 prestigio, +15 infamia, el ejército gana peso', fx: c => { c.prestige += 10; c.infamy += 15; addIGBoost(c, 'armed', 'boost', 12); c.radicals = Math.max(0, c.radicals - 0.02); }},
         {t: 'Calmar los ánimos', hint: '+2 legitimidad', fx: c => { c.legitimacy += 2; }}]},
 {id: 'peasant_revolt', icon: '🔱', title: 'Revuelta campesina', w: 1.0, cond: c => c.laws.agrarian === 'serfdom' || (c.stats.sol < 7 && c.stats.pop > 3e6),
  text: c => 'Los campesinos se rebelan contra los señores y las levas. Los incendios de haciendas se multiplican.',
  opts: [{t: 'Abolir la servidumbre', hint: 'Cambia a aparcería; los terratenientes pierden peso; +legitimidad', fx: c => { if (c.laws.agrarian === 'serfdom') { c.laws.agrarian = 'tenant'; recalcMods(c); } addIGBoost(c, 'lands', 'suppress', 12); addIGBoost(c, 'rural', 'boost', 12); c.legitimacy += 5; c.radicals = Math.max(0, c.radicals - 0.04); }},
         {t: 'Aplastar la revuelta', hint: '+6% radicales, −1% población rural', fx: c => { c.radicals = Math.min(0.9, c.radicals + 0.06); popShock(c, 0.998); addIGBoost(c, 'lands', 'boost', 12); }}]},
 {id: 'royal_death', icon: '👑', title: 'Muerte del soberano', w: 0.9, cond: c => c.monarchy && c.stats.pop > 1e6,
  text: c => 'El monarca ha fallecido sin dejar un heredero claro. La corte se divide.',
  opts: [{t: 'Apoyar al primogénito', hint: '70%: +8 legitimidad · 30%: heredero débil (−6)', fx: c => { if (Math.random() < 0.7) { c.legitimacy += 8; c.prestige += 3; } else { c.legitimacy -= 6; c.radicals = Math.min(0.9, c.radicals + 0.03); } }},
         {t: 'Apoyar al hermano ambicioso', hint: '45%: +10 legitimidad y +200 innovación · 55%: guerra sucesoria (−10, +8% radicales)', fx: c => { if (Math.random() < 0.45) { c.legitimacy += 10; c.innovStock += 200; } else { c.legitimacy -= 10; c.radicals = Math.min(0.9, c.radicals + 0.08); addCrisis('strike', c.tag); } }},
         {t: 'Establecer un consejo de regencia', hint: '−1 legitimidad, estabilidad asegurada', fx: c => { c.legitimacy -= 1; c.radicals = Math.max(0, c.radicals - 0.01); }}]},
 {id: 'epidemic_event', icon: '☣️', title: 'Pandemia de cólera', w: 0.9, cond: c => c.stats.pop > 1e6 && !c.techs.has('medicine'),
  text: c => 'El cólera llega a los puertos y se extiende por las ciudades hacinadas.',
  opts: [{t: 'Cordones sanitarios y hospitales de campaña', cost: 4, hint: 'Limita la mortalidad (−0,3%)', fx: c => { popShock(c, 0.997); c.legitimacy += 2; }},
         {t: 'No hacer nada', hint: '−1,5% de población en todo el país; −3 legitimidad', fx: c => { popShock(c, 0.985); c.legitimacy -= 3; addCrisis('epidemic', c.tag); }}]},
 {id: 'oil_find', icon: '🛢️', title: 'Hallazgo de recursos', w: 0.6, cond: c => c.states.length > 1,
  ctx: c => ({sid: randState(c).id, kind: pick(['coal', 'iron'])}),
  text: (c, x) => `Los geólogos han localizado un gran yacimiento de ${x.kind === 'coal' ? 'carbón' : 'hierro'} en ${G.S[x.sid].name}.`,
  opts: [{t: 'Explotarlo de inmediato', cost: 2, hint: '+5 niveles de capacidad y 2 niveles construidos', fx: (c, x) => { const s = G.S[x.sid]; s.cap[x.kind] = (s.cap[x.kind] || 0) + 5; s.b[x.kind] = (s.b[x.kind] || 0) + 2; notify('event', `Nuevo yacimiento en ${s.name}.`, s.id); }},
         {t: 'Venderlo a una compañía extranjera', hint: '+8 semanas de ingresos', fx: c => { c.treasury += wkInc(c, 8); }}]},
 {id: 'revolutionary_wave', icon: '🔥', title: 'Ola revolucionaria en Europa', w: 0.6, cond: c => G.date.y >= 1846 && G.date.y <= 1850 && c.laws.power !== 'universal',
  text: c => 'Las revueltas se extienden de capital en capital. Estudiantes y obreros levantan barricadas pidiendo constitución y pan.',
  opts: [{t: 'Conceder reformas liberales', hint: 'El voto se amplía si es posible; +8 legitimidad; los conservadores se resienten', fx: c => { if (c.laws.power === 'autocracy') c.laws.power = 'oligarchy'; else if (c.laws.power === 'oligarchy' && c.techs.has('liberalism')) c.laws.power = 'wealth_voting'; recalcMods(c); c.legitimacy += 8; addIGBoost(c, 'intel', 'boost', 12); addIGBoost(c, 'lands', 'suppress', 12); }},
         {t: 'Reprimir sin piedad', hint: '+10% radicales y −8 legitimidad; el ejército gana peso', fx: c => { c.radicals = Math.min(0.9, c.radicals + 0.10); c.legitimacy -= 8; addIGBoost(c, 'armed', 'boost', 12); }}]},
 {id: 'tech_conference', icon: '🎓', title: 'Congreso científico internacional', w: 0.7, cond: c => c.lit > 30 && c.rank <= 20,
  text: c => 'Los sabios de toda Europa se reúnen para intercambiar descubrimientos.',
  opts: [{t: 'Acoger el congreso', cost: 3, hint: '+250 innovación y +5 prestigio', fx: c => { c.innovStock += 250; c.prestige += 5; }},
         {t: 'Enviar una delegación', cost: 1, hint: '+80 innovación', fx: c => { c.innovStock += 80; }}]},
 {id: 'general_strike_ev', icon: '✊', title: 'Huelga general convocada', w: 0.8, cond: c => c.radicals > 0.2 && c.stats.indLevels > 8,
  text: c => 'Los sindicatos convocan una huelga general exigiendo la jornada de diez horas.',
  opts: [{t: 'Ceder: jornada de diez horas', hint: 'Los sindicatos ganan influencia; −2% producción industrial 6 m', fx: c => { addIGBoost(c, 'union', 'boost', 12); addTimedFx(c, 'Jornada reducida', '⏱️', {ind: 0.98}, 6); c.radicals = Math.max(0, c.radicals - 0.05); }},
         {t: 'Resistir', hint: '−15% industria 6 meses; +radicales', fx: c => { addCrisis('strike', c.tag); c.radicals = Math.min(0.9, c.radicals + 0.03); addIGBoost(c, 'indus', 'boost', 12); }}]}
);

// Selección con pesos, contexto y espaciado mínimo
function randomEvents() {
  const c = G.C[G.player];
  if (!c || !c.states.length) return;
  if (G.pendingEvent) return;
  if (G.lastEventT !== undefined && G.date.t - G.lastEventT < 40) return;
  if (Math.random() > 0.24) return;
  const ok = EVENTS.filter(e => (e.w === undefined || e.w > 0) && !(G.eventCool[e.id] > G.date.t) && (() => { try { return e.cond(c); } catch (_) { return false; } })());
  if (!ok.length) return;
  let tot = 0; ok.forEach(e => tot += e.w || 1);
  let r = Math.random() * tot, e = ok[0];
  for (const x of ok) { r -= x.w || 1; if (r <= 0) { e = x; break; } }
  G.eventCool[e.id] = G.date.t + 365 * (e.cool || 1.3); G.lastEventT = G.date.t;
  const ctx = e.ctx ? e.ctx(c) : null;
  G.pendingEvent = {id: e.id, title: e.title, icon: e.icon || '📰', text: e.text(c, ctx), ctx};
}
function resolveEvent(i) {
  const pe = G.pendingEvent; if (!pe) return;
  const e = EVENTS.find(x => x.id === pe.id); const c = G.C[G.player]; const o = e.opts[i];
  if (o.cost) c.treasury -= c.stats.income * o.cost;
  G.pendingEvent = null;
  try { o.fx(c, pe.ctx); } catch (err) { console.warn('evento', err); }
  cnt(c, 'events');
  c.legitimacy = clamp(c.legitimacy, 0, 100);
}

/* ===== RASGOS NACIONALES (ventajas y desventajas según la situación inicial) ===== */
const TRAITS = {
  industrial_cradle: {name: 'Cuna de la industria', icon: '🏭', good: true, fx: {indOut: 0.07, innov: 0.08}, desc: 'La primera revolución industrial nació aquí: talleres, ingenieros y capital abundante.'},
  sea_power: {name: 'Supremacía naval', icon: '⚓', good: true, fx: {defense: 0.08, logistics: 0.10}, desc: 'La mayor flota del mundo protege las rutas y las costas.'},
  colonial_wealth: {name: 'Riqueza colonial', icon: '💎', good: true, fx: {tax: 0.04, invest: 0.04}, treasury: 1.6, desc: 'Las colonias llenan las arcas y financian inversiones.'},
  strong_bureau: {name: 'Administración eficaz', icon: '🏛️', good: true, fx: {bur: 0.10, tax: 0.02}, desc: 'Una larga tradición de funcionarios competentes.'},
  revolutionary_legacy: {name: 'Legado revolucionario', icon: '🗽', good: false, fx: {rad: 0.8, army: 0.04, lit: 0.04}, desc: 'La memoria de la revolución inspira, pero también inquieta.'},
  disciplined_army: {name: 'Ejército disciplinado', icon: '🎖️', good: true, fx: {army: 0.10, milCost: -0.05}, desc: 'Prusia y su tradición militar: oficiales profesionales y reclutamiento eficaz.'},
  educated_people: {name: 'Pueblo instruido', icon: '📚', good: true, fx: {lit: 0.10, innov: 0.05}, desc: 'La escuela es una prioridad nacional desde hace generaciones.'},
  vast_lands: {name: 'Tierras inmensas', icon: '🌾', good: true, fx: {agriOut: 0.06, defense: 0.12}, desc: 'La extensión y el invierno son aliados formidables.'},
  backward_admin: {name: 'Administración atrasada', icon: '🐌', good: false, fx: {bur: -0.12, tax: -0.04}, desc: 'Corrupción, papeleo y provincias ingobernables.'},
  serf_society: {name: 'Sociedad servil', icon: '⛓️', good: false, fx: {agriOut: -0.04, rad: 1.0, innov: -0.05}, desc: 'Millones de campesinos atados a la tierra frenan la modernización.'},
  multinational: {name: 'Mosaico de naciones', icon: '🧩', good: false, fx: {stab: -2, rad: 1.2, army: -0.03}, desc: 'Húngaros, checos, polacos, italianos… cada nación sueña con su independencia.'},
  sick_man: {name: 'El enfermo de Europa', icon: '🤒', good: false, fx: {bur: -0.10, tax: -0.06, stab: -2}, until: c => c.techs.size >= 14, desc: 'Un imperio extenso y decadente, acosado por sus vecinos.'},
  strategic_position: {name: 'Posición estratégica', icon: '🧭', good: true, fx: {invest: 0.03, logistics: 0.05}, desc: 'Los Estrechos y las rutas comerciales pasan por tus manos.'},
  frontier_land: {name: 'La frontera abierta', icon: '🤠', good: true, fx: {agriOut: 0.06, grow: 0.002}, desc: 'Tierras libres y colonos hambrientos de prosperidad.'},
  slave_tension: {name: 'Tensión esclavista', icon: '⚖️', good: false, fx: {rad: 1.2, stab: -1}, until: c => c.laws.bonded === 'slavery_banned', desc: 'El Norte y el Sur se miran con recelo.'},
  merchant_marine: {name: 'Marina mercante', icon: '🚢', good: true, fx: {invest: 0.06, tax: 0.03}, desc: 'Banqueros y navieros mueven medio mundo.'},
  early_industry: {name: 'Industrialización temprana', icon: '⛏️', good: true, fx: {indOut: 0.06, mineOut: 0.04}, desc: 'Minas y fábricas en la primera línea del continente.'},
  armed_neutrality: {name: 'Neutralidad armada', icon: '🏔️', good: true, fx: {defense: 0.15, stab: 1}, desc: 'Montañas, milicias y tradición neutral.'},
  banking_hub: {name: 'Centro bancario', icon: '🏦', good: true, fx: {invest: 0.05, crisis: 0.10}, desc: 'La plaza financiera más segura del continente.'},
  isolation: {name: 'Aislamiento', icon: '🏯', good: false, fx: {innov: -0.12, invest: -0.03}, until: c => c.techs.size >= 6, desc: 'El país vive de espaldas al mundo exterior.'},
  samurai_tradition: {name: 'Tradición guerrera', icon: '🗡️', good: true, fx: {army: 0.06, stab: 1}, desc: 'Una casta militar disciplinada y orgullosa.'},
  demographic_giant: {name: 'Gigante demográfico', icon: '👥', good: true, fx: {army: 0.04, grow: 0.001}, desc: 'Una cantidad inmensa de brazos y reclutas.'},
  closed_society: {name: 'Sociedad cerrada', icon: '🚪', good: false, fx: {innov: -0.10, lit: -0.03}, until: c => c.techs.size >= 8, desc: 'Desconfianza ante lo extranjero y ante las novedades.'},
  decaying_dynasty: {name: 'Dinastía decadente', icon: '🥀', good: false, fx: {stab: -2, bur: -0.08}, until: c => c.prestige >= 80, desc: 'El poder central se debilita y los gobernadores actúan por su cuenta.'},
  inherited_debt: {name: 'Deuda heredada', icon: '💳', good: false, fx: {tax: -0.02, invest: -0.03}, treasury: -7, until: c => c.debt === 0 && c.treasury > 0 && G.date.y >= 1840, desc: 'Las guerras pasadas dejaron las arcas vacías y los acreedores a la puerta.'},
  empire_decline: {name: 'Imperio en declive', icon: '📉', good: false, fx: {stab: -2, tax: -0.04}, until: c => c.legitimacy > 75, desc: 'Las colonias se pierden y la corte vive de recuerdos.'},
  political_instability: {name: 'Inestabilidad crónica', icon: '💣', good: false, fx: {stab: -3, rad: 1.0}, until: c => c.legitimacy >= 70, desc: 'Pronunciamientos, caudillos y constituciones efímeras.'},
  illiteracy: {name: 'Analfabetismo generalizado', icon: '✍️', good: false, fx: {innov: -0.10, lit: -0.02}, until: c => c.lit >= 30, desc: 'La inmensa mayoría de la población no sabe leer.'},
  modernizing_pasha: {name: 'Gobernante modernizador', icon: '🛠️', good: true, fx: {innov: 0.05, army: 0.08, constr: 0.05}, desc: 'Un gobernante enérgico copia las técnicas occidentales.'},
  mountain_fortress: {name: 'Fortaleza montañosa', icon: '⛰️', good: true, fx: {defense: 0.20}, desc: 'Un terreno agreste que ningún ejército ha logrado someter.'},
  holy_war: {name: 'Fervor religioso', icon: '🌙', good: true, fx: {army: 0.10, stab: 2}, desc: 'La fe sostiene la moral de los combatientes.'},
  reform_ambition: {name: 'Ambición reformista', icon: '🧭', good: true, fx: {innov: 0.05, bur: 0.05}, desc: 'Un pequeño reino decidido a ser el motor de la unificación.'},
  rich_lands: {name: 'Tierras fértiles', icon: '🌱', good: true, fx: {agriOut: 0.07}, desc: 'Suelos excepcionalmente ricos.'},
  mineral_wealth: {name: 'Riqueza mineral', icon: '⚒️', good: true, fx: {mineOut: 0.08}, desc: 'Carbón y hierro en abundancia.'},
  small_state: {name: 'Estado pequeño y ágil', icon: '🧩', good: true, fx: {bur: 0.08, army: -0.06}, desc: 'Fácil de administrar, difícil de defender.'},
  colonial_overstretch: {name: 'Sobreextensión imperial', icon: '🌍', good: false, fx: {tax: -0.03, rad: 0.5}, desc: 'Demasiadas colonias para tan pocos funcionarios.'},
  plantation_economy: {name: 'Economía de plantación', icon: '🍬', good: false, fx: {agriOut: 0.04, rad: 1.2, innov: -0.05}, desc: 'Riqueza fácil que frena otras industrias.'}
};
const TRAIT_ASSIGN = {
  GBR: ['industrial_cradle', 'sea_power', 'colonial_wealth', 'colonial_overstretch'], FRA: ['strong_bureau', 'revolutionary_legacy'], PRU: ['disciplined_army', 'educated_people'],
  AUS: ['multinational', 'backward_admin'], RUS: ['vast_lands', 'serf_society', 'backward_admin'], OTT: ['sick_man', 'strategic_position'], USA: ['frontier_land', 'slave_tension', 'rich_lands'],
  SPA: ['inherited_debt', 'empire_decline'], POR: ['inherited_debt', 'merchant_marine'], NET: ['merchant_marine'], BEL: ['early_industry'], SWI: ['armed_neutrality', 'banking_hub'], SWE: ['educated_people'],
  DEN: ['merchant_marine'], JAP: ['isolation', 'samurai_tradition'], CHN: ['demographic_giant', 'closed_society', 'decaying_dynasty'], KOR: ['closed_society'], SIA: ['closed_society'], VIE: ['closed_society', 'samurai_tradition'],
  BRM: ['closed_society'], PRS: ['decaying_dynasty', 'mountain_fortress'], AFG: ['mountain_fortress'], EGY: ['modernizing_pasha'], ETH: ['mountain_fortress', 'illiteracy'], SOK: ['holy_war'], ZUL: ['samurai_tradition'], MOR: ['closed_society'],
  SAR: ['reform_ambition'], TWS: ['backward_admin'], PAP: ['backward_admin'], BAV: ['small_state'], SAX: ['early_industry', 'small_state'], WUR: ['small_state'], BAD: ['small_state'], HAN: ['small_state'], HES: ['small_state'], MEC: ['small_state'],
  MEX: ['political_instability', 'mineral_wealth'], COL: ['political_instability'], VEN: ['political_instability'], ECU: ['political_instability'], PER: ['political_instability', 'mineral_wealth'], BOL: ['political_instability', 'mineral_wealth'],
  CHL: ['mineral_wealth'], ARG: ['rich_lands', 'political_instability'], PAR: ['closed_society'], URU: ['political_instability'], BRZ: ['plantation_economy', 'rich_lands'], CAM: ['political_instability'], TEX: ['frontier_land'],
  HYD: ['decaying_dynasty'], SIK: ['disciplined_army'], NEP: ['mountain_fortress'], GRE: ['merchant_marine'], SER: ['mountain_fortress'], WAL: ['rich_lands'], TUN: ['empire_decline']
};
function assignTraits() {
  G.tags.forEach(t => {
    if (t === NONE) return; const c = G.C[t]; c.traits = (TRAIT_ASSIGN[t] || []).slice();
    if (c.lit < 8 && !c.traits.includes('illiteracy')) c.traits.push('illiteracy');
    c.traits.forEach(id => { const tr = TRAITS[id]; if (tr && tr.treasury) c.treasury = tr.treasury > 0 ? c.treasury * tr.treasury : -c.stats.income * Math.abs(tr.treasury); });
    recalcMods(c);
  });
}
function traitMonth(c) {
  if (!c.traits || !c.traits.length) return;
  const keep = [];
  c.traits.forEach(id => { const tr = TRAITS[id]; if (tr && tr.until && tr.until(c)) { if (!tr.good) cnt(c, 'traitsOvercome'); if (c.tag === G.player) notify('politics', `Has superado el rasgo «${tr.name}».`); } else keep.push(id); });
  if (keep.length !== c.traits.length) { c.traits = keep; recalcMods(c); }
}
const escA = s => String(s).replace(/"/g, '&quot;');
function traitTip(t) { return escA(`<b>${t.name}</b><br>${t.desc}<br>${fxText(t.fx)}${t.treasury ? '<br>' + (t.treasury > 0 ? 'Tesoro inicial mayor' : 'Deuda inicial') : ''}${t.until ? '<br><i>Puede superarse con el tiempo.</i>' : ''}`); }
function traitsHtml(c) {
  if (!c.traits || !c.traits.length) return '<p class="hint">Este país no tiene rasgos especiales.</p>';
  return c.traits.map(id => { const t = TRAITS[id]; return `<div class="trait ${t.good ? 'good' : 'bad'}" data-tip="${traitTip(t)}"><span>${t.icon}</span><div><b>${t.name}</b><small>${t.desc}</small><small>${fxText(t.fx)}</small></div></div>`; }).join('');
}

/* ===== LOGROS ===== */
const ACHIEVEMENTS = [];
function A(id, name, icon, cat, desc, check, tier, prog) { ACHIEVEMENTS.push({id, name, icon, cat, desc, check, tier: tier || 1, prog}); }
const ownsAll = (c, tags) => tags.every(t => G.S.some(s => s.owner === c.tag && MAP.seeds[s.id].owner === t) || false);
const originalOwned = (c, tag) => G.S.filter(s => MAP.seeds[s.id].owner === tag).every(s => s.owner === c.tag);

// Economía
A('ind20', 'Chimeneas en el horizonte', '🏭', 'Economía', 'Alcanza 20 niveles de industria manufacturera.', c => c.stats.indLevels >= 20, 1, c => [c.stats.indLevels, 20]);
A('ind60', 'Taller del mundo', '⚙️', 'Economía', 'Alcanza 60 niveles de industria manufacturera.', c => c.stats.indLevels >= 60, 2, c => [c.stats.indLevels, 60]);
A('ind200', 'Titán industrial', '🏗️', 'Economía', 'Alcanza 200 niveles de industria manufacturera.', c => c.stats.indLevels >= 200, 3, c => [c.stats.indLevels, 200]);
A('steel', 'Era del acero', '🔩', 'Economía', 'Construye tu primera acería.', c => c.states.some(id => (G.S[id].b.steel || 0) >= 1), 1);
A('rail20', 'Red ferroviaria', '🚂', 'Economía', 'Construye 20 niveles de ferrocarril.', c => c.states.reduce((a, id) => a + (G.S[id].b.railway || 0), 0) >= 20, 2, c => [c.states.reduce((a, id) => a + (G.S[id].b.railway || 0), 0), 20]);
A('rich', 'Arcas llenas', '💰', 'Economía', 'Acumula un tesoro de 60 semanas de ingresos.', c => c.treasury >= c.stats.income * 60 && c.stats.income > 0, 2, c => [c.treasury / Math.max(1, c.stats.income), 60]);
A('solvent', 'Cuentas saneadas', '📒', 'Economía', 'Mantén el tesoro positivo hasta 1850.', c => G.date.y >= 1850 && c.treasury > 0 && cntOf(c, 'debtMonths') === 0, 2);
A('sol12', 'Prosperidad', '🍞', 'Economía', 'Alcanza un nivel de vida medio de 12.', c => c.stats.sol >= 12, 2, c => [c.stats.sol, 12]);
A('sol18', 'Sociedad del bienestar', '🏡', 'Economía', 'Alcanza un nivel de vida medio de 18.', c => c.stats.sol >= 18, 3, c => [c.stats.sol, 18]);
A('survive3', 'Superviviente', '🛟', 'Economía', 'Atraviesa 3 crisis económicas.', c => cntOf(c, 'crisesEnded') >= 3, 2, c => [cntOf(c, 'crisesEnded'), 3]);
A('survive8', 'Inmune a las tormentas', '⛈️', 'Economía', 'Atraviesa 8 crisis económicas.', c => cntOf(c, 'crisesEnded') >= 8, 3, c => [cntOf(c, 'crisesEnded'), 8]);
A('pop_up', 'Explosión demográfica', '👶', 'Economía', 'Aumenta tu población un 50%.', c => c.stats.pop >= c.startPop * 1.5, 2, c => [c.stats.pop / c.startPop, 1.5]);
A('pop100', 'Gigante humano', '🌏', 'Economía', 'Supera los 100 millones de habitantes.', c => c.stats.pop >= 1e8, 2, c => [c.stats.pop / 1e6, 100]);
A('granary', 'Granero del mundo', '🌾', 'Economía', 'Construye 120 niveles de granjas.', c => c.states.reduce((a, id) => a + (G.S[id].b.farm || 0), 0) >= 120, 2, c => [c.states.reduce((a, id) => a + (G.S[id].b.farm || 0), 0), 120]);
// Tecnología y sociedad
A('tech1', 'Primer descubrimiento', '💡', 'Tecnología', 'Investiga tu primera tecnología.', c => c.techs.size >= 1, 1);
A('tech10', 'Ilustración', '🔬', 'Tecnología', 'Investiga 10 tecnologías.', c => c.techs.size >= 10, 1, c => [c.techs.size, 10]);
A('tech25', 'Sociedad del conocimiento', '🧪', 'Tecnología', 'Investiga 25 tecnologías.', c => c.techs.size >= 25, 2, c => [c.techs.size, 25]);
A('tech45', 'Vanguardia científica', '🛰️', 'Tecnología', 'Investiga 45 tecnologías.', c => c.techs.size >= 45, 3, c => [c.techs.size, 45]);
A('tech70', 'Enciclopedista', '📜', 'Tecnología', 'Completa todo el árbol tecnológico.', c => c.techs.size >= TECHS.length, 3, c => [c.techs.size, TECHS.length]);
A('era2', 'Nueva era', '🌅', 'Tecnología', 'Abre la Era de la Expansión.', c => eraUnlocked(c, 2), 2);
A('era3', 'Era de las masas', '🏙️', 'Tecnología', 'Abre la Era de las Masas.', c => eraUnlocked(c, 3), 3);
A('doctrine', 'Doctrinario', '⚖️', 'Tecnología', 'Adopta una doctrina política y una militar.', c => TECHS.some(t => t.ex === 'doc_pol' && c.techs.has(t.id)) && TECHS.some(t => t.ex === 'doc_mil' && c.techs.has(t.id)), 2);
A('lit50', 'Escuela para todos', '📖', 'Tecnología', 'Alcanza un 50% de alfabetización.', c => c.lit >= 50, 1, c => [c.lit, 50]);
A('lit80', 'Nación letrada', '🎓', 'Tecnología', 'Alcanza un 80% de alfabetización.', c => c.lit >= 80, 2, c => [c.lit, 80]);
A('lit95', 'Cultura universal', '🏛️', 'Tecnología', 'Alcanza un 95% de alfabetización.', c => c.lit >= 95, 3, c => [c.lit, 95]);
// Política
A('reform1', 'Primera reforma', '📝', 'Política', 'Aprueba una reforma.', c => cntOf(c, 'reforms') >= 1, 1);
A('reform6', 'Gran reformista', '📚', 'Política', 'Aprueba 6 reformas.', c => cntOf(c, 'reforms') >= 6, 2, c => [cntOf(c, 'reforms'), 6]);
A('suffrage', 'Voz del pueblo', '🗳️', 'Política', 'Instaura el sufragio universal.', c => c.laws.power === 'universal', 2);
A('noserf', 'Libertad de la tierra', '🕊️', 'Política', 'Abole la servidumbre y la esclavitud con una reforma.', c => c.laws.agrarian !== 'serfdom' && c.laws.bonded === 'slavery_banned' && cntOf(c, 'reforms') >= 1, 2);
A('legit90', 'Gobierno amado', '❤️', 'Política', 'Alcanza una legitimidad del 90%.', c => c.legitimacy >= 90, 2, c => [c.legitimacy, 90]);
A('govchange', 'Nuevo orden', '🏛️', 'Política', 'Cambia de régimen político.', c => cntOf(c, 'govChanges') >= 1, 2);
A('revolution', 'Revolucionario', '🔥', 'Política', 'Haz triunfar una revolución.', c => cntOf(c, 'revolutions') >= 1, 3);
A('events10', 'Hombre de Estado', '📰', 'Política', 'Resuelve 10 eventos.', c => cntOf(c, 'events') >= 10, 1, c => [cntOf(c, 'events'), 10]);
A('events30', 'Veterano de mil crisis', '🎭', 'Política', 'Resuelve 30 eventos.', c => cntOf(c, 'events') >= 30, 2, c => [cntOf(c, 'events'), 30]);
A('trait_over', 'Superación', '🦋', 'Política', 'Supera un rasgo nacional negativo.', c => cntOf(c, 'traitsOvercome') >= 1, 2);
// Diplomacia
A('pact1', 'Primer tratado', '🤝', 'Diplomacia', 'Firma un acuerdo con otro país.', c => cntOf(c, 'pactsMade') >= 1, 1);
A('allies4', 'Red de alianzas', '🕸️', 'Diplomacia', 'Ten 4 aliados a la vez.', c => allies(c.tag).length >= 4, 2, c => [allies(c.tag).length, 4]);
A('bloc', 'Fundador', '🏳️', 'Diplomacia', 'Funda un bloque.', c => !!c.bloc && blocOf(c.tag) && blocOf(c.tag).leader === c.tag, 2);
A('bloc6', 'Hegemón de bloque', '👑', 'Diplomacia', 'Lidera un bloque con 6 miembros.', c => { const b = blocOf(c.tag); return b && b.leader === c.tag && b.members.length >= 6; }, 3, c => [blocOf(c.tag) ? blocOf(c.tag).members.length : 0, 6]);
A('vassal1', 'Señor feudal', '🏰', 'Diplomacia', 'Consigue un vasallo.', c => (c.subjects || []).length >= 1, 2);
A('vassal3', 'Imperio de vasallos', '🌐', 'Diplomacia', 'Ten 3 vasallos a la vez.', c => (c.subjects || []).length >= 3, 3);
A('friends', 'Amigo de todos', '😊', 'Diplomacia', 'Alcanza relación +50 con 8 países.', c => Object.values(c.relations).filter(v => v >= 50).length >= 8, 3, c => [Object.values(c.relations).filter(v => v >= 50).length, 8]);
A('peace20', 'Pax', '🕊️', 'Diplomacia', 'Pasa 20 años sin guerras tras 1836.', c => cntOf(c, 'peaceMonths') >= 240, 3, c => [cntOf(c, 'peaceMonths') / 12, 20]);
// Guerra y expansión
A('win1', 'Primera victoria', '⚔️', 'Guerra', 'Gana una guerra.', c => cntOf(c, 'warsWon') >= 1, 1);
A('win5', 'Mariscal de campo', '🎖️', 'Guerra', 'Gana 5 guerras.', c => cntOf(c, 'warsWon') >= 5, 2, c => [cntOf(c, 'warsWon'), 5]);
A('gain5', 'Conquistador', '🏴', 'Guerra', 'Anexiona 5 estados mediante guerras.', c => cntOf(c, 'statesGained') >= 5, 2, c => [cntOf(c, 'statesGained'), 5]);
A('defend', 'Muro inexpugnable', '🛡️', 'Guerra', 'Repele una invasión.', c => cntOf(c, 'defended') >= 1, 2);
A('humil', 'Soberbia', '😤', 'Guerra', 'Humilla a otra potencia.', c => cntOf(c, 'humiliations') >= 1, 2);
A('colony1', 'Primer asentamiento', '⚓', 'Guerra', 'Coloniza tu primer territorio.', c => cntOf(c, 'colonies') >= 1, 1);
A('colony8', 'Imperio colonial', '🌍', 'Guerra', 'Coloniza 8 territorios.', c => cntOf(c, 'colonies') >= 8, 3, c => [cntOf(c, 'colonies'), 8]);
A('german', 'Unificación alemana', '🦅', 'Guerra', 'Con Prusia, controla todos los estados alemanes.', c => c.tag === 'PRU' && ['BAV', 'SAX', 'HAN', 'WUR', 'BAD', 'HES', 'MEC'].every(t => originalOwned(c, t)), 3);
A('italian', 'Il Risorgimento', '🇮🇹', 'Guerra', 'Con Cerdeña-Piamonte, controla Dos Sicilias, Toscana y los Estados Pontificios.', c => c.tag === 'SAR' && ['TWS', 'PAP', 'TUS'].every(t => originalOwned(c, t)), 3);
// Prestigio y rango
A('rank8', 'Gran potencia', '🌟', 'Prestigio', 'Entra entre las 8 primeras potencias.', c => c.rank <= 8, 2);
A('rank1', 'Primera potencia', '🥇', 'Prestigio', 'Sé la primera potencia del mundo.', c => c.rank === 1, 3);
A('pres200', 'Prestigio inmenso', '🏆', 'Prestigio', 'Alcanza 200 de prestigio.', c => c.prestige >= 200, 3, c => [c.prestige, 200]);
A('rise', 'Ascenso meteórico', '📈', 'Prestigio', 'Mejora 10 puestos en el ranking.', c => c.start && (c.start.rank || 99) - c.rank >= 10, 3);
A('journal6', 'Diario completo', '📜', 'Prestigio', 'Completa todos los objetivos del diario.', c => JOURNAL.every(j => c.journalDone[j.id]), 3);
A('hard', 'Contra viento y marea', '🌪️', 'Prestigio', 'Llega a 1870 en dificultad Difícil o superior.', c => G.date.y >= 1870 && G.diff >= 3, 3);

const ACH_KEY = 'victoria-replica-ach';
function globalAch() { try { return new Set(JSON.parse(localStorage.getItem(ACH_KEY) || '[]')); } catch (e) { return new Set(); } }
function saveGlobalAch(set) { try { localStorage.setItem(ACH_KEY, JSON.stringify([...set])); } catch (e) {} }
function achSnapshot(c) { c.preAch = {}; ACHIEVEMENTS.forEach(a => { try { if (a.check(c)) c.preAch[a.id] = 1; } catch (e) {} }); }
function achMonth(c) {
  c.ach = c.ach || {}; c.cnt = c.cnt || {};
  if (c.treasury < 0) cnt(c, 'debtMonths');
  if (c.wars.length) c.cnt.peaceMonths = 0; else cnt(c, 'peaceMonths');
  const gl = globalAch(); let changed = false;
  ACHIEVEMENTS.forEach(a => {
    if (c.ach[a.id] || (c.preAch && c.preAch[a.id])) return;
    let ok = false; try { ok = a.check(c); } catch (e) { ok = false; }
    if (!ok) return;
    c.ach[a.id] = {y: G.date.y, m: G.date.m};
    const rp = 4 * a.tier, ri = 40 * a.tier * a.tier;
    c.prestige += rp; c.innovStock += ri;
    notify('journal', `🏅 Logro desbloqueado: ${a.name} (+${rp} prestigio, +${ri} innovación).`);
    if (!gl.has(a.id)) { gl.add(a.id); changed = true; }
  });
  if (changed) saveGlobalAch(gl);
}

WINDOWS.achievements = {title: 'Logros', icon: '🏅', render() {
  const c = me(); c.ach = c.ach || {};
  const gl = globalAch(); const done = ACHIEVEMENTS.filter(a => c.ach[a.id]).length;
  const cats = []; ACHIEVEMENTS.forEach(a => { if (!cats.includes(a.cat)) cats.push(a.cat); });
  return `<div class="card"><div class="kv"><span>Logros de esta partida</span><b>${done} / ${ACHIEVEMENTS.length}</b></div>${bar(done, ACHIEVEMENTS.length, 'gold')}<div class="kv"><span>Desbloqueados en alguna partida</span><b>${gl.size} / ${ACHIEVEMENTS.length}</b></div>
  <p class="hint">Cada logro da prestigio e innovación (más cuanto mayor es su categoría ★). Se comprueban cada mes.</p></div>
  ${cats.map(cat => `<h4 class="sub">${cat}</h4><div class="achgrid">${ACHIEVEMENTS.filter(a => a.cat === cat).map(a => {
    const got = c.ach[a.id]; const pre = !got && c.preAch && c.preAch[a.id]; let p = ''; if (!got && a.prog) { try { const [v, g] = a.prog(c); p = `<div class="achp">${bar(Math.max(0, Math.min(v, g)), g, 'gold')}</div>`; } catch (e) {} }
    return `<div class="ach ${got ? 'got' : ''} ${pre ? 'pre' : ''} t${a.tier}"><span class="achi">${got ? a.icon : pre ? '➖' : '🔒'}</span><div><b>${a.name}</b> <span class="stars">${'★'.repeat(a.tier)}</span><small>${a.desc}</small>${got ? `<small class="good">Desbloqueado en ${MONTHS[got.m]} de ${got.y}</small>` : pre ? '<small class="dim">Ya se cumplía al inicio de la partida: no puede obtenerse.</small>' : p}</div></div>`;
  }).join('')}</div>`).join('')}`;
}};
