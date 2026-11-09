import * as THREE from 'three';
import { buildBrush } from './Accessories.js';
import { pawHolder } from '../cat/CatRig.js';
import {
  NPC_BOSS, BOSS_TIP_HSL, BOSS_LIT_HSL, BOSS_SHEEN_HSL, BRUSH_LAYER_ROOTS, COAT_KEYS, GROUND_GAP,
} from './npcTuning.js';
import { coatUniforms } from './npcBones.js';

/** Npc methods for the boss form of the Chartiste: growth, giant brush, clips and return to the normal cat. */

/**
 * Full coat (sRGB hex, `setCoat` format) derived from a base `coat`: tips, sun-side tint and rim keep the offsets of
 * the ginger coat (BOSS_*_HSL).
 * @param {number} [coat] base colour (sRGB hex)
 * @returns {{coat: number, tip: number, coatLit: number, sheen: number}}
 */
function bossCoat(coat = NPC_BOSS.coat) {
  const c = {};
  new THREE.Color(coat).getHSL(c, THREE.SRGBColorSpace);
  const hex = (dh, s, l) => new THREE.Color().setHSL((((c.h + dh / 360) % 1) + 1) % 1,
    THREE.MathUtils.clamp(s, 0, 1), THREE.MathUtils.clamp(l, 0, 1), THREE.SRGBColorSpace).getHex();
  return {
    coat,
    tip: hex(BOSS_TIP_HSL[0], c.s + BOSS_TIP_HSL[1], c.l + BOSS_TIP_HSL[2]),
    coatLit: hex(BOSS_LIT_HSL[0], c.s + BOSS_LIT_HSL[1], c.l + BOSS_LIT_HSL[2]),
    sheen: hex(BOSS_SHEEN_HSL[0], BOSS_SHEEN_HSL[1], BOSS_SHEEN_HSL[2]),
  };
}

/** S curve (smootherstep) from 0 to 1. */
function smoother(t) {
  t = THREE.MathUtils.clamp(t, 0, 1);
  return t * t * t * (t * (t * 6 - 15) + 10);
}

/**
 * Brush-hold layer: values of the `BrushHold` clip tracks (at time `t`) for the BRUSH_LAYER_ROOTS bones and their
 * descendants. Shoulder and controllers are children of the `Root` bone, which none of BrushHold, SitNpc, Idle and
 * Walk rotates: laid over one of these clips, these local values give the BrushHold paw relative to the body.
 * @returns {Array<[THREE.Bone, THREE.Vector3, THREE.Quaternion, THREE.Vector3]>|null} null without a clip
 */
function brushHoldLayer(model, clip, t = 0) {
  if (!clip) return null;
  const bones = new Map();
  for (const name of BRUSH_LAYER_ROOTS) {
    model.getObjectByName(name)?.traverse((o) => { if (o.isBone) bones.set(o.name, o); });
  }
  const vals = new Map();
  for (const track of clip.tracks) {
    const { nodeName, propertyName } = THREE.PropertyBinding.parseTrackName(track.name);
    const bone = bones.get(nodeName);
    if (!bone || !['position', 'quaternion', 'scale'].includes(propertyName)) continue;
    const v = track.createInterpolant().evaluate(THREE.MathUtils.clamp(t, 0, clip.duration));
    if (!vals.has(bone)) vals.set(bone, [bone.position.clone(), bone.quaternion.clone(), bone.scale.clone()]);
    const e = vals.get(bone);
    if (propertyName === 'quaternion') e[1].fromArray(v).normalize();
    else e[propertyName === 'position' ? 0 : 2].fromArray(v);
  }
  return vals.size ? [...vals].map(([b, [p, q, s]]) => [b, p, q, s]) : null;
}

/**
 * Sets a bone layer (brushHoldLayer) at fraction `k`: each bone goes from `base` (list of the same shape, e.g. the
 * saved frozen pose), or without `base` from its current value (just after `mixer.update` of a played clip: Idle,
 * Walk), to the layer. Values are replaced, not blended by the mixer (two actions of weight 1 on a bone give 50/50 in
 * three.js). The caller recomputes matrices and skinning (`refresh()` on a frozen pose).
 */
function applyBoneLayer(layer, k, base = null) {
  k = THREE.MathUtils.clamp(k, 0, 1);
  layer.forEach(([bone, p, q, s], i) => {
    const b0 = base?.[i];
    const p0 = b0 ? b0[1] : bone.position, q0 = b0 ? b0[2] : bone.quaternion, s0 = b0 ? b0[3] : bone.scale;
    bone.position.lerpVectors(p0, p, k);
    bone.quaternion.slerpQuaternions(q0, q, k);
    bone.scale.lerpVectors(s0, s, k);
  });
}

export const bossForm = {
  /**
   * Chartiste as boss: growth from the normal state (0) to the boss (1) over `duration` s, driven by `update(dt)`.
   * Nothing changes until a boss method is called. Expected pose: frozen sitting (`SitNpc`); do not call `setPose`
   * between `startBoss` and `endBoss` (the sit and scarf are recomputed at NPC size).
   * Example: `boss.startBoss({ duration: 2.5, coat: BOSS.red })`; poll `boss.boss` until 1; finish with
   * `boss.endBoss()`.
   * @param {object} [o] `duration` (s), `coat` (hex), `scale` (× hero), `shells` (max shells)
   * @returns {boolean} false if this NPC has no frozen pose (growth impossible)
   */
  startBoss(o = {}) {
    if (!this._bossBegin(o)) return false;
    this._bossAnim = { t: 0, duration: Math.max(1e-3, o.duration ?? NPC_BOSS.duration), from: this._boss.progress, to: 1 };
    return true;
  },

  /**
   * Sets an intermediate boss state directly (tests, captures), with no growth: 0 = previous size and coat (easel
   * included), 1 = full boss. Stops any growth in progress.
   * @param {number} k progress from 0 to 1 (the S curve is applied afterwards)
   * @param {object} [o] same settings as startBoss
   * @returns {boolean} false if this NPC has no frozen pose
   */
  setBoss(k, o = {}) {
    if (!this._bossBegin(o)) return false;
    this._bossAnim = null;
    this._applyBoss(Number(k) || 0);
    return true;
  },

  /**
   * Victory (Story._victory): the defeated boss turns ginger and small again over `duration` s while keeping the
   * played clip (final pose of `Defeat`): pre-combat size and coat, without restoring the brush hold, the mouth brush
   * or the easel (`keep`). The giant brush stays on the ground and shrinks with the body. Then call `endBoss`
   * (Story).
   * @param {number} [duration] seconds
   * @returns {boolean} false outside the boss
   */
  shrinkBoss(duration = 2) {
    const b = this._boss;
    if (!b) return false;
    b.keep = true;
    // Giant brush on the ground: shrinks with the body and disappears with the boss size.
    b.shrinkBrush = b.bigBrush ? { scale: b.bigBrush.scale.clone(), from: b.progress || 1 } : null;
    this._bossAnim = { t: 0, duration: Math.max(1e-3, duration), from: b.progress, to: 0 };
    return true;
  },

  /** Boss progress (0 to 1, before the S curve); 0 outside the boss. */
  get boss() { return this._boss?.progress ?? 0; },

  /** True while the boss is growing. */
  get bossGrowing() { return !!this._bossAnim; },

  /**
   * End of the boss: restores the exact state before `startBoss` (scale, body height, coat, mouth brush, easel, click
   * box, pickables, shells); the giant brush is removed and disposed.
   */
  endBoss() {
    const b = this._boss;
    if (!b) return;
    // Clip played during combat (`bossPlay`): frozen pose restored after returning to the previous size.
    const live = !this._frozen;
    this._bossAnim = null;
    this._bossDrop = null;
    this.body.scale.copy(b.bodyScale);
    this.body.position.y = b.bodyY;
    this._lift = b.lift;
    const u = this.fur.uniforms;
    for (const k of COAT_KEYS) u[k].value.copy(b.from[k]);
    if (this._brush) { this._brush.scale.copy(b.mouthBrushScale); this._brush.visible = b.mouthBrushVisible; }
    for (const [o, vis] of b.hidden) o.visible = vis;
    if (b.hold) applyBoneLayer(b.hold, 0, b.holdBase);
    const big = b.bigBrush;
    if (big) {
      big.removeFromParent();
      big.geometry.dispose();
      this.accessories = this.accessories.filter((a) => a !== big);
    }
    this.proxy.position.copy(b.proxyPos);
    this.proxy.scale.copy(b.proxyScale);
    this.pickables = b.pickables;
    this._lodScale = 1;
    this._lod = b.lod;
    this._boss = null;
    this._applyFurStep();
    this.proxy.updateMatrixWorld(true);
    this.refresh();
    // Sit, spots, scarf and click box recomputed at the previous size (`_freeze`).
    if (live) this.setPose(this.def.pose ?? 'SitNpc', { instant: true });
  },

  /**
   * Clip played by the boss during combat: `BrushHold` (guard, looping), `BrushSwing`, `Flinch`, `Defeat`. The boss
   * stays whole (`_boss` intact): body size, coat, giant brush attached to the paw bone (it follows the clip), easel
   * hidden. Ground contact by `_contact` each frame; click box refreshed on the current pose (`_updateProxy`, every
   * `PROXY_EVERY` s). A non-looping clip stays on its last frame (no frozen pose during the boss: `_freeze` would
   * redo spots and scarf in the boss pickables). `Defeat`: brush dropped at NPC_BOSS.drop.at s. `endBoss` restores
   * the frozen pose.
   * @param {string} name GLB clip
   * @param {object} [o] `loop`, `fade` (s), `timeScale`, `instant` (looping clip only: no fade, from the start of
   *   the clip; leaves the frozen pose without going through the sit), `ground` (`Defeat`: visible ground height at
   *   (x, z), to lay the brush on it, `_updateDrop`)
   * @returns {boolean} false outside the boss, during growth, or if the clip is missing
   */
  bossPlay(name, o = {}) {
    if (!this._boss || this._bossAnim) return false;
    const ok = this.setPose(name, { loop: !!o.loop, fade: o.fade ?? 0.2, timeScale: o.timeScale ?? 1, instant: !!o.instant && !!o.loop });
    if (!ok) return false;
    this._bossDrop = name === 'Defeat' && this._boss.bigBrush ? { t: -1, ground: o.ground ?? null } : null;
    this._proxyLeft = 0;
    return true;
  },

  /**
   * Defeat: at NPC_BOSS.drop.at s into the clip the giant brush leaves the paw (reattached to the root, position
   * kept), then falls over NPC_BOSS.drop.time s (ease e²) until lying on the ground.
   */
  _updateDrop(dt) {
    const d = this._bossDrop, b = this._boss, brush = b?.bigBrush, D = NPC_BOSS.drop;
    if (!d || !brush) return;
    if (d.t < 0) {
      if (this.pose !== 'Defeat' || this.action.time < D.at) return;
      this.root.updateMatrixWorld(true);
      this.root.attach(brush);
      const g = brush.geometry;
      if (!g.boundingBox) g.computeBoundingBox();
      const bb = g.boundingBox;
      const r = Math.max(Math.abs(bb.min.x), bb.max.x, Math.abs(bb.min.z), bb.max.z) * brush.scale.x;
      // Handle axis (+Y local) brought to horizontal, pointing away from the boss.
      const axis = new THREE.Vector3(0, 1, 0).applyQuaternion(brush.quaternion);
      const out = new THREE.Vector3(brush.position.x, 0, brush.position.z);
      if (out.lengthSq() < 1e-6) out.set(-1, 0, 0);
      out.normalize();
      const flat = new THREE.Vector3(axis.x, 0, axis.z);
      if (flat.lengthSq() < 1e-4 || flat.dot(out) < 0) flat.copy(out);
      flat.normalize();
      const dist = Math.max(Math.hypot(brush.position.x, brush.position.z), D.out);
      d.from = { p: brush.position.clone(), q: brush.quaternion.clone() };
      d.to = { p: new THREE.Vector3(out.x * dist, r, out.z * dist), q: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), flat) };
      if (d.ground) this._fitDrop(d, flat, r, bb.max.y * brush.scale.y);
      d.t = 0;
    }
    if (d.t >= D.time) return;
    d.t = Math.min(D.time, d.t + dt);
    const e = (d.t / D.time) ** 2;
    brush.position.lerpVectors(d.from.p, d.to.p, e);
    brush.quaternion.slerpQuaternions(d.from.q, d.to.q, e);
    brush.updateMatrixWorld(true);
  },

  /**
   * Lays the brush on the real ground (`ground`) rather than on the root plane: the relief drops around the boss.
   * Base and end of the axis are each set `r` (widest radius) above the ground beneath them; the handle follows the
   * slope between.
   */
  _fitDrop(d, flat, r, len) {
    const root = this.root, k = root.getWorldScale(new THREE.Vector3()).x;
    const a = d.to.p.clone(), b = a.clone().addScaledVector(flat, len);
    root.localToWorld(a); root.localToWorld(b);
    a.y = d.ground(a.x, a.z) + r * k; b.y = d.ground(b.x, b.z) + r * k;
    root.worldToLocal(a); root.worldToLocal(b);
    d.to.p.copy(a);
    d.to.q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.sub(a).normalize());
  },

  /** Entering the boss: previous state saved once, settings (re)read. */
  _bossBegin(o) {
    if (!this._boss) {
      if (!this._frozen) { console.warn(`NPC ${this.kind}: boss requested outside a frozen pose`); return false; }
      const u = this.fur.uniforms;
      const hidden = [this._easel?.mesh, ...this.accessories.filter((a) => a.name === 'NpcPainting')].filter(Boolean).map((m) => [m, m.visible]);
      this._boss = {
        progress: 0,
        bodyScale: this.body.scale.clone(), bodyY: this.body.position.y, lift: this._lift,
        from: Object.fromEntries(COAT_KEYS.map((k) => [k, u[k].value.clone()])),
        to: null, scale: NPC_BOSS.scale, shells: NPC_BOSS.shells,
        mouthBrushScale: this._brush?.scale.clone(), mouthBrushVisible: this._brush?.visible,
        hidden,
        proxyPos: this.proxy.position.clone(), proxyScale: this.proxy.scale.clone(),
        pickables: this.pickables, lod: this._lod,
        bigBrush: null, bigBrushScale: null,
      };
      // Giant brush: built at NPC size, on the frozen pose (body still at scale 1).
      if (this.def.accessories === 'artist') {
        // Hold: BrushHold paw layer over the frozen pose kept as is (`holdBase`).
        this._boss.hold = brushHoldLayer(this.model, this.clips.BrushHold);
        this._boss.holdBase = this._boss.hold?.map(([bn]) => [bn, bn.position.clone(), bn.quaternion.clone(), bn.scale.clone()]) ?? null;
        this._buildBossBrush();
      }
      const b = this._boss;
      // During the boss, easel, canvas and mouth brush are no longer clickable (three's raycast ignores `visible`);
      // the giant brush is.
      const off = new Set([...hidden.map(([m]) => m), this._brush]);
      this.pickables = [...b.pickables.filter((m) => !off.has(m)), ...(b.bigBrush ? [b.bigBrush] : [])];
    }
    const b = this._boss;
    if (o.coat !== undefined || !b.to) b.to = coatUniforms(bossCoat(o.coat ?? NPC_BOSS.coat));
    if (o.scale !== undefined) b.scale = Math.max(1e-3, o.scale);
    if (o.shells !== undefined) b.shells = THREE.MathUtils.clamp(Math.round(o.shells), 0, this.fur.shells.length);
    return true;
  },

  /**
   * Giant brush in paw NPC_BOSS.brushPaw: `buildBrush` (0.138 m) shifted so that the end of the handle is at the
   * origin, placed in the BrushHold pose (grip `brushGrip`, handle `brushDir`), then attached to the bone holding the
   * paw (`pawHolder`, like the paint spots): it follows the paw. Hidden until NPC_BOSS.brushIn.
   */
  _buildBossBrush() {
    const leg = this.rig.legs[NPC_BOSS.brushPaw];
    if (!leg?.calf) return;
    const holder = pawHolder(leg);
    this.root.updateMatrixWorld(true);
    const toRoot = new THREE.Matrix4().copy(this.root.matrixWorld).invert();
    const rp = (o) => o.getWorldPosition(new THREE.Vector3()).applyMatrix4(toRoot);
    const chain = [leg.thigh, leg.calf, leg.foot, leg.paw].filter(Boolean).map(rp);
    let legLength = 0;
    for (let i = 1; i < chain.length; i++) legLength += chain[i].distanceTo(chain[i - 1]);
    const brush = buildBrush();
    brush.name = 'NpcBossBrush';
    const g = brush.geometry;
    g.computeBoundingBox();
    g.translate(0, -g.boundingBox.min.y, 0);
    this._bossBrushShape(g);
    g.computeBoundingBox();
    const length = g.boundingBox.max.y - g.boundingBox.min.y;
    g.computeBoundingSphere();
    const side = NPC_BOSS.brushPaw[1] === 'L' ? -1 : 1; // brushDir is given for the right paw (−X)
    const [dx, dy, dz] = NPC_BOSS.brushDir;
    // BrushHold pose (layer at 1) while placing the brush, then the frozen pose is restored.
    const hold = this._boss.hold;
    if (hold) { applyBoneLayer(hold, 1); this.root.updateMatrixWorld(true); }
    // brushDir is given in the `CatArmature` node frame (parent of the `Root` bone); without that node, root frame
    // (rotation of the model by _fit included in both cases).
    const frame = this.model.getObjectByName('CatArmature') ?? this.model;
    const toRootQ = this.root.getWorldQuaternion(new THREE.Quaternion()).invert();
    const dir = new THREE.Vector3(dx * side, dy, dz).normalize()
      .applyQuaternion(frame.getWorldQuaternion(new THREE.Quaternion())).applyQuaternion(toRootQ).normalize();
    const grip = holder.localToWorld(new THREE.Vector3(...NPC_BOSS.brushGrip)).applyMatrix4(toRoot);
    const scale = NPC_BOSS.brushLength * legLength / length;
    brush.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    brush.position.copy(grip).addScaledVector(dir, -NPC_BOSS.brushBack * length * scale);
    brush.scale.setScalar(scale);
    brush.castShadow = true;
    brush.visible = false;
    brush.userData.npc = this;
    this.root.add(brush);
    this.root.updateMatrixWorld(true);
    holder.attach(brush);
    if (hold) { applyBoneLayer(hold, 0, this._boss.holdBase); this.root.updateMatrixWorld(true); }
    this.accessories.push(brush);
    this._boss.bigBrush = brush;
    this._boss.bigBrushScale = brush.scale.clone();
    this._boss.brushInfo = { legLength, length, scale, dir: dir.toArray(), grip: grip.toArray(), hold: !!hold };
  },

  /**
   * Shape of the giant brush (`buildBrush` geometry, end of the handle at y = 0): handle and ferrule widened by
   * NPC_BOSS.brushGirth, tuft widened and lengthened by NPC_BOSS.brushTuft and repainted in NPC_BOSS.brushTuftColor.
   * Parts are recognised by their vertex colour (Accessories.js: one colour per part).
   */
  _bossBrushShape(g) {
    const pos = g.attributes.position, col = g.attributes.color;
    if (!col) return;
    const n = pos.count;
    let top = 0, low = 0;
    for (let i = 1; i < n; i++) {
      if (pos.getY(i) > pos.getY(top)) top = i;
      if (pos.getY(i) < pos.getY(low)) low = i;
    }
    const same = (i, j) => col.getX(i) === col.getX(j) && col.getY(i) === col.getY(j) && col.getZ(i) === col.getZ(j);
    const kind = new Uint8Array(n); // 0 handle, 1 ferrule, 2 tuft
    let tipY = Infinity;
    for (let i = 0; i < n; i++) {
      kind[i] = same(i, top) ? 2 : same(i, low) ? 0 : 1;
      if (kind[i] === 2) tipY = Math.min(tipY, pos.getY(i));
    }
    const G = NPC_BOSS.brushGirth, [tr, tl] = NPC_BOSS.brushTuft;
    const tuft = new THREE.Color(NPC_BOSS.brushTuftColor);
    let ferruleTop = 0;
    for (let i = 0; i < n; i++) if (kind[i] === 1) ferruleTop = Math.max(ferruleTop, pos.getY(i));
    for (let i = 0; i < n; i++) {
      const k = kind[i] === 2 ? tr : kind[i] === 1 ? G * 1.15 : G;
      let y = pos.getY(i);
      // Tuft lengthened from its base, set on top of the ferrule.
      if (kind[i] === 2) { y = ferruleTop + (y - tipY) * tl; col.setXYZ(i, tuft.r, tuft.g, tuft.b); }
      pos.setXYZ(i, pos.getX(i) * k, y, pos.getZ(i) * k);
    }
    pos.needsUpdate = true;
    col.needsUpdate = true; // normals kept: uniform radial widening (toon shading)
  },

  /** Sets the boss state at progress `p` (0 to 1). */
  _applyBoss(p) {
    const b = this._boss;
    b.progress = THREE.MathUtils.clamp(p, 0, 1);
    const e = smoother(b.progress);
    const k = THREE.MathUtils.lerp(b.bodyScale.x, b.scale / this.sizeScale, e);
    this.body.scale.setScalar(k);
    // Frozen pose: the lowest body point is GROUND_GAP below the body origin × scale; the body height keeps it
    // GROUND_GAP above the ground (nothing floats or sinks). Played clip: `_contact` handles it each frame.
    if (this._frozen) {
      this._lift = GROUND_GAP + k * (b.lift - GROUND_GAP);
      this.body.position.y = this._lift;
    }
    // Click box (root frame): same scaling, centred on the body origin.
    const y0 = b.bodyY;
    this.proxy.position.set(b.proxyPos.x * k, this.body.position.y + (b.proxyPos.y - y0) * k, b.proxyPos.z * k);
    this.proxy.scale.copy(b.proxyScale).multiplyScalar(k);
    // Coat: from the previous one to red (linear space).
    const u = this.fur.uniforms;
    for (const key of COAT_KEYS) u[key].value.copy(b.from[key]).lerp(b.to[key], e);
    // Brushes: the mouth brush shrinks away, the giant one grows in the paw.
    const ramp = ([a, c]) => THREE.MathUtils.clamp((e - a) / (c - a), 0, 1);
    // Victory shrink (shrinkBoss): Defeat clip kept, brushes and easel left as they are.
    if (b.keep) {
      const sb = b.shrinkBrush;
      if (sb && b.bigBrush) {
        const f = THREE.MathUtils.clamp(e / smoother(sb.from), 0, 1);
        b.bigBrush.scale.copy(sb.scale).multiplyScalar(Math.max(f, 1e-4));
        b.bigBrush.visible = f > 0.02;
      }
      this._lodScale = k;
      this._applyFurStep();
      this.proxy.updateMatrixWorld(true);
      this.root.updateMatrixWorld(true);
      return;
    }
    if (this._brush) {
      const out = 1 - smoother(ramp(NPC_BOSS.brushOut));
      this._brush.scale.copy(b.mouthBrushScale).multiplyScalar(Math.max(out, 1e-4));
      this._brush.visible = b.mouthBrushVisible && out > 0;
    }
    // Paw: from the frozen pose to the BrushHold hold (the giant brush, attached to the foot, follows).
    if (b.hold) applyBoneLayer(b.hold, smoother(ramp(NPC_BOSS.brushRaise)), b.holdBase);
    if (b.bigBrush) {
      const grow = smoother(ramp(NPC_BOSS.brushIn));
      b.bigBrush.scale.copy(b.bigBrushScale).multiplyScalar(Math.max(grow, 1e-4));
      b.bigBrush.visible = grow > 0;
    }
    // Easel, canvas and palette (one mesh with the easel): hidden as soon as the boss grows (at scale 5 the body
    // would cover the easel planted at 0.53 m).
    for (const [o, vis] of b.hidden) o.visible = vis && e === 0;
    this._lodScale = k;
    this._applyFurStep();
    this.proxy.updateMatrixWorld(true);
    if (this._frozen) this.refresh();
    else this.root.updateMatrixWorld(true);
  },
};
