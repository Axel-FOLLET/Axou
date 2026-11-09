import * as THREE from 'three';
import {
  buildWand, buildBeret, buildEaselGroup, buildPainting, buildBrush, buildGuideGear, buildBeanie, GLASSES,
  glassesRing, buildWizard, buildScarf,
} from './Accessories.js';
import {
  HAT_SINK, HAT_EAR_FOLD, NPC_SCALE, HAT_BRIM, GLASSES_GUARD, HAT_GUARD, SCARF_UPRIGHT, SCARF_RAISE, SCARF_FUR,
  SCARF_TOP, SCARF_SAG, SCARF_KNOT, SCARF_TAILS,
} from './npcTuning.js';
import { setWorldQuaternion } from './npcBones.js';

/** Npc methods that build the accessories and fit them on the measured coat: hats, glasses, scarf, palette. */

const _q = new THREE.Quaternion();

export const accessoryFit = {
  _buildAccessories() {
    const L = this._landmarks;
    const head = this.rig.head;
    this.root.updateMatrixWorld(true);
    // The hat sits in the skull fur (about 2.6 cm of hair, Fur.js HEAD_SKULL): slightly above the top vertex.
    const s = this.sizeScale;
    const crown = L.crown.clone().add(new THREE.Vector3(0, 0.012 * s, -0.006 * s));
    const add = (mesh, parent) => { this.root.add(mesh); this.root.updateMatrixWorld(true); parent.attach(mesh); this.accessories.push(mesh); return mesh; };
    const mouthBone = this.rig.mouth ?? head;
    if (this.def.accessories === 'wizard') {
      // Hat with a very wide stiff brim (HAT_BRIM, about 3 × the cone). Its bottom (tube) rests on the skull, sunk in
      // the fur. The ears fold under the brim (HAT_EAR_FOLD, `_foldEars`) and the brim comes down just above the hair
      // tips of the skull and folded ears; the glasses rings pass in front of the face hair (`_hatFit`).
      const hatPos = new THREE.Vector3(0, L.crown.y + HAT_SINK * s, L.crown.z);
      // Glasses temples: backward to the side of the head under the ears (end in the fur), 6 cm × s behind the eyes.
      const eyeY = L.eyes.length ? L.eyes.reduce((a, e) => a + e.center.y, 0) / L.eyes.length : L.crown.y;
      const eyeZ = L.eyes.length ? L.eyes.reduce((a, e) => a + e.center.z, 0) / L.eyes.length : L.crown.z;
      const ears = { x: L.earInner + 0.02 * s, y: eyeY + 0.012 * s, z: eyeZ - 0.06 * s };
      this._hatArgs = { crown: hatPos, eyes: L.eyes, ears, scale: s };
      // First fit at rest, ears folded during the calculation; the frozen pose redoes it (`_fitHat`), because the
      // sitting clip (`SitNpc`) also moves skull bones (`Ear_connector`) and the face.
      const earBones = [this.rig.earL?.[0], this.rig.earR?.[0]].filter(Boolean);
      const saved = earBones.map((e) => e.quaternion.clone());
      this._foldEars(...HAT_EAR_FOLD);
      this.root.updateMatrixWorld(true);
      const fit = this._hatFit(new THREE.Matrix4().copy(this.root.matrixWorld).invert());
      earBones.forEach((e, i) => e.quaternion.copy(saved[i]));
      this.root.updateMatrixWorld(true);
      this._hatMesh = add(this._wizardMesh(fit), head);
      // Wand across the mouth, attached to the `Mouth` bone.
      add(buildWand({ center: L.mouth.clone().add(new THREE.Vector3(0, 0, -0.012 * s)), scale: s }), mouthBone);
    } else if (this.def.accessories === 'artist') {
      add(buildBeret({ crown, scale: s }), head);
      const scarf = this._scarf();
      if (scarf) this._scarfMesh = add(scarf, this.rig.neck[1] ?? this.rig.neck[0] ?? head);
      // Easel beside the cat on its right (−X), canvas facing forward like it (a player arriving from the front sees
      // the picture); palette on the ground in front of the canvas.
      const pos = new THREE.Vector3(-0.42 * s, 0, 0.1 * s);
      const m = new THREE.Matrix4().compose(pos, new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI, 0)), new THREE.Vector3(s, s, s));
      const easel = buildEaselGroup(m, new THREE.Vector3(-0.12, 0, -0.28));
      this._easel = easel;
      add(easel.mesh, this.root);
      add(buildPainting(easel), this.root);
      // Brush across the mouth (`Mouth` bone), bristles toward the cat's right (easel side).
      const brush = buildBrush();
      brush.position.copy(L.mouth).add(new THREE.Vector3(0.03 * s, 0, -0.012 * s));
      brush.rotation.set(0, 0, Math.PI / 2); // +Y (bristles) → −X
      brush.scale.setScalar(2.2 * s); // about 0.3 m, like the Chagicien's wand
      this._brush = add(brush, mouthBone);
      this._spots = []; // paint spots on the front paws, redone at each frozen sitting pose
    } else if (this.def.accessories === 'chavalanche') {
      // Helmet and mask on the head, pack and poles on the back (Spine.004), loops around the front thighs.
      // Axis of each ear: base to tip (Ear, Ear.002 bones), root frame at rest.
      const toRoot = new THREE.Matrix4().copy(this.root.matrixWorld).invert();
      const ear = (bones) => {
        const base = bones[0].getWorldPosition(new THREE.Vector3()).applyMatrix4(toRoot);
        const tip = bones[2].getWorldPosition(new THREE.Vector3()).applyMatrix4(toRoot);
        return { base, dir: tip.sub(base).normalize() };
      };
      const gear = buildGuideGear({ ears: [ear(this.rig.earL), ear(this.rig.earR)], scale: s / NPC_SCALE });
      add(gear.helmet, head);
      add(gear.mask, head);
      add(gear.pack, this.rig.spine[4]);
      add(gear.legL, this.rig.legs.FL.thigh);
      add(gear.legR, this.rig.legs.FR.thigh);
    } else if (this.def.accessories === 'snowCat') {
      add(buildBeanie({ crown, beanie: this._beanie, scale: s }), head);
    }
  },

  /**
   * Fits hat and glasses on the hair tips (tip = vertex + normal × hair length, as in Fur.js), in the hat frame (axis
   * = +Y).
   * @param {THREE.Matrix4} inv world to root-at-rest matrix
   * @returns {{lift: number, push: number[][]}} `lift`: tube height under the brim (model frame, ÷ s), so that the
   *   underside of the brim passes HAT_GUARD × s above the highest hair tip of the ears and skull under the brim
   *   ring. `push`: per eye, GLASSES.bins sectors (angle around the ring axis, 0 = +X side, π/2 = top) giving the
   *   wire offset in front of the eye plane, so that it passes GLASSES_GUARD × s in front of the hair tips (ears
   *   excluded) under the wire seen from the front, and at least GLASSES.ahead × s in front of the eyeball
   */
  _hatFit(inv) {
    const s = this.sizeScale;
    const { crown, eyes } = this._hatArgs;
    const body = this.bodyMesh;
    const g = body.geometry, si = g.attributes.skinIndex, sw = g.attributes.skinWeight, bones = body.skeleton.bones;
    const pos = g.attributes.position, nor = g.attributes.normal, mask = g.attributes.furMask;
    const len = this.fur.uniforms.furLength.value;
    const coneR = 0.056 * 1.04 * s; // radius of the top of the tube, under the brim (wizardHatParts)
    const brimR = HAT_BRIM * s;
    const tube = GLASSES.tube * s;
    const B = GLASSES.bins;
    const rings = eyes.map((e) => { const r = { e, ...glassesRing(e, s) }; r.need = new Array(B).fill(r.base); return r; });
    const near = Math.max(0, ...rings.map((r) => r.R)) * 3;
    const v = new THREE.Vector3(), sv = new THREE.Vector3(), nv = new THREE.Vector3(), d = new THREE.Vector3();
    let top = -Infinity;
    for (let i = 0; i < si.count; i++) {
      let b = 0, w = -1;
      for (let k = 0; k < 4; k++) if (sw.getComponent(i, k) > w) { w = sw.getComponent(i, k); b = si.getComponent(i, k); }
      const nm = bones[b].name;
      const ear = /^Ear(?!_connector)/.test(nm);
      const skull = /^(Head|Ear_connector|Neck002)/.test(nm);
      sv.fromBufferAttribute(pos, i);
      body.applyBoneTransform(i, sv);
      sv.applyMatrix4(body.matrixWorld).applyMatrix4(inv);
      // Outside the skull, only the face (near the eyes) matters.
      if (!ear && !skull && !rings.some((r) => r.e.center.distanceTo(sv) < near)) continue;
      v.fromBufferAttribute(pos, i).addScaledVector(nv.fromBufferAttribute(nor, i), len * (mask ? mask.getX(i) : 1));
      body.applyBoneTransform(i, v);
      v.applyMatrix4(body.matrixWorld).applyMatrix4(inv);
      const r = Math.hypot(v.x - crown.x, v.z - crown.z);
      if (ear || (skull && r > coneR && r < brimR)) top = Math.max(top, v.y);
      if (ear) continue;
      // Lower-inner quarter of the ring (nose side): it rests in the muzzle fur, like glasses on a nose, and only
      // passes in front of the skin. Elsewhere: in front of the hairs.
      for (const ring of rings) {
        for (const [p, onNose] of [[v, false], [sv, true]]) {
          const a = d.copy(p).sub(ring.c).dot(ring.forward);
          if (a <= 0) continue;
          d.addScaledVector(ring.forward, -a);
          const x = d.dot(ring.U), y = d.dot(ring.V);
          const nose = y < 0 && x * ring.side < 0;
          if (nose !== onNose || Math.abs(Math.hypot(x, y) - ring.R) >= tube + GLASSES_GUARD * s) continue;
          const k = Math.round(((Math.atan2(y, x) / (Math.PI * 2)) % 1 + 1) % 1 * B) % B;
          ring.need[k] = Math.max(ring.need[k], a + tube + GLASSES_GUARD * s);
        }
      }
    }
    // Smoothed sectors: maximum over ±2 neighbours (the wire has thickness), then mean over ±1.
    const wrap = (k) => (k + B) % B;
    const push = rings.map((r) => {
      const m = r.need.map((_, k) => Math.max(...[-2, -1, 0, 1, 2].map((j) => r.need[wrap(k + j)])));
      return m.map((_, k) => (m[wrap(k - 1)] + m[k] + m[wrap(k + 1)]) / 3);
    });
    // The underside of the brim hem is 0.0015 × √(radius / 0.1) below `lift` (wizardHatParts).
    const hem = 0.0015 * Math.sqrt(Math.max(1, HAT_BRIM / 0.1));
    return { lift: Math.max(0, (top + HAT_GUARD * s - crown.y) / s + hem), push };
  },

  /** Hat and glasses of the Chagicien (one mesh) for fit `fit`; updates `hatInfo`. */
  _wizardMesh(fit) {
    const { crown, eyes, scale: s } = this._hatArgs;
    this._hatFitNow = fit;
    this.hatInfo = { baseY: crown.y, brimY: crown.y + fit.lift * s, brimRadius: HAT_BRIM * s, lift: fit.lift * s, center: crown.toArray() };
    return buildWizard({ ...this._hatArgs, eyes: eyes.map((e, i) => ({ ...e, push: fit.push[i] })), hat: { brim: HAT_BRIM, lift: fit.lift } });
  },

  /** Hat and glasses refitted on the hair of the frozen pose (same mesh, rebuilt geometry). */
  _fitHat() {
    const hat = this._hatMesh;
    this.root.updateMatrixWorld(true);
    const fit = this._hatFit(hat.matrixWorld.clone().invert());
    const now = this._hatFitNow;
    const same = (a, b) => a.every((p, k) => Math.abs(p - b[k]) < 1e-4);
    if (Math.abs(fit.lift - now.lift) < 1e-4 && fit.push.every((p, i) => same(p, now.push[i]))) return;
    const old = hat.geometry;
    hat.geometry = this._wizardMesh(fit).geometry;
    old.dispose();
  },

  /**
   * Scarf of the Chartiste, on the frozen pose (root frame): a cloth band following the neck, tight above the
   * shoulders, with a knot in front and short tails (`buildScarf`). The coat radius is measured by slice (along the
   * band axis) and by angular sector around the axis, on hair tips (vertex + normal × hair length × SCARF_FUR, as in
   * Fur.js): the band sits on the fur, slightly compressed.
   * @returns {THREE.Mesh|null} null if the neck cannot be measured
   */
  _scarf() {
    const body = this.bodyMesh;
    const s = this.sizeScale;
    const geo = body.geometry;
    const si = geo.attributes.skinIndex;
    const sw = geo.attributes.skinWeight;
    const pos = geo.attributes.position, nor = geo.attributes.normal, mask = geo.attributes.furMask;
    const bones = body.skeleton.bones;
    const neck = this.rig.neck.filter(Boolean);
    if (neck.length < 2) return null;
    this.root.updateMatrixWorld(true);
    const toRoot = new THREE.Matrix4().copy(this.root.matrixWorld).invert();
    const a = neck[0].getWorldPosition(new THREE.Vector3()).applyMatrix4(toRoot);
    const b = neck[neck.length - 1].getWorldPosition(new THREE.Vector3()).applyMatrix4(toRoot);
    // Neck axis straightened toward vertical (SCARF_UPRIGHT) and centre raised between Neck.001 and Neck.002
    // (SCARF_RAISE): the slice no longer cuts the chest and the band stays above the shoulders.
    const axis = b.clone().sub(a).normalize().lerp(new THREE.Vector3(0, 1, 0), SCARF_UPRIGHT).normalize();
    // Centre: middle of the box of the ±1.5 cm (× size) slice around the Neck.001 bone, from vertices of the Neck and
    // Neck.001 bones (not the longer-haired Neck.002 ruff).
    const names = new Set(neck.map((o) => o.name));
    const mid = neck[1].getWorldPosition(new THREE.Vector3()).lerp(neck[2]?.getWorldPosition(new THREE.Vector3()) ?? neck[1].getWorldPosition(new THREE.Vector3()), SCARF_RAISE).applyMatrix4(toRoot);
    const side = new THREE.Vector3(1, 0, 0).projectOnPlane(axis).normalize();
    const v = new THREE.Vector3().crossVectors(axis, side).normalize();
    const len = this.fur.uniforms.furLength.value * SCARF_FUR;
    const tips = [];
    const ext = { u0: Infinity, u1: -Infinity, v0: Infinity, v1: -Infinity, n: 0 };
    const p = new THREE.Vector3(), nv = new THREE.Vector3();
    for (let i = 0; i < si.count; i++) {
      let best = 0, bw = -1;
      for (let k = 0; k < 4; k++) { const w = sw.getComponent(i, k); if (w > bw) { bw = w; best = si.getComponent(i, k); } }
      const nm = bones[best]?.name ?? '';
      // Head, mouth and ears excluded: the top of the band does not flare under the chin.
      if (/^(Head|Mouth|Ear|Jaw|Tongue|Eye)/.test(nm)) continue;
      body.getVertexPosition(i, p).applyMatrix4(body.matrixWorld).applyMatrix4(toRoot);
      const d = p.clone().sub(mid);
      const h = d.dot(axis);
      if (Math.abs(h) > SCARF_TOP * (2 + SCARF_SAG) * s || d.length() > 0.25 * s) continue;
      if (names.has(nm) && Math.abs(h) < 0.015 * s) {
        const du = d.dot(side), dv = d.dot(v);
        ext.u0 = Math.min(ext.u0, du); ext.u1 = Math.max(ext.u1, du);
        ext.v0 = Math.min(ext.v0, dv); ext.v1 = Math.max(ext.v1, dv); ext.n++;
      }
      const t = p.fromBufferAttribute(pos, i).addScaledVector(nv.fromBufferAttribute(nor, i), len * (mask ? mask.getX(i) : 1));
      body.applyBoneTransform(i, t);
      tips.push(t.applyMatrix4(body.matrixWorld).applyMatrix4(toRoot).clone());
    }
    if (ext.n < 8) { console.warn(`NPC ${this.kind}: neck not measured (slice of ${ext.n} vertices), no scarf`); return null; }
    const center = mid.clone().addScaledVector(side, (ext.u0 + ext.u1) / 2).addScaledVector(v, (ext.v0 + ext.v1) / 2);
    // Grid: 1 cm × s slices along the axis (from +SCARF_TOP to −SCARF_TOP × (1 + SCARF_SAG)), 24 sectors; radius =
    // hair tip farthest from the axis in the cell (±1 cm), empty cells filled from their neighbours, then smoothed.
    const step = 0.01 * s;
    const h0 = SCARF_TOP * s + step, rows = Math.ceil((h0 + SCARF_TOP * (1 + SCARF_SAG) * s + step) / step) + 1;
    const N = 24;
    const grid = Array.from({ length: rows }, () => new Array(N).fill(0));
    for (const t of tips) {
      const d = t.clone().sub(center);
      const h = d.dot(axis);
      const du = d.dot(side), dv = d.dot(v);
      const k = Math.floor(((Math.atan2(dv, du) / (Math.PI * 2)) % 1 + 1) % 1 * N + 0.5) % N;
      const r = Math.hypot(du, dv);
      for (let j = 0; j < rows; j++) if (Math.abs(h0 - j * step - h) < step) grid[j][k] = Math.max(grid[j][k], r);
    }
    for (const row of grid) {
      for (let pass = 0; pass < N && row.some((r) => !r); pass++) {
        for (let k = 0; k < N; k++) if (!row[k]) row[k] = Math.max(row[(k + N - 1) % N], row[(k + 1) % N]);
      }
    }
    const smooth = grid.map((row, j) => row.map((r, k) => {
      const up = grid[Math.max(0, j - 1)][k], dn = grid[Math.min(rows - 1, j + 1)][k];
      return Math.max(r, (row[(k + N - 1) % N] + 2 * r + row[(k + 1) % N] + up + dn) / 6);
    }));
    const radiusAt = (h, ang) => {
      const y = THREE.MathUtils.clamp((h0 - h) / step, 0, rows - 1);
      const x = ((ang / (Math.PI * 2)) % 1 + 1) % 1 * N;
      const j = Math.floor(y), i = Math.floor(x) % N;
      const fy = y - j, fx = x - Math.floor(x);
      const j1 = Math.min(rows - 1, j + 1), i1 = (i + 1) % N;
      return (smooth[j][i] * (1 - fx) + smooth[j][i1] * fx) * (1 - fy) + (smooth[j1][i] * (1 - fx) + smooth[j1][i1] * fx) * fy;
    };
    const mid0 = smooth[Math.round(h0 / step)];
    this.scarfInfo = { vertices: ext.n, tips: tips.length, rows, profile: mid0.map((r) => +r.toFixed(3)), axis: axis.toArray() };
    return buildScarf({ center, axis, side, radiusAt, front: new THREE.Vector3(0, 0, 1), top: SCARF_TOP * s, sag: SCARF_SAG * SCARF_TOP * s, knotTurn: SCARF_KNOT, tails: SCARF_TAILS, scale: s });
  },

  /**
   * Scarf rebuilt on the frozen pose (measured at rest, it floated once the sitting pose bent the neck) and
   * reattached to the same neck bone.
   */
  _refitScarf() {
    const old = this._scarfMesh;
    const next = this._scarf();
    if (!next || !old.parent) return;
    const neck = old.parent;
    old.removeFromParent();
    old.geometry.dispose();
    this.root.add(next);
    this.root.updateMatrixWorld(true);
    neck.attach(next);
    next.userData.npc = this;
    const swap = (list) => list.map((m) => (m === old ? next : m));
    this.accessories = swap(this.accessories);
    if (this.pickables) this.pickables = swap(this.pickables);
    this._scarfMesh = next;
  },

  /**
   * Saves head and ears (sibling bones under the neck) as the hat has just been fitted on them, and the heading of
   * the top of the neck relative to the body. Under the clip played next (walk to the bridge), the ears would pierce
   * the hat and the lowered head of `Walk` would tilt it toward the ground.
   */
  _keepHatPose() {
    const head = this.rig.head, neck = head.parent, bones = new Set([head]);
    for (const chain of [this.rig.earL, this.rig.earR]) for (const ear of chain ?? []) {
      for (let o = ear; o && o !== neck; o = o.parent) bones.add(o);
    }
    this._hatPose = [...bones].map((b) => [b, b.position.clone(), b.quaternion.clone()]);
    this._hatNeck = this.root.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(neck.getWorldQuaternion(new THREE.Quaternion()));
  },

  /** After the mixer: see `_keepHatPose`. */
  _holdHatPose() {
    for (const [b, p, q] of this._hatPose) { b.position.copy(p); b.quaternion.copy(q); }
    setWorldQuaternion(this.rig.head.parent, this.root.getWorldQuaternion(_q).multiply(this._hatNeck));
  },
};
