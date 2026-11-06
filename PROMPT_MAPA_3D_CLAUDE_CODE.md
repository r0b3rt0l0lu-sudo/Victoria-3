# MISIÓN: rehacer la calidad visual del mapa 3D de campaña (three.js r152, un solo HTML)

> Pega todo este archivo como primer mensaje en Claude Code, en una sesión abierta en este repositorio. Está escrito para que trabajes de forma **autónoma, por fases, con mediciones y capturas**, y solo me interrumpas en los puntos de control marcados con 🛑.

---

## 0. Rol, tono y reglas de juego

Eres un **ingeniero sénior de gráficos en tiempo real** (three.js/WebGL, shaders GLSL, generación procedural, optimización) con ojo de **director de arte de mapas de estrategia** (referentes: *Victoria 3*, *Europa Universalis IV*, *Total War: Napoleon*, mapas físicos de National Geographic). Tu criterio estético manda tanto como el técnico: si algo es correcto pero feo, no está terminado.

Reglas:
1. **Mide antes de opinar y mide después de cambiar.** Nada de «debería ir bien»: cada afirmación de rendimiento o de calidad lleva un número o una captura.
2. **Lee el código antes de tocarlo.** Este proyecto envuelve funciones unas sobre otras; cambiar la equivocada rompe en silencio.
3. **Autonomía con puntos de control.** Trabaja sin pedir permiso fase a fase, salvo en los 🛑. No abras PR, no hagas push fuera de la rama de la sesión, no borres archivos que no hayas creado.
4. **Honestidad.** Si una mejora no se ve, no cabe en presupuesto o rompe algo, dilo y revierte. Informa de los fallos tal cual, con la salida de la prueba.

## 1. El proyecto en 60 segundos

- Juego de gran estrategia 1836-1936 (estilo Victoria 3 + HoI4). Salida: **un único `index.html` autónomo** generado por `python3 build.py` desde `src/*.js` (≈75 módulos con **ámbito global compartido**; el orden de carga es la lista `order` de `build.py`) + `vendor/three.min.js` (**r152 incrustado, no actualizable**) + `src/style.css`. También `python3 build.py --light` (three por CDN) y PWA en `docs/`.
- Estilo de código: funciones y constantes globales; para modificar algo existente se **envuelve**: `const _viejo = f; f = function (…) { …; _viejo(…); … }` (las `function` hoisted se pueden reasignar). El último módulo cargado manda.
- Documentos que debes leer primero: `ESTADO.md`, `README.md`, `ESTUDIO_MAPA.md`, `PROGRESO.md` (solo lo gráfico), y los módulos de la tabla de la sección 2.
- Pruebas existentes (Playwright + Chromium preinstalado, WebGL por software): `tools/prueba.js`, `tools/prueba_graficos.js`, `tools/prueba_rendimiento.js`, `tools/perfil.js`, `tools/perfil_vivo.js`, `tools/simular80.js`. Argumentos de lanzamiento que funcionan: `--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader --ignore-gpu-blocklist --enable-webgl`. Importa con `require('playwright')` (ya está instalado; **no** ejecutes `playwright install`).

## 2. Inventario técnico del mapa actual (verificado en el código)

| Pieza | Dónde | Hecho verificable |
|---|---|---|
| Rejilla del mundo | `src/geo.js` | `MAP_W = 2048`, `MAP_H = 820`, `LAT_TOP = 84`, `LAT_BOT = -60` (≈ 5,7 celdas/° en x, 5,7 en y) |
| Datos por celda | `src/mapgen.js` | `MAP.height` (Float, >0 tierra, <0 mar), `MAP.land`, `MAP.stateOf`, `MAP.provOf`, `MAP.biome` (0 mar, 1 llanura, 2 bosque, 3 desierto, 4 estepa, 5 tundra, 6 selva, 7 montaña, 8 nieve; `BIOME_COL`, `BIOME_NAME`), `MAP.dSea` (distancia al mar; ya la usa la espuma de costa) |
| Relieve real | `src/elev_data.js`, `src/relieve.js`, `tools/elevacion.py` | malla SRTM/GEBCO 512×205 (`elevAt`, `provElev`); sirve a la jugabilidad de batalla, **no** se usa aún para el sombreado |
| Colores del terreno | `src/mapgen.js` `buildTerrainColors` | pinta por celda color de bioma + sombreado simple + espuma de costa + **ríos dibujados en el bitmap** (`addRivers`: sigue la pendiente desde alturas > 0,85 hasta el mar; solo guarda `MAP.rivers = nº`, **no la geometría**) |
| Textura de mapa | `src/render.js` | `R.cv` (2048×820) → `R.tex` (`CanvasTexture`, aniso ≤ 8, mipmaps); `paintPixel`, `fullRepaint`, `repaintState` repintan por modo (`MAP_MODES`: político, terreno, población, nivel de vida, alfabetización, prosperidad, malestar, relaciones, bloques) y por niebla de guerra |
| Malla | `src/render.js` `initRenderer` | `nx=720`, `nz=288`; coordenadas **x = lon, y = altura, z = −lat**; `y = h·R.exag` en tierra (`R.exag = 0.55`) y `h·0.35` en mar; 6×4 bloques (`R.chunks`), 3 LOD (`R.lodIdx`, `updateTerrainLOD`); normales de rejilla completa (`computeVertexNormals`) |
| Material | `src/render.js` | **un** `MeshLambertMaterial({map: R.tex})` con `onBeforeCompile`: textura de detalle 128² repetida ×(130,52) y ×(21,8.4), uniforms `detailK`, `snowK`, `seasonTint`, `hMax` |
| Agua | `src/render.js` `buildWaterAndClouds`, `src/graficos.js` `upgradeWater` | plano 360×144 en y=0.012 con `ShaderMaterial` (olas por senos) + textura de espuma 1024×410 derivada de `MAP.dSea` |
| Nubes | `src/render.js` | plano en y=3.2, textura fbm 512×256, opacidad según zoom |
| Luz y niebla | `src/render.js`, `src/graficos.js` | `DirectionalLight(0xfff0d8, 0.78)` `R.sun` (posición/intensidad por estación en `updateSeason`), ambiente, `THREE.Fog(0x14222c, 170, 560)`, sombras solo en calidad «alto» |
| Ciudades | `src/render3d.js`, `src/cities.js` | casas y campanarios con `mergeParts` (geometría fusionada), nº según población, humo (`buildSmoke`), chimeneas instanciadas (`graficos.js`), nombres (`CITY_NAMES`) |
| Ejércitos | `src/render3d.js`, `src/render.js` | figuras 3D pequeñas + fichas HTML (`updateArmyTokens`, `declutterTokens`) |
| Bordes | `src/mapsmooth.js` | contornos vectoriales suavizados (`OVS = 1.5`) en capa propia |
| Rótulos | `src/render.js` | `computeLabels`/`updateLabels` en HTML |
| Cámara | `src/render.js` | `R.cam = {tx, tz, dist, tilt, yaw}`; `PerspectiveCamera(32°, near 0.5, far 900)`; zoom a puntero, giro, inclinación, borde de pantalla, teclado; `camHome`, `focusProv/State/LonLat` |
| Calidad | `src/rendimiento.js`, `src/graficos.js` | `R.quality ∈ {bajo, medio, alto}` (botón Q, `R.qualityManual` manda), `R.resScale` adaptativa, `basePixelRatio`, presupuesto 9/14 ms por fotograma, pausa con pestaña oculta, `R.lowEnd` |
| Estaciones | `src/graficos.js` `updateSeason` | `snowK`, `seasonTint`, sol según mes |

**Lectura del diagnóstico**: el relieve existe en la geometría pero el sombreado es *solo Lambert con normales de malla de 720×288* (≈ 2,8 celdas por vértice), sin hillshade de alta frecuencia, sin AO, sin mezcla por pendiente/bioma en GPU, sin ríos como geometría, sin vegetación 3D, con una sola textura política dominante. Ahí está el margen.

## 3. Objetivos medibles (la mejora debe poder demostrarse)

| # | Objetivo | Métrica de aceptación |
|---|---|---|
| O1 | El relieve se lee a cualquier zoom | En captura continental y regional, un observador distingue cordilleras (Alpes, Himalaya, Andes, Rocosas) sin leer rótulos; el contraste de luminancia entre cresta y valle sombreado ≥ 25 % en modo Terreno y ≥ 10 % en modo Político |
| O2 | El color del terreno es rico y no se repite | Mezcla por bioma + pendiente + altitud + nieve; sin patrón de repetición visible al zoom máximo (comprobar con captura 1:1 de 400×400 px) |
| O3 | Costas y ríos creíbles | Profundidad de mar con 3 tonos y plataforma continental; ríos como cintas continuas que se afinan con la distancia; espuma en costa |
| O4 | Vegetación y suelo | Bosques/selvas/taiga/palmerales visibles a zoom regional y de ciudad, coste ≤ 1,5 ms CPU y ≤ 60 draw calls extra en calidad `alto` |
| O5 | Ciudades y comunicaciones | 3 LOD de ciudad; puertos; red de caminos y **ferrocarriles** entre ciudades principales que aparece con la tecnología |
| O6 | Atmósfera | Bruma de horizonte, sombras de nubes en movimiento, día/noche suave opcional |
| O7 | **Cero pérdida de legibilidad política** | En modos Político y Bloques, el color de cada país y los bordes se reconocen igual que antes (comparar con captura de referencia; ΔE medio del color de relleno por país ≤ 12 en modo Político con relieve al 100 %) |
| O8 | Rendimiento | Presupuestos de la sección 5, medidos |
| O9 | Cero regresiones | Sección 9 en verde |

## 4. Diseño técnico recomendado (puedes proponer algo mejor, justificándolo con medidas)

### 4.1 Relieve y color (Fase 1) — el mayor salto de calidad por coste
- **Textura de relieve (heightmap) en GPU**: empaqueta `MAP.height` (2048×820) en una `DataTexture` (R16F si hay `OES_texture_half_float_linear`; si no, RG8 con codificación 16 bits) y pásala al shader. Calcula **normales por píxel** con diferencias centrales/Sobel en el fragment shader (o precalcula una normal map 2048×820 en CPU una sola vez; compara coste/calidad).
- **Hillshade multi-dirección** (azimut NW 315°, elevación ~35–45°; mezcla de 2–4 direcciones o *slope-aware multidirectional hillshade*) + **oclusión ambiental barata** del terreno (curvatura laplaciana de la altura) para marcar valles. Parámetros en uniforms: `reliefK` (0–1, el control de intensidad que expone el panel gráfico), `sunAz`, `sunEl`, `aoK`.
- **Mezcla de materiales por GPU** (*splat* procedural, sin texturas externas): colores base por bioma (`assets/paletas_biomas.json`, `BIOME_COL`) interpolados por la rejilla de bioma (suaviza el borde entre biomas con un *blur* previo del buffer de bioma), roca por pendiente > umbral, nieve por altitud+latitud+estación (`snowK`), arena en costa, verde más vivo cerca de ríos. Mantén `seasonTint`.
- **Detalle sin repetición**: sustituye la textura de detalle repetida por **ruido procedural con *domain warping*** o por *texture bombing*/*stochastic tiling* (hash por celda que rota/desplaza el muestreo) y atenúa por distancia de cámara (usa `vW` y `R.cam.dist`).
- **Integración con los modos de mapa**: el relieve **multiplica** (no sustituye) el color de `R.tex`. En modos de datos (población, etc.) reduce `reliefK` y el detalle de bioma automáticamente (p. ej. ×0,5) para no ensuciar el mapa de calor; en Terreno al 100 %.
- Aumenta la malla solo si hace falta: prueba 1024×410 con los mismos 6×4 bloques y LOD; documenta el coste en triángulos (`renderer.info`).

### 4.2 Agua (Fase 2)
- **Profundidad del mar** con `MAP.height` (<0) y/o `MAP.dSea`: gradiente turquesa costero → azul profundo, plataforma continental, oscurecimiento en fosas. Reflejo del cielo tipo Fresnel según el ángulo de cámara (barato: mezcla de color cielo por `dot(N,V)`).
- **Olas y espuma**: reutiliza la textura de espuma existente; añade ruido animado y brillo especular suave (sol). Versión `bajo`: color plano con gradiente y espuma estática.
- **Ríos como geometría**: hoy solo están en el bitmap. **Extrae las polilíneas** repitiendo el trazado de `addRivers` (o instrumentándolo para guardar caminos en `MAP.riverPaths`), suavízalas (Chaikin/Catmull-Rom), calcula caudal acumulado (afluentes suman) y genera **cintas** (`BufferGeometry` con ancho variable, UV de flujo animado) apoyadas sobre el terreno (offset en y + `polygonOffset`). Se afinan y desvanecen con la distancia de cámara. En `bajo`: solo pintados en la textura, como ahora.

### 4.3 Vegetación y suelo (Fase 3)
- Por bioma y calidad: **`InstancedMesh`** de árboles low-poly (cono/esfera achatada/palmera/pino; 1–2 geometrías por bioma, ≤ 40 triángulos) colocados con un muestreo de Poisson o rejilla con jitter sobre las celdas de bioma 2/6/5/3, **solo en chunks visibles** y solo por debajo de cierta distancia de cámara (reconstruir al cruzar umbrales, no cada fotograma). Densidad según `R.quality`. Alternativa/complemento: **sombreado de copa en el shader del terreno** (oscurecer y granular el color en celdas boscosas) para el zoom lejano.
- Desierto: dunas por ruido direccional en el shader. Tundra/nieve: grano y brillo. Montaña: roca estratificada por pendiente y altitud.

### 4.4 Ciudades, puertos y comunicaciones (Fase 4)
- 3 LOD por ciudad (silueta/bloque a distancia lejana, casas fusionadas a media, detalle con campanarios a cerca), tamaño y estilo por población y región (`nameRegion`/cultura): tejados rojos europeos, cúpulas oriente medio, casas bajas África/Asia.
- **Puertos** (muelles y barcos fondeados simples) en ciudades costeras importantes.
- **Red de comunicaciones**: caminos (siempre, finos) y **ferrocarriles** (aparecen con la tecnología de ferrocarril; leer el estado real del juego buscando cómo se modela la tecnología/infraestructura, p. ej. `hasTech`, edificios `railroad` o equivalente) uniendo capitales de estado y ciudades grandes por **A\*** sobre la rejilla con coste por pendiente y agua; dibuja con cintas finas sobre el terreno (mismo método que los ríos), con traviesas/línea oscura y humo ocasional de locomotora en `alto`. Recalcula solo cuando cambia la propiedad o la tecnología.

### 4.5 Atmósfera (Fase 5)
- **Bruma de distancia** coherente con la inclinación (color de horizonte distinto al del cielo/fondo actual `0x14222c`), `Fog` o cálculo propio en el shader de terreno.
- **Sombras de nubes** proyectadas sobre el terreno (muestrea la misma textura de nubes desplazada en el fragment shader del terreno; coste casi nulo) y nubes con dos capas.
- **Ciclo día/noche opcional** (desactivado por defecto): sol/ambiente por hora, luces en ciudades de noche (emisivo en casas) con coste mínimo. Integra con las estaciones ya existentes.

### 4.6 Rótulos, marcadores y panel gráfico (Fase 6)
- Rótulos: tamaño y opacidad por distancia, prioridad por población para evitar solapes (ya hay `declutterTokens` para fichas), halo oscuro para contraste. Fichas de ejército: que no tapen ciudades/capitales a zoom cercano.
- **Panel gráfico** (donde ya está el botón Q / opciones en `ui.js`): añade sliders/interruptores persistentes (`saveMapPrefs`/`loadMapPrefs`, localStorage con try/catch): *Intensidad del relieve*, *Vegetación*, *Ríos 3D*, *Ferrocarriles*, *Atmósfera*, *Día/noche*. Los valores por defecto los fija la calidad.

## 5. Presupuestos (los mides en cada fase y los reportas)

| Calidad | Objetivo (hardware real) | Triángulos | Draw calls extra | Texturas nuevas | Coste CPU de actualización |
|---|---|---|---|---|---|
| `bajo` (Chromebook) | ≥ 30 FPS estables | ≤ la actual (+10 %) | ≤ +5 | ≤ 8 MB | ≤ 0,5 ms/fotograma |
| `medio` | ≥ 45 FPS | ≤ +50 % | ≤ +25 | ≤ 24 MB | ≤ 1 ms |
| `alto` | ≥ 60 FPS | ≤ +150 % | ≤ +60 | ≤ 64 MB | ≤ 1,5 ms |

- **Cómo medir en este entorno**: Chromium con SwiftShader **no** da FPS de GPU real. Usa: `renderer.info.render.{calls,triangles}`, `renderer.info.memory.textures`, tiempo de CPU por fotograma con `performance.now()` alrededor de `frame_` y de tus funciones de actualización, y tiempo de compilación de shaders. Reporta FPS de SwiftShader solo como *comparativa relativa antes/después*, nunca como cifra absoluta, y dilo.
- Reglas: nada de reconstruir geometría o texturas grandes por fotograma; construcciones pesadas **troceadas** con el presupuesto de tiempo existente (ver `rendimiento.js`) o en el arranque; liberar (`dispose`) lo que sustituyas.
- Versión degradada obligatoria de cada novedad en `bajo` (desactivada o simplificada) y comportamiento correcto si WebGL no soporta una extensión (comprueba `renderer.capabilities`, `getContext().getExtension`).

## 6. Banco de capturas y comparación (la prueba de calidad)

Crea `tools/capturas_mapa.js` (Playwright) que arranque el juego (como `tools/prueba_graficos.js`: elegir país, `Empezar`, `G.paused = true`) y haga **capturas deterministas** a 1500×860 con `deviceScaleFactor: 1` (y una a 2 para presentación) desde estas **poses de cámara** (`R.cam` + `updateCamera()` + `R.dirty = true`, esperar ~1,8 s):

| Id | Vista | Cámara aproximada | Para comprobar |
|---|---|---|---|
| C1 | Mundo | `camHome()` | legibilidad global, bruma, continentes |
| C2 | Europa central (Alpes) | `focusLonLat(10, 46.5, 55)` | cordilleras, ríos, bordes |
| C3 | Himalaya/Tíbet | `focusLonLat(88, 30, 60)` | altitud extrema, nieve |
| C4 | Costa y delta (Nilo o Mississippi) | `focusLonLat(31, 31, 40)` | costa, ríos, plataforma |
| C5 | Desierto (Sáhara) | `focusLonLat(10, 26, 50)` | dunas, color |
| C6 | Selva (Amazonas o Congo) | `focusLonLat(-62, -4, 50)` | vegetación densa, ríos anchos |
| C7 | Ciudad industrial | `focusState(...)` Midlands/Ruhr, `dist ≈ 18` | LOD de ciudades, humo, ferrocarril |
| C8 | Zoom máximo sobre terreno | `dist` mínimo | repetición de detalle, aliasing |
| C9 | Modo Político con relieve 100 % | C2 en `setMapMode('political')` | legibilidad política (O7) |
| C10 | Modo Población | C2 en `setMapMode('population')` | que el relieve no ensucia el mapa de calor |

Cada ejecución guarda `ref/` (estado inicial, **hazla antes de cambiar nada**) y `fase-N/`, y genera un **informe HTML comparativo** (antes | después lado a lado) con las métricas de la sección 5. Calcula también el **ΔE medio** del relleno político (O7) y el contraste cresta-valle (O1) sobre las capturas. Guarda todo en el directorio temporal de la sesión; no subas imágenes al repositorio salvo el script y el informe resumido.

## 7. Proceso (obligatorio)

**Paso 0 — Diagnóstico (sin cambiar código del juego).** Lee la sección 2 en el código real y corrige cualquier dato que no coincida. Crea `tools/capturas_mapa.js`, haz la tanda `ref/` y mide la línea base de la sección 5 en los tres niveles de calidad. Prueba que `tools/prueba.js` y `tools/prueba_graficos.js` pasan antes de empezar (si fallan ya, anótalo: no es culpa tuya).

🛑 **Punto de control A — entrega:** informe de diagnóstico (qué leíste, línea base, 5 capturas de referencia comentadas, riesgos) + plan por fases con coste estimado y qué recortarías si no cabe. **Espera mi OK.**

**Pasos 1–6 — Fases** (orden: 1 Relieve/color → 2 Agua → 3 Vegetación → 4 Ciudades/comunicaciones → 5 Atmósfera → 6 Rótulos/panel). Para cada fase:
1. Implementa detrás de un interruptor (`R.fx.relief`, `R.fx.rivers3d`… ) con valor por defecto por calidad, de modo que se pueda comparar activado/desactivado en la misma sesión.
2. `python3 build.py` (y `--light` si tocas la carga de three) → pruebas de la sección 9 → banco de capturas → informe comparativo → mediciones.
3. **Autoevaluación crítica**: mira tus propias capturas como un director de arte. Lista 3 defectos visuales concretos y corrígelos antes de entregar la fase. Itera hasta que las métricas de O1–O9 de esa fase cumplan.
4. Commit en la rama de la sesión con mensaje `mapa3d fase N: …`, actualiza `ESTADO.md` (sección «Mapa 3D», parámetros, interruptores, coste medido) y resume en ≤ 15 líneas.

🛑 **Puntos de control B1…B6 — tras cada fase:** muestra el informe comparativo y el resumen; continúa solo si cumple los criterios. Si falla un criterio, arréglalo o revierte esa parte; no la dejes a medias.

**Cierre — 🛑 Punto de control C:** balance global (tabla objetivo ↔ resultado, antes/después de C1–C10, presupuestos medidos, lista de interruptores nuevos, riesgos conocidos y qué dejarías para después).

## 8. Restricciones duras

- **Un solo archivo**: nada de CDNs, imágenes, modelos, fuentes ni `fetch` en tiempo de ejecución; todo procedural o incrustado. `index.html` actual ≈ 3,2 MB; **no superes +1 MB** en total (reporta el incremento por fase).
- **three.js r152**: sin actualizar; usa `onBeforeCompile`, `ShaderMaterial`, `InstancedMesh`, `DataTexture`. Sin módulos ES ni bundlers. Comprueba que cada API que uses existe en r152.
- **Coordenadas intactas**: `x = lon`, `z = −lat`, `y = altura·R.exag`. Las usan ejércitos, rutas, marcadores, rótulos, minimapa y la selección por rayo (`screenToWorld`, `stateAtWorld`, `worldToScreen`). Si cambias la altura aparente del terreno, **mantén la función de altura consistente** con la que usan esos módulos (`MAP.height·R.exag`).
- **Selección y hover** deben funcionar idénticos (raycast contra la geometría de colisión actual o equivalente).
- **Todos los modos de `MAP_MODES`**, la niebla de guerra del mapa (`G.fog`), el minimapa, el modo oscuro de interfaz, la PWA (`docs/`) y el guardado deben seguir funcionando.
- Estilo del repo: español en textos de usuario y comentarios; sin dependencias; sin `console.log` perdidos; comprobaciones `try/catch` en `localStorage`.

## 9. Batería anti-regresión (en verde antes de cada commit)

1. `python3 build.py` sin errores; `python3 build.py --light` sin errores.
2. `node tools/prueba.js`, `tools/prueba_graficos.js`, `tools/prueba_rendimiento.js` sin `pageerror`.
3. `tools/simular80.js` (o una versión corta de 5 años) sin excepciones.
4. Recorrido manual guiado por script: cambiar los 9 modos de mapa, seleccionar un estado, pasar el ratón, arrastrar/zoom/girar/inclinar, abrir y cerrar el mapa de batalla de una guerra, calidad `bajo`→`medio`→`alto`→`bajo` con el botón Q, cambiar de estación (mes 0 y 6). Sin errores JS y sin parpadeos de textura.
5. Comprobación de **fugas**: tras 30 cambios de modo y 30 de calidad, `renderer.info.memory` (geometrías/texturas) no crece de forma sostenida.
6. Comprobación de **contexto perdido**: forzar `webglcontextlost`/`restored` no deja el mapa en blanco (o, si ya fallaba antes, documentarlo).

## 10. Registro de riesgos (revísalo y amplíalo en el diagnóstico)

| Riesgo | Mitigación |
|---|---|
| El relieve ensucia los modos de datos | `reliefK` automático por modo; capturas C9/C10; ΔE |
| Texturas float no disponibles en equipos modestos | detectar extensión; codificación RG8 de 16 bits; fallback a normales de malla |
| Shader demasiado caro en iGPU | splat y AO desactivados en `bajo`; muestreos ≤ 6 por fragmento; medir con `renderer.info` y reducción de `resScale` |
| Z-fighting de ríos/ferrocarriles sobre el terreno | `polygonOffset`, offset en y proporcional a la distancia, o dibujar en el shader del terreno |
| Rotura de la selección por rayo | no tocar la geometría de colisión; pruebas de hover antes/después |
| Aumento de tamaño del HTML | medir por fase; generar texturas en tiempo de ejecución desde datos que ya existen en lugar de incrustar nuevas |
| Fase demasiado larga | trocear con el presupuesto de tiempo de `rendimiento.js` y pintar en cuanto esté lista |

## 11. Qué NO hacer

- No rehacer el motor ni cambiar el sistema de coordenadas.
- No añadir dependencias ni recursos externos.
- No sacrificar la legibilidad política por «verse bonito».
- No dejar mejoras a medias ni sin interruptor; si no cabe en presupuesto, déjala desactivada por calidad y documenta por qué.
- No tocar la lógica de simulación, economía ni combate (solo lectura de datos).
- No abrir PR ni empujar a otra rama.

## 12. Primera respuesta esperada

Empieza por el **Paso 0** y entrega el **Punto de control A**: diagnóstico verificado (indicando cualquier dato de la sección 2 que no coincida), línea base medida en `bajo/medio/alto`, 5 capturas de referencia con comentario de director de arte, plan por fases con riesgos y estimación de coste, y las decisiones técnicas que propones cambiar respecto a la sección 4 (con justificación). **Nada de código del juego todavía.**
