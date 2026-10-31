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

## 5. Métricas y resultados
- Duelos equilibrados IA nueva | antigua (24): estados 318|286; días con capital ocupada 18|59; bajas 1,55 M|2,13 M; divisiones 1246|1037; provincias ocupadas 17|46.
- Simulación de 80 años: sin errores JS; 9–13 guerras visibles; mundo de 62 → ~24–30 países; GBR ≈ 39 estados; 13 países con aviación (97 escuadrones) hacia 1915.
- Parámetros de IA: `AI_TUNE = {tempo:0, defBase:0.9, reqBase:1.45, ratioDef:0.4}`.

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
