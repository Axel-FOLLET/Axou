import * as THREE from 'three';
import { heightAt, normalAt } from './Terrain.js';
import { ZONE2 } from './zone2.js';

/**
 * The kitten's tracks in the snow, created by main.js: bounded pool of footprints, one draw call (`InstancedMesh` of a
 * quad), paw shape drawn in the shader.
 *
 * - Lives in `world.mountainGroup`, out of the scene in the meadow; tracks stay in memory when the player comes back.
 * - Interface: `add(x, z, yaw, side)` at each step (returns the slot written, or -1 if refused); `addPaw(leg, bone, yaw)`:
 *   same, from the bone of paw 'BL', 'FL', 'BR' or 'FR'; `reset()`; `update(dt)` every frame in zone 2; `enabled`: when
 *   false, `add` writes nothing (set by the caller: snow, carrying, jump); `state`: counters (for tests).
 * - `yaw`: cat heading, `cat.root.rotation.y`, forward = (sin yaw, cos yaw). `side`: +1 cat's left (local +X), -1 right.
 * - No allocation per step: buffers created once, module vectors. Both buffers are uploaded in full at each step
 *   (25.6 KB, 5 to 12 times per second) because `addUpdateRange` would allocate an object per call.
 * - Multiply blending: the print darkens the ground beneath it, shadows and fog included, and keeps the canvas alpha.
 *
 * | Setting    | Value           | Reason |
 * |------------|-----------------|--------|
 * | capacity   | 320             | Bounded pool: 64 s of walking (33 m of track) or 27 s of gallop (110 m), enough for the longest leg. |
 * | rankFade   | 80              | The 80 oldest fade gradually, reaching 0 when their slot is reused: never an abrupt disappearance. |
 * | life       | 150 s           | Time in zone 2 after which the falling snow has covered the track, even if the cat stays put. |
 * | lifeFade   | 50 s            | Duration of that covering, included at the end of `life`. |
 * | size       | 0.044; 0.052 m  | Half width, half length of the quad: 9 cm paw, larger than a real pad (snow spreads) and readable at 3 m. |
 * | offset     | 0.006 m         | Offset along the normal above `heightAt`. |
 * | depthBias  | 0.12 m          | Pulled towards the camera in depth only (screen position unchanged): the 0.5 m ground mesh is a chord of `heightAt`, up to 15 cm higher at the edge, and a grazing camera magnifies this. Multiplying the cat's black fur in this margin does not show. |
 * | splay      | 0.12 rad        | Paw turned 7 deg outwards, like a real cat track; also gives the left / right alternation. |
 * | tint       | 0xb0b2d4        | Direct multiply value: the game's lavender shadow, never dirty grey or black; reads on fresh snow and on the packed path. |
 * | strength   | 0.9             | Tint share at the centre of the print. |
 * | rim        | 0.6             | Tint share at the edge of a pad (centre at 1): a hollow that can be guessed, with no outline. |
 * | core       | 0.3             | Depth (quad units) where the centre value is reached. |
 * | soft       | 0.07            | Half width of the edge (quad units): soft even close up. |
 * | farFade    | 16 to 42 m      | Faded with distance: beyond the fog start (14 m) it would be meaningless, and multiply does not follow the fog colour. |
 * | maxDt      | 0.1 s           | Step cap, same as main.js. |
 * | order      | -1              | First among transparent objects: on the ground, under fading scenery and flakes. |
 * | keepOff    | function        | Constructor option: snowless spots of the zone (return planks: Rampart.RETURN_LOOK). |
 *
 * Shape (`PAW`): quad from -1 to 1, y forward, x towards the outside of the paw (mirrored on the right). `pad`: main pad,
 * three blended discs; `toes`: two higher middle toes and two lower side toes, the outer ones slightly forward, like a
 * real print (four toes, no claws).
 */
export const FOOTPRINTS = {
  capacity: 320,
  rankFade: 80,
  life: 150,
  lifeFade: 50,
  size: [0.044, 0.052],
  offset: 0.006,
  depthBias: 0.12,
  splay: 0.12,
  tint: 0xb0b2d4,
  strength: 0.9,
  rim: 0.6,
  core: 0.3,
  soft: 0.07,
  farFade: [16, 42],
  maxDt: 0.1,
  order: -1,
};

/**
 * From the paw bone (`cat.rig.legs[k].paw`) to the centre of what touches the ground, in metres, in heading axes: `fwd`
 * forward, `out` outwards. Measured on the GLB, stable across gaits within 2 mm; without it the print lands 4 to 5.5 cm
 * behind the paw. `maxHeight`: bone higher than this above the ground means paw in the air, no print; the body only
 * tilts by 60% of the slope (Cat.js, TILT), so on the slope a planted paw's bone can be up to 0.137 m above `heightAt`.
 */
export const PAW_CONTACT = { B: { fwd: 0.0555, out: 0.01 }, F: { fwd: 0.0406, out: 0.0083 }, maxHeight: 0.17 };

export const PAW = {
  pad: [[0, -0.28, 0.36], [-0.3, -0.52, 0.25], [0.3, -0.52, 0.25]],
  padBlend: 0.18,
  toes: [[0.18, 0.5, 0.17, 0.24], [-0.2, 0.44, 0.17, 0.24], [0.56, 0.12, 0.16, 0.22], [-0.56, 0.06, 0.16, 0.22]],
};

const f = (x) => x.toFixed(4);

/** Signed distance to the shape in GLSL, generated from `PAW` (a single place to tune). */
const PAW_GLSL = /* glsl */`
float smin(float a, float b, float k) {
  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}
float oval(vec2 p, vec4 o) {
  return (length((p - o.xy) / o.zw) - 1.0) * min(o.z, o.w);
}
float pawDistance(vec2 p) {
  float d = length(p - vec2(${f(PAW.pad[0][0])}, ${f(PAW.pad[0][1])})) - ${f(PAW.pad[0][2])};
${PAW.pad.slice(1).map((c) => `  d = smin(d, length(p - vec2(${f(c[0])}, ${f(c[1])})) - ${f(c[2])}, ${f(PAW.padBlend)});`).join('\n')}
${PAW.toes.map((t) => `  d = min(d, oval(p, vec4(${t.map(f).join(', ')})));`).join('\n')}
  return d;
}
`;

const VERTEX = /* glsl */`
attribute vec4 aMeta;   // pose rank, pose time (s), side (+/-1), unused
uniform vec2 uSize;
uniform float uHead;    // poses since the last reset
uniform float uTime;
uniform vec2 uRank;     // capacity, fade poses
uniform vec2 uLife;     // life (s), fade duration (s)
uniform vec2 uFar;
uniform float uBias;
varying vec2 vQ;
varying float vFade;
void main() {
  vQ = vec2(position.x * aMeta.z, position.z); // mirror of the right paw; x stays outwards
  vec4 world = instanceMatrix * vec4(position.x * uSize.x, 0.0, position.z * uSize.y, 1.0);
  vec4 mv = viewMatrix * world;
  vec4 clip = projectionMatrix * mv;
  // Depth alone pulled closer by uBias metres: screen position unchanged.
  vec4 near_ = projectionMatrix * vec4(mv.xy, mv.z + uBias, 1.0);
  clip.z = near_.z / near_.w * clip.w;
  gl_Position = clip;
  // Rank: 1 for the newest, capacity for the one whose slot is reused at the next pose (0).
  float byRank = 1.0 - smoothstep(uRank.x - uRank.y, uRank.x, uHead - aMeta.x);
  float byTime = 1.0 - smoothstep(uLife.x - uLife.y, uLife.x, uTime - aMeta.y);
  float byFar = 1.0 - smoothstep(uFar.x, uFar.y, -mv.z);
  vFade = byRank * byTime * byFar;
}
`;

const FRAGMENT = /* glsl */`
uniform vec3 uTint;
uniform vec3 uShade;    // share at the centre, share at the edge, depth of the centre
uniform float uSoft;
varying vec2 vQ;
varying float vFade;
${PAW_GLSL}
void main() {
  float d = pawDistance(vQ);
  float w = max(uSoft, fwidth(d));
  float a = 1.0 - smoothstep(-w, w, d);
  a *= uShade.x * mix(uShade.y, 1.0, smoothstep(0.0, uShade.z, -d));
  // Direct multiply on the image (CustomBlending): no colour conversion here.
  gl_FragColor = vec4(mix(vec3(1.0), uTint, a * vFade), 1.0);
}
`;

const _n = new THREE.Vector3(), _f = new THREE.Vector3(), _r = new THREE.Vector3(), _b = new THREE.Vector3();

/** Quad from -1 to 1 in the XZ plane, facing +Y (ground normal). */
function quadGeometry() {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, 0, 1, 1, 0, 1, 1, 0, -1, -1, 0, -1]), 3));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  return g;
}

export class Footprints {
  /**
   * @param {THREE.Object3D} parent zone 2 group (World.mountainGroup), out of the scene in zone 1
   * @param {object} [opts] `keepOff(x, z)`: true where the zone has no snow
   */
  constructor(parent, { keepOff = null } = {}) {
    const F = FOOTPRINTS, N = F.capacity;
    this.capacity = N;
    this.enabled = true;
    this.keepOff = keepOff;
    this.head = 0;       // poses since the last reset (slot: head % capacity)
    this.refused = 0;    // refused calls (for tests)
    this.geometry = quadGeometry();
    this.meta = new THREE.InstancedBufferAttribute(new Float32Array(N * 4), 4).setUsage(THREE.DynamicDrawUsage);
    this.geometry.setAttribute('aMeta', this.meta);
    this.uniforms = {
      uSize: { value: new THREE.Vector2(F.size[0], F.size[1]) },
      uHead: { value: 0 },
      uTime: { value: 0 },
      uRank: { value: new THREE.Vector2(N, F.rankFade) },
      uLife: { value: new THREE.Vector2(F.life, F.lifeFade) },
      uFar: { value: new THREE.Vector2(F.farFade[0], F.farFade[1]) },
      uBias: { value: F.depthBias },
      // Multiply value, without converting to linear space.
      uTint: { value: new THREE.Color().setHex(F.tint, THREE.LinearSRGBColorSpace) },
      uShade: { value: new THREE.Vector3(F.strength, F.rim, F.core) },
      uSoft: { value: F.soft },
    };
    this.material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      transparent: true,
      depthWrite: false,
      fog: false,
      toneMapped: false,
      blending: THREE.CustomBlending,
      blendEquation: THREE.AddEquation,
      blendSrc: THREE.DstColorFactor,
      blendDst: THREE.ZeroFactor,
      blendSrcAlpha: THREE.ZeroFactor,
      blendDstAlpha: THREE.OneFactor,
    });
    this.mesh = new THREE.InstancedMesh(this.geometry, this.material, N);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.count = 0;
    this.mesh.name = 'Footprints';
    this.mesh.frustumCulled = false; // prints follow the cat; the bounding box of the set is never right
    this.mesh.renderOrder = F.order;
    this.mesh.castShadow = false;
    this.mesh.receiveShadow = false;
    this.mesh.raycast = () => {};
    this.mesh.matrixAutoUpdate = false;
    parent.add(this.mesh);
  }

  /**
   * One print at (x, z), along the `heightAt` normal at that point, its front in heading `yaw` (projected on the slope);
   * replaces the oldest when the pool is full. Returns the slot, or -1 if refused (`enabled` false, meadow, snowless spot).
   */
  add(x, z, yaw, side = 1) {
    if (!this.enabled || !(x > ZONE2.switchX) || this.keepOff?.(x, z)) { this.refused++; return -1; }
    const F = FOOTPRINTS, s = side < 0 ? -1 : 1, i = this.head % this.capacity;
    const y = heightAt(x, z);
    normalAt(x, z, _n);
    const a = yaw + s * F.splay;
    // Forward on the slope: vertical above the heading, so the heading seen from above stays exact.
    const fx = Math.sin(a), fz = Math.cos(a);
    _f.set(fx, -(_n.x * fx + _n.z * fz) / _n.y, fz).normalize();
    _r.crossVectors(_n, _f); // right-handed frame: x x y = z
    const m = this.mesh.instanceMatrix.array, k = i * 16;
    m[k] = _r.x; m[k + 1] = _r.y; m[k + 2] = _r.z; m[k + 3] = 0;
    m[k + 4] = _n.x; m[k + 5] = _n.y; m[k + 6] = _n.z; m[k + 7] = 0;
    m[k + 8] = _f.x; m[k + 9] = _f.y; m[k + 10] = _f.z; m[k + 11] = 0;
    m[k + 12] = x + _n.x * F.offset; m[k + 13] = y + _n.y * F.offset; m[k + 14] = z + _n.z * F.offset; m[k + 15] = 1;
    const u = this.meta.array, q = i * 4;
    u[q] = this.head; u[q + 1] = this.uniforms.uTime.value; u[q + 2] = s; u[q + 3] = 0;
    this.head++;
    this.uniforms.uHead.value = this.head;
    this.mesh.count = Math.min(this.head, this.capacity);
    this.mesh.instanceMatrix.needsUpdate = true;
    this.meta.needsUpdate = true;
    return i;
  }

  /** Print under paw `leg`, read from its bone, at the current frame (after `cat.update`). */
  addPaw(leg, bone, yaw) {
    bone.getWorldPosition(_b);
    if (_b.y - heightAt(_b.x, _b.z) > PAW_CONTACT.maxHeight) { this.refused++; return -1; }
    const c = PAW_CONTACT[leg[0]], s = leg[1] === 'L' ? 1 : -1;
    const fx = Math.sin(yaw), fz = Math.cos(yaw); // cat's left = local +X = (fz, -fx)
    return this.add(_b.x + fx * c.fwd + fz * s * c.out, _b.z + fz * c.fwd - fx * s * c.out, yaw, s);
  }

  /** Clears everything: new game. Nothing is freed; the buffers are reused. */
  reset() {
    this.head = 0;
    this.refused = 0;
    this.uniforms.uHead.value = 0;
    this.uniforms.uTime.value = 0;
    this.mesh.count = 0;
  }

  /** Every frame, in zone 2 only: snow only covers tracks where it falls. */
  update(dt) {
    if (dt > 0) this.uniforms.uTime.value += Math.min(dt, FOOTPRINTS.maxDt);
  }

  /** For tests (`__footprints.state`): poses, prints in the pool, refusals, capacity. */
  get state() {
    return { head: this.head, count: this.mesh.count, refused: this.refused, capacity: this.capacity, enabled: this.enabled };
  }
}
