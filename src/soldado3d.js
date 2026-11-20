/* ===== VISTA DE SOLDADO EN LA BATALLA 3D (nivel 1: solo cámara) =====
   Botón «🪖 Ver como soldado» en el visor de batalla 3D: la cámara se pone en un soldado (o jinete) de un regimiento y lo sigue en tercera persona (hombro) o en primera
   persona (ojos). Se ve exactamente lo que hace su regimiento: marchar, disparar, cargar, huir o caer. No altera la simulación (un soldado pesa 1/3.000 del regimiento).
   Controles: Q / E (o ← / →) soldado anterior / siguiente del mismo regimiento · R otro regimiento (primero los propios) · V primera / tercera persona · arrastrar el ratón o
   Mayús+arrastrar: mirar alrededor · rueda: distancia (tercera persona) · Esc o X: salir. Si el soldado cae, la cámara pasa sola al siguiente.
   Solo infantería y caballería (no artillería ni carros). Se apoya en la misma fórmula de colocación de figuras que b3Fig (batalla3d.js). */
const SOLD = {on: false, bid: -1, fi: 0, j: 0, fp: false, yaw: 0, pit: 0.12, dist: 8, pos: null, saved: null, deadT: 0};
const soldBlocks = V => [...V.blocks.values()].filter(k => (k.type === 'inf' || k.type === 'cav' || (k.type !== 'art' && k.type !== 'tank')) && k.figs && k.figs.some(f => f.alive));
const soldSlots = blk => { const m = blk.type === 'cav' ? 2 : R.lowEnd ? 2 : 6, out = []; blk.figs.forEach(f => { if (f.kind === 'gun' || !f.alive) return; for (let j = 0; j < m; j++) out.push([f.i, j]); }); return out; };
const soldBlock = V => V && [...V.blocks.values()].find(k => k.id === SOLD.bid);
function soldWorld(S, blk, f, j) {         // misma colocación que b3Fig
  const cav = blk.type === 'cav', c = Math.cos(blk.hd), s = Math.sin(blk.hd), sp = cav ? 2.9 : 1.65 * (blk.comp || 1);
  const lx = cav ? 0 : R.lowEnd ? 0 : (j < 3 ? -0.5 : 0.5) * sp * 1.1, ly = cav ? (j ? sp : -sp) : R.lowEnd ? (j ? sp / 2 : -sp / 2) : ((j % 3) - 1) * sp;
  const x = f.x + c * lx - s * ly, z = f.y + s * lx + c * ly; return {x, z, y: b3H(S.tf, x, z), fx: Math.cos(blk.hd), fz: Math.sin(blk.hd)};
}
function soldPick(V, prefer) {
  const mine = soldBlocks(V).filter(k => k.tag === G.player), list = mine.length ? mine : soldBlocks(V); if (!list.length) return null;
  const sel = (V.sel && V.blocks.has(V.sel.d) && list.includes(V.sel)) ? V.sel : (V.hover && list.includes(V.hover) ? V.hover : null);
  if (prefer === 'next') { const i = list.findIndex(k => k.id === SOLD.bid); return list[(i + 1) % list.length]; }
  if (sel) return sel; const cx = B3.cam.tx, cz = B3.cam.tz; return list.slice().sort((a, b) => Math.hypot(a.x - cx, a.y - cz) - Math.hypot(b.x - cx, b.y - cz))[0];
}
function soldSet(blk, slot) { SOLD.bid = blk.id; const sl = soldSlots(blk); if (!sl.length) return false; const pick = slot || sl[Math.floor(hash2(blk.id, G.date.t, 77) * sl.length)]; SOLD.fi = pick[0]; SOLD.j = pick[1]; SOLD.pos = null; return true; }
function soldStart() {
  const V = R.bviz; if (!V || !B3.active || !B3.S) { toast('🪖', 'Activa antes la vista 3D de la batalla («🧊 Ver en 3D»).'); return; }
  const blk = soldPick(V); if (!blk || !soldSet(blk)) { toast('🪖', 'No quedan soldados que seguir en este campo.'); return; }
  SOLD.saved = Object.assign({}, B3.cam); SOLD.on = true; SOLD.yaw = 0; SOLD.pit = SOLD.fp ? 0.02 : 0.14; SOLD.dist = 8; V.follow = false; renderBattlePanel();
}
function soldStop() { if (!SOLD.on) return; SOLD.on = false; B3.hide = null; SOLD.ctrl = null; if (SOLD.saved) Object.assign(B3.cam, SOLD.saved); SOLD.saved = null; try { renderBattlePanel(); } catch (e) { } }
function soldStep(V, dir) {         // soldado anterior / siguiente del regimiento
  const blk = soldBlock(V); if (!blk) return; const sl = soldSlots(blk); if (!sl.length) return;
  let i = sl.findIndex(p => p[0] === SOLD.fi && p[1] === SOLD.j); i = i < 0 ? 0 : (i + dir + sl.length) % sl.length; SOLD.fi = sl[i][0]; SOLD.j = sl[i][1]; SOLD.pos = null;
}
function soldCamera(S, V, dt) {
  const blk = soldBlock(V); let f = blk && blk.figs.find(q => q.i === SOLD.fi);
  if (!blk || !f || (!SOLD.ctrl && !f.alive && f.dying <= 0)) {          // cayó o desapareció: pasa al siguiente
    SOLD.deadT += dt; if (SOLD.deadT > 1.6 || !blk) { SOLD.deadT = 0; let ok = false; if (blk) { const sl = soldSlots(blk); if (sl.length) { ok = soldSet(blk); } } if (!ok) { const nb = soldPick(V, 'next'); ok = nb && soldSet(nb); } if (!ok) { soldStop(); return false; } }
    if (!f) return false;
  } else SOLD.deadT = 0;
  const w = soldWorld(S, blk, f, SOLD.j); SOLD.pos = SOLD.pos ? {x: SOLD.pos.x + (w.x - SOLD.pos.x) * Math.min(1, dt * 9), z: SOLD.pos.z + (w.z - SOLD.pos.z) * Math.min(1, dt * 9)} : {x: w.x, z: w.z};
  const ov = SOLD.ctrl && typeof ctrlStep === 'function' ? ctrlStep(S, V, blk, dt) : null;      // fase 2: el soldado lo maneja el jugador
  const px = ov ? ov.x : SOLD.pos.x, pz = ov ? ov.z : SOLD.pos.z, gy = b3H(S.tf, px, pz), a = ov ? ov.aim : Math.atan2(w.fz, w.fx) + SOLD.yaw, dx = Math.cos(a), dz = Math.sin(a), cam = S.cam;
  B3.hide = SOLD.fp || SOLD.ctrl ? {bid: blk.id, fi: SOLD.fi, j: SOLD.j} : null;
  if (ov) { ctrlCam(S, ov); cam.updateMatrixWorld(); B3.cam.tx = ov.x; B3.cam.tz = ov.z; return true; }
  if (SOLD.fp) {
    const eye = gy + (ov ? ov.eye : 2.55), lx = px + dx * 0.35, lz = pz + dz * 0.35; cam.position.set(lx, Math.max(eye, b3H(S.tf, lx, lz) + 1.6), lz);
    cam.lookAt(lx + dx * 30, cam.position.y + Math.sin(SOLD.pit) * 30 - 0.4, lz + dz * 30);
  } else {
    const d = clamp(B3.cam.d / 100, 4, 24) * (SOLD.dist / 8) || SOLD.dist, bx = px - dx * d, bz = pz - dz * d, by = Math.max(b3H(S.tf, bx, bz) + 1.2, gy + 2.6 + d * 0.28 + SOLD.pit * 4);
    cam.position.set(bx, by, bz); cam.lookAt(px + dx * 6, gy + 2.3, pz + dz * 6);
  }
  cam.updateMatrixWorld(); B3.cam.tx = px; B3.cam.tz = pz; return true;
}
const _b3CameraS = b3Camera;
b3Camera = function (S, V, dt) { if (SOLD.on) { if (!B3.active || !B3.S) { SOLD.on = false; B3.hide = null; } else if (soldCamera(S, V, dt)) return; } return _b3CameraS(S, V, dt); };
// mirar alrededor con el arrastre del ratón (en lugar de desplazar la cámara)
const _b3PanS = b3Pan;
b3Pan = function (dx, dy, h) { if (SOLD.on && SOLD.ctrl) { SOLD.lookDx = (SOLD.lookDx || 0) + dx; SOLD.lookDy = (SOLD.lookDy || 0) + dy; SOLD.ctrl.cyaw += dx * 0.006; SOLD.ctrl.pitch = clamp(SOLD.ctrl.pitch - dy * 0.004, -1.3, 1.3); return; } if (SOLD.on) { SOLD.yaw += dx * 0.006; SOLD.pit = clamp(SOLD.pit - dy * 0.004, -0.5, 0.8); return; } return _b3PanS(dx, dy, h); };
// (la figura seguida no se dibuja en primera persona: lo comprueba b3Fig con B3.hide)
// HUD de la vista de soldado, encima del dibujado 3D
const _b3FrameS = b3Frame;
b3Frame = function (V, b, g, lines, all) {
  _b3FrameS(V, b, g, lines, all); if (!SOLD.on) return; const blk = soldBlock(V); if (!blk) return; const sl = soldSlots(blk), n = sl.findIndex(p => p[0] === SOLD.fi && p[1] === SOLD.j) + 1;
  g.save(); g.textAlign = 'center'; g.fillStyle = 'rgba(8,12,16,.72)'; g.fillRect(BV_W / 2 - 420, 52, 840, 36); g.fillStyle = '#f2e6bf'; g.font = '600 20px sans-serif';
  g.fillText(`🪖 ${SOLD.fp ? 'Primera' : 'Tercera'} persona · soldado ${n || '—'}/${sl.length} · ${blk.a ? blk.a.name : ''} (${G.C[blk.tag] ? G.C[blk.tag].name : ''}) · ${blk.mode || ''}`, BV_W / 2, 77);
  g.font = '16px sans-serif'; g.fillStyle = 'rgba(8,12,16,.75)'; g.fillRect(8, BV_H - 62, 860, 26); g.fillStyle = '#d9d2bc'; g.textAlign = 'left'; g.fillText('Q/E: otro soldado · R: otro regimiento · V: 1.ª/3.ª persona · arrastrar: mirar · rueda: distancia · Esc o X: salir', 14, BV_H - 44);
  if (SOLD.fp) { g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(BV_W / 2 - 10, BV_H / 2); g.lineTo(BV_W / 2 - 3, BV_H / 2); g.moveTo(BV_W / 2 + 3, BV_H / 2); g.lineTo(BV_W / 2 + 10, BV_H / 2); g.moveTo(BV_W / 2, BV_H / 2 - 10); g.lineTo(BV_W / 2, BV_H / 2 - 3); g.moveTo(BV_W / 2, BV_H / 2 + 3); g.lineTo(BV_W / 2, BV_H / 2 + 10); g.stroke(); }
  g.restore();
};
document.addEventListener('keydown', e => {
  if (!SOLD.on || e.ctrlKey || e.metaKey || e.altKey || /input|select|textarea/i.test((e.target && e.target.tagName) || '')) return; const V = R.bviz; if (!V) return; const k = e.key.toLowerCase(); let used = true;
  if (SOLD.ctrl && k !== 'escape' && k !== 'x') return;                     // en modo control las teclas las gestiona soldado3d_ctrl.js
  if (k === 'q' || k === 'arrowleft') soldStep(V, -1); else if (k === 'e' || k === 'arrowright') soldStep(V, 1);
  else if (k === 'r') { const nb = soldPick(V, 'next'); if (nb) soldSet(nb); } else if (k === 'v') { SOLD.fp = !SOLD.fp; SOLD.pit = SOLD.fp ? 0.02 : 0.14; B3.hide = null; }
  else if (k === 'escape' || k === 'x') soldStop(); else used = false;
  if (used) { e.preventDefault(); e.stopPropagation(); }
}, true);
const soldBtn = () => typeof b3On === 'function' && b3On() && R.bviz ? `<button data-act="soldier" class="${SOLD.on ? 'on' : ''}" data-tip="<b>Ver como soldado</b><br>La cámara sigue a un soldado de un regimiento (tercera o primera persona). Q/E cambia de soldado, R de regimiento, V cambia de vista, Esc sale.">🪖 ${SOLD.on ? 'Salir del soldado' : 'Ver como soldado'}</button>${typeof ctrlBtn === 'function' ? ctrlBtn() : ''}` : '';
ACT.soldier = () => { if (SOLD.on) soldStop(); else soldStart(); };
