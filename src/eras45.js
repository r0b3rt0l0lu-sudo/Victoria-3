/* ===== ERA 4: la guerra mundial (1920→) =====
   Amplía el árbol tecnológico, los batallones y los buques con lo que hace falta para las época de 1939.
   Sigue el mismo patrón que mil2.js: se añaden a las tablas existentes (ERAS, TECHS/TECH, BATTALIONS, SHIP_TYPES, NV_STYLE). */
ERAS.push({n: 4, name: 'Era de las Guerras Mundiales', from: 1920, base: 7000, needPrev: 12, needYear: 1920});
// [id, nombre, rama, era, multiplicador, requisitos, efectos, descripción, año mínimo]
[
  // ---- era 4 ----
  ['synthetics', 'Petroquímica y Plásticos', 'Producción', 4, 1.0, ['organic_chem', 'internal_comb'], {indOut: .10, constr: .04}, 'Refinerías, caucho sintético y plásticos: la industria del siglo XX.', 1920],
  ['antibiotics', 'Antibióticos', 'Sociedad', 4, 1.1, ['refrigeration', 'organic_chem'], {grow: .002, stab: 1}, 'La penicilina cambia la medicina y la guerra.', 1928],
  ['mass_media', 'Radio y Cine', 'Sociedad', 4, 1.0, ['telephony'], {bur: .10, stab: 1}, 'Propaganda, noticiarios y cultura de masas.', 1922],
  ['radar', 'Radar', 'Militar', 4, 1.2, ['quick_firing', 'telephony'], {army: .02, defense: .04}, 'Detección a distancia de aviones y buques.', 1936],
  ['mech_war', 'Guerra Mecanizada', 'Militar', 4, 1.4, ['armor', 'motorization'], {army: .05, logistics: .10}, 'Carros medios, infantería mecanizada y artillería autopropulsada: la guerra relámpago.', 1930],
  ['destroyers', 'Destructores', 'Militar', 4, 1.1, ['cruisers', 'radar'], {army: .01}, 'Buques rápidos y versátiles para escoltar y cazar submarinos.', 1930],
  ['carriers', 'Portaaviones', 'Militar', 4, 1.4, ['dreadnought', 'bombers', 'fighters'], {army: .02}, 'Pistas flotantes: el poder naval se mide en aviones.', 1930],
  ['fast_battleship', 'Acorazados Rápidos', 'Militar', 4, 1.4, ['dreadnought', 'radar'], {army: .02}, 'Los últimos grandes acorazados: blindaje, velocidad y radar de tiro.', 1936],
  ['strategic_air', 'Bombardeo Estratégico', 'Militar', 4, 1.3, ['bombers', 'radar'], {army: .02}, 'Flotas de bombarderos pesados contra la industria enemiga.', 1938],
  ['jet_engine', 'Reactores', 'Militar', 4, 1.4, ['fighters', 'internal_comb'], {army: .03}, 'Los primeros cazas a reacción.', 1943],
  ['atomic_age', 'Energía Atómica', 'Militar', 4, 1.6, ['jet_engine', 'electricity'], {army: .03, indOut: .03}, 'La fisión nuclear: energía y la bomba.', 1945],
  ['combined_arms', 'Armas Combinadas', 'Militar', 4, 1.3, ['mech_war', 'strategic_air'], {army: .06, defense: .04}, 'Carros, aviación e infantería coordinados por radio.', 1940]
].forEach(r => {
  if (TECH[r[0]]) return;
  const t = {id: r[0], name: r[1], cat: r[2], era: r[3], cost: Math.round(ERAS[r[3]].base * r[4] / 10) * 10, req: r[5], fx: r[6], desc: r[7], ex: undefined, until: undefined, after: r[8]};
  TECHS.push(t); TECH[t.id] = t;
});

/* ---------- batallones ---------- */
Object.assign(BATTALIONS, {
  mech: {name: 'Infantería mecanizada', icon: '🚙', att: 1.1, def: 1.3, org: 4.6, spd: 1.7, cost: 70, width: 1, kind: 'inf', tech: 'mech_war', needs: {rifles: 1200, gunpowder: 120, mgs: 40}},
  mtank: {name: 'Carros medios', icon: '🚜', att: 3.4, def: 2.2, org: 3.4, spd: 1.6, cost: 150, width: 1, kind: 'art', tech: 'mech_war', needs: {cannons: 80, rifles: 300, gunpowder: 220}},
  spg: {name: 'Artillería autopropulsada', icon: '🎯', att: 2.6, def: .8, org: 3.2, spd: 1.4, cost: 120, width: 1, kind: 'art', tech: 'mech_war', needs: {cannons: 140, rifles: 300, gunpowder: 500}},
});
['mech', 'mtank', 'spg'].forEach(k => BN_ORDER.push(k));

/* ---------- buques ---------- */
Object.assign(SHIP_TYPES, {
  destroyer: {name: 'Destructor', icon: '🚤', att: 11, def: 7, spd: 2.0, pts: 110, days: 100, raid: 2.2, tech: 'destroyers', up: 650},
  carrier: {name: 'Portaaviones', icon: '🛩️', att: 28, def: 12, spd: 1.5, pts: 460, days: 240, raid: 1.2, tech: 'carriers', up: 2600},
  bb: {name: 'Acorazado rápido', icon: '⚓', att: 42, def: 38, spd: 1.4, pts: 540, days: 260, raid: 0.5, tech: 'fast_battleship', up: 2900},
});
['destroyer', 'carrier', 'bb'].forEach(k => SHIP_ORDER.push(k));
Object.assign(NV_STYLE, {
  destroyer: {len: 58, h: 8, funnels: 2, turret: 2, name: 'Destructor'}, carrier: {len: 112, h: 12, deck: true, funnels: 1, name: 'Portaaviones'},
  bb: {len: 104, h: 14, funnels: 2, turret: 6, name: 'Acorazado rápido'},
});
