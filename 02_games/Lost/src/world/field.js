/**
 * Meadow field: grass height, wind and parting of the grass around the cat. Used by Grass.js, Flowers.js and Meadow.js;
 * MEADOW_LIMIT is also read by Brain.js, the critters and the minimap.
 * Each formula exists twice, in GLSL (grass blades, flowers) and in JS (gameplay: butterflies, yarn ball, tests): any
 * change must be made on both sides.
 *
 * Units: metres. The cat is 0.8 m from nose to tail tip, head at 0.54 m when standing, and starts at the origin.
 */

// Clearing around the start point: short grass up to CLEAR_INNER, tall beyond CLEAR_OUTER.
export const CLEAR_INNER = 2.2;
export const CLEAR_OUTER = 6.0;
// Mean grass height (before the per-blade variation, x0.7 to x1.25).
export const SHORT_MIN = 0.10, SHORT_VAR = 0.08; // clearing: 0.10 to 0.18 m
export const TALL_MIN = 0.80, TALL_VAR = 0.40;   // meadow: 0.80 to 1.20 m (cat head: 0.54 m)

/**
 * Meadow limit: radius (m) around the origin that neither the cat nor the yarn ball crosses (enforced by Brain.js,
 * Yarn.js and Butterfly.js). Slightly inside FIELD_RADIUS = MEADOW_LIMIT + 2 (Flowers.js), so flowers remain visible
 * beyond it. The ground rises gently from there (Terrain.js rim): the limit reads in the scenery, with no wall.
 */
export const MEADOW_LIMIT = 40;

const f = (x) => x.toFixed(4);

function smoothstep(a, b, x) {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
}

/**
 * Wind at (x, z) at time t: horizontal offset of a stem tip per metre of height. `dir`: unit direction {x, z},
 * `strength`: force (0.22 by default). Gusts travelling across the field (waves) plus a fast flutter.
 */
export function windAt(x, z, t, dir, strength, out = { x: 0, z: 0 }) {
  const px = -dir.z, pz = dir.x;
  const a = x * dir.x + z * dir.z;
  const b = x * px + z * pz;
  const gust = 0.5 + 0.5 * Math.sin(a * 0.45 - t * 1.25 + 1.5 * Math.sin(b * 0.3 + t * 0.21));
  const flutter = Math.sin(t * 2.7 + a * 1.3 + b * 0.9);
  const s = strength * (0.3 + 0.7 * gust);
  const along = s * (1 + 0.25 * flutter);
  const side = 0.06 * strength * flutter;
  out.x = dir.x * along + px * side;
  out.z = dir.z * along + pz * side;
  return out;
}

/**
 * Parting by a source (cat or camera): `src` = {x, z, radius, strength}.
 * Returns the horizontal tip offset per metre of height, pointing away from the source.
 */
export function pushFrom(x, z, src, out = { x: 0, z: 0 }) {
  const dx = x - src.x, dz = z - src.z;
  const L = Math.hypot(dx, dz);
  const k = (1 - smoothstep(0, src.radius, L)) * src.strength;
  out.x = L > 1e-4 ? dx / L * k : 0;
  out.z = L > 1e-4 ? dz / L * k : 0;
  return out;
}

/** Same code in GLSL. Expected uniforms: uTime, uWindDir, uWindStrength, uPushB (camera). The cat goes through Grass.js `catBend`. */
export const GLSL_FIELD = /* glsl */ `
uniform float uTime;
uniform vec2 uWindDir;
uniform float uWindStrength;
uniform vec4 uPushB; // camera: x, z, radius, strength

float fieldHeight(vec2 p) {
  float n = 0.5 + 0.25 * (sin(p.x * 0.31 + p.y * 0.17) + sin(p.y * 0.29 - p.x * 0.13 + 1.7));
  float t = smoothstep(${f(CLEAR_INNER)}, ${f(CLEAR_OUTER)}, length(p));
  return mix(${f(SHORT_MIN)} + ${f(SHORT_VAR)} * n, ${f(TALL_MIN)} + ${f(TALL_VAR)} * n, t);
}

vec2 windAt(vec2 p, float t) {
  vec2 D = uWindDir;
  vec2 P = vec2(-D.y, D.x);
  float a = dot(p, D);
  float b = dot(p, P);
  float gust = 0.5 + 0.5 * sin(a * 0.45 - t * 1.25 + 1.5 * sin(b * 0.3 + t * 0.21));
  float flutter = sin(t * 2.7 + a * 1.3 + b * 0.9);
  float s = uWindStrength * (0.3 + 0.7 * gust);
  return D * (s * (1.0 + 0.25 * flutter)) + P * (0.06 * uWindStrength * flutter);
}

vec2 pushOne(vec2 p, vec4 src) {
  vec2 d = p - src.xy;
  float L = length(d);
  float k = (1.0 - smoothstep(0.0, src.z, L)) * src.w;
  return L > 1e-4 ? d / L * k : vec2(0.0);
}
`;

/** Inserts `code` after `token` in `src` (or replaces `token` if `replace`); throws if `token` is missing (three.js version changed). */
export function inject(src, token, code, replace = false) {
  if (!src.includes(token)) throw new Error(`world: insertion point missing from shader: ${token}`);
  return src.replace(token, replace ? code : `${token}\n${code}`);
}
