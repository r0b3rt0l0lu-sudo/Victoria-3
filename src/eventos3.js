/* ===== MÁS EVENTOS HISTÓRICOS (1839–1945) =====
   Una tabla de acontecimientos con año, mes, país protagonista y opciones. Si el país es el del jugador se le presenta como evento con decisión; si lo lleva la IA se aplica la opción
   por defecto (`ai`, índice de la opción; por defecto la 0). Cada hecho ocurre una sola vez, dentro de una ventana de años desde su fecha (así una época que empieza más tarde no
   dispara hechos ya pasados) y solo con la regla «Eventos históricos». Los efectos usan ayudantes simples (prestigio, legitimidad, radicales, tesoro, régimen, pactos, guerras). */
const E3 = {
  pres: (c, n) => { c.prestige = Math.max(0, c.prestige + n); },
  leg: (c, n) => { c.legitimacy = Math.max(0, Math.min(100, c.legitimacy + n)); },
  rad: (c, n) => { c.radicals = Math.max(0, Math.min(0.95, c.radicals + n)); },
  gold: (c, f) => { c.treasury += Math.max(30000, c.stats.income || 0) * f; },
  infl: (c, n) => { c.influence = Math.max(0, (c.influence || 0) + n); },
  pop: (c, f) => { c.states.forEach(id => { const p = G.S[id].pops; for (const k in p) p[k] *= (1 - f); }); },
  war: (att, def, n) => { if (!alive(att) || !alive(def) || G.C[att].wars.length >= 3) return; G.pacts = G.pacts.filter(p => !(p.type === 'nonagg' && ((p.a === att && p.b === def) || (p.a === def && p.b === att)))); const ids = reachableStates(att, def).slice(0, n || 2).map(x => x.id); if (ids.length) declareWar(att, def, 'conquest', ids, {free: true}); },
  pact: (a, b, t) => { if (alive(a) && alive(b) && typeof makePact === 'function') makePact(t || 'nonagg', a, b); },
  reg: (c, i) => { if (typeof applyRegime === 'function') applyRegime(c, i); }
};
const EV3 = [
  {id: 'e_opio', y: 1839, m: 6, win: 4, tag: 'GBR', icon: '🚢', title: 'La guerra del opio', text: () => 'Los comerciantes británicos exigen que China abra sus puertos al opio. La Armada puede imponerlo con cañoneras.',
    opts: [{t: 'Enviar las cañoneras', hint: '+prestigio, −legitimidad moral', fx: c => { E3.pres(c, 6); E3.gold(c, 0.4); E3.leg(c, -2); }}, {t: 'Limitarse al comercio legal', hint: '+legitimidad', fx: c => { E3.leg(c, 3); }}]},
  {id: 'e_opio_chn', y: 1839, m: 6, win: 4, tag: 'CHN', icon: '🏯', title: 'Las cañoneras británicas', text: () => 'Las potencias occidentales presionan para abrir tus puertos. Tu ejército es anticuado.',
    opts: [{t: 'Firmar un tratado desigual', hint: '−prestigio, +tesoro, −legitimidad', fx: c => { E3.pres(c, -5); E3.leg(c, -4); E3.gold(c, 0.5); }}, {t: 'Resistir', hint: '+legitimidad inicial, riesgo de derrota', fx: c => { E3.leg(c, 3); E3.pres(c, -2); E3.rad(c, 0.02); }}], ai: 0},
  {id: 'e_hambre', y: 1846, m: 9, win: 3, tag: 'GBR', icon: '🥔', title: 'La Gran Hambruna irlandesa', text: () => 'El tizón destruye la cosecha de patata en Irlanda. Los hambrientos mueren por millares.',
    opts: [{t: 'Ayuda masiva del Estado', hint: '−tesoro, +legitimidad', fx: c => { E3.gold(c, -0.5); E3.leg(c, 4); }}, {t: 'Dejar actuar al mercado', hint: '−legitimidad, +radicales', fx: c => { E3.leg(c, -5); E3.rad(c, 0.03); E3.pop(c, 0.004); }}], ai: 1},
  {id: 'e_cipayos', y: 1857, m: 5, win: 4, tag: 'GBR', icon: '🐘', title: 'La rebelión de los cipayos', text: () => 'Los soldados indios se amotinan contra la Compañía de las Indias Orientales.',
    opts: [{t: 'Reprimir y asumir el gobierno directo', hint: '+prestigio, −tesoro', fx: c => { E3.pres(c, 4); E3.gold(c, -0.3); }}, {t: 'Reformas y concesiones', hint: '+legitimidad', fx: c => { E3.leg(c, 4); E3.pres(c, -1); }}]},
  {id: 'e_siervos', y: 1861, m: 3, win: 6, tag: 'RUS', icon: '🌾', title: 'La emancipación de los siervos', text: () => 'El zar considera abolir la servidumbre de la gleba. Los nobles se oponen con fuerza.',
    opts: [{t: 'Decretar la emancipación', hint: '+legitimidad y alfabetización, −apoyo de la nobleza', fx: c => { E3.leg(c, 5); E3.rad(c, -0.04); E3.pres(c, 3); c.lit = Math.min(95, (c.lit || 0) + 3); }}, {t: 'Posponerla', hint: '+radicales', fx: c => { E3.rad(c, 0.05); E3.leg(c, -2); }}]},
  {id: 'e_dual', y: 1867, m: 3, win: 4, tag: 'AUS', icon: '🏰', title: 'El Compromiso austro-húngaro', text: () => 'Los magiares exigen igualdad con los austríacos. Una monarquía dual podría salvar el imperio.',
    opts: [{t: 'Aceptar la monarquía dual', hint: '+legitimidad, −radicales', fx: c => { E3.leg(c, 8); E3.rad(c, -0.05); E3.pres(c, 2); }}, {t: 'Mantener el centralismo', hint: '+radicales, +ejército', fx: c => { E3.rad(c, 0.05); E3.leg(c, -3); }}]},
  {id: 'e_comuna', y: 1871, m: 3, win: 3, tag: 'FRA', icon: '🚩', title: 'La Comuna de París', text: () => 'Tras la derrota, los obreros parisinos se alzan y proclaman la Comuna.',
    opts: [{t: 'Aplastarla', hint: '−radicales, −legitimidad', fx: c => { E3.rad(c, -0.06); E3.leg(c, -3); }}, {t: 'Negociar', hint: '+legitimidad, +radicales', fx: c => { E3.leg(c, 3); E3.rad(c, 0.04); }}]},
  {id: 'e_depre73', y: 1873, m: 5, win: 4, all: true, rankMax: 14, icon: '📉', title: 'La Gran Depresión de 1873', text: () => 'El pánico bursátil arrastra a la banca y a la industria. Los precios caen y el paro crece.',
    opts: [{t: 'Austeridad y patrón oro', hint: '+tesoro, −legitimidad', fx: c => { E3.gold(c, 0.2); E3.leg(c, -4); E3.rad(c, 0.02); }}, {t: 'Estímulo público', hint: '−tesoro, +legitimidad', fx: c => { E3.gold(c, -0.4); E3.leg(c, 3); }}], ai: 0},
  {id: 'e_berlin', y: 1884, m: 11, win: 3, tags: ['GBR', 'FRA', 'PRU', 'SAR', 'POR', 'BEL', 'NET', 'SPA'], icon: '🌍', title: 'La Conferencia de Berlín', text: () => 'Las potencias se reparten África. Puedes reclamar tu parte de ultramar.',
    opts: [{t: 'Reclamar colonias', hint: '+prestigio e influencia', fx: c => { E3.pres(c, 5); E3.infl(c, 40); }}, {t: 'Mantenerte al margen', hint: '+tesoro', fx: c => { E3.gold(c, 0.2); }}]},
  {id: 'e_cuba', y: 1898, m: 4, win: 3, tag: 'USA', icon: '💥', title: 'El hundimiento del Maine', text: () => 'Un acorazado norteamericano estalla en La Habana. La prensa pide guerra contra España.',
    opts: [{t: 'Declarar la guerra a España', hint: 'Guerra por Cuba y Filipinas', fx: () => E3.war('USA', 'SPA', 3)}, {t: 'Calmar los ánimos', hint: '−prestigio', fx: c => { E3.pres(c, -2); }}], ai: 0, req: () => alive('SPA')},
  {id: 'e_boxer', y: 1900, m: 6, win: 3, tag: 'CHN', icon: '🥋', title: 'La rebelión de los bóxers', text: () => 'Una sociedad secreta ataca a los extranjeros. La corte duda si apoyarla.',
    opts: [{t: 'Apoyar a los bóxers', hint: '+radicales satisfechos, −prestigio exterior', fx: c => { E3.rad(c, -0.03); E3.pres(c, -6); }}, {t: 'Reprimirla', hint: '+prestigio, −legitimidad', fx: c => { E3.pres(c, 2); E3.leg(c, -4); }}]},
  {id: 'e_entente', y: 1904, m: 4, win: 3, tag: 'GBR', icon: '🤝', title: 'La Entente Cordiale', text: () => 'Francia y Gran Bretaña resuelven sus disputas coloniales y se acercan frente a Alemania.',
    opts: [{t: 'Firmar la Entente', hint: 'Pacto de no agresión con Francia', fx: c => { E3.pact('GBR', 'FRA', 'nonagg'); E3.pres(c, 2); }}, {t: 'Esperar', hint: 'Sin cambios', fx: () => { }}], req: () => alive('FRA')},
  {id: 'e_rus05', y: 1905, m: 1, win: 3, tag: 'RUS', icon: '❄️', title: 'El Domingo Sangriento', text: () => 'La guardia dispara contra una manifestación pacífica ante el Palacio de Invierno. Huelgas y motines estallan.',
    opts: [{t: 'El Manifiesto de Octubre', hint: '+legitimidad, −prestigio', fx: c => { E3.leg(c, 5); E3.rad(c, -0.05); E3.pres(c, -3); }}, {t: 'Reprimir', hint: '+radicales, −legitimidad', fx: c => { E3.rad(c, 0.04); E3.leg(c, -4); }}], ai: 0},
  {id: 'e_xinhai', y: 1911, m: 10, win: 3, tag: 'CHN', icon: '🏛️', title: 'La revolución Xinhai', text: () => 'Los levantamientos republicanos derriban la autoridad de la dinastía Qing.',
    opts: [{t: 'Aceptar la república', hint: 'Cambio de régimen; +legitimidad', fx: c => { E3.reg(c, 'republican'); E3.leg(c, 5); E3.rad(c, -0.03); }}, {t: 'Resistir', hint: '−legitimidad, +radicales', fx: c => { E3.leg(c, -10); E3.rad(c, 0.06); }}], ai: 0},
  {id: 'e_sarajevo', y: 1914, m: 7, win: 2, tag: 'AUS', icon: '🔫', title: 'El atentado de Sarajevo', text: () => 'El archiduque heredero ha sido asesinado por un nacionalista serbio. Viena puede enviar un ultimátum.',
    opts: [{t: 'Ultimátum y guerra contra Serbia', hint: 'Guerra; puede activar alianzas', fx: () => E3.war('AUS', 'SER', 3)}, {t: 'Moderación', hint: '−prestigio', fx: c => { E3.pres(c, -4); }}], ai: 0, req: () => alive('SER')},
  {id: 'e_rus17', y: 1917, m: 3, win: 2, tag: 'RUS', icon: '🚩', title: 'La Revolución de Febrero', text: () => 'El hambre, las derrotas y el hartazgo sacuden Petrogrado. El zar pierde el control de la capital.',
    opts: [{t: 'Gobierno provisional', hint: '−legitimidad, −radicales', fx: c => { E3.leg(c, -15); E3.rad(c, 0.03); }}, {t: 'Mantener la autocracia', hint: '−legitimidad, +radicales', fx: c => { E3.leg(c, -25); E3.rad(c, 0.12); }}], ai: 1},
  {id: 'e_gripe', y: 1918, m: 9, win: 2, all: true, rankMax: 40, icon: '🦠', title: 'La gripe de 1918', text: () => 'Una pandemia de gripe recorre el mundo y colapsa hospitales y fábricas.',
    opts: [{t: 'Cuarentenas y hospitales', hint: '−tesoro, −mortalidad', fx: c => { E3.gold(c, -0.2); E3.pop(c, 0.006); E3.leg(c, 1); }}, {t: 'Seguir trabajando', hint: '+mortalidad, −legitimidad', fx: c => { E3.pop(c, 0.014); E3.leg(c, -3); }}], ai: 0},
  {id: 'e_versalles', y: 1919, m: 6, win: 2, tag: 'PRU', icon: '📜', title: 'El Tratado de Versalles', text: () => 'Los vencedores imponen la paz: reparaciones, pérdidas territoriales y la cláusula de culpa.',
    opts: [{t: 'Aceptar', hint: '−prestigio, −legitimidad', fx: c => { E3.pres(c, -8); E3.leg(c, -5); E3.rad(c, 0.03); }}, {t: 'Protestar y rearmarse en secreto', hint: '+radicales, +ejército', fx: c => { E3.rad(c, 0.04); E3.pres(c, -3); }}], ai: 0, req: () => G.C.PRU.states.length > 0},
  {id: 'e_roma', y: 1922, m: 10, win: 3, tag: 'SAR', icon: '🦅', title: 'La Marcha sobre Roma', text: () => 'Miles de camisas negras marchan hacia la capital. El rey puede ceder el poder a Mussolini.',
    opts: [{t: 'Ceder el poder', hint: 'Régimen fascista', fx: c => { E3.reg(c, 'fascist'); E3.leg(c, -2); E3.pres(c, 3); }}, {t: 'Resistir con el ejército', hint: '+legitimidad', fx: c => { E3.leg(c, 3); E3.rad(c, 0.04); }}], ai: 0},
  {id: 'e_hiper', y: 1923, m: 11, win: 2, tag: 'PRU', icon: '💸', title: 'La hiperinflación', text: () => 'El marco no vale nada; el pan cuesta millones. Las clases medias lo pierden todo.',
    opts: [{t: 'Reforma monetaria severa', hint: '+tesoro, −legitimidad corta', fx: c => { E3.gold(c, 0.1); E3.leg(c, -3); E3.rad(c, -0.02); }}, {t: 'Seguir imprimiendo', hint: '+radicales', fx: c => { E3.rad(c, 0.06); E3.leg(c, -6); }}], ai: 0},
  {id: 'e_crac29', y: 1929, m: 10, win: 2, all: true, rankMax: 20, icon: '📉', title: 'El Crac del 29', text: () => 'La Bolsa de Nueva York se derrumba. La crisis se extiende por el mundo industrial.',
    opts: [{t: 'Austeridad', hint: '+tesoro, +paro, −legitimidad', fx: c => { E3.gold(c, 0.2); E3.leg(c, -6); E3.rad(c, 0.05); }}, {t: 'Obras públicas y estímulo', hint: '−tesoro, +legitimidad', fx: c => { E3.gold(c, -0.5); E3.leg(c, 4); E3.rad(c, -0.02); }}], ai: 0},
  {id: 'e_nazi', y: 1933, m: 1, win: 3, tag: 'PRU', icon: '🦅', title: 'El ascenso del nazismo', text: () => 'Con el paro masivo, un partido extremista gana las elecciones y exige el poder.',
    opts: [{t: 'Entregar el poder', hint: 'Régimen fascista; +ejército', fx: c => { E3.reg(c, 'fascist'); E3.pres(c, 4); E3.leg(c, -2); }}, {t: 'Defender la república', hint: '−legitimidad, +radicales', fx: c => { E3.leg(c, -5); E3.rad(c, 0.05); }}], ai: 0},
  {id: 'e_spa36', y: 1936, m: 7, win: 2, tag: 'SPA', icon: '⚔️', title: 'El alzamiento militar', text: () => 'Una parte del ejército se subleva contra el gobierno. España se parte en dos.',
    opts: [{t: 'Plantar cara', hint: 'Guerra civil', fx: () => { if (alive('SPA') && G.C.SPA.states.length >= 6 && typeof startCivilWar === 'function') startCivilWar('SPA', {name: 'Bando Nacional', adj: 'nacionalista', frac: 0.42}); }}], ai: 0},
  {id: 'e_anschluss', y: 1938, m: 3, win: 2, tag: 'PRU', icon: '🦅', title: 'El Anschluss', text: () => 'Alemania puede absorber Austria, de lengua alemana, ante el temor de las potencias.',
    opts: [{t: 'Anexar Austria', hint: '+prestigio; Austria pasa a ser vasalla', fx: c => { if (alive('AUS') && !G.C.AUS.overlord) makeSubject('PRU', 'AUS'); E3.pres(c, 6); E3.infl(c, -20); }}, {t: 'Respetar su independencia', hint: '+legitimidad', fx: c => { E3.leg(c, 2); }}], ai: 0, req: () => alive('AUS') && !hostileTags('PRU', 'AUS')},
  {id: 'e_molotov', y: 1939, m: 8, win: 2, tag: 'RUS', icon: '📃', title: 'El pacto Mólotov–Ribbentrop', text: () => 'Berlín propone un pacto de no agresión con reparto de influencias en Europa oriental.',
    opts: [{t: 'Firmar el pacto', hint: 'No agresión con Alemania; +prestigio', fx: c => { E3.pact('RUS', 'PRU', 'nonagg'); E3.pres(c, 3); }}, {t: 'Rechazarlo', hint: 'Sin cambios', fx: () => { }}], ai: 0, req: () => alive('PRU')},
  {id: 'e_suez', y: 1869, m: 11, win: 4, tags: ['FRA', 'GBR', 'OTT', 'EGY'], icon: '🚢', title: 'La apertura del canal de Suez', text: () => 'El canal une el Mediterráneo y el mar Rojo: las rutas a Asia se acortan semanas y los puertos se llenan de vapores.',
    opts: [{t: 'Invertir en puertos y astilleros', hint: '−tesoro, +prestigio, mejores bases navales', fx: c => { E3.gold(c, -0.25); E3.pres(c, 3); c.states.forEach(id => { const s = G.S[id]; if (s.b.navalbase !== undefined && s.cap.navalbase > 0) s.b.navalbase = Math.min(s.cap.navalbase, s.b.navalbase + 0.3); }); }}, {t: 'Cobrar peajes', hint: '+tesoro', fx: c => { E3.gold(c, 0.4); }}], ai: 1},
  {id: 'e_meiji', y: 1868, m: 1, win: 4, tag: 'JAP', icon: '🏯', title: 'La Restauración Meiji', text: () => 'El emperador recupera el poder y la élite decide copiar a Occidente: ejército, flota, escuelas y fábricas.',
    opts: [{t: 'Modernizar el ejército y la flota', hint: '+prestigio, −tesoro', fx: c => { E3.pres(c, 6); E3.gold(c, -0.3); }}, {t: 'Reformar la educación y la industria', hint: '+alfabetización, +legitimidad', fx: c => { E3.leg(c, 4); c.lit = Math.min(95, (c.lit || 0) + 4); }}]},
  {id: 'e_tsushima', y: 1905, m: 5, win: 3, tags: ['JAP', 'RUS'], icon: '⚓', title: 'La batalla de Tsushima', text: () => 'Las escuadras de Rusia y Japón se encuentran en el estrecho. De las flotas depende el control del mar.',
    opts: [{t: 'Reforzar el prestigio naval', hint: '+prestigio', fx: c => { E3.pres(c, 4); }}, {t: 'Pedir la paz', hint: '+legitimidad', fx: c => { E3.leg(c, 3); }}]},
  {id: 'e_dread', y: 1906, m: 2, win: 4, tags: ['GBR', 'PRU', 'USA', 'JAP', 'FRA'], icon: '🛳️', title: 'La carrera de acorazados', text: () => 'El Dreadnought deja anticuadas a todas las flotas. Las potencias compiten por construir más y mejores buques.',
    opts: [{t: 'Entrar en la carrera', hint: '−tesoro, +prestigio', fx: c => { E3.gold(c, -0.3); E3.pres(c, 4); }}, {t: 'Invertir en submarinos y destructores', hint: '+prestigio moderado', fx: c => { E3.gold(c, -0.15); E3.pres(c, 2); }}], ai: 0},
  {id: 'e_panama', y: 1914, m: 8, win: 3, tag: 'USA', icon: '🌐', title: 'La apertura del canal de Panamá', text: () => 'El canal une los dos océanos: la flota del Atlántico puede llegar al Pacífico en días.',
    opts: [{t: 'Fortificar el canal', hint: '−tesoro, +prestigio', fx: c => { E3.gold(c, -0.2); E3.pres(c, 4); }}, {t: 'Abrirlo al comercio', hint: '+tesoro', fx: c => { E3.gold(c, 0.35); }}]},
  {id: 'e_uboat', y: 1915, m: 2, win: 3, tag: 'PRU', icon: '🐟', title: 'La guerra submarina sin restricciones', text: () => 'El Estado Mayor propone hundir sin aviso a todo buque que se acerque a las islas británicas.',
    opts: [{t: 'Autorizarla', hint: '+prestigio militar, −legitimidad internacional', fx: c => { E3.pres(c, 3); E3.leg(c, -3); }}, {t: 'Mantener las restricciones', hint: '+legitimidad', fx: c => { E3.leg(c, 3); }}], ai: 0},
  {id: 'e_wash', y: 1922, m: 2, win: 3, tags: ['USA', 'GBR', 'JAP'], icon: '⚖️', title: 'La Conferencia Naval de Washington', text: () => 'Las grandes potencias discuten limitar el tonelaje de sus flotas para evitar una nueva carrera naval.',
    opts: [{t: 'Aceptar los límites', hint: '+legitimidad, +tesoro', fx: c => { E3.leg(c, 3); E3.gold(c, 0.2); }}, {t: 'Rechazarlos', hint: '+prestigio, −legitimidad', fx: c => { E3.pres(c, 3); E3.leg(c, -2); }}], ai: 0},
  {id: 'e_blitz', y: 1940, m: 5, win: 3, tag: 'GBR', icon: '🛡️', title: 'El Blitz y la batalla del Atlántico', text: () => 'Bombarderos sobre las ciudades y submarinos sobre los convoyes: la isla depende de sus escoltas.',
    opts: [{t: 'Priorizar las escoltas', hint: '+legitimidad, −tesoro', fx: c => { E3.leg(c, 3); E3.gold(c, -0.2); }}, {t: 'Priorizar los cazas', hint: '+prestigio', fx: c => { E3.pres(c, 3); E3.rad(c, 0.01); }}]},
  {id: 'e_bloqueo', y: 1914, m: 9, win: 6, tags: ['GBR', 'PRU'], icon: '🚧', title: 'El bloqueo y el hambre', text: () => 'El cerco naval estrangula el comercio exterior: faltan alimentos y materias primas en las ciudades.',
    opts: [{t: 'Racionar y comprar en el extranjero', hint: '−tesoro, +legitimidad', fx: c => { E3.gold(c, -0.3); E3.leg(c, 3); c.scarc = Math.max(0, (c.scarc || 0) - 0.15); }}, {t: 'Aguantar', hint: '−legitimidad, +radicales', fx: c => { E3.leg(c, -3); E3.rad(c, 0.03); }}], ai: 0},
  {id: 'e_mexico', y: 1862, m: 5, win: 4, tag: 'FRA', icon: '🦅', title: 'La aventura mexicana', text: () => 'Napoleón III sueña con un imperio latino en México. El coste puede ser enorme.',
    opts: [{t: 'Enviar el cuerpo expedicionario', hint: '−tesoro, +prestigio', fx: c => { E3.gold(c, -0.3); E3.pres(c, 4); }}, {t: 'Desistir', hint: '+legitimidad', fx: c => { E3.leg(c, 2); }}], ai: 1},
  {id: 'e_transiberiano', y: 1891, m: 5, win: 4, tag: 'RUS', icon: '🚂', title: 'El ferrocarril Transiberiano', text: () => 'Una vía de miles de kilómetros unirá Moscú con el Pacífico y acelerará las tropas hacia el este.',
    opts: [{t: 'Financiarlo con deuda', hint: '−tesoro, +infraestructura', fx: c => { E3.gold(c, -0.35); c.states.forEach(id => { const s = G.S[id]; s.infra = Math.min(10, (s.infra || 0) + 0.5); }); E3.pres(c, 3); }}, {t: 'Aplazarlo', hint: '+tesoro', fx: c => { E3.gold(c, 0.15); }}]},
  {id: 'e_zollverein', y: 1834, m: 1, win: 12, tag: 'PRU', icon: '🧾', title: 'El Zollverein', text: () => 'La unión aduanera alemana quita barreras al comercio y crea un mercado común bajo liderazgo prusiano.',
    opts: [{t: 'Ampliar la unión', hint: '+prestigio, +tesoro', fx: c => { E3.pres(c, 3); E3.gold(c, 0.25); }}, {t: 'Mantenerla como está', hint: '+legitimidad', fx: c => { E3.leg(c, 1); }}]}
];
EV3.forEach(d => { if (typeof EVENTS !== 'undefined') EVENTS.push({id: 'h_' + d.id, icon: d.icon, title: d.title, w: 0, cond: () => false, text: d.text, opts: d.opts}); });
function ev3Month() {
  if (!G.eventCool || !rule('hist')) return; const y = G.date.y, m = G.date.m;
  EV3.forEach(d => {
    if (histDone(d.id) || y < d.y || (y === d.y && m < d.m) || y > d.y + (d.win || 3)) return;
    const tags = d.all ? G.tags.filter(t => t !== NONE && alive(t) && G.C[t].states.length && G.C[t].rank <= (d.rankMax || 20)) : (d.tags || [d.tag]).filter(t => G.C[t] && alive(t));
    if (d.req && !d.req()) return; if (!tags.length) return;
    const P = G.player, doPlayer = tags.includes(P) && !G.pendingEvent;
    if (tags.includes(P) && !doPlayer) return;                       // espera a que se resuelva el evento pendiente
    if (!d.all && Math.random() > 0.35 && !(y > d.y || m > d.m)) return;   // pequeña variación de fecha
    histMark(d.id);
    tags.forEach(t => { const c = G.C[t]; if (t === P) { histNotifyPlayer('h_' + d.id, c, null); } else if (c.ai) { try { d.opts[d.ai || 0].fx(c, null); recalcMods(c); } catch (e) { console.warn('ev3', d.id, e); } } });
    if (!tags.includes(P)) notify('event', `${d.icon} ${d.title}`);
  });
}
const _histMonthE3 = histMonth;
histMonth = function () { _histMonthE3(); try { ev3Month(); } catch (e) { console.warn('ev3', e); } };
