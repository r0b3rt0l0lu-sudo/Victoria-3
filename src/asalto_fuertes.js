/* ===== ASALTO Y TOMA DE FUERTES, REDUCTOS Y BATERÍAS =====
   Antes la guarnición era invulnerable y el fuerte solo caía por el cañoneo: nadie lo «tomaba». Ahora:
   · ASALTO: cuando hay infantería enemiga a menos de 30 u de los muros se apoyan escalas (3D) y los atacantes dañan la obra (0,8 por bloque y segundo, más contra trincheras y baterías).
   · La guarnición solo es inquebrantable mientras la obra conserva más del 35 % de su solidez; con brechas puede romperse como cualquier unidad.
   · RENDICIÓN: si la obra está por debajo del 40 %, hay enemigos cerca y la moral o la organización de toda la guarnición cae por debajo del 25 % durante 3 s, la guarnición se rinde:
     la mitad de sus hombres quedan prisioneros, el resto huye y la obra se queda sin defensores.
   · CAPTURA: el atacante que entra en una obra sin guarnición la toma; la bandera cambia, los cañones pasan a su bando (el 40 % de las veces el defensor los había clavado y quedan a la mitad),
     sus bloques ganan moral, los vecinos del bando que pierde la obra pierden moral y la batalla se inclina hacia quien la toma.
   · METRALLA: los cañones de la obra disparan a quemarropa (< 45 u): daño directo y desorganización además del cañoneo.
   · HUMO Y FUEGO en las obras dañadas (más cuanto más destruidas).
   · IA: el atacante de la IA organiza el asalto a las brechas de las obras enemigas y lo apoya con el fuego de su artillería. */
const tacGarrIntact = (b, blk) => { const fid = blk.d && blk.d.cust && blk.d.cust.fort; if (!fid) return true; const f = (b.forts || []).find(q => q.id === fid); return !f || f.hp / f.hpMax > 0.35; };
const afRect = (f, o, pad) => { const dx = Math.max(0, Math.abs(o.x - f.x) - f.w / 2), dy = Math.max(0, Math.abs(o.y - f.y) - f.h / 2); return Math.hypot(dx, dy) < pad; };
function tacAssaultStep(V, b, all, step) {
  (b.forts || []).forEach(f => {
    if (f.hp <= 0) { f._assault = false; return; }
    const foes = all.filter(o => o.side !== f.side && o.mode !== 'rout' && o.type !== 'art' && o.type !== 'cav'), near = foes.filter(o => afRect(f, o, 30)), was = !!f._assault; f._assault = near.length > 0;
    if (f._assault !== was) b3SigTouch(b);
    if (near.length) { const gar = tacGarrisonOf(b, f), k = f.kind === 'trench' ? 1.2 : f.kind === 'battery' ? 1.3 : 1; f.hp = Math.max(0, f.hp - near.length * 0.8 * k * step * (gar.length ? 1 : 1.6));
      if (f.hp <= 0) { tacRelease(b, f); (b.log = b.log || []).push({k: 'panic', d: b.day, t: `${FORT_KINDS[f.kind].ic} ¡Los atacantes derriban ${FORT_KINDS[f.kind].n.toLowerCase()} de ${G.C[f.side === 'A' ? b.A0 : b.B0].name}!`}); return; }
      // rendición de la guarnición
      const regs = gar.map(d => all.find(o => o.d === d)).filter(Boolean);
      if (regs.length && f.hp / f.hpMax < 0.4) { const weak = regs.every(o => (o.mm !== undefined ? o.mm : 1) < 0.25 || o.d.o / DIVS[o.d.t].org < 0.25); f._surT = weak ? (f._surT || 0) + step : 0;
        if (f._surT > 3) { const enemy = f.side === 'A' ? 'B' : 'A'; let men = 0; regs.forEach(o => { men += o.d.s * MEN_PER_DIV * 0.25; o.d.s *= 0.6; o.d.o = 0; o.mode = 'rout'; o.mm = 0; o.brk = 8; });
          b.pris = b.pris || {A: 0, B: 0}; b.pris[enemy] = (b.pris[enemy] || 0) + men; tacRelease(b, f); f._surT = 0;
          const nm = G.C[f.side === 'A' ? b.A0 : b.B0].name; bvBanner(V, `🏳️ La guarnición de ${nm} se rinde (${fmtN(men, 0)} prisioneros)`, enemy, ''); (b.log = b.log || []).push({k: 'flank', d: b.day, t: `La guarnición de ${FORT_KINDS[f.kind].n.toLowerCase()} de ${nm} se rinde ante el asalto: ${fmtN(men, 0)} prisioneros.`}); if (b.log.length > 30) b.log.shift(); } }
      else f._surT = 0;
    } else f._surT = 0;
  });
}
function b3SigTouch(b) { if (typeof B3 !== 'undefined' && B3.S && B3.S.bid === b.id) B3.S.fortSig = null; }
const _tacCaptureAF = tacCaptureForts;
tacCaptureForts = function (V, b, all, step) {
  tacAssaultStep(V, b, all, step); const before = (b.forts || []).map(f => f.side + f.id);
  _tacCaptureAF(V, b, all, step);
  (b.forts || []).forEach((f, i) => { if (before[i] !== f.side + f.id && f.cap && !f._capDone) { f._capDone = true; tacFortCaptured(V, b, all, f); } else if (f.cap && before[i] === f.side + f.id) f._capDone = f._capDone; });
};
function tacFortCaptured(V, b, all, f) {
  const side = f.side, spiked = f.guns > 0 && Math.random() < 0.4, g0 = f.guns; if (spiked) f.guns = Math.max(0, Math.floor(f.guns / 2)); f._assault = false; b3SigTouch(b);
  all.forEach(o => { if (o.side === side && Math.hypot(o.x - f.x, o.y - f.y) < 90) o.mm = Math.min(1, (o.mm !== undefined ? o.mm : 0.7) + 0.12); else if (o.side !== side && Math.hypot(o.x - f.x, o.y - f.y) < 110) o.mm = Math.max(0, (o.mm !== undefined ? o.mm : 0.7) - 0.15); });
  b.adv = clamp((b.adv || 0) + (side === 'A' ? 1 : -1) * 0.08, -1, 1);
  if (g0) { const nm = G.C[side === 'A' ? b.A0 : b.B0].name; (b.log = b.log || []).push({k: 'flank', d: b.day, t: spiked ? `${nm} toma la obra: los cañones estaban clavados en parte (${g0 - f.guns} inutilizados, ${f.guns} utilizables).` : `${nm} toma la obra y captura ${g0} ${g0 > 1 ? 'cañones' : 'cañón'}.`}); if (b.log.length > 30) b.log.shift(); if (V.fortTgt) delete V.fortTgt[f.id]; }
}
// metralla a quemarropa, humo y fuego
const _tacFortGunsAF = tacFortGuns;
tacFortGuns = function (V, b, all, step) {
  _tacFortGunsAF(V, b, all, step);
  (b.forts || []).forEach(f => {
    const r = f.hp / f.hpMax;
    if (f.hp > 0 && r < 0.65) { f._fx = (f._fx || 0) - step; if (f._fx <= 0) { f._fx = 0.9 + Math.random() * 1.2; const dir = f.side === 'A' ? 1 : -1, zz = f.y + (Math.random() - 0.5) * f.h * 0.8, xx = f.x + dir * (f.w / 2 - 4); bvPart(V, {k: 'smoke', x: xx, y: zz, life: 3, r: 5, vx: V.wind * 0.5 + (Math.random() - 0.5) * 3}); if (r < 0.35) bvPart(V, {k: 'flash', x: xx, y: zz, life: 0.25, big: 1}); } }
    if (f.hp <= 0 || !f.guns) return; f._cn = (f._cn || 0) - step; if (f._cn > 0) return;
    const crewed = tacGarrisonOf(b, f).length > 0 || f.kind === 'fort', near = all.filter(o => o.side !== f.side && o.mode !== 'rout' && o.type !== 'art' && afRect(f, o, 45)).sort((p, q) => Math.hypot(p.x - f.x, p.y - f.y) - Math.hypot(q.x - f.x, q.y - f.y));
    if (!near.length || !crewed) { f._cn = 1; return; } f._cn = 2.2 + Math.random(); const t = near[0], org = DIVS[t.d.t].org;
    t.d.s = Math.max(0.02, t.d.s - 0.0011 * f.guns); t.d.o = Math.max(0, t.d.o - org * 0.004 * f.guns); const dir = f.side === 'A' ? 1 : -1;
    for (let i = 0; i < 6; i++) bvPart(V, {k: 'tracer', x: f.x + dir * (f.w / 2 - 3), y: f.y + (Math.random() - 0.5) * 8, x2: t.x + (Math.random() - 0.5) * 20, y2: t.y + (Math.random() - 0.5) * 20, life: 0.2});
    bvPart(V, {k: 'flash', x: f.x + dir * (f.w / 2), y: f.y, life: 0.15, big: 1}); if (!f._cnB) { f._cnB = true; bvBanner(V, '💥 ¡Metralla a quemarropa desde la obra!', f.side, ''); }
  });
};
// IA: asalto a las brechas
const _tacFortDayAF = tacFortDay;
tacFortDay = function (b) {
  _tacFortDayAF(b); const V = R.bviz; if (!V || V.id !== b.id || b.prep || V.over) return;
  ['A', 'B'].forEach(side => { if (side === playerSide(b)) return;
    const foeForts = (b.forts || []).filter(f => f.side !== side && f.hp > 0 && f.kind !== 'trench' || (f.side !== side && f.hp > 0 && f.hp / f.hpMax < 0.8)); if (!foeForts.length) return; const f = foeForts.slice().sort((p, q) => p.hp / p.hpMax - q.hp / q.hpMax)[0];
    const mine = [...V.blocks.values()].filter(o => o.side === side && o.type === 'inf' && o.role === 'line' && !o.garr && !o.d.plan && o.mode !== 'rout'); if (mine.length < 2 && f.hp / f.hpMax > 0.5) return;
    if (f.hp / f.hpMax > 0.7 && mine.length < 4) return; const dirF = f.side === 'A' ? 1 : -1, busy = [...V.blocks.values()].filter(o => o.side === side && o.d.plan && o.d.plan.fortAssault === f.id).length; if (busy >= 3) return;
    mine.sort((p, q) => Math.hypot(p.x - f.x, p.y - f.y) - Math.hypot(q.x - f.x, q.y - f.y)).slice(0, 2).forEach((m, i) => { m.d.plan = {k: 'flank', pts: [[f.x + dirF * (f.w / 2 + 16), f.y + (i ? 1 : -1) * 10], [f.x + dirF * (f.w / 2 - 10), f.y + (i ? 1 : -1) * 6]], i: 0, fortAssault: f.id}; m.skey = ''; });
    if (!V.banAs || V.t - V.banAs > 10) { V.banAs = V.t; bvBanner(V, `🪜 ${G.C[side === 'A' ? b.A0 : b.B0].name} lanza el asalto a ${FORT_KINDS[f.kind].n.toLowerCase()}`, side, ''); }
  });
};

// la guarnición se rinde (por asalto o porque el jugador iza la bandera): la cuarta parte prisionera, el resto huye
function tacForceSurrender(V, b, all, f) {
  const enemy = f.side === 'A' ? 'B' : 'A', regs = tacGarrisonOf(b, f).map(d => all.find(o => o.d === d)).filter(Boolean); let men = 0;
  regs.forEach(o => { men += o.d.s * MEN_PER_DIV * 0.25; o.d.s *= 0.6; o.d.o = 0; o.mode = 'rout'; o.mm = 0; o.brk = 8; }); b.pris = b.pris || {A: 0, B: 0}; b.pris[enemy] = (b.pris[enemy] || 0) + men; tacRelease(b, f); return men;
}
