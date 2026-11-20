/* ===== OBSTÁCULOS DE COBERTURA EN LA VISTA DE SOLDADO =====
   Al entrar en la vista de soldado se siembran por el campo ~80 obstáculos pequeños (determinista según el id de la batalla): hileras de sacos de arena, pilas de cajas, barricadas
   de tablones, peñascos, troncos caídos, carretas volcadas y muros bajos. Se dibujan con mallas instanciadas (≤ 3 llamadas de dibujo) y tienen:
     · COLISIÓN para el jugador y los soldados (cajas orientadas, radio 0,8; los troncos de 1,1 de alto se pueden pasar por encima),
     · LÍNEA DE TIRO: un segmento de tirador a objetivo queda bloqueado si cruza un obstáculo por debajo de su altura (altura en unidades: 1 u ≈ 0,6 m; un soldado de pie mide 2,9 u;
       de rodillas ≈ 1,9 u; sacos 1,7 u, cajas 2,0 u, barricada 2,3 u, peñasco 2,2 u, carreta 2,4 u, muro 1,6 u, tronco 1,1 u) → de rodillas detrás de una cobertura de ≥ 1,7 u no te ven
       ni te alcanzan salvo si te asomas,
     · BÚSQUEDA DE COBERTURA para los NPC: el obstáculo más cercano entre el soldado y la amenaza, con hueco detrás (máx. 3 soldados por obstáculo).
   Reparto: más densos en el centro del campo, evitando lagos, riscos, marismas, bosques, aldeas, el pueblo y el río. Rejilla espacial de 40 u para las consultas. */
const COV_KINDS = {
  sacos: {h: 1.7, w: 0.26, col: [0x9c8c64, 0xa8986c, 0x8a7a54]}, cajas: {h: 2.0, w: 0.16, col: [0x7e5d3a, 0x6f5232, 0x8a6a44]}, barricada: {h: 2.3, w: 0.14, col: [0x6e4e2c, 0x5f4426]},
  piedra: {h: 2.2, w: 0.16, col: [0x7d7a72, 0x6d6a62, 0x8a867c]}, tronco: {h: 1.1, w: 0.12, col: [0x5b4128, 0x4c3520]}, carreta: {h: 2.4, w: 0.06, col: [0x5a3e24, 0x4a3320]}, muro: {h: 1.6, w: 0.08, col: [0x8a867c, 0x7a766c]}
};
const covRng = seed => { let a = seed >>> 0; return () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; }; };
function covEnsure(S) {
  if (S.cov) { S.cov.group.visible = true; return S.cov; }
  const rnd = covRng((S.bid || 1) * 7919 + 13), tf = S.tf, list = [], W = BV_W, Hh = BV_H, kinds = Object.keys(COV_KINDS), wsum = kinds.reduce((n, k) => n + COV_KINDS[k].w, 0);
  const bad = (x, z) => { const t = tf.town; if (t && Math.hypot(x - t.x, z - t.y) < t.r + 30) return true;
    for (const f of tf.forests || []) if (Math.hypot(x - f.x, z - f.y) < f.r + 6) return true; for (const v of tf.villages || []) if (Math.hypot(x - v.x, z - v.y) < (v.r || 30) + 12) return true;
    for (const e of (tf.lakes || []).concat(tf.cliffs || [], tf.marsh || [])) if (Math.hypot(x - e.x, z - e.y) < Math.max(e.rx || 20, e.ry || 20) + 8) return true;
    if (tf.river && typeof tacRiverX === 'function' && Math.abs(x - tacRiverX(tf, z)) < (tf.river.w || 14) + 14) return true; return false; };
  for (let tries = 0; list.length < 80 && tries < 5000; tries++) {
    const x = clamp(W / 2 + (rnd() + rnd() + rnd() - 1.5) * W * 0.3, 70, W - 70), z = 40 + rnd() * (Hh - 80); if (bad(x, z) || list.some(o => Math.hypot(o.x - x, o.z - z) < 13)) continue;
    let r = rnd() * wsum, kind = kinds[0]; for (const k of kinds) { r -= COV_KINDS[k].w; if (r <= 0) { kind = k; break; } }
    const K = COV_KINDS[kind], len = kind === 'sacos' ? 5 + rnd() * 3 : kind === 'cajas' ? 2.2 + rnd() * 2 : kind === 'barricada' ? 5 + rnd() * 3 : kind === 'piedra' ? 3 + rnd() * 1.5 : kind === 'tronco' ? 6 + rnd() * 3 : kind === 'carreta' ? 4 + rnd() : 6 + rnd() * 4;
    const dep = kind === 'sacos' ? 1.5 : kind === 'cajas' ? 2.1 : kind === 'barricada' ? 0.9 : kind === 'piedra' ? 3 : kind === 'tronco' ? 1.1 : kind === 'carreta' ? 2.3 : 0.9, yaw = (kind === 'piedra' || kind === 'carreta' ? rnd() * 6.28 : Math.PI / 2 + (rnd() - 0.5) * 0.9);
    list.push({x, z, yaw, hw: len / 2, hd: dep / 2, h: K.h, kind, gy: b3H(tf, x, z), cs: Math.cos(yaw), sn: Math.sin(yaw), occ: 0});
  }
  const boxes = [], rocks = [], cyls = [], col = new THREE.Color();
  list.forEach((o, i) => {
    const K = COV_KINDS[o.kind], pick = () => K.col[Math.floor(rnd() * K.col.length)], L = (lx, ly, lz) => [o.x + lx * o.cs - lz * o.sn, o.gy + ly, o.z + lx * o.sn + lz * o.cs];
    const box = (lx, ly, lz, sx, sy, sz, yw, c) => boxes.push({p: L(lx, ly, lz), s: [sx, sy, sz], yaw: o.yaw + (yw || 0), c: c || pick()});
    if (o.kind === 'sacos') { const n = Math.max(3, Math.round(o.hw * 2 / 1.3)), w = o.hw * 2 / n; for (let ly = 0; ly < 2; ly++) for (let k = 0; k < n - ly; k++) box(-o.hw + (k + 0.5 + ly * 0.5) * w, 0.42 + ly * 0.85, (rnd() - 0.5) * 0.14, w * 0.96, 0.82, o.hd * 2 * 0.95, (rnd() - 0.5) * 0.12); }
    else if (o.kind === 'cajas') { const nx = o.hw * 2 > 3.6 ? 2 : 1; for (let k = 0; k < nx; k++) { box(-o.hw + (k + 0.5) * o.hw * 2 / nx, 0.95, 0, o.hw * 2 / nx * 0.96, 1.9, o.hd * 2 * 0.96, (rnd() - 0.5) * 0.1); if (rnd() < 0.45) box(-o.hw + (k + 0.5) * o.hw * 2 / nx, 2.55, 0, o.hw * 2 / nx * 0.8, 1.3, o.hd * 2 * 0.8, (rnd() - 0.5) * 0.5); } }
    else if (o.kind === 'barricada') { [0.55, 1.2, 1.85].forEach(y => box(0, y, 0, o.hw * 2, 0.4, 0.2, 0, pick())); for (let k = 0; k < 4; k++) box(-o.hw + 0.3 + k * (o.hw * 2 - 0.6) / 3, 1.15, (k % 2 ? 0.25 : -0.25), 0.3, 2.3, 0.3, 0, K.col[1]); }
    else if (o.kind === 'piedra') { for (let k = 0; k < 3; k++) { const a = rnd() * 6.28, d = rnd() * o.hw * 0.7; rocks.push({p: L(Math.cos(a) * d, 0.8, Math.sin(a) * d), s: [1.2 + rnd() * 1.1, 1.1 + rnd() * 0.8, 1.2 + rnd() * 1.1], yaw: rnd() * 6.28, c: pick()}); } }
    else if (o.kind === 'tronco') cyls.push({p: L(0, 0.55, 0), s: [0.55, o.hw * 2, 0.55], yaw: o.yaw, roll: true, c: pick()});
    else if (o.kind === 'carreta') { box(0, 1.15, 0, o.hw * 2, 0.5, o.hd * 2, 0, pick()); box(-o.hw + 0.3, 1.9, 0, 0.3, 1.8, o.hd * 2, 0, K.col[1]); [-0.7, 0.7].forEach(z => cyls.push({p: L(o.hw * 0.4, 1.05, z * o.hd), s: [1.05, 0.22, 1.05], yaw: o.yaw, roll: false, c: K.col[1]})); }
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
}
function covCells(S, x1, z1, x2, z2, pad) {         // obstáculos cuyas celdas cruza el rectángulo del segmento
  const C = S.cov; if (!C) return []; const out = new Set(), CS = C.CS;
  for (let cx = Math.floor((Math.min(x1, x2) - pad) / CS); cx <= Math.floor((Math.max(x1, x2) + pad) / CS); cx++) for (let cz = Math.floor((Math.min(z1, z2) - pad) / CS); cz <= Math.floor((Math.max(z1, z2) + pad) / CS); cz++) { const a = C.grid.get(cx * 1000 + cz); if (a) a.forEach(i => out.add(i)); }
  return [...out];
}
// empuja una posición fuera de los obstáculos (radio r); los troncos bajos se pueden pasar
function covPush(S, x, z, r) {
  const C = S.cov; if (!C) return [x, z];
  for (const i of covCells(S, x, z, x, z, 3)) { const o = C.list[i]; if (o.kind === 'tronco') continue;
    const dx = x - o.x, dz = z - o.z, lx = dx * o.cs + dz * o.sn, lz = -dx * o.sn + dz * o.cs, cx = clamp(lx, -o.hw, o.hw), cz = clamp(lz, -o.hd, o.hd), ex = lx - cx, ez = lz - cz, d = Math.hypot(ex, ez);
    if (d >= r) continue; let nx, nz;
    if (d > 1e-4) { nx = cx + ex / d * r; nz = cz + ez / d * r; } else { const px = o.hw + r - Math.abs(lx), pz = o.hd + r - Math.abs(lz); if (px < pz) { nx = Math.sign(lx || 1) * (o.hw + r); nz = lz; } else { nx = lx; nz = Math.sign(lz || 1) * (o.hd + r); } }
    x = o.x + nx * o.cs - nz * o.sn; z = o.z + nx * o.sn + nz * o.cs; }
  return [x, z];
}
// ¿hay un obstáculo en el segmento tirador → objetivo que lo bloquee? (devuelve el obstáculo y el punto de impacto o null)
function covBlock(S, x1, y1, z1, x2, y2, z2) {
  const C = S.cov; if (!C) return null; let best = null;
  for (const i of covCells(S, x1, z1, x2, z2, 4)) { const o = C.list[i];
    const ax = x1 - o.x, az = z1 - o.z, bx = x2 - o.x, bz = z2 - o.z, l1 = ax * o.cs + az * o.sn, m1 = -ax * o.sn + az * o.cs, l2 = bx * o.cs + bz * o.sn, m2 = -bx * o.sn + bz * o.cs;
    let t0 = 0, t1 = 1; const dl = l2 - l1, dm = m2 - m1;
    const slab = (p, d, lo, hi) => { if (Math.abs(d) < 1e-9) return p >= lo && p <= hi; let a = (lo - p) / d, b = (hi - p) / d; if (a > b) { const t = a; a = b; b = t; } t0 = Math.max(t0, a); t1 = Math.min(t1, b); return t0 <= t1; };
    if (!slab(l1, dl, -o.hw, o.hw) || !slab(m1, dm, -o.hd, o.hd)) continue;
    const y = y1 + (y2 - y1) * t0; if (y > o.gy + o.h) continue;                     // el proyectil pasa por encima
    if (!best || t0 < best.t) best = {o, t: t0, x: x1 + (x2 - x1) * t0, z: z1 + (z2 - z1) * t0, y};
  }
  return best;
}
// cobertura para un soldado en (x,z) frente a una amenaza en (tx,tz): obstáculo más cercano que quede entre ambos, con hueco libre detrás
function covFind(S, x, z, tx, tz, maxD) {
  const C = S.cov; if (!C) return null; let best = null, bd = 1e9;
  const ux = tx - x, uz = tz - z, ul = Math.hypot(ux, uz) || 1;
  for (const i of covCells(S, x - maxD, z - maxD, x + maxD, z + maxD, 0)) { const o = C.list[i]; if (o.occ >= 3 || o.kind === 'tronco') continue;
    const dx = o.x - x, dz = o.z - z, d = Math.hypot(dx, dz); if (d > maxD || d < 0.5) continue; if ((dx * ux + dz * uz) / (d * ul) < 0.15 && d > 4) continue;          // debe quedar delante o a un lado, no detrás
    if (d < bd) { bd = d; best = i; } }
  if (best === null) return null; const o = C.list[best], vx = (o.x - tx) / (Math.hypot(o.x - tx, o.z - tz) || 1), vz = (o.z - tz) / (Math.hypot(o.x - tx, o.z - tz) || 1);
  const ext = Math.abs(vx * o.cs + vz * o.sn) * o.hw + Math.abs(-vx * o.sn + vz * o.cs) * o.hd, slot = o.occ, side = (slot - 1) * 1.7;
  return {i: best, x: o.x + vx * (ext + 1.1) + (-vz) * side, z: o.z + vz * (ext + 1.1) + vx * side};
}

// destellos pequeños (fogonazos y trazadoras) con tamaño propio: los del visor son muy grandes y, con muchos tiradores juntos, forman un resplandor que tapa la escena
function fxEnsure(S) {
  if (S.fx) return S.fx; const N = 128, geo = new THREE.BufferGeometry(), pos = new Float32Array(N * 3); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setDrawRange(0, 0);
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({size: 1.1, color: 0xffd98a, transparent: true, opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true})); pts.frustumCulled = false; S.scene.add(pts);
  return (S.fx = {pts, pos, geo, N, items: []});
}
function fxFlash(x, y, z, life) { const S = B3.S; if (!S) return; const F = fxEnsure(S); if (F.items.length < F.N) F.items.push({x, y, z, t: performance.now() / 1000, life}); }
function fxUpdate(S) { const F = S.fx; if (!F) return; const t = performance.now() / 1000; F.items = F.items.filter(i => t - i.t < i.life); F.items.forEach((i, k) => { F.pos[k * 3] = i.x; F.pos[k * 3 + 1] = i.y; F.pos[k * 3 + 2] = i.z; }); F.geo.setDrawRange(0, F.items.length); F.geo.attributes.position.needsUpdate = true; }
