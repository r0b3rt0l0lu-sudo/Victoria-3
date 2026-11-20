/* ===== COMERCIO EXTERIOR CON CONVOYES =====
   El jugador compra mercancías a otros países. Por tierra (frontera común) no cuesta nada más que la mercancía. Por mar hay que comprar CONVOYES (cada uno
   lleva 1 lote) y enviarlos por las zonas marítimas: si en una zona de su ruta hay una flota enemiga y no los escolta ninguna flota propia, se hunden con la
   carga. Una escolta (una flota que viaja con el convoy) los protege según su fuerza frente a la del enemigo. Los convoyes vuelven al puerto y se reutilizan.
   Efecto: el material militar (fusiles, cañones, caballos, pólvora, ametralladoras) entra en los arsenales (c.eq); los bienes civiles forman reservas (c.imp)
   que, mientras duran, alivian la escasez y dan bonificaciones (alimentos: estabilidad y menos malestar; materias primas e industriales: producción industrial). */
const TR_LOT = {rifles: 20000, cannons: 800, horses: 10000, gunpowder: 15000, mgs: 1500, engines: 2000, grain: 80000, meat: 50000, fish: 50000, fruit: 40000, sugar: 40000, iron: 60000, coal: 80000, steel: 30000, tools: 30000, wood: 80000, fabric: 40000, clothes: 30000, oil: 0};
const TR_GOODS = Object.keys(TR_LOT).filter(g => GOOD[g] && TR_LOT[g]);
const trLotCost = (c, g) => Math.round(TR_LOT[g] * (G.price[g] || GOOD[g].base) * 1.12 * 0.18 * moneyPerPoint(c) / 25);
const trConvoyCost = c => Math.round(navalMoney(c, 'steam') * 0.35);
const trCv = c => c.cv || (c.cv = {free: 0, lost: 0, done: 0});
function trLand(c, p) { return c.states.some(i => G.S[i].neigh.some(j => G.S[j].owner === p.tag)); }
function trPorts(c) { return mainPortZone(c); }
function trRoute(c, p) {
  const A = mainPortZone(c), B = mainPortZone(p); if (A === null || B === null) return null; if (A === B) return [A];
  const a = SEA_ZONES[A], b = SEA_ZONES[B]; let dl = b.lon - a.lon; if (dl > 180) dl -= 360; if (dl < -180) dl += 360; const out = [A];
  for (let i = 1; i <= 12; i++) { const t = i / 12, z = seaZoneOfLL(((a.lon + dl * t + 540) % 360) - 180, a.lat + (b.lat - a.lat) * t); if (z !== out[out.length - 1]) out.push(z); } if (out[out.length - 1] !== B) out.push(B); return out;
}
const trHop = (z1, z2) => Math.max(1, Math.ceil(zoneDist(z1, z2) / 5.5));
function trOrder(c, partnerTag, good, lots) {
  const p = G.C[partnerTag]; if (!p || !p.states.length || p.tag === c.tag) return {ok: false, msg: 'Socio no válido.'};
  if (hostileTags(c.tag, p.tag)) return {ok: false, msg: `${p.name} está en guerra con vosotros.`};
  if (!TR_LOT[good]) return {ok: false, msg: 'Mercancía no comerciable.'}; lots = clamp(Math.round(lots), 1, 6);
  const land = trLand(c, p), cost = trLotCost(c, good) * lots; if (c.treasury < cost) return {ok: false, msg: `Necesitas ${money(cost)}.`};
  let route = null, days = 0;
  if (land) days = 6 + Math.round(distStates(G.S[c.capital >= 0 ? c.capital : c.states[0]], G.S[p.capital >= 0 ? p.capital : p.states[0]]) / 40);
  else { route = trRoute(c, p); if (!route) return {ok: false, msg: 'No hay ruta marítima: hace falta un puerto en cada país.'}; const cv = trCv(c); if (cv.free < lots) return {ok: false, msg: `Faltan convoyes: necesitas ${lots} y tienes ${cv.free} libres. Cómpralos primero.`}; cv.free -= lots; for (let i = 1; i < route.length; i++) days += trHop(route[i - 1], route[i]); }
  c.treasury -= cost; p.treasury += cost * 0.8; const M = mx(); M.cvs = M.cvs || []; M.ncv = (M.ncv || 0) + 1;
  M.cvs.push({id: M.ncv, tag: c.tag, partner: p.tag, good, lots, land, route: route || [], i: 0, left: route && route.length > 1 ? trHop(route[0], route[1]) : days, days, back: false, zone: route ? route[0] : -1});
  return {ok: true, msg: `Pedido de ${lots} lote${lots > 1 ? 's' : ''} de ${GOOD[good].name.toLowerCase()} a ${p.name}: ${land ? 'por tierra' : 'por mar con ' + lots + ' convoy' + (lots > 1 ? 'es' : '')}, llegada en unos ${days} días.`};
}
function trDeliver(c, cv) {
  const q = TR_LOT[cv.good] * cv.lots; c.eq = c.eq || {};
  if (['rifles', 'cannons', 'horses', 'gunpowder', 'mgs', 'engines'].includes(cv.good)) c.eq[cv.good] = (c.eq[cv.good] || 0) + q;
  else { c.imp = c.imp || {}; c.imp[cv.good] = (c.imp[cv.good] || 0) + cv.lots; }
  trCv(c).done += cv.lots; if (c.tag === G.player) notify('war', `📦 Llega el cargamento de ${cv.lots} lote(s) de ${GOOD[cv.good].name.toLowerCase()} desde ${G.C[cv.partner].name}.`);
}
function trDay() {
  const M = mx(); if (!M.cvs || !M.cvs.length) return;
  M.cvs.forEach(cv => {
    const c = G.C[cv.tag]; if (!c || cv.dead) { cv.dead = 1; return; }
    if (cv.land) { if (--cv.left <= 0) { trDeliver(c, cv); cv.dead = 1; } return; }
    // escoltas: viajan con el convoy
    M.fl.forEach(f => { if (f.escort === cv.id) { if (cv.back && cv.i <= 0 || !f.ships.length) { f.escort = null; return; } f.zone = cv.zone; f.tr = null; f.port = null; f.mission = 'convoy'; } });
    // peligro en la zona actual
    const H = M.fl.filter(f => f.zone === cv.zone && !f.tr && f.port == null && f.ships.length && hostileTags(cv.tag, f.tag)), hp = H.reduce((n, f) => n + fleetPower(f), 0);
    if (hp > 0) {
      const E = M.fl.filter(f => f.escort === cv.id && f.zone === cv.zone && f.ships.length), ep = E.reduce((n, f) => n + fleetPower(f) * 1.1, 0), pSunk = 0.9 * clamp(1 - ep / (hp * 1.2), 0, 1);
      if (Math.random() < pSunk) { cv.dead = 1; trCv(c).lost += cv.lots; M.fl.forEach(f => { if (f.escort === cv.id) f.escort = null; });
        if (cv.tag === G.player || cv.partner === G.player) notify('war', `🚢💥 ¡${cv.back ? 'Convoy vacío de regreso' : 'Un convoy con ' + cv.lots + ' lote(s) de ' + GOOD[cv.good].name.toLowerCase()} hundido en ${SEA_ZONES[cv.zone].name}!${E.length ? ' La escolta no bastó.' : ' No llevaba escolta.'}`); return; }
    }
    if (--cv.left > 0) return;
    // avanza o llega
    if (!cv.back) { if (cv.i + 1 < cv.route.length) { cv.i++; cv.zone = cv.route[cv.i]; cv.left = cv.i + 1 < cv.route.length ? trHop(cv.route[cv.i], cv.route[cv.i + 1]) : 1; if (cv.i === cv.route.length - 1) cv.left = 1; } else { trDeliver(c, cv); cv.back = true; cv.i = cv.route.length - 1; cv.left = 1; } }
    else { if (cv.i > 0) { cv.i--; cv.zone = cv.route[cv.i]; cv.left = trHop(cv.route[Math.min(cv.route.length - 1, cv.i + 1)], cv.route[cv.i]); } else { cv.dead = 1; trCv(c).free += cv.lots; M.fl.forEach(f => { if (f.escort === cv.id) f.escort = null; }); } }
  });
  M.cvs = M.cvs.filter(cv => !cv.dead);
}
const _navyDayTR = navyDay; navyDay = function () { _navyDayTR(); trDay(); };
// reservas civiles: consumo mensual y bonificaciones
const FOOD_G = ['grain', 'meat', 'fish', 'fruit', 'sugar'];
function trMonth(c) {
  if (!c.imp) return; let food = 0, ind = 0;
  for (const g in c.imp) { const s = c.imp[g]; if (s <= 0) continue; (FOOD_G.includes(g) ? (food += Math.min(s, 3)) : (ind += Math.min(s, 3))); c.imp[g] = Math.max(0, s - 0.5 - s * 0.08); if (c.imp[g] < 0.05) delete c.imp[g]; }
  c.impB = {food: Math.min(3, food), ind: Math.min(3, ind)};
  if (food > 0) { c.radicals = Math.max(0, c.radicals - 0.0012 * Math.min(3, food)); c.scarc = Math.max(0, (c.scarc || 0) - 0.04 * Math.min(3, food)); }
}
const _navalMonthTR = navalMonth; navalMonth = function (c) { _navalMonthTR(c); trMonth(c); };
const _recalcTR = recalcMods; recalcMods = function (c) { const m = _recalcTR(c); if (c.impB) { m.indOut += 0.012 * c.impB.ind; m.stab = (m.stab || 0) + 0.3 * c.impB.food; } return m; };

/* ---------- ventana ---------- */
MENU_ITEMS.push(['trade', '🚢', 'Comercio', 'Comercio exterior', 'Compra mercancías a otros países; por mar necesitas convoyes y escoltas.']);
UI.trade = UI.trade || {p: null, g: 'rifles', n: 1};
WINDOWS.trade = {title: 'Comercio exterior', icon: '🚢', render() {
  const c = me(), T = UI.trade, cv = trCv(c), M = mx();
  const cand = G.tags.filter(t => t !== NONE && t !== c.tag && alive(t) && G.C[t].states.length && !hostileTags(c.tag, t)).sort((a, b) => G.C[a].rank - G.C[b].rank).slice(0, 40);
  if (!T.p || !cand.includes(T.p)) T.p = cand[0];
  const p = G.C[T.p], land = p ? trLand(c, p) : false, cost = p ? trLotCost(c, T.g) * T.n : 0, route = p && !land ? trRoute(c, p) : null;
  let days = 0; if (route) for (let i = 1; i < route.length; i++) days += trHop(route[i - 1], route[i]);
  const mine = M.cvs ? M.cvs.filter(x => x.tag === c.tag) : [], fleets = M.fl.filter(f => f.tag === c.tag && f.ships.length);
  const danger = z => M.fl.some(f => f.zone === z && !f.tr && f.port == null && f.ships.length && hostileTags(c.tag, f.tag));
  return `<div class="cols"><div class="col wide"><div class="card"><h3>🛒 Nuevo pedido</h3>
    <div class="kv"><span>País vendedor</span><select data-act="trp">${cand.map(t => `<option value="${t}" ${t === T.p ? 'selected' : ''}>${G.C[t].name}</option>`).join('')}</select></div>
    <div class="kv"><span>Mercancía</span><select data-act="trg">${TR_GOODS.map(g => `<option value="${g}" ${g === T.g ? 'selected' : ''}>${GOOD[g].icon} ${GOOD[g].name} (lote: ${fmtN(TR_LOT[g], 0)})</option>`).join('')}</select></div>
    <div class="kv"><span>Lotes</span><select data-act="trn">${[1, 2, 3, 4, 5, 6].map(n => `<option ${n === T.n ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
    <div class="kv"><span>Precio</span><b>${money(cost)}</b></div>
    <div class="kv"><span>Ruta</span><b>${land ? '🚆 por tierra (sin convoyes)' : route ? '🚢 por mar · ' + route.map(z => SEA_ZONES[z].name).join(' → ') + ` · ~${days} días` : '— sin puertos —'}</b></div>
    ${!land ? `<div class="kv"><span>Convoyes necesarios / libres</span><b class="${cv.free < T.n ? 'bad' : ''}">${T.n} / ${cv.free}</b></div>` : ''}
    <div class="btnrow"><button class="pri" data-act="trgo">Hacer el pedido</button></div>
    <p class="hint">${EQ_GOODS_TXT}</p></div>
  <div class="card"><h3>⚓ Convoyes</h3><div class="kv"><span>Libres en puerto</span><b>${cv.free}</b></div><div class="kv sm"><span>Entregados / hundidos</span><b>${cv.done} / <span class="bad">${cv.lost}</span></b></div>
    <div class="btnrow"><button data-act="trbuy" data-n="1">＋1 convoy · ${money(trConvoyCost(c))}</button><button data-act="trbuy" data-n="5">＋5 convoyes · ${money(trConvoyCost(c) * 5)}</button></div>
    <p class="hint">Cada convoy lleva un lote, viaja por las zonas marítimas y vuelve al puerto. Si una flota enemiga lo alcanza sin escolta, se hunde con la carga.</p></div></div>
  <div class="col"><div class="card"><h3>🚢 Envíos en curso</h3>${mine.map(x => { const esc = fleets.filter(f => f.escort === x.id), here = fleets.filter(f => f.zone === x.zone && !f.tr && f.escort !== x.id && !f.escort);
    return `<div class="card"><div class="kv"><b>${GOOD[x.good].icon} ${x.lots}× ${GOOD[x.good].name}</b><span>${G.C[x.partner].name}</span></div>
      <div class="kv sm"><span>${x.land ? '🚆 por tierra' : (x.back ? '↩️ regresando · ' : '➡️ ') + SEA_ZONES[x.zone].name}</span><b>${x.left} d ${!x.land && danger(x.zone) ? '<span class="bad">⚠️ enemigos</span>' : ''}</b></div>
      ${x.land ? '' : `<div class="kv sm"><span>Escolta</span><b>${esc.length ? esc.map(f => f.name).join(', ') : '<span class="bad">ninguna</span>'}</b></div>
      ${esc.length ? `<button data-act="tresc" data-id="${x.id}" data-f="">Quitar escolta</button>` : here.length ? `<select data-act="tresc2" data-id="${x.id}"><option value="">Asignar escolta…</option>${here.map(f => `<option value="${f.id}">${f.name} (${f.ships.length}) · ${SEA_ZONES[f.zone].name}</option>`).join('')}</select>` : '<small class="dim">Ninguna flota tuya en la zona del convoy: llévala allí para escoltarlo.</small>'}`}</div>`; }).join('') || '<small class="dim">Sin envíos.</small>'}</div></div></div>`;
}};
const EQ_GOODS_TXT = 'El material militar entra directamente en tus arsenales. Los bienes civiles forman reservas que se consumen en unos meses: alimentos alivian la escasez y el malestar; materias primas e industriales dan producción industrial.';
Object.assign(ACT, {
  trp: (d, el) => { UI.trade.p = el.value; renderWindow(); }, trg: (d, el) => { UI.trade.g = el.value; renderWindow(); }, trn: (d, el) => { UI.trade.n = +el.value; renderWindow(); },
  trbuy: d => { const c = me(), n = +d.n, cost = trConvoyCost(c) * n; if (c.treasury < cost) { toast('⚠️', `Necesitas ${money(cost)}.`); return; } c.treasury -= cost; trCv(c).free += n; toast('🚢', `${n} convoy(es) comprados.`); renderWindow(); },
  trgo: () => { const T = UI.trade, r = trOrder(me(), T.p, T.g, T.n); toast(r.ok ? '📦' : '⚠️', r.msg); renderWindow(); },
  tresc: d => { mx().fl.forEach(f => { if (f.escort === +d.id) f.escort = null; }); renderWindow(); },
  tresc2: (d, el) => { const f = mx().fl.find(x => x.id === +el.value); if (f) { f.escort = +d.id; f.mission = 'convoy'; toast('🛡️', `${f.name} escolta al convoy.`); } renderWindow(); }
});
