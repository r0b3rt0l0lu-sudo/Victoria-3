/* ===== MÓVIL: modo teléfono (body.phone, con .pp vertical y .pl horizontal) =====
   · Se activa solo en pantallas pequeñas con puntero táctil (o ?movil para probar en el ordenador; ?sinmovil lo desactiva).
   · Menos controles a la vista: arriba solo asesor, búsqueda y guardado; en el mapa, zoom, inicio y giro. El resto, tras un botón «⋯».
   · Paneles de estado y ejército como hoja inferior; ventanas a pantalla casi completa; menú inferior desplazable.
   · Visor de batalla: un dedo mueve, dos dedos hacen zoom (y giran/inclinan en 3D), un toque selecciona. */
const MOV = {phone: false, portrait: false, touch: false};
function movUpdate() {
  const q = location.search, coarse = !!(window.matchMedia && matchMedia('(pointer:coarse)').matches), w = innerWidth, h = innerHeight, mn = Math.min(w, h);
  MOV.touch = coarse; MOV.phone = !/sinmovil/.test(q) && (/[?&]movil/.test(q) || (mn <= 560) || (coarse && mn <= 760)); MOV.portrait = h > w;
  const c = document.body.classList; c.toggle('phone', MOV.phone); c.toggle('pp', MOV.phone && MOV.portrait); c.toggle('pl', MOV.phone && !MOV.portrait); c.toggle('touch', coarse || MOV.phone);
  document.documentElement.style.setProperty('--vh', h * 0.01 + 'px');
}
window.addEventListener('resize', movUpdate); window.addEventListener('orientationchange', () => setTimeout(movUpdate, 200)); movUpdate();
// qué botones se quedan a la vista; los demás van tras «⋯»
function movDecorate() {
  const tr = document.getElementById('topright'), cc = document.getElementById('camctl'); if (!tr || !cc) return;
  const kt = ['advisor', 'search', 'save'], kc = ['zin', 'zout', 'camhome', 'rotl', 'rotr'];
  [...tr.children].forEach(b => { if (b.classList.contains('more')) return; b.classList.toggle('k', kt.includes(b.dataset.act)); });
  [...cc.children].forEach(b => { if (b.classList.contains('more')) return; b.classList.toggle('k', kc.includes(b.dataset.act)); });
  if (!document.getElementById('btn-more-top')) tr.insertAdjacentHTML('beforeend', '<button class="rbtn more" id="btn-more-top" data-act="moretop" aria-label="Más botones">⋯</button>');
  if (!document.getElementById('btn-more-cam')) cc.insertAdjacentHTML('beforeend', '<button class="more" id="btn-more-cam" data-act="morecam" aria-label="Más controles del mapa">⋯</button>');
}
const _movBuildHud = buildHud;
buildHud = function () { const r = _movBuildHud.apply(this, arguments); movDecorate(); return r; };
// los botones que ensanchan el mapa tras crearse el HUD (calidad, gráficos…) también se agrupan
setInterval(() => { if (MOV.phone) { const cc = document.getElementById('camctl'); if (cc && !cc.querySelector('.more')) movDecorate(); } }, 2000);
Object.assign(ACT, {
  moretop: () => { const e = document.getElementById('topright'); e.classList.toggle('open'); document.getElementById('camctl').classList.remove('open'); },
  morecam: () => { const e = document.getElementById('camctl'); e.classList.toggle('open'); document.getElementById('topright').classList.remove('open'); }
});
// tocar fuera cierra los menús «⋯»
document.addEventListener('pointerdown', e => { if (!MOV.phone) return; ['topright', 'camctl'].forEach(id => { const el = document.getElementById(id); if (el && el.classList.contains('open') && !el.contains(e.target)) el.classList.remove('open'); }); }, true);

/* ---------- gestos táctiles en el visor de batalla (2D y 3D) ---------- */
function movBattleTouch(cv) {
  if (cv._movT) return; cv._movT = true; let g = null;
  const rel = t => { const r = cv.getBoundingClientRect(); return {x: (t.clientX - r.left) / r.width, y: (t.clientY - r.top) / r.height, cx: t.clientX, cy: t.clientY}; };
  const two = e => { const a = e.touches[0], b = e.touches[1]; return {d: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY), ang: Math.atan2(b.clientY - a.clientY, b.clientX - a.clientX), mx: (a.clientX + b.clientX) / 2, my: (a.clientY + b.clientY) / 2}; };
  cv.addEventListener('touchstart', e => {
    const V = R.bviz; if (!V) return; e.preventDefault();
    if (e.touches.length === 1) { const p = rel(e.touches[0]); g = {mode: 'one', x: p.cx, y: p.cy, x0: p.cx, y0: p.cy, nx: p.x, ny: p.y, moved: 0, t0: performance.now()}; }
    else if (e.touches.length >= 2) { const t = two(e); g = {mode: 'two', d: t.d, ang: t.ang, mx: t.mx, my: t.my, moved: 99}; }
  }, {passive: false});
  cv.addEventListener('touchmove', e => {
    const V = R.bviz; if (!V || !g) return; e.preventDefault(); const r = cv.getBoundingClientRect(), b3 = typeof B3 !== 'undefined' && B3.active;
    if (g.mode === 'one' && e.touches.length === 1) {
      const t = e.touches[0], dx = t.clientX - g.x, dy = t.clientY - g.y; g.moved += Math.abs(dx) + Math.abs(dy); g.x = t.clientX; g.y = t.clientY;
      if (g.moved < 8) return; V.follow = false;
      if (b3) b3Pan(dx, dy, r.height); else if (V.cam.z > 1) { const k = BV_W / r.width; V.cam.x -= dx * k / V.cam.z; V.cam.y -= dy * k / V.cam.z; bvClampCam(V); }
    } else if (e.touches.length >= 2) {
      const t = two(e); if (g.mode !== 'two') { g = {mode: 'two', d: t.d, ang: t.ang, mx: t.mx, my: t.my, moved: 99}; return; }
      const f = t.d / Math.max(10, g.d); V.follow = false;
      if (b3) { B3.cam.d = clamp(B3.cam.d / f, 25, 2600); let da = t.ang - g.ang; if (da > Math.PI) da -= 2 * Math.PI; if (da < -Math.PI) da += 2 * Math.PI; B3.cam.yaw -= da; B3.cam.pit = clamp(B3.cam.pit - (t.my - g.my) * 0.004, 0.1, 1.5); b3Pan(t.mx - g.mx, 0, r.height); }
      else { const sx = (t.mx - r.left) / r.width * BV_W, sy = (t.my - r.top) / r.height * BV_H; bvZoomAt(V, f, sx, sy); if (V.cam.z > 1) { const k = BV_W / r.width; V.cam.x -= (t.mx - g.mx) * k / V.cam.z; V.cam.y -= (t.my - g.my) * k / V.cam.z; bvClampCam(V); } }
      g.d = t.d; g.ang = t.ang; g.mx = t.mx; g.my = t.my;
    }
  }, {passive: false});
  const end = e => {
    const V = R.bviz; if (!V || !g) return; e.preventDefault();
    if (e.touches.length === 0) {
      if (g.mode === 'one' && g.moved < 10 && performance.now() - g.t0 < 600) {       // toque: señala el bloque y lo selecciona
        const b3 = typeof B3 !== 'undefined' && B3.active;
        if (b3 && B3.S) { const w = b3Pick(B3.S, g.nx, g.ny); B3.hoverW = w; V.mouse = w ? {x: (w[0] - V.cam.x) * V.cam.z + BV_W / 2, y: (w[1] - V.cam.y) * V.cam.z + BV_H / 2} : null; }
        else V.mouse = {x: g.nx * BV_W, y: g.ny * BV_H};
        bvHover(V, [...V.blocks.values()]); bvClick(V);
      }
      g = null;
    } else if (e.touches.length === 1) { const p = rel(e.touches[0]); g = {mode: 'one', x: p.cx, y: p.cy, x0: p.cx, y0: p.cy, nx: p.x, ny: p.y, moved: 99, t0: 0}; }
  };
  cv.addEventListener('touchend', end, {passive: false}); cv.addEventListener('touchcancel', end, {passive: false});
}
const _movBvBind = bvBind;
bvBind = function (cv) { movBattleTouch(cv); return _movBvBind(cv); };
