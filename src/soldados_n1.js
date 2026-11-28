/* ===== SOLDADOS CON FICHA PROPIA (N1) =====
   Cada soldado que se dibuja en 3D tiene una ficha persistente durante la batalla (V.roster): nombre, empleo (teniente, sargento, cabo, soldado),
   cartuchos, moral propia, disparos y estado. La ficha se deduce de forma determinista del bloque, la figura y el hueco, así que el mismo soldado
   conserva nombre y empleo aunque salga del radio de IA y vuelva. La IA individual (npc_combate.js) la usa:
   · MUNICIÓN: cada disparo gasta un cartucho; sin cartuchos no dispara («¡Sin cartuchos!»).
   · MORAL: baja con el fuego que lo clava al suelo y con cada compañero que cae cerca (−0,07) y más aún si muere el oficial (−0,12 a todo el pelotón);
     se recupera despacio sin fuego y más cerca de un oficial vivo. Por debajo de 0,18 y clavado a tierra abandona el puesto («¡No aguanto más!»).
   · EMPLEOS: el oficial y los sargentos dan la voz de fuego (npcVolleyWait); su muerte se anuncia y cuesta moral.
   Interfaz (lienzo del campo, también en pantalla completa): brújula con marcas, ficha del soldado que miras, estado del pelotón y tu empleo. */
const B3N = {
  nombres: {
    ger: {n: ['Hans', 'Karl', 'Friedrich', 'Wilhelm', 'Johann', 'Georg', 'Ludwig', 'Otto', 'Heinrich', 'Franz', 'August', 'Emil', 'Paul', 'Max', 'Josef', 'Albrecht'], a: ['Müller', 'Schmidt', 'Weber', 'Fischer', 'Wagner', 'Becker', 'Hoffmann', 'Schulz', 'Koch', 'Richter', 'Klein', 'Wolf', 'Krüger', 'Neumann', 'Braun', 'Lange']},
    fra: {n: ['Jean', 'Pierre', 'Louis', 'Antoine', 'François', 'Étienne', 'Henri', 'Claude', 'Michel', 'Jacques', 'Émile', 'Joseph', 'Paul', 'André', 'Marcel', 'Lucien'], a: ['Martin', 'Bernard', 'Dubois', 'Moreau', 'Laurent', 'Simon', 'Michel', 'Lefèvre', 'Leroy', 'Roux', 'Fournier', 'Girard', 'Bonnet', 'Mercier', 'Blanc', 'Garnier']},
    ing: {n: ['William', 'John', 'George', 'Thomas', 'James', 'Henry', 'Charles', 'Edward', 'Robert', 'Samuel', 'Arthur', 'Frank', 'Albert', 'Harry', 'Walter', 'Joseph'], a: ['Smith', 'Jones', 'Taylor', 'Brown', 'Wilson', 'Evans', 'Walker', 'Wright', 'Hughes', 'Edwards', 'Turner', 'Hill', 'Cooper', 'Clarke', 'Baker', 'Ward']},
    rus: {n: ['Ivan', 'Pyotr', 'Nikolai', 'Aleksei', 'Dmitri', 'Sergei', 'Mikhail', 'Vasili', 'Fyodor', 'Grigori', 'Pavel', 'Yakov', 'Stepan', 'Andrei', 'Yegor', 'Timofei'], a: ['Ivanov', 'Petrov', 'Smirnov', 'Kuznetsov', 'Popov', 'Sokolov', 'Lebedev', 'Kozlov', 'Novikov', 'Morozov', 'Volkov', 'Orlov', 'Belov', 'Zaitsev', 'Pavlov', 'Titov']},
    esp: {n: ['Juan', 'José', 'Antonio', 'Manuel', 'Francisco', 'Luis', 'Miguel', 'Pedro', 'Ramón', 'Joaquín', 'Santiago', 'Fernando', 'Diego', 'Tomás', 'Pablo', 'Andrés'], a: ['García', 'Fernández', 'López', 'Martínez', 'Sánchez', 'Pérez', 'Gómez', 'Ruiz', 'Díaz', 'Hernández', 'Moreno', 'Muñoz', 'Álvarez', 'Romero', 'Navarro', 'Torres']},
    ita: {n: ['Giuseppe', 'Giovanni', 'Antonio', 'Luigi', 'Francesco', 'Angelo', 'Pietro', 'Carlo', 'Domenico', 'Salvatore', 'Mario', 'Paolo', 'Vincenzo', 'Enrico', 'Alberto', 'Rocco'], a: ['Rossi', 'Russo', 'Ferrari', 'Esposito', 'Bianchi', 'Romano', 'Colombo', 'Ricci', 'Marino', 'Greco', 'Bruno', 'Gallo', 'Conti', 'De Luca', 'Costa', 'Giordano']},
    jap: {n: ['Takeshi', 'Hiroshi', 'Kenji', 'Shigeru', 'Masao', 'Tadashi', 'Isamu', 'Yoshio', 'Minoru', 'Susumu', 'Akira', 'Ryo', 'Taro', 'Jiro', 'Saburo', 'Goro'], a: ['Sato', 'Suzuki', 'Takahashi', 'Tanaka', 'Watanabe', 'Ito', 'Yamamoto', 'Nakamura', 'Kobayashi', 'Kato', 'Yoshida', 'Yamada', 'Sasaki', 'Matsumoto', 'Inoue', 'Kimura']},
    usa: {n: ['John', 'William', 'James', 'George', 'Charles', 'Henry', 'Samuel', 'Jesse', 'Wyatt', 'Elijah', 'Josiah', 'Walter', 'Frank', 'Amos', 'Ezra', 'Cyrus'], a: ['Miller', 'Davis', 'Johnson', 'Anderson', 'Thompson', 'White', 'Harris', 'Martin', 'Jackson', 'Lee', 'Carter', 'Mitchell', 'Roberts', 'Campbell', 'Parker', 'Stewart']}
  },
  cultura: tag => ({PRU: 'ger', GER: 'ger', AUS: 'ger', BAV: 'ger', SAX: 'ger', HAN: 'ger', WUR: 'ger', FRA: 'fra', BEL: 'fra', GBR: 'ing', ENG: 'ing', UK: 'ing', IRE: 'ing', RUS: 'rus', POL: 'rus', ESP: 'esp', POR: 'esp', ITA: 'ita', SAR: 'ita', SIC: 'ita', JAP: 'jap', JPN: 'jap', USA: 'usa', CSA: 'usa', CAN: 'usa'}[tag] || ['ger', 'fra', 'ing', 'esp', 'ita'][(String(tag).charCodeAt(0) + String(tag).charCodeAt(1 % String(tag).length || 0)) % 5]),
  empleo: (fi, j) => fi === 0 && j === 0 ? 'Teniente' : (j === 0 ? 'Sargento' : (j === 5 ? 'Cabo' : 'Soldado'))
};
function b3V3Roster(blk, f, j) {
  const V = R.bviz; if (!V) return null; V.roster = V.roster || new Map(); const key = blk.id + ':' + f.i + ':' + j; let r = V.roster.get(key); if (r) return r;
  const h = k => hash2(blk.id * 131 + f.i, j, 500 + k), P = B3N.nombres[B3N.cultura(blk.tag)] || B3N.nombres.ger, ammoBase = {A: 38, B: 44, C: 70, D: 90, E: 100}[t3Era()] || 50;
  r = {key, bk: blk.id, name: P.n[(h(1) * P.n.length) | 0] + ' ' + P.a[(h(2) * P.a.length) | 0], rank: B3N.empleo(f.i, j), ammo: Math.round(ammoBase * (0.75 + h(3) * 0.4)), mor: 0.72 + h(4) * 0.28, shots: 0, kills: 0, dead: false, fled: 0};
  V.roster.set(key, r); return r;
}
// moral individual: el fuego sobre él la baja, el oficial vivo y el descanso la suben
function b3V3MoraleStep(s, blk, dt) {
  const r = s.r; if (!r || r.dead) return; let d = s.pin > 0 ? -0.04 : 0.012; if (!blk._offDead) d += 0.004; else d -= 0.003;
  if (blk.mm !== undefined) d += (blk.mm - 0.5) * 0.006; r.mor = Math.max(0, Math.min(1, r.mor + d * dt));
}
// bajas: marcan la ficha, contagian miedo a los vecinos y, si cae el oficial, a todo el pelotón
const _srKillNPCN1 = srKillNPC;
srKillNPC = function (S, V, key, p, fx, fz, lethal, tag) {
  const before = V.kmap && V.kmap[key]; _srKillNPCN1(S, V, key, p, fx, fz, lethal, tag); if (before) return;
  try {
    const r = V.roster && V.roster.get(key); if (r) { if (lethal) r.dead = true; else r.wounded = true; }
    SR2.all.forEach((q, k2) => { if (k2 === key || q.side !== p.side) return; if (Math.hypot(q.x - p.x, q.z - p.z) < 14) { const r2 = V.roster && V.roster.get(k2); if (r2) r2.mor = Math.max(0, r2.mor - (lethal ? 0.07 : 0.04)); } });
    if (r && r.rank === 'Teniente' && lethal && p.blk) { p.blk._offDead = true; V.roster.forEach(r3 => { if (r3.bk === r.bk) r3.mor = Math.max(0, r3.mor - 0.12); }); srBark(p.side, 'Sargento', '¡Han matado al teniente!', p.x, p.z, performance.now() / 1000); }
    else if (r && r.rank === 'Sargento' && lethal) srBark(p.side, 'Cabo', '¡Sargento caído!', p.x, p.z, performance.now() / 1000);
  } catch (e) { }
};
// al empezar el control, se crean las fichas de todo tu pelotón y tú te quedas con la tuya
const _ctrlStartN1 = ctrlStart;
ctrlStart = function () {
  _ctrlStartN1(); const c = SOLD.ctrl, V = R.bviz, blk = soldBlock(V); if (!c || !blk) return;
  blk.figs.forEach(f => { if (f.kind === 'gun' || !f.alive) return; for (let j = 0; j < (typeof B3_PER === 'number' ? B3_PER : 6); j++) b3V3Roster(blk, f, j); });
  const me = b3V3Roster(blk, {i: SOLD.fi}, SOLD.j); c.rec = me; c.nombre = me ? me.name : 'Soldado'; c.empleo = me ? me.rank : 'Soldado';
};
/* ---------- interfaz ---------- */
function b3V3HudN1(g, V) {
  const c = SOLD.ctrl, blk = soldBlock(V); if (!SOLD.on || !c || !blk) return;
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
  // brújula (arriba, centrada): E=0, S=π/2 (la z crece hacia el sur)
  { g.save(); g.translate(BV_W / 2, 96); g.scale(1.5, 1.5); g.translate(-BV_W / 2, -96); const w = 440, x0 = (BV_W - w) / 2, y0 = 96, h = 26, yaw = c.cyaw; g.fillStyle = 'rgba(12,18,26,.72)'; g.fillRect(x0, y0, w, h); g.strokeStyle = 'rgba(200,168,96,.7)'; g.lineWidth = 1.5; g.strokeRect(x0, y0, w, h);
    g.save(); g.beginPath(); g.rect(x0, y0, w, h); g.clip(); const X = a => { let d = ((a - yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI; return x0 + w / 2 + d / (Math.PI / 2) * (w / 2); };
    g.font = '700 14px serif'; g.textAlign = 'center'; for (let k = 0; k < 24; k++) { const a = k * Math.PI / 12, x = X(a); g.strokeStyle = 'rgba(232,216,168,.55)'; g.beginPath(); g.moveTo(x, y0 + h - (k % 3 ? 5 : 9)); g.lineTo(x, y0 + h); g.stroke(); }
    [['E', 0], ['S', Math.PI / 2], ['O', Math.PI], ['N', -Math.PI / 2]].forEach(([t, a]) => { g.fillStyle = t === 'N' ? '#e86a5a' : '#f2e6bf'; g.fillText(t, X(a), y0 + 15); });
    // marcas: objetivo de tu unidad, oficial, enemigo más próximo
    const mark = (x, z, col, sym) => { const a = Math.atan2(z - c.z, x - c.x); g.fillStyle = col; g.fillText(sym, X(a), y0 + 14); };
    let near = null, nd = 1e9; V.blocks.forEach(k => { if (k.side === blk.side || !k.figs.some(q => q.alive)) return; const d = Math.hypot(k.x - c.x, k.y - c.z); if (d < nd) { nd = d; near = k; } }); if (near) mark(near.x, near.y, '#ff7a6a', '▼');
    if (blk.foe) mark(blk.foe.x, blk.foe.y, '#ffb050', '◆'); const of = [...(V.roster || new Map()).values()].find(r => r.bk === blk.id && r.rank === 'Teniente' && !r.dead); if (of && SR2.all.get(of.key)) { const q = SR2.all.get(of.key); mark(q.x, q.z, '#f3d98c', '★'); }
    g.restore(); g.fillStyle = '#f3d98c'; g.beginPath(); g.moveTo(x0 + w / 2 - 6, y0 - 7); g.lineTo(x0 + w / 2 + 6, y0 - 7); g.lineTo(x0 + w / 2, y0); g.fill(); g.restore(); }
  // tu ficha y el estado del pelotón (abajo a la izquierda, sobre la orden activa)
  { const rs = [...(V.roster || new Map()).values()].filter(r => r.bk === blk.id), alive = rs.filter(r => !r.dead), am = alive.length ? alive.reduce((n, r) => n + r.ammo, 0) / alive.length : 0, mm = alive.length ? alive.reduce((n, r) => n + r.mor, 0) / alive.length : 0, x0 = 14, y0 = BV_H - 300, w = 262, h = 170; g.save(); g.translate(14, BV_H - 130); g.scale(1.5, 1.5); g.translate(-14, -(BV_H - 130));
    g.fillStyle = 'rgba(12,18,26,.8)'; g.fillRect(x0, y0, w, h); g.strokeStyle = 'rgba(200,168,96,.7)'; g.lineWidth = 1.5; g.strokeRect(x0, y0, w, h); g.textAlign = 'left';
    g.fillStyle = '#f3d98c'; g.font = '700 15px serif'; g.fillText(`${c.empleo || 'Soldado'} ${c.nombre || ''}`, x0 + 10, y0 + 22); g.fillStyle = '#c8b890'; g.font = '12px sans-serif'; g.fillText(`${blk.a ? blk.a.name : 'Pelotón'} · ${c.wnd ? 'HERIDO' : c.dead ? 'CAÍDO' : 'en pie'}`, x0 + 10, y0 + 40);
    const bar = (y, lab, v, col, txt) => { g.fillStyle = '#c8b890'; g.font = '12px sans-serif'; g.fillText(lab, x0 + 10, y + 11); g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(x0 + 92, y, 110, 11); g.fillStyle = col; g.fillRect(x0 + 92, y, 110 * Math.max(0, Math.min(1, v)), 11); g.fillStyle = '#f2e6bf'; g.fillText(txt, x0 + 208, y + 11); };
    bar(y0 + 50, 'Salud', c.hp, c.hp > 0.5 ? '#6fae74' : '#e3746c', Math.round(c.hp * 100) + '%'); bar(y0 + 68, 'Cartuchos', (c.rec ? c.rec.ammo : 0) / 60 || (c.mag + c.pouch) / 60, '#d9b55a', String(c.cap === 1 ? c.mag + c.pouch : `${c.mag}/${c.pouch}`));
    g.fillStyle = '#e8d8a8'; g.font = '700 12px serif'; g.fillText('PELOTÓN', x0 + 10, y0 + 104); g.fillStyle = '#f2e6bf'; g.font = '12px sans-serif';
    g.fillText(`En pie ${alive.length} · caídos ${rs.length - alive.length} (de ${rs.length})`, x0 + 10, y0 + 120); bar(y0 + 128, 'Munición', am / 60, '#d9b55a', Math.round(am)); bar(y0 + 146, 'Moral', mm, mm > 0.5 ? '#6fae74' : mm > 0.3 ? '#f0b462' : '#e3746c', Math.round(mm * 100) + '%'); g.restore(); }
  // ficha del soldado al que miras (amigo o enemigo, a menos de 60 u y dentro de ±7°)
  { let best = null, bd = 1e9; SR2.all.forEach((p, k) => { const dx = p.x - c.x, dz = p.z - c.z, d = Math.hypot(dx, dz); if (d > 60 || d < 1.5) return; let da = Math.atan2(dz, dx) - c.cyaw; da = Math.abs(((da + Math.PI * 3) % (Math.PI * 2)) - Math.PI); if (da > 0.12) return; const sc = d * (1 + da * 8); if (sc < bd) { bd = sc; best = {k, p, d}; } });
    if (!best) SOLD.visNew && SOLD.vis && SOLD.vis.forEach((p, k) => { const dx = p.x - c.x, dz = p.z - c.z, d = Math.hypot(dx, dz); if (d > 60 || d < 1.5) return; let da = Math.atan2(dz, dx) - c.cyaw; da = Math.abs(((da + Math.PI * 3) % (Math.PI * 2)) - Math.PI); if (da > 0.12) return; if (d < bd) { bd = d; best = {k, p: {x: p.x, z: p.z, side: p.blk && p.blk.side, blk: p.blk}, d}; } });
    if (best) { const mine = best.p.side === blk.side, r = V.roster && V.roster.get(best.k), x = BV_W / 2, y = BV_H / 2 + 56; g.save(); g.translate(x, y); g.scale(1.5, 1.5); g.translate(-x, -y);
      g.fillStyle = 'rgba(12,18,26,.8)'; g.fillRect(x - 118, y, 236, r && mine ? 50 : 36); g.strokeStyle = mine ? 'rgba(111,174,116,.8)' : 'rgba(227,116,108,.8)'; g.strokeRect(x - 118, y, 236, r && mine ? 50 : 36); g.textAlign = 'center'; g.fillStyle = mine ? '#9fd6a4' : '#ff9a8c'; g.font = '700 14px serif';
      g.fillText(mine && r ? `${r.rank} ${r.name}` : mine ? 'Camarada' : 'Enemigo', x, y + 17); g.fillStyle = '#c8b890'; g.font = '12px sans-serif'; g.fillText(`${Math.round(best.d * 0.6)} m${mine && r ? ` · ${r.ammo} cartuchos · moral ${Math.round(r.mor * 100)}%` : ''}`, x, y + (r && mine ? 34 : 31)); if (r && mine) { g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(x - 100, y + 40, 200, 4); g.fillStyle = r.mor > 0.5 ? '#6fae74' : '#e3746c'; g.fillRect(x - 100, y + 40, 200 * r.mor, 4); } g.restore(); } }
  g.restore();
}
const _b3FrameN1 = b3Frame;
b3Frame = function (V, b, g, lines, all) { const r = _b3FrameN1(V, b, g, lines, all); try { b3V3HudN1(g, V); } catch (e) { if (!B3N.err) { B3N.err = 1; console.warn('hud n1', e); } } return r; };

/* ===== modelos de infantería de Claude Design (infanteria3d.js): cada soldado se dibuja según su empleo y su variación personal ===== */
const B3VAR = {complexion: 1, barba: 0, pelo: 0, desgaste: 0};
function b3V3InfKind(blk, f, j, era, h1, h2) {
  if (!window.infanteria3d || blk.type !== 'inf') return null; const emp = B3N.empleo(f.i, j);
  let k = emp === 'Teniente' ? 'inf_teniente' : emp === 'Sargento' ? 'inf_sargento' : emp === 'Cabo' ? 'inf_cabo' : 'inf_soldado';
  if (emp === 'Soldado') { if (f.i === 1 && j === 1 && era < 'D') k = 'inf_tambor'; else if (f.i === 2 && j === 1 && era < 'D') k = 'inf_corneta'; else if (f.i === 4 && j === 3 && blk.tag === 'GBR' && era < 'C') k = 'inf_gaitero'; else if (blk.mode === 'skirmish' && j % 3 === 1) k = 'inf_jager'; else if (f.i === 5 && j === 2) k = 'inf_zapador'; }
  B3VAR.complexion = Math.floor(h1 * 3); B3VAR.barba = Math.floor(h2 * 5); B3VAR.pelo = Math.floor(hash2(blk.id * 7 + f.i, j, 21) * 6); B3VAR.desgaste = 0; _b3o.variacion = B3VAR;
  return k;
}
// el desgaste del uniforme (barro, polvo, sangre) crece con el tiempo y con las bajas del campo
setInterval(() => { try { const V = R.bviz; if (V && window.infanteria3d && infanteria3d.desgaste) infanteria3d.desgaste.value = Math.min(0.9, (V.t || 0) / 700 + (SR2.kills || 0) / 260); } catch (e) { } }, 1500);
