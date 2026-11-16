
/* ---------- naciones: pintura de buques, aviones y defensa ---------- */
// Por nación y época hay tres dominios: mar (buques), aire (aviones) y tierra (antiaéreos y personal). c = [principal, camuflaje / superior,
// obra viva o panza, cubierta]. bandera / ensign: layout + 3 colores (respaldo si el juego no da la textura con b3FlagTex). marca: aviones.
// Fuentes: colores AP 507 de la Royal Navy; RLM 02/65/70/71 y Hellgrau/Dunkelgrau 50/51 de la Kriegsmarine; grises de los arsenales de
// Kure y Yokosuka y ameiro del A6M2 (Mitsubishi); colores aproximados donde se indica.
const DOMS = ['mar', 'aire', 'tierra'];
const NAVES_NAC = {
  GBR: {nombre: 'Reino Unido', band: '#c8102e',
    '1': {mar: {c: ['#8a8e90', '#62686c', '#5a2420', '#9a8a6a'], ens: ['cruz', '#f2f0ea', '#c8102e', '#1e2a6a'], nota: 'Gris de flota (Grand Fleet), cubiertas de teca.'},
      aire: {c: ['#5a5a3a', '#5a5a3a', '#d8d0b0', '#5a5a3a'], marca: ['roundel', '#1e3a8a', '#f2f0ea', '#c8102e'], id: '#f2f0ea', nota: 'PC10 caqui por encima y lino barnizado por debajo; escarapela RFC.'},
      tierra: {c: ['#6a6a4a', '#5a5a3a', '#6a6a4a', '#5a5a3a']}},
    '2': {mar: {c: ['#8c9398', '#5c656b', '#5e2a24', '#a08a68'], ens: ['cruz', '#f2f0ea', '#c8102e', '#1e2a6a'], nota: 'AP 507B gris medio y 507A gris oscuro; obra viva antiincrustante roja; teca en los acorazados, acero gris en los portaaviones.'},
      aire: {c: ['#3e4a2e', '#6b5a3f', '#c2c9a8', '#3e4a2e'], marca: ['roundel', '#1e3a8a', '#f2f0ea', '#c8102e'], id: '#e0b830', nota: 'Verde oscuro y tierra oscura por encima, Sky por debajo; escarapela tipo A1/B con anillo amarillo.'},
      tierra: {c: ['#6a6a4a', '#4e5236', '#6a6a4a', '#5a5a3a']}}},
  GER: {nombre: 'Alemania', band: '#3a3a3a',
    '1': {mar: {c: ['#8a9094', '#646a6e', '#5a2a24', '#a8926a'], ens: ['cruz', '#f2f0ea', '#1a1a1a', '#1a1a1a'], nota: 'Gris de la Kaiserliche Marine; Reichskriegsflagge simplificada (cruz negra sobre blanco).'},
      aire: {c: ['#5a5a6a', '#7a6a4a', '#9a9ab0', '#5a5a6a'], marca: ['balken', '#1a1a1a', '#f0ece2', '#1a1a1a'], id: '#f0ece2', nota: 'Tela de rombos (Lozenge) aproximada a dos tonos; cruz de hierro / Balkenkreuz de 1918.'},
      tierra: {c: ['#6f7462', '#5a5e50', '#6f7462', '#5a5e50']}},
    '2': {mar: {c: ['#a3a8aa', '#6a7074', '#5a2a24', '#b09a72'], ens: ['horiz', '#141414', '#f2f0ea', '#c8202a'], nota: 'Hellgrau 50 y Dunkelgrau 51; teca. Ensign: tricolor sin esvástica (decisión de diseño; aprox.).'},
      aire: {c: ['#3a4434', '#4a5038', '#a8bcc4', '#3a4434'], marca: ['balken', '#1a1a1a', '#f0ece2', '#1a1a1a'], id: '#e8c020', nota: 'RLM 70/71 en astillas por encima y RLM 65 por debajo; Balkenkreuz. Sin la esvástica de la deriva (decisión de diseño).'},
      tierra: {c: ['#5e6256', '#4b5156', '#5e6256', '#4b5156']}}},
  JPN: {nombre: 'Japón', band: '#bc002d',
    '1': {mar: {c: ['#7e8284', '#5e6264', '#6a2a22', '#9a7a52'], ens: ['disco', '#f2f0ea', '#bc002d', '#f2f0ea'], nota: 'Gris de la Armada Imperial; bandera del sol naciente simplificada (disco).'},
      aire: {c: ['#c8c0a0', '#c8c0a0', '#c8c0a0', '#c8c0a0'], marca: ['sol', '#bc002d', '#f2f0ea', '#bc002d'], id: '#f2f0ea', nota: 'Lino barnizado (aprox.).'},
      tierra: {c: ['#8a7e4a', '#7a6e48', '#8a7e4a', '#7a6e48']}},
    '2': {mar: {c: ['#7a7f80', '#5a5e60', '#6a2a22', '#8a6a4a'], ens: ['disco', '#f2f0ea', '#bc002d', '#f2f0ea'], nota: 'Gris de Kure; cubiertas de linóleo pardo y teca; cubiertas de vuelo de madera.'},
      aire: {c: ['#b8b49a', '#b8b49a', '#b8b49a', '#b8b49a'], marca: ['sol', '#bc002d', '#f2f0ea', '#bc002d'], id: '#e0b030', nota: 'A6M2 de 1941: ameiro (gris ámbar) uniforme; hinomaru; banda de identificación amarilla en el borde de ataque. Bombarderos: verde por encima.'},
      tierra: {c: ['#8a7e4a', '#6a6440', '#8a7e4a', '#7a6e48']}}},
  USA: {nombre: 'Estados Unidos', band: '#1f3f8f',
    '2': {mar: {c: ['#7c8590', '#4e5864', '#5a2a24', '#7a6a50'], ens: ['usa', '#b22234', '#f2f0ea', '#3c3b6e'], nota: 'Measure 21/22 (azul marino / gris); aprox.'},
      aire: {c: ['#4e5a6a', '#4e5a6a', '#c8ccc8', '#4e5a6a'], marca: ['estrella', '#f2f0ea', '#f2f0ea', '#1f3f8f'], id: '#f2f0ea', nota: 'Gris azulado y gris claro (Marina, 1942); estrella blanca sobre círculo azul.'},
      tierra: {c: ['#6b6438', '#5a5430', '#6b6438', '#5a5430']}}},
  FRA: {nombre: 'Francia', band: '#1f3f8f',
    '2': {mar: {c: ['#8a9094', '#626a6e', '#5a2a24', '#9a8a6a'], ens: ['vert', '#1f3f8f', '#f2f0ea', '#c8202a'], nota: 'Gris de la Marine nationale.'},
      aire: {c: ['#5a5a3a', '#7a6a4a', '#9aa4a8', '#5a5a3a'], marca: ['roundel', '#1f3f8f', '#f2f0ea', '#c8202a'], id: '#f2f0ea', nota: 'Camuflaje de tres tonos (aprox.).'},
      tierra: {c: ['#8a7e56', '#5a5440', '#8a7e56', '#5a5440']}}},
  ITA: {nombre: 'Italia', band: '#008c45',
    '2': {mar: {c: ['#9a9ea0', '#6a6e70', '#5a2a24', '#a08a68'], ens: ['vert', '#008c45', '#f2f0ea', '#cd212a'], nota: 'Gris claro; franjas rojas y blancas de identificación en el castillo (no modeladas).'},
      aire: {c: ['#8a7a4a', '#4a5a3a', '#9aa0a0', '#8a7a4a'], marca: ['roundel', '#1a1a1a', '#f2f0ea', '#1a1a1a'], id: '#f2f0ea', nota: 'Moteado (aprox.); fasces en las alas sustituidas por escarapela negra y blanca (aprox.).'},
      tierra: {c: ['#7a7c62', '#6a6c54', '#7a7c62', '#6a6c54']}}},
  SOV: {nombre: 'Unión Soviética', band: '#c8202a',
    '2': {mar: {c: ['#7e868a', '#5a6064', '#5a2a24', '#7a6a52'], ens: ['mono', '#f2f0ea', '#c8202a', '#1f3f8f'], nota: 'Gris; ensign naval blanco con franja azul (aprox.).'},
      aire: {c: ['#4a5a32', '#2e3428', '#9ab0c0', '#4a5a32'], marca: ['estrella', '#c8202a', '#f2f0ea', '#c8202a'], id: '#c8202a', nota: 'Verde AMT-4 y negro por encima, azul claro por debajo; estrella roja.'},
      tierra: {c: ['#7a7650', '#4f5a32', '#7a7650', '#4f5a32']}}},
  GEN: {nombre: 'Genérico teñible', band: '#888888',
    '2': {mar: {c: ['#8a9094', '#62686c', '#5a2a24', '#9a8a6a'], ens: ['horiz', '#6a6448', '#e8e0c8', '#2a4a7a'], nota: 'Teñible: la franja y la bandera son las del país.'},
      aire: {c: ['#5a6040', '#5a6040', '#a8b0b0', '#5a6040'], marca: ['roundel', '#2a4a7a', '#f2f0ea', '#8a3a2a'], id: '#f2f0ea', nota: 'Teñible.'},
      tierra: {c: ['#6a6448', '#5a5440', '#6a6448', '#5a5440']}}}
};
function eraOfN(n, era) { return n[era] || n[era === '1' ? '2' : '1'] || NAVES_NAC.GEN['2']; }
// navePalette(nación, época, dominio) → {main, trim, acc, deck, flag, flagLayout, band, mark, markType, id, note}
function navePalette(nation, era, dom) {
  const n = NAVES_NAC[nation] || NAVES_NAC.GEN, e = eraOfN(n, era || '2'), d = e[dom || 'mar'] || e.mar, ens = (e.mar || {}).ens || ['horiz', '#888', '#ddd', '#444'], mk = (e.aire || {}).marca || ['roundel', '#2a4a7a', '#f2f0ea', '#8a3a2a'];
  return {main: d.c[0], trim: d.c[1], acc: d.c[2], deck: d.c[3], flag: ens.slice(1), flagLayout: ens[0], band: n.band || '#888888', mark: mk.slice(1), markType: mk[0], id: (e.aire || {}).id || '#f2f0ea', note: d.nota || '',
    ensign: ens[0], trimCol: d.c[1]};
}
