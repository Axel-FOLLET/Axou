// Passage between zones over the drawbridge, and the moment the gate opens. Called by Story on every frame.
// The fade uses Story's veil, which also blocks clicks while it plays.

import * as THREE from 'three';
import { ZONE2, ZONE2_ENTRY } from '../world/zone2.js';
import { OPENING as GATE, RAMPART, RETURN_LOOK } from '../world/Rampart.js';

/**
 * Zone-change settings. The change happens under the arch, not on the bridge: each band starts at the axis of the
 * vaulted passage, just past the portcullis, so the cat really walks under the vault, the 0.35 s fade catches it
 * still covered by the wall, and the obstacle at the end of the passage (`rampart_back`) bounds its travel in both
 * zones: it never arrives behind the rampart. The passage spans x = 33.3 to 34.9 in the meadow (`RAMPART.axisX` ±
 * half-thickness); its snow side is the same passage translated, from ZONE2.x − 6.6 to ZONE2.x − 5.0
 * (`RETURN_LOOK.axis`).
 * - `go`: band under the arch, in the meadow (x from `RAMPART.axisX` − 0.15 to 34.9, the end of the passage). The
 *   raised portcullis is at 33.75: the cat passes it, then the fade starts. The bridge deck spans x = 30.55 to 33.25.
 * - `back`: in zone 2, x below the passage axis (|z| < `half`), once the cat has passed the mountain-side entrance
 *   (ZONE2.x − 5.0).
 * - `land`: arrival on the meadow side, back to the gate. Under the arch when the gate is open (`bridge`, x = 33.55:
 *   before the `go` band, so no crossing loop can start, and the cat then walks towards the bridge), otherwise on
 *   the bank (`shore`, gate closed: arrival in zone 2 through a step skip, with no victory).
 * - `rise`, `hold`, `fall` (s): short dark fade, slow enough not to look like a glitch, short enough not to
 *   interrupt the walk.
 * - `color`: dark plum of the game's shadows, softer than pure black.
 * - `sight`: the opening plays within sight, once, after the victory, which happens far away.
 *   - `far` (m): 14, the gate is still sharp (FOG_NEAR 12, FOG_FAR 46) and the cat still far enough that at 2 m/s it
 *     does not arrive before the end of the 4.4 s animation.
 *   - `x`, `y`, `z`: point checked against the camera frame (y above the ground): the bottom of the raised bridge
 *     (1 m), where the bridge lands, because a plunging camera cuts off the top of the gate at this distance.
 *   - `near` (m): the gate opens anyway at this distance, even with the camera turned away, so the cat never stays
 *     in front of a closed gate.
 * - `sight.turn`: when the gate opens within `near` m and is out of frame, the camera pivots towards it for the
 *   opening (Rampart.OPENING, 4.4 s), then control returns to the player where the camera is, with no going back.
 *   - `frame`: screen |x| and |y| of the checked point below which the gate is already in view, so no pivot (0.85,
 *     the margin of `COMBAT_CAM.fight.frame`).
 *   - `speed` (rad/s): a half-turn in about 2.5 s, ramp-up included, so the gate faces the camera before the
 *     portcullis (2.2 to 4.4 s) has finished.
 *   - `rate` (1/s): approach rate towards the wanted angle.
 *   - `rampIn`, `rampOut` (s): speed eased in and out on an S-curve, with no abrupt start or stop.
 *   - `polar` (rad): a camera plunging more than this straightens at `polarSpeed` rad/s, otherwise the bottom of
 *     the gate stays above the frame. 1.36 is a compromise: the top of the gate nears the frame and tall grass does
 *     not hide the bridge as it does at 1.42.
 *   - `taken`, `takenPolar` (rad per frame): change from the previous frame above which the player has taken the
 *     camera (drag, keys), and the pivot stops for good. A plain click does not turn the camera: the cat sets off
 *     and the pivot continues.
 */
export const CROSS = {
  go: { x0: RAMPART.axisX - 0.15, x1: 34.9, half: 1.2 },
  back: { x: ZONE2.x + RETURN_LOOK.axis, half: 1.6 },
  land: { bridge: { x: 33.55, z: 0 }, shore: { x: 29.6, z: 0 }, yaw: -Math.PI / 2 },
  rise: 0.35,
  hold: 0.1,
  fall: 0.45,
  color: '46, 32, 54',
  sight: {
    far: 14, near: 6, x: 33.25, y: 1, z: 0,
    turn: { frame: 0.85, speed: 1.6, rate: 2, rampIn: 0.7, rampOut: 0.9, polar: 1.36, polarSpeed: 0.5, taken: 0.002, takenPolar: 0.01 },
  },
};

const _off = new THREE.Vector3(), _p = new THREE.Vector3();
const _wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const _ease = (x) => { const k = Math.min(Math.max(x, 0), 1); return k * k * (3 - 2 * k); };
const NO_CROSS = new Set(['title', 'end', 'hug', 'arrival', 'opening', 'combat']);

export class Crossing {
  constructor(story) {
    this.story = story;
    this.trips = 0;    // completed crossings (for tests)
    this._fade = null; // { t, to: 'mountain' | 'meadow', done }
    this._turn = null; // pivot towards the gate: { t, sign, last }
  }

  get fading() { return !!this._fade; }

  /** Step skip, new run or combat: fade cancelled, veil restored. */
  reset() {
    this._turn = null;
    if (!this._fade) return;
    this._fade = null;
    const v = this.story.veil;
    v.style.background = '';
    v.className = 'lost-veil';
  }

  update(dt) {
    this._updateTurn(dt);
    if (this._fade) { this._tick(dt); return; }
    this._openAtSight();
    const to = this._wanted();
    if (!to || this._refused()) return;
    this._fade = { t: 0, to, done: false };
    this.story.veil.className = 'lost-veil on';
    this._alpha(0);
  }

  /** Zone requested by the cat on the bridge, or null. It is a band: as soon as a refusal ends, the crossing starts. */
  _wanted() {
    const s = this.story, p = s.cat.root.position, C = CROSS;
    if (s.world.inMountain) return p.x < C.back.x && Math.abs(p.z) < C.back.half ? 'meadow' : null;
    if (!s.world.rampart.isOpen) return null;
    return p.x >= C.go.x0 && p.x <= C.go.x1 && Math.abs(p.z) < C.go.half ? 'mountain' : null;
  }

  /** Conversation, combat, jump, carried cat, petting, sequence: wait. */
  _refused() {
    const s = this.story, b = s.cat.brain;
    return !!(s._open || s._combat || s._shake || s._talking || s.bubble.isOpen || s.cat.carrier
      || b.scripted || b.hold || b.jumping || b.state === 'pet' || NO_CROSS.has(s.step));
  }

  _tick(dt) {
    const f = this._fade, C = CROSS;
    f.t += dt;
    if (!f.done && f.t >= C.rise) { f.done = true; this._swap(f.to); }
    const after = f.t - C.rise - C.hold;
    if (after >= C.fall) {
      this._fade = null;
      this.story.veil.style.background = '';
      this.story.veil.className = 'lost-veil';
      return;
    }
    this._alpha(f.t < C.rise ? f.t / C.rise : after < 0 ? 1 : 1 - after / C.fall);
  }

  _alpha(a) { this.story.veil.style.background = `rgba(${CROSS.color}, ${a.toFixed(3)})`; }

  /** Under the full veil: switch zone, clear paths (Brain.setZone), camera behind the arriving cat. */
  _swap(to) {
    const s = this.story, w = s.world, C = CROSS.land;
    s._cam = null; s._back = 0; s._gameOff = null; s._trip = null; s._haltPending = false;
    _off.copy(w.camera.position).sub(w.controls.target);
    if (to === 'mountain') s._placeCat(ZONE2_ENTRY.x, ZONE2_ENTRY.z, ZONE2_ENTRY.yaw);
    else {
      const at = w.rampart.isOpen ? C.bridge : C.shore;
      s._placeCat(at.x, at.z, C.yaw);
    }
    // Always on the −X side: behind the cat on arrival, looking at the gate on return.
    _off.x = -Math.abs(_off.x);
    w.camera.position.copy(w.controls.target).add(_off);
    w.controls.update();
    this.trips++;
  }

  /** After the victory, in the meadow: the bridge lowers when the cat comes within sight of the gate. */
  _openAtSight() {
    const s = this.story, r = s.world.rampart, S = CROSS.sight;
    if (!s.met.boss || r.state !== 'closed' || s.world.inMountain || s._combat || s._open) return;
    const c = s.cat.root.position, d = Math.hypot(c.x - S.x, c.z - S.z);
    if (d > S.far) return;
    _p.set(S.x, s._ground(S.x, S.z) + S.y, S.z).project(s.world.camera);
    const ax = Math.abs(_p.x), ay = Math.abs(_p.y), behind = _p.z >= 1;
    if (d > S.near && (ax >= 1 || ay >= 1 || behind)) return;
    r.startOpening();
    const F = S.turn.frame;
    if (d <= S.near && (ax > F || ay > F || behind)) this._turn = { t: 0, sign: 0, last: null };
  }

  /**
   * Pivot towards the gate while it opens (`sight.turn`): around the checked point, the short way, keeping the
   * distance. During a conversation (`_cam`, speech bubble) the dialogue camera has priority: the pivot waits and
   * resumes if the gate is still opening. It ends with the opening, so before any bridge crossing (`_wanted` waits
   * for the open gate).
   */
  _updateTurn(dt) {
    const g = this._turn;
    if (!g) return;
    const s = this.story, w = s.world, r = w.rampart, S = CROSS.sight, T = S.turn;
    if (r.state !== 'opening' || w.inMountain || s._combat || s._open) { this._turn = null; return; }
    if (s._cam || s._talking || s.bubble.isOpen) { g.t = 0; g.last = null; return; }
    const cam = w.camera.position, t = w.controls.target;
    const ox = cam.x - t.x, oy = cam.y - t.y, oz = cam.z - t.z, d = Math.hypot(ox, oy, oz);
    if (d < 1e-4) return;
    let th = Math.atan2(ox, oz), phi = Math.acos(THREE.MathUtils.clamp(oy / d, -1, 1));
    if (g.last && (Math.abs(_wrap(th - g.last.th)) > T.taken || Math.abs(phi - g.last.phi) > T.takenPolar)) { this._turn = null; return; }
    g.t += dt;
    const ramp = _ease(g.t / T.rampIn) * _ease((GATE.portcullisAt + GATE.portcullis - r._t) / T.rampOut);
    let delta = _wrap(Math.atan2(t.x - S.x, t.z - S.z) - th);
    // Gate directly behind: the direction chosen at the start is kept, so the walking cat does not flip it.
    if (g.sign && delta * g.sign < 0 && Math.abs(delta) > 2.5) delta += 2 * Math.PI * g.sign;
    if (!g.sign && delta) g.sign = Math.sign(delta);
    th += Math.sign(delta) * Math.min(Math.abs(delta), Math.min(Math.abs(delta) * T.rate, T.speed) * ramp * dt);
    if (phi < T.polar) phi = Math.min(T.polar, phi + T.polarSpeed * ramp * dt);
    const h = d * Math.sin(phi);
    cam.set(t.x + Math.sin(th) * h, t.y + d * Math.cos(phi), t.z + Math.cos(th) * h);
    g.last = { th, phi };
  }
}
