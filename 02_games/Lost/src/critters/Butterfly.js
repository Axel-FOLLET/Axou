import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { BUTTERFLIES, toonMaterial, color, mix } from '../style/palette.js';
import { heightAt as groundAt } from '../world/Terrain.js';
import { MEADOW_LIMIT } from '../world/field.js';
import { keepInsideRampart } from '../world/Rampart.js';

/**
 * One butterfly: mesh (body, two wings, antennae, invisible click sphere) and state machine. It knows
 * neither the cat nor the meadow: the swarm (Butterflies.js) creates it and gives it free flowers and
 * the cat position. Local frame: head toward +Z, up toward +Y. Wingspan ≈ 12 cm × `size`.
 *
 * States (`state`):
 * - `perched`: on a flower, wings folded upright, opening slowly now and then;
 * - `flying`: erratic flight (`wanderLeft` seconds), then to its reserved flower, where it lands;
 * - `fleeing`: fast zigzag away from the alert point, upward;
 * - `away`: wanders far off for a rest period, then returns to a flower (`flying`);
 * - `caught`: held under the paw for a moment, then escapes (`fleeing`), unharmed.
 */

/** Species. Each name is a key of `BUTTERFLIES` (palette.js), which gives the pastel base and edge colours. */
export const SPECIES = [
  { name: 'monarch', size: 1.0 },
  { name: 'brimstone', size: 0.9 },
  { name: 'blue', size: 0.8 },
  { name: 'pink white', size: 0.95 },
].map((s) => ({ ...s, base: BUTTERFLIES[s.name].base, edge: BUTTERFLIES[s.name].edge }));

const WING_CLOSED = 1.38;     // rad, wings folded back to back (≈ 79° above horizontal)
const FLAP_HZ = [7, 10];      // wing beats per second in flight (drawn per butterfly)
const FLY_SPEED = 0.9;        // m/s, cruising flight
const FLEE_SPEED = 2.4;       // m/s, fleeing
// Flight heights are measured above the terrain ground (Terrain.js).
const MIN_FLY_Y = 0.15;       // m, minimum flight height (except when approaching a flower)
const MAX_FLY_Y = 2.6;        // m
const FLY_LIMIT = MEADOW_LIMIT - 0.5; // m, radius the butterfly never exceeds (meadow)
export const WALL_CLEARANCE = 2.5; // m from the rampart axis: more than the widest tower (gate tower, 2.3 m), so no flight through stone
const PERCH_OFFSET = 0.012;   // m, body above the top of the corolla

// Wing outlines (x toward the butterfly's left, z forward), metres at `size` 1. Each outline is star-shaped
// around the attachment (0, 0): the wing is a fan cut into rings, giving inner vertices for the colour
// gradient (base to edge). Rounded shapes: forewing as a round lobe, hindwing as a round drop.
const FORE = [[0.004, 0.006], [0.016, 0.028], [0.036, 0.040], [0.054, 0.038], [0.064, 0.024], [0.060, 0.008], [0.046, -0.002], [0.026, -0.006], [0.006, -0.004]];
const HIND = [[0.020, -0.004], [0.040, -0.012], [0.050, -0.028], [0.044, -0.046], [0.028, -0.056], [0.012, -0.050], [0.004, -0.034]];
const RINGS = 4;

function sampleOutline(points, n) {
  const curve = new THREE.CatmullRomCurve3(points.map(([x, z]) => new THREE.Vector3(x, 0, z)));
  return curve.getPoints(n);
}

/** Small balls at the antenna tips (one geometry for both). */
function mergeKnobs(points, r) {
  const parts = points.map(([x, y, z]) => new THREE.SphereGeometry(r, 6, 4).translate(x, y, z));
  const g = mergeGeometries(parts);
  parts.forEach((p) => p.dispose());
  return g;
}

/** Left wing geometry (forewing + hindwing) with vertex colours. */
function wingGeometry(species) {
  const base = color(species.base);
  const edge = color(species.edge);
  const root = mix(species.base, 0xffffff, 0.2); // softly lightened wing root
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

/** Resources shared per species (geometries and materials created once). */
export class ButterflyAssets {
  constructor() {
    // Plump body, slightly oversized round head (cute proportions), antennae with round tips.
    this.body = new THREE.CapsuleGeometry(0.0058, 0.026, 3, 8).rotateX(Math.PI / 2).translate(0, 0, -0.004);
    this.head = new THREE.SphereGeometry(0.0072, 10, 8).translate(0, 0, 0.018);
    this.antennae = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0.002, 0.003, 0.022), new THREE.Vector3(0.012, 0.014, 0.042),
      new THREE.Vector3(-0.002, 0.003, 0.022), new THREE.Vector3(-0.012, 0.014, 0.042),
    ]);
    this.knobs = mergeKnobs([[0.012, 0.014, 0.042], [-0.012, 0.014, 0.042]], 0.0028);
    this.bodyMat = toonMaterial(BUTTERFLIES.body, { steps: 2 });
    this.antennaMat = new THREE.LineBasicMaterial({ color: BUTTERFLIES.antenna });
    // Click sphere: invisible (`visible: false`) but still hit by the Raycaster
    // (Mesh.raycast of three 0.186 does not test material visibility).
    this.hit = new THREE.SphereGeometry(0.08, 8, 6);
    this.hitMat = new THREE.MeshBasicMaterial({ visible: false });
    this.wings = SPECIES.map((s) => ({
      geometry: wingGeometry(s),
      // Flat two-step toon shading; a faint glow keeps the wings readable on the grass.
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
const _wall = new THREE.Vector3();
const _wallN = new THREE.Vector3();

export class Butterfly {
  /**
   * @param {ButterflyAssets} assets
   * @param {number} speciesIndex  index in SPECIES
   * @param {() => number} rng     generator in [0, 1)
   * @param {number} id
   */
  constructor(assets, speciesIndex, rng, id) {
    this.id = id;
    this.species = SPECIES[speciesIndex];
    this.rng = rng;
    this.rest = null;   // s away after fleeing, given by flee() and catchAt()

    this.group = new THREE.Group();          // logical position and heading
    this.group.name = `Butterfly_${id}`;
    this.tilt = new THREE.Group();           // pitch and visual flight bob
    this.group.add(this.tilt);
    const body = new THREE.Mesh(assets.body, assets.bodyMat);
    const head = new THREE.Mesh(assets.head, assets.bodyMat);
    const ant = new THREE.LineSegments(assets.antennae, assets.antennaMat);
    const knobs = new THREE.Mesh(assets.knobs, assets.bodyMat);
    const w = assets.wings[speciesIndex];
    this.wingL = new THREE.Mesh(w.geometry, w.material);
    this.wingR = new THREE.Mesh(w.geometry, w.material);
    this.wingR.scale.x = -1;                 // mirror of the left wing
    this.wingL.castShadow = this.wingR.castShadow = true;
    this.tilt.add(body, head, ant, knobs, this.wingL, this.wingR);

    /** Click sphere (8 cm radius): `userData.butterfly` returns this butterfly. */
    this.hitMesh = new THREE.Mesh(assets.hit, assets.hitMat);
    this.hitMesh.userData.butterfly = this;
    this.hitMesh.name = `ButterflyHit_${id}`;
    this.group.add(this.hitMesh);

    this.state = 'flying';
    this.timer = 0;            // s left in the state (perched, fleeing, away, caught)
    this.wanderLeft = 0;       // s of wandering left before heading to its flower (flying)
    this.flower = null;        // reserved Vector3 (reference given by the swarm) or null
    this.goal = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.targeted = false;     // targeted by the cat (stalked): stays perched, not scared by the approaching cat
    this.yaw = rng() * Math.PI * 2;
    this.phase = rng() * Math.PI * 2;
    this.freq = FLAP_HZ[0] + rng() * (FLAP_HZ[1] - FLAP_HZ[0]);
    this.wing = WING_CLOSED;
    this.glide = 0;            // s of gliding left (wings open, still)
    this.bask = rng() * 5;     // clock of the slow wing opening once perched
    this.noise = [rng() * 100, rng() * 100, rng() * 100];
    this.t = 0;
  }

  get position() { return this.group.position; }

  /** Perches immediately on a flower (initial placement). */
  perchAt(flower, duration) {
    this.flower = flower;
    this.state = 'perched';
    this.timer = duration;
    this.group.position.copy(flower).y += PERCH_OFFSET;
    this.vel.set(0, 0, 0);
    this.wing = WING_CLOSED;
  }

  /** Takes off and wanders `wander` seconds before reaching `flower` (null: wandering only). */
  takeOff(flower, wander) {
    this.state = 'flying';
    this.flower = flower;
    this.wanderLeft = wander;
    this.targeted = false;
    this.vel.set(0, 0.6, 0);
    this._pickWanderGoal();
  }

  /** Flees away from `from` (alert, missed pounce, escape). `rest`: seconds away before returning. */
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

  /** Caught: stays under the paw for `secs` seconds, then escapes. */
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

  /** Moves toward `goal` at `speed` with lateral and vertical noise (`erratic` 0..1). Returns the distance to the goal. */
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
      // Vertical flutter on each beat (the body rises when the wings go down).
      this.tilt.position.y = -0.012 * Math.sin(this.phase);
    } else {
      // Perched: wings folded, slow opening on a 4.5 s cycle (basking in the sun).
      this.bask += dt;
      const cycle = 4.5, u = (this.bask % cycle) / cycle;
      const open = u < 0.35 ? Math.sin((u / 0.35) * Math.PI) : 0;
      let target = WING_CLOSED - (WING_CLOSED - 0.3) * open;
      if (this.targeted) target -= 0.15 * Math.max(0, Math.sin(this.t * 11)); // targeted: small shivers
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
   * Advances one step. `ctx`: { cat: Vector3 (cat's ground position), swarm (reserves flowers and emits
   * events), bounds: { center: Vector3, radius } }.
   */
  update(dt, ctx) {
    this.t += dt;
    const p = this.group.position;
    switch (this.state) {
      case 'perched': {
        if (this.flower) p.copy(this.flower).y += PERCH_OFFSET; // follows the flower if it moves
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
        this.wing += (0.1 - this.wing) * (1 - Math.exp(-10 * dt)); // flattened under the paw
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
          this.vel.multiplyScalar(0); // no vertical hop on return
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
    // Flight constraints: height, enclosure, and going around the cat's body.
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
    // Hard meadow limit (MEADOW_LIMIT): brought back to the edge, outward speed cancelled.
    const rr = Math.hypot(p.x, p.z);
    if (rr > FLY_LIMIT) {
      const nx = p.x / rr, nz = p.z / rr;
      p.x = nx * FLY_LIMIT; p.z = nz * FLY_LIMIT;
      const vn = this.vel.x * nx + this.vel.z * nz;
      if (vn > 0) { this.vel.x -= vn * nx; this.vel.z -= vn * nz; }
      if (Math.hypot(this.goal.x, this.goal.z) > FLY_LIMIT - 1) this.goal.set(nx * (FLY_LIMIT - 3), this.goal.y, nz * (FLY_LIMIT - 3));
    }
    // Rampart: same treatment as the disc limit; the far side does not exist for a butterfly.
    if (keepInsideRampart(p, WALL_CLEARANCE, _wallN)) {
      const vn = this.vel.x * _wallN.x + this.vel.z * _wallN.z;
      if (vn > 0) { this.vel.x -= vn * _wallN.x; this.vel.z -= vn * _wallN.z; }
      if (keepInsideRampart(_wall.copy(this.goal), WALL_CLEARANCE)) this.goal.set(p.x - _wallN.x * 3, this.goal.y, p.z - _wallN.z * 3);
    }
    if (ctx.cat) {
      _d.copy(p).sub(ctx.cat); _d.y = 0;
      const hd = _d.length();
      // Flies over the cat (height measured from the cat's root: ground or low wall).
      if (hd < 0.45 && p.y - (ctx.cat.y ?? 0) < 0.75 && !landing) this.vel.y += 3 * dt;
    }
    this._flap(dt, true);
    this._orient(dt);
  }

  /** Removes the butterfly from the scene. */
  remove() { this.group.removeFromParent(); }
}
