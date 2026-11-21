/* ===== APOYO AÉREO Y NAVAL A LAS BATALLAS TERRESTRES (con efectos positivos Y negativos) =====
   · Aéreo: el bando con superioridad aérea en la región recibe hasta +25 % (ya existía); el que la pierde recibe hasta −18 % de ataque y defensa
     (bombardeo y ametrallamiento de sus columnas) según la proporción de cazas y la cantidad de aviones en juego.
   · Naval: en provincias de estados costeros cuentan las flotas (propias y aliadas frente a hostiles) presentes en los mares adyacentes. La superioridad da hasta
     +16 % (fuego naval de apoyo, suministro y refuerzos por mar); la inferioridad, hasta −16 % (bombardeo de la costa e interdicción). La misión «Bombardeo costero» pesa ×1,8.
   El resumen de cada bando se anota en b.sup y en el registro de la batalla. */
NAV_MISSIONS.bombard = {name: 'Bombardeo costero', icon: '💥', desc: 'Cañonea las costas y apoya a los ejércitos de tierra en provincias costeras de la zona: +fuerza para tu bando en esas batallas y −fuerza para el enemigo si dominas el mar.'};
const _airBonusAP = airBonus;
airBonus = function (tag, sid) {
  const pos = _airBonusAP(tag, sid); if (!G.mx || !mx().sq.length) return pos; const reg = airRegOf(sid), own = airFighters(tag, reg), foe = airHostileFighters(tag, reg);
  if (own >= foe || foe <= 0) return pos; const net = (foe - own) / (foe + own + 6);
  return -0.18 * net * Math.min(1, (own + foe) / 25);
};
function navSupportZones(sid) { const z = new Set(); MAP.stats[sid].provs.forEach(p => { if (MAP.provs[p].port) z.add(seaZoneOfProv(p)); }); return [...z]; }
function navBonus(tag, sid) {
  if (!G.mx || !mx().fl.length) return 0; const zs = navSupportZones(sid); if (!zs.length) return 0; let own = 0, foe = 0;
  mx().fl.forEach(f => { if (!zs.includes(f.zone) || f.tr || f.port != null || !f.ships.length) return; const w = fleetPower(f, 'att') * (f.mission === 'bombard' ? 1.8 : 1);
    if (f.tag === tag || sameSide(tag, f.tag)) own += w; else if (hostileTags(tag, f.tag)) foe += w; });
  if (own + foe <= 0) return 0; return 0.16 * ((own - foe) / (own + foe + 8)) * Math.min(1, (own + foe) / 45);
}
const _sideStatsAP = sideStats;
sideStats = function (b, ids, isAttacker) {
  const r = _sideStatsAP(b, ids, isAttacker), sideKey = ids === b.A ? 'A' : ids === b.B ? 'B' : null; if (!sideKey || !G.mx) return r;
  const tag = sideKey === 'A' ? b.A0 : b.B0, nav = navBonus(tag, b.state), air = airBonus(tag, b.state);
  b.sup = b.sup || {}; b.sup[sideKey] = {air: +air.toFixed(3), nav: +nav.toFixed(3)};
  if (nav) { r.F *= 1 + nav; r.T *= 1 + nav; }
  if (b.day === 1 && !b['supSaid' + sideKey] && (Math.abs(air) > 0.03 || Math.abs(nav) > 0.03)) { b['supSaid' + sideKey] = 1; b.log = b.log || [];
    const parts = []; if (Math.abs(air) > 0.03) parts.push(`${air > 0 ? '✈️ superioridad aérea' : '✈️ el enemigo domina el aire'} (${air > 0 ? '+' : ''}${Math.round(air * 100)} %)`); if (Math.abs(nav) > 0.03) parts.push(`${nav > 0 ? '⚓ apoyo naval' : '⚓ el enemigo domina la costa'} (${nav > 0 ? '+' : ''}${Math.round(nav * 100)} %)`);
    b.log.push({d: b.day, k: 'panic', s: sideKey, t: `${G.C[tag].name}: ${parts.join(' · ')}.`}); if (b.log.length > 14) b.log.shift(); }
  return r;
};
