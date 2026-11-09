/**
 * Looping background music on the shared audio context (context.js). Files are rendered by `tools/render_music.py`.
 * Created by main.js, which reports the boss health every frame; soundtrack.js decides which track plays.
 *
 * - meadow: exploration, from the Play button to the end screen, cut during the boss fight;
 * - boss: two parts, each an intro played once then a loop. The slow phase (12 s rise, 96 s loop at 60 bpm) opens the
 *   fight; the march (16 s solo voice, 5 s hit, 85 s loop at 96 bpm) takes over at half boss health (`setBossFraction`)
 *   or on the phase 2 signal (`setBossPhase2`). The switch happens once per fight and never goes back;
 * - mountain: snowy mountain, from the entry of zone 2.
 *
 * No audio context is created here: without one (before Play), `play` only records the requested track. Files are
 * fetched and decoded on an OfflineAudioContext, with no player gesture.
 *
 * Loop files hold [PAD s of the end][loop of `loop` s][PAD s of the start] and playback loops from PAD to PAD + loop, so
 * an MP3 decoder delay shorter than PAD falls in the copied margin and the seam does not change. An intro has no margin:
 * it plays once, the loop starts `lead` s later on the audio clock, and the intro tail (7 s of resonance) ends under it.
 */

import { currentAudioContext } from './context.js';
import { VOLUMES } from './volumes.js';
import { canLoadSounds, decodingContext, loadSound } from './loadSound.js';

/**
 * `master` and `tracks` are linear gains from volumes.js; `MUSIC.tracks` is the same object as `VOLUMES.music.tracks`.
 * Fades use setTargetAtTime with tau = fade / 3, so 95% of the change is done at the end of the fade.
 *
 * | Setting        | Value | Reason |
 * |----------------|-------|--------|
 * | boss.marchAt   | 0.50  | Boss health fraction where the march starts: same threshold as combat phase 2 (difficulty.js, `phase2.at`). |
 * | boss.marchSkip | 0     | Seconds skipped at the start of the march intro (0 to 21): 0 plays the 16 s solo voice in full, 16 starts on the hit. |
 * | fade.in        | 2.5   | Seconds. Meadow music after Play: a soft start under the first speech bubble. |
 * | fade.out       | 1.5   | Seconds. Normal exit of a replaced track. |
 * | fade.toBoss    | 1.2   | Seconds. Start of the fight: exit of the current track, quick enough to mark the moment. |
 * | fade.toMarch   | 1.5   | Seconds. Switch to the march: the slow phase fades while the solo voice begins. |
 * | fade.attack    | 0.05  | Seconds. Entry of a track with an `intro`: the piece has its own attack, 0.05 s only avoids a click. |
 * | fade.victory   | 4     | Seconds. Victory: the fight dies away slowly while the meadow music returns. |
 * | fade.stop      | 1.2   | Seconds. End or title screen: quick silence without a hard cut. |
 */
export const MUSIC = {
  master: VOLUMES.music.master,
  tracks: VOLUMES.music.tracks,
  boss: { marchAt: 0.5, marchSkip: 0 },
  fade: { in: 2.5, out: 1.5, toBoss: 1.2, toMarch: 1.5, attack: 0.05, victory: 4, stop: 1.2 },
};

/** Seconds copied on each side of the loop (tools/render_music.py, PAD). */
const PAD = 0.25;

/**
 * Tracks: `file` (loop) and `loop` (exact loop length, s); optional `intro` (file played once), `lead` (s between the
 * start of the intro and the start of the loop) and `volume` (key in MUSIC.tracks when it differs from the track name).
 * `bossMarch` cannot be requested directly: it is the second part of `boss`.
 */
export const TRACKS = {
  meadow: { file: 'music_meadow.mp3', loop: 160 / 3 },
  boss: { intro: 'music_boss_slow_intro.mp3', lead: 12, file: 'music_boss_slow.mp3', loop: 96 }, // 96 beats at 60 bpm
  bossMarch: { intro: 'music_boss_march_intro.mp3', lead: 21, file: 'music_boss_march.mp3', loop: 85, volume: 'boss' }, // 136 beats at 96 bpm
  mountain: { file: 'music_mountain.mp3', loop: 48 },
};

const clamp01 = (v) => Math.min(1, Math.max(0, v));

export class Music {
  constructor() {
    this.track = null; // requested track (null: silence)
    this.bossFraction = 1; // boss health / max health (1 outside combat)
    this.march = false; // boss music has switched to the march (once per fight)
    this._armed = false; // boss health seen above boss.marchAt since its music started
    this.voices = []; // { name, out, srcs, t0, lead, leaving }
    this.buffers = new Map(); // track name -> AudioBuffer[] ([intro, loop] or [loop])
    this._loads = new Map(); // track name -> promise
    this._pending = null; // track waiting for decoding
    this._token = 0;
    this._master = null;
    this.log = []; // last 30 calls: { at, what, track }
  }

  /** Downloads and decodes tracks ahead of time (no sound, no context created). */
  preload(names) {
    for (const n of names) this._load(n);
  }

  _load(name) {
    if (this._loads.has(name)) return this._loads.get(name);
    if (!canLoadSounds()) return Promise.resolve(null);
    const c = decodingContext();
    if (!c) return Promise.resolve(null);
    const spec = TRACKS[name];
    const files = spec.intro ? [spec.intro, spec.file] : [spec.file];
    const p = Promise.all(files.map((f) => loadSound(c, f)))
      .then((bufs) => { this.buffers.set(name, bufs); return bufs; })
      .catch((err) => {
        console.warn(`[audio] music ${name} not loaded:`, err);
        this._loads.delete(name); // retry on the next play
        return null;
      });
    this._loads.set(name, p);
    return p;
  }

  _note(what) {
    this.log.push({ at: Math.round(performance.now()), what, track: this.track });
    if (this.log.length > 30) this.log.shift();
  }

  /** Voice that should be sounding for the requested track: the march once the switch has happened. */
  get wanted() {
    return this.track === 'boss' && this.march ? 'bossMarch' : this.track;
  }

  /** True if the requested track is playing or about to play (decoding in progress). */
  get sounding() {
    const w = this.wanted;
    return !!w && (this._pending === w || this.voices.some((v) => v.name === w && !v.leaving));
  }

  _out(ctx) {
    if (!this._master || this._master.context !== ctx) {
      this._master = ctx.createGain();
      this._master.gain.value = MUSIC.master;
      this._master.connect(ctx.destination);
    }
    return this._master;
  }

  /** The switch to the march does not outlive the fight. */
  _resetBoss() {
    this.march = false;
    this._armed = false;
  }

  /**
   * Starts a track and fades out the others. Without a context, the track is only recorded.
   * @param {string} name 'meadow', 'boss' or 'mountain'
   * @param {{fade?: number}} [opts] `fade` (s) replaces the MUSIC.fade durations
   * @returns {boolean} true if a sound is or will be started
   */
  play(name, { fade } = {}) {
    if (!TRACKS[name] || name === 'bossMarch') return false;
    if (this.track === name && this.sounding) return true;
    if (name !== 'boss') this._resetBoss();
    else if (this.track !== 'boss') this._armed = false; // new fight: the previous health does not count
    this.track = name;
    this._note('play');
    const ctx = currentAudioContext();
    if (!ctx) return false;
    const boss = name === 'boss';
    this._switch(ctx, this.wanted, fade ?? MUSIC.fade.in, fade ?? (boss ? MUSIC.fade.toBoss : MUSIC.fade.out));
    return true;
  }

  /** Fades the music out in `fade` s (MUSIC.fade.stop by default). */
  stop(fade = MUSIC.fade.stop) {
    this.track = null;
    this._resetBoss();
    this._pending = null;
    this._token++;
    this._note('stop');
    const ctx = currentAudioContext();
    if (ctx) this._release(ctx, fade);
  }

  /**
   * Boss health (0 to 1), every frame. During the boss music, the first time it goes from above `boss.marchAt` to at or
   * below it, the march replaces the slow phase.
   */
  setBossFraction(f) {
    f = clamp01(Number.isFinite(f) ? f : 1);
    this.bossFraction = f;
    if (this.track !== 'boss' || this.march) return;
    if (f > MUSIC.boss.marchAt) this._armed = true;
    else if (this._armed) this._toMarch();
  }

  /**
   * Combat phase 2 signal ('boss-phase2'). True starts the march unless it is already playing; with no boss music
   * running, the state is only recorded and the boss music then starts on the march. False (start of a fight, victory,
   * defeat, back to exploration) resets the switch: the next `play('boss')` starts on the slow phase.
   */
  setBossPhase2(on) {
    if (on) { this._toMarch(); return; }
    if (this.march) this._note('phase1');
    this._resetBoss();
  }

  _toMarch() {
    if (this.march) return;
    this.march = true;
    this._note('march');
    if (this.track !== 'boss') return;
    const ctx = currentAudioContext();
    if (ctx) this._switch(ctx, 'bossMarch', MUSIC.fade.in, MUSIC.fade.toMarch);
  }

  /** Decodes `name` if needed, then fades out the other voices (`fadeOut`) and starts it (`fadeIn`). */
  _switch(ctx, name, fadeIn, fadeOut) {
    const token = ++this._token;
    this._pending = name;
    // The old track keeps playing until the new one is decoded (the mountain track takes a few seconds on first
    // request): no gap of silence between the two.
    this._load(name).then((bufs) => {
      if (token !== this._token) return; // superseded by a newer request
      this._pending = null;
      const keep = this.voices.find((v) => v.name === name && !v.leaving) ?? null; // already playing: kept
      this._release(ctx, fadeOut, keep);
      if (bufs && !keep) this._start(ctx, name, bufs, fadeIn);
    });
  }

  _start(ctx, name, bufs, fade) {
    const spec = TRACKS[name];
    const now = ctx.currentTime;
    const t0 = now + 0.05;
    const out = ctx.createGain();
    out.gain.value = 0; // intrinsic value at 0: a stop before t0 cannot make the gain jump
    out.gain.setTargetAtTime(MUSIC.tracks[spec.volume ?? name], t0, (spec.intro ? MUSIC.fade.attack : fade) / 3);
    out.connect(this._out(ctx));
    const srcs = [];
    let lead = 0;
    if (spec.intro) { // intro played once; the loop is scheduled after it on the same audio clock
      const skip = name === 'bossMarch' ? Math.min(spec.lead, Math.max(0, MUSIC.boss.marchSkip)) : 0;
      lead = spec.lead - skip;
      const intro = ctx.createBufferSource();
      intro.buffer = bufs[0];
      intro.connect(out);
      intro.start(t0, skip);
      srcs.push(intro);
    }
    const buf = bufs[bufs.length - 1];
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    src.loopStart = PAD;
    src.loopEnd = Math.min(buf.duration, PAD + spec.loop);
    src.connect(out);
    src.start(t0 + lead, PAD);
    srcs.push(src);
    const voice = { name, out, srcs, t0, lead, leaving: false };
    src.onended = () => this._drop(voice);
    this.voices.push(voice);
  }

  _drop(voice) {
    const k = this.voices.indexOf(voice);
    if (k < 0) return;
    this.voices.splice(k, 1);
    voice.out.disconnect();
  }

  _release(ctx, fade, keep = null) {
    const now = ctx.currentTime;
    for (const v of this.voices) {
      if (v.leaving || v === keep) continue;
      v.leaving = true;
      v.out.gain.cancelScheduledValues(now);
      v.out.gain.setTargetAtTime(0, now, Math.max(0.01, fade) / 3);
      const end = Math.max(0.05, fade) * 2; // gain below 0.25% after 2 fades
      for (const s of v.srcs) s.stop(now + end);
      // A loop stopped before it started (voice left during its intro) may never signal its end: the voice is
      // removed here as well.
      setTimeout(() => this._drop(v), (end + 0.5) * 1000);
    }
  }

  /**
   * Debug snapshot: requested track, wanted voice, context, boss health, march switch, master gain, effective gains
   * (master x track, fading voices included), voices (seconds since start, loop started or not) and decoded buffers.
   */
  get state() {
    const ctx = currentAudioContext();
    const time = ctx ? ctx.currentTime : null;
    const master = this._master?.gain.value ?? null;
    const effective = { meadow: 0, boss: 0, bossMarch: 0, mountain: 0 };
    const voices = this.voices.map((v) => {
      const gain = v.out.gain.value;
      effective[v.name] += (master ?? 1) * gain;
      return { name: v.name, leaving: v.leaving, gain, since: time === null ? null : time - v.t0, inLoop: time !== null && time >= v.t0 + v.lead };
    });
    const loaded = {};
    for (const [n, bufs] of this.buffers) loaded[n] = bufs.map((b) => ({ duration: b.duration, length: b.length, sampleRate: b.sampleRate, channels: b.numberOfChannels }));
    return {
      track: this.track, wanted: this.wanted, sounding: this.sounding, pending: this._pending,
      context: ctx?.state ?? null, time,
      bossFraction: this.bossFraction, march: this.march, armed: this._armed, master,
      effective, voices, loaded, log: this.log.slice(-8),
    };
  }
}
