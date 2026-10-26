import * as THREE from 'three';
import { MEADOW_LIMIT } from './field.js';
import { GROUND, color } from '../style/palette.js';

/**
 * Relief du sol (mission catgame_monde, 2026-10-26). Décision de l'utilisateur : « Relief doux,
 * bosses d'environ 1 m au plus ».
 *
 * - `heightAt(x, z)` : hauteur du SOL en mètres (à ne pas confondre avec `Meadow.heightAt`, qui
 *   rend la hauteur de l'HERBE). `normalAt(x, z, out)` : normale unitaire du sol.
 *   Fonctions pures, sans DOM ; la même formule existe en GLSL (`GLSL_TERRAIN`) pour poser
 *   l'herbe sur le relief dans le shader. Toute modification se fait des deux côtés.
 * - Clairière de départ plate : h = 0 exactement jusqu'à CLEARING_FLAT du point de départ (0, 0),
 *   relief plein au-delà de CLEARING_FULL.
 * - Bosses : trois ondes croisées (≈ 27 m, 16 m et 7 m), écart total ≤ 0,94 m par construction.
 * - Rebord : au-delà de la limite de la prairie (MEADOW_LIMIT, field.js), le sol remonte en pente
 *   douce jusqu'à RIM_HEIGHT : la limite se lit dans le décor, sans mur.
 * Mesures (essai Node, grille de 0,1 m, 2026-10-26, tour 2) : dans la limite, h de −0,35 à
 * +0,51 m (écart 0,85 m), pente ≤ 9,5° ; rebord (bord de vallée, hors prairie) jusqu'à 2,53 m
 * vers 34 m, pente ≤ 17,2° (tour 1 : 3,05 m et 20,3°, adouci).
 *
 * Maillage : `Terrain` (une seule géométrie, grille de 128 × 128 cases sur ±70 m, resserrée au
 * centre : ≈ 0,44 m entre sommets près du chat, ≈ 2,4 m au bord, invisible dans le brouillard).
 * Le clic (Picker.js) touche le maillage par un raycast analytique sur `heightAt` (marche le long
 * du rayon puis dichotomie) : coût constant, au lieu de tester 32 768 triangles à chaque mouvement.
 */

export const CLEARING_FLAT = 3.0;   // m : sol exactement plat dans ce rayon autour de (0, 0)
export const CLEARING_FULL = 8.0;   // m : relief plein au-delà
export const BUMP_OFFSET = 0.1;     // m : un peu plus de bosses que de creux
export const RIM_START = MEADOW_LIMIT - 1;   // m : le rebord commence 1 m avant la limite
export const RIM_END = MEADOW_LIMIT + 16;    // m : rebord à pleine hauteur (tour 2 : +14 → +16, plus doux)
export const RIM_HEIGHT = 1.6;               // m : hauteur moyenne du rebord (×0,7 à ×1,3 selon l'endroit ; tour 2 : 2,0 → 1,6)
export const TERRAIN_SIZE = 70;              // m : demi-côté du maillage
export const TERRAIN_SEGMENTS = 128;

const EPS = 0.1; // m : pas des différences finies de la normale

function smoothstep(a, b, x) {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
}

/** Bosses brutes (sans la clairière ni le rebord), de −0,37 à +0,57 m au plus. */
function bumps(x, z) {
  const a = Math.sin(0.23 * x + 0.7) * Math.sin(0.19 * z + 1.9);
  const u = 0.8 * x + 0.6 * z, v = -0.6 * x + 0.8 * z;
  const b = Math.sin(0.41 * u + 2.3) * Math.sin(0.37 * v + 0.4);
  const c = Math.sin(0.93 * x - 0.53 * z + 1.1);
  return 0.28 * a + 0.15 * b + 0.04 * c + BUMP_OFFSET;
}

/** Hauteur du sol en (x, z), en mètres. */
export function heightAt(x, z) {
  const r = Math.hypot(x, z);
  const h = bumps(x, z) * smoothstep(CLEARING_FLAT, CLEARING_FULL, r);
  const rimVar = 1 + 0.3 * Math.sin(0.21 * x + 0.5) * Math.cos(0.17 * z - 0.8);
  return h + RIM_HEIGHT * rimVar * smoothstep(RIM_START, RIM_END, r);
}

/** Normale unitaire du sol en (x, z) (différences finies centrées, pas EPS). */
export function normalAt(x, z, out = new THREE.Vector3()) {
  const dx = (heightAt(x + EPS, z) - heightAt(x - EPS, z)) / (2 * EPS);
  const dz = (heightAt(x, z + EPS) - heightAt(x, z - EPS)) / (2 * EPS);
  return out.set(-dx, 1, -dz).normalize();
}

const f = (x) => x.toFixed(4);

/**
 * Même formule en GLSL : `float terrainHeight(vec2 p)` et `vec3 terrainNormal(vec2 p)`, avec
 * p = (x, z) monde. Aucune uniforme. À insérer une seule fois par shader (après `#include <common>`).
 */
export const GLSL_TERRAIN = /* glsl */ `
float terrainBumps(vec2 p) {
  float a = sin(0.23 * p.x + 0.7) * sin(0.19 * p.y + 1.9);
  vec2 uv = vec2(0.8 * p.x + 0.6 * p.y, -0.6 * p.x + 0.8 * p.y);
  float b = sin(0.41 * uv.x + 2.3) * sin(0.37 * uv.y + 0.4);
  float c = sin(0.93 * p.x - 0.53 * p.y + 1.1);
  return 0.28 * a + 0.15 * b + 0.04 * c + ${f(BUMP_OFFSET)};
}
float terrainHeight(vec2 p) {
  float r = length(p);
  float h = terrainBumps(p) * smoothstep(${f(CLEARING_FLAT)}, ${f(CLEARING_FULL)}, r);
  float rimVar = 1.0 + 0.3 * sin(0.21 * p.x + 0.5) * cos(0.17 * p.y - 0.8);
  return h + ${f(RIM_HEIGHT)} * rimVar * smoothstep(${f(RIM_START)}, ${f(RIM_END)}, r);
}
vec3 terrainNormal(vec2 p) {
  float dx = (terrainHeight(p + vec2(${f(EPS)}, 0.0)) - terrainHeight(p - vec2(${f(EPS)}, 0.0))) / ${f(2 * EPS)};
  float dz = (terrainHeight(p + vec2(0.0, ${f(EPS)})) - terrainHeight(p - vec2(0.0, ${f(EPS)}))) / ${f(2 * EPS)};
  return normalize(vec3(-dx, 1.0, -dz));
}
`;

/** Coordonnée de grille resserrée au centre : u ∈ [−1, 1] → mètres (pente 0,4 au centre, 2,2 au bord). */
function warp(u, size) {
  return size * (0.4 * u + 0.6 * u * u * u);
}

/**
 * Géométrie du sol : sommets posés sur `heightAt`, normales de `normalAt`, couleur par sommet
 * (vert clair de clairière `GROUND.center` → `GROUND.edge` au loin, crêtes un peu plus claires,
 * creux un peu plus soutenus).
 */
export function terrainGeometry(size = TERRAIN_SIZE, segments = TERRAIN_SEGMENTS) {
  const n = segments + 1;
  const pos = new Float32Array(n * n * 3);
  const nrm = new Float32Array(n * n * 3);
  const col = new Float32Array(n * n * 3);
  const center = color(GROUND.center), edge = color(GROUND.edge);
  const light = color(GROUND.center).lerp(color(0xfff4c8), 0.25);
  const deep = color(GROUND.edge).lerp(color(0x5f9a5a), 0.3);
  const c = new THREE.Color(), nv = new THREE.Vector3();
  for (let j = 0; j < n; j++) {
    const z = warp((j / segments) * 2 - 1, size);
    for (let i = 0; i < n; i++) {
      const x = warp((i / segments) * 2 - 1, size);
      const k = (j * n + i) * 3;
      const h = heightAt(x, z);
      pos[k] = x; pos[k + 1] = h; pos[k + 2] = z;
      normalAt(x, z, nv);
      nrm[k] = nv.x; nrm[k + 1] = nv.y; nrm[k + 2] = nv.z;
      c.copy(center).lerp(edge, smoothstep(2, 14, Math.hypot(x, z)));
      // Bosses (hors rebord) : crête plus claire, creux plus soutenu.
      const b = h - RIM_HEIGHT * smoothstep(RIM_START, RIM_END, Math.hypot(x, z));
      if (b > 0) c.lerp(light, Math.min(b / 0.5, 1) * 0.5);
      else c.lerp(deep, Math.min(-b / 0.4, 1) * 0.5);
      col[k] = c.r; col[k + 1] = c.g; col[k + 2] = c.b;
    }
  }
  const idx = new Uint32Array(segments * segments * 6);
  let t = 0;
  for (let j = 0; j < segments; j++) {
    for (let i = 0; i < segments; i++) {
      const a = j * n + i, b = a + 1, cc = a + n, d = cc + 1;
      // Sens direct vu d'en haut (normale de face vers +y).
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
  g.computeBoundingBox();
  return g;
}

const _p = new THREE.Vector3();

/**
 * Raycast analytique sur `heightAt` (remplace celui du Mesh) : marche le long du rayon avec un pas
 * qui grandit avec la distance (5 cm au départ, ≈ 2 m à 100 m), puis 24 dichotomies. Ne touche
 * que l'intérieur du maillage (|x|, |z| ≤ size). Écart vertical au maillage dessiné (essai Node) :
 * ≤ 1 cm dans la limite de la prairie, ≤ 2,5 cm au-delà (cases plus grandes).
 * Résultat : { distance, point, object, face: null } (Picker.js n'utilise que `point`).
 */
function raycastTerrain(size) {
  return function raycast(raycaster, intersects) {
    const { origin: o, direction: d } = raycaster.ray;
    const far = Math.min(raycaster.far, 3 * size);
    let t0 = raycaster.near;
    const gap = (t) => o.y + d.y * t - heightAt(o.x + d.x * t, o.z + d.z * t);
    let g0 = gap(t0);
    if (g0 <= 0) return; // origine sous le sol
    while (t0 < far) {
      const t1 = Math.min(t0 + 0.05 + 0.02 * t0, far);
      const g1 = gap(t1);
      if (g1 <= 0) {
        let lo = t0, hi = t1;
        for (let k = 0; k < 24; k++) {
          const mid = 0.5 * (lo + hi);
          if (gap(mid) > 0) lo = mid; else hi = mid;
        }
        _p.copy(d).multiplyScalar(hi).add(o);
        if (Math.abs(_p.x) > size || Math.abs(_p.z) > size) return;
        intersects.push({ distance: hi, point: _p.clone(), object: this, face: null });
        return;
      }
      t0 = t1; g0 = g1;
    }
  };
}

/**
 * Sol à relief : `terrain.mesh` (Mesh nommé « Terrain », reçoit les ombres, matériau mat Lambert
 * à couleurs par sommet), `terrain.heightAt`, `terrain.normalAt`. Fixe dans le monde (ne suit
 * plus la caméra, contrairement à l'ancien plan).
 */
export class Terrain {
  constructor({ size = TERRAIN_SIZE, segments = TERRAIN_SEGMENTS } = {}) {
    this.size = size;
    this.geometry = terrainGeometry(size, segments);
    this.material = new THREE.MeshLambertMaterial({ vertexColors: true });
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.name = 'Terrain';
    this.mesh.receiveShadow = true;
    this.mesh.raycast = raycastTerrain(size);
  }

  heightAt(x, z) { return heightAt(x, z); }

  normalAt(x, z, out) { return normalAt(x, z, out); }

  /** Triangles du maillage. */
  get triangles() { return this.geometry.index.count / 3; }
}
