/* ===== OBSTÁCULOS DEL CAMPO DE BATALLA, v2: campos de batalla de cada época =====
   Sustituye covEnsure / covPush / covBlock / covFind de obstaculos3d.js. Mismas estructuras (lista, rejilla de 40 u, colisión, línea de tiro) con más tipos y reparto por ÉPOCA:
   · setos y vallas (cobertura blanda: los setos detienen ~50 % de los disparos; las vallas bajas se saltan), pajares (blandos), muros derruidos de altura irregular,
   · época C en adelante: ALAMBRADAS (no detienen balas pero sí a los hombres; con huecos), PARAPETOS de trinchera en zigzag con alambrada delante (D, E), CRÁTERES de obús
     (cobertura para el que está tumbado), y en la época E erizos antitanque, dientes de dragón y carcasas de blindados destruidos.
   Banderas por obstáculo: pass (se puede pasar por encima), soft (probabilidad de que detenga un disparo), nocov (los soldados no lo eligen como cobertura). Hasta ~170 obstáculos.
   Fuentes de diseño: manuales de fortificación de campaña (alambre, trincheras en zigzag, parapetos de sacos), la guerra de setos de Normandía y la práctica de fuego y movimiento. */
Object.assign(COV_KINDS, {
  seto: {h: 1.9, w: 0, col: [0x4a6a38, 0x3f5c30, 0x55763f], soft: 0.5}, valla: {h: 0.95, w: 0, col: [0x7a5a36, 0x6a4c2c], pass: true, nocov: true, soft: 0.3}, heno: {h: 2.6, w: 0, col: [0xb89a4a, 0xa88a3c], soft: 0.55},
  ruina: {h: 2.8, w: 0, col: [0x8a8478, 0x77716a, 0x6a645c]}, alambrada: {h: 0, w: 0, col: [0x3a3a3a], nocov: true, wire: true}, parapeto: {h: 2.0, w: 0, col: [0x6a5a40, 0x5b4c35, 0x786a4a]},
  crater: {h: 0.95, w: 0, col: [0x4a3e2e, 0x3a3024], pass: true}, erizo: {h: 2.2, w: 0, col: [0x4a4e52, 0x3c4044], soft: 0.35}, dientes: {h: 1.7, w: 0, col: [0x8c8c88, 0x7c7c78]}, siniestro: {h: 2.8, w: 0, col: [0x4a4a42, 0x3c3c36, 0x5a4a3a]}
});
COV_KINDS.tronco.pass = true; COV_KINDS.tronco.nocov = true;
// pesos de reparto por época
const COV_ERA = {
  A: {sacos: 1, cajas: 1.4, barricada: 1.5, piedra: 2, tronco: 1.4, carreta: 1.4, muro: 2, seto: 3, valla: 3, heno: 2, ruina: 1.2, crater: 0.6},
  B: {sacos: 1.4, cajas: 1.4, barricada: 1.5, piedra: 2, tronco: 1.2, carreta: 1.2, muro: 2, seto: 3, valla: 3, heno: 1.8, ruina: 1.4, crater: 1.2, alambrada: 0.3},
  C: {sacos: 2.6, cajas: 1.6, barricada: 1.2, piedra: 1.6, tronco: 1, carreta: 0.8, muro: 1.6, seto: 2, valla: 2, heno: 1.2, ruina: 1.6, crater: 2, alambrada: 2},
  D: {sacos: 2.2, cajas: 1.4, barricada: 1, piedra: 1.2, tronco: 0.8, carreta: 0.5, muro: 1.2, seto: 1.2, valla: 1, heno: 0.5, ruina: 2.4, crater: 4.5, alambrada: 3, parapeto: 1},
  E: {sacos: 2, cajas: 1.4, barricada: 1.2, piedra: 1.2, tronco: 0.8, carreta: 0.3, muro: 1.4, seto: 2, valla: 1, heno: 0.5, ruina: 3, crater: 3.5, alambrada: 1.6, erizo: 1.4, dientes: 1.2, siniestro: 1.3}
};
function covLen(kind, rnd) { return {sacos: 5 + rnd() * 3, cajas: 2.2 + rnd() * 2, barricada: 5 + rnd() * 3, piedra: 3 + rnd() * 1.5, tronco: 6 + rnd() * 3, carreta: 4 + rnd(), muro: 6 + rnd() * 4, seto: 8 + rnd() * 8, valla: 8 + rnd() * 8, heno: 3.4 + rnd(), ruina: 4 + rnd() * 4, alambrada: 8 + rnd() * 6, parapeto: 10 + rnd() * 6, crater: 4.8 + rnd() * 1.6, erizo: 2.4, dientes: 9, siniestro: 6.8}[kind]; }
function covDep(kind, rnd) { return {sacos: 1.5, cajas: 2.1, barricada: 0.9, piedra: 3, tronco: 1.1, carreta: 2.3, muro: 0.9, seto: 1.4, valla: 0.35, heno: 3.4, ruina: 0.8, alambrada: 0.5, parapeto: 1.8, crater: 4.8, erizo: 2.4, dientes: 1.5, siniestro: 3.4}[kind]; }
covEnsure = function (S) {
  if (S.cov) { S.cov.group.visible = true; return S.cov; }
  const era = typeof t3Era === 'function' ? t3Era() : 'C', rnd = covRng((S.bid || 1) * 7919 + 13), tf = S.tf, list = [], W = BV_W, Hh = BV_H, wts = COV_ERA[era] || COV_ERA.C, kinds = Object.keys(wts), wsum = kinds.reduce((n, k) => n + wts[k], 0);
  const total = era === 'A' || era === 'B' ? 105 : era === 'C' ? 130 : 160;
  const bad = (x, z) => { const t = tf.town; if (t && Math.hypot(x - t.x, z - t.y) < t.r + 30) return true;
    for (const f of tf.forests || []) if (Math.hypot(x - f.x, z - f.y) < f.r + 6) return true; for (const v of tf.villages || []) if (Math.hypot(x - v.x, z - v.y) < (v.r || 30) + 12) return true;
    for (const e of (tf.lakes || []).concat(tf.cliffs || [], tf.marsh || [])) if (Math.hypot(x - e.x, z - e.y) < Math.max(e.rx || 20, e.ry || 20) + 8) return true;
    if (tf.river && typeof tacRiverX === 'function' && Math.abs(x - tacRiverX(tf, z)) < (tf.river.w || 14) + 14) return true; return false; };
  const push = (o) => list.push(Object.assign({gy: b3H(tf, o.x, o.z), cs: Math.cos(o.yaw), sn: Math.sin(o.yaw), occ: 0}, o));
  // trincheras en zigzag con alambrada delante (épocas D y E): una línea por cada bando
  if (era === 'D' || era === 'E') {
    [-1, 1].forEach(sd => { const x0 = W / 2 + sd * (140 + rnd() * 30), n = 7 + Math.floor(rnd() * 3), z0 = 70 + rnd() * 30, step = (Hh - 140) / n;
      for (let k = 0; k < n; k++) { const x = x0 + (k % 2 ? 3.5 : -3.5), z = z0 + k * step + step / 2; if (bad(x, z)) continue; push({x, z, yaw: Math.PI / 2, hw: Math.min(step / 2 - 1, 7), hd: 0.9, h: COV_KINDS.parapeto.h, kind: 'parapeto'}); }
      for (let k = 0; k < n; k++) { const x = x0 - sd * 24, z = z0 + k * step + step / 2; if (bad(x, z) || k % 3 === 2) continue; push({x, z, yaw: Math.PI / 2 + (rnd() - 0.5) * 0.2, hw: Math.min(step / 2 - 2, 6), hd: 0.25, h: 0, kind: 'alambrada'}); } });
  }
  for (let tries = 0; list.length < total && tries < 7000; tries++) {
    const x = clamp(W / 2 + (rnd() + rnd() + rnd() - 1.5) * W * 0.3, 70, W - 70), z = 40 + rnd() * (Hh - 80); if (bad(x, z)) continue; if (list.some(o => Math.hypot(o.x - x, o.z - z) < (o.kind === 'alambrada' || o.kind === 'parapeto' ? 6 : 12))) continue;
    let r = rnd() * wsum, kind = kinds[0]; for (const k of kinds) { r -= wts[k]; if (r <= 0) { kind = k; break; } }
    const K = COV_KINDS[kind], len = covLen(kind, rnd), dep = covDep(kind, rnd), yaw = (['piedra', 'carreta', 'heno', 'crater', 'erizo', 'siniestro'].includes(kind) ? rnd() * 6.28 : Math.PI / 2 + (rnd() - 0.5) * 0.9);
    if (kind === 'ruina') { let off = 0; const n = 2 + Math.floor(rnd() * 3); for (let q = 0; q < n; q++) { const l = 2.2 + rnd() * 2.2, hh = [2.8, 1.6, 2.4, 1.2][Math.floor(rnd() * 4)]; push({x: x + Math.cos(yaw) * off, z: z + Math.sin(yaw) * off, yaw, hw: l / 2, hd: 0.4, h: hh, kind, pass: false}); off += l + (rnd() < 0.5 ? 1.2 : 0.2); } continue; }
    push({x, z, yaw, hw: len / 2, hd: dep / 2, h: K.h, kind, pass: !!K.pass, soft: K.soft || 0, nocov: !!K.nocov, wire: !!K.wire});
  }
  const boxes = [], rocks = [], cyls = [], col = new THREE.Color();
  list.forEach((o) => {
    const K = COV_KINDS[o.kind], pick = () => K.col[Math.floor(rnd() * K.col.length)], L = (lx, ly, lz) => [o.x + lx * o.cs - lz * o.sn, o.gy + ly, o.z + lx * o.sn + lz * o.cs];
    const box = (lx, ly, lz, sx, sy, sz, yw, c) => boxes.push({p: L(lx, ly, lz), s: [sx, sy, sz], yaw: o.yaw + (yw || 0), c: c || pick()});
    if (o.kind === 'sacos') { const n = Math.max(3, Math.round(o.hw * 2 / 1.3)), w = o.hw * 2 / n; for (let ly = 0; ly < 2; ly++) for (let k = 0; k < n - ly; k++) box(-o.hw + (k + 0.5 + ly * 0.5) * w, 0.42 + ly * 0.85, (rnd() - 0.5) * 0.14, w * 0.96, 0.82, o.hd * 2 * 0.95, (rnd() - 0.5) * 0.12); }
    else if (o.kind === 'cajas') { const nx = o.hw * 2 > 3.6 ? 2 : 1; for (let k = 0; k < nx; k++) { box(-o.hw + (k + 0.5) * o.hw * 2 / nx, 0.95, 0, o.hw * 2 / nx * 0.96, 1.9, o.hd * 2 * 0.96, (rnd() - 0.5) * 0.1); if (rnd() < 0.45) box(-o.hw + (k + 0.5) * o.hw * 2 / nx, 2.55, 0, o.hw * 2 / nx * 0.8, 1.3, o.hd * 2 * 0.8, (rnd() - 0.5) * 0.3); } }
    else if (o.kind === 'barricada') { [0.55, 1.2, 1.85].forEach(y => box(0, y, 0, o.hw * 2, 0.4, 0.2, 0, pick())); for (let k = 0; k < 4; k++) box(-o.hw + 0.3 + k * (o.hw * 2 - 0.6) / 3, 1.15, (k % 2 ? 0.25 : -0.25), 0.3, 2.3, 0.3, 0, K.col[1]); }
    else if (o.kind === 'piedra') { for (let k = 0; k < 3; k++) { const a = rnd() * 6.28, d = rnd() * o.hw * 0.7; rocks.push({p: L(Math.cos(a) * d, 0.8, Math.sin(a) * d), s: [1.2 + rnd() * 1.1, 1.1 + rnd() * 0.8, 1.2 + rnd() * 1.1], yaw: rnd() * 6.28, c: pick()}); } }
    else if (o.kind === 'tronco') cyls.push({p: L(0, 0.55, 0), s: [0.55, o.hw * 2, 0.55], yaw: o.yaw, roll: true, c: pick()});
    else if (o.kind === 'carreta') { box(0, 1.15, 0, o.hw * 2, 0.5, o.hd * 2, 0, pick()); box(-o.hw + 0.3, 1.9, 0, 0.3, 1.8, o.hd * 2, 0, K.col[1]); [-0.7, 0.7].forEach(z => cyls.push({p: L(o.hw * 0.4, 1.05, z * o.hd), s: [1.05, 0.22, 1.05], yaw: o.yaw, roll: false, c: K.col[1]})); }
    else if (o.kind === 'muro') box(0, 0.8, 0, o.hw * 2, 1.6, o.hd * 2, 0, pick());
    else if (o.kind === 'seto') { const n = Math.max(3, Math.round(o.hw * 2 / 2.2)); for (let k = 0; k < n; k++) rocks.push({p: L(-o.hw + (k + 0.5) * o.hw * 2 / n, 0.85 + rnd() * 0.3, (rnd() - 0.5) * 0.4), s: [1.5 + rnd() * 0.5, 1.2 + rnd() * 0.4, 0.9 + rnd() * 0.3], yaw: rnd() * 0.5, c: pick()}); box(0, 0.35, 0, o.hw * 2, 0.7, 0.8, 0, 0x4a3a28); }
    else if (o.kind === 'valla') { const n = Math.max(3, Math.round(o.hw * 2 / 2)); for (let k = 0; k <= n; k++) box(-o.hw + k * o.hw * 2 / n, 0.55, 0, 0.18, 1.1, 0.18, 0, K.col[1]); [0.45, 0.85].forEach(y => box(0, y, 0, o.hw * 2, 0.1, 0.08, 0, K.col[0])); }
    else if (o.kind === 'heno') { cyls.push({p: L(0, 1.0, 0), s: [o.hw * 0.95, 2.0, o.hw * 0.95], yaw: 0, roll: false, c: pick()}); rocks.push({p: L(0, 2.1, 0), s: [o.hw * 0.9, 0.9, o.hw * 0.9], yaw: 0, c: K.col[1]}); }
    else if (o.kind === 'ruina') box(0, o.h / 2, 0, o.hw * 2, o.h, o.hd * 2, 0, pick()), rocks.push({p: L((rnd() - 0.5) * o.hw * 2, 0.35, o.hd + 0.6), s: [0.9, 0.6, 0.8], yaw: rnd() * 6, c: pick()});
    else if (o.kind === 'alambrada') { const n = Math.max(3, Math.round(o.hw * 2 / 2.2)); for (let k = 0; k <= n; k++) box(-o.hw + k * o.hw * 2 / n, 0.65, 0, 0.14, 1.3, 0.14, 0, 0x4a3a28); [0.35, 0.7, 1.05].forEach((y, q) => box(0, y, 0.12 * (q % 2 ? 1 : -1), o.hw * 2, 0.05, 0.05, 0, 0x2a2a2a)); for (let k = 0; k < n; k++) rocks.push({p: L(-o.hw + (k + 0.5) * o.hw * 2 / n, 0.55, 0), s: [0.7, 0.45, 0.5], yaw: rnd() * 3, c: 0x303030}); }
    else if (o.kind === 'parapeto') { box(0, 0.7, 0, o.hw * 2, 1.4, o.hd * 2, 0, pick()); const n = Math.max(3, Math.round(o.hw * 2 / 1.3)); for (let k = 0; k < n; k++) box(-o.hw + (k + 0.5) * o.hw * 2 / n, 1.65, 0, o.hw * 2 / n * 0.95, 0.7, o.hd * 2 * 0.7, (rnd() - 0.5) * 0.1, 0x9c8c64); for (let k = 0; k < 3; k++) box(-o.hw + (k + 0.5) * o.hw * 2 / 3, 1.0, -o.hd - 0.12, 0.18, 2.0, 0.18, 0, 0x4a3a28); }
    else if (o.kind === 'crater') { cyls.push({p: L(0, 0.03, 0), s: [o.hw * 0.9, 0.06, o.hw * 0.9], yaw: 0, roll: false, c: 0x2e261c}); for (let k = 0; k < 9; k++) { const a = k / 9 * 6.28 + rnd() * 0.3, rr = o.hw * 0.95; rocks.push({p: L(Math.cos(a) * rr, 0.35, Math.sin(a) * rr), s: [1.3 + rnd() * 0.5, 0.75, 1.0 + rnd() * 0.4], yaw: a, c: pick()}); } }
    else if (o.kind === 'erizo') { [0, 1.05, 2.1].forEach(a => box(0, 1.1, 0, 3.4, 0.22, 0.22, a, pick())); box(0, 1.1, 0, 0.26, 0.26, 3.4, 0, K.col[1]); }
    else if (o.kind === 'dientes') { const n = 6; for (let k = 0; k < n; k++) { const w = o.hw * 2 / n; box(-o.hw + (k + 0.5) * w, 0.8, (k % 2 ? 0.4 : -0.4), w * 0.8, 1.6, 1.0, 0, pick()); } }
    else if (o.kind === 'siniestro') { box(0, 1.05, 0, o.hw * 2, 1.2, o.hd * 2, 0, pick()); box(o.hw * 0.1, 2.0, 0, o.hw * 0.9, 0.8, o.hd * 1.1, 0.15, K.col[1]); box(o.hw * 0.5, 2.3, 0, o.hw * 0.7, 0.18, 0.18, 0, K.col[2]); [-1, 1].forEach(sd => box(0, 0.5, sd * (o.hd + 0.15), o.hw * 2 * 0.95, 1.0, 0.35, 0, 0x2c2c28)); }
    else box(0, 0.8, 0, o.hw * 2, 1.6, o.hd * 2, 0, pick());
  });
  const mk = (geo, items) => { const m = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({color: 0xffffff}), Math.max(1, items.length)); const mt = new THREE.Matrix4(), q = new THREE.Quaternion(), qz = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), z1 = new THREE.Vector3(0, 0, 1);
    items.forEach((it, i) => { q.setFromAxisAngle(up, -it.yaw); if (it.roll) { qz.setFromAxisAngle(z1, Math.PI / 2); q.multiply(qz); } mt.compose(new THREE.Vector3(it.p[0], it.p[1], it.p[2]), q, new THREE.Vector3(it.s[0], it.s[1], it.s[2])); m.setMatrixAt(i, mt); col.setHex(it.c); m.setColorAt(i, col); });
    m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; m.frustumCulled = false; m.castShadow = false; return m; };
  const group = new THREE.Group(); group.name = 'coberturas';
  group.add(mk(new THREE.BoxGeometry(1, 1, 1), boxes), mk(new THREE.IcosahedronGeometry(1, 0), rocks), mk(new THREE.CylinderGeometry(1, 1, 1, 10), cyls));
  S.scene.add(group);
  const grid = new Map(), CS = 40; list.forEach((o, i) => { const r = Math.max(o.hw, o.hd) + 1; for (let cx = Math.floor((o.x - r) / CS); cx <= Math.floor((o.x + r) / CS); cx++) for (let cz = Math.floor((o.z - r) / CS); cz <= Math.floor((o.z + r) / CS); cz++) { const k = cx * 1000 + cz; (grid.get(k) || grid.set(k, []).get(k)).push(i); } });
  return (S.cov = {list, grid, CS, group});
};
covPush = function (S, x, z, r) {
  const C = S.cov; if (!C) return [x, z];
  for (const i of covCells(S, x, z, x, z, 3)) { const o = C.list[i]; if (o.pass) continue;
    const dx = x - o.x, dz = z - o.z, lx = dx * o.cs + dz * o.sn, lz = -dx * o.sn + dz * o.cs, cx = clamp(lx, -o.hw, o.hw), cz = clamp(lz, -o.hd, o.hd), ex = lx - cx, ez = lz - cz, d = Math.hypot(ex, ez);
    if (d >= r) continue; let nx, nz;
    if (d > 1e-4) { nx = cx + ex / d * r; nz = cz + ez / d * r; } else { const px = o.hw + r - Math.abs(lx), pz = o.hd + r - Math.abs(lz); if (px < pz) { nx = Math.sign(lx || 1) * (o.hw + r); nz = lz; } else { nx = lx; nz = Math.sign(lz || 1) * (o.hd + r); } }
    x = o.x + nx * o.cs - nz * o.sn; z = o.z + nx * o.sn + nz * o.cs; }
  return [x, z];
};
covBlock = function (S, x1, y1, z1, x2, y2, z2) {
  const C = S.cov; if (!C) return null; let best = null;
  for (const i of covCells(S, x1, z1, x2, z2, 4)) { const o = C.list[i]; if (o.h <= 0) continue;
    const ax = x1 - o.x, az = z1 - o.z, bx = x2 - o.x, bz = z2 - o.z, l1 = ax * o.cs + az * o.sn, m1 = -ax * o.sn + az * o.cs, l2 = bx * o.cs + bz * o.sn, m2 = -bx * o.sn + bz * o.cs;
    let t0 = 0, t1 = 1; const dl = l2 - l1, dm = m2 - m1;
    const slab = (p, d, lo, hi) => { if (Math.abs(d) < 1e-9) return p >= lo && p <= hi; let a = (lo - p) / d, b = (hi - p) / d; if (a > b) { const t = a; a = b; b = t; } t0 = Math.max(t0, a); t1 = Math.min(t1, b); return t0 <= t1; };
    if (!slab(l1, dl, -o.hw, o.hw) || !slab(m1, dm, -o.hd, o.hd)) continue;
    const y = y1 + (y2 - y1) * t0; if (y > o.gy + o.h) continue;
    if (o.soft && Math.random() > o.soft) continue;                                  // setos, pajares y vallas: solo detienen una parte de los disparos
    if (!best || t0 < best.t) best = {o, t: t0, x: x1 + (x2 - x1) * t0, z: z1 + (z2 - z1) * t0, y};
  }
  return best;
};
covFind = function (S, x, z, tx, tz, maxD) {
  const C = S.cov; if (!C) return null; let best = null, bd = 1e9;
  const ux = tx - x, uz = tz - z, ul = Math.hypot(ux, uz) || 1;
  for (const i of covCells(S, x - maxD, z - maxD, x + maxD, z + maxD, 0)) { const o = C.list[i]; if (o.occ >= 3 || o.nocov || o.kind === 'tronco' || o.h < 0.85) continue;
    const dx = o.x - x, dz = o.z - z, d = Math.hypot(dx, dz); if (d > maxD || d < 0.5) continue; if ((dx * ux + dz * uz) / (d * ul) < 0.15 && d > 4) continue;
    const pref = o.soft ? 4 : 0;                                                       // se prefiere cobertura dura
    if (d + pref < bd) { bd = d + pref; best = i; } }
  if (best === null) return null; const o = C.list[best], vx = (o.x - tx) / (Math.hypot(o.x - tx, o.z - tz) || 1), vz = (o.z - tz) / (Math.hypot(o.x - tx, o.z - tz) || 1);
  const ext = Math.abs(vx * o.cs + vz * o.sn) * o.hw + Math.abs(-vx * o.sn + vz * o.cs) * o.hd, slot = o.occ, side = (slot - 1) * 1.7;
  return {i: best, x: o.x + vx * (ext + 1.1) + (-vz) * side, z: o.z + vz * (ext + 1.1) + vx * side};
};
