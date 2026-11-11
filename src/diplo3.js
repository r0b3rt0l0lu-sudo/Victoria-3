/* ===== DIPLOMACIA 3: sentido histórico, reticencias, alianzas difíciles, ofertas con sentido geográfico y menos acoso a tu país =====
   · TRADICIÓN HISTÓRICA: rivalidades y afinidades por pareja de países y años (Francia-Prusia, el Gran Juego, Austria-Italia, la alianza anglo-portuguesa,
     el Eje y los Aliados en 1939…). Mueven la opinión estructural y hacen más (o menos) aceptables los pactos.
   · ALIANZAS DIFÍCILES: exigen confianza alta, amenaza o interés comunes, cercanía, pocos compromisos previos y que el candidato no sea aliado de tus enemigos.
     Las enemistades históricas profundas son casi insuperables.
   · OFERTAS CON SENTIDO: la IA solo te propone un pacto si lo justifica la geografía (vecindad, región, costa) o una amenaza común, y dice por qué.
   · MENOS ACOSO: la IA ya no te ataca, embargo, espía ni coalición sin motivo; entre agresiones a tu país pasa un largo descanso. */
const HIST_REL = [
  // [a, b, valor (−enemistad / +afinidad), desde, hasta, motivo]
  ['FRA', 'PRU', -14, 1836, 1870, 'Rivalidad por el Rin'], ['FRA', 'PRU', -32, 1870, 1946, 'Alsacia-Lorena y la revancha'],
  ['GBR', 'FRA', -10, 1836, 1900, 'Rivalidad colonial'], ['GBR', 'FRA', 14, 1904, 1946, 'Entente cordial'],
  ['GBR', 'RUS', -18, 1836, 1907, 'El Gran Juego en Asia'], ['GBR', 'RUS', 8, 1907, 1918, 'Entente anglo-rusa'], ['GBR', 'RUS', -10, 1930, 1946, 'Recelo ideológico'],
  ['GBR', 'PRU', -20, 1900, 1946, 'Carrera naval y colonial'], ['GBR', 'POR', 24, 1836, 1946, 'La alianza más antigua'], ['GBR', 'NET', 8, 1836, 1946, 'Intereses marítimos comunes'],
  ['GBR', 'USA', -8, 1836, 1900, 'Disputas americanas'], ['GBR', 'USA', 10, 1900, 1946, 'Entendimiento anglosajón'], ['GBR', 'JAP', 8, 1902, 1922, 'Alianza anglo-japonesa'], ['GBR', 'JAP', -10, 1931, 1946, 'Expansión japonesa'],
  ['RUS', 'OTT', -28, 1836, 1923, 'Guerras ruso-turcas y los Estrechos'], ['RUS', 'AUS', -14, 1836, 1918, 'Rivalidad en los Balcanes'], ['RUS', 'PRU', 8, 1836, 1860, 'Santa Alianza'],
  ['AUS', 'SAR', -24, 1836, 1918, 'Irredentismo italiano'], ['AUS', 'PRU', -14, 1836, 1866, 'Pugna por Alemania'], ['AUS', 'PRU', 16, 1879, 1918, 'Alianza dual'], ['SAR', 'PRU', 10, 1866, 1918, 'Aliados de 1866'],
  ['SAR', 'FRA', 8, 1836, 1880, 'Ayuda francesa a la unificación'], ['SAR', 'FRA', -10, 1881, 1946, 'Disputa por Túnez y el Mediterráneo'],
  ['JAP', 'CHN', -28, 1868, 1946, 'Expansión japonesa en China'], ['JAP', 'RUS', -18, 1895, 1946, 'Rivalidad en Manchuria'], ['JAP', 'USA', -16, 1920, 1946, 'Rivalidad en el Pacífico'],
  ['USA', 'MEX', -16, 1836, 1920, 'Tensión fronteriza'], ['USA', 'SPA', -16, 1890, 1900, 'Cuba y Filipinas'], ['SPA', 'POR', -6, 1836, 1900, 'Recelo ibérico'],
  ['NET', 'BEL', -12, 1830, 1914, 'Secesión belga'], ['FRA', 'BEL', 6, 1836, 1946, 'Afinidad cultural'], ['PRU', 'DEN', -14, 1848, 1920, 'Schleswig-Holstein'], ['SWE', 'DEN', 5, 1836, 1946, 'Vecindad nórdica'], ['SWE', 'RUS', -10, 1836, 1910, 'Recuerdo de Finlandia'],
  ['PRS', 'OTT', -22, 1836, 1925, 'Rivalidad chií-suní'], ['PRS', 'RUS', -16, 1836, 1920, 'Pérdidas en el Cáucaso'], ['PRS', 'GBR', -10, 1836, 1920, 'Influencia británica en el Golfo'], ['AFG', 'GBR', -16, 1836, 1920, 'Guerras anglo-afganas'],
  ['CHN', 'GBR', -12, 1836, 1900, 'Guerras del Opio'], ['CHN', 'FRA', -8, 1836, 1900, 'Concesiones forzosas'], ['CHN', 'RUS', -10, 1836, 1920, 'Tratados desiguales'],
  ['EGY', 'OTT', -14, 1836, 1914, 'Rebeldía egipcia'], ['GRE', 'OTT', -28, 1836, 1923, 'Independencia y Megali Idea'], ['SER', 'OTT', -24, 1836, 1914, 'Dominio otomano'], ['SER', 'AUS', -22, 1878, 1918, 'Pugna por Bosnia'],
  ['BRZ', 'ARG', -14, 1836, 1900, 'Rivalidad por el Plata'], ['PER', 'CHL', -20, 1836, 1930, 'Rivalidad del Pacífico'], ['BOL', 'CHL', -22, 1860, 1930, 'Guerra del Pacífico'], ['PAR', 'BRZ', -10, 1836, 1875, 'Disputas fronterizas'],
  ['MEX', 'FRA', -10, 1860, 1870, 'Intervención francesa'], ['VIE', 'FRA', -12, 1858, 1946, 'Conquista de Indochina'], ['ETH', 'SAR', -18, 1880, 1946, 'Ambiciones italianas'], ['ZUL', 'GBR', -16, 1836, 1900, 'Guerras zulúes'],
  // 1939: el mundo de la Segunda Guerra Mundial (los códigos BAV, AUS, SER, WAL… son otros países en esa época)
  ['PRU', 'BAV', -45, 1937, 1946, 'Corredor de Danzig y revanchismo'], ['RUS', 'BAV', -35, 1937, 1946, 'Guerra polaco-soviética'], ['RUS', 'PRU', -26, 1937, 1946, 'Antagonismo ideológico'], ['RUS', 'SIK', -18, 1937, 1946, 'Presión soviética sobre Finlandia'],
  ['RUS', 'WAL', -14, 1937, 1946, 'Disputa por Besarabia'], ['SAR', 'FRA', -12, 1937, 1946, 'Reclamaciones italianas'], ['PRU', 'SAR', 18, 1936, 1946, 'Eje Roma-Berlín'], ['PRU', 'JAP', 12, 1936, 1946, 'Pacto Anti-Komintern'], ['PRU', 'AUS', 14, 1937, 1946, 'Revisionismo húngaro'],
  ['PRU', 'WAL', 6, 1937, 1946, 'Petróleo y comercio'], ['GBR', 'BAV', 12, 1939, 1946, 'Garantía a Polonia'], ['FRA', 'BAV', 12, 1937, 1946, 'Alianza franco-polaca'], ['USA', 'RUS', -12, 1936, 1946, 'Desconfianza ideológica'], ['USA', 'PRU', -10, 1937, 1946, 'Régimen nazi'],
  ['GBR', 'CAN', 22, 1937, 1946, 'Mancomunidad'], ['GBR', 'AUL', 22, 1937, 1946, 'Mancomunidad'], ['GBR', 'ZUL', 18, 1937, 1946, 'Mancomunidad'], ['CHN', 'JAP', -22, 1937, 1946, 'Guerra chino-japonesa']
];
// valor histórico de la pareja en el año actual (suma de todos los motivos vigentes) y el mejor motivo
function histPair(a, b, y) {
  y = y || G.date.y; let v = 0, why = null, wv = 0;
  for (let i = 0; i < HIST_REL.length; i++) { const e = HIST_REL[i]; if (!((e[0] === a && e[1] === b) || (e[0] === b && e[1] === a)) || y < e[3] || y >= e[4]) continue; v += e[2]; if (Math.abs(e[2]) > wv) { wv = Math.abs(e[2]); why = e[5]; } }
  return {v, why};
}
const histRel = (a, b) => histPair(a, b).v;
// 1) la tradición histórica entra en la opinión estructural
const _relFactorsD3 = relFactors;
relFactors = function (a, b) { const f = _relFactorsD3(a, b), h = histPair(a, b); if (h.v) f.push([h.why || 'Tradición histórica', h.v]); return f; };

// 2) alianzas y garantías: reticencias difíciles de superar
PACTS.alliance.cost = 40; PACTS.alliance.desc += ' Exige mucha confianza, un enemigo o interés común y cercanía; las viejas enemistades la hacen casi imposible.';
const maxAllies = c => c.rank <= 6 ? 3 : 2;
const _acceptChanceD3 = acceptChance;
acceptChance = function (type, from, to, level) {
  const r = _acceptChanceD3(type, from, to, level); if (!r.p || !G.C[from] || !G.C[to] || (type !== 'alliance' && type !== 'guarantee' && type !== 'nonagg')) return r;
  const F = G.C[from], T = G.C[to], h = histPair(from, to), why = t => r.reasons.push(t); let k = 1;
  if (h.v <= -30) { k *= 0.04; why(`${h.why || 'Enemistad histórica'}: casi insuperable`); }
  else if (h.v <= -18) { k *= 0.25; why(`${h.why || 'Enemistad histórica'}: muy reticentes`); }
  else if (h.v <= -8) { k *= 0.6; why(`${h.why || 'Recelo histórico'}: reticentes`); }
  else if (h.v >= 12) { k *= 1.25; why(`${h.why || 'Afinidad histórica'}: más receptivos`); }
  if (type === 'alliance') {
    const rel = relOf(to, from);
    if (rel < 30) { k *= 0; why('No confían lo bastante en ti (hacen falta relaciones de +30)'); }
    if (allies(to).length >= maxAllies(T) && !anyPactBetween(from, to, ['alliance'])) { k *= 0; why('Ya tienen demasiados compromisos'); }
    const enemyAlly = allies(to).some(x => x !== from && (histRel(from, x) <= -18 || anyPactBetween(from, x, ['rival']) || relOf(from, x) < -35));
    if (enemyAlly) { k *= 0.08; why('Son aliados de tus rivales'); }
    const near = canReach(from, to) || canReach(to, from), common = G.wars.some(w => (w.attAll.includes(from) && w.attAll.includes(to)) || (w.defAll.includes(from) && w.defAll.includes(to)));
    if (!near && !common) { const d = typeof minDist === 'function' ? minDist(F, T).min : 0; if (d > 50) { k *= 0.3; why('Demasiado lejos para obligaciones mutuas'); } }
    if (F.infamy > 20) { k *= 0.6; why('Tu infamia inquieta a los posibles aliados'); }
    if (T.rank <= 8 && F.rank > 20) { k *= 0.35; why('Una gran potencia rara vez se alía con un país pequeño'); }
    k *= 0.7;
  } else if (type === 'guarantee') { if (relOf(to, from) < 5) { k *= 0.2; why('No quieren tu protección: relaciones demasiado frías'); } }
  r.p = clamp(r.p * k, 0, 0.8); return r;
};

// 3) propuestas de la IA: solo si tienen sentido geográfico o estratégico; se explica el motivo
function offerReason(c, type) {
  const P = G.C[G.player]; if (!P) return null; const rel = relOf(G.player, c.tag), h = histPair(c.tag, G.player).v, reach = canReach(c.tag, G.player) || canReach(G.player, c.tag), d = typeof minDist === 'function' ? minDist(c, P).min : 99;
  if (h <= -15 || rel < 5 || anyPactBetween(c.tag, G.player, ['rival'])) return null;
  const threat = G.tags.find(x => x !== NONE && x !== c.tag && x !== G.player && alive(x) && G.C[x].rank <= 18 && (relOf(c.tag, x) < -15 || histRel(c.tag, x) <= -15) && (relOf(G.player, x) < -10 || histRel(G.player, x) <= -10 || canReach(x, G.player)) && (canReach(x, c.tag) || canReach(c.tag, x)));
  const atWar = G.wars.some(w => (w.attAll.includes(c.tag) && w.attAll.includes(G.player)) || (w.defAll.includes(c.tag) && w.defAll.includes(G.player)));
  switch (type) {
    case 'trade': if (reach) return 'sois vecinos y os conviene comerciar'; if (c.rank <= 20 && P.rank <= 25 && d < 75 && rel >= 10) return 'dos potencias de la misma región marítima'; return null;
    case 'nonagg': if (reach && rel >= 8 && (armyPower(c) < armyPower(P) * 1.2 || threat)) return 'comparten frontera y no quieren un frente más'; return null;
    case 'alliance': if (rel >= 30 && (atWar || threat) && (reach || d < 45) && allies(c.tag).length < maxAllies(c)) return atWar ? 'tenéis un enemigo común en la guerra' : `ambos teméis a ${G.C[threat].name}`; return null;
    case 'guarantee': if (rel >= 15 && armyPower(c) > armyPower(P) * 1.3 && (reach || d < 50) && (threat || G.tags.some(x => x !== NONE && x !== G.player && alive(x) && canReach(x, G.player) && relOf(x, G.player) < -20))) return 'quiere protegerte de un vecino hostil y ganar influencia en la zona'; return null;
  }
  return null;
}
aiDiploAction = function (c) {
  const cand = aiCandidates(c, 5); if (!cand.length) return;
  const o = pick(cand);
  const w = [['trade', 5], ['nonagg', 2.2], ['alliance', 0.5], ['guarantee', 0.8], ['embargo', relOf(c.tag, o) < -25 && histRel(c.tag, o) <= -10 ? 1.2 : 0], ['rival', relOf(c.tag, o) < -15 || histRel(c.tag, o) <= -18 ? 1 : 0]];
  let tot = w.reduce((a, x) => a + x[1], 0), r = Math.random() * tot, type = 'trade';
  for (const x of w) { if ((r -= x[1]) <= 0) { type = x[0]; break; } }
  if (pactBetween(type, c.tag, o) || (PACTS[type].mutual && pactBetween(type, o, c.tag))) return;
  if (type === 'alliance' && c.overlord) return;
  if (type === 'embargo' || type === 'rival') {
    if (o === G.player && !(relOf(c.tag, o) < -40 || histRel(c.tag, o) <= -20 || atWarWith(c.tag, o))) return;             // a ti solo te hacen el vacío por motivos serios
    if (relOf(c.tag, o) < -20) makePact(type, c.tag, o); return;
  }
  if (o === G.player) {
    if (G.proposals.length >= 2 || G.proposals.some(pp => pp.from === c.tag) || Math.random() > 0.3) return;
    const why = offerReason(c, type); if (!why) return;
    G.proposals.push({id: G.nextId++, from: c.tag, type, t: G.date.t, why});
    notify('diplo', `${c.name} te propone: ${PACTS[type].name} (${why}). Revisa Diplomacia.`);
    return;
  }
  const r2 = acceptChance(type, c.tag, o), mine = acceptChance(type, o, c.tag);
  if (Math.random() < Math.min(r2.p, mine.p) * 0.8) makePact(type, c.tag, o, {level: 1});
};

// 4) la IA te deja más en paz
const _aiWarPlanD3 = aiWarPlan;
function playerProvoked(a) {
  const P = G.C[G.player], A = G.C[a];
  return claimsOn(a, G.player) > 0 || grudgeOf(a, G.player) > 20 || histRel(a, G.player) <= -18 || anyPactBetween(a, G.player, ['rival']) || P.infamy > 35 || (P.exp || 0) > 12 || G.wars.some(w => (w.attAll.includes(G.player) && w.defAll.includes(a)) || (w.defAll.includes(G.player) && w.attAll.includes(a)));
}
aiWarPlan = function (a) {
  const p = _aiWarPlanD3(a); if (!p || p.d !== G.player) return p;
  if (!playerProvoked(a)) return null;                                                                       // sin motivo no te atacan
  if (G.date.t - (G.eventCool.lastAggressionOnPlayer || -9999) < 730) return null;                           // descanso de dos años entre agresiones
  if (Math.random() > 0.25) return null;
  return p;
};
const _declareWarD3 = declareWar;
declareWar = function (attTag, defTag, cbId, targets, opts) {
  const r = _declareWarD3(attTag, defTag, cbId, targets, opts);
  if (r && r.ok !== false && defTag === G.player && attTag !== G.player && cbId !== 'defense' && G.eventCool) G.eventCool.lastAggressionOnPlayer = G.date.t;
  return r;
};
const _aiBullyD3 = aiBullyPlayer;
aiBullyPlayer = function () {
  const P = G.C[G.player]; if (!P) return;
  const saved = relOf; void saved;
  if (G.date.t - (G.eventCool.lastAggressionOnPlayer || -9999) < 730 || Math.random() > 0.35) return;               // las presiones son raras y espaciadas
  _aiBullyD3();
};
// las invitaciones a bloques de la IA también deben tener sentido (misma región, buena relación) y no repetirse cada pocos meses
const _aiBlocD3 = aiBlocAction;
aiBlocAction = function (c) {
  const n0 = G.proposals.length; _aiBlocD3(c);
  for (let i = G.proposals.length - 1; i >= n0; i--) {
    const pp = G.proposals[i]; if (pp.type !== 'bloc') continue;
    const P = G.C[G.player], k = 'prop_' + pp.from + '_bloc', ok = relOf(G.player, pp.from) >= 25 && histRel(pp.from, G.player) > -10 && (canReach(pp.from, G.player) || minDist(G.C[pp.from], P).min < 45) && (G.eventCool[k] || 0) < G.date.t;
    if (!ok) { G.proposals.splice(i, 1); continue; }
    G.eventCool[k] = G.date.t + 900; pp.why = 'comparte región e intereses con tu país';
  }
};
// tras una propuesta de la IA (aceptada o no) esa potencia no insiste durante dos años
const _respondD3 = respondProposal;
respondProposal = function (id, accept) { const pp = G.proposals.find(p => p.id === id); if (pp) G.eventCool['prop_' + pp.from + '_' + pp.type] = G.date.t + 730; return _respondD3(id, accept); };
const _offerReasonD3 = offerReason;
offerReason = function (c, type) { if ((G.eventCool['prop_' + c.tag + '_' + type] || 0) > G.date.t) return null; const r = _offerReasonD3(c, type); if (r) G.eventCool['prop_' + c.tag + '_' + type] = G.date.t + 900; return r; };
