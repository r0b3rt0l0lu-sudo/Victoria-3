/* ===== BARRA DE EJÉRCITOS (estilo Hearts of Iron) =====
   Todos tus ejércitos (y los de tus virreinatos) en una barra inferior: retrato del general, divisiones, barras de fuerza y organización, iconos de estado
   (⚔ batalla · ➤ en marcha · ⚓ en el mar · ⚠ sin suministros). Clic: seleccionar (Mayús/Ctrl suma); doble clic: centrar el mapa; clic derecho: detener; rueda: desplazar.
   Retratos: si existe GEN_PORTRAITS[nombre] (imagen) se usa; si no, se genera un retrato grabado por código (uniforme del país, tocado de la época, patillas, medallas
   según el nivel). Para añadir retratos reales de generales famosos, ver PROMPT_RETRATOS_GENERALES_CLAUDE_DESIGN.md. */
const GEN_PORTRAITS = window.GEN_PORTRAITS || {};
const gpHash = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const gpPick = (h, arr, k) => arr[(h >>> (k * 3)) % arr.length];
const _gpCache = {};
function genPortraitSVG(gen, tag) {
  const c = G.C[tag] || {color: '#556'}, key = gen.name + '|' + tag + '|' + gen.lvl + '|' + Math.floor(G.date.y / 20); if (_gpCache[key]) return _gpCache[key];
  const h = gpHash(gen.name + tag), y = G.date.y;
  const skin = gpPick(h, ['#e8c9a6', '#dcb48c', '#d2a57a', '#c99668', '#b98456', '#9a6a44'], 0), hair = gpPick(h, ['#2a2018', '#4a3426', '#6b5642', '#8a7b6a', '#b8b0a4', '#d8d4cc'], 1);
  const col = /^#[0-9a-f]{6}$/i.test(c.color) ? c.color : '#556070', uni = vrShade2(col, -0.35), uni2 = vrShade2(col, -0.55);
  const old = (h >>> 9) % 4 >= 2 || gen.lvl >= 3, gray = old ? gpPick(h, ['#b8b0a4', '#d8d4cc', '#e6e2da'], 3) : hair;
  const facial = (h >>> 12) % 6;   // 0 nada · 1 bigote · 2 patillas · 3 barba · 4 perilla · 5 bigote+patillas
  const hat = y < 1860 ? 'bicorne' : y < 1900 ? 'kepi' : 'peaked';
  const bg1 = gpPick(h, ['#3a4a5c', '#4a3c34', '#2f4a44', '#4c4658'], 5), medals = Math.min(5, 1 + gen.lvl + ((h >>> 20) % 2));
  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 76"><defs><linearGradient id="g${h}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${bg1}"/><stop offset="1" stop-color="#14181c"/></linearGradient></defs><rect width="64" height="76" fill="url(#g${h})"/>`;
  // hombros y uniforme
  s += `<path d="M2 76 C4 58 16 52 32 52 C48 52 60 58 62 76Z" fill="${uni}" stroke="#0c0f12" stroke-width=".8"/><path d="M24 52 L32 64 L40 52 Z" fill="#e6e0d0" stroke="#0c0f12" stroke-width=".5"/>`;
  s += `<path d="M32 64 L32 76" stroke="#0c0f12" stroke-width=".6"/>${[0, 1, 2].map(i => `<circle cx="${28.5 + (i % 2) * 7}" cy="${66 + i * 3.4}" r="1" fill="#d8b44a"/>`).join('')}`;
  s += `<path d="M6 66 C10 58 18 55 24 55 L24 60 C18 60 12 63 10 70Z M58 66 C54 58 46 55 40 55 L40 60 C46 60 52 63 54 70Z" fill="${uni2}" stroke="#0c0f12" stroke-width=".5"/>`;
  for (let i = 0; i < Math.min(3, gen.lvl + 1); i++) s += `<rect x="${5 + i * 2}" y="${62 - i * 1}" width="2" height="1.6" fill="#d8b44a"/><rect x="${57 - i * 2}" y="${62 - i * 1}" width="2" height="1.6" fill="#d8b44a"/>`;
  for (let i = 0; i < medals; i++) s += `<rect x="${42 + (i % 3) * 3.2}" y="${60 + Math.floor(i / 3) * 3.4}" width="2.4" height="2.8" fill="${gpPick(h, ['#c43a3a', '#2f6aa8', '#d8b44a', '#3f8a54'], i % 4)}" stroke="#0c0f12" stroke-width=".3"/>`;
  // cuello y cabeza
  s += `<rect x="27" y="44" width="10" height="11" fill="${skin}" stroke="#0c0f12" stroke-width=".5"/><ellipse cx="32" cy="32" rx="12" ry="15" fill="${skin}" stroke="#0c0f12" stroke-width=".7"/><ellipse cx="20" cy="33" rx="2.2" ry="3.4" fill="${skin}" stroke="#0c0f12" stroke-width=".5"/><ellipse cx="44" cy="33" rx="2.2" ry="3.4" fill="${skin}" stroke="#0c0f12" stroke-width=".5"/>`;
  // pelo (se ve bajo el tocado)
  s += `<path d="M20 28 C20 20 26 17 32 17 C38 17 44 20 44 28 C42 24 38 22 32 22 C26 22 22 24 20 28Z" fill="${gray}"/>`;
  // cara
  s += `<path d="M24 29 q3 -2 6 0 M34 29 q3 -2 6 0" stroke="${gray}" stroke-width="1.4" fill="none"/><ellipse cx="27" cy="32" rx="1.4" ry=".9" fill="#1b1410"/><ellipse cx="37" cy="32" rx="1.4" ry=".9" fill="#1b1410"/><path d="M32 33 q-1.5 5 0 6.5 q1 .5 2 0" stroke="#7a5a3a" stroke-width=".7" fill="none"/>`;
  if (facial === 1 || facial === 5) s += `<path d="M24 40 q4 -3 8 -1 q4 -2 8 1 q-4 1 -8 0 q-4 1 -8 0Z" fill="${gray}" stroke="#0c0f12" stroke-width=".3"/>`;
  if (facial === 2 || facial === 5) s += `<path d="M20 30 q-1 8 4 12 l1 -4 q-3 -3 -3 -8Z M44 30 q1 8 -4 12 l-1 -4 q3 -3 3 -8Z" fill="${gray}"/>`;
  if (facial === 3) s += `<path d="M21 34 q0 14 11 15 q11 -1 11 -15 q-3 8 -11 8 q-8 0 -11 -8Z" fill="${gray}" stroke="#0c0f12" stroke-width=".3"/><path d="M26 40 q6 -2 12 0" stroke="${skin}" stroke-width="1.4" fill="none"/>`;
  if (facial === 4) s += `<path d="M28 44 q4 5 8 0 q-4 1 -8 0Z" fill="${gray}"/>`;
  if (facial === 0 || facial === 2 || facial === 4) s += `<path d="M28 42 q4 1.6 8 0" stroke="#8a5a4a" stroke-width=".9" fill="none"/>`;
  // tocado
  if (hat === 'bicorne') s += `<path d="M8 22 C14 6 50 6 56 22 C48 16 16 16 8 22Z" fill="#1a1d22" stroke="#0c0f12" stroke-width=".7"/><path d="M12 19 C22 12 42 12 52 19" stroke="#d8b44a" stroke-width="1" fill="none"/><circle cx="32" cy="14" r="2" fill="${col}"/>`;
  else if (hat === 'kepi') s += `<path d="M19 22 L21 10 L43 10 L45 22 Z" fill="${uni2}" stroke="#0c0f12" stroke-width=".7"/><rect x="19" y="20" width="26" height="3" fill="${col}"/><path d="M18 23 C26 26 38 26 46 23 L46 25 C38 28 26 28 18 25Z" fill="#14181c"/><path d="M22 14 h20" stroke="#d8b44a" stroke-width=".8"/>`;
  else s += `<path d="M18 22 C18 12 24 9 32 9 C40 9 46 12 46 22Z" fill="${uni2}" stroke="#0c0f12" stroke-width=".7"/><rect x="17" y="20" width="30" height="3.4" fill="#14181c"/><path d="M19 23.4 C26 27 38 27 45 23.4 L45 25 C38 29 26 29 19 25Z" fill="#14181c"/><circle cx="32" cy="16" r="2.6" fill="#d8b44a" stroke="#0c0f12" stroke-width=".4"/><path d="M22 20 q10 -4 20 0" stroke="#d8b44a" stroke-width=".8" fill="none"/>`;
  s += `<rect width="64" height="76" fill="none" stroke="#0c0f12" stroke-width="1.2"/></svg>`;
  return _gpCache[key] = 'data:image/svg+xml;utf8,' + encodeURIComponent(s);
}
function vrShade2(hex, k) { const m = /^#([0-9a-f]{6})$/i.exec(hex || ''); if (!m) return '#445'; const n = parseInt(m[1], 16); const f = v => Math.max(0, Math.min(255, Math.round(v * (1 + k)))); return '#' + [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(f).map(v => v.toString(16).padStart(2, '0')).join(''); }
const GEN_PORTRAITS_GEN = window.GEN_PORTRAITS_GEN || {};
// nación del juego (pool de nombres) → grupo de genéricos: uk fr de ru at it us jp cn ot es · eu (resto de Europa) · as (Asia) · af (África e Hispanoamérica)
const _GP_GRUPO = {uk: 'uk', fr: 'fr', de: 'de', gs: 'de', ru: 'ru', at: 'at', sa: 'it', nc: 'it', pa: 'it', to: 'it', us: 'us', tx: 'us', jp: 'jp', cn: 'cn', tr: 'ot', eg: 'ot', om: 'ot', ma: 'ot', tn: 'ot', sc: 'ot', es: 'es',
  pt: 'eu', se: 'eu', dk: 'eu', nl: 'eu', be: 'eu', ch: 'eu', gr: 'eu', rs: 'eu', ro: 'eu', xx: 'eu', kr: 'as', th: 'as', vn: 'as', mm: 'as', ir: 'as', af: 'as', ca2: 'as', sk: 'as', np: 'as', hy: 'as', as: 'as',
  et: 'af', zu: 'af', mg: 'af', mx: 'af', ca: 'af', co: 'af', ve: 'af', ec: 'af', pe: 'af', bo: 'af', cl: 'af', ar: 'af', py: 'af', uy: 'af', br: 'af'};
const _GP_AFR = {et: 1, zu: 1, mg: 1};
function genPortraitImg(gen, tag) {
  const pool = (typeof _TG !== 'undefined' && _TG[tag]) || 'xx';
  const k = GEN_PORTRAITS[gen.name + '|' + pool] || GEN_PORTRAITS[gen.name]; if (k) return k;
  const y = G.date.y, era = y < 1861 ? 'A' : y < 1891 ? 'B' : y < 1914 ? 'C' : y < 1937 ? 'D' : 'E', g = _GP_GRUPO[pool] || 'eu';
  let n = 1 + gpHash(gen.name + '|' + tag) % 12;
  if (g === 'af') n = 1 + 2 * Math.floor((n - 1) / 2) + (_GP_AFR[pool] ? 0 : 1);   // impares: África · pares: Hispanoamérica
  return GEN_PORTRAITS_GEN['generico_' + g + '_' + era + '_' + n] || null;
}
const genPortrait = (gen, tag) => genPortraitImg(gen, tag) || genPortraitSVG(gen, tag);

/* ---------- barra ---------- */
const AB = {el: null, sig: '', collapsed: false};
(function () {
  const st = document.createElement('style');
  st.textContent = `#armybar{position:fixed;left:8px;right:290px;bottom:66px;z-index:20;display:flex;align-items:flex-end;justify-content:center;gap:0;pointer-events:none;user-select:none}
  #armybar .ab-scroll{display:flex;gap:2px;overflow-x:auto;overflow-y:hidden;pointer-events:auto;padding:0 3px;scrollbar-width:thin;background:linear-gradient(180deg,rgba(20,14,8,.0),rgba(20,14,8,.55));border-radius:6px 6px 0 0}
  #armybar .ab-card{position:relative;flex:0 0 auto;width:74px;height:98px;background:linear-gradient(180deg,#3a2a1c,#1f160e);border:1px solid #8a6a2c;border-bottom:none;border-radius:4px 4px 0 0;cursor:pointer;box-shadow:inset 0 0 0 1px rgba(224,194,122,.25),0 -2px 6px rgba(0,0,0,.5)}
  #armybar .ab-card:hover{border-color:#e0c27a;transform:translateY(-3px)}
  #armybar .ab-card.sel{border-color:#ffe27a;box-shadow:0 0 0 2px #ffe27a,0 -4px 12px rgba(255,226,122,.5);transform:translateY(-6px)}
  #armybar .ab-card.fight{border-color:#d8503a;animation:abpulse 1s infinite alternate}@keyframes abpulse{to{box-shadow:0 0 10px #d8503a}}
  #armybar .ab-top{height:15px;display:flex;align-items:center;justify-content:space-between;padding:0 3px;font:700 10px sans-serif;color:#f3e6c0;background:rgba(0,0,0,.35)}
  #armybar .ab-ph{display:block;width:68px;height:76px;margin:0 auto;background:#111;object-fit:cover;filter:sepia(.18) contrast(1.05)}
  #armybar .ab-bars{position:absolute;left:3px;right:3px;bottom:16px;height:7px}
  #armybar .ab-bars i{display:block;height:3px;margin-top:1px;border-radius:1px;background:rgba(0,0,0,.6);overflow:hidden}#armybar .ab-bars i b{display:block;height:100%}
  #armybar .ab-n{position:absolute;left:0;right:0;bottom:0;height:15px;text-align:center;font:700 11px sans-serif;color:#f3e6c0;line-height:15px;background:rgba(0,0,0,.45);text-shadow:0 1px 1px #000}
  #armybar .ab-flag{position:absolute;right:2px;top:17px;width:16px;opacity:.9}
  #armybar .ab-btn{flex:0 0 auto;width:48px;height:98px;display:flex;align-items:center;justify-content:center;font:700 22px sans-serif;color:#e0c27a;cursor:pointer;pointer-events:auto;background:linear-gradient(180deg,#2a2018,#14100a);border:1px solid #6a5222;border-bottom:none;border-radius:4px 4px 0 0}
  #armybar .ab-btn:hover{color:#fff;border-color:#e0c27a}#armybar .ab-btn small{display:block;font:600 9px sans-serif;margin-top:-2px}
  body.phone #armybar{bottom:122px;right:6px;left:6px}body.phone #armybar .ab-card{width:58px;height:80px}body.phone #armybar .ab-ph{width:52px;height:58px}body.phone #armybar .ab-btn{width:38px;height:80px}body.phone #armybar .ab-bars{bottom:14px}
  body.phone.pl #armybar{bottom:60px}body.win-open #armybar{display:none}body.seamode #armybar,body.airmode #armybar{display:none}`;
  document.head.appendChild(st);
})();
function abArmies() { return G.armies.filter(a => ownsArmy(a) && a.divs.length && !a.garrison).sort((p, q) => (p.tag === G.player ? 0 : 1) - (q.tag === G.player ? 0 : 1) || p.id - q.id); }
function abStats(a) { let s = 0, o = 0, n = a.divs.length; a.divs.forEach(d => { s += d.s; o += d.o / (DIVS[d.t].org || 1); }); return {n, s: s / n, o: o / n}; }
function abStatus(a) { return a.battle ? '⚔' : a.sea ? '⚓' : (a.sup !== undefined && a.sup < 0.45) ? '⚠' : a.path && a.path.length ? '➤' : ''; }
function abRender() {
  if (!UI.started || !G.armies) return; let el = AB.el;
  if (!el) { el = AB.el = document.createElement('div'); el.id = 'armybar'; document.body.appendChild(el);
    el.addEventListener('click', e => { const b = e.target.closest('.ab-btn'); if (b) { if (b.dataset.k === 'all') { const L = abArmies(); if (L.length) { UI.selArmy = L[0].id; UI.selSet = new Set(L.slice(1).map(a => a.id)); renderArmyPanel(); R.labelsDirty = true; toast('🎖️', `${L.length} ejército(s) seleccionados.`); } } else if (b.dataset.k === 'new') { UI.winTab.mil = 'recruit'; openWindow('military'); } AB.sig = ''; return; }
      const cd = e.target.closest('.ab-card'); if (!cd) return; const id = +cd.dataset.id, add = e.shiftKey || e.ctrlKey || e.metaKey; if (!add && UI.selArmy === id && !(UI.selSet && UI.selSet.size)) { UI.selArmy = null; UI.moveMode = false; document.body.classList.remove('movemode'); renderArmyPanel(); R.labelsDirty = true; } else selectArmy(id, add); AB.sig = ''; });
    el.addEventListener('dblclick', e => { const cd = e.target.closest('.ab-card'); if (!cd) return; const a = armyById(+cd.dataset.id); if (a) { selectArmy(a.id); focusProv(a.loc, 40); } });
    el.addEventListener('contextmenu', e => { const cd = e.target.closest('.ab-card'); if (!cd) return; e.preventDefault(); const a = armyById(+cd.dataset.id); if (a) { a.path = []; a.dest = null; toast('✋', `${a.name} se detiene.`); AB.sig = ''; R.labelsDirty = true; } });
    el.addEventListener('wheel', e => { const sc = el.querySelector('.ab-scroll'); if (sc) { sc.scrollLeft += e.deltaY; e.preventDefault(); } }, {passive: false}); }
  const L = abArmies(); if (!L.length) { el.style.display = 'none'; return; } el.style.display = '';
  const sel = new Set([UI.selArmy].concat([...(UI.selSet || [])]));
  const sig = L.map(a => { const q = abStats(a); return [a.id, q.n, Math.round(q.s * 50), Math.round(q.o * 50), abStatus(a), sel.has(a.id) ? 1 : 0, a.gen.name].join(':'); }).join('|');
  if (sig === AB.sig) return; AB.sig = sig; const keep = el.querySelector('.ab-scroll'), sl = keep ? keep.scrollLeft : 0;
  el.innerHTML = `<div class="ab-btn" data-k="all" data-tip="Seleccionar todos los ejércitos">☰<small>Todos</small></div><div class="ab-scroll">${L.map(a => { const q = abStats(a), fight = a.battle ? ' fight' : '', st = abStatus(a), colony = a.tag !== G.player;
    return `<div class="ab-card${sel.has(a.id) ? ' sel' : ''}${fight}" data-id="${a.id}" title="${escA(a.name + ' · ' + a.gen.name + ' (nv. ' + a.gen.lvl + ')')}"><div class="ab-top"><span>${st}</span><span>${'★'.repeat(Math.min(5, a.gen.lvl))}</span></div><img class="ab-ph" src="${genPortrait(a.gen, a.tag)}" alt="">${colony ? `<div class="ab-flag">${flag(a.tag, 'sm')}</div>` : ''}
      <div class="ab-bars"><i><b style="width:${Math.round(q.s * 100)}%;background:${q.s > 0.6 ? '#79c35a' : q.s > 0.3 ? '#e0b04a' : '#d8503a'}"></b></i><i><b style="width:${Math.round(q.o * 100)}%;background:#5aa8e8"></b></i></div><div class="ab-n">${q.n} div · ${Math.round(q.s * 100)}%</div></div>`; }).join('')}</div><div class="ab-btn" data-k="new" data-tip="Reclutar y equipar">＋<small>Reclutar</small></div>`;
  const sc = el.querySelector('.ab-scroll'); if (sc) sc.scrollLeft = sl;
}
setInterval(abRender, 350);
// retrato en el panel del ejército seleccionado
const _renderArmyPanelAB = renderArmyPanel;
renderArmyPanel = function () {
  _renderArmyPanelAB(); const root = $('#armypanel'), a = UI.selArmy ? armyById(UI.selArmy) : null; if (!root || !a || !root.classList.contains('open')) return;
  if (!root.querySelector('.ab-panelph')) { const im = document.createElement('img'); im.className = 'ab-panelph'; im.style.cssText = 'float:left;width:54px;height:62px;margin:0 8px 4px 0;border:1px solid #8a6a2c;border-radius:3px;filter:sepia(.18)'; im.src = genPortrait(a.gen, a.tag); root.insertBefore(im, root.firstChild); }
  AB.sig = '';
};
