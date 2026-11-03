/* ===== PANEL DE INICIO: ambiente cinematográfico =====
   Capa de partículas (ascuas doradas, polvo y bandas de niebla), rayos de luz, viñeta, y un lento giro de la cámara sobre el mapa mientras eliges
   país. Solo se anima mientras el panel de inicio está visible. */
function stFxStart() {
  const root = document.getElementById('start'); if (!root) return;
  let cv = document.getElementById('stfx'); if (!cv) { cv = document.createElement('canvas'); cv.id = 'stfx'; root.insertBefore(cv, root.firstChild); }
  if (cv._run) return; cv._run = true;
  const P = [], fog = [], rays = [];
  for (let i = 0; i < 90; i++) P.push({x: Math.random(), y: Math.random(), r: 0.6 + Math.random() * 2.2, v: 0.012 + Math.random() * 0.03, d: Math.random() * 6.28, a: 0.25 + Math.random() * 0.6, h: Math.random() < 0.8 ? 42 : 205});
  for (let i = 0; i < 6; i++) fog.push({x: Math.random(), y: 0.55 + Math.random() * 0.45, w: 0.35 + Math.random() * 0.4, v: (Math.random() < 0.5 ? -1 : 1) * (0.004 + Math.random() * 0.006), a: 0.05 + Math.random() * 0.07});
  for (let i = 0; i < 4; i++) rays.push({x: 0.45 + Math.random() * 0.5, w: 0.04 + Math.random() * 0.06, a: 0.025 + Math.random() * 0.03, p: Math.random() * 6.28});
  let last = performance.now(), yawBase = null, tt = 0;
  const loop = now => {
    requestAnimationFrame(loop);
    if (!document.body.classList.contains('starting') || document.hidden) { yawBase = null; last = now; return; }
    const dt = Math.min(0.05, (now - last) / 1000); last = now; tt += dt;
    const w = root.clientWidth, h = root.clientHeight; if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    const g = cv.getContext('2d'); g.clearRect(0, 0, w, h);
    rays.forEach(r => { const a = r.a * (0.6 + 0.4 * Math.sin(tt * 0.4 + r.p)), x = r.x * w, gr = g.createLinearGradient(x, 0, x - h * 0.45, h); gr.addColorStop(0, `rgba(255,224,160,${a})`); gr.addColorStop(1, 'rgba(255,224,160,0)'); g.fillStyle = gr; g.beginPath(); g.moveTo(x - r.w * w * 0.5, 0); g.lineTo(x + r.w * w * 0.5, 0); g.lineTo(x - h * 0.45 + r.w * w * 1.4, h); g.lineTo(x - h * 0.45 - r.w * w * 0.4, h); g.closePath(); g.fill(); });
    fog.forEach(f => { f.x += f.v * dt; if (f.x > 1.4) f.x = -0.4; if (f.x < -0.4) f.x = 1.4; const gr = g.createRadialGradient(f.x * w, f.y * h, 0, f.x * w, f.y * h, f.w * w * 0.5); gr.addColorStop(0, `rgba(190,205,225,${f.a})`); gr.addColorStop(1, 'rgba(190,205,225,0)'); g.fillStyle = gr; g.beginPath(); g.ellipse(f.x * w, f.y * h, f.w * w * 0.5, f.w * h * 0.16, 0, 0, 6.3); g.fill(); });
    g.globalCompositeOperation = 'lighter';
    P.forEach(p => { p.y -= p.v * dt; p.x += Math.sin(tt * 0.6 + p.d) * 0.004 * dt * 12 + 0.003 * dt; if (p.y < -0.02) { p.y = 1.02; p.x = Math.random(); } const tw = 0.5 + 0.5 * Math.sin(tt * 2.2 + p.d * 3), x = p.x * w, y = p.y * h;
      const gr = g.createRadialGradient(x, y, 0, x, y, p.r * 4); gr.addColorStop(0, `hsla(${p.h},90%,70%,${p.a * tw})`); gr.addColorStop(1, `hsla(${p.h},90%,60%,0)`); g.fillStyle = gr; g.beginPath(); g.arc(x, y, p.r * 4, 0, 6.3); g.fill(); });
    g.globalCompositeOperation = 'source-over';
    // giro lento de la cámara sobre el mapa
    if (typeof R !== 'undefined' && R.cam) { if (yawBase === null) yawBase = R.cam.yaw; const want = yawBase + Math.sin(tt * 0.08) * 0.22; if (Math.abs(want - R.cam.yaw) < 0.3) { R.cam.yaw += (want - R.cam.yaw) * Math.min(1, dt * 1.5); if (typeof camChanged === 'function') camChanged(); } }
  };
  requestAnimationFrame(loop);
}
const _buildStart0 = buildStart;
buildStart = function () { _buildStart0(); stFxStart(); };
