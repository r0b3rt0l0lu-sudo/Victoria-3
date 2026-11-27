/* ===== hud_soldado.js — HUD del soldado en primera persona para la batalla 3D de Victoria (HTML/CSS/canvas, sin archivos externos) =====
   Estilo papel y tinta de época (sin neones ni retículas de «shooter» moderno). Escala a cualquier resolución: la unidad --u se calcula con
   el tamaño real del contenedor (ResizeObserver) y los lienzos usan devicePixelRatio. Por debajo de 700 px de ancho pasa a disposición estrecha.
   Piezas: brújula con rumbo y marcas del pelotón (objetivo, oficial, enemigo), salud y aguante, postura, munición (cartuchos de avancarga
   o peines de cerrojo y estado de carga), indicador de supresión (borrones de tinta en los bordes y medidor), órdenes recibidas del oficial
   (papeleta con lacre), minimapa del sector con la línea de frente, rueda de órdenes al pelotón, aviso de contacto (entrada directa al
   combate), panel de reaparición en otro soldado del pelotón y botón de pantalla completa (Fullscreen API + bloqueo de puntero; Esc sale).
   API: crearHUD(contenedor, op) → H {actualizar(estado), orden(texto, de), contacto(metros), reaparicion(nombre, puesto, s), rueda.abrir/cerrar,
        alOrden(cb), pantallaCompleta(), destruir(), el}
   estado: {salud, aguante, postura: 'pie'|'rodilla'|'tumbado', rumbo (°), objetivos: [{rumbo, dist, tipo: 'objetivo'|'oficial'|'enemigo', etiqueta}],
            supresion (0–1), municion: {tipo: 'A'|'D', cargada, cargando (0–1), sueltos, peines}, mapa: {ancho, fondo, yo: [x,z,rumbo], amigos, enemigos,
            frente: [[x,z]…], objetivo: [x,z], edificios: [[x,z,w,d,rot]…]}}
   Demostración: demoHUD(contenedor). Prueba de disposición: pruebaHUD() (en el navegador). */
(function (root) {
'use strict';
const CSS = `
.hud-s{position:absolute;inset:0;pointer-events:none;font-family:"Palatino Linotype","Book Antiqua",Palatino,Georgia,serif;color:#2a1d12;--u:1px;--tinta:#2a1d12;--rojo:#8a2416;--azul:#24386a;--papel:#ecdfbd;--papel2:#dccb9e;user-select:none;-webkit-user-select:none;overflow:hidden}
.hud-s *{box-sizing:border-box}
.hud-s .papel{background-color:var(--papel);background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='f'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.8' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 .35 0 0 0 0 .25 0 0 0 0 .12 0 0 0 .22 0'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23f)'/%3E%3C/svg%3E"),radial-gradient(ellipse at 30% 20%,rgba(255,250,235,.55),rgba(160,120,60,.18) 85%);
  border:calc(1.2*var(--u)) solid #6a4a26;box-shadow:0 calc(2*var(--u)) calc(6*var(--u)) rgba(0,0,0,.45),inset 0 0 calc(10*var(--u)) rgba(120,80,30,.35);border-radius:calc(2*var(--u))}
.hud-s .rot{font-variant:small-caps;letter-spacing:.06em;font-size:max(11px,calc(13*var(--u)));opacity:.85}
.hud-s .num{font-variant-numeric:oldstyle-nums;font-size:max(13px,calc(22*var(--u)));font-weight:600}
.hud-s .brujula{position:absolute;left:50%;top:calc(10*var(--u));transform:translateX(-50%);width:calc(520*var(--u));height:calc(46*var(--u))}
.hud-s .brujula canvas{width:100%;height:100%;display:block}
.hud-s .estado{position:absolute;left:calc(18*var(--u));bottom:calc(18*var(--u));width:calc(250*var(--u));padding:calc(10*var(--u)) calc(12*var(--u))}
.hud-s .barra{position:relative;height:calc(14*var(--u));margin:calc(3*var(--u)) 0 calc(8*var(--u));border:calc(1*var(--u)) solid var(--tinta);background:rgba(255,255,255,.25)}
.hud-s .barra i{position:absolute;left:0;top:0;bottom:0;background:repeating-linear-gradient(-45deg,var(--tinta) 0 calc(1.4*var(--u)),transparent calc(1.4*var(--u)) calc(4*var(--u)));transition:width .3s}
.hud-s .barra.salud i{background:repeating-linear-gradient(-45deg,var(--rojo) 0 calc(1.6*var(--u)),rgba(138,36,22,.25) calc(1.6*var(--u)) calc(4*var(--u)))}
.hud-s .fila{display:flex;align-items:center;justify-content:space-between;gap:calc(8*var(--u))}
.hud-s .postura{width:calc(44*var(--u));height:calc(44*var(--u))}
.hud-s .muni{position:absolute;right:calc(18*var(--u));bottom:calc(18*var(--u));width:calc(230*var(--u));padding:calc(10*var(--u)) calc(12*var(--u))}
.hud-s .muni canvas{width:100%;height:calc(40*var(--u));display:block;margin-top:calc(4*var(--u))}
.hud-s .estadoArma{font-style:italic;font-size:max(11px,calc(14*var(--u)))}
.hud-s .mapa{position:absolute;right:calc(18*var(--u));top:calc(16*var(--u));width:calc(210*var(--u));height:calc(210*var(--u));padding:calc(6*var(--u))}
.hud-s .mapa canvas{width:100%;height:100%;display:block}
.hud-s .ordenes{position:absolute;left:calc(18*var(--u));top:calc(16*var(--u));width:calc(300*var(--u));display:flex;flex-direction:column;gap:calc(6*var(--u))}
.hud-s .papeleta{position:relative;padding:calc(9*var(--u)) calc(14*var(--u)) calc(9*var(--u)) calc(14*var(--u));font-size:max(11px,calc(15*var(--u)));line-height:1.3;transform:rotate(-.6deg);animation:hudEntra .5s ease-out both}
.hud-s .papeleta b{display:block;font-variant:small-caps;font-weight:600;font-size:max(11px,calc(12*var(--u)));color:var(--rojo);letter-spacing:.05em}
.hud-s .papeleta .lacre{position:absolute;right:calc(-8*var(--u));top:calc(-8*var(--u));width:calc(24*var(--u));height:calc(24*var(--u));border-radius:50%;background:radial-gradient(circle at 35% 35%,#c0402a,#7a1a10 70%);box-shadow:0 calc(1*var(--u)) calc(2*var(--u)) rgba(0,0,0,.5)}
.hud-s .papeleta.vieja{opacity:.55;transform:rotate(.4deg) scale(.94);transform-origin:left top}
@keyframes hudEntra{from{opacity:0;transform:translateY(calc(-10*var(--u))) rotate(-2deg)}to{opacity:1}}
.hud-s .supr{position:absolute;inset:0;pointer-events:none;opacity:0;transition:opacity .25s;background:radial-gradient(ellipse at center,transparent 52%,rgba(20,12,6,.55) 78%,rgba(10,6,2,.92) 100%)}
.hud-s .supr canvas{position:absolute;inset:0;width:100%;height:100%}
.hud-s .suprMed{position:absolute;left:50%;bottom:calc(26*var(--u));transform:translateX(-50%);width:calc(180*var(--u));text-align:center;padding:calc(5*var(--u)) calc(10*var(--u))}
.hud-s .suprMed .barra{margin:calc(2*var(--u)) 0 0}
.hud-s .mira{position:absolute;left:50%;top:50%;width:calc(6*var(--u));height:calc(6*var(--u));margin:calc(-3*var(--u)) 0 0 calc(-3*var(--u));border-radius:50%;background:rgba(236,223,189,.75);box-shadow:0 0 0 calc(1*var(--u)) rgba(42,29,18,.7)}
.hud-s .aviso{position:absolute;left:50%;top:28%;transform:translateX(-50%);padding:calc(12*var(--u)) calc(26*var(--u));text-align:center;font-size:max(13px,calc(22*var(--u)));animation:hudEntra .5s both;white-space:nowrap}
.hud-s .aviso small{display:block;font-size:max(11px,calc(14*var(--u)));font-style:italic;margin-top:calc(2*var(--u))}
.hud-s .rueda{position:absolute;left:50%;top:50%;width:calc(380*var(--u));height:calc(380*var(--u));transform:translate(-50%,-50%);pointer-events:auto;display:none}
.hud-s .rueda.abierta{display:block;animation:hudEntra .2s both}
.hud-s .rueda .cen{position:absolute;left:50%;top:50%;width:calc(120*var(--u));height:calc(120*var(--u));transform:translate(-50%,-50%);border-radius:50%;display:flex;align-items:center;justify-content:center;text-align:center;font-variant:small-caps;font-size:max(11px,calc(14*var(--u)));padding:calc(10*var(--u))}
.hud-s .rueda button{position:absolute;width:calc(112*var(--u));min-height:44px;height:calc(54*var(--u));transform:translate(-50%,-50%);font:inherit;font-size:max(11px,calc(14*var(--u)));color:var(--tinta);cursor:pointer;line-height:1.1;padding:calc(4*var(--u))}
.hud-s .rueda button:hover,.hud-s .rueda button:focus-visible,.hud-s .rueda button.sel{background-color:#f6ecd0;outline:calc(2*var(--u)) solid var(--rojo);outline-offset:calc(-3*var(--u))}
.hud-s .rueda button .tecla{display:block;font-size:max(11px,calc(11*var(--u)));opacity:.7}
.hud-s .btnPc,.hud-s .btnRueda{position:absolute;pointer-events:auto;width:max(44px,calc(40*var(--u)));height:max(44px,calc(40*var(--u)));display:flex;align-items:center;justify-content:center;cursor:pointer;padding:0;color:var(--tinta)}
.hud-s .btnPc{right:calc(18*var(--u));top:calc(236*var(--u))}
.hud-s .btnRueda{right:calc(18*var(--u));bottom:calc(150*var(--u));display:none}
.hud-s .btnPc svg,.hud-s .btnRueda svg{width:60%;height:60%}
.hud-s .reap{position:absolute;inset:0;display:none;align-items:center;justify-content:center;background:rgba(10,6,2,.55);pointer-events:auto}
.hud-s .reap.on{display:flex}
.hud-s .reap .papel{padding:calc(22*var(--u)) calc(34*var(--u));text-align:center;max-width:90%;font-size:max(13px,calc(18*var(--u)))}
.hud-s .reap h2{margin:0 0 calc(6*var(--u));font-variant:small-caps;font-weight:600;font-size:max(13px,calc(26*var(--u)));color:var(--rojo)}
.hud-s.estrecho .brujula{width:calc(100% - 24px);top:8px}
.hud-s.estrecho .mapa{width:calc(150*var(--u));height:calc(150*var(--u));top:calc(64*var(--u))}
.hud-s.estrecho .ordenes{top:calc(64*var(--u));width:calc(100% - 36px - 160*var(--u))}
.hud-s.estrecho .estado{width:calc(50% - 24px)}
.hud-s.estrecho .muni{width:calc(50% - 24px)}
.hud-s.estrecho .btnPc{top:calc(222*var(--u))}
.hud-s.estrecho .btnRueda{display:flex}
.hud-s.estrecho .suprMed{bottom:calc(150*var(--u))}
@media (prefers-reduced-motion:reduce){.hud-s *{animation:none!important;transition:none!important}}
`;
const ORDENES = [['avanzar', 'Avanzar', '1'], ['mantener', 'Mantener la posición', '2'], ['cubrirse', 'A cubierto', '3'], ['fuego', 'Fuego a voluntad', '4'], ['alto_fuego', 'Alto el fuego', '5'], ['bayoneta', 'Cargar a la bayoneta', '6'], ['seguidme', 'Seguidme', '7'], ['reagrupar', 'Reagruparse', '8']];
const ICO = {pc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9V3h6M21 9V3h-6M3 15v6h6M21 15v6h-6"/></svg>', pcSal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 3v6H3M15 3v6h6M9 21v-6H3M15 21v-6h6"/></svg>',
  rueda: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3"/><path d="M12 3v6M12 15v6M3 12h6M15 12h6"/></svg>'};

function crearHUD(cont, op) {
  op = Object.assign({ruedaTecla: 'KeyV', titulo: 'Soldado'}, op || {});
  if (!document.getElementById('hud-s-css')) { const st = document.createElement('style'); st.id = 'hud-s-css'; st.textContent = CSS; document.head.appendChild(st); }
  if (getComputedStyle(cont).position === 'static') cont.style.position = 'relative';
  const el = document.createElement('div'); el.className = 'hud-s'; el.setAttribute('role', 'region'); el.setAttribute('aria-label', 'Información del soldado');
  el.innerHTML = `<div class="supr"><canvas></canvas></div><div class="mira"></div>
<div class="brujula"><canvas aria-label="Brújula"></canvas></div>
<div class="ordenes" aria-live="polite"></div>
<div class="mapa papel"><canvas aria-label="Mapa del sector"></canvas></div>
<button class="btnPc papel" title="Pantalla completa (F)" aria-label="Pantalla completa">${ICO.pc}</button>
<button class="btnRueda papel" title="Órdenes al pelotón" aria-label="Órdenes al pelotón">${ICO.rueda}</button>
<div class="estado papel"><div class="fila"><span class="rot">Salud</span><canvas class="postura" aria-label="Postura"></canvas></div><div class="barra salud"><i style="width:100%"></i></div><span class="rot">Aliento</span><div class="barra aliento"><i style="width:100%"></i></div></div>
<div class="muni papel"><div class="fila"><span class="rot">Munición</span><span class="num">0</span></div><div class="estadoArma">Cargado</div><canvas></canvas></div>
<div class="suprMed papel" style="display:none"><span class="rot">Bajo fuego</span><div class="barra"><i style="width:0%"></i></div></div>
<div class="rueda" role="menu" aria-label="Órdenes al pelotón"><div class="cen papel">Órdenes al pelotón</div></div>
<div class="reap" role="alertdialog" aria-live="assertive"><div class="papel"><h2>Has caído</h2><div class="t"></div><div class="rot cuenta"></div></div></div>`;
  cont.appendChild(el);
  const $ = s => el.querySelector(s), cvB = $('.brujula canvas'), cvM = $('.mapa canvas'), cvP = $('.postura'), cvA = $('.muni canvas'), cvS = $('.supr canvas');
  // rueda de órdenes
  const rueda = $('.rueda'); ORDENES.forEach(([id, txt, k], i) => { const a = -Math.PI / 2 + i / ORDENES.length * Math.PI * 2, b = document.createElement('button'); b.className = 'papel'; b.setAttribute('role', 'menuitem'); b.dataset.orden = id;
    b.innerHTML = `${txt}<span class="tecla">${k}</span>`; b.style.left = `calc(50% + ${Math.cos(a) * 140}*var(--u))`; b.style.top = `calc(50% + ${Math.sin(a) * 140}*var(--u))`; rueda.appendChild(b); });
  let cbOrden = null; rueda.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; elegir(b.dataset.orden); });
  function elegir(id) { const o = ORDENES.find(x => x[0] === id); if (!o) return; cerrarRueda(); orden(o[1], 'Tú al pelotón'); if (cbOrden) cbOrden(id); }
  function abrirRueda() { rueda.classList.add('abierta'); if (document.pointerLockElement) document.exitPointerLock(); const b = rueda.querySelector('button'); if (b) b.focus({preventScroll: true}); }
  function cerrarRueda() { rueda.classList.remove('abierta'); }
  $('.btnRueda').addEventListener('click', () => rueda.classList.contains('abierta') ? cerrarRueda() : abrirRueda());
  const tecla = e => { if (e.code === op.ruedaTecla && !e.repeat) { e.type === 'keydown' ? abrirRueda() : null; }
    if (rueda.classList.contains('abierta') && e.type === 'keydown') { const n = +e.key; if (n >= 1 && n <= 8) elegir(ORDENES[n - 1][0]); if (e.key === 'Escape') cerrarRueda(); }
    if (e.code === 'KeyF' && e.type === 'keydown' && !e.repeat && !/INPUT|TEXTAREA/.test((e.target || {}).tagName || '')) pantallaCompleta(); };
  addEventListener('keydown', tecla);
  // pantalla completa
  const btnPc = $('.btnPc');
  function pantallaCompleta() { const d = document; if (d.fullscreenElement || d.webkitFullscreenElement) { (d.exitFullscreen || d.webkitExitFullscreen).call(d); return; }
    const f = cont.requestFullscreen || cont.webkitRequestFullscreen; if (f) { const p = f.call(cont, {navigationUI: 'hide'}); if (p && p.then) p.then(() => { if (op.bloquearPuntero && cont.requestPointerLock) cont.requestPointerLock(); }).catch(() => {}); } }
  btnPc.addEventListener('click', pantallaCompleta);
  const alPc = () => { const on = !!(document.fullscreenElement || document.webkitFullscreenElement); btnPc.innerHTML = on ? ICO.pcSal : ICO.pc; btnPc.setAttribute('aria-label', on ? 'Salir de pantalla completa' : 'Pantalla completa'); ajustar(); };
  document.addEventListener('fullscreenchange', alPc); document.addEventListener('webkitfullscreenchange', alPc);
  // escala
  let W = 0, H = 0, dpr = 1;
  function ajustar() { const r = cont.getBoundingClientRect(); W = r.width || innerWidth; H = r.height || innerHeight; dpr = Math.min(2, devicePixelRatio || 1);
    const estrecho = W < 700, u = estrecho ? Math.max(0.62, Math.min(W / 560, H / 900)) : Math.max(0.6, Math.min(W / 1280, H / 720)); el.style.setProperty('--u', u + 'px'); el.classList.toggle('estrecho', estrecho);
    [cvB, cvM, cvP, cvA, cvS].forEach(c => { const b = c.getBoundingClientRect(); c.width = Math.max(1, Math.round(b.width * dpr)); c.height = Math.max(1, Math.round(b.height * dpr)); }); dibujar(); }
  const ro = root.ResizeObserver ? new ResizeObserver(ajustar) : null; if (ro) ro.observe(cont); else addEventListener('resize', ajustar);
  // órdenes recibidas
  const caja = $('.ordenes');
  function orden(texto, de) { const p = document.createElement('div'); p.className = 'papeleta papel'; p.innerHTML = `<b>${esc(de || 'Orden del capitán')}</b>${esc(texto)}<span class="lacre"></span>`;
    caja.querySelectorAll('.papeleta').forEach(x => x.classList.add('vieja')); caja.prepend(p); while (caja.children.length > 2) caja.lastChild.remove(); }
  const esc = s => String(s).replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
  // aviso de contacto (entrada directa al combate)
  function contacto(m, sub) { const a = document.createElement('div'); a.className = 'aviso papel'; a.innerHTML = `En contacto con el enemigo<small>${esc(sub || `a unos ${Math.round(m)} m · fuego a discreción cuando lo ordene el oficial`)}</small>`; el.appendChild(a); setTimeout(() => { a.style.transition = 'opacity .8s'; a.style.opacity = '0'; setTimeout(() => a.remove(), 900); }, 3200); }
  // reaparición en otro soldado del pelotón
  let tReap = null; function reaparicion(nombre, puesto, s) { const r = $('.reap'); r.classList.add('on'); r.querySelector('.t').innerHTML = `Pasas a <b>${esc(nombre)}</b>${puesto ? ', ' + esc(puesto) : ''}.`; let k = s || 3; const c = r.querySelector('.cuenta');
    clearInterval(tReap); c.textContent = `En ${k} s`; tReap = setInterval(() => { k--; c.textContent = `En ${k} s`; if (k <= 0) { clearInterval(tReap); r.classList.remove('on'); } }, 1000); }

  /* ---------- dibujo ---------- */
  let E = {salud: 1, aguante: 1, postura: 'pie', rumbo: 0, objetivos: [], supresion: 0, municion: {tipo: 'A', cargada: true, cargando: 0, sueltos: 40, peines: 0}, mapa: null};
  const TINTA = '#2a1d12', ROJO = '#8a2416', AZUL = '#24386a';
  function brujula() { const c = cvB, g = c.getContext('2d'), w = c.width, h = c.height; g.clearRect(0, 0, w, h);
    const grd = g.createLinearGradient(0, 0, w, 0); grd.addColorStop(0, 'rgba(236,223,189,0)'); grd.addColorStop(0.12, 'rgba(236,223,189,.92)'); grd.addColorStop(0.88, 'rgba(236,223,189,.92)'); grd.addColorStop(1, 'rgba(236,223,189,0)');
    g.fillStyle = grd; g.fillRect(0, h * 0.18, w, h * 0.64); g.strokeStyle = 'rgba(42,29,18,.6)'; g.lineWidth = dpr; g.beginPath(); g.moveTo(w * 0.1, h * 0.18); g.lineTo(w * 0.9, h * 0.18); g.moveTo(w * 0.1, h * 0.82); g.lineTo(w * 0.9, h * 0.82); g.stroke();
    const fov = 120, px = w / fov, r = E.rumbo, ROT = {0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', 225: 'SO', 270: 'O', 315: 'NO'};
    g.fillStyle = TINTA; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (let d = Math.floor((r - fov / 2) / 5) * 5; d <= r + fov / 2; d += 5) { const x = w / 2 + (d - r) * px, a = ((d % 360) + 360) % 360, k = 1 - Math.abs(x - w / 2) / (w / 2); g.globalAlpha = Math.max(0, Math.min(1, k * 1.6));
      if (ROT[a] != null) { g.font = `${a % 90 ? 'italic ' : 'bold '}${Math.round(h * (a % 90 ? 0.3 : 0.38))}px Georgia,serif`; g.fillText(ROT[a], x, h * 0.5); }
      else { g.fillRect(x - dpr / 2, h * (a % 15 ? 0.24 : 0.2), dpr, h * (a % 15 ? 0.1 : 0.16)); if (a % 15 === 0) { g.font = `${Math.round(h * 0.2)}px Georgia,serif`; g.fillText(a, x, h * 0.6); } } }
    g.globalAlpha = 1;
    (E.objetivos || []).forEach(o => { let d = ((o.rumbo - r + 540) % 360) - 180; const fuera = Math.abs(d) > fov / 2; d = Math.max(-fov / 2, Math.min(fov / 2, d)); const x = w / 2 + d * px, y = h * 0.92;
      g.save(); g.translate(x, y); g.fillStyle = o.tipo === 'enemigo' ? ROJO : o.tipo === 'oficial' ? AZUL : TINTA; g.strokeStyle = 'rgba(236,223,189,.9)'; g.lineWidth = dpr * 1.5;
      if (o.tipo === 'objetivo') { g.beginPath(); g.moveTo(0, -h * 0.2); g.lineTo(0, h * 0.02); g.stroke(); g.fill(); g.fillRect(0, -h * 0.2, h * 0.16, h * 0.1); }   // banderín
      else if (o.tipo === 'oficial') { g.beginPath(); for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i * Math.PI * 0.8; g.lineTo(Math.cos(a) * h * 0.1, Math.sin(a) * h * 0.1 - h * 0.06); } g.closePath(); g.stroke(); g.fill(); }
      else { g.beginPath(); g.moveTo(-h * 0.09, -h * 0.16); g.lineTo(h * 0.09, -h * 0.16); g.lineTo(0, 0); g.closePath(); g.stroke(); g.fill(); }
      if (o.dist != null && !fuera) { g.font = `${Math.round(h * 0.18)}px Georgia,serif`; g.fillStyle = TINTA; g.textAlign = 'center'; g.fillText(`${Math.round(o.dist)} m`, 0, -h * 0.32); }
      if (fuera) { g.font = `bold ${Math.round(h * 0.26)}px Georgia,serif`; g.fillText(d < 0 ? '‹' : '›', d < 0 ? h * 0.18 : -h * 0.18, -h * 0.08); }
      g.restore(); });
    g.fillStyle = ROJO; g.beginPath(); g.moveTo(w / 2 - h * 0.1, 0); g.lineTo(w / 2 + h * 0.1, 0); g.lineTo(w / 2, h * 0.16); g.closePath(); g.fill(); }
  function postura() { const c = cvP, g = c.getContext('2d'), w = c.width, h = c.height; g.clearRect(0, 0, w, h); g.strokeStyle = TINTA; g.fillStyle = TINTA; g.lineWidth = Math.max(1.5, w * 0.06); g.lineCap = 'round'; g.lineJoin = 'round';
    const L = (pts) => { g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x * w, y * h) : g.moveTo(x * w, y * h)); g.stroke(); }; const cab = (x, y) => { g.beginPath(); g.arc(x * w, y * h, w * 0.08, 0, 7); g.fill(); };
    if (E.postura === 'tumbado') { cab(0.16, 0.66); L([[0.25, 0.7], [0.62, 0.72], [0.9, 0.76]]); L([[0.3, 0.72], [0.2, 0.82]]); g.beginPath(); g.moveTo(0.05 * w, 0.85 * h); g.lineTo(0.95 * w, 0.85 * h); g.lineWidth = 1; g.stroke(); }
    else if (E.postura === 'rodilla') { cab(0.5, 0.2); L([[0.5, 0.3], [0.5, 0.58], [0.72, 0.62], [0.7, 0.88]]); L([[0.5, 0.58], [0.35, 0.86], [0.2, 0.86]]); L([[0.5, 0.38], [0.66, 0.46]]); }
    else { cab(0.5, 0.14); L([[0.5, 0.24], [0.5, 0.56], [0.4, 0.9]]); L([[0.5, 0.56], [0.6, 0.9]]); L([[0.5, 0.32], [0.38, 0.5]]); L([[0.5, 0.32], [0.62, 0.48]]); } }
  function municion() { const M = E.municion || {}, c = cvA, g = c.getContext('2d'), w = c.width, h = c.height; g.clearRect(0, 0, w, h); g.fillStyle = TINTA; g.strokeStyle = TINTA; g.lineWidth = Math.max(1, dpr);
    $('.muni .num').textContent = M.tipo === 'D' ? `${M.sueltos != null ? M.sueltos : 0}` : `${M.sueltos || 0}`;
    $('.estadoArma').textContent = M.cargando > 0 && M.cargando < 1 ? (M.tipo === 'A' ? 'Cargando… (baqueta)' : 'Recargando…') : M.cargada ? 'Cargado' : (M.tipo === 'A' ? 'Descargado: carga el mosquete' : 'Cámara vacía');
    if (M.tipo === 'D') { const n = Math.min(12, M.peines || 0); for (let i = 0; i < n; i++) { const x = i * w / 12 + w * 0.01, y = h * 0.15; g.strokeRect(x, y, w / 14, h * 0.7); for (let k = 0; k < 5; k++) g.fillRect(x + w / 14 * 0.2, y + h * 0.12 + k * h * 0.11, w / 14 * 0.6, h * 0.06); } }
    else { const n = Math.min(20, M.sueltos || 0); for (let i = 0; i < n; i++) { const x = (i % 20) * w / 20 + w / 40; g.beginPath(); g.ellipse(x, h * 0.3, w / 70, h * 0.12, 0, 0, 7); g.stroke(); g.fillRect(x - w / 70, h * 0.3, w / 35, h * 0.45); } }
    if (M.cargando > 0 && M.cargando < 1) { g.fillStyle = 'rgba(138,36,22,.85)'; g.fillRect(0, h - h * 0.1, w * M.cargando, h * 0.1); } }
  let manchas = []; for (let i = 0; i < 26; i++) manchas.push([Math.random(), Math.random(), 0.04 + Math.random() * 0.08, Math.random()]);
  function supresion() { const s = E.supresion || 0, cap = $('.supr'); cap.style.opacity = Math.min(1, s * 1.2); $('.suprMed').style.display = s > 0.05 ? '' : 'none'; $('.suprMed i').style.width = Math.round(s * 100) + '%';
    const c = cvS, g = c.getContext('2d'), w = c.width, h = c.height; g.clearRect(0, 0, w, h); if (s < 0.05) return;
    manchas.forEach(([u, v, r, k]) => { const borde = Math.min(u, 1 - u, v, 1 - v); if (borde > 0.18) return; const x = (u < 0.5 ? u * 0.4 : 1 - (1 - u) * 0.4) * w, y = v * h; const rr = r * Math.min(w, h) * (0.6 + s);
      g.fillStyle = `rgba(16,10,4,${0.35 * s * (0.5 + k)})`; g.beginPath(); for (let a = 0; a < 7; a += 0.5) g.lineTo(x + Math.cos(a) * rr * (0.75 + 0.35 * Math.sin(a * 3 + k * 9)), y + Math.sin(a) * rr * (0.75 + 0.35 * Math.cos(a * 2 + k * 7))); g.fill(); }); }
  function mapa() { const c = cvM, g = c.getContext('2d'), w = c.width, h = c.height, Mp = E.mapa; g.clearRect(0, 0, w, h); if (!Mp) return;
    const s = Math.min(w / Mp.ancho, h / Mp.fondo), X = x => (x - Mp.ancho / 2) * s + w / 2, Z = z => (z - Mp.fondo / 2) * s + h / 2;
    g.strokeStyle = 'rgba(42,29,18,.25)'; g.lineWidth = 1; for (let i = 1; i < 6; i++) { g.beginPath(); g.moveTo(i * w / 6, 0); g.lineTo(i * w / 6, h); g.moveTo(0, i * h / 6); g.lineTo(w, i * h / 6); g.stroke(); }
    (Mp.edificios || []).forEach(([x, z, bw, bd, rot]) => { g.save(); g.translate(X(x), Z(z)); g.rotate(-(rot || 0)); g.fillStyle = 'rgba(42,29,18,.55)'; g.fillRect(-bw * s / 2, -bd * s / 2, bw * s, bd * s); g.restore(); });
    if (Mp.frente && Mp.frente.length > 1) { g.strokeStyle = ROJO; g.lineWidth = 2.2 * dpr; g.setLineDash([6 * dpr, 4 * dpr]); g.beginPath(); Mp.frente.forEach(([x, z], i) => i ? g.lineTo(X(x), Z(z)) : g.moveTo(X(x), Z(z))); g.stroke(); g.setLineDash([]);
      g.lineWidth = dpr; for (let i = 0; i < Mp.frente.length - 1; i++) { const [ax, az] = Mp.frente[i], [bx, bz] = Mp.frente[i + 1]; for (let t = 0.2; t < 1; t += 0.3) { const x = X(ax + (bx - ax) * t), y = Z(az + (bz - az) * t), dx = X(bx) - X(ax), dy = Z(bz) - Z(az), l = Math.hypot(dx, dy); g.beginPath(); g.moveTo(x, y); g.lineTo(x - dy / l * 6 * dpr, y + dx / l * 6 * dpr); g.stroke(); } } }
    const sq = (x, z, col, r) => { g.fillStyle = col; g.fillRect(X(x) - r, Z(z) - r * 0.6, r * 2, r * 1.2); };
    (Mp.enemigos || []).forEach(([x, z]) => sq(x, z, ROJO, 3.2 * dpr)); (Mp.amigos || []).forEach(([x, z]) => sq(x, z, AZUL, 3.2 * dpr));
    if (Mp.objetivo) { const x = X(Mp.objetivo[0]), y = Z(Mp.objetivo[1]); g.strokeStyle = TINTA; g.lineWidth = 1.5 * dpr; g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - 12 * dpr); g.stroke(); g.fillStyle = TINTA; g.fillRect(x, y - 12 * dpr, 8 * dpr, 5 * dpr); }
    if (Mp.yo) { const [x, z, rr] = Mp.yo; g.save(); g.translate(X(x), Z(z)); g.rotate(rr * Math.PI / 180); g.fillStyle = '#f6ecd0'; g.strokeStyle = TINTA; g.lineWidth = 1.5 * dpr; g.beginPath(); g.moveTo(0, -7 * dpr); g.lineTo(5 * dpr, 6 * dpr); g.lineTo(0, 3 * dpr); g.lineTo(-5 * dpr, 6 * dpr); g.closePath(); g.fill(); g.stroke(); g.restore(); }
    g.fillStyle = TINTA; g.font = `italic ${Math.round(10 * dpr)}px Georgia,serif`; g.textAlign = 'left'; const m = 100; g.fillRect(6 * dpr, h - 8 * dpr, m * s / 0.6, 1.5 * dpr); g.fillText('100 m', 6 * dpr, h - 12 * dpr); }
  function dibujar() { brujula(); postura(); municion(); supresion(); mapa(); $('.salud i').style.width = Math.round((E.salud || 0) * 100) + '%'; $('.aliento i').style.width = Math.round((E.aguante == null ? 1 : E.aguante) * 100) + '%'; }
  function actualizar(st) { E = Object.assign({}, E, st || {}); dibujar(); }
  function destruir() { if (ro) ro.disconnect(); removeEventListener('keydown', tecla); document.removeEventListener('fullscreenchange', alPc); el.remove(); }
  ajustar();
  return {el, actualizar, orden, contacto, reaparicion, rueda: {abrir: abrirRueda, cerrar: cerrarRueda}, alOrden: cb => { cbOrden = cb; }, pantallaCompleta, destruir, ORDENES};
}

/* ---------- demostración: HUD sobre el terreno de terreno3d (o un fondo pintado) con estado animado ---------- */
function demoHUD(cont) {
  cont = cont || document.body; let D = null;
  const q0 = new URLSearchParams(location.search);
  if (root.terreno3d && root.THREE && q0.get('fondo') !== '0') { const T3 = root.terreno3d; D = T3.baseDemo(cont, {cam: [470, 22, 520], obj: [520, 14, 420], sombra: 300}); D.renderer.shadowMap.enabled = false; D.renderer.setPixelRatio(1);
    const T = T3.crearTerreno({ancho: 1024, fondo: 768, semilla: 3, relieve: 18, radioActivo: 120, caminos: [{puntos: [[0, 430], [520, 410], [1024, 440]], ancho: 8}]}); T.actualizar(500, 450); D.escena.add(T.grupo);
    D.cam.position.set(470, T.heightAt(470, 520) + 3, 520); D.cam.lookAt(520, T.heightAt(520, 420) + 4, 420); D.bucle(() => { D.cam.position.set(470, T.heightAt(470, 520) + 3, 520); D.cam.lookAt(520, T.heightAt(520, 420) + 4, 420); }); }
  else { cont.style.background = 'linear-gradient(#b9c6cf 0 46%, #6a7a4a 46%, #4e5e34)'; }
  const H = crearHUD(cont, {}); const q = q0;
  const amigos = Array.from({length: 14}, (_, i) => [300 + i * 9, 520 + (i % 3) * 6]), enemigos = Array.from({length: 18}, (_, i) => [260 + i * 12, 300 + (i % 2) * 8]);
  H.orden('Avanzar hasta el muro del cementerio y mantener la posición.', 'Orden del capitán Arredondo'); H.orden('Fuego por descargas a mi voz.', 'Sargento Pérez');
  if (!q.get('sincontacto')) H.contacto(190);
  let t0 = performance.now();
  (function bucle() { const t = (performance.now() - t0) / 1000;
    H.actualizar({salud: 0.62, aguante: 0.45 + 0.4 * Math.sin(t * 0.7) ** 2, postura: q.get('postura') || 'rodilla', rumbo: (338 + Math.sin(t * 0.3) * 18 + 360) % 360, supresion: q.get('supr') ? +q.get('supr') : Math.max(0, Math.sin(t * 0.5)) * 0.8,
      objetivos: [{rumbo: 352, dist: 140, tipo: 'objetivo', etiqueta: 'Muro'}, {rumbo: 20, dist: 35, tipo: 'oficial'}, {rumbo: 330, dist: 210, tipo: 'enemigo'}, {rumbo: 95, dist: 260, tipo: 'enemigo'}],
      municion: q.get('arma') === 'D' ? {tipo: 'D', cargada: true, sueltos: 5, peines: 9} : {tipo: 'A', cargada: (t % 9) > 6, cargando: (t % 9) < 6 ? (t % 9) / 6 : 0, sueltos: 34},
      mapa: {ancho: 600, fondo: 600, yo: [380, 500, 338], amigos, enemigos, frente: [[200, 380], [320, 400], [420, 380], [560, 410]], objetivo: [370, 420], edificios: [[360, 430, 14, 9, 0.2], [390, 445, 12, 8, 0.3], [340, 410, 10, 8, 0.1]]}});
    requestAnimationFrame(bucle); })();
  if (q.get('rueda')) H.rueda.abrir(); if (q.get('reap')) H.reaparicion('soldado Ramírez', '2.ª escuadra, 1.ª sección', 3);
  root.HUD = H; return {H, D};
}

/* ---------- prueba de disposición (navegador): todo dentro de la pantalla, sin solapes entre paneles, textos legibles y botones ≥ 44 px ---------- */
function pruebaHUD() {
  const el = document.querySelector('.hud-s'), r0 = el.getBoundingClientRect(), sel = ['.brujula', '.ordenes', '.mapa', '.estado', '.muni', '.btnPc'], cajas = {}, res = {fuera: [], solapes: [], textoMin: 99, botonesMin: 99};
  sel.forEach(s => { const e = el.querySelector(s); if (!e || getComputedStyle(e).display === 'none') return; const b = e.getBoundingClientRect(); cajas[s] = b; if (b.left < r0.left - 1 || b.top < r0.top - 1 || b.right > r0.right + 1 || b.bottom > r0.bottom + 1) res.fuera.push(s); });
  const ks = Object.keys(cajas); for (let i = 0; i < ks.length; i++) for (let j = i + 1; j < ks.length; j++) { const a = cajas[ks[i]], b = cajas[ks[j]]; if (a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1) res.solapes.push(ks[i] + '×' + ks[j]); }
  el.querySelectorAll('.rot,.num,.estadoArma,.papeleta').forEach(e => { if (e.offsetParent) res.textoMin = Math.min(res.textoMin, parseFloat(getComputedStyle(e).fontSize)); });
  el.querySelectorAll('button').forEach(b => { if (b.offsetParent && getComputedStyle(b).display !== 'none') { const r = b.getBoundingClientRect(); if (r.width) res.botonesMin = Math.min(res.botonesMin, Math.min(r.width, r.height)); } });
  res.ok = !res.fuera.length && !res.solapes.length && res.textoMin >= 11 && res.botonesMin >= 44; return res;
}

root.hudSoldado = {crearHUD, demoHUD, pruebaHUD, ORDENES, CSS};
})(typeof window !== 'undefined' ? window : globalThis);
