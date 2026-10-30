const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl']});
  const page = await browser.newPage({viewport: {width: 1500, height: 860}});
  page.on('pageerror', e => console.log('[pageerror]', e.message.slice(0, 300)));
  await page.goto('file:///home/user/Victoria-3/index.html');
  await page.waitForSelector('#start .st-card', {timeout: 90000});
  await page.click('.st-card[data-tag=PRU]'); await page.click('button[data-act=start]'); await page.waitForTimeout(800);
  await page.evaluate(() => { G.paused = true; const c = me(); tplCreate(c, 'Infantería reforzada', ['inf','inf','inf','inf','inf','inf','eng','art','art']); c.mxp = 200; });
  const tabs = (process.argv[2] || 'templates,production,navy,doctrines,marshals,occupation,air').split(',');
  for (const t of tabs) {
    await page.evaluate(t => { UI.winTab.mil = t; UI.win = null; openWindow('military'); }, t);
    await page.waitForTimeout(400); await page.screenshot({path: '/tmp/claude-0/shot_' + t + '.png', timeout: 90000});
  }
  await browser.close();
})();
