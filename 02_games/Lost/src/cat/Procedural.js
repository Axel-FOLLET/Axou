import * as THREE from 'three';

/**
 * Procedural animation layers applied after the mixer: breathing, tail shape and sway, ear movement and head
 * tracking. Created by Cat.js, which calls `restore` before the mixer and `update` after it.
 */

const _q = new THREE.Quaternion();
const _pq = new THREE.Quaternion();
const _e = new THREE.Euler();
const _v = new THREE.Vector3();
const _axis = new THREE.Vector3();
const _headPos = new THREE.Vector3();
const deg = THREE.MathUtils.degToRad;

/**
 * Tail shapes by situation, in degrees per bone (bone 0 = base, untouched): low when walking, curled when sitting
 * or lying, hooked when approached. pitch > 0 = backward then down; yaw > 0 = toward the cat's right.
 * `clip`: the GLB clip already poses the tail, only a faint sway is added.
 * `sway`: wave amplitude (rad); `speed`: wave speed factor.
 */
const TAIL_MODES = {
  up:   { pitch: [0, 6, 6, 6, 6, 4, 2, 0],          yaw: [0, 0, 0, 0, 0, 0, 0, 0],      sway: 0.08, speed: 1 },
  low:  { pitch: [0, 32, 30, 25, 15, 0, -10, -10],  yaw: [0, 0, 0, 0, 0, 0, 0, 0],      sway: 0.05, speed: 1.3 },
  curl: { pitch: [0, 48, 46, 40, 30, 20, 12, 4],    yaw: [0, 14, 16, 16, 12, 6, 0, 0],  sway: 0.015, speed: 0.6 },
  hook: { pitch: [0, -4, -6, -10, -16, -20, -20, -14], yaw: [0, 0, 0, 0, 0, 0, 0, 0],   sway: 0.04, speed: 1.6 },
  back: { pitch: [0, 32, 30, 25, 12, 0, 0, 0],      yaw: [0, 0, 0, 0, 0, 0, 0, 0],      sway: 0.10, speed: 0.7 },
  clip: { pitch: [0, 0, 0, 0, 0, 0, 0, 0],          yaw: [0, 0, 0, 0, 0, 0, 0, 0],      sway: 0.03, speed: 0.8 },
  // Hunt: low and stiff while stalking, only the tip moves; lower still during the pounce preparation, fast-whipping
  // tip and twitching ears. `flick` / `twitch`: interval (s) between tail-tip flicks / ear twitches, replacing the
  // calm values (4-10 s, 2-7 s).
  stalk:  { pitch: [0, 60, 25, 10, 0, 0, 0, 0],       yaw: [0, 0, 0, 0, 0, 0, 0, 0],      sway: 0.015, speed: 1.2, flick: [0.8, 2.2] },
  crouch: { pitch: [0, 70, 25, 5, -10, -15, -20, -15], yaw: [0, 0, 0, 0, 0, 0, 0, 0],     sway: 0.06, speed: 2.2, flick: [0.25, 0.7], twitch: [0.35, 0.9] },
  // Hunt clip in the GLB: the clip's shape, only tail-tip flicks are added.
  clipTip: { pitch: [0, 0, 0, 0, 0, 0, 0, 0],         yaw: [0, 0, 0, 0, 0, 0, 0, 0],      sway: 0.01, speed: 1, flick: [0.6, 1.8] },
};

/**
 * Layers applied after the mixer, as relative rotations: breathing, tail, ears, and a head that follows a point
 * with sudden head turns.
 *
 * "Body" rotations are expressed in the cat's frame (X right, Y up, Z toward the muzzle), then converted to the
 * bone parent's space, so there is no need to guess each Blender bone's local orientation. The cat's frame comes
 * each frame from the world quaternion of the `body` group.
 */
export class Procedural {
  constructor(rig) {
    this.rig = rig;
    this.t = 0;
    this.lookTarget = null;
    this.lookWeight = 1;
    this.tailMode = 'up';
    this.focus = false;      // hunting: gaze fixed on the prey, no head turns or calm ear twitches
    this.breathRate = 2.2;   // rad/s
    this.breathAmp = 0.02;   // rad
    this._frameQ = new THREE.Quaternion();
    this._yaw = 0;
    this._pitch = 0;
    this._earTwitch = 0;
    this._nextTwitch = 2;
    this._earYaw = 0;
    this._gaze = { yaw: 0, pitch: 0, next: 1.5 };
    // Actual gaze weight: `lookWeight`, except during a soft recovery (easeLook).
    this._lookW = 1;
    this._ease = null;
    this._gazeCur = { yaw: 0, pitch: 0 };
    this._tailPitch = new Float32Array(8);
    this._tailYaw = new Float32Array(8);
    this._flick = 0;
    this._nextFlick = 5;
    this._phase = Math.random() * 10;
    // "Mixer output" value of each touched bone. The AnimationMixer only writes a bone whose value changed since
    // the previous frame: without this copy, relative rotations would accumulate frame after frame.
    this._base = new Map();
  }

  _touch(bone) {
    if (!this._base.has(bone)) this._base.set(bone, bone.quaternion.clone());
  }

  /** Rotation in the bone's local space (ears). */
  _rotateLocal(bone, axis, angle) {
    this._touch(bone);
    _e.set(axis === 'x' ? angle : 0, axis === 'y' ? angle : 0, axis === 'z' ? angle : 0);
    bone.quaternion.multiply(_q.setFromEuler(_e));
  }

  /** Rotation around an axis of the cat's frame, applied to a bone. */
  _rotateFrame(bone, axisFrame, angle) {
    if (!angle) return;
    this._touch(bone);
    bone.parent.getWorldQuaternion(_pq);
    _axis.copy(axisFrame).applyQuaternion(this._frameQ).applyQuaternion(_pq.invert());
    bone.quaternion.premultiply(_q.setFromAxisAngle(_axis, angle));
    bone.updateMatrixWorld(true);
  }

  /**
   * Soft gaze recovery: the applied weight eases from its current value to `lookWeight` over `dur` s (S curve)
   * instead of snapping, with no new head turn meanwhile, so the head does not jump toward the pointer.
   */
  easeLook(dur) {
    this._ease = { from: this._lookW, t: 0, dur };
    this._gaze.next = Math.max(this._gaze.next, dur);
  }

  /** End of the soft recovery: the applied weight is `lookWeight` again. */
  stopEase() { this._ease = null; }

  /** Call before `mixer.update`: puts touched bones back in their post-mixer state. */
  restore() {
    for (const [bone, q] of this._base) bone.quaternion.copy(q);
  }

  /** Call after `mixer.update` and `updateMatrixWorld`: relative layers. `frame` = the `body` group. */
  update(dt, frame) {
    for (const [bone, q] of this._base) q.copy(bone.quaternion);
    this.t += dt;
    frame.getWorldQuaternion(this._frameQ);
    const { rig } = this;
    const { RIGHT, UP, FORWARD } = Procedural;
    const t = this.t + this._phase;

    // Breathing: slight rise of the chest (slower and deeper when asleep).
    this._rotateFrame(rig.spine[2], RIGHT, Math.sin(t * this.breathRate) * this.breathAmp);

    // Tail: target shape for the situation, reached smoothly, plus an irregular wave (two incommensurate sines,
    // slow envelope) and an occasional tip flick.
    const mode = TAIL_MODES[this.tailMode] ?? TAIL_MODES.up;
    const kt = 1 - Math.exp(-3 * dt);
    this._nextFlick -= dt;
    const [f0, f1] = mode.flick ?? [4, 10];
    if (this._nextFlick > f1) this._nextFlick = f0 + Math.random() * (f1 - f0); // entering a hunt
    if (this._nextFlick <= 0) { this._flick = 1; this._nextFlick = f0 + Math.random() * (f1 - f0); }
    const flick = this._flick > 0 ? Math.sin(this._flick * Math.PI) * 0.5 : 0;
    this._flick = Math.max(0, this._flick - dt * 2.5);
    const env = 0.65 + 0.35 * Math.sin(t * 0.37) * Math.sin(t * 0.11 + 1);
    rig.tail.forEach((bone, i) => {
      if (i === 0) return;
      this._tailPitch[i] += (deg(mode.pitch[i]) - this._tailPitch[i]) * kt;
      this._tailYaw[i] += (deg(mode.yaw[i]) - this._tailYaw[i]) * kt;
      const w = t * mode.speed;
      const wave = (Math.sin(w * 1.9 - i * 0.55) * 0.7 + Math.sin(w * 2.63 + 0.8 - i * 0.4) * 0.3) * mode.sway * env;
      this._rotateFrame(bone, FORWARD, wave + (i >= 5 ? flick * (i - 4) * 0.12 : 0));
      this._rotateFrame(bone, RIGHT, this._tailPitch[i]);
      this._rotateFrame(bone, UP, this._tailYaw[i]);
    });

    // Head: follows the pointer with clamped, smoothed angles; with no close target, small sudden head turns
    // every 1.5 to 4 s, like a real cat.
    let yaw = 0;
    let pitch = 0;
    if (this.lookTarget) {
      rig.head.getWorldPosition(_headPos);
      _v.copy(this.lookTarget).sub(_headPos).applyQuaternion(_q.copy(this._frameQ).invert());
      yaw = Math.atan2(_v.x, _v.z);
      pitch = Math.atan2(_v.y, Math.hypot(_v.x, _v.z));
      yaw = THREE.MathUtils.clamp(yaw, -1.1, 1.1);
      pitch = THREE.MathUtils.clamp(pitch, -0.5, 0.6);
    }
    this._gaze.next -= dt;
    if (this.focus) { this._gaze.yaw = 0; this._gaze.pitch = 0; }
    else if (this._gaze.next <= 0) {
      this._gaze.next = 1.5 + Math.random() * 2.5;
      this._gaze.yaw = (Math.random() - 0.5) * 0.5;
      this._gaze.pitch = (Math.random() - 0.5) * 0.25;
    }
    const kg = 1 - Math.exp(-14 * dt); // sudden: fast
    this._gazeCur.yaw += (this._gaze.yaw - this._gazeCur.yaw) * kg;
    this._gazeCur.pitch += (this._gaze.pitch - this._gazeCur.pitch) * kg;
    const e = this._ease;
    if (e) {
      e.t += dt;
      const u = Math.min(1, e.t / e.dur);
      this._lookW = e.from + (this.lookWeight - e.from) * u * u * (3 - 2 * u);
      if (u >= 1) this._ease = null;
    } else this._lookW = this.lookWeight;
    const lw = this._lookW;
    const k = 1 - Math.exp(-6 * dt);
    this._yaw += ((yaw + this._gazeCur.yaw) * lw - this._yaw) * k;
    this._pitch += ((pitch + this._gazeCur.pitch) * lw - this._pitch) * k;
    const parts = [[rig.neck[1], 0.3], [rig.neck[2], 0.3], [rig.head, 0.4]];
    for (const [bone, w] of parts) {
      // Yaw: a positive rotation around Y brings +Z toward +X (the cat's right).
      this._rotateFrame(bone, UP, this._yaw * w);
      // Pitch: raising the muzzle is a negative rotation around X (right-hand rule).
      this._rotateFrame(bone, RIGHT, -this._pitch * w);
    }

    // Ears: pivot toward the pointer with a delay, and twitch at times.
    const ke = 1 - Math.exp(-3 * dt);
    this._earYaw += (yaw * 0.4 * lw - this._earYaw) * ke;
    this._rotateFrame(rig.earL[0], UP, this._earYaw);
    this._rotateFrame(rig.earR[0], UP, this._earYaw);
    // While stalking (focus), ears stay fixed toward the prey; before the pounce, fast twitches.
    const twitch = mode.twitch ?? (this.focus ? null : [2, 7]);
    if (twitch) {
      this._nextTwitch = Math.min(this._nextTwitch, twitch[1]) - dt;
      if (this._nextTwitch <= 0) { this._earTwitch = 1; this._nextTwitch = twitch[0] + Math.random() * (twitch[1] - twitch[0]); }
    }
    if (this._earTwitch > 0) {
      const a = Math.sin(this._earTwitch * Math.PI) * 0.35;
      this._earTwitch = Math.max(0, this._earTwitch - dt * 4);
      this._rotateLocal(rig.earL[1], 'x', a);
      this._rotateLocal(rig.earR[1], 'x', -a * 0.4);
    }
  }
}

Procedural.RIGHT = new THREE.Vector3(1, 0, 0);
Procedural.UP = new THREE.Vector3(0, 1, 0);
Procedural.FORWARD = new THREE.Vector3(0, 0, 1);
