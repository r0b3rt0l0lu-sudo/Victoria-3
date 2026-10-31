// Capturas de los gráficos: estaciones, costa con espuma, chimeneas con humo, aviones y sombras.
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl']});
  const page = await browser.newPage({viewport: {width: 1500, height: 860}});
  let errs = 0; page.on('pageerror', e => { errs++; console.log('[pageerror]', e.message.slice(0, 300), (e.stack || '').split('\n').slice(0, 3).join('|')); });
  page.on('console', m => { if (m.type() === 'warning' && /agua|chimeneas/.test(m.text())) console.log('[warn]', m.text().slice(0, 200)); });
  await page.goto('file://' + require('path').resolve(__dirname + '/../index.html'));
  await page.waitForSelector('#start .st-card', {timeout: 90000});
  await page.click('.st-card[data-tag=GBR]'); await page.click('button[data-act=start]'); await page.waitForTimeout(1500);
  const shot = async (name, fn) => { await page.evaluate(fn); await page.waitForTimeout(1800); await page.screenshot({path: '/tmp/claude-0/gfx_' + name + '.png', timeout: 90000}); };
  await shot('invierno', () => { G.paused = true; G.date.m = 0; G.date.d = 15; R._seasonKey = null; R.mode = 'terrain'; setMapMode('terrain'); camHome(); R.cam.dist = 150; R.cam.tx = 20; R.cam.tz = -55; updateCamera(); R.dirty = true; });
  await shot('verano', () => { G.date.m = 6; G.date.d = 15; R._seasonKey = null; R.dirty = true; });
  await shot('industria', () => { G.date.m = 8; R._seasonKey = null; setMapMode('political'); const sid = G.C.GBR.states.find(i => G.S[i].name.includes('Midlands')) ?? G.C.GBR.states[0]; focusState(sid, 26); updateCamera(); R.dirty = true; });
  await shot('costa', () => { focusLonLat(-3, 53, 20); updateCamera(); R.dirty = true; });
  console.log(await page.evaluate(() => JSON.stringify({chim: R.chimItems && R.chimItems.length, snowK: R.detailU && R.detailU.snowK && R.detailU.snowK.value, foam: !!R.waterU.foam, tri: R.renderer.info.render.triangles})));
  await shot('aviones', () => { G.date.m = 4; R._seasonKey = null; G.paused = true; const c = G.C.GBR; c.techs = new Set([...c.techs, 'military_aviation', 'fighters', 'bombers']); c.eq.aircraft = 400; c.treasury = 1e10; sqBuild(c, 'fighter', 60, airRegOf(c.capital)); sqBuild(c, 'bomber', 60, airRegOf(c.capital)); const rg = airReg(airRegOf(c.capital)); focusLonLat(rg.lon, rg.lat, 34); updateCamera(); R.dirty = true; });
  await page.evaluate(() => { R.quality = 'alto'; saveMapPrefs(); });
  await shot('sombras', () => { focusLonLat(8, 46, 30); updateCamera(); R.dirty = true; });
  console.log(await page.evaluate(() => JSON.stringify({shadow: R.renderer.shadowMap.enabled, sun: !!R.sun})));
  await browser.close(); process.exit(errs ? 1 : 0);
})();
