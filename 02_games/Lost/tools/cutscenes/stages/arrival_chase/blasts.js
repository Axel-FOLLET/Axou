/**
 * Paint blasts of the chase: the shell that falls (or is thrown across the valley by the giant), the swollen blob and
 * the geyser of paint at the impact, the shock ring, the splat left on the snow and the droplets that fly and land.
 * Everything is a pure function of the scene clock (`update(t)`), drawn with three instanced meshes (blobs, splats,
 * droplets) and one ring mesh per blast. Fir trees are handled by `slope.js`, which reads the same plan.
 *
 * Style: flat toon colours of the Chartiste's paints (pink, yellow, orange; violet for the blast that hits Maman), no
 * texture, as the rest of the game.
 */
import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { toonMaterial } from '../../../../src/style/palette.js';
import { rng } from '../../../../src/world/random.js';
import { BLAST, BLASTS, CHARTISTE } from './tuning.js';

const COLUMN = 4;                       // blobs stacked in the geyser column
const BLOBS_PER_BLAST = COLUMN + 1;     // plus one flat crown on top; each blast also owns one slot for its shell
const SEED = 20261114;

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _qy = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _c = new THREE.Color();
const _up = new THREE.Vector3(0, 1, 0);
const _n = new THREE.Vector3();
const HIDDEN = new THREE.Matrix4().makeScale(0, 0, 0);

const lerp = THREE.MathUtils.lerp;
const clamp01 = (x) => Math.min(Math.max(x, 0), 1);

/** Ease with a slight overshoot, 0 to 1: the blob swells past its size and settles. */
function easeOutBack(k) {
  const c1 = 1.9, c3 = c1 + 1;
  return 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2);
}

/**
 * Plan of the blasts: where and when each one lands, from the table and Maman's path.
 * @returns {Array<object>} entries of BLASTS plus `x`, `y`, `z` (impact point on the ground) and `index`
 */
export function planBlasts(path, ground) {
  return BLASTS.map((spec, index) => {
    const p = path.at(spec.t);
    const left = [Math.cos(p.yaw), -Math.sin(p.yaw)], ahead = [Math.sin(p.yaw), Math.cos(p.yaw)];
    const x = p.x + left[0] * spec.at[0] + ahead[0] * spec.at[1];
    const z = p.z + left[1] * spec.at[0] + ahead[1] * spec.at[1];
    return { ...spec, index, x, y: ground.heightAt(x, z), z };
  });
}

/** Lumpy sphere of radius 1, smooth normals: the shape of a blob of paint. */
function blobGeometry() {
  let g = new THREE.IcosahedronGeometry(1, 2);
  g.deleteAttribute('normal');
  g.deleteAttribute('uv');
  g = mergeVertices(g);
  const pos = g.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).normalize();
    const k = 1 + 0.17 * Math.sin(5 * v.x + 1) * Math.sin(4 * v.y + 2) + 0.1 * Math.sin(7 * v.z + 3) * Math.sin(6 * v.x);
    pos.setXYZ(i, v.x * k, v.y * k, v.z * k);
  }
  g.computeVertexNormals();
  return g;
}

/** Flat splat of radius about 1 in the XZ plane (normal +Y): lobes and a few tongues, like paint thrown on snow. */
function splatGeometry() {
  const N = 56, pos = [0, 0, 0], nrm = [0, 1, 0], idx = [];
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    const tongue = Math.pow(Math.max(0, Math.sin(3 * a + 0.5)), 6);
    const r = 1 + 0.16 * Math.sin(5 * a) + 0.1 * Math.sin(9 * a + 1) + 0.3 * tongue;
    pos.push(Math.cos(a) * r, 0, Math.sin(a) * r);
    nrm.push(0, 1, 0);
    idx.push(0, 1 + ((i + 1) % N), 1 + i);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setIndex(idx);
  return g;
}

export class PaintBlasts {
  /**
   * @param {THREE.Object3D} parent
   * @param {object[]} plan result of `planBlasts`
   * @param {{heightAt: Function, normalAt: Function}} ground
   * @param {THREE.Vector3} chartistePos root of the giant (where the thrown shells start from)
   */
  constructor(parent, plan, ground, chartistePos) {
    this.plan = plan;
    this.ground = ground;
    const rand = rng(SEED);
    this.group = new THREE.Group();
    this.group.name = 'PaintBlasts';
    parent.add(this.group);

    const colors = BLAST.colors.map((hex) => new THREE.Color(hex));
    const nBlobs = plan.length * (BLOBS_PER_BLAST + 1);
    this.blobs = new THREE.InstancedMesh(blobGeometry(), toonMaterial(0xffffff), nBlobs);
    this.splats = new THREE.InstancedMesh(
      splatGeometry(),
      toonMaterial(0xffffff, { side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -6 }),
      plan.length);
    const perBlast = BLAST.droplets;
    this.droplets = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 6), toonMaterial(0xffffff), plan.length * perBlast);
    for (const m of [this.blobs, this.splats, this.droplets]) {
      m.frustumCulled = false;
      m.castShadow = false;
      m.receiveShadow = false;
      m.raycast = () => {};
      this.group.add(m);
    }
    this.blobs.name = 'PaintBlobs';
    this.splats.name = 'PaintSplats';
    this.droplets.name = 'PaintDroplets';

    this.rings = plan.map((b) => {
      const g = new THREE.RingGeometry(0.82, 1, 40);
      g.rotateX(-Math.PI / 2);
      const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: colors[4], transparent: true, depthWrite: false, side: THREE.DoubleSide }));
      m.visible = false;
      m.frustumCulled = false;
      m.raycast = () => {};
      m.name = `PaintRing${b.index}`;
      this.group.add(m);
      return m;
    });

    // Per-blast constants: shell start, splat shape, droplets (ballistic path computed once, down to the landing).
    this.items = plan.map((b) => {
      const start = b.from === 'far'
        ? new THREE.Vector3(chartistePos.x + CHARTISTE.brushTip[0], chartistePos.y + CHARTISTE.brushTip[1], chartistePos.z + CHARTISTE.brushTip[2])
        : new THREE.Vector3(b.x, b.y + BLAST.skyHeight, b.z - BLAST.skyOffset);
      const flight = b.from === 'far' ? BLAST.farFlight : BLAST.skyFlight;
      const arc = b.from === 'far' ? BLAST.farArc : 6;
      const drops = [];
      for (let i = 0; i < perBlast; i++) {
        const az = rand() * Math.PI * 2;
        const el = lerp(BLAST.dropletElevation[0], BLAST.dropletElevation[1], rand());
        const speed = lerp(BLAST.dropletSpeed[0], BLAST.dropletSpeed[1], rand()) * (0.7 + 0.12 * b.r);
        const size = lerp(BLAST.dropletSize[0], BLAST.dropletSize[1], rand());
        const v = new THREE.Vector3(Math.cos(az) * Math.cos(el), Math.sin(el), Math.sin(az) * Math.cos(el)).multiplyScalar(speed);
        const o = new THREE.Vector3(b.x, b.y + b.r * 0.5, b.z).addScaledVector(v.clone().setY(0).normalize(), b.r * 0.6);
        // Landing: step the flight until the droplet touches the snow.
        let land = null;
        for (let k = 1; k <= 360; k++) {
          const s = k / 60;
          const x = o.x + v.x * s, y = o.y + v.y * s - 0.5 * BLAST.gravity * s * s, z = o.z + v.z * s;
          const gy = ground.heightAt(x, z);
          if (y <= gy + size * 0.5) { land = { s, x, y: gy + size * 0.2, z }; break; }
        }
        // Snow chips among the paint: a third of the droplets are white.
        drops.push({ o, v, size, land, white: rand() < 0.33, colour: rand() < 0.8 ? b.c : 4 });
      }
      return {
        start, flight, arc,
        splatSpin: rand() * Math.PI * 2,
        splatSize: b.r * (1.25 + rand() * 0.3),
        normal: ground.normalAt(b.x, b.z, new THREE.Vector3()),
        drops,
        phase: rand() * 6.28,
      };
    });
    this.colors = colors;
    this.snowWhite = new THREE.Color(0xf4f2fc);
    // Instance colours are set once: blobs and splats take their blast's colour, droplets their own.
    plan.forEach((b, i) => {
      for (let k = 0; k < BLOBS_PER_BLAST + 1; k++) this.blobs.setColorAt(i * (BLOBS_PER_BLAST + 1) + k, colors[b.c]);
      this.splats.setColorAt(i, colors[b.c]);
      this.items[i].drops.forEach((d, k) => this.droplets.setColorAt(i * perBlast + k, d.white ? this.snowWhite : colors[d.colour]));
    });
    this.blobs.instanceColor.needsUpdate = true;
    this.splats.instanceColor.needsUpdate = true;
    this.droplets.instanceColor.needsUpdate = true;
    this.update(0);
  }

  /** Position of the shell of blast `i` at time t (s), and whether it is in flight. */
  _shell(i, t, out) {
    const b = this.plan[i], it = this.items[i];
    const s = (t - (b.t - it.flight)) / it.flight;
    if (s < 0 || s >= 1) return false;
    out.set(lerp(it.start.x, b.x, s), lerp(it.start.y, b.y, s) + it.arc * 4 * s * (1 - s), lerp(it.start.z, b.z, s));
    return true;
  }

  update(t) {
    const perBlast = BLAST.droplets, per = BLOBS_PER_BLAST + 1;
    this.plan.forEach((b, i) => {
      const it = this.items[i], tau = t - b.t;
      const base = i * per;
      // Shell: a streak along its velocity.
      if (this._shell(i, t, _p)) {
        const ahead = new THREE.Vector3();
        this._shell(i, t + 0.02, ahead) || ahead.set(b.x, b.y, b.z);
        _n.copy(ahead).sub(_p);
        _n.lengthSq() < 1e-8 ? _n.set(0, -1, 0) : _n.normalize();
        _q.setFromUnitVectors(_up, _n);
        const r = BLAST.shellRadius * (1 + 0.15 * b.r);
        this.blobs.setMatrixAt(base, _m.compose(_p, _q, _s.set(r, r * BLAST.shellStretch, r)));
      } else this.blobs.setMatrixAt(base, HIDDEN);

      // Geyser: a column of blobs that swells, holds and collapses into the snow.
      const C = BLAST.core;
      for (let k = 0; k < COLUMN; k++) {
        const slot = base + 1 + k;
        if (tau < 0 || tau > C.fall) { this.blobs.setMatrixAt(slot, HIDDEN); continue; }
        const swell = tau < C.rise ? easeOutBack(tau / C.rise) : 1;
        const collapse = tau < C.rise + C.hold ? 0 : clamp01((tau - C.rise - C.hold) / (C.fall - C.rise - C.hold));
        const fall = collapse * collapse;
        const rise = Math.min(1, tau / (C.rise * 1.6));
        const column = k === COLUMN - 1 ? 1.85 : 0.75 + 0.95 * k;     // heights as multiples of the radius
        const radius = b.r * (k === COLUMN - 1 ? 0.62 : 1.0 - 0.14 * k) * swell * (1 - 0.92 * fall);
        const y = b.y + b.r * (0.45 + column * rise * (1 - 0.8 * fall));
        const wob = 0.12 * b.r * Math.sin(tau * 14 + k * 2 + it.phase);
        _p.set(b.x + wob, y, b.z - wob * 0.6);
        _q.setFromAxisAngle(_up, it.phase + k);
        this.blobs.setMatrixAt(slot, _m.compose(_p, _q, _s.set(radius, radius * (1 + 0.12 * (1 - fall)), radius)));
      }
      // Crown: a wider flat blob on top of the column, the mushroom of paint.
      {
        const slot = base + 1 + COLUMN;
        if (tau < 0.08 || tau > C.fall) this.blobs.setMatrixAt(slot, HIDDEN);
        else {
          const swell = tau < C.rise + 0.1 ? easeOutBack((tau - 0.08) / (C.rise + 0.02)) : 1;
          const collapse = tau < C.rise + C.hold ? 0 : clamp01((tau - C.rise - C.hold) / (C.fall - C.rise - C.hold));
          const radius = b.r * 1.25 * swell * (1 - collapse);
          _p.set(b.x, b.y + b.r * (3.4 * Math.min(1, tau / (C.rise * 1.6)) * (1 - 0.8 * collapse * collapse)), b.z);
          this.blobs.setMatrixAt(slot, _m.compose(_p, _q.identity(), _s.set(radius, radius * 0.55, radius)));
        }
      }

      // Splat on the snow: grows quickly then stays.
      if (tau < 0) this.splats.setMatrixAt(i, HIDDEN);
      else {
        const size = it.splatSize * clamp01(tau / BLAST.splatGrow) ** 0.5;
        _q.setFromUnitVectors(_up, it.normal);
        _qy.setFromAxisAngle(_up, it.splatSpin);
        _q.multiply(_qy);
        _p.set(b.x, b.y, b.z).addScaledVector(it.normal, 0.08 + 0.002 * i);
        this.splats.setMatrixAt(i, _m.compose(_p, _q, _s.set(size, 1, size)));
      }

      // Ring on the snow.
      const ring = this.rings[i];
      if (tau < 0 || tau > BLAST.ring.life) ring.visible = false;
      else {
        const k = tau / BLAST.ring.life, r = Math.max(0.2, BLAST.ring.speed * tau);
        ring.visible = true;
        ring.position.set(b.x, b.y + 0.15, b.z).addScaledVector(it.normal, 0.05);
        ring.quaternion.setFromUnitVectors(_up, it.normal);
        ring.scale.set(r, 1, r);
        ring.material.opacity = 0.7 * (1 - k) * (1 - k);
      }

      // Droplets.
      it.drops.forEach((d, k) => {
        const slot = i * perBlast + k;
        if (tau < 0) { this.droplets.setMatrixAt(slot, HIDDEN); return; }
        const s = tau;
        if (!d.land || s < d.land.s) {
          _p.set(d.o.x + d.v.x * s, d.o.y + d.v.y * s - 0.5 * BLAST.gravity * s * s, d.o.z + d.v.z * s);
          this.droplets.setMatrixAt(slot, _m.compose(_p, _q.identity(), _s.set(d.size, d.size, d.size)));
        } else {
          // Landed: squashed on the snow.
          _p.set(d.land.x, d.land.y, d.land.z);
          this.droplets.setMatrixAt(slot, _m.compose(_p, _q.identity(), _s.set(d.size * 1.7, d.size * 0.4, d.size * 1.7)));
        }
      });
    });
    for (const m of [this.blobs, this.splats, this.droplets]) m.instanceMatrix.needsUpdate = true;
  }

  /**
   * Shake of the camera (m) at time t for a camera at `at`: sum of the blasts that went off recently, weaker with distance.
   * @returns {number}
   */
  shake(t, at) {
    const S = BLAST.shake;
    let a = 0;
    for (const b of this.plan) {
      const tau = t - b.t;
      if (tau < 0 || tau > 2.2) continue;
      const d = Math.hypot(at.x - b.x, at.y - b.y, at.z - b.z);
      a += S.amp * (b.r / 2.4) * Math.exp(-S.decay * tau) * clamp01(1 - d / S.reach);
    }
    return a;
  }

  /** Removes the meshes and frees geometries and materials. */
  dispose() {
    this.group.removeFromParent();
    for (const m of [this.blobs, this.splats, this.droplets]) { m.geometry.dispose(); m.material.dispose(); m.dispose(); }
    for (const r of this.rings) { r.geometry.dispose(); r.material.dispose(); }
  }
}

