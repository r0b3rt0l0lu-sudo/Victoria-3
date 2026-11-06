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
