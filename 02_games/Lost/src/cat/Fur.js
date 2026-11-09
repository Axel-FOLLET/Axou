import * as THREE from 'three';
import { CAT, color } from '../style/palette.js';

/**
 * Shell fur: copies of the body mesh, each inflated a little further along the normal and pierced with holes so
 * that only hair cross-sections remain. Created by Cat.js and Npc.js (optional belly colour).
 *
 * - Each shell is a SkinnedMesh sharing the body's geometry and skeleton: the fur follows every clip at no CPU cost.
 * - The offset is applied in bind space (before skinning): rest normal, combing toward the tail with a slight
 *   droop, small wind sway.
 * - Hairs are a 3D cellular pattern on the vertex rest position (stable in animation, no UV seams): one hair per
 *   cell, random height, thinner toward the tip.
 * - Length depends on the bones carrying the vertex (`LENGTH_BY_BONE`): short on the muzzle, ears and legs, longer
 *   on the trunk, neck and tail.
 */
const SHELLS = 18;          // number of shells (24 slowed the animations too much)
const MAX_LENGTH = 0.022;   // m, reference length (factor 1 of LENGTH_BY_BONE)
const SPACING = 0.0013;     // m between two hairs
// Black coat: the original texture only modulates the tint slightly; tips are slightly rufous in the sun, like a
// real black cat. Colours come from palette.js.
const COAT = color(CAT.coat);
const TIP = color(CAT.tip);
const SHEEN = color(CAT.sheen).multiplyScalar(CAT.sheenStrength);
// Grey-brown tint on the sun side (CAT.coatLit × CAT.coatLitStrength).
const COAT_LIT = color(CAT.coatLit).multiplyScalar(CAT.coatLitStrength);

/**
 * Hair length factor by bone name (first matching pattern), multiplied by MAX_LENGTH. Head bones (`Head`, `Nose`,
 * `Mouth`, `Ear_connector`) are only a fallback: their length comes from headFactor.
 */
const LENGTH_BY_BONE = [
  [/^Ear(?!_connector)/, 0.06],
  [/^(Nose|Mouth)/, 0.14],
  [/^Ear_connector/, 0.5],
  [/^Head/, 0.9],
  [/^Neck002/, 1.6],
  [/^(Toe|toe_)/, 0.12],
  [/^Foot/, 0.2],
  [/^Calf/, 0.6],
  [/^Tail007/, 1.0],
  [/^Tail/, 1.2],
  [/^Neck/, 1.3],
  [/./, 1.3],
];

// Tufted head, see headFactor. three.js drops the dots from bone names (`Tail.007` -> `Tail007`).
// `Ear_connector*` carries the top of the skull between the ears.
const HEAD_BONES = /^(Head|Nose|Mouth|Ear_connector)/;
const HEAD_SKULL = 1.2;
const HEAD_CHEEK = 1.6;
const HEAD_MUZZLE = 0.22;
// Radius (in eye radii) where fur regains its full length around the eyes; a wider disc shaves the space
// between the eyes and the forehead.
const EYE_CLEAR = 1.5;
// Hair shape. HEIGHT_MIN: minimum hair height (share of the length); TIP_TAPER: taper toward the tip (at 1 the
// tip has zero width, leaving isolated dots on the outer shells).
const HEIGHT_MIN = 0.7;
const TIP_TAPER = 0.7;

function lengthFactor(name) {
  for (const [re, f] of LENGTH_BY_BONE) if (re.test(name)) return f;
  return 1;
}

/**
 * Inverse of the bind matrix. Do not use `mesh.bindMatrixInverse`: in "attached" mode three.js overwrites it
 * every frame with the inverse of the world matrix.
 */
function bindInverse(mesh) {
  return mesh.bindMatrix.clone().invert();
}

/** Eye bounding spheres, in the body's bind space. */
function eyeSpheres(body, eyes) {
  return eyes.map((eye) => {
    eye.geometry.computeBoundingSphere();
    const s = eye.geometry.boundingSphere.clone();
    const toBody = bindInverse(body).multiply(eye.bindMatrix);
    return s.applyMatrix4(toBody);
  });
}

/**
 * `furMask` attribute: skin-weighted average of the bone length factors, faded to zero around the eyes
 * (otherwise eyelid hairs bite into the globe).
 */
function buildMask(mesh, eyes) {
  const geo = mesh.geometry;
  const pos = geo.getAttribute('position');
  const si = geo.getAttribute('skinIndex');
  const sw = geo.getAttribute('skinWeight');
  const factors = mesh.skeleton.bones.map((b) => lengthFactor(b.name));
  const isHead = mesh.skeleton.bones.map((b) => HEAD_BONES.test(b.name));
  const spheres = eyeSpheres(mesh, eyes);
  const p = new THREE.Vector3();
  const mask = new Float32Array(si.count);
  for (let v = 0; v < si.count; v++) {
    let sum = 0, total = 0, head = 0;
    for (let k = 0; k < 4; k++) {
      const w = sw.getComponent(v, k);
      const b = si.getComponent(v, k);
      sum += w * factors[b];
      total += w;
      if (isHead[b]) head += w;
    }
    let m = total > 0 ? sum / total : 1;
    p.fromBufferAttribute(pos, v);
    if (head > 0 && spheres.length === 2) {
      m = THREE.MathUtils.lerp(m, headFactor(p, spheres), head / total);
    }
    for (const s of spheres) {
      const d = p.distanceTo(s.center) / s.radius;
      m *= THREE.MathUtils.smoothstep(d, 1.15, EYE_CLEAR);
    }
    mask[v] = m;
  }
  geo.setAttribute('furMask', new THREE.BufferAttribute(mask, 1));
}

/**
 * Head length factor, from position rather than bone: nearly the whole head is weighted on the `Nose` bone
 * (907 vertices against 38 on `Head`), so a per-bone factor would shave the skull and cheeks. Frame: eye centre
 * and spacing, in bind space (+Y up, +Z forward).
 * - skull and forehead: HEAD_SKULL;
 * - cheeks, below and behind the eyes, on the sides: up to HEAD_CHEEK (ruff);
 * - muzzle, in front of and below the eyes, and nose tip: HEAD_MUZZLE.
 */
function headFactor(p, [a, b]) {
  const S = THREE.MathUtils.smoothstep;
  const u = a.center.distanceTo(b.center);              // eye spacing
  const c = a.center.clone().add(b.center).multiplyScalar(0.5);
  const dx = Math.abs(p.x - c.x) / u, dy = (p.y - c.y) / u, dz = (p.z - c.z) / u;
  const cheek = S(dx, 0.45, 0.75) * (1 - S(dy, -0.1, 0.15)) * (1 - S(dz, -0.05, 0.2));
  const muzzle = Math.max(S(dz, 0.0, 0.3) * (1 - S(dy, -0.25, 0.05)), S(dz, 0.3, 0.5));
  const f = THREE.MathUtils.lerp(HEAD_SKULL, HEAD_CHEEK, cheek);
  return THREE.MathUtils.lerp(f, HEAD_MUZZLE, muzzle);
}

/** Direction in the mesh's bind space (the frame of `position` and `normal`). */
function bindDirection(mesh, worldDir) {
  return worldDir.clone().transformDirection(bindInverse(mesh));
}

/** Bind-space position of a bone's origin. */
function bindBonePosition(mesh, name) {
  const i = mesh.skeleton.bones.findIndex((b) => b.name === name);
  if (i < 0) return null;
  const m = mesh.skeleton.boneInverses[i].clone().invert().premultiply(bindInverse(mesh));
  return new THREE.Vector3().setFromMatrixPosition(m);
}

const VERTEX_HEAD = /* glsl */`
attribute float furMask;
uniform float furShell;
uniform float furLength;
uniform float furTime;
uniform vec3 furComb;
uniform vec3 furWind;
varying vec3 vFurPos;
`;

const VERTEX_BODY = /* glsl */`
#include <begin_vertex>
{
  vec3 n = normalize(normal);
  vec3 comb = furComb - n * dot(furComb, n);
  float len = furLength * furMask;
  float sway = sin(furTime * 1.6 + dot(position, vec3(0.9, 0.5, 0.7)) * 0.6);
  transformed += n * len * furShell
    + (comb * 0.6 + furWind * sway * 0.25) * len * furShell * furShell;
  vFurPos = position;
}
`;

// Coat tint, shared by the base skin and the shells. All black, nose included (detecting the pink skin by
// colour also caught the rufous/white borders of the calico texture).
const COAT_GLSL = /* glsl */`
uniform vec3 furCoat;
uniform vec3 furSheen;
uniform vec3 furCoatLit;
void furCoatColor(inout vec3 c) {
  float lum = dot(c, vec3(0.3, 0.59, 0.11));
  c = furCoat * (0.8 + 0.4 * lum);
}
`;

// Belly band: angle and edge in rad; s0, s1 and end along the trunk (0..1); r0 and r1 radial limit in trunk lengths.
const BELLY_BAND = { angle: 0.95, edge: 0.05, s0: 0.15, s1: 0.97, end: 0.025, r0: 0.27, r1: 0.35 };

// Light belly (`belly` constructor option: beige coat, white belly). Absent by default, so the hero and other NPCs
// keep their usual shader programs ('cat-coat', 'cat-fur').
// White is decided in the shader by an analytic band: the continuous attribute `furBellyP` (computed once by
// `buildBellyMask`, trunk rest frame: u = side, v = downward from the trunk axis, s = position along the trunk from
// back to front, k = trunk membership) is interpolated, so the edge stays smooth on any mesh and in any pose.
const BELLY_VERTEX_HEAD = /* glsl */`
attribute vec4 furBellyP;
varying vec4 vBellyP;
`;
const BELLY_VERTEX_SET = /* glsl */`
vBellyP = furBellyP;
`;
const BELLY_COAT_GLSL = /* glsl */`
uniform vec3 furCoat;
uniform vec3 furSheen;
uniform vec3 furCoatLit;
uniform vec3 furBellyColor;
varying vec4 vBellyP;
// Band under the body: half-angle ${BELLY_BAND.angle} rad from the bottom of the trunk, from the lower belly (s ${BELLY_BAND.s0}, groin)
// to the chest (s ${BELLY_BAND.s1}); narrow, regular transitions.
float furBellyHard() {
  float ang = atan(abs(vBellyP.x), vBellyP.y);
  float band = 1.0 - smoothstep(${BELLY_BAND.angle} - ${BELLY_BAND.edge}, ${BELLY_BAND.angle} + ${BELLY_BAND.edge}, ang);
  float ends = smoothstep(${BELLY_BAND.s0} - ${BELLY_BAND.end}, ${BELLY_BAND.s0} + ${BELLY_BAND.end}, vBellyP.z)
    * (1.0 - smoothstep(${BELLY_BAND.s1} - ${BELLY_BAND.end}, ${BELLY_BAND.s1} + ${BELLY_BAND.end}, vBellyP.z));
  float trunkR = 1.0 - smoothstep(${BELLY_BAND.r0}, ${BELLY_BAND.r1}, length(vBellyP.xy)); // analytic limit: neither upper legs nor thighs
  return band * ends * trunkR * smoothstep(0.5, 0.9, vBellyP.w);
}
void furCoatColor(inout vec3 c) {
  float lum = dot(c, vec3(0.3, 0.59, 0.11));
  c = mix(furCoat * (0.8 + 0.4 * lum), furBellyColor, furBellyHard()); // belly: the colour as is, no texture tint
}
`;
// Pure white belly: on the shells, no darkened roots or tinted tips; in lighting, an emissive term keeps it
// white both in sun and shade.
const BELLY_SHELL_TINT = `diffuseColor.rgb = mix(diffuseColor.rgb * mix(0.55, 1.0, furShell) + furTip * furShell * furShell, furBellyColor, furBellyHard());`;
const BELLY_LIGHT = /* glsl */`
totalEmissiveRadiance += furBellyColor * furBellyHard() * 0.45;
`;

const BASE_FRAGMENT = /* glsl */`
furCoatColor(diffuseColor.rgb);
#include <alphamap_fragment>
`;

const FRAGMENT_HEAD = /* glsl */`
uniform float furShell;
uniform float furDensity;
uniform vec3 furTip;
varying vec3 vFurPos;
vec3 furHash(vec3 p) {
  p = fract(p * vec3(0.1031, 0.1030, 0.0973));
  p += dot(p, p.yxz + 33.33);
  return fract((p.xxy + p.yxx) * p.zyx);
}
`;

const FRAGMENT_BODY = /* glsl */`
{
  // Nearest hair (2×2×2 neighbouring cells): distance and random height.
  vec3 p = vFurPos * furDensity;
  vec3 cell = floor(p);
  vec3 o = step(0.5, fract(p)) - 1.0;
  float best = 1e9;
  float height = 1.0;
  for (int x = 0; x < 2; x++)
  for (int y = 0; y < 2; y++)
  for (int z = 0; z < 2; z++) {
    vec3 c = cell + o + vec3(float(x), float(y), float(z));
    vec3 h = furHash(c);
    vec3 d = p - (c + 0.15 + 0.7 * h);
    float dd = dot(d, d);
    if (dd < best) { best = dd; height = mix(${HEIGHT_MIN.toFixed(2)}, 1.0, fract(h.x * 7.13 + h.z * 3.71)); }
  }
  // Root width as a share of a cell; the taper (TIP_TAPER) and height spread (HEIGHT_MIN) keep the outer
  // shells from breaking into scattered dots.
  float r = 0.65 * (1.0 - ${TIP_TAPER.toFixed(2)} * furShell / height);
  diffuseColor.a = furShell < height ? 1.0 - smoothstep(r * 0.6, r, sqrt(best)) : 0.0;
  // Between hairs: exit at once, without paying for lighting (most pixels).
  if (diffuseColor.a < 0.02) discard;
  furCoatColor(diffuseColor.rgb);
  // Roots in the shadow of neighbouring hairs, lighter and slightly rufous tips.
  diffuseColor.rgb = diffuseColor.rgb * mix(0.55, 1.0, furShell) + furTip * furShell * furShell;
}
#include <alphamap_fragment>
`;

// Rim lighting: hairs seen edge-on catch the light, which draws the volume of a black coat (otherwise a flat
// silhouette). `coatLight(shell)`, in view space:
// - `furSun`: soft half-Lambert with the sun (`directionalLights[0]`: three.js lists shadow-casting lights first,
//   so it is the sun of World.js);
// - grey-brown `furCoatLit` tint on the sun side, stronger on top (back, head);
// - peach `furSheen` rim on the contours, strong on the sun side, faint (0.3) in the shade;
// - all fading toward the roots (coat depth), but still present on the base skin.
function coatLight(shell) {
  return /* glsl */`
#include <emissivemap_fragment>
{
  vec3 furN = normalize(normal);
  vec3 furV = normalize(vViewPosition);
  vec3 furUp = normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
  #if NUM_DIR_LIGHTS > 0
    vec3 furL = directionalLights[0].direction;
  #else
    vec3 furL = furUp;
  #endif
  float furSun = smoothstep(-0.1, 0.7, dot(furN, furL));
  float furTop = smoothstep(0.0, 0.85, dot(furN, furUp));
  float furDepth = mix(0.5, 1.0, ${shell});
  float rim = 1.0 - abs(dot(furN, furV));
  totalEmissiveRadiance += furCoatLit * furSun * (0.55 + 0.45 * furTop) * furDepth;
  totalEmissiveRadiance += furSheen * rim * rim * mix(0.3, 1.0, furSun) * mix(0.6, 1.0, ${shell});
}
`;
}
const RIM_FRAGMENT = coatLight('furShell');
const BASE_LIGHT_FRAGMENT = coatLight('0.0');

/**
 * `furBellyP` attribute (vec4 per vertex), computed once on the rest pose (mesh bind frame, heights and lengths
 * divided by the trunk length): `u` side, `v` downward from the trunk axis (mid-height per slice), `s` along the
 * trunk (0 back, 1 front), `k` 1 for trunk and thighs, 0 for head, tail, calves and feet. No colour decision here:
 * see `furBellyHard`. The geometry is shared between NPCs: only those reading the attribute (BELLY_VERTEX_HEAD) use it.
 */
function buildBellyMask(body) {
  const geo = body.geometry;
  if (geo.getAttribute('furBellyP')) return;
  const pos = geo.attributes.position, si = geo.attributes.skinIndex, sw = geo.attributes.skinWeight;
  const bones = body.skeleton.bones;
  const up = bindDirection(body, new THREE.Vector3(0, 1, 0)), front = bindDirection(body, new THREE.Vector3(0, 0, 1));
  const right = bindDirection(body, new THREE.Vector3(1, 0, 0));
  const n = pos.count, A = new Float32Array(n), B = new Float32Array(n), Lt = new Float32Array(n), name = new Array(n);
  const v = new THREE.Vector3();
  let a0 = Infinity, a1 = -Infinity, lSum = 0, lN = 0;
  for (let i = 0; i < n; i++) {
    let best = 0, bw = -1;
    for (let k = 0; k < 4; k++) { const w = sw.getComponent(i, k); if (w > bw) { bw = w; best = si.getComponent(i, k); } }
    name[i] = bones[best]?.name ?? '';
    v.fromBufferAttribute(pos, i);
    A[i] = v.dot(front); B[i] = v.dot(up); Lt[i] = v.dot(right);
    if (/^(Spine|Hip|Shoulder)/.test(name[i])) { a0 = Math.min(a0, A[i]); a1 = Math.max(a1, A[i]); lSum += Lt[i]; lN++; }
  }
  const L = a1 - a0, lc = lSum / Math.max(lN, 1), N = 32;
  // Trunk axis: mid-height of the trunk vertices per slice of s, smoothed, empty slices filled.
  const lo = new Float32Array(N).fill(Infinity), hi = new Float32Array(N).fill(-Infinity);
  for (let i = 0; i < n; i++) {
    if (!/^(Spine|Hip|Shoulder)/.test(name[i])) continue;
    const t = Math.min(N - 1, Math.max(0, Math.floor((A[i] - a0) / L * N)));
    lo[t] = Math.min(lo[t], B[i]); hi[t] = Math.max(hi[t], B[i]);
  }
  let mid = Array.from({ length: N }, (_, t) => (hi[t] > lo[t] ? (hi[t] + lo[t]) / 2 : NaN));
  for (let t = 0; t < N; t++) if (Number.isNaN(mid[t])) mid[t] = mid[t > 0 ? t - 1 : t + 1] ?? 0;
  for (let pass = 0; pass < 2; pass++) mid = mid.map((m, t) => (mid[Math.max(0, t - 1)] + 2 * m + mid[Math.min(N - 1, t + 1)]) / 4);
  const axisAt = (s) => { const x = Math.min(N - 1, Math.max(0, s * N - 0.5)), i0 = Math.floor(x), i1 = Math.min(N - 1, i0 + 1); return mid[i0] + (mid[i1] - mid[i0]) * (x - i0); };
  // Continuous `k`: 1 minus the sum of skin weights on excluded bones (head, tail, calves, feet, hind thighs);
  // the limit around the trunk (upper legs) is analytic in the shader, on interpolated (u, v).
  const ex = /^(Head|Mouth|Nose|Jaw|Ear|Eye|Tongue|Tail|Calf|Foot|Toe|toe|Thigh_Back)/;
  const out_ex = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < 4; k++) if (ex.test(bones[si.getComponent(i, k)]?.name ?? '')) out_ex[i] += sw.getComponent(i, k);
    out_ex[i] = Math.min(1, out_ex[i]);
  }
  const out = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    const s = (A[i] - a0) / L, u = (Lt[i] - lc) / L, w = (axisAt(s) - B[i]) / L;
    out.set([u, w, s, 1 - out_ex[i]], i * 4);
  }
  geo.setAttribute('furBellyP', new THREE.BufferAttribute(out, 4));
}

export class Fur {
  /**
   * @param {THREE.SkinnedMesh} body body mesh (shared geometry, skeleton and material)
   * @param {THREE.SkinnedMesh[]} eyes eye globes, around which the fur fades out
   * @param {object} [opts]
   * @param {number} [opts.belly] belly colour (sRGB hex), added to the coat: without it the coat is plain and the
   *   shader programs are the hero's (see BELLY_COAT_GLSL)
   */
  constructor(body, eyes = [], opts = {}) {
    this.body = body;
    this.belly = opts.belly !== undefined;
    this.shells = [];
    buildMask(body, eyes);

    const scale = body.getWorldScale(new THREE.Vector3()).x;
    const head = bindBonePosition(body, 'Head');
    const tail = bindBonePosition(body, 'Tail');
    const back = head && tail ? tail.clone().sub(head).normalize() : new THREE.Vector3(0, 0, -1);
    const down = bindDirection(body, new THREE.Vector3(0, -1, 0));
    this.uniforms = {
      furLength: { value: MAX_LENGTH / scale },
      furDensity: { value: scale / SPACING },
      furTime: { value: 0 },
      furComb: { value: back.add(down.multiplyScalar(0.5)).normalize() },
      furWind: { value: bindDirection(body, new THREE.Vector3(1, 0, 0.3)) },
      furCoat: { value: COAT.clone() },
      furTip: { value: TIP.clone() },
      furSheen: { value: SHEEN.clone() },
      furCoatLit: { value: COAT_LIT.clone() },
    };
    if (this.belly) {
      this.uniforms.furBellyColor = { value: color(opts.belly) };
      buildBellyMask(body);
    }

    // Fur root: the smooth skin becomes matte and dark, like the base of a coat.
    const baseColor = body.material.color.clone();
    body.material.roughness = 1;
    body.material.color.multiplyScalar(0.7);
    body.material.onBeforeCompile = (shader) => {
      shader.uniforms.furCoat = this.uniforms.furCoat;
      shader.uniforms.furSheen = this.uniforms.furSheen;
      shader.uniforms.furCoatLit = this.uniforms.furCoatLit;
      if (this.belly) {
        shader.uniforms.furBellyColor = this.uniforms.furBellyColor;
        shader.vertexShader = BELLY_VERTEX_HEAD + shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>${BELLY_VERTEX_SET}`);
      }
      shader.fragmentShader = (this.belly ? BELLY_COAT_GLSL : COAT_GLSL) + shader.fragmentShader
        .replace('#include <alphamap_fragment>', BASE_FRAGMENT)
        .replace('#include <emissivemap_fragment>', BASE_LIGHT_FRAGMENT + (this.belly ? BELLY_LIGHT : ''));
    };
    body.material.customProgramCacheKey = () => (this.belly ? 'cat-coat-belly' : 'cat-coat');
    body.material.needsUpdate = true;

    for (let i = 1; i <= SHELLS; i++) {
      const shell = new THREE.SkinnedMesh(body.geometry, this._material(body.material, baseColor, i / SHELLS));
      shell.name = `CatFur${i}`;
      shell.position.copy(body.position);
      shell.quaternion.copy(body.quaternion);
      shell.scale.copy(body.scale);
      shell.bind(body.skeleton, body.bindMatrix);
      shell.frustumCulled = false;
      shell.castShadow = false;
      shell.receiveShadow = true;
      shell.renderOrder = i;
      body.parent.add(shell);
      this.shells.push(shell);
    }
  }

  _material(base, color, t) {
    const m = base.clone();
    m.color.copy(color);
    // A little gloss: without any highlight a black coat is just a silhouette.
    m.roughness = 0.62;
    m.alphaTest = 0.5;
    m.alphaToCoverage = true;
    // Alpha is only for coverage: keep the canvas alpha (1), otherwise the page background shows through the hairs.
    m.blending = THREE.CustomBlending;
    m.blendSrc = THREE.OneFactor;
    m.blendDst = THREE.ZeroFactor;
    m.blendSrcAlpha = THREE.ZeroFactor;
    m.blendDstAlpha = THREE.OneFactor;
    m.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, this.uniforms, { furShell: { value: t } });
      shader.vertexShader = (this.belly ? BELLY_VERTEX_HEAD : '') + VERTEX_HEAD
        + shader.vertexShader.replace('#include <begin_vertex>', this.belly ? VERTEX_BODY + BELLY_VERTEX_SET : VERTEX_BODY);
      shader.fragmentShader = (this.belly ? BELLY_COAT_GLSL : COAT_GLSL) + FRAGMENT_HEAD + shader.fragmentShader
        .replace('#include <alphamap_fragment>', this.belly ? FRAGMENT_BODY.replace('  diffuseColor.rgb = diffuseColor.rgb * mix(0.55, 1.0, furShell) + furTip * furShell * furShell;', BELLY_SHELL_TINT) : FRAGMENT_BODY)
        .replace('#include <emissivemap_fragment>', RIM_FRAGMENT + (this.belly ? BELLY_LIGHT : ''));
    };
    m.customProgramCacheKey = () => (this.belly ? 'cat-fur-belly' : 'cat-fur');
    return m;
  }

  /**
   * Keeps one shell every `step` (1 = all, Infinity = none): fewer passes for weak GPUs.
   * Only reduces: a lighter setting already in place is kept.
   */
  setStep(step) {
    step = Math.max(this.step ?? 1, step);
    this.step = step;
    this.shells.forEach((s, i) => { s.visible = (i + 1) % step === 0; });
  }

  update(time) {
    this.uniforms.furTime.value = time;
  }
}
