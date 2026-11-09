/**
 * Combat sound effects: the Chartiste's attacks (brush, paint, phase 2) and the kitten's (claw, sword). Paint sounds like
 * lava. Files are synthesized by `tools/render_sfx.py`, fetched and decoded on an OfflineAudioContext with no player
 * gesture, and played on the shared context (context.js); without a running context nothing plays and the log records it.
 *
 * Callers: Duel (combat.js) and BossMoves (bossMoves.js) through the `duel.onSfx(name, { eta })` callback, set by main.js
 * on each new duel. `eta` is the time (s) before the sound should be at its loudest (brush impact, claw contact);
 * playback starts so that the peak of the file (`peak`) lands on that moment, skipping into the file if the call is late.
 */

import { currentAudioContext } from './context.js';
import { VOLUMES } from './volumes.js';
import { canLoadSounds, decodingContext, loadSound } from './loadSound.js';

/**
 * | Event        | File                       | When |
 * |--------------|----------------------------|------|
 * | brush-air    | combat_brush_air.mp3       | brush comes down (strike or paint throw), peak at impact |
 * | brush-hit    | combat_brush_hit.mp3       | brush hits the kitten |
 * | brush-ground | combat_brush_ground.mp3    | brush hits the ground, kitten dodged |
 * | paint-throw  | combat_lava_throw.mp3      | the Chartiste throws its paint (end of the gesture) |
 * | paint-land   | combat_lava_land.mp3       | an announced shape becomes paint (end of `warn`) |
 * | paint-hit    | combat_lava_hit.mp3        | kitten caught in the paint |
 * | phase2       | combat_phase2.mp3          | switch to phase 2; `offset` skips part of the rise, the hit comes 0.5 s later |
 * | claw-air     | combat_claw_air.mp3        | claw swing, peak at contact |
 * | claw-hit     | combat_claw_hit.mp3        | claw hits the boss |
 * | sword-air    | combat_sword_air.mp3       | sword swing, peak at contact |
 * | sword-hit    | combat_sword_hit.mp3       | sword hits the boss |
 *
 * `gain`: key in `VOLUMES.combat` (volumes.js); `peak` (s): loudest point of the file, from render_sfx.py; `offset` (s):
 * playback start; `jitter: false`: no random variation. `rateJitter`: pitch varied by +/- 6% per play, so two hits never
 * sound alike; `gainJitter`: +/- 10%; `minGap` (s): the same sound cannot restart sooner (three paint zones landing
 * together make one splash); `lead` (s): scheduling margin.
 */
export const SFX = {
  events: {
    'brush-air': { file: 'combat_brush_air.mp3', gain: 'brushAir', peak: 0.415 },
    'brush-hit': { file: 'combat_brush_hit.mp3', gain: 'brushHit' },
    'brush-ground': { file: 'combat_brush_ground.mp3', gain: 'brushGround' },
    'paint-throw': { file: 'combat_lava_throw.mp3', gain: 'paintThrow' },
    'paint-land': { file: 'combat_lava_land.mp3', gain: 'paintLand' },
    'paint-hit': { file: 'combat_lava_hit.mp3', gain: 'paintHit' },
    phase2: { file: 'combat_phase2.mp3', gain: 'phase2', offset: 0.7, jitter: false },
    'claw-air': { file: 'combat_claw_air.mp3', gain: 'clawAir', peak: 0.088 },
    'claw-hit': { file: 'combat_claw_hit.mp3', gain: 'clawHit' },
    'sword-air': { file: 'combat_sword_air.mp3', gain: 'swordAir', peak: 0.171 },
    'sword-hit': { file: 'combat_sword_hit.mp3', gain: 'swordHit' },
  },
  rateJitter: 0.06,
  gainJitter: 0.1,
  minGap: 0.08,
  lead: 0.01,
};

export class CombatSfx {
  constructor() {
    this.buffers = new Map(); // file name -> AudioBuffer
    this.log = [];            // last 50 calls: { name, at, played, when, offset, rate }
    this.counts = {};         // event name -> plays started
    this.random = Math.random; // replaceable by a test
    this._loading = null;
    this._lastAt = {};        // event name -> audio clock of the last start
  }

  /** Downloads and decodes the files ahead of time (once; no sound, no context created). */
  preload() {
    if (this._loading) return this._loading;
    if (!canLoadSounds()) return Promise.resolve(null);
    const c = decodingContext();
    if (!c) return Promise.resolve(null);
    const files = [...new Set(Object.values(SFX.events).map((e) => e.file))];
    this._loading = Promise.all(files.map((name) => loadSound(c, name)
      .then((buf) => { this.buffers.set(name, buf); })))
      .then(() => true)
      .catch((err) => {
        console.warn('[audio] combat sound effects not loaded:', err);
        this._loading = null; // retry on the next preload
        return null;
      });
    return this._loading;
  }

  /**
   * Plays an event of `SFX.events`.
   * @param {string} name event name
   * @param {{eta?: number}} [opts] `eta` (s): delay until the peak of the sound should land; without it the sound starts now
   * @returns {boolean} true if a sound started
   */
  play(name, { eta } = {}) {
    const spec = SFX.events[name];
    if (!spec) return false;
    const ctx = currentAudioContext();
    const buf = this.buffers.get(spec.file);
    const entry = { name, at: Math.round(performance.now()), played: false, when: null, offset: 0, rate: 1 };
    this.log.push(entry);
    if (this.log.length > 50) this.log.shift();
    if (!ctx || ctx.state !== 'running' || !buf) return false;
    const now = ctx.currentTime;
    if (now - (this._lastAt[name] ?? -Infinity) < SFX.minGap) return false;
    const vary = spec.jitter !== false;
    const rate = vary ? 1 + SFX.rateJitter * (this.random() * 2 - 1) : 1;
    const gain = VOLUMES.combat[spec.gain] * (vary ? 1 + SFX.gainJitter * (this.random() * 2 - 1) : 1);
    // Peak of the file aligned on `eta`: delayed start when early, skipping into the file otherwise.
    let wait = 0, offset = spec.offset ?? 0;
    if (Number.isFinite(eta) && spec.peak) {
      const lead = spec.peak / rate;
      wait = Math.max(0, eta - lead);
      offset += Math.max(0, lead - eta) * rate;
    }
    const src = ctx.createBufferSource();
    const out = ctx.createGain();
    try {
      src.buffer = buf;
      src.playbackRate.value = rate;
      out.gain.value = gain;
      src.connect(out).connect(ctx.destination);
      src.onended = () => { src.disconnect(); out.disconnect(); };
      src.start(now + SFX.lead + wait, Math.min(offset, Math.max(0, buf.duration - 0.02)));
    } catch (err) {
      src.disconnect(); out.disconnect();
      console.warn(`[audio] sound effect ${name} not played:`, err);
      return false;
    }
    this._lastAt[name] = now;
    this.counts[name] = (this.counts[name] ?? 0) + 1;
    entry.played = true; entry.when = Math.round((now + wait) * 1000) / 1000; entry.offset = Math.round(offset * 1000) / 1000;
    entry.rate = Math.round(rate * 1000) / 1000;
    return true;
  }

  /** Debug snapshot: context, decoded files, counters and last 10 calls. */
  get state() {
    const ctx = currentAudioContext();
    return {
      context: ctx?.state ?? null,
      loaded: [...this.buffers.keys()].sort(),
      counts: { ...this.counts },
      log: this.log.slice(-10),
    };
  }
}
