/* ===== ÁRBOL NACIONAL: decisiones propias de cada país ===== */
// nodo: [id, nombre, icono, rama, nivel, días, requisitos, excluyentes, descripción, efectos]
const NAT_BRANCHES = {
  PRU: ['Unificación pequeñoalemana', 'Federación con Austria', 'Militarismo prusiano', 'Reformas liberales de 1848'],
  GBR: ['Taller del mundo', 'Imperio en la India', 'Reforma electoral', 'Espléndido aislamiento'],
  FRA: ['Monarquía de Julio', 'Segundo Imperio', 'República social', 'Expansión en África'],
  RUS: ['Abolición de la servidumbre', 'Gran Juego en Asia', 'Paneslavismo', 'Autocracia reforzada'],
  OTT: ['Tanzimat', 'Panislamismo', 'Alianza con las potencias', 'Federalismo balcánico'],
  SPA: ['Guerras carlistas: carlistas', 'Guerras carlistas: liberales', 'Recuperar las Américas', 'Modernización e Iberismo'],
  USA: ['Destino manifiesto', 'Compromiso', 'Abolición y Reconstrucción', 'Doctrina Monroe'],
  JAP: ['Mantener el sakoku', 'Restauración Meiji', 'Militarismo', 'Apertura comercial'],
  GEN: ['Industrializar', 'Reformar el Estado', 'Armarse', 'Expandirse']
};
const NAT_RAW = {
  PRU: [
    ['zollverein', 'Zollverein', '🛤️', 0, 0, 70, [], [], 'Unión aduanera alemana: más comercio e ingresos.', [['mod', 'tax', .05], ['mod', 'invest', .04], ['tech', 'railways']]],
    ['kleindeutsch', 'Solución pequeñoalemana', '🦅', 0, 1, 100, ['zollverein'], ['grossdeutsch'], 'Unificar Alemania bajo Prusia y sin Austria.', [['claim', 'Sajonia'], ['claim', 'Hannover'], ['claim', 'Hesse'], ['claim', 'Baden'], ['mod', 'army', .03], ['prestige', 15]]],
    ['northgerman', 'Confederación de la Alemania del Norte', '🏰', 0, 2, 120, ['kleindeutsch'], [], 'Reclamas el norte y el sur de Alemania.', [['claim', 'Holstein'], ['claim', 'Mecklemburgo'], ['claim', 'Baviera'], ['claim', 'Wurtemberg'], ['prestige', 25], ['divs', 3]]],
    ['grossdeutsch', 'Solución grande-alemana', '🤝', 1, 1, 100, ['zollverein'], ['kleindeutsch'], 'Federación con Austria: relaciones y estabilidad.', [['rel', 'AUS', 50], ['mod', 'stab', 2], ['mod', 'crisis', .05], ['legit', 5]]],
    ['dualism', 'Dualismo austro-prusiano', '⚖️', 1, 2, 110, ['grossdeutsch'], [], 'Cooperación económica con los Habsburgo.', [['mod', 'tax', .04], ['mod', 'invest', .05], ['infl', 60]]],
    ['staff', 'Estado Mayor de Moltke', '🎖️', 2, 0, 70, [], [], 'Profesionalizas el mando del ejército.', [['mod', 'army', .05], ['gen', 3], ['tech', 'general_staff']]],
    ['conscription', 'Servicio militar universal', '🪖', 2, 1, 100, ['staff'], [], 'La gran reforma militar prusiana.', [['law', 'army', 'conscription'], ['divs', 3], ['mod', 'milCost', -.05]]],
    ['ironblood', 'Hierro y sangre', '🔥', 2, 2, 130, ['conscription'], ['constitution'], 'Militarismo extremo: poder militar a costa de la libertad.', [['mod', 'defense', .1], ['mod', 'army', .06], ['mod', 'rad', .05], ['ig', 'armed', 1.3]]],
    ['frankfurt', 'Parlamento de Fráncfort', '📜', 3, 0, 80, [], [], 'Las aperturas liberales de 1848.', [['law', 'press', 'limited_press'], ['ig', 'intel', 1.2], ['legit', 4]]],
    ['constitution', 'Constitución prusiana', '🏛️', 3, 1, 110, ['frankfurt'], ['ironblood'], 'Monarquía constitucional con voto censitario.', [['law', 'power', 'wealth_voting'], ['legit', 8], ['mod', 'invest', .05]]],
    ['socialpol', 'Política social de Bismarck', '🏥', 3, 2, 120, ['constitution'], [], 'Seguridad social y educación pública.', [['mod', 'lit', .3], ['mod', 'stab', 2], ['law', 'education', 'public_edu']]]
  ],
  GBR: [
    ['workshop', 'Taller del mundo', '🏭', 0, 0, 70, [], [], 'La industria británica abastece al planeta.', [['mod', 'indOut', .06], ['mod', 'invest', .05], ['tech', 'steam_engine']]],
    ['freetrade', 'Libre comercio', '🚢', 0, 1, 100, ['workshop'], [], 'Derogas las leyes de granos y abres los mercados.', [['law', 'economy', 'laissez'], ['mod', 'tax', .04], ['mod', 'invest', .05]]],
    ['crystal', 'Gran Exposición', '💎', 0, 2, 110, ['freetrade'], [], 'El Palacio de Cristal exhibe el poder industrial.', [['prestige', 30], ['mod', 'innov', .08]]],
    ['raj', 'Compañía y Raj', '🐘', 1, 0, 80, [], [], 'Consolidas el dominio de la India.', [['mod', 'tax', .05], ['mod', 'army', .03], ['build', 'Bengala', 'barracks', 1]]],
    ['greatgame', 'El Gran Juego', '♟️', 1, 1, 100, ['raj'], ['isolation'], 'Contienes la expansión rusa en Asia.', [['rel', 'RUS', -30], ['divs', 3], ['prestige', 15], ['mod', 'logistics', .05]]],
    ['empire', 'El sol nunca se pone', '👑', 1, 2, 130, ['greatgame'], [], 'Cúspide del imperio colonial.', [['prestige', 35], ['mod', 'tax', .06], ['mod', 'army', .04]]],
    ['reformact', 'Ley de Reforma', '🗳️', 2, 0, 80, [], [], 'Se amplía el derecho al voto.', [['law', 'power', 'wealth_voting'], ['legit', 5], ['ig', 'petty', 1.25]]],
    ['chartism', 'Cartismo y fábricas', '✊', 2, 1, 100, ['reformact'], [], 'Respondes a las demandas obreras.', [['law', 'labor', 'inspections'], ['mod', 'rad', -.1], ['mod', 'lit', .2]]],
    ['suffrage2', 'Camino al sufragio universal', '🗳️', 2, 2, 120, ['chartism'], [], 'Un voto por cada ciudadano.', [['law', 'power', 'universal'], ['legit', 6]]],
    ['isolation', 'Espléndido aislamiento', '🏝️', 3, 1, 100, ['workshop'], ['greatgame'], 'Evitas compromisos continentales.', [['mod', 'defense', .08], ['mod', 'crisis', .06], ['infl', 80]]]
  ],
  FRA: [
    ['julymon', 'Monarquía de Julio', '👑', 0, 0, 80, [], [], 'El reino de la burguesía.', [['law', 'power', 'wealth_voting'], ['ig', 'indus', 1.25], ['mod', 'invest', .05]]],
    ['citizen', 'El Rey Ciudadano', '🎩', 0, 1, 100, ['julymon'], [], 'Enriqueceos: crecimiento y bolsa.', [['mod', 'invest', .06], ['mod', 'tax', .04], ['prestige', 8]]],
    ['empire2', 'Segundo Imperio', '🦅', 1, 1, 110, ['julymon'], ['republic2'], 'Napoleón III restaura el imperio.', [['law', 'power', 'oligarchy'], ['mod', 'army', .05], ['mod', 'indOut', .05], ['prestige', 20]]],
    ['haussmann', 'Reformas de Haussmann', '🏙️', 1, 2, 110, ['empire2'], [], 'París se reconstruye y el país se llena de ferrocarriles.', [['build', 'Isla de Francia', 'railway', 2], ['mod', 'infra', .1], ['mod', 'constr', .08]]],
    ['paris', 'Revolución de 1848', '🚩', 2, 0, 80, [], [], 'Las barricadas cambian el rumbo.', [['rad', .03], ['ig', 'union', 1.3]]],
    ['republic2', 'República social', '🇫🇷', 2, 1, 110, ['paris'], ['empire2'], 'Una república con derechos sociales.', [['law', 'power', 'universal'], ['law', 'labor', 'inspections'], ['legit', 6]]],
    ['progtax', 'Fiscalidad progresiva', '💶', 2, 2, 120, ['republic2'], [], 'Los ricos pagan más.', [['law', 'tax', 'graduated'], ['mod', 'tax', .06]]],
    ['algeria', 'Conquista de Argelia', '🐪', 3, 0, 80, [], [], 'La expansión en el Magreb.', [['divs', 3], ['claim', 'Libia'], ['prestige', 10], ['build', 'Argelia', 'barracks', 1]]],
    ['africa', 'Imperio africano', '🌍', 3, 1, 110, ['algeria'], [], 'Una Francia de ultramar.', [['mod', 'tax', .05], ['mod', 'logistics', .06], ['prestige', 20]]]
  ],
  RUS: [
    ['emancip', 'Emancipación de los siervos', '⛓️', 0, 0, 90, [], ['autocracy2'], 'Acabas con la servidumbre.', [['law', 'agrarian', 'tenant'], ['mod', 'grow', .0005], ['mod', 'rad', -.05], ['ig', 'rural', 1.25]]],
    ['zemstvo', 'Zemstvos y reforma judicial', '⚖️', 0, 1, 110, ['emancip'], [], 'Administración local y justicia moderna.', [['mod', 'bur', .08], ['mod', 'lit', .2], ['law', 'education', 'elite_edu']]],
    ['transsib', 'Ferrocarril transiberiano', '🚂', 0, 2, 130, ['zemstvo'], [], 'Unes el imperio de oeste a este.', [['build', 'Moscú', 'railway', 2], ['build', 'Siberia Occidental', 'railway', 1], ['mod', 'infra', .1], ['mod', 'logistics', .08]]],
    ['greatgame2', 'Gran Juego en Asia', '♟️', 1, 0, 90, [], [], 'Avanzas hacia Asia Central.', [['claim', 'Georgia'], ['divs', 3], ['rel', 'GBR', -30], ['mod', 'army', .03]]],
    ['caucasus', 'Conquista del Cáucaso', '🏔️', 1, 1, 110, ['greatgame2'], [], 'Pacificas las montañas.', [['claim', 'Cáucaso Norte'], ['prestige', 20], ['mod', 'tax', .03]]],
    ['panslav', 'Paneslavismo', '🛡️', 2, 0, 90, [], [], 'Protector de los eslavos.', [['claim', 'Bosnia'], ['claim', 'Bulgaria'], ['claim', 'Galitzia'], ['prestige', 15]]],
    ['balkans', 'Protector de los Balcanes', '⚔️', 2, 1, 110, ['panslav'], [], 'Presión sobre Estambul.', [['claim', 'Macedonia'], ['claim', 'Serbia'], ['divs', 4], ['mod', 'army', .04]]],
    ['autocracy2', 'Autocracia, ortodoxia y nacionalidad', '🦅', 3, 0, 90, [], ['emancip'], 'El lema del zar Nicolás.', [['law', 'power', 'autocracy'], ['law', 'press', 'censorship'], ['legit', 8], ['ig', 'devout', 1.3]]],
    ['okhrana', 'Policía secreta', '🕵️', 3, 1, 110, ['autocracy2'], [], 'Vigilancia de la sociedad.', [['mod', 'stab', 4], ['mod', 'rad', -.15], ['mod', 'lit', -.1]]]
  ],
  OTT: [
    ['tanzimat', 'Tanzimat', '📜', 0, 0, 90, [], ['islamism'], 'Reformas de modernización.', [['law', 'religion', 'tolerance'], ['law', 'army', 'professional'], ['mod', 'bur', .1], ['mod', 'tax', .05]]],
    ['reorgan', 'Reorganización militar', '🪖', 0, 1, 110, ['tanzimat'], [], 'Un ejército moderno.', [['divs', 4], ['mod', 'army', .05], ['tech', 'military_academy']]],
    ['constit', 'Constitución de 1876', '🏛️', 0, 2, 130, ['reorgan'], [], 'Primer parlamento otomano.', [['law', 'power', 'landed_voting'], ['legit', 8]]],
    ['islamism', 'Panislamismo', '☪️', 1, 0, 90, [], ['tanzimat'], 'El sultán como califa de todos los creyentes.', [['law', 'religion', 'state_religion'], ['ig', 'devout', 1.35], ['legit', 6], ['claim', 'Libia']]],
    ['caliph', 'Califato', '🕌', 1, 1, 110, ['islamism'], [], 'Prestigio religioso.', [['prestige', 20], ['mod', 'stab', 3], ['mod', 'rad', -.1]]],
    ['powers', 'Alianza con las potencias', '🤝', 2, 0, 90, [], [], 'Buscas el apoyo de Londres y París.', [['rel', 'GBR', 40], ['rel', 'FRA', 30], ['mod', 'invest', .05], ['money', 6]]],
    ['concess', 'Ferrocarriles y concesiones', '🚂', 2, 1, 110, ['powers'], [], 'Capital extranjero para infraestructuras.', [['build', 'Constantinopla', 'railway', 2], ['build', 'Anatolia Occidental', 'railway', 1], ['mod', 'infra', .08]]],
    ['millet', 'Sistema de millets reformado', '🕊️', 3, 0, 90, [], [], 'Igualdad entre comunidades.', [['mod', 'stab', 2], ['mod', 'rad', -.05]]],
    ['balkan', 'Federalismo balcánico', '🗺️', 3, 1, 110, ['millet'], [], 'Autonomía para los Balcanes.', [['mod', 'stab', 3], ['mod', 'rad', -.1], ['legit', 5]]]
  ],
  SPA: [
    ['carlist', 'Victoria carlista', '⛪', 0, 0, 90, [], ['liberal_win'], 'El pretendiente Carlos triunfa.', [['law', 'religion', 'state_religion'], ['ig', 'devout', 1.35], ['ig', 'lands', 1.2], ['legit', 4]]],
    ['catholic', 'Estado católico', '✝️', 0, 1, 110, ['carlist'], [], 'La Iglesia recupera sus privilegios.', [['mod', 'stab', 3], ['mod', 'lit', -.1], ['mod', 'rad', -.05]]],
    ['liberal_win', 'Victoria liberal', '🗳️', 1, 0, 90, [], ['carlist'], 'Isabel II con los liberales.', [['law', 'power', 'landed_voting'], ['legit', 5], ['ig', 'petty', 1.2]]],
    ['const37', 'Constitución de 1837', '📜', 1, 1, 110, ['liberal_win'], [], 'Monarquía constitucional y desamortización.', [['law', 'agrarian', 'commercial'], ['mod', 'invest', .05], ['mod', 'tax', .04]]],
    ['americas', 'Recuperar las Américas', '🌎', 2, 0, 100, [], [], 'Sueños de reconquista ultramarina.', [['claim', 'Perú'], ['mod', 'army', .03], ['divs', 3]]],
    ['modern', 'Modernización ferroviaria', '🚂', 3, 0, 100, [], [], 'La red de ferrocarril peninsular.', [['build', 'Madrid', 'railway', 2], ['mod', 'infra', .08], ['mod', 'invest', .04], ['tech', 'railways']]],
    ['iberism', 'Iberismo', '🦁', 3, 1, 120, ['modern'], [], 'Una península unida.', [['mod', 'tax', .05], ['prestige', 20], ['mod', 'innov', .05]]]
  ],
  USA: [
    ['manifest', 'Destino manifiesto', '🦅', 0, 0, 90, [], [], 'Hacia el Pacífico.', [['mod', 'grow', .0008], ['claim', 'Texas'], ['claim', 'California'], ['prestige', 10]]],
    ['homestead', 'Ley de Homestead', '🏡', 0, 1, 110, ['manifest'], [], 'Tierras para los colonos.', [['mod', 'agriOut', .08], ['mod', 'grow', .0008], ['law', 'agrarian', 'commercial']]],
    ['transcont', 'Ferrocarril transcontinental', '🚂', 0, 2, 130, ['homestead'], [], 'De costa a costa.', [['build', 'Illinois y Misuri', 'railway', 2], ['mod', 'infra', .1], ['mod', 'logistics', .06]]],
    ['compromise', 'El compromiso', '🤝', 1, 0, 90, [], ['abolition2'], 'Se mantiene el equilibrio entre Norte y Sur.', [['mod', 'stab', 3], ['ig', 'lands', 1.25], ['mod', 'crisis', .05]]],
    ['abolition2', 'Abolición', '⛓️', 2, 0, 90, [], ['compromise'], 'Fin de la esclavitud.', [['law', 'bonded', 'slavery_banned'], ['ig', 'intel', 1.25], ['rad', .03]]],
    ['reconstr', 'Reconstrucción', '🏗️', 2, 1, 120, ['abolition2'], [], 'Se reconstruye y educa al Sur.', [['mod', 'lit', .2], ['mod', 'stab', 2], ['law', 'education', 'public_edu']]],
    ['monroe', 'Doctrina Monroe', '🛡️', 3, 0, 90, [], [], 'América para los americanos.', [['mod', 'defense', .06], ['prestige', 15], ['infl', 60]]],
    ['bigstick', 'El gran garrote', '🌴', 3, 1, 110, ['monroe'], [], 'Diplomacia de cañoneras.', [['divs', 3], ['prestige', 20], ['mod', 'army', .04]]]
  ],
  JAP: [
    ['sakoku', 'Mantener el sakoku', '🚪', 0, 0, 90, [], ['meiji', 'opening'], 'Japón se mantiene cerrado.', [['law', 'migration', 'closed_borders'], ['mod', 'stab', 4], ['mod', 'crisis', .08], ['mod', 'innov', -.05]]],
    ['meiji', 'Restauración Meiji', '🌸', 1, 0, 100, [], ['sakoku'], 'El emperador recupera el poder y el país se moderniza.', [['mod', 'innov', .12], ['mod', 'bur', .1], ['mod', 'lit', .3], ['tech', 'telegraph']]],
    ['bunmei', 'Civilización y progreso', '🏭', 1, 1, 120, ['meiji'], [], 'Industrialización acelerada.', [['mod', 'indOut', .08], ['mod', 'invest', .06], ['build', 'Kanto', 'railway', 2]]],
    ['meijiarmy', 'Ejército imperial', '⚔️', 2, 1, 110, ['meiji'], [], 'Conscripción y flota moderna.', [['law', 'army', 'conscription'], ['divs', 4], ['mod', 'army', .06]]],
    ['ultranat', 'Militarismo ultranacionalista', '🔥', 2, 2, 130, ['meijiarmy'], [], 'La expansión por Asia.', [['claim', 'Liaoning'], ['claim', 'Taiwán'], ['mod', 'army', .05], ['prestige', 25]]],
    ['opening', 'Apertura comercial', '⛵', 3, 0, 90, [], ['sakoku'], 'Comerciar con Occidente.', [['mod', 'tax', .05], ['mod', 'invest', .06], ['law', 'migration', 'controlled'], ['tech', 'steamships']]]
  ],
  GEN: [
    ['g_ind1', 'Fomento industrial', '🏭', 0, 0, 80, [], [], 'Ayudas a la industria nacional.', [['mod', 'indOut', .05], ['mod', 'invest', .04]]],
    ['g_ind2', 'Infraestructuras', '🚂', 0, 1, 110, ['g_ind1'], [], 'Ferrocarriles y puertos.', [['mod', 'infra', .08], ['mod', 'constr', .06], ['tech', 'railways']]],
    ['g_ref1', 'Reforma administrativa', '📜', 1, 0, 80, [], [], 'Una burocracia eficaz.', [['mod', 'bur', .1], ['mod', 'tax', .05]]],
    ['g_ref2', 'Educación pública', '🎓', 1, 1, 110, ['g_ref1'], [], 'Escuelas para todos.', [['mod', 'lit', .3], ['law', 'education', 'public_edu']]],
    ['g_arm1', 'Reorganización militar', '🪖', 2, 0, 80, [], [], 'Modernizas las fuerzas armadas.', [['mod', 'army', .04], ['divs', 2], ['gen', 2]]],
    ['g_arm2', 'Industria de guerra', '🔫', 2, 1, 110, ['g_arm1'], [], 'Armas propias.', [['mod', 'defense', .07], ['mod', 'milCost', -.06]]],
    ['g_exp1', 'Política exterior activa', '🌍', 3, 0, 80, [], [], 'Más peso en el mundo.', [['infl', 60], ['prestige', 12]]],
    ['g_exp2', 'Ambición imperial', '👑', 3, 1, 110, ['g_exp1'], [], 'Sueños de grandeza.', [['mod', 'tax', .04], ['prestige', 18], ['divs', 2]]]
  ]
};
const NAT = {};      // árboles ya convertidos
Object.keys(NAT_RAW).forEach(k => { NAT[k] = NAT_RAW[k].map(n => ({id: n[0], name: n[1], icon: n[2], b: n[3], t: n[4], days: n[5], req: n[6], excl: n[7], desc: n[8], fx: n[9]})); });
const natTree = c => NAT[c.tag] || NAT.GEN;
const natBranches = c => NAT_BRANCHES[c.tag] || NAT_BRANCHES.GEN;
const natNode = (c, id) => natTree(c).find(n => n.id === id);
function natState(c, n) {
  c.nat = c.nat || {done: [], cur: null};
  if (c.nat.done.includes(n.id)) return {k: 'done'};
  if (c.nat.cur && c.nat.cur.id === n.id) return {k: 'cur'};
  const ex = n.excl.find(x => c.nat.done.includes(x) || (c.nat.cur && c.nat.cur.id === x)); if (ex) return {k: 'blocked', why: 'Excluyente con «' + natNode(c, ex).name + '».'};
  const miss = n.req.find(r => !c.nat.done.includes(r)); if (miss) return {k: 'locked', why: 'Requiere «' + natNode(c, miss).name + '».'};
  return {k: 'avail'};
}
const stateByName = name => G.S.find(s => s.name === name);
function applyNatFx(c, fx) {
  const txt = [];
  fx.forEach(e => {
    const [k, a, b] = e;
    if (k === 'mod') { c.natMods = c.natMods || {}; c.natMods[a] = (c.natMods[a] || 0) + b; }
    else if (k === 'law') { if (LAW[b]) { c.laws[a] = b; } }
    else if (k === 'tech') { if (TECH[a] && !c.techs.has(a)) c.techs.add(a); }
    else if (k === 'claim') { const s = stateByName(a); if (s && s.owner !== c.tag && !c.claims.some(x => x.state === s.id)) c.claims.push({state: s.id, perm: true}); }
    else if (k === 'build') { const s = a === 'cap' ? G.S[c.capital] : stateByName(a); if (s && s.owner === c.tag) s.b[b] = (s.b[b] || 0) + e[3]; }
    else if (k === 'divs') { if (c.states.length && c.capital >= 0) { const divs = []; for (let i = 0; i < a; i++) divs.push(mkDivision(i % 4 === 3 ? 'art' : 'inf', 0.5)); mkArmy(c.tag, stateCapitalProv(c.capital), divs); } }
    else if (k === 'gen') { genPool(c).push(newGeneral(a)); }
    else if (k === 'prestige') c.prestige += a;
    else if (k === 'infl') c.influence += a;
    else if (k === 'legit') c.legitimacy = clamp(c.legitimacy + a, 0, 100);
    else if (k === 'rad') c.radicals = clamp(c.radicals + a, 0, 0.9);
    else if (k === 'money') c.treasury += c.stats.income * a;
    else if (k === 'rel') { if (G.C[a] && alive(a)) addRel(c.tag, a, b); }
    else if (k === 'ig') { c.boosts.push({kind: 'ig', key: a, mult: b, months: 60, mode: 'boost'}); }
  });
  recalcMods(c);
  return txt;
}
function natFxText(fx) {
  const M = {tax: 'Impuestos', bur: 'Burocracia', invest: 'Inversión', lit: 'Alfabetización', grow: 'Crecimiento', army: 'Ejército', rad: 'Radicalismo', stab: 'Estabilidad', indOut: 'Industria', infra: 'Infraestructura', constr: 'Construcción', innov: 'Innovación', milCost: 'Coste militar', defense: 'Defensa', logistics: 'Logística', crisis: 'Resistencia a crisis', agriOut: 'Agricultura'};
  return fx.map(([k, a, b, e]) => {
    if (k === 'mod' && a === 'stab') return `Estabilidad ${b > 0 ? '+' : ''}${b}`;
    if (k === 'mod') return `${M[a] || a} ${b > 0 ? '+' : ''}${Math.abs(b) < 0.01 && Math.abs(b) > 0 ? (b * 1000).toFixed(1) + '‰' : Math.round(b * 100) + '%'}`;
    if (k === 'law') return `Ley: ${LAW[b] ? LAW[b].name : b}`; if (k === 'tech') return `Tecnología: ${TECH[a] ? TECH[a].name : a}`;
    if (k === 'claim') return `Reclamación: ${a}`; if (k === 'build') return `${a}: +${e} ${b}`; if (k === 'divs') return `+${a} divisiones`; if (k === 'gen') return 'Un general';
    if (k === 'prestige') return `+${a} prestigio`; if (k === 'infl') return `+${a} influencia`; if (k === 'legit') return `${a > 0 ? '+' : ''}${a} legitimidad`; if (k === 'rad') return `Radicales ${a > 0 ? '+' : ''}${Math.round(a * 100)}%`;
    if (k === 'money') return `+${a} sem. de ingresos`; if (k === 'rel') return `Relaciones con ${G.C[a] ? G.C[a].name : a} ${b > 0 ? '+' : ''}${b}`; if (k === 'ig') return `${IGS[a].name} ×${b}`;
    return k;
  }).join(' · ');
}
function natStart(c, id) {
  c.nat = c.nat || {done: [], cur: null};
  const n = natNode(c, id); if (!n) return {ok: false, msg: 'Decisión desconocida.'};
  const st = natState(c, n); if (st.k !== 'avail') return {ok: false, msg: st.why || 'No disponible.'};
  if (c.nat.cur) return {ok: false, msg: 'Ya hay una decisión en curso.'};
  c.nat.cur = {id, left: Math.round(n.days * (1 + (G.diff >= 3 ? 0.15 : 0)) * (c.ai ? 1.8 : 1)), total: n.days};
  return {ok: true, msg: `Comienza la decisión «${n.name}» (${Math.round(c.nat.cur.left / 7)} semanas).`};
}
function natDay() {
  G.tags.forEach(t => {
    if (t === NONE) return; const c = G.C[t]; if (!c.states.length) return;
    c.nat = c.nat || {done: [], cur: null};
    if (c.nat.cur) {
      if (--c.nat.cur.left <= 0) {
        const n = natNode(c, c.nat.cur.id); c.nat.done.push(n.id); c.nat.cur = null; applyNatFx(c, n.fx); cnt(c, 'natDone');
        if (t === G.player) notify('journal', `Decisión nacional completada: «${n.name}». ${natFxText(n.fx)}`);
      }
    } else if (c.ai && G.date.d === 1 && Math.random() < 0.22) {         // la IA elige una decisión disponible
      const av = natTree(c).filter(n => natState(c, n).k === 'avail'); if (!av.length) return;
      const w = av.map(n => 1 + n.fx.filter(f => f[0] === 'mod').length * 0.5 + (c.wars.length && n.fx.some(f => f[0] === 'divs') ? 2 : 0));
      let r = Math.random() * w.reduce((a, b) => a + b, 0), pk = av[0]; for (let i = 0; i < av.length; i++) { r -= w[i]; if (r <= 0) { pk = av[i]; break; } }
      natStart(c, pk.id);
    }
  });
}
/* ---------- ventana ---------- */
const NAT_CW = 230, NAT_CH = 132;
WINDOWS.national = {title: 'Decisiones nacionales', icon: '🌳', render() {
  const c = me(); c.nat = c.nat || {done: [], cur: null};
  const tree = natTree(c), br = natBranches(c), cur = c.nat.cur && natNode(c, c.nat.cur.id);
  const W = br.length * NAT_CW + 20, H = (Math.max(...tree.map(n => n.t)) + 1) * NAT_CH + 50;
  const pos = n => ({x: 10 + n.b * NAT_CW + 15, y: 40 + n.t * NAT_CH});
  const lines = tree.map(n => n.req.map(r => { const p = natNode(c, r), a = pos(p), b = pos(n); return `<path d="M${a.x + 100} ${a.y + 86} C${a.x + 100} ${a.y + 112} ${b.x + 100} ${b.y - 24} ${b.x + 100} ${b.y}" class="nl"/>`; }).join('') + n.excl.map(x => { const p = natNode(c, x); if (!p || p.id < n.id) return ''; const a = pos(p), b = pos(n); return `<path d="M${a.x + 200} ${a.y + 43} L${b.x} ${b.y + 43}" class="nl ex"/>`; }).join('')).join('');
  const nodes = tree.map(n => { const st = natState(c, n), p = pos(n); const cu = st.k === 'cur' ? c.nat.cur : null;
    return `<div class="nnode ${st.k}" style="left:${p.x}px;top:${p.y}px" ${st.k === 'avail' ? `data-act="natstart" data-id="${n.id}"` : ''}><div class="nh"><span class="ni">${n.icon}</span><b>${n.name}</b></div><small>${n.desc}</small><small class="nfx">${natFxText(n.fx)}</small>
      ${cu ? `<div class="bar"><i style="width:${(1 - cu.left / (cu.total * 1.15)) * 100}%"></i></div><small>${Math.ceil(cu.left / 7)} semanas</small>` : st.k === 'done' ? '<small class="good">✔ Completada</small>' : st.k === 'avail' ? `<small class="dim">⏱ ${Math.round(n.days / 7)} semanas — clic para comenzar</small>` : `<small class="dim">${st.why || ''}</small>`}</div>`; }).join('');
  return `<div class="card"><div class="kv"><b>${NAT_BRANCHES[c.tag] ? '🌳 Árbol de ' + c.name : '🌳 Árbol genérico'}</b>${cur ? `<span>En curso: <b>${cur.name}</b> · ${Math.ceil(c.nat.cur.left / 7)} semanas <button data-act="natcancel">Cancelar</button></span>` : '<span class="good">Elige tu próxima decisión</span>'}</div>
  <p class="hint">Cada decisión tarda entre 10 y 20 semanas y sus efectos son permanentes. Las ramas con línea roja son <b>excluyentes</b>: elegir una bloquea la otra.</p>
  <div class="ntree scrollable"><div class="ncanvas" style="width:${W}px;height:${H}px"><svg width="${W}" height="${H}">${lines}</svg>${br.map((b, i) => `<div class="nbr" style="left:${10 + i * NAT_CW + 15}px"><b>${b}</b></div>`).join('')}${nodes}</div></div></div>`;
}};
Object.assign(ACT, {
  natstart: d => { const r = natStart(me(), d.id); toast(r.ok ? '🌳' : '⚠️', r.msg); renderWindow(true); },
  natcancel: () => { me().nat.cur = null; renderWindow(true); }
});
