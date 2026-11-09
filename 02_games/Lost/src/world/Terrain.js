import * as THREE from 'three';
import { MEADOW_LIMIT } from './field.js';
import { GROUND, color } from '../style/palette.js';
import { ZONE2, mountainHeight } from './zone2.js';

/**
 * Ground relief of both zones; `heightAt` is read by nearly every system that stands on the ground.
 *
 * - `heightAt(x, z)`: GROUND height in metres (not `Meadow.heightAt`, which returns the height of the GRASS).
 *   `normalAt(x, z, out)`: unit ground normal. Pure functions, no DOM; the same formula exists in GLSL (`GLSL_TERRAIN`)
 *   to lay the grass on the relief in the shader: any change must be made on both sides.
 * - Start clearing: h = 0 exactly up to CLEARING_FLAT from (0, 0), full relief beyond CLEARING_FULL.
 * - Bumps: three crossed waves (about 27 m, 16 m and 7 m), total range <= 0.94 m by construction.
 * - Rim: beyond MEADOW_LIMIT (field.js) the ground rises gently to RIM_HEIGHT: the limit reads in the scenery, no wall.
 * - Spur: at +X the ground stays flat up to the meadow limit (SPUR.flatEnd, where the rampart stands), then rises towards
 *   the background mountain of Mountains.js, which emerges from this ground in the fog. Bumps are reduced along the axis.
 * - Zone 2: beyond ZONE2.switchX, `heightAt` returns the snowy mountain of zone2.js, chosen by position alone.
 *   `GLSL_TERRAIN` does not carry this branch: only the grass reads it, and grass is not drawn in zone 2.
 * - Moat: `MOAT`, dug in `heightAt` and `GLSL_TERRAIN`; the bridge lane stays undug for walking, dug in the mesh.
 *
 * Mesh: `Terrain` (one geometry, grid of TERRAIN_SEGMENTS^2 cells over +/-TERRAIN_SIZE, slightly denser at the centre,
 * its edge hidden by fog). Clicks (Picker.js) hit it through an analytic raycast on `heightAt` (ray marching then
 * bisection): constant cost instead of testing every triangle.
 */

export const CLEARING_FLAT = 3.0;   // m: ground exactly flat within this radius around (0, 0)
export const CLEARING_FULL = 8.0;   // m: full relief beyond
export const BUMP_OFFSET = 0.1;     // m: slightly more bumps than hollows
export const RIM_START = MEADOW_LIMIT - 1;   // m: the rim starts 1 m before the limit
export const RIM_END = MEADOW_LIMIT + 16;    // m: rim at full height
export const RIM_HEIGHT = 1.6;               // m: mean rim height (x0.7 to x1.3 by location)
// Large enough for the mesh edge to stay beyond the fog (World.js) when seen from the edge of the zone.
export const TERRAIN_SIZE = 96;              // m: half side of the mesh
export const TERRAIN_SEGMENTS = 192;

/**
 * Spur at +X (m). Profile along x: 0 up to `flatEnd` (the meadow limit: no shelf in the play area), smoothstep rise of
 * `height` up to `top`, plus `rise` x t^1.5 with t = (x - flatEnd) / riseLen. The background mountains of Mountains.js
 * connect to these heights. Width: full in |z| <= wIn + wInGrow * (x - start), zero beyond
 * wIn + wBand + (wInGrow + wBandGrow) * (x - start). `start`: where the mask and the bump reduction begin, giving nearly
 * flat ground from x = 22 to the limit (rampart foundation).
 */
export const SPUR = {
  start: 22, flatEnd: MEADOW_LIMIT, top: 60, height: 2.2, rise: 12, riseLen: 47,
  wIn: 3, wInGrow: 0.15, wBand: 10, wBandGrow: 0.25, bumpKeep: 0.15,
};

/**
 * Moat of the rampart (Rampart.js), which gives the drawbridge a purpose: `x0` to `x1` in front of the curtain wall,
 * over |z| <= `zEnd`, `depth` deep, `ramp` slopes. `road`: half width of the bridge lane. The walking surface
 * (`heightAt`, read by Brain and clicks) is not dug there, so the cat walks flat on the bridge and a click on it lands
 * at the right point; the drawn mesh (`visualHeightAt`) is dug everywhere, so the hole exists under the bridge. The
 * grass shader follows `heightAt`, lane undug (`step(MOAT.road, az)` in `GLSL_TERRAIN`).
 */
export const MOAT = { x0: 30.6, x1: 33.6, ramp: 0.7, depth: 1.0, zEnd: 13.7, road: 1.3 };

/**
 * End of the spur in the drawn mesh. Fully in fog and horizon-coloured, the spur up to the mesh edge (x = 96, 19.7 m)
 * read as a smooth dome in front of the rock of Mountains.js, so the mesh alone sinks from `x0` to `x1`, out of the
 * cat's reach; `heightAt`, clicks and grass (`GLSL_TERRAIN`) are unaffected. The drawn crest line stays at `x0`, 9.1 m
 * high on the axis, hidden by the rampart when seen from the meadow.
 */
export const SPUR_SINK = { x0: 66, x1: 82 };

const EPS = 0.1; // m: finite-difference step of the normal

function smoothstep(a, b, x) {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
}

/** Raw bumps (without clearing or rim), from -0.37 to +0.57 m at most. */
function bumps(x, z) {
  const a = Math.sin(0.23 * x + 0.7) * Math.sin(0.19 * z + 1.9);
  const u = 0.8 * x + 0.6 * z, v = -0.6 * x + 0.8 * z;
  const b = Math.sin(0.41 * u + 2.3) * Math.sin(0.37 * v + 0.4);
  const c = Math.sin(0.93 * x - 0.53 * z + 1.1);
  return 0.28 * a + 0.15 * b + 0.04 * c + BUMP_OFFSET;
}

/** Lateral mask of the spur (1 on the axis, 0 on the sides). */
function spurLateral(x, z) {
  const d = Math.max(0, x - SPUR.start);
  const wIn = SPUR.wIn + SPUR.wInGrow * d;
  return 1 - smoothstep(wIn, wIn + SPUR.wBand + SPUR.wBandGrow * d, Math.abs(z));
}

/** Spur profile along x (m), without the lateral mask. */
function spurProfile(x) {
  const t = Math.max(0, x - SPUR.flatEnd) / SPUR.riseLen;
  return SPUR.height * smoothstep(SPUR.flatEnd, SPUR.top, x) + SPUR.rise * t * Math.sqrt(t);
}

/** Own height of the spur at (x, z) (m), without bumps or rim. */
function spurHeight(x, z) {
  return spurProfile(x) * spurLateral(x, z);
}

/** Share of the bumps kept (1 off the spur, SPUR.bumpKeep on it). */
function bumpKeep(x, z) {
  return 1 - (1 - SPUR.bumpKeep) * spurLateral(x, z) * smoothstep(SPUR.start - 4, SPUR.start + 2, x);
}

/** Rim beyond the limit (m). */
function rimAt(x, z, r) {
  const rimVar = 1 + 0.3 * Math.sin(0.21 * x + 0.5) * Math.cos(0.17 * z - 0.8);
  return RIM_HEIGHT * rimVar * smoothstep(RIM_START, RIM_END, r);
}

/** Moat depth at (x, z) (m), 0 outside the moat. */
function moatDig(x, z) {
  const az = Math.abs(z);
  if (x < MOAT.x0 || x > MOAT.x1 || az > MOAT.zEnd) return 0;
  return MOAT.depth * smoothstep(MOAT.x0, MOAT.x0 + MOAT.ramp, x)
    * (1 - smoothstep(MOAT.x1 - MOAT.ramp, MOAT.x1, x))
    * (1 - smoothstep(MOAT.zEnd - MOAT.ramp, MOAT.zEnd, az));
}

/** Meadow without the moat (m). */
function meadowHeight(x, z) {
  const r = Math.hypot(x, z);
  const h = bumps(x, z) * smoothstep(CLEARING_FLAT, CLEARING_FULL, r) * bumpKeep(x, z);
  return h + rimAt(x, z, r) + spurHeight(x, z);
}

/** Ground height at (x, z), in metres (walking surface: the bridge lane is not dug). */
export function heightAt(x, z) {
  if (x > ZONE2.switchX) return mountainHeight(x, z);
  const h = meadowHeight(x, z);
  return Math.abs(z) <= MOAT.road ? h : h - moatDig(x, z);
}

/** Height of the drawn mesh: like `heightAt`, but the moat is also dug under the bridge and the end of the spur sinks (`SPUR_SINK`). */
export function visualHeightAt(x, z) {
  if (x > ZONE2.switchX) return mountainHeight(x, z);
  return meadowHeight(x, z) - moatDig(x, z) - spurHeight(x, z) * smoothstep(SPUR_SINK.x0, SPUR_SINK.x1, x);
}

/** Unit ground normal at (x, z) (central finite differences, step EPS). */
export function normalAt(x, z, out = new THREE.Vector3()) {
  const dx = (heightAt(x + EPS, z) - heightAt(x - EPS, z)) / (2 * EPS);
  const dz = (heightAt(x, z + EPS) - heightAt(x, z - EPS)) / (2 * EPS);
  return out.set(-dx, 1, -dz).normalize();
}

const f = (x) => x.toFixed(4);

/**
 * Same formula in GLSL: `float terrainHeight(vec2 p)` and `vec3 terrainNormal(vec2 p)`, with p = world (x, z).
 * No uniforms. Insert once per shader (after `#include <common>`).
 */
export const GLSL_TERRAIN = /* glsl */ `
float terrainBumps(vec2 p) {
  float a = sin(0.23 * p.x + 0.7) * sin(0.19 * p.y + 1.9);
  vec2 uv = vec2(0.8 * p.x + 0.6 * p.y, -0.6 * p.x + 0.8 * p.y);
  float b = sin(0.41 * uv.x + 2.3) * sin(0.37 * uv.y + 0.4);
  float c = sin(0.93 * p.x - 0.53 * p.y + 1.1);
  return 0.28 * a + 0.15 * b + 0.04 * c + ${f(BUMP_OFFSET)};
}
float terrainSpurLateral(vec2 p) {
  float d = max(0.0, p.x - ${f(SPUR.start)});
  float wIn = ${f(SPUR.wIn)} + ${f(SPUR.wInGrow)} * d;
  return 1.0 - smoothstep(wIn, wIn + ${f(SPUR.wBand)} + ${f(SPUR.wBandGrow)} * d, abs(p.y));
}
float terrainHeight(vec2 p) {
  float r = length(p);
  float lat = terrainSpurLateral(p);
  float keep = 1.0 - ${f(1 - SPUR.bumpKeep)} * lat * smoothstep(${f(SPUR.start - 4)}, ${f(SPUR.start + 2)}, p.x);
  float h = terrainBumps(p) * smoothstep(${f(CLEARING_FLAT)}, ${f(CLEARING_FULL)}, r) * keep;
  float rimVar = 1.0 + 0.3 * sin(0.21 * p.x + 0.5) * cos(0.17 * p.y - 0.8);
  float t = max(0.0, p.x - ${f(SPUR.flatEnd)}) / ${f(SPUR.riseLen)};
  float spur = (${f(SPUR.height)} * smoothstep(${f(SPUR.flatEnd)}, ${f(SPUR.top)}, p.x) + ${f(SPUR.rise)} * t * sqrt(t)) * lat;
  float az = abs(p.y);
  float dig = ${f(MOAT.depth)} * smoothstep(${f(MOAT.x0)}, ${f(MOAT.x0 + MOAT.ramp)}, p.x)
    * (1.0 - smoothstep(${f(MOAT.x1 - MOAT.ramp)}, ${f(MOAT.x1)}, p.x))
    * (1.0 - smoothstep(${f(MOAT.zEnd - MOAT.ramp)}, ${f(MOAT.zEnd)}, az))
    * step(${f(MOAT.road)}, az);
  return h + ${f(RIM_HEIGHT)} * rimVar * smoothstep(${f(RIM_START)}, ${f(RIM_END)}, r) + spur - dig;
}
vec3 terrainNormal(vec2 p) {
  float dx = (terrainHeight(p + vec2(${f(EPS)}, 0.0)) - terrainHeight(p - vec2(${f(EPS)}, 0.0))) / ${f(2 * EPS)};
  float dz = (terrainHeight(p + vec2(0.0, ${f(EPS)})) - terrainHeight(p - vec2(0.0, ${f(EPS)}))) / ${f(2 * EPS)};
  return normalize(vec3(-dx, 1.0, -dz));
}
`;

/**
 * Grid coordinate, slightly denser at the centre: u in [-1, 1] to metres (slope 0.75 at the centre, 2.0 at the edge),
 * nearly regular inside the 40 m play area.
 */
export function warp(u, size) {
  const u2 = u * u;
  return size * (0.75 * u + 0.25 * u * u2 * u2);
}

/**
 * Ground geometry: vertices on `visualHeightAt` with matching normals, per-vertex colour (light clearing green
 * `GROUND.center` to `GROUND.edge` far away, crests slightly lighter, hollows slightly deeper).
 */
function terrainGeometry(size = TERRAIN_SIZE, segments = TERRAIN_SEGMENTS) {
  const n = segments + 1;
  const pos = new Float32Array(n * n * 3);
  const nrm = new Float32Array(n * n * 3);
  const col = new Float32Array(n * n * 3);
  const center = color(GROUND.center), edge = color(GROUND.edge);
  const light = color(GROUND.center).lerp(color(0xfff4c8), 0.25);
  const deep = color(GROUND.edge).lerp(color(0x5f9a5a), 0.3);
  const c = new THREE.Color(), nv = new THREE.Vector3();
  for (let j = 0; j < n; j++) {
    const z = warp((j / segments) * 2 - 1, size);
    for (let i = 0; i < n; i++) {
      const x = warp((i / segments) * 2 - 1, size);
      const k = (j * n + i) * 3;
      const h = visualHeightAt(x, z);
      pos[k] = x; pos[k + 1] = h; pos[k + 2] = z;
      // Mesh normal: same digging as its height (moat included under the bridge).
      nv.set(visualHeightAt(x - EPS, z) - visualHeightAt(x + EPS, z), 2 * EPS, visualHeightAt(x, z - EPS) - visualHeightAt(x, z + EPS)).normalize();
      nrm[k] = nv.x; nrm[k + 1] = nv.y; nrm[k + 2] = nv.z;
      c.copy(center).lerp(edge, smoothstep(2, 14, Math.hypot(x, z)));
      // Bumps (excluding rim and spur): lighter crests, deeper hollows.
      const b = h - rimAt(x, z, Math.hypot(x, z)) - spurHeight(x, z) * (1 - smoothstep(SPUR_SINK.x0, SPUR_SINK.x1, x));
      if (b > 0) c.lerp(light, Math.min(b / 0.5, 1) * 0.5);
      else c.lerp(deep, Math.min(-b / 0.4, 1) * 0.5);
      col[k] = c.r; col[k + 1] = c.g; col[k + 2] = c.b;
    }
  }
  const idx = new Uint32Array(segments * segments * 6);
  let t = 0;
  for (let j = 0; j < segments; j++) {
    for (let i = 0; i < segments; i++) {
      const a = j * n + i, b = a + 1, cc = a + n, d = cc + 1;
      // Counter-clockwise seen from above (front-face normal towards +y).
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
  return g;
}

const _p = new THREE.Vector3();

/**
 * Analytic raycast on `heightAt` (replaces the Mesh's own): marches along the ray with a step growing with distance
 * (5 cm at the start, about 2 m at 100 m), then 24 bisections. Only hits inside the mesh (`bounds` { x0, x1, z0, z1,
 * far }). Result: { distance, point, object, face: null } (Picker.js only uses `point`).
 * Used by both zones: Terrain here, Mountain.js for zone 2.
 */
export function raycastGround(bounds) {
  return function raycast(raycaster, intersects) {
    const { origin: o, direction: d } = raycaster.ray;
    const far = Math.min(raycaster.far, bounds.far);
    let t0 = raycaster.near;
    const gap = (t) => o.y + d.y * t - heightAt(o.x + d.x * t, o.z + d.z * t);
    if (gap(t0) <= 0) return; // origin below the ground
    while (t0 < far) {
      const t1 = Math.min(t0 + 0.05 + 0.02 * t0, far);
      const g1 = gap(t1);
      if (g1 <= 0) {
        let lo = t0, hi = t1;
        for (let k = 0; k < 24; k++) {
          const mid = 0.5 * (lo + hi);
          if (gap(mid) > 0) lo = mid; else hi = mid;
        }
        _p.copy(d).multiplyScalar(hi).add(o);
        if (_p.x < bounds.x0 || _p.x > bounds.x1 || _p.z < bounds.z0 || _p.z > bounds.z1) return;
        intersects.push({ distance: hi, point: _p.clone(), object: this, face: null });
        return;
      }
      t0 = t1;
    }
  };
}

/**
 * Relief ground, fixed in the world: `terrain.mesh` (Mesh named "Terrain", receives shadows, matte Lambert material with
 * per-vertex colours), `terrain.heightAt`, `terrain.normalAt`.
 */
export class Terrain {
  constructor({ size = TERRAIN_SIZE, segments = TERRAIN_SEGMENTS } = {}) {
    this.size = size;
    this.geometry = terrainGeometry(size, segments);
    this.material = new THREE.MeshLambertMaterial({ vertexColors: true });
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.name = 'Terrain';
    this.mesh.receiveShadow = true;
    this.mesh.raycast = raycastGround({ x0: -size, x1: size, z0: -size, z1: size, far: 3 * size });
  }

  heightAt(x, z) { return heightAt(x, z); }

  normalAt(x, z, out) { return normalAt(x, z, out); }

  /** Mesh triangles. */
  get triangles() { return this.geometry.index.count / 3; }
}
