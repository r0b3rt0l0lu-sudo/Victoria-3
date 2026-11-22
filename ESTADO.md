# ESTADO DE SITUACIÓN DEL PROYECTO

Instantánea del proyecto (juego de gran estrategia estilo Victoria 3 + HoI4, 1836–1936). Complementa a `PROGRESO.md` (historial por sesiones) y `README.md` (uso).

## 1. Resumen
Juego de un solo archivo HTML (`index.html`, autónomo) generado por `build.py` a partir de `src/*.js` (~10,3 k líneas en 41 módulos JS + `style.css`) y `vendor/three.min.js` (r152). Mapa 3D con ≈830 provincias, economía por estados, política, diplomacia, guerra terrestre/aérea/naval con IA propia. Sin errores JS en una simulación de 80 años sin jugador.

## 2. Compilación, pruebas y despliegue
- `python3 build.py` → `index.html` + PWA en `docs/` (manifest, service worker red-primero con respaldo sin conexión, iconos).
- `python3 build.py --light` → `juego-ligero.html` (three.js por CDN).
- Pruebas (Playwright/Node) en `tools/`: `prueba.js`, `prueba_mil2.js`, `prueba_aviacion.js`, `prueba_guerra.js`, `prueba_ia.js`, `prueba_ia_escenarios.js`, `ia_diag.js` (torneos/duelos), `prueba_paz.js`, `prueba_panel_batalla.js`, `prueba_naval_visible.js`, `prueba_graficos.js`, `prueba_rendimiento.js`, `prueba_pwa.js`, `prueba_resist.js`, `simular80.js`, `perfil*.js`, `comprobar.py`.
- Alojar `docs/` en GitHub Pages permite instalarlo como app (paso del usuario).

## 3. Arquitectura
- Estado global `G` (países `G.C`, estados `G.S`, provincias `MAP.provs`, ejércitos, batallas, guerras, pactos, propuestas, `G.mx` militar‑2); render `R`; interfaz `UI`. Todos los módulos comparten ámbito global; el orden está en `build.py`.
- Módulos principales: economía/política (`sim`, `crisis`, `politics2`, `national`, `content`), diplomacia (`diplo`, `coalition`, `peace`, `ofertas_paz`), militar (`military`, `mil2`, `provinces`, `logistics`, `aviacion`, `marina`, `landing`, `doctrinas`, `plantillas`, `produccion`, `milecon`, `mariscales`, `resistencia`, `intel`), IA de guerra (`ia_guerra`, `ia_operaciones`), visualización (`render`, `render3d`, `mapsmooth`, `graficos`, `battleviz`, `navalviz`, `cities`), rendimiento (`rendimiento`), UI (`ui`, `ui_mil`, `manual`, `icons`).

## 4. Funcionalidad por área (estado)
| Área | Estado |
|---|---|
| Economía, mercado, pops, leyes, grupos de interés, tecnologías (80), crisis | Hecho |
| Provincias, ejércitos, batallas, ocupación, suministro, atrincheramiento | Hecho |
| Doctrinas, plantillas de división, líneas de producción/equipo | Hecho |
| Aviación (regiones, escuadrones, misiones) | Hecho |
| Marina (20 zonas, flotas, almirantes, bloqueo, desembarcos) y batallas navales visibles | Hecho |
| Resistencia, mariscales, niebla de guerra/inteligencia | Hecho |
| IA de guerra v2: mapa de valor/peligro, presupuesto de defensa, intercepción, ejes, operaciones (pinza, señuelo, emboscada, defensa elástica, golpe de mano), doctrinas históricas | Hecho (ver límites) |
| Ofertas de paz intermedias (jugador e IA), conferencia de paz | Hecho |
| Gráficos: LOD y culling del terreno, nieve/estaciones, agua con espuma, humo, aviones, sombras (calidad alto) | Hecho |
| Rendimiento: detección de hardware, calidad automática, benchmark, perfil Chromebook, presupuesto de tiempo por fotograma, pausa con pestaña oculta | Hecho |
| PWA instalable (`docs/`) | Hecho |
| Historia: guerra civil/secesión por crisis, países dormidos (CSA, rebeldes), eventos históricos (1848, unificaciones alemana e italiana, guerra civil americana, Taiping, Meiji) | Hecho (`src/historia.js`) |
| Moral de ejércitos, prisioneros (puntuación de guerra y devolución en la paz) y coordinación de aliados de la IA | Hecho (`src/moral.js`) |
| Combate: visor táctico por bloques, terreno con efecto real (colina, río con vados, bosques, granja), órdenes del jugador a divisiones, cámara (zoom, arrastre, seguimiento) y repetición | Hecho (`battleviz.js`, `terreno.js`) |
| Armamento tardío: trincheras (nivel 10 con alambradas, reducidas por blindados), bloques de carros de combate y ataque con gas (tecnología Armas Químicas) | Hecho |
| Resúmenes de batalla (en el panel) y de guerra (informe al terminar), botón de batalla siempre visible, asesor contextual 🧭 y arreglos de texto superpuesto | Hecho (`resumenes.js`, `asesor.js`) |
| Épocas alternativas 1861 y 1900 (instantáneas de la simulación incrustadas y selector en el inicio) | Hecho (`escenarios.js`; regenerar con `tools/generar_escenario.js`, copiar la elegida a `escenarios/<año>.b64` y recompilar) |
| Equilibrio: acerías construibles, tope de inversión escalado, recorte de edificios militares ociosos, más capacidad aérea | Hecho |

## 5. Métricas y resultados
- Duelos equilibrados IA nueva | antigua (24): estados 318|286; días con capital ocupada 18|59; bajas 1,55 M|2,13 M; divisiones 1246|1037; provincias ocupadas 17|46.
- Simulación de 80 años: sin errores JS; 9–13 guerras visibles; mundo de 62 → ~24–30 países; GBR ≈ 39 estados; 13 países con aviación (97 escuadrones) hacia 1915.
- Parámetros de IA: `AI_TUNE = {tempo:0, defBase:0.9, reqBase:1.45, ratioDef:0.4}`.

- Simulaciones de validación (6 × 80 años con `tools/simular_balance.js`, semillas y países distintos): sin excepciones ni valores absurdos. Corregido: las acerías eran imposibles de construir (capacidad inicial ≈ 0 al no haber demanda de acero). El precio civil oscila en ciclos de ~6 años (0,5–1,3 × base); probar más reversión a la base (0,012→0,025) no cambió la media de forma apreciable, no se modifica.

## 6. Decisiones de diseño
- Sin Web Worker: se usa presupuesto de tiempo por fotograma (9 ms bajo / 14 ms resto) por la complejidad de compartir el estado global.
- Tauri/Electron no necesarios: navegador + PWA bastan, incluido ChromeOS.
- La calidad manual (botón Q) siempre prevalece sobre la automática.
- Torneos de IA con `G.noOffers` para no falsear resultados con paces IA‑IA.

## 7. Limitaciones conocidas
- La IA ocupa menos provincias que la antigua en duelos igualados (defiende mejor, ataca menos); ruido alto en torneos.
- Rendimiento y gráficos verificados solo con capturas/headless (swiftshader), no en GPU real; el benchmark no se completa en swiftshader.
- Geografía esquemática; mercado único global.

## 8. Ideas pendientes (no solicitadas)
Convoyes reales, guerra civil/secesión, coordinación entre aliados, prisioneros/moral, armamento de época tardía, eventos históricos, espionaje ofensivo, tutorial, informe semanal de guerra, estadísticas.

## Sesión: IA v3, menús grandes y mapas de 1861/1900
- `src/ia_v3.js`: guerras planificadas (alcance, fuerza con aliados, descanso de un año), ejército permanente según amenaza, paces con territorios razonables (`aiMayTake`). Evaluación con `tools/evaluar_ia.js`: 0 conquistas absurdas, el agresor gana 80–100 %.
- Botón **Aa** (`#btn-ui`, `applyUiSize`, `--wz`/`--mz`): tres tamaños de menús y ventanas, guardado en localStorage. Auditoría de ventanas: 0 solapamientos.
- Mundos 1861 (semilla 5) y 1900 (semilla 3) regenerados con la IA nueva; `tools/limpiar_escenario.js` devuelve a un vecino los estados aislados de países no coloniales y a EE. UU. su territorio en 1900.

## Sesión: época 1910 y menús compactos
- Épocas jugables: **1836** y **1910** (se eliminan 1861 y 1900). El mundo de 1910 sale de una simulación de la IA (economía, tecnología) con el reparto territorial de 1910-1914 fijado por `tools/anclar_1910.js` a partir de mapas históricos (imperios coloniales, Alemania e Italia unidas, reparto de África y Asia) y las alianzas de la Entente y la Tríplice.
- Interfaz: barra inferior y datos del país pequeños y pegados al margen; ventanas y paneles desplegables grandes (botón Aa: 1×/1,25×/1,5×, guarda en localStorage). El panel en el que haces clic pasa por delante de los demás (`Z_PANELS` en asesor.js).

## Sesión: táctica y suministros
- `src/suministros.js`: reservas por ejército (comida, agua, pólvora, madera, materiales), ruta de suministro segura (si se corta no hay reposición), hambre/sed/pólvora con efectos reales, aviso al jugador, líneas de ruta en el mapa y botón 📦 Rutas.
- `src/tactica.js`: fase de preparación (el combate se detiene al empezar), despliegue por arrastre, fuertes (trinchera, reducto, batería, cañones, fuertes del mapa) con coste en reservas y bonos reales, planes dibujables por unidad (atacar, objetivo, flanqueo, línea defensiva, retirada) editables en combate, cámara lenta (⏸/×0,25/×0,5/×1), cansancio y moral con retirada ante cargas de caballería, terreno más detallado (pantano, laguna, roquedal, aldea amurallada, loma extra, camino).

## Sesión: convoyes, artillería y IA v3.1
- `src/convoyes.js`: convoyes de suministro (capturables sin escolta), depósitos construibles/saqueables/incendiables, marcadores 🚚/📦 en el mapa, guardado en partida.
- Artillería (en `tactica.js`): alcance real, elección de objetivo, contrabatería, baterías silenciadas, botón 🔇.
- IA v3.1: `aiSidePower` cuenta aliados, bloque y garantes; los aliados inalcanzables entran menos en guerras (reduce cascadas mundiales).
- `tools/evaluar_ia.js` admite 1836/1910 y mide hambre, rutas cortadas y máximos de guerras y beligerantes simultáneos.

## Sesión: gráficos, efectos y música
- `src/aspecto.js`: soldados, jinetes, cañones y servidores con más detalle; fuertes con texturas, banderas, daños, fuego y humo; cráteres, resplandor aditivo, viñeta, tinte por hora y temblor al impactar.
- `src/inicio.js` + CSS: panel de inicio con partículas, niebla, rayos de luz, giro lento de cámara y logo/botones animados.
- `src/musica.js`: banda sonora procedural WebAudio (menú, paz, guerra, batalla), efectos (cañón, fusilería, corneta) y botón 🎵.

## Sesión: combate avanzado (11 puntos)
- `src/tactica2.js`: IA táctica (guarnece fuertes, flanquea, fija débiles, se repliega/cambia de posición ante flanqueos), ríos solo por vados y lagunas rodeadas, cañones de fuerte (auto/objetivo) y daño diario, captura de fuertes vacíos, cercos con rendición y prisioneros (liberar, trabajos, canje, rescate, reclutar, ejecutar), tropas comprometidas (`d.out`), flanqueo hasta +40 %.
- `military.js`: más bajas (org ×1,33, fuerza ×2,1), batallas desde el día 4, puntuación de guerra con más peso de victorias y bajas, `d.out` excluye divisiones.
- Trincheras girables (`f.rot`), guarnición oculta con soldados dibujados en el fuerte (`aspecto.js`), las tropas no se retiran solas (solo si quedan sin hombres u orden de retirada; la caballería solo rompe a tropas cansadas o desmoralizadas).

## Sesión: campo de batalla estilo mapa de campaña
- `src/campo.js`: regimientos (cada división = 3, `mkReg`/`regsOf` con fuerza y organización repartidas), cuerpos de 5 con estrategia propia (`b.cstr`) y cañones repartidos (`b.cgun`), reservas fuera del campo que entran por el margen, avance en línea, subcuadrados separados que adelgazan, mando de batalla simplificado (`tacMandoHtml`), IA por cuerpos y por terreno (despliegue, estrategias, aldeas).
- `src/terreno2.js`: terreno amplio (colinas, bosques, ríos con vados/puentes, lagos, pantanos, aldeas, caminos, muros, rocas, acantilados, dunas, nieve), `bvTerrAt`, `bvBuildBg`, `terrMods`, `terrainInfo`, esquiva de obstáculos.
- Mundo de batalla 1920×840; fuertes con más integridad; sin trincheras antes de 1900 (también sin bono de atrincheramiento).

## Ajustes recientes
- Infamia: sube ~55% mas lento (declaracion x0.45, gas +3, prisioneros menores) y decae 1.4/mes.
- IA: `aiConsolidate` (ia_v3.js) fusiona ejercitos hasta 7 divisiones (media medida 4-6 por ejercito).
- Batalla: regimientos se acercan y combaten cuerpo a cuerpo (`tacMelee`, `bvWantsAssault`) ademas de disparar a distancia; animacion de fogonazo/humo al disparar (`bvPlate`, `bvFire`).

## Realismo (fase 2)
- `src/realismo.js`: `weapLvl`, coste del ataque frontal (`sideStats` envuelto), convergencia de ejercitos, metralla (`tacCanister`), guerrilla sobre convoyes/depositos. Caballeria vs fusil en `tacMelee`; asedios con artilleria de acero y enfermedad. Pendiente: friccion de ordenes y mas mando.

## Campo de batalla 2
- `src/campo2.js`: `battleWeather`, `wxMods`, `terrMods` ampliado, `tacLos` (linea de vision), huellas/manchas/aldeas ardiendo, capa de clima en `bvPost`, fondo con hierba, orillas, relieve iluminado y estaciones. Arnes de pruebas: ver scratchpad `stress.js` (24 batallas aleatorias sin errores).
- Corregido: `ty` era `const` en `tacMelee` y rompia el melee de caballeria en eras con fusil rayado.

## Mando en el campo (src/mando.js)
- `bvEdgeFor`: entrada por flanco segun `a.from`; comandantes de cuerpo (`bvCmdStep`, `bvCmdKill`, venganza con `blk.venge`); `ACT.tacstay` (mantener posicion, `d.stay`); version abstracta de la muerte del comandante en `battleDay` sin visor.

## Linea y maniobras (src/linea.js, ESTUDIO_LINEA.md)
- Guia por cuerpo + slots (`fmSlot`, `fmUpdate`), ordenes `FORM` (fadv, fchg, fenv, fech, fref, frea, fret) en `b.cplan`; `fmIntegrity` (huecos/flancos abiertos -> `b.coh` en `sideStats`), IA `fmAi`, regla de linea unida por bando (`V.sideCx`).

## Ejercito (src/ejercito.js)
- `armyOrder` (ordenes de ejercito coordinadas), segunda linea (`b.sup`, `r.sup`, `supFeed`), persecucion en `endBattle` + viewer, friccion de ordenes (`fmFriction` en linea.js: `pl.t0` con retraso, `pl.mis`).

## Relieve real
- `tools/elevacion.py` (teselas Terrarium de AWS) genera `src/elev_data.js` (malla 512x205: altitud x25 m, rugosidad x10 m); `src/relieve.js`: `elevAt`, `provElev`. `battleTerrain` escala colinas/acantilados/nieve/bosques segun el relieve; `terrMods` da bonos en montaña.

## Terreno jugable (src/campo3.js)
- Terreno por provincia (semilla = provincia), barrancos (`tf.ravine`, pasos), alturas sin defensa plana (artilleria +alcance, `p.hi`), puentes de pontones (`b.pont`, `tacPontoon`), sectores `fsec` y `armyLine` (linea general).
- Arreglo: los wrappers de `bvBuildBg` usan `setTransform` (el original dejaba la escala aplicada).

## Pintura (src/pintura.js, ESTUDIO_MAPA.md)
- `bvBuildBg` final: fondo pintado por bioma (`PAL`), capas base (desenfoque) y objetos (bosques/aldeas), rotulos de aldeas/rio (`NAME_POOLS`), rios w=13, arroyo w=5, barranco w=18, aldeas x0.74, unidades x0.7 (`BV_FORM`), `cap=34` por columna.

## Paletas y fuentes (assets/)
- `assets/paletas_biomas.json` -> `PAL` y `PAL_LAB` en `src/pintura.js` (colores, estilo de arbol por bioma, rotulos); `assets/fuentes.md`: Lora para rotulos del mapa (Google Fonts), Cinzel/Lato para la interfaz.

## Sesión: pueblos con nombre, mando unificado y tácticas realistas
- `src/pueblos.js`: 3 pueblos con nombre por provincia (listas por lengua); cada batalla se libra en uno (`battleSite`, `b.site`) y su tipo (cruce, puente, altura, bosque, amurallado, vado) moldea el terreno (`applySite`). El título muestra «Batalla de <pueblo> · <provincia>».
- `src/mando2.js`: panel de mando unificado (6 órdenes + Quedarse; cuerpo entero = maniobra de línea; plan de ejército aparte). Eliminados los envoltorios duplicados de `tacStayBtn` y `tacMandoHtml` antiguo.
- `src/batalla2.js`: carga por oleadas, flanqueo con línea que avanza y cierra huecos (`bvFillY`), pánico de cuerpo, asalto a fuertes. Ver `ESTUDIO_BATALLA.md`.

## Mapa 3D, fase 1: relieve y color (src/relieve3d.js)
- Altura de dibujo `R.hr` (1024×410) desde la altitud real SRTM/GEBCO (`elevAt`) con detalle procedural según la rugosidad; `metersToY` (exageración suave). `MAP.height` (juego) no cambia. Costa bajada con `MAP.dLand`, fondo marino con `MAP.dSea`.
- `terrainY(lon, lat)` / `terrainYPx(px, py)`: altura del suelo dibujado; la usan ciudades, chimeneas, humo, fuego y figuras.
- Texturas del shader: `R.reliefTex` (normales + altitud en metros) y `R.coastTex` (distancia con signo a la costa, suavizada, + dirección hacia tierra). El shader Lambert del terreno (`reliefShaderPatch`) usa normales por píxel, sombreado con luz configurable, roca en pendientes, línea de nieve real por latitud y estación (≈2600 m en los Alpes en verano), costa suave y bordes de bioma orgánicos en el modo Terreno, y detalle a dos escalas sin repetición visible.
- `buildTerrainColors` reescrito: colores por bioma (`BIOME_COL` + `PAL`) y altitud real, sin sombreado horneado; la montaña/nieve procedural del juego ya no pinta manchas blancas.
- Parámetros: `R.reliefK` (0–1, por defecto 0,75; los modos no-terreno usan el 60 %; guardado en `victoria-map-prefs.relief`, `setReliefStrength(k)`), `R.lightAz`/`R.lightAlt` (315°/48°, `setReliefLight(az, alt)`; el sol baja 12° en invierno).
- Calidad baja (`RELIEF_LOW`): sin costa suave, sin bordes orgánicos y una sola escala de detalle.
- Agua: corregido el fallo que pintaba rayas (el shader leía `position.xz` de un plano local, siempre z = 0); el oleaje fino se desvanece con la distancia (`fwidth`).
- Coste relativo medido con SwiftShader (render de un fotograma, vistas continental/regional/ciudad): bajo +9/+20/+12 %, medio +21/+27/+21 %, alto +13/+17/+27 %. Carga: +~0,5 s.

## Mapa 3D, fase 2: agua, costa y ríos (src/agua.js)
- Agua animada nueva (`upgradeWater`): espuma de orilla y rompientes a partir de la distancia suavizada a la costa (`R.coastTex`), sin escalones; reflejo del cielo por Fresnel según la inclinación de la cámara; brillo del sol en la dirección de `R.lightAz`/`R.lightAlt`. El oleaje fino se desvanece con la distancia.
- Uniformes nuevos en `R.waterU`: `waterQ` (0 en calidad baja: sin reflejo ni brillo), `coastMap`, `sunW`, `skyZ`/`skyH` (colores del cielo). `foamK` sigue a `R.lowEnd`.
- Plataforma continental: aguas turquesa junto a la costa y degradado de profundidad hasta 70 px de mar, en la textura del terreno (se ve también con la animación apagada).
- Ríos como cintas (`buildRiverRibbons`): `addRivers` guarda ahora `MAP.riverPaths` (solo dibujo; la jugabilidad no cambia). Trazados suavizados (Chaikin), más anchos río abajo y con afluentes, con ancho mínimo en pantalla (≈1,4 px, `R.riverU.pxW`) y corriente animada (desactivada en calidad baja). Una llamada de dibujo. Los ríos pintados en la textura quedan tenues (minimapa).
- Coste relativo frente a la fase 1 (SwiftShader): dentro del ruido de medida (±5 %).

## Mapa 3D, fase 3: vegetación y suelo (src/vegetacion.js)
- Árboles instanciados (4 `InstancedMesh`: frondoso, conífera, palmera, matorral) colocados al cargar por bioma, altitud real (límite del bosque `treeLineAt`: ≈1900 m en los Alpes) y pendiente; palmeras en oasis y riberas del desierto y en el trópico. ≈140 000 candidatos (≈140 ms de carga).
- Solo se dibujan los cercanos a la cámara (`R.cam.dist < VEG_DIST = 72`), rellenando las instancias al moverse (`refreshVegetation`), con tope por calidad `VEG_CAP` (bajo 0, medio 5000, alto 14000) y aclarado progresivo al llegar al límite. En los modos que no son Terreno, 40 % de densidad.
- Color por estación: copas ocres y rojizas en otoño (fuera de los trópicos), ramas desnudas y escarcha en invierno.
- Shader del terreno: dunas en los desiertos (máscara en el canal A de `R.reliefTex`, se apagan a lo lejos), nieve azulada en laderas fuertes y hielo marino polar (permanente desde ~78°, en invierno desde ~66°). Desactivado en calidad baja salvo el hielo y la nieve.
- Coste relativo frente a la fase 2 (SwiftShader, modo político): bajo sin cambios; medio +10 % (regional) y +18 % (ciudad); alto +10 %/+9 %.

## Mapa 3D, fase 4: ciudades, puertos y comunicaciones (src/ciudades3d.js)
- `buildCities` reescrito: núcleo en cuadrícula de calles con plazas, tamaño según la población (hasta 70 casas, radio 0,13° + √pob/6000), casas más altas en el centro de las grandes ciudades y aldeas de 2–6 casas en el resto de provincias (≈6000 casas en total; calidad baja: la mitad y sin aldeas).
- Estilo por región (`cityStyle`): europeo (tejas o pizarra, iglesia), ruso (cúpula de bulbo), Oriente Medio y norte de África (azoteas, cúpula y minarete), Asia oriental (tejados oscuros, pagoda), sur de Asia (azoteas ocres, cúpula blanca) y África subsahariana (chozas redondas). Monumento en las ciudades de más de 380 000 habitantes.
- Las casas ya no se tiñen con el color del país (`updateCityColors` no hace nada): lo político lo dice el mapa.
- Puertos: muelle, almacenes y hasta 3 barcos amarrados en la provincia costera (`portProvOf`) de cada estado de más de 120 000 habitantes (sin barcos en calidad baja).
- Caminos (`buildRoads`): entre cada capital de estado y sus 3 vecinas más cercanas a menos de 7°, solo por tierra; trazado curvo suave. Ferrocarril (`rebuildRails`) en los tramos cuyos dos extremos pertenecen a países con la tecnología `railways`; se comprueba cada mes. Cintas con ancho mínimo en pantalla; los caminos se desvanecen a partir de distancia 55 y el ferrocarril a partir de 150. En modos no-terreno, al 60 %.
- Ciudades visibles por debajo de distancia 36. Árboles algo más pequeños de cerca para no tapar las casas; en invierno, ramas pardas.
- Coste relativo frente a la fase 3 (SwiftShader, mismas vistas, ciudades bien ocultas al alejarse): medio +0–7 %, alto +0–13 % (vista de ciudad); bajo dentro del ruido salvo la vista regional (+10–18 %).
- Herramienta de medida: las capturas llaman ya a `updateCityVisibility()` tras mover la cámara (antes las ciudades se quedaban visibles en la vista continental de la medición).

## Mapa 3D, fase 6: rótulos, fichas y panel gráfico (src/rotulos.js)
- `updateLabels` reescrito: países, ciudades y estados se colocan juntos por prioridad (países 2000+, grandes ciudades 900, capitales +200, estados 500, ciudades menores 300–620) y el que choca con uno ya colocado no se pinta; una ciudad prueba antes a poner el nombre encima del punto. Anclados a la altura real del suelo (`terrainY`) y con fundido de opacidad según la distancia. `updateCityLabels` queda vacío (lo hace `updateLabels`).
- Fichas: los ejércitos del mismo país en el mismo sitio se agrupan en una ficha («×n», suma de divisiones) cuando hay más de 3 fichas allí, salvo el seleccionado, los que combaten o se mueven. Las flotas extranjeras sin guerra solo se ven de cerca. `declutterTokens` reparte en rejilla de dos columnas y esquiva los nombres de países y grandes ciudades (`R.labelRects`).
- Panel gráfico (botón ☀ junto a Q, `ACT.gfxpanel`): calidad, intensidad del relieve 0–100 %, dirección de la luz, bosques, caminos y ferrocarril, nombres de estados. Se guarda en `victoria-map-prefs` (`relief`, `lightAz`, `veg`, `roads`, `sl`).
- Coste: solo CPU al mover la cámara; sin cambios medibles en el render.

## Formato por carpetas + PWA
- `build.py` produce `docs/` (index.html + js/ + css/, caché por contenido, service worker versionado) y el `index.html` de un solo archivo en la raíz (pruebas). Probado con servidor HTTP y con `file://`: 0 errores, 12 peticiones, SW registrado.

## Sesión: datos binarios, minificado y WebAssembly
- `build.py` reescrito: minifica con esbuild (`package.json`), datos binarios (`docs/data/*.bin`, carga lazy de la época 1910, respaldo base64 para `file://`), cargador `js/boot.js`, WebAssembly instanciado antes del juego (`window.__WK_EX`).
- `wasm/kernels.c` + `src/wasmk.js`: `k_height`, `k_biomes`, `k_terrain`. **Verificado idéntico bit a bit** al JS (alturas, biomas y colores). Medido (headless, SwiftShader): altura 152 ms vs 221 ms JS, biomas 85 vs 160 ms, terreno ≈ igual (domina `addRivers`, que sigue en JS) → ahorro total ≈ 0,15 s en un arranque de ≈ 6 s. Sin la caché de retícula el wasm era *más lento* que el JS: la ganancia viene del algoritmo, no del lenguaje; la misma caché aplicada al JS daría una mejora parecida.
- Hallazgo del perfil de arranque: lo que más pesa no es la generación del mapa (~1 s) sino la economía de calentamiento (`econA`, `econB`, `weeklyTick` ≈ 2 s) y `rasterLand` (canvas).

## Sesión: guardado y diplomacia realista
- **Guardado** (`src/guardado.js`): ahora comprimido con gzip (1,75 MB → 0,56 MB; la partida crece ~35 KB/año y en texto plano habría tocado el tope de localStorage hacia 1920), con **copia anterior** (`SAVE_KEY-prev`) y recuperación automática si la principal está dañada, carga de guardados antiguos sin comprimir y botones 📤/📥 para **exportar/importar** un `.sav`. Probado: guardar→cargar→guardar es fiel (solo cambia el orden de listas y el flag `ai` del jugador), con batalla abierta, corrupción simulada y formato antiguo. Encontrado y corregido un error propio en la validación del formato.
- **Diplomacia** (`src/diplo2.js`): opinión estructural (la relación deriva cada mes hacia un objetivo: vecindad, reclamaciones, pactos, bloques, enemigo común, ideología, prestigio, infamia y **rencor**), honor/credibilidad de los tratados, llamadas a las armas con decisión (defensiva ≈ 0,9; ofensiva ≈ 0,4; el honor y las odds la modulan; negarse a defender cuesta honor −10 y relación −18), aceptación de pactos con criterio (credibilidad, rencor, reclamaciones, sin amenaza común). Interfaz: tooltip de opinión con factores, credibilidad y rencor. Resultado en 11 años: alianzas 23 (frente a 42 sin estas reglas) y más enemistades y amistades marcadas. `window.__NO_D2 = true` desactiva las reglas nuevas para comparar.

## Sesión: arreglo del arranque tras recargar y pantalla inicial v2
- **Bug grave (introducido con el formato por carpetas/WebAssembly):** `main.js` esperaba el evento `load`, pero el juego se inyecta después de cargar el WebAssembly y los datos; si `load` ya se había disparado, la página se quedaba en «Cargando…» y **parecía que el guardado no funcionaba** (al recargar no volvía a aparecer el juego). Ahora arranca ya si `document.readyState === 'complete'`. Verificado: guardar (💾) → recargar → «Continuar» → partida restaurada, en `index.html`, `docs/` por HTTP y `docs/` con doble clic.
- **Pantalla inicial v2** (`ui.js`, `guardado.js`, CSS): panel de país como tarjeta con pie fijo (Comenzar / Continuar siempre visibles), opciones plegables con resumen («Normal · 3 reglas · IA normal»), **tarjeta «Continuar partida»** con país, fecha y tamaño (meta guardada junto a la partida), filtros Todos/Fácil/Media/Difícil con contador, búsqueda con «/», flechas ↑↓ e Intro, recuerda el último país elegido, sin avisos tapando el botón y diseño adaptable (móvil con barra de acción fija).

- **Elegir país en el mapa (pantalla inicial):** el mapa se puede arrastrar y acercar con la rueda mientras se elige; al pasar el ratón sobre un país aparece su ficha (régimen, rango, dificultad) y **un clic lo elige** (el panel y la lista se actualizan, sin recentrar la cámara; el país elegido se resalta y el resto se atenúa). En móvil, botón «🗺️ Elegir en el mapa» con barra inferior «✔ Elegir este país». Corregido de paso: tras «Continuar» la clase `starting` del body no se quitaba (ocultaba los avisos).

## Sesión: tropas 3D en el mapa
- Integradas las tropas 3D de Claude Design en el mapa de campaña con reserva a las figuras antiguas (detalle y pruebas en `PROGRESO.md`). Pendiente: visor de batalla en 3D, sombras de tropas y reserva en CPU.

## Sesión: pulido visual de la interfaz en partida
- **Arreglo de solape:** el panel de estado/ejército no tapa ya el menú inferior (la altura máxima se multiplicaba por el zoom de la interfaz `--wz`; ahora se divide). Comprobado en 1100×680, 1500×860 y 1900×1000: siempre queda ~30 px sobre el menú.
- **Ventanas:** al abrir una, el mapa se atenúa, los paneles laterales se apartan (`body.win-open`) y vuelven al cerrar; se oculta el tooltip pendiente. Entrada animada con las propiedades `translate`/`scale` (no pisan el centrado de la ventana).
- **Pulido general (final de `style.css`):** cifras tabulares, barras de desplazamiento finas y doradas, anillo de foco visible con teclado, respuesta al pulsar los botones, sombras con profundidad y respeto a `prefers-reduced-motion`.

## Web Worker (arranque)
- `src/workers.js`: `buildMap()` + `initGame('GBR')` se ejecutan en un Worker (mismo código del juego, DOM simulado, OffscreenCanvas) y devuelven MAP (transferido) y G (clonado). La página sigue respondiendo durante la carga (283 vs 46 fotogramas; mayor bloqueo 0,5 s vs 2,4 s); el tiempo total es similar.
- Respaldo automático al camino síncrono si no hay Worker/OffscreenCanvas, falla, o pasan 60 s. Desactivar: `?sinworker`.
- La simulación diaria sigue en el hilo principal (comparte G con la interfaz).
- Verificado: MAP idéntico byte a byte; tras 365 días el PIB total coincide con el camino síncrono (0,01 %).

## Ranuras de guardado
- `src/ranuras.js`: «Automático» (el de siempre, con copia anterior) + 5 ranuras manuales (`SAVE_KEY-slotN`, comprimidas, con metadatos). 💾/📂 abren el gestor (guardar, cargar, borrar, exportar/importar); en la pantalla inicial, «Partidas guardadas…». «Continuar» retoma la más reciente de todas.
- Arreglo del worker: tras recibir G se llama a `tplRegisterAll()` (las plantillas de división viven en la tabla `DIVS` del módulo, que no viaja con G). Sin esto la IA fallaba al reclutar. Verificado: 730 días sin errores con worker.

## Ejército: auditoría de solapamientos (90 vistas × 5 tamaños)
- Reclutamiento: tabla con desplazamiento propio (`.tblx`) y columnas apiladas (`.cols.stack`); Doctrinas e Inteligencia: descripciones en su propia línea. Resultado: 0 problemas.
- Prueba de jugabilidad con clics reales (empezar, avanzar, 14 pestañas de Ejército, reclutar, mover, guerra, batalla 20 s, guardar/cargar ranura, simular 1 año): sin errores de página.

## Visor de batalla 3D y realismo 3
- `src/batalla3d.js`: la misma simulación del visor 2D dibujada en 3D (suelo con relieve y textura del 2D, árboles, casas, muros, fuertes, soldados/jinetes/piezas con tropas3d.js, humo, fogonazos, obuses, lluvia, caídos y heridos). Se dibuja con el renderizador del mapa (parado durante la batalla) y se copia al lienzo del visor. Cámara libre (arrastrar, botón derecho, rueda, doble clic), selección y órdenes funcionan igual. Botón «Ver en 3D»; por defecto activo salvo en calidad baja; respaldo automático al 2D (`R.b3Dead`).
- `src/realismo3.js`: pendiente, barro, incendios de bosque, hora del día (batalla) y enfermedad/heridos (campaña). Calibración medida: selva −21 % de fuerza en 200 días frente a −0,7 % en terreno templado; bosque seco prende el 71 % de los obuses, con lluvia el 7 %.

## Auditoría de jugabilidad (robustez)
- Un error en un fotograma o en un día de simulación ya no congela la partida: `frame_` y el bucle de días atrapan la excepción (`reportErr`), la registran una vez por tipo y siguen.
- Espiral de deuda: el interés ya no crece sin límite con la deuda; una deuda desproporcionada (>110× ingresos) fuerza la quiebra aunque haya otra en curso; red de seguridad ante valores no finitos. Antes Corea llegaba a tesoro −∞.
- Paz blanca: se acepta siempre tras 20 semanas (antes 40). El consejero avisa de guerras estancadas (sin combates ni ocupación) y explica qué hacer.
- Comprobado: 30 años con Reino Unido y Rusia y 20 con Japón, EE. UU. y Otomano sin excepciones ni datos corruptos tras el arreglo; controles de ratón/teclado, guardar/cargar, reclutar, mover, declarar guerra y paz.

## Interfaz simplificada (`src/interfaz.js`)
- Barra superior 11 → 4 botones: 🧭 asesor, 🔍 buscar, 💾 Partidas (guardar/cargar/exportar/importar en un solo gestor), ☰ menú (Diario, Logros, Manual, Música, Salir).
- Controles del mapa 13 → 6: zoom, inicio, giro y ☀ «Vista y gráficos» (calidad, relieve, luz, árboles, caminos, nombres, rendimiento, inclinar, rueda, borde, agua y nubes, tamaño de la interfaz). Los botones antiguos siguen en el DOM, ocultos, para el resto del código.
- Ventanas con muchas pestañas (Ejército 14, Diplomacia 8): dos niveles (sección + pestañas de la sección). Ejército: Ejército · Reclutar y equipar · Guerra · Aire y mar.
- Móvil: ya no hace falta el botón «⋯».

## Eras 4–5, puertos, batalla naval 3D y épocas 1939 / 2020
- `src/eras45.js`: eras 4 (guerras mundiales, desde 1920) y 5 (información, desde 1970) con 23 tecnologías (radar, guerra mecanizada, portaaviones, reactores, energía atómica, computación, misiles guiados, sigilo, drones, ciberguerra…), 5 batallones nuevos (mecanizada, carros medios, autopropulsada, carro moderno, misiles) y 6 buques (destructor, portaaviones, acorazado rápido, submarino nuclear, destructor lanzamisiles, superportaaviones). La ventana de tecnología recorre todas las eras.
- `src/puertos.js`: `fleetDock(f, estado)`; las flotas atracadas (`f.port`) se reparan rápido (más con astillero), salen de la zona de combate y no protegen/bloquean; si el puerto cae se pierde parte de la flota. Los buques botados atracan en su astillero. La IA ataca/atraca según guerra y daños. UI: selector «⚓ Llevar a puerto…» por flota en la pestaña Marina.
- `src/naval3d.js`: vista 3D de la batalla naval (mar animado, buques modelados por tipo con bandera nacional, humo, fuego, disparos, hundimientos; cámara orbital con ratón/táctil). Comparte opción con el visor 3D terrestre (`victoria-bv3d`); botón «🧊 Vista 3D/🗺️ Vista 2D» en el panel naval. `nvHud` (navalviz.js) es el HUD 2D común.
- Épocas **1939** (invasión de Polonia, 1-sep-1939) y **2020**: `tools/anclar_epoca.js <año> escenarios/1910.b64 escenarios/<año>.b64` parte del mundo de 1910, fija fronteras por nombre de estado, reutiliza países dormidos para naciones nuevas (Polonia, India, Israel…; `src/paises_epoca.js` añade 18 etiquetas nuevas), reparte tecnologías por rango, pone alianzas/rivalidades y (1939) declara la guerra. `scenModernize` (escenarios.js) renueva divisiones y flotas al cargar. Limitaciones: mapa de 272 estados basado en 1836 (fronteras aproximadas), economía sin petróleo ni bienes modernos, gobiernos/leyes heredados de la simulación.

**Actualización:** se eliminó la era moderna: ya no existen la era 5, la época de 2020 ni sus tecnologías, batallones y buques (superportaaviones, submarino nuclear, destructor lanzamisiles, carro moderno, misiles). Quedan la era 4 y la época de 1939.

## Tácticas, campañas, guerra total, eventos y hot-seat
- `src/tacticas2.js`: torpedos (p = 0,2·fuerza/(1+0,35·escoltas)), artillería pesada a distancia, bruma/noche con y sin radar; test (`scratchpad/tc.js`, 200 ensayos): con torpedos el rival pierde 0,56 de casco/día frente a 0,33 con línea estándar; evasiva 0,11. Aire: bombardeo bajo pierde 12 bombarderos (alto 5,3; sin escolta 8,8; tormenta 4,2) en 12 días.
- `src/aire3d.js`: las luces ambiente/hemisférica se atenúan de noche (0,22) y con tormenta (0,65). Comprobado el visor naval de noche y tormenta (estelas de torpedos visibles).
- `src/campanas.js`: campañas con metas relativas a una «foto» inicial (`c.camp`), victoria/derrota/parcial y puntuación; hot-seat (`G.hs`, turnos de 1/3/12 meses, pantalla opaca); menú ☰ con 🎯, 👥 y 🌐. Se guarda vía `saveExtra`/`loadExtra`.
- `src/guerra_total.js`: bloqueo comercial (acecho vs. escoltas, repartido entre enemigos), hundimiento de submarinos, bombardeo estratégico sobre la moral, convoyes escoltados y movilización total.
- `src/eventos3.js`: 26 acontecimientos históricos 1839–1939 con opciones; la IA aplica `ai` (índice de opción).
- Pendiente de verificar con GPU real: visores 3D (probados en SwiftShader). El bloqueo puede ser severo en guerras mundiales con muchos beligerantes: vigilar en simulaciones largas.

## Movilización: levas según población y estados ocupados
- Tope de levas simultáneas `levyCap(c)` = población/5 M, entre 3 y 20 (RUS 99 M → 20, USA 69 M → 14, Dinamarca → 3). Un estado ocupado por el enemigo (`s.occ` > 0,05 o la provincia capital en manos hostiles) no puede alzar levas ni reclutar (`isOcc`, en `spawnLevies`, `canLevy` y `canRecruit`). Probado con Rusia en 1939 y 6 estados ocupados: 20 levas, ninguna en ellos.

## Combate en ruta, zonas de combate, almacén de partidas e industria
- `src/combate_ruta.js`: `stepMove` envuelto; dos ejércitos hostiles en sentidos opuestos por la misma arista combaten cuando sus avances suman ≥ 1 (batalla con `road = {from, to, t}`, mecánicamente en la provincia más cercana, marcador en `battleAt`, sede `roadSite`); los que llegan a cualquiera de las dos provincias se suman (`createBattles` envuelto). Probado: PRU/BAV chocan el día 2 y el visor muestra «la venta del camino».
- `src/zonas.js`: 8 sedes nuevas (desfiladero, fortaleza, calzada, llanura, pedregal, camino, oasis, ventisca) con terreno y objetivos propios; `provTowns` filtra por bioma. Comprobadas sin errores en el visor 2D.
- `src/almacen.js`: partidas en IndexedDB con verificación de escritura, marca `-idb` y metadatos en localStorage (fallback a localStorage); autoguardado cada 3 meses, 2 min reales y al ocultar la pestaña; `G.tw` y la IA de los humanos del hot-seat se restauran al cargar. Con una batalla abierta la partida pesa ~3,2 MB en JSON (el terreno de la batalla `b.tf` se guarda); comprimida ~1 MB.
- `src/industria.js`: ventana 🏭 Industria (tecla 0): recomendador de obras por rentabilidad y paro, constructor por estado, cola reordenable, 5 programas de impulso (`c.prog`, vía `ecoMods`) y resumen industrial.

## Mapa v2, tropas v4 y vista de soldado
- Mapa v2 integrado desde `mapa_v2.zip` (costas NE 1:10m, ríos reales, fronteras por coste anisótropo, sombreado WebP 4096 y 8192, estilo atlas). `build.py` orden: `geo_v2_data, cover_v2_data, prov_seeds_v2, state_bias_v2, geo_v2, mapgen, provinces, validar_v2` y `rasters_v2, rasters_alto_v2, pintura_v2, etiquetas_v2, render_v2` tras `render.js`. `agua.js` solo dibuja como cinta los ríos de orden ≥ 3; `calidad.js` tiene el selector «Estilo del mapa» (`victoria-mapstyle`). `mapValidate()`: 380 estados, 995 provincias, 1315 ríos, 0 errores. Compatibilidad probada: partida v1 (150 días) → v2 + 200 días sin errores y escenarios 1910/1939 + 200 días. `index.html` pasa de 4,7 a ~6,8 MB; un zip (3,9 MB) supera el límite del conector de Drive.
- Tropas v4 (`src/troops3d.js`, fuentes en `tools/tropas/src`, `build.sh` nuevo con `c2_detalle`, `e2_anim`, `i_para`); LOD0 del visor de batalla a 45 m.
- `src/soldado3d.js`: botón 🪖 Ver como soldado (cámara en 1.ª/3.ª persona; Q/E, R, V, Esc/X). No afecta a la simulación. Probado con una batalla en ruta: botón visible, soldados cambian, la figura seguida se oculta en 1.ª persona.

## Vista de soldado, fase 2: control manual (`src/soldado3d_ctrl.js`)
- C entra/sale del control; WASD, Mayús, Espacio, Z, F, Tab. El avatar se dibuja en la primera llamada a `b3Fig` de cada fotograma (el hueco de la formación se oculta con `B3.hide`). Efectos acotados: 14 hombres por impacto (`HERO_MEN`) con tope de 30 impactos por batalla (`V.heroHits`), +0,004 de moral por impacto, +0,006/s con el estandarte, −0,12 si cae el abanderado, riesgo de caer 1,2 %/s bajo fuego. Solo infantería (caballería: pendiente).
- Probado (SwiftShader): movimiento y carrera, 12 disparos con 5 impactos (la división enemiga bajó de 0,969 a 0,959), rodillas y estandarte, muerte (clip de caída) y paso a otro soldado. El temporizador de la caída usa tiempo real.

## Combate: sin retiradas espontáneas · control del soldado v3
- `src/batalla_firme.js` + `battleviz.js` + `military.js`: los bloques ya no retroceden solos (aturdimiento `brk`, pánico, gas, repliegue de escaramuza → se quedan en su puesto); la batalla termina cuando la organización cae al 6 % (4 % con «mantener posición») o con retirada ordenada (`b.retreatA/B`, botón «🏳️ Ordenar retirada», orden general en el visor `V.retreatAll`); la IA ordena retirada si < 22 % de organización, < 45 % de la del rival y ≥ 6 días (6 %/día). `b.orderly`: −4 % de moral en lugar de −12 % y sin riesgo para el general. Probado: batallas de 12–21 días; con orden a día 3, termina el día 4.
- `src/soldado3d_ctrl.js` (v3): primera persona por defecto (ratón con captura al hacer clic; arrastrar como respaldo), movimiento libre por todo el campo a velocidad de tropas con el combate a ×0,25, disparo por rayo 3D desde la mira con bajas individuales (`V.kmap`/`V.klist`: caída hacia atrás/adelante/lado/rodillas, herido → cae a los 3 s), `b3Free` (movimiento libre de las figuras a < 260 u de la cámara; enemigos a < 110 u te encaran, se acercan hasta 18 u y disparan cada 5–8 s con 0,6–2,8 % de acertar), balanceo, retroceso, zoom, cuerpo que gira con retardo y paso de giro. Probado en SwiftShader: 12–13 disparos → 3–4 impactos, 2–4 bajas; la captura automática del puntero hacía caer el Chromium sin pantalla, ahora se pide al hacer clic.
- Pendiente/no verificado: en primera persona no se ven tus brazos ni el fusil (la cámara está en la cabeza y el arma queda fuera de campo); no probado con ratón real y puntero capturado, ni en GPU real; control solo para infantería.

## Soldado v5 integrado (viewmodel, puntería, muertes, cadáveres)
- `src/troops3d.js` v5 (421 KB; `tools/tropas/src/` con `k_tac.js`, `l_vm.js`, `m_fx.js`). En el control en primera persona (`soldado3d_ctrl.js`): `TroopViewmodel` por nación y época (`scene.onAfterRender` dibuja el segundo pase, `camOut` mueve la cámara y el FOV), clips `ads_*`, `disparar_vm`/`disparar_ads_vm`, `recargar_vm` acelerado al tiempo de recarga del juego, `muerte_vm`; el avatar solo se dibuja en tercera persona.
- Enemigos (`b3Free`): `troopAimClip` con cabeceo al jugador y postura de pie o de rodilla, recarga por postura y época, pasos laterales/atrás, tiempos muertos variados (`IDLE_VAR`).
- Bajas: 10 muertes según dirección y zona, cadáver estable `cuerpo_inerte_*`, herido → cae a los 3 s.
- Pendiente: efectos `TROOP_FX` (no integrados: se mantienen los de partículas del visor), `TROOP_LITE` para gama baja, ratón real con puntero capturado, GPU real.

## Revisión general (batería de regresión)
- Ventanas (13) y paneles: campañas, guerra total, hot-seat, industria (3 pestañas), manual (todas las secciones), partidas guardadas, tutorial, logros, diario y 6 modos de mapa: sin excepciones ni errores de consola.
- Simulaciones: 1939 PRU 700 días (49 s), 1836 FRA 1500 días (25 s): sin excepciones. Guardado/carga con IndexedDB: estado idéntico y 120 días más sin errores. Retirada: combates de 12–28 días y, con orden, terminan el día 4. Levas (tope por población y estados ocupados) y programas de industria: correctos.
- Control del soldado: limpieza al salir (ritmo del combate, ratón capturado, gancho del viewmodel) también con Esc y al cerrarse el visor o terminar la batalla; el viewmodel reproduce la muerte y se reinicia al volver a entrar.

## Combate en primera persona más realista (`obstaculos3d.js`, `npc_combate.js`, `soldado3d_ctrl.js`)
- Ritmo: el combate se ralentiza a ×0,1 al tomar el control; el jugador va a velocidades reales (marcha 2,4 · carrera 6,5 · de rodillas 1,1 u/s, 1 u ≈ 0,6 m; atrás ×0,7, de lado ×0,85, apuntando ×0,5), independientes del ritmo del combate.
- Coberturas: 80 obstáculos por batalla (sacos de arena, cajas, barricadas, peñascos, troncos, carretas, muros bajos) con colisión, línea de tiro (un tiro es bloqueado si cruza un obstáculo por debajo de su altura) y búsqueda de cobertura para los NPC (máx. 3 por obstáculo). De rodillas detrás de una cobertura solo te asomas al apuntar o disparar.
- NPC (`b3Free` en npc_combate.js): máquina de estados idle/fire/bound/to_cover/cover/prone basada en el fuego y movimiento por turnos (la mitad del grupo avanza 7–13 u corriendo agachado mientras la otra cubre), supresión (los disparos del jugador cerca los ponen a cubierto), cadencia de un tiro apuntado cada 4–9 s, un 30 % «dispara poco», recargas por época y postura, los bloques que avanzan también reaccionan si el jugador está a < 110 u. Letalidad moderada (probabilidad de acierto 0,4–1,6 % por disparo, menor de rodillas o a cubierto).
- Efectos: destellos propios pequeños (`fxFlash`) para fogonazos, trazadoras e impactos; indicador direccional del disparo recibido (rojo: sin cobertura, amarillo: detenido por una cobertura).
- Probado: 80 obstáculos de 7 tipos; con un bloque enemigo a 60 u, 10–12 soldados en `fire` y 2–3 en `bound`; el jugador de rodillas tras un muro recibe «La cobertura detiene el disparo». Pendiente: ratón real con puntero capturado, GPU real, ajuste fino del equilibrio con partidas largas.

## Lote 15 puntos (ferrocarril, industrias, economía)
- **Ferrocarril** (`military.js hopDays`): cada nivel de infraestructura en territorio propio/aliado reduce el tiempo de marcha (hasta ×0,26); con infra ≥3 un salto puede durar 1 día.
- **Industrias 2** (`industrias2.js`): papel, vidrio, conservas (refrigeración), electrodomésticos (electricidad) y automóviles (cadena de montaje) con demanda por fecha (`LADDER.from`) para no penalizar antes de existir.
- **Economía 3** (`economia3.js`): se quita la inversión duplicada de la política comercial, fomento+planificación no se acumulan y topes con rendimientos decrecientes (`ECO_CAPS`, `c.ecoCapped`).
- **Marina 2** (`marina2.js`): supremacía naval (0-100 por país y mar, ±2/día; ≥50 % para bloquear, ≥35 % para desembarcar seguro, noticias al cambiar de dominador), reparto equilibrado de la IA (`navalDistribute`: zonas enemigas, defensa y disputadas por peso), `fleetMerge`/`fleetSplit`, escasez por bloqueo (`c.scarc` → radicales, legitimidad, producción, motines «riots» e insurrección revolucionaria).
- **Mapa marítimo** (`mapamar.js`): menú 🌊 «Mar»; solo flotas, supremacía por mar, selección múltiple/recuadro, agrupar, dividir, misión, clic en el mar para navegar.
- **Ambiciones** (`ambiciones.js`): opcional desde el Diario (👑 imperio): recuperar core (estados iniciales + reclamaciones permanentes) + 12 estados, top 14, 40 prestigio; la IA lo adopta en ~1 de cada 8 de las 30 primeras potencias sin CB extra.
- **Árbol de tecnologías** (`arbol_tec.js`): vista en árbol con flechas, bandas por categoría, color por era, clic para investigar; conmutador Árbol/Lista (`UI.techView`).
- **Flanqueo parcial** (`linea.js fmFlankSplit`): la orden de flanqueo de cuerpo entero (jugador y IA) envía solo 1 (cuerpos de 2-4) o 2 (5+) regimientos extremos (caballería primero); el resto se realinea y estira su frente (`pl.stretch`) para no abrir huecos. «Envolver» (puerta de línea completa) sigue disponible como maniobra aparte.
- **Visor naval cenital** (`navalviz2.js`): arena 1000×560, buques con rumbo (`s.hd`), velocidad y giro por tipo, alcance y arco de tiro, estela, torpedos, separación, táctica por bando (`r.tacA/B`), cámara con zoom/arrastre/selección; el 3D (`naval3d.js`, `naves_juego.js`) usa las mismas posiciones y rumbos (z = y de la arena).
- **Limpieza** (punto 15): eliminadas 26 funciones sin ningún uso (marina, diplo, mando, wasmk, battleviz…); manual `lote15` actualizado.
- **Ajustes tras prueba**: ferrocarril ×1/(1+0,9·infra) con infra mínima entre origen y destino (17 → 5 días con infra 3); batallas navales con fin forzado (`navalDisengage`: a los 8 días se retira el más débil, a los 21 ambos, «romper contacto» a los 2) y enfriamiento para no volver a entrar; 46 regiones navales; el mapa marítimo es ahora el modo de mapa «🌊 Marítimo» (`mapamar.js`: capa de regiones con borde verde en la seleccionada, clic derecho para navegar, ficha selecciona flota, recuadro con botón derecho).
- **Comercio exterior** (`comercio.js`): ventana 🚢; compras por tierra (frontera) sin convoyes, por mar con convoyes comprados (1 convoy = 1 lote); ruta por zonas, hundimiento si hay flota enemiga sin escolta, escoltas asignables (viajan con el convoy), material militar a `c.eq`, bienes civiles a reservas `c.imp` (bonos de alimentos/industria). Convoyes en el mapa marítimo.
- **Mapa aéreo** (`mapaire.js`): modo «✈️ Aéreo» con regiones coloreadas, rótulos, fichas y panel; clic derecho despliega escuadrones.
- **Desembarcos desde el mapa marítimo**: elegir ejército en puerto + flotas de escolta y clic derecho en la costa.
- **Bases navales** (`puertos2.js`): edificio ⚓ por estado con puerto (nivel 0-4): reparación y alcance (40 + 14·nivel zonas); fuera de alcance hay desgaste. La IA mejora sus bases.
- **Core y reclamaciones** (`ambiciones.js`): perder un core resta legitimidad/prestigio y deja reclamación permanente; recuperarlo suma; la ambición añade reclamaciones sobre los core ajenos.
- **Eventos**: Suez, Meiji, Tsushima, carrera de acorazados, Panamá, guerra submarina, Washington, Blitz, bloqueo y hambre, México, Transiberiano, Zollverein.
- **Rendimiento (SwiftShader, sin GPU real)**: día de simulación ≈70 ms en 1939; modo marítimo: 174 ms al entrar la primera vez, 57 ms por repintado de regiones, 1,5 ms por fotograma de rótulos; supremacía naval 0,15 ms/día.
- **Guardado**: ida y vuelta idéntica con convoyes, escoltas, supremacía, bases, ambición, reservas y escasez (`sv2.js`).
- **Interfaz v2 «Sala de mapas del Almirantazgo»** integrada (tokens.css, style.css, icons.js con 94 iconos grabados, temas oscuro/pergamino, densidades, daltonismo, gama baja; ajustes en ☰ → Gráficos). Documentación en referencia/interfaz_v2/.
- **Móvil 2** (`movil2.js`): paneles marítimo/aéreo como hoja inferior plegable, botón «🎯 Destino» (el siguiente toque ordena), sin tooltips táctiles, tablas desplazables, toasts ocultos con una ventana abierta, rótulos de mar fuera del HUD.
- **Comercio 2**: oferta real por vendedor (35 % de su producción), precio por relaciones (×0,8–1,3), riesgo de ruta, contratos mensuales (hasta 6) con compra automática de convoyes, «comprar convoyes y pedir», estadísticas de gasto.
- **Virreinatos** (`virreinatos.js`): colonias autónomas (país vasallo con ejército propio controlado por el jugador, `ownsArmy`), 3 políticas de autonomía, lealtad, tributo, independencia, entrada automática en guerras, reintegración; la IA crea el 50 % de sus colonias lejanas (top 15) como virreinato.
- **Apoyo aéreo/naval** (`apoyo.js`): `airBonus` negativo (hasta −18 %) y `navBonus` (±16 %, misión «Bombardeo costero» ×1,8) sobre ataque y defensa en batallas terrestres; `b.sup` y registro de la batalla.
- **Barra de ejércitos** (`barraejercitos.js`): estilo Hearts of Iron, retrato del general (generado por código; `GEN_PORTRAITS[apellido]` admite imágenes reales, ver `PROMPT_RETRATOS_GENERALES_CLAUDE_DESIGN.md`), divisiones, barras de fuerza/organización, estado; clic selecciona (Mayús suma), doble clic centra, clic derecho detiene; incluye ejércitos de virreinatos. Corregidos errores de `repeat` negativo con generales de nivel >5.

- Lote 18: alertas.js, combate2.js, migracion.js, aranceles.js, musica2.js (ambientes mar/batalla naval/aire/crisis/victoria). Pendiente: objetivos de soldados en FP, plantillas de producción, coaliciones, modo simple.

- Lote 19: retratos.js/retratos_genericos.js (aplicar_retratos.py) y src/compacto.css (modo compacto, UI_PREFS.compact, ACT.uicompact).

- Lote 20: extras18.js (perfiles de producción, coalform, modo simple, controles táctiles del soldado), CSS móvil horizontal/vertical en compacto.css. Las coaliciones contra el jugador y las garantías ya existían (coalition.js).

- Lote 21: paz_parcial.js (paz separada, retirada, capitulaciones); retratos recomprimidos (index.html 12,4 → 9,9 MB).

- Lote 22: calibracion.js (+ orgK/casK en military.js), enfermedad con sanidad, doctrinas 1914-45; ver ESTUDIO_CALIBRACION.md. Banco de pruebas: scratchpad cal.js.

- Lote 23: soldado_real.js (posturas, munición por época, fatiga, heridas, granadas, bayoneta), npc_combate.js ampliado (crawl, throw, charge, melee, shift, fallback), controles táctiles ampliados. Pruebas: scratchpad sold.js y npcsim.js.

- Lote 24: obstaculos_mapa.js (ríos, cordilleras, pasos, puentes, estaciones; hopDays/terrMods; mapa Obstáculos; volar puentes). Datos: 585 fronteras con obstáculo (467 río, 144 cresta).
