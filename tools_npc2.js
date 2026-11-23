const { chromium } = require('playwright');
(async () => { const b = await chromium.launch({args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']}); const p = await (await b.newContext({viewport: {width: 1440, height: 820}})).newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message.slice(0, 220) + ' @' + (e.stack || '').split('\n')[1]));
  await p.addInitScript(() => { try { localStorage.setItem('victoria-bv3d', '1'); localStorage.setItem('victoria-tut', 'no'); } catch (e) {} }); await p.goto('file:///home/user/Victoria-3/index.html'); await p.waitForSelector('#start .st-card', {timeout: 110000});
  await p.click('.st-card[data-tag=PRU]'); await p.click('button[data-act=start]'); await p.waitForTimeout(2000);
  await p.evaluate(() => { ACT.ovclose && ACT.ovclose(); G.pendingEvent = null; G.paused = true; G.noOffers = true; G.C.PRU.bloc = G.C.AUS.bloc = null; G.pacts = G.pacts.filter(x => !['PRU', 'AUS'].includes(x.a) && !['PRU', 'AUS'].includes(x.b)); const tg = reachableStates('PRU', 'AUS').slice(0, 2).map(x => x.id); declareWar('PRU', 'AUS', 'conquest', tg, {free: true}); orderMove(armiesOf('PRU')[0], MAP.stats[G.C.AUS.states[0]].provs[0]); for (let i = 0; i < 300 && !G.battles.length; i++) { advanceDay(); if (G.pendingEvent) G.pendingEvent = null; } });
  await p.waitForTimeout(2500); await p.evaluate(() => { const bt = [...document.querySelectorAll('#battlepanel button')].find(x => /Comenzar/.test(x.textContent)); if (bt) bt.click(); G.paused = false; }); await p.waitForTimeout(7000);
  const ERA = +process.argv[2] || 1942;
  await p.evaluate(y => { G.date.y = y; ACT.soldier(); }, ERA); await p.waitForTimeout(1500); await p.evaluate(() => { ACT.soldctrl(); SOLD.ctrl.god = true; }); await p.waitForTimeout(800);
  const out = await p.evaluate(() => {
    const V = R.bviz, S = B3.S, me = soldBlock(V), c = SOLD.ctrl; let T = performance.now() / 1000; c.x = me.x - 400; c.cd = 1;
    const ox = me.x, oz = me.y, mk = (id, side, dx) => Object.assign({}, me, {id, side, mode: 'fire', sp: 0, mm: 0.8, x: ox + dx, y: oz, type: 'inf', foe: {x: ox + (side === 'A' ? 100 : -100) + dx, y: oz, role: 'line'}});
    const A = mk(9101, 'A', -45), B = mk(9102, 'B', 45); V.kmap = {}; V.klist = []; SR2.all = new Map(); SR2.allNew = new Map(); SR2.kills = 0; SR2.shots = 0; SR2.hits = 0; SR2.barks = []; NPC.clear();
    const hist = {}, clips = {}; const N = 30, steps = 900; let killsAt = [];
    for (let st = 0; st < steps; st++) { T += 0.1; SR2.all = SR2.allNew; SR2.allNew = new Map(); SR2.sup = SR2.sup.filter(e => T - e.t < 1.5);
      [A, B].forEach(bl => { for (let k = 0; k < N; k++) { if (V.kmap[bl.id + ':' + k + ':0']) continue; const h1 = ((k * 0.6180339 + (bl.id === 9101 ? 0 : 0.31)) % 1), h2 = ((k * 0.3247 + 0.17) % 1), f = {i: k, flee: 0}; const o = b3Free(bl, f, 0, bl.x + (k % 3) * 1.7, bl.y - 25 + Math.floor(k / 3) * 5, bl.side === 'A' ? Math.PI / 2 : -Math.PI / 2, 'idle', T, S.cam.position, h1, h2); if (o) clips[o.clip] = 1; } });
      srKlistStep(V, T, 0.1); NPC.forEach(s => { hist[s.st] = (hist[s.st] || 0) + 1; }); if (st % 150 === 149) killsAt.push(SR2.kills); }
    return JSON.stringify({kills: SR2.kills, killsPorMinuto: killsAt, shots: SR2.shots, hits: SR2.hits, hist, barks: SR2.barks.map(q => q.text).slice(-6), klist: V.klist.length, wounded: V.klist.filter(e => e.crawl).length, clips: Object.keys(clips).length}); });
  console.log(out); console.log('ERR', errs.slice(0, 4)); await b.close(); })();
