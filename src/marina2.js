/* ===== MARINA 2 · SUPREMACÍA NAVAL, REPARTO DE FLOTAS, BLOQUEO Y ESCASEZ =====
   · Supremacía (0-100) por país y mar: sube o baja hasta 2 puntos al día según la fuerza propia frente a la hostil. Hace falta ≥50 para bloquear
     y condiciona la seguridad de los desembarcos. Cuando una potencia pasa a dominar un mar se anota en M.snews.
   · Reparto: la IA ya no manda toda la marina al mar más cercano; reparte el poder por las zonas enemigas (según sus puertos), la defensa propia
     y las zonas disputadas, proporcionalmente a su peso.
   · Agrupar/dividir escuadrones (para el mapa marítimo).
   · Escasez por bloqueo: c.scarc (0-1) → malestar, legitimidad, producción, motines (crisis «riots») e insurrección revolucionaria. */
function navalSup(tag, z) { const M = mx(); return (M.sup && M.sup[z] && M.sup[z][tag]) || 0; }
function seaDominant(z) { const M = mx(); const o = M.sup && M.sup[z]; if (!o) return null; let b = null, bv = 20; for (const t in o) if (o[t] > bv) { bv = o[t]; b = t; } return b; }
function navalSupDay() {
  const M = mx(); M.sup = M.sup || {}; M.snews = M.snews || [];
  const present = {}; M.fl.forEach(f => { if (!f.tr && f.port == null && f.ships.length) (present[f.zone] = present[f.zone] || new Set()).add(f.tag); });
  SEA_ZONES.forEach(zn => {
    const z = zn.id, o = M.sup[z] = M.sup[z] || {}, prevDom = seaDominant(z);
    const tags = present[z] || new Set();
    tags.forEach(t => {
      const own = zonePower(t, z, 'own'), foe = zonePower(t, z, 'foe'), target = own + foe > 0 ? 100 * own / (own + foe) : 0;
      const cur = o[t] || 0; o[t] = clamp(cur + clamp(target - cur, -2, 2), 0, 100);
    });
    for (const t in o) if (!tags.has(t)) { o[t] -= 1; if (o[t] <= 0) delete o[t]; }
    // si un enemigo domina, quien lo sufre pierde supremacía aunque no tenga flota
    const dom = seaDominant(z);
    if (dom && dom !== prevDom && prevDom !== null && hostileTags(dom, prevDom) && (dom === G.player || prevDom === G.player || !M.snews.length || G.date.t - M.snews[0].t > 10)) {
      M.snews.unshift({z, tag: dom, from: prevDom, t: G.date.t}); if (M.snews.length > 20) M.snews.pop();
      if (dom === G.player || prevDom === G.player) notify('war', `${dom === G.player ? '⚓ Tu marina conquista la supremacía' : '⚠️ ' + G.C[dom].name + ' conquista la supremacía'} en ${zn.name}.`);
    }
  });
}
const _navyDayM2 = navyDay;
navyDay = function () { _navyDayM2(); if (mx().fl.length) { navalSupDay(); navalDisengage(); } };
/* Fin de las batallas eternas: tras varios días de combate el bando más débil rompe el contacto y se retira a puerto (y tarda en volver); si dura más de
   3 semanas se retiran los dos. Las flotas con táctica «romper el contacto» se retiran a los 2 días. */
function navalDisengage() {
  const M = mx(); if (!M.nb) return;
  for (const zs in M.nb) {
    const r = M.nb[zs], z = +zs; if (!r || G.date.t - r.last > 1) continue;
    const here = M.fl.filter(f => f.zone === z && !f.tr && f.port == null && f.ships.length);
    const sideOf = f => (f.tag === r.a || sameSide(f.tag, r.a)) ? 'A' : (f.tag === r.b || sameSide(f.tag, r.b)) ? 'B' : null;
    const P = {A: 0, B: 0}; here.forEach(f => { const sd = sideOf(f); if (sd) P[sd] += fleetPower(f); });
    const dur = r.day; let loser = null;
    if (dur >= 21) loser = 'AB'; else if (dur >= 8) loser = P.A < P.B ? 'A' : 'B'; else if (dur >= 4 && P.A < P.B * 0.5) loser = 'A'; else if (dur >= 4 && P.B < P.A * 0.5) loser = 'B';
    here.forEach(f => {
      const sd = sideOf(f); if (!sd) return; const evade = f.tac === 'evade' && dur >= 2;
      if (!(evade || (loser && loser.includes(sd)))) return;
      const c = G.C[f.tag], hz = mainPortZone(c); f.cool = {z, until: G.date.t + 40}; f.mission = 'port'; f.target = null;
      if (hz !== null && hz !== z) fleetMove(f, hz); else { const ps = portsStates(c); if (ps.length && typeof fleetDock === 'function') fleetDock(f, ps[0]); }
      if (f.tag === G.player) notify('war', `⚓ ${f.name} rompe el contacto en ${SEA_ZONES[z].name} y se retira a puerto.`);
    });
  }
}
// bloqueo: solo cuenta quien tiene supremacía en la zona
const _fleetsBlockadingM2 = fleetsBlockading;
fleetsBlockading = function (tag, z) {
  let p = 0; mx().fl.forEach(f => { if (f.zone === z && !f.tr && f.port == null && f.mission === 'blockade' && f.ships.length && hostileTags(tag, f.tag) && (!f.target || f.target === tag) && navalSup(f.tag, z) >= 50) p += fleetPower(f); });
  return p;
};
// desembarco seguro: no basta con igualar fuerzas, hay que dominar el mar
const _zoneSecureM2 = zoneSecure;
zoneSecure = function (tag, z) { if (!_zoneSecureM2(tag, z)) return false; const foe = zonePower(tag, z, 'foe'); return foe <= 0 || navalSup(tag, z) >= 35; };

/* ---------- reparto equilibrado de la IA ---------- */
function navalDistribute(c, fl) {
  const enemies = G.tags.filter(o => o !== NONE && hostileTags(c.tag, o) && alive(o));
  const free = fl.filter(f => !f.tr && f.ships.length);
  if (!enemies.length) { fl.forEach(f => { if (f.tr) return; if (f.mission !== 'port' && f.mission !== 'patrol') { f.mission = 'port'; f.target = null; } const hz = mainPortZone(c); if (hz !== null && f.zone !== hz) fleetMove(f, hz); }); return; }
  // zonas candidatas con su peso
  const W = new Map(), add = (z, w, kind, tgt) => { const o = W.get(z); if (o) { o.w += w; if (kind === 'enemy') { o.kind = 'enemy'; o.tgt = o.tgt || tgt; } } else W.set(z, {w, kind, tgt}); };
  enemies.forEach(e => countryZones(G.C[e]).forEach((n, z) => add(z, n * 1.6, 'enemy', e)));
  countryZones(c).forEach((n, z) => { const foe = zonePower(c.tag, z, 'foe'); add(z, n * (foe > 0 ? 2.4 : 0.9), 'home'); });
  M_disputed(c).forEach(z => add(z, 1.2, 'home'));
  let ranked = [...W.entries()].sort((a, b) => b[1].w - a[1].w).slice(0, 6);
  const tot = ranked.reduce((n, [, o]) => n + o.w, 0) || 1, power = free.reduce((n, f) => n + fleetPower(f), 0) || 1;
  const got = new Map(ranked.map(([z]) => [z, 0]));
  free.sort((a, b) => fleetPower(b) - fleetPower(a)).forEach(f => {
    const fp = fleetPower(f); let best = null, bd = -1e9;
    ranked.forEach(([z, o]) => {
      if (f.cool && f.cool.z === z && f.cool.until > G.date.t && zonePower(c.tag, z, 'foe') > fp * 0.6) return;     // acaba de ser derrotada allí
      const need = o.w / tot * power - got.get(z), foe = zonePower(c.tag, z, 'foe');
      let sc = need - zoneDist(f.zone, z) * 0.05 + (f.zone === z ? 0.6 : 0);
      if (o.kind === 'enemy' && foe > fp * 1.8) sc -= 5;        // no se suicida contra una armada mucho mayor
      if (sc > bd) { bd = sc; best = z; }
    });
    if (best === null) return; got.set(best, got.get(best) + fp);
    const o = W.get(best);
    if (o.kind === 'enemy' && fleetPower(f) > zonePower(c.tag, best, 'foe') * 1.1) { if (f.zone !== best || f.port != null) fleetMove(f, best); f.mission = f.ships.some(s => SHIP_TYPES[s.t].raid >= 1.8) && Math.random() < 0.5 ? 'raid' : 'blockade'; f.target = o.tgt; }
    else { if (f.zone !== best || f.port != null) fleetMove(f, best); f.mission = o.kind === 'home' ? (countryZones(c).has(best) ? 'convoy' : 'patrol') : 'patrol'; f.target = null; }
  });
}
// zonas con flotas hostiles y supremacía no resuelta (disputadas) cerca de nuestras costas
function M_disputed(c) { const r = []; const M = mx(); if (!M.sup) return r; countryZones(c).forEach((n, z) => { const o = M.sup[z]; if (o) { const vs = Object.keys(o).filter(t => o[t] > 15 && hostileTags(c.tag, t)); if (vs.length) r.push(z); } }); return r; }

/* ---------- agrupar y dividir escuadrones ---------- */
function fleetMerge(list) {
  list = list.filter(f => f && f.ships.length && !f.tr); if (list.length < 2) return {ok: false, msg: 'Elige al menos dos flotas en puerto o fondeadas en la misma zona.'};
  const z = list[0].zone, tag = list[0].tag; if (list.some(f => f.zone !== z || f.tag !== tag)) return {ok: false, msg: 'Para agruparlas deben estar en la misma zona.'};
  const dock = list.every(f => f.port === list[0].port); if (!dock) return {ok: false, msg: 'Todas deben estar atracadas en el mismo puerto o todas en el mar.'};
  const main = list.slice().sort((a, b) => b.ships.length - a.ships.length)[0];
  list.forEach(f => { if (f !== main) { main.ships.push(...f.ships); if (f.adm.lvl > main.adm.lvl) main.adm = f.adm; f.ships = []; } });
  main.name = main.name.replace(/ \(grupo\)$/, '') + ' (grupo)';
  mx().fl = mx().fl.filter(f => f.ships.length); return {ok: true, msg: `Flotas agrupadas: ${main.ships.length} buques.`, f: main};
}
function fleetSplit(f, mode) {
  if (!f || f.tr || f.ships.length < 2) return {ok: false, msg: 'La flota es demasiado pequeña o está en ruta.'};
  let keep = [], out = [];
  if (mode === 'fast') { f.ships.forEach(s => (SHIP_TYPES[s.t].spd >= 1.2 ? out : keep).push(s)); } else if (mode === 'heavy') { f.ships.forEach(s => (SHIP_TYPES[s.t].att >= 12 ? out : keep).push(s)); } else { f.ships.forEach((s, i) => (i % 2 ? out : keep).push(s)); }
  if (!keep.length || !out.length) { keep = []; out = []; f.ships.forEach((s, i) => (i % 2 ? out : keep).push(s)); }
  f.ships = keep; const n = newFleet(f.tag, f.zone, f.name.replace(/ \(grupo\)$/, '') + ' B'); n.ships = out; n.mission = f.mission; n.target = f.target; n.port = f.port; n.adm = newAdmiral(f.tag); return {ok: true, msg: `Dividida en ${keep.length} y ${out.length} buques.`, f: n};
}

/* ---------- escasez por bloqueo ---------- */
function scarcityMonth(c) {
  if (c.tag === NONE || !c.states.length) return;
  const blk = blockadeFrac(c.tag), old = c.scarc || 0;
  // la escasez crece despacio mientras dura el bloqueo (las reservas se agotan) y se recupera más despacio aún
  const target = Math.min(1, blk * 1.05); let v = old + (target > old ? Math.min(0.12, target - old) : -0.06);
  c.scarc = clamp(v, 0, 1); const sc = c.scarc;
  if (sc <= 0.02) { c.scarc = 0; return; }
  if (sc >= 0.2 && old < 0.2 && c.tag === G.player) notify('crisis', '🚧 El bloqueo naval provoca escasez: suben los precios y el malestar. Rompe el cerco o racionea.', c.capital);
  c.radicals = Math.min(0.95, c.radicals + 0.02 * sc * (c.eco && c.eco.ration ? 0.6 : 1)); c.legitimacy -= 0.5 * sc;
  c.states.forEach(id => { const s = G.S[id]; if (s.rad !== undefined && MAP.stats[id].provs.some(p => MAP.provs[p].port)) s.rad = Math.min(1, s.rad + 0.01 * sc); });
  if (sc > 0.35 && Math.random() < 0.3 * (sc - 0.25) * diffP().crisis && !G.crises.some(x => x.type === 'riots' && x.scope === c.tag)) addCrisis('riots', c.tag, {name: 'Motines del hambre por el bloqueo'});
  if (sc > 0.6 && c.radicals > 0.25 && !c.rev && Math.random() < 0.08 * sc && typeof REVS !== 'undefined') {
    const ks = Object.keys(REVS).filter(k => { try { return revPropensity(c, k) > 0; } catch (e) { return false; } });
    if (ks.length) { revStart(c, ks[Math.floor(Math.random() * ks.length)]); logMsg(`${c.name}: el bloqueo y el hambre desencadenan una insurrección.`); }
  }
}
const _recalcMods2 = recalcMods;
recalcMods = function (c) { const m = _recalcMods2(c); const sc = c.scarc || 0; if (sc > 0) { m.out -= 0.08 * sc; m.stab = (m.stab || 0) - 2.5 * sc; m.grow = (m.grow || 0) - 0.0005 * sc; m.indOut -= 0.05 * sc; } return m; };
const _navalMonthM2 = navalMonth;
navalMonth = function (c) { _navalMonthM2(c); scarcityMonth(c); };

// ficha extra en la pestaña «Marina»: supremacía en tus mares y escasez por bloqueo
MX_TABS.forEach(t => { if (t.id === 'navy') { const h = t.html; t.html = function () {
  let x = h(); const c = me(), M = mx(); const zs = [...countryZones(c).keys()];
  const rows = zs.slice(0, 8).map(z => { const d = seaDominant(z); return `<div class="kv sm"><span>${SEA_ZONES[z].name}</span><b>${d ? flag(d, 'sm') + ' ' + Math.round(navalSup(d, z)) + '%' : '—'}${d && d !== c.tag && hostileTags(c.tag, d) ? ' <span class="bad">⚠️</span>' : ''}</b></div>`; }).join('');
  const sc = c.scarc || 0, ports = portsStates(c);
  const baseRows = typeof baseLvl === 'function' ? ports.slice(0, 8).map(id => `<div class="kv sm"><span>⚓ ${G.S[id].name}</span><b>${baseLvl(id).toFixed(1)} / ${G.S[id].cap.navalbase || 0} <button data-act="navbase" data-s="${id}" ${(G.S[id].cap.navalbase || 0) - baseLvl(id) < 1 ? 'disabled' : ''}>＋</button></b></div>`).join('') : '';
  const card = `<div class="card"><h3>🌊 Supremacía naval <button data-act="mode" data-m="naval" data-tip="Cambia el mapa al modo marítimo para mover y agrupar flotas.">Mapa marítimo</button></h3>${rows || '<small class="dim">Sin costas.</small>'}${sc > 0.02 ? `<div class="notice bad"><b>🚧 Escasez por bloqueo: ${Math.round(sc * 100)}%</b><br>Sube el malestar, cae la producción y pueden estallar motines e insurrecciones. Rompe el cerco con una flota superior.</div>` : ''}<h4>Bases navales</h4>${baseRows}<small class="dim">La base amplía el alcance de tus flotas y su reparación.</small><br><small class="dim">Hace falta ≥50 % de supremacía para bloquear y ≥35 % para desembarcar con seguridad.</small></div>`;
  return x.replace(/<\/div><\/div><\/div>$/, card + '</div></div></div>'); }; } });

const _fleetMoveM2 = fleetMove;
fleetMove = function (f, z) { const had = f.tr; _fleetMoveM2(f, z); if (f.tr && f.tr !== had) f.tr.tot = f.tr.left; };

Object.assign(ACT, {navbase: d => { const c = me(); const ok = queueBuild(c, +d.s, 'navalbase'); toast(ok ? '⚓' : '⚠️', ok ? 'Base naval en construcción.' : 'No se puede construir (sin sitio o sin recursos).'); renderWindow(); }});
