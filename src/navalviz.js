/* ===== MARINA VISIBLE: fichas de flotas en el mapa, buques 3D, humo de combate y visor de batallas navales =====
   · Fichas con bandera sobre cada flota (misión, nº de buques, ⚔ si hay combate) que abren el visor o la pestaña Marina.
   · Siluetas de buques en 3D sobre el mar cuando la cámara está cerca; humo y fuego en las zonas con batalla.
   · Visor de batalla naval: dos líneas de buques que se cañonean, con humo, impactos, incendios y hundimientos animados. */
const NV_W = 720, NV_H = 300;

/* ---------- ancla de cada zona marítima (punto de mar más cercano al centro) ---------- */
const _zAnchor = new Map();
function zoneAnchor(zid) {
  let a = _zAnchor.get(zid); if (a) return a; const Z = SEA_ZONES[zid];
  const cx = Math.round(lonToX(Z.lon)), cy = Math.round(latToY(Z.lat)); let best = [Z.lon, Z.lat];
  outer: for (let r = 0; r < 120; r += 2) for (let k = 0; k < 24; k++) { const an = k / 24 * 6.2832, px = Math.round(cx + Math.cos(an) * r), py = Math.round(cy + Math.sin(an) * r * 0.8); if (px < 0 || py < 0 || px >= MAP_W || py >= MAP_H) continue; if (!MAP.land[py * MAP_W + px]) { best = [xToLon(px), yToLat(py)]; break outer; } }
  a = {lon: best[0], lat: best[1]}; _zAnchor.set(zid, a); return a;
}
const nbActive = z => !!(G.mx && G.mx.nb && G.mx.nb[z] && G.date.t - G.mx.nb[z].last <= 2);
// ¿ve el jugador esta flota? las propias y las de aliados siempre; las enemigas si comparten zona con una flota o un puerto suyo
function fleetVisible(f) {
  if (!G.player || f.tag === G.player || sameSide(G.player, f.tag)) return true;
  const z = f.tr ? f.tr.to : f.zone; if (nbActive(z)) return true;
  return zonePower(G.player, z, 'own') > 0 || countryZones(G.C[G.player]).has(z);
}

/* ---------- fichas en el mapa ---------- */
function updateNavyTokens() {
  if (!G.mx || !R.markerRoot) return; R.nk = R.nk || {};
  const groups = new Map();
  G.mx.fl.forEach(f => { if (!f.ships.length || !fleetVisible(f)) return; const z = f.tr ? f.tr.to : f.zone, k = f.tag + '|' + z + (f.tr ? 't' : ''); const g = groups.get(k) || groups.set(k, {tag: f.tag, z, tr: f.tr, f0: f, n: 0, mis: f.mission, fl: []}).get(k); g.n += f.ships.length; g.fl.push(f); });
  const same = new Map(); groups.forEach(g => { same.set(g.z, (same.get(g.z) || 0) + 1); });
  const seen = new Set(), cw = R.canvas.clientWidth, ch = R.canvas.clientHeight, idx = {};
  groups.forEach((g, k) => {
    seen.add(k); let el = R.nk[k];
    if (!el) { el = document.createElement('div'); el.className = 'ntoken'; el.dataset.act = 'selfleet'; R.markerRoot.appendChild(el); R.nk[k] = el; }
    el.dataset.z = g.z; el.dataset.tag = g.tag;
    const A = zoneAnchor(g.z); let lon = A.lon, lat = A.lat;
    if (g.tr) { const B = zoneAnchor(g.f0.zone), q = clamp(1 - g.tr.left / Math.max(1, zoneDist(g.f0.zone, g.tr.to) / 6), 0, 1); lon = B.lon + (A.lon - B.lon) * q; lat = B.lat + (A.lat - B.lat) * q; }
    const n = same.get(g.z), i = (idx[g.z] = (idx[g.z] || 0) + 1) - 1, off = (i - (n - 1) / 2) * 34;
    const p = worldToScreen(lon, 0.2, -lat), x = p[0] + off, y = p[1];
    if (x < -40 || x > cw + 40 || y < -40 || y > ch + 40) { el.style.display = 'none'; return; }
    el.style.display = 'flex';
    const fight = nbActive(g.z) && !g.tr, key = g.tag + g.n + g.mis + (fight ? 'b' : '') + (g.tag === G.player ? 'm' : '');
    if (el._k !== key) { el._k = key; el.className = 'ntoken' + (g.tag === G.player ? ' mine' : '') + (fight ? ' fight' : ''); el.innerHTML = flag(g.tag, 'sm') + `<b>⚓${g.n}</b>` + (fight ? '<u>⚔</u>' : `<small>${NAV_MISSIONS[g.mis] ? NAV_MISSIONS[g.mis].icon : ''}</small>`); }
    el.title = `${G.C[g.tag].name}: ${g.n} buques · ${SEA_ZONES[g.z].name}`;
    el.style.transform = `translate(-50%,-50%) translate(${x.toFixed(1)}px,${y.toFixed(1)}px)`;
  });
  for (const k in R.nk) if (!seen.has(k)) { R.nk[k].remove(); delete R.nk[k]; }
}

/* ---------- buques 3D sobre el mar ---------- */
function buildShipMeshes() {
  if (R.ships3d) return;
  const hull = 0x4a3a2a, white = 0xf0ead8, steel = 0x6a7078, dark = 0x2a2a2e;
  // casco con proa (cuña) + dos palos con velas; el color de la nación va en el pabellón (parte teñida)
  const body = mergeParts([
    {geo: BX(0.26, 0.05, 0.075).translate(0, 0.03, 0), m: new THREE.Matrix4(), col: hull}, {geo: CN(0.045, 0.08, 4).rotateZ(-Math.PI / 2).translate(0.16, 0.03, 0), m: new THREE.Matrix4(), col: hull},
    {geo: BX(0.006, 0.17, 0.006), m: mk4(-0.03, 0.12, 0), col: dark}, {geo: BX(0.006, 0.15, 0.006), m: mk4(0.07, 0.11, 0), col: dark},
    {geo: BX(0.003, 0.11, 0.075), m: mk4(-0.03, 0.12, 0), col: white}, {geo: BX(0.003, 0.09, 0.065), m: mk4(0.07, 0.11, 0), col: white}]);
  const flagG = mergeParts([{geo: BX(0.028, 0.016, 0.003).translate(0.014, 0, 0), m: mk4(-0.03, 0.215, 0), col: 0xffffff}]);
  const steam = mergeParts([{geo: BX(0.3, 0.045, 0.07).translate(0, 0.028, 0), m: new THREE.Matrix4(), col: steel}, {geo: CN(0.04, 0.07, 4).rotateZ(-Math.PI / 2).translate(0.17, 0.028, 0), m: new THREE.Matrix4(), col: steel},
    {geo: CY(0.012, 0.07, 6), m: mk4(0.0, 0.1, 0), col: dark}, {geo: CY(0.012, 0.06, 6), m: mk4(-0.07, 0.095, 0), col: dark}, {geo: BX(0.05, 0.02, 0.035), m: mk4(0.08, 0.07, 0), col: steel}]);
  const flagS = mergeParts([{geo: BX(0.026, 0.014, 0.003).translate(0.013, 0, 0), m: mk4(0.1, 0.1, 0), col: 0xffffff}]);
  const mkI = (g, vc, cap) => { const m = new THREE.InstancedMesh(g, new THREE.MeshLambertMaterial(vc ? {vertexColors: true} : {color: 0xffffff}), cap); m.count = 0; m.frustumCulled = false; R.scene.add(m); return m; };
  R.ships3d = {sail: mkI(body, true, 160), steam: mkI(steam, true, 260), flagSail: mkI(flagG, false, 160), flagSteam: mkI(flagS, false, 260)};
}
function updateShipMeshes(t) {
  if (!G.mx || !G.mx.fl) return; if (!R.ships3d) { try { buildShipMeshes(); } catch (e) { console.warn(e); R.ships3d = {off: true}; return; } } if (R.ships3d.off) return;
  const S = R.ships3d, show = R.cam.dist < 120 && R.showFigs !== false, m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), sc = new THREE.Vector3(1, 1, 1), up = new THREE.Vector3(0, 1, 0), c = new THREE.Color();
  const n = {sail: 0, steam: 0};
  if (show) {
    const cw = R.canvas.clientWidth, ch = R.canvas.clientHeight, groups = new Map(), idx = {};
    G.mx.fl.forEach(f => { if (!f.ships.length || !fleetVisible(f)) return; const z = f.tr ? f.tr.to : f.zone; const k = f.tag + '|' + z; (groups.get(k) || groups.set(k, {tag: f.tag, z, tr: f.tr, f0: f, ships: []}).get(k)).ships.push(...f.ships.map(s => ({s, f}))); });
    const per = {}; groups.forEach(g => { per[g.z] = (per[g.z] || 0) + 1; });
    groups.forEach(g => {
      const A = zoneAnchor(g.z); let lon = A.lon, lat = A.lat;
      if (g.tr) { const B = zoneAnchor(g.f0.zone), qq = clamp(1 - g.tr.left / Math.max(1, zoneDist(g.f0.zone, g.tr.to) / 6), 0, 1); lon = B.lon + (A.lon - B.lon) * qq; lat = B.lat + (A.lat - B.lat) * qq; }
      const sp = worldToScreen(lon, 0.1, -lat); if (sp[0] < -120 || sp[0] > cw + 120 || sp[1] < -120 || sp[1] > ch + 120) return;
      const i0 = (idx[g.z] = (idx[g.z] || 0) + 1) - 1, ox = (i0 - (per[g.z] - 1) / 2) * 6.5, fight = nbActive(g.z) && !g.tr;
      const col = R.occRGB(g.tag); const list = g.ships.slice(0, 14), heading = g.tr ? Math.atan2(-(zoneAnchor(g.tr.to).lat - zoneAnchor(g.f0.zone).lat), zoneAnchor(g.tr.to).lon - zoneAnchor(g.f0.zone).lon) : (G.C[g.tag] && G.C[g.tag].id % 2 ? 0 : Math.PI);
      list.forEach((o, k) => {
        const kind = (o.s.t === 'sail') ? 'sail' : 'steam', T = SHIP_TYPES[o.s.t], size = 2.1 + T.pts / 420 * 1.6;
        const row = k % 4, colI = Math.floor(k / 4), bob = Math.sin(t / 700 + k * 1.7 + g.z) * 0.012 + (fight ? Math.sin(t / 230 + k) * 0.01 : 0);
        const lx = (colI - 1) * 1.5 * (heading === 0 ? -1 : 1), lz = (row - 1.5) * 1.0;
        p.set(lon + ox + lx, 0.03 + bob, -lat + lz); q.setFromAxisAngle(up, heading + Math.sin(t / 2100 + k) * 0.05 + (fight ? Math.sin(t / 900 + k * 2) * 0.15 : 0)); sc.set(size, size, size);
        m4.compose(p, q, sc); const idxK = n[kind]++; if (idxK >= (kind === 'sail' ? 160 : 260)) { n[kind]--; return; }
        S[kind].setMatrixAt(idxK, m4); const fm = S[kind === 'sail' ? 'flagSail' : 'flagSteam']; fm.setMatrixAt(idxK, m4); c.setRGB(col[0] / 255, col[1] / 255, col[2] / 255); fm.setColorAt(idxK, c);
      });
    });
  }
  ['sail', 'steam'].forEach(k => { const a = S[k], f = S[k === 'sail' ? 'flagSail' : 'flagSteam']; a.count = f.count = n[k]; a.instanceMatrix.needsUpdate = f.instanceMatrix.needsUpdate = true; if (f.instanceColor) f.instanceColor.needsUpdate = true; });
  R.dirty = true;
}
// humo y fogonazos en las zonas con batalla naval (se añade al sistema de humo de render3d)
function navalSmoke() {
  if (!R.puffs || !G.mx || !G.mx.nb) return false; let any = false;
  for (const z in G.mx.nb) { if (!nbActive(+z)) continue; any = true; const A = zoneAnchor(+z);
    for (let n = 0; n < 3; n++) { if (Math.random() > 0.6) continue; const fire = Math.random() < 0.3, pf = R.puffs.find(p => !p.alive && p.fire === fire); if (!pf) continue;
      pf.alive = true; pf.age = 0; pf.life = fire ? 0.5 + Math.random() * 0.4 : 2.4 + Math.random() * 1.6; pf.x = A.lon + (Math.random() - 0.5) * 3.2; pf.z = -A.lat + (Math.random() - 0.5) * 2.2; pf.y = 0.12; pf.sp.visible = true; } }
  return any;
}

/* ---------- visor de batalla naval ---------- */
const NV_STYLE = {
  sail: {len: 48, h: 12, masts: 3, name: 'Fragata de vela'}, steam: {len: 54, h: 12, masts: 1, funnels: 1, name: 'Fragata de vapor'}, ironclad: {len: 62, h: 11, funnels: 1, turret: 2, name: 'Acorazado'},
  cruiser: {len: 70, h: 10, funnels: 2, turret: 3, name: 'Crucero'}, sub: {len: 42, h: 6, sub: true, name: 'Submarino'}, dread: {len: 92, h: 14, funnels: 2, turret: 5, name: 'Dreadnought'}
};
function nvNew(r) { return {z: r.z, ships: new Map(), parts: [], t: 0, last: performance.now(), banner: null, seen: 0, sunk: 0, wind: 1}; }
function nvSync(V, r) {
  const rows = {A: [], B: []}, alive = new Set();
  ['A', 'B'].forEach(side => (r[side] || []).forEach(o => { alive.add(o.id); let s = V.ships.get(o.id);
    if (!s) { const dir = side === 'A' ? 1 : -1; s = {id: o.id, t: o.t, side, tag: o.tag, hp: o.hp, hpD: o.hp, x: side === 'A' ? NV_W * 0.12 : NV_W * 0.88, y: 150, vx: 0, vy: 0, row: 0, sink: -1, cd: rnd(0.5, 3), ph: rnd(0, 6.28), color: G.C[o.tag] ? G.C[o.tag].color : '#888', fire: 0, dir}; V.ships.set(o.id, s); }
    s.hp = o.hp; s.t = o.t; rows[side].push(s); }));
  V.ships.forEach(s => { if (!alive.has(s.id) && s.sink < 0) { s.sink = 0; V.sunk++; const st = NV_STYLE[s.t]; V.banner = {text: `💥 ¡Se hunde ${st.name.toLowerCase()} de ${G.C[s.tag] ? G.C[s.tag].name : '?'}!`, side: s.side, age: 0}; for (let k = 0; k < 14; k++) V.parts.push({k: 'debris', x: s.x + rnd(-20, 20), y: s.y + rnd(-6, 4), vx: rnd(-30, 30), vy: rnd(-70, -20), age: 0, life: rnd(0.8, 1.6)}); } });
  // formación: cada bando en una línea vertical con profundidad (y mayor = más cerca)
  ['A', 'B'].forEach(side => { const list = rows[side].slice().sort((a, b) => a.id - b.id), n = list.length, nr = Math.min(6, Math.max(1, n)), nc = Math.ceil(n / nr); list.forEach((s, i) => { const col = Math.floor(i / nr), row = i % nr; s.row = i; s.tx = (side === 'A' ? NV_W * 0.4 - col * 80 : NV_W * 0.6 + col * 80) + (row % 2) * (side === 'A' ? -26 : 26) + Math.sin(V.t * 0.3 + s.ph) * 8; s.ty = 132 + (nr > 1 ? (row / (nr - 1)) * 128 : 50) + Math.sin(V.t * 0.4 + s.ph) * 3; void nc; }); });
}
function nvPart(V, p) { if (V.parts.length < 600) V.parts.push(Object.assign({age: 0}, p)); }
function nvFrame(V, r, g, now) {
  const dt = Math.min(0.05, (now - V.last) / 1000); V.last = now; V.t += dt; nvSync(V, r);
  const live = [...V.ships.values()].filter(s => s.sink < 0), enemy = s => live.filter(o => o.side !== s.side);
  V.ships.forEach(s => {
    if (s.sink >= 0) { s.sink += dt; return; }
    const st = NV_STYLE[s.t] || NV_STYLE.sail, sp = s.t === 'sail' ? 14 : 20; s.hpD += (s.hp - s.hpD) * Math.min(1, dt * 2);
    const dx = s.tx - s.x, dy = s.ty - s.y; s.vx += (dx * 0.6 - s.vx) * Math.min(1, dt * 1.2); s.vy += (dy * 0.6 - s.vy) * Math.min(1, dt * 1.2); s.x += clamp(s.vx, -sp, sp) * dt; s.y += clamp(s.vy, -sp, sp) * dt;
    s.fire = Math.max(0, s.fire - dt);
    // humo de chimeneas y de daños
    if (st.funnels && Math.random() < dt * 5) nvPart(V, {k: 'smoke', x: s.x - s.dir * 4, y: s.y - st.h - 10, vx: -s.dir * 8 - V.wind * 6, vy: -9, r: 3, life: 2.2});
    if (s.hpD < 0.7 && Math.random() < dt * (1.5 + (0.7 - s.hpD) * 8)) nvPart(V, {k: 'smoke', x: s.x + rnd(-st.len / 3, st.len / 3), y: s.y - st.h * 0.6, vx: rnd(-6, 6), vy: -14, r: 4, life: 2.6, dark: 1});
    if (s.hpD < 0.45 && Math.random() < dt * 3) nvPart(V, {k: 'fire', x: s.x + rnd(-st.len / 3, st.len / 3), y: s.y - st.h * 0.4, life: 0.5});
    // disparos
    s.cd -= dt; const foes = enemy(s);
    if (s.cd <= 0 && foes.length && !st.sub) {
      s.cd = rnd(1.1, 3.2) * (s.t === 'dread' ? 1.4 : 1); const tgt = foes[Math.floor(Math.random() * foes.length)]; s.fire = 0.25; const n = st.turret || 3;
      for (let k = 0; k < n; k++) { const ox = s.dir * (st.len / 2 - 6 - k * (st.len / (n + 1))) * -1; nvPart(V, {k: 'flash', x: s.x + ox + s.dir * 6, y: s.y - st.h * 0.6, life: 0.12}); nvPart(V, {k: 'smoke', x: s.x + ox + s.dir * 8, y: s.y - st.h * 0.6, vx: s.dir * 6 - V.wind * 4, vy: -5, r: 3, life: 1.8});
        if (k < 2 || s.t === 'dread') nvPart(V, {k: 'shell', x: s.x + ox, y: s.y - st.h * 0.7, x2: tgt.x + rnd(-20, 20), y2: tgt.y - rnd(0, 8), life: rnd(0.7, 1.1), hit: Math.random() < 0.5}); }
    }
  });
  V.parts.forEach(p => { p.age += dt; if (p.k === 'smoke') { p.x += (p.vx || 0) * dt; p.y += (p.vy || 0) * dt; } if (p.k === 'debris') { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 120 * dt; }
    if (p.k === 'shell' && p.age >= p.life && !p.done) { p.done = true; if (p.hit) { nvPart(V, {k: 'boom', x: p.x2, y: p.y2, life: 0.5}); nvPart(V, {k: 'smoke', x: p.x2, y: p.y2, vx: rnd(-5, 5), vy: -12, r: 5, life: 2.4, dark: 1}); } else nvPart(V, {k: 'splash', x: p.x2, y: p.y2 + 4, life: 0.7}); } });
  V.parts = V.parts.filter(p => p.age < p.life + 0.05); if (V.banner) { V.banner.age += dt; if (V.banner.age > 3) V.banner = null; }
  nvDraw(V, r, g);
}
function nvShip(g, s, V) {
  const st = NV_STYLE[s.t] || NV_STYLE.sail, sc = 0.75 + (s.y - 120) / 300, L = st.len * sc, H = st.h * sc, d = s.dir;
  const sk = s.sink >= 0 ? s.sink : 0, tilt = s.sink >= 0 ? Math.min(0.9, sk * 0.35) * -d : Math.sin(V.t * 1.3 + s.ph) * 0.03, dip = s.sink >= 0 ? sk * 16 : 0;
  g.save(); g.translate(s.x, s.y + dip); g.rotate(tilt); g.scale(d, 1); g.globalAlpha = s.sink >= 0 ? Math.max(0, 1 - sk / 3.2) : 1;
  // estela
  if (s.sink < 0) { g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(-L / 2, 0); g.lineTo(-L / 2 - 26, 2); g.moveTo(-L / 2, 1); g.lineTo(-L / 2 - 20, 5); g.stroke(); }
  // casco
  g.fillStyle = s.t === 'sail' ? '#4a3626' : s.t === 'sub' ? '#2f3a3f' : '#4c555d'; g.strokeStyle = '#14181c'; g.lineWidth = 1;
  g.beginPath(); if (st.sub) { g.ellipse(0, -H * 0.3, L / 2, H * 0.55, 0, 0, 6.3); } else { g.moveTo(-L / 2, -H * 0.3); g.lineTo(L / 2 + 4, -H * 0.55); g.lineTo(L / 2 - 4, 0); g.lineTo(-L / 2 + 5, 0); g.closePath(); } g.fill(); g.stroke();
  g.fillStyle = s.color; g.fillRect(-L / 2 + 3, -H * 0.42, L - 8, 2.2);                                   // franja con el color de la nación
  if (st.sub) { g.fillStyle = '#39454b'; g.fillRect(-4, -H * 1.25, 9, H * 0.55); g.fillRect(2, -H * 1.55, 1.5, H * 0.4); }
  for (let k = 0; k < (st.masts || 0); k++) { const mx2 = -L * 0.28 + k * L * 0.28; g.strokeStyle = '#1b1b1f'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(mx2, -H * 0.5); g.lineTo(mx2, -H * 2.9); g.stroke();
    g.fillStyle = '#efe7d0'; g.strokeStyle = 'rgba(0,0,0,.35)'; const bil = Math.sin(V.t * 1.6 + k + s.ph) * 1.5; g.beginPath(); g.moveTo(mx2, -H * 2.7); g.quadraticCurveTo(mx2 + 11 + bil, -H * 1.8, mx2, -H * 0.9); g.closePath(); g.fill(); g.stroke(); g.beginPath(); g.moveTo(mx2, -H * 2.2); g.quadraticCurveTo(mx2 - 9 - bil, -H * 1.6, mx2, -H * 1.0); g.closePath(); g.fill(); g.stroke(); }
  for (let k = 0; k < (st.funnels || 0); k++) { g.fillStyle = '#26262b'; g.fillRect(-L * 0.12 + k * L * 0.22, -H * 1.55, 5, H * 1.1); }
  for (let k = 0; k < (st.turret || 0); k++) { const tx = L * 0.32 - k * (L * 0.62 / Math.max(1, (st.turret || 1) - 1 || 1)); g.fillStyle = '#5b646c'; g.fillRect(tx - 3.5, -H * 0.95, 7, H * 0.45); g.fillStyle = '#2b3136'; g.fillRect(tx + 3, -H * 0.82, 7 + (s.fire > 0 ? 2 : 0), 1.8); }
  if (s.t === 'steam') { g.fillStyle = '#35393f'; g.fillRect(-1, -H * 1.5, 4, H); }
  // bandera
  g.strokeStyle = '#ddd'; g.beginPath(); g.moveTo(L / 2 - 6, -H * 0.5); g.lineTo(L / 2 - 6, -H * 1.3); g.stroke(); g.fillStyle = s.color; g.fillRect(L / 2 - 6, -H * 1.3, 7, 4);
  g.restore();
  // barra de casco
  if (s.sink < 0) { g.fillStyle = 'rgba(0,0,0,.5)'; g.fillRect(s.x - 13, s.y - H * 3.3, 26, 3); g.fillStyle = s.hpD > 0.5 ? '#79c35a' : s.hpD > 0.25 ? '#e0b04a' : '#e8644f'; g.fillRect(s.x - 13, s.y - H * 3.3, 26 * s.hpD, 3); }
}
function nvDraw(V, r, g) {
  const k = g.canvas.width / NV_W; g.setTransform(k, 0, 0, k, 0, 0); const W = NV_W, H = NV_H;
  const sky = g.createLinearGradient(0, 0, 0, 100); sky.addColorStop(0, '#9db9cc'); sky.addColorStop(1, '#cfdde4'); g.fillStyle = sky; g.fillRect(0, 0, W, 100);
  const sea = g.createLinearGradient(0, 96, 0, H); sea.addColorStop(0, '#2f5c78'); sea.addColorStop(1, '#173a52'); g.fillStyle = sea; g.fillRect(0, 96, W, H - 96);
  g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(0, 97); g.lineTo(W, 97); g.stroke();
  for (let i = 0; i < 38; i++) { const y = 104 + (i / 38) * 190, x0 = ((i * 97 + V.t * (10 + i * 0.8)) % (W + 80)) - 40, a = 0.08 + (y - 100) / 900; g.strokeStyle = `rgba(255,255,255,${a})`; g.lineWidth = 1; g.beginPath(); g.moveTo(x0, y); g.quadraticCurveTo(x0 + 14, y - 2.5, x0 + 28, y); g.stroke(); }
  // nubes de fondo
  g.fillStyle = 'rgba(255,255,255,.35)'; for (let i = 0; i < 5; i++) { const cx = ((i * 190 + V.t * 4) % (W + 160)) - 80; g.beginPath(); g.ellipse(cx, 28 + (i % 3) * 14, 46, 9, 0, 0, 6.3); g.fill(); }
  // buques ordenados por profundidad
  const list = [...V.ships.values()].sort((a, b) => a.y - b.y); list.forEach(s => nvShip(g, s, V));
  V.parts.forEach(p => { const q = p.age / p.life; if (p.k === 'smoke') { g.globalAlpha = (1 - q) * 0.5; g.fillStyle = p.dark ? '#25272a' : '#c9c9c5'; g.beginPath(); g.arc(p.x, p.y, p.r * (1 + q * 2.4), 0, 6.3); g.fill(); g.globalAlpha = 1; }
    else if (p.k === 'flash') { g.fillStyle = `rgba(255,235,150,${1 - q})`; g.beginPath(); g.arc(p.x, p.y, 5 * (1 - q * 0.3), 0, 6.3); g.fill(); }
    else if (p.k === 'fire') { g.fillStyle = `rgba(255,${130 + 80 * (1 - q) | 0},40,${0.9 * (1 - q)})`; g.beginPath(); g.arc(p.x, p.y - q * 10, 3 + 2 * (1 - q), 0, 6.3); g.fill(); }
    else if (p.k === 'shell') { const t = Math.min(1, q), x = p.x + (p.x2 - p.x) * t, y = p.y + (p.y2 - p.y) * t - Math.sin(t * 3.14) * 34; g.fillStyle = '#111'; g.beginPath(); g.arc(x, y, 1.8, 0, 6.3); g.fill(); }
    else if (p.k === 'boom') { g.fillStyle = `rgba(255,${150 + 80 * (1 - q) | 0},40,${0.9 * (1 - q)})`; g.beginPath(); g.arc(p.x, p.y, 4 + q * 16, 0, 6.3); g.fill(); }
    else if (p.k === 'splash') { g.strokeStyle = `rgba(255,255,255,${0.9 * (1 - q)})`; g.lineWidth = 1.5; g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x, p.y - 16 * (1 - q)); g.moveTo(p.x - 4, p.y); g.lineTo(p.x - 7, p.y - 9 * (1 - q)); g.moveTo(p.x + 4, p.y); g.lineTo(p.x + 7, p.y - 9 * (1 - q)); g.stroke(); }
    else if (p.k === 'debris') { g.fillStyle = '#5a4630'; g.fillRect(p.x, p.y, 3, 2); } });
  // marcador de dominio
  const pa = r.pa || 1, pb = r.pb || 1, m = clamp(pa / (pa + pb), 0.04, 0.96), ca = G.C[r.a] ? G.C[r.a].color : '#c44', cb = G.C[r.b] ? G.C[r.b].color : '#48c';
  g.fillStyle = 'rgba(8,12,16,.7)'; g.fillRect(0, 0, W, 20); g.fillStyle = ca; g.fillRect(0, 2, W * m, 6); g.fillStyle = cb; g.fillRect(W * m, 2, W * (1 - m), 6); g.fillStyle = '#fff'; g.fillRect(W * m - 1, 0, 2, 10);
  g.font = 'bold 11px sans-serif'; g.textBaseline = 'middle'; g.fillStyle = '#f5ecd0'; g.textAlign = 'left'; g.fillText(`${G.C[r.a].name} · ${r.A ? r.A.length : 0} buques`, 6, 14); g.textAlign = 'right'; g.fillText(`${r.B ? r.B.length : 0} buques · ${G.C[r.b].name}`, W - 6, 14);
  g.textAlign = 'center'; g.fillStyle = '#ffe28a'; g.fillText(m > 0.58 ? `Domina ${G.C[r.a].name}` : m < 0.42 ? `Domina ${G.C[r.b].name}` : 'Combate igualado', W / 2, 14);
  if (V.banner) { const q = V.banner.age, a = q < 0.3 ? q / 0.3 : q > 2.4 ? (3 - q) / 0.6 : 1; g.globalAlpha = clamp(a, 0, 1); g.fillStyle = 'rgba(10,12,16,.8)'; g.fillRect(W / 2 - 190, H - 40, 380, 26); g.fillStyle = V.banner.side === 'A' ? '#ffb89c' : '#a8d0ff'; g.font = 'bold 14px sans-serif'; g.fillText(V.banner.text, W / 2, H - 27); g.globalAlpha = 1; }
}
let _nvRaf = 0;
function nvStart() { if (_nvRaf) return; const loop = () => { _nvRaf = 0; const cv = document.getElementById('nvmap'); if (!cv || UI.nb === null || UI.nb === undefined) return; const r = G.mx && G.mx.nb && G.mx.nb[UI.nb]; if (!r) return; if (!R.nviz || R.nviz.z !== r.z) R.nviz = nvNew(r); nvFrame(R.nviz, r, cv.getContext('2d'), performance.now()); _nvRaf = requestAnimationFrame(loop); }; _nvRaf = requestAnimationFrame(loop); }

/* ---------- panel de la batalla naval ---------- */
function renderNavalPanel() {
  let root = document.getElementById('navalpanel'); if (!root) { root = document.createElement('div'); root.id = 'navalpanel'; document.body.appendChild(root); }
  const z = UI.nb, r = (z !== null && z !== undefined && G.mx && G.mx.nb) ? G.mx.nb[z] : null;
  if (!r) { root.classList.remove('open'); root.innerHTML = ''; root.dataset.zid = ''; UI.nb = null; if (R.skip3d && !UI.battle) { R.skip3d = false; R.dirty = true; R.labelsDirty = true; G.paused = R.bvPrevPause !== false; } return; }
  const live = nbActive(z), side = (tag, fl, ships, sunk) => { const cnt = {}; (ships || []).forEach(s => cnt[s.t] = (cnt[s.t] || 0) + 1); const hp = (ships || []).reduce((n, s) => n + s.hp, 0) / Math.max(1, (ships || []).length);
    return `<div class="bside ${tag === r.a ? 'att' : 'def'}"><h4>${flag(tag, 'sm')} ${G.C[tag].name}</h4>
    <div class="kv sm"><span>Buques</span><b>${SHIP_ORDER.filter(k => cnt[k]).map(k => SHIP_TYPES[k].icon + cnt[k]).join(' ') || '—'}</b></div><div class="kv sm"><span>Casco medio</span><b>${Math.round(hp * 100)}%</b></div>${bar(hp, 1, '')}
    <div class="kv sm"><span>Hundidos</span><b class="bad">${sunk}</b></div>${(fl || []).map(f => `<div class="kv sm"><span>${f.name} · ${f.adm}</span><b>${f.n} · ${NAV_MISSIONS[f.mission] ? NAV_MISSIONS[f.mission].icon : ''}</b></div>`).join('')}</div>`; };
  root.classList.add('open');
  if (root.dataset.zid !== String(z)) { root.dataset.zid = z; R.nviz = null; if (!R.skip3d) { R.skip3d = true; R.bvPrevPause = G.paused; G.paused = true; }
    root.innerHTML = `<div class="sp-head"><div><h2 id="nv-t"></h2><small id="nv-s"></small></div><button class="bvplay" data-act="nvpause"></button><button class="x" data-act="closenb">✕</button></div><canvas id="nvmap" width="${NV_W * 2}" height="${NV_H * 2}"></canvas><div id="nv-st"></div><div id="nv-log" class="blog"></div>`; }
  const pb = root.querySelector('.bvplay'); if (pb) pb.textContent = G.paused ? '▶ Continuar la batalla' : '⏸ Pausar';
  root.querySelector('#nv-t').textContent = '⚓ Batalla naval · ' + SEA_ZONES[z].name; root.querySelector('#nv-s').textContent = `${live ? 'Día ' + r.day : 'Batalla finalizada'} · ${G.C[r.a].name} contra ${G.C[r.b].name}`;
  root.querySelector('#nv-st').innerHTML = `<div class="bsides">${side(r.a, r.fleetsA, r.A, r.sunkB)}${side(r.b, r.fleetsB, r.B, r.sunkA)}</div>`;
  root.querySelector('#nv-log').innerHTML = (r.log || []).slice(0, 6).map(e => `<div class="ev">⚓ ${e}</div>`).join('') || '<small class="dim">Las flotas se acercan…</small>';
  nvStart();
}
Object.assign(ACT, {
  selfleet: d => { const z = +d.z; if (G.mx && G.mx.nb && G.mx.nb[z]) { UI.nb = z; renderNavalPanel(); } else { UI.winTab.mil = 'navy'; UI.win = null; openWindow('military'); } },
  closenb: () => { UI.nb = null; renderNavalPanel(); },
  nvpause: () => { G.paused = !G.paused; if (!G.paused && UI.speed < 2) UI.speed = 2; renderNavalPanel(); }
});
