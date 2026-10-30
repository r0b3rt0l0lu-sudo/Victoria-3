/* ===== DOCTRINAS MILITARES =====
   Experiencia: terrestre (c.mxp, se gana combatiendo y entrenando), naval y aérea (c.m2.xp). Con ella se compran escalones de un
   árbol de doctrinas con ramas excluyentes. docMod(tag, clave) devuelve la suma de bonificaciones de las doctrinas adoptadas. */
const DOCTRINES = {
  land: {
    name: 'Doctrina terrestre', icon: '🪖', xp: 'land', branches: {
      depth: {name: 'Defensa en profundidad', icon: '🛡️', desc: 'Líneas escalonadas y reservas: el defensor aguanta y desgasta al atacante.', tiers: [
        {name: 'Líneas escalonadas', xp: 30, from: 1836, fx: {def: .05, org: .04}},
        {name: 'Reservas móviles', xp: 70, from: 1860, fx: {def: .07, att: .02}},
        {name: 'Defensa elástica', xp: 120, from: 1890, fx: {def: .10, org: .08}}]},
      mobile: {name: 'Ofensiva móvil', icon: '🏇', desc: 'Maniobra, flanqueos y velocidad para romper el frente.', tiers: [
        {name: 'Columnas de maniobra', xp: 30, from: 1836, fx: {spd: .08, att: .03}},
        {name: 'Penetración profunda', xp: 70, from: 1860, fx: {att: .06, spd: .10}},
        {name: 'Guerra de movimiento', xp: 120, from: 1890, fx: {att: .08, spd: .15, org: .04}}]},
      fire: {name: 'Fuego superior', icon: '💥', desc: 'Potencia de fuego de fusiles y artillería por encima de todo.', tiers: [
        {name: 'Fuego de salvas', xp: 30, from: 1836, fx: {att: .05}},
        {name: 'Concentración artillera', xp: 70, from: 1860, fx: {att: .07, def: .02}},
        {name: 'Barrera rodante', xp: 120, from: 1890, fx: {att: .10, def: .03}}]},
      mass: {name: 'Movilización de masas', icon: '👥', desc: 'Grandes ejércitos de reservistas, baratos y numerosos.', tiers: [
        {name: 'Reservas nacionales', xp: 30, from: 1836, fx: {org: .03, cost: -.06}},
        {name: 'Levas masivas', xp: 70, from: 1860, fx: {def: .03, att: .02, cost: -.08}},
        {name: 'Nación en armas', xp: 120, from: 1890, fx: {att: .04, def: .04, org: .05, cost: -.10}}]}
    }},
  air: {
    name: 'Doctrina aérea', icon: '✈️', xp: 'air', branches: {
      supremacy: {name: 'Superioridad aérea', icon: '🛩️', desc: 'Cazas y control del cielo: mayor bonificación por dominar la región.', tiers: [
        {name: 'Patrullas de caza', xp: 20, from: 1905, fx: {air: .06, intc: .08}},
        {name: 'Escuadras de combate', xp: 45, from: 1912, fx: {air: .10, intc: .12}},
        {name: 'Dominio del aire', xp: 80, from: 1920, fx: {air: .14, intc: .16}}]},
      strategic: {name: 'Bombardeo estratégico', icon: '💣', desc: 'Bombarderos contra la industria del enemigo.', tiers: [
        {name: 'Bombardeo de objetivos', xp: 20, from: 1905, fx: {bomb: .15}},
        {name: 'Campaña estratégica', xp: 45, from: 1912, fx: {bomb: .25, cas: .05}},
        {name: 'Destrucción industrial', xp: 80, from: 1920, fx: {bomb: .35, cas: .08}}]}
    }},
  navy: {
    name: 'Doctrina naval', icon: '⚓', xp: 'navy', branches: {
      battle: {name: 'Flota de batalla', icon: '🚢', desc: 'Grandes acorazados que buscan la batalla decisiva.', tiers: [
        {name: 'Línea de combate', xp: 25, from: 1836, fx: {nav: .06}},
        {name: 'Escuadras de acorazados', xp: 60, from: 1870, fx: {nav: .10, navdef: .05}},
        {name: 'Dominio del mar', xp: 100, from: 1900, fx: {nav: .14, navdef: .08}}]},
      raid: {name: 'Guerra de corso', icon: '🏴‍☠️', desc: 'Cruceros y submarinos contra el comercio enemigo.', tiers: [
        {name: 'Corsarios', xp: 25, from: 1836, fx: {raid: .15}},
        {name: 'Cruceros comerciales', xp: 60, from: 1870, fx: {raid: .25, nav: .03}},
        {name: 'Guerra submarina', xp: 100, from: 1900, fx: {raid: .40, nav: .04}}]}
    }}
};
const XP_KEYS = {land: c => c.mxp || 0, navy: c => mc(c).xp.navy, air: c => mc(c).xp.air};
const xpOf = (c, cat) => XP_KEYS[cat](c);
function xpSpend(c, cat, n) { if (cat === 'land') c.mxp = (c.mxp || 0) - n; else mc(c).xp[cat] -= n; }
function xpGain(tag, cat, n) { const c = G.C[tag]; if (!c || tag === NONE) return; if (cat === 'land') c.mxp = (c.mxp || 0) + n; else mc(c).xp[cat] += n; }

// bonificaciones de las doctrinas adoptadas (atk es un alias de att)
function docMod(tag, key) {
  const c = G.C[tag]; if (!c || !c.m2) return 0;
  const d = c.m2.doc; if (!d) return 0; if (key === 'atk') key = 'att';
  let v = 0;
  for (const cat in DOCTRINES) { const br = d[cat], n = d.tier[cat] || 0; if (!br) continue; const B = DOCTRINES[cat].branches[br]; if (!B) continue; for (let i = 0; i < n; i++) v += B.tiers[i].fx[key] || 0; }
  return v;
}
function docNext(c, cat) {
  const d = mc(c).doc, br = d[cat]; if (!br) return null;
  const n = d.tier[cat] || 0, t = DOCTRINES[cat].branches[br].tiers[n]; return t || null;
}
function docCanBuy(c, cat, branch) {
  const d = mc(c).doc, def = DOCTRINES[cat];
  if (cat === 'air' && !hasTech(c, 'military_aviation')) return 'Necesitas la tecnología Aviación Militar.';
  if (d[cat] && d[cat] !== branch) return 'Ya has elegido otra rama: las ramas son excluyentes.';
  const t = d[cat] ? docNext(c, cat) : def.branches[branch].tiers[0];
  if (!t) return 'Rama completada.';
  if (yearNow() < t.from) return `Disponible desde ${t.from}.`;
  if (xpOf(c, def.xp) < t.xp) return `Faltan puntos de experiencia (${Math.floor(xpOf(c, def.xp))}/${t.xp}).`;
  return null;
}
function docBuy(c, cat, branch) {
  const err = docCanBuy(c, cat, branch); if (err) return {ok: false, msg: err};
  const d = mc(c).doc, def = DOCTRINES[cat], t = d[cat] ? docNext(c, cat) : def.branches[branch].tiers[0];
  xpSpend(c, def.xp, t.xp); d[cat] = branch; d.tier[cat] = (d.tier[cat] || 0) + 1;
  return {ok: true, msg: `Doctrina adoptada: ${t.name} (${def.branches[branch].name}).`};
}
// el entrenamiento y las batallas dan experiencia (ganchos ligeros)
function docDay() {
  G.armies.forEach(a => { if (a.mode === 'train' && !a.path.length && !a.battle && a.tag !== NONE) xpGain(a.tag, 'land', 0.035 * Math.min(6, a.divs.length)); });
}
// la IA elige rama según su carácter y gasta su experiencia
function docAI(c) {
  const m = mc(c), d = m.doc;
  ['land', 'air', 'navy'].forEach(cat => {
    if (cat === 'air' && !hasTech(c, 'military_aviation')) return;
    if (!d[cat]) {
      const keys = Object.keys(DOCTRINES[cat].branches); let pick2;
      if (cat === 'land') pick2 = c.rank <= 6 ? 'fire' : c.stats.pop > 2e7 ? 'mass' : (c.monarchy ? 'depth' : 'mobile');
      else if (cat === 'air') pick2 = c.ind > 0.5 ? 'strategic' : 'supremacy';
      else pick2 = c.rank <= 3 ? 'battle' : 'raid';
      if (!keys.includes(pick2)) pick2 = keys[0];
      d[cat] = pick2; d.tier[cat] = 0;
    }
    const br = d[cat], t = DOCTRINES[cat].branches[br].tiers[d.tier[cat] || 0];
    if (t && yearNow() >= t.from && xpOf(c, DOCTRINES[cat].xp) >= t.xp) { xpSpend(c, DOCTRINES[cat].xp, t.xp); d.tier[cat] = (d.tier[cat] || 0) + 1; }
  });
}
function docWeek() {
  G.tags.forEach(t => { if (t === NONE) return; const c = G.C[t]; if (!c.states.length) return;
    // la paz y el tamaño del ejército también dan algo de práctica
    const n = countDivs(t); if (n) xpGain(t, 'land', Math.min(0.5, n * 0.004));
    if (c.ai) docAI(c); });
}

/* ---------- interfaz ---------- */
function doctrinesHtml() {
  const c = me(), m = mc(c), d = m.doc;
  const cat = key => { const def = DOCTRINES[key], sel = d[key], n = d.tier[key] || 0;
    return `<div class="card"><h3>${def.icon} ${def.name} <small class="dim">· experiencia ${Math.floor(xpOf(c, def.xp))}</small></h3>
    ${Object.keys(def.branches).map(bk => { const B = def.branches[bk], chosen = sel === bk, locked = sel && !chosen; const err = docCanBuy(c, key, bk);
      return `<div class="block ${chosen ? 'on' : ''}" style="${locked ? 'opacity:.45' : ''}"><b>${B.icon} ${B.name}</b> ${chosen ? `<span class="tag">${n}/${B.tiers.length}</span>` : ''}<small class="dim">${B.desc}</small>
      ${B.tiers.map((t, i) => `<div class="kv sm"><span>${i < n && chosen ? '✔' : '▫'} ${t.name} <small class="dim">· ${Object.keys(t.fx).map(k => ({att: 'ataque', def: 'defensa', org: 'organización', spd: 'velocidad', cost: 'coste', air: 'dominio aéreo', intc: 'intercepción', bomb: 'bombardeo', cas: 'apoyo cercano', nav: 'combate naval', navdef: 'defensa naval', raid: 'guerra de corso'})[k] + ' ' + sgn(t.fx[k] * 100, 0) + '%').join(', ')}</small></span><b class="dim">${t.xp} xp · ${t.from}</b></div>`).join('')}
      ${locked ? '' : `<div class="btnrow"><button data-act="docbuy" data-c="${key}" data-b="${bk}" ${err ? 'disabled' : ''} ${err ? `data-tip="${escA(err)}"` : ''}>${chosen ? 'Siguiente escalón' : 'Adoptar esta rama'}</button></div>`}</div>`; }).join('')}</div>`; };
  return `<div class="cols"><div class="col wide">${cat('land')}</div><div class="col">${cat('air')}${cat('navy')}
    <div class="card"><h3>Experiencia militar</h3><div class="kv"><span>🪖 Ejército (combates y entrenamiento)</span><b>${Math.floor(xpOf(c, 'land'))}</b></div><div class="kv"><span>⚓ Marina (batallas y misiones)</span><b>${Math.floor(xpOf(c, 'navy'))}</b></div><div class="kv"><span>✈️ Aviación (combates y misiones)</span><b>${Math.floor(xpOf(c, 'air'))}</b></div>
    <p class="hint">Cada rama es excluyente: elegir una cierra las demás de su categoría. Los escalones se compran con experiencia y están disponibles desde el año indicado.</p></div></div></div>`;
}
MX_TABS.push({id: 'doctrines', label: '🎖️ Doctrinas', html: doctrinesHtml});
Object.assign(ACT, {docbuy: d => { const r = docBuy(me(), d.c, d.b); toast(r.ok ? '🎖️' : '⚠️', r.msg); renderWindow(); }});
