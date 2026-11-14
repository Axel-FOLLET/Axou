/**
 * Timeline and layout of the sword cutscene (stage `../sword.js`): every number that shapes the scene lives here, with
 * its unit and its reason. Pure data and pure functions (no THREE, no DOM), so the module also feeds `SOUND_CUES`.
 *
 * Two clocks. `t` is the video clock (0 to DURATION, real seconds, what the viewer sees). `tau` is the story clock:
 * the same events, but the video clock runs slower than it around the catch (slow motion). Actors are driven from
 * `tau`; cameras and the video length from `t`. `tauAt(t)` and `tAt(tau)` convert.
 *
 * Space. The scene uses a local frame centred on the stone: axis `a` runs from the boss towards the stone (and beyond
 * it), axis `b` runs to the right of that direction seen from above, `h` is the height above the ground.
 */

/** Video length (s): roadmap session 11 B, cutscene 2 ("7 s"). */
export const DURATION = 7;

/**
 * Slow motion around the catch, in story seconds: the video clock runs `1 / rate` times slower than the story between
 * `from` and `to`, with `ramp` seconds of smooth entry and exit. The catch is the one gesture the whole scene is
 * about; at normal speed the mouth closes on the grip in about two frames.
 */
export const SLOW = { from: 3.05, to: 3.75, rate: 0.45, ramp: 0.2 };

/**
 * Story events (story seconds). Order: the kitten sees the sword, runs, the boss raises his brush and strikes, the
 * kitten dodges, the stone splits and the sword flies, the kitten leaps and catches it, lands on guard.
 * - `notice`: the kitten's gaze goes to the sword (head turn) and the golden column of light brightens.
 * - `run`: the kitten starts running (the `run` clip, 4.15 m/s at full speed).
 * - `windup`: the boss starts `BrushSwing` (clip time 0); the brush rises in 0.27 s and is up at 0.75 s.
 * - `impact`: clip time `STRIKE_CLIP` of `BrushSwing`: the brush hits the ground ("strike" key of the game's boss
 *   rules, `FIGHT.boss.strike` 0.88 s). The stone splits, the sword leaves it. Derived from `windup`.
 * - `catch`: the mouth closes on the grip, in the air.
 */
export const STRIKE_CLIP = 0.88;
export const EVENTS = { notice: 0.3, run: 0.6, windup: 1.12, impact: 1.12 + STRIKE_CLIP, catch: 3.4 };

/**
 * Kitten route in the local frame (metres), as timed knots `[tau, a, b]` (cubic Hermite, zero speed at both ends):
 * it starts on the camera side, runs towards the stone, crosses the strike line just ahead of the brush, and stops
 * beyond it, facing the place where the sword will come down. `tauStop` (the instant the leap clip starts) closes it.
 */
export function buildRoute(tauStop) {
  return [
    [EVENTS.run, 3.7, 2.4],
    [0.95, 3.0, 1.9],
    [1.3, 1.8, 1.05],
    [1.7, 0.55, 0.1],
    [2.0, -0.5, -0.85],
    [tauStop, -0.9, -1.2],
  ];
}

/**
 * Leap clips: instants (clip seconds) of the crouch end/launch, the catch in the air, the landing and the end.
 * `Pounce` is the existing clip used while `LeapCatch` is not in cat.glb; its catch instant is chosen in the air.
 * `advance` (m): how far the root travels forward between launch and landing (the clip is in place, the game moves
 * the root, as `Brain` does for the pounce).
 */
export const LEAP_CLIPS = {
  Pounce: { launch: 0.75, catch: 0.93, land: 1.08, end: 1.54, advance: 0.45 },
  // Task 03 (taches/03_clips_chaton.md): push 0.33 s, jaws close at LEAP_T_CATCH 0.75 s, paws touch 1.08 s, 1.667 s long;
  // the clip is in place, LEAP_TRAVEL 8 rig units (about 0.69 m) of root travel between push and touch.
  LeapCatch: { launch: 0.33, catch: 0.75, land: 1.08, end: 1.667, advance: 0.69 },
};

/** Sword flight: `apex` (m above the ground) is the top of the arc; `turns` full rotations in the air. */
export const FLIGHT = { apex: 1.85, turns: 3 };

const ease = (x) => { const c = Math.min(Math.max(x, 0), 1); return c * c * (3 - 2 * c); };

/** Speed of the story clock against the video clock (1 outside the slow motion, `rate` inside, eased). */
function storySpeed(tau) {
  const { from, to, rate, ramp } = SLOW;
  const inside = ease((tau - from) / ramp) * (1 - ease((tau - (to - ramp)) / ramp));
  return 1 - (1 - rate) * inside;
}

// Video time at each millisecond of story time, up to TAU_MAX.
const STEP = 1 / 1000;
const TAU_MAX = 12;
const N = Math.round(TAU_MAX / STEP);
const T = new Float64Array(N + 1);
for (let i = 1; i <= N; i++) T[i] = T[i - 1] + STEP * (1 / storySpeed((i - 0.5) * STEP));

/** Video time (s) at story time `tau` (s). */
export function tAt(tau) {
  const x = Math.min(Math.max(tau, 0), TAU_MAX) / STEP;
  const i = Math.min(Math.floor(x), N - 1);
  return T[i] + (T[i + 1] - T[i]) * (x - i);
}

/** Story time (s) at video time `t` (s). */
export function tauAt(t) {
  if (t <= 0) return 0;
  let lo = 0;
  let hi = N;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (T[mid] <= t) lo = mid; else hi = mid;
  }
  return (lo + (t - T[lo]) / (T[hi] - T[lo])) * STEP;
}

/** Story length (s) of the whole video. */
export const TAU_END = tauAt(DURATION);

/**
 * Sound moments for session 11 B2, in video seconds. Names are in English; the sound designer maps them to files.
 * Story instants go through `tAt`, so the list follows the slow motion.
 */
export const SOUND_CUES = [
  { t: tAt(EVENTS.notice), cue: 'sword glint, a rising chime (the kitten notices the sword)' },
  { t: tAt(EVENTS.run), cue: 'kitten starts running, paws on the arena floor (loop until the stop)' },
  { t: tAt(EVENTS.windup), cue: 'giant brush lifted, fur and air whoosh (boss wind-up)' },
  { t: tAt(EVENTS.impact) - 0.4, cue: 'giant brush falling, air whistle (peak 0.4 s before the impact)' },
  { t: tAt(1.75), cue: 'kitten dashes across the strike line, a skid on the floor' },
  { t: tAt(EVENTS.impact), cue: 'brush hits the ground, heavy paint impact' },
  { t: tAt(EVENTS.impact), cue: 'stone cracks and splits in two, rock crack' },
  { t: tAt(EVENTS.impact + 0.05), cue: 'sword torn out of the stone, metal ring and whoosh' },
  { t: tAt(EVENTS.impact + 0.15), cue: 'stone chips and paint droplets falling' },
  { t: tAt(2.7), cue: 'sword spinning in the air, soft whirr (during the rise)' },
  { t: tAt(EVENTS.catch - 0.6), cue: 'kitten crouches, then leaps, a push-off' },
  { t: tAt(EVENTS.catch), cue: 'jaws close on the sword grip, metal clack' },
  { t: tAt(EVENTS.catch + 0.3), cue: 'kitten lands with the sword, light paw landing' },
  { t: DURATION - 1.6, cue: 'blade settles in the mouth, a short steel ring (final close-up)' },
  { t: DURATION - 0.8, cue: 'low determined growl or breath, the fight resumes' },
];
