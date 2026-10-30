// Prueba de humo: carga el juego, empieza una partida y simula días. Falla si hay errores de JavaScript.
// Uso: node tools/prueba.js [TAG] [días] [archivo.html]
const { chromium } = require('playwright');
(async () => {
  const tag = process.argv[2] || 'PRU', days = +(process.argv[3] || 400), file = process.argv[4] || (__dirname + '/../index.html');
  const browser = await chromium.launch({args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl']});
  const page = await browser.newPage({viewport: {width: 1400, height: 800}});
  let errs = 0;
  page.on('pageerror', e => { errs++; console.log('[pageerror]', e.message.slice(0, 300), (e.stack || '').split('\n').slice(0, 3).join('|')); });
  await page.goto('file://' + require('path').resolve(file));
  await page.waitForSelector('#start .st-card', {timeout: 90000});
  await page.click('.st-card[data-tag=' + tag + ']'); await page.click('button[data-act=start]');
  await page.waitForTimeout(800);
  const out = await page.evaluate((days) => {
    G.paused = true; const log = [];
    try { for (let i = 0; i < days; i++) { advanceDay(); if (G.pendingEvent) G.pendingEvent = null; } } catch (e) { log.push('EXC ' + e.message + ' @ ' + (e.stack || '').split('\n')[1]); }
    return JSON.stringify({date: G.date.y + '-' + (G.date.m + 1), log, wars: G.wars.length, fleets: G.mx ? G.mx.fl.length : -1, sq: G.mx ? G.mx.sq.length : -1});
  }, days);
  console.log(out);
  await browser.close();
  process.exit(errs || out.includes('EXC') ? 1 : 0);
})();
