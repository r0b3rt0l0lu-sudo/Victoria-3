// Abre el panel de una batalla real y comprueba que los combatientes aparecen y se quedan en el campo.
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl']});
  const page = await browser.newPage({viewport: {width: 1500, height: 860}});
  page.on('console', m => { const t = m.text(); if (/b3V4|efectos|escenario|Visor de batalla|pueblo 3D/i.test(t)) console.log('[consola]', t.slice(0, 300)); });
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
  await page.evaluate(() => { UI.speed = 5; ACT.bvpause(); R.bv3d = true; R.b3Dead = false; renderBattlePanel(); });
  console.log('flags', await page.evaluate(() => JSON.stringify({bv3d: R.bv3d, dead: R.b3Dead, q: R.quality, usable: b3Usable()})));
  for (const t of [4000, 12000, 25000]) { await page.waitForTimeout(t === 4000 ? 4000 : 8000 + (t - 12000) * 0.3);
    console.log(t, await page.evaluate(() => { const S = B3.S; if (!S) return 'sin B3.S (activo ' + B3.active + ')'; const V = R.bviz;
      return JSON.stringify({fx: !!S.fx4, esc: !!S.esc, stats: S.fx4 && S.fx4.stats(), escStats: S.esc && S.esc.stats.triangulos, partes: V && V.parts.length, pueblos: S.vill && S.vill.groups.length, proj: !!S.proj, err: B3V4.err || 0}); })); }
  await page.keyboard.press('Escape'); await page.evaluate(() => { [...document.querySelectorAll('body *')].filter(x => /Acepta una campaña/.test(x.textContent) && ['fixed', 'absolute'].includes(getComputedStyle(x).position)).forEach(x => x.remove()); });
  for (const [k, vista] of [['a', 0], ['b', 1]]) {
    await page.evaluate(v => { const S = B3.S, tf = S.tf, vil = tf.villages; const V = R.bviz; const blk = (V.parts.find(p => p.k === 'smoke') || {x: S.tf.villages[0].x, y: S.tf.villages[0].y});
      if (v === 0) { B3.cam.tx = blk.x; B3.cam.tz = blk.y; B3.cam.d = 320; B3.cam.pit = 0.45; } else { const w = vil[0]; B3.cam.tx = w.x; B3.cam.tz = w.y; B3.cam.d = 420; B3.cam.pit = 0.55; B3.cam.yaw = 0.6; } }, vista);
    await page.waitForTimeout(6000); const el = await page.$('#bmap'); await (el || page).screenshot({path: (process.argv[2] || '/tmp/x.png').replace('.png', '_' + k + '.png'), timeout: 90000}); }

  await browser.close();
})();
