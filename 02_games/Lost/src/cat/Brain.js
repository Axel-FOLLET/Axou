import * as THREE from 'three';
import { heightAt as terrainHeightAt } from '../world/Terrain.js';
import {
  MOVING_STATES, NAV, PLAY, PET_RISE, GOTO, PET_HEAD_HOLD, PET_LOOP, PET_FROM, PET_GLIDE, PET_HOLD, HUNT, FILLERS,
  POUNCE,
} from './brainTuning.js';
import { NavGrid } from './NavGrid.js';
import { smooth } from './brainMath.js';
import { navigation } from './brainNavigation.js';
import { mixin } from '../mixin.js';

/**
 * The cat's decision layer: a state machine (see the `Brain` class). Created by Cat.js; `update` runs every frame through
 * `cat.update`. Tuning tables are in brainTuning.js; moving to a goal, walls and jumps are in brainNavigation.js, added
 * through the `mixin` call at the end of this file.
 */

const _d = new THREE.Vector3();
const _p = new THREE.Vector3();
const between = ([a, b]) => a + Math.random() * (b - a);
const hdist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

/**
 * The cat's state machine: idle, walk, trot and run (gaits to a clicked point, GOTO), pet (petting), stretch, groom,
 * sit, lie, sleep, wake; the hunt: approach (walk to the prey), stalk, pounce; and the yarn ball: chase (run), bat
 * (push then short pause). It decides; it never touches the bones directly (that is Cat.js's job).
 *
 * Idle: a random activity after 8 to 20 s of calm (sometimes a hunt if a butterfly is perched nearby), sleep after
 * 60 s, a meow (callback) after 30 s. A click on the ground or the cat interrupts everything, petting included; a
 * sleeping cat first wakes up (`Wake` clip), then does what was asked.
 */
export class Brain {
  constructor(cat) {
    this.cat = cat;
    this.state = 'idle';
    this.target = null;
    this.pending = null;   // action requested while waking up: 'walk', 'pet' or 'hunt'
    this.quietSince = 0;   // seconds without interaction (all calm situations combined)
    this.stateTime = 0;    // seconds in the current state
    this.timer = 0;        // time left in a time-limited state
    this.nextFiller = this._drawFillerDelay();
    this.onMeow = null;
    this.onHunt = null;    // callback (result 'caught' | 'missed' | 'abandon', reason, butterfly)
    this._meowed = false;
    this.butterflies = null;
    this.prey = null;
    this._hunt = null;     // internal state of the current hunt
    this.yarn = null;
    this.fatigue = 0;      // throws "in stock" (yarn ball), decreases over time
    this.onPlay = null;    // callback ('chase' | 'bat' | 'tired' | 'ignored', info)
    this._play = null;
    // World: given by Cat.update (setWorld) on the first frame.
    this.world = null;
    this.ruins = null;
    this._groundAt = terrainHeightAt;
    this.onWall = false;   // root on top of a low wall
    this._jump = null;     // jump in progress (`jump` / `jumpdown` states)
    this._queued = null;   // order received during a jump, executed at landing
    this._nav = null;      // current path (waypoints) to the target
    this._grid = null;     // NavGrid, built on the first path cut by a high wall
    this._grids = new Map(); // grid of each zone (key: obstacle structure), kept for the way back
    // Scene (game/Story.js): brain off, player orders ignored (setScripted).
    this.scripted = false;
    // Conversation: the cat stays put while the speech bubble is open (setHold).
    this.hold = false;
    this.brisk = false; // trot as the minimum gait (combat), see _moveState
    this._dash = false; // current trip started by a double click (GOTO.dash), see walkTo
  }

  /**
   * Scripted scene: `state` (e.g. 'carried', 'lie', 'sleep') is played and held; no more thinking, jumping or
   * activities, and walkTo / pet / hunt / yarnThrown do nothing. `setScripted(null, next)` gives control back: `next`
   * = 'sleep' (sleeps until the next order) or 'idle'.
   */
  setScripted(state, next = 'idle') {
    if (state === null) {
      if (!this.scripted) return;
      this.scripted = false;
      this._interrupt();
      this.state = '';     // forces the state to restart (same name as the scene's)
      if (next === 'sleep') this.startFiller('sleep');
      else this._set('idle');
      return;
    }
    this._endHunt('scene');
    this._play = null;
    this.target = null; this._nav = null; this._jump = null; this._queued = null; this.pending = null;
    this.onWall = false;
    this.scripted = true;
    this.timer = Infinity;
    this._set(state);
  }

  /**
   * Conversation (Story.talk): `on` true freezes the cat in place while the speech bubble is open. walkTo / pet / hunt /
   * yarnThrown do nothing, no spontaneous activity, hunt or sleep; the current trip or play stops (a low-wall jump
   * finishes first, then the cat stops). `setHold(false)`: the cat resumes, at rest.
   */
  setHold(on) {
    on = !!on;
    if (on === this.hold) return;
    this.hold = on;
    this._interrupt();
    if (!on || this.scripted) return;
    this._endHunt('conversation', this.isHunting);
    this._play = null;
    this.target = null; this._nav = null; this._queued = null; this.pending = null;
    if (!this._jump && MOVING_STATES.has(this.state)) this._set('idle');
  }

  /** Butterfly swarm (critters/Butterflies.js), given by main.js. */
  setButterflies(b) { this.butterflies = b; }
  /** Yarn ball (critters/Yarn.js), given by main.js. It receives the world's walls (Yarn.setRuins). */
  setYarn(y) { this.yarn = y; const r = this.world?.ruins; if (r) y?.setRuins?.(r); }
  /**
   * World (scene/World.js): `terrain.heightAt` (ground) and `ruins` (walls, low walls). Called by Cat.update on the
   * first frame (main.js passes `world` to `cat.update`).
   */
  setWorld(world) {
    this.world = world;
    this.ruins = world?.navZone ?? world?.ruins ?? null;
    // Called when the meadow's obstacles changed (arena, boss): its grid will be rebuilt up to date.
    // The mountain zone's grid never changes.
    this._grids.delete(world?.ruins);
    this._grid = this._grids.get(this.ruins) ?? null;
    this._nav = null;
    const terrain = world?.terrain;
    this._groundAt = terrain ? (x, z) => terrain.heightAt(x, z) : terrainHeightAt;
    if (world?.ruins) this.yarn?.setRuins?.(world.ruins);
  }

  /**
   * Zone change (World.enterMountain, leaveMountain): obstacles, limits and grid of the active zone; no trip, hunt, play
   * or jump survives the change. Each zone's grid stays in memory; the mountain grid is built here, on entry, so its
   * cost does not land on a click.
   */
  setZone() {
    this._interrupt();
    this._endHunt('zone', this.isHunting);
    this._play = null;
    this.target = null; this._nav = null; this._jump = null; this._queued = null; this.pending = null;
    this.onWall = false;
    this.ruins = this.world?.navZone ?? this.ruins;
    this._grid = this._grids.get(this.ruins) ?? null;
    if (!this._grid && this.ruins?.corridor) {
      this._grid = new NavGrid(this.ruins, NAV);
      this._grids.set(this.ruins, this._grid);
    }
    if (!this.scripted && (MOVING_STATES.has(this.state) || this.state === 'jump' || this.state === 'jumpdown')) this._set('idle');
  }

  get isPlaying() { return this.state === 'chase' || this.state === 'bat'; }
  /** Weary: PLAY.tiredAt throws "in stock", within 0.5 (pauses between throws wear off a little). */
  get tired() { return this.fatigue > PLAY.tiredAt - 0.5; }

  /** Point the head follows during a hunt or play (otherwise null: the pointer). */
  get lookAt() {
    if (this.isPlaying && this.yarn) return this.yarn.position;
    return this.prey && this.isHunting ? this.prey.position : null;
  }
  get isHunting() { return this.state === 'approach' || this.state === 'stalk' || this.state === 'pounce'; }
  /** Pounce in the air (take-off to landing): other nearby butterflies fly off. */
  get pouncing() { return this.state === 'pounce' && !!this._hunt?.airborne; }

  _drawFillerDelay() { return 8 + Math.random() * 12; }

  /**
   * Ground click: walk, trot or run depending on the distance (GOTO). During petting, the lying cat rises first
   * (`_petRise`), then leaves (short fade in Cat.js). `run` (double click, Picker.js): runs at any distance (GOTO.dash);
   * kept through a jump (queued order), a wake-up or a petting rise.
   */
  walkTo(point, { run = false } = {}) {
    if (this.scripted || this.hold) return;
    if (this._jump) { this._queued = () => this.walkTo(point, { run }); return; }
    this._dash = !!run;
    this._endHunt('ground click');
    // Point brought into the zone (meadow: NAV.limit; mountain: path corridor) and out of high walls.
    this.target = this._clampGoal(new THREE.Vector3(point.x, point.y ?? 0, point.z));
    this._nav = null;
    this._interrupt();
    if (this._wakeFirst('walk')) return;
    if (this.state === 'pet' && this._petRise()) return;
    this._set(this._moveState());
  }

  /**
   * Ground click during petting (PET_RISE): sped-up rise of the `Pet` clip (Cat.onPetRise), root still, then leaves for
   * `target` when the timer ends (same path as waking: `pending` = 'walk'). Returns false if the cat is not lying yet
   * (immediate departure).
   */
  _petRise() {
    if (this.pending === 'walk') return true; // already rising: only the target changes
    const t = this.cat.actions?.Pet?.time ?? this.stateTime;
    if (t < PET_RISE.before) return false;
    const from = Math.max(t, PET_RISE.from);
    this.pending = 'walk';
    this._petMore = false;
    this._glide = null;
    this.timer = Math.max(0, PET_RISE.up - from) / PET_RISE.rate;
    this.cat.onPetRise?.(from, PET_RISE.rate);
    return true;
  }

  /**
   * Gait toward `target`: `run` beyond GOTO.runFrom, `trot` beyond GOTO.trotFrom, otherwise `walk`. `brisk` (combat, set
   * by combat.js Duel): at least a trot, so a close click is enough to dodge a telegraphed attack (walking at 0.52 m/s
   * covers only 0.6 m in 1.2 s).
   */
  _moveState() {
    const d = hdist(this.target, this.cat.root.position);
    if (this._dash) return d > GOTO.dash.trotAt ? 'run' : 'trot';
    const s = d > GOTO.runFrom ? 'run' : d > GOTO.trotFrom ? 'trot' : 'walk';
    return this.brisk && s === 'walk' ? 'trot' : s;
  }

  pet() {
    // Sword in the mouth (Cat.sword): no petting (the Pet clip lays the cat on the blade).
    if (this.scripted || this.hold || this.cat.sword) return;
    if (this._jump) { this._queued = () => this.pet(); return; }
    this._endHunt('petting');
    this.target = null;
    this._interrupt();
    if (this._wakeFirst('pet')) return;
    if (this.state === 'pet') {
      if (this.pending === 'walk') return; // rise toward the walk in progress
      // A new click during the head hold (PET_HEAD_HOLD) extends the petting: back to PET_LOOP[0] at once if the clip is
      // already in the matching pose, otherwise when it passes PET_LOOP[1] (`_updatePet`).
      const t = this.stateTime;
      if (t >= PET_HEAD_HOLD[0] && t < PET_HEAD_HOLD[1] - 0.5) {
        if (t >= PET_LOOP[1]) this._petJump(PET_LOOP[0]);
        else this._petMore = true;
      }
      return;
    }
    // Already seated or lying: enter the clip at the matching pose (no needless rise).
    const from = PET_FROM[this.state] ?? 0;
    // From a gait: the root keeps gliding for PET_GLIDE s while slowing, without crossing a wall or leaving the meadow
    // (_clampLeap).
    this._glide = null;
    const loco = this.cat.locomotion;
    if ((this.state === 'walk' || this.state === 'trot' || this.state === 'run') && loco?.moving) {
      const dir = { x: Math.sin(loco.heading), z: Math.cos(loco.heading) };
      const len = this._clampLeap(this.cat.root.position, dir, (loco.speed * PET_GLIDE) / 2);
      if (len > 0) this._glide = { dx: dir.x, dz: dir.z, len, t: 0, dur: PET_GLIDE };
    }
    this._petMore = false;
    this.pending = null;
    const hold = this.state === 'sit' || this.state === 'lie' ? PET_HOLD : 0;
    this.timer = this.cat.duration('Pet') - from + hold;
    this._set('pet');
    if (from) { this.stateTime = from - hold; this.cat.onPetTime?.(from, hold); }
  }

  /** Fraction of the gait speed left during the damped stop (1 to 0; 0 outside the stop). */
  get petGlide() { return this._glide ? Math.max(0, 1 - this._glide.t / this._glide.dur) : 0; }

  /** Brings the `Pet` clip back to time `t` (same pose as the time left) and resets the timer. */
  _petJump(t) {
    this.stateTime = t;
    this.timer = this.cat.duration('Pet') - t;
    this.cat.onPetTime?.(t);
  }

  /** Petting, every frame: extension when passing PET_LOOP[1], damped root stop. */
  _updatePet(dt) {
    // stateTime has already advanced by dt and the clip will advance by dt in Cat.update: set it to t − dt.
    if (this._petMore && this.stateTime >= PET_LOOP[1]) {
      this._petMore = false;
      const t = PET_LOOP[0] + (this.stateTime - PET_LOOP[1]);
      this._petJump(t);
      this.cat.onPetTime?.(t - dt);
    }
    const g = this._glide;
    if (!g) return;
    const u0 = Math.min(1, g.t / g.dur);
    g.t += dt;
    const u1 = Math.min(1, g.t / g.dur);
    // Speed v·(1 − u): distance covered len·(1 − (1 − u)²).
    const d = g.len * ((1 - u0) ** 2 - (1 - u1) ** 2);
    const root = this.cat.root.position;
    root.x += g.dx * d;
    root.z += g.dz * d;
    if (u1 >= 1) this._glide = null;
  }

  /**
   * Click on a butterfly: the cat hunts it if it is perched and within HUNT.maxDist. Returns false otherwise (click
   * consumed with no effect). Ignored during petting.
   */
  hunt(b) {
    // Sword in the mouth (combat, Cat.sword): no hunt, the Pounce clip does not hold the sword.
    if (this.scripted || this.hold || this.cat.sword || !this.butterflies || !b || this.state === 'pet' || this.world?.inArena || this.world?.inMountain) return false;
    if (this._jump) { this._queued = () => this.hunt(b); return true; }
    if (b.state !== 'perched' || hdist(b.position, this.cat.root.position) > HUNT.maxDist) return false;
    if (this.isHunting && this.prey === b) return true;
    this._interrupt();
    this.target = null;
    if (this.state === 'sleep' || this.state === 'wake') {
      if (!this.butterflies.target(b)) return false;
      this.prey = b;
      this._wakeFirst('hunt');
      return true;
    }
    return this._startHunt(b);
  }

  /**
   * Yarn ball thrown (or clicked): the cat runs after it unless it is asleep, waking, being petted or hunting a
   * butterfly (nothing is interrupted), or weary (it lies down). Returns true if the cat goes off to play.
   */
  yarnThrown() {
    if (this.scripted) { this.onPlay?.('ignored', 'scene'); return false; }
    if (this.hold) { this.onPlay?.('ignored', 'conversation'); return false; }
    if (this.cat.sword) { this.onPlay?.('ignored', 'sword'); return false; }
    if (this._jump) { this._queued = () => this.yarnThrown(); return true; }
    const s = this.state;
    if (!this.yarn || this.world?.inMountain || s === 'pet' || s === 'sleep' || s === 'wake' || this.isHunting) {
      this.onPlay?.('ignored', s);
      return false;
    }
    if (this.tired) {
      // Weary: it no longer runs; it lies down (`lie` state) or stays lying.
      this._interrupt();
      this.target = null;
      this._endPlay();
      return false;
    }
    this.fatigue += 1;
    this._interrupt();
    this.target = null;
    const [a, b] = PLAY.bats;
    this._play = { bats: a + Math.floor(Math.random() * (b - a + 1)), done: 0 };
    this._nav = null;
    if (s === 'chase') return true;
    this._set('chase');
    this.onPlay?.('chase', this.fatigue);
    return true;
  }

  /** End of play: rest, or lie down if the cat is weary. */
  _endPlay() {
    this._play = null;
    if (this.tired) {
      this.timer = PLAY.lieTime;
      this._set('lie');
      this.onPlay?.('tired', this.fatigue);
    } else this._set('idle');
  }

  _updatePlay(dt) {
    const y = this.yarn;
    const root = this.cat.root.position;
    const d = y.distanceTo(root);
    if (this.state === 'bat') {
      this.timer -= dt;
      this._aim(dt, 3, y.position);
      if (this.timer > 0) return;
      if (this._play && this._play.done < this._play.bats && d < PLAY.maxDist) this._set('chase');
      else this._endPlay();
      return;
    }
    if (this.stateTime > PLAY.chaseMax || d > PLAY.maxDist || !this._play) { this._endPlay(); return; }
    if (d <= PLAY.reach) {
      if (y.state === 'air') { this._aim(dt, 4, y.position); return; } // still bouncing: wait, facing it
      // Push with the muzzle or front paw, along the root-to-ball axis (the head, ≈ 0.3 m in front of the root, may
      // already be past the ball's centre at this distance, which would invert the direction).
      y.nudge(root, between(PLAY.strength));
      this._play.done += 1;
      this.timer = PLAY.batTime;
      this._set('bat');
      this.onPlay?.('bat', this._play.done);
      return;
    }
    // Slows down as for a ground click (GOTO.trotAt, GOTO.walkAt); speeds back up if the ball moves more than PLAY.regain m
    // beyond the threshold (no jerkiness).
    const g = this.cat._chaseGait;
    const gait = d <= GOTO.walkAt ? 'walk'
      : d <= GOTO.trotAt ? (g === 'walk' && d <= GOTO.walkAt + PLAY.regain ? 'walk' : 'trot')
      : g && g !== 'run' && d <= GOTO.trotAt + PLAY.regain ? 'trot' : 'run';
    this.cat.setChaseGait?.(gait);
    _p.set(y.position.x, y.position.y, y.position.z);
    if (this._navigate(_p, dt, { dynamic: true }) === 'blocked') this._endPlay();
  }

  _startHunt(b) {
    if (this.isHunting) this._endHunt(null, false);
    if (!this.butterflies.target(b)) return false;
    this.prey = b;
    this._nav = null;
    const d = hdist(b.position, this.cat.root.position);
    this._hunt = { best: d, bestAt: 0, phase: 'freeze', left: between(HUNT.firstFreeze), clock: 0,
      hold: 0, held: false, airborne: false, landed: false, start: null, leap: 0 };
    this._set(d > HUNT.stalkDist ? 'approach' : 'stalk');
    return true;
  }

  /** End of a hunt without a pounce (with a reason) or cleanup after the pounce. */
  _endHunt(reason, toIdle = false) {
    if (!this.prey && !this.isHunting && this.pending !== 'hunt') return;
    if (this.pending === 'hunt') this.pending = null;
    const prey = this.prey;
    if (prey && prey.targeted) this.butterflies?.untarget();
    this.prey = null;
    this.cat.freeze?.(false);
    if (reason && !this._hunt?.landed) this.onHunt?.('abandon', reason, prey);
    this._hunt = null;
    if (toIdle) this._set('idle');
  }

  _preyValid() { return this.prey && this.prey.state === 'perched' && this.prey.targeted; }

  /** Starts an activity: 'stretch', 'groom', 'sit', 'lie' or 'sleep'. */
  startFiller(name) {
    if (!(name in FILLERS) && name !== 'sleep') return;
    if (this._jump) return;
    this._endHunt('forced activity'); // console call during a hunt
    const d = FILLERS[name];
    this.timer = d === undefined ? Infinity : typeof d === 'number' ? d : this.cat.duration(d);
    this._set(name);
  }

  /** Asleep (or waking): remembers the action and goes through the wake-up. */
  _wakeFirst(action) {
    if (this.pending === 'hunt' && action !== 'hunt') { this.butterflies?.untarget(); this.prey = null; }
    if (this.state === 'sleep') {
      this.pending = action;
      this.timer = this.cat.duration('Wake');
      this._set('wake');
      return true;
    }
    if (this.state === 'wake') { this.pending = action; return true; }
    return false;
  }

  _interrupt() {
    this.quietSince = 0;
    this._meowed = false;
    this.nextFiller = this._drawFillerDelay();
  }

  _set(state) {
    if (this.state === state) return;
    this.state = state;
    this.stateTime = 0;
    this.cat.onStateChange(state);
  }

  /** Turns the root in place toward the prey (or `target`); returns the heading error left (rad). */
  _aim(dt, rate = 3, target = this.prey.position) {
    const loco = this.cat.locomotion;
    _d.copy(target).sub(this.cat.root.position);
    let diff = Math.atan2(_d.x, _d.z) - loco.heading;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    loco.heading += Math.sign(diff) * Math.min(Math.abs(diff), rate * dt);
    this.cat.root.rotation.y = loco.heading;
    return Math.abs(diff);
  }

  _updateHunt(dt) {
    const h = this._hunt;
    const root = this.cat.root.position;
    if (this.state !== 'pounce' || !h.airborne && !h.landed) {
      // Before take-off: the prey must stay perched and targeted, within reach, and the cat must make progress.
      if (!this._preyValid()) return this._endHunt('butterfly gone', true);
      const d = hdist(this.prey.position, root);
      if (d > HUNT.maxDist) return this._endHunt('too far', true);
      if (d < h.best - 0.05) { h.best = d; h.bestAt = this.stateTime; }
      if (this.state === 'approach') {
        if (this.stateTime > HUNT.approachMax) return this._endHunt('approach too long', true);
        if (this.stateTime - h.bestAt > HUNT.noProgress) return this._endHunt('blocked', true);
        if (d <= HUNT.stalkDist) { h.bestAt = 0; h.best = d; return this._set('stalk'); }
        _p.copy(this.prey.position);
        this._navigate(_p, dt, { dynamic: true }); // a low wall on the way: jump, then resume the approach
        return;
      }
      if (this.state === 'stalk') {
        if (this.stateTime > HUNT.stalkMax) return this._endHunt('stalk too long', true);
        if (this.stateTime - h.bestAt > HUNT.noProgress) return this._endHunt('blocked', true);
        if (d <= HUNT.pounceDist) {
          // Close enough: frozen, finish aligning, then pounce.
          this.cat.freeze(true);
          if (this._aim(dt) < HUNT.aimTol) this._startPounce(d);
          return;
        }
        h.left -= dt;
        if (h.left <= 0) {
          h.phase = h.phase === 'move' ? 'freeze' : 'move';
          h.left = between(h.phase === 'move' ? HUNT.move : HUNT.freeze);
        }
        this.cat.freeze(h.phase === 'freeze');
        if (h.phase === 'freeze') { this._aim(dt, 1.5); return; }
        _p.copy(this.prey.position);
        // No jump while stalking: a low wall between the cat and the prey ends the hunt.
        if (this._navigate(_p, dt, { dynamic: true, canJump: false }) === 'blocked') return this._endHunt('lowWall', true);
        return;
      }
    }
    if (this.state === 'pounce') this._updatePounce(dt);
  }

  _startPounce(d) {
    const h = this._hunt;
    h.dist = d;
    h.clock = 0;
    h.hold = between(HUNT.prepExtra);
    h.held = false;
    this._set('pounce');
    this.cat.freeze(false);
  }

  _updatePounce(dt) {
    const h = this._hunt;
    const cat = this.cat;
    // Raw GLB times (POUNCE), no scaling: the clip lasts POUNCE.end.
    // Extra crouch held (frozen clip): the pounce clock stops.
    if (!h.held && h.clock >= POUNCE.crouch) {
      if (h.hold > 0) { h.hold -= dt; cat.freeze(true); this._aim(dt, 1.5); return; }
      h.held = true;
      cat.freeze(false);
    }
    h.clock += dt;
    const t = h.clock;
    if (!h.airborne && !h.landed && t < POUNCE.launch) { this._aim(dt, 1.5); return; }
    if (!h.airborne && !h.landed) {
      // Take-off: the root will advance so as to land the front paws on the prey.
      cat.root.updateMatrixWorld(true);
      cat.pawPoint(_p);
      _d.set(Math.sin(cat.locomotion.heading), 0, Math.cos(cat.locomotion.heading));
      const pawAhead = _p.sub(cat.root.position).dot(_d);
      const preyAhead = _p.copy(this.prey.position).sub(cat.root.position).setY(0).dot(_d);
      h.leap = THREE.MathUtils.clamp(preyAhead - pawAhead + HUNT.pawShift, 0, HUNT.maxLeap);
      h.start = cat.root.position.clone();
      h.dir = _d.clone();
      h.leap = this._clampLeap(h.start, h.dir, h.leap);
      h.airborne = true;
    }
    if (h.airborne) {
      const u = Math.min(1, (t - POUNCE.launch) / (POUNCE.land - POUNCE.launch));
      const y = cat.root.position.y; // height: ground or low wall top (_settle)
      cat.root.position.copy(h.start).addScaledVector(h.dir, h.leap * smooth(u)).setY(y);
      if (u >= 1) {
        h.airborne = false;
        h.landed = true;
        cat.root.updateMatrixWorld(true);
        const paw = cat.pawPoint(new THREE.Vector3());
        const prey = this.prey;
        const result = this.butterflies.pounce(prey, paw, { catchChance: HUNT.catchChance });
        h.result = result;
        h.pawDist = hdist(paw, prey.position);
        h.pawErr = _d.copy(paw).sub(prey.position).setY(0).dot(h.dir); // > 0: paw past the prey
        this.prey = null;
        this.onHunt?.(result, null, prey);
      }
      return;
    }
    const end = (cat.duration('Pounce') || POUNCE.end) + HUNT.after;
    if (t >= end) { this._hunt = null; this._set('idle'); }
  }

  update(dt) {
    // Scene: the root is placed by Story (carrying: Cat.js sticks the nape to the mouth).
    if (this.scripted) { this.stateTime += dt; if (!this.cat.carryAnchor) this._settle(dt); return; }
    if (this._jump) { this.stateTime += dt; this._updateJump(dt); return; }
    this._think(dt);
    if (!this._jump) this._settle(dt);
  }

  _think(dt) {
    this.stateTime += dt;
    // Weariness wears off only out of play (otherwise a long run erases part of the throw).
    if (this.fatigue > 0 && !this.isPlaying) this.fatigue = Math.max(0, this.fatigue - dt / PLAY.recover);
    if (this.isHunting) { this._updateHunt(dt); return; }
    // Conversation: play and the current trip are stopped by setHold (rest on the spot).
    if (this.hold && (this.isPlaying || MOVING_STATES.has(this.state))) { this.target = null; this._nav = null; this._play = null; this._set('idle'); return; }
    if (this.isPlaying) { if (this.yarn) this._updatePlay(dt); else this._set('idle'); return; }
    if (this.state === 'walk' || this.state === 'trot' || this.state === 'run') {
      // Slowing: run to trot at GOTO.trotAt from the point, trot to walk at GOTO.walkAt (fades in Cat.js).
      // Double click: GOTO.dash thresholds.
      const left = hdist(this.target, this.cat.root.position);
      const slow = this._dash ? GOTO.dash : GOTO;
      if (this.state === 'run' && left <= slow.trotAt) this._set('trot');
      if (this.state === 'trot' && left <= slow.walkAt) this._set('walk');
      const r = this._navigate(this.target, dt);
      if (r === 'arrived' || r === 'blocked') { this.target = null; this._nav = null; this._set('idle'); }
      return;
    }
    if (this.state === 'pet' || this.state === 'wake') {
      if (this.state === 'pet') this._updatePet(dt);
      this.timer -= dt;
      if (this.timer > 0) return;
      const next = this.pending;
      this.pending = null;
      if (next === 'walk' && this.target) this._set(this._moveState());
      else if (next === 'pet') { this.state = 'idle'; this.pet(); }
      else if (next === 'hunt' && this.prey) {
        const b = this.prey;
        this.prey = null;
        if (b.state !== 'perched' || !this._startHunt(b)) {
          this.butterflies.untarget();
          this.onHunt?.('abandon', 'butterfly gone', b);
          this._set('idle');
        }
      } else this._set('idle');
      return;
    }

    // Calm situations: idle and activities.
    this.quietSince += dt;
    if (this.quietSince > 30 && !this._meowed) { this._meowed = true; this.onMeow?.(); }
    if (this.state === 'sleep') return;
    if (this.state !== 'idle') {
      this.timer -= dt;
      if (this.timer <= 0) this._set('idle');
      return;
    }
    // Conversation, or sword in the mouth (Cat.sword, combat): no spontaneous sleep, activity or hunt (none of these
    // clips holds the sword).
    if (this.hold || this.cat.sword) return;
    if (this.quietSince > 60) { this.startFiller('sleep'); return; }
    this.nextFiller -= dt;
    if (this.nextFiller <= 0) {
      this.nextFiller = this._drawFillerDelay();
      if (this._spontaneousHunt()) return;
      const names = Object.keys(FILLERS);
      this.startFiller(names[Math.floor(Math.random() * names.length)]);
    }
  }

  /** "Hunt" activity: a perched, low butterfly, neither too close nor too far, and a bit of luck. */
  _spontaneousHunt() {
    // Arena (World.inArena): butterflies hidden until the set is rendered, so no hunt.
    if (!this.butterflies || this.world?.inArena || this.world?.inMountain || Math.random() >= HUNT.chance) return false;
    const root = this.cat.root.position;
    let best = null, bestD = HUNT.spotRadius;
    for (const b of this.butterflies.perched()) {
      const d = hdist(b.position, root);
      const above = b.position.y - this._groundAt(b.position.x, b.position.z); // height above the ground
      if (d >= HUNT.minDist && d <= bestD && above <= HUNT.maxPreyY) { best = b; bestD = d; }
    }
    return best ? this._startHunt(best) : false;
  }

  // ---------------------------------------------------------------- world: ground, limit, walls

}

mixin(Brain, navigation);
