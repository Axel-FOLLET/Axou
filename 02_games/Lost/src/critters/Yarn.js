import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { YARN, toonMaterial, outlineMaterial, color } from '../style/palette.js';
import { MEADOW_LIMIT } from '../world/field.js';
import { heightAt as terrainHeightAt } from '../world/Terrain.js';

/**
 * Yarn ball: 11 cm sphere thrown in an arc, with damped bounces, rolling friction (stronger in tall grass
 * when a height function is given), spin matching the roll and a trailing thread (simulated rope).
 * Created by main.js; Launcher.js throws it, Brain.js chases it.
 *
 * Independent of the cat: it receives the scene, then `update(dt, catPosition)` every frame.
 * Ground: `heightAt` of Terrain.js (or the `groundAt` option) plus the tops of low walls. Walls (`ruins`
 * option or `setRuins`, Ruins.js) bounce it back. World frame, metres, seconds.
 * It stays inside the `bounds` disc (default: the meadow, `MEADOW_LIMIT`) and bounces softly off its edge.
 * States (`state`): `rest`, `air` (flying or bouncing), `rolling`.
 */

const G = 9.81;  // m/s²
const EDGE_BOUNCE = 0.35;       // share of the outward speed returned inward at the edge
const EDGE_KEEP = 0.7;          // share of the speed along the edge kept on contact
const EDGE_MARGIN = 0.3;        // m, an aimed point is pulled at least this far inside the edge
/**
 * Floating marker shown when the ball is hidden in tall grass. radius: dot radius (m); showAbove: mean
 * grass height above which it appears (m, the ball is 0.11 m wide); lift: margin above the tufts (m);
 * bob: float amplitude (m); pulse: breathing amplitude (share of the radius); fade: fade rate (1/s).
 */
const MARKER = { radius: 0.05, showAbove: 0.3, lift: 0.14, bob: 0.03, pulse: 0.1, fade: 4 };
const WALL_BOUNCE = 0.5;        // share of the speed into the wall returned as a bounce
const WALL_KEEP = 0.8;          // share of the speed along the wall kept on contact
const STEP = 1 / 120;           // s, simulation substep (keeps bounces and the rope stable at large dt)
const _v = new THREE.Vector3();
const _w = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _t = new THREE.Vector3();
const _res = { x: 0, z: 0, hit: null };

/**
 * Ball geometry: a core plus a dozen randomly oriented thread loops (tori), with vertex colours.
 * Without `hex`: three tones of `YARN` (palette.js); otherwise tones derived from `hex`.
 * Thick round loops (tube 0.1 × radius, 6 sides) give a soft look.
 */
function yarnGeometry(radius, hex, rng) {
  const base = color(hex ?? YARN.base);
  const light = hex == null ? color(YARN.light) : base.clone().lerp(color(0xffffff), 0.25);
  const dark = hex == null ? color(YARN.dark) : base.clone().multiplyScalar(0.7);
  const paint = (g, c) => {
    const n = g.attributes.position.count, a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(a, 3));
    g.deleteAttribute('uv');
    return g;
  };
  const parts = [paint(new THREE.IcosahedronGeometry(radius * 0.92, 2), dark)];
  const e = new THREE.Euler();
  for (let i = 0; i < 12; i++) {
    const t = new THREE.TorusGeometry(radius * (0.9 + 0.04 * rng()), radius * 0.1, 6, 36).toNonIndexed();
    e.set(rng() * Math.PI, rng() * Math.PI, rng() * Math.PI);
    t.applyQuaternion(_q.setFromEuler(e));
    parts.push(paint(t, i % 3 === 0 ? dark : i % 3 === 1 ? base : light));
  }
  const g = mergeGeometries(parts);
  parts.forEach((p) => p.dispose());
  return g;
}

export class Yarn {
  /**
   * @param {THREE.Object3D} scene
   * @param {object} [options]
   * @param {number} [options.radius=0.055]        m (11 cm diameter)
   * @param {number} [options.color]               single colour (hex); default: the three `YARN` tones
   * @param {THREE.Vector3} [options.position]     start position on the ground (centre at y = radius)
   * @param {number} [options.restitution=0.35]    vertical bounce kept (0..1), divided by (1 + grass) in tall grass
   * @param {number} [options.impactKeep=0.65]     horizontal speed kept at each impact, divided the same way
   * @param {number} [options.rollFriction=0.12]   rolling coefficient on short grass (deceleration = coef × g)
   * @param {(x:number, z:number) => number} [options.heightAt]  grass height ABOVE the ground (m),
   *        e.g. `(x, z) => world.meadow.grassHeightAt(x, z)`
   * @param {(x:number, z:number) => number} [options.groundAt]  ground height (m); default: `heightAt` of Terrain.js
   * @param {object} [options.ruins]               walls (Ruins.js: walkableAt, resolve); also `setRuins`
   * @param {number} [options.grassDrag=1.5]       coefficient added per metre of grass above 0.2 m
   * @param {number} [options.catRadius=0.15]      m, cat body radius for contact (0: no contact)
   * @param {boolean} [options.trail=true]         trailing thread
   * @param {number} [options.trailLength=0.5]     m
   * @param {number} [options.seed=1]              shape of the thread loops
   * @param {{center?: {x:number, z:number}, radius?: number}} [options.bounds]  disc the ball stays in
   *        (default: centre (0, 0), radius MEADOW_LIMIT); `null`: no limit
   * @param {boolean} [options.outline=true]       warm brown outline (inverted shell, `outlineMaterial`)
   * @param {boolean} [options.marker=true]        floating marker above the ball in tall grass (requires `heightAt`)
   */
  constructor(scene, options = {}) {
    this.scene = scene;
    this.radius = options.radius ?? 0.055;
    this.restitution = options.restitution ?? 0.35;
    this.impactKeep = options.impactKeep ?? 0.65;
    this.rollFriction = options.rollFriction ?? 0.12;
    this.heightAt = options.heightAt ?? null;
    this.groundAt = options.groundAt ?? terrainHeightAt;
    this.ruins = options.ruins ?? null;
    this.grassDrag = options.grassDrag ?? 1.5;
    this.catRadius = options.catRadius ?? 0.15;
    /** Optional callback (type, yarn, info); type: thrown, bounce (impact speed m/s), stopped, pushed, hitCat, wall, edge (outward speed m/s). */
    this.onEvent = null;
    /** Disc the ball stays in: { center: {x, z}, radius } (m), or null (no limit). */
    this.bounds = options.bounds === null ? null : {
      center: { x: options.bounds?.center?.x ?? 0, z: options.bounds?.center?.z ?? 0 },
      radius: options.bounds?.radius ?? MEADOW_LIMIT,
    };

    let s = (options.seed ?? 1) >>> 0;
    const rng = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
    this._geometry = yarnGeometry(this.radius, options.color, rng);
    // Flat toon shading plus a faint glow of its own colour keeps it readable in the grass.
    this._material = toonMaterial(0xffffff, { vertexColors: true, emissive: YARN.base, emissiveIntensity: 0.12 });
    this.mesh = new THREE.Mesh(this._geometry, this._material);
    this.mesh.name = 'Yarn';
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    // Outline: an inverted shell on a plain sphere of the ball's radius, not on each thread loop,
    // for one round line around the silhouette.
    this._outlineMat = null;
    this._outlineGeo = null;
    if (options.outline ?? true) {
      this._outlineMat = outlineMaterial();
      this._outlineGeo = new THREE.SphereGeometry(this.radius, 18, 12);
      const shell = new THREE.Mesh(this._outlineGeo, this._outlineMat);
      shell.name = 'YarnOutline';
      this.mesh.add(shell);
    }
    // Slightly larger click sphere (9 cm radius): invisible but hit by the Raycaster.
    this._hitGeo = new THREE.SphereGeometry(0.09, 10, 8);
    this._hitMat = new THREE.MeshBasicMaterial({ visible: false });
    this.hitMesh = new THREE.Mesh(this._hitGeo, this._hitMat);
    this.hitMesh.userData.yarn = this;
    this.group = new THREE.Group();
    this.group.name = 'YarnGroup';
    this.group.add(this.mesh, this.hitMesh);
    scene.add(this.group);
    this.marker = null;
    if ((options.marker ?? true) && this.heightAt) this._makeMarker();
    /** Clickable objects (the invisible sphere). */
    this.pickables = [this.hitMesh];

    this.velocity = new THREE.Vector3();
    this.spin = new THREE.Vector3();        // angular velocity in flight (rad/s, world axis)
    this.state = 'rest';
    this.group.position.copy(options.position ?? new THREE.Vector3(0.6, 0, 0.6));
    this.group.position.y = this._ground(this.group.position.x, this.group.position.z, -Infinity) + this.radius;
    this._cat = null;
    this._acc = 0;

    this.trail = null;
    if (options.trail ?? true) this._makeTrail(options.trailLength ?? 0.5);
  }

  /** Centre position (the group's Vector3, world frame). */
  get position() { return this.group.position; }
  get onGround() { return this.state !== 'air'; }

  /** World walls (Ruins.js); set by Brain.setWorld / setYarn or main.js. */
  setRuins(ruins) { this.ruins = ruins ?? null; }

  /**
   * Ground height under (x, z) for a ball whose bottom is at `bottom`: the terrain, or the top of a
   * low wall when the ball is above it (5 cm tolerance).
   */
  _ground(x, z, bottom) {
    const g = this.groundAt(x, z);
    const top = this.ruins?.walkableAt?.(x, z, 0) ?? null;
    return top !== null && top > g && bottom >= top - 0.05 ? top : g;
  }

  /**
   * Throws the ball from `from` to the ground point `target`: the initial velocity makes the first impact
   * land on `target`. Flight time `time` (s) defaults to 0.45 + 0.1 s per metre, within 0.5..1.3 s (higher
   * arc for a long throw). A target outside `bounds` is pulled `EDGE_MARGIN` m inside the edge.
   * Always relaunches the ball, even if it is still flying or rolling.
   * @returns {THREE.Vector3} initial velocity (m/s)
   */
  throwTo(from, target, { time } = {}) {
    const p = this.group.position.copy(from);
    this._clampInside(p, this.radius);        // start outside the meadow: brought back to the edge
    const g0 = this.groundAt(p.x, p.z);
    if (p.y < g0 + this.radius) p.y = g0 + this.radius;
    this._clampInside(_t.set(target.x, 0, target.z), EDGE_MARGIN);
    const dx = _t.x - p.x, dz = _t.z - p.z;
    const d = Math.hypot(dx, dz);
    const T = time ?? THREE.MathUtils.clamp(0.45 + 0.1 * d, 0.5, 1.3);
    // First impact on the aimed point: terrain, or the top of a low wall if the point is on one.
    const gT = this._ground(_t.x, _t.z, Infinity);
    this.velocity.set(dx / T, (gT + this.radius - p.y + 0.5 * G * T * T) / T, dz / T);
    // Small spin along the flight direction, with no effect on the trajectory.
    this.spin.set(dz, 0, -dx).normalize().multiplyScalar(d > 1e-3 ? 6 : 0);
    this.state = 'air';
    this._resetTrail();
    this._emit('thrown', this.velocity.clone());
    return this.velocity.clone();
  }

  /**
   * Pulls point (x, z) of `v` into the `bounds` disc, at least `margin` m inside the edge (y unchanged).
   * Returns `v`. Does nothing without `bounds`.
   */
  _clampInside(v, margin = 0) {
    const b = this.bounds;
    if (!b) return v;
    const dx = v.x - b.center.x, dz = v.z - b.center.z;
    const d = Math.hypot(dx, dz), max = Math.max(0, b.radius - margin);
    if (d > max) { const k = max / d; v.x = b.center.x + dx * k; v.z = b.center.z + dz * k; }
    return v;
  }

  /** Meadow edge: a ball past it is brought back and bounces softly inward. */
  _edge() {
    const b = this.bounds;
    if (!b) return;
    const p = this.group.position, v = this.velocity;
    const dx = p.x - b.center.x, dz = p.z - b.center.z;
    const d = Math.hypot(dx, dz), max = b.radius - this.radius;
    if (d <= max || d < 1e-6) return;
    const nx = dx / d, nz = dz / d;
    p.x = b.center.x + nx * max; p.z = b.center.z + nz * max;
    const vn = v.x * nx + v.z * nz;          // outward speed
    if (vn > 0) {
      const tx = v.x - vn * nx, tz = v.z - vn * nz;
      v.x = tx * EDGE_KEEP - vn * EDGE_BOUNCE * nx;
      v.z = tz * EDGE_KEEP - vn * EDGE_BOUNCE * nz;
      if (this.state === 'air') this.spin.set(v.z, 0, -v.x).divideScalar(this.radius);
      this._emit('edge', vn);
    }
  }

  /**
   * Push from the cat (paw or muzzle): adds `strength` m/s along the horizontal `dir` (a small hop if the
   * push exceeds 1.5 m/s).
   */
  push(dir, strength = 1) {
    _v.set(dir.x, 0, dir.z);
    if (_v.lengthSq() < 1e-8) return;
    _v.normalize().multiplyScalar(strength);
    this.velocity.add(_v);
    if (strength > 1.5) { this.velocity.y += 0.25 * (strength - 1.5); this.state = 'air'; }
    else if (this.state === 'rest') this.state = 'rolling';
    this._emit('pushed', strength);
  }

  /** Push from a point (the cat's muzzle or paw): direction from `fromPoint` to the ball. */
  nudge(fromPoint, strength = 1) {
    _w.copy(this.group.position).sub(fromPoint);
    if (_w.x * _w.x + _w.z * _w.z < 1e-8) _w.set(1, 0, 0);
    this.push(_w, strength);
  }

  /** Horizontal distance from the centre to `point`. */
  distanceTo(point) { return Math.hypot(this.group.position.x - point.x, this.group.position.z - point.z); }

  /** True if a ray (a set-up `THREE.Raycaster`) hits the ball. */
  pick(raycaster) { return raycaster.intersectObjects(this.pickables, false).length > 0; }

  /**
   * Call every frame.
   * @param {number} dt  seconds
   * @param {THREE.Vector3} [catPos]  cat's ground position (body contact if `catRadius` > 0)
   */
  update(dt, catPos) {
    this._cat = catPos ?? null;
    this._acc += Math.min(dt, 0.25);
    while (this._acc >= STEP) { this._step(STEP); this._acc -= STEP; }
    this._updateTrailGeometry();
    if (this.marker) this._updateMarker(Math.min(dt, 0.25));
  }

  // --- Floating marker: a pink dot that floats and breathes above the tufts, tied to the ball by a pale
  // thread. Shown only when the ball is on the ground in tall grass (mean `heightAt` above
  // MARKER.showAbove); it fades in and out.
  _makeMarker() {
    const geo = new THREE.SphereGeometry(MARKER.radius, 16, 12);
    const mat = toonMaterial(YARN.base, {
      emissive: YARN.light, emissiveIntensity: 0.6, transparent: true, opacity: 0, depthWrite: true,
    });
    const dot = new THREE.Mesh(geo, mat);
    dot.name = 'YarnMarkerDot';
    // Dark pink outline, not brown. The shell is drawn BEFORE the dot (renderOrder) and the dot writes
    // depth, otherwise the depth-less back-face shell would cover the dot entirely.
    const shellMat = outlineMaterial({ color: YARN.dark, thickness: 0.004 });
    shellMat.transparent = true; shellMat.opacity = 0; shellMat.depthWrite = false;
    const shell = new THREE.Mesh(geo, shellMat);
    shell.renderOrder = 1;
    dot.renderOrder = 2;
    dot.add(shell);
    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
    const lineMat = new THREE.LineBasicMaterial({ color: YARN.light, transparent: true, opacity: 0, depthWrite: false });
    const line = new THREE.Line(lineGeo, lineMat);
    line.frustumCulled = false;
    const group = new THREE.Group();
    group.name = 'YarnMarker';
    group.visible = false;
    group.add(dot, line);
    this.group.add(group); // follows the ball (the group does not rotate, only `mesh` does)
    for (const o of [dot, shell, line]) o.raycast = () => {}; // never hit by a click
    this.marker = { group, dot, line, geo, mats: [mat, shellMat, lineMat], lineGeo, opacity: 0, t: 0 };
  }

  _updateMarker(dt) {
    const m = this.marker, p = this.group.position;
    const h = this.heightAt(p.x, p.z);
    const want = this.state !== 'air' && h > MARKER.showAbove ? 1 : 0;
    m.opacity += (want - m.opacity) * (1 - Math.exp(-MARKER.fade * dt));
    if (want === 0 && m.opacity < 0.02) m.opacity = 0;
    m.group.visible = m.opacity > 0;
    if (!m.group.visible) return;
    m.t += dt;
    // Above the neighbouring tufts (mean height × 1.15, tufts reach × 1.2) plus a floating margin.
    const top = this._ground(p.x, p.z, p.y - this.radius) + h * 1.15 + MARKER.lift + MARKER.bob * Math.sin(m.t * 1.8);
    const y = top - p.y;
    m.dot.position.set(0, y, 0);
    m.dot.scale.setScalar(1 + MARKER.pulse * Math.sin(m.t * 3.2));
    const a = m.lineGeo.attributes.position.array;
    a[0] = 0; a[1] = this.radius; a[2] = 0; a[3] = 0; a[4] = y - MARKER.radius; a[5] = 0;
    m.lineGeo.attributes.position.needsUpdate = true;
    m.mats[0].opacity = m.mats[1].opacity = m.opacity;
    m.mats[2].opacity = 0.7 * m.opacity;
  }

  /** Tall-grass contribution: grassDrag × (height − 0.2 m), 0 without `heightAt` or on short grass. */
  _grass(x, z) {
    return this.heightAt ? this.grassDrag * Math.max(0, this.heightAt(x, z) - 0.2) : 0;
  }

  _friction(x, z) { return this.rollFriction + this._grass(x, z); }

  _step(h) {
    const p = this.group.position, v = this.velocity, r = this.radius;
    if (this.state === 'air') {
      v.y -= G * h;
      p.addScaledVector(v, h);
      this._rotate(this.spin, h);
      this._walls();
      const g = this._ground(p.x, p.z, p.y - r);
      if (p.y <= g + r && v.y < 0) {
        p.y = g + r;
        const impact = -v.y;
        const soft = 1 + this._grass(p.x, p.z); // tall grass damps both bounce and slide
        v.y = impact * this.restitution / soft;
        const keep = this.impactKeep / soft;     // friction at impact
        v.x *= keep; v.z *= keep;
        this._emit('bounce', impact);
        if (v.y < 0.35) { v.y = 0; this.state = 'rolling'; }
        this.spin.set(v.z, 0, -v.x).divideScalar(r); // back to rolling spin
      }
    } else if (this.state === 'rolling') {
      v.y = 0;
      const speed = Math.hypot(v.x, v.z);
      const dec = this._friction(p.x, p.z) * G * h;
      if (speed <= dec || speed < 0.02) {
        v.set(0, 0, 0);
        this.state = 'rest';
        this._emit('stopped', p.clone());
      } else {
        const k = (speed - dec) / speed;
        v.x *= k; v.z *= k;
        p.addScaledVector(v, h);
        this._walls();
        // Rolling without slipping: ω = (up × v) / r.
        _w.set(v.z, 0, -v.x).divideScalar(r);
        this._rotate(_w, h);
      }
      // Follows the terrain; at the edge of a low wall top, it falls (air state).
      const g = this._ground(p.x, p.z, p.y - r);
      if (p.y - r > g + 0.03) { this.state = 'air'; this.spin.set(v.z, 0, -v.x).divideScalar(r); }
      else p.y = g + r;
    } else {
      // At rest: sits on the terrain or a low wall.
      p.y = this._ground(p.x, p.z, p.y - r) + r;
    }
    // Contact with the cat's body (root on the ground or on a low wall): the ball is pushed away and bounces softly.
    if (this._cat && this.catRadius > 0 && p.y - (this._cat.y ?? 0) < 0.45 && p.y - (this._cat.y ?? 0) > -0.2) {
      const dx = p.x - this._cat.x, dz = p.z - this._cat.z;
      const d = Math.hypot(dx, dz), min = this.catRadius + r;
      if (d < min && d > 1e-6) {
        const nx = dx / d, nz = dz / d;
        p.x = this._cat.x + nx * min; p.z = this._cat.z + nz * min;
        const vn = v.x * nx + v.z * nz;
        if (vn < 0) {
          v.x -= 1.5 * vn * nx; v.z -= 1.5 * vn * nz; // half-damped bounce
          if (this.state === 'rest') this.state = 'rolling';
          this._emit('hitCat', -vn);
        }
      }
    }
    this._walls(); // the cat does not push the ball into a wall
    this._edge(); // after cat contact: the ball never leaves the meadow
    if (this.trail) this._stepTrail(h);
  }

  /**
   * Walls: the ball (disc of radius r, bottom at p.y − r) is pushed out of obstacles taller than itself
   * (Ruins.resolve, `y` option); the speed into the wall is returned (WALL_BOUNCE), the speed along it
   * partly kept (WALL_KEEP).
   */
  _walls() {
    if (!this.ruins) return;
    const p = this.group.position, v = this.velocity, r = this.radius;
    const out = this.ruins.resolve(p.x, p.z, r, { y: p.y - r }, _res);
    if (!out.hit) return;
    let nx = out.x - p.x, nz = out.z - p.z;
    const d = Math.hypot(nx, nz);
    p.x = out.x; p.z = out.z;
    if (d < 1e-9) return;
    nx /= d; nz /= d;
    const vn = v.x * nx + v.z * nz; // < 0: toward the wall
    if (vn >= 0) return;
    const tx = v.x - vn * nx, tz = v.z - vn * nz;
    v.x = tx * WALL_KEEP - vn * WALL_BOUNCE * nx;
    v.z = tz * WALL_KEEP - vn * WALL_BOUNCE * nz;
    if (this.state === 'air') this.spin.set(v.z, 0, -v.x).divideScalar(r);
    else if (this.state === 'rest') this.state = 'rolling';
    this._emit('wall', -vn);
  }

  _rotate(omega, h) {
    const w = omega.length();
    if (w < 1e-6) return;
    _q.setFromAxisAngle(_v.copy(omega).divideScalar(w), w * h);
    this.mesh.quaternion.premultiply(_q);
  }

  // --- Trailing thread: rope of N points (Verlet integration), attached to a surface point of the ball
  // that rotates with it; collides with the ground and the ball.
  _makeTrail(length) {
    const n = 20;
    this.trail = {
      n, seg: length / (n - 1),
      p: new Float32Array(n * 3), q: new Float32Array(n * 3),
      anchor: new THREE.Vector3(0, -0.2, -1).normalize().multiplyScalar(this.radius * 0.98),
    };
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    this._trailMat = new THREE.LineBasicMaterial({ color: YARN.trail });
    this.trailLine = new THREE.Line(geo, this._trailMat);
    this.trailLine.frustumCulled = false;
    this.trailLine.name = 'YarnTrail';
    this.scene.add(this.trailLine);
    this._resetTrail();
  }

  _anchorWorld(out) {
    return out.copy(this.trail.anchor).applyQuaternion(this.mesh.quaternion).add(this.group.position);
  }

  _resetTrail() {
    const t = this.trail;
    if (!t) return;
    this._anchorWorld(_v);
    for (let i = 0; i < t.n; i++) {
      const j = i * 3;
      t.p[j] = _v.x - i * t.seg * 0.9; t.p[j + 2] = _v.z;
      t.p[j + 1] = Math.max(this._ground(t.p[j], t.p[j + 2], _v.y) + 0.003, _v.y - i * 0.01);
      t.q[j] = t.p[j]; t.q[j + 1] = t.p[j + 1]; t.q[j + 2] = t.p[j + 2];
    }
  }

  _stepTrail(h) {
    const t = this.trail, P = t.p, Q = t.q, n = t.n;
    const c = this.group.position, rr = this.radius * 1.03;
    // Ground under each point (terrain or low wall top), computed once per substep.
    const gr = t.ground ??= new Float32Array(n);
    for (let i = 1; i < n; i++) gr[i] = this._ground(P[i * 3], P[i * 3 + 2], P[i * 3 + 1]) + 0.003;
    for (let i = 1; i < n; i++) {
      const j = i * 3;
      const onGround = P[j + 1] <= gr[i] + 0.001;
      const damp = onGround ? 0.8 : 0.995;
      for (let k = 0; k < 3; k++) {
        const cur = P[j + k];
        P[j + k] += (cur - Q[j + k]) * damp + (k === 1 ? -G * h * h : 0);
        Q[j + k] = cur;
      }
    }
    this._anchorWorld(_v);
    P[0] = _v.x; P[1] = _v.y; P[2] = _v.z;
    for (let it = 0; it < 4; it++) {
      for (let i = 0; i < n - 1; i++) {
        const a = i * 3, b = a + 3;
        const dx = P[b] - P[a], dy = P[b + 1] - P[a + 1], dz = P[b + 2] - P[a + 2];
        const d = Math.hypot(dx, dy, dz) || 1e-6;
        const diff = (d - t.seg) / d;
        if (i === 0) { P[b] -= dx * diff; P[b + 1] -= dy * diff; P[b + 2] -= dz * diff; }
        else {
          P[a] += dx * diff * 0.5; P[a + 1] += dy * diff * 0.5; P[a + 2] += dz * diff * 0.5;
          P[b] -= dx * diff * 0.5; P[b + 1] -= dy * diff * 0.5; P[b + 2] -= dz * diff * 0.5;
        }
      }
      for (let i = 1; i < n; i++) {
        const j = i * 3;
        if (P[j + 1] < gr[i]) P[j + 1] = gr[i];
        const dx = P[j] - c.x, dy = P[j + 1] - c.y, dz = P[j + 2] - c.z;
        const d = Math.hypot(dx, dy, dz);
        if (d < rr && d > 1e-6) { const s = rr / d; P[j] = c.x + dx * s; P[j + 1] = c.y + dy * s; P[j + 2] = c.z + dz * s; }
      }
    }
  }

  _updateTrailGeometry() {
    if (!this.trail) return;
    const attr = this.trailLine.geometry.attributes.position;
    attr.array.set(this.trail.p);
    attr.needsUpdate = true;
  }

  _emit(type, info) { this.onEvent?.(type, this, info); }

  /** Removes the ball and its thread from the scene and frees geometries and materials. */
  dispose() {
    this.group.removeFromParent();
    this._geometry.dispose(); this._material.dispose();
    this._outlineGeo?.dispose(); this._outlineMat?.dispose();
    if (this.marker) { this.marker.geo.dispose(); this.marker.lineGeo.dispose(); this.marker.mats.forEach((m) => m.dispose()); this.marker = null; }
    this._hitGeo.dispose(); this._hitMat.dispose();
    if (this.trailLine) { this.trailLine.removeFromParent(); this.trailLine.geometry.dispose(); this._trailMat.dispose(); }
    this.pickables = [];
  }
}
