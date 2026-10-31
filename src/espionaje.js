/* ===== ESPIONAJE OFENSIVO =====
   Con agentes en un país puedes lanzar operaciones encubiertas (necesitan unos días y dinero):
   · Sabotaje industrial: destruye parte de la industria de su estado más industrial y reduce su producción durante meses.
   · Financiar rebeldes: más radicales, menos legitimidad y más riesgo de guerra civil (si estalla, los rebeldes te deben el favor).
   · Robar tecnología: te llevas una tecnología que él tiene y tú no.
   La contrainteligencia protege tu país. La IA también espía (si la regla «Espionaje enemigo» está activa). */
const SPY_OPS = {
  sabotage: {name: 'Sabotaje industrial', icon: '🔥', cost: 0.30, days: 25, hostile: true, desc: 'Destruye parte de la industria de su estado más industrial (−12%) y reduce su producción 3 meses.'},
  rebels: {name: 'Financiar rebeldes', icon: '🎭', cost: 0.40, days: 30, hostile: true, desc: 'Más radicales, −4 legitimidad y más riesgo de guerra civil en el país objetivo.'},
  tech: {name: 'Robar tecnología', icon: '📚', cost: 0.50, days: 40, hostile: false, desc: 'Obtienes una tecnología que el objetivo tiene y tú no.'}
};
const SPY_COUNTER_DAYS = 365;
const spyCost = (c, k) => Math.round(Math.max(1, c.stats.income) * SPY_OPS[k].cost);
const counterBonus = t => { const c = G.C[t]; return c ? ((c.counterUntil || 0) > G.date.t ? 0.2 : 0) + 0.02 * intelOf(c).lvl : 0; };
// probabilidad de éxito de una operación de `from` sobre `to` (con `agents` agentes sobre el terreno)
function spyChance(from, to, agents) {
  const I = intelOf(G.C[from]);
  return clamp(0.30 + 0.10 * I.lvl + 0.12 * Math.max(0, (agents || 1) - 1) + 0.2 * intelNet(from, to) - 0.09 * intelOf(G.C[to]).lvl - counterBonus(to), 0.08, 0.9);
}
function spyTechPick(c, T) { const l = TECHS.filter(t => T.techs.has(t.id) && !c.techs.has(t.id) && techAvailable(c, t)); return l.length ? pick(l) : null; }
// aplica el efecto de una operación que ha tenido éxito; devuelve el texto
function spyApply(kind, from, to) {
  const F = G.C[from], T = G.C[to];
  if (kind === 'sabotage') {
    const ind = s => BUILDINGS.reduce((n, b) => n + ((b.grp === 'Industria' || b.grp === 'Industria militar') ? (s.b[b.id] || 0) : 0), 0);
    const sid = T.states.slice().sort((a, b) => ind(G.S[b]) - ind(G.S[a]))[0];
    if (sid === undefined) return null;
    const s = G.S[sid]; BUILDINGS.forEach(b => { if ((b.grp === 'Industria' || b.grp === 'Industria militar') && s.b[b.id] > 0) s.b[b.id] *= 0.88; });
    addTimedFx(T, 'Sabotaje', '🔥', {ind: 0.97}, 3, 'Atentados e incendios en las fábricas.'); T.legitimacy = Math.max(0, T.legitimacy - 1);
    return {txt: `sabotea la industria de ${s.name}`, txtP: `sabotean la industria de ${s.name}`, st: s.name};
  }
  if (kind === 'rebels') {
    T.radicals = Math.min(0.9, T.radicals + 0.05); T.legitimacy = Math.max(0, T.legitimacy - 4); T.lowLeg = (T.lowLeg || 0) + 2; T.cwSupport = (T.cwSupport || 0) + 1; T.cwSponsor = from;
    return {txt: 'financia a los rebeldes', txtP: 'financian a los rebeldes'};
  }
  if (kind === 'tech') {
    const t = spyTechPick(F, T); if (!t) return null;
    F.techs.add(t.id); if (F.research === t.id) F.research = null; recalcMods(F);
    return {txt: `roba la tecnología «${t.name}»`, txtP: `roban la tecnología «${t.name}»`};
  }
  return null;
}
// resuelve una operación: éxito/fracaso, detección y consecuencias diplomáticas
function spyResolve(from, to, kind, agents, instant) {
  const F = G.C[from], T = G.C[to], op = SPY_OPS[kind], p = spyChance(from, to, agents), I = intelOf(F);
  const mine = from === G.player, theirs = to === G.player;
  if (Math.random() < p) {
    const r = spyApply(kind, from, to);
    if (!r) { if (mine) notify('war', `🕵️ La operación «${op.name}» contra ${T.name} no encontró nada que hacer.`); return false; }
    const det = op.hostile && Math.random() < 0.25 + 0.08 * intelOf(T).lvl + counterBonus(to);
    if (det) { addRel(from, to, -30); F.infamy = (F.infamy || 0) + 3; }
    if (mine) notify('war', `🕵️ ¡Éxito! Tus agentes en ${T.name} ${r.txtP}.${det ? ' Pero han sido descubiertos: las relaciones se hunden.' : ''}`);
    if (theirs) notify('war', det ? `🕵️ Contrainteligencia: ${F.name} ${r.txt} en tu país. ¡Fue detectado!` : (kind === 'tech' ? '🕵️ Tus servicios sospechan que han robado un secreto tecnológico.' : `🕵️ Misterioso ${kind === 'sabotage' ? 'sabotaje' : 'brote de agitación'} en tu país${r.st ? ' (' + r.st + ')' : ''}. No se sabe quién lo ha organizado.`));
    return true;
  }
  if (!instant && I.ag[to]) { I.ag[to] = Math.max(0, I.ag[to] - 1); if (!I.ag[to]) delete I.ag[to]; }
  addRel(from, to, -15 - (op.hostile ? 10 : 0));
  if (mine) notify('war', `🕵️ La operación «${op.name}» contra ${T.name} fracasó: un agente fue capturado y las relaciones empeoran.`);
  if (theirs) notify('war', `🕵️ Tus servicios capturan a un agente de ${F.name} que preparaba «${op.name.toLowerCase()}».`);
  return false;
}

/* ---------- acciones del jugador ---------- */
function spyStart(c, to, kind) {
  const I = intelOf(c), op = SPY_OPS[kind]; if (!op) return {ok: false, msg: 'Operación desconocida.'};
  if (!(I.ag[to] > 0)) return {ok: false, msg: 'Necesitas al menos un agente en ese país.'};
  I.ops = I.ops || []; if (I.ops.some(o => o.t === to)) return {ok: false, msg: 'Ya hay una operación en curso allí.'};
  if (I.miss.some(m => m.t === to)) return {ok: false, msg: 'Tus agentes ya están ocupados robando tácticas.'};
  if (c.treasury < spyCost(c, kind)) return {ok: false, msg: `La operación cuesta ${money(spyCost(c, kind))} y no tienes fondos.`};
  c.treasury -= spyCost(c, kind); I.ops.push({t: to, k: kind, end: G.date.t + op.days, ag: I.ag[to]});
  return {ok: true, msg: `${op.icon} ${op.name} contra ${G.C[to].name} en marcha (${op.days} días, éxito ≈ ${Math.round(spyChance(c.tag, to, I.ag[to]) * 100)}%).`};
}
function spyCounter(c) {
  const cost = Math.round(Math.max(1, c.stats.income) * 0.6);
  if ((c.counterUntil || 0) > G.date.t) return {ok: false, msg: 'La contrainteligencia ya está activa.'};
  if (c.treasury < cost) return {ok: false, msg: `Cuesta ${money(cost)} y no tienes fondos.`};
  c.treasury -= cost; c.counterUntil = G.date.t + SPY_COUNTER_DAYS;
  return {ok: true, msg: '🛡️ Contrainteligencia reforzada durante un año: las operaciones enemigas fallan más y se detectan antes.'};
}
// llamado cada día para el jugador
function spyDay() {
  const c = G.C[G.player]; if (!c || !c.intel || !c.intel.ops || !c.intel.ops.length) return;
  c.intel.ops = c.intel.ops.filter(o => { if (G.date.t < o.end) return true; if (alive(o.t)) spyResolve(G.player, o.t, o.k, o.ag || 1, false); return false; });
}

/* ---------- IA y mantenimiento mensual ---------- */
function spyMonth() {
  G.tags.forEach(t => { if (t === NONE) return; const c = G.C[t]; if (c.cwSupport) c.cwSupport = Math.max(0, c.cwSupport * 0.9 - 0.02); if (c.cwSupport < 0.1) { c.cwSupport = 0; } });
  G.tags.forEach(t => {
    if (t === NONE) return; const c = G.C[t]; if (!c.ai || !c.states.length || c.rank > 30) return;
    const I = intelOf(c); if (I.lvl < 2 || Math.random() > 0.05 + 0.02 * (I.lvl - 2)) return;
    // objetivos: enemigos en guerra → sabotaje; rivales mal avenidos → rebeldes; potencias más avanzadas → robo de tecnología
    const rivals = G.tags.filter(x => x !== NONE && x !== t && alive(x) && !sameSide(t, x) && (x !== G.player || rule('spy')));
    const war = rivals.filter(x => hostileTags(t, x)), bad = rivals.filter(x => relOf(t, x) < -10 && G.C[x].states.length >= 6 && Math.abs(G.C[x].rank - c.rank) <= 12);
    const adv = rivals.filter(x => G.C[x].rank < c.rank && G.C[x].techs.size > c.techs.size && spyTechPick(c, G.C[x]));
    let kind = null, to = null;
    if (war.length) { kind = 'sabotage'; to = pick(war); }
    else if (adv.length && Math.random() < 0.5) { kind = 'tech'; to = pick(adv); }
    else if (bad.length && I.lvl >= 3) { kind = 'rebels'; to = pick(bad); }
    else if (adv.length) { kind = 'tech'; to = pick(adv); }
    if (kind && to) spyResolve(t, to, kind, 1, true);
  });
}

/* ---------- interfaz: tarjeta de operaciones (se inserta en la pestaña de inteligencia) ---------- */
function spyCardHtml(c, I) {
  const ops = I.ops || [], withAg = Object.keys(I.ag).filter(t => I.ag[t] > 0 && alive(t));
  const counter = (c.counterUntil || 0) > G.date.t;
  const rows = withAg.map(t => { const busy = ops.find(o => o.t === t), ms = I.miss.some(m => m.t === t);
    return `<tr><td>${flag(t, 'sm')} <b>${G.C[t].name}</b> <small class="dim">${I.ag[t]} ag.</small></td><td class="r">${busy ? `${SPY_OPS[busy.k].icon} ${SPY_OPS[busy.k].name} (${Math.max(0, busy.end - G.date.t)} d)` : Object.keys(SPY_OPS).map(k => `<button data-act="spyop" data-t="${t}" data-k="${k}" ${ms ? 'disabled' : ''} data-tip="<b>${SPY_OPS[k].name}</b><br>${SPY_OPS[k].desc}<br>Coste ${money(spyCost(c, k))} · éxito ≈ ${Math.round(spyChance(c.tag, t, I.ag[t]) * 100)}%">${SPY_OPS[k].icon}</button>`).join(' ')}</td></tr>`; }).join('');
  return `<div class="card"><h3>🕶️ Operaciones encubiertas</h3>
    <p class="hint">Con agentes en un país puedes lanzar <b>🔥 sabotaje</b>, <b>🎭 financiar rebeldes</b> (si estalla una guerra civil, los rebeldes te deberán el favor) o <b>📚 robar tecnología</b>. Fallar cuesta un agente y las relaciones; si te descubren, la infamia sube.</p>
    ${rows ? `<table class="tbl"><thead><tr><th>País</th><th class="r">Operación</th></tr></thead><tbody>${rows}</tbody></table>` : '<p class="hint">Envía agentes (＋) a un país para habilitar las operaciones.</p>'}
    <div class="kv"><span>🛡️ Contrainteligencia</span><b>${counter ? `activa (${Math.ceil(((c.counterUntil || 0) - G.date.t) / 30)} meses)` : `<button data-act="spycounter">Reforzar · ${money(Math.round(Math.max(1, c.stats.income) * 0.6))}</button>`}</b></div></div>`;
}
Object.assign(ACT, {
  spyop: d => { const r = spyStart(me(), d.t, d.k); toast(r.ok ? '🕶️' : '⚠️', r.msg); renderWindow(); },
  spycounter: () => { const r = spyCounter(me()); toast(r.ok ? '🛡️' : '⚠️', r.msg); renderWindow(); }
});
