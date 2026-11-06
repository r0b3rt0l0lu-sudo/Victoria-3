# Estilo de mapa de batalla (referencia: capturas de Wagram)

## 1. Qué hay en las capturas
- **Pintura suave, no vectorial**: todo el campo está algo desenfocado (pincelada), sin bordes duros. Las unidades y los rótulos son lo único nítido.
- **Base verde oliva-lima** (~rgb 108,140,42) con grandes manchas más claras (140,168,58) y más oscuras (80,106,32), y un **mosaico de parcelas** en rombos apenas visibles (alternando tonos).
- **Alturas pintadas de color**: la cresta es una banda **marrón-ocre** (112,92,40 → 170,142,66) con luces claras y sombras oscuras, con textura de pincelada; no son curvas de nivel.
- **Ríos finísimos**: línea cian clara (~100,170,205) de 1-2 px con filete oscuro, serpenteando; solo el Danubio es ancho y azul, con islas.
- **Bosques**: manchas de verde muy oscuro (38,76,26) con grano de copas.
- **Aldeas**: racimos pequeños de casas marrón oscuro (84,50,30) con **nombre en rótulo serif** blanco con halo oscuro.
- **Caminos**: finos, marrón-tostado, poco contraste.
- **Unidades**: muy pequeñas respecto al terreno (≈1,3 % del ancho), en pares/filas, azul y blanco; comandantes como estandartes con retrato.
- Viñeta suave en los bordes.

## 2. Adaptación a los biomas
| Bioma | Base | Alturas | Bosque | Agua | Notas |
|---|---|---|---|---|---|
| 1 templado | oliva (108,140,42) | marrón-ocre | verde oscuro | cian claro | como la referencia |
| 2 bosque húmedo | verde profundo (84,120,40) | pardo | casi negro-verde | cian | más bosque y sombra |
| 3 desierto | arena (206,176,110) | ocre rojizo | palmas dispersas | turquesa | dunas, rocas |
| 4 estepa | oliva seco (150,156,70) | ocre dorado | arbustos | cian | |
| 5 tundra/pantano | gris-verde (120,138,96) | pardo-gris | verde frío | azul grisáceo | turberas |
| 6 jungla | verde saturado (46,110,44) | verde-pardo | muy denso | verdoso | |
| 7 montaña | gris-oliva (116,116,84) | pardo-gris con roca | pinos | cian | cumbres grises |
| 8 nieve | blanco-azulado (214,224,232) | gris azulado | verde frío | azul hielo | |

## 3. Aplicación
`src/pintura.js` redibuja todo el campo con ese estilo, desenfoca el terreno y añade nombres de aldeas y ríos; ríos, arroyos y barrancos son más estrechos, las aldeas más pequeñas y las unidades un ~30 % menores (y caben más por línea).
