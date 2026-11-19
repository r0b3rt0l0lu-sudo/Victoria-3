# Prompt para Claude Design: control del soldado en primera persona (modelos de brazos y armas, animaciones de combate individual, reacciones y efectos)

**Rol y objetivo.** Eres un artista técnico y animador de personajes para videojuegos de estrategia histórica con modo de combate en primera persona (referencias: *Hell Let Loose*, *Verdun*, *Call to Arms*, *Company of Heroes* en estilo estilizado). Amplía el paquete de tropas 3D de mi juego *Victoria* (web, three.js r152, **sin modelos ni texturas externos**, todo generado por código) para que el jugador pueda **manejar a un soldado de infantería en primera y tercera persona** dentro de una batalla 3D, y para que **el resto de soldados que lo rodean parezcan individuos con vida propia**. Reutiliza el contrato técnico de `troops3d.js` v4 (`TroopShared`, `TroopLodSet`, `TroopBatch`, `CpuBatch`, `troopGroup`, `troopGeoKey`, `clipInfo`; clips horneados a 30 fps; eras A 1836-1855, B 1856-1880, C 1881-1913, D 1914-1936, E 1937-1945) y entrega el mismo formato de paquete (`src/*.js`, `build.sh`, `INTEGRACION_*.md`, hojas de capturas, pruebas, informe de rendimiento).

## 1. Qué ocurre hoy y qué falta (importante)
- El soldado controlado es una figura normal del `TroopLodSet` (LOD0) con el reloj de animación del juego. La cámara de primera persona está en su cabeza, **pero no se ven sus brazos ni su fusil** (quedan fuera del campo de visión): hace falta un **viewmodel** (modelo de brazos y arma pensado para la cámara en primera persona).
- Los clips existentes cubren `idle`, `marcha`, `marcha_rapida`, `apuntar`, `disparar_A|B|D`, `recargar_A`, `disparar_rodilla_A`, `agacharse`, `herido`, `caer_muerto_atras|adelante|costado|rodillas`, `cargar_bayoneta`, `melee_1|2`, `huir`, `rendirse`, etc. **No hay** mezcla de puntería (apuntar arriba/abajo/izquierda/derecha), ni cambios de postura fluidos, ni reacciones por zona, ni recarga por época, ni comportamientos individuales de los soldados que rodean al jugador.
- Los soldados ya se mueven con «libertad» cerca de la cámara (pasos, deambular, encarar al jugador, apuntar y disparar cada 5-8 s). Hoy se resuelve **reutilizando** `marcha`, `idle`, `apuntar` y `disparar_*`: queda rígido y repetitivo.

## 2. Entregables

### 2.1 Viewmodel en primera persona (modelos)
Un grupo `THREE.Group` o `SkinnedMesh` **independiente de los instanciados** (una sola copia, se dibuja pegada a la cámara en un segundo pase, con `near` 0,05 y sin recortes), con **brazos + manos + arma + parte del torso/mochila visible**, por **época y por nación** (reutiliza paletas y uniformes de `b_uni.js`: manga y puño del uniforme, guantes si procede).
| Época | Arma del viewmodel |
|---|---|
| A | fusil de chispa o percusión con bayoneta (mosquete) |
| B | fusil de percusión rayado (Minié/Enfield/Dreyse) con bayoneta |
| C | fusil de cerrojo (Mauser 71/84, Lebel, Mosin, Springfield 1873) |
| D | fusil de cerrojo de 1914 (Gewehr 98, SMLE, Lebel, Mosin, Springfield 1903) y pistola de oficial |
| E | K98k, SMLE, Mosin-Nagant, M1 Garand; subfusil (MP40, Sten, PPSh) y fusil semiautomático; nación → uniforme y correaje |
Presupuesto: **6.000-12.000 triángulos** por viewmodel y época, un solo material con paleta por nación, normales suaves, cargador visible que se mueve (cerrojo, martillo, pedernal, portacargador).

### 2.2 Clips del viewmodel (brazos y arma)
Todos con eventos en el fotograma exacto (`evento: 'fuego'`, `'cerrojo'`, `'carga'`, `'bayoneta'`, `'golpe'`), 30 fps y duración definida:
`idle_vm` (respiración, balanceo), `marcha_vm`, `carrera_vm` (con arma baja o a la cadera), `apuntar_vm` (entrada, hold, salida), `ads_vm` (apuntar a través del alza o el punto de mira, con zoom), `disparar_vm` (retroceso, humo, patada del arma, mano al cerrojo), **`recargar_vm` específico por época** (A/B: morder cartucho, cargar por la boca, baqueta, cebar, armar; C/D: cerrojo, cargador de 5, empujar; E: Garand con clip y «ping», K98 con peine, subfusil con cargador), `cerrojo_vm`, `agacharse_vm`, `rodilla_vm`, `tumbado_vm`, `golpe_culata_vm`, `bayoneta_vm` (estocada), `lanzar_granada_vm` (eras D y E), `curar_vm` (vendaje), `herido_vm` (se agarra el brazo o el pecho, la visión baja), `muerte_vm` (suelta el arma y cae el punto de vista), `inspeccionar_vm`, `salto_obstaculo_vm`.
Además: **mezcla de puntería** (`apuntar` con offsets aditivos de ±35° en yaw y ±45° en pitch) para que el arma y los brazos sigan a la cámara sin recortar el clip.

### 2.3 Cuerpo completo del soldado (tercera persona y enemigos)
Para el soldado ya existente (instanciado, `TroopLodSet`):
- **Mezcla de puntería** (aim offset): clips aditivos `aim_yaw_-35|0|+35` y `aim_pitch_-45|0|+45` sobre `apuntar` y `disparar_*`, de modo que un soldado enemigo pueda **apuntar de verdad a un punto** (el jugador) sin girar el cuerpo entero. Expón `troopAimClip(kind, era, yaw, pitch)` o equivalente.
- **Transiciones de postura:** de pie ↔ rodilla ↔ tumbado (`a_rodilla`, `de_rodilla`, `a_tumbado`, `de_tumbado`), con `idle`, `apuntar`, `recargar` y `disparar` en cada postura, y **reptar** (`reptar`, `reptar_rapido`).
- **Movimiento táctico individual:** avance a saltos, paso lateral izquierdo y derecho, paso atrás, giro en el sitio de 45° / 90° / 180° (con pasos), correr agachado, correr a cubierto, `ponerse_a_cubierto` y `asomarse` (ya existen) con transiciones suaves, vigilar con el fusil, agacharse al oír un disparo, mirar a su alrededor, saludar, hacer una señal, hablar con el vecino, fumar, beber de la cantimplora, atarse la bota (clips de «tiempo muerto» para que los soldados no sean un coro de `idle` iguales).
- **Recargas por época y postura** (ver 2.2), con el arma visible y los eventos de carga.
- **Disparos de enemigos al jugador:** clip `apuntar_y_disparar` encadenado, con retroceso, y **variantes** (a la cadera, apoyado en un árbol o muro, desde rodilla, desde tumbado).
- **Granada** (eras D y E) y **bayoneta** en defensa y ataque (estocada baja, estocada alta, golpe de culata) con eventos.
- **Rendición** (`rendirse` con manos arriba, de rodillas), **retirada** (`huir`, ya existe), `camilla_*` y `herido_arrastrandose`.

### 2.4 Reacciones por impacto y muertes individuales (el jugador acierta a un soldado)
Un clip distinto por **zona y dirección** del impacto, con el impulso correcto:
`impacto_cabeza_frente`, `impacto_cabeza_atras`, `impacto_pecho_frente|atras|izq|der`, `impacto_vientre`, `impacto_brazo_izq|der`, `impacto_pierna_izq|der` (cae de rodillas o cojea), `herido_grave` (se agarra la herida, se arrastra), `herido_leve`.
Muertes con **variantes y física plausible** (no un solo clip por tipo): hacia atrás (de pie, de rodilla, tumbado), hacia delante, de costado, desplomándose de rodillas, arrodillado hacia delante, apoyado en un muro, con el arma cayendo y rebotando; que el cuerpo termine **en reposo** (una pose final estable que se mantiene indefinidamente) y con mínimo deslizamiento de pies.
Dejar un **cadáver estable** (`cuerpo_inerte_*`) para dibujar cientos de cuerpos con coste casi nulo (modelo estático o clip de un solo fotograma, `TroopBatch` sin animación).

### 2.5 Efectos visuales (estilizados, baratos)
Con el mismo enfoque de partículas del juego (puntos con textura suave, `b3Push`):
- **Fogonazo y humo de pólvora** diferenciados por época (humo denso blanco en A-C, sin humo en D-E salvo bruma), con posición ligada al hueso del cañón.
- **Casquillo expulsado** (D y E) y **taco o cartucho** (A-B).
- **Trazadora** con estela corta (eras D-E) y **impacto en el suelo / en un árbol / en un muro / en un soldado** (tierra, astillas, polvo, salpicadura estilizada, nunca gore realista).
- **Efectos de herido en la cámara** del viewmodel: viñeta roja, desenfoque, pitido (solo los parámetros y las curvas, el juego los dibuja).

## 3. Contrato técnico (importante)
- **API sin cambios:** todo lo que ya existe sigue funcionando. Los clips nuevos usan nombres en español, minúsculas con guion bajo; los eventos van en `clipInfo(kind, era, clip).events`.
- **Rendimiento:** las figuras instanciadas no deben crecer más de **+15 %** de triángulos; el viewmodel es una sola copia (hasta 12.000 triángulos). La textura de huesos no debe pasar de **~12 MB** en total (hoy 9,5 MB).
- **Tamaño del paquete:** las animaciones nuevas no deben añadir más de **+400 KB** al `troops3d.js` (hoy ≈ 290 KB).
- **Compatibilidad:** `R.lowEnd` debe seguir sirviendo una versión reducida (sin mezcla de puntería ni variantes) y el modo CPU de respaldo (`CpuBatch`) debe aceptar los clips nuevos.
- **Calidad de animación:** interpolación cúbica monótona (como v4); las poses finales de recarga, apuntar y muerte son estables; el pie de apoyo no atraviesa el suelo; sin deslizamientos visibles.
- **Sin dependencias externas ni red en ejecución.** Datos de armas (calibre, cadencia, tiempo de recarga por época) en una tabla `TROOP_ARMS` para que el juego los consulte (por ejemplo A: 3,2 s, B: 2,6 s, C: 2,0 s, D: 1,6 s, E: 1,0 s para el fusil de cerrojo o semiautomático).

## 4. Verificación que debes entregar
1. **Visor del viewmodel** (`visor_vm.html`): ver cada arma y cada época en primera persona, reproducir cada clip con sus eventos, alternar naciones, cambiar la mezcla de puntería con dos deslizadores y simular una cámara con balanceo.
2. **Hojas de capturas** (3 niveles de zoom): viewmodels por época, tiras de animación (apuntar, disparar, recargar por época, bayoneta, granada), reacciones por zona, muertes (todas las variantes) y movimiento táctico.
3. **Pruebas automáticas** (`pruebas/*.js`): 0 normales invertidas; todos los clips con la duración y los eventos declarados; la pose final de cada muerte estable; sin saltos de hueso entre transiciones; tiempos de horneado y tamaño de la textura de huesos.
4. **Informe de rendimiento** (como el de v4): 20.000 soldados con LOD automático antes y después, viewmodel solo, y 2.000 soldados con mezcla de puntería activa.
5. **Lista de limitaciones honesta:** qué armas o naciones son aproximadas, qué recargas no están hechas y por qué, qué clips usan interpolación de respaldo.

## 5. Criterios de aceptación
- Con la cámara en primera persona **se ven los brazos y el fusil** con balanceo, retroceso al disparar y una recarga distinta por época, y el arma sigue a la mira sin recortarse.
- Un soldado enemigo que apunta al jugador **gira solo el torso y los brazos** hacia él, dispara y recarga con la animación de su postura (de pie, de rodilla o tumbado).
- Al acertar a un soldado, **reacciona según la zona y la dirección del tiro** y cae con una de varias muertes, quedando en una pose estable.
- Las tropas que rodean al jugador **no repiten la misma animación al mismo tiempo**: hay variedad de tiempos muertos, pasos laterales y atrás, giros y comportamientos tácticos.
- El conjunto sigue siendo fluido con 20.000 soldados y el viewmodel activo en la calidad media.
