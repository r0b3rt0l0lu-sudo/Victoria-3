// Batalla naval visible: fichas, buques 3D y visor.
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl']});
  const page = await browser.newPage({viewport: {width: 1500, height: 860}});
  let errs = 0; page.on('pageerror', e => { errs++; console.log('[pageerror]', e.message.slice(0, 300), (e.stack || '').split('\n').slice(0, 3).join('|')); });
  await page.goto('file://' + require('path').resolve(__dirname + '/../index.html'));
  await page.waitForSelector('#start .st-card', {timeout: 90000});
  await page.click('.st-card[data-tag=GBR]'); await page.click('button[data-act=start]'); await page.waitForTimeout(1200);
  const info = await page.evaluate(() => {
    G.paused = true; G.noOffers = true; const a = 'GBR', b = 'FRA'; G.pacts = G.pacts.filter(p => ![a, b].includes(p.a) && ![a, b].includes(p.b)); G.C[a].bloc = G.C[b].bloc = null;
    declareWar(a, b, 'humiliate', [], {free: true}); const z = 2;
    fleetsOf(a).forEach((f, i) => { if (i < 2) { fleetMove(f, z); f.zone = z; f.tr = null; f.mission = 'patrol'; } }); fleetsOf(b).forEach((f, i) => { if (i < 2) { f.zone = z; f.tr = null; f.mission = 'patrol'; } });
    for (const f of fleetsOf(a)) for (let i = 0; i < 2; i++) f.ships.push({t: 'ironclad', hp: 1}); for (const f of fleetsOf(b)) f.ships.push({t: 'steam', hp: 1}, {t: 'steam', hp: 1});
    for (let i = 0; i < 4; i++) { advanceDay(); if (G.pendingEvent) G.pendingEvent = null; }
    const A = zoneAnchor(z); focusLonLat(A.lon, A.lat, 32); updateCamera(); R.dirty = true; R.labelsDirty = true;
    return JSON.stringify({nb: !!(G.mx.nb && G.mx.nb[z]), day: G.mx.nb && G.mx.nb[z] && G.mx.nb[z].day, anchor: A});
  });
  console.log(info);
  await page.waitForTimeout(1500); console.log('tokens', await page.evaluate(() => document.querySelectorAll('.ntoken').length, ));
  await page.screenshot({path: '/tmp/claude-0/naval_mapa.png', timeout: 90000});
  await page.evaluate(() => { UI.nb = 2; renderNavalPanel(); G.paused = false; UI.speed = 2; });
  await page.waitForTimeout(6000);
  console.log(await page.evaluate(() => { const V = R.nviz; return V ? JSON.stringify({t: +V.t.toFixed(1), ships: V.ships.size, sunk: V.sunk, parts: V.parts.length, day: G.mx.nb[2].day}) : 'sin visor'; }));
  await page.screenshot({path: '/tmp/claude-0/naval_visor.png', timeout: 90000});
  await browser.close(); process.exit(errs ? 1 : 0);
})();
