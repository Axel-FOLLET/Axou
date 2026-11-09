import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { YARN, toonMaterial, outlineMaterial, color } from '../style/palette.js';
import { heightAt as terrainHeightAt } from '../world/Terrain.js';

/**
 * Yarn launchers: small wooden catapults on the map that throw the game's yarn ball (`Yarn.throwTo`) when the
 * cat comes close or the player clicks them. Created by main.js. Local frame: +Z = launch direction; metres, seconds.
 *
 * - `new Launchers(scene, { yarn, heightAt, ruins, spots, canTrigger })`, then `update(dt, catPosition)` every frame
 * - `pickables`, `pick(raycaster)`, `handlePick(arg)`: click handling
 * - `onLaunch = (launcher, how) => ...`: called when the ball leaves (how: 'approach' | 'click' | 'code')
 * - `obstacles`, `exclusions`, `addObstaclesTo(ruins)`: footprints for Ruins.js and Meadow.setExclusions
 * - `list`, `launch(i | launcher, how)`: the launchers and manual firing
 */

/**
 * Launcher positions (x, z in m, world frame) and launch direction (`aim`: ground point x, z). All within
 * 15 m of the origin, clear of the ruins, the forest (x < −14), the foothill (x > +22) and the starting
 * clearing (r < 3 m); each one aims at open ground.
 */
export const LAUNCHER_SPOTS = [
  { name: 'launcher_east', x: 3.4, z: -2.2, aim: { x: 0.4, z: 0.2 } },
  { name: 'launcher_south', x: -2.6, z: 4.6, aim: { x: 0.2, z: 1.2 } },
  { name: 'launcher_sunrise', x: 7.4, z: 3.8, aim: { x: 4.0, z: 3.0 } },
  { name: 'launcher_sunset', x: -8.4, z: -4.6, aim: { x: -7.8, z: -1.0 } },
];

/** Trigger and launch settings. Ground distances in m, times in s. */
export const LAUNCH = {
  trigger: 0.9,        // m, cat root closer than this to the centre: launch
  rearm: 1.6,          // m, the cat must then move beyond this before another proximity launch
  cooldown: 6,         // s between two proximity launches of the same launcher
  globalCooldown: 4,   // s between two proximity launches, all launchers combined
  reload: 1.2,         // s after a launch before the cup is reloaded (clickable again)
  swing: 0.16,         // s of arm swing (rest to up)
  release: 0.11,       // s after the start of the swing: the ball leaves
  back: 0.7,           // s of arm return
  spread: 0.35,        // rad of spread around the aimed point
  distance: [3.0, 4.2] // m from the launcher to the landing point
};

/** Warm, light honey wood (palette.js has no wood colour); pink knobs and pennant. */
const WOOD = { light: 0xf3cf98, base: 0xdcaa6e, dark: 0xb9824f, cup: 0xe6b27a };
const ARM_REST = -0.47;      // rad (pivot rotation.x): cup back, resting on the sled
const ARM_UP = 1.92;         // rad: arm past vertical, forward
const PIVOT = { y: 0.33, z: -0.04 };  // m, arm axle position
const ARM_LEN = 0.3;  // m
const FOOT = { hx: 0.17, hz: 0.25, top: 0.32, r: 0.5 }; // m: footprint half-sizes, obstacle height, grass exclusion radius
const HIT = { radius: 0.34, y: 0.24 };                 // m, click sphere
const _v = new THREE.Vector3();
const easeOut = (u) => 1 - (1 - u) * (1 - u) * (1 - u);
const smooth = (u) => u * u * (3 - 2 * u);

function paint(g, hex) {
  // Non-indexed (all merged parts must be), single vertex colour.
  const c = color(hex);
  const out = g.index ? g.toNonIndexed() : g;
  if (out !== g) g.dispose();
  const m = out.attributes.position.count, b = new Float32Array(m * 3);
  for (let i = 0; i < m; i++) { b[i * 3] = c.r; b[i * 3 + 1] = c.g; b[i * 3 + 2] = c.b; }
  out.setAttribute('color', new THREE.BufferAttribute(b, 3));
  out.deleteAttribute('uv');
  return out;
}

function place(g, { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1 } = {}) {
  g.scale(sx, sy, sz);
  g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, ry, rz)));
  g.translate(x, y, z);
  return g;
}

/** Fixed part: sled, wheels, hubs, posts, knobs, axle, mast and pennant (one geometry). */
function baseGeometry() {
  const P = [];
  // Plump sled: capsule lying along Z, widened.
  P.push(paint(place(new THREE.CapsuleGeometry(0.08, 0.28, 6, 14), { rx: Math.PI / 2, sx: 1.7, sy: 1, sz: 0.8, y: 0.12 }), WOOD.base));
  // Lighter strip on top (plank).
  P.push(paint(place(new THREE.CapsuleGeometry(0.05, 0.26, 4, 12), { rx: Math.PI / 2, sx: 2.2, sz: 0.35, y: 0.175 }), WOOD.light));
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      P.push(paint(place(new THREE.CylinderGeometry(0.068, 0.068, 0.045, 18), { rz: Math.PI / 2, x: sx * 0.15, y: 0.068, z: sz * 0.14 }), WOOD.dark));
      P.push(paint(place(new THREE.SphereGeometry(0.026, 10, 8), { x: sx * 0.175, y: 0.068, z: sz * 0.14, sx: 0.6 }), WOOD.light));
    }
    // Rounded post and pink knob on top.
    P.push(paint(place(new THREE.CylinderGeometry(0.026, 0.034, 0.2, 10), { x: sx * 0.1, y: 0.25, z: PIVOT.z }), WOOD.base));
    P.push(paint(place(new THREE.SphereGeometry(0.04, 14, 10), { x: sx * 0.1, y: PIVOT.y + 0.045, z: PIVOT.z }), YARN.light));
  }
  // Arm axle.
  P.push(paint(place(new THREE.CylinderGeometry(0.016, 0.016, 0.22, 8), { rz: Math.PI / 2, y: PIVOT.y, z: PIVOT.z }), WOOD.dark));
  // Mast and pennant (thick triangle) at the back left: rises above the surrounding grass.
  P.push(paint(place(new THREE.CylinderGeometry(0.009, 0.011, 0.42, 6), { x: -0.12, y: 0.36, z: -0.2 }), WOOD.dark));
  P.push(paint(place(new THREE.SphereGeometry(0.018, 8, 6), { x: -0.12, y: 0.575, z: -0.2 }), YARN.light));
  const flag = new THREE.ExtrudeGeometry(new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(0.14, -0.045), new THREE.Vector2(0, -0.09)]),
    { depth: 0.012, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 1 });
  P.push(paint(place(flag, { ry: Math.PI / 2, x: -0.126, y: 0.56, z: -0.2 }), YARN.base));
  const g = mergeGeometries(P);
  P.forEach((p) => p.dispose());
  g.computeBoundingSphere();
  return g;
}

/** Arm: beam along −Z from the pivot, cup (bowl open toward local +Y) at the end. */
function armGeometry() {
  const P = [];
  P.push(paint(place(new THREE.CylinderGeometry(0.02, 0.024, ARM_LEN, 10), { rx: Math.PI / 2, z: -ARM_LEN / 2 }), WOOD.base));
  P.push(paint(place(new THREE.SphereGeometry(0.03, 12, 8), {}), WOOD.light)); // hub on the axle
  // Bowl: lower half-sphere (open upward), torus lip.
  P.push(paint(place(new THREE.SphereGeometry(0.075, 16, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), { z: -ARM_LEN, y: 0.03 }), WOOD.cup));
  P.push(paint(place(new THREE.TorusGeometry(0.075, 0.012, 6, 20), { rx: Math.PI / 2, z: -ARM_LEN, y: 0.03 }), WOOD.light));
  const g = mergeGeometries(P);
  P.forEach((p) => p.dispose());
  g.computeBoundingSphere();
  return g;
}

/** Decorative ball in the cup (slightly smaller than the real one, three YARN tones). */
function ballGeometry() {
  const P = [paint(new THREE.IcosahedronGeometry(0.05, 2), YARN.dark)];
  const e = new THREE.Euler(), q = new THREE.Quaternion();
  let s = 7;
  const rnd = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < 8; i++) {
    const t = new THREE.TorusGeometry(0.05 * (0.92 + 0.05 * rnd()), 0.0055, 5, 28);
    t.applyQuaternion(q.setFromEuler(e.set(rnd() * Math.PI, rnd() * Math.PI, rnd() * Math.PI)));
    P.push(paint(t, i % 2 ? YARN.light : YARN.base));
  }
  const g = mergeGeometries(P);
  P.forEach((p) => p.dispose());
  return g;
}

/** One launcher (created by `Launchers`). */
export class Launcher {
  constructor(owner, spot, ground) {
    this.owner = owner;
    this.name = spot.name;
    this.position = new THREE.Vector3(spot.x, ground, spot.z);
    const ax = (spot.aim?.x ?? 0) - spot.x, az = (spot.aim?.z ?? 0) - spot.z;
    /** Rotation around Y (like Object3D.rotation.y): local +Z toward the aimed point. */
    this.yaw = Math.atan2(ax, az);
    const S = owner._shared;
    this.group = new THREE.Group();
    this.group.name = spot.name;
    this.group.position.copy(this.position);
    this.group.rotation.y = this.yaw;
    const base = new THREE.Mesh(S.baseGeo, S.material);
    base.castShadow = true; base.receiveShadow = true;
    base.add(new THREE.Mesh(S.baseGeo, S.outline));
    this.pivot = new THREE.Group();
    this.pivot.position.set(0, PIVOT.y, PIVOT.z);
    this.pivot.rotation.x = ARM_REST;
    const arm = new THREE.Mesh(S.armGeo, S.materialDouble);
    arm.castShadow = true;
    arm.add(new THREE.Mesh(S.armGeo, S.outline));
    this.ball = new THREE.Mesh(S.ballGeo, S.ballMaterial);
    this.ball.position.set(0, 0.075, -ARM_LEN);
    this.ball.castShadow = true;
    this.pivot.add(arm, this.ball);
    this.hitMesh = new THREE.Mesh(S.hitGeo, S.hitMat);
    this.hitMesh.position.set(0, HIT.y, 0);
    this.hitMesh.userData.launcher = this;
    this.group.add(base, this.pivot, this.hitMesh);
    for (const o of [base, arm, this.ball, ...base.children, ...arm.children]) o.raycast = () => {}; // only hitMesh is clickable
    /** 'ready' (cup loaded) | 'firing' (arm tilting) | 'reload' (returning, empty cup). */
    this.state = 'ready';
    this.t = 0;
    this.released = false;
    this.lastLaunch = -Infinity;   // time (Launchers clock) of the last launch
    this.armed = true;             // true once the cat has moved beyond LAUNCH.rearm
    this.launches = 0;
    this._how = null;
  }

  /** Horizontal distance from the centre to `p`. */
  distanceTo(p) { return Math.hypot(p.x - this.position.x, p.z - this.position.z); }

  /** Cup position (world frame) in the current arm pose. */
  cupWorld(out = new THREE.Vector3()) {
    this.group.updateMatrixWorld(true);
    return this.ball.getWorldPosition(out);
  }

  _fire(how) {
    this.state = 'firing';
    this.t = 0;
    this.released = false;
    this._how = how;
    this.armed = false;
    this.lastLaunch = this.owner.time;
  }

  _update(dt) {
    if (this.state === 'ready') {
      // Small breathing of the cup's ball (visual cue, no gameplay effect).
      this.ball.scale.setScalar(1 + 0.04 * Math.sin(this.owner.time * 3 + this.position.x));
      return;
    }
    this.t += dt;
    if (this.state === 'firing') {
      const u = Math.min(1, this.t / LAUNCH.swing);
      this.pivot.rotation.x = ARM_REST + (ARM_UP - ARM_REST) * easeOut(u);
      if (!this.released && this.t >= LAUNCH.release) {
        this.released = true;
        this.owner._release(this, this._how);
        this.ball.visible = false;
      }
      if (u >= 1) { this.state = 'reload'; this.t = 0; }
      return;
    }
    // Reload: the arm returns gently and the cup's ball grows back.
    const u = Math.min(1, this.t / LAUNCH.back);
    this.pivot.rotation.x = ARM_UP + (ARM_REST - ARM_UP) * smooth(u);
    const left = LAUNCH.reload - this.t;
    if (left < 0.3) {
      this.ball.visible = true;
      this.ball.scale.setScalar(Math.max(0.01, smooth(Math.min(1, 1 - left / 0.3))));
    }
    if (this.t >= LAUNCH.reload) {
      this.state = 'ready';
      this.ball.visible = true;
      this.ball.scale.setScalar(1);
      this.pivot.rotation.x = ARM_REST;
    }
  }
}

export class Launchers {
  /**
   * @param {THREE.Object3D|null} scene  scene receiving `launchers.group` (null: nothing added)
   * @param {object} [opts]
   * @param {import('./Yarn.js').Yarn} [opts.yarn]  the game's yarn ball (also `setYarn`)
   * @param {(x:number, z:number) => number} [opts.heightAt]  ground height (default: Terrain.js)
   * @param {object} [opts.ruins]  walls (Ruins.js): the landing point avoids their obstacles
   * @param {object[]} [opts.spots=LAUNCHER_SPOTS]  positions { name, x, z, aim: {x, z} }
   * @param {() => boolean} [opts.canTrigger]  filter for the proximity trigger (default: the ball is not in the air)
   * @param {() => number} [opts.random=Math.random]
   */
  constructor(scene, opts = {}) {
    this.yarn = opts.yarn ?? null;
    this.heightAt = opts.heightAt ?? terrainHeightAt;
    this.ruins = opts.ruins ?? null;
    this.canTrigger = opts.canTrigger ?? null;
    this.random = opts.random ?? Math.random;
    /** Callback (launcher, how) when the ball leaves; how is 'approach' | 'click' | 'code'. */
    this.onLaunch = null;
    this.time = 0;
    this._lastApproach = -Infinity;
    this._shared = {
      baseGeo: baseGeometry(),
      armGeo: armGeometry(),
      ballGeo: ballGeometry(),
      hitGeo: new THREE.SphereGeometry(HIT.radius, 10, 8),
      material: toonMaterial(0xffffff, { vertexColors: true }),
      materialDouble: toonMaterial(0xffffff, { vertexColors: true, side: THREE.DoubleSide }),
      ballMaterial: toonMaterial(0xffffff, { vertexColors: true, emissive: YARN.base, emissiveIntensity: 0.12 }),
      outline: outlineMaterial({ thickness: 0.005 }),
      hitMat: new THREE.MeshBasicMaterial({ visible: false }),
    };
    this.group = new THREE.Group();
    this.group.name = 'Launchers';
    /** The launchers, in `spots` order. */
    this.list = (opts.spots ?? LAUNCHER_SPOTS).map((spot) => {
      // Set on the lowest point of its footprint (the wheels never float).
      let g = Infinity;
      for (const [dx, dz] of [[0, 0], [-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        g = Math.min(g, this.heightAt(spot.x + dx * FOOT.hx, spot.z + dz * FOOT.hz));
      }
      const l = new Launcher(this, spot, g - 0.01);
      this.group.add(l.group);
      return l;
    });
    if (scene) scene.add(this.group);
    /** Invisible spheres for the Raycaster (Picker). `userData.launcher` = the launcher. */
    this.pickables = this.list.map((l) => l.hitMesh);
    /** Footprints in `Ruins.obstacles` format (oriented boxes, not walkable). */
    this.obstacles = this.list.map((l) => ({
      name: l.name, x: l.position.x, z: l.position.z, hx: FOOT.hx, hz: FOOT.hz, rotY: l.yaw,
      top: l.position.y + FOOT.top, ground: l.position.y, height: FOOT.top, climbable: false,
    }));
    /** Grass-free discs for `Meadow.setExclusions`: keeps the object visible in the meadow. */
    this.exclusions = this.list.map((l) => ({ x: l.position.x, z: l.position.z, r: FOOT.r }));
  }

  setYarn(y) { this.yarn = y ?? null; }
  setRuins(r) { this.ruins = r ?? null; }

  /**
   * Adds the footprints to `ruins.obstacles` (once): the cat walks around them (Brain's NavGrid, `resolve`)
   * and the ball bounces off them. Call BEFORE the cat's first move (the grid is built on the first blocked
   * path), or call `brain.setWorld(world)` afterwards to rebuild it.
   */
  addObstaclesTo(ruins) {
    if (!ruins?.obstacles) return;
    for (const o of this.obstacles) if (!ruins.obstacles.includes(o)) ruins.obstacles.push(o);
    if (!this.ruins) this.ruins = ruins;
  }

  /** Launcher hit by a set-up Raycaster, or null. */
  pick(raycaster) {
    const hit = raycaster.intersectObjects(this.pickables, false)[0];
    return hit ? hit.object.userData.launcher : null;
  }

  /**
   * Click: `arg` = three.js intersection ({ object }), Object3D or Launcher. Fires if the cup is loaded;
   * returns true if the click targeted a launcher (consumed, even while reloading).
   */
  handlePick(arg) {
    const l = this._resolve(arg);
    if (!l) return false;
    this.launch(l, 'click');
    return true;
  }

  _resolve(arg) {
    if (arg instanceof Launcher) return arg;
    if (typeof arg === 'number') return this.list[arg] ?? null;
    let o = arg?.object ?? arg;
    while (o && !o.userData?.launcher) o = o.parent;
    return o?.userData?.launcher ?? null;
  }

  /**
   * Fires a launch (`l`: index or launcher). Returns true if the arm starts (cup loaded), false otherwise.
   * The ball leaves `LAUNCH.release` s later (`onLaunch` is called then).
   */
  launch(l, how = 'code') {
    const L = this._resolve(l);
    if (!L || L.state !== 'ready' || !this.yarn) return false;
    L._fire(how);
    return true;
  }

  /** Actual launch: the ball leaves the cup toward a clear landing point. */
  _release(L, how) {
    const from = L.cupWorld(_v).clone();
    const target = this._target(L);
    this.yarn.throwTo(from, target);
    L.launches += 1;
    this.onLaunch?.(L, how);
  }

  /** Landing point: toward `aim`, spread ±spread, distance LAUNCH.distance, clear of obstacles. */
  _target(L) {
    const [d0, d1] = LAUNCH.distance;
    let best = null;
    for (let k = 0; k < 8; k++) {
      const a = L.yaw + (this.random() * 2 - 1) * LAUNCH.spread * (1 + k * 0.5);
      const d = d0 + this.random() * (d1 - d0);
      const x = L.position.x + Math.sin(a) * d, z = L.position.z + Math.cos(a) * d;
      best = new THREE.Vector3(x, 0, z);
      if (!this.ruins?.obstacleAt?.(x, z, 0.35)) break;
    }
    return best;
  }

  /**
   * Every frame. `catPosition` = the cat's ground position (root); without it, only the animation advances.
   */
  update(dt, catPosition) {
    const h = Math.min(dt, 0.1);
    this.time += h;
    for (const l of this.list) l._update(h);
    if (!catPosition || !this.yarn) return;
    let near = null, nearD = Infinity;
    for (const l of this.list) {
      const d = l.distanceTo(catPosition);
      if (d > LAUNCH.rearm) l.armed = true;
      if (d < LAUNCH.trigger && d < nearD) { near = l; nearD = d; }
    }
    if (!near || !near.armed || near.state !== 'ready') return;
    if (this.time - near.lastLaunch < LAUNCH.cooldown || this.time - this._lastApproach < LAUNCH.globalCooldown) return;
    const ok = this.canTrigger ? this.canTrigger(near) : this.yarn.state !== 'air';
    if (!ok) return;
    this._lastApproach = this.time;
    near._fire('approach');
  }

  /** Removes the launchers from the scene and frees shared geometries and materials. */
  dispose() {
    this.group.removeFromParent();
    for (const v of Object.values(this._shared)) v.dispose?.();
    this.pickables = [];
  }
}
