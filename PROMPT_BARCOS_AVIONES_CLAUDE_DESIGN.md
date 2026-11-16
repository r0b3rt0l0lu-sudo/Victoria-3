# Prompt para Claude Design: barcos, aviones y tropas modernas para los combates aéreos y navales en 3D

**Rol y objetivo.** Eres un artista 3D técnico y animador para videojuegos de estrategia histórica (referencias: *Hearts of Iron IV* en zoom cercano, *Sid Meier's Pirates!*, *Silent Hunter*, *Battlestations: Midway*, *Wargame* en estilo estilizado). Diseña **buques, aeronaves y tropas de la época más moderna del juego (1914-1945)** con sus **animaciones**, listos para **dos visores de combate 3D**: el **naval** (flotas que se cañonean, torpedean y se hunden) y uno nuevo **aéreo** (cazas contra bombarderos sobre un objetivo, con defensa antiaérea). Entrega todo como **código three.js r152 sin ficheros externos**, siguiendo el estilo y el contrato del juego *Victoria* (estrategia 1836-1945, web, un único HTML).

> Alcance: si algún elemento solo existe después de 1945 (reactores a reacción de combate, misiles guiados, portaaviones nucleares), **no lo incluyas**; el juego ya no tiene era moderna posterior a la Segunda Guerra Mundial.

## 1. Dónde se verán
| Contexto | Tamaño en pantalla | Qué importa |
|---|---|---|
| Visor de batalla naval 3D (flotas de 4-24 buques en un mar abierto de ≈ 800 × 500 m escalados) | 60-300 px de largo por buque | Silueta por clase, bandera nacional, humo, fuego, hundimiento |
| Visor de combate aéreo 3D (escuadrillas de 6-60 aparatos, nubes, objetivo en tierra o buques) | 20-120 px | Silueta por tipo, cocardas, estelas, trazadoras, caídas en espiral |
| Mapa de campaña 3D (fichas con ícono, a veces miniaturas) | 6-14 px | Tipo y nacionalidad de un vistazo |
| Ficha de unidad / retrato | 200-400 px | Detalle y nación |
Tres niveles de detalle: **LOD0** cerca, **LOD1** medio, **LOD2** impostor (silueta de 6-12 triángulos o *billboard*).

## 2. Estilo (imprescindible)
- **Estilizado y pintado**, no fotorrealista: formas muy marcadas, proporciones algo exageradas en torretas, chimeneas y motores, paleta apagada del juego (grises navales, oliva, ocres), marcas nacionales **legibles de lejos**.
- **Zonas de color de nación**: separa `tint` (pintura principal: camuflaje base, franja del casco) de `fixed` (metal, madera, cristal, cubierta, goma, hélices). Banda nacional en el casco y **bandera/ensign** como textura (el juego ya genera la bandera de cada país con `flagSVG` y `b3FlagTex(tag)`).
- Variación por instancia: matiz de pintura ±8 %, suciedad/óxido, desfase de animación aleatorio.
- Iluminación: luz direccional cálida + hemisférica, `MeshLambertMaterial` / `MeshStandardMaterial` sencillo (sin PBR complejo ni sombras de alta resolución).

## 3. Catálogo (con variantes de época: **1 = 1914-1918**, **2 = 1936-1945**)
### Buques (los 12 que usa el juego, con sus nombres de clase)
Cada uno con **LOD0/1/2**, 2-3 **variantes nacionales** (casco, camuflaje, ensign) y daños visibles (humo, fuego, escora, partido en dos):
1. **Fragata de vela** (`sail`) y **fragata de vapor** (`steam`), 2. **Acorazado pre-dreadnought** (`ironclad`), 3. **Crucero** (`cruiser`) ligero y pesado, 4. **Submarino** (`sub`) con cubierta, torre y periscopio (surge/inmersión),
5. **Dreadnought** (`dread`) con 4-5 torres de 3-4 cañones, 6. **Acorazado rápido** (`bb`), 7. **Destructor** (`destroyer`) con torpederos, 8. **Portaaviones** (`carrier`) con cubierta de vuelo, ascensores e isla, 9. **Escoltas** (corbeta) y **transportes/mercantes** y **petrolero** para los convoyes, 10. **Lancha torpedera / PT**, 11. **Buque hospital** y **barcaza de desembarco**.
Elementos de cada buque: casco, superestructura, chimeneas, mástiles/radar, **torres de artillería giratorias con cañones que retroceden**, ametralladoras antiaéreas, lanzatorpedos, grúas, botes, **estela y espuma de proa**, banderas que ondean.

### Aeronaves (época 1914-1945)
1. **Caza biplano** (1914-1930) y **caza monoplano** (1936-1945) con hélice animada y 2-3 variantes nacionales, 2. **Bombardero ligero**, **bombardero medio bimotor**, **bombardero pesado cuatrimotor**, 3. **Bombardero en picado** y **torpedero embarcado**, 4. **Hidroavión de reconocimiento**, 5. **Avión de transporte / planeador** (paracaidistas), 6. **Caza a reacción temprano** (solo 1944-1945, como curiosidad opcional), 7. **Zepelín/dirigible** (solo 1914-1918), 8. **Aviones de portaaviones plegables**.
Elementos: fuselaje, alas, estabilizadores, hélices/motores animados (con borrosidad de giro), cabina, torretas, tren de aterrizaje que se pliega, **cocardas/insignias nacionales** y **bandas de identificación**, estelas de condensación y de humo, daño (ala rota, motor en llamas, humo negro, caída en espiral).

### Defensa y objetivos
1. **Baterías antiaéreas** (ametralladora cuádruple, 40 mm, 88/90 mm) con servidores y **explosiones de flak** (nubes de metralla en el cielo), 2. **Proyectores** (reflectores nocturnos), 3. **Globos de barrera**, 4. **Objetivos en tierra**: puente, fábrica, estación, puerto, aeródromo, refinería (versión intacta/dañada/destruida), 5. **Pistas** con hangares.

### Tropas modernas (soldados, vehículos y artillería)
Integra con el paquete existente `troops3d.js` (30+ tipos, épocas A-E): no repitas lo que ya existe (fusilero, ametrallador, camión, semioruga, tanque medio, cazacarros, cañón antitanque, obús). Añade lo que falta para el combate aéreo/naval: **paracaidista** (caída con paracaídas animado), **marinero de dotación** (artillero naval, vigía, marinero de cubierta), **piloto**, **personal de pista**, **infantería de desembarco** (saliendo de la barcaza), **antiaéreo a pie**, **tanque ligero**, **jeep**, **moto con sidecar** y **soldados hundiéndose / en el agua**.

## 4. Animaciones (nombre, duración, bucle y eventos)
Cada clip con **duración (s), bucle y eventos** (instante del disparo, impacto, retroceso, hélice, botadura…) para sincronizar humo, sonido y bajas.
- **Buques:** `navegar` (cabeceo y balanceo según el mar), `acelerar`/`frenar`, `girar`, `disparar_torre` (rotación + retroceso + fogonazo; eventos `disparo`, `retroceso`), `disparar_AA`, `lanzar_torpedos` (torpedo con estela), `recibir_impacto` (sacudida, fuego), `escorar`, `partirse`, `hundirse_proa`/`hundirse_popa` (con aire y espuma), `inmersión` y `emerger` (submarino), `lanzar_bengala`, `botar_chalupas`.
- **Aviones:** `rodar_pista`, `despegar`, `vuelo_nivelado`, `viraje` (alabeo), `picado`, `ascenso`, `barrena`, `ataque_en_picado`, `disparar_ametralladoras` (trazadoras), `disparar_torreta`, `soltar_bombas` (lluvia de bombas con caída), `lanzar_torpedo`, `lanzar_paracaidistas`, `recibir_impacto`, `humo_motor`, `incendio`, `caída_en_espiral`, `colisión`, `aterrizar`, `apontar` (portaaviones), `plegar_alas`.
- **Defensa:** `apuntar_AA`, `disparar_AA` (cadencia), `explosión_flak`, `reflector_barrido`.
- **Soldados:** `saltar_en_paracaídas`, `descender_en_paracaídas`, `aterrizar`, `nadar`, `ahogarse`, `subir_a_barcaza`, `desembarcar`, `saludar` y los clips ya existentes de `troops3d.js` (marcha, disparar, caer, etc.).
Todo **mezclable** (0,15-0,3 s) y con **desfase aleatorio por instancia**.

## 5. Requisitos técnicos (contrato con el juego)
- **three.js r152**, sin cargar modelos ni texturas externos. Todo en código o datos pequeños (base64/JSON). **Compatible sin WebGL2 especial.**
- **Presupuesto de triángulos (reporta los reales):** buque grande (dreadnought, portaaviones) LOD0 ≤ 1.600 / LOD1 ≤ 500 / LOD2 ≤ 12; destructor/crucero ≤ 900; submarino ≤ 500; mercante ≤ 600; caza ≤ 450 / LOD1 ≤ 150; bombardero cuatrimotor ≤ 900; torreta AA con servidores ≤ 500; soldado LOD0 ≤ 220.
- **Instanciación y animación barata:** propón y justifica la técnica (rig de partes con matrices por instancia, o animación en *shader*) para **hasta 24 buques y 80 aviones a la vez**, con prueba de rendimiento. Las hélices, torres y ruedas deben ser **partes con rotación propia**, no geometría extra.
- **API pública** (módulo `naves3d.js`, sin dependencias salvo `THREE`), alineada con `troops3d.js`:
  - `NAVE_KINDS` (lista de tipos con clase `naval|aereo|defensa|objetivo`) y `NAVE_ERAS = ['1','2']`.
  - `buildNave(kind, era, opts) → {tint, fixed, parts, clips, lod: [...]}`, `poseNave(kind, clip, phase, out)`, `blendPose(a, b, k)`.
  - `navePalette(nation, era) → {main, trim, mark, ensign}` y `naveGeoKey(kind, era, nation)` (países con la misma clave comparten lote).
  - `NaveBatch`/`NaveLodSet` con el mismo patrón que `TroopLodSet` (`begin()`, `add(dist, x, y, z, yaw, escala, tag, clip, opciones)`, `setClip`).
  - `clipPhase`, `eventsBetween(kind, clip, prevPhase, phase, cb)` para enlazar efectos.
  - **Mapeo con los tipos del juego** (`SHIP_TYPES`: `sail, steam, ironclad, cruiser, sub, dread, destroyer, carrier, bb`) y con los tipos aéreos de la mecánica de aviación (`fighters`, `bombers`, `military_aviation`).
- **Efectos listos para usar** (sin asignar memoria por fotograma): estela de proa/popa, espuma, humo de chimenea y de daño, fuego, **columnas de agua** de proyectiles, fogonazos, trazadoras, **explosiones de flak**, estelas de condensación, partículas de hundimiento. Propón un sistema de partículas compartido (`Points` con atlas) que se pueda alimentar desde los eventos de los clips.
- **Cielo y mar:** entrega también un **mar animado** barato (desplazamiento de vértices o *shader* con normales) con 3 estados (calma, marejada, tormenta), **cielo con gradiente** (amanecer, día, nublado, ocaso, noche) y **nubes** de baja geometría para el visor aéreo.

## 6. Los dos visores (demostración incluida)
Entrega **dos pequeñas escenas de demostración** (HTML con three.js desde cdnjs) que sirvan de referencia de integración:
1. **Visor naval:** dos líneas de buques (por clases y naciones) que navegan, se cañonean y se hunden, con la cámara orbital y botones para elegir **clima, hora, composición de las flotas, naciones y velocidad**; marcador de bajas.
2. **Visor aéreo:** una oleada de bombarderos con escolta contra un objetivo defendido por AA y cazas enemigos; combate (persecuciones, trazadoras, derribos, bombardeo del objetivo), cámara libre y de seguimiento; botones para **clima/hora**, **número de aparatos** y **modo cine**.
Ambas con **contador de triángulos, llamadas de dibujo y ms por fotograma**.

## 7. Entregables
1. **Hoja de estilo y *turnarounds*** (frente, perfil, planta, 3/4) de cada buque y aeronave por época y una por nación clave, con **callouts de zonas `tint`/`fixed`**, marcas nacionales y paleta numerada.
2. **`naves3d.js`** con la API anterior y el JSON de animaciones.
3. **Los dos visores de demostración** (naval y aéreo) como páginas independientes.
4. **Documento de integración** (1-2 páginas): cómo sustituir los buques procedurales de `naval3d.js` (visor naval 3D actual), cómo crear el visor aéreo con los mismos botones del visor naval, cómo enlazar los eventos (`disparo`, `impacto`, `hundimiento`) con las partículas del juego, cambiar de LOD por distancia, teñir por nación y respetar `R.lowEnd`.
5. **Tabla de naciones** (hex de pintura, camuflaje, bandera/ensign y marcas de aviones y buques) para: Reino Unido, Alemania, Francia, Italia, Estados Unidos, Japón, Unión Soviética, y variantes genéricas (se reutiliza tintando).
6. **Estadísticas** (triángulos reales, partes, clips, memoria y coste por fotograma).

## 8. Proceso
1. **Primer punto de control:** hoja de estilo con **8 unidades clave** (acorazado, destructor, submarino, portaaviones, caza monoplano, bombardero cuatrimotor, torreta antiaérea y paracaidista) en **Reino Unido, Alemania y Japón**, la propuesta de técnica de animación con prueba de rendimiento y la lista de clips. **Espera mi OK.**
2. **Segunda entrega:** catálogo completo, animaciones, `naves3d.js` y el visor naval.
3. **Tercera entrega:** visor aéreo, efectos, LODs, prueba de estrés y documento de integración.
En cada entrega indica **qué has comprobado** (capturas del visor, triángulos reales, tiempo por fotograma) y **qué no**.

## 9. Criterios de calidad
- A 60 px se distingue **clase de buque y de avión** por la silueta; a 12 px, **naval frente a aéreo** y **bando** por la marca.
- Los **cañones retroceden**, las hélices giran, las torres apuntan al blanco, y **hundirse o caer en espiral se lee** como tal.
- Con 24 buques y 80 aviones el coste de animación es **menor de 3 ms por fotograma** en un portátil de gama media, y sin asignaciones por fotograma.
- Las flotas **no parecen clones** (variación de pintura y desfase) y cada **nación se reconoce** sin leer el nombre.
