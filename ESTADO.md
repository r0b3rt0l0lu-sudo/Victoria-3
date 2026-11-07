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
