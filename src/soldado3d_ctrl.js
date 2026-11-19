/* ===== VISTA DE SOLDADO, FASE 2: TOMAR EL CONTROL DEL SOLDADO =====
   Dentro de la vista de soldado (soldado3d.js) la tecla C (o el botón «🎮 Tomar el control») hace que el soldado lo maneje el jugador:
     W A S D mover (relativo a donde mira) · Mayús correr · ratón (arrastrar) apuntar · Espacio disparar · Z ponerse de rodillas (más preciso y menos expuesto)
     F coger/soltar el ESTANDARTE de su regimiento (a menos de 30 unidades del centro) · Tab o C volver a la vista de observador · Esc o X salir.
   El soldado no puede alejarse más de 90 unidades de su regimiento. Su figura sustituye a la que ocupaba su hueco en la formación (esa se oculta).
   EFECTOS EN LA BATALLA, pequeños y con tope para no romper el equilibrio:
     · Cada impacto resta al bloque enemigo 14 hombres de su división (como mucho 30 impactos por batalla ≈ 420 hombres) y sube un poco la moral del propio regimiento.
     · Con el estandarte cerca del centro del regimiento, su moral sube 0,006 por segundo (hasta 1); si el abanderado cae, el regimiento pierde 0,12 de moral.
     · RIESGO: bajo fuego o en cuerpo a cuerpo hay probabilidad de caer (≈ 1,2 %/s; menos de rodillas, más con el estandarte). Si caes, la cámara pasa al siguiente soldado.
   Un soldado pesa 1/3.000 de un regimiento: lo que haces importa de forma real pero modesta. */
const CK = {w: 0, a: 0, s: 0, d: 0, shift: 0, space: 0};
const CTRL_RELOAD = {A: 3.2, B: 2.6, C: 2.0, D: 1.6, E: 1.0}, HERO_MEN = 14, HERO_CAP = 30, CTRL_LEASH = 90;
const angLerp = (a, b, k) => { let d = ((b - a + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI; return a + d * k; };
function ctrlStart() {
  const V = R.bviz, blk = soldBlock(V); if (!SOLD.on || !blk) return; const f = blk.figs.find(q => q.i === SOLD.fi); if (!f) return; const w = soldWorld(B3.S, blk, f, SOLD.j), now = performance.now();
  if (blk.type === 'cav') { toast('🎮', 'El control manual solo está disponible para infantería. Elige un soldado de a pie (tecla R).'); return; }
  SOLD.ctrl = {x: w.x, z: w.z, hd: blk.hd, cyaw: blk.hd, kneel: false, flag: false, cd: 0, fireT: -99, clip: 'idle', clipT: 0, shots: 0, hits: 0, dead: false, deadT: 0, lt: now, edge: false, mv: false, run: false};
  SOLD.fp = false; SOLD.pit = 0.12; try { renderBattlePanel(); } catch (e) { }
  toast('🎮', 'Control del soldado: WASD mover · Mayús correr · Espacio disparar · Z rodillas · F estandarte · Tab observar');
}
function ctrlExit(why) {
  const c = SOLD.ctrl; if (!c) return; SOLD.ctrl = null; SOLD.yaw = 0; B3.hide = SOLD.fp ? {bid: SOLD.bid, fi: SOLD.fi, j: SOLD.j} : null; Object.keys(CK).forEach(k => { CK[k] = 0; });
  if (why === 'dead') { const V = R.bviz, blk = soldBlock(V); if (blk) { const sl = soldSlots(blk); if (sl.length) soldSet(blk); else { const nb = soldPick(V, 'next'); if (!(nb && soldSet(nb))) soldStop(); } } toast('💀', `Tu soldado ha caído (${c.hits} impactos, ${c.shots} disparos). Sigues con otro soldado del regimiento.`); }
  try { renderBattlePanel(); } catch (e) { }
}
function ctrlFire(V, blk) {
  const c = SOLD.ctrl, era = t3Era(), now = performance.now() / 1000; c.cd = CTRL_RELOAD[era] || 1.6; c.fireT = now; c.shots++;
  const ax = Math.cos(c.cyaw), az = Math.sin(c.cyaw), mx = c.x + ax * 2.2, mz = c.z + az * 2.2;
  bvPart(V, {k: 'flash', x: mx, y: mz, life: 0.14}); bvPart(V, {k: 'smoke', x: mx + ax * 1.5, y: mz + az * 1.5, life: 1.6});
  let best = null, bd = 1e9;
  V.blocks.forEach(k => { if (k.side === blk.side || !k.figs || k.type === 'art') return;
    k.figs.forEach(q => { if (!q.alive || q.kind === 'gun') return; const dx = q.x - c.x, dz = q.y - c.z, d = Math.hypot(dx, dz); if (d < 4 || d > 170) return;
      const cosA = (dx * ax + dz * az) / d, ang = Math.acos(clamp(cosA, -1, 1)); if (ang > 0.1 + 7 / d) return; if (d < bd) { bd = d; best = {k, q, d}; } }); });
  if (!best) return;
  const mv = c.mv ? 0.65 : 1, p = clamp(0.8 - best.d / 210, 0.1, 0.7) * (c.kneel ? 1.2 : 1) * mv;
  if (Math.random() < p) {
    c.hits++; V.heroHits = (V.heroHits || 0) + 1;
    bvPart(V, {k: 'spark', x: best.q.x, y: best.q.y, life: 0.5});
    if (V.heroHits <= HERO_CAP) { best.k.d.s = Math.max(0.02, best.k.d.s - HERO_MEN / MEN_PER_DIV); blk.mm = Math.min(1, (blk.mm !== undefined ? blk.mm : 0.8) + 0.004); }
  } else bvPart(V, {k: 'dust', x: best.q.x + (Math.random() - 0.5) * 8, y: best.q.y + (Math.random() - 0.5) * 8, life: 0.8});
}
function ctrlStep(S, V, blk, dt) {
  const c = SOLD.ctrl, now = performance.now(), rdt = clamp((now - c.lt) / 1000, 0, 0.1), tU = now / 1000; c.lt = now; c.cd = Math.max(0, c.cd - rdt);
  if (c.dead) { c.deadT += rdt; if (c.deadT > 2.4) { ctrlExit('dead'); return null; } return {x: c.x, z: c.z, aim: c.cyaw, eye: 0.9}; }
  const f = (CK.w ? 1 : 0) - (CK.s ? 1 : 0), r = (CK.d ? 1 : 0) - (CK.a ? 1 : 0), aim = c.cyaw; c.mv = !!(f || r); c.run = !!(CK.shift && c.mv && !c.kneel);
  if (c.mv) { const sp = c.kneel ? 0.9 : c.run ? 9 : 3.2; let vx = Math.cos(aim) * f - Math.sin(aim) * r, vz = Math.sin(aim) * f + Math.cos(aim) * r; const L = Math.hypot(vx, vz) || 1; c.x += vx / L * sp * rdt; c.z += vz / L * sp * rdt; c.face = Math.atan2(vz, vx); }
  const dx0 = c.x - blk.x, dz0 = c.z - blk.y, Rr = Math.hypot(dx0, dz0); c.edge = Rr > CTRL_LEASH; if (c.edge) { c.x = blk.x + dx0 / Rr * CTRL_LEASH; c.z = blk.y + dz0 / Rr * CTRL_LEASH; }
  c.x = clamp(c.x, 5, BV_W - 5); c.z = clamp(c.z, 5, BV_H - 5);
  const firing = now / 1000 - c.fireT < 0.9, aiming = CK.space || firing;
  c.hd = angLerp(c.hd, aiming || !c.mv || SOLD.fp ? aim : c.face, Math.min(1, rdt * 9));
  if (CK.space && c.cd <= 0) ctrlFire(V, blk);
  // estandarte: sube la moral del regimiento mientras se mantiene cerca de su centro
  if (c.flag) { if (Math.hypot(c.x - blk.x, c.z - blk.y) < 40) blk.mm = Math.min(1, (blk.mm !== undefined ? blk.mm : 0.8) + 0.006 * rdt); }
  // riesgo: bajo fuego o en melé hay probabilidad de caer
  const era = t3Era(); let danger = false; V.blocks.forEach(k => { if (danger || k.side === blk.side || k.type === 'art') return; const d = Math.hypot(k.x - c.x, k.y - c.z); if ((k.mode === 'fire' || k.mode === 'skirmish') && d < 170) danger = true; else if ((k.mode === 'charge' || k.mode === 'melee' || k.mode === 'gallop') && d < 60) danger = true; });
  if (danger && Math.random() < 0.012 * rdt * (c.kneel ? 0.55 : 1) * (c.run ? 0.8 : 1) * (c.flag ? 1.6 : 1)) { c.dead = true; c.deadT = 0; c.fireT = -99; c.clip = 'caer_muerto_adelante'; c.clipT = tU; if (c.flag) { blk.mm = Math.max(0, (blk.mm !== undefined ? blk.mm : 0.8) - 0.12); c.flag = false; } }
  else {
    const fireClip = era === 'A' ? 'disparar_A' : era === 'B' ? 'disparar_B' : 'disparar_D', since = tU - c.fireT;
    if (since < 0.8) { c.clip = c.kneel ? 'disparar_rodilla_A' : fireClip; c.clipT = c.fireT; } else if (since < 2.2 && c.cd > 0 && !c.mv) { c.clip = 'recargar_A'; c.clipT = c.fireT + 0.8; }
    else if (CK.space) { c.clip = 'apuntar'; c.clipT = null; } else if (c.kneel) { c.clip = 'agacharse'; c.clipT = null; } else if (c.mv) { c.clip = c.run ? 'marcha_rapida' : 'marcha'; c.clipT = null; }
    else if (c.flag) { c.clip = 'ondear'; c.clipT = null; } else { c.clip = 'idle'; c.clipT = null; }
  }
  return {x: c.x, z: c.z, aim, eye: c.kneel ? 1.7 : 2.55};
}
// la figura que maneja el jugador (se dibuja una vez por fotograma, la primera vez que se llama a b3Fig)
const _b3FigC = b3Fig;
b3Fig = function (S, V, blk, f, era, tU, cp, ca) {
  _b3FigC(S, V, blk, f, era, tU, cp, ca);
  const c = SOLD.on && SOLD.ctrl; if (!c || SOLD._drawT === tU) return; SOLD._drawT = tU;
  const b = soldBlock(V); if (!b) return; const set = b3Set(S, 'fusilero', era, b.tag, null), y = b3H(S.tf, c.x, c.z);
  _b3o.phase = 0.37; _b3o.h = 0; _b3o.bright = 0.5; _b3o.skin = 1; _b3o.horse = 0; _b3o.start = c.clipT; _b3o.tread = 0;
  try { set.add(Math.hypot(c.x - ca.x, y - ca.y, c.z - ca.z), c.x, y, c.z, Math.PI / 2 - c.hd, B3_S, b.tag, c.clip, _b3o); b3Sh(S, c.x, y, c.z, 1.05); } catch (e) { set.add(Math.hypot(c.x - ca.x, y - ca.y, c.z - ca.z), c.x, y, c.z, Math.PI / 2 - c.hd, B3_S, b.tag, 'idle', _b3o); }
};
// teclado del modo control
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
// HUD del modo control
const _b3FrameC = b3Frame;
b3Frame = function (V, b, g, lines, all) {
  _b3FrameC(V, b, g, lines, all); const c = SOLD.on && SOLD.ctrl; if (!c) return; const blk = soldBlock(V); const rel = CTRL_RELOAD[t3Era()] || 1.6;
  g.save(); g.textAlign = 'left'; g.fillStyle = 'rgba(8,12,16,.78)'; g.fillRect(BV_W - 360, BV_H - 150, 350, 128); g.fillStyle = '#f2e6bf'; g.font = '600 18px sans-serif'; g.fillText(c.dead ? '💀 Has caído' : '🎮 Control del soldado', BV_W - 348, BV_H - 124);
  g.font = '16px sans-serif'; g.fillStyle = '#d9d2bc'; g.fillText(`🎯 Impactos ${c.hits} / disparos ${c.shots}  ${V.heroHits >= HERO_CAP ? '(tope de la batalla)' : ''}`, BV_W - 348, BV_H - 98);
  g.fillText(`${c.kneel ? '🧎 De rodillas' : c.run ? '🏃 Corriendo' : '🚶 En pie'}${c.flag ? ' · 🚩 Abanderado' : ''}${c.edge ? ' · límite del regimiento' : ''}`, BV_W - 348, BV_H - 74);
  g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(BV_W - 348, BV_H - 58, 326, 10); g.fillStyle = c.cd > 0 ? '#c9a45c' : '#79c35a'; g.fillRect(BV_W - 348, BV_H - 58, 326 * (1 - c.cd / rel), 10);
  if (blk && blk.mm !== undefined) { g.fillStyle = '#d9d2bc'; g.font = '14px sans-serif'; g.fillText(`Moral del regimiento ${Math.round(blk.mm * 100)} %`, BV_W - 348, BV_H - 34); }
  g.fillStyle = 'rgba(8,12,16,.75)'; g.fillRect(8, BV_H - 62, 860, 26); g.fillStyle = '#d9d2bc'; g.font = '16px sans-serif'; g.fillText('WASD: mover · Mayús: correr · arrastrar: apuntar · Espacio: disparar · Z: rodillas · F: estandarte · Tab: observar · Esc: salir', 14, BV_H - 44);
  g.restore();
};
const ctrlBtn = () => SOLD.on ? `<button data-act="soldctrl" class="${SOLD.ctrl ? 'on' : ''}" data-tip="<b>Tomar el control del soldado</b><br>WASD mover, Mayús correr, Espacio disparar, Z rodillas, F estandarte. Tus impactos y el estandarte ayudan un poco a tu regimiento; si caes, vuelves a la vista de observador.">🎮 ${SOLD.ctrl ? 'Dejar el control' : 'Tomar el control'}</button>` : '';
ACT.soldctrl = () => { if (SOLD.ctrl) ctrlExit(); else ctrlStart(); };
