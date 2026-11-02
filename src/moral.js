/* ===== MORAL, PRISIONEROS Y COORDINACIÓN ENTRE ALIADOS =====
   · Moral de cada ejército (0–1): sube con las victorias y el descanso, baja con las derrotas, las retiradas y la falta de suministro.
     Modifica ataque y defensa (×0,85 a ×1,15) y un ejército desmoralizado se retira antes del combate.
   · Prisioneros: los derrotados que se retiran sin salida (cercados) y parte de las bajas de una derrota caen prisioneros del vencedor.
     Cuentan para la puntuación de guerra y se devuelven al firmar la paz.
   · Aliados: la IA concentra los ataques de una coalición en el mismo sector (pinza) en lugar de dispersarlos. */
const MOR_BASE = 0.8;
const armyMor = a => a.mor === undefined ? MOR_BASE : a.mor;
const morMod = a => 0.85 + 0.3 * armyMor(a);
const morName = m => m >= 0.85 ? 'Exaltada' : m >= 0.65 ? 'Alta' : m >= 0.45 ? 'Normal' : m >= 0.25 ? 'Baja' : 'Quebrada';

// moral tras cada jornada de combate: el bando que domina gana moral y el que pierde, la pierde
function morBattle(A, B, rAB, rBA, lostA, lostB) {
  const aWin = rAB > rBA, k = clamp(Math.abs(rAB - rBA) / Math.max(0.2, rAB + rBA), 0, 1);
  const f = (list, win, lost) => list.forEach(a => { const d = win ? 0.006 + 0.008 * k : -(0.012 + 0.014 * k); a.mor = clamp(armyMor(a) + d - (lost / Math.max(1, list.length * MEN_PER_DIV * 30)) * 0.01, 0, 1); });
  f(A, aWin, lostA); f(B, !aWin, lostB);
}
function morDay() {
  G.armies.forEach(a => {
    if (a.battle) return;
    const own = typeof provOwner === 'function' ? (provOwner(a.loc) === a.tag) : false, sup = a.sup === undefined ? 1 : a.sup;
    let d = 0.003 + (own ? 0.004 : 0) + (a.mode === 'train' || a.mode === 'hold' ? 0.003 : 0) - (sup < 0.5 ? 0.02 : 0) - (a.path && a.path.length && a.fm ? 0.01 : 0);
    a.mor = clamp(armyMor(a) + d, 0, 1);
  });
}
// el ejército debe retirarse antes cuando su moral está por los suelos
const morRetreatTh = list => list.some(a => armyMor(a) < 0.25) ? 0.30 : list.some(a => armyMor(a) < 0.45) ? 0.22 : 0.18;

/* ---------- prisioneros ---------- */
function prisTotal(c) { let n = 0; if (c.pris) for (const k in c.pris) n += c.pris[k]; return Math.round(n); }
function prisHeldFrom(holders, owners) { let n = 0; holders.forEach(h => { const p = G.C[h] && G.C[h].pris; if (p) owners.forEach(o => { n += p[o] || 0; }); }); return n; }
function takePrisoners(winTag, loseTag, n) {
  n = Math.round(n); if (n < 50 || winTag === loseTag) return;
  const c = G.C[winTag]; if (!c) return; c.pris = c.pris || {}; c.pris[loseTag] = (c.pris[loseTag] || 0) + n;
  if ((winTag === G.player || loseTag === G.player) && n >= 1500) notify('war', `${G.C[winTag].name} captura ${fmtN(n, 0)} prisioneros de ${G.C[loseTag].name}.`);
}
function battlePrisoners(b, winner, win, lose) {
  if (!win[0] || !lose[0]) return;
  const lossMen = (winner === 'A' ? b.lostB : b.lostA) || 0;
  lose.forEach(a => {
    let n = lossMen * 0.12 / lose.length;
    if (a._encircled) { n += armyMen(a) * 0.3; a.divs.forEach(d => { d.s *= 0.8; }); a._encircled = false; a.mor = clamp(armyMor(a) - 0.2, 0, 1); }
    takePrisoners(win[0].tag, a.tag, n); b.pris = b.pris || {A: 0, B: 0}; b.pris[winner] += Math.round(n);
  });
}
// la paz devuelve a los prisioneros: vuelven a su población como reclutas (con un pequeño recargo de cansancio)
function returnPrisoners(w) {
  const all = w.attAll.concat(w.defAll);
  all.forEach(h => { const c = G.C[h]; if (!c || !c.pris) return;
    all.forEach(o => { if (o === h || !c.pris[o]) return; if (!(w.attAll.includes(h) !== w.attAll.includes(o))) return; const n = c.pris[o], oc = G.C[o]; delete c.pris[o];
      if (oc && oc.states.length) { const left = n * 0.85; oc.states.slice(0, 6).forEach(id => { G.S[id].pops.peasants = (G.S[id].pops.peasants || 0) + left / Math.min(6, oc.states.length); }); if (o === G.player || h === G.player) notify('war', `Intercambio de prisioneros: ${fmtN(n, 0)} hombres regresan a ${oc.name}.`); } });
  });
}
const prisScore = w => clamp((prisHeldFrom(w.attAll, w.defAll) - prisHeldFrom(w.defAll, w.attAll)) / 9000, -8, 8);

/* ---------- coordinación entre aliados (IA) ---------- */
// bonificación a los objetivos cercanos al sector donde atacan mis aliados (pinza / concentración); el mismo objetivo exacto se evita
function aiAllyBonus(t, p) {
  const claims = G.aiClaim; if (!claims) return 1; let best = 1;
  for (const k in claims) { const c = claims[k]; if (!c || c.t === t || G.date.t - c.d > 10 || !sameSide(t, c.t) || +k === p) continue;
    const d = provDist(+k, p); if (d <= 7) best = Math.max(best, 1.35 - d * 0.03); }
  return best;
}
