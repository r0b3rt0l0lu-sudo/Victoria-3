const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl']});
  const page = await browser.newPage();
  page.on('pageerror', e => console.log('[pageerror]', e.message.slice(0, 300), (e.stack||'').split('\n').slice(0,3).join('|')));
  await page.goto('file:///home/user/Victoria-3/index.html');
  await page.waitForSelector('#start .st-card', {timeout: 90000});
  await page.click('.st-card[data-tag=BEL]'); await page.click('button[data-act=start]'); await page.waitForTimeout(800);
  const days = +(process.argv[2] || 1000);
  console.log(await page.evaluate((days) => { G.paused = true; const t0 = performance.now(); const rep = () => ['GBR','FRA','RUS','PRU','AUS','USA','JAP','OTT'].map(t => { const c = G.C[t]; const L = mc(c).lines; return [t, G.date.y, 'ships', fleetsOf(t).reduce((n, f) => n + f.ships.length, 0), 'q', mx().nq.filter(q => q.tag === t).length, 'eq.ships', Math.round(c.eq.ships||0), 'lines', Object.keys(L).map(k => k[0] + L[k].f + ':' + Math.round(L[k].eff*100)).join(','), 'air', mx().sq.filter(s => s.tag === t).length, 'ac', Math.round(c.eq.aircraft||0), 'div', countDivs(t), 'F', milFactories(c)].join(' '); }).join('\n');
    let out = [];
    for (let i = 0; i < days; i++) { advanceDay(); if (G.pendingEvent) G.pendingEvent = null; if (i % 365 === 364) out.push(rep()); }
    return out.join('\n----\n') + '\nms/day ' + ((performance.now() - t0) / days).toFixed(1); }, days));
  await browser.close();
})();
