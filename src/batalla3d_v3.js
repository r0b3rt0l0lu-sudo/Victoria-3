/* ===== batalla3d_v3.js — integra los módulos de Claude Design en la batalla 3D =====
   · Pueblos con plano (pueblos3d.js): sustituyen a las casas-caja; sus colisores entran en S.cov (las tropas ya no atraviesan las casas),
     sus coberturas y aspilleras se guardan en S.vill para la IA de los soldados.
   · Animaciones de cobertura (animaciones_cobertura.js): se registran en Troops3D al cargar (antes de crear el TroopShared). */
const B3V3 = {bioma: {1: 'centroeuropeo', 2: 'ingles', 3: 'mediterraneo', 4: 'mediterraneo', 5: 'norte', 6: 'ruso', 7: 'centroeuropeo', 8: 'norte'}, on: true};
try { if (window.animacionesCobertura && window.Troops3D) animacionesCobertura.registrar(Troops3D); } catch (e) { console.warn('animaciones de cobertura', e); }

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
  C.list = C.list.filter(o => !o.vil); S.vill.obs.forEach(o => C.list.push(o));
  const grid = new Map(), CS = C.CS; C.list.forEach((o, i) => { const r = Math.max(o.hw, o.hd) + 1; for (let cx = Math.floor((o.x - r) / CS); cx <= Math.floor((o.x + r) / CS); cx++) for (let cz = Math.floor((o.z - r) / CS); cz <= Math.floor((o.z + r) / CS); cz++) { const k = cx * 1000 + cz; (grid.get(k) || grid.set(k, []).get(k)).push(i); } });
  C.grid = grid;
}
const _b3BuildV3 = b3Build;
b3Build = function (V, b) { const S = _b3BuildV3(V, b); try { b3V3Villages(S, b); } catch (e) { console.warn('b3V3', e); } return S; };
const _covEnsureV3 = covEnsure;
covEnsure = function (S) { const had = !!S.cov, C = _covEnsureV3(S); if (!had || !C.vilSync) b3V3Sync(S); return C; };
const _b3FortsV3 = b3Forts;
b3Forts = function (S, b) { _b3FortsV3(S, b); if (S.vill) S.vill.groups.forEach(P => P.grupo.update && P.grupo.update(S.cam)); };

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
