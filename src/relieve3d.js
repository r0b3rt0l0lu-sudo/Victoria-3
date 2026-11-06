/* ===== RELIEVE 3D DEL MAPA DE CAMPAÑA (fase 1: relieve y color) =====
   · Altura de dibujo (R.hr) a partir de la altitud real SRTM/GEBCO (ELEV, relieve.js) con detalle procedural según la rugosidad.
     La altura de juego (MAP.height) no cambia: solo cambia lo que se dibuja.
   · terrainY(lon, lat): altura del suelo dibujado; la usan ciudades, chimeneas, humo y figuras.
   · Texturas para el shader del terreno: normales + altitud (R.reliefTex) y distancia con signo a la costa (R.coastTex).
   · Colores del terreno por bioma (BIOME_COL + PAL de las paletas) y altitud real, sin sombreado horneado: el relieve lo pone la luz.
   · Parámetros: R.reliefK (0–1, intensidad del relieve; los modos temáticos usan el 60 %), R.lightAz/R.lightAlt (dirección de la luz). */
const HR_W = 1024, HR_H = 410;
R.reliefK = 0.75; R.lightAz = 315; R.lightAlt = 48;

// metros → altura del mundo (exageración vertical suave, como un mapa físico)
const metersToY = m => 0.02 + R.exag * 1.15 * Math.pow(Math.max(0, m) / 1000, 0.85);

function buildRenderHeight() {
  if (R.hr) return R.hr;
  const t0 = performance.now(), hr = new Float32Array(HR_W * HR_H), mt = new Float32Array(HR_W * HR_H);
  const land = MAP.land, dL = MAP.dLand, dS = MAP.dSea, hp = MAP.height;
  for (let j = 0; j < HR_H; j++) {
    const py = Math.min(MAP_H - 1, ((j + 0.5) * MAP_H / HR_H) | 0), lat = yToLat((j + 0.5) * MAP_H / HR_H);
    for (let i = 0; i < HR_W; i++) {
      const px = Math.min(MAP_W - 1, ((i + 0.5) * MAP_W / HR_W) | 0), lon = xToLon((i + 0.5) * MAP_W / HR_W), mi = py * MAP_W + px, k = j * HR_W + i;
      if (land[mi]) {
        const e = elevAt(lon, lat); let m = e.h;
        if (m < 15) m = 15 + Math.max(0, hp[mi]) * 110;                     // la costa del juego no coincide con la real: relieve procedural suave
        const rough = Math.max(e.rough, m * 0.04);
        const n1 = fbm(lon * 1.7, lat * 1.7, 77, 3), ridge = 1 - Math.abs(2 * fbm(lon * 0.8, lat * 0.8, 79, 3) - 1);
        m += (n1 - 0.5) * rough * 1.4 + (ridge - 0.55) * rough * 1.1;
        const t = Math.min(1, dL[mi] / 4);                                   // la orilla baja suavemente hasta el mar
        mt[k] = Math.max(0, m); hr[k] = 0.02 + (metersToY(m) - 0.02) * (t * t * (3 - 2 * t));
      } else { const d = Math.min(1, dS[mi] / 40); hr[k] = -0.06 - 0.5 * d * d * (3 - 2 * d); mt[k] = 0; }
    }
  }
  R.hr = hr; R.hrM = mt; R.hrMs = Math.round(performance.now() - t0);
  return hr;
}
// altura dibujada en coordenadas de píxel del mapa lógico (bilineal)
function renderHeightPx(px, py) {
  const hr = R.hr || buildRenderHeight();
  const fx = clamp(px * HR_W / MAP_W - 0.5, 0, HR_W - 1.001), fy = clamp(py * HR_H / MAP_H - 0.5, 0, HR_H - 1.001), x0 = fx | 0, y0 = fy | 0, tx = fx - x0, ty = fy - y0, i = y0 * HR_W + x0;
  return (hr[i] * (1 - tx) + hr[i + 1] * tx) * (1 - ty) + (hr[i + HR_W] * (1 - tx) + hr[i + HR_W + 1] * tx) * ty;
}
function terrainY(lon, lat) { return renderHeightPx(lonToX(lon), latToY(lat)); }
function terrainYPx(px, py) { return renderHeightPx(px + 0.5, py + 0.5); }

// texturas del shader: normales del relieve + altitud (1024×410) y distancia a la costa (2048×820)
function buildReliefTextures() {
  const hr = R.hr || buildRenderHeight(), mt = R.hrM, data = new Uint8Array(HR_W * HR_H * 4);
  const dx = 360 / HR_W, dz = (LAT_TOP - LAT_BOT) / HR_H, SX = 4.2;          // SX: exageración solo para el sombreado
  for (let j = 0; j < HR_H; j++) for (let i = 0; i < HR_W; i++) {
    const k = j * HR_W + i, xl = i > 0 ? k - 1 : k, xr = i < HR_W - 1 ? k + 1 : k, yu = j > 0 ? k - HR_W : k, yd = j < HR_H - 1 ? k + HR_W : k;
    const sx = Math.max(0, hr[xr]) - Math.max(0, hr[xl]), sz = Math.max(0, hr[yd]) - Math.max(0, hr[yu]);
    let nx = -sx / ((xr - xl) * dx || dx) * SX, nz = -sz / (((yd - yu) / HR_W) * dz || dz) * SX, ny = 1; const l = Math.hypot(nx, ny, nz); nx /= l; nz /= l;
    const o = ((HR_H - 1 - j) * HR_W + i) * 4;                               // filas invertidas: v = 0 abajo, como la textura del mapa
    data[o] = (nx * 0.5 + 0.5) * 255; data[o + 1] = (nz * 0.5 + 0.5) * 255; data[o + 2] = Math.min(255, mt[k] / 6400 * 255); data[o + 3] = 255;
  }
  const rt = new THREE.DataTexture(data, HR_W, HR_H, THREE.RGBAFormat); rt.magFilter = THREE.LinearFilter; rt.minFilter = THREE.LinearMipmapLinearFilter; rt.generateMipmaps = true; rt.wrapS = THREE.RepeatWrapping; rt.needsUpdate = true;
  // costa: distancia con signo (+ tierra, − mar) en píxeles del mapa, 32 niveles por píxel
  const W = MAP_W, H = MAP_H, cd = new Uint8Array(W * H * 4), land = MAP.land, dL = MAP.dLand, dS = MAP.dSea;
  let sd = new Float32Array(W * H), tmp = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) sd[i] = clamp(land[i] ? dL[i] - 0.5 : -(dS[i] - 0.5), -4, 4);
  for (let pass = 0; pass < 2; pass++) {                                      // suavizado [1 2 1]: redondea los escalones de la cuadrícula
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x; tmp[i] = (sd[x > 0 ? i - 1 : i] + 2 * sd[i] + sd[x < W - 1 ? i + 1 : i]) * 0.25; }
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x; sd[i] = (tmp[y > 0 ? i - W : i] + 2 * tmp[i] + tmp[y < H - 1 ? i + W : i]) * 0.25; }
  }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, o = ((H - 1 - y) * W + x) * 4;
    let gx = sd[x < W - 1 ? i + 1 : i] - sd[x > 0 ? i - 1 : i], gy = sd[y > 0 ? i - W : i] - sd[y < H - 1 ? i + W : i]; const gl = Math.hypot(gx, gy) || 1;   // dirección hacia tierra (v hacia arriba)
    cd[o] = clamp(128 + sd[i] * 32, 0, 255); cd[o + 1] = 128 + gx / gl * 127; cd[o + 2] = 128 + gy / gl * 127; cd[o + 3] = 255;
  }
  const ct = new THREE.DataTexture(cd, W, H, THREE.RGBAFormat); ct.magFilter = THREE.LinearFilter; ct.minFilter = THREE.LinearFilter; ct.generateMipmaps = false; ct.needsUpdate = true;
  R.reliefTex = rt; R.coastTex = ct;
}

// dirección de la luz (azimut desde el norte, en grados; altura en grados) → vector del mundo (x este, z sur)
function reliefLightDir() {
  const az = R.lightAz * Math.PI / 180, al = R.lightAlt * Math.PI / 180;
  return new THREE.Vector3(Math.sin(az) * Math.cos(al), Math.sin(al), -Math.cos(az) * Math.cos(al)).normalize();
}
// intensidad efectiva según el modo de mapa: los modos políticos y temáticos llevan menos relieve para no tapar los colores
function reliefModeK() { return (R.reliefK ?? 0.75) * (R.mode === 'terrain' ? 1 : 0.6); }
function syncReliefUniforms() {
  const u = R.detailU; if (!u || !u.reliefK) return;
  u.reliefK.value = reliefModeK(); u.terrK.value = R.mode === 'terrain' ? 1 : 0;
  const L = reliefLightDir(); u.lightW.value.copy(L);
  placeSun(); R.dirty = true;
}
// el sol (luz direccional de three.js) sigue la dirección configurada; en invierno está más bajo
function placeSun() {
  if (!R.sun) return; const w = typeof seasonState === 'function' && G.date ? seasonState().winter : 0.5;
  const az = R.lightAz * Math.PI / 180, al = clamp(R.lightAlt - w * 12, 15, 85) * Math.PI / 180, d = 120;
  R.sun.position.set(R.cam.tx + Math.sin(az) * Math.cos(al) * d, Math.sin(al) * d, R.cam.tz - Math.cos(az) * Math.cos(al) * d);
  if (R.sun.target) { R.sun.target.position.set(R.cam.tx, 0, R.cam.tz); R.sun.target.updateMatrixWorld(); }
}
function setReliefStrength(k) { R.reliefK = clamp(k, 0, 1); syncReliefUniforms(); try { const p = JSON.parse(localStorage.getItem('victoria-map-prefs') || '{}'); p.relief = R.reliefK; localStorage.setItem('victoria-map-prefs', JSON.stringify(p)); } catch (e) {} }
function setReliefLight(az, alt) { if (az != null) R.lightAz = az; if (alt != null) R.lightAlt = clamp(alt, 15, 80); syncReliefUniforms(); }

// parche del shader Lambert del terreno (lo llama render.js en onBeforeCompile)
function reliefShaderPatch(sh) {
  sh.uniforms.reliefMap = {value: R.reliefTex}; sh.uniforms.coastMap = {value: R.coastTex};
  sh.uniforms.reliefK = {value: reliefModeK()}; sh.uniforms.terrK = {value: R.mode === 'terrain' ? 1 : 0}; sh.uniforms.lightW = {value: reliefLightDir()};
  sh.uniforms.mapTexel = {value: new THREE.Vector2(1 / MAP_W, 1 / MAP_H)};
  sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vW;').replace('#include <begin_vertex>', '#include <begin_vertex>\n vW = position;');
  sh.fragmentShader = sh.fragmentShader
    .replace('#include <map_pars_fragment>', `#include <map_pars_fragment>
uniform sampler2D detailMap; uniform float detailK; varying vec3 vW; uniform float snowK; uniform vec3 seasonTint;
uniform sampler2D reliefMap; uniform sampler2D coastMap; uniform float reliefK; uniform float terrK; uniform vec3 lightW; uniform vec2 mapTexel;
vec3 rlfN; float rlfM; float rlfLand;`)
    .replace('#include <map_fragment>', `
 vec4 rlf = texture2D(reliefMap, vMapUv);
 rlfN = vec3(rlf.r * 2.0 - 1.0, 0.0, rlf.g * 2.0 - 1.0); rlfN.y = sqrt(max(0.04, 1.0 - dot(rlfN.xz, rlfN.xz))); rlfM = rlf.b * 6400.0;
 vec2 muv = vMapUv;
 float dt2 = texture2D(detailMap, vMapUv * vec2(21.0, 8.4)).r;
#ifdef RELIEF_LOW
 float sdf = 2.0; rlfLand = step(0.004, vW.y); float dsel = 0.5;
 float dt = texture2D(detailMap, vMapUv * vec2(130.0, 52.0)).r;
#else
 vec4 cst = texture2D(coastMap, vMapUv); float sdf = (cst.r * 255.0 - 128.0) / 32.0;
 float aaw = max(fwidth(sdf), 0.02); rlfLand = smoothstep(-aaw, aaw, sdf);
 // detalle sin repetición visible: dos escalas giradas y mezcladas por un ruido de baja frecuencia
 float dsel = dt2;
 float dA = texture2D(detailMap, vMapUv * vec2(130.0, 52.0)).r, dB = texture2D(detailMap, mat2(0.8, -0.6, 0.6, 0.8) * vMapUv * vec2(117.0, 46.8) + 0.37).r;
 float dt = mix(dA, dB, smoothstep(0.3, 0.7, dsel));
 if (terrK > 0.5) muv += (vec2(dt2, dsel) - 0.5) * mapTexel * 2.4;                  // bordes de bioma orgánicos en el modo terreno
#endif
 vec4 sampledDiffuseColor = texture2D(map, muv);
#ifndef RELIEF_LOW
 if (abs(sdf) < 1.6) {                                                              // costa suave: color de tierra o de mar según la distancia filtrada
   vec2 g = cst.gb * 2.0 - 1.0; g = g / max(length(g), 1e-3);
   vec4 cL = texture2D(map, vMapUv + g * mapTexel * 1.1), cS = texture2D(map, vMapUv - g * mapTexel * 1.1);
   sampledDiffuseColor = mix(cS, cL, rlfLand);
 }
#endif
 diffuseColor *= sampledDiffuseColor;
 diffuseColor.rgb *= 1.0 + detailK * ((dt - 0.5) * (0.12 + 0.14 * terrK) + (dt2 - 0.5) * 0.12);
 // roca en las pendientes fuertes y altitud (sobre todo en el modo terreno)
 float slope = 1.0 - rlfN.y;
 float rock = smoothstep(0.18, 0.5, slope) * smoothstep(500.0, 1600.0, rlfM) * rlfLand;
 diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.50, 0.47, 0.43) * (0.85 + 0.3 * dt), rock * (0.15 + 0.5 * terrK));
 // nieve: línea de nieve real por latitud y estación + nieve de llanura en invierno y casquetes polares
 float la = abs(vW.z);
 float snowLine = 5200.0 - 4700.0 * pow(smoothstep(10.0, 78.0, la), 1.3) - snowK * 1500.0;   // ≈2600 m en los Alpes, ≈1300 m en Noruega (verano)
 float sn = smoothstep(snowLine - 300.0, snowLine + 300.0, rlfM + (dt - 0.5) * 500.0) * (1.0 - 0.45 * smoothstep(0.45, 0.8, slope));
 sn = max(sn, snowK * 0.62 * smoothstep(46.0, 66.0, la)) + smoothstep(68.0, 80.0, la) * 0.45;
 diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * seasonTint, rlfLand);
 diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.94, 0.96, 1.0), clamp(sn, 0.0, 1.0) * (0.35 + 0.45 * terrK) * rlfLand);
 // sombreado del relieve: realza el contraste respecto a la llanura (que conserva su color exacto)
 vec3 nR = normalize(mix(vec3(0.0, 1.0, 0.0), rlfN, reliefK * rlfLand));
 diffuseColor.rgb *= clamp(1.0 + reliefK * (0.45 + 0.55 * terrK) * (dot(nR, lightW) - lightW.y) * 2.0, 0.4, 1.55);`)
    .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
 normal = normalize((viewMatrix * vec4(normalize(mix(vec3(0.0, 1.0, 0.0), rlfN, reliefK * rlfLand)), 0.0)).xyz);`);
}
// calidad baja: sin costa suave ni bordes orgánicos (menos lecturas de textura)
function syncReliefQuality() {
  const m = R.mesh && R.mesh.children[0] && R.mesh.children[0].material; if (!m) return;
  const low = R.quality === 'bajo'; if (!!(m.defines && m.defines.RELIEF_LOW !== undefined) === low) return;
  m.defines = m.defines || {}; if (low) m.defines.RELIEF_LOW = ''; else delete m.defines.RELIEF_LOW; m.needsUpdate = true; R.dirty = true;
}

// colores del terreno: bioma (BIOME_COL mezclado con las paletas del mapa de batalla) y altitud real; sin sombreado horneado
buildTerrainColors = function (land, h, biome) {
  const W = MAP_W, H = MAP_H, tc = new Uint8ClampedArray(W * H * 4);
  const pal = b => { const p = typeof PAL !== 'undefined' && PAL[b], c = BIOME_COL[b]; return p ? [(c[0] + p.b[0]) / 2, (c[1] + p.b[1]) / 2, (c[2] + p.b[2]) / 2] : c; };
  const BC = [0, 1, 2, 3, 4, 5, 6, 7, 8].map(pal), HIGH = [126, 110, 80], ROCK = [128, 122, 112];
  for (let y = 0; y < H; y++) {
    const lat = yToLat(y), alat = Math.abs(lat);
    for (let x = 0; x < W; x++) {
      const i = y * W + x; let r, g, b;
      if (land[i]) {
        let bi = biome[i];
        // montaña y nieve del juego siguen al relieve procedural: el color usa el clima de la latitud y la altitud real
        if (bi === BIOME.MOUNTAIN || (bi === BIOME.SNOW && alat < 62)) bi = alat > 56 ? BIOME.TUNDRA : alat < 32 ? BIOME.STEPPE : BIOME.GRASS;
        const c = BC[bi];
        const nz = (fbm(x / 26, y / 26, 53, 3) - 0.5) * 22 + (fbm(x / 7, y / 7, 51, 2) - 0.5) * 8;
        r = c[0] + nz; g = c[1] + nz; b = c[2] + nz * 0.8;
        if (bi !== BIOME.SNOW) {
          const m = elevAt(xToLon(x), lat).h, a = smooth(700, 2400, m) * 0.6, q = smooth(2600, 4200, m) * 0.5;
          r += (HIGH[0] - r) * a; g += (HIGH[1] - g) * a; b += (HIGH[2] - b) * a;
          r += (ROCK[0] - r) * q; g += (ROCK[1] - g) * q; b += (ROCK[2] - b) * q;
        }
      } else {
        const d = MAP.dSea[i], t = smooth(0, 55, d);
        r = 70 + (22 - 70) * t; g = 128 + (52 - 128) * t; b = 150 + (84 - 150) * t;
        const nz = (fbm(x / 20, y / 20, 61, 3) - 0.5) * 10; r += nz; g += nz; b += nz;
        r += 22 * (1 - smooth(0, 4, d)); g += 22 * (1 - smooth(0, 4, d)); b += 16 * (1 - smooth(0, 4, d));   // aguas someras (la espuma la pone el agua)
      }
      const o = i * 4; tc[o] = r; tc[o + 1] = g; tc[o + 2] = b; tc[o + 3] = 255;
    }
  }
  addRivers(tc, land, h);
  return tc;
};

// la calidad baja desactiva lo caro del shader; el modo de mapa cambia la intensidad del relieve
const _applyQualityRel = applyQuality;
applyQuality = function (q, why) { _applyQualityRel(q, why); syncReliefQuality(); syncReliefUniforms(); };
const _setMapModeRel = setMapMode;
setMapMode = function (m) { _setMapModeRel(m); syncReliefUniforms(); };
const _loadMapPrefsRel = loadMapPrefs;
loadMapPrefs = function () { _loadMapPrefsRel(); try { const p = JSON.parse(localStorage.getItem('victoria-map-prefs') || '{}'); if (typeof p.relief === 'number') R.reliefK = clamp(p.relief, 0, 1); } catch (e) {} };
const _saveMapPrefsRel = saveMapPrefs;
saveMapPrefs = function () { _saveMapPrefsRel(); try { const p = JSON.parse(localStorage.getItem('victoria-map-prefs') || '{}'); p.relief = R.reliefK; localStorage.setItem('victoria-map-prefs', JSON.stringify(p)); } catch (e) {} };
const _graphicsTickRel = graphicsTick;
graphicsTick = function (t) { _graphicsTickRel(t); if (!R._relInit && R.detailU && R.detailU.reliefK) { R._relInit = true; syncReliefQuality(); syncReliefUniforms(); } placeSun(); };
