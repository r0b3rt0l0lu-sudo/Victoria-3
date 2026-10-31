/* ===== RENDIMIENTO: detección del equipo, perfil de calidad automático, prueba de velocidad y presupuesto de tiempo =====
   Pensado para equipos modestos (Chromebooks, portátiles con GPU integrada): al arrancar se detecta el hardware, se elige un perfil
   de calidad, se confirma con una breve medición de fotogramas reales y, durante la partida, la resolución se ajusta sola.
   Si el jugador cambia la calidad con el botón Q, su elección manda siempre. */
function hwProbe() {
  const ua = navigator.userAgent || '', cores = navigator.hardwareConcurrency || 2, mem = navigator.deviceMemory || 4;
  return {cros: /CrOS/.test(ua), android: /Android/.test(ua), cores, mem, dpr: window.devicePixelRatio || 1, webgpu: !!navigator.gpu, w: screen.width, h: screen.height, touch: navigator.maxTouchPoints > 1};
}
// ¿equipo modesto? (decidido antes de crear el contexto 3D: sirve para desactivar el antialiasing)
function lowSpecGuess() { const h = hwProbe(); return h.cros || h.android || h.mem <= 4 || h.cores <= 4; }
function gpuName() { try { const gl = R.renderer.getContext(), ext = gl.getExtension('WEBGL_debug_renderer_info'); return ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : String(gl.getParameter(gl.RENDERER)); } catch (e) { return ''; } }
// perfil por hardware: 'bajo' | 'medio' | 'alto'
function profileFor(h, gpu) {
  const g = (gpu || '').toLowerCase();
  if (/swiftshader|llvmpipe|software|basic render/.test(g)) return 'bajo';
  const weak = /intel.*(hd|uhd|graphics 5|graphics 6)|mali|adreno|powervr|videocore|apple gpu|vivante/.test(g) || h.mem <= 4 || h.cores <= 4 || h.cros;
  const strong = /(nvidia|geforce|rtx|gtx|radeon rx|radeon pro|apple m[0-9]|iris xe|arc )/.test(g) && h.cores >= 8 && h.mem >= 8 && !h.cros;
  return strong ? 'alto' : weak ? 'bajo' : 'medio';
}
const QRANK = {bajo: 0, medio: 1, alto: 2};
function applyQuality(q, why) {
  R.quality = q; R.lowEnd = q === 'bajo'; R.resScale = R.lowEnd ? Math.min(R.resScale || 1, 0.85) : 1;
  if (R.tex) R.tex.anisotropy = R.lowEnd ? 1 : Math.min(8, R.renderer.capabilities.getMaxAnisotropy());
  if (R.waterU && R.waterU.foamK) R.waterU.foamK.value = R.lowEnd ? 0 : 1;
  R.lod = -1; if (typeof resizeRenderer === 'function') resizeRenderer(); if (typeof updateTerrainLOD === 'function') updateTerrainLOD();
  if (typeof syncCamBtns === 'function') syncCamBtns(); R.dirty = true; R.labelsDirty = true;
  if (why && typeof toast === 'function') toast('🎞️', why);
}
// prueba de velocidad con fotogramas reales (se llama desde el bucle de dibujado en los primeros fotogramas)
function benchStart() { R.bench = {n: 0, ms: [], t0: performance.now()}; R.noAdapt = true; }
function benchSample(g) {
  const b = R.bench; if (!b) return; b.ms.push(g); if (++b.n < 14) return;
  const s = b.ms.slice(3).sort((x, y) => x - y), med = s[s.length >> 1]; R.bench = null; R.noAdapt = false; R.benchMs = med;
  const hw = hwProbe(), gpu = gpuName(), prof = profileFor(hw, gpu); let q = prof;
  if (med > 60) { q = 'bajo'; R.resScale = 0.6; } else if (med > 24) q = 'bajo'; else if (med > 11 && QRANK[q] > 1) q = 'medio'; else if (med < 5 && prof === 'medio' && hw.cores >= 6 && !hw.cros) q = 'medio';
  try { localStorage.setItem('victoria-autoq', JSON.stringify({q, gpu, med: Math.round(med), t: Date.now()})); } catch (e) {}
  if (!R.qualityManual) applyQuality(q, `Calidad gráfica ajustada automáticamente a «${q}» (${gpu ? gpu.replace(/\(.*?\)/g, '').slice(0, 38) : 'GPU'}; ${Math.round(med)} ms por fotograma). Puedes cambiarla con el botón Q.`);
  R.hw = {hw, gpu, prof, med};
}
// al arrancar: usa el resultado guardado si es reciente (y del mismo equipo); si no, mide
function autoQualityInit() {
  if (R.qualityManual || R._aqDone) return; R._aqDone = true;
  const hw = hwProbe(), gpu = gpuName(); R.hw = {hw, gpu, prof: profileFor(hw, gpu)};
  let saved = null; try { saved = JSON.parse(localStorage.getItem('victoria-autoq') || 'null'); } catch (e) {}
  if (saved && saved.gpu === gpu && Date.now() - saved.t < 14 * 864e5) { applyQuality(saved.q); return; }
  applyQuality(R.hw.prof); benchStart();
}
// presupuesto de tiempo de la simulación por fotograma: si los días tardan demasiado, el resto pasa al siguiente fotograma
const simBudgetMs = () => R.lowEnd ? 9 : 14;
// el dibujado se salta si la pestaña no está visible
const pageHidden = () => typeof document !== 'undefined' && document.hidden;
