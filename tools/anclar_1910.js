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
  ARG: 'Patagonia', OTT: 'Nejd,Hiyaz', ETH: 'Etiopía,Somalia'
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
    // todo estado de seed propia vuelve a su dueño original si lo conserva la IA fuera de la tabla y el original sigue vivo y colindante
    const tabla = new Set(Object.values(T).join(',').split(','));
    G.S.forEach(s => { if (tabla.has(s.name)) return; const o = MAP.seeds[s.id].owner; if (o && o !== s.owner && G.C[o] && G.C[o].states.length && !['PRU', 'SAR'].includes(o) && !(o === 'USA' || o === 'GBR') && !['BAV', 'SAX', 'HAN', 'WUR', 'BAD', 'HES', 'MEC', 'TWS', 'PAP', 'TUS', 'EGY'].includes(o)) { transferState(s, o); log.push(s.name + '↩' + o); } });
    // países sin tierras: fuera sus ejércitos, pactos y vasallajes
    G.tags.forEach(x => { if (x === NONE || G.C[x].states.length) return; const c = G.C[x]; (c.subjects || []).forEach(s2 => { if (G.C[s2]) G.C[s2].overlord = null; }); c.subjects = []; c.overlord = null; });
    const dead = G.tags.filter(x => x !== NONE && !G.C[x].states.length); G.armies = G.armies.filter(a => !dead.includes(a.tag)); G.pacts = G.pacts.filter(p => !dead.includes(p.a) && !dead.includes(p.b));
    G.tags.forEach(x => { const c = G.C[x]; if (c.subjects) c.subjects = c.subjects.filter(s2 => alive(s2) && G.C[s2].overlord === x); if (c.overlord && !alive(c.overlord)) c.overlord = null; });
    try { updateRanks(); } catch (e) { }
    return {log, miss, dead, vivos: G.tags.filter(alive).length, text: saveData()};
  }, [txt, T]);
  fs.writeFileSync(out, zlib.gzipSync(Buffer.from(res.text), {level: 9}).toString('base64'));
  console.log('transferencias', res.log.length, 'fallos', res.miss.join(','), 'extintos', res.dead.join(','), 'vivos', res.vivos); console.log(res.log.join('; ').slice(0, 1500));
  await b.close();
})();
