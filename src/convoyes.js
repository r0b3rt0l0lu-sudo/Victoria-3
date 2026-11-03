/* ===== CONVOYES Y DEPÓSITOS DE SUMINISTRO =====
   · Un ejército alejado de su centro de suministro se abastece mediante CONVOYES: cada pocos días sale uno desde el depósito/capital y recorre la
     ruta provincia a provincia (1 al día) hasta el ejército, al que entrega comida, agua, pólvora, madera y materiales. Si en su camino hay tropas
     enemigas sin que ninguna fuerza amiga lo escolte en esa provincia, el convoy es CAPTURADO: el ejército no recibe nada y el enemigo se queda el botín.
     Para protegerlo, coloca un ejército propio en la ruta (escolta) o corta antes al enemigo.
   · Los DEPÓSITOS son centros de suministro avanzados que se construyen en provincias propias: acortan las rutas y almacenan botín.
     Si un ejército enemigo ocupa la provincia sin oposición, el depósito es SAQUEADO (el saqueador se queda con las reservas). Se puede INCENDIAR
     antes de perderlo para no dejarle nada al enemigo. */
const CONV_EVERY = 5, DEPOT_MAX = 4;
const CONV_CARGO = {food: 15, water: 15, powder: 8, wood: 5.5, mat: 4};
const depotCost = c => Math.max(2500, Math.round(Math.max(0, c.stats.income) * 2));
const depotsOf = tag => (G.depotList || []).filter(pid => G.P[pid].depot === tag);
function depotRebuild() { G.depotList = []; G.P.forEach((p, i) => { if (p.depot) G.depotList.push(i); }); }
function buildDepot(tag, pid) {
  const c = G.C[tag]; if (!c || G.P[pid].depot) return {ok: false, msg: 'Ya hay un depósito en esta provincia.'};
  if (provOwner(pid) !== tag || !controlled(tag, pid)) return {ok: false, msg: 'Solo puedes construir depósitos en provincias propias y controladas.'};
  if (depotsOf(tag).length >= DEPOT_MAX) return {ok: false, msg: `Máximo ${DEPOT_MAX} depósitos por país.`};
  const cost = depotCost(c); if (c.treasury < cost) return {ok: false, msg: `Faltan fondos (${money(cost)}).`};
  c.treasury -= cost; G.P[pid].depot = tag; G.depotList = G.depotList || []; G.depotList.push(pid); if (G.sup) delete G.sup[tag]; return {ok: true, cost};
}
function removeDepot(pid) { G.P[pid].depot = null; G.depotList = (G.depotList || []).filter(x => x !== pid); }
function burnDepot(tag, pid) { if (G.P[pid].depot !== tag) return {ok: false, msg: 'No hay un depósito tuyo aquí.'}; removeDepot(pid); if (G.sup) delete G.sup[tag]; return {ok: true}; }
const convEnsure = () => { if (!G.convoys) G.convoys = []; if (!G.nextConv) G.nextConv = 1; };
const convOf = a => { convEnsure(); return G.convoys.find(cv => cv.army === a.id); };
function convSpawn(a) {
  const rt = a.rt; if (!rt || !rt.ok || rt.path.length < 3 || convOf(a)) return;
  if (G.date.t - (a._lastConv === undefined ? -99 : a._lastConv) < CONV_EVERY) return; a._lastConv = G.date.t;
  G.convoys.push({id: G.nextConv++, tag: a.tag, army: a.id, path: rt.path.slice(), i: rt.path.length - 1, born: G.date.t});
}
function convLoot(a, f) { const r = armyRes(a); RES_KEYS.forEach(k => { r[k] = Math.min(RES_INFO[k].cap, r[k] + CONV_CARGO[k] * f); }); }
function convoyDay() {
  convEnsure(); const idx = resHostIdx(), dead = new Set();
  G.armies.forEach(a => { if (a.sea || !a.rt) return; convSpawn(a); });
  G.convoys.forEach(cv => {
    const a = armyById(cv.army); if (!a) { dead.add(cv.id); return; }
    const pid = cv.path[cv.i];
    // captura: enemigos en la provincia y ninguna fuerza amiga que escolte
    const hostile = [...G.armies].filter(o => !o.sea && o.loc === pid && o.tag !== cv.tag && hostileTags(cv.tag, o.tag)), escort = G.armies.some(o => !o.sea && o.loc === pid && (o.tag === cv.tag || sameSide(cv.tag, o.tag)) && o.id !== cv.army);
    if (hostile.length && !escort) {
      dead.add(cv.id); const thief = hostile[0]; convLoot(thief, 0.5);
      const msg = `¡Un convoy de suministros de ${G.C[cv.tag].name} ha sido capturado por ${thief.name} en ${provName(pid)}!`;
      if (cv.tag === G.player || thief.tag === G.player) notify('war', msg, provState(pid)); else logMsg(msg); a._convLost = (a._convLost || 0) + 1; return;
    }
    if (a.loc !== cv.path[0] && cv.i > 0 && !a.path.length) { /* el ejército se movió: el convoy vuelve y se pierde el viaje */ dead.add(cv.id); return; }
    cv.i--;
    if (cv.i <= 0) { dead.add(cv.id); if (a.loc === cv.path[0] || MAP.provs[a.loc].nb.includes(cv.path[0])) { convLoot(a, 1); a._convOk = (a._convOk || 0) + 1; } }
  });
  if (dead.size) G.convoys = G.convoys.filter(cv => !dead.has(cv.id));
  // depósitos: saqueo por enemigos sin oposición
  (G.depotList || []).slice().forEach(pid => {
    const tag = G.P[pid].depot, here = G.armies.filter(o => !o.sea && o.loc === pid); const foe = here.find(o => o.tag !== tag && hostileTags(tag, o.tag)); if (!foe) return;
    if (here.some(o => o.tag === tag || sameSide(tag, o.tag))) return;
    removeDepot(pid); if (G.sup) delete G.sup[tag]; const r = armyRes(foe); r.food = Math.min(RES_INFO.food.cap, r.food + 10); r.powder = Math.min(RES_INFO.powder.cap, r.powder + 6); r.wood = Math.min(RES_INFO.wood.cap, r.wood + 4); r.mat = Math.min(RES_INFO.mat.cap, r.mat + 3);
    const msg = `${foe.name} saquea el depósito de suministros de ${G.C[tag].name} en ${provName(pid)}.`; if (tag === G.player || foe.tag === G.player) notify('war', msg, provState(pid)); else logMsg(msg);
  });
  // la IA construye depósitos de vez en cuando para sus frentes lejanos
  if (G.date.t % 9 === 0) G.tags.forEach(t => { if (t === NONE || t === G.player || !alive(t)) return; const c = G.C[t]; if (!c.wars.length || depotsOf(t).length >= 2 || c.treasury < depotCost(c) * 3) return;
    const a = G.armies.find(x => x.tag === t && !x.sea && x.rt && x.rt.safe && x.rt.path.length >= 4 && controlled(t, x.loc) && provOwner(x.loc) === t); if (a && Math.random() < 0.5) buildDepot(t, a.loc); });
}
const _supplyDay1 = supplyDay;
supplyDay = function () { _supplyDay1(); convoyDay(); };
// el reabastecimiento diario con ruta larga pasa a depender sobre todo de los convoyes
const resTrickle = a => (a.rt && a.rt.safe && a.rt.path.length >= 3) ? 0.25 : 1;
// marcadores en el mapa
function convoyMarkers() {
  convEnsure(); const out = [];
  (G.depotList || []).forEach(pid => { const tag = G.P[pid].depot; if (tag !== G.player && !provVisible(pid)) return; out.push({id: 'dp' + pid, state: provState(pid), prov: pid, ch: '📦', cls: 'depotmk', tip: `<b>Depósito de suministros</b><br>${G.C[tag].name}. Centro de abastecimiento avanzado; si lo ocupa el enemigo sin oposición será saqueado.`}); });
  G.convoys.forEach(cv => { const pid = cv.path[cv.i]; if (pid === undefined || (cv.tag !== G.player && !provVisible(pid))) return; out.push({id: 'cv' + cv.id, state: provState(pid), prov: pid, ch: '🚚', cls: 'convmk', tip: `<b>Convoy de suministros</b><br>${G.C[cv.tag].name} · llega en ${Math.max(1, cv.i)} día${cv.i === 1 ? '' : 's'}. ${cv.tag === G.player ? 'Escóltalo con un ejército si hay enemigos cerca.' : 'Captúralo entrando en su provincia.'}`}); });
  return out;
}
function convoyInfoHtml(a) {
  const cv = convOf(a), n = depotsOf(a.tag).length, here = G.P[a.loc].depot;
  return `<div class="kv"><span>Convoy</span><b>${cv ? `🚚 en camino: llega en ${Math.max(1, cv.i)} d` : a.rt && a.rt.path.length >= 3 && a.rt.ok ? (a.rt.safe ? 'próximo convoy en breve' : '⚠ ruta amenazada: los convoyes arriesgan ser capturados') : a.rt && a.rt.path.length < 3 ? 'junto al centro de suministro' : '—'}${a._convLost ? ` <small class="bad">(${a._convLost} capturados)</small>` : ''}</b></div>
  <div class="kv"><span>Depósitos</span><b>${n}/${DEPOT_MAX}${here ? ` · aquí: ${G.C[here].name}` : ''}</b></div>`;
}
Object.assign(ACT, {
  builddepot: () => { const a = armyById(UI.selArmy); if (!a || a.tag !== G.player) return; const r = buildDepot(G.player, a.loc); if (!r.ok) toast('⚠️', r.msg); else toast('📦', `Depósito construido en ${provName(a.loc)} (${money(r.cost)}).`); R.dirty = true; if (typeof renderArmyPanel === 'function') renderArmyPanel(); updateMarkers(); },
  burndepot: () => { const a = armyById(UI.selArmy); if (!a || a.tag !== G.player) return; const r = burnDepot(G.player, a.loc); if (!r.ok) toast('⚠️', r.msg); else toast('🔥', 'Has incendiado tu depósito: el enemigo no se quedará nada.'); if (typeof renderArmyPanel === 'function') renderArmyPanel(); updateMarkers(); }
});
