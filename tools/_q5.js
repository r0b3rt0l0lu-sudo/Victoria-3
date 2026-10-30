const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl']});
  const page = await browser.newPage();
  page.on('pageerror', e => console.log('[pageerror]', e.message.slice(0, 300)));
  await page.goto('file:///home/user/Victoria-3/index.html');
  await page.waitForSelector('#start .st-card', {timeout: 90000});
  await page.click('.st-card[data-tag=BEL]'); await page.click('button[data-act=start]'); await page.waitForTimeout(800);
  console.log(await page.evaluate(() => { G.paused = true; G.C.BEL.ai = true; const out = [];
    for (let y = 0; y < 12; y++) { for (let i = 0; i < 365; i++) { advanceDay(); if (G.pendingEvent) G.pendingEvent = null; }
      const c = G.C.FRA; const sts = c.states.filter(id => G.S[id].b.barracks >= 1);
      out.push([G.date.y, 'div', countDivs('FRA'), 'lim', divLimit(c), 'barr', sts.length, 'treas', Math.round(c.treasury / 1e6), 'inc', Math.round(c.stats.income/1e3), 'wars', c.wars.length, 'tpl', mc(c).tpl.map(t => t.key + ':' + t.ai).join(','), 'err', sts.length ? canRecruit(c, sts[0], 'inf') : 'nobarr', 'mob', c.mob, 'wear', Math.round(c.wear || 0)].join(' ')); }
    return out.join('\n'); }));
  await browser.close();
})();
