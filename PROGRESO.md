# PROGRESO — Gran estrategia estilo Victoria 3 + HoI

## Parte 1 — Sistema militar básico (HECHO)
- **Divisiones** (infantería, caballería, artillería) de 8.000 hombres; se reclutan en estados con Cuarteles
  (coste en dinero + campesinos del estado, instrucción de 14–25 días). Límite = soldados ÷ 8.000.
- **Ejércitos** (hasta 12 divisiones) con **general aleatorio** (ataque/defensa/logística, nivel y experiencia),
  dibujados como fichas con bandera en el mapa; panel de ejército (detener, ir a la capital, dividir, fusionar, disolver).
- **Movimiento por estados**: clic en el ejército + clic derecho en un estado; ruta Dijkstra sobre el grafo de vecinos
  (tiempo según terreno y velocidad), líneas de órdenes punteadas.
- **Batallas automáticas** de varios días (fuerza, organización, terreno, general, azar); retirada al perder la organización;
  bajas que restan población campesina.
- **Ocupación real**: estado enemigo sin defensores ocupado 10 días → ocupado (franjas y línea de frente).
- **Puntuación de guerra** calculada con estados ocupados + batallas ganadas (sustituye a la comparación abstracta de potencias).
- **IA básica**: recluta en guerra, defiende la capital, ataca el estado enemigo más débil de su frontera.
- **Ventana «Ejército y guerra»**: Ejércitos, Reclutamiento, Guerras (con batallas) y Fuerzas armadas.
- Guardado/carga con ejércitos, batallas y reclutas; manual y README actualizados.

## Parte 2 — PENDIENTE
- Provincias (dividir los estados en unidades menores para el movimiento y la ocupación).
- Suministro y logística (líneas de suministro, desgaste fuera de territorio propio).
- Aviación y marina (flotas, bloqueos, transporte).
- Producción de equipamiento (fusiles, cañones, etc.) y su efecto en las divisiones.
- Frentes dibujados con flechas y asignación de ejércitos a frentes.
- Doctrinas y árbol nacional.
- Equilibrado: la frecuencia de batallas de la IA entre países es baja (≈ 0,5 batallas/año en simulación).

## Compilación
`python3 build.py` → `index.html` (autónomo). `python3 build.py --light` → `juego-ligero.html` (three.js por CDN, necesita Internet).

## Parte 2 — avance (sesión actual)
- HECHO: **provincias** (≈830, 2–9 por estado; `src/provinces.js`), ejércitos y batallas por provincia, ocupación por provincia
  (5 días), línea de frente dibujada entre provincias ocupadas y libres, A* sobre provincias, atrincheramiento, muerte de generales,
  experiencia militar y cansancio de guerra (datos), guardado v2.
- HECHO: **iconos SVG** (`src/icons.js`) en HUD, menú, cámara, modos de mapa y ventanas + pulido visual general (CSS).
- PENDIENTE: suministro, producción de equipo, doctrinas, aviación, marina, frentes/planes, árbol nacional, ventanas nuevas.

## Cambios de la última sesión
- Movimiento: modo «🎯 Mover» (clic izquierdo), Mayús+clic, grupos con Ctrl/Mayús+clic en fichas, **persecución** de ejércitos enemigos
  (clic derecho sobre ellos o botón), fichas con desplazamiento suave y rutas enemigas en rojo. Velocidad idéntica para todos los países.
- Reclutamiento por **movilización** (0 / 1 / 2,5 / 5 / 10 % de la población) con coste económico, malestar y mantenimiento semanal de divisiones.
- **Panel de batalla en tiempo real** (clic en ⚔ del mapa o «Ver batalla») + historial de batallas.
- **Propaganda por estrato** (clases altas/medias/bajas), carísima.
- **Equilibrado** (simulaciones de 20 años, 3 dificultades): población ya no se desploma (hambre exagerada: umbral 0,85→0,7 y hambrunas locales
  más raras), huelgas a la mitad, crecimiento base 0,95 %/año, IA sin inflar ejércitos (tope en paz, desmovilización, mantenimiento).
  Resultado: pob. +14 % en 20 años, NdV 7→12, ~1 guerra/año y ~55 batallas/año.

## Sesión: frentes, órdenes HoI4, generales, entrenamiento y batalla táctica
- Frentes: dibujar línea sobre la frontera (clic en provincias o línea automática), planes de defensa/ataque con flechas, activar/pausar,
  preparación (+15 %), ejecutar ataque, avance de la línea (`src/military.js` frontsDay, `src/ui_mil.js`).
- Órdenes: marcha forzada, ferrocarril, patrulla, mantener posición, atrincherar, retirada, puntos de ruta, juntar/fusionar, grupos.
- Generales con 10 rasgos que bufean, reserva de generales, reclutar y asignar; muerte de generales.
- Entrenamiento (recluta→élite, ×0,75–×1,25), entrenar en casa, IA entrena en paz.
- Batalla: minimapa táctico con divisiones y frente que avanza + sucesos (cañoneo, carga de caballería, carga desesperada, flanqueo, pánico, lluvia).
- Sigue PENDIENTE de la Parte 2: suministro/cercos, producción de equipo, doctrinas, aviación, marina, árbol nacional.

## Sesión: suministro, árbol nacional, crisis diplomáticas, cansancio, política y gráficos
- HECHO: suministro y cercos (`src/logistics.js`), cansancio de guerra y capitulación, crisis diplomáticas (`src/dcrisis.js`),
  elecciones y 7 movimientos políticos (`src/politics2.js`), árbol nacional para 8 países + genérico (`src/national.js`),
  gráficos: ríos, agua animada, nubes, ciudades 3D, niebla, viñeta, grano de terreno (botón ≈ para desactivar animaciones).
- PENDIENTE Parte 2: producción de equipo, doctrinas, aviación, marina, conferencia de paz, niebla de guerra, guerra civil real.

## Sesión: conferencias de paz, humo de batalla y casas solo de cerca
- Conferencia de paz con presupuesto de puntos de guerra (`src/peace.js`); la IA elige exigencias automáticamente; las crisis diplomáticas usan el resultado legado.
- Humo y fogonazos en las provincias en batalla; las casas y campanarios solo se ven con zoom cercano.
