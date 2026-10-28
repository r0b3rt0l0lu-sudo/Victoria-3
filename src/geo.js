/* ===== GEOGRAFÍA: contornos aproximados del mundo (lon, lat) ===== */
const MAP_W = 2048, MAP_H = 820, LAT_TOP = 84, LAT_BOT = -60;

const LAND_POLYS = [
// Eurasia + Arabia + Anatolia + Escandinavia + Península Ibérica + Italia + Grecia
[-5.5,36,-9,37,-9.5,39,-8.8,42,-9.3,43,-2,43.5,-1.3,46,-4.7,48.4,-1.8,48.6,-1.2,49.7,1.5,50.2,2.5,51.1,4,51.8,4.8,53,7,53.5,8.5,54,8.7,55.5,8.2,57,10.5,57.7,10.3,56,9.8,55,10.8,54.3,12.5,54.3,14,53.9,18,54.8,19.8,54.5,21,55.3,21,56.8,23,57,24,57.3,24.4,58.4,23.5,59.3,28,59.5,30,59.9,27,60.5,23,59.9,22,60.5,21.5,61.5,21.3,63,23,64,25,65,24.7,65.8,22,65.5,21,64.6,18.5,63,17.3,61.5,17.2,60.7,18.5,60,19,59.5,18.2,59,16.7,57.5,16.2,56.2,14.5,56,13,55.4,12.7,56.5,11.8,57.7,11,59,10.5,59.5,9,58.8,7,58,5.7,59,5,60.5,5,62,7,63,10,64,12.5,66,14,68,16,69.2,19,70,23,70.9,28,71,31,70,33,69.4,41,67,40,66,34.5,66.5,32,65,35,64,37,64.5,37.5,66,40.5,64.5,44,66,44,68,53,68.5,59,69,66,69.5,68,71,72,72.8,80,72,87,74,100,77,105,78,113,74,128,72,140,72.5,150,71,160,70,170,70,180,69,180,65.5,176,64.8,179,62.5,171,60,164,59.8,163,57.5,162,55,156.7,50.9,156,53,156,57.3,160,61,154,59.3,150,59.3,143,59,137,54,141,53,141.5,50,140.5,48,138,46,135,43.5,132,43,130,42.5,129.5,41,128.5,39,129.5,35.5,126.5,34.5,126,37,125,39.5,122,40,121,38.8,122,37,119,37,118,38.5,121,40.5,120.5,36,122,31,121.5,30,120,27,117,23.5,113,22,110.5,21,108,21.5,106.5,20,105.8,19,107.5,16,109,12,105,8.7,104.8,10.5,100.5,13.5,100,12,99.2,9,100.5,7,101.5,3,103.5,1.5,104.2,1.4,101,3,98.5,8,98.5,12,97.5,16.5,94.5,16.5,94,19,92,21,91,22.5,90,22,87,21,86.5,19.8,82,16.5,80,15,80.3,13,79.5,10,78,8.5,77,8,76,10,74.8,13,73,17.5,72.8,21,70,21,68.5,23.5,66.5,25.3,62,25,57,25.7,56.5,27,54,26.7,51,27.8,49,30.2,48,30,48.6,28,50,26,50.8,24.5,51.5,24.2,54,24,56,26,56.5,24.5,58.5,23.5,59.8,22.5,57.5,19,55,17,52,16,45,13,43.2,12.8,43,15,42.7,17,40,21,38.5,24,36,28,34.8,29.5,34.9,31.3,35.5,33.5,36,35,36,36.5,34,36.2,32,36.2,30.5,36.6,28,36.7,27,37.5,26.5,39.5,26,40.5,26.4,40.2,24,40.8,23.5,40,24,38,23,36.5,21.5,37,21,39,19.5,40.5,19.4,42,18.5,42.5,16,43.5,14.5,45,13.7,45.6,12.3,45.3,12.5,44,14,42.5,16,41.8,16.5,41,18.5,40.2,17,39,16.5,38,15.7,38,16,39.5,15,40.2,12.5,41.5,11,42.5,10.2,43.9,8.8,44.3,7.4,43.8,4,43.4,3,42.4,3,41.8,0.8,41,-0.3,39.4,0,38.7,-1,37.5,-2.2,36.7,-4.5,36.7],
// África
[-5.5,35.9,-2,35.1,3,36.8,10,37.2,11,35.5,10,33.5,11.5,33,15,32.3,20,31,20,32.7,23,32.7,25,31.7,29,31,32.3,31.2,34.2,31.3,34.9,29.5,33.5,28,32.5,29.8,33.5,27,35.5,24,37,21,38.5,18,39.5,15.5,41.5,13.5,43.2,11.8,44,10.5,51.2,11.8,51,10.3,48.5,5,46,2,42,-1,40,-3,39,-5,39.5,-8.5,40.5,-11,40.5,-15,37,-18,35,-20,35.5,-24,33,-26,32.8,-28.5,30,-31.5,27,-33.5,25,-34,22,-34.2,20,-34.8,18.4,-34,18,-31,16.5,-28.5,15,-26,14.5,-22,12,-17.5,13.5,-12,12.3,-6,9.5,-1,9.5,3,8.5,4.5,6,4.3,4.5,6.3,2,6.3,-2,4.8,-4.5,5.2,-7.5,4.4,-11,6.8,-13.5,9.5,-15,11,-17,13.5,-16.5,16,-16.2,20,-17,21,-15,24,-13,27.5,-10,29.5,-9.5,32,-6.5,34],
// Madagascar
[49.3,-12,50.5,-15.5,49.5,-18,47.5,-24.5,45,-25.5,43.5,-22,44.3,-17,46,-15.8,48,-13.8],
// América del Norte + Central
[-168,66,-166,68.5,-156,71.3,-141,69.7,-128,70,-115,68,-108,68,-95,68,-88,68,-82,69.5,-81,66,-86,66,-87,64,-93,61,-94.5,59,-92,57,-85,55.2,-82,52.9,-80,51.5,-79,54.5,-77,56.5,-78,60,-77.5,62.4,-72,61.5,-70,59,-65,60.3,-62,57,-60,55.5,-56,52.5,-59,50.2,-66,50.2,-71,47,-66,49,-64,48.8,-65,47,-61,45.7,-66,43.7,-70,43.8,-70.5,42,-74,40.5,-76,38.5,-75.7,35.5,-79,33.5,-81,31.5,-81.2,29,-80,26.8,-80.3,25.2,-81.7,26,-82.8,28,-83.5,29.8,-85.5,29.7,-89,30.2,-89.5,29,-92,29.6,-94.7,29.3,-97.2,27.5,-97.5,24,-97.8,22,-96.2,19,-94.5,18.2,-91.5,18.5,-90.5,21,-87,21.5,-87.5,18.5,-88.2,16,-84,15.8,-83.2,14.8,-83.7,11,-82.5,9.5,-79.5,9.5,-77.5,8.5,-77.3,7.7,-80,7.3,-81,8.2,-83.5,8.4,-85.8,10,-87.5,13,-91.5,14,-94,16,-96,15.7,-101,17.5,-105.5,20,-105.5,22.5,-109,25.5,-112.5,29.5,-114.7,31.8,-114.8,32.5,-117,32.5,-118.5,34,-120.6,34.6,-122.4,37.5,-124,40.3,-124.5,43,-124,46.3,-124.7,48.4,-123,49,-127,51,-130.5,54.5,-133,57,-136,58.5,-140,59.8,-147,60.8,-151,59.2,-153,57.5,-158,56.5,-163,54.7,-158,58.5,-162,59.8,-165,61,-165.5,62.5,-161,63.5,-166,64.5,-168,65.7],
// América del Sur
[-77.3,7.7,-75.5,10.5,-72,12,-71,11,-68,10.5,-64,10.7,-61,10.5,-60,8.5,-57,6,-53,5.5,-51,4.5,-50,1.5,-48,-1,-44.5,-2.5,-40,-2.8,-35,-5.5,-35,-8.5,-37.5,-12,-39,-17,-40,-20,-41.5,-22.5,-44,-23,-48.5,-26,-48.8,-28.5,-52,-32,-53.5,-34,-56,-34.9,-58,-34.5,-57,-37,-62,-39,-65,-41,-63.5,-42.5,-65.5,-45,-67.5,-46.5,-65.8,-48,-69,-51,-68.5,-52.5,-71,-54,-74,-52,-75.5,-47,-73.5,-42,-73.5,-37,-71.5,-30,-70.5,-18.5,-76,-14,-79,-8,-81,-5,-80,-2,-80,0,-78.8,1.8,-77.5,4],
// Groenlandia
[-73,78,-60,82,-30,83.5,-20,80,-18,76,-22,70,-32,68,-42,60,-48,61,-53,66,-55,70,-68,76.5],
// Islas del Ártico canadiense
[-80,73.5,-68,70,-62,66.5,-66,62.5,-72,64,-78,65,-72,68.5,-80,70,-90,72,-85,73.5],
[-118,71,-103,69,-101,73,-115,73.5],
[-100,76,-90,76.5,-88,79,-105,79],
// Terranova
[-59,47.5,-53,46.7,-52.7,47.8,-55,51.5,-58,49.5],
// Nueva Zembla
[52,71,58,70.5,68,76.5,60,76.5,52,73],
// Chukotka oeste
[-180,69,-175,67.5,-170,66,-171,64.5,-180,65],
// Gran Bretaña
[-5.5,50,-3,50.6,1.3,51,1.7,52.7,0,53.4,-1.5,55,-2,56,-3,57.5,-1.8,57.6,-4,58.6,-5.5,58.6,-6,57,-5.5,56,-5,55,-3,54.8,-3.2,54,-4.5,53.3,-4.2,52.5,-5.2,51.8,-3.2,51.4,-5,50.2],
// Irlanda
[-10,51.8,-6,52,-6,54,-5.7,54.8,-7.5,55.2,-10,54.2,-9.5,53],
// Islandia
[-24,65.5,-22,66.4,-15,66.4,-13.5,65,-18,63.4,-22.5,63.8],
// Sicilia, Cerdeña, Córcega, Creta, Chipre
[12.4,38,15.6,38.2,15.2,36.7,12.5,37.7],
[8.2,41,9.7,41,9.6,39,8.5,39],
[8.6,43,9.5,43,9.4,41.4,8.7,41.5],
[23.5,35.5,26.3,35.3,24,35],
[32.3,35,34.5,35.6,33.8,34.8],
// Japón
[130.8,33.9,133,35.5,136,36,137,37.5,139.5,38.5,140.5,41.2,141.8,40.5,142,38,140.8,35.7,138.5,34.6,136.8,34.5,135,33.5,133,34.3],
[140,41.8,141.5,45.3,145.5,43.5,143,42,141,42],
[129.7,33,130.8,34,131.8,33,131,31.2,130.2,31.5],
[132.5,33.8,134.5,34,134,33,132.8,32.8],
// Sajalín
[142,46,143.5,46.5,143,49,143.5,52,142.2,54,141.8,50,142,47],
// Taiwán, Hainan
[120.2,22.5,121,25,122,25,121.5,22],
[108.7,19.2,110.5,20,111,19,109.5,18.2],
// Filipinas
[120,18.4,122.2,18.5,122,14,124,13,121,13.5,120,15],
[122,7,126.5,8,125.5,6,123,7],
[122.5,10,124.8,11,125.5,9.5,123,9.2],
// Sri Lanka
[79.8,9.5,81.7,7.5,80.5,6,80,7],
// Indonesia
[95.3,5.6,98,4,104,-1,106,-5.8,104.5,-5.8,101,-2.5,96,3],
[105.2,-6.8,108,-6.2,114.5,-7.8,114,-8.7,106,-7.5],
[109,1.5,111,1.8,113,3.3,117,7,119,5,117.5,1,116,-4,113,-3.5,110,-3],
[119,0,121.5,1,125,1.5,123,-0.5,122,-4.5,121,-3,120,-5.5,119,-3],
[131,-1,135,-3.3,138,-1.8,145,-4.5,147.5,-6,150,-10.5,143.5,-9,141,-9.2,138,-8.3,137,-5,133,-4,132,-2.5],
[115,-8.5,116.5,-8.4,116,-9],
// Australia, Tasmania, Nueva Zelanda
[113.5,-22,114,-26,115,-34,118,-35,123,-34,129,-31.7,131.5,-31.5,135,-34.5,138,-35,140,-38,144,-38.5,147,-38,150,-37,152,-32,153.5,-28,153,-25,150,-22.5,146,-19,145.5,-15,143.5,-14,142.5,-10.8,141.5,-13,141,-17,139,-17.5,136.5,-15.5,135.5,-12,132,-11.2,130,-13,127,-14,125,-15,122,-17.5,120,-19.5,116,-20.8],
[144.7,-40.7,148.3,-40.9,147.8,-43.2,146,-43.5],
[172.7,-34.5,175.5,-37,178.5,-37.7,177,-39.5,175,-41.5,174.5,-39.5,173.8,-36.5],
[172.5,-40.5,174.2,-41.5,173,-43.8,171,-44.5,168,-46.6,166.5,-45.8,170.5,-43,171.5,-41.8],
// Caribe
[-85,21.9,-82,23.1,-80,23,-74.2,20.2,-77.5,19.9,-79.5,21.5,-82,22.3],
[-74.4,18.5,-72.5,19.9,-68.4,18.6,-71.5,17.6,-74.4,18],
[-78.3,18.4,-76.3,18.2,-77.2,17.8],
[-67.2,18.5,-65.7,18.4,-66,17.9,-67.2,18],
// Hawái
[-156,20.2,-155,19.5,-155.8,18.9,-156.2,19.6],
// Mar de Okhotsk: Kuriles omitidas
];

// Mares interiores que se tallan de la masa continental
const SEA_POLYS = [
// Mar Negro
[28,41.2,28.7,43.5,29.8,45.2,31,46.5,33.5,46.1,32.7,45.3,34.5,44.5,36,45.2,35.2,45.3,37,46.2,38.3,46.8,39.5,46.3,38,45.3,37.5,44.5,39.8,43.5,41.7,42,41.5,41.2,37,41,33,42,30,41.2],
// Mar Caspio
[47,45,49,46.5,51,47,53,46.8,53.5,45,51,44.5,50.3,42,52.8,41.2,53,39.5,54,37.5,51,36.8,49,37.7,49,39.5,48.5,41,47.5,43],
// Mar Aral
[58,46.5,61,46.5,61.5,44,59.5,43.5,58,44.5],
// Mar Blanco
[34,64.5,37,65.5,40,66.2,41,65,38,64.2,35,64],
// Golfo de Botnia interior ya excluido; Mar Rojo estrecho ya implícito
];

// Cordilleras: [puntos, radio, altura]
const MOUNTAINS = [
[[6.5,45.5,9,46.5,12.5,47,15,47],1.7,3.6],
[[-1.8,43,3,42.6],1.0,3.0],
[[18,49.3,22.5,49.2,25,47.8,26,46,24,45.5,22.5,45.3],1.4,2.5],
[[60,68,59,60,58,55,60,51],1.3,2.0],
[[38,44,44,42.7,47,41.8],1.2,3.6],
[[73,35.5,80,31.5,88,28,95,28.5,98,27.5],2.0,6.0],
[[69,36,73,36.5,77,35.5],2.0,5.0],
[[70,42,80,42,88,43.5],1.6,4.0],
[[86,50,92,50],1.5,3.0],
[[46,35,50,31,55,27.5],1.5,3.0],
[[30,37,37,37.5,42,38],1.2,2.5],
[[-110,60,-115,52,-111,45,-108,38,-106,33],2.2,3.5],
[[-122,48,-122,42,-119,37],1.2,3.0],
[[-108,30,-105,24,-100,18],1.5,3.0],
[[-84,35,-79,38,-75,41,-71,44],1.3,1.8],
[[-72,10,-76,3,-78,-3,-77,-8,-75,-13,-70,-18,-69,-25,-70,-33,-72,-40,-73,-50],1.5,4.8],
[[-8,31,-4,33.5,3,35,8,35.8],1.1,2.5],
[[29,-30,28,-26],1.0,2.5],
[[145,-14,148,-24,150,-33,147,-37],1.2,1.8],
[[6,59,8,62,13,66,18,68.5],1.5,2.8],
[[-5,57,-4,56.6],1.0,1.8],
[[73.5,20,75,12,77,8.5],0.7,1.5],
[[137,36,139,38],1.0,2.0],
[[98,26,104,28],1.5,3.0],
[[98,52,110,53,120,53],1.3,2.0],
[[130,66,140,62],1.2,2.0],
[[-50,66,-45,70,-30,70],2.0,3.0],
[[-45,-20,-42,-15],2.0,1.4],
[[8,46,10,47],1.0,2.0]
];
// Elipses de relieve elevado: [lon, lat, rx, ry, altura]
const PLATEAUS = [
[88,33,10,4,3.2],[39,9,4,3,2.6],[35,0,3,5,1.6],[-105,40,4,6,1.2],[-68,-18,3,6,2.6],[100,38,6,3,1.4],[52,33,4,4,1.2],[34,38,5,2,1.2],[108,46,6,2,0.8]
];
// Desiertos: [lon, lat, rx, ry]
const DESERTS = [
[10,24,28,7],[-6,22,12,6],[47,23,9,7],[56,32,6,4],[105,42,13,4],[84,39,6,3],[71,27,3,3],[132,-25,14,8],[22,-24,6,4],[-112,34,5,4],[-70,-22,2,5],[34,23,7,3],[63,28,5,3],[16,-22,2,4],[45,15,3,3],[-107,29,4,3]
];
// Estepa/pradera seca
const STEPPES = [
[65,48,16,5],[-100,40,8,8],[105,47,12,3],[-62,-34,6,6],[0,13,24,3],[40,2,6,3],[25,-14,8,3],[78,18,5,4],[28,-27,6,3],[145,-30,8,6],[-70,-45,3,6],[35,48,10,3],[-115,52,5,3]
];
// Selvas
const JUNGLES = [
[-62,-4,12,6],[22,0,9,6],[110,2,10,5],[-76,4,3,4],[-85,12,5,3],[8,5,5,2],[96,22,4,6],[105,15,5,5],[145,-6,6,3],[50,-18,2,5],[-47,-15,3,4],[78,10,2,3],[-90,17,3,2]
];

/* ===== BIENES Y DATOS DE ESTADOS ===== */
// tokens: c#=carbón i#=hierro u#=fibras U#=azúcar T#=té C#=café B#=tabaco F#=fruta w#=madera f#=pesca m#=ganado g#=grano
const STATE_DATA = `
Inglaterra del Sur|-1.2|51.3|GBR|5200|g2
Midlands|-1.7|52.6|GBR|3600|c8 i6
Norte de Inglaterra|-2.2|53.7|GBR|4000|c10 u6
Gales|-3.7|52.3|GBR|1100|c5 i4 m2
Escocia|-4.2|56.3|GBR|2600|c5 i3 f2
Leinster|-6.8|53.2|GBR|2200|g2 m2
Munster y Connacht|-9|52.8|GBR|2700|m3 f1
Canadá Oriental|-72|46.5|GBR|1000|w4 f2
Canadá Occidental|-80|44.5|GBR|450|g3 w2
Nueva Escocia|-63|45.8|GBR|300|f3 w2
Tierras de la Bahía de Hudson|-96|55|GBR|100|w2
Columbia Británica|-124|54|GBR|50|w3 f1
Jamaica|-77.3|18.1|GBR|400|U4
Guayana Británica|-58.5|5|GBR|100|U2
Bengala|88|23.5|GBR|40000|g6 T2 u3
Bihar y Awadh|83.5|26|GBR|35000|g6 u3
Bombay|73.8|19.5|GBR|15000|u4 f1
Madrás|79.5|13|GBR|15000|g3 u2
Orissa y Nagpur|80.5|21|GBR|9000|g2 c2 i1
Mysore|76.5|13.5|GBR|3000|C2
Ceilán|80.7|7.5|GBR|1200|T4
Malaca y Singapur|102.2|3.5|GBR|300|f1
Nueva Gales del Sur|149|-33|GBR|100|m4
Victoria|144.5|-36.7|GBR|10|m2
Australia Occidental|118|-30|GBR|3|m1
Tasmania|146.5|-42|GBR|70|m2
Colonia del Cabo|21.5|-33.2|GBR|200|m2
Isla de Francia|2.3|48.8|FRA|5000|g3
Normandía y Bretaña|-1.5|48.5|FRA|5000|g2 f2
Aquitania|0|44.5|FRA|6000|g3 F2
Provenza y Languedoc|4|43.7|FRA|5500|F3
Lorena y Alsacia|6.5|48.5|FRA|3500|c2 i4
Flandes Francés|2.8|50.3|FRA|3000|c5 u2
Lyon y Borgoña|4.8|46.2|FRA|4000|g2
Argelia|3|35.5|FRA|2500|g2 m2
Córcega|9|42|FRA|200|m1
Prusia Oriental|20.5|54.2|PRU|2300|g3
Brandeburgo|13.4|52.5|PRU|2700|g2
Pomerania|16|53.8|PRU|1500|g2 f1
Silesia|17|51|PRU|2800|c5 i4 u2
Posen|17.2|52.3|PRU|1200|g3
Sajonia Prusiana|11.8|51.9|PRU|1700|g3
Westfalia|7.5|51.4|PRU|3500|c8 i5
Renania|7|50.2|PRU|2400|c3 F1
Baviera|11.5|48.6|BAV|4200|g3 m2
Sajonia|13.5|51|SAX|1700|c2 u3
Hannover|9.7|52.6|HAN|1600|g2 i1
Wurtemberg|9.2|48.6|WUR|1600|g2
Baden|8.2|48.5|BAD|1300|F1
Hesse|9|50.6|HES|1500|g1
Mecklemburgo|11.8|53.7|MEC|600|g2 f1
Holstein|9.7|54.2|DEN|800|g2 m2
Austria|15.5|48.2|AUS|2400|g2
Bohemia|15|49.8|AUS|4300|c4 i2 u3
Moravia|17.4|49.4|AUS|2000|c2 g2
Galitzia|22.5|49.8|AUS|4500|g3 i1
Hungría|19.5|47.2|AUS|6000|g6 m3
Transilvania|24|46|AUS|2000|w3 i2
Croacia|16.5|45.5|AUS|1500|g2
Tirol|11.5|46.8|AUS|800|m2 w2
Estiria|15|46.8|AUS|1700|i3 w2
Lombardía-Venecia|10.5|45.4|AUS|4500|g4 u2
Dalmacia|16.2|43.8|AUS|400|f2
Moscú|37.6|55.8|RUS|5000|g4 w3
San Petersburgo|30.3|59.9|RUS|1800|w3 f1
Livonia y Estonia|25|57.5|RUS|1700|g2 f2
Polonia del Congreso|21|52.2|RUS|4000|g3
Lituania y Bielorrusia|26|54|RUS|4500|g3 w3
Ucrania Occidental|30|50.4|RUS|4500|g6
Ucrania Oriental|36|49.5|RUS|3500|g5 c3
Nueva Rusia|31.5|46.7|RUS|1500|g4
Don y Kuban|40|47|RUS|1500|g3 m3
Volga Medio|47|54.5|RUS|3500|g4
Cáucaso Norte|44|43|RUS|2500|m3
Georgia|44.5|41.7|RUS|900|F2
Finlandia|26|62|RUS|1400|w5 f1
Arcángel|42|63.5|RUS|800|w4 f2
Urales|58.5|57|RUS|2500|i5 w3 c1
Siberia Occidental|73|57|RUS|1500|w3 m2
Siberia Central|93|57|RUS|800|w4
Yakutia|125|62|RUS|300|w2
Extremo Oriente Ruso|135|50|RUS|100|w3 f2
Kamchatka|160|56|RUS|20|f2
Alaska Rusa|-150|62|RUS|50|f1
Constantinopla|28.7|41.2|OTT|1800|g2 f1
Anatolia Occidental|30|38.8|OTT|3500|g3 F2
Anatolia Oriental|39|39.2|OTT|2500|m3 i1
Siria|37|35.5|OTT|2500|g2 F2
Mesopotamia|44|34|OTT|1200|g2
Palestina|35.2|31.8|OTT|700|F2
Macedonia|21.8|41.3|OTT|1500|g2
Bulgaria|25|42.7|OTT|2000|g3
Bosnia|18|44|OTT|900|m2
Libia|15|31.5|OTT|800|m1
Hiyaz|39.5|22|EGY|800|m1
Egipto|31|29.5|EGY|3500|g5 u3
Nubia|32.5|23|EGY|1500|g1
Sudán|31|14.5|EGY|2500|m3
Grecia|22.3|38.7|GRE|800|F3 f2
Serbia|20.8|44|SER|700|m2
Valaquia y Moldavia|26|45.3|WAL|3000|g4
Túnez|9.5|35.5|TUN|1000|F2
Marruecos|-6|33.5|MOR|4000|g3 m2
Madrid|-3.7|40.4|SPA|3000|g3 m2
Andalucía|-4.8|37.4|SPA|2500|F3 g2
Cataluña|1.5|41.7|SPA|1800|F1 u2
Galicia y Asturias|-7|42.8|SPA|1800|f3 c2 w2
Valencia|-0.8|39.2|SPA|1200|F3
Aragón y Navarra|-1.2|42|SPA|1200|g2
Cuba|-79.5|22|SPA|900|U6 B3
Puerto Rico|-66.5|18.2|SPA|400|U2 C1
Filipinas|121.5|15|SPA|3000|U3 B2
Portugal|-8|39.5|POR|3000|F2 f2
Angola|14|-9|POR|100|C1
Mozambique|35|-17|POR|200|m1
Suecia|15.5|58|SWE|2800|i3 w5
Suecia Norte|19.5|64.5|SWE|300|i4 w4
Noruega|9|60.5|SWE|800|w3 f4
Noruega Norte|18|69|SWE|150|f4
Dinamarca|10.5|56|DEN|1200|g4 m2
Islandia|-19|64.9|DEN|55|f3
Holanda|4.8|52.2|NET|1800|m3 f2
Java|110|-7.5|NET|6000|U5 C4
Sumatra Sur|103|-3|NET|1000|C2 T1
Bélgica|4.6|50.7|BEL|4000|c4 i3 u2
Suiza|8.2|46.9|SWI|2200|m3
Piamonte|7.7|45|SAR|3500|g3 F1
Cerdeña|9|40|SAR|500|m2
Nápoles|15|40.8|TWS|4500|g2 F3
Sicilia|14|37.6|TWS|2000|F3 g2
Estados Pontificios|12.5|42.5|PAP|3000|g2 F2
Toscana|11|43.6|TUS|1700|F2 i1
Nueva Inglaterra|-71.5|43|USA|2200|f4 w2
Nueva York|-75|42.7|USA|2500|g3 w2
Pensilvania|-77.5|40.5|USA|1800|c5 i3
Virginia y Carolinas|-79|36.5|USA|3500|B5 g2
Georgia y Florida|-83|31.5|USA|1500|u6 F1
Alabama y Misisipi|-88|33|USA|1000|u6
Luisiana|-91.5|31|USA|500|U3 u3
Tennessee y Kentucky|-86|37|USA|1800|B3 m2
Ohio e Indiana|-84.5|40|USA|2000|g5
Illinois y Misuri|-90|40.5|USA|1200|g4 m3
Grandes Llanuras|-100|42||300|m4
Territorio de Oregón|-121|45.5||100|w4 f2
Texas|-98|31|TEX|50|m3 u1
California|-120.5|36.5|MEX|40|m2
Nuevo México|-107|35|MEX|100|m2
Norte de México|-107|28.5|MEX|400|m2
Nuevo León|-99.5|25.5|MEX|400|m2
México Central|-99|19.5|MEX|4500|g3 c1
Jalisco|-103|21|MEX|1500|g2
Veracruz|-96.5|19|MEX|600|U2 B1
Oaxaca y Chiapas|-96.5|17|MEX|1200|C1
Yucatán|-89|20.5|MEX|500|u1
Guatemala|-90.5|15|CAM|700|C2
Honduras y Nicaragua|-85|13.5|CAM|600|m2
Costa Rica|-84|10|CAM|100|C2
Nueva Granada|-74|5|COL|1500|g1 C2
Venezuela|-66.5|8|VEN|900|C2 m3
Ecuador|-78.5|-1.5|ECU|600|F1
Perú|-75|-10|PER|1700|i1 m2
Bolivia|-65|-17|BOL|1000|i2
Chile|-71|-33|CHL|1000|g2 i1
Argentina|-62|-33|ARG|700|m6
Buenos Aires|-58.5|-35|ARG|200|m4
Paraguay|-58|-24|PAR|300|g1
Uruguay|-56|-33|URU|100|m3
Patagonia|-69|-45||50|m2
Nordeste Brasileño|-38|-8|BRZ|1500|U5
Bahía|-41|-13|BRZ|800|U2 C1
Minas Gerais|-44.5|-19|BRZ|800|i3
Río de Janeiro|-43|-22|BRZ|500|C4
São Paulo|-48.5|-23.5|BRZ|400|C3
Río Grande|-52|-29|BRZ|300|m5
Pará|-49|-3|BRZ|200|w3
Amazonas|-62|-4|BRZ|100|w3
Mato Grosso|-56|-14|BRZ|50|m3
Zhili|116.4|39.9|CHN|30000|g5
Shandong|118|36.5|CHN|28000|g5 c2
Henan|113.5|34|CHN|23000|g5
Shanxi|112.5|37.5|CHN|14000|c9 i3
Shaanxi y Gansu|106.5|35|CHN|18000|g3 m2
Jiangsu|119.5|32.5|CHN|30000|g5 u3
Zhejiang|120.2|29.5|CHN|25000|T3 g3
Anhui|117|31.5|CHN|20000|g4
Jiangxi|115.5|27.5|CHN|20000|T3 g3
Hubei|113|30.5|CHN|28000|g5 i1
Hunan|111.8|27.5|CHN|20000|g5 T1
Fujian|118|25.5|CHN|15000|T4 f2
Guangdong|113.5|23.2|CHN|20000|g4 f2 U2
Guangxi y Guizhou|107|25.5|CHN|13000|g2
Yunnan|101.5|25|CHN|7000|T2 i1
Sichuan|104.5|30.5|CHN|35000|g6
Liaoning|123|41.5|CHN|2000|c3 i2
Heilongjiang|127|46.5|CHN|1000|w3 g2
Mongolia|105|46|CHN|1500|m5
Xinjiang|86|42|CHN|1500|m3
Tíbet|88|31.5|CHN|1000|m2
Taiwán|121|23.8|CHN|2500|T2 U1
Corea del Norte|126.5|39.5|KOR|2500|i2
Corea del Sur|127.5|36|KOR|6000|g4 f2
Kanto|139.7|35.7|JAP|5000|g3 f2
Kansai|135.5|34.8|JAP|5000|g3
Chubu|137|36|JAP|4000|u3 T1
Tohoku|140.5|39|JAP|3000|g3 f2
Chugoku y Shikoku|133|34.3|JAP|4000|f2 g2
Kyushu|130.8|32.8|JAP|4000|c3 T1
Hokkaido|142.5|43.2|JAP|100|f4 w3
Siam|100.8|14.5|SIA|3500|g5
Laos|103|18|SIA|600|w2
Camboya|104.5|12.2||500|g2
Tonkín|105.8|21|VIE|4000|g4
Annam|108|15.8|VIE|3000|f2
Cochinchina|106.5|10.8|VIE|1500|g4
Birmania|96.2|19.5|BRM|3000|g4 w3
Assam|93.5|26.5|BRM|800|T2
Estados Malayos|102|5||1000|w3
Aceh|97|4.5||600|w2
Borneo|114|0.5||1000|w4
Sulawesi|120.5|-2||1500|w2
Nueva Guinea|140|-5||300|w3
Mindanao|124.5|7.5||500|w2
Nueva Zelanda Norte|175.5|-38||100|m3
Nueva Zelanda Sur|171|-44||20|m2
Teherán|51.4|35.7|PRS|2500|g2
Azerbaiyán|46.5|38|PRS|2000|g2 m3
Fars|52.5|30|PRS|1500|F2
Jorasán|59|36.5|PRS|1500|m2
Kermán|58|29|PRS|800|m1
Juzestán|49|31.5|PRS|600|g1
Kabul|69|34.5|AFG|2000|m3
Herat|62.5|34.3|AFG|800|g1
Kandahar|66|31.7|AFG|1000|m2
Baluchistán|65.5|28||500|m1
Sind|68.5|26||1000|g2 u2
Bujará|64.5|39.8|BUK|2500|g2 m2
Jiva|60.5|41.5|KHI|500|g1
Kokand|71|40.5|KOK|3000|g2
Turkmenia|59|38.5||500|m1
Estepa Kazaja|68|48||1500|m4
Punyab|74.5|31.5|SIK|4000|g5
Cachemira|75|34|SIK|1200|u2
Nepal|84|28|NEP|2000|g2
Rajputana|73.5|26.5||6000|g2 m2
Malwa|76.5|23.5||6000|g3 u2
Hyderabad|78.5|17.5|HYD|10000|g3 u3
Gujarat|72.5|22.5||5000|u3
Nejd|45|25||600|m1
Omán|57|23|OMA|500|f1
Yemen|44|15||1000|C2 g1
Zanzíbar|39.5|-6|OMA|400|U1
Sáhara|10|23||500|m1
Fezzán|13|27||200|m1
Senegambia|-15|14||2500|g2 f1
Malí|-5|13||4000|g2 m2
Costa de Oro|-1.5|7|ASH|2000|F1 w2
Dahomey y Oyo|3|8||3000|g2
Sokoto|7|12|SOK|8000|g3 u2
Bornu|14|12||3000|m2
Nigeria Sur|7|5.5||4000|F2 w2
Camerún|12|5||2000|w3
Congo|22|-3||5000|w5
Etiopía|39|9|ETH|8000|g4 m3 C2
Somalia|46|5||1000|m3
Darfur|25|13||1500|m2
Alto Nilo|33|3||2000|m2
Tanganica|34|-6||3000|g1 m2
Rodesia|30|-19||600|m2
Namibia y Botsuana|18|-23||300|m1
Zululandia|30.5|-28|ZUL|500|m3
Madagascar|47|-19|MDG|2500|g2 m2
Hawái|-156|19.8||100|f1
`.trim();

/* ===== PAÍSES ===== */
// tag: [nombre, adjetivo, color, bandera, gobierno, capital, alfabetización, industria(0-1), perfil de leyes, tesoro]
const COUNTRY_DATA = {
GBR:['Reino Unido','británico','#cf5b6c','ukj:#012169:#fff:#c8102e','Monarquía Constitucional','Inglaterra del Sur',52,1.0,'liberal',1500000],
FRA:['Francia','francés','#4a74c9','v3:#0055a4:#fff:#ef4135','Monarquía Constitucional','Isla de Francia',38,0.5,'liberal',900000],
PRU:['Prusia','prusiano','#55606e','h2:#111:#fff:#c00','Monarquía Absoluta','Brandeburgo',70,0.45,'absolute',600000],
AUS:['Austria','austriaco','#d9d6c4','h2:#e8e0c0:#111','Monarquía Absoluta','Austria',35,0.3,'absolute',500000],
RUS:['Rusia','ruso','#4f7f4f','h3:#fff:#0039a6:#d52b1e','Monarquía Absoluta','San Petersburgo',6,0.2,'serf',700000],
OTT:['Imperio Otomano','otomano','#4aa27a','disc:#c8102e:#fff','Despotismo Oriental','Constantinopla',3,0.1,'eastern',300000],
USA:['Estados Unidos','estadounidense','#4c6fb0','usa:#b22234:#fff:#3c3b6e','República','Pensilvania',75,0.4,'republic',500000],
SPA:['España','español','#e0a52d','h3:#aa151b:#f1bf00:#aa151b','Monarquía Constitucional','Madrid',20,0.2,'liberal',200000],
POR:['Portugal','portugués','#3f9467','v3:#046a38:#da291c:#da291c','Monarquía Constitucional','Portugal',15,0.15,'liberal',150000],
SWE:['Suecia-Noruega','sueco','#5b9fd1','cross:#006aa7:#fecc00:#fecc00','Monarquía Constitucional','Suecia',60,0.2,'liberal',200000],
DEN:['Dinamarca','danés','#b95555','cross:#c8102e:#fff:#fff','Monarquía Absoluta','Dinamarca',60,0.15,'absolute',150000],
NET:['Países Bajos','neerlandés','#e8913a','h3:#ae1c28:#fff:#21468b','Monarquía Constitucional','Holanda',60,0.4,'liberal',400000],
BEL:['Bélgica','belga','#c7ad3a','v3:#111:#fdda24:#ef3340','Monarquía Constitucional','Bélgica',50,0.8,'liberal',150000],
SWI:['Suiza','suizo','#b84040','cross2:#da291c:#fff','República','Suiza',65,0.4,'republic',100000],
SAR:['Cerdeña-Piamonte','sardo','#4778b8','v3:#009246:#fff:#ce2b37','Monarquía Absoluta','Piamonte',30,0.25,'absolute',100000],
TWS:['Dos Sicilias','napolitano','#8a68b8','h3:#fff:#f1bf00:#fff','Monarquía Absoluta','Nápoles',20,0.1,'absolute',100000],
PAP:['Estados Pontificios','pontificio','#e4cf62','v3:#f9d71c:#fff:#fff','Teocracia','Estados Pontificios',20,0.05,'theocracy',100000],
TUS:['Toscana','toscano','#b98466','h3:#fff:#c8102e:#fff','Monarquía Absoluta','Toscana',30,0.15,'absolute',50000],
BAV:['Baviera','bávaro','#6aa0d8','h2:#fff:#0098d4','Monarquía Constitucional','Baviera',50,0.15,'liberal',100000],
SAX:['Sajonia','sajón','#7fb08a','h2:#fff:#00793a','Monarquía Constitucional','Sajonia',60,0.35,'liberal',60000],
HAN:['Hannover','hannoveriano','#a8809a','h2:#fcd116:#c8102e','Monarquía Absoluta','Hannover',50,0.15,'absolute',60000],
WUR:['Wurtemberg','wurtemburgués','#c28a58','h2:#111:#c8102e','Monarquía Constitucional','Wurtemberg',55,0.15,'liberal',50000],
BAD:['Baden','badense','#d8b0a0','h3:#f6c800:#c8102e:#f6c800','Monarquía Constitucional','Baden',55,0.15,'liberal',40000],
HES:['Hesse','hessiano','#8a9ab8','h2:#fff:#c8102e','Monarquía Absoluta','Hesse',55,0.15,'absolute',40000],
MEC:['Mecklemburgo','mecklemburgués','#9fb870','h3:#0a50a1:#fcd116:#c8102e','Monarquía Absoluta','Mecklemburgo',55,0.05,'absolute',30000],
TEX:['Texas','texano','#d9795a','h2:#fff:#bf0a30','República','Texas',60,0.05,'republic',20000],
MEX:['México','mexicano','#5f9c4b','v3:#006847:#fff:#ce1126','República','México Central',15,0.08,'liberal',100000],
CAM:['Provincias Unidas de Centroamérica','centroamericano','#6dc0c2','h3:#4e92d4:#fff:#4e92d4','República','Guatemala',10,0.03,'liberal',20000],
COL:['Nueva Granada','neogranadino','#e0c04e','h3:#fcd116:#003893:#ce1126','República','Nueva Granada',12,0.03,'liberal',30000],
VEN:['Venezuela','venezolano','#d4a05a','h3:#fcd116:#00247d:#cf142b','República','Venezuela',10,0.03,'liberal',30000],
ECU:['Ecuador','ecuatoriano','#c4b45a','h3:#ffdd00:#034ea2:#ed1c24','República','Ecuador',10,0.03,'liberal',20000],
PER:['Perú','peruano','#cb5f5f','v3:#d91023:#fff:#d91023','República','Perú',10,0.03,'liberal',30000],
BOL:['Bolivia','boliviano','#7bb55e','h3:#d52b1e:#f9e300:#007934','República','Bolivia',8,0.02,'liberal',20000],
CHL:['Chile','chileno','#b74b4b','h2:#fff:#d52b1e','República','Chile',15,0.05,'liberal',30000],
ARG:['Argentina','argentino','#79b8d8','h3:#74acdf:#fff:#74acdf','República','Argentina',15,0.04,'liberal',30000],
PAR:['Paraguay','paraguayo','#bf6f6f','h3:#d52b1e:#fff:#0038a8','República','Paraguay',20,0.02,'absolute',15000],
URU:['Uruguay','uruguayo','#9ac0e8','h3:#fff:#0038a8:#fff','República','Uruguay',15,0.03,'liberal',15000],
BRZ:['Brasil','brasileño','#7ac26a','disc:#009c3b:#ffdf00','Monarquía Constitucional','Río de Janeiro',10,0.04,'slave',100000],
CHN:['China Qing','chino','#e0c845','disc:#f7d00d:#c8102e','Despotismo Oriental','Zhili',15,0.1,'eastern',800000],
KOR:['Joseon','coreano','#8fb8c8','disc:#fff:#cd2e3a','Despotismo Oriental','Corea del Sur',25,0.05,'eastern',100000],
JAP:['Japón Tokugawa','japonés','#c0505f','disc:#fff:#bc002d','Shogunato','Kanto',35,0.12,'eastern',400000],
SIA:['Siam','siamés','#d88a78','h5:#a51931:#f4f5f8:#2d2a4a','Despotismo Oriental','Siam',10,0.04,'eastern',100000],
VIE:['Dai Nam','vietnamita','#cf9a52','disc:#da251d:#ff0','Despotismo Oriental','Tonkín',20,0.04,'eastern',100000],
BRM:['Birmania','birmano','#b8a24e','disc:#8a1538:#f9c80e','Despotismo Oriental','Birmania',15,0.03,'eastern',50000],
PRS:['Persia','persa','#6ba3a3','h3:#239f40:#fff:#da0000','Despotismo Oriental','Teherán',5,0.04,'eastern',100000],
AFG:['Afganistán','afgano','#9a7a5a','v3:#111:#c8102e:#006600','Despotismo Oriental','Kabul',3,0.02,'eastern',30000],
BUK:['Emirato de Bujará','bujarí','#c0a05a','v3:#00a0c8:#fff:#00a0c8','Despotismo Oriental','Bujará',5,0.02,'eastern',20000],
KHI:['Janato de Jiva','jivano','#b09060','v3:#1d5a8c:#fff:#1d5a8c','Despotismo Oriental','Jiva',5,0.02,'eastern',10000],
KOK:['Janato de Kokand','kokandí','#a8a870','v3:#2a7a4a:#fff:#2a7a4a','Despotismo Oriental','Kokand',5,0.02,'eastern',10000],
SIK:['Imperio Sij','sij','#e0a060','disc:#f4a300:#0040a0','Despotismo Oriental','Punyab',8,0.03,'eastern',60000],
NEP:['Nepal','nepalí','#d9808a','disc:#dc143c:#003893','Despotismo Oriental','Nepal',8,0.02,'eastern',20000],
HYD:['Hyderabad','hyderabadí','#a0b060','disc:#2a6a3a:#fff','Despotismo Oriental','Hyderabad',8,0.03,'eastern',40000],
OMA:['Omán','omaní','#d87a7a','h3:#fff:#c8102e:#008000','Despotismo Oriental','Omán',5,0.02,'eastern',20000],
EGY:['Egipto','egipcio','#d8b868','disc:#c8102e:#fff','Despotismo Oriental','Egipto',5,0.1,'eastern',150000],
MOR:['Marruecos','marroquí','#c8645a','disc:#c1272d:#006233','Despotismo Oriental','Marruecos',3,0.02,'eastern',30000],
TUN:['Túnez','tunecino','#c46a6a','disc:#e70013:#fff','Despotismo Oriental','Túnez',5,0.03,'eastern',20000],
SOK:['Califato de Sokoto','sokotí','#9ab87a','disc:#1a6a3a:#fff','Teocracia','Sokoto',5,0.02,'theocracy',20000],
ASH:['Imperio Ashanti','ashanti','#d6b24a','disc:#ffd200:#111','Despotismo Oriental','Costa de Oro',2,0.01,'eastern',10000],
ETH:['Etiopía','etíope','#7aa85a','h3:#078930:#fcdd09:#da121a','Monarquía Absoluta','Etiopía',5,0.01,'serf',20000],
ZUL:['Reino Zulú','zulú','#a85a3a','disc:#222:#e8e0d0','Despotismo Oriental','Zululandia',2,0.01,'eastern',10000],
MDG:['Madagascar','malgache','#b06aa0','h2:#fff:#fc3d32','Monarquía Absoluta','Madagascar',3,0.02,'eastern',10000],
GRE:['Grecia','griego','#6aa8d8','cross2:#0d5eaf:#fff','Monarquía Constitucional','Grecia',20,0.05,'liberal',20000],
SER:['Serbia','serbio','#c85a78','h3:#c6363c:#0c4076:#fff','Monarquía Absoluta','Serbia',10,0.02,'absolute',15000],
WAL:['Principados Danubianos','valaco','#d09a5a','v3:#002b7f:#fcd116:#ce1126','Monarquía Absoluta','Valaquia y Moldavia',10,0.03,'absolute',20000]
};

// Metadatos de los nombres de las geografías especiales
const NEUTRAL_COLOR = '#8f8a74';
