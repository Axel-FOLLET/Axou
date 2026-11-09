import * as THREE from 'three';
import { toonMaterial } from '../style/palette.js';
import { heightAt, raycastGround } from './Terrain.js';
import { Ruins } from './Ruins.js';
import { ZONE2, ZONE2_BOUNDS, PATH_SEGMENTS, PATH_DISKS, LEG_KINDS, pathClearance, pathInside } from './zone2.js';
import { LOOK, snowGeometry, thinAround, newChunk, addPine, addRock, chunkMesh, dressSnow } from './snowLook.js';
import { rng } from './random.js';

/**
 * Zone 2: the snowy mountain, built once by `World.enterMountain`. Shape of the relief and path: zone2.js.
 *
 * Offers `Brain` the same interface as `Ruins` (`obstacles`, `resolve`, `walkableAt`, `obstacleAt`, `blockedSegment`).
 * The cat stays in the path corridor (`pathInside`); rocks and pines along both edges give that limit a visible reason.
 * Separate from zone2.js because this file needs three.js, while zone2.js stays pure for `heightAt`.
 */

/**
 * Ground mesh (m): `x`, `z` world bounds, about 90 m from the corridor everywhere, beyond the fog; `fineX`, `fineZ`:
 * rectangle of `fine` m cells around the corridor (1.6 m bank, 0.9 m berm, ledge drops); `grow`: cell growth factor
 * outside it. `rayFar`: click ray range, the mesh diagonal (300 x 220 m, i.e. 372 m).
 */
const MESH = {
  x: [900, 1200], z: [-105, 115],
  fineX: [990, 1112], fineZ: [-16, 28], fine: 0.5, grow: 1.3,
  rayFar: 390,
};

/**
 * Scenery. `edgeStep`: one element every 3 m along each edge, tight enough for the edge to read without a wall. `gap`:
 * minimum distance (m) between scenery and corridor. `spacing`: distance between two elements, on top of their radii.
 * `scatter`: tries and domain of the slope scenery, at least `clear` m from the path; `side`: bands on both sides of the
 * rampart (|z| between 60 and 72 m, x from 935 m to behind the foot). `keepOut`: nothing within `x` m (relative to
 * ZONE2.x) of the foot for |z| <= `z` m, edge included: the meadow rampart (Rampart.js) stays at x <= -5 m.
 * `chunk`: 9 m chunks near the path, because occlusion (Occlusion.js) fades a whole chunk; `farChunk`: 30 m far away.
 * `nearClear`: beyond this, an element no longer counts for dialogue framing or the minimap.
 *
 * Leg kinds (zone2.js, `LEG_KINDS`). `walls` (narrow passage): two walls of large rocks on each side of the leg, `rows`
 * rows, each rock advancing by `step` x its radius; they overlap (`overlap` m) to form a wall and are taller (`flat`)
 * than other rocks. `lip` (ledge): along the drop, small isolated rocks every `step` m, so the edge reads without
 * danger. `clearing`: two rings of pines at `rings` m from the edge of the flat area, low `rockChance`.
 */
const DECOR = {
  seed: 20261105,
  edgeStep: 3, gap: 0.25, spacing: 0.35,
  rockChance: 0.42,
  pine: LOOK.pine,
  rock: LOOK.rock,
  scatter: { tries: 420, x: [995.5, 1185], z: [-72, 72], clear: 3 },
  side: { tries: 40, x: [935, 995.5], z: [60, 72] },
  keepOut: { x: -4.5, z: 60 },
  walls: { step: 1.5, stepJitter: 0.5, overlap: 0.9, flat: [0.7, 0.95], rowOffset: 1.8, rowScale: 0.8 },
  lip: { step: 2.2, r: [0.45, 0.75] },
  clearing: { rings: [1.2, 3.6], rockChance: 0.15 },
  chunk: 9, farChunk: 30, nearClear: 8,
};

/** Sampling step (m) of the segment in `blockedSegment`: less than twice the cat radius (0.2 m). */
const SEGMENT_STEP = 0.25;
/** Tolerance (m) at the corridor edge: a cat placed right on the edge can leave again. */
const EDGE_TOLERANCE = 0.02;
/**
 * Maximum cells walked by the shortcut of `Brain._plan` (0.25 m per cell, so 40 m). The longest leg is 29.1 m: further
 * than that, no straight line fits in the corridor. Bounds the cost peak of a path across the whole mountain.
 */
const SIGHT_CELLS = 160;

/** Obstacle returned outside the corridor: the bank, never walkable (minimal format read by `Brain`). */
const OFF_PATH = { name: 'off_path', climbable: false };

const _out = { x: 0, z: 0 };

export class Mountain {
  /** @param {THREE.Object3D} parent zone 2 group (World.mountainGroup), out of the scene in zone 1 */
  constructor(parent) {
    this.group = parent;
    // Bounds and checks that `Brain` reads for the active zone: `corridor` replaces the meadow disc, `navBounds` and
    // `blockedCell` feed its grid, `sightCells` bounds its shortcut.
    this.corridor = true;
    this.navBounds = ZONE2_BOUNDS;
    this.sightCells = SIGHT_CELLS;
    this.obstacles = [];    // rocks, near pines and Maman: dialogue framing (talkShot)
    this.navObstacles = []; // those overlapping the corridor: Maman, the only one placed there
    // Same box computations as the ruins: only `obstacles` and `_active` are read there.
    this._boxes = Object.create(Ruins.prototype);
    this._boxes.obstacles = this.navObstacles;
    this.rocks = [];   // { x, z, r }: minimap
    this.trees = [];   // { x, z, R, rb, h, ground, top }: Forest.trees format (talkShot, minimap)
    this.pickables = [];
    this.occluders = [];
    this.meshes = [];

    this.geometry = snowGeometry(MESH);
    this.material = new THREE.MeshLambertMaterial({ vertexColors: true });
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.name = 'Snow';
    this.mesh.receiveShadow = true;
    this.mesh.matrixAutoUpdate = false;
    this.mesh.raycast = raycastGround({ x0: MESH.x[0], x1: MESH.x[1], z0: MESH.z[0], z1: MESH.z[1], far: MESH.rayFar });
    parent.add(this.mesh);
    this.pickables.push(this.mesh);

    this.decorMaterial = toonMaterial(0xffffff, { vertexColors: true });
    this._buildDecor();
  }

  /** Triangles of the ground and the scenery. */
  get triangles() {
    return this.geometry.index.count / 3 + this.meshes.reduce((s, m) => s + m.geometry.attributes.position.count / 3, 0);
  }

  /** Places the scenery: switchback edges, rims of the flat areas, then slopes. Merged by chunks. */
  _buildDecor() {
    const rand = rng(DECOR.seed);
    const lerp = (r, t) => r[0] + (r[1] - r[0]) * t;
    const placed = [];
    const free = (x, z, r, spacing = DECOR.spacing) => {
      for (const o of placed) if (Math.hypot(o.x - x, o.z - z) < o.fr + r + spacing) return false;
      return true;
    };
    const X = ZONE2.x;
    // Meadow rampart (Rampart.js): nothing on the -X side of the foot, nor straddling its limit.
    const keptOut = (x, z, ext) => x - ext < X + DECOR.keepOut.x && Math.abs(z) <= DECOR.keepOut.z + ext;
    const putRock = (x, z, r, flat, a, minClear, spacing = DECOR.spacing) => {
      const clear = pathClearance(x, z);
      if (keptOut(x, z, r) || clear < r + minClear || !free(x, z, r, spacing)) return false;
      const ground = heightAt(x, z);
      placed.push({ kind: 'rock', x, z, a, r, flat, fr: r, clear, y: ground + r * flat * DECOR.rock.bury, ground });
      return true;
    };
    const tryPlace = (x, z, minClear, rockChance = DECOR.rockChance) => {
      const isRock = rand() < rockChance;
      const a = rand() * Math.PI * 2;
      if (isRock) {
        const r = lerp(DECOR.rock.r, rand());
        putRock(x, z, r, lerp(DECOR.rock.flat, rand()), a, minClear);
      } else {
        const R = lerp(DECOR.pine.R, rand()), h = lerp(DECOR.pine.h, rand());
        const fr = R * DECOR.pine.clearFrac, clear = pathClearance(x, z);
        if (keptOut(x, z, R) || clear < fr + minClear || !free(x, z, fr)) return;
        placed.push({ kind: 'pine', x, z, a, R, h, fr, clear, ground: heightAt(x, z) });
      }
    };

    // Path edges, leg by leg, according to its kind (zone2.js `LEG_KINDS`).
    for (const s of PATH_SEGMENTS) {
      const px = -s.uz, pz = s.ux, kind = LEG_KINDS[s.kind];
      if (kind.walls) { this._walls(s, kind.walls, putRock, rand, lerp); continue; }
      for (let d = 1; d < s.len; d += DECOR.edgeStep) {
        for (const side of [-1, 1]) {
          const off = s.half + DECOR.gap + 0.9 + rand() * 0.8;
          // Ledge: on the drop side, small isolated rocks (`lip`) instead of pines.
          if (kind.drop && side === s.dropSide) continue;
          tryPlace(s.ax + s.ux * d + px * side * off, s.az + s.uz * d + pz * side * off, DECOR.gap);
        }
      }
      if (kind.drop) {
        const L = DECOR.lip;
        for (let d = 1 + rand(); d < s.len - 1; d += L.step * (0.8 + rand() * 0.4)) {
          const r = lerp(L.r, rand()), off = s.half + DECOR.gap + r + 0.1;
          putRock(s.ax + s.ux * d + px * s.dropSide * off, s.az + s.uz * d + pz * s.dropSide * off, r, lerp(DECOR.rock.flat, rand()), rand() * Math.PI * 2, DECOR.gap);
        }
      }
    }
    // Around the foot, turns, clearings and summit: a ring of scenery around each flat area.
    const rimDisk = (cx, cz, r, offset = 0.9, rockChance = DECOR.rockChance) => {
      const n = Math.max(6, Math.round((Math.PI * 2 * (r + offset)) / DECOR.edgeStep));
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2, off = r + DECOR.gap + offset + rand() * 0.8;
        tryPlace(cx + Math.cos(a) * off, cz + Math.sin(a) * off, DECOR.gap, rockChance);
      }
    };
    for (const d of PATH_DISKS) {
      if (d.clearing) for (const ring of DECOR.clearing.rings) rimDisk(d.x, d.z, d.r, ring, DECOR.clearing.rockChance);
      else rimDisk(d.x, d.z, d.r);
    }
    // Slopes, then the two bands on either side of the rampart.
    const S = DECOR.scatter, Sd = DECOR.side;
    for (let i = 0; i < S.tries; i++) tryPlace(lerp(S.x, rand()), lerp(S.z, rand()), S.clear);
    for (let i = 0; i < Sd.tries; i++) tryPlace(lerp(Sd.x, rand()), (rand() < 0.5 ? -1 : 1) * lerp(Sd.z, rand()), S.clear);

    // Chunks: small near the path, large far away.
    const chunks = new Map();
    placed.forEach((p, i) => {
      const near = p.clear < DECOR.nearClear;
      const size = near ? DECOR.chunk : DECOR.farChunk;
      const key = `${near ? 'n' : 'f'}${Math.floor(p.x / size)}_${Math.floor(p.z / size)}`;
      let ch = chunks.get(key);
      if (!ch) chunks.set(key, ch = newChunk());
      if (p.kind === 'rock') {
        addRock(ch, p);
        if (near) {
          this.rocks.push({ x: p.x, z: p.z, r: p.r });
          const half = p.r * 0.78, height = p.r * p.flat * 1.2;
          this.obstacles.push({ name: `rock_${i}`, x: p.x, z: p.z, hx: half, hz: half, rotY: 0, top: p.ground + height, ground: p.ground, height, climbable: false });
        }
      } else {
        addPine(ch, p);
        if (near) {
          this.trees.push({ x: p.x, z: p.z, R: p.R, rb: DECOR.pine.trunkR, h: p.h, ground: p.ground, top: p.ground + p.h });
          const half = DECOR.pine.trunkR * 1.2;
          this.obstacles.push({ name: `pine_${i}`, x: p.x, z: p.z, hx: half, hz: half, rotY: 0, top: p.ground + p.h, ground: p.ground, height: p.h, climbable: false });
        }
      }
    });
    let n = 0;
    for (const ch of chunks.values()) {
      const m = chunkMesh(ch, this.decorMaterial, `Decor_${n++}`);
      this.group.add(m);
      this.meshes.push(m);
      this.occluders.push(m);
    }
    this.decorCount = placed.length;
    thinAround(this.geometry, placed);
    dressSnow(this, placed);
    this.addObstacles(this.obstacles.splice(0));
  }

  /**
   * Narrow passage: two walls of large rocks (`walls`, zone2.js) on each side of leg `s`, over `rows` rows. Each rock
   * touches the corridor edge without entering it (`putRock` refuses otherwise); they overlap by
   * `DECOR.walls.overlap` m to form a continuous wall.
   */
  _walls(s, W, putRock, rand, lerp) {
    const D = DECOR.walls, px = -s.uz, pz = s.ux;
    for (const side of [-1, 1]) {
      for (let row = 0; row < W.rows; row++) {
        let d = 0.6 + rand() * 0.8;
        while (d < s.len - 0.6) {
          const r = lerp(W.r, rand()) * (row ? D.rowScale : 1);
          const off = s.half + W.gap + r + 0.05 + row * D.rowOffset;
          putRock(s.ax + s.ux * d + px * side * off, s.az + s.uz * d + pz * side * off, r, lerp(D.flat, rand()), rand() * Math.PI * 2, W.gap, -D.overlap);
          d += r * (D.step + rand() * D.stepJitter);
        }
      }
    }
  }

  /** Added obstacles (Maman, main.js). Those touching the corridor go to navigation. */
  addObstacles(list) {
    for (const o of list) {
      this.obstacles.push(o);
      if (pathClearance(o.x, o.z) < Math.hypot(o.hx, o.hz) + 0.3) this.navObstacles.push(o);
    }
  }

  update() {}

  // ---------------------------------------------------------------- Ruins interface for Brain

  /** No top to climb in zone 2. */
  walkableAt() { return null; }
  surfaceAt() { return null; }
  stepsTo() { return null; }
  climbTarget() { return null; }

  /** Cell of `Brain`'s grid (radius `pad` included) outside the corridor. */
  blockedCell(x, z, pad) { return pathClearance(x, z) > -pad; }

  /** Filter shared with the Ruins interface. */
  _active(o, opts) { return this._boxes._active(o, opts); }

  /** Obstacle whose footprint (grown by `margin`) contains (x, z); outside the corridor: the bank. */
  obstacleAt(x, z, margin = 0) {
    return this._boxes.obstacleAt(x, z, margin) ?? (pathClearance(x, z) > -margin ? OFF_PATH : null);
  }

  /** Pushes a disc out of the obstacles, then back into the corridor. Same contract as Ruins. */
  resolve(x, z, radius, opts = {}, out = { x: 0, z: 0, hit: null }) {
    pathInside(x, z, radius, _out);
    this._boxes.resolve(_out.x, _out.z, radius, opts, out);
    if (pathInside(out.x, out.z, radius, _out)) { out.x = _out.x; out.z = _out.z; }
    return out;
  }

  /** First contact of the segment with an obstacle or the corridor edge. Same contract as Ruins. */
  blockedSegment(ax, az, bx, bz, radius = 0, opts = {}) {
    const box = this._boxes.blockedSegment(ax, az, bx, bz, radius, opts);
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / SEGMENT_STEP));
    const limit = EDGE_TOLERANCE - radius;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      if (box && t >= box.t) break;
      if (pathClearance(ax + (bx - ax) * t, az + (bz - az) * t) > limit) return { t, obstacle: OFF_PATH };
    }
    return box;
  }

  dispose() {
    this.geometry.dispose();
    this.material.dispose();
    this.decorMaterial.dispose();
    for (const m of this.meshes) { m.geometry.dispose(); m.removeFromParent(); }
    this.mesh.removeFromParent();
  }
}
