import * as THREE from 'three';

/**
 * Dissolve of the defeated Chartiste, used by main.js: in soulslike fashion, glowing fragments leave the body,
 * drift upwards and fade out. A single `THREE.Points` (one draw call during the dissolve, none otherwise since the
 * object is hidden) with an additive material computed in the shader (only uniforms are written per frame).
 * Kept in the scene from the start (program compiled at first render, so no hitch on first use), without fog or
 * depth writes.
 *
 * Interface: `new Dissolve(scene)`; `start(mesh, o)` (fragments taken from the vertices of the deformed `mesh`,
 * world space); `update(dt, renderer, camera)`; `active`; `clear()`.
 */

/**
 * Settings:
 * - `count`: 600, enough to read a crumbling silhouette on a boss back to small size (about 0.4 m); one draw call
 *   whatever the count.
 * - `spread` (s): departures are staggered over 1.2 s, so the body crumbles gradually instead of exploding.
 * - `topFirst` (0 to 1): the top leaves first, like a rising ember.
 * - `life` (s): each fragment rises then fades; everything ends by spread + 1.8 = 3.0 s.
 * - `rise` (m/s): clear upward movement. `drift` (m/s): light sideways drift.
 * - `size` (m): fragments smaller than a kitten's paw.
 * - `colors`: pale gold and orange (ember glow, close to the ginger coat); additive, so also bright against the
 *   clear sky of the returning daylight.
 */
export const DISSOLVE = {
  count: 600,
  spread: 1.2,
  topFirst: 0.7,
  life: [1.0, 1.8],
  rise: [0.5, 1.2],
  drift: 0.25,
  size: [0.018, 0.04],
  colors: [0xffe6a8, 0xffb55c, 0xff8a3d],
};

const VERT = /* glsl */ `
attribute vec3 vel;
attribute vec3 tint;
attribute vec3 bls; // birth, life, size
uniform float uTime;
uniform float uPx;
varying vec3 vTint;
varying float vA;
void main() {
  float t = uTime - bls.x;
  float k = clamp(t / bls.y, 0.0, 1.0);
  // Before birth: invisible (the body is still there). The rise slows at the end of life.
  vec3 p = position + vel * (t - 0.35 * t * k) * step(0.0, t);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float on = step(0.0, t) * step(k, 0.999);
  vA = on * smoothstep(0.0, 0.08, k) * (1.0 - smoothstep(0.45, 1.0, k));
  vTint = tint;
  gl_PointSize = on * bls.z * (1.0 - 0.6 * k) * uPx / max(-mv.z, 0.05);
}
`;

const FRAG = /* glsl */ `
varying vec3 vTint;
varying float vA;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = vA * (1.0 - smoothstep(0.15, 0.5, d));
  if (a < 0.003) discard;
  gl_FragColor = vec4(vTint * a, a);
}
`;

const _v = new THREE.Vector3();

export class Dissolve {
  constructor(scene, o = DISSOLVE) {
    this.o = o;
    const n = o.count;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute('vel', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute('tint', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute('bls', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    g.setDrawRange(0, 0);
    this.uniforms = { uTime: { value: 0 }, uPx: { value: 500 } };
    const m = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG, uniforms: this.uniforms,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    });
    this.points = new THREE.Points(g, m);
    this.points.name = 'Dissolve';
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
    this.points.visible = false; // outside the dissolve: no draw call
    scene.add(this.points);
    this.time = 0;
    this.end = 0;
    this.active = false;
  }

  /**
   * Starts the dissolve from the current pose of `mesh` (SkinnedMesh: deformed vertices).
   * @param {THREE.Mesh} mesh Mesh to dissolve.
   * @param {object} [o] `rand`: generator in [0, 1), Math.random by default.
   */
  start(mesh, { rand = Math.random } = {}) {
    const O = this.o, g = this.points.geometry, n = O.count;
    const P = g.attributes.position.array, V = g.attributes.vel.array, T = g.attributes.tint.array, B = g.attributes.bls.array;
    const total = mesh.geometry.getAttribute('position').count;
    mesh.updateMatrixWorld(true);
    mesh.skeleton?.update();
    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i < n; i++) {
      mesh.getVertexPosition(Math.floor(rand() * total), _v).applyMatrix4(mesh.matrixWorld);
      P.set([_v.x, _v.y, _v.z], i * 3);
      lo = Math.min(lo, _v.y); hi = Math.max(hi, _v.y);
    }
    const cols = O.colors.map((c) => new THREE.Color(c));
    const lerp = THREE.MathUtils.lerp;
    for (let i = 0; i < n; i++) {
      const h = hi > lo ? (P[i * 3 + 1] - lo) / (hi - lo) : 0;
      const a = rand() * Math.PI * 2, s = O.drift * rand();
      V.set([Math.cos(a) * s, lerp(O.rise[0], O.rise[1], rand()), Math.sin(a) * s], i * 3);
      const c = cols[Math.floor(rand() * cols.length)];
      T.set([c.r, c.g, c.b], i * 3);
      // Top of the body first (topFirst), with some randomness.
      const birth = O.spread * THREE.MathUtils.clamp((1 - h) * O.topFirst + rand() * (1 - O.topFirst), 0, 1);
      B.set([birth, lerp(O.life[0], O.life[1], rand()), lerp(O.size[0], O.size[1], rand())], i * 3);
    }
    for (const k of ['position', 'vel', 'tint', 'bls']) g.attributes[k].needsUpdate = true;
    g.setDrawRange(0, n);
    this.points.visible = true;
    this.time = 0;
    this.end = O.spread + O.life[1];
    this.active = true;
  }

  /** Every frame: shader time and point size scaled to the screen; ends at `end` s. */
  update(dt, renderer, camera) {
    if (!this.active) return;
    this.time += dt;
    this.uniforms.uTime.value = this.time;
    const h = renderer.getDrawingBufferSize(_v2).y;
    this.uniforms.uPx.value = h * 0.5 * camera.projectionMatrix.elements[5];
    if (this.time >= this.end) this.clear();
  }

  /** Stops drawing anything (reset, new run). */
  clear() {
    this.active = false;
    this.points.geometry.setDrawRange(0, 0);
    this.points.visible = false;
  }

  /** State, for tests. */
  get state() { return { active: this.active, t: Math.round(this.time * 100) / 100, end: this.end }; }
}

const _v2 = new THREE.Vector2();
