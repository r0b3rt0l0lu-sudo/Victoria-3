/* ===== TROPAS 3D EN EL MAPA DE CAMPAÑA (integración de troops3d.js, ver referencia/tropas/INTEGRACION_TROPAS.md) =====
   Sustituye las figuras antiguas (buildFigures/updateArmyMeshes) por soldados, jinetes y piezas animados: 32 tipos, 4 épocas, 3 LOD, GPU horneada.
   Si el navegador no cumple los requisitos, o el módulo lanza cualquier excepción, se vuelve a las figuras antiguas (R.tropas3dOff = true).
   Puede desactivarse con ?sintropas3d en la dirección o con R.tropas3dOff = true. */
const T3_SCALE = 0.2;                                                   // las figuras nuevas miden 1,8 unidades; las antiguas ≈ 0,35
const T3_CAPS = {inf: [600, 2500, 2500], cav: [200, 800, 800], art: [200, 800, 800]};
// códigos de país del juego → uniforme histórico del módulo (el resto usa el genérico teñido con el color del país)
const T3_HIST = {GBR: 'GBR', FRA: 'FRA', PRU: 'PRU', AUS: 'AUT', RUS: 'RUS', OTT: 'TUR', USA: 'USA', CSA: 'CSA', SPA: 'ESP', SAR: 'ITA', JAP: 'JPN', CHN: 'CHN', SWE: 'SWE', DEN: 'DEN'};
const t3Era = () => G.date.y < 1856 ? 'A' : G.date.y < 1881 ? 'B' : G.date.y < 1914 ? 'C' : G.date.y < 1937 ? 'D' : 'E';
// uniformes de la época E (1937-1945) por país del juego: el código del juego → nación del módulo (en el escenario de 1939 BAV es Polonia, AUS es Hungría, AUL es Australia…)
const T3_HIST_E = {GBR: 'GBR', FRA: 'FRA', PRU: 'GER', RUS: 'SOV', USA: 'USA', SAR: 'ITA', JAP: 'JPN', OTT: 'TUR', CHN: 'CHN', BAV: 'POL', CAN: 'CAN', AUL: 'AUS', ZUL: 'SAF', AUS: 'HUN', WAL: 'ROU', SER: 'YUG', SIK: 'FIN'};
function t3Usable() {
  if (window.Troops3D === undefined || R.tropas3dOff || /sintropas3d/.test(location.search)) return false;
  if (R._t3ok !== undefined) return R._t3ok;
  try {
    const gl = R.renderer.getContext(), c = R.renderer.capabilities;
    R._t3ok = !!((c.isWebGL2 || gl.getExtension('OES_texture_float')) && c.maxVertexTextures > 0 && c.maxTextureSize >= 4096);
    if (!R._t3ok) console.warn('Tropas 3D desactivadas: el equipo no cumple los requisitos (WebGL2/texturas en el shader de vértices/textura de 4096).');
  } catch (e) { R._t3ok = false; }
  return R._t3ok;
}
function t3Init() {
  if (R.t3) return R.t3; const T = Troops3D, cl = o => JSON.parse(JSON.stringify(o));
  const aul = cl(T.NACIONES.AUS);                                                           // el módulo llama «AUS» a Australia; en el juego «AUS» es Austria
  if (G.C.AUS) { T.NACIONES.AUS = cl(T.NACIONES.AUT); T.NACIONES.AUS.E = cl(T.NACIONES.HUN.E); }
  if (G.C.AUL) T.NACIONES.AUL = aul;
  Object.keys(G.C).forEach(tag => {
    if (tag === NONE) return;
    const hex = '#' + R.occRGB(tag).map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
    let n = T.NACIONES[tag];
    if (!n) { n = cl(T.NACIONES[T3_HIST[tag] || 'GEN']); if (!T3_HIST[tag]) T.TROOP_ERAS.forEach(e => { if (n[e]) n[e].c[0] = hex; }); T.NACIONES[tag] = n; }   // genérico: casaca = color del país
    const he = T3_HIST_E[tag];
    if (he && T.NACIONES[he] && T.NACIONES[he].E && tag !== 'AUS' && tag !== 'AUL') n.E = cl(T.NACIONES[he].E);
    else if (!n.E) { n.E = cl(T.NACIONES.GEN.E || T.NACIONES.GEN.D); n.E.c[0] = hex; if (n.E.veh) n.E.veh = hex; }
  });
  R.t3 = {shared: new T.TroopShared(Object.keys(G.C).filter(t => t !== NONE)), sets: {}, group: new THREE.Group(), o: {}, seen: new Set(), t0: performance.now()};
  R.scene.add(R.t3.group); return R.t3;
}
// un TroopLodSet por (tipo, época, clave de tocado, papel); los países con el mismo tocado comparten lote
function t3Set(kind, era, nation, role) {
  const T = Troops3D, S = R.t3, gk = T.troopGeoKey(kind, era, nation), key = kind + '|' + era + '|' + gk + '|' + (role || '');
  let set = S.sets[key];
  if (!set) {
    const caps = (T3_CAPS[kind === 'husar' || kind === 'lancero' || kind === 'dragon' || kind === 'coracero' ? 'cav' : /canon|obus|ametralladora|avantren|carro|carreta|artillero|tanque|mark1|camion|semioruga|cazacarros/.test(kind) ? 'art' : 'inf'] || T3_CAPS.inf).map(n => R.lowEnd ? n >> 1 : n);
    set = S.sets[key] = new T.TroopLodSet(S.shared, kind, era, nation, caps, {role, dist: [10, 30]}); set.meshes.forEach(m => S.group.add(m)); set.era = era; set.kind = kind;
  }
  return set;
}

/* ---------- época E: composición de una división por sus batallones ---------- */
function t3Comp(d, tag) {
  let bns = null, key = d.t;
  if (key && key.charAt(0) === 'T') { const c = G.C[tag], tp = c && c.m2 && c.m2.tpl ? c.m2.tpl.find(x => x.key === key) : null; if (tp) bns = tp.bns; }
  const n = {inf: 0, mg: 0, mot: 0, mech: 0, tank: 0, spg: 0, art: 0, cav: 0};
  if (!bns) { n[key === 'cav' ? 'cav' : key === 'art' ? 'art' : 'inf'] = 9; return n; }
  bns.forEach(k => { if (k === 'inf' || k === 'eng') n.inf++; else if (k === 'arm' || k === 'mtank') n.tank++; else if (n[k] !== undefined) n[k]++; });
  return n;
}
const T3_VEH = {tanque_medio: 0.45, cazacarros: 0.45, semioruga: 0.45, camion: 0.45};             // los vehículos miden varios metros: en el mapa se reducen para que no tapen la provincia
const T3_TRK = {tanque_medio: 1, cazacarros: 1, semioruga: 1};
function t3EClip(kind, battle, moving, h) {
  if (kind === 'fusilero') return battle ? (h < 0.35 ? 'disparar_tumbado' : 'disparar') : moving ? 'marcha' : 'idle';
  if (kind === 'ametrallador') return battle ? 'disparar_rafaga' : moving ? 'marcha' : 'idle';
  if (kind === 'dragon') return battle ? 'carga' : moving ? 'trote' : 'idle';
  if (kind === 'camion') return moving ? 'avanzar' : 'ralenti';
  if (kind === 'semioruga') return battle ? 'disparar_ametralladora' : moving ? 'avanzar' : 'ralenti';
  return battle ? 'disparar_canon' : moving ? 'avanzar' : 'ralenti';                                   // tanques y cazacarros
}
const _t3list = [];
function t3EDiv(a, d, i, baseX, baseZ, hy, cs, sn, fdir, moving, era, cav, tag) {
  const S = R.t3, T = Troops3D, o = S.o, c = t3Comp(d, tag), row = Math.floor(i / 3), cl = i % 3, oz = row * 0.17 * 2.7, battle = !!a.battle, L = _t3list; L.length = 0;
  if (c.tank) L.push('tanque_medio'); if (c.tank > 3) L.push('tanque_medio'); if (c.spg) L.push('cazacarros'); if (c.mech) L.push('semioruga'); if (c.mot) L.push('camion'); if (c.mg) L.push('ametrallador');
  if (c.inf) { L.push('fusilero'); if (!c.tank && !c.mot && !c.mech) L.push('fusilero'); } if (c.cav) { L.push('dragon'); L.push('dragon'); }
  const n = L.length;
  for (let f = 0; f < n; f++) {
    const kind = L[f], ox = ((cl - 1) * 0.2 + (f - (n - 1) / 2) * (kind === 'fusilero' || kind === 'ametrallador' ? 0.075 : 0.11)) * 2.7, h1 = hash2(a.id, i * 8 + f, 11), h2 = hash2(a.id, i * 8 + f, 13);
    o.phase = h1; o.h = (h2 - 0.5) * 0.12; o.bright = (h1 * 7.3) % 1; o.skin = (h2 * 4) | 0; o.horse = (h1 * 4) | 0; o.tread = T3_TRK[kind] && moving ? 1.6 : 0;
    t3Set(kind, era, tag, null).add(cav, baseX + ox * cs - oz * sn, hy, baseZ + ox * sn + oz * cs, fdir, T3_VEH[kind] ? T3_SCALE * T3_VEH[kind] : T3_SCALE, tag, t3EClip(kind, battle, moving, h2), o);
  }
  if (c.art) {                                                                                       // artillería: pieza con sus servidores
    const gx = baseX + (cl - 1) * 0.2 * 2.7 * cs - (oz + 0.25) * sn, gz = baseZ + (cl - 1) * 0.2 * 2.7 * sn + (oz + 0.25) * cs, h1 = hash2(a.id, i * 8, 17), st = battle ? 'fuego' : moving ? 'marcha' : 'reposo';
    T.troopGroup('bateria', era, st).forEach(m => { const set = t3Set(m.kind, era, tag, m.role), lx = m.at[0] * T3_SCALE, lz = m.at[1] * T3_SCALE, c2 = Math.cos(fdir), s2 = Math.sin(fdir);
      o.phase = h1; o.h = 0; o.bright = (h1 * 7.3) % 1; o.skin = (h1 * 4) | 0; o.horse = 0; o.tread = 0; set.add(cav, gx + lx * c2 + lz * s2, hy, gz - lx * s2 + lz * c2, fdir + (m.at[2] || 0) * Math.PI / 180, T3_SCALE, tag, m.clip, o); });
  }
}
const T3_CAV = ['husar', 'husar', 'husar', 'lancero', 'lancero', 'dragon', 'coracero'];
const _t3Old = updateArmyMeshes;
updateArmyMeshes = function (t) {
  let usable = false; try { usable = t3Usable(); } catch (e) { usable = false; }
  if (!usable || !G.armies || !MAP.provs) return _t3Old(t);
  try { t3Update(t, _t3Old); }
  catch (e) { console.warn('Tropas 3D desactivadas por un error; vuelven las figuras antiguas.', e); R.tropas3dOff = true; if (R.t3) R.t3.group.visible = false; return _t3Old(t); }
};
function t3Update(t, old) {
  const S = t3Init(), T = Troops3D, era = t3Era(), sh = S.shared, o = S.o, cav = R.cam.dist;
  // barcos y aviones los sigue dibujando el código antiguo; las figuras antiguas se ocultan
  const sf = R.showFigs; R.showFigs = false; old(t); R.showFigs = sf; if (R.figs) ['inf', 'cav', 'art'].forEach(k => { const f = R.figs[k]; if (f) f.tint.count = f.fixed.count = 0; });
  const show = cav < (R.lowEnd ? 42 : 62) && R.showFigs !== false; R.figsShown = show; S.group.visible = true;
  Object.keys(S.sets).forEach(k => S.sets[k].begin());
  sh.timeU.value = performance.now() / 1000;
  if (!show) return;
  const cw = R.canvas.clientWidth, ch = R.canvas.clientHeight, perProv = {}, hy0 = 0.02, eraFire = era === 'A' ? 'disparar_A' : era === 'B' ? 'disparar_B' : 'disparar_D';
  G.armies.forEach(a => {
    if (a.sea || !armyVisible(a)) return;
    const pv = MAP.provs[a.loc]; let lon = pv.lon, lat = pv.lat, fdir = 0;
    if (a.path.length && a.hopMax > 0 && !a.battle) { const nx = MAP.provs[a.path[0]], f = clamp(1 - a.hop / a.hopMax, 0, 1); lon += (nx.lon - lon) * f; lat += (nx.lat - lat) * f; fdir = Math.atan2(nx.lon - pv.lon, -(nx.lat - pv.lat)); }
    else if (a.battle) { const b = G.battles.find(x => x.id === a.battle); fdir = b && b.A.includes(a.id) ? Math.PI / 2 : -Math.PI / 2; }
    const sp = worldToScreen(lon, 0.3, -lat); if (sp[0] < -60 || sp[0] > cw + 60 || sp[1] < -60 || sp[1] > ch + 60) return;
    const k = (perProv[a.loc] = (perProv[a.loc] || 0) + 1) - 1, baseX = lon + (k % 2 ? 0.32 : -0.32) * (k ? 1 : 0), baseZ = -lat + Math.floor((k + 1) / 2) * 0.28 * (k % 2 ? 1 : -1), hy = terrainY(lon, lat) + hy0;
    const moving = a.path.length && !a.battle, cs = Math.cos(fdir), sn = Math.sin(fdir), tag = a.tag;
    a.divs.slice(0, 9).forEach((d, i) => {
      if (era === 'E') { t3EDiv(a, d, i, baseX, baseZ, hy, cs, sn, fdir, !!moving, era, cav, tag); return; }
      const type = dKind(d), row = Math.floor(i / 3), cl = i % 3, per = type === 'inf' ? 3 : type === 'cav' ? 2 : 1;
      if (type === 'art') {                                                                                   // pieza con sus servidores (grupo)
        const ox = (cl - 1) * 0.2 * 2.7, oz = row * 0.17 * 2.7, h1 = hash2(a.id, i * 8, 11), st = a.battle ? 'fuego' : moving ? 'marcha' : 'reposo';
        const gx = baseX + ox * cs - oz * sn, gz = baseZ + ox * sn + oz * cs;
        T.troopGroup('bateria', era, st).forEach(m => {
          const set = t3Set(m.kind, era, tag, m.role), lx = m.at[0] * T3_SCALE, lz = m.at[1] * T3_SCALE, c2 = Math.cos(fdir), s2 = Math.sin(fdir);
          o.phase = h1; o.h = 0; o.bright = (h1 * 7.3) % 1; o.skin = (h1 * 4) | 0; o.horse = (h1 * 4) | 0;
          set.add(cav, gx + lx * c2 + lz * s2, hy, gz - lx * s2 + lz * c2, fdir + (m.at[2] || 0) * Math.PI / 180, T3_SCALE, tag, m.clip, o);
        });
        return;
      }
      for (let f = 0; f < per; f++) {
        const ox = ((cl - 1) * 0.2 + (f - (per - 1) / 2) * 0.075) * 2.7, oz = row * 0.17 * 2.7, h1 = hash2(a.id, i * 8 + f, 11), h2 = hash2(a.id, i * 8 + f, 13);
        const kind = type === 'cav' ? T3_CAV[(a.id * 7 + i * 3 + f) % T3_CAV.length] : 'fusilero', clip = type === 'cav' ? (a.battle ? 'carga' : moving ? 'trote' : 'idle') : (a.battle ? eraFire : moving ? 'marcha' : 'idle');
        o.phase = h1; o.h = (h2 - 0.5) * 0.12; o.bright = (h1 * 7.3) % 1; o.skin = (h2 * 4) | 0; o.horse = (h1 * 4) | 0;
        t3Set(kind, era, tag, null).add(cav, baseX + ox * cs - oz * sn, hy, baseZ + ox * sn + oz * cs, fdir, T3_SCALE, tag, clip, o);
      }
    });
  });
  R.dirty = true;
}
