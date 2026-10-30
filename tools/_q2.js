const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl']});
  const page = await browser.newPage();
  await page.goto('file:///home/user/Victoria-3/index.html');
  await page.waitForSelector('#start .st-card', {timeout: 90000});
  await page.click('.st-card[data-tag=GBR]'); await page.click('button[data-act=start]'); await page.waitForTimeout(800);
  console.log(await page.evaluate(() => { const sum = k => G.S.reduce((n, s) => n + (s.b[k] || 0), 0).toFixed(2), cap = k => G.S.reduce((n, s) => n + (s.cap[k] || 0), 0).toFixed(2); return JSON.stringify({shipB: sum('shipyard'), shipC: cap('shipyard'), armB: sum('armory'), armC: cap('armory'), eng: cap('enginew'), mg: cap('mgworks'), prod: G.prod.ships, price: G.price.ships}); }));
  await browser.close();
})();
