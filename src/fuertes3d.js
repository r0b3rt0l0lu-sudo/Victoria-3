/* ===== FUERTES, REDUCTOS, BATERÍAS Y TRINCHERAS EN EL VISOR 3D (sustituye a b3Forts) =====
   Antes eran pirámides macizas de tierra con una placa negra encima: de cerca eran muros inmensos y el interior un plano oscuro. Ahora son obras HUECAS con piezas reales:
   · FUERTE: muros de cortina de piedra con almenas, 4 torres de esquina con tejado y bandera, puerta con puente sobre el foso en el frente, patio con edificio y cañones en el
     muro delantero; foso a su alrededor.
   · REDUCTO: parapeto de tierra con gaviones, empalizada de estacas delante, bastiones en las esquinas y entrada trasera.
   · BATERÍA: terraplén frontal con troneras y gaviones, alas laterales, plataforma de madera con cañones, cajas y barriles de pólvora detrás (abierta por la retaguardia).
   · TRINCHERA: parapeto en zigzag con sacos y una banqueta (épocas modernas).
   El daño abre brechas en los muros (primero por el frente y la puerta); destruida queda un montón de escombros. Cada tramo de muro es un obstáculo real (colisión y línea de
   tiro) en la vista de soldado: no se puede atravesar salvo por la puerta, las brechas o escalando por las escalas que aparecen cuando el enemigo asalta. Los que están dentro
   disparan por encima del muro. Un único InstancedMesh por tipo de pieza: 3 llamadas de dibujo por obra. */
const FZ = {box: null, cyl: null, cone: null, mats: {}};
function fzMat() { return FZ.m || (FZ.m = new THREE.MeshLambertMaterial({color: 0xffffff})); }
function fzBuild(S, b, f) {
  const boxes = [], cyls = [], cones = [], obs = [], dead = f.hp <= 0, r = clamp(f.hp / f.hpMax, 0, 1), dir = f.side === 'A' ? 1 : -1, W = f.w, H = f.h, X = f.x, Z = f.y, g = (x, z) => b3H(S.tf, x, z);
  const era = typeof t3Era === 'function' ? t3Era() : 'C', hashf = k => hash2(f.id * 17 + 3, k, 91);
  const C = {stone: 0x9a8c72, stone2: 0x867a62, earth: 0x7a6342, earth2: 0x5f4d32, dirt: 0x8a7752, wood: 0x5a4028, wood2: 0x7a5a38, gab: 0x8a7448, roof: 0x7a3d2a, dark: 0x2f2820, sack: 0x9c8c64, iron: 0x3a3a3c, rubble: 0x4a4034};
  const box = (cx, by, cz, sx, sy, sz, col) => boxes.push({p: [cx, by + sy / 2, cz], s: [sx, sy, sz], c: col});
  const cyl = (cx, by, cz, rad, hh, col, roll, yaw) => cyls.push({p: [cx, by + (roll ? rad : hh / 2), cz], s: [rad, hh, rad], c: col, roll: !!roll, yaw: yaw || 0});
  const cone = (cx, by, cz, rad, hh, col) => cones.push({p: [cx, by + hh / 2, cz], s: [rad, hh, rad], c: col});
  const ob = (cx, cz, hw, hd, h, kind) => obs.push({x: cx, z: cz, yaw: 0, hw, hd, h, kind: kind || 'fuerte', fort: f.id, fortRect: {x: X, z: Z, w: W, h: H}, gy: g(cx, cz), cs: 1, sn: 0, occ: 0, pass: false, soft: 0, nocov: false});
  // tramo de muro con almenas; i/n = posición para las brechas
  const secs = [];
  const wall = (x1, z1, x2, z2, th, hh, col, o) => {
    o = o || {}; const horiz = Math.abs(z2 - z1) < 1e-6, len = Math.abs(horiz ? x2 - x1 : z2 - z1), n = Math.max(1, Math.ceil(len / (o.sec || 7))), sl = len / n;
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n, cx = horiz ? x1 + (x2 - x1) * t : x1, cz = horiz ? z1 : z1 + (z2 - z1) * t, hw = horiz ? sl / 2 : th / 2, hd = horiz ? th / 2 : sl / 2;
      const gmin = Math.min(g(cx - hw, cz - hd), g(cx + hw, cz + hd), g(cx, cz)), gmax = Math.max(g(cx - hw, cz - hd), g(cx + hw, cz + hd), g(cx, cz)), by = gmin - 0.5, top = gmax + hh;
      secs.push({cx, cz, hw, hd, by, top, hh, col, front: o.front, merlons: o.merlons, th, horiz, len: sl, id: secs.length, gate: o.gate && Math.abs(t - 0.5) < 0.6 / n + 0.001});
    }
  };
  const nearFront = s => (s.front ? 0 : 0.7) + (s.gate ? -2 : 0) + hashf(s.id) * 1.7;
  // ---- construcción por tipo ----
  const kind = f.kind;
  if (kind === 'fort') {
    const m = 3, ht = 6.2;
    wall(X - W / 2, Z - H / 2, X + W / 2, Z - H / 2, 3.2, ht, C.stone, {merlons: true}); wall(X - W / 2, Z + H / 2, X + W / 2, Z + H / 2, 3.2, ht, C.stone, {merlons: true});
    wall(X + dir * W / 2, Z - H / 2, X + dir * W / 2, Z + H / 2, 3.2, ht, C.stone, {merlons: true, front: true, gate: true}); wall(X - dir * W / 2, Z - H / 2, X - dir * W / 2, Z + H / 2, 3.2, ht, C.stone, {merlons: true});
    // foso (franjas oscuras) y puente en la puerta
    [[0, -H / 2 - 6, W + 14, 5], [0, H / 2 + 6, W + 14, 5], [dir * (W / 2 + 6), 0, 5, H + 14], [-dir * (W / 2 + 6), 0, 5, H + 14]].forEach(([ox, oz, sx, sz]) => box(X + ox, g(X + ox, Z + oz) - 0.45, Z + oz, sx, 0.45, sz, 0x4a3c28));
    if (!dead) box(X + dir * (W / 2 + 6), g(X + dir * (W / 2 + 6), Z) - 0.05, Z, 5.4, 0.3, 6.5, C.wood2);
    // patio, edificio central y cobertizos
    box(X, g(X, Z) - 0.1, Z, W - 6, 0.2, H - 6, C.dirt); box(X - dir * W * 0.2, g(X, Z) - 0.1, Z, 16, 7, 12, C.stone2); cone(X - dir * W * 0.2, g(X, Z) + 7, Z, 11, 4.2, C.roof);
    box(X - dir * W * 0.05, g(X, Z) - 0.1, Z - H * 0.3, 8, 3.4, 5, C.wood2); box(X - dir * W * 0.05, g(X, Z) - 0.1, Z + H * 0.3, 8, 3.4, 5, C.wood2);
    // torres
    [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([a, c]) => { const tx = X + a * W / 2, tz = Z + c * H / 2, gy = Math.min(g(tx, tz), g(tx - 3, tz - 3), g(tx + 3, tz + 3)) - 0.5; const tt = (a * dir > 0 ? 1 : 0) + hashf(a * 7 + c * 3 + 1); box(tx, gy, tz, 8, ht + 3.6 + 0.5, 8, C.stone); [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([p, q]) => box(tx + p * 3.4, gy + ht + 4.1, tz + q * 3.4, 1.8, 1.3, 1.8, C.stone)); if (!dead || tt < 0.5) cone(tx, gy + ht + 4.1, tz, 5.2, 4.5, C.roof); ob(tx, tz, 4, 4, ht + 3, 'torre'); });
  } else if (kind === 'redoubt') {
    const th = 4.2, hh = 3.2;
    wall(X - W / 2, Z - H / 2, X + W / 2, Z - H / 2, th, hh, C.earth); wall(X - W / 2, Z + H / 2, X + W / 2, Z + H / 2, th, hh, C.earth); wall(X + dir * W / 2, Z - H / 2, X + dir * W / 2, Z + H / 2, th, hh, C.earth, {front: true});
    wall(X - dir * W / 2, Z - H / 2, X - dir * W / 2, Z - 5, th, hh, C.earth); wall(X - dir * W / 2, Z + 5, X - dir * W / 2, Z + H / 2, th, hh, C.earth);          // entrada trasera de 10 u
    box(X, g(X, Z) - 0.1, Z, W - 8, 0.2, H - 8, C.dirt);
    [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([a, c]) => { const tx = X + a * W / 2, tz = Z + c * H / 2; box(tx, g(tx, tz) - 0.5, tz, 7, hh + 1.2, 7, C.earth2); ob(tx, tz, 3.5, 3.5, hh + 0.8, 'bastion'); });
    for (let k = 0; k < 14; k++) { const zz = Z - H / 2 + 3 + k * (H - 6) / 13; box(X + dir * (W / 2 + 3.4), g(X + dir * W / 2, zz) - 0.4, zz, 0.3, 2.4, 0.3, C.wood); }          // empalizada de estacas
  } else if (kind === 'battery') {
    const th = 5, hh = 3.0, fx = X + dir * (W / 2 - 3), gunsN = Math.max(1, f.guns || 2), gap = 5, sp = (H - 8) / Math.max(1, gunsN);
    // frente con troneras en el hueco de cada cañón
    const front = []; let z0 = Z - H / 2 + 2; for (let i = 0; i < gunsN; i++) { const gz = Z - (H - 8) / 2 + (i + 0.5) * sp; front.push([z0, gz - gap / 2]); z0 = gz + gap / 2; } front.push([z0, Z + H / 2 - 2]);
    front.forEach(([a, c]) => { if (c - a > 0.5) wall(fx, a, fx, c, th, hh, C.earth, {front: true}); });
    wall(X - dir * 4, Z - H / 2 + 1, fx - dir * th / 2, Z - H / 2 + 1, 3.4, hh - 0.6, C.earth2); wall(X - dir * 4, Z + H / 2 - 1, fx - dir * th / 2, Z + H / 2 - 1, 3.4, hh - 0.6, C.earth2);
    box(X, g(X, Z) - 0.1, Z, W - 10, 0.2, H - 6, C.dirt); box(X + dir * (W / 2 - 9), g(X, Z) - 0.05, Z, 12, 0.4, H - 10, C.wood2);
    for (let i = 0; i < gunsN; i++) { const gz = Z - (H - 8) / 2 + (i + 0.5) * sp, gx = X + dir * (W / 2 - 9), gy = g(gx, gz) + 0.4; box(gx, gy, gz, 5, 0.9, 2.6, C.wood); cyl(gx + dir * 2.4, gy + 1.5, gz, 0.55, 6, C.iron, true, 0); cyl(gx, gy + 0.4, gz - 1.5, 0.9, 0.5, C.wood, true, Math.PI / 2); cyl(gx, gy + 0.4, gz + 1.5, 0.9, 0.5, C.wood, true, Math.PI / 2); }
    for (let k = 0; k < 6; k++) { const zz = Z - H / 2 + 4 + k * (H - 8) / 5; cyl(fx + dir * 3.2, g(fx, zz) - 0.3, zz, 0.75, 1.8, C.gab); }          // gaviones
    box(X - dir * 6, g(X, Z), Z - 6, 3, 1.6, 2.4, C.wood); box(X - dir * 6, g(X, Z), Z + 6, 3, 1.6, 2.4, C.wood); cyl(X - dir * 10, g(X, Z), Z, 0.9, 1.6, 0x6a4a2a, false);
  } else {            // trinchera
    const vert = H > W, L = vert ? H : W, zz = vert ? 1 : 0, n = Math.ceil(L / 7);
    for (let i = 0; i < n; i++) { const t = (i + 0.5) / n, off = (i % 2 ? 1.6 : -1.6), cx = vert ? X + off : X - W / 2 + L * t, cz = vert ? Z - H / 2 + L * t : Z + off; secs.push({cx, cz, hw: vert ? 1.1 : L / n / 2, hd: vert ? L / n / 2 : 1.1, by: g(cx, cz) - 0.4, top: g(cx, cz) + 2.0, hh: 2, col: C.earth, front: true, merlons: false, th: 2.2, horiz: !vert, len: L / n, id: secs.length, sacks: true}); }
    box(X, g(X, Z) - 0.5, Z, vert ? 3 : W - 4, 0.45, vert ? H - 4 : 3, 0x2c241a); void zz;
  }
  // brechas: se quitan tramos (primero los del frente y la puerta); destruida: todo escombros
  const order = secs.slice().sort((a, c) => nearFront(a) - nearFront(c)), nRem = dead ? secs.length : Math.min(secs.length, Math.round((1 - r) * secs.length * (kind === 'trench' ? 0.7 : 0.85) + (kind === 'fort' && r < 0.5 ? 1 : 0)));
  const gone = new Set(order.slice(0, nRem).map(s => s.id));
  secs.forEach(s => {
    const sz = s.horiz ? [s.len, s.top - s.by, s.th] : [s.th, s.top - s.by, s.len];
    if (gone.has(s.id) || (s.gate && f.kind === 'fort' && r < 0.5)) { for (let k = 0; k < 3; k++) box(s.cx + (hashf(s.id * 5 + k) - 0.5) * s.len * 0.8, g(s.cx, s.cz) - 0.3, s.cz + (hashf(s.id * 5 + k + 9) - 0.5) * s.th, 1.4 + hashf(k + s.id) * 1.4, 0.6 + hashf(k + 3) * 0.9, 1.2 + hashf(k) * 1.2, C.rubble); return; }
    if (s.gate) { box(s.cx, s.by, s.cz, s.horiz ? 0.4 : s.th * 0.7, 5, s.horiz ? s.th * 0.7 : 0.4, C.wood); ob(s.cx, s.cz, s.hw, s.hd, 4.2, 'puerta'); return; }
    box(s.cx, s.by, s.cz, sz[0], sz[1], sz[2], s.col);
    if (s.merlons) { const nm = Math.max(2, Math.round(s.len / 3.2)); for (let k = 0; k < nm; k++) { const t = (k + 0.5) / nm; box(s.horiz ? s.cx - s.len / 2 + s.len * t : s.cx, s.top, s.horiz ? s.cz : s.cz - s.len / 2 + s.len * t, s.horiz ? 1.5 : s.th, 1.2, s.horiz ? s.th : 1.5, C.stone2); } }
    if (s.sacks) { box(s.cx, s.top, s.cz, s.horiz ? s.len : 1.4, 0.7, s.horiz ? 1.4 : s.len, C.sack); }
    ob(s.cx, s.cz, s.hw, s.hd, Math.min(4.6, s.top - s.by - 0.5), kind === 'fort' ? 'muro_fuerte' : 'terraplen');
  });
  // escalas del asalto
  if (f._assault && !dead && (kind === 'fort' || kind === 'redoubt')) { const fs = secs.filter(s => s.front && !gone.has(s.id) && !s.gate); fs.filter((s, i) => i % 2 === 0).slice(0, 4).forEach(s => { const lx = s.cx - dir * 0.2, h = s.top - s.by; for (let k = 0; k < 2; k++) box(lx - dir * 1.6, s.by, s.cz + (k ? 0.5 : -0.5), 0.18, h + 0.8, 0.18, C.wood2); for (let k = 0; k < 6; k++) box(lx - dir * 1.6, s.by + 0.6 + k * h / 6, s.cz, 0.14, 0.14, 1.3, C.wood2); }); }
  return {boxes, cyls, cones, obs, secs: secs.length, gone: gone.size, dir, X, Z, W, H, r, dead};
}
b3Forts = function (S, b) {
  const fl = b.forts || [], sig = fl.map(f => f.id + ':' + (f.hp > 0 ? Math.ceil(f.hp / f.hpMax * 10) : 0) + ':' + f.kind + ':' + f.side + ':' + (f.garr ? 1 : 0) + ':' + (f._assault ? 1 : 0) + ':' + (f.guns || 0)).join('|');
  if (sig === S.fortSig) return; S.fortSig = sig;
  while (S.fortG.children.length) { const c = S.fortG.children.pop(); if (c.userData && c.userData.keep) continue; if (c.geometry) c.geometry.dispose(); if (c.material && !(c.material === FZ.m)) c.material.dispose(); }
  const mk = (geo, items) => { if (!items.length) return null; const m = new THREE.InstancedMesh(geo, fzMat(), items.length), mt = new THREE.Matrix4(), q = new THREE.Quaternion(), qz = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), z1 = new THREE.Vector3(0, 0, 1), col = new THREE.Color();
    items.forEach((it, i) => { q.setFromAxisAngle(up, -(it.yaw || 0)); if (it.roll) { qz.setFromAxisAngle(z1, Math.PI / 2); q.multiply(qz); } mt.compose(new THREE.Vector3(it.p[0], it.p[1], it.p[2]), q, new THREE.Vector3(it.s[0], it.s[1], it.s[2])); m.setMatrixAt(i, mt); col.setHex(it.c); m.setColorAt(i, col); });
    m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; m.frustumCulled = false; return m; };
  const allObs = [], bx = [], cy = [], cn = [];
  fl.forEach(f => {
    const R_ = fzBuild(S, b, f); bx.push(...R_.boxes); cy.push(...R_.cyls); cn.push(...R_.cones); allObs.push(...R_.obs);
    if (f.hp > 0) {
      const tag = f.side === 'A' ? b.A0 : b.B0, gy = b3H(S.tf, f.x, f.y), px = f.x - R_.dir * f.w * 0.2 * (f.kind === 'fort' ? 1 : 0), pz = f.y, fh = f.kind === 'fort' ? 17 : f.kind === 'redoubt' ? 8 : f.kind === 'battery' ? 7.5 : 5.5;
      const fp = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 2.4, 8, 2).translate(1.8, 0, 0), new THREE.MeshBasicMaterial({map: b3FlagTex(tag), side: THREE.DoubleSide})); fp.position.set(px, gy + fh, pz); fp.userData.fortFlag = 1; S.fortG.add(fp);
      cy.push({p: [px, gy + fh / 2 - 0.4, pz], s: [0.14, fh + 1.6, 0.14], c: 0x4a3a28, yaw: 0});
    }
  });
  const a = mk(new THREE.BoxGeometry(1, 1, 1), bx), c1 = mk(new THREE.CylinderGeometry(1, 1, 1, 8), cy), c2 = mk(new THREE.ConeGeometry(1, 1, 4), cn); [a, c1, c2].forEach(m => { if (m) S.fortG.add(m); });
  S.fortObs = allObs; if (typeof fortCovSync === 'function') fortCovSync(S);
};
// los tramos de muro son obstáculos reales de la vista de soldado
function fortCovSync(S) {
  const C = S.cov; if (!C) return; const keep = C.list.filter(o => !o.fort); C.list.length = 0; keep.forEach(o => C.list.push(o)); (S.fortObs || []).forEach(o => C.list.push(o));
  const grid = new Map(), CS = C.CS; C.list.forEach((o, i) => { const r = Math.max(o.hw, o.hd) + 1; for (let cx = Math.floor((o.x - r) / CS); cx <= Math.floor((o.x + r) / CS); cx++) for (let cz = Math.floor((o.z - r) / CS); cz <= Math.floor((o.z + r) / CS); cz++) { const k = cx * 1000 + cz; (grid.get(k) || grid.set(k, []).get(k)).push(i); } });
  C.grid = grid;
}
const _covEnsureFZ = covEnsure;
covEnsure = function (S) { const had = !!S.cov, C = _covEnsureFZ(S); if (!had) fortCovSync(S); return C; };
// los que están dentro de la obra disparan por encima del muro
const _covBlockFZ = covBlock;
covBlock = function (S, x1, y1, z1, x2, y2, z2) {
  const C = S.cov; if (!C || !C.list.some(o => o.fort)) return _covBlockFZ(S, x1, y1, z1, x2, y2, z2);
  const hide = []; C.list.forEach(o => { if (o.fort && o.fortRect && Math.abs(x1 - o.fortRect.x) < o.fortRect.w / 2 + 1 && Math.abs(z1 - o.fortRect.z) < o.fortRect.h / 2 + 1) { hide.push([o, o.h]); o.h = 0; } });
  const r = _covBlockFZ(S, x1, y1, z1, x2, y2, z2); hide.forEach(([o, h]) => { o.h = h; }); return r;
};
