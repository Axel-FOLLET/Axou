import { CLIMB } from './climb.js';
import { ZONE2, SUMMIT } from '../world/zone2.js';

/**
 * The Chavalanche, mountain guide. Seated at the foot (Npc.js, kind `chavalanche`), he gets up after his first speech
 * bubble and follows the kitten along the path. When the player asks (a click on him, after a fall), he takes the snow
 * cats' snowballs in the kitten's place up to the summit. Called by main.js every frame, BEFORE the NPC update; no effect
 * in the meadow (zone 2 is then out of the scene). Follow distance, start, shield and reach come from `CLIMB`
 * (climb.js); the values in this file are used only by him.
 *
 * Following: a "snake" on the kitten's trail of steps. `pts` holds the waypoints between the Chavalanche and the kitten
 * (the kitten lays one every `CLIMB.chavalanche.trail` m; a kitten doubling back, e.g. after a slide, erases the
 * stretch it covers again). He walks towards the first point, so he never cuts a bend or a narrow passage the kitten
 * took. He has NO navigation obstacle (his sitting obstacle is removed as soon as he gets up), so the kitten is never
 * blocked; a kitten walking on him pushes him aside (`yieldR`). His body stays in the corridor and off Maman
 * (`Mountain.resolve`). The gait follows the gap to the follow distance (Walk, Trot, run: the chosen clip has a bounded
 * rate, so steps stay glued to the ground).
 *
 * Stages: 'home' (seated, obstacle placed) → 'rise' (getting up, Idle) → 'wait' (standing, waiting for the kitten to
 * move `CLIMB.chavalanche.start` m away) → 'follow'. Leaving over the bridge: he goes back to his place, seated, and
 * resumes following when the kitten comes back near him (`resume`).
 */
export const CHAVALANCHE = {
  /**
   * Sitting place at the foot (relative to ZONE2.x): 2.4 m from the axis of the first segment, +Z side, outside the
   * walking corridor and the arrival point. Heading towards the entrance (−X).
   */
  home: { x: 4.3, z: 0.55, yaw: -1.633 },
  /** Footprint of his sitting obstacle, local frame (m, ×1.25 included), like the NPCs of NPC_FOOTPRINTS (npcPlacement.js). */
  foot: { hx: 0.22, hz: 0.4 },
  /** Approach speech bubble (m, Story.update): beyond TALK.approach (1.8), because the path passes 2.4 m from his place. */
  approach: 3.2,
  /** He gets up (Idle clip, `riseFade` s fade) then waits `riseWait` s before being able to follow. */
  riseFade: 0.6, riseWait: 0.5,
  /** Following resumes when the kitten comes back near his place (m), after leaving over the bridge. */
  resume: 3.5,
  /**
   * Regulation: wanted speed = `gain` (1/s) × gap to the follow distance (m), capped by the kitten's run speed. Stops
   * below a `stop` m gap, starts beyond `go` m.
   */
  gain: 1.6, stop: 0.1, go: 0.3,
  /** Bounds of each clip's playback rate (steps stay glued to the ground: clip speed × rate). */
  rate: { Walk: [0.5, 1.6], Trot: [0.6, 1.5], run: [0.65, 1.0] },
  /** Turn speed (rad/s) when moving; when stopped (looking at the kitten). */
  turn: 7, look: 3.5,
  /**
   * Distance (m) below which he steps aside from a kitten walking on him; jump (m) in one frame beyond which the kitten
   * is treated as placed elsewhere.
   */
  yieldR: 0.6, teleport: 4,
  /** Trail: a point landing within `erase` m of a point more than `skip` points older erases everything after it. */
  erase: 0.45, skip: 4,
  /** Margin (m) of his body against the corridor edge and the obstacles. */
  body: 0.3,
  /** Time (s) the Flinch clip plays before moving on (the clip lasts 0.79 s: cut before its end so the pose does not freeze). */
  flinch: 0.5,
  flinchGap: 3.5,        // m: beyond this, no flinch stop (he catches up with the kitten)
  /**
   * After the first fall: one offer speech bubble, once only, `offerDelay` s after the kitten regains control.
   * `offer` false: no spontaneous bubble (tests).
   */
  offer: true, offerDelay: 1.2,
  /** Click box refreshed every `proxyEvery` s while walking. */
  proxyEvery: 0.5,
};

/** Steps where he is off screen: title screen, arrival cutscene, opening, hug and end screen. */
const HIDDEN = new Set(['title', 'arrival', 'opening', 'hug', 'end']);

// Stride of each clip at rate 1 (Cat.js: WALK_STRIDE, TROT_STRIDE, RUN_STRIDE), so steps stay glued to the ground.
const STRIDE = { Walk: 3.2 / 0.67, Trot: 3.6 / 0.45, run: 4.0 / 0.25 };
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export class Chavalanche {
  /**
   * @param {object} o `npc` (Npc.js, chavalanche kind), `world`, `cat`, `story`, `snowCats` (SnowCats.js).
   */
  constructor({ npc, world, cat, story, snowCats }) {
    this.npc = npc; this.world = world; this.cat = cat; this.story = story; this.snowCats = snowCats;
    const H = CHAVALANCHE.home;
    this.home = { x: ZONE2.x + H.x, z: H.z, yaw: H.yaw };
    // Speed (m/s) of each clip at rate 1; the stride comes from the scale of the NPC model.
    const k = npc.model.scale.x;
    this.nat = {};
    for (const name of Object.keys(STRIDE)) this.nat[name] = npc.duration(name) ? STRIDE[name] * k / npc.duration(name) : 0;
    this.obstacle = {
      name: 'npc_chavalanche_0', x: this.home.x, z: this.home.z, hx: CHAVALANCHE.foot.hx, hz: CHAVALANCHE.foot.hz, rotY: H.yaw,
      top: 0, ground: 0, height: 0.6, climbable: false,
    };
    // Protector read by SnowCats: snowballs aim at `root` while `protecting` is true.
    this.guard = { root: npc.root, protecting: false };
    if (snowCats) { snowCats.protector = this.guard; snowCats.onBlocked = () => this._blocked(); }
    this.state = 'home';
    this.pts = [];         // trail of steps between him and the kitten
    this.gait = null;      // current clip: 'Idle' | 'Walk' | 'Trot' | 'run' | 'Flinch'
    this.speed = 0;        // current m/s
    this.rate = 1;         // clip rate
    this.blocks = 0;       // snowballs taken in place of the kitten (for tests)
    this.offered = false;
    this.stats = this._freshStats();
    this._t = 0; this._gaitT = 0; this._flinchT = 0; this._proxyT = 0; this._offerT = 0;
    this._lastCat = null;
    this._inZone = false;
    this._snap = false;    // place behind the kitten on the next frame in zone 2 (step skip)
    this._shield = null;   // last guard point (for tests)
    this.reset();
  }

  _freshStats() { return { frames: 0, moving: 0, gapSum: 0, gapMax: 0, gapMin: Infinity, lagMax: 0 }; }

  /** Run reset (Story.start, skipTo): seated at his place, obstacle placed, protection off, offer bubble available again. */
  reset() {
    this.offered = false; this._offerT = 0; this.blocks = 0; this.stats = this._freshStats();
    this._sitHome();
  }

  /** Seated at his place, no animation: initial state, and return after leaving over the bridge. */
  _sitHome() {
    const npc = this.npc, h = this.home;
    this.state = 'home'; this.pts.length = 0; this.gait = null; this.speed = 0; this._flinchT = 0; this._lastCat = null;
    this.guard.protecting = false; this._snap = false; this._shield = null;
    if (npc.pose !== npc.def.pose || !npc._frozen) npc.setPose(npc.def.pose, { instant: true });
    npc.setPosition(h.x, this._ground(h.x, h.z), h.z, h.yaw);
    this.obstacle.ground = this._ground(h.x, h.z);
    this.obstacle.top = this.obstacle.ground + this.obstacle.height;
    this._setObstacle(true);
    npc.root.visible = true;
  }

  /**
   * Step skip (Story.skipTo): `met` true (already met) means he is already following, placed behind the kitten from
   * the next frame in zone 2; false means seated at his place.
   */
  sync(met) {
    this.reset();
    if (!met) return;
    this._setObstacle(false);
    this.state = 'follow';
    this._snap = true;
  }

  /** End of his first speech bubble (Story): he gets up, then follows. */
  startFollow() {
    if (this.state !== 'home') return;
    this._setObstacle(false);
    this.state = 'rise'; this._t = 0;
    this.npc.setPose('Idle', { loop: true, fade: CHAVALANCHE.riseFade });
    this.gait = 'Idle';
  }

  /** Help request (a click on him after a fall, Story.talk): he takes the snowballs up to the summit. */
  protect(on = true) {
    this.guard.protecting = !!on && this.state !== 'home';
    this._shield = null;
  }

  get protecting() { return this.guard.protecting; }
  get falls() { return this.snowCats?.falls ?? 0; }
  /** He can help: already met, and enough falls (CLIMB.help.falls). */
  get canHelp() { return this.state !== 'home' && this.falls >= CLIMB.help.falls; }

  /** The kitten is on the summit ledge (or within 1 m of its edge): protection is over. */
  get atSummit() {
    const c = this.cat.root.position;
    return Math.hypot(c.x - (ZONE2.x + SUMMIT.x), c.z - SUMMIT.z) < SUMMIT.r + 1;
  }

  /** Read access for tests (`__chavalanche.info`). */
  get info() {
    const c = this.cat.root.position, p = this.npc.root.position;
    return {
      state: this.state, gait: this.gait, speed: +this.speed.toFixed(2), rate: +this.rate.toFixed(2), protecting: this.guard.protecting,
      dist: +Math.hypot(c.x - p.x, c.z - p.z).toFixed(2), gap: +this._gap(c).toFixed(2), pts: this.pts.length,
      blocks: this.blocks, offered: this.offered, falls: this.falls, visible: this.npc.root.visible,
      stats: { ...this.stats, gapMean: this.stats.moving ? +(this.stats.gapSum / this.stats.moving).toFixed(2) : null },
      shield: this._shield ? { ...this._shield } : null, nat: { ...this.nat },
    };
  }

  // ---------------------------------------------------------------- frame by frame

  update(dt) {
    const w = this.world, s = this.story;
    if (!w.inMountain) {
      if (this._inZone) { this._inZone = false; this._sitHome(); } // left over the bridge: back to his place
      return;
    }
    if (!this._inZone) { // arriving in the zone: its grid keeps the sitting obstacle if he is at his place
      this._inZone = true;
      if (this.state === 'home') this.cat.brain.refreshGrid(this.obstacle.x, this.obstacle.z, 2);
    }
    this.npc.root.visible = !HIDDEN.has(s.step);
    if (!this.npc.root.visible) return;
    const c = this.cat.root.position;
    if (this._snap) { this._snap = false; this._placeBehind(); }
    if (this.state === 'home') {
      if (s.met.chavalanche && !s._talking && Math.hypot(c.x - this.home.x, c.z - this.home.z) < CHAVALANCHE.resume) this.startFollow();
      return;
    }
    if (this.state === 'rise') { this._rise(dt); return; }
    if (this.state === 'wait') { this._wait(dt); return; }
    this._follow(dt);
    this._endProtection();
    this._offer(dt);
  }

  /** Gets up: Idle with a fade, facing the kitten, then `wait`. */
  _rise(dt) {
    this._t += dt;
    this._faceCat(dt);
    if (this._t >= CHAVALANCHE.riseFade) { this.state = 'wait'; this._t = 0; this.npc._updateProxy(); }
  }

  /** Standing: sets off as soon as the kitten is more than `CLIMB.chavalanche.start` m away. */
  _wait(dt) {
    this._t += dt;
    const c = this.cat.root.position, p = this.npc.root.position;
    this._faceCat(dt);
    if (this._t >= CHAVALANCHE.riseWait && Math.hypot(c.x - p.x, c.z - p.z) > CLIMB.chavalanche.start && this.story._talking !== this.npc) {
      this.state = 'follow'; this.pts.length = 0; this._lastCat = { x: c.x, z: c.z };
    }
  }

  _follow(dt) {
    const C = CHAVALANCHE, T = CLIMB.chavalanche, npc = this.npc;
    const c = this.cat.root.position, p = npc.root.position;
    // Kitten placed elsewhere in one jump (arrival at the foot, step skip): he places himself behind it.
    if (this._lastCat && Math.hypot(c.x - this._lastCat.x, c.z - this._lastCat.z) > C.teleport) {
      this._placeBehind(); this._lastCat = { x: c.x, z: c.z }; return;
    }
    this._lastCat = { x: c.x, z: c.z };
    const guard = this._guardGoal(c);
    if (guard) this.pts.length = 0; else this._feed(c, T.trail);
    // Flinch: he stays where he is.
    if (this._flinchT > 0) {
      this._flinchT -= dt;
      if (this._flinchT <= 0) this.gait = null; // the wanted gait resumes on the next frame
      else { this._faceCat(dt); this._frame(dt); return; }
    }
    const talking = this.story._talking === npc;
    const gap = this._gap(c);
    let gx, gz, lag;
    if (guard) { gx = guard.x; gz = guard.z; lag = Math.hypot(gx - p.x, gz - p.z); }
    else { const t = this.pts.length ? this.pts[0] : c; gx = t.x; gz = t.z; lag = gap - T.follow; }
    // Wanted speed (proportional control); stops below `stop`, starts beyond `go`.
    let want = talking ? 0 : clamp(lag * C.gain, 0, this.cat.runSpeed);
    if (lag < (this.speed > 0 ? C.stop : C.go)) want = 0;
    this._gait(want, dt);
    if (this.speed > 0) {
      const dx = gx - p.x, dz = gz - p.z, d = Math.hypot(dx, dz);
      if (d > 1e-4) {
        const yaw = Math.atan2(dx, dz);
        this._turnTo(yaw, C.turn, dt);
        if (Math.abs(wrap(yaw - npc.root.rotation.y)) < 0.9) { // facing the target: he advances (otherwise he pivots on the spot)
          const step = Math.min(this.speed * dt, d);
          let sx = dx / d * step, sz = dz / d * step;
          // Never through the kitten (guarding or following): close to it, remove the part of the step going towards it and go around.
          const ox = p.x - c.x, oz = p.z - c.z, od = Math.hypot(ox, oz);
          if (od < C.yieldR + 0.4 && od > 1e-4) {
            const inward = -(sx * ox + sz * oz) / od;
            if (inward > 0) { sx += inward * ox / od; sz += inward * oz / od; }
          }
          this._moveTo(p.x + sx, p.z + sz);
          if (!guard && step >= d - 1e-6 && this.pts.length) this.pts.shift();
        }
      } else if (!guard && this.pts.length) this.pts.shift();
    } else if (guard) this._turnTo(Math.atan2(guard.look.x - p.x, guard.look.z - p.z), C.look, dt);
    else this._faceCat(dt);
    this._yield(c, dt);
    this._frame(dt);
  }

  /** Follow statistics (tests), click box, ground pose: every walking frame. */
  _frame(dt) {
    const npc = this.npc, p = npc.root.position, c = this.cat.root.position, st = this.stats;
    st.frames++;
    if (this.speed > 0.05) {
      const gap = this._gap(c);
      st.moving++; st.gapSum += gap; st.gapMax = Math.max(st.gapMax, gap); st.gapMin = Math.min(st.gapMin, gap);
      st.lagMax = Math.max(st.lagMax, gap - CLIMB.chavalanche.follow);
    }
    if ((this._proxyT -= dt) <= 0) { this._proxyT = CHAVALANCHE.proxyEvery; npc._updateProxy(); }
    npc.setPosition(p.x, this._ground(p.x, p.z), p.z);
  }

  // ---------------------------------------------------------------- trail of steps

  /** Adds the kitten's position to the trail (one point every `step` m), erasing loops. */
  _feed(c, step) {
    const C = CHAVALANCHE, pts = this.pts, p = this.npc.root.position;
    const last = pts.length ? pts[pts.length - 1] : p;
    if (Math.hypot(c.x - last.x, c.z - last.z) < step) return;
    for (let j = pts.length - 1 - C.skip; j >= 0; j--) {
      if (Math.hypot(c.x - pts[j].x, c.z - pts[j].z) < C.erase) { pts.length = j + 1; return; }
    }
    if (Math.hypot(c.x - p.x, c.z - p.z) < C.erase) { pts.length = 0; return; } // back on him: no more trail
    pts.push({ x: c.x, z: c.z });
  }

  /** Length (m) of the trail from him to the kitten. */
  _gap(c) {
    const p = this.npc.root.position;
    let g = 0, x = p.x, z = p.z;
    for (const q of this.pts) { g += Math.hypot(q.x - x, q.z - z); x = q.x; z = q.z; }
    return g + Math.hypot(c.x - x, c.z - z);
  }

  // ---------------------------------------------------------------- gait

  /**
   * Clip and rate for the wanted speed `want` (m/s): Walk up to `CLIMB.chavalanche.walk`, Trot up to `.trot`, run
   * beyond. The rate is bounded (CHAVALANCHE.rate) and the real speed is the clip's.
   */
  _gait(want, dt) {
    const T = CLIMB.chavalanche, R = CHAVALANCHE.rate, npc = this.npc, cur = this.gait;
    this._gaitT += dt;
    let name = want <= 0 ? 'Idle' : want <= T.walk ? 'Walk' : want <= T.trot ? 'Trot' : 'run';
    if (name !== 'Idle' && !this.nat[name]) name = 'Idle';
    // No gait change more often than every 0.3 s when the wanted speed grazes a threshold.
    if (name !== cur && name !== 'Idle' && cur && cur !== 'Idle' && this._gaitT < 0.3) name = cur;
    if (name === 'Idle') {
      this.speed = 0;
      if (cur !== 'Idle') { npc.setPose('Idle', { loop: true, fade: 0.25 }); this.gait = 'Idle'; this._gaitT = 0; }
      return;
    }
    const rate = clamp(want / this.nat[name], R[name][0], R[name][1]);
    if (name !== cur) { npc.setPose(name, { loop: true, fade: 0.2, timeScale: rate }); this.gait = name; this._gaitT = 0; }
    else npc.action.setEffectiveTimeScale(rate);
    this.rate = rate;
    this.speed = this.nat[name] * rate;
  }

  // ---------------------------------------------------------------- protection

  /** Guard point (between the nearest snow cat within range and the kitten), or null if there is nothing to block. */
  _guardGoal(c) {
    if (!this.guard.protecting) { this._shield = null; return null; }
    let best = null, bd = CLIMB.snowCats.reach + 2;
    for (const b of this._snowCats()) {
      const d = Math.hypot(b.x - c.x, b.z - c.z);
      if (d < bd) { bd = d; best = b; }
    }
    if (!best) { this._shield = null; return null; }
    const sh = CLIMB.chavalanche.shield, d = bd || 1;
    const r = { x: 0, z: 0, hit: null };
    this.world.mountain.resolve(c.x + (best.x - c.x) / d * sh, c.z + (best.z - c.z) / d * sh, CHAVALANCHE.body, {}, r);
    this._shield = { x: +r.x.toFixed(2), z: +r.z.toFixed(2), snowCat: { x: +best.x.toFixed(1), z: +best.z.toFixed(1) } };
    return { x: r.x, z: r.z, look: best };
  }

  /** Positions {x, z} of the snow cats (list provided by SnowCats.js), empty if it is missing. */
  _snowCats() {
    return (this.snowCats?.list ?? []).map(({ x, z }) => ({ x, z }));
  }

  /** Protection ends at the summit ledge or on meeting Maman. */
  _endProtection() {
    if (!this.guard.protecting) return;
    if (this.atSummit || this.story.met.maman) this.guard.protecting = false;
  }

  /** A snowball has just hit him in the kitten's place (SnowCats callback): he flinches. */
  _blocked() {
    this.blocks++;
    if (this.state !== 'follow') return;
    // Behind the kitten, he keeps running: the 0.5 s stop would put him further behind (up to 9.7 m otherwise).
    if (this._gap(this.cat.root.position) > CHAVALANCHE.flinchGap) return;
    this._flinchT = CHAVALANCHE.flinch;
    this.speed = 0; this.gait = 'Flinch';
    this.npc.setPose('Flinch', { fade: 0.06, freezeAt: 0.7 });
  }

  /** After the first fall: one speech bubble saying that a click on him is enough (no button on screen). */
  _offer(dt) {
    const C = CHAVALANCHE, s = this.story, b = this.cat.brain;
    if (!C.offer || this.offered || this.falls < CLIMB.help.falls) return;
    if (b.scripted || b.jumping || s.bubble.isOpen || s._talking || s.crossing.fading || s._combat || s._open || s._shake) return;
    if ((this._offerT += dt) < C.offerDelay) return;
    const c = this.cat.root.position, p = this.npc.root.position;
    if (Math.hypot(c.x - p.x, c.z - p.z) > 6) return;
    if (s.talk('chavalanche', 'offer')) this.offered = true;
  }

  // ---------------------------------------------------------------- movement and pose

  _ground(x, z) { return this.story._ground(x, z); }

  /** Position for this frame: in the corridor, off obstacles (Maman). */
  _moveTo(x, z) {
    const r = { x, z, hit: null };
    this.world.mountain.resolve(x, z, CHAVALANCHE.body, {}, r);
    const p = this.npc.root.position;
    p.x = r.x; p.z = r.z;
  }

  /** Turns towards `yaw`, at most `rate` rad/s. */
  _turnTo(yaw, rate, dt) {
    const root = this.npc.root, d = wrap(yaw - root.rotation.y), m = rate * dt;
    root.rotation.y += Math.abs(d) <= m ? d : Math.sign(d) * m;
  }

  _faceCat(dt) {
    const c = this.cat.root.position, p = this.npc.root.position;
    if (Math.hypot(c.x - p.x, c.z - p.z) < 8) this._turnTo(Math.atan2(c.x - p.x, c.z - p.z), CHAVALANCHE.look, dt);
  }

  /**
   * A kitten walking on him pushes him aside (he has no obstacle): `yieldR` m of separation in one frame, opposite the
   * kitten; if the corridor or the ledge prevents that, sideways (the further of the two). The kitten is never hindered:
   * he is the one who moves.
   */
  _yield(c, dt = 0) {
    // Margin of one kitten step (it moves after him in the frame): the `yieldR` separation still holds after its step.
    const p = this.npc.root.position, R = CHAVALANCHE.yieldR + 0.05 + Math.min(this.cat.runSpeed * dt, 0.4);
    let dx = p.x - c.x, dz = p.z - c.z;
    const d = Math.hypot(dx, dz);
    if (d >= R) return;
    if (d < 1e-4) { dx = Math.sin(this.cat.root.rotation.y + Math.PI / 2); dz = Math.cos(this.cat.root.rotation.y + Math.PI / 2); }
    const n = Math.hypot(dx, dz) || 1;
    dx /= n; dz /= n;
    const x0 = p.x, z0 = p.z, tries = [[dx, dz], [-dz, dx], [dz, -dx]];
    let best = null;
    for (const [ux, uz] of tries) {
      this._moveTo(c.x + ux * R, c.z + uz * R);
      const q = Math.hypot(p.x - c.x, p.z - c.z);
      if (!best || q > best.q) best = { x: p.x, z: p.z, q };
      if (q >= R - 0.02) break;
      p.x = x0; p.z = z0;
    }
    p.x = best.x; p.z = best.z;
  }

  /** Behind the kitten at the follow distance, facing it (step skip, kitten placed elsewhere). */
  _placeBehind() {
    const npc = this.npc, c = this.cat.root.position, yaw = this.cat.root.rotation.y, f = CLIMB.chavalanche.follow;
    this.pts.length = 0;
    this._setObstacle(false);
    if (npc._frozen || this.state === 'home') { npc.setPose('Idle', { loop: true, instant: true }); }
    this.gait = 'Idle'; this.state = 'follow'; this.speed = 0;
    this._moveTo(c.x - Math.sin(yaw) * f, c.z - Math.cos(yaw) * f);
    const p = npc.root.position;
    npc.setPosition(p.x, this._ground(p.x, p.z), p.z, yaw);
    npc._updateProxy();
  }

  /** Sitting obstacle placed or removed, with the kitten's navigation grid kept up to date. */
  _setObstacle(on) {
    const o = this.obstacle, w = this.world, m = w.mountain;
    const lists = [m?.obstacles, m?.navObstacles, w._mountainObstacles].filter(Boolean);
    if (on === lists.some((l) => l.includes(o))) return;
    if (on) w.addMountainObstacles([o]);
    else for (const l of lists) { const i = l.indexOf(o); if (i >= 0) l.splice(i, 1); }
    if (w.inMountain) this.cat.brain.refreshGrid(o.x, o.z, 2);
  }
}
