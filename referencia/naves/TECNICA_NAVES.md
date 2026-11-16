# naves3d — primer punto de control

Módulo `naves3d.js` (three.js r152, script clásico, sin archivos externos ni `fetch`) para combates navales y aéreos en 3D, más el **paracaidista** añadido a `troops3d.js`.
Este punto de control cubre 8 unidades clave × Reino Unido, Alemania y Japón (época 2, 1936–1945). La época 1 (1914–1918) queda para la segunda entrega.

## Técnica de animación

Misma familia que troops3d (todo en GPU, una malla instanciada por tipo + modelo + LOD), adaptada a máquinas:

1. **Esqueleto pequeño horneado** (8 partes por esqueleto: `buque`, `avion`, `aa`). Las matrices de cada clip se hornean en una textura float (12 fps en bucle, 16 fps sin bucle). Se usa para lo que mueve el casco o la célula: balanceo, cabeceo, escora, hundirse, partirse en dos (proa y popa son partes), inmersión, periscopio, chalupas, ascensores, alabeo, picado, barrena, ala que se desprende.
2. **Dos partes «param» sin geometría** cuya traslación lleva escalares por fotograma: `param.x` tren plegado, `param.y` retroceso de los cañones principales, `param.z` compuertas de bombas, `param2.x` retroceso antiaéreo. Así el tren, las compuertas y el retroceso también salen del clip, sin huesos extra.
3. **Movimiento procedural por vértice** (cada vértice lleva tipo + pivote): torre, cañón de torre, montaje AA, cañón AA, radar, hélice, tren, compuerta y bandera.
4. **Puntería por instancia** (`iAim` = rumbo y elevación de las torres, rumbo y elevación de la AA, en radianes respecto al casco). Cada buque, avión o pieza apunta a su blanco sin hornear nada: la CPU escribe 4 números cuando cambia el blanco. Elevación < −0,5 = reposo. Las torres de proa giran ±150° desde proa, las de popa ±150° desde popa, los montajes de costado ±92° hacia su banda, las torretas de morro/cola de los bombarderos ±92° y las dorsales 360°.
5. **Colores por zona** leídos de una textura de paletas por nación × época × dominio (mar, aire, tierra). **Banderas**: atlas de 8×8 celdas que se llena con `flagSource(tag)` → en el juego, `b3FlagTex(tag)`; sin fuente, la bandera usa las zonas 4–6 de la paleta.

Atributos: 6 por vértice (posición, normal, color, `aInfo` = parte/zona/tipo, `aPiv`, `aAF` = aux + fx) y 4 por instancia (`iAnimA`, `iAnimB`, `iLook`, `iAim`) + la matriz: 14 de 16 ranuras, válido en WebGL1 con `OES_texture_float` (igual que troops3d).

## Prueba de rendimiento (Chromium sin GPU, SwiftShader)

Escena: 24 buques (6 acorazados, 8 destructores, 4 submarinos, 6 portaaviones) + 80 aviones (50 cazas, 30 cuatrimotores) de las 3 naciones, todos moviéndose, con LOD y puntería reescrita **cada fotograma** (peor caso).

| medida | resultado |
|---|---|
| CPU por fotograma (rearmar lotes + matrices + puntería, 104 instancias) | **0,11–0,18 ms** de media (objetivo ≤ 3 ms) |
| Llamadas de dibujo | 18–24 (una por tipo × modelo × LOD visible) |
| Triángulos todo en LOD0 | 50 304 |
| Horneado de clips al arrancar | 23–31 ms |
| Construcción de las 54 mallas (18 tipos × 3 LOD) | 70–75 ms |
| Textura de huesos | 48 × 1537 float (1,13 MB) |
| Programas de shader | 1 (+1 del mar) |
| Asignaciones por fotograma | ninguna en `add`/`setAim`/`setClip` (objetos temporales reutilizados) |

Picos aislados de CPU de hasta ~10 ms en headless (recolección de basura del navegador o subida de búferes): no investigados.

## Triángulos (LOD0 / LOD1 / LOD2)

| unidad | Reino Unido | Alemania | Japón | límite |
|---|---|---|---|---|
| Acorazado | KGV 844/204/11 | Bismarck 750/215/11 | Yamato 637/208/11 | 1600/500/12 |
| Destructor | Tribal 490/204/11 | Z1 518/220/11 | Fubuki 535/193/11 | 900 |
| Submarino | Clase T 198/104/11 | VIIC 222/104/11 | I-15 (B1) 218/114/11 | 500 |
| Portaaviones | Illustrious 408/161/11 | Graf Zeppelin* 412/161/11 | Shōkaku 474/148/11 | 1600/500/12 |
| Caza | Spitfire I 434/114/10 | Bf 109 E 294/114/10 | A6M2 330/106/10 | 450/150 |
| Cuatrimotor | Lancaster 780/298/10 | Fw 200 C* 614/274/10 | G8N1 Renzan* 668/266/10 | 900 |
| AA (sin dotación) | Bofors 40 178/98/10 | Flakvierling 38 175/85/10 | Tipo 96 ×3 ~120/66/10 | 500 con dotación |
| AA + 3 servidores | 526 | 487 | 456 | 500 (GBR lo supera en 26) |
| Paracaidista (troops3d) | 217/73/16 | 217/73/16 | 217/73/16 | 220 |

\* aproximación (Graf Zeppelin nunca se terminó; Condor y Renzan simplificados). Los buques de época 2 usan menos de la mitad del presupuesto: hay margen para más detalle si se aprueba el estilo.

## Decisiones de diseño a revisar

- **Sin esvástica**: ensign alemán = tricolor negro-blanco-rojo; deriva de los aviones alemanes sin marca. Igual que en troops3d.
- **Japón**: ensign del sol naciente (bandera naval histórica de la Armada Imperial).
- Sin franja nacional en el casco (no es histórica): la identificación del buque es la bandera de popa con la textura del juego.
- Camuflaje de aviones = dos tonos por franjas (aprox.), no el patrón real.
- AA británica con dotación = 526 triángulos (26 por encima): se arregla con la dotación en LOD «lite» si lo quieres estricto.

## Qué está verificado y qué no

Verificado: las 21 combinaciones construyen sin errores y respetan los límites (salvo la AA británica con dotación); el shader compila y se ve en Chromium/SwiftShader; puntería, retroceso, tren, ascensores, inmersión, partirse y hundirse revisados en las hojas; paracaídas oculto en los clips del soldado que no son de paracaidista; números de la prueba de rendimiento.
No verificado: GPU real y móviles; WebGL1 sin `OES_texture_float` (falta la ruta de reserva en CPU, que troops3d sí tiene); integración en `naval3d.js` (no se ha tocado el repositorio); compuertas de bombas a escala de juego (funcionan, pero apenas se ven); exactitud de colores de pintura más allá de las fuentes citadas en `n_pal.js`.

## API

```js
const S = new naves3d.NaveShared(['GBR','GER','JPN'], {flagSource: tag => b3FlagTex(tag)});
const set = new naves3d.NaveLodSet(S, 'acorazado', '2', 'GER', 32);   // misma forma que TroopLodSet
scene.add(...set.meshes);
// cada fotograma:
S.update(t); set.begin();
const h = set.add(dist, x, y, z, rumbo, escala, tag, 'navegar_marejada', {phase, aim: [rumbo, elev, rumboAA, elevAA]});
set.setClip(h, 'andanada', t, true); set.setAim(h, rumbo, elev);
naves3d.eventsBetween('acorazado', 'andanada', ph0, ph1, (ev) => ...);   // 'fuego', 'humo', 'torpedo', 'bomba'...
naves3d.buildNave('acorazado','2',{nation:'GER'}).emit  // posiciones de bocas de fuego, AA y motores para partículas
```

`NAVE_MAP` traduce los tipos del juego (sail, steam, ironclad, cruiser, sub, dread, destroyer, carrier, bb, fighter, bomber, military_aviation) a tipos de naves3d; los de la época 1 quedan marcados como pendientes.

## Clips implementados

### Esqueleto «buque» (26 clips)

| clip | duración | bucle | eventos |
|---|---|---|---|
| navegar_calma | 8 s | sí |  |
| navegar_marejada | 6 s | sí | roción |
| navegar_tormenta | 5 s | sí | ola_rompe |
| avante_toda | 4 s | sí | estela |
| girar_babor | 4 s | sí |  |
| girar_estribor | 4 s | sí |  |
| fuego_artilleria | 6 s | sí | fuego, fogonazo, humo, cargar |
| andanada | 3 s | no | fuego, fogonazo, humo, onda_agua |
| fuego_antiaereo | 1.2 s | sí | fuego_aa |
| lanzar_torpedos | 3 s | no | torpedo |
| recibir_impacto | 1.6 s | no | impacto, columna_agua, humo |
| incendio | 3 s | sí | fuego, humo_negro |
| escorar | 5 s | no | inundacion, humo_negro |
| hundirse_proa | 14 s | no | inundacion, vapor, remolino, hundido |
| hundirse_popa | 14 s | no | inundacion, vapor, remolino, hundido |
| volcar | 12 s | no | inundacion, vuelco, hundido |
| partirse | 14 s | no | explosion_santabarbara, columna_humo, se_parte, remolino, hundido |
| inmersion | 8 s | no | purga, burbujas, sumergido |
| emerger | 8 s | no | soplado, espuma, en_superficie |
| sumergido_periscopio | 8 s | sí | estela_periscopio |
| botar_chalupas | 6 s | no | pescantes, chalupas_al_agua |
| operar_ascensores | 12 s | sí | ascensor_baja, ascensor_sube |
| lanzar_aviones | 10 s | sí | despega |
| cortina_de_humo | 4 s | sí | humo_cortina |
| lanzar_bengala | 2 s | no | bengala |
| fondeado | 10 s | sí |  |

### Esqueleto «avion» (23 clips)

| clip | duración | bucle | eventos |
|---|---|---|---|
| en_tierra | 2 s | sí |  |
| rodar_pista | 1.2 s | sí | polvo |
| despegar | 6 s | no | motor_a_fondo, despegue, tren_arriba |
| vuelo_nivelado | 4 s | sí |  |
| viraje_izquierda | 4 s | sí |  |
| viraje_derecha | 4 s | sí |  |
| ascenso | 3 s | sí |  |
| picado | 3 s | sí | silbido |
| tonel | 2.5 s | no |  |
| ataque_en_picado | 7 s | no | frenos_de_picado, sirena, bomba, recuperacion |
| disparar | 0.6 s | sí | rafaga, casquillos |
| disparar_torretas | 0.8 s | sí | rafaga_torreta |
| soltar_bombas | 5 s | no | compuertas, bomba |
| lanzar_torpedo | 4 s | no | torpedo |
| lanzar_paracaidistas | 8 s | no | salta, luz_verde |
| recibir_impacto | 1.2 s | no | impacto, chispas, restos |
| humo_motor | 2 s | sí | humo_motor |
| incendio | 1.5 s | sí | fuego_motor, humo_negro |
| caer_en_barrena | 2 s | sí | humo_negro |
| partirse_ala | 5 s | no | explosion, ala_rota, humo_negro |
| colision | 1.5 s | no | colision, explosion, restos |
| aterrizar | 7 s | no | tren_abajo, toma, polvo |
| apontar | 5 s | no | toma, cable, frenado |

### Esqueleto «aa» (4 clips)

| clip | duración | bucle | eventos |
|---|---|---|---|
| reposo | 4 s | sí |  |
| disparar_AA | 1.2 s | sí | fuego_aa, casquillos |
| recargar | 3 s | no | cargador_fuera, cargador_dentro |
| destruido | 1.5 s | no | explosion, humo_negro |

### Paracaidista (troops3d, esqueleto soldado)

| clip | duración | bucle | eventos |
|---|---|---|---|
| saltar_en_paracaidas | 1.4 s | no | salta, cinta_estatica |
| descender_en_paracaidas | 3.2 s | sí | balanceo |
| aterrizar | 1.8 s | no | toca_suelo, rueda, libera_arnes |

## Clips propuestos para la segunda entrega

Buques: `virar_por_avante` (cambio de banda con escora), `encallar`, `remolcar`, `fuego_a_bordo_extinguido`, `minar` (minador), `desembarcar` (lancha), `catapultar_hidroavion`. Aviones: `lanzar_desde_catapulta`, `amerizar`, `aterrizaje_forzoso`, `remolcar_planeador`, `soltar_planeador`. Defensa: `reflector` (haz que barre), `cambio_de_cañon`.

## Plan de entregas

1. **Este punto de control** (8 unidades × 3 naciones, técnica, rendimiento, clips). Espera tu OK.
2. Resto de la época 2: crucero, acorazado de bolsillo, buque mercante, lancha torpedera, transporte de tropas, hidroavión, bombardero en picado, torpedero, bimotor, avión de transporte (para el paracaidista), planeador; reflector y cañón AA pesado (88 / 3,7 in / tipo 88); USA, FRA, ITA y SOV con modelos propios.
3. Época 1: dreadnought, crucero de batalla, destructor de 1914, submarino U-boot / clase E, biplano de caza, bombardero Gotha / Handley Page, zepelín, globo de observación, AA de 1915.
4. Integración en `naval3d.js` y batalla aérea (con documento para Claude Code, como `INTEGRACION_TROPAS.md`), ruta de reserva en CPU y prueba en móvil.
