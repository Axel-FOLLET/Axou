/**
 * Shapes and colours of zone 2: pines, rocks, snowy ground and small details. Mountain.js decides where each thing goes
 * (edges, slopes, navigation) and this file decides how it looks, so the snow style and the mountain layout can change
 * independently. Rampart.js reuses the pines and rocks for its decoration.
 *
 * Style: round, generous forms, soft 3-step toon shading, rounded normals, coloured shadows (lavender, never grey or
 * black), cream snow in the sun. Everything is merged into chunks, with no texture.
 */

import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { SNOW, color } from '../style/palette.js';
import { heightAt } from './Terrain.js';
import { pathClearance, ZONE2 } from './zone2.js';
import { rng } from './random.js';

// ---------------------------------------------------------------------------------- tuning tables

/**
 * Ground colour (colours only: no height changes here).
 * - `path`: edge of the corridor where snow turns to packed snow (signed distance to the corridor, m).
 * - `shade`: maximum share of lavender shaded snow in the hollows.
 * - `rock`: noise threshold where rock breaks through the snow, `rockClear` m away from the path; `rockBand`: transition width.
 * - `lift`: factor on the linear colour: the warm meadow light would otherwise turn the snow mauve-beige.
 * - `scale`, `weight`: inverse thickness noise at three scales (9 m, 3 m and 1 m patches, in cycles per metre), 0 to 1, mean 0.5.
 * - `steep`: increases thinness on slopes (1 - normal y), as snow slides off banks.
 * - `earth`: thresholds where earth appears, before the rock: the snow, earth, rock sequence shows the layer is thin.
 * - `pathEarth`: share of this mix kept on the path: exposed earth, readable footprints, never rock.
 * - `tone`: slow snow variation, +/- 5% brightness, to avoid a flat area.
 * - `around`: bare ground at the foot of rocks and pines, `reach` m around their edge, up to `amount` of `SNOW.dust`.
 */
export const GROUND_LOOK = {
  path: [0.2, -0.15], shade: 0.55, rock: 0.66, rockBand: 0.07, rockClear: 1.6, lift: 1.7,
  earth: [0.57, 0.64], pathEarth: 0.22, steep: 0.5, tone: 0.05,
  scale: [0.11, 0.33, 1], weight: [0.62, 0.28, 0.1],
  around: { reach: 0.6, amount: 0.5 },
  // Marbling (colours only). `scale`: patches of 6 m and 2 m, in cycles per metre; `warm`, `cool`: maximum share of warm sunlit
  // and lavender shaded snow; `packed`: share of lighter or matte packed snow on the path; `onPath`: share of the marbling kept
  // on the path; `lo`, `hi`: noise thresholds (plain ground between patches, soft edges). Low contrast on purpose: footprints
  // and the path edge stay the most readable.
  marble: { scale: [0.17, 0.5], weight: [0.7, 0.3], lo: 0.45, hi: 0.85, warm: 0.55, cool: 0.45, packed: 0.75, onPath: 0.95 },
};

/**
 * Snow drifts: soft bumps, visual only. The height used by the cat (`heightAt`) does not change: the mesh rises at most
 * `amp` x (1 + `ripple`) m (0.29 m) above it and never goes below (a pine or rock placed on `heightAt` never floats), and
 * nothing moves in the corridor or within `around` m of the edge of a pine or rock.
 * `rotate`: crest direction (the wind, rad); `scale`: cycles per metre along and across the crest (crests about 9 m long
 * and 2.4 m wide); `lo`, `hi`: noise thresholds for the shape (flat ground between bumps, rounded top); `ripple`: share of
 * fine ripples, `rippleScale` their frequency. `start`, `full`: distance to the corridor (m) where drifts begin and reach
 * full height; `farFrom`, `farTo`: they fade out far away (coarse mesh, fog).
 * Colour, on top of the light shading: `crest` (slightly warmer top, share `crestMix`) and `lee` (lavender lee side, share `leeMix`).
 */
export const DRIFT = {
  amp: 0.24, rotate: 0.55, scale: [0.09, 0.36], lo: 0.3, hi: 0.95, ripple: 0.22, rippleScale: [0.45, 1.4],
  start: 1.7, full: 4.8, farFrom: 22, farTo: 46, around: 0.8,
  crestMix: 0.35, leeMix: 0.4,
};

/**
 * Small details on the snow outside the corridor (at most `reach` m from the path edge, denser near it: probability of
 * keeping a point `exp(-distance / falloff)`). `tufts`: grass tufts poking out, `pebbles`: groups of small stones, `twigs`:
 * twigs; `count`: number placed. `minClear`: minimum distance to the corridor (m), beyond the snow berm.
 * `minX`, `wallZ`: the -X side (x < ZONE2.x + minX, for |z| <= wallZ) belongs to the rampart and the painted bridge scenery
 * (Rampart.js): no detail or drift there. -3.8 leaves a 0.7 m margin, so no vertex lies below -4.5.
 */
export const DETAIL = {
  seed: 20261108, reach: 22, falloff: 9, minClear: 1.9, minX: -3.8, wallZ: 60,
  tufts: { count: 240, blades: [3, 5], h: [0.22, 0.5], w: 0.07 },
  pebbles: { count: 120, per: [2, 4], r: [0.08, 0.2] },
  twigs: { count: 70, len: [0.4, 0.85], r: 0.03 },
};

/**
 * Pine and rock shapes. Mountain.js reads `h`, `R`, `trunkR`, `clearFrac`, `r`, `flat` and `bury` to place the scenery.
 * `pine`: `tiers` rounded bell tiers, `sides` faces near the path and `sidesFar` far from it (`near`: boundary distance to
 * the corridor, m); `h` and `R`: ranges (m); `trunkH`, `trunkR`, `sink` (depth in the snow), all in m; `clearFrac`: share of
 * the radius that keeps decoration off the path; `step`: spacing of tiers as a share of their height (they overlap);
 * `shrink`: radius lost per tier; `wobble`: irregularity of the tier edge; `puff`: share of snow at the underside edge.
 * `rock`: rounded stone with wide bumps, radius `r` (m), flattening `flat`, buried `bury` x height, bumps `bump`, snow on
 * what faces up between `snowFrom` and `snowTo` (y of the smoothed normal), snow thickness `cap` (x radius); `mate`: small
 * companion stones around the big ones (at most `count`, size `size` x radius, only if the rock radius is at least `minR`).
 */
export const LOOK = {
  pine: {
    h: [3.2, 5.6], R: [0.95, 1.5], tiers: 3, sides: 11, sidesFar: 6, near: 8,
    trunkH: 0.55, trunkR: 0.17, sink: 0.08, clearFrac: 0.72,
    step: 0.55, shrink: 0.27, wobble: 0.07, puff: 0.5,
  },
  rock: {
    r: [0.55, 1.0], flat: [0.62, 0.9], bury: 0.3, bump: 0.2, snowFrom: 0.15, snowTo: 0.5, cap: 0.07,
    mate: { count: 2, size: [0.3, 0.5], minR: 0.75 },
  },
};

// ---------------------------------------------------------------------------------- shared helpers

function smoothstep(a, b, x) {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
}

/** Deterministic random value in 0..1: the same arguments give the same value (no `Math.random`). */
function hash(a, b = 0, c = 0) {
  const s = Math.sin(a * 127.1 + b * 311.7 + c * 74.7) * 43758.5453;
  return s - Math.floor(s);
}

/** Value noise in 0..1, with no table or state: the same (x, z) gives the same snow. */
function valueNoise(x, z) {
  const ix = Math.floor(x), iz = Math.floor(z);
  const h = (i, j) => { const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return s - Math.floor(s); };
  const u = x - ix, w = z - iz, a = u * u * (3 - 2 * u), b = w * w * (3 - 2 * w);
  const h0 = h(ix, iz) + (h(ix + 1, iz) - h(ix, iz)) * a;
  const h1 = h(ix, iz + 1) + (h(ix + 1, iz + 1) - h(ix, iz + 1)) * a;
  return h0 + (h1 - h0) * b;
}

/** Zone colours, built once from `SNOW` (palette.js). */
let _pal = null;
function palette() {
  if (_pal) return _pal;
  _pal = {
    fresh: color(SNOW.fresh), cap: color(SNOW.cap), shade: color(SNOW.shade),
    path: color(SNOW.path), earth: color(SNOW.earth), rock: color(SNOW.rock),
    pineLow: color(SNOW.pineLow), pineMid: color(SNOW.pineMid), pineTop: color(SNOW.pineTop),
    trunkLow: color(SNOW.trunkLow), trunk: color(SNOW.trunk),
    stones: SNOW.stones.map((s) => color(s)), stoneShade: color(SNOW.stoneShade),
    tufts: SNOW.tufts.map((s) => color(s)), twig: color(SNOW.twig), dust: color(SNOW.dust),
    crest: color(SNOW.crest), lee: color(SNOW.lee), warm: color(SNOW.warm), pathLight: color(SNOW.pathLight),
  };
  return _pal;
}

// ---------------------------------------------------------------------------------- snowy ground

/** Inverse snow thickness (see GROUND_LOOK). */
function thinAt(x, z) {
  const { scale: s, weight: k } = GROUND_LOOK;
  return k[0] * valueNoise(x * s[0], z * s[0]) + k[1] * valueNoise(x * s[1] + 17, z * s[1] - 5) + k[2] * valueNoise(x * s[2] - 31, z * s[2] + 9);
}

/** Grid coordinates: `fine` cells in [f0, f1], growing by `grow` out to [lo, hi]. */
function axis(lo, hi, f0, f1, fine, grow) {
  const out = [];
  const n = Math.round((f1 - f0) / fine);
  for (let i = 0; i <= n; i++) out.push(f0 + i * fine);
  let x = f0, step = fine;
  while (x > lo) { step *= grow; x = Math.max(lo, x - step); out.unshift(x); }
  x = f1; step = fine;
  while (x < hi) { step *= grow; x = Math.min(hi, x + step); out.push(x); }
  return out;
}

/**
 * Snowy ground: vertices placed on `heightAt`, normals from the grid, per-vertex colour.
 * @param {object} MESH mesh bounds and resolution (MESH table of Mountain.js)
 * @returns {THREE.BufferGeometry} geometry, with its grid in `userData.grid`
 */
export function snowGeometry(MESH) {
  const xs = axis(MESH.x[0], MESH.x[1], MESH.fineX[0], MESH.fineX[1], MESH.fine, MESH.grow);
  const zs = axis(MESH.z[0], MESH.z[1], MESH.fineZ[0], MESH.fineZ[1], MESH.fine, MESH.grow);
  const nx = xs.length, nz = zs.length, N = nx * nz;
  const h = new Float32Array(N);
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) h[j * nx + i] = heightAt(xs[i], zs[j]);
  const pos = new Float32Array(N * 3), nrm = new Float32Array(N * 3), col = new Float32Array(N * 3);
  const P = palette(), M = GROUND_LOOK.marble;
  const c = new THREE.Color();
  for (let j = 0; j < nz; j++) {
    const z = zs[j], j0 = Math.max(0, j - 1), j1 = Math.min(nz - 1, j + 1);
    for (let i = 0; i < nx; i++) {
      const x = xs[i], i0 = Math.max(0, i - 1), i1 = Math.min(nx - 1, i + 1), v = j * nx + i, k = v * 3;
      const gx = (h[j * nx + i1] - h[j * nx + i0]) / (xs[i1] - xs[i0]);
      const gz = (h[j1 * nx + i] - h[j0 * nx + i]) / (zs[j1] - zs[j0]);
      const l = Math.hypot(gx, 1, gz);
      pos[k] = x; pos[k + 1] = h[v]; pos[k + 2] = z;
      nrm[k] = -gx / l; nrm[k + 1] = 1 / l; nrm[k + 2] = -gz / l;
      // Large shade patches and rock showing through: slow noise, no texture.
      const n = Math.sin(0.11 * x + 0.7) * Math.sin(0.13 * z + 1.9) + 0.5 * Math.sin(0.31 * x - 0.23 * z);
      c.copy(P.fresh).lerp(P.shade, GROUND_LOOK.shade * smoothstep(0.1, 0.9, -n));
      c.multiplyScalar(1 + GROUND_LOOK.tone * Math.sin(0.047 * x - 0.4) * Math.sin(0.061 * z + 1.1));
      const clear = pathClearance(x, z);
      const onPath = smoothstep(GROUND_LOOK.path[0], GROUND_LOOK.path[1], clear);
      c.lerp(P.path, onPath);
      // Slow marbling: warm patches (sun), lavender patches (shade), lighter packed snow.
      const m1 = M.weight[0] * valueNoise(x * M.scale[0] + 5, z * M.scale[0] - 3) + M.weight[1] * valueNoise(x * M.scale[1] - 9, z * M.scale[1] + 4);
      const m2 = M.weight[0] * valueNoise(x * M.scale[0] * 0.8 - 21, z * M.scale[0] * 0.8 + 8) + M.weight[1] * valueNoise(x * M.scale[1] + 13, z * M.scale[1] - 17);
      c.lerp(P.warm, smoothstep(M.lo, M.hi, m1) * M.warm * (1 - (1 - M.onPath) * onPath));
      c.lerp(P.shade, smoothstep(M.lo, M.hi, m2) * M.cool * (1 - (1 - M.onPath) * onPath));
      c.lerp(P.pathLight, onPath * M.packed * smoothstep(M.lo - 0.05, M.hi, valueNoise(x * 0.35 + 40, z * 0.35 - 12)));
      const thin = thinAt(x, z) + GROUND_LOOK.steep * (1 - nrm[k + 1]);
      const off = smoothstep(0, GROUND_LOOK.rockClear, clear);
      c.lerp(P.earth, smoothstep(GROUND_LOOK.earth[0], GROUND_LOOK.earth[1], thin) * (GROUND_LOOK.pathEarth + (1 - GROUND_LOOK.pathEarth) * off));
      c.lerp(P.rock, smoothstep(GROUND_LOOK.rock, GROUND_LOOK.rock + GROUND_LOOK.rockBand, thin) * off);
      col[k] = c.r * GROUND_LOOK.lift; col[k + 1] = c.g * GROUND_LOOK.lift; col[k + 2] = c.b * GROUND_LOOK.lift;
    }
  }
  const idx = new Uint32Array((nx - 1) * (nz - 1) * 6);
  let t = 0;
  for (let j = 0; j < nz - 1; j++) {
    for (let i = 0; i < nx - 1; i++) {
      const a = j * nx + i, b = a + 1, cc = a + nx, d = cc + 1;
      idx[t++] = a; idx[t++] = cc; idx[t++] = b;
      idx[t++] = b; idx[t++] = cc; idx[t++] = d;
    }
  }
  const g = new THREE.BufferGeometry();
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeBoundingSphere();
  g.computeBoundingBox();
  g.userData.grid = { xs, zs };
  return g;
}

/** First index of the sorted list `a` whose value reaches `v`. */
function lowerBound(a, v) {
  let lo = 0, hi = a.length;
  while (lo < hi) { const m = (lo + hi) >> 1; if (a[m] < v) lo = m + 1; else hi = m; }
  return lo;
}

/**
 * Bare ground at the foot of the scenery (`GROUND_LOOK.around`): one pass, after placement. `items`: { x, z, fr }.
 * Outside the corridor only, so the path stays readable. Colours only.
 */
export function thinAround(g, items) {
  const { xs, zs } = g.userData.grid, nx = xs.length, col = g.attributes.color.array, A = GROUND_LOOK.around;
  const e = palette().dust.clone().multiplyScalar(GROUND_LOOK.lift);
  for (const o of items) {
    const R = o.fr + A.reach;
    const i1 = lowerBound(xs, o.x + R), j1 = lowerBound(zs, o.z + R);
    for (let j = lowerBound(zs, o.z - R); j < j1; j++) {
      for (let i = lowerBound(xs, o.x - R); i < i1; i++) {
        const d = Math.hypot(xs[i] - o.x, zs[j] - o.z);
        if (d >= R) continue;
        const a = A.amount * (1 - smoothstep(o.fr, R, d)) * smoothstep(0, 0.4, pathClearance(xs[i], zs[j]));
        if (a <= 0) continue;
        const k = (j * nx + i) * 3;
        col[k] += (e.r - col[k]) * a; col[k + 1] += (e.g - col[k + 1]) * a; col[k + 2] += (e.b - col[k + 2]) * a;
      }
    }
  }
}

// ---------------------------------------------------------------------------------- scenery buffers

/** Buffers of a scenery chunk: unindexed triangles, per-vertex colour and normal. */
export function newChunk() { return { pos: [], nrm: [], col: [], items: 0 }; }

/** Vertex: [x, y, z, nx, ny, nz, r, g, b]. */
function V(x, y, z, nx, ny, nz, c) {
  const l = Math.hypot(nx, ny, nz) || 1;
  return [x, y, z, nx / l, ny / l, nz / l, c.r, c.g, c.b];
}

/** Triangle whose winding is corrected so the face looks toward the normals (single-sided material). */
function tri(ch, a, b, c) {
  const ex = b[0] - a[0], ey = b[1] - a[1], ez = b[2] - a[2], fx = c[0] - a[0], fy = c[1] - a[1], fz = c[2] - a[2];
  const cx = ey * fz - ez * fy, cy = ez * fx - ex * fz, cz = ex * fy - ey * fx;
  const facing = cx * (a[3] + b[3] + c[3]) + cy * (a[4] + b[4] + c[4]) + cz * (a[5] + b[5] + c[5]);
  const t = facing >= 0 ? [a, b, c] : [a, c, b];
  for (const v of t) { ch.pos.push(v[0], v[1], v[2]); ch.nrm.push(v[3], v[4], v[5]); ch.col.push(v[6], v[7], v[8]); }
}

const _c1 = new THREE.Color();

// ---------------------------------------------------------------------------------- pine

/**
 * Profile of a tier (rounded bell): [radius / R, height / H, radial normal, y normal, snow 0-1, tint 0-1, snow-edge dip].
 * From top to bottom: rounded tip, shoulder, flank, start of the rim, round rim (the widest), underside. Normals are
 * inflated (the rim faces sideways, not down) so the tier shades like a soft ball. Snow covers the top and ends in
 * irregular lobes on the flank (the last snow row moves by `dip` per face); tint goes from `pineTop` (0) to `pineMid` (0.5)
 * then `pineLow` (1).
 */
const TIER = [
  [0.0, 1.0, 0.0, 1.0, 1.0, 0.0, 0],
  [0.4, 0.85, 0.5, 0.87, 1.0, 0.0, 0],
  [0.8, 0.5, 0.8, 0.6, 1.0, 0.1, 0],
  [0.92, 0.4, 0.92, 0.38, 0.0, 0.35, 0.14],
  [1.0, 0.16, 0.97, 0.26, 0.0, 0.6, 0],
  [0.9, 0.0, 0.72, -0.69, 0.0, 1.0, 0],
];
/** Far version: without the shoulder or the start of the rim. */
const TIER_FAR = [TIER[0], TIER[2], TIER[4], TIER[5]];

/** Pine: flared trunk and `tiers` rounded bell tiers, snow on top, green rim. Merged. */
export function addPine(ch, p) {
  const L = LOOK.pine, P = palette(), near = (p.clear ?? 0) < L.near;
  const S = near ? L.sides : L.sidesFar, dA = (Math.PI * 2) / S, prof = near ? TIER : TIER_FAR;
  const y0 = p.ground - L.sink;
  const seed = p.x * 0.731 + p.z * 1.379;

  // Trunk: short, flared at the foot, mostly hidden by the first tier.
  const TS = near ? 6 : 4, th = L.trunkH + 0.45;
  const rings = [[0, L.trunkR * 1.5], [0.22, L.trunkR * 1.05], [1, L.trunkR * 0.75]];
  const trunk = rings.map(([f, r]) => {
    const row = [];
    _c1.copy(P.trunkLow).lerp(P.trunk, smoothstep(0, 0.9, f));
    for (let s = 0; s < TS; s++) {
      const a = p.a + (s / TS) * Math.PI * 2, cs = Math.cos(a), sn = Math.sin(a);
      row.push(V(p.x + cs * r, y0 + th * f, p.z + sn * r, cs, 0.15, sn, _c1));
    }
    return row;
  });
  for (let k = 0; k + 1 < trunk.length; k++) {
    for (let s = 0; s < TS; s++) {
      const a = trunk[k][s], b = trunk[k][(s + 1) % TS], c = trunk[k + 1][s], d = trunk[k + 1][(s + 1) % TS];
      tri(ch, a, c, b); tri(ch, b, c, d);
    }
  }

  // Tiers: the lowest is the widest; each overlaps the next a little.
  const crown = p.h - L.trunkH, n = L.tiers;
  const tierH = crown / (1 + (n - 1) * L.step);
  for (let t = 0; t < n; t++) {
    const yB = y0 + L.trunkH + t * tierH * L.step;
    const rB = p.R * (1 - t * L.shrink);
    const rot = p.a + t * 0.9, ox = Math.cos(rot + 1.3) * rB * 0.06 * t, oz = Math.sin(rot + 1.3) * rB * 0.06 * t;
    const cx = p.x + ox, cz = p.z + oz;
    const rows = prof.map(([rf, yf, nr, ny, snow, tone, dip], k) => {
      const m = rf === 0 ? 1 : S;
      const out = [];
      for (let s = 0; s < m; s++) {
        const a = rot + s * dA, cs = Math.cos(a), sn = Math.sin(a);
        const hv = hash(seed + t * 3.1, s + k * 17.3, 1);
        const r = rB * rf * (1 + L.wobble * (hv - 0.5) * 2 * (rf > 0.3 ? 1 : 0));
        // Snow: irregular, lobed edge that drops more or less depending on the face.
        if (tone < 0.5) _c1.copy(P.pineTop).lerp(P.pineMid, tone * 2); else _c1.copy(P.pineMid).lerp(P.pineLow, (tone - 0.5) * 2);
        _c1.lerp(P.cap, snow);
        out.push(V(cx + cs * r, yB + tierH * (yf - dip * hash(seed + t, s * 2.9, k + 5)), cz + sn * r, cs * nr, ny, sn * nr, _c1));
      }
      return out;
    });
    // Fan at the top, strips between rows, fan underneath.
    for (let s = 0; s < S; s++) tri(ch, rows[0][0], rows[1][(s + 1) % S], rows[1][s]);
    for (let k = 1; k + 1 < rows.length; k++) {
      for (let s = 0; s < S; s++) {
        const a = rows[k][s], b = rows[k][(s + 1) % S], c = rows[k + 1][s], d = rows[k + 1][(s + 1) % S];
        tri(ch, a, c, b); tri(ch, b, c, d);
      }
    }
    if (near) {
      const under = V(cx, yB + tierH * 0.06, cz, 0, -1, 0, P.pineLow);
      const last = rows[rows.length - 1];
      for (let s = 0; s < S; s++) tri(ch, last[s], last[(s + 1) % S], under);
    }
  }

  // A little packed snow at the foot, so the trunk does not rise out of a hole.
  if (near) stoneInto(ch, p.x, y0 + 0.02, p.z, 0.55, 0.16, 0.55, p.a, seed, P, 0, true);
  ch.items++;
}

// ---------------------------------------------------------------------------------- stones

let _tpl = null;
/** Indexed unit icosahedron (merged vertices): `detail` 0 = 12 vertices / 20 faces, 1 = 42 / 80. */
function stoneTemplate(detail) {
  if (!_tpl) {
    _tpl = {};
    for (const d of [0, 1]) {
      let g = new THREE.IcosahedronGeometry(1, d);
      g.deleteAttribute('normal');
      g.deleteAttribute('uv');
      g = mergeVertices(g);
      _tpl[d] = { pos: Array.from(g.attributes.position.array), idx: Array.from(g.index.array) };
      g.dispose();
    }
  }
  return _tpl[detail];
}

/**
 * Rounded stone: icosahedron with wide bumps, smoothed normals (average of neighbouring faces), tint of the ruins family
 * (`SNOW.stones`), mauve shade underneath, domed cream snow on top. `snowOnly`: a plain snow block (heap at the foot of pines).
 */
function stoneInto(ch, x, y, z, rx, ry, rz, a, seed, P, detail = 1, snowOnly = false) {
  const R = LOOK.rock, T = stoneTemplate(detail), n = T.pos.length / 3;
  const cs = Math.cos(a), sn = Math.sin(a);
  const s1 = seed * 1.7, s2 = seed * 2.3, s3 = seed * 0.9, s4 = seed * 1.3;
  const P3 = new Float32Array(n * 3), N3 = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const ux = T.pos[i * 3], uy0 = T.pos[i * 3 + 1], uz = T.pos[i * 3 + 2];
    const uy = uy0 < -0.2 ? -0.2 + (uy0 + 0.2) * 0.5 : uy0; // flattened underside: it is buried
    // Wide bumps from the direction alone: a vertex stays in the same place in all of its faces.
    const k = 1 + R.bump * (0.6 * Math.sin(2.3 * ux + s1) * Math.sin(1.9 * uy0 + s2) + 0.4 * Math.sin(3.7 * uz + s3) * Math.sin(2.9 * ux + s4));
    const lx = ux * k * rx, ly = uy * k * ry, lz = uz * k * rz;
    P3[i * 3] = x + lx * cs + lz * sn; P3[i * 3 + 1] = y + ly; P3[i * 3 + 2] = z - lx * sn + lz * cs;
  }
  for (let f = 0; f < T.idx.length; f += 3) {
    const i0 = T.idx[f], i1 = T.idx[f + 1], i2 = T.idx[f + 2];
    const ax = P3[i1 * 3] - P3[i0 * 3], ay = P3[i1 * 3 + 1] - P3[i0 * 3 + 1], az = P3[i1 * 3 + 2] - P3[i0 * 3 + 2];
    const bx = P3[i2 * 3] - P3[i0 * 3], by = P3[i2 * 3 + 1] - P3[i0 * 3 + 1], bz = P3[i2 * 3 + 2] - P3[i0 * 3 + 2];
    const fx = ay * bz - az * by, fy = az * bx - ax * bz, fz = ax * by - ay * bx;
    for (const i of [i0, i1, i2]) { N3[i * 3] += fx; N3[i * 3 + 1] += fy; N3[i * 3 + 2] += fz; }
  }
  const base = snowOnly ? P.cap : P.stones[Math.min(P.stones.length - 1, Math.floor(hash(seed, 5.1) ** 1.6 * P.stones.length))];
  const verts = [];
  for (let i = 0; i < n; i++) {
    const l = Math.hypot(N3[i * 3], N3[i * 3 + 1], N3[i * 3 + 2]) || 1;
    const nx = N3[i * 3] / l, ny = N3[i * 3 + 1] / l, nz = N3[i * 3 + 2] / l;
    // Normal direction: away from the stone (its centre is under (x, y)).
    const dx = P3[i * 3] - x, dy = P3[i * 3 + 1] - y, dz = P3[i * 3 + 2] - z;
    const sgn = nx * dx + ny * dy + nz * dz >= 0 ? 1 : -1;
    const Nx = nx * sgn, Ny = ny * sgn, Nz = nz * sgn;
    _c1.copy(base);
    if (!snowOnly) _c1.lerp(P.stoneShade, 0.42 * (1 - smoothstep(-0.25, 0.55, Ny)));
    _c1.multiplyScalar(1 + (hash(seed, i * 1.3) - 0.5) * 0.06);
    const w = smoothstep(R.snowFrom, R.snowTo, Ny);
    _c1.lerp(P.cap, snowOnly ? 1 : w);
    // Domed snow: the top swells slightly, like a cushion laid on the stone.
    const puff = snowOnly ? 0 : R.cap * Math.min(rx, rz) * w;
    verts.push(V(P3[i * 3] + Nx * puff, P3[i * 3 + 1] + Ny * puff, P3[i * 3 + 2] + Nz * puff, Nx, Ny, Nz, _c1));
  }
  for (let f = 0; f < T.idx.length; f += 3) tri(ch, verts[T.idx[f]], verts[T.idx[f + 1]], verts[T.idx[f + 2]]);
}

/** Rock: rounded stone, some snow on top and at most `mate.count` small stones at its foot. */
export function addRock(ch, p) {
  const R = LOOK.rock, P = palette();
  const seed = p.x * 0.917 + p.z * 1.213 + p.a;
  const wide = 1 + 0.15 * (hash(seed, 2.2) - 0.5) * 2;
  stoneInto(ch, p.x, p.y, p.z, p.r * wide, p.r * p.flat, p.r * 0.9, p.a, seed, P, 1);
  if ((p.clear ?? 0) < LOOK.pine.near && p.r >= R.mate.minR) {
    for (let m = 0; m < R.mate.count; m++) {
      const ang = p.a * 3 + m * 2.4 + hash(seed, m) * 1.5, size = p.r * (R.mate.size[0] + (R.mate.size[1] - R.mate.size[0]) * hash(seed, m + 9));
      const mx = p.x + Math.cos(ang) * p.r * (0.95 + 0.3 * m), mz = p.z + Math.sin(ang) * p.r * (0.95 + 0.3 * m);
      if (pathClearance(mx, mz) < size + 0.4) continue;
      const my = heightAt(mx, mz) + size * 0.5 * 0.3;
      stoneInto(ch, mx, my, mz, size * 1.1, size * 0.7, size, ang, seed + m * 3.3, P, 0);
    }
  }
  ch.items++;
}

export function chunkMesh(ch, material, name) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(ch.pos), 3));
  g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(ch.nrm), 3));
  g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(ch.col), 3));
  g.computeBoundingSphere();
  g.computeBoundingBox();
  const m = new THREE.Mesh(g, material);
  m.name = name;
  m.castShadow = true;
  m.receiveShadow = true;
  m.matrixAutoUpdate = false;
  m.updateMatrix();
  return m;
}

// ---------------------------------------------------------------------------------- ground dressing

/** True on the rampart side (-X): nothing is placed there (DETAIL.minX, DETAIL.wallZ). */
function behindWall(x, z) { return x < ZONE2.x + DETAIL.minX && Math.abs(z) <= DETAIL.wallZ; }

/** Shape of a drift at (x, z), from 0 to 1 + `DRIFT.ripple`, before scaling by `amp` and fading. */
function driftShape(x, z) {
  const D = DRIFT, c = Math.cos(D.rotate), s = Math.sin(D.rotate);
  const u = x * c + z * s, v = -x * s + z * c;
  const big = smoothstep(D.lo, D.hi, valueNoise(u * D.scale[0] + 3, v * D.scale[1] - 7));
  const fine = valueNoise(u * D.rippleScale[0] + 11, v * D.rippleScale[1] + 5);
  return big * (1 - D.ripple + D.ripple * 2 * fine);
}

/** Recomputes the mesh normals from its heights (same formula as `snowGeometry`). */
function renormalise(g) {
  const { xs, zs } = g.userData.grid, nx = xs.length, nz = zs.length;
  const pos = g.attributes.position.array, nrm = g.attributes.normal.array;
  for (let j = 0; j < nz; j++) {
    const j0 = Math.max(0, j - 1), j1 = Math.min(nz - 1, j + 1);
    for (let i = 0; i < nx; i++) {
      const i0 = Math.max(0, i - 1), i1 = Math.min(nx - 1, i + 1), k = (j * nx + i) * 3;
      const gx = (pos[(j * nx + i1) * 3 + 1] - pos[(j * nx + i0) * 3 + 1]) / (xs[i1] - xs[i0]);
      const gz = (pos[(j1 * nx + i) * 3 + 1] - pos[(j0 * nx + i) * 3 + 1]) / (zs[j1] - zs[j0]);
      const l = Math.hypot(gx, 1, gz);
      nrm[k] = -gx / l; nrm[k + 1] = 1 / l; nrm[k + 2] = -gz / l;
    }
  }
}

/** Mesh height (drifts included) at (x, z): bilinear interpolation of the grid. */
function meshHeight(g, x, z) {
  const { xs, zs } = g.userData.grid, nx = xs.length, pos = g.attributes.position.array;
  const i = Math.min(Math.max(lowerBound(xs, x) - 1, 0), xs.length - 2), j = Math.min(Math.max(lowerBound(zs, z) - 1, 0), zs.length - 2);
  const u = Math.min(Math.max((x - xs[i]) / (xs[i + 1] - xs[i]), 0), 1), w = Math.min(Math.max((z - zs[j]) / (zs[j + 1] - zs[j]), 0), 1);
  const h = (a, b) => pos[(b * nx + a) * 3 + 1];
  return (h(i, j) * (1 - u) + h(i + 1, j) * u) * (1 - w) + (h(i, j + 1) * (1 - u) + h(i + 1, j + 1) * u) * w;
}

/** Drifts: raises the mesh by at most `amp` and shades the lee side. Outside the corridor and away from the scenery feet. */
function addDrifts(g, placed) {
  const D = DRIFT, P = palette(), { xs, zs } = g.userData.grid, nx = xs.length, nz = zs.length;
  const pos = g.attributes.position.array, col = g.attributes.color.array;
  const fade = new Float32Array(nx * nz).fill(1);
  // Fade around the scenery: edge radius + `around`, stronger near it.
  for (const o of placed) {
    const R = o.fr + D.around;
    const i1 = lowerBound(xs, o.x + R), j1 = lowerBound(zs, o.z + R);
    for (let j = lowerBound(zs, o.z - R); j < j1; j++) {
      for (let i = lowerBound(xs, o.x - R); i < i1; i++) {
        const d = Math.hypot(xs[i] - o.x, zs[j] - o.z);
        if (d >= R) continue;
        const f = smoothstep(o.fr * 0.6, R, d), v = j * nx + i;
        if (f < fade[v]) fade[v] = f;
      }
    }
  }
  const height = new Float32Array(nx * nz), ground = new Float32Array(nx * nz);
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const v = j * nx + i, clear = pathClearance(xs[i], zs[j]);
      const f = smoothstep(D.start, D.full, clear) * (1 - smoothstep(D.farFrom, D.farTo, clear)) * fade[v] * (behindWall(xs[i], zs[j]) ? 0 : 1);
      const d = f > 0 ? driftShape(xs[i], zs[j]) * D.amp * f : 0;
      ground[v] = pos[v * 3 + 1];
      height[v] = d;
    }
  }
  const sx = Math.cos(0.6), sz = Math.sin(0.6); // flat sun direction (LIGHT.sun.offset: +x, +z)
  const tmp = new THREE.Color();
  for (let j = 0; j < nz; j++) {
    const j0 = Math.max(0, j - 1), j1 = Math.min(nz - 1, j + 1);
    for (let i = 0; i < nx; i++) {
      const v = j * nx + i, d = height[v];
      if (d <= 0) continue;
      pos[v * 3 + 1] = ground[v] + d;
      // Drift slope toward the sun: positive on the sun side, negative in the shade.
      const i0 = Math.max(0, i - 1), i1 = Math.min(nx - 1, i + 1);
      const gx = (height[j * nx + i1] - height[j * nx + i0]) / (xs[i1] - xs[i0]);
      const gz = (height[j1 * nx + i] - height[j0 * nx + i]) / (zs[j1] - zs[j0]);
      const toSun = -(gx * sx + gz * sz);
      const k = v * 3;
      const crest = smoothstep(0.35, 0.95, d / D.amp) * D.crestMix * smoothstep(-0.05, 0.1, toSun);
      const lee = smoothstep(0.02, 0.22, -toSun) * D.leeMix * smoothstep(0.1, 0.5, d / D.amp);
      tmp.setRGB(col[k], col[k + 1], col[k + 2]);
      tmp.lerp(_c1.copy(P.crest).multiplyScalar(GROUND_LOOK.lift), crest);
      tmp.lerp(_c1.copy(P.lee).multiplyScalar(GROUND_LOOK.lift), lee);
      col[k] = tmp.r; col[k + 1] = tmp.g; col[k + 2] = tmp.b;
    }
  }
  renormalise(g);
  g.computeBoundingSphere();
  g.computeBoundingBox();
}

/** Grass tuft poking out of the snow: a few round curved blades, light foot (snow) to pastel tip. */
function addTuft(ch, x, y, z, rand, P) {
  const T = DETAIL.tufts, blades = T.blades[0] + Math.floor(rand() * (T.blades[1] - T.blades[0] + 1));
  const tip = P.tufts[Math.floor(rand() * P.tufts.length)], a0 = rand() * Math.PI * 2;
  for (let b = 0; b < blades; b++) {
    const a = a0 + (b / blades) * Math.PI * 2 + (rand() - 0.5) * 0.7, cs = Math.cos(a), sn = Math.sin(a);
    const h = T.h[0] + (T.h[1] - T.h[0]) * rand(), lean = h * (0.3 + 0.35 * rand()), w = T.w * (0.8 + 0.4 * rand());
    const px = -sn, pz = cs;
    const bx = x + cs * 0.03, bz = z + sn * 0.03;
    const mid = [bx + cs * lean * 0.45, y + h * 0.6, bz + sn * lean * 0.45], top = [bx + cs * lean, y + h, bz + sn * lean];
    const nB = [cs * 0.5, 0.85, sn * 0.5];
    _c1.copy(P.cap).lerp(tip, 0.45);
    const base = [V(bx - px * w, y - 0.03, bz - pz * w, nB[0], nB[1], nB[2], _c1), V(bx + px * w, y - 0.03, bz + pz * w, nB[0], nB[1], nB[2], _c1)];
    _c1.copy(tip);
    const m = [V(mid[0] - px * w * 0.7, mid[1], mid[2] - pz * w * 0.7, nB[0], nB[1], nB[2], _c1), V(mid[0] + px * w * 0.7, mid[1], mid[2] + pz * w * 0.7, nB[0], nB[1], nB[2], _c1)];
    _c1.copy(tip).lerp(P.cap, 0.25);
    const t = V(top[0], top[1], top[2], nB[0], nB[1], nB[2], _c1);
    // Two faces: the scenery material draws only one.
    for (const flip of [1, -1]) {
      const f = (v) => (flip === 1 ? v : [v[0], v[1], v[2], -v[3], -v[4], -v[5], v[6], v[7], v[8]]);
      const tr = (u, v, w2) => { const A = f(u), B = f(v), C = f(w2); tri(ch, A, B, C); };
      tr(base[0], base[1], m[1]); tr(base[0], m[1], m[0]); tr(m[0], m[1], t);
    }
  }
  ch.items++;
}

/** Twig coming out of the snow: a thin tilted stick, soft brown, with a fork. */
function addTwig(ch, x, y, z, rand, P) {
  const T = DETAIL.twigs, len = T.len[0] + (T.len[1] - T.len[0]) * rand(), a = rand() * Math.PI * 2;
  const tilt = 0.9 + 0.4 * rand(); // rad from vertical
  const dir = [Math.cos(a) * Math.sin(tilt), Math.cos(tilt), Math.sin(a) * Math.sin(tilt)];
  const stick = (ox, oy, oz, d, l, r) => {
    // Orthonormal basis (s1, u) of the plane perpendicular to direction d.
    const sl = Math.hypot(d[0], d[2]) || 1, s1 = [-d[2] / sl, 0, d[0] / sl];
    const u = [d[1] * s1[2], d[2] * s1[0] - d[0] * s1[2], -d[1] * s1[0]], ul = Math.hypot(u[0], u[1], u[2]) || 1;
    const ring = (cx, cy, cz, rr, c) => [0, 1, 2].map((k) => {
      const ang = (k / 3) * Math.PI * 2, ca = Math.cos(ang), sa = Math.sin(ang);
      const nx = s1[0] * ca + (u[0] / ul) * sa, ny = s1[1] * ca + (u[1] / ul) * sa, nz = s1[2] * ca + (u[2] / ul) * sa;
      return V(cx + nx * rr, cy + ny * rr, cz + nz * rr, nx, ny, nz, c);
    });
    _c1.copy(P.twig).lerp(P.cap, 0.15);
    const lo = ring(ox, oy, oz, r, _c1);
    _c1.copy(P.twig).lerp(P.stoneShade, 0.2);
    const hi = ring(ox + d[0] * l, oy + d[1] * l, oz + d[2] * l, r * 0.45, _c1);
    for (let k = 0; k < 3; k++) { const k2 = (k + 1) % 3; tri(ch, lo[k], hi[k], lo[k2]); tri(ch, lo[k2], hi[k], hi[k2]); }
  };
  stick(x, y - 0.05, z, dir, len, T.r);
  const d2 = [dir[0] * 0.6 + Math.cos(a + 1.2) * 0.5, dir[1] * 0.7 + 0.2, dir[2] * 0.6 + Math.sin(a + 1.2) * 0.5];
  const l2 = Math.hypot(d2[0], d2[1], d2[2]);
  stick(x + dir[0] * len * 0.55, y - 0.05 + dir[1] * len * 0.55, z + dir[2] * len * 0.55, [d2[0] / l2, d2[1] / l2, d2[2] / l2], len * 0.4, T.r * 0.6);
  ch.items++;
}

/**
 * Dresses the ground after the scenery is placed: drifts, then small details (tufts, pebbles, twigs) merged into one mesh.
 * @param {object} mountain the zone (`group`, `meshes`, `geometry`, `decorMaterial`)
 * @param {object[]} placed scenery placed by Mountain._buildDecor
 */
export function dressSnow(mountain, placed) {
  const g = mountain.geometry, P = palette(), D = DETAIL, rand = rng(D.seed);
  addDrifts(g, placed);

  const ch = newChunk();
  const free = (x, z, r) => {
    for (const o of placed) if (Math.hypot(o.x - x, o.z - z) < o.fr + r + 0.15) return false;
    return true;
  };
  const { xs, zs } = g.userData.grid;
  const x0 = xs[0] + 1, x1 = xs[xs.length - 1] - 1, z0 = zs[0] + 1, z1 = zs[zs.length - 1] - 1;
  // Trial area: near the path only; draws beyond `reach` are quickly rejected.
  const spot = () => {
    const x = x0 + (x1 - x0) * rand(), z = z0 + (z1 - z0) * rand();
    if (behindWall(x, z)) return null;
    const clear = pathClearance(x, z);
    if (clear < D.minClear || clear > D.reach || rand() > Math.exp(-(clear - D.minClear) / D.falloff)) return null;
    return { x, z, y: meshHeight(g, x, z) };
  };
  const MAX_TRIES = 40000; // safety limit: never an endless loop if the zone changes shape
  let tufts = 0;
  for (let i = 0; i < MAX_TRIES && tufts < D.tufts.count; i++) {
    const s = spot(); if (!s || !free(s.x, s.z, 0.1)) continue;
    addTuft(ch, s.x, s.y, s.z, rand, P);
    tufts++;
  }
  let pebbles = 0;
  for (let i = 0; i < MAX_TRIES && pebbles < D.pebbles.count; i++) {
    const s = spot(); if (!s || !free(s.x, s.z, 0.3)) continue;
    const n = D.pebbles.per[0] + Math.floor(rand() * (D.pebbles.per[1] - D.pebbles.per[0] + 1));
    for (let k = 0; k < n; k++) {
      const r = D.pebbles.r[0] + (D.pebbles.r[1] - D.pebbles.r[0]) * rand(), a = rand() * Math.PI * 2, d = 0.1 + rand() * 0.35;
      const px = s.x + Math.cos(a) * d, pz = s.z + Math.sin(a) * d;
      stoneInto(ch, px, meshHeight(g, px, pz) + r * 0.1, pz, r * 1.2, r * 0.7, r, a, i * 3.7 + k, P, 0);
    }
    pebbles++; ch.items++;
  }
  let twigs = 0;
  for (let i = 0; i < MAX_TRIES && twigs < D.twigs.count; i++) {
    const s = spot(); if (!s || !free(s.x, s.z, 0.2)) continue;
    addTwig(ch, s.x, s.y, s.z, rand, P);
    twigs++;
  }
  const m = chunkMesh(ch, mountain.decorMaterial, 'Details');
  m.castShadow = false;
  mountain.group.add(m);
  mountain.meshes.push(m);
  mountain.detailCount = ch.items;
}
