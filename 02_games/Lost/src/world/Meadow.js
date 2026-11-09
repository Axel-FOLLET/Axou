import * as THREE from 'three';
import { Grass, LAYERS, CLEAR_START, CLEAR_END, WALL_FAR, grassHeight, clearingAt, exclusionDistance } from './Grass.js';
import { Flowers, SPECIES, FIELD_RADIUS } from './Flowers.js';
import { MEADOW_LIMIT } from './field.js';
import { heightAt as groundAt } from './Terrain.js';

export { grassHeight, clearingAt, exclusionDistance, CLEAR_START, CLEAR_END, LAYERS, SPECIES, FIELD_RADIUS };

/**
 * Share of grass clumps drawn per quality level (0 = full, 3 = lowest).
 * Flowers do not change (stable positions for butterflies, low cost).
 */
export const QUALITY_DENSITY = [1, 0.75, 0.55, 0.4];

/**
 * Wall distance texture: square of 2 x EXCL_HALF m centred on the origin, EXCL_RES texels per side (0.125 m). Beyond the
 * square, no wall affects the grass. It reaches x = 68 m because the painted snow sheet behind the rampart
 * (Rampart.js `BEYOND`) has no grass, and grass grows up to 30 m around the cat (Grass.js `LAYERS`), i.e. up to x = 65.
 */
export const EXCL_HALF = MEADOW_LIMIT + 28;
export const EXCL_RES = 1088;

const smooth = (a, b, x) => { const t = Math.min(Math.max((x - a) / (b - a), 0), 1); return t * t * (3 - 2 * t); };

/** "No wall" texture (1 texel at the maximum distance). */
function emptyMask() {
  const tex = new THREE.DataTexture(new Uint8Array([255]), 1, 1, THREE.RedFormat, THREE.UnsignedByteType);
  tex.needsUpdate = true;
  return tex;
}

/**
 * Distance texture (0 inside a wall to 255 at WALL_FAR m or more) for a list of areas. Each area is only evaluated in
 * its bounding box grown by WALL_FAR (beyond it, its distance exceeds WALL_FAR and changes nothing): same result as
 * `exclusionDistance(list)` over the whole grid, at a cost proportional to the area of the zones (forest: dozens of trunks).
 */
function buildMask(list) {
  const n = EXCL_RES, size = 2 * EXCL_HALF, cell = size / n;
  const dist = new Float32Array(n * n).fill(WALL_FAR);
  const one = [null];
  for (const e of list) {
    const reach = (e.r !== undefined ? e.r : Math.hypot(e.hx, e.hz)) + WALL_FAR;
    const i0 = Math.max(0, Math.floor((e.x - reach + EXCL_HALF) / cell));
    const i1 = Math.min(n - 1, Math.ceil((e.x + reach + EXCL_HALF) / cell));
    const j0 = Math.max(0, Math.floor((e.z - reach + EXCL_HALF) / cell));
    const j1 = Math.min(n - 1, Math.ceil((e.z + reach + EXCL_HALF) / cell));
    one[0] = e;
    for (let j = j0; j <= j1; j++) {
      const z = -EXCL_HALF + (j + 0.5) * cell;
      for (let i = i0; i <= i1; i++) {
        const x = -EXCL_HALF + (i + 0.5) * cell;
        const d = exclusionDistance(one, x, z);
        if (d < dist[j * n + i]) dist[j * n + i] = d;
      }
    }
  }
  const data = new Uint8Array(n * n);
  for (let k = 0; k < n * n; k++) data[k] = Math.round(Math.min(Math.max(dist[k] / WALL_FAR, 0), 1) * 255);
  const tex = new THREE.DataTexture(data, n, n, THREE.RedFormat, THREE.UnsignedByteType);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Meadow: windy grass (fine blades, tufts, spikelets, short grass; Grass.js) plus tall flowers. Created by `World`
 * (`world.meadow`). The cat starts at the origin in a clearing of short sparse grass with an irregular edge; beyond it,
 * blades rise to 0.4-1.1 m (x0.75-1.25 per clump), often above its head (0.54 m). Everything sits on the relief (Terrain.js).
 *
 * Walls (Ruins.js): `new Meadow(scene, { exclusions })` or `meadow.setExclusions(list)`, with areas `{ x, z, hx, hz, rotY }`
 * (rectangle, half sides in m, rotation about Y like `Object3D.rotation.y`) or `{ x, z, r }` (disc). No grass inside, short
 * grass at the foot (about 1 m), no flower within 0.35 m.
 */
export class Meadow {
  constructor(scene, { seed = 1, exclusions = [] } = {}) {
    this.exclusions = exclusions.slice();
    this.uniforms = {
      uTime: { value: 0 },
      uWindDir: { value: new THREE.Vector2(0.8, 0.6) },
      uWindStrength: { value: 0.22 },
      uPushB: { value: new THREE.Vector4(0, 0, 0.7, 0) },
      uCenter: { value: new THREE.Vector2() },
      uExcl: { value: this.exclusions.length ? buildMask(this.exclusions) : emptyMask() },
      uExclBox: { value: new THREE.Vector4(-EXCL_HALF, -EXCL_HALF, 2 * EXCL_HALF, WALL_FAR) },
      // Grass dithering between the camera and the cat (Grass.js): camera x, y, z; strength 0-1.
      uSee: { value: new THREE.Vector4(0, 0, 0, 0) },
      uSeeCat: { value: new THREE.Vector3() },
    };
    this.grass = new Grass(this.uniforms, seed);
    // Flowers follow the cat's passage like the grass (Grass.js `catBend`); cat uniforms are shared (uCat, uCatBox,
    // uPaws), updated by `grass.update` (World.update).
    Object.assign(this.uniforms, this.grass.catUniforms);
    this.flowers = new Flowers(this.uniforms, seed * 7, this.exclusions);
    this.group = new THREE.Group();
    this.group.name = 'Meadow';
    this.group.add(this.grass.group, this.flowers.group);
    scene.add(this.group);

    this.time = 0;
    this.quality = 0;
    // Current environment, shared with `flowerTop` (same values as the uniforms).
    this.env = {
      windDir: { x: 0.8, z: 0.6 },
      windStrength: 0.22,
      pushB: { x: 0, z: 0, radius: 0.7, strength: 0 },
      cat: this.grass.cat, // state of the cat's passage (Grass.js), same object as the grass
    };
  }

  /**
   * Grass-free areas (wall footprints of Ruins.js); replaces the previous list. Cost: one EXCL_RES x EXCL_RES texture
   * recomputed (call once, not every frame). Already-seeded flowers falling in an area are hidden
   * (`flowerList[i].hidden`); indices do not change.
   */
  setExclusions(list = []) {
    this.exclusions = list.slice();
    const old = this.uniforms.uExcl.value;
    this.uniforms.uExcl.value = this.exclusions.length ? buildMask(this.exclusions) : emptyMask();
    old.dispose();
    this.flowers.applyExclusions(this.exclusions);
  }

  /** Adds grass-free areas (rectangles or discs, same format) to the current list. */
  addExclusions(list = []) {
    if (list.length) this.setExclusions([...this.exclusions, ...list]);
  }

  /** Distance (m) from (x, z) to the nearest wall, negative inside, capped at 2 m. */
  wallDistance(x, z) {
    return this.exclusions.length ? exclusionDistance(this.exclusions, x, z) : WALL_FAR;
  }

  /**
   * Every frame (called by `World.update`). `catPos`: cat ground position; `camera`: camera; `center`: point followed by
   * the camera (centre of the grass tiles).
   */
  update(dt, catPos, camera, center) {
    this.time += dt;
    const u = this.uniforms;
    u.uTime.value = this.time;
    const e = this.env;
    e.windStrength = u.uWindStrength.value;
    e.windDir.x = u.uWindDir.value.x; e.windDir.z = u.uWindDir.value.y;
    // Low camera (relative to the ground below it): it parts the grass in front of the lens; high, it parts nothing.
    const cam = camera.position;
    e.pushB.x = cam.x; e.pushB.z = cam.z;
    e.pushB.strength = 1.2 * (1 - smooth(0.9, 1.8, cam.y - groundAt(cam.x, cam.z)));
    u.uPushB.value.set(e.pushB.x, e.pushB.z, e.pushB.radius, e.pushB.strength);
    u.uCenter.value.set(center.x, center.z);
    // Dithering: the cat stays visible through the grass without lowering it; strength driven in 0.2 s towards 1 in
    // grass over 0.3 m, 0 under 0.2 m.
    const see = u.uSee.value;
    const aim = smooth(0.2, 0.3, this.grassHeightAt(catPos.x, catPos.z));
    const stepSee = dt / 0.2;
    see.w += Math.max(Math.min(aim - see.w, stepSee), -stepSee);
    see.x = cam.x; see.y = cam.y; see.z = cam.z;
    u.uSeeCat.value.set(catPos.x, catPos.y + 0.18, catPos.z);
  }

  /** Quality level 0 (full) to 3 (lowest): see `QUALITY_DENSITY`. No recompilation. */
  setQuality(level) {
    this.quality = Math.min(Math.max(Math.round(level), 0), QUALITY_DENSITY.length - 1);
    this.grass.setDensity(QUALITY_DENSITY[this.quality]);
  }

  /**
   * Flowers: stable array of { index, species, x, z, ground, height, headY, top (Vector3 at rest, ground included), yaw,
   * hidden }.
   */
  get flowerList() { return this.flowers.list; }

  /** Centre of the corolla of flower `i` now (ground, wind and parting included). */
  flowerTop(i, out = new THREE.Vector3()) { return this.flowers.top(i, this.time, this.env, out); }

  /**
   * ABSOLUTE height (m) of the mean grass tip at (x, z): ground (Terrain.js `heightAt`) + fine blade height
   * (`grassHeightAt`), before the cat flattens it.
   */
  heightAt(x, z) { return groundAt(x, z) + this.grassHeightAt(x, z); }

  /** Mean height of the fine blades ABOVE the ground at (x, z) (m): 0 inside a wall. */
  grassHeightAt(x, z) { return grassHeight(x, z, this.wallDistance(x, z)); }

  /** Cost figures: clumps drawn, total clumps, grass and flower triangles, flowers. */
  get stats() {
    return {
      grassDrawn: this.grass.drawn,
      grassTotal: this.grass.total,
      grassTriangles: this.grass.triangles,
      grassMeshes: this.grass.layers.length,
      flowers: this.flowers.list.length,
      flowersHidden: this.flowers.list.filter((f) => f.hidden).length,
      flowerTriangles: this.flowers.triangles,
      quality: this.quality,
    };
  }
}

