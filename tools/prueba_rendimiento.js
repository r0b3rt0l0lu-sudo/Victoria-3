// Detección de hardware y calidad automática (simula un Chromebook modesto y un PC potente).
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl']});
  for (const perfil of ['chromebook', 'pc']) {
    const ctx = await browser.newContext({viewport: {width: 1366, height: 768}, userAgent: perfil === 'chromebook' ? 'Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' : undefined});
    const page = await ctx.newPage(); let errs = 0; page.on('pageerror', e => { errs++; console.log('[pageerror]', e.message.slice(0, 300)); });
    await page.addInitScript(p => { if (p === 'chromebook') { Object.defineProperty(navigator, 'deviceMemory', {get: () => 4}); Object.defineProperty(navigator, 'hardwareConcurrency', {get: () => 4}); } else { Object.defineProperty(navigator, 'deviceMemory', {get: () => 8}); Object.defineProperty(navigator, 'hardwareConcurrency', {get: () => 12}); } }, perfil);
    await page.goto('file://' + require('path').resolve(__dirname + '/../index.html'));
    await page.waitForSelector('#start .st-card', {timeout: 90000});
    await page.click('.st-card[data-tag=PRU]'); await page.click('button[data-act=start]'); await page.waitForTimeout(14000);
    console.log(perfil, await page.evaluate(() => JSON.stringify({quality: R.quality, lowEnd: R.lowEnd, hw: R.hw && {cros: R.hw.hw.cros, mem: R.hw.hw.mem, cores: R.hw.hw.cores, gpu: R.hw.gpu, prof: R.hw.prof, med: Math.round(R.hw.med || 0)}, resScale: R.resScale, aa: R.renderer.getContext().getContextAttributes().antialias, saved: localStorage.getItem('victoria-autoq')})));
    // la simulación respeta el presupuesto de tiempo
    console.log(perfil, 'sim', await page.evaluate(() => { UI.speed = 5; G.paused = false; return new Promise(r => setTimeout(() => r(JSON.stringify({days: G.date.t})), 3000)); }));
    await ctx.close(); if (errs) process.exitCode = 1;
  }
  await browser.close();
})();
