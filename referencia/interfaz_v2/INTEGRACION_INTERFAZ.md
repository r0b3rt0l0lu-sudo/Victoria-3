# Interfaz v2 «Sala de mapas del Almirantazgo»: integración

Rediseño visual completo sin tocar la lógica:
- **Paleta** cerrada con colores semánticos, de estrato social y de categoría de bien.
- **Tipografía** histórica con pilas de sistema: no descarga nada; se quita el `@import` de Google Fonts que había en la v1.
- **Marcos**: roble y latón con cantoneras, cenefas, cintas de título y sellos de lacre.
- **Iconos**: 94 grabados en SVG que sustituyen a los emojis.
- **Temas**: oscuro y claro «pergamino».
- **Densidades**: tres. Además, paleta para daltonismo y modo de gama baja.

## 1. Archivos

| Archivo | Destino | Qué es |
|---|---|---|
| `src/tokens.css` | `src/tokens.css` (nuevo) | Solo variables: paleta, semántica, tipografía, escala, rejilla de 4 px, materiales SVG en línea, temas, densidades, daltonismo, `--fx` |
| `src/style.css` | sustituye a `src/style.css` | Capa 2: maquetación heredada de la v1 (posiciones y tamaños que la lógica espera) con la paleta redirigida a los tokens. Capas 3–10: base, componentes, ventanas, mapa y HUD, combate, inicio, utilidades, responsive |
| `src/icons.js` | sustituye a `src/icons.js` | Sprite de 94 iconos grabados, `icon()` con `<use>`, `EMO_ICON` ampliado (109 emojis), `iconize()` ampliado, `uiPrefs()` (tema, densidad, paleta y efectos; 12 líneas) |
| `iconos.svg` | referencia | El mismo sprite en un archivo aparte, por si se quiere usar fuera del juego |
| `mapa_emoji_icono.json` | referencia | Emoji → nombre de icono |
| `src/piel.css` | referencia | Capas 3–10 por separado (ya van al final de `style.css`) |
| `aplicar_plantillas.py`, `plantillas.diff` | — | Cambios mínimos de plantilla (§ 3) |
| `libro_estilo.html` | — | Libro de estilo autónomo: los dos temas lado a lado, conmutador de densidad, paleta para daltonismo y efectos |
| `capturas/` | — | Juego real en 1920×1080, 1280×720 y 390×844; tema pergamino; densidades compacta y cómoda; libro de estilo |
| `pruebas/` | — | `capturas_ui.js` (juego real), `libro_caps.js` (libro, contraste y coste de estilos) |

## 2. Pasos para Claude Code

1. Copia `src/tokens.css`, `src/style.css` y `src/icons.js` en `src/` (los dos últimos sustituyen a los actuales).
2. Ejecuta `python3 aplicar_plantillas.py .`. Es idempotente y avisa si algo no encaja. Hace cuatro cambios:
   - `build.py`: concatena `tokens.css` antes de `style.css`.
   - `ui.js`: roles ARIA de diálogo y pestañas, y nombre accesible del botón de cerrar.
   - `interfaz.js`: fila «Aspecto» en el panel de gráficos (tema, densidad, daltonismo) y sus acciones.
   - `rendimiento.js`: al pasar a calidad baja se llama a `uiPrefs()` para apagar texturas y animaciones.
3. Ejecuta `python3 build.py`.
4. Comprueba:
   - `node tools/prueba_panel_batalla.js` sigue sin errores.
   - Abre el panel de gráficos (☰ → Gráficos) y prueba **Tema**, **Densidad** y **Daltonismo**.

## 3. Cambios de plantilla (diff completo en `plantillas.diff`)

```diff
- css = mini(rd('src/style.css'), 'css')
+ css = mini(rd('src/tokens.css') + '\n' + rd('src/style.css'), 'css')
- <div class="window w-${UI.win}"><div class="whead">…<h2>${w.title}</h2>
+ <div class="window w-${UI.win}" role="dialog" aria-modal="false" aria-labelledby="wtitle"><div class="whead">…<h2 id="wtitle">${w.title}</h2>
- <button class="x" data-act="closewin">✕</button>
+ <button class="x" data-act="closewin" aria-label="Cerrar">✕</button>
- <button class="tab …" data-act="tab"            → + role="tab" aria-selected="${cur === id}"
- <div class="tabs">                               → + role="tablist"
+ interfaz.js: fila «Aspecto» (uitema, uidens, uipaleta) y Object.assign(ACT, {…})
```

No se renombra ninguna clase, `data-act`, `data-id`, `data-tip` ni `id`.

## 4. Iconos

`iconize()` ya existía y sustituye los emojis de `.chip > b`, `.rbtn`, `.mbtn > span`, `#camctl button`, `.mode`, `.wicon` y `.mapbtn`. Ahora también los de `.evicon` y `[data-emo]`.

- Cubre los emojis del menú inferior, los modos de mapa (incluidos los modos marítimo y aéreo), las cabeceras de ventana y los recursos.
- Para un emoji nuevo, añade una entrada en `EMO_ICON` (`mapa_emoji_icono.json`). Para un icono nuevo, añade una entrada `[sombra, trazo, detalle]` en `ICON_V2`.
- Las banderas siguen generándose por código.

**Estilo grabado**: cada icono tiene tres capas.
- Sombra rayada al 22 %.
- Trazo de 1,5 px.
- Detalle de 0,8 px: rayado, remaches, vetas.

## 5. Tema, densidad, paleta y gama baja

| Ajuste | Cómo activarlo |
|---|---|
| Tema | `uiPrefs({theme: 'oscuro' \| 'pergamino'})` → `<html data-theme>` |
| Densidad | `uiPrefs({densidad: 'comoda' \| 'normal' \| 'compacta'})` → `--dz` (1,12 / 1 / 0,88): cambia tipografía y espaciados |
| Daltonismo | `uiPrefs({paleta: 'daltonica'})`: bueno azul y malo naranja. Con esta paleta, las etiquetas `.tag.good` y `.tag.bad` llevan además ▲/▼ (y siempre con la clase `.num`), así que no dependen solo del color |
| Gama baja | Si `R.lowEnd` está activo, `data-fx="0"`: sin texturas, animaciones, brillos ni sombras grandes |
| Escala de interfaz | Sigue con `--wz` (botón Aa de la v1). Las tres densidades se combinan con ella |

Todo se guarda en `localStorage` (`vic_ui2`). Se respeta `prefers-reduced-motion`.

## 6. Verificación

Capturas del juego real compilado con estos archivos, en `capturas/`:
- Inicio, mapa con HUD y evento modal.
- Ventanas: Presupuesto, Producción y mercado, Política, Tecnología, Diplomacia, Ejército (pestaña Marina), Industria y Población.
- En 1920×1080, 1280×720 y 390×844 (móvil), más el tema pergamino y las densidades compacta y cómoda.
- 0 errores de página en las 7 pasadas.

**Contraste AA** medido sobre los colores calculados en el navegador (`pruebas/libro_caps.js`, 26 pares):
- Todo el texto normal está por encima de 4,5:1.
- Tema oscuro: texto principal 13,5:1 y secundario 9,3:1; títulos de latón 10:1. Semánticos entre 5:1 y 8,1:1 (mínimo medido: 4,97:1).
- Tema pergamino: texto principal 11,8:1 y secundario 6,3:1.

**Coste de estilos**: insertar y maquetar una tabla de 200 filas con etiquetas y botones dentro de una ventana cuesta 14–27 ms una sola vez (Chromium sin GPU).
- El HUD no tiene animaciones permanentes. Solo pulsan el asesor y los nodos disponibles del árbol nacional, y se apagan con `--fx:0`.
- Las fichas del mapa (`.atoken`, `.ntoken`) conservan su tamaño y llevan sombra de 1 px, sin desenfoque. No hay `backdrop-filter` sobre el mapa.

## 7. Riesgos (qué puede descuadrarse y por qué)

1. **CSS inyectado por módulos.** `interfaz.js`, `calidad.js`, `campanas.js` y `rotulos.js` crean `<style>` con colores fijos de la v1.
   - Los paneles principales (`#topmenu`, `#gfxpanel`, campañas) ya se cubren con `html #…`.
   - Otros elementos de esos módulos pueden conservar degradados grises de la v1 (se ven bien, pero no llevan madera ni latón).
2. **Reglas `!important` de la v1** (sobre todo en `#plaque`, `#datebox` y en el móvil). La piel las iguala con `!important` donde hace falta. Si se añade una regla nueva con `!important` en la v1, puede ganar a la piel.
3. **Ventanas con HTML propio** (resúmenes de guerra, mando, prisioneros…) usan las clases comunes (`.card`, `.tbl`, `.kv`, `button`) y heredan el estilo. Las clases muy específicas (`.bsum-*`, `.ws-*`, `.cm-*`) solo reciben el marco y la tipografía.
4. **Fuentes.** No hay fuentes embebidas: se usan Cinzel/Trajan/Palatino si existen y, si no, Georgia con versalitas. En Linux sin Palatino ni Georgia se ve una serif genérica.
5. **Cantoneras.** Son un `::after` en `.window`, `#battlepanel`, `#navalpanel` y `.wd`. Si alguna de esas cajas ya usa su `::after` para otra cosa, se pisa (no se ha visto ninguna).
6. **Tema pergamino.** Las ventanas y tarjetas cambian. Los paneles de combate y el visor 3D conservan el fondo oscuro (son pantallas de mapa).
7. **Móvil (<900 px).** Las ventanas pasan a pantalla completa y se quitan las cantoneras. La barra inferior se desplaza en horizontal. No lo he probado en un móvil real.

## 8. Lo que no está

- **Maquetas HTML independientes del juego**: las capturas son del juego real con datos reales (más fiable para ver solapes), y el libro de estilo es autónomo.
- **Ilustraciones grabadas para los eventos**: los eventos usan el documento con capitular y sello, sin ilustración.
- **Rediseño específico de**:
  - el visor de batalla 3D;
  - el HUD de primera persona;
  - la vista naval 3D.
  Usan el marco y los botones comunes.
