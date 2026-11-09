import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { GLSL_FIELD, inject, windAt, pushFrom, MEADOW_LIMIT } from './field.js';
import { heightAt as groundAt } from './Terrain.js';
import { grassHeight, exclusionDistance, catBend, GLSL_CAT } from './Grass.js';
import { FLOWERS, toonMaterial, color, mix } from '../style/palette.js';
import { rng } from './random.js';

/**
 * Tall flowers of the meadow, used by Meadow.js: five simple species (stem, leaves, corolla), one `InstancedMesh` per
 * species, fixed positions around the start point (fixed seed: same flowers every game). Each flower is modelled with a
 * stem of height 1, then scaled to its real height; wind bends the stem (offset proportional to height^2), like the grass
 * but stiffer.
 *
 * Soft cartoon style: pastel `FLOWERS` colours, large round petals, soft brown hearts instead of black, flat toon shading.
 * Feet sit on the relief (Terrain.js `heightAt`), stem height follows the grass (Grass.js `grassHeight`), and no flower
 * grows in wall footprints or within FLOWER_WALL_GAP of their edge.
 */

export const FLOWER_WIND = 0.45; // a flower stem bends less than a grass blade
export const FLOWER_PUSH = 0.8;  // pushed by the cat (and the camera) a little less than grass
// Flowers are seeded within this radius around the origin (m). The first 46 clumps use NEAR_RADIUS;
// OUTER_CLUMPS sparser clumps then cover 20 to 41 m.
export const FIELD_RADIUS = MEADOW_LIMIT + 2;
const NEAR_RADIUS = 20;
const OUTER_CLUMPS = 30;

const STEM = FLOWERS.stem, LEAF = FLOWERS.leaf;
// Colours derived locally from the palette (not in palette.js):
const CORNFLOWER_LIGHT = mix(FLOWERS.cornflower, 0xffffff, 0.3).getHex(); // light cornflower petal (alternating)
const POPPY_LIGHT = mix(FLOWERS.poppy, 0xffffff, 0.18).getHex();          // light poppy petal (alternating)

function colored(geom, hex) {
  const c = color(hex);
  const n = geom.attributes.position.count;
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) col.set([c.r, c.g, c.b], i * 3);
  geom.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return geom;
}

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3();
const _e = new THREE.Euler();

/** Ellipsoid (petal, leaf): radii rx, ry, rz, placed at (x, y, z), rotated by (ax, ay, az). */
function ellipsoid(rx, ry, rz, x, y, z, ax, ay, az, hex, ws = 6, hs = 4) {
  const g = new THREE.SphereGeometry(1, ws, hs);
  _m.compose(_p.set(x, y, z), _q.setFromEuler(_e.set(ax, ay, az, 'YZX')), _s.set(rx, ry, rz));
  g.applyMatrix4(_m);
  return colored(g, hex);
}

function stem(r0 = 0.012, r1 = 0.009) {
  const g = new THREE.CylinderGeometry(r1, r0, 1, 5, 5, true);
  g.translate(0, 0.5, 0);
  return colored(g, STEM);
}

/** Two wide oval leaves (round tips), on either side of the stem. */
function leaves(y0 = 0.28, y1 = 0.5) {
  return [
    ellipsoid(0.09, 0.008, 0.038, 0.075, y0, 0, 0, 0, 0.5, LEAF),
    ellipsoid(0.078, 0.008, 0.033, -0.066, y1, 0, 0, Math.PI, 0.55, LEAF),
  ];
}

/**
 * Disc of round petals around the Y axis, at height y. `hex`: one colour, or two alternating colours ([a, b]).
 */
function petalRing(count, len, width, thick, y, tilt, hex, offset = 0) {
  const out = [];
  for (let k = 0; k < count; k++) {
    const a = (k / count) * Math.PI * 2 + offset;
    // Oval petal along local X, turned around Y, tilted (tilt > 0: upwards).
    const g = new THREE.SphereGeometry(1, 6, 3);
    g.scale(len, thick, width);
    g.translate(len * 0.9, 0, 0);
    g.rotateZ(tilt);
    g.rotateY(a);
    g.translate(0, y, 0);
    out.push(colored(g, Array.isArray(hex) ? hex[k % hex.length] : hex));
  }
  return out;
}

/**
 * Species: normalised geometry (stem of height 1), draw weight, height factor. Large round corollas stay readable from
 * afar; short stems (see `scatter`) and wide leaves dress the stem.
 */
export const SPECIES = {
  daisy: {
    weight: 3, heightFactor: [1.05, 1.2], headY: 1.012,
    build: () => [stem(), ...leaves(),
      // Domed heart (flattened half ball) and 11 wide oval petals, slightly raised.
      ellipsoid(0.04, 0.022, 0.04, 0, 1.012, 0, 0, 0, 0, FLOWERS.daisyHeart, 8, 4),
      ...petalRing(11, 0.05, 0.027, 0.008, 1.008, 0.12, FLOWERS.daisyPetal)],
  },
  poppy: {
    weight: 2, heightFactor: [1.05, 1.2], headY: 1.04,
    build: () => [stem(0.011, 0.008), ...leaves(0.22, 0.4),
      // Cup of five large round petals (two coral tones) around a soft brown heart.
      ...petalRing(5, 0.056, 0.052, 0.01, 1.0, 0.6, [FLOWERS.poppy, POPPY_LIGHT]),
      ellipsoid(0.022, 0.02, 0.022, 0, 1.024, 0, 0, 0, 0, FLOWERS.poppyHeart)],
  },
  cornflower: {
    weight: 2, heightFactor: [1.0, 1.15], headY: 1.035,
    build: () => [stem(0.01, 0.008), ...leaves(0.3, 0.55),
      // Light green calyx, ring of 8 round periwinkle petals (two tones), lavender heart.
      ellipsoid(0.022, 0.026, 0.022, 0, 1.0, 0, 0, 0, 0, FLOWERS.cornflowerBud),
      ...petalRing(8, 0.036, 0.025, 0.009, 1.024, 0.4, [FLOWERS.cornflower, CORNFLOWER_LIGHT]),
      ellipsoid(0.017, 0.015, 0.017, 0, 1.036, 0, 0, 0, 0, FLOWERS.lavender)],
  },
  buttercup: {
    weight: 2, heightFactor: [0.95, 1.1], headY: 1.015,
    build: () => [stem(0.01, 0.008), ...leaves(0.2, 0.42),
      ...petalRing(5, 0.033, 0.033, 0.008, 1.0, 0.45, FLOWERS.buttercup),
      ellipsoid(0.016, 0.014, 0.016, 0, 1.014, 0, 0, 0, 0, FLOWERS.buttercupHeart)],
  },
  lupin: {
    weight: 1, heightFactor: [1.1, 1.25], headY: 0.9,
    build: () => {
      // Lavender spike: plump round balls, lighter towards the top.
      const parts = [stem(0.012, 0.009), ...leaves(0.2, 0.36)];
      for (let k = 0; k < 11; k++) {
        const t = k / 10;
        const r = 0.042 * (1 - 0.55 * t);
        const hex = t < 0.5 ? FLOWERS.lavender : FLOWERS.lavenderLight;
        parts.push(ellipsoid(r, r * 0.85, r, 0, 0.7 + 0.34 * t, 0, 0, 0, 0, hex));
      }
      return parts;
    },
  },
};

/** Distance from a wall below which no flower is seeded (m). */
export const FLOWER_WALL_GAP = 0.35;

/**
 * Flower draw: clumps of one species, some at the edge of the clearing, nothing under the cat at the start, nothing in
 * wall footprints (`exclusions`, see Grass.js `exclusionDistance`).
 */
function scatter(seed, exclusions = []) {
  const rand = rng(seed);
  const names = Object.keys(SPECIES);
  const total = names.reduce((s, n) => s + SPECIES[n].weight, 0);
  const pick = () => {
    let r = rand() * total;
    for (const n of names) { r -= SPECIES[n].weight; if (r <= 0) return n; }
    return names[0];
  };
  const out = [];
  const clump = (cx, cz, species, n, spread = 0.9, limit = NEAR_RADIUS) => {
    for (let i = 0; i < n; i++) {
      const a = rand() * Math.PI * 2, d = Math.sqrt(rand()) * spread;
      const x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
      if (Math.hypot(x, z) < 1.0 || Math.hypot(x, z) > limit) continue;
      if (out.some((f) => Math.hypot(f.x - x, f.z - z) < 0.12)) continue;
      const sp = SPECIES[species];
      const k = sp.heightFactor[0] + (sp.heightFactor[1] - sp.heightFactor[0]) * rand();
      const wall = exclusions.length ? exclusionDistance(exclusions, x, z) : 2;
      if (wall < FLOWER_WALL_GAP) continue;
      // Clearing: short stems (0.26-0.36 m, below the cat's head at 0.54 m); elsewhere, the corolla reaches the top of
      // the grass and the stem stays hidden in the blades.
      const fh = grassHeight(x, z, wall);
      const height = Math.max(0.26 + 0.1 * rand(), fh * k);
      // In tall grass, wider corolla (x1 to x1.7, width only) so heads stay large and readable above the tufts; x1 in
      // the clearing.
      const spreadXZ = 1 + 0.7 * Math.min(Math.max((fh - 0.3) / 0.6, 0), 1);
      out.push({ species, x, z, ground: groundAt(x, z), height, spreadXZ, yaw: rand() * Math.PI * 2 });
    }
  };
  // Eight tight clumps at the edge of the clearing (visible from the start), then the rest of the meadow.
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + rand() * 0.5, r = 1.8 + rand() * 1.4;
    clump(Math.cos(a) * r, Math.sin(a) * r, pick(), 4 + Math.floor(rand() * 3), 0.4);
  }
  for (let i = 0; i < 38; i++) {
    const a = rand() * Math.PI * 2, r = 3.5 + Math.sqrt(rand()) * (NEAR_RADIUS - 4);
    clump(Math.cos(a) * r, Math.sin(a) * r, pick(), 3 + Math.floor(rand() * 6));
  }
  // Outer ring (drawn last, so the inner flowers do not move), spread by equal area between NEAR_RADIUS and
  // FIELD_RADIUS - 1.
  const R0 = NEAR_RADIUS, R1 = FIELD_RADIUS - 1;
  for (let i = 0; i < OUTER_CLUMPS; i++) {
    const a = rand() * Math.PI * 2, r = Math.sqrt(R0 * R0 + rand() * (R1 * R1 - R0 * R0));
    clump(Math.cos(a) * r, Math.sin(a) * r, pick(), 3 + Math.floor(rand() * 4), 0.9, FIELD_RADIUS);
  }
  return out;
}

// The cat bends flowers like grass (Grass.js `catBend`: oriented body + planted paws); under the belly, the stem lies
// down along the flower's own orientation (`yaw`, read from instanceMatrix).
const VERTEX_HEAD = /* glsl */ `
${GLSL_FIELD}
${GLSL_CAT}
`;
const VERTEX_SWAY = /* glsl */ `
vec3 transformed = vec3( position );
{
  vec3 fRoot = ( instanceMatrix * vec4( 0.0, 0.0, 0.0, 1.0 ) ).xyz;
  float fH = length( instanceMatrix[1].xyz );
  float fY = max( position.y, 0.0 );
  float fYaw = fH > 0.0 ? atan( -instanceMatrix[0].z, instanceMatrix[0].x ) : 0.0; // hidden flower: scale 0
  vec2 fPush = catBend( fRoot.xz, 1.0, 1.0, fYaw ) + pushOne( fRoot.xz, uPushB );
  vec2 fOff = ( windAt( fRoot.xz, uTime ) * ${FLOWER_WIND.toFixed(3)} + fPush * ${FLOWER_PUSH.toFixed(3)} ) * ( fH * fY * fY );
  transformed += inverse( mat3( instanceMatrix ) ) * vec3( fOff.x, 0.0, fOff.y );
}
`;

export class Flowers {
  /**
   * @param {object} uniforms shared meadow uniforms
   * @param {number} seed draw seed
   * @param {object[]} exclusions flower-free areas (walls), see Grass.js `exclusionDistance`
   */
  constructor(uniforms, seed = 7, exclusions = []) {
    this.group = new THREE.Group();
    this.group.name = 'Flowers';
    this.list = scatter(seed, exclusions);
    const mat = toonMaterial(0xffffff, { vertexColors: true, side: THREE.DoubleSide });
    mat.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = inject(shader.vertexShader, '#include <common>', VERTEX_HEAD);
      shader.vertexShader = inject(shader.vertexShader, '#include <begin_vertex>', VERTEX_SWAY, true);
    };
    mat.customProgramCacheKey = () => 'lost-flowers-toon';
    this.material = mat;
    this.meshes = {};
    this.triangles = 0;
    for (const [name, sp] of Object.entries(SPECIES)) {
      const items = this.list.filter((f) => f.species === name);
      if (!items.length) continue;
      const geom = mergeGeometries(sp.build(), false);
      const mesh = new THREE.InstancedMesh(geom, mat, items.length);
      items.forEach((f, i) => {
        // Foot on the relief (Terrain.js `heightAt`).
        _m.compose(_p.set(f.x, f.ground, f.z), _q.setFromAxisAngle(_s.set(0, 1, 0), f.yaw), _s.set(f.height * f.spreadXZ, f.height, f.height * f.spreadXZ));
        mesh.setMatrixAt(i, _m);
        f.slot = i;
      });
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
      mesh.name = `Flowers_${name}`;
      mesh.receiveShadow = true;
      mesh.castShadow = false;
      mesh.raycast = () => {}; // never hit by a Raycaster (ground click of Picker.js)
      this.group.add(mesh);
      this.meshes[name] = mesh;
      this.triangles += (geom.index ? geom.index.count / 3 : geom.attributes.position.count / 3) * items.length;
    }
    // Public list: stable index, species, foot (x, z), stem height, corolla centre at rest.
    this.list.forEach((f, i) => {
      f.index = i;
      f.hidden = false;
      f.headY = SPECIES[f.species].headY;
      f.top = new THREE.Vector3(f.x, f.ground + f.height * f.headY, f.z);
    });
  }

  /**
   * Wall areas known after creation: flowers falling in them are hidden (scale 0, `hidden = true`); indices stay stable
   * (butterfly lists). A hidden flower stays hidden while inside an area and reappears when the list no longer covers it.
   */
  applyExclusions(exclusions) {
    const touched = new Set();
    for (const f of this.list) {
      const hide = exclusions.length > 0 && exclusionDistance(exclusions, f.x, f.z) < FLOWER_WALL_GAP;
      if (hide === f.hidden) continue;
      f.hidden = hide;
      const mesh = this.meshes[f.species];
      const k = hide ? 0 : 1;
      _m.compose(_p.set(f.x, f.ground, f.z), _q.setFromAxisAngle(_s.set(0, 1, 0), f.yaw),
        _s.set(f.height * f.spreadXZ * k, f.height * k, f.height * f.spreadXZ * k));
      mesh.setMatrixAt(f.slot, _m);
      touched.add(mesh);
    }
    for (const mesh of touched) { mesh.instanceMatrix.needsUpdate = true; mesh.computeBoundingSphere(); }
  }

  /**
   * Centre of the corolla of flower `i` at time `t`, with wind and parting (same formula as the shader, except for the
   * stem twist). `env` = { windDir, windStrength, cat, pushB } (`cat`: state of the cat's passage, Grass.js `catBend`).
   */
  top(i, t, env, out = new THREE.Vector3()) {
    const f = this.list[i];
    const w = windAt(f.x, f.z, t, env.windDir, env.windStrength, _w1);
    const a = catBend(f.x, f.z, env.cat, t, 1, 1, f.yaw, _w2);
    const b = pushFrom(f.x, f.z, env.pushB, _w3);
    const y = f.headY, k = f.height * y * y;
    out.set(
      f.x + (w.x * FLOWER_WIND + (a.x + b.x) * FLOWER_PUSH) * k,
      f.ground + f.height * y,
      f.z + (w.z * FLOWER_WIND + (a.z + b.z) * FLOWER_PUSH) * k,
    );
    return out;
  }
}

const _w1 = { x: 0, z: 0 }, _w2 = { x: 0, z: 0 }, _w3 = { x: 0, z: 0 };
