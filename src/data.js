/* ===== REGLAS DEL JUEGO ===== */
const MONTHS = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
const MONTHS_CAP = MONTHS.map(m => m[0].toUpperCase() + m.slice(1));
const DAYS_IN_MONTH = [31,28,31,30,31,30,31,31,30,31,30,31];

const GOODS = [
 {id:'grain',  name:'Cereales',   base:6,  icon:'🌾', color:'#d8b84a', cat:'Alimentos'},
 {id:'meat',   name:'Carne',      base:14, icon:'🥩', color:'#b5524a', cat:'Alimentos'},
 {id:'fish',   name:'Pescado',    base:10, icon:'🐟', color:'#5a8fb0', cat:'Alimentos'},
 {id:'fruit',  name:'Fruta',      base:12, icon:'🍎', color:'#c2584a', cat:'Alimentos'},
 {id:'sugar',  name:'Azúcar',     base:16, icon:'🍬', color:'#e8e0cf', cat:'Alimentos'},
 {id:'tea',    name:'Té',         base:22, icon:'🍵', color:'#7a9a4a', cat:'Lujo'},
 {id:'coffee', name:'Café',       base:20, icon:'☕', color:'#7a5238', cat:'Lujo'},
 {id:'tobacco',name:'Tabaco',     base:20, icon:'🚬', color:'#9a7a4a', cat:'Lujo'},
 {id:'liquor', name:'Licores',    base:18, icon:'🍷', color:'#8a3a5a', cat:'Lujo'},
 {id:'wood',   name:'Madera',     base:6,  icon:'🪵', color:'#8a6a3a', cat:'Materias primas'},
 {id:'iron',   name:'Hierro',     base:12, icon:'⛓️', color:'#8a96a6', cat:'Materias primas'},
 {id:'coal',   name:'Carbón',     base:10, icon:'⚫', color:'#4a4a52', cat:'Materias primas'},
 {id:'fibers', name:'Fibras',     base:9,  icon:'🧶', color:'#cfc6a8', cat:'Materias primas'},
 {id:'fabric', name:'Tejidos',    base:16, icon:'🧵', color:'#b8a0c8', cat:'Industriales'},
 {id:'clothes',name:'Ropa',       base:22, icon:'👔', color:'#6a8ab8', cat:'Industriales'},
 {id:'furniture',name:'Muebles',  base:24, icon:'🪑', color:'#a8784a', cat:'Industriales'},
 {id:'tools',  name:'Herramientas',base:26,icon:'🔧', color:'#9aa4b0', cat:'Industriales'},
 {id:'steel',  name:'Acero',      base:36, icon:'🔩', color:'#b6c2d2', cat:'Industriales'}
];
const GOOD = {}; GOODS.forEach(g => GOOD[g.id] = g);

const VA_PER_WORKER = 10;      // valor añadido por trabajador a precios base
const WORKERS_PER_LEVEL = 5000;

// workers: reparto de profesiones; inputs por nivel y semana
const BUILDINGS = [
 {id:'farm',     name:'Granjas',               icon:'🌾', grp:'Agricultura', out:'grain',  workers:{peasants:1}, cost:150, cap:'arable'},
 {id:'ranch',    name:'Ranchos Ganaderos',     icon:'🐄', grp:'Agricultura', out:'meat',   workers:{peasants:1}, cost:150, cap:'pasture'},
 {id:'fruit',    name:'Huertos',               icon:'🍎', grp:'Plantaciones',out:'fruit',  workers:{peasants:1}, cost:150, cap:'F'},
 {id:'sugar',    name:'Plantaciones de Azúcar',icon:'🍬', grp:'Plantaciones',out:'sugar',  workers:{peasants:1}, cost:160, cap:'U'},
 {id:'tea',      name:'Plantaciones de Té',    icon:'🍵', grp:'Plantaciones',out:'tea',    workers:{peasants:1}, cost:160, cap:'T'},
 {id:'coffee',   name:'Plantaciones de Café',  icon:'☕', grp:'Plantaciones',out:'coffee', workers:{peasants:1}, cost:160, cap:'C'},
 {id:'tobacco',  name:'Plantaciones de Tabaco',icon:'🚬', grp:'Plantaciones',out:'tobacco',workers:{peasants:1}, cost:160, cap:'B'},
 {id:'fibers',   name:'Plantaciones de Algodón',icon:'🧶',grp:'Plantaciones',out:'fibers', workers:{peasants:1}, cost:150, cap:'u'},
 {id:'fishing',  name:'Puertos Pesqueros',     icon:'🎣', grp:'Extracción',  out:'fish',   workers:{laborers:1}, cost:150, cap:'coast'},
 {id:'logging',  name:'Aserraderos',           icon:'🪓', grp:'Extracción',  out:'wood',   workers:{laborers:1}, cost:150, cap:'forest'},
 {id:'iron',     name:'Minas de Hierro',       icon:'⛏️', grp:'Extracción',  out:'iron',   workers:{laborers:1}, cost:220, cap:'i'},
 {id:'coal',     name:'Minas de Carbón',       icon:'⛏️', grp:'Extracción',  out:'coal',   workers:{laborers:1}, cost:220, cap:'c'},
 {id:'textile',  name:'Fábricas Textiles',     icon:'🏭', grp:'Industria',   out:'fabric', inputs:{fibers:3500}, workers:{laborers:.85,machinists:.15}, cost:300, cap:'ind'},
 {id:'clothes',  name:'Talleres de Ropa',      icon:'🧥', grp:'Industria',   out:'clothes',inputs:{fabric:2000}, workers:{laborers:.85,machinists:.15}, cost:260, cap:'ind'},
 {id:'furniture',name:'Talleres de Muebles',   icon:'🪑', grp:'Industria',   out:'furniture',inputs:{wood:3500,fabric:500}, workers:{laborers:.85,machinists:.15}, cost:260, cap:'ind'},
 {id:'tools',    name:'Talleres de Herramientas',icon:'🔧',grp:'Industria',  out:'tools',  inputs:{iron:2000,wood:1000,coal:500}, workers:{laborers:.8,machinists:.2}, cost:300, cap:'ind'},
 {id:'liquor',   name:'Destilerías',           icon:'🍷', grp:'Industria',   out:'liquor', inputs:{grain:2500}, workers:{laborers:.85,machinists:.15}, cost:260, cap:'ind'},
 {id:'steel',    name:'Acerías',               icon:'🔥', grp:'Industria',   out:'steel',  inputs:{iron:3000,coal:3000}, workers:{laborers:.75,machinists:.25}, cost:420, cap:'ind', tech:'blast_furnace'},
 {id:'constr',   name:'Sector de la Construcción',icon:'🏗️',grp:'Infraestructura',out:null, workers:{laborers:.8,machinists:.2}, cost:250, cap:'any', gov:false, ctr:25},
 {id:'railway',  name:'Ferrocarriles',         icon:'🚂', grp:'Infraestructura',out:null, inputs:{iron:800,coal:800}, workers:{laborers:.85,machinists:.15}, cost:420, cap:'rail', tech:'railways', infra:1},
 {id:'admin',    name:'Administración',        icon:'🏛️', grp:'Gobierno',    out:null, workers:{bureaucrats:1}, cost:200, cap:'any', gov:true, bur:100},
 {id:'barracks', name:'Cuarteles',             icon:'🎖️', grp:'Gobierno',    out:null, workers:{soldiers:.9,officers:.1}, cost:200, cap:'any', gov:true, mil:1},
 {id:'university',name:'Universidades',        icon:'🎓', grp:'Gobierno',    out:null, workers:{clerks:1}, cost:260, cap:'any', gov:true, inn:1}
];
const BLD = {}; BUILDINGS.forEach(b => {
  BLD[b.id] = b;
  b.inputs = b.inputs || {};
  b.workersPerLevel = b.gov ? 2000 : WORKERS_PER_LEVEL;
  if (b.out) {
    let iv = 0; for (const g in b.inputs) iv += b.inputs[g] * GOOD[g].base;
    b.outAmt = (iv + VA_PER_WORKER * b.workersPerLevel) / GOOD[b.out].base;
  }
});

// Escalera de consumo (unidades por persona y semana)
const LADDER = [
 {g:'grain', q:0.15, w:4},{g:'wood', q:0.04, w:2},{g:'fabric', q:0.02, w:2},
 {g:'fish', q:0.025, w:1.5},{g:'meat', q:0.015, w:1.5},{g:'clothes', q:0.012, w:1.5},
 {g:'fruit', q:0.010, w:1},{g:'sugar', q:0.012, w:1},{g:'coal', q:0.02, w:1},
 {g:'liquor', q:0.008, w:1},{g:'furniture', q:0.006, w:1},{g:'tea', q:0.006, w:1},
 {g:'tobacco', q:0.006, w:0.8},{g:'coffee', q:0.006, w:0.8},{g:'tools', q:0.004, w:0.8}
];
const LADDER_W = LADDER.reduce((a, l) => a + l.w, 0);

// Profesiones: estrato, fuerza política, multiplicador de consumo
const PROFS = {
 aristocrats:{name:'Aristócratas', strat:'upper', pol:12, cons:3, ig:{lands:1}},
 capitalists:{name:'Capitalistas', strat:'upper', pol:12, cons:3, ig:{indus:1}},
 clergy:     {name:'Clero',        strat:'middle',pol:3,  cons:1.2, ig:{devout:1}},
 officers:   {name:'Oficiales',    strat:'middle',pol:4,  cons:1.5, ig:{armed:1}},
 soldiers:   {name:'Soldados',     strat:'lower', pol:1,  cons:1, ig:{armed:1}},
 bureaucrats:{name:'Burócratas',   strat:'middle',pol:2.5,cons:1.4, ig:{intel:.6,petty:.4}},
 shopkeepers:{name:'Tenderos',     strat:'middle',pol:2,  cons:1.3, ig:{petty:1}},
 clerks:     {name:'Oficinistas',  strat:'middle',pol:2,  cons:1.2, ig:{intel:.7,petty:.3}},
 machinists: {name:'Maquinistas',  strat:'middle',pol:1.5,cons:1.1, ig:{union:.8,intel:.2}},
 laborers:   {name:'Obreros',      strat:'lower', pol:1,  cons:1, ig:{union:.65,rural:.15,devout:.2}},
 peasants:   {name:'Campesinos',   strat:'lower', pol:1,  cons:1, ig:{rural:.75,devout:.25}}
};
const PROF_ORDER = ['aristocrats','capitalists','clergy','officers','bureaucrats','shopkeepers','clerks','machinists','laborers','peasants','soldiers'];
const STRATA_NAME = {upper:'Clase alta', middle:'Clase media', lower:'Clase baja'};

const IGS = {
 lands: {name:'Terratenientes', icon:'🌳', color:'#a8803c', desc:'La aristocracia rural defiende la tradición y la propiedad de la tierra.',
   likes:{autocracy:2,oligarchy:2,landed_voting:2,serfdom:2,tenant:1,mercantilism:1,state_religion:1,censorship:1,peasant_levies:1,percapita:1,closed_borders:1,slavery_legal:1,
          universal:-3,laissez:-1,commercial:-1,tolerance:-.5,free_press:-1,public_edu:-1,conscription:-1,graduated:-2,free_movement:-1,secular:-1,regulated:-1}},
 indus: {name:'Industriales', icon:'🏭', color:'#7a8a9a', desc:'Capitalistas e industriales que impulsan la economía de mercado.',
   likes:{laissez:3,commercial:2,wealth_voting:2,free_movement:1,controlled:.5,limited_press:1,no_regs:2,professional:1,proportional:1,elite_edu:1,slavery_banned:.5,
          mercantilism:-1,serfdom:-2,interventionism:-1,regulated:-3,inspections:-1,graduated:-2,universal:-1,autocracy:-1}},
 intel: {name:'Intelectuales', icon:'📚', color:'#5a8fb8', desc:'Académicos, burócratas y reformadores liberales.',
   likes:{free_press:3,limited_press:1,public_edu:3,elite_edu:1,secular:2,tolerance:1,wealth_voting:1,universal:2,slavery_banned:2,commercial:1,inspections:1,
          censorship:-3,autocracy:-2,serfdom:-3,state_religion:-2,slavery_legal:-3,no_edu:-2,closed_borders:-1}},
 petty: {name:'Pequeña Burguesía', icon:'🏪', color:'#c2a35a', desc:'Tenderos, oficinistas y pequeños propietarios.',
   likes:{wealth_voting:2,tolerance:1,limited_press:1,proportional:2,controlled:1,interventionism:1,public_edu:1,inspections:1,laissez:.5,
          autocracy:-2,serfdom:-1,graduated:-1,censorship:-1,closed_borders:-.5}},
 devout:{name:'Clero', icon:'⛪', color:'#9a6ab0', desc:'Jerarquía religiosa y fieles devotos.',
   likes:{state_religion:3,censorship:1,autocracy:1,oligarchy:1,serfdom:.5,no_edu:1,closed_borders:.5,mercantilism:.5,
          secular:-3,tolerance:-1,free_press:-2,public_edu:-1,universal:-1,slavery_legal:-1}},
 armed: {name:'Fuerzas Armadas', icon:'🎖️', color:'#8a4a4a', desc:'Oficiales y soldados que exigen un ejército fuerte.',
   likes:{conscription:2,professional:2,autocracy:1,oligarchy:1,peasant_levies:.5,closed_borders:.5,mercantilism:.5,censorship:.5,
          free_press:-1,universal:-.5,graduated:-.5}},
 union: {name:'Sindicatos', icon:'⚙️', color:'#c0584a', desc:'Obreros industriales organizados.',
   likes:{regulated:3,inspections:2,universal:3,public_edu:1,free_press:1,interventionism:1,graduated:2,free_movement:.5,secular:.5,
          no_regs:-3,autocracy:-2,laissez:-1,censorship:-1,serfdom:-2,wealth_voting:-1,percapita:-1}},
 rural: {name:'Folk Rural', icon:'🧑‍🌾', color:'#6e9a4a', desc:'Campesinos y trabajadores del campo.',
   likes:{tenant:1,commercial:1,tolerance:.5,peasant_levies:1,proportional:.5,state_religion:.5,closed_borders:.5,serfdom:-3,slavery_legal:-1,percapita:-2,
          conscription:-1.5,graduated:.5,universal:.5,free_movement:-.5}}
};
const IG_ORDER = ['lands','indus','intel','petty','devout','armed','union','rural'];

// Leyes. mods: tax, bur, invest, lit, grow, army, rad, out, lab, stab ; fr = participación política
const LAW_CATS = [
 {id:'power', name:'Estructura de Poder', icon:'👑', opts:[
  {id:'autocracy', name:'Autocracia', fr:0.06, mods:{stab:4, rad:.2, tax:.05}, desc:'El poder reside en un soberano y su corte.'},
  {id:'oligarchy', name:'Oligarquía', fr:0.12, mods:{stab:2}, desc:'Una pequeña élite gobierna en nombre de todos.'},
  {id:'landed_voting', name:'Voto por Propiedad de la Tierra', fr:0.2, mods:{stab:1}, desc:'Solo los terratenientes votan.'},
  {id:'wealth_voting', name:'Voto Censitario por Riqueza', fr:0.35, mods:{invest:.05}, tech:'liberalism', desc:'El voto depende de la riqueza.'},
  {id:'universal', name:'Sufragio Universal', fr:1, mods:{lit:.1, rad:-.2, stab:-2}, tech:'universal_suffrage', desc:'Todos los adultos tienen voz.'}]},
 {id:'economy', name:'Sistema Económico', icon:'💱', opts:[
  {id:'mercantilism', name:'Mercantilismo', mods:{tax:.1, invest:-.1, out:-.03}, desc:'El Estado dirige el comercio.'},
  {id:'interventionism', name:'Intervencionismo', mods:{invest:.05, tax:.05}, desc:'El Estado media en la economía.'},
  {id:'laissez', name:'Laissez-faire', mods:{invest:.25, out:.03, tax:-.1}, tech:'liberalism', desc:'Mercado libre con mínima intervención.'}]},
 {id:'labor', name:'Derechos Laborales', icon:'⚒️', opts:[
  {id:'no_regs', name:'Sin Regulaciones', mods:{lab:-.05, rad:.2, out:.02}, desc:'No existen leyes laborales.'},
  {id:'inspections', name:'Inspecciones de Fábricas', mods:{lab:.0, rad:-.05, tax:-.02}, tech:'sanitation', desc:'Se vigilan condiciones básicas.'},
  {id:'regulated', name:'Leyes Laborales', mods:{lab:.06, rad:-.2, out:-.03}, tech:'socialism', desc:'Jornadas y salarios regulados.'}]},
 {id:'agrarian', name:'Sistema Agrario', icon:'🌾', opts:[
  {id:'serfdom', name:'Servidumbre', mods:{out:-.04, rad:.3, stab:2}, desc:'Los campesinos están atados a la tierra.'},
  {id:'tenant', name:'Aparcería', mods:{}, desc:'Los campesinos arriendan la tierra.'},
  {id:'commercial', name:'Agricultura Comercial', mods:{out:.03, invest:.05}, tech:'crop_rotation', desc:'Granjas orientadas al mercado.'}]},
 {id:'bonded', name:'Trabajo Forzado', icon:'⛓️', opts:[
  {id:'slavery_legal', name:'Esclavitud Legal', mods:{rad:.4, out:.02}, desc:'La esclavitud está permitida.'},
  {id:'slavery_banned', name:'Esclavitud Abolida', mods:{}, desc:'Prohibida la esclavitud.'}]},
 {id:'religion', name:'Religión', icon:'⛪', opts:[
  {id:'state_religion', name:'Religión de Estado', mods:{stab:3, lit:-.05}, desc:'Una confesión oficial.'},
  {id:'tolerance', name:'Tolerancia Religiosa', mods:{}, desc:'Se toleran otras confesiones.'},
  {id:'secular', name:'Estado Laico', mods:{lit:.05, stab:-1}, tech:'liberalism', desc:'Separación de Iglesia y Estado.'}]},
 {id:'education', name:'Educación', icon:'🎓', opts:[
  {id:'no_edu', name:'Sin Sistema Educativo', mods:{lit:0}, desc:'La educación no es asunto del Estado.'},
  {id:'elite_edu', name:'Educación de Élite', mods:{lit:.1}, tech:'academia', desc:'Solo para las clases altas.'},
  {id:'public_edu', name:'Educación Pública', mods:{lit:.4, tax:-.03}, tech:'public_schools', desc:'Escuelas para todos.'}]},
 {id:'press', name:'Libertad de Prensa', icon:'📰', opts:[
  {id:'censorship', name:'Censura', mods:{stab:2, rad:.2, lit:-.02}, desc:'El Estado controla la prensa.'},
  {id:'limited_press', name:'Prensa con Restricciones', mods:{}, desc:'Crítica permitida con límites.'},
  {id:'free_press', name:'Prensa Libre', mods:{rad:-.05, stab:-1, lit:.05}, tech:'political_agitation', desc:'Sin censura previa.'}]},
 {id:'army', name:'Modelo de Ejército', icon:'🎖️', opts:[
  {id:'peasant_levies', name:'Levas Campesinas', mods:{army:-.1}, desc:'Reclutas mal entrenados.'},
  {id:'professional', name:'Ejército Profesional', mods:{army:.1, tax:-.02}, desc:'Soldados de carrera.'},
  {id:'conscription', name:'Conscripción Nacional', mods:{army:.25, rad:.05}, tech:'nationalism', desc:'Servicio militar obligatorio.'}]},
 {id:'tax', name:'Sistema Fiscal', icon:'💰', opts:[
  {id:'percapita', name:'Impuesto per Cápita', mods:{tax:-.08, rad:.1}, desc:'Una cuota fija por cabeza.'},
  {id:'proportional', name:'Impuesto Proporcional', mods:{tax:.0}, desc:'Mismo porcentaje para todos.'},
  {id:'graduated', name:'Impuesto Progresivo', mods:{tax:.12, invest:-.05}, tech:'income_tax', desc:'Los ricos pagan más.'}]},
 {id:'migration', name:'Política Migratoria', icon:'🧳', opts:[
  {id:'closed_borders', name:'Fronteras Cerradas', mods:{grow:-.001}, desc:'Se prohíbe la inmigración.'},
  {id:'controlled', name:'Inmigración Controlada', mods:{}, desc:'Cuotas por nacionalidad.'},
  {id:'free_movement', name:'Libre Circulación', mods:{grow:.002}, tech:'liberalism', desc:'Fronteras abiertas.'}]}
];
const LAW = {}; LAW_CATS.forEach(c => c.opts.forEach(o => { LAW[o.id] = o; o.cat = c.id; }));

const LAW_PROFILES = {
 absolute:  {power:'autocracy', economy:'mercantilism', labor:'no_regs', agrarian:'tenant', bonded:'slavery_banned', religion:'state_religion', education:'no_edu', press:'censorship', army:'professional', tax:'percapita', migration:'closed_borders'},
 serf:      {power:'autocracy', economy:'mercantilism', labor:'no_regs', agrarian:'serfdom', bonded:'slavery_banned', religion:'state_religion', education:'no_edu', press:'censorship', army:'peasant_levies', tax:'percapita', migration:'closed_borders'},
 eastern:   {power:'autocracy', economy:'mercantilism', labor:'no_regs', agrarian:'serfdom', bonded:'slavery_banned', religion:'state_religion', education:'no_edu', press:'censorship', army:'peasant_levies', tax:'percapita', migration:'closed_borders'},
 theocracy: {power:'oligarchy', economy:'mercantilism', labor:'no_regs', agrarian:'tenant', bonded:'slavery_banned', religion:'state_religion', education:'no_edu', press:'censorship', army:'professional', tax:'percapita', migration:'closed_borders'},
 liberal:   {power:'wealth_voting', economy:'interventionism', labor:'no_regs', agrarian:'tenant', bonded:'slavery_banned', religion:'tolerance', education:'elite_edu', press:'limited_press', army:'professional', tax:'proportional', migration:'controlled'},
 republic:  {power:'landed_voting', economy:'laissez', labor:'no_regs', agrarian:'commercial', bonded:'slavery_banned', religion:'tolerance', education:'elite_edu', press:'free_press', army:'professional', tax:'proportional', migration:'free_movement'},
 slave:     {power:'oligarchy', economy:'mercantilism', labor:'no_regs', agrarian:'commercial', bonded:'slavery_legal', religion:'state_religion', education:'no_edu', press:'limited_press', army:'professional', tax:'percapita', migration:'controlled'}
};
const LAW_OVERRIDES = {
 GBR:{power:'wealth_voting', economy:'laissez', agrarian:'commercial', education:'elite_edu', press:'limited_press', tax:'proportional', migration:'controlled', religion:'tolerance'},
 USA:{bonded:'slavery_legal', power:'landed_voting'},
 FRA:{economy:'interventionism', education:'elite_edu'},
 BEL:{economy:'laissez', press:'free_press'}, NET:{economy:'laissez'}, SWI:{power:'wealth_voting', press:'free_press'},
 TEX:{bonded:'slavery_legal'}, BRZ:{}, JAP:{army:'professional', agrarian:'tenant'}, PRU:{education:'elite_edu', army:'conscription', agrarian:'tenant'},
 RUS:{agrarian:'serfdom'}, AUS:{agrarian:'serfdom', army:'professional'}, SWE:{education:'elite_edu', press:'limited_press'}, DEN:{education:'elite_edu'},
 PER:{bonded:'slavery_legal'}, COL:{bonded:'slavery_legal'}, VEN:{bonded:'slavery_legal'}, ARG:{bonded:'slavery_legal'}, OTT:{bonded:'slavery_legal', agrarian:'tenant'},
 EGY:{bonded:'slavery_legal'}, MOR:{bonded:'slavery_legal'}, SOK:{bonded:'slavery_legal'}, ETH:{bonded:'slavery_legal'}, ASH:{bonded:'slavery_legal'}, ZUL:{bonded:'slavery_legal'},
 SPA:{bonded:'slavery_legal'}, POR:{bonded:'slavery_legal'}, OMA:{bonded:'slavery_legal'}
};

const TECHS = [
 {id:'crop_rotation', name:'Rotación de Cultivos', cat:'Producción', cost:120, fx:{agriOut:.12}, desc:'Mejora el rendimiento agrícola.'},
 {id:'mechanical_loom', name:'Telar Mecánico', cat:'Producción', cost:140, fx:{indOut:.10}, desc:'Mayor eficiencia en la industria textil.'},
 {id:'steam_engine', name:'Máquina de Vapor', cat:'Producción', cost:180, fx:{mineOut:.12, indOut:.06}, desc:'Bombea las minas y mueve las fábricas.', req:['mechanical_loom']},
 {id:'iron_plow', name:'Arado de Acero', cat:'Producción', cost:200, fx:{agriOut:.10}, req:['crop_rotation'], desc:'Roturación de suelos duros.'},
 {id:'blast_furnace', name:'Alto Horno', cat:'Producción', cost:240, fx:{mineOut:.06}, req:['steam_engine'], desc:'Desbloquea las acerías.'},
 {id:'railways', name:'Ferrocarriles', cat:'Producción', cost:300, fx:{constr:.1}, req:['steam_engine'], desc:'Desbloquea los ferrocarriles.'},
 {id:'telegraph', name:'Telégrafo', cat:'Sociedad', cost:280, fx:{bur:.15}, req:['railways'], desc:'Comunicaciones instantáneas.'},
 {id:'bessemer', name:'Convertidor Bessemer', cat:'Producción', cost:420, fx:{indOut:.12, mineOut:.05}, req:['blast_furnace'], desc:'Acero barato en masa.'},
 {id:'liberalism', name:'Liberalismo', cat:'Sociedad', cost:150, fx:{invest:.03}, desc:'Desbloquea el voto censitario, el laissez-faire y el Estado laico.'},
 {id:'academia', name:'Academia Científica', cat:'Sociedad', cost:130, fx:{innov:.15}, desc:'Más puntos de innovación.'},
 {id:'public_schools', name:'Escuelas Públicas', cat:'Sociedad', cost:220, fx:{lit:.15}, req:['academia'], desc:'Desbloquea la educación pública.'},
 {id:'nationalism', name:'Nacionalismo', cat:'Sociedad', cost:200, fx:{army:.05}, desc:'Desbloquea la conscripción nacional.'},
 {id:'political_agitation', name:'Agitación Política', cat:'Sociedad', cost:200, fx:{}, req:['liberalism'], desc:'Desbloquea la prensa libre.'},
 {id:'sanitation', name:'Saneamiento', cat:'Sociedad', cost:260, fx:{grow:.002}, req:['academia'], desc:'Ciudades más saludables. Desbloquea inspecciones de fábricas.'},
 {id:'income_tax', name:'Impuesto sobre la Renta', cat:'Sociedad', cost:260, fx:{tax:.05}, req:['liberalism'], desc:'Desbloquea el impuesto progresivo.'},
 {id:'joint_stock', name:'Sociedades Anónimas', cat:'Producción', cost:240, fx:{invest:.08}, req:['liberalism'], desc:'Mayor inversión privada.'},
 {id:'socialism', name:'Socialismo', cat:'Sociedad', cost:320, fx:{}, req:['political_agitation'], desc:'Desbloquea las leyes laborales.'},
 {id:'universal_suffrage', name:'Sufragio Universal', cat:'Sociedad', cost:340, fx:{}, req:['political_agitation'], desc:'Desbloquea el sufragio universal.'},
 {id:'percussion_cap', name:'Pistones de Percusión', cat:'Militar', cost:140, fx:{army:.12}, desc:'Mosquetes más fiables.'},
 {id:'rifled_muskets', name:'Mosquetes Rayados', cat:'Militar', cost:240, fx:{army:.15}, req:['percussion_cap'], desc:'Mayor alcance y precisión.'},
 {id:'breech_loaders', name:'Retrocarga', cat:'Militar', cost:360, fx:{army:.2}, req:['rifled_muskets'], desc:'Cadencia de fuego muy superior.'},
 {id:'medicine', name:'Medicina Moderna', cat:'Sociedad', cost:300, fx:{grow:.003}, req:['sanitation'], desc:'Menor mortalidad.'}
];
const TECH = {}; TECHS.forEach(t => TECH[t.id] = t);

const JOURNAL = [
 {id:'industrial', name:'La Revolución Industrial', desc:'Duplica tus niveles de industria manufacturera.', goal:2, prog: c => c.stats.indLevels / Math.max(1, c.start.ind), reward:{prestige:60, innov:150}},
 {id:'literacy', name:'Una Nación Letrada', desc:'Eleva la alfabetización nacional 15 puntos.', goal:15, prog: c => c.lit - c.start.lit, reward:{prestige:50, innov:120}},
 {id:'treasury', name:'Las Arcas del Estado', desc:'Acumula un tesoro de 40 semanas de ingresos.', goal:40, prog: c => c.treasury / Math.max(1, c.stats.income), reward:{prestige:30, innov:80}},
 {id:'power', name:'Prestigio Nacional', desc:'Aumenta tu prestigio en 100 puntos.', goal:100, prog: c => c.prestige - c.start.prestige, reward:{prestige:50, innov:200}},
 {id:'army', name:'Fuerza Militar', desc:'Aumenta tu ejército un 50%.', goal:1.5, prog: c => c.stats.soldiers / Math.max(1, c.start.soldiers), reward:{prestige:40, innov:100}},
 {id:'growth', name:'Crecimiento Demográfico', desc:'Haz crecer tu población un 25% desde el inicio.', goal:25, prog: c => (c.stats.pop / c.startPop - 1) * 100, reward:{prestige:40, innov:100}}
];

const START_YEAR = 1836;
