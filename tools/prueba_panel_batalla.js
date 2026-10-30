// Abre el panel de una batalla real y comprueba que los combatientes aparecen y se quedan en el campo.
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl']});
  const page = await browser.newPage({viewport: {width: 1500, height: 860}});
  page.on('pageerror', e => console.log('[pageerror]', e.message.slice(0, 300), (e.stack || '').split('\n').slice(0, 3).join('|')));
  await page.goto('file://' + require('path').resolve(__dirname + '/../index.html'));
  await page.waitForSelector('#start .st-card', {timeout: 90000});
  await page.click('.st-card[data-tag=PRU]'); await page.click('button[data-act=start]'); await page.waitForTimeout(1200);
  const info = await page.evaluate(() => { G.paused = true; const a = 'PRU', d = 'AUS';
    G.pacts = G.pacts.filter(p => ![a, d].includes(p.a) && ![a, d].includes(p.b)); G.C[a].bloc = G.C[d].bloc = null;
    const targets = reachableStates(a, d).slice(0, 2).map(x => x.id); declareWar(a, d, targets.length ? 'conquest' : 'humiliate', targets, {free: true});
    const my = armiesOf(a)[0], tgt = MAP.stats[G.C[d].states[0]].provs[0]; orderMove(my, tgt);
    for (let i = 0; i < 250 && !G.battles.length; i++) { advanceDay(); if (G.pendingEvent) G.pendingEvent = null; }
    if (!G.battles.length) return 'sin batalla'; const b = G.battles[0]; UI.battle = b.id; renderBattlePanel(); return JSON.stringify({id: b.id, day: b.day, A: b.A.length, B: b.B.length, paused: G.paused}); });
  console.log('batalla', info);
  await page.evaluate(() => { UI.speed = 5; ACT.bvpause(); });
  for (const t of [800, 3500, 7000, 12000]) {
    await page.waitForTimeout(t === 800 ? 800 : t - 800);
    console.log(t, await page.evaluate(() => { const V = R.bviz; if (!V) return 'sin bviz'; const b = G.battles.find(x => x.id === UI.battle) || G.lastEnded; return JSON.stringify({t: +V.t.toFixed(1), groups: V.groups.size, units: V.units.length, alive: V.units.filter(u => u.alive).length, fleeing: V.units.filter(u => u.flee > 0).length, xs: V.units.slice(0, 6).map(u => Math.round(u.x)), battleDay: b && b.day, ended: !!(b && b.ended), over: !!V.over, panel: document.getElementById('battlepanel').className}); }));
  }
  await page.screenshot({path: '/tmp/claude-0/panel_batalla.png', timeout: 90000});
  await browser.close();
})();
