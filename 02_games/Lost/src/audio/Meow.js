/**
 * Cat meows on the shared audio context (context.js), one voice per cat. The kitten, Maman and the Chartiste play real
 * cat recordings (public/sounds/, mp3); the Chagicien always uses a synthesized voice. Synthesis: a sawtooth whose
 * pitch rises then falls, two formants and a low-pass that open and close like a mouth, a soft attack and a breathy end.
 *
 * Files are fetched and decoded when the module is imported (OfflineAudioContext, no player gesture). Until a file is
 * decoded, or if it is missing, the synthesized voice from VOICES plays instead.
 *
 * - `meow(voice, { delay, variant, call })`: used by Story.js; plays now or after `delay` s and returns the duration (s);
 * - `meowPlan(voice, variant)`: curves of the synthesized voice, without Web Audio (can run under Node);
 * - `meowLog`: last 50 calls, `{ voice, at, played, source, file }` (`at`: `performance.now()` at the start of the
 *   sound; `source`: 'file' or 'synth'; `file`: file name or null).
 */

import { currentAudioContext } from './context.js';
import { VOLUMES } from './volumes.js';
import { canLoadSounds, decode, decodingContext, fetchSound } from './loadSound.js';

/**
 * Timbres (NPC `kind` ids, plus `kitten`). `pitch` and `open`: keys [relative time 0..1, value], pitch in Hz; `open`: mouth
 * opening (0 closed "m", 1 open "a"); `tract`: formant scale (small cat = high formants); `vibrato.depth`: fraction of the
 * pitch; `breath`: [breath during, breath at the end]; `duration`, `attack` and `release` in s; `gain`: output gain
 * (`VOLUMES.meow.synth` in volumes.js).
 */
export const VOICES = {
  // Kitten: high, short, cute.
  kitten: {
    duration: 0.42, pitch: [[0, 720], [0.35, 1050], [1, 640]],
    vibrato: { rate: 7, depth: 0.012, from: 0.3, to: 0.9 },
    open: [[0, 0.1], [0.35, 1], [1, 0.25]], tract: 1.4,
    attack: 0.04, release: 0.12, breath: [0.04, 0.18], gain: VOLUMES.meow.synth.kitten,
  },
  // Maman: lower, longer, soft and reassuring (slow attack, light vibrato).
  maman: {
    duration: 0.85, pitch: [[0, 400], [0.4, 580], [1, 340]],
    vibrato: { rate: 5, depth: 0.01, from: 0.35, to: 0.95 },
    open: [[0, 0.05], [0.4, 0.85], [1, 0.15]], tract: 0.95,
    attack: 0.09, release: 0.25, breath: [0.03, 0.15], gain: VOLUMES.meow.synth.maman,
  },
  // Chagicien: mad-scientist voice: quick rise, fast trill, dip, then a small questioning rise.
  chagicien: {
    duration: 0.72, pitch: [[0, 520], [0.18, 920], [0.62, 760], [0.78, 600], [1, 860]],
    vibrato: { rate: 12, depth: 0.05, from: 0.18, to: 0.62 },
    open: [[0, 0.1], [0.2, 1], [0.65, 0.7], [0.8, 0.3], [1, 0.6]], tract: 1.15,
    attack: 0.03, release: 0.1, breath: [0.03, 0.12], gain: VOLUMES.meow.synth.chagicien,
  },
  // Chartiste: low, slow, gliding, breathy and suave (slow, wide vibrato).
  chartiste: {
    duration: 1.1, pitch: [[0, 230], [0.45, 330], [1, 185]],
    vibrato: { rate: 4.5, depth: 0.022, from: 0.3, to: 1 },
    open: [[0, 0.05], [0.45, 0.9], [1, 0.1]], tract: 0.8,
    attack: 0.12, release: 0.35, breath: [0.12, 0.4], gain: VOLUMES.meow.synth.chartiste,
  },
};

/**
 * Recordings per voice (public/sounds/): `files` alternate with `variant`, `call` is the long call, `gain` is the output
 * gain (`VOLUMES.meow.file` in volumes.js). A voice missing from this table is synthesized only.
 */
export const SAMPLES = {
  kitten: { files: ['kitten_1.mp3', 'kitten_2.mp3', 'kitten_3.mp3'], call: ['kitten_long.mp3'], gain: VOLUMES.meow.file },
  maman: { files: ['maman_1.mp3', 'maman_2.mp3'], gain: VOLUMES.meow.file },
  chartiste: { files: ['chartiste_1.mp3', 'chartiste_2.mp3'], gain: VOLUMES.meow.file },
};
/** Playback-rate spread (hence pitch) from one variant to another: +/- 3%. */
const RATE_JITTER = 0.03;

/** Curve points per second (setValueCurveAtTime interpolates linearly between them). */
const RATE = 200;
/** Base vowels (F1, F2 in Hz): closed "i/m", open "a", end "oo". */
const VOWEL = { closed: [350, 2000], open: [900, 1500], end: [400, 850] };
/** Mouth low-pass (Hz, before `tract`): closed, open. */
const MOUTH = [800, 3500];
/** Margin before the sound starts (s), so nothing is ever scheduled in the past. */
const LEAD = 0.01;
const LOG_MAX = 50;

/** Last 50 `meow` calls (oldest first). */
export const meowLog = [];

const smooth = (x) => x * x * (3 - 2 * x);
const clamp01 = (x) => Math.min(1, Math.max(0, x));
/** Smooth 0 to 1 ramp (squared sine), with no steep slope at the ends: no click. */
const ramp = (x) => Math.sin(Math.PI / 2 * clamp01(x)) ** 2;

/** Smoothed value of the keys `keys` ([u, v]) at relative time `u`; `log`: on a logarithmic scale. */
function interp(keys, u, log = false) {
  let i = 0;
  while (i < keys.length - 2 && u > keys[i + 1][0]) i++;
  const [u0, v0] = keys[i], [u1, v1] = keys[i + 1];
  const k = smooth(clamp01((u - u0) / (u1 - u0)));
  return log ? v0 * (v1 / v0) ** k : v0 + (v1 - v0) * k;
}

/** Deterministic pseudo-random number in [-1, 1] for variant `n` (0 gives 0). */
function jitter(n, salt) {
  if (!n) return 0;
  let x = Math.imul((n | 0) ^ salt, 0x9e3779b1);
  x ^= x >>> 15; x = Math.imul(x, 0x85ebca6b); x ^= x >>> 13;
  return ((x >>> 0) / 0xffffffff) * 2 - 1;
}

function resolve(voice) {
  if (Object.hasOwn(VOICES, voice)) return voice;
  console.warn(`[audio] unknown meow voice: ${voice} (using the kitten voice instead)`);
  return 'kitten';
}

/**
 * Plan of a meow, without Web Audio. `variant` (integer) shifts pitch by +/- 5% and duration by +/- 8%, always the same
 * way for the same integer (0 = base timbre). Curves are Float32Arrays with a point about every 1/RATE s, from 0 to
 * `duration`: `pitch` (Hz), `gain` (envelope 0..1, zero at both ends), `f1`, `f2` (formants, Hz), `cutoff` (low-pass, Hz),
 * `breath` (0..1, zero at both ends).
 */
function meowPlan(voice, variant = 0) {
  const name = resolve(voice);
  const v = VOICES[name];
  const pitchMul = 1 + 0.05 * jitter(variant, 0x51);
  const duration = v.duration * (1 + 0.08 * jitter(variant, 0xa7));
  const n = Math.max(2, Math.ceil(duration * RATE) + 1);
  const pitch = new Float32Array(n), gain = new Float32Array(n), f1 = new Float32Array(n);
  const f2 = new Float32Array(n), cutoff = new Float32Array(n), breath = new Float32Array(n);
  const { rate, depth, from, to } = v.vibrato;
  const [bDuring, bEnd] = v.breath;
  for (let i = 0; i < n; i++) {
    const u = i / (n - 1), t = u * duration;
    // Vibrato (or trill) only between `from` and `to`, with a fade in and out.
    const vib = ramp((u - from) / 0.1) * ramp((to - u) / 0.1);
    pitch[i] = interp(v.pitch, u, true) * pitchMul * (1 + depth * vib * Math.sin(2 * Math.PI * rate * t));
    const o = clamp01(interp(v.open, u));
    // Envelope: squared-sine attack and release, slightly louder with the mouth open.
    const edges = ramp(t / v.attack) * ramp((duration - t) / v.release);
    gain[i] = edges * (0.75 + 0.25 * o);
    // Formants: closed vowel gliding from "i/m" (start) to "oo" (end), opening toward "a" with `o`.
    const k = smooth(u);
    const s1 = VOWEL.closed[0] + (VOWEL.end[0] - VOWEL.closed[0]) * k;
    const s2 = VOWEL.closed[1] + (VOWEL.end[1] - VOWEL.closed[1]) * k;
    f1[i] = v.tract * (s1 + (VOWEL.open[0] - s1) * o);
    f2[i] = v.tract * (s2 + (VOWEL.open[1] - s2) * o);
    cutoff[i] = v.tract * (MOUTH[0] + (MOUTH[1] - MOUTH[0]) * o);
    // Breath: light during the sound, stronger over the last 40%, zero at both ends.
    breath[i] = (bDuring + (bEnd - bDuring) * smooth(clamp01((u - 0.6) / 0.4))) * edges;
  }
  let max = 0, maxAt = 0;
  for (let i = 0; i < n; i++) if (pitch[i] > max) { max = pitch[i]; maxAt = (i / (n - 1)) * duration; }
  return {
    voice: name, variant, duration, gainOut: v.gain, tract: v.tract,
    start: pitch[0], max, maxAt, end: pitch[n - 1],
    pitch, gain, f1, f2, cutoff, breath,
  };
}

/** One second of white noise per context (reused by every meow). */
const noiseBuffers = new WeakMap();
function noiseBuffer(ctx) {
  let buf = noiseBuffers.get(ctx);
  if (!buf) {
    buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    noiseBuffers.set(ctx, buf);
  }
  return buf;
}

/**
 * Plays plan `p` at context time `t0`. Nodes are stored in `nodes` as they are created and released at the end
 * (or by the caller if scheduling fails).
 */
function play(ctx, p, t0, nodes) {
  const d = p.duration;
  const add = (node) => { nodes.push(node); return node; };
  const filter = (type, q) => { const f = add(ctx.createBiquadFilter()); f.type = type; f.Q.value = q; return f; };

  // Voice: sawtooth -> low-pass (mouth) -> two formants plus some direct signal.
  const osc = add(ctx.createOscillator());
  osc.type = 'sawtooth';
  osc.frequency.setValueCurveAtTime(p.pitch, t0, d);
  const mouth = filter('lowpass', 0.7);
  mouth.frequency.setValueCurveAtTime(p.cutoff, t0, d);
  const bp1 = filter('bandpass', 3);
  bp1.frequency.setValueCurveAtTime(p.f1, t0, d);
  const bp2 = filter('bandpass', 5);
  bp2.frequency.setValueCurveAtTime(p.f2, t0, d);
  const dry = add(ctx.createGain()); dry.gain.value = 0.35;
  const g2 = add(ctx.createGain()); g2.gain.value = 0.6;
  const env = add(ctx.createGain());
  env.gain.value = 0;
  env.gain.setValueCurveAtTime(p.gain, t0, d);

  // Breath: white noise filtered around the high formants, louder at the end.
  const noise = add(ctx.createBufferSource());
  noise.buffer = noiseBuffer(ctx);
  noise.loop = true;
  const hiss = filter('bandpass', 0.8);
  hiss.frequency.value = 2500 * p.tract;
  const breath = add(ctx.createGain());
  breath.gain.value = 0;
  breath.gain.setValueCurveAtTime(p.breath, t0, d);

  const out = add(ctx.createGain());
  out.gain.value = p.gainOut;

  osc.connect(mouth);
  mouth.connect(bp1).connect(env);
  mouth.connect(bp2).connect(g2).connect(env);
  mouth.connect(dry).connect(env);
  env.connect(out);
  noise.connect(hiss).connect(breath).connect(out);
  out.connect(ctx.destination);

  // End: both sources stop together; the first `ended` event disconnects every node.
  let freed = false;
  const free = () => {
    if (freed) return;
    freed = true;
    for (const node of nodes) node.disconnect();
  };
  osc.onended = free;
  noise.onended = free;
  const stop = t0 + d + 0.02;
  osc.start(t0); noise.start(t0);
  osc.stop(stop); noise.stop(stop);
}

// ------------------------------------------------------------------ recordings

/** Decoded files (name -> AudioBuffer); an AudioBuffer can be played on any context. */
const buffers = new Map();
/** Downloaded files not decoded yet (name -> ArrayBuffer), for lack of a decoding context. */
const raw = new Map();

/** Decodes the pending files on `ctx`; a failure leaves the synthesized voice as the fallback. */
function decodeRaw(ctx) {
  for (const [name, data] of raw) {
    raw.delete(name);
    decode(ctx, data).then(
      (buf) => buffers.set(name, buf),
      (err) => console.warn(`[audio] ${name} not decoded (using the synthesized voice instead):`, err),
    );
  }
}

/** Downloads and decodes every file of SAMPLES (once); called when the module is imported. */
function preloadMeows() {
  if (!canLoadSounds()) return;
  const names = new Set(Object.values(SAMPLES).flatMap((s) => [...s.files, ...(s.call ?? [])]));
  for (const name of names) {
    if (buffers.has(name) || raw.has(name)) continue;
    fetchSound(name)
      .then((data) => {
        raw.set(name, data);
        const c = decodingContext();
        if (c) decodeRaw(c);
      })
      .catch((err) => console.warn(`[audio] ${name} not loaded (using the synthesized voice instead):`, err));
  }
}

/** File chosen for `voice` and `variant`: `{ name, buffer, gain }` (buffer null if not decoded), or null. */
function pickSample(voice, variant, call) {
  const s = SAMPLES[voice];
  const list = s && (call && s.call ? s.call : s.files);
  if (!list?.length) return null;
  const n = list.length, k = Math.abs(variant | 0) % n;
  return { name: list[k], buffer: buffers.get(list[k]) ?? null, gain: s.gain };
}

/** Plays `buf` at time `t0`, with speed `rate` and gain `gain`; nodes are released at the end. */
function playFile(ctx, buf, t0, rate, gain) {
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.playbackRate.value = rate;
  const out = ctx.createGain();
  out.gain.value = gain;
  src.connect(out).connect(ctx.destination);
  src.onended = () => { src.disconnect(); out.disconnect(); };
  try { src.start(t0); } catch (err) { src.disconnect(); out.disconnect(); throw err; }
}

/**
 * Plays a meow of voice `voice` now, or after `opts.delay` seconds. A recording not decoded yet, or a voice without
 * recordings, uses the synthesized voice.
 * @param {string} voice voice id (`VOICES` key); an unknown id falls back to the kitten
 * @param {{delay?: number, variant?: number, call?: boolean}} [opts] `variant` alternates the recordings and varies the pitch slightly; `call` plays the long call
 * @returns {number} duration (s), even if nothing is played (context missing or not running)
 */
export function meow(voice, opts = {}) {
  const { delay = 0, variant = 0, call = false } = opts;
  const name = resolve(voice);
  const wait = Math.max(0, Number(delay) || 0) + LEAD;
  const ctx = currentAudioContext();
  if (ctx && raw.size) decodeRaw(ctx); // no offline context: decode on the shared context
  const sample = pickSample(name, variant, call);
  const rate = 1 + RATE_JITTER * jitter(variant, 0x3c);
  const p = sample?.buffer ? null : meowPlan(name, variant);
  const duration = p ? p.duration : sample.buffer.duration / rate;
  let played = false;
  if (ctx && ctx.state === 'running') {
    const nodes = [];
    try {
      if (p) play(ctx, p, ctx.currentTime + wait, nodes);
      else playFile(ctx, sample.buffer, ctx.currentTime + wait, rate, sample.gain);
      played = true;
    } catch (err) {
      for (const node of nodes) { try { node.disconnect(); } catch { /* already released */ } }
      console.warn('[audio] meow not played:', err);
    }
  }
  const now = globalThis.performance?.now?.() ?? Date.now();
  meowLog.push({ voice: name, at: now + wait * 1000, played, source: p ? 'synth' : 'file', file: p ? null : sample.name });
  if (meowLog.length > LOG_MAX) meowLog.splice(0, meowLog.length - LOG_MAX);
  return duration;
}

preloadMeows();
