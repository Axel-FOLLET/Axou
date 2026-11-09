import * as THREE from 'three';
import { MINIMAP_GOALS } from '../../ui/MiniMap.js';
import { HUG, FOLLOW } from './tuning.js';
import { sightOn } from './framing.js';

/** Story methods for the ending: the helmet falls, the kitten hugs Maman, end screen and stay-or-quit choice. */

export const endingScene = {
  /**
   * End of Maman's bubble: the kitten shakes its head (scripted state 'shake', `HeadShake` clip) where it spoke, the helmet
   * comes off at HUG.shake.drop s and falls away from Maman (_dropHelmet); the hug (_startHug) comes HUG.shake.after s after
   * the end of the clip. Without a helmet on the head or without the clip: hug at once.
   */
  _hug() {
    const cat = this.cat;
    if (!cat.helmet?.onHead || !cat.actions?.HeadShake) { this._startHug(); return; }
    this.bubble.close();
    this._talking = null;
    // Conversation shot kept (no return to the game shot): the kitten stays framed.
    this._cam = null; this._back = 0; this._gameOff = null;
    cat.brain.setHold(false);
    cat.brain.setScripted('shake');
    this._shake = { t: 0, dur: cat.duration('HeadShake'), dropped: false };
  },

  /** Shake in progress (update): head sampled, helmet detached, then hug. */
  _updateShake(dt) {
    const sh = this._shake, H = HUG.shake;
    sh.t += dt;
    if (!sh.dropped) {
      this.cat.helmet?.sample(dt);
      if (sh.t >= H.drop) { sh.dropped = true; this._dropHelmet(); }
    }
    if (sh.t >= sh.dur + H.after) { this._shake = null; this._startHug(); }
  },

  /** Helmet dropped (Helmet.detach), thrown on the kitten's side away from Maman, rolling the same way. */
  _dropHelmet() {
    const cat = this.cat, helmet = cat.helmet;
    if (!helmet?.onHead) return;
    const yaw = cat.root.rotation.y, p = cat.root.position, r = this.npcs.maman?.root.position ?? p;
    let sx = Math.cos(yaw), sz = -Math.sin(yaw); // local +X flank of the kitten
    if (sx * (r.x - p.x) + sz * (r.z - p.z) > 0) { sx = -sx; sz = -sz; }
    const H = HUG.shake;
    helmet.detach({ side: { x: sx, z: sz }, toss: H.toss, spin: H.spin, ground: (x, z) => this._ground(x, z) });
    this.lastHelmetDrop = { t: this._shake?.t ?? 0, clipTime: cat.actions?.HeadShake?.time ?? null, side: [sx, sz] };
  },

  /** Starts the hug (Npc.startHug): kitten against Maman's belly, or against her flank without a clip. Called after the shake. */
  _startHug() {
    const m = this.npcs.maman, cat = this.cat;
    this.bubble.close();
    this._talking = null;
    this._back = 0; this._gameOff = null;
    cat.brain.setHold(false);
    if (m.startHug(cat)) {
      // Maman curled in an open C, chin towards the kitten (Npc.startHug); the kitten placed against her belly (hugSpot) falls
      // asleep (Sleep clip: it lies down and curls into a ball).
      const sp = m.hugSpot();
      this._placeCat(sp.x, sp.z, sp.yaw);
      cat.brain.setScripted('sleep');
      this._hugShot();
    } else {
      // Fallback without a Sleep clip on Maman: against her flank (local +X, heading yaw → (cos yaw, −sin yaw)).
      const yaw = m.root.rotation.y, r = m.root.position;
      const x = r.x + Math.cos(yaw) * HUG.side, z = r.z - Math.sin(yaw) * HUG.side;
      this._placeCat(x, z, yaw);
      cat.brain.setScripted('lie');
      this._frame('maman');
    }
    this.minimap.setVisible(false);
    this._hugT = 0;
    this._setStep('hug');
  },

  /**
   * Shot of the hug: camera on Maman's belly side, three-quarter front (HUG.angles tried in order: first shot with no scenery
   * or terrain in front of both heads), aimed at the middle of the two heads (the kitten's root stands in for its head, which
   * ends up against the chin), far enough to keep HUG.half m on each side. The camera follows this point (`_pin`) until the
   * stay or quit button. Chosen shot: `lastHugShot` (tests).
   */
  _hugShot() {
    const m = this.npcs.maman, w = this.world, cam = w.camera, H = HUG;
    m.root.updateMatrixWorld(true);
    const yaw = m.root.rotation.y, r = m.root.position, kit = this.cat.root.position;
    const head = m.rig?.head?.getWorldPosition(new THREE.Vector3()) ?? new THREE.Vector3(r.x, r.y + 0.3, r.z);
    const cx = (head.x + kit.x) / 2, cz = (head.z + kit.z) / 2;
    this._pin = new THREE.Vector3(cx, kit.y, cz);
    const tanX = Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2) * cam.aspect;
    const span = Math.hypot(head.x - kit.x, head.z - kit.z) / 2 + H.half;
    const dist = Math.max(H.dist, span / tanX), height = dist * Math.tan(H.tilt);
    // Belly towards local −X: (−cos yaw, sin yaw); front (local +Z): (sin yaw, cos yaw) (Npc.hugSpot).
    const bx = -Math.cos(yaw), bz = Math.sin(yaw), fx = Math.sin(yaw), fz = Math.cos(yaw);
    const sight = sightOn([...(w.occluders ?? [])]);
    const ty = Math.max(kit.y, this._ground(cx, cz)) + FOLLOW, kitHead = { x: kit.x, y: kit.y + 0.15, z: kit.z };
    let pick = null;
    for (const a of H.angles) {
      const dx = bx * Math.cos(a) + fx * Math.sin(a), dz = bz * Math.cos(a) + fz * Math.sin(a);
      const c = { x: cx + dx * dist, y: ty + height, z: cz + dz * dist };
      if (c.y < this._ground(c.x, c.z) + 0.15 || !sight(c, head) || !sight(c, kitHead)) continue;
      pick = { a, dx, dz, clear: true };
      break;
    }
    if (!pick) {
      const a = H.angles[0];
      pick = { a, dx: bx * Math.cos(a) + fx * Math.sin(a), dz: bz * Math.cos(a) + fz * Math.sin(a), clear: false };
    }
    this.lastHugShot = { angle: pick.a, dist, height, clear: pick.clear };
    this._shot(-pick.dx, -pick.dz, { dist, height, side: 0, rate: H.rate });
  },

  _finish() {
    this.minimap.setVisible(false);
    this.end.showEnd();
    this._setStep('end');
  },

  _stay() {
    this._cam = null;
    this._pin = null;
    this.end.hide();
    this.npcs.maman?.endHug();
    // End of the hug: the kitten wakes (Wake) instead of getting up at once.
    const b = this.cat.brain;
    if (b.state === 'sleep') { b.setScripted(null, 'sleep'); b._wakeFirst('idle'); }
    else b.setScripted(null, 'idle');
    this._syncGate();
    this.minimap.setTarget(MINIMAP_GOALS[2]);
    this.minimap.setVisible(true);
    this._setStep('free');
  },
};
