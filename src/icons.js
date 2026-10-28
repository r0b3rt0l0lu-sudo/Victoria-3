/* ===== ICONOS SVG (sustituyen a los emojis, que se ven distinto en cada sistema) ===== */
const ICON_PATHS = {
  coin: 'M12 4a8 8 0 100 16 8 8 0 000-16zM12 7.5v9M9.6 9.6c0-1 1-1.7 2.4-1.7s2.4.7 2.4 1.7c0 2.3-4.8 1.2-4.8 3.7 0 1 1 1.7 2.4 1.7s2.4-.7 2.4-1.7',
  scale: 'M12 4v16M7 20h10M4 7h16M4 7l-2.5 6a2.8 2.8 0 005 0zM20 7l-2.5 6a2.8 2.8 0 005 0z',
  trophy: 'M8 4h8v5a4 4 0 01-8 0zM8 6H4v1a4 4 0 004 4M16 6h4v1a4 4 0 01-4 4M12 13v4M8 20h8M10 17h4',
  globe: 'M12 3a9 9 0 100 18 9 9 0 000-18zM3 12h18M12 3c3.5 3.5 3.5 14.500 0 18M12 3c-3.500 3.500-3.500 14.500 0 18',
  bulb: 'M9 18h6M10 21h4M12 3a6 6 0 00-3.500 10.900c.6.500 1 1.200 1 2.100h5c0-.9.4-1.600 1-2.100A6 6 0 0012 3z',
  columns: 'M3 9l9-5 9 5H3zM5.500 9v9M9.800 9v9M14.200 9v9M18.500 9v9M3 20.500h18',
  people: 'M9 11a3.500 3.500 0 100-7 3.500 3.500 0 000 7zM2.500 20c0-3.600 2.900-6 6.500-6s6.500 2.400 6.500 6M16 4.300a3.300 3.300 0 010 6.400M18 14.400c2 .8 3.500 2.600 3.500 5.600',
  bread: 'M4 13c0-3.500 3-6 8-6s8 2.500 8 6v4H4zM8 11l1 2.500M12 10l1 2.500M16 11l1 2.500',
  chartdown: 'M3 4v16h18M7 8l4 4 3-3 5 6M19 11v4h-4',
  chartup: 'M3 4v16h18M7 15l4-4 3 3 5-6M15 8h4v4',
  mail: 'M3 6h18v12H3zM3.500 7l8.500 6.500L20.500 7',
  search: 'M10.500 4a6.500 6.500 0 100 13 6.500 6.500 0 000-13zM15.500 15.500L21 21',
  medal: 'M12 14a5 5 0 100-10 5 5 0 000 10zM8.500 13.500L7 21l5-3 5 3-1.500-7.500',
  save: 'M4 4h13l3 3v13H4zM8 4v5h7V4M8 20v-6h8v6',
  folder: 'M3 6h6l2 2h10v11H3z',
  scroll: 'M8 4h10a2 2 0 012 2v1H10M8 4a2 2 0 00-2 2v11a3 3 0 003 3h9a2 2 0 002-2V7M9.500 11h7M9.500 15h5',
  book: 'M4 5a2 2 0 012-2h13v16H6a2 2 0 00-2 2zM4 19a2 2 0 012-2h13M9 7h6',
  money: 'M3 7h18v10H3zM12 9.500a2.500 2.500 0 100 5 2.500 2.500 0 000-5zM6.500 10v4M17.500 10v4',
  factory: 'M3 20V10l6 4v-4l6 4V5h3v15zM7 17h2M12 17h2',
  handshake: 'M2 12l5-4.500 4 2 4-2L20 12l-5 5-3-1-2.500 2.500-3-1.500zM7 7.500L3.500 11M16.500 7.500L20 11',
  swords: 'M4 4l10 10M4 4v4.500l1 1M20 4L10 14M20 4v4.500l-1 1M9 15l-4 4M15 15l4 4M5 17l2 2M17 17l-2 2',
  hammer: 'M14 4l6 6-3 3-6-6zM12 9l-8 8 3 3 8-8',
  flag: 'M5 21V4M5 4h13l-3 4 3 4H5',
  wflag: 'M5 21V4M5 4h13v9H5',
  mountain: 'M2 20l7-13 4 7 3-4 6 10z',
  fire: 'M12 3c1 4 5 5 5 10a5 5 0 01-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3 0-6 1-9z',
  home: 'M3 11l9-7 9 7M5 10v10h14V10M10 20v-6h4v6',
  rotl: 'M4 12a8 8 0 108-8M4 4v5h5',
  rotr: 'M20 12a8 8 0 11-8-8M20 4v5h-5',
  tiltu: 'M6 15l6-6 6 6',
  tiltd: 'M6 9l6 6 6-6',
  mouse: 'M12 3a5 5 0 00-5 5v8a5 5 0 0010 0V8a5 5 0 00-5-5zM12 7v4',
  hand: 'M8 12V6a1.500 1.500 0 013 0v5M11 11V4.500a1.500 1.500 0 013 0V11M14 11V6a1.500 1.500 0 013 0v7c0 4-2 7-6 7-3 0-5-2-6-5l-2-4a1.500 1.500 0 012.500-1L8 14',
  edge: 'M4 4h6M4 4v6M4 4l7 7M20 20h-6M20 20v-6M20 20l-7-7',
  anchor: 'M12 5a2 2 0 100-4 2 2 0 000 4zM12 5v16M7 11H4a8 8 0 0016 0h-3M8 9h8',
  plane: 'M12 3l2 7 8 4v2l-8-2-1 5 3 2v1l-5-1-5 1v-1l3-2-1-5-8 2v-2l8-4z',
  star: 'M12 3l2.800 5.800 6.200.9-4.500 4.400 1 6.200L12 17.400 6.500 20.300l1-6.200L3 9.700l6.200-.9z',
  tree: 'M12 3v18M12 8l-5-3M12 12l6-3M12 16l-5-3M7 5v3M18 9v3',
  ship: 'M3 15l2 5h14l2-5zM12 3v9M12 4l6 7h-6M12 6l-5 5h5',
  shield: 'M12 3l8 3v6c0 5-3.500 8-8 9-4.500-1-8-4-8-9V6z',
  helmet: 'M4 15a8 8 0 1116 0v3H4zM4 15h16M12 7v8',
  cannon: 'M3 14l12-5 3 4-12 5zM17 13l4 3M5 20a3 3 0 100-6 3 3 0 000 6z',
  horse: 'M5 20l2-7-3-3 4-3 3 1 3-4 2 3 4 4-2 3-3-1-2 7M9 7l-1-3'
};
const EMO_ICON = {'💰': 'coin', '⚖': 'scale', '🏆': 'trophy', '🕊': 'globe', '💡': 'bulb', '🏛': 'columns', '👥': 'people', '🍞': 'bread', '📉': 'chartdown', '✉': 'mail', '🔍': 'search', '🏅': 'medal', '💾': 'save', '📂': 'folder', '📜': 'scroll', '📖': 'book', '💷': 'money', '🏭': 'factory', '🤝': 'handshake', '⚔': 'swords', '🏗': 'hammer', '🏴': 'flag', '🏳': 'wflag', '⛰': 'mountain', '📈': 'chartup', '🔥': 'fire', '🏠': 'home', '⟲': 'rotl', '⟳': 'rotr', '⤒': 'tiltu', '⤓': 'tiltd', '🖱': 'mouse', '🖐': 'hand', '⇱': 'edge', '⚓': 'anchor', '✈': 'plane', '★': 'star'};
function icon(name, cls) { const p = ICON_PATHS[name]; return p ? `<svg class="ic ${cls || ''}" viewBox="0 0 24 24" aria-hidden="true"><path d="${p}"/></svg>` : ''; }
// sustituye el emoji de un elemento por su icono SVG
function iconize(root) {
  (root || document).querySelectorAll('.chip > b, .rbtn, .mbtn > span, #camctl button, .mode, .wicon, .mapbtn').forEach(el => {
    if (el.dataset.ic) return;
    const t = el.textContent.replace(/️/g, '').trim(); const n = EMO_ICON[t];
    if (n) { el.innerHTML = icon(n); el.dataset.ic = n; }
  });
}
