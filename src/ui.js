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
      <div class="pl-sub" id="pl-sub"></div>
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
    </div>
  </div>
  <div id="datebox">
    <button class="spd" data-act="pause" id="btn-pause" title="Pausa (Espacio)">⏸</button>
    <div class="date" id="datetxt"></div>
    <div class="speeds">${[1, 2, 3, 4, 5].map(i => `<button class="spd s" data-act="speed" data-n="${i}" title="Velocidad ${i}"><i></i></button>`).join('')}</div>
  </div>
  <div id="topright">
    <button class="rbtn" data-act="save" title="Guardar partida">💾</button>
    <button class="rbtn" data-act="load" title="Cargar partida">📂</button>
    <button class="rbtn" data-act="win" data-w="journal" title="Diario">📜</button>
    <button class="rbtn" data-act="win" data-w="help" title="Ayuda y controles">❔</button>
  </div>
  <div id="menu">
    ${[['budget', '💷', 'Presupuesto'], ['production', '🏭', 'Producción y mercado'], ['pops', '👥', 'Población'], ['politics', '🏛️', 'Política'], ['tech', '💡', 'Tecnología'], ['diplomacy', '🤝', 'Diplomacia'], ['military', '⚔️', 'Ejército y guerra'], ['construction', '🏗️', 'Construcción']]
      .map(([id, ic, t]) => `<button class="mbtn" data-act="win" data-w="${id}" data-tip="${t}" id="mb-${id}"><span>${ic}</span></button>`).join('')}
  </div>
  <div id="mapctl">
    <canvas id="minimap" width="260" height="104"></canvas>
    <div id="modes">${MAP_MODES.map(m => `<button class="mode ${m.id === R.mode ? 'on' : ''}" data-act="mode" data-m="${m.id}" data-tip="${m.name}">${m.icon}</button>`).join('')}</div>
  </div>`;
  $('#minimap').addEventListener('mousedown', e => minimapJump(e));
  $('#minimap').addEventListener('mousemove', e => { if (e.buttons) minimapJump(e); });
  $('#crest').innerHTML = '';
}
function minimapJump(e) {
  const r = e.currentTarget.getBoundingClientRect();
  const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
  focusLonLat(-180 + x * 360, LAT_TOP - y * (LAT_TOP - LAT_BOT));
}

function updateHud(force) {
  const c = me(); if (!c) return;
  const st = c.stats;
  $('#crest').innerHTML = flag(c.tag, 'big');
  $('#pl-name').textContent = c.name;
  $('#pl-sub').textContent = `${c.gov} · Rango ${c.rank}`;
  const set = (id, txt, tip) => { const e = $('#' + id); e.querySelector('span').textContent = txt; if (tip) e.dataset.tip = tip; };
  set('ch-treasury', money(c.treasury), `<b>Tesoro</b><br>${money(c.treasury)}`);
  const bal = st.income - st.expense - (c.budget.expense.constr || 0) - (c.budget.expense.pub || 0) - (c.budget.expense.interest || 0);
  set('ch-balance', (bal >= 0 ? '+' : '') + fmtN(bal, 1), `<b>Balance semanal</b><br>Ingresos ${money(st.income)}<br>Gastos ${money(st.expense + (c.budget.expense.constr || 0) + (c.budget.expense.pub || 0))}`);
  $('#ch-balance').classList.toggle('neg', bal < 0);
  set('ch-prestige', Math.round(c.prestige), '<b>Prestigio</b><br>Determina tu posición entre las potencias.');
  set('ch-influence', Math.floor(c.influence), '<b>Influencia</b><br>Se gasta en reformas, guerras y diplomacia.');
  set('ch-innov', Math.floor(c.innovStock) + ' (+' + f1(st.innovRate) + ')', `<b>Innovación</b><br>${f1(st.innovRate)} puntos/semana`);
  set('ch-leg', Math.round(c.legitimacy) + '%', '<b>Legitimidad</b><br>Por debajo del 40% crecen los disturbios.');
  set('ch-pop', fmtN(st.pop, 1), '<b>Población</b>');
  set('ch-sol', f1(st.sol), '<b>Nivel de vida medio</b><br>En una escala de 0 a 25.');
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
  const nb = root.querySelector('.wbody'); if (nb) nb.scrollTop = sc;
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
  const exp = (b.expense.gov || 0) + (b.expense.constr || 0) + (b.expense.pub || 0) + (b.expense.interest || 0);
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
        ${row('Salarios públicos (admin., ejército, universidades)', b.expense.gov || 0)}${row('Construcción pública', b.expense.constr || 0)}${row('Servicios públicos y obras menores', b.expense.pub || 0)}${row('Intereses de la deuda', b.expense.interest || 0)}
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
  } else {
    const rows = BUILDINGS.map(b => {
      let lv = 0, cap = 0, jobs = 0, va = 0, n = 0;
      c.states.forEach(i => { const s = G.S[i]; lv += s.b[b.id] || 0; cap += s.cap[b.id] || 0; if (s.bva && s.bva[b.id] !== undefined && s.b[b.id]) { va += s.bva[b.id]; n++; } });
      const locked = b.tech && !c.techs.has(b.tech);
      return `<tr class="${locked ? 'locked' : ''}"><td><span class="gi">${b.icon}</span> ${b.name}${locked ? ` <small class="dim">🔒 ${TECH[b.tech].name}</small>` : ''}</td><td>${b.grp}</td><td class="r">${Math.round(lv)}</td><td class="r">${Math.round(cap)}</td><td class="r">${b.out ? money(n ? va / n : 0) : '—'}</td></tr>`;
    }).join('');
    body = `<div class="scrollable tall"><table class="tbl"><thead><tr><th>Edificio</th><th>Tipo</th><th class="r">Niveles</th><th class="r">Capacidad</th><th class="r">Valor añadido/nivel</th></tr></thead><tbody>${rows}</tbody></table></div><p class="hint">Selecciona un estado en el mapa para construir nuevos niveles. Los inversores privados también construyen donde hay más beneficio.</p>`;
  }
  return tabs('prod', [['market', 'Mercado mundial'], ['buildings', 'Edificios del país']]) + body;
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
      ${c.lawChange ? `<div class="notice">📜 Reforma en curso: <b>${LAW[c.lawChange.opt].name}</b> — ${c.lawChange.months} meses · probabilidad de éxito ${pctS(c.lawChange.chance)}</div>` : ''}
    </div></div>
    <div class="col wide"><div class="card"><h3>Grupos de interés</h3><div class="igs">${IG_ORDER.slice().sort((a, b) => c.ig[b].share - c.ig[a].share).map(k => { const g = c.ig[k], d = IGS[k]; return `
      <div class="ig ${g.gov ? 'gov' : ''}" data-tip="<b>${d.name}</b><br>${d.desc}"><div class="igh"><span class="igi" style="background:${d.color}">${d.icon}</span><div><b>${d.name}</b><small>${g.gov ? 'En el gobierno' : 'Oposición'}</small></div><span class="face">${faceFor(g.approval)}</span></div>
      <div class="kv"><span>Influencia</span><b>${pctS(g.share, 1)}</b></div>${bar(g.share, 0.5, '', '')}
      <div class="kv"><span>Aprobación</span><b class="${g.approval < -1 ? 'bad' : g.approval > 1 ? 'good' : ''}">${sgn(g.approval)}</b></div></div>`; }).join('')}</div></div></div></div>`;
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
  return tabs('pol', [['igs', 'Gobierno y grupos de interés'], ['laws', 'Leyes']]) + body;
}};
const MODNAME = {tax: 'Recaudación', bur: 'Burocracia', invest: 'Inversión privada', lit: 'Alfabetización', grow: 'Crecimiento', army: 'Ejército', rad: 'Radicalismo', out: 'Producción', lab: 'Cuota salarial', stab: 'Estabilidad'};
const MODGOOD = {rad: -1};

/* --- Tecnología --- */
WINDOWS.tech = {title: 'Tecnología', icon: '💡', render() {
  const c = me(), st = c.stats;
  const cur = c.research ? TECH[c.research] : null;
  const cats = ['Producción', 'Sociedad', 'Militar'];
  return `<div class="card"><div class="kv"><span>Puntos de innovación</span><b>${Math.floor(c.innovStock)} <small>(+${f1(st.innovRate)}/semana)</small></b></div>
   ${cur ? `<div class="kv"><span>Investigando: <b>${cur.name}</b></span><b>${Math.min(100, Math.floor(c.innovStock / cur.cost * 100))}%</b></div>${bar(c.innovStock, cur.cost, 'gold')}` : '<div class="notice">No estás investigando nada. Elige una tecnología.</div>'}
   <p class="hint">Construye <b>Universidades</b> y mejora la alfabetización para acelerar la innovación.</p></div>
  <div class="techcols">${cats.map(cat => `<div class="techcol"><h3>${cat}</h3>${TECHS.filter(t => t.cat === cat).map(t => {
    const done = c.techs.has(t.id), avail = techAvailable(c, t), now = c.research === t.id;
    const reqs = (t.req || []).map(r => TECH[r].name).join(', ');
    const fx = Object.keys(t.fx).map(k => `${TECHFX[k] || k} ${sgn(t.fx[k] * 100, 0)}%`).join(' · ');
    return `<div class="tech ${done ? 'done' : ''} ${now ? 'now' : ''} ${!avail && !done ? 'lock' : ''}" ${avail && !now ? `data-act="research" data-id="${t.id}"` : ''}><b>${done ? '✔ ' : ''}${t.name}</b><small>${t.desc}</small>${fx ? `<small class="good">${fx}</small>` : ''}<span class="cost">${done ? 'Completada' : now ? 'En curso' : `💡 ${t.cost}`}</span>${!avail && !done ? `<small class="dim">Requiere: ${reqs}</small>` : ''}</div>`;
  }).join('')}</div>`).join('')}</div>`;
}};
const TECHFX = {agriOut: 'Prod. agrícola', mineOut: 'Prod. minera', indOut: 'Prod. industrial', constr: 'Construcción', innov: 'Innovación', bur: 'Burocracia', tax: 'Recaudación', invest: 'Inversión', grow: 'Crecimiento', army: 'Ejército', lit: 'Alfabetización', infra: 'Infraestructura'};

/* --- Diplomacia --- */
WINDOWS.diplomacy = {title: 'Diplomacia', icon: '🤝', render() {
  const c = me(); const t = curTab('dip', 'world');
  let body = '';
  if (t === 'world') {
    const sel = UI.dipSel && G.C[UI.dipSel] && UI.dipSel !== NONE ? UI.dipSel : G.rankList.find(x => x !== G.player);
    const o = G.C[sel];
    const rel = c.relations[sel] ?? 0; const reach = canReach(G.player, sel); const atWar = G.wars.some(w => (w.att === G.player && w.def === sel) || (w.def === G.player && w.att === sel));
    body = `<div class="cols"><div class="col wide"><div class="scrollable tall"><table class="tbl clickable"><thead><tr><th>#</th><th>País</th><th class="r">Prestigio</th><th class="r">Población</th><th class="r">PIB</th><th class="r">Relación</th></tr></thead><tbody>${G.rankList.map(tag => { const k = G.C[tag]; if (!k.states.length) return ''; const r = k.relations[G.player] ?? 0; return `<tr class="${tag === sel ? 'sel' : ''} ${tag === G.player ? 'me' : ''}" data-act="dipsel" data-tag="${tag}"><td>${k.rank}</td><td>${flag(tag, 'sm')} ${k.name}</td><td class="r">${Math.round(k.prestige)}</td><td class="r">${fmtN(k.stats.pop, 1)}</td><td class="r">${fmtN(k.stats.gdp, 1)}</td><td class="r ${r < -20 ? 'bad' : r > 20 ? 'good' : ''}">${tag === G.player ? '—' : sgn(r, 0)}</td></tr>`; }).join('')}</tbody></table></div></div>
    <div class="col"><div class="card"><div class="dipcard">${flag(sel, 'big')}<div><h3>${o.name}</h3><small>${o.gov}</small></div></div>
     <div class="kv"><span>Rango</span><b>#${o.rank}</b></div><div class="kv"><span>Prestigio</span><b>${Math.round(o.prestige)}</b></div>
     <div class="kv"><span>Población</span><b>${fmtN(o.stats.pop, 1)}</b></div><div class="kv"><span>Ejército</span><b>${fmtN(o.stats.soldiers, 1)}</b></div>
     <div class="kv"><span>Estados</span><b>${o.states.length}</b></div>
     ${sel !== G.player ? `<div class="kv"><span>Relaciones</span><b class="${rel < -20 ? 'bad' : rel > 20 ? 'good' : ''}">${sgn(rel, 0)}</b></div>${bar(rel + 100, 200, rel < 0 ? 'bad' : 'good')}
     <div class="btnrow"><button data-act="improve" data-tag="${sel}" ${c.influence < 20 ? 'disabled' : ''}>🕊️ Mejorar relaciones <small>20 infl.</small></button>
     <button class="danger" data-act="war" data-tag="${sel}" ${atWar || !reach || c.influence < 40 ? 'disabled' : ''}>⚔️ Declarar la guerra <small>40 infl.</small></button></div>
     <small class="dim">${atWar ? 'Ya estáis en guerra.' : !reach ? 'No tienes un frente alcanzable contra este país.' : 'Atacarás el estado fronterizo más cercano.'}</small>` : ''}</div></div></div>`;
  } else {
    const tg = colonizeTargets(c).slice(0, 14);
    body = `<div class="card"><h3>Colonización</h3>${c.colonizing ? `<div class="notice">⚓ Colonizando <b>${G.S[c.colonizing.state].name}</b> — ${c.colonizing.months} meses restantes.</div>` : '<p class="hint">Reclama tierras sin dueño al alcance de tus territorios. Cuesta 80 de influencia y tarda 6 meses.</p>'}
     <table class="tbl clickable"><thead><tr><th>Estado</th><th class="r">Población</th><th class="r">Distancia</th><th></th></tr></thead><tbody>${tg.map(x => { const s = G.S[x.id]; return `<tr data-act="focus" data-id="${s.id}"><td>${s.name}</td><td class="r">${fmtN(popTotal(s), 1)}</td><td class="r">${Math.round(x.d)}°</td><td class="r"><button data-act="colonize" data-id="${s.id}" ${c.colonizing || c.influence < 80 ? 'disabled' : ''}>Colonizar</button></td></tr>`; }).join('') || '<tr><td colspan="4" class="dim">No hay territorios sin reclamar a tu alcance.</td></tr>'}</tbody></table></div>`;
  }
  return tabs('dip', [['world', 'Potencias'], ['colony', 'Colonización']]) + body;
}};

/* --- Ejército y guerra --- */
WINDOWS.military = {title: 'Ejército y guerra', icon: '⚔️', render() {
  const c = me(), st = c.stats;
  const myWars = G.wars.filter(w => w.att === G.player || w.def === G.player);
  const pw = armyPower(c);
  let barr = 0; c.states.forEach(i => barr += G.S[i].b.barracks || 0);
  return `<div class="cols"><div class="col"><div class="card"><h3>Fuerzas armadas</h3>
   <div class="kv"><span>Soldados</span><b>${fmtN(st.soldiers, 1)}</b></div>
   <div class="kv"><span>Niveles de cuarteles</span><b>${Math.round(barr)}</b></div>
   <div class="kv"><span>Potencia militar</span><b>${fmtN(pw, 1)}</b></div>
   <div class="kv"><span>Modelo de ejército</span><b>${LAW[c.laws.army].name}</b></div>
   <div class="kv"><span>Bonificación tecnológica</span><b>${sgn(c.mods.army * 100, 0)}%</b></div>
   <p class="hint">Construye <b>Cuarteles</b> para reclutar más soldados. Los soldados se pagan con el presupuesto público.</p>
  </div></div>
  <div class="col wide"><div class="card"><h3>Guerras en curso</h3>${myWars.length ? myWars.map(w => {
    const A = G.C[w.att], D = G.C[w.def]; const mine = w.att === G.player; const score = mine ? w.score : -w.score;
    return `<div class="war"><div class="warh">${flag(w.att, 'sm')} <b>${A.name}</b> <span>contra</span> ${flag(w.def, 'sm')} <b>${D.name}</b></div>
      <div class="kv"><span>Objetivo: ${G.S[w.target] ? G.S[w.target].name : '—'}</span><span>${w.months} meses</span></div>
      <div class="wbar"><i style="left:${(w.score + 100) / 2}%"></i><b style="width:${(w.score + 100) / 2}%"></b></div>
      <div class="kv"><span>Potencia: ${fmtN(w.pa || armyPower(A), 1)} vs ${fmtN(w.pd || armyPower(D), 1)}</span><b class="${score >= 0 ? 'good' : 'bad'}">${sgn(score, 0)}</b></div>
      <div class="btnrow"><button data-act="peace" data-id="${w.id}">🕊️ ${score > 30 ? 'Imponer la paz' : score < -30 ? 'Pedir la paz' : 'Paz blanca'}</button><button data-act="focus" data-id="${w.target}">Ver en el mapa</button></div></div>`;
  }).join('') : '<p class="hint">Tu país está en paz. Declara una guerra desde la pestaña de Diplomacia.</p>'}</div>
  <div class="card"><h3>Otras guerras en el mundo</h3>${G.wars.filter(w => w.att !== G.player && w.def !== G.player).map(w => `<div class="kv"><span>${flag(w.att, 'sm')} ${G.C[w.att].name} → ${flag(w.def, 'sm')} ${G.C[w.def].name}</span><b>${sgn(w.score, 0)}</b></div>`).join('') || '<p class="hint">No hay otras guerras.</p>'}</div></div></div>`;
}};

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

/* --- Ayuda --- */
WINDOWS.help = {title: 'Ayuda y controles', icon: '❔', render() {
  return `<div class="cols"><div class="col"><div class="card"><h3>Mapa</h3><ul class="plain"><li><b>Arrastrar</b> con el botón izquierdo: desplazar el mapa</li><li><b>Rueda</b>: acercar / alejar</li><li><b>Botón derecho + arrastrar</b> (o Mayús): girar e inclinar</li><li><b>W A S D / flechas</b>: moverse · <b>Q E</b> girar · <b>R F</b> inclinar</li><li><b>Clic</b> sobre un estado: ver detalles y construir</li><li><b>Minimapa</b>: clic para saltar</li></ul></div>
  <div class="card"><h3>Tiempo</h3><ul class="plain"><li><b>Espacio</b>: pausa</li><li><b>, / .</b>: velocidad menor / mayor</li><li><b>Esc</b>: cerrar ventana</li></ul></div></div>
  <div class="col"><div class="card"><h3>Cómo jugar</h3><ul class="plain"><li>La <b>economía</b> es un mercado mundial: cada bien tiene un precio que sube con la escasez.</li><li>Los edificios emplean a la población, generan valor añadido y pagan salarios y beneficios.</li><li>Construye <b>Administración</b> para recaudar impuestos, <b>Universidades</b> para innovar y <b>Cuarteles</b> para el ejército.</li><li>En <b>Política</b>, cada reforma divide a los grupos de interés: la legitimidad depende de que los poderosos estén contentos.</li><li>Con <b>influencia</b> puedes promulgar reformas, mejorar relaciones, colonizar y declarar la guerra.</li></ul></div>
  <div class="card"><h3>Sobre esta réplica</h3><p class="hint">Proyecto de fans inspirado en <i>Victoria 3</i>. El mapa es una aproximación procedural del mundo de 1836 y la simulación está simplificada. No tiene ninguna relación con Paradox Interactive.</p></div></div></div>`;
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
window.onMapClick = (id) => {
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
  improve: d => { improveRelations(me(), d.tag); renderWindow(); },
  war: d => { const r = declareWar(G.player, d.tag); if (!r.ok) toast('⚠️', r.msg); renderWindow(); fullRepaint(); },
  peace: d => { const w = G.wars.find(x => x.id === +d.id); if (!w) return; makePeace(w); renderWindow(); },
  focus: d => { focusState(+d.id, 55); },
  colonize: d => { if (startColonize(me(), +d.id)) toast('⚓', 'Comienza la colonización.'); renderWindow(); renderStatePanel(); },
  build: d => { if (queueBuild(me(), +d.id, d.b)) toast('🏗️', `${BLD[d.b].name} añadido a la cola de construcción.`); else toast('⚠️', 'No se puede construir ahí.'); renderStatePanel(); },
  cancelq: d => { me().queue.splice(+d.i, 1); renderWindow(); },
  desel: () => { UI.sel = null; setSelected(-1); renderStatePanel(); },
  evt: d => { resolveEvent(+d.i); $('#event').classList.remove('open'); G.paused = false; updateHud(); },
  start: () => startGame(),
  save: () => doSave(),
  load: () => doLoad(),
  cont: () => doLoad(true),
  pickc: d => selectStartCountry(d.tag),
  filterc: () => {}
};
function makePeace(w) {
  const mine = w.att === G.player; const score = mine ? w.score : -w.score;
  if (score > 30) endWar(w, G.player);
  else if (score < -30) { endWar(w, mine ? w.def : w.att); }
  else { endWar(w, null); }
}

document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]'); if (!el || el.disabled) return;
  const f = ACT[el.dataset.act]; if (f) { f(el.dataset, el); e.stopPropagation(); }
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
window.addEventListener('keydown', e => {
  if (!UI.started || /input/i.test(e.target.tagName)) return;
  if (e.code === 'Space') { e.preventDefault(); ACT.pause(); }
  else if (e.key === 'Escape') { if (UI.win) closeWindow(); else ACT.desel(); }
  else if (e.key === '.') { UI.speed = Math.min(5, UI.speed + 1); updateHud(); }
  else if (e.key === ',') { UI.speed = Math.max(1, UI.speed - 1); updateHud(); }
});

/* ---------- avisos ---------- */
function toast(icon, text, state) {
  const el = document.createElement('div'); el.className = 'toast';
  el.innerHTML = `<span>${icon}</span><p>${text}</p>`;
  if (state !== undefined && state !== null) { el.classList.add('click'); el.addEventListener('click', () => { focusState(state, 55); el.remove(); }); }
  $('#toasts').appendChild(el);
  setTimeout(() => el.classList.add('in'), 10);
  setTimeout(() => { el.classList.remove('in'); setTimeout(() => el.remove(), 400); }, 9000);
  while ($("#toasts").children.length > 5) $('#toasts').firstChild.remove();
}
const NOTIF_ICON = {build: '🏗️', tech: '💡', law: '📜', journal: '🏆', war: '⚔️', colony: '⚓', event: '📰'};
function drainNotifs() {
  while (G.notifs.length) {
    const n = G.notifs.shift();
    const relevant = ['build', 'tech', 'law', 'journal', 'colony', 'event'].includes(n.type) || n.type === 'war';
    if (relevant) toast(NOTIF_ICON[n.type] || '•', n.text, n.state);
  }
}

/* ---------- evento emergente ---------- */
function showEvent() {
  const e = G.pendingEvent; if (!e) return;
  const ev = EVENTS.find(x => x.id === e.id); const c = me();
  G.paused = true; updateHud();
  const el = $('#event'); el.classList.add('open');
  el.innerHTML = `<div class="evbox"><div class="evhead"><h2>${e.title}</h2><small>${dateStr()}</small></div><div class="evbody"><p>${e.text}</p>${ev.opts.map((o, i) => `<button class="evopt" data-act="evt" data-i="${i}">${o.t}${o.cost ? ` <small>(−${money(c.stats.income * o.cost)})</small>` : ''}</button>`).join('')}</div></div>`;
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
      <div class="st-list" id="st-list">${picks.map(t => { const c = G.C[t]; const d = difficulty(t); return `<div class="st-card" data-act="pickc" data-tag="${t}">${flag(t, 'md')}<div><b>${c.name}</b><small>${c.gov}</small></div><span class="diff ${d[1]}">${d[0]}</span></div>`; }).join('')}</div>
    </div>
    <div class="st-right" id="st-info"></div>
  </div>`;
  selectStartCountry('GBR');
}
function selectStartCountry(tag) {
  UI.startTag = tag;
  const c = G.C[tag]; const d = difficulty(tag);
  $$('#st-list .st-card').forEach(e => e.classList.toggle('on', e.dataset.tag === tag));
  $('#st-info').innerHTML = `<div class="st-crest">${flag(tag, 'huge')}</div><h2>${c.name}</h2><div class="st-gov">${c.gov} · Rango ${c.rank} · <span class="${d[1]}">${d[0]}</span></div>
   <p class="st-intro">${INTRO[tag] || `Gobierna ${c.name} en el año 1836 y llévala hacia la era industrial.`}</p>
   <div class="st-stats"><div><small>Población</small><b>${fmtN(c.stats.pop, 1)}</b></div><div><small>Alfabetización</small><b>${Math.round(c.lit)}%</b></div><div><small>Estados</small><b>${c.states.length}</b></div><div><small>Ejército</small><b>${fmtN(c.stats.soldiers, 0)}</b></div></div>
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
  UI.started = true; G.paused = true;
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
    if (n) R.labelsDirty = R.labelsDirty || false;
  }
  if (G.pendingEvent && !$('#event').classList.contains('open')) showEvent();
  if (R.needPaint) { R.needPaint = false; fullRepaint(); }
  if (G.notifs.length) drainNotifs();
  if (t - UI.lastHud > 250) { UI.lastHud = t; updateHud(); if (UI.sel !== null && UI.sel >= 0 && t - UI.lastWin > 1500) renderStatePanel(); }
  if (UI.win && t - UI.lastWin > 1500 && !G.paused) { UI.lastWin = t; renderWindow(); }
  if (R.minimapDirty) R.dirty = true;
};
