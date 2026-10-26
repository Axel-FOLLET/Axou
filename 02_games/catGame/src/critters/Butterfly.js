import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { BUTTERFLIES, toonMaterial, color, mix } from '../style/palette.js';
import { heightAt as groundAt } from '../world/Terrain.js';
import { MEADOW_LIMIT } from '../world/field.js';

/**
 * Un papillon : maillage (corps, deux ailes, antennes, sphère de clic invisible) et machine à
 * états. Il ne connaît ni le chat ni la prairie : l'essaim (`Butterflies.js`) lui donne les
 * fleurs libres et la position du chat.
 *
 * Repère local : museau du papillon vers +Z, haut vers +Y (même convention que le chat).
 * Échelle : envergure ≈ 12 cm × `size` (un monarque réel fait ≈ 10 cm ; un peu plus grand pour
 * se lire à côté du chat de 0,8 m).
 *
 * États (`state`) :
 * - `perched` : posé sur une fleur, ailes repliées à la verticale, ouverture lente de temps en temps ;
 * - `flying`  : vol erratique (errance `wanderLeft` secondes, puis vers sa fleur réservée et pose) ;
 * - `fleeing` : fuite rapide en zigzag, loin du point d'alerte, vers le haut ;
 * - `away`    : erre loin pendant un temps de repos, puis revient vers une fleur (`flying`) ;
 * - `caught`  : « attrapé » sous la patte, immobile un instant, puis s'échappe (`fleeing`) sans mal.
 */

/**
 * Espèces. Couleurs pastel de `BUTTERFLIES` (src/style/palette.js, mission catgame_style) : plus de
 * bord noir, bords adoucis de la même famille de teinte que la base.
 */
export const SPECIES = [
  { name: 'monarque', size: 1.0 },
  { name: 'citron', size: 0.9 },
  { name: 'azuré', size: 0.8 },
  { name: 'piéride rose', size: 0.95 },
].map((s) => ({ ...s, base: BUTTERFLIES[s.name].base, edge: BUTTERFLIES[s.name].edge }));

const WING_CLOSED = 1.38;     // rad, ailes repliées dos à dos (≈ 79° au-dessus de l'horizontale)
const FLAP_HZ = [7, 10];      // battements par seconde en vol (tiré par papillon)
const FLY_SPEED = 0.9;        // m/s, vol de croisière
const FLEE_SPEED = 2.4;       // m/s, fuite
// Hauteurs de vol mesurées au-dessus du sol du terrain (src/world/Terrain.js, mission catgame_monde).
const MIN_FLY_Y = 0.15;       // m, hauteur minimale en vol (hors approche d'une fleur)
const MAX_FLY_Y = 2.6;        // m
const FLY_LIMIT = MEADOW_LIMIT - 0.5; // m, rayon que le papillon ne dépasse jamais (prairie)
const PERCH_OFFSET = 0.012;   // m, le corps au-dessus du sommet de la corolle

// Contours (x vers la gauche du papillon, z vers l'avant), en mètres pour `size` 1. Chaque
// contour est « en étoile » depuis l'attache (0, 0) : l'aile est un éventail découpé en anneaux,
// ce qui donne des sommets intérieurs pour le dégradé de couleur (base → bord).
// Contours arrondis (style « dessin animé doux ») : aile antérieure en lobe rond, sans pointe ;
// aile postérieure en goutte ronde.
const FORE = [[0.004, 0.006], [0.016, 0.028], [0.036, 0.040], [0.054, 0.038], [0.064, 0.024], [0.060, 0.008], [0.046, -0.002], [0.026, -0.006], [0.006, -0.004]];
const HIND = [[0.020, -0.004], [0.040, -0.012], [0.050, -0.028], [0.044, -0.046], [0.028, -0.056], [0.012, -0.050], [0.004, -0.034]];
const RINGS = 4;

function sampleOutline(points, n) {
  const curve = new THREE.CatmullRomCurve3(points.map(([x, z]) => new THREE.Vector3(x, 0, z)));
  return curve.getPoints(n);
}

/** Petites boules au bout des antennes (une géométrie pour les deux). */
function mergeKnobs(points, r) {
  const parts = points.map(([x, y, z]) => new THREE.SphereGeometry(r, 6, 4).translate(x, y, z));
  const g = mergeGeometries(parts);
  parts.forEach((p) => p.dispose());
  return g;
}

/** Géométrie de l'aile gauche (aile antérieure + postérieure), couleurs par sommet. */
function wingGeometry(species) {
  const base = color(species.base);
  const edge = color(species.edge);
  const root = mix(species.base, 0xffffff, 0.2); // racine éclaircie (douce), plus assombrie
  const pos = [], col = [], idx = [];
  const c = new THREE.Color();
  const addFan = (outline, y, shade) => {
    const start = pos.length / 3;
    for (let k = 0; k <= RINGS; k++) {
      const f = k / RINGS;
      for (const p of outline) {
        pos.push(p.x * f * species.size, y, p.z * f * species.size);
        c.copy(base).multiplyScalar(shade);
        if (f < 0.3) c.lerp(root, 1 - f / 0.3);
        if (f > 0.72) c.lerp(edge, Math.min(1, (f - 0.72) / 0.28));
        col.push(c.r, c.g, c.b);
      }
    }
    const m = outline.length;
    for (let k = 0; k < RINGS; k++) {
      for (let i = 0; i < m - 1; i++) {
        const a = start + k * m + i, b = a + 1, d = a + m, e = d + 1;
        if (k > 0) idx.push(a, d, b);
        idx.push(b, d, e);
      }
    }
  };
  addFan(sampleOutline(FORE, 16), 0, 1);
  addFan(sampleOutline(HIND, 12), -0.0006, 0.9);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Ressources partagées par espèce (géométries et matériaux créés une fois). */
export class ButterflyAssets {
  constructor() {
    // Corps dodu et tête ronde un peu grosse (proportions « mignonnes »), antennes à bout rond.
    this.body = new THREE.CapsuleGeometry(0.0058, 0.026, 3, 8).rotateX(Math.PI / 2).translate(0, 0, -0.004);
    this.head = new THREE.SphereGeometry(0.0072, 10, 8).translate(0, 0, 0.018);
    this.antennae = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0.002, 0.003, 0.022), new THREE.Vector3(0.012, 0.014, 0.042),
      new THREE.Vector3(-0.002, 0.003, 0.022), new THREE.Vector3(-0.012, 0.014, 0.042),
    ]);
    this.knobs = mergeKnobs([[0.012, 0.014, 0.042], [-0.012, 0.014, 0.042]], 0.0028);
    this.bodyMat = toonMaterial(BUTTERFLIES.body, { steps: 2 });
    this.antennaMat = new THREE.LineBasicMaterial({ color: BUTTERFLIES.antenna });
    // Sphère de clic : invisible au rendu (`visible: false`) mais touchée par le Raycaster
    // (Mesh.raycast de three 0.186 ne teste pas la visibilité du matériau).
    this.hit = new THREE.SphereGeometry(0.08, 8, 6);
    this.hitMat = new THREE.MeshBasicMaterial({ visible: false });
    this.wings = SPECIES.map((s) => ({
      geometry: wingGeometry(s),
      // Aplats à 2 paliers (style.md § 5 et § 7) ; léger éclat pour rester lisibles sur l'herbe.
      material: toonMaterial(0xffffff, {
        vertexColors: true, side: THREE.DoubleSide, steps: 2,
        emissive: s.base, emissiveIntensity: 0.15,
      }),
    }));
  }

  dispose() {
    [this.body, this.head, this.antennae, this.knobs, this.hit].forEach((g) => g.dispose());
    [this.bodyMat, this.antennaMat, this.hitMat].forEach((m) => m.dispose());
    this.wings.forEach((w) => { w.geometry.dispose(); w.material.dispose(); });
  }
}

const _v = new THREE.Vector3();
const _d = new THREE.Vector3();

export class Butterfly {
  /**
   * @param {ButterflyAssets} assets
   * @param {number} speciesIndex  indice dans SPECIES
   * @param {() => number} rng     générateur [0, 1)
   * @param {number} id
   */
  constructor(assets, speciesIndex, rng, id) {
    this.id = id;
    this.species = SPECIES[speciesIndex];
    this.rng = rng;

    this.group = new THREE.Group();          // position logique et cap
    this.group.name = `Butterfly_${id}`;
    this.tilt = new THREE.Group();           // tangage, roulis et sautillement visuel du vol
    this.group.add(this.tilt);
    const body = new THREE.Mesh(assets.body, assets.bodyMat);
    const head = new THREE.Mesh(assets.head, assets.bodyMat);
    const ant = new THREE.LineSegments(assets.antennae, assets.antennaMat);
    const knobs = new THREE.Mesh(assets.knobs, assets.bodyMat);
    const w = assets.wings[speciesIndex];
    this.wingL = new THREE.Mesh(w.geometry, w.material);
    this.wingR = new THREE.Mesh(w.geometry, w.material);
    this.wingR.scale.x = -1;                 // miroir de l'aile gauche
    this.wingL.castShadow = this.wingR.castShadow = true;
    this.tilt.add(body, head, ant, knobs, this.wingL, this.wingR);

    /** Sphère de clic (rayon 8 cm) : `userData.butterfly` renvoie ce papillon. */
    this.hitMesh = new THREE.Mesh(assets.hit, assets.hitMat);
    this.hitMesh.userData.butterfly = this;
    this.hitMesh.name = `ButterflyHit_${id}`;
    this.group.add(this.hitMesh);

    this.state = 'flying';
    this.timer = 0;            // durée restante de l'état (perched, fleeing, away, caught)
    this.wanderLeft = 0;       // errance restante avant de rejoindre sa fleur (flying)
    this.flower = null;        // Vector3 réservé (référence fournie par l'essaim) ou null
    this.goal = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.targeted = false;     // visé par le chat (affût) : reste posé, ne s'effraie pas du chat qui approche
    this.yaw = rng() * Math.PI * 2;
    this.phase = rng() * Math.PI * 2;
    this.freq = FLAP_HZ[0] + rng() * (FLAP_HZ[1] - FLAP_HZ[0]);
    this.wing = WING_CLOSED;
    this.glide = 0;            // secondes restantes de plané (ailes ouvertes, fixes)
    this.bask = rng() * 5;     // horloge de l'ouverture lente des ailes une fois posé
    this.noise = [rng() * 100, rng() * 100, rng() * 100];
    this.t = 0;
  }

  get position() { return this.group.position; }
  get isPerched() { return this.state === 'perched'; }
  /** Posé et pas en fuite : une proie possible pour la chasse. */
  get huntable() { return this.state === 'perched'; }

  /** Pose immédiate sur une fleur (placement initial). */
  perchAt(flower, duration) {
    this.flower = flower;
    this.state = 'perched';
    this.timer = duration;
    this.group.position.copy(flower).y += PERCH_OFFSET;
    this.vel.set(0, 0, 0);
    this.wing = WING_CLOSED;
  }

  /** Décolle et erre `wander` secondes avant de rejoindre `flower` (null : errance seule). */
  takeOff(flower, wander) {
    this.state = 'flying';
    this.flower = flower;
    this.wanderLeft = wander;
    this.targeted = false;
    this.vel.set(0, 0.6, 0);
    this._pickWanderGoal();
  }

  /** Fuite loin de `from` (alerte, bond raté, échappée). `rest` : secondes loin avant de revenir. */
  flee(from, rest) {
    this.state = 'fleeing';
    this.flower = null;
    this.targeted = false;
    this.timer = 1.2 + this.rng() * 0.8;
    this.rest = rest;
    _d.copy(this.group.position).sub(from).setY(0);
    if (_d.lengthSq() < 1e-6) _d.set(this.rng() - 0.5, 0, this.rng() - 0.5);
    _d.normalize();
    this.goal.copy(this.group.position).addScaledVector(_d, 6);
    this.goal.y = groundAt(this.goal.x, this.goal.z) + 1.6 + this.rng() * 1.0;
    this.vel.copy(_d).multiplyScalar(FLEE_SPEED * 0.6).setY(1.4);
  }

  /** « Attrapé » : reste sous la patte `secs` secondes puis s'échappe. */
  catchAt(point, secs, rest) {
    this.state = 'caught';
    this.flower = null;
    this.targeted = false;
    this.timer = secs;
    this.rest = rest;
    this._escapeFrom = point.clone();
    this.vel.set(0, 0, 0);
  }

  _pickWanderGoal(center = this.group.position, radius = 1.6) {
    const a = this.rng() * Math.PI * 2, r = radius * (0.4 + 0.6 * this.rng());
    const x = center.x + Math.cos(a) * r, z = center.z + Math.sin(a) * r;
    this.goal.set(x, groundAt(x, z) + 0.35 + this.rng() * 1.2, z);
  }

  /** Avance vers `goal` à `speed`, avec un bruit latéral et vertical (`erratic` 0..1). */
  _steer(dt, speed, erratic, arrive) {
    const p = this.group.position;
    _d.copy(this.goal).sub(p);
    const dist = _d.length();
    const s = arrive ? speed * Math.min(1, dist / arrive) : speed;
    if (dist > 1e-5) _d.multiplyScalar(s / dist);
    const t = this.t, [a, b, c] = this.noise;
    const amp = erratic * speed * (arrive ? Math.min(1, dist / 0.4) : 1);
    _v.set(
      Math.sin(t * 2.3 + a) + 0.6 * Math.sin(t * 5.1 + b),
      0.8 * Math.sin(t * 3.7 + c) + 0.5 * Math.sin(t * 7.3 + a),
      Math.sin(t * 2.9 + b) + 0.6 * Math.sin(t * 4.7 + c),
    ).multiplyScalar(amp);
    _d.add(_v);
    this.vel.lerp(_d, 1 - Math.exp(-4 * dt));
    p.addScaledVector(this.vel, dt);
    return dist;
  }

  _flap(dt, airborne) {
    if (airborne) {
      if (this.glide > 0) {
        this.glide -= dt;
        this.wing += (0.15 - this.wing) * (1 - Math.exp(-12 * dt));
      } else {
        this.phase += Math.PI * 2 * this.freq * dt;
        this.wing = 0.35 + 0.85 * Math.sin(this.phase);
        if (this.rng() < dt * 0.25) this.glide = 0.2 + this.rng() * 0.3;
      }
      // Sautillement vertical à chaque battement (corps qui monte quand les ailes descendent).
      this.tilt.position.y = -0.012 * Math.sin(this.phase);
    } else {
      // Posé : ailes repliées, ouverture lente toutes les 3 à 6 s (se chauffer au soleil).
      this.bask += dt;
      const cycle = 4.5, u = (this.bask % cycle) / cycle;
      const open = u < 0.35 ? Math.sin((u / 0.35) * Math.PI) : 0;
      let target = WING_CLOSED - (WING_CLOSED - 0.3) * open;
      if (this.targeted) target -= 0.15 * Math.max(0, Math.sin(this.t * 11)); // visé : petits frissons
      this.wing += (target - this.wing) * (1 - Math.exp(-10 * dt));
      this.tilt.position.y += (0 - this.tilt.position.y) * (1 - Math.exp(-10 * dt));
    }
    this.wingL.rotation.z = this.wing;
    this.wingR.rotation.z = -this.wing;
  }

  _orient(dt) {
    const v = this.vel;
    const h = Math.hypot(v.x, v.z);
    if (h > 0.05) {
      const want = Math.atan2(v.x, v.z);
      let d = want - this.yaw;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      this.yaw += d * (1 - Math.exp(-6 * dt));
    }
    this.group.rotation.y = this.yaw;
    const pitch = THREE.MathUtils.clamp(-Math.atan2(v.y, Math.max(h, 0.2)), -0.7, 0.7);
    this.tilt.rotation.x += (pitch - this.tilt.rotation.x) * (1 - Math.exp(-6 * dt));
  }

  /**
   * Avance d'un pas. `ctx` : { cat: Vector3 (position du chat au sol), swarm (pour réserver une
   * fleur et émettre les évènements), bounds: { center: Vector3, radius } }.
   */
  update(dt, ctx) {
    this.t += dt;
    const p = this.group.position;
    switch (this.state) {
      case 'perched': {
        if (this.flower) p.copy(this.flower).y += PERCH_OFFSET; // suit la fleur si elle bouge
        if (!this.targeted) this.timer -= dt;
        this.vel.set(0, 0, 0);
        this.tilt.rotation.x *= Math.exp(-8 * dt);
        if (this.timer <= 0) {
          const old = this.flower;
          ctx.swarm._release(this);
          this.takeOff(ctx.swarm._reserveFlower(this, old), 2 + this.rng() * 5);
          ctx.swarm._emit('takeoff', this);
        }
        this._flap(dt, false);
        return;
      }
      case 'caught': {
        this.timer -= dt;
        this._flap(dt, false);
        this.wing += (0.1 - this.wing) * (1 - Math.exp(-10 * dt)); // aplati sous la patte
        this.wingL.rotation.z = this.wing; this.wingR.rotation.z = -this.wing;
        if (this.timer <= 0) { this.flee(this._escapeFrom ?? ctx.cat, this.rest); ctx.swarm._emit('escape', this); }
        return;
      }
      case 'fleeing': {
        this.timer -= dt;
        this._steer(dt, FLEE_SPEED, 0.8, 0);
        if (this.timer <= 0) {
          this.state = 'away';
          this.timer = this.rest ?? 10;
          this._pickWanderGoal(p, 2.5);
        }
        break;
      }
      case 'away': {
        this.timer -= dt;
        const d = this._steer(dt, FLY_SPEED, 0.6, 0);
        if (d < 0.3) this._pickWanderGoal(p, 2.5);
        if (this.timer <= 0) {
          this.takeOff(ctx.swarm._reserveFlower(this, null), this.rng() * 2);
          this.vel.multiplyScalar(0); // pas de saut vertical au retour
          ctx.swarm._emit('return', this);
        }
        break;
      }
      case 'flying': {
        if (this.wanderLeft > 0 || !this.flower) {
          this.wanderLeft -= dt;
          const d = this._steer(dt, FLY_SPEED, 0.7, 0);
          if (d < 0.25) this._pickWanderGoal(p, 1.6);
          if (this.wanderLeft <= 0 && !this.flower) {
            this.flower = ctx.swarm._reserveFlower(this, null);
            if (!this.flower) this.wanderLeft = 3;
          }
          if (this.wanderLeft <= 0 && this.flower) this.goal.copy(this.flower).y += PERCH_OFFSET;
        } else {
          this.goal.copy(this.flower).y += PERCH_OFFSET;
          const d = this._steer(dt, FLY_SPEED, 0.5, 0.6);
          if (d < 0.03) {
            this.perchAt(this.flower, 4 + this.rng() * 10);
            ctx.swarm._emit('land', this);
          }
        }
        break;
      }
    }
    // Contraintes de vol : hauteur, enceinte, et contournement du corps du chat.
    const landing = this.state === 'flying' && this.flower && this.wanderLeft <= 0;
    const g = groundAt(p.x, p.z);
    if (!landing && p.y < g + MIN_FLY_Y) { p.y = g + MIN_FLY_Y; this.vel.y = Math.abs(this.vel.y); }
    if (p.y > g + MAX_FLY_Y) { p.y = g + MAX_FLY_Y; this.vel.y = -Math.abs(this.vel.y); }
    const b = ctx.bounds;
    _d.copy(p).sub(b.center).setY(0);
    if (_d.length() > b.radius) {
      this.goal.copy(b.center).addScaledVector(_d.normalize(), b.radius * 0.6);
      this.goal.y = Math.max(this.goal.y, groundAt(this.goal.x, this.goal.z) + 0.5);
    }
    // Limite dure de la prairie (MEADOW_LIMIT) : ramené au bord, vitesse sortante annulée.
    const rr = Math.hypot(p.x, p.z);
    if (rr > FLY_LIMIT) {
      const nx = p.x / rr, nz = p.z / rr;
      p.x = nx * FLY_LIMIT; p.z = nz * FLY_LIMIT;
      const vn = this.vel.x * nx + this.vel.z * nz;
      if (vn > 0) { this.vel.x -= vn * nx; this.vel.z -= vn * nz; }
      if (Math.hypot(this.goal.x, this.goal.z) > FLY_LIMIT - 1) this.goal.set(nx * (FLY_LIMIT - 3), this.goal.y, nz * (FLY_LIMIT - 3));
    }
    if (ctx.cat) {
      _d.copy(p).sub(ctx.cat); _d.y = 0;
      const hd = _d.length();
      // Passe par-dessus le chat (hauteur comptée depuis la racine du chat : sol ou muret).
      if (hd < 0.45 && p.y - (ctx.cat.y ?? 0) < 0.75 && !landing) this.vel.y += 3 * dt;
    }
    this._flap(dt, true);
    this._orient(dt);
  }

  /** Retire le papillon de la scène. */
  remove() { this.group.removeFromParent(); }
}
