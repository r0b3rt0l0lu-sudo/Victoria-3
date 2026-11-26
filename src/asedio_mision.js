/* ===== MISIÓN DE ASALTO A UN FUERTE (modo soldado) =====
   Al tomar el control de un soldado en una batalla con un fuerte, reducto o batería enemigo aparece una MISIÓN con objetivos encadenados, siguiendo cómo se tomaba una plaza
   (Ciudad Rodrigo y Badajoz, 1812; el manual de artillería del siglo XIX; el asalto de la brecha con una «esperanza perdida» que rellena el foso con fajinas y escala el muro):
   1. BATERÍA DE BRECHA: servir uno de los cañones de asedio de tu unidad (E junto a la pieza). El servicio sigue el manual: ESCOBILLAR el ánima, CARGAR el cartucho de pólvora, ATACAR
      la bala con el atacador, CEBAR el oído (R mantenido en cada paso) y APUNTAR/DISPARAR (clic). Cada impacto en el muro daña el tramo (2 impactos lo abren; la puerta cede antes). La
      contrabatería del fuerte responde con sus cañones sobre tu batería. Sin cañones propios: PETARDO (P junto a la puerta; mecha de 6 s; ponte a cubierto).
   2. FAJINAS: el foso frena a quien lo cruza (×0,4): coge una fajina junto a la batería (T) y suéltala en el foso (T) para rellenarlo.
   3. ASALTO DE LA BRECHA: al abrirse brecha tus regimientos reciben la orden de asalto; entra por el hueco bajo el fuego de los defensores, que se colocan en el muro y contraatacan con bayoneta.
   4. PATIO: despeja a los defensores; 5. BANDERA: mantén F cuatro segundos junto al mástil sin enemigos cerca: el fuerte es tuyo (rendición de la guarnición, cañones capturados).
   Panel de objetivos con balizas y distancias en metros; el avance del puesto de mando (barras de moral y puntuación de la batalla) se refleja en la batalla estratégica. */
const MS = {on: false, f: null, b: null, side: 'A', foe: 'B', t0: 0, done: false, gun: null, rHeld: false, fHeld: false, shots: 0, fas: false, fasUsed: 0, petT: 0, hold: 0, inside0: 0, called: false, shellT: 0, kills0: 0, msg: [], lastBreach: false, ditchWarn: 0};
const msBlocks = V => [...V.blocks.values()];
function msBattle() { const V = R.bviz; return V ? G.battles.find(x => x.id === V.id) : null; }
function msGuns(V, side) { const out = []; msBlocks(V).forEach(k => { if (k.side === side && k.type === 'art' && k.figs) k.figs.forEach(f => { if (f.kind === 'gun' && f.alive) out.push({blk: k, fig: f, x: f.x, z: f.y}); }); }); return out; }
function msFort(V, b, side) { const l = (b.forts || []).filter(f => f.side !== side && f.hp > 0 && f.kind !== 'trench'); return l.sort((p, q) => (p.kind === 'fort' ? 0 : 1) - (q.kind === 'fort' ? 0 : 1))[0] || null; }
const _ctrlStartMS = ctrlStart;
ctrlStart = function () {
  _ctrlStartMS(); const c = SOLD.ctrl; if (!c) return; const V = R.bviz, b = msBattle(), me = soldBlock(V); MS.on = false; MS.done = false; MS.gun = null; if (!b || !me) return;
  const f = msFort(V, b, me.side); if (!f) return;
  Object.assign(MS, {on: true, f, b, side: me.side, foe: me.side === 'A' ? 'B' : 'A', t0: performance.now() / 1000, shots: 0, fas: false, fasUsed: 0, petT: 0, hold: 0, inside0: 0, called: false, shellT: 0, msg: [], lastBreach: false, kills0: c.kills || 0, noGun: msGuns(V, me.side).length === 0});
  c.petard = (typeof t3Era === 'function' && ['A', 'B', 'C'].includes(t3Era())) || MS.noGun ? 1 : 0; if (MS.noGun) c.petard = 2;
  const era = t3Era(), nm = FORT_KINDS[f.kind].n.toLowerCase();
  toast('🏰', `MISIÓN: tomar ${nm === 'fuerte' ? 'el fuerte' : 'el ' + nm} de ${G.C[f.side === 'A' ? b.A0 : b.B0].name}. Objetivos en el panel de la izquierda. ${MS.noGun ? 'Sin artillería de asedio: usa el petardo (P).' : 'E junto a un cañón de asedio de tu unidad para servirlo.'}`);
};
const _ctrlExitMS = ctrlExit; ctrlExit = function (why) { MS.gun = null; MS.on = false; _ctrlExitMS(why); };
// ---- estado de la brecha y del interior ----
function msBreach() { const f = MS.f; if (!f) return {open: false}; const gaps = f._gaps || [], open = f.hp / f.hpMax < 0.55 || gaps.length >= 2 || gaps.some(g => g.gate); const dir = f.side === 'A' ? 1 : -1;
  const g = gaps.slice().sort((p, q) => Math.abs(p.z - f.y) + (p.gate ? -30 : 0) - (Math.abs(q.z - f.y) + (q.gate ? -30 : 0)))[0]; return {open, gap: g || {x: f.x + dir * f.w / 2, z: f.y}, n: gaps.length}; }
const msInside = (f, x, z, pad) => Math.abs(x - f.x) < f.w / 2 - 1 + (pad || 0) && Math.abs(z - f.y) < f.h / 2 - 1 + (pad || 0);
function msDefenders() { const f = MS.f; let n = 0; SR2.all.forEach((p, k) => { if (p.side !== MS.side && msInside(f, p.x, p.z, 1)) n++; }); return n; }
function msNearPole(c) { const f = MS.f; return !!(MS.on && !MS.done && f && f._flag && Math.hypot(c.x - f._flag.x, c.z - f._flag.z) < 6.5 && msBreach().open); }
function msInDitch(c) { const f = MS.f; if (!f || f.kind !== 'fort' && f.kind !== 'redoubt') return false; const dx = Math.abs(c.x - f.x) - f.w / 2, dz = Math.abs(c.z - f.y) - f.h / 2, d = Math.max(dx, dz); if (d < 0.5 || d > 8 || Math.min(dx, dz) > 7.5) return false;
  const dir = f.side === 'A' ? 1 : -1; if (f.kind === 'fort' && dx > -1 && Math.abs(c.z - f.y) < 3.6 && (c.x - f.x) * dir > 0) return false; return !(f._fas || []).some(q => Math.hypot(q.x - c.x, q.z - c.z) < 5.5); }
// ---- objetivos ----
function msObjectives() {
  if (!MS.f) return [];
  const f = MS.f, br = msBreach(), c = SOLD.ctrl, out = [], guns = f && !MS.noGun ? msGuns(R.bviz, MS.side) : [], inside = c && f && msInside(f, c.x, c.z, 0);
  const near = guns.sort((p, q) => Math.hypot(p.x - c.x, p.z - c.z) - Math.hypot(q.x - c.x, q.z - c.z))[0], gate = (f._gaps || []).find(g => g.gate), dir = f.side === 'A' ? 1 : -1;
  if (!br.open) { out.push(MS.noGun ? {t: '💣 Coloca el petardo en la puerta (P) y ponte a cubierto', wp: {x: f.x + dir * f.w / 2, z: f.y}, p: 0} : {t: MS.gun ? '🔥 Abre brecha: ' + (MS.gun.step < 4 ? 'sirve la pieza (R)' : 'apunta al muro y ¡fuego!') : '🎯 Sirve un cañón de asedio de tu unidad (E)', wp: MS.gun ? null : near && {x: near.x, z: near.z}, p: clamp((f._gaps || []).length / 2 + (1 - f.hp / f.hpMax) * 0.7, 0, 1)}); }
  else { out.push({t: '✅ Brecha abierta', done: true});
    if (f.kind === 'fort' || f.kind === 'redoubt') out.push({t: '🌿 (Opcional) Rellena el foso con una fajina (T)', opt: true, done: MS.fasUsed > 0, wp: MS.fas ? {x: br.gap.x + dir * 6, z: br.gap.z} : near && {x: near.x, z: near.z}});
    out.push({t: '⚔️ Asalta la brecha', done: !!inside || MS.inside0 > 0, wp: br.gap}); }
  if (br.open) { const nd = msDefenders(); MS.inside0 = Math.max(MS.inside0, nd); out.push({t: `🪖 Despeja el patio (${nd} defensores)`, done: MS.inside0 > 2 && nd <= 2 && inside, wp: null}); out.push({t: '🚩 Iza la bandera: mantén F junto al mástil', done: MS.done, wp: f._flag}); }
  return out;
}
// ---- servicio del cañón ----
const GUN_STEPS = [['Escobillar el ánima', 'R', 0.9], ['Cargar el cartucho de pólvora', 'R', 1.0], ['Atacar la bala con el atacador', 'R', 1.3], ['Cebar el oído con el punzón', 'R', 0.9]];
function msUse(c, tU) {
  if (!MS.on || MS.done || c.dead) return false; const V = R.bviz;
  if (MS.gun) { MS.gun = null; c.busyUntil = tU + 0.3; toast('🔫', 'Dejas la pieza.'); return true; }
  const g = msGuns(V, MS.side).sort((p, q) => Math.hypot(p.x - c.x, p.z - c.z) - Math.hypot(q.x - c.x, q.z - c.z))[0];
  if (g && Math.hypot(g.x - c.x, g.z - c.z) < 7) { const yaw = g.blk.hd; MS.gun = {blk: g.blk, fig: g.fig, step: 0, p: 0, cd: 0, shots: 0, yaw, t0: tU}; c.pose = 'pie'; c.prone = false; c.kneel = false; c.cyaw = yaw; c.pitch = 0.05; toast('🔫', 'Sirves la pieza: mantén R en cada paso (escobillar, cargar, atacar, cebar) y dispara con clic.'); return true; }
  return false;
}
function msGunPos(g) { const f = g.fig, yaw = g.yaw; return {x: f.x - Math.cos(yaw) * 3.4, z: f.y - Math.sin(yaw) * 3.4}; }
function msTrace(S, O, D) {
  let px = O.x, py = O.y, pz = O.z, hit = null;
  for (let t = 4; t < 760 && !hit; t += 4) { const x = O.x + D.x * t, z = O.z + D.z * t, y = O.y + D.y * t - 0.00004 * t * t, cb = covBlock(S, px, py, pz, x, y, z); if (cb) { hit = {cb, x: cb.x, z: cb.z, y: cb.y}; break; } if (y < b3H(S.tf, x, z) + 0.3) { hit = {x, z, y: b3H(S.tf, x, z)}; break; } px = x; py = y; pz = z; }
  return hit;
}
function msAssist(S, c) { // el artillero afina la elevación (±1,6 %) si el tiro cae casi sobre el muro
  const ok = h => h && h.cb && h.cb.o.fort === MS.f.id; let h = msAimHit(S, c); if (ok(h)) return {h, pit: c.pitch};
  for (let d = 0.003; d <= 0.02; d += 0.003) for (const sg of [1, -1]) { const h2 = msAimHit(S, c, c.pitch + sg * d); if (ok(h2)) return {h: h2, pit: c.pitch + sg * d}; } return {h, pit: c.pitch};
}
function msAimHit(S, c, pitO) { const g = MS.gun; if (!g) return null; const yaw = c.cyaw, pit = pitO !== undefined ? pitO : c.pitch, D = {x: Math.cos(yaw) * Math.cos(pit), y: Math.sin(pit), z: Math.sin(yaw) * Math.cos(pit)}, gp = {x: g.fig.x, z: g.fig.y}; return msTrace(S, {x: gp.x + D.x * 2.5, y: b3H(S.tf, gp.x, gp.z) + 2.0, z: gp.z + D.z * 2.5}, D); }
function msGunFire(S, V, c, tU) {
  const g = MS.gun, f = MS.f, yaw = c.cyaw, as = msAssist(S, c), pit = as.pit, D = {x: Math.cos(yaw) * Math.cos(pit), y: Math.sin(pit), z: Math.sin(yaw) * Math.cos(pit)}, gp = {x: g.fig.x, z: g.fig.y}, O = {x: gp.x + D.x * 2.5, y: b3H(S.tf, gp.x, gp.z) + 2.0, z: gp.z + D.z * 2.5};
  g.shots++; MS.shots++; c.kick += 0.1; fxFlash(O.x + D.x * 1.5, O.y, O.z + D.z * 1.5, 0.4); for (let i = 0; i < 5; i++) bvPart(V, {k: 'smoke', x: O.x + D.x * (3 + i * 2), y: O.z + D.z * (3 + i * 2), life: 3, r: 5, vx: (V.wind || 0) * 0.5 + (Math.random() - 0.5) * 3}); try { SFX.cannon(1); } catch (e) { }
  const hit = as.h && as.h.cb ? as.h : msTrace(S, O, D);
  MS.lastHit = hit ? {yaw: +yaw.toFixed(3), pit: +pit.toFixed(3), g: [Math.round(gp.x), Math.round(gp.z)], gy: +g.yaw.toFixed(2), x: Math.round(hit.x), z: Math.round(hit.z), y: +hit.y.toFixed(1), kind: hit.cb ? hit.cb.o.kind : 'terreno', fort: hit.cb && hit.cb.o.fort, sec: hit.cb && hit.cb.o.secId} : null;
  if (!hit) return; const o = hit.cb && hit.cb.o;
  for (let i = 0; i < 9; i++) bvPart(V, {k: 'dust', x: hit.x + (Math.random() - 0.5) * 6, y: hit.z + (Math.random() - 0.5) * 6, life: 1.3}); fxFlash(hit.x, hit.y + 1, hit.z, 0.5); SR2.sup.push({x: hit.x, z: hit.z, t: tU, r: 14, side: MS.side});
  SR2.all.forEach((p, k) => { if (p.side === MS.side) return; const d = Math.hypot(p.x - hit.x, p.z - hit.z); if (d < 4.5) srKillNPC(S, V, k, p, O.x, O.z, true); else if (d < 8 && Math.random() < 0.4) srKillNPC(S, V, k, p, O.x, O.z, false); });
  if (o && o.fort === f.id && o.secId !== undefined) {
    f._hit = f._hit || {}; f._gone = f._gone || []; f._hit[o.secId] = (f._hit[o.secId] || 0) + (o.kind === 'puerta' ? 0.6 : o.kind === 'torre' ? 0.25 : 0.5); f.hp = Math.max(1, f.hp - f.hpMax * 0.012);
    if (f._hit[o.secId] >= 1 && !f._gone.includes(o.secId)) { f._gone.push(o.secId); f.hp = Math.max(1, f.hp - f.hpMax * 0.07); if (typeof srBark === 'function') srBark(MS.side, 'Artillero', '¡Brecha abierta en el muro!', hit.x, hit.z, tU); toast('💥', 'Un tramo del muro se derrumba.'); }
    b3SigTouch(MS.b);
  }
}
function msGunStep(S, V, c, tU, rdt) {
  const g = MS.gun; if (!g || c.dead) { MS.gun = null; return; } const pos = msGunPos(g); c.x = pos.x; c.z = pos.z; c.pose = 'pie'; c.mv = false; c.busyUntil = tU + 0.25; c.head = 2.5;
  const dy = ((c.cyaw - g.yaw + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI; if (Math.abs(dy) > 0.5) c.cyaw = g.yaw + Math.sign(dy) * 0.5; c.pitch = clamp(c.pitch, -0.12, 0.38);
  g.cd = Math.max(0, g.cd - rdt);
  if (g.step < 4) { const st = GUN_STEPS[g.step]; if (MS.rHeld) { g.p += rdt / st[2]; if (g.p >= 1) { g.p = 0; g.step++; } } else g.p = Math.max(0, g.p - rdt * 0.8); }
  else if ((CK.fire || CK.space) && !g.firing && g.cd <= 0) { g.firing = true; msGunFire(S, V, c, tU); g.step = 0; g.p = 0; g.cd = 1.0; } if (!CK.fire && !CK.space) g.firing = false;
  // contrabatería: el fuerte responde sobre la batería
  if (tU > MS.shellT) { MS.shellT = tU + 7 + Math.random() * 5; if (MS.f && MS.f.guns > 0) { SR2.shells.push({x: g.fig.x + (Math.random() - 0.5) * 36, z: g.fig.y + (Math.random() - 0.5) * 36, t1: tU + 1.7, side: MS.foe, era: t3Era()}); srBark(MS.side, 'Jefe de pieza', '¡Contrabatería! ¡Cubríos!', g.fig.x, g.fig.y, tU); } }
}
// ---- petardo, fajinas, bandera ----
function msPetard(c, tU) {
  if (!MS.on || MS.done || !c.petard || MS.petT) return; const f = MS.f, S = B3.S, gate = S.fortObs.find(o => o.fort === f.id && o.kind === 'puerta'); if (!gate || Math.hypot(gate.x - c.x, gate.z - c.z) > 9) { toast('💣', 'Acércate a la puerta del fuerte (menos de 9 u) para colocar el petardo.'); return; }
  c.petard--; MS.pet = {t1: tU + 6, x: gate.x, z: gate.z, id: gate.secId}; MS.petT = tU; toast('💣', 'Petardo colocado: la mecha dura 6 s. ¡Aléjate y ponte a cubierto!');
}
function msPetardStep(S, V, c, tU) {
  const p = MS.pet; if (!p) return; if (tU < p.t1) { if (Math.random() < 0.3) fxFlash(p.x, b3H(S.tf, p.x, p.z) + 1.2, p.z, 0.05); return; }
  MS.pet = null; MS.petT = 0; const f = MS.f; f._gone = f._gone || []; S.fortObs.filter(o => o.fort === f.id && o.secId !== undefined && Math.hypot(o.x - p.x, o.z - p.z) < 7.5).forEach(o => { if (!f._gone.includes(o.secId)) f._gone.push(o.secId); }); f.hp = Math.max(1, f.hp - f.hpMax * 0.18); b3SigTouch(MS.b);
  srExplode(S, V, c, {x: p.x, z: p.z, owner: 'me'}); srExplode(S, V, c, {x: p.x + 1.5, z: p.z, owner: 'me'}); toast('💥', 'La puerta salta por los aires.');
}
function msFascine(c, tU) {
  if (!MS.on || MS.done) return; const V = R.bviz, f = MS.f;
  if (!MS.fas) { const near = msGuns(V, MS.side).some(g => Math.hypot(g.x - c.x, g.z - c.z) < 14) || Math.hypot(c.x - soldBlock(V).x, c.z - soldBlock(V).y) < 20; if (near) { MS.fas = true; toast('🌿', 'Llevas una fajina (haz de ramas atadas): más lento. Suéltala en el foso con T.'); } else toast('🌿', 'Las fajinas están junto a tu batería o tu regimiento.'); return; }
  const dx = Math.abs(c.x - f.x) - f.w / 2, dz = Math.abs(c.z - f.y) - f.h / 2; if (Math.max(dx, dz) > 9 || Math.max(dx, dz) < -1) { toast('🌿', 'Suelta la fajina junto al foso, delante del muro.'); return; }
  (f._fas = f._fas || []).push({x: c.x, z: c.z}); MS.fas = false; MS.fasUsed++; b3SigTouch(MS.b); toast('🌿', 'Fajina colocada: el foso queda practicable aquí.');
}
function msCallAssault(V, b, c, tU) {
  MS.called = true; const f = MS.f, br = msBreach(), dir = f.side === 'A' ? 1 : -1, mine = msBlocks(V).filter(o => o.side === MS.side && o.type === 'inf' && o.role === 'line' && !o.garr && o.mode !== 'rout').sort((p, q) => Math.hypot(p.x - f.x, p.y - f.y) - Math.hypot(q.x - f.x, q.y - f.y)).slice(0, 4);
  mine.forEach((m, i) => { m.d.plan = {k: 'flank', pts: [[br.gap.x + dir * 16, br.gap.z + (i - 1.5) * 6], [br.gap.x - dir * 8, br.gap.z + (i - 1.5) * 5]], i: 0, fortAssault: f.id}; m.skey = ''; });
  bvBanner(V, '🪜 ¡AL ASALTO! Los regimientos avanzan hacia la brecha', MS.side, ''); srBark(MS.side, 'Coronel', '¡Al asalto, muchachos! ¡Por la brecha!', c.x, c.z, tU);
}
// ---- paso por fotograma ----
const _ctrlStepMS = ctrlStep;
ctrlStep = function (S, V, blk, dt) {
  if (!MS.on || MS.done || !SOLD.ctrl) return _ctrlStepMS(S, V, blk, dt); const c = SOLD.ctrl, tU = performance.now() / 1000, rdt = clamp(tU - (MS.lt || tU), 0, 0.1); MS.lt = tU; const f = MS.f, b = msBattle();
  if (!b || f.hp <= 0 || !(b.forts || []).includes(f) || f.side === MS.side) { if (!MS.done) { MS.done = true; MS.msg.push(f && f.side === MS.side ? '🚩 El fuerte es nuestro.' : 'La obra ya no existe.'); } return _ctrlStepMS(S, V, blk, dt); }
  const x0 = c.x, z0 = c.z; if (MS.gun) { CK.w = CK.a = CK.s = CK.d = CK.shift = 0; }
  const r = _ctrlStepMS(S, V, blk, dt); if (!r || r.dead) return r;
  if (MS.gun) { msGunStep(S, V, c, tU, rdt); r.x = c.x; r.z = c.z; } else if (!c.dead) {
    let k = 1; if (msInDitch(c)) { k = 0.4; if (tU - MS.ditchWarn > 6) { MS.ditchWarn = tU; toast('🌊', 'Foso: avanzas con dificultad. Una fajina (T) rellena el paso.'); } } if (MS.fas) k *= 0.8; if (k < 1) { c.x = x0 + (c.x - x0) * k; c.z = z0 + (c.z - z0) * k; r.x = c.x; r.z = c.z; }
  }
  const br = msBreach(); if (br.open && !MS.lastBreach) { MS.lastBreach = true; toast('🪜', 'Brecha abierta. Los regimientos reciben la orden de asalto: entra por el hueco.'); if (!MS.called) msCallAssault(V, b, c, tU); } if (MS.pet || MS.petT) msPetardStep(S, V, c, tU);
  // izar la bandera
  if (MS.fHeld && msNearPole(c) && !c.dead) { const en = [...SR2.all.values()].filter(p => p.side !== MS.side && Math.hypot(p.x - f._flag.x, p.z - f._flag.z) < 10).length; if (en > 0) { if (tU - (MS.warnT || 0) > 3) { MS.warnT = tU; toast('⚠️', 'Hay defensores junto al mástil: despéjalos primero.'); } MS.hold = 0; } else { MS.hold += rdt; if (MS.hold >= 4) msCapture(V, b, c, tU); } } else MS.hold = Math.max(0, MS.hold - rdt * 2);
  return r;
};
function msCapture(V, b, c, tU) {
  const f = MS.f, all = msBlocks(V); const men = tacForceSurrender(V, b, all, f); const old = f.side; f.side = MS.side; f.cap = true; f._capDone = true; f._assault = false; tacFortCaptured(V, b, all, f);
  const blkMine = all.filter(o => o.side === MS.side && o.type === 'inf').sort((p, q) => Math.hypot(p.x - f.x, p.y - f.y) - Math.hypot(q.x - f.x, q.y - f.y))[0]; if (blkMine) { try { tacGarrison(b, f, blkMine); } catch (e) { } }
  MS.done = true; MS.hold = 0; c.kills = c.kills || 0; const secs = Math.round(tU - MS.t0), kills = (c.kills || 0) - MS.kills0; b3SigTouch(b);
  const nm = G.C[old === 'A' ? b.A0 : b.B0].name, P = G.C[G.player]; if (P) { P.mxp = (P.mxp || 0) + 20; P.prestige += 1.5; }
  MS.msg = [`FUERTE TOMADO — ${FORT_KINDS[f.kind].n} de ${nm}`, `${Math.floor(secs / 60)} min ${secs % 60} s · ${MS.shots} disparos de asedio · ${kills} bajas enemigas · ${fmtN(men, 0)} prisioneros`, '+20 de experiencia terrestre · +1,5 de prestigio'];
  bvBanner(V, `🏴 ${MS.msg[0]}`, MS.side, ''); try { SFX.bugle(); } catch (e) { } (b.log = b.log || []).push({k: 'flank', d: b.day, t: `Un asalto en persona toma ${FORT_KINDS[f.kind].n.toLowerCase()} de ${nm}.`});
}
// ---- entradas ----
document.addEventListener('keydown', e => { if (!(SOLD.on && SOLD.ctrl && MS.on) || e.ctrlKey || e.metaKey || e.altKey) return; const k = e.key.toLowerCase(), c = SOLD.ctrl, tU = performance.now() / 1000;
  if (k === 'r') MS.rHeld = true; else if (k === 'f') MS.fHeld = true; else if (k === 't') { msFascine(c, tU); e.preventDefault(); e.stopImmediatePropagation(); } else if (k === 'p') { msPetard(c, tU); e.preventDefault(); e.stopImmediatePropagation(); } }, true);
document.addEventListener('keyup', e => { const k = e.key.toLowerCase(); if (k === 'r') MS.rHeld = false; else if (k === 'f') MS.fHeld = false; }, true);
// cámara: sin brazos ni fusil mientras se sirve la pieza
const _ctrlCamMS = ctrlCam; ctrlCam = function (S, ov) { _ctrlCamMS(S, ov); if (MS.gun) { S.scene.onAfterRender = function () { }; S.cam.fov = SOLD.ctrl && SOLD.ctrl.ads ? 30 : 38; } };
// ---- panel de objetivos y balizas ----
const _b3FrameMS = b3Frame;
b3Frame = function (V, b, g, lines, all) {
  _b3FrameMS(V, b, g, lines, all); const c = SOLD.on && SOLD.ctrl; if (!c || !MS.on || !MS.f) return; const S = B3.S, tU = performance.now() / 1000; g.save(); g.textAlign = 'left';
  const obj = msObjectives(), pw = 330, ph = 56 + obj.length * 26 + (MS.hold > 0 ? 26 : 0); g.fillStyle = 'rgba(8,12,16,.78)'; g.fillRect(14, 150, pw, ph); g.strokeStyle = 'rgba(201,164,92,.7)'; g.strokeRect(14.5, 150.5, pw, ph);
  g.fillStyle = '#e8c978'; g.font = '700 15px sans-serif'; g.fillText(MS.done ? '✔ MISIÓN CUMPLIDA' : '🏰 MISIÓN: ASALTO AL ' + FORT_KINDS[MS.f.kind].n.toUpperCase(), 24, 172);
  g.font = '14px sans-serif'; obj.forEach((o, i) => { g.fillStyle = o.done ? '#8fd18a' : o.opt ? '#b9b39c' : '#f2e6bf'; g.fillText((o.done ? '✓ ' : '• ') + o.t, 24, 198 + i * 26); if (o.p !== undefined && !o.done) { g.fillStyle = 'rgba(255,255,255,.2)'; g.fillRect(24, 204 + i * 26, 290, 5); g.fillStyle = '#d8a84a'; g.fillRect(24, 204 + i * 26, 290 * o.p, 5); } });
  if (MS.hold > 0) { const y = 198 + obj.length * 26; g.fillStyle = '#f2e6bf'; g.fillText('Izando la bandera…', 24, y); g.fillStyle = 'rgba(255,255,255,.2)'; g.fillRect(24, y + 6, 290, 6); g.fillStyle = '#79c35a'; g.fillRect(24, y + 6, 290 * MS.hold / 4, 6); }
  // balizas con distancia
  const cam = S.cam, v = new THREE.Vector3(); obj.forEach(o => { if (!o.wp || o.done) return; const y = b3H(S.tf, o.wp.x, o.wp.z) + 6; v.set(o.wp.x, y, o.wp.z).project(cam); if (v.z > 1 || v.z < -1) return; const px = clamp((v.x * 0.5 + 0.5) * BV_W, 30, BV_W - 30), py = clamp((-v.y * 0.5 + 0.5) * BV_H, 60, BV_H - 90), d = Math.round(Math.hypot(o.wp.x - c.x, o.wp.z - c.z) * 0.6);
    g.fillStyle = 'rgba(240,200,90,.9)'; g.beginPath(); g.moveTo(px, py - 12); g.lineTo(px + 9, py); g.lineTo(px, py + 12); g.lineTo(px - 9, py); g.closePath(); g.fill(); g.font = '600 13px sans-serif'; g.textAlign = 'center'; g.fillStyle = '#fff6d6'; g.fillText(d + ' m', px, py + 28); g.textAlign = 'left'; });
  // servicio del cañón
  if (MS.gun) { const ah = msAssist(S, c).h; if (ah) { const vv = new THREE.Vector3(ah.x, ah.y + 1, ah.z).project(S.cam); if (vv.z < 1 && vv.z > -1) { const ax = (vv.x * 0.5 + 0.5) * BV_W, ay = (-vv.y * 0.5 + 0.5) * BV_H, wall = ah.cb && ah.cb.o.fort === MS.f.id; g.strokeStyle = wall ? '#ff6a4a' : '#f0d070'; g.lineWidth = 2; g.beginPath(); g.arc(ax, ay, 14, 0, 6.3); g.moveTo(ax - 20, ay); g.lineTo(ax + 20, ay); g.moveTo(ax, ay - 20); g.lineTo(ax, ay + 20); g.stroke(); g.fillStyle = wall ? '#ffb09a' : '#f0e0a0'; g.font = '600 13px sans-serif'; g.textAlign = 'center'; g.fillText((wall ? 'MURO · ' : 'IMPACTO PREVISTO · ') + Math.round(Math.hypot(ah.x - MS.gun.fig.x, ah.z - MS.gun.fig.y) * 0.6) + ' m', ax, ay + 34); g.textAlign = 'left'; } } const gu = MS.gun, cx = BV_W / 2, y0 = BV_H - 200; g.fillStyle = 'rgba(8,12,16,.82)'; g.fillRect(cx - 230, y0, 460, 120); g.fillStyle = '#e8c978'; g.font = '700 16px sans-serif'; g.textAlign = 'center'; g.fillText('🔫 CAÑÓN DE ASEDIO · jefe de pieza', cx, y0 + 22);
    g.font = '14px sans-serif'; GUN_STEPS.forEach((st, i) => { g.fillStyle = i < gu.step ? '#8fd18a' : i === gu.step ? '#fff6d6' : '#8a8472'; g.fillText((i < gu.step ? '✓ ' : i === gu.step ? '▶ ' : '· ') + st[0], cx - 90 + (i % 2) * 0, y0 + 44 + i * 16); }); g.textAlign = 'left';
    if (gu.step < 4) { g.fillStyle = 'rgba(255,255,255,.2)'; g.fillRect(cx - 220, y0 + 108, 440, 8); g.fillStyle = '#d8a84a'; g.fillRect(cx - 220, y0 + 108, 440 * gu.p, 8); g.fillStyle = '#f2e6bf'; g.font = '13px sans-serif'; g.fillText('Mantén R · ' + GUN_STEPS[gu.step][0], cx - 220, y0 + 102); } else { g.fillStyle = '#ff9a7a'; g.font = '700 15px sans-serif'; g.textAlign = 'center'; g.fillText('¡APUNTA AL MURO Y DISPARA! (clic)  ·  E: dejar la pieza', cx, y0 + 108); g.textAlign = 'left'; } }
  if (MS.pet) { const left = Math.max(0, MS.pet.t1 - tU); g.fillStyle = 'rgba(8,12,16,.85)'; g.fillRect(BV_W / 2 - 150, 130, 300, 34); g.fillStyle = '#ff8a6a'; g.font = '700 18px sans-serif'; g.textAlign = 'center'; g.fillText('💣 ¡PETARDO! ' + left.toFixed(1) + ' s — ¡a cubierto!', BV_W / 2, 154); g.textAlign = 'left'; }
  if (MS.done && MS.msg.length) { g.fillStyle = 'rgba(8,12,16,.8)'; g.fillRect(BV_W / 2 - 300, BV_H / 2 - 90, 600, 120); g.fillStyle = '#e8c978'; g.font = '700 26px sans-serif'; g.textAlign = 'center'; g.fillText(MS.msg[0], BV_W / 2, BV_H / 2 - 50); g.font = '15px sans-serif'; g.fillStyle = '#f2e6bf'; g.fillText(MS.msg[1] || '', BV_W / 2, BV_H / 2 - 20); g.fillText(MS.msg[2] || '', BV_W / 2, BV_H / 2 + 6); g.textAlign = 'left'; }
  g.restore();
};
