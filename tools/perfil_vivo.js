// Perfil del juego en marcha (bucle de render + simulación en tiempo real). Uso: node tools/perfil_vivo.js [TAG] [segundos] [velocidad]
const { chromium } = require('playwright');
(async () => {
  const tag = process.argv[2] || 'PRU', secs = +(process.argv[3] || 12), speed = +(process.argv[4] || 4);
  const browser = await chromium.launch({args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl']});
  const page = await browser.newPage({viewport: {width: 1400, height: 800}});
  page.on('pageerror', e => console.log('[pageerror]', e.message.slice(0, 200)));
  await page.goto('file://' + require('path').resolve(__dirname + '/../index.html'));
  await page.waitForSelector('#start .st-card', {timeout: 90000});
  await page.click('.st-card[data-tag=' + tag + ']'); await page.click('button[data-act=start]'); await page.waitForTimeout(1500);
  await page.evaluate(sp => { UI.speed = sp; G.paused = false; window._fr = 0; window._ft = []; let last = performance.now(); const f = () => { const t = performance.now(); window._ft.push(t - last); last = t; requestAnimationFrame(f); }; requestAnimationFrame(f); }, speed);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', {interval: 500}); await cdp.send('Profiler.start');
  const t0 = Date.now();
  while (Date.now() - t0 < secs * 1000) { await page.mouse.move(400 + Math.random() * 400, 300 + Math.random() * 200); await page.mouse.wheel(0, Math.random() < 0.5 ? 40 : -40); await page.waitForTimeout(250); }
  const {profile} = await cdp.send('Profiler.stop');
  const st = await page.evaluate(() => { const a = window._ft.slice(5).sort((x, y) => x - y); return {frames: a.length, medianMs: a[a.length >> 1], p95: a[Math.floor(a.length * 0.95)], days: G.date.t, tokens: document.querySelectorAll('.atoken').length, dom: document.getElementsByTagName('*').length}; });
  const self = new Map(), byId = new Map(profile.nodes.map(n => [n.id, n]));
  const dt = profile.timeDeltas; profile.samples.forEach((id, i) => { const n = byId.get(id), k = n.callFrame.functionName + ':' + n.callFrame.lineNumber; self.set(k, (self.get(k) || 0) + (dt[i] || 0)); });
  const tot = [...self.values()].reduce((a, b) => a + b, 0);
  console.log(JSON.stringify(st));
  [...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, 16).forEach(([k, v]) => console.log((v / tot * 100).toFixed(1).padStart(5) + '%  ' + k));
  await browser.close();
})();
