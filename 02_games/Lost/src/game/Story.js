import * as THREE from 'three';
import { Bubble } from './Bubble.js';
import { MINIMAP_GOALS } from '../ui/MiniMap.js';
import { Letterbox } from '../ui/Letterbox.js';
import { unlockAudio } from '../audio/context.js';
import { meow } from '../audio/Meow.js';
import { BOSS } from './combat.js';
import { Wizard } from './Wizard.js';
import { Crossing } from './Crossing.js';
import { CHAVALANCHE } from './Chavalanche.js';
import { VEIL_CSS, OPENING, SHOT, HUG, TALK, MOVING, REFRAME, SKIP_DIST, LOSS } from './story/tuning.js';
import { dialogueScenes } from './story/dialogue.js';
import { openingScene } from './story/opening.js';
import { endingScene } from './story/ending.js';
import { fightDirection } from './story/fight.js';
import { swordPullScene } from './story/swordPull.js';
import { victoryScene } from './story/victory.js';
import { mixin } from '../mixin.js';

/**
 * Story flow of Lost, created by main.js. Steps (`story.step`):
 * - 'title' at load (main.js: title screen, name field). The play button unlocks audio and starts the opening.
 * - 'opening': fixed tight shot with black bars (Letterbox.js). Maman enters from the left of the screen with the
 *   kitten (scale 1) hanging from her mouth, stops, lowers her head and releases it on contact with the ground, asleep
 *   (it does not get up), raises her head, turns around, leaves by the left and disappears. The kitten sleeps for a
 *   moment, wakes by itself (Wake), looks around, sits and yawns (Yawn). The shot widens, then 'chagicien' (minimap shown,
 *   control returned, bars removed softly). Clicks are ignored during the whole opening (transparent veil), the minimap
 *   is hidden and there is no text.
 * - 'wakeup': test access only (`skipTo('wakeup')`: wakes on the ground), then 'chagicien'.
 * - 'chagicien', 'chartiste', 'maman': NPCs to find (minimap: ruins, forest, Maman). Speech bubble on clicking the NPC or
 *   on approach (TALK.approach); the end of the bubble moves to the next step. A second visit to the Chartiste before
 *   Maman gives the challenge bubble, then 'combat'.
 * - 'chavalanche': after the victory over the Chartiste, the goal is the Chavalanche at the foot of the mountain (minimap:
 *   `chavalanche`). His first bubble (`met.chavalanche`) makes him get up and follow the kitten (Chavalanche.js) and sets
 *   the goal back to Maman (step 'maman'). Maman also responds at this step: the Chavalanche is never a gate to pass.
 * - 'combat': arena built around the Chartiste (World.enterArena), transformation into a red boss (Npc.startBoss), life
 *   bar shown. Control is then returned with a farther camera. Damage (combat.js, Duel), sword in the stone that can be
 *   taken during combat (`pickSword`, sword-pull cinematic, src/world/Sword.js) and full victory (`_victory`, VICTORY):
 *   Defeat, back to ginger and small, dissolve, sword dropped, arena undone, then 'maman'. Any step skip (`skipTo`), replay
 *   or title screen restores the out-of-combat state (`_endCombat`) and the sword in its stone (`_resetVictory`). Music:
 *   `onMusicCue` (see `_cue`).
 * - 'hug': the kitten curls up against Maman's belly (Npc.startHug, hugSpot) and falls asleep, camera on the belly side;
 *   two purrs (main.js, onStep), then 'end' (end screen).
 * - 'free' (stay button: minimap towards Maman) or 'title' (quit button: title screen, kitten name asked again, then the
 *   play button restarts the opening).
 *
 * During a speech bubble the cat no longer moves (Brain.setHold), the camera frames both cats with their heads above the
 * bubble and each meows in turn (`_meowPage`). On closing, the camera returns softly to the game shot from before the
 * bubble (`_back`).
 *
 * `update(dt)`: every frame BEFORE `npc.update` and `cat.update` (Maman moves, the kitten follows her mouth). Without NPCs
 * (`?npc=0`): no opening, step 'free', minimap shown without a goal.
 *
 * The class is split by scene: each file of `story/` adds its methods through the `mixin` call at the end of this file.
 */

const _v = new THREE.Vector3();
const _frustum = new THREE.Frustum();
const _pv = new THREE.Matrix4();
const _sphere = new THREE.Sphere();

export class Story {
  /**
   * @param {object} o
   * @param {object} o.world World.js
   * @param {object} o.cat Cat.js
   * @param {{ chagicien?, chartiste?, maman? }} o.npcs NPCs (Npc.js); empty if `?npc=0`.
   * @param {object} o.minimap MiniMap.js
   * @param {object} o.endScreen EndScreen.js
   * @param {object} [o.places] { chagicien: [x, z, yaw], chartiste: […], maman: [x, z, yaw] }
   * @param {object} [o.bossBar] BossBar.js; absent: no bar.
   * @param {object} [o.catBar] BossBar.js, `cat` variant: kitten's bar; absent: no bar.
   * @param {object} [o.sword] Sword.js (sword in the stone); absent: no sword.
   * @param {object} [o.dissolve] Dissolve.js (dissolve of the defeated boss); absent: body hidden.
   */
  constructor({ world, cat, npcs, minimap, endScreen, places, bossBar = null, catBar = null, sword = null, dissolve = null }) {
    this.world = world;
    this.cat = cat;
    this.npcs = npcs;
    this.minimap = minimap;
    this.end = endScreen;
    this.places = places;
    this.bubble = new Bubble();
    this.step = '';
    this.met = { chagicien: false, chartiste: false, maman: false, boss: false, chavalanche: false };
    this.chavalanche = null; // Chavalanche.js (main.js): follows the kitten on the mountain, helps on request
    this.onStep = null; // (step) => void
    this._open = null;  // opening in progress: { phase, t, … }
    this._hugT = 0;
    this._talking = null; // NPC whose speech bubble is open
    this._cam = null;     // current shot (see SHOT, _shot)
    this._pin = null;     // point followed by the camera during the opening (fixed shot), otherwise null
    this._talkKind = null; this._framedAt = null; this._haltPending = false; // see _halt, REFRAME
    this._gameOff = null; // camera-to-target offset of the game shot, kept when a bubble opens
    this._back = 0;       // s remaining of the camera return after a bubble
    this._meowN = 0;      // meows of the conversation (variant)
    this.lastDrop = null; // last release of the kitten { t, gap, k, fallback } (for tests)
    this._shake = null;   // shake in progress before the hug: { t, dur, dropped }
    this.lastHelmetDrop = null; // last helmet detachment { t, clipTime, side } (for tests)
    this.bars = new Letterbox();
    // Combat: sequence in progress { phase: 'build' | 'grow' | 'fight', t, … } or null; exploration values of the camera and
    // shadow, restored by `_endCombat`.
    this.bossBar = bossBar;
    this.catBar = catBar;
    this._combat = null;
    // Difficulty: key of LEVELS (difficulty.js) set by the button of the challenge bubble (`_chooseLevel`); 'easy' until a
    // choice has been made (`skipTo('combat')`).
    this.level = 'easy';
    this._challengeOpen = false; // challenge bubble open (music silenced, `musicSilent`)
    this._loss = null;      // defeat in progress: { t, swapped, t0 } (`_lose`, `_updateLoss`)
    this.losses = 0;        // defeats since page load (for tests)
    this.lastLoss = null;   // last defeat { level, hits, time } (for tests)
    this.cueLog = [];       // last music cues [{ cue, level }] (for tests, at most 40)
    const sc = world.sun.shadow.camera;
    this._explore = { maxDistance: world.controls.maxDistance, shadow: [sc.left, sc.right, sc.top, sc.bottom] };
    // Sword and victory.
    this.sword = sword;
    this.dissolve = dissolve;
    this._pull = null;      // sword pull in progress: { phase: 'walk' | 'pull', t } or null
    this.timeScale = 1;     // slow motion of the pull (SWORD.slow): main.js multiplies dt by this value
    this.onMusicCue = null; // (name) => void: music hook, see `_cue`
    this.lastCue = null;    // last music cue (for tests)
    this.lastPull = null;   // last sword pull { walk, clip, slowMin } (for tests)
    this._chartisteObstacle = [];  // Chartiste's obstacles removed after his dissolve (restored by _resetVictory)
    if (sword) sword.canTake = () => this.swordTakeable;

    const style = document.createElement('style');
    style.textContent = VEIL_CSS;
    document.head.append(style);
    this.veil = document.createElement('div');
    this.veil.className = 'lost-veil';
    document.body.append(this.veil);
    for (const type of ['pointerdown', 'click']) this.veil.addEventListener(type, (e) => e.stopPropagation());
    this.veil.addEventListener('pointerup', (e) => e.stopPropagation());
    // Bridge crossing (fade on this veil), the moving Chagicien, and the gate that notifies the cat's grid and the minimap when
    // the way changes.
    this.crossing = new Crossing(this);
    this.wizard = npcs.chagicien ? new Wizard(this) : null;
    world.rampart.onBlockChange = () => { this._navChanged(32.5, 0, 6); minimap.refresh?.(); };

    endScreen.onStay = () => this._stay();
    endScreen.onQuit = () => this._quit();
    // Play button or Enter in the field (EndScreen._play, in the handler): audio unlocked synchronously, before anything else;
    // the name is already stored (setPlayerName).
    endScreen.onReplay = () => { unlockAudio(); this.start(); };
    // Spontaneous kitten meow: Brain calls onMeow after 30 calm seconds; recorded long call (Meow.js, `call`). A callback
    // already set is kept.
    if (cat?.brain && !cat.brain.onMeow) cat.brain.onMeow = () => meow('kitten', { call: true });
  }

  get hasNpcs() { return !!(this.npcs.chagicien && this.npcs.chartiste && this.npcs.maman); }

  /**
   * Title screen, at load and after the quit button: the scene behind it is the first shot of the opening, frozen (Maman
   * and kitten still off screen, no bars: they come with the play button), so the kitten does not play freely before being
   * carried in. The play button restarts the opening (onReplay).
   */
  showTitle() {
    this.start();
    this.bars.hide(0);
    this._setStep('title');
    this.end.showTitle(); // name field emptied: the name is asked again on every run
    this.minimap.setVisible(false);
  }

  /** Starts (or restarts) the opening. */
  start() {
    this.crossing.reset();
    this._resetChallenge(); // challenge bubble or defeat in progress: abandoned, music restored
    this._endCombat(); // replay or quit (showTitle): arena and boss removed
    this._resetVictory(); // sword in its stone, Chartiste back
    this.world.syncZone(OPENING.drop.x); // the run starts in the meadow, wherever the cat comes from
    this.end.hide();
    this.bubble.close();
    this._talking = null;
    this._back = 0; this._gameOff = null;
    // Replay: shake stopped, helmet back on the head.
    this._shake = null;
    this.cat.helmet?.reattach();
    this.cat.brain.setHold(false);
    this.met = { chagicien: false, chartiste: false, maman: false, boss: false, chavalanche: false };
    this.chavalanche?.reset(); // seated at the foot of the mountain, no following or protection
    this._syncProgress(); // gate closed, Chagicien at the ruins, no animation
    if (!this.hasNpcs) { this._setStep('free'); this.minimap.setTarget(null); this.minimap.setVisible(true); return; }
    const m = this.npcs.maman, cat = this.cat, O = OPENING;
    const ll = Math.hypot(O.look.x, O.look.z), lx = O.look.x / ll, lz = O.look.z / ll;
    // Screen right (rx, rz) = (−lz, lx); Maman starts on the left and walks right.
    const rx = -lz, rz = lx;
    const sx = O.drop.x - rx * O.arrive, sz = O.drop.z - rz * O.arrive;
    const yaw = Math.atan2(rx, rz);
    // Any hug still running ends (quit via showTitle, play, skipTo('opening')), as in _stay and skipTo: `_hug` back to null,
    // eyes open, rest pose before carrying.
    m.endHug();
    this._placeNpcs();
    // Maman carries the kitten in the meadow during the opening: at the scene root, visible in this zone, until
    // `_placeMamanAtSummit`. Her rest pose is in zone 2.
    this.world.scene.add(m.root);
    m.setVisible(true);
    m.setPosition(sx, this._ground(sx, sz), sz, yaw);
    m.startCarry(0);
    m.update(0, this.world.camera);
    cat.carry(null);
    cat.lookOverride = null;
    cat.carry(m); // brain in the 'carried' scene
    this._open = { phase: 'walk', t: 0, yaw, lx, lz, rx, rz };
    this.lastDrop = null;
    this.veil.className = 'lost-veil on';
    this.bars.show();
    this.minimap.setVisible(false);
    // Fixed shot: the camera follows `_pin` (main.js, followPoint), gaze `look`, no glide.
    const fx = O.drop.x + rx * O.focus.right + lx * O.focus.ahead, fz = O.drop.z + rz * O.focus.right + lz * O.focus.ahead;
    this._pin = new THREE.Vector3(fx, this._ground(fx, fz), fz);
    this._snapCamera(fx, fz);
    this._shot(lx, lz, this._closeShot(), true);
    this._setStep('opening');
  }

  /** Point followed by the camera (main.js → world.update): `_pin` during the opening, otherwise null (the cat). */
  get followPoint() { return this._pin; }

  /** Close-up of the opening: SHOT.close, camera moved back if the screen is narrow (halfWidth visible). */
  _closeShot() {
    const c = SHOT.close, cam = this.world.camera;
    const tanX = Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2) * cam.aspect;
    return { ...c, dist: Math.max(c.dist, c.halfWidth / tanX) };
  }

  /** Every frame, before npc.update and cat.update. */
  update(dt) {
    if (this._open && this.step !== 'title') this._updateOpening(dt); // frozen behind the title screen
    if (this._combat) this._updateCombat(dt); // before the glide: shot of this frame
    if (this._cam) this._applyShot(dt, false);
    // Held shots of the run and the victory: the glide lets nothing leave the frame.
    const kept = this._combat?.phase === 'victory' ? this._combat.v?.hold : this._pull?.hold;
    if (kept) this._holdFrame(kept, dt);
    const fit = this._combat?.phase === 'fight' && !this._pull; // sword-pull close-up kept
    if (fit) this._fitFight(dt);
    if (this._combat && this.world.inArena) this._keepInArena();
    if (fit) this._markFight();
    // Camera return after a bubble: the player gets it back after TALK_UI.back s.
    if (this._back > 0 && (this._back -= dt) <= 0) { this._back = 0; this._cam = null; this._gameOff = null; }
    const s = this.step;
    if (s === 'wakeup') {
      const st = this.cat.brain.state;
      if (st !== 'wake' && st !== 'sleep') this._goal('chagicien');
    } else if (s === 'hug') {
      this._hugT += dt;
      if (this._hugT >= HUG.hold) this._finish();
    }
    if (this._shake) this._updateShake(dt);
    if (!this.world.inMountain) this.wizard?.update(dt); // frozen in zone 2, resumed on return
    this.crossing.update(dt);
    if (this._loss) this._updateLoss(dt);
    // Speech bubble: on approaching the NPC of the step; closed if the cat moves away.
    const p = this.cat.root.position;
    if (this._talking) {
      const r = this._talking.root.position;
      if (Math.hypot(p.x - r.x, p.z - r.z) > TALK.leave) { this.bubble.close(); this._endTalk(); }
      else {
        // Stop deferred to the end of the jump; shot recomputed once the cat has stopped elsewhere.
        const b = this.cat.brain, f = this._framedAt;
        if (this._haltPending && !b.jumping) this._halt();
        if (f && this._talkKind && !b.jumping && !b.target && !MOVING.has(b.state) && Math.hypot(p.x - f.x, p.z - f.z) > REFRAME) this._frame(this._talkKind);
      }
    } else if (!this.bubble.isOpen && !this._shake) {
      // Step 'chavalanche': the Chavalanche first, Maman too if the kitten reaches her without having seen him.
      const kinds = s === 'chavalanche' ? ['chavalanche', 'maman'] : [{ chagicien: 'chagicien', chartiste: 'chartiste', maman: 'maman' }[s]];
      for (const kind of kinds) {
        const npc = kind && this.npcs[kind];
        if (!npc) continue;
        const r = npc.root.position;
        const near = kind === 'maman' ? TALK.approachMaman : kind === 'chavalanche' ? CHAVALANCHE.approach : TALK.approach;
        // No speech bubble through a wall (cat on the other side of the nave, for example).
        if (Math.hypot(p.x - r.x, p.z - r.z) < near && this._sees(kind) && this.talk(kind)) break;
      }
    }
    if (this._talking === null && this.bubble.isOpen && this.bubble.text?.speaker) this.bubble.close();
    // Conversation: the cat stays still while an NPC's bubble is open (Brain.setHold).
    // Combat: also held during the sequence (at its place during construction, then transformation), free in phase 'fight'.
    // Defeat: kitten held once up from the fatal knockback and during the veil.
    const d = this._duel, lostHold = !!this._loss || !!(d?.lost && d.c.mode !== 'knock');
    const hold = !!(this._talking && this.bubble.isOpen) || this._combatLock || lostHold;
    if (this.cat.brain.hold !== hold) this.cat.brain.setHold(hold);
  }

  /**
   * Test access: jumps to a step. 'chagicien' | 'chartiste' | 'maman': cat placed SKIP_DIST m from the NPC, on the origin
   * side. 'end': hug and end screen at once.
   */
  skipTo(step) {
    if (step === 'opening') { this.start(); return this.step; }
    if (!this.hasNpcs) return this.step;
    this.crossing.reset();
    this._resetChallenge(); // challenge bubble or defeat in progress: abandoned, no ghost state
    this._endCombat(); // any skip: arena, boss, bar, camera and shadow restored
    this._resetVictory(); // sword in its stone, Chartiste back
    this._endOpening();
    this.end.hide();
    this.bubble.close();
    this._talking = null;
    this._cam = null;
    this._pin = null; this._back = 0; this._gameOff = null;
    this._shake = null;
    this.cat.helmet?.reattach(); // helmet on the head at every skip
    this.cat.brain.setHold(false);
    this.npcs.maman.endHug(); // any hug ended (rest pose, already the summit one)
    // 'chavalanche' (Chartiste beaten, gate open, Chavalanche seated at the foot) sits between the Chartiste and Maman. 'maman':
    // Chavalanche already met, he follows the kitten (placed behind it on the first frame in zone 2).
    const order = ['chagicien', 'chartiste', 'chavalanche', 'maman'];
    const kinds = { chagicien: 'chagicien', chartiste: 'chartiste', chavalanche: 'chavalanche', maman: 'maman' };
    const i = order.indexOf(step);
    if (step === 'chavalanche' && !this.npcs.chavalanche) return this.step;
    this.met = {
      chagicien: i > 0 || step === 'end', chartiste: i > 1 || step === 'end', maman: step === 'end',
      boss: step === 'chavalanche', chavalanche: step === 'maman' || step === 'end',
    };
    if (step === 'combat') this.met.chartiste = true; // Chagicien at his post before reading the places
    this._syncProgress();
    this.chavalanche?.sync(this.met.chavalanche);
    if (step === 'wakeup') {
      this._placeCat(OPENING.drop.x, OPENING.drop.z, 0);
      this.cat.brain.setScripted('sleep');
      this.cat.brain.setScripted(null, 'sleep');
      this.cat.brain._wakeFirst('idle');
      this.minimap.setTarget(MINIMAP_GOALS[0]);
      this.minimap.setVisible(true);
      this._setStep('wakeup');
      return this.step;
    }
    // 'end': no shake, helmet dropped where the kitten is (it falls during the end screen).
    if (step === 'end') {
      const [mx, mz] = this.places.maman;
      this._placeCat(mx - SKIP_DIST, mz, Math.PI / 2); // at the summit first: the helmet falls up there
      this.cat.root.updateMatrixWorld(true);
      this._dropHelmet(); this._startHug(); this._finish();
      return this.step;
    }
    // 'combat': as after the first bubble of the Chartiste (step 'maman'), cat placed SKIP_DIST m from him, then the sequence
    // (without the challenge bubble).
    const combat = step === 'combat';
    if (combat) this.met = { chagicien: true, chartiste: true, maman: false, boss: false, chavalanche: false };
    else if (i < 0) return this.step;
    const r = this.npcs[combat ? 'chartiste' : kinds[step]].root.position;
    const d = Math.hypot(r.x, r.z) || 1;
    const x = r.x - (r.x / d) * SKIP_DIST, z = r.z - (r.z / d) * SKIP_DIST;
    this._placeCat(x, z, Math.atan2(r.x - x, r.z - z));
    this.cat.brain.setScripted('idle');
    this.cat.brain.setScripted(null, 'idle');
    if (combat) { this._goal('maman'); this._startCombat(); return this.step; }
    this._goal(step);
    return this.step;
  }

  // ------------------------------------------------------------------ opening

  // ------------------------------------------------------------------ steps

  _goal(step) {
    const goal = { chagicien: MINIMAP_GOALS[0], chartiste: MINIMAP_GOALS[1], maman: MINIMAP_GOALS[2],
      chavalanche: MINIMAP_GOALS.find((g) => g.id === 'chavalanche') }[step];
    this.minimap.setTarget(goal);
    this.minimap.setVisible(true);
    this._setStep(step);
  }

  /**
   * Gate according to progress, no animation: open if the Chartiste is beaten or Maman found, otherwise closed. The animation
   * only plays in-game (Crossing._openAtSight), after the victory. `__combat.end` does not set `met.boss`: closed.
   */
  _syncGate() {
    const r = this.world.rampart;
    if (this.met.boss || this.met.maman) r.setOpen(); else r.setClosed();
  }

  /** Gate and Chagicien according to progress: `start`, `skipTo`. */
  _syncProgress() {
    this._syncGate();
    this.wizard?.sync();
  }

  /**
   * Meadow navigation grid updated after an obstacle change: local recomputation if the cat is there, otherwise the grid is
   * dropped and rebuilt on its return (`refreshGrid` acts on the active zone's grid).
   */
  _navChanged(x, z, r) {
    const b = this.cat.brain;
    if (this.world.inMountain) b.setWorld(this.world); else b.refreshGrid(x, z, r);
  }

  /** Quit: back to the title screen; the hug is ended by start() (Npc.endHug). */
  _quit() {
    this.showTitle();
  }

  _setStep(s) {
    if (s === this.step) return;
    this.step = s;
    this.onStep?.(s);
  }

  // ------------------------------------------------------------------ combat

  _veilAlpha(a) { this.veil.style.background = a > 0 ? `rgba(${LOSS.color}, ${a.toFixed(3)})` : ''; }

  // ------------------------------------------------------------------ sword

  // ------------------------------------------------------------------ victory

  /** Combat in progress (phase 'fight') or null: `__combat.duel`, main.js (dodge). */
  get duel() { return this._duel ?? null; }

  /** Sun's shadow box: half-side `half` m, or the exploration one without an argument. */
  _setShadow(half) {
    const sc = this.world.sun.shadow.camera;
    const [l, r, t, b] = half ? [-half, half, half, -half] : this._explore.shadow;
    if (sc.left === l && sc.right === r && sc.top === t && sc.bottom === b) return;
    sc.left = l; sc.right = r; sc.top = t; sc.bottom = b;
    sc.updateProjectionMatrix();
  }

  /** Combat state (tests, `__combat.state`). */
  get combatState() {
    const c = this._combat, w = this.world, boss = this.npcs.chartiste;
    return {
      step: this.step, phase: c?.phase ?? null, t: c ? Math.round(c.t * 100) / 100 : null,
      inArena: w.inArena, arena: Math.round((w.arena?.progress ?? 0) * 100) / 100,
      boss: boss ? Math.round(boss.boss * 100) / 100 : null, bossOk: c?.bossOk ?? null,
      bar: this.bossBar?.state ?? null, catBar: this.catBar?.state ?? null, maxDistance: w.controls.maxDistance,
      level: this.level, challengeOpen: this._challengeOpen, musicSilent: this.musicSilent, loss: this._loss ? { ...this._loss } : null,
      losses: this.losses, lastLoss: this.lastLoss, cueLog: this.cueLog.map((e) => e.cue),
      shadow: w.sun.shadow.camera.right, shot: this.lastCombatShot ?? null,
      duel: this._duel?.state ?? null, lastDuel: this.lastDuel ?? null,
      sword: this.sword?.info ?? null, catSword: !!this.cat.sword, takeable: this.swordTakeable,
      pull: this._pull ? { ...this._pull, clip: Math.round((this.cat.actions.SwordPull?.time ?? 0) * 100) / 100 } : null,
      lastPull: this.lastPull, timeScale: Math.round(this.timeScale * 100) / 100,
      victory: c?.v ?? null, lastVictory: this.lastVictory ?? null, lastCue: this.lastCue,
      dissolve: this.dissolve?.state ?? null, chartisteVisible: boss ? boss.root.visible : null,
    };
  }

  /** Tests: arena placed at time `p` (0 to 1) of its construction, no sequence. */
  setArena(p) {
    const w = this.world;
    if (!w.inArena) {
      const r = this.npcs.chartiste?.root.position ?? { x: 0, z: 0 };
      w.enterArena({ x: r.x, z: r.z }, undefined, { build: false });
      w.arena.group.visible = true;
      this.minimap.refresh?.();
    }
    w.arena.building = false;
    w.arena.setProgress(p);
    return w.arena.progress;
  }

  /** Tests: boss placed at progress `k` (0 to 1), red BOSS.red; Chartiste back to the frozen pose if needed. */
  setBoss(k) {
    const boss = this.npcs.chartiste;
    if (!boss) return false;
    if (!boss._frozen && !boss._boss) boss.setPose(boss.def.pose ?? 'SitNpc', { instant: true });
    return boss.setBoss(k, { coat: BOSS.red, scale: BOSS.scale });
  }

  // ------------------------------------------------------------------ utilities

  _ground(x, z) { return this.world.terrain.heightAt(x, z); }

  _placeNpcs() {
    for (const k of ['chagicien', 'chartiste']) {
      const [x, z, yaw] = k === 'chagicien' && this.wizard ? this.wizard.place : this.places[k];
      this.npcs[k].setPosition(x, this._ground(x, z), z, yaw);
    }
  }

  /** Places the cat (root on the ground, heading) and recentres the camera on it with no glide (`snap` false: camera left alone). */
  _placeCat(x, z, yaw, snap = true) {
    const cat = this.cat;
    if (cat.carrier) cat.carry(null);
    this.world.syncZone(x); // whoever calls: the world follows the cat's position
    cat.root.position.set(x, this._ground(x, z), z);
    cat.root.rotation.y = yaw;
    cat.locomotion.heading = yaw;
    cat.brain.onWall = false;
    cat._lift = null;
    if (snap) this._snapCamera(x, z);
  }

  /** Camera target (World._target, private) and camera moved at once onto (x, z). */
  _snapCamera(x, z) {
    const w = this.world;
    const delta = _v.set(x, this._ground(x, z) + 0.22, z).sub(w.controls.target);
    w._target.add(delta);
    w.controls.target.add(delta);
    w.camera.position.add(delta);
    w.controls.update();
  }

  _inView(npc) {
    const cam = this.world.camera;
    cam.updateMatrixWorld();
    _pv.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
    _frustum.setFromProjectionMatrix(_pv);
    _sphere.center.copy(npc.root.position).y += 0.3;
    _sphere.radius = 0.7;
    return _frustum.intersectsSphere(_sphere);
  }
}

mixin(Story, dialogueScenes, openingScene, endingScene, fightDirection, swordPullScene, victoryScene);
