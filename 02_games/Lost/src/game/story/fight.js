import * as THREE from 'three';
import { BOSS, COMBAT_CAM, Duel } from '../combat.js';
import { LOSS, SKIP_DIST } from './tuning.js';

/** Story methods that direct the fight: arena and boss set-up, combat camera, defeat of the kitten, music cues. */

const _fd = new THREE.Vector3(), _fr = new THREE.Vector3(), _fu = new THREE.Vector3(), _fq = new THREE.Vector3(); // frameNeed

const _pd = new THREE.Vector3();

const _need = { need: 0, needX: 0 };

/**
 * Minimum distance from the aimed point `t`, along the unit `dir` (aimed point to camera), that keeps the points `pts`
 * within the screen limits `L` (x, yMin, yMax, normalised coordinates). Each point: [x, y, z, width margin, height margin],
 * in m. For a point q relative to `t`, at depth d − q·dir, |x| ≤ m · tan · depth gives d ≥ |x| / (m · tan) + q·dir.
 * @returns {{need, needX}|null} `_need` (`needX`: the part due to width, which only rotation reduces); null if `dir` is
 *   vertical.
 */
function frameNeed(cam, t, dir, pts, L) {
  // Gaze = −dir; right = gaze × up = up × dir; screen up = right × gaze = dir × right.
  const right = _fr.crossVectors(THREE.Object3D.DEFAULT_UP, dir);
  if (right.lengthSq() < 1e-8) return null;
  right.normalize();
  const up = _fu.crossVectors(dir, right);
  const tanY = Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2), tanX = tanY * cam.aspect;
  let need = 0, needX = 0;
  for (const q of pts) {
    _fq.set(q[0] - t.x, q[1] - t.y, q[2] - t.z);
    const e = _fq.dot(dir), qx = Math.abs(_fq.dot(right)) + q[3], qy = _fq.dot(up);
    needX = Math.max(needX, qx / (L.x * tanX) + e);
    need = Math.max(need, needX, qy >= 0 ? (qy + q[4]) / (L.yMax * tanY) + e : (-qy + q[4]) / (-L.yMin * tanY) + e);
  }
  _need.need = need; _need.needX = needX;
  return _need;
}

export const fightDirection = {
  /**
   * Entering combat, when the challenge bubble closes or through `skipTo('combat')`:
   * - 'build' (BOSS.build s): veil and bars, minimap without a goal. The Chartiste turns towards the kitten, the arena builds
   *   around him (World.enterArena, minimap rebaked without the hidden trees). The kitten walks to BOSS.catDist m from the
   *   Chartiste, on its side, then stays there (`_combatLock`). Camera in slow orbit around the centre (COMBAT_CAM.build).
   * - 'grow' (BOSS.grow s): `_growBoss`.
   * - 'fight': `_fight` (Duel; sword can be taken, `pickSword`: cutscene 2).
   * - 'victory': `_victory` (VICTORY), then back out of combat and step 'maman'.
   */
  _startCombat() {
    const boss = this.npcs.chartiste, w = this.world, cat = this.cat;
    if (!boss || this._combat) return;
    this.crossing.reset();
    this._challengeOpen = false;
    // Combat music starts here, when the challenge bubble closes, before the arena is built and the transformation
    // (`_growBoss` sends no music cue).
    this._cue('boss-start');
    if (this.wizard?.state === 'walk') this.wizard.arrive(); // no NPC in the arena: placed at his post
    this.bubble.close();
    this._talking = null;
    this._cam = null; this._back = 0; this._gameOff = null;
    const r = boss.root.position, p = cat.root.position;
    let dx = p.x - r.x, dz = p.z - r.z;
    const d = Math.hypot(dx, dz);
    if (d < 1e-3) { dx = Math.sin(boss.root.rotation.y); dz = Math.cos(boss.root.rotation.y); } else { dx /= d; dz /= d; }
    const sx = r.x + dx * BOSS.catDist, sz = r.z + dz * BOSS.catDist;
    const spot = new THREE.Vector3(sx, this._ground(sx, sz), sz);
    // The Chartiste faces the kitten (heading: local +Z towards the kitten), before the transformation.
    const bossYaw = Math.atan2(dx, dz);
    boss.setPosition(r.x, r.y, r.z, bossYaw);
    // Starting azimuth of the orbit: to the side of the kitten (quarter turn from its direction, on the camera's side), so it
    // does not mask the centre in the foreground.
    const cam = w.camera.position, ac = Math.atan2(dx, dz), am = Math.atan2(cam.x - r.x, cam.z - r.z);
    const side = Math.sin(am - ac) >= 0 ? 1 : -1;
    this._combat = {
      phase: 'build', t: 0, spot, bossYaw, center: { x: r.x, z: r.z },
      ac, orbitSign: side,
      bossOk: null, look: null,
    };
    w.controls.maxDistance = COMBAT_CAM.fight.maxDistance;
    this._setShadow(COMBAT_CAM.shadow);
    this.veil.className = 'lost-veil on';
    this.bars.show();
    this.bossBar?.hide(0);
    this.catBar?.hide(0);
    this.minimap.setTarget(null);
    this.minimap.setVisible(false); // under the bars during the sequence; restored by _fight
    w.enterArena(this._combat.center, undefined, { duration: BOSS.build });
    this.minimap.refresh?.();
    this._pin = new THREE.Vector3(r.x, r.y, r.z);
    cat.brain.setHold(false);
    cat.brain.walkTo(spot);
    this._setStep('combat');
  },

  /** True during the sequence, kitten at its place (Story.update → Brain.setHold). */
  get _combatLock() {
    const c = this._combat;
    return !!c && (c.phase === 'grow' || c.phase === 'victory' || (c.phase === 'build' && !this.cat.brain.target) || !!this._swordScene);
  },

  /** Narrow screen (COMBAT_CAM.narrowAspect): higher or farther shots. */
  get _narrow() { return this.world.camera.aspect < COMBAT_CAM.narrowAspect; },

  /** Every frame during combat (update, before the camera glide). */
  _updateCombat(dt) {
    const c = this._combat, C = COMBAT_CAM;
    c.t += dt;
    if (c.phase === 'build') {
      const B = this._narrow ? { ...C.build, ...C.build.narrow } : C.build;
      // Orbit towards the kitten: it enters the shot gradually, three-quarter view. On a narrow screen, start and end are closer
      // to its direction (B.start, B.orbit), otherwise it stays out of view.
      const a = c.ac + c.orbitSign * (B.start - B.orbit * Math.min(c.t / BOSS.build, 1));
      this._shot(-Math.sin(a), -Math.cos(a), { dist: B.dist, height: B.height, side: 0, rate: B.rate });
      // End of construction (Arena.built), or 1 s more at most.
      if (c.t >= BOSS.build && (this.world.arena.built || c.t >= BOSS.build + 1)) this._growBoss();
    } else if (c.phase === 'grow') {
      if (c.look) this.cat.lookOverride = c.look;
      if (c.t >= BOSS.grow && !this.npcs.chartiste.bossGrowing) this._fight();
    } else if (c.phase === 'victory') {
      this._updateVictory(dt);
    } else {
      // Point followed between the kitten and the boss: both stay in the backed-off shot.
      const p = this.cat.root.position, r = this.npcs.chartiste.root.position, k = C.fight.follow;
      const x = p.x + (r.x - p.x) * k, z = p.z + (r.z - p.z) * k;
      this._pin.set(x, this._ground(x, z) + C.fight.lift, z);
      this._duel?.update(dt); // claw, boss strikes, knockback, defeat (combat.js, Duel)
    }
  },

  /**
   * Transformation: kitten placed at its spot if it has not arrived (no camera jump), turned towards the Chartiste; Chartiste
   * back to the frozen pose if needed (startBoss requires it), then `startBoss({ coat: BOSS.red })`; boss footprint added to
   * the obstacles (`npc_boss`); backed-off shot framing the whole boss and the kitten (`_growShot`).
   */
  _growBoss() {
    const c = this._combat, boss = this.npcs.chartiste, cat = this.cat, w = this.world;
    c.phase = 'grow'; c.t = 0;
    // No music cue here: the boss music starts when the bubble closes (`_startCombat`).
    const r = boss.root.position, s = c.spot, p = cat.root.position;
    const yaw = Math.atan2(r.x - s.x, r.z - s.z);
    cat.brain.setHold(true);
    if (Math.hypot(p.x - s.x, p.z - s.z) > 0.6) this._placeCat(s.x, s.z, yaw, false);
    else { cat.root.rotation.y = yaw; cat.locomotion.heading = yaw; }
    c.look = new THREE.Vector3(r.x, r.y + 1.2, r.z);
    // Frozen pose required by Npc.startBoss (refused otherwise); no setPose afterwards until endBoss.
    if (!boss._frozen) boss.setPose(boss.def.pose ?? 'SitNpc', { instant: true });
    boss.setPosition(r.x, r.y, r.z, c.bossYaw);
    c.bossOk = boss.startBoss({ coat: BOSS.red, duration: BOSS.grow, scale: BOSS.scale });
    const g = this._ground(r.x, r.z), [hx, hz] = BOSS.foot;
    w.ruins.obstacles.push({ name: 'npc_boss', x: r.x, z: r.z, hx, hz, rotY: c.bossYaw, top: g + 3.5, ground: g, height: 3.5, climbable: false });
    cat.brain.setWorld(w); // avoidance grid rebuilt with the boss's footprint
    this._growShot();
  },

  /**
   * Camera kept above the arena disc (COMBAT_CAM.inside), in every phase: outside the disc, pillars, wall and edge flowers
   * would come to the foreground. The camera is pulled towards the aimed point along its azimuth, and raised to keep its
   * distance (pitch capped at `maxPitch`, `fightPitch` in phases `fight` and `victory`). Nothing if the aimed point is
   * itself outside the disc.
   */
  _keepInArena() {
    const a = this.world.arena, I = COMBAT_CAM.inside, R = a.radius - I.margin, ph = this._combat?.phase;
    const pitch = ph === 'victory' || ph === 'fight' ? I.fightPitch : I.maxPitch;
    if (!(R > 0) || !a.center) return;
    const cam = this.world.camera.position, t = this.world.controls.target;
    const cx = a.center.x, cz = a.center.z;
    if (Math.hypot(cam.x - cx, cam.z - cz) <= R) return;
    let hx = cam.x - t.x, hz = cam.z - t.z;
    const h = Math.hypot(hx, hz);
    if (h < 1e-4) return;
    hx /= h; hz /= h;
    // s ≥ 0 such that |t + s·u − centre| = R, the aimed point being inside the disc.
    const px = t.x - cx, pz = t.z - cz;
    const b = px * hx + pz * hz, cc = px * px + pz * pz - R * R;
    if (cc > 0) return;
    const s = -b + Math.sqrt(b * b - cc);
    if (s >= h) return;
    const d = cam.distanceTo(t);
    const dy = Math.min(Math.sqrt(Math.max(d * d - s * s, 0)), s * Math.tan(pitch));
    cam.set(t.x + hx * s, t.y + Math.max(dy, 0), t.z + hz * s);
  },

  /**
   * Phase `fight`: the player's camera backs off along its axis if needed to keep the kitten and the boss in view
   * (COMBAT_CAM.fight.frame), at the current window format: going from 1280 × 800 to 390 × 844 reduces the horizontal field
   * and would push them out of frame. For a point q (relative to the aimed point) at depth d − q·dir, |x| ≤ m · tan · depth
   * gives the minimum distance d ≥ |x| / (m · tan) + q·dir, capped at maxDistance. Near the edge, _keepInArena keeps this
   * distance by raising the camera (`inside.fightPitch`), so the back-off holds through height. If width cannot be held
   * (maxDistance reached), the camera turns around the aimed point, at most `turn` rad/s, towards the kitten's side (boss
   * behind it): the on-screen kitten-boss gap shrinks. Once away from the edge, `_easeFight` restores the player's shot.
   */
  _fitFight(dt) {
    const F = COMBAT_CAM.fight.frame, w = this.world, cam = w.camera, t = w.controls.target;
    const p = this.cat.root.position, r = this.npcs.chartiste.root.position;
    const prev = this.lastFightFit, d0 = cam.position.distanceTo(t);
    this._easeFight(dt, d0);
    // Camera on the kitten's side (COMBAT_CAM.fight.behind): azimuth offset to the boss-to-kitten axis brought under `max`,
    // speed capped at `rate`; the boss stays behind the kitten on screen.
    const Bh = COMBAT_CAM.fight.behind;
    let behind;
    {
      const ox = cam.position.x - t.x, oz = cam.position.z - t.z, h = Math.hypot(ox, oz);
      const a = Math.atan2(ox, oz), b = Math.atan2(p.x - r.x, p.z - r.z);
      const delta = Math.atan2(Math.sin(b - a), Math.cos(b - a)), excess = Math.abs(delta) - Bh.max;
      behind = Math.abs(delta);
      if (h > 1e-4 && excess > 0) {
        const step = Math.sign(delta) * Math.min(excess, Math.min(Bh.rate, Bh.gain * excess) * dt);
        cam.position.x = t.x + Math.sin(a + step) * h; cam.position.z = t.z + Math.cos(a + step) * h;
        behind -= Math.abs(step);
      }
    }
    if (prev && prev.needX > w.controls.maxDistance + 0.05) { // width out of reach: only rotation reduces it
      const ox = cam.position.x - t.x, oz = cam.position.z - t.z, h = Math.hypot(ox, oz);
      const a = Math.atan2(ox, oz), b = Math.atan2(p.x - r.x, p.z - r.z);
      const delta = Math.atan2(Math.sin(b - a), Math.cos(b - a));
      const step = Math.sign(delta) * Math.min(Math.abs(delta), F.turn * dt);
      if (h > 1e-4 && step) { cam.position.x = t.x + Math.sin(a + step) * h; cam.position.z = t.z + Math.cos(a + step) * h; }
    }
    const dir = _fd.subVectors(cam.position, t);
    const d = dir.length();
    if (d < 1e-4) return;
    dir.divideScalar(d);
    const n = frameNeed(cam, t, dir, this._duelPts(), F);
    if (!n) return;
    const needX = n.needX;
    let need = n.need;
    need = Math.min(need, w.controls.maxDistance);
    this.lastFightFit = { need, needX, d, aspect: cam.aspect, behind };
    if (need > d) cam.position.copy(t).addScaledVector(dir, d + Math.min((need - d) * (1 - Math.exp(-F.pushRate * dt)), F.push * dt));
  },

  /**
   * Points to keep in frame during the duel (COMBAT_CAM.fight.frame), in the `frameNeed` format: raised kitten, boss's feet,
   * top of the boss (its height is bounded by `bossH`, with no margin).
   */
  _duelPts() {
    const F = COMBAT_CAM.fight.frame, p = this.cat.root.position, r = this.npcs.chartiste.root.position;
    return [[p.x, p.y + F.catY, p.z, F.catR, F.catR], [r.x, r.y, r.z, F.bossR, 0], [r.x, r.y + F.bossH, r.z, F.bossR, 0]];
  },

  /**
   * Picks a shot for the aimed point `t`: the first azimuth of `azs` (see azimuthFan), at the smallest pitch from `pitch0`,
   * where the camera holds `pts` in `L` (`frameNeed`) at no less than `dMin` and no more than `dMax` m, staying above the arena
   * disc (`inside`). Without a solution: the shot with the least excess. The higher the camera, the less room it needs behind
   * it: an aimed point near the edge holds almost vertically.
   * @returns {{az, pitch, d}} Chosen shot.
   */
  _planShot(t, pts, L, azs, pitch0, dMin, dMax) {
    const I = COMBAT_CAM.inside, step = COMBAT_CAM.plan.pitchStep, a = this.world.arena, cam = this.world.camera;
    const R = a.radius - I.margin, px = t.x - a.center.x, pz = t.z - a.center.z, cc = px * px + pz * pz - R * R;
    let best = null, over = Infinity;
    for (const az of azs) {
      const hx = Math.sin(az), hz = Math.cos(az), b = px * hx + pz * hz;
      const s = cc > 0 ? 0 : -b + Math.sqrt(b * b - cc); // room behind the aimed point, along the azimuth
      for (let pitch = Math.min(pitch0, I.fightPitch); ; pitch = Math.min(pitch + step, I.fightPitch)) {
        const c = Math.cos(pitch);
        const n = frameNeed(cam, t, _pd.set(hx * c, Math.sin(pitch), hz * c), pts, L);
        if (n) {
          const d = Math.max(dMin, n.need), e = Math.max(d - dMax, 0) + Math.max(Math.min(d, dMax) * c - s, 0);
          if (e < over) { over = e; best = { az, pitch, d: Math.min(d, dMax) }; }
          if (e <= 0) return best;
        }
        if (pitch >= I.fightPitch) break;
      }
    }
    return best;
  },

  /**
   * Guard during a shot glide (`hold`: pts, L): if the frame requires it, the camera backs off along its axis, not beyond
   * `controls.maxDistance`, gliding as in the duel (`frame.pushRate`, `push`); at once, it would jump 0.75 m to catch up with
   * a walking kitten at the victory.
   */
  _holdFrame(hold, dt) {
    const w = this.world, cam = w.camera, t = w.controls.target, dir = _pd.subVectors(cam.position, t), d = dir.length();
    if (d < 1e-4) return;
    dir.divideScalar(d);
    const n = frameNeed(cam, t, dir, hold.pts, hold.L);
    if (!n) return;
    const need = Math.min(n.need, w.controls.maxDistance), F = COMBAT_CAM.fight.frame;
    if (need > d) cam.position.copy(t).addScaledVector(dir, d + Math.min((need - d) * (1 - Math.exp(-F.pushRate * dt)), F.push * dt));
  },

  /**
   * Player's shot during the duel (`_fightRest`, distance and pitch): any change since the end of the previous frame
   * (`_fightEnd`, `_markFight`) comes from the player (drag, wheel, keys) and becomes the new shot. Otherwise the camera,
   * backed off or raised for the frame, returns to it softly (`fight.ease`); `_fitFight` and `_keepInArena` hold it back as
   * long as the frame requires.
   */
  _easeFight(dt, d) {
    const w = this.world, cam = w.camera.position, t = w.controls.target;
    if (d < 1e-4) return;
    const polar = Math.acos(THREE.MathUtils.clamp((cam.y - t.y) / d, -1, 1)), end = this._fightEnd;
    if (!this._fightRest || !end || Math.abs(polar - end.polar) > 1e-3 || Math.abs(d - end.dist) > 1e-3) {
      this._fightRest = { polar, dist: d };
      return;
    }
    const rest = this._fightRest, k = 1 - Math.exp(-COMBAT_CAM.fight.ease.rate * dt);
    const pol = polar < rest.polar ? polar + (rest.polar - polar) * k : polar;
    const dn = d > rest.dist ? d + (rest.dist - d) * k : d;
    if (pol === polar && dn === d) return;
    const ox = cam.x - t.x, oz = cam.z - t.z, h = Math.hypot(ox, oz);
    if (h < 1e-4) return;
    const nh = dn * Math.sin(pol);
    cam.set(t.x + ox / h * nh, t.y + dn * Math.cos(pol), t.z + oz / h * nh);
  },

  /** End of frame, after _keepInArena: reference state of `_easeFight` for the next frame. */
  _markFight() {
    const cam = this.world.camera.position, t = this.world.controls.target, d = cam.distanceTo(t);
    if (d < 1e-4) { this._fightEnd = null; return; }
    this._fightEnd = { polar: Math.acos(THREE.MathUtils.clamp((cam.y - t.y) / d, -1, 1)), dist: d };
  },

  /** Shot of the transformation (COMBAT_CAM.grow); kept in `lastCombatShot` (tests). */
  _growShot() {
    const G0 = COMBAT_CAM.grow, G = this._narrow ? { ...G0, ...G0.narrow } : G0;
    const cam = this.world.camera, p = this.cat.root.position, r = this.npcs.chartiste.root.position;
    let ux = r.x - p.x, uz = r.z - p.z;
    const len = Math.hypot(ux, uz) || 1;
    ux /= len; uz /= len;
    const mx = (p.x + r.x) / 2, mz = (p.z + r.z) / 2;
    // Perpendicular to the segment, on the side where the camera already is (no crossing of the shot).
    let nx = -uz, nz = ux;
    if (nx * (cam.position.x - mx) + nz * (cam.position.z - mz) < 0) { nx = -nx; nz = -nz; }
    // Midpoint-to-camera direction: moved by `angle` towards the kitten (−u).
    const ca = Math.cos(G.angle), sa = Math.sin(G.angle);
    const ox = nx * ca - ux * sa, oz = nz * ca - uz * sa;
    const tanY = Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2), tanX = tanY * cam.aspect;
    const half = (len / 2) * ca + G.half;
    const dist = Math.min(Math.max(G.dist, half / tanX, G.halfY / tanY), COMBAT_CAM.fight.maxDistance - 2);
    const height = dist * 0.25;
    this._pin.set(mx, this._ground(mx, mz) + G.lift, mz);
    this.lastCombatShot = { dist, height, angle: G.angle, narrow: this._narrow };
    this._shot(-ox, -oz, { dist, height, side: 0, rate: G.rate });
  },

  /**
   * End of the sequence: full bar displayed (BossBar.set(1), show), veil and bars removed, control returned to the kitten and
   * camera to the player (further away: maxDistance lifted). Combat rules: Duel (combat.js). HP at 0: cue 'victory'
   * (`onDefeat`), then `_victory` (`onWin`).
   */
  _fight() {
    const c = this._combat;
    c.phase = 'fight'; c.t = 0;
    c.look = null;
    this.lastFightFit = null; // _fitFight: no back-off inherited from a previous combat
    this._fightRest = null; this._fightEnd = null; // _easeFight: shot taken as it is
    this.cat.lookOverride = null;
    this.bossBar?.set(1);
    this.catBar?.set(1);
    this.veil.className = 'lost-veil';
    this.bars.hide();
    this.minimap.setVisible(true);
    this._cam = null;
    // Combat rules (combat.js, FIGHT and Duel); HP 0 leads to victory. Level chosen in the challenge bubble (`this.level`),
    // kitten's bar, defeat and phase 2.
    this._duel = new Duel({ cat: this.cat, boss: this.npcs.chartiste, world: this.world, bar: this.bossBar, catBar: this.catBar, ground: (x, z) => this._ground(x, z), level: this.level });
    const L = this._duel.L;
    this.bossBar?.setMarks(L.phase2?.on ? [L.phase2.at] : []); // notch at the life where phase 2 starts
    this.bossBar?.show();
    this.catBar?.show();
    this._duel.onDefeat = () => this._cue('victory');
    this._duel.onWin = () => this._victory();
    this._duel.onLose = () => this._lose();
    this._duel.onPhase2 = () => this._cue('boss-phase2');
  },

  /**
   * Defeat of the kitten (Duel.onLose: empty bar, kitten down): dark veil in `LOSS.fade` s. Under the full veil, `_retreat`
   * removes the arena (`_endCombat`, without the 'explore' cue) and brings the kitten back; the veil fades, then the
   * Chartiste's bubble reopens on the level choice (`talk('chartiste', 'rematch')`). Music cue 'defeat': the boss music fades
   * out, silence until the bubble (`musicSilent`). The next duel takes the level chosen then.
   */
  _lose() {
    if (this._loss || !this._combat) return;
    const d = this._duel;
    this.losses++;
    this.lastLoss = { level: d?.level ?? null, hits: d?.hits ?? null, lives: d?.L.lives ?? null, time: d ? Math.round(d.time * 100) / 100 : null };
    this._loss = { t: 0, swapped: false, t0: 0 };
    this.veil.className = 'lost-veil on';
    this._veilAlpha(0);
    this._cue('defeat');
  },

  /** Defeat in progress, every frame (update): veil rising, retreat under the veil, veil falling, bubble. */
  _updateLoss(dt) {
    const l = this._loss, L = LOSS;
    l.t += dt;
    if (!l.swapped) {
      this._veilAlpha(Math.min(l.t / L.fade, 1));
      if (l.t >= L.fade) { l.swapped = true; l.t0 = l.t; this._retreat(); this._veilAlpha(1); }
      return;
    }
    const u = l.t - l.t0 - L.hold;
    if (u < L.back) { this._veilAlpha(u < 0 ? 1 : 1 - u / L.back); return; }
    // Veil removed: the bubble reopens on the choice (silence moves from `_loss` to `_challengeOpen`); otherwise (bubble refused)
    // the zone music returns.
    this._veilAlpha(0);
    this.veil.className = 'lost-veil';
    const opened = this.talk('chartiste', 'rematch');
    this._loss = null;
    if (!opened) this._cue('explore');
  },

  /**
   * Under the full veil: out of the arena, boss back to Chartiste, sword back to its stone, bars hidden (`_endCombat`), step
   * 'maman' (as after the first challenge), kitten playable again, placed SKIP_DIST m from the Chartiste, on the origin side
   * (as `skipTo`), facing him.
   */
  _retreat() {
    this._endCombat({ cue: false });
    this.veil.className = 'lost-veil on'; // _endCombat made it inactive: it keeps the clicks until the bubble
    this._goal('maman');
    const r = this.npcs.chartiste.root.position, d = Math.hypot(r.x, r.z) || 1;
    const x = r.x - (r.x / d) * SKIP_DIST, z = r.z - (r.z / d) * SKIP_DIST;
    this._placeCat(x, z, Math.atan2(r.x - x, r.z - z));
    this.cat.brain.setScripted('idle');
    this.cat.brain.setScripted(null, 'idle');
  },

  /**
   * Music hook (no sound created here): notes `lastCue` and calls `story.onMusicCue(name)`, set by audio/soundtrack.js. Cues:
   * - 'challenge-open': the Chartiste's challenge bubble is open (`talk`): zone music stops, read in silence (`musicSilent`).
   * - 'challenge-cancel': challenge bubble closed without a choice (cat moved away) or challenge abandoned (`start`, `skipTo`): zone
   *   music returns.
   * - 'boss-start': choice made, bubble closing (`_startCombat`, also `skipTo('combat')`): boss music (fade
   *   MUSIC.fade.toBoss), before the arena is built and the transformation.
   * - 'boss-phase2': the boss enters phase 2 (Duel.onPhase2, bossMoves.js, Hard): switch of the boss music
   *   (Music.setBossPhase2).
   * - 'victory': boss HP at 0, at the start of the `Defeat` clip (Duel.onDefeat): crossfade of MUSIC.fade.victory s from the
   *   boss music to the meadow, with no victory theme.
   * - 'defeat': kitten's bar empty, kitten down (`_lose`): the boss music fades out and the silence lasts until the challenge
   *   bubble reopens (`musicSilent`).
   * - 'explore': combat interrupted without victory (step skip, replay, title screen, `__combat.end`) or challenge bubble
   *   refused after a defeat: back to the meadow (ordinary fades of MUSIC.fade).
   * `cueLog` keeps the last 40 cues with the level (tests).
   */
  _cue(name) {
    this.lastCue = name;
    this.cueLog.push({ cue: name, level: this.level, challengeOpen: this._challengeOpen, loss: !!this._loss });
    if (this.cueLog.length > 40) this.cueLog.shift();
    this.onMusicCue?.(name);
  },
};
