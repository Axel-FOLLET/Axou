import * as THREE from 'three';
import { TEXTS } from '../texts.js';
import { seesNpc, talkShot, SIGHT } from '../talkShot.js';
import { meow } from '../../audio/Meow.js';
import { LEVELS } from '../combat.js';
import { TALK, TALK_UI, VOICE, SHOT, EMPTY, HEM } from './tuning.js';
import { sightOn } from './framing.js';

/** Story methods for the speech bubbles: choosing what an NPC says, framing the two cats, closing the talk. */

const _v = new THREE.Vector3();

const _off = new THREE.Vector3();

const _sphA = new THREE.Spherical();

const _sphB = new THREE.Spherical();

const _tgt = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()]; // talkTargets

export const dialogueScenes = {
  /**
   * Click on an NPC: speech bubble if the cat is close enough, otherwise it walks to 1.2 m of the NPC (the bubble then opens
   * on approach, for the NPC of the step).
   */
  pickNpc(kind) {
    const npc = this.npcs[kind];
    // In phase 'fight', a click or touch on the boss is a claw (Duel.attack).
    if (kind === 'chartiste' && this._duel && this._combat?.phase === 'fight') { this._duel.attack(); return; }
    // Conversation, shake or combat in progress: nothing.
    if (!npc || this._open || this._shake || this._combat || this._loss || this.bubble.isOpen) return;
    const p = this.cat.root.position, r = npc.root.position;
    const d = Math.hypot(p.x - r.x, p.z - r.z);
    if (d < TALK.leave - 0.5 && this._sees(kind)) { this.talk(kind); return; }
    const k = (d - 1.2) / d, brain = this.cat.brain, before = brain.target;
    brain.walkTo(new THREE.Vector3(p.x + (r.x - p.x) * k, 0, p.z + (r.z - p.z) * k));
    // Trip to this NPC remembered (Brain's goal), so yarn launchers do not divert it (main.js, canTrigger).
    this._trip = brain.target && brain.target !== before ? brain.target : null;
  },

  /**
   * True while the cat walks to a clicked NPC: Brain's goal is still the one set by `pickNpc` (another click, arrival or a
   * game replaces or clears it).
   */
  get npcTrip() {
    if (this._trip && this.cat.brain.target !== this._trip) this._trip = null;
    return !!this._trip;
  },

  /**
   * Opens an NPC's speech bubble according to the step (close click, approach or test call). `variant`: 'rematch'
   * (Chartiste only) reopens the challenge on the level choice, after a defeat (`_lose`).
   */
  talk(kind, variant = null) {
    const npc = this.npcs[kind];
    if (!npc || this._open || this._shake || this._combat || (this._loss && variant !== 'rematch') || this.crossing.fading || ['hug', 'end', 'title', 'combat'].includes(this.step)) return false;
    const T = TEXTS;
    let text, onDone = null, challenge = false;
    if (kind === 'chagicien') {
      if (this.step === 'chagicien') { text = T.chagicien; onDone = () => { this.met.chagicien = true; this._goal('chartiste'); }; }
      else if (this.met.maman) text = T.chagicienEnd; // no more sending to the forest after the ending
      else if (this.met.boss) text = T.chagicienAfter;
      // Left the ruins (Wizard): he sends back to the Chartiste, on the way or from the bridge.
      else if (this.wizard?.state === 'walk') text = T.chagicienRoute;
      else if (this.wizard?.state === 'post') text = T.chagicienBridge;
      else text = this.met.chagicien ? T.chagicienAgain : T.chagicien;
    } else if (kind === 'chartiste') {
      if (this.step === 'chartiste') {
        text = T.chartiste; onDone = () => { this.met.chartiste = true; this._goal('maman'); };
        this.wizard?.depart(); // on opening the bubble, not on closing it; once only
      }
      else if (this.met.maman) text = T.chartisteEnd; // no more sending to the mountain after the ending
      // Beaten (provisional end): he no longer restarts the challenge.
      else if (this.met.boss) text = T.chartisteAgain;
      // Second visit before Maman: challenge then combat on closing the bubble (read to the end; closed by moving away: no
      // combat). The last page carries the level choice (Bubble `choices`); the clicked button sets `this.level` then starts the
      // combat (`_chooseLevel`). `variant` 'rematch': after a defeat.
      else if (this.met.chartiste) { text = variant === 'rematch' ? T.chartisteRematch : T.chartisteChallenge; challenge = true; onDone = (key) => this._chooseLevel(key); }
      else text = T.chartiste;
    } else if (kind === 'chavalanche') {
      // First bubble: he gets up and follows, the goal moves to Maman. Later, a click on him: before any fall, a reminder; after
      // the first fall (CLIMB.help.falls), the help request (he takes the snowballs up to the summit). `variant` 'offer': the
      // bubble he opens by himself after the first fall.
      const c = this.chavalanche;
      if (!c) return false;
      if (!this.met.chavalanche) {
        text = T.chavalanche;
        onDone = () => { this.met.chavalanche = true; c.startFollow(); if (this.step === 'chavalanche') this._goal('maman'); };
      } else if (this.met.maman) text = T.chavalancheEnd;
      else if (variant === 'offer') text = T.chavalancheOffer;
      else if (c.atSummit) text = T.chavalancheSummit;
      else if (c.protecting) text = T.chavalancheGuard;
      else if (c.canHelp) { text = T.chavalancheHelp; c.protect(true); }
      else text = T.chavalancheWaiting;
    } else {
      if (this.step === 'maman' || this.step === 'chavalanche') { text = T.maman; onDone = () => { this.met.maman = true; this._hug(); }; }
      else if (this.met.maman) text = T.mamanAgain;
      else return false; // Maman only speaks once the other two have been found
    }
    // Game shot kept for the return (not during a return: the one from before the first bubble).
    if (!this._talking && !this._back) this._gameOff = this.world.camera.position.clone().sub(this.world.controls.target);
    this._back = 0;
    this._talking = npc;
    this._halt(); // shot computed where the cat stays
    this.cat.brain.setHold(true); // conversation: the cat no longer moves
    this._meowN = 0;
    // Bubble opened before the shot: `_avoidBubble` reads its place (heads above it).
    this.bubble.open(text, {
      onDone: (key) => { this._challengeOpen = false; this._endTalk(); onDone?.(key); }, // choice made: no silence left to lift
      onPage: (i, count) => this._meowPage(kind, i, count),
    });
    this._frame(kind);
    // Challenge: the meadow music stops when the bubble opens, it is read in silence.
    if (challenge) { this._challengeOpen = true; this._cue('challenge-open'); }
    return true;
  },

  /**
   * Level button of the challenge bubble (Bubble `onDone(key)`): the level is set, then the boss music starts and the combat
   * begins (`_startCombat`). An unknown key keeps the previous level.
   */
  _chooseLevel(key) {
    if (LEVELS[key]) this.level = key;
    this._startCombat();
  },

  /**
   * True while the music must stay silent: challenge bubble open (read in silence) or defeat in progress (until the bubble
   * reopens). audio/soundtrack.js reads it on each cue or step.
   */
  get musicSilent() { return this._challengeOpen || !!this._loss; },

  /**
   * Challenge or defeat abandoned (`start`, `skipTo`): state cleared, veil restored, music restored (cue 'challenge-cancel'). No
   * effect if nothing was in progress.
   */
  _resetChallenge() {
    const was = this._challengeOpen || !!this._loss;
    this._challengeOpen = false;
    if (this._loss) { this._loss = null; this.veil.style.background = ''; this.veil.className = 'lost-veil'; }
    if (was) this._cue('challenge-cancel');
  },

  /**
   * End of a speech bubble (read to the end, or closed as the cat moves away): the cat regains control, the camera glides
   * towards the game shot kept at the opening (`_gameOff`), then the player takes it back (`_back`, update).
   */
  _endTalk() {
    this._talking = null;
    // Challenge bubble closed without a choice (cat moved away): the music is restored (a choice lifts `_challengeOpen` first).
    if (this._challengeOpen) { this._challengeOpen = false; this._cue('challenge-cancel'); }
    this.cat.brain.setHold(false);
    const g = this._gameOff, h = g ? Math.hypot(g.x, g.z) : 0;
    if (h < 1e-3) { this._cam = null; this._gameOff = null; return; }
    this._shot(-g.x, -g.z, { dist: h, height: g.y, side: 0, rate: TALK_UI.rate });
    this._back = TALK_UI.back;
  },

  /**
   * Meows of a conversation, when page `i` of `count` shows: the NPC meows on each page; from the second on, the kitten meows
   * first and the NPC replies. One-page bubble (Maman): the NPC meows, then the kitten replies, so that each meows in turn.
   * Voices of Meow.js (`chagicien`, `chartiste`, `maman`, `kitten`); log: `meowLog` (debug handle `__meowLog`).
   */
  _meowPage(kind, i, count = 2) {
    const n = ++this._meowN;
    const voice = VOICE[kind] ?? kind;
    if (i === 0) {
      const d = meow(voice, { variant: n });
      if (count === 1) meow('kitten', { delay: d + TALK_UI.gap, variant: n });
      return;
    }
    const d = meow('kitten', { variant: n });
    meow(voice, { delay: d + TALK_UI.gap, variant: n });
  },

  /** Scenery data shared by talkShot and seesNpc (footprint of NPC `kind` excluded). */
  _scene(kind) {
    const w = this.world, p = this.cat.root.position, r = this.npcs[kind].root.position;
    return {
      cat: { x: p.x, y: p.y, z: p.z }, npc: { x: r.x, y: r.y, z: r.z }, skip: `npc_${kind}_`,
      obstacles: w.navZone.obstacles, trees: w.zoneTrees, heightAt: (x, z) => w.terrain.heightAt(x, z),
      flowers: w.inMountain ? [] : (w.meadow?.flowerList ?? []), // talkShot only
    };
  },

  /**
   * Stops a cat walking to a point: the bubble often opens while walking (approach at TALK.approach m, trip continuing beyond),
   * and the shot of the opening no longer holds the NPC once the cat has arrived. During a jump (window, low wall), the stop
   * is deferred to the landing (`_haltPending`, update). Cat on a low wall (`onWall`, which setScripted would reset) or
   * without a goal: nothing.
   */
  _halt() {
    const b = this.cat.brain;
    this._haltPending = false;
    if (b.scripted || !b.target) return;
    if (b.jumping) { this._haltPending = true; return; }
    if (b.onWall) return;
    b.setScripted('idle');
    b.setScripted(null, 'idle');
  },

  /** True if no wall or terrain separates the cat from NPC `kind` (talkShot.js, seesNpc). */
  _sees(kind) {
    return seesNpc(this._scene(kind));
  },

  /**
   * Shot for a speech bubble: camera behind the cat, gaze towards the NPC slightly turned, so the talking NPC stays in view
   * beyond the cat. talkShot.js tries other angles, heights and distances when a wall, trunk or crown cuts the camera-to-cat
   * or camera-to-NPC view; the chosen shot is kept in `lastShot` (tests).
   */
  _frame(kind) {
    const cam = this.world.camera;
    const npc = this.npcs[kind];
    const head = npc.rig?.head?.getWorldPosition(new THREE.Vector3()) ?? null;
    const top = this._top(npc, head);
    const catHead = this.cat.rig?.head?.getWorldPosition(new THREE.Vector3()) ?? null;
    const sight = sightOn([...(this.world.occluders ?? [])]); // real scenery
    const res = talkShot({ ...this._scene(kind), fov: cam.fov, aspect: cam.aspect, shot: SHOT.talk, head, top, avoid: this._avoid(), sight,
      facing: npc.root.rotation.y, // face seen first
      catHead, avoidHead: this._avoidBubble() }); // both heads above the bubble
    this.lastShot = res;
    this._talkKind = kind;
    this._framedAt = { x: this.cat.root.position.x, z: this.cat.root.position.z }; // see REFRAME
    this._shot(res.lx, res.lz, { ...SHOT.talk, dist: res.dist, height: res.height });
  },

  /**
   * Real top of an NPC, for talkShot's frame: highest point (top of the posed body, ears included, and of the accessories
   * worn on the head, vertically above the head), then the extreme vertices of the head accessories in x and z (edge of the
   * hat or beret, read from their vertices). Empty list without a head bone.
   * Then the extreme vertices of the bottom of the posed body (dress, feet), in 8 directions; without them, shots treated as
   * framed cut the NPC's lower part by 14 to 45 px at 1280 × 720.
   */
  _top(npc, head) {
    if (!head) return EMPTY;
    npc.root.updateMatrixWorld(true);
    let y = head.y;
    const body = npc.bodyMesh, feet = [];
    if (body?.isSkinnedMesh) {
      body.computeBoundingBox(); // current pose (bones applied), mesh frame
      const bb = new THREE.Box3().copy(body.boundingBox).applyMatrix4(body.matrixWorld);
      y = Math.max(y, bb.max.y);
      // Bottom: extreme vertices in 8 directions among those within HEM m of the bottom of the box.
      const hem = [], pos = body.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const p = body.getVertexPosition(i, _v).applyMatrix4(body.matrixWorld);
        if (p.y > bb.min.y + HEM) continue;
        [-p.x, p.x, -p.z, p.z, p.x + p.z, -p.x - p.z, p.x - p.z, p.z - p.x].forEach((k, j) => { if (!hem[j] || k > hem[j].k) hem[j] = { k, x: p.x, y: p.y, z: p.z }; });
      }
      hem.forEach(({ x, y: hy, z }) => feet.push({ x, y: hy, z }));
    }
    const ext = [null, null, null, null]; // −x, +x, −z, +z
    for (const a of npc.accessories ?? []) {
      if (a.parent !== npc.rig.head) continue;
      a.traverse((m) => {
        const pos = m.isMesh && m.geometry.attributes.position;
        if (!pos) return;
        for (let i = 0; i < pos.count; i++) {
          const p = _v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld);
          y = Math.max(y, p.y);
          [-p.x, p.x, -p.z, p.z].forEach((k, j) => { if (!ext[j] || k > ext[j].k) ext[j] = { k, x: p.x, y: p.y, z: p.z }; });
        }
      });
    }
    return [{ x: head.x, y, z: head.z }, ...ext.filter(Boolean).map(({ x, y: py, z }) => ({ x, y: py, z })), ...feet];
  },

  /**
   * Points to clear of scenery during a bubble: body and head of the talking NPC, for Occlusion (main.js). Empty list
   * outside a bubble.
   */
  get talkTargets() {
    const npc = this._talking;
    if (!npc?.root) return EMPTY;
    const r = npc.root.position;
    _tgt[0].set(r.x, r.y + SIGHT.npc[0], r.z);
    _tgt[1].set(r.x, r.y + SIGHT.npc[1], r.z);
    if (npc.rig?.head) npc.rig.head.getWorldPosition(_tgt[2]); else _tgt[2].copy(_tgt[1]);
    return _tgt;
  },

  /**
   * Screen zones to leave free: the displayed minimap, enlarged by 8 px, in normalised canvas coordinates (x right, y up,
   * −1 to 1).
   */
  _avoid() {
    const el = this.minimap?.el;
    if (!el || !this.minimap.visible) return [];
    const c = this.world.renderer.domElement.getBoundingClientRect(), m = el.getBoundingClientRect();
    if (!c.width || !c.height || !m.width) return [];
    const pad = 8, nx = (px) => ((px - c.left) / c.width) * 2 - 1, ny = (py) => 1 - ((py - c.top) / c.height) * 2;
    return [{ x0: nx(m.left - pad), x1: nx(m.right + pad), y0: ny(m.bottom + pad), y1: ny(m.top - pad) }];
  },

  /**
   * Zone of the open bubble, avoided by heads (talkShot, `avoidHead`): the full width, from the bottom of the screen up to
   * TALK_UI.pad px above the bubble. Final place of the bubble: `offsetTop` ignores the rise of its appearance (transform).
   * Empty list without a bubble.
   */
  _avoidBubble() {
    const el = this.bubble.el;
    if (!this.bubble.isOpen || !el?.offsetHeight) return [];
    const c = this.world.renderer.domElement.getBoundingClientRect();
    if (!c.height) return [];
    const top = el.offsetTop - TALK_UI.pad;
    return [{ x0: -2, x1: 2, y0: -2, y1: 1 - ((top - c.top) / c.height) * 2 }];
  },

  /** Starts a shot: horizontal gaze (lx, lz), settings `o` (see SHOT); `instant`: no glide. */
  _shot(lx, lz, o, instant = false) {
    const d = Math.hypot(lx, lz) || 1;
    this._cam = { lx: lx / d, lz: lz / d, ...o };
    if (instant) this._applyShot(0, true);
  },

  /** Moves the camera towards the shot (spherical coordinates around the target, so no shortcut through it). */
  _applyShot(dt, instant) {
    const c = this._cam, w = this.world, t = w.controls.target, cam = w.camera;
    // Right of the gaze (lx, lz): (−lz, lx).
    _off.set(-c.lx * c.dist - c.lz * c.side, c.height, -c.lz * c.dist + c.lx * c.side);
    _sphB.setFromVector3(_off);
    if (instant) { cam.position.copy(t).add(_off); return; }
    _sphA.setFromVector3(_off.copy(cam.position).sub(t));
    const k = 1 - Math.exp(-c.rate * dt);
    let dth = _sphB.theta - _sphA.theta;
    dth = Math.atan2(Math.sin(dth), Math.cos(dth));
    _sphA.theta += dth * k;
    _sphA.phi += (_sphB.phi - _sphA.phi) * k;
    _sphA.radius += (_sphB.radius - _sphA.radius) * k;
    cam.position.copy(t).add(_off.setFromSpherical(_sphA));
  },
};
