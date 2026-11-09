import * as THREE from 'three';
import { NAV } from '../cat/brainTuning.js';
import { LIFT as ARENA_LIFT } from '../world/Arena.js';
import { LEVELS } from './difficulty.js';
import { BossMoves } from './bossMoves.js';
import { BOSS_NAME } from './labels.js';

export { LEVELS } from './difficulty.js';

/**
 * Settings and rules of the fight against the Chartiste: arena and transformation (`BOSS`, `COMBAT_CAM`), the kitten's
 * claw, the boss's brush strike, knockback, heal and provisional ending (`FIGHT`, class `Duel`, created by Story._fight
 * and advanced by Story.update), sword (`FIGHT.sword`, `Duel._weapon`, pause during the pull) and defeat signal
 * (`onDefeat`). The full victory is played by Story._victory.
 * Single source of the boss's red: `BOSS.red`, passed to `Npc.startBoss({ coat })` (Story.js) and to
 * `new BossBar({ color })` (main.js). Read by Story.js (sequence), main.js (bar) and the debug handles (`__combat`).
 */

/**
 * The boss.
 * - `red`: boss coat and life-bar fill (same value, 0xa8201a of NPC_BOSS.coat).
 * - `name`: name shown above the bar. The NPC is called Chartiste (labels.js, NPC_NAMES); the boss keeps his name and
 *   takes the colour of his coat.
 * - `scale`: times the hero (npcTuning.js NPC_BOSS.scale). `grow` (s): duration of the transformation.
 * - `build` (s): duration of the arena construction (World.enterArena).
 * - `catDist` (m): kitten-to-boss distance during the sequence, from the boss's centre.
 * - `foot` (m): half-width and half-length of the boss's non-walkable footprint (boss frame): the Chartiste's
 *   footprint (NPC_FOOTPRINTS, npc/npcPlacement.js: 0.22 × 0.4 at scale 1.25) multiplied by 4.
 */
export const BOSS = {
  red: 0xa8201a,
  name: BOSS_NAME,
  scale: 5,
  grow: 2.5,
  build: 5,
  catDist: 5.5,
  foot: [0.9, 1.6],
};

/**
 * Combat camera (Story._updateCombat). Distances in m, angles in rad, `rate` in 1/s (exponential glide of
 * Story._applyShot). `narrowAspect`: width / height ratio below which the screen counts as narrow (390 × 844: 0.46).
 * - `build`: slow orbit around the arena centre during construction: starts at `start` from the kitten's direction
 *   (seen from the side), then travels `orbit` towards it in BOSS.build s. Higher and more plunging on a narrow screen
 *   (`narrow`), with start and end closer to the kitten's direction (about 3.4 m of field on each side at 390 × 844).
 * - `grow`: wide shot during the transformation, aimed at the kitten-boss midpoint raised by `lift`; gaze `angle` off
 *   the perpendicular to the segment, on the kitten's side; distance at least `dist`, and enough to keep `half` m on
 *   each side (width) and `halfY` m (height).
 * - `fight`: the camera is given back to the player. Tracked point between kitten (0) and boss (1) at `follow`, raised
 *   by `lift`. `maxDistance` is lifted from the start of the sequence (exploration value 10 in World.js, kept and
 *   restored on leaving).
 *   - `frame`: every `fight` frame (Story._fitFight) the camera backs off if needed to keep in view the kitten (raised
 *     by `catY`, margin `catR`) and the boss (ground to `bossH`, half-width `bossR`), whatever the window format (phone
 *     rotation): screen |x| ≤ `x`, screen y between `yMin` (above the life bar) and `yMax`, in normalised coordinates
 *     (−1 to 1). If backing off is impossible in width (maxDistance reached): rotation towards the kitten's side at
 *     `turn` rad/s. `bossH`: the boss's Ear002 bone is 3.41 m from the ground, plus fur and beret.
 *   - `pushRate` (1/s), `push` (m/s): the back-off reaches the wanted distance with an exponential glide, at most
 *     `push`. Without them, the start of a knockback (0.32 m on the first frame) made the camera jump by 1.19 m at once.
 *     8/s and 10 m/s: the knocked-back kitten (3 m in 0.45 s) stays in frame, in the margin between `yMin` and the
 *     screen edge. The exit from the sword-pull close-up is a cut, not a glide (Story._cutToFight); these two settings
 *     serve the duel's back-off and Story._holdFrame.
 *   - `behind`: camera held on the kitten's side, behind it relative to the boss. The azimuth around the aimed point
 *     between the camera and the boss-to-kitten axis is held under `max` rad; beyond it, gentle rotation towards the axis
 *     at `gain` × the excess rad/s, capped at `rate` rad/s. Otherwise the camera could pass behind the boss, the kitten
 *     and its dodge hidden by his body. `max` 0.5 rad: at 2 m from the boss, a 1.5 m sideways dodge stays in front of the
 *     boss on screen on both sides. `rate` 0.9 rad/s catches up within a second with an axis turned by a dodge.
 *   - `ease`: when the edge no longer constrains, gentle return towards the player's shot (distance and pitch before
 *     the first back-off, Story._easeFight), at `rate` 1/s (exponential glide); 0.8 is about 3 s, slow enough not to
 *     read as a jolt after a dodge near the edge. A player gesture (drag, wheel, keys) becomes the new shot.
 * - `shadow` (m): half-side of the sun's shadow box during the arena (exploration value 4 in World.js, kept and restored
 *   on leaving).
 * - `inside`: camera kept above the disc (Story._keepInArena), at most `margin` m from the edge (radius 11 in World.js,
 *   pillars at 11.45), raised to keep its distance, pitch at most `maxPitch` below the horizontal. `fightPitch` replaces
 *   `maxPitch` in the `fight` phase (outside the sword-pull close-up) and in `victory`: at 1.1 rad, a kitten on the edge
 *   of the disc ended up below the camera, which could neither back off (edge) nor climb enough. 1.45 rad: almost
 *   vertical, the wanted back-off is fully held and kitten and boss stay in frame; 22 m back is 21.8 m high, below the
 *   night ceiling (80 m, NIGHT.height in Arena.js). In `victory`, without it the 1.1 rad limit would return at once when
 *   the victory shot brings the camera towards the edge.
 * - `plan` (Story._planShot): search for a framed shot for the sword-pull cuts and the victory. `pitchStep` 0.05 rad and
 *   `turnStep` 0.3 rad: finer does not visibly change the shot, coarser would pick it too high. `run`: limits of the run
 *   towards the stone, between the bars (top and bottom: SWORD.run.bars minus `margin` 0.04), x 0.85 like the duel.
 *   `catR`, `focusR` (m): half-widths of the kitten and of the stone with its sword.
 */
export const COMBAT_CAM = {
  narrowAspect: 0.75,
  build: { dist: 9.2, height: 8.5, start: 1.57, orbit: 0.7, rate: 1.4, narrow: { dist: 8.5, height: 17, start: 0.9, orbit: 0.6 } },
  grow: { dist: 8, angle: 0.5, lift: 1.6, half: 1.8, halfY: 2.4, rate: 1.6, narrow: { angle: 1.15 } },
  fight: {
    follow: 0.4, lift: 1.0, maxDistance: 22,
    frame: { catY: 0.3, catR: 0.5, bossH: 3.7, bossR: 1.4, x: 0.85, yMin: -0.6, yMax: 0.85, turn: 1.2, pushRate: 8, push: 10 },
    behind: { max: 0.5, gain: 3, rate: 0.9 },
    ease: { rate: 0.8 },
  },
  shadow: 7,
  inside: { margin: 1.5, maxPitch: 1.1, fightPitch: 1.45 },
  plan: { pitchStep: 0.05, turnStep: 0.3, run: { x: 0.85, margin: 0.04, catR: 0.5, focusR: 0.6 } },
};

/**
 * Combat rules. Units: m, s, rad; HP in points.
 *
 * Target durations: about 2 minutes to kill the boss with the claw and 30 s with the sword, not counting time spent
 * dodging. Hence `clawTime` 120 s and `swordTime` 30 s, and the shared formula: HP = duration / pace × damage, where the
 * pace is the fight time excluding dodges per strike given, measured on a played fight (`clawPace`, `swordPace`, below
 * FIGHT; the cooldown alone, 1.2 s, gives 41% too much). HP come from the claw; sword damage is derived from them.
 *
 * - `claw`: the kitten's claw (`Swipe` clip, left front paw).
 *   - `reach` (m): distance between the kitten's root and the edge of the boss's footprint (BOSS.foot, turned with him)
 *     below which a click on the boss starts the claw on the spot; beyond it the kitten first walks to `stand` m from the
 *     edge (on contact: threshold `reach` + 0.1 m). 0.85 m: the contact threshold meets `hitReach`; the boss pivots towards
 *     the kitten before his strikes (`boss.aimTurn`), and his turned footprint moves the edge away by 0.7 to 0.8 m, which
 *     at a lower value forces a new approach walk and a claw cut short by the dodge. The kitten is 0.5 m from nose to
 *     tail (root in the middle) and the extended paw reaches about 0.3 m in front of the muzzle.
 *   - `stand` (m): end of the approach walk, from the edge; 0.35 m: beyond the body radius (NAV.radius 0.2 m), with the
 *     paw touching the boss's fur (about 0.15 m outside the footprint).
 *   - `hitReach`, `hitAngle`: hit zone, tested at `contact`: footprint edge within `hitReach` m and in a ± `hitAngle` rad
 *     cone in front of the kitten. 0.95 m is 0.7 m plus 0.25 m because the boss turns during the strike; 1.05 rad (60°):
 *     the kitten faces the boss during the wind-up (`turn`), and the margin covers a pivoting boss.
 *   - `contact` (s): time of the strike in the `Swipe` clip (the contact key of anim_cat.py, 0.33 s).
 *   - `turn` (rad/s): speed at which the kitten turns towards the boss before contact.
 *   - `cooldown` (s): from the start of one claw to the start of the next; 1.2 s: the clip lasts 0.96 s, plus 0.24 s of
 *     recovery (a click during the claw is kept and fires at the end).
 *   - `damage` (HP): damage of one hit; 1, deliberately low.
 * - `sword`: sword (`Duel._weapon`, taken by the pull in src/world/Sword.js). Replaces `claw` as soon as the kitten
 *   holds it (Cat.sword).
 *   - `cooldown` (s): 1.25, measured length of the `SwordSwing` clip (no recovery: the player chains attacks).
 *     `damage` is derived from `swordTime` and `swordPace` (4.19 HP).
 *   - `contact` (s): 0.38, SWING_HIT key of anim_cat.py (blade at its furthest forward).
 *   - `reach`, `stand`, `hitReach`, `hitAngle`: same roles as for `claw`. The 0.35 m blade (4 rig units × 0.0864) held
 *     across the mouth reaches about 0.25 m further than the paw: `hitReach` 1.2 (claw 0.95 + 0.25), `reach` 1.05 and
 *     `stand` 0.5 (contact threshold under `hitReach`, as for the claw). Cone of ± 1.05 rad, as for the claw (the sweep
 *     covers more, but the kitten faces the boss during the wind-up). `turn` 10 rad/s, as for the claw.
 *   - `resume` (s): minimum delay before the next boss strike at the end of the sword-pull cinematic (the boss does not
 *     strike during it, Story._updatePull); 1.5 s: the player regains control and sees the announcement before the strike.
 * - `boss`: brush strike (`BrushSwing` clip, 1.75 s).
 *   - First strike delay, cadence, announcement and heal are per-level values (`first`, `cadence`, `announce`, `heal`) of
 *     `LEVELS` (difficulty.js), read by `Duel` and bossMoves.js.
 *   - `engage` (m): the boss only attacks if the kitten is within this distance of his centre (otherwise he waits on
 *     guard and strikes as soon as the kitten returns).
 *   - `windup` (s): end of the wind-up in the clip. The brush rises from 0 to 0.27 s (up to 3.9 m high, right side),
 *     holds until 0.75 s, comes down from 0.75 to 0.88 s and rests in front of the boss from 0.88 to 1.0 s.
 *   - Wind-up: the clip is slowed over [0, windup] to last the level's announcement (`LEVELS[…].announce`, speed
 *     windup / announce). Dodging: the strike is vertical, so it is dodged sideways; a retreat from melee takes 1.97 s to
 *     cover 4.7 m and only dodges if it started before the swing.
 *   - `strike` (s): clip time when the zone is tested: brush on the ground in front of the boss.
 *   - `reach`, `angle`, `inner`: hit zone in the boss frame: kitten within `reach` m of his centre, beyond `inner` m, and
 *     in a ± `angle` rad cone around his front. `angle` is the cap: the real half-angle of each strike comes from
 *     `LEVELS[…].brush` (BossMoves._brushZone). 4.7 m = measured tip (4.28 m) + kitten radius (0.2) + 0.2. ± 0.35 rad:
 *     measured spread of the brush on the ground (−0.18 to +0.15 rad) plus the half-width of the brush head (0.56 m,
 *     0.14 rad at 4 m). 0: very close to the boss, the kitten is under the handle (base at 1.0 to 2.0 m).
 *   - `brace` (s): window before the planned strike during which a landing claw no longer restarts `Flinch` (damage still
 *     counted, clip not played): the boss gathers himself to strike. Flinch rule: the strike clock (`b.next`) counts down
 *     in every state and is NEVER pushed back by `Flinch`. `Flinch` only starts from rest (or from a `Flinch` older than
 *     0.3 s) and only if `b.next` > `brace`, so it never interrupts a swing and always ends before the strike (`brace`
 *     0.8 s ≥ clip 0.79 s). The boss thus strikes every `cadence` s even if the kitten claws non-stop.
 *   - `turn` (rad/s): speed at which the boss turns towards the kitten on guard, outside aiming; still during the strike
 *     (the announcement commits the direction). At 1.6 rad/s he would follow the kitten and never show his flanks or
 *     back; at 0.3 he turns about 1 rad between two strikes, so a kitten clawing from the side or behind stays there, and
 *     one that does not move ends up facing him.
 *   - `aim` (s), `aimTurn` (rad/s): aiming before each strike. During the last `aim` seconds before the strike (`b.next`),
 *     on guard or flinching, the boss pivots towards the kitten at `aimTurn`: he always strikes facing the kitten, so the
 *     announcement (raised brush) is turned towards it and towards the camera behind it (`COMBAT_CAM.fight.behind`).
 *     `aim` 0.8 s = `brace`. `aimTurn` 5 rad/s: a half-turn (kitten behind him) in 0.63 s, before the end of `aim`, even
 *     if the kitten trots around. The strike clock is untouched: the cadence stays `cadence`.
 *   - `regrid` (rad): heading change beyond which the kitten's avoidance grid is rebuilt around the boss
 *     (Brain.refreshGrid, square of 2.3 m half-side).
 * - `knock`: knockback of a hit kitten (`Knockback` clip, played on the spot).
 *   - `distance` (m) covered in `time` s (sharp ease-out, cubic), away from the boss's centre; 0.45 s: the hind paws are
 *     back down in the clip. The arrival stays `margin` m from the edge of the arena disc and off obstacles
 *     (Ruins.resolve, NAV.radius).
 *   - `free` (s): clip time from which a ground click returns control (kitten back up at 0.95 s); before that the game
 *     keeps control (orders ignored).
 * - `defeatHold` (s): final pose of the `Defeat` clip held before leaving combat.
 * - `lose`: defeat of the kitten, when its bar is empty on Normal or Hard (`LEVELS[level].canLose`, difficulty.js).
 *   The fatal blow is an ordinary knockback (`Knockback`, no new clip), the boss returns to guard and stops attacking.
 *   `hold` (s): rest of the kitten on the ground after the end of the knockback, before `onLose` (Story._lose: veil,
 *   arena removed, challenge reopened on the choice). 0.6 s: the kitten gets up from the clip (0.95 s at `knock.free`,
 *   1.33 s clip) and the player sees it is down before the fade to the veil.
 *   Kitten lives (`lives`) and floor (`floor`) are read from the difficulty table, never here.
 */
export const FIGHT = {
  clawTime: 120,
  swordTime: 30,
  claw: { reach: 0.85, stand: 0.35, hitReach: 0.95, hitAngle: 1.05, contact: 0.33, turn: 10, cooldown: 1.2, damage: 1 },
  sword: { cooldown: 1.25, damage: 0, contact: 0.38, reach: 1.05, stand: 0.5, hitReach: 1.2, hitAngle: 1.05, turn: 10, resume: 1.5 },
  boss: { engage: 9, windup: 0.75, strike: 0.88, reach: 4.7, inner: 0, angle: 0.35, brace: 0.8, turn: 0.3, aim: 0.8, aimTurn: 5, regrid: 0.1 },
  knock: { distance: 3.0, time: 0.45, margin: 1.0, free: 0.95 },
  defeatHold: 1.0,
  lose: { hold: 0.6 },
  hp: 0,
};
// Real pace of a played fight: fight time excluding dodges per strike given. One strike per cooldown (1.2 s / 1.25 s)
// does not hold: the kitten returns to contact after each dodge, the boss moves it away with his strike and the flinch
// breaks the chain. Measured on a played fight (duel clock, sword-pull cinematic excluded since the duel is paused):
// claw 1.70 s per strike, sword 1.77 s per strike.
// HP = 120 s / 1.70 s × 1 = 71; sword: 71 × 1.77 s / 30 s = 4.19 HP per strike (17 strikes).
FIGHT.clawPace = 1.70;
FIGHT.swordPace = 1.77;
FIGHT.hp = Math.round(FIGHT.clawTime / FIGHT.clawPace * FIGHT.claw.damage);
FIGHT.sword.damage = FIGHT.hp * FIGHT.swordPace / FIGHT.swordTime;

const _res = { x: 0, z: 0, hit: null };
const round = (v, n = 100) => (v === null || v === undefined ? v : Math.round(v * n) / n);
const angleTo = (from, to) => Math.atan2(Math.sin(to - from), Math.cos(to - from));

/**
 * One fight, from control being returned (Story._fight) to the provisional end (`onWin`). Advanced by `update(dt)` every
 * frame (Story._updateCombat, before npc.update and cat.update).
 * - Click on the boss (Story.pickNpc → `attack`): claw on the spot within reach, otherwise walk to the edge then claw.
 *   A click during the claw is kept for the next.
 * - Ground click (main.js → `dodge`, then Brain.walkTo): claw interrupted, the kitten leaves: this is the dodge.
 * - The boss turns towards the kitten and strikes at the level's cadence (`LEVELS[…].cadence`, announced wind-up,
 *   bossMoves.js). A landing strike knocks the kitten back and heals the boss. Hit by the claw: `Flinch` (on guard).
 * - HP at 0: `onDefeat` (Story: victory music cue), `Defeat` to the end, pose held for `FIGHT.defeatHold` s, then `onWin`
 *   (Story._victory: shrink, dissolve, scenery restored).
 * - Sword held (Cat.sword): `FIGHT.sword` replaces `FIGHT.claw` (`_weapon`), `SwordSwing` clip.
 * - `pause(true)` during the sword-pull cinematic: nothing advances, current strike cancelled. `pause(false)`: next boss
 *   strike in at least `FIGHT.sword.resume` s.
 */
export class Duel {
  /** @param {object} o `cat`, `boss` (Chartiste Npc as boss), `world`, `bar` (boss BossBar), `catBar` (kitten BossBar, `cat` variant), `ground(x, z)`, `level` (LEVELS key, difficulty.js). */
  constructor({ cat, boss, world, bar, catBar = null, ground, level = 'easy' }) {
    this.cat = cat; this.boss = boss; this.world = world; this.bar = bar; this.catBar = catBar;
    this.level = LEVELS[level] ? level : 'easy';
    this.L = LEVELS[this.level];
    // Kitten lives: `catHp` from 0 to 1 (kitten's bar), each hit removes 1 / lives.
    // `canLose` false: the bar does not go below `floor` and there is never a defeat.
    this.catHp = 1; this.hits = 0;
    this.lost = false;                     // kitten's bar empty (canLose): defeat sequence
    this.lostT = 0; this.lostDone = false; // s since the end of the fatal knockback; `onLose` called
    this.onLose = null;                    // kitten down, after FIGHT.lose.hold (Story._lose)
    this.onPhase2 = null;                  // optional callback set by Story._fight, called by bossMoves.js
    this.onSfx = null;                     // (name, { eta }) => void: sound effects (CombatSfx.js), set by main.js
    this.ground = ground ?? ((x, z) => world.terrain.heightAt(x, z));
    this.maxHp = FIGHT.hp;
    this.hp = this.maxHp;
    this.time = 0;                         // s of play since control was returned (sum of dt)
    this.startedAt = performance.now();    // ms (page clock) when control was returned
    this.endedAt = null; this.endTime = null;
    this.clawCd = 0;
    this.c = { mode: null, t: 0, goal: null, queued: false, hit: false, from: null, to: null };
    this.b = { mode: 'idle', t: 0, next: this.L.first, struck: false };
    this.stats = { swipes: 0, given: 0, missed: 0, swings: 0, taken: 0, dodged: 0, healed: 0, swordHits: 0 };
    this.lastGiven = null; this.lastTaken = null;
    this.over = false;
    this.paused = false;                   // sword-pull cinematic (pause)
    this.onWin = null;
    this.onDefeat = null;                  // HP at 0, at the start of the `Defeat` clip
    this.obstacle = world.ruins?.obstacles.find((o) => o.name === 'npc_boss') ?? null;
    this.moves = new BossMoves(this, this.L, FIGHT.boss);
    this.gridYaw = boss.root.rotation.y; // footprint heading in the avoidance grid (_turnBoss)
    cat.brain.brisk = true; // close clicks at a trot (Brain._moveState): dodge possible during the announcement
    // Standing guard (leaves the frozen sitting pose of the transformation, no fade: cut under the veil).
    boss.bossPlay('BrushHold', { loop: true, instant: true });
    bar?.set(1);
    catBar?.set(1);
  }

  // ---------------------------------------------------------------- player orders

  /** Kitten's weapon: `FIGHT.sword` if it holds the sword (Cat.sword), otherwise `FIGHT.claw`. */
  _weapon() { return this.cat.sword ? FIGHT.sword : FIGHT.claw; }

  /**
   * Sword-pull cinematic (Story): `on` true freezes the duel (clocks, strikes) and cancels the boss's current strike (back
   * to guard); false: the next strike fires in at least `FIGHT.sword.resume` s.
   */
  pause(on) {
    on = !!on;
    if (on === this.paused || this.over) return;
    this.paused = on;
    const b = this.b;
    if (on) {
      if (b.mode === 'swing' || b.mode === 'flinch') this._guard();
      this.c.mode = null; this.c.queued = false;
    }
    b.next = Math.max(b.next, FIGHT.sword.resume);
    this.moves.pause(on);
  }

  /** Click or touch on the boss. Returns true if the order is accepted. */
  attack() {
    const c = this.c, brain = this.cat.brain;
    if (this.over || this.paused || this.lost || this.b.mode === 'defeat' || this.b.mode === 'down' || c.mode === 'knock') return false;
    if (c.mode === 'swipe') { c.queued = true; return true; }
    if (this.edge() <= this._weapon().reach) {
      if (this.clawCd <= 0) this._swipe(); else c.mode = 'ready';
      return true;
    }
    brain.walkTo(this._approachPoint());
    if (!brain.target) { c.mode = null; return false; }
    c.mode = 'approach'; c.goal = brain.target;
    return true;
  }

  /** Ground click (before Brain.walkTo): the claw or approach stops; knockback: after `knock.free`. */
  dodge() {
    const c = this.c;
    c.queued = false;
    if (this.lost) return; // down: the knockback runs to its end
    if (c.mode === 'swipe' || (c.mode === 'knock' && c.t >= FIGHT.knock.free)) this._release();
    else if (c.mode === 'approach' || c.mode === 'ready') c.mode = null;
  }

  /** Test shortcut (`__combat.setHp`): HP set to `v` (clamped), bar updated; 0 starts the defeat. */
  setHp(v) {
    if (this.over || this.lost || this.b.mode === 'defeat' || this.b.mode === 'down') return this.hp;
    this.hp = THREE.MathUtils.clamp(Number(v) || 0, 0, this.maxHp);
    this.bar?.set(this.hp / this.maxHp);
    this.moves.onHp(this.hp / this.maxHp);
    if (this.hp <= 0) this._defeat();
    return this.hp;
  }

  /**
   * Test shortcut (`__combat.setCatHp`): kitten's bar set to `v` (0 to 1), without a boss strike; 0 starts the defeat if
   * the level allows it (`canLose`).
   */
  setCatHp(v) {
    if (this.over || this.lost || this.b.mode === 'defeat' || this.b.mode === 'down') return this.catHp;
    this.catHp = THREE.MathUtils.clamp(Number(v) || 0, this.L.canLose ? 0 : this.L.floor, 1); // without possible defeat: never under the floor
    this.catBar?.set(this.catHp);
    if (this.L.canLose && this.catHp <= 0) this._lose();
    return this.catHp;
  }

  /** Early end (Story._endCombat): kitten returned to the player if the fight was holding it. */
  dispose() {
    this.cat.brain.brisk = false;
    if (this.c.mode === 'swipe' || this.c.mode === 'knock') this._release();
    this.c.mode = null;
    this.moves.dispose();
    if (!this.over) { this.over = true; this.endedAt = performance.now(); this.endTime = this.time; }
  }

  // ---------------------------------------------------------------- frame

  update(dt) {
    if (this.over || this.paused) return;
    this.time += dt;
    this.clawCd = Math.max(0, this.clawCd - dt);
    this._updateCat(dt);
    if (this.lost) { this._updateLost(dt); return; } // no more boss strikes: the fatal knockback runs its course
    if (!this.over) this._updateBoss(dt);
  }

  /** Kitten's defeat: after the knockback, `FIGHT.lose.hold` s on the ground, then `onLose` (once). */
  _updateLost(dt) {
    if (this.lostDone || this.c.mode === 'knock') return;
    this.lostT += dt;
    if (this.lostT >= FIGHT.lose.hold) { this.lostDone = true; this.onLose?.(); }
  }

  _updateCat(dt) {
    const c = this.c, brain = this.cat.brain, C = this._weapon();
    c.t += dt;
    if (c.mode === 'approach') {
      if (brain.target && brain.target !== c.goal) { c.mode = null; return; } // another order
      if (brain.target || brain.scripted) return; // on the way
      c.mode = this.edge() <= C.reach + 0.1 ? 'ready' : null; // arrived, or blocked on the way
    }
    if (c.mode === 'ready') {
      if (brain.target || brain.scripted || this.b.mode === 'defeat' || this.b.mode === 'down' || this.edge() > C.reach + 0.1) { c.mode = null; return; }
      this._faceBoss(dt, C.turn);
      if (this.clawCd <= 0) this._swipe();
      return;
    }
    if (c.mode === 'swipe') {
      if (c.t < C.contact) this._faceBoss(dt, C.turn);
      if (!c.hit && c.t >= C.contact) { c.hit = true; this._clawHit(); }
      if (c.t >= (this.cat.sword ? this.cat.duration('SwordSwing') || 1.25 : this.cat.duration('Swipe') || 0.96)) {
        this._release();
        if (c.queued && !this.over) { c.queued = false; this.attack(); }
      }
      return;
    }
    if (c.mode === 'knock') {
      const K = FIGHT.knock, k = Math.min(c.t / K.time, 1), e = 1 - (1 - k) ** 3;
      let x = c.from.x + (c.to.x - c.from.x) * e, z = c.from.z + (c.to.z - c.from.z) * e;
      this.world.ruins?.resolve(x, z, NAV.radius, {}, _res);
      if (this.world.ruins) { x = _res.x; z = _res.z; }
      this.cat.root.position.set(x, this.ground(x, z), z);
      if (c.t >= (this.cat.duration('Knockback') || 1.33)) this._release();
    }
  }

  _updateBoss(dt) {
    const b = this.b, npc = this.boss;
    b.t += dt;
    if (b.mode === 'defeat') { if (npc.clipDone) { b.mode = 'down'; b.t = 0; } return; }
    if (b.mode === 'down') { if (b.t >= FIGHT.defeatHold) this._win(); return; }
    b.next -= dt;
    this.moves.update(dt); // guard, aiming, strikes: bossMoves.js
    if (b.mode === 'flinch' && npc.clipDone) this._guard(); // `b.next` untouched: flinching does not push back the strike (`brace`)
  }

  // ---------------------------------------------------------------- kitten

  _swipe() {
    const c = this.c;
    this.cat.brain.setScripted('swipe');
    c.mode = 'swipe'; c.t = 0; c.hit = false; c.queued = false;
    this.clawCd = this._weapon().cooldown;
    this.stats.swipes++;
    this.onSfx?.(this.cat.sword ? 'sword-air' : 'claw-air', { eta: this._weapon().contact });
  }

  /** Claw or sword hit (`_weapon`), tested at the `contact` time of the clip. */
  _clawHit() {
    const C = this._weapon(), edge = this.edge(), ang = Math.abs(this._catAngleToBoss());
    const down = this.b.mode === 'defeat' || this.b.mode === 'down' || this.lost;
    const hit = !down && edge <= C.hitReach && ang <= C.hitAngle;
    const weapon = this.cat.sword ? 'sword' : 'claw';
    this.lastGiven = { time: round(this.time), weapon, hit, edge: round(edge), angle: round(ang), damage: hit ? round(C.damage) : 0, hp: null };
    if (!hit) { this.stats.missed++; this.lastGiven.hp = round(this.hp); return; }
    this.onSfx?.(weapon === 'sword' ? 'sword-hit' : 'claw-hit');
    this.hp = Math.max(0, this.hp - C.damage);
    this.lastGiven.hp = round(this.hp);
    this.stats.given++;
    if (weapon === 'sword') this.stats.swordHits++;
    this.bar?.set(this.hp / this.maxHp);
    this.moves.onHp(this.hp / this.maxHp);
    if (this.hp <= 0) this._defeat();
    else if ((this.b.mode === 'idle' || (this.b.mode === 'flinch' && this.b.t > 0.3)) && this.b.next > FIGHT.boss.brace) this._flinch();
  }

  _knock() {
    const c = this.c, K = FIGHT.knock, p = this.cat.root.position, r = this.boss.root.position;
    let dx = p.x - r.x, dz = p.z - r.z;
    const d = Math.hypot(dx, dz) || 1;
    dx /= d; dz /= d;
    let tx = p.x + dx * K.distance, tz = p.z + dz * K.distance;
    const a = this.world.arena;
    if (this.world.inArena && a?.center) {
      const R = a.radius - K.margin, ox = tx - a.center.x, oz = tz - a.center.z, h = Math.hypot(ox, oz);
      if (h > R) { tx = a.center.x + ox / h * R; tz = a.center.z + oz / h * R; }
    }
    if (this.world.ruins) { this.world.ruins.resolve(tx, tz, NAV.radius, {}, _res); tx = _res.x; tz = _res.z; }
    c.mode = 'knock'; c.t = 0; c.queued = false;
    c.from = { x: p.x, z: p.z }; c.to = { x: tx, z: tz };
    this.cat.brain.setScripted('knock');
    // Backwards knockback: facing the boss.
    const yaw = Math.atan2(-dx, -dz);
    this.cat.root.rotation.y = yaw;
    this.cat.locomotion.heading = yaw;
  }

  _release() {
    const brain = this.cat.brain;
    if (brain.scripted) brain.setScripted(null, 'idle');
    this.c.mode = null;
  }

  /** Kitten turned towards the nearest point of the boss's footprint, at most `rate` rad/s. */
  _faceBoss(dt, rate) {
    const p = this.cat.root.position, q = this._nearest();
    const want = Math.atan2(q.x - p.x, q.z - p.z), now = this.cat.root.rotation.y;
    const da = angleTo(now, want), step = Math.sign(da) * Math.min(Math.abs(da), rate * dt);
    this.cat.root.rotation.y = now + step;
    this.cat.locomotion.heading = now + step;
  }

  /** Angle (rad) between the kitten's heading and the direction of the nearest point of the footprint. */
  _catAngleToBoss() {
    const p = this.cat.root.position, q = this._nearest();
    if (Math.hypot(q.x - p.x, q.z - p.z) < 1e-3) return 0;
    return angleTo(this.cat.root.rotation.y, Math.atan2(q.x - p.x, q.z - p.z));
  }

  // ---------------------------------------------------------------- boss

  /**
   * The kitten is hit (brush strike or paint, bossMoves.js). `heal`: boss heal (`LEVELS[…].heal`). `knock`: knockback.
   * Kitten's bar: each hit removes `1 / lives` of `catHp` (current level, difficulty.js). `canLose` false: never below
   * `floor`. `canLose` true: empty bar means defeat (`_lose`, forced knockback). No effect once the kitten is down, or the
   * boss is down (victory is coming: neither damage nor defeat).
   */
  hitCat({ heal = true, knock = true } = {}) {
    if (this.over || this.lost || this.b.mode === 'defeat' || this.b.mode === 'down') return;
    const before = this.hp, L = this.L;
    if (heal) this.hp = Math.min(this.maxHp, this.hp + L.heal * this.maxHp);
    if (this.lastTaken) { this.lastTaken.heal = round(this.hp - before); this.lastTaken.hp = this.hp; }
    this.stats.taken++;
    this.stats.healed = round(this.stats.healed + this.hp - before);
    this.bar?.set(this.hp / this.maxHp);
    this.moves.onHp(this.hp / this.maxHp);
    this.hits++;
    this.catHp = Math.max(L.canLose ? 0 : L.floor, this.catHp - 1 / Math.max(1, L.lives));
    if (this.catHp < 1e-6) this.catHp = 0; // floating-point remainder: 5 hits on 5 lives empty the bar
    this.catBar?.set(this.catHp);
    if (this.lastTaken) { this.lastTaken.catHp = round(this.catHp, 1000); this.lastTaken.hits = this.hits; }
    const fatal = L.canLose && this.catHp <= 0;
    if (knock || fatal) this._knock();
    if (fatal) this._lose();
  }

  /** Kitten's bar empty (level that allows it): knockback running, boss on guard and silent, `onLose` once down. */
  _lose() {
    if (this.lost) return;
    this.lost = true; this.lostT = 0; this.lostDone = false;
    if (this.c.mode !== 'knock') this._knock();
    this.c.queued = false;
    if (this.b.mode === 'swing' || this.b.mode === 'flinch') this._guard();
    this.moves.pause(true);
  }

  _flinch() {
    if (this.boss.bossPlay('Flinch', { fade: 0.08 })) { this.b.mode = 'flinch'; this.b.t = 0; }
  }

  _guard() {
    this.boss.bossPlay('BrushHold', { loop: true, fade: 0.3 });
    this.b.mode = 'idle'; this.b.t = 0;
  }

  _defeat() {
    // Brush dropped flat on the arena disc (terrain + Arena.LIFT), not on the root's plane.
    this.boss.bossPlay('Defeat', { fade: 0.2, ground: (x, z) => this.ground(x, z) + ARENA_LIFT });
    this.b.mode = 'defeat'; this.b.t = 0;
    this.bar?.set(0);
    if (this.c.mode === 'approach' || this.c.mode === 'ready') this.c.mode = null;
    this.moves.onBossDown();
    this.onDefeat?.();
  }

  _win() {
    this.cat.brain.brisk = false;
    if (this.c.mode === 'swipe' || this.c.mode === 'knock') this._release();
    this.over = true;
    this.endedAt = performance.now();
    this.endTime = this.time;
    this.onWin?.();
  }

  /** Boss turned towards the kitten (guard), footprint turned with him; kitten pushed out of the footprint if needed. */
  _turnBoss(dt, rate) {
    const npc = this.boss, r = npc.root.position, p = this.cat.root.position;
    if (Math.hypot(p.x - r.x, p.z - r.z) < 1e-3) return;
    const now = npc.root.rotation.y, da = angleTo(now, Math.atan2(p.x - r.x, p.z - r.z));
    if (Math.abs(da) < 1e-4) return;
    const yaw = now + Math.sign(da) * Math.min(Math.abs(da), rate * dt);
    npc.setPosition(r.x, r.y, r.z, yaw);
    const o = this.obstacle;
    if (!o) return;
    o.rotY = yaw;
    // Avoidance grid (Brain, NavGrid) rebuilt around the boss once its heading has moved by `regrid` rad: a grid built at
    // the old heading blocked 3 to 4 of 8 paths around the boss. Rebuild cost: 0.05 ms (400 cells).
    if (Math.abs(angleTo(this.gridYaw, yaw)) > FIGHT.boss.regrid) {
      this.cat.brain.refreshGrid(o.x, o.z, Math.hypot(o.hx, o.hz) + NAV.radius + 0.3);
      this.gridYaw = yaw;
    }
    const ruins = this.world.ruins;
    if (ruins && this.c.mode !== 'knock') {
      ruins.resolve(p.x, p.z, NAV.radius, { climbable: false }, _res);
      if (_res.hit === o) p.set(_res.x, this.ground(_res.x, _res.z), _res.z);
    }
  }

  // ---------------------------------------------------------------- geometry

  /** Boss footprint: the `npc_boss` obstacle (turned with him), or BOSS.foot at the boss's heading. */
  _box() {
    if (this.obstacle) return this.obstacle;
    const r = this.boss.root.position;
    return { x: r.x, z: r.z, hx: BOSS.foot[0], hz: BOSS.foot[1], rotY: this.boss.root.rotation.y };
  }

  /** Point of the footprint closest to the kitten (world frame, x and z). */
  _nearest() {
    const o = this._box(), p = this.cat.root.position, c = Math.cos(o.rotY), s = Math.sin(o.rotY);
    const dx = p.x - o.x, dz = p.z - o.z;
    const lx = THREE.MathUtils.clamp(dx * c - dz * s, -o.hx, o.hx), lz = THREE.MathUtils.clamp(dx * s + dz * c, -o.hz, o.hz);
    return { x: o.x + lx * c + lz * s, z: o.z - lx * s + lz * c };
  }

  /** Distance (m) from the kitten's root to the edge of the boss's footprint (0 inside). */
  edge() {
    const p = this.cat.root.position, q = this._nearest();
    return Math.hypot(p.x - q.x, p.z - q.z);
  }

  _catDist() {
    const p = this.cat.root.position, r = this.boss.root.position;
    return Math.hypot(p.x - r.x, p.z - r.z);
  }

  /** Kitten in the boss frame: distance to the centre and angle (rad) from his front. */
  _catInBoss() {
    const p = this.cat.root.position, r = this.boss.root.position, yaw = this.boss.root.rotation.y;
    const dx = p.x - r.x, dz = p.z - r.z;
    return { d: Math.hypot(dx, dz), angle: angleTo(yaw, Math.atan2(dx, dz)) };
  }

  /** Goal of the approach walk: on the boss-to-kitten line, `claw.stand` m from the footprint edge. */
  _approachPoint() {
    const o = this._box(), p = this.cat.root.position;
    let ux = p.x - o.x, uz = p.z - o.z;
    const len = Math.hypot(ux, uz);
    if (len < 1e-3) { ux = Math.sin(o.rotY); uz = Math.cos(o.rotY); } else { ux /= len; uz /= len; }
    const c = Math.cos(o.rotY), s = Math.sin(o.rotY);
    const lx = Math.abs(ux * c - uz * s), lz = Math.abs(ux * s + uz * c);
    const exit = Math.min(lx > 1e-6 ? o.hx / lx : Infinity, lz > 1e-6 ? o.hz / lz : Infinity);
    const k = exit + this._weapon().stand;
    return new THREE.Vector3(o.x + ux * k, 0, o.z + uz * k);
  }

  // ---------------------------------------------------------------- tests

  /** Readable state (`__combat.duel`): HP, phases, cooldowns, last strikes, counters, clocks. */
  get state() {
    const npc = this.boss;
    const L = this.L;
    return {
      level: this.level, moves: this.moves.state,
      // Kitten lives, read from the difficulty table at the start of the duel.
      lives: L.lives, canLose: L.canLose, floor: L.floor, catHp: round(this.catHp, 1000), hits: this.hits, lost: this.lost, lostDone: this.lostDone,
      // Values of the current level (a choice really changes these values).
      values: { first: L.first, cadence: L.cadence, announce: L.announce, delayed: L.delayed?.on ?? null, combo: L.combo?.on ?? null, paint: L.paint?.on ?? null, phase2: L.phase2?.on ?? null },
      hp: round(this.hp), maxHp: this.maxHp, over: this.over, paused: this.paused, weapon: this.cat.sword ? 'sword' : 'claw',
      time: round(this.time), startedAt: round(this.startedAt), endedAt: round(this.endedAt), endTime: round(this.endTime),
      cat: this.c.mode, catT: round(this.c.t), queued: this.c.queued, clawCooldown: round(this.clawCd), edge: round(this.edge()),
      boss: this.b.mode, bossT: round(this.b.t), nextSwing: round(this.b.next), bossClip: npc.pose, bossClipTime: round(npc.clipTime),
      lastGiven: this.lastGiven, lastTaken: this.lastTaken, stats: { ...this.stats },
    };
  }
}
