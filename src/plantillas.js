/* ===== PLANTILLAS DE DIVISIÓN =====
   Una plantilla combina hasta 9 batallones. Cada plantilla registra un tipo en DIVS (clave «T<TAG>_<n>») con sus estadísticas
   calculadas, de modo que todo el código de combate existente sigue funcionando con DIVS[d.t]. */
const TPL_SLOTS = 9;
const BATTALIONS = {
  inf: {name: 'Infantería de línea', icon: '🪖', att: .67, def: 1.0, org: 4.4, spd: 1.0, cost: 22, width: 1, kind: 'inf', needs: {rifles: 1333, gunpowder: 90}},
  cav: {name: 'Caballería', icon: '🐎', att: .78, def: .55, org: 4.0, spd: 1.6, cost: 36, width: 1, kind: 'cav', needs: {rifles: 555, horses: 1000, gunpowder: 66}},
  art: {name: 'Artillería', icon: '💣', att: 1.22, def: .45, org: 3.1, spd: .8, cost: 47, width: 1, kind: 'art', needs: {cannons: 167, rifles: 390, horses: 333, gunpowder: 444}},
  eng: {name: 'Ingenieros', icon: '⛏️', att: .3, def: .8, org: 4.5, spd: .9, cost: 28, width: 1, kind: 'inf', needs: {rifles: 700, gunpowder: 50}, fort: .015, sup: .01},
  mg: {name: 'Ametralladoras', icon: '🔫', att: 1.0, def: 1.9, org: 3.5, spd: .9, cost: 40, width: 1, kind: 'inf', tech: 'machine_guns', needs: {mgs: 120, rifles: 400, gunpowder: 120}},
  mot: {name: 'Infantería motorizada', icon: '🚚', att: .9, def: 1.1, org: 4.5, spd: 1.5, cost: 50, width: 1, kind: 'inf', tech: 'motorization', needs: {rifles: 1200, gunpowder: 90}},
  arm: {name: 'Blindados', icon: '🛡️', att: 2.4, def: 1.6, org: 3.0, spd: 1.4, cost: 110, width: 1, kind: 'art', tech: 'armor', needs: {cannons: 60, rifles: 300, gunpowder: 150}}
};
const BN_ORDER = ['inf', 'cav', 'art', 'eng', 'mg', 'mot', 'arm'];
const bnAvail = (c, k) => !BATTALIONS[k].tech || hasTech(c, BATTALIONS[k].tech);

// estadísticas de una plantilla (lista de batallones)
function tplStats(bns) {
  const n = bns.length || 1, st = {att: 0, def: 0, org: 0, cost: 0, spd: 9, needs: {}, fort: 0, sup: 0, cnt: {}};
  bns.forEach(k => { const b = BATTALIONS[k]; st.att += b.att; st.def += b.def; st.org += b.org; st.cost += b.cost; st.spd = Math.min(st.spd, b.spd); st.fort += b.fort || 0; st.sup += b.sup || 0; st.cnt[k] = (st.cnt[k] || 0) + 1; for (const g in b.needs) st.needs[g] = (st.needs[g] || 0) + b.needs[g]; });
  if (!bns.length) st.spd = 1;
  // la velocidad la marca el batallón más lento, aunque los motorizados compensan parcialmente
  const avgSpd = bns.reduce((s, k) => s + BATTALIONS[k].spd, 0) / n; st.spd = +(st.spd * 0.6 + avgSpd * 0.4).toFixed(2);
  st.width = +(bns.length / TPL_SLOTS).toFixed(2);
  // tipo principal para animaciones y bonificaciones de arma
  let best = 'inf', bv = -1; for (const k in st.cnt) { const kd = BATTALIONS[k].kind; const v = st.cnt[k] * (kd === 'inf' ? 0.8 : 1); if (v > bv) { bv = v; best = kd; } }
  st.kind = best;
  return st;
}
function tplKey(tag, id) { return 'T' + tag + '_' + id; }
// registra (o actualiza) el tipo de división asociado a una plantilla
function tplRegister(c, t) {
  const st = tplStats(t.bns), key = tplKey(c.tag, t.id); t.key = key;
  DIVS[key] = {name: t.name, icon: BATTALIONS[t.bns[0]] ? (st.kind === 'cav' ? '🐎' : st.kind === 'art' ? '💣' : '🪖') : '🪖', att: +st.att.toFixed(2), def: +st.def.toFixed(2), spd: st.spd, org: Math.round(st.org), cost: Math.round(st.cost), days: Math.round(12 + st.cost * 0.06), desc: t.bns.length + ' batallones', kind: st.kind, width: st.width, tpl: true, fort: st.fort, sup: st.sup};
  DIV_NEEDS[key] = st.needs;
  return DIVS[key];
}
function tplRegisterAll() { G.tags.forEach(tag => { if (tag === NONE) return; const c = G.C[tag]; if (c.m2 && c.m2.tpl) c.m2.tpl.forEach(t => tplRegister(c, t)); }); }
function tplCreate(c, name, bns) {
  const m = mc(c); const t = {id: m.tplN++, name: name || 'Plantilla ' + (m.tplN - 1), bns: bns.slice(0, TPL_SLOTS)}; m.tpl.push(t); tplRegister(c, t); return t;
}
function tplDelete(c, id) {
  const m = mc(c), t = m.tpl.find(x => x.id === id); if (!t) return;
  if (G.armies.some(a => a.tag === c.tag && a.divs.some(d => d.t === t.key)) || G.recruits.some(r => r.tag === c.tag && r.type === t.key)) return false;
  m.tpl = m.tpl.filter(x => x !== t); delete DIVS[t.key]; delete DIV_NEEDS[t.key]; return true;
}
function tplSetBn(c, id, k, delta) {
  const t = mc(c).tpl.find(x => x.id === id); if (!t) return;
  const cnt = t.bns.filter(b => b === k).length;
  if (delta > 0 && t.bns.length < TPL_SLOTS && bnAvail(c, k)) { t.bns.push(k); }
  else if (delta < 0 && cnt > 0 && t.bns.length > 1) { t.bns.splice(t.bns.lastIndexOf(k), 1); }
  t.bns.sort((a, b) => BN_ORDER.indexOf(a) - BN_ORDER.indexOf(b));
  tplRegister(c, t);
}
// tipos de división que un país puede reclutar: los clásicos y sus plantillas
function divTypesOf(c) { return ['inf', 'cav', 'art'].concat(mc(c).tpl.map(t => t.key)); }
const dKind = d => (DIVS[d.t] && DIVS[d.t].kind) || d.t;

/* ---------- plantillas de la IA ---------- */
function aiTemplates(c) {
  const m = mc(c), want = [];
  want.push(['Infantería con artillería', ['inf', 'inf', 'inf', 'inf', 'inf', 'inf', 'inf', 'art', 'art'], 0]);
  want.push(['Infantería con ingenieros', ['inf', 'inf', 'inf', 'inf', 'inf', 'inf', 'eng', 'art', 'art'], 0]);
  if (hasTech(c, 'machine_guns')) want.push(['Infantería con ametralladoras', ['inf', 'inf', 'inf', 'inf', 'inf', 'mg', 'mg', 'art', 'eng'], 1]);
  if (hasTech(c, 'motorization')) want.push(['Infantería motorizada', ['mot', 'mot', 'mot', 'mot', 'mot', 'mot', 'mg', 'art', 'eng'], 2]);
  if (hasTech(c, 'armor')) want.push(['División blindada', ['arm', 'arm', 'arm', 'arm', 'arm', 'mot', 'mot', 'mot', 'art'], 3]);
  want.forEach(([name, bns, tier]) => { const ex = m.tpl.find(t => t.ai === tier); if (!ex) { const t = tplCreate(c, name, bns); t.ai = tier; } else if (ex.bns.join() !== bns.join()) { ex.bns = bns.slice(); ex.name = name; tplRegister(c, ex); } });
  // las plantillas de la IA con generaciones antiguas se sustituyen por las nuevas: los tipos ya reclutados siguen existiendo
}
// plantilla que reclutará la IA según su tecnología y prioridades
function aiPickType(c) {
  const m = mc(c); if (!m.tpl.length) aiTemplates(c);
  const r = Math.random(), pools = m.tpl.filter(t => t.ai !== undefined);
  const best = pools.slice().sort((a, b) => b.ai - a.ai);
  if (r < 0.12) return 'cav'; if (r < 0.2 && !hasTech(c, 'motorization')) return 'art';
  const modern = best[0], base = pools.filter(t => t.ai <= 1);
  if (modern && modern.ai >= 2 && Math.random() < 0.55) return modern.key;
  const t = base.length ? pick(base) : best[0]; return t ? t.key : 'inf';
}
function aiTemplatesWeek() { G.tags.forEach(t => { if (t === NONE) return; const c = G.C[t]; if (c.ai && c.states.length && (G.week + c.id) % 26 === 0) aiTemplates(c); }); }

/* ---------- interfaz ---------- */
function templatesHtml() {
  const c = me(), m = mc(c);
  const tcard = t => { const st = tplStats(t.bns), used = G.armies.some(a => a.tag === c.tag && a.divs.some(d => d.t === t.key));
    return `<div class="card"><h3>${st.kind === 'cav' ? '🐎' : st.kind === 'art' ? '💣' : '🪖'} ${t.name} <small class="dim">${t.bns.length}/${TPL_SLOTS} batallones</small></h3>
    <div class="kv sm"><span>Ataque · Defensa</span><b>${f1(st.att)} · ${f1(st.def)}</b></div><div class="kv sm"><span>Organización · Velocidad</span><b>${Math.round(st.org)} · ×${st.spd.toFixed(2)}</b></div>
    <div class="kv sm"><span>Anchura de combate</span><b>${st.width.toFixed(2)}</b></div><div class="kv sm"><span>Coste · instrucción</span><b>${money(Math.round(st.cost * moneyPerPoint(c)))} · ${Math.round(12 + st.cost * 0.06)} d</b></div>
    <div class="kv sm"><span>Equipo</span><b>${Object.keys(st.needs).map(g => (GOOD[g] ? GOOD[g].icon : '') + fmtN(st.needs[g], 0)).join(' ')}</b></div>
    <div class="tplbn">${BN_ORDER.map(k => { const B = BATTALIONS[k], n = st.cnt[k] || 0, ok = bnAvail(c, k); return `<div class="kv sm" style="${ok ? '' : 'opacity:.4'}"><span>${B.icon} ${B.name}${ok ? '' : ` <small class="dim">(tecnología: ${TECH[B.tech].name})</small>`}</span><span><button data-act="tplbn" data-id="${t.id}" data-k="${k}" data-d="-1" ${n ? '' : 'disabled'}>−</button> <b>${n}</b> <button data-act="tplbn" data-id="${t.id}" data-k="${k}" data-d="1" ${ok && t.bns.length < TPL_SLOTS ? '' : 'disabled'}>＋</button></span></div>`; }).join('')}</div>
    <div class="btnrow"><button data-act="tplren" data-id="${t.id}">✏️ Renombrar</button><button data-act="tpldup" data-id="${t.id}">⧉ Duplicar</button><button data-act="tpldel" data-id="${t.id}" ${used ? 'disabled data-tip="Hay divisiones o reclutas con esta plantilla"' : ''}>🗑 Borrar</button></div></div>`; };
  const base = ['inf', 'cav', 'art'].map(k => { const D = DIVS[k]; return `<div class="kv sm"><span>${D.icon} <b>${D.name}</b> <small class="dim">(predefinida)</small></span><b>${D.att} / ${D.def} · org ${D.org} · ×${D.spd}</b></div>`; }).join('');
  return `<div class="cols"><div class="col"><div class="card"><h3>Plantillas de división</h3><p class="hint">Diseña tus divisiones combinando hasta ${TPL_SLOTS} batallones. Cada plantilla calcula su ataque, defensa, organización, anchura de combate (las divisiones estrechas dejan combatir a más a la vez), velocidad y equipo necesario. Después se reclutan desde la pestaña <b>Reclutamiento</b>. Los ingenieros acelera la fortificación; las ametralladoras, los motorizados y los blindados exigen tecnología.</p>${base}
      <div class="btnrow"><button data-act="tplnew">＋ Nueva plantilla</button></div></div></div><div class="col wide">${m.tpl.length ? m.tpl.map(tcard).join('') : '<div class="card"><p class="hint">Aún no has creado plantillas. Pulsa «Nueva plantilla».</p></div>'}</div></div>`;
}
MX_TABS.push({id: 'templates', label: '📐 Plantillas', html: templatesHtml});
Object.assign(ACT, {
  tplnew: () => { const c = me(); tplCreate(c, '', ['inf', 'inf', 'inf', 'inf', 'inf', 'inf', 'eng', 'art', 'art']); renderWindow(); },
  tplbn: d => { tplSetBn(me(), +d.id, d.k, +d.d); renderWindow(); },
  tplren: d => { const t = mc(me()).tpl.find(x => x.id === +d.id); if (!t) return; const n = prompt('Nombre de la plantilla', t.name); if (n) { t.name = n.slice(0, 30); tplRegister(me(), t); renderWindow(); } },
  tpldup: d => { const c = me(), t = mc(c).tpl.find(x => x.id === +d.id); if (t) { tplCreate(c, t.name + ' (copia)', t.bns); renderWindow(); } },
  tpldel: d => { if (tplDelete(me(), +d.id) === false) toast('⚠️', 'Hay divisiones con esa plantilla.'); renderWindow(); }
});
