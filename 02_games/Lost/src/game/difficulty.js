import { LEVEL_LABELS } from './labels.js';

/**
 * Difficulty of the fight against the Chartiste: the table to adjust by playing. Every value that depends on the
 * level is here, each level on the same template. combat.js (kitten), bossMoves.js and Paint.js (boss) read them
 * as they are at the start of the duel. Units: seconds, metres, fractions of life (0 to 1). The level is chosen in
 * the challenge speech bubble (texts.js `chartisteChallenge`, Bubble.js) and applies to the next duel, until it ends.
 *
 * Settings shared by each level:
 * - `label`: name shown on the speech-bubble button.
 * - `lives`: hits that empty the kitten's bar.
 * - `canLose`: false on Easy, where the bar drops but never empties. `floor` (fraction of the bar) is its lowest
 *   value.
 * - `heal`: boss heal per brush hit landed, as a fraction of max HP, capped at max HP. A paint hit heals nothing
 *   (bossMoves.js).
 * - `first` (s): delay between control being returned and the boss's first strike.
 * - `cadence` (s): time between two strikes.
 * - `announce` (s): warning before a strike. The `BrushSwing` clip is slowed during its wind-up so the brush stays
 *   raised that long (FIGHT.boss.windup, combat.js).
 * - `rest` (s): minimum guard between the end of a strike (or combo) and the next. Without it, a delayed strike
 *   (hold up to 1.1 s) plus the clip would exceed `cadence` on Hard and strikes would run together. 0.9 s is
 *   the guard of an undelayed strike on Hard (cadence 2.5 s minus the 1.6 s clip).
 * - `delayed`: delayed strikes (brush held up longer, punishing an early dodge).
 *   - `on`: switch. `chance`: fraction of delayed strikes. `hold` (s): [min, max] of the added hold.
 *   - `track` (rad/s): speed at which the boss turns towards the kitten during the hold. At 0.7, a kitten trotting
 *     around him at 2.5 m (about 1.2 rad/s) keeps the advantage, while one that steps aside and stops is caught in
 *     under 0.6 s. The aim then locks `announce` s before impact: the boss stops turning, the brush stays raised and
 *     the kitten has the same time as for an ordinary strike to dodge again. The total hold is `hold` plus `announce`.
 * - `combo`: strike chains. `on`. `count`: [min, max] strikes in a row. `gap` (s): time between two strikes, from
 *   the end of the previous clip (the boss turns towards the kitten at `aimTurn` meanwhile).
 * - `paint`: paint attacks. `on`. `every` (s): time between two attacks, separate from the strike cadence.
 *   `shapes`: drawn at random, never the same twice in a row (`puddle`, `trail`, `zone` to flee).
 *   `grace` (s): immunity to paint after a hit (2 s: pushed back for 1.33 s, plus time to leave the puddle).
 *   Each shape: `warn` (s): ground warning, the shape never hurts before it ends. `life` (s): time it is painted
 *   and hurts. `radius` (puddle, zone) or `width` and `length` (trail), in m. `grow` (puddle, s): spread from a third
 *   of the radius to the full radius. `count` (zone): zones thrown together, the first on or next to the kitten.
 *   Drawing: Paint.js. Launch and placement: bossMoves.js.
 * - Paint dodge rule. Each shape is placed so the kitten, wherever it is, whatever its heading and without having
 *   moved, can leave it in at most `E = speed × (warn − reaction)` m, over the arena floor and without crossing
 *   another shape.
 *   - `paint.speed` (m/s): 1.843, the kitten's trot (head of GOTO in Brain.js: a close click gives at least the trot,
 *     `brisk`). The run (4.148 m/s, Cat.js) only starts beyond a 10 m click (GOTO.runFrom) or on `dash`.
 *   - `paint.reaction` (s): 0.75 = 0.3 s of player reaction plus 0.45 s to turn and start (worst case: kitten
 *     facing 180° away from its exit).
 *   - Distance to leave a disc: radius × 1.085 (wavy edge) + 0.15 m (kitten). Band: half-width × 1.06 + 0.15 m.
 *   - The kitten stays at least 0.3 m inside the shape (otherwise it does not threaten it): a disc's centre is
 *     offset from the kitten by `distance − E` to `distance − 0.3` m, and the trail is turned so the kitten is
 *     offset sideways by the same interval, plus 0.05 m of margin (`MOVES.slack`, bossMoves.js).
 *   - Changing `warn`, a radius, `speed` or `reaction` changes these offsets: the rule recomputes them. The longer
 *     `warn`, the closer the shape may land; with `warn` ≤ `reaction`, E is 0.2 m. Other zones of a launch and shapes
 *     already on the ground never close the chosen exit (free arrival point, 0.2 m margin). Only paint follows
 *     this rule.
 * - `brush`: hit zone of the brush strike. A sector of `reach` m (4.7: measured tip of the brush, `FIGHT.boss`,
 *   combat.js) and half-angle at most `angle` (0.35 rad).
 *   - Brush dodge rule. The real half-angle is the largest such that the kitten, anywhere between 1.8 m from the
 *     centre (footprint edge plus body) and `reach` m, can leave the sector sideways (D × sin(angle) + 0.15 m) or
 *     outwards (reach − D + 0.15 m), the shorter of the two, in at most `E = speed × (T − reaction)` m minus 0.05 m of
 *     margin (`MOVES.slack`). T = (`announce` + 0.13 s of clip end) / phase speed, the time from the start of the
 *     gesture to the impact.
 *   - `speed` (m/s): 1.843, trot (see the paint rule).
 *   - `reaction` (s): 0.45 = 0.3 s of player reaction plus 0.15 s to start at 90° (a sideways exit is always within
 *     90° of the kitten's heading).
 *   - The boss aims at the kitten before the gesture and then stops turning: a still kitten is hit, one that moves
 *     from the announcement is not. The rule recomputes the angle on each strike, phase included. The shorter the
 *     announcement, the tighter the sector: Hard is hard because of cadence, combos, delays and paint, not the
 *     width of the strike. Lowering `reaction` widens the sector and raising it tightens it.
 * - `phase2`: from `at` of the boss's life. `on`. `speed`: factor on the cadence, the announcement, the clip speed
 *   after the wind-up and the paint rhythm (faster when above 1). The arena changes (Arena.setPhase2) and the music
 *   switches (Duel.onPhase2).
 */
export const LEVELS = {
  easy: {
    label: LEVEL_LABELS.easy,
    lives: 12, canLose: false, floor: 0.15, heal: 0.10,
    first: 2.5, cadence: 4.5, announce: 1.2, rest: 0.9,
    brush: { reach: 4.7, angle: 0.35, speed: 1.843, reaction: 0.45 },
    delayed: { on: false, chance: 0, hold: [0, 0], track: 0.7 },
    combo: { on: false, count: [1, 1], gap: 0.4 },
    paint: {
      on: false, every: 12, grace: 2, speed: 1.843, reaction: 0.75, shapes: [],
      puddle: { radius: 1.1, life: 7, warn: 1.3, grow: 0.5 },
      trail: { width: 1.0, length: 7, life: 6, warn: 1.2 },
      zone: { radius: 2.4, life: 2.2, warn: 1.6, count: 2 },
    },
    phase2: { on: false, at: 0.5, speed: 1.2 },
  },
  normal: {
    label: LEVEL_LABELS.normal,
    lives: 5, canLose: true, floor: 0, heal: 0.10,
    first: 2.5, cadence: 3.5, announce: 0.9, rest: 0.9,
    brush: { reach: 4.7, angle: 0.35, speed: 1.843, reaction: 0.45 },
    delayed: { on: true, chance: 0.4, hold: [0.35, 1.1], track: 0.7 },
    combo: { on: false, count: [1, 1], gap: 0.4 },
    paint: {
      on: true, every: 11, grace: 2, speed: 1.843, reaction: 0.75, shapes: ['puddle', 'trail', 'zone'],
      puddle: { radius: 1.2, life: 7, warn: 1.3, grow: 0.5 },
      trail: { width: 1.0, length: 7, life: 6, warn: 1.2 },
      zone: { radius: 2.4, life: 2.2, warn: 1.6, count: 2 },
    },
    phase2: { on: false, at: 0.5, speed: 1.2 },
  },
  hard: {
    label: LEVEL_LABELS.hard,
    lives: 3, canLose: true, floor: 0, heal: 0.10,
    first: 2.0, cadence: 2.5, announce: 0.6, rest: 0.9,
    brush: { reach: 4.7, angle: 0.35, speed: 1.843, reaction: 0.45 },
    delayed: { on: true, chance: 0.45, hold: [0.3, 1.0], track: 0.7 },
    combo: { on: true, count: [2, 3], gap: 0.3 },
    paint: {
      on: true, every: 8, grace: 2, speed: 1.843, reaction: 0.75, shapes: ['puddle', 'trail', 'zone'],
      puddle: { radius: 1.3, life: 8, warn: 1.2, grow: 0.5 },
      trail: { width: 1.1, length: 8, life: 6, warn: 1.1 },
      zone: { radius: 2.7, life: 2.2, warn: 1.5, count: 3 },
    },
    phase2: { on: true, at: 0.5, speed: 1.25 },
  },
};

/** Display order of the speech-bubble buttons, from Easy to Hard. */
export const LEVEL_ORDER = ['easy', 'normal', 'hard'];
