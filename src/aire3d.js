/* ===== COMBATE AÉREO 3D (modelos de naves3d.js) =====
   · Cada día aéreo (airDay) se guarda en G.mx.ab[región] un registro de los escuadrones enemigos que coinciden en una región aérea (composición, bajas, día).
   · El visor 3D dibuja esa escena: bombarderos escoltados que atacan un objetivo, cazas que los interceptan y persiguen (trazadoras, derribos en llamas y en barrena),
     artillería antiaérea con explosiones de metralla y bombas que caen sobre el objetivo. La escena se compone con los aviones del registro (reducidos a escala) y repite ciclos de 45 s.
   · Se abre desde Ejército → Aviación («Ver combate aéreo 3D»). Sin WebGL2 o si falla algo, solo se muestra el resumen en texto. */
const AV = {S: null, raf: 0, last: 0, cam: {yaw: 0.5, pit: 0.28, d: 520, tx: 0, ty: 90, tz: 0}, user: false, drag: null, sim: null, rec: null, banner: null};
const AV_W = 720, AV_H = 300;
const _airDayAB = airDay;
airDay = function () {
  const M = mx(); if (!M.sq.length) return _airDayAB();
  const pre = new Map(); M.sq.forEach(s => pre.set(s, s.n)); _airDayAB();
  M.ab = M.ab || {}; const byReg = {}; M.sq.forEach(s => { if (pre.get(s) > 0 || s.n > 0) (byReg[s.reg] = byReg[s.reg] || []).push(s); });
  for (const r in byReg) {
    const list = byReg[r], tags = [...new Set(list.map(s => s.tag))]; let pair = null;
    tags.forEach(a => tags.forEach(b => { if (!pair && a < b && hostileTags(a, b)) pair = [a, b]; })); if (!pair) continue;
    const side = t => list.filter(s => s.tag === t && (pre.get(s) || 0) > 0), snap = l => l.map(s => ({id: s.id, type: s.type, n: s.n, tag: s.tag, mission: s.mission})), loss = l => l.reduce((n, s) => n + Math.max(0, (pre.get(s) || 0) - s.n), 0);
    const A = side(pair[0]), B = side(pair[1]); if (!A.length || !B.length) continue;
    let rec = M.ab[r]; if (!rec || G.date.t - rec.last > 4) rec = M.ab[r] = {reg: +r, a: pair[0], b: pair[1], t0: G.date.t, day: 0, lossA: 0, lossB: 0, log: []};
    rec.last = G.date.t; rec.day++; rec.a = pair[0]; rec.b = pair[1]; rec.A = snap(A); rec.B = snap(B); const la = loss(A), lb = loss(B); rec.lossA += la; rec.lossB += lb;
    rec.log.unshift(`Día ${rec.day}: ${G.C[rec.a].name} pierde ${la} · ${G.C[rec.b].name} pierde ${lb}`); if (rec.log.length > 8) rec.log.length = 8;
  }
};
const avActive = r => !!(G.mx && G.mx.ab && G.mx.ab[r] && G.date.t - G.mx.ab[r].last <= 3);
function avUsable() { return typeof nv3Usable === 'function' && nv3Usable() && typeof b3Points === 'function'; }
/* ---------- composición de la escena ---------- */
function avDemo() {
  const me_ = G.C[G.player], foe = G.tags.filter(t => t !== NONE && t !== G.player && alive(t) && G.C[t].rank <= 12).sort((a, b) => relOf(G.player, a) - relOf(G.player, b))[0] || G.tags.find(t => t !== G.player && alive(t));
  return {reg: -1, demo: true, cond: 'clear', a: G.player, b: foe, day: 1, lossA: 3, lossB: 5, A: [{type: 'bomber', n: 40, tag: G.player, mission: 'strat'}, {type: 'fighter', n: 50, tag: G.player, mission: 'sup'}], B: [{type: 'fighter', n: 60, tag: foe, mission: 'intc'}], log: ['Demostración: oleada de bombarderos escoltada contra un objetivo defendido.']};
}
function avBuild(rec) {
  const rnd1 = Math.random, sim = {planes: [], aa: [], bombs: [], t: 0, kills: {A: 0, B: 0}, rec, targetHP: 1}, tot = {A: 0, B: 0};
  ['A', 'B'].forEach(side => rec[side].forEach(sq => { tot[side] += sq.n; }));
  const bombersA = rec.A.some(s => s.type === 'bomber'), bombersB = rec.B.some(s => s.type === 'bomber'), atk = bombersA ? 'A' : bombersB ? 'B' : null;
  sim.atk = atk; const lossK = {A: clamp(0.4 + 2.5 * rec.lossB / Math.max(1, tot.B), 0.6, 2.6), B: clamp(0.4 + 2.5 * rec.lossA / Math.max(1, tot.A), 0.6, 2.6)};      // quien más derriba al rival acierta más
  sim.lossK = lossK;
  ['A', 'B'].forEach(side => rec[side].forEach(sq => {
    const bomber = sq.type === 'bomber', n = clamp(Math.round(sq.n / (bomber ? 6 : 6)), 2, bomber ? 7 : 10), dir = side === 'A' ? 1 : -1;
    for (let i = 0; i < n; i++) {
      const row = i % 3, col = Math.floor(i / 3), x = -dir * (700 + col * 60 + (bomber ? 0 : 160)) + (rnd1() - 0.5) * 40, z = (row - 1) * 70 + (rnd1() - 0.5) * 30 + (side === 'A' ? -60 : 60) * (bomber ? 0 : 1), y = bomber ? (sq.tac === 'high' ? 380 : sq.tac === 'low' ? 110 : 250) + (rnd1() - 0.5) * 30 : 280 + (rnd1() - 0.5) * 80;
      sim.planes.push({id: sim.planes.length, side, tag: sq.tag, type: sq.type, bomber, x, y, z, yaw: dir > 0 ? Math.PI / 2 : -Math.PI / 2, hx: x, hz: z, hy: y, state: 'fly', hp: bomber ? 1.6 : 1, v: bomber ? 55 : 80, bombs: bomber && side === atk ? 4 : 0, ph: rnd1(), fire: -9, clipT: 0, turn: 0, lastYaw: 0, tgt: null, cd: rnd1() * 2, role: bomber ? 'bomber' : sq.tac === 'escort' ? 'escort' : sq.tac === 'sweep' ? 'sweep' : sq.tac === 'intercept' ? 'inter' : (side === atk || !atk ? 'escort' : 'inter')});
    }
  }));
  if (atk) { const def = atk === 'A' ? 'B' : 'A', defTag = (rec[def][0] || {}).tag; if (defTag) for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2 + 0.6; sim.aa.push({tag: defTag, x: Math.cos(a) * 70, z: Math.sin(a) * 70, yaw: a, aimT: null, cd: rnd1(), fire: -9, side: def}); } }
  return sim;
}
/* ---------- partículas ---------- */
function avPart(k, x, y, z, vx, vy, vz, life, o) { const S = AV.S; if (S.parts.length < 900) S.parts.push(Object.assign({k, x, y, z, vx, vy, vz, life, age: 0}, o || {})); }
function avBoom(x, y, z, big) { avPart('boom', x, y, z, 0, 3, 0, 0.9, {s: big ? 1.6 : 1}); for (let i = 0; i < (big ? 6 : 3); i++) avPart('smoke', x + (Math.random() - .5) * 8, y, z + (Math.random() - .5) * 8, (Math.random() - .5) * 6, 8 + Math.random() * 8, (Math.random() - .5) * 6, 3 + Math.random() * 2, {dark: 1}); }
/* ---------- simulación ---------- */
const avDist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
function avStep(dt) {
  const sim = AV.sim, S = AV.S; sim.t += dt; if (sim.t > 48) { AV.sim = avBuild(sim.rec); return; }
  const live = sim.planes.filter(p => p.state === 'fly');
  sim.planes.forEach(p => {
    if (p.state === 'dead') return;
    if (p.state === 'burn') { p.burn += dt; p.v *= 0.995; p.yaw += p.spin * dt; p.pit = Math.min(0.9, (p.pit || 0) + dt * 0.4); if (Math.random() < dt * 14) avPart('smoke', p.x, p.y, p.z, 0, 2, 0, 2.4, {dark: 1}); if (Math.random() < dt * 8) avPart('fire', p.x, p.y, p.z, 0, 1, 0, 0.5); if (p.burn > 1.4) { p.state = 'spin'; p.start = performance.now() / 1000; } }
    if (p.state === 'spin') { p.pit = Math.min(1.2, (p.pit || 0) + dt * 0.8); p.yaw += p.spin * dt * 2.2; p.y -= (60 + 80 * p.pit) * dt; if (Math.random() < dt * 16) avPart('smoke', p.x, p.y, p.z, 0, 1, 0, 2.2, {dark: 1}); if (p.y <= 2) { p.state = 'dead'; avBoom(p.x, 2, p.z, p.bomber); AV.banner = {text: `✈️ ¡Cae un ${p.bomber ? 'bombardero' : 'caza'} de ${G.C[p.tag] ? G.C[p.tag].name : '?'}!`, side: p.side, age: 0}; sim.kills[p.side === 'A' ? 'B' : 'A']++; return; } }
    if (p.state === 'burn' || p.state === 'spin') { const sy = Math.cos(p.pit || 0); p.x += Math.sin(p.yaw) * p.v * dt * sy; p.z += Math.cos(p.yaw) * p.v * dt * sy; return; }
    // vuelo normal
    let want = p.yaw;
    if (p.role === 'bomber') { want = Math.atan2(-p.x * 0.0, 1) + (p.side === 'A' ? Math.PI / 2 : -Math.PI / 2); if (p.bombs > 0 && Math.abs(p.x) < 28 && Math.abs(p.z) < 130) { p.dropping = 1; } }
    else {
      let tg = p.tgt && p.tgt.state === 'fly' ? p.tgt : null; p.cd -= dt;
      if (!tg || p.cd < 0) { p.cd = 1.5 + Math.random(); let best = null, bd = 1e9; live.forEach(q => { if (q.side === p.side) return; const d = avDist(p, q) * (p.role === 'escort' && q.bomber ? 1.6 : 1) * (p.role === 'inter' && q.bomber ? 0.7 : 1) * (p.role === 'sweep' && q.bomber ? 1.5 : 1); if (d < bd) { bd = d; best = q; } }); p.tgt = best; tg = best; }
      if (tg) { want = Math.atan2(tg.x - p.x, tg.z - p.z); const d = avDist(p, tg); p.dy = clamp((tg.y - p.y) * 0.01, -0.5, 0.5);
        if (d < 190 && Math.abs(nv3Ang(want - p.yaw)) < 0.22 && p.fire < sim.t - 0.9) { p.fire = sim.t; p.burst = 6; }
      } else if (p.role === 'escort') { const bm = sim.planes.find(q => q.side === p.side && q.bomber && q.state === 'fly'); want = bm ? Math.atan2(bm.x + (p.id % 2 ? 70 : -70) - p.x, bm.z + 30 - p.z) : p.yaw; } else { want = Math.atan2(-p.x * 0.3, -p.z * 0.3 + 1); }
    }
    if (p.burst > 0) { p.burst -= dt * 10; const tg = p.tgt; if (tg && tg.state === 'fly') { avPart('tracer', p.x, p.y, p.z, Math.sin(p.yaw) * 380 + (Math.random() - .5) * 18, (tg.y - p.y) * 1.2, Math.cos(p.yaw) * 380 + (Math.random() - .5) * 18, 0.28); if (p.burst <= 0.2 && Math.random() < 0.16 * sim.lossK[p.side] * (tg.bomber ? 1.25 : 1)) avHit(tg, 0.55 * (tg.bomber ? 0.75 : 1.15)); } }
    const dyaw = clamp(nv3Ang(want - p.yaw), -1, 1) * Math.min(1, dt * (p.bomber ? 0.5 : 2.2)); p.yaw += dyaw; p.turn += (dyaw / Math.max(dt, 1e-3) - p.turn) * Math.min(1, dt * 4);
    p.pit = -(p.dy || 0) * 0.5; p.y += (p.dy || 0) * 18 * dt + Math.sin(sim.t * 1.3 + p.ph * 6) * 2 * dt; p.y = clamp(p.y, 60, 420);
    p.x += Math.sin(p.yaw) * p.v * dt; p.z += Math.cos(p.yaw) * p.v * dt;
    // bombas
    if (p.dropping && p.bombs > 0 && sim.t - (p.lastBomb || -9) > 0.35) { p.lastBomb = sim.t; p.bombs--; p.dropStart = performance.now() / 1000; sim.bombs.push({x: p.x, y: p.y, z: p.z, vx: Math.sin(p.yaw) * p.v, vz: Math.cos(p.yaw) * p.v, vy: 0}); if (p.bombs <= 0) p.dropping = 0; }
    // trazado al salir del campo: vuelta
    if (Math.abs(p.x) > 1100 || Math.abs(p.z) > 800) { if (p.role === 'bomber') { p.v *= 1; } else p.yaw += Math.PI * dt * 0.8; }
  });
  // flak
  sim.aa.forEach(a => { a.cd -= dt; let best = null, bd = 760; live.forEach(q => { if (q.side === a.side) return; const d = Math.hypot(q.x - a.x, q.y, q.z - a.z); if (d < bd) { bd = d; best = q; } }); a.aimT = best;
    if (best && a.cd <= 0) { a.cd = 0.55 + Math.random() * 0.4; a.fire = sim.t; const fx = best.x + (Math.random() - .5) * 50, fy = best.y + (Math.random() - .5) * 40, fz = best.z + (Math.random() - .5) * 50; avPart('flak', fx, fy, fz, 0, 1, 0, 1.6); avPart('tracer', a.x, 6, a.z, (fx - a.x) * 1.7, (fy - 6) * 1.7, (fz - a.z) * 1.7, 0.55); if (Math.random() < 0.075 * sim.lossK[a.side] && Math.hypot(fx - best.x, fy - best.y, fz - best.z) < 45) avHit(best, 0.5); } });
  // bombas en caída
  sim.bombs = sim.bombs.filter(b => { b.vy -= 38 * dt; b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt; if (b.y <= 1) { avBoom(b.x, 2, b.z, true); sim.targetHP = Math.max(0, sim.targetHP - 0.045); if (AV.S.targetMat) AV.S.targetMat.color.setHex(sim.targetHP > 0.5 ? 0x8a8478 : 0x4a4640); return false; } return true; });
  if (sim.targetHP < 0.9 && Math.random() < dt * 5) avPart('smoke', (Math.random() - .5) * 90, 6, (Math.random() - .5) * 90, 2, 10, 0, 4, {dark: 1});
}
function avHit(p, dmg) { if (p.state !== 'fly') return; p.hp -= dmg; avPart('flash', p.x, p.y, p.z, 0, 0, 0, 0.25); if (p.hp <= 0) { p.state = 'burn'; p.burn = 0; p.spin = (Math.random() - .5) * 1.6; p.pit = 0; AV.banner = {text: `💥 ¡Impacto en un ${p.bomber ? 'bombardero' : 'caza'} de ${G.C[p.tag] ? G.C[p.tag].name : '?'}!`, side: p.side, age: 0}; } else if (Math.random() < 0.5) avPart('smoke', p.x, p.y, p.z, 0, 2, 0, 2, {dark: 1}); }
/* ---------- escena ---------- */
function avScene() {
  const S = {scene: new THREE.Scene(), parts: [], sets: {}, st: new Map()}, cd = AV.rec.cond || 'clear', mood = cd === 'cloud' ? 1 : cd === 'storm' ? 1 : (AV.rec.reg * 7 + 3 + (AV.rec.a ? AV.rec.a.charCodeAt(0) : 0)) % 3, skyC = cd === 'night' ? 0x0b1220 : cd === 'storm' ? 0x58626a : [0x9fc2dc, 0xb2b6ba, 0xdcae88][mood], fogC = cd === 'night' ? 0x0b1220 : cd === 'storm' ? 0x58626a : [0xc9dbe8, 0xc3c6c8, 0xe9cba6][mood];
  S.scene.background = new THREE.Color(skyC); S.scene.fog = cd === 'storm' || cd === 'cloud' ? new THREE.Fog(fogC, 300, 1800) : new THREE.Fog(fogC, 700, 3600);
  const sun = new THREE.DirectionalLight(mood === 2 ? 0xffc890 : 0xfff3dc, 0.95); sun.position.set(-400, mood === 2 ? 220 : 600, -300); if (cd === 'night') { sun.intensity = 0.2; sun.color.setHex(0x8fa8d8); } else if (cd === 'storm') sun.intensity = 0.4; S.scene.add(sun, new THREE.AmbientLight(0xffffff, 0.6), new THREE.HemisphereLight(0xd6e8ff, 0x4a5a3a, 0.4));
  const gnd = new THREE.Mesh(new THREE.PlaneGeometry(9000, 9000, 1, 1), new THREE.MeshLambertMaterial({color: 0x6f7a50})); gnd.rotation.x = -Math.PI / 2; S.scene.add(gnd);
  for (let i = 0; i < 90; i++) { const f = new THREE.Mesh(new THREE.PlaneGeometry(60 + Math.random() * 160, 40 + Math.random() * 100), new THREE.MeshLambertMaterial({color: [0x7f8a58, 0x8a8a5a, 0x66744a, 0x9a9468][i % 4]})); f.rotation.x = -Math.PI / 2; f.rotation.z = Math.random() * 3; f.position.set((Math.random() - .5) * 2600, 0.15, (Math.random() - .5) * 2600); S.scene.add(f); }
  // objetivo: fábrica con naves, chimeneas y depósitos
  const mat = S.targetMat = new THREE.MeshLambertMaterial({color: 0x8a8478}), dk = new THREE.MeshLambertMaterial({color: 0x3a3836}), t = new THREE.Group();
  [[0, 0, 70, 22, 40], [-60, 20, 40, 16, 30], [50, -40, 50, 14, 36], [-20, -60, 30, 20, 26]].forEach(([x, z, w, h, d]) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, h / 2, z); t.add(m); });
  [[-30, 30], [30, 38], [70, 20]].forEach(([x, z]) => { const c = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 3.2, 46, 8), dk); c.position.set(x, 23, z); t.add(c); });
  [[-90, -30], [-70, -50], [80, 40]].forEach(([x, z]) => { const c = new THREE.Mesh(new THREE.CylinderGeometry(9, 9, 12, 14), dk); c.position.set(x, 6, z); t.add(c); });
  S.scene.add(t);
  const tex = typeof b3SoftTex === 'function' ? b3SoftTex() : null;
  S.P = {smoke: b3Points(600, 26, false, tex), fire: b3Points(200, 16, true, tex), flash: b3Points(160, 20, true, tex), boom: b3Points(120, 70, true, tex), tracer: b3Points(500, 5, true, tex), flak: b3Points(200, 38, false, tex)};
  Object.values(S.P).forEach(p => S.scene.add(p));
  S.cam = new THREE.PerspectiveCamera(42, AV_W / AV_H, 2, 9000); return S;
}
function avSet(kind, tag) {
  const S = AV.S, N = naves3d, key = N.naveGeoKey(kind, '2', tag);
  if (!S.sets[key]) { const set = S.sets[key] = new N.NaveLodSet(NV3.shared, kind, '2', tag, R.lowEnd ? 30 : 80, {dist: [500, 1500]}); set.meshes.forEach(m => S.scene.add(m)); }
  return S.sets[key];
}
function avDraw() {
  const S = AV.S, sim = AV.sim, now = performance.now() / 1000, cp = S.cam.position; NV3.shared.update(now); Object.values(S.sets).forEach(s => s.begin());
  sim.planes.forEach(p => {
    if (p.state === 'dead') return; const kind = p.bomber ? 'bombardero_pesado' : 'caza', set = avSet(kind, p.tag), o = {phase: p.ph, pitch: p.pit || 0, roll: -clamp(p.turn, -1.2, 1.2) * 0.8, spin: 120};
    let clip = p.bomber ? 'vuelo_nivelado' : p.turn > 0.25 ? 'viraje_izquierda' : p.turn < -0.25 ? 'viraje_derecha' : 'vuelo_nivelado';
    if (p.state === 'burn') clip = 'incendio'; else if (p.state === 'spin') clip = 'caer_en_barrena'; else if (p.bomber && p.dropStart && now - p.dropStart < 5) { clip = 'soltar_bombas'; o.start = p.dropStart; delete o.phase; } else if (!p.bomber && sim.t - p.fire < 0.7) clip = 'disparar';
    if (p.bomber && p.state === 'fly') { const q = p.tgt || sim.planes.find(x => x.side !== p.side && x.state === 'fly' && !x.bomber && avDist(p, x) < 380); if (q) { const b = nv3Ang(Math.atan2(q.x - p.x, q.z - p.z) - p.yaw); o.aim = [b, 0.2, b, 0.2]; } }
    set.add(Math.hypot(cp.x - p.x, cp.y - p.y, cp.z - p.z), p.x, p.y, p.z, p.yaw, 2.4, p.tag, clip, o);
  });
  sim.aa.forEach(a => { const set = avSet('antiaereo', a.tag), o = {phase: 0.3}; let clip = 'reposo'; if (a.aimT) { const b = Math.atan2(a.aimT.x - a.x, a.aimT.z - a.z), e = clamp(Math.atan2(a.aimT.y, Math.hypot(a.aimT.x - a.x, a.aimT.z - a.z)), 0.1, 1.4); o.aim = [b, e, b, e]; if (sim.t - a.fire < 0.6) clip = 'disparar_AA'; } set.add(Math.hypot(cp.x - a.x, cp.y, cp.z - a.z), a.x, 0, a.z, 0, 3.2, a.tag, clip, o); });
}
function avParts(dt) {
  const S = AV.S, P = S.P, sm = new THREE.Color();
  for (let i = S.parts.length - 1; i >= 0; i--) { const p = S.parts[i]; p.age += dt; if (p.age >= p.life) { S.parts.splice(i, 1); continue; } const q = p.age / p.life; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
    if (p.k === 'smoke') { const v = p.dark ? 0.12 : 0.75; b3Push(P.smoke, p.x, p.y, p.z, v, v, v, 0.55 * (1 - q) * Math.min(1, q * 6)); }
    else if (p.k === 'fire') b3Push(P.fire, p.x, p.y, p.z, 1, 0.55 + 0.3 * (1 - q), 0.15, 0.9 * (1 - q));
    else if (p.k === 'flash') b3Push(P.flash, p.x, p.y, p.z, 1, 0.9, 0.55, 1 - q);
    else if (p.k === 'boom') b3Push(P.boom, p.x, p.y + q * 14, p.z, 1, 0.6 + 0.2 * (1 - q), 0.15, 0.95 * (1 - q) * (p.s || 1));
    else if (p.k === 'tracer') b3Push(P.tracer, p.x, p.y, p.z, 1, 0.85, 0.35, 1 - q * 0.4);
    else if (p.k === 'flak') b3Push(P.flak, p.x, p.y, p.z, 0.16, 0.14, 0.13, 0.75 * (1 - q) * Math.min(1, q * 8)); }
  Object.values(P).forEach(b3Flush); void sm;
}
function avCamera(dt) {
  const c = AV.cam, sim = AV.sim, S = AV.S; if (!AV.user) { c.yaw = 0.7 + 0.5 * Math.sin(performance.now() / 1000 * 0.07); let sx = 0, sy = 0, sz = 0, n = 0; sim.planes.forEach(p => { if (p.state === 'fly' || p.state === 'burn') { sx += p.x; sy += p.y; sz += p.z; n++; } }); if (n) { sx /= n; sy /= n; sz /= n; sx *= 0.6; sz *= 0.6; c.tx += (sx - c.tx) * Math.min(1, dt * 1.2); c.ty += (sy * 0.7 - c.ty) * Math.min(1, dt); c.tz += (sz - c.tz) * Math.min(1, dt * 1.2); } if (!AV.zoomed) c.d += (560 - c.d) * Math.min(1, dt); }
  const cp = Math.cos(c.pit), sp = Math.sin(c.pit); S.cam.position.set(c.tx + Math.sin(c.yaw) * c.d * cp, Math.max(25, c.ty + c.d * sp), c.tz + Math.cos(c.yaw) * c.d * cp); S.cam.lookAt(c.tx, c.ty, c.tz);
}
function avFrame(now) {
  AV.raf = 0; const cv = document.getElementById('avmap'); if (!cv || AV.ab === null || AV.ab === undefined) return; const rec = AV.ab >= 0 ? G.mx && G.mx.ab && G.mx.ab[AV.ab] : AV.rec;
  if (!rec) return; if (rec !== AV.rec || !AV.S) { if (AV.S) { try { AV.S.scene.traverse(o => { if (o.geometry) o.geometry.dispose(); }); } catch (e) { } } AV.rec = rec; AV.S = avScene(); AV.sim = avBuild(rec); AV.banner = null; AV.user = false; AV.zoomed = false; AV.cam.tx = 0; AV.cam.tz = 0; AV.cam.d = 560; }
  try {
    const dt = Math.min(0.05, (now - (AV.last || now)) / 1000); AV.last = now; if (!G.paused || true) { avStep(dt); } nv3Init(); avDraw(); avParts(dt); avCamera(dt);
    const rd = R.renderer, dom = rd.domElement, pr = rd.getPixelRatio(), cssW = dom.width / pr, cssH = dom.height / pr, g = cv.getContext('2d');
    let vw = Math.min(R.lowEnd ? 960 : 1440, cssW), vh = vw * AV_H / AV_W; if (vh > cssH) { vh = cssH; vw = vh * AV_W / AV_H; } vw = Math.floor(vw); vh = Math.floor(vh);
    const vp = rd.getViewport(new THREE.Vector4()); rd.setScissorTest(false); rd.setViewport(0, 0, vw, vh); AV.S.cam.aspect = vw / vh; AV.S.cam.updateProjectionMatrix(); rd.render(AV.S.scene, AV.S.cam);
    const pw = Math.round(vw * pr), ph = Math.round(vh * pr); g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(dom, 0, dom.height - ph, pw, ph, 0, 0, cv.width, cv.height); rd.setViewport(vp); rd.clear();
    avHud(g, cv.width / AV_W);
  } catch (e) { console.warn('Combate aéreo 3D desactivado por un error.', e); NV3.dead = true; const root = document.getElementById('airpanel'); if (root) root.querySelector('#av-note').textContent = '⚠️ La vista 3D no está disponible en este equipo.'; return; }
  AV.raf = requestAnimationFrame(avFrame);
}
function avHud(g, k) {
  const sim = AV.sim, rec = AV.rec; g.setTransform(k, 0, 0, k, 0, 0); const W = AV_W, cnt = side => sim.planes.filter(p => p.side === side && p.state === 'fly').length, tot = side => sim.planes.filter(p => p.side === side).length;
  g.fillStyle = 'rgba(8,12,16,.7)'; g.fillRect(0, 0, W, 22); g.font = 'bold 12px sans-serif'; g.textBaseline = 'middle'; g.textAlign = 'left'; g.fillStyle = '#f5ecd0'; g.fillText(`${G.C[rec.a].name} · ${cnt('A')}/${tot('A')} en vuelo`, 8, 12); g.textAlign = 'right'; g.fillText(`${cnt('B')}/${tot('B')} en vuelo · ${G.C[rec.b].name}`, W - 8, 12);
  g.textAlign = 'center'; g.fillStyle = '#ffe28a'; g.fillText(sim.atk ? `Objetivo ${Math.round(sim.targetHP * 100)}%` : 'Superioridad aérea', W / 2, 12);
  if (AV.banner) { AV.banner.age += 0.016; const q = AV.banner.age, a = q < 0.3 ? q / 0.3 : q > 2.2 ? (2.8 - q) / 0.6 : 1; if (q > 2.8) AV.banner = null; else { g.globalAlpha = clamp(a, 0, 1); g.fillStyle = 'rgba(10,12,16,.8)'; g.fillRect(W / 2 - 190, AV_H - 40, 380, 26); g.fillStyle = AV.banner.side === 'A' ? '#ffb89c' : '#a8d0ff'; g.font = 'bold 14px sans-serif'; g.fillText(AV.banner.text, W / 2, AV_H - 26); g.globalAlpha = 1; } }
  g.font = '11px sans-serif'; g.textAlign = 'left'; g.fillStyle = 'rgba(8,12,16,.7)'; g.fillRect(6, AV_H - 22, 400, 17); g.fillStyle = '#d9d2bc'; g.fillText('🧊 Vista 3D · arrastrar: girar · rueda: zoom · doble clic: restablecer', 10, AV_H - 10);
}
/* ---------- panel e interfaz ---------- */
function renderAirPanel() {
  let root = document.getElementById('airpanel'); if (!root) { root = document.createElement('div'); root.id = 'airpanel'; root.className = 'bigpanel'; document.body.appendChild(root); }
  const open = AV.ab !== null && AV.ab !== undefined, rec = open ? (AV.ab >= 0 ? G.mx && G.mx.ab && G.mx.ab[AV.ab] : AV.rec) : null;
  if (!rec) { root.classList.remove('open'); root.innerHTML = ''; root.dataset.rid = ''; AV.ab = null; if (R.skip3d && !UI.battle && !(UI.nb !== null && UI.nb !== undefined)) { R.skip3d = false; R.dirty = true; R.labelsDirty = true; G.paused = AV.prevPause !== false; } return; }
  root.classList.add('open');
  if (root.dataset.rid !== String(AV.ab)) { root.dataset.rid = String(AV.ab); AV.S = null; if (!R.skip3d) { R.skip3d = true; AV.prevPause = G.paused; G.paused = true; }
    root.innerHTML = `<div class="sp-head"><div><h2 id="av-t"></h2><small id="av-s"></small></div><button class="x" data-act="closeair">✕</button></div><canvas id="avmap" width="${AV_W * 2}" height="${AV_H * 2}"></canvas><div id="av-note" class="hint"></div><div id="av-st"></div><div id="av-log" class="blog"></div>`; avBind(root.querySelector('#avmap')); }
  const side = (tag, sq, loss) => { const f = sq.filter(s => s.type === 'fighter').reduce((n, s) => n + s.n, 0), b = sq.filter(s => s.type === 'bomber').reduce((n, s) => n + s.n, 0); return `<div class="bside"><h4>${flag(tag, 'sm')} ${G.C[tag].name}</h4><div class="kv sm"><span>🛩️ Cazas</span><b>${f}</b></div><div class="kv sm"><span>✈️ Bombarderos</span><b>${b}</b></div><div class="kv sm"><span>Aviones perdidos</span><b class="bad">${loss}</b></div></div>`; };
  root.querySelector('#av-t').textContent = rec.demo ? '✈️ Combate aéreo · demostración' : '✈️ Combate aéreo · ' + (airReg(rec.reg) ? airReg(rec.reg).name : 'región');
  root.querySelector('#av-s').textContent = `Día ${rec.day} · ${G.C[rec.a].name} contra ${G.C[rec.b].name}`;
  root.querySelector('#av-st').innerHTML = `<div class="bsides">${side(rec.a, rec.A, rec.lossA)}${side(rec.b, rec.B, rec.lossB)}</div>`;
  root.querySelector('#av-log').innerHTML = (rec.log || []).slice(0, 6).map(e => `<div class="ev">✈️ ${e}</div>`).join('');
  if (!AV.raf) AV.raf = requestAnimationFrame(avFrame);
}
function avBind(cv) {
  cv.addEventListener('mousedown', e => { AV.drag = {x: e.clientX, y: e.clientY}; AV.user = true; e.preventDefault(); });
  window.addEventListener('mousemove', e => { const d = AV.drag; if (!d) return; const c = AV.cam; c.yaw -= (e.clientX - d.x) * 0.006; c.pit = clamp(c.pit + (e.clientY - d.y) * 0.004, 0.02, 1.4); d.x = e.clientX; d.y = e.clientY; });
  window.addEventListener('mouseup', () => { AV.drag = null; });
  cv.addEventListener('wheel', e => { e.preventDefault(); AV.cam.d = clamp(AV.cam.d * Math.exp(e.deltaY * 0.0013), 80, 2200); AV.zoomed = true; }, {passive: false});
  cv.addEventListener('dblclick', () => { AV.user = false; AV.zoomed = false; Object.assign(AV.cam, {pit: 0.28}); });
}
Object.assign(ACT, {
  openair: d => { if (!avUsable()) { toast('⚠️', 'La vista 3D necesita un equipo con WebGL 2.'); return; } AV.ab = +d.reg; AV.rec = null; renderAirPanel(); },
  airdemo: () => { if (!avUsable()) { toast('⚠️', 'La vista 3D necesita un equipo con WebGL 2.'); return; } AV.ab = -1; AV.rec = avDemo(); AV.S = null; renderAirPanel(); },
  closeair: () => { AV.ab = null; renderAirPanel(); }
});
const _aviationHtmlAV = aviationHtml;
aviationHtml = function () {
  const h = _aviationHtmlAV(), M = mx(), act = Object.values(M.ab || {}).filter(r => G.date.t - r.last <= 20).sort((a, b) => b.last - a.last).slice(0, 6);
  const rows = act.map(r => `<div class="kv sm"><span>${flag(r.a, 'sm')} ${G.C[r.a].name} ↔ ${flag(r.b, 'sm')} ${G.C[r.b].name} · ${airReg(r.reg) ? airReg(r.reg).name.replace('Región aérea de ', '') : ''} <small class="dim">(−${r.lossA} / −${r.lossB})</small></span><button data-act="openair" data-reg="${r.reg}">🧊 Ver en 3D</button></div>`).join('');
  return h + `<div class="card"><h3>🧊 Combates aéreos en 3D</h3>${rows || '<p class="hint">No hay combates aéreos recientes. Cuando escuadrones enemigos coincidan en una región, podrás verlos aquí.</p>'}<button data-act="airdemo">▶ Demostración: bombarderos escoltados contra un objetivo</button></div>`;
};
MX_TABS.forEach(t => { if (t.id === 'air') t.html = aviationHtml; });
