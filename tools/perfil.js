// Perfil de CPU de la simulación y del dibujado (CDP). Uso: node tools/perfil.js [TAG] [días]
const { chromium } = require('playwright');
(async () => {
  const tag = process.argv[2] || 'PRU', days = +(process.argv[3] || 300);
  const browser = await chromium.launch({args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl']});
  const page = await browser.newPage({viewport: {width: 1400, height: 800}});
  page.on('pageerror', e => console.log('[pageerror]', e.message.slice(0, 200)));
  await page.goto('file://' + require('path').resolve(__dirname + '/../index.html'));
  await page.waitForSelector('#start .st-card', {timeout: 90000});
  await page.click('.st-card[data-tag=' + tag + ']'); await page.click('button[data-act=start]'); await page.waitForTimeout(1500);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', {interval: 500}); await cdp.send('Profiler.start');
  const ms = await page.evaluate(days => { G.paused = true; const t0 = performance.now(); for (let i = 0; i < days; i++) { advanceDay(); if (G.pendingEvent) G.pendingEvent = null; } return (performance.now() - t0) / days; }, days);
  const {profile} = await cdp.send('Profiler.stop');
  const self = new Map(), byId = new Map(profile.nodes.map(n => [n.id, n]));
  const dt = profile.timeDeltas; profile.samples.forEach((id, i) => { const n = byId.get(id), k = n.callFrame.functionName + ':' + n.callFrame.lineNumber; self.set(k, (self.get(k) || 0) + (dt[i] || 0)); });
  const tot = [...self.values()].reduce((a, b) => a + b, 0);
  console.log('ms/día:', ms.toFixed(2));
  [...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, 22).forEach(([k, v]) => console.log((v / tot * 100).toFixed(1).padStart(5) + '%  ' + k));
  await browser.close();
})();
