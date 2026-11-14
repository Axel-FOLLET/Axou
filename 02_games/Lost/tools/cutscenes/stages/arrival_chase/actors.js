/**
 * The three actors of the chase and the little things that follow them: Maman (running, stumbling, bolting, with head
 * and jaw overrides), the kitten (carried by the scruff with a swing, then thrown), the giant Chartiste (boss form,
 * guard then cry), and the snow kicked up by her paws.
 *
 * Only the game's own interfaces are used (`Npc.setPose`, `setPosition`, `setBoss`, `bossPlay`, `setPaintMark`,
 * `Cat.carry`, `attachArmor`). What the game does not offer (a swinging carried kitten, a ballistic flight, a head that
 * turns to a target, an open jaw) is built here, on top of the bones after the game's own update of the frame.
 */
import * as THREE from 'three';
import { attachArmor } from '../../../../src/cat/Armor.js';
import { CARRY, CHARTISTE, CLIPS, CLOCK, FLIGHT, RUN, SNOW_AIR } from './tuning.js';
import { smoothstep } from './ground.js';

const _v = new THREE.Vector3();
const _w = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const _r = new THREE.Quaternion();
const _pivot = new THREE.Vector3();
const _chin = new THREE.Vector3();
const _want = new THREE.Vector3();

/** Bone given the world rotation `r` on top of its present pose (the head and neck chain turn this way). */
function turnWorld(bone, r) {
  const p = bone.parent.getWorldQuaternion(_q2);
  bone.quaternion.premultiply(p).premultiply(r).premultiply(p.invert());
}

/**
 * Bones the scene overrides after the game's mixer. The mixer rewrites only the bones a clip animates; a bone it leaves
 * alone would keep the override of the last frame and accumulate. `begin` undoes our last override when the mixer did not
 * touch the bone, `end` remembers what we applied.
 */
class BoneLayer {
  constructor(bones) {
    this.entries = bones.filter(Boolean).map((bone) => ({ bone, base: bone.quaternion.clone(), applied: null }));
  }

  begin() {
    for (const e of this.entries) {
      if (e.applied && e.bone.quaternion.equals(e.applied)) e.bone.quaternion.copy(e.base);
      e.base.copy(e.bone.quaternion);
      e.applied = null;
    }
  }

  end() {
    for (const e of this.entries) e.applied = e.bone.quaternion.clone();
  }
}

/** Slope angle along the heading (rad, positive downhill), for the body pitch of a cat running down. */
function pitchAlong(ground, x, z, yaw) {
  const d = 0.45;
  const dh = ground.heightAt(x + Math.sin(yaw) * d, z + Math.cos(yaw) * d) - ground.heightAt(x - Math.sin(yaw) * d, z - Math.cos(yaw) * d);
  return -Math.atan2(dh, 2 * d);
}

export class Actors {
  /**
   * @param {object} game handles of the game (`world`, `cat`, `npcs`)
   * @param {{path: object, ground: object}} deps
   */
  constructor(game, { path, ground }) {
    const { world, cat, npcs } = game;
    this.world = world;
    this.cat = cat;
    this.maman = npcs.maman;
    this.chartiste = npcs.chartiste;
    this.path = path;
    this.ground = ground;
    if (!this.maman || !this.chartiste) throw new Error('[chase] Maman and the Chartiste must be built (npcsEnabled is false?)');

    // What to put back at the end.
    this.saved = {
      maman: { parent: this.maman.root.parent, pos: this.maman.root.position.clone(), yaw: this.maman.root.rotation.y },
      chartiste: { parent: this.chartiste.root.parent, pos: this.chartiste.root.position.clone(), yaw: this.chartiste.root.rotation.y },
    };

    // ---- Maman: child of the scene itself so the game loop keeps updating her (main.js updates NPCs whose parent is the
    // scene or the active zone), her paint mark off until the separating blast.
    world.scene.add(this.maman.root);
    this.maman.setPaintMark(false);
    this.has = {
      stumble: !!this.maman.clips[CLIPS.stumble],
      cry: !!this.chartiste.clips[CLIPS.cry],
    };
    this.runClip = CLIPS.run;
    const start = path.at(0);
    this.maman.setPosition(start.x, ground.heightAt(start.x, start.z), start.z, start.yaw);
    this.maman.setPose(this.runClip, { loop: true, instant: true, timeScale: RUN.rate });
    this.cadence = RUN.rate / this.maman.duration(this.runClip);           // stride cycles per second
    this.runSpeed = RUN.strideUnits * this.maman.model.scale.x / this.maman.duration(this.runClip); // m/s, clip rate 1
    this.layer = new BoneLayer([this.maman.rig.neck[0], this.maman.rig.neck[1], this.maman.rig.head, this.maman.rig.mouth]);
    this.pitch = 0;
    this.events = { stumble: false, flee: false, paint: false, cry: false };

    // ---- Kitten: helmet on, armour on, carried by Maman.
    this.armor = attachArmor(cat);
    cat.carry(this.maman);
    this.nape = cat.model.getObjectByName('Neck001');
    this.flight = null;
    this.lastCarried = { p: new THREE.Vector3(), q: new THREE.Quaternion(), t: 0 };

    // ---- Chartiste: boss form, far up the slope, brush in the paw.
    const C = CHARTISTE;
    world.scene.add(this.chartiste.root);
    this.chartistePos = new THREE.Vector3(C.offset[0], ground.heightAt(C.offset[0], C.offset[1]), C.offset[1]);
    this.chartiste.setPosition(this.chartistePos.x, this.chartistePos.y, this.chartistePos.z, C.yaw);
    if (!this.chartiste.setBoss(1, { scale: C.scale })) throw new Error('[chase] the Chartiste cannot take the boss form (not in a frozen pose)');
    this.chartiste.bossPlay(CLIPS.cryFallback, { loop: true, instant: true });

    this.puffs = new Puffs(world.scene, path, ground);
  }

  /** Head of Maman in the world (m). */
  headPosition(out = new THREE.Vector3()) {
    return this.maman.rig.head.getWorldPosition(out);
  }

  /** Kitten position (m), valid while it is shown. */
  kittenPosition(out = new THREE.Vector3()) {
    return out.copy(this.cat.root.position);
  }

  /**
   * One frame, called by the harness just before the render (so after the game's own update of the frame).
   * @param {number} t scene clock (s)
   * @param {number} dt step (s)
   * @param {{target: THREE.Vector3|null, weight: number, jaw: number}} look head target and weight, jaw opening (0..1)
   */
  update(t, dt, look) {
    const { maman, cat, path, ground } = this;
    const p = path.at(t);
    const y = ground.heightAt(p.x, p.z);

    // Pose changes keyed on the clock.
    if (t >= CLOCK.catch && !this.events.stumble) {
      this.events.stumble = true;
      maman.setPose(this.has.stumble ? CLIPS.stumble : CLIPS.stumbleFallback, { fade: 0.08 });
    }
    if (t >= CLOCK.separation && !this.events.paint) {
      this.events.paint = true;
      maman.setPaintMark(true);
    }
    if (t >= CLOCK.fleeStart && !this.events.flee) {
      this.events.flee = true;
      maman.setPose(this.runClip, { loop: true, fade: 0.15, timeScale: RUN.rate * 1.08 });
    }
    if (t >= CLOCK.cry && !this.events.cry) {
      this.events.cry = true;
      if (this.has.cry) this.chartiste.bossPlay(CLIPS.cry, { fade: 0.25 });
    }

    // Maman: place on the slope, pitch the body with the ground.
    maman.setPosition(p.x, y, p.z, p.yaw);
    const target = pitchAlong(ground, p.x, p.z, p.yaw) * 0.8;
    this.pitch += (target - this.pitch) * (1 - Math.exp(-8 * dt));
    maman.body.rotation.x = this.pitch;
    maman.root.updateMatrixWorld(true);

    // Head and jaw overrides on top of the mixer.
    this.layer.begin();
    if (look.target && look.weight > 0) this._aim(look.target, look.weight);
    if (look.jaw > 0 && maman.rig.mouth) {
      _r.setFromAxisAngle(_v.set(1, 0, 0), -0.75 * look.jaw);
      maman.rig.mouth.quaternion.multiply(_r);
    }
    this.layer.end();
    maman.refresh();
    maman.root.updateMatrixWorld(true);

    this._placeKitten(t, dt, p);
    this.cat.armor?.update(dt);
    this.puffs.update(t);
  }

  /** CCD of head, upper and lower neck bones so that the muzzle points at `target`, bounded, as Npc.startHug does. */
  _aim(target, weight) {
    const { maman } = this;
    const bones = [maman.rig.head, maman.rig.neck[1], maman.rig.neck[0]].filter(Boolean);
    const limits = [0.95, 0.6, 0.4]; // rad each at weight 1: about 115 degrees in all, enough to look back over a shoulder
    const used = bones.map(() => 0);
    for (let pass = 0; pass < 3; pass++) {
      bones.forEach((b, i) => {
        const room = limits[i] * weight - used[i];
        if (room <= 0) return;
        b.updateWorldMatrix(true, false);
        const pivot = b.getWorldPosition(_pivot);
        const chin = maman.mouthAnchor.getWorldPosition(_chin).sub(pivot).normalize();
        const want = _want.copy(target).sub(pivot).normalize();
        _q.setFromUnitVectors(chin, want);
        const angle = 2 * Math.acos(Math.min(1, Math.abs(_q.w)));
        if (angle < 1e-4) return;
        if (angle > room) _q.slerp(_r.identity(), 1 - room / angle);
        used[i] += Math.min(angle, room);
        turnWorld(b, _q);
        b.updateMatrixWorld(true);
      });
    }
  }

  /** Kitten: hung from the mouth with a swing until the release, ballistic and spinning after it, hidden once gone. */
  _placeKitten(t, dt, p) {
    const { cat, maman } = this;
    if (t >= CLOCK.kittenGone) { cat.root.visible = false; return; }
    cat.root.visible = true;
    const yaw = p.yaw;
    const fwd = _v.set(Math.sin(yaw), 0, Math.cos(yaw)).clone();
    const left = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
    if (t < CLOCK.release) {
      // Nape stuck to the mouth (as Cat.update does in the game, one frame later than this code can run).
      cat.root.rotation.set(0, maman.root.rotation.y + CARRY.yaw, 0);
      cat.root.updateMatrixWorld(true);
      this.nape.localToWorld(_w.set(...CARRY.nape));
      maman.mouthAnchor.getWorldPosition(_v);
      cat.root.position.add(_v.sub(_w));
      cat.root.updateMatrixWorld(true);
      // Swing about the mouth: roll about her axis at the stride rate, jolt about her side axis at twice that.
      const mouth = maman.mouthAnchor.getWorldPosition(new THREE.Vector3());
      const phase = 2 * Math.PI * this.cadence * t;
      const grow = 1 + 2.2 * smoothstep(CLOCK.catch, CLOCK.release, t);
      const roll = CARRY.swingRoll * grow * Math.sin(phase - CARRY.swingLag);
      const pitch = CARRY.swingPitch * grow * Math.sin(2 * phase - CARRY.swingLag);
      const swing = new THREE.Quaternion().setFromAxisAngle(fwd, roll).multiply(new THREE.Quaternion().setFromAxisAngle(left, pitch));
      cat.root.position.sub(mouth).applyQuaternion(swing).add(mouth);
      cat.root.quaternion.premultiply(swing);
      cat.root.updateMatrixWorld(true);
      this.lastCarried.p.copy(cat.root.position);
      this.lastCarried.q.copy(cat.root.quaternion);
      this.lastCarried.t = t;
      this.lastCarried.vel = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw)).multiplyScalar(p.speed);
      this.lastCarried.yaw = yaw;
      return;
    }
    // Flight from the last carried pose.
    const L = this.lastCarried, tau = t - L.t;
    const f = new THREE.Vector3(Math.sin(L.yaw), 0, Math.cos(L.yaw));
    const l = new THREE.Vector3(Math.cos(L.yaw), 0, -Math.sin(L.yaw));
    const kick = new THREE.Vector3().addScaledVector(l, FLIGHT.kick[0]).addScaledVector(_v.set(0, 1, 0), FLIGHT.kick[1]).addScaledVector(f, FLIGHT.kick[2]);
    const v0 = L.vel.clone().add(kick);
    const pos = L.p.clone().addScaledVector(v0, tau);
    pos.y -= 0.5 * FLIGHT.gravity * tau * tau;
    const floor = this.ground.heightAt(pos.x, pos.z) + 0.12;
    if (pos.y < floor) pos.y = floor;
    cat.root.position.copy(pos);
    const spin = new THREE.Vector3().addScaledVector(l, FLIGHT.spin[0]).addScaledVector(_v.set(0, 1, 0), FLIGHT.spin[1]).addScaledVector(f, FLIGHT.spin[2]);
    const w = spin.length();
    const rot = new THREE.Quaternion().setFromAxisAngle(spin.normalize(), w * tau);
    cat.root.quaternion.copy(L.q).premultiply(rot);
    cat.root.updateMatrixWorld(true);
    void dt;
  }

  dispose() {
    const { maman, chartiste, cat, saved } = this;
    this.puffs.dispose();
    cat.armor?.dispose();
    cat.armor = null;
    cat.root.visible = true;
    cat.root.rotation.set(0, 0, 0);
    cat.carry(null);
    chartiste.endBoss();
    for (const [npc, s] of [[maman, saved.maman], [chartiste, saved.chartiste]]) {
      s.parent?.add(npc.root);
      npc.setPosition(s.pos.x, s.pos.y, s.pos.z, s.yaw);
    }
    maman.body.rotation.x = 0;
    maman.setPaintMark(true);
    maman.setPose(maman.def.pose ?? 'Lie', { instant: true });
  }
}

/** Snow thrown up behind Maman's paws: soft puffs that rise, swell and fade (shrink), a pure function of the clock. */
class Puffs {
  constructor(parent, path, ground) {
    this.path = path;
    this.ground = ground;
    this.mesh = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 6), new THREE.MeshBasicMaterial({ color: SNOW_AIR.puffTint }), 64);
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = false;
    this.mesh.receiveShadow = false;
    this.mesh.raycast = () => {};
    this.mesh.name = 'ChasePuffs';
    parent.add(this.mesh);
  }

  /** Deterministic value in 0..1 for puff number k and channel c. */
  static hash(k, c) {
    const s = Math.sin(k * 127.1 + c * 311.7 + SNOW_AIR.seed) * 43758.5453;
    return s - Math.floor(s);
  }

  update(t) {
    const S = SNOW_AIR, hide = new THREE.Matrix4().makeScale(0, 0, 0);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion();
    let n = 0;
    const kMax = Math.floor(t * S.puffRate), kMin = Math.max(0, Math.ceil((t - S.puffLife) * S.puffRate));
    for (let k = kMin; k <= kMax && n < this.mesh.count; k++) {
      const te = k / S.puffRate, tau = t - te;
      const p = this.path.at(te);
      if (p.speed < 1.5) continue;
      const fx = Math.sin(p.yaw), fz = Math.cos(p.yaw);
      const side = (Puffs.hash(k, 1) - 0.5) * 0.7;
      const x = p.x + fz * side - fx * (0.25 + S.puffBack * tau);
      const z = p.z - fx * side - fz * (0.25 + S.puffBack * tau);
      const life = tau / S.puffLife;
      const size = THREE.MathUtils.lerp(S.puffSize[0], S.puffSize[1], Puffs.hash(k, 2)) * (0.6 + 1.5 * life) * (1 - smoothstep(0.6, 1, life));
      const y = this.ground.heightAt(x, z) + 0.12 + S.puffRise * tau;
      this.mesh.setMatrixAt(n++, m.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(size, size * 0.8, size)));
    }
    for (; n < this.mesh.count; n++) this.mesh.setMatrixAt(n, hide);
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  dispose() {
    this.mesh.removeFromParent();
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
    this.mesh.dispose();
  }
}
