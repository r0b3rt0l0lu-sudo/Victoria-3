// Simulación completa con comprobaciones de integridad y métricas de equilibrio.
// Uso: node tools/simular_balance.js <TAG> [años] [semilla]   (TAG = país inicial; lo lleva la IA)
const { chromium } = require('playwright');
(async () => {
  const tag = process.argv[2] || 'GBR', years = +(process.argv[3] || 80), seed = +(process.argv[4] || 1);
  const browser = await chromium.launch({args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl']});
  const page = await browser.newPage({viewport: {width: 1200, height: 700}});
  const errs = []; page.on('pageerror', e => errs.push(e.message.slice(0, 300) + ' | ' + (e.stack || '').split('\n').slice(1, 3).join('|')));
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 200)); });
  await page.addInitScript(s => { let x = s * 2654435761 >>> 0; Math.random = () => { x = (x + 0x6D2B79F5) >>> 0; let t = x; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }, seed);
  await page.goto('file://' + require('path').resolve(__dirname + '/../index.html'));
  await page.waitForSelector('#start .st-card', {timeout: 90000});
  await page.click(`.st-card[data-tag=${tag}]`); await page.click('button[data-act=start]'); await page.waitForTimeout(800);
  await page.evaluate(() => { G.paused = true; G.C[G.player].ai = true; window._seen = new Set(); window._issues = {}; });
  const check = () => page.evaluate(() => {
    const issues = [], alive = G.tags.filter(t => t !== NONE && G.C[t].states.length);
    const bad = (k, m) => { window._issues[k] = (window._issues[k] || 0) + 1; if (window._issues[k] === 1) issues.push(m); };
    GOODS.forEach(g => { const p = G.price[g.id]; if (!isFinite(p) || p <= 0 || p > g.base * 40) bad('price_' + g.id, `precio ${g.id}=${p} (base ${g.base})`); });
    alive.forEach(t => { const c = G.C[t];
      if (!isFinite(c.treasury)) bad('nan_tr_' + t, `${t} tesorería NaN`); else if (Math.abs(c.treasury) > 5e10) bad('tr_big_' + t, `${t} tesorería ${c.treasury.toExponential(2)}`);
      ['legitimacy', 'prestige', 'influence', 'radicals', 'infamy'].forEach(k => { if (c[k] != null && !isFinite(c[k])) bad('nan_' + k + t, `${t}.${k} NaN`); });
      if (c.stats.pop !== c.stats.pop || c.stats.gdp !== c.stats.gdp) bad('nan_stats_' + t, `${t} stats NaN`);
      if (c.legitimacy < -50 || c.legitimacy > 200) bad('leg_' + t, `${t} legitimidad ${c.legitimacy}`);
    });
    G.armies.forEach(a => { if (!G.C[a.tag] || !G.C[a.tag].states.length) bad('army_orphan', `ejército de país extinto ${a.tag}`); if (!MAP.provs[a.loc]) bad('army_loc', `ejército sin provincia ${a.id}`); if (a.divs.some(d => !isFinite(d.s) || !isFinite(d.o) || d.s < 0)) bad('div_nan', 'división NaN'); });
    G.S.forEach(s => { if (s.owner !== NONE && !G.C[s.owner]) bad('state_owner', `estado ${s.name} dueño inválido`); });
    G.wars.forEach(w => window._seen.add(w.id));
    const sorted = alive.slice().sort((a, b) => G.C[b].states.length - G.C[a].states.length), tot = G.S.length;
    const gdp = alive.map(t => G.C[t].stats.gdp).sort((a, b) => b - a);
    return {y: G.date.y, n: alive.length, wars: G.wars.length, seen: window._seen.size, top: sorted.slice(0, 4).map(t => t + ':' + G.C[t].states.length).join(','), top1: +(G.C[sorted[0]].states.length / tot).toFixed(2),
      gdpTop: gdp[0] ? Math.round(gdp[0] / 1e6) : 0, gdpMed: gdp[Math.floor(gdp.length / 2)] ? Math.round(gdp[Math.floor(gdp.length / 2)] / 1e6) : 0, pop: Math.round(alive.reduce((n, t) => n + G.C[t].stats.pop, 0) / 1e6),
      priceAvg: +(GOODS.reduce((n, g) => n + G.price[g.id] / g.base, 0) / GOODS.length).toFixed(2), broke: alive.filter(t => G.C[t].treasury < 0).length, issues};
  });
  const rows = []; let y = 0;
  while (y < years) {
    const r = await page.evaluate(() => { try { for (let i = 0; i < 365 * 2; i++) { advanceDay(); if (G.pendingEvent) G.pendingEvent = null; } return 'ok'; } catch (e) { return 'EXC ' + e.message + ' @ ' + (e.stack || '').split('\n').slice(1, 4).join('|'); } });
    if (r !== 'ok') { console.log(tag, 'EXCEPCIÓN', r); errs.push(r); break; }
    y += 2; const c = await check(); rows.push(c); if (y % 8 === 0 || c.issues.length) console.log(tag, JSON.stringify(c));
  }
  const iss = await page.evaluate(() => window._issues);
  console.log(tag, 'RESUMEN', JSON.stringify({años: y, errores: errs.slice(0, 6), problemas: iss}));
  await browser.close(); process.exit(0);
})();
