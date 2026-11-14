import * as THREE from 'three';
import { currentAudioContext } from '../../audio/context.js';
import { meow } from '../../audio/Meow.js';
import { OPENING, SHOT } from './tuning.js';

/**
 * Story methods for the opening: after the arrival cutscene the kitten lies asleep among the scattered armour, wakes up,
 * looks around, sits and yawns; the shot widens and the player gets control. Also set up (frozen) behind the title screen.
 */

export const openingScene = {
  /**
   * Scene of the opening, ready and frozen: Maman at the summit, kitten asleep on the ground at `OPENING.drop` facing the
   * camera, fixed close shot on it (`_pin`), clicks ignored (veil), minimap hidden. `_open.phase` is 'sleep'; the arrival
   * cutscene sets it to 'video' while it plays. Nothing without NPCs.
   */
  _setUpOpening() {
    if (!this.hasNpcs) return;
    const cat = this.cat, O = OPENING;
    const ll = Math.hypot(O.look.x, O.look.z), lx = O.look.x / ll, lz = O.look.z / ll;
    this.npcs.maman.endHug();
    this._placeNpcs();
    this._placeMamanAtSummit();
    cat.lookOverride = null;
    this._placeCat(O.drop.x, O.drop.z, Math.atan2(-lx, -lz), false); // heading towards the camera
    if (cat.brain.scripted) cat.brain.setScripted(null, 'idle');
    cat.dropAsleep(); // lying on its side, as if it had just fallen asleep
    // Screen right (rx, rz) = (−lz, lx).
    this._open = { phase: 'sleep', t: 0, lx, lz, rx: -lz, rz: lx };
    this.veil.className = 'lost-veil on';
    this.minimap.setVisible(false);
    // Fixed shot: the camera follows `_pin` (main.js, followPoint), gaze `look`, no glide.
    this._pin = new THREE.Vector3(O.drop.x, this._ground(O.drop.x, O.drop.z), O.drop.z);
    this._snapCamera(O.drop.x, O.drop.z);
    this._shot(lx, lz, this._closeShot(), true);
  },

  /** The kitten is shown asleep (after the arrival cutscene): bars in, step 'opening', the waking sequence runs. */
  _beginOpening() {
    if (!this._open) return;
    this._open.phase = 'sleep';
    this._open.t = 0;
    this.bars.show();
    this._setStep('opening');
  },

  _updateOpening(dt) {
    const o = this._open, O = OPENING, brain = this.cat.brain;
    if (o.phase === 'video') return; // arrival cutscene playing
    o.t += dt;
    if (o.phase === 'sleep') {
      if (o.t >= O.sleep) { brain.setScripted('wake'); o.phase = 'wake'; o.t = 0; }
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
   * the left of the screen, then right. Nothing before waking (gaze with no weight: asleep).
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

  /** Ends the opening wherever it is (step skip, new game); Maman stays at the summit. */
  _endOpening() {
    if (!this._open) return;
    this._open = null;
    this._pin = null;
    this.cat.lookOverride = null;
    this._cam = null;
    this.veil.className = 'lost-veil';
    this.bars.hide(0);
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
