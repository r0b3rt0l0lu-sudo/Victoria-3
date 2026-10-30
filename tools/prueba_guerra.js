// Escenario forzado: guerra naval y aérea entre dos potencias (bloqueo, batallas navales, aviación, resistencia, mariscales).
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl']});
  const page = await browser.newPage({viewport: {width: 1400, height: 800}});
  let errs = 0; page.on('pageerror', e => { errs++; console.log('[pageerror]', e.message.slice(0, 300), (e.stack || '').split('\n').slice(0, 3).join('|')); });
  await page.goto('file://' + require('path').resolve(__dirname + '/../index.html'));
  await page.waitForSelector('#start .st-card', {timeout: 90000});
  await page.click('.st-card[data-tag=PRU]'); await page.click('button[data-act=start]'); await page.waitForTimeout(800);
  const out = await page.evaluate(() => {
    G.paused = true; const r = {};
    ['GBR', 'FRA'].forEach(t => { const c = G.C[t]; c.techs = new Set([...c.techs, 'steam_engine', 'internal_comb', 'military_aviation', 'fighters', 'bombers', 'steam_frigate', 'ironclad', 'dreadnought', 'cruisers', 'submarines', 'machine_guns']); recalcMods(c); c.eq.aircraft = 600; c.eq.ships = 3000; c.treasury = 1e9; });
    const w = declareWar('GBR', 'FRA', 'humiliate', [], {free: true}); r.war = JSON.stringify(w && w.msg); if (!G.wars.length) { return JSON.stringify(r); }
    recalcHostile();
    // flotas: británicos bloquean Francia
    const zones = [...countryZones(G.C.FRA).keys()]; r.zones = zones.length;
    const gf = fleetsOf('GBR')[0]; if (gf) { for (let i = 0; i < 8; i++) gf.ships.push({t: 'dread', hp: 1}); fleetMove(gf, zones[0]); fleetMission(gf, 'blockade', 'FRA'); }
    const ff = fleetsOf('FRA')[0]; if (ff && zones.length) { fleetMove(ff, zones[0]); fleetMission(ff, 'patrol'); }
    // aviación
    const sg = sqBuild(G.C.GBR, 'fighter', 60, airRegOf(G.C.GBR.capital)); const sb = sqBuild(G.C.GBR, 'bomber', 60, airRegOf(G.C.FRA.capital)); r.sq = [sg.ok, sb.ok];
    if (sb.ok) sb.sq.mission = 'strat';
    const sf = sqBuild(G.C.FRA, 'fighter', 40, airRegOf(G.C.FRA.capital));
    const t0 = G.date.t, sc0 = G.wars[0].score;
    for (let i = 0; i < 150; i++) { advanceDay(); if (G.pendingEvent) G.pendingEvent = null; }
    r.blockFra = +blockadeFrac('FRA').toFixed(2); r.blockScore = blockadeScore(G.wars[0]); r.nlog = (mx().nlog || []).length; r.fleetsG = fleetsOf('GBR').reduce((n, f) => n + f.ships.length, 0); r.fleetsF = fleetsOf('FRA').reduce((n, f) => n + f.ships.length, 0);
    r.sqLeft = mx().sq.map(s => s.tag + s.type[0] + s.n).join(' ');
    r.bombed = G.S.filter(s => s.bomb > 0).length; r.airBonus = +airBonus('GBR', G.C.FRA.capital).toFixed(3);
    r.war = G.wars.length; r.score0 = sc0; r.score1 = G.wars[0] ? G.wars[0].score : null;
    r.res = Object.keys(resMap()).length;
    return JSON.stringify(r);
  });
  console.log(out); await browser.close(); process.exit(errs ? 1 : 0);
})();
