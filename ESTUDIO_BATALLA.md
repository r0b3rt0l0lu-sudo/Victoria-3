# Estudio: realismo táctico del campo de batalla (c. 1815-1914) — fase 3

Complementa `ESTUDIO_LINEA.md`. Fuentes: reglas de wargames napoleónicos (Lexnet/«Lasalle»-style, *1st Empire*, *Napoleon at War*, Napoleonic Battle Series) y notas de la comunidad sobre la moral en Total War (Medieval/Three Kingdoms); las cifras son orientativas **[verificar]**.

## Ideas que se han implementado
1. **La moral es lo que gana batallas, y el flanco la rompe.** Casi todos los sistemas aplican una penalización de moral al ser atacado de flanco o espalda (−4 a −6 en MTW; −2 por estar rodeado en reglas napoleónicas) y se combina con el desgaste: quebrar una unidad exige primero bajarle la salud y luego un golpe de moral. → `bvCorpsPanic`: un cuerpo cuyos regimientos reciben golpes de flanco/espalda o tienen el ala abierta con enemigos cerca puede quebrarse **entero** (probabilidad creciente con baja moral/organización, menor si su comandante vive).
2. **El pánico es contagioso.** Las unidades que huyen restan moral a las vecinas (hasta −12 en MTW). El juego ya contagiaba entre regimientos próximos; ahora el pánico de un cuerpo salta además a los cuerpos vecinos (−16 % de moral).
3. **La carga no es de todos.** Históricamente las columnas de asalto (Upton en Spotsylvania, las cargas de caballería) eran una oleada de tropas escogidas; el resto de la línea fijaba al enemigo con fuego y relevaba o apoyaba. → solo carga una **oleada** (≈40 % de los regimientos de infantería, los más frescos y contiguos, más toda la caballería); el resto avanza detrás, dispara y mantiene la línea (`bvChargeWave`).
4. **Quien no flanquea, fija.** En el envolvimiento (Cannae, Königgrätz) el centro avanza y presiona para fijar al enemigo mientras el ala gira; si se queda quieto, el enemigo puede contraatacar al cuerpo que gira. → los regimientos que no maniobran avanzan, abren fuego y se redistribuyen por todo el frente para cerrar los huecos (`bvFillY`).
5. **Un fuerte no se rodea.** Dejar una guarnición a la espalda es un riesgo táctico (flanqueo, cañones del fuerte, línea de suministro): las reglas de wargame tratan casas y fuertes como terreno que se limpia. → las tropas atacan la guarnición del fuerte y, si está vacío, dos regimientos lo ocupan; la infantería pegada al fuerte lo desgasta (`tacFortObjective`, `tacFortPush`, `tacFortSiege`).
6. **El lugar importa.** Cada batalla se libra junto a un pueblo concreto con su propio escenario (cruce, puente, altura, bosque, villa amurallada, vado): `src/pueblos.js`.
7. **Un solo lenguaje de órdenes.** Seis órdenes (Avanzar, Cargar, Flanquear, Mantener, Retirar, Objetivo) más «Quedarse»; el mismo botón es plan individual (regimiento) o maniobra de línea (cuerpo), y el plan del ejército entero va aparte (`src/mando2.js`).

## Fase 2 (pulido y más realismo)
8. **Mando por proximidad.** Los regimientos a más de ~220 px de su comandante de cuerpo pierden moral poco a poco (más rápido si el comandante ha caído); se marcan con 📡✖ en tu bando (`bvCommandRange`).
9. **Cuadro de infantería.** La infantería que ve venir una carga de caballería a <190 px se cierra en cuadro durante unos segundos: se detiene, aguanta mejor la carga (−30 % de probabilidad de romperse) pero es un blanco para la artillería (`bvSquares`, `tacShellHit`).
10. Tapias más visibles en el mapa pintado y radio de partículas acotado (evita un error de dibujo).

## Fase 3 (`src/batalla3.js`)
11. **Munición por regimiento.** Cada uno lleva cartuchos (`blk.ammo`); disparar los gasta, por debajo del 25 % baja la cadencia y a cero solo queda la bayoneta (y la moral se resiente). Se reponen a retaguardia o en reserva si el ejército tiene pólvora (`suministros.js`). Aviso 🚫/••• en tus regimientos.
12. **Fatiga fina.** El cansancio frena la marcha (hasta −30 %) y baja la cadencia de fuego (hasta −25 %).
13. **Persecución diferenciada.** La caballería agotada persigue menos; una retirada en orden se defiende; bosques, pantanos, rocas y barrancos la frenan; puente y vado la agravan (cuello de botella). Factor `b.pursMul` aplicado en `ejercito.js`.
14. **Niebla de guerra.** Del enemigo solo ves lo que alcanzan a ver tus regimientos (340 px; 270 con lluvia/nieve; 190 con niebla; ×1,3 desde una altura; ×1,35 la caballería; línea de visión). El que dispara o está en melé se delata. Lo ya visto queda como un «?» que se desvanece.
15. **Objetivos por sede.** Pueblo (peso según tipo), puente, vado, altura o los dos bosques: quien tiene más regimientos dentro los controla, gana +2 % de ataque y defensa por peso (máx. 8 %) y recupera moral allí. Marcadores en el campo y ficha en la lista de terreno.

## Fase 4 (`src/batalla4.js`): anclajes
16. **Ciudades y fuertes anclan la línea.** Un regimiento pegado a un pueblo o fuerte propio (o a un pueblo sin dueño) queda «anclado» (⚓): el golpe de flanco no le hace efecto (solo la espalda), gana moral con el tiempo, la línea apoyada en él no cuenta como flanco abierto ni suma a la amenaza de pánico, y el ejército recibe hasta +6 % de defensa (×peso: fuerte 1,2 · ciudad 1 · aldea 0,7).
17. **Atacarlos compensa.** Cuando un ancla cae (pueblo o fuerte): +14 % de moral para el vencedor, −24 % (−10 % lejos) para el vencido y daño a sus defensores; el flanco que se apoyaba en ella queda al aire (pánico posible); el vencedor se queda con 1,2–3 unidades de comida y pólvora del enemigo. La IA defiende sus anclajes con dos regimientos que se plantan en el borde delantero y, si ataca o tiene ventaja, lanza tres a la carga contra el ancla enemiga.

## Plan «más realismo» en tres partes
- **Parte 1 — Combate y tropas** (hecha, `src/batalla5.js`): enfilada, tiradores, calidad de tropas, munición de artillería y proyectiles.
- **Parte 2 — Mando** (pendiente): mensajeros visibles, reserva del general, muerte del mariscal, humo de pólvora que tapa la visión.
- **Parte 3 — Terreno, clima y secuelas** (pendiente): barro e incendios, pendiente real, hora del día, heridos y enfermedad.

### Parte 1 (hecha)
18. **Enfilada.** Un tirador en el eje de la línea (a más del doble de distancia en y que en x) hace daño extra, baja organización y moral (artillería ×1,7) y aumenta las bajas del bando enfiladado (`b.enf`); flechas rojas «ENFILADA» en el campo. Los regimientos anclados ⚓ la sufren menos.
19. **Tiradores.** Cada cuerpo de infantería despliega una cadena que hostiga al enemigo a <260 px, absorbe hasta −3 % de daño y se repliega ante la línea (<115 px) o la caballería (que la arrolla si la pilla fuera). Botón 🏹 Tiradores por cuerpo.
20. **Calidad de las tropas.** Leva / recluta / regular / veterano según el entrenamiento (`d.tr`, `d.lv`) más un pequeño perfil por ejército (`NAT_Q`): cadencia, moral inicial y recuperación, retraso de las órdenes y gasto de munición. Se ve en el panel del regimiento.
21. **Munición de artillería y carros.** Cada batería gasta munición según el proyectil, se queda muda a 0 y la repone un carro (visible) si hay pólvora: rápido cerca de su borde del campo, lento lejos.
22. **Proyectiles.** Bala maciza (rasante contra columnas compactas), granada (desde 1850; daña fuertes, guarniciones y pueblos y puede incendiarlos), metralla (desde 1860; baja moral y organización a tropas en campo abierto) y bote a corta distancia.

## Pendiente / ideas (no implementadas)
- Munición limitada de artillería y carros de munición visibles.
- Cuadro con transición real (animación de formación).
- Equilibrar con muchas simulaciones largas el consumo de munición y el alcance de visión.
