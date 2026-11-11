
/* ---------------- uniformes ---------------- */
// Paleta por época: c = [principal (casaca/guerrera), ribete/vivos, pantalón, tocado]; toc = tocado; nota = fuente o aproximación.
// rol = variantes por papel (ligera, guardia, caballeria, artilleria, estado_mayor) que sustituyen la paleta de línea.
// Fuentes generales: Knötel, «Uniformenkunde» (1890–1921); Funcken, «L'uniforme et les armes des soldats du XIXe siècle»;
// Osprey Men-at-Arms (series por ejército). Donde la fuente no es concluyente o el uniforme variaba por regimiento se marca «aprox.».
const ROLES = ['linea', 'ligera', 'guardia', 'caballeria', 'artilleria', 'estado_mayor'];
const NACIONES = {
  GBR: {nombre: 'Reino Unido', bandera: 'union', veh: '#7a7652', f: ['#c8102e', '#1a3a8a', '#ffffff'],
    A: {c: ['#b8262c', '#f2f0e6', '#2e3240', '#1c1c1e'], toc: 'chaco', nota: 'Casaca escarlata, pantalón «Oxford mixture» azul grisáceo oscuro, chacó Albert (1844).'},
    B: {c: ['#b8262c', '#f2f0e6', '#262a3a', '#1c1c1e'], toc: 'chaco', nota: 'Túnica escarlata (1855), chacó de 1861. Enfield 1853 (avancarga rayado), Snider (1866) y Martini-Henry (1871).'},
    C: {c: ['#a8925e', '#8a7a4e', '#a8925e', '#e2d6b6'], toc: 'salacot', nota: 'Caqui de campaña colonial con salacot (1885–1902); en la metrópoli seguía la túnica roja con casco de servicio (no modelado). Lee-Metford/Lee-Enfield.'},
    D: {c: ['#8a7a52', '#6e6244', '#7e7050', '#6e6c4c'], toc: 'brodie', nota: 'Caqui Service Dress 1902; casco Brodie Mk I (1915–16).'},
    rol: {ligera: {A: {c: ['#23382a', '#1c1c1e', '#23382a', '#1c1c1e'], toc: 'chaco', nota: 'Rifle Brigade / 60th Rifles: verde oscuro, correaje negro.'}, B: {c: ['#23382a', '#1c1c1e', '#23382a', '#1c1c1e'], toc: 'chaco', nota: 'Rifles: verde oscuro.'}},
      guardia: {A: {c: ['#b8262c', '#1c2a5a', '#262a3a', '#1c1c1e'], toc: 'osos', nota: 'Foot Guards: gorro de piel de oso, vueltas azules.'}, B: {c: ['#b8262c', '#1c2a5a', '#262a3a', '#1c1c1e'], toc: 'osos', nota: 'Foot Guards.'}, C: {c: ['#b8262c', '#1c2a5a', '#262a3a', '#1c1c1e'], toc: 'osos', nota: 'Foot Guards (uniforme de parada; en campaña, caqui).'}},
      caballeria: {A: {c: ['#1e2a4a', '#d8b860', '#7a2a30', '#1c1c1e'], toc: 'colback', nota: 'Húsares: dolmán azul oscuro con alamares dorados; pantalón carmesí (11th Hussars). Aprox.: varía por regimiento.'}, B: {c: ['#1e2a4a', '#d8b860', '#7a2a30', '#1c1c1e'], toc: 'colback', nota: 'Húsares, aprox.'}},
      artilleria: {A: {c: ['#1e2a48', '#b8262c', '#1e2a48', '#1c1c1e'], toc: 'chaco', nota: 'Royal Artillery: azul oscuro, cuello rojo.'}, B: {c: ['#1e2a48', '#b8262c', '#1e2a48', '#1c1c1e'], toc: 'chaco', nota: 'Royal Artillery.'}},
      estado_mayor: {A: {c: ['#b8262c', '#d8b860', '#262a3a', '#1c1c1e'], toc: 'bicornio', nota: 'Generales: escarlata con bordado dorado y sombrero de dos picos (cocked hat).'}, B: {c: ['#b8262c', '#d8b860', '#262a3a', '#1c1c1e'], toc: 'bicornio', nota: 'Generales.'}}}},
  FRA: {nombre: 'Francia', bandera: 'vert', veh: '#7c8456', f: ['#1f3f8f', '#f2f0ea', '#c8202a'],
    A: {c: ['#2f4a9a', '#b8262c', '#b8262c', '#b8262c'], toc: 'kepi', nota: 'Casaca azul real, pantalón garance (rojo rubia, 1829). Chacó hasta 1845 y quepis en campaña (aprox.: se usa el quepis).'},
    B: {c: ['#2f4a9a', '#b8262c', '#b8262c', '#b8262c'], toc: 'kepi', nota: 'Túnica azul (1860), pantalón garance, quepis. Minié y Chassepot (1866).'},
    C: {c: ['#2f4a9a', '#b8262c', '#b8262c', '#b8262c'], toc: 'kepi', nota: 'Capote azul y pantalón garance hasta 1914. Lebel (1886).'},
    D: {c: ['#8aa0b6', '#6a8098', '#8aa0b6', '#8aa0b6'], toc: 'adrian', nota: 'Azul horizonte (1915), casco Adrian M1915. En 1914 aún pantalón rojo (no modelado).'},
    rol: {ligera: {A: {c: ['#1e2848', '#e0b830', '#3a4048', '#1e2848'], toc: 'kepi', nota: 'Chasseurs à pied: azul muy oscuro, vivos amarillo jonquille, pantalón gris hierro.'}, B: {c: ['#1e2848', '#e0b830', '#3a4048', '#1e2848'], toc: 'kepi', nota: 'Chasseurs à pied.'}, C: {c: ['#1e2848', '#e0b830', '#3a4048', '#1e2848'], toc: 'kepi', nota: 'Chasseurs à pied.'}},
      guardia: {B: {c: ['#2a3a78', '#f2f0e6', '#b8262c', '#1c1c1e'], toc: 'osos', nota: 'Granaderos de la Guardia Imperial (1854–1870): gorro de piel.'}, A: {c: ['#2f4a9a', '#b8262c', '#b8262c', '#b8262c'], toc: 'kepi', nota: 'Sin guardia entre 1830 y 1854: se usa la línea.'}},
      caballeria: {A: {c: ['#8ab0d8', '#f2f0e6', '#b8262c', '#b8262c'], toc: 'colback', nota: 'Húsares: dolmán azul celeste, pantalón garance. Aprox.: varía por regimiento.'}, B: {c: ['#8ab0d8', '#f2f0e6', '#b8262c', '#b8262c'], toc: 'colback', nota: 'Húsares, aprox.'}, C: {c: ['#8ab0d8', '#f2f0e6', '#b8262c', '#b8262c'], toc: 'kepi', nota: 'Húsares con quepis (1872+), aprox.'}},
      artilleria: {A: {c: ['#1e2848', '#b8262c', '#1e2848', '#1e2848'], toc: 'kepi', nota: 'Artillería: azul oscuro con vivos rojos.'}},
      estado_mayor: {A: {c: ['#1e2848', '#d8b860', '#b8262c', '#1c1c1e'], toc: 'bicornio', nota: 'Generales: azul oscuro con hojas de roble bordadas; bicornio de gala (aprox. en campaña).'}, B: {c: ['#1e2848', '#d8b860', '#b8262c', '#b8262c'], toc: 'kepi', nota: 'Generales: quepis con hojas de roble.'}}}},
  PRU: {nombre: 'Prusia / Alemania', bandera: 'horiz', veh: '#6c7258', f: ['#141414', '#f2f0ea', '#c8202a'],
    A: {c: ['#1e2a48', '#b8262c', '#2a2c34', '#1c1c1e'], toc: 'pickel', nota: 'Azul de Prusia, cuello rojo, pantalón gris oscuro; Pickelhaube desde 1842 (antes chacó). Fusil de aguja Dreyse (1841).'},
    B: {c: ['#1e2a48', '#b8262c', '#2a2c34', '#1c1c1e'], toc: 'pickel', nota: 'Igual; Dreyse M1841/62.'},
    C: {c: ['#1e2a48', '#b8262c', '#2a2c34', '#1c1c1e'], toc: 'pickel', nota: 'Azul de Prusia hasta 1910 (feldgrau adoptado en 1910). Gewehr 88 y 98. Bandera imperial negra-blanca-roja (1871).'},
    D: {c: ['#6f7462', '#5a5e50', '#6a6e60', '#5e6456'], toc: 'stahl', nota: 'Feldgrau; Stahlhelm M1916 (1914–15: Pickelhaube con funda).'},
    rol: {ligera: {A: {c: ['#2a4430', '#b8262c', '#2a2c34', '#1c1c1e'], toc: 'chaco', nota: 'Jäger: verde oscuro con chacó.'}, B: {c: ['#2a4430', '#b8262c', '#2a2c34', '#1c1c1e'], toc: 'chaco', nota: 'Jäger.'}, C: {c: ['#2a4430', '#b8262c', '#2a2c34', '#1c1c1e'], toc: 'chaco', nota: 'Jäger.'}},
      guardia: {A: {c: ['#1e2a48', '#f2f0e6', '#2a2c34', '#1c1c1e'], toc: 'pickel_pen', nota: 'Guardia: casco con penacho (Haarbusch) y galones blancos (Litzen).'}, B: {c: ['#1e2a48', '#f2f0e6', '#2a2c34', '#1c1c1e'], toc: 'pickel_pen', nota: 'Guardia.'}, C: {c: ['#1e2a48', '#f2f0e6', '#2a2c34', '#1c1c1e'], toc: 'pickel_pen', nota: 'Guardia.'}},
      caballeria: {A: {c: ['#1e1e22', '#f2f0e6', '#2a2c34', '#1c1c1e'], toc: 'colback', nota: 'Húsares «de la Muerte» (Totenkopf): negro con alamares blancos. Aprox.: uno de varios regimientos.'}, B: {c: ['#1e1e22', '#f2f0e6', '#2a2c34', '#1c1c1e'], toc: 'colback', nota: 'Húsares, aprox.'}, C: {c: ['#1e1e22', '#f2f0e6', '#2a2c34', '#1c1c1e'], toc: 'colback', nota: 'Húsares, aprox.'}},
      artilleria: {A: {c: ['#1e2a48', '#1c1c1e', '#2a2c34', '#1c1c1e'], toc: 'pickel', nota: 'Artillería: azul con cuello negro; casco con bola en lugar de pincho (no modelado).'}},
      estado_mayor: {A: {c: ['#1e2a48', '#b8262c', '#2a2c34', '#1c1c1e'], toc: 'pickel', nota: 'Generales: azul con cuello rojo y bordado dorado, franjas rojas en el pantalón.'}, D: {c: ['#6f7462', '#b8262c', '#6a6e60', '#5e6456'], toc: 'gorra', nota: 'Generales: feldgrau con cuello rojo y gorra de plato.'}}}},
  AUT: {nombre: 'Austria / Austria-Hungría', bandera: 'horiz', veh: '#6e705a', f: ['#c8202a', '#f2f0ea', '#c8202a'],
    A: {c: ['#e8e4d8', '#b8262c', '#e8e4d8', '#1c1c1e'], toc: 'chaco', nota: 'Casaca blanca con vueltas de color de regimiento (aprox.: rojo); pantalón blanco (alemanes) o azul celeste ceñido (húngaros); chacó.'},
    B: {c: ['#e8e4d8', '#b8262c', '#8aa6c8', '#1c1c1e'], toc: 'chaco', nota: 'Túnica blanca hasta 1868; pantalón azul celeste (aprox.). Lorenz (1854), Werndl (1867).'},
    C: {c: ['#2a3450', '#b8262c', '#8aa6c8', '#2a3450'], toc: 'kepi', nota: 'Túnica azul oscuro (1868), pantalón azul celeste; Feldkappe/chacó (aprox.: quepis). Mannlicher M1895.'},
    D: {c: ['#7f8c94', '#6c7880', '#7f8c94', '#5e6456'], toc: 'stahl', nota: 'Gris lucio (hechtgrau, 1909) y gris de campaña (1915); Stahlhelm alemán desde 1916.'},
    rol: {ligera: {A: {c: ['#5e6a6e', '#3a6a3a', '#5e6a6e', '#1c1c1e'], toc: 'sombrero', nota: 'Feldjäger: gris lucio con sombrero de ala y plumas de gallo (aprox.).'}, B: {c: ['#5e6a6e', '#3a6a3a', '#5e6a6e', '#1c1c1e'], toc: 'sombrero', nota: 'Feldjäger, aprox.'}, C: {c: ['#5e6a6e', '#3a6a3a', '#5e6a6e', '#1c1c1e'], toc: 'sombrero', nota: 'Feldjäger, aprox.'}},
      caballeria: {A: {c: ['#7a9ac0', '#d8b860', '#b8262c', '#1c1c1e'], toc: 'chaco', nota: 'Húsares: azul celeste y pantalón rojo, chacó (aprox.: varía por regimiento).'}},
      artilleria: {A: {c: ['#5a4a3a', '#b8262c', '#5a4a3a', '#1c1c1e'], toc: 'chaco', nota: 'Artillería: pardo con vivos rojos.'}, C: {c: ['#5a4a3a', '#b8262c', '#5a4a3a', '#5a4a3a'], toc: 'kepi', nota: 'Artillería: pardo.'}},
      estado_mayor: {A: {c: ['#e8e4d8', '#b8262c', '#b8262c', '#1c1c1e'], toc: 'bicornio', nota: 'Generales: blanco, pantalón rojo, bicornio con plumas verdes.'}}}},
  RUS: {nombre: 'Rusia', bandera: 'horiz', veh: '#6a6a50', f: ['#f2f0ea', '#1f3f9f', '#c8202a'],
    A: {c: ['#24402e', '#b8262c', '#24402e', '#1c1c1e'], toc: 'pickel', nota: 'Verde oscuro con vivos rojos; casco con pincho (modelo 1844), antes chacó (kíver).'},
    B: {c: ['#24402e', '#b8262c', '#24402e', '#24402e'], toc: 'kepi', nota: 'Verde oscuro; quepis (1862). Berdan (1868).'},
    C: {c: ['#24402e', '#b8262c', '#24402e', '#24402e'], toc: 'gorra_rusa', nota: 'Reforma de 1881: túnica verde oscuro y gorra sin visera; guerrera caqui verdoso desde 1907. Mosin-Nagant (1891).'},
    D: {c: ['#7a7650', '#6a6644', '#7a7650', '#7a7650'], toc: 'gorra_rusa', nota: 'Gimnastiorka caqui verdoso y gorra (furazhka); casco Adrian solo en algunas unidades (no modelado).'},
    rol: {caballeria: {A: {c: ['#24402e', '#d8b860', '#24402e', '#24402e'], toc: 'pickel', nota: 'Dragones / caballería: verde oscuro (aprox.).'}},
      estado_mayor: {A: {c: ['#24402e', '#d8b860', '#24402e', '#1c1c1e'], toc: 'bicornio', nota: 'Generales: bicornio con plumas hasta 1855.'}, B: {c: ['#24402e', '#d8b860', '#24402e', '#24402e'], toc: 'gorra', nota: 'Generales: gorra de plato.'}}}},
  TUR: {nombre: 'Imperio otomano', bandera: 'mono', veh: '#7c7448', f: ['#c81e2a', '#f2f0ea', '#c81e2a'],
    A: {c: ['#26305a', '#b8262c', '#26305a', '#b02020'], toc: 'fez', nota: 'Uniforme a la europea de la reforma de Mahmud II (1826+): azul oscuro con fez rojo.'},
    B: {c: ['#26305a', '#b8262c', '#26305a', '#b02020'], toc: 'fez', nota: 'Azul oscuro, fez. Snider y Martini-Peabody (1872).'},
    C: {c: ['#26305a', '#b8262c', '#26305a', '#b02020'], toc: 'fez', nota: 'Azul oscuro, fez; Mauser 1890/1903. Caqui desde 1909.'},
    D: {c: ['#7c7448', '#6a6440', '#7c7448', '#7c7448'], toc: 'kabalak', nota: 'Caqui oliva (1909), tocado kabalak («Enveriye»).'}},
  USA: {nombre: 'Estados Unidos', bandera: 'usa', veh: '#6a6a40', f: ['#b22234', '#f2f0ea', '#3c3b6e'],
    A: {c: ['#2a3458', '#f2f0e6', '#8aa6c8', '#2a3458'], toc: 'chaco', nota: 'Casaca azul oscuro, pantalón azul celeste; chacó (1832–51) o gorra de faena (aprox.).'},
    B: {c: ['#2a3458', '#f2f0e6', '#8aa6c8', '#2a3458'], toc: 'kepi', nota: 'Unión: blusa azul oscuro (sack coat), pantalón azul celeste, quepis (forage cap). Springfield 1861.'},
    C: {c: ['#2a3458', '#d8b860', '#8aa6c8', '#6a5a40'], toc: 'sombrero', nota: 'Blusa azul oscuro (hasta 1902) y sombrero de campaña; caqui desde 1898 (no modelado). Krag-Jørgensen (1892).'},
    D: {c: ['#6b6438', '#5a5430', '#6b6438', '#6a6a40'], toc: 'brodie', nota: 'Pardo oliva (olive drab), casco M1917 (derivado del Brodie). Springfield M1903.'}},
  CSA: {nombre: 'Estados Confederados', bandera: 'aspa', veh: '#6a6a40', f: ['#b22234', '#2a3c78', '#f2f0ea'],
    B: {c: ['#8c8c84', '#e8e4d8', '#8aa6c8', '#8c8c84'], toc: 'kepi', nota: 'Gris cadete (y «butternut» pardo en la práctica), quepis. Solo 1861–1865.'}},
  ESP: {nombre: 'España', bandera: 'horiz', veh: '#6a6a48', f: ['#aa151b', '#f1bf00', '#aa151b'],
    A: {c: ['#1e2848', '#b8262c', '#8a9098', '#1e2848'], toc: 'chaco', nota: 'Levita azul turquí, pantalón gris celeste; chacó/ros (aprox.).'},
    B: {c: ['#1e2848', '#b8262c', '#b8262c', '#1e2848'], toc: 'chaco', nota: 'Azul turquí y pantalón rojo (hacia 1860), ros. Remington (1871).'},
    C: {c: ['#9aa4b0', '#b8262c', '#9aa4b0', '#d8c890'], toc: 'sombrero', nota: 'Rayadillo (lienzo a rayas azul y blanco) con sombrero de jipijapa en Cuba y Filipinas; en la Península, azul turquí y pantalón rojo (no modelado). Mauser 1893.'},
    D: {c: ['#7a7450', '#6a6440', '#7a7450', '#7a7450'], toc: 'gorra', nota: 'Caqui verdoso (1926), gorra; casco Modelo 1926 (aprox.: se usa la gorra).'}},
  ITA: {nombre: 'Italia (Cerdeña-Piamonte)', bandera: 'vert', veh: '#6e6e50', f: ['#008c45', '#f2f0ea', '#cd212a'],
    A: {c: ['#1e2a4a', '#b8262c', '#7c8aa0', '#1e2a4a'], toc: 'chaco', nota: 'Cerdeña-Piamonte: azul oscuro, pantalón gris azulado; chacó (aprox.).'},
    B: {c: ['#1e2a4a', '#b8262c', '#7c8aa0', '#1e2a4a'], toc: 'kepi', nota: 'Azul oscuro y pantalón gris azulado, quepis. Vetterli (1870).'},
    C: {c: ['#1e2a4a', '#b8262c', '#7c8aa0', '#1e2a4a'], toc: 'kepi', nota: 'Igual; Carcano (1891).'},
    D: {c: ['#7a7c62', '#6a6c54', '#7a7c62', '#6c6e58'], toc: 'adrian', nota: 'Gris verde (grigio-verde, 1909), casco Adrian italiano M1916.'},
    rol: {ligera: {A: {c: ['#1e2a4a', '#b8262c', '#1e2a4a', '#1c1c1e'], toc: 'bersagliere', nota: 'Bersaglieri: sombrero redondo con plumas de gallo.'}, B: {c: ['#1e2a4a', '#b8262c', '#1e2a4a', '#1c1c1e'], toc: 'bersagliere', nota: 'Bersaglieri.'}, C: {c: ['#1e2a4a', '#b8262c', '#1e2a4a', '#1c1c1e'], toc: 'bersagliere', nota: 'Bersaglieri.'}}}},
  JPN: {nombre: 'Japón', bandera: 'disco', veh: '#6e6a48', f: ['#f2f0ea', '#bc002d', '#f2f0ea'],
    A: {c: ['#1e2238', '#b8262c', '#1e2238', '#1e2238'], toc: 'kepi', nota: 'Aprox.: antes de 1868 no hay ejército de estilo europeo; se usa el uniforme de 1870.'},
    B: {c: ['#1e2238', '#b8262c', '#1e2238', '#1e2238'], toc: 'kepi', nota: 'Ejército imperial (1871): azul oscuro a la francesa, quepis. Murata (1880).'},
    C: {c: ['#1e2238', '#b8262c', '#1e2238', '#1e2238'], toc: 'gorra', nota: 'Azul oscuro y gorra con banda roja; caqui desde 1905 (no modelado). Arisaka (1897).'},
    D: {c: ['#7a6e48', '#b8262c', '#7a6e48', '#7a6e48'], toc: 'gorra', nota: 'Pardo caqui (1905/1930) y gorra con estrella; casco Tipo 90 (1930, no modelado).'}},
  CHN: {nombre: 'China (Qing / República)', bandera: 'mono', veh: '#6a6e5a', f: ['#f0c020', '#2a4a9a', '#c81e2a'],
    A: {c: ['#2a3048', '#b8262c', '#2a3048', '#c8b070'], toc: 'qing', nota: 'Estandarte Verde / Ocho Banderas: chaqueta con parche circular, color según la bandera; sombrero cónico. Aprox.'},
    B: {c: ['#2a3048', '#b8262c', '#2a3048', '#c8b070'], toc: 'qing', nota: 'Igual (aprox.); fusiles importados.'},
    C: {c: ['#2a3048', '#b8262c', '#2a3048', '#2a3048'], toc: 'gorra', nota: 'Nuevo Ejército (1905): azul oscuro de estilo occidental con gorra.'},
    D: {c: ['#6a7480', '#5a6470', '#6a7480', '#6a7480'], toc: 'gorra', nota: 'República (1912+): gris azulado; casco M35 alemán desde 1935 (no modelado).'}},
  SWE: {nombre: 'Suecia', bandera: 'cruz', veh: '#6e7464', f: ['#006aa7', '#fecc00', '#006aa7'],
    A: {c: ['#1e2a50', '#e0b830', '#1e2a50', '#1c1c1e'], toc: 'chaco', nota: 'Azul oscuro con vivos amarillos; casco de cuero m/1845 (aprox.: chacó).'},
    B: {c: ['#1e2a50', '#e0b830', '#1e2a50', '#1e2a50'], toc: 'kepi', nota: 'Azul oscuro, quepis (m/1854–m/1886).'},
    C: {c: ['#1e2a50', '#e0b830', '#1e2a50', '#1e2a50'], toc: 'kepi', nota: 'm/1886 azul oscuro. Mauser m/1896.'},
    D: {c: ['#6e7464', '#5e6454', '#6e7464', '#5e6454'], toc: 'stahl', nota: 'Gris de campaña m/1910; casco m/1926 (aprox.: Stahlhelm).'}},
  DEN: {nombre: 'Dinamarca', bandera: 'cruz', veh: '#747a74', f: ['#c8102e', '#f2f0ea', '#c8102e'],
    A: {c: ['#232c48', '#b8262c', '#8ea4c4', '#232c48'], toc: 'kepi', nota: 'Desde 1848: guerrera azul oscuro, pantalón azul celeste, quepis. Antes de 1848, casaca roja (no modelado).'},
    B: {c: ['#232c48', '#b8262c', '#8ea4c4', '#232c48'], toc: 'kepi', nota: 'Igual (guerra de 1864).'},
    C: {c: ['#232c48', '#b8262c', '#8ea4c4', '#232c48'], toc: 'kepi', nota: 'Igual; Krag-Jørgensen (1889).'},
    D: {c: ['#747a74', '#646a64', '#747a74', '#646a64'], toc: 'gorra', nota: 'Gris (1915/1923) y gorra; casco M1923 (no modelado).'}},
  GEN: {nombre: 'Genérico teñible', bandera: 'horiz', veh: '#6a6c52', f: ['#8a3a2a', '#e8e0c8', '#2a4a7a'],
    A: {c: ['#5a6a3a', '#d8c890', '#4a4a50', '#1c1c1e'], toc: 'chaco', nota: 'Teñible: el principal es el color del país.'},
    B: {c: ['#5a6a3a', '#d8c890', '#4a4a50', '#5a6a3a'], toc: 'kepi', nota: 'Teñible.'},
    C: {c: ['#5a6a3a', '#d8c890', '#4a4a50', '#1c1c1e'], toc: 'pickel', nota: 'Teñible.'},
    D: {c: ['#6a6448', '#5a5440', '#646046', '#5e5c46'], toc: 'stahl', nota: 'Teñible.'}}
};
function eraOf(obj, era) {                          // la época pedida o la más cercana definida
  if (!obj) return null; if (obj[era]) return obj[era];
  const i = TROOP_ERAS.indexOf(era); for (let d = 1; d < 5; d++) { const a = TROOP_ERAS[i - d], b = TROOP_ERAS[i + d]; if (a && obj[a]) return obj[a]; if (b && obj[b]) return obj[b]; }
  return null;
}
// uniformPalette(nación, época, papel) → {main, trim, accessory, hat, flag, headgear, vehicle, note}
function uniformPalette(nation, era, rol) {
  const n = NACIONES[nation] || NACIONES.GEN, base = eraOf(n, era) || eraOf(NACIONES.GEN, era);
  const R = rol && rol !== 'linea' && n.rol && n.rol[rol];
  // un papel usa su época o la más cercana anterior a D; en D (caqui/gris de campaña) solo si la define: todos visten como la línea
  const r = R ? (R[era] || (era < 'D' ? eraOf({A: R.A, B: R.B, C: R.C}, era) : null)) : null;
  const e = r || base;
  const mk = e.marca || n.marca || {tipo: 'ninguna', c: ['#1c1c1c', '#e8e4d8', '#b02020']}, veh = e.veh || n.veh || '#6a6c52';
  return {main: e.c[0], trim: e.c[1], accessory: e.c[2], hat: e.c[3], flag: (e.f || n.f).slice(), flagLayout: e.bandera || n.bandera, headgear: e.toc, vehicle: veh, vehicle2: e.veh2 || veh, mark: mk.c.slice(), markType: mk.tipo, modelo: e.modelo || {}, note: e.nota || ''};
}
