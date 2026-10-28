# Victoria — Una era de revolución (réplica web)

Réplica de fans, en un único archivo HTML, inspirada en **Victoria 3**: mapa 3D con relieve, economía de mercado,
población por profesiones y estratos, política con grupos de interés y leyes, tecnología, diplomacia, colonización y guerra.
Todo en español. No tiene relación con Paradox Interactive.

## Cómo jugar

Abre **`index.html`** en un navegador moderno (Chrome, Edge o Firefox con WebGL). No necesita servidor ni conexión
(three.js está incrustado; solo las tipografías de Google Fonts se cargan online y tienen alternativa local).

1. Elige un país en la pantalla de inicio (Reino Unido, Francia, Prusia, EE. UU., China, Japón…) y pulsa *Comenzar partida*.
2. El juego arranca en pausa (enero de 1836). Pulsa ▶ o la barra espaciadora; las 5 barras controlan la velocidad.
3. Haz clic en un estado del mapa para ver sus edificios y construir (＋). Usa la barra inferior para abrir
   Presupuesto, Producción y mercado, Población, Política, Tecnología, Diplomacia, Ejército y Construcción.
4. Los botones circulares inferiores derechos cambian el modo de mapa (político, terreno, población, nivel de vida,
   alfabetización, prosperidad, malestar, relaciones). El minimapa permite saltar a cualquier punto.
5. La partida se autoguarda cada enero y puede guardarse/cargarse manualmente (💾 / 📂, `localStorage`).

### Controles

| Acción | Control |
| --- | --- |
| Desplazar el mapa | Arrastrar con el botón izquierdo, `W A S D` o flechas |
| Zoom | Rueda del ratón, `+` / `-` |
| Girar / inclinar | Botón derecho + arrastrar (o `Mayús`), `Q E` / `R F` |
| Pausa / velocidad | `Espacio` / `,` `.` |
| Cerrar ventana | `Esc` |

## Qué se simula

* **Mapa**: contornos procedurales del mundo de 1836 (272 estados), relieve y biomas generados, malla 3D con three.js.
* **Economía**: mercado mundial de 18 bienes con precios dinámicos; 24 tipos de edificios con insumos, producción, salarios,
  beneficios y empleo; construcción pública (puntos) y privada (inversión de capitalistas); utilización de capacidad.
* **Población**: 11 profesiones en 3 estratos, consumo por escala de necesidades, nivel de vida, crecimiento, alfabetización.
* **Política**: 8 grupos de interés (influencia, aprobación, coalición de gobierno), 11 categorías con 3–5 leyes cada una,
  legitimidad, radicales y leales, reformas por votación.
* **Tecnología**: 23 tecnologías en tres ramas que desbloquean edificios, leyes y bonificaciones.
* **Estado**: presupuesto, impuestos, deuda, burocracia, ejército, prestigio, rango, objetivos del diario, eventos con decisiones.
* **Mundo**: ~70 países con IA (impuestos, construcción, reformas, colonización, guerras), diplomacia y guerras con puntuación.

## Estructura del proyecto

```
src/geo.js      contornos, cordilleras, biomas y listado de estados/países
src/data.js     bienes, edificios, profesiones, grupos de interés, leyes, tecnologías, objetivos
src/mapgen.js   relieve, biomas, asignación de estados (Dijkstra) y bordes
src/sim.js      simulación económica, política, IA, guerra, eventos, guardado
src/render.js   escena three.js, cámara, pintado del mapa, etiquetas y minimapa
src/ui.js       HUD, ventanas, panel de estado, pantalla de inicio
src/style.css   estilo visual
vendor/three.min.js   three.js r152
build.py        genera index.html a partir de src/ y vendor/
```

Para regenerar el archivo tras editar el código: `python3 build.py`.

## Limitaciones conocidas

La geografía es una aproximación esquemática (no un mapa histórico exacto), el mercado es único y global, y la economía,
la IA y las guerras están muy simplificadas respecto al juego original.
