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
