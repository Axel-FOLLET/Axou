import * as THREE from 'three';
import { color } from '../style/palette.js';
import { PAINT_MARK } from './npcTuning.js';

/**
 * Dried purple paint mark on the flank of an NPC (Maman's, from `def.paintMark`). Part of `Npc` (mixin): adds
 * `setPaintMark(on)` and the `paintMarkState` getter.
 *
 * - The mark is painted into the fur itself: the body material and the 18 fur shells get a few lines of shader
 *   (`patch`) that recolour the pixels falling inside an irregular blob. The blob is defined in the rest-pose space
 *   of the mesh (the `position` attribute, like the hair pattern of Fur.js), so it follows every clip and the sitting
 *   pose without any per-frame work.
 * - Matte: the coat rim light and tint are removed under the paint and its roughness goes to 1. The colour is a
 *   faded violet with a darker rim, far from the saturated red of the boss coat or of blood.
 * - All values (colour, size, flank, position) are in PAINT_MARK (npcTuning.js).
 */

const FRONT = new THREE.Vector3(0, 0, 1);
const UP = new THREE.Vector3(0, 1, 0);
const RIGHT = new THREE.Vector3(1, 0, 0);

/** Direction of a world axis in the bind space of the mesh (same frame as `position`), as Fur.js does. */
function bindAxis(mesh, worldDir) {
  return worldDir.clone().transformDirection(mesh.bindMatrix.clone().invert());
}

/**
 * Centre and axes of the mark on the rest mesh: slice of the trunk (vertices weighted on `Spine*`/`Hip`) at `along`
 * of its length, point at `height` of the slice, then the outermost vertex of that level on the chosen flank.
 * @returns {{center: THREE.Vector3, front: THREE.Vector3, up: THREE.Vector3, out: THREE.Vector3, length: number}|null}
 *   bind-space values; null if the trunk cannot be measured
 */
function measureFlank(body) {
  const T = PAINT_MARK;
  const geo = body.geometry;
  const pos = geo.attributes.position, si = geo.attributes.skinIndex, sw = geo.attributes.skinWeight;
  const bones = body.skeleton.bones;
  const front = bindAxis(body, FRONT), up = bindAxis(body, UP), out = bindAxis(body, RIGHT).multiplyScalar(T.side);
  const trunk = [];
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    let w = 0, total = 0;
    for (let k = 0; k < 4; k++) {
      const x = sw.getComponent(i, k);
      total += x;
      if (/^(Spine|Hip)/.test(bones[si.getComponent(i, k)]?.name ?? '')) w += x;
    }
    if (total <= 0 || w / total < 0.5) continue;
    v.fromBufferAttribute(pos, i);
    trunk.push({ a: v.dot(front), b: v.dot(up), c: v.dot(out) });
  }
  if (trunk.length < 50) return null;
  let a0 = Infinity, a1 = -Infinity;
  for (const t of trunk) { a0 = Math.min(a0, t.a); a1 = Math.max(a1, t.a); }
  const length = a1 - a0;
  const ac = a0 + T.along * length;
  const slice = trunk.filter((t) => Math.abs(t.a - ac) < 0.03 * length);
  if (slice.length < 8) return null;
  const lo = Math.min(...slice.map((t) => t.b)), hi = Math.max(...slice.map((t) => t.b));
  const bc = lo + T.height * (hi - lo);
  const level = slice.filter((t) => Math.abs(t.b - bc) < 0.04 * length);
  if (!level.length) return null;
  const cc = Math.max(...level.map((t) => t.c));
  const center = front.clone().multiplyScalar(ac).addScaledVector(up, bc).addScaledVector(out, cc);
  return { center, front, up, out, length };
}

const GLSL_HEAD = /* glsl */`
uniform float paintOn;
uniform vec3 paintC;
uniform vec3 paintF;
uniform vec3 paintU;
uniform vec3 paintS;
uniform vec2 paintR;
uniform float paintDepth;
uniform vec3 paintColor;
uniform vec3 paintEdge;
varying vec3 vPaintPos;
float paintHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float paintNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(paintHash(i), paintHash(i + vec2(1.0, 0.0)), f.x), mix(paintHash(i + vec2(0.0, 1.0)), paintHash(i + vec2(1.0, 1.0)), f.x), f.y);
}
// x: coverage (crisp edge), y: depth inside the blob (0 at the edge, 1 at the centre), z: mottling. Blob coordinates
// q are in blob radii (x along the body, y up): irregular main blob, a run below it and three satellite drops.
vec3 paintMark(vec3 p) {
  vec3 d = p - paintC;
  vec2 q = vec2(dot(d, paintF) / paintR.x, dot(d, paintU) / paintR.y);
  float flank = smoothstep(-2.0 * paintDepth, -paintDepth, dot(d, paintS));
  float wob = (paintNoise(q * 2.3 + 3.1) - 0.5) * ${PAINT_MARK.wobble[0].toFixed(2)} + (paintNoise(q * 6.1 + 7.7) - 0.5) * ${PAINT_MARK.wobble[1].toFixed(2)};
  float shape = length(q) + wob;
  float run = length(vec2(q.x - ${PAINT_MARK.drip[0].toFixed(2)} - 0.06 * sin(q.y * 5.0), q.y - clamp(q.y, -${PAINT_MARK.drip[1].toFixed(2)}, -0.6))) / ${PAINT_MARK.drip[2].toFixed(2)} + wob * 0.4;
  shape = min(shape, run);
  shape = min(shape, length(q - vec2(-1.25, 0.55)) / 0.2 + wob * 0.5);
  shape = min(shape, length(q - vec2(1.4, -0.25)) / 0.15 + wob * 0.5);
  shape = min(shape, length(q - vec2(-0.9, -1.05)) / 0.12 + wob * 0.5);
  float cover = (1.0 - smoothstep(0.9, 1.0, shape)) * flank;
  return vec3(cover, clamp(1.0 - shape, 0.0, 1.0), paintNoise(q * 11.0));
}
`;

/** Recolours pixels inside the mark; `shell` is the GLSL expression of the fur shell depth (0 on the skin). */
const glslApply = (shell) => /* glsl */`
{
  vec3 pm = paintMark(vPaintPos);
  float paintK = pm.x * paintOn;
  if (paintK > 0.0) {
    vec3 paintBase = mix(paintEdge, paintColor, smoothstep(0.0, 0.3, pm.y)) * (0.85 + 0.3 * pm.z);
    diffuseColor.rgb = mix(diffuseColor.rgb, paintBase * mix(${PAINT_MARK.roots.toFixed(2)}, 1.0, ${shell}), paintK);
    totalEmissiveRadiance *= 1.0 - ${PAINT_MARK.emissive.toFixed(2)} * paintK;
    roughnessFactor = mix(roughnessFactor, 1.0, paintK);
  }
}
`;

/**
 * Adds the mark to a fur material (body skin or shell), after the shader hooks of Fur.js, and gives it its own
 * program key.
 * @param {THREE.Material} mat
 * @param {object} uniforms shared uniform objects of the mark
 * @param {string} shell GLSL expression of the shell depth
 */
function patch(mat, uniforms, shell) {
  const furHook = mat.onBeforeCompile;
  const furKey = mat.customProgramCacheKey;
  mat.onBeforeCompile = (shader, renderer) => {
    furHook.call(mat, shader, renderer);
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = 'varying vec3 vPaintPos;\n' + shader.vertexShader
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvPaintPos = position;');
    shader.fragmentShader = GLSL_HEAD + shader.fragmentShader
      .replace('#include <lights_physical_fragment>', `${glslApply(shell)}#include <lights_physical_fragment>`);
  };
  mat.customProgramCacheKey = () => `${furKey.call(mat)}-paint`;
  mat.needsUpdate = true;
}

export const paintMark = {
  /** Builds the mark on the fur of this NPC (hidden until `setPaintMark(true)`); a warning if the trunk is not measurable. */
  _buildPaintMark() {
    const body = this.bodyMesh;
    const flank = measureFlank(body);
    if (!flank) { console.warn(`[npc] ${this.kind}: trunk not measured, no paint mark`); return; }
    // Bind-space units per metre: the mesh is scaled by the model fit (Fur.js divides its lengths the same way).
    const scale = body.getWorldScale(new THREE.Vector3()).x;
    const T = PAINT_MARK;
    const u = {
      paintOn: { value: 0 },
      paintC: { value: flank.center },
      paintF: { value: flank.front },
      paintU: { value: flank.up },
      paintS: { value: flank.out },
      paintR: { value: new THREE.Vector2(T.size[0], T.size[1]).multiplyScalar(this.sizeScale / scale) },
      paintDepth: { value: T.depth * this.sizeScale / scale },
      paintColor: { value: color(T.color) },
      paintEdge: { value: color(T.edge) },
    };
    patch(body.material, u, '0.0');
    this.fur.shells.forEach((s) => patch(s.material, u, 'furShell'));
    this._paint = { uniforms: u, trunk: flank.length };
    this.setPaintMark(true);
  },

  /**
   * Shows or hides the dried paint mark on the flank (visible by default on Maman).
   * @param {boolean} on
   * @returns {boolean} the new state; false if this NPC has no mark
   */
  setPaintMark(on) {
    if (!this._paint) return false;
    this._paint.uniforms.paintOn.value = on ? 1 : 0;
    return !!on;
  },

  /** Read-only state: `{ present, on }` (plain data). */
  get paintMarkState() {
    return { present: !!this._paint, on: !!this._paint && this._paint.uniforms.paintOn.value === 1 };
  },
};
