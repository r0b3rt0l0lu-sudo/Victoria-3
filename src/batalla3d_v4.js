/* ===== batalla3d_v4.js — integra las fases 5 y 6 de Claude Design (escenario3d.js y efectos_batalla3d.js) en la batalla 3D =====
   Se carga DESPUÉS de batalla3d_v3.js y usa el mismo patrón de envoltorios (b3Build, b3Frame, b3Dispose). Si los módulos no están cargados,
   no hace nada. Interruptores en B3V4 (efectos, escenario, cielo).
   · Partículas del simulador (V.parts) → efectos_batalla3d: 'smoke' pasa a humo de pólvora con disipación real (y la transmitancia que
     usa proyectiles3d para la IA), 'boom' a explosión con onda, terrones y columna de humo, 'dust' a polvo. Los fogonazos, chispas, granadas
     en vuelo, gas y salpicaduras siguen con los puntos de batalla3d.js.
   · Lluvia del simulador (V.rain) → lluvia de efectos (la de líneas antigua se oculta); el humo acumulado acerca la niebla de la escena.
   · Pueblos de pueblos3d: incendios en los edificios en ruinas y humo de chimeneas.
   · proyectiles3d: su humo pasa a ser el de efectos; los botes dejan surco y abanico de tierra; las balas, estela.
   · Escenario (B3V4.escenario): campos de cultivo y setos alrededor de los pueblos (decorado con colisores blandos en los setos).
   El sol y el cielo siguen siendo los de batalla3d.js (B3V4.cielo = false); efectos ilumina su humo con ese sol. */
const B3V4 = {efectos: true, escenario: true, cielo: false};
function b3V4Init(S, b) {
  if (!B3V4.efectos || !window.efectos_batalla3d || S.fx) return;
  const era = typeof t3Era === 'function' ? t3Era() : 'B', H = (x, z) => b3H(S.tf, x, z);
  S.fx = efectos_batalla3d.crearEfectos(S.scene, {alturaFn: H, terreno: null, cielo: B3V4.cielo, gestionarNiebla: false, sol: S.sun, hemi: S.hemi, ambiente: S.amb, era, semilla: (S.seed || 1) & 1023,
    calidad: R.lowEnd ? 'baja' : 'alta', viento: [0.6 / 0.6, 0.2 / 0.6], superficieFn: S.bio === 5 || S.bio === 8 ? () => 'nieve' : null});
  (S.vill && S.vill.groups || []).forEach(P => { try { S.fx.fuego.desdePueblo(P); S.fx.chimeneas(P); } catch (e) { } });
  S.fxT = performance.now(); S.fxFog = S.scene.fog ? [S.scene.fog.near, S.scene.fog.far] : null;
  [S.smoke, S.dust, S.boom].forEach(m => { if (m) m.visible = false; });
}
// campos y setos alrededor de cada pueblo, fuera de bosques y del casco
function b3V4Escenario(S) {
  if (!B3V4.escenario || !window.escenario3d || S.esc || !S.tf) return; const tf = S.tf, vil = tf.villages || []; if (!vil.length) return;
  const r = (i, k) => hash2(i, S.seed || 1, k), C5 = ['trigo', 'maiz', 'vinedo', 'patata', 'pradera'], cultivos = [], setos = [], est = 'verano';
  const libre = (x, z, R) => !(tf.forests || []).some(f => Math.hypot(f.x - x, f.y - z) < f.r + R) && !vil.some(v => Math.hypot(v.x - x, v.y - z) < (v.big ? 150 : 100) + R);
  vil.forEach((v, vi) => { for (let k = 0; k < 3; k++) { const a = r(vi * 10 + k, 3) * 6.283, d = (v.big ? 190 : 140) + r(vi * 10 + k, 4) * 90, x = v.x + Math.cos(a) * d, z = v.y + Math.sin(a) * d, w = 60 + r(k, vi + 5) * 50, h = 45 + r(k, vi + 6) * 35;
    if (!libre(x, z, Math.max(w, h) * 0.75)) continue; const c = Math.cos(a), s = Math.sin(a), P = [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]].map(([u, t]) => [x + u * c - t * s, z + u * s + t * c]);
    cultivos.push({puntos: P, cultivo: C5[Math.floor(r(vi * 10 + k, 7) * 5)]}); if (r(vi, k + 9) < 0.6) setos.push({puntos: [[P[0][0] - c * 4, P[0][1] - s * 4], [P[1][0] + c * 4, P[1][1] + s * 4]], huecos: 1, tipo: S.bio === 1 ? 'bocage' : 'seto'}); } });
  if (!cultivos.length) return;
  S.esc = escenario3d.crearEscenario({heightAt: (x, z) => b3H(tf, x, z)}, {semilla: (S.seed || 1) & 1023, era: typeof t3Era === 'function' ? t3Era() : 'B', estacion: est, cultivos, setos, maxInst: R.lowEnd ? 600 : 1500, sombras: !R.lowEnd});
  S.scene.add(S.esc.grupo); S.esc.colliders.forEach(c => { try { const o = b3V3Obs(S, c); if (o) S.vill.obs.push(o); } catch (e) { } }); if (S.cov) S.cov.vilSync = 0;
}
function b3V4Step(V, S) {
  if (!S || !S.fx) return; const fx = S.fx, now = performance.now(), dt = Math.min(0.1, (now - (S.fxT || now)) / 1000) * (R.bviz && R.bviz.ts !== undefined ? R.bviz.ts : 1); S.fxT = now;
  const MU = 1 / 0.6;
  for (let i = 0; i < V.parts.length; i++) { const p = V.parts[i]; if (p._fx) continue; p._fx = 1; const y0 = b3H(S.tf, p.x, p.y);
    if (p.k === 'smoke') fx.humo.emitir('polvora', p.x, y0 + 2.2, p.y, 0, 0.3 * MU, 0, 1.6);
    else if (p.k === 'dust') fx.humo.emitir('polvo', p.x, y0 + 0.6, p.y, 0, 0.2 * MU, 0, 1.2);
    else if (p.k === 'boom') fx.explosion([p.x, y0, p.y], {radio: 7, crater: 0, sinCrater: true}); }
  if (S.proj && !S.fxPaso) S.fxPaso = fx.conectarProyectiles(S.proj); if (S.fxPaso) S.fxPaso();
  const ll = Math.max(0, Math.min(1, V.rain || 0)); if (Math.abs((fx.estadoClima.lluvia || 0) - ll) > 0.02) fx.clima({lluvia: ll}); if (S.rain && ll > 0) S.rain.visible = false;
  if (dt > 0) fx.actualizar(dt, S.cam); if (S.esc) { S.esc.update(S.cam); S.esc.actualizar(now / 1000); }
  if (S.fxFog && S.scene.fog && S.scene.fog.isFog) { const k = fx.estadoClima.batalla; S.scene.fog.near = S.fxFog[0] * (1 - 0.6 * k); S.scene.fog.far = S.fxFog[1] * (1 - 0.45 * k); }
}
const _b3BuildV4 = b3Build;
b3Build = function (V, b) { const S = _b3BuildV4(V, b); try { b3V4Escenario(S); } catch (e) { console.warn('b3V4 escenario', e); } try { b3V4Init(S, b); } catch (e) { console.warn('b3V4 efectos', e); } return S; };
const _b3FrameV4 = b3Frame;
b3Frame = function (V, b, g, lines, all) { const r = _b3FrameV4(V, b, g, lines, all); try { b3V4Step(V, B3.S); } catch (e) { if (!B3V4.err) { B3V4.err = 1; console.warn('b3V4', e); } } return r; };
const _b3DisposeV4 = b3Dispose;
b3Dispose = function (S) { try { if (S && S.fx) { S.scene.remove(S.fx.grupo); S.fx.grupo.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); }); S.fx = null; } if (S && S.esc) { S.scene.remove(S.esc.grupo); S.esc = null; } } catch (e) { } return _b3DisposeV4(S); };
