
/* ---------------- evaluación de poses (sin estado; sin asignaciones en el bucle) ---------------- */
const _e = new THREE.Euler(), _q = new THREE.Quaternion(), _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1), _pm = new THREE.Matrix4();
function smooth(t) { return t * t * (3 - 2 * t); }
function sampleTrack(tr, t, out, n) {                  // tr: [[t, a, b, c...]] ordenado; t en [0,1]
  if (!tr || !tr.length) { for (let i = 0; i < n; i++) out[i] = 0; return out; }
  if (tr.length === 1 || t <= tr[0][0]) { for (let i = 0; i < n; i++) out[i] = tr[0][i + 1]; return out; }
  for (let k = 0; k < tr.length - 1; k++) {
    const a = tr[k], b = tr[k + 1];
    if (t <= b[0]) { const u = smooth((t - a[0]) / Math.max(1e-6, b[0] - a[0])); for (let i = 0; i < n; i++) out[i] = a[i + 1] + (b[i + 1] - a[i + 1]) * u; return out; }
  }
  const l = tr[tr.length - 1]; for (let i = 0; i < n; i++) out[i] = l[i + 1]; return out;
}
const _r3 = [0, 0, 0], _t3 = [0, 0, 0], _t1 = [0];
function sampleStep(tr, t, out, n) { let k = 0; for (let i = 0; i < tr.length; i++) if (tr[i][0] <= t + 1e-6) k = i; for (let i = 0; i < n; i++) out[i] = tr[k][i + 1]; return out; }
// poseTroop(tipo o esqueleto, clip, fase, salida Float32Array(MAXP*16)) → matrices de cada parte en el espacio de la figura
function poseTroop(kindOrRig, clipName, phase, out) {
  const rig = RIGS[kindOrRig] ? kindOrRig : KINDS[kindOrRig].rig, parts = RIGS[rig], clip = (CLIPS[rig] || {})[clipName] || {tracks: {}};
  out = out || new Float32Array(MAXP * 16); const t = clip.loop === false ? Math.min(1, Math.max(0, phase)) : phase - Math.floor(phase);
  for (let i = 0; i < parts.length; i++) {
    const name = parts[i][0], par = parts[i][1], off = parts[i][2];
    sampleTrack(clip.tracks[name], t, _r3, 3);
    _e.set(_r3[0] * D2R, _r3[1] * D2R, _r3[2] * D2R); _q.setFromEuler(_e);
    _p.set(off[0], off[1], off[2]);
    if (par < 0 && clip.root) { sampleTrack(clip.root, t, _t3, 3); _p.x += _t3[0]; _p.y += _t3[1]; _p.z += _t3[2]; }
    if (clip.pos && clip.pos[name]) { sampleTrack(clip.pos[name], t, _t3, 3); _p.x += _t3[0]; _p.y += _t3[1]; _p.z += _t3[2]; }
    if (name === 'tubo' && clip.slide) { sampleTrack(clip.slide, t, _t1, 1); _p.z += _t1[0]; }
    if (name === 'canon' && clip.gunSlide) { sampleTrack(clip.gunSlide, t, _t1, 1); _p.z += _t1[0]; }
    _m.compose(_p, _q, _s);
    if (par >= 0) { _pm.fromArray(out, par * 16); _m.premultiply(_pm); }
    _m.toArray(out, i * 16);
  }
  if (clip.tracks.armaP) ikWeapon(parts, clip, t, out);
  if (clip.hide) for (const name in clip.hide) {               // parte oculta: escala 0 alrededor de su pivote
    sampleStep(clip.hide[name], t, _t1, 1); if (_t1[0] > 0.5) continue;
    for (let i = 0; i < parts.length; i++) if (parts[i][0] === name) { const o = i * 16; out[o] = out[o + 1] = out[o + 2] = out[o + 4] = out[o + 5] = out[o + 6] = out[o + 8] = out[o + 9] = out[o + 10] = 0; }
  }
  return out;
}
// arma colocada respecto al torso (armaP posición, armaR giro) y manos por IK de dos huesos hasta los puntos de agarre
const _T = new THREE.Matrix4(), _W = new THREE.Matrix4(), _S = new THREE.Vector3(), _E = new THREE.Vector3(), _Tg = new THREE.Vector3(), _d = new THREE.Vector3(), _pp2 = new THREE.Vector3(), _pole = new THREE.Vector3(), _dn = new THREE.Vector3(0, -1, 0), _qa = new THREE.Quaternion(), _sc1 = new THREE.Vector3(1, 1, 1);
const _gr = [0, 0], _ap = [0, 0, 0], _ar = [0, 0, 0];
function ikWeapon(parts, clip, t, out) {
  const ix = {}; parts.forEach((p, i) => { ix[p[0]] = i; });
  if (ix.arma == null || ix.torso == null) return;
  sampleTrack(clip.tracks.armaP, t, _ap, 3); sampleTrack(clip.tracks.armaR || [[0, 0, 0, 0]], t, _ar, 3); sampleStep(clip.tracks.agarre || [[0, 0.3, 0.75]], t, _gr, 2);
  _T.fromArray(out, ix.torso * 16);
  _e.set(_ar[0] * D2R, _ar[1] * D2R, _ar[2] * D2R); _q.setFromEuler(_e); _p.set(_ap[0], _ap[1], _ap[2]); _W.compose(_p, _q, _s).premultiply(_T); _W.toArray(out, ix.arma * 16);
  [['brazoDe', 'antebrazoDe', _gr[0], -1], ['brazoIz', 'antebrazoIz', _gr[1], 1]].forEach(([u, l, y, side]) => {
    if (y < 0 || ix[u] == null || ix[l] == null) return;
    _S.setFromMatrixPosition(_pm.fromArray(out, ix[u] * 16));
    _Tg.set(0, y, 0).applyMatrix4(_W);
    _pole.set(0.45 * side, -0.55, -0.25).applyMatrix4(_T); _pp2.setFromMatrixPosition(_T); _pole.sub(_pp2).add(_S);   // codo: fuera y abajo-atrás
    ik2(_S, _Tg, _pole, 0.29, 0.28, out, ix[u], ix[l]);
  });
}
function ik2(S, T, pole, l1, l2, out, iu, il) {
  _d.subVectors(T, S); let dist = _d.length(); const dir = _d.normalize(); dist = Math.min(l1 + l2 - 1e-3, Math.max(Math.abs(l1 - l2) + 1e-3, dist));
  const ca = (l1 * l1 + dist * dist - l2 * l2) / (2 * l1 * dist), sa = Math.sqrt(Math.max(0, 1 - ca * ca));
  _pp2.subVectors(pole, S); _pp2.addScaledVector(dir, -_pp2.dot(dir)).normalize();
  _E.copy(S).addScaledVector(dir, l1 * ca).addScaledVector(_pp2, l1 * sa);
  _Tg.copy(S).addScaledVector(dir, dist);
  _d.subVectors(_E, S).normalize(); _qa.setFromUnitVectors(_dn, _d); _m.compose(S, _qa, _sc1); _m.toArray(out, iu * 16);
  _d.subVectors(_Tg, _E).normalize(); _qa.setFromUnitVectors(_dn, _d); _m.compose(_E, _qa, _sc1); _m.toArray(out, il * 16);
}
// blendPose(a, b, k, salida): mezcla lineal de matrices de parte (transiciones de 0,15–0,3 s)
function blendPose(a, b, k, out) { out = out || new Float32Array(a.length); for (let i = 0; i < a.length; i++) out[i] = a[i] + (b[i] - a[i]) * k; return out; }

/* ---------------- horneado (textura de huesos) ---------------- */
// Una fila por fotograma; MAXP × 3 texeles RGBA float por fila (matriz 3×4 por parte). Bucles a 16 fps, no-bucles a 24 fps, ≤ 96 fotogramas por clip.
let _baked = null;
function bakeClips() {
  if (_baked) return _baked;
  const rows = [], index = {}; let row = 0;
  Object.keys(CLIPS).forEach(rig => {
    if (!RIGS[rig] || !RIGS[rig].length) return;
    index[rig] = {};
    Object.keys(CLIPS[rig]).forEach(cn => {
      const c = CLIPS[rig][cn]; if (!c) return;
      const frames = Math.max(2, Math.min(96, Math.round(c.dur * (c.loop === false ? 24 : 16))));
      index[rig][cn] = {row, frames, dur: c.dur, loop: c.loop !== false, tread: c.tread || 0, ev: c.ev || []};
      for (let f = 0; f < frames; f++) { const ph = c.loop === false ? f / (frames - 1) : f / frames; rows.push(poseTroop(rig, cn, ph)); }
      row += frames;
    });
  });
  // FPR fotogramas por fila de textura para no pasar de 2048 filas (límite seguro en móviles)
  const FPR = Math.max(1, Math.ceil(rows.length / 2048)), W = MAXP * 3 * FPR, H = Math.ceil(rows.length / FPR), data = new Float32Array(W * H * 4);
  rows.forEach((m, r) => { const rr = Math.floor(r / FPR), cc = r - rr * FPR; for (let p = 0; p < MAXP; p++) { const o = (rr * W + cc * MAXP * 3 + p * 3) * 4, e = m.subarray(p * 16, p * 16 + 16);
    for (let i = 0; i < 3; i++) { data[o + i * 4] = e[i]; data[o + i * 4 + 1] = e[4 + i]; data[o + i * 4 + 2] = e[8 + i]; data[o + i * 4 + 3] = e[12 + i]; } } });
  const tex = new THREE.DataTexture(data, W, H, THREE.RGBAFormat, THREE.FloatType); tex.needsUpdate = true; tex.magFilter = tex.minFilter = THREE.NearestFilter;
  if (H > 4096 || W > 4096) console.warn('troops3d: textura de huesos de ' + W + '×' + H);
  _baked = {tex, index, rows, W, H, FPR, frames: rows.length, bytes: data.byteLength}; return _baked;
}

/* ---------------- paletas en textura ---------------- */
// fila 0: tonos de piel (0–3) y pelajes (4–7); filas siguientes: una por nación × época × papel
const SKIN = ['#f0c8a0', '#d9a77e', '#b07a50', '#7a4e30'], HORSE = ['#8a5430', '#a8683a', '#3a322c', '#b8b0a2'];
function makePaletteTex(entries) {
  const W = 12, H = 1 + entries.length, d = new Uint8Array(W * H * 4), put = (r, c, hex) => { const v = new THREE.Color(hex), o = (r * W + c) * 4; /* Color(hex) ya es lineal (ColorManagement de r152): se guarda en sRGB */ d[o] = Math.round(Math.pow(v.r, 1 / 2.2) * 255); d[o + 1] = Math.round(Math.pow(v.g, 1 / 2.2) * 255); d[o + 2] = Math.round(Math.pow(v.b, 1 / 2.2) * 255); d[o + 3] = 255; };
  SKIN.forEach((h, i) => put(0, i, h)); HORSE.forEach((h, i) => put(0, 4 + i, h));
  entries.forEach((e, r) => { const p = uniformPalette(e[0], e[1], e[2]); [p.main, p.trim, p.accessory, p.hat, p.flag[0], p.flag[1], p.flag[2], p.vehicle, p.mark[0], p.mark[1], p.mark[2], p.vehicle2].forEach((h, c) => put(r + 1, c, h)); });
  const tex = new THREE.DataTexture(d, W, H, THREE.RGBAFormat); tex.needsUpdate = true; tex.magFilter = tex.minFilter = THREE.NearestFilter; tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/* ---------------- material (GPU) ---------------- */
// Uniformes compartidos: uBones (huesos horneados), uPal (paletas), uTime. Atributos por instancia:
//   iAnimA = (fila, fotogramas (< 0 = sin bucle), duración, fase | instante de inicio), iAnimB = clip anterior (fila < 0 = sin mezcla), w = inicio de la mezcla,
//   iLook  = (fila de paleta + brillo, tono de piel, pelaje, velocidad de oruga)
function makeTroopMaterial(shared, opts) {
  opts = opts || {};
  const mat = new THREE.MeshLambertMaterial({vertexColors: true, side: opts.side || THREE.FrontSide});
  mat.onBeforeCompile = sh => {
    sh.uniforms.uBones = shared.bonesU; sh.uniforms.uBonesSize = shared.bonesSizeU; sh.uniforms.uFPR = shared.fprU; sh.uniforms.uPal = shared.palU; sh.uniforms.uPalSize = shared.palSizeU; sh.uniforms.uTime = shared.timeU; sh.uniforms.uBlend = shared.blendU; sh.uniforms.uDebug = shared.debugU;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>
uniform sampler2D uBones; uniform vec2 uBonesSize; uniform float uFPR; uniform sampler2D uPal; uniform vec2 uPalSize; uniform float uTime; uniform float uBlend; uniform float uDebug;
attribute float aPart; attribute float aZone; attribute float aVar; attribute vec2 aFx;
attribute vec4 iAnimA; attribute vec4 iAnimB; attribute vec4 iLook;
varying float vTread;
vec4 bt(float x, float y) { return texture2D(uBones, vec2((x + 0.5) / uBonesSize.x, (y + 0.5) / uBonesSize.y)); }
mat4 boneAt(float fr, float part) { float row = floor(fr / uFPR); float x = (fr - row * uFPR) * 60.0 + part * 3.0; vec4 a = bt(x, row), b = bt(x + 1.0, row), c = bt(x + 2.0, row);
  return mat4(a.x, b.x, c.x, 0.0, a.y, b.y, c.y, 0.0, a.z, b.z, c.z, 0.0, a.w, b.w, c.w, 1.0); }
mat4 clipBone(vec4 an, float part) {
  float fr = abs(an.y), f;
  if (an.y < 0.0) f = clamp((uTime - an.w) / an.z, 0.0, 1.0) * (fr - 1.0);
  else f = fract(uTime / an.z + an.w) * fr;
  float f0 = floor(f), f1 = an.y < 0.0 ? min(f0 + 1.0, fr - 1.0) : mod(f0 + 1.0, fr);
  return boneAt(an.x + f0, part) * (1.0 - (f - f0)) + boneAt(an.x + f1, part) * (f - f0);
}`)
      .replace('#include <beginnormal_vertex>', `mat4 bm = clipBone(iAnimA, aPart);
if (iAnimB.x >= 0.0) { float k = clamp((uTime - iAnimB.w) / uBlend, 0.0, 1.0); if (k < 1.0) bm = clipBone(vec4(iAnimB.xyz, iAnimB.y < 0.0 ? -1e4 : iAnimA.w), aPart) * (1.0 - k) + bm * k; }
vec3 objectNormal = normalize(mat3(bm) * normal + vec3(0.0, 1e-5, 0.0));
#ifdef USE_TANGENT
vec3 objectTangent = vec3(tangent.xyz);
#endif`)
      .replace('#include <begin_vertex>', `vec3 pos0 = position;
if (aFx.x > 0.0) { float ph = iAnimA.w * 6.2831; pos0.z += sin(aFx.x * 7.0 - uTime * 6.0 + ph) * 0.13 * aFx.x + sin(aFx.x * 3.0 - uTime * 2.3 + pos0.y * 3.0) * 0.05 * aFx.x; pos0.y += sin(aFx.x * 5.0 - uTime * 4.0 + ph) * 0.03 * aFx.x; }
vec3 transformed = (bm * vec4(pos0, 1.0)).xyz;
float sp = iLook.w, piv = step(500.0, sp); sp -= piv * 1000.0;
vTread = aFx.y != 0.0 ? abs(aFx.y) + uTime * sp * (piv > 0.5 ? sign(aFx.y) : 1.0) : -1.0;`)
      .replace('#include <color_vertex>', `float palRow = floor(iLook.x), bright = 0.92 + fract(iLook.x) * 0.16;
vec3 zc = aZone < 11.5 ? texture2D(uPal, vec2((aZone + 0.5) / uPalSize.x, (palRow + 1.5) / uPalSize.y)).rgb : color;
if (aVar > 0.5 && aVar < 1.5) zc = texture2D(uPal, vec2((iLook.y + 0.5) / uPalSize.x, 0.5 / uPalSize.y)).rgb;
if (aVar > 1.5) zc = texture2D(uPal, vec2((4.0 + iLook.z + 0.5) / uPalSize.x, 0.5 / uPalSize.y)).rgb;
if (uDebug > 0.5 && aZone > 11.5) zc = vec3(0.55);
vColor = zc * (aZone < 2.5 || (aZone > 6.5 && aZone < 7.5) || (aZone > 10.5 && aZone < 11.5) ? bright : 1.0);`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vTread;')
      .replace('#include <color_fragment>', `#include <color_fragment>
if (vTread >= 0.0) diffuseColor.rgb *= 0.7 + 0.45 * step(0.5, fract(vTread));`);
  };
  mat.customProgramCacheKey = () => 'troopVAT';
  return mat;
}

/* ---------------- API: buildTroop ---------------- */
const _cache = {};
function nearestEra(K, era) { if (K.eras.includes(era)) return era; const i = TROOP_ERAS.indexOf(era); for (let d = 1; d < 5; d++) { if (K.eras.includes(TROOP_ERAS[i - d])) return TROOP_ERAS[i - d]; if (K.eras.includes(TROOP_ERAS[i + d])) return TROOP_ERAS[i + d]; } return K.eras[0]; }
// buildTroop(tipo, época, {nation, role}) → {tint, fixed, geometry, parts, clips, lod: [{level, geometry, tint, fixed, tris}×3], tris, rig, era}
function buildTroop(kind, era, opts) {
  opts = opts || {}; const K = KINDS[kind]; if (!K) throw new Error('tipo desconocido: ' + kind);
  era = nearestEra(K, era || 'A');
  const nat = opts.nation || 'GEN', o = K.o(era, nat, opts.role), key = [kind, era, o.toc || '', o.flagLayout || '', opts.role || '', o.modelo || '', o.marca || '', o.tripulante || '', o.lmg || '', o.equipo || ''].join('|');
  if (_cache[key]) return _cache[key];
  const lv = [K.build(o), K.lod(o, 1), K.lod(o, 2)].map((g, level) => ({level, geometry: g.toGeometry(), tint: g.toGeometry(z => z < 11.5), fixed: g.toGeometry(z => z >= 11.5), tris: g.tris()}));
  const res = {kind, era, rig: K.rig, parts: RIGS[K.rig].map(p => p[0]), clips: CLIP_SETS[K.rig] || [], tris: lv[0].tris, geometry: lv[0].geometry, tint: lv[0].tint, fixed: lv[0].fixed, lod: lv, headgear: o.toc || null};
  _cache[key] = res; return res;
}
// clave de geometría: las naciones con el mismo tocado (y bandera) comparten malla y lote
function troopGeoKey(kind, era, nation) { const K = KINDS[kind], e = nearestEra(K, era), o = K.o(e, nation || 'GEN'); return [kind, e, o.toc || '', o.flagLayout || '', o.modelo || '', o.marca || '', o.tripulante || '', o.lmg || '', o.equipo || ''].join('|'); }

/* ---------------- campo de tropas instanciadas (GPU) ---------------- */
// TroopShared(naciones, {eras}): eras = épocas con fila de paleta (por defecto las 4; con muchos países, pasa solo la época actual)
function TroopShared(nations, opts) {
  const baked = bakeClips(); this.baked = baked; this.nations = []; this.eras = (opts && opts.eras) || TROOP_ERAS.slice();
  this.bonesU = {value: baked.tex}; this.bonesSizeU = {value: new THREE.Vector2(baked.W, baked.H)}; this.fprU = {value: baked.FPR}; this.palU = {value: null}; this.palSizeU = {value: new THREE.Vector2(12, 1)};
  this.timeU = {value: 0}; this.blendU = {value: 0.22}; this.debugU = {value: 0};
  this.addNations(nations || ['GEN']);
}
// addNations: añade naciones (p. ej. países del juego registrados en NACIONES) y rehace la textura de paletas
TroopShared.prototype.addNations = function (list) {
  list.forEach(n => { if (!this.nations.includes(n)) this.nations.push(n); }); if (!this.nations.includes('GEN')) this.nations.push('GEN');
  this.palEntries = []; this._row = {};
  this.nations.forEach(n => this.eras.forEach(e => ROLES.forEach(r => { this._row[n + e + r] = this.palEntries.length; this.palEntries.push([n, e, r]); })));
  if (this.palTex) this.palTex.dispose(); this.palTex = makePaletteTex(this.palEntries); this.palU.value = this.palTex; this.palSizeU.value.set(12, 1 + this.palEntries.length);
};
TroopShared.prototype.palRow = function (nation, era, rol) { const r = this._row[nation + era + (rol || 'linea')]; return r != null ? r : this._row['GEN' + era + (rol || 'linea')] || 0; };
// setEras: cambia las épocas con paleta (p. ej. al pasar de 1855 a 1856) y rehace la textura
TroopShared.prototype.setEras = function (eras) { this.eras = eras.slice(); this.addNations([]); };
TroopShared.prototype.clipInfo = function (rig, clip) { return this.baked.index[rig] && this.baked.index[rig][clip]; };
// TroopBatch: una malla instanciada por tipo + época + tocado + LOD
function TroopBatch(shared, kind, era, nation, cap, opts) {
  opts = opts || {}; const K = KINDS[kind], t = buildTroop(kind, era, {nation, role: opts.role}), lod = opts.lod || 0;
  const geo = t.lod[lod].geometry.clone();
  this.iAnimA = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4); this.iAnimB = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4).fill(-1), 4); this.iLook = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4);
  [this.iAnimA, this.iAnimB, this.iLook].forEach(a => a.setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('iAnimA', this.iAnimA); geo.setAttribute('iAnimB', this.iAnimB); geo.setAttribute('iLook', this.iLook);
  this.mesh = new THREE.InstancedMesh(geo, makeTroopMaterial(shared, {side: K.dobleCara || lod === 2 ? THREE.DoubleSide : THREE.FrontSide}), cap);
  this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  this.mesh.count = 0; this.mesh.frustumCulled = false; this.shared = shared; this.kind = kind; this.rig = t.rig; this.era = t.era; this.cap = cap; this.tris = t.lod[lod].tris; this.lod = lod; this.rol = K.pal || 'linea'; this.role = opts.role;
}
const _m4 = new THREE.Matrix4(), _qq = new THREE.Quaternion(), _pp = new THREE.Vector3(), _ss = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);
// add(x, y, z, rumbo, escala, nación, clip, {phase | start, h, bright, skin, horse, tread}) → índice. Sin opciones deterministas, se sortean.
TroopBatch.prototype.add = function (x, y, z, yaw, scale, nation, clip, o) {
  o = o || {}; const i = this.mesh.count; if (i >= this.cap) return -1; this.mesh.count++;
  const h = 1 + (o.h != null ? o.h : (Math.random() - 0.5) * 0.12);
  _qq.setFromAxisAngle(_up, yaw); _pp.set(x, y, z); _ss.set(scale * h, scale * h, scale * h); _m4.compose(_pp, _qq, _ss); this.mesh.setMatrixAt(i, _m4);
  this.setClip(i, clip, o.start != null ? o.start : o.phase != null ? o.phase : Math.random(), false);
  const row = this.shared.palRow(nation, this.era, this.rol), br = o.bright != null ? o.bright : Math.random();
  this.iLook.setXYZW(i, row + 0.02 + br * 0.96 * 0.999, o.skin != null ? o.skin : Math.floor(Math.random() * 4), o.horse != null ? o.horse : Math.floor(Math.random() * 4), o.tread || 0);
  this.iLook.needsUpdate = true; this.mesh.instanceMatrix.needsUpdate = true;
  return i;
};
// setClip(i, clip, fase (bucle) | instante de inicio en s (sin bucle), mezclar): con mezcla conserva el clip anterior durante uBlend s
TroopBatch.prototype.setClip = function (i, clip, phaseOrStart, blend) {
  const ci = this.shared.clipInfo(this.rig, clip); if (!ci) return false;
  if (blend) this.iAnimB.setXYZW(i, this.iAnimA.getX(i), this.iAnimA.getY(i), this.iAnimA.getZ(i), this.shared.timeU.value); else this.iAnimB.setXYZW(i, -1, 0, 1, 0);
  this.iAnimA.setXYZW(i, ci.row, ci.loop ? ci.frames : -ci.frames, ci.dur, ci.loop ? phaseOrStart : (phaseOrStart != null ? phaseOrStart : this.shared.timeU.value));
  this.iAnimA.needsUpdate = this.iAnimB.needsUpdate = true; return true;
};
TroopBatch.prototype.clear = function () { this.mesh.count = 0; };
TroopBatch.prototype.dispose = function () { this.mesh.geometry.dispose(); this.mesh.material.dispose(); };
// TroopLodSet: tres lotes (LOD 0/1/2) del mismo tipo; add(distancia, ...) elige el nivel. dist = [límite LOD0, límite LOD1] en unidades del mundo
function TroopLodSet(shared, kind, era, nation, caps, opts) {
  opts = opts || {}; caps = Array.isArray(caps) ? caps : [caps, caps, caps]; this.dist = opts.dist || [25, 90];
  this.batches = [0, 1, 2].map(l => new TroopBatch(shared, kind, era, nation, caps[l], {role: opts.role, lod: l}));
  this.meshes = this.batches.map(b => b.mesh);
}
TroopLodSet.prototype.begin = function () { for (let l = 0; l < 3; l++) this.batches[l].mesh.count = 0; };
TroopLodSet.prototype.levelFor = function (d) { return d < this.dist[0] ? 0 : d < this.dist[1] ? 1 : 2; };
TroopLodSet.prototype.add = function (d, x, y, z, yaw, scale, nation, clip, o) { const l = this.levelFor(d); return [l, this.batches[l].add(x, y, z, yaw, scale, nation, clip, o)]; };

/* ---------------- reserva en CPU: una malla por parte ---------------- */
function CpuBatch(kind, era, nation, cap, opts) {
  opts = opts || {}; const K = KINDS[kind], t = buildTroop(kind, era, {nation, role: opts.role}), g = t.lod[opts.lod || 0].geometry, parts = RIGS[t.rig].length, pa = g.getAttribute('aPart').array, P = g.getAttribute('position').array, N = g.getAttribute('normal').array, Co = g.getAttribute('color').array, Zo = g.getAttribute('aZone').array, Vr = g.getAttribute('aVar').array;
  const pal = uniformPalette(nation, t.era, K.pal), zc = [pal.main, pal.trim, pal.accessory, pal.hat, pal.flag[0], pal.flag[1], pal.flag[2], pal.vehicle, pal.mark[0], pal.mark[1], pal.mark[2], pal.vehicle2].map(h => new THREE.Color(h)), skin = new THREE.Color(SKIN[1]), coat = new THREE.Color(HORSE[0]);
  this.meshes = []; this.rig = t.rig; this.kind = kind; this.cap = cap; this.count = 0; this.parts = parts; this.tris = t.lod[opts.lod || 0].tris;
  for (let p = 0; p < parts; p++) {
    const idx = []; for (let v = 0; v < pa.length; v++) if (pa[v] === p) idx.push(v); if (!idx.length) { this.meshes.push(null); continue; }
    const gp = new THREE.BufferGeometry(), pp = new Float32Array(idx.length * 3), nn = new Float32Array(idx.length * 3), cc = new Float32Array(idx.length * 3);
    idx.forEach((v, k) => { for (let j = 0; j < 3; j++) { pp[k * 3 + j] = P[v * 3 + j]; nn[k * 3 + j] = N[v * 3 + j]; } const z = Zo[v]; const c = Vr[v] === 1 ? skin : Vr[v] === 2 ? coat : z < 11.5 ? zc[z] : null; cc[k * 3] = c ? c.r : Co[v * 3]; cc[k * 3 + 1] = c ? c.g : Co[v * 3 + 1]; cc[k * 3 + 2] = c ? c.b : Co[v * 3 + 2]; });
    gp.setAttribute('position', new THREE.BufferAttribute(pp, 3)); gp.setAttribute('normal', new THREE.BufferAttribute(nn, 3)); gp.setAttribute('color', new THREE.BufferAttribute(cc, 3));
    const m = new THREE.InstancedMesh(gp, new THREE.MeshLambertMaterial({vertexColors: true, side: K.dobleCara ? THREE.DoubleSide : THREE.FrontSide}), cap); m.count = 0; m.frustumCulled = false; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.meshes.push(m);
  }
  this.base = new Float32Array(cap * 16); this.anim = new Float32Array(cap * 4);   // matriz de instancia y (fila de clip, fotogramas, duración, fase)
}
CpuBatch.prototype.add = function (x, y, z, yaw, scale, clipInfo, phase) {
  const i = this.count++; _qq.setFromAxisAngle(_up, yaw); _pp.set(x, y, z); _ss.set(scale, scale, scale); _m4.compose(_pp, _qq, _ss); _m4.toArray(this.base, i * 16);
  this.anim[i * 4] = clipInfo.row; this.anim[i * 4 + 1] = clipInfo.frames; this.anim[i * 4 + 2] = clipInfo.dur; this.anim[i * 4 + 3] = phase; this.meshes.forEach(m => { if (m) m.count = this.count; });
};
// update: por instancia toma el fotograma horneado más cercano y escribe instancia × parte en cada malla (sin asignaciones)
const _bi = new THREE.Matrix4(), _bp = new THREE.Matrix4();
CpuBatch.prototype.update = function (time, baked) {
  const rows = baked.rows;
  for (let i = 0; i < this.count; i++) {
    const r = this.anim[i * 4], fr = this.anim[i * 4 + 1], f = Math.floor(((time / this.anim[i * 4 + 2] + this.anim[i * 4 + 3]) % 1) * fr), pose = rows[r + f];
    _bi.fromArray(this.base, i * 16);
    for (let p = 0; p < this.parts; p++) { const m = this.meshes[p]; if (!m) continue; _bp.fromArray(pose, p * 16).premultiply(_bi); _bp.toArray(m.instanceMatrix.array, i * 16); }
  }
  for (let p = 0; p < this.meshes.length; p++) if (this.meshes[p]) this.meshes[p].instanceMatrix.needsUpdate = true;
};

/* ---------------- grupos (pieza + servidores, general + ayudante...) ---------------- */
// troopGroup(nombre, época, estado, {pieza}) → [{kind, role, at: [x, z, rumbo en grados], clip}] en metros, relativos al centro del grupo y mirando a +Z.
// Todos los miembros deben usar la MISMA fase (o el mismo instante de inicio) para que el fuego de la pieza y los servidores coincidan.
const TROOP_GROUPS = {
  bateria: {nombre: 'Pieza con 4 servidores', estados: ['fuego', 'reposo', 'marcha']},
  ametralladora: {nombre: 'Ametralladora con 2 servidores', estados: ['fuego', 'reposo']},
  general: {nombre: 'General con ayudante', estados: ['reposo', 'marcha', 'carga', 'observar']},
  mariscal: {nombre: 'Mariscal con estandarte de mando', estados: ['reposo', 'marcha']},
  camilla: {nombre: 'Camilla con dos sanitarios', estados: ['marcha']},
  fuerte: {nombre: 'Guarnición tras el parapeto', estados: ['fuego', 'cubierto', 'asomarse']},
  tren: {nombre: 'Pieza enganchada al avantrén', estados: ['marcha', 'trote']}
};
function troopGroup(name, era, estado, opts) {
  opts = opts || {}; const AB2 = era === 'A' || era === 'B';
  if (name === 'bateria') {
    const p = opts.pieza || (AB2 ? 'canon' : 'canon_rc'), liso = p === 'canon' || (p === 'obus' && era !== 'D'), f = estado === 'fuego', m = estado === 'marcha';
    const sv = liso ? 'servicio' : 'servicio_rc', crew = liso ? [['escobillon', 'srv_escobillon', [-0.9, 2.0, -90]], ['cargador', 'srv_cargador', [0.9, 2.0, 90]], ['apuntador', 'srv_apuntador', [0.35, -1.7, 0]], ['artillero', 'srv_artillero', [-1.2, -0.6, 90]]]
      : [['jefe', 'srv_jefe', [-1.6, 0.4, 0]], ['cargador', 'srv_cargador', [0.9, -0.2, 90]], ['apuntador', 'srv_apuntador', [-0.35, -1.7, 0]], ['artillero', 'srv_artillero', [-0.9, -0.6, 90]]];
    return [{kind: p, at: [0, 0, 0], clip: f ? sv : m ? 'remolque' : 'en_bateria'}].concat(crew.map(([role, c, at]) => ({kind: 'artillero', role, at: m ? [at[0] > 0 ? 1.0 : -1.0, at[1] - 1.5, 0] : at, clip: f ? c : m ? 'marcha' : 'idle'})));
  }
  if (name === 'ametralladora') { const f = estado === 'fuego'; return [{kind: 'ametralladora', at: [0, 0, 0], clip: f ? 'fuego_mg' : 'en_bateria'}, {kind: 'artillero', role: 'tirador_mg', at: [0, era === 'D' ? -0.95 : -1.45, 0], clip: f ? 'srv_mg_tirador' : 'idle'}, {kind: 'artillero', role: 'municion', at: [0.75, era === 'D' ? -0.5 : -0.9, -40], clip: f ? 'srv_mg_municion' : 'idle'}]; }
  if (name === 'general') { const c = {reposo: 'idle', marcha: 'paso', carga: 'galope_de_mando', observar: 'observar_catalejo'}[estado] || 'idle'; return [{kind: 'general', at: [0, 0, 0], clip: c}, {kind: 'ayudante', at: [1.6, -1.2, 0], clip: c === 'galope_de_mando' ? 'galope' : c === 'observar_catalejo' ? 'idle' : c}]; }
  if (name === 'mariscal') { const c = estado === 'marcha' ? 'paso' : 'idle'; return [{kind: 'mariscal', at: [0, 0, 0], clip: c}, {kind: 'estandarte', at: [-1.5, -1.3, 0], clip: c}]; }
  if (name === 'camilla') return [{kind: 'sanitario', role: 'delante', at: [0, 1.3, 0], clip: 'camilla_delante'}, {kind: 'sanitario', role: 'detras', at: [0, 1.3 - 2.62, 0], clip: 'camilla_detras'}];
  if (name === 'fuerte') { const c = {fuego: AB2 ? 'disparar_A' : 'disparo_desde_parapeto', cubierto: 'agacharse', asomarse: 'asomarse'}[estado] || 'agacharse'; return [{kind: 'parapeto', at: [0, 0.4, 0], clip: 'reposo'}, {kind: 'fusilero', at: [-1.0, -0.35, 0], clip: c}, {kind: 'fusilero', at: [0.9, -0.35, 0], clip: c}, {kind: 'oficial', at: [0, -1.3, 0], clip: estado === 'fuego' ? 'ordenar' : 'observar_catalejo'}]; }
  if (name === 'tren') { const c = estado === 'trote' ? 'trote' : 'paso'; return [{kind: 'avantren', at: [0, 0, 0], clip: c}, {kind: AB2 ? 'canon' : 'canon_rc', at: [0, -3.3, 180], clip: 'remolque'}]; }
  return [];
}

/* ---------------- eventos y fases (para sincronizar humo, sonido y bajas) ---------------- */
function clipInfo(kind, clip) { const K = KINDS[kind] || {rig: kind}, c = (CLIPS[K.rig] || {})[clip]; return c ? {dur: c.dur, loop: c.loop !== false, ev: c.ev || []} : null; }
// clipPhase: misma fórmula que el shader. Bucle: fract(t/dur + fase); sin bucle: clamp((t - inicio)/dur)
function clipPhase(kind, clip, time, phaseOrStart) { const c = clipInfo(kind, clip); if (!c) return 0; if (!c.loop) return Math.min(1, Math.max(0, (time - phaseOrStart) / c.dur)); const x = time / c.dur + phaseOrStart; return x - Math.floor(x); }
// eventsBetween: llama cb(nombre, t) por cada evento cruzado entre dos fases consecutivas (tiene en cuenta la vuelta del bucle)
function eventsBetween(kind, clip, ph0, ph1, cb) {
  const c = clipInfo(kind, clip); if (!c) return 0; let n = 0;
  for (let i = 0; i < c.ev.length; i++) { const t = c.ev[i][0]; const hit = ph1 >= ph0 ? (t > ph0 && t <= ph1) : (t > ph0 || t <= ph1); if (hit) { cb(c.ev[i][1], t); n++; } }
  return n;
}
function exportClipsJSON() {
  const r = (k, v) => typeof v === 'number' ? Math.round(v * 1000) / 1000 : v;
  return JSON.stringify({version: 2, fps: {bucle: 16, sinBucle: 24}, convenciones: 'pistas [t, rx, ry, rz] en grados (Euler XYZ); raíz [t, x, y, z] en metros; eventos [t, nombre]; agarre [t, y mano derecha, y mano izquierda]; hide [t, visible]', partes: RIGS, clips: CLIPS}, r);
}

/* ---------------- estadísticas ---------------- */
function troopStats() {
  const out = [], LIM = {inf: [220, 60, 10], cav: [420, 120, 10], art: [700, null, null], tank: [600, null, null]};
  TROOP_KINDS.forEach(k => KINDS[k].eras.forEach(e => {
    const roles = KINDS[k].roles ? [KINDS[k].roles[0]] : [undefined];
    roles.forEach(role => { const t = buildTroop(k, e, {nation: 'GEN', role}); const verts = t.lod[0].tris * 3;
      out.push({tipo: k, epoca: e, triangulos: t.lod[0].tris, lod1: t.lod[1].tris, lod2: t.lod[2].tris, partes: RIGS[t.rig].length, clips: t.clips.length, vertices: verts, bytesInstancia: 64 + 48, limite: (LIM[KINDS[k].clase] || [])[0] || null}); });
  }));
  return out;
}

