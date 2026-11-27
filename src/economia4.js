/* ===== ECONOMÍA 4: instituciones económicas (estudio histórico) =====
   Diez «instituciones» que los Estados fueron adoptando entre 1830 y 1945 y que las leyes de data.js no cubren. Cada una tiene niveles ordenados;
   se sube o baja UN nivel cada vez (no se pueden saltar etapas), solo desde el año histórico en que existió, y cuesta influencia y tesoro.
   Efectos: modificadores del país (ecoMods), costes y riesgos mensuales y satisfacción de los grupos de interés. Guardado en c.eco.inst.
   Fuentes de las fechas: patrón oro (RU 1821, Alemania 1872, EE. UU. de facto 1879/1900), Bank Charter Act 1844, sociedades anónimas RU 1844 y
   responsabilidad limitada 1855-62, patentes (EE. UU. 1790, RU 1852, Convenio de París 1883), seguros sociales de Bismarck (1883-89), Zollverein 1834,
   Interstate Commerce Act 1887 y Sherman 1890, nacionalización ferroviaria prusiana (1879-86), Federal Reserve 1913, SEC 1934, Keynes 1936, Beveridge 1942,
   Bretton Woods 1944. Claves de efectos: tax, invest, innov, indOut, out, lab, rad, stab, crisis, constr, grow, lit, army, milCost. */
const INST = [
  {id: 'monetary', icon: '🪙', name: 'Sistema monetario', levels: [
    {n: 'Papel moneda inconvertible', y: 0, m: {tax: .03, invest: -.04, crisis: -.10}, d: 'Se financia imprimiendo: recauda más hoy, pero hay inflación y desconfianza.'},
    {n: 'Bimetalismo (oro y plata)', y: 0, m: {}, d: 'Moneda metálica con dos patrones; sufre con las oscilaciones de la plata.'},
    {n: 'Patrón oro', y: 1836, m: {invest: .04, crisis: .05, tax: -.005}, ig: {indus: 0.6, intel: 0.4, rural: -0.3}, d: 'Convertibilidad al oro (RU 1821, Alemania 1872, EE. UU. 1900): confianza y comercio, pero obliga a mantener reservas y deflaciona.', need: c => c.treasury >= 0},
    {n: 'Patrón de cambio oro', y: 1900, m: {invest: .05, crisis: .08, tax: -.01}, d: 'Reservas en divisas convertibles: más flexible, vulnerable a las crisis financieras de los años 30.'},
    {n: 'Dinero fiduciario administrado', y: 1931, m: {invest: .05, crisis: .10, tax: .02, stab: -.3}, d: 'Fin del oro como ancla (RU 1931, EE. UU. 1933): margen para la política monetaria y riesgo de inflación; Bretton Woods (1944) lo ordena.'}
  ]},
  {id: 'bank', icon: '🏦', name: 'Sistema bancario', levels: [
    {n: 'Sin banca organizada', y: 0, m: {invest: -.05, crisis: -.06}, d: 'Prestamistas locales y casas de comercio.'},
    {n: 'Bancos privados libres', y: 0, m: {invest: .02, crisis: -.08}, d: 'Crédito abundante y pánicos bancarios sin red de seguridad.'},
    {n: 'Banco nacional privilegiado', y: 1830, m: {invest: .04, crisis: .06}, d: 'Banco emisor con monopolio de billetes (Banco de Inglaterra tras la Ley de 1844).'},
    {n: 'Banco central prestamista', y: 1900, m: {invest: .05, crisis: .15}, tech: 'central_bank', d: 'Prestamista de última instancia (Reserva Federal, 1913): amortigua los pánicos.'},
    {n: 'Banca pública y crédito dirigido', y: 1933, m: {invest: .05, crisis: .12, indOut: .02, tax: .02}, ig: {indus: -0.4, union: 0.4}, d: 'El Estado orienta el crédito (IRI italiano, 1933; Reichsbank dirigido): menos libertad, más control.'}
  ]},
  {id: 'company', icon: '📈', name: 'Derecho de sociedades', levels: [
    {n: 'Gremios y monopolios privilegiados', y: 0, m: {invest: -.04, innov: -.03}, d: 'Cada empresa necesita un privilegio real.'},
    {n: 'Sociedades por concesión', y: 0, m: {}, d: 'Compañías con carta del Estado.'},
    {n: 'Sociedad anónima libre', y: 1844, m: {invest: .05, innov: .02}, bubble: 1, d: 'Registro abierto de sociedades (RU 1844): capital para ferrocarriles y minas; manías especulativas.'},
    {n: 'Responsabilidad limitada', y: 1855, m: {invest: .08, innov: .03}, bubble: 1.5, ig: {indus: 0.5, petty: -0.2}, d: 'Los socios solo arriesgan lo aportado (RU 1855-62): el gran salto de la inversión privada.'},
    {n: 'Bolsa regulada y auditoría', y: 1934, m: {invest: .06, crisis: .06, innov: .02}, d: 'Comisión de valores (SEC, 1934): menos fraude y burbujas.'}
  ]},
  {id: 'patent', icon: '💡', name: 'Propiedad industrial', levels: [
    {n: 'Sin protección', y: 0, m: {innov: -.02}, d: 'Las invenciones se copian libremente.'},
    {n: 'Patentes nacionales', y: 1836, m: {innov: .04}, d: 'Monopolio temporal al inventor (EE. UU. 1790, RU 1852).'},
    {n: 'Convenio internacional', y: 1883, m: {innov: .06, tax: -.005}, d: 'Convenio de París (1883): protección fuera de las fronteras.'},
    {n: 'Oficina técnica e I+D estatal', y: 1920, m: {innov: .09, tax: -.01}, cost: 0.004, d: 'Laboratorios públicos y normalización industrial.'}
  ]},
  {id: 'social', icon: '🩺', name: 'Seguros sociales', levels: [
    {n: 'Beneficencia local', y: 0, m: {}, d: 'Parroquias y caridad.'},
    {n: 'Mutualidades y cajas de socorro', y: 1840, m: {rad: -.04}, d: 'Sociedades obreras de ayuda mutua.'},
    {n: 'Seguro obligatorio de accidente y enfermedad', y: 1883, m: {rad: -.12, lab: .03, stab: .3}, cost: 0.006, ig: {union: 0.8, indus: -0.3}, d: 'Leyes de Bismarck (1883-84): el Estado obliga a asegurar a los obreros.'},
    {n: 'Pensiones de vejez e invalidez', y: 1889, m: {rad: -.18, lab: .04, stab: .5}, cost: 0.011, ig: {union: 1, indus: -0.5}, d: 'Pensiones públicas (Alemania 1889, RU 1908).'},
    {n: 'Estado del bienestar', y: 1942, m: {rad: -.28, lab: .06, stab: 1, lit: .02}, cost: 0.02, ig: {union: 1.4, indus: -0.8}, d: 'Informe Beveridge (1942): cobertura universal desde la cuna a la tumba.'}
  ]},
  {id: 'market', icon: '🛤️', name: 'Mercado interior', levels: [
    {n: 'Aduanas interiores y pesos dispares', y: 0, m: {out: -.03, invest: -.02}, d: 'Peajes entre territorios, monedas y medidas distintas.'},
    {n: 'Unión aduanera', y: 1834, m: {out: .02, tax: -.01}, d: 'Zollverein (1834): libre paso de mercancías entre los miembros.'},
    {n: 'Mercado nacional unificado', y: 1860, m: {out: .04, invest: .02}, d: 'Sistema métrico, moneda y códigos comunes.'},
    {n: 'Bloque económico preferente', y: 1932, m: {out: .03, tax: .03, innov: -.01}, d: 'Preferencia imperial (Ottawa, 1932) y áreas monetarias cerradas.'}
  ]},
  {id: 'cartel', icon: '🏭', name: 'Política de competencia', levels: [
    {n: 'Cárteles libres', y: 0, m: {indOut: .02, innov: -.02, lab: -.02}, d: 'Pactos de precios y de reparto de mercados.'},
    {n: 'Regulación de tarifas', y: 1887, m: {out: .01, lab: .01}, d: 'Comisión de comercio interestatal (EE. UU., 1887): tarifas ferroviarias públicas.'},
    {n: 'Ley antimonopolio', y: 1890, m: {innov: .03, indOut: -.01, lab: .02}, ig: {petty: 0.6, indus: -0.4}, d: 'Ley Sherman (1890): se persiguen trusts y pactos.'},
    {n: 'Economía concertada', y: 1933, m: {indOut: .04, innov: -.01, rad: -.03}, ig: {indus: 0.2, union: 0.3}, d: 'Cárteles obligatorios y corporativismo (Alemania e Italia, años 30).'}
  ]},
  {id: 'rail', icon: '🚂', name: 'Régimen ferroviario', levels: [
    {n: 'Concesión privada', y: 0, m: {}, d: 'Compañías privadas construyen y explotan.'},
    {n: 'Garantía de interés del Estado', y: 1840, m: {constr: .15, tax: -.01}, d: 'El Estado garantiza el rendimiento del capital (India, Francia).'},
    {n: 'Red estatal', y: 1850, m: {constr: .08, tax: .02, logistics: .05}, ig: {indus: -0.4, armed: 0.5}, d: 'Nacionalización (Prusia 1879-86, Suiza 1898): planificación y uso militar.'}
  ]},
  {id: 'fiscal', icon: '📊', name: 'Gestión de la demanda', levels: [
    {n: 'Presupuesto equilibrado', y: 0, m: {}, d: 'El dogma: gastar solo lo que se ingresa.'},
    {n: 'Obras públicas anticíclicas', y: 1900, m: {crisis: .06, constr: .05}, d: 'Gasto público para amortiguar las depresiones.'},
    {n: 'Estabilizadores y demanda keynesiana', y: 1936, m: {crisis: .13, rad: -.05, invest: .02}, d: 'Teoría General de Keynes (1936) y New Deal: déficit controlado para sostener el empleo.', need: c => hasTech(c, 'statistics') || G.date.y >= 1940}
  ]},
  {id: 'indpol', icon: '⚙️', name: 'Política industrial', levels: [
    {n: 'Sin política industrial', y: 0, m: {}, d: 'El mercado decide.'},
    {n: 'Protección de la industria naciente', y: 1836, m: {indOut: .03, tax: .01, innov: -.01}, d: 'Aranceles selectivos (List, Hamilton).'},
    {n: 'Fomento y modernización estatal', y: 1868, m: {indOut: .05, constr: .06, invest: .01}, cost: 0.004, d: 'Fábricas modelo y préstamos (Meiji, Rusia de Witte).'},
    {n: 'Complejo militar-industrial', y: 1900, m: {indOut: .04, army: .05, milCost: -.05, rad: .02}, cost: 0.006, ig: {armed: 1, indus: 0.3}, d: 'Astilleros, arsenales y fábricas de armas con contratos estatales.'}
  ]}
];
const INST_BY = {}; INST.forEach(d => INST_BY[d.id] = d);
const instOf = c => { const e = ecoOf(c); if (!e.inst) e.inst = instInit(c); return e.inst; };
// nivel histórico de referencia para un país y año (se usa para inicializar y para que la IA converja)
function instBaseline(c, id, y) {
  y = y || G.date.y; const adv = c.rank <= 7 ? 0 : c.rank <= 14 ? 1 : c.rank <= 26 ? 2 : 3, lib = c.profile === 'liberal' || c.profile === 'republic' || c.profile === 'western', plan = c.ideo === 'communist' || c.ideo === 'fascist' || (c.laws && c.laws.economy === 'planned');
  const B = {
    monetary: y < 1870 ? 1 : y < 1931 ? 2 : y < 1944 ? 3 : 4, bank: y < 1850 ? 1 : y < 1900 ? 2 : y < 1933 ? 3 : (plan ? 4 : 3), company: y < 1850 ? 1 : y < 1860 ? 2 : y < 1934 ? 3 : 4,
    patent: y < 1883 ? 1 : y < 1920 ? 2 : 3, social: y < 1883 ? (y > 1850 ? 1 : 0) : y < 1900 ? 2 : y < 1930 ? 2 : y < 1942 ? 3 : (lib ? 4 : 3), market: y < 1860 ? 1 : y < 1932 ? 2 : 3,
    cartel: y < 1887 ? 0 : y < 1930 ? 2 : plan ? 3 : 2, rail: y < 1850 ? 0 : y < 1880 ? 1 : 2, fiscal: y < 1900 ? 0 : y < 1936 ? 1 : 2, indpol: y < 1850 ? 0 : y < 1900 ? 1 : y < 1910 ? 2 : (plan || c.profile === 'militarist' ? 3 : 2)};
  let lv = B[id] - adv; if (id === 'monetary' && c.rank <= 1 && y < 1870) lv = 2; if (id === 'bank' && c.rank <= 2 && y < 1850) lv = 2;
  const d = INST_BY[id], max = d.levels.length - 1; lv = Math.max(0, Math.min(max, lv));
  while (lv > 0 && d.levels[lv].y > y) lv--; return lv;
}
function instInit(c) { const o = {last: {}}; INST.forEach(d => { o[d.id] = instBaseline(c, d.id); }); return o; }
function instMods(c) {
  const I = instOf(c), m = {}; INST.forEach(d => { const lv = d.levels[I[d.id]]; if (lv) for (const k in lv.m) m[k] = (m[k] || 0) + lv.m[k]; });
  // obsolescencia: las fábricas rinden menos si el país va por detrás del estado de la técnica de su época (el capital se queda anticuado)
  const nT = Object.keys(TECH).length, exp = nT * Math.min(0.85, Math.max(0.05, (G.date.y - 1830) / 125)) * 0.8, lag = Math.max(0, Math.min(1, (exp - c.techs.length) / Math.max(1, exp)));
  if (lag > 0.1) { m.indOut = (m.indOut || 0) - 0.07 * lag; m.innov = (m.innov || 0) - 0.03 * lag; }
  return m;
}
const _ecoModsE4 = ecoMods;
ecoMods = function (c) { const m = _ecoModsE4(c); if (!c.eco) return m; const im = instMods(c), r = m || {}; for (const k in im) r[k] = (r[k] || 0) + im[k]; return r; };
function instCan(c, id, to) {
  const d = INST_BY[id], I = instOf(c), cur = I[id], lv = d.levels[to]; if (!lv || to === cur) return {ok: false, msg: ''};
  if (Math.abs(to - cur) !== 1) return {ok: false, msg: 'Las instituciones se reforman de una en una: no se pueden saltar etapas.'};
  if (!c.ai && (I.last[id] || -9999) + 360 > G.date.t) return {ok: false, msg: `Reforma reciente: espera ${Math.ceil(((I.last[id] || 0) + 360 - G.date.t) / 30)} meses.`};
  if (to > cur) {
    if (lv.y && G.date.y < lv.y) return {ok: false, msg: `«${lv.n}» no existe todavía: aparece hacia ${lv.y}.`};
    if (lv.tech && !hasTech(c, lv.tech) && G.date.y < lv.y + 15) return {ok: false, msg: `Requiere la tecnología «${(TECH[lv.tech] || {}).name || lv.tech}» (o esperar hasta ${lv.y + 15}).`};
    if (lv.need && !lv.need(c)) return {ok: false, msg: id === 'monetary' ? 'El patrón oro exige un tesoro sin déficit.' : 'No se cumplen los requisitos.'};
  }
  const cost = to > cur ? {inf: 18, tre: Math.max(0, c.stats.income) * 1.5} : {inf: 10, tre: 0};
  if (!c.ai && c.influence < cost.inf) return {ok: false, msg: `Necesitas ${cost.inf} de influencia.`};
  if (!c.ai && c.treasury < cost.tre) return {ok: false, msg: `Necesitas ${money(cost.tre)} en el tesoro.`};
  return {ok: true, cost};
}
function instSet(c, id, to) {
  const r = instCan(c, id, to); if (!r.ok) return r; const I = instOf(c), d = INST_BY[id], lv = d.levels[to];
  if (!c.ai) { c.influence -= r.cost.inf; c.treasury -= r.cost.tre; }
  const up = to > I[id]; I[id] = to; I.last[id] = G.date.t; if (lv.ig && !c.ai) for (const k in lv.ig) if (c.ig[k]) c.ig[k].approval += lv.ig[k] * (up ? 1 : -0.5);
  recalcMods(c); return {ok: true, msg: `${d.name}: ${lv.n}.`};
}
/* ---------- efectos mensuales ---------- */
function instMonth(c) {
  if (!c.eco || !c.states.length) return; const I = instOf(c), inc = Math.max(0, c.stats.income) * 4.3;
  // costes de las instituciones que gastan
  INST.forEach(d => { const lv = d.levels[I[d.id]]; if (lv && lv.cost) c.treasury -= inc * lv.cost; });
  // patrón oro: un tesoro en números rojos obliga a suspender la convertibilidad
  if (I.monetary >= 2 && c.treasury < -inc * 0.5) { I.monetary = 1; I.last.monetary = G.date.t; c.legitimacy -= 2; c.prestige = Math.max(0, c.prestige - 3); if (c.tag === G.player) toast('🪙', 'Suspensión de la convertibilidad: el tesoro no sostiene el patrón oro. Pierdes confianza y prestigio.'); recalcMods(c); }
  // burbujas bursátiles: sociedades fáciles de crear y sin banco central ni regulación
  const lc = INST_BY.company.levels[I.company];
  if (lc && lc.bubble && I.bank < 3 && I.company < 4 && Math.random() < 0.0035 * lc.bubble && !(G.date.y < 1845)) {
    const loss = inc * (2 + Math.random() * 2); c.treasury -= loss; c.radicals = Math.min(0.9, c.radicals + 0.02); if (c.ig.indus) c.ig.indus.approval -= 1;
    if (c.tag === G.player) toast('📉', `Pánico bursátil: se hunden las acciones y el tesoro pierde ${money(loss)} en ingresos y rescates.`);
  }
  // inflación del papel moneda: prestigio y descontento
  if (I.monetary === 0) { c.radicals = Math.min(0.9, c.radicals + 0.0004); }
  if (c.ai && c.tag !== G.player && G.date.m === (c.id % 12)) instAI(c);
}
function instAI(c) {
  const I = instOf(c); let ch = false;
  INST.forEach(d => { const want = instBaseline(c, d.id), cur = I[d.id]; if (cur === want) return; const to = cur + Math.sign(want - cur); const lv = d.levels[to];
    if (to > cur && lv.y && G.date.y < lv.y) return; if (to > cur && lv.need && !lv.need(c)) return; if (Math.random() < (to > cur ? 0.12 : 0.04)) { I[d.id] = to; I.last[d.id] = G.date.t; ch = true; } });
  if (ch) recalcMods(c);
}
const _politics2MonthE4 = politics2Month;
politics2Month = function (c) { _politics2MonthE4(c); try { instMonth(c); } catch (err) { console.warn('instMonth', err); } };
// el tipo de interés de los bonos depende de la solidez monetaria y bancaria
const _ecoBondsE4 = ecoBonds;
ecoBonds = function (c, weeks) {
  const r = _ecoBondsE4(c, weeks); if (!r.ok) return r; const e = ecoOf(c), I = instOf(c), b = e.bonds[e.bonds.length - 1];
  const f = 1 - 0.035 * I.monetary - 0.025 * I.bank; const k = Math.max(0.78, Math.min(1.12, f)); b.pay = b.pay * (1.0 + (k - 1) * 0.9) ; const pct = Math.round(((b.pay * 12) / b.amt - 1) * 100);
  r.msg = `Emites bonos por ${money(b.amt)}: se devolverán con un ${pct}% de interés en 12 meses (según tu sistema monetario y bancario).`; return r;
};
/* ---------- interfaz ---------- */
(function () {
  const st = document.createElement('style');
  st.textContent = `
.inst-card .inst-row{display:grid;grid-template-columns:minmax(150px,1.1fr) 2fr;gap:6px 18px;padding:10px 4px 11px;border-top:1px solid var(--filete-suave)}
.inst-card .inst-row:first-of-type{border-top:0}
.inst-row .ih{display:flex;align-items:center;gap:9px;font-family:var(--f-tit);letter-spacing:var(--track);font-size:var(--t-s);color:var(--tx-tit);text-transform:uppercase}
.inst-row .ih .ic{width:30px;height:30px;display:grid;place-items:center;font-size:17px;background:radial-gradient(circle at 35% 30%,var(--pizarra-500),var(--pizarra-800));border:1px solid var(--filete);border-radius:50%;box-shadow:var(--luz-filo)}
.inst-row .steps{display:flex;align-items:center;gap:0;min-width:0}
.inst-row .stp{position:relative;flex:1;display:flex;flex-direction:column;align-items:center;min-width:0}
.inst-row .stp::before{content:'';position:absolute;top:13px;left:-50%;right:50%;height:2px;background:var(--filete-suave)}
.inst-row .stp:first-child::before{display:none}
.inst-row .stp.done::before,.inst-row .stp.cur::before{background:linear-gradient(90deg,var(--laton-700),var(--laton-500))}
.inst-row .stp button{position:relative;z-index:1;width:26px;height:26px;border-radius:50%;padding:0;border:1.5px solid var(--filete);background:var(--sup-0);color:var(--tx-3);font-family:var(--f-tit);font-size:11px;font-weight:700;cursor:pointer;box-shadow:var(--sombra-1);transition:transform var(--t-rapido),box-shadow var(--t-rapido)}
.inst-card .inst-row .stp button{background:var(--sup-0)!important;color:var(--tx-2)!important}.inst-card .inst-row .stp.done button{background:linear-gradient(180deg,var(--laton-700),#4b3a16)!important;color:var(--laton-100)!important;border-color:var(--laton-500)}
.inst-card .inst-row .stp.cur button{width:30px;height:30px;margin-top:-2px;background:radial-gradient(circle at 35% 30%,#f3d98c,var(--laton-500) 60%,var(--laton-700))!important;color:#2a1d08!important;border-color:#f3e3b4;box-shadow:0 0 0 3px rgba(224,194,122,.22),0 0 14px rgba(224,194,122,.45)}
.inst-row .stp.lock button{opacity:.38;cursor:not-allowed}
.inst-row .stp button:not(:disabled):hover{transform:translateY(-1px) scale(1.07)}
.inst-row .stp .yr{font-size:10px;color:var(--tx-3);margin-top:3px;letter-spacing:.02em}
.inst-row .stp.cur .yr{color:var(--laton-300)}
.inst-row .det{grid-column:1/-1;display:flex;flex-wrap:wrap;align-items:baseline;gap:4px 12px;padding:2px 2px 0 39px}
.inst-row .det b{color:var(--pergamino-100);font-family:var(--f-cap);font-size:var(--t-m)}
.inst-row .det .ds{color:var(--tx-2);font-size:var(--t-s);flex:1 1 280px}
.inst-row .chips{display:flex;flex-wrap:wrap;gap:4px;padding:0 0 0 39px;grid-column:1/-1}
.inst-row .chip{font-size:10.5px;padding:1px 7px;border-radius:9px;border:1px solid;background:rgba(0,0,0,.18);white-space:nowrap}
.inst-row .chip.p{color:var(--bueno);border-color:rgba(111,174,116,.45)}.inst-row .chip.n{color:var(--malo);border-color:rgba(227,116,108,.45)}.inst-row .chip.c{color:var(--aviso);border-color:rgba(240,180,98,.45)}
`;
  document.head.appendChild(st);
})();
function instCardHtml(c) {
  const I = instOf(c), NM = {tax: 'impuestos', invest: 'inversión', innov: 'innovación', indOut: 'industria', out: 'producción', lab: 'obreros', rad: 'radicalismo', stab: 'estabilidad', crisis: 'resistencia a crisis', constr: 'construcción', lit: 'alfabetización', army: 'ejército', milCost: 'coste militar', logistics: 'logística', grow: 'crecimiento'},
    GOODNEG = {rad: 1, milCost: 1}, pct = (k, v) => k === 'stab' ? (v > 0 ? '+' : '') + v : (v > 0 ? '+' : '') + Math.round(v * 1000) / 10 + '%',
    chips = l => Object.keys(l.m).map(k => { const v = l.m[k], good = GOODNEG[k] ? v < 0 : v > 0; return `<span class="chip ${good ? 'p' : 'n'}">${NM[k] || k} ${pct(k, v)}</span>`; }).join('') + (l.cost ? `<span class="chip c">coste ${Math.round(l.cost * 1000) / 10}% de ingresos/mes</span>` : '');
  return `<div class="card inst-card"><h3>🏛️ Instituciones económicas</h3><p class="hint">Se reforman de una en una y solo desde el año en que existieron. Subir cuesta 18 de influencia y 1,5 semanas de ingresos; después, 12 meses de espera.</p>
  ${INST.map(d => { const cur = I[d.id], lv = d.levels[cur]; return `<div class="inst-row"><div class="ih"><span class="ic">${d.icon}</span>${d.name}</div><div class="steps">${d.levels.map((l, i) => { const can = i === cur ? {ok: true} : instCan(c, d.id, i), cls = i === cur ? 'cur' : i < cur ? 'done' : '', lock = i !== cur && !can.ok ? ' lock' : '', tip = `<b>${l.n}</b>${l.y ? ` <i>(desde ${l.y})</i>` : ''}<br>${l.d}${i !== cur && !can.ok && can.msg ? `<br><span class="warn">${can.msg}</span>` : ''}`; return `<div class="stp ${cls}${lock}"><button data-act="eco4" data-k="${d.id}" data-v="${i}" data-tip="${escA(tip)}">${['I', 'II', 'III', 'IV', 'V'][i]}</button><span class="yr">${l.y > 0 ? l.y : '—'}</span></div>`; }).join('')}</div><div class="det"><b>${lv.n}</b><span class="ds">${lv.d}</span></div><div class="chips">${chips(lv)}</div></div>`; }).join('')}</div>`;
}
const _budgetRenderE4 = WINDOWS.budget.render;
WINDOWS.budget.render = function () { return _budgetRenderE4.call(this) + instCardHtml(me()); };
ACT.eco4 = d => { const c = me(), r = instSet(c, d.k, +d.v); if (r.msg) toast(r.ok ? '🏛️' : '⚠️', r.msg); renderWindow(true); };
