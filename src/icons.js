/* ===== ICONOS v2: grabados en acero (sprite <symbol> en línea, sin imágenes externas) =====
   Cada icono tiene tres capas: «s» sombra rayada (relleno al 22 %), «t» trazo principal 1,5 px y «d» detalle fino 0,8 px (rayado, remaches).
   icon(nombre, clase) → <svg><use href="#i-nombre"></svg>. Compatibilidad: ICON_PATHS, EMO_ICON e iconize() siguen existiendo. */
const ICON_V2 = {
  // nombre: [sombra, trazo, detalle]
  coin: ['M12 4a8 8 0 100 16 8 8 0 000-16z', 'M12 3.5a8.5 8.5 0 100 17 8.5 8.5 0 000-17zM12 7v10M9.6 9.6c0-1 1-1.7 2.4-1.7s2.4.7 2.4 1.7c0 2.3-4.8 1.2-4.8 3.7 0 1 1 1.7 2.4 1.7s2.4-.7 2.4-1.7', 'M12 5.5a6.5 6.5 0 016.2 4.5M5.8 14a6.5 6.5 0 003.2 3.7'],
  scale: ['M2 13h5a2.6 2.6 0 01-5 0zM17 13h5a2.6 2.6 0 01-5 0z', 'M12 3.5v16.5M7 20h10M4 7h16M4 7l-2.5 6a2.8 2.8 0 005 0zM20 7l-2.5 6a2.8 2.8 0 005 0zM12 3.5a1 1 0 110 .1', 'M9 20l1-1.5h4l1 1.5M10.5 7l1.5-1.5L13.5 7'],
  trophy: ['M8 4h8v5a4 4 0 01-8 0z', 'M8 4h8v5a4 4 0 01-8 0zM8 6H4.5v1a3.5 3.5 0 003.5 3.5M16 6h3.5v1A3.5 3.5 0 0116 10.5M12 13v4M8 20.5h8M9.5 17h5', 'M10 6v3M12 6v4M14 6v3'],
  globe: ['M12 3a9 9 0 000 18c-3.5-3.5-3.5-14.5 0-18z', 'M12 3a9 9 0 100 18 9 9 0 000-18zM3 12h18M12 3c3.5 3.5 3.5 14.5 0 18M12 3c-3.5 3.5-3.5 14.5 0 18', 'M4.5 7.5h15M4.5 16.5h15'],
  bulb: ['M12 3a6 6 0 00-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0012 3z', 'M9 18h6M10 21h4M12 3a6 6 0 00-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0012 3z', 'M10.5 13l1.5-4 1.5 4M9.5 5.5a4 4 0 00-1.5 2'],
  columns: ['M3 9l9-5 9 5z', 'M3 9l9-5 9 5H3zM5.5 9.5v8.5M9.8 9.5v8.5M14.2 9.5v8.5M18.5 9.5v8.5M3 20.5h18M4 18.5h16', 'M6.5 10v7.5M10.8 10v7.5M15.2 10v7.5M19.5 10v7.5M10.5 7h3'],
  people: ['M9 11a3.5 3.5 0 100-7 3.5 3.5 0 000 7z', 'M9 11a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6M16 4.3a3.3 3.3 0 010 6.4M17.5 14.3c2.3.6 4 2.7 4 5.7', 'M5 17l1 3M13 17l-1 3'],
  bread: ['M4 13c0-3.5 3-6 8-6s8 2.5 8 6v4H4z', 'M4 13c0-3.5 3-6 8-6s8 2.5 8 6v4H4zM3 17h18', 'M8 11l1 2.5M12 10l1 2.5M16 11l1 2.5'],
  chartdown: ['M3 20h18V4z', 'M3 4v16h18M7 8l4 4 3-3 5 6M19 11v4h-4', 'M6 18v-3M9 18v-5M12 18v-6M15 18v-4'],
  chartup: ['M3 20h18V4z', 'M3 4v16h18M7 15l4-4 3 3 5-6M15 8h4v4', 'M6 18v-2M9 18v-4M12 18v-3M15 18v-5'],
  mail: ['M3 6l9 7 9-7z', 'M3 6h18v12H3zM3.5 7l8.5 6.5L20.5 7', 'M3.5 17l6.5-5.5M20.5 17L14 11.5'],
  search: ['M10.5 4a6.5 6.5 0 100 13 6.5 6.5 0 000-13z', 'M10.5 4a6.5 6.5 0 100 13 6.5 6.5 0 000-13zM15.5 15.5L21 21', 'M7 9a4 4 0 012.5-2.5'],
  medal: ['M12 14a5 5 0 100-10 5 5 0 000 10z', 'M12 14a5 5 0 100-10 5 5 0 000 10zM8.5 13.5L7 21l5-3 5 3-1.5-7.5', 'M12 6.5l.8 1.7 1.9.3-1.4 1.3.3 1.9-1.6-.9-1.6.9.3-1.9-1.4-1.3 1.9-.3z'],
  save: ['M4 4h13l3 3v13H4z', 'M4 4h13l3 3v13H4zM8 4v5h7V4M8 20v-6h8v6', 'M10 16h4M10 18h4M13 5.5v2'],
  folder: ['M3 9h18v10H3z', 'M3 6h6l2 2h10v11H3zM3 10h18', 'M5 13h6M5 15.5h9'],
  scroll: ['M8 4h10a2 2 0 012 2v1H10z', 'M8 4h10a2 2 0 012 2v1H10M8 4a2 2 0 00-2 2v11a3 3 0 003 3h9a2 2 0 002-2V7M9.5 11h7M9.5 15h5', 'M9.5 13h6M9.5 17h3'],
  book: ['M4 5a2 2 0 012-2h13v14H6a2 2 0 00-2 2z', 'M4 5a2 2 0 012-2h13v16H6a2 2 0 00-2 2zM4 19a2 2 0 012-2h13M9 7h6', 'M9 9.5h6M9 12h4'],
  money: ['M3 7h18v10H3z', 'M3 7h18v10H3zM12 9.5a2.5 2.5 0 100 5 2.5 2.5 0 000-5zM6.5 10v4M17.5 10v4', 'M4.5 8.5h2M17.5 15.5h2'],
  factory: ['M3 20V10l6 4v-4l6 4V5h3v15z', 'M3 20V10l6 4v-4l6 4V5h3v15zM2 20h20M7 17h2M12 17h2', 'M15 3c1-1 2.5-1 3 0M16.5 7h1M16.5 10h1'],
  handshake: ['M7 7.5l4 2 4-2 5 4.5-5 5-3-1-2.5 2.5-3-1.5L2 12z', 'M2 12l5-4.5 4 2 4-2L20 12l-5 5-3-1-2.5 2.5-3-1.5zM7 7.5L3.5 11M16.5 7.5L20 11', 'M9 13l2 2M11 12l2 2M13 11l1.5 1.5'],
  swords: ['', 'M4 4l10 10M4 4v4.5l1 1M20 4L10 14M20 4v4.5l-1 1M9 15l-4 4M15 15l4 4M5 17l2 2M17 17l-2 2', 'M6.5 6.5l1-1M17.5 6.5l-1-1'],
  hammer: ['M14 4l6 6-3 3-6-6z', 'M14 4l6 6-3 3-6-6zM12 9l-8 8 3 3 8-8', 'M15.5 6.5l2 2'],
  flag: ['M5 4h13l-3 4 3 4H5z', 'M5 21V4M5 4h13l-3 4 3 4H5M3 21h4', 'M7 6h6M7 8h4M7 10h7'],
  wflag: ['', 'M5 21V4M5 4h13v9H5M3 21h4', 'M7 6.5h9M7 9h9M7 11h9'],
  mountain: ['M9 7l4 7 3-4 6 10H2z', 'M2 20l7-13 4 7 3-4 6 10zM7.5 10l1.5 1 1.5-1', 'M9 11l-2.5 6M12 13l-1 4M16 12l1 5'],
  fire: ['M12 3c1 4 5 5 5 10a5 5 0 01-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3 0-6 1-9z', 'M12 3c1 4 5 5 5 10a5 5 0 01-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3 0-6 1-9z', 'M12 14c1 1.5 1.5 2.5.5 4'],
  home: ['M5 10.5l7-5.5 7 5.5V20H5z', 'M3 11l9-7 9 7M5 10v10h14V10M10 20v-6h4v6', 'M7 12.5h2M15 12.5h2'],
  rotl: ['', 'M4 12a8 8 0 108-8M4 4v5h5', ''], rotr: ['', 'M20 12a8 8 0 11-8-8M20 4v5h-5', ''], tiltu: ['', 'M6 15l6-6 6 6', ''], tiltd: ['', 'M6 9l6 6 6-6', ''],
  mouse: ['M12 3a5 5 0 00-5 5v3h10V8a5 5 0 00-5-5z', 'M12 3a5 5 0 00-5 5v8a5 5 0 0010 0V8a5 5 0 00-5-5zM12 7v4M7 11h10', ''],
  hand: ['', 'M8 12V6a1.5 1.5 0 013 0v5M11 11V4.5a1.5 1.5 0 013 0V11M14 11V6a1.5 1.5 0 013 0v7c0 4-2 7-6 7-3 0-5-2-6-5l-2-4a1.5 1.5 0 012.6-1.5L8 13', ''],
  edge: ['', 'M4 4h6M4 4v6M4 4l7 7M20 20h-6M20 20v-6M20 20l-7-7', ''],
  anchor: ['', 'M12 6a2 2 0 100-4 2 2 0 000 4zM12 6v15M7 11H4a8 8 0 0016 0h-3M8 9h8', 'M9 19.5l3 1.5 3-1.5'],
  plane: ['M12 3l2 7 8 4v2l-8-2-1 5 3 2v1l-5-1-5 1v-1l3-2-1-5-8 2v-2l8-4z', 'M12 3l2 7 8 4v2l-8-2-1 5 3 2v1l-5-1-5 1v-1l3-2-1-5-8 2v-2l8-4z', 'M12 6v8'],
  door: ['M5 4h9l5 2v15H5z', 'M5 21V4h9l5 2v15M3 21h18M14 4v17M11 12h.01', ''],
  star: ['M12 3l2.8 5.8 6.2.9-4.5 4.4 1 6.2L12 17.4l-5.5 2.9 1-6.2L3 9.7l6.2-.9z', 'M12 3l2.8 5.8 6.2.9-4.5 4.4 1 6.2L12 17.4l-5.5 2.9 1-6.2L3 9.7l6.2-.9z', ''],
  tree: ['M12 3l6 8h-3l4 5H5l4-5H6z', 'M12 3l6 8h-3l4 5H5l4-5H6zM12 16v5M9 21h6', 'M10 9l2-1.5M12 12l3-1.5'],
  ship: ['M3 15l2 5h14l2-5z', 'M3 15l2 5h14l2-5zM12 3v11M12 4l6 7h-6M12 6l-5 5h5', 'M7 17.5h10M2 22c2-1 3-1 5 0s3 1 5 0 3-1 5 0 3 1 5 0'],
  shield: ['M12 3v18c-4.5-1-8-4-8-9V6z', 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z', 'M8 9h8M12 7v10'],
  helmet: ['M4 15a8 8 0 0116 0z', 'M4 15a8 8 0 1116 0v3H4zM4 15h16M12 7v8', 'M7 11a5 5 0 012-3'],
  cannon: ['M3 14l12-5 3 4-12 5z', 'M3 14l12-5 3 4-12 5zM17 13l4 3M5 20.5a3 3 0 100-6 3 3 0 000 6z', 'M5 15v5.5M2 17.5h6'],
  horse: ['M5 20l2-7-3-3 4-3 3 1 3-4 2 3 4 4-2 3-3-1-2 7z', 'M5 20l2-7-3-3 4-3 3 1 3-4 2 3 4 4-2 3-3-1-2 7M9 7l-1-3', 'M14 6c1 1 1 2 2 3'],
  // --- nuevos ---
  crown: ['M4 17h16l1-10-5 4-4-6-4 6-5-4z', 'M4 17h16l1-10-5 4-4-6-4 6-5-4zM4 20h16', 'M8 14h.01M12 13.5h.01M16 14h.01'],
  eagle: ['M12 7c-2 0-3 2-3 4l-6-4c1 4 3 6 6 7l-2 3 5-1 5 1-2-3c3-1 5-3 6-7l-6 4c0-2-1-4-3-4z', 'M12 7c-2 0-3 2-3 4l-6-4c1 4 3 6 6 7l-2 3 5-1 5 1-2-3c3-1 5-3 6-7l-6 4c0-2-1-4-3-4zM12 4.5a1.5 1.5 0 110 3', 'M5 10l3 1.5M19 10l-3 1.5'],
  bomb: ['M10 8a6 6 0 100 12 6 6 0 000-12z', 'M10 8a6 6 0 100 12 6 6 0 000-12zM13.5 9.5l2-2M15.5 7.5l1-1', 'M17.5 3.5l1 1M20 4l-1 1M19.5 6.5l-1-.5M7 12a3.5 3.5 0 012-2'],
  rifle: ['M2 15l3-1 2 3-3 1z', 'M2 15l13-5 7-2M5 14l2 3-3 1-2-3M9 12.5l1 2.5 2-1', 'M14 10.5l1.5 2'],
  wheat: ['M12 21V8', 'M12 21V5M12 9c-2-1-3-3-3-5 2 0 3 2 3 5zM12 9c2-1 3-3 3-5-2 0-3 2-3 5zM12 14c-2-1-3-3-3-5 2 0 3 2 3 5zM12 14c2-1 3-3 3-5-2 0-3 2-3 5z', 'M12 18c-1.5-.5-2.5-2-2.5-3.5M12 18c1.5-.5 2.5-2 2.5-3.5'],
  pick: ['M4 8c4-4 12-4 16 0-4-2-12-2-16 0z', 'M4 8c4-4 12-4 16 0-4-2-12-2-16 0zM12 6.5V21', 'M11 21h2'],
  snow: ['', 'M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9', 'M10 4.5l2 2 2-2M10 19.5l2-2 2 2M4.5 10l2.5-.5L6 7M19.5 14l-2.5.5L18 17'],
  target: ['M12 8a4 4 0 100 8 4 4 0 000-8z', 'M12 3.5a8.5 8.5 0 100 17 8.5 8.5 0 000-17zM12 8a4 4 0 100 8 4 4 0 000-8zM12 1.5v4M12 18.5v4M1.5 12h4M18.5 12h4', ''],
  compass: ['M12 5l2 7-2 7-2-7z', 'M12 3a9 9 0 100 18 9 9 0 000-18zM12 5l2 7-2 7-2-7zM10 12h4', 'M5 12h1.5M17.5 12H19M12 3.5V5'],
  ballot: ['M5 11h14v9H5z', 'M5 11h14v9H5zM9 11V4h7v7M8 11h8', 'M11 7l1.5 1.5L15 6M8 15h8'],
  castle: ['M5 9h14v11H5z', 'M4 20V6h3v3h3V6h4v3h3V6h3v14zM10 20v-5a2 2 0 014 0v5', 'M6 12h2M16 12h2'],
  sword: ['', 'M5 19l11-11 3-3-1 4-11 11zM4 17l3 3M3 21l2-2', 'M14 10l-2-2'],
  moneybag: ['M8 9h8c3 3 4 6 3 9-1 2-3 3-7 3s-6-1-7-3c-1-3 0-6 3-9z', 'M8 9h8c3 3 4 6 3 9-1 2-3 3-7 3s-6-1-7-3c-1-3 0-6 3-9zM8 9L6.5 4.5h11L16 9', 'M12 12v6M10.5 13.5c0-.8.7-1.2 1.5-1.2s1.5.4 1.5 1.2c0 1.6-3 .8-3 2.6'],
  bank: ['M3 9l9-5 9 5z', 'M3 9l9-5 9 5H3zM5 9.5V18M9.5 9.5V18M14.5 9.5V18M19 9.5V18M2.5 20.5h19M3.5 18h17', 'M11 6.5h2'],
  grad: ['M12 5l10 4.5-10 4.5L2 9.5z', 'M12 5l10 4.5-10 4.5L2 9.5zM6 11.5V16c3 2.5 9 2.5 12 0v-4.5M21.5 9.5V15', ''],
  bridge: ['M2 15c4-6 16-6 20 0v4H2z', 'M2 11h20M2 19h20M2 15c4-6 16-6 20 0M5 11v8M19 11v8M12 11v1.5', 'M8.5 11v1M15.5 11v1'],
  gear: ['M12 8.5a3.5 3.5 0 100 7 3.5 3.5 0 000-7z', 'M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1M12 6a6 6 0 100 12 6 6 0 000-12zM12 9.5a2.5 2.5 0 100 5 2.5 2.5 0 000-5z', ''],
  fist: ['M7 10h10v5a5 5 0 01-5 5H10a3 3 0 01-3-3z', 'M7 10V7a1.5 1.5 0 013 0v3M10 10V6a1.5 1.5 0 013 0v4M13 10V6.5a1.5 1.5 0 013 0V10M16 10V8a1.5 1.5 0 013 0v6a6 6 0 01-6 6h-2a4 4 0 01-4-4v-6z', ''],
  undo: ['', 'M9 14L4 9l5-5M4 9h10a6 6 0 010 12h-3', ''], redo: ['', 'M15 14l5-5-5-5M20 9H10a6 6 0 000 12h3', ''],
  box: ['M4 8l8-4 8 4v9l-8 4-8-4z', 'M4 8l8-4 8 4v9l-8 4-8-4zM4 8l8 4 8-4M12 12v9', 'M8 6l8 4'],
  books: ['M4 5h4v15H4z', 'M4 5h4v15H4zM8 7h4v13H8zM13 6.5l3.5-1 3.5 13.5-3.5 1z', 'M5 8h2M9 10h2'],
  ruler: ['M3 17L17 3l4 4L7 21z', 'M3 17L17 3l4 4L7 21zM7 13l1.5 1.5M10 10l2 2M13 7l1.5 1.5M16 4.5l1.5 1.5', ''],
  exchange: ['', 'M4 8h14l-3-3M20 16H6l3 3', 'M8 8v.01M16 16v.01'],
  bricks: ['M3 6h18v12H3z', 'M3 6h18v12H3zM3 10h18M3 14h18M8 6v4M15 6v4M11 10v4M6 14v4M17 14v4', ''],
  bell: ['M6 16V11a6 6 0 0112 0v5l1.5 2h-15z', 'M6 16V11a6 6 0 0112 0v5l1.5 2h-15zM10 20.5a2 2 0 004 0', 'M12 3v2'],
  play: ['M8 5l11 7-11 7z', 'M8 5l11 7-11 7z', ''], pause: ['M7 5h3.5v14H7zM13.5 5H17v14h-3.5z', 'M7 5h3.5v14H7zM13.5 5H17v14h-3.5z', ''],
  close: ['', 'M6 6l12 12M18 6L6 18', ''], check: ['', 'M4.5 12.5l5 5L19.5 6.5', ''],
  lock: ['M5 11h14v10H5z', 'M5 11h14v10H5zM8 11V7.5a4 4 0 018 0V11', 'M12 15v2.5'],
  warn: ['M12 3l10 17H2z', 'M12 3l10 17H2zM12 9.5v5M12 17.2v.3', ''], info: ['M12 3a9 9 0 100 18 9 9 0 000-18z', 'M12 3a9 9 0 100 18 9 9 0 000-18zM12 10.5v6M12 7.2v.3', ''],
  hourglass: ['M7 4h10c0 5-4 6-5 8-1-2-5-3-5-8z', 'M6 3h12M6 21h12M7 3c0 6 4 6 5 9-1 3-5 3-5 9M17 3c0 6-4 6-5 9 1 3 5 3 5 9', 'M9.5 19h5'],
  menu: ['', 'M4 6h16M4 12h16M4 18h16', ''],
  steamship: ['M3 15h18l-2 5H5z', 'M3 15h18l-2 5H5zM7 15v-4h10v4M9 11V6h2v5M13 11V7h2v4', 'M9 4c.5-1 2-1 2-2M13 5c.5-1 2-1 2-2'],
  sub: ['M3 13c2-3 16-3 18 0-2 3-16 3-18 0z', 'M3 13c2-3 16-3 18 0-2 3-16 3-18 0zM10 10.5V7h3v3.5M11.5 7V4.5', 'M6 13h.01M15 13h.01M18 13h.01'],
  tank: ['M3 14h18v4H3z', 'M3 14h18a2 2 0 010 4H3a2 2 0 010-4zM6 14v-3h9v3M15 12h7', 'M5 16h.01M9 16h.01M13 16h.01M17 16h.01'],
  train: ['M5 4h14v12H5z', 'M5 4h14v12H5zM5 10h14M8 16l-2 4M16 16l2 4M8.5 13h.01M15.5 13h.01', 'M9 6.5h6'],
  radio: ['M4 9h16v11H4z', 'M4 9h16v11H4zM6 9l12-5M15 14.5a2 2 0 100 .1', 'M6.5 12h5M6.5 15h5M6.5 18h5'],
  bomber: ['M12 3c1 1 1 3 1 5l8 4v2l-8-1-.5 6 2.5 1.5v1L12 20l-3 1.5v-1L11.5 19 11 13l-8 1v-2l8-4c0-2 0-4 1-5z', 'M12 3c1 1 1 3 1 5l8 4v2l-8-1-.5 6 2.5 1.5v1L12 20l-3 1.5v-1L11.5 19 11 13l-8 1v-2l8-4c0-2 0-4 1-5z', 'M6 11.5v1.5M18 11.5v1.5'],
  church: ['M6 11h12v10H6z', 'M12 2v4M10 4h4M6 21V11l6-5 6 5v10zM10 21v-4a2 2 0 014 0v4', ''],
  skull: ['M12 3a7 7 0 00-7 7c0 3 1.5 4.5 3 5.5V19h8v-3.5c1.5-1 3-2.5 3-5.5a7 7 0 00-7-7z', 'M12 3a7 7 0 00-7 7c0 3 1.5 4.5 3 5.5V19h8v-3.5c1.5-1 3-2.5 3-5.5a7 7 0 00-7-7zM9 10.5a1.3 1.3 0 100 .1M15 10.5a1.3 1.3 0 100 .1M10 19v2M14 19v2', 'M11.5 14h1'],
  seal: ['M12 3a8.5 8.5 0 108.5 8.5c0-1-1.5-1.5-1-3s-.5-3-2-3-2-2.5-5.5-2.5z', 'M12 3a8.5 8.5 0 108.5 8.5c0-1-1.5-1.5-1-3s-.5-3-2-3-2-2.5-5.5-2.5zM12 7.5l1.2 2.6 2.8.3-2.1 1.9.6 2.8-2.5-1.4-2.5 1.4.6-2.8-2.1-1.9 2.8-.3z', ''],
  pen: ['', 'M15 4l5 5L9 20H4v-5zM13 6l5 5', 'M4 20l3-1'],
  oil: ['M12 3c3 5 6 8 6 11a6 6 0 01-12 0c0-3 3-6 6-11z', 'M12 3c3 5 6 8 6 11a6 6 0 01-12 0c0-3 3-6 6-11z', 'M9 15a3 3 0 002.5 3'],
  coal: ['M4 17l3-6 5-2 5 3 3 5z', 'M4 17l3-6 5-2 5 3 3 5zM2 20h20', 'M8 13l2 2M13 12l1 3'],
  iron: ['M5 9h14l2 8H3z', 'M5 9h14l2 8H3zM3 17v3h18v-3', 'M8 12h8'],
  dove: ['M3 12c3 0 5-2 7-5 1 3 3 4 6 4l5-3-3 5c-1 3-4 5-8 5-3 0-5-2-7-6z', 'M3 12c3 0 5-2 7-5 1 3 3 4 6 4l5-3-3 5c-1 3-4 5-8 5-3 0-5-2-7-6z', 'M8 15l-2 4M11 17l-1 3'],
  liberty: ['', 'M12 21V9M9 21h6M10 9h4l-1-3h-2zM13 6l2-4M12 6l0-4M11 6l-2-4M15 10l3-6', '']
};
const ICON_PATHS = Object.fromEntries(Object.entries(ICON_V2).map(([k, v]) => [k, v[1]]));
const EMO_ICON = {'💰': 'coin', '⚖': 'scale', '🏆': 'trophy', '🕊': 'dove', '🌍': 'globe', '🌐': 'globe', '💡': 'bulb', '🏛': 'columns', '👥': 'people', '🍞': 'bread', '📉': 'chartdown', '✉': 'mail', '🔍': 'search', '🏅': 'medal', '🎖': 'medal',
  '💾': 'save', '📂': 'folder', '📜': 'scroll', '📖': 'book', '💷': 'money', '🏭': 'factory', '🤝': 'handshake', '⚔': 'swords', '🏗': 'hammer', '🔨': 'hammer', '🏴': 'flag', '🚩': 'flag', '🏳': 'wflag', '⛰': 'mountain', '📈': 'chartup', '🔥': 'fire',
  '🏠': 'home', '⟲': 'rotl', '⟳': 'rotr', '⤒': 'tiltu', '⤓': 'tiltd', '🖱': 'mouse', '🖐': 'hand', '⇱': 'edge', '⚓': 'anchor', '✈': 'plane', '🛩': 'plane', '★': 'star', '⭐': 'star', '🌳': 'tree', '🌲': 'tree', '🚪': 'door',
  '🛡': 'shield', '🪖': 'helmet', '💣': 'bomb', '💥': 'bomb', '🔫': 'rifle', '🌾': 'wheat', '⛏': 'pick', '❄': 'snow', '🎯': 'target', '🧭': 'compass', '🗳': 'ballot', '🏰': 'castle', '🏯': 'castle', '🗡': 'sword', '💸': 'moneybag',
  '🏦': 'bank', '🎓': 'grad', '🌉': 'bridge', '⚙': 'gear', '✊': 'fist', '↩': 'undo', '↪': 'redo', '📦': 'box', '📚': 'books', '📏': 'ruler', '📐': 'ruler', '💱': 'exchange', '🧱': 'bricks', '🔔': 'bell', '▶': 'play', '⏸': 'pause',
  '✕': 'close', '✓': 'check', '✔': 'check', '🔒': 'lock', '⚠': 'warn', 'ℹ': 'info', '⏳': 'hourglass', '☰': 'menu', '🚢': 'steamship', '⛴': 'steamship', '🚤': 'ship', '🤿': 'sub', '🚂': 'train', '📻': 'radio', '📡': 'radio', '👑': 'crown',
  '🦅': 'eagle', '🐎': 'horse', '🐴': 'horse', '💀': 'skull', '☠': 'skull', '⛪': 'church', '🕌': 'church', '🖋': 'pen', '✒': 'pen', '🛢': 'oil', '⛽': 'oil', '🪨': 'coal', '🗽': 'liberty', '🎪': 'flag', '🛠': 'gear'};
// sprite: se inserta una vez al cargar (SVG oculto con todos los <symbol>)
function iconSprite() {
  if (typeof document === 'undefined' || document.getElementById('ic-sprite')) return;
  const sym = Object.entries(ICON_V2).map(([k, [s, t, d]]) => `<symbol id="i-${k}" viewBox="0 0 24 24">${s ? `<path class="s" d="${s}"/>` : ''}<path class="t" d="${t}"/>${d ? `<path class="d" d="${d}"/>` : ''}</symbol>`).join('');
  const div = document.createElement('div'); div.innerHTML = `<svg id="ic-sprite" aria-hidden="true" style="position:absolute;width:0;height:0;overflow:hidden">${sym}</svg>`; document.body.prepend(div.firstChild);
}
function icon(name, cls) { if (!ICON_V2[name]) return ''; iconSprite(); return `<svg class="ic ${cls || ''}" viewBox="0 0 24 24" aria-hidden="true"><use href="#i-${name}"/></svg>`; }
// sustituye el emoji de un elemento por su icono grabado (mismos selectores que v1 + cabeceras de diálogo, pestañas y etiquetas con data-ic)
function iconize(root) {
  (root || document).querySelectorAll('.chip > b, .rbtn, .mbtn > span, #camctl button, .mode, .wicon, .mapbtn, .evicon, [data-emo]').forEach(el => {
    if (el.dataset.ic) return;
    const t = (el.dataset.emo || el.textContent).replace(/[️‍]/g, '').trim(), n = EMO_ICON[t] || EMO_ICON[[...t][0]];
    if (n && [...t].length <= 2) { el.innerHTML = icon(n); el.dataset.ic = n; }
  });
}
/* conmutador de tema, densidad, paleta y efectos (se guarda en localStorage) */
const UI_PREFS = {theme: 'oscuro', densidad: 'normal', paleta: 'normal', fx: '1', compact: '1'};
function uiPrefs(p) {
  try { Object.assign(UI_PREFS, JSON.parse(localStorage.getItem('vic_ui2') || '{}')); } catch (e) { }
  if (p) { Object.assign(UI_PREFS, p); try { localStorage.setItem('vic_ui2', JSON.stringify(UI_PREFS)); } catch (e) { } }
  const h = document.documentElement; h.dataset.theme = UI_PREFS.theme; h.dataset.densidad = UI_PREFS.densidad; h.dataset.paleta = UI_PREFS.paleta; h.dataset.compact = UI_PREFS.compact;
  let low = false; try { low = !!R.lowEnd; } catch (e) { }   // R puede no existir aún (zona muerta temporal del const)
  h.dataset.fx = low ? '0' : UI_PREFS.fx; return UI_PREFS;
}
if (typeof document !== 'undefined') { if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => { iconSprite(); uiPrefs(); }); else { iconSprite(); uiPrefs(); } }
