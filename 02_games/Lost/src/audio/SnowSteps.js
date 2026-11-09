/**
 * Kitten footsteps on snow: six CC0 recordings (public/sounds/snow_1.mp3 to snow_6.mp3) played on the shared audio
 * context (context.js) in time with the paw placements of the active clip. Created and updated by main.js.
 *
 * - `preload()` fetches and decodes the files once (no sound, no context created; does nothing without fetch or document);
 * - `update(dt, cat, onSnow)` every frame: `cat` is a `Cat` (src/cat/Cat.js), `onSnow` tells whether it is on snow;
 * - `log`: last 50 steps `{ at, t, variant, file, gain, clip }` (`at`: performance.now() in ms, `t`: accumulated update
 *   clock in s, `variant`: file index, `gain`: final output gain); `count`: steps played since creation;
 * - `onPaw(leg, clip)`: called for each single paw placement ('BL', 'FL', 'BR', 'FR'), for the snow footprints; same
 *   conditions as the sound, but independent of the audio context.
 *
 * Steps follow the phase of the active clip (`action.time` / clip duration) rather than a timer. Paw phases come from
 * tools/anim_cat.py (`_foot_track`: phase 0 is the foot placed forward). A slow frame that skips placements cannot
 * cause a burst (`SNOW.slowAdvance`), and a stopped clip, a held pose or a clip change produce nothing.
 */

import { currentAudioContext } from './context.js';
import { VOLUMES } from './volumes.js';
import { canLoadSounds, decodingContext, loadSound } from './loadSound.js';

/**
 * | Setting       | Value        | Reason |
 * |---------------|--------------|--------|
 * | gain          | VOLUMES.snow | Linear output gain of the files; value and reason in volumes.js. |
 * | gainJitter    | 0.12         | +/- 12% gain from step to step (about 1 dB): volume only, the pitch never changes. |
 * | lead          | 0.005        | Margin (s) before the start, never scheduling in the past; 5 ms is too short to notice. |
 * | minGap        | 0.06         | Minimum time (s, update clock) between two steps: below the shortest real gap (0.075 s), removes double hits. |
 * | maxPerFrame   | 2            | Maximum steps in a normal frame (two walk placements fit in 0.15 cycle). |
 * | slowAdvance   | 0.3          | Cycle fraction per frame above which a frame counts as slow: one step at most, never a burst. |
 * | stagger       | 0.04         | Delay (s) between two steps of the same frame, so they do not blend. |
 * | minSpeed      | 0.2          | Fraction of the gait speed (`cat.locomotion.speed`) below which the cat is not advancing: silence. |
 * | minSpeedFloor | 0.08         | Floor (m/s) of that threshold when the gait speed is unknown. |
 * | teleport      | 3            | Displacement (m) in one frame treated as a teleport (zone change, cutscene): resync without a step. |
 * | minWeight     | 0.5          | Minimum clip weight in a crossfade: below it the visible pose still belongs to the previous clip. |
 * | logMax        | 50           | Log size, same as `meowLog`. |
 */
export const SNOW = {
  files: ['snow_1.mp3', 'snow_2.mp3', 'snow_3.mp3', 'snow_4.mp3', 'snow_5.mp3', 'snow_6.mp3'],
  gain: VOLUMES.snow,
  gainJitter: 0.12,
  lead: 0.005,
  minGap: 0.06,
  maxPerFrame: 2,
  slowAdvance: 0.3,
  stagger: 0.04,
  minSpeed: 0.2,
  minSpeedFloor: 0.08,
  teleport: 3,
  minWeight: 0.5,
  logMax: 50,
};

/**
 * Paw placements per clip cycle (phase 0..1): four for the walk, two for the trot, two for the gallop. In the gallop each
 * pair of paws (rear at 0 and 0.1, front at 0.5 and 0.6) is merged into one placement, at 0.05 and 0.55: twelve sounds
 * per second would be a machine gun for a kitten.
 */
export const GAITS = {
  Walk: [0, 0.15, 0.5, 0.65],
  SwordWalk: [0, 0.15, 0.5, 0.65],
  Trot: [0, 0.5],
  run: [0.05, 0.55],
  SwordRun: [0.05, 0.55],
};

/**
 * Placement of each paw for the footprints (phase 0..1), in addition to `GAITS`, which merges the gallop paws for the
 * sound. Phases come from tools/anim_cat.py, plus a 0.04-cycle delay for walk and trot: at the exact phase the paw is
 * still 2.5 to 3.6 cm above the ground and sliding. No delay for the gallop, whose stance lasts only 0.25 cycle.
 */
const WALK_PAWS = { BL: 0.04, FL: 0.19, BR: 0.54, FR: 0.69 };
const RUN_PAWS = { BL: 0, BR: 0.1, FR: 0.5, FL: 0.6 };
export const PAWS = {
  Walk: WALK_PAWS,
  SwordWalk: WALK_PAWS,
  Trot: { BL: 0.04, FR: 0.04, BR: 0.54, FL: 0.54 },
  run: RUN_PAWS,
  SwordRun: RUN_PAWS,
};

/** Brain states where the cat moves on foot (stalk, bat, pounce, jump: no snow steps). */
const WALKING = new Set(['walk', 'trot', 'run', 'chase', 'approach']);

export class SnowSteps {
  constructor() {
    this.buffers = new Map(); // file name -> AudioBuffer
    this.log = [];
    this.count = 0;
    this.random = Math.random; // replaceable by a test
    this._loading = null;
    this._t = 0;               // accumulated update clock (s)
    this._last = -1;           // variant of the last step
    this._lastAt = -Infinity;  // clock of the last step
    this._ref = null;          // { clip, phase }: last reading of the active clip
    this._pos = null;          // { x, z }: last cat position
    this.onPaw = null;         // (leg, clip) => void: paw placement (snow footprints, main.js)
  }

  /** Downloads and decodes the files ahead of time (once; no sound, no context created). */
  preload() {
    if (this._loading) return this._loading;
    if (!canLoadSounds()) return Promise.resolve(null);
    const c = decodingContext();
    if (!c) return Promise.resolve(null);
    this._loading = Promise.all(SNOW.files.map((name) => loadSound(c, name)
      .then((buf) => { this.buffers.set(name, buf); })))
      .then(() => true)
      .catch((err) => {
        console.warn('[audio] snow steps not loaded:', err);
        this._loading = null; // retry on the next preload
        return null;
      });
    return this._loading;
  }

  /** True if the cat is really walking (state, clip, speed); otherwise no step can fire. */
  _walking(cat, speed) {
    const b = cat.brain, a = cat.current;
    if (!b || !a || b.scripted || b.hold || b.jumping || b.pouncing || b.onWall || cat.carrier) return false;
    if (!WALKING.has(b.state)) return false;
    if (!GAITS[a.getClip?.().name]) return false;
    if (!(a.timeScale > 0) || !(a.getEffectiveWeight?.() >= SNOW.minWeight)) return false;
    const gait = cat.locomotion?.speed;
    return speed >= Math.max(SNOW.minSpeedFloor, SNOW.minSpeed * (gait > 0 ? gait : 0));
  }

  /** Every frame: plays a step for each paw placement crossed since the previous frame. */
  update(dt, cat, onSnow) {
    if (!(dt > 0) || !cat) { this._ref = null; return; }
    this._t += dt;
    // Ground speed for this frame (world frame, horizontal plane).
    const p = cat.root?.position;
    let speed = 0, jumped = false;
    if (p && this._pos) {
      const d = Math.hypot(p.x - this._pos.x, p.z - this._pos.z);
      speed = d / dt; jumped = d > SNOW.teleport;
    }
    if (p) this._pos = { x: p.x, z: p.z };
    if (!onSnow || jumped || !this._walking(cat, speed)) { this._ref = null; return; }

    const a = cat.current, clip = a.getClip(), dur = clip.duration;
    if (!(dur > 0)) { this._ref = null; return; }
    const phase = (((a.time % dur) + dur) % dur) / dur;
    const ref = this._ref;
    this._ref = { clip: clip.name, phase };
    if (!ref || ref.clip !== clip.name) return; // clip changed or walk resumed: take a reference only

    // Cycle fraction covered since the previous frame (0..1) and placements crossed, in order.
    const adv = (((phase - ref.phase) % 1) + 1) % 1;
    if (this.onPaw) {
      const paws = PAWS[clip.name];
      for (const leg in paws) {
        const o = (((paws[leg] - ref.phase) % 1) + 1) % 1;
        if (o > 1e-9 && o <= adv + 1e-9) this.onPaw(leg, clip.name);
      }
    }
    const slow = dt * a.timeScale / dur > SNOW.slowAdvance;
    const hits = GAITS[clip.name].map((c) => (((c - ref.phase) % 1) + 1) % 1).filter((o) => o > 1e-9 && o <= adv + 1e-9).sort((x, y) => x - y);
    // Slow frame: several cycles may have passed; play one step (the last placement seen), no burst.
    const n = slow ? Math.min(1, hits.length || (dt * a.timeScale / dur >= 1 ? 1 : 0)) : Math.min(hits.length, SNOW.maxPerFrame);
    for (let k = 0; k < n; k++) this._step(k * SNOW.stagger, clip.name);
  }

  /** Plays a step (after `delay` s) if the minimum gap to the previous step holds. */
  _step(delay, clip) {
    if (this._t - this._lastAt < SNOW.minGap) return;
    const ctx = currentAudioContext();
    const names = SNOW.files.filter((f) => this.buffers.has(f));
    if (!ctx || ctx.state !== 'running' || !names.length) return;
    // Random variant, never twice in a row (when several are decoded).
    let i = Math.min(names.length - 1, Math.floor(this.random() * names.length));
    if (names.length > 1 && SNOW.files.indexOf(names[i]) === this._last) i = (i + 1 + Math.floor(this.random() * (names.length - 1))) % names.length;
    const name = names[i], variant = SNOW.files.indexOf(name);
    const gain = SNOW.gain * (1 + SNOW.gainJitter * (this.random() * 2 - 1));
    const src = ctx.createBufferSource();
    const out = ctx.createGain();
    try {
      src.buffer = this.buffers.get(name);
      out.gain.value = gain;
      src.connect(out).connect(ctx.destination);
      src.onended = () => { src.disconnect(); out.disconnect(); };
      src.start(ctx.currentTime + SNOW.lead + delay);
    } catch (err) {
      try { src.disconnect(); out.disconnect(); } catch { /* already released */ }
      console.warn('[audio] snow step not played:', err);
      return;
    }
    this._last = variant; this._lastAt = this._t; this.count++;
    this.log.push({ at: Math.round(globalThis.performance?.now?.() ?? Date.now()), t: this._t, variant, file: name, gain, clip });
    if (this.log.length > SNOW.logMax) this.log.splice(0, this.log.length - SNOW.logMax);
  }
}
