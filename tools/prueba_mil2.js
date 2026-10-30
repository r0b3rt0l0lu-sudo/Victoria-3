// Comprueba los sistemas militares nuevos: pestañas, líneas, flotas, doctrinas, plantillas, resistencia...
const { chromium } = require('playwright');
(async () => {
  const tag = process.argv[2] || 'PRU';
  const browser = await chromium.launch({args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl']});
  const page = await browser.newPage({viewport: {width: 1400, height: 800}});
  let errs = 0; page.on('pageerror', e => { errs++; console.log('[pageerror]', e.message.slice(0, 300), (e.stack || '').split('\n').slice(0, 3).join('|')); });
  await page.goto('file://' + require('path').resolve(__dirname + '/../index.html'));
  await page.waitForSelector('#start .st-card', {timeout: 90000});
  await page.click('.st-card[data-tag=' + tag + ']'); await page.click('button[data-act=start]'); await page.waitForTimeout(800);
  const out = await page.evaluate(() => {
    G.paused = true; const c = me(), r = {};
    r.rank = c.rank; r.factories = milFactories(c); r.fleets = fleetsOf(c.tag).length + '/' + fleetsOf(c.tag).reduce((n, f) => n + f.ships.length, 0);
    r.tabs = {}; MX_TABS.forEach(t => { try { const h = t.html(); r.tabs[t.id] = h.length; } catch (e) { r.tabs[t.id] = 'ERR ' + e.message; } });
    // plantillas
    const t = tplCreate(c, 'Prueba', ['inf', 'inf', 'inf', 'inf', 'inf', 'inf', 'eng', 'art', 'art']); r.tpl = JSON.stringify([DIVS[t.key].att, DIVS[t.key].def, DIVS[t.key].org, DIVS[t.key].cost]);
    c.treasury = 1e9; const st = G.S[c.states.find(id => G.S[id].b.barracks >= 1)]; const rc = recruit(c, st.id, t.key); r.recruit = rc.ok ? 'ok' : rc.msg;
    // líneas
    LINE_ORDER.forEach(k => lineOf(c, k)); lineSet(c, 'rifles', 1); lineSet(c, 'rifles', 1); r.line0 = JSON.stringify(mc(c).lines.rifles);
    for (let i = 0; i < 40; i++) { advanceDay(); if (G.pendingEvent) G.pendingEvent = null; }
    r.line1 = JSON.stringify(mc(c).lines.rifles); r.eq = Math.round(c.eq.rifles);
    // doctrinas
    c.mxp = 500; r.doc = JSON.stringify([docBuy(c, 'land', 'fire').msg, docMod(c.tag, 'att')]);
    // marina
    const ps = portsStates(c); r.ports = ps.length; r.yards = c.states.reduce((n, id) => n + (G.S[id].b.shipyard || 0), 0).toFixed(1);
    // mariscal
    r.mar = marRecruit(c, true).msg;
    return JSON.stringify(r);
  });
  console.log(out); await browser.close(); process.exit(errs ? 1 : 0);
})();
