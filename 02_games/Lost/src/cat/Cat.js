import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CatRig } from './CatRig.js';
import { Procedural } from './Procedural.js';
import { Locomotion } from './Locomotion.js';
import { Brain } from './Brain.js';
import { PLAY, PET_HEAD_HOLD, PET_HOLD } from './brainTuning.js';
import { Fur } from './Fur.js';
import { Eyes } from './Eyes.js';
import { attachHelmet, EarFollow } from './Helmet.js';

/**
 * Facade of the player's cat: loads the GLB, plays the clips (mixer) and runs the procedural layers, fur, eyes,
 * locomotion and brain. Also holds the gait tables that turn clip strides into ground speeds.
 * Created with `Cat.load` by main.js.
 */

const CAT_LENGTH = 0.8; // m, muzzle to tail tip
// Walk: a planted foot recedes 3.2 rig units during its stance, i.e. 0.67 of the cycle (`tools/anim_cat.py`, WALK_STRIDE
// and WALK_DUTY), so the ground scrolls 3.2 / 0.67 units per cycle. Ground speed follows from it, otherwise the paws slide.
const WALK_STRIDE = 3.2 / 0.67; // rig units per cycle
const WALK_RATE = 1.25; // Walk clip playback rate (1 s clip, 0.8 s cycle)
// Trot and run: ground scrolled per cycle = stride / stance from `tools/anim_cat.py`. Trot: 3.6 / 0.45 = 8.0 units
// (0.375 s clip, 1.843 m/s); run: 4.0 / 0.25 = 16.0 units (0.333 s clip, 4.148 m/s). Both played at rate 1.
const TROT_STRIDE = 3.6 / 0.45;
const RUN_STRIDE = 4.0 / 0.25;
// Fallback without a `Trot` clip: `Walk` played at TROT_FALLBACK_RATE, ground speed in proportion.
const TROT_FALLBACK_RATE = 2;
// Stalk (`Stalk` clip, cycle): same principle as the walk (step 0.6 × 3.2 units, stance 0.8 of the cycle).
const STALK_STRIDE = (0.6 * 3.2) / 0.8; // rig units per cycle
const STALK_RATE = 1;                    // Stalk clip playback rate
// Fallback without `Stalk` in the GLB: `Walk` played slowly, ground speed reduced to match.
const STALK_FALLBACK_RATE = 0.5;
// s, ground click during petting: short fade from `Pet` to `Walk` / `run`, without waiting for the clip to end.
const PET_EXIT_FADE = 0.2;
// s, fade into `Pet` by previous state: `idle`, short so the head drops right after the click; `move`, the length
// of the damped stop (Brain PET_GLIDE); `other`, any other state. Sitting or lying use Brain PET_HOLD instead.
const PET_IN_FADE = { idle: 0.2, move: 0.25, other: 0.4 };
// s, rise before the walk (Brain PET_RISE): fade to the clip's rise if the ground click lands during the head hold.
const PET_RISE_FADE = 0.25;
// s after petting: gaze recovered over this time (Procedural.easeLook), tail left to the clip meanwhile.
const PET_SETTLE = 1.5;
// Eyes closed with contentment during the petting head hold (`Pet` clip window PET_HEAD_HOLD): lid at PET_LID
// (0 = open, 1 = closed, Eyes.setLid). Carried and asleep: exponential approach (LID_CLOSE_RATE, LID_OPEN_RATE, 1/s).
// Petting: smoothstep ramp with zero speed at both ends, full close in PET_LID_CLOSE s, full reopen in PET_LID_OPEN s.
const PET_LID = 1;
const LID_CLOSE_RATE = 3;
const LID_OPEN_RATE = 10;
const PET_LID_CLOSE = 0.7; // s for a full lid travel (closing)
const PET_LID_OPEN = 0.7;  // s for a full lid travel (reopening)
const _v = new THREE.Vector3();
const _w = new THREE.Vector3();
// Body tilt on slopes: `body` turns by gain × the ground angle, measured from height differences at ±ahead m front
// and back and ±side m on the sides of the root; exponential approach (rate, 1/s); max in rad.
// Flat on a low wall and during a jump, where the terrain slope has no meaning.
const TILT = { gain: 0.6, ahead: 0.25, side: 0.1, rate: 5, max: 0.25 };
/**
 * Carrying by the scruff (`Carried` clip). nape: point of the nape in the `Neck001` bone frame, stuck each frame to
 * Maman's `mouthAnchor`; the clip keeps the legs above the ground for a mouth at 0.41-0.42 m.
 * yaw: kitten heading relative to Maman's, rad (carried crosswise, set down facing the opening camera).
 */
const CARRY = { nape: new THREE.Vector3(0, 0.3907, -0.6178), yaw: -Math.PI / 2 };
/**
 * Setting the kitten down asleep: start time (s) of the `Sleep` clip (lying from 1.5 to 2.0, on its side at 2.6,
 * curled at 3.8) and fade from `Carried` (s).
 */
const SLEEP_DROP = { from: 2.5, fade: 0.6 };
/**
 * Sword in the mouth (`sword` true, set by Story after the pull): SwordWalk / SwordRun / SwordSwing replace
 * Walk / Trot and run / Swipe, and idle holds the last frame of SwordPull (guard pose).
 * Ground speed without sliding, as for Walk (stride / stance × scale × rate / duration); strides and stances
 * come from `tools/anim_cat.py` (SWALK_*, SRUN_*).
 * walkRate: same step cadence as walking without a sword (≈ 0.48 m/s).
 * trotRate: SwordRun slowed down, the only fast sword clip; below 0.6 the gallop looks like slow motion;
 *   ≈ 2.4 m/s, above the trot (1.84 m/s), so a telegraphed attack can still be dodged.
 * runRate: SwordRun at clip speed (≈ 3.9 m/s; 4.15 m/s without the sword).
 */
const SWORD_GAIT = { walkStride: 3.0 / 0.67, runStride: 3.8 / 0.25, walkRate: WALK_RATE, trotRate: 0.6, runRate: 1 };

/**
 * Clips expected in the GLB (made by `tools/anim_cat.py`, 24 fps, all bones baked).
 * `loop`: cycle; otherwise played once and held on the last frame.
 * `hold`: time (s) at which the held pose is reached; played backward from it, the clip serves as the rise.
 * `fallback`: clip played instead while the GLB does not contain this one (no error).
 */
const CLIPS = {
  Idle: { loop: true }, Walk: { loop: true }, run: { loop: true }, Trot: { loop: true, fallback: 'Walk' },
  Sit: { hold: 1.2 }, Lie: { hold: 2.0 /* LIE_SETTLE reached, see anim_cat.py */ }, Sleep: { hold: 3.8 /* CURL reached, see anim_cat.py */ },
  Pet: {}, Wake: {}, Stretch: {}, Groom: {},
  // Hunt: looping stalk, pounce played once (timing in Brain.js, POUNCE).
  Stalk: { loop: true, fallback: 'Walk' }, Pounce: { fallback: 'Idle' },
  // Low walls: in-place clips, root moved by Brain.js (JUMP).
  Jump: { fallback: 'Idle' }, JumpDown: { fallback: 'Idle' },
  // Carried by the scruff: 2.0 s loop.
  Carried: { loop: true },
  // Seated yawn (opening scene): starts from and returns to the seated pose, 2.33 s.
  Yawn: { fallback: 'Sit' },
  // Head shake before the hug: the helmet falls (Story).
  HeadShake: { fallback: 'Idle' },
  // Chartiste and ending: brush guard (loop, also a hold layer, Npc.js brushHoldLayer), strike, flinch, defeat
  // (seated at 1.8 s, final pose held), sword moved from mouth to paw then held (end screen), side-step backward (Maman).
  BrushHold: { loop: true, fallback: 'Idle' }, BrushSwing: { fallback: 'Swipe' }, Flinch: { fallback: 'Knockback' },
  Defeat: { hold: 1.8, fallback: 'Sit' }, SwordToPaw: { fallback: 'Sit' }, SwordPawHold: { loop: true, fallback: 'Sit' },
  StepBack: { loop: true, fallback: 'Walk' },
  // Combat: left front paw claw swipe (contact at 0.33 s, 0.96 s long) and in-place knockback (1.33 s; the recoil is
  // done by src/game/combat.js). States 'swipe' and 'knock' of onStateChange.
  Swipe: { fallback: 'Idle' }, Knockback: { fallback: 'Idle' },
  // Sword (see SWORD_GAIT): pull played once (sword and stone placed by src/world/Sword.js), walk and gallop in a
  // cycle, strike (contact at 0.38 s, 1.25 s long).
  SwordPull: { fallback: 'Idle' }, SwordWalk: { loop: true, fallback: 'Walk' }, SwordRun: { loop: true, fallback: 'run' },
  SwordSwing: { fallback: 'Swipe' },
};

/**
 * Hierarchy: root (ground position and heading) > body (height) > model. All poses, including lying on its side for
 * petting or the sleeping curl, come from the GLB clips (the `Root` bone carries the roll). A ground contact recomputes
 * the height of `body` each frame from the lowest point of the deformed mesh (safety: the clips are already grounded).
 */
export class Cat {
  static async load(url) {
    const gltf = await new GLTFLoader().loadAsync(url);
    return new Cat(gltf);
  }

  constructor(gltf) {
    this.root = new THREE.Group();
    this.body = new THREE.Group();
    this.model = gltf.scene;
    this.root.add(this.body);
    this.body.add(this.model);

    this.rig = new CatRig(this.model);
    this.meshes = this.rig.meshes;
    this.meshes.forEach((m) => { m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; });

    this._fit();
    // Fur shells on the body only (eyes stay bare); outside `meshes`: no click, no ground contact.
    const furBody = this.meshes.find((m) => m.name === 'CatBody') ?? this.meshes[0];
    const eyes = this.meshes.filter((m) => m !== furBody && m.isSkinnedMesh);
    this.fur = new Fur(furBody, eyes);
    this.eyes = new Eyes(eyes);
    this._time = 0;

    this.mixer = new THREE.AnimationMixer(this.model);
    this.clips = {};
    for (const clip of gltf.animations) this.clips[clip.name] = clip;
    // A single warning for all missing clips (hunt clips have a fallback).
    const missing = Object.keys(CLIPS).filter((name) => !this.clips[name])
      .map((name) => (CLIPS[name].fallback ? `${name} (fallback ${CLIPS[name].fallback})` : name));
    if (missing.length) console.warn('clip missing from GLB:', missing.join(', '));
    this.actions = {};
    for (const [name, clip] of Object.entries(this.clips)) {
      const a = this.mixer.clipAction(clip);
      a.enabled = true;
      a.setEffectiveWeight(0);
      a.play();
      if (!CLIPS[name]?.loop) a.setLoop(THREE.LoopOnce, 1).clampWhenFinished = true;
      this.actions[name] = a;
    }
    // Second playback of `Pet` for the rise before the walk (onPetRise): a cross-fade between two times of the same
    // clip. Outside `actions`, since nothing else plays it.
    if (this.clips.Pet) {
      const a = this.mixer.clipAction(this.clips.Pet.clone());
      a.enabled = true;
      a.setEffectiveWeight(0);
      a.play();
      a.setLoop(THREE.LoopOnce, 1).clampWhenFinished = true;
      this._petRiseAction = a;
    }
    this._petRise = false;   // rise before the walk in progress
    this._petPrev = null;    // gait left when entering `Pet` (slowed with the root)
    this._petPrevRate = 1;
    this._petSettle = 0;     // seconds left of the recovery after petting
    this.actions.Idle.setEffectiveWeight(1);
    this.current = this.actions.Idle;

    this.pivotY = this.height * 0.42;
    this.model.position.y -= this.pivotY;
    this.body.position.y = this.pivotY;
    this._lift = null;
    this._sleepFrom = null; // dropAsleep: start of the Sleep clip for the next `sleep` state
    this.debug = { minY: 0, lift: 0 };

    this.procedural = new Procedural(this.rig);
    // Ears that follow the head's procedural gaze (Helmet.js).
    this.earFollow = new EarFollow(this.rig);
    this.locomotion = new Locomotion(this.root);
    if (this.duration('Walk')) this.locomotion.speed = WALK_STRIDE * this.model.scale.x * WALK_RATE / this.duration('Walk');
    this.walkSpeed = this.locomotion.speed;
    // Stalk speed: from the `Stalk` clip if present, otherwise slow `Walk` (same formula).
    if (this.duration('Stalk')) this.stalkSpeed = STALK_STRIDE * this.model.scale.x * STALK_RATE / this.duration('Stalk');
    else this.stalkSpeed = this.walkSpeed * STALK_FALLBACK_RATE / WALK_RATE;
    // Trot and run without sliding (same formula); fallbacks: sped-up Walk, PLAY.runSpeed.
    const k = this.model.scale.x;
    this.trotSpeed = this.duration('Trot') ? TROT_STRIDE * k / this.duration('Trot') : this.walkSpeed * TROT_FALLBACK_RATE / WALK_RATE;
    this.runSpeed = this.duration('run') ? RUN_STRIDE * k / this.duration('run') : PLAY.runSpeed;
    // Sword gaits at rate 1 (SWORD_GAIT); fallbacks: walking and running without a sword.
    this.swordWalkSpeed = this.duration('SwordWalk') ? SWORD_GAIT.walkStride * k / this.duration('SwordWalk') : this.walkSpeed / WALK_RATE;
    this.swordRunSpeed = this.duration('SwordRun') ? SWORD_GAIT.runStride * k / this.duration('SwordRun') : this.runSpeed;
    this.sword = false;       // sword in the mouth (setSword, Story): SwordWalk / SwordRun / SwordSwing clips
    this._rate = 1;           // playback speed of the current clip (frozen stalk = 0)
    this.brain = new Brain(this);
    this.onState = null;      // callback (state) for outside systems (sounds, HUD)
    this._state = 'idle';
    this._standUpLeft = 0;    // seconds left of the backward-played rise
    this._tailBase = 'up';
    this._petHold = 0;      // s left with the petting clip frozen
    this._lidSoft = false;  // eyelids follow a smooth ramp instead of the direct value
    this._lidRamp = null;   // ramp in progress { from, to, u, T }
    this._chaseGait = null; // gait of the chase clip in use
    // Helmet (Helmet.js): child of the Head bone, outside `meshes` (no ground contact or direct click: Picker goes
    // through `helmet.hit`). A build error must not block the game.
    try { attachHelmet(this); } catch (e) { console.warn('helmet not built:', e); this.helmet = null; }
    // Carrying (see CARRY): carrier NPC (Npc, `mouthAnchor` and `root`) or null.
    this.carrier = null;
    // Look target imposed by the scene (Story, opening): takes priority over prey and pointer.
    this.lookOverride = null;
    this._nape = this.model.getObjectByName('Neck001') ?? null;
  }

  /** Current carry anchor (read by Brain.update: no ground contact while carried). */
  get carryAnchor() { return this.carrier?.mouthAnchor ?? null; }

  /**
   * Carried by `npc` (its mouth, `npc.mouthAnchor`): brain in a scene, `Carried` clip, eyes closed. `npc.update` must
   * run before `cat.update` each frame. `carry(null)`: set down, the brain stays in the scene (Story then calls
   * `brain.setScripted`).
   */
  carry(npc) {
    if (npc && this._nape) {
      this.carrier = npc;
      this.brain.setScripted('carried');
      return true;
    }
    if (this.carrier) {
      this.carrier = null;
      const p = this.root.position;
      const ground = this.brain._groundAt(p.x, p.z);
      // The body keeps its current height (root on the ground, offset moved to `_lift`); ground contact then resumes
      // the descent, with no jump.
      this._lift = p.y - ground;
      this.body.position.y = this.pivotY + this._lift;
      p.y = ground;
      this.locomotion.heading = this.root.rotation.y;
    }
    return false;
  }

  /**
   * Sets the kitten down asleep: brain `sleep` state (scene), but the `Sleep` clip starts at `from` s (on its side,
   * SLEEP_DROP) rather than 0 (standing), with a `fade` s from the current clip (`Carried`). Ordinary sleep keeps
   * `Sleep` from the start.
   */
  dropAsleep(from = SLEEP_DROP.from, fade = SLEEP_DROP.fade) {
    this._sleepFrom = { from, fade };
    this.brain.setScripted('sleep');
    this._sleepFrom = null;
  }

  /** Current brain state (tests: `__cat.state`). */
  get state() { return this.brain.state; }

  /** Scales the model to a real cat, on the ground, muzzle toward +Z. */
  _fit() {
    this.model.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(this.model);
    const size = box.getSize(new THREE.Vector3());
    const longest = Math.max(size.x, size.z);
    const s = CAT_LENGTH / longest;
    this.model.scale.setScalar(s);
    this.model.updateMatrixWorld(true);
    box.setFromObject(this.model);
    const center = box.getCenter(new THREE.Vector3());
    this.model.position.set(-center.x, -box.min.y, -center.z);

    // Turns the muzzle toward +Z: the head must be in front of the hip.
    const head = this.rig.head.getWorldPosition(new THREE.Vector3());
    const hip = this.rig.hip.getWorldPosition(new THREE.Vector3());
    const forward = head.clone().sub(hip).setY(0);
    const angle = Math.atan2(forward.x, forward.z);
    this.model.rotation.y = -angle;
    this.model.updateMatrixWorld(true);
    box.setFromObject(this.model);
    this.model.position.x -= (box.min.x + box.max.x) / 2;
    this.model.position.z -= (box.min.z + box.max.z) / 2;
    this.model.position.y -= box.min.y;
    this.height = size.y * s;
  }

  /** Duration (s) of a GLB clip, 0 if missing. */
  duration(name) { return this.clips[name]?.duration ?? 0; }

  /** Cross-fade to a clip; `from` = start time (the rise is played backward with timeScale −1). */
  play(name, fade = 0.3, timeScale = 1, from = null) {
    const next = this.actions[name];
    if (!next) return;
    if (next === this.current) {
      // Same clip (backward rise from the held pose): change time and direction without a fade, otherwise the
      // weight restarts at 0 and the rest pose flashes for a fraction of a second.
      if (from !== null) next.time = from;
      next.paused = false;
      next.setEffectiveTimeScale(timeScale);
      return;
    }
    next.reset();
    if (from !== null) next.time = from;
    next.setEffectiveTimeScale(timeScale).setEffectiveWeight(1).fadeIn(fade);
    this.current.fadeOut(fade);
    this.current = next;
  }

  /** Rise from a held pose: the settling clip is replayed backward. */
  _standUp(clipName) {
    const hold = CLIPS[clipName]?.hold;
    if (!hold || !this.actions[clipName]) { this.play('Idle', 0.5); return; }
    this.play(clipName, 0.3, -1, hold);
    this._standUpLeft = hold;
  }

  onStateChange(state) {
    const p = this.procedural;
    const prev = this._state;
    this._state = state;
    this._standUpLeft = 0;
    p.breathRate = 2.2; p.breathAmp = 0.02;
    p.focus = false;
    this._rate = 1;
    this.locomotion.speed = this.walkSpeed;
    this.locomotion.turnRate = 4;
    if (this._petPrev) this._petPrev.setEffectiveTimeScale(this._petPrevRate);
    this._petRise = false; this._petPrev = null; this._petSettle = 0; this._petHold = 0;
    p.stopEase();
    if (this.sword && this._swordState(state)) { this.onState?.(state); return; }
    switch (state) {
      case 'walk': this.play('Walk', prev === 'pet' ? PET_EXIT_FADE : 0.25, WALK_RATE); p.lookWeight = 0.5; this._tailBase = 'low'; break;
      // Medium-distance ground click (Brain, GOTO): trot, fade from walk or run.
      case 'trot':
        this.locomotion.speed = this.trotSpeed;
        this.locomotion.turnRate = 5;
        p.lookWeight = 0.5; this._tailBase = 'low';
        if (this.actions.Trot) this.play('Trot', prev === 'pet' ? PET_EXIT_FADE : 0.25);
        else { this._rate = TROT_FALLBACK_RATE; this.play('Walk', prev === 'pet' ? PET_EXIT_FADE : 0.25, TROT_FALLBACK_RATE); }
        break;
      // Far ground click (Brain, GOTO): same run as for the yarn ball, without locking the gaze.
      case 'run':
        this.locomotion.speed = this.runSpeed;
        this.locomotion.turnRate = 6;
        p.lookWeight = 0.5; this._tailBase = 'low';
        if (this.actions.run) this.play('run', prev === 'pet' ? PET_EXIT_FADE : 0.2);
        else { this._rate = 2; this.play('Walk', prev === 'pet' ? PET_EXIT_FADE : 0.2, 2); }
        break;
      // Hunt: the cat walks to the spotted butterfly, then stalks, then pounces.
      case 'approach': this._rate = WALK_RATE; this.play('Walk', 0.25, WALK_RATE); p.lookWeight = 0.8; p.focus = true; this._tailBase = 'low'; break;
      case 'stalk':
        this.locomotion.speed = this.stalkSpeed;
        this.locomotion.turnRate = 2;
        p.lookWeight = 0.6; p.focus = true;
        if (this.actions.Stalk) { this._rate = STALK_RATE; this.play('Stalk', 0.4, STALK_RATE); this._tailBase = 'clipTip'; }
        else { this._rate = STALK_FALLBACK_RATE; this.play('Walk', 0.4, STALK_FALLBACK_RATE); this._tailBase = 'stalk'; }
        break;
      case 'pounce':
        p.lookWeight = 0.4; p.focus = true;
        if (this.actions.Pounce) { this.play('Pounce', 0.2); this._tailBase = 'clipTip'; }
        else { this.play('Idle', 0.3); this._tailBase = 'crouch'; }
        break;
      // Yarn ball: run (`run` clip, `runSpeed` without sliding), then a push and a short pause on the idle cycle,
      // gaze and tail locked on the ball.
      case 'chase':
        this.locomotion.turnRate = 6;
        p.lookWeight = 0.8; p.focus = true; this._tailBase = 'low';
        this._chaseGait = null;
        this.setChaseGait('run', prev === 'pet' ? PET_EXIT_FADE : 0.2);
        break;
      case 'bat': this.play('Idle', 0.2); p.lookWeight = 1; p.focus = true; this._tailBase = 'crouch'; break;
      case 'pet': {
        const moving = prev === 'walk' || prev === 'trot' || prev === 'run';
        if (moving && this.current !== this.actions.Pet) {
          this._petPrev = this.current; this._petPrevRate = this.current.getEffectiveTimeScale();
        }
        const posed = prev === 'sit' || prev === 'lie';
        this.play('Pet', moving ? PET_IN_FADE.move : posed ? PET_HOLD : prev === 'idle' ? PET_IN_FADE.idle : PET_IN_FADE.other);
        p.lookWeight = 0.2; this._tailBase = 'clip';
        break;
      }
      case 'sit': this.play('Sit', 0.5); p.lookWeight = 1; this._tailBase = 'clip'; break;
      case 'lie': this.play('Lie', 0.5); p.lookWeight = 0.7; this._tailBase = 'clip'; break;
      case 'stretch': this.play('Stretch', 0.3); p.lookWeight = 0; this._tailBase = 'clip'; break;
      case 'groom': this.play('Groom', 0.4); p.lookWeight = 0; this._tailBase = 'clip'; break;
      case 'sleep': this.play('Sleep', this._sleepFrom?.fade ?? 0.8, 1, this._sleepFrom?.from ?? null); p.lookWeight = 0; this._tailBase = 'clip'; p.breathRate = 1.1; p.breathAmp = 0.035; break;
      case 'wake': this.play('Wake', 0.4); p.lookWeight = 0.5; this._tailBase = 'clip'; break;
      // Opening scene (Story.js): hanging by the scruff, nothing moves apart from the clip.
      case 'carried': this.play(this.actions.Carried ? 'Carried' : 'Idle', 0.3); p.lookWeight = 0; this._tailBase = 'clip'; break;
      // Opening: standing, the head searches (Story sets `lookOverride`); then a seated yawn (`Yawn` clip, after
      // 'sit'), rising as from 'sit'.
      case 'look': this.play('Idle', 0.5); p.lookWeight = 1; this._tailBase = 'low'; break;
      case 'yawn': this.play(this.actions.Yawn ? 'Yawn' : 'Sit', 0.3); p.lookWeight = 0; this._tailBase = 'clip'; break;
      // Before the hug: head shake, procedural gaze off.
      case 'shake': this.play(this.actions.HeadShake ? 'HeadShake' : 'Idle', 0.25); p.lookWeight = 0; this._tailBase = 'clip'; break;
      // Low walls: up (`Jump` clip) and down (`JumpDown` clip); root moved by Brain.
      case 'jump': this.play(this.actions.Jump ? 'Jump' : 'Idle', 0.15); p.lookWeight = 0.3; this._tailBase = 'clip'; break;
      case 'jumpdown': this.play(this.actions.JumpDown ? 'JumpDown' : 'Idle', 0.15); p.lookWeight = 0.3; this._tailBase = 'clip'; break;
      // Combat (Duel in src/game/combat.js, Brain.setScripted): claw swipe toward the boss, tail from the clip
      // (balance of the strike); knockback: in-place clip, root pushed back by the game, gaze and tail left to the clip.
      case 'swipe': this.play(this.actions.Swipe ? 'Swipe' : 'Idle', 0.1); p.lookWeight = 0.3; p.focus = true; this._tailBase = 'clip'; break;
      case 'knock': this.play(this.actions.Knockback ? 'Knockback' : 'Idle', 0.06); p.lookWeight = 0; this._tailBase = 'clip'; break;
      // Sword pull (Story cutscene; src/world/Sword.js places the sword on the head): clip only, procedural gaze
      // off (the mouth must stay on the hilt).
      case 'pull': this.play(this.actions.SwordPull ? 'SwordPull' : 'Idle', 0.2); p.lookWeight = 0; this._tailBase = 'clip'; break;
      default:
        p.lookWeight = 1; this._tailBase = 'up';
        if (prev === 'sit' || prev === 'yawn') this._standUp('Sit');
        else if (prev === 'lie') this._standUp('Lie');
        else this.play('Idle', 0.5);
        if (prev === 'pet') { p.easeLook(PET_SETTLE); this._petSettle = PET_SETTLE; }
    }
    this.onState?.(state);
  }

  /**
   * Sword taken (`on` true, end of the pull) or dropped (victory, reset): the current state is replayed with the
   * matching clips (SWORD_GAIT). `replay` false: state left as is (end of the pull, Story._endPull: replaying 'pull'
   * would restart SwordPull from 0).
   */
  setSword(on, { replay = true } = {}) {
    on = !!on;
    if (on === this.sword) return;
    this.sword = on;
    if (replay) this.onStateChange(this._state);
  }

  /** Clips with the sword held (SWORD_GAIT); false: state has no sword clip, handled as without a sword. */
  _swordState(state) {
    const p = this.procedural, G = SWORD_GAIT;
    const has = (n) => !!this.actions[n];
    switch (state) {
      case 'walk':
        if (!has('SwordWalk')) return false;
        this._rate = G.walkRate; this.locomotion.speed = this.swordWalkSpeed * G.walkRate;
        this.play('SwordWalk', 0.25, G.walkRate);
        break;
      case 'trot':
      case 'run': {
        if (!has('SwordRun')) return false;
        const r = state === 'run' ? G.runRate : G.trotRate;
        this._rate = r; this.locomotion.speed = this.swordRunSpeed * r;
        this.locomotion.turnRate = state === 'run' ? 6 : 5;
        this.play('SwordRun', 0.2, r);
        break;
      }
      // Strike: head sweep of the clip, procedural gaze off (it would pull the blade off the gesture).
      case 'swipe':
        if (!has('SwordSwing')) return false;
        this.play('SwordSwing', 0.1); p.lookWeight = 0; p.focus = true; this._tailBase = 'clip';
        return true;
      // Idle: last frame of SwordPull (guard, sword high), held; the gaze barely moves the blade.
      case 'idle':
        if (!has('SwordPull')) return false;
        this.play('SwordPull', 0.3, 1, this.duration('SwordPull'));
        p.lookWeight = 0.3; this._tailBase = 'up';
        return true;
      default: return false;
    }
    p.lookWeight = 0.3; this._tailBase = 'low';
    return true;
  }

  /**
   * Yarn-chase gait, without leaving the `chase` state: `run`, `trot` or `walk`, clip and speed as for the states
   * of the same name; chosen by Brain from the distance.
   */
  setChaseGait(gait, fade = 0.25) {
    if (this._state !== 'chase' || this._chaseGait === gait) return;
    this._chaseGait = gait;
    this._rate = 1;
    if (gait === 'run') {
      this.locomotion.speed = this.runSpeed;
      if (this.actions.run) this.play('run', fade);
      else { this._rate = 2; this.play('Walk', fade, 2); }
    } else if (gait === 'trot') {
      this.locomotion.speed = this.trotSpeed;
      if (this.actions.Trot) this.play('Trot', fade);
      else { this._rate = TROT_FALLBACK_RATE; this.play('Walk', fade, TROT_FALLBACK_RATE); }
    } else {
      this.locomotion.speed = this.walkSpeed;
      this._rate = WALK_RATE; this.play('Walk', fade, WALK_RATE);
    }
  }

  /**
   * Brain sets the `Pet` clip at time `t` (entering from Sit / Lie, new click: same pose); `hold` > 0: the clip stays
   * frozen for `hold` s (fade from the seated or lying pose, PET_HOLD).
   */
  onPetTime(t, hold = 0) {
    const pet = this.actions.Pet;
    pet.time = t;
    if (hold > 0) { this._petHold = hold; pet.setEffectiveTimeScale(0); }
  }

  /**
   * Ground click during petting (Brain._petRise): rise of the `Pet` clip from `from` s at `rate` times speed. If the
   * clip is not there yet (head hold), PET_RISE_FADE s fade to a second playback starting at `from`; otherwise the
   * current clip just speeds up.
   */
  onPetRise(from, rate) {
    this._petRise = true;
    const pet = this.actions.Pet, rise = this._petRiseAction;
    if (rise && this.current === pet && from > pet.time + 1e-3) {
      rise.reset();
      rise.time = from;
      rise.setEffectiveTimeScale(rate).setEffectiveWeight(1).fadeIn(PET_RISE_FADE);
      pet.fadeOut(PET_RISE_FADE);
      this.current = rise;
    } else this.current.setEffectiveTimeScale(rate);
  }

  /** Frozen stalk (Brain): the current clip stops in place, then resumes at its speed. */
  freeze(frozen) { this.current.setEffectiveTimeScale(frozen ? 0 : this._rate); }

  /** True if this clip is in the GLB (otherwise fallback, see CLIPS). */
  hasClip(name) { return !!this.actions[name]; }

  /** Ground point between the two front paws (world frame): where the pounce lands. */
  pawPoint(out = new THREE.Vector3()) {
    this.rig.legs.FL.paw.getWorldPosition(out);
    this.rig.legs.FR.paw.getWorldPosition(_w);
    return out.add(_w).multiplyScalar(0.5).setY(this.root.position.y);
  }

  /**
   * Eyelids: closed while carried or asleep, closed while the `Pet` clip is in the rubbing window, open otherwise
   * (they reopen during `wake`).
   */
  _updateLids(dt) {
    const pet = this.actions.Pet;
    const t = pet ? pet.time : -1;
    const s = this.brain.state;
    // Carried and asleep: eyes closed.
    const closed = s === 'carried' || s === 'sleep';
    const target = closed ? 1 : s === 'pet' && !this._petRise && t >= PET_HEAD_HOLD[0] && t <= PET_HEAD_HOLD[1] ? PET_LID : 0;
    const lid = this.eyes.getLid();
    // Petting (and reopening after it): smoothstep ramp from the current value to the target, duration proportional
    // to the gap; restarted from the current value if the target changes.
    if (s === 'pet') this._lidSoft = true;
    if (this._lidSoft) {
      let r = this._lidRamp;
      if (!r || r.to !== target) {
        const T = Math.abs(target - lid) * (target > lid ? PET_LID_CLOSE : PET_LID_OPEN);
        r = this._lidRamp = { from: lid, to: target, u: 0, T: Math.max(T, 1e-3) };
      }
      r.u = Math.min(1, r.u + dt / r.T);
      const next = r.from + (r.to - r.from) * r.u * r.u * (3 - 2 * r.u);
      if (next !== lid) this.eyes.setLid(next);
      if (r.u >= 1 && s !== 'pet') { this._lidSoft = false; this._lidRamp = null; }
      return;
    }
    if (lid === target) return;
    const rate = target > lid ? LID_CLOSE_RATE : LID_OPEN_RATE;
    let next = lid + (target - lid) * (1 - Math.exp(-rate * dt));
    if (Math.abs(next - target) < 1e-3) next = target;
    this.eyes.setLid(next);
  }

  /** Lowest point of the deformed mesh, in world frame (one vertex in three). */
  _lowestVertexY() {
    let minY = Infinity;
    for (const m of this.meshes) {
      m.skeleton.update();
      const n = m.geometry.getAttribute('position').count;
      for (let i = 0; i < n; i += 3) {
        m.getVertexPosition(i, _v).applyMatrix4(m.matrixWorld);
        if (_v.y < minY) minY = _v.y;
      }
    }
    return minY;
  }

  update(dt, world, pointerWorld) {
    this._time += dt;
    this.fur.update(this._time);
    if (world && this.brain.world !== world) this.brain.setWorld(world);
    this.brain.update(dt);
    if (this.carrier) this.body.rotation.x = this.body.rotation.z = 0;
    else this._updateTilt(dt);
    this.procedural.restore();
    this.earFollow.restore();
    // End of the `Pet` clip freeze (PET_HOLD): it restarts, excluding the part of the frame already held.
    if (this._petHold > 0) {
      this._petHold -= dt;
      if (this._petHold <= 0) {
        const pet = this.actions.Pet;
        pet.setEffectiveTimeScale(1);
        pet.time += this._petHold; // minus the overshoot: the mixer then advances by dt
        this._petHold = 0;
      }
    }
    this.mixer.update(dt);
    this._updateLids(dt);
    this.helmet?.update(dt);

    // End of the backward-played rise: back to the idle cycle.
    if (this._standUpLeft > 0) {
      this._standUpLeft -= dt;
      if (this._standUpLeft <= 0) this.play('Idle', 0.3);
    }

    // Tail hooks when the pointer nears the head (calm cat only).
    let tail = this._tailBase;
    if (pointerWorld && (this.brain.state === 'idle' || this.brain.state === 'sit')) {
      this.rig.head.getWorldPosition(_v);
      if (_v.distanceTo(pointerWorld) < 0.55) tail = 'hook';
    }
    // Recovery after petting (PET_SETTLE): the tail still follows the clip.
    if (this._petSettle > 0) { this._petSettle -= dt; tail = 'clip'; }
    // Damped stop on entering `Pet` (Brain.petGlide): the gait left slows down with the root.
    if (this._petPrev) this._petPrev.setEffectiveTimeScale(this._petPrevRate * this.brain.petGlide);
    this.procedural.tailMode = tail;
    // During a hunt or play, the head follows the prey or yarn ball rather than the pointer.
    this.procedural.lookTarget = this.lookOverride ?? this.brain.lookAt ?? pointerWorld;

    this.root.updateMatrixWorld(true);
    this.earFollow.begin();
    this.procedural.update(dt, this.body);
    this.earFollow.apply();

    if (this.carrier) {
      // Nape stuck to the mouth: Maman's heading + CARRY.yaw, root offset by (mouth − nape).
      this.root.rotation.y = this.carrier.root.rotation.y + CARRY.yaw;
      this.body.position.y = this.pivotY;
      this.root.updateMatrixWorld(true);
      this._nape.localToWorld(_w.copy(CARRY.nape));
      this.carrier.mouthAnchor.getWorldPosition(_v);
      this.root.position.add(_v.sub(_w));
      this.root.updateMatrixWorld(true);
      return;
    }

    // Ground contact: the lowest point of the mesh is brought to the root's height (terrain or low wall top, set by
    // Brain), quickly going up (no sinking through the ground), more slowly going down (no jolt).
    const minY = this._lowestVertexY();
    const target = (this._lift ?? 0) - (minY - this.root.position.y) + 0.004;
    if (this._lift === null) this._lift = target;
    else if (this.brain.pouncing || this.brain.jumping || this.brain.state === 'knock') {
      // In the air during a pounce or low-wall jump: ground contact must not flatten the clip's jump (during a
      // low-wall jump, height comes from the root, Brain._updateJump). Combat knockback: the clip lifts the body at
      // 0.28 s, so the height is kept.
    } else {
      // While walking, the imported cycle brushes the ground with the paws: come down very slowly so the cat does
      // not hop.
      const s = this.brain.state;
      const down = s === 'walk' || s === 'trot' || s === 'run' || s === 'approach' || s === 'stalk' || s === 'chase' ? 2 : 10;
      this._lift += (target - this._lift) * (1 - Math.exp(-(target > this._lift ? 30 : down) * dt));
    }
    this.body.position.y = this.pivotY + this._lift;
    this.root.updateMatrixWorld(true);
    this.debug.minY = minY; this.debug.lift = this._lift;
  }

  /** Body tilt from the terrain slope under the root (see TILT). */
  _updateTilt(dt) {
    const b = this.brain;
    let pitch = 0, roll = 0;
    if (!b.onWall && !b.jumping) {
      const g = b._groundAt, p = this.root.position, h = this.locomotion.heading;
      const fx = Math.sin(h), fz = Math.cos(h); // forward (local +Z)
      const sx = Math.cos(h), sz = -Math.sin(h); // local +X
      const A = TILT.ahead, S = TILT.side;
      const dF = g(p.x + fx * A, p.z + fz * A) - g(p.x - fx * A, p.z - fz * A);
      const dS = g(p.x + sx * S, p.z + sz * S) - g(p.x - sx * S, p.z - sz * S);
      // rotation.x > 0 lowers the muzzle (+Z toward −Y): nose up when climbing.
      pitch = THREE.MathUtils.clamp(-Math.atan(dF / (2 * A)) * TILT.gain, -TILT.max, TILT.max);
      // rotation.z > 0 raises the +X flank: the uphill side is raised.
      roll = THREE.MathUtils.clamp(Math.atan(dS / (2 * S)) * TILT.gain, -TILT.max, TILT.max);
    }
    const k = 1 - Math.exp(-TILT.rate * dt);
    this.body.rotation.x += (pitch - this.body.rotation.x) * k;
    this.body.rotation.z += (roll - this.body.rotation.z) * k;
  }
}
