import * as THREE from 'three';
import { Grass, LAYERS, CLEAR_START, CLEAR_END, WALL_FAR, grassHeight, clearingAt, exclusionDistance } from './Grass.js';
import { Flowers, SPECIES, FIELD_RADIUS } from './Flowers.js';
import { windAt, pushFrom, MEADOW_LIMIT } from './field.js';
import { heightAt as groundAt } from './Terrain.js';

export { grassHeight, clearingAt, exclusionDistance, CLEAR_START, CLEAR_END, LAYERS, SPECIES, FIELD_RADIUS };

/**
 * Part des bouquets d'herbe dessinés selon le niveau de qualité (0 = plein, 3 = le plus bas).
 * Les fleurs ne changent pas (positions stables pour les papillons, coût faible).
 */
export const QUALITY_DENSITY = [1, 0.75, 0.55, 0.4];

/**
 * Texture de distance aux murs : carré de 2 × EXCL_HALF m centré sur l'origine, EXCL_RES texels
 * de côté (≈ 0,13 m). Au-delà du carré, aucun mur n'a d'effet sur l'herbe.
 */
export const EXCL_HALF = MEADOW_LIMIT + 6;
export const EXCL_RES = 384;

const smooth = (a, b, x) => { const t = Math.min(Math.max((x - a) / (b - a), 0), 1); return t * t * (3 - 2 * t); };

/** Texture « aucun mur » (1 texel à la distance maximale). */
function emptyMask() {
  const tex = new THREE.DataTexture(new Uint8Array([255]), 1, 1, THREE.RedFormat, THREE.UnsignedByteType);
  tex.needsUpdate = true;
  return tex;
}

/** Texture de distance (0 dans un mur → 255 à WALL_FAR m ou plus) pour une liste de zones. */
function buildMask(list) {
  const n = EXCL_RES, size = 2 * EXCL_HALF, data = new Uint8Array(n * n);
  for (let j = 0; j < n; j++) {
    const z = -EXCL_HALF + ((j + 0.5) / n) * size;
    for (let i = 0; i < n; i++) {
      const x = -EXCL_HALF + ((i + 0.5) / n) * size;
      const d = exclusionDistance(list, x, z);
      data[j * n + i] = Math.round(Math.min(Math.max(d / WALL_FAR, 0), 1) * 255);
    }
  }
  const tex = new THREE.DataTexture(data, n, n, THREE.RedFormat, THREE.UnsignedByteType);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Prairie : herbe au vent (brins fins, touffes, épillets, herbe courte ; Grass.js) + fleurs hautes.
 * Créée par `World` (`world.meadow`). Le chat part de l'origine, dans une clairière d'herbe courte
 * et clairsemée au bord irrégulier ; au-delà, les brins montent à 0,4-1,1 m (×0,75-1,25 par
 * bouquet), souvent au-dessus de sa tête (0,54 m). Tout est posé sur le relief (Terrain.js).
 *
 * Murs (Ruins.js) : `new Meadow(scene, { exclusions })` ou `meadow.setExclusions(list)`, avec des
 * zones `{ x, z, hx, hz, rotY }` (rectangle, demi-côtés en m, rotation autour de Y comme
 * `Object3D.rotation.y`) ou `{ x, z, r }` (disque). Pas d'herbe dedans, herbe courte au pied
 * (≈ 1 m), pas de fleur à moins de 0,35 m.
 */
export class Meadow {
  constructor(scene, { seed = 1, exclusions = [] } = {}) {
    this.exclusions = exclusions.slice();
    this.uniforms = {
      uTime: { value: 0 },
      uWindDir: { value: new THREE.Vector2(0.8, 0.6) },
      uWindStrength: { value: 0.22 },
      // Chat : couchage des brins dans un rayon de 0,8 m (plus de trou d'herbe rase autour de lui).
      uPushA: { value: new THREE.Vector4(0, 0, 0.8, 1.3) },
      uPushB: { value: new THREE.Vector4(0, 0, 0.7, 0) },
      uCenter: { value: new THREE.Vector2() },
      uCorridor: { value: new THREE.Vector4() },
      uCorridorOn: { value: 1 },
      uExcl: { value: this.exclusions.length ? buildMask(this.exclusions) : emptyMask() },
      uExclBox: { value: new THREE.Vector4(-EXCL_HALF, -EXCL_HALF, 2 * EXCL_HALF, WALL_FAR) },
    };
    this.grass = new Grass(this.uniforms, seed);
    this.flowers = new Flowers(this.uniforms, seed * 7, this.exclusions);
    this.group = new THREE.Group();
    this.group.name = 'Meadow';
    this.group.add(this.grass.group, this.flowers.group);
    scene.add(this.group);

    this.time = 0;
    this.quality = 0;
    // Environnement courant, partagé avec `flowerTop` (mêmes valeurs que les uniformes).
    this.env = {
      windDir: { x: 0.8, z: 0.6 },
      windStrength: 0.22,
      pushA: { x: 0, z: 0, radius: 0.8, strength: 1.3 },
      pushB: { x: 0, z: 0, radius: 0.7, strength: 0 },
    };
  }

  /**
   * Zones sans herbe (empreintes des murs de Ruins.js), remplace la liste précédente. Coût : une
   * texture de 384 × 384 recalculée (à appeler une fois, pas à chaque image). Les fleurs déjà
   * semées qui tombent dans une zone sont cachées (`flowerList[i].hidden`), les index ne changent pas.
   */
  setExclusions(list = []) {
    this.exclusions = list.slice();
    const old = this.uniforms.uExcl.value;
    this.uniforms.uExcl.value = this.exclusions.length ? buildMask(this.exclusions) : emptyMask();
    old.dispose();
    this.flowers.applyExclusions(this.exclusions);
  }

  /** Distance (m) de (x, z) au mur le plus proche, négative dedans, bornée à 2 m. */
  wallDistance(x, z) {
    return this.exclusions.length ? exclusionDistance(this.exclusions, x, z) : WALL_FAR;
  }

  /**
   * À chaque image (appelé par `World.update`). `catPos` = position au sol du chat ;
   * `camera` = caméra ; `center` = point suivi par la caméra (centre des tuiles d'herbe).
   */
  update(dt, catPos, camera, center) {
    this.time += dt;
    const u = this.uniforms;
    u.uTime.value = this.time;
    const e = this.env;
    e.windStrength = u.uWindStrength.value;
    e.windDir.x = u.uWindDir.value.x; e.windDir.z = u.uWindDir.value.y;
    e.pushA.x = catPos.x; e.pushA.z = catPos.z;
    u.uPushA.value.set(e.pushA.x, e.pushA.z, e.pushA.radius, e.pushA.strength);
    // Caméra basse (par rapport au sol sous elle) : elle écarte l'herbe devant l'objectif ;
    // haute, elle n'écarte rien.
    const cam = camera.position;
    e.pushB.x = cam.x; e.pushB.z = cam.z;
    e.pushB.strength = 1.2 * (1 - smooth(0.9, 1.8, cam.y - groundAt(cam.x, cam.z)));
    u.uPushB.value.set(e.pushB.x, e.pushB.z, e.pushB.radius, e.pushB.strength);
    u.uCenter.value.set(center.x, center.z);
    // Couloir de vue caméra → chat, effacé quand la caméra regarde de haut (> ~50°).
    u.uCorridor.value.set(cam.x, cam.z, catPos.x, catPos.z);
    const dist = Math.max(cam.distanceTo(catPos), 1e-3);
    u.uCorridorOn.value = 1 - smooth(0.6, 0.85, (cam.y - catPos.y) / dist);
  }

  /** Niveau de qualité 0 (plein) à 3 (le plus bas) : voir `QUALITY_DENSITY`. Sans recompilation. */
  setQuality(level) {
    this.quality = Math.min(Math.max(Math.round(level), 0), QUALITY_DENSITY.length - 1);
    this.grass.setDensity(QUALITY_DENSITY[this.quality]);
  }

  /** Réglage libre de la densité d'herbe (0,05 à 1). */
  setDensity(fraction) { this.grass.setDensity(fraction); }

  /** Vent : direction (x, z) normalisée et force (déplacement du sommet par mètre de hauteur). */
  setWind(x, z, strength = this.uniforms.uWindStrength.value) {
    const L = Math.hypot(x, z) || 1;
    this.uniforms.uWindDir.value.set(x / L, z / L);
    this.uniforms.uWindStrength.value = strength;
  }

  /**
   * Fleurs : tableau stable de { index, species, x, z, ground, height, headY, top (Vector3 au
   * repos, sol compris), yaw, hidden }.
   */
  get flowerList() { return this.flowers.list; }

  /** Centre de la corolle de la fleur `i` maintenant (sol, vent et écartement compris). */
  flowerTop(i, out = new THREE.Vector3()) { return this.flowers.top(i, this.time, this.env, out); }

  /** Fleur visible la plus proche de (x, z) dans `maxDist` (m), ou null. `exclude` : Set d'index à ignorer. */
  nearestFlower(x, z, maxDist = Infinity, exclude = null) {
    let best = null, bd = maxDist;
    for (const f of this.flowers.list) {
      if (f.hidden || exclude?.has(f.index)) continue;
      const d = Math.hypot(f.x - x, f.z - z);
      if (d < bd) { bd = d; best = f; }
    }
    return best;
  }

  /**
   * Hauteur ABSOLUE (m) du sommet moyen de l'herbe en (x, z) : sol (Terrain.js `heightAt`) +
   * hauteur des brins fins (`grassHeightAt`), avant couchage par le chat.
   */
  heightAt(x, z) { return groundAt(x, z) + this.grassHeightAt(x, z); }

  /** Hauteur moyenne des brins fins AU-DESSUS du sol en (x, z) (m) : 0 dans un mur. */
  grassHeightAt(x, z) { return grassHeight(x, z, this.wallDistance(x, z)); }

  /**
   * Déplacement horizontal du sommet d'un brin en (x, z) par mètre de hauteur (vent + chat +
   * caméra, sans la courbure propre du brin). Le sommet d'un brin de hauteur h est à ≈ (x, z) + h × résultat.
   */
  bendAt(x, z, out = { x: 0, z: 0 }) {
    const w = windAt(x, z, this.time, this.env.windDir, this.env.windStrength, _a);
    const a = pushFrom(x, z, this.env.pushA, _b);
    const b = pushFrom(x, z, this.env.pushB, _c);
    out.x = w.x + a.x + b.x; out.z = w.z + a.z + b.z;
    return out;
  }

  /** Chiffres de coût : bouquets dessinés, bouquets au total, triangles d'herbe et de fleurs, fleurs. */
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

const _a = { x: 0, z: 0 }, _b = { x: 0, z: 0 }, _c = { x: 0, z: 0 };
