# Prompt para Claude Code: mejorar el mapa 3D de campaña

> Copia todo lo que hay debajo de la línea y pégalo como primer mensaje en una sesión de Claude Code abierta en este repositorio.

---

## Rol y objetivo

Eres un ingeniero de gráficos con experiencia en three.js y en mapas de estrategia (tipo Victoria 3, Europa Universalis IV, Total War). Tu misión es **llevar el mapa 3D de campaña de este juego a un nivel claramente superior de calidad visual y legibilidad**, sin romper la jugabilidad ni el rendimiento en equipos modestos (Chromebook incluido).

El juego es un único `index.html` generado por `python3 build.py` a partir de `src/*.js` (unos 70 módulos que comparten ámbito global; el orden de carga está en la lista `order` de `build.py`) con `vendor/three.min.js` (r152) incrustado. Léete primero `ESTADO.md`, `README.md` y `ESTUDIO_MAPA.md`, y luego el código de los módulos de la tabla de abajo antes de tocar nada.

## Estado actual (hechos verificados en el código)

| Qué | Dónde | Cómo está hoy |
|---|---|---|
| Rejilla lógica del mundo | `src/geo.js`, `src/mapgen.js` | `MAP_W=2048`, `MAP_H=820`, latitudes 84° a −60°; ≈830 provincias; `MAP.height`, `MAP.land`, `MAP.stateOf`, `MAP.provOf`, `MAP.biome`; ríos generados en `addRivers` |
| Relieve real | `src/elev_data.js`, `src/relieve.js`, `tools/elevacion.py` | malla SRTM/GEBCO 512×205 incrustada (`elevAt`, `provElev`) |
| Malla del terreno | `src/render.js` (`initRenderer`) | rejilla de 720×288 celdas, **6×4 bloques con 3 niveles de detalle** (`R.lodIdx`, `updateTerrainLOD`) y recorte por cámara; `R.exag = 0.55` |
| Material del terreno | `src/render.js` | `MeshLambertMaterial` con una `CanvasTexture` compuesta (`R.cv`, `paintPixel`, `fullRepaint`) que pinta el **modo de mapa** (político, terreno, población…, 9 modos en `MAP_MODES`); un **shader de detalle** inyectado con `onBeforeCompile` (ruido repetido, `snowK`, `seasonTint`, `hMax`) |
| Agua y nubes | `src/render.js` (`buildWaterAndClouds`), `src/graficos.js` (`upgradeWater`) | plano de agua con `ShaderMaterial` (espuma), plano de nubes translúcido |
| Luz | `src/render.js`, `src/graficos.js` | una `DirectionalLight` + ambiente, niebla `THREE.Fog`, sombras solo con calidad «alto» |
| Ciudades y ejércitos | `src/render3d.js`, `src/cities.js` | casas y campanarios fusionados con `mergeParts`; humo; figuras de ejército; fichas de ejército HTML (`updateArmyTokens`) |
| Bordes | `src/mapsmooth.js` | contornos vectoriales suavizados en una capa de alta resolución (`OVS = 1.5`) |
| Rótulos | `src/render.js` (`computeLabels`, `updateLabels`) | texto HTML sobre el mapa |
| Calidad y rendimiento | `src/rendimiento.js`, `src/graficos.js` | `R.quality` = `bajo`/`medio`/`alto` (botón Q), calidad automática por hardware, resolución dinámica, presupuesto de tiempo por fotograma; pruebas en `tools/prueba_graficos.js`, `tools/prueba_rendimiento.js`, `tools/perfil*.js` |
| Cámara | `src/render.js` | `R.cam = {tx, tz, dist, tilt, yaw}`, zoom, giro, inclinación, arrastre, teclado |

## Problemas que quiero resolver (en orden de prioridad)

1. **El relieve no se lee.** Con una sola luz Lambert y la textura política encima, las montañas casi no se distinguen. Quiero **sombreado de relieve (hillshade) real**, cordilleras y mesetas legibles a todas las distancias, y que el modo «Terreno» parezca un mapa físico de calidad.
2. **El color del terreno es plano.** Quiero mezclar por bioma (usa `assets/paletas_biomas.json` y `BIOME_COL` como punto de partida), pendiente, altitud, línea de nieve y estación, con transiciones suaves y sin repetición visible del detalle.
3. **Costas y agua pobres.** Quiero gradiente de profundidad, plataforma continental, olas/espuma en la costa, reflejo del cielo según la inclinación de la cámara y ríos visibles como cintas de agua (a partir de los datos de `addRivers`) que se afinen con la distancia.
4. **El mapa está «desnudo».** Quiero vegetación (bosques, selvas, palmerales, taiga) como instancias baratas (`InstancedMesh`) o como textura/relieve procedural, controlada por bioma y por calidad; desiertos con dunas; hielo y nieve creíbles.
5. **Ciudades, puertos y comunicaciones.** Mejorar el modelado por niveles de detalle de las ciudades (tamaño según población, estilo según cultura/región), añadir puertos y **caminos/ferrocarriles** que unan las ciudades principales y aparezcan con la tecnología (ferrocarril).
6. **Atmósfera.** Niebla/bruma de distancia con color de horizonte, sombras de nubes en movimiento, ciclo día/noche opcional y suave, y tinte estacional ya existente (`seasonTint`, `snowK`) integrado con el nuevo sombreado.
7. **Legibilidad estratégica.** Los modos de mapa (política, población, etc.) deben seguir leyéndose perfectamente: el relieve sombrea pero **nunca debe ocultar los colores de los países ni los bordes**. Añade un control de intensidad del relieve en el panel gráfico (0–100 %).
8. **Rótulos y marcadores.** Revisar la legibilidad de nombres de estados y ciudades a distintos zoom (tamaño y desvanecimiento por distancia, evitar solapes), y que las fichas de ejército no tapen lo importante.

## Restricciones obligatorias

- **Un solo archivo.** Todo debe seguir compilando con `python3 build.py` a `index.html` autónomo (y `--light`). **Sin CDNs, sin imágenes ni modelos externos**: todo procedural o incrustado. Presupuesto: no aumentar `index.html` más de ~1 MB.
- **three.js r152 incrustado**: no actualices la biblioteca. Usa `onBeforeCompile`, `ShaderMaterial` o `InstancedMesh`; nada de módulos ES ni bundlers.
- **Módulos con ámbito global**: respeta el estilo del proyecto (funciones globales, envolver funciones existentes con `const _viejo = f; f = function…` cuando convenga). Si añades un archivo, regístralo en `order` de `build.py` en el sitio correcto.
- **Rendimiento.** Debe seguir yendo fluido en calidad `bajo` en un Chromebook y a ≥ 30 FPS en `medio`. Cada novedad cara debe tener **versión degradada o desactivada por calidad** (`R.quality`) y respetar el presupuesto de tiempo por fotograma de `rendimiento.js`. Mide, no supongas: usa `tools/perfil.js`, `tools/prueba_rendimiento.js` y `tools/prueba_graficos.js`.
- **No rompas la interacción**: selección y hover por rayo (`screenToWorld`, `stateAtWorld`), cámara, minimapa (`drawMinimap`), rutas y marcadores, niebla de guerra del mapa, PWA (`docs/`). Todos los modos de `MAP_MODES` deben seguir funcionando.
- **Sin errores JS.** `tools/prueba.js` y una simulación corta (`tools/simular80.js` con pocos años) deben terminar sin `pageerror`.
- **Accesibilidad.** Contraste suficiente en los rótulos y relieve que no dependa solo del color.

## Cómo quiero que trabajes

1. **Explora y diagnostica primero** (sin cambiar código): lee los módulos de la tabla, abre el juego con Playwright (hay Chromium preinstalado; usa los argumentos de `tools/prueba_panel_batalla.js` para WebGL por software), haz **capturas de referencia** del estado actual a tres distancias de cámara (continental, regional, ciudad) en los modos político y terreno, y guárdalas en el directorio temporal de la sesión.
2. **Propón un plan por fases** (corto, con riesgos y coste de rendimiento estimado de cada fase) y espera mi visto bueno antes de empezar a programar. Fases sugeridas:
   - **Fase 1 – Relieve y color:** normales calculadas desde la altura (en CPU o en el shader), hillshade con dirección de luz configurable, mezcla bioma/pendiente/altitud, textura de detalle sin repetición visible.
   - **Fase 2 – Agua:** costa, profundidad, ríos como cintas, reflejo/espuma con versión barata.
   - **Fase 3 – Vegetación y detalles de suelo:** instancias o relieve procedural por bioma y calidad.
   - **Fase 4 – Ciudades, puertos y ferrocarriles.**
   - **Fase 5 – Atmósfera:** bruma de horizonte, sombras de nubes, día/noche, estaciones.
   - **Fase 6 – Rótulos, marcadores y ajustes del panel gráfico.**
3. **Trabaja fase a fase**: al terminar cada una, ejecuta `python3 build.py`, las pruebas de `tools/`, repite las capturas desde los mismos puntos de vista y **compárelas con las de referencia** (muéstramelas), mide FPS en `bajo` y `alto`, y haz un commit con un mensaje claro en la rama que te indique la sesión. No hagas push a otra rama ni abras PR sin que lo pida.
4. **Criterios de aceptación por fase**: (a) sin errores JS, (b) todos los modos de mapa legibles, (c) FPS dentro del presupuesto en cada nivel de calidad, (d) mejora visible y comprobada con capturas, (e) `ESTADO.md` actualizado con una sección breve de lo hecho y los parámetros nuevos.

## Qué NO debes hacer

- No rehagas el motor desde cero ni cambies el sistema de coordenadas (`lon`, `-lat`, `y` = altura), porque lo usan ejércitos, marcadores, rutas, rótulos y minimapa.
- No introduzcas dependencias, descargas en tiempo de ejecución ni texturas externas.
- No sacrifiques la legibilidad política por un aspecto más «bonito».
- No dejes funciones a medias: si una mejora no cabe en el presupuesto de rendimiento, déjala desactivada por calidad y documéntalo.

## Primera respuesta que espero

Un **informe de diagnóstico** (qué has leído, qué has medido, 3–5 capturas de referencia comentadas) y el **plan por fases** con estimación de coste de cada una. Nada de código todavía.
