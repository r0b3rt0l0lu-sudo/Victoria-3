/* ===== RANURAS DE GUARDADO: «Automático» (el de siempre, con su copia anterior) + 5 ranuras manuales =====
   Cada ranura es una partida comprimida independiente en localStorage (clave SAVE_KEY-slotN) con sus metadatos (país, fecha, tamaño, hora).
   Se abre con 💾 / 📂 (en partida) o con «Partidas guardadas» en la pantalla inicial. «Continuar» retoma la más reciente de todas. */
const SLOT_N = 5, slotKey = n => SAVE_KEY + '-slot' + n, slotMetaKey = n => slotKey(n) + '-meta';
function slotMeta(n) { try { return JSON.parse(localStorage.getItem(n ? slotMetaKey(n) : SAVE_META) || 'null'); } catch (e) { return null; } }
function slotHas(n) { try { return !!localStorage.getItem(n ? slotKey(n) : SAVE_KEY); } catch (e) { return false; } }
const slotAll = () => { const a = []; for (let n = 0; n <= SLOT_N; n++) a.push({n, has: slotHas(n), m: slotHas(n) ? slotMeta(n) : null}); return a; };
function latestSlot() { let best = 0, at = -1; slotAll().forEach(s => { if (s.has && ((s.m && s.m.at) || 0) > at) { at = (s.m && s.m.at) || 0; best = s.n; } }); return best; }
function latestMeta() { const n = latestSlot(); return slotHas(n) ? slotMeta(n) : null; }
hasSave = function () { return slotAll().some(s => s.has); };
async function readSlot(n) {
  let txt = null; try { txt = localStorage.getItem(slotKey(n)); } catch (e) { }
  if (!txt) return null; try { const raw = await unpackSave(txt); if (raw.trimStart()[0] !== '{') throw new Error('formato'); return {raw, from: 'ranura', slot: n}; } catch (e) { console.warn('ranura ilegible', n, e); return null; }
}
async function saveToSlot(n) {
  try {
    const raw = saveData(), packed = await packSave(raw);
    localStorage.setItem(slotKey(n), packed);
    localStorage.setItem(slotMetaKey(n), JSON.stringify({tag: G.player, y: G.date.y, m: G.date.m, d: G.date.d, name: G.C[G.player].name, size: packed.length, at: Date.now()}));
    toast('💾', `Guardada en la ranura ${n}: ${dateStr()} (${Math.round(packed.length / 1024)} KB)`); return true;
  } catch (e) { toast('⚠️', 'No se pudo guardar (' + (e.name || 'error') + '). Borra una ranura o exporta la partida a un archivo.'); return false; }
}
function deleteSlot(n) { try { localStorage.removeItem(slotKey(n)); localStorage.removeItem(slotMetaKey(n)); } catch (e) { } }
const agoTxt = at => { if (!at) return ''; const s = (Date.now() - at) / 1000; return s < 90 ? 'hace un momento' : s < 5400 ? 'hace ' + Math.round(s / 60) + ' min' : s < 129600 ? 'hace ' + Math.round(s / 3600) + ' h' : 'hace ' + Math.round(s / 86400) + ' días'; };
function closeSaves() { const e = document.getElementById('savesmodal'); if (e) e.remove(); document.removeEventListener('keydown', savesKey, true); }
function savesKey(e) { if (e.key === 'Escape') { e.stopPropagation(); closeSaves(); } }
function openSaves() {
  closeSaves(); const inGame = !!UI.started, latest = latestSlot();
  const rows = slotAll().map(s => {
    const m = s.m, title = s.n ? 'Ranura ' + s.n : 'Automático', last = s.has && s.n === latest;
    const info = s.has ? (m ? `${flag(m.tag, 'sm')}<span class="sv-i"><b>${m.name}</b><small>${m.d} de ${MESES[m.m] || ''} de ${m.y} · ${Math.round((m.size || 0) / 1024)} KB · ${agoTxt(m.at)}</small></span>` : '<span class="sv-i"><b>Partida guardada</b></span>') : '<span class="sv-i sv-empty"><b>Vacía</b><small>' + (s.n ? 'Guarda aquí tu partida actual' : 'Se guarda sola cada año') + '</small></span>';
    return `<div class="sv-row${s.has ? '' : ' empty'}${last ? ' last' : ''}"><div class="sv-n">${title}${last ? '<em>más reciente</em>' : ''}</div>${info}<div class="sv-b">${s.n && inGame ? `<button data-sv="save" data-n="${s.n}" data-tip="Guardar la partida actual aquí">💾 Guardar</button>` : ''}${s.has ? `<button data-sv="load" data-n="${s.n}" class="go">📂 Cargar</button>` : ''}${s.n && s.has ? `<button data-sv="del" data-n="${s.n}" data-tip="Borrar esta ranura">🗑</button>` : ''}</div></div>`;
  }).join('');
  const el = document.createElement('div'); el.id = 'savesmodal';
  el.innerHTML = `<div class="sv-box"><div class="sv-h"><h2>💾 Partidas guardadas</h2><button class="x" data-sv="close">✕</button></div><div class="sv-list">${rows}</div><div class="sv-f"><small>${inGame ? 'La partida se guarda sola cada año en «Automático».' : 'Elige una partida para retomarla.'}</small><span><button data-sv="export">📤 Exportar</button><button data-sv="import">📥 Importar</button></span></div></div>`;
  el.addEventListener('click', async e => {
    if (e.target === el) return closeSaves(); const b = e.target.closest('[data-sv]'); if (!b) return; const a = b.dataset.sv, n = +b.dataset.n;
    if (a === 'close') closeSaves();
    else if (a === 'export') exportSaveFile(); else if (a === 'import') { closeSaves(); importSaveFile(); }
    else if (a === 'save') { if (slotHas(n) && !confirm(`¿Sobrescribir la ranura ${n}?`)) return; if (await saveToSlot(n)) openSaves(); }
    else if (a === 'del') { if (confirm(`¿Borrar la ranura ${n}?`)) { deleteSlot(n); openSaves(); } }
    else if (a === 'load') { if (inGame && !confirm('¿Cargar esta partida? Se perderá el progreso no guardado.')) return; closeSaves(); doLoad(!inGame, n || 0); }
  });
  document.body.appendChild(el); document.addEventListener('keydown', savesKey, true);
}
ACT.save = () => openSaves(); ACT.load = () => openSaves(); ACT.saves = () => openSaves();
ACT.cont = () => { const n = latestSlot(); return doLoad(true, n || 0); };
function saveCardMore() { return '<button class="st-saves2" data-act="saves">💾 Partidas guardadas…</button>'; }
