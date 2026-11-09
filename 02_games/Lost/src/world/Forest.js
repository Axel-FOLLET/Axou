import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { MOSS, STONE, OUTLINE, TERRAIN, GRASS_KINDS, mix, jitter, toonMaterial } from '../style/palette.js';
import { heightAt as terrainHeightAt } from './Terrain.js';
import { rng } from './random.js';

/**
 * Grove to the left of the start point, with the clearing where the Chartiste paints. Created by World.js.
 *
 * Layout: trunks in x [-34, -14], z [-14, 14] (-X side, left of the start camera); CLEARING kept free for the painter;
 * a tree-free path from the origin to the clearing (PATH_HALF on each side) passes between the west low wall and the
 * north-west arched wall of the ruins.
 *
 * Style: soft conical trunk with a flared foot, crown of 3 to 6 slightly bumpy balls flattened underneath, smooth
 * ellipsoid normals (round tones in 3-step toon). Colours come from palette.js only: three leaf families, dark below
 * and light above, `jitter` per tree; trunks in warm brown, never black. Round bushes edge the clearing and the path.
 *
 * Cost: each tree (trunk + crown) and bush is a merged vertex-coloured geometry with its own `toonMaterial`, so it can
 * fade individually: one draw call per object, plus one for shadows if `shadows`; the identical materials share one
 * shader program. Counts: `forest.stats`. Each tree stands on the minimum of `heightAt` under its flared foot, minus SINK.
 *
 * Interface: `new Forest(scene, { heightAt, shadows })`; `forest.group` (added to `scene` if not null),
 * `forest.occluders` (one Mesh per tree or bush, own material, for Occlusion.js),
 * `forest.obstacles` (format of `Ruins.obstacles`), `forest.grassExclusions` (discs { x, z, r }, format accepted by
 * Grass.js `exclusionDistance`), `forest.clearing` { x, z, r, y }, `forest.trees`,
 * `forest.bushes`, `forest.stats`, `forest.pickables` (empty), `update()`, `dispose()`.
 */

export const FOREST_AREA = { x0: -34, x1: -14, z0: -14, z1: 14 }; // trunk footprint (m)
export const CLEARING = { x: -24, z: 3, r: 4.5 };                  // the painter's clearing (m)
export const PATH_HALF = 1.6;   // m: half width of the trunk-free path (origin to clearing)
export const SINK = 0.08;       // m: trunk foot buried below the lowest ground
const MAX_TREES = 44;

function smoothstep(a, b, x) {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
}

/** Distance from (x, z) to the segment (ax, az) - (bx, bz). */
function segDist(x, z, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz;
  const t = L2 > 0 ? Math.min(Math.max(((x - ax) * dx + (z - az) * dz) / L2, 0), 1) : 0;
  return Math.hypot(x - ax - dx * t, z - az - dz * t);
}

/** Indexed unit sphere (subdivided icosahedron, merged vertices). detail 1: 42 vertices, 2: 162. */
function sphereTemplate(detail) {
  let g = new THREE.IcosahedronGeometry(1, detail);
  g.deleteAttribute('normal');
  g.deleteAttribute('uv');
  g = mergeVertices(g);
  const out = { pos: Array.from(g.attributes.position.array), idx: Array.from(g.index.array) };
  g.dispose();
  return out;
}

let _templates = null;
function templates() {
  if (!_templates) _templates = { 1: sphereTemplate(1), 2: sphereTemplate(2) };
  return _templates;
}

const _a = new THREE.Color(), _b = new THREE.Color();

/** Merged geometry accumulator (positions, normals, colours, indices). */
class Builder {
  constructor() { this.pos = []; this.nrm = []; this.col = []; this.idx = []; }

  get vertexCount() { return this.pos.length / 3; }

  /**
   * Foliage ball: ellipsoid (rx, ry, rz) centred at (cx, cy, cz), bumpy (+/-7%), flattened underneath.
   * Colour: `low` to `high` by world height between yLow and yHigh.
   */
  blob(cx, cy, cz, rx, ry, rz, low, high, yLow, yHigh, seed, detail = 2) {
    const T = templates()[detail], base = this.vertexCount;
    const p1 = seed * 1.7, p2 = seed * 2.3, p3 = seed * 0.9;
    for (let i = 0; i < T.pos.length; i += 3) {
      const ux = T.pos[i], uz = T.pos[i + 2];
      let uy = T.pos[i + 1];
      if (uy < -0.25) uy = -0.25 + (uy + 0.25) * 0.6; // flattened underside
      const bump = 1 + 0.07 * Math.sin(3.1 * ux + p1) * Math.sin(2.7 * uy + p2) + 0.05 * Math.sin(4.3 * uz + p3);
      const x = cx + ux * rx * bump, y = cy + uy * ry * bump, z = cz + uz * rz * bump;
      this.pos.push(x, y, z);
      let nx = ux / rx, ny = uy / ry, nz = uz / rz;
      const l = Math.hypot(nx, ny, nz) || 1;
      this.nrm.push(nx / l, ny / l, nz / l);
      const t = smoothstep(yLow, yHigh, y);
      _a.copy(low).lerp(high, t);
      this.col.push(_a.r, _a.g, _a.b);
    }
    for (const k of T.idx) this.idx.push(base + k);
  }

  /**
   * Conical trunk with a flared foot: S sides, rings from the base (y0, radius rb x 1.45) to the top (y0 + h, radius
   * rt), top offset by (lx, lz) for a slight lean. No cap: the top enters the crown and the base is buried.
   */
  trunk(x, y0, z, h, rb, rt, lx, lz, low, high, S = 7) {
    const rings = [[0, rb * 1.45], [0.12, rb * 1.12], [0.35, rb], [1, rt]];
    const base = this.vertexCount;
    for (const [f, r] of rings) {
      const cx = x + lx * f * f, cz = z + lz * f * f, y = y0 + h * f;
      _b.copy(low).lerp(high, smoothstep(0, 0.8, f));
      for (let s = 0; s < S; s++) {
        const a = (s / S) * Math.PI * 2;
        const c = Math.cos(a), sn = Math.sin(a);
        this.pos.push(cx + c * r, y, cz + sn * r);
        this.nrm.push(c, 0.15, sn);
        this.col.push(_b.r, _b.g, _b.b);
      }
    }
    for (let k = 0; k < rings.length - 1; k++) {
      for (let s = 0; s < S; s++) {
        const a = base + k * S + s, b = base + k * S + ((s + 1) % S);
        const c = a + S, d = b + S;
        this.idx.push(a, c, b, b, c, d);
      }
    }
  }

  geometry() {
    const g = new THREE.BufferGeometry();
    const n = this.vertexCount;
    g.setIndex(new THREE.BufferAttribute(n > 65535 ? new Uint32Array(this.idx) : new Uint16Array(this.idx), 1));
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nrm, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return g;
  }
}

/** Leaf families (dark below, light above), all from palette.js. */
const LEAVES = [
  { low: MOSS.ivy, high: MOSS.ivyLight, w: 4 },
  { low: MOSS.base, high: MOSS.light, w: 3 },
  { low: GRASS_KINDS.fine.base, high: GRASS_KINDS.tuft.tip, w: 2 },
];

function pickLeaves(rand) {
  const total = LEAVES.reduce((a, l) => a + l.w, 0);
  let x = rand() * total, i = 0;
  while (x > LEAVES[i].w) x -= LEAVES[i++].w;
  return { low: jitter(LEAVES[i].low, 0.04, rand), high: jitter(LEAVES[i].high, 0.04, rand) };
}

export class Forest {
  /**
   * @param {THREE.Object3D|null} scene  scene receiving `forest.group` (null: nothing added)
   * @param {object} [opts]
   * @param {(x:number, z:number) => number} [opts.heightAt]  ground height (Terrain.js by default)
   * @param {boolean} [opts.shadows=true]  the grove casts and receives sun shadows
   * @param {number} [opts.seed=4242]  layout seed
   */
  constructor(scene, { heightAt = terrainHeightAt, shadows = true, seed = 4242 } = {}) {
    this.heightAt = heightAt;
    const rand = rng(seed);
    const A = FOREST_AREA, C = CLEARING;

    // Foot of radius r: minimum ground height at the centre and on 6 points of the rim.
    const groundMin = (x, z, r) => {
      let g = heightAt(x, z);
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2;
        g = Math.min(g, heightAt(x + Math.cos(a) * r, z + Math.sin(a) * r));
      }
      return g;
    };
    const pathDist = (x, z) => segDist(x, z, 0, 0, C.x, C.z);

    // ---------------------------------------------------------------- tree layout
    // Rejection sampling: crown radius R first, then constraints (footprint, clearing, path, trunk spacing
    // >= 0.8 x (R1 + R2) and >= 1.6 m).
    this.trees = [];
    for (let tries = 0; tries < 4000 && this.trees.length < MAX_TREES; tries++) {
      const R = 1.05 + 0.75 * rand();
      const x = A.x0 + (A.x1 - A.x0) * rand(), z = A.z0 + (A.z1 - A.z0) * rand();
      // Sparser edge on the +X side (towards the origin): fewer trees are kept near x1.
      if (rand() < 0.55 * smoothstep(A.x1 - 5, A.x1, x)) continue;
      if (Math.hypot(x - C.x, z - C.z) < C.r + 0.6 + 0.35 * R) continue;
      if (pathDist(x, z) < PATH_HALF + 0.5 + 0.3 * R) continue;
      if (this.trees.some((t) => Math.hypot(t.x - x, t.z - z) < Math.max(1.6, 0.8 * (t.R + R)))) continue;
      this.trees.push({ x, z, R });
    }

    // One Builder per tree and per bush: each becomes its own mesh.
    const parts = []; // { name, B }
    this.obstacles = [];
    this.grassExclusions = [];
    let blobs = 0;

    this.trees.forEach((t, i) => {
      const B = new Builder();
      parts.push({ name: `tree_${i}`, B });
      const rb = 0.13 + 0.07 * (t.R - 1.05) / 0.75 + 0.03 * rand();
      const rt = rb * 0.55;
      const h = 1.15 + 0.85 * t.R * (0.8 + 0.4 * rand());
      const g = groundMin(t.x, t.z, rb * 1.45);
      const y0 = g - SINK;
      const la = rand() * Math.PI * 2, lean = 0.08 + 0.12 * rand();
      const lx = Math.cos(la) * lean, lz = Math.sin(la) * lean;
      const trunkLow = mix(OUTLINE.color, STONE.joint, 0.45);
      const trunkHigh = mix(STONE.joint, TERRAIN.pathEdge, 0.3);
      B.trunk(t.x, y0, t.z, h + 0.3 * t.R, rb, rt, lx, lz, trunkLow, trunkHigh);

      // Crown: main ball, 2 to 4 lower side balls, sometimes a small one on top.
      const leaves = pickLeaves(rand);
      const cx = t.x + lx, cz = t.z + lz, top = y0 + h;
      const yLow = top - 0.4 * t.R, yHigh = top + 1.6 * t.R;
      B.blob(cx, top + 0.55 * t.R, cz, t.R, 0.88 * t.R, t.R, leaves.low, leaves.high, yLow, yHigh, i * 7 + 1);
      blobs++;
      const k = 2 + Math.floor(rand() * 3), a0 = rand() * Math.PI * 2;
      for (let s = 0; s < k; s++) {
        const a = a0 + (s / k) * Math.PI * 2 + (rand() - 0.5) * 0.6;
        const d = t.R * (0.55 + 0.15 * rand()), r = t.R * (0.55 + 0.17 * rand());
        B.blob(cx + Math.cos(a) * d, top + t.R * (0.05 + 0.25 * rand()), cz + Math.sin(a) * d,
          r, 0.85 * r, r, leaves.low, leaves.high, yLow, yHigh, i * 7 + 2 + s, r < 0.75 ? 1 : 2);
        blobs++;
      }
      if (rand() < 0.5) {
        const r = 0.45 * t.R;
        B.blob(cx + (rand() - 0.5) * 0.4 * t.R, top + 1.25 * t.R, cz + (rand() - 0.5) * 0.4 * t.R,
          r, 0.85 * r, r, leaves.low, leaves.high, yLow, yHigh, i * 7 + 6, r < 0.75 ? 1 : 2);
        blobs++;
      }

      Object.assign(t, { rb, h, ground: g, top: top + 1.6 * t.R });
      const half = rb * 1.2;
      this.obstacles.push({
        name: `tree_${i}`, x: t.x, z: t.z, hx: half, hz: half, rotY: 0,
        top: y0 + h, ground: g, height: y0 + h - g, climbable: false,
      });
      this.grassExclusions.push({ x: t.x, z: t.z, r: rb * 1.45 + 0.05 });
    });

    // ---------------------------------------------------------------- round bushes
    // On the rim of the clearing (except on the path side) and on both sides of the path entrance.
    this.bushes = [];
    const pathAngle = Math.atan2(-C.z, -C.x); // direction from clearing to origin
    const bushSpots = [];
    for (let k = 0; k < 7; k++) {
      const a = pathAngle + 0.75 + (k / 6) * (Math.PI * 2 - 1.5) + (rand() - 0.5) * 0.3;
      const d = C.r + 0.3 + 0.5 * rand();
      bushSpots.push([C.x + Math.cos(a) * d, C.z + Math.sin(a) * d]);
    }
    {
      // path entrance, at the edge of the footprint (x = x1): one bush on each side
      const ex = A.x1, ez = C.z * (ex / C.x);
      const L = Math.hypot(C.x, C.z), nx = -C.z / L, nz = C.x / L;
      for (const s of [-1, 1]) bushSpots.push([ex + nx * s * (PATH_HALF + 0.9), ez + nz * s * (PATH_HALF + 0.9)]);
    }
    for (let [x, z] of bushSpots) {
      const r = 0.45 + 0.3 * rand();
      // The CLEARING disc stays entirely free: a bush that would bite into it is pushed out.
      const dc = Math.hypot(x - C.x, z - C.z), dMin = C.r + 0.1 + 0.75 * r;
      if (dc < dMin) { x = C.x + (x - C.x) / dc * dMin; z = C.z + (z - C.z) / dc * dMin; }
      if (pathDist(x, z) < PATH_HALF + r * 0.5) continue;
      if (this.trees.some((t) => Math.hypot(t.x - x, t.z - z) < t.rb * 1.45 + r + 0.2)) continue;
      const g = groundMin(x, z, r * 0.8);
      const leaves = pickLeaves(rand);
      const cy = g - SINK + 0.55 * r;
      const i = this.bushes.length;
      const B = new Builder();
      parts.push({ name: `bush_${i}`, B });
      B.blob(x, cy, z, r, 0.8 * r, r, leaves.low, leaves.high, g, g + 1.3 * r, 300 + i * 3, 2);
      blobs++;
      if (rand() < 0.7) {
        const a = rand() * Math.PI * 2, r2 = r * 0.7;
        B.blob(x + Math.cos(a) * r * 0.7, g - SINK + 0.5 * r2, z + Math.sin(a) * r * 0.7, r2, 0.8 * r2, r2,
          leaves.low, leaves.high, g, g + 1.3 * r, 301 + i * 3, r2 < 0.75 ? 1 : 2);
        blobs++;
      }
      const topY = cy + 0.8 * r;
      this.bushes.push({ x, z, r, ground: g, top: topY });
      this.obstacles.push({
        name: `bush_${i}`, x, z, hx: 0.75 * r, hz: 0.75 * r, rotY: 0,
        top: topY, ground: g, height: topY - g, climbable: false,
      });
      this.grassExclusions.push({ x, z, r: 0.8 * r });
    }

    // ---------------------------------------------------------------- one mesh per tree / bush
    // Each tree (trunk + crown) and each bush is a separate Mesh with ITS OWN toon material (never shared), so it can
    // fade alone (Occlusion.js). The default raycast is kept because Occlusion.js casts rays on these meshes; the Picker
    // only aims at the ground (`groundTargets`) and `pickables` stays empty, so clicks are not hindered.
    this.group = new THREE.Group();
    this.group.name = 'ForestGroup';
    /** Objects that can fade (one Mesh per tree or bush), read by World.occluders. */
    this.occluders = [];
    let vertices = 0, triangles = 0;
    for (const { name, B } of parts) {
      const geo = B.geometry();
      const mat = toonMaterial(0xffffff, { vertexColors: true });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.name = `Forest_${name}`;
      mesh.castShadow = shadows;
      mesh.receiveShadow = shadows;
      mesh.matrixAutoUpdate = false;
      mesh.userData.forest = name;
      vertices += geo.attributes.position.count;
      triangles += geo.index.count / 3;
      this.group.add(mesh);
      this.occluders.push(mesh);
    }

    this.clearing = { x: C.x, z: C.z, r: C.r, y: heightAt(C.x, C.z) };
    /** Nothing to click in the grove (the ground under the trees remains the Picker's target). */
    this.pickables = [];

    if (scene) scene.add(this.group);

    const n = this.occluders.length;
    this.stats = {
      trees: this.trees.length, bushes: this.bushes.length, blobs, vertices, triangles,
      meshes: n, materials: n, drawCalls: n, shadowDrawCalls: shadows ? n : 0,
    };
  }

  /** Nothing animated (present for the uniform call from World.js). */
  update() {}

  dispose() {
    this.group.parent?.remove(this.group);
    for (const m of this.occluders) {
      m.geometry.dispose();
      // Occlusion.js may have replaced the material with a copy: dispose the one in place.
      (Array.isArray(m.material) ? m.material : [m.material]).forEach((mat) => mat.dispose());
    }
    this.occluders.length = 0;
  }
}
