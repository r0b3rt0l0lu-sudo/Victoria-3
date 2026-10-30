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
 {id:'steel',  name:'Acero',      base:36, icon:'🔩', color:'#b6c2d2', cat:'Industriales'},
 {id:'saltpeter',name:'Salitre',   base:14, icon:'🧂', color:'#d8d4c4', cat:'Materias primas'},
 {id:'gunpowder',name:'Pólvora',   base:30, icon:'💥', color:'#5a5a62', cat:'Militares'},
 {id:'rifles', name:'Fusiles',    base:34, icon:'🔫', color:'#7a6a58', cat:'Militares'},
 {id:'cannons',name:'Cañones',    base:70, icon:'💣', color:'#4e5a66', cat:'Militares'},
 {id:'horses', name:'Caballos',   base:36, icon:'🐎', color:'#9a6a3a', cat:'Militares'}
];
// consumo militar mundial estimado por semana (para dimensionar la industria inicial)
const MIL_NEED = {rifles: 60000, cannons: 3500, horses: 25000, gunpowder: 18000, ships: 1300};
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
 {id:'saltpeter',name:'Salitreras',            icon:'🧂', grp:'Extracción',  out:'saltpeter',workers:{laborers:1}, cost:220, cap:'mineral'},
 {id:'stud',     name:'Haras de Caballos',     icon:'🐎', grp:'Agricultura', out:'horses', inputs:{grain:2500}, workers:{peasants:1}, cost:200, cap:'pasture'},
 {id:'powder',   name:'Fábricas de Pólvora',   icon:'💥', grp:'Industria militar', out:'gunpowder', inputs:{saltpeter:2000,coal:1500}, workers:{laborers:.8,machinists:.2}, cost:300, cap:'ind'},
 {id:'armory',   name:'Fábricas de Armas',     icon:'🔫', grp:'Industria militar', out:'rifles', inputs:{iron:1800,wood:900,tools:200}, workers:{laborers:.8,machinists:.2}, cost:320, cap:'ind'},
 {id:'foundry',  name:'Fundiciones de Cañones',icon:'💣', grp:'Industria militar', out:'cannons', inputs:{iron:2600,coal:1200,tools:300}, workers:{laborers:.75,machinists:.25}, cost:380, cap:'ind'},
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
 lands: {ideo:'Conservadurismo', name:'Terratenientes', icon:'🌳', color:'#a8803c', desc:'La aristocracia rural defiende la tradición y la propiedad de la tierra.',
   likes:{autocracy:2,oligarchy:2,landed_voting:2,serfdom:2,tenant:1,mercantilism:1,state_religion:1,censorship:1,peasant_levies:1,percapita:1,closed_borders:1,slavery_legal:1,
          universal:-3,laissez:-1,commercial:-1,tolerance:-.5,free_press:-1,public_edu:-1,conscription:-1,graduated:-2,free_movement:-1,secular:-1,regulated:-1}},
 indus: {ideo:'Liberalismo económico', name:'Industriales', icon:'🏭', color:'#7a8a9a', desc:'Capitalistas e industriales que impulsan la economía de mercado.',
   likes:{laissez:3,commercial:2,wealth_voting:2,free_movement:1,controlled:.5,limited_press:1,no_regs:2,professional:1,proportional:1,elite_edu:1,slavery_banned:.5,
          mercantilism:-1,serfdom:-2,interventionism:-1,regulated:-3,inspections:-1,graduated:-2,universal:-1,autocracy:-1}},
 intel: {ideo:'Republicanismo', name:'Intelectuales', icon:'📚', color:'#5a8fb8', desc:'Académicos, burócratas y reformadores liberales.',
   likes:{free_press:3,limited_press:1,public_edu:3,elite_edu:1,secular:2,tolerance:1,wealth_voting:1,universal:2,slavery_banned:2,commercial:1,inspections:1,
          censorship:-3,autocracy:-2,serfdom:-3,state_religion:-2,slavery_legal:-3,no_edu:-2,closed_borders:-1}},
 petty: {ideo:'Liberalismo político', name:'Pequeña Burguesía', icon:'🏪', color:'#c2a35a', desc:'Tenderos, oficinistas y pequeños propietarios.',
   likes:{wealth_voting:2,tolerance:1,limited_press:1,proportional:2,controlled:1,interventionism:1,public_edu:1,inspections:1,laissez:.5,
          autocracy:-2,serfdom:-1,graduated:-1,censorship:-1,closed_borders:-.5}},
 devout:{ideo:'Tradicionalismo religioso', name:'Clero', icon:'⛪', color:'#9a6ab0', desc:'Jerarquía religiosa y fieles devotos.',
   likes:{state_religion:3,censorship:1,autocracy:1,oligarchy:1,serfdom:.5,no_edu:1,closed_borders:.5,mercantilism:.5,
          secular:-3,tolerance:-1,free_press:-2,public_edu:-1,universal:-1,slavery_legal:-1}},
 armed: {ideo:'Nacionalismo autoritario', name:'Fuerzas Armadas', icon:'🎖️', color:'#8a4a4a', desc:'Oficiales y soldados que exigen un ejército fuerte.',
   likes:{conscription:2,professional:2,autocracy:1,oligarchy:1,peasant_levies:.5,closed_borders:.5,mercantilism:.5,censorship:.5,
          free_press:-1,universal:-.5,graduated:-.5}},
 union: {ideo:'Socialismo', name:'Sindicatos', icon:'⚙️', color:'#c0584a', desc:'Obreros industriales organizados.',
   likes:{regulated:3,inspections:2,universal:3,public_edu:1,free_press:1,interventionism:1,graduated:2,free_movement:.5,secular:.5,
          no_regs:-3,autocracy:-2,laissez:-1,censorship:-1,serfdom:-2,wealth_voting:-1,percapita:-1}},
 rural: {ideo:'Agrarismo', name:'Folk Rural', icon:'🧑‍🌾', color:'#6e9a4a', desc:'Campesinos y trabajadores del campo.',
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

/* ===== ÁRBOL TECNOLÓGICO (3 eras, ramas excluyentes y mejoras que caducan) ===== */
const ERAS = [
  null,
  {n: 1, name: 'Era de la Revolución Industrial', from: 1836, base: 650},
  {n: 2, name: 'Era de la Expansión', from: 1855, base: 1750, needPrev: 11, needYear: 1855},
  {n: 3, name: 'Era de las Masas', from: 1880, base: 3600, needPrev: 13, needYear: 1880}
];
// [id, nombre, rama, era, multiplicador de coste, requisitos, efectos, descripción, extra]
// extra: {ex: grupo excluyente, until: año límite (después se pierde), after: año mínimo}
const TECH_RAW = [
 // ---- PRODUCCIÓN: agricultura ----
 ['crop_rotation','Rotación de Cultivos','Producción',1,.8,[],{agriOut:.08},'Mejora el rendimiento agrícola.'],
 ['iron_plow','Arado de Hierro','Producción',1,.9,['crop_rotation'],{agriOut:.07},'Roturación de suelos duros.'],
 ['guano','Fertilizantes de Guano','Producción',1,1.0,['iron_plow'],{agriOut:.06,grow:.0005},'Abonos importados que elevan las cosechas.',{after:1840}],
 ['reaper','Segadora Mecánica','Producción',1,1.0,['iron_plow'],{agriOut:.06,constr:.02},'Reduce la mano de obra necesaria en la cosecha.'],
 ['chemical_fert','Abonos Químicos','Producción',2,1.0,['guano'],{agriOut:.10},'Fertilizantes sintéticos.'],
 ['refrigeration','Refrigeración','Producción',2,1.1,['chemical_fert'],{agriOut:.04,grow:.001},'Conservación y transporte de alimentos frescos.'],
 ['mech_farming','Agricultura Mecanizada','Producción',3,1.2,['reaper','refrigeration'],{agriOut:.12,grow:.001},'Tractores y cosechadoras.'],
 // ---- PRODUCCIÓN: industria y minería ----
 ['mechanical_loom','Telar Mecánico','Producción',1,.8,[],{indOut:.06},'Mayor eficiencia en la industria textil.'],
 ['steam_engine','Máquina de Vapor','Producción',1,1.0,['mechanical_loom'],{mineOut:.08,indOut:.04},'Bombea las minas y mueve las fábricas.'],
 ['deep_mining','Minería en Profundidad','Producción',1,1.1,['steam_engine'],{mineOut:.08},'Galerías profundas y ventilación.'],
 ['blast_furnace','Alto Horno','Producción',1,1.2,['steam_engine'],{mineOut:.04,steelOut:.05},'Desbloquea las acerías.'],
 ['interchangeable','Piezas Intercambiables','Producción',1,1.1,['steam_engine'],{indOut:.05,constr:.04},'Producción estandarizada.',{after:1842}],
 ['bessemer','Convertidor Bessemer','Producción',2,1.2,['blast_furnace'],{indOut:.07,steelOut:.12,mineOut:.04},'Acero barato en masa.'],
 ['machine_tools','Máquinas-Herramienta','Producción',2,1.1,['interchangeable'],{indOut:.06,constr:.06},'Tornos y fresadoras de precisión.'],
 ['dynamite','Dinamita','Producción',2,1.0,['deep_mining'],{mineOut:.10,constr:.03},'Voladuras controladas.'],
 ['electricity','Electricidad','Producción',3,1.2,['machine_tools','bessemer'],{indOut:.10,infra:.03},'Dinamos y motores eléctricos.'],
 ['assembly_line','Cadena de Montaje','Producción',3,1.3,['electricity'],{indOut:.12,milCost:-.03},'Producción en serie.'],
 ['organic_chem','Química Industrial','Producción',3,1.2,['chemical_fert','electricity'],{indOut:.06,agriOut:.05},'Tintes, explosivos y fertilizantes.'],
 // ---- PRODUCCIÓN: infraestructura ----
 ['canals','Canalización','Producción',1,.9,[],{infra:.02,constr:.04},'Era de los canales: caduca con la llegada del ferrocarril.',{until:1856}],
 ['railways','Ferrocarriles','Producción',1,1.3,['steam_engine'],{constr:.08,infra:.03},'Desbloquea los ferrocarriles.'],
 ['telegraph','Telégrafo','Sociedad',1,1.1,['railways'],{bur:.10,logistics:.05},'Comunicaciones instantáneas.'],
 ['steamships','Buques de Vapor','Producción',2,1.1,['railways'],{infra:.03,logistics:.06,constr:.02},'Rutas marítimas regulares.'],
 ['railway_gauge','Red Ferroviaria Nacional','Producción',2,1.2,['railways'],{infra:.05,constr:.06,logistics:.06},'Planificación estatal de la red.'],
 ['telephony','Telefonía','Sociedad',3,1.1,['telegraph','electricity'],{bur:.12,innov:.05},'Comunicación de voz a distancia.'],
 // ---- SOCIEDAD: administración y estado ----
 ['civil_service','Administración Civil','Sociedad',1,1.0,[],{bur:.10,tax:.03},'Funcionarios profesionales.'],
 ['statistics','Estadística Oficial','Sociedad',1,1.0,['civil_service'],{tax:.04,bur:.05},'Censos y registros fiscales.'],
 ['income_tax','Impuesto sobre la Renta','Sociedad',1,1.1,['statistics'],{tax:.05},'Desbloquea el impuesto progresivo.'],
 ['ministries','Ministerios Especializados','Sociedad',2,1.2,['statistics'],{bur:.18,stab:1},'Departamentos de Estado con competencias claras.'],
 ['police','Policía Profesional','Sociedad',2,1.1,['civil_service'],{rad:-1.5,stab:2},'Reduce el desorden y los radicales.'],
 ['central_bank','Banco Central','Sociedad',2,1.3,['income_tax'],{crisis:.20,invest:.04},'Prestamista de última instancia: amortigua crisis.'],
 ['welfare','Seguros Sociales','Sociedad',3,1.3,['central_bank','police'],{grow:.002,rad:-2,tax:-.03},'Pensiones y seguros de accidentes.'],
 ['mixed_economy','Economía Mixta','Sociedad',3,1.4,['central_bank','ministries'],{crisis:.30,tax:.06,invest:.04},'Intervención estatal anticíclica.'],
 // ---- SOCIEDAD: educación y pensamiento ----
 ['academia','Academia Científica','Sociedad',1,.9,[],{innov:.10},'Más puntos de innovación.'],
 ['public_schools','Escuelas Públicas','Sociedad',1,1.1,['academia'],{lit:.10},'Desbloquea la educación pública.'],
 ['sanitation','Saneamiento','Sociedad',1,1.2,['academia'],{grow:.002},'Ciudades más saludables. Desbloquea inspecciones de fábricas.'],
 ['scientific_method','Método Científico','Sociedad',2,1.1,['academia'],{innov:.12},'Laboratorios y revistas especializadas.'],
 ['medicine','Medicina Moderna','Sociedad',2,1.2,['sanitation'],{grow:.003},'Vacunas y cirugía antiséptica.'],
 ['mass_education','Educación Obligatoria','Sociedad',2,1.3,['public_schools'],{lit:.15,innov:.05},'Escuela obligatoria hasta los 12 años.'],
 ['universities_res','Universidades de Investigación','Sociedad',3,1.3,['scientific_method','mass_education'],{innov:.18,lit:.05},'Ciencia aplicada a la industria.'],
 ['mass_media','Prensa de Masas','Sociedad',3,1.1,['mass_education'],{lit:.05,stab:1,rad:.5},'Los periódicos moldean la opinión pública.'],
 // ---- SOCIEDAD: política (doctrinas excluyentes + ideas) ----
 ['liberalism','Liberalismo','Sociedad',1,1.0,[],{invest:.03,rad:.5},'Desbloquea el voto censitario, el laissez-faire y el Estado laico.'],
 ['nationalism','Nacionalismo','Sociedad',1,1.0,[],{army:.03,stab:1},'Desbloquea la conscripción nacional.'],
 ['political_agitation','Agitación Política','Sociedad',1,1.2,['liberalism'],{rad:1},'Desbloquea la prensa libre.'],
 ['doc_absolutism','Doctrina Absolutista','Sociedad',1,1.3,[],{stab:3,rad:-1,invest:-.03,bur:.05},'Orden y jerarquía. Excluye otras doctrinas políticas.',{ex:'doc_pol',until:1870}],
 ['doc_liberal','Doctrina Liberal','Sociedad',1,1.3,['liberalism'],{invest:.07,innov:.05,rad:.8,stab:-1},'Libertad individual y mercado. Excluye otras doctrinas políticas.',{ex:'doc_pol',until:1870}],
 ['doc_social','Doctrina Social','Sociedad',1,1.3,['political_agitation'],{lit:.08,rad:-.5,tax:.03,invest:-.02},'Solidaridad y reforma. Excluye otras doctrinas políticas.',{ex:'doc_pol',until:1870,after:1840}],
 ['joint_stock','Sociedades Anónimas','Sociedad',2,1.2,['liberalism'],{invest:.08},'Capital repartido en acciones.'],
 ['socialism','Socialismo','Sociedad',2,1.2,['political_agitation'],{rad:1.5},'Desbloquea las leyes laborales.'],
 ['universal_suffrage','Sufragio Universal','Sociedad',2,1.3,['political_agitation'],{stab:-1},'Desbloquea el sufragio universal.'],
 ['labor_law','Legislación Laboral','Sociedad',2,1.2,['socialism'],{rad:-1,stab:1},'Jornada máxima y descanso semanal.'],
 ['imperialism','Imperialismo','Sociedad',3,1.2,['steamships','nationalism'],{army:.05,logistics:.05},'Doctrina de la expansión colonial.'],
 ['total_state','Estado Total','Sociedad',3,1.4,['mass_media','police'],{bur:.15,army:.06,stab:2,rad:-1},'Movilización de toda la sociedad.'],
 // ---- MILITAR ----
 ['percussion_cap','Pistón de Percusión','Militar',1,.8,[],{army:.08},'Mosquetes más fiables.'],
 ['drill_regs','Reglamento de Instrucción','Militar',1,.9,['percussion_cap'],{army:.05,milCost:-.04},'Ejércitos mejor entrenados y baratos.'],
 ['rifled_muskets','Mosquetes Rayados','Militar',1,1.1,['percussion_cap'],{army:.10},'Mayor alcance y precisión.'],
 ['fortifications','Fortificaciones Modernas','Militar',1,1.0,['drill_regs'],{defense:.10},'Fuertes y líneas defensivas.'],
 ['doc_line','Doctrina de Línea','Militar',1,1.2,['drill_regs'],{army:.07,defense:.03,milCost:.03},'Combate en formaciones cerradas. Excluye otras doctrinas militares.',{ex:'doc_mil',until:1866}],
 ['doc_column','Doctrina de Columnas','Militar',1,1.2,['drill_regs'],{army:.05,logistics:.10},'Maniobra y velocidad. Excluye otras doctrinas militares.',{ex:'doc_mil',until:1866}],
 ['doc_guerrilla','Guerra Irregular','Militar',1,1.2,['percussion_cap'],{defense:.15,milCost:-.06,army:-.02},'Resistencia popular. Excluye otras doctrinas militares.',{ex:'doc_mil',until:1866}],
 ['military_academy','Academia Militar','Militar',1,1.1,['drill_regs'],{army:.04,innov:.04},'Formación de oficiales.'],
 ['breech_loaders','Retrocarga','Militar',2,1.2,['rifled_muskets'],{army:.12},'Cadencia de fuego muy superior.'],
 ['steel_artillery','Artillería de Acero','Militar',2,1.3,['breech_loaders','bessemer'],{army:.10},'Cañones rayados de largo alcance.'],
 ['rail_logistics','Logística Ferroviaria','Militar',2,1.2,['railways','drill_regs'],{logistics:.15},'Movilización por ferrocarril.'],
 ['general_staff','Estado Mayor General','Militar',2,1.3,['military_academy','telegraph'],{army:.08,logistics:.10},'Planificación centralizada de campañas.'],
 ['machine_guns','Ametralladoras','Militar',2,1.2,['breech_loaders'],{defense:.12,army:.04},'Potencia de fuego defensiva.'],
 ['quick_firing','Artillería de Tiro Rápido','Militar',3,1.3,['steel_artillery'],{army:.12},'Retroceso hidráulico.'],
 ['trench_warfare','Guerra de Trincheras','Militar',3,1.2,['machine_guns'],{defense:.20},'Líneas fortificadas continuas.'],
 ['motorization','Motorización','Militar',3,1.4,['internal_comb','rail_logistics'],{army:.12,logistics:.15},'Camiones y vehículos blindados.'],
 ['mass_mobilization','Movilización de Masas','Militar',3,1.4,['general_staff','nationalism'],{army:.18,rad:.8,milCost:.08},'Ejércitos de millones de reservistas.'],
 ['internal_comb','Motor de Combustión','Producción',3,1.2,['electricity'],{infra:.04,army:.04,constr:.05},'Motores de gasolina y diésel.']
];
const TECHS = TECH_RAW.map(t => {
  const x = t[8] || {};
  return {id: t[0], name: t[1], cat: t[2], era: t[3], cost: Math.round(ERAS[t[3]].base * t[4] / 10) * 10, req: t[5], fx: t[6], desc: t[7], ex: x.ex, until: x.until, after: x.after};
});
const TECH = {}; TECHS.forEach(t => TECH[t.id] = t);
// Efecto de cada rama en la interfaz
const TECH_CATS = ['Producción', 'Sociedad', 'Militar'];

const JOURNAL = [
 {id:'industrial', name:'La Revolución Industrial', desc:'Duplica tus niveles de industria manufacturera.', goal:2, prog: c => c.stats.indLevels / Math.max(1, c.start.ind), reward:{prestige:60, innov:150}},
 {id:'literacy', name:'Una Nación Letrada', desc:'Eleva la alfabetización nacional 15 puntos.', goal:15, prog: c => c.lit - c.start.lit, reward:{prestige:50, innov:120}},
 {id:'treasury', name:'Las Arcas del Estado', desc:'Acumula un tesoro de 40 semanas de ingresos.', goal:40, prog: c => c.treasury / Math.max(1, c.stats.income), reward:{prestige:30, innov:80}},
 {id:'power', name:'Prestigio Nacional', desc:'Aumenta tu prestigio en 100 puntos.', goal:100, prog: c => c.prestige - c.start.prestige, reward:{prestige:50, innov:200}},
 {id:'army', name:'Fuerza Militar', desc:'Aumenta tu ejército un 50%.', goal:1.5, prog: c => c.stats.soldiers / Math.max(1, c.start.soldiers), reward:{prestige:40, innov:100}},
 {id:'growth', name:'Crecimiento Demográfico', desc:'Haz crecer tu población un 25% desde el inicio.', goal:25, prog: c => (c.stats.pop / c.startPop - 1) * 100, reward:{prestige:40, innov:100}}
];

const START_YEAR = 1836;
