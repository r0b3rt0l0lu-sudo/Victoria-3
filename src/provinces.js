/* ===== PROVINCIAS: subdivisión de cada estado para mover tropas ===== */
// Datos estáticos en MAP.provs / MAP.provOf; datos dinámicos (ocupación, fortificación) en G.P.
const NOPROV = 65535;
const OCC_DAYS = 5;            // días que debe mantenerse una provincia sin defensores para ocuparla

function buildProvinces() {
  const t0 = performance.now();
  const W = MAP_W, H = MAP_H, N = W * H, land = MAP.land, so = MAP.stateOf;
  const provOf = new Uint16Array(N).fill(NOPROV);
  const provs = [];
  const off = MAP.pixOff, ord = MAP.pixOrder;
  const nb8 = [1, -1, W, -W, W + 1, W - 1, -W + 1, -W - 1];
  const queue = new Int32Array(N);
  for (let sid = 0; sid < MAP.stats.length; sid++) {
    const st = MAP.stats[sid], n = off[sid + 1] - off[sid]; if (!n) continue;
    const want = clamp(Math.round(n / 650), 2, 9);
    // muestra de píxeles para elegir semillas (farthest-point + Lloyd)
    const step = Math.max(1, Math.floor(n / 500)), sample = [];
    for (let k = 0; k < n; k += step) { const i = ord[off[sid] + k]; sample.push([i % W, (i / W) | 0]); }
    const cx = st.sx / st.area, cy = st.sy / st.area;
    let first = sample[0], bd = 1e18; sample.forEach(p => { const d = (p[0] - cx) ** 2 + (p[1] - cy) ** 2; if (d < bd) { bd = d; first = p; } });
    let seeds = [first];
    const md = sample.map(p => (p[0] - first[0]) ** 2 + (p[1] - first[1]) ** 2);
    while (seeds.length < want && seeds.length < sample.length) {
      let bi = 0, bv = -1; md.forEach((v, i) => { if (v > bv) { bv = v; bi = i; } });
      const p = sample[bi]; seeds.push(p);
      sample.forEach((q, i) => { const d = (q[0] - p[0]) ** 2 + (q[1] - p[1]) ** 2; if (d < md[i]) md[i] = d; });
    }
    for (let it = 0; it < 3; it++) {
      const sx = seeds.map(() => 0), sy = seeds.map(() => 0), sn = seeds.map(() => 0);
      sample.forEach(q => { let b = 0, v = 1e18; seeds.forEach((p, j) => { const d = (q[0] - p[0]) ** 2 + (q[1] - p[1]) ** 2; if (d < v) { v = d; b = j; } }); sx[b] += q[0]; sy[b] += q[1]; sn[b]++; });
      seeds = seeds.map((p, j) => { if (!sn[j]) return p; const mx = sx[j] / sn[j], my = sy[j] / sn[j]; let bp = p, bv = 1e18; sample.forEach(q => { const d = (q[0] - mx) ** 2 + (q[1] - my) ** 2; if (d < bv) { bv = d; bp = q; } }); return bp; });
    }
    // reparto por anchura (BFS multifuente dentro del estado)
    const base = provs.length; let qh = 0, qt = 0;
    const uniq = new Set();
    seeds.forEach(p => { const i = p[1] * W + p[0]; if (uniq.has(i)) return; uniq.add(i); provs.push({s: sid}); provOf[i] = provs.length - 1; queue[qt++] = i; });
    while (qh < qt) {
      const i = queue[qh++], p = provOf[i], x = i % W;
      for (let d = 0; d < 8; d++) {
        const dx = d === 0 || d === 4 || d === 6 ? 1 : d === 1 || d === 5 || d === 7 ? -1 : 0;
        if ((x === 0 && dx < 0) || (x === W - 1 && dx > 0)) continue;
        const j = i + nb8[d]; if (j < 0 || j >= N || !land[j] || so[j] !== sid || provOf[j] !== NOPROV) continue;
        provOf[j] = p; queue[qt++] = j;
      }
    }
    // componentes sin semilla (islas): provincia propia
    for (let k = off[sid]; k < off[sid + 1]; k++) {
      const i0 = ord[k]; if (provOf[i0] !== NOPROV) continue;
      provs.push({s: sid}); const p = provs.length - 1; provOf[i0] = p; qh = 0; qt = 0; queue[qt++] = i0;
      while (qh < qt) {
        const i = queue[qh++], x = i % W;
        for (let d = 0; d < 8; d++) {
          const dx = d === 0 || d === 4 || d === 6 ? 1 : d === 1 || d === 5 || d === 7 ? -1 : 0;
          if ((x === 0 && dx < 0) || (x === W - 1 && dx > 0)) continue;
          const j = i + nb8[d]; if (j < 0 || j >= N || !land[j] || so[j] !== sid || provOf[j] !== NOPROV) continue;
          provOf[j] = p; queue[qt++] = j;
        }
      }
    }
    st.provs = []; for (let p = base; p < provs.length; p++) st.provs.push(p);
  }
  // métricas y adyacencia
  const P = provs.length;
  provs.forEach((p, id) => { p.id = id; p.area = 0; p.sx = 0; p.sy = 0; p.biomes = new Float32Array(9); p.coast = 0; p.nb = new Set(); });
  const pnb = new Uint16Array(N).fill(NOPROV), pedge = new Uint8Array(N);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x; if (!land[i]) continue;
    const p = provs[provOf[i]]; p.area++; p.sx += x; p.sy += y; p.biomes[MAP.biome[i]]++;
    if (MAP.dLand[i] < 2.5) p.coast++;
    if (x < W - 1 && land[i + 1] && provOf[i + 1] !== provOf[i]) { const q = provOf[i + 1]; p.nb.add(q); provs[q].nb.add(provOf[i]); pnb[i] = q; pnb[i + 1] = provOf[i]; if (so[i + 1] === so[i]) { pedge[i] = 1; pedge[i + 1] = 1; } }
    if (y < H - 1 && land[i + W] && provOf[i + W] !== provOf[i]) { const q = provOf[i + W]; p.nb.add(q); provs[q].nb.add(provOf[i]); pnb[i] = q; pnb[i + W] = provOf[i]; if (so[i + W] === so[i]) { pedge[i] = 1; pedge[i + W] = 1; } }
  }
  // píxel representativo (más cercano al centroide) y terreno
  const best = new Float32Array(P).fill(1e18);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x; if (!land[i]) continue; const p = provs[provOf[i]];
    const d = (x - p.sx / p.area) ** 2 + (y - p.sy / p.area) ** 2;
    if (d < best[p.id]) { best[p.id] = d; p.px = x; p.py = y; }
  }
  provs.forEach(p => {
    p.nb = [...p.nb]; p.lon = xToLon(p.px); p.lat = yToLat(p.py);
    const b = p.biomes, tot = Math.max(1, p.area);
    const mnt = (b[BIOME.MOUNTAIN] + b[BIOME.SNOW]) / tot, frs = b[BIOME.FOREST] / tot, jun = b[BIOME.JUNGLE] / tot, des = b[BIOME.DESERT] / tot, tun = b[BIOME.TUNDRA] / tot;
    p.terr = {move: 1 + 1.6 * mnt + 0.5 * frs + 0.9 * jun + 0.5 * des + 0.3 * tun, def: 1 + 0.4 * mnt + 0.14 * frs + 0.22 * jun, mnt};
    let bi = 0; for (let k = 1; k < 9; k++) if (b[k] > b[bi]) bi = k; p.biome = bi;
    p.port = p.coast > 6;
    p.name = MAP.seeds[p.s].name + ' ' + (MAP.stats[p.s].provs.indexOf(p.id) + 1);
    delete p.biomes; delete p.sx; delete p.sy;
  });
  MAP.provs = provs; MAP.provOf = provOf; MAP.pnb = pnb; MAP.pedge = pedge;
  console.log('Provincias:', P, 'en', Math.round(performance.now() - t0), 'ms');
}

const provState = pid => MAP.provs[pid].s;
const provOwner = pid => G.S[MAP.provs[pid].s].owner;
function provDist(a, b) { const A = MAP.provs[a], B = MAP.provs[b]; return Math.hypot(A.lon - B.lon, A.lat - B.lat); }
function stateCapitalProv(sid) {   // provincia más central del estado
  const st = MAP.stats[sid]; return st.provs[0];
}
function provAtWorld(p) {
  if (!p) return -1;
  const px = Math.floor(lonToX(p.x)), py = Math.floor(latToY(-p.z));
  if (px < 0 || py < 0 || px >= MAP_W || py >= MAP_H) return -1;
  const i = py * MAP_W + px; return MAP.land[i] ? MAP.provOf[i] : -1;
}
// datos dinámicos
function initProvinceState() {
  G.P = MAP.provs.map(() => ({by: null, prog: 0, fort: 0, ent: 0}));
}
const provOcc = pid => G.P[pid].by;
// recalcula la ocupación agregada de un estado a partir de sus provincias
function refreshStateOcc(sid) {
  const s = G.S[sid], st = MAP.stats[sid]; let tot = 0, occ = 0; const by = {};
  st.provs.forEach(pid => { const a = MAP.provs[pid].area; tot += a; const o = G.P[pid].by; if (o && o !== s.owner) { occ += a; by[o] = (by[o] || 0) + a; } });
  const f = tot ? Math.round(occ / tot * 100) / 100 : 0; let top = null, tv = 0; for (const k in by) if (by[k] > tv) { tv = by[k]; top = k; }
  const changed = f !== (s.occ || 0) || (f > 0 && top !== s.occBy);
  s.occ = f; s.occBy = f > 0 ? top : null; return changed;
}
// libera todas las provincias de un estado (cambio de dueño, fin de guerra)
function clearProvOcc(sid) { MAP.stats[sid].provs.forEach(pid => { const p = G.P[pid]; p.by = null; p.prog = 0; }); refreshStateOcc(sid); }
// camino A* entre provincias. canStep(from,to) decide si se puede entrar; cost(from,to) en días
function pathProvs(from, to, canStep, cost, limit) {
  if (from === to) return [];
  const P = MAP.provs, g = new Map([[from, 0]]), prev = new Map();
  const heap = [[0, from]]; const done = new Set(); let n = 0;
  const push = it => { heap.push(it); let i = heap.length - 1; while (i > 0) { const q = (i - 1) >> 1; if (heap[q][0] <= heap[i][0]) break; [heap[q], heap[i]] = [heap[i], heap[q]]; i = q; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { let c = i * 2 + 1; if (c >= heap.length) break; if (c + 1 < heap.length && heap[c + 1][0] < heap[c][0]) c++; if (heap[c][0] >= heap[i][0]) break; [heap[c], heap[i]] = [heap[i], heap[c]]; i = c; } } return top; };
  heap.length = 0; push([provDist(from, to) * 2, from]);
  while (heap.length) {
    const [, u] = pop(); if (done.has(u)) continue; done.add(u);
    if (u === to) break; if (++n > (limit || 4000)) break;
    for (const v of P[u].nb) {
      if (done.has(v) || !canStep(u, v)) continue;
      const nd = g.get(u) + cost(u, v);
      if (nd < (g.get(v) ?? 1e9)) { g.set(v, nd); prev.set(v, u); push([nd + provDist(v, to) * 2, v]); }
    }
  }
  if (!prev.has(to)) return null;
  const path = []; let cur = to; while (cur !== from) { path.unshift(cur); cur = prev.get(cur); }
  return path;
}
