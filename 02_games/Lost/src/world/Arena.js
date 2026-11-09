/**
 * Arena of the fight against the Chartiste, created and driven by World.js. A disc laid over the terrain builds itself up
 * in blue: grid lines traced from the centre, a rotating sweep, hexagons that appear with a flash, a ring of light running
 * to the edge, then a glowing rim. Around the disc there is only a starry night.
 *
 * Each disc vertex sits at `heightAt` + LIFT, without changing the terrain: characters still walk on the terrain (1 cm
 * under the disc, invisible), and `polygonOffset` keeps the disc in front of the ground between vertices.
 * Cost: 2 draw calls (disc, night), no cast shadow, no allocation per frame.
 *
 * API: `place(x, z, radius)` builds the geometry (nothing is drawn before); `build(duration)` and `unbuild(duration)` play
 * the construction forward or backward (`progress`, `building`, `unbuilding`, `built`, callbacks `onBuilt` and `onUnbuilt`);
 * `setProgress(p)` poses one instant; `clear()` removes everything at once; `update(dt)` runs every frame;
 * `setPhase2(on, instant)` turns the arena from blue to dark red (`phase2`); `center`, `radius`, `stats`.
 */

import * as THREE from 'three';
import { heightAt as terrainHeightAt } from './Terrain.js';

export const BUILD_TIME = 5;        // s: suggested construction time
export const LIFT = 0.01;           // m: disc above the ground
const RING_STEP = 0.4;              // m: spacing between two vertex rings of the disc
const SEGMENTS = 128;               // sectors of the disc and the night
const GRID = 1.0;                   // m: grid line spacing
const HEX = 0.9;                    // m: hexagon size on the floor (distance between neighbouring centres)
/** Margin (m) added to the radius to hide the scenery around the disc (World.js). */
export const HIDE_MARGIN = 0.86;

/**
 * Starry night of the fight: a shell (cylinder closed at the top, starry ground ring draped on the terrain around the disc)
 * surrounds the arena. Its shader paints a night sky from the view DIRECTION (camera to pixel), so from inside it reads as
 * an infinite sky, above and below the horizon. Once opaque it hides the daytime scenery by depth, and World.js also hides
 * those groups at full night to save draw calls.
 * - `margin`: shell radius = disc radius + `margin` (m); the fight camera stays above the disc (Story._keepInArena), so inside.
 * - `height`: roof height (m) above the lowest point of the rim; the fight camera is at most 21.8 m high.
 * - `step`: ring spacing of the starry ground (m), same as the disc (RING_STEP) to follow the terrain the same way.
 * - `fade`: construction fractions where night falls (transparent at `fade[0]`, opaque at `fade[1]`), during the grid tracing.
 * - `zenith`, `horizon`: night blue background, darker than the disc so its blue floor stays the only readable ground.
 * - `star`: star colour; `stars`: two layers [scale, share of lit cells, radius in cells]; scale 180 gives cells of about
 *   6 px at 1280 x 800, radius 0.22 about 1.3 px; layer 2 is rarer and larger (bright stars).
 * - `twinkle`: twinkle amplitude (share of brightness), at `twinkleRate` rad/s.
 * - `fog`: fog colour during the night (World.js) = `horizon`: the far edge of the disc melts into the night.
 */
export const NIGHT = {
  margin: 5.2,
  height: 80,
  step: 0.4,
  fade: [0.02, 0.4],
  zenith: 0x040916,
  horizon: 0x0c1a3e,
  star: 0xe4eeff,
  stars: [[180, 0.08, 0.22], [70, 0.025, 0.16]],
  twinkle: 0.35,
  twinkleRate: 2.2,
  fog: 0x0c1a3e,
};
/**
 * Keeps the kitten on the disc during the arena (`clampInside`, main.js): a click on the starry ground targets the nearest
 * point of the disc, `WALK_MARGIN` m from the edge (0.6 m: body radius 0.2 + kitten half-length 0.25 + the glowing rim).
 */
export const WALK_MARGIN = 0.6;

/** Colours of the construction (blues). */
export const ARENA_COLORS = {
  floor: 0x1b3a78,  // hexagon face (lit by the sun)
  line: 0x3fa8ff,   // grid lines and hexagon edges
  glow: 0xbfe8ff,   // sweep, ring, line tips
};

/**
 * Boss phase 2 (at half health): the arena catches fire.
 * - `time`: transition duration (s), both ways; long enough to read as a change of state, short enough to land with the
 *   hit that crosses the threshold.
 * - `flash`: duration (s) of the flash of the change (floor lit at once, then back).
 * - `beat`: factor added to the pulse speed of the hexagon edges (rad/s; 1.4 to 3.1 at 1.7).
 * - `colors`: same roles as ARENA_COLORS and NIGHT, dark red with orange glints; clear red lines read as danger; never pure black.
 */
export const PHASE2 = {
  time: 1.4,
  flash: 0.9,
  beat: 1.7,
  colors: {
    floor: 0x4a1226, line: 0xff5a6e, glow: 0xffd2b8,
    zenith: 0x14040c, horizon: 0x3d0f24, star: 0xffd6c8,
  },
};

// Construction instants (fraction of the duration).
const T = {
  gridEnd: 0.38,               // grid lines traced
  scan: [0.04, 0.55],          // rotating sweep
  hex: [0.26, 0.7],            // hexagons (centre to edge, some randomness)
  ring: [0.55, 0.82],          // ring of light, centre to edge
  rim: [0.58, 0.88],           // glowing rim of the disc
};

const smooth = (a, b, x) => { const t = Math.min(Math.max((x - a) / (b - a), 0), 1); return t * t * (3 - 2 * t); };

/** GLSL code of the disc: uniforms and random helper. */
const COMMON = /* glsl */`
uniform float uP;
uniform float uTime;
uniform float uR;
uniform vec2 uCenter;
uniform vec3 uLine;
uniform vec3 uGlow;
uniform float uP2;
uniform float uFlash;
varying vec2 vArena;
float aHash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
`;

const DISK_FRAGMENT = /* glsl */`
{
  vec2 d = vArena - uCenter;
  float r = length(d);
  float inside = 1.0 - smoothstep(uR - 0.04, uR, r);
  // 1) Grid lines: each starts at the centre and runs to the edge (per-line random delay).
  vec2 g = d / ${GRID.toFixed(2)};
  vec2 gi = floor(g + 0.5);
  vec2 gd = abs(g - gi) * ${GRID.toFixed(2)};
  float lineX = 1.0 - smoothstep(0.012, 0.04, gd.y); // line parallel to x (constant z)
  float lineZ = 1.0 - smoothstep(0.012, 0.04, gd.x);
  float hx = aHash(vec2(gi.y, 3.1)), hz = aHash(vec2(gi.x, 7.7));
  float fx = uR * 1.2 * clamp((uP - 0.02 - 0.14 * hx) / ${(T.gridEnd - 0.16).toFixed(3)}, 0.0, 1.0);
  float fz = uR * 1.2 * clamp((uP - 0.02 - 0.14 * hz) / ${(T.gridEnd - 0.16).toFixed(3)}, 0.0, 1.0);
  float ax = lineX * step(abs(d.x), fx), az = lineZ * step(abs(d.y), fz);
  float tip = max(ax * (1.0 - smoothstep(0.0, 0.7, fx - abs(d.x))) * step(fx, uR * 1.19),
                  az * (1.0 - smoothstep(0.0, 0.7, fz - abs(d.y))) * step(fz, uR * 1.19));
  float grid = max(ax, az);
  // 2) Hexagons: each cell appears (with a flash) at its own time, from the centre to the edge.
  vec2 hp = d / ${HEX.toFixed(2)};
  const vec2 hs = vec2(1.0, 1.7320508);
  vec4 hc = floor(vec4(hp, hp - vec2(0.5, 1.0)) / hs.xyxy) + 0.5;
  vec4 hh = vec4(hp - hc.xy * hs, hp - (hc.zw + 0.5) * hs);
  vec4 cell = dot(hh.xy, hh.xy) < dot(hh.zw, hh.zw) ? vec4(hh.xy, hc.xy) : vec4(hh.zw, hc.zw + 0.5);
  vec2 ha = abs(cell.xy);
  float hexEdge = 0.5 - max(dot(ha, vec2(0.5, 0.8660254)), ha.x);
  float rc = length(cell.zw * hs) * ${HEX.toFixed(2)} / uR;
  float th = ${T.hex[0].toFixed(3)} + ${(T.hex[1] - T.hex[0] - 0.06).toFixed(3)} * clamp(0.7 * rc + 0.3 * aHash(cell.zw), 0.0, 1.0);
  float appear = smoothstep(th, th + 0.05, uP);
  float flash = appear * (1.0 - smoothstep(th + 0.02, th + 0.14, uP));
  float edge = 1.0 - smoothstep(0.015, 0.05, hexEdge);
  // 3) Rotating sweep, then a ring of light from the centre to the edge.
  float ang = atan(d.y, d.x);
  float sweepA = uP * 25.13;
  float wedge = fract((sweepA - ang) / 6.2831853);
  float scan = exp(-wedge * 9.0) * smoothstep(${T.scan[0].toFixed(3)}, ${(T.scan[0] + 0.05).toFixed(3)}, uP)
             * (1.0 - smoothstep(${(T.scan[1] - 0.08).toFixed(3)}, ${T.scan[1].toFixed(3)}, uP));
  float ringR = uR * 1.08 * clamp((uP - ${T.ring[0].toFixed(3)}) / ${(T.ring[1] - T.ring[0]).toFixed(3)}, 0.0, 1.0);
  float ringOn = step(${T.ring[0].toFixed(3)}, uP) * (1.0 - smoothstep(${(T.ring[1] - 0.02).toFixed(3)}, ${(T.ring[1] + 0.04).toFixed(3)}, uP));
  float ring = exp(-pow((r - ringR) / 0.32, 2.0)) * ringOn;
  float rim = exp(-pow((r - uR + 0.1) / 0.07, 2.0)) * smoothstep(${T.rim[0].toFixed(3)}, ${T.rim[1].toFixed(3)}, uP);
  // Finished arena: hexagon edges pulse gently, from the centre to the edge.
  float pulse = 0.5 + 0.5 * sin(uTime * (1.4 + ${PHASE2.beat.toFixed(2)} * uP2) - r * 0.7);
  float gridKeep = 1.0 - 0.8 * appear;
  diffuseColor.rgb = mix(uLine * 0.35, diffuseColor.rgb, appear);
  diffuseColor.a = inside * clamp(max(max(appear, grid * gridKeep * 0.9), max(ring, scan * 0.35) + rim), 0.0, 1.0);
  totalEmissiveRadiance = uLine * (grid * gridKeep * 0.9 + edge * appear * (0.35 + 0.25 * pulse) + flash * 0.9)
    + uGlow * (tip * 1.2 + ring * 1.3 + scan * 0.45 * (0.3 + grid) + rim * 0.9 + flash * edge * 0.8 + uFlash * appear * (0.3 + 0.7 * edge));
  // Nothing to paint: no depth write (only the ground remains visible).
  if (diffuseColor.a < 0.003) discard;
}
`;

/** Starry night (NIGHT): colour from the camera-to-pixel direction, not from the position. */
const NIGHT_VERTEX = /* glsl */`
varying vec3 vWorld;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;

const NIGHT_FRAGMENT = /* glsl */`
uniform float uNight;
uniform float uTime;
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uStar;
uniform vec3 uLayers[2];
uniform vec2 uTwinkle;
varying vec3 vWorld;
float nHash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float starLayer(vec3 d, vec3 L) {
  vec3 p = d * L.x, c = floor(p);
  float h = nHash(c);
  if (h > L.y) return 0.0;
  vec3 o = vec3(nHash(c + 11.1), nHash(c + 23.7), nHash(c + 37.3)) * 0.6 + 0.2;
  float r = length(p - c - o);
  float tw = 1.0 - uTwinkle.x * (0.5 + 0.5 * sin(uTime * uTwinkle.y + h * 917.0));
  return (1.0 - smoothstep(L.z * 0.35, L.z, r)) * (0.45 + 0.55 * nHash(c + 5.3)) * tw;
}
void main() {
  vec3 d = normalize(vWorld - cameraPosition);
  // Background: horizon slightly lighter, zenith and nadir dark (the "ground" is sky as well).
  vec3 c = mix(uHorizon, uZenith, smoothstep(0.0, 0.7, abs(d.y)));
  float s = starLayer(d, uLayers[0]) + starLayer(d, uLayers[1]);
  c = mix(c, uStar, clamp(s, 0.0, 1.0));
  gl_FragColor = vec4(c, uNight);
  #include <colorspace_fragment>
}
`;

export class Arena {
  /**
   * @param {THREE.Object3D} scene
   * @param {object} [opts]
   * @param {(x:number, z:number) => number} [opts.heightAt]  ground height (Terrain.js by default)
   */
  constructor(scene, { heightAt = terrainHeightAt } = {}) {
    this.scene = scene;
    this.heightAt = heightAt;
    this.group = new THREE.Group();
    this.group.name = 'Arena';
    this.group.visible = false;
    this.center = { x: 0, z: 0 };
    this.radius = 0;
    this.progress = 0;
    this.duration = BUILD_TIME;
    this.building = false;
    this.onBuilt = null;
    this.unbuilding = false; // arena teardown in progress (unbuild)
    this.onUnbuilt = null;
    this.time = 0;

    this.uniforms = {
      uP: { value: 0 },
      uTime: { value: 0 },
      uR: { value: 1 },
      uCenter: { value: new THREE.Vector2() },
      uLine: { value: new THREE.Color(ARENA_COLORS.line) },
      uGlow: { value: new THREE.Color(ARENA_COLORS.glow) },
      uP2: { value: 0 },    // phase 2: transition progress (0 blue, 1 red)
      uFlash: { value: 0 }, // phase 2: flash of the change (1 to 0)
    };
    const U = this.uniforms;
    // Phase 2: start colours (copies) and end colours; the transition blends the two (`_applyPhase2`).
    this._p2 = 0;            // displayed progress
    this._p2Target = 0;      // requested (0 or 1)
    this._flash = 0;
    const C = (h) => new THREE.Color(h);
    this._baseCol = { floor: C(ARENA_COLORS.floor), line: C(ARENA_COLORS.line), glow: C(ARENA_COLORS.glow), zenith: C(NIGHT.zenith), horizon: C(NIGHT.horizon), star: C(NIGHT.star) };
    this._p2Col = Object.fromEntries(Object.entries(PHASE2.colors).map(([k, h]) => [k, C(h)]));

    // Disc: Lambert (receives the sun's shadow, fog), pattern injected into the emission.
    this.diskMaterial = new THREE.MeshLambertMaterial({
      color: ARENA_COLORS.floor, transparent: true, depthWrite: true,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4,
    });
    this.diskMaterial.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, U);
      sh.vertexShader = 'varying vec2 vArena;\n' + sh.vertexShader.replace(
        '#include <begin_vertex>', '#include <begin_vertex>\n  vArena = (modelMatrix * vec4(position, 1.0)).xz;');
      sh.fragmentShader = COMMON + sh.fragmentShader.replace('#include <emissivemap_fragment>',
        '#include <emissivemap_fragment>\n' + DISK_FRAGMENT);
    };
    this.diskMaterial.customProgramCacheKey = () => 'lost-arena-disk';

    // Starry night (NIGHT): shader only, no fog or tone mapping (colours as they are, like the painted sky); transparent
    // while night falls, then alpha 1. Drawn before the disc (`renderOrder` -1, disc 1); writes depth (hides the scenery beyond).
    this.nightMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uNight: { value: 0 },
        uTime: U.uTime,
        uZenith: { value: new THREE.Color(NIGHT.zenith) },
        uHorizon: { value: new THREE.Color(NIGHT.horizon) },
        uStar: { value: new THREE.Color(NIGHT.star) },
        uLayers: { value: NIGHT.stars.map((l) => new THREE.Vector3(...l)) },
        uTwinkle: { value: new THREE.Vector2(NIGHT.twinkle, NIGHT.twinkleRate) },
      },
      vertexShader: NIGHT_VERTEX,
      fragmentShader: NIGHT_FRAGMENT,
      transparent: true, depthWrite: true, side: THREE.DoubleSide, fog: false, toneMapped: false,
      polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2, // in front of the terrain, behind the disc
    });

    this.disk = null;
    this.night = null; // starry shell (NIGHT), built by `place`
  }

  /** Builds (or rebuilds) the disc and the starry night around (x, z). */
  place(x, z, radius) {
    this._disposeGeometry();
    this.setPhase2(false, true);
    this.center = { x, z };
    this.radius = radius;
    this.uniforms.uR.value = radius;
    this.uniforms.uCenter.value.set(x, z);
    const H = this.heightAt;

    // ---------------------------------------------------------------- disc (polar rings)
    const rings = Math.max(4, Math.ceil(radius / RING_STEP));
    const pos = [x, H(x, z) + LIFT, z];
    for (let k = 1; k <= rings; k++) {
      const r = (k / rings) * radius;
      for (let s = 0; s < SEGMENTS; s++) {
        const a = (s / SEGMENTS) * Math.PI * 2;
        const px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
        pos.push(px, H(px, pz) + LIFT, pz);
      }
    }
    const idx = [];
    for (let s = 0; s < SEGMENTS; s++) idx.push(0, 1 + ((s + 1) % SEGMENTS), 1 + s);
    for (let k = 1; k < rings; k++) {
      const a0 = 1 + (k - 1) * SEGMENTS, b0 = 1 + k * SEGMENTS;
      for (let s = 0; s < SEGMENTS; s++) {
        const s1 = (s + 1) % SEGMENTS;
        idx.push(a0 + s, a0 + s1, b0 + s, a0 + s1, b0 + s1, b0 + s);
      }
    }
    const dg = new THREE.BufferGeometry();
    dg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    dg.setIndex(idx);
    dg.computeVertexNormals();
    dg.computeBoundingSphere();
    this.disk = new THREE.Mesh(dg, this.diskMaterial);
    this.disk.name = 'Arena_disk';
    this.disk.receiveShadow = true;
    this.disk.castShadow = false;
    this.disk.renderOrder = 1;
    this.disk.matrixAutoUpdate = false;

    // ---------------------------------------------------------------- starry night (NIGHT)
    this.night = new THREE.Mesh(this._nightGeometry(x, z, radius), this.nightMaterial);
    this.night.name = 'Arena_night';
    this.night.renderOrder = -1;
    this.night.frustumCulled = false; // surrounds the camera
    this.night.matrixAutoUpdate = false;
    this.night.raycast = () => {}; // never hit by Picker.js (the terrain below stays the target)

    this.group.add(this.disk, this.night);
    if (!this.group.parent) this.scene.add(this.group);
    this.setProgress(0);
    return this;
  }

  /**
   * Night shell geometry (NIGHT), world coordinates: ground ring draped on the terrain, from the disc edge (same vertices as
   * its last ring: no gap) to `radius` + NIGHT.margin + 0.3 m; cylindrical wall at `radius` + NIGHT.margin, from 3 m below the lowest rim point up
   * to the roof (`NIGHT.height`); flat roof.
   */
  _nightGeometry(x, z, radius) {
    const H = this.heightAt, RS = radius + NIGHT.margin, r0 = radius, r1 = RS + 0.3;
    const pos = [], idx = [];
    const rings = Math.max(2, Math.ceil((r1 - r0) / NIGHT.step));
    let low = Infinity;
    for (let k = 0; k <= rings; k++) {
      const r = r0 + (k / rings) * (r1 - r0);
      for (let s = 0; s < SEGMENTS; s++) {
        const a = (s / SEGMENTS) * Math.PI * 2;
        const px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r, y = H(px, pz) + LIFT;
        pos.push(px, y, pz);
        low = Math.min(low, y);
      }
    }
    for (let k = 0; k < rings; k++) {
      const a0 = k * SEGMENTS, b0 = (k + 1) * SEGMENTS;
      for (let s = 0; s < SEGMENTS; s++) {
        const s1 = (s + 1) % SEGMENTS;
        idx.push(a0 + s, a0 + s1, b0 + s, a0 + s1, b0 + s1, b0 + s);
      }
    }
    const y0 = low - 3, y1 = low + NIGHT.height, w0 = pos.length / 3;
    for (let s = 0; s < SEGMENTS; s++) {
      const a = (s / SEGMENTS) * Math.PI * 2, px = x + Math.cos(a) * RS, pz = z + Math.sin(a) * RS;
      pos.push(px, y0, pz, px, y1, pz);
    }
    for (let s = 0; s < SEGMENTS; s++) {
      const b = w0 + s * 2, n = w0 + ((s + 1) % SEGMENTS) * 2;
      idx.push(b, n, b + 1, b + 1, n, n + 1);
    }
    const top = pos.length / 3;
    pos.push(x, y1, z);
    for (let s = 0; s < SEGMENTS; s++) idx.push(top, w0 + s * 2 + 1, w0 + ((s + 1) % SEGMENTS) * 2 + 1);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeBoundingSphere();
    return g;
  }

  /** Share of night fallen, 0 to 1 (0 if the arena is not shown); read by World.js (fog, scenery). */
  get nightLevel() { return this.group.visible ? this.nightMaterial.uniforms.uNight.value : 0; }

  /** Brings a point (x, z modified in place) back onto the disc, at least WALK_MARGIN m from the edge. */
  clampInside(point) {
    const R = this.radius - WALK_MARGIN, dx = point.x - this.center.x, dz = point.z - this.center.z, d = Math.hypot(dx, dz);
    if (R > 0 && d > R) { point.x = this.center.x + dx / d * R; point.z = this.center.z + dz / d * R; point.y = this.heightAt(point.x, point.z); }
    return point;
  }

  /** Starts the construction (from 0); `duration` in seconds. */
  build(duration = BUILD_TIME) {
    if (!this.disk) throw new Error('Arena.build: call place(x, z, radius) first.');
    this.duration = Math.max(0.1, duration);
    this.building = true;
    this._doneSent = false;
    this.group.visible = true;
    this.setProgress(0);
  }

  /**
   * Arena teardown (victory): from the current progress down to 0, in `duration` s for a full arena (rim, hexagons, then
   * grid disappear; the night lifts over the last 40%). Does nothing if the arena is not shown.
   */
  unbuild(duration = BUILD_TIME) {
    if (!this.group.visible) return;
    this.duration = Math.max(0.1, duration);
    this.building = false;
    this.unbuilding = true;
  }

  /** Arena fully built (progress at 1). */
  get built() { return this.group.visible && this.progress >= 1; }

  /** Poses one instant of the construction, 0 to 1 (without changing `building`). */
  setProgress(p) {
    this.progress = Math.min(Math.max(p, 0), 1);
    const t = this.progress;
    this.uniforms.uP.value = t;
    // Night: falls during the grid tracing (NIGHT.fade).
    this.nightMaterial.uniforms.uNight.value = smooth(NIGHT.fade[0], NIGHT.fade[1], t);
  }

  /** Removes everything at once (nothing is drawn anymore). Disc and night keep their geometry for a later `build`. */
  clear() {
    this.building = false;
    this.unbuilding = false;
    this.group.visible = false;
    this.setPhase2(false, true);
    this.setProgress(0);
  }

  /** Requested phase 2; true as soon as it is requested, before the transition ends. */
  get phase2() { return this._p2Target > 0.5; }

  /**
   * Boss phase 2: `on` true turns the arena red in PHASE2.time s with a flash; false brings it back to blue.
   * `instant`: no transition and no flash (reset by `clear` and `place`).
   */
  setPhase2(on, instant = false) {
    const target = on ? 1 : 0;
    if (instant) {
      this._p2 = this._p2Target = target;
      this._flash = 0;
      this._applyPhase2();
      return;
    }
    if (target === this._p2Target) return;
    this._p2Target = target;
    if (on) this._flash = 1;
  }

  /** Blends start and end colours at progress `_p2`; the `uP2` and `uFlash` uniforms follow. */
  _applyPhase2() {
    const k = this._p2, B = this._baseCol, Q = this._p2Col, U = this.uniforms;
    U.uP2.value = k;
    U.uFlash.value = this._flash;
    U.uLine.value.lerpColors(B.line, Q.line, k);
    U.uGlow.value.lerpColors(B.glow, Q.glow, k);
    this.diskMaterial.color.lerpColors(B.floor, Q.floor, k);
    const N = this.nightMaterial.uniforms;
    N.uZenith.value.lerpColors(B.zenith, Q.zenith, k);
    N.uHorizon.value.lerpColors(B.horizon, Q.horizon, k);
    N.uStar.value.lerpColors(B.star, Q.star, k);
  }

  /** Every frame (World.update). */
  update(dt) {
    if (!this.group.visible) return;
    this.time += dt;
    this.uniforms.uTime.value = this.time;
    if (this._p2 !== this._p2Target || this._flash > 0) {
      const step = dt / PHASE2.time;
      this._p2 = this._p2 < this._p2Target ? Math.min(this._p2Target, this._p2 + step) : Math.max(this._p2Target, this._p2 - step);
      this._flash = Math.max(0, this._flash - dt / PHASE2.flash);
      this._applyPhase2();
    }
    if (this.unbuilding) {
      this.setProgress(this.progress - dt / this.duration);
      if (this.progress <= 0) { this.unbuilding = false; this.onUnbuilt?.(this); }
      return;
    }
    if (!this.building) return;
    this.setProgress(this.progress + dt / this.duration);
    if (this.progress >= 1) {
      this.building = false;
      if (!this._doneSent) { this._doneSent = true; this.onBuilt?.(this); }
    }
  }

  /** Counts: triangles and draw calls (no cast shadow). */
  get stats() {
    if (!this.disk) return { drawCalls: 0 };
    const tri = (g) => (g.index ? g.index.count : g.attributes.position.count) / 3;
    return {
      drawCalls: 1 + (this.night ? 1 : 0), shadowDrawCalls: 0,
      nightTriangles: this.night ? tri(this.night.geometry) : 0,
      diskTriangles: tri(this.disk.geometry),
    };
  }

  _disposeGeometry() {
    for (const m of [this.disk, this.night]) {
      if (!m) continue;
      this.group.remove(m);
      m.geometry.dispose();
    }
    this.disk = this.night = null;
  }

  dispose() {
    this._disposeGeometry();
    this.group.parent?.remove(this.group);
    this.diskMaterial.dispose();
    this.nightMaterial.dispose();
  }
}
