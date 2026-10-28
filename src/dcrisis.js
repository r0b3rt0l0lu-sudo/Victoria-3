/* ===== CRISIS DIPLOMÁTICAS: antes de la guerra hay unos meses de tensión en los que se suman apoyos y se puede ceder sin combatir ===== */
const DCRISIS_MONTHS = 3;
const crisisOf = tag => (G.dcrises || []).find(x => x.att === tag || x.def === tag || x.sides.att.includes(tag) || x.sides.def.includes(tag));
function openCrisis(attTag, defTag, cbId, targets, opts) {
  opts = opts || {}; G.dcrises = G.dcrises || []; G.nextDC = G.nextDC || 1;
  const A = G.C[attTag], D = G.C[defTag], cb = CBS[cbId || 'humiliate'];
  const block = warBlockers(attTag, defTag); if (block) return {ok: false, msg: block};
  if (crisisOf(attTag) || crisisOf(defTag)) return {ok: false, msg: 'Uno de los países ya está implicado en otra crisis diplomática.'};
  const av = cbAvailable(attTag, defTag, cbId); if (!av.ok && !opts.free) return {ok: false, msg: av.why};
  targets = (targets || []).slice();
  if (cb.terr) {
    const valid = new Set(reachableStates(attTag, defTag).map(x => x.id));
    targets = targets.filter(t => valid.has(t) && (cbId !== 'claim' || hasClaim(A, t)));
    if (!targets.length) return {ok: false, msg: 'Elige al menos un territorio válido.'};
    if (targets.length > cb.max(A)) targets = targets.slice(0, cb.max(A));
  }
  const cost = opts.free ? 0 : Math.round(warCost(attTag, targets, cbId) * 0.5);
  if (!A.ai && !opts.free) { if (A.influence < cost) return {ok: false, msg: `Necesitas ${cost} de influencia.`}; A.influence -= cost; }
  const k = {id: G.nextDC++, att: attTag, def: defTag, cb: cbId, targets, law: opts.law || null, left: DCRISIS_MONTHS, sides: {att: [attTag], def: [defTag]}, log: [], started: Object.assign({}, G.date), ai: !!opts.ai};
  G.dcrises.push(k);
  addRel(attTag, defTag, -40);
  const msg = `¡Crisis diplomática! ${A.name} exige a ${D.name}: ${cb.name}${targets.length ? ' (' + targets.map(t => G.S[t].name).join(', ') + ')' : ''}. Los demás países toman partido.`;
  if (attTag === G.player || defTag === G.player) notify('diplo', msg, targets[0] ?? D.capital); else logMsg(msg);
  return {ok: true, crisis: k};
}
function crisisPower(list) { let p = 0; list.forEach(t => { if (alive(t)) p += armyPower(G.C[t]); }); return p; }
function crisisJoin(k, tag, side, why) {
  if (!alive(tag) || k.sides.att.includes(tag) || k.sides.def.includes(tag)) return;
  k.sides[side].push(tag); k.log.push(`${G.C[tag].name} apoya a ${G.C[side === 'att' ? k.att : k.def].name}${why ? ' (' + why + ')' : ''}.`);
  if (tag === G.player) notify('diplo', `Tu país se alinea con ${G.C[side === 'att' ? k.att : k.def].name} en la crisis diplomática.`);
}
function dcrisisMonth() {
  if (!G.dcrises || !G.dcrises.length) return;
  G.dcrises.slice().forEach(k => {
    if (!alive(k.att) || !alive(k.def)) { G.dcrises = G.dcrises.filter(x => x !== k); return; }
    k.left--;
    // los aliados, garantes y miembros de bloque toman partido
    const callers = (lead, side) => {
      allies(lead).forEach(t => { if (Math.random() < 0.75 || !G.C[t].ai) crisisJoin(k, t, side, 'alianza'); });
      if (side === 'def') guaranteedBy(lead).forEach(t => { if (Math.random() < 0.8) crisisJoin(k, t, 'def', 'garantía'); });
      const b = blocOf(lead); if (b) b.members.forEach(t => { if (t !== lead && Math.random() < 0.55) crisisJoin(k, t, side, 'bloque'); });
      G.C[lead].subjects?.forEach(t => crisisJoin(k, t, side, 'vasallo'));
    };
    callers(k.att, 'att'); callers(k.def, 'def');
    const pa = crisisPower(k.sides.att), pd = crisisPower(k.sides.def) * 1.1, ratio = pa / Math.max(1, pd);
    k.ratio = ratio;
    const A = G.C[k.att], D = G.C[k.def];
    // decisiones de la IA
    if (D.ai && k.left >= 0) { const p = ratio > 3 ? 0.3 : ratio > 2 ? 0.12 : ratio > 1.4 ? 0.04 : 0; if (Math.random() < p) { resolveCrisis(k, 'def_back'); return; } }
    if (A.ai && ratio < 0.6 && Math.random() < 0.4) { resolveCrisis(k, 'att_back'); return; }
    if (k.left <= 0) resolveCrisis(k, 'war');
    else if (k.att === G.player || k.def === G.player) notify('diplo', `Crisis con ${G.C[k.att === G.player ? k.def : k.att].name}: quedan ${k.left} meses. Fuerzas ${fmtN(pa, 0)} contra ${fmtN(pd, 0)}.`);
  });
}
function resolveCrisis(k, how) {
  G.dcrises = (G.dcrises || []).filter(x => x !== k);
  const A = G.C[k.att], D = G.C[k.def];
  if (how === 'war') {
    const r = declareWar(k.att, k.def, k.cb, k.targets, {law: k.law, free: true});
    if (r.ok) { const w = r.war; k.sides.att.forEach(t => { if (alive(t) && !w.attAll.includes(t) && !w.defAll.includes(t)) { w.attAll.push(t); G.C[t].wars.push(w.id); } }); k.sides.def.forEach(t => { if (alive(t) && !w.attAll.includes(t) && !w.defAll.includes(t)) { w.defAll.push(t); G.C[t].wars.push(w.id); } }); recalcHostile(); }
    else logMsg(`La crisis entre ${A.name} y ${D.name} se enfría: ${r.msg}`);
  } else if (how === 'def_back') {
    // el defensor cede sin combatir: se aplican las exigencias
    const w = {id: -1, auto: true, att: k.att, def: k.def, cb: k.cb, targets: k.targets, cTargets: [], score: 100, weeks: 0, attAll: k.sides.att.slice(), defAll: k.sides.def.slice(), law: k.law, bw: {att: 0, def: 0}};
    notify('diplo', `${D.name} cede ante ${A.name} y acepta sus exigencias sin combatir.`, k.targets[0] ?? D.capital);
    endWar(w, k.att); D.prestige = Math.max(0, D.prestige - 4); cnt(A, 'crisesWon');
  } else if (how === 'att_back') {
    A.prestige = Math.max(0, A.prestige - 8); A.legitimacy -= 2; D.prestige += 4; addRel(k.att, k.def, 10); cnt(D, 'crisesWon');
    notify('diplo', `${A.name} se retira de la crisis con ${D.name}: pierde prestigio.`, D.capital);
  }
}
/* ---------- pestaña de la ventana de diplomacia ---------- */
function dcrisisTabHtml() {
  const list = G.dcrises || [];
  const sideH = t => t.map(x => `${flag(x, 'sm')} ${G.C[x].name}`).join(', ');
  return `<div class="card"><h3>Crisis diplomáticas</h3><p class="hint">Antes de una guerra puedes abrir una <b>crisis</b> (cuesta la mitad de influencia): durante ${DCRISIS_MONTHS} meses ambos bandos suman aliados. Si el defensor es mucho más débil puede <b>ceder</b> y aceptar tus exigencias sin guerra; si no, estalla la guerra con todos los apoyos ya alineados.</p>
  ${list.length ? list.map(k => { const mineA = k.att === G.player, mineD = k.def === G.player; const pa = crisisPower(k.sides.att), pd = crisisPower(k.sides.def);
    return `<div class="war"><div class="warh">${CBS[k.cb].icon} <b>${CBS[k.cb].name}</b> <small class="dim">· quedan ${k.left} meses</small></div>
    <div class="sides"><div><small>Agresor</small>${sideH(k.sides.att)}</div><div><small>Defensor</small>${sideH(k.sides.def)}</div></div>
    ${k.targets.length ? `<small class="dim">Exigencias: ${k.targets.map(t => G.S[t].name).join(', ')}</small>` : ''}
    <div class="wbar"><b style="width:${clamp(pa / Math.max(1, pa + pd), 0, 1) * 100}%"></b></div><div class="kv sm"><span>Fuerza militar</span><b>${fmtN(pa, 0)} vs ${fmtN(pd, 0)}</b></div>
    <div class="blog">${k.log.slice(-4).map(x => `<div class="ev">${x}</div>`).join('')}</div>
    ${mineA ? `<div class="btnrow"><button class="danger" data-act="dcwar" data-id="${k.id}">⚔️ Declarar la guerra ya</button><button data-act="dcback" data-id="${k.id}">🏳️ Retirarse (−8 prestigio)</button></div>` : ''}
    ${mineD ? `<div class="btnrow"><button data-act="dcyield" data-id="${k.id}">🏳️ Ceder ante las exigencias</button><span class="hint">Si te mantienes firme, la guerra estallará al acabar el plazo.</span></div>` : ''}</div>`; }).join('') : '<p class="hint">No hay crisis diplomáticas en curso.</p>'}</div>`;
}
