# Plan: batalla 3D jugable y realista (fase de planteamiento)

Estado: **solo planteamiento, nada implementado**. Este documento recoge el diagnóstico del código actual, las referencias de otros juegos, el diseño propuesto, las fases, las preguntas abiertas y los prompts para Claude Design.

---

## 1. Diagnóstico: por qué casi nunca hay combate (medido en el código)

| Hecho | Dato | Consecuencia |
|---|---|---|
| Tamaño del campo | `BV_W×BV_H = 1920×840 u`, 1 u ≈ 0,6 m → ≈ 1150 × 500 m | El campo en sí no es enorme |
| Distancia inicial entre ejércitos | 730–860 u ≈ 440–520 m (medido en `sold.js`); en preparación, `gap·BV_K(2,4)` la aumenta | Hay que cruzar ~500 m |
| Velocidad del soldado | marcha 2,4 u/s ≈ 1,4 m/s; carrera 6,5 u/s | Hasta ~3–5 min a pie solo para llegar |
| Alcance útil del mosquete | ~100 m ≈ 170 u; los NPC solo piensan a < 260 u de la cámara | Fuera de ahí no pasa nada visible |
| Soldados por regimiento | `BV_FORM.inf.n = 6` (3×2); 1 figura ≈ **500 hombres** | Un impacto no puede equivaler a una baja: no hay correlación puntería↔baja |
| NPC con IA | ≈ 155 (solo los cercanos) | Los demás son «figuras de formación» sin IA propia |
| Casas | 1 caja por casa, a la altura del centro, esparcidas al azar (`±0,85 r`), sobre una malla de 320×150 celdas (≈ 8×9 u por celda) | Casas medio enterradas/flotando en cuestas, sin calles, solapadas |
| Cañones | `S.shell` = sprites en arco fijo, sin colisión; `SR2.shells` solo explosiones | No hay bala redonda que vuele, bote o mate a su paso |
| Pantalla completa | no hay uso de la Fullscreen API | |
| Peso | `index.html` ≈ 10,2 MB | Cualquier asset nuevo tiene que ser procedural o muy compacto |

Lo bueno que ya existe y se aprovecha: `troops3d.js` (instancias en GPU con animación horneada en texturas: un «draw call» por tipo/época/LOD, miles de figuras viables), sistema de cobertura `S.cov`, motor NPC `npc_combate.js` + `SR2`, `workers.js`/`wasmk.js` (hilos y WASM para cálculo pesado).

---

## 2. Referencias de otros juegos (qué copiar de cada uno)

Nota honesta: las búsquedas web dieron poco sobre los detalles internos de estos juegos (casi todo son reseñas y wikis de jugador). Lo que sigue combina lo poco verificado en fuentes con conocimiento general del género; marco cuál es cuál.

- **Total War (Creative Assembly)** — *verificado en fuentes*: IA en dos capas, «batalla» (grupos/órdenes) y «unidad» (mantiene formación); el movimiento individual de cada soldado es parte del entorno simulado, no de la IA de batalla. *Copiar*: orden a nivel de unidad + soldado que se mueve solo dentro de su hueco; la formación se deshace cuando reacciona a amenazas cercanas.
- **Holdfast: Nations at War / Mount & Blade Napoleonic Wars** — *verificado*: órdenes de oficial («formar línea», «fuego») con tiempos de enfriamiento; el mod *Commander Battles* controla líneas de bots. *Copiar*: voces de mando que desencadenan el comportamiento colectivo (descarga por filas, avance, cargar).
- **Scourge of War / Ultimate General** — *verificado*: combate regimental con moral afectada por flancos, bajas, descargas y fatiga; las bajas persisten entre combates. *Copiar*: la moral por unidad como variable principal.
- **Men of War / Call to Arms / Squad** *(conocimiento general)*: cobertura por puntos y por geometría, supresión que baja la puntería, balas reales con trayectoria y daño por zona, heridos que se arrastran. *Copiar*: supresión y cobertura con pistas visuales.
- **Battlefield 1, Verdun, Tannenberg** *(parcialmente verificado)*: ambientación 1914-18, mapas con pueblos y tierra de nadie; críticas habituales a IA que no reacciona ni flanquea. *Evitar*: IA que ignora al jugador.
- **Técnica de multitudes en three.js** — *verificado*: instancias con textura de animación en el shader de vértices, LOD por instancia y sustitutos (impostores) para lo lejano; el coste de animar de forma independiente no desaparece con el batching. Coincide con lo que ya hace `troops3d.js`.
- **Historia militar** — *verificado*: mosquete liso eficaz a ~50–70 yardas contra un hombre, ~100 m en descargas; fuego concentrado en línea; Hougoumont/La Haye Sainte: los edificios fortificados estrechan el frente, con aspilleras y tiradores que rotan para recargar. *Copiar*: los edificios como puntos fuertes con aspilleras y rotación de tiradores.

---

## 3. Diseño propuesto

### 3.1 Escala jugable sin romper el mando (el problema nº 1)

Principio: **la capa 2D sigue siendo la autoridad del mando** (órdenes, posiciones de bloque, moral de unidad, bajas totales). El 3D es una *lente de alta resolución* sobre una parte del campo.

1. **Sector de combate.** Al pasar a 3D se elige un *foco* (el bloque del jugador o el contacto más cercano). Todo lo que está a < R_activo (≈ 350–450 m) del foco se simula a nivel de soldado; lo demás sigue como bloques 2D (Lanchester/probabilidades) y se dibuja con LOD lejano.
2. **Entrada «en contacto».** Antes de dar el control, se avanza la simulación 2D en tiempo comprimido hasta que el bloque del jugador esté a ~150–250 m del enemigo (o ya en fuego). Se muestra una transición de «marcha hasta el contacto» y se puede saltar.
3. **Herramientas dentro del 3D**: carrera con aguante, «marcha forzada ×4» que se corta sola al ver al enemigo a < 300 m, teletransporte a otro pelotón del mismo bloque al morir, minimapa de sector.
4. **Coherencia**: cada pelotón hereda `mode`/orden de su bloque 2D (avanzar, mantener, flanquear, cargar, retirada). Si el jugador (como soldado) se separa, no cambia la orden del bloque.

### 3.2 Jerarquía y soldados como entidades

`Regimiento (bloque 2D) → Batallón → Compañía/pelotón (30–60) → Escuadra (8–12) → Soldado`

- **Agente soldado**: `{id, pelotón, rango, hp, munición, moral, miedo, supresión, postura, estado, objetivo, hueco}`.
- **Tres niveles de simulación** para poder tener muchos:
  - **N1 (completo)**: ≤ 400 soldados a < 250 m del foco: IA individual, balística real, animaciones completas.
  - **N2 (simplificado)**: ≤ 1500 soldados: movimiento por «steering», tiro por probabilidad, sin cobertura fina.
  - **N3 (agregado)**: el resto, como bloque 2D.
  Los agentes cambian de nivel al entrar/salir del radio, conservando identidad.
- **Escala hombre↔figura**: por defecto 1 figura = 10 hombres en N2 y **1 figura = 1 hombre en N1** (el pelotón del jugador y los más cercanos). Cada baja de N1 resta 1 hombre al bloque 2D; cada baja de N2 resta 10. Así acertar = eliminar, y el 2D sigue cuadrando.
- **IA individual dentro del marco de las órdenes** (utilidad + máquina de estados): la orden fija objetivo, formación, disciplina de fuego (por descarga / a voluntad) y postura; el soldado decide solo cuándo dispara, a quién, dónde se cubre, cuándo recarga y cuándo flaquea. Moral individual con contagio; oficial, tambor, abanderado y sargento como entidades que emiten las voces de mando.

### 3.3 Balística y artillería real

- Proyectiles individuales: fusil con dispersión por distancia/postura/supresión, cápsula de impacto por soldado, rejilla espacial (spatial hash) para consultas O(1).
- **Bala redonda**: esfera visible con estela, trayectoria balística, **bote en el suelo** que atraviesa filas (ronda de rebote), mata a todos los que cruza; **metralla** (cono), **granada/obús** (explosión con fragmentos), impacto en muros (daño a obstáculos).
- Contrabatería y humo que bloquea visión (ya hay base en `SR2.shells`).

### 3.4 Escenario realista

- **Terreno**: malla por *chunks* con resolución 2 u en la zona jugable (hoy ~8 u); materiales triplanares (hierba, tierra, barro, roca, camino) en lugar de un solo lienzo.
- **Pueblos con plano**: red de calles (calle principal + transversales), parcelas a ambos lados, **plataformas aplanadas con cimentación** (adiós a las casas bajo cuestas), tipos de casa (casa baja, granja con patio, granero, posada, iglesia, molino, mansión), tejados a dos aguas, chimeneas, puertas, ventanas, vallas, huertos, pozos, muros de piedra. Estilo según bioma/región. Casas con aspilleras utilizables.
- **Vegetación y rocas**: hierba en instancias (LOD, viento), árboles con 3 LOD e impostores, arbustos, setos, campos de cultivo con surcos, rocas de varias formas, troncos, cráteres y huellas.
- **Cobertura generada de la geometría**: esquinas de muro/casa, muros bajos, rocas, árboles, zanjas, setos; cada punto con tipo (alta/baja), lados de asomo y capacidad.

### 3.5 Animaciones de cobertura (jugador y NPC)

`pegarse_pared`, `asomar_esquina_izq/der`, `agachado_muro_bajo`, `asomar_sobre_muro`, `tras_arbol`, `tras_roca`, `ventana_apuntar`, `tumbarse`, `tumbado_apuntar`, `arrastrarse`, `levantarse`, `trepar_muro`. Se hornean como clips en `troops3d.js` para que los usen igual el jugador y los NPC.

### 3.6 Pantalla completa

Fullscreen API sobre el contenedor del 3D, HUD reescalado a la resolución real (hoy el HUD es un lienzo fijo 1920×840), bloqueo de puntero, gestión de `Esc`, y cambio de aspecto de cámara.

### 3.7 Rendimiento (aceptamos coste alto, pero con palancas)

Presupuestos objetivo: 60 fps en ordenador medio con ≤ 400 N1 + 1500 N2; 30 fps en gama baja con perfil reducido. Palancas: IA por turnos (N agentes/fotograma según prioridad), rejilla espacial, simulación en `Worker`, hot-loops en WASM (`wasmk.js`), LOD/impostores, chunks de terreno por distancia, calidad automática con `rendimiento.js`. Compensar peso del archivo con generación procedural (sin texturas externas).

---

## 4. Fases y comprobaciones

| Fase | Contenido | Prueba que lo valida |
|---|---|---|
| P0 | Medir línea base (fps, tiempo hasta contacto, nº de NPC) | informe de `scratchpad` |
| P1 | Sector de combate + entrada en contacto + marcha forzada | contacto en < 60 s en 100 % de 20 batallas simuladas |
| P2 | Soldados individuales y pelotones (N1/N2/N3), órdenes → comportamiento, bajas ↔ 2D | test: nº bajas 3D = bajas restadas al bloque; sin desvío > 2 % |
| P3 | Balística individual, bala redonda con bote, metralla, obuses | test: proyectil que cruza una fila mata exactamente a los de su trayectoria |
| P4 | Terreno por chunks + pueblos con plano + casas en plataformas | test automático: ningún vértice de casa a < 0,2 u bajo el terreno ni flotando > 0,3 u |
| P5 | Vegetación, rocas, cobertura generada y animaciones | test: ≥ 90 % de los NPC en cobertura usan el clip adecuado |
| P6 | Pantalla completa, HUD, ajustes de calidad, regresiones y manual | capturas + suites existentes (`windows.js`, `sold.js`, `fz.js`, `ms.js`) |

Cada fase termina con commit, push y el `index.html` enviado.

---

## 5. Riesgos y límites honestos

- 1 hombre = 1 figura **solo en la zona activa**; un regimiento de 3000 hombres completo en pantalla no es viable en el navegador sin recortes (por eso N1/N2/N3).
- Más soldados + chunks + hierba aumentan memoria y CPU; habrá que tener perfiles de calidad y quizá un tope en móviles.
- Los modelos y animaciones nuevos deben seguir el esqueleto actual de partes rígidas (no hay huesos de malla): la animación de trepar o arrastrarse queda estilizada.
- `index.html` pesa ~10 MB: lo nuevo debe ser procedural o muy comprimido.
- Interior de casas: caro; propongo solo aspilleras/ventanas con tirador visible desde fuera en la primera versión.

---

## 6. Preguntas abiertas

1. **Entrada al combate**: ¿prefieres salto automático hasta el contacto (rápido) o que se vea la marcha con cámara acelerada ×4 y poder tomar el control cuando quieras?
2. **Escala de soldados**: ¿te vale 1 figura = 1 hombre solo en tu zona (~400 soldados) y 1:10 en el resto, o quieres subir el 1:1 a ~800–1000 aunque pida un buen PC?
3. **Muerte del jugador**: ¿reaparece en otro soldado del pelotón, se acaba la partida de soldado, o hay heridas/tiempo de espera?
4. **Mando**: ¿el jugador solo obedece las órdenes del bloque, o puede dar órdenes al pelotón (avanzar, cubrirse, fuego a voluntad) desde el modo soldado?
5. **Interiores**: ¿bastan aspilleras y ventanas o quieres entrar en los edificios?
6. **Épocas**: ¿mismo nivel de detalle para 1836-1865 (avancarga), 1866-1914 (cerrojo) y 1914-1945 (metralleta/carros)? La cobertura y la balística cambian mucho.
7. **Hardware objetivo**: ¿ordenador de sobremesa/portátil con GPU dedicada, o también gama baja y móvil?
8. **Formato de assets de Claude Design**: ¿puede devolver código JS procedural (preferible) y/o JSON de clips, además de imágenes de referencia?

---

## 7. Prompts para Claude Design

Contexto común para pegar al inicio de cada prompt:

> Proyecto: juego de estrategia de navegador (1836–1945), un único `index.html` con three.js r152, **sin archivos externos ni texturas** (todo procedural en JS, peso mínimo). Los soldados usan «rig rígido de partes» (≤ 20 partes por figura: pelvis, torso, cabeza, brazoIz, antebrazoIz, brazoDe, antebrazoDe, musloIz, piernaIz, musloDe, piernaDe, pieIz, pieDe) con animaciones horneadas por clip y fotograma en una textura; 1 u ≈ 0,6 m; ejes: x derecha, y arriba, z hacia el espectador. Entrega código JavaScript autónomo en un solo archivo, sin dependencias, con comentarios en español y una función de prueba que dibuje una escena de demostración.

**Prompt A — Pueblos y casas**
> Genera un módulo `pueblos3d.js` con `buildVillage(seed, bioma, era, tf, opts)` que devuelva geometría para three.js (BufferGeometry fusionada por material + InstancedMesh para repeticiones). Debe: 1) trazar un plano real (calle principal curva + 2–4 transversales + plaza con iglesia/pozo), 2) parcelar a ambos lados con casas orientadas a la calle, 3) aplanar una plataforma bajo cada edificio y crear cimentación/zócalo que llegue al terreno (recibe `tf.height(x,z)`), nunca flotando ni enterrado; 4) tipos: casa baja, casa de dos plantas, granja con patio y granero, posada, molino, iglesia con campanario, mansión; 5) tejados a dos/cuatro aguas con chimeneas, puertas y ventanas con marcos, buhardillas, vallas, muros de piedra, huertos; 6) estilos por bioma (centroeuropeo de entramado, mediterráneo de teja y cal, ruso de madera, inglés de ladrillo, norte nevado) y época (1836–1860 / 1861–1910 / 1914–1945 con daños de guerra: muros reventados, tejados caídos); 7) 3 niveles de detalle; 8) devolver también `colliders` (rectángulos/segmentos), `cover` (puntos de cobertura con tipo alta/baja y lados de asomo), `loopholes` (aspilleras/ventanas con posición y dirección). Máximo ~8 000 triángulos por pueblo grande en LOD0.

**Prompt B — Vegetación, hierba y rocas**
> Módulo `vegetacion3d.js` con generadores procedurales: hierba (matas en instancias con shader de viento, 3 LOD, densidad por distancia), 6 especies de árbol (roble, haya, pino, abedul, álamo, olivo) con 3 LOD e impostor billboard, arbustos y setos, 8 rocas distintas (cantos, losas, afloramientos), troncos caídos, campos de cultivo con surcos y cosecha, cráteres de obús y huellas. Variación por instancia (escala, color, rotación), adaptación al bioma y la estación, y datos de colisión/cobertura (alto, radio, si se puede tras ella de rodillas o tumbado).

**Prompt C — Animaciones de cobertura**
> Para el rig de partes rígidas indicado, define clips con la misma estructura que `exportClipsJSON` (nombre, duración, bucle, fotogramas con rotación/posición por parte, fusiles de avancarga y de cerrojo): `pegarse_pared`, `asomar_esquina_izq`, `asomar_esquina_der`, `agachado_muro_bajo`, `asomar_sobre_muro_apuntar`, `tras_arbol`, `tras_roca`, `ventana_apuntar`, `tumbarse`, `tumbado_apuntar`, `tumbado_recargar`, `arrastrarse`, `levantarse`, `trepar_muro`, `herido_arrastrado`. Biomecánica creíble (peso, transferencia de apoyo, retroceso), transiciones entre ellas y marcas de evento (disparo, recarga, apoyo del pie).

**Prompt D — Proyectiles y efectos**
> Módulo `proyectiles3d.js`: bala redonda de cañón (esfera de hierro con estela de humo y chispa), trayectoria balística con rebote en el suelo (marcas de impacto y polvo en cada bote), metralla (cono de balines con silbidos), obús (explosión con onda, fragmentos y cráter), cohete Congreve, bala de fusil trazada, impactos en tierra/madera/piedra/carne, humo de pólvora que persiste y bloquea la visión, fogonazo de boca, retroceso del cañón y sus ruedas. Devuelve las funciones de actualización y los parámetros para la física (masa, velocidad inicial por época, coeficiente de rebote).

**Prompt E — Terreno y materiales**
> Módulo `terreno3d.js`: terreno por chunks (malla de 2 u en zona activa y 8 u lejos), normales suaves, materiales triplanares procedurales (hierba, tierra, barro con charcos, roca, camino con rodadas, nieve) mezclados por un mapa de pesos, sombras, humedad y huellas dinámicas. Función `heightAt(x,z)` coherente con la malla y utilidades para aplanar plataformas bajo edificios y excavar trincheras.

**Prompt F — Interfaz a pantalla completa**
> Diseña (HTML/CSS/canvas) el HUD de un soldado en primera persona que escala a cualquier resolución: salud, munición, brújula con objetivos del pelotón, indicador de supresión, órdenes recibidas del oficial, mini-mapa de sector con la línea de frente, rueda de órdenes al pelotón y botón de pantalla completa. Estilo: papel y tinta de época, sin elementos que parezcan de «shooter moderno». Entrega los estilos y el código del canvas en un archivo.

---

## 8. Siguiente paso

Cuando respondas a las preguntas (aunque sea con «lo que recomiendes») empiezo por **P0 + P1** (medir y arreglar el contacto), que es lo que más cambia la jugabilidad. En paralelo puedes pedir a Claude Design los prompts A–F; cada pieza se integra sin esperar a las demás.
