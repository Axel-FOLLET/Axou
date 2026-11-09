import { MEADOW_LIMIT } from '../world/field.js';

/** Tuning tables of the cat's behaviour: petting, hunt, yarn play, gaits, navigation, jumps (m, s, rad). */

/** `Pet` clip window (s, 8.625 s clip) where the head is raised and held: Cat.js closes the eyes during it, and a
 *  click only prolongs petting from its start. */
export const PET_HEAD_HOLD = [1.875, 7.0];

/** Click during the head hold: when the clip passes PET_LOOP[1] it restarts from PET_LOOP[0], two times (s) of the
 *  same pose, so a click never jumps the pose. */
export const PET_LOOP = [3.0, 6.0];

/** Ground click during petting: the cat rises first, head first, replaying the clip from `from` (s) at `rate` times
 *  speed, root still; it walks off at clip time `up` (s). Before `before` (s) it is not on its side yet and leaves
 *  at once. */
export const PET_RISE = { from: 7.0, up: 8.44, rate: 1.8, before: 1.0 };

/** Clip time (s) at which `Pet` is entered, by state left: the pose closest to it. Seated starts at 0.69 s because at
 *  0.6 s (pelvis at 0.42 m) the cat stood up on the click. */
export const PET_FROM = { sit: 0.69, lie: 1.06, walk: 0.6, trot: 0.6, run: 0.6 };

/** s: from Sit or Lie, the `Pet` clip stays frozen at PET_FROM during the fade (Cat.js): blending the seated pose with
 *  a clip already rolling onto its side lifted the pelvis by 0.10 m. stateTime starts at PET_FROM − PET_HOLD so it
 *  stays equal to the clip time. From a gait, the clip starts at 0.6 s: head already down. */
export const PET_HOLD = 0.4;

/** s: entering from a gait, the root slows linearly to a stop instead of halting. */
export const PET_GLIDE = 0.25;

/** Idle activities: fixed duration in seconds, or the clip whose length is used. */
export const FILLERS = { stretch: 'Stretch', groom: 'Groom', sit: 8, lie: 12 };

/** Butterfly hunt. Distances on the ground, in metres. Pounce times are read from the `Pounce` clip (POUNCE below). */
export const HUNT = {
  chance: 0.4,          // probability that a calm activity is a hunt (if a prey is in sight)
  spotRadius: 4,        // m, radius in which the cat notices a perched butterfly on its own
  minDist: 0.6,         // m, below this no spontaneous hunt (prey under its nose)
  maxPreyY: 0.85,       // m, prey higher than this is ignored (clearing flowers: 0.42 to 0.54 m)
  maxDist: 8,           // m, beyond this the hunt is abandoned (and a click refused)
  stalkDist: 1.2,       // m, walking approach down to here, then stalking
  pounceDist: 0.8,      // m, stalking down to here, then pounce (≈ 0.4 m root leap)
  aimTol: 0.35,         // rad, heading error allowed before pouncing (turns in place otherwise)
  move: [2, 4],         // s, stalking advance (≈ 0.10 m/s from the Stalk clip)
  freeze: [0.8, 2.5],   // s, frozen pause while stalking
  firstFreeze: [0.2, 0.7], // s, frozen pause on entering the stalk
  approachMax: 25,      // s, safety limit on the walking approach (8 m at 0.52 m/s ≈ 16 s)
  stalkMax: 25,  // s, safety limit on the stalk
  noProgress: 6,        // s without gaining 5 cm: abandon
  prepExtra: [0, 0.1],  // s, extra crouch held before the leap
  maxLeap: 0.9,         // m, maximum root advance during the pounce
  pawShift: 0.09,       // m, the front paws move back from the take-off position at landing (Pounce clip)
  catchChance: 0.3,  // chance of catching a prey within reach
  after: 0.3,           // s after the end of the clip before going back to normal
};

/**
 * Times (s) of the GLB `Pounce` clip (1.5417 s long): crouch reached, push-off, landing, end. The root moves in JS
 * between `launch` and `land`; the pounce is resolved against the butterflies at `land`.
 */
export const POUNCE = { crouch: 0.4, launch: 0.75, land: 1.08, end: 1.54 };

/** Yarn-ball play. Ground distances in metres, times in seconds. */
export const PLAY = {
  runSpeed: 1.5,        // m/s, fallback only, without a `run` clip (otherwise Cat.runSpeed, 4.148 m/s)
  reach: 0.32,          // m, root-to-ball distance where the cat touches it (muzzle ≈ 0.3 m in front of the root)
  strength: [0.8, 1.6], // m/s added to the ball by a push (Yarn.nudge)
  bats: [1, 3],         // pushes in a row before going back to rest (integer draw)
  batTime: 0.6,         // s of pause after a push (paw striking), before running again
  chaseMax: 12,         // s, safety limit on a run that lasts too long
  maxDist: 12,          // m, ball too far: the cat gives up
  tiredAt: 5,           // weariness: runs after 5 close-spaced throws, lies down after the 5th and stops running
  recover: 30,          // s for one throw of weariness to wear off while out of play
  lieTime: 15,          // s, length of the weariness lie-down (`lie` state)
  regain: 1,            // m, margin before speeding up again when the ball moves away
};

/**
 * Ground-click gaits. Distances in metres, cat to clicked point, in a straight line.
 * Gait on click: walk (0.516 m/s) below `trotFrom`, trot (1.843 m/s) up to `runFrom`, run (4.148 m/s) beyond.
 * Slowing on approach, never speeding back up: run to trot at `trotAt`, trot to walk at `walkAt`.
 * `dash`: double click, running at any distance (`walkTo(point, { run: true })`, Picker.js) with its own slowing, so a
 * target closer than `trotAt` can still be run to; a target closer than `dash.trotAt` starts at a trot.
 */
export const GOTO = { trotFrom: 3, runFrom: 10, trotAt: 2, walkAt: 0.5, dash: { trotAt: 0.6, walkAt: 0.2 } };

/**
 * Movement in the world: terrain, meadow limit, walls. Distances in metres, times in seconds. Walls come from
 * `world.ruins` (Ruins.js): high walls and rocks (`climbable` false) are walked around (A* grid if the straight line
 * is cut), low walls (`climbable`) are jumped over (`Jump` / `JumpDown` clips).
 */
export const NAV = {
  radius: 0.2,               // m, body radius around the root (wall contact)
  limit: MEADOW_LIMIT - 0.5, // m, the root stays within this disc
  cell: 0.25,                // m, cell size of the navigation grid
  pass: 0.3,                 // m, intermediate waypoint reached at this distance
  repath: 0.5,               // s, moving target (ball, butterfly): path recomputed at most this often
  jumpReach: 0.75,           // m, jump onto a low wall if the landing point is closer than this
  touch: 0.15,               // m, ... or if the body touches the low wall (contact distance along the path)
  topMargin: 0.08,           // m, inset from the edges of a low wall top (walkableAt)
  down: [0.45, 1.1],         // m, landing distance of a downward jump (first free point)
  stuck: 4,                  // seconds without gaining 5 cm toward the target: abandon
  wallFollow: 12,            // 1/s, height smoothing on top of a low wall (uneven stones)
};

/**
 * Times (s) of the `Jump` and `JumpDown` clips of the GLB. In-place clips: the root is moved here. Jump: root on the
 * ground until `rise`, at h − 0.09 m at `front` (front paws on top), at h at `top`; moves forward from `rise` to `top`.
 * JumpDown: root at h until `leave`, on the ground at `ground`; moves forward from `go` to `stop`.
 */
export const JUMP = { rise: 0.64, front: 0.94, top: 1.09, end: 1.625, frontDrop: 0.09 };

export const JUMP_DOWN = { go: 0.44, leave: 0.54, ground: 0.74, stop: 0.84, end: 1.29 };

/** States where the cat is moving or playing: stopped at the start of a conversation (setHold). */
export const MOVING_STATES = new Set(['walk', 'trot', 'run', 'chase', 'bat', 'approach', 'stalk']);
