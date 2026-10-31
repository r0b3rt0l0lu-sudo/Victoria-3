// PWA: manifiesto, service worker y arranque sin conexión (sirve docs/ en http://localhost:8765).
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl']});
  const ctx = await browser.newContext({viewport: {width: 1200, height: 700}}); const page = await ctx.newPage(); let errs = 0;
  page.on('pageerror', e => { errs++; console.log('[pageerror]', e.message.slice(0, 200)); });
  await page.goto('http://localhost:8765/'); await page.waitForSelector('#start .st-card', {timeout: 90000});
  await page.waitForTimeout(2500);
  console.log('manifest', await page.evaluate(async () => { const l = document.querySelector('link[rel=manifest]'); const r = await fetch(l.href); const j = await r.json(); const reg = await navigator.serviceWorker.getRegistration(); return JSON.stringify({name: j.name, icons: j.icons.length, sw: !!reg, active: !!(reg && reg.active)}); }));
  await ctx.setOffline(true); await page.reload(); await page.waitForSelector('#start .st-card', {timeout: 90000}); console.log('arranca sin conexión: sí');
  await browser.close(); process.exit(errs ? 1 : 0);
})();
