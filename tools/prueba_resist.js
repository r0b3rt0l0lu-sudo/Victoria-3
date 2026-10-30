// Resistencia, guarniciones, mariscales, desembarco con/sin superioridad naval, guardado y carga.
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl']});
  const page = await browser.newPage({viewport: {width: 1400, height: 800}});
  let errs = 0; page.on('pageerror', e => { errs++; console.log('[pageerror]', e.message.slice(0, 300), (e.stack || '').split('\n').slice(0, 3).join('|')); });
  await page.goto('file://' + require('path').resolve(__dirname + '/../index.html'));
  await page.waitForSelector('#start .st-card', {timeout: 90000});
  await page.click('.st-card[data-tag=PRU]'); await page.click('button[data-act=start]'); await page.waitForTimeout(800);
  const out = await page.evaluate(() => {
    G.paused = true; const r = {};
    // ocupación forzada: Prusia ocupa una provincia francesa/austríaca
    const tgt = G.C.AUS.states[0], pid = MAP.stats[tgt].provs[0]; declareWar('PRU', 'AUS', 'humiliate', [], {free: true}); recalcHostile();
    G.P[pid].by = 'PRU'; G.occList.push(pid);
    for (let i = 0; i < 12; i++) resistanceWeek(); r.res0 = Math.round(provRes(pid)); r.cultK = +cultureK(tgt, 'PRU').toFixed(2);
    const a = armiesOf('PRU')[0]; a.loc = pid; for (let i = 0; i < 6; i++) resistanceWeek(); r.res1 = Math.round(provRes(pid)); r.garr = garrisonOf(pid, 'PRU');
    // mariscal
    const m = marRecruit(G.C.PRU, true).m; m.group.push(a.id); r.marBonus = JSON.stringify(marBonus(a));
    // guardado y carga
    const txt = saveData(); r.saveKB = Math.round(txt.length / 1024);
    const o = JSON.parse(txt); r.hasMx = !!(o.ext && o.ext.mx); r.fl = fleetsOf('GBR').length;
    loadData(txt); r.fl2 = fleetsOf('GBR').length; r.tpl = G.C.PRU.m2.tpl.length; r.dkey = Object.keys(DIVS).length;
    // compatibilidad: partida antigua sin ext.mx
    const o2 = JSON.parse(txt); delete o2.ext.mx; loadData(JSON.stringify(o2)); r.old = fleetsOf('GBR').length > 0 && !!G.mx;
    for (let i = 0; i < 60; i++) { advanceDay(); if (G.pendingEvent) G.pendingEvent = null; }
    return JSON.stringify(r);
  });
  console.log(out); await browser.close(); process.exit(errs ? 1 : 0);
})();
