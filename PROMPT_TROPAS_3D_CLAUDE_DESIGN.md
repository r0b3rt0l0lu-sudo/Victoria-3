# Prompt para Claude Design: tropas en 3D con animaciones

**Rol y objetivo.** Eres un artista 3D técnico y animador de personajes para videojuegos de estrategia histórica (referencias: *Total War: Napoleon*, *Hearts of Iron IV* en zoom cercano, *Sid Meier's Civilization* en estilo estilizado). Diseña un **conjunto completo de tropas en 3D de baja complejidad, con animaciones**, para un juego de gran estrategia del siglo XIX (1836-1936) que corre en el navegador con **three.js r152**, sin archivos externos (todo procedural o incrustado en código) y que debe mover **miles de soldados a la vez** incluso en un Chromebook.

## 1. Dónde se verán (y por tanto cómo deben leerse)
| Contexto | Tamaño en pantalla | Qué importa |
|---|---|---|
| Mapa de campaña 3D | 4-12 px de alto, cientos de unidades | Silueta y color de nación; que se distinga infantería / caballería / artillería de un vistazo |
| Visor de batalla (zoom cercano, cada regimiento ≈ 3.000 hombres representados por 20-40 figuras) | 30-90 px | Formación, uniforme, arma, animación de disparar/cargar/caer |
| Ficha de unidad / retrato en la interfaz | 200-400 px | Detalle, época y nación reconocibles |
Debe funcionar en tres niveles de detalle (LOD): **LOD0** (cerca), **LOD1** (medio), **LOD2** (impostor: 2 triángulos o silueta de 6-10 triángulos).

## 2. Estilo (imprescindible)
- **Estilizado y pintado**, no fotorrealista: proporciones algo robustas (cabeza grande, ≈ 5,5 cabezas), formas simples y siluetas muy marcadas, igual que el mapa del juego (paleta oliva, ocres y verdes apagados, rótulos serif).
- **Zonas de color de nación**: toda figura separa su **color principal (casaca/chaqueta)** del resto para teñirlo por instancia con un único color (`tint`) y mantener `fixed` (piel, correajes, cuero, metal, madera) con colores propios. Define también un **color de ribete/segundo color** opcional.
- Variación por instancia sin coste: altura ±6 %, tono de piel (4 valores), brillo de uniforme ±8 %, y desfase de animación aleatorio.
- Iluminación del juego: luz direccional cálida desde el noroeste + ambiente; materiales `MeshLambertMaterial` (sin PBR). Diseña para que se vea bien con esa luz.

## 3. Catálogo de unidades (con variantes de época)
Cada unidad en **4 épocas**: **A (1836-1855)** ánima lisa y casaca de color; **B (1856-1880)** fusil rayado y retrocarga; **C (1881-1913)** repetición, uniformes sobrios, ametralladora; **D (1914-1936)** casco de acero, caqui/gris campaña, tanques.
1. **Infantería de línea** (fusilero): chacó/shako → pickelhaube/kepi/sombrero de ala → casco de acero. Mosquete con bayoneta → fusil Mauser/Lee-Enfield.
2. **Granaderos / guardia** (gorro de piel, ribetes) y **tirador / infantería ligera** (escaramuzador, postura baja).
3. **Caballería**: húsar, coracero (peto y casco), lancero (lanza con banderola), dragón. Caballo con **2-3 pelajes**.
4. **Artillería**: cañón de ánima lisa con avantrén y 4 servidores; obús; cañón rayado de retrocarga; ametralladora (Gatling/Maxim) con 2 servidores; **carro de munición** y **limber con tiro de caballos**.
5. **Oficial y general**: oficial a pie con espada, general a caballo con ayudante, **mariscal** con plumero y estandarte de mando.
6. **Portaestandarte** (bandera de tela ondeando: pide un shader de vértices con ondulación).
7. **Mensajero a caballo** (jinete con cartera, galope largo).
8. **Zapador/ingeniero** (pala, hacha, gaviones) y **sanitario con camilla**.
9. **Prisioneros** (manos arriba, atados en fila) y **heridos**.
10. **Carro/carreta de suministro** (con tiro de mulas o bueyes).
11. **Tanques (solo época D)**: tanque romboidal Mark I (1917), tanque ligero tipo Renault FT con torreta giratoria y orugas animadas.
12. **Guarnición de fuerte**: tirador tras un parapeto y artillero de fuerte (reutiliza modelos con postura de cobertura).

## 4. Naciones (variaciones de uniforme sobre la misma malla)
Entrega una **tabla de uniformes por época** con colores (hex), tocado y detalles para: Reino Unido (casaca roja, bonete/casco colonial, caqui 1900), Francia (casaca azul, pantalón rojo, kepi; azul horizonte 1915), Prusia/Alemania (azul oscuro con pickelhaube; gris campaña), Austria (blanco, luego gris azulado), Rusia (verde oscuro/gris, gorra), Imperio Otomano (fez, azul), Estados Unidos (azul de la Unión/gris confederada; caqui), España, Italia, Japón, China Qing, Suecia/Dinamarca y un **uniforme genérico** teñible para cualquier otro país. No se pide un modelo por nación: **una malla + una paleta + 2-3 accesorios intercambiables** (tocado, ribete, bandolera).

## 5. Animaciones (con duración, bucle y eventos)
Define cada clip con **nombre, duración (s), si hace bucle y eventos** (momento exacto del disparo, del golpe, del paso, para sincronizar humo, sonido y bajas):
- **Todas las unidades a pie:** `idle` (respirar, mirar), `marcha` (paso cadenciado), `marcha_rápida`, `formar` (alinear), `apuntar`, **`disparar`** (ciclo completo: apuntar → disparo con retroceso → bajar → recarga de **5-7 pasos** para ánima lisa; ciclo corto para retrocarga), `recarga`, `cargar_bayoneta` (carrera con bayoneta calada), `melé` (golpear/ensartar, 2 variantes), **`cuadro`** (de rodillas con bayonetas hacia fuera), `ponerse_a_cubierto`, **`herido`**, **`caer_muerto`** (4 variantes: hacia atrás, hacia delante, de rodillas, de costado), `huir` (corriendo hacia atrás, tirando el arma), `rendirse` (manos arriba), `saludar`, `celebrar`.
- **Caballería:** `idle`, `paso`, `trote`, `galope`, `carga_con_lanza/sable`, `frenar`, `caballo_encabritado`, **`caballo_caído`** y jinete desmontado, `huida`.
- **Artillería:** `en_batería` (reposo), **`servicio_de_pieza`** (servidores: limpiar con escobillón → cargar → atacar → apuntar → fuego con **retroceso del cañón** → volver a posición), `enganchar` y `desenganchar` (limber), `remolque` (marcha con tiro de caballos), `pieza_destruida`, `servidor_caído`.
- **Oficiales/general:** `ordenar` (señalar con espada/bastón), `observar_con_catalejo`, `galope_de_mando`, `caída_del_general`.
- **Portaestandarte:** `ondear` (bandera en bucle) y `caer_con_estandarte` (otro soldado lo recoge).
- **Mensajero:** `galope_largo`, `entregar_orden`, `abatido`.
- **Tanque:** `avanzar` (orugas), `girar_torreta`, `disparar` (retroceso), `inmovilizado` (humo), `destruido`.
- **Fuerte:** `disparo_desde_parapeto`, `agacharse`, `asomarse`.
Todas las animaciones deben poder **mezclarse** (transición de 0,15-0,3 s) y arrancar con **desfase aleatorio por instancia** para que ninguna fila parezca un clon sincronizado.

## 6. Requisitos técnicos (contrato con el juego)
- **three.js r152**, sin cargar modelos ni texturas externos. Todo se genera en código o se incrusta como datos pequeños (base64/JSON).
- **Presupuesto de triángulos**: soldado LOD0 ≤ 220, LOD1 ≤ 60, LOD2 impostor (2 tris o silueta ≤ 10); caballo con jinete LOD0 ≤ 420, LOD1 ≤ 120; cañón con 4 servidores ≤ 700; tanque ≤ 600; general a caballo ≤ 500. Reporta los reales.
- **Instanciación**: el juego usa `InstancedMesh` con **dos mallas por tipo** (`tint` y `fixed`, como en su código actual). Propón y justifica la **técnica de animación más barata** para **5.000-20.000 figuras visibles**: *rig de partes* (≤ 12 partes por figura con matrices actualizadas por instancia), *vertex animation texture* (animación horneada en textura) o *esqueleto por shader*. Entrega una versión **CPU simple** para ≤ 2.000 figuras y la **horneada en GPU** para el máximo. Sin `SkinnedMesh` por soldado (es demasiado caro).
- **Datos de animación en JSON** compacto: partes, jerarquía, keyframes por clip (posición/rotación/escala), eventos. Debe poder **interpolarse por fase** (`t ∈ [0,1)`) sin estado interno.
- **API pública** (módulo `troops3d.js`, sin dependencias salvo `THREE`):
  - `TROOP_KINDS` (lista de tipos) y `TROOP_ERAS = ['A','B','C','D']`.
  - `buildTroop(kind, era, opts) → {tint: BufferGeometry, fixed: BufferGeometry, parts, clips, lod: [...]}`.
  - `poseTroop(kind, clip, phase, outMatrices)` y `blendPose(a, b, k)`.
  - `uniformPalette(nation, era) → {main, trim, accessory}`.
  - `troopStats()` con triángulos, partes y coste estimado.
- **Rendimiento**: sin asignaciones por fotograma, sin `new` dentro de bucles de animación, comparaciones con una **prueba de carga de 5.000 y 20.000 figuras** (reporta tiempo de CPU por fotograma y llamadas de dibujo).
- Compatibilidad: debe seguir funcionando sin WebGL2 especial; documenta cualquier extensión que uses y su alternativa.

## 7. Entregables
1. **Hoja de estilo y *turnarounds***: cada unidad en 4 vistas (frente, perfil, espalda, 3/4) por época y una por nación clave, con paleta numerada y callouts de las zonas teñibles (`tint`) y las fijas (`fixed`).
2. **Visor interactivo** (una página HTML con three.js r152 desde cdnjs, con controles de órbita) para: elegir **unidad, época, nación, LOD y animación**; reproducir con **velocidad variable**, ver **eventos** de la animación marcados en una línea de tiempo, alternar **alambre**, ver triángulos/FPS y activar una **prueba de estrés** de 5.000 / 20.000 figuras en formación.
3. **`troops3d.js`** con la API anterior y el JSON de animaciones.
4. **Documento de integración** (1-2 páginas): cómo sustituir las figuras actuales del mapa (`buildFigures`) y del visor de batalla, cómo sincronizar los eventos (disparo → fogonazo y humo, caída → cadáver), cómo cambiar de LOD por distancia y cómo teñir por nación.
5. **Tabla de uniformes** por nación y época (hex y accesorios).

## 8. Proceso
1. **Primera entrega (punto de control):** hoja de estilo con 6 unidades clave (fusilero, húsar, cañón con servidores, oficial, portaestandarte, tanque) en época A y D, la propuesta de **técnica de animación** con una prueba de rendimiento comparativa y la lista de clips. **Espera mi OK.**
2. **Segunda entrega:** catálogo completo, animaciones, visor y `troops3d.js`.
3. **Tercera entrega:** LODs, prueba de estrés, documento de integración y ajustes.
En cada entrega indica **qué has comprobado** (capturas del visor, triángulos reales, tiempo por fotograma) y qué no.

## 9. Criterios de calidad
- A 8 px de alto, **infantería, caballería y artillería se distinguen** por silueta y movimiento.
- A 60 px se lee **la época y el arma** (mosquete frente a fusil, shako frente a casco de acero).
- Las filas **no parecen clones** (variación y desfase) y el ciclo de **disparo-recarga** se reconoce como tal.
- Con 20.000 figuras el coste de CPU de animación es **menor de 2 ms por fotograma** en un portátil de gama media.
- Todo reproducible sin descargar nada.

## 10. Qué NO hacer
- No usar modelos, texturas o fuentes externos ni `fetch` en tiempo de ejecución.
- No usar `SkinnedMesh` por soldado ni animación por fotograma clave de miles de objetos separados.
- No hacer un modelo distinto por nación: una malla, paletas y accesorios.
- No sacrificar la legibilidad a pequeño tamaño por detalle que solo se ve de cerca.
- No inventar uniformes sin base histórica; si dudas, di cuál es la fuente o márcalo como aproximación.

## 11. Primera respuesta esperada
Un resumen de lo que has entendido, **5-6 unidades en estilo** (época A y D) con capturas del visor, la **técnica de animación elegida con números** y el **plan de entregas**. Nada más hasta mi visto bueno.
