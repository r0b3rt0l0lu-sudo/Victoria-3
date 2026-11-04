/* ===== TÁCTICA III: moral visible con pánico contagioso y habilidades activas del general =====
   · Cada bloque tiene una MORAL propia (barra azul bajo el bloque): cae con las bajas, con los flanqueos y con la rotura de los vecinos; se recupera
     en calma y cerca de compañeros. Por debajo de 30 % está «vacilante» (combate peor) y si llega a casi cero rompe filas y CONTAGIA el pánico a los
     bloques cercanos. Las guarniciones de los fuertes casi nunca se quiebran.
   · El GENERAL tiene habilidades activas con enfriamiento. Algunas solo se pueden usar en ciertos CLIMAS/TERRENOS: la carga general en terreno
     abierto, la emboscada en bosque, selva o montaña, aguantar la intemperie en nieve, tundra, montaña o desierto. */
const BIOME_NAME = ['Mar', 'Llanura', 'Bosque', 'Desierto', 'Estepa', 'Tundra', 'Selva', 'Montaña', 'Nieve'];
const GEN_ABIL = {
  inspire: {n: 'Inspirar', ic: '📣', cd: 55, biomes: null, desc: 'Sube la moral de todos tus bloques un 35 % y levanta a los vacilantes. Vale en cualquier terreno.'},
  charge: {n: 'Carga general', ic: '🔥', cd: 70, biomes: [1, 3, 4], desc: 'Solo en terreno abierto (llanura, desierto, estepa): tu línea carga contra el enemigo 12 s con +15 % de ataque.'},
  ambush: {n: 'Emboscada', ic: '🌲', cd: 70, biomes: [2, 6, 7], desc: 'Solo en bosque, selva o montaña: los bloques cubiertos ganan +10 % de ataque y defensa y los enemigos cercanos pierden organización.'},
  endure: {n: 'Aguantar la intemperie', ic: '❄️', cd: 60, biomes: [3, 5, 7, 8], desc: 'Solo en nieve, tundra, montaña o desierto: +15 % de defensa, sin cansancio y la moral no baja durante 15 s.'},
  regroup: {n: 'Reagrupar', ic: '🚩', cd: 45, biomes: null, desc: 'Elimina el cansancio, detiene las rotas y recupera algo de moral. Vale en cualquier terreno.'}
};
const abilOk = (b, k) => { const bi = GEN_ABIL[k].biomes; return !bi || bi.includes(MAP.provs[b.prov].biome); };
const genLvl = (b, side) => Math.max(1, ...sideIds(b, side).map(armyById).filter(Boolean).map(a => (a.gen && a.gen.lvl) || 1));
function tacAbility(V, b, side, key, auto) {
  const A = GEN_ABIL[key]; if (!A) return {ok: false, msg: ''}; if (!abilOk(b, key)) return {ok: false, msg: `${A.n}: solo disponible en ${A.biomes.map(i => BIOME_NAME[i].toLowerCase()).join(', ')} (aquí: ${BIOME_NAME[MAP.provs[b.prov].biome].toLowerCase()}).`};
  V.cd = V.cd || {A: {}, B: {}}; if ((V.cd[side][key] || 0) > V.t) return {ok: false, msg: `${A.n} aún se está preparando (${Math.ceil(V.cd[side][key] - V.t)} s).`};
  V.buff = V.buff || {A: {}, B: {}}; const mult = 0.8 + 0.1 * genLvl(b, side), all = [...V.blocks.values()], mine = all.filter(o => o.side === side && o.mode !== 'rout'), foes = all.filter(o => o.side !== side && o.mode !== 'rout');
  V.cd[side][key] = V.t + A.cd;
  if (key === 'inspire') { mine.forEach(o => { o.mm = Math.min(1, (o.mm === undefined ? 0.7 : o.mm) + 0.35 * mult); if (o.mm > 0.3) o.wav = false; }); V.buff[side].inspire = {until: V.t + 10, att: 0.04 * mult, def: 0}; }
  else if (key === 'charge') { V.buff[side].charge = {until: V.t + 12, att: 0.15 * mult, def: -0.05}; mine.filter(o => o.role === 'line' && !o.garr && o.type !== 'art').forEach(o => { const f = foes.filter(q => q.role !== 'reserve').sort((p, q) => Math.hypot(p.x - o.x, p.y - o.y) - Math.hypot(q.x - o.x, q.y - o.y))[0]; if (f && !(o.d.plan && o.d.plan.k === 'retreat')) { o.d.plan = {k: 'target', foe: f.d, pts: [], i: 0}; o.skey = ''; } }); }
  else if (key === 'ambush') { V.buff[side].ambush = {until: V.t + 14, att: 0.1 * mult, def: 0.1 * mult}; foes.forEach(f => { if (mine.some(o => o.terr && o.terr.cover && Math.hypot(o.x - f.x, o.y - f.y) < 170)) f.d.o = Math.max(0, f.d.o - DIVS[f.d.t].org * 0.05); }); }
  else if (key === 'endure') { V.buff[side].endure = {until: V.t + 15, att: 0, def: 0.15 * mult}; mine.forEach(o => { o.fat = 0; }); }
  else if (key === 'regroup') { mine.forEach(o => { o.fat = 0; o.brk = 0; o.mm = Math.min(1, (o.mm === undefined ? 0.7 : o.mm) + 0.15); o.figs.forEach(f => { if (f.alive) f.flee = 0; }); }); }
  const gn = (sideIds(b, side).map(armyById).filter(Boolean)[0] || {}).gen, nm = gn && gn.name ? `Gral. ${gn.name}` : 'El general', cn = G.C[side === 'A' ? b.A0 : b.B0].name;
  bvBanner(V, `${A.ic} ${nm} ordena: ${A.n}`, side, ''); (b.log = b.log || []).push({k: 'reinf', d: b.day, t: `${cn}: ${nm} ordena «${A.n.toLowerCase()}».`}); if (b.log.length > 30) b.log.shift(); void auto;
  if (typeof SFX !== 'undefined') SFX.bugle(); return {ok: true};
}
const buffSum = (V, s, key) => { const o = V.buff && V.buff[s]; let v = 0; if (o) for (const k in o) if (o[k].until > V.t) v += o[k][key] || 0; return v; };
const buffOn = (V, s, k) => !!(V.buff && V.buff[s] && V.buff[s][k] && V.buff[s][k].until > V.t);
// bonos de los planes + habilidades + vacilantes (sustituye al cálculo de tactica2)
const _tacPlanFx2 = tacPlanFx;
tacPlanFx = function (V, b, all) { _tacPlanFx2(V, b, all); ['A', 'B'].forEach(s => { b.tac[s].att += buffSum(V, s, 'att'); b.tac[s].def += buffSum(V, s, 'def'); const w = all.filter(o => o.side === s && o.mm !== undefined && o.mm < 0.3 && o.mode !== 'rout').length; b.tac[s].att -= Math.min(0.1, w * 0.015); }); };
/* ---------- moral por bloque ---------- */
function tacMoraleX(V, b, all, step) {
  if (V.over || b.prep) return;
  all.forEach(blk => {
    if (blk.mm === undefined) blk.mm = clamp((typeof armyMor === 'function' ? armyMor(blk.a) : 0.8) * 0.92 + 0.08, 0.2, 1);
    const ds = (blk._ls === undefined ? blk.d.s : blk._ls) - blk.d.s; blk._ls = blk.d.s; let dm = -ds * 2.6;
    if (V.t - (blk.flanked || -9) < 2.5) dm -= 0.045 * step;
    const mates = all.filter(o => o !== blk && o.side === blk.side && o.mode !== 'rout' && Math.hypot(o.x - blk.x, o.y - blk.y) < 95).length;
    all.forEach(o => { if (o === blk || o.side !== blk.side) return; if (o.brk > 0 || o.mode === 'rout' || o.mode === 'recoil') { const d = Math.hypot(o.x - blk.x, o.y - blk.y); if (d < 115) dm -= 0.055 * step * (1 - d / 115) + (o.brk > 5.5 ? 0.09 * (1 - d / 115) : 0); } });      // el pánico se contagia
    if (ds < 0.003) dm += (0.011 + 0.007 * Math.min(3, mates)) * step; if (blk.garr) dm += 0.02 * step; if (blk.terr && blk.terr.village) dm += 0.02 * step;
    if (buffOn(V, blk.side, 'endure')) dm = Math.max(dm, 0);
    blk.mm = clamp(blk.mm + dm, 0, 1); blk.wav = blk.mm < 0.3;
    const immune = blk.garr || buffOn(V, blk.side, 'endure') || buffOn(V, blk.side, 'inspire') || (blk.d.plan && blk.d.plan.k === 'defend' && blk.mm > 0.04);
    if (blk.mm < 0.07 && !immune && !(blk.brk > 0) && blk.mode !== 'rout' && blk.type !== 'tank') {
      blk.brk = 8; blk.mm = 0.32; blk.d.o = Math.max(0, blk.d.o - DIVS[blk.d.t].org * 0.12); blk.figs.forEach(f => { if (f.alive && !f.flee && Math.random() < 0.6) bvFlee(V, blk, f, 1.1); });
      bvBanner(V, `😱 ${G.C[blk.tag].name} rompe filas y el pánico se extiende`, blk.side, ''); (b.log = b.log || []).push({k: 'panic', d: b.day, t: `Una división de ${G.C[blk.tag].name} pierde la moral y rompe filas; el pánico cunde entre sus vecinos.`}); if (b.log.length > 30) b.log.shift();
    }
  });
}
/* ---------- IA: usa las habilidades cuando conviene ---------- */
function tacAiAbil(V, b, all, s) {
  if (V.t - (V['aiAb' + s] || -9) < 4) return; V['aiAb' + s] = V.t;
  const mine = all.filter(o => o.side === s && o.mode !== 'rout'), foes = all.filter(o => o.side !== s && o.mode !== 'rout'); if (!mine.length) return;
  const wav = mine.filter(o => o.mm !== undefined && o.mm < 0.3).length, ratio = mine.reduce((n, o) => n + o.d.s, 0) / Math.max(0.1, foes.reduce((n, o) => n + o.d.s, 0)), att = b.att === s;
  const tryA = k => { const r = tacAbility(V, b, s, k, true); return r.ok; };
  if (wav >= 2 || mine.some(o => o.mm < 0.15)) { if (tryA('inspire')) return; }
  if (mine.filter(o => (o.fat || 0) > 0.6).length >= 2 || mine.filter(o => o.brk > 0).length >= 2) { if (tryA('regroup')) return; }
  if (abilOk(b, 'charge') && att && ratio > 1.1 && foes.some(f => mine.some(o => Math.hypot(o.x - f.x, o.y - f.y) < 190))) { if (tryA('charge')) return; }
  if (abilOk(b, 'ambush') && !att && foes.some(f => mine.some(o => o.terr && o.terr.cover && Math.hypot(o.x - f.x, o.y - f.y) < 170))) { if (tryA('ambush')) return; }
  if (abilOk(b, 'endure') && ratio < 0.9 && mine.some(o => Math.hypot(o.x - (o.side === 'A' ? 1 : -1) * 0 - foes[0].x, o.y - foes[0].y) < 160)) tryA('endure');
}
/* ---------- interfaz ---------- */
function tacAbilHtml(b, V) {
  const ps = playerSide(b); if (!ps || b.prep || b.ended || !V) return ''; const bi = BIOME_NAME[MAP.provs[b.prov].biome].toLowerCase(), lv = genLvl(b, ps);
  return `<div class="abil"><div class="abil-h">🎖️ <b>Habilidades del general</b> <small>nivel ${lv} · terreno: ${bi}</small></div><div class="ordbtns">${Object.keys(GEN_ABIL).map(k => { const A = GEN_ABIL[k], ok = abilOk(b, k), cd = Math.ceil(((V.cd && V.cd[ps] && V.cd[ps][k]) || 0) - V.t), ready = ok && cd <= 0;
    return `<button data-act="tacabil" data-k="${k}" class="${ready ? '' : 'nofunds'} ${buffOn(V, ps, k) ? 'on' : ''}" data-tip="<b>${A.ic} ${A.n}</b><br>${A.desc}<br>${ok ? (cd > 0 ? `Preparándose: ${cd} s` : 'Disponible') : `<span class=bad>No disponible en este terreno (${bi}). Solo: ${A.biomes.map(i => BIOME_NAME[i].toLowerCase()).join(', ')}.</span>`}">${A.ic} ${A.n}${cd > 0 && ok ? ` <small>${cd}s</small>` : ''}${ok ? '' : ' <small>🚫</small>'}</button>`; }).join('')}</div></div>`;
}
Object.assign(ACT, { tacabil: d => { const V = R.bviz, b = G.battles.find(x => x.id === UI.battle); if (!V || !b || b.ended || b.prep) return; const ps = playerSide(b); if (!ps) return; const r = tacAbility(V, b, ps, d.k, false); if (!r.ok && r.msg) toast('⚠️', r.msg); renderBattlePanel(); } });
