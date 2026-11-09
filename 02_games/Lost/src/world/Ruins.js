/**
 * Meadow ruins: a small ruined church facing the starting point and four wall sections. Two low walls (0.42 m) can be
 * walked on; two high walls are climbed by a chain of rubble steps, and one of them has an arch the cat can pass through.
 * The four side windows of the church can be crossed (`crossable`); the other openings are obstacles. Created by
 * World.js; Brain.js reads its obstacles and surfaces through World.js, and Picker.js uses its click targets.
 *
 * Stones are chamfered boxes (24 vertices, 44 triangles) with pillow normals for soft toon shading, recessed joints
 * instead of mortar, stepped tops, moss on top, fallen stones and round boulders at the foot. No inverted-hull outline:
 * pillow normals are not shared between faces, so a hull would split at the edges; the joints act as the outline.
 * Each wall (with its steps and fallen stones), the roof and each boulder is one merged mesh with its own material, so
 * only the piece hiding the cat fades out. An invisible mesh (`pickables`) carries the walkable tops for clicks.
 *
 * Each stone of an isolated wall rests on the lowest `heightAt` across the wall thickness, minus SINK, so the wall
 * follows the ground. The church is level, on the lowest `heightAt` of its footprint minus SINK.
 */

import * as THREE from 'three';
import { STONE, MOSS, color, jitter, toonMaterial } from '../style/palette.js';
import { heightAt as terrainHeightAt } from './Terrain.js';
import { rng } from './random.js';

export const SINK = 0.08;          // m: stones are buried SINK below the lowest ground
export const LOW_WALL_TOP = 0.42;  // m: height of the low walls above their local base (+SINK buried)
const VD = 0.2;                    // m: radial depth of the arch voussoirs

// ------------------------------------------------------------------ layout (metres, world space)

/**
 * Church: centre and dimensions (m), oriented so that the facade (door) faces the origin. Placed 12.5 m away, slightly
 * left of the starting camera axis and behind the cat, so it never hides it.
 */
export const CHURCH = { x: -3.65, z: -11.95, width: 4.6, length: 7.6, thick: 0.5, eave: 2.9, apex: 4.7, belfry: 6.0 };

/**
 * Isolated wall sections: endpoints p0 -> p1 (x, z), thickness, height (function of the position s along the wall),
 * `climbable` = low walkable wall. Openings: { c (centre position along the wall), w, sill, spring,
 * kind: 'pointed' | 'round' | 'circle', passable }. All in metres.
 */
export const WALLS = [
  { name: 'low_wall_east', climbable: true, p0: [-1.15, -4.55], p1: [1.95, -4.2], thick: 0.46, seed: 21 },
  { name: 'low_wall_west', climbable: true, p0: [-4.45, 0.05], p1: [-5.3, -2.6], thick: 0.46, seed: 37 },
  {
    name: 'high_wall_south_east', climbable: false, p0: [3.0, -7.2], p1: [6.1, -8.9], thick: 0.48, seed: 53,
    top: (s) => (s < 0.7 ? 1.35 : s < 1.5 ? 1.95 : s < 2.3 ? 1.7 : s < 2.9 ? 1.25 : 0.95),
    openings: [{ c: 1.6, w: 0.6, sill: 0.85, spring: 1.35, kind: 'pointed' }],
    perch: [2.9, 99], climbSide: 1,
  },
  {
    name: 'arch_wall_north_west', climbable: false, p0: [-8.6, 2.2], p1: [-5.4, 5.3], thick: 0.5, seed: 71,
    top: (s) => (s < 0.5 ? 1.5 : s < 1.1 ? 2.0 : s < 3.4 ? 2.25 : s < 4.0 ? 1.7 : 1.1),
    openings: [{ c: 2.2, w: 1.0, sill: 0, spring: 0.95, kind: 'round', passable: true }],
    // The low end (s > 4.2 m, about 1.13 m high) is only 0.26 m long, so the walkable top uses the next step up
    // (about 1.56 m above the ground, s from 3.66 to 4.12 m).
    perch: [3.66, 4.12], climbSide: -1,
  },
];

/**
 * Stepped rubble. At the foot of each high wall with a `perch` (walkable top), a chain of round-stone steps climbs from
 * the ground to that top on side `climbSide` (+1: wall normal side, -1: opposite side; chosen toward the origin, so it
 * shows from the start). Each jump is at most STEP_RISE_MAX, about the height of the low walls (LOW_WALL_TOP, 0.42 m)
 * that the `Jump` and `JumpDown` clips already clear (Brain.js).
 */
export const STEP_RISE_MAX = 0.4;   // m: maximum rise of a jump (ground to step, step to step, step to top)
const STEP = { hx: 0.3, hz: 0.26, gap: 0.03, slab: 0.1 }; // half-sizes of a step's plate, gap between steps, half-thickness of the slab (m)

// ------------------------------------------------------------------ chamfered stone

/** Topology of a chamfered box: 24 vertices (8 corners x 3 faces), 44 triangles. */
const BOX = (() => {
  const corners = [];
  for (let i = 0; i < 8; i++) corners.push([(i & 1) ? 1 : -1, (i & 2) ? 1 : -1, (i & 4) ? 1 : -1]);
  const vid = (c, k) => c * 3 + k;
  const tris = [];
  const quad = (a, b, cc, d) => { tris.push([a, b, cc], [a, cc, d]); };
  const cornerOf = (sx, sy, sz) => corners.findIndex((s) => s[0] === sx && s[1] === sy && s[2] === sz);
  // Faces: the 4 corners with sign s on axis k, walked in a cycle in the plane of the two other axes.
  for (let k = 0; k < 3; k++) {
    const i = (k + 1) % 3, j = (k + 2) % 3;
    for (const s of [-1, 1]) {
      const ring = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => {
        const sg = [0, 0, 0]; sg[k] = s; sg[i] = a; sg[j] = b;
        return vid(cornerOf(...sg), k);
      });
      quad(...ring);
    }
  }
  // Edges: between face (i, si) and face (j, sj), along axis k.
  for (let k = 0; k < 3; k++) {
    const i = (k + 1) % 3, j = (k + 2) % 3;
    for (const si of [-1, 1]) for (const sj of [-1, 1]) {
      const sg0 = [0, 0, 0], sg1 = [0, 0, 0];
      sg0[i] = sg1[i] = si; sg0[j] = sg1[j] = sj; sg0[k] = -1; sg1[k] = 1;
      const c0 = cornerOf(...sg0), c1 = cornerOf(...sg1);
      quad(vid(c0, i), vid(c1, i), vid(c1, j), vid(c0, j));
    }
  }
  // Corners.
  for (let c = 0; c < 8; c++) tris.push([vid(c, 0), vid(c, 1), vid(c, 2)]);
  // Winding: outward normal (convex centred box: dot product with the triangle centre).
  const P = [];
  for (let c = 0; c < 8; c++) for (let k = 0; k < 3; k++) {
    const p = corners[c].map((s, a) => s * (a === k ? 1 : 0.7));
    P.push(p);
  }
  const out = [];
  for (const t of tris) {
    const [a, b, cc] = t.map((v) => P[v]);
    const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], e2 = [cc[0] - a[0], cc[1] - a[1], cc[2] - a[2]];
    const n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    const m = [(a[0] + b[0] + cc[0]) / 3, (a[1] + b[1] + cc[1]) / 3, (a[2] + b[2] + cc[2]) / 3];
    out.push(n[0] * m[0] + n[1] * m[1] + n[2] * m[2] >= 0 ? t : [t[0], t[2], t[1]]);
  }
  return { corners, tris: out.flat() };
})();

const _v = new THREE.Vector3(), _n = new THREE.Vector3(), _m = new THREE.Matrix4();
const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _s1 = new THREE.Vector3(1, 1, 1);
const _Y = new THREE.Vector3(0, 1, 0), _Z = new THREE.Vector3(0, 0, 1), _X = new THREE.Vector3(1, 0, 0);
const _hit = { top: null }; // surfaceAt output for walkableAt
const PILLOW = 0.3; // tilt of the normals toward the corner: a slightly domed flat in toon shading

/** Accumulator for merged geometry (positions, normals, colours, indices). Reused by Rampart.js. */
export class Builder {
  constructor() { this.pos = []; this.nrm = []; this.col = []; this.idx = []; this.count = 0; }

  /**
   * Adds a stone: half-sizes (hx, hy, hz), chamfer r, position, quaternion, colour (THREE.Color), and
   * moss { amount 0-1, color } applied to the vertices whose world normal points up.
   */
  stone(hx, hy, hz, r, pos, quat, col, moss = null) {
    r = Math.min(r, 0.45 * Math.min(hx, hy, hz));
    const h = [hx, hy, hz], base = this.pos.length / 3;
    _m.compose(pos, quat, _s1);
    for (let c = 0; c < 8; c++) {
      const sg = BOX.corners[c];
      for (let k = 0; k < 3; k++) {
        _v.set(...[0, 1, 2].map((a) => sg[a] * (a === k ? h[a] : h[a] - r))).applyMatrix4(_m);
        _n.set(...[0, 1, 2].map((a) => (a === k ? sg[a] : 0) + PILLOW * sg[a])).normalize().applyQuaternion(quat);
        this.pos.push(_v.x, _v.y, _v.z);
        this.nrm.push(_n.x, _n.y, _n.z);
        let cr = col.r, cg = col.g, cb = col.b;
        if (moss && _n.y > 0.55) {
          const t = moss.amount * Math.min((_n.y - 0.55) / 0.3, 1);
          cr += (moss.color.r - cr) * t; cg += (moss.color.g - cg) * t; cb += (moss.color.b - cb) * t;
        }
        this.col.push(cr, cg, cb);
      }
    }
    for (const i of BOX.tris) this.idx.push(base + i);
    this.count++;
  }

  geometry() {
    const g = new THREE.BufferGeometry();
    const n = this.pos.length / 3;
    g.setIndex(new THREE.BufferAttribute(n > 65535 ? new Uint32Array(this.idx) : new Uint16Array(this.idx), 1));
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nrm, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return g;
  }
}

/**
 * One accumulator per scenery group: each wall, the roof and each boulder become a separate mesh with its own material,
 * so each can fade out in front of the camera. `use(key)` selects the group of the next stones; `count` counts all stones.
 */
class Parts {
  constructor() { this.map = new Map(); this.cur = null; this.count = 0; }
  use(key) {
    if (!this.map.has(key)) this.map.set(key, new Builder());
    this.cur = this.map.get(key);
    return this;
  }
  stone(...args) { this.cur.stone(...args); this.count++; }
}

/** Colour of a block: mostly cream, rare terracotta and pink, warm grey more likely at the bottom. */
export function stoneColor(rand, low = false) {
  const w = [5, 3, 2, 0.6, 0.6, 2, low ? 2.5 : 0.8];
  let x = rand() * w.reduce((a, b) => a + b, 0), i = 0;
  while (x > w[i]) x -= w[i++];
  return jitter(STONE.blocks[Math.min(i, 6)], 0.045, rand);
}

export function mossOf(rand, p) {
  if (rand() > p) return null;
  return { amount: 0.55 + 0.45 * rand(), color: color(rand() < 0.6 ? MOSS.base : MOSS.light) };
}

// ------------------------------------------------------------------ openings

/** Inner half-width of an opening at height y (-1 if y is outside the opening). */
function halfIn(o, y) {
  if (o.kind === 'circle') {
    const R = o.w / 2, u = y - o.cy;
    return Math.abs(u) <= R ? Math.sqrt(R * R - u * u) : -1;
  }
  if (y < o.sill) return -1;
  if (y <= o.spring) return o.w / 2;
  const u = y - o.spring;
  if (o.kind === 'round') { const R = o.w / 2; return u <= R ? Math.sqrt(R * R - u * u) : -1; }
  // equilateral pointed arch: two arcs of radius w centred on the opposite springing points
  return u <= 0.866 * o.w ? Math.sqrt(o.w * o.w - u * u) - o.w / 2 : -1;
}

/** Outer half-width of the voussoir ring at height y (-1 outside the ring). */
function halfOut(o, y, vd) {
  if (o.kind === 'circle') {
    const R = o.w / 2 + vd, u = y - o.cy;
    return Math.abs(u) <= R ? Math.sqrt(R * R - u * u) : -1;
  }
  if (y < o.spring) return y >= o.sill ? o.w / 2 : -1;
  const u = y - o.spring;
  if (o.kind === 'round') { const R = o.w / 2 + vd; return u <= R ? Math.sqrt(R * R - u * u) : -1; }
  const R = o.w + vd, v = R * R - u * u - o.w * o.w / 4;
  return v >= 0 && R * R - u * u >= 0 ? Math.sqrt(R * R - u * u) - o.w / 2 : -1;
}

/** Half-width to remove from the courses in band [y0, y1] (0 if the opening does not touch it). */
function cutHalf(o, y0, y1, vd) {
  let inMax = -1, outMin = Infinity, anyOut = false;
  for (let k = 0; k <= 8; k++) {
    const y = y0 + (y1 - y0) * k / 8;
    inMax = Math.max(inMax, halfIn(o, y));
    const ho = halfOut(o, y, vd);
    if (ho >= 0) { anyOut = true; outMin = Math.min(outMin, ho); } else outMin = Math.min(outMin, 0);
  }
  if (inMax < 0 && !anyOut) return 0;
  return Math.max(inMax >= 0 ? inMax + 0.02 : 0, anyOut ? outMin : 0);
}

/** Voussoirs along an arc: centres (s, y), tangent angle, tangential length. */
function voussoirs(o, vd) {
  const out = [];
  const arc = (cs, cy, R, a0, a1) => {
    const n = Math.max(2, Math.ceil((R * Math.abs(a1 - a0)) / 0.2));
    for (let i = 0; i < n; i++) {
      const a = a0 + (a1 - a0) * (i + 0.5) / n;
      out.push({ s: cs + R * Math.cos(a), y: cy + R * Math.sin(a), ang: a + Math.PI / 2, len: R * Math.abs(a1 - a0) / n });
    }
  };
  if (o.kind === 'circle') arc(o.c, o.cy, o.w / 2 + vd / 2, 0, 2 * Math.PI);
  else if (o.kind === 'round') arc(o.c, o.spring, o.w / 2 + vd / 2, 0, Math.PI);
  else {
    const R = o.w + vd / 2, a = Math.acos(o.w / (2 * R));
    arc(o.c - o.w / 2, o.spring, R, 0, a);             // right side
    arc(o.c + o.w / 2, o.spring, R, Math.PI - a, Math.PI); // left side
  }
  return out;
}

// ------------------------------------------------------------------ wall

/**
 * Builds a wall as courses of stones along p0 -> p1.
 * @returns {object} collision data: sections (for `obstacles`), top stones (for `walkableAt`), local base
 */
function buildWall(B, spec, heightAt) {
  B.use(spec.name);
  const rand = rng(spec.seed ?? 1);
  const [x0, z0] = spec.p0, [x1, z1] = spec.p1;
  const L = Math.hypot(x1 - x0, z1 - z0);
  const dx = (x1 - x0) / L, dz = (z1 - z0) / L;
  const nx = -dz, nz = dx;                 // normal (local z axis of the wall)
  const rotY = Math.atan2(-dz, dx);
  const T = spec.thick;
  const level = spec.baseY !== undefined;
  const baseAt = (s) => {
    if (level) return spec.baseY;
    const px = x0 + dx * s, pz = z0 + dz * s;
    return Math.min(heightAt(px - nx * T / 2, pz - nz * T / 2), heightAt(px, pz), heightAt(px + nx * T / 2, pz + nz * T / 2)) - SINK;
  };
  const top = spec.climbable ? () => LOW_WALL_TOP + SINK : (spec.top ?? (() => 1.5));
  const openings = (spec.openings ?? []).map((o) => ({ ...o, vd: o.vd ?? VD }));
  const qYaw = new THREE.Quaternion().setFromAxisAngle(_Y, rotY);
  const world = (s, t, y, out) => out.set(x0 + dx * s + nx * t, y, z0 + dz * s + nz * t);

  // Courses
  const rows = [];
  if (spec.climbable) {
    const H = LOW_WALL_TOP + SINK, n = 3;
    for (let i = 0; i < n; i++) rows.push([H * i / n, H * (i + 1) / n]);
  } else {
    const yMax = Math.max(...Array.from({ length: 64 }, (_, i) => top(L * i / 63)));
    let y = 0;
    while (y < yMax - 0.06) { const p = 0.2 + 0.08 * rand(); rows.push([y, y + p]); y += p; }
  }
  const lmin = spec.climbable ? 0.3 : 0.28, lmax = spec.climbable ? 0.52 : 0.55;
  const placed = rows.map(() => []);
  const tops = [];   // top stones (low walls): { s0, s1, top }
  const stones = []; // { s, top } for the top of the sections
  const bottoms = []; // first-course stones: { s0, s1, bottom } (placement check)
  const p = new THREE.Vector3(), q = new THREE.Quaternion();
  const wallTop = (s) => top(Math.min(Math.max(s, 0), L));

  rows.forEach(([y0, y1], r) => {
    // free intervals of the course (openings removed)
    let free = [[0, L]];
    for (const o of openings) {
      const hw = cutHalf(o, y0 + 0.015, y1 - 0.015, o.vd);
      if (hw <= 0) continue;
      const a = o.c - hw, b = o.c + hw;
      free = free.flatMap(([u, v]) => (b <= u || a >= v ? [[u, v]] : [[u, a], [b, v]].filter(([m, n]) => n - m > 0.06)));
    }
    for (const [u, v] of free) {
      let s = u;
      let first = true;
      while (v - s > 0.06) {
        let len = first && r % 2 ? lmin * 0.6 + rand() * 0.2 : lmin + (lmax - lmin) * rand();
        first = false;
        if (v - (s + len) < lmin * 0.55) len = v - s;
        const sc = s + len / 2;
        const keep = y0 + (y1 - y0) * 0.5 < wallTop(sc);
        if (keep) placed[r].push([s, s + len]);
        s += len;
      }
    }
  });

  rows.forEach(([y0, y1], r) => {
    const climbTop = spec.climbable && r === rows.length - 1;
    for (const [s0, s1] of placed[r]) {
      const sc = (s0 + s1) / 2;
      const above = placed[r + 1]?.some(([a, b]) => a <= sc && sc <= b);
      const isTop = !above;
      const base = baseAt(sc);
      const hy = (y1 - y0) / 2 + 0.018;
      const hx = (s1 - s0) / 2 + 0.006;
      const tj = climbTop ? 0 : (rand() - 0.5) * 0.025;
      const yj = climbTop || r === 0 ? 0 : (rand() - 0.5) * 0.012;
      world(sc, tj, base + (y0 + y1) / 2 + yj, p);
      q.copy(qYaw);
      if (!climbTop) q.multiply(_q2.setFromAxisAngle(_Y, (rand() - 0.5) * 0.05)).multiply(_q.setFromAxisAngle(_Z, (rand() - 0.5) * 0.03));
      const col = stoneColor(rand, r === 0);
      const moss = isTop ? mossOf(rand, spec.climbable ? 0.75 : 0.65) : (rand() < 0.06 ? mossOf(rand, 1) : null);
      B.stone(hx, hy, T / 2 + (r === 0 ? 0.02 : 0), 0.045, p, q, col, moss);
      const yTop = base + y1;
      stones.push({ s: sc, s0, s1, top: yTop });
      if (climbTop) tops.push({ s0, s1, top: yTop });
      if (r === 0) bottoms.push({ s0, s1, bottom: base - 0.018 });
    }
  });

  // Arch voussoirs (only below the top of the ruined wall)
  for (const o of openings) {
    for (const v of voussoirs(o, o.vd)) {
      if (v.y + o.vd / 2 > wallTop(v.s) + 0.05) continue;
      const base = baseAt(o.c);
      world(v.s, 0, base + v.y, p);
      q.copy(qYaw).multiply(_q.setFromAxisAngle(_Z, v.ang));
      B.stone(v.len / 2 + 0.01, o.vd / 2, T / 2 + 0.025, 0.04, p, q, stoneColor(rand), rand() < 0.15 ? mossOf(rand, 1) : null);
    }
  }

  // Sill of crossable windows: a flat stone fills the gap of the cut course, from the top of the stones under the window
  // up to base + sill, where the cat lands. Separate random stream (`rng(seed + 700)`), so the rest of the wall does not change.
  const randSill = rng((spec.seed ?? 1) + 700);
  for (const o of openings) {
    if (!o.crossable) continue;
    const base = baseAt(o.c), sillY = base + o.sill;
    const a = o.c - o.w / 2, b = o.c + o.w / 2;
    const under = stones.filter((st) => st.s1 > a && st.s0 < b && st.top <= sillY + 0.01);
    const yLow = under.length ? Math.max(...under.map((st) => st.top)) : base;
    const hy = Math.max(0.03, (sillY - yLow) / 2 + 0.01);
    world(o.c, 0, sillY - hy, p);
    q.copy(qYaw);
    B.stone(o.w / 2 + 0.02, hy, T / 2 + 0.03, 0.03, p, q, stoneColor(randSill), mossOf(randSill, 0.5));
    o.sillY = sillY;
  }

  // Solid sections for collision (a "passable" opening cuts the wall at ground level)
  let cuts = [[0, L]];
  for (const o of openings) {
    if (!o.passable) continue;
    const a = o.c - o.w / 2, b = o.c + o.w / 2;
    cuts = cuts.flatMap(([u, v]) => (b <= u || a >= v ? [[u, v]] : [[u, a], [b, v]].filter(([m, n]) => n - m > 0.05)));
  }
  // Crossable window: a separate walkable section (`sillOf`) under the opening, at sill height.
  for (const o of openings) {
    if (!o.crossable) continue;
    const a = o.c - o.w / 2, b = o.c + o.w / 2;
    cuts = cuts.flatMap(([u, v]) => (b <= u || a >= v ? [[u, v]]
      : [[u, a], [Math.max(u, a), Math.min(v, b)], [b, v]].filter(([m, n]) => n - m > 0.02)));
  }

  // High wall with a walkable top (`perch`): longest run of positions in [perch[0], perch[1]] where the real top of the
  // stones stays within 5 cm. The collision section is cut there so that this top has its own height (`top`).
  let perch = null;
  if (spec.perch && !spec.climbable) {
    const colTop = (s) => {
      let m = -Infinity;
      for (const st of stones) if (s >= st.s0 - 1e-3 && s <= st.s1 + 1e-3 && st.top > m) m = st.top;
      return m;
    };
    const pa = Math.max(0, spec.perch[0]), pb = Math.min(L, spec.perch[1]);
    const S = [];
    for (let s = pa; s <= pb + 1e-6; s += 0.02) S.push([s, colTop(s)]);
    // Longest contiguous run of samples whose top stays within a 5 cm band.
    let run = null;
    for (let i = 0; i < S.length; i++) {
      let lo = S[i][1], hi = S[i][1], j = i;
      while (j + 1 < S.length && Math.max(hi, S[j + 1][1]) - Math.min(lo, S[j + 1][1]) <= 0.05) {
        j++; lo = Math.min(lo, S[j][1]); hi = Math.max(hi, S[j][1]);
      }
      if (!run || S[j][0] - S[i][0] > run[1] - run[0] + 1e-6) run = [S[i][0], S[j][0]];
    }
    if (run && run[1] - run[0] >= 0.3) {
      const level = Math.max(...S.filter(([s]) => s >= run[0] - 1e-6 && s <= run[1] + 1e-6).map(([, y]) => y));
      perch = { s0: run[0], s1: run[1], top: level };
      cuts = cuts.flatMap(([u, v]) => [u, Math.max(u, Math.min(v, run[0])), Math.max(u, Math.min(v, run[1])), v]
        .reduce((acc, x, i, arr) => (i && arr[i] - arr[i - 1] > 0.02 ? [...acc, [arr[i - 1], x]] : acc), []));
    }
  }

  const pieces = cuts.map(([u, v]) => {
    const sill = openings.find((o) => o.crossable && u >= o.c - o.w / 2 - 1e-6 && v <= o.c + o.w / 2 + 1e-6);
    if (sill) {
      let ground = Infinity;
      for (let k = 0; k <= 8; k++) ground = Math.min(ground, baseAt(u + (v - u) * k / 8) + SINK);
      const sc = (u + v) / 2;
      return { name: spec.name, x: x0 + dx * sc, z: z0 + dz * sc, hx: (v - u) / 2, hz: T / 2, rotY,
        top: sill.sillY, ground, height: sill.sillY - ground, climbable: true, sillOf: sill };
    }
    const isPerch = !!perch && u >= perch.s0 - 1e-6 && v <= perch.s1 + 1e-6;
    // Wall with a walkable top: the top of a section is given by the stones overlapping it (edge included).
    const inside = perch
      ? stones.filter((st) => st.s1 > u + 1e-3 && st.s0 < v - 1e-3)
      : stones.filter((st) => st.s >= u && st.s <= v);
    const topY = isPerch ? perch.top : inside.length ? Math.max(...inside.map((st) => st.top)) : baseAt((u + v) / 2);
    let ground = Infinity;
    for (let k = 0; k <= 8; k++) ground = Math.min(ground, baseAt(u + (v - u) * k / 8) + SINK);
    const sc = (u + v) / 2;
    const piece = {
      name: spec.name, x: x0 + dx * sc, z: z0 + dz * sc, hx: (v - u) / 2, hz: T / 2, rotY,
      top: topY, ground, height: topY - ground, climbable: !!spec.climbable,
    };
    if (isPerch) piece.perch = true;
    return piece;
  });

  // Published openings (`ruins.openings`); the walkable sill (`surface`) of crossable windows is added to `_flat` by the constructor.
  const kindOf = (o) => (o.kind === 'circle' ? 'oculus' : o.sill <= 0 ? (o.kind === 'round' ? 'arch' : 'door')
    : o.kind === 'round' ? 'bay' : 'window');
  const openingInfo = openings.map((o, i) => {
    const base = baseAt(o.c), kind = kindOf(o);
    const cy = o.kind === 'circle' ? o.cy : (o.sill + o.spring) / 2;
    const info = {
      name: `${spec.name}_${kind}_${i}`, wall: spec.name, kind, crossable: !!o.crossable, passable: !!o.passable,
      c: o.c, w: o.w, sill: o.kind === 'circle' ? null : base + o.sill, spring: o.kind === 'circle' ? null : base + o.spring,
      center: world(o.c, 0, base + cy, new THREE.Vector3()), normal: new THREE.Vector3(nx, 0, nz),
      sides: null, surface: null, obstacle: null, _o: o, _base: base,
    };
    if (o.crossable) {
      info.sides = [-1, 1].map((sg) => {
        const v = world(o.c, sg * (T / 2 + 0.45), 0, new THREE.Vector3());
        v.y = heightAt(v.x, v.z);
        return v;
      });
      info.obstacle = pieces.find((pc) => pc.sillOf === o) ?? null;
      info.surface = { kind: 'sill', name: info.name, wall: spec.name, opening: info, x: x0 + dx * o.c, z: z0 + dz * o.c,
        hx: o.w / 2 - 0.02, hz: T / 2, rotY, top: o.sillY, topMin: o.sillY, topMax: o.sillY };
      if (info.obstacle) info.obstacle.sillOf = info;
    }
    return info;
  });

  return { name: spec.name, x0, z0, dx, dz, nx, nz, L, T, rotY, tops, bottoms, pieces, climbable: !!spec.climbable,
    perch, climbSide: spec.climbSide ?? 1, seed: spec.seed ?? 1, openings: openingInfo, topAt: wallTop };
}

// ------------------------------------------------------------------ stepped rubble

/**
 * Step chain of a high wall `w` (buildWall output with `perch`). Steps stack outward from the wall face: the highest
 * against the wall, the first (index 0) furthest out. Each step is a flat-topped chamfered slab (where the cat lands) on
 * one or two round stones, plus a few pebbles at the foot (decoration).
 * @returns {{climb, obstacles, rubble, surfaces}}
 */
function buildClimb(B, w, heightAt) {
  B.use(w.name); // steps are part of the mesh of their wall
  const rand = rng((w.seed ?? 1) + 500);
  const side = w.climbSide >= 0 ? 1 : -1;
  const P = w.perch;
  const Y = P.top;
  const sMid = (P.s0 + P.s1) / 2;
  const at = (s, t) => [w.x0 + w.dx * s + w.nx * t * side, w.z0 + w.dz * s + w.nz * t * side];
  const minUnder = (box) => {
    let g = heightAt(box.x, box.z);
    for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      const [cx, cz] = toWorldBox(box, a * box.hx, b * box.hz);
      g = Math.min(g, heightAt(cx, cz));
    }
    return g;
  };
  const pitch = 2 * STEP.hz + STEP.gap;
  const tOf = (k, n) => w.T / 2 + STEP.gap + STEP.hz + (n - 1 - k) * pitch;
  const jit = Array.from({ length: 6 }, () => [(rand() - 0.5) * 0.12, (rand() - 0.5) * 0.12]); // [Δs, Δyaw]

  // Number of steps: the smallest n for which every jump (ground in front -> step 0 -> ... -> top) is at most STEP_RISE_MAX.
  let layout = null;
  for (let n = 1; n <= 6 && !layout; n++) {
    const steps = [];
    for (let k = 0; k < n; k++) {
      const [x, z] = at(sMid + jit[k][0], tOf(k, n));
      const box = { x, z, hx: STEP.hx, hz: STEP.hz, rotY: w.rotY + jit[k][1] };
      steps.push({ ...box, ground: minUnder(box) });
    }
    const [fx, fz] = at(sMid + jit[0][0], tOf(0, n) + STEP.hz + 0.35);
    const gFoot = heightAt(fx, fz);
    const tops = steps.map((_, k) => gFoot + (Y - gFoot) * (k + 1) / (n + 1));
    const rises = [tops[0] - gFoot, ...tops.slice(1).map((y, k) => y - tops[k]), Y - tops[n - 1]];
    if (rises.every((r) => r <= STEP_RISE_MAX + 1e-6) || n === 6) layout = { n, steps, tops, rises, foot: { x: fx, z: fz, y: gFoot } };
  }

  const obstacles = [], rubble = [], surfaces = [];
  const p = new THREE.Vector3(), q = new THREE.Quaternion();
  const roundStone = (x, y, z, hx, hy, hz, yaw, tilt, col, moss) => {
    p.set(x, y, z);
    q.setFromAxisAngle(_Y, yaw).multiply(_q.setFromAxisAngle(_X, tilt));
    B.stone(hx, hy, hz, 0.42 * Math.min(hx, hy, hz), p, q, col, moss);
  };
  const boulderCol = () => color(STONE.boulder).lerp(color(STONE.boulderShade), rand() * 0.3);

  layout.steps.forEach((st, k) => {
    const top = layout.tops[k];
    // Top slab (upper face at top + 1.2 cm: the cat stands at `top`, as on the low walls)
    const slabY = top + 0.012 - STEP.slab;
    p.set(st.x, slabY, st.z);
    q.setFromAxisAngle(_Y, st.rotY).multiply(_q.setFromAxisAngle(_Z, (rand() - 0.5) * 0.02));
    B.stone(STEP.hx, STEP.slab, STEP.hz, 0.045, p, q, stoneColor(rand), mossOf(rand, 0.55));
    // Round stones below, from the ground (buried by SINK) up to the slab
    const y0 = st.ground - SINK, y1 = slabY - STEP.slab + 0.03;
    const H = y1 - y0;
    if (H > 0.05) {
      const layers = H > 0.34 ? 2 : 1;
      for (let l = 0; l < layers; l++) {
        const hy = H / layers / 2 + 0.02;
        const shrink = layers === 2 && l === 1 ? 0.86 : 0.94;
        roundStone(st.x, y0 + H * (l + 0.5) / layers, st.z, STEP.hx * shrink, hy, STEP.hz * shrink,
          st.rotY + (rand() - 0.5) * 0.3, (rand() - 0.5) * 0.12, boulderCol(), l === layers - 1 ? null : mossOf(rand, 0.3));
      }
    }
    const name = `rubble_${w.name}_${k}`;
    const rise = layout.rises[k];
    obstacles.push({ name, x: st.x, z: st.z, hx: st.hx, hz: st.hz, rotY: st.rotY, top, ground: st.ground,
      height: top - st.ground, climbable: true, step: { climb: w.name, index: k, rise } });
    surfaces.push({ kind: 'step', name, climb: w.name, index: k, x: st.x, z: st.z, hx: st.hx, hz: st.hz,
      rotY: st.rotY, top, topMin: top, topMax: top, rise });
  });

  // Pebbles at the foot of the first step, on the sides (decoration, no collision)
  const n = layout.n, t0 = tOf(0, n);
  for (const [ds, dt, size] of [[-STEP.hx - 0.16, 0.05, 0.13], [STEP.hx + 0.14, -0.08, 0.11], [STEP.hx + 0.1, STEP.hz + 0.12, 0.08], [-STEP.hx - 0.08, -STEP.hz - 0.05, 0.1]]) {
    const [x, z] = at(sMid + jit[0][0] + ds, t0 + dt);
    const g = heightAt(x, z);
    roundStone(x, g + size * 0.2, z, size * 1.15, size * 0.75, size, rand() * Math.PI * 2, (rand() - 0.5) * 0.3, boulderCol(), mossOf(rand, 0.5));
    rubble.push({ x, z, r: size * 1.15, top: g + size * 0.95 });
  }

  // Walkable top of the wall
  const sc = sMid;
  const [tx, tz] = [w.x0 + w.dx * sc, w.z0 + w.dz * sc];
  const topSurface = { kind: 'top', name: w.name, climb: w.name, x: tx, z: tz, hx: (P.s1 - P.s0) / 2, hz: w.T / 2,
    rotY: w.rotY, top: Y, topMin: Y, topMax: Y, s0: P.s0, s1: P.s1, rise: layout.rises[n] };
  surfaces.push(topSurface);

  const climb = {
    name: w.name, side, foot: layout.foot, rises: layout.rises,
    steps: surfaces.filter((s) => s.kind === 'step'), top: topSurface,
  };
  for (const s of surfaces) s.chain = climb;
  return { climb, obstacles, rubble, surfaces };
}

// ------------------------------------------------------------------ church

/** Local frame of the church: x across, z along the nave, facade at +z facing the origin. */
function churchFrame(c) {
  const rotY = Math.atan2(-c.x, -c.z);
  const cos = Math.cos(rotY), sin = Math.sin(rotY);
  const toWorld = (lx, lz) => [c.x + lx * cos + lz * sin, c.z - lx * sin + lz * cos];
  return { rotY, toWorld };
}

function churchWalls(c, baseY) {
  const { toWorld } = churchFrame(c);
  const W = c.width, Lc = c.length, T = c.thick, e = c.eave, ap = c.apex;
  const zf = Lc / 2 - T / 2, zb = -Lc / 2 + T / 2, xs = W / 2 - T / 2;
  const mid = W / 2;
  const gable = (s) => e + (ap - e) * Math.max(0, 1 - Math.abs(s - mid) / (W / 2));
  return [
    {
      // Facade: gable broken on the right, bell wall, pointed door, oculus.
      name: 'church_facade', p0: toWorld(-W / 2, zf), p1: toWorld(W / 2, zf), thick: T, baseY, seed: 101,
      top: (s) => {
        const d = s - mid;
        if (Math.abs(d) < 0.62) return d > 0.22 ? c.belfry - 0.45 : c.belfry;
        if (d > 0.9 && d < 1.9) return gable(s) - 0.85;
        return gable(s);
      },
      openings: [
        { c: mid, w: 1.2, sill: 0, spring: 1.5, kind: 'pointed', passable: true },
        { c: mid, w: 0.7, cy: 3.6, kind: 'circle', vd: 0.16 },
        { c: mid, w: 0.5, sill: ap + 0.25, spring: ap + 0.65, kind: 'round', vd: 0.14 },
      ],
    },
    {
      // Left wall (under the remaining roof): high near the facade, then stepped.
      name: 'church_left', p0: toWorld(-xs, Lc / 2 - T), p1: toWorld(-xs, -Lc / 2 + T), thick: T, baseY, seed: 113,
      top: (s) => (s < 2.6 ? e : s < 3.6 ? 2.3 : s < 4.8 ? 1.6 : s < 6.0 ? 1.1 : 1.5),
      openings: [
        // Broken windows the cat can cross (`crossable`): sill about 0.37 m above the ground on both sides
        // (local ground 0.29 to 0.33 m above the base).
        { c: 1.4, w: 0.9, sill: 0.7, spring: 1.65, kind: 'pointed', crossable: true },
        { c: 4.2, w: 0.9, sill: 0.7, spring: 1.65, kind: 'pointed', crossable: true },
      ],
    },
    {
      name: 'church_right', p0: toWorld(xs, -Lc / 2 + T), p1: toWorld(xs, Lc / 2 - T), thick: T, baseY, seed: 127,
      top: (s) => (s < 1.6 ? 0.9 : s < 3.2 ? 1.3 : s < 4.4 ? 2.0 : s < 5.4 ? 2.5 : e),
      openings: [
        // Same (local ground lower on this side: 0.08 to 0.18 m above the base).
        { c: 2.2, w: 0.9, sill: 0.52, spring: 1.65, kind: 'pointed', crossable: true },
        { c: 4.9, w: 0.9, sill: 0.56, spring: 1.65, kind: 'pointed', crossable: true },
      ],
    },
    {
      // Apse wall: tall pointed window between two stepped remains.
      name: 'church_apse', p0: toWorld(W / 2, zb), p1: toWorld(-W / 2, zb), thick: T, baseY, seed: 139,
      top: (s) => (s < 1.0 ? 1.2 : s < 1.5 ? 1.8 : s < 3.1 ? 3.0 : s < 3.8 ? 2.0 : 1.0),
      openings: [{ c: 2.3, w: 0.8, sill: 1.0, spring: 1.9, kind: 'pointed' }],
    },
  ];
}

/** Remaining roof: chamfered tiles on the left slope, near the facade, with a jagged edge. */
function buildRoof(B, c, baseY, rand) {
  B.use('roof');
  const { rotY, toWorld } = churchFrame(c);
  const W = c.width, Lc = c.length;
  const run = W / 2 + 0.15, rise = c.apex - c.eave;
  const alpha = Math.atan2(rise, W / 2);
  const slope = run / Math.cos(alpha);
  const rowStep = 0.27, tileW = 0.36;
  const qChurch = new THREE.Quaternion().setFromAxisAngle(_Y, rotY);
  const p = new THREE.Vector3(), q = new THREE.Quaternion();
  const roofCols = [0xeab39a, 0xdcb582, 0xeab39a, 0xf2cdbf];
  const zStart = Lc / 2 - 0.3;
  let n = 0;
  for (let i = 0; i * rowStep < slope * 0.78; i++) {
    const u = i * rowStep + 0.12;
    const depth = 2.5 - i * 0.16 - rand() * 0.45;
    const lx = -run + u * Math.cos(alpha);
    const ly = baseY + c.eave + 0.1 - 0.15 * Math.tan(alpha) + u * Math.sin(alpha);
    const off = (i % 2) * tileW / 2;
    for (let zz = off; zz < depth; zz += tileW) {
      const lz = zStart - zz - tileW / 2;
      const [wx, wz] = toWorld(lx, lz);
      p.set(wx, ly + 0.012 * i, wz);
      q.copy(qChurch).multiply(_q.setFromAxisAngle(_Z, alpha + 0.07 + (rand() - 0.5) * 0.06))
        .multiply(_q2.setFromAxisAngle(_X, (rand() - 0.5) * 0.05));
      const col = jitter(roofCols[Math.floor(rand() * roofCols.length)], 0.05, rand);
      B.stone(0.17, 0.035, tileW / 2 - 0.005, 0.025, p, q, col, rand() < 0.3 ? mossOf(rand, 1) : null);
      n++;
    }
  }
  return n;
}

// ------------------------------------------------------------------ oriented boxes

function toLocal(o, x, z) {
  const ddx = x - o.x, ddz = z - o.z, c = Math.cos(o.rotY), s = Math.sin(o.rotY);
  return [ddx * c - ddz * s, ddx * s + ddz * c];
}

function toWorldBox(o, lx, lz) {
  const c = Math.cos(o.rotY), s = Math.sin(o.rotY);
  return [o.x + lx * c + lz * s, o.z - lx * s + lz * c];
}

/** Intersection of a segment with a box enlarged by `pad`: first t in [0, 1], or -1. */
function segBox(o, ax, az, bx, bz, pad) {
  const [lax, laz] = toLocal(o, ax, az), [lbx, lbz] = toLocal(o, bx, bz);
  const d = [lbx - lax, lbz - laz], a = [lax, laz], h = [o.hx + pad, o.hz + pad];
  let t0 = 0, t1 = 1;
  for (let k = 0; k < 2; k++) {
    if (Math.abs(d[k]) < 1e-9) { if (Math.abs(a[k]) > h[k]) return -1; continue; }
    let u = (-h[k] - a[k]) / d[k], v = (h[k] - a[k]) / d[k];
    if (u > v) [u, v] = [v, u];
    t0 = Math.max(t0, u); t1 = Math.min(t1, v);
    if (t0 > t1) return -1;
  }
  return t0;
}

// ------------------------------------------------------------------ public class

export class Ruins {
  /**
   * @param {THREE.Object3D|null} scene  scene receiving `ruins.group` (null: nothing is added)
   * @param {object} [opts]
   * @param {(x:number, z:number) => number} [opts.heightAt]  ground height (Terrain.js by default)
   * @param {boolean} [opts.shadows=true]  the scenery casts and receives the sun's shadow
   */
  constructor(scene, { heightAt = terrainHeightAt, shadows = true } = {}) {
    this.heightAt = heightAt;
    const B = new Parts();
    const rand = rng(977);

    // Church, level
    const c = CHURCH;
    const { toWorld } = churchFrame(c);
    let gmin = Infinity;
    for (let i = 0; i <= 6; i++) for (let j = 0; j <= 8; j++) {
      const [wx, wz] = toWorld(-c.width / 2 + c.width * i / 6, -c.length / 2 + c.length * j / 8);
      gmin = Math.min(gmin, heightAt(wx, wz));
    }
    this.churchBase = gmin - SINK;
    const specs = [...churchWalls(c, this.churchBase), ...WALLS];
    this.walls = specs.map((sp) => buildWall(B, sp, heightAt));
    const stonesWalls = B.count;
    const tiles = buildRoof(B, c, this.churchBase, rand);

    /** Ground footprints (oriented boxes): walls (as sections) and boulders. */
    this.obstacles = this.walls.flatMap((w) => w.pieces);

    // Round boulders at the foot of the walls (non-walkable obstacles)
    const boulders = [
      [-c.width / 2 - 0.55, c.length / 2 - 0.2, 0.42], [c.width / 2 + 0.5, -c.length / 2 + 0.6, 0.36],
      [c.width / 2 + 0.75, 1.2, 0.3],
    ];
    const pB = new THREE.Vector3(), qB = new THREE.Quaternion();
    const placeBoulder = (wx, wz, size, name) => {
      const g = heightAt(wx, wz);
      const yaw = rand() * Math.PI * 2;
      pB.set(wx, g + size * 0.25, wz);
      qB.setFromAxisAngle(_Y, yaw).multiply(_q.setFromAxisAngle(_X, (rand() - 0.5) * 0.3));
      const col = color(STONE.boulder).lerp(color(STONE.boulderShade), rand() * 0.25);
      B.use(name);
      B.stone(size * 1.15, size * 0.75, size, size * 0.42, pB, qB, col, mossOf(rand, 0.6));
      this.obstacles.push({ name, x: wx, z: wz, hx: size * 1.15, hz: size, rotY: yaw, top: g + size, ground: g, height: size, climbable: false });
    };
    boulders.forEach(([lx, lz, size], i) => { const [wx, wz] = toWorld(lx, lz); placeBoulder(wx, wz, size, `rock_church_${i}`); });
    { // at the foot of the south-east high wall
      const w = this.walls.find((x) => x.name === 'high_wall_south_east');
      placeBoulder(w.x0 + w.dx * 0.9 - w.nx * 0.6, w.z0 + w.dz * 0.9 - w.nz * 0.6, 0.33, 'rock_wall_se');
    }

    // Stepped rubble at the foot of the high walls with a walkable top. Built before the fallen stones, which avoid the
    // footprints of the steps (obstacleAt).
    this.rubble = [];
    this.climbs = [];
    this._flat = []; // flat walkable surfaces other than low walls: steps and high-wall tops
    for (const w of this.walls) {
      if (!w.perch) continue;
      const r = buildClimb(B, w, heightAt);
      this.climbs.push(r.climb);
      this.obstacles.push(...r.obstacles);
      this.rubble.push(...r.rubble);
      this._flat.push(...r.surfaces);
      w.climb = r.climb;
    }
    /** Openings of all the walls; the sills of crossable windows are surfaces. */
    this.openings = this.walls.flatMap((w) => w.openings);
    for (const o of this.openings) if (o.surface) this._flat.push(o.surface);

    // Fallen stones (decoration, listed in `rubble`; not obstacles)
    const pR = new THREE.Vector3(), qR = new THREE.Quaternion();
    const scatter = (wall, count, spread) => {
      for (let k = 0; k < count; k++) {
        for (let tries = 0; tries < 12; tries++) {
          const s = wall.L * rand();
          const side = rand() < 0.5 ? -1 : 1;
          const t = side * (wall.T / 2 + 0.25 + spread * rand());
          const wx = wall.x0 + wall.dx * s + wall.nx * t, wz = wall.z0 + wall.dz * s + wall.nz * t;
          const r = Math.hypot(wx, wz);
          if (r < 3.4 || r > 17) continue;
          if (this.obstacleAt(wx, wz, 0.15)) continue;
          const hx = 0.13 + 0.12 * rand(), hy = 0.08 + 0.04 * rand(), hz = 0.12 + 0.08 * rand();
          const g = heightAt(wx, wz);
          pR.set(wx, g + hy * 0.45, wz);
          qR.setFromAxisAngle(_Y, rand() * Math.PI * 2)
            .multiply(_q.setFromAxisAngle(_X, (rand() - 0.5) * 0.5)).multiply(_q2.setFromAxisAngle(_Z, (rand() - 0.5) * 0.5));
          B.use(wall.name);
          B.stone(hx, hy, hz, 0.04, pR, qR, stoneColor(rand), mossOf(rand, 0.55));
          this.rubble.push({ x: wx, z: wz, r: Math.max(hx, hz), top: g + hy * 1.45 });
          break;
        }
      }
    };
    for (const w of this.walls) scatter(w, w.climbable ? 2 : w.name.startsWith('church') ? 5 : 6, w.climbable ? 0.4 : 1.3);

    // One mesh per group (each wall with its steps and fallen stones, the roof, each boulder), each with its OWN
    // material: Occlusion.js fades the one hiding the cat.
    this.meshes = [...B.map].map(([key, b]) => {
      const m = new THREE.Mesh(b.geometry(), toonMaterial(0xffffff, { vertexColors: true }));
      m.name = `Ruins_${key}`;
      m.castShadow = shadows;
      m.receiveShadow = shadows;
      m.matrixAutoUpdate = false;
      m.userData.ruins = this;
      return m;
    });
    /** Objects that can fade out in front of the camera (Occlusion.js, through World.js): every visible mesh. */
    this.occluders = this.meshes;

    // Tops of the low walls: walkable surfaces and invisible click mesh
    this.surfaces = this.walls.filter((w) => w.climbable).map((w) => {
      const topY = w.tops.reduce((a, t) => a + t.top, 0) / Math.max(1, w.tops.length);
      const piece = w.pieces[0];
      return { kind: 'lowWall', name: w.name, x: piece.x, z: piece.z, hx: piece.hx, hz: piece.hz, rotY: w.rotY, top: topY,
        topMin: Math.min(...w.tops.map((t) => t.top)), topMax: Math.max(...w.tops.map((t) => t.top)) };
    });
    // Then the steps and the high-wall tops (`kind` 'step' | 'top', `chain` field).
    this.surfaces.push(...this._flat);
    const pp = [], ii = [];
    for (const f of this._flat) {
      const b = pp.length / 3;
      for (const [a, c] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        const [wx, wz] = toWorldBox(f, a * f.hx, c * f.hz);
        pp.push(wx, f.top, wz);
      }
      ii.push(b, b + 2, b + 1, b, b + 3, b + 2);
    }
    for (const w of this.walls) {
      if (!w.climbable) continue;
      for (const t of w.tops) {
        const b = pp.length / 3;
        for (const [s, tt] of [[t.s0, -w.T / 2], [t.s1, -w.T / 2], [t.s1, w.T / 2], [t.s0, w.T / 2]]) {
          pp.push(w.x0 + w.dx * s + w.nx * tt, t.top, w.z0 + w.dz * s + w.nz * tt);
        }
        ii.push(b, b + 2, b + 1, b, b + 3, b + 2);
      }
    }
    const tg = new THREE.BufferGeometry();
    tg.setIndex(ii);
    tg.setAttribute('position', new THREE.Float32BufferAttribute(pp, 3));
    tg.computeBoundingSphere();
    this.walkMesh = new THREE.Mesh(tg, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
    this.walkMesh.name = 'RuinsWalkable';
    this.walkMesh.visible = false; // never drawn; three's Raycaster ignores `visible`
    this.walkMesh.userData.ruins = this;
    /** Meshes for clicks (Picker: `world.pickables`), in addition to the terrain. */
    this.pickables = [this.walkMesh];

    this.group = new THREE.Group();
    this.group.name = 'RuinsGroup';
    this.group.add(...this.meshes, this.walkMesh);
    if (scene) scene.add(this.group);

    const sum = (f) => this.meshes.reduce((a, m) => a + f(m.geometry), 0);
    this.stats = {
      stones: B.count, wallStones: stonesWalls, roofTiles: tiles, triangles: sum((g) => g.index.count / 3),
      vertices: sum((g) => g.attributes.position.count), drawCalls: this.meshes.length,
      shadowDrawCalls: shadows ? this.meshes.length : 0, meshes: this.meshes.length,
    };
  }

  /**
   * World height of the highest walkable surface under (x, z) (low wall top, rubble step, high-wall top; see surfaceAt).
   * @param {number} [margin] inset (m) from the long edges (for example half the paw width)
   * @returns {number|null} height, or null if there is no walkable surface
   */
  walkableAt(x, z, margin = 0) {
    const s = this.surfaceAt(x, z, margin, _hit);
    return s ? _hit.top : null;
  }

  /**
   * Highest walkable surface under (x, z). Same `margin` rules as walkableAt.
   * @param {object|null} [out] receives `out.top`, the exact height (top stone for a low wall, `surface.top` otherwise)
   * @returns {object|null} an element of `surfaces` (`kind` 'lowWall' | 'step' | 'top' | 'sill'), or null
   */
  surfaceAt(x, z, margin = 0, out = null) {
    let best = null, bestTop = -Infinity;
    for (const w of this.walls) {
      if (!w.climbable) continue;
      const rx = x - w.x0, rz = z - w.z0;
      const s = rx * w.dx + rz * w.dz, t = rx * w.nx + rz * w.nz;
      if (Math.abs(t) > w.T / 2 - margin || s < margin || s > w.L - margin) continue;
      for (const st of w.tops) {
        if (s >= st.s0 && s <= st.s1) {
          if (st.top > bestTop) { bestTop = st.top; best = this.surfaces.find((f) => f.name === w.name); }
          break;
        }
      }
    }
    for (const f of this._flat) {
      const [lx, lz] = toLocal(f, x, z);
      if (Math.abs(lx) > f.hx - margin || Math.abs(lz) > f.hz - margin) continue;
      if (f.top > bestTop) { bestTop = f.top; best = f; }
    }
    if (out) out.top = best ? bestTop : null;
    return best;
  }

  /**
   * Walkable point of `surface` closest to (x, z), inset by `margin` from the edges (at most to the centre). Low walls
   * and high-wall tops: on the centre line (narrow tops); steps: within the rectangle.
   * @returns {{x, y, z}} the point, with y = walkableAt at that point
   */
  nearestOn(surface, x, z, margin = 0.1) {
    const f = surface;
    const mx = Math.min(margin, f.hx), mz = Math.min(margin, f.hz);
    let [lx, lz] = toLocal(f, x, z);
    lx = Math.max(-f.hx + mx, Math.min(f.hx - mx, lx));
    lz = f.kind === 'step' ? Math.max(-f.hz + mz, Math.min(f.hz - mz, lz)) : 0;
    const [wx, wz] = toWorldBox(f, lx, lz);
    const y = this.walkableAt(wx, wz, 0) ?? f.top;
    return { x: wx, y, z: wz };
  }

  /**
   * Surfaces to cross from the ground to reach `surface`, in climbing order (the last one is `surface`):
   * [step 0, ..., step k] for a step, [steps..., top] for a high-wall top, [low wall] for a low wall (a single jump).
   * @returns {object[]|null} null if `surface` is null
   */
  stepsTo(surface) {
    if (!surface) return null;
    const c = surface.chain;
    if (!c) return [surface];
    if (surface.kind === 'step') return c.steps.slice(0, surface.index + 1);
    return [...c.steps, c.top];
  }

  /**
   * Target of a click on a wall stone at (point.x, point.z): the nearest obstacle within `reach` m of its footprint.
   * Low wall: its top; high wall with rubble: its walkable top; step: that step; sill of a crossable window: that sill.
   * The target point is `nearestOn` of the clicked point.
   * @returns {{obstacle, surface, top: THREE.Vector3, chain}|null} null elsewhere (the click then targets the ground behind)
   */
  climbTarget(point, reach = 0.12) {
    let o = null, bd = Infinity;
    for (const ob of this.obstacles) {
      const [lx, lz] = toLocal(ob, point.x, point.z);
      const d = Math.hypot(Math.max(Math.abs(lx) - ob.hx, 0), Math.max(Math.abs(lz) - ob.hz, 0));
      if (d < bd) { bd = d; o = ob; }
    }
    if (!o || bd > reach) return null;
    let surface = null;
    if (o.step) surface = this._flat.find((f) => f.name === o.name) ?? null;
    else if (o.sillOf) surface = o.sillOf.surface; // sill of a crossable window
    else {
      const w = this.walls.find((x) => x.name === o.name);
      if (w?.climbable) surface = this.surfaces.find((f) => f.name === w.name) ?? null;
      else if (w?.climb) surface = w.climb.top;
    }
    if (!surface) return null;
    // High-wall top: inset by the cat radius (0.2 m, NAV.radius) from the neighbouring higher step.
    const n = this.nearestOn(surface, point.x, point.z, surface.kind === 'top' ? 0.2 : 0.12);
    return { obstacle: o, surface, top: new THREE.Vector3(n.x, n.y, n.z), chain: surface.chain ?? null };
  }

  /**
   * Crossable window traversed by `ray` (THREE.Ray, normalized direction): intersection with the mid-plane of the wall,
   * inside the inner outline of the opening and below the top of the wall.
   * @returns {{opening, distance, point, top, surface, obstacle, chain: null}|null} `top`: sill point nearest to the target
   */
  openingHit(ray) {
    let best = null;
    for (const op of this.openings) {
      if (!op.crossable) continue;
      const w = this.walls.find((x) => x.name === op.wall);
      const dn = ray.direction.x * w.nx + ray.direction.z * w.nz;
      if (Math.abs(dn) < 1e-6) continue;
      const t = ((w.x0 - ray.origin.x) * w.nx + (w.z0 - ray.origin.z) * w.nz) / dn;
      if (t <= 0 || (best && t >= best.distance)) continue;
      const px = ray.origin.x + ray.direction.x * t, py = ray.origin.y + ray.direction.y * t, pz = ray.origin.z + ray.direction.z * t;
      const s = (px - w.x0) * w.dx + (pz - w.z0) * w.dz;
      // Up to 0.12 m below the sill (face of the sill stone) counts as inside the opening.
      const yy = py - op._base;
      const hw = yy < op._o.sill - 0.12 ? -1 : halfIn(op._o, Math.max(yy, op._o.sill));
      if (hw < 0 || Math.abs(s - op.c) > hw || py > op._base + w.topAt(s)) continue;
      const n = this.nearestOn(op.surface, px, pz, 0.12);
      best = { opening: op, distance: t, point: new THREE.Vector3(px, py, pz), top: new THREE.Vector3(n.x, n.y, n.z),
        surface: op.surface, obstacle: op.obstacle, chain: null };
    }
    return best;
  }

  /** First obstacle whose footprint (enlarged by `margin`) contains (x, z), or null. */
  obstacleAt(x, z, margin = 0) {
    for (const o of this.obstacles) {
      const [lx, lz] = toLocal(o, x, z);
      if (Math.abs(lx) <= o.hx + margin && Math.abs(lz) <= o.hz + margin) return o;
    }
    return null;
  }

  /** Common filter: `y` (foot height) ignores obstacles whose top is below the feet; `climbable: false` ignores low walls. */
  _active(o, opts) {
    if (opts.climbable === false && o.climbable) return false;
    if (opts.y !== undefined && opts.y >= o.top - 0.05) return false;
    return true;
  }

  /**
   * Pushes a disc (centre x, z, radius `radius`) out of the active obstacles (two passes). opts: { y, climbable } (see `_active`).
   * @returns {{x, z, hit}} `hit`: last obstacle touched, or null
   */
  resolve(x, z, radius, opts = {}, out = { x: 0, z: 0, hit: null }) {
    out.x = x; out.z = z; out.hit = null;
    for (let pass = 0; pass < 2; pass++) {
      for (const o of this.obstacles) {
        if (!this._active(o, opts)) continue;
        const [lx, lz] = toLocal(o, out.x, out.z);
        if (Math.abs(lx) > o.hx + radius || Math.abs(lz) > o.hz + radius) continue;
        const cx = Math.max(-o.hx, Math.min(o.hx, lx)), cz = Math.max(-o.hz, Math.min(o.hz, lz));
        let ex = lx - cx, ez = lz - cz;
        const d = Math.hypot(ex, ez);
        let nlx, nlz;
        if (d > 1e-6) {
          if (d >= radius) continue;
          nlx = cx + ex / d * radius; nlz = cz + ez / d * radius;
        } else {
          // centre inside the box: exit through the nearest side
          const px = o.hx - Math.abs(lx), pz = o.hz - Math.abs(lz);
          if (px < pz) { nlx = Math.sign(lx || 1) * (o.hx + radius); nlz = lz; }
          else { nlx = lx; nlz = Math.sign(lz || 1) * (o.hz + radius); }
        }
        [out.x, out.z] = toWorldBox(o, nlx, nlz);
        out.hit = o;
      }
    }
    return out;
  }

  /**
   * Tests whether segment a -> b, swept by a disc of radius `radius`, touches an active obstacle.
   * @returns {{t, obstacle}|null} t in [0, 1]: first contact along the segment
   */
  blockedSegment(ax, az, bx, bz, radius = 0, opts = {}) {
    let best = null;
    for (const o of this.obstacles) {
      if (!this._active(o, opts)) continue;
      const t = segBox(o, ax, az, bx, bz, radius);
      if (t >= 0 && (!best || t < best.t)) best = { t, obstacle: o };
    }
    return best;
  }

  /** Nothing animated for now (present for the uniform call from World.js). */
  update() {}

  dispose() {
    this.group.parent?.remove(this.group);
    for (const m of this.meshes) { m.geometry.dispose(); m.material.dispose(); }
    this.walkMesh.geometry.dispose();
    this.walkMesh.material.dispose();
  }
}
