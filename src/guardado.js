/* ===== GUARDADO: comprimido (gzip) con copia de seguridad ===== 
   La partida crece ~35 KB por año de juego y en texto plano rozaría el límite de localStorage (~5 MB) hacia 1920. Comprimida ocupa ~1/5.
   Se conserva además la partida anterior (SAVE_KEY + '-prev'): si el guardado nuevo estuviera dañado, se recupera la anterior. */
const SAVE_PREV = SAVE_KEY + '-prev', GZ_TAG = 'gz1:';
async function gzipB64(text) {
  const buf = new Uint8Array(await new Response(new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer()); let s = '';
  for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000)); return btoa(s);
}
async function gunzipB64(b64) { const bin = Uint8Array.from(atob(b64), c => c.charCodeAt(0)); return await new Response(new Blob([bin]).stream().pipeThrough(new DecompressionStream('gzip'))).text(); }
async function packSave(raw) { try { if (typeof CompressionStream !== 'undefined') return GZ_TAG + await gzipB64(raw); } catch (e) { console.warn('gzip', e); } return raw; }
async function unpackSave(txt) { if (txt && txt.slice(0, GZ_TAG.length) === GZ_TAG) return await gunzipB64(txt.slice(GZ_TAG.length)); return txt; }
const SAVE_META = SAVE_KEY + '-meta';
// datos de la partida para la tarjeta «Continuar» de la pantalla inicial (sin tener que descomprimirla)
function writeSaveMeta(info, size) { try { localStorage.setItem(SAVE_META, JSON.stringify({tag: info.player, y: info.date.y, m: info.date.m, d: info.date.d, name: G.C && G.C[info.player] ? G.C[info.player].name : info.player, size, at: Date.now()})); } catch (e) { } }
async function writeSave(raw, info) {
  const packed = await packSave(raw); let prev = null; try { prev = localStorage.getItem(SAVE_KEY); } catch (e) { }
  try { localStorage.setItem(SAVE_KEY, packed); } catch (e) { try { localStorage.removeItem(SAVE_PREV); localStorage.setItem(SAVE_KEY, packed); } catch (e2) { throw e2; } }       // sin sitio: se sacrifica la copia anterior
  if (prev && prev !== packed) { try { localStorage.setItem(SAVE_PREV, prev); } catch (e) { try { localStorage.removeItem(SAVE_PREV); } catch (e2) { } } }
  try { writeSaveMeta(info || JSON.parse(raw), packed.length); } catch (e) { }
  return packed.length;
}
// lee la partida (o la copia anterior si la principal está dañada) y la devuelve como texto JSON
async function readSave() {
  for (const key of [SAVE_KEY, SAVE_PREV]) {
    let txt = null; try { txt = localStorage.getItem(key); } catch (e) { }
    if (!txt) continue; try { const raw = await unpackSave(txt); if (raw.trimStart()[0] !== '{') throw new Error('formato'); return {raw, from: key === SAVE_KEY ? 'principal' : 'copia anterior'}; } catch (e) { console.warn('guardado ilegible en', key, e); }
  }
  return null;
}
doSave = async function (silent) {
  try { const n = await writeSave(saveData(), {player: G.player, date: {y: G.date.y, m: G.date.m, d: G.date.d}}); if (!silent) toast('💾', `Partida guardada: ${dateStr()} (${Math.round(n / 1024)} KB)`); }
  catch (e) { toast('⚠️', 'No se pudo guardar la partida (' + (e.name || 'error') + '). Libera espacio del navegador o exporta la partida.'); }
};
doLoad = async function (fromStart, slot) {
  const s = slot ? await readSlot(slot) : await readSave(); if (!s) { toast('⚠️', 'No hay ninguna partida guardada.'); return; }
  try { loadData(s.raw); } catch (e) {
    console.error(e); let ok = false;
    if (s.from === 'principal' && !s.slot) { try { const t = localStorage.getItem(SAVE_PREV); if (t) { loadData(await unpackSave(t)); ok = true; toast('♻️', 'La partida principal estaba dañada: se ha recuperado la copia anterior.'); } } catch (e2) { console.error(e2); } }
    if (!ok) { toast('⚠️', 'La partida guardada no se pudo cargar.'); return; }
  }
  UI.started = true; UI.sel = null; UI.win = null; closeWindow(); R.startHi = null; document.body.classList.remove('starting');
  $('#start').classList.add('hide'); setTimeout(() => $('#start').style.display = 'none', 600);
  $('#hud').classList.add('show');
  buildHud(); computeEdges(G.ownerOf); computeLabels(); setSelected(-1); renderStatePanel(); updateHud();
  const c = me(); focusState(c.capital >= 0 ? c.capital : c.states[0], 60); fullRepaint();
  if (s.from !== 'principal' && !s.slot) toast('♻️', 'Cargada la copia anterior de la partida.');
  toast('📂', 'Partida cargada: ' + dateStr());
};
// exportar / importar la partida como archivo (copia fuera del navegador)
async function exportSaveFile() {
  const raw = saveData(), blob = new Blob([await packSave(raw)], {type: 'text/plain'}), a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `victoria-${G.date.y}-${G.date.m + 1}.sav`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
function importSaveFile() {
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.sav,.txt,.json';
  inp.onchange = async () => { const f = inp.files && inp.files[0]; if (!f) return; try { const raw = await unpackSave(await f.text()); if (raw.trimStart()[0] !== '{') throw new Error('formato'); await writeSave(raw, JSON.parse(raw)); toast('📥', 'Partida importada. Pulsa «Continuar» o «Cargar».'); doLoad(); } catch (e) { toast('⚠️', 'El archivo no es una partida válida.'); } };
  inp.click();
}
ACT.exportsave = () => exportSaveFile(); ACT.importsave = () => importSaveFile();

// tarjeta de la pantalla inicial: qué partida se retomará
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
function saveCardHtml() {
  if (!hasSave()) return '';
  let m = null; try { m = (typeof latestMeta === 'function' && latestMeta()) || JSON.parse(localStorage.getItem(SAVE_META) || 'null'); } catch (e) { }
  const prev = (() => { try { return !!localStorage.getItem(SAVE_PREV); } catch (e) { return false; } })();
  const info = m ? `<b>${m.name}</b><small>${m.d} de ${MESES[m.m] || ''} de ${m.y} · ${Math.round((m.size || 0) / 1024)} KB${prev ? ' · con copia de seguridad' : ''}</small>` : '<b>Partida guardada</b><small>Retoma donde lo dejaste</small>';
  return `<button class="st-save" data-act="cont" data-tip="Retoma tu última partida guardada"><span class="st-save-ic">📂</span><span class="st-save-t"><em>Continuar partida</em>${info}</span><span class="st-save-go">▶</span></button>${typeof saveCardMore === 'function' ? saveCardMore() : ''}`;
}
