import * as THREE from 'three';
import { currentAudioContext } from '../../audio/context.js';
import { meow } from '../../audio/Meow.js';
import { OPENING, SHOT } from './tuning.js';

/** Story methods for the opening: Maman carries the kitten in, sets it down and leaves; the kitten wakes up. */

/** Local point (x, z) rotated by `yaw` around Y (three.js convention): world offset [x, z]. */
const rotY = (x, z, yaw) => [x * Math.cos(yaw) + z * Math.sin(yaw), -x * Math.sin(yaw) + z * Math.cos(yaw)];

export const openingScene = {
  _updateOpening(dt) {
    const o = this._open, m = this.npcs.maman, O = OPENING, brain = this.cat.brain;
    o.t += dt;
    const p = m.root.position;
    if (o.phase === 'walk') {
      const dx = O.drop.x - p.x, dz = O.drop.z - p.z, d = Math.hypot(dx, dz);
      const step = m.walkSpeed * dt;
      if (d <= step) {
        m.setPosition(O.drop.x, this._ground(O.drop.x, O.drop.z), O.drop.z, o.yaw);
        m.setPose('Idle', { loop: true, fade: 0.35 });
        o.phase = 'pause'; o.t = 0;
      } else {
        const x = p.x + (dx / d) * step, z = p.z + (dz / d) * step;
        m.setPosition(x, this._ground(x, z), z, o.yaw);
      }
    } else if (o.phase === 'pause') {
      if (o.t >= O.pause) { o.phase = 'dip'; o.t = 0; o.k = 0; }
    } else if (o.phase === 'dip') {
      // Maman lowers her head; the kitten is released when its lowest point touches the ground (pose of the displayed frame),
      // asleep without getting up (Cat.dropAsleep).
      const cat = this.cat, r = cat.root.position;
      const gap = cat._lowestVertexY() - this._ground(r.x, r.z);
      if (gap <= O.dropAt || o.t >= O.dipMax) {
        cat.carry(null);
        cat.dropAsleep(undefined, O.dropFade);
        this.lastDrop = { t: o.t, gap, k: o.k, fallback: gap > O.dropAt };
        o.phase = 'hold'; o.t = 0;
      } else {
        o.k = THREE.MathUtils.smoothstep(o.t / O.dip, 0, 1);
        m.setHeadDip(o.k);
      }
    } else if (o.phase === 'hold' || o.phase === 'rise' || o.phase === 'settle') {
      // Backing off (kitten already released, `lastDrop` already set): from the frame after the release, Maman backs off by
      // `sidestep` (local frame) at the pace of the `StepBack` clip, head still down (`hold`), then raising it (`rise`); her front
      // paws leave the kitten before it spreads.
      const len = Math.hypot(O.sidestep.x, O.sidestep.z);
      if (!o.backing) {
        o.backing = { x: p.x, z: p.z, yaw: m.root.rotation.y, t: 0, d: 0, speed: len / O.backTime };
        if (m.setPose(O.sidestepClip, { loop: true, fade: O.sidestepFade, timeScale: O.sidestepRate })) {
          o.backing.speed = O.stepBackSpeed * O.sidestepRate; // clip's stride: supporting foot fixed
          m.action.time = O.sidestepFrom;
        } else if (m.setPose('Walk', { loop: true, fade: O.sidestepFade, timeScale: -0.83 })) {
          m.action.time = 0.1; // fallback: Walk played backwards
        }
      }
      const b = o.backing;
      b.t += dt;
      // No stop at |sidestep|: the clip runs until the start of `leave` and the root follows it (one more frame at most, 7 mm)
      // instead of stopping under a supporting foot that would slide.
      b.d += b.speed * dt;
      const back = b.d / len;
      const [sx, sz] = rotY(O.sidestep.x * back, O.sidestep.z * back, b.yaw);
      m.setPosition(b.x + sx, this._ground(b.x + sx, b.z + sz), b.z + sz, b.yaw);
      if (o.phase === 'hold') {
        if (o.t >= O.hold) { o.phase = 'rise'; o.t = 0; }
      } else if (o.phase === 'rise') {
        const u = Math.min(1, o.t / O.rise);
        m.setHeadDip(o.k * (1 - THREE.MathUtils.smoothstep(u, 0, 1)));
        if (u >= 1) { o.phase = 'settle'; o.t = 0; }
      } else if (back >= 1 && o.t >= O.settle) {
        m.startCarry(0.35); // walk (same clip as carrying), mouth empty
        o.phase = 'leave'; o.t = 0; o.turned = 0;
        // Half-turn past the camera (face seen): direction where the heading goes towards −look first.
        const toCam = Math.atan2(-o.lx, -o.lz) - o.yaw;
        o.turnSign = Math.sign(Math.atan2(Math.sin(toCam), Math.cos(toCam))) || 1;
        // Pivot of the half-turn in world coordinates (three.js Y rotation: local → world).
        o.yaw0 = m.root.rotation.y;
        const [wx, wz] = rotY(O.pivot.x, O.pivot.z, o.yaw0);
        o.pivot = { x: p.x + wx, z: p.z + wz };
      }
    } else if (o.phase === 'leave') {
      // Half-turn (π) around the fixed pivot, then a straight walk towards the left of the screen.
      if (o.turned < Math.PI) {
        o.turned += Math.min(Math.PI - o.turned, O.pivotRate * dt);
        const yaw = o.yaw0 + o.turnSign * o.turned;
        const [wx, wz] = rotY(O.pivot.x, O.pivot.z, yaw);
        const x = o.pivot.x - wx, z = o.pivot.z - wz;
        m.setPosition(x, this._ground(x, z), z, yaw);
      } else {
        const yaw = m.root.rotation.y, step = m.walkSpeed * dt;
        const x = p.x + Math.sin(yaw) * step, z = p.z + Math.cos(yaw) * step;
        m.setPosition(x, this._ground(x, z), z, yaw);
      }
      if ((o.turned >= Math.PI && !this._inView(m)) || o.t >= O.leaveMax) {
        this._placeMamanAtSummit();
        o.phase = 'alone'; o.t = 0;
      }
    } else if (o.phase === 'alone') {
      if (o.t >= O.alone) { brain.setScripted('wake'); o.phase = 'wake'; o.t = 0; }
    } else if (o.phase === 'wake') {
      if (o.t >= this.cat.duration('Wake')) { brain.setScripted('look'); o.phase = 'look'; o.t = 0; }
    } else if (o.phase === 'look') {
      if (o.t >= O.search) { brain.setScripted('sit'); o.phase = 'sit'; o.t = 0; }
    } else if (o.phase === 'sit') {
      if (o.t >= O.sit) { brain.setScripted('yawn'); o.phase = 'yawn'; o.t = 0; }
    } else if (o.phase === 'yawn') {
      // Sound only if the Yawn clip exists (otherwise Sit fallback, mouth closed) and the context is `running` (after the play
      // gesture): each triggered meow is a played sound.
      if (!o.meowed && o.t >= O.yawnMeow && o.t <= O.yawnMeowUntil && this.cat.hasClip('Yawn')
          && currentAudioContext()?.state === 'running') {
        o.meowed = true;
        meow('kitten', { call: true });
      }
      if (o.t >= (this.cat.duration('Yawn') || 2.3)) {
        o.phase = 'widen'; o.t = 0;
        this._shot(o.lx, o.lz, { ...SHOT.wide, dist: Math.max(SHOT.wide.dist, this._closeShot().dist * 1.6) });
      }
    } else if (o.phase === 'widen') {
      if (o.t >= O.widen) { this._release(); return; }
    }
    this._lookAround(o);
  },

  /**
   * Gaze of the awake kitten (Cat.lookOverride): straight ahead, except in phase 'look' where the head first looks towards
   * the left of the screen (where Maman left), then right. Nothing before waking (gaze with no weight: carried, asleep).
   */
  _lookAround(o) {
    const cat = this.cat;
    if (!['wake', 'look', 'sit', 'yawn', 'widen'].includes(o.phase)) { cat.lookOverride = null; return; }
    const r = cat.root.position, h = cat.root.rotation.y;
    let a = 0;
    if (o.phase === 'look') {
      // Heading turned by +a: direction (sin(h+a), cos(h+a)), derivative (cos h, −sin h) at a = 0; screen left = (−rx, −rz).
      const sign = Math.sign(-Math.cos(h) * o.rx + Math.sin(h) * o.rz) || 1;
      a = sign * OPENING.searchYaw * Math.sin((2 * Math.PI * o.t) / OPENING.search);
    }
    o.lookPoint ??= new THREE.Vector3();
    cat.lookOverride = o.lookPoint.set(r.x + Math.sin(h + a) * 1.5, r.y + 0.35, r.z + Math.cos(h + a) * 1.5);
  },

  /** End of the opening: wide shot in place, control returned to the player. */
  _release() {
    const cat = this.cat;
    this._open = null;
    this._pin = null;
    this._cam = null; // the player takes the camera back
    cat.lookOverride = null;
    this.veil.className = 'lost-veil';
    this.bars.hide(); // shot widened and control returned: bars removed softly (Letterbox.js)
    cat.brain.setScripted(null, 'idle'); // gets up (Sit played backwards, Cat.onStateChange)
    this._goal('chagicien');
  },

  /** Ends the opening wherever it is (Maman at the summit, kitten on the ground). */
  _endOpening() {
    if (!this._open) return;
    this._open = null;
    this._pin = null;
    this.cat.lookOverride = null;
    this._cam = null;
    this.veil.className = 'lost-veil';
    this.bars.hide(0);
    if (this.cat.carrier) this.cat.carry(null);
    if (this.hasNpcs) this._placeMamanAtSummit();
  },

  /** Maman lying on the summit ledge (zone 2), in that zone's group. */
  _placeMamanAtSummit() {
    const m = this.npcs.maman, [x, z, yaw] = this.places.maman;
    this.world.mountainGroup.add(m.root);
    m.setVisible(false);
    m.setPosition(x, this._ground(x, z), z, yaw);
    m.setPose('Lie', { instant: true });
    m.setVisible(true);
  },
};
