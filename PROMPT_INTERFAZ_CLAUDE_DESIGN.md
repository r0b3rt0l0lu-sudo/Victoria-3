# Prompt para Claude Design: rediseño visual de la interfaz de usuario de *Victoria* (gran estrategia 1836-1945)

**Rol y objetivo.** Eres director de arte de interfaces y diseñador UI para videojuegos de gran estrategia históricos (referencias: *Victoria 3*, *Hearts of Iron IV*, *Europa Universalis IV*, *Old World*, *Humankind*, *Total War: Three Kingdoms*). Rediseña la **interfaz de usuario completa** de mi juego web *Victoria* para que sea mucho más bonita, coherente, legible y «de producción»: una identidad visual propia (época victoriana → guerras mundiales, papel, latón, tinta, mapas de navegación), jerarquía clara, microinteracciones y estados pulidos. **No cambies el juego ni la lógica**: entrega un rediseño que pueda sustituir al CSS actual y a unas pocas plantillas HTML sin romper nada.

## 1. Qué es el juego y cómo está construido (importante)
- Juego de navegador **sin dependencias de red**: un único `index.html` generado por `build.py` a partir de `src/*.js` y `src/style.css`. Todo (fuentes, iconos, imágenes) debe ir **embebido o generado por código**; solo se admiten fuentes de sistema o fuentes en base64 pequeñas (<150 KB en total).
- La interfaz se pinta con **plantillas de cadenas HTML en JavaScript** (`WINDOWS.<id>.render()` devuelve HTML) sobre un `<canvas>` WebGL a pantalla completa (mapa 3D). El CSS es global (`src/style.css`, ~900 líneas) y usa variables (`--head`, `--gold`, etc.).
- Todo el texto está en **español**. Hay tamaño de interfaz ajustable (escala 80-140 %), modo móvil/táctil (`movil.js`), modo de bajo rendimiento y tutorial. Debe funcionar desde 1280×720 hasta 4K y también en móvil (apaisado).
- Las clases y los atributos `data-act`, `data-id`, `data-tip`, `id="..."` **no se pueden renombrar** (la lógica los usa). Puedes **añadir** clases, envoltorios y variables CSS, y puedes proponer cambios mínimos de plantilla.

## 2. Inventario de pantallas y componentes a rediseñar
**Marco permanente sobre el mapa**
1. **Barra superior izquierda** (`#topbar`/ficha del país): bandera, nombre, forma de gobierno, rango; recursos con icono (tesoro, balanza, prestigio, influencia, innovación, estabilidad, población, ejército, correo…).
2. **Control de tiempo** (arriba al centro): fecha, play/pausa, 5 velocidades, notificaciones, buscador, guardar, menú.
3. **Barra inferior de menús** (`#menu .mbtn`): ~12 botones con icono y etiqueta (Finanzas, Economía, Población, Política, Tecnología, Diplomacia, Ejército, Construcción, Diario, Nacional, Industria, Comercio…) con estado activo, insignias de aviso y atajos de teclado.
4. **Modos de mapa** (abajo derecha, `#modes .mode`): Político, Terreno, Población, Nivel de vida, Alfabetización, Prosperidad, Malestar, Relaciones, Bloques, **Marítimo**, **Aéreo** (iconos emoji hoy).
5. **Controles de cámara** (zoom, casa, rotar), **minimapa** y leyenda del modo.
6. **Fichas sobre el mapa**: ejércitos (`.atoken`), flotas (`.ntoken`), escuadrones, convoyes, marcadores y rótulos de países/mares (tipografía sobre mapa con halo).
7. **Notificaciones/toasts** (`#toasts .toast`), **tooltips** enriquecidos (`data-tip` con HTML) y **overlay modal** (`#ov3`: eventos, resúmenes de guerra, campañas, cambio de turno).

**Ventanas de gestión** (`#windows`, estructura común: cabecera con icono+título+subtítulo+cerrar, pestañas, cuerpo con columnas `.cols > .col`, tarjetas `.card`, filas clave-valor `.kv`, tablas `.tbl`, barras `.bar`, botones `.btnrow`, `select`, pestañas internas)
Presupuesto, Producción y mercado, Población, Política y leyes, Tecnología (**árbol** con nodos y flechas), Diplomacia (ranking, pactos, bloques, crisis), Ejército y guerra (pestañas Marina, Aviación, Doctrinas, Plantillas, Producción, Mariscales…), Construcción, Diario y ambición nacional, Árbol nacional de decisiones, Logros, Industria, **Comercio exterior**, Manual.

**Paneles laterales y de combate**
- Panel de estado/provincia (`#statepanel`), panel de ejército (`renderArmyPanel`), paneles del **mapa marítimo** (`#seapanel`) y **mapa aéreo** (`#airmappanel`).
- **Visor de batalla terrestre 2D** (`#battlepanel`: mapa táctico por bloques, barras de moral, estrategias, órdenes), **visor naval 2D/3D** (`#navalpanel`), visor 3D de soldados, HUD de la vista en primera persona.
- Pantalla de **inicio** (selección de país y escenario, tarjetas `.st-card`, partidas guardadas), **campañas**, **hot-seat**, resúmenes de guerra, **tutorial** y asesor «¿Qué hago ahora?».

## 3. Dirección artística
- **Concepto:** «sala de mapas del Almirantazgo»: pergamino/papel envejecido y paneles de roble oscuro con **latón envejecido** y **tinta azul marina**; sensación de documentos oficiales, sellos de lacre, cintas y membretes. Debe leerse como estrategia seria, no como app de oficina ni como fantasía.
- **Tema oscuro principal** (paneles azul pizarra/azul noche sobre el mapa luminoso) + **tema claro «pergamino»** opcional conmutable con una variable (`data-theme`). Ambos con contraste AA mínimo.
- **Paleta cerrada** (propón 12-16 tokens CSS): fondos de panel (3 niveles), tinta, dorado/latón (acento primario), rojo carmín (peligro/guerra), verde bosque (positivo), azul acero (naval/info), ámbar (aviso), violeta discreto (diplomacia). Define los **colores semánticos** (bueno/malo/neutro) y de **estrato social** y de **categoría de bien**.
- **Tipografía:** titulares serif con carácter histórico (tipo *Cinzel/Spectral SC*) y cuerpo sans humanista legible a 12-14 px; **números tabulares**; escala tipográfica de 6 niveles; versalitas para etiquetas. Si no hay fuente embebida, define pilas de sistema que se parezcan (Georgia/Palatino + Segoe UI/Inter).
- **Materiales:** bordes biselados finos, esquinas con remaches o cantoneras discretas, sombras en capas, textura de papel/grano **generada con CSS/SVG inline** (sin imágenes externas), brillo suave en botones primarios, marcos ornamentales para eventos importantes y cabeceras de ventana.
- **Iconografía:** sustituye los emojis por un **juego coherente de iconos SVG inline** (trazo 1.5 px, estilo grabado/sello, 24×24 y 16×16): recursos, menús, modos de mapa, misiones navales/aéreas, tipos de buque y avión, pactos, leyes. Entrega un **sprite `<symbol>`** y el mapa emoji → icono para sustituirlos con un reemplazo mínimo. Las banderas se siguen generando por código.
- **Densidad:** pensado para ventanas con mucha información. Tres densidades (cómoda/normal/compacta) mediante una variable de escala.

## 3b. Paleta de partida (obligatoria como base; puedes afinar ±8 % de luminosidad)
| Token | Color | Uso |
|---|---|---|
| `--tinta-900` | `#0b121a` | fondo más profundo, sombras |
| `--pizarra-800` | `#111c28` | fondo de ventana |
| `--pizarra-700` | `#18283a` | tarjetas, paneles |
| `--pizarra-600` | `#223850` | tarjeta elevada, hover |
| `--roble-700` | `#3a2a1c` | marcos de madera, cabeceras de ventana |
| `--roble-500` | `#5c4129` | biseles, cantoneras |
| `--laton-500` | `#b8903e` | acento primario, bordes ornamentales |
| `--laton-300` | `#e0c27a` | títulos, iconos activos, brillo |
| `--pergamino-100` | `#efe3c6` | texto principal en oscuro / fondo del tema claro |
| `--pergamino-300` | `#cdbd96` | texto secundario |
| `--carmin-600` | `#a8342f` | guerra, peligro, malo |
| `--bosque-600` | `#3f7a4a` | positivo, completado |
| `--acero-500` | `#4f86b0` | naval, información, enlaces |
| `--ambar-500` | `#d98a2b` | avisos |
| `--violeta-500` | `#7a5a9a` | diplomacia |
| `--lacre-700` | `#7d1f24` | sellos de lacre, insignias importantes |

## 3c. Que no parezca hecha por una IA: oficio de artista profesional
El resultado debe sentirse **dibujado y compuesto a mano por un ilustrador/diseñador de videojuegos**, no generado:
- **Nada de plantilla genérica:** prohibidos los degradados morados, las tarjetas planas con esquinas muy redondeadas y sombra difusa, los iconos emoji, los botones «píldora» iguales y el aspecto de panel de administración web. Cada tipo de elemento tiene su propia forma y su propio material.
- **Menús detallados y adornados:** cabeceras de ventana con **cenefas y filigranas**, cantoneras de latón en las esquinas, remaches, marcos dobles (filete fino + filete grueso), cintas con el título, **sellos de lacre** para logros y eventos, orlas en los separadores, iniciales capitulares en los textos largos del manual y del diario, y marcos distintos según la categoría (economía en roble y latón, militar en acero y carmín, diplomacia en violeta y pergamino, naval en azul tinta y latón).
- **Imperfección controlada:** bordes con ligera irregularidad, grano de papel y tinta, desgaste en esquinas, sombras proyectadas coherentes con **una sola fuente de luz arriba a la izquierda**, brillos metálicos solo en los filos.
- **Jerarquía de grabado:** títulos en versalitas con interletraje amplio y un fino subrayado ornamental; números grandes con estilo de cifras de reloj o de libro de contabilidad; etiquetas pequeñas en versalitas.
- **Iconos grabados:** cada icono es un pequeño grabado de acero (trazo variable, sombreado por líneas cruzadas, 1-2 detalles característicos), no un pictograma genérico. Misma familia para todos.
- **Detalle en el hover y el uso:** el botón se hunde, el latón brilla, la tinta «se seca» al completar una tarea, las pestañas son lengüetas de carpeta, las ventanas «se despliegan» como un documento; sonidos visuales (destello de sello) sin exagerar.
- **Coherencia total:** un mismo lenguaje de marcos, esquinas y tipografías en HUD, ventanas, tooltips, eventos, pantalla de inicio y visores de batalla. Revisa cada pantalla como lo haría un director de arte: alineaciones a una rejilla de 4 px, márgenes y espaciados rítmicos, nada pegado a los bordes.
- **Nada de texto de relleno ni Lorem ipsum:** usa los textos reales del juego en español.

## 4. Componentes y estados (entrega un «libro de estilo» vivo)
Botones (primario, secundario, peligro, fantasma, icono, interruptor, con insignia), `select` e inputs, casillas y radios, deslizadores, pestañas (principales y secundarias), tarjetas (normal, resaltada, bloqueada, completada), tablas ordenables, filas `.kv`, barras de progreso (normal, doble, con umbral, con tendencia), medidores (moral, supremacía, dominio aéreo), chips/etiquetas, insignias numéricas, listas con selección múltiple, árbol de tecnología (nodo disponible/en curso/completado/bloqueado/obsoleto + flechas), tarjetas de evento con ilustración tipográfica, diálogos modales, toasts por tipo (guerra, crisis, diario, diplomacia), tooltips con secciones, menús contextuales, estados `hover/focus/active/disabled/loading`, foco de teclado visible, estados vacíos, esqueletos de carga y **animaciones** (entrada de ventana, pulso de aviso, sello al completar, contador de recursos) de 120-250 ms, respetando `prefers-reduced-motion`.

## 5. Contrato técnico (importante)
1. **Entrega** un `style.css` completo que reemplace al actual, organizado en capas: `tokens` → `base` → `componentes` → `ventanas` → `mapa/HUD` → `combate` → `utilidades` → `responsive`. Comentarios en español.
2. **Compatibilidad:** debe cubrir **todas** las clases y ids existentes (lista adjunta en `referencia/clases_css.txt`; genera tú la lista con `grep -o 'class="[^"]*"' src/*.js | sort -u`). Lo que no restyles debe seguir viéndose bien.
3. **Rendimiento:** sin `backdrop-filter` en elementos que se animan sobre el mapa, sin sombras enormes en cientos de fichas, `will-change` solo donde haga falta. El HUD debe costar <1 ms por fotograma. Modo `R.lowEnd`: variable `--fx:0` que apaga blur, sombras y animaciones.
4. **Escala y móvil:** todo en `rem`/`em` con la variable `--ui-scale`; objetivos táctiles ≥44 px en móvil; barra inferior que se convierte en menú desplazable; ventanas a pantalla completa en <900 px.
5. **Accesibilidad:** contraste AA, foco visible, roles/ARIA en pestañas y diálogos (indica los cambios mínimos de plantilla), no depender solo del color (iconos o formas para bueno/malo), tamaño de texto escalable, daltonismo: paleta alternativa por variable.
6. **Sin dependencias:** nada de frameworks ni CDN. SVG y CSS puros; JS solo para el conmutador de tema/densidad (≤40 líneas).
7. **Zonas calientes que no deben taparse:** el mapa debe verse. Los paneles flotantes (`#seapanel`, `#airmappanel`, `#statepanel`) llevan ancho máximo 330-360 px y no cubren la barra superior ni la inferior; las fichas del mapa mantienen su tamaño actual (≈54×22 px).

## 6. Entregables
1. `style.css` nuevo + `iconos.svg` (sprite) + `tokens.css` (solo variables, para poder retocar la paleta).
2. **Libro de estilo** `libro_estilo.html` autónomo: todos los componentes y estados en tema oscuro y claro, en las tres densidades.
3. **Maquetas navegables** (HTML autónomo, datos de ejemplo del juego, en español) de: marco del mapa con HUD y fichas, ventana de Presupuesto, Producción y mercado, Política y leyes, Tecnología (árbol), Diplomacia, Ejército (pestaña Marina), Comercio exterior, panel de modo marítimo, visor de batalla, evento modal, pantalla de inicio y versión móvil.
4. **Capturas** de cada maqueta en 1280×720, 1920×1080 y 390×844.
5. `INTEGRACION_INTERFAZ.md`: qué ficheros sustituir, el mapa emoji→icono, cambios mínimos de plantilla (con diff), orden de carga en `build.py`, cómo activar tema/densidad, y una **lista de riesgos** (qué ventanas pueden descuadrarse y por qué).
6. **Informe de contraste y rendimiento** (ratios AA de los pares texto/fondo, coste de estilos en una ventana con 200 filas).

## 7. Criterios de aceptación
- A primera vista el juego parece un producto comercial con identidad propia, no una web genérica.
- Cualquier ventana se entiende en 3 segundos: título, jerarquía de tarjetas, números alineados, acciones principales destacadas.
- Cero solapamientos de texto con el tamaño de interfaz entre 80 % y 140 %.
- Los dos temas y las tres densidades funcionan en todas las ventanas.
- El mapa sigue siendo el protagonista: paneles translúcidos pero legibles, sin tapar los controles de tiempo ni el minimapa.
- Se puede aplicar sustituyendo `style.css` y el sprite, sin tocar la lógica del juego.
