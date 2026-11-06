# Prompt para Claude Design: mapas de batalla detallados

**Rol y objetivo.** Eres un ilustrador cartográfico de videojuegos de estrategia histórica. Diseña un **conjunto de mapas de campo de batalla** (vista cenital, 2:1) para un juego de gran estrategia del siglo XIX (1836-1914). Los mapas son el fondo sobre el que se mueven pequeñas unidades (bloques de ~1,3 % del ancho del mapa) y deben **leerse de un vistazo**: el jugador necesita ver alturas, ríos, bosques, aldeas y barrancos para decidir dónde colocar baterías, tender puentes y mantener la línea.

**Estilo de referencia (imprescindible).** Mapa **pintado** al estilo de los mapas animados de campañas napoleónicas:
- Base verde oliva-lima (≈ #6C8C2A) con grandes manchas más claras (#8EAA3C) y más oscuras (#4E6820) y un **mosaico de parcelas en rombos** apenas visible.
- **Alturas pintadas de color**: crestas y mesetas en pardo-ocre (#7C642C → #B09246) con pinceladas, luz desde el noroeste y sombra al sureste. Nada de curvas de nivel finas: el relieve se entiende por el color y el sombreado.
- **Ríos finísimos** (1-2 % del ancho como mucho) en cian claro (#68B0D0) con filete oscuro, serpenteantes; solo un río mayor puede ser ancho, con islas.
- **Bosques** como manchas densas de verde casi negro (#244A1A) con grano de copas; arboledas pequeñas junto a las aldeas.
- **Aldeas** como racimos de casitas pardo oscuro (#58341E) con alguna iglesia, **con su nombre** en rótulo serif (tipo Georgia/Cinzel) blanco crema con halo oscuro.
- **Caminos** finos y tenues pardo-tostado; muros y setos grises muy finos.
- Suave **desenfoque pictórico** del terreno (pincelada), viñeta ligera, sin bordes duros; solo los rótulos son nítidos.
- Sin unidades dibujadas ni interfaz.

**Contenido de cada mapa.**
1. Una **cresta o loma dominante** (los altos) que permita colocar baterías, con vistas hacia el frente.
2. Un **río fino** con 2-3 vados o puentes y tramos sin cruce (aquí se tenderán pontones).
3. Opcional: un **barranco** estrecho e infranqueable con 1-2 pasos de piedra.
4. 3-6 **aldeas** repartidas (objetivos del combate), una mayor con iglesia, unidas por caminos.
5. Bosques que **bloquean la línea de visión**, huertos, campos y muros que den cobertura ligera.
6. Un **corredor despejado** central de ~500-700 px (a escala 1920×840) para el choque de las líneas.
7. Rótulos: nombres de aldeas y del río (cursiva, siguiendo el cauce).

**Variantes por bioma** (un mapa por cada uno, mismo lenguaje visual):
| Bioma | Base | Alturas | Bosque | Agua | Rasgos propios |
|---|---|---|---|---|---|
| Templado | oliva #6C8C2A | ocre | verde oscuro | cian | parcelas, setos |
| Bosque húmedo | #78A028 → #54783C | pardo | verde-negro denso | cian | claros, sombra |
| Desierto | arena #D0B270 | ocre rojizo | palmeras sueltas | turquesa | dunas, rocas, oasis |
| Estepa | #96A046 | ocre dorado | arbustos | cian | hierba alta, pocos árboles |
| Tundra/pantano | #78886C | pardo-gris | verde frío | azul grisáceo | turberas, lagunas |
| Jungla | #2E6E2C | verde-pardo | muy denso | verdoso | ríos tortuosos, claros |
| Montaña | #6C783E | pardo-gris con roca | pinos | cian | crestas, acantilados, nieve en cumbres |
| Nieve | #D6E0E8 | gris azulado | verde frío | azul hielo | ventisqueros, ríos helados |
Añade versiones de **estación** (otoño: copas ocre y rojizas; invierno: escarcha) y **hora** (amanecer cálido, mediodía neutro, atardecer anaranjado).

**Entrega.**
- Exporta cada mapa en **PNG 3840×1680** (2× de 1920×840), sin rótulos y **otra copia con rótulos**; más una capa de **máscara de altura** en escala de grises (blanco = cota alta) del mismo tamaño para el cálculo de pendientes.
- Un **kit de elementos** en PNG transparente: casitas (3 variantes), iglesia, copa de árbol (4), roca, puente de piedra, puente de madera, pontón, barranco (tramo), muro.
- Una **paleta** en JSON (hex) por bioma y la lista de fuentes usadas.
- 3 variantes de composición por bioma (cresta a la izquierda, a la derecha, central).

**Criterios de calidad.** Legibilidad en pantalla pequeña (la unidad más pequeña debe distinguirse del fondo), contraste suficiente para bloques azules y rojos sobre cada bioma, coherencia entre biomas, sin elementos que parezcan unidades o rótulos de interfaz, y sensación de mapa pintado antiguo y no de renderizado 3D.
