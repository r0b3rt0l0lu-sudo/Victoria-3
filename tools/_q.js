const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl']});
  const page = await browser.newPage();
  page.on('pageerror', e => console.log('[pageerror]', e.message.slice(0, 200)));
  await page.goto('file:///home/user/Victoria-3/index.html');
  await page.waitForSelector('#start .st-card', {timeout: 90000});
  await page.click('.st-card[data-tag=PRU]'); await page.click('button[data-act=start]'); await page.waitForTimeout(800);
  console.log(await page.evaluate(() => { console.log('x'); const rows = ['GBR','FRA','RUS','AUS','PRU','OTT','SPA','NET','DEN','USA','JAP','CHI','ITA','SAR'].filter(t => G.C[t]).map(t => { const c = G.C[t]; const lv = k => c.states.reduce((n, id) => n + (G.S[id].b[k] || 0), 0).toFixed(1); return [t, c.rank, c.stats.indLevels.toFixed(0), lv('armory'), lv('foundry'), lv('powder'), lv('shipyard'), milFactories(c), fleetsOf(t).reduce((n, f) => n + f.ships.length, 0), c.stats.soldiers|0, countDivs(t)].join(' '); }); return rows.join('\n'); }));
  await browser.close();
})();
