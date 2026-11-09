import * as THREE from 'three';
import { COMBAT_CAM } from '../combat.js';
import { SWORD } from '../../world/Sword.js';
import { azimuthFan, wrapAngle } from './framing.js';

/** Story methods for the sword cinematic: the run to the stone, the pull, then the cut back to the fight. */

const _pt = new THREE.Vector3();

export const swordPullScene = {
  /**
   * True if a click can take the sword: phase 'fight', sword planted, no pause, knockback or defeat, no boss strike in
   * progress (`swing` before the impact). During the announcement the player clicks to dodge, often right next to the stone,
   * and shrinking the click zone is not enough. The click then passes to the ground (Picker: target refused, `onGround`) and
   * becomes the dodge; on guard, a click on the handle starts the pull.
   */
  get swordTakeable() {
    const d = this._duel, c = this._combat;
    return !!(this.sword && d && c?.phase === 'fight' && !this._pull && !d.paused && !d.over && !d.lost
      && this.sword.state === 'stone' && d.b.mode !== 'defeat' && d.b.mode !== 'down' && d.c.mode !== 'knock'
      && !(d.b.mode === 'swing' && !d.b.struck));
  },

  /**
   * Click on the planted sword (main.js, Picker; Sword.hit only answers if `swordTakeable`): the cinematic starts on the
   * click. Duel paused (the boss stops attacking, current strike cancelled), veil (clicks ignored), bars and hidden minimap,
   * shot of the run (SWORD.run, `_runShot`). The kitten runs to its place (`sword.stance`), is placed exactly there, then a
   * three-quarter front close-up (SWORD.cam, `_pullShot`) and `_updatePull`.
   */
  pickSword() {
    if (!this.swordTakeable) return false;
    const st = this.sword.stance, brain = this.cat.brain;
    this._duel.dodge();
    this._duel.pause(true);
    this.veil.className = 'lost-veil on';
    this.bars.show();
    this.minimap.setVisible(false); // under the top bar during the cinematic; restored by _endPull
    brain.walkTo(new THREE.Vector3(st.x, 0, st.z), { run: true });
    this._pull = { phase: 'walk', t: 0, walk: 0, slowMin: 1, back: this._playerPlan() };
    this._runShot(true); // cut: shot of the run, whole kitten between the bars
    return true;
  },

  /**
   * Shot of the run to the stone: aimed at the middle of the kitten and the stone, camera three-quarter behind the kitten
   * (SWORD.run), on the side where it already is. `_planShot` holds both between the bars (COMBAT_CAM.plan.run), above the disc,
   * from any point of the arena: higher, or closer to the kitten-to-stone axis, if the wanted shot does not fit. `cut`: set at
   * once (cinematic cut on the click, with the bars); otherwise followed every frame of the run, keeping its azimuth as long
   * as it suits (`P.az`), and guarded by `_holdFrame`.
   */
  _runShot(cut) {
    const R = SWORD.run, RP = COMBAT_CAM.plan.run, cam = this.world.camera, P = this._pull, p = this.cat.root.position, f = this.sword.focus;
    const mx = (p.x + f.x) / 2, mz = (p.z + f.z) / 2;
    let ux = f.x - p.x, uz = f.z - p.z;
    const len = Math.hypot(ux, uz);
    if (len > 1e-3) { ux /= len; uz /= len; } else { ux = Math.sin(this.sword.stance.yaw); uz = Math.cos(this.sword.stance.yaw); }
    if (cut) {
      // Side of the camera, chosen at the cut: the furthest from the boss, otherwise his body and brush come to the foreground
      // and hide the running kitten.
      const b = this.npcs.chartiste.root.position, sb = -uz * (b.x - mx) + ux * (b.z - mz);
      P.side = sb >= 0 ? 1 : -1;
    }
    const a = R.angle * P.side, ca = Math.cos(a), sa = Math.sin(a);
    // Gaze: kitten-to-stone direction turned by `angle`; camera behind the kitten, to the side.
    const lx = ux * ca - uz * sa, lz = ux * sa + uz * ca;
    const az0 = Math.atan2(-lx, -lz), axis = Math.atan2(-ux, -uz);
    const fan = azimuthFan(az0, Math.sign(wrapAngle(axis - az0)) || 1);
    const y = 1 - 2 * R.bars - RP.margin, L = { x: RP.x, yMin: -y, yMax: y };
    const pts = [[p.x, p.y + COMBAT_CAM.fight.frame.catY, p.z, RP.catR, RP.catR], [f.x, f.y, f.z, RP.focusR, RP.focusR]];
    const g = this._ground(mx, mz);
    this._pin.set(mx, g + R.lift, mz);
    _pt.set(mx, g + R.lift + 0.22, mz); // arrival target: _pin + FOLLOW_HEIGHT (World)
    const plan = this._planShot(_pt, pts, L, !cut && P.az !== undefined ? [P.az, ...fan] : fan, Math.atan(R.height), R.dist * Math.hypot(1, R.height), this.world.controls.maxDistance);
    P.az = plan.az;
    P.hold = { pts, L };
    this._shot(-Math.sin(plan.az), -Math.cos(plan.az), { dist: plan.d * Math.cos(plan.pitch), height: plan.d * Math.sin(plan.pitch), side: 0, rate: R.rate });
    if (cut) {
      this._snapCamera(mx, mz); // target on the ground + FOLLOW_HEIGHT (World); raised by `lift` like the following
      this.world._target.y += R.lift; this.world.controls.target.y += R.lift;
      this._applyShot(0, true);
      cam.lookAt(this.world.controls.target);
    }
    P.runShot = { dist: Math.round(plan.d * 100) / 100, pitch: Math.round(plan.pitch * 100) / 100, len: Math.round(len * 100) / 100 };
  },

  /** Close-up of the pull: camera in front of the kitten (forward turned by `angle`), aimed between it and the stone. */
  _pullShot() {
    const S = SWORD, st = this.sword.stance;
    const fx = Math.sin(st.yaw), fz = Math.cos(st.yaw), a = S.cam.angle;
    const qx = fx * Math.cos(a) + fz * Math.sin(a), qz = -fx * Math.sin(a) + fz * Math.cos(a);
    this._pin.copy(this.sword.focus);
    this._pin.y += S.cam.height * 0.4;
    this._shot(-qx, -qz, { dist: S.cam.dist, height: S.cam.height, side: 0, rate: S.cam.rate });
  },

  /** Pull: run to its place, then SwordPull clip (slow motion SWORD.slow), then sword held. */
  _updatePull(dt) {
    const P = this._pull, S = SWORD, cat = this.cat, brain = cat.brain, st = this.sword.stance;
    P.t += dt;
    if (P.phase === 'walk') {
      const p = cat.root.position, d = Math.hypot(p.x - st.x, p.z - st.z);
      // Arrived (goal reached or abandoned by Brain), or 5 s at most: placed exactly at its spot.
      if ((!brain.target && !brain.jumping) || (d < S.pick.arrive && !brain.jumping) || P.t > 5) {
        P.walk = Math.round(P.t * 100) / 100;
        P.gap = Math.round(d * 100) / 100;
        this._placeCat(st.x, st.z, st.yaw, false);
        brain.setScripted('pull');
        this.sword.beginPull();
        P.phase = 'pull'; P.t = 0; P.hold = null;
        this._pullShot();
      } else this._runShot(false);
      return;
    }
    const a = cat.actions.SwordPull, t = a?.time ?? Infinity, dur = cat.duration('SwordPull');
    // Small pause: slow motion around the blade's exit, with eased entry and exit.
    const want = t >= S.slow.from && t <= S.slow.to ? S.slow.rate : 1;
    this.timeScale += (want - this.timeScale) * (1 - Math.exp(-12 * dt / Math.max(this.timeScale, 0.05)));
    if (Math.abs(this.timeScale - want) < 0.01) this.timeScale = want;
    P.slowMin = Math.min(P.slowMin, this.timeScale);
    if (!a || t >= dur - 1e-3 || P.t > dur + 2) this._endPull();
  },

  /** End of the pull: sword held (Sword.take, Cat.setSword), control returned, duel resumed. */
  _endPull() {
    const cat = this.cat, P = this._pull;
    this.lastPull = { walk: P.walk, gap: P.gap, clip: Math.round(P.t * 100) / 100, slowMin: Math.round(P.slowMin * 100) / 100 };
    this._pull = null;
    this.timeScale = 1;
    this.sword.take();
    // Sword taken without restarting the 'pull' state (the clip would restart from 0), then rest with the sword held
    // (Cat._swordState 'idle': last frame of SwordPull, no fade).
    cat.setSword(true, { replay: false });
    cat.brain.setScripted(null, 'idle');
    this._duel?.pause(false);
    this.veil.className = 'lost-veil';
    this.bars.hide();
    this.minimap.setVisible(true);
    this._cam = null;
    this._cutToFight(P.back);
  },

  /** Player's shot when clicking the sword: azimuth, pitch and distance chosen. */
  _playerPlan() {
    const w = this.world, cam = w.camera.position, t = w.controls.target, d = cam.distanceTo(t);
    const rest = this._fightRest ?? { polar: w.controls.getPolarAngle(), dist: d };
    return { az: Math.atan2(cam.x - t.x, cam.z - t.z), polar: rest.polar, dist: rest.dist };
  },

  /**
   * Leaving the sword-pull close-up: cinematic cut, last frame of the close-up then duel shot, while the bars withdraw. There
   * are 19 m to back off on a narrow screen: a glide would leave the kitten and boss out of frame for over half a second. Duel
   * aimed point set at once, player's shot (`back`, azimuth brought under `behind.max`) raised or backed off by `_planShot` just
   * enough for `_fitFight`'s frame; `_easeFight` then restores the player's shot, as after any back-off.
   */
  _cutToFight(back) {
    const C = COMBAT_CAM.fight, w = this.world, p = this.cat.root.position, r = this.npcs.chartiste.root.position;
    const x = p.x + (r.x - p.x) * C.follow, z = p.z + (r.z - p.z) * C.follow;
    this._pin.set(x, this._ground(x, z) + C.lift, z);
    this._snapCamera(x, z);
    w._target.y += C.lift; w.controls.target.y += C.lift;
    const t = w.controls.target, axis = Math.atan2(p.x - r.x, p.z - r.z), delta = wrapAngle(back.az - axis);
    const az0 = axis + THREE.MathUtils.clamp(delta, -C.behind.max, C.behind.max);
    const plan = this._planShot(t, this._duelPts(), C.frame, azimuthFan(az0, -Math.sign(delta) || 1), Math.PI / 2 - back.polar, back.dist, w.controls.maxDistance);
    const c = Math.cos(plan.pitch);
    w.camera.position.set(t.x + Math.sin(plan.az) * c * plan.d, t.y + Math.sin(plan.pitch) * plan.d, t.z + Math.cos(plan.az) * c * plan.d);
    this.lastFightFit = null;
    this._fightRest = { polar: back.polar, dist: back.dist };
    this._fightEnd = { polar: Math.PI / 2 - plan.pitch, dist: plan.d };
    this.lastCut = { az: Math.round(plan.az * 1000) / 1000, pitch: Math.round(plan.pitch * 1000) / 1000, d: Math.round(plan.d * 100) / 100 };
  },

  /** Pull interrupted (end of combat, victory, step skip): sword put back in the stone. */
  _abortPull() {
    if (!this._pull) return;
    const pulling = this._pull.phase === 'pull';
    this._pull = null;
    this.timeScale = 1;
    if (pulling && this.cat.brain.scripted) this.cat.brain.setScripted(null, 'idle');
    this.sword?.reset();
    this._duel?.pause(false);
  },
};
