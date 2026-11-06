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

## Pendiente / ideas (no implementadas)
- Fatiga y munición por regimiento más finas, municiones de artillería limitadas.
- Persecución con bajas diferenciadas según caballería disponible.

Fuentes: [reglas Lexnet](https://www.dbai.tuwien.ac.at/user/mst/games/lbn/nlcrules120.pdf), [1st Empire](https://deepfriedhappymice.com/html/rd_1st_empire_2.html), [MTW Morale](https://forums.totalwar.org/wiki/index.php/MTW_Morale), [Total Generalship: Morale and Cohesion](https://acoup.blog/2022/07/01/collections-total-generalship-commanding-pre-modern-armies-part-iiic-morale-and-cohesion/).
