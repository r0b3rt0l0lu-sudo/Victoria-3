/* ===== LOS EJÉRCITOS NO SE RETIRAN SALVO ORDEN =====
   Investigación (resumen): en las batallas de los siglos XIX y XX el objetivo era romper la moral, no aniquilar; los ejércitos aguantaban su posición hasta que se desplomaban,
   y la retirada ordenada era una decisión del mando que se tomaba cuando se habían agotado las posibilidades de éxito (así lo recoge el manual alemán de 1945: una retirada
   es un repliegue forzoso que solo se ordena cuando ya no hay opciones). Lo que pasaba sin orden era el desbandamiento por colapso de la moral.
   Reglas nuevas:
   · Visor táctico (battleviz.js): los bloques ya no retroceden solos por pánico, gas, aturdimiento tras una carga ni por la fase de repliegue de las escaramuzas; se quedan en su puesto.
     Solo retroceden con una orden «Retirada» explícita del bloque, con la orden general de retirada o al terminar la batalla.
   · Resultado de la batalla (military.js): un ejército resiste hasta que su organización cae al 6 % (4 % con orden de mantener la posición) o se le ordena retirarse.
     La retirada ordenada (botón «🏳️ Ordenar retirada» del jugador, o la IA cuando todo está perdido: < 22 % de organización, menos de la mitad que el rival, ≥ 6 días de batalla) termina la
     batalla ordenadamente: el ejército se retira con menor pérdida de moral (−4 % en lugar de −12 %) y sin riesgo para su general. */
function retreatSideOf(b) {
  const mine = ids => ids.map(armyById).some(a => a && a.tag === G.player);
  return mine(b.A) ? 'A' : mine(b.B) ? 'B' : null;
}
const retreatBtn = () => {
  const b = G.battles.find(x => x.id === UI.battle); if (!b || b.ended) return ''; const s = retreatSideOf(b); if (!s) return ''; const on = !!b['retreat' + s];
  return `<button data-act="bvretreat" class="${on ? 'on' : ''}" data-tip="<b>Ordenar la retirada</b><br>Tus tropas no se retiran por su cuenta: aguantan hasta que se desploman. Si decides retirarte, el ejército se repliega ordenadamente (menos pérdida de moral) y la batalla termina al día siguiente.">🏳️ ${on ? 'Retirada ordenada' : 'Ordenar retirada'}</button>`;
};
ACT.bvretreat = () => {
  const b = G.battles.find(x => x.id === UI.battle); if (!b) return; const s = retreatSideOf(b); if (!s || b['retreat' + s]) return;
  if (!confirm('¿Ordenar la retirada de tu ejército? La batalla se dará por perdida y tus tropas se replegarán de forma ordenada.')) return;
  b['retreat' + s] = true; const V = R.bviz; if (V && V.id === b.id) { V.retreatAll = V.retreatAll || {}; V.retreatAll[s] = true; }
  toast('🏳️', 'Retirada ordenada: tus tropas se repliegan.'); renderBattlePanel();
};
