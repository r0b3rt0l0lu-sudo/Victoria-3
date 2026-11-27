# Prompt para Claude Design: modelos más detallados y animaciones de combate para el modo «Batalla» de *Victoria*

**Rol y objetivo.** Eres un artista 3D técnico y animador de videojuegos de estrategia histórica (referencias: *Total War: Napoleon* en zoom cercano, *Scourge of War*, *Holdfast: Nations at War*, *Men of War*, *Ultimate General*; estilo estilizado pero con **mucha más riqueza de detalle y de movimiento** que los modelos actuales). Entregas **código JavaScript de three.js r152 sin archivos externos** que se integra en el juego de estrategia *Victoria* (1836–1945, navegador, un único HTML), para un modo nuevo de **batalla campal de hasta 4 cuerpos de ejército**, con soldados individuales, caballería y artillería controlables.

> Alcance de época: **1836–1945**. No incluyas nada posterior a 1945.

## 1. Qué hay ya (no lo rehagas desde cero; mejóralo y amplíalo)

Módulo `troops3d.js` (rig rígido de partes, ≤ 20 partes por figura, animación horneada por clip y fotograma en una textura, instancias en GPU). Tipos que ya existen: `fusilero, granadero, tirador, oficial, abanderado, zapador, sanitario, prisionero, herido, artillero, husar, coracero, lancero, dragon, general, ayudante, mariscal, mensajero, estandarte, canon, canon_rc, obus, ametralladora, avantren, carro_municion, carreta, carreta_bueyes, tanque, parapeto` y grupos (`bateria` con 4 servidores, `ametralladora`, `general`, `mariscal`, `camilla`, `fuerte`, `tren`). Épocas de equipo `A–E` (A: avancarga de chispa/percusión; B: fusil rayado; C: retrocarga y cerrojo; D: Primera Guerra Mundial; E: Segunda Guerra Mundial). Formato de clip (`CLIPS.soldado`, `CLIPS.jinete`, `CLIPS.canon`…):

```
{dur: segundos, loop: bool,
 tracks: {parte: [[t, rx, ry, rz], …]},      // grados, Euler XYZ, t ∈ [0,1)
 armaP/armaR: posición (m) y rotación (°) del arma respecto al torso,
 agarre: [[t, yManoDerecha, yManoIzquierda]],   // −1 = mano libre
 ev: [[t, 'nombre']],                           // eventos: disparo, recarga, pisada, impacto…
 root: [[t, x, y, z]],                          // metros
 hide: [partes ocultas]}
```
Partes del soldado: `pelvis, torso, cabeza, brazoIz, antebrazoIz, brazoDe, antebrazoDe, musloIz, piernaIz, musloDe, piernaDe, pieIz, pieDe` (+ arma y equipo). Color por zonas: 0 casaca, 1 ribete, 2 pantalón/accesorio, 3 tocado, 4–6 bandera, 7 vehículo, ≥ 8 colores fijos (piel, cuero, metal, madera); la paleta por nación × época × papel se lee de una textura. Niveles de detalle: LOD0 (detalle), LOD1 (≤ 60 triángulos por soldado), LOD2 (silueta ≤ 10). 1 u ≈ 0,6 m. Ejes: x derecha, y arriba, z hacia el espectador.

Ya hay clips de combate de soldado (marcha, apuntar, disparar, recargar, cubrirse, tumbarse, morir de varias formas, herido arrastrándose, lanzar granada, bayoneta, etc.) y los de cobertura que me diste (`pegarse_pared`, `asomar_esquina_*`, `agachado_muro_bajo`, `tras_arbol`, `ventana_*`, `trepar_muro`…). Mantén nombres coherentes y **no rompas los existentes**.

## 2. Qué necesito (en orden de prioridad)

### A. Infantería: más detalle y más personalidad (LOD0 y LOD1)
1. **Modelos LOD0 más detallados** por época A–E: tocado reconocible (chacó, bicornio, casco de pinchos, kepis, gorra, casco Adrian, Stahlhelm, casco británico Brodie), cuello y botones, correajes cruzados, mochila y manta enrollada, cartuchera, cantimplora, bayoneta con vaina, calzado y polainas; **variantes por nación** (al menos: Prusia/Alemania, Austria, Francia, Reino Unido, Rusia, EE. UU. Norte/Sur, España, Italia, Japón) y **variantes de rango**: soldado, cabo, sargento, teniente (sable, bicornio/gorra, gorget, bastón), capitán a caballo, portabandera, corneta, tambor, gaitero (escoceses), zapador con hacha y mandil, tirador/jäger con fusil rayado, granadero con gorro alto.
2. **Variación por instancia** ampliada: altura, complexión (3 tipos), bigote/barba (sin añadir geometría pesada: usar zona de color y 1–2 cajas), tono de piel, desgaste del uniforme (barro, polvo, sangre) controlable por un parámetro 0–1 (el juego lo sube con el tiempo de combate).
3. **Animaciones nuevas de infantería** (cada una en variantes `_A` avancarga, `_B` rayado, `_D` cerrojo/cargador cuando el gesto cambie):
   - Marcha de columna (paso ordinario, paso de carga, paso gimnástico), con el fusil al hombro, a la funerala y «a discreción».
   - **Descarga por filas**: «¡Preparen! ¡Apunten! ¡Fuego!» (primera fila de rodillas, segunda de pie), con eventos de disparo sincronizables.
   - Recarga completa del avancarga con **todos sus pasos** (morder el cartucho, cebar, verter, atacar, baqueta, retirar baqueta) y variantes de **fallo de ignición**.
   - **Formar cuadro** (rodilla + bayonetas hacia fuera), mantener el cuadro, romper el cuadro.
   - **Cargar a la bayoneta** (trote, galope corto, grito), **lucha cuerpo a cuerpo** (estocada, parada, culatazo, empujón; ataque y reacción emparejados con eventos de impacto), **duelo de oficiales con sable**.
   - **Escaramuzador**: avance a saltos, tumbarse, apuntar apoyado en el árbol/roca, correr agachado de cobertura a cobertura.
   - Reacciones: **impacto en brazo/pierna/torso/cabeza** (5–6 variantes cada una), **tambaleo** y caída, **sacudida por explosión cercana**, **encogerse**, **dudar/retroceder** (moral baja), **huida en pánico**, **rendición** (manos arriba), **ser capturado y escoltado**.
   - Vida de campamento y relevo: descansar sentado, beber, fumar en pipa, escribir una carta, vendar a un compañero, cargar a un herido, llevar munición, empujar una pieza.
4. Oficial y mando: **dar voz de mando** (brazo en alto, espada hacia delante), **señalar con el catalejo**, **leer un despacho**, **dar órdenes a un mensajero**, **alzar la espada y cargar**, **corneta y tambor tocando**, **abanderado clavando el asta y alzando la bandera**.

### B. Caballería: modelos y animaciones nuevos
1. **Caballos**: 4 pelajes + variantes de cuerpo (pesado/ligero), con crines y cola con animación secundaria, arneses y montura por tipo.
2. **Jinetes** por tipo con LOD0/LOD1/LOD2: húsar (dolman y pellizas, sable curvo), coracero (coraza y casco con cresta), lancero (lanza con banderola), dragón (a caballo y a pie), cazador a caballo, cosaco, caballería de reserva y **oficial/general montado**, y **mensajero**.
3. **Aires del caballo con el jinete**: parado, paso, trote, **galope de carga** (con fase de suspensión), **rampa** (parada brusca y encabritarse), **giro cerrado**, **salto de obstáculo (seto/muro bajo)**, **retroceso**.
4. Combate: **carga con lanza** (lanza en ristre → impacto → soltar), **carga con sable** (alzar, tajo, reponer), **golpe a un infante** y **golpe a otro jinete** (emparejados con eventos), **caballo herido** (cojera, caída, jinete derribado), **jinete desmontado** (cae y se levanta), **caballo sin jinete** huyendo, **persecución** (galope con sable bajo).
5. Escuadrón: **formación en línea y en columna de escuadrones** como grupos predefinidos (posiciones relativas) para instanciar.

### C. Artillería: dotaciones, piezas y ciclo de servicio completo
1. **Piezas** por época con LOD0–LOD2: cañón de bronce de 6 y 12 libras (A), obús de campaña, **cañón rayado de retrocarga con freno hidráulico** (B/C), **cañón de 75** (D/E), obús pesado, **cañón de montaña**, **cohete Congreve** con su rampa, **cañón de asedio de 24 libras con cureña de asedio**, **mortero**, **ametralladora Gatling / Maxim / Vickers / MG 34-42**, **antitanque de 37–50 mm**, **cañón de campaña de la SGM**.
2. **Servicio de pieza completo** como secuencia de animaciones sincronizadas de **5–8 servidores** + jefe de pieza (nombres de rol y eventos): *escobillar el ánima, cargar el saquete, atacar con el atacador, cebar el oído, apuntar con el tornillo de puntería, dar fuego con botafuego, retroceso de la pieza y devolverla a su lugar, limpiar con esponja*; y la versión de **retrocarga** (abrir cierre, cargar proyectil, cerrar, disparar con cordón).
3. **Movimiento**: pieza enganchada al **avantrén y tiro de 4–6 caballos con conductores**, **trote y galope de batería**, **enganchar y desenganchar**, **poner en batería**, **cambio de posición**, **tren de municiones** (carro de municiones con caballos).
4. **Reacciones**: pieza **dañada o desmontada** (rueda rota, cureña partida), servidores **muertos y heridos** junto a la pieza, **explosión de depósito de pólvora**, **recorte de metralla** («bote» de metralla).
5. **Efectos de la pieza**: retroceso del tubo y de las ruedas, **humo con volumen y persistencia**, fogonazo con luz, polvo y trozos al impactar.

### D. Apoyo y vida del ejército
Cirujano y camilleros (camilla a pie y a caballo), **ambulancia de tracción animal**, **carreta de suministro y de bagaje**, **mulas de carga**, **herrero y ayudante**, **comisario/pagador**, **prisioneros escoltados en columna**, **banderas** (ondeo con viento y roto por impactos), **estandartes de regimiento** con asta y borlas, **tambores y cornetas**, **perros y gaiteros** (opcional).

### E. Casas y escenarios (más variedad y más detalle)
Mejora y amplía el módulo de pueblos: **12–16 tipos de edificio** (las 7 existentes + **herrería, molino de agua, molino de viento, panadería, taberna, iglesia con cementerio, ayuntamiento, almacén, establo, granja fortificada con patio, hacienda, casas adosadas urbanas de 2–4 plantas, torre de vigilancia, puente de piedra y de madera, vado marcado, ermita, calvario**), **variantes por región y época** (centroeuropeo de entramado, mediterráneo, ruso de madera, inglés de ladrillo, norteamericano de madera, japonés), **daños de guerra progresivos** (0 → 3), tejados de teja, pizarra, paja y chapa, chimeneas con humo, ventanas con postigos, **puertas que se abren**, **escaleras y tejados transitables** (puntos de tirador), muros de cercado con **brechas** y vallas. Calles con adoquines, carros y objetos de calle (cubos, barriles, pilas de leña). **Interiores simples** de planta baja para 4–6 edificios (una sala con ventana, mesa y suelo) como opción de LOD0.
**Escenario**: más especies y variantes de árbol (con otoño/invierno), setos con huecos, cultivos con espigas y surcos (trigo, maíz, viñedo, patata, pradera), **trincheras con parapeto, alambradas, caballos de frisa, abatis, gaviones, empalizadas, cráteres, fosos, puentes de pontones**, **campo de batalla con restos** (armas, mochilas, cadáveres, cañones abandonados) generables por parámetro.

### F. Efectos y atmósfera
**Humo de pólvora volumétrico** con densidad y tiempo de disipación; **niebla de batalla** y de la mañana; **polvo de las columnas y de la caballería**; **lluvia, barro con huellas, nieve con rastros**; **chispas de impacto**; **estelas de bala redonda y rebote**; **explosión de obús** con onda y cráter; **fuego en edificios y bosques**; **sombras y luz de amanecer/ocaso**.

## 3. Requisitos técnicos

- **three.js r152, JavaScript puro, sin archivos externos, sin texturas descargadas.** Todo procedural. Comentarios en español.
- **Presupuestos** (por figura): LOD0 ≤ 900 triángulos de soldado de a pie y ≤ 1 800 de jinete con caballo; LOD1 ≤ 60 y ≤ 140; LOD2 ≤ 10 y ≤ 24. Piezas de artillería LOD0 ≤ 1 500. Edificios LOD0 ≤ 3 500 triángulos (casa grande), LOD1 ≤ 1 200, LOD2 ≤ 400. Se verán hasta **4 000 figuras** a la vez con instancias en GPU.
- **Compatibilidad con el rig actual**: ≤ 20 partes rígidas por figura; los jinetes y las piezas con servidores se montan como **grupos** (varias figuras con una posición relativa) si no caben en una sola.
- **Formato de animación idéntico** al de `CLIPS.*` (arriba). Si necesitas más pistas (cola, crin, banderola), añade partes con nombres claros y documéntalo. Cada módulo exporta `registrar(Troops3D, opciones)` que añade modelos y clips **sin reemplazar** los existentes.
- **Emparejamientos**: para las animaciones de cuerpo a cuerpo, jinete contra infante y servicio de pieza entrega **el clip de cada participante** con las marcas de evento coincidentes (`impacto`, `parada`, `cae`) y el **desfase relativo** de sus posiciones.
- **Raíz y suelo**: cada clip mantiene los pies sobre el suelo (sin penetrar más de 3 cm ni flotar más de 3 cm); la raíz declara su desplazamiento (`META[clip].avance` en m por ciclo).
- **Metadatos por clip**: `META[clip] = {suelo, avance, desplazamiento, eventos, armaCompatible: ['A','B','D'], transiciones: [clip…]}`, y un **grafo de transiciones** con las rutas válidas entre clips (como ya hiciste con las animaciones de cobertura).
- **Rendimiento**: 1 llamada de dibujo por tipo, época y LOD; sin asignaciones por fotograma.
- **Pruebas automáticas** (Node, sin WebGL): validan suelo, recuento de triángulos por LOD, número de partes, coherencia de eventos, simetría y que ningún clip produce valores no finitos. **Demos** (`demo.html?m=…`) por cada módulo con menú: infantería, caballería, artillería, apoyo, pueblos, escenario, efectos.

## 4. Entregables

Un archivo por módulo, con la misma estructura que ya me diste (`terreno3d.js`, `pueblos3d.js`, `vegetacion3d.js`, `animaciones_cobertura.js`, `proyectiles3d.js`, `hud_soldado.js`):

| Archivo | Contenido |
|---|---|
| `infanteria3d.js` | Modelos A–E por nación y rango, variantes y animaciones de la sección A |
| `caballeria3d.js` | Caballos, jinetes, aires, carga y combate (sección B) |
| `artilleria3d.js` | Piezas, servicio completo, tiro de caballos, reacciones (sección C) |
| `apoyo3d.js` | Sanidad, trenes, prisioneros, banderas, músicos (sección D) |
| `pueblos3d.js` (actualizado) | Edificios, calles, interiores, daños (sección E) |
| `escenario3d.js` | Fortificaciones de campaña, cultivos, restos, puentes, objetos |
| `efectos_batalla3d.js` | Sección F |
| `INTEGRACION_*.md` | Cómo integrarlo, API, límites y verificación, como en la entrega anterior |

## 5. Criterios de calidad

1. **Se lee a 20–60 px**: silueta y color por nación y rango legibles a distancia.
2. **Se ve rico a 3 m** (cámara de soldado): detalles, arrugas de uniforme, correajes, bayoneta.
3. **Movimiento creíble**: pesos, transferencia de apoyo, retrocesos, secundarios (colas, correajes, banderas).
4. **Coherencia histórica**: equipo, uniformes y procedimientos por época (cita en comentarios la fuente o el reglamento cuando proceda).
5. **Honestidad**: indica qué no pudiste verificar (por ejemplo, animaciones no vistas con los modelos finales o rendimiento sin GPU real).
