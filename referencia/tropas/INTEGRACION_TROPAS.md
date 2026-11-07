# Tropas 3D: integración en Victoria (instrucciones para Claude Code)

Este paquete contiene la versión completa de las tropas 3D: 30 tipos, 4 épocas, 89 clips, 3 niveles de detalle (LOD), 15 paletas de nación y un visor. No usa archivos externos: todo se genera en código.

Solo depende de `THREE` global (r152).

## Archivos

| Archivo | Destino en el repo |
|---|---|
| `troops3d.js` (generado con `build.sh` a partir de `src/*.js`) | `src/troops3d.js` |
| `src/a_geo.js … f_core.js` (fuentes por secciones) | `tools/tropas/src/` (opcional; editar aquí y volver a generar) |
| `visor.html` | `tools/tropas/visor.html` (con `troops3d.js` al lado) |
| `docs/tabla_uniformes.md`, `docs/clips.md`, `docs/estadisticas.md`, `docs/tropas_clips.json` | `docs/tropas/` |
| `hojas/*.png`, `legibilidad_8px.png` | `docs/tropas/` (referencia visual) |

## Reglas

- Trabaja en la rama actual. **No hagas push a otra rama ni abras un PR sin preguntar.**
- No asignes memoria por fotograma: nada de `new` dentro de `updateArmyMeshes` ni del bucle de batalla.
- Si el módulo lanza cualquier excepción, pon `R.tropas3dOff = true`, vuelve a las figuras antiguas y avisa en consola.
- **Compatibilidad.** Usa las tropas 3D solo si se cumplen tres condiciones:
  - `renderer.capabilities.isWebGL2`, o bien la extensión `OES_texture_float`.
  - `capabilities.maxVertexTextures > 0`.
  - `capabilities.maxTextureSize >= 4096`: la textura de huesos mide 60×3641.

  Si alguna falla y hay ≤ 2.000 figuras, usa `CpuBatch` (no necesita texturas en el shader de vértices). Si falla y hay más, usa las figuras antiguas.

## 1. Build

1. Copia `troops3d.js` a `src/troops3d.js`.
2. En `build.py`, añade `'troops3d.js'` a `order` justo antes de `'render3d.js'`.
3. Comprueba que `python3 build.py` y `python3 build.py --light` terminan sin errores.

## 2. Paletas: un color por país

Registra cada país del juego como nación **antes** de crear `TroopShared`, o añádelo después con `shared.addNations([...])`.

Si el país tiene un uniforme histórico en el módulo, mantenlo y conserva solo el color del mapa como principal, o no lo toques. Si no lo tiene, cópialo del genérico:

```js
const T = Troops3D, HIST = {GBR: 'GBR', FRA: 'FRA', PRU: 'PRU', GER: 'PRU', AUT: 'AUT', RUS: 'RUS', TUR: 'TUR', USA: 'USA', CSA: 'CSA', SPA: 'ESP', ITA: 'ITA', SAR: 'ITA', JAP: 'JPN', CHI: 'CHN', SWE: 'SWE', DEN: 'DEN'};   // adapta a los códigos del juego
Object.keys(G.C).forEach(tag => {
  if (T.NACIONES[tag]) return;
  const base = T.NACIONES[HIST[tag] || 'GEN'], hex = '#' + R.occRGB(tag).map(v => v.toString(16).padStart(2, '0')).join('');
  const n = JSON.parse(JSON.stringify(base));
  if (!HIST[tag]) T.TROOP_ERAS.forEach(e => { if (n[e]) n[e].c[0] = hex; });   // genérico: casaca = color del país
  T.NACIONES[tag] = n;
});
R.t3 = {shared: new T.TroopShared(Object.keys(G.C))};
```

- **Tamaño.** Cada nación ocupa 24 filas (4 épocas × 6 papeles) de una textura de 8 px de ancho. Con 200 países serían 4.801 filas, por encima del límite de 4.096 de algunos móviles. Por eso, con muchos países registra solo la época actual: `new T.TroopShared(tags, {eras: [eraActual]})`, que da 6 filas por país, y llama a `shared.setEras([nueva])` cuando cambie la época.
- **Geometría.** Depende del tocado. `troopGeoKey(tipo, época, nación)` devuelve la clave de malla, y las naciones con la misma clave comparten lote. Crea un lote por clave, no uno por nación.

## 3. Mapa de campaña: sustituir `buildFigures` y `updateArmyMeshes` (`src/render3d.js`)

Conserva el código actual como reserva (`const _old = updateArmyMeshes; updateArmyMeshes = function (t) { … }`).

### Lotes

Crea un `TroopLodSet` por (tipo, época, clave de tocado), con capacidades `[cap0, cap1, cap2]`:

- Infantería: `[600, 2500, 2500]`.
- Caballería y artillería: `[200, 800, 800]`.
- Con `R.lowEnd`, la mitad.

La época sale de `G.date.y`: < 1856 A, < 1881 B, < 1914 C, resto D.

### Correspondencia con el juego

`dKind(d)` del juego se traduce así:

- `inf` → `fusilero`.
- `cav` → `husar`, o bien `coracero`/`lancero`/`dragon` si la división lo indica.
- `art` → el grupo `bateria`: `troopGroup('bateria', era, estado)`.

### Relleno

`updateArmyMeshes` se llama cada ~55 ms.

- Al empezar, llama a `set.begin()` en todos los lotes.
- Por figura, llama a `set.add(dist, x, y, z, yaw, escala, tag, clip, opciones)`, donde `dist` es la distancia a `R.cam`.
- Umbrales de LOD (opción `dist` del lote; ajústalos con capturas):
  - LOD0 si `R.cam.dist < 10`.
  - LOD1 si `< 30`.
  - LOD2 por encima.

### Escala

Las figuras miden 1,8 unidades. Las antiguas medían ≈ 0,35 unidades (`FS = 2.7`), así que usa `escala = 0.2`.

### Fase y variación deterministas (obligatorio)

`add()` sortea la fase, el brillo, la piel y la altura si no se le pasan. Como el relleno se rehace cada vez, hay que pasarlos siempre:

```js
const h1 = hash(a.id, i, f), h2 = hash(a.id, i, f, 7);
opts.phase = h1; opts.h = (h2 - 0.5) * 0.12; opts.bright = (h1 * 7.3) % 1; opts.skin = (h2 * 4) | 0; opts.horse = (h1 * 4) | 0;
```

Usa un objeto `opts` reutilizado, no un literal nuevo por figura.

### Clip según el estado

| Estado | Infantería | Caballería | Artillería (pieza / servidores) |
|---|---|---|---|
| Marcha | `marcha` | `trote` (`paso` si va despacio) | `remolque` / `marcha`, o el grupo `tren` (avantrén + pieza) |
| Batalla | `disparar_A` / `disparar_B` / `disparar_D` según la época | `carga` (`carga_lanza` los lanceros) | `troopGroup('bateria', era, 'fuego')` |
| Parado | `idle` | `idle` | `en_bateria` / `idle` |
| Retirada | `huir` (antes, una vez `tirar_arma`) | `huida` | — |

### Clips sin bucle y tiempo

- **Clips sin bucle** (`caer_*`, `asomarse`, `formar`, etc.): en vez de una fase, pasa `opts.start` con el instante de inicio en segundos (`timeU`). Guárdalo por figura para no reiniciarlo en cada relleno.
- **Tiempo.** Antes de dibujar, actualiza `R.t3.shared.timeU.value = performance.now() / 1000` y pon `R.dirty = true` mientras haya figuras visibles.

### Coste

Rellenar 20.000 instancias cuesta ≈ 9,6 ms (medido en SwiftShader). El mapa actual rellena ≤ 2.500 cada 55 ms, ≈ 1,2 ms.

Para más figuras, no rellenes cada vez: actualiza solo los ejércitos que se movieron. Cambiar el clip con `setClip(i, clip, fase, true)` cuesta 2,2 ms para 20.000 figuras y hace una mezcla suave de 0,22 s.

## 4. Visor de batalla (`battleviz.js`, hoy en 2D)

Opción recomendada:

1. Crea un `THREE.WebGLRenderer` sobre el `<canvas id="bmap">` del panel, con la misma luz que el mapa: `DirectionalLight(0xfff0d8, 0.78)` desde (−60, 90, −40) y `AmbientLight(0xffffff, 0.8)`.
2. Reutiliza `R.t3.shared` y su textura de huesos.
3. Cada regimiento de ≈ 3.000 hombres son 20–40 figuras en 2–3 filas, con espacios de 0,7 m (infantería) o 1,3 m (caballería), en LOD0/LOD1.
4. Coloca la artillería con `troopGroup('bateria', …)`, que da posiciones relativas en metros y el rumbo en grados.

Mantén el dibujo 2D como reserva si el 3D no se puede usar.

### Eventos

En cada fotograma, por figura que interese (no hace falta en todas: basta con las de LOD0/1 cercanas):

```js
const ph = T.clipPhase(kind, clip, now, phase);
T.eventsBetween(kind, clip, prevPh, ph, (nombre) => {
  if (nombre === 'disparo' || nombre === 'fuego') spawnSmoke(x, y + 1.4, z);   // fogonazo y humo en la boca
  if (nombre === 'cuerpo_al_suelo' || nombre === 'al_suelo') addCorpse(x, z);   // fija la figura como cadáver
});
```

Guarda `prevPh` por figura en un `Float32Array`.

### Bajas

1. `setClip(i, 'caer_muerto_atras' | '_adelante' | '_rodillas' | '_costado', now, true)`. Elige la variante con un hash.
2. Tras el evento `cuerpo_al_suelo`, la figura se queda en la última pose (clip sin bucle).

### Portaestandarte

1. Cuando cae, reproduce `caer_con_estandarte`.
2. Cuando llega el evento `estandarte_al_suelo`, crea otro `abanderado` en esa posición con `recoger_estandarte` (eventos `recoge` y `enarbola`).
3. Después, pásalo a `ondear`.

## 5. Grupos disponibles (`troopGroup(nombre, época, estado, {pieza})`)

| Grupo | Estados |
|---|---|
| `bateria` (`pieza`: `canon`, `canon_rc` u `obus`) | `fuego`, `reposo`, `marcha` |
| `ametralladora` | `fuego`, `reposo` |
| `general` (general + ayudante) | `reposo`, `marcha`, `carga`, `observar` |
| `mariscal` (mariscal + estandarte de mando) | `reposo`, `marcha` |
| `camilla` | `marcha` |
| `fuerte` (parapeto + 2 tiradores + oficial) | `fuego`, `cubierto`, `asomarse` |
| `tren` (avantrén + pieza) | `marcha`, `trote` |

Todos los miembros de un grupo deben usar **la misma fase** para que el fuego de la pieza y el de los servidores coincida en t = 0,62.

## 6. Sombras

El material es `MeshLambertMaterial` con un parche en `onBeforeCompile`. Para que las tropas proyecten sombra hace falta un `customDepthMaterial` (`MeshDepthMaterial`) con el mismo parche de vértices: el bloque `clipBone` y `transformed = bm * pos`.

**No está hecho todavía.** Mientras tanto, deja `castShadow = false` en los lotes de tropas.

## 7. Pruebas antes del commit

1. Captura de un ejército en marcha y otro en batalla en el mapa, en LOD0, LOD1 y LOD2.
2. La consola no muestra errores nuevos.
3. Mide `updateArmyMeshes` con 2.500 figuras.
4. Fuerza un fallo y comprueba que vuelven las figuras antiguas.
5. Comprueba que `juego-ligero.html` funciona.
6. Haz un commit en la rama actual y anota en `PROGRESO.md` qué se probó y qué no.

## Lo que comprobé y lo que no

**Comprobado** (Chromium con SwiftShader, sin GPU):

- Las capturas de las hojas.
- Los triángulos reales de `troopStats()`.
- Que todos los tipos × épocas × LOD × grupos se construyen y dibujan sin errores en el visor.
- La prueba de carga:
  - CPU de animación con GPU horneada: 0,01–0,02 ms con 5.000 y 20.000 figuras, en 2 llamadas de dibujo.
  - Versión CPU: 2,3 ms con 2.000 y 4,6 ms con 5.000.
  - Con LOD por distancia, los triángulos con 20.000 figuras bajan de 4,1 M a 0,2 M.

**No comprobado:**

- Una GPU real: los milisegundos de dibujo medidos son de un rasterizador por software.
- WebGL1 en un dispositivo real.
- Las sombras.
- La integración dentro del juego: este documento es para hacerla.
