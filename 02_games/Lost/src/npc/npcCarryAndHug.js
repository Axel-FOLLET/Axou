import * as THREE from 'three';
import { WALK_RATE, HUG } from './npcTuning.js';

/** Npc methods for what Maman does with the kitten: carrying it in her mouth, the final hug. */

const _v = new THREE.Vector3();

const _w = new THREE.Vector3();

const _q = new THREE.Quaternion();

const _axis = new THREE.Vector3();

const _aimTo = new THREE.Vector3();

const _aimQ = new THREE.Quaternion();

const _hugTop = new THREE.Vector3();

/** Bone turned by rotation `r` given in world space (r is not modified). */
function turnWorld(bone, r) {
  const p = bone.parent.getWorldQuaternion(new THREE.Quaternion());
  bone.quaternion.premultiply(p).premultiply(r).premultiply(p.invert());
}

export const carryAndHug = {
  /**
   * Carrying mode (Maman): `Walk` clip looping (speed × WALK_RATE, like the hero), ground contact each frame. The
   * caller moves `root` at `walkSpeed` m/s (setPosition), heading included.
   * @param {number} [fade] seconds
   * @returns {THREE.Object3D} `mouthAnchor`, where to attach the kitten
   */
  startCarry(fade = 0.3) {
    this.setPose('Walk', { loop: true, fade, timeScale: WALK_RATE });
    return this.mouthAnchor;
  },

  /**
   * Hug: Maman lying on her left side in an open C (`Sleep` clip frozen at HUG.at), chin turned toward the kitten's
   * head, upper front paw over it, eyes half-closed, slow breathing. The kitten is read only (head, root); the caller
   * places it at `hugSpot()` and puts it to sleep. End: `endHug()`, or any other `setPose`.
   * @param {object} [cat] kitten (Cat.js: `rig.head`), read only
   * @param {object} [opts] settings overriding HUG (`at`, `spot`, `paw`, `aim`, `lid`, `breath`)
   * @returns {boolean} false if the `Sleep` clip is missing
   */
  startHug(cat = null, opts = {}) {
    const o = { ...HUG, ...opts };
    if (!this.setPose('Sleep', { instant: true, freezeAt: o.at })) return false;
    // Neck of the frozen clip pose: the hug restarts from it each frame.
    if (this._neckBase) { this._neckBones().forEach((b, i) => b.quaternion.copy(this._neckBase[i])); this._neckBase = null; }
    this.root.updateMatrixWorld(true);
    // Upper front paw (the right one, left side on the ground) over the kitten's back.
    const spot = this.hugSpot(o);
    const s = this.sizeScale, rq = this.root.quaternion;
    const paw = new THREE.Vector3(spot.x, this.root.position.y + o.paw[1] * s, spot.z)
      .addScaledVector(new THREE.Vector3(1, 0, 0).applyQuaternion(rq), o.paw[0] * s)
      .addScaledVector(new THREE.Vector3(0, 0, 1).applyQuaternion(rq), o.paw[2] * s);
    const leg = this.rig.legs.FR;
    if (leg && o.paw) this._reach(leg, paw);
    const bones = [this.rig.spine[2], ...this._neckBones()].filter(Boolean);
    this._hug = { cat, o, bones, base: bones.map((b) => b.quaternion.clone()), t0: this._time, paw, pawError: this._lastReach?.error ?? null };
    this.eyes.setLid(o.lid);
    this._hugPose();
    return true;
  },

  /**
   * Where to place the kitten for spooning: against Maman's belly. The kitten's `Sleep` clip (curled up) turns its
   * body about 50° to the right of its root: `spot[2]` corrects the heading so that its body (hips to head) is
   * parallel to Maman's.
   * @param {object} [opts] `spot` = [offset toward the belly, forward] in m for size 1, [2] heading offset in rad
   *   (default HUG.spot)
   * @returns {{x: number, z: number, yaw: number}} kitten root (ground under it) and heading
   */
  hugSpot(opts = this._hug?.o ?? HUG) {
    const [side, fwd, dyaw = 0] = opts.spot ?? HUG.spot;
    const yaw = this.root.rotation.y, s = this.sizeScale, r = this.root.position;
    // Belly toward local −X: (−cos yaw, sin yaw) in world; forward local +Z: (sin yaw, cos yaw).
    return { x: r.x - Math.cos(yaw) * side * s + Math.sin(yaw) * fwd * s, z: r.z + Math.sin(yaw) * side * s + Math.cos(yaw) * fwd * s, yaw: yaw + dyaw };
  },

  /** End of the hug: NPC rest pose (`def.pose`, else `Lie`), eyes open. */
  endHug() {
    this._hug = null;
    this.eyes.setLid(0);
    this.setPose(this.def.pose ?? 'Lie', { instant: true });
  },

  /** Hug, each frame: starting pose, breathing, chin toward the kitten's head. */
  _hugPose() {
    const h = this._hug, o = h.o;
    h.bones.forEach((b, i) => b.quaternion.copy(h.base[i]));
    // Slow breathing (as on the sleeping hero: Spine.002 bone, sine).
    const chest = this.rig.spine[2];
    if (chest && o.breath) {
      chest.quaternion.multiply(_q.setFromAxisAngle(_axis.set(1, 0, 0), Math.sin((this._time - h.t0) * o.breath[0]) * o.breath[1]));
    }
    this.root.updateMatrixWorld(true);
    // Chin on top of the kitten's helmet (CCD on Neck, Neck.001, Head, bounded angles), when the kitten is against
    // Maman; otherwise the clip pose.
    const target = o.aim ? this._hugTarget(h) : null;
    h.chinGap = null;
    if (target) {
      const bones = this._neckBones(), used = bones.map(() => 0);
      for (let it = 0; it < o.aim[2]; it++) {
        for (let i = bones.length - 1; i >= 0; i--) {
          const b = bones[i], room = o.aim[0] * o.aim[1][i] - used[i];
          if (room <= 0) continue;
          const pivot = b.getWorldPosition(_v);
          const chin = this.mouthAnchor.getWorldPosition(_w).sub(pivot).normalize();
          _aimQ.setFromUnitVectors(chin, _aimTo.copy(target).sub(pivot).normalize());
          const ang = 2 * Math.acos(Math.min(1, Math.abs(_aimQ.w)));
          if (ang < 1e-4) continue;
          if (ang > room) _aimQ.slerp(_q.identity(), 1 - room / ang);
          used[i] += Math.min(ang, room);
          turnWorld(b, _aimQ);
          b.updateMatrixWorld(true);
        }
      }
      h.chinGap = this.mouthAnchor.getWorldPosition(_w).distanceTo(target);
    }
    this.refresh();
  },

  /**
   * Point aimed at by the chin: top of the crest of the kitten's helmet (Helmet.topPoint, read), raised by HUG.chin;
   * fallen helmet: per HUG.bare; no helmet built: the kitten's head.
   * @returns {THREE.Vector3|null} null if the kitten is far from Maman's head
   */
  _hugTarget(h) {
    const catHead = h.cat?.rig?.head;
    if (!catHead || !this.rig.head) return null;
    const ref = catHead.getWorldPosition(_hugTop);
    if (ref.distanceTo(this.rig.head.getWorldPosition(_v)) > 0.8 * this.sizeScale) return null;
    // Helmet fallen before the hug: Helmet.topPoint, HUG.bare mode.
    const helmet = h.cat.helmet;
    if (!helmet?.topPoint || !helmet.topPoint(_hugTop, h.o.bare)) return ref;
    _hugTop.y += h.o.chin ?? 0;
    return _hugTop;
  },
};
