/**
 * Synthesized cat purr (Web Audio, no audio file), played on the shared context of context.js. main.js creates one
 * for petting and two for the hug (kitten and Maman).
 */

import { currentAudioContext } from './context.js';
import { VOLUMES } from './volumes.js';

/**
 * Default settings, tuned by ear (the kitten's): `lowpass`, `chop`, `breath` and `tone` in Hz, `gain` linear
 * (`VOLUMES.purr.pet` in volumes.js). Maman's purr, lower with a shifted breath, is passed to the constructor by main.js.
 */
export const PURR = { lowpass: 140, chop: 26, breath: 0.55, tone: 52, gain: VOLUMES.purr.pet };

/**
 * A low rumble (brown noise filtered at `lowpass` Hz) chopped at `chop` Hz like a real purr, with a slow breathing
 * envelope (`breath` Hz) and a soft fundamental (`tone` Hz). No context is created here: without one (before the
 * Play button), `start` does nothing. Readable state: `active` (purr requested), `level` (current output gain).
 */
export class Purr {
  /** @param {Partial<typeof PURR>} [opts] settings overriding those of PURR */
  constructor(opts = {}) {
    this.opts = { ...PURR, ...opts };
    this.ctx = null;
    this.master = null;
    this.active = false;
  }

  /** Current output gain (0 without a context). */
  get level() { return this.master?.gain.value ?? 0; }

  _init() {
    const ctx = currentAudioContext();
    if (!ctx) return false;
    const o = this.opts;
    const seconds = 2;
    const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < data.length; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.5;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;

    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = o.lowpass;
    lowpass.Q.value = 0.8;

    // Chopping (26 Hz for the kitten): gain modulated by an oscillator (0.5 +/- 0.5).
    const chop = ctx.createGain();
    chop.gain.value = 0.5;
    const chopOsc = ctx.createOscillator();
    chopOsc.frequency.value = o.chop;
    const chopDepth = ctx.createGain();
    chopDepth.gain.value = 0.5;
    chopOsc.connect(chopDepth).connect(chop.gain);

    // Breathing: slow envelope, inhale slightly higher-pitched than exhale.
    const breath = ctx.createGain();
    breath.gain.value = 0.7;
    const breathOsc = ctx.createOscillator();
    breathOsc.frequency.value = o.breath;
    const breathDepth = ctx.createGain();
    breathDepth.gain.value = 0.3;
    breathOsc.connect(breathDepth).connect(breath.gain);
    const pitchDepth = ctx.createGain();
    pitchDepth.gain.value = 3;
    breathOsc.connect(pitchDepth).connect(chopOsc.frequency);

    // Body: soft fundamental (52 Hz for the kitten), chopped as well.
    const tone = ctx.createOscillator();
    tone.type = 'triangle';
    tone.frequency.value = o.tone;
    const toneGain = ctx.createGain();
    toneGain.gain.value = 0.12;

    const master = ctx.createGain();
    master.gain.value = 0;
    noise.connect(lowpass).connect(chop);
    tone.connect(toneGain).connect(chop);
    chop.connect(breath).connect(master).connect(ctx.destination);
    noise.start(); chopOsc.start(); breathOsc.start(); tone.start();
    this.ctx = ctx;
    this.master = master;
    return true;
  }

  start() {
    if (!this.ctx && !this._init()) return;
    this.active = true;
    if (this.ctx.state !== 'running') {
      try { this.ctx.resume?.()?.catch?.(() => {}); } catch { /* resume rejected: stay silent */ }
    }
    const now = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setTargetAtTime(this.opts.gain, now, 0.3);
  }

  stop() {
    this.active = false;
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setTargetAtTime(0, now, 0.35);
  }
}
