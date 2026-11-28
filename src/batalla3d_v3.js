/* ===== batalla3d_v3.js — integra los módulos de Claude Design en la batalla 3D =====
   · Pueblos con plano (pueblos3d.js): sustituyen a las casas-caja; sus colisores entran en S.cov (las tropas ya no atraviesan las casas),
     sus coberturas y aspilleras se guardan en S.vill para la IA de los soldados.
   · Animaciones de cobertura (animaciones_cobertura.js): se registran en Troops3D al cargar (antes de crear el TroopShared). */
const B3V3 = {bioma: {1: 'centroeuropeo', 2: 'ingles', 3: 'mediterraneo', 4: 'mediterraneo', 5: 'norte', 6: 'ruso', 7: 'centroeuropeo', 8: 'norte'}, on: true};
try { if (window.animacionesCobertura && window.Troops3D) animacionesCobertura.registrar(Troops3D); } catch (e) { console.warn('animaciones de cobertura', e); }
// modelos y animaciones de Claude Design (infantería, caballería, artillería y apoyo): se registran antes de crear ningún TroopShared (la textura de huesos se hornea una vez)
const B3_REG = (() => { const t0 = performance.now(); try { if (window.apoyo3d && window.Troops3D) { const r = apoyo3d.registrar(Troops3D); return {ok: true, ms: Math.round(performance.now() - t0), r}; } } catch (e) { console.warn('registro de tropas 3D', e); return {ok: false, err: String(e)}; } return {ok: false}; })();

function b3V3Obs(S, c) {          // colisor de pueblos3d → obstáculo de S.cov
  const base = {yaw: 0, gy: 0, cs: 1, sn: 0, occ: 0, pass: false, soft: 0, nocov: false, vil: true};
  if (c.tipo === 'caja') { const h = c.alto, cs = Math.cos(c.rot), sn = -Math.sin(c.rot), gy = b3H(S.tf, c.centro[0], c.centro[1]); return Object.assign(base, {x: c.centro[0], z: c.centro[1], hw: c.ancho / 2, hd: c.fondo / 2, h, kind: 'muro', cs, sn, gy}); }
  if (c.tipo === 'segmento') { const mx = (c.a[0] + c.b[0]) / 2, mz = (c.a[1] + c.b[1]) / 2, L = Math.hypot(c.b[0] - c.a[0], c.b[1] - c.a[1]), th = Math.atan2(c.b[1] - c.a[1], c.b[0] - c.a[0]);
    return Object.assign(base, {x: mx, z: mz, hw: L / 2, hd: Math.max(0.25, c.grosor / 2), h: c.alto, kind: c.blando ? 'valla' : 'muro', cs: Math.cos(th), sn: Math.sin(th), yaw: th, gy: b3H(S.tf, mx, mz), soft: c.blando ? 1 : 0}); }
  if (c.tipo === 'circulo') return Object.assign(base, {x: c.centro[0], z: c.centro[1], hw: c.radio, hd: c.radio, h: c.alto, kind: 'muro', gy: b3H(S.tf, c.centro[0], c.centro[1])});
  return null;
}
function b3V3Villages(S, b) {
  const tf = S.tf; S.vill = {obs: [], cover: [], loop: [], groups: []}; if (!B3V3.on || !window.pueblos3d || !(tf.villages || []).length) return;
  const era = t3Era(), bio = B3V3.bioma[MAP.provs[b.prov].biome] || 'centroeuropeo', T = {heightAt: (x, z) => b3H(tf, x, z)};
  tf.villages.forEach((v, vi) => {
    try {
      const seed = (S.seed || 1) * 31 + vi * 17 + 5, plan = pueblos3d.planoPueblo(seed, bio, era, {centro: [v.x, v.y], tamano: v.big ? 'pueblo' : 'aldea'}), P = pueblos3d.buildVillage(seed, bio, era, T, {plan});
      S.scene.add(P.grupo); S.vill.groups.push(P); v._plan = plan;
      P.colliders.forEach(c => { const o = b3V3Obs(S, c); if (o) S.vill.obs.push(o); }); S.vill.cover.push(...P.cover); S.vill.loop.push(...P.loopholes);
    } catch (e) { console.warn('pueblo 3D', e); }
  });
}
function b3V3Sync(S) {            // mete los obstáculos de los pueblos en la rejilla de cobertura (una vez)
  const C = S.cov; if (!C || C.vilSync || !S.vill) return; C.vilSync = 1;
  C.list = C.list.filter(o => !o.vil); S.vill.obs.forEach(o => C.list.push(o)); (S.vegObs || []).forEach(o => C.list.push(o));
  const grid = new Map(), CS = C.CS; C.list.forEach((o, i) => { const r = Math.max(o.hw, o.hd) + 1; for (let cx = Math.floor((o.x - r) / CS); cx <= Math.floor((o.x + r) / CS); cx++) for (let cz = Math.floor((o.z - r) / CS); cz <= Math.floor((o.z + r) / CS); cz++) { const k = cx * 1000 + cz; (grid.get(k) || grid.set(k, []).get(k)).push(i); } });
  C.grid = grid;
}
/* ===== vegetación (vegetacion3d.js): hierba, arbustos, setos, rocas y troncos; los árboles siguen siendo los del bosque pintado (se queman) ===== */
function b3V3Veg(S, b) {
  const tf = S.tf; S.vegObs = []; if (!window.vegetacion3d) return;
  const bn = MAP.provs[b.prov].biome, bioma = bn === 3 ? 'mediterraneo' : bn === 8 ? 'nevado' : (bn === 5 || bn === 6) ? 'boreal' : 'templado', mo = G.date.m || 6, est = (mo === 12 || mo <= 2) ? 'invierno' : (mo >= 9 && mo <= 11) ? 'otono' : 'verano';
  const ell = (tf.lakes || []).concat(tf.marsh || [], tf.cliffs || []);
  const excluir = (x, z) => { for (const v of tf.villages || []) if (Math.hypot(x - v.x, z - v.y) < (v.big ? 150 : 100)) return true;
    for (const e of ell) if (Math.hypot(x - e.x, z - e.y) < Math.max(e.rx || 20, e.ry || 20) + 6) return true;
    if (tf.river && typeof tacRiverX === 'function' && Math.abs(x - tacRiverX(tf, z)) < (tf.river.w || 14) + 10) return true;
    for (const f of b.forts || []) if (Math.abs(x - f.x) < f.w / 2 + 25 && Math.abs(z - f.y) < f.h / 2 + 25) return true; return false; };
  const V3 = vegetacion3d.crearVegetacion({semilla: (S.seed || 1) & 4095, bioma, estacion: est, area: [0, 0, BV_W, BV_H], alturaFn: (x, z) => b3H(tf, x, z), excluir, arboles: 0, rocas: R.lowEnd ? 40 : 80, arbustos: R.lowEnd ? 90 : 200, troncos: 18, renderer: R.renderer});
  S.veg = V3; S.scene.add(V3.grupo);
  V3.objetos.forEach(o => { if (o.tipo === 'roca') S.vegObs.push({x: o.pos[0], z: o.pos[2], yaw: 0, hw: o.radio, hd: o.radio, h: o.alto, kind: 'piedra', gy: o.pos[1], cs: 1, sn: 0, occ: 0, pass: false, soft: 0, nocov: false, vil: true});
    else if (o.tipo === 'tronco') { const cs = Math.cos(o.rot || 0), sn = Math.sin(o.rot || 0); S.vegObs.push({x: o.pos[0], z: o.pos[2], yaw: o.rot || 0, hw: (o.largo || 3) / 2, hd: Math.max(0.4, o.radio * 0.4), h: o.alto, kind: 'tronco', gy: o.pos[1], cs, sn, occ: 0, pass: true, soft: 0, nocov: false, vil: true}); } });
}
const _b3BuildV3 = b3Build;
b3Build = function (V, b) { const S = _b3BuildV3(V, b); try { b3V3Villages(S, b); } catch (e) { console.warn('b3V3', e); } try { b3V3Veg(S, b); } catch (e) { console.warn('b3V3 veg', e); } return S; };
const _covEnsureV3 = covEnsure;
covEnsure = function (S) { const had = !!S.cov, C = _covEnsureV3(S); if (!had || !C.vilSync) b3V3Sync(S); return C; };
const _b3FortsV3 = b3Forts;
b3Forts = function (S, b) { _b3FortsV3(S, b); if (S.vill) S.vill.groups.forEach(P => P.grupo.update && P.grupo.update(S.cam)); if (S.veg) S.veg.actualizar(S.cam, performance.now() / 1000); };

/* ===== P1: salto hasta el contacto =====
   Al entrar en la vista de soldado, la simulación del campo (con sus órdenes, formaciones y moral) avanza sola hasta que el bloque del soldado
   está a unos 130 m del enemigo más cercano. El mando 2D no se rompe: son los mismos bloques con las mismas órdenes, solo avanzados en el tiempo.
   Si las líneas no se acercan (defensa/espera), el soldado se une a la unidad propia que esté más cerca del enemigo. */
const B3_CONTACTO = 220;                                       // u (≈ 130 m): al alcance del fuego de fusilería
function b3V3Dist(V, blk) {
  let d = 1e9; V.blocks.forEach(k => { if (k.side === blk.side || k.mode === 'rout' || !k.figs.some(f => f.alive)) return; d = Math.min(d, Math.hypot(k.x - blk.x, k.y - blk.y)); }); return d;
}
function b3V3Step(V, b, dt) {
  V.t += dt; V.tf = battleTerrain(b); const lines = {A: bvLine(V, b, 'A'), B: bvLine(V, b, 'B')}, all = [...V.blocks.values()];
  bvRelief(V, b, dt); if (typeof bvCorpsUpdate === 'function') bvCorpsUpdate(V);
  all.forEach(blk => bvStepBlock(V, b, blk, dt * (typeof bvSpeedMul === 'function' ? bvSpeedMul(V, b, blk) : 1), lines, all)); bvSeparate(all, dt); if (typeof bvGround === 'function') bvGround(V, b, all, dt);
  if (typeof tacThink === 'function') tacThink(V, b, all, dt); if (typeof tacMorale === 'function') tacMorale(V, b, all, dt);
  all.forEach(blk => bvStepFigs(V, b, blk, dt)); V.ghosts.forEach(blk => bvStepFigs(V, b, blk, dt, true)); V.ghosts = V.ghosts.filter(blk => blk.figs.some(f => f.alive || f.dying > 0));
  if (!b.ended) all.forEach(blk => bvFire(V, b, blk, dt, all));
  V.parts = V.parts.filter(p => (p.age += dt) < p.life); V.corpses.forEach(c => c.age += dt); all.forEach(blk => { blk.figs = blk.figs.filter(f => !f.gone && (f.alive || f.dying > 0 || f.flee > 0)); });
}
function b3V3Skip(V, b, blk, maxS) {
  if (!blk || b.ended || b.prep || V.over) return 0; let t = 0; const dt = 0.12;
  while (t < maxS && b3V3Dist(V, blk) > B3_CONTACTO) { b3V3Step(V, b, dt); t += dt; if (b.ended) break; }
  V.last = performance.now(); return t;
}
const _soldStartV3 = soldStart;
soldStart = function () {
  const V = R.bviz, b = V && G.battles.find(x => x.id === V.id);
  if (V && b && B3.active && B3.S && !SOLD.on && !V._skipDone) {
    const blk = soldPick(V), d0 = blk ? b3V3Dist(V, blk) : 0;
    if (blk && d0 > B3_CONTACTO + 40) {
      const t = b3V3Skip(V, b, blk, 90); V._skipDone = 1; let msg = t > 1 ? `Marcha hasta el contacto: ${Math.round(t)} s de campo.` : '';
      if (b3V3Dist(V, blk) > B3_CONTACTO + 40) {
        const mine = soldBlocks(V).filter(k => k.tag === G.player), list = (mine.length ? mine : soldBlocks(V)).filter(k => k.type !== 'cav' && k.type !== 'art');
        const best = list.sort((p, q) => b3V3Dist(V, p) - b3V3Dist(V, q))[0];
        if (best && b3V3Dist(V, best) < b3V3Dist(V, blk) - 30) { V.sel = best; msg = 'Tu unidad no está en contacto: te unes a la que combate en primera línea.'; }
      }
      if (msg) toast('🥁', msg);
    }
  }
  return _soldStartV3();
};
ACT.soldier = () => { if (SOLD.on) soldStop(); else soldStart(); };

/* ===== pantalla completa =====
   El lienzo del campo (#bmap) pasa a pantalla completa con la Fullscreen API (la imagen se escala a la pantalla conservando la proporción).
   Botón en la barra de la cámara y tecla F10 (la tecla Esc la gestiona el navegador). En iOS Safari no existe esta API para elementos. */
(function () {
  const st = document.createElement('style');
  st.textContent = '#bmap:fullscreen{width:100vw!important;height:100vh!important;object-fit:contain;background:#000;cursor:crosshair}#bmap:-webkit-full-screen{width:100vw!important;height:100vh!important;object-fit:contain;background:#000}';
  document.head.appendChild(st);
})();
function b3V3FS() {
  const cv = document.getElementById('bmap'); if (!cv) return;
  const fs = document.fullscreenElement || document.webkitFullscreenElement;
  try { if (fs) (document.exitFullscreen || document.webkitExitFullscreen).call(document); else if (cv.requestFullscreen || cv.webkitRequestFullscreen) (cv.requestFullscreen || cv.webkitRequestFullscreen).call(cv); else toast('⛶', 'Este navegador no permite pantalla completa para el campo.'); } catch (e) { toast('⛶', 'No se pudo activar la pantalla completa.'); }
}
ACT.bvfs = b3V3FS;
setInterval(() => { const bar = document.getElementById('bt-cam'); if (bar && !bar.querySelector('[data-act=bvfs]')) { const b = document.createElement('button'); b.dataset.act = 'bvfs'; b.dataset.tip = 'Pantalla completa (F10)'; b.textContent = '⛶ Pantalla completa'; bar.appendChild(b); } }, 700);
document.addEventListener('keydown', e => { if (e.key === 'F10' && document.getElementById('bmap')) { e.preventDefault(); b3V3FS(); } });

/* ===== artillería real (proyectiles3d.js) =====
   Los disparos de la artillería del campo (partículas 'shell' del visor 2D) se lanzan también como balas redondas reales en el 3D: vuelan, botan
   y matan a los soldados individuales (NPC) que cruzan. Las bajas de los bloques 2D siguen calculándose en la simulación del campo. */
const B3_RANGO = [[588, 0.005], [826, 0.01], [1350, 0.02], [1888, 0.03], [2916, 0.05]];   // alcance al primer impacto (u) → elevación (rad), calibrado con proyectiles3d
function b3V3Pitch(R, dy) { if (R <= B3_RANGO[0][0]) return -Math.atan2(dy + 0.5, R) * 0.95; for (let i = 1; i < B3_RANGO.length; i++) if (R <= B3_RANGO[i][0]) { const [r0, t0] = B3_RANGO[i - 1], [r1, t1] = B3_RANGO[i]; return t0 + (t1 - t0) * (R - r0) / (r1 - r0); } return 0.05; }
function b3V3Proj(S) {
  if (S.proj || !window.proyectiles3d) return S.proj;
  S.rej = new proyectiles3d.RejillaSoldados(6);
  S.proj = proyectiles3d.crearProyectiles(S.scene, {alturaFn: (x, z) => b3H(S.tf, x, z), rejilla: S.rej, semilla: (S.seed || 1) & 1023, viento: [0.6, 0, 0.2],
    alAlcanzar: h => { try { const p = SR2.all.get(h.id); if (p && !p.dead) srKillNPC(S, R.bviz, h.id, p, h.pos[0], h.pos[2], true); } catch (e) { } }});
  S.projT = performance.now(); return S.proj;
}
function b3V3ProjStep(S) {
  const P = S.proj; if (!P) return; const now = performance.now(), dt = Math.min(0.05, (now - (S.projT || now)) / 1000) * (R.bviz && R.bviz.ts !== undefined ? R.bviz.ts : 1); S.projT = now;
  S.rej.s.forEach((o, id) => { if (!SR2.all.has(id)) S.rej.quitar(id); });
  SR2.all.forEach((p, id) => { if (p.dead) { S.rej.quitar(id); return; } S.rej.insertar(id, p.x, p.z, b3H(S.tf, p.x, p.z), 1.75 / 0.6, 0.28 / 0.6); });
  if (dt > 0) P.actualizar(dt);
}
const _bvPartV3 = bvPart;
bvPart = function (V, p) {
  _bvPartV3(V, p);
  try { if (p.k === 'shell' && B3.active && B3.S && B3.S.bid === V.id && typeof p.x2 === 'number' && window.proyectiles3d) {
    const S = B3.S, P = b3V3Proj(S); if (!P) return; const dx = p.x2 - p.x, dz = p.y2 - p.y, R0 = Math.hypot(dx, dz) || 1, y0 = b3H(S.tf, p.x, p.y) + 2.2, th = b3V3Pitch(R0, y0 - b3H(S.tf, p.x2, p.y2));
    P.disparar('bala_canon', 'A', [p.x, y0, p.y], [dx / R0 * Math.cos(th), Math.sin(th), dz / R0 * Math.cos(th)], {dispersion: 0.15});
  } } catch (e) { }
};
const _b3FortsV3b = b3Forts;
b3Forts = function (S, b) { _b3FortsV3b(S, b); if (S.proj) b3V3ProjStep(S); };
const _b3DisposeV3 = b3Dispose;
b3Dispose = function (S) { try { if (S && S.proj && S.proj.liberar) S.proj.liberar(); } catch (e) { } return _b3DisposeV3(S); };

/* ===== minimapa del campo (esquina superior derecha; tecla M lo oculta) =====
   Terreno (agua, bosques, pueblos, obras), bloques de ambos bandos (los ocultos por la niebla no se dibujan), tu unidad resaltada y tu posición con su cono de visión. */
const B3MM = {on: true, w: 300, h: 132};
document.addEventListener('keydown', e => { if ((e.key === 'm' || e.key === 'M') && B3.active && document.getElementById('bmap') && !e.ctrlKey && !e.metaKey && !/INPUT|TEXTAREA/.test((e.target || {}).tagName || '')) { B3MM.on = !B3MM.on; } });
function b3V3Minimap(V, b, g, S, all) {
  if (!B3MM.on || !S) return; const w = B3MM.w, h = B3MM.h, x0 = BV_W - w - 14, y0 = 168, tf = S.tf, sx = w / BV_W, sy = h / BV_H, X = x => x0 + x * sx, Y = z => y0 + z * sy;
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 0.93; g.fillStyle = '#1b1710'; g.fillRect(x0 - 5, y0 - 5, w + 10, h + 10);
  g.beginPath(); g.rect(x0, y0, w, h); g.clip(); g.fillStyle = '#6d7a45'; g.fillRect(x0, y0, w, h);
  (tf.hills || []).forEach(e => { g.fillStyle = 'rgba(120,100,60,.35)'; g.beginPath(); g.ellipse(X(e.x), Y(e.y), (e.rx || 40) * sx, (e.ry || 40) * sy, e.rot || 0, 0, 6.3); g.fill(); });
  (tf.fields || []).forEach(f => { if (f.x !== undefined) { g.fillStyle = 'rgba(190,170,90,.4)'; g.fillRect(X(f.x - (f.w || 30) / 2), Y(f.y - (f.h || 30) / 2), (f.w || 30) * sx, (f.h || 30) * sy); } });
  (tf.forests || []).forEach(f => { g.fillStyle = f.burnt ? '#2a2420' : '#2f4a2a'; g.beginPath(); g.ellipse(X(f.x), Y(f.y), f.r * sx, f.r * sy, 0, 0, 6.3); g.fill(); });
  (tf.lakes || []).concat(tf.marsh || []).forEach(e => { g.fillStyle = '#4b7ea0'; g.beginPath(); g.ellipse(X(e.x), Y(e.y), (e.rx || 20) * sx, (e.ry || 20) * sy, e.rot || 0, 0, 6.3); g.fill(); });
  if (tf.river && typeof tacRiverX === 'function') { g.strokeStyle = '#4b7ea0'; g.lineWidth = Math.max(2, (tf.river.w || 12) * sx); g.beginPath(); for (let z = 0; z <= BV_H; z += 20) { const px = X(tacRiverX(tf, z)), py = Y(z); z ? g.lineTo(px, py) : g.moveTo(px, py); } g.stroke(); }
  (tf.villages || []).forEach(v => { g.fillStyle = '#b9ab8c'; g.fillRect(X(v.x) - 3, Y(v.y) - 3, 6, 6); });
  (b.forts || []).forEach(f => { g.strokeStyle = f.side === 'A' ? '#e06a5a' : '#6aa0e0'; g.lineWidth = 1.5; g.strokeRect(X(f.x - f.w / 2), Y(f.y - f.h / 2), f.w * sx, f.h * sy); });
  const sel = SOLD && SOLD.on ? SOLD.bid : -1;
  all.forEach(k => { if (!k.figs.some(f => f.alive)) return; if (typeof bvSeen === 'function' && !bvSeen(V, b, k)) return; const mine = k.tag === G.player, col = k.side === 'A' ? '#d8584a' : '#4a86d8', bw = Math.max(5, (k.wid || 30) * sx), bh = Math.max(3, (k.dep || 20) * sy);
    g.save(); g.translate(X(k.x), Y(k.y)); g.rotate(-(k.hd || 0) + 0); g.fillStyle = col; g.globalAlpha = k.mode === 'rout' ? 0.45 : 0.95; g.fillRect(-bh / 2, -bw / 2, bh, bw); g.restore(); g.globalAlpha = 0.93;
    if (k.type === 'art') { g.fillStyle = '#111'; g.beginPath(); g.arc(X(k.x), Y(k.y), 1.8, 0, 6.3); g.fill(); } if (k.type === 'cav') { g.strokeStyle = '#fff'; g.lineWidth = 1; g.beginPath(); g.moveTo(X(k.x) - 3, Y(k.y) + 2); g.lineTo(X(k.x) + 3, Y(k.y) - 2); g.stroke(); }
    if (k.id === sel) { g.strokeStyle = '#ffe680'; g.lineWidth = 2; g.strokeRect(X(k.x) - 7, Y(k.y) - 7, 14, 14); } });
  const c = SOLD && SOLD.ctrl, pos = c ? {x: c.x, z: c.z, yaw: c.cyaw} : (B3.cam ? {x: B3.cam.tx, z: B3.cam.tz, yaw: null} : null);
  if (pos) { const px = X(pos.x), py = Y(pos.z); g.fillStyle = '#fff'; g.strokeStyle = '#000'; g.lineWidth = 1; g.beginPath(); g.arc(px, py, 3.2, 0, 6.3); g.fill(); g.stroke();
    if (pos.yaw !== null) { g.fillStyle = 'rgba(255,255,255,.28)'; g.beginPath(); g.moveTo(px, py); g.arc(px, py, 26, pos.yaw - 0.55, pos.yaw + 0.55); g.closePath(); g.fill(); } }
  g.restore(); g.save(); g.globalAlpha = 0.95; g.strokeStyle = '#c8a860'; g.lineWidth = 2; g.strokeRect(x0 - 5, y0 - 5, w + 10, h + 10); g.fillStyle = '#e8d8a8'; g.font = '600 12px sans-serif'; g.fillText('MAPA · M', x0, y0 - 9); g.restore();
}
const _b3FrameMM = b3Frame;
b3Frame = function (V, b, g, lines, all) { const r = _b3FrameMM(V, b, g, lines, all); try { b3V3Minimap(V, b, g, B3.S, all); } catch (e) { if (!B3MM.err) { B3MM.err = 1; console.warn('minimapa', e); } } return r; };

/* ===== rueda de órdenes al pelotón (Q) =====
   Con el control del soldado, Q abre una rueda de 8 órdenes (teclas 1–8). Se aplican a tu bloque y cada soldado las ejecuta con su propia IA
   (npc_combate.js, variable «po»): qué hace cada uno, cuándo dispara, a dónde corre y dónde se cubre sigue siendo decisión suya dentro de la orden. */
const B3_ORD = [
  {k: 'avanzar', n: 'Avanzar', ic: '⬆️', say: '¡Pelotón, adelante!', dur: 45}, {k: 'mantener', n: 'Mantener', ic: '🛡️', say: '¡Mantened la posición!', dur: 90},
  {k: 'cubrirse', n: 'Cubrirse', ic: '🧱', say: '¡A cubierto!', dur: 40}, {k: 'fuego', n: 'Fuego a voluntad', ic: '🔫', say: '¡Fuego a discreción!', dur: 60},
  {k: 'alto_fuego', n: 'Alto el fuego', ic: '✋', say: '¡Alto el fuego!', dur: 25}, {k: 'bayoneta', n: 'Bayoneta', ic: '🗡️', say: '¡Calad bayonetas! ¡Al asalto!', dur: 30},
  {k: 'seguidme', n: 'Seguidme', ic: '🚩', say: '¡Seguidme!', dur: 60}, {k: 'reagrupar', n: 'Reagrupar', ic: '🔁', say: '¡Reagrupaos!', dur: 20}];
const B3W = {open: false, last: null};
function b3V3Order(i) {
  const o = B3_ORD[i]; if (!o || !SOLD.ctrl) return; const V = R.bviz, blk = soldBlock(V); if (!blk) return;
  blk._po = {k: o.k, t0: performance.now() / 1000, dur: o.dur}; B3W.last = o; B3W.open = false;
  try { srBark(blk.side, 'Tú', o.say, SOLD.ctrl.x, SOLD.ctrl.z, performance.now() / 1000); } catch (e) { }
  toast(o.ic, `Orden al pelotón: ${o.n}.`);
}
document.addEventListener('keydown', e => {
  if (!SOLD.on || !SOLD.ctrl || SOLD.ctrl.dead || /INPUT|TEXTAREA|SELECT/.test((e.target || {}).tagName || '')) return;
  const k = e.key.toLowerCase();
  if (k === 'q') { B3W.open = !B3W.open; e.stopImmediatePropagation(); e.preventDefault(); return; }
  if (B3W.open && /^[1-8]$/.test(k)) { b3V3Order(+k - 1); e.stopImmediatePropagation(); e.preventDefault(); return; }
  if (B3W.open && k === 'escape') { B3W.open = false; e.stopImmediatePropagation(); }
}, true);
function b3V3Wheel(g) {
  const c = SOLD.ctrl; if (!SOLD.on || !c) return; const blk = soldBlock(R.bviz), po = blk && blk._po && performance.now() / 1000 - blk._po.t0 < blk._po.dur ? B3_ORD.find(o => o.k === blk._po.k) : null;
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
  if (po) { g.fillStyle = 'rgba(14,20,28,.82)'; g.strokeStyle = '#c8a860'; g.lineWidth = 1.5; g.fillRect(14, BV_H - 118, 330, 40); g.strokeRect(14, BV_H - 118, 330, 40); g.fillStyle = '#e8d8a8'; g.font = '600 20px sans-serif'; g.fillText(`${po.ic} Orden: ${po.n}`, 28, BV_H - 91); }
  if (B3W.open) {
    const cx = BV_W / 2, cy = BV_H / 2, r = 150; g.fillStyle = 'rgba(8,12,18,.55)'; g.fillRect(0, 0, BV_W, BV_H);
    B3_ORD.forEach((o, i) => { const a = -Math.PI / 2 + i * Math.PI / 4, x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r, cur = po && po.k === o.k;
      g.fillStyle = cur ? 'rgba(120,92,36,.95)' : 'rgba(20,32,48,.94)'; g.strokeStyle = cur ? '#f3d98c' : '#8a6c2c'; g.lineWidth = 2; g.beginPath(); g.arc(x, y, 52, 0, 6.3); g.fill(); g.stroke();
      g.fillStyle = '#f2e6bf'; g.textAlign = 'center'; g.font = '28px sans-serif'; g.fillText(o.ic, x, y - 2); g.font = '600 13px sans-serif'; g.fillText(o.n, x, y + 20); g.fillStyle = '#c8a860'; g.font = '700 14px sans-serif'; g.fillText(String(i + 1), x - 38, y - 30); });
    g.fillStyle = '#f2e6bf'; g.textAlign = 'center'; g.font = '700 20px serif'; g.fillText('ÓRDENES AL PELOTÓN', cx, cy - 4); g.font = '14px sans-serif'; g.fillStyle = '#c8b890'; g.fillText('Pulsa 1–8 · Q cierra', cx, cy + 18);
  }
  g.restore();
}
const _b3FrameW = b3Frame;
b3Frame = function (V, b, g, lines, all) { const r = _b3FrameW(V, b, g, lines, all); try { b3V3Wheel(g); } catch (e) { } return r; };

/* ===== heridas y espera =====
   Al caer, el soldado no muere de golpe: queda herido en el suelo unos 10 s (se arrastra, no puede disparar). Si un compañero llega a menos de 4 m
   durante 3 s se pone a salvo (sale con el 30 % de salud). Si no, muere y reapareces en otro soldado del pelotón. */
const _ctrlStepW = ctrlStep;
ctrlStep = function (S, V, blk, dt) {
  const c = SOLD.ctrl; if (c) {
    const now = performance.now();
    if (c.dead && !c.wndUsed && !c.wnd) { c.wndUsed = true; c.dead = false; c.dieNow = false; c.hp = 0.1; c.bleed = 0; c.wnd = {t0: now, res: 0}; c.prone = true; c.kneel = false; c.clip = 'herido_grave'; toast('🩸', 'Estás herido y no puedes disparar. Arrástrate (W) hacia tus camaradas: si te alcanzan, te salvarán.'); }
    if (c.wnd) {
      c.prone = true; c.kneel = false; c.run = false; CK.fire = 0; CK.ads = 0; CK.shift = 0; c.hp = Math.max(0.05, Math.min(c.hp, 0.12)); c.bleed = 0;
      const mates = [...SR2.all.values()].filter(p => p.side === blk.side && Math.hypot(p.x - c.x, p.z - c.z) < 4).length, dtw = Math.min(0.1, (now - (c.wnd.lt || now)) / 1000); c.wnd.lt = now;
      c.wnd.res = mates ? c.wnd.res + dtw : Math.max(0, c.wnd.res - dtw * 0.5);
      if (c.wnd.res >= 3) { c.wnd = null; c.hp = 0.3; toast('🤝', 'Un camarada te ha puesto a salvo. Quedas con el 30 % de salud.'); }
      else if (now - c.wnd.t0 > 10000) { c.wnd = null; c.dead = true; c.deadAt = now - 1800; toast('💀', 'Nadie llegó a tiempo.'); }
    }
  }
  return _ctrlStepW(S, V, blk, dt);
};
/* ===== el salto al contacto llega hasta el fuego: una vez a distancia de combate sigue unos segundos hasta que la unidad abre fuego ===== */
const _b3V3SkipW = b3V3Skip;
b3V3Skip = function (V, b, blk, maxS) {
  let t = _b3V3SkipW(V, b, blk, maxS);
  if (blk && !b.ended && !b.prep && b3V3Dist(V, blk) <= B3_CONTACTO + 40) { let extra = 0; while (extra < 40 && !(blk.mode === 'fire' || blk.mode === 'melee' || blk.mode === 'skirmish')) { b3V3Step(V, b, 0.12); extra += 0.12; } t += extra; V.last = performance.now(); }
  return t;
};
