# Plan: modo «Batalla» (combate separado, realista y de principio a fin)

Estado: **solo planteamiento**. Nada de esto está implementado todavía.

## 0. Decisiones del usuario
1. IA de mando: **Estado Mayor por reglas y puntuación** (sin conexión, comprobable).
2. Mando del jugador: **se elige al empezar** (realismo de mando con mensajeros activado o no).
3. Escala: **grande, batallas campales de 4 cuerpos** (exige perfiles de calidad y N1/N2/N3 muy ajustados).
4. Escenarios: **Waterloo, Borodinó, Solferino, Gettysburg, Königgrätz, Sedán, Primera Guerra Mundial y 1939-45**, además de **generación aleatoria y a elección** de escenarios.

## 1. Qué pides, traducido a requisitos

| Petición | Requisito técnico |
|---|---|
| Modo aparte dentro del juego | Pantalla «Batalla» en el menú principal; no necesita campaña ni guerra previa. |
| Todos los soldados con IA propia | Hoy solo tienen IA completa los de ~150 m alrededor de la cámara. En este modo toda la tropa activa del campo piensa (con niveles de coste, ver 4.2). |
| Directrices generadas con IA para ambos ejércitos | Un «Estado Mayor» por bando que genera un plan de batalla (fases, objetivos, reservas, condiciones de cambio de plan) y lo traduce en órdenes a cuerpos, divisiones, brigadas y regimientos. |
| Batalla que se decide de verdad | El enemigo no puede escapar del mapa. Se acaba por destrucción, rendición, ruptura del ejército o fin del día con objetivo cumplido. Habrá persecución dentro del campo. |
| Que el jugador no se despegue | Una sola experiencia continua: carga, despliegue, batalla, persecución, resultado. Sin saltos entre vistas sueltas; el jugador cambia de unidad sin salir de la batalla. |
| Más soldados, más animaciones, mejor IA | Campo mayor y regimientos de 200–600 figuras visibles (según equipo), animaciones propias para cada arma y tarea. |
| Mejor escenario y variedad | Terreno por trozos, pueblos con calles, hierba, árboles, rocas, cultivos, caminos, ríos y vados, fuertes; climas y horas del día. |
| Mejores casas | Los 7 tipos de edificio de Claude Design + variantes por región y época, con aspilleras y ventanas utilizables. |
| Controlar artillería y caballería | Modos de control propios: pieza de artillería (servicio real, elevación, tipos de munición) y caballería (galope por fases, carga, sable, lanza). |
| Manual propio del modo | `manual_batalla`: documento y sección del juego solo para este modo. |
| Todos los tipos de combate | Campo abierto, defensiva en alturas, asedio y asalto a fuertes, combate en pueblos, paso de río, emboscada y retaguardia, persecución, batalla de encuentro. |

## 2. Investigación (qué hacen otros juegos, y qué dice la historia)

Nota honesta: las búsquedas dieron poco sobre el diseño interno de estos juegos; lo no verificado lo marco como «general».

**Juegos**
- **Scourge of War: Waterloo / Gettysburg** (verificado): cadena de mando completa, de ejército a brigada. Cada comandante recibe órdenes de su superior, las interpreta, forma su propio plan y manda mensajeros a sus subordinados; con más rango, más pesa el sistema de mensajeros. Mejoró la IA de mando de brigada. *Copiar*: **órdenes con retraso y cadena de mando**; el jugador puede jugar como comandante o como oficial subalterno.
- **Total War: Napoleon** (parcial): la IA tiende a avanzar en línea recta contra el jugador y solo actúa «inteligente» en las batallas históricas con guion. *Evitar*: IA de «embestida única». *Copiar*: batallas históricas guionizadas como escenarios.
- **Ultimate General: Gettysburg / Civil War** (verificado en parte): la moral se ve afectada por flancos, bajas, descargas de fusilería y artillería, y fatiga; los generales dan bonificaciones de moral y recuperación dentro de un radio, y las unidades fuera de su mando se recuperan mucho más despacio; los suministros pueden acabar la batalla antes de tiempo; hay problemas conocidos con la ruptura de unidades. *Copiar*: **radio de mando del general**, moral por causas, suministro de munición.
- **Holdfast / Mount & Blade Napoleonic** (parcial): voces de mando con enfriamiento; líneas de bots controladas por un comandante. *Copiar*: voces de mando.
- **Men of War / Squad / Battlefield 1** (general): supresión, cobertura por geometría, balas reales. Ya implementado en la vista de soldado.

**Historia (para calibrar el comportamiento)**
- **Königgrätz (1866)**: los austriacos con táctica de choque en columnas de ~1000 hombres contra infantería prusiana con fusil de retrocarga y orden abierto; los prusianos buscaron la superioridad de fuego con tiradores; la retirada ordenada de Benedek, cubierta por su artillería, evitó la derrota total. Cifras: ~43 000 bajas austriacas (la mitad prisioneros) frente a ~9 000 prusianas. *Reglas*: columna cerrada contra fuego moderno = catástrofe; retaguardia protegida por artillería.
- **Waterloo (1815)**: Hougoumont y La Haye Sainte estrechan el frente de ~1,5 km a ~450 m; los edificios fortificados absorben fuerzas y condicionan el ataque. *Reglas*: pueblos y granjas como puntos fuertes con aspilleras y relevo de tiradores.
- **Mosquete liso**: eficaz contra un hombre a ~50–70 yardas; ~100 m en descarga; 1 de cada 6 disparos fallaba con chispa de pedernal. Ya aplicado.
- **Gettysburg (1863) y Solferino (1859)**: no pude verificar en esta búsqueda; los usaré como escenarios históricos y pediré revisar sus parámetros contigo.

**Lo que sale de la investigación**
1. Batalla en **fases** (despliegue → fuego de artillería → avance de línea → combate decisivo → ruptura → persecución).
2. **Mando por niveles** con mensajeros y radio de mando.
3. IA del Estado Mayor con **plan, reservas y condiciones de cambio de plan** (no «embestida en línea»).
4. **Moral** como variable que decide: causas visibles y ruptura contagiosa.
5. **Persecución real**: el que rompe huye hacia el borde y es cazado; no desaparece.
6. **Escenarios históricos** guionizados para validar.

## 3. Diseño del modo

### 3.1 Flujo (una sola experiencia)
1. **Constructor**: bando(s), época, doctrina, tamaño de ejércitos (de brigada a 4 cuerpos), terreno/escenario, clima, hora, tipo de combate, nivel de dificultad y nivel de realismo (mando con retraso sí/no).
2. **Carga única** del campo y de todas las tropas (pantalla de carga con consejos); después no hay más cargas.
3. **Despliegue**: colocas cuerpos y reservas en tu zona; ves lo que ve tu observación (niebla).
4. **Batalla** continua con fases; cambias entre tres escalas sin cortes: **mando** (cámara alta, órdenes a cuerpos), **unidad** (seguir a un regimiento) y **soldado/pieza/jinete** (control directo).
5. **Persecución y resultado**: estadísticas, prisioneros, banderas, trofeos; opción de repetir con otro plan.

### 3.2 El «no huir»
- El campo está cerrado: bordes con obstáculos o tropas de flanqueo; las rutas de retirada son zonas concretas (puentes, caminos, pasos). Quien las pierde queda **cercado** y se rinde (como ya existe en el juego).
- Un ejército **roto** huye por esas rutas: el vencedor puede perseguirlo con caballería; lo que se salva es lo que cruza la ruta antes del final.
- Condiciones de fin: destrucción o captura de ≥ 70 % del enemigo, ruptura del ejército (moral global < umbral y sin reservas), objetivo mantenido al anochecer (escenarios) o rendición.

### 3.3 Estado Mayor de IA («directrices generadas»)
Capas para cada bando: **General en jefe** (plan: fijar, flanquear, defender en altura, ataque concéntrico, retirada escalonada, con reservas y puntos de decisión) → **cuerpos** (objetivo, eje de avance) → **divisiones/brigadas** (formación, orden, apoyos) → **regimientos** (maniobras) → **soldados** (IA individual dentro de la orden).
- El plan se genera a partir de: relación de fuerzas, terreno (alturas, pueblos, pasos), doctrina de cada ejército y época, información (niebla), estado de moral y suministro.
- Reevalúa cada 20–40 s con **disparadores** (flanco amenazado, reserva comprometida, pérdida del objetivo).
- Con «mando realista», las órdenes viajan con **mensajeros** y tardan; el jugador ve su propia cadena.

### 3.4 Escala y rendimiento
- Niveles: **N1** IA completa (≈ 400–800 en la zona del jugador), **N2** IA simplificada (≈ 2 000–4 000), **N3** bloque 2D agregado (el resto). Cada soldado conserva ficha.
- Terreno por trozos, hierba por celdas, árboles con 3 LOD e impostores, instancias de soldados con animación horneada.
- Perfiles de calidad automáticos y medición de fps en GPU real (pendiente que me pases un perfil de tu equipo).

### 3.5 Control de artillería y caballería
- **Artillería**: elegir pieza; servicio por pasos (ya existe en el modo asedio), elevación y tipo de munición (bala redonda, metralla, obús, cohete), corrección por observadores, contrabatería, humo que tapa la visión.
- **Caballería**: control de un jinete o de un escuadrón; fases de carga (paso, trote, galope, carga), sable/lanza, coraceros contra cuadro, persecución de tropas rotas, exploradores.
- **Infantería**: líneas, columnas, cuadros, escaramuzadores, descargas por filas, bayoneta.
- Cada arma tiene su propia **ficha de control** y animaciones.

### 3.6 Escenario y variedad
- Generador por bioma, estación y hora: colinas, vaguadas, ríos con vados, bosques, cultivos, setos, caminos, pueblos (aldea, villa, ciudad pequeña), granjas fortificadas, fuertes, puentes.
- Escenarios históricos con plano base (Waterloo, Königgrätz, Gettysburg, Solferino, Borodinó, Sedán, etc.) y condiciones de victoria.
- Meteorología (lluvia, niebla, nieve) y hora (amanecer, mediodía, ocaso) con efectos en la visibilidad y el fuego.

### 3.7 Manual del modo
Documento `MANUAL_BATALLA.md` y sección «Manual de batalla» dentro del juego: conceptos (mando, moral, fases, fuego, caballería, artillería), controles por arma, guía de escenarios, consejos tácticos y glosario. Con capturas.

## 4. Fases de trabajo (propuesta)
| Fase | Qué | Cómo se valida |
|---|---|---|
| B0 | Medir línea base y definir escenarios de prueba con congelación del tiempo | informe |
| B1 | Pantalla «Batalla» + constructor + escena única sin recargas | batallas generadas sin errores, contacto en < 60 s |
| B2 | Estado Mayor IA por capas con planes y reevaluación | 30 simulaciones: ninguna batalla termina por «dos líneas quietas»; el plan cambia ante flanqueo |
| B3 | Fin de batalla sin huida + persecución | tests: nadie «sale» del mapa; resultados coherentes |
| B4 | N1/N2/N3 y más soldados | fps por perfil, bajas 3D ↔ unidad cuadran |
| B5 | Control de artillería y caballería | pruebas guionizadas |
| B6 | Escenario: terreno por trozos, pueblos, vegetación, escenarios históricos | capturas y pruebas de terreno |
| B7 | Manual del modo + tutorial | revisión contigo |

## 5. Pendiente de Claude Design (cuando lo apruebes)
- Animaciones: jinete (paso, trote, galope, carga, sable, lanza), servidores de artillería por tipo de pieza, oficial dando órdenes, mensajero a caballo, tambor y corneta, cirujano y camillero, prisioneros.
- Modelos: caballos y variantes, piezas de artillería de varias épocas y carros de munición, carros de ambulancia y suministro, banderas, puentes, vados, graneros y molinos.
- Variantes de casa por región y época, iglesias, granjas fortificadas, murallas y puertas.
- Efectos: humo de pólvora con persistencia, niebla de batalla, lluvia y barro.
- HUD: panel de mando por cuerpos, cadena de mando, mensajeros, estado de moral y munición.

## 6. Riesgos y límites
- Los fps con miles de soldados con IA solo se pueden validar con una GPU real.
- Las batallas históricas necesitan datos fiables (órdenes de batalla y mapas): conviene que me indiques las fuentes que prefieres.
- La IA «generada» será un sistema de planificación por reglas y puntuación (no un modelo de lenguaje), para que funcione sin conexión y sea determinista y comprobable.
