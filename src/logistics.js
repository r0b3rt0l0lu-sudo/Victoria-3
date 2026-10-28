/* ===== SUMINISTRO, CERCOS, CANSANCIO DE GUERRA Y CAPITULACIÓN ===== */
// Cada país tiene una red de suministro que parte de su capital y sus puertos y se expande por las provincias que controla.
// Los ejércitos fuera de la red (o rodeados) pierden organización y fuerza, y acaban rindiéndose.
const SUPPLY_EVERY = 3;
const controlled = (tag, pid) => { const by = G.P[pid].by; if (by) return sameSide(tag, by); const o = provOwner(pid); return o !== NONE && (o === tag || sameSide(tag, o)); };
function provCap(pid, tag) {         // capacidad de divisiones que la provincia puede abastecer
  const s = G.S[provState(pid)], own = controlled(tag, pid);
  return (own ? 6 : 3.5) + 1.6 * Math.min(5, s.infra || 0) + (MAP.provs[pid].port ? 2 : 0);
}
function computeSupply(tag) {
  const c = G.C[tag], lvl = new Map(), heap = [];
  const push = it => { heap.push(it); let i = heap.length - 1; while (i > 0) { const q = (i - 1) >> 1; if (heap[q][0] >= heap[i][0]) break; [heap[q], heap[i]] = [heap[i], heap[q]]; i = q; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { let k = i * 2 + 1; if (k >= heap.length) break; if (k + 1 < heap.length && heap[k + 1][0] > heap[k][0]) k++; if (heap[k][0] <= heap[i][0]) break; [heap[k], heap[i]] = [heap[i], heap[k]]; i = k; } } return top; };
  const seed = (pid, v) => { if (v > (lvl.get(pid) || 0)) { lvl.set(pid, v); push([v, pid, 0]); } };
  if (c.capital >= 0 && G.S[c.capital].owner === tag) { const cp = stateCapitalProv(c.capital); if (controlled(tag, cp)) seed(cp, 1); }
  c.states.forEach(sid => MAP.stats[sid].provs.forEach(pid => { if (MAP.provs[pid].port && controlled(tag, pid)) seed(pid, 0.85); }));
  // los aliados de la misma guerra comparten sus capitales
  if (!heap.length) {      // sin capital ni puertos controlados: se improvisa un centro de suministro en el estado más poblado
    let best = null, bp = -1; c.states.forEach(sid => { const s = G.S[sid]; MAP.stats[sid].provs.forEach(pid => { if (controlled(tag, pid) && s.popBase > bp) { bp = s.popBase; best = pid; } }); });
    if (best !== null) seed(best, 0.7);
  }
  const done = new Set();
  while (heap.length) {
    const [v, pid, out] = pop(); if (done.has(pid) || v < (lvl.get(pid) || 0)) continue; done.add(pid);
    const here = controlled(tag, pid);
    MAP.provs[pid].nb.forEach(q => {
      const qc = controlled(tag, q), s = G.S[provState(q)];
      let nv, no = out;
      if (qc && here) nv = v - 0.07 / (1 + 0.22 * Math.min(5, s.infra || 0));
      else { no = here ? 1 : out + 1; if (no > 3) return; nv = v - (here ? 0.28 : 0.3); }
      if (nv > (lvl.get(q) || 0) && nv > 0.01) { lvl.set(q, nv); push([nv, q, no]); }
    });
  }
  G.sup = G.sup || {}; G.sup[tag] = {t: G.date.t, m: lvl};
  return lvl;
}
function supplyAt(tag, pid) { const s = G.sup && G.sup[tag]; return s ? (s.m.get(pid) || 0) : 1; }
const supplyMod = a => { const s = a.sup === undefined ? 1 : a.sup; return s >= 0.6 ? 1 : 0.6 + s * 0.66; };
function supplyDay() {
  const tags = new Set(); G.armies.forEach(a => tags.add(a.tag));
  let idx = 0;
  tags.forEach(t => { if (!G.sup || !G.sup[t] || (G.date.t + idx) % SUPPLY_EVERY === 0) computeSupply(t); idx++; });
  const cnt = {};
  G.armies.forEach(a => { const k = a.tag + '|' + a.loc; cnt[k] = (cnt[k] || 0) + a.divs.length; });
  const dead = [];
  G.armies.forEach(a => {
    let l = supplyAt(a.tag, a.loc); const n = cnt[a.tag + '|' + a.loc], cap = provCap(a.loc, a.tag);
    if (n > cap) l *= cap / n;
    a.sup = a.sup === undefined ? l : a.sup * 0.6 + l * 0.4;
    if (a.sup < 0.5) {
      const def = 0.5 - a.sup, k = a.sup < 0.15 ? 3 : 1;
      a.divs.forEach(d => { d.o = Math.max(0, d.o - DIVS[d.t].org * def * 0.03 * k); d.s = Math.max(0, d.s - def * 0.004 * k); });
      a.divs = a.divs.filter(d => d.s > 0.04); if (!a.divs.length) { a._dead = true; return; }
    }
    // cerco: sin suministro durante semanas -> rendición
    if (l < 0.06 && !a.battle && hostileHere(a)) {
      a.cut = (a.cut || 0) + 1;
      if (a.cut === 12 && a.tag === G.player) notify('war', `¡${a.name} está aislado y sin suministros en ${provName(a.loc)}! Rompe el cerco o se rendirá.`, provState(a.loc));
      if (a.cut >= 24) dead.push(a);
    } else a.cut = Math.max(0, (a.cut || 0) - 2);
  });
  dead.forEach(a => {
    const foe = armiesAt(a.loc).find(o => hostileTags(a.tag, o.tag)) || null;
    G.wars.forEach(w => { const wa = foe && w.attAll.includes(foe.tag) && w.defAll.includes(a.tag), wd = foe && w.defAll.includes(foe.tag) && w.attAll.includes(a.tag); if (wa || wd) { w.bw = w.bw || {att: 0, def: 0}; w.bw[wa ? 'att' : 'def'] += 2; } });
    const c = G.C[a.tag]; c.cnt = c.cnt || {}; c.cnt.surrendered = (c.cnt.surrendered || 0) + a.divs.length; c.wearV = (c.wearV || 0) + 1.5; c.prestige = Math.max(0, c.prestige - 2);
    if (a.tag === G.player || (foe && foe.tag === G.player)) notify('war', `${a.name} (${c.name}) se rinde cercado en ${provName(a.loc)}.`, provState(a.loc));
    a._dead = true;
  });
  if (G.armies.some(a => a._dead)) { G.armies = G.armies.filter(a => !a._dead); G.battles = G.battles.filter(b => b.A.some(armyById) && b.B.some(armyById)); }
}
const equipMod = () => 1;
// solo se considera cercado al ejército sin suministro que está en territorio enemigo o junto a tropas enemigas
function hostileHere(a) {
  const o = provOwner(a.loc), by = G.P[a.loc].by;
  if ((o !== NONE && hostileTags(a.tag, o)) || (by && hostileTags(a.tag, by))) return true;
  return MAP.provs[a.loc].nb.some(q => armiesAt(q).some(e => hostileTags(a.tag, e.tag))) || armiesAt(a.loc).some(e => hostileTags(a.tag, e.tag));
}

/* ---------- cansancio de guerra ---------- */
function warWearMonth(c) {
  c.wear = c.wear || 0;
  c.wear += (c.wearV || 0) + (c.wars.length ? 0.9 : -2.5); c.wearV = 0;
  c.wear = clamp(c.wear, 0, 100);
  const w = c.wear;
  if (w > 35) { c.legitimacy -= (w - 35) * 0.012; c.radicals = Math.min(0.9, c.radicals + (w - 35) * 0.00015); }
  if (w > 60 && c.stats.indLevels > 4 && Math.random() < 0.012 * (w - 55) / 10 * diffP().crisis && !G.crises.some(x => x.type === 'riots' && x.scope === c.tag)) addCrisis('riots', c.tag, {name: 'Motines contra la guerra'});
}
const wearK = c => 1 - 0.0015 * (c.wear || 0);

/* ---------- capitulación ---------- */
function occShare(tag, enemies) {
  const c = G.C[tag]; let occ = 0, tot = 0;
  c.states.forEach(id => { const s = G.S[id]; tot += s.popBase + 1; if (s.occ > 0 && s.occBy && enemies.includes(s.occBy)) occ += (s.popBase + 1) * s.occ; });
  return tot ? occ / tot : 0;
}
function capitalLost(tag, enemies) { const c = G.C[tag]; const s = G.S[c.capital]; return !!(s && s.owner === tag && s.occ >= 1 && enemies.includes(s.occBy)); }
// devuelve true si la guerra termina por capitulación del líder de un bando
function capitulationCheck(w) {
  for (const [lead, mine, theirs, winner] of [[w.def, w.defAll, w.attAll, w.att], [w.att, w.attAll, w.defAll, w.def]]) {
    const c = G.C[lead], sh = occShare(lead, theirs), cap = capitalLost(lead, theirs);
    const cond = (cap && sh > 0.4) || sh > 0.68 || ((c.wear || 0) >= 97 && sh > 0.2);
    if (!cond) { w['capT' + lead] = 0; continue; }
    w['capT' + lead] = (w['capT' + lead] || 0) + 1;
    if (!c.ai && w['capT' + lead] === 1) notify('war', `¡Tu situación es desesperada! ${sh > 0.5 ? 'Más de la mitad' : 'Gran parte'} de tu país está ocupado${cap ? ' y has perdido la capital' : ''}. Si no cambia en 3 semanas, capitularás.`, c.capital);
    if (w['capT' + lead] >= (c.ai ? 2 : 4)) {
      notify('war', `¡${c.name} capitula! ${G.C[winner].name} gana la guerra.`, c.capital);
      c.wear = Math.max(0, (c.wear || 0) - 30); c.legitimacy -= 10; cnt(G.C[winner], 'capitulations');
      endWar(w, winner); return true;
    }
  }
  return false;
}
