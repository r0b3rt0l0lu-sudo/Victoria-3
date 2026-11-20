/* ===== ÁRBOL DE TECNOLOGÍAS =====
   Vista en árbol de la ventana de Tecnología: columnas por profundidad de dependencia, tres bandas (Producción · Sociedad · Militar), flechas
   entre requisitos coloreadas por estado, nodos con el color de su era, clic para investigar y tooltip con efectos. Conmutador Árbol/Lista. */
const TREE = {W: 176, H: 54, GX: 52, GY: 12, cache: null, sig: ''};
function treeLayout() {
  const sig = TECHS.length + '|' + TECHS.map(t => t.id).join('').length; if (TREE.cache && TREE.sig === sig) return TREE.cache; TREE.sig = sig;
  const depth = {}, dep = t => { if (depth[t.id] !== undefined) return depth[t.id]; depth[t.id] = 0; let d = 0; (t.req || []).forEach(r => { if (TECH[r]) d = Math.max(d, dep(TECH[r]) + 1); }); return depth[t.id] = d; };
  TECHS.forEach(dep); const maxD = Math.max(...Object.values(depth)), pos = {}; let y0 = 0; const bands = [];
  TECH_CATS.forEach(cat => {
    const list = TECHS.filter(t => t.cat === cat), row = {}; let rows = 0;
    for (let d = 0; d <= maxD; d++) {
      const col = list.filter(t => depth[t.id] === d); if (!col.length) continue;
      const bc = t => { const ps = (t.req || []).map(r => pos[r]).filter(Boolean); return ps.length ? ps.reduce((a, p) => a + p.row, 0) / ps.length : 1e3; };
      col.sort((a, b) => bc(a) - bc(b) || a.era - b.era); const used = new Set();
      col.forEach((t, i) => { let r = Math.max(0, Math.round(bc(t) === 1e3 ? i : bc(t))); while (used.has(r)) r++; used.add(r); pos[t.id] = {col: d, row: r, cat}; rows = Math.max(rows, r + 1); });
    }
    bands.push({cat, y0, rows}); y0 += rows + 0.7;
  });
  const out = {pos, bands, maxD, rowsTot: y0, depth}; TREE.cache = out; return out;
}
const TREE_ERA_COL = ['#7a8a9a', '#6aa3d8', '#7fc08a', '#e0b24e', '#d96a5a'];
function treeHtml(c) {
  const L = treeLayout(), {W, H, GX, GY} = TREE, px = id => L.pos[id].col * (W + GX) + 10, py = id => { const b = L.bands.find(b => b.cat === L.pos[id].cat); return (b.y0 + L.pos[id].row) * (H + GY) + 30; };
  const width = (L.maxD + 1) * (W + GX) + 20, height = L.rowsTot * (H + GY) + 40;
  let lines = '', nodes = '', labels = '';
  L.bands.forEach(b => { labels += `<div class="tt-band" style="top:${b.y0 * (H + GY) + 6}px">${b.cat}</div><div class="tt-bandline" style="top:${b.y0 * (H + GY) + 28}px;width:${width}px"></div>`; });
  TECHS.forEach(t => {
    const stt = techStatus(c, t), now = c.research === t.id;
    (t.req || []).forEach(r => { if (!L.pos[r]) return; const x1 = px(r) + W, y1 = py(r) + H / 2, x2 = px(t.id), y2 = py(t.id) + H / 2, mx = (x1 + x2) / 2;
      const col = c.techs.has(r) && c.techs.has(t.id) ? '#6fcf7a' : c.techs.has(r) ? '#e2c05c' : '#4a5668';
      lines += `<path d="M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}" stroke="${col}" stroke-width="${c.techs.has(r) ? 2.2 : 1.4}" fill="none" opacity="${c.techs.has(r) ? 0.95 : 0.55}"/>`; });
    const cls = stt.k === 'done' ? 'done' : now ? 'now' : stt.k === 'avail' ? 'avail' : 'lock';
    const tip = `<b>${t.name}</b> · Era ${t.era}<br>${t.desc}<br>${fxText(t.fx)}${stt.why ? '<br><i>' + stt.why + '</i>' : ''}`.replace(/"/g, '&quot;');
    nodes += `<div class="tt-node ${cls} ${stt.k === 'obsolete' || stt.k === 'excl' ? 'obs' : ''}" style="left:${px(t.id)}px;top:${py(t.id)}px;width:${W}px;height:${H}px;border-left-color:${TREE_ERA_COL[t.era] || '#888'}" data-tip="${tip}" ${stt.k === 'avail' && !now ? `data-act="research" data-id="${t.id}"` : ''}><b>${stt.k === 'done' ? '✔ ' : ''}${t.ex ? '⚖ ' : ''}${t.until && stt.k !== 'done' ? '⏳ ' : ''}${t.name}</b><small>${stt.k === 'done' ? 'Completada' : now ? '⏳ En curso' : stt.k === 'avail' ? '💡 ' + techCost(c, t) : stt.k === 'year' ? '📅 ' + t.after : stt.k === 'era' ? '🔒 Era ' + t.era : '🔒'}</small></div>`;
  });
  return `<style>.tt-top{display:flex;flex-wrap:wrap;gap:6px 18px;align-items:center;font-size:13px;margin-bottom:4px}.tt-era{padding:1px 8px;border-radius:10px;background:rgba(255,255,255,.08)}.tt-era.lk{opacity:.6}.tt-wrap{overflow:auto;height:calc(100vh - 330px);min-height:320px;border:1px solid rgba(255,255,255,.1);border-radius:8px;background:rgba(0,0,0,.2);position:relative}.tt-in{position:relative}
  .tt-node{position:absolute;box-sizing:border-box;border:1px solid rgba(255,255,255,.14);border-left:5px solid #888;border-radius:6px;background:rgba(20,28,40,.92);padding:5px 8px;overflow:hidden;line-height:1.2}
  .tt-node b{display:block;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.tt-node small{font-size:11px;opacity:.8}
  .tt-node.avail{cursor:pointer;border-color:#e2c05c;box-shadow:0 0 8px rgba(226,192,92,.35)}.tt-node.avail:hover{background:rgba(60,50,20,.95)}.tt-node.done{background:rgba(30,70,40,.9)}.tt-node.now{border-color:#7ac0ff;box-shadow:0 0 10px rgba(122,192,255,.6);animation:ttp 1.6s infinite}.tt-node.lock{opacity:.55}.tt-node.obs{opacity:.35;text-decoration:line-through}
  @keyframes ttp{50%{box-shadow:0 0 16px rgba(122,192,255,.9)}}.tt-band{position:absolute;left:10px;font:700 14px var(--head,sans-serif);letter-spacing:.1em;color:var(--gold,#d8b45a);text-transform:uppercase}.tt-bandline{position:absolute;left:0;height:1px;background:rgba(255,255,255,.12)}
  .tt-leg{display:flex;gap:12px;flex-wrap:wrap;font-size:12px;margin:6px 0}.tt-leg i{display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:4px}</style>
  <div class="tt-leg"><span><i style="background:#e2c05c"></i>Disponible</span><span><i style="background:#2e6a3c"></i>Completada</span><span><i style="background:#7ac0ff"></i>En curso</span><span><i style="background:#4a5668"></i>Bloqueada</span>${[1, 2, 3, 4].map(e => `<span><i style="background:${TREE_ERA_COL[e]}"></i>Era ${e}</span>`).join('')}</div>
  <div class="tt-wrap scrollable" id="tt-wrap"><div class="tt-in" style="width:${width}px;height:${height}px"><svg width="${width}" height="${height}" style="position:absolute;left:0;top:0">${lines}</svg>${labels}${nodes}</div></div>`;
}
UI.techView = UI.techView || 'tree';
const _techRender = WINDOWS.tech.render;
WINDOWS.tech.render = function () {
  const base = _techRender.call(this); const c = me();
  const sw = `<div class="btnrow" style="margin:6px 0"><button data-act="techview" data-v="tree" class="${UI.techView === 'tree' ? 'on' : ''}">🌳 Árbol</button><button data-act="techview" data-v="list" class="${UI.techView === 'list' ? 'on' : ''}">📋 Lista</button></div>`;
  if (UI.techView !== 'tree') return sw + base;
  const st = c.stats, cur = c.research ? TECH[c.research] : null;
  const head = `<div class="tt-top"><span>💡 <b>${Math.floor(c.innovStock)}</b> <small>(+${f1(st.innovRate)}/sem)</small></span>${cur ? `<span>Investigando: <b>${cur.name}</b> · ${Math.min(100, Math.floor(c.innovStock / techCost(c, cur) * 100))}% <button data-act="cancelresearch">✕</button></span>` : '<span class="dim">Nada en investigación: elige una tecnología dorada.</span>'}<span>✔ ${c.techs.size} / ${TECHS.length}</span>${[1, 2, 3, 4].map(e => `<span class="tt-era ${eraUnlocked(c, e) ? '' : 'lk'}" data-tip="${eraUnlocked(c, e) ? 'Era desbloqueada' : 'Año ' + ERAS[e].needYear + ' y ' + ERAS[e].needPrev + ' tecnologías de la era anterior (' + eraCount(c, e - 1) + ')'}">${eraUnlocked(c, e) ? '' : '🔒'}Era ${e}: ${eraCount(c, e)}/${TECHS.filter(t => t.era === e).length}</span>`).join('')}</div>`;
  const eras = '';
  return sw + head + eras + treeHtml(c);
};
Object.assign(ACT, {techview: d => { UI.techView = d.v; renderWindow(true); }});
