/* ===== VISTA DE SOLDADO, FASE 2 (v3): CONTROL MANUAL EN PRIMERA PERSONA =====
   Dentro de la vista de soldado (soldado3d.js), C (o «🎮 Tomar el control») hace que el soldado lo maneje el jugador, por defecto en PRIMERA PERSONA:
     ratón: mirar y apuntar (se captura el puntero al entrar; si el navegador no lo permite, arrastrar el ratón) · clic izquierdo o Espacio: disparar · clic derecho: apuntar con
     precisión (zoom, menos dispersión) · W A S D: mover · Mayús: correr · Z: rodillas · F: estandarte (cerca del centro de tu regimiento) · V: primera/tercera persona ·
     Tab o C: volver a observar · Esc o X: salir.
   · LIBRE: el soldado ya no está atado a su regimiento: puede ir a cualquier parte del campo. Su velocidad es la de las tropas en el combate (marcha 14 u/s, carrera 30 u/s,
     frente a los 32 u/s del avance de un regimiento) y se mueve con el tiempo del combate: al entrar se baja la velocidad a ×0,25 para que sea jugable (se restaura al salir).
   · APUNTAR: el disparo sale de la mira: un rayo 3D desde la cámara contra la cápsula de cada soldado enemigo (cabeza = baja segura; cuerpo = baja con 70 %, herido con 30 %), con
     oclusión del terreno, dispersión según movimiento/postura/zoom y trazadora. Los soldados abatidos se quedan en el suelo con su animación de caída (hacia atrás, adelante,
     de rodillas o de costado según de dónde venga el disparo), y los heridos se agarran la herida antes de caer.
   · PRIMERA PERSONA: cámara a la altura de los ojos con balanceo al andar, retroceso al disparar, zoom al apuntar, y el cuerpo gira con retardo respecto de la cámara con
     pasos de giro. Se ven tus brazos y el fusil animados (apuntar, disparar, recargar).
   · TROPAS LIBRES: los soldados a menos de 260 unidades de la cámara dejan de ir clavados a la formación: deambulan por su hueco, dan pasos, se cubren; los enemigos a < 110 te ven,
     se te acercan hasta 18 unidades, te encaran, apuntan y te disparan cada 5–8 s (cada disparo puede acertarte; menos de rodillas o corriendo).
   EFECTOS EN LA BATALLA (pequeños y con tope): 14 hombres menos al regimiento enemigo por impacto (30 impactos como máximo por batalla), +0,004 de moral propia por impacto;
   el estandarte sube 0,006/s la moral del regimiento si estás a < 40 unidades de él y, si el abanderado cae, el regimiento pierde 0,12. */
const CK = {w: 0, a: 0, s: 0, d: 0, shift: 0, space: 0, fire: 0, ads: 0};
const CTRL_RELOAD = {A: 3.2, B: 2.6, C: 2.0, D: 1.6, E: 1.0}, HERO_MEN = 14, HERO_CAP = 30, CTRL_WALK = 2.4, CTRL_RUN = 6.5, CTRL_KNEEL = 1.1, CTRL_SLOW = 0.1;
const angLerp = (a, b, k) => { const d = ((b - a + Math.PI) % (2 * Math.PI) + 3 * Math.PI) % (2 * Math.PI) - Math.PI; return a + d * k; };
SOLD.vis = new Map(); SOLD.visNew = new Map(); SOLD.shots = []; SOLD.shotNew = []; SOLD.suppress = null;
const IDLE_VAR = ['mirar_alrededor', 'vigilar', 'senal', 'hablar', 'fumar', 'beber', 'atarse_bota', 'recolocar_mochila', 'estirarse', 'idle_preparado'];
const ctrlFireClip = era => era === 'A' ? 'disparar_A' : era === 'B' ? 'disparar_B' : 'disparar_D';
// ¿hay que ocultar esta figura? (el hueco del soldado seguido o un soldado abatido)
function b3Hid(bid, fi, j) {
  if (B3.hide && B3.hide.bid === bid && B3.hide.fi === fi && B3.hide.j === j) return true;
  const V = R.bviz; return !!(V && V.kmap && V.kmap[bid + ':' + fi + ':' + j]);
}
// ---- viewmodel de primera persona (soldado v5): brazos y arma en un segundo pase ----
function ctrlVM(me, era) {
  const T = window.Troops3D; if (!T || !T.TroopViewmodel) return null; const key = me.tag + '|' + era; if (SOLD.vm && SOLD.vmKey === key) return SOLD.vm;
  try { if (SOLD.vm) SOLD.vm.dispose(); SOLD.vm = new T.TroopViewmodel({nation: me.tag, era, rol: era === 'E' && /^(USA|AUL|CAN)$/.test(me.tag) ? 'semi' : 'fusil', skin: 0}); SOLD.vmKey = key; SOLD.vm.on(ev => { if (ev === 'fuego') SOLD.vmFire = performance.now(); }); }
  catch (e) { console.warn('viewmodel', e); SOLD.vm = null; } return SOLD.vm;
}
function ctrlVMStep(c, rdt, era) {
  const vm = SOLD.vm; if (!vm || !SOLD.fp) return; const name = vm.curName, ctl = n => vm.clipInfo(n);
  if (SOLD.lookDx || SOLD.lookDy) { vm.look(SOLD.lookDx, SOLD.lookDy); SOLD.lookDx = SOLD.lookDy = 0; }
  if (c.dead) { if (name !== 'muerte_vm') vm.play('muerte_vm'); vm.update(rdt, {}); return; }
  if (c.ads && !c.vmAds) { vm.play('ads_entrada', {next: 'ads_vm'}); } else if (!c.ads && c.vmAds) { vm.play('ads_salida'); } c.vmAds = c.ads;
  const free = ['idle_vm', 'marcha_vm', 'carrera_vm'].includes(vm.curName);
  if (free && !c.ads) { const want = c.mv ? (c.run ? 'carrera_vm' : 'marcha_vm') : 'idle_vm'; if (vm.curName !== want) vm.play(want, {blend: 0.2}); }
  if (vm.curName === 'idle_vm' && c.cd > 0 && !c.reloaded) { c.reloaded = true; const inf = ctl('recargar_vm'); c.vmSpeed = inf ? Math.max(1, inf.dur / (CTRL_RELOAD[era] || 1.6)) : 1; vm.play('recargar_vm', {next: 'idle_vm'}); }
  if (c.cd <= 0) c.reloaded = false;
  vm.update(rdt * (vm.curName === 'recargar_vm' ? (c.vmSpeed || 1) : 1), {mover: c.mv ? (c.run ? 1 : 0.6) : 0, agachado: c.kneel});
}
function ctrlLockEl() { return document.querySelector('canvas[width="1920"]'); }
function ctrlStart() {
  const V = R.bviz, blk = soldBlock(V); if (!SOLD.on || !blk || !B3.S) return; const f = blk.figs.find(q => q.i === SOLD.fi); if (!f) return; const w = soldWorld(B3.S, blk, f, SOLD.j), now = performance.now();
  if (blk.type === 'cav') { toast('🎮', 'El control manual solo está disponible para infantería. Elige un soldado de a pie (tecla R).'); return; }
  SOLD.ctrl = {x: w.x, z: w.z, hd: blk.hd, cyaw: blk.hd, pitch: 0, kick: 0, kneel: false, flag: false, cd: 0, fireT: -99, clip: 'idle', clipT: null, shots: 0, hits: 0, kills: 0, dead: false, deadAt: 0, lt: now, mv: false, run: false, t: 0, hitT: -9, oldTs: V.ts};
  SOLD.fp = true; SOLD.lookDx = SOLD.lookDy = 0; if (ctrlVM(blk, t3Era())) SOLD.vm.play('idle_vm', {blend: 0}); V.ts = (V.ts === undefined || V.ts > 0.3) ? CTRL_SLOW : V.ts;           // el combate se ralentiza para poder jugar
  try { renderBattlePanel(); } catch (e) { }
  toast('🎮', 'Control en primera persona: haz clic en el campo para capturar el ratón (apuntas con él; clic dispara, clic derecho apunta con precisión) · WASD mueve · Mayús corre · Z rodillas · F estandarte · Tab observar');
}
function ctrlExit(why) {
  const c = SOLD.ctrl; if (!c) return; SOLD.ctrl = null; SOLD.yaw = 0; const V = R.bviz; if (V && c.oldTs !== undefined) V.ts = c.oldTs; else if (V) delete V.ts;
  if (c.oldTs === undefined && V && V.ts === CTRL_SLOW) delete V.ts;
  try { if (document.pointerLockElement) document.exitPointerLock(); } catch (e) { }
  if (B3.S) { B3.S.cam.fov = 40; B3.S.cam.near = 2; B3.S.cam.updateProjectionMatrix(); B3.S.scene.onAfterRender = function () { }; }
  B3.hide = SOLD.fp ? {bid: SOLD.bid, fi: SOLD.fi, j: SOLD.j} : null; Object.keys(CK).forEach(k => { CK[k] = 0; });
  if (why === 'dead') { const blk = soldBlock(V); if (blk) { const sl = soldSlots(blk); if (sl.length) soldSet(blk); else { const nb = soldPick(V, 'next'); if (!(nb && soldSet(nb))) soldStop(); } } toast('💀', `Tu soldado ha caído (${c.kills} bajas, ${c.hits} impactos, ${c.shots} disparos). Sigues con otro soldado del regimiento.`); }
  try { renderBattlePanel(); } catch (e) { }
}
// ---- disparo del jugador: rayo 3D desde la mira ----
function ctrlRay(S, O, D, maxT) {
  const V = R.bviz; let best = null;
  SOLD.vis.forEach((p, key) => {
    if (V.kmap && V.kmap[key]) return; const gy = b3H(S.tf, p.x, p.z), ay = gy + 0.15, L = 2.75;
    const wx = O.x - p.x, wy = O.y - ay, wz = O.z - p.z, b = D.y, d = D.x * wx + D.y * wy + D.z * wz, e = wy, den = 1 - b * b; if (den < 1e-4) return;
    let t = (b * e - d) / den, sS = (e - b * d) / den; sS = clamp(sS, 0, L); t = D.x * (p.x - O.x) + D.y * (ay + sS - O.y) + D.z * (p.z - O.z); if (t < 1 || t > maxT) return;
    const qx = O.x + D.x * t - p.x, qy = O.y + D.y * t - (ay + sS), qz = O.z + D.z * t - p.z; if (Math.hypot(qx, qy, qz) > 0.85) return;
    if (best && t >= best.t) return;
    for (let u = 6; u < t; u += 6) { if (b3H(S.tf, O.x + D.x * u, O.z + D.z * u) > O.y + D.y * u) return; }          // el terreno tapa el disparo
    best = {t, p, key, head: sS > 2.0, ay: ay + sS};
  });
  if (best) { const cb = covBlock(S, O.x, O.y, O.z, best.p.x, best.ay, best.p.z); if (cb) return {blocked: cb, t: cb.t * best.t, x: cb.x, y: cb.y, z: cb.z}; }
  return best;
}
function ctrlFire(S, V, blk, O, D) {
  const c = SOLD.ctrl, era = t3Era(), tU = performance.now() / 1000; c.cd = CTRL_RELOAD[era] || 1.6; c.fireT = tU; c.shots++; c.kick = 0.07;
  const spread = (c.ads ? 0.004 : 0.016) * (c.mv ? (c.run ? 3 : 1.8) : 1) * (c.kneel ? 0.6 : 1); let dx = D.x + (Math.random() - 0.5) * spread, dy = D.y + (Math.random() - 0.5) * spread, dz = D.z + (Math.random() - 0.5) * spread; const L = Math.hypot(dx, dy, dz); dx /= L; dy /= L; dz /= L;
  const DD = {x: dx, y: dy, z: dz}, mx = O.x + dx * 2.2, mz = O.z + dz * 2.2;
  if (SOLD.vm && SOLD.fp) { SOLD.vm.play(c.ads ? 'disparar_ads_vm' : 'disparar_vm', {next: c.ads ? 'ads_vm' : 'idle_vm'}); c.reloaded = false; }
  fxFlash(O.x + dx * 2.6, O.y + dy * 2.6 - 0.4, O.z + dz * 2.6, 0.09); bvPart(V, {k: 'smoke', x: O.x + dx * 30 - dz * 3, y: O.z + dz * 30 + dx * 3, life: 1.1});          // el humo se forma más adelante para no tapar la mira
  const hit = ctrlRay(S, O, DD, 260), tEnd = hit ? hit.t : 200;
  for (let i = 1; i <= 7; i++) { const u = tEnd * i / 7; fxFlash(O.x + dx * u, O.y + dy * u, O.z + dz * u, 0.04 + i * 0.012); }          // trazadora
  SOLD.suppress = {x: hit && hit.p ? hit.p.x : O.x + dx * 120, z: hit && hit.p ? hit.p.z : O.z + dz * 120, t: tU};          // los soldados cercanos al disparo se ponen a cubierto
  if (hit && hit.blocked) { bvPart(V, {k: 'spark', x: hit.x, y: hit.z, life: 0.4, hot: true}); bvPart(V, {k: 'dust', x: hit.x, y: hit.z, life: 0.8}); return; }
  if (!hit) { const gx = O.x + dx * 120, gz = O.z + dz * 120; bvPart(V, {k: 'dust', x: gx, y: gz, life: 0.8}); return; }
  c.hits++; c.hitT = tU; const p = hit.p, blkE = p.blk;
  const kill = hit.head || Math.random() < 0.7, front = (Math.sin(p.yaw) * dx + Math.cos(p.yaw) * dz) < 0, side = (Math.cos(p.yaw) * dz - Math.sin(p.yaw) * dx), r = Math.random();
  V.kmap = V.kmap || {}; V.klist = V.klist || [];
  if (V.klist.length > 500) { const old = V.klist.shift(); delete V.kmap[old.key]; }
  const dClip = hit.head ? (front ? (r < 0.3 ? 'muerte_giro' : 'muerte_atras_pie') : 'muerte_adelante') : front ? (r < 0.4 ? 'muerte_atras_pie' : r < 0.6 ? 'muerte_rodillas' : r < 0.8 ? 'muerte_muro' : 'muerte_atras_rodilla') : Math.abs(side) > 0.45 ? (side > 0 ? 'muerte_costado_de' : 'muerte_costado_iz') : (r < 0.5 ? 'muerte_adelante' : 'muerte_rodillas_adelante');
  const T3 = window.Troops3D, inf = T3 && T3.clipInfo ? T3.clipInfo('fusilero', dClip) : null;
  const e = {key: hit.key, x: p.x, z: p.z, yaw: p.yaw, tag: blkE.tag, era, wound: !kill, t0: tU, clip: kill ? dClip : 'herido_grave', dClip, dur: inf && inf.dur ? inf.dur : 2, corpse: 'cuerpo_inerte_' + dClip.replace(/^muerte_/, '')};
  V.kmap[hit.key] = e; V.klist.push(e); if (kill) c.kills++;
  bvPart(V, {k: 'spark', x: p.x, y: p.z, life: 0.5, hot: true}); bvPart(V, {k: 'dust', x: p.x, y: p.z, life: 0.7});
  V.heroHits = (V.heroHits || 0) + 1;
  if (V.heroHits <= HERO_CAP) { blkE.d.s = Math.max(0.02, blkE.d.s - HERO_MEN / MEN_PER_DIV); blk.mm = Math.min(1, (blk.mm !== undefined ? blk.mm : 0.8) + 0.004); }
}
function ctrlStep(S, V, blk, dt) {
  const c = SOLD.ctrl, now = performance.now(), rdt = clamp((now - c.lt) / 1000, 0, 0.1), tU = now / 1000; c.lt = now; c.t += rdt; c.cd = Math.max(0, c.cd - rdt); c.kick *= Math.exp(-rdt * 9);
  SOLD.vis = SOLD.visNew; SOLD.visNew = new Map();
  if (c.dead) { if (now - c.deadAt > 2600) { ctrlExit('dead'); return null; } ctrlVMStep(c, rdt, t3Era()); return {x: c.x, z: c.z, dead: true}; }
  const f = (CK.w ? 1 : 0) - (CK.s ? 1 : 0), r = (CK.d ? 1 : 0) - (CK.a ? 1 : 0), aim = c.cyaw; c.mv = !!(f || r); c.run = !!(CK.shift && c.mv && !c.kneel); c.ads = !!CK.ads;
  // velocidades reales (u/s ≈ 0,6 m/s por unidad): marcha 2,4 (1,4 m/s), carrera 6,5 (3,9 m/s), de rodillas 1,1; atrás ×0,7 y de lado ×0,85; apuntando ×0,5
  if (c.mv) { const sp = (c.kneel ? CTRL_KNEEL : c.run ? CTRL_RUN : CTRL_WALK) * (c.ads ? 0.5 : 1) * (f < 0 ? 0.7 : (!f && r ? 0.85 : 1)); let vx = Math.cos(aim) * f - Math.sin(aim) * r, vz = Math.sin(aim) * f + Math.cos(aim) * r; const L = Math.hypot(vx, vz) || 1; c.x += vx / L * sp * rdt; c.z += vz / L * sp * rdt; c.face = Math.atan2(vz, vx); }
  { const q = covPush(S, c.x, c.z, 0.9); c.x = q[0]; c.z = q[1]; }
  c.x = clamp(c.x, 6, BV_W - 6); c.z = clamp(c.z, 6, BV_H - 6);
  c.peek = c.kneel && (CK.ads || tU - c.fireT < 0.8);                                   // de rodillas detrás de una cobertura solo asomas la cabeza al apuntar o disparar
  c.head = c.kneel ? (c.peek ? 2.3 : 1.45) : 2.55;
  // el cuerpo gira con retardo respecto de la cámara (en primera persona la cámara manda)
  const diff = Math.abs(((aim - c.hd + Math.PI) % (2 * Math.PI) + 3 * Math.PI) % (2 * Math.PI) - Math.PI);
  c.turn = !c.mv && diff > 0.5; c.hd = angLerp(c.hd, (c.mv && !SOLD.fp) ? c.face : aim, Math.min(1, rdt * (CK.fire || CK.space ? 14 : 5)));
  const O = S.cam.position, cp = Math.cos(c.pitch + c.kick);
  if ((CK.space || CK.fire) && c.cd <= 0) ctrlFire(S, V, blk, {x: O.x, y: O.y, z: O.z}, {x: Math.cos(aim) * cp, y: Math.sin(c.pitch + c.kick), z: Math.sin(aim) * cp});
  if (c.flag && Math.hypot(c.x - blk.x, c.z - blk.y) < 40) blk.mm = Math.min(1, (blk.mm !== undefined ? blk.mm : 0.8) + 0.006 * rdt);
  // los soldados abatidos heridos acaban cayendo
  if (V.klist) V.klist.forEach(e => { if (e.wound && tU - e.t0 > 3) { e.wound = false; e.clip = e.dClip === 'muerte_adelante' ? 'muerte_costado_iz' : e.dClip; e.t0 = tU; } else if (!e.wound && !e.still && tU - e.t0 > e.dur + 0.4) { e.still = true; e.clip = e.corpse; } });
  // disparos de los soldados enemigos (cada soldado dispara una vez cada varios segundos: ver npc_combate.js); una cobertura entre el tirador y tú los detiene
  const era = t3Era(); let died = false; const gyP = b3H(S.tf, c.x, c.z); SOLD.shots = SOLD.shotNew; SOLD.shotNew = [];
  SOLD.shots.forEach(sh => { if (died) return;
    const ty = gyP + c.head * 0.85, blkd = covBlock(S, sh.x, sh.y, sh.z, c.x, ty, c.z), brg = Math.atan2(sh.z - c.z, sh.x - c.x);
    fxFlash(sh.x, sh.y - 0.2, sh.z, 0.1); for (let i = 1; i <= 5; i++) { const ex = blkd ? blkd.x : c.x, ez = blkd ? blkd.z : c.z, ey = blkd ? blkd.y : ty; fxFlash(sh.x + (ex - sh.x) * i / 6, sh.y + (ey - sh.y) * i / 6, sh.z + (ez - sh.z) * i / 6, 0.04 + i * 0.012); }
    if (blkd) { bvPart(V, {k: 'spark', x: blkd.x, y: blkd.z, life: 0.4, hot: true}); bvPart(V, {k: 'dust', x: blkd.x, y: blkd.z, life: 0.7}); c.coverT = tU; c.hurt = {ang: brg, t: tU, blk: true}; c.kick += 0.012; return; }
    c.hurt = {ang: brg, t: tU, blk: false}; c.kick += 0.02;
    const pHit = clamp(0.03 - sh.dd / 6000, 0.006, 0.03) * (c.kneel ? (c.peek ? 0.8 : 0.5) : 1) * (c.run ? 0.75 : 1) * (c.flag ? 1.5 : 1); if (Math.random() < pHit) died = true; });
  if (died) { c.dead = true; c.deadAt = now; c.clip = 'muerte_adelante'; c.clipT = tU; if (c.flag) { blk.mm = Math.max(0, (blk.mm !== undefined ? blk.mm : 0.8) - 0.12); c.flag = false; } }
  else {
    const since = tU - c.fireT, fc = ctrlFireClip(era);
    if (since < 0.8) { c.clip = c.kneel ? 'disparar_rodilla_A' : fc; c.clipT = c.fireT; } else if (since < 2.2 && c.cd > 0 && !c.mv) { c.clip = 'recargar_pie_' + era; c.clipT = c.fireT + 0.8; }
    else if (CK.ads || CK.fire) { c.clip = 'apuntar'; c.clipT = null; } else if (c.kneel) { c.clip = 'agacharse'; c.clipT = null; } else if (c.mv) { c.clip = c.run ? 'marcha_rapida' : 'marcha'; c.clipT = null; }
    else if (c.turn) { c.clip = 'marcha'; c.clipT = null; } else if (c.flag) { c.clip = 'ondear'; c.clipT = null; } else { c.clip = 'idle'; c.clipT = null; }
  }
  ctrlVMStep(c, rdt, era);
  return {x: c.x, z: c.z};
}
// cámara del modo control (primera o tercera persona), con balanceo, retroceso y zoom
function ctrlCam(S, ov) {
  const c = SOLD.ctrl, cam = S.cam, gy = b3H(S.tf, ov.x, ov.z), yaw = c.cyaw, pit = clamp(c.pitch + c.kick, -1.35, 1.35), cp = Math.cos(pit), fx = Math.cos(yaw) * cp, fy = Math.sin(pit), fz = Math.sin(yaw) * cp;
  const bob = c.mv ? Math.sin(c.t * (c.run ? 13 : 8)) * (c.run ? 0.09 : 0.05) : Math.sin(c.t * 1.6) * 0.012;
  if (ov.dead) { const k = Math.min(1, (performance.now() - c.deadAt) / 700); cam.position.set(ov.x, gy + 2.55 - k * 2.0, ov.z); cam.lookAt(ov.x + Math.cos(yaw) * 5, gy + 0.4, ov.z + Math.sin(yaw) * 5); cam.fov = 40; cam.near = 0.3; return; }
  const eye = c.head || 2.5;
  if (SOLD.fp) { const px = ov.x + Math.cos(yaw) * 0.12, pz = ov.z + Math.sin(yaw) * 0.12, vm = SOLD.vm; cam.position.set(px, Math.max(gy + eye + bob, b3H(S.tf, px, pz) + 1.2), pz); cam.lookAt(px + fx * 30, cam.position.y + fy * 30, pz + fz * 30); cam.near = 0.12;
    if (vm) { const D2R = Math.PI / 180, co = vm.camOut; cam.rotateX(co.rx * D2R); cam.rotateY(co.ry * D2R); cam.rotateZ(co.rz * D2R); cam.fov = 42 * co.fov; S.scene.onAfterRender = (r, sc, cm) => { try { vm.render(r, cm); } catch (e) { S.scene.onAfterRender = function () { }; console.warn('viewmodel', e); } }; } else { cam.fov = c.ads ? 22 : 42; S.scene.onAfterRender = function () { }; } }
  else { S.scene.onAfterRender = function () { }; const d = 6.5, bx = ov.x - Math.cos(yaw) * d - Math.sin(yaw) * 1.3, bz = ov.z - Math.sin(yaw) * d + Math.cos(yaw) * 1.3, by = Math.max(b3H(S.tf, bx, bz) + 1.2, gy + 3.4 + fy * -3); cam.position.set(bx, by, bz); cam.lookAt(ov.x + fx * 25, gy + 2.4 + fy * 25, ov.z + fz * 25); cam.fov = c.ads ? 30 : 42; cam.near = 0.5; }
}
// figuras que dibuja el modo control: el soldado manejado y los abatidos (una vez por fotograma, en la primera llamada a b3Fig)
const _b3FigC = b3Fig;
b3Fig = function (S, V, blk, f, era, tU, cp, ca) {
  _b3FigC(S, V, blk, f, era, tU, cp, ca);
  if (SOLD._drawT === tU || (!SOLD.on && !(V.klist && V.klist.length))) return; SOLD._drawT = tU; const me = SOLD.on ? soldBlock(V) : null;
  const draw = (set, x, z, yaw, clip, start, tag) => { const y = b3H(S.tf, x, z); _b3o.phase = 0.37; _b3o.h = 0; _b3o.bright = 0.5; _b3o.skin = 1; _b3o.horse = 0; _b3o.start = start; _b3o.tread = 0; try { set.add(Math.hypot(x - ca.x, y - ca.y, z - ca.z), x, y, z, yaw, B3_S, tag, clip, _b3o); } catch (e) { set.add(Math.hypot(x - ca.x, y - ca.y, z - ca.z), x, y, z, yaw, B3_S, tag, 'idle', _b3o); } b3Sh(S, x, y, z, 1.05); };
  if (V.klist) V.klist.forEach(e => { const set = b3Set(S, 'fusilero', e.era, e.tag, null); draw(set, e.x, e.z, e.yaw, e.clip, e.wound ? null : e.t0, e.tag); });
  const c = SOLD.on && SOLD.ctrl; if (c && me && !SOLD.fp) draw(b3Set(S, 'fusilero', era, me.tag, null), c.x, c.z, Math.PI / 2 - c.hd, c.clip, c.clipT, me.tag);
};
// entradas: teclado y ratón
const CKMAP = {w: 'w', a: 'a', s: 's', d: 'd', arrowup: 'w', arrowleft: 'a', arrowdown: 's', arrowright: 'd', ' ': 'space', shift: 'shift'};
document.addEventListener('keydown', e => {
  if (!SOLD.on || e.ctrlKey || e.metaKey || e.altKey || /input|select|textarea/i.test((e.target && e.target.tagName) || '')) return; const k = e.key.toLowerCase();
  if (!SOLD.ctrl) { if (k === 'c') { e.preventDefault(); e.stopPropagation(); ctrlStart(); } return; }
  const c = SOLD.ctrl, V = R.bviz; let used = true;
  if (CKMAP[k]) CK[CKMAP[k]] = 1;
  else if (k === 'z') { if (!c.dead) c.kneel = !c.kneel; }
  else if (k === 'f') { if (!c.dead) { const b = soldBlock(V); if (b && Math.hypot(c.x - b.x, c.z - b.y) < 30) { c.flag = !c.flag; toast('🚩', c.flag ? 'Llevas el estandarte: mientras estés cerca de tu regimiento, su moral sube.' : 'Sueltas el estandarte.'); } else toast('🚩', 'Acércate al centro de tu regimiento (30 unidades) para coger el estandarte.'); } }
  else if (k === 'v') { SOLD.fp = !SOLD.fp; }
  else if (k === 'tab' || k === 'c') ctrlExit();
  else used = false;
  if (used) { e.preventDefault(); e.stopPropagation(); }
}, true);
document.addEventListener('keyup', e => { const k = e.key.toLowerCase(); if (CKMAP[k]) CK[CKMAP[k]] = 0; }, true);
window.addEventListener('blur', () => { Object.keys(CK).forEach(k => { CK[k] = 0; }); });
document.addEventListener('mousemove', e => { const c = SOLD.on && SOLD.ctrl; if (!c || !document.pointerLockElement) return; SOLD.lookDx = (SOLD.lookDx || 0) + e.movementX; SOLD.lookDy = (SOLD.lookDy || 0) + e.movementY; c.cyaw += e.movementX * 0.0022 * (c.ads ? 0.45 : 1); c.pitch = clamp(c.pitch - e.movementY * 0.0022 * (c.ads ? 0.45 : 1), -1.3, 1.3); }, true);
document.addEventListener('mousedown', e => { if (!(SOLD.on && SOLD.ctrl) || !document.pointerLockElement) return; if (e.button === 0) CK.fire = 1; else if (e.button === 2) CK.ads = 1; e.stopPropagation(); e.preventDefault(); }, true);
document.addEventListener('mouseup', e => { if (!(SOLD.on && SOLD.ctrl)) return; if (e.button === 0) CK.fire = 0; else if (e.button === 2) CK.ads = 0; }, true);
document.addEventListener('contextmenu', e => { if (SOLD.on && SOLD.ctrl) e.preventDefault(); }, true);
document.addEventListener('click', e => { if (SOLD.on && SOLD.ctrl && !document.pointerLockElement && e.target === ctrlLockEl()) { try { ctrlLockEl().requestPointerLock(); } catch (er) { } } }, true);
window.addEventListener('blur', () => { try { document.exitPointerLock(); } catch (e) { } });
// HUD del modo control
const _b3FrameC = b3Frame;
b3Frame = function (V, b, g, lines, all) {
  _b3FrameC(V, b, g, lines, all); const c = SOLD.on && SOLD.ctrl; if (!c) return; const blk = soldBlock(V); const rel = CTRL_RELOAD[t3Era()] || 1.6, tU = performance.now() / 1000;
  g.save(); g.textAlign = 'left'; g.fillStyle = 'rgba(8,12,16,.78)'; g.fillRect(BV_W - 380, BV_H - 150, 370, 128); g.fillStyle = '#f2e6bf'; g.font = '600 18px sans-serif'; g.fillText(c.dead ? '💀 Has caído' : '🎮 Control del soldado', BV_W - 368, BV_H - 124);
  g.font = '16px sans-serif'; g.fillStyle = '#d9d2bc'; g.fillText(`🎯 Impactos ${c.hits} · bajas ${c.kills} · disparos ${c.shots}${V.heroHits >= HERO_CAP ? ' (tope)' : ''}`, BV_W - 368, BV_H - 98);
  g.fillText(`${c.kneel ? '🧎 De rodillas' : c.run ? '🏃 Corriendo' : '🚶 En pie'}${c.flag ? ' · 🚩 Abanderado' : ''} · combate ×${(V.ts === undefined ? 1 : V.ts)}`, BV_W - 368, BV_H - 74);
  g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(BV_W - 368, BV_H - 58, 346, 10); g.fillStyle = c.cd > 0 ? '#c9a45c' : '#79c35a'; g.fillRect(BV_W - 368, BV_H - 58, 346 * (1 - c.cd / rel), 10);
  if (blk && blk.mm !== undefined) { g.fillStyle = '#d9d2bc'; g.font = '14px sans-serif'; g.fillText(`Moral del regimiento ${Math.round(blk.mm * 100)} %`, BV_W - 368, BV_H - 34); }
  g.fillStyle = 'rgba(8,12,16,.75)'; g.fillRect(8, BV_H - 62, 1010, 26); g.fillStyle = '#d9d2bc'; g.font = '16px sans-serif'; g.fillText(document.pointerLockElement ? 'Ratón: apuntar · clic: disparar · clic dcho.: mira · WASD · Mayús: correr · Z: rodillas · F: estandarte · V: vista · Tab: observar · Esc: soltar ratón' : 'Haz clic en el campo para capturar el ratón (o arrastra para mirar) · Espacio: disparar · WASD · Z · F · Tab: observar', 14, BV_H - 44);
  if (c.hurt && tU - c.hurt.t < 1.2) { const rel = c.hurt.ang - c.cyaw, R0 = 330, k = 1 - (tU - c.hurt.t) / 1.2; g.save(); g.translate(BV_W / 2 + Math.sin(rel) * R0, BV_H / 2 - Math.cos(rel) * R0 * 0.8); g.rotate(rel); g.fillStyle = c.hurt.blk ? `rgba(255,220,120,${0.55 * k})` : `rgba(255,50,40,${0.8 * k})`; g.beginPath(); g.moveTo(0, -26); g.lineTo(-22, 20); g.lineTo(22, 20); g.closePath(); g.fill(); g.restore(); }
  if (tU - (c.coverT || -9) < 1.4) { g.fillStyle = 'rgba(8,12,16,.78)'; g.fillRect(BV_W / 2 - 190, BV_H - 210, 380, 30); g.fillStyle = '#f2e6bf'; g.font = '600 18px sans-serif'; g.textAlign = 'center'; g.fillText('🛡️ La cobertura detiene el disparo', BV_W / 2, BV_H - 189); g.textAlign = 'left'; }
  if (!c.dead) { const cx = BV_W / 2, cy = BV_H / 2, hit = tU - c.hitT < 0.25, gap = c.ads ? 4 : 9 + (c.mv ? 6 : 0); g.strokeStyle = hit ? '#ff5a4a' : 'rgba(255,255,255,.8)'; g.lineWidth = 2; g.beginPath(); [[-1, 0], [1, 0], [0, -1], [0, 1]].forEach(([dx, dy]) => { g.moveTo(cx + dx * gap, cy + dy * gap); g.lineTo(cx + dx * (gap + 9), cy + dy * (gap + 9)); }); g.stroke(); if (hit) { g.beginPath(); g.moveTo(cx - 11, cy - 11); g.lineTo(cx + 11, cy + 11); g.moveTo(cx + 11, cy - 11); g.lineTo(cx - 11, cy + 11); g.stroke(); } }
  g.restore();
};
const ctrlBtn = () => SOLD.on ? `<button data-act="soldctrl" class="${SOLD.ctrl ? 'on' : ''}" data-tip="<b>Tomar el control del soldado</b><br>Primera persona: ratón apunta, clic dispara, clic derecho mira con precisión, WASD mueve, Mayús corre, Z rodillas, F estandarte. El combate se ralentiza a ×0,25. Tus impactos ayudan un poco a tu regimiento; si caes, vuelves a la vista de observador.">🎮 ${SOLD.ctrl ? 'Dejar el control' : 'Tomar el control'}</button>` : '';
ACT.soldctrl = () => { if (SOLD.ctrl) ctrlExit(); else ctrlStart(); };
