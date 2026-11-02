// Limpia un mundo generado: los estados aislados y lejanos de países no coloniales (o coloniales en Europa) pasan a un vecino plausible.
// Uso: node tools/limpiar_escenario.js <entrada.b64> <salida.b64>
const { chromium } = require('playwright'); const fs = require('fs'), zlib = require('zlib');
(async () => {
  const [inp, out] = process.argv.slice(2);
  const txt = zlib.gunzipSync(Buffer.from(fs.readFileSync(inp, 'utf8'), 'base64')).toString();
  const b = await chromium.launch({args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']});
  const p = await b.newPage({viewport: {width: 1200, height: 800}});
  await p.goto('file://' + __dirname.replace(/tools$/, '') + 'index.html'); await p.waitForSelector('#start .st-card', {timeout: 200000});
  const res = await p.evaluate(t => {
    loadData(t); const moved = [];
    for (let pass = 0; pass < 4; pass++) { let n = 0;
      G.tags.slice().forEach(tg => { if (tg === NONE) return; const c = G.C[tg]; if (!c.states.length || c.states.length < 2) return;
        const set = new Set(c.states), comp = {}, comps = []; c.states.forEach(st => { if (comp[st] !== undefined) return; const m = []; const q = [st]; comp[st] = comps.length; while (q.length) { const x = q.shift(); m.push(x); G.S[x].neigh.forEach(y => { if (set.has(y) && comp[y] === undefined) { comp[y] = comps.length; q.push(y); } }); } comps.push(m); });
          const score = m => m.reduce((n, x) => n + (MAP.seeds[x].owner === tg ? 3 : 0) + (x === c.capital ? 30 : 0) + 0.01, 0); let best = comps[0]; comps.forEach(m => { if (score(m) > score(best)) best = m; }); const seen = new Set(best);
          if (!seen.has(c.capital)) c.capital = best[0];
          c.states.filter(id => !seen.has(id)).forEach(id => {
          const pl = stateLL(id); let dmin = 1e9; seen.forEach(o => { dmin = Math.min(dmin, llDist(stateLL(o), pl)); });
          const interior = pl.lat > 42 && pl.lon > 38 && !['RUS', 'OTT', 'CHN', 'JAP', 'PRS', 'BUK', 'KHI', 'KOK'].includes(tg); const ok = MAP.seeds[id].owner === tg || (!interior && (dmin <= 22 || (['GBR', 'FRA', 'NET', 'POR', 'SPA', 'BEL', 'RUS'].includes(tg) && !llEurope(pl)))); if (ok) return;
          const cnt = {}; G.S[id].neigh.forEach(m => { const o = G.S[m].owner; if (o !== tg && o !== NONE && G.C[o].states.length) cnt[o] = (cnt[o] || 0) + 1; });
          let to = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a])[0];
          if (!to) { let bd = 1e9; G.tags.forEach(o => { if (o === NONE || o === tg || !G.C[o].states.length) return; const d = Math.min(...G.C[o].states.map(s => llDist(stateLL(s), pl))); if (d < bd) { bd = d; to = o; } }); }
          if (to) { moved.push(G.S[id].name + ': ' + tg + '→' + to); transferState(G.S[id], to); n++; } }); });
      if (!n) break; }
    // Estados Unidos recupera su territorio original si una potencia colonial se lo quedó (los mundos simulados lo desmembraban)
    if (G.C.USA && G.C.USA.states.length) G.S.forEach(st => { if (MAP.seeds[st.id].owner === 'USA' && st.owner !== 'USA' && st.owner !== NONE) { moved.push(st.name + ': ' + st.owner + '→USA'); transferState(st, 'USA'); } });
    return {moved, text: saveData()};
  }, txt);
  fs.writeFileSync(out, zlib.gzipSync(Buffer.from(res.text), {level: 9}).toString('base64'));
  console.log('movidos', res.moved.length, res.moved.slice(0, 60).join('; '));
  await b.close();
})();
