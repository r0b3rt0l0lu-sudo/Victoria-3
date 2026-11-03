// Evalúa la IA: parte del mundo de una época, pone todos los países en manos de la IA y mide durante N años.
// Uso: node tools/evaluar_ia.js <html> <época 1836|1910> <años> <semilla>
const { chromium } = require('playwright'); const path = require('path');
(async () => {
  const file = path.resolve(process.argv[2]), epoch = +process.argv[3] || 1836, years = +process.argv[4] || 12, seed = +process.argv[5] || 1;
  const browser = await chromium.launch({args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl']});
  const page = await browser.newPage({viewport: {width: 1200, height: 700}}); const errs = []; page.on('pageerror', e => errs.push(e.message.slice(0, 160)));
  await page.addInitScript(s => { let x = s * 2654435761 >>> 0; Math.random = () => { x = (x + 0x6D2B79F5) >>> 0; let t = x; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }, seed);
  await page.goto('file://' + file); await page.waitForSelector('#start .st-card', {timeout: 120000});
  if (epoch !== 1836) { await page.click(`[data-act=scen][data-y="${epoch}"]`); await page.waitForFunction(yy => G.date.y === yy && !UI.scenBusy, epoch, {timeout: 120000}); await page.waitForTimeout(500); }
  await page.click('.st-card[data-tag=GBR]'); await page.click('button[data-act=start]'); await page.waitForTimeout(800);
  await page.evaluate(() => { G.paused = true; G.tags.forEach(t => { G.C[t].ai = true; });
    const E = window._ev = {wars: [], far: 0, caps: 0, cas0: 0}; const o = endWarCore; window.endWarCore = function (w, winner, preset) { E.wars.push({att: w.att, def: w.def, win: winner === null ? 'draw' : winner === w.att ? 'att' : 'def', cb: w.cb, w: w.weeks}); return o.apply(this, arguments); };
    const dist = (a, b) => { const dl = Math.min(Math.abs(a[0] - b[0]), 360 - Math.abs(a[0] - b[0])); return Math.hypot(dl, a[1] - b[1]); }, ll = id => { const p = MAP.provs[stateCapitalProv(id)]; return [p.lon, p.lat]; };
    const COL = ['GBR', 'FRA', 'NET', 'POR', 'SPA', 'BEL', 'RUS', 'USA', 'PRU', 'AUS', 'JAP', 'SAR'];
    const t0 = transferState; window.transferState = function (s, tag) { const old = s.owner; const r = t0.apply(this, arguments); if (old !== NONE && tag !== NONE && G.C[tag].capital >= 0) { E.caps++; if (dist(ll(s.id), ll(G.C[tag].capital)) > 45 && !COL.includes(tag)) E.far++; } return r; };
    E.samples = []; E.maxW = 0; E.maxB = 0; E.start = {wars: G.nextWarId, alive: G.tags.filter(alive).length}; });
  for (let y = 0; y < years; y++) {
    const r = await page.evaluate(() => { try { const t0 = G.date.y; while (G.date.y === t0) { advanceDay(); if (G.pendingEvent) G.pendingEvent = null; } } catch (e) { return 'EXC ' + e.message; }
      const al = G.tags.filter(t => t !== NONE && alive(t)), top = al.filter(t => G.C[t].rank <= 30), ratio = top.reduce((n, t) => n + Math.min(1.5, countDivs(t) / Math.max(1, divLimit(G.C[t]))), 0) / Math.max(1, top.length);
      const armies = G.armies.filter(a => !a.sea), bel = new Set(); G.wars.forEach(w => w.attAll.concat(w.defAll).forEach(t => bel.add(t))); window._ev.maxW = Math.max(window._ev.maxW, G.wars.length); window._ev.maxB = Math.max(window._ev.maxB, bel.size);
      window._ev.samples.push({starv: armies.filter(a => a.res && (a.res.food <= 0 || a.res.water <= 0)).length / Math.max(1, armies.length) * 100, cut: armies.filter(a => a.rt && !a.rt.safe).length / Math.max(1, armies.length) * 100, ratio, zero: al.filter(t => divLimit(G.C[t]) >= 8 && countDivs(t) === 0).length, broke: al.filter(t => G.C[t].treasury < 0).length, wars: G.wars.length}); return 'ok'; });
    if (r !== 'ok') { console.log('EXC', r); break; }
  }
  const res = await page.evaluate(() => { const E = window._ev, S = E.samples, avg = k => +(S.reduce((n, s) => n + s[k], 0) / Math.max(1, S.length)).toFixed(2), ended = E.wars.filter(w => w.win !== 'draw'), attWin = ended.filter(w => w.win === 'att').length;
    return {guerrasIniciadas: G.nextWarId - E.start.wars, guerrasTerminadas: E.wars.length, aggressorWin: ended.length ? +(attWin / ended.length).toFixed(2) : null, tablas: E.wars.filter(w => w.win === 'draw').length, ejercitoMedio: avg('ratio'), sinEjercito: avg('zero'), enBancarrota: avg('broke'), asedios: G.siegeStats || null, hambre: avg('starv'), rutaCortada: avg('cut'), maxGuerrasSimultaneas: E.maxW, maxBeligerantes: E.maxB, conquistasTotales: E.caps, conquistasAbsurdas: E.far, paisesInicio: E.start.alive, paisesFin: G.tags.filter(alive).length, duracionMedia: E.wars.length ? Math.round(E.wars.reduce((n, w) => n + w.w, 0) / E.wars.length) : 0}; });
  console.log(path.basename(file), epoch, 'semilla', seed, JSON.stringify(res), 'errs', errs.length, errs.slice(0, 2)); await browser.close();
})();
