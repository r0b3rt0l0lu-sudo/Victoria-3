/* ===== INTERFAZ ===== */
const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
const UI = {win: null, winTab: {}, sel: null, speed: 2, acc: 0, lastHud: 0, lastWin: 0, started: false, dipSel: null, lawSel: null, scroll: {}};

/* ---------- formato ---------- */
function fmtN(n, d) {
  const a = Math.abs(n);
  if (a >= 1e9) return (n / 1e9).toFixed(d ?? 2).replace('.', ',') + ' mil M';
  if (a >= 1e6) return (n / 1e6).toFixed(d ?? 2).replace('.', ',') + ' M';
  if (a >= 1e4) return (n / 1e3).toFixed(d ?? 1).replace('.', ',') + ' k';
  return Math.round(n).toLocaleString('es-ES');
}
const money = n => (n < 0 ? '−' : '') + '£' + fmtN(Math.abs(n));
const f1 = n => (+n).toFixed(1).replace('.', ',');
const pctS = (n, d = 0) => (n * 100).toFixed(d).replace('.', ',') + '%';
const sgn = (n, d = 1) => (n > 0 ? '+' : n < 0 ? '−' : '') + Math.abs(n).toFixed(d).replace('.', ',');
function dateStr(d) { d = d || G.date; return `${d.d} de ${MONTHS[d.m]} de ${d.y}`; }

/* ---------- banderas ---------- */
function flagSVG(spec, uid) {
  const p = spec.split(':'), t = p[0], c = p.slice(1);
  let g = '';
  const W = 30, H = 20;
  switch (t) {
    case 'h2': g = `<rect width="30" height="10" fill="${c[0]}"/><rect y="10" width="30" height="10" fill="${c[1]}"/>`; break;
    case 'h3': g = `<rect width="30" height="7" fill="${c[0]}"/><rect y="6.6" width="30" height="6.8" fill="${c[1]}"/><rect y="13.2" width="30" height="6.8" fill="${c[2]}"/>`; break;
    case 'h5': g = `<rect width="30" height="20" fill="${c[0]}"/><rect y="3.3" width="30" height="13.4" fill="${c[1]}"/><rect y="6.6" width="30" height="6.8" fill="${c[2]}"/>`; break;
    case 'v3': g = `<rect width="10" height="20" fill="${c[0]}"/><rect x="10" width="10" height="20" fill="${c[1]}"/><rect x="20" width="10" height="20" fill="${c[2] || c[0]}"/>`; break;
    case 'cross': g = `<rect width="30" height="20" fill="${c[0]}"/><rect x="8" width="4.5" height="20" fill="${c[1]}"/><rect y="7.7" width="30" height="4.6" fill="${c[1]}"/>`; break;
    case 'cross2': g = `<rect width="30" height="20" fill="${c[0]}"/><rect x="12.5" y="3" width="5" height="14" fill="${c[1]}"/><rect x="8" y="7.5" width="14" height="5" fill="${c[1]}"/>`; break;
    case 'disc': g = `<rect width="30" height="20" fill="${c[0]}"/><circle cx="15" cy="10" r="5.6" fill="${c[1]}"/>`; break;
    case 'ukj': g = `<rect width="30" height="20" fill="${c[0]}"/><path d="M0 0L30 20M30 0L0 20" stroke="${c[1]}" stroke-width="4"/><path d="M0 0L30 20M30 0L0 20" stroke="${c[2]}" stroke-width="1.4"/><path d="M15 0V20M0 10H30" stroke="${c[1]}" stroke-width="6"/><path d="M15 0V20M0 10H30" stroke="${c[2]}" stroke-width="3.2"/>`; break;
    case 'usa': {
      let st = ''; for (let i = 0; i < 7; i++) st += `<rect y="${i * 20 / 7 * 1}" width="30" height="${20 / 13 * 1}" fill="${c[0]}" transform="translate(0 ${i * 20 / 13})"/>`;
      g = `<rect width="30" height="20" fill="${c[1]}"/>` + [0, 2, 4, 6, 8, 10, 12].map(i => `<rect y="${i * 20 / 13}" width="30" height="${20 / 13}" fill="${c[0]}"/>`).join('') + `<rect width="13" height="10.8" fill="${c[2]}"/>`;
      break;
    }
    default: g = `<rect width="30" height="20" fill="#777"/>`;
  }
  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">${g}</svg>`;
}
function flag(tag, cls) {
  const c = G.C[tag]; if (!c) return '';
  return `<span class="flag ${cls || ''}" style="--fc:${c.color}">${flagSVG(c.flagSpec)}</span>`;
}

/* ---------- gráficos ---------- */
function spark(arr, w = 120, h = 28, color = '#c9a657', base) {
  if (!arr || arr.length < 2) return `<svg width="${w}" height="${h}"></svg>`;
  let mn = Math.min(...arr), mx = Math.max(...arr); if (base !== undefined) { mn = Math.min(mn, base); mx = Math.max(mx, base); }
  if (mx - mn < 1e-9) { mx += 1; mn -= 1; }
  const pts = arr.map((v, i) => `${(i / (arr.length - 1) * (w - 2) + 1).toFixed(1)},${(h - 2 - (v - mn) / (mx - mn) * (h - 4)).toFixed(1)}`).join(' ');
  const bl = base !== undefined ? `<line x1="0" x2="${w}" y1="${(h - 2 - (base - mn) / (mx - mn) * (h - 4)).toFixed(1)}" y2="${(h - 2 - (base - mn) / (mx - mn) * (h - 4)).toFixed(1)}" stroke="rgba(255,255,255,.18)" stroke-dasharray="2 2"/>` : '';
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${bl}<polyline fill="none" stroke="${color}" stroke-width="1.6" points="${pts}"/></svg>`;
}
const bar = (v, max, cls = '', label = '') => `<div class="bar ${cls}"><i style="width:${clamp(v / max, 0, 1) * 100}%"></i>${label ? `<span>${label}</span>` : ''}</div>`;

/* ---------- HUD ---------- */
function me() { return G.C[G.player]; }
function buildHud() {
  $('#hud').innerHTML = `
  <div id="plaque">
    <div class="crest" id="crest"></div>
    <div class="pl-main">
      <div class="pl-name" id="pl-name"></div>
      <div class="pl-sub" id="pl-sub"></div><div class="pl-focus" id="pl-focus"></div><div class="pl-traits" id="pl-traits"></div>
    </div>
    <div class="chips">
      <div class="chip" id="ch-treasury" data-tip="Tesoro del Estado"><b>💰</b><span></span></div>
      <div class="chip" id="ch-balance" data-tip="Balance semanal"><b>⚖️</b><span></span></div>
      <div class="chip" id="ch-prestige" data-tip="Prestigio"><b>🏆</b><span></span></div>
      <div class="chip" id="ch-influence" data-tip="Influencia diplomática"><b>🕊️</b><span></span></div>
      <div class="chip" id="ch-innov" data-tip="Innovación"><b>💡</b><span></span></div>
      <div class="chip" id="ch-leg" data-tip="Legitimidad del gobierno"><b>🏛️</b><span></span></div>
      <div class="chip" id="ch-pop" data-tip="Población"><b>👥</b><span></span></div>
      <div class="chip" id="ch-sol" data-tip="Nivel de vida medio"><b>🍞</b><span></span></div>
      <div class="chip clk" id="ch-crisis" data-act="goCrisis" data-tip="Crisis económicas activas"><b>📉</b><span></span></div>
      <div class="chip clk" id="ch-mail" data-act="goMail" data-tip="Propuestas diplomáticas pendientes"><b>✉️</b><span></span></div>
    </div>
  </div>
  <div id="datebox">
    <button class="spd" data-act="pause" id="btn-pause" title="Pausa (Espacio)">⏸</button>
    <div class="date" id="datetxt"></div>
    <div class="speeds">${[1, 2, 3, 4, 5].map(i => `<button class="spd s" data-act="speed" data-n="${i}" title="Velocidad ${i}"><i></i></button>`).join('')}</div>
  </div>
  <div id="topright">
    <button class="rbtn" data-act="search" title="Buscar país o estado (Ctrl+K)">🔍</button>
    <button class="rbtn" data-act="win" data-w="achievements" title="Logros">🏅</button>
    <button class="rbtn" data-act="save" title="Guardar partida">💾</button>
    <button class="rbtn" data-act="load" title="Cargar partida">📂</button>
    <button class="rbtn" data-act="win" data-w="journal" title="Diario">📜</button>
    <button class="rbtn" data-act="win" data-w="manual" title="Manual del juego (F1)">📖</button>
    <button class="rbtn home" data-act="gomenu" title="Volver al menú principal">🚪</button>
  </div>
  <div id="menu">
    ${[['budget', '💷', 'Presupuesto'], ['production', '🏭', 'Producción y mercado'], ['pops', '👥', 'Población'], ['politics', '🏛️', 'Política'], ['tech', '💡', 'Tecnología'], ['diplomacy', '🤝', 'Diplomacia'], ['military', '⚔️', 'Ejército y guerra'], ['construction', '🏗️', 'Construcción'], ['national', '🌳', 'Decisiones nacionales']]
      .map(([id, ic, t]) => `<button class="mbtn" data-act="win" data-w="${id}" data-tip="${t}" id="mb-${id}"><span>${ic}</span></button>`).join('')}
  </div>
  <div id="camctl">
    <button data-act="zin" title="Acercar (+)">＋</button><button data-act="zout" title="Alejar (−)">－</button>
    <button data-act="camhome" title="Vista inicial">🏠</button>
    <button data-act="rotl" title="Girar a la izquierda (Q)">⟲</button><button data-act="rotr" title="Girar a la derecha (E)">⟳</button>
    <button data-act="tiltu" title="Inclinar más (R)">⤒</button><button data-act="tiltd" title="Inclinar menos (F)">⤓</button>
    <button data-act="wheelmode" id="btn-wheel" title="Rueda del ratón: zoom o desplazar">🖱️</button>
    <button data-act="animtoggle" id="btn-anim" title="Animaciones del mapa: agua y nubes">≈</button>
    <button data-act="edgescroll" id="btn-edge" title="Desplazar al acercar el ratón al borde de la pantalla">⇱</button>
  </div>
  <div id="mapctl">
    <canvas id="minimap" width="260" height="104"></canvas>
    <div id="modes">${MAP_MODES.map(m => `<button class="mode ${m.id === R.mode ? 'on' : ''}" data-act="mode" data-m="${m.id}" data-tip="${m.name}">${m.icon}</button>`).join('')}</div>
  </div>`;
  $('#minimap').addEventListener('mousedown', e => minimapJump(e));
  $('#minimap').addEventListener('mousemove', e => { if (e.buttons) minimapJump(e); });
  $('#crest').innerHTML = '';
  syncCamBtns(); iconize($('#hud'));
}
function syncCamBtns() { const an = $('#btn-anim'); if (an) an.classList.toggle('on', !!R.anim); const w = $('#btn-wheel'), e2 = $('#btn-edge'); if (w) { w.classList.toggle('on', R.wheelMode === 'pan'); w.innerHTML = icon(R.wheelMode === 'pan' ? 'hand' : 'mouse'); } if (e2) e2.classList.toggle('on', !!R.edgeScroll); }
function minimapJump(e) {
  const r = e.currentTarget.getBoundingClientRect();
  const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
  focusLonLat(-180 + x * 360, LAT_TOP - y * (LAT_TOP - LAT_BOT));
}

function updateHud(force) {
  const c = me(); if (!c) return;
  const st = c.stats;
  { const pq = $('#plaque'); if (pq) document.documentElement.style.setProperty('--ph', (pq.offsetHeight + 10) + 'px'); }
  $('#crest').innerHTML = flag(c.tag, 'big');
  $('#pl-name').textContent = c.name;
  $('#pl-sub').textContent = `${c.gov} · Rango ${c.rank}`;
  { const pf = $('#pl-focus'); const cu = c.nat && c.nat.cur && natNode(c, c.nat.cur.id); pf.textContent = cu ? `🌳 ${cu.name} · ${Math.ceil(c.nat.cur.left / 7)} sem.` : ''; pf.style.display = cu ? 'block' : 'none'; }
  const tb = (c.traits || []).map(id => TRAITS[id]).filter(Boolean).map(t => `<span class="tchip ${t.good ? 'g' : 'b'}" data-tip="${traitTip(t)}">${t.icon}</span>`).join('');
  const tr = $('#pl-traits'); if (tr && tr.dataset.k !== tb) { tr.innerHTML = tb; tr.dataset.k = tb; }
  const set = (id, txt, tip) => { const e = $('#' + id); e.querySelector('span').textContent = txt; if (tip) e.dataset.tip = tip; };
  set('ch-treasury', money(c.treasury), `<b>Tesoro</b><br>${money(c.treasury)}`);
  const bal = st.income - st.expense - (c.budget.expense.constr || 0) - (c.budget.expense.pub || 0) - (c.budget.expense.interest || 0) - (c.budget.expense.army || 0) - (c.budget.expense.equip || 0);
  set('ch-balance', (bal >= 0 ? '+' : '') + fmtN(bal, 1), `<b>Balance semanal</b><br>Ingresos ${money(st.income)}<br>Gastos ${money(st.expense + (c.budget.expense.constr || 0) + (c.budget.expense.pub || 0) + (c.budget.expense.army || 0) + (c.budget.expense.equip || 0))}`);
  $('#ch-balance').classList.toggle('neg', bal < 0);
  set('ch-prestige', Math.round(c.prestige), '<b>Prestigio</b><br>Determina tu posición entre las potencias.');
  set('ch-influence', Math.floor(c.influence), '<b>Influencia</b><br>Se gasta en reformas, guerras y diplomacia.');
  set('ch-innov', Math.floor(c.innovStock) + ' (+' + f1(st.innovRate) + ')', `<b>Innovación</b><br>${f1(st.innovRate)} puntos/semana`);
  set('ch-leg', Math.round(c.legitimacy) + '%', '<b>Legitimidad</b><br>Por debajo del 40% crecen los disturbios.');
  set('ch-pop', fmtN(st.pop, 1), '<b>Población</b>');
  set('ch-sol', f1(st.sol), '<b>Nivel de vida medio</b><br>En una escala de 0 a 25.');
  const ncr = G.crises.filter(x => x.scope === 'global' || x.scope === G.player).length;
  set('ch-crisis', ncr, ncr ? '<b>Crisis activas</b><br>' + G.crises.filter(x => x.scope === 'global' || x.scope === G.player).map(x => x.icon + ' ' + x.name + ' (' + x.left + ' m)').join('<br>') : '<b>Sin crisis activas</b>');
  $('#ch-crisis').classList.toggle('neg', ncr > 0);
  set('ch-mail', G.proposals.length, '<b>Propuestas diplomáticas</b><br>' + (G.proposals.length ? 'Tienes propuestas pendientes' : 'Sin propuestas'));
  $('#ch-mail').classList.toggle('alert', G.proposals.length > 0);
  $('#datetxt').textContent = dateStr();
  $('#btn-pause').textContent = G.paused ? '▶' : '⏸';
  $$('#datebox .speeds .s').forEach((b, i) => b.classList.toggle('on', i < UI.speed));
  $('#datebox').classList.toggle('paused', G.paused);
}

/* ---------- ventanas ---------- */
const WINDOWS = {};
function openWindow(id) {
  if (UI.win === id) { closeWindow(); return; }
  UI.win = id; renderWindow(true);
  $$('#menu .mbtn').forEach(b => b.classList.toggle('on', b.id === 'mb-' + id));
}
function closeWindow() { UI.win = null; $('#windows').innerHTML = ''; $('#windows').classList.remove('open'); $$('#menu .mbtn').forEach(b => b.classList.remove('on')); }
function renderWindow(fresh) {
  if (!UI.win) return;
  const w = WINDOWS[UI.win]; const root = $('#windows');
  const prev = root.querySelector('.wbody'); const sc = prev && !fresh ? prev.scrollTop : 0;
  const scs = {}; if (prev && !fresh) $$('.scrollable', root).forEach((e, i) => scs[i] = e.scrollTop);
  root.classList.add('open');
  root.innerHTML = `<div class="window w-${UI.win}"><div class="whead"><span class="wicon">${w.icon}</span><h2>${w.title}</h2><button class="x" data-act="closewin">✕</button></div><div class="wbody">${w.render()}</div></div>`;
  iconize(root); const nb = root.querySelector('.wbody'); if (nb) nb.scrollTop = sc;
  if (!fresh) $$('.scrollable', root).forEach((e, i) => { if (scs[i] !== undefined) e.scrollTop = scs[i]; });
}

function tabs(key, list) {
  const cur = UI.winTab[key] || list[0][0];
  return `<div class="tabs">${list.map(([id, name]) => `<button class="tab ${cur === id ? 'on' : ''}" data-act="tab" data-k="${key}" data-t="${id}">${name}</button>`).join('')}</div>`;
}
const curTab = (key, def) => UI.winTab[key] || def;

function countryAgg(c) {
  const a = {prof: {}, strata: {upper: 0, middle: 0, lower: 0}, pop: 0, inc: {}, sol: {}};
  PROF_ORDER.forEach(p => { a.prof[p] = 0; a.inc[p] = 0; a.sol[p] = 0; });
  c.states.forEach(i => {
    const s = G.S[i];
    for (const p in s.pops) { const n = s.pops[p]; a.prof[p] += n; a.pop += n; a.strata[PROFS[p].strat] += n; a.inc[p] += s.inc[p] || 0; a.sol[p] += (s.sol[p] || 0) * n; }
  });
  PROF_ORDER.forEach(p => { a.sol[p] = a.prof[p] ? a.sol[p] / a.prof[p] : 0; });
  return a;
}

/* --- Presupuesto --- */
WINDOWS.budget = {title: 'Presupuesto', icon: '💷', render() {
  const c = me(), st = c.stats, b = c.budget;
  const exp = (b.expense.gov || 0) + (b.expense.constr || 0) + (b.expense.pub || 0) + (b.expense.interest || 0) + (b.expense.army || 0) + (b.expense.equip || 0);
  const inc = st.income, bal = inc - exp;
  const row = (n, v, cls = '') => `<tr class="${cls}"><td>${n}</td><td class="r">${money(v)}</td></tr>`;
  return `
  <div class="cols">
   <div class="col">
    <div class="card">
      <h3>Resumen semanal</h3>
      <table class="tbl">
        ${row('Impuesto sobre la renta', b.income.tax || 0)}${row('Impuesto al consumo', b.income.ctax || 0)}
        <tr class="tot"><td>Ingresos</td><td class="r good">${money(inc)}</td></tr>
        ${row('Salarios públicos (admin., ejército, universidades)', b.expense.gov || 0)}${row('Construcción pública', b.expense.constr || 0)}${row('Mantenimiento de las divisiones', b.expense.army || 0)}${row('Compra de armas, caballos y pólvora', b.expense.equip || 0)}${row('Servicios públicos y obras menores', b.expense.pub || 0)}${row('Intereses de la deuda', b.expense.interest || 0)}
        <tr class="tot"><td>Gastos</td><td class="r bad">${money(exp)}</td></tr>
        <tr class="tot"><td>Balance</td><td class="r ${bal >= 0 ? 'good' : 'bad'}">${money(bal)}</td></tr>
      </table>
      <div class="kv"><span>Tesoro</span><b>${money(c.treasury)}</b></div>
      <div class="kv"><span>Deuda</span><b>${money(c.debt)}</b></div>
    </div>
    <div class="card"><h3>Evolución</h3>
      <div class="chartrow"><span>Tesoro</span>${spark(c.hist.treasury, 220, 40, '#c9a657')}</div>
      <div class="chartrow"><span>PIB semanal</span>${spark(c.hist.gdp, 220, 40, '#7fb4d8')}</div>
      <div class="chartrow"><span>Nivel de vida</span>${spark(c.hist.sol, 220, 40, '#8cc07a')}</div>
    </div>
   </div>
   <div class="col">
    <div class="card"><h3>Impuesto sobre la renta</h3>
      <div class="seg">${TAX_NAMES.map((n, i) => `<button class="${c.taxLevel === i ? 'on' : ''}" data-act="tax" data-n="${i}">${n}<small>${pctS(TAX_LEVELS[i])}</small></button>`).join('')}</div>
      <div class="kv"><span>Eficiencia de recaudación</span><b>${pctS(st.taxEff)}</b></div>
      ${bar(st.bur, st.burNeed, st.bur < st.burNeed ? 'warn' : '', `Burocracia ${Math.round(st.bur)} / ${Math.round(st.burNeed)}`)}
      <p class="hint">Construye más <b>Administración</b> para recaudar mejor. Los impuestos altos reducen el consumo de la población.</p>
    </div>
    <div class="card"><h3>Impuesto al consumo</h3>
      <div class="seg">${['Ninguno', 'Bajo', 'Medio', 'Alto'].map((n, i) => `<button class="${c.consTax === i ? 'on' : ''}" data-act="ctax" data-n="${i}">${n}<small>${i * 4}%</small></button>`).join('')}</div>
    </div>
    <div class="card"><h3>Financiación</h3>
      <div class="kv"><span>🎖️ Ejército</span><span class="seg sm">${[0.5, 0.75, 1, 1.25, 1.5].map(v => `<button class="${c.milFund === v ? 'on' : ''}" data-act="mil" data-v="${v}">${v * 100}%</button>`).join('')}</span></div>
      <div class="kv"><span>🎓 Educación</span><span class="seg sm">${[0.5, 0.75, 1, 1.25, 1.5].map(v => `<button class="${c.eduFund === v ? 'on' : ''}" data-act="edu" data-v="${v}">${v * 100}%</button>`).join('')}</span></div>
      <p class="hint">Más financiación mejora el ejército y la innovación pero aumenta los salarios públicos.</p>
    </div>
   </div>
  </div>`;
}};

/* --- Producción y mercado --- */
WINDOWS.production = {title: 'Producción y mercado', icon: '🏭', render() {
  const t = curTab('prod', 'market'); const c = me();
  let body = '';
  if (t === 'market') {
    const cats = {}; GOODS.forEach(g => (cats[g.cat] = cats[g.cat] || []).push(g));
    body = `<div class="scrollable tall"><table class="tbl goods"><thead><tr><th>Bien</th><th class="r">Precio</th><th>Tendencia</th><th class="r">Producción mundial</th><th class="r">Demanda</th><th>Balance</th></tr></thead><tbody>` +
      Object.keys(cats).map(k => `<tr class="cat"><td colspan="6">${k}</td></tr>` + cats[k].map(g => {
        const p = G.price[g.id], rel = p / g.base - 1; const bal = G.prod[g.id] / Math.max(1, G.dem[g.id]) - 1;
        return `<tr><td><span class="gi" style="background:${g.color}">${g.icon}</span> ${g.name}</td><td class="r"><b>£${f1(p)}</b> <small class="${rel > 0.03 ? 'bad' : rel < -0.03 ? 'good' : ''}">${sgn(rel * 100, 0)}%</small></td><td>${spark(G.hist[g.id].slice(-70), 90, 22, rel > 0 ? '#d98a6a' : '#8cc07a', g.base)}</td><td class="r">${fmtN(G.prod[g.id], 1)}</td><td class="r">${fmtN(G.dem[g.id], 1)}</td><td>${Math.abs(bal) < 0.03 ? '<span class="tag">Equilibrio</span>' : bal > 0 ? '<span class="tag good">Excedente</span>' : '<span class="tag bad">Déficit</span>'}</td></tr>`;
      }).join('')).join('') + `</tbody></table></div>`;
  } else if (t === 'crisis') {
    body = crisisTab();
  } else {
    const rows = BUILDINGS.map(b => {
      let lv = 0, cap = 0, jobs = 0, va = 0, n = 0;
      c.states.forEach(i => { const s = G.S[i]; lv += s.b[b.id] || 0; cap += s.cap[b.id] || 0; if (s.bva && s.bva[b.id] !== undefined && s.b[b.id]) { va += s.bva[b.id]; n++; } });
      const locked = b.tech && !c.techs.has(b.tech);
      return `<tr class="${locked ? 'locked' : ''}"><td><span class="gi">${b.icon}</span> ${b.name}${locked ? ` <small class="dim">🔒 ${TECH[b.tech].name}</small>` : ''}</td><td>${b.grp}</td><td class="r">${Math.round(lv)}</td><td class="r">${Math.round(cap)}</td><td class="r">${b.out ? money(n ? va / n : 0) : '—'}</td></tr>`;
    }).join('');
    body = `<div class="scrollable tall"><table class="tbl"><thead><tr><th>Edificio</th><th>Tipo</th><th class="r">Niveles</th><th class="r">Capacidad</th><th class="r">Valor añadido/nivel</th></tr></thead><tbody>${rows}</tbody></table></div><p class="hint">Selecciona un estado en el mapa para construir nuevos niveles. Los inversores privados también construyen donde hay más beneficio.</p>`;
  }
  return tabs('prod', [['market', 'Mercado mundial'], ['buildings', 'Edificios del país'], ['crisis', `Crisis y ciclo${G.crises.filter(x => x.scope === 'global' || x.scope === G.player).length ? ' ⚠️' : ''}`]]) + body;
}};

/* --- Población --- */
WINDOWS.pops = {title: 'Población', icon: '👥', render() {
  const c = me(), a = countryAgg(c), st = c.stats;
  const rows = PROF_ORDER.map(p => `<tr><td>${PROFS[p].name}</td><td><small class="dim">${STRATA_NAME[PROFS[p].strat]}</small></td><td class="r">${fmtN(a.prof[p], 1)}</td><td class="r">${pctS(a.prof[p] / Math.max(1, a.pop), 1)}</td><td class="r">${f1(a.sol[p])}</td><td class="r">£${f1(a.inc[p] / Math.max(1, a.prof[p]))}</td></tr>`).join('');
  const strata = ['upper', 'middle', 'lower'].map(k => `<div class="kv"><span>${STRATA_NAME[k]}</span><b>${fmtN(a.strata[k], 1)} (${pctS(a.strata[k] / Math.max(1, a.pop), 1)})</b></div>${bar(a.strata[k], a.pop)}`).join('');
  const un = c.states.reduce((t, i) => t + (G.S[i].unempU || 0), 0);
  return `<div class="cols"><div class="col wide"><div class="card"><h3>Grupos de población</h3><table class="tbl"><thead><tr><th>Profesión</th><th>Estrato</th><th class="r">Habitantes</th><th class="r">%</th><th class="r">Nivel de vida</th><th class="r">Ingreso/persona/sem.</th></tr></thead><tbody>${rows}</tbody></table></div></div>
  <div class="col"><div class="card"><h3>Sociedad</h3>
   <div class="kv"><span>Población total</span><b>${fmtN(a.pop, 2)}</b></div>
   <div class="kv"><span>Nivel de vida medio</span><b>${f1(st.sol)}</b></div>
   <div class="kv"><span>Alfabetización</span><b>${f1(c.lit)}%</b></div>${bar(c.lit, 100, 'blue')}
   <div class="kv"><span>Radicales</span><b>${pctS(c.radicals)}</b></div>${bar(c.radicals, 0.6, 'bad')}
   <div class="kv"><span>Leales</span><b>${pctS(c.loyalists)}</b></div>${bar(c.loyalists, 0.6, 'good')}
   <div class="kv"><span>Obreros en paro</span><b>${fmtN(un, 1)}</b></div>
   <div class="kv"><span>Ejército</span><b>${fmtN(st.soldiers, 1)}</b></div>
  </div><div class="card"><h3>Estratos</h3>${strata}</div></div></div>`;
}};

/* --- Política --- */
function faceFor(v) { return v < -6 ? '😡' : v < -2.5 ? '😠' : v < -0.5 ? '😕' : v < 1.5 ? '😐' : v < 4 ? '🙂' : v < 7 ? '😊' : '😍'; }
WINDOWS.politics = {title: 'Política', icon: '🏛️', render() {
  const c = me(); const t = curTab('pol', 'igs');
  let body = '';
  if (t === 'igs') {
    body = `<div class="cols"><div class="col"><div class="card"><h3>Gobierno</h3>
      <div class="kv"><span>Régimen</span><b>${c.gov}</b></div>
      <div class="kv"><span>Estructura de poder</span><b>${LAW[c.laws.power].name}</b></div>
      <div class="kv"><span>Legitimidad</span><b>${Math.round(c.legitimacy)}%</b></div>${bar(c.legitimacy, 100, c.legitimacy < 40 ? 'bad' : c.legitimacy < 60 ? 'warn' : 'good')}
      <div class="kv"><span>Radicales</span><b>${pctS(c.radicals)}</b></div>${bar(c.radicals, 0.6, 'bad')}
      <div class="kv"><span>Leales</span><b>${pctS(c.loyalists)}</b></div>${bar(c.loyalists, 0.6, 'good')}
      <p class="hint">La coalición de gobierno son los grupos de interés con más influencia que suman la mitad del poder político.</p>
      <h4 class="sub">Rasgos nacionales</h4><div class="traits">${traitsHtml(c)}</div>
      ${c.lawChange ? `<div class="notice">📜 Reforma en curso: <b>${LAW[c.lawChange.opt].name}</b> — ${c.lawChange.months} meses · probabilidad de éxito ${pctS(c.lawChange.chance)}</div>` : ''}
    </div></div>
    <div class="col wide"><div class="card"><h3>Grupos de interés</h3><div class="igs">${IG_ORDER.slice().sort((a, b) => c.ig[b].share - c.ig[a].share).map(k => { const g = c.ig[k], d = IGS[k]; return `
      <div class="ig ${g.gov ? 'gov' : ''}" data-tip="<b>${d.name}</b><br>${d.desc}"><div class="igh"><span class="igi" style="background:${d.color}">${d.icon}</span><div><b>${d.name}</b><small>${g.gov ? 'En el gobierno' : 'Oposición'}</small></div><span class="face">${faceFor(g.approval)}</span></div>
      <div class="kv"><span>Influencia</span><b>${pctS(g.share, 1)}</b></div>${bar(g.share, 0.5, '', '')}
      <div class="kv"><span>Aprobación</span><b class="${g.approval < -1 ? 'bad' : g.approval > 1 ? 'good' : ''}">${sgn(g.approval)}</b></div></div>`; }).join('')}</div></div></div></div>`;
  } else if (t === 'mov') {
    body = movTabHtml();
  } else if (t === 'ideo') {
    body = ideoTab();
  } else {
    const sel = UI.lawSel && LAW[UI.lawSel] ? LAW[UI.lawSel] : null;
    body = `<div class="laws scrollable tall">${LAW_CATS.map(cat => `<div class="lawcat"><h4>${cat.icon} ${cat.name}</h4><div class="lawopts">${cat.opts.map(o => {
      const act = c.laws[cat.id] === o.id; const locked = o.tech && !c.techs.has(o.tech);
      return `<button class="lawopt ${act ? 'act' : ''} ${locked ? 'locked' : ''} ${UI.lawSel === o.id ? 'sel' : ''}" data-act="lawsel" data-id="${o.id}">${act ? '✔ ' : ''}${o.name}${locked ? ' 🔒' : ''}</button>`; }).join('')}</div></div>`).join('')}</div>
      <div class="lawdetail">${sel ? (() => {
        const cur = c.laws[sel.cat] === sel.id; const sup = lawSupport(c, sel.id); const chance = clamp(0.5 + sup * 0.25 + (c.legitimacy - 50) / 250, 0.05, 0.97);
        const modsTxt = Object.keys(sel.mods).map(k => `${MODNAME[k] || k}: <b class="${sel.mods[k] * (MODGOOD[k] ?? 1) >= 0 ? 'good' : 'bad'}">${sgn(sel.mods[k] * 100, 0)}%</b>`).join(' · ') || 'Sin efectos mecánicos directos.';
        const stances = IG_ORDER.map(k => ({k, w: IGS[k].likes[sel.id] || 0})).filter(x => x.w).sort((a, b) => b.w - a.w).map(x => `<span class="tag ${x.w > 0 ? 'good' : 'bad'}">${IGS[x.k].icon} ${IGS[x.k].name} ${x.w > 0 ? '👍' : '👎'}</span>`).join(' ');
        return `<h3>${sel.name}</h3><p>${sel.desc}</p><p class="hint">${modsTxt}</p><div>${stances || '<small class="dim">Ningún grupo tiene una postura marcada.</small>'}</div>
        ${cur ? '<div class="notice">Esta ley está en vigor.</div>' : `<div class="kv"><span>Probabilidad de aprobación</span><b>${pctS(chance)}</b></div><button class="primary" data-act="enact" data-id="${sel.id}" ${c.lawChange || (sel.tech && !c.techs.has(sel.tech)) ? 'disabled' : ''}>Promulgar reforma (50 influencia)</button>${sel.tech && !c.techs.has(sel.tech) ? `<small class="bad">Requiere: ${TECH[sel.tech].name}</small>` : ''}`}`;
      })() : '<p class="hint">Selecciona una ley para ver sus efectos y las posturas de los grupos de interés.</p>'}</div>`;
  }
  return tabs('pol', [['igs', 'Gobierno y grupos de interés'], ['ideo', 'Ideologías y cambio de régimen'], ['mov', 'Elecciones y movimientos'], ['laws', 'Leyes']]) + body;
}};
const MODNAME = {tax: 'Recaudación', bur: 'Burocracia', invest: 'Inversión privada', lit: 'Alfabetización', grow: 'Crecimiento', army: 'Ejército', rad: 'Radicalismo', out: 'Producción', lab: 'Cuota salarial', stab: 'Estabilidad'};
const MODGOOD = {rad: -1};

/* --- Tecnología --- */
const TECHFX = {agriOut: 'Prod. agrícola', mineOut: 'Prod. minera', indOut: 'Prod. industrial', steelOut: 'Prod. de acero', constr: 'Construcción', innov: 'Innovación', bur: 'Burocracia', tax: 'Recaudación', invest: 'Inversión privada', grow: 'Crecimiento', army: 'Potencia militar', lit: 'Alfabetización', infra: 'Infraestructura', milCost: 'Coste militar', defense: 'Defensa', logistics: 'Logística', crisis: 'Resistencia a crisis', stab: 'Legitimidad', rad: 'Radicalismo'};
const TECHFX_PTS = {stab: 1, rad: 1};
const TECHFX_BADPOS = {rad: 1, milCost: 1};
function fxText(fx) {
  return Object.keys(fx).map(k => {
    const v = fx[k], pts = TECHFX_PTS[k]; const good = TECHFX_BADPOS[k] ? v < 0 : v > 0;
    return `<span class="${good ? 'good' : 'bad'}">${TECHFX[k] || k} ${pts ? sgn(v, 1) : sgn(v * 100, 0) + '%'}</span>`;
  }).join(' · ');
}
WINDOWS.tech = {title: 'Tecnología', icon: '💡', render() {
  const c = me(), st = c.stats;
  const cur = c.research ? TECH[c.research] : null;
  const eras = [1, 2, 3].map(e => {
    const E = ERAS[e], un = eraUnlocked(c, e), cnt = eraCount(c, e), tot = TECHS.filter(t => t.era === e).length;
    return `<div class="era ${un ? 'open' : ''}"><b>Era ${e}: ${E.name}</b><small>${un ? `${cnt} de ${tot} investigadas` : `🔒 Año ${E.needYear} y ${E.needPrev} tecnologías de la era ${e - 1} (${eraCount(c, e - 1)}/${E.needPrev})`}</small>${bar(cnt, tot, 'gold')}</div>`;
  }).join('');
  const total = TECHS.length, done = c.techs.size;
  return `<div class="card"><div class="kv"><span>Puntos de innovación</span><b>${Math.floor(c.innovStock)} <small>(+${f1(st.innovRate)}/semana)</small></b></div>
   ${cur ? `<div class="kv"><span>Investigando: <b>${cur.name}</b></span><b>${Math.min(100, Math.floor(c.innovStock / techCost(c, cur) * 100))}% · coste ${techCost(c, cur)}</b></div>${bar(c.innovStock, techCost(c, cur), 'gold')}<button data-act="cancelresearch">Cambiar de investigación</button>` : '<div class="notice">No estás investigando nada. Elige una tecnología disponible.</div>'}
   <div class="kv"><span>Tecnologías completadas</span><b>${done} / ${total}</b></div>
   <p class="hint">Cada tecnología cuesta un 1,5% más por cada tecnología ya investigada. Las eras avanzadas exigen año y progreso previo; las <b>doctrinas</b> (⚖) son excluyentes y las marcadas con ⏳ caducan si no se investigan a tiempo.</p></div>
  <div class="eras">${eras}</div>
  <div class="techcols">${TECH_CATS.map(cat => `<div class="techcol"><h3>${cat}</h3>${[1, 2, 3].map(e => {
    const list = TECHS.filter(t => t.cat === cat && t.era === e); if (!list.length) return '';
    return `<h5>Era ${e}</h5>` + list.map(t => {
      const stt = techStatus(c, t), now = c.research === t.id;
      const cls = stt.k === 'done' ? 'done' : now ? 'now' : stt.k === 'avail' ? '' : 'lock';
      return `<div class="tech ${cls} ${stt.k === 'obsolete' ? 'obs' : ''}" ${stt.k === 'avail' && !now ? `data-act="research" data-id="${t.id}"` : ''}><b>${stt.k === 'done' ? '✔ ' : ''}${t.ex ? '⚖ ' : ''}${t.until && stt.k !== 'done' ? '⏳ ' : ''}${t.name}</b><small>${t.desc}</small><small>${fxText(t.fx)}</small><span class="cost">${stt.k === 'done' ? 'Completada' : now ? 'En curso' : `💡 ${techCost(c, t)}`}</span>${stt.why ? `<small class="dim">${stt.why}</small>` : ''}${t.until && stt.k === 'avail' ? `<small class="warn">Caduca tras ${t.until}</small>` : ''}</div>`;
    }).join('');
  }).join('')}</div>`).join('')}</div>`;
}};

/* --- Diplomacia --- */
const norm = t => (t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
function relBadge(r) { return `<span class="${r < -20 ? 'bad' : r > 20 ? 'good' : ''}">${sgn(r, 0)}</span>`; }
function pactLabel(p, from) { const d = PACTS[p.type]; return `${d.icon} ${d.name}`; }
WINDOWS.diplomacy = {title: 'Diplomacia', icon: '🤝', render() {
  const c = me(); const t = curTab('dip', 'world'); let body = '';
  const mail = G.proposals.length;
  if (t === 'world') {
    const q = norm(UI.dipQ);
    const sel = UI.dipSel && G.C[UI.dipSel] && UI.dipSel !== NONE && alive(UI.dipSel) ? UI.dipSel : G.rankList.find(x => x !== G.player && alive(x));
    const o = G.C[sel];
    const list = G.rankList.filter(tag => alive(tag) && (!q || norm(G.C[tag].name).includes(q) || norm(tag).includes(q)));
    const rel = c.relations[sel] ?? 0, atWar = atWarWith(G.player, sel);
    const myPacts = pactsOf(G.player).filter(p => p.a === sel || p.b === sel);
    let actions = '';
    if (sel !== G.player) {
      const types = ['alliance', 'guarantee', 'nonagg', 'trade', 'subsidy', 'embargo', 'rival'];
      const btns = types.map(tp => {
        const def = PACTS[tp]; const ex = G.pacts.find(p => p.type === tp && ((p.a === G.player && p.b === sel) || (def.mutual && p.a === sel && p.b === G.player)));
        if (ex) return `<button class="pactbtn on" data-act="breakpact" data-id="${ex.id}" data-tip="<b>${def.name}</b><br>Pulsa para romperlo (−25 de relación).">${def.icon} ${def.name} ✔ <small>romper</small></button>`;
        const ch = acceptChance(tp, G.player, sel); const tip = `<b>${def.name}</b><br>${def.desc}<br><br>Probabilidad de aceptar: <b>${Math.round(ch.p * 100)}%</b><br>${ch.reasons.join('<br>')}`;
        return `<button class="pactbtn" data-act="pact" data-t="${tp}" data-tag="${sel}" ${c.influence < def.cost || atWar ? 'disabled' : ''} data-tip="${tip}">${def.icon} ${def.name} <small>${def.cost} infl.${tp === 'alliance' || tp === 'guarantee' || tp === 'nonagg' || tp === 'trade' ? ' · ' + Math.round(ch.p * 100) + '%' : ''}</small></button>`;
      }).join('');
      const warBlock = warBlockers(G.player, sel);
      actions = `<div class="btnrow"><button data-act="improve" data-tag="${sel}" ${c.influence < 20 ? 'disabled' : ''}>🕊️ Mejorar relaciones <small>20</small></button><button data-act="gift" data-tag="${sel}">🎁 Regalo <small>${money(c.stats.income * 1.5)}</small></button><button data-act="insult" data-tag="${sel}" ${c.influence < 10 ? 'disabled' : ''}>😠 Insultar <small>10</small></button></div>
      <h4 class="sub">Acuerdos</h4><div class="pactgrid">${btns}</div>
      <h4 class="sub">Injerencia</h4><div class="igpick">${IG_ORDER.map(k => `<button data-act="abroad" data-tag="${sel}" data-ig="${k}" ${c.influence < 50 ? 'disabled' : ''} data-tip="<b>Patrocinar a ${IGS[k].name}</b> en ${o.name}<br>+50% de influencia durante 12 meses (50 infl.). Riesgo de ser descubierto.">${IGS[k].icon}</button>`).join('')}</div>
      <div class="btnrow">${atWar ? '<span class="tag bad">⚔️ En guerra</span>' : `<button class="danger" data-act="wardlg" data-tag="${sel}" ${warBlock ? 'disabled' : ''}>⚔️ Declarar la guerra…</button>`}</div>
      <small class="dim">${warBlock && !atWar ? warBlock : 'Elegirás el casus belli y los territorios que exiges.'}</small>`;
    }
    body = `<div class="cols"><div class="col wide"><input id="dipq" class="search" placeholder="🔍 Buscar país…" value="${(UI.dipQ || '').replace(/"/g, '&quot;')}" autocomplete="off"><div class="scrollable tall"><table class="tbl clickable"><thead><tr><th>#</th><th>País</th><th class="r">Prestigio</th><th class="r">Población</th><th class="r">PIB</th><th class="r">Rel.</th></tr></thead><tbody>${list.map(tag => { const k = G.C[tag]; const r = k.relations[G.player] ?? 0; const bl = blocOf(tag); return `<tr class="${tag === sel ? 'sel' : ''} ${tag === G.player ? 'me' : ''}" data-act="dipsel" data-tag="${tag}"><td>${k.rank}</td><td>${flag(tag, 'sm')} ${k.name}${bl ? ` <small class="dim" style="color:${bl.color}">●</small>` : ''}${k.overlord ? ' <small class="dim">(vasallo)</small>' : ''}</td><td class="r">${Math.round(k.prestige)}</td><td class="r">${fmtN(k.stats.pop, 1)}</td><td class="r">${fmtN(k.stats.gdp, 1)}</td><td class="r">${tag === G.player ? '—' : relBadge(r)}</td></tr>`; }).join('') || '<tr><td colspan="6" class="dim">Ningún país coincide.</td></tr>'}</tbody></table></div></div>
    <div class="col"><div class="card"><div class="dipcard">${flag(sel, 'big')}<div><h3>${o.name}</h3><small>${o.gov}</small></div></div>
     <div class="kv"><span>Rango · Prestigio</span><b>#${o.rank} · ${Math.round(o.prestige)}</b></div><div class="kv"><span>Población · Ejército</span><b>${fmtN(o.stats.pop, 1)} · ${fmtN(o.stats.soldiers, 1)}</b></div>
     <div class="kv"><span>Estados · Infamia</span><b>${o.states.length} · ${Math.round(o.infamy)}</b></div>
     ${o.bloc ? `<div class="kv"><span>Bloque</span><b style="color:${blocOf(sel).color}">${blocOf(sel).name}</b></div>` : ''}${o.overlord ? `<div class="kv"><span>Soberano</span><b>${G.C[o.overlord].name}</b></div>` : ''}
     ${sel !== G.player ? `<div class="kv"><span>Relaciones</span><b>${sgn(rel, 0)}</b></div>${bar(rel + 100, 200, rel < 0 ? 'bad' : 'good')}` : ''}
     ${myPacts.length ? `<div class="chips2">${myPacts.map(p => `<span class="tag">${pactLabel(p)}</span>`).join('')}</div>` : ''}
     ${actions}</div></div></div>`;
  } else if (t === 'pacts') {
    const mine = pactsOf(G.player);
    body = `${G.proposals.length ? `<div class="card"><h3>Propuestas recibidas</h3>${G.proposals.map(pp => `<div class="kv"><span>${flag(pp.from, 'sm')} <b>${G.C[pp.from].name}</b> propone ${pp.type === 'bloc' ? 'que ingreses en su bloque' : PACTS[pp.type].icon + ' ' + PACTS[pp.type].name.toLowerCase()}</span><span><button data-act="propyes" data-id="${pp.id}">Aceptar</button> <button data-act="propno" data-id="${pp.id}">Rechazar</button></span></div>`).join('')}</div>` : ''}
    <div class="card"><h3>Mis acuerdos</h3>${mine.length ? `<table class="tbl"><thead><tr><th>Acuerdo</th><th>Con</th><th>Desde</th><th>Caduca</th><th></th></tr></thead><tbody>${mine.map(p => { const o2 = p.a === G.player ? p.b : p.a; const dir = PACTS[p.type].mutual ? '' : (p.a === G.player ? ' (tú → ellos)' : ' (ellos → tú)'); return `<tr><td>${pactLabel(p)}${dir}</td><td>${flag(o2, 'sm')} ${G.C[o2].name}</td><td>${MONTHS_CAP[p.since.m].slice(0, 3)} ${p.since.y}</td><td>${p.until ? p.until.y : '—'}</td><td class="r"><button data-act="breakpact" data-id="${p.id}">Romper</button></td></tr>`; }).join('')}</tbody></table>` : '<p class="hint">No tienes ningún acuerdo. Selecciona un país en la pestaña Potencias para proponer alianzas, garantías, tratados comerciales…</p>'}</div>
    <div class="card"><h3>Tipos de acuerdo</h3>${Object.keys(PACTS).map(k => `<div class="kv sm"><span><b>${PACTS[k].icon} ${PACTS[k].name}</b> — ${PACTS[k].desc}</span><b>${PACTS[k].cost} infl.</b></div>`).join('')}</div>`;
  } else if (t === 'blocs') {
    const mb = blocOf(G.player);
    let mine = '';
    if (mb) {
      const lead = mb.leader === G.player; const bt = BLOC_TYPES[mb.type];
      const cand = lead ? G.rankList.filter(x => alive(x) && x !== G.player && !G.C[x].bloc && !G.C[x].overlord).map(x => ({x, ch: blocInviteChance(mb, x)})).filter(z => z.ch.p > 0).sort((a, b) => b.ch.p - a.ch.p).slice(0, 12) : [];
      mine = `<div class="card bloc" style="--bc:${mb.color}"><h3>${bt.icon} ${mb.name}</h3><p class="hint">${bt.desc}</p>
        <div class="kv"><span>Líder</span><b>${flag(mb.leader, 'sm')} ${G.C[mb.leader].name}</b></div><div class="kv"><span>Miembros</span><b>${mb.members.length} / ${blocMax(G.C[mb.leader])}</b></div>
        <table class="tbl"><tbody>${mb.members.map(m => `<tr><td>${flag(m, 'sm')} ${G.C[m].name}${m === mb.leader ? ' 👑' : ''}</td><td class="r">${m === G.player ? '' : relBadge(relOf(G.player, m))}</td><td class="r">${lead && m !== G.player ? `<button data-act="kickbloc" data-tag="${m}">Expulsar</button>` : ''}</td></tr>`).join('')}</tbody></table>
        <div class="btnrow"><button data-act="leavebloc">🚪 ${lead ? 'Abandonar (cede el liderazgo)' : 'Abandonar bloque'}</button>${lead ? '<button class="danger" data-act="dissolvebloc">Disolver bloque</button>' : ''}</div></div>
        ${lead ? `<div class="card"><h3>Invitar países (20 de influencia)</h3><table class="tbl clickable"><tbody>${cand.map(z => `<tr><td>${flag(z.x, 'sm')} ${G.C[z.x].name}</td><td class="r">${Math.round(z.ch.p * 100)}%</td><td class="r"><button data-act="invitebloc" data-tag="${z.x}" ${me().influence < 20 ? 'disabled' : ''}>Invitar</button></td></tr>`).join('') || '<tr><td class="dim">No hay candidatos.</td></tr>'}</tbody></table></div>` : ''}`;
    } else {
      mine = `<div class="card"><h3>Fundar un bloque</h3><p class="hint">Necesitas 30 de prestigio y 60 de influencia. El tamaño máximo depende de tu prestigio.</p>
        <div class="seg">${Object.keys(BLOC_TYPES).map(k => `<button class="${(UI.blocType || 'military') === k ? 'on' : ''}" data-act="blocType" data-t="${k}">${BLOC_TYPES[k].icon} ${BLOC_TYPES[k].name}</button>`).join('')}</div>
        <p class="hint">${BLOC_TYPES[UI.blocType || 'military'].desc}</p><input id="blocname" class="search" placeholder="Nombre del bloque (opcional)" value="${(UI.blocName || '').replace(/"/g, '&quot;')}"><button class="primary" data-act="createbloc" ${me().prestige < 30 || me().influence < 60 || me().overlord ? 'disabled' : ''}>Fundar bloque</button></div>`;
    }
    const others = G.blocs.filter(b => b !== mb);
    body = mine + `<div class="card"><h3>Bloques del mundo</h3>${others.length ? others.map(b => { const ch = blocInviteChance(b, G.player); return `<div class="blocrow" style="--bc:${b.color}"><div><b>${BLOC_TYPES[b.type].icon} ${b.name}</b><small>${BLOC_TYPES[b.type].name} · líder ${G.C[b.leader].name}</small><div class="chips2">${b.members.map(m => `<span class="tag">${flag(m, 'sm')} ${G.C[m].name}</span>`).join('')}</div></div>${!mb ? `<button data-act="joinbloc" data-id="${b.id}" ${ch.p === 0 || me().influence < 20 ? 'disabled' : ''} data-tip="${ch.why}">Solicitar ingreso<small>${Math.round(ch.p * 100)}%</small></button>` : ''}</div>`; }).join('') : '<p class="hint">Aún no existe ningún otro bloque.</p>'}</div>`;
  } else if (t === 'claims') {
    const cl = c.claims.map(x => G.S[x.state]).filter(s => s && s.owner !== G.player);
    const sel = UI.dipSel && alive(UI.dipSel) && UI.dipSel !== G.player ? UI.dipSel : null;
    const rs = sel ? reachableStates(G.player, sel).slice(0, 10) : [];
    body = `<div class="cols"><div class="col"><div class="card"><h3>Mis reclamaciones</h3>${cl.length ? `<table class="tbl"><tbody>${cl.map(s => `<tr><td>${s.name}</td><td>${s.owner === NONE ? 'Sin dueño' : flag(s.owner, 'sm') + ' ' + G.C[s.owner].name}</td><td class="r">${s.owner !== NONE ? `<button data-act="wardlg" data-tag="${s.owner}" data-cb="claim" data-st="${s.id}">⚔️ Reclamar</button>` : ''}</td></tr>`).join('')}</tbody></table>` : '<p class="hint">No tienes reclamaciones. Fabrícalas sobre territorios alcanzables o pierde territorios para obtener derechos históricos.</p>'}
      ${c.fabricating ? `<div class="notice">📜 Fabricando reclamación sobre <b>${G.S[c.fabricating.state].name}</b>: ${c.fabricating.months} meses.</div>` : ''}</div>
      <div class="card"><h3>Fabricar reclamaciones</h3><p class="hint">Selecciona un país en Potencias (${sel ? G.C[sel].name : 'ninguno'}) y elige un estado alcanzable. Cuesta 30 de influencia y 6 meses.</p><table class="tbl"><tbody>${rs.map(x => `<tr><td>${G.S[x.id].name}</td><td class="r">${fmtN(popTotal(G.S[x.id]), 1)}</td><td class="r">${hasClaim(c, x.id) ? '<span class="tag good">Reclamado</span>' : `<button data-act="fabricate" data-id="${x.id}" ${c.fabricating || c.influence < 30 ? 'disabled' : ''}>Fabricar</button>`}</td></tr>`).join('') || '<tr><td class="dim">Elige un país primero.</td></tr>'}</tbody></table></div></div>
    <div class="col wide"><div class="card"><h3>Casus belli disponibles</h3>${Object.keys(CBS).filter(k => !CBS[k].hidden).map(k => `<div class="cbrow"><span class="cbi">${CBS[k].icon}</span><div><b>${CBS[k].name}</b> <small class="dim">${CBS[k].cost} infl. base${CBS[k].perState ? ' + ' + CBS[k].perState + ' por territorio' : ''}</small><p class="hint">${CBS[k].desc}</p></div></div>`).join('')}</div></div></div>`;
  } else if (t === 'crisis') {
    body = dcrisisTabHtml();
  } else if (t === 'vassals') {
    const sub = c.subjects || [];
    body = `${c.overlord ? `<div class="notice">👑 Eres vasallo de <b>${G.C[c.overlord].name}</b>: pagas el 12% de tus ingresos y no puedes declarar guerras.</div>` : ''}
    <div class="card"><h3>Mis vasallos</h3>${sub.length ? `<table class="tbl"><tbody>${sub.map(x => `<tr><td>${flag(x, 'sm')} ${G.C[x].name}</td><td class="r">${fmtN(G.C[x].stats.pop, 1)}</td><td class="r"><button data-act="annex" data-tag="${x}" ${c.influence < 80 ? 'disabled' : ''}>Anexionar <small>80</small></button> <button data-act="release" data-tag="${x}">Liberar</button></td></tr>`).join('')}</tbody></table>` : '<p class="hint">No tienes vasallos. Usa el casus belli «Vasallaje» para someter a un país débil: te pagará un 12% de sus ingresos y seguirá tu política exterior.</p>'}</div>`;
  } else {
    const tg = colonizeTargets(c).slice(0, 14);
    body = `<div class="card"><h3>Colonización</h3>${c.colonizing ? `<div class="notice">⚓ Colonizando <b>${G.S[c.colonizing.state].name}</b> — ${c.colonizing.months} meses restantes.</div>` : '<p class="hint">Reclama tierras sin dueño al alcance de tus territorios. Cuesta 80 de influencia y tarda 6 meses.</p>'}
     <table class="tbl clickable"><thead><tr><th>Estado</th><th class="r">Población</th><th class="r">Distancia</th><th></th></tr></thead><tbody>${tg.map(x => { const s2 = G.S[x.id]; return `<tr data-act="focus" data-id="${s2.id}"><td>${s2.name}</td><td class="r">${fmtN(popTotal(s2), 1)}</td><td class="r">${Math.round(x.d)}°</td><td class="r"><button data-act="colonize" data-id="${s2.id}" ${c.colonizing || c.influence < 80 ? 'disabled' : ''}>Colonizar</button></td></tr>`; }).join('') || '<tr><td colspan="4" class="dim">No hay territorios sin reclamar a tu alcance.</td></tr>'}</tbody></table></div>`;
  }
  return tabs('dip', [['world', 'Potencias'], ['pacts', 'Acuerdos' + (mail ? ` (${mail})` : '')], ['blocs', 'Bloques'], ['crisis', 'Crisis' + ((G.dcrises || []).length ? ` (${G.dcrises.length})` : '')], ['claims', 'Casus belli'], ['vassals', 'Vasallos'], ['colony', 'Colonización']]) + body;
}};

/* --- Ejército y guerra --- */
const stars = n => '★'.repeat(n) + '<span class="dim">' + '★'.repeat(5 - n) + '</span>';
WINDOWS.military = {title: 'Ejército y guerra', icon: '⚔️', render() {
  const c = me(), st = c.stats, tab = curTab('mil', 'armies');
  const myWars = G.wars.filter(w => w.attAll.includes(G.player) || w.defAll.includes(G.player));
  const mine = armiesOf(G.player);
  let barr = 0; c.states.forEach(i => barr += G.S[i].b.barracks || 0);
  const ndiv = countDivs(G.player), lim = divLimit(c);
  const sideHtml = (list, lead) => list.map(t => `${flag(t, 'sm')} ${G.C[t].name}${t === lead ? ' 👑' : ''}`).join(', ');
  const head = tabs('mil', [['armies', `Ejércitos (${mine.length})`], ['fronts', `Frentes${frontsOf(G.player).length ? ' (' + frontsOf(G.player).length + ')' : ''}`], ['generals', 'Generales'], ['recruit', 'Reclutamiento'], ['wars', `Guerras${myWars.length ? ' (' + myWars.length + ')' : ''}`], ['stats', 'Fuerzas armadas']]);
  let body = '';
  if (tab === 'armies') {
    body = `<div class="card"><h3>Tus ejércitos</h3>${mine.length ? `<table class="tbl clickable"><thead><tr><th>Ejército · general</th><th>Ubicación</th><th class="r">Div.</th><th class="r">Hombres (mil)</th><th class="r">Fuerza</th><th class="r">Organ.</th><th>Orden</th></tr></thead><tbody>${mine.map(armyRowHtml).join('')}</tbody></table>` : '<p class="hint">No tienes ejércitos. Recluta divisiones en la pestaña Reclutamiento (se necesitan Cuarteles).</p>'}
     <p class="hint">Haz clic en una ficha del mapa o en una fila para seleccionar un ejército; después <b>clic derecho</b> sobre un estado vecino para ordenar el movimiento. Las divisiones recién reclutadas aparecen en el estado donde se entrenaron.</p></div>`;
  } else if (tab === 'fronts') {
    body = frontsTabHtml();
  } else if (tab === 'generals') {
    body = generalsTabHtml();
  } else if (tab === 'recruit') {
    const states = c.states.filter(id => G.S[id].b.barracks >= 1).sort((a, b) => G.S[b].b.barracks - G.S[a].b.barracks);
    const mine = G.recruits.filter(r => r.tag === G.player);
    body = `<div class="cols"><div class="col wide"><div class="card"><h3>Reclutar divisiones</h3>
      <div class="kv"><span>Divisiones (incl. en instrucción)</span><b class="${ndiv >= lim ? 'bad' : ''}">${ndiv} / ${lim}</b></div>
      <p class="hint">Cada división moviliza ${fmtN(MEN_PER_DIV, 0)} soldados de la población campesina del estado y cuesta dinero. Se necesitan Cuarteles en el estado y capacidad militar suficiente.</p>
      ${states.length ? `<table class="tbl"><thead><tr><th>Estado</th><th class="r">Cuarteles</th><th class="r">Campesinos</th>${Object.keys(DIVS).map(k => `<th class="r">${DIVS[k].icon} ${DIVS[k].name}<br><small>${money(recruitCost(c, k))} · ${DIVS[k].days} d</small></th>`).join('')}</tr></thead><tbody>${states.map(id => { const s = G.S[id]; return `<tr><td data-act="focus" data-id="${id}"><b>${s.name}</b></td><td class="r">${s.b.barracks}</td><td class="r">${fmtN(s.pops.peasants || 0, 1)}</td>${Object.keys(DIVS).map(k => { const e = canRecruit(c, id, k); return `<td class="r"><button data-act="recruit" data-id="${id}" data-t="${k}" ${e ? 'disabled' : ''} ${e ? `data-tip="${escA(e)}"` : ''}>＋ Reclutar</button></td>`; }).join('')}</tr>`; }).join('')}</tbody></table>` : '<p class="hint bad">No tienes Cuarteles. Constrúyelos en el panel de un estado → Edificios.</p>'}</div></div>
      <div class="col"><div class="card"><h3>Equipo militar</h3>
      ${(() => { const need = eqNeedOf(c.tag); return EQ_GOODS.map(g => { const have = (c.eq || {})[g] || 0, nd = need[g] || 0, f = nd ? have / nd : 1; return `<div class="kv sm"><span>${GOOD[g].icon} ${GOOD[g].name} <small class="dim">· £${f1(G.price[g])}</small></span><b class="${f < 0.8 ? 'bad' : f < 1 ? 'warn' : ''}">${fmtN(have, 0)} / ${fmtN(nd, 0)}</b></div>${bar(Math.min(1, f), 1, f < 0.8 ? 'bad' : f < 1 ? 'warn' : 'good')}`; }).join(''); })()}
      <div class="btnrow">${EQ_POLICY.map((p, i) => `<button data-act="eqpol" data-n="${i}" class="${(c.eqPolicy || 0) === i ? 'on' : ''}" data-tip="${escA(p.desc + ' Gasto máx. ' + Math.round(p.budget * 100) + '% de los ingresos.')}">${p.name}</button>`).join('')}</div>
      <p class="hint">Las divisiones necesitan fusiles, cañones, caballos y pólvora que fabrican tus industrias o que compras en el mercado mundial. Si faltan, las tropas rinden menos y no puedes reclutar más. Por cada nivel de la política se compra más equipo.</p></div>
      <div class="card"><h3>Movilización de la población</h3>
      ${MOB_LEVELS.map((m, i) => `<button class="block ${(c.mob || 0) === i ? 'on' : ''}" data-act="mob" data-n="${i}"><b>${m.name}</b> <small>${i ? fmtN(c.stats.pop * m.pct / MEN_PER_DIV, 0) + ' div. extra' : 'ninguna'}</small><small class="dim">${m.desc}</small></button>`).join('')}
      <p class="hint">Más movilización permite reclutar más divisiones pero reduce la producción (−${Math.round((1 - mobK(c)) * 100)}% ahora), cuesta dinero cada mes y genera malestar. Subir de nivel cuesta ${money(c.stats.income * 0.5)} por nivel.</p></div>
      <div class="card"><h3>En instrucción</h3>${mine.length ? mine.map(r => `<div class="kv sm"><span>${DIVS[r.type].icon} ${DIVS[r.type].name} · ${G.S[r.state].name}</span><b>${r.days} d</b></div>`).join('') : '<p class="hint">Nada en instrucción.</p>'}</div>
      <div class="card"><h3>Tipos de división</h3>${Object.keys(DIVS).map(k => `<div class="divt"><b>${DIVS[k].icon} ${DIVS[k].name}</b><small>${DIVS[k].desc}</small><small>Ataque ${DIVS[k].att} · Defensa ${DIVS[k].def} · Velocidad ${DIVS[k].spd} · Organización ${DIVS[k].org}</small><small>Necesita: ${fmtN(MEN_PER_DIV, 0)} soldados · ${Object.keys(DIV_NEEDS[k]).map(g => GOOD[g].icon + ' ' + fmtN(DIV_NEEDS[k][g], 0)).join(' · ')}</small></div>`).join('')}</div></div></div>`;
  } else if (tab === 'wars') {
    body = `<div class="cols"><div class="col wide"><div class="card"><h3>Guerras en curso</h3>${myWars.length ? myWars.map(w => {
      const mineSide = w.attAll.includes(G.player); const score = mineSide ? w.score : -w.score; const po = peaceOptions(w, G.player);
      const ec = (mineSide ? w.defAll : w.attAll).reduce((n, t) => n + armiesOf(t).length, 0), fc = (mineSide ? w.attAll : w.defAll).reduce((n, t) => n + armiesOf(t).length, 0);
      const bws = w.bw || {att: 0, def: 0};
      return `<div class="war"><div class="warh">${CBS[w.cb].icon} <b>${CBS[w.cb].name}</b> <small class="dim">· ${w.weeks} semanas</small></div>
      <div class="sides"><div><small>Atacantes</small>${sideHtml(w.attAll, w.att)}</div><div><small>Defensores</small>${sideHtml(w.defAll, w.def)}</div></div>
      ${w.targets.length ? `<div class="warst"><small>Territorios exigidos</small>${w.targets.map(sid => { const s = G.S[sid]; return `<div class="kv sm"><span>${s.name}</span><span class="occ"><i style="width:${(s.occ || 0) * 100}%"></i><em>${Math.round((s.occ || 0) * 100)}% ocupado</em></span></div>`; }).join('')}</div>` : ''}
      ${w.cTargets.length ? `<div class="warst"><small>Contraofensiva del defensor</small>${w.cTargets.map(sid => { const s = G.S[sid]; return `<div class="kv sm"><span>${s.name}</span><span class="occ cb"><i style="width:${(s.occ || 0) * 100}%"></i><em>${Math.round((s.occ || 0) * 100)}%</em></span></div>`; }).join('')}</div>` : ''}
      <div class="wbar"><b style="width:${(w.score + 100) / 2}%"></b></div>
      <div class="kv"><span>Fuerza: ${fmtN(w.pa || 0, 0)} vs ${fmtN(w.pd || 0, 0)} · Batallas ganadas ${bws.att}–${bws.def}</span><b class="${score >= 0 ? 'good' : 'bad'}">Puntuación ${sgn(score, 0)}</b></div>
      <div class="kv sm"><span>Ejércitos propios / enemigos</span><b>${fc} / ${ec}</b></div>
      <div class="btnrow"><button data-act="peace" data-id="${w.id}">🕊️ ${po.label}</button><button data-act="focus" data-id="${w.targets[0] ?? w.cTargets[0] ?? G.C[w.def].capital}">📍 Ver el frente</button></div></div>`;
    }).join('') : '<p class="hint">Tu país está en paz. Declara una guerra desde Diplomacia → Potencias. La puntuación de guerra depende ahora de los estados <b>ocupados</b> por tus ejércitos y de las batallas ganadas.</p>'}</div></div>
    <div class="col"><div class="card"><h3>Batallas en curso</h3>${G.battles.length ? G.battles.slice(0, 14).map(b => { const ta = (armyById(b.A[0]) || {}).tag, tb = (armyById(b.B[0]) || {}).tag; return ta && tb ? `<div class="kv sm clk" data-act="focus" data-id="${b.state}"><span>${flag(ta, 'sm')} vs ${flag(tb, 'sm')} ${G.S[b.state].name}</span><b>día ${b.day}</b></div>` : ''; }).join('') : '<p class="hint">No hay batallas.</p>'}</div>
    <div class="card"><h3>Otras guerras</h3>${G.wars.filter(w => !myWars.includes(w)).map(w => `<div class="kv"><span>${CBS[w.cb].icon} ${flag(w.att, 'sm')} ${G.C[w.att].name} → ${flag(w.def, 'sm')} ${G.C[w.def].name}</span><span><b>${sgn(w.score, 0)}</b> <button data-act="focus" data-id="${w.targets[0] ?? G.C[w.def].capital}">📍</button></span></div>`).join('') || '<p class="hint">No hay otras guerras.</p>'}</div></div></div>`;
  } else {
    body = `<div class="cols"><div class="col"><div class="card"><h3>Fuerzas armadas</h3>
   <div class="kv"><span>Soldados movilizables</span><b>${fmtN(st.soldiers, 1)}</b></div>
   <div class="kv"><span>Niveles de cuarteles</span><b>${Math.round(barr)}</b></div>
   <div class="kv"><span>Divisiones / máximo</span><b>${ndiv} / ${lim}</b></div>
   <div class="kv"><span>Modelo de ejército</span><b>${LAW[c.laws.army].name}</b></div>
   <div class="kv"><span>Bonificación de ejército</span><b>${sgn(c.mods.army * 100, 0)}%</b></div>
   <div class="kv"><span>Defensa · Logística</span><b>${sgn(c.mods.defense * 100, 0)}% · ${sgn(c.mods.logistics * 100, 0)}%</b></div>
   <div class="kv"><span>Coste militar</span><b>${sgn(c.mods.milCost * 100, 0)}%</b></div>
   <div class="kv"><span>Infamia</span><b class="${c.infamy > 30 ? 'bad' : ''}">${Math.round(c.infamy)}</b></div>
   <p class="hint">El límite de divisiones depende de los soldados de tu país. Las bajas en combate reducen la población campesina de los estados de origen.</p></div></div></div>`;
  }
  return head + body;
}};

/* --- Panel de ejército y órdenes --- */
function selectArmy(id, add) {
  UI.selSet = UI.selSet || new Set();
  if (add && id && UI.selArmy && id !== UI.selArmy) { const a = armyById(id); if (a && a.tag === G.player) { if (UI.selSet.has(id)) UI.selSet.delete(id); else UI.selSet.add(id); } }
  else { UI.selSet = new Set(); UI.selArmy = id; UI.moveMode = false; document.body.classList.remove('movemode'); }
  renderArmyPanel(); R.labelsDirty = true;
}
const BIOME_NAMES = ['Mar', 'Llanura', 'Bosque', 'Desierto', 'Estepa', 'Tundra', 'Selva', 'Montaña', 'Nieve'];
window.onMapRightClick = (sid, e, pid) => {
  if (UI.draw) { drawUndo(); return; }
  const a = UI.selArmy ? armyById(UI.selArmy) : null;
  if (!a || a.tag !== G.player || pid === undefined || pid < 0) return;
  orderArmies(pid, e && e.shiftKey ? 'wp' : 'move');
};
document.addEventListener('contextmenu', e => {
  const t = e.target.closest && e.target.closest('.atoken');
  if (t) { e.preventDefault(); const a = armyById(+t.dataset.aid); if (a && window.onMapRightClick) window.onMapRightClick(provState(a.loc), e, a.loc); }
});

function crisisTab() {
  const c = me(), inc = Math.max(1, c.stats.income); const ratio = c.debt / inc;
  const mine = G.crises.filter(x => x.scope === 'global' || x.scope === G.player);
  const cyc = G.cycle; const phase = cyc > 0.35 ? 'Expansión' : cyc < -0.35 ? 'Recesión' : 'Estabilidad';
  const fxT = fx => Object.keys(fx).map(k => ({demand: 'Consumo', agri: 'Agricultura', ind: 'Industria', mine: 'Minería', invest: 'Inversión', credit: 'Coste del crédito'}[k] + ' ' + sgn((fx[k] - 1) * 100, 0) + '%')).join(' · ');
  const risk = ratio > 50 ? ['Riesgo de bancarrota', 'bad'] : ratio > 26 ? ['Deuda peligrosa', 'bad'] : ratio > 10 ? ['Deuda elevada', 'warn'] : ['Finanzas sanas', 'good'];
  return `<div class="cols"><div class="col"><div class="card"><h3>Ciclo económico</h3>
   <div class="cycle"><i style="left:${(cyc + 1) * 50}%"></i></div><div class="kv"><span>Fase</span><b class="${cyc < -0.35 ? 'bad' : cyc > 0.35 ? 'good' : ''}">${phase}</b></div>
   <p class="hint">El consumo mundial oscila ±5% en un ciclo de unos 9 años. Las recesiones favorecen la aparición de crisis.</p>
   <div class="kv"><span>Dificultad</span><b>${DIFF[G.diff].name}</b></div>
   <div class="kv"><span>Deuda / ingresos semanales</span><b class="${risk[1]}">${f1(ratio)}×</b></div><div class="kv"><span>Estado</span><b class="${risk[1]}">${risk[0]}</b></div>
   <div class="kv"><span>Resistencia a crisis</span><b>${pctS(c.mods.crisis || 0)}</b></div>
  </div>
  <div class="card"><h3>Respuestas del gobierno</h3>
   <button class="block" data-act="crisisr" data-k="bailout" ${c.treasury < inc * 5 ? 'disabled' : ''}>🏦 Rescate bancario <small>${money(inc * 5)}</small></button>
   <button class="block" data-act="crisisr" data-k="stimulus" ${c.treasury < inc * 3 ? 'disabled' : ''}>💊 Plan de estímulo <small>${money(inc * 3)}</small></button>
   <button class="block" data-act="crisisr" data-k="austerity">✂️ Austeridad <small>+2 sem. de ingresos, más malestar</small></button>
   <p class="hint">El rescate acorta las crisis financieras; el estímulo aumenta el consumo y la inversión durante 8 meses.</p></div></div>
  <div class="col wide"><div class="card"><h3>Crisis activas</h3>${mine.length ? mine.map(cr => `<div class="crisis"><div class="kv"><b>${cr.icon} ${cr.name}</b><span>${cr.scope === 'global' ? '🌍 Mundial' : '🏳️ Nacional'} · ${cr.left} meses</span></div><small>${cr.desc}</small><small class="bad">${fxT(cr.fx)}</small>${bar(cr.left, cr.months, 'warn')}</div>`).join('') : '<p class="hint">No hay crisis activas. Mantén las finanzas sanas y reformas para resistir las próximas.</p>'}</div>
  <div class="card"><h3>Posibles crisis</h3><ul class="plain">${Object.keys(CRISIS_TYPES).filter(k => !CRISIS_TYPES[k].hidden).map(k => `<li><b>${CRISIS_TYPES[k].icon} ${CRISIS_TYPES[k].name}</b> (${CRISIS_TYPES[k].scope === 'global' ? 'mundial' : 'nacional'}): ${CRISIS_TYPES[k].desc}</li>`).join('')}</ul></div></div></div>`;
}

function ideoTab() {
  const c = me();
  const tab = ideologyTable(c);
  const sel = UI.ideoSel && IGS[UI.ideoSel] ? UI.ideoSel : IG_ORDER.slice().sort((a, b) => c.ig[b].share - c.ig[a].share)[0];
  const g = c.ig[sel], d = IGS[sel];
  const prog = IG_PROGRAMS[sel];
  const tr = transitionOptions(c, sel);
  const bs = c.boosts.filter(b => b.kind === 'ig');
  const profRows = PROF_ORDER.filter(p => ['aristocrats', 'capitalists', 'clergy', 'officers', 'bureaucrats', 'shopkeepers', 'clerks', 'machinists', 'laborers', 'peasants'].includes(p)).map(p => {
    const pb = c.pboosts[p];
    return `<tr><td>${PROFS[p].name}</td><td><small class="dim">${Object.keys(PROFS[p].ig).map(k => IGS[k].icon).join(' ')}</small></td><td class="r">${pb ? `<span class="tag ${pb.mode === 'boost' ? 'good' : 'bad'}">${pb.mode === 'boost' ? '▲' : '▼'} ${pb.months} m</span>` : ''}</td><td class="r"><button data-act="sprof" data-p="${p}" data-m="boost" ${pb || c.influence < 25 ? 'disabled' : ''}>▲ Impulsar</button> <button data-act="sprof" data-p="${p}" data-m="suppress" ${pb || c.influence < 25 ? 'disabled' : ''}>▼ Reprimir</button></td></tr>`;
  }).join('');
  return `<div class="cols"><div class="col"><div class="card"><h3>Ideologías en la sociedad</h3>${tab.map(t => `<div class="kv"><span>${t.name}</span><b>${pctS(t.share, 1)}</b></div>${bar(t.share, 0.5, '')}`).join('')}<p class="hint">Cada grupo de interés encarna una ideología. El régimen cambia cuando una de ellas domina el poder político.</p></div>
   <div class="card"><h3>Grupos de interés</h3>${IG_ORDER.map(k => { const gg = c.ig[k], b = bs.find(x => x.key === k); return `<div class="igsel ${k === sel ? 'sel' : ''}" data-act="igsel" data-k="${k}"><span class="igi" style="background:${IGS[k].color}">${IGS[k].icon}</span><div><b>${IGS[k].name}</b><small>${pctS(gg.share, 1)} · ${gg.gov ? 'gobierno' : 'oposición'}</small></div>${b ? `<span class="tag ${b.mode === 'boost' ? 'good' : 'bad'}">${b.mode === 'boost' ? '▲' : '▼'} ${b.months} m</span>` : ''}</div>`; }).join('')}</div></div>
  <div class="col wide"><div class="card"><div class="igh"><span class="igi big" style="background:${d.color}">${d.icon}</span><div><h3 style="margin:0">${d.name}</h3><small class="dim">${d.ideo} · influencia ${pctS(g.share, 1)} · aprobación ${sgn(g.approval)}</small></div></div><p class="hint">${d.desc}</p>
    <div class="btnrow"><button data-act="sig" data-k="${sel}" data-m="boost" ${c.influence < 35 || bs.length >= 3 ? 'disabled' : ''}>▲ Impulsar (+45% influencia · 12 m) <small>35 infl. + 2 sem.</small></button><button data-act="sig" data-k="${sel}" data-m="suppress" ${c.influence < 35 || bs.length >= 3 ? 'disabled' : ''}>▼ Reprimir (−45%) <small>35 infl. + 2 sem.</small></button></div>
    <h4 class="sub">Programa político</h4><div class="prog">${Object.keys(prog).map(cat => { const o = LAW[prog[cat]]; const cur = c.laws[cat] === o.id; return `<span class="tag ${cur ? 'good' : ''}">${cur ? '✔ ' : ''}${o.name}</span>`; }).join(' ')}</div>
    <h4 class="sub">Cambiar de régimen a favor de este grupo</h4>
    ${tr.map(o => `<div class="trans"><div><b>${o.name}</b><small>${o.desc}</small>${o.ok ? '' : `<small class="bad">${o.why}</small>`}</div><div class="tright"><span>${Math.round(o.p * 100)}%</span><button class="${o.kind === 'revolution' ? 'danger' : ''}" data-act="gov" data-k="${sel}" data-t="${o.kind}" ${o.ok && c.influence >= o.cost ? '' : 'disabled'}>${o.cost} infl.</button></div></div>`).join('')}
    <p class="hint">Impulsar a un grupo aumenta sus probabilidades de éxito. Un fracaso reduce la legitimidad y aumenta el malestar. Una revolución triunfante impone todo su programa y puede provocar una guerra civil.</p></div>
  <div class="card"><h3>📢 Propaganda por estrato</h3><p class="hint">Una campaña masiva refuerza el peso político de <b>todas</b> las profesiones del estrato (×1,5), reduce el malestar y mejora la legitimidad durante 18 meses. Es <b>carísima</b>: ${money(propaCost(c).money)} y ${propaCost(c).inf} de influencia.</p>
   <div class="propa">${['upper', 'middle', 'lower'].map(k => { const p = (c.propa || {})[k]; return `<div class="pcard ${p ? 'on' : ''}"><b>${STRATA_NAMES[k]}</b><small>${PROF_ORDER.filter(x => PROFS[x].strat === k).map(x => PROFS[x].name).join(', ')}</small>${p ? `<span class="tag good">▲ ${p.months} meses</span>` : `<button data-act="propa" data-k="${k}" ${c.treasury < propaCost(c).money || c.influence < propaCost(c).inf ? 'disabled' : ''}>Lanzar campaña</button>`}</div>`; }).join('')}</div></div>
  <div class="card"><h3>Grupos de población</h3><table class="tbl"><thead><tr><th>Profesión</th><th>Grupos</th><th class="r">Estado</th><th class="r">Acción (25 infl.)</th></tr></thead><tbody>${profRows}</tbody></table></div>
  ${c.govHist.length ? `<div class="card"><h3>Historial de regímenes</h3>${c.govHist.map(h => `<div class="kv sm"><span>${h.y}: ${h.from} → <b>${h.to}</b></span><span>${{election: 'Elecciones', coup: 'Golpe', revolution: 'Revolución'}[h.kind]}</span></div>`).join('')}</div>` : ''}</div></div>`;
}

/* ---------- diálogo de declaración de guerra ---------- */
function openWarDialog(defTag, cbPre, statePre) {
  const block = warBlockers(G.player, defTag);
  if (block) { toast('⚠️', block); return; }
  const cbs = Object.keys(CBS).filter(k => !CBS[k].hidden);
  const first = cbPre && cbAvailable(G.player, defTag, cbPre).ok ? cbPre : cbs.find(k => cbAvailable(G.player, defTag, k).ok) || 'humiliate';
  UI.war = {def: defTag, cb: first, targets: new Set(statePre != null ? [statePre] : []), law: {cat: 'agrarian', opt: 'tenant'}};
  if (CBS[first].terr && !UI.war.targets.size) { const rs = reachableStates(G.player, defTag).filter(x => first !== 'claim' || hasClaim(me(), x.id)); if (rs.length) UI.war.targets.add(rs[0].id); }
  renderWarDialog();
}
function renderWarDialog() {
  const W = UI.war, root = $('#wardlg');
  if (!W) { root.classList.remove('open'); root.innerHTML = ''; return; }
  const c = me(), D = G.C[W.def];
  const sc = root.querySelector('.wd-body') ? root.querySelector('.wd-body').scrollTop : 0;
  const cb = CBS[W.cb];
  const rs = reachableStates(G.player, W.def);
  if (!cb.terr) W.targets.clear();
  const tg = [...W.targets].filter(id => rs.some(x => x.id === id));
  const max = cb.terr ? cb.max(c) : 0;
  const cost = warCost(G.player, tg, W.cb);
  const A = sidePower([G.player].concat(allies(G.player)).filter(t => alive(t))), Dp = sidePower([W.def].concat(allies(W.def), guaranteedBy(W.def)).filter(t => alive(t)));
  const ally = allies(G.player).map(t => G.C[t].name), enemyAl = allies(W.def).concat(guaranteedBy(W.def)).map(t => G.C[t].name);
  const okGo = cbAvailable(G.player, W.def, W.cb).ok && (!cb.terr || tg.length) && c.influence >= cost;
  root.classList.add('open');
  root.innerHTML = `<div class="wd"><div class="whead"><span class="wicon">⚔️</span><h2>Declarar la guerra a ${D.name}</h2><button class="x" data-act="wclose">✕</button></div>
  <div class="wd-body"><div class="cols"><div class="col"><h4 class="sub">1. Casus belli</h4>
   ${Object.keys(CBS).filter(k => !CBS[k].hidden).map(k => { const av = cbAvailable(G.player, W.def, k); const sel = W.cb === k; return `<div class="cbopt ${sel ? 'sel' : ''} ${av.ok ? '' : 'na'}" ${av.ok ? `data-act="wcb" data-k="${k}"` : ''}><span class="cbi">${CBS[k].icon}</span><div><b>${CBS[k].name}</b><small>${av.ok ? CBS[k].desc : '🚫 ' + av.why}</small></div><span class="tag">${CBS[k].cost}${CBS[k].perState ? '+' : ''}</span></div>`; }).join('')}
   ${cb.law ? `<h4 class="sub">Ley que impones</h4><select id="wlawcat" data-act="wlawcat">${LAW_CATS.map(cat => `<option value="${cat.id}" ${W.law.cat === cat.id ? 'selected' : ''}>${cat.name}</option>`).join('')}</select><select id="wlawopt" data-act="wlawopt">${LAW_CATS.find(x => x.id === W.law.cat).opts.map(o => `<option value="${o.id}" ${W.law.opt === o.id ? 'selected' : ''}>${o.name}</option>`).join('')}</select>` : ''}
  </div>
  <div class="col wide">${cb.terr ? `<h4 class="sub">2. Territorios exigidos <small class="dim">(máx. ${max})</small></h4><div class="scrollable mid"><table class="tbl"><thead><tr><th></th><th>Estado</th><th class="r">Población</th><th class="r">Coste</th></tr></thead><tbody>${rs.map(x => { const s = G.S[x.id]; const claim = hasClaim(c, x.id); const dis = W.cb === 'claim' && !claim; const on = W.targets.has(x.id); return `<tr class="${dis ? 'locked' : ''}"><td><input type="checkbox" data-act="wst" data-id="${x.id}" ${on ? 'checked' : ''} ${dis || (!on && W.targets.size >= max) ? 'disabled' : ''}></td><td>${s.name}${claim ? ' 📜' : ''}${x.border ? '' : ' <small class="dim">(por mar)</small>'}${G.C[W.def].capital === x.id ? ' ★' : ''}</td><td class="r">${fmtN(popTotal(s), 1)}</td><td class="r">${Math.round(cb.perState * stateWeight(x.id))}</td></tr>`; }).join('')}</tbody></table></div>` : `<h4 class="sub">2. Resultado si vences</h4><p class="hint">${W.cb === 'humiliate' ? 'El rival paga una indemnización de hasta 8 semanas de ingresos y pierde 12 de prestigio.' : W.cb === 'regime' ? 'El rival adopta la ley elegida: sufrirá inestabilidad (−12 de legitimidad).' : W.cb === 'trade' ? 'El rival pierde un 6% de recaudación, paga reparaciones y firma un tratado comercial forzoso.' : 'El rival se convierte en tu vasallo y te paga el 12% de sus ingresos.'}</p>`}
   <h4 class="sub">3. Fuerzas implicadas</h4>
   <div class="kv"><span>Tu potencia militar (con aliados actuales)</span><b>${fmtN(A.p, 1)}</b></div><div class="kv"><span>Potencia del rival (con aliados y garantes)</span><b>${fmtN(Dp.p, 1)}</b></div>
   <div class="wbar"><b style="width:${clamp(A.p / Math.max(1, A.p + Dp.p), 0, 1) * 100}%"></b></div>
   <small class="dim">Aliados que te seguirán: ${ally.join(', ') || 'ninguno'}. Defensores probables: ${enemyAl.join(', ') || 'ninguno'}.</small>
   <div class="notice">Coste: <b>${cost}</b> de influencia (tienes ${Math.floor(c.influence)}). Infamia: +${Math.round(cb.infamy * (1 + tg.length * 0.3))}.</div>
   <div class="btnrow"><button class="primary" data-act="wgo" ${okGo ? '' : 'disabled'}>⚔️ Declarar la guerra</button><button data-act="wcrisis" ${cbAvailable(G.player, W.def, W.cb).ok && (!cb.terr || tg.length) && c.influence >= Math.round(cost * 0.5) ? '' : 'disabled'}>🕰️ Abrir crisis diplomática (${Math.round(cost * 0.5)} infl.)</button><button data-act="wclose">Cancelar</button></div></div></div></div></div>`;
  const nb = root.querySelector('.wd-body'); if (nb) nb.scrollTop = sc;
}

/* ---------- búsqueda global ---------- */
function openSearch() {
  const r = $('#search'); r.classList.add('open');
  r.innerHTML = `<div class="sbox"><input id="sq" class="search big" placeholder="Buscar país o estado… (Esc para cerrar)" autocomplete="off"><div id="sres" class="sres"></div></div>`;
  const inp = $('#sq'); inp.focus();
  const upd = () => {
    const q = norm(inp.value); let html = '';
    if (!q) { html = '<p class="hint">Escribe el nombre de un país o de un estado para ir a él en el mapa.</p>'; }
    else {
      const cs = G.tags.filter(t => t !== NONE && alive(t) && (norm(G.C[t].name).includes(q) || norm(t).includes(q))).slice(0, 8);
      const ss = G.S.filter(s => norm(s.name).includes(q)).slice(0, 10);
      html = (cs.length ? '<h5>Países</h5>' + cs.map(t => `<div class="srow" data-act="sgoc" data-tag="${t}">${flag(t, 'sm')} <b>${G.C[t].name}</b><small>${G.C[t].gov} · rango ${G.C[t].rank}</small></div>`).join('') : '') +
             (ss.length ? '<h5>Estados</h5>' + ss.map(s => `<div class="srow" data-act="sgos" data-id="${s.id}">${s.owner === NONE ? '🏳️' : flag(s.owner, 'sm')} <b>${s.name}</b><small>${s.owner === NONE ? 'Sin reclamar' : G.C[s.owner].name}</small></div>`).join('') : '') || '<p class="hint">Sin resultados.</p>';
    }
    $('#sres').innerHTML = html;
  };
  inp.addEventListener('input', upd); upd();
}
function closeSearch() { const r = $('#search'); r.classList.remove('open'); r.innerHTML = ''; }

/* --- Construcción --- */
WINDOWS.construction = {title: 'Construcción', icon: '🏗️', render() {
  const c = me(), st = c.stats;
  const q = c.queue;
  return `<div class="card"><div class="kv"><span>Puntos de construcción por semana</span><b>${f1(st.constr)}</b></div>
  <div class="kv"><span>Coste por punto</span><b>${money(moneyPerPoint(c))}</b></div>
  <div class="kv"><span>Inversión privada pendiente</span><b>${c.projects.length} proyectos · fondos ${money(c.investPool)}</b></div>
  <p class="hint">Los proyectos de la cola se financian en orden. Construye <b>Sector de la Construcción</b> para acelerar las obras.</p></div>
  <div class="card"><h3>Cola de construcción pública</h3>${q.length ? `<table class="tbl"><tbody>${q.map((it, i) => `<tr><td><span class="gi">${BLD[it.bld].icon}</span> ${BLD[it.bld].name}</td><td>${G.S[it.state].name}</td><td style="width:34%">${bar(it.done, it.cost, 'gold', Math.floor(it.done / it.cost * 100) + '%')}</td><td class="r"><button data-act="focus" data-id="${it.state}">📍</button> <button data-act="cancelq" data-i="${i}">✕</button></td></tr>`).join('')}</tbody></table>` : '<p class="hint">La cola está vacía. Selecciona un estado en el mapa y elige qué construir.</p>'}</div>
  <div class="card"><h3>Proyectos privados</h3>${c.projects.length ? c.projects.slice(0, 12).map(p => `<div class="kv"><span><span class="gi">${BLD[p.bld].icon}</span> ${BLD[p.bld].name} · ${G.S[p.state].name}</span><b>${p.wk} sem.</b></div>`).join('') : '<p class="hint">Los inversores privados construirán donde el beneficio sea mayor.</p>'}</div>`;
}};

/* --- Diario --- */
WINDOWS.journal = {title: 'Diario', icon: '📜', render() {
  const c = me();
  return `<div class="cols"><div class="col wide"><div class="card"><h3>Objetivos</h3>${JOURNAL.map(j => { const done = c.journalDone[j.id]; const v = j.prog(c); return `<div class="obj ${done ? 'done' : ''}"><div class="kv"><b>${done ? '✔ ' : ''}${j.name}</b><span>${done ? 'Completado en ' + done : '+' + j.reward.prestige + ' prestigio'}</span></div><small>${j.desc}</small>${bar(Math.max(0, Math.min(v, j.goal)), j.goal, 'gold', done ? '100%' : Math.floor(clamp(v / j.goal, 0, 1) * 100) + '%')}</div>`; }).join('')}</div></div>
  <div class="col"><div class="card"><h3>Crónica</h3><div class="scrollable tall log">${G.log.slice(0, 60).map(l => `<div class="logl"><small>${l.date.d} ${MONTHS[l.date.m].slice(0, 3)} ${l.date.y}</small> ${l.text}</div>`).join('')}</div></div></div></div>`;
}};

/* ---------- panel de estado ---------- */
function renderStatePanel() {
  const root = $('#statepanel'); const keep = root.scrollTop;
  if (UI.sel === null || UI.sel < 0) { root.classList.remove('open'); root.innerHTML = ''; return; }
  const s = G.S[UI.sel], o = G.C[s.owner], c = me();
  const P = popTotal(s); const mine = s.owner === G.player;
  const rows = BUILDINGS.filter(b => (s.b[b.id] || 0) > 0 || (s.cap[b.id] || 0) >= 0.5 && b.cap !== 'any' && (!b.tech || c.techs.has(b.tech))).map(b => {
    const lv = s.b[b.id] || 0, cap = s.cap[b.id] || 0; const locked = b.tech && !c.techs.has(b.tech);
    const room = buildRoom(s, b.id) >= 1;
    const va = s.bva && s.bva[b.id];
    return `<div class="brow"><span class="gi">${b.icon}</span><div class="bn"><b>${b.name}</b><small>${b.out ? `Produce ${GOOD[b.out].name.toLowerCase()}` : b.grp}${va !== undefined && lv ? ` · VA ${money(va)}` : ''}</small></div><div class="blv"><b>${Math.round(lv * 10) / 10}</b><small>/ ${Math.round(cap)}</small></div>${mine && !locked ? `<button class="plus" data-act="build" data-id="${s.id}" data-b="${b.id}" ${room ? '' : 'disabled'} data-tip="Construir 1 nivel<br>${BLD[b.id].cost * CP_MULT} puntos · ${money(BLD[b.id].cost * CP_MULT * moneyPerPoint(c))}">＋</button>` : '<span class="plus ph"></span>'}</div>`;
  }).join('');
  const cap = o.states.length && o.capital === s.id;
  let reach = s.owner === NONE && colonizeTargets(c).some(x => x.id === s.id);
  root.classList.add('open');
  root.innerHTML = `
  <div class="sp-head"><div class="sp-flag">${s.owner === NONE ? '<span class="flag big neutral"></span>' : flag(s.owner, 'big')}</div><div><h2>${s.name}${cap ? ' ★' : ''}</h2><small>${s.owner === NONE ? 'Tierras sin reclamar' : o.name}</small></div><button class="x" data-act="desel">✕</button></div>
  <div class="sp-stats">
    <div><small>Población</small><b>${fmtN(P, 1)}</b></div><div><small>Nivel de vida</small><b>${f1(s.solAvg)}</b></div>
    <div><small>PIB/sem.</small><b>${fmtN(s.gdp, 1)}</b></div><div><small>Paro urbano</small><b>${pctS((s.unempU || 0) / Math.max(1, ((s.pops.laborers || 0) + (s.pops.machinists || 0)) * WF), 0)}</b></div>
  </div>
  ${s.owner === NONE ? `<div class="notice">Esta región no pertenece a ningún estado. ${reach ? 'Está a tu alcance.' : 'No está a tu alcance.'}</div>${reach ? `<button class="primary full" data-act="colonize" data-id="${s.id}" ${c.colonizing || c.influence < 80 ? 'disabled' : ''}>⚓ Colonizar (80 influencia)</button>` : ''}` : ''}
  <div class="sp-sec"><h4>Edificios</h4><div class="bld">${rows || '<small class="dim">Sin edificios.</small>'}</div></div>
  <div class="sp-sec"><h4>Población</h4>${PROF_ORDER.map(p => `<div class="kv sm"><span>${PROFS[p].name}</span><span>${fmtN(s.pops[p] || 0, 1)} · NdV ${f1(s.sol[p] || 0)}</span></div>`).join('')}</div>
  <div class="sp-sec"><h4>Recursos</h4><div class="chips2">${Object.keys(s.res).map(k => `<span class="tag">${RESNAME[k] || k} ${s.res[k]}</span>`).join('') || '<small class="dim">—</small>'}</div></div>`;
  root.scrollTop = keep;
}
const RESNAME = {c: '⚫ Carbón', i: '⛓️ Hierro', u: '🧶 Fibras', U: '🍬 Azúcar', T: '🍵 Té', C: '☕ Café', B: '🚬 Tabaco', F: '🍎 Fruta', w: '🪵 Madera', f: '🐟 Pesca', m: '🐄 Ganado', g: '🌾 Cereal'};

/* ---------- tooltips ---------- */
function showTip(html, x, y) {
  const t = $('#tooltip'); t.innerHTML = html; t.style.display = 'block';
  const w = t.offsetWidth, h = t.offsetHeight;
  t.style.left = Math.min(window.innerWidth - w - 8, x + 16) + 'px'; t.style.top = Math.min(window.innerHeight - h - 8, y + 18) + 'px';
}
function hideTip() { $('#tooltip').style.display = 'none'; }
window.onMapHover = (id, e) => {
  if (id < 0) { hideTip(); return; }
  const s = G.S[id], o = G.C[s.owner];
  showTip(`<div class="tt-h">${s.owner === NONE ? '' : flag(s.owner, 'sm')} <b>${s.name}</b></div><div class="tt-s">${s.owner === NONE ? 'Tierras sin reclamar' : o.name}</div>
   <div class="kv sm"><span>Población</span><b>${fmtN(popTotal(s), 1)}</b></div><div class="kv sm"><span>Nivel de vida</span><b>${f1(s.solAvg)}</b></div><div class="kv sm"><span>PIB semanal</span><b>${fmtN(s.gdp, 1)}</b></div>`, e.clientX, e.clientY);
};
window.onMapClick = (id, e, pid) => {
  if (UI.draw && pid !== undefined && pid >= 0) { drawClick(pid); return; }
  if (UI.landNext && pid !== undefined && pid >= 0) { landClick(pid); return; }
  if (UI.selArmy && pid !== undefined && pid >= 0 && (UI.moveMode || UI.patrolNext || (e && e.shiftKey))) { orderArmies(pid, UI.patrolNext ? 'patrol' : 'move'); return; }
  UI.sel = id >= 0 ? id : null; setSelected(id >= 0 ? id : -1); renderStatePanel();
};

/* ---------- acciones ---------- */
const ACT = {
  win: d => openWindow(d.w), closewin: closeWindow,
  pause: () => { G.paused = !G.paused; updateHud(); },
  speed: d => { UI.speed = +d.n; G.paused = false; updateHud(); },
  mode: d => { setMapMode(d.m); $$('#modes .mode').forEach(b => b.classList.toggle('on', b.dataset.m === d.m)); },
  tab: d => { UI.winTab[d.k] = d.t; renderWindow(true); },
  tax: d => { me().taxLevel = +d.n; renderWindow(); },
  ctax: d => { me().consTax = +d.n; renderWindow(); },
  mil: d => { me().milFund = +d.v; renderWindow(); },
  edu: d => { me().eduFund = +d.v; renderWindow(); },
  research: d => { setResearch(me(), d.id); renderWindow(); },
  lawsel: d => { UI.lawSel = d.id; renderWindow(); },
  enact: d => { const r = startLawChange(me(), d.id); if (!r.ok) toast('⚠️', r.msg); else toast('📜', 'La reforma ha entrado en debate parlamentario.'); renderWindow(); },
  dipsel: d => { UI.dipSel = d.tag; renderWindow(); },
  focus: d => { focusState(+d.id, 55); },
  focusprov: d => { focusProv(+d.id, 40); },
  colonize: d => { if (startColonize(me(), +d.id)) toast('⚓', 'Comienza la colonización.'); renderWindow(); renderStatePanel(); },
  build: d => { if (queueBuild(me(), +d.id, d.b)) toast('🏗️', `${BLD[d.b].name} añadido a la cola de construcción.`); else toast('⚠️', 'No se puede construir ahí.'); renderStatePanel(); },
  cancelq: d => { me().queue.splice(+d.i, 1); renderWindow(); },
  desel: () => { UI.sel = null; setSelected(-1); renderStatePanel(); },
  evt: d => { resolveEvent(+d.i); $('#event').classList.remove('open'); G.paused = false; updateHud(); },
  start: () => startGame(),
  cancelresearch: () => { me().research = null; renderWindow(); },
  improve: d => { const ok = improveRelations(me(), d.tag); toast(ok ? '🕊️' : '⚠️', ok ? 'Las relaciones mejoran (+25).' : 'Necesitas 20 de influencia.'); renderWindow(); refreshDiploMap(); },
  gift: d => { const r = giftMoney(me(), d.tag); toast(r.ok ? '🎁' : '⚠️', r.msg); renderWindow(); refreshDiploMap(); },
  insult: d => { const r = insultCountry(me(), d.tag); toast(r.ok ? '😠' : '⚠️', r.msg); renderWindow(); refreshDiploMap(); },
  pact: d => { const r = playerProposePact(d.t, d.tag, 1); toast(r.ok ? '🤝' : '⚠️', r.msg); renderWindow(); refreshDiploMap(); },
  breakpact: d => { breakPact(+d.id, G.player); renderWindow(); refreshDiploMap(); },
  abroad: d => { const r = sponsorAbroad(me(), d.tag, d.ig); toast(r.ok ? '🕵️' : '⚠️', r.msg); renderWindow(); },
  wardlg: d => openWarDialog(d.tag, d.cb, d.st !== undefined ? +d.st : null),
  wclose: () => { UI.war = null; renderWarDialog(); },
  wcb: d => {
    const W = UI.war; W.cb = d.k; const cb = CBS[d.k]; W.targets.clear();
    if (cb.terr) { const rs = reachableStates(G.player, W.def).filter(x => d.k !== 'claim' || hasClaim(me(), x.id)); if (rs.length) W.targets.add(rs[0].id); }
    renderWarDialog();
  },
  wst: (d, el) => { const W = UI.war; if (el.checked) W.targets.add(+d.id); else W.targets.delete(+d.id); renderWarDialog(); },
  wlawcat: (d, el) => { UI.war.law = {cat: el.value, opt: LAW_CATS.find(x => x.id === el.value).opts[0].id}; renderWarDialog(); },
  wlawopt: (d, el) => { UI.war.law.opt = el.value; renderWarDialog(); },
  wgo: () => {
    const W = UI.war; const r = declareWar(G.player, W.def, W.cb, [...W.targets], {law: W.law});
    if (!r.ok) { toast('⚠️', r.msg); return; }
    UI.war = null; renderWarDialog(); G.paused = false; renderWindow(); fullRepaint();
    if (r.war.targets.length) focusState(r.war.targets[0], 55);
  },
  wcrisis: () => { const W = UI.war; const r = openCrisis(G.player, W.def, W.cb, [...W.targets], {law: W.law}); if (!r.ok) { toast('⚠️', r.msg); return; } UI.war = null; renderWarDialog(); UI.winTab.dip = 'crisis'; UI.win = null; openWindow('diplomacy'); },
  dcwar: d => { const k = (G.dcrises || []).find(x => x.id === +d.id); if (k) { resolveCrisis(k, 'war'); renderWindow(); } },
  dcback: d => { const k = (G.dcrises || []).find(x => x.id === +d.id); if (k) { resolveCrisis(k, 'att_back'); renderWindow(); } },
  dcyield: d => { const k = (G.dcrises || []).find(x => x.id === +d.id); if (k) { resolveCrisis(k, 'def_back'); renderWindow(); refreshDiploMap(); } },
  peace: d => { const w = G.wars.find(x => x.id === +d.id); if (!w) return; makePeace(w); renderWindow(); },
  propyes: d => { respondProposal(+d.id, true); renderWindow(); refreshDiploMap(); },
  propno: d => { respondProposal(+d.id, false); renderWindow(); },
  kickbloc: d => { const b = blocOf(G.player); if (b && b.leader === G.player) { leaveBloc(d.tag, true); addRel(G.player, d.tag, -30); toast('🚪', G.C[d.tag].name + ' expulsado del bloque.'); } renderWindow(); },
  leavebloc: () => { leaveBloc(G.player); renderWindow(); refreshDiploMap(); },
  dissolvebloc: () => { const b = blocOf(G.player); if (b) dissolveBloc(b); renderWindow(); refreshDiploMap(); },
  invitebloc: d => { const r = playerInviteBloc(d.tag); toast(r.ok ? '🤝' : '⚠️', r.msg); renderWindow(); refreshDiploMap(); },
  joinbloc: d => { const b = G.blocs.find(x => x.id === +d.id); const c = me(); if (!b || c.influence < 20) return; c.influence -= 20; const ch = blocInviteChance(b, G.player); if (Math.random() < ch.p) { joinBloc(G.player, b); toast('🤝', `Ingresas en «${b.name}».`); } else toast('⚠️', `${G.C[b.leader].name} rechaza tu solicitud.`); renderWindow(); refreshDiploMap(); },
  blocType: d => { UI.blocType = d.t; renderWindow(); },
  createbloc: () => { const nm = ($('#blocname') || {}).value; const r = createBloc(G.player, UI.blocType || 'military', nm); toast(r.ok ? '🏳️' : '⚠️', r.ok ? `Bloque «${r.bloc.name}» fundado.` : r.msg); renderWindow(); refreshDiploMap(); },
  fabricate: d => { const r = startFabricate(me(), +d.id); toast(r.ok ? '📜' : '⚠️', r.ok ? 'Comienza la fabricación de la reclamación.' : r.msg); renderWindow(); },
  annex: d => { const r = annexSubject(G.player, d.tag); toast(r.ok ? '👑' : '⚠️', r.ok ? 'Vasallo anexionado.' : r.msg); renderWindow(); },
  release: d => { releaseSubject(G.player, d.tag); renderWindow(); },
  igsel: d => { UI.ideoSel = d.k; renderWindow(); },
  sig: d => { const r = sponsorIG(me(), d.k, d.m); toast(r.ok ? '📢' : '⚠️', r.msg); renderWindow(); },
  sprof: d => { const r = sponsorProf(me(), d.p, d.m); toast(r.ok ? '📢' : '⚠️', r.msg); renderWindow(); },
  gov: d => { const r = govTransition(me(), d.k, d.t); toast(r.ok ? '🏛️' : '⚠️', r.msg); renderWindow(true); fullRepaint(); updateHud(); },
  crisisr: d => { const r = respondCrisis(d.k); toast(r.ok ? '🏦' : '⚠️', r.msg); renderWindow(); },
  search: () => openSearch(),
  sgoc: d => { closeSearch(); focusCountry(d.tag, 60); },
  sgos: d => { closeSearch(); focusState(+d.id, 50); onMapClick(+d.id); },
  goCrisis: () => { UI.winTab.prod = 'crisis'; UI.win = null; openWindow('production'); },
  goMail: () => { UI.winTab.dip = 'pacts'; UI.win = null; openWindow('diplomacy'); },
  msec: d => { UI.manualSec = d.id; renderWindow(true); },
  diff: d => { G.diff = +d.n; $$('#st-diff button').forEach(b => b.classList.toggle('on', b.dataset.n === d.n)); },
  zin: () => camZoom(0.7), zout: () => camZoom(1.4), camhome: () => camHome(),
  rotl: () => camRotate(0.3), rotr: () => camRotate(-0.3), tiltu: () => camTilt(0.15), tiltd: () => camTilt(-0.15),
  wheelmode: () => { R.wheelMode = R.wheelMode === 'zoom' ? 'pan' : 'zoom'; saveMapPrefs(); syncCamBtns(); toast('🖱️', R.wheelMode === 'zoom' ? 'La rueda del ratón o del panel táctil hace zoom.' : 'La rueda o el panel táctil desplaza el mapa (pellizca para hacer zoom).'); },
  animtoggle: () => { R.anim = !R.anim; if (R.waterMesh) { R.waterMesh.visible = R.anim; R.cloudMesh.visible = R.anim; } R.renderMs = 10; R.dirty = true; syncCamBtns(); toast('≈', R.anim ? 'Animaciones del mapa activadas.' : 'Animaciones desactivadas (más fluidez).'); },
  edgescroll: () => { R.edgeScroll = !R.edgeScroll; saveMapPrefs(); syncCamBtns(); toast('⇱', R.edgeScroll ? 'Desplazamiento por los bordes activado.' : 'Desplazamiento por los bordes desactivado.'); },
  gomenu: () => { if (confirm('¿Volver al menú principal?\n\nLa partida se guardará automáticamente (puedes retomarla con «Continuar»).')) { try { doSave(true); } catch (e) {} location.reload(); } },
  save: () => doSave(),
  load: () => doLoad(),
  cont: () => doLoad(true),
  pickc: d => selectStartCountry(d.tag),
  filterc: () => {},
  selarmy: d => { selectArmy(+d.id); const a = armyById(+d.id); if (a) focusProv(a.loc, 40); renderWindow(); },
  seltoken: (d, el, e) => { selectArmy(+d.id, e && (e.shiftKey || e.ctrlKey)); if (UI.win === 'military') renderWindow(); },
  movemode: () => { UI.moveMode = !UI.moveMode; document.body.classList.toggle('movemode', UI.moveMode); if (UI.moveMode) toast('🎯', 'Modo mover: haz clic izquierdo en la provincia de destino (o en un ejército enemigo para perseguirlo).'); renderArmyPanel(); },
  chase: d => { const a = armyById(UI.selArmy); const t = armyById(+d.id); if (a && t) { const r = orderMove(a, t.loc); if (r.ok) { a.chase = t.id; toast('🎯', `${a.name} persigue a ${t.name}.`); } else toast('⚠️', r.msg); renderArmyPanel(); } },
  selbattle: d => { UI.battle = +d.id; renderBattlePanel(); },
  closebattle: () => { UI.battle = null; renderBattlePanel(); },
  armyclose: () => selectArmy(null),
  armystop: () => { const a = armyById(UI.selArmy); if (a) { a.path = []; a.dest = null; renderArmyPanel(); R.labelsDirty = true; } },
  armycap: () => { const a = armyById(UI.selArmy); if (!a) return; const r = orderMove(a, me().capital); if (!r.ok) toast('⚠️', r.msg); else toast('➜', `${a.name} regresa a la capital (${r.eta} días).`); renderArmyPanel(); R.labelsDirty = true; },
  armysplit: () => { const a = armyById(UI.selArmy); const n = a && splitArmy(a); if (n) { selectArmy(n.id); toast('✂', 'Ejército dividido.'); R.labelsDirty = true; } },
  armymerge: d => { const a = armyById(UI.selArmy), o = armyById(+d.id); if (a && o && mergeArmies(a, o)) { toast('⛓', 'Ejércitos fusionados.'); renderArmyPanel(); R.labelsDirty = true; } },
  armydisband: () => { const a = armyById(UI.selArmy); if (a && confirm('¿Disolver este ejército? Los soldados volverán a la población.')) { disbandArmy(a); selectArmy(null); renderWindow(); } },
  propa: d => { const r = buyPropaganda(me(), d.k); toast(r.ok ? '📢' : '⚠️', r.msg); renderWindow(); },
  mob: d => { const r = setMobilization(me(), +d.n); if (r.msg) toast(r.ok ? '🪖' : '⚠️', r.msg); renderWindow(); },
  eqpol: d => { me().eqPolicy = +d.n; renderWindow(); },
  recruit: d => { const r = recruit(me(), +d.id, d.t); toast(r.ok ? '🪖' : '⚠️', r.ok ? `Reclutando ${DIVS[d.t].name} en ${G.S[+d.id].name}.` : r.msg); renderWindow(); }
};
function refreshDiploMap() { if (R.mode === 'diplomacy' || R.mode === 'blocs') fullRepaint(); }

document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]'); if (!el || el.disabled || el.tagName === 'SELECT' || el.tagName === 'OPTION') return;
  const f = ACT[el.dataset.act]; if (f) { f(el.dataset, el, e); if (el.type !== 'checkbox') e.stopPropagation(); }
});
document.addEventListener('mouseover', e => {
  const el = e.target.closest('[data-tip]');
  if (el && el.dataset.tip) showTip(el.dataset.tip, e.clientX, e.clientY);
});
document.addEventListener('mousemove', e => {
  const el = e.target.closest('[data-tip]');
  if (el && el.dataset.tip) { const t = $('#tooltip'); if (t.style.display === 'block') { t.style.left = Math.min(window.innerWidth - t.offsetWidth - 8, e.clientX + 16) + 'px'; t.style.top = Math.min(window.innerHeight - t.offsetHeight - 8, e.clientY + 18) + 'px'; } }
});
document.addEventListener('mouseout', e => { if (e.target.closest && e.target.closest('[data-tip]') && !(e.relatedTarget && e.relatedTarget.closest && e.relatedTarget.closest('[data-tip]'))) hideTip(); });
document.addEventListener('change', e => { const el = e.target; if (el.tagName === 'SELECT' && el.dataset.act && ACT[el.dataset.act]) ACT[el.dataset.act](el.dataset, el); });
document.addEventListener('input', e => {
  const el = e.target;
  if (el.id === 'dipq') { UI.dipQ = el.value; const pos = el.selectionStart; renderWindow(true); const n = $('#dipq'); if (n) { n.focus(); n.setSelectionRange(pos, pos); } }
  else if (el.id === 'blocname') UI.blocName = el.value;
  else if (el.id === 'stq') { const q = norm(el.value); $$('#st-list .st-card').forEach(c => { c.style.display = !q || norm(c.textContent).includes(q) ? '' : 'none'; }); }
});
window.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k' && UI.started) { e.preventDefault(); openSearch(); return; }
  if (e.key === 'Escape' && $('#search').classList.contains('open')) { closeSearch(); return; }
  if (e.key === 'Escape' && UI.war) { UI.war = null; renderWarDialog(); return; }
  if (!UI.started || /input|select|textarea/i.test(e.target.tagName)) return;
  if (e.key === 'F1') { e.preventDefault(); openWindow('manual'); return; }
  if (e.key === '/') { e.preventDefault(); openSearch(); return; }
  if (e.code === 'Space') { e.preventDefault(); ACT.pause(); }
  else if (e.key === 'Escape') { if (UI.win) closeWindow(); else ACT.desel(); }
  else if (e.key === '.') { UI.speed = Math.min(5, UI.speed + 1); updateHud(); }
  else if (e.key === ',') { UI.speed = Math.max(1, UI.speed - 1); updateHud(); }
});

/* ---------- avisos ---------- */
function toast(icon, text, state) {
  const el = document.createElement('div'); el.className = 'toast';
  el.innerHTML = `<span>${icon}</span><p>${text}</p><b class="tx" title="Cerrar">✕</b>`;
  el.classList.add('click'); el.addEventListener('click', e => { if (state !== undefined && state !== null && !e.target.classList.contains('tx')) focusState(state, 55); el.remove(); });
  $('#toasts').appendChild(el);
  setTimeout(() => el.classList.add('in'), 10);
  setTimeout(() => { el.classList.remove('in'); setTimeout(() => el.remove(), 400); }, 6500);
  while ($("#toasts").children.length > 4) $('#toasts').firstChild.remove();
}
const NOTIF_ICON = {build: '🏗️', tech: '💡', law: '📜', journal: '🏆', war: '⚔️', colony: '⚓', event: '📰', diplo: '🤝', crisis: '📉', politics: '🏛️'};
function drainNotifs() {
  while (G.notifs.length) {
    const n = G.notifs.shift();
    const relevant = true;
    if (relevant) toast(NOTIF_ICON[n.type] || '•', n.text, n.state);
  }
}

/* ---------- evento emergente ---------- */
function showEvent() {
  const e = G.pendingEvent; if (!e) return;
  const ev = EVENTS.find(x => x.id === e.id); const c = me();
  G.paused = true; updateHud();
  const el = $('#event'); el.classList.add('open');
  el.innerHTML = `<div class="evbox"><div class="evhead"><h2>${e.icon || '📰'} ${e.title}</h2><small>${dateStr()}</small></div><div class="evbody"><p>${e.text}</p>${ev.opts.map((o, i) => `<button class="evopt" data-act="evt" data-i="${i}">${o.t}${o.cost ? ` <small>(−${money(c.stats.income * o.cost)})</small>` : ''}${o.hint ? `<em>${o.hint}</em>` : ''}</button>`).join('')}</div></div>`;
}

/* ---------- pantalla de inicio ---------- */
const START_PICKS = ['GBR', 'FRA', 'PRU', 'AUS', 'RUS', 'OTT', 'USA', 'SPA', 'NET', 'BEL', 'SWE', 'SAR', 'TWS', 'BAV', 'POR', 'DEN', 'MEX', 'BRZ', 'CHN', 'JAP', 'SIA', 'PRS', 'EGY', 'HYD', 'ETH', 'ARG', 'CHL', 'SWI'];
function difficulty(tag) {
  const c = G.C[tag]; return c.rank <= 8 ? ['Fácil', 'good'] : c.rank <= 22 ? ['Media', 'warn'] : ['Difícil', 'bad'];
}
const INTRO = {
  GBR: 'La primera potencia industrial: carbón, hierro y un vasto imperio colonial. Cuida la India y las reformas.',
  FRA: 'Una gran potencia continental recién salida de las revoluciones. Equilibra el orgullo nacional y la industria.',
  PRU: 'Un estado militar y burocrático con ambiciones de unificar Alemania. Ejército fuerte y educación avanzada.',
  AUS: 'Imperio multinacional en el corazón de Europa. Mantén unidas a sus nacionalidades.',
  RUS: 'Un imperio inmenso pero atrasado, atado a la servidumbre. Tarde o temprano deberá modernizarse.',
  OTT: 'El «enfermo de Europa»: vasto y heterogéneo. Reforma antes de que sea tarde.',
  USA: 'República joven con enorme potencial de expansión y tensiones por la esclavitud.',
  CHN: 'La mayor economía del mundo bajo los Qing, aún cerrada al exterior. Cuidado con las potencias occidentales.',
  JAP: 'El aislado Japón Tokugawa. Cuando lleguen los barcos negros, ¿estarás listo?'
};
function buildStart() {
  const rest = G.rankList.filter(t => !START_PICKS.includes(t) && G.C[t].states.length);
  const picks = START_PICKS.filter(t => G.C[t]).concat(rest);
  $('#start').innerHTML = `
  <div class="st-inner">
    <div class="st-left">
      <div class="st-logo"><small>UNA RÉPLICA DE FANS</small><h1>VICTORIA</h1><div class="orn"></div><h3>Una era de revolución</h3></div>
      <input id="stq" class="search" placeholder="🔍 Buscar país…" autocomplete="off">
      <div class="st-list" id="st-list">${picks.map(t => { const c = G.C[t]; const d = difficulty(t); return `<div class="st-card" data-act="pickc" data-tag="${t}">${flag(t, 'md')}<div><b>${c.name}</b><small>${c.gov}</small></div><span class="diff ${d[1]}">${d[0]}</span></div>`; }).join('')}</div>
    </div>
    <div class="st-right" id="st-info"></div>
  </div>`;
  selectStartCountry('GBR');
  document.body.classList.add('starting');
}
function selectStartCountry(tag) {
  UI.startTag = tag;
  const c = G.C[tag]; const d = difficulty(tag);
  $$('#st-list .st-card').forEach(e => e.classList.toggle('on', e.dataset.tag === tag));
  $('#st-info').innerHTML = `<div class="st-crest">${flag(tag, 'huge')}</div><h2>${c.name}</h2><div class="st-gov">${c.gov} · Rango ${c.rank} · <span class="${d[1]}">${d[0]}</span></div>
   <p class="st-intro">${INTRO[tag] || `Gobierna ${c.name} en el año 1836 y llévala hacia la era industrial.`}</p>
   <div class="traits st">${traitsHtml(c)}</div>
   <div class="st-stats"><div><small>Población</small><b>${fmtN(c.stats.pop, 1)}</b></div><div><small>Alfabetización</small><b>${Math.round(c.lit)}%</b></div><div><small>Estados</small><b>${c.states.length}</b></div><div><small>Ejército</small><b>${fmtN(c.stats.soldiers, 0)}</b></div></div>
   <div class="st-diffrow"><small>Dificultad económica</small><div class="seg" id="st-diff">${[1, 2, 3, 4].map(n => `<button data-act="diff" data-n="${n}" class="${(G.diff || 2) === n ? 'on' : ''}" data-tip="${['Pocas crisis, costes bajos', 'Crisis ocasionales y costes realistas', 'Crisis frecuentes, intereses y costes altos', 'Crisis constantes: economía muy hostil'][n - 1]}">${DIFF[n].name}</button>`).join('')}</div></div>
   <button class="primary big" data-act="start">Comenzar partida</button>${hasSave() ? '<button class="cont" data-act="cont">📂 Continuar partida guardada</button>' : ''}`;
  const ci = c.capital >= 0 ? c.capital : c.states[0];
  if (ci !== undefined) focusState(ci, 70);
  // resalta el país en el mapa
  G.player = tag; G.tags.forEach(t => G.C[t].ai = t !== tag);
  setMapMode('political');
}
function startGame() {
  const tag = UI.startTag;
  G.player = tag; G.tags.forEach(t => G.C[t].ai = t !== tag);
  UI.started = true; G.paused = true; achSnapshot(G.C[tag]); document.body.classList.remove('starting');
  $('#start').classList.add('hide'); setTimeout(() => $('#start').style.display = 'none', 600);
  $('#hud').classList.add('show');
  buildHud(); updateHud(); computeLabels();
  focusState(G.C[tag].capital >= 0 ? G.C[tag].capital : G.C[tag].states[0], 60);
  fullRepaint();
  toast('🎩', `Bienvenido, gobernante de ${G.C[tag].name}. El juego está en pausa: pulsa ▶ para comenzar.`);
}

/* ---------- guardar / cargar ---------- */
function doSave(silent) {
  try { localStorage.setItem(SAVE_KEY, saveData()); if (!silent) toast('💾', 'Partida guardada: ' + dateStr()); }
  catch (e) { toast('⚠️', 'No se pudo guardar la partida (' + (e.name || 'error') + ').'); }
}
function hasSave() { try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; } }
function doLoad(fromStart) {
  let txt = null; try { txt = localStorage.getItem(SAVE_KEY); } catch (e) {}
  if (!txt) { toast('⚠️', 'No hay ninguna partida guardada.'); return; }
  try { loadData(txt); } catch (e) { console.error(e); toast('⚠️', 'La partida guardada no se pudo cargar.'); return; }
  UI.started = true; UI.sel = null; UI.win = null; closeWindow();
  $('#start').classList.add('hide'); setTimeout(() => $('#start').style.display = 'none', 600);
  $('#hud').classList.add('show');
  buildHud(); computeEdges(G.ownerOf); computeLabels(); setSelected(-1); renderStatePanel(); updateHud();
  const c = me(); focusState(c.capital >= 0 ? c.capital : c.states[0], 60); fullRepaint();
  toast('📂', 'Partida cargada: ' + dateStr());
}

/* ---------- bucle principal ---------- */
const SPEED_MS = [0, 900, 450, 200, 80, 25];
let _gt = 0;
window.onFrame = function (t) {
  if (!UI.started) return;
  const dt = t - _gt; _gt = t;
  if (!G.paused && !G.pendingEvent) {
    UI.acc += Math.min(dt, 200);
    let n = 0;
    while (UI.acc >= SPEED_MS[UI.speed] && n < 40) {
      UI.acc -= SPEED_MS[UI.speed]; const m0 = G.date.m;
      advanceDay(); n++;
      if (G.date.m !== m0 && R.mode !== 'political' && R.mode !== 'terrain') R.needPaint = true;
      if (G.date.m !== m0 && G.date.m === 0) doSave(true);
      if (G.pendingEvent) break;
    }
    if (n) { R.labelsDirty = true; if (UI.selArmy) renderArmyPanel(); }
  }
  if (G.pendingEvent && !$('#event').classList.contains('open')) showEvent();
  if (R.needPaint) { R.needPaint = false; fullRepaint(); }
  if (G.notifs.length) drainNotifs();
  if (t - UI.lastHud > 250) { UI.lastHud = t; updateHud(); if (UI.sel !== null && UI.sel >= 0 && t - UI.lastWin > 1500) renderStatePanel(); }
  if ((UI.battle || UI.selArmy) && t - (UI.lastPanel || 0) > 500) { UI.lastPanel = t; if (UI.battle) renderBattlePanel(); if (UI.selArmy) renderArmyPanel(); }
  if (UI.win && t - UI.lastWin > 1500 && !G.paused && !(document.activeElement && /input|select/i.test(document.activeElement.tagName))) { UI.lastWin = t; renderWindow(); }
  if (R.minimapDirty) R.dirty = true;
};
