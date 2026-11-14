/** Tuning tables of the story scenes: shots, timings and distances (m, s, rad). */

/**
 * Opening: the kitten lies asleep on the ground at `drop` (m), among the armour pieces scattered around it
 * (src/world/ArmorScatter.js places them from this point), then wakes up. Maman is already at the summit. The camera looks
 * along `look` (towards the foothill and the fog), in a fixed shot centred on the kitten. Durations in s.
 */
export const OPENING = {
  drop: { x: -0.35, z: -0.35 },
  look: { x: 1, z: 0.12 },
  // Waits are kept short so the opening does not drag; the full Wake and Yawn clips set its pace.
  sleep: 2.0,                    // s: kitten asleep, alone, before waking: long enough to read the scattered armour
  search: 2.4,                   // s: standing, looks around (screen left, then right): one sine period, 1.2 s per side
  searchYaw: 1.0,                // rad: gaze amplitude
  sit: 1.3,                      // s: sitting (Sit held at 1.2 s) before the yawn; the seated yawn prolongs the pose
  // Yawn meow: the Yawn clip is the only one in the opening that opens the mouth (Mouth bone: up to 45°, over 10° from 0.5
  // to 1.9 s of the clip), so the kitten plays its long call (`meow('kitten', { call: true })`, kitten_long.mp3) as the
  // mouth opens.
  yawnMeow: 0.45,                // s since the start of Yawn: mouth at 10° towards 0.5 s, sound started just before
  yawnMeowUntil: 1.0,            // s: past this (mouth already wide open), no meow; covers an audio context still resuming (not `running`) at first
  widen: 2.3,                    // s: widening of the shot before returning control; SHOT.wide.rate reaches 94% of the glide
};

/**
 * Camera shots: camera behind the controls target, horizontal gaze `look` (normalised), at `dist` m, `height` m above the
 * target, offset by `side` m to the right of the gaze. `rate`: glide speed (1/s). During a shot, the camera no longer
 * obeys the player (speech bubble, opening); the player gets it back as soon as the shot is released.
 */
export const SHOT = {
  // Fixed close-up of the opening: at least `halfWidth` m visible on each side of the target (narrow screen: camera moved
  // back, see _closeShot).
  close: { dist: 1.6, height: 0.18, side: 0, rate: 1, halfWidth: 0.55 },
  // rate 1.2: 1 − e^(−1.2 × 2.3) = 94% of the glide is done when OPENING.widen returns control.
  wide: { dist: 3.6, height: 1.0, side: 0, rate: 1.2 },
  talk: { dist: 2.6, height: 0.9, side: 0, rate: 2.5, angle: 0.35 },
};

/** Dialogues: distance (m, on the ground, between roots) for opening on approach and for closing when moving away. */
export const TALK = { approach: 1.8, approachMaman: 2.2, leave: 4.5 };

/**
 * Hug set up behind the hug cutscene, which stays until the end screen. `side`: fallback without a `Sleep` clip on Maman
 * (kitten `side` m from her flank). Belly-side camera (`_hugShot`): at least
 * `dist` m, tilt `tilt` rad, `half` (m) kept on each side, angles tried `angles` (rad, 0 = facing the belly, positive
 * towards the front of the heads), glide `rate`.
 */
export const HUG = {
  side: 0.62, dist: 1.9, tilt: 0.44, half: 0.45, angles: [0.5, 0.2, 0.8, -0.2, 1.1], rate: 1.5,
  /**
   * Before the hug: head shake (`HeadShake` clip). The helmet comes off at `drop` s (strongest shake of the clip), thrown
   * away from Maman at `toss` = [sideways, up] m/s with a roll of `spin` rad/s (Helmet.detach). Hug `after` s after the end
   * of the clip.
   */
  shake: { drop: 0.54, after: 0.5, toss: [0.9, 0.8], spin: 5 },
};

/**
 * Speech bubble: `pad` (px) margin between the top of the bubble and the framed heads. Camera return to the game shot on
 * closing: `rate` (1/s), `back` s before handing the camera back to the player. `gap` s between the kitten's meow and the
 * NPC's reply.
 */
export const TALK_UI = { pad: 24, rate: 2.5, back: 1.2, gap: 0.15 };

/** Meow voices (Meow.js, VOICES) of NPCs without their own: the energetic Chavalanche borrows the Chagicien's lively, trilled voice. */
export const VOICE = { chavalanche: 'chagicien' };

/** Distance (m) at which `skipTo` places the cat in front of an NPC (outside the approach radius). */
export const SKIP_DIST = 2.6;

/**
 * Kitten's defeat (`_lose`): its bar is empty on Normal or Hard. The kitten is taken back before the difficulty
 * choice: dark veil rising in `fade` s, arena and boss removed under it (`_endCombat`), kitten placed `SKIP_DIST` m from the
 * Chartiste (as `skipTo`), full veil for `hold` s, then removed in `back` s; the challenge bubble then reopens directly on
 * the choice (TEXTS.chartisteRevanche). `color`: dark plum of the bridge fade (CROSS.color, Crossing.js), softer than pure
 * black. Short durations (1.3 s in all): a defeat fade, not a screen.
 */
export const LOSS = { fade: 0.6, hold: 0.2, back: 0.5, color: '46, 32, 54' };

/**
 * Speech bubble opened while walking: the cat stops at the opening (after its jump if it is jumping). If the cat has moved
 * more than REFRAME m since the last shot and has stopped, the shot is recomputed. MOVING lists the states where the cat
 * moves (no recomputation during them).
 */
export const REFRAME = 0.25;

/** Bottom of the NPC for the frame (`_top`): height (m) above the bottom of the posed body. */
export const HEM = 0.22;

/** Height of the camera target above the followed point (World.js FOLLOW_HEIGHT, private). */
export const FOLLOW = 0.22;

export const MOVING = new Set(['walk', 'trot', 'run', 'chase', 'bat', 'approach', 'stalk', 'pounce', 'jump', 'jumpdown']);

export const EMPTY = [];

/**
 * Full victory, played after `Defeat` and its held pose (Duel.onWin). Times in s from onWin.
 * - `shrink` (2.0): the boss goes back to ginger and small (Npc.shrinkBoss); long enough to see the red turn ginger,
 *   shorter than the `Defeat` that announces it.
 * - `rest` (0.6): small ginger cat held still before the dissolve, so that it is recognised.
 * - `drop` (0.4 after the start of the dissolve): the kitten drops the sword while the fragments rise (the eye stays on
 *   the Chartiste).
 * - `hide` (0.9 after the start of the dissolve): body hidden once the top fragments have left (DISSOLVE.spread 1.2 s ×
 *   topFirst 0.7, about 0.84 s); the lower part leaves with the last ones.
 * - `unbuildAt` (1.8 after the start of the dissolve, fragments almost out: end at 3.0 s), arena undone in `unbuild`
 *   (3.0 s, Arena.unbuild; the night lifts over the last 40%, 1.2 s, the scenery returning then through
 *   World.showArenaDecor). Safety: forced end 1 s later.
 * - `cam`: shot framing the kitten and the shrinking boss from the side (`angle` 0.5 rad towards the kitten), `dist` at
 *   least 4 m, `height` 1.3 m (starting pitch), aimed `lift` 0.35 m above the ground, `rate` 1.5 (glide in about 2 s),
 *   reached in `ramp` 0.8 s, as for `settle`, since a full glide from the first frame jolts by 0.73 m from 22 m away.
 *   `narrow` (narrow screen, `COMBAT_CAM.narrowAspect`): `angle` 1.15 rad, as `COMBAT_CAM.grow.narrow`. The shot widens,
 *   rises or turns towards the kitten-to-boss axis if the kitten does not fit (Story._planShot; the kitten may have gone
 *   anywhere during `Defeat`). `frame`: on-screen limits of the shot, without a life bar, x 0.85 like the duel. `bossTop`
 *   2.2 m, `bossR` 0.6 m: shrunk boss and fragments (body about 0.5 m, then mean rise 0.85 m/s × 1.4 s of DISSOLVE); during
 *   `shrink`, Story._holdFrame starts from the duel's `bossH` and `bossR`.
 * - `settle`: `after` 3 s after the start of the dissolve (last fragment out, DISSOLVE): shot on the kitten alone, `dist` at
 *   most 9.5 m (exploration: 10 m, wider would jump at `_endCombat`), aimed at most `r` 8 m from the centre (beyond,
 *   `_keepInArena` runs out of room, under 1.5 m), `rate` 3: under 10 m before the end of the remaining 1.8 s even from 22 m.
 */
export const VICTORY = {
  shrink: 2.0,
  rest: 0.6,
  drop: 0.4,
  hide: 0.9,
  unbuildAt: 1.8,
  unbuild: 3.0,
  cam: {
    dist: 4, height: 1.3, angle: 0.5, lift: 0.35, rate: 1.5, ramp: 0.8, narrow: { angle: 1.15 },
    frame: { x: 0.85, yMin: -0.85, yMax: 0.85 }, bossTop: 2.2, bossR: 0.6,
    settle: { after: 3, dist: 9.5, r: 8, rate: 3 },
  },
};

export const VEIL_CSS = `
.lost-veil { position: fixed; inset: 0; z-index: 25; background: transparent; touch-action: none; display: none; }
.lost-veil.on { display: block; }
`;
