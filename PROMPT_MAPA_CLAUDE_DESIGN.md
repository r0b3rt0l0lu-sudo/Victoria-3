# Prompt para Claude Design: mapa del mundo de mayor calidad (1836-1945)

**Rol y objetivo.** Eres un cartógrafo digital y artista técnico de mapas para videojuegos de estrategia histórica (referencias de calidad: *Victoria 3*, *Hearts of Iron IV*, *Europa Universalis IV* y los atlas históricos pintados del siglo XIX). Mejora el **mapa del mundo** de mi juego de estrategia *Victoria* (web, three.js r152, JavaScript, **un único `index.html` sin descargas en ejecución**) manteniendo intacto el contrato de datos que usa el resto del juego. Hoy el mapa funciona pero se ve **tosco**: costas poligonales gruesas, fronteras que parecen un diagrama de Voronoi, relieve y ríos genéricos y colores planos. Quiero un salto claro de calidad visual y de fidelidad geográfica.

## 1. Cómo es el mapa actual (no lo rompas)
| Aspecto | Estado actual |
|---|---|
| Proyección | Equirrectangular. `lon -180..180`, `lat 84..-60`. `MAP_W = 2048`, `MAP_H = 820`, `LAT_TOP = 84`, `LAT_BOT = -60`. Funciones `lonToX/latToY/xToLon/yToLat`. |
| Costas | Polígonos en `src/geo.js`: `LAND_POLYS`, `SEA_POLYS` (mares y lagos), más polígonos de relieve `MOUNTAINS`, `PLATEAUS`, `DESERTS`, `STEPPES`, `JUNGLES`. Se rasterizan a una máscara `MAP.land`. |
| Estados | **380 estados** definidos por semillas `STATE_DATA` (`nombre|lon|lat|país|población|recursos|padre`). Se reparten por distancia a la semilla. **Los ids, el orden y los nombres no pueden cambiar**: las partidas guardadas y los escenarios de 1910 y 1939 los referencian por nombre. |
| Provincias | ≈ 996, generadas dentro de cada estado (2 a 9 por estado) por semillas más relajación de Lloyd; sirven para mover ejércitos y librar batallas (`MAP.provs`, `MAP.provOf`, `MAP.pnb`). |
| Relieve | Malla real de elevación `ELEV` de 512×205 (`src/elev_data.js`, generada con `tools/elevacion.py`): altitud media `m` y rugosidad `r`. |
| Bioma | Procedural: ruido + latitud + polígonos (`BIOME` 0 océano, 1 pradera, 2 bosque, 3 desierto, 4 estepa, 5 tundra, 6 selva, 7 montaña, 8 nieve). |
| Ríos | Trazados procedurales (`MAP.riverPaths`), dibujados como cintas. |
| Pintura | `render.js` pinta el mapa político/terreno en canvas 2D y `relieve3d.js` lo dibuja en 3D con relieve, agua y nubes. Hay modos de mapa (político, terreno, diplomático…). |

## 2. Qué quiero que mejores (por prioridad)
1. **Costas de alta fidelidad.** Contornos con el detalle de *Natural Earth 1:50m* (dominio público) o equivalente: islas pequeñas (Baleares, Córcega, Cerdeña, Sicilia, Creta, Chipre, Japón completo, Filipinas, Indonesia, Antillas, Hawái…), golfos, fiordos, deltas y penínsulas reconocibles; lagos grandes (Grandes Lagos, Victoria, Tanganica, Baikal, Ládoga, Aral) y mares interiores (Negro, Caspio, Báltico, Mar del Norte) correctos. Presupuesto: **≤ 80.000 vértices en total**, simplificados (Douglas-Peucker) y guardados en un formato compacto (deltas enteros, base36 o `Int16Array` en base64). Si no puedes descargar datos, derívalos de tu conocimiento y **documenta la precisión**.
2. **Fronteras de estados orgánicas.** Hoy son Voronoi. Genera el reparto por **distancia con coste anisótropo** que respete accidentes naturales: las fronteras deben **seguir ríos, cordilleras y costas** cuando exista una alternativa razonable, y no atravesar mares ni cordilleras sin motivo. Debe seguir produciendo **los mismos 380 estados** (mismas semillas), todos conexos, sin estados vacíos ni fragmentados, y con un grafo de vecinos coherente. Opcional: contornos poligonales editados a mano para **Europa, Oriente Próximo y Asia oriental** donde la geografía histórica es más reconocible (Alemania, Italia, Balcanes, Polonia, Indochina, Corea).
3. **Relieve y terreno pintados.** Un mapa físico bonito: *hillshade* (sombreado de relieve) suave, mezcla de biomas sin cortes, cordilleras con cumbres, llanuras y mesetas diferenciadas, desiertos con dunas, selvas densas, estepas, tundra, nieve en cumbres y polos, marismas y deltas. Con coherencia por estación (verano/invierno) como mínimo en nieve y vegetación.
4. **Ríos y agua.** Ríos principales reales (Nilo, Amazonas, Misisipi, Danubio, Rin, Volga, Yangtsé, Ganges, Indo…) como cintas con **grosor por orden** y afluentes, que terminen en deltas; lagos con orilla suave; **batimetría** en el mar (plataforma continental clara, aguas profundas oscuras, costas con espuma) y rompientes en la costa.
5. **Estilo cartográfico de época.** Además del estilo actual, un **estilo «atlas del siglo XIX»**: paleta pergamino, líneas finas de tinta, sombreado por rayado, rosa de los vientos, nombres de mares y océanos en cursiva, marco con graduación. Debe poder alternarse con el actual desde los ajustes gráficos.
6. **Etiquetas y capas informativas.** Nombres de país y de estado **curvados a lo largo de la forma** y ajustados al zoom (LOD), sin solaparse; ciudades principales con icono por tamaño; capitales; **puertos**; red de **carreteras y ferrocarril** como capa que crece según la era; fronteras con grosor distinto para país, estado y provincia.
7. **Calidad a zoom cercano.** Que a zoom alto no se vea pixelado: **texturas por teselas** (mipmaps) o dibujo vectorial del terreno; relieve 3D con normales de mayor resolución (elevación de **1024×410 o 2048×820** a partir de datos públicos tipo ETOPO/SRTM si puedes obtenerlos).

## 3. Restricciones técnicas
- **Sin red en ejecución, sin librerías externas nuevas.** Todo embebido; compatible con **three.js r152 / WebGL2**. Si necesitas imágenes, en **WebP/PNG en base64 dentro del archivo** o en archivos aparte para la versión por carpetas (`docs/`).
- **Presupuesto de peso:** +3 MB como máximo sobre el juego actual (≈ 4,7 MB). Gzip contará.
- **Rendimiento:** generación inicial **< 3 s** en un portátil medio y **60 fps** al navegar; reutiliza el sistema de calidad (`calidad.js`: bajo/medio/alto) con versiones ligeras de cada capa. Móviles y ChromeOS deben poder usar «bajo».
- **Compatibilidad de datos:** conserva `MAP.land`, `MAP.biome`, `MAP.height`, `MAP.stateOf`, `MAP.stats`, `MAP.seeds`, `MAP.provs`, `MAP.provOf`, `MAP.pnb`, `MAP.dLand`, `MAP.dSea` y `MAP.riverPaths` con el mismo significado. Si cambias `MAP_W/MAP_H` (por ejemplo a 4096×1640), **dime todo lo que se ve afectado** (provincias, niebla de guerra, rutas, minimapa, etiquetas).
- **Licencias:** solo datos de **dominio público o CC0/CC-BY** (Natural Earth, SRTM/ETOPO, OpenStreetMap solo si la licencia lo permite). **No copies mapas de otros videojuegos ni de atlas con copyright.** Cita la fuente de cada capa.
- **Épocas:** los escenarios de 1836, 1910 y 1939 usan el mismo mapa. Las fronteras de países las pone el juego (propietario de cada estado); tú entregas la **geografía**, no la política.

## 4. Entrega
1. Un paquete `mapa_v2/` con: datos geográficos (costas, lagos, ríos, relieve), el **generador** reproducible (script o módulo JS que construye máscara, biomas, estados y provincias a partir de las semillas), las texturas o dibujo vectorial y un `INTEGRACION_MAPA.md` con los pasos exactos para sustituir `geo.js`, `mapgen.js`, `provinces.js` y `relieve*.js`.
2. Un **visor independiente** (`visor_mapa.html`) para ver el mapa solo, con cambio de estilo (actual / atlas), capas, estaciones y zoom.
3. **Capturas** en cuatro zonas (Europa central, Mediterráneo oriental, Asia oriental y Caribe) en tres niveles de zoom y en ambos estilos.
4. **Informe de validación**: porcentaje de tierra, número de estados y provincias, estados con 0 píxeles (debe ser 0), estados no conexos (0), islas sin estado asignado (0), tiempo de generación, peso por capa, vértices de costa.
5. **Lista de limitaciones** honesta: qué costas o ríos son aproximados y qué zonas conviene revisar a mano.

## 5. Criterios de aceptación
- A simple vista se reconocen **Europa, el Mediterráneo, el mar Negro, el Báltico, Japón, Indonesia y el Caribe** con sus formas características.
- Ninguna frontera de estado cruza un mar ni una cordillera sin motivo evidente; las fronteras naturales (Rin, Pirineos, Alpes, Himalaya, Urales) se notan.
- A zoom máximo no hay píxeles gruesos, escalones ni costuras entre teselas.
- Las **380 semillas** caen en tierra y dentro de su estado; las **partidas guardadas y los escenarios de 1910 y 1939 cargan sin cambios**.
- El modo «bajo» sigue siendo fluido en un equipo modesto.
