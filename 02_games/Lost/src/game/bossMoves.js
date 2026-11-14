import { Paint, PAINT } from '../world/Paint.js';
import { WALK_MARGIN } from '../world/Arena.js';

/** s, end of the 'BrushSwing' clip at speed 1. */
const BRUSH_SWING_END = 1.75;

/**
 * Boss strikes: decides when and how the Chartiste strikes. Used by Duel (combat.js). `L` is the `LEVELS` entry
 * (difficulty.js, the table of per-level values), `B` is `FIGHT.boss`. Duel calls `update(dt)` every frame outside
 * pause, defeat and `down`, after counting down the clock `b.next`. Shared convention: `b.mode` stays in
 * 'idle' | 'flinch' | 'swing' (Duel handles 'defeat' and 'down'), and a strike is tested through `b.struck`
 * (Story.swordTakeable reads `swing` before `struck`).
 *
 * Mechanics:
 * - Delayed strike (`L.delayed`): at `FIGHT.boss.windup` s into the clip, the brush is frozen raised (clip speed 0) for
 *   `hold` s drawn from `L.delayed.hold`, with probability `chance`. During the hold the boss turns towards the kitten
 *   at `L.delayed.track` rad/s, so a kitten that dodges too early and stops is caught. The aim then locks `announce` s
 *   before impact (the boss stops turning, the brush stays raised), the same time as an ordinary announcement, so the
 *   kitten can dodge a second time. The hit zone is tested at the real impact.
 * - Brush hit zone: a sector of `FIGHT.boss.reach` m whose half-angle comes from the dodge rule of difficulty.js
 *   (`brush`): never wider than what a kitten reacting to the announcement can leave at a trot before the impact.
 * - Combo (`L.combo`): 2 or 3 strikes in a row, the boss turning towards the kitten (`aimTurn`) between two. The cadence
 *   restarts from the last strike, with the minimum guard `L.rest`.
 * - Paint (`L.paint`, Paint.js): every `every` s, the boss rises with `BrushSwing` (no hit test) and throws a puddle, a
 *   trail or zones, warned on the ground (`warn`) before they hurt. It takes the place of a strike: `b.next` is pushed
 *   back by the clip time, so the cadence does not double.
 * - Phase 2 (`L.phase2`): once per duel, at `at` of the boss's life. Cadence, announcement, clip end and paint rhythm go
 *   `speed` times faster, the arena changes (Arena.setPhase2) and `duel.onPhase2` (set by Story: `boss-phase2` music
 *   cue) is called.
 */

/**
 * Mechanics settings (launch values, not per level). Units: m, s, rad.
 * - `aimMax` (rad): angle between the boss's front and the kitten under which a paint attack can start. Below it the
 *   boss, which turns at `aimTurn` from `FIGHT.boss.aim` s before the time, throws face on. 0.3 rad (17°): the raised
 *   brush points at the kitten and the trail starts from the boss's front.
 * - `trailStart` (m): distance from the boss's centre to the start of a trail, just beyond its footprint
 *   (BOSS.foot[1] 1.6 m).
 * - `zoneSpread` (m): [min, max] distance of the following zones to the kitten.
 * - `zoneSep`: minimum distance between two centres, in radii (1.3: the zones barely touch, so an exit always remains).
 * - Dodgeable by construction (full rule at the top of difficulty.js):
 *   - `threat` (m): the kitten stays at least this far inside the shape's edge, otherwise the shape does not threaten it.
 *   - `slack` (m): margin removed from the allowed exit distance (the real exit is at least 5 cm shorter than `E`,
 *     enough for the angular step of a real path not to exceed it).
 *   - `exitDirs`: directions tried for the exit.
 *   - `exitMargin` (m): margin of the exit arrival point against any other shape and the edge of the disc.
 * - `edge` (m): margin between a shape and the edge of the arena disc (WALK_MARGIN 0.6 m + glow).
 * - `tries`: placement attempts for a zone before giving up.
 * - `dMin` (m): minimum distance from the kitten to the boss's centre, for the brush dodge rule: footprint edge
 *   (BOSS.foot[1] 1.6 m) plus body radius (0.2 m).
 * - `scan` (m): step of the worst exit distance computation.
 * - `airLead` (s): lead of the falling-brush sound effect before impact: the peak of `combat_brush_air.mp3` is 0.415 s
 *   from its start (CombatSfx.js, `SFX.events['brush-air'].peak`).
 */
export const MOVES = {
  aimMax: 0.3,
  trailStart: 1.9,
  zoneSpread: [2.5, 6.5],
  zoneSep: 1.3,
  edge: 0.8,
  tries: 12,
  dMin: 1.8,
  scan: 0.05,
  threat: 0.3,
  slack: 0.05,
  exitDirs: 32,
  exitMargin: 0.2,
  airLead: 0.42,
};

const round = (v, n = 100) => (v === null || v === undefined ? v : Math.round(v * n) / n);
const lerp = (r, k) => r[0] + (r[1] - r[0]) * k;

export class BossMoves {
  constructor(duel, L, B) {
    this.duel = duel;
    this.L = L;
    this.B = B;
    this.speed = 1;            // speed factor (phase 2)
    this.phase2 = false;       // reached once in this duel
    this.down = false;         // boss at 0 HP
    this.swing = null;         // current strike: { kind: 'brush' | 'paint', hold, held, holding, released }
    this.chain = null;         // combo: { left (strikes remaining), total, wait (s before the next) }
    this.pnext = L.first + L.paint.every * 0.6; // s before the next paint
    this.grace = 0;            // s without paint hitting (after a hit)
    this.lastShape = null;
    this.paint = null;         // Paint.js, created at the first shape
    this.stats = { delayed: 0, combos: 0, chained: 0, puddles: 0, trails: 0, zones: 0, paintHits: 0 };
    this.lastHold = null;
  }

  update(dt) {
    const d = this.duel, b = d.b, B = this.B, L = this.L;
    this.grace = Math.max(0, this.grace - dt);
    this.pnext -= dt;
    this.paint?.update(dt);
    // Sound effect: a warned shape becomes paint (end of `warn`), once per shape.
    if (this.paint) for (const h of this.paint.list) if (!h.landed && h.dying < 0 && h.age >= h.warn) { h.landed = true; d.onSfx?.('paint-land', { shape: h.kind }); }
    this._contact();
    // Aiming (`aim`, `aimTurn`): quick pivot towards the kitten before the time of the strike or paint, while idle or flinching.
    const paintOn = L.paint.on && L.paint.shapes.length > 0 && d._catDist() <= B.engage;
    const aiming = b.next <= B.aim || (paintOn && this.pnext <= B.aim);
    if (b.mode === 'idle') {
      if (this.chain) this._updateChain(dt);
      else {
        d._turnBoss(dt, aiming ? B.aimTurn : B.turn);
        if (b.next <= 0 && d._catDist() <= B.engage && d.c.mode !== 'knock') this._swing();
        else if (paintOn && this.pnext <= 0 && b.next > 0 && d.c.mode !== 'knock'
          && Math.abs(d._catInBoss().angle) <= MOVES.aimMax) this._paintSwing();
      }
    } else if (b.mode === 'flinch') {
      if (aiming) d._turnBoss(dt, B.aimTurn);
    } else if (b.mode === 'swing') {
      this._updateSwing(dt);
    }
  }

  /** Current strike: clip speed (announced wind-up, frozen hold, follow-through), impact, end. */
  _updateSwing(dt) {
    const d = this.duel, b = d.b, B = this.B, L = this.L, npc = d.boss, sp = this.speed;
    const s = this.swing ?? (this.swing = { kind: 'brush', hold: 0, held: 0, holding: false, released: true });
    const t = npc.clipTime;
    if (!s.released && !s.holding && t >= B.windup) s.holding = true;
    let scale;
    if (s.holding) {
      s.held += dt;
      if (s.held < s.hold) d._turnBoss(dt, L.delayed.track);        // hold: the boss follows the kitten
      if (s.held >= s.hold + L.announce / sp) { s.holding = false; s.released = true; } // lock for `announce` s, then impact
      scale = 0; // brush frozen raised
    } else {
      scale = (t < B.windup ? B.windup / (L.announce / sp) : sp);
    }
    npc.action?.setEffectiveTimeScale(scale);
    // Falling-brush sound effect: played `MOVES.airLead` s before impact (`eta`: s remaining, including the hold and lock
    // of a delayed strike; not before the hold of a strike about to be delayed).
    if (!s.air && !b.struck && (s.released || s.holding)) {
      const fall = (B.strike - Math.min(t, B.strike)) / sp;
      const eta = s.holding ? s.hold + L.announce / sp - s.held + (B.strike - B.windup) / sp
        : t < B.windup ? (B.windup - t) * (L.announce / sp) / B.windup + (B.strike - B.windup) / sp : fall;
      if (eta <= MOVES.airLead) { s.air = true; d.onSfx?.('brush-air', { eta: Math.max(0, eta) }); }
    }
    if (!b.struck && t >= B.strike && !s.holding) {
      b.struck = true;
      if (s.kind === 'brush') this._strike(); else d.onSfx?.('paint-throw', { shape: s.shape });
    }
    if (npc.clipDone) {
      d._guard();
      b.next = Math.max(b.next, L.rest);
      const c = this.chain;
      if (s.kind === 'brush' && c && c.left > 0) c.wait = L.combo.gap; else this.chain = null;
      this.swing = null;
    }
  }

  /** Guard between two strikes of a combo: turning towards the kitten, then the next strike. */
  _updateChain(dt) {
    const d = this.duel, c = this.chain, B = this.B;
    d._turnBoss(dt, B.aimTurn);
    if (d._catDist() > B.engage) { this.chain = null; return; }
    c.wait -= dt;
    if (c.wait <= 0 && d.c.mode !== 'knock') this._swing({ chained: true });
  }

  /** Duration (s) of an announced strike without hold: announced wind-up then clip end (1 s at speed 1). */
  _swingTime() { return this.L.announce / this.speed + (BRUSH_SWING_END - this.B.windup) / this.speed; }

  /**
   * Brush strike. `chained`: continuation of a combo (the number of strikes was drawn on the first). `hold`: imposed hold
   * (tests), otherwise drawn from `L.delayed`.
   */
  _swing({ chained = false, hold } = {}) {
    const d = this.duel, b = d.b, B = this.B, L = this.L, sp = this.speed;
    if (!d.boss.bossPlay('BrushSwing', { fade: 0.12, timeScale: B.windup / (L.announce / sp) })) { b.next = L.cadence / sp; this.chain = null; return false; }
    b.mode = 'swing'; b.t = 0; b.struck = false; b.next = L.cadence / sp;
    d.stats.swings++;
    let h = hold;
    if (h === undefined) h = L.delayed.on && Math.random() < L.delayed.chance ? lerp(L.delayed.hold, Math.random()) : 0;
    this.swing = { kind: 'brush', hold: h, held: 0, holding: false, released: h <= 0, zone: this._brushZone() };
    this.lastHold = round(h);
    if (h > 0) this.stats.delayed++;
    if (chained) { this.chain.left--; this.stats.chained++; }
    else if (L.combo.on) {
      const n = Math.round(lerp(L.combo.count, Math.random()));
      if (n > 1) { this.chain = { left: n - 1, total: n, wait: 0 }; this.stats.combos++; } else this.chain = null;
    } else this.chain = null;
    return true;
  }

  /**
   * Brush hit zone (boss frame): `reach` m and half-angle `angle` rad. Dodge rule of difficulty.js (`brush`): the
   * half-angle is the largest, at most `L.brush.angle`, such that the kitten, anywhere between `MOVES.dMin` and `reach` m
   * from the centre, can leave the sector (sideways, or outwards beyond `reach`) in at most `E = speed × (T − reaction)` m
   * (minus `MOVES.slack`), T being the time from the start of the gesture to the impact: (announcement + clip end) /
   * phase speed. Without `L.brush`: values of `FIGHT.boss`.
   */
  _brushZone() {
    const Z = this.L.brush, B = this.B;
    if (!Z) return { reach: B.reach, angle: B.angle };
    const T = (this.L.announce + (B.strike - B.windup)) / this.speed;
    const budget = Math.max(0, Z.speed * (T - Z.reaction)) - MOVES.slack, reach = Z.reach ?? B.reach, cap = Z.angle ?? B.angle;
    const worst = (a) => {
      let w = 0;
      for (let D = MOVES.dMin; D <= reach; D += MOVES.scan) w = Math.max(w, Math.min(D * Math.sin(a) + PAINT.catR, reach - D + PAINT.catR));
      return w;
    };
    if (worst(cap) <= budget) return { reach, angle: cap };
    let lo = 0, hi = cap;
    for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; if (worst(mid) <= budget) lo = mid; else hi = mid; }
    return { reach, angle: lo };
  }

  /** Brush impact: hit zone in the boss frame, tested at the real moment of the strike. */
  _strike() {
    const d = this.duel, B = this.B, z = d._catInBoss(), s = this.swing;
    const Z = s?.zone ?? this._brushZone();
    const hit = d.c.mode !== 'knock' && z.d <= Z.reach && z.d >= B.inner && Math.abs(z.angle) <= Z.angle;
    d.lastTaken = { time: round(d.time), hit, dist: round(z.d), angle: round(z.angle), heal: 0, hp: d.hp, source: 'brush', held: round(s?.held ?? 0), delayed: (s?.hold ?? 0) > 0, zone: round(Z.angle, 1000) };
    d.onSfx?.(hit ? 'brush-hit' : 'brush-ground');
    if (!hit) { d.stats.dodged++; return; }
    d.hitCat({ source: 'brush' });
  }

  // ---------------------------------------------------------------- paint

  /** Paint: the boss rises (`BrushSwing`, no hit test) and throws the drawn shape. */
  _paintSwing(shape) {
    const d = this.duel, b = d.b, B = this.B, L = this.L, sp = this.speed;
    const shapes = L.paint.shapes;
    const pick = shape ?? this._nextShape(shapes);
    if (!pick) { this.pnext = L.paint.every / sp; return false; }
    if (!d.boss.bossPlay('BrushSwing', { fade: 0.12, timeScale: B.windup / (L.announce / sp) })) { this.pnext = 1; return false; }
    b.mode = 'swing'; b.t = 0; b.struck = false;
    b.next = Math.max(b.next, this._swingTime() + L.rest); // takes the place of a strike: no double cadence
    this.swing = { kind: 'paint', hold: 0, held: 0, holding: false, released: true, shape: pick };
    this.chain = null;
    this.pnext = L.paint.every / sp;
    this.spawn(pick);
    return true;
  }

  _nextShape(shapes) {
    if (!shapes.length) return null;
    const pool = shapes.length > 1 ? shapes.filter((k) => k !== this.lastShape) : shapes;
    return (this.lastShape = pool[Math.floor(Math.random() * pool.length)]);
  }

  _paint() {
    if (!this.paint) {
      const w = this.duel.world;
      const f = this._field();
      this.paint = new Paint(w.arena?.group ?? w.meadowGroup, (x, z) => this.duel.ground(x, z), { x: f.x, z: f.z, r: f.r + MOVES.edge + 1 });
    }
    return this.paint;
  }

  /** Centre and radius of the disc where paint stays (arena; otherwise around the boss). */
  _field() {
    const w = this.duel.world, a = w.arena, r = this.duel.boss.root.position;
    return a?.radius ? { x: a.center.x, z: a.center.z, r: a.radius - MOVES.edge } : { x: r.x, z: r.z, r: 10 };
  }

  /** (x, z) brought back inside the arena disc, at least `rad` m from its edge. */
  _inside(x, z, rad) {
    const f = this._field(), R = Math.max(0.5, f.r - rad), dx = x - f.x, dz = z - f.z, h = Math.hypot(dx, dz);
    return h > R ? { x: f.x + dx / h * R, z: f.z + dz / h * R } : { x, z };
  }

  /** Distance (m) the kitten can run before the end of a shape's warning: rule of difficulty.js. */
  _reach(warn) {
    const P = this.L.paint;
    return Math.max(0.2, P.speed * (warn - P.reaction));
  }

  /**
   * Kitten's shortest exit (from (px, pz)) out of a disc of centre (cx, cz) and radius `rEff`: length (m) and arrival
   * point, inside the walkable arena and off any other shape; `null` if no direction works. Kitten already outside:
   * length 0.
   */
  _exit(px, pz, cx, cz, rEff, extra = []) {
    const f = this._field(), walk = f.r + MOVES.edge - WALK_MARGIN - MOVES.exitMargin, M = MOVES.exitMargin;
    const ox = px - cx, oz = pz - cz;
    if (Math.hypot(ox, oz) > rEff) return { t: 0, x: px, z: pz };
    let best = null;
    for (let k = 0; k < MOVES.exitDirs; k++) {
      const a = (k / MOVES.exitDirs) * Math.PI * 2, ux = Math.cos(a), uz = Math.sin(a);
      const b = ox * ux + oz * uz, t = -b + Math.sqrt(Math.max(0, b * b - (ox * ox + oz * oz - rEff * rEff)));
      const x = px + ux * (t + M), z = pz + uz * (t + M);
      if (Math.hypot(x - f.x, z - f.z) > walk) continue;
      if (this.paint?.covers(x, z, M)) continue;
      if (extra.some((q) => Math.hypot(x - q.x, z - q.z) <= q.r + M)) continue;
      if (!best || t < best.t) best = { t, x, z };
    }
    return best;
  }

  /**
   * Centre of a disc (`radius`, warning `warn` s) placed on or near the kitten: the kitten stays at least `MOVES.threat` m
   * inside the shape (otherwise it does not threaten it) and leaves by its shortest exit in at most `_reach(warn)` m.
   * @returns {{x, z, exit}|null} Without a solution, the disc is placed right next to the kitten (exit null), or null
   *   if the arena edge brings it back on the kitten.
   */
  _placeDisc(radius, warn, extra = []) {
    const c = this.duel.cat.root.position, E = this._reach(warn);
    const rEff = radius * (1 + PAINT.wobble[0] + PAINT.wobble[1]) + PAINT.catR;
    const lo = Math.max(0, rEff - E + MOVES.slack), hi = Math.max(lo, rEff - MOVES.threat);
    for (let k = 0; k < MOVES.tries * 3; k++) {
      const a = Math.random() * Math.PI * 2, off = lo + (hi - lo) * Math.random();
      const p = this._inside(c.x + Math.cos(a) * off, c.z + Math.sin(a) * off, radius);
      const ex = this._exit(c.x, c.z, p.x, p.z, rEff, extra);
      if (ex && ex.t <= E + 1e-6 && ex.t > 0) return { x: p.x, z: p.z, exit: ex, rEff };
    }
    const a = Math.random() * Math.PI * 2, p = this._inside(c.x + Math.cos(a) * (rEff + 0.5), c.z + Math.sin(a) * (rEff + 0.5), radius);
    // Fallback: disc next to the kitten; if the arena edge brings it back on the kitten, nothing is placed.
    return Math.hypot(c.x - p.x, c.z - p.z) > rEff + MOVES.exitMargin ? { x: p.x, z: p.z, exit: null, rEff } : null;
  }

  /**
   * Places a shape (`puddle`, `trail`, `zone`) with the level's values (`L.paint`), dodgeable by construction: the kitten,
   * wherever it is at launch, leaves each shape in at most `_reach(warn)` m (rule of difficulty.js). Also used by tests
   * (`launch`).
   * @returns {Array} The shapes placed.
   */
  spawn(shape) {
    const d = this.duel, P = this.L.paint, paint = this._paint(), c = d.cat.root.position, r = d.boss.root.position, out = [];
    if (shape === 'puddle') {
      const V = P.puddle, p = this._placeDisc(V.radius, V.warn);
      if (p) { out.push(paint.spawn({ kind: 'puddle', x: p.x, z: p.z, radius: V.radius, warn: V.warn, life: V.life, grow: V.grow })); this.stats.puddles++; }
    } else if (shape === 'trail') {
      const V = P.trail, E = this._reach(V.warn), D = Math.hypot(c.x - r.x, c.z - r.z);
      const half = V.width / 2 * (1 + PAINT.strip.edgeWobble) + PAINT.catR;
      // Sideways offset of the kitten from the axis: it stays at least `threat` m inside the band and leaves it sideways in at most E m.
      const lo = Math.max(0, half - E + MOVES.slack), hi = Math.max(lo, half - MOVES.threat), f = this._field();
      const base = Math.atan2(c.x - r.x, c.z - r.z), lat = lo + (hi - lo) * Math.random(), turn = Math.asin(Math.min(0.99, lat / Math.max(D, 1)));
      let yaw = base, placed = false, dx, dz;
      for (const sgn of Math.random() < 0.5 ? [1, -1] : [-1, 1]) {
        const y = base + sgn * turn, nx = Math.cos(y), nz = -Math.sin(y); // normal to the band
        const ls = (c.x - r.x) * nx + (c.z - r.z) * nz, side = ls >= 0 ? 1 : -1; // signed offset, exit side
        const need = half - Math.abs(ls) + MOVES.exitMargin;
        const ex = c.x + side * nx * need, ez = c.z + side * nz * need;
        if (Math.hypot(ex - f.x, ez - f.z) <= f.r + MOVES.edge - WALK_MARGIN - MOVES.exitMargin && !paint.covers(ex, ez, MOVES.exitMargin)) { yaw = y; placed = true; break; }
      }
      // No free exit (kitten against the edge, shapes already there): the band passes right next to it, without threatening it.
      if (!placed) yaw = base + Math.asin(Math.min(0.99, (half + MOVES.exitMargin) / Math.max(D, 1)));
      dx = Math.sin(yaw); dz = Math.cos(yaw);
      const sx = r.x + dx * MOVES.trailStart, sz = r.z + dz * MOVES.trailStart;
      // Length up to the arena edge: intersection of the ray with the disc (`edge` margin already taken).
      const ox = sx - f.x, oz = sz - f.z, bq = ox * dx + oz * dz, cq = ox * ox + oz * oz - f.r * f.r;
      const tMax = -bq + Math.sqrt(Math.max(0, bq * bq - cq));
      const length = Math.min(V.length, tMax);
      if (length >= 2) { out.push(paint.spawn({ kind: 'trail', x: sx, z: sz, yaw, length, width: V.width, warn: V.warn, life: V.life })); this.stats.trails++; }
    } else if (shape === 'zone') {
      const V = P.zone, placed = [], rEff = V.radius * (1 + PAINT.wobble[0] + PAINT.wobble[1]) + PAINT.catR;
      let exit = null;
      for (let i = 0; i < V.count; i++) {
        let spot = null;
        if (i === 0) {
          const p = this._placeDisc(V.radius, V.warn);
          if (p) { spot = { x: p.x, z: p.z }; exit = p.exit; }
        } else {
          for (let k = 0; k < MOVES.tries && !spot; k++) {
            const a = Math.random() * Math.PI * 2, s = lerp(MOVES.zoneSpread, Math.random());
            const p = this._inside(c.x + Math.cos(a) * s, c.z + Math.sin(a) * s, V.radius);
            const ok = placed.every((q) => Math.hypot(q.x - p.x, q.z - p.z) >= V.radius * 2 * MOVES.zoneSep)
              && Math.hypot(c.x - p.x, c.z - p.z) > rEff + MOVES.exitMargin
              && (!exit || Math.hypot(exit.x - p.x, exit.z - p.z) > rEff + MOVES.exitMargin);
            if (ok) spot = p;
          }
        }
        if (!spot) continue;
        placed.push(spot);
        out.push(paint.spawn({ kind: 'zone', x: spot.x, z: spot.z, radius: V.radius, warn: V.warn, life: V.life }));
        this.stats.zones++;
      }
    }
    return out;
  }

  /** Does the kitten touch a painted shape? Nothing during knockback, grace, pause or defeat. */
  _contact() {
    const d = this.duel;
    if (!this.paint || this.grace > 0 || d.c.mode === 'knock' || d.over || d.paused || this.down) return;
    const p = d.cat.root.position, h = this.paint.touch(p.x, p.z);
    if (!h) return;
    this.grace = this.L.paint.grace;
    this.stats.paintHits++;
    d.lastTaken = { time: round(d.time), hit: true, source: 'paint', shape: h.kind, dist: round(Math.hypot(p.x - h.cx, p.z - h.cz)), angle: null, heal: 0, hp: d.hp };
    d.onSfx?.('paint-hit', { shape: h.kind });
    // No boss heal (the heal rewards its brush strike); knocked back like a strike, same player animation.
    d.hitCat({ source: 'paint', heal: false, knock: true });
  }

  // ---------------------------------------------------------------- Duel

  /**
   * Sword cutscene (Duel.pause); `on` false: resume. During the pause nothing hurts and nothing starts: on entry,
   * strike, combo and all paint on the ground are removed (a puddle still there would hit the kitten on resuming,
   * before the player has seen it again). On resuming, the next strike comes from Duel's delay (`FIGHT.sword.resume`) and the next
   * paint 2.5 s later.
   */
  pause(on) {
    const d = this.duel;
    if (on) {
      this.swing = null; this.chain = null;
      this.paint?.clear(false);
    }
    this.pnext = Math.max(this.pnext, d.b.next + 2.5);
  }

  /** Boss life changed (0 to 1): phase 2 threshold, once per duel. */
  onHp(f) {
    const P = this.L.phase2;
    if (!P.on || this.phase2 || this.down || f > P.at) return;
    this.phase2 = true;
    this.speed = P.speed;
    const d = this.duel;
    d.b.next = Math.min(d.b.next, this.L.cadence / this.speed);
    this.pnext = Math.min(this.pnext, this.L.paint.every / this.speed);
    d.world.arena?.setPhase2?.(true);
    d.onPhase2?.();
    d.onSfx?.('phase2');
  }

  /** Boss at 0 HP: no more attacks, nothing new on the ground, the arena calms down. */
  onBossDown() {
    this.down = true;
    this.swing = null; this.chain = null;
    this.paint?.clear(false);
    this.duel.world.arena?.setPhase2?.(false);
  }

  /** End of the duel, won or not: everything on the ground is removed and the arena restored. */
  dispose() {
    this.swing = null; this.chain = null;
    this.paint?.dispose();
    this.paint = null;
    this.duel.world.arena?.setPhase2?.(false, true);
  }

  // ---------------------------------------------------------------- tests

  /**
   * Test access (`__story.duel.moves.launch(...)`): launches an attack on request, whatever the timer. `what`: 'swing'
   * ({ hold }: hold in s), 'combo' ({ count }), 'paint' ({ shape }: boss announcement then shape), 'puddle' | 'trail' |
   * 'zone' (shape alone, no boss gesture), 'phase2' (forces the threshold).
   * @returns {boolean} True if the attack started.
   */
  launch(what, o = {}) {
    const d = this.duel, b = d.b;
    if (d.over || d.paused || this.down) return false;
    if (what === 'phase2') { this.onHp(0); return this.phase2; }
    if (what === 'puddle' || what === 'trail' || what === 'zone') return this.spawn(what).length > 0;
    if (b.mode !== 'idle' || d.c.mode === 'knock') return false;
    if (what === 'swing') { this.chain = null; return this._swing({ hold: o.hold ?? 0 }); }
    if (what === 'combo') {
      this.chain = null;
      if (!this._swing({ hold: o.hold ?? 0 })) return false;
      this.chain = { left: Math.max(0, (o.count ?? 2) - 1), total: o.count ?? 2, wait: 0 };
      this.stats.combos++;
      return true;
    }
    if (what === 'paint') return this._paintSwing(o.shape ?? 'puddle');
    return false;
  }

  /** Readable state (`__combat.duel.moves`). */
  get state() {
    const s = this.swing;
    return {
      level: this.L.label, phase2: this.phase2, speed: this.speed, down: this.down,
      swing: s ? { kind: s.kind, shape: s.shape ?? null, hold: round(s.hold), held: round(s.held), holding: s.holding, locked: s.holding && s.held >= s.hold, angle: s.zone ? round(s.zone.angle, 1000) : null } : null,
      hold: this.lastHold, combo: this.chain ? { left: this.chain.left, total: this.chain.total } : null,
      puddles: this.paint?.count('puddle') ?? 0, trails: this.paint?.count('trail') ?? 0, zones: this.paint?.count('zone') ?? 0,
      shapes: this.paint?.state ?? [], nextPaint: round(this.pnext), grace: round(this.grace), stats: { ...this.stats },
    };
  }
}
