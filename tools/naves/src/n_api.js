
/* ---------- registro de tipos ---------- */
// modelos por nación (época 2 en este punto de control; la época 1 usa el de la 2 hasta la segunda entrega y lo marca como aproximación)
const SHIP_LOD2 = {acorazado: [1, 0.14, 0.05, 0.12], destructor: [1, 0.1, 0.05, 0.08], submarino: [1, 0.09, 0.03, 0.06], portaaviones: [1, 0.12, 0.07, 0.03]};
const NAVE_KINDS = {
  acorazado: {clase: 'naval', rig: 'buque', dom: 'mar', nombre: 'Acorazado', lim: [1600, 500, 12], build: buildBattleship, tabla: BB, modelos: {GBR: 'kgv', GER: 'bismarck', JPN: 'yamato', USA: 'kgv', FRA: 'bismarck', ITA: 'bismarck', SOV: 'kgv', GEN: 'kgv'}},
  destructor: {clase: 'naval', rig: 'buque', dom: 'mar', nombre: 'Destructor', lim: [900, 300, 12], build: buildDestroyer, tabla: DD, modelos: {GBR: 'tribal', GER: 'z1', JPN: 'fubuki', USA: 'tribal', FRA: 'z1', ITA: 'z1', SOV: 'tribal', GEN: 'tribal'}},
  submarino: {clase: 'naval', rig: 'buque', dom: 'mar', nombre: 'Submarino', lim: [500, 160, 12], build: buildSub, tabla: SUB, modelos: {GBR: 'tclass', GER: 'vii', JPN: 'i15', USA: 'tclass', FRA: 'tclass', ITA: 'vii', SOV: 'vii', GEN: 'vii'}},
  portaaviones: {clase: 'naval', rig: 'buque', dom: 'mar', nombre: 'Portaaviones', lim: [1600, 500, 12], build: buildCarrier, tabla: CV, modelos: {GBR: 'illustrious', GER: 'graf', JPN: 'shokaku', USA: 'shokaku', FRA: 'illustrious', ITA: 'graf', SOV: 'illustrious', GEN: 'illustrious'}},
  caza: {clase: 'aereo', rig: 'avion', dom: 'aire', nombre: 'Caza monoplano', lim: [450, 150, 12], build: buildPlane, tabla: PLANES, modelos: {GBR: 'spitfire', GER: 'bf109', JPN: 'zero', USA: 'spitfire', FRA: 'bf109', ITA: 'bf109', SOV: 'bf109', GEN: 'spitfire'}},
  bombardero_pesado: {clase: 'aereo', rig: 'avion', dom: 'aire', nombre: 'Bombardero cuatrimotor', lim: [900, 300, 12], build: buildPlane, tabla: PLANES, modelos: {GBR: 'lancaster', GER: 'condor', JPN: 'renzan', USA: 'lancaster', FRA: 'lancaster', ITA: 'condor', SOV: 'lancaster', GEN: 'lancaster'}},
  antiaereo: {clase: 'defensa', rig: 'aa', dom: 'tierra', nombre: 'Antiaéreo con dotación', lim: [500, 200, 12], build: buildAA, tabla: AA, modelos: {GBR: 'bofors', GER: 'flakv', JPN: 'type96', USA: 'bofors', FRA: 'bofors', ITA: 'flakv', SOV: 'bofors', GEN: 'bofors'}, dotacion: 3}
};
// tipos del juego → naves3d
const NAVE_MAP = {
  sail: {kind: null, nota: 'velero: época 1 (segunda entrega)'}, steam: {kind: null, nota: 'vapor: segunda entrega'}, ironclad: {kind: null, nota: 'acorazado de casamata: segunda entrega'},
  cruiser: {kind: 'destructor', nota: 'crucero: provisionalmente el destructor; modelo propio en la segunda entrega'}, sub: {kind: 'submarino'}, dread: {kind: 'acorazado', nota: 'dreadnought: modelo de 1914–18 en la segunda entrega'},
  destroyer: {kind: 'destructor'}, carrier: {kind: 'portaaviones'}, bb: {kind: 'acorazado'},
  fighter: {kind: 'caza'}, fighters: {kind: 'caza'}, bomber: {kind: 'bombardero_pesado'}, bombers: {kind: 'bombardero_pesado'}, military_aviation: {kind: 'caza'}
};
function naveModel(kind, nation) { const K = NAVE_KINDS[kind]; return K.modelos[nation] || K.modelos.GEN; }
function naveOpts(kind, era, nation) {
  const K = NAVE_KINDS[kind], pal = navePalette(nation || 'GEN', era, K.dom); return {modelo: naveModel(kind, nation), flagLayout: pal.flagLayout, markType: pal.markType, idBand: (nation === 'JPN' && kind === 'caza') || nation === 'GER' && false};
}
function naveGeoKey(kind, era, nation) { const o = naveOpts(kind, era, nation); return [kind, era === '1' ? '1' : '2', o.modelo, o.markType, o.flagLayout, o.idBand ? 'id' : ''].join('|'); }
function lod2(kind, o) {
  const K = NAVE_KINDS[kind];
  if (K.clase === 'naval') { const m = K.tabla[o.modelo]; return shipSil(o, m.L, m.B, m.D * (kind === 'portaaviones' ? 1.6 : 1), kind === 'submarino' ? m.tower.h : kind === 'portaaviones' ? 8 : m.D * 1.4); }
  const g = new GB();
  if (K.clase === 'aereo') { const m = K.tabla[o.modelo]; g.on(AP.cuerpo); g.poly(Z.MAIN, 0, [[m.B / 2, 0], [-m.B / 2, 0], [-m.B * 0.42, -m.L * 0.12], [m.B * 0.42, -m.L * 0.12]], [0, 0, m.L * 0.12], [-90, 0, 0], true);
    g.poly(Z.MAIN, 0, [[0.6, m.L / 2], [-0.6, m.L / 2], [-0.3, -m.L / 2], [0.3, -m.L / 2]], [0, 0.05, 0], [-90, 0, 0], true); g.poly(Z.MAIN, 0, [[m.B * 0.18, 0], [-m.B * 0.18, 0], [0, -m.L * 0.08]], [0, 0.1, -m.L * 0.38], [-90, 0, 0], true); return g; }
  g.box(Z.MAIN, 0, [0, 0.6, 0], [2, 1.2, 2.5], {}); return g;
}
const _cache = {};
// buildNave(tipo, época, {nation}) → {tint, fixed, geometry, parts, clips, lod: [{level, geometry, tint, fixed, tris}×3], emit, crew, nota, modelo}
function buildNave(kind, era, opts) {
  opts = opts || {}; const K = NAVE_KINDS[kind]; if (!K) throw new Error('naves3d: tipo desconocido ' + kind);
  era = era === '1' ? '1' : '2'; const nat = opts.nation || 'GEN', key = naveGeoKey(kind, era, nat); if (_cache[key]) return _cache[key];
  const o = naveOpts(kind, era, nat), gs = [K.build(o, 0), K.build(o, 1), lod2(kind, o)];
  const lv = gs.map((g, level) => ({level, geometry: g.toGeometry(), tint: g.toGeometry(z => z < 11.5), fixed: g.toGeometry(z => z >= 11.5), tris: g.tris()}));
  const m = K.tabla[o.modelo];
  const res = {kind, era, modelo: o.modelo, rig: K.rig, parts: RIGS[K.rig].map(p => p[0]), clips: CLIP_SETS[K.rig], tris: lv[0].tris, geometry: lv[0].geometry, tint: lv[0].tint, fixed: lv[0].fixed, lod: lv,
    emit: gs[0].emit || {}, crew: gs[0].crew || null, nota: (m && m.nota || '') + (era === '1' ? ' [época 1: modelo de la época 2 provisional]' : ''), eslora: m && m.L, manga: m && m.B, envergadura: m && m.B, longitud: m && m.L};
  _cache[key] = res; return res;
}

/* ---------- poses y horneado ---------- */
const _e = new THREE.Euler(), _q = new THREE.Quaternion(), _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1), _pm = new THREE.Matrix4();
function smooth(t) { return t * t * (3 - 2 * t); }
function sampleTrack(tr, t, out, n) {
  if (!tr || !tr.length) { for (let i = 0; i < n; i++) out[i] = 0; return out; }
  if (tr.length === 1 || t <= tr[0][0]) { for (let i = 0; i < n; i++) out[i] = tr[0][i + 1]; return out; }
  for (let k = 0; k < tr.length - 1; k++) { const a = tr[k], b = tr[k + 1]; if (t <= b[0]) { const u = smooth((t - a[0]) / Math.max(1e-6, b[0] - a[0])); for (let i = 0; i < n; i++) out[i] = a[i + 1] + (b[i + 1] - a[i + 1]) * u; return out; } }
  const l = tr[tr.length - 1]; for (let i = 0; i < n; i++) out[i] = l[i + 1]; return out;
}
const _r3 = [0, 0, 0], _t3 = [0, 0, 0], _t1 = [0];
function sampleStep(tr, t, out, n) { let k = 0; for (let i = 0; i < tr.length; i++) if (tr[i][0] <= t + 1e-6) k = i; for (let i = 0; i < n; i++) out[i] = tr[k][i + 1]; return out; }
// poseNave(tipo o esqueleto, clip, fase, salida Float32Array(8×16)) → matrices por parte; param y param2 llevan escalares en la traslación (sin padre)
function poseNave(kindOrRig, clipName, phase, out) {
  const rig = RIGS[kindOrRig] ? kindOrRig : NAVE_KINDS[kindOrRig].rig, parts = RIGS[rig], clip = (CLIPS[rig] || {})[clipName] || {tracks: {}};
  out = out || new Float32Array(MAXP * 16); const t = clip.loop === false ? Math.min(1, Math.max(0, phase)) : phase - Math.floor(phase);
  for (let i = 0; i < parts.length; i++) {
    const name = parts[i][0], par = parts[i][1], off = parts[i][2], isParam = i >= 6 && /^param/.test(name);
    sampleTrack(clip.tracks[name], t, _r3, 3); _e.set(_r3[0] * D2R, _r3[1] * D2R, _r3[2] * D2R); _q.setFromEuler(_e); _p.set(off[0], off[1], off[2]);
    if (par < 0 && clip.root) { sampleTrack(clip.root, t, _t3, 3); _p.x += _t3[0]; _p.y += _t3[1]; _p.z += _t3[2]; }
    if (clip.pos && clip.pos[name]) { sampleTrack(clip.pos[name], t, _t3, 3); _p.x += _t3[0]; _p.y += _t3[1]; _p.z += _t3[2]; }
    _m.compose(_p, _q, _s); if (par >= 0 && !isParam) { _pm.fromArray(out, par * 16); _m.premultiply(_pm); }
    _m.toArray(out, i * 16);
  }
  if (clip.hide) for (const name in clip.hide) { sampleStep(clip.hide[name], t, _t1, 1); if (_t1[0] > 0.5) continue; for (let i = 0; i < parts.length; i++) if (parts[i][0] === name) { const o = i * 16; out[o] = out[o + 1] = out[o + 2] = out[o + 4] = out[o + 5] = out[o + 6] = out[o + 8] = out[o + 9] = out[o + 10] = 0; } }
  return out;
}
function blendPose(a, b, k, out) { out = out || new Float32Array(a.length); for (let i = 0; i < a.length; i++) out[i] = a[i] + (b[i] - a[i]) * k; return out; }
let _baked = null;
function bakeClips() {
  if (_baked) return _baked; const rows = [], index = {}; let row = 0;
  Object.keys(CLIPS).forEach(rig => { index[rig] = {}; Object.keys(CLIPS[rig]).forEach(cn => { const c = CLIPS[rig][cn], frames = Math.max(2, Math.min(96, Math.round(c.dur * (c.loop === false ? 16 : 12))));
    index[rig][cn] = {row, frames, dur: c.dur, loop: c.loop !== false, ev: c.ev || []}; for (let f = 0; f < frames; f++) rows.push(poseNave(rig, cn, c.loop === false ? f / (frames - 1) : f / frames)); row += frames; }); });
  const FPR = Math.max(1, Math.ceil(rows.length / 2048)), W = MAXP * 3 * FPR, H = Math.ceil(rows.length / FPR), data = new Float32Array(W * H * 4);
  rows.forEach((m, r) => { const rr = Math.floor(r / FPR), cc = r - rr * FPR; for (let p = 0; p < MAXP; p++) { const o = (rr * W + cc * MAXP * 3 + p * 3) * 4, e = m.subarray(p * 16, p * 16 + 16); for (let i = 0; i < 3; i++) { data[o + i * 4] = e[i]; data[o + i * 4 + 1] = e[4 + i]; data[o + i * 4 + 2] = e[8 + i]; data[o + i * 4 + 3] = e[12 + i]; } } });
  const tex = new THREE.DataTexture(data, W, H, THREE.RGBAFormat, THREE.FloatType); tex.needsUpdate = true; tex.magFilter = tex.minFilter = THREE.NearestFilter;
  _baked = {tex, index, rows, W, H, FPR, frames: rows.length, bytes: data.byteLength}; return _baked;
}

/* ---------- paletas y banderas ---------- */
function makePaletteTex(entries) {
  const W = 12, H = entries.length, d = new Uint8Array(W * H * 4), put = (r, c, hex) => { const v = new THREE.Color(hex), o = (r * W + c) * 4; d[o] = Math.round(Math.pow(v.r, 1 / 2.2) * 255); d[o + 1] = Math.round(Math.pow(v.g, 1 / 2.2) * 255); d[o + 2] = Math.round(Math.pow(v.b, 1 / 2.2) * 255); d[o + 3] = 255; };
  entries.forEach((e, r) => { const p = navePalette(e[0], e[1], e[2]); [p.main, p.trim, p.acc, p.deck, p.flag[0], p.flag[1], p.flag[2], p.band, p.mark[0], p.mark[1], p.mark[2], p.id].forEach((h, c) => put(r, c, h)); });
  const tex = new THREE.DataTexture(d, W, H, THREE.RGBAFormat); tex.needsUpdate = true; tex.magFilter = tex.minFilter = THREE.NearestFilter; tex.colorSpace = THREE.SRGBColorSpace; return tex;
}
// atlas de banderas: 8 × 8 celdas de 128 × 80; flagSource(tag) → canvas / imagen / THREE.Texture (p. ej. b3FlagTex del juego). Sin fuente: franjas de la paleta.
function NaveFlagAtlas() { this.cells = {}; this.n = 0; if (typeof document === 'undefined') return; this.canvas = document.createElement('canvas'); this.canvas.width = 1024; this.canvas.height = 640; this.tex = new THREE.CanvasTexture(this.canvas); this.tex.colorSpace = THREE.SRGBColorSpace; }
NaveFlagAtlas.prototype.cell = function (tag, src) {
  if (this.cells[tag] != null) return this.cells[tag]; if (!src || !this.canvas || this.n >= 64) return -1;
  const img = src.isTexture ? src.image : src; if (!img) return -1; const i = this.n++, x = (i % 8) * 128, y = Math.floor(i / 8) * 80;
  this.canvas.getContext('2d').drawImage(img, x + 2, y + 2, 124, 76); this.tex.needsUpdate = true; this.cells[tag] = i; return i;
};

/* ---------- material ---------- */
// Atributos por instancia: iAnimA/iAnimB (clip actual y anterior, como troops3d), iLook = (fila de paleta + brillo, celda de bandera + 1 (0 = sin textura),
// fase de hélice, velocidad de hélice en rad/s), iAim = (rumbo torres, elevación torres, rumbo AA, elevación AA) en radianes respecto al casco;
// elevación < −0,5 = reposo (las torres vuelven a su rumbo de reposo).
function makeNaveMaterial(shared, opts) {
  opts = opts || {}; const mat = new THREE.MeshLambertMaterial({vertexColors: true, side: opts.side || THREE.FrontSide});
  mat.onBeforeCompile = sh => {
    ['uBones', 'uBonesSize', 'uFPR', 'uPal', 'uPalSize', 'uTime', 'uBlend', 'uFlags', 'uDebug'].forEach(k => { sh.uniforms[k] = shared.U[k]; });
    sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>
uniform sampler2D uBones; uniform vec2 uBonesSize; uniform float uFPR; uniform sampler2D uPal; uniform vec2 uPalSize; uniform float uTime; uniform float uBlend; uniform float uDebug;
attribute vec3 aInfo; attribute vec3 aPiv; attribute vec4 aAF;
attribute vec4 iAnimA; attribute vec4 iAnimB; attribute vec4 iLook; attribute vec4 iAim;
varying vec3 vFlag;
vec4 bt(float x, float y) { return texture2D(uBones, vec2((x + 0.5) / uBonesSize.x, (y + 0.5) / uBonesSize.y)); }
mat4 boneAt(float fr, float part) { float row = floor(fr / uFPR); float x = (fr - row * uFPR) * 24.0 + part * 3.0; vec4 a = bt(x, row), b = bt(x + 1.0, row), c = bt(x + 2.0, row);
  return mat4(a.x, b.x, c.x, 0.0, a.y, b.y, c.y, 0.0, a.z, b.z, c.z, 0.0, a.w, b.w, c.w, 1.0); }
mat4 clipBone(vec4 an, float part) {
  float fr = abs(an.y), f;
  if (an.y < 0.0) f = clamp((uTime - an.w) / an.z, 0.0, 1.0) * (fr - 1.0); else f = fract(uTime / an.z + an.w) * fr;
  float f0 = floor(f), f1 = an.y < 0.0 ? min(f0 + 1.0, fr - 1.0) : mod(f0 + 1.0, fr);
  return boneAt(an.x + f0, part) * (1.0 - (f - f0)) + boneAt(an.x + f1, part) * (f - f0);
}
mat4 animBone(float part) { mat4 m = clipBone(iAnimA, part); if (iAnimB.x >= 0.0) { float k = clamp((uTime - iAnimB.w) / uBlend, 0.0, 1.0); if (k < 1.0) m = clipBone(vec4(iAnimB.xyz, iAnimB.y < 0.0 ? -1e4 : iAnimA.w), part) * (1.0 - k) + m * k; } return m; }
vec3 rotY(vec3 v, float a) { float c = cos(a), s = sin(a); return vec3(v.x * c + v.z * s, v.y, -v.x * s + v.z * c); }
vec3 rotX(vec3 v, float a) { float c = cos(a), s = sin(a); return vec3(v.x, v.y * c - v.z * s, v.y * s + v.z * c); }
vec3 rotZ(vec3 v, float a) { float c = cos(a), s = sin(a); return vec3(v.x * c - v.y * s, v.x * s + v.y * c, v.z); }
float wrapPi(float a) { return a - 6.2831853 * floor((a + 3.1415927) / 6.2831853); }`)
      .replace('#include <beginnormal_vertex>', `mat4 bm = animBone(aPart);
vec3 prm = animBone(7.0)[3].xyz, prm2 = animBone(6.0)[3].xyz;
vec3 lp = position, ln = normal; float kd = floor(aKind + 0.5);
if (kd == 1.0 || kd == 2.0 || kd == 11.0 || kd == 12.0 || kd == 3.0 || kd == 4.0) {
  bool aa = kd == 3.0 || kd == 4.0, gun = kd == 2.0 || kd == 12.0 || kd == 4.0;
  float rest = kd > 10.5 ? 3.1415927 : aFx.x, ay = aa ? iAim.z : iAim.x, ae = aa ? iAim.w : iAim.y, yaw = rest, el = 0.0, arc = rest, lim = aa ? 3.2 : 2.6;
  if (aFx.y > 5.0) { arc = aFx.y - 10.0; lim = 1.6; }
  if (ae > -0.5) { yaw = arc + clamp(wrapPi(ay - arc), -lim, lim); el = clamp(ae, -0.09, aa ? 1.48 : 0.7); }
  lp -= aPiv;
  if (gun) { lp.y -= aAux.x; lp.z -= aAux.y; lp.z -= (aa ? prm2.x * 0.35 : prm.y * 0.9); lp = rotX(lp, -el); ln = rotX(ln, -el); lp.y += aAux.x; lp.z += aAux.y; }
  lp = rotY(lp, yaw); ln = rotY(ln, yaw); lp += aPiv;
} else if (kd == 5.0) { lp = rotY(lp - aPiv, uTime * 1.4) + aPiv; ln = rotY(ln, uTime * 1.4); }
else if (kd == 6.0) { float a = iLook.z + uTime * iLook.w; lp = rotZ(lp - aPiv, a) + aPiv; ln = rotZ(ln, a); }
else if (kd == 7.0 || kd == 8.0) { float a = (kd == 7.0 ? prm.x : prm.z) * aAux.y; lp -= aPiv; if (aAux.x < 0.5) { lp = rotX(lp, a); ln = rotX(ln, a); } else { lp = rotZ(lp, a); ln = rotZ(ln, a); } lp += aPiv; }
else if (kd == 9.0) { float u = aFx.x; lp += ln * (sin(u * 6.0 - uTime * 5.0 + iLook.z) * 0.18 + sin(u * 2.5 - uTime * 2.1) * 0.08) * u * (1.0 + aPiv.y * 0.0); }
vFlag = kd == 9.0 && iLook.y > 0.5 ? vec3((mod(iLook.y - 1.0, 8.0) + 0.02 + aFx.x * 0.96) / 8.0, 1.0 - (floor((iLook.y - 1.0) / 8.0) + 0.03 + aFx.y * 0.94) / 8.0, 1.0) : vec3(0.0);
vec3 objectNormal = normalize(mat3(bm) * ln + vec3(0.0, 1e-5, 0.0));
#ifdef USE_TANGENT
vec3 objectTangent = vec3(tangent.xyz);
#endif`)
      .replace('#include <begin_vertex>', `vec3 transformed = (bm * vec4(lp, 1.0)).xyz;`)
      .replace('#include <color_vertex>', `float aPart = aInfo.x, aZone = aInfo.y, aKind = aInfo.z; vec2 aAux = aAF.xy, aFx = aAF.zw;
float palRow = floor(iLook.x), bright = 0.93 + fract(iLook.x) * 0.14;
vec3 zc = aZone < 11.5 ? texture2D(uPal, vec2((aZone + 0.5) / uPalSize.x, (palRow + 0.5) / uPalSize.y)).rgb : color;
if (uDebug > 0.5 && aZone > 11.5) zc = vec3(0.55);
vColor = zc * (aZone < 3.5 ? bright : 1.0);`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform sampler2D uFlags;\nvarying vec3 vFlag;')
      .replace('#include <color_fragment>', `#include <color_fragment>
if (vFlag.z > 0.5) diffuseColor.rgb = texture2D(uFlags, vFlag.xy).rgb;`);
  };
  mat.customProgramCacheKey = () => 'naveVAT'; return mat;
}

/* ---------- compartido, lotes y LOD ---------- */
// NaveShared(naciones, {eras, flagSource}): textura de huesos de todos los clips, paletas (nación × época × dominio) y atlas de banderas.
function NaveShared(nations, opts) {
  opts = opts || {}; const baked = bakeClips(); this.baked = baked; this.eras = opts.eras || NAVE_ERAS.slice(); this.nations = []; this.flags = new NaveFlagAtlas(); this.flagSource = opts.flagSource || null;
  this.U = {uBones: {value: baked.tex}, uBonesSize: {value: new THREE.Vector2(baked.W, baked.H)}, uFPR: {value: baked.FPR}, uPal: {value: null}, uPalSize: {value: new THREE.Vector2(12, 1)}, uTime: {value: 0}, uBlend: {value: 0.4}, uFlags: {value: this.flags.tex || null}, uDebug: {value: 0}};
  this.timeU = this.U.uTime; this.addNations(nations || ['GEN']);
}
NaveShared.prototype.addNations = function (list) {
  list.forEach(n => { if (!this.nations.includes(n)) this.nations.push(n); }); if (!this.nations.includes('GEN')) this.nations.push('GEN');
  this.palEntries = []; this._row = {}; this.nations.forEach(n => this.eras.forEach(e => DOMS.forEach(d => { this._row[n + e + d] = this.palEntries.length; this.palEntries.push([n, e, d]); })));
  if (this.palTex) this.palTex.dispose(); this.palTex = makePaletteTex(this.palEntries); this.U.uPal.value = this.palTex; this.U.uPalSize.value.set(12, this.palEntries.length);
};
NaveShared.prototype.palRow = function (nation, era, dom) { const r = this._row[nation + era + dom]; return r != null ? r : this._row['GEN' + era + dom] || 0; };
NaveShared.prototype.flagCell = function (tag) { if (!this.flagSource) return -1; const c = this.flags.cell(tag, this.flags.cells[tag] == null ? this.flagSource(tag) : null); return c; };
NaveShared.prototype.clipInfo = function (rig, clip) { return this.baked.index[rig] && this.baked.index[rig][clip]; };
NaveShared.prototype.update = function (time) { this.U.uTime.value = time; };
const _m4 = new THREE.Matrix4(), _qq = new THREE.Quaternion(), _qa = new THREE.Quaternion(), _pp = new THREE.Vector3(), _ss = new THREE.Vector3(), _eu = new THREE.Euler(0, 0, 0, 'YXZ');
// NaveBatch: una malla instanciada por tipo + época + modelo + LOD
function NaveBatch(shared, kind, era, nation, cap, opts) {
  opts = opts || {}; const K = NAVE_KINDS[kind], t = buildNave(kind, era, {nation}), lod = opts.lod || 0, geo = t.lod[lod].geometry.clone();
  const A = (n, fill) => { const a = new THREE.InstancedBufferAttribute(new Float32Array(cap * n).fill(fill || 0), n); a.setUsage(THREE.DynamicDrawUsage); return a; };
  this.iAnimA = A(4); this.iAnimB = A(4, -1); this.iLook = A(4); this.iAim = A(4, -1);
  geo.setAttribute('iAnimA', this.iAnimA); geo.setAttribute('iAnimB', this.iAnimB); geo.setAttribute('iLook', this.iLook); geo.setAttribute('iAim', this.iAim);
  this.mesh = new THREE.InstancedMesh(geo, makeNaveMaterial(shared, {side: lod === 2 || K.clase === 'aereo' ? THREE.DoubleSide : THREE.FrontSide}), cap);
  this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.mesh.count = 0; this.mesh.frustumCulled = false;
  Object.assign(this, {shared, kind, rig: t.rig, era: t.era, cap, tris: t.lod[lod].tris, lod, dom: K.dom, info: t});
}
// add(x, y, z, rumbo, escala, nación (tag), clip, {phase | start, bright, aim: [rumbo, elev, rumboAA, elevAA], spin (rad/s), pitch, roll, quat}) → índice
NaveBatch.prototype.add = function (x, y, z, yaw, scale, nation, clip, o) {
  o = o || {}; const i = this.mesh.count; if (i >= this.cap) return -1; this.mesh.count++;
  this.setTransform(i, x, y, z, yaw, scale, o);
  this.setClip(i, clip, o.start != null ? o.start : o.phase != null ? o.phase : Math.random(), false);
  const row = this.shared.palRow(nation, this.era, this.dom), br = o.bright != null ? o.bright : Math.random(), cell = o.flag === false ? -1 : this.shared.flagCell(nation);
  this.iLook.setXYZW(i, row + 0.02 + br * 0.96 * 0.999, cell + 1, Math.random() * 6.28, o.spin != null ? o.spin : (this.dom === 'aire' ? 140 : 0));
  const a = o.aim || [0, -1, 0, -1]; this.iAim.setXYZW(i, a[0], a[1], a[2], a[3]);
  this.iLook.needsUpdate = this.iAim.needsUpdate = true; return i;
};
NaveBatch.prototype.setTransform = function (i, x, y, z, yaw, scale, o) {
  o = o || {}; if (o.quat) _qq.copy(o.quat); else { _eu.set(o.pitch || 0, yaw, o.roll || 0, 'YXZ'); _qq.setFromEuler(_eu); }
  _pp.set(x, y, z); _ss.set(scale, scale, scale); _m4.compose(_pp, _qq, _ss); this.mesh.setMatrixAt(i, _m4); this.mesh.instanceMatrix.needsUpdate = true;
};
// setAim(i, rumbo, elevación, rumboAA, elevaciónAA): radianes en el sistema del casco (0 = a proa, positivo hacia babor); elevación < −0,5 = reposo
NaveBatch.prototype.setAim = function (i, y, e, ya, ea) { this.iAim.setXYZW(i, y, e, ya != null ? ya : y, ea != null ? ea : e); this.iAim.needsUpdate = true; };
NaveBatch.prototype.setSpin = function (i, radPerSec) { this.iLook.setW(i, radPerSec); this.iLook.needsUpdate = true; };
NaveBatch.prototype.setClip = function (i, clip, phaseOrStart, blend) {
  const ci = this.shared.clipInfo(this.rig, clip); if (!ci) return false; const now = this.shared.U.uTime.value;
  if (blend) this.iAnimB.setXYZW(i, this.iAnimA.getX(i), this.iAnimA.getY(i), this.iAnimA.getZ(i), now); else this.iAnimB.setXYZW(i, -1, 0, 1, 0);
  this.iAnimA.setXYZW(i, ci.row, ci.loop ? ci.frames : -ci.frames, ci.dur, ci.loop ? (phaseOrStart || 0) : (phaseOrStart != null ? phaseOrStart : now));
  this.iAnimA.needsUpdate = this.iAnimB.needsUpdate = true; return true;
};
NaveBatch.prototype.clear = function () { this.mesh.count = 0; };
NaveBatch.prototype.dispose = function () { this.mesh.geometry.dispose(); this.mesh.material.dispose(); };
// NaveLodSet(shared, tipo, época, nación, capacidades, {dist}): mismo patrón que TroopLodSet. add(dist, x, y, z, rumbo, escala, tag, clip, opciones) → [nivel, índice]
function NaveLodSet(shared, kind, era, nation, caps, opts) {
  opts = opts || {}; caps = Array.isArray(caps) ? caps : [caps, caps, caps]; const K = NAVE_KINDS[kind];
  this.dist = opts.dist || (K.clase === 'aereo' ? [60, 220] : [120, 500]); this.batches = [0, 1, 2].map(l => new NaveBatch(shared, kind, era, nation, caps[l], {lod: l})); this.meshes = this.batches.map(b => b.mesh);
}
NaveLodSet.prototype.begin = function () { for (let l = 0; l < 3; l++) this.batches[l].mesh.count = 0; };
NaveLodSet.prototype.levelFor = function (d) { return d < this.dist[0] ? 0 : d < this.dist[1] ? 1 : 2; };
NaveLodSet.prototype.add = function (d, x, y, z, yaw, scale, tag, clip, o) { const l = this.levelFor(d); return [l, this.batches[l].add(x, y, z, yaw, scale, tag, clip, o)]; };
NaveLodSet.prototype.setClip = function (lvIdx, clip, ph, blend) { return this.batches[lvIdx[0]].setClip(lvIdx[1], clip, ph, blend); };
NaveLodSet.prototype.setAim = function (lvIdx, y, e, ya, ea) { this.batches[lvIdx[0]].setAim(lvIdx[1], y, e, ya, ea); };

/* ---------- utilidades de clips ---------- */
function clipInfo(kind, clip) { const K = NAVE_KINDS[kind] || {rig: kind}, c = (CLIPS[K.rig] || {})[clip]; return c ? {dur: c.dur, loop: c.loop !== false, ev: c.ev || []} : null; }
function clipPhase(kind, clip, time, phaseOrStart) { const c = clipInfo(kind, clip); if (!c) return 0; if (!c.loop) return Math.min(1, Math.max(0, (time - phaseOrStart) / c.dur)); const x = time / c.dur + phaseOrStart; return x - Math.floor(x); }
// eventsBetween(tipo, clip, fase0, fase1, cb(nombre, t)): eventos cruzados entre dos fases (con vuelta del bucle) para disparar partículas y sonidos
function eventsBetween(kind, clip, ph0, ph1, cb) {
  const c = clipInfo(kind, clip); if (!c) return; const ev = c.ev; if (ph1 >= ph0) { for (const e of ev) if (e[0] > ph0 && e[0] <= ph1) cb(e[1], e[0]); }
  else { for (const e of ev) if (e[0] > ph0 || e[0] <= ph1) cb(e[1], e[0]); }
}
function exportClipsJSON(space) { return JSON.stringify({version: 1, fps: {bucle: 12, sinBucle: 16}, convenciones: 'pistas [t, rx, ry, rz] en grados; root/pos [t, x, y, z] en metros; param [t, tren, retroceso, compuertas]; param2 [t, retroceso AA]; eventos [t, nombre]', partes: RIGS, clips: CLIPS}, null, space); }
function naveStats() {
  const out = []; Object.keys(NAVE_KINDS).forEach(k => ['GBR', 'GER', 'JPN'].forEach(n => { const t = buildNave(k, '2', {nation: n}); out.push({tipo: k, nacion: n, modelo: t.modelo, lod0: t.lod[0].tris, lod1: t.lod[1].tris, lod2: t.lod[2].tris, limite: NAVE_KINDS[k].lim, clips: t.clips.length}); })); return out;
}

root.naves3d = {NAVE_KINDS, NAVE_ERAS, NAVE_MAP, NAVES_NAC, buildNave, poseNave, blendPose, navePalette, naveGeoKey, naveModel, NaveShared, NaveBatch, NaveLodSet, naveStats, clipInfo, clipPhase, eventsBetween, exportClipsJSON, bakeClips, RIGS, CLIPS, CLIP_SETS, K, Z};
})(typeof window !== 'undefined' ? window : globalThis);
