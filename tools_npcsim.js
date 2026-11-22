const { chromium } = require('playwright');
(async () => { const b = await chromium.launch({args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']}); const p = await (await b.newContext({viewport: {width: 1440, height: 820}})).newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message.slice(0, 220) + ' @' + (e.stack || '').split('\n')[1]));
  await p.addInitScript(() => { try { localStorage.setItem('victoria-bv3d', '1'); localStorage.setItem('victoria-tut', 'no'); } catch (e) {} }); await p.goto('file:///home/user/Victoria-3/index.html'); await p.waitForSelector('#start .st-card', {timeout: 110000});
  await p.click('.st-card[data-tag=PRU]'); await p.click('button[data-act=start]'); await p.waitForTimeout(2000);
  await p.evaluate(() => { ACT.ovclose && ACT.ovclose(); G.pendingEvent = null; G.paused = true; G.noOffers = true; G.C.PRU.bloc = G.C.AUS.bloc = null; G.pacts = G.pacts.filter(x => !['PRU', 'AUS'].includes(x.a) && !['PRU', 'AUS'].includes(x.b)); const tg = reachableStates('PRU', 'AUS').slice(0, 2).map(x => x.id); declareWar('PRU', 'AUS', 'conquest', tg, {free: true}); orderMove(armiesOf('PRU')[0], MAP.stats[G.C.AUS.states[0]].provs[0]); for (let i = 0; i < 300 && !G.battles.length; i++) { advanceDay(); if (G.pendingEvent) G.pendingEvent = null; } });
  await p.waitForTimeout(2500); await p.evaluate(() => { const bt = [...document.querySelectorAll('#battlepanel button')].find(x => /Comenzar/.test(x.textContent)); if (bt) bt.click(); G.paused = false; }); await p.waitForTimeout(8000);
  await p.evaluate(() => { G.date.y = 1940; ACT.soldier(); }); await p.waitForTimeout(1500); await p.evaluate(() => { ACT.soldctrl(); SOLD.ctrl.god = true; }); await p.waitForTimeout(1000);
  const out = await p.evaluate(() => {
    const V = R.bviz, S = B3.S, me = soldBlock(V), c = SOLD.ctrl, res = {}; c.cd = 1; let T = performance.now() / 1000;
    const run = (label, side, n, steps, setup) => {
      NPC.clear(); SOLD.shotNew = []; SOLD.gren.length = 0; SOLD.melee.length = 0;
      const fake = Object.assign({}, me, {id: 9001, side, mode: 'fire', sp: 0, mm: 0.8, foe: {x: me.x + 90, y: me.y, role: 'line'}}); const hist = {}, clips = {}; let shots = 0, grens = 0, melee = 0;
      for (let st = 0; st < steps; st++) { T += 0.1; if (setup) setup(st, fake);
        for (let k = 0; k < n; k++) { const h1 = ((k * 0.6180339) % 1), h2 = ((k * 0.3247 + 0.17) % 1), f = {i: k, flee: 0}; const o = b3Free(fake, f, 0, me.x + k * 1.7 - 20, me.y + (k % 5) * 2, 0, 'idle', T, S.cam.position, h1, h2);
          if (o) { clips[o.clip] = (clips[o.clip] || 0) + 1; } }
        shots += SOLD.shotNew.length; SOLD.shotNew = []; grens += SOLD.gren.length; melee += SOLD.melee.length; SOLD.melee = []; SOLD.gren = SOLD.gren.filter(g => T - g.t0 < 0); NPC.forEach(s => { hist[s.st] = (hist[s.st] || 0) + 1; }); }
      res[label] = {hist, shots, grens, melee, clips: Object.keys(clips).sort().join(' ')};
    };
    run('aliados disparando', me.side, 24, 450, null);
    const en = me.side === 'A' ? 'B' : 'A'; c.x = me.x + 40; c.z = me.y; c.cd = 2; c.rl = null;
    run('enemigos contra el jugador', en, 24, 450, (st, f) => { f.foe = {x: c.x, y: c.z, role: 'line'}; f.x = me.x + 20; f.y = me.y; c.cd = (st % 40 < 20) ? 1 : 0; if (st % 50 === 10) SOLD.suppress = {x: me.x + 20, z: me.y, t: T}; });
    run('moral baja (enemigos)', en, 24, 300, (st, f) => { f.mm = 0.1; f.foe = {x: c.x, y: c.z, role: 'line'}; if (st % 8 === 2) SOLD.suppress = {x: me.x + 4, z: me.y + 2, t: T}; });
    return res; });
  Object.entries(out).forEach(([k, v]) => console.log(k, JSON.stringify(v)));
  console.log('ERR', errs.slice(0, 5)); await b.close(); })();
