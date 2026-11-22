# Calibración histórica del combate terrestre (fase 3)

Esta fase repite y amplía `ESTUDIO_GUERRA.md`: se contrastó el modelo del juego con la historiografía y se **midió** con un banco de pruebas (`cal.js`, 24 batallas por celda, fuerzas iguales, terreno llano, mismos generales) en lugar de fiarse de la intuición.

## Fuentes consultadas (resúmenes web; algunas cifras son de fuentes secundarias → «[verificar]»)
- Bala Minié y fusil rayado: [Rifled musket](https://en.wikipedia.com/wiki/Rifle_musket), [History.com](https://www.history.com/articles/minie-ball), [Innovations of Death](https://dundas.substack.com/p/innovations-of-death-the-minie-ball). Las tácticas siguieron siendo napoleónicas casi cuatro décadas; el rayado hizo más letal el fuego a distancia, redujo el papel de la caballería y expuso a los artilleros.
- Enfermedad: [Two faces of death (PubMed)](https://pubmed.ncbi.nlm.nih.gov/18192771/), [Infectious diseases during the Civil War](https://pubmed.ncbi.nlm.nih.gov/8513069/), [PBS Mercy Street](https://www.pbs.org/mercy-street/uncover-history/behind-lens/disease). Guerra de Secesión: ~2/3 de las muertes por enfermedad. Crimea: entre 3:1 y 25:1 según la fuente y el ejército **[verificar]**.
- Moltke, ferrocarril y telégrafo: [Britannica](https://www.britannica.com/biography/Helmuth-von-Moltke/Chief-of-the-general-staff), [Case study Auftragstaktik](https://donvandergriff.substack.com/p/case-study-german-integration-of). «Marchar divididos, golpear unidos» es un resumen posterior, no una cita literal.
- Predominio de la defensa 1866-1905: [Britannica, The power of the defense](https://www.Britannica.Com/topic/tactics/The-power-of-the-defense), [Tactics from Waterloo to the Bulge](https://britannica.com/topic/tactics/Tactics-from-Waterloo-to-the-Bulge). Chassepot (1866), Dreyse prusiano, Boer 1899 (Colenso ~1.127 bajas británicas frente a muy pocas bóers **[verificar]**), Maxim.
- Primera Guerra Mundial: [Tactics in warfare during WWI (Anzac Portal)](https://anzacportal.dva.gov.au/wars-and-missions/ww1/military-organisation/tactics-in-warfare), [Infiltration tactics](https://www.wikipedia.com/wiki/Hutier_tactics). Barrera rodante (1916), tropas de asalto (Rohr, 1916-17), defensa elástica en profundidad (invierno 1916-17).
- Entreguerras y Segunda: [Deep operation](https://www.wikipedia.org/wiki/Deep_battle), [Blitzkrieg](https://Www.wikipedia.org/wiki/Blitzkrieg), [Britannica Blitzkrieg](https://www.britannica.com/topic/blitzkrieg). Panzerdivision de armas combinadas, Schwerpunkt, batalla profunda soviética (manual de 1933).

## Referencias de bajas (por batalla, sobre fuerzas empeñadas) que guían los objetivos
- Napoleónica / 1815-60: perdedor 25-45% (Waterloo: franceses ~45%, aliados ~19%), vencedor 10-25%; Gettysburg ~25-32% cada bando en 3 días; 1-3 días de duración.
- 1866-1900: atacante muy superior en bajas (St. Privat: la Guardia prusiana ~44% en horas; Königgrätz ~4% prusianos frente a ~18% austriacos).
- 1914-18: primer día del Somme ~48% de los atacantes británicos; la artillería causó la mayoría de las bajas.

## Auditoría: qué había y qué se cambió
| Tema (de ESTUDIO_GUERRA §10) | Estado antes | Cambio en esta fase |
|---|---|---|
| Ataque frente a defensa por época | Coste frontal creciente (`realismo.js`), pero **batallas de 14-23 días y bajas del 77-110 %** con fuerzas iguales, razón atacante/defensor de 2,5 a 5,8 | `calibracion.js`: ritmo de pérdida de organización y letalidad por época; razón 1,7 → 3,6 |
| Duración | Mínimo 4 días y cola de hasta 23 | 5-10 días según época |
| Caballería frente al fusil | Solo reducía cargas ocasionales | Fuerza de la caballería ×1 → ×0,35 con retrocarga y ametralladora |
| Artillería | Constante | ×0,85 (ánima lisa) → ×1,4 (tiro rápido + trincheras) |
| Enfermedad | Fija, sin sanidad (0,022 %/día) | Base ×2, y −30 % con Saneamiento, −55 % con Medicina |
| Doctrinas 1914-45 | Árbol terminaba en 1890 | Nuevos escalones: infiltración (1916), preparación artillera (1916), armas combinadas (1930), blitzkrieg (1936), defensa móvil blindada (1930), movilización total (1914); fechas de defensa elástica y barrera rodante movidas a 1914-15 |
| Arma combinada | No existía | +4 % (+12 % con doctrina) si hay infantería, artillería y blindados con armamento de 1900 en adelante |
| Marchar separados / convergencia | Ya existía (`realismo.js`) | Sin cambios |
| Metralla, guerrilla, suministros, asedios | Ya existían | Sin cambios |

## Resultados del banco de pruebas (fuerzas iguales; días | bajas atacante % | bajas defensor % | razón)
| Época | 6 inf + cab + art | 8 inf |
|---|---|---|
| Ánima lisa | 5,7 · 34 · 19 · 1,7 | 7,3 · 33 · 17 · 1,9 |
| Fusil rayado | 5,9 · 34 · 20 · 1,7 | 7,1 · 41 · 19 · 2,2 |
| Retrocarga | 5,8 · 39 · 21 · 1,9 | 7,5 · 45 · 18 · 2,5 |
| Ametralladora | 6,8 · 51 · 20 · 2,6 | 8,5 · 57 · 18 · 3,2 |
| Trincheras | 7,8 · 50 · 20 · 2,5 | 9,9 · 61 · 17 · 3,6 |

## Lo que NO se ha hecho (límites honestos)
- «100 % fiel» no es alcanzable: los números son una **calibración razonada** contra rangos históricos, no una reconstrucción exacta. Las cifras secundarias están marcadas arriba.
- Una batalla del juego son 5-10 días en una provincia; las batallas históricas de un solo día (Waterloo, Königgrätz) se estiran a un ritmo jugable. Los ejércitos siguen aguantando hasta que se desploma su organización o se ordena la retirada (decisión de diseño anterior).
- No hay unidades antitanque ni infantería antiaérea; los blindados cuentan por el parámetro de blindaje, no por un duelo tanque-contra-cañón.
- Las trincheras de campaña improvisadas (guerra de Secesión) no se han vuelto a activar antes de 1900, por decisión previa del usuario.
