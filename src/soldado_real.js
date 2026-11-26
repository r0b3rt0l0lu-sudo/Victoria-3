/* ===== MODO SOLDADO: REALISMO (posturas, munición, fatiga, heridas, granadas, bayoneta y soldados que luchan por su cuenta) =====
   Sustituye ctrlStep / ctrlFire / ctrlVMStep de soldado3d_ctrl.js y amplía el HUD. Los soldados cercanos (npc_combate.js) usan los mismos eventos (SOLD.gren, SOLD.melee).
   POSTURAS  de pie (Z: rodilla) · X: cuerpo a tierra (reptar, W: ×0,75 / Mayús: reptar rápido). Cada cambio tiene su animación y bloquea el disparo unos instantes.
             De pie: ojos a 2,55 u, dispersión ×1; de rodillas ×0,65 y menos blanco; tumbado ×0,4, ojos a 0,62 u, el terreno te tapa del fuego lejano y casi no te alcanzan.
   FUEGO     por época. Avancarga/rayado (A, B): un cartucho por ciclo (7,5 s / 5 s) y 50-60 en la cartuchera; cerrojo con cargador de 5 (C, D, E: ciclo 1,5-1,7 s, recarga de cargador 4,2-4,5 s);
             fusil semiautomático de 8 (EE. UU., Australia y Canadá en la época E). R recarga cuando quieras. Sin cartuchos no se dispara.
   FATIGA    correr gasta aliento (10 s a tope); sin aliento no puedes correr y la mira tiembla. Con el botón derecho quieto la mira se asienta (menos dispersión).
   HERIDAS   el cuerpo ya no cae al primer impacto: 100 % de salud; el tiro a la cabeza (15 %) mata; en el tronco quita 30-55 %. Herido: cojeas (×0,75), sangras (H: vendarte, 3,5 s), la visión se enrojece.
   GRANADAS  (época D y E: 2 y 3) G: lanzas una granada a la distancia de la mira (cae, rebota y explota a los 3,5 s: mata a < 3,5 u, hiere a < 7 u).
   BAYONETA  B: calar/descalar la bayoneta (más alcance y corre mejor con ella); E: golpe de bayoneta o de culata a < 3,6 u (85 % / 55 % de matar). Si te embisten, defiéndete así. */
const SRE = {
  A: {cap: 1, pouch: 50, cyc: 7.5, rel: 0, gren: 0}, B: {cap: 1, pouch: 60, cyc: 5.0, rel: 0, gren: 0},
  C: {cap: 5, pouch: 90, cyc: 1.7, rel: 4.5, gren: 0}, D: {cap: 5, pouch: 120, cyc: 1.6, rel: 4.5, gren: 2}, E: {cap: 5, pouch: 100, cyc: 1.5, rel: 4.2, gren: 3}
};
const SR_EYE = {pie: 2.55, rodilla: 1.45, tumbado: 0.62}, SR_G = 16, SR_FUSE = 3.5;
SOLD.gren = []; SOLD.melee = [];
const srPostName = c => c.prone ? 'tumbado' : c.kneel ? 'rodilla' : 'pie';
function srBlockLOS(S, x0, y0, z0, x1, y1, z1) {                    // ¿el terreno tapa la línea entre dos puntos?
  const L = Math.hypot(x1 - x0, z1 - z0); for (let u = 5; u < L - 3; u += 5) { const k = u / L; if (b3H(S.tf, x0 + (x1 - x0) * k, z0 + (z1 - z0) * k) > y0 + (y1 - y0) * k + 0.1) return true; } return false;
}
const _ctrlStartSR = ctrlStart;
ctrlStart = function () {
  _ctrlStartSR(); const c = SOLD.ctrl; if (!c) return; const V = R.bviz, me = soldBlock(V), era = t3Era(), P = SRE[era] || SRE.D, semi = era === 'E' && me && /^(USA|AUL|CAN)$/.test(me.tag);
  Object.assign(c, {pose: 'pie', prone: false, kneel: false, pt: null, hp: 1, bleed: 0, stam: 1, cap: semi ? 8 : P.cap, cyc: semi ? 0.5 : P.cyc, rel: semi ? 3.2 : P.rel, gren: P.gren, bayo: false, rl: null, steady: 0, melT: -9, thT: -9, bdT: -9, busyUntil: 0, vmBusy: 0, hurtFx: 0, sway: 0, crawl: 0});
  c.mag = c.cap; c.pouch = P.pouch - c.cap; c.head = SR_EYE.pie; SOLD.gren.length = 0; SOLD.melee.length = 0;
  toast('🎮', 'Postura: Z rodillas · X cuerpo a tierra · R recargar · G granada · B bayoneta · E golpear · H vendarte · Mayús correr (gasta aliento)');
};
// cambio de postura con su animación (bloquea movimiento y fuego mientras dura)
function srSetPose(c, to, tU) {
  if (c.dead || c.pose === to || (c.pt && tU < c.pt.t1)) return; const from = c.pose;
  const tr = {'pie>rodilla': ['a_rodilla', 0.6], 'rodilla>pie': ['de_rodilla', 0.6], 'pie>tumbado': ['a_tumbado', 1.3], 'tumbado>pie': ['de_tumbado', 1.2], 'rodilla>tumbado': ['a_tumbado', 1.0], 'tumbado>rodilla': ['de_tumbado', 0.9]}[from + '>' + to] || ['idle', 0.5];
  const T3 = window.Troops3D, inf = T3 && T3.clipInfo ? T3.clipInfo('fusilero', tr[0]) : null, dur = inf && inf.dur ? Math.min(inf.dur, tr[1] + 0.3) : tr[1];
  c.pt = {from, to, t0: tU, t1: tU + dur, clip: tr[0]}; c.rl = null;
}
function srPoseTick(c, tU) {
  if (c.pt) { const k = clamp((tU - c.pt.t0) / (c.pt.t1 - c.pt.t0), 0, 1); if (k >= 1) { c.pose = c.pt.to; c.pt = null; } else { c.poseK = k; } }
  c.prone = c.pose === 'tumbado' && !c.pt; c.kneel = c.pose === 'rodilla' && !c.pt;
  let h = SR_EYE[c.pose]; if (c.pt) { const a = SR_EYE[c.pt.from], b = SR_EYE[c.pt.to], k = clamp((tU - c.pt.t0) / (c.pt.t1 - c.pt.t0), 0, 1); h = a + (b - a) * k; }
  c.head = h + (c.kneel && c.peek ? 0.85 : 0);
}
// ---- abatir a un soldado enemigo (disparo, granada o bayoneta) ----
function srKill(S, V, c, key, p, hit, opts) {
  opts = opts || {}; const era = t3Era(), tU = performance.now() / 1000, blkE = p.blk; V.kmap = V.kmap || {}; V.klist = V.klist || []; if (V.kmap[key]) return;
  const kill = opts.kill !== undefined ? opts.kill : (hit && hit.head) || Math.random() < 0.7, dx = opts.dx || 0, dz = opts.dz || 0, front = (Math.sin(p.yaw) * dx + Math.cos(p.yaw) * dz) < 0, side = (Math.cos(p.yaw) * dz - Math.sin(p.yaw) * dx), r = Math.random();
  if (V.klist.length > 500) { const old = V.klist.shift(); delete V.kmap[old.key]; }
  const dClip = opts.expl ? (front ? 'muerte_atras_pie' : 'muerte_adelante') : (hit && hit.head) ? (front ? (r < 0.3 ? 'muerte_giro' : 'muerte_atras_pie') : 'muerte_adelante') : front ? (r < 0.4 ? 'muerte_atras_pie' : r < 0.6 ? 'muerte_rodillas' : r < 0.8 ? 'muerte_muro' : 'muerte_atras_rodilla') : Math.abs(side) > 0.45 ? (side > 0 ? 'muerte_costado_de' : 'muerte_costado_iz') : (r < 0.5 ? 'muerte_adelante' : 'muerte_rodillas_adelante');
  const T3 = window.Troops3D, inf = T3 && T3.clipInfo ? T3.clipInfo('fusilero', dClip) : null;
  const e = {key, x: p.x, z: p.z, yaw: p.yaw, tag: blkE.tag, era, wound: !kill, t0: tU, clip: kill ? dClip : 'herido_grave', dClip, dur: inf && inf.dur ? inf.dur : 2, corpse: 'cuerpo_inerte_' + dClip.replace(/^muerte_/, '')};
  V.kmap[key] = e; V.klist.push(e); if (kill) c.kills++;
  fxFlash(p.x, b3H(S.tf, p.x, p.z) + 1.6, p.z, 0.18); bvPart(V, {k: 'dust', x: p.x, y: p.z, life: 0.7});
  V.heroHits = (V.heroHits || 0) + 1;
  if (V.heroHits <= HERO_CAP) { blkE.d.s = Math.max(0.02, blkE.d.s - HERO_MEN / MEN_PER_DIV); const blk = soldBlock(V); if (blk) blk.mm = Math.min(1, (blk.mm !== undefined ? blk.mm : 0.8) + 0.004); }
}
// ---- disparo del jugador: munición, ciclo por época, dispersión por postura, fatiga, heridas y asentamiento de la mira ----
ctrlFire = function (S, V, blk, O, D) {
  const c = SOLD.ctrl, era = t3Era(), tU = performance.now() / 1000;
  if (c.pt || c.rl || tU < c.busyUntil) return;
  if (c.mag <= 0) { if (c.pouch <= 0) { if (tU - (c.noAmmoT || -9) > 2) { toast('⚠️', 'Sin cartuchos: golpea con la bayoneta o la culata (E).'); c.noAmmoT = tU; } } else srReload(c, tU); return; }
  c.mag--; c.cd = c.cyc; c.fireT = tU; c.shots++; c.kick = 0.07 * (c.prone ? 0.5 : c.kneel ? 0.75 : 1);
  if (c.cap === 1) { if (c.pouch > 0) { c.pouch--; c.mag = 1; } else c.mag = 0; }                    // avancarga: cada ciclo carga el siguiente cartucho
  const poseK = c.prone ? 0.4 : c.kneel ? 0.65 : 1, mov = c.mv ? (c.prone ? 2 : c.run ? 3 : 1.8) : 1, tired = 1 + Math.max(0, 0.4 - c.stam) * 3, hurtK = c.hp < 0.55 ? 1.4 : 1, steady = 1 - 0.5 * (c.steady || 0);
  const spread = (c.ads ? 0.004 : 0.016) * poseK * mov * tired * hurtK * (c.ads ? steady : 1) * (c.bayo ? 1.1 : 1);
  let dx = D.x + (Math.random() - 0.5) * spread, dy = D.y + (Math.random() - 0.5) * spread, dz = D.z + (Math.random() - 0.5) * spread; const L = Math.hypot(dx, dy, dz); dx /= L; dy /= L; dz /= L;
  const DD = {x: dx, y: dy, z: dz};
  if (SOLD.vm && SOLD.fp) { SOLD.vm.play(c.ads ? 'disparar_ads_vm' : 'disparar_vm', {next: c.ads ? 'ads_vm' : (c.prone ? 'tumbado_idle_vm' : 'idle_vm')}); c.reloaded = false; c.vmBusy = tU + 0.45; }
  fxFlash(O.x + dx * 2.6, O.y + dy * 2.6 - 0.4, O.z + dz * 2.6, 0.09); bvPart(V, {k: 'smoke', x: O.x + dx * 30 - dz * 3, y: O.z + dz * 30 + dx * 3, life: 1.1});
  if (typeof SFX !== 'undefined' && SFX.volley) { try { SFX.volley(0.5); } catch (e) { } }
  const hit = ctrlRay(S, O, DD, 260), tEnd = hit ? hit.t : 200;
  for (let i = 1; i <= 7; i++) { const u = tEnd * i / 7; fxFlash(O.x + dx * u, O.y + dy * u, O.z + dz * u, 0.04 + i * 0.012); }
  SOLD.suppress = {x: hit && hit.p ? hit.p.x : O.x + dx * 120, z: hit && hit.p ? hit.p.z : O.z + dz * 120, t: tU};
  if (c.cap > 1 && c.mag <= 0 && c.pouch > 0) c.autoRel = tU + 0.7;
  if (hit && hit.blocked) { fxFlash(hit.x, hit.y, hit.z, 0.16); bvPart(V, {k: 'dust', x: hit.x, y: hit.z, life: 0.8}); return; }
  if (!hit) { const gx = O.x + dx * 120, gz = O.z + dz * 120; bvPart(V, {k: 'dust', x: gx, y: gz, life: 0.8}); return; }
  c.hits++; c.hitT = tU; srKill(S, V, c, hit.key, hit.p, hit, {dx, dz});
};
function srReload(c, tU) {
  if (c.cap === 1 || c.rl || c.pt || c.pouch <= 0 || c.mag >= c.cap) return; const need = Math.min(c.cap - c.mag, c.pouch);
  c.rl = {t0: tU, t1: tU + c.rel * (c.prone ? 1.2 : c.kneel ? 1.05 : 1), n: need}; c.cd = 0;
  if (SOLD.vm && SOLD.fp) { SOLD.vm.play('recargar_vm', {next: c.prone ? 'tumbado_idle_vm' : 'idle_vm'}); c.vmBusy = c.rl.t1; }
}
// ---- granadas: lanzamiento, balística, rebote y explosión (también las de los soldados cercanos) ----
function srThrowGren(S, from, to, flight, owner) {
  const y0 = b3H(S.tf, from.x, from.z) + 2.2;
  SOLD.gren.push({x: from.x, y: y0, z: from.z, vx: (to.x - from.x) / flight, vz: (to.z - from.z) / flight, vy: (b3H(S.tf, to.x, to.z) + 0.3 - y0) / flight + 0.5 * SR_G * flight, t0: performance.now() / 1000, owner});
}
function srExplode(S, V, c, g) {
  const y = b3H(S.tf, g.x, g.z); fxFlash(g.x, y + 1.2, g.z, 0.55); for (let i = 0; i < 6; i++) bvPart(V, {k: 'dust', x: g.x + (Math.random() - 0.5) * 5, y: g.z + (Math.random() - 0.5) * 5, life: 1.1}); bvPart(V, {k: 'smoke', x: g.x, y: g.z, life: 2.6});
  if (typeof SFX !== 'undefined' && SFX.boom) { try { SFX.boom(0.7); } catch (e) { } }
  SOLD.suppress = {x: g.x, z: g.z, t: performance.now() / 1000};
  if (g.owner === 'me' && c) {
    SOLD.vis.forEach((p, key) => { const d = Math.hypot(p.x - g.x, p.z - g.z); if (d < 7 && !(V.kmap && V.kmap[key])) { if (d < 3.5 || Math.random() < 0.4) { srKill(S, V, c, key, p, null, {kill: d < 3.5 ? true : Math.random() < 0.5, expl: true, dx: g.x - p.x, dz: g.z - p.z}); } } });
  }
  if (c && !c.dead) {                             // metralla contra el jugador: más segura si está de pie y a poca distancia; el cuerpo a tierra y las coberturas reducen el daño
    const d = Math.hypot(c.x - g.x, c.z - g.z); if (d < 9) {
      const cb = covBlock(S, g.x, y + 0.8, g.z, c.x, b3H(S.tf, c.x, c.z) + c.head * 0.6, c.z), k = (1 - d / 9) * (c.prone ? 0.35 : c.kneel ? 0.6 : 1) * (cb ? 0.25 : 1);
      if (Math.random() < Math.min(0.95, k * 1.4)) srHurt(c, 0.3 + 0.5 * k, Math.atan2(g.z - c.z, g.x - c.x), false); c.kick += 0.05 * k; c.hurt = c.hurt && performance.now() / 1000 - c.hurt.t < 0.3 ? c.hurt : {ang: Math.atan2(g.z - c.z, g.x - c.x), t: performance.now() / 1000, blk: false};
    }
  }
}
function srGrenStep(S, V, c, rdt, tU) {
  for (let i = SOLD.gren.length - 1; i >= 0; i--) {
    const g = SOLD.gren[i], age = tU - g.t0; g.vy -= SR_G * rdt; g.x += g.vx * rdt; g.z += g.vz * rdt; g.y += g.vy * rdt;
    const gy = b3H(S.tf, g.x, g.z) + 0.15; if (g.y < gy) { g.y = gy; if (Math.abs(g.vy) > 3) { g.vy = -g.vy * 0.3; g.vx *= 0.5; g.vz *= 0.5; } else { g.vy = 0; g.vx *= 0.8; g.vz *= 0.8; } }
    if (Math.random() < 0.5) fxFlash(g.x, g.y, g.z, 0.03);                                         // chispa de la mecha
    if (age >= SR_FUSE) { SOLD.gren.splice(i, 1); srExplode(S, V, c, g); }
  }
}
// ---- heridas ----
function srHurt(c, dmg, ang, blk) {
  c.hp = Math.max(0, c.hp - dmg); c.hurtFx = performance.now() / 1000; if (c.hp < 0.65 && !c.bleed) c.bleed = 0.006; c.stam = Math.max(0, c.stam - 0.15);
  if (c.hp <= 0.001 && !c.god) c.dieNow = true;
}
// ---- paso del soldado del jugador ----
ctrlStep = function (S, V, blk, dt) {
  const c = SOLD.ctrl, now = performance.now(), rdt = clamp((now - c.lt) / 1000, 0, 0.1), tU = now / 1000; c.lt = now; c.t += rdt; c.cd = Math.max(0, c.cd - rdt); c.kick *= Math.exp(-rdt * 9);
  SOLD.vis = SOLD.visNew; SOLD.visNew = new Map(); const era = t3Era();
  if (c.dead) { if (now - c.deadAt > 2600) { ctrlExit('dead'); return null; } ctrlVMStep(c, rdt, era); return {x: c.x, z: c.z, dead: true}; }
  srPoseTick(c, tU);
  const busy = tU < c.busyUntil || !!c.pt, f = (CK.w ? 1 : 0) - (CK.s ? 1 : 0), r = (CK.d ? 1 : 0) - (CK.a ? 1 : 0), aim = c.cyaw;
  c.mv = !busy && !!(f || r); c.ads = !!CK.ads && !busy && !c.rl;
  const canRun = c.stam > 0.12 && c.hp > 0.4 && !c.kneel && !c.prone && !c.pt;
  c.run = !!(CK.shift && c.mv && canRun && !c.ads); c.crawl = c.prone && c.mv ? (CK.shift ? 2 : 1) : 0;
  // aliento: correr gasta, descansar recupera (más agachado o tumbado); asentar la mira quieto con el botón derecho
  if (c.run) c.stam = Math.max(0, c.stam - rdt * 0.10); else c.stam = Math.min(1, c.stam + rdt * (c.mv ? 0.03 : c.prone || c.kneel ? 0.11 : 0.07));
  c.steady = c.ads && !c.mv ? Math.min(1, (c.steady || 0) + rdt * 0.5 * (c.stam > 0.3 ? 1 : 0.4)) : Math.max(0, (c.steady || 0) - rdt * 2);
  c.bleed && (c.hp = Math.max(0, c.hp - c.bleed * rdt), c.hp <= 0.001 && !c.god && (c.dieNow = true));
  if (c.mv) {
    const base = c.prone ? (CK.shift ? 1.3 : 0.75) : c.kneel ? CTRL_KNEEL : c.run ? CTRL_RUN : CTRL_WALK;
    const sp = base * (c.ads ? 0.5 : 1) * (f < 0 ? 0.7 : (!f && r ? 0.85 : 1)) * (c.hp < 0.65 ? 0.75 : 1) * (c.stam < 0.12 && !c.prone ? 0.8 : 1);
    let vx = Math.cos(aim) * f - Math.sin(aim) * r, vz = Math.sin(aim) * f + Math.cos(aim) * r; const L = Math.hypot(vx, vz) || 1; c.x += vx / L * sp * rdt; c.z += vz / L * sp * rdt; c.face = Math.atan2(vz, vx);
  }
  { const q = covPush(S, c.x, c.z, 0.9); c.x = q[0]; c.z = q[1]; }
  c.x = clamp(c.x, 6, BV_W - 6); c.z = clamp(c.z, 6, BV_H - 6);
  c.peek = c.kneel && (CK.ads || tU - c.fireT < 0.8); srPoseTick(c, tU);
  const diff = Math.abs(((aim - c.hd + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI);
  c.turn = !c.mv && diff > 0.5; c.hd = angLerp(c.hd, (c.mv && !SOLD.fp) ? c.face : aim, Math.min(1, rdt * (CK.fire || CK.space ? 14 : 5)));
  const O = S.cam.position, cp = Math.cos(c.pitch + c.kick);
  // recarga automática, fin de recarga y disparo
  if (c.autoRel && tU >= c.autoRel) { c.autoRel = 0; srReload(c, tU); }
  if (c.rl && tU >= c.rl.t1) { const n = c.rl.n; c.mag += n; c.pouch -= n; c.rl = null; }
  if ((CK.space || CK.fire) && c.cd <= 0 && !c.rl && !c.pt) ctrlFire(S, V, blk, {x: O.x, y: O.y, z: O.z}, {x: Math.cos(aim) * cp, y: Math.sin(c.pitch + c.kick), z: Math.sin(aim) * cp});
  // golpes cuerpo a cuerpo del jugador
  if (SR_K.melee && typeof msUse === 'function' && msUse(c, tU)) SR_K.melee = 0;
  if (SR_K.melee && !c.pt && tU - c.melT > 1.0 && !c.rl) { SR_K.melee = 0; srMelee(S, V, c, tU); } else SR_K.melee = 0;
  if (SR_K.gren && !c.pt && !c.rl) { SR_K.gren = 0; srGrenade(S, V, c, tU, cp, aim); } else SR_K.gren = 0;
  if (SR_K.reload) { SR_K.reload = 0; if (c.cap > 1 && c.mag < c.cap && c.pouch > 0) srReload(c, tU); }
  if (SR_K.band) { SR_K.band = 0; if (tU >= c.busyUntil && !c.pt && (c.hp < 1 || c.bleed)) { c.bdT = tU; c.busyUntil = tU + 3.5; c.bandT = tU; if (SOLD.vm && SOLD.fp) { SOLD.vm.play('curar_vm', {next: c.prone ? 'tumbado_idle_vm' : 'idle_vm'}); c.vmBusy = tU + 3.5; } } }
  if (c.bandT && tU >= c.bandT + 3.5 - 0.02) { c.bandT = 0; c.bdT = 0; c.bleed = 0; c.hp = Math.min(1, c.hp + 0.14); toast('🩹', 'Te has vendado la herida: dejas de sangrar.'); }
  if (c.flag && Math.hypot(c.x - blk.x, c.z - blk.y) < 40) blk.mm = Math.min(1, (blk.mm !== undefined ? blk.mm : 0.8) + 0.006 * rdt);
  srGrenStep(S, V, c, rdt, tU);
  // disparos, golpes y metralla enemigos
  let died = false; const gyP = b3H(S.tf, c.x, c.z); SOLD.shots = SOLD.shotNew; SOLD.shotNew = [];
  SOLD.shots.forEach(sh => { if (died) return;
    const ty = gyP + c.head * 0.85, blkd = covBlock(S, sh.x, sh.y, sh.z, c.x, ty, c.z), brg = Math.atan2(sh.z - c.z, sh.x - c.x), ter = !blkd && sh.dd > 14 && srBlockLOS(S, sh.x, sh.y, sh.z, c.x, ty, c.z);
    fxFlash(sh.x, sh.y - 0.2, sh.z, 0.1); for (let i = 1; i <= 5; i++) { const ex = blkd ? blkd.x : c.x, ez = blkd ? blkd.z : c.z, ey = blkd ? blkd.y : ty; fxFlash(sh.x + (ex - sh.x) * i / 6, sh.y + (ey - sh.y) * i / 6, sh.z + (ez - sh.z) * i / 6, 0.04 + i * 0.012); }
    if (blkd || ter) { const q = blkd || {x: c.x, y: ty, z: c.z}; fxFlash(q.x, q.y, q.z, 0.16); bvPart(V, {k: 'dust', x: q.x, y: q.z, life: 0.7}); c.coverT = tU; c.coverWhy = ter ? 'terreno' : 'cobertura'; c.hurt = {ang: brg, t: tU, blk: true}; c.kick += 0.012; return; }
    c.hurt = {ang: brg, t: tU, blk: false}; c.kick += 0.02;
    const pHit = clamp(0.016 - sh.dd / 9000, 0.004, 0.016) * (c.prone ? 0.35 : c.kneel ? (c.peek ? 0.8 : 0.5) : 1) * (c.run ? 0.75 : 1) * (c.flag ? 1.5 : 1);
    if (Math.random() < pHit && !c.god) { const head = Math.random() < (c.prone ? 0.22 : 0.15); srHurt(c, head ? 1 : 0.3 + Math.random() * 0.25, brg, false); if (c.dieNow) died = true; else toast('🩸', 'Te han herido: ' + Math.round(c.hp * 100) + ' % de salud. H: vendarte.'); }
  });
  SOLD.melee.forEach(m => { if (died) return; if (Math.hypot(c.x - m.x, c.z - m.z) < 3.8 && Math.random() < (c.prone ? 0.42 : c.kneel ? 0.34 : 0.3) * (c.bayo && tU - c.melT < 0.6 ? 0.4 : 1)) { c.hurt = {ang: m.ang, t: tU, blk: false}; srHurt(c, 0.45 + Math.random() * 0.2, m.ang, false); c.kick += 0.06; if (c.dieNow) died = true; else toast('🗡️', '¡Te han herido con la bayoneta!'); } }); SOLD.melee.length = 0;
  if (c.dieNow) died = true;
  if (died) { c.dead = true; c.deadAt = now; c.clip = 'muerte_adelante'; c.clipT = tU; if (c.flag) { blk.mm = Math.max(0, (blk.mm !== undefined ? blk.mm : 0.8) - 0.12); c.flag = false; } }
  else srClips(c, tU, era);
  ctrlVMStep(c, rdt, era);
  return {x: c.x, z: c.z};
};
// golpe de bayoneta o de culata
function srMelee(S, V, c, tU) {
  c.melT = tU; c.busyUntil = tU + 0.55; const reach = c.bayo ? 3.9 : 3.0, dirx = Math.cos(c.cyaw), dirz = Math.sin(c.cyaw); let best = null, bd = 99;
  SOLD.vis.forEach((p, key) => { if (V.kmap && V.kmap[key]) return; const dx = p.x - c.x, dz = p.z - c.z, d = Math.hypot(dx, dz); if (d > reach || d < 0.1) return; if ((dx * dirx + dz * dirz) / d < 0.5) return; if (d < bd) { bd = d; best = {p, key, dx, dz}; } });
  if (SOLD.vm && SOLD.fp) { SOLD.vm.play(c.bayo ? 'bayoneta_vm' : 'golpe_culata_vm', {next: c.prone ? 'tumbado_idle_vm' : 'idle_vm'}); c.vmBusy = tU + 0.9; }
  c.meleeClip = {t0: tU, clip: c.bayo ? 'melee_1' : 'golpe_culata'};
  if (best && Math.random() < (c.bayo ? 0.85 : 0.55)) { c.hits++; c.hitT = tU; srKill(S, V, c, best.key, best.p, null, {kill: true, dx: best.dx, dz: best.dz}); }
  else if (best) { toast('🗡️', 'Fallas el golpe.'); }
}
function srGrenade(S, V, c, tU, cp, aim) {
  if (c.gren <= 0) { toast('💣', 'No te quedan granadas.'); return; } if (c.prone) { toast('💣', 'No puedes lanzar la granada tumbado: ponte de rodillas o de pie.'); return; }
  c.gren--; c.thT = tU; c.busyUntil = tU + 1.5; const flight = 1.1 + Math.max(0, Math.sin(c.pitch + 0.35)) * 0.6, dist = clamp(24 + Math.sin(c.pitch) * 40, 14, 38), eye = c.head;
  setTimeout(() => { if (!SOLD.ctrl || SOLD.ctrl !== c || c.dead) return; srThrowGren(S, {x: c.x + Math.cos(c.cyaw) * 0.8, z: c.z + Math.sin(c.cyaw) * 0.8}, {x: c.x + Math.cos(c.cyaw) * dist, z: c.z + Math.sin(c.cyaw) * dist}, flight, 'me'); void eye; }, 650);
  if (SOLD.vm && SOLD.fp) { SOLD.vm.play('lanzar_granada_vm', {next: 'idle_vm'}); c.vmBusy = tU + 1.9; }
  c.throwClip = {t0: tU, clip: c.kneel ? 'lanzar_granada_rodilla' : 'lanzar_granada_pie'}; toast('💣', `Granada lanzada (${c.gren} restantes). Explota a los ${SR_FUSE} s.`);
}
const SR_K = {melee: 0, gren: 0, reload: 0, band: 0};
// clips del cuerpo en tercera persona
function srClips(c, tU, era) {
  const post = srPostName(c), firing = tU - c.fireT < 0.8, pitchD = clamp(c.pitch * 57.3, -40, 40);
  const aimClip = fire => { try { return npcAim(era, pitchD, c.pt ? (c.pt.to === 'tumbado' ? 'tumbado' : post) : post, fire); } catch (e) { return fire ? ctrlFireClip(era) : 'apuntar'; } };
  if (c.pt) { c.clip = c.pt.clip; c.clipT = c.pt.t0; return; }
  if (c.throwClip && tU - c.throwClip.t0 < 1.4) { c.clip = c.throwClip.clip; c.clipT = c.throwClip.t0; return; }
  if (c.meleeClip && tU - c.meleeClip.t0 < 0.9) { c.clip = c.meleeClip.clip; c.clipT = c.meleeClip.t0; return; }
  if (c.bandT) { c.clip = 'recolocar_mochila'; c.clipT = null; return; }
  if (c.rl) { const n = 'recargar_' + post + '_' + era; c.clip = npcHas(n) ? n : 'recargar_pie_' + era; c.clipT = c.rl.t0; return; }
  if (firing) { c.clip = aimClip(true); c.clipT = c.fireT; return; }
  if (c.cap === 1 && c.cd > 0 && !c.mv) { const n = 'recargar_' + post + '_' + era; c.clip = npcHas(n) ? n : 'recargar_pie_' + era; c.clipT = c.fireT + 0.8; return; }
  if (CK.ads || CK.fire) { c.clip = aimClip(false); c.clipT = null; return; }
  if (c.prone) { c.clip = c.mv ? (c.crawl === 2 ? 'reptar_rapido' : 'reptar') : 'idle_tumbado'; c.clipT = null; return; }
  if (c.kneel) { c.clip = c.mv ? npcClip('correr_agachado', 'agacharse') : npcClip('idle_rodilla', 'agacharse'); c.clipT = null; return; }
  if (c.mv) { c.clip = c.run ? (c.bayo && npcHas('cargar_bayoneta') ? 'cargar_bayoneta' : 'marcha_rapida') : (c.hp < 0.65 && npcHas('cojear') ? 'cojear' : 'marcha'); c.clipT = null; return; }
  if (c.turn) { c.clip = 'marcha'; c.clipT = null; return; } if (c.flag) { c.clip = 'ondear'; c.clipT = null; return; }
  c.clip = c.hp < 0.4 && npcHas('herido_leve') ? 'herido_leve' : 'idle'; c.clipT = null;
}
// ---- viewmodel (brazos y arma en primera persona) ----
ctrlVMStep = function (c, rdt, era) {
  const vm = SOLD.vm; if (!vm || !SOLD.fp) return; const name = vm.curName, tU = performance.now() / 1000, ctl = n => vm.clipInfo(n);
  if (SOLD.lookDx || SOLD.lookDy) { vm.look(SOLD.lookDx, SOLD.lookDy); SOLD.lookDx = SOLD.lookDy = 0; }
  if (c.dead) { if (name !== 'muerte_vm') vm.play('muerte_vm'); vm.update(rdt, {}); return; }
  if (c.ads && !c.vmAds) { vm.play('ads_entrada', {next: 'ads_vm'}); } else if (!c.ads && c.vmAds) { vm.play('ads_salida'); } c.vmAds = c.ads;
  const busy = tU < (c.vmBusy || 0), idleSet = ['idle_vm', 'marcha_vm', 'carrera_vm', 'tumbado_idle_vm', 'tumbado_vm', 'rodilla_vm'];
  if (!busy && !c.ads) {
    let want = c.prone ? (c.mv ? 'tumbado_vm' : 'tumbado_idle_vm') : c.kneel ? 'rodilla_vm' : (c.mv ? (c.run ? 'carrera_vm' : 'marcha_vm') : 'idle_vm');
    if (!ctl(want)) want = c.mv ? (c.run ? 'carrera_vm' : 'marcha_vm') : 'idle_vm';
    if (idleSet.includes(name) || name === 'ads_salida') { if (name !== want) vm.play(want, {blend: 0.2}); }
    if (c.cap > 1 && c.cd > 0 && c.mag > 0 && !c.reloaded2 && ctl('cerrojo_vm') && c.cd > c.cyc * 0.6) { c.reloaded2 = true; vm.play('cerrojo_vm', {next: want}); c.vmBusy = tU + Math.min(0.9, c.cyc * 0.5); } if (c.cd <= 0) c.reloaded2 = false;
  }
  vm.update(rdt * (name === 'recargar_vm' ? 1 : 1), {mover: c.mv ? (c.run ? 1 : c.prone ? 0.3 : 0.6) : 0, agachado: c.kneel || c.prone});
};
// ---- cámara: balanceo según postura y aliento, temblor al apuntar cansado, caída del ojo al cambiar de postura ----
const _ctrlCamSR = ctrlCam;
ctrlCam = function (S, ov) {
  _ctrlCamSR(S, ov); const c = SOLD.ctrl; if (!c || ov.dead || !SOLD.fp) return; const cam = S.cam, tU = performance.now() / 1000;
  const sway = (c.ads ? 0.0035 : 0.0012) * (1 + Math.max(0, 0.45 - c.stam) * 5 + (c.hp < 0.55 ? 1.5 : 0)) * (1 - 0.6 * (c.steady || 0)), a = c.t * 2.1;
  cam.rotateX(Math.sin(a) * sway); cam.rotateY(Math.cos(a * 0.8) * sway);
  if (c.prone && c.mv) cam.rotateZ(Math.sin(c.t * 5) * 0.012);
};
// ---- HUD ampliado ----
const _b3FrameSR = b3Frame;
b3Frame = function (V, b, g, lines, all) {
  _b3FrameSR(V, b, g, lines, all); const c = SOLD.on && SOLD.ctrl; const S = B3.S; if (S && SOLD.gren && SOLD.gren.length && !c) { try { srGrenStep(S, V, null, 0.05, performance.now() / 1000); } catch (e) { } } if (!c) return;
  const tU = performance.now() / 1000; g.save(); g.textAlign = 'left';
  // panel de estado (sustituye la línea de postura del HUD base)
  const px = BV_W - 380, py = BV_H - 150; g.fillStyle = 'rgba(8,12,16,.92)'; g.fillRect(px + 6, py + 74, 358, 50); g.fillStyle = '#d9d2bc'; g.font = '16px sans-serif';
  const pose = c.pt ? '↕ Cambiando de postura…' : c.prone ? (c.mv ? '🐛 Reptando' : '🛌 Tumbado') : c.kneel ? '🧎 De rodillas' : c.run ? '🏃 Corriendo' : '🚶 En pie';
  g.fillText(`${pose}${c.bayo ? ' · 🔪 Bayoneta' : ''}${c.flag ? ' · 🚩' : ''}`, px + 12, py + 92);
  const ammo = c.cap === 1 ? `${c.mag + c.pouch} cartuchos` : `${c.mag}/${c.cap} · ${c.pouch}`; g.fillText(`🔫 ${ammo}${c.gren ? ' · 💣 ' + c.gren : ''}${c.rl ? ' · recargando…' : ''}`, px + 12, py + 114);
  // barras: salud, aliento y asentamiento de la mira
  g.fillStyle = 'rgba(8,12,16,.85)'; g.fillRect(px, py - 50, 370, 44);
  const bar = (x, y, w, k, col) => { g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(x, y, w, 8); g.fillStyle = col; g.fillRect(x, y, w * clamp(k, 0, 1), 8); };
  g.font = '12px sans-serif'; g.fillStyle = '#f2e6bf'; g.fillText('SALUD', px + 10, py - 36); g.fillText('ALIENTO', px + 10, py - 22); if (c.ads) g.fillText('MIRA', px + 10, py - 8);
  bar(px + 76, py - 44, 284, c.hp, c.hp > 0.6 ? '#79c35a' : c.hp > 0.3 ? '#e0a53a' : '#e0503a'); bar(px + 76, py - 30, 284, c.stam, '#6aa7d8'); if (c.ads) bar(px + 76, py - 16, 284, c.steady || 0, '#c9a45c');
  g.fillStyle = 'rgba(8,12,16,.75)'; g.fillRect(8, BV_H - 62, 1010, 26); g.fillStyle = '#d9d2bc'; g.font = '15px sans-serif'; g.fillText('Ratón: apuntar · clic: disparar · dcho.: mira · WASD · Mayús: correr · Z: rodillas · X: tumbarse · R: recargar · G: granada · B: bayoneta · E: golpear · H: vendarte · F: estandarte · Tab: observar', 14, BV_H - 44);
  // visión: enrojecimiento al estar herido y destello al recibir un impacto
  const w = clamp((0.65 - c.hp) / 0.65, 0, 1), flash = clamp(1 - (tU - (c.hurtFx || -9)) / 0.7, 0, 1);
  if (w > 0 || flash > 0) { const grd = g.createRadialGradient(BV_W / 2, BV_H / 2, 180, BV_W / 2, BV_H / 2, BV_W * 0.6); grd.addColorStop(0, 'rgba(120,0,0,0)'); grd.addColorStop(1, `rgba(120,0,0,${Math.min(0.75, w * 0.6 + flash * 0.4)})`); g.fillStyle = grd; g.fillRect(0, 0, BV_W, BV_H); }
  if (c.rl) { const k = clamp((tU - c.rl.t0) / (c.rl.t1 - c.rl.t0), 0, 1); g.fillStyle = 'rgba(8,12,16,.8)'; g.fillRect(BV_W / 2 - 80, BV_H / 2 + 40, 160, 12); g.fillStyle = '#c9a45c'; g.fillRect(BV_W / 2 - 80, BV_H / 2 + 40, 160 * k, 12); }
  if (c.gren !== undefined) SOLD.gren.forEach(gr => { const rel = Math.atan2(gr.z - c.z, gr.x - c.x) - c.cyaw, d = Math.hypot(gr.x - c.x, gr.z - c.z); if (gr.owner !== 'me' && d < 24) { g.fillStyle = 'rgba(255,200,60,.9)'; g.font = '600 20px sans-serif'; g.textAlign = 'center'; g.fillText('💣 ¡GRANADA! ' + Math.round(d * 0.6) + ' m', BV_W / 2 + Math.sin(rel) * 200, BV_H / 2 - Math.cos(rel) * 120); g.textAlign = 'left'; } });
  g.restore();
};
// ---- entradas ----
document.addEventListener('keydown', e => {
  if (!(SOLD.on && SOLD.ctrl) || e.ctrlKey || e.metaKey || e.altKey || /input|select|textarea/i.test((e.target && e.target.tagName) || '')) return; const c = SOLD.ctrl, k = e.key.toLowerCase(), tU = performance.now() / 1000; if (c.dead) return; let used = true;
  if (k === 'z') { srSetPose(c, c.pose === 'rodilla' ? 'pie' : 'rodilla', tU); c.kneelReq = 1; }
  else if (k === 'x') srSetPose(c, c.pose === 'tumbado' ? 'pie' : 'tumbado', tU);
  else if (k === 'r') { SR_K.reload = 1; if (typeof MS !== 'undefined') MS.rHeld = true; } else if (k === 'g') SR_K.gren = 1; else if (k === 'e') SR_K.melee = 1; else if (k === 'h') SR_K.band = 1;
  else if (k === 'b') { c.bayo = !c.bayo; toast('🔪', c.bayo ? 'Bayoneta calada.' : 'Bayoneta descalada.'); } else used = false;
  if (used) { e.preventDefault(); e.stopImmediatePropagation(); }
}, true);
