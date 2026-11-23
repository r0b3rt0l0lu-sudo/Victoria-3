/* ===== MODO SOLDADO: COMBATE ENTRE SOLDADOS, SUPRESIÓN, VOCES, ARTILLERÍA Y AMETRALLADORAS =====
   Antes los soldados cercanos solo disparaban «al bulto» (al centro del regimiento enemigo o al jugador): nadie caía por su fuego. Ahora:
   · REGISTRO de todos los soldados cercanos (de ambos bandos) en cada fotograma; cada disparo busca un OBJETIVO REAL: el soldado enemigo más cercano dentro de un cono de ±37º,
     a menos de 90-180 u según la época, con línea de tiro (cobertura y terreno) libre. Probabilidad de impacto por disparo 0,6-2,8 % (distancia, postura del blanco, movimiento,
     supresión del tirador y precisión de la época); el 55 % de los impactos mata y el resto hiere. Los heridos se arrastran 8 s y luego mueren o quedan tendidos.
   · SUPRESIÓN: cada disparo y cada caída deja una zona de fuego que obliga a ponerse a cubierto o tumbarse a los soldados cercanos del bando contrario (también a los aliados del
     que cae). Los soldados de ambos bandos se cubren, se tumban, hacen fuego y movimiento.
   · VOCES (ladridos): «¡Granada!», «¡A cubierto!», «¡Médico!», «¡Retirada!», «¡A la bayoneta!»… como líneas de radio en pantalla, que dan la sensación de escuadra coordinada
     (en F.E.A.R. y Killzone la coordinación se percibía sobre todo por estas voces y los saltos de cobertura en cobertura).
   · SUBOFICIALES (7 %): se quedan tras la línea, dan órdenes y señales.
   · ARTILLERÍA: los cañones en fuego del campo hacen caer proyectiles que explotan cerca del jugador y los soldados (silbido, fogonazo, humo, onda: matan a < 4 u, hieren a < 8 u, obligan a tumbarse a < 16 u).
   · AMETRALLADORAS (época E): ráfagas de 8 disparos sobre el soldado enemigo más cercano; sus zonas de supresión son anchas. */
const SR2 = {all: new Map(), allNew: new Map(), sup: [], barks: [], barkAt: -9, barkBy: {}, shells: [], shellT: 0, kills: 0, shots: 0, hits: 0, cur: null, lt: 0, mg: {}};
const SR_RANGE = {A: 110, B: 130, C: 170, D: 180, E: 190}, SR_ACC = {A: 0.6, B: 0.9, C: 1, D: 1.05, E: 1.1};
const srCam = () => (B3.S && B3.S.cam ? B3.S.cam.position : {x: 0, z: 0, y: 0});
function srBark(side, who, text, x, z, tU) {
  if (tU - SR2.barkAt < 0.9 || tU - (SR2.barkBy[text] || -9) < 2.2) return; const ca = srCam(); if (Math.hypot(x - ca.x, z - ca.z) > 130) return;
  SR2.barkAt = tU; SR2.barkBy[text] = tU; SR2.barks.push({t: tU, side, who, text}); if (SR2.barks.length > 6) SR2.barks.shift();
}
// ---- bajas de soldados no jugadores ----
function srKillNPC(S, V, key, p, fx, fz, lethal, tag) {
  V.kmap = V.kmap || {}; V.klist = V.klist || []; if (V.kmap[key]) return; if (V.klist.length > 500) { const old = V.klist.shift(); delete V.kmap[old.key]; }
  const tU = performance.now() / 1000, era = t3Era(), dx = p.x - fx, dz = p.z - fz, L = Math.hypot(dx, dz) || 1, front = (Math.sin(p.yaw) * dx + Math.cos(p.yaw) * dz) < 0, side = (Math.cos(p.yaw) * dz - Math.sin(p.yaw) * dx), r = Math.random();
  const dClip = front ? (r < 0.4 ? 'muerte_atras_pie' : r < 0.6 ? 'muerte_rodillas' : r < 0.8 ? 'muerte_muro' : 'muerte_atras_rodilla') : Math.abs(side) > 0.45 ? (side > 0 ? 'muerte_costado_de' : 'muerte_costado_iz') : (r < 0.5 ? 'muerte_adelante' : 'muerte_rodillas_adelante');
  const T3 = window.Troops3D, inf = T3 && T3.clipInfo ? T3.clipInfo('fusilero', dClip) : null, crawl = !lethal && Math.random() < 0.65 && npcHas('herido_arrastrandose');
  const e = {key, x: p.x, z: p.z, yaw: p.yaw, tag: tag || (p.blk && p.blk.tag), era, wound: !lethal, crawl, cx: dx / L, cz: dz / L, t0: tU, clip: lethal ? dClip : 'herido_grave', dClip, dur: inf && inf.dur ? inf.dur : 2, corpse: 'cuerpo_inerte_' + dClip.replace(/^muerte_/, ''), npc: true};
  V.kmap[key] = e; V.klist.push(e); SR2.kills++;
  fxFlash(p.x, b3H(S.tf, p.x, p.z) + 1.6, p.z, 0.16); bvPart(V, {k: 'dust', x: p.x, y: p.z, life: 0.7});
  const eside = p.side === 'A' ? 'B' : 'A'; SR2.sup.push({x: p.x, z: p.z, t: tU, r: 12, side: eside}); if (SR2.sup.length > 60) SR2.sup.shift();            // el compañero que cae obliga a cubrirse a los de su bando
  srBark(p.side, 'Soldado', lethal ? '¡Han abatido a uno!' : '¡Hombre herido! ¡Médico!', p.x, p.z, tU);
}
// bajas arrastrándose y cadáveres (en cualquier modo de la vista de soldado)
function srKlistStep(V, tU, dt) {
  if (!V.klist) return;
  V.klist.forEach(e => {
    if (e.wound) { const age = tU - e.t0;
      if (e.crawl && age > 1.0) { if (e.clip !== 'herido_arrastrandose') e.clipSwap = true; e.clip = 'herido_arrastrandose'; e.x += e.cx * 0.45 * dt; e.z += e.cz * 0.45 * dt; e.yaw = Math.atan2(e.cx, e.cz); }
      if (age > (e.crawl ? 8 : 3)) { e.wound = false; if (e.crawl && Math.random() < 0.35) { e.still = true; e.clip = npcHas('herido') ? 'herido' : e.corpse; e.t0 = tU; } else { e.clip = e.dClip === 'muerte_adelante' ? 'muerte_costado_iz' : e.dClip; e.t0 = tU; } } }
    else if (!e.still && tU - e.t0 > e.dur + 0.4) { e.still = true; e.clip = e.corpse; }
  });
}
// ---- objetivo real de un disparo ----
function srPickTarget(sh, era, V) {
  let best = null, bs = 1e9; const R0 = SR_RANGE[era] || 150, fx = Math.sin(sh.yaw), fz = Math.cos(sh.yaw);
  SR2.all.forEach((p, k) => { if (p.side === sh.side || (V.kmap && V.kmap[k])) return; const dx = p.x - sh.x, dz = p.z - sh.z, d = Math.hypot(dx, dz); if (d > R0 || d < 4) return; if ((dx * fx + dz * fz) / d < 0.8) return; const sc = d * (1 + Math.random() * 0.5) - (p.blk && p.blk.id === sh.tid ? 0 : 0); if (sc < bs) { bs = sc; best = {k, p, d, dx, dz}; } });
  return best;
}
function srNpcFire(S, V, s, x, z, cover, era, cur) {
  const sh = {x: x + s.ox, z: z + s.oz, yaw: s.yaw, side: cur.blk.side, tid: cur.blk.id}, tU = cur.tU; SR2.shots++;
  const tg = srPickTarget(sh, era, V); if (!tg) return;
  const gy = b3H(S.tf, sh.x, sh.z), ty = b3H(S.tf, tg.p.x, tg.p.z), eyeS = gy + (s.post === 'tumbado' ? 0.7 : cover || s.post === 'rodilla' ? 1.9 : 2.5), eyeT = ty + (tg.p.post === 'tumbado' ? 0.55 : tg.p.post === 'rodilla' || tg.p.cover ? 1.6 : 2.3);
  for (let i = 1; i <= 4; i++) fxFlash(sh.x + (tg.p.x - sh.x) * i / 5, eyeS + (eyeT - eyeS) * i / 5, sh.z + (tg.p.z - sh.z) * i / 5, 0.05);                      // trazadora
  const cb = covBlock(S, sh.x, eyeS, sh.z, tg.p.x, eyeT, tg.p.z); if (cb) { fxFlash(cb.x, cb.y, cb.z, 0.12); bvPart(V, {k: 'dust', x: cb.x, y: cb.z, life: 0.6}); return; }
  if (tg.d > 14 && srBlockLOS(S, sh.x, eyeS, sh.z, tg.p.x, eyeT, tg.p.z)) return;
  const p = clamp(0.09 - tg.d / 2800, 0.02, 0.09) * (SR_ACC[era] || 1) * (tg.p.post === 'tumbado' ? 0.4 : tg.p.post === 'rodilla' ? 0.62 : 1) * (tg.p.mv ? 0.7 : 1) * (s.pin > 0 ? 0.5 : 1) * (tg.p.sup ? 0.8 : 1);
  if (Math.random() < p) { SR2.hits++; srKillNPC(S, V, tg.k, tg.p, sh.x, sh.z, Math.random() < 0.55); }
  else { bvPart(V, {k: 'dust', x: tg.p.x + (Math.random() - 0.5) * 3, y: tg.p.z + (Math.random() - 0.5) * 3, life: 0.5}); SR2.sup.push({x: tg.p.x, z: tg.p.z, t: tU, r: 5, side: sh.side}); if (SR2.sup.length > 60) SR2.sup.shift(); }       // los fallos cercanos suprimen
}
// ---- hooks sobre b3Free y npcShot ----
const SR_ST_BARK = {to_cover: ['¡A cubierto!', 'Soldado'], prone: ['¡Al suelo!', 'Soldado'], throw: ['¡Granada!', 'Soldado'], charge: ['¡A la bayoneta!', 'Soldado'], fallback: ['¡Retirada! ¡Retirada!', 'Soldado'], crawl: ['¡Me arrastro hasta el muro!', 'Soldado'], shift: ['¡Cambio de posición!', 'Cabo']};
const _b3FreeSR2 = b3Free;
b3Free = function (blk, f, j, x, z, yaw, clip, tU, ca, h1, h2) {
  if (!SOLD.on) return null; const V = R.bviz, era = t3Era();
  if (era === 'E' && blk.type === 'inf' && blk.d && typeof t3Comp === 'function') { const comp = t3Comp(blk.d, blk.tag); if (comp) { if ((comp.mech > 3 || comp.mot > 3) && j === 0) return null; if (comp.mg && j === 1) { srMgStep(blk, f, j, x, z, tU, V); return null; } } }
  const key = blk.id + ':' + f.i + ':' + j, st0 = NPC.get(key), px = x + (st0 ? st0.ox : 0), pz = z + (st0 ? st0.oz : 0), me = SOLD._me || soldBlock(V);
  // supresión: la más fuerte del bando contrario que afecte a este soldado; el fuego del jugador solo suprime al bando contrario
  const keep = SOLD.suppress; let sm = null;
  for (let i = SR2.sup.length - 1; i >= 0; i--) { const e = SR2.sup[i]; if (tU - e.t > 0.7) continue; if (e.side === blk.side) continue; const d = Math.hypot(e.x - px, e.z - pz); if (d < e.r && (!sm || d < sm.d)) sm = {t: e.t, d, e}; }
  if (sm && st0) { if (sm.e !== st0.lastSupE) { st0.lastSupE = sm.e; if (Math.random() > 0.3 + (h2 < 0.3 ? 0.25 : 0)) sm = null; } else if (!st0.supOk) sm = null; if (sm) st0.supOk = true; else if (st0.lastSupE === (sm && sm.e)) st0.supOk = false; }
  if (sm) SOLD.suppress = {x: px, z: pz, t: sm.t}; else if (keep && me && blk.side === me.side) SOLD.suppress = null;
  SR2.cur = {blk, key, h1, h2, tU};
  const o = _b3FreeSR2(blk, f, j, x, z, yaw, clip, tU, ca, h1, h2); SR2.cur = null; SOLD.suppress = keep;
  if (!o) return o;
  const s = NPC.get(key); if (s) {
    if (s.role === undefined) s.role = h1 > 0.93 ? 'nco' : 'rifle';
    const post = s.st === 'prone' || s.st === 'crawl' ? 'tumbado' : (s.st === 'cover' ? 'rodilla' : s.post);
    SR2.allNew.set(key, {x: o.x, z: o.z, yaw: o.yaw, side: blk.side, blk, st: s.st, post, cover: s.st === 'cover', mv: ['bound', 'to_cover', 'shift', 'charge', 'fallback', 'crawl'].includes(s.st), sup: s.pin > 0});
    if (s.bs !== s.st) { const b = SR_ST_BARK[s.st]; if (b && h2 < 0.55) srBark(blk.side, b[1], b[0], o.x, o.z, tU); s.bs = s.st; }
    if (s.ph === 'reload' && s.bph !== 'reload' && h1 < 0.18) srBark(blk.side, 'Soldado', '¡Recargando!', o.x, o.z, tU); s.bph = s.ph;
    if (s.role === 'nco' && (s.st === 'fire' || s.st === 'idle') && s.pin <= 0) {          // el suboficial coordina: órdenes y señales tras la línea
      const q = ((tU * 0.2) + h2) % 1; if (q < 0.34) { o.clip = npcClip(q < 0.17 ? 'ordenar' : 'senal', o.clip); o.start = tU - q * 5; if (q < 0.02) srBark(blk.side, 'Sargento', ['¡Fuego a discreción!', '¡Mantened la línea!', '¡Apuntad bajo!', '¡Cubrid el flanco!', '¡Avanzad por tiempos!'][Math.floor(h1 * 100) % 5], o.x, o.z, tU); }
    }
  }
  return o;
};
const _npcShotSR2 = npcShot;
npcShot = function (S, V, s, x, z, thr, vsPlayer, dT, cover, era, dir) {
  _npcShotSR2(S, V, s, x, z, thr, vsPlayer, dT, cover, era, dir); const cur = SR2.cur; if (!cur || vsPlayer) return; try { srNpcFire(S, V, s, x, z, cover, era, cur); } catch (e) { console.warn('srNpcFire', e); }
};
// ametralladora de la época E: ráfagas de 8 disparos
function srMgStep(blk, f, j, x, z, tU, V) {
  const S = B3.S, key = blk.id + ':' + f.i + ':' + j, m = SR2.mg[key] || (SR2.mg[key] = {t: tU + Math.random() * 2, n: 0}); if (!S || tU < m.t) return;
  if (!(blk.mode === 'fire' || blk.mode === 'hold' || blk.mode === 'skirmish') || (blk.sp || 0) > 8 || !blk.foe) { m.t = tU + 1.5; return; }
  const dx = blk.foe.x - x, dz = blk.foe.y - z, d = Math.hypot(dx, dz); if (d > 200 || d < 10) { m.t = tU + 1.5; return; }
  const sh = {x, z, yaw: Math.atan2(dx, dz), side: blk.side, tid: blk.id}, tg = srPickTarget(sh, 'E', V); m.t = tU + 2.2 + Math.random() * 1.8;
  const ca = srCam(); if (Math.hypot(x - ca.x, z - ca.z) > 280) return;
  const gy = b3H(S.tf, x, z) + 1.4; for (let i = 0; i < 8; i++) { const k = (i + 1) / 9, tx = tg ? tg.p.x : blk.foe.x, tz = tg ? tg.p.z : blk.foe.y; setTimeout(() => { if (!SOLD.on) return; fxFlash(x + (tx - x) * 0.04, gy, z + (tz - z) * 0.04, 0.07); fxFlash(x + (tx - x) * k, gy + 0.6 * (1 - k), z + (tz - z) * k, 0.06); }, i * 90); }
  const tx = tg ? tg.p.x : blk.foe.x, tz = tg ? tg.p.z : blk.foe.y, tU2 = performance.now() / 1000; SR2.sup.push({x: tx, z: tz, t: tU2, r: 12, side: blk.side}); SR2.sup.push({x: tx + (Math.random() - 0.5) * 10, z: tz + (Math.random() - 0.5) * 10, t: tU2 + 0.5, r: 10, side: blk.side});
  if (typeof SFX !== 'undefined' && SFX.volley && Math.hypot(x - ca.x, z - ca.z) < 120) { try { SFX.volley(0.4); } catch (e) { } }
  if (tg) { const eyeS = gy, eyeT = b3H(S.tf, tg.p.x, tg.p.z) + 2; const cb = covBlock(S, x, eyeS, z, tg.p.x, eyeT, tg.p.z); if (!cb && Math.random() < 1 - Math.pow(1 - 0.012 * (tg.p.post === 'tumbado' ? 0.4 : tg.p.post === 'rodilla' ? 0.65 : 1), 8)) srKillNPC(S, V, tg.k, tg.p, x, z, Math.random() < 0.6); }
}
// ---- artillería: proyectiles que caen cerca de la cámara ----
function srShellStep(S, V, tU, c) {
  const ca = srCam(); SR2.shells = SR2.shells.filter(sh => { if (tU < sh.t1) return true; srShellBurst(S, V, sh, c, tU); return false; });
  if (tU < SR2.shellT) return; const arts = [...V.blocks.values()].filter(k => k.type === 'art' && (k.mode === 'artfire' || k.mode === 'fire') && k.foe); SR2.shellT = tU + (arts.length ? 2.2 + Math.random() * 3.5 : 6);
  if (!arts.length) return; const era = t3Era(), k = arts[Math.floor(Math.random() * arts.length)]; let tx = k.foe.x + (Math.random() - 0.5) * 70, tz = k.foe.y + (Math.random() - 0.5) * 70;
  if (c && !c.dead && Math.random() < 0.22) { tx = c.x + (Math.random() - 0.5) * 90; tz = c.z + (Math.random() - 0.5) * 90; }           // de vez en cuando cae cerca del jugador
  const d = Math.hypot(tx - ca.x, tz - ca.z); if (d > 230) return;
  SR2.shells.push({x: tx, z: tz, t1: tU + 1.3 + d / 400, side: k.side, era, whistle: false});
}
function srShellBurst(S, V, sh, c, tU) {
  const y = b3H(S.tf, sh.x, sh.z), sm = sh.era === 'A' ? 0.5 : 1; fxFlash(sh.x, y + 1.4, sh.z, 0.5 * sm); for (let i = 0; i < 7 * sm + 2; i++) bvPart(V, {k: 'dust', x: sh.x + (Math.random() - 0.5) * 7, y: sh.z + (Math.random() - 0.5) * 7, life: 1.2}); bvPart(V, {k: 'smoke', x: sh.x, y: sh.z, life: 3});
  const ca = srCam(), dc = Math.hypot(sh.x - ca.x, sh.z - ca.z); if (typeof SFX !== 'undefined' && SFX.boom) { try { SFX.boom(clamp(1 - dc / 260, 0.15, 1)); } catch (e) { } }
  SR2.sup.push({x: sh.x, z: sh.z, t: tU, r: 16, side: sh.side});
  const rk = sh.era === 'A' ? 2.2 : 4, rw = sh.era === 'A' ? 4 : 8;
  SR2.all.forEach((p, k) => { if (p.side === sh.side || (V.kmap && V.kmap[k])) return; const d = Math.hypot(p.x - sh.x, p.z - sh.z); if (d < rk) srKillNPC(S, V, k, p, sh.x, sh.z, true); else if (d < rw && Math.random() < 0.5) srKillNPC(S, V, k, p, sh.x, sh.z, false); });
  if (c && !c.dead) { const d = Math.hypot(c.x - sh.x, c.z - sh.z); if (d < 36) c.kick += (1 - d / 36) * 0.09;
    if (d < rw + 2) { const cb = covBlock(S, sh.x, y + 1, sh.z, c.x, b3H(S.tf, c.x, c.z) + c.head * 0.6, c.z), k = (1 - d / (rw + 2)) * (c.prone ? 0.4 : c.kneel ? 0.65 : 1) * (cb ? 0.3 : 1); if (Math.random() < Math.min(0.9, k * 1.5)) { srHurt(c, d < rk ? 0.9 : 0.25 + 0.4 * k, Math.atan2(sh.z - c.z, sh.x - c.x), false); c.hurt = {ang: Math.atan2(sh.z - c.z, sh.x - c.x), t: tU, blk: false}; } } }
}
// ---- HUD: voces, un solo hook por fotograma ----
const _b3FrameSR2 = b3Frame;
b3Frame = function (V, b, g, lines, all) {
  const tU = performance.now() / 1000, dt = clamp(tU - (SR2.lt || tU), 0, 0.1); SR2.lt = tU;
  SR2.all = SR2.allNew; SR2.allNew = new Map();
  SR2.sup = SR2.sup.filter(e => tU - e.t < 1.5);
  _b3FrameSR2(V, b, g, lines, all);
  if (!SOLD.on) { SR2.all.clear(); return; }
  try { srKlistStep(V, tU, dt); if (B3.S) srShellStep(B3.S, V, tU, SOLD.ctrl); } catch (e) { console.warn('sr2', e); }
  g.save(); g.textAlign = 'left'; const list = SR2.barks.filter(q => tU - q.t < 7).slice(-5); let y = BV_H - 74 - list.length * 22;
  list.forEach(q => { const k = clamp(1 - (tU - q.t - 5) / 2, 0, 1); g.globalAlpha = k; g.fillStyle = 'rgba(8,12,16,.6)'; g.fillRect(8, y - 15, 330, 20); g.font = '600 14px sans-serif'; const mine = SOLD._me && SOLD._me.side === q.side; g.fillStyle = mine ? '#bfe8a8' : '#f2b0a0'; g.fillText((mine ? '📻 ' : '📣 ') + q.who + ': ' + q.text, 14, y); y += 22; });
  g.globalAlpha = 1; g.restore();
};
