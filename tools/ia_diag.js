// Diagnóstico de la IA de guerra: una guerra entre dos países y estado de sus ejércitos cada N días. Uso: node tools/ia_diag.js A B [días] [paso] [vA] [vB]
const { chromium } = require('playwright');
(async () => {
  const [a, b] = [process.argv[2] || 'AUS', process.argv[3] || 'FRA'], days = +(process.argv[4] || 150), step = +(process.argv[5] || 15), va = +(process.argv[6] || 2), vb = +(process.argv[7] || 2);
  const browser = await chromium.launch({args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl']});
  const page = await browser.newPage({viewport: {width: 1000, height: 600}});
  page.on('pageerror', e => console.log('[pageerror]', e.message.slice(0, 300), (e.stack || '').split('\n').slice(0, 3).join('|')));
  await page.goto('file://' + require('path').resolve(__dirname + '/../index.html'));
  await page.waitForSelector('#start .st-card', {timeout: 90000});
  await page.click('.st-card[data-tag=SAR]'); await page.click('button[data-act=start]'); await page.waitForTimeout(800);
  const out = await page.evaluate(({a, b, days, step, va, vb}) => {
    G.paused = true; G.noOffers = true; G.C[G.player].ai = true; G.tags.forEach(t => { if (t !== NONE) G.C[t].aiV = 1; }); G.C[a].aiV = va; G.C[b].aiV = vb;
    G.pacts = G.pacts.filter(p => ![a, b].includes(p.a) && ![a, b].includes(p.b)); G.C[a].bloc = G.C[b].bloc = null; G.C[a].overlord = G.C[b].overlord = null;
    const targets = reachableStates(a, b).slice(0, 3).map(x => x.id); declareWar(a, b, targets.length ? 'conquest' : 'humiliate', targets, {free: true});
    const lines = []; const rep = d => [a, b].forEach(t => { const arms = armiesOf(t).filter(x => !x.sea); const tk = {}; let idle = 0, mv = 0, bt = 0; arms.forEach(x => { const k = (x.ai && x.ai.task) || (x.path.length ? 'mov' : 'none'); tk[k] = (tk[k] || 0) + 1; if (x.battle) bt++; else if (x.path.length) mv++; else idle++; });
      const c = G.C[t], dbg = c.m2 && c.m2.war && c.m2.war.dbg; lines.push('d' + d + ' ' + t + ' v' + c.aiV + ' arm' + arms.length + ' div' + arms.reduce((n, x) => n + x.divs.length, 0) + ' mov' + mv + ' bat' + bt + ' idle' + idle + ' tasks ' + JSON.stringify(tk) + ' occ' + G.P.filter((p, i) => p.by === t && provOwner(i) !== t).length + ' ' + JSON.stringify(dbg) + ' OPS ' + JSON.stringify(((c.m2 && c.m2.war && c.m2.war.ops) || []).map(o => o.k + ':' + o.ph)) + ' LOG ' + JSON.stringify((c.m2 && c.m2.war && c.m2.war.opLog) || [])); });
    for (let d = 1; d <= days; d++) { advanceDay(); if (G.pendingEvent) G.pendingEvent = null; if (d % step === 0) rep(d); }
    return lines.join('\n');
  }, {a, b, days, step, va, vb});
  console.log(out); await browser.close();
})();
