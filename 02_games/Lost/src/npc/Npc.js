import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { CatRig } from '../cat/CatRig.js';
import { Fur } from '../cat/Fur.js';
import { Eyes } from '../cat/Eyes.js';
import { loadNpcAssets, getNpcAssets } from './npcAssets.js';
import {
  NPC_KINDS, WALK_STRIDE, WALK_RATE, CAT_LENGTH, PROXY_EVERY, FUR_LOD, FUR_LOD_HYSTERESIS, GROUND_GAP, SIT_NPC, SIT,
  NOOP,
} from './npcTuning.js';
import { coatUniforms } from './npcBones.js';
import { accessoryFit } from './npcAccessoryFit.js';
import { bossForm } from './npcBossForm.js';
import { carryAndHug } from './npcCarryAndHug.js';
import { sitPose } from './npcSitPose.js';
import { mixin } from '../mixin.js';

/**
 * Non-player cats: Chagicien (wizard), Chartiste (artist, later the boss), Maman, Chavalanche (mountain guide) and
 * the snow cats. Created by main.js and world/SnowCats.js.
 *
 * - Same model as the hero: cloned GLB scene (SkeletonUtils.clone: own bones and skeletons, shared geometries),
 *   cloned materials, then fur (Fur.js) and eyes (Eyes.js). No Procedural, Locomotion or Brain: an NPC holds a pose.
 * - Held pose: a clip played once, then frozen. Once frozen there is no mixer or skinning update (Skeleton.update is
 *   neutralised): only the wind in the fur stays animated. Fur quality depends on the camera distance (FUR_LOD).
 * - Hierarchy: root (position, heading) > body (ground contact height) > model (cloned GLB, scaled). Never scale
 *   `root`: hair length is computed at build time from the world scale of the body (Fur.js); pass `opts.scale`
 *   instead.
 * - Boss (`startBoss` / `setBoss` / `endBoss`, NPC_BOSS settings): the only case where `body` is scaled, hair
 *   included. Red coat on the instance uniforms, giant brush in a front paw, capped shells.
 *
 * The class is split by theme: npcAccessoryFit.js, npcBossForm.js, npcCarryAndHug.js and npcSitPose.js add their methods
 * through the `mixin` call at the end of this file. Tuning tables are in npcTuning.js.
 */

const _v = new THREE.Vector3();
const _w = new THREE.Vector3();
const _m = new THREE.Matrix4();
const _box = new THREE.Box3();

export class Npc {
  /**
   * Loads the shared GLB (once for all) then builds the NPC.
   * @param {'chagicien'|'chartiste'|'maman'|'chavalanche'|'snowCat'} kind
   * @param {THREE.Object3D} scene parent of the NPC
   * @param {object} [opts] see the constructor
   * @returns {Promise<Npc>}
   */
  static async create(kind, scene, opts = {}) {
    await loadNpcAssets(opts.url);
    return new Npc(kind, scene, opts);
  }

  /**
   * @param {'chagicien'|'chartiste'|'maman'|'chavalanche'|'snowCat'} kind
   * @param {THREE.Object3D|null} scene parent of the NPC (null: add `npc.root` yourself)
   * @param {object} [opts]
   * @param {object} [opts.gltf] GLB to clone (default: the one from loadNpcAssets, already loaded)
   * @param {number} [opts.scale] size relative to the hero (default: the type's)
   * @param {number[]} [opts.position] [x, y, z, yaw]; y = ground height under the NPC
   * @param {string} [opts.pose] held clip (default: the type's)
   * @param {boolean} [opts.accessories] false: no accessories
   * @param {object} [opts.coat] coat (default: the type's), see setCoat
   * @param {number} [opts.furStep] keep one fur shell in `furStep` (default: the type's)
   * @param {object} [opts.beanie] beanie settings (`snowCat`), including `colors`, see beanieParts
   */
  constructor(kind, scene, opts = {}) {
    const def = NPC_KINDS[kind];
    if (!def) throw new Error(`Unknown NPC: ${kind}`);
    const gltf = opts.gltf ?? getNpcAssets();
    if (!gltf) throw new Error('NPC: call loadNpcAssets() (or Npc.create) before new Npc()');
    this.kind = kind;
    this.displayName = def.displayName;
    this.def = def;
    this.sizeScale = opts.scale ?? def.scale;

    this.root = new THREE.Group();
    this.root.name = `Npc_${kind}`;
    this.body = new THREE.Group();
    this.model = cloneSkinned(gltf.scene);
    this.root.add(this.body);
    this.body.add(this.model);
    // Own materials: Fur.js alters the body material in place.
    this._ownMaterials = [];
    this.model.traverse((o) => {
      if (o.isMesh) { o.material = o.material.clone(); this._ownMaterials.push(o.material); }
    });

    this.rig = new CatRig(this.model);
    this.meshes = this.rig.meshes;
    this.meshes.forEach((m) => { m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; });
    this._fit();

    const body = this.meshes.find((m) => m.name === 'CatBody') ?? this.meshes[0];
    const eyes = this.meshes.filter((m) => m !== body && m.isSkinnedMesh);
    this.bodyMesh = body;
    this.eyeMeshes = eyes;
    // The eyes reuse the body skeleton when identical: one skeleton to update instead of three (SkeletonUtils.clone
    // creates one per mesh).
    for (const e of eyes) if (sameSkeleton(e.skeleton, body.skeleton)) { e.skeleton.dispose(); e.bind(body.skeleton, e.bindMatrix); }
    // Both eyes of the GLB are weighted on the `Ear` (16.5 %) and `Ear_connector` (2.3 %) bones: folding the ears
    // (Chagicien) dragged the right eye toward the muzzle, which hid it from the front. NPC-owned eye geometry, with
    // the ear bone weights moved to `Head` (which already carries the eye at rest).
    this._eyeGeometries = [];
    if (def.accessories === 'wizard') for (const e of eyes) {
      const bones = e.skeleton.bones, headIdx = bones.findIndex((b) => b.name === 'Head');
      if (headIdx < 0) continue;
      const g = e.geometry.clone(), si = g.attributes.skinIndex, sw = g.attributes.skinWeight;
      for (let i = 0; i < si.count; i++) {
        let moved = 0, headK = -1;
        for (let k = 0; k < 4; k++) {
          const b = si.getComponent(i, k);
          if (b === headIdx && sw.getComponent(i, k) > 0) headK = k;
          if (/^Ear/.test(bones[b].name) && sw.getComponent(i, k) > 0) { moved += sw.getComponent(i, k); sw.setComponent(i, k, 0); }
        }
        if (!moved) continue;
        if (headK < 0) for (let k = 0; k < 4; k++) if (sw.getComponent(i, k) === 0) { headK = k; si.setComponent(i, k, headIdx); break; }
        sw.setComponent(i, headK, sw.getComponent(i, headK) + moved);
      }
      e.geometry = g;
      this._eyeGeometries.push(g);
    }
    this._ownGeometry = null;
    if (def.plump) this._plump(body, def.plump);
    this._landmarks = this._measureRest(body, eyes);

    // Fur.js recomputes the `furMask` attribute of the geometry per instance (buildMask). On the shared geometry the
    // mask is identical (computed in bind space): keep the first, the new array is never uploaded and gets collected.
    const sharedMask = this._ownGeometry ? null : body.geometry.getAttribute('furMask');
    this.fur = new Fur(body, eyes, { belly: def.belly });
    if (sharedMask) {
      this.maskReused = sameArray(sharedMask.array, body.geometry.getAttribute('furMask').array);
      if (this.maskReused) body.geometry.setAttribute('furMask', sharedMask);
    }
    if (def.furLength) this.fur.uniforms.furLength.value *= def.furLength;
    this.eyes = new Eyes(eyes);
    this.fur.shells.forEach((s) => this._ownMaterials.push(s.material));
    this.eyes.eyes.forEach((e) => this._ownMaterials.push(e.material));
    if (opts.coat ?? def.coat) this.setCoat(opts.coat ?? def.coat);
    this._beanie = opts.beanie ?? {};
    this._skeletons = [...new Set([body, ...eyes, ...this.fur.shells].map((m) => m.skeleton))];
    this._skinned = [body, ...eyes, ...this.fur.shells];

    this.mixer = new THREE.AnimationMixer(this.model);
    this.clips = {};
    for (const clip of gltf.animations) this.clips[clip.name] = clip;
    this.actions = new Map();
    this.action = null;
    this.walkSpeed = this.duration('Walk') ? WALK_STRIDE * this.model.scale.x * WALK_RATE / this.duration('Walk') : 0;

    // Attachment point in the mouth (`Mouth` bone): root frame at rest (+Z forward, +Y up), world scale 1. The kitten
    // hangs from it when Maman carries it.
    this.mouthAnchor = new THREE.Object3D();
    this.mouthAnchor.name = 'NpcMouthAnchor';
    this.mouthAnchor.position.copy(this._landmarks.mouth);
    this.root.add(this.mouthAnchor);
    this.root.updateMatrixWorld(true);
    (this.rig.mouth ?? this.rig.head).attach(this.mouthAnchor);

    this.accessories = [];
    this._brush = null;
    if (opts.accessories !== false) this._buildAccessories();

    // Invisible click box (no draw call: material with visible = false), refreshed at each frozen pose; three's
    // raycast ignores `visible`.
    this.proxy = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ visible: false }));
    this.proxy.name = 'NpcHitProxy';
    this.proxy.userData.npc = this;
    this.root.add(this.proxy);
    this.pickables = [this.proxy, ...this.accessories];
    for (const o of this.pickables) o.userData.npc = this;

    this._lift = 0;
    this._time = 0;
    this._frozen = false;
    this._lod = -1;
    this._qualityStep = opts.furStep ?? def.furStep ?? 1;
    this._fadeLeft = 0;
    this._headDip = 0;     // head lowering (0 to 1), see setHeadDip
    this._dipBase = null;  // frozen pose: quaternions of Neck, Neck.001 and Head before the lowering
    this._dipLive = null;  // played clip: same, before this frame's lowering (some clips do not drive the neck)
    this._hug = null;      // hug in progress (startHug), else null
    this._boss = null;     // boss (startBoss / setBoss): previous state and settings, else null
    this._bossAnim = null; // growth in progress: { t, duration, from, to }
    this._lodScale = 1;    // FUR_LOD thresholds × this scale (boss: body scale)

    if (scene) scene.add(this.root);
    const p = opts.position;
    if (p) { this.root.position.set(p[0] ?? 0, p[1] ?? 0, p[2] ?? 0); this.root.rotation.y = p[3] ?? 0; }
    this.setPose(opts.pose ?? def.pose, { instant: true });
  }

  /** Same scaling as Cat._fit, × sizeScale. */
  _fit() {
    const model = this.model;
    model.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const s = (CAT_LENGTH * this.sizeScale) / Math.max(size.x, size.z);
    model.scale.setScalar(s);
    model.updateMatrixWorld(true);
    box.setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    model.position.set(-center.x, -box.min.y, -center.z);
    const head = this.rig.head.getWorldPosition(new THREE.Vector3());
    const hip = this.rig.hip.getWorldPosition(new THREE.Vector3());
    const forward = head.sub(hip).setY(0);
    model.rotation.y = -Math.atan2(forward.x, forward.z);
    model.updateMatrixWorld(true);
    box.setFromObject(model);
    model.position.x -= (box.min.x + box.max.x) / 2;
    model.position.z -= (box.min.z + box.max.z) / 2;
    model.position.y -= box.min.y;
    model.updateMatrixWorld(true);
    this.height = size.y * s;
  }

  /**
   * Landmarks measured on the rest mesh (root frame, root at the origin): top of the skull, inner edge of the ears,
   * mouth, centre and radius of the eyes.
   * @returns {object} landmarks
   */
  _measureRest(body, eyes) {
    this.root.updateMatrixWorld(true);
    const geo = body.geometry;
    const n = geo.attributes.position.count;
    const si = geo.attributes.skinIndex;
    const sw = geo.attributes.skinWeight;
    const bones = body.skeleton.bones;
    const dominant = (i) => {
      let best = 0;
      let bw = -1;
      for (let k = 0; k < 4; k++) { const w = sw.getComponent(i, k); if (w > bw) { bw = w; best = si.getComponent(i, k); } }
      return bones[best]?.name ?? '';
    };
    const crown = new THREE.Vector3(0, -Infinity, 0);
    const mouth = new THREE.Vector3();
    let mouthN = 0;
    let mouthFront = -Infinity;
    let earInner = Infinity;
    let earBaseY = Infinity;
    const earPoints = [];
    for (let i = 0; i < n; i++) {
      body.getVertexPosition(i, _v).applyMatrix4(body.matrixWorld);
      const name = dominant(i);
      if (/^(Head|Ear_connector)/.test(name) && Math.abs(_v.x) < 0.012 * this.sizeScale && _v.y > crown.y) crown.copy(_v);
      if (/^Ear(?!_connector)/.test(name)) { earInner = Math.min(earInner, Math.abs(_v.x)); earBaseY = Math.min(earBaseY, _v.y); earPoints.push(_v.clone()); }
      if (name === 'Mouth') { mouth.add(_v); mouthN++; mouthFront = Math.max(mouthFront, _v.z); }
    }
    if (mouthN) {
      mouth.divideScalar(mouthN);
      mouth.z = (mouth.z + mouthFront) / 2;
    } else if (this.rig.mouth) this.rig.mouth.getWorldPosition(mouth);
    const eyeInfo = eyes.map((e) => {
      const c = new THREE.Vector3();
      const cnt = e.geometry.attributes.position.count;
      const pts = [];
      for (let i = 0; i < cnt; i++) { e.getVertexPosition(i, _v).applyMatrix4(e.matrixWorld); c.add(_v); pts.push(_v.clone()); }
      c.divideScalar(cnt);
      let r = 0;
      for (const p of pts) r = Math.max(r, p.distanceTo(c));
      const side = Math.sign(c.x) || 1;
      return { center: c, radius: r, forward: new THREE.Vector3(side * 0.22, 0.05, 1).normalize() };
    });
    // Rotation of the head at rest, in root frame: the vertical axis of the hat.
    const headQ = this.root.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(this.rig.head.getWorldQuaternion(new THREE.Quaternion()));
    return { crown, mouth, mouthVertices: mouthN, earInner, earBaseY, earPoints, eyes: eyeInfo, vertices: n, headQ };
  }

  /**
   * Rounder Maman: own copy of the body geometry, trunk vertices (`Spine*`, `Hip` bones, weighted by the skin) pushed
   * away from the back axis to the sides (`side`), downward (`belly`) and slightly upward (`back`). Rest positions,
   * root frame; normals unchanged.
   */
  _plump(body, o) {
    const geo = body.geometry.clone();
    body.geometry = geo;
    this._ownGeometry = geo;
    this.root.updateMatrixWorld(true);
    const pos = geo.attributes.position;
    const si = geo.attributes.skinIndex;
    const sw = geo.attributes.skinWeight;
    const trunk = body.skeleton.bones.map((bn) => /^(Spine|Hip)/.test(bn.name));
    const line = [this.rig.hip, ...this.rig.spine].filter(Boolean)
      .map((bn) => bn.getWorldPosition(new THREE.Vector3())).sort((p, q) => p.z - q.z);
    const cyAt = (z) => {
      if (z <= line[0].z) return line[0].y;
      for (let i = 1; i < line.length; i++) {
        if (z <= line[i].z) return THREE.MathUtils.lerp(line[i - 1].y, line[i].y, (z - line[i - 1].z) / (line[i].z - line[i - 1].z || 1));
      }
      return line[line.length - 1].y;
    };
    const inv = body.matrixWorld.clone().invert();
    let moved = 0, maxMove = 0;
    for (let i = 0; i < pos.count; i++) {
      let w = 0, total = 0;
      for (let k = 0; k < 4; k++) { const x = sw.getComponent(i, k); total += x; if (trunk[si.getComponent(i, k)]) w += x; }
      if (total <= 0 || w <= 0) continue;
      w /= total;
      _v.fromBufferAttribute(pos, i).applyMatrix4(body.matrixWorld);
      _w.copy(_v);
      const cy = cyAt(_v.z);
      _v.x *= 1 + o.side * w;
      const dy = _v.y - cy;
      _v.y = cy + dy * (1 + (dy < 0 ? o.belly : o.back) * w);
      maxMove = Math.max(maxMove, _v.distanceTo(_w));
      moved++;
      _v.applyMatrix4(inv);
      pos.setXYZ(i, _v.x, _v.y, _v.z);
    }
    pos.needsUpdate = true;
    geo.computeBoundingBox();
    geo.computeBoundingSphere();
    this.plumpInfo = { moved, vertices: pos.count, maxMove };
  }

  /** Duration (s) of a GLB clip, 0 if missing. */
  duration(name) { return this.clips[name]?.duration ?? 0; }

  /**
   * Coat (sRGB hex): `coat` base, `tip` tips, `coatLit` sun-side tint, `sheen` rim. Only affects the uniforms of this
   * Fur instance.
   * @param {object} [o] any of `coat`, `tip`, `coatLit`, `sheen`
   */
  setCoat(o = {}) {
    const u = this.fur.uniforms;
    for (const [k, c] of Object.entries(coatUniforms(o))) u[k].value.copy(c);
  }

  // ------------------------------------------------------------------------------- boss

  /** `clipTime`: time (s) of the played clip. `clipDone`: true when a non-looping clip has reached its last frame. */
  get clipTime() { return this.action?.time ?? 0; }
  get clipDone() {
    const a = this.action;
    return !!a && !this._loop && (a.paused || a.time >= this._freezeAt - 1e-4);
  }

  /**
   * Plays a clip. Without `loop`: played once then frozen at `freezeAt` (default: last frame).
   * @param {string} name GLB clip (`Sit`, `Lie`, `Walk`…)
   * @param {object} [o] `loop` (cycle, never frozen), `freezeAt` (s), `fade` (s), `instant` (pose reached at once,
   *   no fade), `timeScale`
   * @returns {boolean} false if the clip is missing (warning, pose unchanged)
   */
  setPose(name, o = {}) {
    const clip = this.clips[name];
    if (!clip) { console.warn(`NPC ${this.kind}: clip missing from the GLB: ${name}`); return false; }
    const { loop = false, fade = 0.3, instant = false, timeScale = 1 } = o;
    this._unfreeze();
    this._undip();
    this._loop = loop;
    this._freezeAt = THREE.MathUtils.clamp(o.freezeAt ?? clip.duration, 0, clip.duration);
    this.pose = name;
    let next = this.actions.get(name);
    if (!next) { next = this.mixer.clipAction(clip); this.actions.set(name, next); }
    const prev = this.action;
    if (instant || !prev) this.mixer.stopAllAction();
    else if (prev !== next) prev.fadeOut(fade); // a paused action (frozen pose) still fades out
    next.reset();
    next.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1);
    next.clampWhenFinished = !loop;
    next.setEffectiveTimeScale(timeScale);
    next.setEffectiveWeight(1);
    next.play();
    this.action = next;
    if (instant || !prev || prev === next) {
      this._fadeLeft = 0;
      if (instant && !loop) next.time = this._freezeAt;
      this.mixer.update(0);
      if (instant && !loop) this._freeze();
      else this._contact(0, true);
    } else {
      next.fadeIn(fade);
      this._fadeLeft = fade;
    }
    return true;
  }

  /**
   * Frozen pose `name` reached by a bone fade over `fade` s, from the played pose. A clip fade is not enough: the sit
   * re-aligns the skeleton once frozen (`_sitCat`), and the head of the Chagicien would jump 18 cm between two
   * frames.
   */
  settleInto(name, fade) {
    const bones = this.bodyMesh.skeleton.bones;
    const read = () => bones.map((b) => [b.position.clone(), b.quaternion.clone()]);
    const from = read();
    this.setPose(name, { instant: true });
    this._settling = { t: 0, fade, bones, from, to: read() };
    this._settleStep(0);
  }

  _settleStep(dt) {
    const s = this._settling;
    s.t += dt;
    const k = THREE.MathUtils.smoothstep(s.t, 0, s.fade);
    s.bones.forEach((b, i) => {
      b.position.lerpVectors(s.from[i][0], s.to[i][0], k);
      b.quaternion.slerpQuaternions(s.from[i][1], s.to[i][1], k);
    });
    this.refresh();
    if (k >= 1) this._settling = null;
  }

  /**
   * Places the NPC: (x, y, z) = ground point under it, yaw = heading (rad, 0 = muzzle toward +Z). A frozen pose is
   * recomputed at once (bone matrices are in world space).
   */
  setPosition(x, y, z, yaw = this.root.rotation.y) {
    this.root.position.set(x, y, z);
    this.root.rotation.y = yaw;
    if (this._frozen) this.refresh();
  }

  /** Recomputes the skinning of a frozen pose (call if a parent of `root` moved). */
  refresh() {
    this.root.updateMatrixWorld(true);
    for (const sk of this._skeletons) THREE.Skeleton.prototype.update.call(sk);
  }

  /**
   * @param {number} dt seconds
   * @param {THREE.Camera} [camera] for distance-based fur quality
   */
  update(dt, camera) {
    this._time += dt;
    this.fur.update(this._time);
    if (this._bossAnim) {
      const a = this._bossAnim;
      // 1e-6: the sum of the dts (150 × 1/60) stays just under 2.5 in floating point.
      a.t = Math.min(a.duration, a.t + dt);
      if (a.duration - a.t < 1e-6) a.t = a.duration;
      this._applyBoss(THREE.MathUtils.lerp(a.from, a.to, a.t / a.duration));
      if (a.t >= a.duration) this._bossAnim = null;
    }
    if (camera) this._updateLod(camera);
    if (this._frozen) {
      if (this._hug) this._hugPose();
      else if (this._settling) this._settleStep(dt);
      return;
    }
    this._undip();
    this.mixer.update(dt);
    if (this._hatPose) this._holdHatPose();
    if (this._headDip) this._dip();
    this._fadeLeft = Math.max(0, this._fadeLeft - dt);
    const a = this.action;
    // Boss (bossPlay): a finished clip stays on its last frame (clampWhenFinished), with no frozen pose.
    if (!this._boss && !this._loop && this._fadeLeft === 0 && (a.time >= this._freezeAt - 1e-4 || a.paused)) this._freeze();
    else this._contact(dt, false);
    if (this._boss) {
      if (this._bossDrop) this._updateDrop(dt);
      if ((this._proxyLeft = (this._proxyLeft ?? 0) - dt) <= 0) { this._proxyLeft = PROXY_EVERY; this._updateProxy(); }
    }
  }

  /** Fur shells: quality setting (1 = all, Infinity = none), combined with FUR_LOD. */
  setFurStep(step) {
    this._qualityStep = Math.max(1, step);
    this._applyFurStep();
  }

  /** Draw calls of the main pass (visible meshes with a visible material), shadows excluded. */
  get drawCalls() {
    let n = 0;
    const walk = (o) => {
      if (!o.visible) return;
      if (o.isMesh && o.material?.visible !== false) n++;
      o.children.forEach(walk);
    };
    walk(this.root);
    return n;
  }

  setVisible(v) { this.root.visible = v; }

  /**
   * Click: three intersection (`point`, `distance`, `object`) with the click box or an accessory, or null. Tested
   * objects: `pickables` (non-recursive).
   */
  hit(raycaster) {
    if (!this.root.visible) return null;
    return raycaster.intersectObjects(this.pickables, false)[0] ?? null;
  }

  dispose() {
    this.root.removeFromParent();
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.model);
    this._unfreeze();
    for (const sk of this._skeletons) sk.dispose();
    for (const m of this._ownMaterials) m.dispose();
    for (const a of this.accessories) {
      a.geometry.dispose();
      if (a.userData.ownMaterial) { a.material.map?.dispose(); a.material.dispose(); }
    }
    this._ownGeometry?.dispose();
    this._eyeGeometries.forEach((g) => g.dispose());
    this.proxy.geometry.dispose();
    this.proxy.material.dispose();
    this.accessories = [];
    this.pickables = [];
  }

  // ------------------------------------------------------------------------------- internal

  /** Bones lowered by setHeadDip: Neck, Neck.001, Head. */
  _dipBones() { return [this.rig.neck[0], this.rig.neck[1], this.rig.head].filter(Boolean); }

  _updateLod(camera) {
    _w.setFromMatrixPosition(camera.matrixWorld);
    this.root.getWorldPosition(_v);
    // Boss: thresholds (and hysteresis) multiplied by the body scale (distance brought back to that of an NPC).
    const d = _v.distanceTo(_w) / this._lodScale;
    let i = this._lod;
    if (i < 0) {
      i = FUR_LOD.findIndex((l) => d <= l.upTo);
    } else {
      while (i < FUR_LOD.length - 1 && d > FUR_LOD[i].upTo + FUR_LOD_HYSTERESIS) i++;
      while (i > 0 && d < FUR_LOD[i - 1].upTo - FUR_LOD_HYSTERESIS) i--;
    }
    if (i !== this._lod) { this._lod = i; this._applyFurStep(); }
  }

  _applyFurStep() {
    const step = Math.max(this._qualityStep, this._lod >= 0 ? FUR_LOD[this._lod].step : 1);
    if (this._boss) {
      // Boss: `keep` shells evenly spread, the outermost included (same choice as a whole step when 18 / keep is
      // whole: 9 → one in 2, 6 → one in 3), at most `shells` (NPC_BOSS.shells).
      const n = this.fur.shells.length;
      const keep = Math.min(this._boss.shells, Math.floor(n / step));
      this.fur.shells.forEach((s, i) => { s.visible = Math.floor((i + 1) * keep / n) > Math.floor(i * keep / n); });
      return;
    }
    this.fur.shells.forEach((s, i) => { s.visible = (i + 1) % step === 0; });
  }

  /** Lowest point of the deformed mesh (world space), one vertex in `stride`. */
  _lowestY(stride) {
    const m = this.bodyMesh;
    const n = m.geometry.attributes.position.count;
    let minY = Infinity;
    for (let i = 0; i < n; i += stride) {
      m.getVertexPosition(i, _v).applyMatrix4(m.matrixWorld);
      if (_v.y < minY) minY = _v.y;
    }
    return minY;
  }

  /** Ground contact during a played clip: the lowest point brought to the root (same logic as Cat.js). */
  _contact(dt, snap) {
    this.root.updateMatrixWorld(true);
    const groundY = this.root.getWorldPosition(_w).y;
    const target = this._lift - (this._lowestY(snap ? 1 : 7) - groundY) + GROUND_GAP;
    if (snap) this._lift = target;
    else this._lift += (target - this._lift) * (1 - Math.exp(-(target > this._lift ? 30 : this._loop ? 2 : 10) * dt));
    this.body.position.y = this._lift;
    this.root.updateMatrixWorld(true);
  }

  _freeze() {
    this._undip();
    const a = this.action;
    for (const other of this.actions.values()) if (other !== a) other.stop();
    a.time = this._freezeAt;
    a.paused = true;
    a.setEffectiveWeight(1);
    this.mixer.update(0);
    const sitPose = !!this.def.sit && this.pose === this.def.pose;
    if (sitPose) this._sitCat(this.pose === 'SitNpc' ? SIT_NPC : SIT);
    this._dipBase = this._dipBones().map((b) => b.quaternion.clone());
    this._dip();
    this._contact(0, true);
    this.refresh();
    if (this._spots) this._paintSpots(sitPose);
    if (this._scarfMesh) this._refitScarf();
    if (this._hatMesh) { this._fitHat(); this._keepHatPose(); }
    this._updateProxy();
    this._updateBounds(true);
    for (const sk of this._skeletons) sk.update = NOOP;
    this._frozen = true;
  }

  _unfreeze() {
    if (!this._frozen) return;
    this._settling = null;
    if (this._hug) { this._hug = null; this.eyes.setLid(0); }
    if (this._dipBase) { this._dipBones().forEach((b, i) => b.quaternion.copy(this._dipBase[i])); this._dipBase = null; }
    // Bones changed by _sitCat (including `Root`, which clips do not necessarily drive): back to the clip pose before
    // playing a clip again.
    if (this._boneBackup) {
      for (const [b, p, q, sc] of this._boneBackup) { b.position.copy(p); b.quaternion.copy(q); b.scale.copy(sc); }
      this._boneBackup = null;
    }
    for (const sk of this._skeletons) delete sk.update;
    this._updateBounds(false);
    this._frozen = false;
  }

  /**
   * Frozen pose: bounding spheres computed once (the renderer can then cull off-screen NPCs); while a clip plays, no
   * culling (changing pose).
   */
  _updateBounds(frozen) {
    if (!frozen) { this._skinned.forEach((m) => { m.frustumCulled = false; }); return; }
    const body = this.bodyMesh;
    body.computeBoundingSphere();
    // Margin: hairs (at most about 3.5 cm, Fur.js) in local mesh units.
    body.boundingSphere.radius += 0.05 / body.getWorldScale(_w).x;
    for (const s of this.fur.shells) s.boundingSphere = body.boundingSphere;
    for (const e of this.eyeMeshes) e.computeBoundingSphere();
    this._skinned.forEach((m) => { m.frustumCulled = true; });
  }

  /** Click box = box of the deformed mesh in root frame, hair included. */
  _updateProxy() {
    const m = this.bodyMesh;
    const n = m.geometry.attributes.position.count;
    _m.copy(this.root.matrixWorld).invert();
    _box.makeEmpty();
    for (let i = 0; i < n; i += 3) _box.expandByPoint(m.getVertexPosition(i, _v).applyMatrix4(m.matrixWorld).applyMatrix4(_m));
    _box.expandByScalar(0.02 * this.sizeScale);
    _box.getCenter(this.proxy.position);
    _box.getSize(this.proxy.scale);
    this.proxy.updateMatrixWorld(true);
  }

}

/** True if two number arrays are identical. */
function sameArray(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/** Same bones and same inverse matrices: the meshes can share a skeleton. */
function sameSkeleton(a, b) {
  if (a === b) return true;
  if (a.bones.length !== b.bones.length) return false;
  for (let i = 0; i < a.bones.length; i++) {
    if (a.bones[i] !== b.bones[i] || !a.boneInverses[i].equals(b.boneInverses[i])) return false;
  }
  return true;
}

mixin(Npc, accessoryFit, bossForm, carryAndHug, sitPose);
