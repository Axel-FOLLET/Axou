import * as THREE from 'three';
import { STEP_RISE_MAX } from '../world/Ruins.js';
import { NAV, JUMP, JUMP_DOWN } from './brainTuning.js';
import { NavGrid } from './NavGrid.js';
import { smooth } from './brainMath.js';

/** Brain methods that move the cat to a goal: path-finding, walls, jumps and landing. */

const _d = new THREE.Vector3();

const _p = new THREE.Vector3();

const _q = new THREE.Vector3();

const _res = { x: 0, z: 0, hit: null };

const clamp01 = (u) => Math.min(1, Math.max(0, u));

const lerp = (a, b, u) => a + (b - a) * u;

export const navigation = {
  /** Jump in progress (up onto a low wall or down). */
  get jumping() { return !!this._jump; },

  /** Waypoints left to the target (tests: `__cat.brain.path`). */
  get path() { return this._nav?.pts ?? null; },

  /** Brings `v` (x, z) into the meadow's NAV.limit disc; in the mountain zone, `ruins.resolve` holds the corridor. */
  _toDisk(v) {
    if (this.ruins?.corridor) return;
    const r = Math.hypot(v.x, v.z);
    if (r > NAV.limit) { v.x *= NAV.limit / r; v.z *= NAV.limit / r; }
  },

  /** Brings `v` (x, z) into the zone and out of obstacles (unless it is on top of a low wall). Returns `v`. */
  _clampGoal(v) {
    this._toDisk(v);
    const ruins = this.ruins;
    if (ruins) {
      // On a walkable surface (low wall, step, top of a high wall): keep the point, only obstacles taller than that
      // surface push it. Otherwise: out of any footprint.
      const top = ruins.walkableAt(v.x, v.z, 0);
      ruins.resolve(v.x, v.z, NAV.radius, top !== null ? { y: top, climbable: false } : {}, _res);
      // A step against the high wall: the wall's push must not take the goal off the step.
      if (top === null || ruins.walkableAt(_res.x, _res.z, 0) !== null) { v.x = _res.x; v.z = _res.z; }
      this._toDisk(v);
    }
    return v;
  },

  /**
   * Obstacle rotated or moved in place (boss footprint, combat.js Duel): cells of the square of half-side `r` around
   * (x, z) recomputed if the grid exists (otherwise it will be built up to date).
   */
  refreshGrid(x, z, r) {
    this._grid?.refresh(x, z, r);
  },

  _blockedHigh(ax, az, bx, bz) {
    return !!this.ruins.blockedSegment(ax, az, bx, bz, NAV.radius, { climbable: false });
  },

  /**
   * Waypoints from a to b: a straight line if no high wall cuts it, otherwise the A* grid path shortened (keeps the
   * farthest visible point), ending at b.
   */
  _plan(ax, az, bx, bz) {
    if (!this._blockedHigh(ax, az, bx, bz)) return [{ x: bx, z: bz }];
    if (!this._grid) { this._grid = new NavGrid(this.ruins, NAV); this._grids.set(this.ruins, this._grid); }
    const cells = this._grid.find(ax, az, bx, bz);
    if (!cells || !cells.length) return [{ x: bx, z: bz }];
    cells[cells.length - 1] = { x: bx, z: bz };
    const out = [];
    const sight = this.ruins.sightCells ?? Infinity;
    let cx = ax, cz = az, k = 0;
    while (k < cells.length) {
      let far = k;
      for (let m = Math.min(cells.length - 1, k + sight); m > k; m--) {
        if (!this._blockedHigh(cx, cz, cells[m].x, cells[m].z)) { far = m; break; }
      }
      out.push(cells[far]);
      cx = cells[far].x; cz = cells[far].z;
      k = far + 1;
    }
    return out;
  },

  /**
   * One step toward `goal`, taking the world into account. Returns 'arrived', 'moving', 'jump' (jump started: `jump` or
   * `jumpdown` state) or 'blocked' (no progress for NAV.stuck s, or jump refused by `canJump`). `dynamic`: moving target
   * (path recomputed at most every NAV.repath s, no giving up for lack of progress).
   */
  _navigate(goal, dt, { dynamic = false, canJump = true } = {}) {
    const root = this.cat.root.position;
    const loco = this.cat.locomotion;
    const g = this._clampGoal(_q.set(goal.x, 0, goal.z));
    if (!this.ruins) {
      const arrived = loco.stepToward(g, dt);
      this._afterStep();
      return arrived ? 'arrived' : 'moving';
    }

    // High walls with rubble: step by step up to the top, and back.
    const ruins = this.ruins;
    const goalSurf = ruins.surfaceAt(g.x, g.z, 0);
    const route = goalSurf ? ruins.stepsTo(goalSurf) : null;
    const goalChain = route?.at(-1).chain ?? null;
    const curSurf = this.onWall ? ruins.surfaceAt(root.x, root.z, 0) : null;
    const curChain = curSurf?.chain ?? null;
    const chain = curChain ?? goalChain;
    if (chain) {
      const seq = chain.steps.concat(chain.top);
      const i = curChain ? seq.indexOf(curSurf) : -1;
      // Goal on another chain, a low wall or the ground: go down first (j = −1).
      const j = goalChain === chain ? route.length - 1 : -1;
      if (i === -1 && j >= 0) {
        // On the ground (or a low wall): go to the foot of the chain (the grid never aims at the top of a wall).
        const foot = chain.foot;
        if (Math.hypot(foot.x - root.x, foot.z - root.z) >= NAV.pass) {
          const r = this._navigateFlat(foot, dt, { dynamic, canJump });
          if (r !== 'arrived') return r;
          if (this.onWall) return 'moving';
        }
        const land = ruins.nearestOn(seq[0], root.x, root.z, seq[0].kind === 'top' ? 0.2 : 0.12);
        if (land.y - root.y > STEP_RISE_MAX + 0.02) return 'blocked';
        if (!canJump) return 'blocked';
        this._startJump('jump', land);
        return 'jump';
      }
      if (i >= 0 && i === j) {
        const arrived = loco.stepToward(_p.set(g.x, 0, g.z), dt);
        this._afterStep();
        return arrived ? 'arrived' : 'moving';
      }
      if (i >= 0 && i < j) {
        if (!canJump) return 'blocked';
        const next = seq[i + 1];
        this._startJump('jump', ruins.nearestOn(next, root.x, root.z, next.kind === 'top' ? 0.2 : 0.12));
        return 'jump';
      }
      if (i >= 0 && i > j) {
        if (!canJump) return 'blocked';
        if (i >= 1) {
          const land = ruins.nearestOn(seq[i - 1], root.x, root.z, 0.12);
          this._startJump('jumpdown', land, { y1: land.y, stayOnTop: true });
        } else this._startJump('jumpdown', chain.foot);
        return 'jump';
      }
    }
    return this._navigateFlat(g, dt, { dynamic, canJump });
  },

  /** Navigation outside step chains: ground, going around high walls, low-wall jumps. */
  _navigateFlat(goal, dt, { dynamic = false, canJump = true } = {}) {
    const root = this.cat.root.position;
    const loco = this.cat.locomotion;
    const g = goal === _q ? _q : this._clampGoal(_q.set(goal.x, 0, goal.z));

    let nav = this._nav;
    if (!nav) nav = this._nav = { gx: NaN, gz: NaN, pts: null, age: Infinity, t: 0, best: Infinity, bestAt: 0 };
    nav.age += dt; nav.t += dt;
    if (!(Math.hypot(nav.gx - g.x, nav.gz - g.z) <= 0.05)) {
      if (!this._blockedHigh(root.x, root.z, g.x, g.z)) nav.pts = [{ x: g.x, z: g.z }];
      else if (!nav.pts || nav.age >= NAV.repath || nav.pts.length <= 1) { nav.pts = this._plan(root.x, root.z, g.x, g.z); nav.age = 0; }
      else nav.pts[nav.pts.length - 1] = { x: g.x, z: g.z };
      nav.gx = g.x; nav.gz = g.z;
    }
    while (nav.pts.length > 1 && Math.hypot(nav.pts[0].x - root.x, nav.pts[0].z - root.z) < NAV.pass) nav.pts.shift();
    const wp = nav.pts[0];
    const last = nav.pts.length === 1;
    const ruins = this.ruins;

    // Low walls: climb up if the path crosses them or the target is on top; come down at the edge.
    if (!this.onWall) {
      const hit = ruins.blockedSegment(root.x, root.z, wp.x, wp.z, NAV.radius, { y: root.y });
      if (hit && hit.obstacle.climbable) {
        const len = Math.hypot(wp.x - root.x, wp.z - root.z);
        const land = this._landingOnWall(root, wp, last);
        if (land && (hit.t * len <= NAV.touch || Math.hypot(land.x - root.x, land.z - root.z) <= NAV.jumpReach)) {
          if (!canJump) return 'blocked';
          this._startJump('jump', land);
          return 'jump';
        }
      }
    } else if (ruins.walkableAt(wp.x, wp.z, 0) === null) {
      _d.set(wp.x - root.x, 0, wp.z - root.z);
      const len = _d.length();
      if (len > 1e-4) {
        _d.divideScalar(len);
        const ahead = Math.max(0.06, loco.speed * dt * 2);
        if (ruins.walkableAt(root.x + _d.x * ahead, root.z + _d.z * ahead, NAV.topMargin * 0.5) === null) {
          if (!canJump) return 'blocked';
          this._startJump('jumpdown', this._landingOffWall(root, _d));
          return 'jump';
        }
      }
    }

    const arrived = loco.stepToward(_p.set(wp.x, 0, wp.z), dt) && last;
    this._afterStep();
    if (arrived) return 'arrived';
    // Mountain zone: a switchback moves away from the goal as the crow flies, so progress is read on the remaining path.
    const dist = this.ruins?.corridor ? this._routeLeft(root, nav.pts) : Math.hypot(g.x - root.x, g.z - root.z);
    if (dist < nav.best - 0.05) { nav.best = dist; nav.bestAt = nav.t; }
    if (!dynamic && nav.t - nav.bestAt > NAV.stuck) return 'blocked';
    return 'moving';
  },

  /** Length (m) of the remaining path, from `root` to the last point of `pts`. */
  _routeLeft(root, pts) {
    let sum = 0, x = root.x, z = root.z;
    for (const p of pts) { sum += Math.hypot(p.x - x, p.z - z); x = p.x; z = p.z; }
    return sum;
  },

  /** After a step: the body is pushed out of walls (except those it is above) and stays in the zone. */
  _afterStep() {
    const root = this.cat.root.position;
    if (this.ruins) {
      this.ruins.resolve(root.x, root.z, NAV.radius, { y: this.onWall ? root.y + 0.1 : root.y }, _res);
      root.x = _res.x; root.z = _res.z;
    }
    this._toDisk(root);
  },

  /**
   * Landing point of a jump onto a low wall, along root to `wp`: the middle of the crossed top (at most 0.25 m past the
   * edge), or `wp` itself if it is on the wall (`last`). null if the segment crosses no walkable top.
   */
  _landingOnWall(root, wp, last) {
    const ruins = this.ruins;
    const dx = wp.x - root.x, dz = wp.z - root.z;
    const len = Math.hypot(dx, dz);
    if (len < 1e-4) return null;
    const ux = dx / len, uz = dz / len;
    const span = Math.min(len, 2.5);
    let e0 = -1, e1 = -1;
    for (let s = 0; s <= span + 1e-6; s += 0.03) {
      const ok = ruins.walkableAt(root.x + ux * s, root.z + uz * s, NAV.topMargin) !== null;
      if (ok && e0 < 0) e0 = s;
      if (ok) e1 = s;
      else if (e0 >= 0) break;
    }
    if (e0 < 0) return null;
    let s = e0 + Math.min(0.25, (e1 - e0) / 2);
    if (last && len <= e1 + 0.03 && ruins.walkableAt(wp.x, wp.z, 0) !== null) s = Math.min(Math.max(len, e0), e1);
    return { x: root.x + ux * s, z: root.z + uz * s };
  },

  /** Landing point of a downward jump along `dir`: first free point (no low wall, no wall) between NAV.down[0] and [1]. */
  _landingOffWall(root, dir) {
    const ruins = this.ruins;
    for (let s = NAV.down[0]; s <= NAV.down[1] + 1e-6; s += 0.05) {
      const x = root.x + dir.x * s, z = root.z + dir.z * s;
      if (!ruins.corridor && Math.hypot(x, z) > NAV.limit) break;
      if (ruins.walkableAt(x, z, 0) === null && !ruins.obstacleAt(x, z, NAV.radius)) return { x, z };
    }
    return { x: root.x + dir.x * 0.6, z: root.z + dir.z * 0.6 };
  },

  /**
   * Starts `jump` (up onto a low wall or a step, landing `to`) or `jumpdown` (down, landing `to`). `y1` / `stayOnTop`:
   * descent from a step to the step below (landing at `y1`, the cat stays on the step chain).
   */
  _startJump(kind, to, { y1: y1Down, stayOnTop } = {}) {
    const root = this.cat.root.position;
    const y1 = kind === 'jump'
      ? (this.ruins.walkableAt(to.x, to.z, 0) ?? to.y ?? root.y + 0.42)
      : (y1Down ?? this._groundAt(to.x, to.z));
    this._jump = { kind, t: 0, from: root.clone(), to: { x: to.x, z: to.z }, y0: root.y, y1,
      onTop: kind === 'jumpdown' && !!stayOnTop, resume: this.state };
    this._set(kind);
  },

  _updateJump(dt) {
    const j = this._jump;
    const root = this.cat.root.position;
    const t = (j.t += dt);
    if (j.kind === 'jump') {
      if (t < JUMP.rise) this._aim(dt, 4, _p.set(j.to.x, 0, j.to.z));
      const u = smooth(clamp01((t - JUMP.rise) / (JUMP.top - JUMP.rise)));
      root.x = lerp(j.from.x, j.to.x, u); root.z = lerp(j.from.z, j.to.z, u);
      if (t <= JUMP.rise) root.y = j.y0;
      else if (t <= JUMP.front) root.y = lerp(j.y0, j.y1 - JUMP.frontDrop, smooth((t - JUMP.rise) / (JUMP.front - JUMP.rise)));
      else root.y = lerp(j.y1 - JUMP.frontDrop, j.y1, clamp01((t - JUMP.front) / (JUMP.top - JUMP.front)));
      if (t >= (this.cat.duration('Jump') || JUMP.end)) this._endJump();
    } else {
      if (t < JUMP_DOWN.go) this._aim(dt, 4, _p.set(j.to.x, 0, j.to.z));
      const u = smooth(clamp01((t - JUMP_DOWN.go) / (JUMP_DOWN.stop - JUMP_DOWN.go)));
      root.x = lerp(j.from.x, j.to.x, u); root.z = lerp(j.from.z, j.to.z, u);
      const ground = j.onTop ? j.y1 : this._groundAt(root.x, root.z);
      if (t <= JUMP_DOWN.leave) root.y = j.y0;
      else if (t < JUMP_DOWN.ground) root.y = lerp(j.y0, ground, smooth((t - JUMP_DOWN.leave) / (JUMP_DOWN.ground - JUMP_DOWN.leave)));
      else root.y = ground;
      if (t >= (this.cat.duration('JumpDown') || JUMP_DOWN.end)) this._endJump();
    }
  },

  _endJump() {
    const j = this._jump;
    this._jump = null;
    this.onWall = j.kind === 'jump' || j.onTop;
    this._nav = null;
    const resume = ['walk', 'trot', 'run', 'chase', 'approach'].includes(j.resume) ? j.resume : 'idle';
    if (resume === 'approach' && !this._preyValid()) this._endHunt('butterfly gone', false);
    this._set(resume === 'approach' && !this._hunt ? 'idle' : resume);
    const q = this._queued;
    this._queued = null;
    q?.();
  },

  /** Root height outside jumps: top of the low wall (smoothed) or terrain ground. */
  _settle(dt) {
    const root = this.cat.root.position;
    if (this.onWall) {
      const top = this.ruins?.walkableAt(root.x, root.z, 0) ?? null;
      if (top !== null) { root.y += (top - root.y) * (1 - Math.exp(-NAV.wallFollow * dt)); return; }
      this.onWall = false; // left the top without a jump (pounce): falls
    }
    const ground = this._groundAt(root.x, root.z);
    root.y = root.y > ground ? Math.max(ground, root.y - 4 * dt) : ground;
  },

  /** Pounce: root advance reduced so as not to enter a wall or leave the top of a low wall. */
  _clampLeap(start, dir, leap) {
    if (!this.ruins || leap <= 0) return leap;
    if (this.onWall) {
      while (leap > 0 && this.ruins.walkableAt(start.x + dir.x * leap, start.z + dir.z * leap, 0.02) === null) leap -= 0.05;
      return Math.max(0, leap);
    }
    const hit = this.ruins.blockedSegment(start.x, start.z, start.x + dir.x * leap, start.z + dir.z * leap, NAV.radius, { y: start.y });
    if (hit) leap = Math.max(0, leap * hit.t - 0.02);
    const ex = start.x + dir.x * leap, ez = start.z + dir.z * leap;
    const r = Math.hypot(ex, ez);
    if (!this.ruins.corridor && r > NAV.limit) leap = Math.max(0, leap - (r - NAV.limit));
    return leap;
  },
};
