/* ===== DIPLOMACIA 2: opinión estructural, rencor, honor de los tratados y llamadas a las armas realistas =====
   · OPINIÓN: las relaciones ya no son un número que solo se mueve por eventos: cada mes derivan hacia un objetivo que depende de la vecindad, las
     reclamaciones territoriales, los pactos, los bloques, los enemigos comunes, la ideología, el prestigio, la infamia y el RENCOR acumulado.
   · RENCOR: ser atacado, perder territorio o ver cómo un aliado entra en guerra contra ti deja memoria (se enfría con los años).
   · HONOR: cada país tiene una credibilidad (0-100). Cumplir las alianzas la sube; romperlas o no acudir a una defensa la baja y la gente deja de fiarse.
   · LLAMADAS A LAS ARMAS: un aliado acude casi siempre si te atacan, pero ante una guerra de agresión decide (fuerza, odds, honor, reclamaciones propias). */
const HON0 = 60;
const honorOf = c => (c && c.honor !== undefined ? c.honor : HON0);
function addHonor(tag, v) { const c = G.C[tag]; if (!c || tag === NONE) return; c.honor = clamp(honorOf(c) + v, 0, 100); }
const grudgeOf = (a, b) => (G.C[a] && G.C[a].grudge && G.C[a].grudge[b]) || 0;           // rencor de a hacia b
function addGrudge(a, b, v) { const c = G.C[a]; if (!c || a === NONE || a === b) return; c.grudge = c.grudge || {}; c.grudge[b] = clamp((c.grudge[b] || 0) + v, 0, 100); }
const claimsOn = (a, b) => G.C[a].claims.filter(cl => G.S[cl.state] && G.S[cl.state].owner === b).length;
/* ---------- opinión de equilibrio entre dos países ---------- */
function relFactors(a, b) {
  const A = G.C[a], B = G.C[b], f = [], add = (t, v) => { if (v) f.push([t, Math.round(v)]); };
  const allied = !!anyPactBetween(a, b, ['alliance']), sameBloc = A.bloc && A.bloc === B.bloc;
  if (!allied && !sameBloc && canReach(a, b)) add('Vecindad y fricción fronteriza', -6);
  const ca = claimsOn(a, b), cb = claimsOn(b, a); if (ca) add('Reclamaciones de ' + A.name + ' sobre su territorio', -Math.min(18, 8 + ca * 3)); if (cb) add('Reclamaciones de ' + B.name + ' sobre su territorio', -Math.min(14, 6 + cb * 2));
  if (allied) add('Alianza', 18); if (anyPactBetween(a, b, ['guarantee'])) add('Garantía de independencia', 8); if (anyPactBetween(a, b, ['nonagg'])) add('Pacto de no agresión', 4); if (anyPactBetween(a, b, ['trade'])) add('Tratado comercial', 8);
  if (G.pacts.some(p => p.type === 'subsidy' && ((p.a === a && p.b === b) || (p.a === b && p.b === a)))) add('Subsidios', 8);
  if (G.pacts.some(p => p.type === 'rival' && ((p.a === a && p.b === b) || (p.a === b && p.b === a)))) add('Rivalidad declarada', -30);
  if (G.pacts.some(p => p.type === 'embargo' && ((p.a === a && p.b === b) || (p.a === b && p.b === a)))) add('Embargo comercial', -25);
  if (sameBloc) add('Mismo bloque', 12);
  if (A.profile === B.profile) add('Regímenes afines', 5);
  const ce = G.wars.some(w => (w.attAll.includes(a) && w.attAll.includes(b)) || (w.defAll.includes(a) && w.defAll.includes(b))); if (ce) add('Enemigo común', 15);
  if (A.overlord === b || B.overlord === a) add('Vínculo de vasallaje', 6);
  const g1 = grudgeOf(a, b), g2 = grudgeOf(b, a); if (g1 > 1) add('Rencor de ' + A.name, -g1 * 0.6); if (g2 > 1) add('Rencor de ' + B.name, -g2 * 0.3);
  add('Prestigio de ' + B.name, clamp((B.prestige - 40) / 15, -2, 4)); if (B.infamy > 15) add('Infamia de ' + B.name, -B.infamy * 0.3);
  return f;
}
function relTarget(a, b) { return clamp(relFactors(a, b).reduce((n, x) => n + x[1], 0), -80, 80); }
const _declareWarD2 = declareWar;
declareWar = function (attTag, defTag, cbId, targets, opts) {
  const r = _declareWarD2(attTag, defTag, cbId, targets, opts);
  if (r && r.ok !== false && G.C[defTag]) {
    const w = G.wars[G.wars.length - 1]; const aggressive = cbId !== 'defense';
    if (aggressive) { addGrudge(defTag, attTag, 25); (w ? w.defAll : []).forEach(t => { if (t !== defTag) addGrudge(t, attTag, 8); }); (w ? w.attAll : []).forEach(t => { if (t !== attTag) addGrudge(defTag, t, 8); }); }
    if (aggressive && cbId !== 'claim') addHonor(attTag, -2);      // atacar sin justificación formal desgasta la credibilidad
    if (anyPactBetween(attTag, defTag, ['nonagg'])) addHonor(attTag, -15);
  }
  return r;
};
const _endWarD2 = endWar;
endWar = function (w, winner, preset) {
  const att = w.att, def = w.def, r = _endWarD2(w, winner, preset);
  if (winner && G.C[att] && G.C[def]) { const loser = winner === att ? def : att, lost = winner === att ? w.defAll : w.attAll, won = winner === att ? w.attAll : w.defAll; lost.forEach(t => won.forEach(x => addGrudge(t, x, t === loser && x === winner ? 22 : 6))); }
  return r;
};
function diplo2Monthly() {
  if (window.__NO_D2) return;
  const live = G.tags.filter(t => t !== NONE && alive(t) && G.C[t].rank <= 45);
  for (let i = 0; i < live.length; i++) for (let j = i + 1; j < live.length; j++) {
    const a = live[i], b = live[j]; if (atWarWith(a, b)) continue;
    const cur = relOf(a, b), tgt = relTarget(a, b), d = clamp((tgt - cur) * 0.07, -2.5, 2.5); if (Math.abs(d) >= 0.2) addRel(a, b, d);
  }
  G.tags.forEach(t => { const c = G.C[t]; if (!c || !c.grudge) return; for (const k in c.grudge) { c.grudge[k] *= 0.985; if (c.grudge[k] < 0.5) delete c.grudge[k]; } if (c.honor !== undefined && c.honor !== HON0) c.honor += (HON0 - c.honor) * 0.004; });       // el tiempo olvida y la fama vuelve a la media
}
const _monthlyTickD2 = monthlyTick;
monthlyTick = function (init) { _monthlyTickD2(init); if (!init) { try { diplo2Monthly(); } catch (e) { console.warn('diplo2', e); } } };
/* ---------- llamadas a las armas ---------- */
function joinWill(tag, lead, side, w, kind, base) {
  if (kind === 'subject' || window.__NO_D2) return base;
  const C = G.C[tag], L = G.C[lead], defensive = side === 'def' || w.cb === 'defense'; let p = base;
  if (!defensive) {
    p *= 0.55;                                                                                  // los tratados defensivos no obligan a apoyar una agresión
    const enemy = side === 'att' ? w.def : w.att; if (claimsOn(tag, enemy) || grudgeOf(tag, enemy) > 20) p += 0.25;            // pero si tienes cuentas pendientes con el enemigo, te sumas
    if (w.cb && w.cb !== 'claim' && L.infamy > 30) p -= 0.15;                                      // no se arriesga uno por un agresor desacreditado
  }
  p *= 0.65 + honorOf(C) / 170; p += relOf(lead, tag) / 400;
  const sideA = side === 'att' ? w.attAll : w.defAll, sideB = side === 'att' ? w.defAll : w.attAll, pa = sideA.reduce((n, t) => n + armyPower(G.C[t]), 0) + armyPower(C), pb = sideB.reduce((n, t) => n + armyPower(G.C[t]), 0);
  if (pb > pa * 2.5) p *= defensive && honorOf(C) > 70 ? 0.85 : 0.55;                                 // causa perdida: solo los de honor acuden
  if (C.wars.length >= 1) p *= 0.6;
  return clamp(p, 0.04, 0.97);
}
function honorKept(tag, lead, side, w, kind) { addHonor(tag, kind === 'bloc' ? 1 : 2); addRel(tag, lead, 4); }
function honorBroken(tag, lead, side, w, kind) {
  if (!(side === 'def' || w.cb === 'defense') || kind === 'bloc') return;                          // negarse a una agresión no es traición; negarse a defender, sí
  addHonor(tag, kind === 'guarantee' ? -12 : -10); addRel(tag, lead, -18); addGrudge(lead, tag, 12);
  if (lead === G.player || tag === G.player) notify('diplo', `${G.C[tag].name} no acude en ayuda de ${G.C[lead].name} pese a su ${kind === 'guarantee' ? 'garantía' : 'alianza'}: su palabra pierde valor.`);
  else logMsg(`${G.C[tag].name} abandona a ${G.C[lead].name} en su guerra defensiva.`);
}
/* ---------- aceptación de pactos con más criterio ---------- */
const _acceptChanceD2 = acceptChance;
acceptChance = function (type, from, to, level) {
  const r = _acceptChanceD2(type, from, to, level); if (window.__NO_D2 || !r.p || type === 'rival' || type === 'embargo' || !G.C[from] || !G.C[to]) return r;
  const F = G.C[from], T = G.C[to]; let d = 0; const why = (t, v) => { d += v; r.reasons.push(`${t}: ${sgn(v, 0)}`); };
  if (['alliance', 'guarantee', 'nonagg'].includes(type)) { const h = (honorOf(F) - HON0) * 0.25; if (Math.abs(h) >= 2) why('Credibilidad de tus tratados', h); }
  const gt = grudgeOf(to, from); if (gt > 5) why('Rencor hacia ti', -gt * 0.5);
  const cl = claimsOn(to, from); if (cl && type !== 'trade') why('Reclamaciones suyas sobre ti', -25);
  if (type === 'alliance') {
    const threat = G.tags.some(x => x !== from && x !== to && x !== NONE && alive(x) && G.C[x].rank <= 20 && relOf(from, x) < -15 && relOf(to, x) < -15);
    if (!threat && !G.wars.some(w => (w.attAll.includes(from) || w.defAll.includes(from)) && (w.attAll.includes(to) || w.defAll.includes(to)))) why('Sin amenaza común', -12);
  }
  r.p = clamp(r.p + d / 60, 0, 0.97); return r;
};
// explicación de la opinión para la interfaz
function relExplain(a, b) { const f = relFactors(a, b), t = relTarget(a, b); return `Tendencia: ${sgn(t, 0)} · ${f.map(x => `${x[0]} ${sgn(x[1], 0)}`).join(' · ') || 'sin factores'}`; }
