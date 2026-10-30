// Torneo de IA de guerra: enfrenta parejas de países vecinos con la IA antigua (aiV=1) y la nueva (aiV=2), cambiando de bando,
// y mide: capital expuesta, ejércitos ociosos, defensa inútil, ocupaciones, resultado y bajas.
// Uso: node tools/prueba_ia.js [días] [parejas] [A:B ...]   (ej. node tools/prueba_ia.js 500 10 1:2)
const { chromium } = require('playwright');
(async () => {
  const days = +(process.argv[2] || 500), maxPairs = +(process.argv[3] || 10), modes = (process.argv.slice(4).length ? process.argv.slice(4) : ['1:1', '2:2', '1:2', '2:1']);
  const browser = await chromium.launch({args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl']});
  const page = await browser.newPage({viewport: {width: 1000, height: 600}});
  let errs = 0; page.on('pageerror', e => { errs++; console.log('[pageerror]', e.message.slice(0, 300), (e.stack || '').split('\n').slice(0, 3).join('|')); });
  await page.goto('file://' + require('path').resolve(__dirname + '/../index.html'));
  await page.waitForSelector('#start .st-card', {timeout: 90000});
  await page.click('.st-card[data-tag=SAR]'); await page.click('button[data-act=start]'); await page.waitForTimeout(800);
  const snap = await page.evaluate(() => { G.paused = true; G.C[G.player].ai = true; return saveData(); });
  const pairs = await page.evaluate(() => {
    const pw = t => armiesOf(t).reduce((n, a) => n + a.divs.length, 0), out = []; const tags = G.tags.filter(t => t !== NONE && G.C[t].states.length && pw(t) >= 3);
    tags.forEach(a => tags.forEach(b => { if (a >= b) return; if (!canReach(a, b)) return; const r = pw(a) / pw(b); if (r > 0.45 && r < 2.2) out.push([a, b, +r.toFixed(2), Math.min(pw(a), pw(b))]); }));
    out.sort((x, y) => y[3] - x[3]);
    return out;
  });
  const chosen = pairs.slice(0, maxPairs); console.log('parejas', chosen.map(p => p.join(':')).join(' '));
  const vsm = {}; const agg = {}, vs = {n: 0, occN: 0, occO: 0, casN: 0, casO: 0, capN: 0, capO: 0, statN: 0, statO: 0, divN: 0, divO: 0, idleN: 0, idleO: 0, offN: 0, offO: 0};
  for (const [a, b] of chosen) for (const m of modes) {
    const [va, vb] = m.split(':').map(Number);
    const r = await page.evaluate(({txt, a, b, va, vb, days}) => {
      loadData(txt); G.noOffers = true; G.paused = true; G.C[G.player].ai = true; G.tags.forEach(t => { if (t !== NONE) G.C[t].aiV = 1; }); G.C[a].aiV = va === 1 ? 1 : 2; G.C[b].aiV = vb === 1 ? 1 : 2; G.C[a].aiOps = va === 3; G.C[b].aiOps = vb === 3;
      // si alguno tiene tratado de alianza/protección se ignora: guerra limpia entre los dos
      G.pacts = G.pacts.filter(p => ![a, b].includes(p.a) && ![a, b].includes(p.b)); G.C[a].bloc = G.C[b].bloc = null; G.C[a].overlord = G.C[b].overlord = null;
      const targets = reachableStates(a, b).slice(0, 3).map(x => x.id); const w0 = declareWar(a, b, targets.length ? 'conquest' : 'humiliate', targets, {free: true}); if (w0 && w0.ok === false) return {skip: w0.msg};
      const st = {}; [a, b].forEach(t => st[t] = {capExp: 0, idle: 0, armyDays: 0, useless: 0, offDays: 0, misalloc: 0, capOccDays: 0, days: 0});
      const hostileNear = (cap, e) => { const provs = MAP.stats[cap].provs; let p = 0; armiesOf(e).forEach(x => { if (x.sea) return; if (provs.some(q => q === x.loc || MAP.provs[q].nb.includes(x.loc))) p += x.divs.length; }); return p; };
      const gd = t => { const c = G.C[t]; let tot = 0; c.states.forEach(s => tot += G.S[s].gdp + 1); return tot; };
      let ended = null, dEnd = days;
      for (let d = 0; d < days; d++) {
        advanceDay(); if (G.pendingEvent) G.pendingEvent = null;
        const w = G.wars.find(x => (x.att === a && x.def === b) || (x.att === b && x.def === a));
        if (!w) { ended = 'fin'; dEnd = d; break; }
        [[a, b], [b, a]].forEach(([t, e]) => {
          const c = G.C[t]; if (!c.states.length) return; const s = st[t]; s.days++;
          const arms = armiesOf(t).filter(x => !x.sea); if (!arms.length) return;
          const cap = c.capital, capProvs = cap >= 0 ? MAP.stats[cap].provs : [];
          const near = hostileNear(cap, e), defenders = arms.filter(x => capProvs.some(q => provDist(x.loc, q) < 8)).reduce((n, x) => n + x.divs.length, 0);
          if (near >= 2 && defenders < near * 0.7) { s.capExp++; const far = arms.filter(x => capProvs.every(q => provDist(x.loc, q) > 14) && !x.battle && !x.path.length && x.rest >= 8).reduce((n, x) => n + x.divs.length, 0); if (far >= 2) s.misalloc++; }
          if (cap >= 0 && G.S[cap].occ >= 1) s.capOccDays++;
          arms.forEach(x => { s.armyDays++; if (!x.battle && !x.path.length && x.rest >= 12 && x.mode !== 'train') s.idle++; if (provOwner(x.loc) === e || (G.P[x.loc].by === t)) s.offDays++; });
          // defensa inútil: ejército parado en una provincia de valor bajo mientras hay enemigos cerca de la capital
          if (near >= 1) arms.forEach(x => { if (x.battle || x.path.length) return; const pv = provOwner(x.loc) === t ? (G.S[provState(x.loc)].gdp + 1) / Math.max(1, MAP.stats[provState(x.loc)].provs.length) : 0; if (pv < gd(t) / 60 && !capProvs.includes(x.loc)) s.useless++; });
        });
      }
      const res = {ended: ended || 'sigue', dEnd}; const occ = t => { let n = 0; G.P.forEach((p, i) => { if (p.by === t && provOwner(i) !== t) n++; }); return n; };
      [a, b].forEach(t => { const s = st[t]; res[t] = {v: t === a ? va : vb, capExp: s.capExp, misalloc: s.misalloc, idleFrac: +(s.idle / Math.max(1, s.armyDays)).toFixed(3), offFrac: +(s.offDays / Math.max(1, s.armyDays)).toFixed(3), useless: s.useless, capOcc: s.capOccDays, occ: occ(t), cas: Math.round((G.C[t].cnt && G.C[t].cnt.casualties) || 0), divs: countDivs(t), states: G.C[t].states.length}; });
      const wl = G.battleLog || []; res.battles = wl.length;
      return res;
    }, {txt: snap, a, b, va, vb, days});
    if (r.skip) { console.log(a, b, 'omitida', r.skip); continue; }
    const key = m; agg[key] = agg[key] || {n: 0, capExp: 0, misalloc: 0, idle: 0, off: 0, useless: 0, occFor: 0, occAgainst: 0, ends: 0, capOcc: 0};
    const A = agg[key]; A.n++; ['a', 'b'].forEach((k, i) => { const t = i ? b : a, o = i ? a : b; A.capExp += r[t].capExp; A.misalloc += r[t].misalloc; A.idle += r[t].idleFrac; A.off += r[t].offFrac; A.useless += r[t].useless; A.capOcc += r[t].capOcc; A.occFor += r[t].occ; A.occAgainst += r[o].occ; });
    A.ends += r.ended === 'fin' ? 1 : 0;
    if (va !== vb) { const hi = Math.max(va, vb), lo = Math.min(va, vb), key2 = hi + 'v' + lo, nw = va > vb ? a : b, od = va > vb ? b : a; const V2 = vsm[key2] = vsm[key2] || {n: 0, occN: 0, occO: 0, casN: 0, casO: 0, capN: 0, capO: 0, statN: 0, statO: 0, divN: 0, divO: 0, idleN: 0, idleO: 0, offN: 0, offO: 0}; V2.n++; V2.occN += r[nw].occ; V2.occO += r[od].occ; V2.casN += r[nw].cas; V2.casO += r[od].cas; V2.capN += r[nw].capOcc; V2.capO += r[od].capOcc; V2.statN += r[nw].states; V2.statO += r[od].states; V2.divN += r[nw].divs; V2.divO += r[od].divs; V2.idleN += r[nw].idleFrac; V2.idleO += r[od].idleFrac; V2.offN += r[nw].offFrac; V2.offO += r[od].offFrac; }
    console.log(a + '-' + b, m, JSON.stringify({ended: r.ended + '@' + r.dEnd, [a]: r[a], [b]: r[b]}));
  }
  console.log('\nRESUMEN por modo (A:B) — promedio por bando');
  for (const m in agg) { const A = agg[m], n = A.n * 2; console.log(m, 'n=' + A.n, 'capitalExpuestaDías', (A.capExp / n).toFixed(1), 'malAsignados', (A.misalloc / n).toFixed(1), 'ociosos', (A.idle / n).toFixed(3), 'enTerrEnemigo', (A.off / n).toFixed(3), 'defensaInútil', (A.useless / n).toFixed(0), 'capOcupadaDías', (A.capOcc / n).toFixed(1), 'provOcupadas', (A.occFor / n).toFixed(1), 'guerrasFin', A.ends + '/' + A.n); }
  for (const key2 in vsm) { const V2 = vsm[key2], n = V2.n; console.log('\nVERSIÓN ' + key2.split('v')[0] + ' contra ' + key2.split('v')[1] + ' en', n, 'duelos (nueva | antigua): provincias ocupadas', V2.occN, '|', V2.occO, '· bajas', Math.round(V2.casN / 1000) + 'k |', Math.round(V2.casO / 1000) + 'k · días capital ocupada', V2.capN, '|', V2.capO, '· estados finales', V2.statN, '|', V2.statO, '· divisiones', V2.divN, '|', V2.divO, '· ociosos', (V2.idleN / n).toFixed(2), '|', (V2.idleO / n).toFixed(2), '· en territorio enemigo', (V2.offN / n).toFixed(2), '|', (V2.offO / n).toFixed(2)); }
  await browser.close(); process.exit(errs ? 1 : 0);
})();
