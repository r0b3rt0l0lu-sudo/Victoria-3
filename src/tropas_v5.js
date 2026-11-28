/* ===== tropas_v5.js — caballería y artillería de Claude Design (caballeria3d.js, artilleria3d.js) en la batalla 3D =====
   · Caballería: cada figura de caballería usa los jinetes nuevos (cab_husar, cab_lancero, cab_dragon, cab_coracero) con sus aires reales
     (paso, trote, galope, carga, parado) y el sable o la lanza en el cuerpo a cuerpo.
   · Artillería: cada pieza se dibuja con su modelo de época, su dotación completa (jefe y servidores con sus clips sincronizados),
     el avantrén y el tiro de caballos al marchar. La pieza en fuego repite el servicio real (avancarga ≈ 24 s por ciclo), así que los
     servidores trabajan a ritmo real aunque la simulación del campo dispare más deprisa. */
const B3T5 = {on: true, pieza: null};
const B3CAB = {husar: 'cab_husar', lancero: 'cab_lancero', dragon: 'cab_dragon', coracero: 'cab_coracero'};
function b3V3CavKind(k) { return B3T5.on && window.caballeria3d && B3CAB[k] && Troops3D.KINDS && Troops3D.KINDS[B3CAB[k]] ? B3CAB[k] : k; }
const _b3ClipT5 = b3Clip;
b3Clip = function (blk, f, era, cav) {
  const c = _b3ClipT5(blk, f, era, cav); if (!cav || !B3T5.on || !window.caballeria3d) return c;
  const m = blk.mode, sp = blk.sp || 0, lanza = (blk.id % B3_CAV.length) === 2 && era < 'D' ? '_lanza' : '', fl = f.flee > 0;
  if (fl) return 'cab_galope'; if (m === 'charge' || m === 'gallop') return 'cab_galope_carga' + lanza; if (m === 'melee') return lanza ? 'cab_lanza_ataque' : 'cab_sable_ataque';
  if (sp > 55) return 'cab_galope' + lanza; if (sp > 24) return 'cab_trote' + lanza; if (sp > 8) return 'cab_paso' + lanza; return 'cab_parado' + lanza;
};
// pieza de época y número de servidores
function b3V3Pieza(blk, era) { const L = {A: ['canon_12', 'canon_6', 'obus_campana'], B: ['canon_12', 'rayado_rc', 'obus_campana'], C: ['rayado_rc', 'rayado_rc', 'obus_campana'], D: ['canon_75', 'obus_pesado', 'canon_75'], E: ['canon_75', 'campana_E', 'antitanque']}[era] || ['canon_12']; return L[blk.id % L.length]; }
const B3_ARTCAP = {};
function b3V3Art(S, V, blk, f, era, tU, ca, d3) {
  if (!B3T5.on || !window.artilleria3d || blk.type !== 'art') return false; const A = artilleria3d, p = b3V3Pieza(blk, era), D = A.DOTACIONES[p], K = Troops3D.KINDS || {}; if (!D || !K['art_' + p]) return false;
  if (f.kind !== 'gun') return true;                                            // los servidores se dibujan junto a su pieza
  if (!f.alive && f.dying <= 0) return true;
  const firstGun = blk.figs.find(q => q.kind === 'gun' && q.alive);
  const tag = blk.tag, y = b3H(S.tf, f.x, f.y), yaw = Math.PI / 2 - blk.hd, c2 = Math.cos(yaw), s2 = Math.sin(yaw), h = hash2(blk.id, f.i, 11), M = B3_S, mv = (blk.sp || 0) > 8;
  const fire = blk.mode === 'artfire' || blk.mode === 'fire' || f.flash > 0, o = _b3o;
  const put = (kind, clip, lx, lz, dyaw, ph, noPh) => { if (!K[kind]) return; const set = b3Set(S, kind, era, tag, null), x = f.x + (lx * c2 + lz * s2) * M, z = f.y + (-lx * s2 + lz * c2) * M;
    o.phase = ph; o.h = 0; o.bright = (ph * 7.3) % 1; o.skin = (h * 4) | 0; o.horse = (h * 4) | 0; o.start = null; o.variacion = null; set.add(d3(x, y, z), x, y, z, yaw + (dyaw || 0) * Math.PI / 180, M, tag, clip, o); };
  const bandera = () => { if (firstGun && firstGun.i === f.i && window.apoyo3d && K.inf_apo_estandarte_generico) put('inf_apo_estandarte_generico', mv ? 'apo_estandarte_marcha' : 'apo_estandarte_firme', -3.4, -1.2, 0, hash2(blk.id, 9, 3)); };
  const nSrv = (() => { const crew = blk.figs.filter(q => q.kind === 'crew' && q.alive).length; return Math.max(2, Math.min(D.servidores.length, Math.round(D.servidores.length * (crew + 1) / 7))); })();
  if (mv && K['art_' + p + '_enganchado']) {
    const sp = blk.sp || 0, rod = sp > 40 ? 'art_rodar_galope' : sp > 24 ? 'art_rodar_trote' : 'art_rodar_paso', cab = sp > 40 ? 'cab_galope' : sp > 24 ? 'cab_trote' : 'cab_paso';
    bandera(); put('art_' + p + '_enganchado', rod, 0, 0, 0, h); try { A.formacion('tiro', 4).forEach((t, i) => put(t.tipo, cab, t.x, t.z, 0, hash2(blk.id, f.i * 7 + i, 5))); } catch (e) { }
    return true;
  }
  bandera();
  if (fire) {
    put('art_' + p, D.clipPieza, 0, 0, 0, h);
    D.servidores.slice(0, nSrv).forEach(s => put(s.tipo, s.clip, 0, 0, 0, h));
    if (D.avantren && K[D.avantren.tipo]) put(D.avantren.tipo, 'art_rodar_parado', D.avantren.desfase[0], D.avantren.desfase[1], D.avantren.desfase[2], h);
    return true;
  }
  put('art_' + p, 'art_' + p + '_reposo', 0, 0, 0, h);                                // en reposo: la pieza quieta y los servidores de pie alrededor
  D.servidores.slice(0, nSrv).forEach((s, i) => { const a = i * 6.283 / nSrv + h * 6.283, r = 2.3; put('inf_art_jefe', 'idle', Math.cos(a) * r, Math.sin(a) * r, (a * 57.3 + 180) % 360, hash2(blk.id * 3 + i, f.i, 17)); });
  if (D.avantren && K[D.avantren.tipo]) put(D.avantren.tipo, 'art_rodar_parado', D.avantren.desfase[0], D.avantren.desfase[1], D.avantren.desfase[2], h);
  return true;
}
