// Escenarios dirigidos para la IA de guerra: capital en peligro, territorio inútil, pasividad y debilidad.
// Cada escenario coloca ejércitos a mano y comprueba el comportamiento con la IA nueva (aiV=2) y la antigua (aiV=1).
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl']});
  const page = await browser.newPage({viewport: {width: 1000, height: 600}});
  let errs = 0; page.on('pageerror', e => { errs++; console.log('[pageerror]', e.message.slice(0, 300), (e.stack || '').split('\n').slice(0, 3).join('|')); });
  await page.goto('file://' + require('path').resolve(__dirname + '/../index.html'));
  await page.waitForSelector('#start .st-card', {timeout: 90000});
  await page.click('.st-card[data-tag=SAR]'); await page.click('button[data-act=start]'); await page.waitForTimeout(800);
  const snap = await page.evaluate(() => { G.paused = true; G.C[G.player].ai = true; return saveData(); });
  for (const ver of [2, 1]) {
    const r = await page.evaluate(({txt, ver}) => {
      const out = {};
      const setup = (a, d) => {
        loadData(txt); G.paused = true; G.C[G.player].ai = true; G.tags.forEach(t => { if (t !== NONE) G.C[t].aiV = 1; }); G.C[d].aiV = ver; G.C[a].aiV = 1;
        G.pacts = G.pacts.filter(p => ![a, d].includes(p.a) && ![a, d].includes(p.b)); G.C[a].bloc = G.C[d].bloc = null; G.C[a].overlord = G.C[d].overlord = null;
        G.armies = G.armies.filter(x => x.tag !== a && x.tag !== d); G.battles = []; G.recruits = G.recruits.filter(x => x.tag !== a && x.tag !== d);
        const targets = reachableStates(a, d).slice(0, 2).map(x => x.id); const w = declareWar(a, d, targets.length ? 'conquest' : 'humiliate', targets, {free: true}); return w && w.ok === false ? w.msg : null;
      };
      const dprovs = d => G.C[d].states.flatMap(s => MAP.stats[s].provs);
      const border = (a, d) => dprovs(d).filter(p => MAP.provs[p].nb.some(q => provOwner(q) === a));
      const stack = (tag, loc, n) => { const divs = []; for (let i = 0; i < n; i++) divs.push(mkDivision('inf', 0.5)); return mkArmy(tag, loc, divs); };
      // ---- Escenario A: capital en peligro. El atacante lanza una pila de 11 divisiones hacia la capital; el defensor tiene 6 ejércitos de 2 divisiones desperdigados por el fondo y la frontera.
      for (const [a, d] of [['AUS', 'PRU'], ['FRA', 'PRU'], ['RUS', 'AUS'], ['AUS', 'OTT']]) {
        const err = setup(a, d); if (err) { out['A_' + a + d] = 'omitida ' + err; continue; }
        const dp = dprovs(d), capP = MAP.stats[G.C[d].capital].provs[0], bp = border(a, d);
        if (!bp.length) { out['A_' + a + d] = 'sin frontera'; continue; }
        const far = dp.slice().sort((x, y) => provDist(y, capP) - provDist(x, capP));
        const defs = []; for (let i = 0; i < 6; i++) defs.push(stack(d, far[(i * 3) % far.length], 2));
        const atk = stack(a, bp[0], 11); const r0 = orderMove(atk, capP); const first = G.C[d].capital;
        let capHeld = 0, atCap = [], capture = -1;
        for (let day = 1; day <= 120; day++) { advanceDay(); if (G.pendingEvent) G.pendingEvent = null; const defPow = armiesOf(d).filter(x => provDist(x.loc, capP) < 6).reduce((n, x) => n + x.divs.length, 0); atCap.push(defPow); if (G.S[first].occ >= 1 && capture < 0) capture = day; }
        out['A_' + a + d] = {capturaDia: capture, defensoresCapitalMax: Math.max(...atCap), defensoresAlDia40: atCap[39], ejDef: armiesOf(d).length, divsDef: countDivs(d), divsAtk: countDivs(a)};
      }
      // ---- Escenario B: territorio inútil. Una pequeña incursión (2 divisiones) ataca la provincia de menor valor lejos de la capital mientras la fuerza principal (10 divs) avanza hacia la capital. El defensor tiene 9 divisiones.
      for (const [a, d] of [['AUS', 'PRU'], ['FRA', 'PRU']]) {
        const err = setup(a, d); if (err) { out['B_' + a + d] = 'omitida'; continue; }
        const dp = dprovs(d), capP = MAP.stats[G.C[d].capital].provs[0], bp = border(a, d); if (!bp.length) continue;
        const val = p => (G.S[provState(p)].gdp + 1) / MAP.stats[provState(p)].provs.length;
        const cheap = dp.slice().sort((x, y) => val(x) - val(y)).find(p => provDist(p, capP) > 12 && bp.includes(p)) ?? bp.slice().sort((x, y) => val(x) - val(y))[0];
        const main = stack(a, bp.slice().sort((x, y) => provDist(x, capP) - provDist(y, capP))[0], 10); orderMove(main, capP);
        const raid = stack(a, cheap, 2);
        const mid = dp.slice().sort((x, y) => provDist(x, capP) - provDist(y, capP))[4] ?? capP;
        for (let i = 0; i < 3; i++) stack(d, mid, 3);
        let toRaid = 0, atCapDays = 0, captured = -1; const first = G.C[d].capital;
        for (let day = 1; day <= 90; day++) { advanceDay(); if (G.pendingEvent) G.pendingEvent = null; if (armiesOf(d).some(x => provDist(x.loc, cheap) < 3 && !x.battle && x.divs.length >= 3)) toRaid++; if (armiesOf(d).filter(x => provDist(x.loc, capP) < 7).reduce((n, x) => n + x.divs.length, 0) >= 6) atCapDays++; if (G.S[first].occ >= 1 && captured < 0) captured = day; }
        out['B_' + a + d] = {díasEnLaIncursión: toRaid, díasGuardandoCapital: atCapDays, capturaDia: captured};
      }
      // ---- Escenario C: pasividad. El fuerte (14 divisiones) frente al débil (4): ¿cuántos días hasta pisar su territorio y ocupar?
      for (const [s, w] of [['FRA', 'PRU'], ['PRU', 'AUS'], ['AUS', 'FRA'], ['RUS', 'OTT']]) {
        const err = setup(w, s); if (err) { out['C_' + s + w] = 'omitida'; continue; }
        G.C[s].aiV = ver; G.C[w].aiV = 1;
        const sp = dprovs(s), bp = border(w, s); if (!bp.length) { out['C_' + s + w] = 'sin frontera'; continue; }
        for (let i = 0; i < 4; i++) stack(s, sp[(i * 5) % sp.length], 3); stack(s, bp[0], 2);
        const wp = dprovs(w); stack(w, wp[0], 2); stack(w, wp[wp.length - 1], 2);
        let enter = -1, occ = 0;
        for (let day = 1; day <= 150; day++) { advanceDay(); if (G.pendingEvent) G.pendingEvent = null; if (enter < 0 && armiesOf(s).some(x => provOwner(x.loc) === w)) enter = day; }
        G.P.forEach((p, i) => { if (p.by === s && provOwner(i) === w) occ++; });
        out['C_' + s + w] = {díaPrimeraEntrada: enter, provinciasOcupadas: occ, ociosos: armiesOf(s).filter(x => !x.path.length && !x.battle).length + '/' + armiesOf(s).length};
      }
      return JSON.stringify(out, null, 0);
    }, {txt: snap, ver});
    console.log('=== IA versión', ver, '===\n' + r.replace(/\},"/g, '},\n"'));
  }
  await browser.close(); process.exit(errs ? 1 : 0);
})();
