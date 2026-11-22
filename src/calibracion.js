/* ===== CALIBRACIÓN HISTÓRICA DEL COMBATE TERRESTRE (ver ESTUDIO_CALIBRACION.md) =====
   Objetivos por época (batalla de provincia, fuerzas iguales, terreno llano):
   · ánima lisa (1815-50): 3-6 días, atacante 25-35% de bajas, defensor 15-25%, razón ~1.3-1.7
   · fusil rayado (1850-65): atacante 30-40%, defensor 15-22%, razón ~1.7-2.3
   · retrocarga (1866-1900): atacante 35-45%, defensor 15-22%, razón ~2-2.8 (St. Privat, Plevna)
   · ametralladora/trincheras (1900-18): batallas largas, atacante 40-60%, defensor 20-35%, razón ~2.2-3.2 (Somme, Verdún)
   · motorización (1935-45): la movilidad y el arma combinada recuperan el ataque (razón ~1.8-2.6) */
function eraLvl(b) {
  const f = t => { const c = G.C[t]; if (!c || !c.techs) return 0; let l = weapLvl(t); if (hasTech(c, 'trench_warfare')) l = 4; if (hasTech(c, 'motorization')) l = 5; return l; };
  return Math.max(f(b.A0), f(b.B0));
}
const CAL = {
  org: [4.2, 4.2, 4.0, 3.2, 2.8, 3.0],           // ritmo de pérdida de organización
  cas: [0.26, 0.30, 0.34, 0.40, 0.44, 0.44],     // bajas por punto de organización
  atk: [1.0, 0.85, 0.75, 0.7, 0.7, 0.9],           // multiplicador de bajas del atacante
  def: [1.0, 0.9, 0.85, 0.8, 0.75, 0.8]            // multiplicador de bajas del defensor
};
orgK = b => CAL.org[eraLvl(b)];
casK = b => CAL.cas[eraLvl(b)];
/* rendimiento de la caballería y la artillería según el armamento (ver estudio): la caballería pierde el choque frente al fusil rayado y la
   retrocarga; la artillería rayada, de acero y de tiro rápido gana alcance y letalidad (en 1914-18 causa la mayoría de las bajas) */
const CAV_K = [1.0, 0.85, 0.6, 0.4, 0.35, 0.35], ART_K = [0.85, 1.0, 1.15, 1.3, 1.4, 1.4];
const _sideStatsCal = sideStats;
sideStats = function (b, ids, isAttacker) {
  const r = _sideStatsCal(b, ids, isAttacker); if (ids !== b.A && ids !== b.B) return r;
  const key = ids === b.A ? 'A' : 'B', tag = key === 'A' ? b.A0 : b.B0, L = eraLvl(b), own = Math.min(5, Math.max(0, weapLvl(tag) + (hasTech(G.C[tag], 'trench_warfare') ? 1 : 0)));
  const n = r.n || 1, cavW = r.cav / n, artW = Math.min(0.6, 1.6 * r.art / n);
  r.F *= 1 + cavW * (CAV_K[own] - 1) + artW * (ART_K[own] - 1);
  r.cas *= isAttacker ? CAL.atk[L] : CAL.def[L];
  // doctrinas tardías (1916-45): infiltración, armas combinadas, blitzkrieg, contraataque blindado
  const dm = k => typeof docMod === 'function' ? docMod(tag, k) : 0, armAvg = b['arm' + key] || 0;
  if (isAttacker) {
    r.cas *= 1 - Math.min(0.3, 0.35 * dm('infil'));
    r.F *= 1 + dm('armorAtt') * Math.min(1, 3 * armAvg) + (b.day <= 4 && r.art > 0 ? dm('arty') : 0);
  } else r.T *= 1 + dm('counter') * (armAvg > 0 ? 1 : 0.3);
  if (r.art > 0 && armAvg > 0 && own >= 3) r.F *= 1 + 0.04 + dm('comb');               // arma combinada: infantería + artillería + blindados
  return r;
};
// doctrinas terrestres del periodo 1914-1945 (las fechas históricas de las existentes se ajustan a la realidad)
(function () {
  const L = DOCTRINES.land.branches;
  L.depth.tiers[2].from = 1914; L.fire.tiers[2].from = 1915; L.mobile.tiers[2].from = 1900;
  L.mobile.tiers.push({name: 'Tropas de asalto e infiltración', xp: 160, from: 1916, fx: {att: .06, org: .04, infil: .5}}, {name: 'Guerra relámpago (Blitzkrieg)', xp: 230, from: 1936, fx: {att: .08, spd: .18, armorAtt: .15}});
  L.fire.tiers.push({name: 'Preparación artillera metódica', xp: 160, from: 1916, fx: {att: .05, arty: .2}}, {name: 'Armas combinadas', xp: 230, from: 1930, fx: {att: .05, def: .04, comb: .12}});
  L.depth.tiers.push({name: 'Defensa móvil y contraataque blindado', xp: 190, from: 1930, fx: {def: .08, org: .06, counter: .15}});
  L.mass.tiers.push({name: 'Movilización total y reemplazos', xp: 170, from: 1914, fx: {org: .06, cost: -.06}});
})();
