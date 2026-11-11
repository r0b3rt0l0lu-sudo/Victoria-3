// Genera las épocas de 1939 (Segunda Guerra Mundial) y 2020 (actual) a partir del mundo simulado de 1910: fija el reparto territorial
// (reutilizando países dormidos para las naciones nuevas), renombra, reparte tecnologías de las eras 4 y 5, pone alianzas y rivalidades y deja el mundo listo.
// Uso: node tools/anclar_epoca.js <1939|2020> <entrada1910.b64> <salida.b64>
const { chromium } = require('playwright'); const fs = require('fs'), zlib = require('zlib'), path = require('path');
const year = +process.argv[2], inp = process.argv[3], out = process.argv[4];
// tag: [nombre, gentilicio, color, bandera]   (los países que ya existen conservan color y bandera si se pone null)
const R39 = {
  PRU: ['Alemania', 'alemán', '#4a4f57', 'h3:#111:#c00:#fff'], AUS: ['Hungría', 'húngaro', '#4a8a4a', 'h3:#ce2939:#fff:#477050'], RUS: ['Unión Soviética', 'soviético', '#b03030', 'h2:#c8102e:#c8102e'], OTT: ['Turquía', 'turco', '#c0504a', 'disc:#e30a17:#fff'],
  BAV: ['Polonia', 'polaco', '#d86a7a', 'h2:#fff:#dc143c'], SER: ['Yugoslavia', 'yugoslavo', '#5a6fb0', 'h3:#0c4076:#fff:#c6363c'], WAL: ['Rumanía', 'rumano', '#d8c04a', 'v3:#002b7f:#fcd116:#ce1126'], KHI: ['Bulgaria', 'búlgaro', '#4a9a5a', 'h3:#fff:#00966e:#d62612'],
  SIK: ['Finlandia', 'finlandés', '#8ab0d8', 'cross:#fff:#003580:#003580'], CSA: ['Países Bálticos', 'báltico', '#9a8a5a', 'h3:#9e3039:#fff:#9e3039'], TWS: ['Irlanda', 'irlandés', '#4aa060', 'v3:#169b62:#fff:#ff883e'],
  EGY: ['Egipto', 'egipcio', '#c8b060', 'h3:#ce1126:#fff:#111'], TUS: ['Arabia Saudí', 'saudí', '#3a8a4a', 'h2:#006c35:#006c35'], HES: ['Noruega', 'noruego', '#c04a5a', 'cross:#ef2b2d:#fff:#002868'], ZUL: ['Sudáfrica', 'sudafricano', '#5a8a3a', 'h3:#e03c31:#fff:#001489'],
  CAN: null, AUL: null, CUB: null, JAP: ['Imperio del Japón', 'japonés', null, null], CHN: ['China', 'chino', null, 'h2:#de2910:#de2910']
};
const T39 = {
  PRU: 'Austria,Tirol,Estiria,Bohemia,Moravia', FRA: 'Lorena y Alsacia,Siria,Camerún', GBR: 'Tanganica,Nueva Guinea,Mesopotamia,Palestina', BAV: 'Polonia del Congreso,Galitzia,Posen', AUS: 'Hungría', SER: 'Serbia,Croacia,Bosnia,Dalmacia,Macedonia', WAL: 'Valaquia y Moldavia,Transilvania', KHI: 'Bulgaria',
  SIK: 'Finlandia', CSA: 'Livonia y Estonia', TWS: 'Leinster,Munster y Connacht', EGY: 'Egipto', TUS: 'Nejd,Hiyaz', HES: 'Noruega,Noruega Norte', CAN: 'Canadá Oriental,Canadá Occidental,Nueva Escocia,Tierras de la Bahía de Hudson,Columbia Británica',
  AUL: 'Nueva Gales del Sur,Victoria,Australia Occidental,Tasmania,Nueva Zelanda Norte,Nueva Zelanda Sur', ZUL: 'Colonia del Cabo,Zululandia,Rodesia,Namibia y Botsuana', CUB: 'Cuba', SAR: 'Etiopía', JAP: 'Liaoning,Heilongjiang,Zhili,Shandong,Jiangsu'
};
const R20 = {
  PRU: ['Alemania', 'alemán', '#4a4f57', 'h3:#111:#c00:#fc0'], AUS: ['Austria', 'austriaco', '#d9d6c4', 'h3:#ed2939:#fff:#ed2939'], RUS: ['Rusia', 'ruso', null, null], OTT: ['Turquía', 'turco', '#c0504a', 'disc:#e30a17:#fff'], SAR: ['Italia', 'italiano', null, null],
  BAV: ['Polonia', 'polaco', '#d86a7a', 'h2:#fff:#dc143c'], SAX: ['Ucrania', 'ucraniano', '#d8c040', 'h2:#0057b7:#ffd700'], HAN: ['Hungría', 'húngaro', '#4a8a4a', 'h3:#ce2939:#fff:#477050'], WUR: ['Chequia', 'checo', '#4a6ab0', 'h2:#fff:#d7141a'],
  BAD: ['Kazajistán', 'kazajo', '#4aa0c0', 'h2:#00afca:#00afca'], HES: ['India', 'indio', '#e8903a', 'h3:#ff9933:#fff:#138808'], MEC: ['Pakistán', 'pakistaní', '#2f7a3f', 'v3:#fff:#01411c:#01411c'], TWS: ['Indonesia', 'indonesio', '#c04a4a', 'h2:#ce1126:#fff'],
  PAP: ['Croacia', 'croata', '#6a8ad0', 'h3:#f00:#fff:#171796'], TUS: ['Arabia Saudí', 'saudí', '#3a8a4a', 'h2:#006c35:#006c35'], TEX: ['Nigeria', 'nigeriano', '#3a9a5a', 'v3:#008751:#fff:#008751'], KOR: ['Corea del Sur', 'surcoreano', '#5a7ad0', 'h2:#fff:#cd2e3a'],
  VIE: ['Vietnam', 'vietnamita', '#d84a3a', 'disc:#da251d:#ff0'], BRM: ['Myanmar', 'birmano', '#d8b030', 'h3:#fecb00:#34b233:#ea2839'], BUK: ['Uzbekistán', 'uzbeko', '#4a9ad0', 'h3:#0099b5:#fff:#1eb53a'], KHI: ['Bulgaria', 'búlgaro', '#4a9a5a', 'h3:#fff:#00966e:#d62612'],
  KOK: ['Turkmenistán', 'turcomano', '#3a9a6a', 'h2:#00843d:#00843d'], SIK: ['Finlandia', 'finlandés', '#8ab0d8', 'cross:#fff:#003580:#003580'], HYD: ['África Occidental Francófona', 'sahelí', '#c8903a', 'v3:#00853f:#fdef42:#e31b23'],
  EGY: ['Egipto', 'egipcio', '#c8b060', 'h3:#ce1126:#fff:#111'], MOR: ['Marruecos', 'marroquí', '#c04040', 'h2:#c1272d:#c1272d'], TUN: ['Túnez', 'tunecino', '#d04a4a', 'h2:#e70013:#e70013'], SOK: ['Sudán', 'sudanés', '#b09a5a', 'h3:#d21034:#fff:#111'],
  ASH: ['Ghana', 'ghanés', '#c8a83a', 'h3:#ce1126:#fcd116:#006b3f'], ZUL: ['Sudáfrica', 'sudafricano', '#5a8a3a', 'h3:#e03c31:#fff:#001489'], MDG: ['Madagascar', 'malgache', null, null], CSA: ['Países Bálticos', 'báltico', '#9a8a5a', 'h3:#9e3039:#fff:#9e3039'],
  RB1: ['Angola', 'angoleño', '#a05a3a', 'h2:#cc092f:#111'], RB2: ['Malasia', 'malasio', '#3a5aa0', 'h2:#cc0001:#010066'], RB3: ['Irlanda', 'irlandés', '#4aa060', 'v3:#169b62:#fff:#ff883e'], RB4: ['Noruega', 'noruego', '#c04a5a', 'cross:#ef2b2d:#fff:#002868'],
  CHN: ['China', 'chino', null, 'h2:#de2910:#de2910'], JAP: ['Japón', 'japonés', null, null], USA: ['Estados Unidos', 'estadounidense', null, null]
};
const T20 = {
  PRU: '', GBR: '', FRA: 'Lorena y Alsacia', BAV: 'Polonia del Congreso,Galitzia,Posen,Silesia,Prusia Oriental', AUS: 'Austria,Tirol,Estiria', HAN: 'Hungría', WUR: 'Bohemia,Moravia', SER: 'Serbia,Bosnia,Macedonia', PAP: 'Croacia,Dalmacia', WAL: 'Valaquia y Moldavia,Transilvania', KHI: 'Bulgaria',
  SIK: 'Finlandia', CSA: 'Livonia y Estonia', SAX: 'Ucrania Occidental,Ucrania Oriental,Nueva Rusia', GEO: 'Georgia', BAD: 'Estepa Kazaja', BUK: 'Bujará,Jiva,Kokand', KOK: 'Turkmenia', MNG: 'Mongolia', TWN: 'Taiwán',
  HES: 'Bengala,Bihar y Awadh,Bombay,Madrás,Orissa y Nagpur,Mysore,Rajputana,Malwa,Gujarat,Hyderabad,Cachemira,Assam,Ceilán', MEC: 'Sind,Punyab,Baluchistán', TWS: 'Java,Sumatra Sur,Aceh,Borneo,Sulawesi,Nueva Guinea', RB2: 'Malaca y Singapur,Estados Malayos', BRM: 'Birmania',
  VIE: 'Tonkín,Annam,Cochinchina', KHM: 'Laos,Camboya', KOR: 'Corea del Sur', PRK: 'Corea del Norte', PHL: 'Filipinas,Mindanao', CUB: 'Cuba', TUS: 'Nejd,Hiyaz', SYR: 'Siria', IRQ: 'Mesopotamia', ISR: 'Palestina', YEM: 'Yemen',
  EGY: 'Egipto,Nubia', SOK: 'Sudán,Darfur,Alto Nilo', TEX: 'Sokoto,Bornu,Nigeria Sur', ASH: 'Costa de Oro', ETH: 'Etiopía,Somalia', KEN: 'Zanzíbar', MDG: 'Madagascar', ZUL: 'Colonia del Cabo,Zululandia,Rodesia,Namibia y Botsuana', MOZ: 'Mozambique', RB1: 'Angola', COG: 'Congo',
  ALG: 'Argelia', MOR: 'Marruecos,Sáhara', TUN: 'Túnez', LBY: 'Libia,Fezzán', HYD: 'Senegambia,Malí,Dahomey y Oyo', RB3: 'Leinster,Munster y Connacht', RB4: 'Noruega,Noruega Norte', CAN: 'Canadá Oriental,Canadá Occidental,Nueva Escocia,Tierras de la Bahía de Hudson,Columbia Británica',
  AUL: 'Nueva Gales del Sur,Victoria,Australia Occidental,Tasmania,Nueva Zelanda Norte,Nueva Zelanda Sur'
};
const PACTS39 = {alliance: [['GBR', 'FRA'], ['GBR', 'BAV'], ['FRA', 'BAV'], ['GBR', 'CAN'], ['GBR', 'AUL'], ['GBR', 'ZUL'], ['PRU', 'SAR'], ['PRU', 'AUS'], ['PRU', 'WAL'], ['PRU', 'KHI'], ['PRU', 'JAP']], rival: [['PRU', 'BAV'], ['PRU', 'GBR'], ['PRU', 'FRA'], ['RUS', 'PRU'], ['JAP', 'CHN'], ['JAP', 'USA'], ['SAR', 'FRA']], nonagg: [['PRU', 'RUS']], guarantee: [['GBR', 'BAV'], ['FRA', 'BAV']]};
const PACTS20 = {alliance: [['USA', 'GBR'], ['USA', 'FRA'], ['USA', 'PRU'], ['USA', 'SAR'], ['USA', 'CAN'], ['USA', 'JAP'], ['USA', 'KOR'], ['USA', 'AUL'], ['USA', 'BAV'], ['GBR', 'FRA'], ['PRU', 'FRA'], ['RUS', 'CHN'], ['RUS', 'PRK']], rival: [['RUS', 'USA'], ['RUS', 'BAV'], ['RUS', 'SAX'], ['CHN', 'USA'], ['CHN', 'JAP'], ['HES', 'MEC'], ['PRK', 'KOR'], ['ISR', 'SYR'], ['ISR', 'PRS'], ['PRS', 'TUS'], ['CHN', 'HES']], nonagg: [], guarantee: [['USA', 'SAX'], ['USA', 'TWN'], ['GBR', 'SAX']]};
(async () => {
  const txt = zlib.gunzipSync(Buffer.from(fs.readFileSync(inp, 'utf8'), 'base64')).toString();
  const b = await chromium.launch({args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']});
  const p = await b.newPage({viewport: {width: 1200, height: 800}}); const errs = []; p.on('pageerror', e => errs.push(e.message.slice(0, 200)));
  await p.goto('file://' + path.resolve(__dirname, '..', 'index.html')); await p.waitForSelector('#start .st-card', {timeout: 250000});
  const cfg = year === 1939 ? {R: R39, T: T39, P: PACTS39} : {R: R20, T: T20, P: PACTS20};
  const res = await p.evaluate(([t, year, cfg]) => {
    loadData(t);
    G.wars.slice().forEach(w => { try { endWar(w, null); } catch (e) { } }); G.wars = []; G.tags.forEach(x => { G.C[x].wars = []; });
    const miss = [], log = [], byName = {}; G.S.forEach(s => { byName[s.name] = s; });
    // 1. territorios (1910 → época)
    Object.keys(cfg.T).forEach(tag => { if (!G.C[tag]) { miss.push('TAG ' + tag); return; } cfg.T[tag].split(',').filter(Boolean).forEach(nm => { const s = byName[nm]; if (!s) { miss.push(nm); return; } if (s.owner !== tag) { transferState(s, tag); log.push(nm + '→' + tag); } }); });
    // 2. nombres y banderas
    Object.keys(cfg.R).forEach(tag => { const r = cfg.R[tag], c = G.C[tag]; if (!c || !r) return; c.name = r[0]; c.adj = r[1]; if (r[2]) c.color = r[2]; if (r[3]) c.flagSpec = r[3]; });
    G.tags.forEach(x => { const c = G.C[x]; if (x !== NONE && c.states.length) { c.wars = []; c.claims = []; if (!c.states.includes(c.capital)) c.capital = c.states[0]; if (c.overlord && !alive(c.overlord)) c.overlord = null; c.capitalName = G.S[c.capital].name; } });
    // los países sin tierras: fuera ejércitos, pactos y vasallajes
    G.tags.forEach(x => { if (x === NONE || G.C[x].states.length) return; const c = G.C[x]; (c.subjects || []).forEach(s2 => { if (G.C[s2]) G.C[s2].overlord = null; }); c.subjects = []; c.overlord = null; });
    const dead = G.tags.filter(x => x !== NONE && !G.C[x].states.length); G.armies = G.armies.filter(a => !dead.includes(a.tag) || a.sea); G.pacts = G.pacts.filter(p => !dead.includes(p.a) && !dead.includes(p.b));
    G.tags.forEach(x => { const c = G.C[x]; if (c.subjects) c.subjects = c.subjects.filter(s2 => alive(s2) && G.C[s2].overlord === x); });
    // ejércitos y flotas de países nuevos: sus buques y divisiones pasan al nuevo dueño solo si ya existían (el resto se reparte al cargar la época)
    G.pacts = G.pacts.filter(p => !['alliance', 'rival', 'guarantee', 'nonagg'].includes(p.type)); G.blocs = []; G.tags.forEach(x => { G.C[x].bloc = null; });
    // 3. fecha y tecnologías
    const days = Math.round((year - G.date.y) * 365.25) + (year === 1939 ? 243 - G.date.m * 30 : -G.date.m * 30);
    G.date = {y: year, m: year === 1939 ? 8 : 0, d: 1, t: G.date.t + days};
    updateRanks();
    const h = s => { let x = 2166136261; for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 16777619); } return ((x >>> 0) % 10007) / 10007; };
    G.tags.forEach(x => { if (x === NONE || !alive(x)) return; const c = G.C[x], rk = c.rank || 50;
      const f = year === 1939 ? (rk <= 8 ? 1.01 : rk <= 16 ? 0.88 : rk <= 30 ? 0.68 : 0.45) : (rk <= 8 ? 1.01 : rk <= 20 ? 0.94 : rk <= 40 ? 0.82 : 0.66);
      let ch = true; while (ch) { ch = false; TECHS.forEach(tt => { if (c.techs.has(tt.id)) return; if (tt.after && tt.after > year) return; if (tt.until && tt.until < year) return; if (tt.ex && TECHS.some(o => o.ex === tt.ex && c.techs.has(o.id))) return; if (!(tt.req || []).every(r => c.techs.has(r))) return; if (h(tt.id + x) < f) { c.techs.add(tt.id); ch = true; } }); }
      c.research = null; c.innovStock = 0; });
    // 4. alianzas y rivalidades
    Object.keys(cfg.P).forEach(type => cfg.P[type].forEach(([a, bb]) => { if (alive(a) && alive(bb)) { try { makePact(type, a, bb, {forced: true}); } catch (e) { miss.push('pact ' + type + a + bb); } } }));
    G.battles = []; G.paused = true;
    for (let i = 0; i < 20; i++) { advanceDay(); if (G.pendingEvent) G.pendingEvent = null; }
    G.date.d = 1; G.date.t -= 20;
    G.wars.slice().forEach(w => { try { endWar(w, null); } catch (e) { } }); G.wars = []; G.battles = [];
    G.tags.forEach(x => { if (x !== NONE) { G.C[x].wars = []; G.C[x].lastWar = G.date.t; G.C[x].mob = (year === 1939 && ['PRU', 'BAV', 'GBR', 'FRA', 'RUS', 'SAR', 'JAP'].includes(x)) ? 2 : (G.C[x].rank || 99) <= 8 ? 1 : 0; } });
    G.tags.forEach(x => { if (!alive(x)) return; const cap = Math.min(Math.floor(divLimit(G.C[x]) * 0.7), 120); let n = countDivs(x); G.armies.filter(a => a.tag === x && !a.sea).forEach(a => { while (n > cap && a.divs.length) { a.divs.pop(); n--; } }); });
    G.armies = G.armies.filter(a => a.sea || (a.divs && a.divs.length));
    try { updateRanks(); } catch (e) { }
    // 5. 1939: empieza con la invasión de Polonia
    let war = null;
    if (year === 1939) { const ids = ['Polonia del Congreso', 'Galitzia'].map(n => byName[n].id); const r = declareWar('PRU', 'BAV', 'conquest', ids, {free: true}); war = r.ok ? 'ok' : r.msg; if (r.ok) { ['GBR', 'FRA', 'CAN', 'AUL', 'ZUL'].forEach(t => { if (alive(t) && !r.war.defAll.includes(t)) { r.war.defAll.push(t); G.C[t].wars.push(r.war.id); } }); G.C.BAV.treasury = Math.max(G.C.BAV.treasury, 400e6); G.C.BAV.mob = 3; } }
    return {log: log.length, miss, dead, vivos: G.tags.filter(alive).length, fecha: G.date.y + '-' + (G.date.m + 1) + '-' + G.date.d, war, tecn: ['GBR', 'PRU', 'USA', 'RUS', 'BAV', 'ETH'].map(x => x + ':' + (G.C[x] ? G.C[x].techs.size : '-')).join(' '), text: saveData()};
  }, [txt, year, cfg]);
  fs.writeFileSync(out, zlib.gzipSync(Buffer.from(res.text), {level: 9}).toString('base64'));
  console.log(year, 'transferencias', res.log, 'fallos', res.miss.join(','), 'extintos', res.dead.length, 'vivos', res.vivos, res.fecha, 'guerra', res.war, res.tecn, 'errores', errs.slice(0, 3)); await b.close();
})();
