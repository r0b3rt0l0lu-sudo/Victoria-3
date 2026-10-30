// Ofertas de paz intermedias: jugador exige/ofrece, la IA propone al jugador, y paces IA-IA.
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl']});
  const page = await browser.newPage({viewport: {width: 1500, height: 860}});
  let errs = 0; page.on('pageerror', e => { errs++; console.log('[pageerror]', e.message.slice(0, 300), (e.stack || '').split('\n').slice(0, 3).join('|')); });
  await page.goto('file://' + require('path').resolve(__dirname + '/../index.html'));
  await page.waitForSelector('#start .st-card', {timeout: 90000});
  await page.click('.st-card[data-tag=PRU]'); await page.click('button[data-act=start]'); await page.waitForTimeout(1000);
  const r = await page.evaluate(() => {
    G.paused = true; const out = {}; const a = 'PRU', d = 'AUS';
    G.pacts = G.pacts.filter(p => ![a, d].includes(p.a) && ![a, d].includes(p.b)); G.C[a].bloc = G.C[d].bloc = null;
    const targets = reachableStates(a, d).slice(0, 2).map(x => x.id); declareWar(a, d, 'conquest', targets, {free: true}); const w = G.wars[0];
    // el jugador ocupa un estado austríaco
    const sid = G.C[d].states[0]; MAP.stats[sid].provs.forEach(p => { G.P[p].by = a; G.occList.push(p); }); refreshStateOcc(sid); w.score = 45; w.weeks = 20; G.C[d].wear = 40;
    openPeaceOffer(w.id, 'demand'); const opts = offerOptions(w, a);
    out.opts = opts.map(o => o.id + ':' + o.cost).join(' ');
    const stateOpt = opts.find(o => o.type === 'state'); UI.po.pick.add(stateOpt.id); renderPeaceOffer();
    out.evSmall = JSON.stringify(offerEval(w, a, d, [stateOpt.id], 'demand'));
    out.evBig = JSON.stringify(offerEval(w, a, d, opts.filter(o => o.type !== 'law').map(o => o.id), 'demand').accept);
    out.dlg = document.getElementById('peacedlg').classList.contains('open');
    ACT.posend(); out.afterSend = JSON.stringify({wars: G.wars.length, owner: G.S[sid].owner, note: G.log[0] && G.log[0].text});
    return JSON.stringify(out);
  });
  console.log(r);
  await page.waitForTimeout(300); await page.screenshot({path: '/tmp/claude-0/paz1.png', timeout: 90000});
  // IA -> jugador, y IA vs IA
  const r2 = await page.evaluate(() => {
    G.paused = true; const out = {}; const a = 'FRA', d = 'PRU';
    G.pacts = G.pacts.filter(p => ![a, d].includes(p.a) && ![a, d].includes(p.b)); G.C[a].bloc = G.C[d].bloc = null;
    const targets = reachableStates(a, d).slice(0, 2).map(x => x.id); declareWar(a, d, targets.length ? 'conquest' : 'humiliate', targets, {free: true}); const w = G.wars.find(x => x.att === a && x.def === d);
    const sid = G.C[d].states[0]; MAP.stats[sid].provs.forEach(p => { G.P[p].by = a; G.occList.push(p); }); refreshStateOcc(sid);
    w.score = 60; w.weeks = 30; G.C[a].wear = 45; G.C[d].wear = 50;      // FRA (IA) va ganando contra el jugador
    for (let i = 0; i < 12 && !G.proposals.some(p => p.type === 'peace'); i++) { w.poT = -99; peaceOffersWeek(); }
    const pp = G.proposals.find(p => p.type === 'peace'); out.prop = pp ? JSON.stringify({dir: pp.dir, ids: pp.ids, from: pp.from}) : 'ninguna';
    out.html = pp ? peaceProposalHtml(pp).length : 0;
    if (pp) { respondPeace(pp.id, true); out.afterAccept = JSON.stringify({war: !!G.wars.find(x => x === w)}); }
    // IA vs IA
    G.tags.forEach(t => { if (t !== NONE) G.C[t].ai = t !== 'PRU'; });
    const x = 'RUS', y = 'OTT'; G.pacts = G.pacts.filter(p => ![x, y].includes(p.a) && ![x, y].includes(p.b)); G.C[x].bloc = G.C[y].bloc = null;
    declareWar(x, y, 'humiliate', [], {free: true}); const w2 = G.wars.find(q => q.att === x && q.def === y);
    if (w2) { w2.score = -55; w2.weeks = 40; G.C[y].wear = 50; G.C[x].wear = 60; let ended = false; for (let i = 0; i < 20 && !ended; i++) { w2.poT = -99; peaceOffersWeek(); ended = !G.wars.includes(w2); } out.aiPeace = ended; }
    return JSON.stringify(out);
  });
  console.log(r2);
  await browser.close(); process.exit(errs ? 1 : 0);
})();
