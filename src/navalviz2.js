/* ===== VISOR NAVAL TÁCTICO (vista cenital, como el visor de batalla terrestre) =====
   Los buques maniobran de verdad sobre una arena vista desde arriba: salen en columnas, cierran distancia hasta su alcance preferido según su tipo y la táctica
   (línea de batalla / ataque cerrado / mantener distancia / torpedos / romper contacto), giran para presentar el costado, mantienen separación, disparan solo
   dentro de su alcance y arco, dejan estela, lanzan torpedos (submarinos y destructores) y se hunden. Cámara con zoom, arrastre, seguimiento automático y
   selección de buque. El visor 3D usa las mismas posiciones y rumbos (s.hd), de modo que los barcos se mueven también en 3D.
   Sustituye a nvNew / nvSync / nvFrame / nvShip / nvDraw de navalviz.js (naval3d.js y tacticas2.js se acoplan después). */
const NVT = {
  sail: {spd: 15, turn: 0.32, rng: 230, R: 170}, steam: {spd: 19, turn: 0.45, rng: 280, R: 210}, ironclad: {spd: 16, turn: 0.38, rng: 340, R: 260},
  cruiser: {spd: 27, turn: 0.6, rng: 340, R: 280}, sub: {spd: 12, turn: 0.4, rng: 170, R: 120}, dread: {spd: 21, turn: 0.36, rng: 480, R: 380},
  destroyer: {spd: 32, turn: 0.8, rng: 260, R: 200}, bb: {spd: 23, turn: 0.36, rng: 520, R: 420}, carrier: {spd: 24, turn: 0.3, rng: 150, R: 430}
};
const nvt = t => NVT[t] || NVT.steam, nvSt = t => NV_STYLE[t] || NV_STYLE.sail;
const nvAng = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
function nvNew(r) { return {z: r.z, ships: new Map(), parts: [], t: 0, last: performance.now(), banner: null, seen: 0, sunk: 0, wind: 1, cam: {x: NV_W / 2, y: NV_H / 2, z: 1, user: false}, sel: null, init: false}; }
function nvSync(V, r) {
  const alive = new Set(), rows = {A: [], B: []};
  ['A', 'B'].forEach(side => (r[side] || []).forEach(o => {
    alive.add(o.id); let s = V.ships.get(o.id);
    if (!s) { s = {id: o.id, t: o.t, side, tag: o.tag, hp: o.hp, hpD: o.hp, hpP: o.hp, x: side === 'A' ? -40 : NV_W + 40, y: NV_H / 2, hd: side === 'A' ? 0 : Math.PI, spd: 0, sink: -1, cd: rnd(0.5, 3), ph: rnd(0, 6.28), color: G.C[o.tag] ? G.C[o.tag].color : '#888', fire: 0, dir: side === 'A' ? 1 : -1, trail: [], tgt: null, tgtT: 0, new: true}; V.ships.set(o.id, s); }
    s.hp = o.hp; s.t = o.t; rows[side].push(s);
  }));
  // posición inicial: columnas (línea de fila) que se acercan por flancos opuestos
  ['A', 'B'].forEach(side => {
    const list = rows[side].filter(s => s.new).sort((a, b) => a.id - b.id); if (!list.length) return;
    const per = 8, sp = 66, dirx = side === 'A' ? 1 : -1;
    list.forEach((s, i) => { const col = Math.floor(i / per), pos = i % per; s.new = false; s.x = (side === 'A' ? NV_W * 0.34 : NV_W * 0.66) - dirx * pos * sp; s.y = (side === 'A' ? NV_H * 0.30 : NV_H * 0.70) + (side === 'A' ? 1 : -1) * col * 80 + (pos % 2) * 6; s.hd = side === 'A' ? 0.06 : Math.PI - 0.06; s.spd = nvt(s.t).spd * 0.7; });
  });
  V.ships.forEach(s => { if (!alive.has(s.id) && s.sink < 0) { s.sink = 0; V.sunk++; const st = nvSt(s.t); V.banner = {text: `💥 ¡Se hunde ${st.name.toLowerCase()} de ${G.C[s.tag] ? G.C[s.tag].name : '?'}!`, side: s.side, age: 0}; for (let k = 0; k < 14; k++) V.parts.push({k: 'debris', x: s.x + rnd(-20, 20), y: s.y + rnd(-10, 10), vx: rnd(-30, 30), vy: rnd(-30, 30), age: 0, life: rnd(0.8, 1.6)}); } });
}
function nvPart(V, p) { if (V.parts.length < 700) V.parts.push(Object.assign({age: 0}, p)); }
// táctica efectiva de un buque según el bando y su tipo
function nvTacR(V, r, s) {
  const tac = (s.side === 'A' ? r.tacA : r.tacB) || 'standard', T = nvt(s.t); let R = T.R, spd = 1;
  if (tac === 'aggressive') R *= 0.55; else if (tac === 'distance') R *= 1.4; else if (tac === 'torpedo') { if (s.t === 'destroyer' || s.t === 'sub') R = 110; else R *= 1.1; }
  else if (tac === 'evade') spd = 1.25;
  return {tac, R, spd};
}
function nvPickTarget(V, s, live) {
  let best = null, bs = 1e9; const big = NAV_BIG[s.t] || s.t === 'cruiser';
  live.forEach(o => { if (o.side === s.side) return; if (s.t === 'sub' && !(NAV_BIG[o.t] || o.t === 'cruiser')) return; const d = Math.hypot(o.x - s.x, o.y - s.y); const sc = d - (big && NAV_BIG[o.t] ? 70 : 0) + (o.hpD < 0.4 ? -40 : 0); if (sc < bs) { bs = sc; best = o; } });
  return best || live.find(o => o.side !== s.side) || null;
}
function nvFrame(V, r, g, now) {
  const dt = Math.min(0.05, (now - V.last) / 1000) * (V.ts === undefined ? 1 : V.ts); V.last = now; V.t += dt; nvSync(V, r);
  const live = [...V.ships.values()].filter(s => s.sink < 0);
  const cx = {A: [0, 0, 0], B: [0, 0, 0]}; live.forEach(s => { const c = cx[s.side]; c[0] += s.x; c[1] += s.y; c[2]++; });
  V.ships.forEach(s => {
    if (s.sink >= 0) { s.sink += dt; s.spd *= 0.97; s.x += Math.cos(s.hd) * s.spd * dt; s.y += Math.sin(s.hd) * s.spd * dt; return; }
    const T = nvt(s.t), st = nvSt(s.t), tc = nvTacR(V, r, s); s.hpD += (s.hp - s.hpD) * Math.min(1, dt * 2);
    if (s.hp < s.hpP - 0.015) { nvPart(V, {k: 'boom', x: s.x + rnd(-st.len / 3, st.len / 3), y: s.y + rnd(-6, 6), life: 0.5}); nvPart(V, {k: 'smoke', x: s.x, y: s.y, vx: rnd(-5, 5), vy: rnd(-5, 5), r: 5, life: 2.4, dark: 1}); }
    s.hpP = s.hp; s.fire = Math.max(0, s.fire - dt);
    s.tgtT -= dt; if (!s.tgt || s.tgt.sink >= 0 || s.tgtT <= 0) { s.tgt = nvPickTarget(V, s, live); s.tgtT = 2 + Math.random() * 2; }
    let want = s.hd, spdK = 0.7;
    const e = s.tgt;
    if (tc.tac === 'evade' && cx[s.side === 'A' ? 'B' : 'A'][2]) { const c = cx[s.side === 'A' ? 'B' : 'A']; want = Math.atan2(s.y - c[1] / c[2], s.x - c[0] / c[2]); spdK = tc.spd; }
    else if (e) {
      const dx = e.x - s.x, dy = e.y - s.y, d = Math.hypot(dx, dy), brg = Math.atan2(dy, dx);
      if (d > tc.R + 50) { want = brg; spdK = 1; }
      else if (d < tc.R - 50) { want = brg + Math.PI * (0.85 + 0.3 * Math.sin(s.ph)); spdK = 0.85; }
      else { const a1 = brg + Math.PI / 2, a2 = brg - Math.PI / 2; want = Math.abs(nvAng(a1 - s.hd)) < Math.abs(nvAng(a2 - s.hd)) ? a1 : a2; spdK = 0.55; }
      if (s.t === 'sub' && d > 200) spdK = 0.9;
    }
    // separación: se apartan de aliados demasiado cercanos
    live.forEach(o => { if (o === s) return; const dx = s.x - o.x, dy = s.y - o.y, d = Math.hypot(dx, dy), m = (st.len + nvSt(o.t).len) * 0.42; if (d < m && d > 0.01) { const f = (m - d) / m; s.x += dx / d * f * 30 * dt; s.y += dy / d * f * 30 * dt; if (o.side === s.side && f > 0.3) want = Math.atan2(dy, dx) * 0.4 + want * 0.6; } });
    // los más rápidos y de cola siguen a su líder de columna (coherencia de la línea)
    const da = nvAng(want - s.hd), maxT = T.turn * dt; s.hd = nvAng(s.hd + clamp(da, -maxT, maxT));
    const wantSpd = T.spd * spdK * (1 - clamp(Math.abs(da) / 3, 0, 0.35)); s.spd += (wantSpd - s.spd) * Math.min(1, dt * 0.8);
    s.x += Math.cos(s.hd) * s.spd * dt; s.y += Math.sin(s.hd) * s.spd * dt; s.dir = Math.cos(s.hd) >= 0 ? 1 : -1;
    s.x = clamp(s.x, -140, NV_W + 140); s.y = clamp(s.y, -90, NV_H + 90);
    // estela
    const lt = s.trail[s.trail.length - 1]; if (!lt || Math.hypot(lt[0] - s.x, lt[1] - s.y) > 9) { s.trail.push([s.x, s.y]); if (s.trail.length > 16) s.trail.shift(); }
    if (st.funnels && Math.random() < dt * 5) nvPart(V, {k: 'smoke', x: s.x - Math.cos(s.hd) * 4, y: s.y - Math.sin(s.hd) * 4, vx: -Math.cos(s.hd) * 6 - V.wind * 5, vy: -Math.sin(s.hd) * 6, r: 3, life: 2.2});
    if (s.hpD < 0.7 && Math.random() < dt * (1.5 + (0.7 - s.hpD) * 8)) nvPart(V, {k: 'smoke', x: s.x + rnd(-st.len / 3, st.len / 3), y: s.y + rnd(-6, 6), vx: rnd(-6, 6), vy: rnd(-6, 6), r: 4, life: 2.6, dark: 1});
    if (s.hpD < 0.45 && Math.random() < dt * 3) nvPart(V, {k: 'fire', x: s.x + rnd(-st.len / 3, st.len / 3), y: s.y + rnd(-4, 4), life: 0.5});
    // disparos: solo dentro del alcance y del arco
    s.cd -= dt;
    if (s.cd <= 0 && e && e.sink < 0) {
      const dx = e.x - s.x, dy = e.y - s.y, d = Math.hypot(dx, dy), brg = Math.atan2(dy, dx), rel = Math.abs(nvAng(brg - s.hd));
      const turret = (st.turret || 0) >= 2, okArc = turret ? rel > 0.35 || s.t === 'dread' || s.t === 'bb' : Math.abs(rel - Math.PI / 2) < 0.7;
      if (s.t === 'sub' || (s.t === 'destroyer' && tc.tac === 'torpedo')) {
        if (d < 200 && rel < 0.5 && NAV_BIG[e.t] !== undefined || s.t === 'sub' && d < 190 && rel < 0.6) { s.cd = rnd(7, 12); nvPart(V, {k: 'torp', x: s.x, y: s.y, x2: e.x + rnd(-10, 10), y2: e.y + rnd(-6, 6), life: d / 55, hit: Math.random() < 0.35}); s.cd = Math.max(s.cd, 6); }
        else s.cd = 0.8;
        if (s.t === 'sub') return;
      }
      if (d <= T.rng && okArc && s.t !== 'sub') {
        s.cd = rnd(1.4, 3.4) * (s.t === 'dread' || s.t === 'bb' ? 1.4 : 1) * (tc.tac === 'evade' ? 2.2 : 1); s.fire = 0.3; const n = Math.min(4, st.turret || 3), ux = Math.cos(s.hd), uy = Math.sin(s.hd);
        const pHit = clamp(0.62 * (1 - d / T.rng * 0.55), 0.12, 0.6);
        for (let k = 0; k < n; k++) { const off = (k - (n - 1) / 2) * st.len / (n + 1); const px = s.x + ux * off, py = s.y + uy * off; nvPart(V, {k: 'flash', x: px, y: py, life: 0.14}); nvPart(V, {k: 'smoke', x: px, y: py, vx: -V.wind * 4, vy: rnd(-4, 4), r: 3.5, life: 2.4});
          if (k < 2 || s.t === 'dread' || s.t === 'bb') nvPart(V, {k: 'shell', x: px, y: py, x2: e.x + rnd(-24, 24), y2: e.y + rnd(-16, 16), life: Math.max(0.5, d / 420), hit: Math.random() < pHit}); }
      } else if (d > T.rng) s.cd = 0.5; else s.cd = 0.4;
    }
  });
  V.parts.forEach(p => { p.age += dt; if (p.k === 'smoke') { p.x += (p.vx || 0) * dt; p.y += (p.vy || 0) * dt; } if (p.k === 'debris') { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.98; p.vy *= 0.98; }
    if (p.k === 'shell' && p.age >= p.life && !p.done) { p.done = true; if (p.hit) { nvPart(V, {k: 'boom', x: p.x2, y: p.y2, life: 0.5}); nvPart(V, {k: 'smoke', x: p.x2, y: p.y2, vx: rnd(-5, 5), vy: rnd(-5, 5), r: 5, life: 2.4, dark: 1}); } else nvPart(V, {k: 'splash', x: p.x2, y: p.y2, life: 0.7}); }
    if (p.k === 'torp' && p.age >= p.life && !p.done) { p.done = true; if (p.hit) { nvPart(V, {k: 'boom', x: p.x2, y: p.y2, life: 0.7}); nvPart(V, {k: 'splash', x: p.x2, y: p.y2, life: 0.9}); } } });
  V.parts = V.parts.filter(p => p.age < p.life + 0.05); if (V.banner) { V.banner.age += dt; if (V.banner.age > 3) V.banner = null; }
  nvCamera(V, dt);
  nvDraw(V, r, g);
}
function nvCamera(V, dt) {
  const c = V.cam; const live = [...V.ships.values()].filter(s => s.sink < 0); if (!live.length) return;
  if (!c.user) { let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; live.forEach(s => { x0 = Math.min(x0, s.x); x1 = Math.max(x1, s.x); y0 = Math.min(y0, s.y); y1 = Math.max(y1, s.y); });
    const bw = Math.max(240, x1 - x0 + 200), bh = Math.max(150, y1 - y0 + 150), zt = clamp(Math.min(NV_W / bw, NV_H / bh), 0.7, 2.1), k = Math.min(1, dt * 1.6); c.z += (zt - c.z) * k; c.x += ((x0 + x1) / 2 - c.x) * k; c.y += ((y0 + y1) / 2 - c.y) * k; }
  else if (c.follow !== undefined) { const s = V.ships.get(c.follow); if (s && s.sink < 0) { const k = Math.min(1, dt * 3); c.x += (s.x - c.x) * k; c.y += (s.y - c.y) * k; } }
}
function nvShip(g, s, V) {
  const st = nvSt(s.t), L = st.len, W = Math.max(8, L * (s.t === 'sail' ? 0.2 : s.t === 'sub' ? 0.13 : s.t === 'carrier' ? 0.22 : 0.17));
  const sk = s.sink >= 0 ? s.sink : 0, alpha = s.sink >= 0 ? Math.max(0, 1 - sk / 3.2) : 1;
  // estela
  if (s.sink < 0 && s.trail.length > 1) { g.save(); g.lineCap = 'round'; for (let i = 1; i < s.trail.length; i++) { const a = i / s.trail.length; g.strokeStyle = `rgba(255,255,255,${0.32 * a})`; g.lineWidth = W * 0.5 * a; g.beginPath(); g.moveTo(s.trail[i - 1][0], s.trail[i - 1][1]); g.lineTo(s.trail[i][0], s.trail[i][1]); g.stroke(); } g.restore(); }
  g.save(); g.translate(s.x, s.y); g.rotate(s.hd); g.globalAlpha = alpha; const sc = s.sink >= 0 ? 1 - Math.min(0.45, sk * 0.14) : 1; g.scale(sc, sc);
  // sombra
  g.fillStyle = 'rgba(0,15,30,.28)'; g.beginPath(); g.ellipse(2, 3, L / 2, W / 2, 0, 0, 6.3); g.fill();
  // casco
  g.fillStyle = s.t === 'sail' ? '#6b4d33' : s.t === 'sub' ? '#2f3a3f' : '#5a646c'; g.strokeStyle = '#12161a'; g.lineWidth = 1;
  g.beginPath(); g.moveTo(-L / 2, -W * 0.38); g.lineTo(L * 0.28, -W / 2); g.quadraticCurveTo(L / 2 + 2, -W * 0.18, L / 2 + 5, 0); g.quadraticCurveTo(L / 2 + 2, W * 0.18, L * 0.28, W / 2); g.lineTo(-L / 2, W * 0.38); g.closePath(); g.fill(); g.stroke();
  // cubierta
  g.fillStyle = s.t === 'sail' ? '#8a6a48' : s.t === 'carrier' ? '#3f464d' : '#737c84'; g.beginPath(); g.moveTo(-L * 0.45, -W * 0.28); g.lineTo(L * 0.26, -W * 0.34); g.lineTo(L * 0.44, 0); g.lineTo(L * 0.26, W * 0.34); g.lineTo(-L * 0.45, W * 0.28); g.closePath(); g.fill();
  g.fillStyle = s.color; g.fillRect(-L * 0.46, -1.2, L * 0.9, 2.4);                                   // franja con el color de la nación
  if (st.deck) { g.fillStyle = 'rgba(255,255,255,.55)'; g.fillRect(-L * 0.38, -0.7, L * 0.7, 1.4); g.fillStyle = '#5b646c'; g.fillRect(L * 0.12, W * 0.18, L * 0.14, W * 0.24); }
  for (let k = 0; k < (st.masts || 0); k++) { const mx = -L * 0.28 + k * L * 0.26; g.strokeStyle = '#d9d2bc'; g.lineWidth = 2.2; g.beginPath(); g.moveTo(mx, -W * 0.52); g.lineTo(mx, W * 0.52); g.stroke(); g.fillStyle = 'rgba(245,240,224,.8)'; g.fillRect(mx - 1.5, -W * 0.46, 3, W * 0.92); }
  for (let k = 0; k < (st.funnels || 0); k++) { const fx = -L * 0.08 - k * L * 0.18 + (st.funnels > 1 ? L * 0.08 : 0); g.fillStyle = '#26262b'; g.beginPath(); g.ellipse(fx, 0, W * 0.2, W * 0.15, 0, 0, 6.3); g.fill(); g.fillStyle = '#4a4a52'; g.beginPath(); g.ellipse(fx - 0.5, -0.5, W * 0.11, W * 0.08, 0, 0, 6.3); g.fill(); }
  const nt = st.turret || 0; for (let k = 0; k < nt; k++) { const fore = k % 2 === 0, idx = Math.floor(k / 2), tx = fore ? L * (0.3 - idx * 0.12) : -L * (0.3 - idx * 0.1); g.fillStyle = '#4b535a'; g.beginPath(); g.arc(tx, 0, W * 0.2, 0, 6.3); g.fill(); g.strokeStyle = '#1b1f23'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(tx, -1.3); g.lineTo(tx + W * 0.55, -1.3); g.moveTo(tx, 1.3); g.lineTo(tx + W * 0.55, 1.3); g.stroke(); }
  if (st.sub) { g.fillStyle = '#39454b'; g.fillRect(-4, -W * 0.22, 9, W * 0.44); }
  if (s.fire > 0.05) { g.fillStyle = `rgba(255,235,150,${Math.min(1, s.fire * 3)})`; g.beginPath(); g.arc(L * 0.4, 0, 5, 0, 6.3); g.fill(); }
  g.restore();
  if (s.sink < 0) { const bw = Math.max(22, L * 0.5); g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(s.x - bw / 2, s.y - W / 2 - 12, bw, 3); g.fillStyle = s.hpD > 0.5 ? '#79c35a' : s.hpD > 0.25 ? '#e0b04a' : '#e8644f'; g.fillRect(s.x - bw / 2, s.y - W / 2 - 12, bw * clamp(s.hpD, 0, 1), 3); }
  if (V.sel === s.id && s.sink < 0) { g.strokeStyle = '#ffe27a'; g.lineWidth = 1.6; g.setLineDash([5, 4]); g.beginPath(); g.arc(s.x, s.y, L * 0.62, 0, 6.3); g.stroke(); g.setLineDash([]); const T = nvt(s.t); g.strokeStyle = 'rgba(255,226,122,.35)'; g.beginPath(); g.arc(s.x, s.y, T.rng, 0, 6.3); g.stroke(); }
}
function nvDraw(V, r, g) {
  const k = g.canvas.width / NV_W; g.setTransform(k, 0, 0, k, 0, 0); const W = NV_W, H = NV_H, c = V.cam;
  const cond = r.cond || 'clear', deep = cond === 'night' ? ['#0c2234', '#07141f'] : cond === 'storm' ? ['#2c4a5a', '#1d3340'] : cond === 'haze' ? ['#4a7488', '#34596c'] : ['#2f6f90', '#1a4a68'];
  const bg = g.createLinearGradient(0, 0, W, H); bg.addColorStop(0, deep[0]); bg.addColorStop(1, deep[1]); g.fillStyle = bg; g.fillRect(0, 0, W, H);
  g.save(); g.translate(W / 2, H / 2); g.scale(c.z, c.z); g.translate(-c.x, -c.y);
  // olas: líneas de espuma que se desplazan con el viento
  const x0 = c.x - W / 2 / c.z - 40, x1 = c.x + W / 2 / c.z + 40, y0 = c.y - H / 2 / c.z - 40, y1 = c.y + H / 2 / c.z + 40;
  g.lineWidth = 1; g.strokeStyle = `rgba(255,255,255,${cond === 'storm' ? 0.2 : 0.11})`;
  for (let yy = Math.floor(y0 / 46) * 46; yy < y1; yy += 46) { for (let xx = Math.floor(x0 / 120) * 120; xx < x1; xx += 120) { const ox = ((xx * 7 + yy * 3) % 90) + V.t * V.wind * (6 + (yy % 5)), wx = xx + (ox % 120), a = Math.sin(V.t * 0.7 + xx * 0.01 + yy * 0.02) * 3; g.beginPath(); g.moveTo(wx, yy + a); g.quadraticCurveTo(wx + 14, yy - 4 + a, wx + 30, yy + a); g.stroke(); } }
  // objetivo de cada buque (línea de puntería tenue) para el seleccionado
  const list = [...V.ships.values()].sort((a, b) => a.sink - b.sink || nvSt(a.t).len - nvSt(b.t).len);
  list.forEach(s => nvShip(g, s, V));
  V.parts.forEach(p => { const q = p.age / p.life;
    if (p.k === 'smoke') { g.globalAlpha = (1 - q) * 0.5; g.fillStyle = p.dark ? '#25272a' : '#d4d4d0'; g.beginPath(); g.arc(p.x, p.y, p.r * (1 + q * 2.4), 0, 6.3); g.fill(); g.globalAlpha = 1; }
    else if (p.k === 'flash') { g.fillStyle = `rgba(255,235,150,${1 - q})`; g.beginPath(); g.arc(p.x, p.y, 6 * (1 - q * 0.3), 0, 6.3); g.fill(); }
    else if (p.k === 'fire') { g.fillStyle = `rgba(255,${130 + 80 * (1 - q) | 0},40,${0.9 * (1 - q)})`; g.beginPath(); g.arc(p.x, p.y, 3.5 + 2 * (1 - q), 0, 6.3); g.fill(); }
    else if (p.k === 'shell') { const t = Math.min(1, q), x = p.x + (p.x2 - p.x) * t, y = p.y + (p.y2 - p.y) * t - Math.sin(t * 3.14) * 12; g.fillStyle = '#111'; g.beginPath(); g.arc(x, y, 1.8, 0, 6.3); g.fill(); g.strokeStyle = 'rgba(255,240,200,.25)'; g.lineWidth = 1; g.beginPath(); g.moveTo(p.x + (p.x2 - p.x) * Math.max(0, t - 0.12), p.y + (p.y2 - p.y) * Math.max(0, t - 0.12) - Math.sin(Math.max(0, t - 0.12) * 3.14) * 12); g.lineTo(x, y); g.stroke(); }
    else if (p.k === 'torp') { const t = Math.min(1, q), x = p.x + (p.x2 - p.x) * t, y = p.y + (p.y2 - p.y) * t; g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(p.x + (p.x2 - p.x) * Math.max(0, t - 0.2), p.y + (p.y2 - p.y) * Math.max(0, t - 0.2)); g.lineTo(x, y); g.stroke(); g.fillStyle = '#fff'; g.beginPath(); g.arc(x, y, 2, 0, 6.3); g.fill(); }
    else if (p.k === 'boom') { g.fillStyle = `rgba(255,${150 + 80 * (1 - q) | 0},40,${0.9 * (1 - q)})`; g.beginPath(); g.arc(p.x, p.y, 5 + q * 18, 0, 6.3); g.fill(); }
    else if (p.k === 'splash') { g.strokeStyle = `rgba(255,255,255,${0.9 * (1 - q)})`; g.lineWidth = 1.5; g.beginPath(); g.arc(p.x, p.y, 3 + q * 12, 0, 6.3); g.stroke(); }
    else if (p.k === 'debris') { g.fillStyle = '#5a4630'; g.fillRect(p.x, p.y, 3, 2); } });
  g.restore();
  g.setTransform(k, 0, 0, k, 0, 0);
  nvHud(V, r, g);
  const s = V.sel !== null && V.sel !== undefined ? V.ships.get(V.sel) : null;
  if (s && s.sink < 0) { const st = nvSt(s.t), T = nvt(s.t); g.fillStyle = 'rgba(8,12,16,.8)'; g.fillRect(8, NV_H - 54, 270, 46); g.fillStyle = '#ffe28a'; g.font = 'bold 12px sans-serif'; g.textAlign = 'left'; g.fillText(`${st.name} · ${G.C[s.tag] ? G.C[s.tag].name : ''}`, 14, NV_H - 38); g.fillStyle = '#d9d2bc'; g.font = '11px sans-serif'; g.fillText(`Casco ${Math.round(s.hpD * 100)}% · ${Math.round(s.spd)} nudos · alcance ${T.rng}`, 14, NV_H - 22); g.fillText(s.tgt && s.tgt.sink < 0 ? `Apunta a: ${nvSt(s.tgt.t).name}` : 'Sin objetivo', 14, NV_H - 11); }
  g.fillStyle = 'rgba(8,12,16,.6)'; g.font = '10px sans-serif'; g.textAlign = 'right'; const hint = '🖱 rueda: zoom · arrastrar: mover · clic: seleccionar buque · doble clic: auto-cámara'; g.fillText(hint, NV_W - 8, NV_H - 8);
}
// ratón: zoom, arrastre y selección (solo en la vista 2D)
function nvBind(cv) {
  if (cv._nvt) return; cv._nvt = true; let drag = null;
  const pos = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * NV_W, (e.clientY - r.top) / r.height * NV_H]; };
  const V = () => R.nviz, off = () => typeof N3 !== 'undefined' && N3.active;
  const toW = (V0, p) => [(p[0] - NV_W / 2) / V0.cam.z + V0.cam.x, (p[1] - NV_H / 2) / V0.cam.z + V0.cam.y];
  cv.addEventListener('wheel', e => { const v = V(); if (!v || off()) return; e.preventDefault(); const p = pos(e), w0 = toW(v, p); v.cam.user = true; v.cam.follow = undefined; v.cam.z = clamp(v.cam.z * (e.deltaY < 0 ? 1.15 : 1 / 1.15), 0.45, 4); const w1 = toW(v, p); v.cam.x += w0[0] - w1[0]; v.cam.y += w0[1] - w1[1]; }, {passive: false});
  cv.addEventListener('mousedown', e => { const v = V(); if (!v || off()) return; const p = pos(e); drag = {x: p[0], y: p[1], cx: v.cam.x, cy: v.cam.y, moved: false}; });
  window.addEventListener('mousemove', e => { const v = V(); if (!drag || !v || off()) return; const p = pos(e); const dx = p[0] - drag.x, dy = p[1] - drag.y; if (Math.hypot(dx, dy) > 4) { drag.moved = true; v.cam.user = true; v.cam.follow = undefined; } if (drag.moved) { v.cam.x = drag.cx - dx / v.cam.z; v.cam.y = drag.cy - dy / v.cam.z; } });
  window.addEventListener('mouseup', e => { const v = V(); if (!drag || !v) { drag = null; return; } const d = drag; drag = null; if (off() || d.moved) return; const p = pos(e), w = toW(v, p); let best = null, bd = 1e9; v.ships.forEach(s => { if (s.sink >= 0) return; const dd = Math.hypot(s.x - w[0], s.y - w[1]); if (dd < nvSt(s.t).len * 0.6 && dd < bd) { bd = dd; best = s; } }); v.sel = best ? best.id : null; if (best) { v.cam.follow = best.id; v.cam.user = true; } });
  cv.addEventListener('dblclick', () => { const v = V(); if (!v || off()) return; v.cam.user = false; v.cam.follow = undefined; v.sel = null; });
}
(function () { const _r = renderNavalPanel; renderNavalPanel = function () { _r(); const cv = document.getElementById('nvmap'); if (cv) nvBind(cv); }; })();
