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
  if (!s.r && typeof b3V3Roster === 'function') s.r = b3V3Roster(blk, f, j);
  const dt = clamp(tU - s.lt, 0, 0.1); s.lt = tU; if (s.r) b3V3MoraleStep(s, blk, dt);
  const nearP = enemy && SOLD.ctrl && !SOLD.ctrl.dead && Math.hypot(SOLD.ctrl.x - x - s.ox, SOLD.ctrl.z - z - s.oz) < 110;      // un bloque que avanza también reacciona si el jugador está cerca
  if (mode === 'rout' || f.flee > 0 || mode === 'charge' || mode === 'melee' || mode === 'gallop' || (sp > 8 && !nearP)) { npcRelease(S, s, key); s.st = 'idle'; s.ox *= 0.9; s.oz *= 0.9; if (enemy) SOLD.visNew.set(key, {x: x + s.ox, z: z + s.oz, yaw: s.yaw, blk}); return null; }
  // ---- amenaza ----
  const pc = SOLD.ctrl && !SOLD.ctrl.dead ? SOLD.ctrl : null; let thr = null, vsPlayer = false, dT = 0;
  const px = x + s.ox, pz = z + s.oz;
  const po = (blk._po && blk.id === SOLD.bid && tU - blk._po.t0 < blk._po.dur) ? blk._po.k : '';                  // orden del jugador a su pelotón (rueda de órdenes)
  if (enemy && pc) { const dd = Math.hypot(pc.x - px, pc.z - pz); if (dd < 150) { thr = {x: pc.x, z: pc.z}; vsPlayer = true; dT = dd; } }
  if (!thr && blk.foe && blk.foe.role !== 'reserve' && (mode === 'fire' || mode === 'skirmish' || mode === 'hold' || mode === 'advance')) { const dd = Math.hypot(blk.foe.x - px, blk.foe.y - pz); if (dd < 190) { thr = {x: blk.foe.x, z: blk.foe.y}; dT = dd; } }
  if (!thr && po === 'avanzar' && blk.foe && Math.hypot(blk.foe.x - px, blk.foe.y - pz) < 420) thr = {x: blk.foe.x, z: blk.foe.y}, dT = Math.hypot(blk.foe.x - px, blk.foe.y - pz);
  if (po === 'reagrupar') { thr = null; vsPlayer = false; }
  let nx = px, nz = pz, ncl = clip, start, face = s.yaw, moveV = 0;
  const sup = SOLD.suppress && tU - SOLD.suppress.t < 0.7 && Math.hypot(SOLD.suppress.x - px, SOLD.suppress.z - pz) < 9;
  if (sup && s.pin <= 0 && thr) s.pin = 3 + h1 * 3; if (s.pin > 0) s.pin -= dt;
  const setSt = (st) => { if (s.st !== st) { s.st = st; s.t0 = tU; s.ph = 'aim'; s.phT = tU + 0.7 + h1 * 1.4; } };
  const goTo = (tx, tz, v) => { const dx = tx - s.ox - x, dz = tz - s.oz - z, d = Math.hypot(dx, dz); if (d < 0.35) return true; const st = Math.min(d, v * dt); s.ox += dx / d * st; s.oz += dz / d * st; face = Math.atan2(dx, dz); moveV = v; const q = covPush(S, x + s.ox, z + s.oz, 0.8); s.ox = q[0] - x; s.oz = q[1] - z; return false; };
  if (!thr) {                                     // ---- sin amenaza: deambula, pasos, tiempos muertos y regresa a su hueco ----
    if (s.st !== 'idle') { npcRelease(S, s, key); setSt('idle'); }
    s.ox *= Math.exp(-dt * (po === 'reagrupar' ? 1.6 : 0.5)); s.oz *= Math.exp(-dt * (po === 'reagrupar' ? 1.6 : 0.5));
    const T = 3.5 + h1 * 3.2, tt = tU + h2 * 20, seg = Math.floor(tt / T), fr = (tt % T) / T, amp = mode === 'hold' ? 1.2 : 2;
    if (s.seg !== seg) { s.seg = seg; s.ax = (hash2(blk.id * 131 + f.i + j * 7, seg, 31) - 0.5) * 2 * amp; s.az = (hash2(blk.id * 131 + f.i + j * 7, seg, 32) - 0.5) * 2 * amp; s.idl = hash2(blk.id * 131 + f.i + j * 7, seg, 77) < 0.35 && (mode === 'hold' || mode === 'reserve' || mode === 'advance') ? (mode === 'hold' && era >= 'C' && hash2(blk.id * 131 + f.i + j * 7, seg, 79) < 0.45 ? 'cavar' : NPC_IDLE[Math.floor(hash2(blk.id * 131 + f.i + j * 7, seg, 78) * NPC_IDLE.length) % NPC_IDLE.length]) : null; }
    if (fr < 0.25) { const L = Math.hypot(s.ax - s.ox, s.az - s.oz); if (L > 0.3) { const sp1 = NPC_V.walk * 0.7 * dt; s.ox += (s.ax - s.ox) / L * Math.min(L, sp1); s.oz += (s.az - s.oz) / L * Math.min(L, sp1);
      const mx = s.ax - s.ox, mz = s.az - s.oz, ml = Math.hypot(mx, mz) || 1, fx = Math.sin(yaw), fz = Math.cos(yaw), dot = (mx * fx + mz * fz) / ml, side = (-mx * Math.cos(yaw) + mz * Math.sin(yaw)) / ml;
      ncl = dot > 0.6 ? 'marcha' : dot < -0.6 ? npcClip('paso_atras', 'marcha') : side > 0 ? npcClip('paso_lateral_de', 'marcha') : npcClip('paso_lateral_iz', 'marcha'); if (dot > 0.6) face = Math.atan2(mx, mz); else face = yaw; start = null; } }
    else if (s.idl && npcHas(s.idl)) { ncl = s.idl; start = tU - (tt % T); }
    if (!(ncl === 'marcha' || ncl.startsWith('paso'))) face = yaw;
    s.yaw = angLerp(s.yaw, face, Math.min(1, dt * 5)); const q = covPush(S, x + s.ox, z + s.oz, 0.8); s.ox = q[0] - x; s.oz = q[1] - z;
    if (enemy) SOLD.visNew.set(key, {x: x + s.ox, z: z + s.oz, yaw: s.yaw, blk}); return {x: x + s.ox, z: z + s.oz, yaw: s.yaw, clip: ncl, start};
  }
  // ---- con amenaza: fuego y movimiento ----
  const dxT = thr.x - px, dzT = thr.z - pz, dir = Math.atan2(dxT, dzT), ux = dxT / (dT || 1), uz = dzT / (dT || 1), post = s.st === 'prone' ? 'tumbado' : s.post;
  const pitch = vsPlayer ? Math.atan2((b3H(S.tf, thr.x, thr.z) + 2.4) - (gy0 + (s.st === 'cover' ? 1.7 : 2.4)), dT) * 57.3 : 0;
  const defensive = po === 'mantener' || po !== 'avanzar' && (mode === 'hold' || !!(blk.d && blk.d.plan && blk.d.plan.k === 'defend')), movers = po === 'avanzar' || ((Math.floor((tU + blk.id * 2.3) / 9) & 1) === s.grp);
  if (s.st === 'idle') { setSt(s.pin > 0 ? 'to_cover' : (!defensive && movers && dT > 45 && !s.shy ? 'bound' : 'fire')); if (s.st === 'to_cover' || (s.st === 'fire' && h2 < 0.6 && S.cov)) { const c = covFind(S, px, pz, thr.x, thr.z, 26); if (c) { npcClaim(S, s, key, c); setSt('to_cover'); } else if (s.pin > 0) setSt('prone'); } }
  if (s.pin > 0 && (s.st === 'fire' || s.st === 'bound')) { const c = covFind(S, px, pz, thr.x, thr.z, 30); if (c) { npcClaim(S, s, key, c); setSt('to_cover'); } else setSt('prone'); }
  if (s.pin > 0 && s.r && s.r.mor < 0.18 && !['fallback', 'charge', 'melee', 'prone', 'crawl'].includes(s.st)) { npcRelease(S, s, key); s.fbx = undefined; setSt('fallback'); if (!s.r.fled) { s.r.fled = 1; srBark(blk.side, s.r.rank, '¡No aguanto más!', px, pz, tU); } }
  if (s.pin > 0 && blk.mm !== undefined && blk.mm < 0.22 && !['fallback', 'charge', 'melee', 'prone', 'crawl'].includes(s.st)) { npcRelease(S, s, key); s.fbx = undefined; setSt('fallback'); }
  if (po === 'cubrirse' && s.pin < 2.5) s.pin = 2.5;
  if (po === 'bayoneta' && s.st !== 'charge' && s.st !== 'melee' && dT < 130 && dT > 3.5 && s.st !== 'fallback') setSt('charge');
  if (po === 'seguidme' && pc && !pc.dead) {                                          // «¡Seguidme!»: corren tras el jugador y se forman detrás de él
    const bx = pc.x - Math.cos(pc.cyaw) * (4 + (f.i % 4) * 1.8) + Math.sin(pc.cyaw) * ((j % 4) - 1.5) * 2.0, bz = pc.z - Math.sin(pc.cyaw) * (4 + (f.i % 4) * 1.8) - Math.cos(pc.cyaw) * ((j % 4) - 1.5) * 2.0;
    const far = Math.hypot(bx - px, bz - pz); if (far > 1.2) { npcRelease(S, s, key); const done = goTo(bx, bz, far > 14 ? NPC_V.run : NPC_V.walk * 1.3); setSt('idle'); const ang = Math.atan2(bx - px, bz - pz);
      s.yaw = angLerp(s.yaw, ang, Math.min(1, dt * 9)); const fx2 = x + s.ox, fz2 = z + s.oz; if (enemy) SOLD.visNew.set(key, {x: fx2, z: fz2, yaw: s.yaw, blk}); return {x: fx2, z: fz2, yaw: s.yaw, clip: far > 14 ? npcClip('correr_agachado', 'marcha') : 'marcha', start: null}; } }
  switch (s.st) {
    case 'fallback': {
      if (s.fbx === undefined) { s.fbx = s.ox - ux * 14; s.fbz = s.oz - uz * 14; }
      const done = goTo(x + s.fbx, z + s.fbz, NPC_V.run); ncl = npcClip('huir', 'correr_agachado'); start = null; face = Math.atan2(-ux, -uz);
      if (done || tU - s.t0 > 5) { s.fbx = undefined; s.pin = 2; setSt('prone'); } break; }
    case 'crawl': {
      const done = goTo(s.ctx, s.ctz, 1.4); ncl = npcClip('reptar_rapido', 'reptar'); start = null; face = Math.atan2(s.ctx - px, s.ctz - pz);
      if (done || tU - s.t0 > 9) { setSt('cover'); s.hide = tU + 1 + h1 * 2; } break; }
    case 'shift': {
      if (s.shtx === undefined) { const amt = (h2 < 0.5 ? -1 : 1) * (4 + h1 * 5); s.shtx = s.ox - uz * amt; s.shtz = s.oz + ux * amt; }
      const done = goTo(x + s.shtx, z + s.shtz, NPC_V.crouch); ncl = npcClip('correr_agachado', 'marcha'); start = null; face = dir;
      if (done || tU - s.t0 > 4) { s.shtx = undefined; setSt('fire'); } break; }
    case 'throw': {
      ncl = npcClip(post === 'rodilla' ? 'lanzar_granada_rodilla' : 'lanzar_granada_pie', 'idle_preparado'); start = s.t0; face = dir; const since = tU - s.t0;
      if (!s.thrown && since > 0.62) { s.thrown = true; s.gn--; const jit = () => (Math.random() - 0.5) * 7; srThrowGren(S, {x: px + Math.sin(s.yaw) * 0.8, z: pz + Math.cos(s.yaw) * 0.8}, {x: thr.x + jit(), z: thr.z + jit()}, 0.9 + dT / 45, 'npc'); }
      if (since > 1.5) { s.thrown = false; setSt(s.cov >= 0 ? 'cover' : 'fire'); s.hide = tU + 1; } break; }
    case 'charge': {
      const pc2 = npcMeleeTarget(px, pz, blk, po, enemy); if (!pc2) { setSt('fire'); break; } const dd = Math.hypot(pc2.x - px, pc2.z - pz) || 1;
      if (dd <= 3.4) { setSt('melee'); s.mt0 = tU; s.mhit = false; break; }
      goTo(pc2.x - (pc2.x - px) / dd * 2.6, pc2.z - (pc2.z - pz) / dd * 2.6, NPC_V.run); ncl = npcClip('cargar_bayoneta', 'correr_agachado'); start = null; face = Math.atan2(pc2.x - px, pc2.z - pz);
      if (tU - s.t0 > 10) setSt('fire'); break; }
    case 'melee': {
      const pc2 = npcMeleeTarget(px, pz, blk, po, enemy); if (!pc2) { setSt('fire'); break; } const dd = Math.hypot(pc2.x - px, pc2.z - pz) || 1; face = Math.atan2(pc2.x - px, pc2.z - pz);
      ncl = npcClip('melee_1', 'idle_preparado'); start = s.mt0; const ph = (tU - s.mt0) % 1.1;
      if (ph > 0.5 && !s.mhit) { s.mhit = true; if (pc2.key) { if (Math.random() < 0.4) srKillNPC(S, V, pc2.key, pc2.p, px, pz, true); } else SOLD.melee.push({x: px, z: pz, ang: Math.atan2(pz - pc2.z, px - pc2.x)}); } if (ph < 0.3) s.mhit = false;
      if (dd > 5.5) setSt('charge'); else if (tU - s.t0 > 14) setSt('fire'); break; }
    case 'bound': {
      if (!s.btx) { const len = 7 + h2 * 6, c = S.cov ? covFind(S, px + ux * len * 0.6, pz + uz * len * 0.6, thr.x, thr.z, 16) : null; if (c && Math.hypot(c.x - px, c.z - pz) > 3) { npcClaim(S, s, key, c); s.btx = c.x - x; s.btz = c.z - z; s.bcov = true; } else { s.btx = s.ox + ux * len; s.btz = s.oz + uz * len; s.bcov = false; } }
      const done = goTo(x + s.btx, z + s.btz, s.bcov ? NPC_V.crouch : NPC_V.crouch); ncl = npcClip('correr_agachado', 'marcha'); start = null; face = dir;
      if (done || tU - s.t0 > 6) { s.btx = null; setSt(s.bcov ? 'cover' : 'fire'); s.hide = tU + 1 + h1 * 2; } break; }
    case 'to_cover': {
      const done = goTo(s.ctx, s.ctz, NPC_V.run); ncl = npcClip('correr_a_cubierto', 'correr_agachado'); start = null; face = Math.atan2(s.ctx - px, s.ctz - pz);
      if (done) { setSt('cover'); s.hide = tU + 1.2 + h1 * 2.5; } else if (tU - s.t0 > 6) setSt('fire'); break; }
    case 'cover': {
      const co = s.cov >= 0 && S.cov ? S.cov.list[s.cov] : null, kd = co ? co.kind : '', alto = co ? co.h : 1.6, suf = era <= 'B' ? '_A' : '_D';
      const HI = co && (alto >= 2.2 || co.vil && kd === 'muro' && co.hw > 2.5 && co.hd > 2.5 || kd === 'fuerte'), ROC = kd === 'piedra', TRU = kd === 'tronco';
      const hideC = HI ? 'pegarse_pared' : ROC ? 'tras_roca' : TRU ? 'agachado_muro_bajo' : 'agachado_muro_bajo', peekC = HI ? 'asomar_esquina_der' : 'asomar_sobre_muro_apuntar', shootC = HI ? 'esquina_der_disparar' + suf : 'muro_disparar' + suf;
      ncl = 'idle_rodilla'; start = null; face = dir; const since = tU - s.t0;
      if (s.ph === 'aim') { if (tU < s.hide) { ncl = since < 0.9 ? npcClip('ponerse_a_cubierto', 'idle_rodilla') : npcClip(hideC, 'idle_rodilla'); start = since < 0.9 ? s.t0 : (npcHas(hideC) ? s.t0 + 0.9 : null); } else { s.ph = 'peek'; s.phT = tU + 0.55; } }
      if (s.ph === 'peek') { ncl = npcClip(peekC, npcClip('asomarse', 'idle_rodilla')); start = s.phT - 0.55; if (tU >= s.phT) { s.ph = 'aim2'; s.phT = tU + 0.7 + h2 * 0.9; } }
      if (s.ph === 'aim2') { ncl = npcAim(era, pitch, 'rodilla', false); start = null; if (tU >= s.phT) { if (po === 'alto_fuego' || (s.r && s.r.ammo <= 0)) { s.phT = tU + 0.6; } else if (!vsPlayer && po !== 'fuego' && npcVolleyWait(blk, s, tU, era, dT)) { s.phT = tU + 0.15; } else { s.ph = 'shoot'; s.phT = tU + 0.7; s.fireT = tU; if (npcMisfire(era, h1, h2)) fxFlash(x + s.ox, b3H(S.tf, x, z) + 1.9, z + s.oz, 0.05); else npcShot(S, V, s, x, z, thr, vsPlayer, dT, true, era, dir); } } }
      if (s.ph === 'shoot') { ncl = npcHas(shootC) ? shootC : npcAim(era, pitch, 'rodilla', true); start = s.fireT; if (tU >= s.phT) { s.ph = 'aim'; s.hide = tU + 1.5 + h1 * 3.5; setSt('cover'); s.t0 = tU; } }
      if (s.pin > 1.5 && s.ph !== 'aim') { s.ph = 'aim'; s.hide = tU + 2.5; } break; }
    case 'prone': {
      face = dir;
      if (s.pin > 1.2) { ncl = npcClip('idle_tumbado', 'idle_rodilla'); start = null; break; }
      if (!s.crawlTried) { s.crawlTried = true; const cv = S.cov ? covFind(S, px, pz, thr.x, thr.z, 18) : null; if (cv && Math.hypot(cv.x - px, cv.z - pz) > 3) { npcClaim(S, s, key, cv); setSt('crawl'); break; } }
      if (s.pin <= 0 && tU - s.t0 > 4 + h1 * 4) { s.crawlTried = false; setSt('fire'); break; }
    }                                                    // sin amenaza inmediata dispara desde el suelo (sigue en la rama de fuego)
    default: {                                   // fire
      if (s.shy) { ncl = 'idle_rodilla'; start = null; face = dir; if (tU - s.t0 > 3 + h1 * 3) { s.shy = false; } break; }
      face = dir; const rel = (CTRL_RELOAD[era] || 1.6) * (1.4 + h1 * 1.0);
      if (s.ph === 'aim') { ncl = npcAim(era, pitch, post, false); start = null; if (tU >= s.phT) {
        const brave = s.brave !== undefined ? s.brave : (s.brave = h1 > 0.9), pcc = SOLD.ctrl;
        if (vsPlayer && brave && dT < 42 && dT > 6 && pcc && !pcc.dead && (pcc.cd > 0.4 || pcc.rl) && s.st === 'fire') { npcRelease(S, s, key); setSt('charge'); break; }
        if (era >= 'D' && dT > 9 && dT < 36 && (s.gn === undefined ? (s.gn = h2 > 0.62 ? 2 : 0) : s.gn) > 0 && Math.random() < 0.22) { setSt('throw'); break; }
        if (po === 'alto_fuego') { s.phT = tU + 0.4; break; }
        if (s.r && s.r.ammo <= 0) { s.phT = tU + 1.5; if (!s.dry) { s.dry = 1; srBark(blk.side, s.r.rank, '¡Sin cartuchos!', px, pz, tU); } break; }
        if (!vsPlayer && po !== 'fuego' && npcVolleyWait(blk, s, tU, era, dT)) { s.phT = tU + 0.15; break; }                       // disciplina de fuego: espera la voz de mando de su pelotón
        s.ph = 'shoot'; s.phT = tU + 0.7; s.fireT = tU; if (npcMisfire(era, h1, h2)) { s.mis = true; fxFlash(x + s.ox + Math.sin(s.yaw) * 1.4, b3H(S.tf, x, z) + 2.1, z + s.oz + Math.cos(s.yaw) * 1.4, 0.05); } else { s.mis = false; npcShot(S, V, s, x, z, thr, vsPlayer, dT, false, era, dir); } } }
      else if (s.ph === 'shoot') { ncl = npcAim(era, pitch, post, true); start = s.fireT; if (tU >= s.phT) { s.ph = 'reload'; s.phT = tU + rel; s.rt0 = tU; } }
      else { ncl = npcClip('recargar_' + post + '_' + era, 'idle_preparado'); start = s.rt0; if (tU >= s.phT) { s.ph = 'aim'; s.phT = tU + 0.8 + h2 * 1.4; if (!defensive && movers && dT > 45 && h2 < 0.8) { setSt('bound'); } else if (dT > 22 && !s.shy && Math.random() < 0.15) { s.shtx = undefined; setSt('shift'); } } }
      break; }
  }
  s.yaw = angLerp(s.yaw, face, Math.min(1, dt * (moveV ? 9 : 5)));
  const lim = 55, L2 = Math.hypot(s.ox, s.oz); if (L2 > lim) { s.ox *= lim / L2; s.oz *= lim / L2; }
  const fx = x + s.ox, fz = z + s.oz; if (enemy) SOLD.visNew.set(key, {x: fx, z: fz, yaw: s.yaw, blk});
  return {x: fx, z: fz, yaw: s.yaw, clip: ncl, start};
}
/* disciplina de fuego del avancarga: las líneas disparan a la voz del oficial, por mitades alternas (fuego de pelotones: mientras una mitad
   dispara, la otra recarga), con una ventana de ~1 s por voz. Los tiradores sueltos (skirmish), los que huyen o los que disparan al jugador
   a quemarropa no esperan. Si pasan más de dos periodos sin voz disparan por su cuenta (humo, ruido y nervios rompen la disciplina). */
function npcVolleyWait(blk, s, tU, era, dT) {
  if (era > 'B' || blk.mode === 'skirmish' || blk.role === 'skirmish' || dT < 22 || s.shy || s.pin > 0) { s.vw = 0; return false; }
  const P = (CTRL_RELOAD[era] || 3) * 1.9 + 1.2, slot = ((tU + blk.id * 0.7) % P + P) % P, w = slot - (s.grp ? P / 2 : 0);
  if (w >= 0 && w < 1.1) { if (blk._volT !== Math.floor(tU / P)) { blk._volT = Math.floor(tU / P); try { srBark(blk.side, 'Oficial', '¡Fuego!', blk.x, blk.y, tU); } catch (e) { } } s.vw = 0; return false; }
  s.vw = (s.vw || 0) + 0.15; return s.vw < P * 2;
}
// fallos de ignición: la chispa de pedernal falla ~1 de cada 6-7 disparos; la cápsula de percusión, muchos menos
function npcMisfire(era, h1, h2) { return Math.random() < (era === 'A' ? 0.13 : era === 'B' ? 0.04 : 0.01); }
// objetivo del cuerpo a cuerpo: el jugador (si es el enemigo) o el soldado enemigo más cercano cuando el pelotón carga a la bayoneta
function npcMeleeTarget(px, pz, blk, po, enemy) {
  const pc = SOLD.ctrl, V = R.bviz; let best = null, bd = 1e9;
  if (enemy && pc && !pc.dead) { best = {x: pc.x, z: pc.z}; bd = Math.hypot(pc.x - px, pc.z - pz); if (po !== 'bayoneta') return best; }
  if (po === 'bayoneta' || !enemy) SR2.all.forEach((p, k) => { if (p.side === blk.side || (V.kmap && V.kmap[k])) return; const d = Math.hypot(p.x - px, p.z - pz); if (d < bd && d < 60) { bd = d; best = {x: p.x, z: p.z, key: k, p}; } });
  return best;
}
// disparo de un NPC: fogonazo (y humo de pólvora negra), y si apunta al jugador, evento para ctrlStep
function npcShot(S, V, s, x, z, thr, vsPlayer, dT, cover, era, dir) {
  if (s.r) { s.r.ammo--; s.r.shots++; }
  const fx = x + s.ox + Math.sin(s.yaw) * 1.6, fz = z + s.oz + Math.cos(s.yaw) * 1.6;
  fxFlash(fx, b3H(S.tf, fx, fz) + 2.1, fz, 0.1); if (era < 'D') bvPart(V, {k: 'smoke', x: fx + Math.sin(s.yaw) * 2, y: fz + Math.cos(s.yaw) * 2, life: 2.2});
  if (vsPlayer) SOLD.shotNew.push({x: x + s.ox, y: b3H(S.tf, x + s.ox, z + s.oz) + (cover ? 1.9 : (s.post === 'rodilla' ? 1.9 : 2.5)), z: z + s.oz, dd: dT, cover});
  else if (Math.random() < 0.35) bvPart(V, {k: 'dust', x: thr.x + (Math.random() - 0.5) * 12, y: thr.z + (Math.random() - 0.5) * 12, life: 0.7});
}
setInterval(() => { if (!SOLD.on) { NPC.clear(); return; } const tU = performance.now() / 1000; NPC.forEach((s, k) => { if (tU - s.lt > 2.5) { if (B3.S) npcRelease(B3.S, s, k); NPC.delete(k); } }); }, 3000);
