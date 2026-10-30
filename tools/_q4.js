const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl']});
  const page = await browser.newPage();
  page.on('pageerror', e => console.log('[pageerror]', e.message.slice(0, 300)));
  await page.goto('file:///home/user/Victoria-3/index.html');
  await page.waitForSelector('#start .st-card', {timeout: 90000});
  await page.click('.st-card[data-tag=BEL]'); await page.click('button[data-act=start]'); await page.waitForTimeout(800);
  console.log(await page.evaluate(() => { G.paused = true; for (let i = 0; i < 60; i++) { advanceDay(); if (G.pendingEvent) G.pendingEvent = null; }
    const c = G.C.GBR; const sh = G.S.reduce((n, s) => n + (s.b.shipyard || 0), 0), stg = G.S.filter(s => s.b.shipyard > 0).slice(0, 3).map(s => [s.name, s.b.shipyard.toFixed(2), (s.stg.shipyard || 0).toFixed(2), (s.ut.shipyard ?? 1)]); return JSON.stringify({sh, stg, rS: G.ratio.steel, rW: G.ratio.wood, rC: G.ratio.cannons, rT: G.ratio.tools, prod: G.prod.ships, dem: G.dem.ships, ratio: G.ratio.ships, price: G.price.ships, avail: G.avail.ships, L: mc(c).lines.ships, eq: c.eq.ships, milD: G.milD.ships, treas: c.treasury}); }));
  await browser.close();
})();
