import * as THREE from 'three';
import { OUTLINE } from '../style/palette.js';

/**
 * The Chartiste's paint on the ground. Attack logic (who throws what, when, at which level) lives in bossMoves.js and
 * difficulty.js (`paint`); this module only draws the shapes and tells whether a point touches them.
 *
 * Three shapes, one geometry (a flat quad) and one draw call for all:
 * - `puddle`: disc. Warning (`warn` s): pulsing light rim, striped fill; then it spreads from `PAINT.puddleStart` to its
 *   radius in `grow` s and stays `life` s, hurting on contact.
 * - `trail`: flat strip from a point along `yaw` (game frame: forward = +z, like the boss), rounded ends. Warning: the
 *   fill runs from start to end.
 * - `zone`: disc warned by a fill growing from centre to edge, then solid for `life` s.
 * A warned shape NEVER hurts: only a painted shape (phase 1) does. End of life: `PAINT.fade` s fade, nothing touches any
 * more. `clear()` removes shapes at once or by a short fade.
 *
 * Cost: one `InstancedMesh` of `PAINT.capacity` slots, one draw call (oldest recycled when full), no shadows, not
 * clickable (empty `raycast`), created on the first `spawn`, released by `dispose`. Flat toon style: two tones, ink rim
 * (OUTLINE.color), wavy edge (same `wobble` in the shader and in the contact test).
 */
export const PAINT = {
  capacity: 24,       // shapes at once; Hard: 1 puddle / 8 s (8 s life) + 1 trail + 3 zones, well under the cap
  lift: 0.05,         // m: above the ground (arena disc at +0.01 m, triangulated every 0.4 m: slope gap stays under 4 cm)
  mesh: 24,           // segments per quad side: each vertex sits on the ground (height texture), step 0.15 to 0.4 m
  field: 0.25,        // m: step of the arena ground height texture (relief -0.23 to +0.41 m over the 11 m disc)
  catR: 0.15,         // m: kitten radius used for contact (body NAV.radius 0.2; 0.15 so the tip of the shadow does not hurt)
  pad: 0.35,          // m: quad margin around the shape (wobble + soft edge)
  fade: 0.6,          // s: end-of-life fade
  quickFade: 0.25,    // s: short fade of `clear(true)`
  puddleStart: 0.35,  // share of the radius when a puddle starts spreading
  wobble: [0.05, 0.035], // disc edge wobble: amplitude (share of the radius) of harmonics 5 and 9
  strip: { edgeWobble: 0.06, round: 0.45 }, // strip: edge wobble (share of the half width), maximum end radius (m)
  ink: 0.09,          // m: ink rim thickness
  // Colours: the Chartiste's paints (Accessories.js `paints`: pink, yellow); zone = pink / yellow mix.
  colors: { puddle: 0xe86a7a, trail: 0xf3c55a, zone: 0xf08a62, rim: 0xfff3c4, ink: OUTLINE.color },
};

const KIND = { puddle: 0, zone: 0, trail: 1 };
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);

/** Disc edge wobble for angle `a` (rad) and `seed`; identical to the shader. */
export function wobble(a, seed) {
  return 1 + PAINT.wobble[0] * Math.sin(5 * a + seed * 6.2832) + PAINT.wobble[1] * Math.sin(9 * a + seed * 17);
}

const VERTEX = /* glsl */`
uniform sampler2D uHeight;
uniform vec4 uField;
attribute vec4 aA;
attribute vec4 aB;
attribute vec3 aCol;
varying vec2 vP;
varying vec4 vA;
varying vec4 vB;
varying vec3 vCol;
void main() {
  vec2 size = vec2(length(instanceMatrix[0].xyz), length(instanceMatrix[2].xyz));
  vP = position.xz * size;
  vA = aA; vB = aB; vCol = aCol;
  vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0);
  w.y = texture2D(uHeight, (w.xz - uField.xy) / uField.z).r + ${PAINT.lift.toFixed(3)};
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;

// vA: (shape 0 disc / 1 strip, phase 0 warning / 1 painted / 2 fading, phase progress 0 to 1, spread share of the radius)
// vB: (radius or length, width, seed, opacity)
const FRAGMENT = /* glsl */`
uniform float uTime;
uniform vec3 uRim;
uniform vec3 uInk;
varying vec2 vP;
varying vec4 vA;
varying vec4 vB;
varying vec3 vCol;
const float AA = 0.035;
void main() {
  float kind = vA.x, phase = vA.y, k = vA.z, gr = vA.w;
  float len = vB.x, wid = vB.y, seed = vB.z, alpha = vB.w;
  vec2 p = vP;
  float sd, prog;
  if (kind < 0.5) {
    float r = length(p), a = atan(p.y, p.x);
    float wob = 1.0 + ${PAINT.wobble[0].toFixed(3)} * sin(5.0 * a + seed * 6.2832) + ${PAINT.wobble[1].toFixed(3)} * sin(9.0 * a + seed * 17.0);
    float R = len * wob;
    sd = r - R * (phase < 0.5 ? 1.0 : gr);
    prog = r / max(R, 0.001);
  } else {
    float hw = 0.5 * wid * (1.0 + ${PAINT.strip.edgeWobble.toFixed(3)} * sin(p.y * 2.3 + seed * 10.0));
    float hl = 0.5 * len;
    float rr = min(hw, ${PAINT.strip.round.toFixed(3)});
    vec2 q = abs(p) - vec2(hw - rr, hl - rr);
    sd = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - rr;
    prog = (p.y + hl) / len;
  }
  float body = 1.0 - smoothstep(-AA, AA, sd);
  vec3 col;
  float a;
  if (phase < 0.5) {
    // Warning: light rim pulsing faster and faster, slow stripes, fill settling in.
    float pulse = 0.6 + 0.4 * sin(uTime * (7.0 + 9.0 * k));
    float ring = (1.0 - smoothstep(0.0, 0.07, abs(sd + 0.04))) * step(sd, 0.03);
    float stripes = step(0.5, fract((p.x + p.y) * 1.6 - uTime * 0.6));
    float fill = body * (1.0 - step(k, prog));
    a = max(max(body * (0.10 + 0.10 * stripes), fill * 0.55), ring * (0.55 + 0.4 * pulse));
    col = mix(vCol, uRim, ring);
  } else {
    // Painted: two-tone flat fill (highlight), ink rim under the edge.
    float blob;
    if (kind < 0.5) blob = 1.0 - length(p - vec2(-0.28, 0.28) * len) / (0.62 * len);
    else blob = (0.5 + 0.5 * sin(p.y * 1.9 + seed * 9.0)) * (1.0 - abs(p.x) / (0.5 * wid + 0.001));
    vec3 light = mix(vCol, vec3(1.0), 0.42);
    col = mix(vCol, light, step(0.45, blob));
    float edge = body * (1.0 - smoothstep(${(PAINT.ink - 0.03).toFixed(3)}, ${PAINT.ink.toFixed(3)}, -sd));
    col = mix(col, uInk, edge * 0.9);
    a = body;
    if (phase > 1.5) { a *= 1.0 - k; col = mix(col, uRim, 0.3 * k); }
  }
  a *= alpha;
  if (a < 0.01) discard;
  gl_FragColor = vec4(col, a);
  #include <colorspace_fragment>
}
`;

export class Paint {
  /**
   * @param {THREE.Object3D} parent group receiving the mesh (arena group: hidden with it)
   * @param {(x:number, z:number) => number} heightAt ground height
   * @param {{x:number, z:number, r:number}} field centre and radius (m) of the area where shapes can be placed
   */
  constructor(parent, heightAt, field) {
    this.parent = parent;
    this.heightAt = heightAt;
    this.field = field; // { x, z, r }: disc whose ground is sampled (arena + margin)
    this.list = [];          // live shapes, oldest first
    this.mesh = null;
    this._seed = 0;
    this._cols = {};
    for (const k of ['puddle', 'trail', 'zone']) this._cols[k] = new THREE.Color(PAINT.colors[k]);
  }

  _build() {
    const ig = new THREE.PlaneGeometry(1, 1, PAINT.mesh, PAINT.mesh);
    ig.rotateX(-Math.PI / 2);
    // Ground heights (half floats, linear filtering): the vertex shader lays each vertex on the relief.
    const F = this.field, side = F.r * 2, N = Math.ceil(side / PAINT.field), tex = new Uint16Array(N * N);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) tex[j * N + i] = THREE.DataUtils.toHalfFloat(this.heightAt(F.x - F.r + (i + 0.5) * side / N, F.z - F.r + (j + 0.5) * side / N));
    this.heightTex = new THREE.DataTexture(tex, N, N, THREE.RedFormat, THREE.HalfFloatType);
    this.heightTex.minFilter = this.heightTex.magFilter = THREE.LinearFilter;
    this.heightTex.needsUpdate = true;
    const n = PAINT.capacity;
    this._a = new THREE.InstancedBufferAttribute(new Float32Array(n * 4), 4).setUsage(THREE.DynamicDrawUsage);
    this._b = new THREE.InstancedBufferAttribute(new Float32Array(n * 4), 4).setUsage(THREE.DynamicDrawUsage);
    this._c = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3).setUsage(THREE.DynamicDrawUsage);
    ig.setAttribute('aA', this._a);
    ig.setAttribute('aB', this._b);
    ig.setAttribute('aCol', this._c);
    this.geometry = ig;
    this.uniforms = {
      uTime: { value: 0 },
      uHeight: { value: this.heightTex },
      uField: { value: new THREE.Vector4(F.x - F.r, F.z - F.r, side, 0) },
      uRim: { value: new THREE.Color(PAINT.colors.rim) },
      uInk: { value: new THREE.Color(PAINT.colors.ink) },
    };
    this.material = new THREE.ShaderMaterial({
      uniforms: this.uniforms, vertexShader: VERTEX, fragmentShader: FRAGMENT,
      transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false,
      polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8,
    });
    const mesh = new THREE.InstancedMesh(ig, this.material, n);
    mesh.name = 'Paint';
    mesh.count = 0;
    mesh.frustumCulled = false;      // positions in the instance matrices, geometry box not representative
    mesh.castShadow = mesh.receiveShadow = false;
    mesh.matrixAutoUpdate = false;
    mesh.renderOrder = 1.5;          // after the arena disc (1), before the wall (2) and the sparks (3)
    mesh.raycast = () => {};         // never hit by Picker.js or Occlusion.js
    this.parent.add(mesh);
    this.mesh = mesh;
  }

  /**
   * Places a shape.
   * @param {object} o `kind` 'puddle' | 'trail' | 'zone'; `x`, `z`: centre (disc) or START (strip);
   *   `yaw`: strip direction (rad, forward = +z); `radius` (disc); `length`, `width` (strip); `warn`, `life`, `grow` (s).
   * @returns {object} the shape (read-only outside this file)
   */
  spawn(o) {
    if (!this.mesh) this._build();
    if (this.list.length >= PAINT.capacity) this.list.shift();
    const strip = KIND[o.kind] === 1;
    const h = {
      kind: o.kind, strip, x: o.x, z: o.z, yaw: o.yaw ?? 0, radius: o.radius ?? 0,
      length: o.length ?? 0, width: o.width ?? 0, warn: Math.max(0.01, o.warn ?? 1), life: o.life ?? 5,
      grow: o.grow ?? 0, age: 0, dying: -1, seed: (this._seed = (this._seed * 7.31 + 0.6180339) % 1),
    };
    if (strip) {
      h.dx = Math.sin(h.yaw); h.dz = Math.cos(h.yaw);
      h.cx = h.x + h.dx * h.length / 2; h.cz = h.z + h.dz * h.length / 2;
    } else { h.cx = h.x; h.cz = h.z; }
    this.list.push(h);
    this._write();
    return h;
  }

  /**
   * Shape phase: [phase, progress 0 to 1, opacity]. Phase 0 warning, 1 painted (hurts), 2 end-of-life fade, -1 to
   * remove. A shape removed by `clear(true)` keeps its phase and loses its opacity.
   */
  _phase(h) {
    const t = h.age;
    if (h.dying >= 0) {
      if (h.dying >= PAINT.quickFade) return [-1, 1, 0];
      const a = 1 - h.dying / PAINT.quickFade;
      return t < h.warn ? [0, t / h.warn, a] : [1, Math.min(1, (t - h.warn) / h.life), a];
    }
    if (t < h.warn) return [0, t / h.warn, 1];
    if (t < h.warn + h.life) return [1, (t - h.warn) / h.life, 1];
    if (t < h.warn + h.life + PAINT.fade) return [2, (t - h.warn - h.life) / PAINT.fade, 1];
    return [-1, 1, 0];
  }

  /** Current radius of a painted disc (puddles spread). */
  _radiusNow(h) {
    if (h.grow <= 0 || h.kind !== 'puddle') return h.radius;
    const x = Math.min(1, Math.max(0, (h.age - h.warn) / h.grow));
    const e = 1 - (1 - x) ** 3;
    return h.radius * (PAINT.puddleStart + (1 - PAINT.puddleStart) * e);
  }

  /** Advances the clocks and rewrites the instances. */
  update(dt) {
    if (!this.mesh) return;
    this.uniforms.uTime.value += dt;
    for (const h of this.list) { if (h.dying >= 0) h.dying += dt; else h.age += dt; }
    this.list = this.list.filter((h) => this._phase(h)[0] >= 0);
    this._write();
  }

  _write() {
    const mesh = this.mesh, A = this._a.array, B = this._b.array, C = this._c.array;
    let n = 0;
    for (const h of this.list) {
      const [phase, k, alpha] = this._phase(h);
      if (phase < 0) continue;
      const strip = h.strip;
      const gr = strip ? 1 : phase === 0 ? 1 : this._radiusNow(h) / h.radius;
      A[n * 4] = strip ? 1 : 0; A[n * 4 + 1] = phase; A[n * 4 + 2] = k; A[n * 4 + 3] = gr;
      B[n * 4] = strip ? h.length : h.radius; B[n * 4 + 1] = h.width; B[n * 4 + 2] = h.seed; B[n * 4 + 3] = alpha;
      const col = this._cols[h.kind];
      C[n * 3] = col.r; C[n * 3 + 1] = col.g; C[n * 3 + 2] = col.b;
      _q.setFromAxisAngle(_up, h.yaw);
      _p.set(h.cx, 0, h.cz); // height comes from the shader (ground height texture)
      if (strip) _s.set(h.width + 2 * PAINT.pad, 1, h.length + 2 * PAINT.pad);
      else { const side = 2 * (h.radius * (1 + PAINT.wobble[0] + PAINT.wobble[1]) + PAINT.pad); _s.set(side, 1, side); }
      mesh.setMatrixAt(n, _m.compose(_p, _q, _s));
      n++;
    }
    mesh.count = n;
    mesh.instanceMatrix.needsUpdate = true;
    this._a.needsUpdate = this._b.needsUpdate = this._c.needsUpdate = true;
  }

  /**
   * First painted shape (which hurts) touched by a circle of radius `r` at (x, z), or null.
   * Warned, fading or removed shapes never touch.
   */
  touch(x, z, r = PAINT.catR) {
    for (const h of this.list) {
      if (h.dying >= 0 || this._phase(h)[0] !== 1) continue;
      if (h.strip) {
        const px = x - h.x, pz = z - h.z;
        const s = Math.min(h.length, Math.max(0, px * h.dx + pz * h.dz));
        const d = Math.hypot(px - h.dx * s, pz - h.dz * s);
        if (d <= h.width / 2 + r) return h;
      } else {
        const dx = x - h.cx, dz = z - h.cz;
        const R = this._radiusNow(h) * wobble(Math.atan2(dz, dx), h.seed);
        if (Math.hypot(dx, dz) <= R + r) return h;
      }
    }
    return null;
  }

  /**
   * Is a circle of radius `r` at (x, z) under a warned or painted shape (final radius, maximum wobble)?
   * Used to place a shape without closing another shape's exit (bossMoves.js `_exit`).
   */
  covers(x, z, r = PAINT.catR) {
    const wob = 1 + PAINT.wobble[0] + PAINT.wobble[1];
    for (const h of this.list) {
      if (h.dying >= 0 || this._phase(h)[0] > 1) continue;
      if (h.strip) {
        const px = x - h.x, pz = z - h.z;
        const s = Math.min(h.length, Math.max(0, px * h.dx + pz * h.dz));
        if (Math.hypot(px - h.dx * s, pz - h.dz * s) <= h.width / 2 * (1 + PAINT.strip.edgeWobble) + r) return true;
      } else if (Math.hypot(x - h.cx, z - h.cz) <= h.radius * wob + r) return true;
    }
    return false;
  }

  /** Number of shapes of a kind (all phases); without argument: all. */
  count(kind) { return kind ? this.list.filter((h) => h.kind === kind).length : this.list.length; }

  /** Current shapes, readable (for tests): kind, centre, phase. */
  get state() {
    return this.list.map((h) => ({
      kind: h.kind, x: Math.round(h.cx * 100) / 100, z: Math.round(h.cz * 100) / 100,
      phase: h.dying >= 0 ? 'fading' : ['warning', 'painted', 'fading'][this._phase(h)[0]] ?? 'end', age: Math.round(h.age * 100) / 100,
    }));
  }

  /** Removes everything: at once (`quick` false) or by a short fade (`quick` true, advanced by `update`). */
  clear(quick = false) {
    if (quick) { for (const h of this.list) if (h.dying < 0) h.dying = 0; }
    else this.list = [];
    if (this.mesh) this._write();
  }

  dispose() {
    this.list = [];
    if (!this.mesh) return;
    this.parent.remove(this.mesh);
    this.mesh.dispose?.();
    this.geometry.dispose();
    this.material.dispose();
    this.heightTex.dispose();
    this.mesh = null;
  }
}
