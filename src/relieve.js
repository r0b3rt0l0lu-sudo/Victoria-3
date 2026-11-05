/* ===== RELIEVE REAL: altitud y rugosidad de cada provincia (malla ELEV, ver tools/elevacion.py) ===== */
const ELEV_M = (() => { const a = atob(ELEV.m), u = new Uint8Array(a.length); for (let i = 0; i < a.length; i++) u[i] = a.charCodeAt(i); return u; })();
const ELEV_R = (() => { const a = atob(ELEV.r), u = new Uint8Array(a.length); for (let i = 0; i < a.length; i++) u[i] = a.charCodeAt(i); return u; })();
function elevAt(lon, lat) {         // interpolación bilineal: {h: metros, rough: desviación típica en metros}
  const fx = (lon + 180) / 360 * ELEV.w - 0.5, fy = (LAT_TOP - lat) / (LAT_TOP - LAT_BOT) * ELEV.h - 0.5, x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
  const g = (arr, i, j) => arr[clamp(j, 0, ELEV.h - 1) * ELEV.w + (((i % ELEV.w) + ELEV.w) % ELEV.w)];
  const bil = arr => (g(arr, x0, y0) * (1 - tx) + g(arr, x0 + 1, y0) * tx) * (1 - ty) + (g(arr, x0, y0 + 1) * (1 - tx) + g(arr, x0 + 1, y0 + 1) * tx) * ty;
  return {h: bil(ELEV_M) * 25, rough: bil(ELEV_R) * 10};
}
function provElev(pid) {
  const pv = MAP.provs[pid]; if (!pv) return {h: 100, rough: 40, cls: 'llanura', name: 'Llanura'};
  if (pv._elev) return pv._elev;
  const e = elevAt(pv.lon, pv.lat); let spread = 0;
  [[0.9, 0], [-0.9, 0], [0, 0.9], [0, -0.9]].forEach(([dx, dy]) => { spread = Math.max(spread, Math.abs(elevAt(pv.lon + dx, pv.lat + dy).h - e.h)); });
  const rough = Math.max(e.rough, spread * 0.5), cls = rough >= 300 || (e.h > 1800 && rough >= 180) ? 'montaña' : rough >= 150 ? 'colinas' : rough >= 55 ? 'ondulado' : 'llanura';
  return (pv._elev = {h: Math.round(e.h), rough: Math.round(rough), cls, name: {montaña: 'Montaña', colinas: 'Colinas', ondulado: 'Terreno ondulado', llanura: 'Llanura'}[cls]});
}
