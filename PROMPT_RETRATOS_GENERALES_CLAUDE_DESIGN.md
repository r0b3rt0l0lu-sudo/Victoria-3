# Prompt para Claude Design: retratos de generales para la barra de ejércitos de *Victoria*

**Rol y objetivo.** Eres retratista histórico y director de arte de videojuegos de gran estrategia (referencias: los retratos de los generales de *Hearts of Iron IV* y de *Victoria 3*). Crea la **colección de retratos de generales** de mi juego *Victoria* (1836-1945): un retrato por cada general histórico famoso de la lista de abajo, más un **conjunto genérico por nación y época** para los generales que genera el juego.

## 1. Cómo se usan en el juego
- Cada ejército aparece en una **barra inferior** (como en *Hearts of Iron*) con el retrato de su general (hoy un retrato grabado generado por código). Se muestra a **68×76 px** en la barra y a **54×62 px** en el panel del ejército; la proporción es **vertical 4:5**, cabeza y hombros, mirada al frente o de tres cuartos.
- El juego carga un archivo `src/retratos.js` con la forma:
  ```js
  window.GEN_PORTRAITS = { 'Wellesley': 'data:image/webp;base64,…', 'Moltke': '…', … };
  ```
  La clave es el **apellido tal como está en la lista** (nombre que usa el juego). Si falta una clave, el juego usa el retrato generado por código.

## 2. Estilo
- **Aspecto de retrato oficial de la época:** óleo y grabado para 1836-1880, **fotografía en sepia/blanco y negro** (albúmina, placa de cristal) para 1860-1920 y **fotografía de estudio en blanco y negro con ligero tinte** para 1914-1945. Que se vea el **uniforme correcto de su país y época** (kepis, chacós, bicornios, gorras de plato, cascos, charreteras, entorchados, condecoraciones).
- **Coherencia:** misma luz (arriba a la izquierda), mismo encuadre, fondo neutro oscuro con viñeta suave (marrón/azul pizarra), marco **fino de latón** de 2 px que lo integre con la interfaz «sala de mapas del Almirantazgo» (roble oscuro, latón envejecido, tinta azul).
- **Fidelidad histórica:** inspírate en los retratos y fotografías **de dominio público** de cada personaje (rasgos faciales, patillas, bigote, edad en la época del juego). **No copies una imagen concreta ni uses fotos con derechos**: crea una obra original que se parezca al personaje. Nada de caricatura ni gestos modernos.
- **Sin texto, sin firmas, sin marcas de agua.**

## 3. Formato técnico
- **Tamaño 128×160 px** (para pantallas de alta densidad), **WebP calidad 80** o **JPEG progresivo**, máximo **7 KB** por retrato. Entrega también un **sprite en una sola hoja** (`retratos_hoja.webp`, rejilla 10 columnas) por si se prefiere cargarlo de una vez.
- Entrega el archivo **`retratos.js` ya generado** (con las imágenes en base64 y las claves exactas de la lista) y los archivos sueltos en `retratos/NOMBRE.webp`.
- **Peso total ≤ 6 MB** (≈ 650 retratos). Si hace falta, prioriza: primero los generales famosos del §4, luego los genéricos del §5.

## 4. Generales históricos (clave = apellido del juego; un retrato por clave)
Las claves están agrupadas por nación (código del juego entre paréntesis). Usa el personaje histórico más conocido con ese apellido en el periodo 1836-1945 (por ejemplo *Gordon* = Charles George Gordon; *Haig* = Douglas Haig; *Foch*, *Joffre*, *Pétain*; *Moltke* = Helmuth von Moltke el Viejo; *Hindenburg*, *Ludendorff*; etc.). Si el apellido es ambiguo, elige el más famoso y sugiere en `LEEME.txt` quién es.

- **uk**: Wellesley, Napier, Havelock, Raglan, Cardigan, Campbell, Hardinge, Gough, Cathcart, Lucan, Outram, Wolseley, Roberts, Kitchener, Haig, French, Buller, Gordon, Hill, Pakenham
- **fr**: Soult, Bugeaud, Canrobert, Bosquet, Pélissier, MacMahon, Bazaine, Lamoricière, Cavaignac, Changarnier, Randon, Niel, Mac-Mahon, Ducrot, Foch, Joffre, Pétain, Gallieni, Lyautey, Faidherbe
- **de**: Moltke, Roon, Blücher, Gneisenau, Steinmetz, Wrangel, Manteuffel, Goeben, Werder, Falkenstein, Prittwitz, Hindenburg, Ludendorff, Schlieffen, Mackensen, Kluck, Bülow, Hötzendorf, Yorck, Vogel von Falckenstein
- **gs**: Hartmann, Thurn, Von der Tann, Hohenlohe, Zastrow, Prittwitz, Wrede, Schönfeld, Reitzenstein, Hake, Gablenz, Stosch, Treskow, Hanneken, Wittich
- **at**: Radetzky, Windischgrätz, Jellačić, Benedek, Haynau, Schwarzenberg, Gyulai, Clam-Gallas, Hess, Conrad, Archduke Albrecht, Kuhn, Auffenberg, Boroević, Dankl, Wimpffen, Wallmoden, Mensdorff
- **ru**: Kutúzov, Paskévich, Todleben, Barclay, Bagratión, Miloradóvich, Dibich, Gúrko, Skóbelev, Brusílov, Kuropatkin, Rennenkampf, Samsónov, Radetsky, Ermólov, Menshikov, Gorchakov, Chernyaev, Kaufmann, Ignatiev
- **tr**: Hüsrev, Reşid, Ömer Paşa, Hafız Paşa, Mehmed Ali, Osman Nuri, Fevzi, Hasan Rıza, Ahmed Muhtar, Mahmud Şevket, Abdi Paşa, Kör Hüseyin, Hurşid, Namık, Rauf, Ismail Hakkı, Nazım, Izzet, Fuad, Selim
- **eg**: Ibrahim Paşa, Soliman Paşa, Abbas, Urabi, Muhammad Said, Rashid, Ahmad Orabi, Hassan, Sherif, Ismail, Halim, Tawfiq, Hussein, Mahmoud Sami, Khalil, Fawzi
- **es**: Espartero, Narváez, "O'Donnell", Prim, Serrano, Concha, Zumalacárregui, Cabrera, Pavía, Martínez Campos, Weyler, Topete, Palafox, Castaños, Elío, Zurbano, Dulce, Echagüe, Córdova, Primo de Rivera
- **pt**: Saldanha, Terceira, Sá da Bandeira, Loulé, Mouzinho, Fontes, Teixeira, Sousa, Caldas Xavier, Pimentel, Pinto, Beresford, Almeida, Sampaio, Vilhena, Carvalho, Bernardo de Sá
- **se**: Skjöldebrand, Posse, Löwenhielm, Cederström, Sandels, Adlercreutz, Von Platen, Lagerbjelke, Gyllenkrok, Rehbinder, Stedingk, Hamilton, Sparre, Bergenstråhle, Wachtmeister, Stålhammar
- **dk**: Bülow, De Meza, Gerlach, Hegermann-Lindencrone, Steinmann, Rye, Schleppegrell, Læssøe, Moltke, Lunding, Olsen, Wedell, Castonier, Dinesen, Krogh, Bruun
- **nl**: Chassé, Van der Smissen, Bylandt, Trip, Van Heutsz, Schouten, Verhuell, Van Speijk, De Kock, Saksen-Weimar, Van Swieten, Cleerens, Stuers, Van Daalen, Pel, Gey van Pittius
- **be**: Chazal, Goethals, Brialmont, Leman, Gérard, Niellon, Mellinet, Anoul, Duvivier, Capiaumont, Van der Smissen, Magnan, Ruquoy, Clump, Barbanson, Dumonceau
- **ch**: Dufour, Ochsenbein, Herzog, Wille, Ziegler, Salis-Soglio, Rilliet, Kurz, Rüstow, Bourbaki, Hegner, Egloff, Lecomte, Sprecher, Wieland, Frey
- **sa**: La Marmora, Cialdini, Durando, Bava, Fanti, Cadorna, Menabrea, Cosenz, Dabormida, Pelloux, Ricotti, Cucchiari, Giacomo Medici, Govone, Della Rocca, Garibaldi, Pianell
- **nc**: Pepe, Filangieri, Nunziante, Lanza, Statella, Carrascosa, Pianell, Ritucci, Bosco, Caracciolo, Ferrari, Vial, Afan de Rivera, Nicoletti, Cutrofiano
- **pa**: Kanzler, Zappi, Pimodan, Pfyffer, De Courten, Charette, Lamoricière, Schmid, Ferrari, Colonna, Cervini, Odescalchi, Boncompagni, Giovanetti
- **to**: D’Apice, Ferrari da Grado, Laugier, Giovannetti, Cerrini, Ulloa, Pietro Ricasoli, Zannetti, Corsini, Del Cittadino, Guicciardini, Cempini
- **us**: Scott, Taylor, Jackson, Lee, Grant, Sherman, Sheridan, McClellan, Meade, Jessup, Worth, Kearny, Pershing, Custer, Stuart, Bragg, Beauregard, Hooker, Thomas, Longstreet
- **tx**: Houston, Rusk, Burleson, Lamar, Fannin, Johnston, Somervell, Moore, Hays, Ford, Karnes, Jones, Coleman, Woll, Cos
- **mx**: Santa Anna, Arista, Bravo, Paredes, Almonte, Canalizo, Ampudia, Urrea, Mejía, Zaragoza, Díaz, Escobedo, Comonfort, Bustamante, Valencia, Miramón, Márquez, Álvarez, Guerrero, Alcorta
- **ca**: Morazán, Carrera, Cabañas, Malespín, Ferrera, Cerna, Barrios, Guardiola, Zavala, Chamorro, Jerez, Estrada, Lindo, Reyes, Gálvez
- **co**: Santander, Mosquera, López, Obando, Herrán, Posada, Córdoba, Uribe Uribe, Reyes, Cabal, Nieto, Sardá, Salgar, Lozano, Murillo
- **ve**: Páez, Soublette, Monagas, Falcón, Guzmán, Zamora, Urdaneta, Bermúdez, Mariño, Piar, Arismendi, Bolívar, Sucre, Rangel, Colina
- **ec**: Flores, Urbina, Robles, Franco, Veintemilla, Salazar, Maldonado, Illingworth, Sucre, Elizalde, Mena, Saá, Alfaro, García Moreno
- **pe**: Castilla, Santa Cruz, Gamarra, Salaverry, Vivanco, Pezet, Echenique, Prado, Cáceres, Bolognesi, Grau, La Mar, Orbegoso, Nieto, San Román
- **bo**: Santa Cruz, Ballivián, Belzu, Linares, Achá, Melgarejo, Campero, Pando, Camacho, Ortiz, Sucre, Daza, Arce, Saavedra
- **cl**: "O'Higgins", Bulnes, Prieto, Baquedano, Pinto, Blanco Encalada, Cochrane, Cruz, Lynch, Errázuriz, Maruri, Soto, Carrera, Freire, Villagrán
- **ar**: Rosas, Urquiza, Paz, Lavalle, Mitre, San Martín, Roca, Quiroga, Belgrano, Lamadrid, Madariaga, Rivas, Paunero, Arredondo, Sarmiento
- **py**: López, Díaz, Caballero, Resquín, Estigarribia, Barrios, Francia, Aquino, Roa, Marcó, Bruguez, Duarte, Genes, Montiel, Cabañas
- **uy**: Rivera, Oribe, Lavalleja, Flores, Garzón, Ordóñez, Suárez, Díaz, Paunero, Batlle, Aparicio, Latorre, Santos, Tajes, Artigas
- **br**: Caxias, Osório, Tamandaré, Deodoro, Floriano, Porto Alegre, Barroso, Mallet, Câmara, Polidoro, Bento Gonçalves, Abreu, Rondon, Lima e Silva, Marques de Souza
- **cn**: Zeng, Zuo, Li, Liu, Ding, Feng, Song, Yuan, Sengge Rinchen, Hu, Chen, Peng, Yang, Lin, Wei, Xu, Zhang, Dong
- **kr**: Shin, Yi, Han, Jo, Kim, Hong, Min, Yu, Kang, Seo, Ahn, Eo, Yang, Heo, Choe
- **jp**: Saigō, Shimazu, Nogi, Ōyama, Yamagata, Kawakami, Katsura, Kodama, Itō, Takasugi, Ōmura, Kuroda, Tani, Oku, Nozu, Kuroki, Yamaji, Akiyama
- **th**: Bodindecha, Suriyawongse, Phraya Surasi, Thiphakorawong, Phiphat, Chakri, Phraya Phetphichai, Sri Suriyawong, Phraya Ratchasuphawadi, Nai Thongdee, Phra Pinklao, Chao Mun
- **vn**: Nguyễn Tri Phương, Tôn Thất Thuyết, Hoàng Diệu, Trương Định, Lê Văn Duyệt, Phan Thanh Giản, Nguyễn Văn Thành, Hoàng Kế Viêm, Lưu Vĩnh Phúc, Lê Chất, Nguyễn Công Trứ, Trần Hưng Đạo
- **mm**: Maha Bandula, Thihathura, Nemyo Thihapate, Kyaw Htin, Minhla, Maha Nawrahta, Thado, Letya, Bo Hmu, Maha Thiha Thura, Pagan Min, Minkhaung, Mingyi, Nga Chit
- **ir**: Abbas Mirza, Amir Kabir, Hasan Khan, Sardar, Najaf, Ali Mohammad, Amin al-Dowleh, Sepahsalar, Naser, Mirza Aqasi, Firuz, Ardalan, Mohammad Shah, Zell al-Sultan, Kalhor

## 5. Retratos genéricos (para generales generados)
Para los generales que no están en la lista, entrega **12 retratos genéricos por época y nación grande** que el juego asignará por semilla (`generico_<nación>_<época>_<n>.webp`, n = 1…12):
- **Épocas:** A 1836-1860 (bicornio/chacó, patillas), B 1861-1890 (kepi, barba), C 1891-1913 (gorra de plato, bigote), D 1914-1936 (gorra de plato o casco, condecoraciones), E 1937-1945 (gorra de plato, uniforme de campaña).
- **Naciones:** Reino Unido, Francia, Alemania/Prusia, Rusia/URSS, Austria-Hungría, Italia, Estados Unidos, Japón, China, Otomano, España, y un **genérico europeo, uno asiático y uno africano/americano** para el resto.
- Variedad de edad, peinado y rasgos; ninguno debe parecerse a un personaje histórico concreto.

## 6. Verificación que debes entregar
1. **Hoja de contacto** con todos los retratos (3 niveles de zoom), ordenados por nación.
2. **Prueba en contexto:** maqueta HTML de la barra inferior (10 tarjetas de 74×98 px con barras de fuerza y organización y marco de latón) con los retratos reales, en tema oscuro y claro.
3. **Informe de pesos** (KB por retrato y total) y **lista de claves** que no han podido resolverse con seguridad (apellidos ambiguos).
4. **Aviso de derechos:** confirma que todas las imágenes son obras originales inspiradas en material de dominio público.

## 7. Criterios de aceptación
- A 68×76 px se reconoce la nación y la época por el uniforme y el tocado; los generales famosos son reconocibles por sus rasgos distintivos (bigote de Kitchener, patillas de Burnside, barba de Moltke…).
- Todos los retratos comparten luz, encuadre y marco: la barra inferior parece de un mismo estudio fotográfico.
- Cargan sin errores con `window.GEN_PORTRAITS = {…}` y no pasan de 6 MB.
