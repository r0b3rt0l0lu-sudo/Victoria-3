# Prompt para Claude Design: soldados, tanques, motorizados y artillería de 1939 (época E)

**Rol y objetivo.** Eres un artista 3D técnico y animador de personajes para videojuegos de estrategia histórica (referencias: *Hearts of Iron IV* en zoom cercano, *Company of Heroes* en estilo estilizado, *Total War*). Diseña la **época E (1937-1945)** del conjunto de tropas 3D de baja complejidad de mi juego de estrategia *Victoria* (web, three.js r152, sin modelos ni texturas externos): **soldados, tanques, vehículos motorizados y artillería de la Segunda Guerra Mundial**. Debe encajar con las cuatro épocas que ya existen (**A 1836-1855, B 1856-1880, C 1881-1913, D 1914-1936**) y reutilizar su contrato técnico: `TROOP_ERAS = ['A','B','C','D']` pasa a `['A','B','C','D','E']`.

## 1. Dónde se verán
| Contexto | Tamaño en pantalla | Qué importa |
|---|---|---|
| Mapa de campaña 3D | 4-12 px de alto, cientos de unidades | Silueta y color de nación; distinguir de un vistazo infantería / motorizada / blindada / artillería |
| Visor de batalla 3D (cada regimiento ≈ 3.000 hombres = 20-40 figuras) | 30-90 px | Formación, uniforme, arma, animación de disparar/avanzar/caer; tanques y camiones legibles |
| Ficha de unidad / retrato | 200-400 px | Detalle, nación y modelo reconocibles |
Tres niveles de detalle: **LOD0** cerca, **LOD1** medio, **LOD2** impostor (2 triángulos o silueta de 6-10).

## 2. Estilo (imprescindible)
- **Estilizado y pintado**, no fotorrealista: soldados algo robustos (≈ 5,5 cabezas), formas simples y siluetas marcadas; paleta del juego (oliva, ocres y verdes apagados). Vehículos con volúmenes claros, pocas aristas y detalles mínimos (escotillas, cañón, orugas, faros).
- **Teñido por nación**: cada figura/vehículo separa `tint` (color principal: guerrera/camuflaje base/pintura del vehículo) de `fixed` (piel, cuero, metal, madera, goma, orugas, cristales). Segundo color opcional (ribetes, marcas). La **cruz/estrella/roundel** de nación va como zona `fixed` intercambiable por nación (propón cómo).
- Variación por instancia sin coste: altura ±6 %, piel (4 tonos), brillo ±8 %, desfase de animación aleatorio; suciedad/polvo opcional en vehículos.
- Iluminación del juego: luz direccional cálida + ambiente, `MeshLambertMaterial` (sin PBR).

## 3. Catálogo de la época E (todo lo que usa el juego)
**Soldados** (cada uno con LOD0/1/2 y sus animaciones):
1. **Infantería de fusilero** (casco de acero, fusil de cerrojo con bayoneta, mochila, cantimplora, cartucheras).
2. **Ametrallador** con ametralladora ligera (bípode) y **pareja de ametralladora pesada** (trípode, cinta de munición, 2 servidores).
3. **Ingeniero/zapador** (pala, cargas, lanzallamas opcional) y **sanitario con camilla**.
4. **Oficial** (pistola, prismáticos, mapa), **radio-operador** (radio a la espalda) y **portaestandarte**.
5. **Infantería mecanizada** (soldado desmontando del vehículo; fusilero con postura baja) y **tirador de fusil antitanque / bazuca** (ligero).
6. **Paracaidista** opcional y **prisioneros / heridos** (manos arriba, en fila; caído con gesto).
7. **Caballería** residual (solo polacos, soviéticos y alemanes: jinete con carabina; sin lanza) con 2-3 pelajes.

**Vehículos motorizados** (con 1-3 modelos nacionales cada uno):
8. **Camión de transporte** con lona y tropas sentadas atrás (variante con tiro de remolque de cañón).
9. **Coche de mando / jeep** (con oficial y conductor) y **motocicleta con sidecar** (con ametralladora).
10. **Semioruga blindado** (tipo Sd.Kfz. 251 / M3) con 6-8 soldados y ametralladora; **transporte de carga** y **ambulancia**.
11. **Tractor de artillería** que remolca un cañón (animación de enganche).

**Tanques** (3 clases, con **orugas animadas** y torreta giratoria):
12. **Tanque ligero** (≈ Panzer II / T-26 / Renault R35 / Vickers).
13. **Tanque medio** (≈ Panzer III-IV / T-34 / Sherman / Crusader / Char B1 según nación).
14. **Cañón de asalto / cazacarros** (sin torreta, casamata: tipo StuG III / SU-76).
15. **Autoametralladora blindada de reconocimiento** (ruedas) y **tanquette** (CV-33 / TKS).
Cada tanque: casco, torreta, cañón (con retroceso), ametralladora, escotilla del comandante (con tripulante asomado opcional), orugas con ruedas/rodillos y **banda de oruga que avanza**, **marca nacional** y **destruido** (carcasa humeante).

**Artillería** (con sirvientes):
16. **Cañón de campaña** 75-105 mm con 4 sirvientes y escudo.
17. **Obús pesado** 150-155 mm con 5-6 sirvientes y munición apilada.
18. **Cañón antitanque** pequeño (37-57 mm, bajo, con escudo) con 3 sirvientes.
19. **Cañón antiaéreo** (tipo 88 mm / Bofors) elevable, con 4 sirvientes.
20. **Lanzacohetes** múltiple opcional (tipo Katyusha) sobre camión.
21. **Artillería autopropulsada** (obús sobre chasis de tanque, casamata abierta).
22. **Carro/camión de munición** y **posición con sacos de arena** (para guarnición de fuerte).

## 4. Naciones del escenario de 1939 (tabla de uniformes y pintura)
Entrega una **tabla por nación** con hex de color principal/secundario, tocado, equipo, **pintura de vehículos**, marca nacional y 1-2 detalles: **Alemania (Wehrmacht: feldgrau, casco M35, tanques gris panzer, cruz de balkenkreuz)**, **Reino Unido (caqui, casco Brodie, tanques verde oliva, roundel)**, **Francia (caqui/azul horizonte, casco Adrian, tanques con camuflaje)**, **Unión Soviética (guerrera verde caqui, casco SSh-36, tanques verde 4BO, estrella roja)**, **Estados Unidos (oliva, casco M1, estrella blanca)**, **Italia (grigio-verde, casco M33)**, **Japón (caqui amarillento, gorra con cubrenuca, tanques ocre, sol naciente)**, **Polonia (caqui, casco wz.31, águila)**, y variantes genéricas para **Canadá, Australia, Sudáfrica, Hungría, Rumanía, Yugoslavia, Finlandia, Turquía, China y neutrales**: indica qué se reutiliza con solo cambiar `tint`.

## 5. Animaciones (nombre, duración, bucle y eventos)
Cada clip con **duración (s), bucle y eventos** (instante del disparo, impacto, paso, retroceso: sincronizan humo, sonido y bajas).
- **A pie:** `idle`, `marcha`, `marcha_rápida`, `avance_agachado`, `tumbarse`, `apuntar`, **`disparar`** (cerrojo: ciclo corto con maniobra del cerrojo), `recarga`, `lanzar_granada`, `cuerpo_a_cuerpo_bayoneta`, `cubrirse`, `rendirse`, `caer_herido`, `morir_(2 variantes)`, `cadáver`, `bajar_del_vehículo`, `subir_al_vehículo`.
- **Ametralladora pesada/ligera:** `montar`, `disparar_ráfaga` (retroceso, casquillos, cinta que avanza), `cambiar_cargador/cinta`, `atascarse`.
- **Oficiales/radio:** `ordenar`, `observar_con_prismáticos`, `hablar_por_radio`.
- **Caballería:** `paso`, `trote`, `galope`, `carga_sable`, `desmontar`, `caballo_caído`.
- **Artillería:** `en_batería`, **`servicio_de_pieza`** (cargar → cerrar cierre → apuntar → fuego con **retroceso del cañón** → extraer casquillo), `enganchar`/`desenganchar` al tractor, `remolque`, `elevar_antiaéreo`, `pieza_destruida`.
- **Tanque:** `avanzar` (orugas y suspensión), `retroceder`, `girar_sobre_el_eje`, `girar_torreta`, **`disparar_cañón`** (retroceso, fogonazo, humo), `disparar_ametralladora`, `inmovilizado` (humo negro), `incendiado`, `destruido` (torreta desplazada), `comandante_asomado`.
- **Camión/semioruga/jeep/moto:** `ralentí`, `avanzar` (balanceo, ruedas girando), `frenar`, `descargar_tropas`, `cargar_tropas`, `volcado/destruido`.
Todo **mezclable** (0,15-0,3 s) y con **desfase aleatorio por instancia**.

## 6. Requisitos técnicos (contrato con el juego)
- **three.js r152**, todo generado en código o con datos pequeños incrustados (base64/JSON). Sin cargar ficheros externos.
- **Presupuesto de triángulos** (reporta los reales): soldado LOD0 ≤ 220 / LOD1 ≤ 60 / LOD2 impostor ≤ 10; camión con tropas ≤ 450; jeep/moto ≤ 200; semioruga con 6 soldados ≤ 800; tanque ligero ≤ 450, medio ≤ 600; cañón con 4 sirvientes ≤ 700; obús con 6 ≤ 900; antiaéreo ≤ 800; autopropulsado ≤ 700. Vehículos con LOD1 ≈ 40 % y LOD2 impostor.
- **Instanciación**: `InstancedMesh` con **dos mallas por tipo** (`tint` y `fixed`). Propón y justifica la **técnica de animación más barata** para **5.000-20.000 figuras** visibles (rig de partes con matrices por instancia o animación por vértices en *shader*), con prueba de rendimiento comparada. Orugas: propón textura desplazada / UV animado en lugar de geometría por eslabón.
- **Animaciones en JSON compacto** (partes, jerarquía, keyframes, eventos), interpolables por fase `t ∈ [0,1)` **sin estado interno**.
- **API pública** (ampliación de `troops3d.js`, sin dependencias salvo `THREE`):
  - `TROOP_ERAS = ['A','B','C','D','E']`; nuevos `TROOP_KINDS` para todos los tipos de la sección 3 (por ejemplo `'fusilero','ametrallador','mg_pesada','ingeniero','sanitario','oficial','radio','mecanizado','antitanque','camion','jeep','moto','semioruga','tanque_ligero','tanque_medio','cazacarros','autoametralladora','canon_campana','obus','canon_at','antiaereo','autopropulsado','tractor','municion'`).
  - `buildTroop(kind, 'E', opts) → {tint, fixed, parts, clips, lod: [...]}`, `poseTroop(kind, clip, phase, out)`, `blendPose(a, b, k)`, `uniformPalette(nation, 'E') → {main, trim, accessory, vehicle, mark}`, `troopStats()`.
  - Mapeo con las **unidades del juego** (batallones): `inf` → fusilero; `mot` → camión + fusileros; `mech` → semioruga + mecanizada; `arm` → tanque ligero/medio; `mtank` → tanque medio; `spg` → autopropulsado; `art` → cañón/obús; `mg` → ametralladora pesada; `eng` → ingeniero; `cav` → caballería. Una **división** mezcla hasta 9 batallones, así que cada tipo debe poder agruparse en columna y en línea.
- Rendimiento: sin asignaciones por fotograma; prueba con 5.000 y 20.000 figuras (CPU por fotograma y llamadas de dibujo). Debe funcionar sin extensiones WebGL2 especiales (documenta alternativas).

## 7. Entregables
1. **Hoja de estilo y *turnarounds*** (frente, perfil, espalda, 3/4) de cada unidad de la sección 3 y una por nación clave, con callouts de zonas `tint`/`fixed` y la marca nacional.
2. **Visor interactivo** (HTML con three.js r152 desde cdnjs, controles de órbita) para elegir **unidad, nación, LOD y animación**, ver los **eventos** en una línea de tiempo, alambre, triángulos y **modo columna/línea** con 30 figuras y un **modo tanque** con orugas en movimiento.
3. **`troops3d.js`** ampliado con la época E y el JSON de animaciones.
4. **Documento de integración** (1-2 páginas): cómo añadir la época E al `troops3d.js` existente, elegir la época por año (1937+ → E; 1914-1936 → D), tintar por nación, sincronizar eventos (disparo → fogonazo y humo, destruido → carcasa humeante) y cambiar de LOD por distancia.
5. **Tabla de uniformes y pintura de vehículos** por nación (hex y accesorios).

## 8. Proceso
1. **Primer punto de control:** hoja de estilo con **8 unidades clave** (fusilero, ametrallador, camión con tropas, semioruga, tanque medio, cazacarros, cañón antitanque con sirvientes y obús) en **Alemania, Reino Unido y Unión Soviética**, la técnica de animación propuesta con prueba de rendimiento y la lista de clips. **Espera mi OK.**
2. **Segunda entrega:** catálogo completo, animaciones, visor y `troops3d.js`.
3. **Tercera entrega:** LODs, prueba de estrés, documento de integración y ajustes.
En cada entrega indica **qué has comprobado** (capturas del visor, triángulos reales, tiempo por fotograma) y qué no.

## 9. Criterios de calidad
- A 8 px de alto se distinguen **infantería, motorizada, blindada y artillería** por silueta y movimiento.
- A 60 px se reconoce la **nación** (marca y pintura) y el **modelo** (tanque ligero frente a medio, cañón frente a obús).
- Las filas **no parecen clones**; las orugas y ruedas se ven moverse; el **retroceso** del cañón y la torreta giratoria se leen bien.
- Con 20.000 figuras la animación cuesta **menos de 2 ms por fotograma** en un portátil de gama media.
