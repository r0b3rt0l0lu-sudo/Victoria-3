// Genera una instantánea del mundo simulado por la IA desde 1836 hasta el 1 de enero de <año> (todos los países en manos de la IA).
// Uso: node tools/generar_escenario.js <año> <semilla> [salida]     → escenarios/<año>_<semilla>.b64 (gzip + base64) y .json con métricas
const { chromium } = require('playwright'); const fs = require('fs'), zlib = require('zlib'), path = require('path');
(async () => {
  const year = +process.argv[2] || 1861, seed = +process.argv[3] || 1, outDir = path.resolve(__dirname, '..', 'escenarios'), base = path.join(outDir, `${year}_${seed}`);
  const browser = await chromium.launch({args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl']});
  const page = await browser.newPage({viewport: {width: 1200, height: 700}}); const errs = []; page.on('pageerror', e => errs.push(e.message.slice(0, 200)));
  await page.addInitScript(s => { let x = s * 2654435761 >>> 0; Math.random = () => { x = (x + 0x6D2B79F5) >>> 0; let t = x; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }, seed);
  await page.goto('file://' + path.resolve(__dirname, '..', 'index.html')); await page.waitForSelector('#start .st-card', {timeout: 90000});
  await page.click('.st-card[data-tag=GBR]'); await page.click('button[data-act=start]'); await page.waitForTimeout(800);
  await page.evaluate(() => { G.paused = true; G.noOffers = false; G.tags.forEach(t => { G.C[t].ai = true; }); });
  let y = 1836;
  while (y < year) {
    const r = await page.evaluate(yr => { try { const t0 = G.date.y; while (G.date.y === t0) { advanceDay(); if (G.pendingEvent) G.pendingEvent = null; } return 'ok'; } catch (e) { return 'EXC ' + e.message; } }, year);
    if (r !== 'ok') { console.log('EXCEPCIÓN', r); break; } y++; if (y % 5 === 0) console.log(year, seed, 'año', y);
  }
  const met = await page.evaluate(() => { const alive = G.tags.filter(t => t !== NONE && G.C[t].states.length), top = alive.slice().sort((a, b) => G.C[b].states.length - G.C[a].states.length).slice(0, 8).map(t => t + ':' + G.C[t].states.length);
    return {y: G.date.y, m: G.date.m, d: G.date.d, paises: alive.length, top, guerras: G.wars.length, pais: alive.join(','), gbr: G.C.GBR.states.length, hist: Object.keys(G.eventCool).filter(k => k.startsWith('h_')).join(','), pruName: G.C.PRU.name, sarName: G.C.SAR.name, jap: G.C.JAP.name}; });
  const text = await page.evaluate(() => saveData());
  fs.writeFileSync(base + '.b64', zlib.gzipSync(Buffer.from(text), {level: 9}).toString('base64')); fs.writeFileSync(base + '.json', JSON.stringify(Object.assign({bytes: text.length, errs: errs.slice(0, 3)}, met), null, 1));
  console.log(year, seed, 'LISTO', JSON.stringify(met).slice(0, 400), 'json', text.length, 'b64', fs.statSync(base + '.b64').size);
  await browser.close();
})();
