/* ===== ASPECTO: soldados, caballos, cañones, fuertes y efectos del campo de batalla =====
   Sustituye los dibujos sencillos por figuras con más detalle: infantes con chaqueta, correajes, mochila, chacó con penacho, oficiales con
   charreteras y espada, jinetes con caballo animado, piezas con ruedas de radios y servidores con baqueta. Los fuertes tienen texturas
   (sacos de tierra, empalizada de troncos, gaviones, sillería con almenas y torres), banderas ondeantes y arden y humean al ser dañados.
   También añade cráteres, resplandor aditivo de fogonazos y explosiones, viñeta, tinte según la hora del día y temblor de pantalla. */
const hexRgb = h => { const n = parseInt(String(h).replace('#', '').padEnd(6, '8').slice(0, 6), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
const mixc = (c, k) => { const m = k < 0 ? 0 : 255, a = Math.abs(k); return `rgb(${Math.round(c[0] + (m - c[0]) * a)},${Math.round(c[1] + (m - c[1]) * a)},${Math.round(c[2] + (m - c[2]) * a)})`; };
function bvFigNew(g, V, blk, f) {
  if (blk.type === 'tank') return false;
  const s = blk.sc, x = f.x, y = f.y, fall = f.dying > 0 ? 1 - f.dying / 0.8 : 0, hd = blk.hd, ca = Math.cos(hd), sa = Math.sin(hd), moving = (blk.sp || 0) > 8 || f.flee > 0, t = V.t, fl = f.flee > 0;
  const rgb = blk._rgb || (blk._rgb = hexRgb(blk.color)), eng = blk.mode === 'melee' || blk.mode === 'charge' || blk.mode === 'gallop', bob = moving ? Math.sin(t * 13 + f.ph) * 0.7 : 0;
  const pants = blk._pants || (blk._pants = hash2(blk.tag.charCodeAt(0), blk.tag.charCodeAt(1 % blk.tag.length), 3) < 0.5 ? '#d6d0bd' : mixc(rgb, -0.62));
  if (fall) g.globalAlpha = 1 - fall * 0.6;
  g.fillStyle = 'rgba(0,0,0,.32)'; g.beginPath(); g.ellipse(x + 0.8, y + 4.2 * s, (f.kind === 'gun' ? 6 : blk.type === 'cav' ? 7 : 3.6) * s, 1.5 * s, 0, 0, 6.3); g.fill();
  const person = (px, py, o) => {                       // soldado de a pie
    const sw = moving ? Math.sin(t * 13 + f.ph) * 1.5 * s : 0, coat = fl ? '#d9cfae' : mixc(rgb, 0.02), dark = mixc(rgb, -0.45);
    g.strokeStyle = pants; g.lineWidth = 1.5 * s; g.lineCap = 'round'; g.beginPath(); g.moveTo(px - 0.9 * s, py + 1.6 * s + bob); g.lineTo(px - 1.1 * s + sw, py + 4.8 * s); g.moveTo(px + 0.9 * s, py + 1.6 * s + bob); g.lineTo(px + 1.1 * s - sw, py + 4.8 * s); g.stroke();
    g.strokeStyle = '#1b1a1c'; g.lineWidth = 1.7 * s; g.beginPath(); g.moveTo(px - 1.1 * s + sw, py + 4.7 * s); g.lineTo(px - 1.1 * s + sw, py + 5.2 * s); g.moveTo(px + 1.1 * s - sw, py + 4.7 * s); g.lineTo(px + 1.1 * s - sw, py + 5.2 * s); g.stroke(); g.lineCap = 'butt';
    if (!o.crew && !fl) { g.fillStyle = '#4a3a2a'; g.fillRect(px - ca * 2.9 * s - 1.2 * s, py - 2.8 * s + bob, 2.4 * s, 3.4 * s); }       // mochila
    g.fillStyle = dark; g.fillRect(px - 2.5 * s, py - 3.6 * s + bob, 5 * s, 5.6 * s); g.fillStyle = coat; g.fillRect(px - 2.1 * s, py - 3.3 * s + bob, 4.2 * s, 4.7 * s);
    g.fillStyle = dark; g.beginPath(); g.moveTo(px - 2.3 * s, py + 1.3 * s + bob); g.lineTo(px + 2.3 * s, py + 1.3 * s + bob); g.lineTo(px + 2.9 * s, py + 2.6 * s + bob); g.lineTo(px - 2.9 * s, py + 2.6 * s + bob); g.closePath(); g.fill();   // faldones
    if (!o.crew) { g.strokeStyle = 'rgba(245,245,240,.85)'; g.lineWidth = 0.7 * s; g.beginPath(); g.moveTo(px - 2 * s, py - 3.2 * s + bob); g.lineTo(px + 2 * s, py + 1 * s + bob); g.moveTo(px + 2 * s, py - 3.2 * s + bob); g.lineTo(px - 2 * s, py + 1 * s + bob); g.stroke(); }
    g.fillStyle = '#3a2f22'; g.fillRect(px - 2.2 * s, py + 0.8 * s + bob, 4.4 * s, 0.8 * s);
    if (o.off) { g.fillStyle = '#e6c04a'; g.fillRect(px - 3 * s, py - 3.7 * s + bob, 1.6 * s, 1.1 * s); g.fillRect(px + 1.4 * s, py - 3.7 * s + bob, 1.6 * s, 1.1 * s); }   // charreteras
    g.fillStyle = '#e7c9a6'; g.beginPath(); g.arc(px, py - 4.7 * s + bob, 1.55 * s, 0, 6.3); g.fill();
    if (o.off) { g.fillStyle = '#16161a'; g.beginPath(); g.moveTo(px - 3 * s, py - 5.4 * s + bob); g.lineTo(px, py - 8.2 * s + bob); g.lineTo(px + 3 * s, py - 5.4 * s + bob); g.closePath(); g.fill(); g.fillStyle = '#e6c04a'; g.fillRect(px - 0.6 * s, py - 6.4 * s + bob, 1.2 * s, 0.9 * s); }      // bicornio
    else { g.fillStyle = '#17181c'; g.fillRect(px - 1.7 * s, py - 8.1 * s + bob, 3.4 * s, 3.5 * s); g.fillStyle = '#2a2b31'; g.fillRect(px - 2 * s, py - 5.1 * s + bob, 4 * s, 0.7 * s); g.fillStyle = '#d4b24c'; g.fillRect(px - 0.6 * s, py - 7 * s + bob, 1.2 * s, 1.2 * s); g.fillStyle = o.crew ? '#8a8a90' : (blk.side === 'A' ? '#e8e3d6' : '#d8eaff'); g.beginPath(); g.ellipse(px, py - 8.6 * s + bob, 0.9 * s, 1.5 * s, 0, 0, 6.3); g.fill(); }
    if (o.rammer) { g.strokeStyle = '#6a5036'; g.lineWidth = 1 * s; g.beginPath(); g.moveTo(px - ca * 4 * s, py - 1 * s + bob - sa * 4 * s); g.lineTo(px + ca * 6 * s, py - 1 * s + bob + sa * 6 * s); g.stroke(); }
    else if (!fl) {
      const rx0 = px + ca * 0.5, ry0 = py - 2.4 * s + bob, ln = (eng ? 7.5 : 8.5) * s; g.strokeStyle = '#4a3322'; g.lineWidth = 1.3 * s; g.beginPath(); g.moveTo(rx0 - ca * 1.6, ry0 - sa * 1.6); g.lineTo(rx0 + ca * ln * 0.55, ry0 + sa * ln * 0.55); g.stroke();
      g.strokeStyle = '#2b2a2e'; g.lineWidth = 0.9 * s; g.beginPath(); g.moveTo(rx0 + ca * ln * 0.5, ry0 + sa * ln * 0.5); g.lineTo(rx0 + ca * ln, ry0 + sa * ln); g.stroke();
      if (eng) { g.strokeStyle = '#dfe3ea'; g.lineWidth = 0.6 * s; g.beginPath(); g.moveTo(rx0 + ca * ln, ry0 + sa * ln); g.lineTo(rx0 + ca * (ln + 4 * s), ry0 + sa * (ln + 4 * s)); g.stroke(); }          // bayoneta
      if (o.off) { g.strokeStyle = '#dcdfe6'; g.lineWidth = 0.8 * s; g.beginPath(); g.moveTo(px + 2 * s, py - 1.5 * s + bob); g.lineTo(px + 2 * s + ca * 5 * s, py - 1.5 * s + bob + sa * 5 * s - 3 * s); g.stroke(); }
      if (f.flash > 0) { g.globalCompositeOperation = 'lighter'; const gx = rx0 + ca * (ln + 2 * s), gy = ry0 + sa * (ln + 2 * s), rg = g.createRadialGradient(gx, gy, 0, gx, gy, 7 * s); rg.addColorStop(0, 'rgba(255,230,150,.9)'); rg.addColorStop(1, 'rgba(255,150,40,0)'); g.fillStyle = rg; g.beginPath(); g.arc(gx, gy, 7 * s, 0, 6.3); g.fill(); g.globalCompositeOperation = 'source-over'; }
    }
  };
  if (f.kind === 'sol' && blk.type === 'inf') person(x, y, {off: f.k === 0});
  else if (f.kind === 'crew') person(x, y, {crew: true, rammer: f.k % 3 === 0});
  else if (f.kind === 'sol') {                                                   // jinete
    const hc = ['#6b4a2b', '#2e2420', '#8b6a44', '#c9c0ae', '#4a3322'][Math.floor(f.ph * 3) % 5], an = Math.atan2(blk.vy || sa, blk.vx || ca) * 0.3, gal = moving ? Math.sin(t * 17 + f.ph) : 0;
    const fx = Math.cos(an) >= 0 ? 1 : -1;
    g.strokeStyle = mixc(hexRgb(hc), -0.35); g.lineWidth = 1.2 * s; g.lineCap = 'round';
    [[-3.6, 1], [-2.4, -1], [2.4, 1], [3.6, -1]].forEach(([lx, ph]) => { const sw = gal * 2.2 * ph; g.beginPath(); g.moveTo(x + lx * s, y - 0.4 * s + bob); g.lineTo(x + lx * s + sw, y + 3.4 * s); g.stroke(); });
    g.lineCap = 'butt'; const lg = g.createLinearGradient(x, y - 5 * s, x, y + 1 * s); lg.addColorStop(0, mixc(hexRgb(hc), 0.25)); lg.addColorStop(1, hc); g.fillStyle = lg; g.beginPath(); g.ellipse(x, y - 1.6 * s + bob, 7.4 * s, 3.3 * s, an, 0, 6.3); g.fill();
    g.fillStyle = mixc(hexRgb(hc), -0.2); g.beginPath(); g.ellipse(x + ca * 6.6 * s, y - 3.3 * s + bob + sa * 2, 2.6 * s, 1.9 * s, an + 0.4, 0, 6.3); g.fill(); g.beginPath(); g.ellipse(x + ca * 8.4 * s, y - 2.5 * s + bob + sa * 2.4, 1.5 * s, 1.1 * s, an, 0, 6.3); g.fill();
    g.strokeStyle = '#1c1612'; g.lineWidth = 1.3 * s; g.beginPath(); g.moveTo(x - ca * 7 * s, y - 2.4 * s + bob); g.quadraticCurveTo(x - ca * 10 * s, y - 0.5 * s + gal * 2, x - ca * 9 * s, y + 2.2 * s); g.stroke();       // cola
    g.fillStyle = blk.color; g.fillRect(x - 3 * s, y - 3.2 * s + bob, 6 * s, 1.6 * s);                                       // gualdrapa
    g.fillStyle = mixc(rgb, -0.4); g.fillRect(x - 1.9 * s, y - 7 * s + bob, 3.8 * s, 4.9 * s); g.fillStyle = blk.color; g.fillRect(x - 1.6 * s, y - 6.7 * s + bob, 3.2 * s, 4.2 * s);
    g.strokeStyle = 'rgba(245,245,240,.8)'; g.lineWidth = 0.6 * s; g.beginPath(); g.moveTo(x - 1.5 * s, y - 6.5 * s + bob); g.lineTo(x + 1.5 * s, y - 2.8 * s + bob); g.stroke();
    g.fillStyle = '#e7c9a6'; g.beginPath(); g.arc(x, y - 8 * s + bob, 1.45 * s, 0, 6.3); g.fill(); g.fillStyle = '#c9a23c'; g.fillRect(x - 1.6 * s, y - 10.2 * s + bob, 3.2 * s, 2.3 * s); g.fillStyle = '#9a1c1c'; g.fillRect(x - 0.4 * s, y - 12.2 * s + bob, 0.8 * s, 2.2 * s);
    g.strokeStyle = '#dfe3ea'; g.lineWidth = 1 * s; g.beginPath(); const sw2 = eng ? Math.sin(t * 14 + f.ph) * 0.9 : 0; g.moveTo(x + 1.4 * s, y - 5 * s + bob); g.lineTo(x + 1.4 * s + ca * 10 * s + sa * sw2 * 4, y - 9 * s + bob + sa * 6 * s - sw2 * 3); g.stroke();
    void fx;
  } else if (f.kind === 'gun') {
    const rc = f.recoil * 3.4, sp = (1 - f.recoil) * 0.4;
    g.strokeStyle = '#3a2a1a'; g.lineWidth = 2.2 * s; g.beginPath(); g.moveTo(x - ca * (4 + rc) * s, y + 1.5 * s - sa * rc); g.lineTo(x - ca * 11 * s, y + 3.5 * s); g.stroke();                              // afuste
    g.fillStyle = '#5a4430'; g.fillRect(x - 4.5 * s - ca * rc, y - 2.2 * s - sa * rc, 9 * s, 4 * s);
    [[-1, 1.5], [1, -1.5]].forEach(([k, off]) => { const wx = x + k * 0.5 * s - ca * rc, wy = y + off * s; g.fillStyle = '#2a2018'; g.beginPath(); g.arc(wx, wy, 3.3 * s, 0, 6.3); g.fill(); g.fillStyle = '#7a5a38'; g.beginPath(); g.arc(wx, wy, 2.7 * s, 0, 6.3); g.fill(); g.strokeStyle = '#2a2018'; g.lineWidth = 0.7 * s; for (let i = 0; i < 6; i++) { const a = i * 1.047 + sp; g.beginPath(); g.moveTo(wx, wy); g.lineTo(wx + Math.cos(a) * 2.7 * s, wy + Math.sin(a) * 2.7 * s); g.stroke(); } g.fillStyle = '#2a2018'; g.beginPath(); g.arc(wx, wy, 0.8 * s, 0, 6.3); g.fill(); });
    const bx0 = x - ca * (3 + rc) * s, by0 = y - 1.2 * s - sa * rc, bx1 = x + ca * 11 * s - ca * rc, by1 = y - 1.2 * s + sa * 11 * s - sa * rc;
    g.lineCap = 'round'; g.strokeStyle = '#2f343a'; g.lineWidth = 3.9 * s; g.beginPath(); g.moveTo(bx0, by0); g.lineTo(bx1, by1); g.stroke(); g.strokeStyle = '#6a7078'; g.lineWidth = 2.5 * s; g.beginPath(); g.moveTo(bx0, by0); g.lineTo(bx1, by1); g.stroke(); g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 0.8 * s; g.beginPath(); g.moveTo(bx0, by0 - 0.8 * s); g.lineTo(bx1, by1 - 0.8 * s); g.stroke();
    g.strokeStyle = '#8a8f96'; g.lineWidth = 3.2 * s; g.beginPath(); g.moveTo(bx1 - ca * 1.4 * s, by1 - sa * 1.4 * s); g.lineTo(bx1, by1); g.stroke(); g.lineCap = 'butt';
    g.fillStyle = blk.color; g.fillRect(x - 3 * s, y - 3.6 * s, 6 * s, 1.6 * s); g.fillStyle = '#3d2f20'; g.fillRect(x + ca * 4 * s - 2 * s, y + 2 * s, 4 * s, 2.4 * s);
  } else return false;
  g.globalAlpha = 1; return true;
}
/* ---------- fuertes ---------- */
function fortFlame(g, V, x, y, k, seed) {
  const t = V.t * 7 + seed * 3.1, h = (6 + 7 * k) * (0.75 + 0.25 * Math.sin(t)), w = 3.5 + 3 * k;
  g.globalCompositeOperation = 'lighter'; const rg = g.createRadialGradient(x, y - h * 0.4, 1, x, y - h * 0.4, h * 1.5); rg.addColorStop(0, 'rgba(255,200,90,.55)'); rg.addColorStop(1, 'rgba(255,90,20,0)'); g.fillStyle = rg; g.beginPath(); g.arc(x, y - h * 0.4, h * 1.5, 0, 6.3); g.fill(); g.globalCompositeOperation = 'source-over';
  [['#d8441a', 1], ['#f59a2a', 0.72], ['#ffe27a', 0.4]].forEach(([c, m]) => { g.fillStyle = c; g.beginPath(); g.moveTo(x - w * m, y); g.quadraticCurveTo(x - w * m * 0.9 + Math.sin(t * 1.3) * 1.5, y - h * m * 0.6, x + Math.sin(t * 1.7) * 2 * m, y - h * m); g.quadraticCurveTo(x + w * m * 0.9, y - h * m * 0.5, x + w * m, y); g.closePath(); g.fill(); });
}
function fortSmoke(g, V, x, y, n, seed) { for (let i = 0; i < n; i++) { const k = ((V.t * 0.35 + i / n + seed) % 1), r = 4 + k * 12; g.globalAlpha = 0.3 * (1 - k); g.fillStyle = '#4c4a47'; g.beginPath(); g.arc(x + Math.sin(i * 2 + seed + V.t) * 5 + k * 8, y - k * 34, r, 0, 6.3); g.fill(); } g.globalAlpha = 1; }
function sandbags(g, x0, y0, n, dx, dy, w) { for (let i = 0; i < n; i++) { const x = x0 + i * dx, y = y0 + i * dy; g.fillStyle = (i % 2) ? '#b3a074' : '#a29066'; g.beginPath(); g.ellipse(x, y, w, w * 0.62, 0, 0, 6.3); g.fill(); g.strokeStyle = 'rgba(60,48,28,.7)'; g.lineWidth = 0.7; g.stroke(); g.fillStyle = 'rgba(255,255,255,.14)'; g.beginPath(); g.ellipse(x - w * 0.2, y - w * 0.2, w * 0.45, w * 0.2, 0, 0, 6.3); g.fill(); } }
function fortGun(g, x, y, dir, hpf) { g.fillStyle = '#2a2018'; g.beginPath(); g.arc(x - dir * 3, y + 1, 3, 0, 6.3); g.fill(); g.fillStyle = '#7a5a38'; g.beginPath(); g.arc(x - dir * 3, y + 1, 2.3, 0, 6.3); g.fill(); g.strokeStyle = '#30353b'; g.lineWidth = 4; g.lineCap = 'round'; g.beginPath(); g.moveTo(x - dir * 3, y); g.lineTo(x + dir * 11, y); g.stroke(); g.strokeStyle = '#6c727a'; g.lineWidth = 2.6; g.beginPath(); g.moveTo(x - dir * 3, y); g.lineTo(x + dir * 11, y); g.stroke(); g.lineCap = 'butt'; void hpf; }
function tacDrawForts(g, V, b) {
  (b.forts || []).forEach(f => {
    const K = FORT_KINDS[f.kind], x = f.x, y = f.y, w = f.w, h = f.h, dead = f.hp <= 0, hpf = clamp(f.hp / f.hpMax, 0, 1), dir = f.side === 'A' ? 1 : -1, sel = V.selFort === f.id, tcol = G.C[f.side === 'A' ? b.A0 : b.B0].color;
    g.save(); g.translate(x, y);
    if (dead) {
      g.fillStyle = 'rgba(30,24,18,.55)'; g.beginPath(); g.ellipse(0, 0, w / 2 + 4, h / 2 + 4, 0, 0, 6.3); g.fill();
      for (let i = 0; i < 22; i++) { const rx = (hash2(f.id, i, 1) - 0.5) * w, ry = (hash2(f.id, i, 2) - 0.5) * h; g.fillStyle = ['#6a5a46', '#4a3d2e', '#7b7364', '#3a2f22'][i % 4]; g.save(); g.translate(rx, ry); g.rotate(hash2(f.id, i, 4) * 3); g.fillRect(-4, -1.5, 5 + hash2(f.id, i, 3) * 6, 3); g.restore(); }
      fortFlame(g, V, (hash2(f.id, 1, 9) - 0.5) * w * 0.5, 2, 0.4, f.id); fortSmoke(g, V, 0, -2, 3, f.id); g.restore(); return;
    }
    g.fillStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.ellipse(4, h / 2 + 3, w / 2 + 4, 5, 0, 0, 6.3); g.fill();
    if (f.kind === 'trench') {
      g.fillStyle = '#1f160c'; g.fillRect(-w / 2, -h / 2, w, h); g.fillStyle = '#6e5636'; for (let i = -w / 2 + 2; i < w / 2; i += 6) g.fillRect(i, -h / 2 + 1.5, 3.4, h - 3);                              // tablones del fondo
      g.fillStyle = '#5a4126'; g.fillRect(-w / 2, -h / 2, w, 2); g.fillRect(-w / 2, h / 2 - 2, w, 2);
      g.fillStyle = 'rgba(52,40,24,.9)'; g.fillRect(-w / 2 - 3, -h / 2 - 3 - (dir > 0 ? 0 : 0), w + 6, 3.4); g.fillRect(-w / 2 - 3, h / 2 - 0.4, w + 6, 3.4);
      sandbags(g, -w / 2 + 3, dir > 0 ? h / 2 + 2.4 : -h / 2 - 2.4, Math.floor(w / 6.4), 6.4, 0, 3.4);
      for (let i = 0; i < 4; i++) { const px = -w / 2 + 12 + i * (w - 24) / 3; g.strokeStyle = '#3a2d1b'; g.lineWidth = 1; g.beginPath(); g.moveTo(px, -h / 2); g.lineTo(px, h / 2); g.stroke(); }
    } else if (f.kind === 'redoubt') {
      g.fillStyle = '#4a3a24'; g.beginPath(); g.moveTo(-w / 2 - 6, -h / 2 + 8); g.lineTo(-w / 2 + 6, -h / 2 - 6); g.lineTo(w / 2 - 6, -h / 2 - 6); g.lineTo(w / 2 + 6, -h / 2 + 8); g.lineTo(w / 2 + 6, h / 2 - 8); g.lineTo(w / 2 - 6, h / 2 + 6); g.lineTo(-w / 2 + 6, h / 2 + 6); g.lineTo(-w / 2 - 6, h / 2 - 8); g.closePath(); g.fill();      // foso
      g.fillStyle = '#7a6040'; g.beginPath(); g.moveTo(-w / 2, -h / 2 + 6); g.lineTo(-w / 2 + 5, -h / 2); g.lineTo(w / 2 - 5, -h / 2); g.lineTo(w / 2, -h / 2 + 6); g.lineTo(w / 2, h / 2 - 6); g.lineTo(w / 2 - 5, h / 2); g.lineTo(-w / 2 + 5, h / 2); g.lineTo(-w / 2, h / 2 - 6); g.closePath(); g.fill();
      g.fillStyle = '#3a2d1c'; g.fillRect(-w / 2 + 8, -h / 2 + 8, w - 16, h - 16); g.fillStyle = 'rgba(255,255,255,.08)'; g.fillRect(-w / 2 + 5, -h / 2 + 1, w - 10, 2.5);
      g.strokeStyle = '#8c6c42'; g.lineWidth = 1.6; for (let i = -w / 2 + 6; i < w / 2 - 4; i += 4) { g.beginPath(); g.moveTo(i, -h / 2 - 1); g.lineTo(i + 1.2, -h / 2 - 5); g.stroke(); g.beginPath(); g.moveTo(i, h / 2 + 1); g.lineTo(i + 1.2, h / 2 + 5); g.stroke(); }
      g.strokeStyle = '#5a4226'; g.lineWidth = 1; g.strokeRect(-w / 2 + 8, -h / 2 + 8, w - 16, h - 16);
    } else if (f.kind === 'battery') {
      g.fillStyle = '#6d5834'; g.beginPath(); g.ellipse(-dir * 3, 0, w / 2, h / 2, 0, 0, 6.3); g.fill(); g.fillStyle = '#41331f'; g.beginPath(); g.ellipse(-dir * 3, 0, w / 2 - 7, h / 2 - 6, 0, 0, 6.3); g.fill();
      for (let i = 0; i < 9; i++) { const a = -1.35 + i * 0.34, gx = dir * Math.cos(a) * (w / 2 - 2) - dir * 3, gy = Math.sin(a) * (h / 2 - 1); g.fillStyle = '#8a6b3c'; g.beginPath(); g.arc(gx, gy, 3.1, 0, 6.3); g.fill(); g.strokeStyle = '#4a3820'; g.lineWidth = 0.8; g.stroke(); g.fillStyle = 'rgba(255,255,255,.2)'; g.beginPath(); g.arc(gx - 0.8, gy - 0.8, 1.2, 0, 6.3); g.fill(); }     // gaviones
      g.fillStyle = '#a88a55'; for (let i = 0; i < 3; i++) g.fillRect(-dir * 12 - 2, -6 + i * 5, 4, 3);                                                                                                 // cajas de munición
    } else {   // fuerte de piedra
      g.fillStyle = '#4a4338'; g.fillRect(-w / 2 - 5, -h / 2 - 5, w + 10, h + 10);
      const wall = g.createLinearGradient(0, -h / 2, 0, h / 2); wall.addColorStop(0, '#9b9282'); wall.addColorStop(1, '#756d5f'); g.fillStyle = wall; g.fillRect(-w / 2, -h / 2, w, h);
      g.strokeStyle = 'rgba(40,34,26,.45)'; g.lineWidth = 0.8; for (let yy = -h / 2 + 7; yy < h / 2; yy += 7) { g.beginPath(); g.moveTo(-w / 2, yy); g.lineTo(w / 2, yy); g.stroke(); for (let xx = -w / 2 + ((yy / 7) % 2 ? 5 : 0); xx < w / 2; xx += 10) { g.beginPath(); g.moveTo(xx, yy); g.lineTo(xx, yy + 7); g.stroke(); } }
      g.fillStyle = '#5a5246'; g.fillRect(-w / 2 + 7, -h / 2 + 7, w - 14, h - 14); g.fillStyle = '#9a3a2a'; g.fillRect(-12, -9, 24, 18); g.fillStyle = '#6a2a1e'; g.beginPath(); g.moveTo(-14, -9); g.lineTo(0, -18); g.lineTo(14, -9); g.closePath(); g.fill();   // torre del homenaje
      [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([sx, sy]) => { const tx = sx * (w / 2), ty = sy * (h / 2); g.fillStyle = '#8a8172'; g.beginPath(); g.arc(tx, ty, 9, 0, 6.3); g.fill(); g.fillStyle = '#6a6256'; g.beginPath(); g.arc(tx, ty, 6.4, 0, 6.3); g.fill(); g.fillStyle = '#a09686'; for (let i = 0; i < 6; i++) { const a = i * 1.047; g.fillRect(tx + Math.cos(a) * 8.5 - 1.2, ty + Math.sin(a) * 8.5 - 1.2, 2.4, 2.4); } });
      g.fillStyle = '#1c1812'; g.beginPath(); g.moveTo(dir * (w / 2) - dir * 2, -6); g.lineTo(dir * (w / 2) + dir * 2, -6); g.lineTo(dir * (w / 2) + dir * 2, 6); g.lineTo(dir * (w / 2) - dir * 2, 6); g.closePath(); g.fill();
    }
    if (f.kind !== 'trench') { const wv = Math.sin(V.t * 4 + f.id) * 2; g.strokeStyle = '#2a2a2e'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(0, -h / 2 - (f.kind === 'fort' ? 20 : 3)); g.lineTo(0, -h / 2 - (f.kind === 'fort' ? 34 : 17)); g.stroke(); g.fillStyle = tcol; g.beginPath(); const fy = -h / 2 - (f.kind === 'fort' ? 34 : 17); g.moveTo(0, fy); g.quadraticCurveTo(7, fy + wv, 14, fy + 1.5); g.lineTo(14, fy + 8); g.quadraticCurveTo(7, fy + 8 + wv, 0, fy + 7); g.fill(); g.fillStyle = 'rgba(255,255,255,.7)'; g.fillRect(1, fy + 3, 12, 1.3); }
    for (let i = 0; i < f.guns; i++) fortGun(g, dir * (w / 2 - 8), (i - (f.guns - 1) / 2) * Math.min(12, (h - 12) / Math.max(1, f.guns)), dir, hpf);
    if (hpf < 0.65) { g.strokeStyle = 'rgba(20,14,8,.7)'; g.lineWidth = 1; for (let i = 0; i < Math.ceil((0.65 - hpf) * 10); i++) { const cx = (hash2(f.id, i, 21) - 0.5) * w, cy = (hash2(f.id, i, 22) - 0.5) * h; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + 5, cy + 3); g.lineTo(cx + 3, cy + 8); g.stroke(); } }
    if (hpf < 0.4) { fortFlame(g, V, -w * 0.2, 2, (0.4 - hpf) * 2.2, f.id); if (hpf < 0.25) fortFlame(g, V, w * 0.22, 0, (0.4 - hpf) * 2, f.id + 5); fortSmoke(g, V, 0, -h / 2, 3, f.id); }
    { const gn = tacGarrisonOf(b, f).length; if (gn) { g.fillStyle = 'rgba(10,12,16,.85)'; g.fillRect(-14, -h / 2 - 16, 28, 13); g.fillStyle = '#ffe9a8'; g.font = 'bold 10px sans-serif'; g.textAlign = 'center'; g.fillText('👥 ' + gn, 0, -h / 2 - 6); } }
    g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(-w / 2, h / 2 + 7, w, 4); g.fillStyle = hpf > 0.5 ? '#79c35a' : hpf > 0.25 ? '#e0b04a' : '#e8644f'; g.fillRect(-w / 2, h / 2 + 7, w * hpf, 4);
    if (sel) { g.strokeStyle = '#fff3a0'; g.setLineDash([5, 3]); g.lineWidth = 1.6; g.strokeRect(-w / 2 - 7, -h / 2 - 7, w + 14, h + 14); g.setLineDash([]); }
    g.restore(); void K;
  });
}
/* ---------- efectos de ambiente del campo ---------- */
function bvFxUnder(g, V, b) {         // cráteres bajo las unidades
  (V.craters || []).forEach(c => { g.fillStyle = 'rgba(30,22,14,.35)'; g.beginPath(); g.ellipse(c.x, c.y, c.r * 1.5, c.r, 0, 0, 6.3); g.fill(); g.strokeStyle = 'rgba(190,170,130,.3)'; g.lineWidth = 0.8; g.stroke(); g.fillStyle = 'rgba(20,14,8,.5)'; g.beginPath(); g.ellipse(c.x, c.y, c.r * 0.9, c.r * 0.6, 0, 0, 6.3); g.fill(); });
}
function bvFxOver(g, V, b, W, H) {    // resplandor aditivo, viñeta y tinte
  g.globalCompositeOperation = 'lighter';
  V.parts.forEach(p => { const k = p.age / p.life; if (p.k === 'boom') { const r = 30 + k * 40, rg = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, r); rg.addColorStop(0, `rgba(255,190,90,${0.5 * (1 - k)})`); rg.addColorStop(1, 'rgba(255,90,20,0)'); g.fillStyle = rg; g.beginPath(); g.arc(p.x, p.y, r, 0, 6.3); g.fill(); } else if (p.k === 'flash' && p.big) { const rg = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, 20); rg.addColorStop(0, `rgba(255,230,160,${0.7 * (1 - k)})`); rg.addColorStop(1, 'rgba(255,150,40,0)'); g.fillStyle = rg; g.beginPath(); g.arc(p.x, p.y, 20, 0, 6.3); g.fill(); } });
  g.globalCompositeOperation = 'source-over';
}
function bvPost(g, V, b) {            // tras restaurar la cámara: viñeta + tinte de la hora del día
  const W = BV_W, H = BV_H, tint = [[255, 170, 90, 0.085], [0, 0, 0, 0], [255, 120, 70, 0.1], [120, 150, 200, 0.07]][b.id % 4];
  if (tint[3]) { g.fillStyle = `rgba(${tint[0]},${tint[1]},${tint[2]},${tint[3]})`; g.fillRect(0, 34, W, H - 34); }
  const vg = g.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, W * 0.62); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.34)'); g.fillStyle = vg; g.fillRect(0, 0, W, H);
}
