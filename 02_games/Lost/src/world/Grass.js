/**
 * Meadow grass, created by Meadow.js: bunches of thin, tapered, curved blades in four families (palette `GRASS_KINDS`):
 * `fine` (long supple blades, the carpet), `tuft` (shaggy locks), `seed` (thin stems with a cream spikelet) and `short`
 * (dense short grass in the clearing and at the foot of walls). Families mix in patches through density masks of slow
 * world-space noise (`kindDensity`), and a slow combing direction lays the blades the same way in places.
 *
 * Blade feet are placed on the ground in the shader (`terrainHeight`, Terrain.js). A distance texture (`uExcl`, built by
 * Meadow.js) removes grass from wall footprints and shortens it at their foot.
 *
 * Cat passage: blades against its body tilt outward from the foot without lying down (`catBody`); under a planted paw
 * they lie down, then rise within 0.4 s after the lift (`catPaws`). The cat stays visible through dithering of the
 * blades between it and the camera (`vSee`, uniforms `uSee` and `uSeeCat` set by Meadow.js).
 *
 * Rendering: one instanced mesh per family and layer (10 draw calls). Every height formula exists twice, in JS and GLSL:
 * change both.
 */

import * as THREE from 'three';
import { GLSL_FIELD, inject } from './field.js';
import { GLSL_TERRAIN, heightAt as groundAt } from './Terrain.js';
import { GRASS_KINDS, toonMaterial, color, jitter } from '../style/palette.js';
import { rng } from './random.js';
import { pawHolder } from '../cat/CatRig.js';

// ---------------------------------------------------------------- meadow field (JS = GLSL)

/** Clearing: transition from short grass to meadow over the warped radius (m). */
export const CLEAR_START = 1.4;
export const CLEAR_END = 5.4;
/** Wall distance (m) beyond which a wall has no effect (texture encoding). */
export const WALL_FAR = 2.0;

const sstep = (a, b, x) => { const t = Math.min(Math.max((x - a) / (b - a), 0), 1); return t * t * (3 - 2 * t); };
const nA = (x, z) => 0.5 + 0.25 * (Math.sin(x * 0.31 + z * 0.17) + Math.sin(z * 0.29 - x * 0.13 + 1.7));
const nB = (x, z) => 0.5 + 0.25 * (Math.sin(0.53 * x - 0.41 * z + 0.6) + Math.sin(0.47 * z + 0.37 * x + 2.9));
const nC = (x, z) => 0.5 + 0.25 * (Math.sin(1.37 * x + 0.71 * z + 1.3) + Math.sin(1.21 * z - 0.93 * x + 0.2));

/** 0 at the heart of the starting clearing, 1 in full meadow; irregular edge (radius noise of +/- 2 m). */
export function clearingAt(x, z) {
  const r = Math.hypot(x, z);
  const warp = (1.3 * Math.sin(0.9 * x + 0.4) * Math.sin(0.7 * z - 1.1) + 0.7 * Math.sin(1.7 * x - 1.3 * z + 2.0)) * Math.min(r / 2.5, 1);
  return sstep(CLEAR_START, CLEAR_END, r + warp);
}

/**
 * Mean height (m) of the fine blades above the GROUND at (x, z). Clearing 0.07-0.18 m; meadow 0.42-1.12 m.
 * @param {number} [wall] distance to the nearest wall (m): 0 in a wall footprint, short grass at its foot
 * @returns {number} height in metres
 */
export function grassHeight(x, z, wall = WALL_FAR) {
  if (wall <= 0) return 0;
  const t = clearingAt(x, z);
  const c = nC(x, z);
  const short = 0.07 + 0.11 * c;
  const tall = 0.72 + 0.4 * nA(x, z) - 0.3 * sstep(0.6, 0.9, nB(x, z));
  let h = short + (tall - short) * t;
  const nearWall = 1 - sstep(0.15, 1.0, wall);
  h += (Math.min(h, 0.13 + 0.08 * c) - h) * nearWall;
  return h;
}

/**
 * Signed distance (m) from (x, z) to the nearest excluded zone (negative inside), capped at WALL_FAR.
 * @param {object[]} list rectangles `{ x, z, hx, hz, rotY }` (half-sides, rotation about Y) or discs `{ x, z, r }`
 * @returns {number} signed distance in metres
 */
export function exclusionDistance(list, x, z) {
  let d = WALL_FAR;
  for (const e of list) {
    const dx = x - e.x, dz = z - e.z;
    let s;
    if (e.r !== undefined) s = Math.hypot(dx, dz) - e.r;
    else {
      const c = Math.cos(e.rotY || 0), sn = Math.sin(e.rotY || 0);
      const lx = Math.abs(c * dx - sn * dz) - e.hx, lz = Math.abs(sn * dx + c * dz) - e.hz;
      s = Math.hypot(Math.max(lx, 0), Math.max(lz, 0)) + Math.min(Math.max(lx, lz), 0);
    }
    if (s < d) d = s;
  }
  return d;
}

// ---------------------------------------------------------------- cat passage (JS = GLSL)

/**
 * Body: capsule from `back` m behind to `front` m ahead of the cat, along its heading. Blades whose foot is within `inner`
 * m of the axis tilt from the foot by `tilt` (tangent of the angle from vertical), fading to nothing at `reach` m; the
 * direction is outward, plus `forward` in the walking direction. Blades shorter than `minLength` (m) do not tilt. Cat in
 * the air: no effect beyond `airborne[1]` m above the ground. `fullSpeed`: full walking speed (m/s, `motion` = 1).
 * `maxJump`: position jump (m) treated as a teleport (prints cleared).
 */
export const BODY = { back: 0.30, front: 0.25, inner: 0.09, reach: 0.16, tilt: 0.35, forward: 0.05, minLength: [0.08, 0.14], fullSpeed: 1.0, airborne: [0.3, 0.7], maxJump: 2 };
/**
 * Paws: `count` prints (2 per paw: current and previous). Under a planted paw, blades within `inner` m lie down (tilt
 * `strength`, about 72 degrees from vertical), fading to nothing at `reach` m; the direction is outward, plus `along` in
 * the walking direction. Weight: full after `rise` s; after the lift, exp(-age / `tau`), brought to 0 between 0.75 x `life`
 * and `life` s. A paw is planted when its bone is less than `down.F` (front) or `down.B` (rear) m above the ground, and
 * lifted above that threshold + `hyst`.
 */
export const PAW = { count: 8, inner: 0.035, reach: 0.07, strength: 3.0, along: 0.3, rise: 0.05, tau: 0.12, life: 0.4, down: { F: 0.045, B: 0.038 }, hyst: 0.01 };
/** Upper bound of the total cat effect for `catBend` (flowers). */
export const CAT_BEND_MAX = 1.0; // about 45 degrees from vertical at most
/** Ground distance (m) between two heading updates when the heading comes from movement (no `setCat`). */
const HEADING_STEP = 0.05;
const NO_PAW = 1e5; // empty print: x out of any range

/**
 * Tilt caused by the body at (x, z), same formula as `catBody` in GLSL.
 * @param {object} cat state held by `Grass.update`
 * @param {number} [own] direction of the blade (rad), used under the belly where "outward" has no meaning
 * @returns {{x, z}} horizontal vector whose length is the tangent of the angle from vertical
 */
function catBody(x, z, cat, own = 0, out = { x: 0, z: 0 }) {
  out.x = 0; out.z = 0;
  const hx = Math.cos(cat.heading), hz = Math.sin(cat.heading);
  const ax = cat.x - hx * BODY.back, az = cat.z - hz * BODY.back;
  const sx = hx * (BODY.back + BODY.front), sz = hz * (BODY.back + BODY.front);
  const u = Math.min(Math.max(((x - ax) * sx + (z - az) * sz) / (sx * sx + sz * sz), 0), 1);
  const nx = x - (ax + sx * u), nz = z - (az + sz * u);
  const d = Math.hypot(nx, nz);
  const k = (1 - sstep(BODY.inner, BODY.reach, d)) * BODY.tilt * cat.contact;
  if (k <= 0) return out;
  const m = sstep(0, 0.03, d);
  const ox = (d > 1e-4 ? nx / d : 0) * m + Math.cos(own) * (1 - m) + hx * BODY.forward * cat.motion;
  const oz = (d > 1e-4 ? nz / d : 0) * m + Math.sin(own) * (1 - m) + hz * BODY.forward * cat.motion;
  const ol = Math.hypot(ox, oz);
  if (ol > 1e-4) { out.x = ox / ol * k; out.z = oz / ol * k; }
  return out;
}

/** Weight of a print (0-1) at `time`: stance, then recovery after the lift. */
function pawWeight(p, time, ageScale = 1) {
  let w = sstep(0, PAW.rise, time - p.tDown);
  if (p.tUp >= 0) {
    const a = Math.max(time - p.tUp, 0) * ageScale;
    w *= Math.exp(-a / PAW.tau) * (1 - sstep(0.75 * PAW.life, PAW.life, a));
  }
  return w;
}

/**
 * Tilt caused by the paws at (x, z), same formula as `catPaws` in GLSL: the strongest print wins.
 * `cat.paws` = [{ x, z, tDown, tUp }] (tUp = -1 while the paw is planted).
 */
function catPaws(x, z, cat, time, jit = 1, ageScale = 1, out = { x: 0, z: 0 }) {
  out.x = 0; out.z = 0;
  const R = PAW.reach;
  const hx = Math.cos(cat.heading), hz = Math.sin(cat.heading);
  let best = 0;
  for (const p of cat.paws) {
    const rx = x - p.x, rz = z - p.z;
    const r = Math.hypot(rx, rz);
    if (r >= R) continue;
    const k = (1 - sstep(PAW.inner, R, r)) * pawWeight(p, time, ageScale);
    if (k <= best) continue;
    const ox = (r > 1e-4 ? rx / r : 0) + hx * PAW.along, oz = (r > 1e-4 ? rz / r : 0) + hz * PAW.along;
    const ol = Math.hypot(ox, oz);
    if (ol <= 1e-4) continue;
    best = k;
    const s = k * PAW.strength * jit * cat.contact / ol;
    out.x = ox * s; out.z = oz * s;
  }
  return out;
}

/**
 * Total cat effect at (x, z) (body + paws), capped at CAT_BEND_MAX, same formula as `catBend` in GLSL. Used by the flowers
 * (Flowers.js); the grass applies body and paws separately (VERTEX_BLADE).
 * `jit` and `ageScale`: per-bunch variation (1 = average).
 * @returns {{x, z}} horizontal displacement of the tip per metre of height
 */
export function catBend(x, z, cat, time, jit = 1, ageScale = 1, own = 0, out = { x: 0, z: 0 }) {
  catBody(x, z, cat, own, _cb);
  catPaws(x, z, cat, time, jit, ageScale, _cp);
  out.x = _cb.x + _cp.x; out.z = _cb.z + _cp.z;
  const L = Math.hypot(out.x, out.z);
  if (L > CAT_BEND_MAX) { out.x *= CAT_BEND_MAX / L; out.z *= CAT_BEND_MAX / L; }
  return out;
}
const _cb = { x: 0, z: 0 }, _cp = { x: 0, z: 0 };

/** Same formulas in GLSL (grass and flowers of Flowers.js); requires GLSL_FIELD (uTime) first. */
export const GLSL_CAT = /* glsl */ `
uniform vec4 uCat;     // cat: x, z, heading (rad), motion 0-1
uniform vec4 uCatBox;  // ground contact 0-1; circle enclosing the body and live prints: x, z, radius
uniform vec4 uPaws[${PAW.count}]; // prints: x, z, plant time, lift time (-1: planted)
vec2 catBody(vec2 p, float own) {
  if (length(p - uCatBox.yz) > uCatBox.w) return vec2(0.0);
  vec2 h = vec2(cos(uCat.z), sin(uCat.z));
  vec2 a = uCat.xy - h * ${BODY.back.toFixed(4)};
  vec2 s = h * ${(BODY.back + BODY.front).toFixed(4)};
  float u = clamp(dot(p - a, s) / dot(s, s), 0.0, 1.0);
  vec2 n = p - (a + s * u);
  float d = length(n);
  float k = (1.0 - smoothstep(${BODY.inner.toFixed(4)}, ${BODY.reach.toFixed(4)}, d)) * ${BODY.tilt.toFixed(4)} * uCatBox.x;
  if (k <= 0.0) return vec2(0.0);
  float m = smoothstep(0.0, 0.03, d);
  vec2 o = (d > 1e-4 ? n / d : vec2(0.0)) * m + vec2(cos(own), sin(own)) * (1.0 - m) + h * ${BODY.forward.toFixed(4)} * uCat.w;
  float ol = length(o);
  return ol > 1e-4 ? o / ol * k : vec2(0.0);
}
float pawWeight(vec4 q, float ageScale) {
  float w = smoothstep(0.0, ${PAW.rise.toFixed(4)}, uTime - q.z);
  if (q.w >= 0.0) {
    float a = max(uTime - q.w, 0.0) * ageScale;
    w *= exp(-a / ${PAW.tau.toFixed(4)}) * (1.0 - smoothstep(${(0.75 * PAW.life).toFixed(4)}, ${PAW.life.toFixed(4)}, a));
  }
  return w;
}
vec2 catPaws(vec2 p, float jit, float ageScale) {
  if (length(p - uCatBox.yz) > uCatBox.w) return vec2(0.0);
  vec2 h = vec2(cos(uCat.z), sin(uCat.z));
  float best = 0.0;
  vec2 res = vec2(0.0);
  for (int i = 0; i < ${PAW.count}; i++) {
    vec4 q = uPaws[i];
    vec2 r = p - q.xy;
    float rl = length(r);
    if (rl >= ${PAW.reach.toFixed(4)}) continue;
    float k = (1.0 - smoothstep(${PAW.inner.toFixed(4)}, ${PAW.reach.toFixed(4)}, rl)) * pawWeight(q, ageScale);
    if (k <= best) continue;
    vec2 o = (rl > 1e-4 ? r / rl : vec2(0.0)) + h * ${PAW.along.toFixed(4)};
    float ol = length(o);
    if (ol <= 1e-4) continue;
    best = k;
    res = o * (k * ${PAW.strength.toFixed(4)} * jit * uCatBox.x / ol);
  }
  return res;
}
vec2 catBend(vec2 p, float jit, float ageScale, float own) {
  vec2 b = catBody(p, own) + catPaws(p, jit, ageScale);
  float L = length(b);
  return L > ${CAT_BEND_MAX.toFixed(4)} ? b * (${CAT_BEND_MAX.toFixed(4)} / L) : b;
}
`;

const GLSL_GRASS_FIELD = /* glsl */ `
uniform sampler2D uExcl;  // wall distance (0-1 x uExclBox.w), built by Meadow.js
uniform vec4 uExclBox;    // x min, z min, side (m), maximum encoded distance (m)
float gNA(vec2 p) { return 0.5 + 0.25 * (sin(p.x * 0.31 + p.y * 0.17) + sin(p.y * 0.29 - p.x * 0.13 + 1.7)); }
float gNB(vec2 p) { return 0.5 + 0.25 * (sin(0.53 * p.x - 0.41 * p.y + 0.6) + sin(0.47 * p.y + 0.37 * p.x + 2.9)); }
float gNC(vec2 p) { return 0.5 + 0.25 * (sin(1.37 * p.x + 0.71 * p.y + 1.3) + sin(1.21 * p.y - 0.93 * p.x + 0.2)); }
float clearingAt(vec2 p) {
  float r = length(p);
  float w = (1.3 * sin(0.9 * p.x + 0.4) * sin(0.7 * p.y - 1.1) + 0.7 * sin(1.7 * p.x - 1.3 * p.y + 2.0)) * min(r / 2.5, 1.0);
  return smoothstep(${CLEAR_START.toFixed(4)}, ${CLEAR_END.toFixed(4)}, r + w);
}
float wallDist(vec2 p) {
  vec2 uv = (p - uExclBox.xy) / uExclBox.z;
  if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) return uExclBox.w;
  return texture(uExcl, uv).r * uExclBox.w;
}
float grassHeight(vec2 p, float t, float wall) {
  float c = gNC(p);
  float sh = 0.07 + 0.11 * c;
  float tall = 0.72 + 0.4 * gNA(p) - 0.3 * smoothstep(0.6, 0.9, gNB(p));
  float h = mix(sh, tall, t);
  float nearWall = 1.0 - smoothstep(0.15, 1.0, wall);
  h = mix(h, min(h, 0.13 + 0.08 * c), nearWall);
  return wall <= 0.0 ? 0.0 : h;
}
// Density of each family (0-1): fine 0, tuft 1, seed 2, short 3.
float kindDensity(float kind, vec2 p, float t, float wall) {
  float nearWall = 1.0 - smoothstep(0.15, 1.0, wall);
  float d;
  if (kind < 0.5) d = mix(0.35, 0.95, t) * (0.8 + 0.2 * gNC(p)) * (1.0 - 0.7 * nearWall);
  else if (kind < 1.5) d = mix(0.25, 1.0, smoothstep(0.42, 0.72, gNA(p))) * mix(0.45, 1.0, t) * (1.0 - 0.8 * nearWall);
  else if (kind < 2.5) d = smoothstep(0.52, 0.85, gNB(p)) * t * (1.0 - nearWall);
  else d = max(max(0.6 * (1.0 - t), nearWall), 0.16);
  return d * step(0.02, wall);
}
// Family-specific height, from the height of the fine blades.
float kindHeight(float kind, vec2 p, float h) {
  float tallness = smoothstep(0.25, 0.6, h);
  if (kind < 0.5) return h;
  if (kind < 1.5) return mix(h, h * 0.55, tallness);
  if (kind < 2.5) return h * 1.15 + 0.08;
  return min(h, 0.09 + 0.12 * gNC(p));
}
`;

// ---------------------------------------------------------------- bunch shapes

/** Blade profiles: s (0 foot to 1 tip), relative width, head (spikelet). */
const PROFILES = {
  blade3: [[0, 1], [0.35, 0.92], [0.7, 0.6], [1, 0]],      // 7 vertices, 5 triangles
  blade2: [[0, 1], [0.5, 0.78], [1, 0]],                   // 5 vertices, 3 triangles
  blade1: [[0, 1], [1, 0]],                                // 3 vertices, 1 triangle
  // Thin stem then oval cream spikelet: 11 vertices, 9 triangles.
  seed: [[0, 0.22], [0.4, 0.2], [0.7, 0.18], [0.78, 0.75, 1], [0.89, 1, 1], [1, 0, 1]],
  seedFar: [[0, 0.22], [0.74, 0.18], [0.87, 1, 1], [1, 0, 1]],
};

/**
 * Blades of a bunch (bunch frame, radius 1, height 1) by family: foot (bx, bz), bend direction `phi`, bend `lean`
 * (horizontal offset at the tip / length), length `len`, width `w`, profile.
 */
function bladeSet(kind, n, profile, rand) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = rand() * Math.PI * 2;
    if (kind === 'fine') {
      const r = Math.sqrt(rand());
      out.push({ bx: Math.cos(a) * r, bz: Math.sin(a) * r, phi: rand() * Math.PI * 2, lean: 0.12 + 0.3 * rand(), len: 0.62 + 0.38 * rand(), w: 0.8 + 0.3 * rand(), profile });
    } else if (kind === 'tuft') {
      // Locks: tight feet, blades spread far outward, uneven lengths.
      const r = 0.25 + 0.35 * rand();
      out.push({ bx: Math.cos(a) * r, bz: Math.sin(a) * r, phi: a + (rand() - 0.5) * 0.8, lean: 0.35 + 0.45 * rand(), len: 0.5 + 0.5 * rand(), w: 0.85 + 0.3 * rand(), profile });
    } else if (kind === 'short') {
      const r = Math.sqrt(rand());
      out.push({ bx: Math.cos(a) * r, bz: Math.sin(a) * r, phi: rand() * Math.PI * 2, lean: 0.2 + 0.4 * rand(), len: 0.55 + 0.45 * rand(), w: 0.8 + 0.4 * rand(), profile });
    }
  }
  return out;
}

/** Spikelet bunch: `stems` nearly straight stems plus `leaves` small low leaves. */
function seedSet(stems, leaves, stemProfile, rand) {
  const out = [];
  for (let i = 0; i < stems; i++) {
    const a = rand() * Math.PI * 2, r = 0.5 * Math.sqrt(rand());
    out.push({ bx: Math.cos(a) * r, bz: Math.sin(a) * r, phi: rand() * Math.PI * 2, lean: 0.05 + 0.15 * rand(), len: 0.8 + 0.2 * rand(), w: 1, profile: stemProfile });
  }
  for (let i = 0; i < leaves; i++) {
    const a = rand() * Math.PI * 2;
    out.push({ bx: Math.cos(a) * 0.4, bz: Math.sin(a) * 0.4, phi: a, lean: 0.5 + 0.3 * rand(), len: 0.28 + 0.12 * rand(), w: 0.55, profile: PROFILES.blade2 });
  }
  return out;
}

/**
 * Geometry of a bunch. Per-vertex attributes:
 * - `position`: blade foot (x, z, in bunch radii); y = s, position along the blade;
 * - `color`: r = side (-0.5 / 0 / +0.5 of the width), g = width relative to the profile, b = 1 on the spikelet;
 * - `aBl`: bend direction, bend, relative length, relative width of the blade.
 */
function clumpGeometry(blades) {
  const pos = [], col = [], bl = [], nrm = [], idx = [];
  const push = (B, s, w, side, head) => {
    pos.push(B.bx, s, B.bz);
    col.push(side, w, head);
    bl.push(B.phi, B.lean, B.len, B.w);
    nrm.push(0, 1, 0);
    return pos.length / 3 - 1;
  };
  for (const B of blades) {
    let prev = null;
    for (const [s, w, head = 0] of B.profile) {
      const row = w > 0 ? [push(B, s, w, -0.5, head), push(B, s, w, 0.5, head)] : [push(B, s, 0, 0, head)];
      if (prev) {
        if (row.length === 2) idx.push(prev[0], prev[1], row[1], prev[0], row[1], row[0]);
        else idx.push(prev[0], prev[1], row[0]);
      }
      prev = row;
    }
  }
  const g = new THREE.InstancedBufferGeometry();
  g.setIndex(idx);
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('aBl', new THREE.Float32BufferAttribute(bl, 4));
  return g;
}

// ---------------------------------------------------------------- layers and families

/**
 * Families: shader id, bunch radius (m), colours. The tip colour (`tips`) is drawn per bunch; `head` is the spikelet;
 * `warmRate`: share of bunches with the `warm` tip.
 */
const KIND_INFO = {
  fine: { id: 0, radius: 0.09, base: GRASS_KINDS.fine.base, tips: [GRASS_KINDS.fine.tip], warm: GRASS_KINDS.tuft.warmTip, warmRate: 0.05 },
  tuft: { id: 1, radius: 0.06, base: GRASS_KINDS.tuft.base, tips: [GRASS_KINDS.tuft.tip], warm: GRASS_KINDS.tuft.warmTip, warmRate: 0.18 },
  seed: { id: 2, radius: 0.06, base: GRASS_KINDS.seed.base, tips: [GRASS_KINDS.seed.stem], head: GRASS_KINDS.seed.head, warmRate: 0 },
  short: { id: 3, radius: 0.12, base: GRASS_KINDS.short.base, tips: [GRASS_KINDS.short.tip], warm: GRASS_KINDS.fine.tip, warmRate: 0.2 },
};

/**
 * Layers that follow the camera (tiles repeated around `center`): tile half-side (m), fade in and out (m from the centre),
 * then one entry per family: bunches per tile, blades per bunch (or stems and leaves for spikelets), profile, blade width
 * (m). Further layers have fewer blades per bunch, simpler profiles and wider blades, to keep the coverage.
 */
export const LAYERS = [
  { name: 'near', half: 5, fadeIn: null, fadeOut: [3.8, 5.0], receiveShadow: true, kinds: {
    fine: { count: 3600, n: 7, profile: 'blade3', width: 0.026 },
    tuft: { count: 1500, n: 9, profile: 'blade2', width: 0.032 },
    seed: { count: 700, stems: 3, leaves: 3, profile: 'seed', width: 0.04 },
    short: { count: 1800, n: 8, profile: 'blade2', width: 0.028 },
  } },
  { name: 'mid', half: 11, fadeIn: [3.6, 5.0], fadeOut: [8.5, 11], receiveShadow: false, kinds: {
    fine: { count: 6000, n: 5, profile: 'blade2', width: 0.042 },
    tuft: { count: 2000, n: 6, profile: 'blade2', width: 0.05 },
    seed: { count: 1200, stems: 2, leaves: 0, profile: 'seedFar', width: 0.06 },
    short: { count: 1500, n: 5, profile: 'blade1', width: 0.05 },
  } },
  // Far layer sized for the 18 to 40 m zone (fog 12-46 m in World.js).
  { name: 'far', half: 30, fadeIn: [8.0, 11], fadeOut: [24, 29.5], receiveShadow: false, kinds: {
    fine: { count: 14000, n: 4, profile: 'blade1', width: 0.085 },
    tuft: { count: 6250, n: 5, profile: 'blade1', width: 0.095 },
  } },
];

const VERTEX_HEAD = /* glsl */ `
${GLSL_FIELD}
${GLSL_TERRAIN}
${GLSL_GRASS_FIELD}
${GLSL_CAT}
uniform vec2 uCenter;
uniform vec4 uLayer;     // half-side, fade-in start and end (0 = none), blade width
uniform vec2 uFadeOut;   // fade-out start and end
uniform vec4 uKind;      // family (0-3), bunch radius (m)
uniform vec4 uSee;       // dithering: camera x, y, z; strength 0-1 (Meadow.js)
uniform vec3 uSeeCat;    // target point on the cat (m)
varying float vSee;      // 0: solid blade; 1: dithered (5 of 16 fragments kept)
uniform vec3 uKBase;     // foot (linear)
uniform vec3 uKHead;     // spikelet (linear)
attribute vec4 aBlade;   // x, z in the tile; angle; random 0-1
attribute vec4 aShape;   // height factor; width factor; bend direction and strength
attribute vec4 aTint;    // tip colour (linear); shade
attribute vec4 aBl;      // blade: bend direction, bend, length, width
`;

const VERTEX_BLADE = /* glsl */ `
vec2 gTile = vec2(2.0 * uLayer.x);
vec2 gC = aBlade.xy + gTile * floor((uCenter - aBlade.xy) / gTile + 0.5);
float gD = length(gC - uCenter);
float gKeep = 1.0 - smoothstep(uFadeOut.x, uFadeOut.y, gD);
if (uLayer.z > 0.0) gKeep *= smoothstep(uLayer.y, uLayer.z, gD);
float gT = clearingAt(gC);
float gWall = wallDist(gC);
float gOn = step(aBlade.w, gKeep * kindDensity(uKind.x, gC, gT, gWall));
float gH = kindHeight(uKind.x, gC, grassHeight(gC, gT, gWall)) * aShape.x * gOn;
// In front of a low camera, blades are dithered (vSee, below) instead of being trimmed to 0.2 m,
// which would leave a patch of short grass visible from above.
float gCamD = length(gC - uPushB.xy);
float gNear = (1.0 - smoothstep(0.5, 1.6, gCamD)) * clamp(uPushB.w / 1.2, 0.0, 1.0);
// Blade: foot in the bunch, tapered ribbon curved in its own direction.
float gCa = cos(aBlade.z), gSa = sin(aBlade.z);
vec2 gBo = position.xz * uKind.y;
vec2 gBase = gC + vec2(gCa * gBo.x - gSa * gBo.y, gSa * gBo.x + gCa * gBo.y);
// Cat, read at the foot of each blade: planted paws (blades lie down then rise, catPaws) and body
// (tilt from the foot without lying down, catBody, further down). Per-bunch variation: strength
// x0.8 to 1, recovery x0.85 to 1.15.
vec2 gPaw = catPaws(gBase, 0.8 + 0.2 * gNC(gC * 3.1), 0.85 + 0.3 * aBlade.w);
float gPress = clamp(length(gPaw) / ${PAW.strength.toFixed(4)}, 0.0, 1.0);
// Bend: wind (damped under a paw) + push from the camera + slow combing of the field
// + the bend of the bunch.
float gCombA = 2.5 * sin(0.21 * gC.x + 0.3) + 2.0 * sin(0.17 * gC.y - 0.8);
vec2 gComb = vec2(cos(gCombA), sin(gCombA));
vec2 gOff = windAt(gC, uTime) * (1.0 - 0.7 * gPress) + pushOne(gC, uPushB) + gComb * 0.14 + vec2(cos(aShape.z), sin(aShape.z)) * aShape.w;
float gOL = length(gOff);
if (gOL > 1.1) gOff *= 1.1 / gOL;
float gS = position.y;
float gPhi = aBl.x + aBlade.z;
vec2 gDir = vec2(cos(gPhi), sin(gPhi));
vec2 gLat = vec2(-gDir.y, gDir.x);
float gL = gH * aBl.z;
float gW = uLayer.w * aShape.y * aBl.w * color.g * gOn;
vec2 gXZ = gBase + gLat * (color.r * gW) + gDir * (aBl.y * gL * gS * gS);
float gBend = gL * pow(gS, 1.6);
gXZ += gOff * gBend;
float gY = gL * gS * inversesqrt(1.0 + aBl.y * aBl.y * gS * gS) * inversesqrt(1.0 + dot(gOff, gOff));
// Tilt from the foot (body + paws): the blade pivots toward gTilt (tangent of the angle
// from vertical), its height converted into a horizontal offset.
vec2 gTilt = catBody(gBase, aShape.z) * smoothstep(${BODY.minLength[0].toFixed(4)}, ${BODY.minLength[1].toFixed(4)}, gL) + gPaw;
float gTC = inversesqrt(1.0 + dot(gTilt, gTilt));
gXZ += gTilt * (gY * gTC);
gY *= gTC;
vec3 gPos = vec3(gXZ.x, terrainHeight(gBase) + gY, gXZ.y);
// Dithering: cone from the camera to the cat (radius 0.3 to 0.5 m at the cat), ending just
// behind it, plus blades in front of the lens; strength uSee.w (Meadow.js).
{
  vec3 gSeg = uSeeCat - uSee.xyz;
  float gSL = max(length(gSeg), 1e-3);
  vec3 gSD = gSeg / gSL;
  vec3 gRel = gPos - uSee.xyz;
  float gAl = dot(gRel, gSD);
  float gTT = clamp(gAl / gSL, 0.0, 1.0);
  float gPerp = length(gRel - gSD * gAl);
  float gCone = (1.0 - smoothstep(0.3 * gTT, 0.5 * gTT + 1e-3, gPerp)) * (1.0 - smoothstep(gSL - 0.1, gSL + 0.2, gAl)) * step(0.0, gAl);
  vSee = max(gCone * uSee.w, gNear);
}
// Normal: nearly vertical, tilted slightly along the combing and the blade (per-lock highlights).
vec3 objectNormal = normalize(vec3(gComb * 0.18 + gDir * 0.12, 1.0));
// Colour: foot, middle, tip along the blade, cream spikelet; shade per patch.
{
  float gShade = aTint.w * mix(0.93, 1.07, gNC(gC * 1.7));
  vec3 gBaseC = uKBase * gShade;
  vec3 gTipC = aTint.rgb * mix(0.96, 1.04, gNA(gC * 2.3));
  vec3 gMidC = mix(gBaseC, gTipC, 0.45);
  vec3 gBlade = gS < 0.5 ? mix(gBaseC, gMidC, gS / 0.5) : mix(gMidC, gTipC, (gS - 0.5) / 0.5);
  vColor.rgb = color.b > 0.5 ? uKHead * gShade : gBlade;
}
`;

/** Fragment-side dithering: 4x4 Bayer matrix (0 to 15/16); vSee = 1 keeps 5 of 16 fragments. */
const FRAGMENT_HEAD = /* glsl */ `
varying float vSee;
float gBayer2(vec2 a) { a = floor(a); return fract(a.x / 2.0 + a.y * a.y * 0.75); }
float gBayer4(vec2 a) { return gBayer2(0.5 * a) * 0.25 + gBayer2(a); }
`;
const FRAGMENT_SEE = /* glsl */ `
if (vSee * 0.68 > gBayer4(gl_FragCoord.xy)) discard;
`;

export class Grass {
  /**
   * @param {object} uniforms shared uniforms (uTime, uWindDir, uWindStrength, uPushB, uCenter, uExcl, uExclBox, uSee, uSeeCat)
   * @param {number} [seed] random seed of the instances
   */
  constructor(uniforms, seed = 1) {
    this.shared = uniforms;
    // Cat passage (see `catBend`, `update`): JS state and grass-specific uniforms.
    this.cat = { x: 0, z: 0, heading: 0, motion: 0, contact: 1, paws: Array.from({ length: PAW.count }, () => ({ x: NO_PAW, z: 0, tDown: -1e4, tUp: 0 })) };
    this._catObj = null;   // cat given to `setCat` (paw bones, heading)
    this._legs = null;     // [{ name, bone, down, thr }]
    this.pawLog = [];      // recent plants and lifts (measurements)
    this._last = null;      // last seen position { x, z, t }
    this._lastStep = null;  // position at the last heading update { x, z }
    this._speed = 0;
    const catUniforms = {
      uCat: { value: new THREE.Vector4(0, 0, 0, 0) },
      uCatBox: { value: new THREE.Vector4(1, 0, 0, BODY.back + BODY.reach) },
      uPaws: { value: Array.from({ length: PAW.count }, () => new THREE.Vector4(NO_PAW, 0, -1e4, 0)) },
    };
    this.catUniforms = catUniforms;
    this.layers = [];
    this.group = new THREE.Group();
    this.group.name = 'Grass';
    LAYERS.forEach((layer, li) => {
      Object.entries(layer.kinds).forEach(([kind, cfg], ki) => {
        const info = KIND_INFO[kind];
        const rand = rng(seed * 7919 + li * 104729 + ki * 1299709);
        const blades = kind === 'seed'
          ? seedSet(cfg.stems, cfg.leaves, PROFILES[cfg.profile], rand)
          : bladeSet(kind, cfg.n, PROFILES[cfg.profile], rand);
        const g = clumpGeometry(blades);
        const blade = new Float32Array(cfg.count * 4);
        const shape = new Float32Array(cfg.count * 4);
        const tint = new Float32Array(cfg.count * 4);
        for (let i = 0; i < cfg.count; i++) {
          blade.set([(rand() * 2 - 1) * layer.half, (rand() * 2 - 1) * layer.half, rand() * Math.PI * 2, rand()], i * 4);
          // Height x0.75 to 1.25; width x0.85 to 1.15; the bunch's own bend.
          shape.set([0.75 + 0.5 * rand(), 0.85 + 0.3 * rand(), rand() * Math.PI * 2, 0.03 + 0.1 * rand()], i * 4);
          const tipHex = rand() < info.warmRate ? info.warm : info.tips[Math.floor(rand() * info.tips.length)];
          const c = jitter(tipHex, 0.05, rand);
          tint.set([c.r, c.g, c.b, 0.93 + 0.12 * rand()], i * 4);
        }
        g.setAttribute('aBlade', new THREE.InstancedBufferAttribute(blade, 4));
        g.setAttribute('aShape', new THREE.InstancedBufferAttribute(shape, 4));
        g.setAttribute('aTint', new THREE.InstancedBufferAttribute(tint, 4));
        g.instanceCount = cfg.count;

        const own = {
          uLayer: { value: new THREE.Vector4(layer.half, layer.fadeIn?.[0] ?? 0, layer.fadeIn?.[1] ?? 0, cfg.width) },
          uFadeOut: { value: new THREE.Vector2(layer.fadeOut[0], layer.fadeOut[1]) },
          uKind: { value: new THREE.Vector4(info.id, info.radius, 0, 0) },
          uKBase: { value: color(info.base) },
          uKHead: { value: color(info.head ?? info.base) },
        };
        const mat = toonMaterial(0xffffff, { vertexColors: true, side: THREE.DoubleSide });
        mat.onBeforeCompile = (shader) => {
          Object.assign(shader.uniforms, uniforms, catUniforms, own);
          let vs = shader.vertexShader;
          vs = inject(vs, '#include <common>', VERTEX_HEAD);
          vs = inject(vs, '#include <beginnormal_vertex>', VERTEX_BLADE, true);
          vs = inject(vs, '#include <begin_vertex>', 'vec3 transformed = gPos;', true);
          shader.vertexShader = vs;
          // No normal flip on the back face (the normal already points up).
          let fs = inject(shader.fragmentShader, '#include <normal_fragment_begin>',
            'normal = normalize( vNormal ); nonPerturbedNormal = normal;');
          // Dithering of the blades between the camera and the cat.
          fs = inject(fs, '#include <common>', FRAGMENT_HEAD);
          fs = inject(fs, '#include <clipping_planes_fragment>', FRAGMENT_SEE);
          shader.fragmentShader = fs;
        };
        mat.customProgramCacheKey = () => 'lost-grass-blades';

        const mesh = new THREE.Mesh(g, mat);
        mesh.name = `Grass_${layer.name}_${kind}`;
        mesh.frustumCulled = false; // position computed in the shader: the bounding sphere is wrong
        mesh.receiveShadow = layer.receiveShadow; // cat shadow on the near layer only
        mesh.castShadow = false;
        mesh.raycast = () => {}; // never hit by a Raycaster (ground click in Picker.js)
        this.group.add(mesh);
        this.layers.push({ layer, kind, cfg, mesh, geometry: g, own, trianglesPer: g.index.count / 3 });
      });
    });
  }

  /**
   * Cat followed by the grass: paws are read from the bones (`cat.rig.legs`, read only), heading from `cat.root.rotation.y`.
   * Without a call (or with null): the body is pushed aside at the point given to `update`, with no prints.
   */
  setCat(cat) {
    this._catObj = cat ?? null;
    this._clearPaws();
    const legs = cat?.rig?.legs;
    this._legs = legs
      ? ['FL', 'FR', 'BL', 'BR'].filter((k) => legs[k]).map((k) => ({ name: k, bone: pawHolder(legs[k]), down: false, thr: k[0] === 'F' ? PAW.down.F : PAW.down.B })).filter((l) => l.bone)
      : null;
  }

  /**
   * Every frame, AFTER `Meadow.update` (which advances `uTime`) and `cat.update` (bones up to date). Maintains heading,
   * smoothed speed, ground contact and prints, then copies the state to the uniforms. No wake: the grass stands behind the cat.
   * @param {THREE.Vector3} catPos cat position (`cat.root.position`)
   */
  update(catPos) {
    const time = this.shared.uTime.value;
    const c = this.cat;
    const ground = groundAt(catPos.x, catPos.z);
    c.contact = 1 - sstep(BODY.airborne[0], BODY.airborne[1], catPos.y - ground);
    const last = this._last;
    if (last && Math.hypot(catPos.x - last.x, catPos.z - last.z) > BODY.maxJump) {
      // Teleport (new game, end screen...): speed, heading and prints restart from zero.
      this._lastStep = null;
      this._speed = 0;
      this._clearPaws();
    } else if (last && time > last.t) {
      const dt = time - last.t;
      const inst = Math.hypot(catPos.x - last.x, catPos.z - last.z) / dt;
      this._speed += (inst - this._speed) * (1 - Math.exp(-6 * dt));
    }
    this._last = { x: catPos.x, z: catPos.z, t: time };
    c.x = catPos.x; c.z = catPos.z;
    c.motion = Math.min(this._speed / BODY.fullSpeed, 1);
    if (this._catObj) {
      // Cat forward = (sin yaw, cos yaw); grass heading h such that (cos h, sin h) = forward.
      const yaw = this._catObj.root.rotation.y;
      c.heading = Math.atan2(Math.cos(yaw), Math.sin(yaw));
    } else {
      const step = this._lastStep;
      if (!step) this._lastStep = { x: catPos.x, z: catPos.z };
      else if (Math.hypot(catPos.x - step.x, catPos.z - step.z) >= HEADING_STEP) {
        c.heading = Math.atan2(catPos.z - step.z, catPos.x - step.x);
        this._lastStep = { x: catPos.x, z: catPos.z };
      }
    }
    this._stepPaws(time, c.contact);
    // Bounding circle (fast test in the shader: nothing to compute far from the cat).
    let r = BODY.back + BODY.reach;
    for (const p of c.paws) {
      if (p.x !== NO_PAW && (p.tUp < 0 || time - p.tUp < PAW.life / 0.85)) r = Math.max(r, Math.hypot(p.x - c.x, p.z - c.z) + PAW.reach);
    }
    this.catUniforms.uCat.value.set(c.x, c.z, c.heading, c.motion);
    this.catUniforms.uCatBox.value.set(c.contact, c.x, c.z, r + 0.01);
    const U = this.catUniforms.uPaws.value;
    c.paws.forEach((p, i) => U[i].set(p.x, p.z, p.tDown, p.tUp));
  }

  /**
   * Prints: a paw is planted when its bone drops below the threshold (front or rear), lifted above threshold + PAW.hyst or
   * when the cat leaves the ground. Slot 2i: current print of paw i (follows the bone while planted); 2i + 1: the previous
   * one, recovering.
   */
  _stepPaws(time, contact) {
    if (!this._legs) return;
    const P = this.cat.paws;
    this._legs.forEach((leg, i) => {
      leg.bone.getWorldPosition(_v);
      const h = _v.y - groundAt(_v.x, _v.z);
      const cur = P[2 * i], prev = P[2 * i + 1];
      if (!leg.down) {
        if (h < leg.thr && contact > 0.5) {
          leg.down = true;
          Object.assign(prev, cur);
          cur.x = _v.x; cur.z = _v.z; cur.tDown = time; cur.tUp = -1;
          this._log(leg.name, 'plant', time, h);
        }
      } else {
        cur.x = _v.x; cur.z = _v.z;
        if (h > leg.thr + PAW.hyst || contact <= 0.5) {
          leg.down = false;
          cur.tUp = time;
          this._log(leg.name, 'lift', time, h);
        }
      }
    });
  }

  _clearPaws() {
    for (const p of this.cat.paws) { p.x = NO_PAW; p.z = 0; p.tDown = -1e4; p.tUp = 0; }
    if (this._legs) for (const l of this._legs) l.down = false;
  }

  /** Log of plants and lifts (at most 48 entries), for measurements (`pawLog`). */
  _log(leg, ev, t, h) {
    this.pawLog.push({ leg, ev, t: +t.toFixed(3), h: +h.toFixed(4) });
    if (this.pawLog.length > 48) this.pawLog.shift();
  }

  /** Share of bunches drawn (0 to 1); the remaining blades widen to keep the coverage. */
  setDensity(fraction) {
    const f = Math.min(Math.max(fraction, 0.05), 1);
    for (const l of this.layers) {
      l.geometry.instanceCount = Math.round(l.cfg.count * f);
      l.own.uLayer.value.w = l.cfg.width * Math.min(1.5, 1 / Math.sqrt(f));
    }
  }

  /** Total number of bunches (all layers and families). */
  get total() {
    return this.layers.reduce((s, l) => s + l.cfg.count, 0);
  }

  /** Number of bunches currently drawn (sum over the layers). */
  get drawn() {
    return this.layers.reduce((s, l) => s + l.geometry.instanceCount, 0);
  }

  /** Triangles currently drawn. */
  get triangles() {
    return this.layers.reduce((s, l) => s + l.geometry.instanceCount * l.trianglesPer, 0);
  }
}

const _v = new THREE.Vector3();
