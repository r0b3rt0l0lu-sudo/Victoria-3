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
const CTRL_RELOAD = {A: 3.2, B: 2.6, C: 2.0, D: 1.6, E: 1.0}, HERO_MEN = 14, HERO_CAP = 30, CTRL_WALK = 14, CTRL_RUN = 30, CTRL_SLOW = 0.25;
const angLerp = (a, b, k) => { const d = ((b - a + Math.PI) % (2 * Math.PI) + 3 * Math.PI) % (2 * Math.PI) - Math.PI; return a + d * k; };
SOLD.vis = new Map(); SOLD.visNew = new Map(); SOLD.shooters = []; SOLD.shootNew = [];
const ctrlFireClip = era => era === 'A' ? 'disparar_A' : era === 'B' ? 'disparar_B' : 'disparar_D';
// ¿hay que ocultar esta figura? (el hueco del soldado seguido o un soldado abatido)
function b3Hid(bid, fi, j) {
  if (B3.hide && B3.hide.bid === bid && B3.hide.fi === fi && B3.hide.j === j) return true;
  const V = R.bviz; return !!(V && V.kmap && V.kmap[bid + ':' + fi + ':' + j]);
}
function ctrlLockEl() { return document.querySelector('canvas[width="1920"]'); }
function ctrlStart() {
  const V = R.bviz, blk = soldBlock(V); if (!SOLD.on || !blk) return; const f = blk.figs.find(q => q.i === SOLD.fi); if (!f) return; const w = soldWorld(B3.S, blk, f, SOLD.j), now = performance.now();
  if (blk.type === 'cav') { toast('🎮', 'El control manual solo está disponible para infantería. Elige un soldado de a pie (tecla R).'); return; }
  SOLD.ctrl = {x: w.x, z: w.z, hd: blk.hd, cyaw: blk.hd, pitch: 0, kick: 0, kneel: false, flag: false, cd: 0, fireT: -99, clip: 'idle', clipT: null, shots: 0, hits: 0, kills: 0, dead: false, deadAt: 0, lt: now, mv: false, run: false, t: 0, hitT: -9, oldTs: V.ts};
  SOLD.fp = true; V.ts = (V.ts === undefined || V.ts > 0.3) ? CTRL_SLOW : V.ts;           // el combate se ralentiza para poder jugar
  try { renderBattlePanel(); } catch (e) { }
  toast('🎮', 'Control en primera persona: haz clic en el campo para capturar el ratón (apuntas con él; clic dispara, clic derecho apunta con precisión) · WASD mueve · Mayús corre · Z rodillas · F estandarte · Tab observar');
}
function ctrlExit(why) {
  const c = SOLD.ctrl; if (!c) return; SOLD.ctrl = null; SOLD.yaw = 0; const V = R.bviz; if (V && c.oldTs !== undefined) V.ts = c.oldTs; else if (V) delete V.ts;
  try { if (document.pointerLockElement) document.exitPointerLock(); } catch (e) { }
  if (B3.S) { B3.S.cam.fov = 40; B3.S.cam.near = 2; B3.S.cam.updateProjectionMatrix(); }
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
    best = {t, p, key, head: sS > 2.0};
  });
  return best;
}
function ctrlFire(S, V, blk, O, D) {
  const c = SOLD.ctrl, era = t3Era(), tU = performance.now() / 1000; c.cd = CTRL_RELOAD[era] || 1.6; c.fireT = tU; c.shots++; c.kick = 0.07;
  const spread = (c.ads ? 0.004 : 0.016) * (c.mv ? (c.run ? 3 : 1.8) : 1) * (c.kneel ? 0.6 : 1); let dx = D.x + (Math.random() - 0.5) * spread, dy = D.y + (Math.random() - 0.5) * spread, dz = D.z + (Math.random() - 0.5) * spread; const L = Math.hypot(dx, dy, dz); dx /= L; dy /= L; dz /= L;
  const DD = {x: dx, y: dy, z: dz}, mx = O.x + dx * 2.2, mz = O.z + dz * 2.2;
  bvPart(V, {k: 'flash', x: mx, y: mz, life: 0.14}); bvPart(V, {k: 'smoke', x: mx + dx * 1.5, y: mz + dz * 1.5, life: 1.6});
  const hit = ctrlRay(S, O, DD, 260), tEnd = hit ? hit.t : 200;
  for (let i = 1; i <= 6; i++) { const u = tEnd * i / 6; bvPart(V, {k: 'flash', x: O.x + dx * u, y: O.z + dz * u, life: 0.05 + i * 0.012}); }          // trazadora
  if (!hit) { const gx = O.x + dx * 120, gz = O.z + dz * 120; bvPart(V, {k: 'dust', x: gx, y: gz, life: 0.8}); return; }
  c.hits++; c.hitT = tU; const p = hit.p, blkE = p.blk;
  const kill = hit.head || Math.random() < 0.7, front = (Math.sin(p.yaw) * dx + Math.cos(p.yaw) * dz) < 0;
  V.kmap = V.kmap || {}; V.klist = V.klist || [];
  if (V.klist.length > 500) { const old = V.klist.shift(); delete V.kmap[old.key]; }
  const e = {key: hit.key, x: p.x, z: p.z, yaw: p.yaw, tag: blkE.tag, era, wound: !kill, t0: tU, clip: kill ? (hit.head || Math.random() < 0.55 ? (front ? 'caer_muerto_atras' : 'caer_muerto_adelante') : (Math.random() < 0.5 ? 'caer_muerto_costado' : 'caer_muerto_rodillas')) : 'herido'};
  V.kmap[hit.key] = e; V.klist.push(e); if (kill) c.kills++;
  bvPart(V, {k: 'spark', x: p.x, y: p.z, life: 0.5, hot: true}); bvPart(V, {k: 'dust', x: p.x, y: p.z, life: 0.7});
  V.heroHits = (V.heroHits || 0) + 1;
  if (V.heroHits <= HERO_CAP) { blkE.d.s = Math.max(0.02, blkE.d.s - HERO_MEN / MEN_PER_DIV); blk.mm = Math.min(1, (blk.mm !== undefined ? blk.mm : 0.8) + 0.004); }
}
function ctrlStep(S, V, blk, dt) {
  const c = SOLD.ctrl, now = performance.now(), rdt = clamp((now - c.lt) / 1000, 0, 0.1), tU = now / 1000; c.lt = now; c.t += rdt; c.cd = Math.max(0, c.cd - rdt); c.kick *= Math.exp(-rdt * 9);
  SOLD.vis = SOLD.visNew; SOLD.visNew = new Map(); SOLD.shooters = SOLD.shootNew; SOLD.shootNew = [];
  if (c.dead) { if (now - c.deadAt > 2600) { ctrlExit('dead'); return null; } return {x: c.x, z: c.z, dead: true}; }
  const f = (CK.w ? 1 : 0) - (CK.s ? 1 : 0), r = (CK.d ? 1 : 0) - (CK.a ? 1 : 0), aim = c.cyaw; c.mv = !!(f || r); c.run = !!(CK.shift && c.mv && !c.kneel); c.ads = !!CK.ads;
  const ts = Math.max(0.2, V.ts === undefined ? 1 : V.ts);                           // se mueve con el tiempo del combate (con el combate en pausa, a ×0,2)
  if (c.mv) { const sp = (c.kneel ? 4 : c.run ? CTRL_RUN : CTRL_WALK) * (c.ads ? 0.55 : 1) * ts; let vx = Math.cos(aim) * f - Math.sin(aim) * r, vz = Math.sin(aim) * f + Math.cos(aim) * r; const L = Math.hypot(vx, vz) || 1; c.x += vx / L * sp * rdt; c.z += vz / L * sp * rdt; c.face = Math.atan2(vz, vx); }
  c.x = clamp(c.x, 6, BV_W - 6); c.z = clamp(c.z, 6, BV_H - 6);
  // el cuerpo gira con retardo respecto de la cámara (en primera persona la cámara manda)
  const diff = Math.abs(((aim - c.hd + Math.PI) % (2 * Math.PI) + 3 * Math.PI) % (2 * Math.PI) - Math.PI);
  c.turn = !c.mv && diff > 0.5; c.hd = angLerp(c.hd, (c.mv && !SOLD.fp) ? c.face : aim, Math.min(1, rdt * (CK.fire || CK.space ? 14 : 5)));
  const O = S.cam.position, cp = Math.cos(c.pitch + c.kick);
  if ((CK.space || CK.fire) && c.cd <= 0) ctrlFire(S, V, blk, {x: O.x, y: O.y, z: O.z}, {x: Math.cos(aim) * cp, y: Math.sin(c.pitch + c.kick), z: Math.sin(aim) * cp});
  if (c.flag && Math.hypot(c.x - blk.x, c.z - blk.y) < 40) blk.mm = Math.min(1, (blk.mm !== undefined ? blk.mm : 0.8) + 0.006 * rdt);
  // los soldados abatidos heridos acaban cayendo
  if (V.klist) V.klist.forEach(e => { if (e.wound && tU - e.t0 > 3) { e.wound = false; e.clip = 'caer_muerto_costado'; e.t0 = tU; } });
  // enemigos que te disparan (cada uno, hacia una vez cada 5–8 s mientras te encara)
  const era = t3Era(); let died = false;
  SOLD.shooters.forEach(sh => { if (died || Math.random() > rdt / 6.2) return;
    bvPart(V, {k: 'flash', x: sh.x, y: sh.z, life: 0.12}); for (let i = 1; i <= 4; i++) bvPart(V, {k: 'flash', x: sh.x + (c.x - sh.x) * i / 5, y: sh.z + (c.z - sh.z) * i / 5, life: 0.05 + i * 0.012});
    const pHit = clamp(0.028 - sh.dd / 5200, 0.006, 0.028) * (c.kneel ? 0.6 : 1) * (c.run ? 0.75 : 1) * (c.flag ? 1.5 : 1); if (Math.random() < pHit) died = true; });
  if (died) { c.dead = true; c.deadAt = now; c.clip = 'caer_muerto_adelante'; c.clipT = tU; if (c.flag) { blk.mm = Math.max(0, (blk.mm !== undefined ? blk.mm : 0.8) - 0.12); c.flag = false; } }
  else {
    const since = tU - c.fireT, fc = ctrlFireClip(era);
    if (since < 0.8) { c.clip = c.kneel ? 'disparar_rodilla_A' : fc; c.clipT = c.fireT; } else if (since < 2.2 && c.cd > 0 && !c.mv) { c.clip = 'recargar_A'; c.clipT = c.fireT + 0.8; }
    else if (CK.ads || CK.fire) { c.clip = 'apuntar'; c.clipT = null; } else if (c.kneel) { c.clip = 'agacharse'; c.clipT = null; } else if (c.mv) { c.clip = c.run ? 'marcha_rapida' : 'marcha'; c.clipT = null; }
    else if (c.turn) { c.clip = 'marcha'; c.clipT = null; } else if (c.flag) { c.clip = 'ondear'; c.clipT = null; } else { c.clip = 'idle'; c.clipT = null; }
  }
  return {x: c.x, z: c.z};
}
// cámara del modo control (primera o tercera persona), con balanceo, retroceso y zoom
function ctrlCam(S, ov) {
  const c = SOLD.ctrl, cam = S.cam, gy = b3H(S.tf, ov.x, ov.z), yaw = c.cyaw, pit = clamp(c.pitch + c.kick, -1.35, 1.35), cp = Math.cos(pit), fx = Math.cos(yaw) * cp, fy = Math.sin(pit), fz = Math.sin(yaw) * cp;
  const bob = c.mv ? Math.sin(c.t * (c.run ? 13 : 8)) * (c.run ? 0.09 : 0.05) : Math.sin(c.t * 1.6) * 0.012;
  if (ov.dead) { const k = Math.min(1, (performance.now() - c.deadAt) / 700); cam.position.set(ov.x, gy + 2.55 - k * 2.0, ov.z); cam.lookAt(ov.x + Math.cos(yaw) * 5, gy + 0.4, ov.z + Math.sin(yaw) * 5); cam.fov = 40; cam.near = 0.3; return; }
  const eye = c.kneel ? 1.75 : 2.62;
  if (SOLD.fp) { const px = ov.x + Math.cos(yaw) * 0.55, pz = ov.z + Math.sin(yaw) * 0.55; cam.position.set(px, Math.max(gy + eye + bob, b3H(S.tf, px, pz) + 1.2), pz); cam.lookAt(px + fx * 30, cam.position.y + fy * 30, pz + fz * 30); cam.fov = c.ads ? 22 : 42; cam.near = 0.3; }
  else { const d = 6.5, bx = ov.x - Math.cos(yaw) * d - Math.sin(yaw) * 1.3, bz = ov.z - Math.sin(yaw) * d + Math.cos(yaw) * 1.3, by = Math.max(b3H(S.tf, bx, bz) + 1.2, gy + 3.4 + fy * -3); cam.position.set(bx, by, bz); cam.lookAt(ov.x + fx * 25, gy + 2.4 + fy * 25, ov.z + fz * 25); cam.fov = c.ads ? 30 : 42; cam.near = 0.5; }
}
// figuras que dibuja el modo control: el soldado manejado y los abatidos (una vez por fotograma, en la primera llamada a b3Fig)
const _b3FigC = b3Fig;
b3Fig = function (S, V, blk, f, era, tU, cp, ca) {
  _b3FigC(S, V, blk, f, era, tU, cp, ca);
  if (SOLD._drawT === tU || (!SOLD.on && !(V.klist && V.klist.length))) return; SOLD._drawT = tU; const me = SOLD.on ? soldBlock(V) : null;
  const draw = (set, x, z, yaw, clip, start, tag) => { const y = b3H(S.tf, x, z); _b3o.phase = 0.37; _b3o.h = 0; _b3o.bright = 0.5; _b3o.skin = 1; _b3o.horse = 0; _b3o.start = start; _b3o.tread = 0; try { set.add(Math.hypot(x - ca.x, y - ca.y, z - ca.z), x, y, z, yaw, B3_S, tag, clip, _b3o); } catch (e) { set.add(Math.hypot(x - ca.x, y - ca.y, z - ca.z), x, y, z, yaw, B3_S, tag, 'idle', _b3o); } b3Sh(S, x, y, z, 1.05); };
  if (V.klist) V.klist.forEach(e => { const set = b3Set(S, 'fusilero', e.era, e.tag, null); draw(set, e.x, e.z, e.yaw, e.clip, e.wound ? null : e.t0, e.tag); });
  const c = SOLD.on && SOLD.ctrl; if (c && me) draw(b3Set(S, 'fusilero', era, me.tag, null), c.x, c.z, Math.PI / 2 - c.hd, c.clip, c.clipT, me.tag);
};
// movimiento libre de los soldados cerca de la cámara; los enemigos te ven, se te acercan, te encaran y te disparan
function b3Free(blk, f, j, x, z, yaw, clip, tU, ca, h1, h2) {
  if (!SOLD.on) return null; const V = R.bviz; if (!V) return null; const d0 = Math.hypot(x - ca.x, z - ca.z); if (d0 > 260) return null;
  const me = soldBlock(V); if (!me) return null; const enemy = blk.side !== me.side, key = blk.id + ':' + f.i + ':' + j, sp = blk.sp || 0, mode = blk.mode;
  if (mode === 'rout' || f.flee > 0) { if (enemy) SOLD.visNew.set(key, {x, z, yaw, blk}); return null; }
  const T = 3.5 + h1 * 3.2, tt = tU + h2 * 20, seg = Math.floor(tt / T), fr = (tt % T) / T, amp = sp > 8 ? 0.4 : (mode === 'fire' || mode === 'skirmish') ? 3.4 : mode === 'hold' ? 1.4 : (mode === 'charge' || mode === 'melee') ? 0.6 : 2.2;
  const rn = (s, k) => (hash2(blk.id * 131 + f.i + j * 7, s, k) - 0.5) * 2 * amp, k = Math.min(1, fr * 5), ease = k * k * (3 - 2 * k);
  const ox = rn(seg - 1, 31) + (rn(seg, 31) - rn(seg - 1, 31)) * ease, oz = rn(seg - 1, 32) + (rn(seg, 32) - rn(seg - 1, 32)) * ease, moving = k < 1 && sp <= 8;
  let nx = x + ox, nz = z + oz, nyaw = yaw, nclip = clip, start; const o = {};
  if (moving) { const mx = rn(seg, 31) - rn(seg - 1, 31), mz = rn(seg, 32) - rn(seg - 1, 32); if (Math.hypot(mx, mz) > 0.15) { nyaw = Math.atan2(mx, mz); nclip = 'marcha'; start = null; } }
  const p = SOLD.ctrl ? {x: SOLD.ctrl.x, z: SOLD.ctrl.z} : SOLD.pos;
  if (enemy && p && sp <= 8 && mode !== 'melee' && mode !== 'charge') {
    const dd = Math.hypot(p.x - nx, p.z - nz);
    if (dd < 110 && dd > 1) {
      const adv = Math.min(18, (110 - dd) * 0.3); nx += (p.x - nx) / dd * adv; nz += (p.z - nz) / dd * adv; nyaw = Math.atan2(p.x - nx, p.z - nz);
      const per = 5 + h1 * 3, ph = (tU + h2 * 17) % per;
      if (ph < 1.1) { nclip = ctrlFireClip(t3Era()); start = tU - ph; SOLD.shootNew.push({x: nx, z: nz, dd}); } else if (ph < per - 1.2) { nclip = 'apuntar'; start = null; } else { nclip = 'idle'; start = null; }
    }
  }
  if (enemy) SOLD.visNew.set(key, {x: nx, z: nz, yaw: nyaw, blk});
  o.x = nx; o.z = nz; o.yaw = nyaw; o.clip = nclip; if (start !== undefined) o.start = start; return o;
}
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
document.addEventListener('mousemove', e => { const c = SOLD.on && SOLD.ctrl; if (!c || !document.pointerLockElement) return; c.cyaw += e.movementX * 0.0022 * (c.ads ? 0.45 : 1); c.pitch = clamp(c.pitch - e.movementY * 0.0022 * (c.ads ? 0.45 : 1), -1.3, 1.3); }, true);
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
  if (!c.dead) { const cx = BV_W / 2, cy = BV_H / 2, hit = tU - c.hitT < 0.25, gap = c.ads ? 4 : 9 + (c.mv ? 6 : 0); g.strokeStyle = hit ? '#ff5a4a' : 'rgba(255,255,255,.8)'; g.lineWidth = 2; g.beginPath(); [[-1, 0], [1, 0], [0, -1], [0, 1]].forEach(([dx, dy]) => { g.moveTo(cx + dx * gap, cy + dy * gap); g.lineTo(cx + dx * (gap + 9), cy + dy * (gap + 9)); }); g.stroke(); if (hit) { g.beginPath(); g.moveTo(cx - 11, cy - 11); g.lineTo(cx + 11, cy + 11); g.moveTo(cx + 11, cy - 11); g.lineTo(cx - 11, cy + 11); g.stroke(); } }
  g.restore();
};
const ctrlBtn = () => SOLD.on ? `<button data-act="soldctrl" class="${SOLD.ctrl ? 'on' : ''}" data-tip="<b>Tomar el control del soldado</b><br>Primera persona: ratón apunta, clic dispara, clic derecho mira con precisión, WASD mueve, Mayús corre, Z rodillas, F estandarte. El combate se ralentiza a ×0,25. Tus impactos ayudan un poco a tu regimiento; si caes, vuelves a la vista de observador.">🎮 ${SOLD.ctrl ? 'Dejar el control' : 'Tomar el control'}</button>` : '';
ACT.soldctrl = () => { if (SOLD.ctrl) ctrlExit(); else ctrlStart(); };
