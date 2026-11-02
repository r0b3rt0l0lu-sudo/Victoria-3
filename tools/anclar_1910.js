// Toma un mundo simulado (año 1910) y fija el reparto territorial de 1910-1914 según mapas históricos de referencia
// (imperios coloniales, Alemania e Italia unidas, reparto de África y Asia). La economía, tecnología y ejércitos salen de la simulación.
// Uso: node tools/anclar_1910.js <entrada.b64> <salida.b64>
const { chromium } = require('playwright'); const fs = require('fs'), zlib = require('zlib'), path = require('path');
const T = {
  GBR: 'Jamaica,Guayana Británica,Bengala,Bihar y Awadh,Bombay,Madrás,Orissa y Nagpur,Mysore,Ceilán,Malaca y Singapur,Estados Malayos,Rajputana,Malwa,Gujarat,Sind,Baluchistán,Punyab,Cachemira,Hyderabad,Birmania,Assam,Nueva Gales del Sur,Victoria,Australia Occidental,Tasmania,Nueva Zelanda Norte,Nueva Zelanda Sur,Colonia del Cabo,Zululandia,Rodesia,Egipto,Nubia,Sudán,Alto Nilo,Darfur,Nigeria Sur,Sokoto,Bornu,Costa de Oro,Somalia,Yemen,Zanzíbar,Canadá Oriental,Canadá Occidental,Nueva Escocia,Tierras de la Bahía de Hudson,Columbia Británica',
  FRA: 'Argelia,Túnez,Marruecos,Sáhara,Senegambia,Malí,Dahomey y Oyo,Madagascar,Camboya,Laos,Tonkín,Annam,Cochinchina,Córcega',
  PRU: 'Lorena y Alsacia,Holstein,Namibia y Botsuana,Camerún,Tanganica,Nueva Guinea',
  BEL: 'Congo',
  SAR: 'Lombardía-Venecia,Libia,Fezzán,Cerdeña',
  AUS: 'Bosnia,Dalmacia',
  USA: 'Texas,California,Nuevo México,Grandes Llanuras,Territorio de Oregón,Alaska Rusa,Hawái,Filipinas,Mindanao,Cuba,Puerto Rico',
  JAP: 'Corea del Norte,Corea del Sur,Taiwán',
  RUS: 'Turkmenia,Estepa Kazaja,Kokand,Bujará,Jiva',
  NET: 'Java,Sumatra Sur,Aceh,Borneo,Sulawesi',
  ARG: 'Patagonia', OTT: 'Nejd,Hiyaz', ETH: 'Etiopía'
};
(async () => {
  const [inp, out] = process.argv.slice(2);
  const txt = zlib.gunzipSync(Buffer.from(fs.readFileSync(inp, 'utf8'), 'base64')).toString();
  const b = await chromium.launch({args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']});
  const p = await b.newPage({viewport: {width: 1200, height: 800}});
  await p.goto('file://' + path.resolve(__dirname, '..', 'index.html')); await p.waitForSelector('#start .st-card', {timeout: 250000});
  const res = await p.evaluate(([t, T]) => {
    loadData(t);
    G.wars.slice().forEach(w => { try { endWar(w, null); } catch (e) { } }); G.wars = []; G.tags.forEach(x => { G.C[x].wars = []; });
    const leader = (tg, minors, name, adj) => { minors.forEach(m => { if (alive(m) && alive(tg)) annexWhole(tg, m); }); if (name && alive(tg)) { G.C[tg].name = name; G.C[tg].adj = adj; } };
    leader('PRU', ['BAV', 'SAX', 'HAN', 'WUR', 'BAD', 'HES', 'MEC'], 'Imperio Alemán', 'alemán');
    leader('SAR', ['TWS', 'PAP', 'TUS'], 'Italia', 'italiano');
    leader('GBR', ['EGY']);
    const byName = {}; G.S.forEach(s => { byName[s.name] = s; });
    const log = [], miss = [];
    Object.keys(T).forEach(tag => { if (!G.C[tag]) { miss.push(tag); return; } T[tag].split(',').forEach(nm => { const s = byName[nm]; if (!s) { miss.push(nm); return; } if (s.owner !== tag) { transferState(s, tag); log.push(nm + '→' + tag); } }); });
    // el resto del mundo vuelve a sus fronteras históricas (los países que la simulación había borrado reviven)
    const tabla = new Set(Object.values(T).join(',').split(',')), MERGE = {BAV: 'PRU', SAX: 'PRU', HAN: 'PRU', WUR: 'PRU', BAD: 'PRU', HES: 'PRU', MEC: 'PRU', TWS: 'SAR', PAP: 'SAR', TUS: 'SAR', EGY: 'GBR', KOR: 'JAP', TEX: 'USA'};
    G.S.forEach(s => { if (tabla.has(s.name)) return; let o = MAP.seeds[s.id].owner; if (MERGE[o]) o = MERGE[o]; if (!o || !G.C[o] || o === s.owner) return; transferState(s, o); log.push(s.name + '↩' + o); });
    G.tags.forEach(x => { const c = G.C[x]; if (x !== NONE && c.states.length) { c.wars = []; if (!c.states.includes(c.capital)) c.capital = c.states[0]; if (c.overlord && !alive(c.overlord)) c.overlord = null; } });
    // alianzas de 1910-1914: Entente (Reino Unido, Francia, Rusia, Japón), Tríplice (Alemania, Austria-Hungría, Italia) y el Imperio Otomano con Alemania
    G.pacts = G.pacts.filter(p => !['alliance', 'rival', 'guarantee'].includes(p.type));
    [['GBR', 'FRA'], ['FRA', 'RUS'], ['GBR', 'RUS'], ['GBR', 'JAP'], ['PRU', 'AUS'], ['PRU', 'SAR'], ['AUS', 'SAR'], ['PRU', 'OTT'], ['GBR', 'POR']].forEach(([x, y]) => { if (alive(x) && alive(y)) makePact('alliance', x, y, {forced: true}); });
    [['GBR', 'PRU'], ['FRA', 'PRU'], ['RUS', 'AUS'], ['RUS', 'OTT']].forEach(([x, y]) => { if (alive(x) && alive(y)) makePact('rival', x, y, {forced: true}); });
    // países sin tierras: fuera sus ejércitos, pactos y vasallajes
    G.tags.forEach(x => { if (x === NONE || G.C[x].states.length) return; const c = G.C[x]; (c.subjects || []).forEach(s2 => { if (G.C[s2]) G.C[s2].overlord = null; }); c.subjects = []; c.overlord = null; });
    const dead = G.tags.filter(x => x !== NONE && !G.C[x].states.length); G.armies = G.armies.filter(a => !dead.includes(a.tag)); G.pacts = G.pacts.filter(p => !dead.includes(p.a) && !dead.includes(p.b));
    G.tags.forEach(x => { const c = G.C[x]; if (c.subjects) c.subjects = c.subjects.filter(s2 => alive(s2) && G.C[s2].overlord === x); if (c.overlord && !alive(c.overlord)) c.overlord = null; });
    G.battles = []; G.paused = true;
    for (let i = 0; i < 20; i++) { advanceDay(); if (G.pendingEvent) G.pendingEvent = null; }            // se recalculan estadísticas, límites de divisiones y rangos con las nuevas fronteras
    G.wars.slice().forEach(w => { try { endWar(w, null); } catch (e) { } }); G.wars = []; G.battles = [];
    G.tags.forEach(x => { if (x !== NONE) { G.C[x].wars = []; G.C[x].lastWar = G.date.t; } });
    G.tags.forEach(x => { if (x !== NONE) G.C[x].mob = 0; });
    G.tags.forEach(x => { if (!alive(x)) return; const cap = Math.min(Math.floor(divLimit(G.C[x]) * 0.7), 120); let n = countDivs(x); G.armies.filter(a => a.tag === x && !a.sea).forEach(a => { while (n > cap && a.divs.length) { a.divs.pop(); n--; } }); });
    G.armies = G.armies.filter(a => a.sea || (a.divs && a.divs.length));
    try { updateRanks(); } catch (e) { }
    return {log, miss, dead, vivos: G.tags.filter(alive).length, fecha: G.date.y + '-' + G.date.m + '-' + G.date.d, text: saveData()};
  }, [txt, T]);
  fs.writeFileSync(out, zlib.gzipSync(Buffer.from(res.text), {level: 9}).toString('base64'));
  console.log('transferencias', res.log.length, 'fallos', res.miss.join(','), 'extintos', res.dead.join(','), 'vivos', res.vivos, res.fecha); console.log(res.log.join('; ').slice(0, 1500));
  await b.close();
})();
