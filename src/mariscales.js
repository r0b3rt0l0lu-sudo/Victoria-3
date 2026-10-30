/* ===== MARISCALES Y PLANES DE BATALLA =====
   Un mariscal manda un grupo de ejércitos (o un frente completo) y aporta bonificaciones de planificación: cuanto mejor es, antes está
   listo el plan de batalla (línea de frente y flecha de ofensiva) y más ataque y defensa dan sus tropas. Preparar el plan durante días
   da hasta +15% de ataque (ya aplicado por el combate a través de a.plan). */
const MAR_NAMES = ['Radetzky', 'Moltke', 'Kutúzov', 'Wellington', 'Soult', 'Ney', 'Lee', 'Grant', 'Nogi', 'Cadorna', 'MacMahon', 'Bazaine', 'Haig', 'Hindenburg', 'Foch', 'Joffre', 'Brusílov', 'Conrad', 'Falkenhayn', 'Pétain', 'Schlieffen', 'Roon', 'Bismarck'];
const marMax = c => Math.max(1, Math.min(6, Math.ceil(countDivs(c.tag) / 14)));
const marOf = tag => mx().mar.filter(m => m.tag === tag);
function marCost(c) { return Math.round(moneyPerPoint(c) * 700); }
function marRecruit(c, free) {
  if (marOf(c.tag).length >= marMax(c)) return {ok: false, msg: `Solo puedes tener ${marMax(c)} mariscales con tu ejército actual.`};
  if (!free && c.treasury < marCost(c)) return {ok: false, msg: 'No tienes fondos.'};
  if (!free) c.treasury -= marCost(c);
  const m = {id: mx().nmar++, tag: c.tag, name: pick(MAR_NAMES), lvl: 1 + Math.floor(Math.random() * 3), xp: 0, group: []};
  mx().mar.push(m); return {ok: true, m, msg: `El mariscal ${m.name} (nivel ${m.lvl}) toma el mando.`};
}
function marOfArmy(a) {
  const M = mx(); if (!M.mar.length) return null;
  if (a.front) { const f = (G.fronts || []).find(x => x.id === a.front); if (f && f.mar) { const m = M.mar.find(x => x.id === f.mar && x.tag === a.tag); if (m) return m; } }
  return M.mar.find(m => m.tag === a.tag && m.group.includes(a.id)) || null;
}
const marBonus = a => { const m = marOfArmy(a); return m ? {att: 0.02 * m.lvl, def: 0.015 * m.lvl, plan: 0.14 * m.lvl} : {att: 0, def: 0, plan: 0}; };
function marDay() {
  const M = mx(); if (!M.mar.length) return;
  M.mar.forEach(m => { const arms = m.group.map(armyById).filter(Boolean); (G.fronts || []).forEach(f => { if (f.mar === m.id) f.armies.forEach(id => { const a = armyById(id); if (a && !arms.includes(a)) arms.push(a); }); });
    if (arms.some(a => a.battle)) { m.xp += 0.08; xpGain(m.tag, 'land', 0.01); }
    if (m.xp >= m.lvl * 30 && m.lvl < 5) { m.xp = 0; m.lvl++; if (m.tag === G.player) notify('war', `El mariscal ${m.name} asciende a nivel ${m.lvl}.`); } });
  M.mar.forEach(m => { m.group = m.group.filter(id => armyById(id)); });
  M.mar = M.mar.filter(m => G.C[m.tag] && G.C[m.tag].states.length);
}
function marAssignFront(m, f) { (G.fronts || []).forEach(x => { if (x.mar === m.id) x.mar = null; }); if (f) f.mar = m.id; }
// la IA nombra mariscales y reparte sus ejércitos por cercanía
function marAI(c) {
  const arms = armiesOf(c.tag).filter(a => !a.sea); if (arms.length < 4) return;
  const want = Math.min(marMax(c), Math.floor(arms.length / 4)); let mine = marOf(c.tag);
  while (mine.length < want) { const r = marRecruit(c, true); if (!r.ok) break; mine = marOf(c.tag); }
  if (!mine.length) return;
  mine.forEach(m => { m.group = m.group.filter(id => armyById(id)); });
  arms.forEach(a => { if (mine.some(m => m.group.includes(a.id))) return; let best = null, bd = 1e9; mine.forEach(m => { const lead = m.group.length ? armyById(m.group[0]) : null; const d = lead ? provDist(lead.loc, a.loc) : 0; const load = m.group.length * 4; if (d + load < bd) { bd = d + load; best = m; } }); if (best && best.group.length < 10) best.group.push(a.id); });
}
function marWeek() { G.tags.forEach(t => { if (t !== NONE && G.C[t].ai && G.C[t].states.length) marAI(G.C[t]); }); }

function marshalsHtml() {
  const c = me(), M = marOf(G.player), fr = frontsOf(G.player), sel = selectedArmies();
  const marRow = m => { const arms = m.group.map(armyById).filter(Boolean);
    return `<div class="card"><div class="kv"><b>🎖️ Mariscal ${m.name}</b><span>nivel ${m.lvl} · +${m.lvl * 2}% ataque · +${(m.lvl * 1.5).toFixed(1)}% defensa · plan ${m.lvl * 14}% más rápido</span></div>
    <div class="kv sm"><span>Grupo de ejércitos</span><b>${arms.length ? arms.map(a => a.name).join(', ') : '— ninguno —'}</b></div>
    <div class="btnrow"><button data-act="margroup" data-id="${m.id}" ${sel.length ? '' : 'disabled'} data-tip="Selecciona antes ejércitos en el mapa">＋ Añadir los ${sel.length} ejércitos seleccionados</button><button data-act="marclear" data-id="${m.id}">Vaciar grupo</button><button data-act="mardel" data-id="${m.id}">Retirar</button></div></div>`; };
  const frRow = f => { const prep = Math.min(30, f.prep || 0), m = M.find(x => x.id === f.mar); const eff = Math.min(1, prep * (1 + (m ? 0.14 * m.lvl : 0)) / 15);
    return `<div class="card front ${f.mode === 'attack' ? 'attack' : 'defend'}"><div class="kv"><b>${f.mode === 'attack' ? '⚔' : '🛡'} ${f.name}</b><span>${f.active ? (f.phase === 'attack' ? 'ofensiva en curso' : 'preparando el plan') : 'inactivo'}</span></div>
    ${f.mode === 'attack' ? `<div class="kv sm"><span>Preparación del plan (${prep} d)</span><b>+${Math.round(15 * eff)}% de ataque</b></div>${bar(eff, 1, '')}` : ''}
    <div class="btnrow"><select data-act="marfront" data-id="${f.id}"><option value="">— sin mariscal —</option>${M.map(m2 => `<option value="${m2.id}" ${f.mar === m2.id ? 'selected' : ''}>${m2.name} (nv. ${m2.lvl})</option>`).join('')}</select></div></div>`; };
  return `<div class="cols"><div class="col wide"><div class="card"><h3>🎖️ Mariscales <small class="dim">· ${M.length}/${marMax(c)}</small></h3><p class="hint">Los mariscales mandan grupos de ejércitos o frentes completos. Un buen mariscal acelera la preparación del plan de batalla y mejora el ataque y la defensa de sus tropas. Con más divisiones podrás tener más mariscales.</p>
    <div class="btnrow"><button data-act="marnew" ${M.length >= marMax(c) ? 'disabled' : ''}>＋ Nombrar mariscal (${money(marCost(c))})</button></div></div>${M.map(marRow).join('')}</div>
    <div class="col"><div class="card"><h3>Planes de batalla</h3><p class="hint">Crea planes en <b>Frentes</b> (línea de frente y flechas de ofensiva). Preparar el plan durante días da hasta <b>+15% de ataque</b>; un mariscal lo acelera.</p></div>${fr.length ? fr.map(frRow).join('') : '<div class="card"><p class="hint">No tienes frentes.</p></div>'}</div></div>`;
}
MX_TABS.push({id: 'marshals', label: '🎖️ Mariscales', html: marshalsHtml});
Object.assign(ACT, {
  marnew: () => { const r = marRecruit(me()); toast(r.ok ? '🎖️' : '⚠️', r.msg); renderWindow(); },
  margroup: d => { const m = mx().mar.find(x => x.id === +d.id); if (m) selectedArmies().forEach(a => { mx().mar.forEach(o => { o.group = o.group.filter(i => i !== a.id); }); m.group.push(a.id); }); renderWindow(); },
  marclear: d => { const m = mx().mar.find(x => x.id === +d.id); if (m) m.group = []; renderWindow(); },
  mardel: d => { const M2 = mx(); M2.mar = M2.mar.filter(x => x.id !== +d.id); (G.fronts || []).forEach(f => { if (f.mar === +d.id) f.mar = null; }); renderWindow(); },
  marfront: (d, el) => { const f = (G.fronts || []).find(x => x.id === +d.id); if (f) { const m = el && el.value ? mx().mar.find(x => x.id === +el.value) : null; f.mar = m ? m.id : null; } renderWindow(); }
});
