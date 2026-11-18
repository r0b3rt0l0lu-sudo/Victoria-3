/* ===== ALMACÉN DE PARTIDAS: IndexedDB + autoguardado fiable =====
   Problema: las partidas (1–3 MB cada una comprimida) y sus copias (automática, copia anterior y 5 ranuras) se guardaban en localStorage, que solo admite ~5 MB por sitio:
   con varias ranuras y partidas avanzadas el guardado fallaba («No se pudo guardar»). Además el autoguardado solo ocurría cada 1 de enero y cerrar la pestaña perdía el progreso.
   · Los datos (gzip en base64) ahora se guardan en IndexedDB (cientos de MB); en localStorage solo quedan los metadatos y una marca `-idb`. Si IndexedDB no estuviera disponible se
     usa localStorage como antes. Las partidas antiguas en localStorage se siguen leyendo y se migran al guardarlas de nuevo.
   · Toda escritura se VERIFICA leyendo de vuelta (misma longitud) y avisa si falla.
   · AUTOGUARDADO: cada 3 meses de juego, cada 2 minutos reales (sin pausa) y al ocultar/cerrar la pestaña (mejor esfuerzo); conserva la copia anterior; indicador «💾 Autoguardado». */
const IDB_NAME = 'victoria-partidas', IDB_STORE = 'saves', idbMark = k => k + '-idb';
let _idbP = null;
function idbOpen() {
  if (_idbP) return _idbP;
  _idbP = new Promise((res, rej) => { try { if (!window.indexedDB) throw new Error('sin IndexedDB'); const r = indexedDB.open(IDB_NAME, 1); r.onupgradeneeded = () => r.result.createObjectStore(IDB_STORE); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error || new Error('idb')); r.onblocked = () => rej(new Error('idb bloqueada')); } catch (e) { rej(e); } });
  _idbP.catch(() => { _idbP = null; }); return _idbP;
}
const idbReq = (mode, fn) => idbOpen().then(db => new Promise((res, rej) => { const tx = db.transaction(IDB_STORE, mode), st = tx.objectStore(IDB_STORE), r = fn(st); tx.oncomplete = () => res(r && r.result); tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error || new Error('abortada')); }));
const idbGet = k => idbReq('readonly', st => st.get(k)), idbSet = (k, v) => idbReq('readwrite', st => st.put(v, k)), idbDel = k => idbReq('readwrite', st => st.delete(k));
const lsGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const lsSet = (k, v) => { localStorage.setItem(k, v); };
const lsDel = k => { try { localStorage.removeItem(k); } catch (e) { } };
// guarda `packed` bajo la clave k; devuelve 'idb' o 'ls'; lanza si no se pudo
async function storePut(k, packed) {
  try { await idbSet(k, packed); const back = await idbGet(k); if (back !== packed) throw new Error('verificación'); lsSet(idbMark(k), '1'); lsDel(k); return 'idb'; }
  catch (e) { console.warn('IndexedDB falló, se usa localStorage', e); }
  lsSet(k, packed); if (lsGet(k) !== packed) throw new Error('verificación'); lsDel(idbMark(k)); return 'ls';
}
async function storeGet(k) {
  if (lsGet(idbMark(k))) { try { const v = await idbGet(k); if (v) return v; } catch (e) { console.warn('lectura IndexedDB', e); } }
  return lsGet(k);
}
async function storeDel(k) { lsDel(k); lsDel(idbMark(k)); try { await idbDel(k); } catch (e) { } }
const storeHas = k => !!(lsGet(k) || lsGet(idbMark(k)));
slotHas = n => storeHas(n ? slotKey(n) : SAVE_KEY);
// --- autoguardado principal (con copia anterior)
writeSave = async function (raw, info) {
  const packed = await packSave(raw), prev = await storeGet(SAVE_KEY);
  await storePut(SAVE_KEY, packed);
  if (prev && prev !== packed) { try { await storePut(SAVE_PREV, prev); } catch (e) { await storeDel(SAVE_PREV); } }
  try { writeSaveMeta(info || JSON.parse(raw), packed.length); } catch (e) { }
  return packed.length;
};
readSave = async function () {
  for (const key of [SAVE_KEY, SAVE_PREV]) {
    const txt = await storeGet(key); if (!txt) continue;
    try { const raw = await unpackSave(txt); if (raw.trimStart()[0] !== '{') throw new Error('formato'); return {raw, from: key === SAVE_KEY ? 'principal' : 'copia anterior'}; } catch (e) { console.warn('guardado ilegible en', key, e); }
  }
  return null;
};
readSlot = async function (n) {
  const txt = await storeGet(slotKey(n)); if (!txt) return null;
  try { const raw = await unpackSave(txt); if (raw.trimStart()[0] !== '{') throw new Error('formato'); return {raw, from: 'ranura', slot: n}; } catch (e) { console.warn('ranura ilegible', n, e); return null; }
};
saveToSlot = async function (n) {
  try {
    const raw = saveData(), packed = await packSave(raw); await storePut(slotKey(n), packed);
    lsSet(slotMetaKey(n), JSON.stringify({tag: G.player, y: G.date.y, m: G.date.m, d: G.date.d, name: G.C[G.player].name, size: packed.length, at: Date.now()}));
    toast('💾', `Guardada en la ranura ${n}: ${dateStr()} (${Math.round(packed.length / 1024)} KB)`); return true;
  } catch (e) { toast('⚠️', 'No se pudo guardar (' + (e.name || e.message || 'error') + '). Borra una ranura o exporta la partida a un archivo.'); return false; }
};
deleteSlot = function (n) { storeDel(slotKey(n)); lsDel(slotMetaKey(n)); };
// --- aviso visual y programación del autoguardado
const AUTO = {busy: false, last: Date.now(), n: 0};
function autoInd(ok) {
  let e = document.getElementById('autosave-ind'); if (!e) { e = document.createElement('div'); e.id = 'autosave-ind'; e.style.cssText = 'position:fixed;left:12px;bottom:70px;z-index:9000;padding:4px 10px;border-radius:14px;background:rgba(20,26,32,.85);color:#e8e2d0;font:12px sans-serif;border:1px solid rgba(255,255,255,.2);opacity:0;transition:opacity .4s;pointer-events:none'; document.body.appendChild(e); }
  e.textContent = ok ? '💾 Autoguardado' : '⚠️ Autoguardado fallido'; e.style.opacity = '1'; clearTimeout(e._t); e._t = setTimeout(() => { e.style.opacity = '0'; }, ok ? 1600 : 5000);
}
async function autoSave(why) {
  if (AUTO.busy || !UI.started || !G.date) return; AUTO.busy = true;
  try { await writeSave(saveData(), {player: G.player, date: {y: G.date.y, m: G.date.m, d: G.date.d}}); AUTO.last = Date.now(); AUTO.n++; if (why !== 'hide') autoInd(true); }
  catch (e) { console.warn('autoguardado', e); if (why !== 'hide') autoInd(false); }
  finally { AUTO.busy = false; }
}
function autoSaveTick(monthly) { if (monthly && G.date.m % 3 !== 0) return; autoSave('mes'); }
setInterval(() => { if (UI.started && !G.paused && Date.now() - AUTO.last > 120000) autoSave('tiempo'); }, 15000);
document.addEventListener('visibilitychange', () => { if (document.hidden && UI.started) autoSave('hide'); });
window.addEventListener('pagehide', () => { if (UI.started) autoSave('hide'); });
// ajustes del guardado manual: mismo almacén y verificación
doSave = async function (silent) {
  try { const n = await writeSave(saveData(), {player: G.player, date: {y: G.date.y, m: G.date.m, d: G.date.d}}); AUTO.last = Date.now(); if (!silent) toast('💾', `Partida guardada: ${dateStr()} (${Math.round(n / 1024)} KB)`); }
  catch (e) { toast('⚠️', 'No se pudo guardar la partida (' + (e.name || e.message || 'error') + '). Exporta la partida a un archivo desde 💾 Partidas.'); }
};
// el estado de «hot-seat» y de guerra total se restablece tras cargar
const _loadDataAlm = loadData;
loadData = function (text) {
  const d = _loadDataAlm(text);
  if (G.hs && G.hs.tags) G.hs.tags.forEach(t => { if (G.C[t]) G.C[t].ai = false; });
  return d;
};
