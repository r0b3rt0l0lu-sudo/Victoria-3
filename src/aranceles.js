/* ===== ARANCELES Y GUERRAS COMERCIALES =====
   Por cada socio puedes fijar un arancel (0-3), concederle el estatus de nación más favorecida (NMF) o decretar un embargo.
   · Arancel L: ingresos extra (≈ +1 % de tus ingresos por nivel) y protección industrial (+0,3 % de producción por nivel, hasta 3 socios), pero las relaciones con ese país
     caen (−0,4 por nivel y mes), los pedidos comerciales le cuestan +12 % por nivel y a él le baja la producción (−0,25 % por nivel).
   · NMF: −10 % en los precios del comercio y +0,5 relaciones al mes. Embargo: prohíbe comerciar con él y empeora mucho las relaciones.
   · Represalias: los países de la IA a los que aplicas aranceles ≥2 contestan (25 %/mes) con un arancel de igual nivel. Si los dos tenéis ≥2 hay GUERRA COMERCIAL: ambos pierden
     producción adicional (−0,4 % por nivel) hasta que uno retire sus aranceles. */
const tarOf = c => c.tar || (c.tar = {});
const trLvl = (a, b) => ((G.C[a] && G.C[a].tar && G.C[a].tar[b]) || 0);
const _trPriceKT = trPriceK;
trPriceK = function (c, p) { let k = _trPriceKT(c, p); k *= 1 + 0.12 * trLvl(c.tag, p.tag); if (c.mfn && c.mfn[p.tag]) k *= 0.9; return clamp(k, 0.7, 1.9); };
const _trOrderT = trOrder;
trOrder = function (c, partnerTag, good, lots) { if (c.emb && c.emb[partnerTag]) return {ok: false, msg: 'Tienes decretado un embargo contra ese país.'}; if (G.C[partnerTag] && G.C[partnerTag].emb && G.C[partnerTag].emb[c.tag]) return {ok: false, msg: 'Ese país te ha impuesto un embargo.'}; return _trOrderT(c, partnerTag, good, lots); };
function tarWar(a, b) { return trLvl(a, b) >= 2 && trLvl(b, a) >= 2; }
function tarMonth(c) {
  if (!c.states.length) return; const T = c.tar || {}, rel = (a, b, d) => { try { addRel(a, b, d); } catch (e) { } };
  let hit = 0; G.tags.forEach(t => { if (t !== NONE && t !== c.tag) hit += Math.min(3, trLvl(t, c.tag)); }); c.tarHit = Math.min(6, hit);
  let rev = 0, prot = 0;
  for (const t in T) { const L = T[t]; if (!L || !alive(t)) continue; const P = G.C[t]; rev += c.stats.income * 0.01 * L; prot += L; rel(c.tag, t, -0.4 * L); rel(t, c.tag, -0.4 * L);
    if (P.ai && L >= 2 && trLvl(t, c.tag) < L && Math.random() < 0.25) { tarOf(P)[c.tag] = Math.min(3, (trLvl(t, c.tag)) + 1); if (c.tag === G.player) notify('diplo', `🛃 ${P.name} responde con aranceles a tus productos (nivel ${P.tar[c.tag]}).`); }
    if (tarWar(c.tag, t) && !c.twarSaid) { c.twarSaid = 1; if (c.tag === G.player) notify('crisis', `🛃 Guerra comercial con ${P.name}: ambos perdéis producción hasta que se retiren los aranceles.`); } }
  c.treasury += rev; c.tarProt = Math.min(3, prot); if (!Object.keys(T).some(t => tarWar(c.tag, t))) c.twarSaid = 0; c.tarWars = Object.keys(T).filter(t => tarWar(c.tag, t)).length;
  if (c.mfn) for (const t in c.mfn) if (c.mfn[t] && alive(t)) rel(c.tag, t, 0.5); if (c.emb) for (const t in c.emb) if (c.emb[t] && alive(t)) { rel(c.tag, t, -1.5); rel(t, c.tag, -1.5); }
}
const _navalMonthTar = navalMonth; navalMonth = function (c) { _navalMonthTar(c); tarMonth(c); };
const _recalcTar = recalcMods; recalcMods = function (c) { const m = _recalcTar(c); m.indOut += 0.003 * (c.tarProt || 0) - 0.0025 * (c.tarHit || 0) - 0.004 * (c.tarWars || 0); m.tax += 0.0015 * (c.tarProt || 0); return m; };
/* ---------- interfaz (en la ventana de Comercio) ---------- */
const _tradeRenderT = WINDOWS.trade.render;
WINDOWS.trade.render = function () {
  const h = _tradeRenderT.call(this), c = me(), T = tarOf(c); c.mfn = c.mfn || {}; c.emb = c.emb || {};
  const cand = G.tags.filter(t => t !== NONE && t !== c.tag && alive(t) && G.C[t].states.length).sort((a, b) => G.C[a].rank - G.C[b].rank).slice(0, 14);
  const row = t => { const L = T[t] || 0, back = trLvl(t, c.tag), war = tarWar(c.tag, t);
    return `<tr><td>${flag(t, 'sm')} ${G.C[t].name}${war ? ' <span class="bad" data-tip="Guerra comercial: ambos perdéis producción">⚔️</span>' : ''}</td><td class="r"><button data-act="tarset" data-t="${t}" data-d="-1" ${L <= 0 ? 'disabled' : ''}>−</button> <b>${L}</b> <button data-act="tarset" data-t="${t}" data-d="1" ${L >= 3 ? 'disabled' : ''}>＋</button></td><td class="r ${back ? 'bad' : ''}">${back || '—'}</td><td class="r"><input type="checkbox" data-act="tarmfn" data-t="${t}" ${c.mfn[t] ? 'checked' : ''}></td><td class="r"><input type="checkbox" data-act="taremb" data-t="${t}" ${c.emb[t] ? 'checked' : ''}></td></tr>`; };
  const card = `<div class="card"><h3>🛃 Aranceles y guerras comerciales</h3><table class="tbl"><thead><tr><th>País</th><th class="r">Tu arancel</th><th class="r">El suyo</th><th class="r" data-tip="Nación más favorecida: −10 % en precios y mejores relaciones">NMF</th><th class="r" data-tip="Embargo: prohíbe comerciar y empeora las relaciones">Embargo</th></tr></thead><tbody>${cand.map(row).join('')}</tbody></table>
    <div class="kv sm"><span>Protección industrial / aranceles que sufres</span><b>+${((c.tarProt || 0) * 0.3).toFixed(1)} % / −${((c.tarHit || 0) * 0.25).toFixed(1)} %</b></div><small class="dim">Un arancel da ingresos y protege tu industria, pero enfría las relaciones y encarece lo que compras. Si el otro país responde, hay guerra comercial.</small></div>`;
  return h.replace(/<\/div><\/div>\s*<div class="col"><div class="card"><h3>⚓ Convoyes/, '</div>' + card + '</div><div class="col"><div class="card"><h3>⚓ Convoyes');
};
Object.assign(ACT, {
  tarset: d => { const c = me(), T = tarOf(c); T[d.t] = clamp((T[d.t] || 0) + +d.d, 0, 3); if (!T[d.t]) delete T[d.t]; recalcMods(c); renderWindow(); },
  tarmfn: (d, el) => { const c = me(); (c.mfn = c.mfn || {})[d.t] = !!el.checked; },
  taremb: (d, el) => { const c = me(); (c.emb = c.emb || {})[d.t] = !!el.checked; if (el.checked) toast('🚫', `Embargo contra ${G.C[d.t].name}.`); }
});
