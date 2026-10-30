// Simulación de 80 años (1836-1916) sin jugador: todos los países los lleva la IA. Informe cada 4 años.
// Uso: node tools/simular80.js [años] [archivo.html]
const { chromium } = require('playwright');
(async () => {
  const years = +(process.argv[2] || 80), file = process.argv[3] || (__dirname + '/../index.html');
  const browser = await chromium.launch({args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl']});
  const page = await browser.newPage({viewport: {width: 1200, height: 700}});
  let errs = 0; page.on('pageerror', e => { errs++; console.log('[pageerror]', e.message.slice(0, 300), (e.stack || '').split('\n').slice(0, 3).join('|')); });
  await page.goto('file://' + require('path').resolve(file));
  await page.waitForSelector('#start .st-card', {timeout: 90000});
  await page.click('.st-card[data-tag=LUX], .st-card[data-tag=SAR], .st-card:last-child'); await page.click('button[data-act=start]'); await page.waitForTimeout(800);
  await page.evaluate(() => { G.paused = true; G.C[G.player].ai = true; window._started = G.date.y; window._wars = 0; window._seenWars = new Set(); });
  const report = () => page.evaluate(() => {
    const alive = G.tags.filter(t => t !== NONE && G.C[t].states.length), top = alive.slice().sort((a, b) => G.C[b].states.length - G.C[a].states.length).slice(0, 5).map(t => t + ':' + G.C[t].states.length);
    const ships = {}; mx().fl.forEach(f => f.ships.forEach(s => { ships[s.t] = (ships[s.t] || 0) + 1; }));
    const cnt = {}; G.wars.forEach(w => window._seenWars.add(w.id));
    const big = ['GBR', 'FRA', 'RUS', 'PRU', 'AUS', 'USA', 'JAP', 'OTT', 'ITA', 'GER'].filter(t => G.C[t] && G.C[t].states.length).map(t => { const c = G.C[t]; return t + '[st' + c.states.length + ' div' + countDivs(t) + ' fl' + fleetsOf(t).reduce((n, f) => n + f.ships.length, 0) + ' ac' + mx().sq.filter(s => s.tag === t).reduce((n, s) => n + s.n, 0) + ' m' + marOf(t).length + ' d' + (mc(c).doc.land || '-') + ']'; });
    const av = ['military_aviation', 'fighters', 'bombers', 'dreadnought', 'motorization'].map(k => k.slice(0, 4) + ':' + alive.filter(t => G.C[t].techs.has(k)).length).join(' '); const ac = alive.filter(t => mx().sq.some(s => s.tag === t)).length;
    return G.date.y + ' tec[' + av + '] paisesConAviacion=' + ac + ' paises=' + alive.length + ' guerras=' + G.wars.length + ' (vistas ' + window._seenWars.size + ') top=' + top.join(',') + ' | buques ' + JSON.stringify(ships) + ' | escuadrones ' + mx().sq.length + ' | ' + big.join(' ');
  });
  let y = 0;
  while (y < years) {
    const r = await page.evaluate(() => { try { for (let i = 0; i < 365 * 4; i++) { advanceDay(); if (G.pendingEvent) G.pendingEvent = null; } return 'ok'; } catch (e) { return 'EXC ' + e.message + ' @ ' + (e.stack || '').split('\n').slice(1, 3).join('|'); } });
    if (r !== 'ok') { console.log(r); errs++; break; }
    y += 4; console.log(await report());
  }
  await browser.close(); console.log(errs ? 'CON ERRORES' : 'SIN ERRORES'); process.exit(errs ? 1 : 0);
})();
