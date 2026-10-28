/* ===== MANUAL DEL JUEGO ===== */
const MANUAL = [
{id: 'intro', title: '1. Introducción', html: `
<p>Gobiernas un país en el año <b>1836</b>, en plena Revolución Industrial. Tu misión es hacer prosperar a tu pueblo, modernizar la economía, mantener el apoyo de los grupos poderosos de tu sociedad y defender (o ampliar) tus fronteras durante un siglo de cambios.</p>
<p>No hay una única forma de ganar: puedes convertirte en la primera potencia industrial, en un imperio colonial, en una república liberal educada, en un régimen militar o en un pequeño país próspero que sobrevive a los gigantes. El juego te mide con el <b>prestigio</b>, el <b>rango</b> entre las potencias y los <b>objetivos del diario</b>.</p>
<h4>Los pilares del juego</h4>
<ul>
<li><b>Economía:</b> un mercado mundial con 18 bienes, precios que suben y bajan, edificios que dan empleo y crisis periódicas.</li>
<li><b>Población:</b> 11 profesiones con necesidades propias, nivel de vida, alfabetización y radicalismo.</li>
<li><b>Política:</b> leyes, grupos de interés, legitimidad, ideologías y cambios de régimen.</li>
<li><b>Tecnología:</b> tres eras con más de 70 avances, doctrinas excluyentes y mejoras que caducan.</li>
<li><b>Diplomacia y guerra:</b> pactos, alianzas, bloques, vasallos, casus belli con territorios a elegir y frentes que avanzan sobre el mapa.</li>
</ul>`},

{id: 'start', title: '2. Primeros pasos', html: `
<ol>
<li>En la pantalla de inicio elige un <b>país</b> (puedes buscarlo por nombre) y una <b>dificultad económica</b>. Los países grandes son más fáciles; los pequeños y atrasados, más difíciles.</li>
<li>Pulsa <b>Comenzar partida</b>. El juego arranca <b>en pausa</b>: pulsa ▶ o la barra espaciadora para que corra el tiempo.</li>
<li>Revisa el <b>Presupuesto</b> (💷): comprueba que tus ingresos cubren los gastos y decide tus impuestos.</li>
<li>Abre <b>Tecnología</b> (💡) y elige qué investigar. Mientras no elijas nada, tus puntos de innovación se acumulan.</li>
<li>Haz clic en tu <b>capital</b> y construye <b>Administración</b> (para recaudar más), <b>Universidades</b> (innovación) y edificios productivos donde falte oferta.</li>
<li>Vigila las <b>Crisis</b>, tus <b>grupos de interés</b> y los <b>países vecinos</b>: la diplomacia es tan importante como el ejército.</li>
</ol>
<p>La partida se <b>autoguarda cada 1 de enero</b>. Además puedes guardar y cargar manualmente con 💾 y 📂 (se almacena en tu navegador).</p>`},

{id: 'ui', title: '3. La interfaz', html: `
<h4>Placa superior izquierda</h4>
<table class="tbl"><tbody>
<tr><td>💰 Tesoro</td><td>Dinero del Estado. Si baja de cero, entras en deuda y pagas intereses.</td></tr>
<tr><td>⚖️ Balance</td><td>Ingresos menos gastos por semana. En rojo si pierdes dinero.</td></tr>
<tr><td>🏆 Prestigio</td><td>Tu peso internacional. Sube ganando guerras, cumpliendo objetivos y con buenos resultados; permite fundar bloques y reclamar más territorios.</td></tr>
<tr><td>🕊️ Influencia</td><td>Moneda política: se gasta en reformas, diplomacia, patrocinios, colonización y declaraciones de guerra. Se recupera sola cada semana.</td></tr>
<tr><td>💡 Innovación</td><td>Puntos acumulados (y entre paréntesis lo que generas por semana).</td></tr>
<tr><td>🏛️ Legitimidad</td><td>Apoyo al gobierno. Por debajo del 40% crece el malestar; si se mantiene baja puede estallar una revolución.</td></tr>
<tr><td>👥 Población · 🍞 Nivel de vida</td><td>Habitantes totales y nivel de vida medio (0 a 25).</td></tr>
<tr><td>📉 Crisis · ✉️ Propuestas</td><td>Número de crisis activas y de propuestas diplomáticas pendientes. Pulsa para abrir el detalle.</td></tr>
</tbody></table>
<h4>Fecha y velocidad</h4><p>Arriba a la derecha: pausa, la fecha y 5 barras de velocidad. <b>Espacio</b> pausa; las teclas <b>,</b> y <b>.</b> cambian la velocidad.</p>
<h4>Menú inferior</h4><p>Ocho botones: Presupuesto, Producción y mercado, Población, Política, Tecnología, Diplomacia, Ejército y guerra, Construcción. A la derecha: 🔍 buscador, 💾 guardar, 📂 cargar, 📜 diario y 📖 este manual.</p>
<h4>Minimapa y modos de mapa</h4><p>Abajo a la derecha. Haz clic en el minimapa para saltar a cualquier punto. Los botones circulares cambian el modo de mapa: político, terreno, población, nivel de vida, alfabetización, prosperidad, malestar, relaciones y <b>bloques y alianzas</b>.</p>
<h4>Buscador</h4><p>Pulsa 🔍, <b>Ctrl+K</b> o <b>/</b> y escribe el nombre de un país o de un estado para saltar a él. En Diplomacia y en la pantalla de inicio hay además un buscador de países en la propia lista.</p>
<h4>Avisos</h4><p>Los mensajes aparecen arriba a la derecha. Si pulsas uno que menciona un lugar, el mapa se centra allí. Algunos eventos detienen el juego y te piden una decisión.</p>`},

{id: 'map', title: '4. El mapa y la cámara', html: `
<table class="tbl"><tbody>
<tr><td>Desplazarse</td><td>Arrastra con el botón izquierdo del ratón, o usa <b>W A S D</b> / flechas. En pantallas táctiles, arrastra con un dedo.</td></tr>
<tr><td>Zoom</td><td>Rueda del ratón (acerca hacia el cursor), teclas <b>+</b> / <b>-</b>, <b>doble clic</b> (acerca; con Mayús aleja), los botones <b>＋ －</b> del lateral derecho o, en táctil/panel táctil, el <b>gesto de pellizco</b>.</td></tr>
<tr><td>Rueda = desplazar</td><td>Si usas un panel táctil y prefieres desplazarte con dos dedos, pulsa el botón 🖱️/🖐️ del lateral: la rueda pasa a mover el mapa (el pellizco sigue haciendo zoom).</td></tr>
<tr><td>Bordes de pantalla</td><td>El botón ⇱ activa el desplazamiento al acercar el ratón al borde de la ventana.</td></tr>
<tr><td>Vista inicial</td><td>Botón 🏠. Los botones ⟲ ⟳ giran y ⤒ ⤓ inclinan la cámara.</td></tr>
<tr><td>Girar e inclinar</td><td>Botón derecho + arrastrar (o <b>Mayús</b> + arrastrar); teclas <b>Q E</b> (girar) y <b>R F</b> (inclinar).</td></tr>
<tr><td>Seleccionar un estado</td><td>Clic. Abre el panel con población, nivel de vida, edificios y recursos.</td></tr>
<tr><td>Información rápida</td><td>Pasa el ratón sobre un estado para ver un resumen.</td></tr>
</tbody></table>
<p>El mapa se genera de forma procedural: continentes, relieve y biomas aproximados del mundo de 1836, con 272 estados. Las etiquetas de países aparecen alejado y las de estados al acercarte.</p>
<h4>Frentes de guerra</h4><p>Durante una guerra, los territorios en disputa muestran una <b>franja rayada</b> con el color del ocupante y una <b>línea de frente</b> amarilla y roja que avanza conforme cambia la puntuación de la guerra. Se ve en cualquier modo de mapa.</p>`},

{id: 'states', title: '5. Estados, edificios y construcción', html: `
<p>Cada estado tiene población, recursos y una <b>capacidad</b> máxima de cada tipo de edificio. En el panel (clic sobre el estado) verás cada edificio con su nivel actual y su capacidad (<i>nivel / capacidad</i>), y el valor añadido (VA) por nivel.</p>
<h4>Tipos de edificios</h4>
<ul>
<li><b>Agricultura y plantaciones</b> (granjas, ranchos, azúcar, té, café, tabaco, algodón, huertos): emplean campesinos y producen alimentos y materias primas.</li>
<li><b>Extracción</b> (pesca, aserraderos, minas de hierro y carbón): emplean obreros.</li>
<li><b>Industria</b> (textiles, ropa, muebles, herramientas, destilerías, acerías): transforman insumos en bienes de consumo e industriales. Las acerías requieren <i>Alto Horno</i>.</li>
<li><b>Infraestructura</b>: Sector de la Construcción (acelera las obras) y Ferrocarriles (aumentan la producción del estado; requieren la tecnología).</li>
<li><b>Gobierno</b>: Administración (recaudación), Cuarteles (soldados) y Universidades (innovación).</li>
</ul>
<h4>Cómo construir</h4>
<ol><li>Pulsa el botón <b>＋</b> junto al edificio. Entra en la <b>cola de construcción pública</b>.</li>
<li>Cada semana se reparten tus <b>puntos de construcción</b> entre los proyectos en orden; cada punto cuesta dinero (el precio depende de la dificultad y del tamaño de tu país).</li>
<li>Pásate por <b>Construcción</b> (🏗️) para ver la cola, cancelar proyectos y ver la inversión privada.</li></ol>
<p>Además, los <b>capitalistas</b> invierten por su cuenta: crean proyectos privados donde el beneficio es mayor. Las leyes económicas (laissez-faire, intervencionismo…) y las tecnologías como las <i>Sociedades Anónimas</i> aumentan esta inversión. Las crisis financieras la hunden.</p>`},

{id: 'economy', title: '6. Economía y mercado', html: `
<h4>El mercado mundial</h4>
<p>Existen 18 bienes: alimentos (cereales, carne, pescado, fruta, azúcar), lujos (té, café, tabaco, licores), materias primas (madera, hierro, carbón, fibras) e industriales (tejidos, ropa, muebles, herramientas, acero). Todos los países comercian en un <b>mercado único</b>.</p>
<ul>
<li>El <b>precio</b> sube cuando la demanda supera a la oferta y baja cuando sobra producción. Se mueve poco a poco, día a día, y tiende a volver al precio base.</li>
<li>Si falta un bien (<i>déficit</i>), se <b>raciona</b>: los consumidores y las fábricas reciben solo una parte. Los edificios sin insumos producen menos.</li>
<li>En <b>Producción y mercado</b> ves el precio, su tendencia, la producción mundial, la demanda y el balance de cada bien.</li>
</ul>
<h4>Cómo funciona un edificio</h4>
<ol><li>Necesita trabajadores de una profesión concreta; si faltan, produce menos.</li>
<li>Consume insumos (las fábricas) a los precios de mercado y vende su producción.</li>
<li>El <b>valor añadido</b> (ingresos menos insumos) se reparte: ~65% para salarios y ~35% para los propietarios (aristócratas en el campo, capitalistas en la industria). La legislación laboral modifica este reparto.</li>
<li>Cada edificio ajusta su <b>utilización</b> según su beneficio: si el precio de su producto sube, emplea y produce más; si cae, recorta.</li>
</ol>
<h4>Economía en tiempo real</h4>
<p>Los cálculos económicos se reparten a lo largo de la semana en varias etapas (personal, demanda, producción, precios y presupuesto), de modo que no hay saltos bruscos: los precios, la inversión y las finanzas evolucionan continuamente día a día.</p>
<h4>Ciclo económico</h4>
<p>El consumo mundial oscila un ±5% en un ciclo de unos nueve años. En fase de <b>recesión</b> aumenta la probabilidad de crisis. Puedes verlo en <b>Producción y mercado → Crisis y ciclo</b>.</p>
<h4>Consejos</h4>
<ul><li>Si un bien está en déficit y su precio sube, <b>construir</b> su edificio es rentable.</li>
<li>La industria necesita mano de obra: construye en estados con población desempleada.</li>
<li>El <b>ferrocarril</b> y la infraestructura aumentan la producción de un estado.</li>
<li>No dependas de un solo sector: un mal año agrícola o una crisis de materias primas puede arruinar a quien lo hace.</li></ul>`},

{id: 'crises', title: '7. Crisis económicas y dificultad', html: `
<p>La economía es inestable. Existen crisis <b>mundiales</b> (afectan a todos, aunque los países con <i>Banco Central</i> y <i>Economía Mixta</i> las sufren menos) y <b>nacionales</b>.</p>
<table class="tbl"><thead><tr><th>Crisis</th><th>Alcance</th><th>Efecto</th></tr></thead><tbody>
<tr><td>📉 Pánico financiero</td><td>Mundial</td><td>La inversión cae a menos de la mitad, el crédito se encarece y el consumo baja.</td></tr>
<tr><td>🌾 Malas cosechas</td><td>Mundial</td><td>−20% de producción agrícola y alimentos más caros.</td></tr>
<tr><td>🏚️ Gran depresión</td><td>Mundial</td><td>Tras un pánico: años de poco consumo, industria e inversión.</td></tr>
<tr><td>🎈 Burbuja especulativa</td><td>Mundial</td><td>Estalla la especulación ferroviaria: menos inversión y crédito caro.</td></tr>
<tr><td>⛏️ Crisis de materias primas</td><td>Mundial</td><td>Carbón y hierro se disparan de precio.</td></tr>
<tr><td>💱 Crisis monetaria</td><td>Nacional</td><td>Con una deuda de más de ~26 semanas de ingresos: intereses altísimos y menos consumo.</td></tr>
<tr><td>🏦 Bancarrota</td><td>Nacional</td><td>Con una deuda de más de ~70 semanas de ingresos: pierdes prestigio, se reinicia la deuda y la economía se contrae.</td></tr>
<tr><td>✊ Huelga general</td><td>Nacional</td><td>Si hay muchos radicales y fábricas: la industria se paraliza.</td></tr>
<tr><td>☣️ Epidemia · 💀 Hambruna</td><td>Nacional</td><td>Mueren habitantes y cae el consumo. Habrá una hambruna histórica de la patata hacia 1845.</td></tr>
</tbody></table>
<h4>Cómo responder</h4>
<p>En <b>Producción y mercado → Crisis y ciclo</b> puedes aplicar: <b>Rescate bancario</b> (5 semanas de ingresos: acorta las crisis financieras), <b>Plan de estímulo</b> (3 semanas: más consumo e inversión 8 meses) o <b>Austeridad</b> (ganas 2 semanas de ingresos pero aumenta el malestar y los impuestos).</p>
<p>Prevención: mantén la deuda baja, investiga <i>Banco Central</i> y <i>Economía Mixta</i> y diversifica tu economía.</p>
<h4>Niveles de dificultad</h4>
<table class="tbl"><thead><tr><th></th><th>Crisis</th><th>Coste de construcción</th><th>Recaudación</th><th>Intereses</th></tr></thead><tbody>
<tr><td>Relajada</td><td>×0,5</td><td>×0,8</td><td>+6%</td><td>×0,7</td></tr>
<tr><td>Normal</td><td>×1</td><td>×1,25</td><td>—</td><td>×1</td></tr>
<tr><td>Difícil</td><td>×1,7</td><td>×1,7</td><td>−7%</td><td>×1,5</td></tr>
<tr><td>Brutal</td><td>×2,6</td><td>×2,3</td><td>−15%</td><td>×2,2</td></tr>
</tbody></table><p class="hint">Los precios además son más volátiles en las dificultades altas. La IA no recibe bonificaciones.</p>`},

{id: 'pops', title: '8. Población y nivel de vida', html: `
<p>Cada estado tiene grupos de población por <b>profesión</b>, agrupados en tres <b>estratos</b>: clase alta (aristócratas, capitalistas), clase media (clero, oficiales, burócratas, tenderos, oficinistas, maquinistas) y clase baja (obreros, campesinos, soldados).</p>
<ul>
<li>Los trabajadores ocupan los puestos que ofrecen los edificios. Los <b>campesinos</b> trabajan el campo; los <b>obreros</b> la extracción y la industria; los <b>maquinistas</b> las fábricas.</li>
<li>Los que no encuentran empleo viven de la <b>subsistencia</b> (ingresos muy bajos). El <b>paro urbano</b> (obreros sin trabajo) se ve en el panel de estado.</li>
<li>Cada grupo gasta sus ingresos en una <b>escalera de necesidades</b>: primero cereales, madera y tejidos; después pescado, carne, ropa; luego fruta, azúcar, carbón, licores, muebles, té, tabaco, café y herramientas. Cuantos más escalones alcance, más alto es su <b>nivel de vida</b> (0–25).</li>
<li>Con buen nivel de vida la población <b>crece</b>; con hambre decrece. La <b>alfabetización</b> aumenta con las leyes educativas y las universidades.</li>
<li>El descontento genera <b>radicales</b>: reducen la producción y la estabilidad. Los <b>leales</b> apoyan al gobierno.</li>
</ul>
<p>La ventana <b>Población</b> resume profesiones, estratos, desempleo y ejército.</p>`},

{id: 'budget', title: '9. Presupuesto e impuestos', html: `
<ul>
<li><b>Impuesto sobre la renta:</b> cinco niveles (4%, 8%, 12%, 17%, 23%). Más impuestos = más ingresos, pero menos dinero para consumir.</li>
<li><b>Impuesto al consumo:</b> Ninguno, Bajo (4%), Medio (8%) o Alto (12%) sobre lo que compran los habitantes.</li>
<li><b>Eficiencia de recaudación:</b> depende de la <b>burocracia</b>. Cada nivel de Administración aporta 100 puntos frente a una necesidad que crece con la población. Con poca burocracia recaudas mucho menos. Las leyes y tecnologías (Administración Civil, Telégrafo, Ministerios) la mejoran.</li>
<li><b>Gastos:</b> salarios públicos (administración, ejército, universidades), construcción pública, servicios públicos y obras menores (el 85% del superávit se reinvierte en la economía), intereses de la deuda y, en guerra, el esfuerzo bélico (5% de ingresos por guerra). También pagas subsidios y tributo si eres vasallo.</li>
<li><b>Financiación militar y educativa:</b> del 50% al 150%. Más financiación mejora el ejército y la innovación pero sube los salarios.</li>
<li><b>Deuda:</b> si el tesoro es negativo pagas intereses; cuanto mayor es la deuda, más caros. Una deuda desbordada provoca crisis monetarias y bancarrota.</li>
<li><b>Ingresos por acuerdos:</b> los tratados comerciales suman un 3% cada uno (hasta 9%) y las uniones económicas un 4%.</li>
</ul>`},

{id: 'politics', title: '10. Política: leyes y grupos de interés', html: `
<h4>Grupos de interés</h4>
<p>Ocho grupos representan a la sociedad: Terratenientes, Industriales, Intelectuales, Pequeña Burguesía, Clero, Fuerzas Armadas, Sindicatos y Folk Rural. Cada uno tiene:</p>
<ul><li><b>Influencia:</b> su peso político, que depende del tamaño y riqueza de sus miembros y de quién puede votar según tu ley de Estructura de Poder.</li>
<li><b>Aprobación</b> (−10 a +10): según las leyes que te gustan o no y el nivel de vida de sus miembros. Los que están <b>en el gobierno</b> (la coalición que suma la mitad del poder) están más contentos.</li></ul>
<h4>Legitimidad</h4><p>Es la media de aprobación ponderada por influencia (el gobierno cuenta más) más estabilidad de leyes y tecnologías. Una legitimidad baja aumenta los radicales y, si se prolonga (6 meses por debajo del 32% con muchos radicales), puede provocar una <b>revolución</b>.</p>
<h4>Leyes</h4>
<p>Hay 11 categorías: Estructura de Poder, Sistema Económico, Derechos Laborales, Sistema Agrario, Trabajo Forzado, Religión, Educación, Libertad de Prensa, Modelo de Ejército, Sistema Fiscal y Política Migratoria. Cada ley modifica tu economía, recaudación, ejército, alfabetización, estabilidad o radicalismo.</p>
<p>Para cambiar una ley: abre <b>Política → Leyes</b>, elige la ley y pulsa <b>Promulgar reforma</b> (50 de influencia). Se debate 3 meses; la probabilidad de éxito depende de qué grupos influyentes la apoyan o la rechazan y de tu legitimidad. Si falla, aumentan los radicales. Algunas leyes exigen una tecnología (se indica con 🔒).</p>`},

{id: 'ideology', title: '11. Ideologías, patrocinio y cambio de gobierno', html: `
<p>En <b>Política → Ideologías y cambio de régimen</b> controlas el equilibrio de poder de tu sociedad.</p>
<h4>Ideologías</h4><p>Cada grupo de interés encarna una: Conservadurismo (Terratenientes), Liberalismo económico (Industriales), Republicanismo (Intelectuales), Liberalismo político (Pequeña Burguesía), Tradicionalismo religioso (Clero), Nacionalismo autoritario (Fuerzas Armadas), Socialismo (Sindicatos) y Agrarismo (Folk Rural). El nombre de tu régimen (Monarquía Absoluta, República Liberal, Dictadura Militar…) se calcula a partir de la ley de poder y de la ideología dominante.</p>
<h4>Patrocinar grupos de interés</h4>
<ul><li><b>Impulsar</b> (▲): +45% de influencia durante 12 meses y mejor aprobación. Coste: 35 de influencia + 2 semanas de ingresos.</li>
<li><b>Reprimir</b> (▼): −45% de influencia durante 12 meses (aumenta los radicales y baja la legitimidad).</li>
<li>Máximo 3 grupos simultáneos.</li></ul>
<h4>Patrocinar grupos de población</h4><p>Puedes dar más (×1,6) o menos (×0,5) peso político a una profesión (por ejemplo, a los obreros o a los oficiales) durante 12 meses por 25 de influencia. Máximo 3.</p>
<h4>Cambiar de régimen</h4>
<p>Cada grupo tiene un <b>programa</b> (un conjunto de leyes). Hay tres vías, con probabilidad de éxito estimada:</p>
<table class="tbl"><tbody>
<tr><td>🗳️ Elecciones (40 infl.)</td><td>Solo si hay voto. Cambio pacífico: el grupo impone hasta 3 leyes de su programa que estén desbloqueadas.</td></tr>
<tr><td>🎖️ Golpe de Estado (60 infl.)</td><td>Solo por las Fuerzas Armadas. Instaura una dictadura con programa autoritario.</td></tr>
<tr><td>🔥 Revolución (80 infl.)</td><td>Requiere ≥14% de radicales. Impone todo el programa, hunde la inversión y el tesoro y puede provocar una guerra civil (estados que se independizan). Si triunfan intelectuales, sindicatos, pequeña burguesía o campesinos, la monarquía desaparece.</td></tr>
</tbody></table>
<p>Fracasar baja la legitimidad y sube el malestar. Si impulsas antes al grupo, tus opciones mejoran. Los gobiernos con legitimidad muy baja y muchos radicales pueden ser derrocados <b>espontáneamente</b>.</p>
<h4>Propaganda por estrato</h4><p>En Política → Ideologías puedes lanzar una campaña de propaganda sobre un estrato entero (clases altas, medias o bajas). Es <b>muy cara</b> (14 semanas de ingresos y 60 de influencia): durante 18 meses multiplica por 1,5 el peso político de todas las profesiones del estrato, reduce el malestar y sube la legitimidad.</p>
<h4>Injerencia exterior</h4><p>En Diplomacia puedes patrocinar a un grupo de interés de otro país (50 de influencia): ganará un 50% de influencia durante un año. Si te descubren, la relación cae 35 puntos.</p>`},

{id: 'tech', title: '12. Tecnología', html: `
<p>Los puntos de innovación se generan cada semana según la alfabetización, el tamaño del país y las <b>Universidades</b> (con rendimientos decrecientes). Elige una tecnología disponible y se completa al acumular su coste. Solo se investiga una a la vez.</p>
<h4>Diseño del árbol</h4>
<ul>
<li><b>Tres ramas</b> (Producción, Sociedad, Militar) y <b>tres eras</b> con 70 tecnologías.</li>
<li><b>Costes crecientes:</b> cada era es mucho más cara y cada tecnología ya investigada encarece las siguientes un 1,5%. Completar el árbol entero es un esfuerzo de décadas que muy pocos países logran.</li>
<li><b>Apertura de eras:</b> la Era 2 se abre en 1855 con 11 tecnologías de la Era 1; la Era 3 en 1880 con 13 de la Era 2.</li>
<li><b>Doctrinas excluyentes (⚖):</b> al elegir una (política: Absolutista, Liberal o Social; militar: de Línea, de Columnas o Guerra Irregular) pierdes las otras para siempre.</li>
<li><b>Caducidad (⏳):</b> algunas tecnologías (Canalización, doctrinas) se pierden si no las investigas antes de cierto año. Otras no están disponibles hasta una fecha.</li>
</ul>
<h4>Efectos reales</h4>
<table class="tbl"><tbody>
<tr><td>Producción agrícola / minera / industrial / acero</td><td>Multiplican la producción de esos edificios.</td></tr>
<tr><td>Construcción · Infraestructura</td><td>Más puntos de obra; más producción en estados con ferrocarril.</td></tr>
<tr><td>Burocracia · Recaudación</td><td>Mejoran la eficiencia fiscal.</td></tr>
<tr><td>Innovación · Alfabetización · Crecimiento</td><td>Aceleran la investigación, la educación y la demografía.</td></tr>
<tr><td>Inversión privada</td><td>Más proyectos de los capitalistas.</td></tr>
<tr><td>Legitimidad · Radicalismo</td><td>Estabilidad política.</td></tr>
<tr><td>Resistencia a crisis</td><td>Reduce la gravedad de las crisis económicas.</td></tr>
<tr><td>Potencia militar · Defensa · Logística · Coste militar</td><td>Ejército, resistencia en defensa, avance de frentes y salarios militares.</td></tr>
<tr><td>Desbloqueos</td><td>Acerías (Alto Horno), Ferrocarriles y leyes (Liberalismo, Sufragio Universal, Escuelas Públicas, Socialismo, Prensa Libre, Conscripción, Impuesto progresivo…).</td></tr>
</tbody></table>`},

{id: 'diplomacy', title: '13. Diplomacia y acuerdos', html: `
<p>En <b>Diplomacia → Potencias</b> verás todos los países (con buscador). Selecciona uno para ver sus datos y actuar sobre él.</p>
<h4>Relaciones</h4><p>Van de −100 a +100. Mejoran con acuerdos, regalos y tiempo; empeoran con insultos, rivalidades, embargos, guerras y con la <b>infamia</b> de quien agrede. Con el tiempo tienden hacia 0.</p>
<h4>Acciones inmediatas</h4>
<ul><li>🕊️ <b>Mejorar relaciones</b> (20 infl.): +25.</li><li>🎁 <b>Regalo</b> (1,5 semanas de ingresos): +18.</li><li>😠 <b>Insultar</b> (10 infl.): −25.</li></ul>
<h4>Acuerdos</h4>
<table class="tbl"><thead><tr><th>Acuerdo</th><th>Coste</th><th>Efecto</th></tr></thead><tbody>
<tr><td>🤝 Alianza</td><td>25</td><td>Mutua. Si uno es atacado, el otro suele unirse a la guerra; también en las guerras que declare el aliado.</td></tr>
<tr><td>🛡️ Garantía de independencia</td><td>15</td><td>Prometes defender al otro si lo atacan. Mejora su relación.</td></tr>
<tr><td>🕊️ No agresión</td><td>10</td><td>Mutuo, 10 años. Ninguno puede declararse la guerra.</td></tr>
<tr><td>📦 Tratado comercial</td><td>10</td><td>+3% de ingresos para ambos y menos sanciones.</td></tr>
<tr><td>💸 Subsidios</td><td>8</td><td>Pagas un 2% de tus ingresos semanales al otro a cambio de relación.</td></tr>
<tr><td>🚫 Embargo</td><td>12</td><td>Reduce un 4% la recaudación del sancionado (más si lo aplican potencias).</td></tr>
<tr><td>⚔️ Rivalidad</td><td>5</td><td>Las relaciones se deterioran cada mes. No requiere aceptación.</td></tr>
</tbody></table>
<p>Para las propuestas que debe aceptar la otra parte, pasa el ratón sobre el botón: verás la <b>probabilidad de aceptación</b> y sus motivos (relaciones, enemigo común, regímenes afines, infamia, rivalidades, fuerza relativa). Puedes <b>romper</b> un acuerdo en cualquier momento (−25 de relación y −2 de prestigio).</p>
<h4>Propuestas de la IA</h4><p>Los países pueden proponerte acuerdos o que ingreses en su bloque. Aparecen en el icono ✉️ y en <b>Diplomacia → Acuerdos</b>, donde puedes aceptarlas o rechazarlas.</p>
<h4>Infamia</h4><p>Cada guerra de agresión genera infamia (más con la conquista). Mientras es alta, todos los países te toleran peor. Se reduce lentamente con el tiempo.</p>`},

{id: 'blocs', title: '14. Bloques', html: `
<p>Los bloques agrupan a varios países bajo un líder. Para fundarlo necesitas <b>30 de prestigio y 60 de influencia</b>; el máximo de miembros es 3 + 1 por cada 40 de prestigio del líder. Un vasallo no puede liderar un bloque.</p>
<table class="tbl"><thead><tr><th>Tipo</th><th>Efecto</th></tr></thead><tbody>
<tr><td>⚔️ Bloque militar</td><td>Los miembros acuden a las guerras del líder y se defienden entre sí. +5% de potencia militar.</td></tr>
<tr><td>💱 Unión económica</td><td>+4% de ingresos para todos los miembros.</td></tr>
<tr><td>🗳️ Liga ideológica</td><td>Los miembros mejoran su relación entre sí y comparten un marco político.</td></tr>
</tbody></table>
<ul><li><b>Invitar</b> (20 infl.): el líder invita a países con probabilidad según relaciones, rivalidades y prestigio.</li>
<li><b>Solicitar ingreso</b> en un bloque existente (20 infl.).</li><li>El líder puede <b>expulsar</b> o <b>disolver</b>. Abandonar un bloque cuesta prestigio y relación. Los miembros no pueden atacarse entre sí.</li>
<li>El líder gana prestigio cada mes por cada miembro.</li></ul>
<p>En el modo de mapa <b>Bloques y alianzas</b> cada bloque tiene su color. Históricamente comienzan la <i>Santa Alianza</i> (Rusia y Austria) y el <i>Zollverein</i> (Prusia y varios estados alemanes).</p>`},

{id: 'cb', title: '15. Casus belli y reclamaciones', html: `
<p>No se puede declarar una guerra sin un <b>casus belli</b>. Al pulsar «Declarar la guerra…» en Diplomacia se abre un diálogo donde eliges el casus belli, los territorios (si procede), y ves el coste, la infamia y las fuerzas implicadas.</p>
<table class="tbl"><thead><tr><th>Casus belli</th><th>Coste</th><th>Si vences</th></tr></thead><tbody>
<tr><td>🏴 Conquista</td><td>45 + 14 por territorio</td><td>Anexionas los territorios elegidos (hasta 1 + prestigio/55, máx. 4). Mucha infamia.</td></tr>
<tr><td>📜 Reclamación territorial</td><td>18 + 6 por territorio</td><td>Anexionas territorios sobre los que tienes una reclamación (hasta 5). Poca infamia.</td></tr>
<tr><td>😤 Humillación</td><td>25</td><td>El rival paga hasta 8 semanas de ingresos y pierde 12 de prestigio.</td></tr>
<tr><td>🏛️ Cambio de régimen</td><td>40</td><td>El rival adopta la ley que elijas (−12 de legitimidad).</td></tr>
<tr><td>🚢 Apertura comercial</td><td>32</td><td>Indemnización, tratado comercial forzoso y −6% de recaudación durante años.</td></tr>
<tr><td>👑 Vasallaje</td><td>60</td><td>El rival se convierte en tu vasallo (requiere más prestigio que él).</td></tr>
</tbody></table>
<h4>Elección de territorios</h4><p>Solo puedes exigir estados <b>alcanzables</b>: fronterizos con tus tierras o las de tus aliados, o costeros dentro del alcance naval (14° en potencias menores, 24° en potencias, 42° en las 6 primeras). El coste de cada territorio crece con su población. Se muestra con ★ la capital y con 📜 los reclamados.</p>
<h4>Reclamaciones</h4>
<ul><li>Se <b>fabrican</b> en Diplomacia → Casus belli (30 infl., 6 meses): eliges un país y uno de sus estados alcanzables.</li>
<li>Obtienes reclamaciones permanentes sobre los territorios que <b>pierdas</b>.</li>
<li>Algunos países tienen reclamaciones históricas al inicio (por ejemplo Prusia sobre los estados alemanes y Cerdeña-Piamonte sobre los italianos).</li></ul>
<h4>Restricciones</h4><p>No puedes atacar a aliados, a quien tenga un pacto de no agresión contigo, a miembros de tu bloque, a tu soberano o vasallos. Un vasallo no puede declarar guerras. Si atacas a un país garantizado, sus garantes intervendrán.</p>`},

{id: 'war', title: '16. La guerra y los ejércitos', html: `
<h4>Participantes</h4><p>Al declarar la guerra, los <b>aliados</b> y los miembros de bloques militares de cada bando son llamados (aceptan con una probabilidad según relaciones). Los <b>garantes</b> del defensor y sus <b>vasallos</b> también se suman. Se informa de quién entra.</p>
<h4>Divisiones y reclutamiento</h4><p>Un ejército se compone de <b>divisiones</b> de 8.000 hombres: <b>infantería</b> (barata, fuerte en defensa), <b>caballería</b> (rápida) y <b>artillería</b> (mucho ataque, lenta y frágil). Se reclutan en <b>Ejército y guerra → Reclutamiento</b> en estados con <b>Cuarteles</b>: cuestan dinero y 8.000 campesinos del estado, y tardan 14–25 días en instruirse. El máximo de divisiones depende de los soldados de tu país (soldados ÷ 8.000). Hasta 12 divisiones forman un ejército, al mando de un <b>general</b> aleatorio con Ataque, Defensa y Logística que gana experiencia.</p>
<h4>Mover ejércitos</h4><p>Cada ejército aparece como una ficha con bandera y nº de divisiones. <b>Clic</b> en la ficha (o en la lista) para seleccionarlo y abrir su panel; después <b>clic derecho</b> sobre un estado para ordenar el movimiento: el ejército sigue una ruta por los estados vecinos (se dibuja punteada) y tarda según el terreno, la velocidad de sus divisiones y la logística. Puedes detenerlo, enviarlo a la capital, dividirlo, fusionarlo con otro del mismo estado o disolverlo (devuelve parte de los soldados). No se puede cruzar el territorio de países con pacto de no agresión, garantía o alianza, ni de vasallos o bloque.</p>
<h4>Movilización</h4><p>En <b>Reclutamiento</b> eliges el nivel de movilización: solo soldados profesionales (barracones), voluntarios (1% de la población), servicio limitado (2,5%), conscripción (5%) o movilización total (10%). Más movilización permite más divisiones, pero reduce la producción (−4% por nivel), cuesta dinero cada mes y genera malestar y pérdida de legitimidad. Cada división tiene además un <b>mantenimiento semanal</b> (más caro en guerra).</p>
<h4>Otras formas de mover</h4><p>Además del clic derecho: botón <b>🎯 Mover</b> en el panel del ejército y clic izquierdo en el destino, o <b>Mayús + clic</b>. Con <b>Ctrl/Mayús + clic</b> sobre otras fichas propias formas un grupo que se mueve a la vez. Si el destino contiene un ejército enemigo, tus ejércitos lo <b>persiguen</b> y corrigen su ruta cada pocos días. Todos los ejércitos (tuyos y enemigos) se mueven con la misma fórmula; las rutas enemigas se dibujan en rojo y las fichas se desplazan suavemente entre provincias.</p>
<h4>Sucesos y minimapa de batalla</h4><p>El panel de batalla incluye un <b>minimapa táctico</b> con las divisiones de cada bando (en primera línea o en reserva), la línea del frente que avanza o retrocede y flechas de avance. Cada día puede ocurrir algo aleatorio: <b>cañoneo</b> preparatorio de la artillería, <b>cargas de caballería</b>, <b>cargas desesperadas</b> del bando que pierde (muy dañinas para ambos), <b>flanqueos</b>, <b>pánico</b>, refuerzos o lluvia. Se muestran en el minimapa y en el registro.</p>
<h4>Estadísticas de batalla en tiempo real</h4><p>Pulsa el icono ⚔ de una batalla (o «Ver batalla» en el panel de un ejército) para abrir un panel que se actualiza en vivo: divisiones, hombres, fuerza y organización de cada bando, poder de ataque y de defensa, divisiones en combate y en reserva, generales, atrincheramiento, suministro, bajas, terreno y una gráfica de la organización. Las batallas terminadas se guardan en un historial.</p>
<h4>Órdenes de movilidad</h4><ul>
<li><b>Mover</b> (clic derecho o modo 🎯), <b>puntos de ruta</b> (Mayús + clic derecho) y <b>persecución</b> de ejércitos enemigos.</li>
<li><b>🥾 Marcha forzada</b>: −32% de tiempo de viaje, pero las divisiones pierden organización cada día (menos con un general de «Marcha forzada»).</li>
<li><b>🚆 Ferrocarril</b>: redespliegue estratégico, solo por territorio propio o aliado; el viaje dura un 35% pero las tropas llegan algo desorganizadas.</li>
<li><b>🔁 Patrulla</b>: el ejército va y viene entre dos puntos. <b>🛡 Mantener posición</b>: resiste en combate hasta casi perder toda la organización. <b>⛏ Atrincherar</b>: acelera el atrincheramiento (hasta +24% de defensa). <b>↩ Retirada</b> a territorio propio.</li>
<li><b>⛓ Juntar</b>: el ejército marcha hacia otro propio y se fusiona al llegar (máx. 12 divisiones); también puedes juntar un grupo entero en un ejército.</li></ul>
<h4>Frentes y planes</h4><p>En Ejército → <b>Frentes</b> creas un plan de <b>defensa</b> o de <b>ataque</b> y <b>dibujas una línea sobre la frontera</b> haciendo clic en provincias (o usas «Línea automática frente a…»). Asigna los ejércitos seleccionados y pulsa <b>▶ Activar</b>. <b>Defensa</b>: los ejércitos se reparten por la línea según la amenaza y se atrincheran. <b>Ataque</b>: se concentran en la línea (hasta +15% de ataque tras 15 días de preparación); con <b>⚔ Ejecutar ataque</b> (o automáticamente a los 12 días) avanzan sobre las provincias enemigas marcadas con flechas y la línea avanza con las conquistas.</p>
<h4>Generales</h4><p>Cada general tiene Ataque, Defensa y Logística (1–5) y <b>rasgos</b> (Ofensivo, Defensivo, Logístico, Maestro de caballería, Artillero, Fortificador, Marcha forzada, Carismático, Temerario, Instructor) que bufean al ejército. Puedes reclutar generales de reserva en la pestaña <b>Generales</b> y asignarlos a cualquier ejército desde su panel. Los generales suben de nivel ganando batallas y pueden morir al perder una.</p>
<h4>Entrenamiento</h4><p>Cada división tiene un nivel de entrenamiento (Recluta, Regular, Veterano, Élite) que multiplica su rendimiento de ×0,75 a ×1,25. Las divisiones nuevas son reclutas; con <b>🎓 Entrenar</b> en territorio propio mejoran cada día (más rápido con cuarteles y generales instructores) a cambio de un 40% más de mantenimiento. Combatir también entrena. La IA entrena a sus ejércitos en tiempos de paz.</p>
<h4>Batallas</h4><p>Cuando dos ejércitos hostiles coinciden en un estado empieza una <b>batalla automática de varios días</b>. Cada día se compara fuerza, ataque o defensa, el <b>terreno</b> (bosque, montaña y pantano favorecen al defensor), el <b>general</b> y la suerte. Las divisiones pierden fuerza y organización; si se quedan sin organización <b>se retiran</b> al estado propio más cercano. Las bajas reducen la población campesina del país.</p>
<h4>Ocupación y puntuación de guerra</h4><p>Un estado enemigo sin defensores y con tus tropas durante <b>10 días</b> queda <b>ocupado</b> (se dibuja con rayas y línea de frente, produce y recauda mucho menos). La <b>puntuación de guerra</b> (−100 a +100) se calcula con los estados ocupados por cada bando (más si son capitales u objetivos de la guerra) y las batallas ganadas. Ya no depende de una comparación abstracta de potencias: <b>hay que ganar la guerra sobre el terreno</b>.</p>
<h4>IA militar</h4><p>Los países de la IA reclutan al entrar en guerra, defienden su capital y atacan el estado enemigo más débil de su frontera.</p>
<h4>Conferencia de paz</h4><p>Cuando ganas una guerra (por rendición, por imponer la paz o por capitulación del enemigo) se abre una <b>conferencia de paz</b>. Dispones de <b>puntos de guerra</b> (según la puntuación) y los gastas en exigencias: <b>territorios</b> (más baratos si están ocupados o son objetivo de guerra; puedes cederlos a tus aliados), <b>reparaciones</b>, <b>humillación</b>, <b>concesiones comerciales</b>, <b>desmilitarización</b>, <b>imponer una ley</b> y <b>vasallaje</b>. La IA elige sola cuando vence. Las guerras que acaban por crisis diplomática se resuelven con las exigencias originales.</p>
<h4>Humo de batalla</h4><p>Las provincias en combate echan columnas de humo y fogonazos visibles desde lejos.</p>
<h4>Desgaste</h4><p>Las guerras cuestan un 5% de los ingresos por semana, suben los radicales y desgastan a los soldados.</p>
<h4>Paz</h4>
<p>En <b>Ejército y guerra</b> pulsa el botón de paz. Si la puntuación te favorece más de 30 puntos <b>impones la paz</b> (consigues los objetivos del casus belli: territorios ocupados al ≥50%, o todos si vences de forma aplastante); si la desfavorece más de 30 la <b>pides</b> y cedes; en un empate puedes proponer <b>paz blanca</b>, que el rival puede rechazar. La IA cierra las guerras entre ellas cuando hay un claro vencedor.</p>
<h4>Resultados</h4><ul><li>El ganador obtiene prestigio y los aliados un pequeño premio; el perdedor pierde prestigio y legitimidad.</li><li>Si el <b>defensor gana</b>, el atacante paga indemnización y el defensor puede anexionar hasta tres estados enemigos que hubiera ocupado.</li></ul>`},

{id: 'logistics', title: '16b. Suministro, cercos, cansancio y capitulación', html: `
<h4>Suministro</h4><p>Cada país tiene una <b>red de suministro</b> que parte de su capital y de sus puertos y se extiende por las provincias que controla; los <b>ferrocarriles</b> (infraestructura) alargan su alcance y aumentan cuántas divisiones puede mantener cada provincia. Fuera de tu red (en territorio enemigo o neutral) el suministro cae unos 30% por provincia. Un ejército con menos del 50% de suministro pierde organización y fuerza cada día y combate peor; amontonar demasiadas divisiones en una provincia también reduce el suministro. El panel del ejército muestra su suministro actual.</p>
<h4>Cercos</h4><p>Un ejército sin ninguna conexión de suministro rodeado de enemigos está <b>cercado</b>: tras unas semanas se <b>rinde</b> y el bando contrario suma puntos de guerra. Rompe el cerco antes, o evita adentrarte demasiado sin carreteras ni ferrocarriles. Si pierdes la capital, tu red se reconstruye desde tus puertos o tu estado más poblado.</p>
<h4>Cansancio de guerra</h4><p>Las bajas y los meses de guerra elevan el <b>cansancio de guerra</b>; en paz se recupera. Por encima de 35 restan legitimidad y suben el malestar, reducen la producción y pueden provocar <b>motines</b> (disturbios) por encima de 60.</p>
<h4>Capitulación</h4><p>Si el líder de un bando pierde la capital y más del 40% de su país (o más del 68% sin perder la capital, o está agotado por la guerra), tiene unas semanas para revertirlo; después <b>capitula</b> y la guerra termina con victoria del enemigo.</p>
<h4>Crisis diplomáticas</h4><p>En el diálogo de guerra puedes abrir una <b>crisis diplomática</b> (la mitad de influencia). Durante 3 meses los aliados, garantes y bloques de ambos lados toman partido. El defensor, si es mucho más débil, puede <b>ceder</b> y aceptar tus exigencias sin combatir; si no, estalla la guerra con todos los apoyos alineados. El agresor puede retirarse (−8 prestigio) o declarar la guerra antes de tiempo. Consulta Diplomacia → <b>Crisis</b>.</p>`},
{id: 'political', title: '16c. Elecciones y movimientos políticos', html: `
<h4>Elecciones</h4><p>Los países con voto por propiedad, censitario o sufragio universal celebran <b>elecciones cada 4 años</b> (marzo). La campaña empieza 3 meses antes y puedes <b>apoyar a un partido</b> (+30% de voto) por dinero e influencia. Los grupos de interés de la coalición ganadora ganan un 20% de influencia durante 4 años; el gobierno derrotado pierde un 12%. Ver Política → <b>Elecciones y movimientos</b>.</p>
<h4>Movimientos políticos</h4><p>Sufragistas, obreros, abolicionistas, liberales, laicistas, socialistas y campesinos crecen con el malestar, la alfabetización y la pobreza y exigen una reforma concreta. Por encima del 50% restan legitimidad; por encima del 85% provocan <b>disturbios</b>. Responde <b>concediendo</b> la reforma, <b>reprimiendo</b> (20 influencia, más malestar) o <b>cooptando</b> a sus líderes (dinero).</p>`},
{id: 'national', title: '16d. Decisiones nacionales', html: `
<p>La ventana <b>Decisiones nacionales</b> (🌳) muestra el árbol de tu país: Prusia, Reino Unido, Francia, Rusia, Imperio Otomano, España, Estados Unidos y Japón tienen ramas propias con decisiones históricas y alternativas; el resto usa un árbol genérico (industrializar, reformar, armarse, expandirse). Solo puedes hacer <b>una decisión a la vez</b>; cada una tarda de 10 a 20 semanas y sus efectos (leyes, tecnologías, reclamaciones, edificios, divisiones, bonificaciones…) son permanentes. Las ramas unidas por una línea roja son <b>excluyentes</b>.</p>`},
{id: 'vassals', title: '17. Vasallos', html: `
<p>Un <b>vasallo</b> te paga el 12% de sus ingresos semanales, sigue tu política exterior (se une a tus guerras) y no puede declarar guerras ni fundar bloques. Se consigue con el casus belli <i>Vasallaje</i>.</p>
<ul><li><b>Anexionar</b> (80 infl.): incorporas todos sus estados.</li><li><b>Liberar</b>: lo devuelves a la independencia (mejora la relación).</li>
<li>Un vasallo puede independizarse si su soberano pierde mucho peso internacional.</li></ul>`},

{id: 'colony', title: '18. Colonización', html: `
<p>Los territorios «sin reclamar» (tribus y estados sin gobierno) pueden colonizarse. En Diplomacia → Colonización o en el panel de un estado sin dueño, pulsa <b>Colonizar</b> (80 de influencia). Tarda 6 meses y solo se pueden reclamar tierras al alcance de tus territorios (más lejos las potencias industriales). Las potencias de IA también colonizan, así que el reparto del mundo es una carrera.</p>`},

{id: 'goals', title: '19. Objetivos y eventos', html: `
<p>El <b>Diario</b> (📜) muestra objetivos con recompensa en prestigio e innovación (duplicar la industria, ampliar la alfabetización, aumentar el ejército, crecer…), y la crónica de los últimos sucesos.</p>
<h4>Eventos</h4>
<p>Hay más de 35 eventos que detienen el juego y te piden elegir entre varias respuestas. Muchos tienen <b>consecuencias fuertes</b>: pueden hacerte perder o ganar territorios, provocar guerras, cambiar leyes, dar tecnologías gratis, hundir la inversión o alterar el peso de los grupos de interés. Aparecen según tu situación (legitimidad, radicales, deuda, industria, monarquía, leyes…); cada opción muestra en cursiva su efecto. Un mismo evento no se repite hasta pasado más de un año.</p>
<table class="tbl"><tbody>
<tr><td>📜 Ultimátum de una gran potencia</td><td>Una potencia mucho más fuerte exige un territorio: ceder, pagar tributo o ir a la guerra.</td></tr>
<tr><td>🏴 Movimiento separatista · 🔥 Rebelión provincial</td><td>Puedes perder un estado o gastar legitimidad para conservarlo.</td></tr>
<tr><td>🗡️ Conspiración · 🎖️ Motín · 👑 Muerte del soberano</td><td>Cambian la estabilidad y el peso del ejército; la sucesión puede acabar en guerra civil o crisis.</td></tr>
<tr><td>⛏️ Fiebre del oro · 🛢️ Hallazgo de recursos · 🎡 Exposición Universal · 🔬 Genio</td><td>Oportunidades: dinero, yacimientos, prestigio o tecnologías gratis.</td></tr>
<tr><td>🥔 Plaga · ☣️ Cólera · 🌋 Terremoto · 🔥 Incendio</td><td>Desastres que cuestan población y legitimidad si no respondes.</td></tr>
<tr><td>🔥 Ola revolucionaria (1846-1850)</td><td>Reformar a tiempo o reprimir con mano dura.</td></tr>
</tbody></table>
<h4>Rasgos nacionales</h4>
<p>Cada país arranca con <b>ventajas y desventajas</b> según su situación en 1836, que ves bajo el nombre en la placa superior, en Política → Gobierno y en la pantalla de inicio. Ejemplos: <i>Cuna de la industria</i> (Reino Unido), <i>Ejército disciplinado</i> (Prusia), <i>Tierras inmensas</i> pero <i>Sociedad servil</i> (Rusia), <i>Mosaico de naciones</i> (Austria), <i>El enfermo de Europa</i> (Imperio Otomano), <i>Deuda heredada</i> (España y Portugal), <i>Aislamiento</i> (Japón), <i>Neutralidad armada</i> (Suiza), <i>Inestabilidad crónica</i> (repúblicas latinoamericanas). Algunos rasgos modifican producción, recaudación, ejército, innovación o estabilidad; otros alteran el tesoro inicial. Los rasgos negativos con condición <i>(«puede superarse»)</i> desaparecen al cumplir un objetivo (alfabetización, tecnologías, legitimidad…).</p>
<h4>Logros</h4>
<p>El botón 🏅 muestra más de 55 <b>logros</b> en seis categorías (Economía, Tecnología, Política, Diplomacia, Guerra y Prestigio), de 1 a 3 estrellas. Se comprueban cada mes y dan prestigio e innovación. Los que ya se cumplían al empezar la partida no pueden obtenerse. También se guarda cuántos has desbloqueado en alguna partida.</p>`},

{id: 'perf', title: '20. Rendimiento y guardado', html: `
<ul><li>La simulación económica se reparte en <b>etapas diarias</b> para evitar picos de cálculo, y el dibujo del mapa solo repinta lo que cambia (un estado al pasar el ratón, los frentes de guerra) en lugar de toda la textura.</li>
<li>Si tu equipo va justo, evita los modos de mapa que se actualizan cada mes (población, nivel de vida…) y usa velocidades bajas durante las guerras grandes.</li>
<li>El guardado se hace en el almacenamiento local del navegador (unos 1,5 MB). Un autoguardado se crea cada enero; el botón 💾 sobrescribe la partida guardada.</li></ul>`},

{id: 'keys', title: '21. Atajos de teclado', html: `
<table class="tbl"><tbody>
<tr><td><b>Espacio</b></td><td>Pausa / reanudar</td></tr><tr><td><b>, .</b></td><td>Velocidad menor / mayor</td></tr>
<tr><td><b>W A S D</b> / flechas</td><td>Mover la cámara</td></tr><tr><td><b>Q E</b> · <b>R F</b></td><td>Girar · inclinar</td></tr>
<tr><td><b>+ -</b> / rueda / doble clic</td><td>Zoom</td></tr><tr><td>Botones laterales</td><td>Zoom, giro, inclinación, vista inicial y modos de desplazamiento</td></tr><tr><td><b>Ctrl+K</b> o <b>/</b></td><td>Buscar país o estado</td></tr>
<tr><td><b>F1</b></td><td>Abrir este manual</td></tr><tr><td><b>Esc</b></td><td>Cerrar ventana, búsqueda o diálogo</td></tr>
</tbody></table>`},

{id: 'tips', title: '22. Consejos y glosario', html: `
<h4>Consejos estratégicos</h4>
<ul>
<li>Empieza por la <b>burocracia</b>: sin administración tus impuestos rinden la mitad.</li>
<li>Equilibra <b>educación</b> y <b>universidades</b>: son la base de la innovación, que es lo que más tarda en recompensar.</li>
<li>Guarda un colchón de tesoro: las crisis llegan y los intereses de la deuda se disparan.</li>
<li>No reformes todo de golpe: cada ley cambia la aprobación de varios grupos. Mira antes quién la apoya.</li>
<li>Los pactos de no agresión y las garantías te protegen sin necesidad de un gran ejército; las alianzas arrastran a guerras que quizá no quieras.</li>
<li>Para anexionar territorios con poca infamia, <b>fabrica reclamaciones</b> y usa el casus belli de reclamación.</li>
<li>Impulsa a un grupo antes de buscar un cambio de régimen: aumenta mucho su probabilidad.</li>
<li>En guerra, mejora la <b>logística</b> y la <b>defensa</b>; el frente se mueve con la diferencia de potencia.</li>
</ul>
<h4>Glosario</h4>
<table class="tbl"><tbody>
<tr><td>VA (valor añadido)</td><td>Ingresos de un edificio menos el coste de sus insumos.</td></tr>
<tr><td>Nivel (de un edificio)</td><td>Unidad de construcción; emplea a 5.000 trabajadores (2.000 en edificios de gobierno).</td></tr>
<tr><td>Utilización</td><td>Fracción de la capacidad que se usa; sube con el beneficio.</td></tr>
<tr><td>Influencia</td><td>Recurso político para actuar. No es dinero.</td></tr>
<tr><td>Infamia</td><td>Mala reputación por guerras de agresión.</td></tr>
<tr><td>Vasallo</td><td>País subordinado que paga tributo.</td></tr>
<tr><td>Casus belli</td><td>Justificación legal de una guerra y objetivos que persigue.</td></tr>
</tbody></table>`}
];

WINDOWS.manual = {title: 'Manual del juego', icon: '📖', render() {
  const sec = MANUAL.find(m => m.id === UI.manualSec) || MANUAL[0];
  return `<div class="manual"><nav>${MANUAL.map(m => `<button class="${m.id === sec.id ? 'on' : ''}" data-act="msec" data-id="${m.id}">${m.title}</button>`).join('')}</nav><article class="scrollable manbody"><h2>${sec.title}</h2>${sec.html}</article></div>`;
}};
