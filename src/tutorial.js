/* ===== TUTORIAL OPCIONAL + BANDERAS CLICABLES =====
   · Al empezar una partida se ofrece (una sola vez) un tutorial guiado de unos 5 minutos; también está siempre en el menú «🎓 Tutorial» (☰) y en el Manual.
     Cada paso resalta el elemento de la pantalla del que habla, explica los fundamentos (pausa, mapa, finanzas, producción, política, tecnología, decisiones, diplomacia, ejército,
     marina, aviación, tácticas, guardado) y, en los pasos de ventana, avanza solo cuando abres esa ventana. Se puede saltar, retroceder y salir en cualquier momento.
   · Clic en cualquier bandera de un país (fuera de botones y fichas) → abre su apartado de Diplomacia. */
const TUT = {on: false, i: 0, timer: 0};
const TUT_STEPS = [
  {t: '¡Bienvenido, gobernante!', x: 'En este juego diriges un país entre 1836 y 1945: haces crecer su economía, sorteas crisis y revoluciones, firmas alianzas y, si hace falta, haces la guerra. Este tutorial dura unos 5 minutos. Puedes salir cuando quieras y volver a abrirlo desde ☰ → 🎓 Tutorial.'},
  {t: 'El tiempo', x: 'El juego empieza <b>en pausa</b>. Pulsa ⏸/▶ (o la barra espaciadora) para parar o seguir, y los cinco botones de velocidad para acelerar el tiempo (también con , y .). Pausa siempre que necesites pensar: no pierdes nada.', el: '#btn-pause'},
  {t: 'El mapa', x: 'Arrastra con el ratón para moverte, rueda para acercar, <b>botón central o Mayús + arrastrar</b> para girar e inclinar. Haz clic en un estado para ver sus datos. Los <b>modos de mapa</b> (aquí abajo) colorean el mundo por política, terreno, población, riqueza, guerra y más.', el: '#modes'},
  {t: 'Tu país de un vistazo', x: 'Arriba a la izquierda ves tu tesoro, el balance semanal, tu <b>prestigio</b>, tu <b>influencia</b> (la moneda de la diplomacia), la innovación, la legitimidad y la población. Los números en rojo piden atención. Pasa el ratón por encima de cualquiera para ver su explicación.', el: '#plaque'},
  {t: 'Finanzas', x: 'Abre <b>Finanzas</b>. Aquí fijas los impuestos, ves ingresos y gastos y, abajo, la <b>política económica</b>: comercio, salario mínimo, industria estatal, subsidios, racionamiento, planificación y bonos. Si el tesoro baja de cero te endeudas y la economía sufre.', el: '#mb-budget', wait: () => UI.win === 'budget'},
  {t: 'Economía y mercado', x: 'En <b>Economía</b> ves qué produce y consume tu país y los precios del mercado mundial. Los precios altos de un bien indican escasez: construir edificios que lo produzcan suele ser rentable.', el: '#mb-production', wait: () => UI.win === 'production'},
  {t: 'Construir', x: 'En <b>Obras</b> eliges qué construir en cada estado (granjas, minas, fábricas, ferrocarriles, puertos, cuarteles…). Tu <b>capacidad de construcción</b> es limitada: elige con cabeza. La industria da riqueza, pero también obreros más exigentes.', el: '#mb-construction', wait: () => UI.win === 'construction'},
  {t: 'La población', x: '<b>Población</b> muestra las clases sociales, sus salarios y su nivel de vida. Si viven mal, se vuelven <b>radicales</b>: eso erosiona la legitimidad y puede acabar en huelgas, revoluciones o guerra civil.', el: '#mb-pops', wait: () => UI.win === 'pops'},
  {t: 'Política y sociedad', x: 'En <b>Política</b> están tus leyes, los grupos de interés (terratenientes, industriales, sindicatos, ejército, clero…), las elecciones y los movimientos sociales. Abajo ves el <b>riesgo de cada revolución</b> (comunista, fascista, republicana, teocrática). Reforma a tiempo o reprime, pero tendrá consecuencias.', el: '#mb-politics', wait: () => UI.win === 'politics'},
  {t: 'Tecnología', x: 'En <b>Ciencia</b> eliges qué investigar. Las eras avanzadas exigen año y progreso previo. Hay doctrinas excluyentes: elegir una cierra la otra.', el: '#mb-tech', wait: () => UI.win === 'tech'},
  {t: 'Decisiones nacionales', x: 'Cada país tiene su <b>árbol de decisiones</b> con ramas históricas (unificar Alemania, el imperio británico, la Restauración Meiji…). Cada decisión tarda semanas, tiene efectos permanentes y algunas disparan <b>eventos encadenados</b> donde tú eliges.', el: '#mb-national', wait: () => UI.win === 'national'},
  {t: 'Diplomacia', x: 'En <b>Diplomacia</b> eliges un país y puedes proponerle tratados, bloques o guerra. Las alianzas son <b>difíciles</b>: exigen confianza alta, un enemigo común y que las viejas rivalidades históricas no lo impidan. Los países te hacen ofertas solo si les interesa por su situación geográfica. <b>Truco:</b> haz clic en la bandera de cualquier país para abrir su ficha de diplomacia.', el: '#mb-diplomacy', wait: () => UI.win === 'diplomacy'},
  {t: 'Ejército y marina', x: 'En <b>Ejército</b> reclutas divisiones, defines plantillas, produces armas, nombras mariscales y mandas flotas y escuadrones. Cada <b>flota</b> y cada <b>escuadrón</b> tiene una <b>táctica</b> (ataque, distancia, torpedos, retirada; escolta, barrido, intercepción; vuelo alto, bajo o nocturno) que cambia el resultado de los combates. Las flotas pueden refugiarse en puertos para repararse.', el: '#mb-military', wait: () => UI.win === 'military'},
  {t: 'Hacer la guerra', x: 'Para atacar elige un país en Diplomacia y un <b>casus belli</b> (cuesta influencia y genera infamia). Los ejércitos se mueven pinchando en el mapa; al chocar se abre una <b>batalla</b> con su panel (terreno, órdenes, fuertes, vista 3D). En el mar y en el aire también puedes ver los combates en 3D y cambiar de táctica en pleno combate.'},
  {t: 'El asesor', x: 'Si no sabes qué hacer, pulsa 🧭 <b>Asesor</b>: te dice qué conviene ahora (guerras, crisis, propuestas, construcción, investigación) con accesos directos.', el: '#btn-advisor'},
  {t: 'Guardar y ajustes', x: '💾 guarda tu partida (hay varias ranuras) y 📤 la exporta a un archivo. En ☰ → ⚙ <b>Calidad</b> ajustas gráficos y rendimiento. El <b>Manual</b> (F1) explica cada sistema con detalle.', el: '.rbtn[data-act=save]'},
  {t: '¡Listo!', x: 'Ya conoces lo esencial. Un buen primer objetivo: sube la <b>legitimidad</b>, construye industria, firma un tratado comercial con tus vecinos y refuerza el ejército antes de pensar en la guerra. Puedes repetir este tutorial desde ☰ → 🎓 Tutorial. ¡Suerte!'}
];
function tutEl() { let e = document.getElementById('tut'); if (!e) { e = document.createElement('div'); e.id = 'tut'; document.body.appendChild(e); const h = document.createElement('div'); h.id = 'tut-hl'; document.body.appendChild(h); } return e; }
function tutRender() {
  const e = tutEl(), s = TUT_STEPS[TUT.i], last = TUT.i === TUT_STEPS.length - 1;
  e.className = 'on' + (TUT.mini ? ' mini' : ''); e.innerHTML = `<div class="th"><b>🎓 ${s.t}</b><small>${TUT.i + 1} / ${TUT_STEPS.length}</small><button data-act="tutexit" class="x" aria-label="Salir">✕</button></div><div class="tx">${s.x}</div>${s.wait ? `<div class="tw ${TUT.done ? 'ok' : ''}">${TUT.done ? '✔ ¡Bien hecho!' : '👉 Pulsa el botón resaltado para abrir la ventana'}</div>` : ''}<div class="tb"><button data-act="tutprev" ${TUT.i ? '' : 'disabled'}>◀ Anterior</button><button data-act="tutnext" class="pri">${last ? 'Terminar' : 'Siguiente ▶'}</button></div><div class="tbar"><i style="width:${(TUT.i + 1) / TUT_STEPS.length * 100}%"></i></div>`;
}
function tutHighlight() {
  const hl = document.getElementById('tut-hl'); if (!hl) return; const s = TUT_STEPS[TUT.i], t = TUT.on && s && s.el ? document.querySelector(s.el) : null;
  if (!t || !t.offsetWidth) { hl.style.display = 'none'; return; }
  const r = t.getBoundingClientRect(); hl.style.display = 'block'; hl.style.left = (r.left - 4) + 'px'; hl.style.top = (r.top - 4) + 'px'; hl.style.width = (r.width + 8) + 'px'; hl.style.height = (r.height + 8) + 'px';
}
function tutTick() {
  if (!TUT.on) return; const s = TUT_STEPS[TUT.i]; tutHighlight();
  if (s.wait && !TUT.done) { let ok = false; try { ok = !!s.wait(); } catch (err) { } if (ok) { TUT.done = true; tutRender(); setTimeout(() => { if (TUT.on && TUT.i === TUT_STEPS.indexOf(s)) tutGo(1); }, 1500); } }
}
function tutGo(d) { const n = TUT.i + d; if (n < 0) return; if (n >= TUT_STEPS.length) { tutStop(true); return; } TUT.i = n; TUT.done = false; if (TUT_STEPS[n].wait && UI.win) { try { closeWindow(); } catch (e) { } } tutRender(); tutHighlight(); }
function tutStart() { if (!UI.started) { toast('🎓', 'Elige un país y empieza la partida para usar el tutorial.'); return; } TUT.on = true; TUT.i = 0; TUT.done = false; tutRender(); tutHighlight(); clearInterval(TUT.timer); TUT.timer = setInterval(tutTick, 350); tutSave('seen'); }
function tutStop(finished) { TUT.on = false; clearInterval(TUT.timer); const e = document.getElementById('tut'), h = document.getElementById('tut-hl'); if (e) e.className = ''; if (h) h.style.display = 'none'; if (finished) toast('🎓', 'Tutorial completado. Puedes repetirlo desde ☰ → 🎓 Tutorial.'); }
function tutSave(v) { try { localStorage.setItem('victoria-tut', v); } catch (e) { } }
function tutSeen() { try { return !!localStorage.getItem('victoria-tut'); } catch (e) { return false; } }
function tutOffer() {
  if (tutSeen() || !UI.started) return; const d = document.createElement('div'); d.id = 'tutoffer';
  d.innerHTML = `<b>🎓 ¿Quieres un tutorial?</b><p>Una guía opcional de unos 5 minutos con los fundamentos: finanzas, política, diplomacia, ejército y combate. Siempre podrás abrirla desde ☰ → 🎓 Tutorial.</p><div class="tb"><button data-act="tutyes" class="pri">Sí, enséñame</button><button data-act="tutno">No, gracias</button></div>`; document.body.appendChild(d);
}
Object.assign(ACT, {
  tutorial: () => { const m = document.getElementById('topmenu'); if (m) m.classList.remove('open'); const o = document.getElementById('tutoffer'); if (o) o.remove(); tutStart(); },
  tutyes: () => { const o = document.getElementById('tutoffer'); if (o) o.remove(); tutStart(); },
  tutno: () => { const o = document.getElementById('tutoffer'); if (o) o.remove(); tutSave('no'); toast('🎓', 'De acuerdo. Si cambias de idea: ☰ → 🎓 Tutorial.'); },
  tutnext: () => tutGo(1), tutprev: () => tutGo(-1), tutexit: () => tutStop(false)
});
const _startGameTut = startGame;
startGame = function () { _startGameTut(); setTimeout(tutOffer, 1800); setTimeout(tutAddButton, 400); };
function tutAddButton() {
  if (document.getElementById('tm-tut')) return; const menu = document.getElementById('topmenu');
  const b = document.createElement('button'); b.id = 'tm-tut'; b.dataset.act = 'tutorial'; b.dataset.tip = '<b>Tutorial</b><br>Guía opcional con los fundamentos del juego.';
  if (menu) { b.className = 'tm-row'; b.innerHTML = '<span class="tmi">🎓</span><span class="tml">Tutorial</span>'; menu.appendChild(b); }
  else { const tr = document.getElementById('topright'); if (!tr) return; b.className = 'rbtn'; b.textContent = '🎓'; tr.insertBefore(b, tr.firstChild); }
}
/* ---------- banderas clicables ---------- */
const _flagTut = flag;
flag = function (tag, cls) { const h = _flagTut(tag, cls); return h && G.C[tag] ? h.replace('<span class="flag ', `<span data-ftag="${tag}" class="flag `) : h; };
document.addEventListener('click', e => {
  const f = e.target.closest && e.target.closest('.flag[data-ftag]'); if (!f || !UI.started) return;
  const host = f.parentElement && f.parentElement.closest('[data-act], button, a, select, input, #start, .st-card, #tutoffer'); if (host) return;     // las banderas dentro de botones o fichas conservan su función
  const tag = f.dataset.ftag; if (!G.C[tag] || !alive(tag)) return; e.stopPropagation(); e.preventDefault(); ACT.goDiplo({tag});
}, true);
ACT.goDiplo = d => {
  const tag = d.tag; if (!tag || !alive(tag)) return; if (tag === G.player) { UI.winTab.dip = 'world'; UI.dipSel = null; } else { UI.dipSel = tag; UI.dipQ = ''; }
  UI.winTab.dip = 'world'; if (UI.win === 'diplomacy') renderWindow(true); else { UI.win = null; openWindow('diplomacy'); }
};
