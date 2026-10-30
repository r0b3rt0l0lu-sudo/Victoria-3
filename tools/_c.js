const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl']});
  const page = await browser.newPage({viewport: {width: 1000, height: 600}});
  page.on('pageerror', e => console.log('[pageerror]', e.message.slice(0, 300), (e.stack||'').split('\n').slice(0,3).join('|')));
  await page.goto('file://' + require('path').resolve(__dirname + '/../index.html'));
  await page.waitForSelector('#start .st-card', {timeout: 90000});
  await page.click('.st-card[data-tag=SAR]'); await page.click('button[data-act=start]'); await page.waitForTimeout(800);
  const [s, w] = [process.argv[2] || 'PRU', process.argv[3] || 'AUS'];
  console.log(await page.evaluate(({s, w}) => { G.paused = true; G.C[G.player].ai = true; G.tags.forEach(t => { if (t !== NONE) G.C[t].aiV = 1; }); G.C[s].aiV = 2;
    G.pacts = G.pacts.filter(p => ![s, w].includes(p.a) && ![s, w].includes(p.b)); G.C[s].bloc = G.C[w].bloc = null; G.C[s].overlord = G.C[w].overlord = null;
    G.armies = G.armies.filter(x => x.tag !== s && x.tag !== w); G.battles = []; G.recruits = G.recruits.filter(x => x.tag !== s && x.tag !== w);
    const targets = reachableStates(s, w).slice(0, 2).map(x => x.id); declareWar(s, w, 'conquest', targets, {free: true});
    const dprovs = d => G.C[d].states.flatMap(s2 => MAP.stats[s2].provs); const sp = dprovs(s), bp = dprovs(w).filter(p => MAP.provs[p].nb.some(q => provOwner(q) === s));
    const stack = (tag, loc, n) => { const divs = []; for (let i = 0; i < n; i++) divs.push(mkDivision('inf', 0.5)); return mkArmy(tag, loc, divs); };
    for (let i = 0; i < 4; i++) stack(s, sp[(i * 5) % sp.length], 3); stack(s, MAP.provs[bp[0]].nb.find(q => provOwner(q) === s), 2);
    const wp = dprovs(w); stack(w, wp[0], 2); stack(w, wp[wp.length - 1], 2);
    const out = [];
    for (let d = 1; d <= 90; d++) { advanceDay(); if (G.pendingEvent) G.pendingEvent = null; if (d % 10 === 0) { const c = G.C[s]; out.push('d' + d + ' ' + JSON.stringify(c.m2 && c.m2.war && c.m2.war.dbg) + ' arms ' + armiesOf(s).map(x => (x.ai ? x.ai.task : '-') + '@' + x.loc + (x.path.length ? '>' + x.dest : '') + 'x' + x.divs.length).join(' ')); } }
    out.push('capital w ' + G.C[w].capital + ' enemy armies ' + armiesOf(w).map(x => x.loc + 'x' + x.divs.length).join(' '));
    return out.join('\n'); }, {s, w}));
  await browser.close();
})();
