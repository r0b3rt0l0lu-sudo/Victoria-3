// La IA debe construir fábricas y formar escuadrones cuando tiene la tecnología (arranca en 1912 con todas las potencias con aviación).
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl']});
  const page = await browser.newPage({viewport: {width: 1200, height: 700}});
  let errs = 0; page.on('pageerror', e => { errs++; console.log('[pageerror]', e.message.slice(0, 300), (e.stack || '').split('\n').slice(0, 3).join('|')); });
  await page.goto('file://' + require('path').resolve(__dirname + '/../index.html'));
  await page.waitForSelector('#start .st-card', {timeout: 90000});
  await page.click('.st-card[data-tag=SAR]'); await page.click('button[data-act=start]'); await page.waitForTimeout(800);
  console.log(await page.evaluate(() => { G.paused = true; G.C[G.player].ai = true; G.date.y = 1912;
    const need = ['steam_engine', 'internal_comb', 'military_aviation', 'fighters', 'bombers', 'machine_guns', 'electricity', 'bessemer', 'blast_furnace', 'steel_artillery'];
    G.tags.forEach(t => { if (t !== NONE) { const c = G.C[t]; need.forEach(k => c.techs.add(k)); recalcMods(c); } });
    const out = [];
    for (let y = 0; y < 3; y++) { for (let i = 0; i < 365; i++) { advanceDay(); if (G.pendingEvent) G.pendingEvent = null; }
      out.push(['GBR', 'FRA', 'RUS', 'PRU', 'USA'].map(t => { const c = G.C[t]; const lv = k => c.states.reduce((n, id) => n + (G.S[id].b[k] || 0), 0).toFixed(1); return t + ' aero' + lv('aeroworks') + ' eng' + lv('enginew') + ' ac' + Math.round(c.eq.aircraft || 0) + ' sq' + mx().sq.filter(s => s.tag === t).length + '/' + mx().sq.filter(s => s.tag === t).reduce((n, s) => n + s.n, 0); }).join(' | ')); }
    return out.join('\n'); }));
  await browser.close(); process.exit(errs ? 1 : 0);
})();
