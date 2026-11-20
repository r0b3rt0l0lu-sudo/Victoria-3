/* ===== IA INDIVIDUAL DE LOS SOLDADOS CERCANOS (vista de soldado) =====
   Cada soldado a menos de 260 unidades de la cámara tiene su propia máquina de estados y su posición libre alrededor de su hueco de la formación. Basada en la doctrina de fuego y
   movimiento de la infantería (avance por tiempos con la mitad del grupo moviéndose mientras la otra cubre con fuego, «bounding overwatch»), el uso de las coberturas, la supresión
   (el fuego cercano obliga a ponerse a cubierto y degrada la puntería) y la baja cadencia real del fuego individual (pocos soldados disparan con puntería; ~un disparo apuntado cada 4–9 s).
   ESTADOS
     idle      sin amenaza al alcance (< 190 u del bloque enemigo o < 150 u del jugador): deambula, da pasos laterales/atrás y hace «tiempos muertos»; vuelve poco a poco a su hueco.
     fire      de pie o de rodillas: apunta (0,8–2,2 s), dispara, recarga (el tiempo de recarga de su época ×1,4–2,4); un 30 % «dispara poco» y se mantiene agachado.
     bound     «salto» de 7–13 u hacia la amenaza corriendo agachado; solo los de un grupo (par/impar de cada 9 s) y solo si el bloque no está en defensa y la amenaza está a > 45 u;
               si hay una cobertura delante a < 16 u, salta de cobertura en cobertura.
     to_cover  corre a una cobertura (la más cercana entre él y la amenaza, con hueco detrás, ≤ 3 soldados por obstáculo) cuando está suprimido o el jugador le dispara cerca.
     cover     de rodillas detrás: oculto 1,5–5 s («ponerse a cubierto»), luego se asoma, apunta, dispara y vuelve a agacharse. Asomado queda expuesto a los disparos del jugador.
     prone     tumbado (sin cobertura y suprimido).
   Velocidades reales (u/s; 1 u ≈ 0,6 m): marcha 2,4 · carrera agachado 4,2 · carrera 6,5. Los hombres no atraviesan los obstáculos (covPush). Si el objetivo es el jugador, cada
   disparo entra en SOLD.shotNew con su origen; ctrlStep decide si lo detiene una cobertura (línea de tiro) o te alcanza. Los soldados no se retiran: aguantan su puesto. */
const NPC = new Map(); let npcGcT = 0;
const NPC_V = {walk: 2.4, crouch: 4.2, run: 6.5};
const NPC_IDLE = ['mirar_alrededor', 'vigilar', 'senal', 'hablar', 'fumar', 'beber', 'atarse_bota', 'recolocar_mochila', 'estirarse', 'idle_preparado'];
const npcHas = n => { const T = window.Troops3D; return !!(T && T.clipInfo && T.clipInfo('fusilero', n)); };
const npcClip = (n, fb) => npcHas(n) ? n : fb;
function npcAim(era, pitch, post, fire) { const T = window.Troops3D; return T && T.troopAimClip ? T.troopAimClip('fusilero', era, 0, pitch, {postura: post, fuego: fire}) : (fire ? ctrlFireClip(era) : 'apuntar'); }
function npcRelease(S, s, key) { if (s.cov >= 0 && S.cov) { const o = S.cov.list[s.cov]; if (o && o.users) { o.users.delete(key); o.occ = o.users.size; } } s.cov = -1; }
function npcClaim(S, s, key, c) { npcRelease(S, s, key); const o = S.cov.list[c.i]; o.users = o.users || new Set(); o.users.add(key); o.occ = o.users.size; s.cov = c.i; s.ctx = c.x; s.ctz = c.z; }
function b3Free(blk, f, j, x, z, yaw, clip, tU, ca, h1, h2) {
  if (!SOLD.on) return null; const V = R.bviz, S = B3.S; if (!V || !S) return null; if (Math.hypot(x - ca.x, z - ca.z) > 260) return null;
  const me = SOLD._meT === tU ? SOLD._me : (SOLD._meT = tU, SOLD._me = soldBlock(V)); if (!me) return null;
  const enemy = blk.side !== me.side, key = blk.id + ':' + f.i + ':' + j, sp = blk.sp || 0, mode = blk.mode, era = t3Era(), gy0 = b3H(S.tf, x, z);
  let s = NPC.get(key); if (!s) { s = {ox: 0, oz: 0, yaw, st: 'idle', t0: tU, tE: tU + h1 * 2, cov: -1, pin: 0, lt: tU, fireT: -99, ph: 'aim', phT: tU + 0.6 + h2, post: h2 < 0.45 ? 'rodilla' : 'pie', grp: (f.i + j) & 1, shy: h1 < 0.3, tx: 0, tz: 0, hide: 0, seg: -1}; NPC.set(key, s); }
  const dt = clamp(tU - s.lt, 0, 0.1); s.lt = tU;
  if (mode === 'rout' || f.flee > 0 || mode === 'charge' || mode === 'melee' || mode === 'gallop' || sp > 8) { npcRelease(S, s, key); s.st = 'idle'; s.ox *= 0.9; s.oz *= 0.9; if (enemy) SOLD.visNew.set(key, {x: x + s.ox, z: z + s.oz, yaw: s.yaw, blk}); return null; }
  // ---- amenaza ----
  const pc = SOLD.ctrl && !SOLD.ctrl.dead ? SOLD.ctrl : null; let thr = null, vsPlayer = false, dT = 0;
  const px = x + s.ox, pz = z + s.oz;
  if (enemy && pc) { const dd = Math.hypot(pc.x - px, pc.z - pz); if (dd < 150) { thr = {x: pc.x, z: pc.z}; vsPlayer = true; dT = dd; } }
  if (!thr && blk.foe && blk.foe.role !== 'reserve' && (mode === 'fire' || mode === 'skirmish' || mode === 'hold' || mode === 'advance')) { const dd = Math.hypot(blk.foe.x - px, blk.foe.y - pz); if (dd < 190) { thr = {x: blk.foe.x, z: blk.foe.y}; dT = dd; } }
  let nx = px, nz = pz, ncl = clip, start, face = s.yaw, moveV = 0;
  const sup = SOLD.suppress && tU - SOLD.suppress.t < 0.7 && Math.hypot(SOLD.suppress.x - px, SOLD.suppress.z - pz) < 9 && enemy;
  if (sup && s.pin <= 0 && thr) s.pin = 3 + h1 * 3; if (s.pin > 0) s.pin -= dt;
  const setSt = (st) => { if (s.st !== st) { s.st = st; s.t0 = tU; s.ph = 'aim'; s.phT = tU + 0.7 + h1 * 1.4; } };
  const goTo = (tx, tz, v) => { const dx = tx - s.ox - x, dz = tz - s.oz - z, d = Math.hypot(dx, dz); if (d < 0.35) return true; const st = Math.min(d, v * dt); s.ox += dx / d * st; s.oz += dz / d * st; face = Math.atan2(dx, dz); moveV = v; const q = covPush(S, x + s.ox, z + s.oz, 0.8); s.ox = q[0] - x; s.oz = q[1] - z; return false; };
  if (!thr) {                                     // ---- sin amenaza: deambula, pasos, tiempos muertos y regresa a su hueco ----
    if (s.st !== 'idle') { npcRelease(S, s, key); setSt('idle'); }
    s.ox *= Math.exp(-dt * 0.5); s.oz *= Math.exp(-dt * 0.5);
    const T = 3.5 + h1 * 3.2, tt = tU + h2 * 20, seg = Math.floor(tt / T), fr = (tt % T) / T, amp = mode === 'hold' ? 1.2 : 2;
    if (s.seg !== seg) { s.seg = seg; s.ax = (hash2(blk.id * 131 + f.i + j * 7, seg, 31) - 0.5) * 2 * amp; s.az = (hash2(blk.id * 131 + f.i + j * 7, seg, 32) - 0.5) * 2 * amp; s.idl = hash2(blk.id * 131 + f.i + j * 7, seg, 77) < 0.35 && (mode === 'hold' || mode === 'reserve' || mode === 'advance') ? NPC_IDLE[Math.floor(hash2(blk.id * 131 + f.i + j * 7, seg, 78) * NPC_IDLE.length) % NPC_IDLE.length] : null; }
    if (fr < 0.25) { const L = Math.hypot(s.ax - s.ox, s.az - s.oz); if (L > 0.3) { const sp1 = NPC_V.walk * 0.7 * dt; s.ox += (s.ax - s.ox) / L * Math.min(L, sp1); s.oz += (s.az - s.oz) / L * Math.min(L, sp1);
      const mx = s.ax - s.ox, mz = s.az - s.oz, ml = Math.hypot(mx, mz) || 1, fx = Math.sin(yaw), fz = Math.cos(yaw), dot = (mx * fx + mz * fz) / ml, side = (-mx * Math.cos(yaw) + mz * Math.sin(yaw)) / ml;
      ncl = dot > 0.6 ? 'marcha' : dot < -0.6 ? npcClip('paso_atras', 'marcha') : side > 0 ? npcClip('paso_lateral_de', 'marcha') : npcClip('paso_lateral_iz', 'marcha'); if (dot > 0.6) face = Math.atan2(mx, mz); else face = yaw; start = null; } }
    else if (s.idl && npcHas(s.idl)) { ncl = s.idl; start = tU - (tt % T); }
    if (!(ncl === 'marcha' || ncl.startsWith('paso'))) face = yaw;
    s.yaw = angLerp(s.yaw, face, Math.min(1, dt * 5)); const q = covPush(S, x + s.ox, z + s.oz, 0.8); s.ox = q[0] - x; s.oz = q[1] - z;
    if (enemy) SOLD.visNew.set(key, {x: x + s.ox, z: z + s.oz, yaw: s.yaw, blk}); return {x: x + s.ox, z: z + s.oz, yaw: s.yaw, clip: ncl, start};
  }
  // ---- con amenaza: fuego y movimiento ----
  const dxT = thr.x - px, dzT = thr.z - pz, dir = Math.atan2(dxT, dzT), ux = dxT / (dT || 1), uz = dzT / (dT || 1), post = s.post;
  const pitch = vsPlayer ? Math.atan2((b3H(S.tf, thr.x, thr.z) + 2.4) - (gy0 + (s.st === 'cover' ? 1.7 : 2.4)), dT) * 57.3 : 0;
  const defensive = mode === 'hold' || !!(blk.d && blk.d.plan && blk.d.plan.k === 'defend'), movers = ((Math.floor((tU + blk.id * 2.3) / 9) & 1) === s.grp);
  if (s.st === 'idle') { setSt(s.pin > 0 ? 'to_cover' : (!defensive && movers && dT > 45 && !s.shy ? 'bound' : 'fire')); if (s.st === 'to_cover' || (s.st === 'fire' && h2 < 0.6 && S.cov)) { const c = covFind(S, px, pz, thr.x, thr.z, 26); if (c) { npcClaim(S, s, key, c); setSt('to_cover'); } else if (s.pin > 0) setSt('prone'); } }
  if (s.pin > 0 && (s.st === 'fire' || s.st === 'bound')) { const c = covFind(S, px, pz, thr.x, thr.z, 30); if (c) { npcClaim(S, s, key, c); setSt('to_cover'); } else setSt('prone'); }
  switch (s.st) {
    case 'bound': {
      if (!s.btx) { const len = 7 + h2 * 6, c = S.cov ? covFind(S, px + ux * len * 0.6, pz + uz * len * 0.6, thr.x, thr.z, 16) : null; if (c && Math.hypot(c.x - px, c.z - pz) > 3) { npcClaim(S, s, key, c); s.btx = c.x - x; s.btz = c.z - z; s.bcov = true; } else { s.btx = s.ox + ux * len; s.btz = s.oz + uz * len; s.bcov = false; } }
      const done = goTo(x + s.btx, z + s.btz, s.bcov ? NPC_V.crouch : NPC_V.crouch); ncl = npcClip('correr_agachado', 'marcha'); start = null; face = dir;
      if (done || tU - s.t0 > 6) { s.btx = null; setSt(s.bcov ? 'cover' : 'fire'); s.hide = tU + 1 + h1 * 2; } break; }
    case 'to_cover': {
      const done = goTo(s.ctx, s.ctz, NPC_V.run); ncl = npcClip('correr_a_cubierto', 'correr_agachado'); start = null; face = Math.atan2(s.ctx - px, s.ctz - pz);
      if (done) { setSt('cover'); s.hide = tU + 1.2 + h1 * 2.5; } else if (tU - s.t0 > 6) setSt('fire'); break; }
    case 'cover': {
      ncl = 'idle_rodilla'; start = null; face = dir; const since = tU - s.t0;
      if (s.ph === 'aim') { if (tU < s.hide) { ncl = since < 0.9 ? npcClip('ponerse_a_cubierto', 'idle_rodilla') : 'idle_rodilla'; start = since < 0.9 ? s.t0 : null; } else { s.ph = 'peek'; s.phT = tU + 0.55; } }
      if (s.ph === 'peek') { ncl = npcClip('asomarse', 'idle_rodilla'); start = s.phT - 0.55; if (tU >= s.phT) { s.ph = 'aim2'; s.phT = tU + 0.7 + h2 * 0.9; } }
      if (s.ph === 'aim2') { ncl = npcAim(era, pitch, 'rodilla', false); start = null; if (tU >= s.phT) { s.ph = 'shoot'; s.phT = tU + 0.7; s.fireT = tU; npcShot(S, V, s, x, z, thr, vsPlayer, dT, true, era, dir); } }
      if (s.ph === 'shoot') { ncl = npcAim(era, pitch, 'rodilla', true); start = s.fireT; if (tU >= s.phT) { s.ph = 'aim'; s.hide = tU + 1.5 + h1 * 3.5; setSt('cover'); s.t0 = tU; } }
      if (s.pin > 1.5 && s.ph !== 'aim') { s.ph = 'aim'; s.hide = tU + 2.5; } break; }
    case 'prone': { ncl = npcClip('idle_tumbado', 'idle_rodilla'); start = null; face = dir; if (s.pin <= 0) setSt('fire'); break; }
    default: {                                   // fire
      if (s.shy) { ncl = 'idle_rodilla'; start = null; face = dir; if (tU - s.t0 > 3 + h1 * 3) { s.shy = false; } break; }
      face = dir; const rel = (CTRL_RELOAD[era] || 1.6) * (1.4 + h1 * 1.0);
      if (s.ph === 'aim') { ncl = npcAim(era, pitch, post, false); start = null; if (tU >= s.phT) { s.ph = 'shoot'; s.phT = tU + 0.7; s.fireT = tU; npcShot(S, V, s, x, z, thr, vsPlayer, dT, false, era, dir); } }
      else if (s.ph === 'shoot') { ncl = npcAim(era, pitch, post, true); start = s.fireT; if (tU >= s.phT) { s.ph = 'reload'; s.phT = tU + rel; s.rt0 = tU; } }
      else { ncl = npcClip('recargar_' + post + '_' + era, 'idle_preparado'); start = s.rt0; if (tU >= s.phT) { s.ph = 'aim'; s.phT = tU + 0.8 + h2 * 1.4; if (!defensive && movers && dT > 45 && h2 < 0.8) { setSt('bound'); } } }
      break; }
  }
  s.yaw = angLerp(s.yaw, face, Math.min(1, dt * (moveV ? 9 : 5)));
  const lim = 55, L2 = Math.hypot(s.ox, s.oz); if (L2 > lim) { s.ox *= lim / L2; s.oz *= lim / L2; }
  const fx = x + s.ox, fz = z + s.oz; if (enemy) SOLD.visNew.set(key, {x: fx, z: fz, yaw: s.yaw, blk});
  return {x: fx, z: fz, yaw: s.yaw, clip: ncl, start};
}
// disparo de un NPC: fogonazo (y humo de pólvora negra), y si apunta al jugador, evento para ctrlStep
function npcShot(S, V, s, x, z, thr, vsPlayer, dT, cover, era, dir) {
  const fx = x + s.ox + Math.sin(s.yaw) * 1.6, fz = z + s.oz + Math.cos(s.yaw) * 1.6;
  bvPart(V, {k: 'flash', x: fx, y: fz, life: 0.11}); if (era < 'D') bvPart(V, {k: 'smoke', x: fx + Math.sin(s.yaw) * 2, y: fz + Math.cos(s.yaw) * 2, life: 2.2});
  if (vsPlayer) SOLD.shotNew.push({x: x + s.ox, y: b3H(S.tf, x + s.ox, z + s.oz) + (cover ? 1.9 : (s.post === 'rodilla' ? 1.9 : 2.5)), z: z + s.oz, dd: dT, cover});
  else if (Math.random() < 0.35) bvPart(V, {k: 'dust', x: thr.x + (Math.random() - 0.5) * 12, y: thr.z + (Math.random() - 0.5) * 12, life: 0.7});
}
setInterval(() => { if (!SOLD.on) { NPC.clear(); return; } const tU = performance.now() / 1000; NPC.forEach((s, k) => { if (tU - s.lt > 2.5) { if (B3.S) npcRelease(B3.S, s, k); NPC.delete(k); } }); }, 3000);
