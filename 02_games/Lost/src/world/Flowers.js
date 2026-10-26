import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { GLSL_FIELD, inject, windAt, pushFrom } from './field.js';
import { heightAt as groundAt } from './Terrain.js';
import { grassHeight, exclusionDistance } from './Grass.js';
import { FLOWERS, toonMaterial, color, mix } from '../style/palette.js';

/**
 * Fleurs hautes : cinq espèces simples (tige, feuilles, corolle), une `InstancedMesh` par espèce,
 * positions fixes autour du point de départ (tirage à graine fixe : mêmes fleurs à chaque partie).
 * Chaque fleur est modélisée avec une tige de hauteur 1 puis mise à l'échelle (uniforme) à sa
 * hauteur réelle ; le vent plie la tige (déplacement ∝ hauteur²), comme l'herbe mais plus raide.
 *
 * Style « dessin animé doux » (mission catgame_style, docs/recherche/style.md § 6, point 7) :
 * couleurs pastel de `FLOWERS`, pétales ronds et larges (plus de cônes pointus), cœurs bruns doux
 * au lieu de noir, ombrage en aplats (`toonMaterial`).
 *
 * Mission catgame_monde (2026-10-26, agent G) : pied posé sur le relief (`f.ground` = Terrain.js
 * `heightAt`), hauteur de tige d'après le champ d'herbe de Grass.js (`grassHeight`), aucune fleur
 * dans l'emprise des murs ni à moins de FLOWER_WALL_GAP de leur bord.
 */

export const FLOWER_WIND = 0.45; // une tige de fleur plie moins qu'un brin d'herbe
export const FLOWER_PUSH = 0.8;  // écartée par le chat (et la caméra) un peu moins que l'herbe
export const FIELD_RADIUS = 20;  // fleurs semées dans ce rayon autour de l'origine (m)

const STEM = FLOWERS.stem, LEAF = FLOWERS.leaf;
// Couleurs dérivées localement de la palette (absentes de palette.js) :
const CORNFLOWER_LIGHT = mix(FLOWERS.cornflower, 0xffffff, 0.3).getHex(); // pétale clair du bleuet (alterné)
const POPPY_LIGHT = mix(FLOWERS.poppy, 0xffffff, 0.18).getHex();          // pétale clair du coquelicot (alterné)

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

/** Ellipsoïde (pétale, feuille) : rayons rx, ry, rz, placé en (x, y, z), tourné (ax, ay, az). */
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

/** Deux feuilles ovales et larges (bouts ronds), de part et d'autre de la tige. */
function leaves(y0 = 0.28, y1 = 0.5) {
  return [
    ellipsoid(0.09, 0.008, 0.038, 0.075, y0, 0, 0, 0, 0.5, LEAF),
    ellipsoid(0.078, 0.008, 0.033, -0.066, y1, 0, 0, Math.PI, 0.55, LEAF),
  ];
}

/**
 * Disque de pétales ronds autour de l'axe Y, à la hauteur y. `hex` : une couleur, ou deux
 * couleurs alternées ([a, b]).
 */
function petalRing(count, len, width, thick, y, tilt, hex, offset = 0) {
  const out = [];
  for (let k = 0; k < count; k++) {
    const a = (k / count) * Math.PI * 2 + offset;
    // Pétale ovale selon X local, tourné autour de Y, incliné (tilt > 0 : vers le haut).
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
 * Espèces : géométrie normalisée (tige de hauteur 1), poids de tirage, facteur de hauteur.
 * Correction 1 : corolles environ deux fois plus grandes et plus rondes (lisibles de loin),
 * tiges plus courtes (voir `scatter`) et feuilles plus larges pour habiller la tige.
 */
export const SPECIES = {
  marguerite: {
    weight: 3, heightFactor: [1.05, 1.2], headY: 1.012,
    build: () => [stem(), ...leaves(),
      // Cœur bombé (demi-boule aplatie) et 11 pétales ovales larges, un peu relevés.
      ellipsoid(0.04, 0.022, 0.04, 0, 1.012, 0, 0, 0, 0, FLOWERS.daisyHeart, 8, 4),
      ...petalRing(11, 0.05, 0.027, 0.008, 1.008, 0.12, FLOWERS.daisyPetal)],
  },
  coquelicot: {
    weight: 2, heightFactor: [1.05, 1.2], headY: 1.04,
    build: () => [stem(0.011, 0.008), ...leaves(0.22, 0.4),
      // Coupe de cinq grands pétales ronds (deux tons corail) autour d'un cœur brun doux.
      ...petalRing(5, 0.056, 0.052, 0.01, 1.0, 0.6, [FLOWERS.poppy, POPPY_LIGHT]),
      ellipsoid(0.022, 0.02, 0.022, 0, 1.024, 0, 0, 0, 0, FLOWERS.poppyHeart)],
  },
  bleuet: {
    weight: 2, heightFactor: [1.0, 1.15], headY: 1.035,
    build: () => [stem(0.01, 0.008), ...leaves(0.3, 0.55),
      // Calice vert tendre, couronne de 8 pétales ronds pervenche (deux tons), cœur lavande.
      ellipsoid(0.022, 0.026, 0.022, 0, 1.0, 0, 0, 0, 0, FLOWERS.cornflowerBud),
      ...petalRing(8, 0.036, 0.025, 0.009, 1.024, 0.4, [FLOWERS.cornflower, CORNFLOWER_LIGHT]),
      ellipsoid(0.017, 0.015, 0.017, 0, 1.036, 0, 0, 0, 0, FLOWERS.lavender)],
  },
  boutonDOr: {
    weight: 2, heightFactor: [0.95, 1.1], headY: 1.015,
    build: () => [stem(0.01, 0.008), ...leaves(0.2, 0.42),
      ...petalRing(5, 0.033, 0.033, 0.008, 1.0, 0.45, FLOWERS.buttercup),
      ellipsoid(0.016, 0.014, 0.016, 0, 1.014, 0, 0, 0, 0, FLOWERS.buttercupHeart)],
  },
  lupin: {
    weight: 1, heightFactor: [1.1, 1.25], headY: 0.9,
    build: () => {
      // Épi de lavande : boules rondes dodues, plus claires vers le haut.
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

function rng(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Distance au mur en deçà de laquelle aucune fleur n'est semée (m). */
export const FLOWER_WALL_GAP = 0.35;

/**
 * Tirage des fleurs : massifs d'une espèce, quelques-uns au bord de la clairière, rien sous le chat
 * au départ, rien dans l'emprise des murs (`exclusions`, voir Grass.js `exclusionDistance`).
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
  const clump = (cx, cz, species, n, spread = 0.9) => {
    for (let i = 0; i < n; i++) {
      const a = rand() * Math.PI * 2, d = Math.sqrt(rand()) * spread;
      const x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
      if (Math.hypot(x, z) < 1.0 || Math.hypot(x, z) > FIELD_RADIUS) continue;
      if (out.some((f) => Math.hypot(f.x - x, f.z - z) < 0.12)) continue;
      const sp = SPECIES[species];
      const k = sp.heightFactor[0] + (sp.heightFactor[1] - sp.heightFactor[0]) * rand();
      const wall = exclusions.length ? exclusionDistance(exclusions, x, z) : 2;
      if (wall < FLOWER_WALL_GAP) continue;
      // Clairière : tiges courtes (0,26-0,36 m, sous la tête du chat à 0,54 m) ; ailleurs, la
      // corolle affleure le haut de l'herbe et la tige reste cachée dans les brins.
      const fh = grassHeight(x, z, wall);
      const height = Math.max(0.26 + 0.1 * rand(), fh * k);
      // Correction 2 : en herbe haute, corolle élargie (×1 à ×1,7 en largeur seulement) pour
      // que les têtes restent grosses et lisibles au-dessus des touffes ; ×1 en clairière.
      const spreadXZ = 1 + 0.7 * Math.min(Math.max((fh - 0.3) / 0.6, 0), 1);
      out.push({ species, x, z, ground: groundAt(x, z), height, spreadXZ, yaw: rand() * Math.PI * 2 });
    }
  };
  // Huit bouquets serrés au bord de la clairière (visibles depuis le départ), puis le reste de la prairie.
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + rand() * 0.5, r = 1.8 + rand() * 1.4;
    clump(Math.cos(a) * r, Math.sin(a) * r, pick(), 4 + Math.floor(rand() * 3), 0.4);
  }
  for (let i = 0; i < 38; i++) {
    const a = rand() * Math.PI * 2, r = 3.5 + Math.sqrt(rand()) * (FIELD_RADIUS - 4);
    clump(Math.cos(a) * r, Math.sin(a) * r, pick(), 3 + Math.floor(rand() * 6));
  }
  return out;
}

const VERTEX_HEAD = /* glsl */ `
${GLSL_FIELD}
`;
const VERTEX_SWAY = /* glsl */ `
vec3 transformed = vec3( position );
{
  vec3 fRoot = ( instanceMatrix * vec4( 0.0, 0.0, 0.0, 1.0 ) ).xyz;
  float fH = length( instanceMatrix[1].xyz );
  float fY = max( position.y, 0.0 );
  vec2 fOff = ( windAt( fRoot.xz, uTime ) * ${FLOWER_WIND.toFixed(3)} + pushAt( fRoot.xz ) * ${FLOWER_PUSH.toFixed(3)} ) * ( fH * fY * fY );
  transformed += inverse( mat3( instanceMatrix ) ) * vec3( fOff.x, 0.0, fOff.y );
}
`;

export class Flowers {
  /**
   * @param {object} uniforms uniformes partagés de la prairie
   * @param {number} seed graine du tirage
   * @param {object[]} exclusions zones sans fleurs (murs), voir Grass.js `exclusionDistance`
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
    mat.customProgramCacheKey = () => 'catgame-flowers-toon-1';
    this.material = mat;
    this.meshes = {};
    this.triangles = 0;
    for (const [name, sp] of Object.entries(SPECIES)) {
      const items = this.list.filter((f) => f.species === name);
      if (!items.length) continue;
      const geom = mergeGeometries(sp.build(), false);
      const mesh = new THREE.InstancedMesh(geom, mat, items.length);
      items.forEach((f, i) => {
        // Pied posé sur le relief (Terrain.js `heightAt`).
        _m.compose(_p.set(f.x, f.ground, f.z), _q.setFromAxisAngle(_s.set(0, 1, 0), f.yaw), _s.set(f.height * f.spreadXZ, f.height, f.height * f.spreadXZ));
        mesh.setMatrixAt(i, _m);
        f.slot = i;
      });
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
      mesh.name = `Flowers_${name}`;
      mesh.receiveShadow = true;
      mesh.castShadow = false;
      mesh.raycast = () => {}; // jamais touché par un Raycaster (clic au sol de Picker.js)
      this.group.add(mesh);
      this.meshes[name] = mesh;
      this.triangles += (geom.index ? geom.index.count / 3 : geom.attributes.position.count / 3) * items.length;
    }
    // Liste publique : index stable, espèce, pied (x, z), hauteur de la tige, centre de corolle au repos.
    this.list.forEach((f, i) => {
      f.index = i;
      f.hidden = false;
      f.headY = SPECIES[f.species].headY;
      f.top = new THREE.Vector3(f.x, f.ground + f.height * f.headY, f.z);
    });
  }

  /**
   * Zones de murs connues après la création : les fleurs qui y tombent sont cachées (échelle 0,
   * `hidden = true`) ; les index restent stables (listes des papillons). Une fleur cachée reste
   * cachée tant qu'elle est dans une zone ; elle réapparaît si la liste ne la couvre plus.
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
   * Centre de la corolle de la fleur `i` à l'instant `t`, vent et écartement compris (même
   * formule que le shader, à la torsion près de la tige). `env` = { windDir, windStrength, pushA, pushB }.
   */
  top(i, t, env, out = new THREE.Vector3()) {
    const f = this.list[i];
    const w = windAt(f.x, f.z, t, env.windDir, env.windStrength, _w1);
    const a = pushFrom(f.x, f.z, env.pushA, _w2);
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
