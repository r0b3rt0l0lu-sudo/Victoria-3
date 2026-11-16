/* ===== NAVES 3D EN EL JUEGO (integración de naves3d.js, ver referencia/naves/TECNICA_NAVES.md) =====
   · Visor de batalla naval 3D: los buques de la época moderna (desde 1930: acorazados, destructores, submarinos y portaaviones) se dibujan con los modelos animados
     de naves3d (torres que apuntan al blanco y retroceden, hundimientos, estela…); los veleros, vapores y acorazados de casamata siguen con los modelos procedurales de naval3d.js.
   · Combate aéreo 3D (nuevo): cada región aérea con cazas o bombarderos enemigos deja un registro (G.mx.ab) y se puede ver en 3D desde la pestaña Aviación.
   · Si el módulo o el equipo no cumplen los requisitos (WebGL2 / texturas en el shader), o hay un error, todo vuelve a lo anterior (NV3.dead). */
const NV3 = {shared: null, dead: false, imgs: {}};
const NV3_ALIAS = {PRU: 'GER', JAP: 'JPN', RUS: 'SOV', SAR: 'ITA'};
const NV3_KIND = {sub: 'submarino', dread: 'acorazado', bb: 'acorazado', destroyer: 'destructor', cruiser: 'destructor', carrier: 'portaaviones'};
function nv3Usable() { try { return !NV3.dead && typeof naves3d !== 'undefined' && typeof b3Usable === 'function' && b3Usable() && !/sinnaves/.test(location.search); } catch (e) { return false; } }
function nv3Flag(tag) {                                                 // bandera del país como imagen (SVG ya cargado); null mientras carga
  const c = G.C[tag]; if (!c) return null; let e = NV3.imgs[tag];
  if (!e) { e = NV3.imgs[tag] = {img: new Image(), ok: false}; e.img.onload = () => { e.ok = true; }; try { e.img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(flagSVG(c.flagSpec).replace('<svg ', '<svg width="124" height="76" ')); } catch (err) { } }
  return e.ok ? e.img : null;
}
function nv3Init() {
  if (NV3.shared) return NV3.shared; const N = naves3d, cl = o => JSON.parse(JSON.stringify(o));
  Object.keys(G.C).forEach(tag => {
    if (tag === NONE || N.NAVES_NAC[tag]) return; const base = NV3_ALIAS[tag];
    if (base) { N.NAVES_NAC[tag] = N.NAVES_NAC[base]; Object.keys(N.NAVE_KINDS).forEach(k => { const M = N.NAVE_KINDS[k].modelos; if (M[base]) M[tag] = M[base]; }); }
    else { const g = cl(N.NAVES_NAC.GEN); g.band = G.C[tag].color; N.NAVES_NAC[tag] = g; }
  });
  NV3.shared = new N.NaveShared(Object.keys(G.C).filter(t => t !== NONE), {flagSource: nv3Flag});
  return NV3.shared;
}
const nv3KindOf = s => (G.date.y >= 1930 && NV3_KIND[s.t]) || null;
function nv3Set(S, kind, tag) {
  const N = naves3d, key = N.naveGeoKey(kind, '2', tag); S.nv = S.nv || {sets: {}, st: new Map()};
  let set = S.nv.sets[key]; if (!set) { set = S.nv.sets[key] = new N.NaveLodSet(NV3.shared, kind, '2', tag, R.lowEnd ? 16 : 40, {dist: [260, 900]}); set.meshes.forEach(m => S.scene.add(m)); set.kind = kind; set.model = N.buildNave(kind, '2', {nation: tag}).eslora || 100; }
  return set;
}
const nv3Ang = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
function nv3Draw(S, V, ships, dt, t) {
  const sh = nv3Init(), now = performance.now() / 1000; sh.update(now); S.nv = S.nv || {sets: {}, st: new Map()};
  Object.values(S.nv.sets).forEach(set => set.begin());
  const mood = S.seed % 3, calm = mood === 2 ? 'navegar_calma' : mood === 1 ? 'navegar_marejada' : 'navegar_calma', cp = S.cam.position;
  ships.forEach(s => {
    const kind = nv3KindOf(s), set = nv3Set(S, kind, s.tag), [wx, wz] = n3W(s.x, s.y); let st = S.nv.st.get(s.id);
    if (!st) { st = {ph: Math.random(), fireT0: -99, aimT: null, aimUntil: 0, sinkT0: 0, sinkClip: null}; S.nv.st.set(s.id, st); }
    const yaw = s.dir > 0 ? Math.PI / 2 : -Math.PI / 2, st0 = NV_STYLE[s.t] ? NV_STYLE[s.t].len : 90, scale = st0 / set.model * (s.t === 'cruiser' ? 1.15 : 1);
    const dist = Math.hypot(cp.x - wx, cp.y, cp.z - wz), o = {}; let clip, ph = st.ph;
    if (s.sink >= 0) {
      if (!st.sinkT0) { st.sinkT0 = now; const r = (s.id * 7) % 10; st.sinkClip = kind === 'submarino' ? 'inmersion' : kind === 'acorazado' && r < 4 ? 'partirse' : r < 6 ? 'hundirse_proa' : r < 8 ? 'hundirse_popa' : 'volcar'; }
      if (now - st.sinkT0 > 15) return; clip = st.sinkClip; o.start = st.sinkT0;
    } else if (now - st.fireT0 < 3 && kind !== 'submarino') { clip = 'andanada'; o.start = st.fireT0; }
    else { clip = calm; o.phase = ph; }
    if (s.sink < 0 && st.aimT && now < st.aimUntil && kind !== 'submarino') { const tg = st.aimT, [tx, tz] = n3W(tg.x, tg.y), b = nv3Ang(Math.atan2(tx - wx, tz - wz) - yaw), el = clamp(0.1 + Math.hypot(tx - wx, tz - wz) / 1800, 0.05, 0.6); o.aim = [b, el, b, el + 0.2]; }
    set.add(dist, wx, 0, wz, yaw, scale, s.tag, clip, o);
  });
}
const _n3SyncNV = n3Sync;
n3Sync = function (S, V, dt, t) {
  if (!nv3Usable()) return _n3SyncNV(S, V, dt, t);
  const un = new Map(), mine = []; V.ships.forEach((s, id) => { if (nv3KindOf(s)) mine.push(s); else un.set(id, s); });
  _n3SyncNV(S, {ships: un}, dt, t);
  try { nv3Draw(S, V, mine, dt, t); }
  catch (e) { console.warn('naves3d desactivado por un error; vuelven los buques procedurales.', e); NV3.dead = true; if (S.nv) Object.values(S.nv.sets).forEach(set => set.meshes.forEach(m => { m.visible = false; })); }
};
// los disparos del visor 2D marcan quién apunta a quién y arrancan el retroceso
const _n3SpawnNV = n3Spawn;
n3Spawn = function (V, p) {
  _n3SpawnNV(V, p);
  if (p.k === 'shell' && N3.S && N3.S.nv) { const a = n3Near(V, p.x, p.y), b = n3Near(V, p.x2, p.y2); const st = a && N3.S.nv.st.get(a.id); if (st && b && b !== a) { const now = performance.now() / 1000; st.aimT = b; st.aimUntil = now + 1.6; if (now - st.fireT0 > 2.6) st.fireT0 = now; } }
};
// al cerrar el panel naval se libera
const _n3DisposeNV = n3Dispose;
n3Dispose = function (S) { if (S && S.nv) { Object.values(S.nv.sets).forEach(set => set.batches.forEach(b => b.dispose())); S.nv = null; } _n3DisposeNV(S); };
