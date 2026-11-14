/**
 * The mountain flank of the chase: snowy ground mesh, standing firs, rocks, the rock Maman stumbles on, the firs that
 * the paint blasts blow away, and the ring of peaks on the horizon. Shapes and colours come from the game's snow zone
 * (`src/world/snowLook.js` for firs and rocks, `Mountains.js` for the peaks, the `SNOW` palette), so the viewer
 * recognises the style; the layout is new (a different mountain from the playable one).
 */
import * as THREE from 'three';
import { SNOW, color, toonMaterial } from '../../../../src/style/palette.js';
import { addPine, addRock, newChunk, chunkMesh } from '../../../../src/world/snowLook.js';
import { Mountains, ZONE2_HORIZON } from '../../../../src/world/Mountains.js';
import { rng } from '../../../../src/world/random.js';
import { BLAST, CLOCK, HORIZON, SCENERY, SLOPE } from './tuning.js';
import { smoothstep, valueNoise } from './ground.js';

const lerp = THREE.MathUtils.lerp;
const GRAVITY = BLAST.gravity;

/** Grid coordinates: `fine`-sized cells in [f0, f1], growing by `grow` out to [lo, hi] (same scheme as snowLook.js). */
function axis(lo, hi, f0, f1, fine, grow) {
  const out = [];
  const n = Math.round((f1 - f0) / fine);
  for (let i = 0; i <= n; i++) out.push(f0 + i * fine);
  let x = f0, step = fine;
  while (x > lo) { step *= grow; x = Math.max(lo, x - step); out.unshift(x); }
  x = f1; step = fine;
  while (x < hi) { step *= grow; x = Math.min(hi, x + step); out.push(x); }
  return out;
}

/** Snowy ground mesh on `ground.heightAt`, vertex colours: cold snow, lavender shade in the hollows, warm patches, rock on steep spots. */
function groundMesh(ground, path) {
  const xs = axis(-SLOPE.xHalf, SLOPE.xHalf, SLOPE.fineX[0], SLOPE.fineX[1], SLOPE.cell, SLOPE.grow);
  const zs = axis(SLOPE.zTop, SLOPE.zBottom, SLOPE.fineZ[0], SLOPE.fineZ[1], SLOPE.cell, SLOPE.grow);
  const nx = xs.length, nz = zs.length, N = nx * nz;
  const h = new Float32Array(N);
  const near = new Float32Array(N);
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) { h[j * nx + i] = ground.heightAt(xs[i], zs[j]); near[j * nx + i] = path.distance(xs[i], zs[j]); }
  }
  const pos = new Float32Array(N * 3), nrm = new Float32Array(N * 3), col = new Float32Array(N * 3);
  const fresh = color(SNOW.fresh), shade = color(SNOW.shade), warm = color(SNOW.warm), rock = color(SNOW.rock), earth = color(SNOW.earth);
  const c = new THREE.Color();
  for (let j = 0; j < nz; j++) {
    const j0 = Math.max(0, j - 1), j1 = Math.min(nz - 1, j + 1);
    for (let i = 0; i < nx; i++) {
      const i0 = Math.max(0, i - 1), i1 = Math.min(nx - 1, i + 1), v = j * nx + i, k = v * 3;
      const gx = (h[j * nx + i1] - h[j * nx + i0]) / (xs[i1] - xs[i0]);
      const gz = (h[j1 * nx + i] - h[j0 * nx + i]) / (zs[j1] - zs[j0]);
      const l = Math.hypot(gx, 1, gz);
      pos[k] = xs[i]; pos[k + 1] = h[v]; pos[k + 2] = zs[j];
      nrm[k] = -gx / l; nrm[k + 1] = 1 / l; nrm[k + 2] = -gz / l;
      const x = xs[i], z = zs[j];
      const n = Math.sin(0.11 * x + 0.7) * Math.sin(0.13 * z + 1.9) + 0.5 * Math.sin(0.31 * x - 0.23 * z);
      c.copy(fresh).lerp(shade, 0.55 * smoothstep(0.1, 0.9, -n));
      // Marbling: warm sunlit patches and lavender shaded patches, low contrast.
      const m1 = valueNoise(x * 0.17 + 5, z * 0.17 - 3) * 0.7 + valueNoise(x * 0.5 - 9, z * 0.5 + 4) * 0.3;
      const m2 = valueNoise(x * 0.14 - 21, z * 0.14 + 8) * 0.7 + valueNoise(x * 0.5 + 13, z * 0.5 - 17) * 0.3;
      c.lerp(warm, smoothstep(0.45, 0.85, m1) * 0.5);
      c.lerp(shade, smoothstep(0.45, 0.85, m2) * 0.45);
      // Thin snow on the steep spots away from her way: earth then rock break through (as GROUND_LOOK).
      const thin = 0.62 * valueNoise(x * 0.11, z * 0.11) + 0.28 * valueNoise(x * 0.33 + 17, z * 0.33 - 5) + 0.1 * valueNoise(x * 1 - 31, z * 1 + 9)
        + 0.5 * (1 - nrm[k + 1]);
      const off = smoothstep(2.5, 9, near[v]);
      c.lerp(earth, smoothstep(0.57, 0.64, thin) * off * 0.8);
      c.lerp(rock, smoothstep(0.66, 0.73, thin) * off);
      col[k] = c.r * SLOPE.lift; col[k + 1] = c.g * SLOPE.lift; col[k + 2] = c.b * SLOPE.lift;
    }
  }
  const idx = new Uint32Array((nx - 1) * (nz - 1) * 6);
  let t = 0;
  for (let j = 0; j < nz - 1; j++) {
    for (let i = 0; i < nx - 1; i++) {
      const a = j * nx + i, b = a + 1, cc = a + nx, d = cc + 1;
      idx[t++] = a; idx[t++] = cc; idx[t++] = b;
      idx[t++] = b; idx[t++] = cc; idx[t++] = d;
    }
  }
  const g = new THREE.BufferGeometry();
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeBoundingSphere();
  const mesh = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true }));
  mesh.name = 'ChaseSnow';
  mesh.receiveShadow = true;
  return mesh;
}

/** Fir positions: rejection sampling around Maman's way, none in her corridor, dense near it and sparse far from it. */
function placeFirs(ground, path, rand) {
  const S = SCENERY, placed = [], cell = 6, grid = new Map();
  const key = (x, z) => `${Math.floor(x / cell)},${Math.floor(z / cell)}`;
  const free = (x, z, r) => {
    for (let a = -1; a <= 1; a++) {
      for (let b = -1; b <= 1; b++) {
        for (const o of grid.get(`${Math.floor(x / cell) + a},${Math.floor(z / cell) + b}`) ?? []) {
          if (Math.hypot(o.x - x, o.z - z) < o.R + r + S.spacing) return false;
        }
      }
    }
    return true;
  };
  const area = (SLOPE.fineX[1] - SLOPE.fineX[0] + 2 * S.reach) * (SLOPE.fineZ[1] - SLOPE.fineZ[0]);
  const tries = Math.round(area * S.nearDensity * 2.2);
  for (let n = 0; n < tries; n++) {
    const x = SLOPE.fineX[0] - S.reach + rand() * (SLOPE.fineX[1] - SLOPE.fineX[0] + 2 * S.reach);
    const z = SLOPE.fineZ[0] + rand() * (SLOPE.fineZ[1] - SLOPE.fineZ[0]);
    const d = path.distance(x, z);
    if (d < S.corridor || d > S.reach) continue;
    const density = d < S.nearReach ? S.nearDensity * smoothstep(S.corridor, S.corridorFade, d) : S.farDensity;
    if (rand() * S.nearDensity * 1.0 > density) continue;
    const R = lerp(S.radius[0], S.radius[1], rand());
    if (!free(x, z, R)) continue;
    const tree = { x, z, R, h: lerp(S.height[0], S.height[1], rand()), a: rand() * Math.PI * 2, y: ground.heightAt(x, z), d };
    placed.push(tree);
    const k = key(x, z);
    if (!grid.has(k)) grid.set(k, []);
    grid.get(k).push(tree);
  }
  return placed;
}

/** Fir geometry with its foot at the local origin (so the mesh can be moved and tipped about its foot). */
function firMesh(tree, material) {
  const ch = newChunk();
  addPine(ch, { x: tree.x, z: tree.z, ground: tree.y, h: tree.h, R: tree.R, a: tree.a, clear: tree.d < SCENERY.detailReach ? 0 : 99 });
  const mesh = chunkMesh(ch, material, 'ChaseFir');
  mesh.geometry.translate(-tree.x, -tree.y, -tree.z);
  mesh.geometry.computeBoundingSphere();
  mesh.matrixAutoUpdate = true;
  mesh.position.set(tree.x, tree.y, tree.z);
  return mesh;
}

export class Slope {
  /**
   * @param {THREE.Object3D} parent
   * @param {object} deps `ground`, `path`, `plan` (blast plan), `sunDir`
   */
  constructor(parent, { ground, path, plan, sunDir }) {
    this.ground = ground;
    this.group = new THREE.Group();
    this.group.name = 'ChaseSlope';
    parent.add(this.group);
    this.snow = groundMesh(ground, path);
    this.group.add(this.snow);

    const rand = rng(SCENERY.seed);
    this.material = toonMaterial(0xffffff, { vertexColors: true });
    const firs = placeFirs(ground, path, rand);

    // Which fir goes with which blast: the earliest blast within reach.
    const blasts = plan.filter((b) => b.trees).sort((p, q) => p.t - q.t);
    this.doomed = [];
    const standing = [];
    for (const tree of firs) {
      const b = blasts.find((e) => Math.hypot(e.x - tree.x, e.z - tree.z) < e.r * BLAST.treeRadiusK);
      if (b) this.doomed.push({ tree, blast: b }); else standing.push(tree);
    }

    // Standing firs and rocks are merged by chunk (one draw call each).
    const chunks = new Map();
    const chunkOf = (x, z) => {
      const k = `${Math.floor(x / SCENERY.chunk)},${Math.floor(z / SCENERY.chunk)}`;
      if (!chunks.has(k)) chunks.set(k, newChunk());
      return chunks.get(k);
    };
    for (const t of standing) {
      addPine(chunkOf(t.x, t.z), { x: t.x, z: t.z, ground: t.y, h: t.h, R: t.R, a: t.a, clear: t.d < SCENERY.detailReach ? 0 : 99 });
    }
    // Rocks along the way, never on it.
    const rocks = [];
    for (let n = 0, tries = 0; n < SCENERY.rocks && tries < 4000; tries++) {
      const x = SLOPE.fineX[0] + rand() * (SLOPE.fineX[1] - SLOPE.fineX[0]);
      const z = SLOPE.fineZ[0] + rand() * (SLOPE.fineZ[1] - SLOPE.fineZ[0]);
      const r = lerp(SCENERY.rockRadius[0], SCENERY.rockRadius[1], rand());
      if (path.distance(x, z) < SCENERY.corridor + 1.5 + r) continue;
      if (firs.some((f) => Math.hypot(f.x - x, f.z - z) < f.R + r)) continue;
      const flat = lerp(0.62, 0.9, rand());
      rocks.push({ x, z, r, flat });
      n++;
    }
    for (const r of rocks) {
      const y = ground.heightAt(r.x, r.z);
      addRock(chunkOf(r.x, r.z), { x: r.x, y: y + r.r * r.flat * 0.3, z: r.z, r: r.r, flat: r.flat, a: r.x * 0.7 + r.z, clear: 99 });
    }
    // The rock she catches her paw on, in its own mesh so the scene can read its place.
    const R0 = SCENERY.stumbleRock;
    const pc = path.at(CLOCK.catch);
    const ahead = [Math.sin(pc.yaw), Math.cos(pc.yaw)], left = [Math.cos(pc.yaw), -Math.sin(pc.yaw)];
    const rx = pc.x + ahead[0] * R0.ahead + left[0] * SCENERY.rockSide;
    const rz = pc.z + ahead[1] * R0.ahead + left[1] * SCENERY.rockSide;
    const stumble = newChunk();
    addRock(stumble, { x: rx, y: ground.heightAt(rx, rz) + R0.radius * R0.flat * 0.3, z: rz, r: R0.radius, flat: R0.flat, a: 0.8, clear: 99 });
    this.stumbleRock = { x: rx, y: ground.heightAt(rx, rz), z: rz, r: R0.radius };
    const rockMesh = chunkMesh(stumble, this.material, 'ChaseStumbleRock');
    this.group.add(rockMesh);

    this.chunkMeshes = [rockMesh];
    for (const [key, ch] of chunks) {
      if (!ch.items) continue;
      const m = chunkMesh(ch, this.material, `ChaseChunk_${key}`);
      this.group.add(m);
      this.chunkMeshes.push(m);
    }

    // Blown firs: one mesh each, a material per blast so the paint colour can reach all of its trees at the same instant.
    this.blastMaterials = new Map();
    this.fliers = this.doomed.map(({ tree, blast }) => {
      if (!this.blastMaterials.has(blast.index)) this.blastMaterials.set(blast.index, toonMaterial(0xffffff, { vertexColors: true }));
      const mesh = firMesh(tree, this.blastMaterials.get(blast.index));
      this.group.add(mesh);
      const away = new THREE.Vector3(tree.x - blast.x, 0, tree.z - blast.z);
      const dist = away.length();
      // Push outwards from the way as well, so a tree thrown by a blast never lands on Maman.
      const wp = path.at(blast.t);
      const fromWay = new THREE.Vector3(tree.x - wp.x, 0, tree.z - wp.z).normalize();
      away.normalize().addScaledVector(fromWay, 0.9).normalize();
      const k = 1 - Math.min(1, dist / (blast.r * BLAST.treeRadiusK));  // 1 at the centre, 0 at the edge
      const jitter = rand();
      const fly = lerp(BLAST.treeFly[0], BLAST.treeFly[1], k);
      const up = lerp(BLAST.treeLift[0], BLAST.treeLift[1], k) * (0.8 + 0.4 * jitter);
      const flight = (2 * up) / GRAVITY;
      return {
        mesh, tree, blast, dir: away, fly, up, flight, spin: lerp(BLAST.treeSpin[0], BLAST.treeSpin[1], rand()),
        turns: rand() < 0.5 ? 0.5 : 1.5,
        start: blast.t + dist * BLAST.treeDelay,
        axis: new THREE.Vector3(away.z, 0, -away.x),
        rest: 0.5 + 0.35 * tree.R,
      };
    });

    // Mountains of the horizon: the game's generator, a ring centred on the slope, without the zone-2 dip behind the bridge.
    const ranges = ZONE2_HORIZON.ranges.map(({ low: _low, ...range }) => range);
    this.mountains = new Mountains({
      sunDir,
      horizon: {
        ...ZONE2_HORIZON, name: 'Mountains_chase', center: { x: 0, z: 0 }, ranges, cameras: HORIZON.cameras,
        massif: { ...ZONE2_HORIZON.massif, peaks: HORIZON.giants },
      },
      ground: () => 0,
    });
    this.mountains.group.position.set(HORIZON.centre[0], HORIZON.baseY, HORIZON.centre[1]);
    this.group.add(this.mountains.group);

    this.stats = { firs: firs.length, doomed: this.doomed.length, rocks: rocks.length, mountainTriangles: this.mountains.triangles };
  }

  /** Blown firs at time t: ballistic flight, tumble, rest; tinted by the paint of their blast from the instant it goes off. */
  update(t) {
    const q = new THREE.Quaternion();
    for (const f of this.fliers) {
      const tau = t - f.start;
      const tint = THREE.MathUtils.clamp((t - f.blast.t) / 0.08, 0, 1);
      if (tint > 0 && f.mesh.material.userData.tinted !== f.blast.index) {
        f.mesh.material.color.set(0xffffff).lerp(new THREE.Color(BLAST.colors[f.blast.c]), 0.92);
        f.mesh.material.userData.tinted = f.blast.index;
      }
      if (tau <= 0) { f.mesh.position.set(f.tree.x, f.tree.y, f.tree.z); f.mesh.quaternion.identity(); continue; }
      const s = Math.min(tau, f.flight);
      const x = f.tree.x + f.dir.x * f.fly * s, z = f.tree.z + f.dir.z * f.fly * s;
      const gy = this.ground.heightAt(x, z);
      const lifted = f.up * s - 0.5 * GRAVITY * s * s;
      // Between the start and the landing the foot follows the ballistic arc; then the tree lies on the snow.
      const land = THREE.MathUtils.clamp(s / f.flight, 0, 1);
      f.mesh.position.set(x, gy + lerp(0, f.rest, smoothstep(0.7, 1, land)) + Math.max(lifted, 0), z);
      const ease = 1 - (1 - land) * (1 - land);
      q.setFromAxisAngle(f.axis, Math.PI * f.turns * ease);
      f.mesh.quaternion.copy(q);
    }
  }

  dispose() {
    this.group.removeFromParent();
    this.group.traverse((o) => { o.geometry?.dispose(); });
    this.material.dispose();
    for (const m of this.blastMaterials.values()) m.dispose();
    this.snow.material.dispose();
  }
}
