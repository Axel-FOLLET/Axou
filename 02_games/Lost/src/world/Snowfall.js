import * as THREE from 'three';
import { MOUNTAIN, color } from '../style/palette.js';
import { rng } from './random.js';

/**
 * Zone 2 snowfall: soft flakes around the camera, one draw call (`THREE.Points`). Created by main.js.
 *
 * - Lives in `world.mountainGroup`, out of the scene in the meadow; `update` is only called in zone 2.
 * - All motion is computed in the shader: each flake has a fixed place in an infinitely repeated box wrapped around
 *   `cameraPosition`. No per-frame buffer writes; JS only updates one float (the time).
 * - A flake stays fixed in the world when the camera moves (correct parallax) and fades near the box faces, so the
 *   wrap is invisible.
 *
 * Interface: `new Snowfall(parent)`; `update(dt)` every frame in zone 2; `setQuality(n)`, same levels as
 * `meadow.setQuality` (0 to 3); `state`: level, drawn flakes, time (for tests).
 *
 * | Setting    | Value              | Reason |
 * |------------|--------------------|--------|
 * | counts     | 5000 to 1300       | Flakes per quality level, shared between the two boxes by `nearShare`. The count drops first on small devices. |
 * | nearShare  | 0.6                | Share in the small box: the game camera looks down at the cat from 2 to 4 m, where one large box would leave only 3 or 4 flakes. |
 * | sizeBoost  | 1 to 1.35          | Fewer flakes, slightly larger: the snowfall stays readable. |
 * | box        | 24 x 16 x 24 m     | Large box, for depth when looking far. Half width 12 m is under the zone 2 fog start (14 m): no flake has to enter the fog. |
 * | nearBox    | 0.5                | Small box around the camera: 12 x 8 x 12 m. Exactly half, so a whole number of large boxes per period is also a whole number of small ones. |
 * | lift       | 2.5 m              | Centre of the large box above the camera (half for the small one): the lower half would be lost below the slope. |
 * | fall       | 0.55 to 1.05 m/s   | Light snow in soft slow motion (real snow falls at about 1 m/s). |
 * | wind       | 0.22; 0.09 m/s     | Common drift, well under the fall speed: snow, not a storm. |
 * | swayAmp    | 0.08 to 0.28 m     | Radius of each flake's spiral: it floats down rather than falling straight. |
 * | swayRate   | 0.5 to 1.4 rad/s   | One spiral in 4 to 12 s: slow enough to stay soft. |
 * | size       | 0.035 to 0.075 m   | Sprite diameter including the gradient: 4 to 9% of the cat (0.8 m), readable at 3 m. |
 * | minPx      | 2                  | Minimum size in drawing-buffer pixels; below it, the flake fades instead of flickering. |
 * | maxFrac    | 0.035              | Maximum size as a share of the buffer height: a flake at the lens does not cover the screen. |
 * | nearFade   | 0.35 to 1.2 m      | Faded near the camera (`near` 0.05 m), where it would be a large blurry blob. |
 * | edgeFade   | 0.72               | Share of the half box where fading starts: invisible wrap at the face. |
 * | core       | 0.14               | Radius of the solid core (sprite edge at 0.5), then a gradient to the edge: round soft sprite, no texture. |
 * | opacity    | 0.85               | Translucent: flakes do not catch the eye like white dots. |
 * | hex        | MOUNTAIN.snow      | Cream-white core from the palette, never pure white. Unlit: the cold `SNOW.fresh` only offsets the warm sun on the ground. |
 * | edgeHex    | MOUNTAIN.snowShade | Lavender rim (the game's shadow tint): keeps the flake readable on light snow. |
 * | period     | 1200 s             | Exact period of the motion (see `lock`): time stays small, hence precise, with no jump when it wraps to 0. |
 * | maxDt      | 0.1 s              | Step cap, same as main.js: a slow frame does not make the snowfall jump. |
 * | order      | 100                | Drawn after all transparent objects, including the scenery fades (Occlusion.js). |
 * | seed       | 20261106           | Fixed seed: same snowfall every game. |
 */
export const SNOWFALL = {
  counts: [5000, 3400, 2200, 1300],
  nearShare: 0.6,
  sizeBoost: [1, 1.08, 1.18, 1.35],
  box: [24, 16, 24],
  nearBox: 0.5,
  lift: 2.5,
  fall: [0.55, 1.05],
  wind: [0.22, 0.09],
  swayAmp: [0.08, 0.28],
  swayRate: [0.5, 1.4],
  size: [0.035, 0.075],
  minPx: 2,
  maxFrac: 0.035,
  nearFade: [0.35, 1.2],
  edgeFade: 0.72,
  core: 0.14,
  opacity: 0.85,
  hex: MOUNTAIN.snow,
  edgeHex: MOUNTAIN.snowShade,
  period: 1200,
  maxDt: 0.1,
  order: 100,
  seed: 20261106,
};

/**
 * Speed rounded so that over `period` s the travel is a whole number of `span` (one box, or one spiral turn): when time
 * wraps to 0, each flake is exactly where it was. Maximum error: span / (2 x period), i.e. 7 mm/s for the fall.
 */
export function lock(speed, span, period = SNOWFALL.period) {
  return (Math.round((speed * period) / span) * span) / period;
}

const VERTEX = /* glsl */`
uniform float uTime;
uniform vec3 uBox;
uniform vec3 uWind;
uniform float uLift;
uniform float uSizeK;
uniform float uHeight;
uniform vec2 uPx;       // minimum size (pixels), maximum size (share of the height)
uniform vec2 uNearFade;
uniform float uEdgeFade;
attribute vec4 aFlake;  // fall (m/s), spiral radius (m), spiral speed (rad/s), phase (rad)
attribute vec2 aSize;   // diameter (m), scale of its box (1 or nearBox)
varying float vAlpha;
void main() {
  float a = aFlake.z * uTime + aFlake.w;
  vec3 p = position + uWind * uTime + vec3(sin(a), 0.0, cos(a)) * aFlake.y;
  p.y -= aFlake.x * uTime;
  // Wrap into the box centred uLift above the camera; from then on everything is camera-relative:
  // view matrix without translation, never large numbers (x around 1000 m in zone 2).
  vec3 box = uBox * aSize.y, half_ = box * 0.5;
  float lift = uLift * aSize.y;
  vec3 r = mod(p - cameraPosition - vec3(0.0, lift, 0.0) + half_, box) - half_;
  vec3 e = abs(r) / half_;
  float edge = 1.0 - smoothstep(uEdgeFade, 1.0, max(e.x, max(e.y, e.z)));
  r.y += lift;
  vec3 view = mat3(viewMatrix) * r;
  gl_Position = projectionMatrix * vec4(view, 1.0);
  float depth = max(-view.z, 0.001);
  // projectionMatrix[1][1] = 1 / tan(fov / 2): diameter in pixels at this distance.
  float px = aSize.x * uSizeK * 0.5 * uHeight * projectionMatrix[1][1] / depth;
  gl_PointSize = clamp(px, uPx.x, uPx.y * uHeight);
  vAlpha = edge * smoothstep(uNearFade.x, uNearFade.y, length(r)) * min(px / uPx.x, 1.0);
}
`;

const FRAGMENT = /* glsl */`
uniform vec3 uColor;
uniform vec3 uEdge;
uniform float uOpacity;
uniform float uCore;
varying float vAlpha;
void main() {
  float r = length(gl_PointCoord - 0.5);
  float a = 1.0 - smoothstep(uCore, 0.5, r);
  gl_FragColor = vec4(mix(uColor, uEdge, smoothstep(uCore, 0.36, r)), a * vAlpha * uOpacity);
  // No tone mapping (toneMapped: false): colour shown as is, like the sky (sky.js).
  #include <colorspace_fragment>
}
`;

const _size = new THREE.Vector2();

export class Snowfall {
  /** @param {THREE.Object3D} parent zone 2 group (World.mountainGroup), out of the scene in zone 1 */
  constructor(parent) {
    const S = SNOWFALL, rand = rng(S.seed), N = S.counts[0];
    const lerp = (r, t) => r[0] + (r[1] - r[0]) * t;
    const start = new Float32Array(N * 3), flake = new Float32Array(N * 4), size = new Float32Array(N * 2);
    const [bx, by, bz] = S.box;
    for (let i = 0; i < N; i++) {
      // Random draws: the first n form a uniform snowfall at every quality level (`setDrawRange`).
      start[i * 3] = rand() * bx; start[i * 3 + 1] = rand() * by; start[i * 3 + 2] = rand() * bz;
      flake[i * 4] = lock(lerp(S.fall, rand()), by);
      flake[i * 4 + 1] = lerp(S.swayAmp, rand());
      flake[i * 4 + 2] = lock(lerp(S.swayRate, rand()), Math.PI * 2);
      flake[i * 4 + 3] = rand() * Math.PI * 2;
      size[i * 2] = lerp(S.size, rand());
      size[i * 2 + 1] = rand() < S.nearShare ? S.nearBox : 1;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(start, 3));
    g.setAttribute('aFlake', new THREE.BufferAttribute(flake, 4));
    g.setAttribute('aSize', new THREE.BufferAttribute(size, 2));
    this.geometry = g;
    this.uniforms = {
      uTime: { value: 0 },
      uBox: { value: new THREE.Vector3(bx, by, bz) },
      uWind: { value: new THREE.Vector3(lock(S.wind[0], bx), 0, lock(S.wind[1], bz)) },
      uLift: { value: S.lift },
      uSizeK: { value: 1 },
      uHeight: { value: 800 }, // drawing-buffer height, re-read at each render
      uPx: { value: new THREE.Vector2(S.minPx, S.maxFrac) },
      uNearFade: { value: new THREE.Vector2(S.nearFade[0], S.nearFade[1]) },
      uEdgeFade: { value: S.edgeFade },
      uColor: { value: color(S.hex) },
      uEdge: { value: color(S.edgeHex) },
      uOpacity: { value: S.opacity },
      uCore: { value: S.core },
    };
    this.material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      transparent: true,   // NormalBlending: destination alpha stays at 1 (WebGLState, ONE, ONE_MINUS_SRC_ALPHA)
      depthWrite: false,
      fog: false,
      toneMapped: false,
    });
    this.points = new THREE.Points(g, this.material);
    this.points.name = 'Snowflakes';
    this.points.frustumCulled = false; // positions computed in the shader
    this.points.renderOrder = S.order;
    this.points.castShadow = false;
    this.points.receiveShadow = false;
    this.points.raycast = () => {};
    this.points.matrixAutoUpdate = false;
    // Actual buffer height: follows resizing and the adaptive-quality pixel ratio.
    this.points.onBeforeRender = (renderer) => {
      this.uniforms.uHeight.value = renderer.getDrawingBufferSize(_size).y;
    };
    this.group = new THREE.Group();
    this.group.name = 'Snowfall';
    this.group.matrixAutoUpdate = false;
    this.group.add(this.points);
    parent.add(this.group);
    this.level = 0;
    this.setQuality(0);
  }

  /** Quality level, same numbers as `meadow.setQuality` (0 to 3); no recompilation. */
  setQuality(level) {
    const S = SNOWFALL;
    this.level = Math.min(Math.max(Math.round(level), 0), S.counts.length - 1);
    this.geometry.setDrawRange(0, S.counts[this.level]);
    this.uniforms.uSizeK.value = S.sizeBoost[this.level];
  }

  /** Every frame, in zone 2 only. */
  update(dt) {
    if (!(dt > 0)) return;
    const S = SNOWFALL, u = this.uniforms.uTime;
    u.value = (u.value + Math.min(dt, S.maxDt)) % S.period;
  }

  /** For tests (`__snowfall.state`): level, drawn flakes, time. */
  get state() {
    return { level: this.level, count: this.geometry.drawRange.count, time: this.uniforms.uTime.value };
  }
}
