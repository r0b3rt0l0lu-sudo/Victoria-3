# PROGRESO — Gran estrategia estilo Victoria 3 + HoI

## Parte 1 — Sistema militar básico (HECHO)
- **Divisiones** (infantería, caballería, artillería) de 8.000 hombres; se reclutan en estados con Cuarteles
  (coste en dinero + campesinos del estado, instrucción de 14–25 días). Límite = soldados ÷ 8.000.
- **Ejércitos** (hasta 12 divisiones) con **general aleatorio** (ataque/defensa/logística, nivel y experiencia),
  dibujados como fichas con bandera en el mapa; panel de ejército (detener, ir a la capital, dividir, fusionar, disolver).
- **Movimiento por estados**: clic en el ejército + clic derecho en un estado; ruta Dijkstra sobre el grafo de vecinos
  (tiempo según terreno y velocidad), líneas de órdenes punteadas.
- **Batallas automáticas** de varios días (fuerza, organización, terreno, general, azar); retirada al perder la organización;
  bajas que restan población campesina.
- **Ocupación real**: estado enemigo sin defensores ocupado 10 días → ocupado (franjas y línea de frente).
- **Puntuación de guerra** calculada con estados ocupados + batallas ganadas (sustituye a la comparación abstracta de potencias).
- **IA básica**: recluta en guerra, defiende la capital, ataca el estado enemigo más débil de su frontera.
- **Ventana «Ejército y guerra»**: Ejércitos, Reclutamiento, Guerras (con batallas) y Fuerzas armadas.
- Guardado/carga con ejércitos, batallas y reclutas; manual y README actualizados.

## Parte 2 — PENDIENTE
- Provincias (dividir los estados en unidades menores para el movimiento y la ocupación).
- Suministro y logística (líneas de suministro, desgaste fuera de territorio propio).
- Aviación y marina (flotas, bloqueos, transporte).
- Producción de equipamiento (fusiles, cañones, etc.) y su efecto en las divisiones.
- Frentes dibujados con flechas y asignación de ejércitos a frentes.
- Doctrinas y árbol nacional.
- Equilibrado: la frecuencia de batallas de la IA entre países es baja (≈ 0,5 batallas/año en simulación).

## Compilación
`python3 build.py` → `index.html` (autónomo). `python3 build.py --light` → `juego-ligero.html` (three.js por CDN, necesita Internet).

## Parte 2 — avance (sesión actual)
- HECHO: **provincias** (≈830, 2–9 por estado; `src/provinces.js`), ejércitos y batallas por provincia, ocupación por provincia
  (5 días), línea de frente dibujada entre provincias ocupadas y libres, A* sobre provincias, atrincheramiento, muerte de generales,
  experiencia militar y cansancio de guerra (datos), guardado v2.
- HECHO: **iconos SVG** (`src/icons.js`) en HUD, menú, cámara, modos de mapa y ventanas + pulido visual general (CSS).
- PENDIENTE: suministro, producción de equipo, doctrinas, aviación, marina, frentes/planes, árbol nacional, ventanas nuevas.

## Cambios de la última sesión
- Movimiento: modo «🎯 Mover» (clic izquierdo), Mayús+clic, grupos con Ctrl/Mayús+clic en fichas, **persecución** de ejércitos enemigos
  (clic derecho sobre ellos o botón), fichas con desplazamiento suave y rutas enemigas en rojo. Velocidad idéntica para todos los países.
- Reclutamiento por **movilización** (0 / 1 / 2,5 / 5 / 10 % de la población) con coste económico, malestar y mantenimiento semanal de divisiones.
- **Panel de batalla en tiempo real** (clic en ⚔ del mapa o «Ver batalla») + historial de batallas.
- **Propaganda por estrato** (clases altas/medias/bajas), carísima.
- **Equilibrado** (simulaciones de 20 años, 3 dificultades): población ya no se desploma (hambre exagerada: umbral 0,85→0,7 y hambrunas locales
  más raras), huelgas a la mitad, crecimiento base 0,95 %/año, IA sin inflar ejércitos (tope en paz, desmovilización, mantenimiento).
  Resultado: pob. +14 % en 20 años, NdV 7→12, ~1 guerra/año y ~55 batallas/año.

## Sesión: frentes, órdenes HoI4, generales, entrenamiento y batalla táctica
- Frentes: dibujar línea sobre la frontera (clic en provincias o línea automática), planes de defensa/ataque con flechas, activar/pausar,
  preparación (+15 %), ejecutar ataque, avance de la línea (`src/military.js` frontsDay, `src/ui_mil.js`).
- Órdenes: marcha forzada, ferrocarril, patrulla, mantener posición, atrincherar, retirada, puntos de ruta, juntar/fusionar, grupos.
- Generales con 10 rasgos que bufean, reserva de generales, reclutar y asignar; muerte de generales.
- Entrenamiento (recluta→élite, ×0,75–×1,25), entrenar en casa, IA entrena en paz.
- Batalla: minimapa táctico con divisiones y frente que avanza + sucesos (cañoneo, carga de caballería, carga desesperada, flanqueo, pánico, lluvia).
- Sigue PENDIENTE de la Parte 2: suministro/cercos, producción de equipo, doctrinas, aviación, marina, árbol nacional.

## Sesión: suministro, árbol nacional, crisis diplomáticas, cansancio, política y gráficos
- HECHO: suministro y cercos (`src/logistics.js`), cansancio de guerra y capitulación, crisis diplomáticas (`src/dcrisis.js`),
  elecciones y 7 movimientos políticos (`src/politics2.js`), árbol nacional para 8 países + genérico (`src/national.js`),
  gráficos: ríos, agua animada, nubes, ciudades 3D, niebla, viñeta, grano de terreno (botón ≈ para desactivar animaciones).
- PENDIENTE Parte 2: producción de equipo, doctrinas, aviación, marina, conferencia de paz, niebla de guerra, guerra civil real.

## Sesión: conferencias de paz, humo de batalla y casas solo de cerca
- Conferencia de paz con presupuesto de puntos de guerra (`src/peace.js`); la IA elige exigencias automáticamente; las crisis diplomáticas usan el resultado legado.
- Humo y fogonazos en las provincias en batalla; las casas y campanarios solo se ven con zoom cercano.

## Sesión: economía militar, desembarcos, interfaz, ciudades y bordes suaves
- Economía militar (`src/milecon.js`): bienes salitre/pólvora/fusiles/cañones/caballos, 5 edificios nuevos, necesidades por división,
  compra semanal del Estado con política Normal/Ampliada/Economía de guerra, desgaste y bajas de equipo, crisis por escasez y de armamento.
- Desembarcos (`src/landing.js`): transportes, planes de desembarco, cabezas de playa, IA básica.
- Interfaz: toasts abajo, paneles sin solapamientos (layout dinámico según la placa), botón 🚪 de menú principal.
- Ciudades con nombre (`src/cities.js`) y bordes vectoriales suavizados en alta resolución (`src/mapsmooth.js`).

## Sesión: ritmo más lento y rendimiento
- Velocidades de juego ~1,7× más lentas; movimiento de ejércitos ×1,7, batallas más largas (menos daño diario, mín. 5 días), ocupación 8 días,
  reclutamiento 24–42 días, desembarcos más lentos (preparación 14 días); guerras de IA con plazos más largos.
- Rendimiento: minimapa sin `getImageData` (era el 29% de la CPU), caché de `sameSide`, prefiltro de `buildRoom`, `preserveDrawingBuffer` desactivado,
  resolución de render limitada a 1,5×. Simulación de 2 años: 6,8 s → 4,5 s.

## Sesión: coaliciones y presión de la IA
- `src/coalition.js`: índice de amenaza (infamia + conquistas recientes), coaliciones de potencias contra el expansionista, apoyo a las víctimas en guerra,
  crisis diplomáticas iniciadas por el líder, grandes potencias que intimidan al jugador débil, pestaña Diplomacia → Coaliciones (imagen, apaciguar, sobornar).

## Sesión: combate táctico animado
- `src/battleviz.js`: al abrir una batalla se ve el campo con cada división como un grupo de soldados individuales (infantería, caballería, artillería) con movimiento propio, humo, disparos, cañonazos, bajas, lluvia, barra de dominio y avisos de eventos (carga de caballería, carga desesperada, cañoneo, pánico, refuerzos). En las retiradas los soldados huyen dispersos.
- Estrategias por ejército (`STRATS` en military.js): asalto frontal, flanqueo, aguardar en los altos, cañoneo y asalto, hostigamiento, carga masiva. Modifican ataque/defensa/bajas y se representan en el campo. La IA elige (`chooseStrategy`); el jugador fija la suya en el panel de batalla o de ejército.
- Rediseño según vídeos de referencia: la batalla se abre en una ventana grande (lienzo 1440×600), cada soldado se dibuja como cajita y cada división forma un bloque con banderín; flechas curvas grandes para flanqueos/cargas/pánico y círculos brillantes en los momentos clave. Mientras está abierta se pausa el tiempo y el render 3D (`R.skip3d`); botón «Continuar la batalla» para verla avanzar. Al cerrar se restaura el estado.

## Sesión: levas, compra de equipo y rendiciones
- Compra urgente de equipo (pólvora, fusiles…) con recargo del 30% por bien o para una división completa; tarjeta de levas de campesinos (sin cuarteles ni equipo, mal entrenadas, no cuentan para el límite de divisiones).
- Movilización total: levas de campesinos (`spawnLevies`) por todos los estados, débiles pero útiles para defender; se disuelven al bajar de nivel.
- Rendiciones menos agresivas: un ejército sólo se considera cercado si no tiene ninguna provincia propia libre a su lado y se rinde a los 60 días; capitulación del país más exigente (jugador: 8 semanas).

## Sesión: niebla, inteligencia, selección y órdenes
- `src/intel.js`: niebla de guerra (mundo explorado según el rango del país; tropas ajenas sólo visibles en territorio propio/aliado, junto a tus ejércitos o vía agentes) y servicio de inteligencia (niveles, agentes en el extranjero, aviso/frustración de ataques de la IA, alertas de frontera, robo de tácticas +12% 60 días). Pestaña «Inteligencia» en Ejército y guerra.
- Los planes de frente se activan solos al crearse (ataque automático tras ~2 semanas de concentración); si no hay selección, usan los ejércitos libres.
- Las tropas de aliados/ex-enemigos en tierra ajena sin guerra compartida vuelven solas a casa (`homeWeek`).
- Clic en un territorio con un ejército seleccionado lo mueve; clic derecho + arrastrar selecciona todos los ejércitos del recuadro (rotar cámara: botón central o Mayús+arrastrar). Esc deselecciona.

## Sesión: Militar 2 (aviación, marina, doctrinas, plantillas, producción, resistencia, mariscales)

> Nota de arquitectura: el encargo hablaba de esbuild + TypeScript, `src/juego/`, `data/*.json`, `globales.d.ts` y scripts `npm`. Este repositorio es JavaScript plano (`src/*.js` → `build.py` → `index.html` y `juego-ligero.html`), así que se adaptó: módulos nuevos en `src/` registrados en el `order` de `build.py`, datos como constantes JS, guardado en `saveExtra/loadExtra` (`G.mx`) y `c.m2` por país con valores por defecto. Equivalencias: `npm run build` → `python3 build.py`; `npm run comprobar` → `python3 tools/comprobar.py` (sintaxis de todo el código); `npm run prueba` → `node tools/prueba.js` y `tools/prueba_mil2.js`, `prueba_guerra.js`, `prueba_resist.js`, `prueba_aviacion.js`; simulación de 80 años → `node tools/simular80.js`. No existe `fijar-referencia` (no hay partida de referencia).

### Hecho
- [x] **Aviación** (`aviacion.js`): bienes *Motores* y *Aviones*; edificios *Fábrica de Motores* y *Fábrica Aeronáutica* (acero, motores, tela); tecnologías Era 3 *Aviación Militar* (1903), *Cazas* (1910) y *Bombarderos* (1911); escuadrones de hasta 100 aviones desde el inventario nacional, desplegados en regiones aéreas (grupos de estados vecinos); misiones superioridad, apoyo cercano, bombardeo estratégico e intercepción; pérdidas en combate aéreo; `airBonus` (hasta +25%), `airCas` (daño directo en batallas) y reconocimiento aéreo en la niebla.
- [x] **Marina** (`marina.js`): *Astilleros*, buques fragata de vela/vapor, acorazado, crucero, submarino y dreadnought por tecnología; flotas con almirante en 20 zonas marítimas; misiones patrulla, bloqueo, escolta e incursión; batallas navales automáticas; `blockadeScore` (±22 puntos de guerra) y pérdida de ingresos/suministro; los desembarcos sufren pérdidas si el enemigo domina la zona (`navalLandingAttrition`); flotas iniciales históricas y construcción por la IA.
- [x] **Doctrinas** (`doctrinas.js`): experiencia terrestre (combates y entrenamiento), naval y aérea; árbol con ramas excluyentes (defensa en profundidad, ofensiva móvil, fuego superior, movilización de masas; superioridad aérea o bombardeo estratégico; flota de batalla o guerra de corso); `docMod(tag, clave)` con `att/atk/def/org/spd/cost/air/intc/bomb/cas/nav/navdef/raid`.
- [x] **Plantillas** (`plantillas.js`): hasta 9 batallones (infantería, caballería, artillería, ingenieros, ametralladoras, motorizados, blindados); estadísticas, anchura de combate (afecta a cuántas divisiones combaten a la vez), velocidad, coste y equipo; reclutamiento por plantilla; plantillas predefinidas de la IA que se actualizan con la tecnología.
- [x] **Producción por líneas** (`produccion.js`): fábricas militares asignadas a líneas (fusiles, artillería, munición, ametralladoras, aviones, buques); eficiencia 10 %→100 % que cae al cambiar de modelo; generaciones de equipo por tecnología con penalización del equipo antiguo; ventana con déficit; asignación automática de la IA.
- [x] **Resistencia y niebla** (`resistencia.js`, `intel.js`): resistencia por provincia ocupada según la cultura (estado de origen/perfil), guarniciones, penalización de suministro y levantamientos; reconocimiento aéreo en la niebla.
- [x] **Mariscales** (`mariscales.js`): grupos de ejércitos y frentes con bonificación de ataque/defensa y preparación del plan más rápida (el plan da hasta +15 %).
- [x] Manual (sección 16f), pestañas nuevas en Ejército y guerra (Plantillas, Producción, Aviación, Marina, Doctrinas, Ocupación, Mariscales), guardado/carga con compatibilidad de partidas antiguas.

### Decisiones de diseño
- Las plantillas se registran como tipos en `DIVS` (`T<TAG>_<n>`) para no tocar el combate; `dKind(d)` da el arma principal.
- Los arsenales (líneas) compran insumos en el mercado y dejan el equipo en el inventario; aviones y ametralladoras se producen con un suelo de abastecimiento del 70 % para que la IA no dependa de que la industria civil construya fábricas aeronáuticas. La IA invierte en fábricas aeronáuticas/de motores/ametralladoras con la tecnología.
- La cultura se aproxima con el estado de origen del territorio y el perfil cultural de su dueño original.
- Mantenimiento de buques y precios calibrados tras detectar que una flota enorme arruinaba el tesoro de la IA (Francia en bancarrota ⇒ sin ejército).
- Ajustes de equilibrio de la IA: no declara conquistas por encima de 34 estados ni ataca a países ya en 2 guerras; prioriza tecnologías militares clave (grandes potencias).

### Pendiente / limitaciones
- No hay batallas navales visuales ni mapa de zonas marítimas en el mapa 3D (solo en las pestañas).
- Las misiones de escolta tienen efecto agregado, no convoyes individuales; el bombardeo no destruye niveles de edificio, solo reduce su producción.
- Sigue habiendo conquistas fuertes de la IA en 80 años (herencia del juego base: el mundo pasa de ~62 a ~30 países).
- Pendientes de antes: fog of war completa por ejército individual, guerra civil real.

### Resultado de la simulación de 80 años (1836-1916, todos los países con IA, sin errores de JavaScript)
- Aviación: nadie la tiene antes de 1903; hacia 1911 aparece el primer escuadrón y en 1915 siete países operan 47 escuadrones. Marina: de ~600 fragatas de vela en 1840 a acorazados desde 1860, cruceros y submarinos hacia 1900-1907 y dreadnoughts desde 1911.
- Estallan guerras todo el periodo (~19 distintas). Mundo: de ~62 a ~28 países, la mayor potencia llega a 37 estados (no se produce una conquista de medio mundo). **Limitación**: en algunas ejecuciones una potencia (p. ej. Francia) acaba reducida a 1-4 estados; el comportamiento viene del juego base (la comparativa con la versión anterior también muestra colapsos de grandes potencias) y queda pendiente un ajuste fino de la IA de paz y alianzas.

## Sesión: fluidez
- Terreno troceado en 6×4 bloques con **niveles de detalle** según el zoom (3 LOD sin grietas) y **recorte por cámara**: el triángulo por fotograma baja de ~864.000 a ~240.000 en la vista inicial (~82.000 alejado) y la malla ya no se dibuja dos veces (el overlay de fronteras comparte los bloques). Con cámara cerca solo se dibujan los bloques visibles.
- **Resolución adaptativa**: cada 24 fotogramas se mide la carga real de la GPU (`finish`) y se ajusta la escala de resolución entre 56 % y 100 %; botón **Q** de calidad (bajo/medio/alto) guardado en las preferencias; ratio de píxeles máximo 1,25.
- Caché diaria de `eqNeedAll` (era el 30 % del coste del parte semanal): `warWeek` pasa de ~7,5 ms a ~3,5 ms de media.
- Herramientas: `tools/perfil.js` y `tools/perfil_vivo.js` (perfil de CPU de la simulación y del juego en marcha).
- Medido en este entorno (sin GPU real): coste de render por fotograma 62 ms → 12,6 ms en la vista inicial; simulación 3,6-4,3 ms por día; sin errores en las pruebas de humo, de sistemas militares y de resistencia.

## Sesión: IA de guerra v2, ofertas de paz y panel de batalla
- **Panel de batalla arreglado**: con la ventana abierta el tiempo corre a ≥1,8 s por día (antes, a velocidad alta la batalla acababa en segundos y los soldados «se salían») y las tropas aparecen ya desplegadas en el campo.
- **IA de guerra v2** (`src/ia_guerra.js`, `src/ia_operaciones.js`): valoración de provincias, mapa de peligro, defensa proporcionada (presupuesto defensivo que baja cuanto más fuerte es el país), capital protegida ante una amenaza inminente, interceptación de invasores con superioridad, retirada ordenada, tempo ofensivo (ocupar provincia a provincia), ejes de ataque con punto de reunión y doctrina histórica por país (`AI_DOC`). **Operaciones**: pinza, señuelo, emboscada, defensa elástica y golpe de mano; abortan si la capital peligra y liberan a los ejércitos sin orden válida. La versión antigua sigue con `c.aiV = 1`.
- **Ofertas de paz intermedias** (`src/ofertas_paz.js`): exigir, ofrecer o paz blanca, con probabilidad de aceptación (puntuación, cansancio, amenaza a la capital, carácter); la IA propone a jugador y firma entre sí; una paz negociada aplica las condiciones elegidas con la maquinaria de la conferencia (efectos de prestigio menores).
- **Herramientas de prueba**: `tools/prueba_ia.js` (torneo de versiones 1/2/3 por parejas, con `TUNE='{"tempo":-0.15}'` para barridos), `tools/prueba_ia_escenarios.js` (capital en peligro, territorio inútil, pasividad), `tools/ia_diag.js`, `tools/prueba_paz.js`, `tools/prueba_panel_batalla.js`.
- **Resultados de los torneos** (24 duelos nueva-contra-antigua por ronda, ~10 rondas y 5 variantes de parámetros): la IA nueva sufre bastantes menos bajas (≈ −25 a −45 %), mantiene la capital más tiempo (días de capital ocupada 58-120 frente a 77-272) y acaba con más divisiones, pero **ocupa menos provincias** que la antigua en duelos equilibrados (28 frente a 37 en la mejor ronda); con clara superioridad ataca igual de rápido (escenarios dirigidos). La ofensiva en igualdad queda como límite conocido; los barridos de parámetros no dieron una mejora consistente (mucho ruido con 24 duelos).
- **Simulación de 80 años con todo (sin jugador)**: sin errores de JavaScript; ~13 guerras distintas, el mundo pasa de ~62 a ~30 países, la mayor potencia llega a 39-40 estados y ninguna gran potencia colapsa (Francia ≈ 14 estados); en 1915 once países operan 77 escuadrones y la flota incluye acorazados, cruceros y submarinos. Las paces negociadas acortan las guerras sin salida.
