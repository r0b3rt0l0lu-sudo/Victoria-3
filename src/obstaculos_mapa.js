/* ===== OBSTÁCULOS DEL MAPA ESTRATÉGICO: ríos, cordilleras, pasos, puentes y estaciones =====
   Cada frontera entre dos provincias se analiza una vez con los datos reales del mapa (máscara de ríos de orden 1-6, elevación y relieve):
   · RÍO       si la frontera cruza un río de orden ≥ 3 (Rin, Danubio, Vístula…). Cruzarlo sin puente alarga la marcha (×1,25 orden 3 … ×2 orden 6) y
               el atacante que lo cruza sufre −3…−9% de ataque los 3 primeros días de la batalla; el defensor gana +4%. Con puente (infraestructura ≥ 3,
               estado con ferrocarril, capital de estado o puente histórico) solo hay un cuello de botella (×1,1; ×1 con ferrocarril propio).
   · CORDILLERA / PASO   la frontera es una cresta (más alta que ambas provincias y ≥ 700 m): ×1,4…×2,4. Los pasos (puertos) son los puntos bajos de
               la cresta: ×1,15, pero el que los fuerza sufre −5% de ataque y el defensor gana +7%.
   · ESTACIONES   en invierno los ríos del norte se hielan (cruzables, ×1,05); en primavera la crecida los hace peores (×1,2); la nieve cierra los pasos (×1,6).
   · PUENTES   se pueden VOLAR (con una fuerza propia en una de las dos provincias): el puente queda caído 90 días y el enemigo debe vadear o dar un rodeo.
   Mapa «Obstáculos»: colorea los estados por la dificultad de sus fronteras. El panel de estado lista sus obstáculos y el del ejército los de su ruta. */
const OB = {edges: null, byProv: null};
const obOutMap = () => (G.obOut = G.obOut || {});
const obKey = (a, b) => a < b ? a * 65536 + b : b * 65536 + a;
const OB_RIVER = {3: 1.25, 4: 1.45, 5: 1.7, 6: 2.0};
function obBuild() {
  if (OB.edges || !MAP.provs || !MAP.provOf || !MAP.riverMask) return;
  const W = MAP_W, H = MAP_H, land = MAP.land, po = MAP.provOf, rm = MAP.riverMask, em = MAP.elevM, P = MAP.provs.length;
  const pe = new Float64Array(P), pn = new Float64Array(P), rname = new Map();
  MAP.riverPaths.forEach((path, r) => { if (MAP.riverOrder[r] >= 3) path.forEach(i => rname.set(i, r)); });
  const rmax = i => { let m = rm[i]; const x = i % W; if (x > 0 && rm[i - 1] > m) m = rm[i - 1]; if (x < W - 1 && rm[i + 1] > m) m = rm[i + 1]; if (i >= W && rm[i - W] > m) m = rm[i - W]; if (i + W < W * H && rm[i + W] > m) m = rm[i + W]; return m; };
  const E = new Map();
  const add = (i, j) => {
    const a = po[i], b = po[j], k = obKey(a, b); let e = E.get(k); if (!e) { e = {a: Math.min(a, b), b: Math.max(a, b), n: 0, rc: 0, ro: 0, rr: new Map(), es: 0, emin: 1e9}; E.set(k, e); }
    e.n++; const ro = Math.max(rmax(i), rmax(j)); if (ro >= 3) { e.rc++; if (ro > e.ro) e.ro = ro; const r = rname.has(i) ? rname.get(i) : rname.get(j); if (r !== undefined) e.rr.set(r, (e.rr.get(r) || 0) + 1); }
    const el = (em[i] + em[j]) / 2; e.es += el; if (el < e.emin) e.emin = el;
  };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x; if (!land[i]) continue; const p = po[i]; pe[p] += em[i]; pn[p]++;
    if (x < W - 1 && land[i + 1] && po[i + 1] !== p) add(i, i + 1);
    if (y < H - 1 && land[i + W] && po[i + W] !== p) add(i, i + W);
  }
  const byProv = Array.from({length: P}, () => []), edges = new Map();
  E.forEach((e, k) => {
    e.elev = e.es / e.n; const ea = pe[e.a] / Math.max(1, pn[e.a]), eb = pe[e.b] / Math.max(1, pn[e.b]), h = hash2(e.a, e.b, 4411);
    e.river = (e.rc >= 4 || (e.ro >= 5 && e.rc >= 2)) ? e.ro : 0;
    if (e.river) { let bn = 0, br = -1; e.rr.forEach((v, r) => { if (v > bn) { bn = v; br = r; } }); e.rname = br >= 0 ? MAP.riverName[br] : 'río'; }
    e.ridge = e.n >= 5 && e.elev >= 700 && e.elev > Math.max(ea, eb) + 120;
    e.pass = e.ridge && (e.emin < e.elev * 0.8 || h < 0.25);
    e.bridge0 = !!e.river && (h < (e.river >= 5 ? 0.12 : 0.22) || ((MAP.stats[MAP.provs[e.a].s].provs[0] === e.a || MAP.stats[MAP.provs[e.b].s].provs[0] === e.b) && h < 0.7));
    delete e.rr; delete e.es;
    if (e.river || e.ridge) { edges.set(k, e); byProv[e.a].push(e); byProv[e.b].push(e); }
  });
  OB.edges = edges; OB.byProv = byProv;
}
const obEdge = (a, b) => { if (!OB.edges) obBuild(); return OB.edges ? OB.edges.get(obKey(a, b)) : undefined; };
const obOut = e => { const t = obOutMap()[obKey(e.a, e.b)]; return !!t && G.date.t < t; };
const obBridged = e => !!e.river && !obOut(e) && (e.bridge0 || (G.S[MAP.provs[e.a].s].infra || 0) >= 3 || (G.S[MAP.provs[e.b].s].infra || 0) >= 3);
// estación en la latitud de la provincia: 'invierno' | 'deshielo' | null (el hemisferio sur invierte los meses)
function obSeason(lat) { const m = G.date.m, mm = lat < 0 ? (m + 6) % 12 : m, al = Math.abs(lat); if ((mm === 11 || mm <= 1) && al > 42) return 'invierno'; if ((mm === 3 || mm === 4) && al > 30) return 'deshielo'; return null; }
// multiplicador de tiempo al cruzar de una provincia a otra
function obCross(a, fromId, toId) {
  const e = obEdge(fromId, toId); if (!e) return 1; const lat = MAP.provs[toId].lat, se = obSeason(lat); let m = 1;
  if (e.river) {
    if (obBridged(e)) { const sf = G.S[MAP.provs[fromId].s], so = G.S[MAP.provs[toId].s], own = so.owner === a.tag || sameSide(a.tag, so.owner), fo = sf.owner === a.tag || sameSide(a.tag, sf.owner); m = own && fo && Math.min(sf.infra || 0, so.infra || 0) >= 2 ? 1 : 1.1; }
    else { m = OB_RIVER[e.river] || 1.25; if (se === 'invierno') m = e.river <= 4 ? 1.05 : m * 0.9; else if (se === 'deshielo' && e.river >= 4) m *= 1.2; }
  }
  if (e.ridge) { let r = e.pass ? 1.15 : clamp(1.4 + (e.elev - 700) / 1500, 1.4, 2.4); if (se === 'invierno') r *= e.pass ? 1.4 : 1.5; m *= r; }
  return Math.min(3.0, m);
}
const _hopDaysOB = hopDays;
hopDays = function (a, fromId, toId) {
  const d = _hopDaysOB(a, fromId, toId); const m = obCross(a, fromId, toId); return m === 1 ? d : clamp(Math.round(d * m), 1, 45);
};
// efectos en la batalla: el atacante que cruza un río o fuerza un paso lo paga los 3 primeros días; el defensor se beneficia
const _terrModsOB = terrMods;
terrMods = function (b, side) {
  const r = _terrModsOB(b, side); if (b.day > 3) return r; const A = armyById((b.att === 'A' ? b.A : b.B)[0]); if (!A || A.from === undefined || A.from === null) return r;
  const e = obEdge(A.from, b.prov); if (!e) return r; const isAtt = b.att === side, st = (side === 'A' ? b.strA : b.strB) || 'frontal';
  if (e.river && !obBridged(e)) { if (isAtt) r.att -= Math.min(0.09, 0.03 * (e.river - 2)) * (st === 'flank' ? 0.5 : 1); else r.def += 0.04; }
  else if (e.river && obBridged(e) && isAtt && b.day <= 2) r.att -= 0.02;
  if (e.ridge) { if (isAtt) r.att -= e.pass ? 0.04 : 0.03; else r.def += e.pass ? 0.06 : 0.03; }
  return r;
};
// volar un puente: se necesita una fuerza propia en una de las dos provincias; dura 90 días
function obBlow(tag, e) {
  if (!e.river || obOut(e) || !obBridged(e)) return {ok: false, msg: 'No hay puente que volar.'};
  const mine = G.armies.some(a => a.tag === tag && (a.loc === e.a || a.loc === e.b)); if (!mine) return {ok: false, msg: 'Necesitas un ejército propio en una de las dos orillas.'};
  const c = G.C[tag], cost = Math.max(50000, c.treasury * 0.01); if (!c.ai && c.treasury < cost) return {ok: false, msg: 'No hay fondos para los zapadores.'}; if (!c.ai) c.treasury -= cost;
  obOutMap()[obKey(e.a, e.b)] = G.date.t + 90; return {ok: true, msg: `Puente sobre el ${e.rname} volado: caído durante 90 días.`};
}
// la IA a la defensiva vuela puentes cuando su ejército se retira cruzando un río mayor
const _retreatOB = retreatArmy;
retreatArmy = function (a, b) {
  const from = a.loc; _retreatOB(a, b);
  try { const c = G.C[a.tag]; if (c && c.ai && a.loc !== from && Math.random() < 0.28) { const e = obEdge(from, a.loc); if (e && e.river >= 4 && obBridged(e)) { const r = obBlow(a.tag, e); if (r.ok && typeof logMsg === 'function') logMsg(`${c.name} vuela el puente sobre el ${e.rname}.`); } } } catch (er) { }
};
// ---- mapa «Obstáculos» ----
MAP_MODES.push({id: 'obst', name: 'Obstáculos', icon: '⛰️'});
const _stateFillOB = stateFill;
function obStateScore(s) {
  if (!OB.edges) obBuild(); if (!OB.byProv) return 0; const provs = MAP.stats[s.id].provs || []; if (!provs.length) return 0; let sc = 0, n = 0;
  provs.forEach(p => { OB.byProv[p].forEach(e => { n++; sc += e.river ? (obBridged(e) ? 0.35 : 0.4 + 0.1 * e.river) : 0; sc += e.ridge ? (e.pass ? 0.5 : 1.0) : 0; }); n += 1; });
  return clamp(sc / Math.max(2, provs.length), 0, 3);
}
stateFill = function (s) {
  if (R.mode === 'obst') { const k = clamp(obStateScore(s) / 2.2, 0, 1); return [Math.round(60 + 190 * k), Math.round(170 - 110 * k), Math.round(90 - 40 * k), 0.78]; }
  return _stateFillOB(s);
};
// ---- paneles ----
function obLine(e, fromId, btn) {
  const nm = id => MAP.provs[id].name, other = e.a === fromId ? e.b : e.a, tags = [];
  if (e.river) tags.push(`🌊 ${e.rname} (orden ${e.river}) · ${obOut(e) ? '<b class="bad">puente caído</b>' : obBridged(e) ? 'con puente' : '<b class="warn">sin puente</b>'}`);
  if (e.ridge) tags.push(e.pass ? `⛰️ Paso de montaña (${Math.round(e.elev)} m)` : `⛰️ Cordillera (${Math.round(e.elev)} m)`);
  const can = btn && e.river && obBridged(e) && G.armies.some(a => a.tag === G.player && (a.loc === e.a || a.loc === e.b));
  return `<div class="kv sm"><span>→ ${nm(other)}</span><span>${tags.join(' · ')}${can ? ` <button data-act="obblow" data-k="${obKey(e.a, e.b)}" data-tip="Volar el puente: caído 90 días">💥</button>` : ''}</span></div>`;
}
const _renderStatePanelOB = renderStatePanel;
renderStatePanel = function () {
  _renderStatePanelOB(); try {
    const root = $('#statepanel'); if (!root || UI.sel === null || UI.sel < 0 || !root.classList.contains('open')) return; obBuild(); if (!OB.byProv) return;
    const provs = MAP.stats[UI.sel].provs || [], seen = new Set(), lines = [];
    provs.forEach(p => OB.byProv[p].forEach(e => { const k = obKey(e.a, e.b); if (seen.has(k) || lines.length > 12) return; seen.add(k); lines.push(obLine(e, provs.includes(e.a) ? e.a : e.b, true)); }));
    const season = obSeason(MAP.provs[provs[0]] ? MAP.provs[provs[0]].lat : 40), sn = season === 'invierno' ? '❄️ Invierno: ríos helados, pasos nevados.' : season === 'deshielo' ? '🌧️ Deshielo: ríos crecidos.' : '';
    if (!lines.length) return;
    root.insertAdjacentHTML('beforeend', `<div class="card"><h3>🌊 Obstáculos de las fronteras</h3>${lines.join('')}${sn ? `<small class="dim">${sn}</small>` : ''}<small class="dim" style="display:block">Cruzar un río sin puente o una cordillera alarga la marcha y debilita el primer asalto.</small></div>`);
  } catch (e) { console.warn('obstáculos', e); }
};
const _renderArmyPanelOB = renderArmyPanel;
renderArmyPanel = function () {
  _renderArmyPanelOB(); try {
    const root = $('#armypanel'); const a = UI.selArmy ? armyById(UI.selArmy) : null; if (!root || !a || !a.path || !a.path.length || !root.classList.contains('open')) return; obBuild();
    const out = []; let prev = a.loc; a.path.slice(0, 14).forEach(p => { const e = obEdge(prev, p); if (e) out.push(obLine(e, prev, true)); prev = p; });
    if (!out.length) return;
    root.insertAdjacentHTML('beforeend', `<div class="card"><h3>🧭 Obstáculos en la ruta</h3>${out.join('')}</div>`);
  } catch (e) { console.warn('obstáculos ruta', e); }
};
Object.assign(ACT, {obblow: d => { obBuild(); const e = OB.edges.get(+d.k); if (!e) return; const r = obBlow(G.player, e); toast(r.ok ? '💥' : '⚠️', r.msg); if (r.ok) renderStatePanel(); }});
