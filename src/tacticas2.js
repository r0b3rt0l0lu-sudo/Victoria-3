/* ===== TÁCTICAS Y REALISMO EN LOS COMBATES NAVALES Y AÉREOS =====
   NAVAL: cada flota tiene una táctica (f.tac): línea de batalla · ataque cerrado · mantener la distancia · ataque con torpedos · romper el contacto. El combate (navalBattle) tiene en cuenta:
     · CONDICIONES del día (despejado, bruma, tormenta, noche), con radar (Radar, era 4) como ventaja en bruma y de noche; los portaaviones casi no operan con tormenta o de noche;
     · torpedos de destructores y submarinos contra buques grandes (más con ataque con torpedos y de noche), escoltas que protegen y cazan submarinos (antisubmarina);
     · impactos críticos e incendios (daño continuado) y polvorines que explotan en buques grandes muy dañados;
     · la retirada: quien rompe el contacto recibe poco daño si no le alcanzan (depende de la velocidad) y vuelve a puerto; el almirante amplifica la táctica.
   AÉREO: cada escuadrón tiene táctica: cazas = barrido · escolta · intercepción; bombarderos = vuelo alto · bajo · nocturno. Los combates tienen condiciones (nubes, tormenta, noche), radar de los defensores,
     fuego antiaéreo (flak) contra los bombarderos y escolta que protege a los bombarderos de su bando en la región.
   La IA elige táctica según su situación; el jugador la cambia en Ejército (Marina / Aviación) y durante el combate en el panel de batalla. */
const NTAC = {
  standard: {n: 'Línea de batalla', i: '⚖️', d: 'Combate equilibrado a distancia media.', att: 1, rec: 1},
  aggressive: {n: 'Ataque cerrado', i: '🔥', d: 'Acortas distancia: +25% de daño propio y +20% de daño recibido; los destructores y submarinos tienen más opciones de lanzar torpedos.', att: 1.25, rec: 1.2},
  distance: {n: 'Mantener la distancia', i: '🔭', d: 'Combate a larga distancia: −15% de daño recibido y propio. Pierde eficacia con bruma, tormenta o de noche sin radar y contra quien cierra.', att: 0.88, rec: 0.85},
  torpedo: {n: 'Ataque con torpedos', i: '🎯', d: 'Destructores y submarinos lanzan torpedos contra los buques grandes: mucho daño, pero necesitan escoltas vivas del enemigo en menor número. De noche es letal.', att: 0.95, rec: 1.1},
  evade: {n: 'Romper el contacto', i: '🏳️', d: 'Intentas escapar: casi no disparas y recibes poco daño si los barcos enemigos no son más rápidos. Vuelves a puerto.', att: 0.3, rec: 0.55}
};
const NCOND = {clear: {n: 'Despejado', i: '☀️'}, haze: {n: 'Bruma', i: '🌫️'}, storm: {n: 'Tormenta', i: '⛈️'}, night: {n: 'Noche', i: '🌙'}};
const NAV_BIG = {ironclad: 1, dread: 1, bb: 1, carrier: 1, cruiser: 0.6};
const hashD = (a, b, c) => { let h = (a * 374761393 + b * 668265263 + c * 1274126177) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };
function navCond(z, day) { const r = hashD(z + 11, G.date.y * 372 + G.date.m * 31 + G.date.d, 7 + (day || 0)); return r < 0.52 ? 'clear' : r < 0.74 ? 'haze' : r < 0.86 ? 'storm' : 'night'; }
const hasRadar = tag => G.C[tag] && hasTech(G.C[tag], 'radar');
function tacOf(fleets) { let best = null, bp = -1; fleets.forEach(f => { const p = fleetPower(f, 'att'); if (p > bp) { bp = p; best = f; } }); return (best && best.tac) || 'standard'; }
const tcShipsOf = fl => [].concat(...fl.map(f => f.ships));
const countT = (ships, types) => ships.filter(s => types.includes(s.t)).length;
function ntacSelect(f) { return `<select data-act="fltac" data-id="${f.id}" data-tip="<b>Táctica en combate</b><br>${Object.keys(NTAC).map(k => NTAC[k].i + ' ' + NTAC[k].n + ': ' + NTAC[k].d).join('<br>').replace(/"/g, '&quot;')}">${Object.keys(NTAC).map(k => `<option value="${k}" ${(f.tac || 'standard') === k ? 'selected' : ''}>${NTAC[k].i} ${NTAC[k].n}</option>`).join('')}</select>`; }
Object.assign(ACT, {
  fltac: (d, el) => { const f = mx().fl.find(x => x.id === +d.id); if (f && el) { f.tac = el.value; toast(NTAC[f.tac].i, `${f.name}: ${NTAC[f.tac].n}.`); } if (typeof renderNavalPanel === 'function' && UI.nb !== null && UI.nb !== undefined) renderNavalPanel(); renderWindow(); },
  nvtac: d => { const z = UI.nb; if (z === null || z === undefined) return; mx().fl.forEach(f => { if (f.tag === G.player && f.zone === z && !f.tr && (G.mx.nb[z] || {}).last !== undefined) f.tac = d.t; }); toast(NTAC[d.t].i, `Táctica de tus flotas: ${NTAC[d.t].n}.`); renderNavalPanel(); }
});
/* ---------- el combate naval ---------- */
navalBattle = function (z, a, fa, pa, b, fb, pb) {
  const day = (mx().nb && mx().nb[z] ? mx().nb[z].day : 0) + 1, cond = navCond(z, Math.floor(day / 3)), SA = tcShipsOf(fa), SB = tcShipsOf(fb), tA = tacOf(fa), tB = tacOf(fb), ra = hasRadar(a), rb = hasRadar(b), log = [];
  { const M0 = mx(); fa.concat(fb).forEach(f => f.ships.forEach(s => { if (!s.id) s.id = M0.nsid = (M0.nsid || 0) + 1; })); }
  const admK = fl => 1 + 0.03 * ((fl.reduce((n, f) => Math.max(n, f.adm.lvl), 1)) - 1);
  // eficacia de cada bando
  const eff = (own, ownTag, ownT, foeT, foeRadar, ownRadar, fl, foeShips) => {
    let att = NTAC[ownT].att, rec = NTAC[ownT].rec; const adm = admK(fl);
    if (cond === 'haze') { if (ownT === 'distance') att *= ownRadar ? 1 : 0.8; att *= ownRadar && !foeRadar ? 1.12 : 1; }
    if (cond === 'storm') att *= 0.8;
    if (cond === 'night') { att *= ownRadar ? (foeRadar ? 0.95 : 1.2) : (foeRadar ? 0.7 : 0.85); if (ownT === 'distance' && !ownRadar) att *= 0.8; }
    const bigOwn = countT(own, ['bb', 'dread', 'ironclad']), bigFoe = countT(foeShips, ['bb', 'dread', 'ironclad']);
    if (ownT === 'distance' && bigOwn > bigFoe) { att *= 1.12; rec *= 0.9; }                       // más artillería pesada: la distancia favorece
    if (ownT === 'aggressive' && cond !== 'haze' && bigFoe > bigOwn + 1 && foeT !== 'torpedo') { rec *= 1.1; }
    if (ownT === 'aggressive' && (cond === 'haze' || cond === 'night') && !foeRadar) { att *= 1.1; rec *= 0.95; }       // cerrar con mala visibilidad sorprende
    if (ownT === 'distance' && foeT === 'aggressive') { rec = 1; att *= 0.85; }                       // el que cierra anula la ventaja de la distancia
    if (ownT === 'aggressive' && foeT === 'distance') { rec *= 1.1; }                               // pero paga por acercarse
    att *= adm; if (ownT !== 'standard') { att = 1 + (att - 1) * adm; rec = 1 + (rec - 1) / adm; }
    return {att, rec};
  };
  const eA = eff(SA, a, tA, tB, rb, ra, fa, SB), eB = eff(SB, b, tB, tA, ra, rb, fb, SA);
  // portaaviones: sin operaciones aéreas con tormenta o de noche
  const carrierK = cond === 'storm' ? 0.3 : cond === 'night' ? 0.35 : cond === 'haze' ? 0.8 : 1;
  const powAdj = (fl, k) => fl.reduce((n, f) => n + f.ships.reduce((m, s) => m + shipPow(s, 'att') * (s.t === 'carrier' ? carrierK : 1), 0) * (1 + 0.04 * ((f.adm && f.adm.lvl) || 1) - 0.04) * (1 + docMod(f.tag, 'nav')), 0) * k;
  const paA = powAdj(fa, eA.att), pbB = powAdj(fb, eB.att);
  // torpedos y antisubmarina
  const torpPow = (S, T, tac, foeTacArg) => { const dd = countT(S, ['destroyer']), sb = countT(S, ['sub']); const base = (dd * 0.8 + sb * 1.1) * (foeTacArg === 'distance' ? 0.5 : foeTacArg === 'evade' ? 0.4 : 1); const m = tac === 'torpedo' ? 1 : tac === 'aggressive' ? 0.5 : tac === 'standard' ? 0.25 : tac === 'distance' ? 0.1 : 0; return base * m * (cond === 'night' ? 1.3 : cond === 'storm' ? 0.4 : cond === 'haze' ? 1 : 0.9); };
  const escortsOf = S => countT(S, ['destroyer', 'cruiser']);
  const torpA = torpPow(SA, SB, tA, tB), torpB = torpPow(SB, SA, tB, tA);
  // daño
  const defA = fa.reduce((n, f) => n + fleetPower(f, 'def'), 0), defB = fb.reduce((n, f) => n + fleetPower(f, 'def'), 0), M = mx();
  let torpHitsA = 0, torpHitsB = 0, fires = 0;
  const speedOf = fl => { let s = 9; fl.forEach(f => f.ships.forEach(x => { s = Math.min(s, SHIP_TYPES[x.t].spd); })); return s === 9 ? 1 : s; };
  const hit = (fleets, foeAtt, ownDef, tag, e, foeTac, foeFleets, torpPower, foeEsc, ownEsc, evading, catchP) => {
    let sunk = 0, torpHits = 0; const foeRadarOwn = hasRadar(tag);
    fleets.forEach(f => f.ships = f.ships.filter(s => {
      const T = SHIP_TYPES[s.t]; let rec = e.rec; if (evading) rec = Math.random() < catchP ? NTAC.evade.rec : 0.2;
      let k = clamp(0.05 * foeAtt / Math.max(10, ownDef) * (6 / (6 + T.def)) * (0.7 + Math.random() * 0.6) * (1 - docMod(tag, 'navdef')) * rec, 0, 0.26);
      // torpedos contra buques grandes (los escoltas del bando atacado reducen la probabilidad)
      if (torpPower > 0 && NAV_BIG[s.t] && s.t !== 'cruiser') { const p = clamp(0.085 * torpPower / (1 + ownEsc * 0.55), 0, 0.6); if (Math.random() < p) { const dmg = 0.18 + Math.random() * 0.3; k += dmg; torpHits++; } }
      // impactos críticos: incendio y, en buques grandes casi destruidos, polvorín
      if (k > 0.015 && Math.random() < (NAV_BIG[s.t] ? 0.05 : 0.03) * (foeTac === 'aggressive' ? 1.5 : 1)) { s.fire = 3 + Math.floor(Math.random() * 3); fires++; k += 0.05; if (NAV_BIG[s.t] && s.hp - k < 0.3 && Math.random() < 0.18) k += 1; }
      s.hp -= k; if (s.hp <= 0.04) { sunk++; return false; } return true; }));
    return {sunk, torpHits};
  };
  // antisubmarina: los destructores del enemigo cazan submarinos
  const asw = (S, foeS, tag) => { const dd = countT(foeS, ['destroyer']); let lost = 0; if (dd) S.forEach(s => { if (s.t === 'sub' && Math.random() < clamp(0.012 * dd * (cond === 'night' ? 0.6 : cond === 'storm' ? 0.5 : 1), 0, 0.2)) { s.hp = -1; lost++; } }); if (lost) { shipsOfFleets(tag).forEach(f => { f.ships = f.ships.filter(s => s.hp > 0); }); } return lost; };
  const shipsOfFleets = tag => (tag === a ? fa : fb);
  // incendios en curso
  let burned = 0; SA.concat(SB).forEach(s => { if (s.fire > 0) { s.fire--; s.hp -= 0.04 * (SHIP_TYPES[s.t].def > 10 ? 0.8 : 1.3); burned++; if (s.fire === 0 && Math.random() < 0.25) s.hp = Math.min(1, s.hp + 0.06); } });
  fa.forEach(f => { f.ships = f.ships.filter(s => s.hp > 0.04); }); fb.forEach(f => { f.ships = f.ships.filter(s => s.hp > 0.04); });
  const evA = tA === 'evade', evB = tB === 'evade', catchA = clamp(0.45 + (speedOf(fb) - speedOf(fa)) * 0.5, 0.1, 0.9), catchB = clamp(0.45 + (speedOf(fa) - speedOf(fb)) * 0.5, 0.1, 0.9);
  const subLostA = asw(SA, SB, a), subLostB = asw(SB, SA, b);
  const rB = hit(fb, paA, defB, b, eB, tA, fa, torpA, escortsOf(SA), escortsOf(SB), evB, catchB), rA = hit(fa, pbB, defA, a, eA, tB, fb, torpB, escortsOf(SB), escortsOf(SA), evA, catchA);
  const sb = rB.sunk + subLostB, sa = rA.sunk + subLostA; torpHitsA = rB.torpHits; torpHitsB = rA.torpHits;
  nbRecord(z, a, fa, b, fb, sa, sb, paA, pbB);
  const rec = M.nb[z]; rec.cond = cond; rec.tacA = tA; rec.tacB = tB; rec.torpA = (rec.torpA || 0) + torpHitsA; rec.torpB = (rec.torpB || 0) + torpHitsB; rec.fires = (rec.fires || 0) + fires; rec.radarA = ra; rec.radarB = rb;
  if (torpHitsA) log.push(`${G.C[a].name} acierta ${torpHitsA} torpedo${torpHitsA > 1 ? 's' : ''}`); if (torpHitsB) log.push(`${G.C[b].name} acierta ${torpHitsB} torpedo${torpHitsB > 1 ? 's' : ''}`);
  if (subLostA + subLostB) log.push(`Antisubmarina: ${subLostA + subLostB} submarino${subLostA + subLostB > 1 ? 's' : ''} hundido${subLostA + subLostB > 1 ? 's' : ''}`); if (fires) log.push(`${fires} buque${fires > 1 ? 's' : ''} se incendia${fires > 1 ? 'n' : ''}`);
  rec.log.unshift(`${NCOND[cond].i} ${NCOND[cond].n} · ${NTAC[tA].i} ${NTAC[tA].n} contra ${NTAC[tB].i} ${NTAC[tB].n}${log.length ? ' · ' + log.join(' · ') : ''}`); if (rec.log.length > 12) rec.log.length = 12;
  if (sa) xpGain(b, 'navy', sa * 1.2); if (sb) xpGain(a, 'navy', sb * 1.2); xpGain(a, 'navy', 0.05); xpGain(b, 'navy', 0.05);
  fa.concat(fb).forEach(f => { f.adm.xp += 0.5; });
  const B = mx(); B.nlog = B.nlog || []; if (sa + sb > 0) { B.nlog.unshift({z, a, b, sa, sb, date: dateStr ? dateStr() : ''}); if (B.nlog.length > 12) B.nlog.length = 12; if (a === G.player || b === G.player) notify('war', `Batalla naval en ${SEA_ZONES[z].name} (${NCOND[cond].n.toLowerCase()}): ${G.C[a].name} pierde ${sa} buques, ${G.C[b].name} pierde ${sb}.`); }
  // retirada: la flota muy dañada, inferior o que rompió el contacto vuelve a puerto
  [[fa, paA, pbB, evA], [fb, pbB, paA, evB]].forEach(([fl, own, foe, ev]) => fl.forEach(f => { if (!f.ships.length) return; const avg = f.ships.reduce((n, s) => n + s.hp, 0) / f.ships.length; if (avg < 0.4 || own < foe * 0.35 || ev) { const c = G.C[f.tag]; const hz = mainPortZone(c); if (hz !== null && hz !== f.zone) { fleetMove(f, hz); f.mission = 'port'; f.target = null; } else f.mission = 'port'; } }));
};
// la IA elige táctica según su situación (cada semana)
const _navalAIT = navalAI;
navalAI = function (c) {
  _navalAIT(c);
  fleetsOf(c.tag).forEach(f => {
    if (f.tr || !f.ships.length) return; const foe = zonePower(c.tag, f.zone, 'foe'), own = fleetPower(f, 'att'), S = f.ships, dd = countT(S, ['destroyer', 'sub']), big = countT(S, ['dread', 'bb', 'ironclad', 'carrier']), r = hasRadar(c.tag);
    let t = 'standard'; if (foe > 0) { if (own < foe * 0.55) t = 'evade'; else if (dd >= 4 && dd >= big) t = 'torpedo'; else if (big >= 2 && r) t = 'distance'; else if (own > foe * 1.6) t = 'aggressive'; else if (big >= 3) t = 'distance'; } f.tac = t;
  });
};
// visor 2D/3D: condiciones y tácticas en el escenario
const _nvSyncT = nvSync;
nvSync = function (V, r) {
  _nvSyncT(V, r);
  ['A', 'B'].forEach(side => { const tac = side === 'A' ? r.tacA : r.tacB; if (!tac) return; const dir = side === 'A' ? 1 : -1; V.ships.forEach(s => { if (s.side !== side || s.sink >= 0 || s.tx === undefined) return; let dx = 0;
    if (tac === 'aggressive') dx = 95; else if (tac === 'distance') dx = -85; else if (tac === 'evade') dx = -260; else if (tac === 'torpedo') dx = (s.t === 'destroyer' || s.t === 'sub') ? 130 : -20;
    s.tx += dir * dx; }); });
};
/* ---------- efectos 3D: condición del día, torpedos ---------- */
const _n3BuildT = n3Build;
n3Build = function (V) {
  const S = _n3BuildT(V), r = G.mx && G.mx.nb && G.mx.nb[V.z]; const c = r && r.cond; S.cond = c || 'clear';
  if (c === 'night') { S.scene.background = new THREE.Color(0x0b1220); S.scene.fog = new THREE.Fog(0x0b1220, 200, 1100); S.sun.intensity = 0.18; S.sun.color.setHex(0x8fa8d8); S.scene.traverse(o => { if (o.isAmbientLight) o.intensity = 0.28; if (o.isHemisphereLight) o.intensity = 0.2; }); S.sea.material.color.setHex(0x0f2a3c); }
  else if (c === 'haze') { S.scene.background = new THREE.Color(0xbfc6c9); S.scene.fog = new THREE.Fog(0xbfc6c9, 120, 900); }
  else if (c === 'storm') { S.scene.background = new THREE.Color(0x58626a); S.scene.fog = new THREE.Fog(0x58626a, 200, 1300); S.sun.intensity = 0.35; S.sea.material.color.setHex(0x24424f); }
  S.torps = []; return S;
};
const _n3WaveT = n3Wave;
n3Wave = function (x, z, t) { const k = N3.S && N3.S.cond === 'storm' ? 2.3 : N3.S && N3.S.cond === 'haze' ? 0.8 : 1; return _n3WaveT(x, z, t) * k; };
const _n3PartsT = n3Parts;
n3Parts = function (S, V, dt) {
  const P = S.P; (S.torps || []).forEach(t => { t.age += dt; const q = t.age / t.life; if (q >= 1) { if (!t.done) { t.done = 1; if (t.hit) { S.parts.push({k: 'boom', x: t.x1, y: 4, z: t.z1, life: 0.7, age: 0}); for (let i = 0; i < 3; i++) S.parts.push({k: 'smoke', x: t.x1, y: 4, z: t.z1, vx: (Math.random() - .5) * 4, vy: 7, vz: (Math.random() - .5) * 4, dark: 1, life: 3, age: 0}); for (let i = 0; i < 9; i++) S.parts.push({k: 'splash', x: t.x1, y: 0.5, z: t.z1, vx: (Math.random() - .5) * 8, vy: 18 + Math.random() * 14, vz: (Math.random() - .5) * 8, life: 1, age: 0}); } } return; }
    t.x = t.x0 + (t.x1 - t.x0) * q; t.z = t.z0 + (t.z1 - t.z0) * q; b3Push(P.shell, t.x, 0.6, t.z, 0.9, 0.95, 1, 1); for (let i = 1; i < 7; i++) b3Push(P.splash, t.x - (t.x1 - t.x0) / (t.life * 60) * i * 3, 0.4, t.z - (t.z1 - t.z0) / (t.life * 60) * i * 3, 1, 1, 1, 0.55 - i * 0.07); });
  S.torps = (S.torps || []).filter(t => !t.done); _n3PartsT(S, V, dt);
};
// lanzamiento de torpedos en el visor 3D (destructores y submarinos del bando que usa «torpedos»)
const _nv3DrawT = nv3Draw;
nv3Draw = function (S, V, ships, dt, t) {
  _nv3DrawT(S, V, ships, dt, t); const r = G.mx && G.mx.nb && G.mx.nb[V.z]; if (!r || !S.nv) return; const now = performance.now() / 1000;
  ships.forEach(s => { const kind = nv3KindOf(s); if (s.sink >= 0 || (kind !== 'destructor' && kind !== 'submarino')) return; const tac = s.side === 'A' ? r.tacA : r.tacB; if (tac !== 'torpedo' && !(tac === 'aggressive' && Math.random() < 0.3)) return; const st = S.nv.st.get(s.id); if (!st || now - (st.torpT || -99) < 7 + (s.id % 5) || Math.random() > dt * 0.4) return;
    const foes = [...V.ships.values()].filter(o => o.side !== s.side && o.sink < 0 && (NAV_BIG[o.t] || o.t === 'cruiser')); if (!foes.length) return; const tg = foes[Math.floor(Math.random() * foes.length)], [x0, z0] = n3W(s.x, s.y), [x1, z1] = n3W(tg.x, tg.y); st.torpT = now; st.fireT0 = now;
    for (let k = 0; k < 2; k++) S.torps.push({x0: x0, z0: z0 + (k - 0.5) * 18, x1: x1 + (Math.random() - .5) * 30, z1: z1 + (Math.random() - .5) * 24, x: x0, z: z0, age: 0, life: Math.hypot(x1 - x0, z1 - z0) / 70, hit: Math.random() < 0.45}); });
};
/* ---------- panel naval: táctica en pleno combate ---------- */
const _renderNavalPanelT = renderNavalPanel;
renderNavalPanel = function () {
  _renderNavalPanelT(); const root = document.getElementById('navalpanel'), z = UI.nb; if (!root || !root.classList.contains('open') || z === null || z === undefined) return; const r = G.mx.nb[z]; if (!r) return;
  const mine = G.mx.fl.filter(f => f.tag === G.player && f.zone === z && !f.tr && f.ships.length); let box = root.querySelector('#nv-tac'); if (!box) { box = document.createElement('div'); box.id = 'nv-tac'; root.querySelector('#nv-st').after(box); }
  const cur = mine[0] && (mine[0].tac || 'standard');
  box.innerHTML = `<div class="card"><h3>${NCOND[r.cond || 'clear'].i} ${NCOND[r.cond || 'clear'].n}${r.radarA || r.radarB ? ' · 📡 radar' : ''} <small class="dim">${r.torpA || r.torpB ? `· torpedos acertados ${r.torpA || 0}/${r.torpB || 0}` : ''}${r.fires ? ` · incendios ${r.fires}` : ''}</small></h3>${mine.length ? `<div class="btnrow">${Object.keys(NTAC).map(k => `<button data-act="nvtac" data-t="${k}" class="${cur === k ? 'on' : ''}" data-tip="${escA(NTAC[k].d)}">${NTAC[k].i} ${NTAC[k].n}</button>`).join('')}</div>` : '<small class="dim">No tienes flotas en esta batalla.</small>'}</div>`;
};
/* ===================== AIRE ===================== */
const ATAC = {
  sweep: {n: 'Barrido', i: '🦅', d: 'Cazas en busca de caza enemigo: +15% de poder y de bajas propias; no protegen bien a los bombarderos.', f: true},
  escort: {n: 'Escolta', i: '🛡️', d: 'Cazas pegados a los bombarderos: reducen un 25% las bajas de los bombarderos de tu bando en la región, a costa de menos derribos.', f: true},
  intercept: {n: 'Intercepción', i: '🛰️', d: 'Cazas a la espera sobre territorio propio: más eficaces defendiendo (+25%), poco útiles fuera. El radar les da aviso temprano.', f: true},
  high: {n: 'Vuelo alto', i: '⬆️', d: 'Bombarderos a gran altura: mucho menos flak (−50%) y bajas por cazas (−30%), pero menos precisión (−25% de daño).', b: true},
  low: {n: 'Vuelo bajo', i: '⬇️', d: 'Bombarderos a baja cota: más precisión (+30% de daño), pero mucho más flak (+80%) y más bajas por cazas.', b: true},
  night: {n: 'Nocturno', i: '🌙', d: 'Incursión de noche: los cazas apenas los ven (−50% de bajas) pero se bombardea con peor precisión (−35%). El radar enemigo anula la ventaja.', b: true}
};
const ACOND = {clear: {n: 'Despejado', i: '☀️'}, cloud: {n: 'Nubes', i: '☁️'}, storm: {n: 'Tormenta', i: '⛈️'}, night: {n: 'Noche', i: '🌙'}};
const airDef = s => s.type === 'fighter' ? (s.mission === 'intc' ? 'intercept' : s.mission === 'cas' ? 'escort' : 'sweep') : (s.mission === 'cas' ? 'low' : 'high');
const airTacOf = s => { const t = s.tac && ATAC[s.tac] && ((s.type === 'fighter') === !!ATAC[s.tac].f) ? s.tac : airDef(s); return t; };
function airCond(reg) { const r = hashD(reg + 5, G.date.y * 372 + G.date.m * 31 + G.date.d, 13); return r < 0.55 ? 'clear' : r < 0.78 ? 'cloud' : r < 0.88 ? 'storm' : 'night'; }
function airOwnRegion(s, reg) { const sts = airReg(reg).states; if (!sts.length) return 0; return sts.filter(id => { const o = G.S[id].owner; return o === s.tag || sameSide(s.tag, o); }).length / sts.length; }
function airTacPow(s) { const t = airTacOf(s); if (t === 'sweep') return 1.15; if (t === 'intercept') return 0.95 + 0.3 * airOwnRegion(s, s.reg); if (t === 'escort') return 0.92; if (t === 'high') return 0.9; if (t === 'low') return 1.1; if (t === 'night') return 0.9; return 1; }
const radarSide = (tag, reg) => { let r = false; mx().sq.forEach(q => { if (q.reg === reg && q.n > 0 && hostileTags(tag, q.tag) && hasRadar(q.tag)) r = true; }); return r || G.mx.sq.some(q => q.reg === reg && hostileTags(tag, q.tag) && hasRadar(q.tag)); };
function airTacExposed(s, reg) {                                                          // multiplicador de las bajas del escuadrón
  const t = airTacOf(s), cond = airCond(reg), foeRadar = radarSide(s.tag, reg); let m = 1;
  if (s.type === 'bomber') {
    if (t === 'high') m *= 0.7; else if (t === 'low') m *= 1.35; else if (t === 'night') m *= foeRadar ? 1.15 : 0.5;
    const esc = mx().sq.some(q => q.reg === reg && q.n > 0 && q.type === 'fighter' && (q.tag === s.tag || sameSide(s.tag, q.tag)) && airTacOf(q) === 'escort'); if (esc) m *= 0.75;
    if (cond === 'night' && t !== 'night') m *= 0.8; if (cond === 'storm') m *= 0.8;
  } else { if (t === 'sweep') m *= 1.15; if (t === 'escort') m *= 1.1; if (cond === 'night') m *= 0.7; if (cond === 'storm') m *= 0.85; if (foeRadar) m *= 1.12; }
  return m;
}
function airBombK(s, reg) { const t = airTacOf(s), cond = airCond(reg); let m = t === 'high' ? 0.75 : t === 'low' ? 1.3 : t === 'night' ? 0.65 : 1; if (cond === 'cloud') m *= 0.8; else if (cond === 'storm') m *= 0.3; else if (cond === 'night' && t !== 'night') m *= 0.7; if (hasRadar(s.tag) && (t === 'night' || cond === 'night' || cond === 'cloud')) m *= 1.25; return m; }
function airFlak(s, reg, states) {                                                        // fuego antiaéreo sobre los bombarderos que atacan estados enemigos
  if (s.n < 4) return; const t = airTacOf(s), def = states.length ? G.C[G.S[states[0]].owner] : null; if (!def) return;
  let f = 0.0035 * (1 + (hasRadar(def.tag) ? 0.5 : 0) + (hasTech(def, 'quick_firing') ? 0.25 : 0) + clamp(def.stats.indLevels / 120, 0, 0.5)); f *= t === 'high' ? 0.5 : t === 'low' ? 1.8 : t === 'night' ? 0.6 : 1; f *= airCond(reg) === 'storm' ? 0.5 : 1;
  const lost = Math.min(s.n, Math.floor(s.n * f + Math.random())); if (lost > 0) { s.n -= lost; s.lost = (s.lost || 0) + lost; const A = mx().ab && mx().ab[reg]; if (A) { if (s.tag === A.a) A.lossA += lost; else if (s.tag === A.b) A.lossB += lost; A.flak = (A.flak || 0) + lost; } }
}
function atacSelect(s) { const list = Object.keys(ATAC).filter(k => (s.type === 'fighter') === !!ATAC[k].f); return `<select data-act="sqtac" data-id="${s.id}" data-tip="${escA(list.map(k => ATAC[k].i + ' ' + ATAC[k].n + ': ' + ATAC[k].d).join('<br>'))}">${list.map(k => `<option value="${k}" ${airTacOf(s) === k ? 'selected' : ''}>${ATAC[k].i} ${ATAC[k].n}</option>`).join('')}</select>`; }
Object.assign(ACT, {
  sqtac: (d, el) => { const s = mx().sq.find(x => x.id === +d.id); if (s && el) { s.tac = el.value; toast(ATAC[s.tac].i, `Escuadrón #${s.id}: ${ATAC[s.tac].n}.`); } renderWindow(); if (document.getElementById('airpanel') && document.getElementById('airpanel').classList.contains('open')) renderAirPanel(); },
  avtac: d => { mx().sq.forEach(s => { if (s.tag === G.player && s.reg === AV.ab && ((s.type === 'fighter') === !!ATAC[d.t].f)) s.tac = d.t; }); toast(ATAC[d.t].i, `Tus ${ATAC[d.t].f ? 'cazas' : 'bombarderos'} cambian a: ${ATAC[d.t].n}.`); renderAirPanel(); }
});
// pestaña de Aviación: tácticas y condiciones
const _aviationHtmlT = aviationHtml;
aviationHtml = function () {
  const h = _aviationHtmlT(), mine = mx().sq.filter(s => s.tag === G.player);
  if (!mine.length) return h;
  return h + `<div class="card"><h3>🎛️ Tácticas de los escuadrones</h3>${mine.map(s => `<div class="kv sm"><span>${AIR_TYPES[s.type].icon} Escuadrón #${s.id} · ${s.n} aviones <small class="dim">· ${airReg(s.reg).name.replace('Región aérea de ', '')} ${ACOND[airCond(s.reg)].i}</small></span>${atacSelect(s)}</div>`).join('')}<p class="hint">La táctica cambia las bajas y el daño de cada escuadrón. Los bombarderos sufren el fuego antiaéreo del enemigo (menos a gran altura); los cazas de escolta protegen a los bombarderos de la región. El tiempo (nubes, tormenta, noche) y el radar también cuentan.</p></div>`;
};
MX_TABS.forEach(t => { if (t.id === 'air') t.html = aviationHtml; });
// la IA ajusta sus tácticas aéreas cada semana
const _aviationAIT = aviationAI;
aviationAI = function (c) {
  _aviationAIT(c);
  mx().sq.forEach(s => { if (s.tag !== c.tag) return; const foeF = airHostileFighters(c.tag, s.reg), ownF = airFighters(c.tag, s.reg), hasEsc = mx().sq.some(q => q.tag === c.tag && q.reg === s.reg && q.type === 'bomber' && q.n > 0), r = hasRadar(c.tag);
    if (s.type === 'fighter') s.tac = hasEsc && foeF > 0 ? 'escort' : airOwnRegion(s, s.reg) > 0.5 ? 'intercept' : 'sweep';
    else s.tac = foeF > ownF * 0.9 ? (hasRadar(c.tag) && !radarSide(c.tag, s.reg) ? 'night' : 'high') : s.mission === 'cas' ? 'low' : (r ? 'night' : 'high'); });
};
// registro de combates aéreos: condiciones y tácticas
const _airDayT = airDay;
airDay = function () {
  _airDayT(); const M = mx(); if (!M.ab) return; for (const r in M.ab) { const rec = M.ab[r]; if (G.date.t - rec.last > 0) continue; rec.cond = airCond(+r); const tk = l => { const o = {}; (l || []).forEach(q => { const s = M.sq.find(x => x.id === q.id); if (s) { q.tac = airTacOf(s); } }); return o; }; tk(rec.A); tk(rec.B); rec.radarA = hasRadar(rec.a); rec.radarB = hasRadar(rec.b); }
};
// panel del combate aéreo: condiciones y tácticas en pleno combate
const _renderAirPanelT = renderAirPanel;
renderAirPanel = function () {
  _renderAirPanelT(); const root = document.getElementById('airpanel'); if (!root || !root.classList.contains('open')) return; const rec = AV.rec || (AV.ab >= 0 && G.mx.ab && G.mx.ab[AV.ab]); if (!rec) return;
  const mine = rec.demo ? [] : mx().sq.filter(s => s.tag === G.player && s.reg === AV.ab && s.n > 0), fi = mine.some(s => s.type === 'fighter'), bo = mine.some(s => s.type === 'bomber'), cur = ty => { const q = mine.find(s => s.type === ty); return q ? airTacOf(q) : ''; };
  let box = root.querySelector('#av-tac'); if (!box) { box = document.createElement('div'); box.id = 'av-tac'; root.querySelector('#av-st').after(box); }
  const cond = rec.cond || 'clear', row = (list, c) => `<div class="btnrow">${list.map(k => `<button data-act="avtac" data-t="${k}" class="${c === k ? 'on' : ''}" data-tip="${escA(ATAC[k].d)}">${ATAC[k].i} ${ATAC[k].n}</button>`).join('')}</div>`;
  box.innerHTML = `<div class="card"><h3>${ACOND[cond].i} ${ACOND[cond].n}${rec.radarA || rec.radarB ? ' · 📡 radar' : ''}${rec.flak ? ` · 🔥 flak: ${rec.flak} aviones` : ''}</h3>${rec.demo ? '<small class="dim">En el combate real podrás elegir la táctica de tus escuadrones aquí.</small>' : (fi ? '<small>Cazas</small>' + row(['sweep', 'escort', 'intercept'], cur('fighter')) : '') + (bo ? '<small>Bombarderos</small>' + row(['high', 'low', 'night'], cur('bomber')) : '') + (!fi && !bo ? '<small class="dim">No tienes escuadrones en esta región.</small>' : '')}</div>`;
};
