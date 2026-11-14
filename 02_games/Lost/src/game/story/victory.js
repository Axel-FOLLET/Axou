import * as THREE from 'three';
import { COMBAT_CAM } from '../combat.js';
import { VICTORY } from './tuning.js';
import { azimuthFan, wrapAngle } from './framing.js';

/** Story methods for the end of the fight: boss defeat, return to the meadow, and the reset of the combat state. */

const _pt = new THREE.Vector3();

export const victoryScene = {
  /**
   * Full victory (Duel.onWin, after `Defeat` and its held pose): phase 'victory', veil (clicks ignored), kitten held, bar
   * removed, side shot of both cats; then `_updateVictory`.
   */
  _victory() {
    const c = this._combat, boss = this.npcs.chartiste, cat = this.cat, V = VICTORY;
    this.lastDuel = this._duel?.state ?? null;
    this._abortSwordScene();
    if (!c || !boss) { this._endCombat(); this.met.boss = true; this._goalAfterVictory(); return; }
    c.phase = 'victory'; c.t = 0;
    c.v = { dissolve: false, drop: false, hide: false, unbuild: false, unbuilt: false, sword: cat.sword };
    boss.shrinkBoss(V.shrink);
    this.bossBar?.hide();
    this.catBar?.hide();
    this.veil.className = 'lost-veil on';
    const p = cat.root.position, r = boss.root.position;
    c.look = new THREE.Vector3(r.x, r.y + 0.3, r.z);
    // Side shot (like _growShot), on the side where the camera already is.
    const cam = this.world.camera;
    let ux = r.x - p.x, uz = r.z - p.z;
    const len = Math.hypot(ux, uz) || 1;
    ux /= len; uz /= len;
    const mx = (p.x + r.x) / 2, mz = (p.z + r.z) / 2;
    let nx = -uz, nz = ux;
    if (nx * (cam.position.x - mx) + nz * (cam.position.z - mz) < 0) { nx = -nx; nz = -nz; }
    const A = this._narrow ? V.cam.narrow.angle : V.cam.angle, ca = Math.cos(A), sa = Math.sin(A);
    const ox = nx * ca - ux * sa, oz = nz * ca - uz * sa;
    // Wanted shot, otherwise higher or closer to the kitten-to-boss axis (`_planShot`): frame held wherever the kitten is.
    // Computed for the shrunk boss; `_holdFrame` holds the camera while it shrinks.
    const g = this._ground(mx, mz), az0 = Math.atan2(ox, oz), axis = Math.atan2(-ux, -uz);
    this._pin.set(mx, g + V.cam.lift, mz);
    _pt.set(mx, g + V.cam.lift + 0.22, mz); // arrival target: _pin + FOLLOW_HEIGHT (World)
    c.v.hold = { pts: this._duelPts(), L: V.cam.frame };
    const pts = [c.v.hold.pts[0], [r.x, r.y, r.z, V.cam.bossR, 0], [r.x, r.y + V.cam.bossTop, r.z, V.cam.bossR, 0]];
    const plan = this._planShot(_pt, pts, V.cam.frame, azimuthFan(az0, Math.sign(wrapAngle(axis - az0)) || 1), Math.atan2(V.cam.height, V.cam.dist), Math.hypot(V.cam.height, V.cam.dist), this.world.controls.maxDistance);
    this._shot(-Math.sin(plan.az), -Math.cos(plan.az), { dist: plan.d * Math.cos(plan.pitch), height: plan.d * Math.sin(plan.pitch), side: 0, rate: 0 });
  },

  /**
   * End of the dissolve: only the kitten left to frame. Aim brought towards it (at most `settle.r` from the centre,
   * `_keepInArena` needs room), camera under `settle.dist`: `_endCombat` restores the exploration distance, and a wider shot
   * would jump at once.
   */
  _settleVictory() {
    const c = this._combat, S = VICTORY.cam.settle, w = this.world, cam = w.camera.position, t = w.controls.target, a = w.arena.center;
    const p = this.cat.root.position, F = COMBAT_CAM.fight.frame;
    const r = Math.hypot(p.x - a.x, p.z - a.z), k = r > S.r ? S.r / r : 1;
    c.v.pinTo = new THREE.Vector3(a.x + (p.x - a.x) * k, 0, a.z + (p.z - a.z) * k);
    c.v.pinTo.y = this._ground(c.v.pinTo.x, c.v.pinTo.z) + VICTORY.cam.lift;
    const pts = [[p.x, p.y + F.catY, p.z, F.catR, F.catR]], d = cam.distanceTo(t), az = Math.atan2(cam.x - t.x, cam.z - t.z);
    c.v.hold = { pts, L: VICTORY.cam.frame };
    _pt.copy(c.v.pinTo); _pt.y += 0.22;
    const plan = this._planShot(_pt, pts, VICTORY.cam.frame, azimuthFan(az, 1), Math.atan2(VICTORY.cam.height, VICTORY.cam.dist), Math.min(d, S.dist), S.dist);
    this._shot(-Math.sin(plan.az), -Math.cos(plan.az), { dist: plan.d * Math.cos(plan.pitch), height: plan.d * Math.sin(plan.pitch), side: 0, rate: 0 });
    c.v.settleT = c.t;
  },

  /** Victory sequence (VICTORY), every frame in phase 'victory'. */
  _updateVictory(dt) {
    const c = this._combat, v = c.v, V = VICTORY, boss = this.npcs.chartiste, w = this.world, cat = this.cat;
    if (c.look) cat.lookOverride = c.look;
    const t0 = V.shrink + V.rest; // start of the dissolve
    if (!v.settle) {
      // Top and width of the boss to keep in frame: they shrink with him, from `frame` to `bossTop`.
      const F = COMBAT_CAM.fight.frame, k = Math.min(c.t / V.shrink, 1), q = v.hold.pts, r = boss.root.position;
      q[2][1] = r.y + F.bossH + (V.cam.bossTop - F.bossH) * k;
      q[1][3] = q[2][3] = F.bossR + (V.cam.bossR - F.bossR) * k;
      if (this._cam) this._cam.rate = V.cam.rate * Math.min(c.t / V.cam.ramp, 1); // glide starts with no jolt
      if (c.t >= t0 + V.cam.settle.after) { v.settle = true; this._settleVictory(); }
    } else {
      this._pin.lerp(v.pinTo, 1 - Math.exp(-V.cam.settle.rate * dt));
      if (this._cam) this._cam.rate = V.cam.settle.rate * Math.min((c.t - v.settleT) / V.cam.ramp, 1);
    }
    if (!v.dissolve && c.t >= t0) {
      v.dissolve = true;
      if (this.dissolve) this.dissolve.start(boss.bodyMesh);
    }
    if (!v.drop && c.t >= t0 + V.drop) {
      v.drop = true;
      if (cat.sword) { this.sword?.drop(); cat.setSword(false); }
    }
    if (!v.hide && c.t >= t0 + V.hide) {
      v.hide = true;
      boss.endBoss(); // huge brush removed, previous size and coat
      boss.setVisible(false);
      c.look = null; cat.lookOverride = null;
    }
    if (!v.unbuild && c.t >= t0 + V.unbuildAt) {
      v.unbuild = true;
      w.arena.onUnbuilt = () => { v.unbuilt = true; };
      w.arena.unbuild(V.unbuild);
      if (!w.arena.unbuilding) v.unbuilt = true; // arena not shown
    }
    if (v.unbuilt || (v.unbuild && c.t >= t0 + V.unbuildAt + V.unbuild + 1)) this._finishVictory();
  },

  /**
   * End of the victory: back out of combat (arena left, camera and kitten returned), Chartiste gone (invisible, his obstacles
   * removed until `_resetVictory`), sword left on the ground, step 'chavalanche' (minimap towards the Chavalanche at the foot
   * of the mountain; 'maman' without him).
   */
  _finishVictory() {
    const c = this._combat, w = this.world;
    if (!c || c.phase !== 'victory') return;
    c.phase = 'done';
    w.arena.onUnbuilt = null;
    this.lastVictory = { t: Math.round(c.t * 100) / 100, sword: c.v.sword };
    this._endCombat();
    const obs = w.ruins?.obstacles ?? [];
    this._chartisteObstacle = obs.filter((o) => String(o.name ?? '').startsWith('npc_chartiste'));
    if (this._chartisteObstacle.length) {
      for (const o of this._chartisteObstacle) obs.splice(obs.indexOf(o), 1);
      this.cat.brain.setWorld(w);
    }
    this.met.boss = true;
    this._goalAfterVictory();
  },

  /** Goal after the victory over the Chartiste: the Chavalanche; without him, Maman. */
  _goalAfterVictory() {
    this._goal(this.chavalanche && this.npcs.chavalanche && !this.met.chavalanche ? 'chavalanche' : 'maman');
  },

  /**
   * Reset of the sword and the victory (start, skipTo): sword back in its whole stone and taken from the kitten, Chartiste
   * visible, his obstacles restored, dissolve cleared.
   */
  _resetVictory() {
    this._abortSwordScene();
    this.sword?.reset();
    if (this.cat.sword) this.cat.setSword(false);
    this.dissolve?.clear();
    this.npcs.chartiste?.setVisible(true);
    if (this._chartisteObstacle.length) {
      const obs = this.world.ruins?.obstacles;
      if (obs) for (const o of this._chartisteObstacle) if (!obs.includes(o)) obs.push(o);
      this._chartisteObstacle = [];
      this.cat.brain.setWorld(this.world);
    }
    this.lastVictory = null;
  },

  /**
   * Back to the out-of-combat state (skipTo, start, showTitle; tests): arena left (scenery, grass and obstacles restored,
   * minimap rebaked), boss footprint removed, boss undone (endBoss), Chartiste back at his place, bar hidden, camera
   * (maxDistance), shadow, veil, bars and kitten restored. Without combat, arena or boss: nothing.
   */
  _endCombat({ cue = true } = {}) {
    const w = this.world, boss = this.npcs.chartiste, c = this._combat;
    const obs = w.ruins?.obstacles ?? [];
    const bossObs = obs.findIndex((o) => o.name === 'npc_boss');
    const inArena = w.inArena;
    this._abortSwordScene(); // before dispose: duel still there for pause(false)
    if (this._duel) { this._duel.dispose(); this._duel = null; }
    if (!c && !inArena && bossObs < 0 && !boss?._boss) return;
    this._combat = null;
    if (w.arena) w.arena.onUnbuilt = null;
    // Without a victory (step skip, replay, __combat.end): base music, sword back in its stone.
    if (c && c.phase !== 'done') {
      if (cue) this._cue('explore'); // defeat (`_retreat`): 'defeat' already sent, silence until the bubble
      if (this.cat.sword) this.cat.setSword(false);
      if (this.sword && this.sword.state !== 'stone') this.sword.reset();
      if (c.phase === 'victory') { boss?.setVisible(true); this.dissolve?.clear(); } // victory cut short
    }
    if (inArena) w.leaveArena();
    const k = obs.findIndex((o) => o.name === 'npc_boss');
    if (k >= 0) obs.splice(k, 1);
    if (k >= 0 || inArena) this.cat.brain.setWorld(w);
    if (boss) { boss.endBoss(); this._placeNpcs(); }
    this.bossBar?.hide(0);
    this.catBar?.hide(0);
    w.controls.maxDistance = this._explore.maxDistance;
    this._setShadow();
    if (inArena) this.minimap.refresh?.();
    if (c) {
      this.veil.className = 'lost-veil';
      this.bars.hide(0);
      this._pin = null; this._cam = null;
      this.cat.lookOverride = null;
      this.cat.brain.setHold(false);
    }
  },
};
