import { NPC_NAMES } from '../game/labels.js';

/** Tuning tables of the non-player cats: types, boss form, fur levels of detail, sitting pose, accessory fit (m, s, rad). */

// Copied from src/cat/Cat.js: same length (m), walk stride and rate, and ground gap (m) as the hero.
export const CAT_LENGTH = 0.8;

export const WALK_STRIDE = 3.2 / 0.67;

export const WALK_RATE = 1.25;

export const GROUND_GAP = 0.004;

/**
 * Fur shells by camera-to-NPC distance (m): one shell in `step` stays visible. 18 shells up to 6 m, 9 up to 12 m, 6
 * up to 20 m, 3 beyond. FUR_LOD_HYSTERESIS (m) avoids flickering on a threshold.
 */
export const FUR_LOD = [
  { upTo: 6, step: 1 },
  { upTo: 12, step: 2 },
  { upTo: 20, step: 3 },
  { upTo: Infinity, step: 6 },
];

export const FUR_LOD_HYSTERESIS = 0.75;

/** Size of the NPCs relative to the hero. */
export const NPC_SCALE = 1.25;

/**
 * Chartiste as boss: settings of `startBoss` / `setBoss`.
 * - `scale`: boss size relative to the hero (5 = 5 kittens). The `body` group goes from 1 to scale / sizeScale; the
 *   root is never scaled. Hairs grow with the body (length and spacing computed in bind space, Fur.js).
 * - `duration`: growth time (s), S curve (smootherstep) on scale and coat.
 * - `coat`: boss red (sRGB hex), same as the health bar (`BOSS.red` in src/game/combat.js); tips, sun-side tint and
 *   rim are derived from it (`bossCoat`).
 * - `shells`: maximum fur shells (18 = all); lower it (12, 9) if the frame rate requires. FUR_LOD thresholds are
 *   multiplied by the body scale.
 * - `brushPaw`: paw holding the giant brush (FR: front right, easel side).
 * - `brushLength`: brush length × length of that leg (shoulder to foot): about 2.3 m on the boss, over half its
 *   sitting height.
 * - `brushDir`: handle direction in the `CatArmature` node frame: BRUSH_DIR of anim_cat.py converted from (X, Y, Z)
 *   to (X, Z, −Y).
 * - `brushGrip`: grip point in the bone frame (PAW_PT_L of anim_cat.py, middle of the foot bone).
 * - `brushBack`: share of the handle length sticking out below the grip.
 * - `brushRaise`: progress range over which the paw rises into the `BrushHold` clip pose (`brushHoldLayer`).
 * - `brushGirth`: widening of handle and ferrule (× `buildBrush` radius, before scaling).
 * - `brushTuft`: [widening, lengthening] of the tuft. `brushTuftColor`: Chartiste palette yellow, readable on the red
 *   coat and the blue arena floor.
 * - `brushOut` / `brushIn`: progress ranges (after the S curve) where the mouth brush shrinks away, then the giant
 *   brush grows from the paw.
 * - `drop`: brush release during `Defeat` (`bossPlay`). `at` (s): DEFEAT_T_DROP of anim_cat.py. `time` (s): fall
 *   duration (ease e²). `out` (m): minimum distance of the handle from the boss centre, tuft outward.
 */
export const NPC_BOSS = {
  scale: 5,
  duration: 2.5,
  coat: 0xa8201a,
  shells: 18,
  brushPaw: 'FR',
  brushLength: 1.2,
  brushDir: [-0.45, 0.53, 0.719],
  brushGrip: [0, 0.2, 0],
  brushBack: 0.028,
  brushRaise: [0.05, 0.3],
  brushGirth: 2.4,
  brushTuft: [4, 2.6],
  brushTuftColor: 0xf3c55a,
  brushOut: [0.1, 0.35],
  brushIn: [0.3, 0.7],
  drop: { at: 1.4, time: 0.375, out: 1.0 },
};

/**
 * While the boss plays a clip (`bossPlay`): click box refreshed on the current pose every PROXY_EVERY s
 * (`_updateProxy` reads one body vertex in three: cost bounded to 5 times per second).
 */
export const PROXY_EVERY = 0.2;

/**
 * Hue (degrees), saturation and lightness offsets (HSL in sRGB) taken from the ginger coat of the Chartiste
 * (0xc4672b), applied to the boss coat by `bossCoat`. Tips 0xf2a65a, sun-side tint 0x9a5a30; rim from the hero
 * (CAT.sheen 0xffd9a8).
 */
export const BOSS_TIP_HSL = [6.5, 0.214, 0.182];

export const BOSS_LIT_HSL = [0.25, -0.116, -0.073];

export const BOSS_SHEEN_HSL = [10.3, 1, 0.829]; // relative hue; absolute saturation and lightness

/**
 * NPC types (`kind` ids). `displayName`: name shown to the player (speech bubbles, compass).
 * `coat`: colours (sRGB hex) set on the Fur.js instance uniforms; without it, the hero's black coat. `sit`: real cat
 * sit rebuilt on the frozen pose of the clip (see _sitCat); `SitNpc` is the NPC clip (rump on the ground, hock under
 * the thigh), `Sit` remains the kitten's. `plump`: widened body (fractions: sides, belly, back). `furLength`: hair
 * length factor of the instance. `belly`: belly colour (Fur.js option). `furStep`: keep one fur shell in N, at best.
 */
export const NPC_KINDS = {
  chagicien: {
    displayName: NPC_NAMES.chagicien, scale: NPC_SCALE, pose: 'SitNpc', accessories: 'wizard', sit: true,
    // Pastel mauve.
    coat: { coat: 0xbfa1d9, tip: 0xeadcf6, coatLit: 0x9a86b0, sheen: 0xf4e6ff },
  },
  chartiste: {
    displayName: NPC_NAMES.chartiste, scale: NPC_SCALE, pose: 'SitNpc', accessories: 'artist', sit: true,
    // Ginger (keeps the hero's golden rim).
    coat: { coat: 0xc4672b, tip: 0xf2a65a, coatLit: 0x9a5a30 },
  },
  maman: {
    displayName: NPC_NAMES.maman, scale: NPC_SCALE, pose: 'Lie',
    // Hero's black coat; rounder and fluffier.
    plump: { side: 0.15, belly: 0.15, back: 0.05 }, furLength: 1.15,
  },
  // Mountain guide: sits at the foot of the mountain, then stands and follows the kitten (src/game/Chavalanche.js).
  // Beige coat with a white belly; helmet, ski mask, pack and poles from buildGuideGear (Accessories.js). `furStep`:
  // one shell in 2 at best, because a furry NPC near the camera doubles the hero's cost; FUR_LOD thresholds add on
  // top.
  chavalanche: {
    displayName: NPC_NAMES.chavalanche, scale: NPC_SCALE, pose: 'SitNpc', accessories: 'chavalanche', sit: true,
    coat: { coat: 0xe2cb9c, tip: 0xf3e6c6, coatLit: 0xc6ae7e, sheen: 0xfff1d6 },
    belly: 0xffffff,
    furStep: 2,
  },
  // Snow cats: small white cats, half the NPC size, lighter fur. Pose, coat, fur step and beanie colours can be set
  // through `opts`, see the constructor (src/world/SnowCats.js).
  snowCat: {
    displayName: NPC_NAMES.snowCat, scale: NPC_SCALE / 2, pose: 'Idle', accessories: 'snowCat',
    coat: { coat: 0xfbfcff, tip: 0xffffff, coatLit: 0xdfe6f2, sheen: 0xffffff },
    furStep: 3,
  },
};

export const NOOP = () => {};

/**
 * _sitCat settings (angles in rad, distances in m for a 0.8 m cat, multiplied by the size): `body` and `rear` tilts
 * (`body` above 0.35 lifts the front legs off the ground), ground at `reach` × front leg length, front foot offset
 * from the middle (`frontX`) and advance under the shoulder (`frontZ`, legs leaning 9° forward), hock offset and
 * recoil under the hip (`hockX`, `hockZ`), knee against the flank (`kneeX`; `kneeUp` favours the highest knee), aimed
 * tail height above the ground (`tailH`), belly footprint avoided by the tail (`tailOut`), tail wrap around the body
 * (`wrap*`).
 */
export const SIT = { body: 0.35, rear: 0.25, reach: 0.95, frontX: 0.045, frontZ: 0.06, hockX: 0.07, hockZ: -0.02, kneeX: 0.10, kneeUp: 1, tailH: 0.012, tailOut: 0.12, neck: 0.5, level: 1, wrap: 1, wrapH: 0.06, wrapGap: 0.025, wrapDrop: 0.6, wrapC: 0.2 };

/**
 * _sitCat settings for the `SitNpc` clip (Chagicien, Chartiste): the clip is already tilted, rump on the ground and
 * hock under the thigh, so no hindquarter tilt (`rear` 0), no hind leg placement (`hind: false`), ground taken from
 * the clip (`clipGround`). Kept: front legs (step 3), level head (hat), wrapped tail, ground contact.
 * - `body` 0.2: straightens the torso; at 0.3 the head moves back and a front paw misses the ground.
 * - `frontZ` 0.03: front legs 5° forward, gap under the belly about 8 % of the height.
 * - `tailH` −0.02: lower tail; negative because the aimed height is measured before the `_contact` adjustment.
 * - `wrapGap` 0: tail against the flank, reaching further around.
 * - `wrapC` 0.4: centre of the wrap further forward, tip closer to the chest. The fixed tail length covers only 106°
 *   of the 180° turn.
 */
export const SIT_NPC = { ...SIT, body: 0.2, rear: 0, hind: false, clipGround: true, frontZ: 0.03, tailH: -0.02, wrapGap: 0, wrapC: 0.4 };

/**
 * Total head lowering at k = 1 (rad, about 74°) and share of Neck, Neck.001 and Head. With Maman in `Idle`, the
 * bottom of the carried kitten (`Carried`) ends up 0 to 5 cm from the ground at k = 1.
 */
export const HEAD_DIP = 1.3;

export const HEAD_DIP_SHARE = [0.4, 0.35, 0.25];

/**
 * Hug settings. `at`: frozen time of the `Sleep` clip (s; side at 2.6, curl at 3.8). `spot`: kitten placement
 * ([offset toward the belly, forward] in m for size 1, heading offset in rad). `paw`: target of the upper paw ([x, y,
 * z] in root frame, around `spot`). `aim`: chin on the helmet ([max angle in rad, shares of Neck, Neck.001, Head,
 * passes]). `chin`: gap above the crest (m). `bare`: chin target when the helmet has fallen (Helmet.topPoint). `lid`:
 * eyelids. `breath`: breathing ([rad/s, rad]).
 */
export const HUG = { at: 3.0, spot: [0.156, 0.06, 0.656], paw: [0, 0.2, 0], aim: [1.2, [0.35, 0.35, 0.3], 4], chin: 0.01, bare: 'ridge', lid: 0.6, breath: [1.1, 0.035] };

/** Height of the hat origin (bottom of the tube) above the top of the skull (m, 0.8 m cat). */
export const HAT_SINK = 0.012;

/** Radius of the wizard hat brim (m, 0.8 m cat): deliberately generous, about 3 × the cone. */
export const HAT_BRIM = 0.18;

/** Guard between the highest hair tip under the brim and the underside of the brim (m, 0.8 m cat). */
export const HAT_GUARD = 0.004;

/** Ears of the Chagicien folded under the brim: [outward, backward] (rad), `_foldEars`. */
export const HAT_EAR_FOLD = [1.4, 0.3];

/** Guard between the hair tips of the face and the back of the glasses rings (m, 0.8 m cat). */
export const GLASSES_GUARD = 0.003;

/**
 * Scarf. `SCARF_FUR`: share of the hair length under the band (compressed). `SCARF_TOP`: band half-width (m, 0.8 m
 * cat).
 * `SCARF_SAG`: drop of the band in front (share of the half-width). `SCARF_UPRIGHT`: straightening of the neck axis
 * toward vertical (0 = neck axis, 1 = vertical). `SCARF_RAISE`: centre position between Neck.001 and Neck.002.
 * `SCARF_KNOT`: knot rotation from the front (rad). `SCARF_TAILS`: length of the two tails (m, 0.8 m cat).
 */
export const SCARF_FUR = 0.6;

export const SCARF_TOP = 0.016;

export const SCARF_SAG = 0.3;

export const SCARF_UPRIGHT = 0.8;

export const SCARF_RAISE = 0.5;

export const SCARF_KNOT = 0.55;

export const SCARF_TAILS = [0.035, 0.028];

/** Fur.js coat uniforms touched by setCoat and the boss. */
export const COAT_KEYS = ['furCoat', 'furTip', 'furCoatLit', 'furSheen'];

/**
 * Bones of the brush-hold layer: chain of the front right leg (shoulder and all its descendants) and its controllers,
 * as in the matching block of anim_cat.py.
 */
export const BRUSH_LAYER_ROOTS = ['Thigh_front_R', 'Foot_front_IK_R', 'Knee_front_IK_R'];
