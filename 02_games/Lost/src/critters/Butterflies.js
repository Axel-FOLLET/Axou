import * as THREE from 'three';
import { Butterfly, ButterflyAssets, SPECIES } from './Butterfly.js';
import { heightAt as groundAt } from '../world/Terrain.js';
import { MEADOW_LIMIT } from '../world/field.js';

/** Générateur pseudo-aléatoire reproductible (mulberry32), valeurs dans [0, 1). */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const _h = new THREE.Vector3();
const hdist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

/**
 * Essaim de papillons, indépendant du chat et de la prairie.
 *
 * Entrées : la scène, les sommets des corolles (tableau de `THREE.Vector3`, gardé **par
 * référence** : si la prairie déplace ces vecteurs, un papillon posé suit sa fleur), puis à chaque
 * image `update(dt, positionDuChat, { pouncing })`.
 *
 * Pour la chasse (agent D) : `nearestPerched`, `pick(raycaster)` / `pickables`, `target`,
 * `untarget`, `pounce` (résultat 'caught' ou 'missed' ; dans les deux cas le papillon repart sans
 * mal), `startle(point, rayon)` ; évènements par `onEvent(type, papillon)`.
 */
export class Butterflies {
  /**
   * @param {THREE.Object3D} scene
   * @param {THREE.Vector3[]} flowers  sommets des corolles (m, repère monde)
   * @param {object} [options]
   * @param {number} [options.count=6]            nombre de papillons
   * @param {number} [options.seed]               graine du hasard (essais reproductibles)
   * @param {number} [options.startleRadius=1.0]  m, rayon d'envol quand le chat bondit
   * @param {number} [options.walkFleeRadius=0.3] m, un papillon posé non visé s'envole si le chat passe à moins de ça
   * @param {[number, number]} [options.rest=[8, 16]] s, temps passé loin après une fuite avant de revenir
   * @param {number} [options.flowerMaxDist=8]    m, préférence pour les fleurs à moins de ça du chat
   * @param {{center: THREE.Vector3, radius: number}} [options.bounds] enceinte de vol (sinon déduite des fleurs)
   */
  constructor(scene, flowers = [], options = {}) {
    this.scene = scene;
    this.count = options.count ?? 6;
    this.rng = mulberry32(options.seed ?? (Math.random() * 2 ** 32));
    this.startleRadius = options.startleRadius ?? 1.0;
    this.walkFleeRadius = options.walkFleeRadius ?? 0.3;
    this.rest = options.rest ?? [8, 16];
    this.flowerMaxDist = options.flowerMaxDist ?? 8;
    this._fixedBounds = options.bounds ?? null;
    this.assets = new ButterflyAssets();
    /** @type {Butterfly[]} */
    this.list = [];
    /** Sphères de clic invisibles (une par papillon), `userData.butterfly` = le papillon. */
    this.pickables = [];
    /** Rappel facultatif : (type, papillon), type ∈ takeoff, land, flee, caught, missed, escape, return. */
    this.onEvent = null;
    this._taken = new Map();     // Vector3 de fleur → papillon qui l'a réservée
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

  /** Remplace la liste des fleurs (par référence). Les papillons posés sur une fleur disparue redécollent. */
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
    // Enceinte rabattue dans la prairie (mission catgame_monde) : centre + rayon ≤ MEADOW_LIMIT − 1.
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
   * À appeler à chaque image.
   * @param {number} dt  secondes
   * @param {THREE.Vector3} catPos  position du chat au sol
   * @param {{pouncing?: boolean}} [opts]  `pouncing` : bond en cours (les papillons non visés à moins de `startleRadius` s'envolent)
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
   * Effraie les papillons à moins de `radius` (distance horizontale) de `point` : posés ou en vol,
   * ils fuient. Le papillon visé (`target`) est épargné sauf `includeTargeted`. Renvoie le nombre d'envols.
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

  /** Papillons posés. */
  perched() { return this.list.filter((b) => b.state === 'perched'); }

  /** Papillon posé le plus proche de `point` (distance horizontale ≤ `maxDist`), ou null. */
  nearestPerched(point, maxDist = Infinity) {
    let best = null, bestD = maxDist;
    for (const b of this.list) {
      if (b.state !== 'perched') continue;
      const d = hdist(b.position, point);
      if (d <= bestD) { best = b; bestD = d; }
    }
    return best;
  }

  /** Papillon touché par un rayon (`THREE.Raycaster` déjà réglé), ou null. N'importe quel état. */
  pick(raycaster) {
    const hit = raycaster.intersectObjects(this.pickables, false)[0];
    return hit ? hit.object.userData.butterfly : null;
  }

  /** Marque `b` comme visé (seul visé de l'essaim) : il reste posé et ignore l'approche du chat. */
  target(b) {
    for (const o of this.list) o.targeted = false;
    if (b && b.state === 'perched') { b.targeted = true; return true; }
    return false;
  }

  /** Plus aucun papillon visé (chasse abandonnée). */
  untarget() { for (const b of this.list) b.targeted = false; }

  /**
   * Résout le bond du chat sur `b`, à appeler à la réception (la patte touche `pawPoint`).
   * Attrapé si `b` est encore posé, à moins de `reach` (distance horizontale) de la patte, et si
   * le tirage passe sous `catchChance`. Attrapé : immobile `holdSecs` puis s'échappe sans mal ;
   * raté : s'envole aussitôt. Les autres papillons à moins de `startleRadius` s'envolent aussi.
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

  /** Réserve une fleur libre pour `b` (autre que `exclude`), de préférence près de lui et pas sous le chat. */
  _reserveFlower(b, exclude) {
    // Fleurs hors de la prairie (au-delà de MEADOW_LIMIT − 0,5 m) : jamais choisies.
    const free = this.flowers.filter((f) => f !== exclude && !this._taken.has(f) && Math.hypot(f.x, f.z) <= MEADOW_LIMIT - 0.5);
    if (!free.length) return null;
    const cat = this._cat;
    let pool = free.filter((f) => { const d = hdist(f, cat); return d >= 1.2 && d <= this.flowerMaxDist; });
    if (!pool.length) pool = free;
    // Trois tirages, on garde le plus proche du papillon (trajets plausibles, pas toujours le même).
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

  /** Retire les papillons de la scène et libère géométries et matériaux. */
  dispose() {
    for (const b of this.list) b.remove();
    this.list = []; this.pickables = []; this._taken.clear();
    this.assets.dispose();
  }
}

export { Butterfly, SPECIES };
