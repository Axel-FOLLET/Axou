/**
 * Snow cats, their snowballs and the kitten's falls on the mountain climb (zone 2). Created by main.js and updated in zone 2
 * only. Tuning values are in `CLIMB` (src/game/climb.js), the look of the balls in snowCatLook.js. The cats are NPCs of
 * kind `snowCat` (Npc.js): white coat, half size, and a beanie of a random colour, never the same for two cats.
 *
 * - 8 fixed, indestructible cats along the climb, outside the corridor (`_findSites`); they are built one per frame, so
 *   entering the zone does not freeze. Out of the camera cone or beyond `show` m a cat is not drawn; beyond `anim` m it is frozen.
 * - A cat starts a ball when the kitten is within `charge` m: it grows for `grow` s up to the cat's size. At `cycle - contact` s
 *   the cat swipes, and the ball leaves at `cycle` s toward where the kitten will be (`snowball.lead`), in an arc, with a ground
 *   mark at the landing point (`snowball.warn`). Another ball then starts, while the kitten is in range.
 * - A ball that reaches the kitten knocks it down (no health loss): short slide down the path (slide.js), Knockback clip,
 *   up again at fall.free`, then fall.grace` s without another fall. `falls` counts the falls of the game.
 * - If `protector.protecting` (Chavalanche), balls aim at `protector.root` and cause no fall; `onBlocked(info)` fires at impact.
 *
 * Test access (`window.__snowCats`, src/debug/handles.js): `state`, `list`, `fire(i, { force })`.
 */

import * as THREE from 'three';
import { CLIMB } from '../game/climb.js';
import { slideDown, downhill } from '../game/slide.js';
import { NAV } from '../cat/brainTuning.js';
import { Npc } from '../npc/Npc.js';
import { getNpcAssets } from '../npc/npcAssets.js';
import { ZONE2, FOOT, SUMMIT, PATH_SEGMENTS, LEG_KINDS, pathClearance, pathInside } from './zone2.js';
import { snowballGeometry, snowCatMaterial, impactMarkGeometry, impactMarkMaterial } from './snowCatLook.js';

/** Story steps during which nothing is thrown at the kitten (arrival cutscene, opening, hug, end screen). */
const NO_STEPS = new Set(['title', 'arrival', 'opening', 'wakeup', 'hug', 'end']);

/**
 * Snow bursts at impact (visual only): `count` instances in total, `per` per impact, horizontal `speed` and vertical `up`
 * (m/s), `life` (s), `size` (share of the ball radius), `gravity` (m/s2).
 */
const PUFF = { count: 36, per: 9, speed: [0.8, 2.4], up: [1.6, 3.2], life: 0.6, size: [0.25, 0.5], gravity: 9 };
/** Duration of the `Swipe` clip (s) when the GLB does not give one. */
const SWIPE_FALLBACK = 0.96;

const _out = { x: 0, z: 0 };
const _res = { x: 0, z: 0, hit: null };
const _dir = { x: 0, z: 0 };
const _m = new THREE.Matrix4(), _n = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);
const _fr = new THREE.Frustum(), _pm = new THREE.Matrix4(), _sph = new THREE.Sphere();

const smooth = (t) => { t = Math.min(Math.max(t, 0), 1); return t * t * (3 - 2 * t); };
const angleDiff = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));

/** Beanie colours of a cat: cuff lightened toward white, ribs darkened (share `rib` of the colour). */
function beanieColors(hex, B) {
  const base = new THREE.Color(hex);
  return {
    beanie: hex,
    beanieCuff: new THREE.Color(hex).lerp(new THREE.Color(0xffffff), B.cuff).getHex(),
    beanieRib: base.clone().multiplyScalar(B.rib).getHex(),
    pompom: B.pompom,
  };
}

export class SnowCats {
  /**
   * @param {THREE.Group} group world.mountainGroup
   * @param {{world, cat, story}} deps game systems
   */
  constructor(group, { world, cat, story }) {
    this.group = group; this.world = world; this.cat = cat; this.story = story;
    this.table = CLIMB;
    this.falls = 0;
    this.protector = null;  // { root, protecting }: set by the Chavalanche
    this.onBlocked = null;  // (info): ball stopped by the Chavalanche
    this.onFall = null;     // (info): the kitten falls (info.falls = number of falls)
    this.built = false;
    this.sites = [];        // cats: { x, y, z, yaw, now, npc, name, hex, phase, t, ball, swiped, idleIn, far, squeezed }
    this.balls = [];        // reused ball pool: { mesh, mark, st: 'free' | 'charge' | 'fly' | 'melt', ... }
    this.time = 0;
    this.catHeight = 0;     // cat height (m) measured on the model, at the first build
    this.buildMs = [];      // build time (ms) of each cat
    this._queue = [];       // cats to build (one per frame)
    this._fall = null;      // current fall: { t, e }
    this._grace = 0;        // seconds left without a new fall
    this._lastLaunch = -Infinity;
    this._meadowSeen = 0;  // meadow frames counted at the last update (return to zone 2)
    this._vel = { x: 0, z: 0 };
    this._prev = null;
    this.stats = { shots: 0, hits: 0, blocked: 0, misses: 0, lastImpact: null };
  }

  // ---------------------------------------------------------------- construction

  /** Sites, balls, marks and bursts: done once, the first time in zone 2; the cats follow. */
  _build() {
    const T = this.table.snowCats;
    this._findSites(T);
    // Beanies: colours drawn at random from the list, without replacement (never two cats of the same colour).
    const pool = T.beanies.list.slice();
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
    this.sites.forEach((s, i) => { [s.name, s.hex] = pool[i % pool.length]; });
    this._queue = this.sites.slice();
    this.material = snowCatMaterial();
    this.ballGeo = snowballGeometry();
    this.markGeo = impactMarkGeometry();
    const markMat = impactMarkMaterial();
    // A cat has at most two balls at once: the one growing and the one flying.
    const n = T.count * 2 + 1;
    for (let i = 0; i < n; i++) {
      const mesh = new THREE.Mesh(this.ballGeo, this.material);
      mesh.castShadow = true; mesh.visible = false; mesh.name = 'Snowball';
      const mark = new THREE.Mesh(this.markGeo, markMat.clone());
      mark.visible = false; mark.name = 'Snowball_impact'; mark.renderOrder = 2;
      this.group.add(mesh, mark);
      this.balls.push({ mesh, mark, st: 'free', t: 0, T: 1, r: 0.1, from: new THREE.Vector3(), to: new THREE.Vector3(), target: 'cat', site: 0, done: 0 });
    }
    // Snow bursts at impact: one instance per particle.
    this.puffMesh = new THREE.InstancedMesh(this.ballGeo, this.material, PUFF.count);
    this.puffMesh.name = 'Snowball_shards';
    this.puffMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.puffMesh.frustumCulled = false;
    this.puffs = Array.from({ length: PUFF.count }, () => ({ life: 0, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0 }));
    for (let i = 0; i < PUFF.count; i++) this.puffMesh.setMatrixAt(i, _m.makeScale(0, 0, 0));
    this.group.add(this.puffMesh);
    this.built = true;
  }

  /** Builds at most `perFrame` cats this frame (building a furred NPC is not free). */
  _buildCats() {
    if (!this._queue.length || !getNpcAssets()) return;
    const T = this.table.snowCats;
    for (let k = 0; k < T.perFrame && this._queue.length; k++) {
      const s = this._queue.shift(), t0 = performance.now();
      const { gain, ...coat } = T.coat;
      s.npc = new Npc('snowCat', this.group, {
        position: [s.x, s.y, s.z, s.yaw], pose: 'Idle', beanie: { colors: beanieColors(s.hex, T.beanies) }, coat,
      });
      s.npc.fur.uniforms.furCoat.value.multiplyScalar(gain); // undercoat lightened beyond white: reads as white under the warm sun
      s.npc.setPose('Idle', { loop: true, instant: true }); // living idle (the pose of the kind is frozen)
      s.npc.root.visible = false;
      this.buildMs.push(+(performance.now() - t0).toFixed(1));
      if (!this.catHeight) {
        // Standing cat height: top of the skull measured on the rest pose (`_landmarks.crown`, Npc.js, already at the
        // cat's scale); otherwise the body box (tail included, so taller).
        const crown = s.npc._landmarks?.crown?.y;
        s.npc.root.updateMatrixWorld(true);
        this.catHeight = crown > 0 ? crown : new THREE.Box3().setFromObject(s.npc.bodyMesh, true).max.y - s.y;
      }
    }
  }

  /** Ball radius (m): its size is the cat's (`snowball.size` x measured height, as a diameter). */
  get ballRadius() { return 0.5 * this.table.snowball.size * (this.catHeight || 0.34); }

  /**
   * Cat sites: `count` points evenly spaced between `from` and `to` (shares of the climb length). For each: a free point
   * along the path (up to `search` m either way), on alternating sides, `offset` m from the corridor edge and up to
   * `lateral` m further if pines or stones occupy the edge strip. Never in a rocky corridor or on the drop side of a ledge.
   * Without a free spot, the least bad one is used (`squeezed`).
   */
  _findSites(T) {
    const mountain = this.world.mountain;
    const trees = mountain?.trees ?? [], rocks = mountain?.rocks ?? [];
    const rb = T.radius;
    const cum = [0];
    for (const s of PATH_SEGMENTS) cum.push(cum[cum.length - 1] + s.len);
    const L = cum[cum.length - 1];
    const at = (d) => {
      let i = 0;
      while (i < PATH_SEGMENTS.length - 1 && d > cum[i + 1]) i++;
      return [PATH_SEGMENTS[i], Math.min(Math.max(d - cum[i], 0), PATH_SEGMENTS[i].len)];
    };
    // Free gap to the scenery placed by Mountain.js (pines: lower radius; stones); negative: the cat overlaps it.
    const room = (x, z) => {
      let worst = Infinity;
      for (const t of trees) worst = Math.min(worst, Math.hypot(t.x - x, t.z - z) - t.R * 0.85 - rb);
      for (const r of rocks) worst = Math.min(worst, Math.hypot(r.x - x, r.z - z) - r.r - rb);
      return worst;
    };
    const n = T.count;
    // Minimum spacing along the path between two cats: 60% of the regular spacing (a rocky corridor that shifts one
    // must not bunch them up).
    const step = n > 1 ? L * (T.to - T.from) / (n - 1) : 0, minStep = step * 0.6;
    let dPrev = -Infinity;
    for (let i = 0; i < n; i++) {
      const frac = n === 1 ? 0.5 : i / (n - 1);
      const target = Math.max(L * (T.from + (T.to - T.from) * frac), dPrev + minStep);
      let best = null;
      const sidePref = i % 2 ? 1 : -1;
      // Search along the path, widened once (x2) if nothing is free (22 m rocky corridor).
      for (const span of [T.search, T.search * 2]) {
        if (best) break;
        for (let k = 0; k <= Math.ceil(span / 0.75) * 2; k++) {
          const ds = Math.ceil(k / 2) * 0.75 * (k % 2 ? 1 : -1);
          const d = target + ds;
          if (d < 1 || d > L - 1 || d < dPrev + minStep) continue;
          const [seg, t] = at(d);
          const kind = LEG_KINDS[seg.kind];
          if (!kind || kind.walls) continue;
          const px = -seg.uz, pz = seg.ux;
          for (const side of [sidePref, -sidePref]) {
            if (kind.drop && side === seg.dropSide) continue;
            for (let lat = 0; lat <= T.lateral + 1e-6; lat += 0.5) {
              const off = seg.half + T.offset + rb + lat;
              const x = seg.ax + seg.ux * t + px * side * off, z = seg.az + seg.uz * t + pz * side * off;
              if (pathClearance(x, z) < rb + T.offset * 0.4) continue; // never closer to the corridor than 40% of `offset`
              if (this.sites.some((o) => Math.hypot(o.x - x, o.z - z) < 6)) continue;
              const free = room(x, z);
              // Best site: free first, then closest to the path and to the target.
              const score = (free >= T.room ? 0 : 100 - free) + lat + Math.abs(ds) * 0.3;
              if (!best || score < best.score) best = { score, d, x, z, cx: seg.ax + seg.ux * t, cz: seg.az + seg.uz * t, free };
            }
          }
          if (best && best.free >= T.room && best.score < 3) break;
        }
      }
      if (!best) continue;
      dPrev = best.d;
      const y = this.world.terrain.heightAt(best.x, best.z);
      const yaw = Math.atan2(best.cx - best.x, best.cz - best.z);
      this.sites.push({
        x: best.x, y, z: best.z, yaw, now: yaw, npc: null, name: '', hex: 0, phase: 'idle', t: 0, ball: null, swiped: false,
        idleIn: 0, far: false, squeezed: best.free < T.room,
      });
    }
  }

  // ---------------------------------------------------------------- state and access

  /** Common guards: never a ball on the kitten during a speech bubble, a cutscene, the bridge fade or while carried. */
  _blocked() {
    const { world, story, cat } = this;
    if (!world.inMountain || NO_STEPS.has(story.step)) return true;
    if (story._open || story.bubble?.isOpen || story._talking || story.crossing?.fading || story._combatLock) return true;
    const b = cat.brain;
    return !!(cat.carrier || (b.scripted && !this._fall) || b.hold);
  }

  /** The foot and the summit are safe: the Chavalanche waits at one, Maman sleeps at the other. */
  _safe(p) {
    const T = this.table.snowCats, X = ZONE2.x;
    return Math.hypot(p.x - (X + FOOT.x), p.z - FOOT.z) < T.safeFoot
      || Math.hypot(p.x - (X + SUMMIT.x), p.z - SUMMIT.z) < SUMMIT.r + T.safeSummit;
  }

  get list() { return this.sites.map((s, i) => ({ i, x: s.x, y: s.y, z: s.z, squeezed: s.squeezed, color: s.name, hex: s.hex, built: !!s.npc })); }

  get state() {
    return {
      count: this.sites.length, cats: this.sites.filter((s) => s.npc).length, colors: this.sites.map((s) => s.name),
      charging: this.balls.filter((b) => b.st === 'charge').length, flying: this.balls.filter((b) => b.st === 'fly').length,
      falls: this.falls, falling: !!this._fall, grace: Math.max(0, this._grace),
      shots: this.stats.shots, hits: this.stats.hits, blocked: this.stats.blocked, misses: this.stats.misses,
      lastImpact: this.stats.lastImpact, built: this.built, catHeight: +this.catHeight.toFixed(3), ballRadius: +this.ballRadius.toFixed(3),
      buildMs: this.buildMs,
    };
  }

  /** New game: balls removed, current fall released, fall counter and timers reset. */
  reset() {
    this.falls = 0;
    this._grace = 0;
    this._lastLaunch = -Infinity;
    this.stats = { shots: 0, hits: 0, blocked: 0, misses: 0, lastImpact: null };
    this._clear();
  }

  /** Removes balls, marks, bursts and the current fall (control is given back if it is ours); cats at rest. */
  _clear() {
    if (this._fall) this._endFall();
    for (const b of this.balls) { b.st = 'free'; b.mesh.visible = false; b.mark.visible = false; b.done = 0; }
    for (const s of this.sites) { s.phase = 'idle'; s.t = 0; s.ball = null; s.swiped = false; if (s.idleIn > 0) this._rest(s); }
    for (const p of this.puffs ?? []) p.life = 0;
    this._puffsDirty = true;
    this._prev = null;
  }

  /** Cat back to its living idle (after the swipe). */
  _rest(s) { s.idleIn = 0; s.npc?.setPose('Idle', { loop: true, fade: 0.25 }); }

  // ---------------------------------------------------------------- frame

  update(dt) {
    // Back from the meadow: the meadow frame counter (World.zoneUpdates) has moved since the last frame here.
    const seen = this.world.zoneUpdates?.meadow ?? 0;
    const away = seen !== this._meadowSeen;
    this._meadowSeen = seen;
    if (!this.world.inMountain) return;
    if (!this.built) {
      if (!this.world.mountain) return;
      this._build();
    }
    if (away) this._clear();
    this._buildCats();
    this.time += dt;
    this._track(dt);
    this._grace -= dt;
    this._updateSites(dt);
    this._updateBalls(dt);
    this._updatePuffs(dt);
    this._updateFall(dt);
  }

  /** Kitten speed (m/s, smoothed): the ball aims at where it will be if it keeps going. */
  _track(dt) {
    const p = this.cat.root.position;
    if (this._prev && dt > 0) {
      const k = 1 - Math.exp(-12 * dt);
      const moving = !this._fall && !this.cat.brain.scripted;
      const vx = moving ? (p.x - this._prev.x) / dt : 0, vz = moving ? (p.z - this._prev.z) / dt : 0;
      this._vel.x += (vx - this._vel.x) * k; this._vel.z += (vz - this._vel.z) * k;
    }
    this._prev = { x: p.x, z: p.z };
  }

  /** Free ball from the pool, or null. */
  _freeBall() { return this.balls.find((b) => b.st === 'free') ?? null; }

  /** Centre (x, z) of a cat's ball, in front of it, for a radius `r`. */
  _ballSpot(s, r, out) {
    const a = this.table.snowCats.ahead;
    out.x = s.x + Math.sin(s.now) * (a + r);
    out.z = s.z + Math.cos(s.now) * (a + r);
    return out;
  }

  _updateSites(dt) {
    const T = this.table.snowCats, p = this.cat.root.position, cam = this.world.camera;
    cam.updateMatrixWorld();
    _fr.setFromProjectionMatrix(_pm.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
    const R = this.ballRadius;
    const blocked = this._blocked(), safe = this._safe(p);
    for (const s of this.sites) {
      const npc = s.npc;
      if (!npc) continue;
      // Cost: neither drawn nor animated far from the camera or outside the view cone; animation frozen beyond `anim`.
      const dc = Math.hypot(cam.position.x - s.x, cam.position.z - s.z);
      _sph.set(_n.set(s.x, s.y + 0.3, s.z), 0.9 + R);
      const vis = dc <= T.show && _fr.intersectsSphere(_sph);
      npc.root.visible = vis;
      if (vis) {
        // Animated, with camera-driven fur (FUR_LOD), up close; beyond `anim`, frozen and drawing one fur shell in `farFur`.
        const far = dc > T.anim;
        if (far !== s.far) { s.far = far; npc.setFurStep(far ? T.farFur : 1); }
        if (!far) npc.update(dt, cam);
      }
      if (s.idleIn > 0 && (s.idleIn -= dt) <= 0) this._rest(s);
      // The cat turns toward the kitten within charge range, otherwise returns to rest.
      const d = Math.hypot(p.x - s.x, p.z - s.z);
      const want = d <= T.charge * T.release ? Math.atan2(p.x - s.x, p.z - s.z) : s.yaw;
      const da = angleDiff(s.now, want);
      if (Math.abs(da) > 1e-3) { s.now += Math.sign(da) * Math.min(Math.abs(da), T.turn * dt); npc.setPosition(s.x, s.y, s.z, s.now); }
      // Ball cycle.
      if (s.phase === 'idle') {
        const b = d <= T.charge && !blocked && !this._fall && this._grace <= 0 && !safe ? this._freeBall() : null;
        if (b) {
          s.phase = 'charge'; s.t = 0; s.ball = b; s.swiped = false;
          Object.assign(b, { st: 'charge', site: this.sites.indexOf(s), r: 0.01, done: 0 });
          b.mesh.visible = true; b.mark.visible = false;
          b.mesh.scale.setScalar(0.01);
        }
      }
      if (s.phase !== 'charge') continue;
      const b = s.ball;
      // Kitten gone, fallen, safe or out of charge range: the ball melts. Speech bubble open: the cycle waits.
      if (d > T.charge * T.release || this._fall || this._grace > 0 || safe) { this._melt(s); continue; }
      if (blocked) { this._placeCharge(s, b, R); continue; }
      const start = T.cycle - T.contact;
      s.t += dt;
      if (!s.swiped) {
        if (s.t >= start) {
          // Swipe: only if the kitten is within throwing range and the gap between two throws holds.
          if (d > T.reach) { this._melt(s); continue; }
          if (this.time + T.contact - this._lastLaunch < T.gap) s.t = start; // waits its turn, ball ready
          else { s.swiped = true; npc.setPose('Swipe', { fade: 0.08 }); s.idleIn = (npc.duration('Swipe') || SWIPE_FALLBACK) + 0.05; this._lastLaunch = this.time + T.contact; }
        }
      }
      if (s.t >= T.cycle && s.swiped) { this._launch(s, b); s.phase = 'idle'; s.t = 0; s.ball = null; s.swiped = false; continue; }
      b.r = R * (0.06 + 0.94 * smooth(s.t / T.grow));
      this._placeCharge(s, b, R);
    }
  }

  /** Growing ball: in front of the cat, resting on the snow, at the current radius. */
  _placeCharge(s, b, R) {
    const r = Math.min(b.r, R);
    this._ballSpot(s, r, _out);
    b.mesh.position.set(_out.x, this.world.terrain.heightAt(_out.x, _out.z) + r, _out.z);
    b.mesh.scale.setScalar(Math.max(r, 0.005));
    b.mesh.rotation.y = s.now;
  }

  /** Ball cancelled: it melts in place; the cat's cycle restarts from zero. */
  _melt(s) {
    const b = s.ball;
    if (b) { b.st = 'melt'; b.t = 0; b.r0 = b.r; }
    s.phase = 'idle'; s.t = 0; s.ball = null;
    if (s.swiped) { s.swiped = false; this._rest(s); }
  }

  /** Cancels every ball being prepared (the kitten has just fallen). */
  _cancelCharges() { for (const s of this.sites) if (s.phase === 'charge') this._melt(s); }

  /** Test access: throws a ball of cat `i` at the kitten now, at full size, with no charge. */
  fire(i = 0, { force = false } = {}) {
    const s = this.sites[i];
    if (!s || !this.built || !s.npc) return false;
    if (!force && this._blocked()) return false;
    const b = s.ball ?? this._freeBall();
    if (!b) return false;
    if (s.phase === 'charge') { s.phase = 'idle'; s.t = 0; s.ball = null; s.swiped = false; }
    b.r = this.ballRadius; b.site = i;
    this._placeCharge(s, b, this.ballRadius);
    s.npc.setPose('Swipe', { fade: 0.05 }); s.idleIn = (s.npc.duration('Swipe') || SWIPE_FALLBACK) + 0.05;
    this._launch(s, b);
    return true;
  }

  /** Ball `b` of cat `s`: leaves its place toward the kitten (or the Chavalanche if it is protecting), in an arc. */
  _launch(s, b) {
    const B = this.table.snowball, R = this.ballRadius;
    const shield = this.protector?.protecting ? this.protector.root : null;
    const tp = (shield ?? this.cat.root).position;
    b.from.copy(b.mesh.position);
    const dist = Math.hypot(tp.x - b.from.x, tp.z - b.from.z);
    const flight = Math.max(B.minFlight, dist / B.speed);
    // Aims where the kitten will be: its current speed for a share `lead` of the flight, brought back into the corridor.
    let ax = tp.x + this._vel.x * flight * B.lead, az = tp.z + this._vel.z * flight * B.lead;
    pathInside(ax, az, NAV.radius, _out); ax = _out.x; az = _out.z;
    const ground = this.world.terrain.heightAt(ax, az);
    b.to.set(ax, ground + R, az);
    Object.assign(b, { st: 'fly', t: 0, done: 0, T: flight, r: R, target: shield ? 'protector' : 'cat', site: this.sites.indexOf(s) });
    b.mesh.visible = true;
    b.mesh.scale.setScalar(R);
    b.mark.visible = false;
    // Ground mark, laid along the slope.
    const h = (x, z) => this.world.terrain.heightAt(x, z);
    _n.set(h(ax - 0.4, az) - h(ax + 0.4, az), 0.8, h(ax, az - 0.4) - h(ax, az + 0.4)).normalize();
    b.mark.position.set(ax, ground + 0.03, az);
    b.mark.quaternion.setFromUnitVectors(_up, _n);
    this.stats.shots++;
  }

  _updateBalls(dt) {
    const B = this.table.snowball;
    for (const b of this.balls) {
      if (b.st === 'melt') {
        b.t += dt;
        const k = 1 - b.t / this.table.snowCats.melt;
        b.mesh.scale.setScalar(Math.max(b.r0 * k, 0.001));
        if (k <= 0) { b.st = 'free'; b.mesh.visible = false; }
        continue;
      }
      if (b.st === 'free') {
        if (b.done > 0) { b.done -= dt; b.mark.visible = b.done > 0; if (b.mark.visible) b.mark.material.opacity = 0.6 * (b.done / 0.25); }
        continue;
      }
      if (b.st !== 'fly') continue;
      b.t += dt;
      const u = Math.min(b.t / b.T, 1);
      b.mesh.position.lerpVectors(b.from, b.to, u);
      b.mesh.position.y += B.arc * 4 * u * (1 - u);
      b.mesh.rotation.x += B.spin * dt;
      b.mesh.rotation.z += B.spin * 0.6 * dt;
      // Mark: visible during the last `warn` seconds, it tightens onto the impact.
      const left = b.T - b.t;
      if (left <= B.warn) {
        const k = 1 - left / Math.min(B.warn, b.T);
        b.mark.visible = true;
        b.mark.scale.setScalar(B.hit * (1.3 - 0.3 * smooth(k)));
        b.mark.material.opacity = 0.6 * smooth(k * 3);
      }
      if (u >= 1) this._impact(b);
    }
  }

  /** Ball arrival: it knocks the kitten down, is stopped by the Chavalanche or lands beside. */
  _impact(b) {
    const B = this.table.snowball, p = this.cat.root.position, to = b.to;
    b.st = 'free'; b.mesh.visible = false; b.done = 0.25;
    const near = Math.hypot(p.x - to.x, p.z - to.z) <= B.hit;
    const protecting = !!this.protector?.protecting;
    let result = 'miss';
    if (b.target === 'protector' || (protecting && near)) result = 'blocked';
    else if (near && !this._blocked() && !this._fall && this._grace <= 0) result = 'fall';
    const info = { x: to.x, y: to.y, z: to.z, from: { x: b.from.x, z: b.from.z }, snowCat: b.site, result };
    this.stats.lastImpact = { x: +to.x.toFixed(2), z: +to.z.toFixed(2), result, snowCat: b.site, time: +this.time.toFixed(2) };
    if (result === 'blocked') { this.stats.blocked++; this.onBlocked?.(info); }
    else if (result === 'fall') { this.stats.hits++; this._startFall(info); }
    else this.stats.misses++;
    this._splash(to.x, to.y - b.r, to.z, result === 'miss' ? 0.8 : 1, b.r);
  }

  // ---------------------------------------------------------------- fall

  _startFall(info) {
    const C = this.table.fall, cat = this.cat, p = cat.root.position;
    this.falls++;
    downhill(p.x, p.z, _dir);
    const yaw = Math.atan2(-_dir.x, -_dir.z); // facing uphill: slides on its back, like the combat knockback
    cat.brain.setScripted('knock');
    cat.root.rotation.y = yaw;
    cat.locomotion.heading = yaw;
    this._fall = { t: 0, e: 0 };
    this._vel.x = this._vel.z = 0;
    this._cancelCharges();
    this.onFall?.({ ...info, falls: this.falls, slide: C.slide });
  }

  _updateFall(dt) {
    const f = this._fall;
    if (!f) return;
    const C = this.table.fall, cat = this.cat, brain = cat.brain;
    // A cutscene, the bridge or being carried took over the kitten: the fall stops without touching their state.
    if (!this.world.inMountain || cat.carrier || !brain.scripted || brain.state !== 'knock') { this._fall = null; return; }
    f.t += dt;
    const k = Math.min(f.t / C.time, 1), e = 1 - (1 - k) ** 3;
    const p = cat.root.position;
    slideDown(p.x, p.z, C.slide * (e - f.e), NAV.radius + 0.05, _out);
    f.e = e;
    this.world.navZone.resolve(_out.x, _out.z, NAV.radius, {}, _res);
    cat.root.position.set(_res.x, this.world.terrain.heightAt(_res.x, _res.z), _res.z);
    if (f.t >= C.free) this._endFall();
  }

  _endFall() {
    const brain = this.cat.brain;
    this._fall = null;
    this._grace = this.table.fall.grace;
    if (brain.scripted && brain.state === 'knock') brain.setScripted(null, 'idle');
  }

  // ---------------------------------------------------------------- bursts

  _splash(x, y, z, power, r) {
    let n = 0;
    for (const p of this.puffs) {
      if (p.life > 0) continue;
      const a = Math.random() * Math.PI * 2, sp = PUFF.speed[0] + Math.random() * (PUFF.speed[1] - PUFF.speed[0]);
      p.life = PUFF.life * (0.7 + Math.random() * 0.5);
      p.x = x; p.y = y + 0.1; p.z = z;
      p.vx = Math.cos(a) * sp * power; p.vz = Math.sin(a) * sp * power; p.vy = (PUFF.up[0] + Math.random() * (PUFF.up[1] - PUFF.up[0])) * power;
      p.size = (PUFF.size[0] + Math.random() * (PUFF.size[1] - PUFF.size[0])) * r;
      p.life0 = p.life;
      if (++n >= PUFF.per) break;
    }
    this._puffsDirty = true;
  }

  _updatePuffs(dt) {
    let any = this._puffsDirty;
    for (let i = 0; i < this.puffs.length; i++) {
      const p = this.puffs[i];
      if (p.life <= 0) continue;
      any = true;
      p.life -= dt;
      p.vy -= PUFF.gravity * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      const g = this.world.terrain.heightAt(p.x, p.z);
      if (p.y < g) { p.y = g; p.vy = 0; p.vx *= 0.8; p.vz *= 0.8; }
      const s = p.life > 0 ? p.size * Math.min(1, p.life / (p.life0 * 0.5)) : 0;
      this.puffMesh.setMatrixAt(i, _m.makeScale(s, s, s).setPosition(p.x, p.y, p.z));
    }
    if (any) {
      for (let i = 0; i < this.puffs.length; i++) if (this.puffs[i].life <= 0) this.puffMesh.setMatrixAt(i, _m.makeScale(0, 0, 0));
      this.puffMesh.instanceMatrix.needsUpdate = true;
      this._puffsDirty = false;
    }
  }
}
