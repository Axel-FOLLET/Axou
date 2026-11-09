import * as THREE from 'three';
import { Butterfly, ButterflyAssets, SPECIES } from './Butterfly.js';
import { heightAt as groundAt } from '../world/Terrain.js';
import { MEADOW_LIMIT } from '../world/field.js';
import { rng } from '../world/random.js';

/**
 * Butterfly swarm, independent of the cat and the meadow. Created by main.js and given to Brain.js for the
 * hunt. It creates the butterflies (Butterfly.js), reserves flowers for them and resolves pounces.
 */

const hdist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

/**
 * Inputs: the scene, the flower tops (array of `THREE.Vector3`, kept **by reference**: a perched butterfly
 * follows its flower if the meadow moves it), then `update(dt, catPosition, { pouncing })` every frame.
 *
 * For the hunt: `pick(raycaster)` / `pickables`, `target`, `untarget`, `pounce` (result
 * 'caught' or 'missed'; either way the butterfly leaves unharmed), `startle(point, radius)`; events through
 * `onEvent(type, butterfly)`.
 */
export class Butterflies {
  /**
   * @param {THREE.Object3D} scene
   * @param {THREE.Vector3[]} flowers  flower tops (m, world frame)
   * @param {object} [options]
   * @param {number} [options.count=6]            number of butterflies
   * @param {number} [options.seed]               random seed (reproducible runs)
   * @param {number} [options.startleRadius=1.0]  m, take-off radius when the cat pounces
   * @param {number} [options.walkFleeRadius=0.3] m, a perched, untargeted butterfly leaves if the cat passes closer
   * @param {[number, number]} [options.rest=[8, 16]] s, time away after fleeing before returning
   * @param {number} [options.flowerMaxDist=8]    m, preference for flowers closer than this to the cat
   * @param {{center: THREE.Vector3, radius: number}} [options.bounds] flight enclosure (default: derived from the flowers)
   * @param {(f: THREE.Vector3) => boolean} [options.landable] whether a flower can be landed on (not one hidden behind the rampart)
   */
  constructor(scene, flowers = [], options = {}) {
    this.scene = scene;
    this.count = options.count ?? 6;
    this.rng = rng(options.seed ?? (Math.random() * 2 ** 32));
    this.startleRadius = options.startleRadius ?? 1.0;
    this.walkFleeRadius = options.walkFleeRadius ?? 0.3;
    this.rest = options.rest ?? [8, 16];
    this.flowerMaxDist = options.flowerMaxDist ?? 8;
    this._fixedBounds = options.bounds ?? null;
    this.landable = options.landable ?? (() => true);
    this.assets = new ButterflyAssets();
    /** @type {Butterfly[]} */
    this.list = [];
    /** Invisible click spheres (one per butterfly), `userData.butterfly` = the butterfly. */
    this.pickables = [];
    /** Optional callback (type, butterfly); type is takeoff, land, flee, caught, missed, escape or return. */
    this.onEvent = null;
    this._taken = new Map();     // flower Vector3 → butterfly that reserved it
    this._cat = new THREE.Vector3();
    this._ctx = { cat: this._cat, swarm: this, bounds: null };
    this.setFlowers(flowers);

    for (let i = 0; i < this.count; i++) {
      const b = new Butterfly(this.assets, i % SPECIES.length, this.rng, i);
      this.list.push(b);
      this.pickables.push(b.hitMesh);
      scene.add(b.group);
      const f = this._reserveFlower(b, null);
      if (f && i % 2 === 0) b.perchAt(f, 2 + this.rng() * 10);
      else {
        const c = f ?? this._ctx.bounds.center;
        const x = c.x + (this.rng() - 0.5) * 3, z = c.z + (this.rng() - 0.5) * 3;
        b.group.position.set(x, groundAt(x, z) + 0.6 + this.rng(), z);
        b.takeOff(f, 1 + this.rng() * 4);
      }
    }
  }

  /** Replaces the flower list (by reference). Butterflies perched on a removed flower take off. */
  setFlowers(points) {
    this.flowers = points ?? [];
    const keep = new Set(this.flowers);
    for (const [f, b] of [...this._taken]) {
      if (keep.has(f)) continue;
      this._taken.delete(f);
      b.flower = null;
      if (b.state === 'perched') b.takeOff(null, 1);
    }
    const b = this._fixedBounds ?? this._boundsFromFlowers();
    // Enclosure pulled inside the meadow: centre + radius ≤ MEADOW_LIMIT − 1.
    const room = MEADOW_LIMIT - 1 - Math.hypot(b.center.x, b.center.z);
    this._ctx.bounds = { center: b.center, radius: Math.max(1, Math.min(b.radius, room)) };
  }

  _boundsFromFlowers() {
    if (!this.flowers.length) return { center: new THREE.Vector3(0, 0, 0), radius: 10 };
    const c = new THREE.Vector3();
    for (const f of this.flowers) c.add(f);
    c.divideScalar(this.flowers.length).setY(0);
    let r = 0;
    for (const f of this.flowers) r = Math.max(r, hdist(f, c));
    return { center: c, radius: r + 2 };
  }

  /**
   * Call every frame.
   * @param {number} dt  seconds
   * @param {THREE.Vector3} catPos  cat's ground position
   * @param {{pouncing?: boolean}} [opts]  `pouncing`: pounce in progress (untargeted butterflies within `startleRadius` take off)
   */
  update(dt, catPos, opts = {}) {
    if (catPos) this._cat.copy(catPos);
    if (opts.pouncing) this.startle(this._cat, this.startleRadius);
    for (const b of this.list) {
      if (b.state === 'perched' && !b.targeted && hdist(b.position, this._cat) < this.walkFleeRadius) this._flee(b, this._cat);
    }
    for (const b of this.list) b.update(dt, this._ctx);
  }

  /**
   * Scares butterflies within `radius` (horizontal) of `point`: perched or flying, they flee. The targeted
   * one is spared unless `includeTargeted`. Returns the number of butterflies scared.
   */
  startle(point, radius, { includeTargeted = false } = {}) {
    let n = 0;
    for (const b of this.list) {
      if (b.state === 'fleeing' || b.state === 'away' || b.state === 'caught') continue;
      if (b.targeted && !includeTargeted) continue;
      if (hdist(b.position, point) < radius) { this._flee(b, point); n++; }
    }
    return n;
  }

  /** Perched butterflies. */
  perched() { return this.list.filter((b) => b.state === 'perched'); }

  /** Butterfly hit by a ray (a set-up `THREE.Raycaster`), or null, in any state. */
  pick(raycaster) {
    const hit = raycaster.intersectObjects(this.pickables, false)[0];
    return hit ? hit.object.userData.butterfly : null;
  }

  /** Marks `b` as targeted (the only one in the swarm): it stays perched and ignores the approaching cat. */
  target(b) {
    for (const o of this.list) o.targeted = false;
    if (b && b.state === 'perched') { b.targeted = true; return true; }
    return false;
  }

  /** No butterfly targeted any more (hunt abandoned). */
  untarget() { for (const b of this.list) b.targeted = false; }

  /**
   * Resolves the cat's pounce on `b`, called at landing (the paw touches `pawPoint`). Caught if `b` is still
   * perched, within `reach` (horizontal) of the paw and the draw passes `catchChance`. Caught: held `holdSecs`,
   * then escapes unharmed; missed: flies off at once. Others within `startleRadius` also take off.
   * @returns {'caught'|'missed'}
   */
  pounce(b, pawPoint, { catchChance = 0.3, reach = 0.25, holdSecs = 0.8 } = {}) {
    let result = 'missed';
    if (b && b.state === 'perched' && hdist(b.position, pawPoint) <= reach && this.rng() < catchChance) result = 'caught';
    if (b) {
      b.targeted = false;
      if (result === 'caught') {
        this._release(b);
        b.catchAt(pawPoint, holdSecs, this._restTime());
      } else if (b.state !== 'fleeing' && b.state !== 'away') {
        this._flee(b, pawPoint);
      }
      this._emit(result, b);
    }
    this.startle(pawPoint, this.startleRadius);
    return result;
  }

  _restTime() { return this.rest[0] + this.rng() * (this.rest[1] - this.rest[0]); }

  _flee(b, from) {
    this._release(b);
    b.flee(from, this._restTime());
    this._emit('flee', b);
  }

  /** Reserves a free flower for `b` (other than `exclude`), preferably close to it and not under the cat. */
  _reserveFlower(b, exclude) {
    // Flowers outside the meadow (beyond MEADOW_LIMIT − 0.5 m) are never chosen.
    const free = this.flowers.filter((f) => f !== exclude && !this._taken.has(f) && Math.hypot(f.x, f.z) <= MEADOW_LIMIT - 0.5 && this.landable(f));
    if (!free.length) return null;
    const cat = this._cat;
    let pool = free.filter((f) => { const d = hdist(f, cat); return d >= 1.2 && d <= this.flowerMaxDist; });
    if (!pool.length) pool = free;
    // Three draws, keep the closest to the butterfly (plausible trips, not always the same).
    let best = null, bestD = Infinity;
    for (let i = 0; i < 3; i++) {
      const f = pool[Math.floor(this.rng() * pool.length)];
      const d = f.distanceTo(b.position);
      if (d < bestD) { best = f; bestD = d; }
    }
    this._taken.set(best, b);
    return best;
  }

  _release(b) {
    if (b.flower && this._taken.get(b.flower) === b) this._taken.delete(b.flower);
  }

  _emit(type, b) { this.onEvent?.(type, b); }

  /** Removes the butterflies from the scene and frees geometries and materials. */
  dispose() {
    for (const b of this.list) b.remove();
    this.list = []; this.pickables = []; this._taken.clear();
    this.assets.dispose();
  }
}

export { Butterfly, SPECIES };
