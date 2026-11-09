import * as THREE from 'three';
import { mergedAccessory, paintSpotParts } from './Accessories.js';
import { isDescendant, pawHolder } from '../cat/CatRig.js';
import { SIT, HAT_EAR_FOLD } from './npcTuning.js';
import { setWorldQuaternion, rotateWorld } from './npcBones.js';

/** Npc methods that rebuild a real cat sit on the frozen pose of a clip: legs, tail, ears, paint spots. */

const _v = new THREE.Vector3();

const _qp = new THREE.Quaternion();

/** Already computed sitting poses (_sitCat), by type, size, clip time and settings. */
const SIT_CACHE = new Map();

/** Foot bone (under the calf) whose orientation is kept, otherwise the holding bone. */
function footOf(leg) {
  return leg.foot && isDescendant(leg.foot, leg.calf) ? leg.foot : pawHolder(leg);
}

export const sitPose = {
  /**
   * Real cat sit. The pose of the `Sit` clip (pelvis in the air, splayed thighs, bent back) is reworked here, with no
   * new clip or GLB retouch:
   * 1. whole body tilted by `o.body` rad (front up) around the base of the spine, then pelvis, hind legs and tail by
   *    `o.rear` rad more: rump on the ground, straight back; the head returns to its clip world orientation;
   * 2. ground = under the shoulders, at `o.reach` × front leg length;
   * 3. front legs straight and close together (`o.frontX` from the middle), under the shoulders;
   * 4. hind legs folded: hock under the hip, knee against the flank (`o.kneeX`), foot flat forward;
   * 5. tail laid on one side, clear of legs and belly, tip brought forward (grid search).
   * `_contact` then puts the lowest point on the ground. Measures in `sitInfo`.
   * `SitNpc` clip (SIT_NPC settings): rump already on the ground and hock under the thigh in the clip; the ground of
   * step 2 comes from the clip and step 4 is skipped (knees only measured).
   * @param {object} [o] SIT or SIT_NPC settings
   */
  _sitCat(o = SIT) {
    const rootBone = this.model.getObjectByName('Root');
    const hip = this.rig.hip;
    const spine = rootBone?.children.find((b) => b.isBone && b.name === 'Spine');
    if (!rootBone?.parent || !hip || !spine) return;
    const s = this.sizeScale;
    this._boneBackup = [...new Set([rootBone, ...this.bodyMesh.skeleton.bones])]
      .map((b) => [b, b.position.clone(), b.quaternion.clone(), b.scale.clone()]);
    // Pose already computed for this type, size and settings (bones in parent frame, so independent of the NPC's
    // place): copied, skipping the searches (about 0.5 s).
    const cacheKey = `${this.kind}|${s}|${this._freezeAt}|${JSON.stringify(o)}`;
    const cached = SIT_CACHE.get(cacheKey);
    if (cached) {
      this._boneBackup.forEach(([b], i) => { const [p, q, sc] = cached.bones[i]; b.position.copy(p); b.quaternion.copy(q); b.scale.copy(sc); });
      rootBone.updateMatrixWorld(true);
      this.sitInfo = cached.info;
      return;
    }
    this.root.updateMatrixWorld(true);
    const toRoot = new THREE.Matrix4().copy(this.root.matrixWorld).invert();
    const rq = this.root.getWorldQuaternion(new THREE.Quaternion());
    const side = new THREE.Vector3(1, 0, 0).applyQuaternion(rq);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(rq);
    const wp = (b) => b.getWorldPosition(new THREE.Vector3());
    const rp = (b) => wp(b).applyMatrix4(toRoot);
    const toWorld = (v) => v.clone().applyMatrix4(this.root.matrixWorld);
    // Clip pose: world orientation of head and feet, support heights.
    const legs = ['FL', 'FR', 'BL', 'BR'].map((k) => [k, this.rig.legs[k]]).filter(([, l]) => l?.thigh && l?.calf && l?.foot);
    const clipLow = Math.min(...legs.map(([, l]) => rp(pawHolder(l)).y));
    const clip = Object.fromEntries(legs.map(([k, l]) => [k, {
      footQ: footOf(l).getWorldQuaternion(new THREE.Quaternion()),
      hockH: rp(l.foot).y - clipLow, pawH: rp(pawHolder(l)).y - clipLow,
      len: [l.thigh, l.calf, l.foot, pawHolder(l)].reduce((a, b, i, arr) => a + (i ? wp(arr[i - 1]).distanceTo(wp(b)) : 0), 0),
    }]));
    const headQ = this.rig.head?.getWorldQuaternion(new THREE.Quaternion());
    const tailBone = this.rig.tail?.[0];
    // 1. Whole body tilted by `body` rad (front up) around the base of the spine, then hindquarters (Hip, thighs,
    // tail) by
    //    `rear` rad more: pelvis down, straight back.
    const pivot = wp(spine);
    const turn = (bones, angle, at) => {
      const R = new THREE.Matrix4().makeTranslation(at.x, at.y, at.z)
        .multiply(new THREE.Matrix4().makeRotationAxis(side, -angle))
        .multiply(new THREE.Matrix4().makeTranslation(-at.x, -at.y, -at.z));
      for (const b of bones) {
        b.matrix.copy(b.parent.matrixWorld).invert().multiply(b.matrixWorld.clone().premultiply(R));
        b.matrix.decompose(b.position, b.quaternion, b.scale);
        b.updateMatrixWorld(true);
      }
    };
    turn([rootBone], o.body, pivot);
    turn([hip, tailBone].filter((b) => b && b.parent === rootBone), o.rear, wp(spine));
    const neck0 = this.rig.neck?.[0];
    if (o.neck && neck0?.parent === rootBone) turn([neck0], o.neck, wp(neck0));
    if (headQ) setWorldQuaternion(this.rig.head, headQ);
    if (o.level && this._landmarks.headQ) {
      const restQ = rq.clone().multiply(this._landmarks.headQ);
      const nowQ = this.rig.head.getWorldQuaternion(new THREE.Quaternion());
      const axis = up.clone().applyQuaternion(restQ.invert()).applyQuaternion(nowQ);
      setWorldQuaternion(this.rig.head, new THREE.Quaternion().setFromUnitVectors(axis, up).slerp(new THREE.Quaternion(), 1 - o.level).multiply(nowQ));
    }
    // 2. Ground: front legs almost straight under the shoulders; `clipGround` (SitNpc): clip ground (lowest paw), the
    // clip
    //    already puts rump and hind feet on the ground.
    const front = legs.filter(([k]) => k[0] === 'F');
    const shoulderY = Math.min(...front.map(([, l]) => rp(l.thigh).y));
    const ground = o.clipGround
      ? Math.min(...legs.map(([, l]) => rp(pawHolder(l)).y))
      : shoulderY - o.reach * Math.min(...front.map(([k]) => clip[k].len));
    const errors = {};
    const knees = {};
    // Two passes when the aimed object is under the foot (setting the foot orientation moves it); one for the hock
    // (hind foot), which the foot orientation does not move.
    const place = (k, l, holderLeg, target, passes = 2) => {
      for (let pass = 0; pass < passes; pass++) {
        this._reach(holderLeg, toWorld(target));
        setWorldQuaternion(footOf(l), clip[k].footQ);
      }
      errors[k] = +pawHolder(holderLeg).getWorldPosition(_v).distanceTo(toWorld(target)).toFixed(4);
    };
    // 3. Front legs straight and close together, under the shoulders.
    for (const [k, l] of front) {
      const top = rp(l.thigh);
      place(k, l, l, new THREE.Vector3((k[1] === 'L' ? 1 : -1) * o.frontX * s, ground + clip[k].pawH, top.z + o.frontZ * s));
    }
    // 4. Hind legs folded: hock on the ground under the hip, foot flat forward (clip orientation). `hind: false`
    // (SitNpc):
    //    skipped, the clip already brings the hock under the thigh.
    for (const [k, l] of legs.filter(([kk]) => kk[0] === 'B' && o.hind !== false)) {
      const top = rp(l.thigh);
      const sign = k[1] === 'L' ? 1 : -1;
      place(k, l, { thigh: l.thigh, calf: l.calf, paw: l.foot }, new THREE.Vector3(sign * o.hockX * s, ground + clip[k].hockH, top.z + o.hockZ * s), 1);
      // Knee brought against the flank: the thigh turns around the hip-to-hock axis (the hock does not move), knee at
      // `kneeX` from the middle and always in front of the hip; `kneeUp` favours the highest knee: thigh raised
      // against the elbow.
      const axis = wp(l.foot).sub(wp(l.thigh)).normalize();
      const q0 = l.thigh.getWorldQuaternion(new THREE.Quaternion());
      const qt = new THREE.Quaternion();
      let best = { d: Infinity, t: 0 };
      for (let t = -1.5; t <= 1.5 + 1e-9; t += 0.02) {
        setWorldQuaternion(l.thigh, qt.setFromAxisAngle(axis, t).multiply(q0));
        const knee = rp(l.calf);
        const d = Math.abs(knee.x - sign * o.kneeX * s) + (knee.z < top.z ? 1 : 0) + 0.01 * Math.abs(t)
          - (o.kneeUp ?? 0) * (knee.y - ground) / s;
        if (d < best.d) best = { d, t };
      }
      setWorldQuaternion(l.thigh, qt.setFromAxisAngle(axis, best.t).multiply(q0));
      setWorldQuaternion(footOf(l), clip[k].footQ);
      const knee = rp(l.calf);
      knees[k] = { h: +(knee.y - ground).toFixed(4), x: +knee.x.toFixed(4), t: +best.t.toFixed(2) };
    }
    if (o.hind === false) {
      for (const [k, l] of legs.filter(([kk]) => kk[0] === 'B')) {
        const knee = rp(l.calf);
        knees[k] = { h: +(knee.y - ground).toFixed(4), x: +knee.x.toFixed(4), t: 0 };
      }
    }
    // 5. Tail: base turned (pitch p, yaw w) and curled (each following bone turns by c around the vertical), laid on
    // the
    //    ground, tip brought in front of the legs, on one side.
    let tailInfo = null;
    if (tailBone && o.wrap) tailInfo = this._wrapTail(o, ground, toRoot);
    else if (tailBone) {
      const chain = this.rig.tail.filter(Boolean);
      const q0 = chain.map((b) => b.quaternion.clone());
      const qa = new THREE.Quaternion(), qb = new THREE.Quaternion(), qw = new THREE.Quaternion();
      const pawZ = Math.max(...front.map(([, l]) => rp(pawHolder(l)).z));
      const hind = legs.filter(([k]) => k[0] === 'B').map(([, l]) => rp(pawHolder(l)));
      const tryTail = (p, w, c, side2) => {
        chain.forEach((b, i) => b.quaternion.copy(q0[i]));
        tailBone.parent.getWorldQuaternion(_qp);
        qa.setFromAxisAngle(side, p);
        qb.setFromAxisAngle(up, w);
        setWorldQuaternion(tailBone, _qp.clone().multiply(q0[0]).premultiply(qa).premultiply(qb));
        for (let i = 1; i < chain.length; i++) setWorldQuaternion(chain[i], chain[i].getWorldQuaternion(qw).premultiply(qa.setFromAxisAngle(up, c)));
        const pts = chain.map(rp);
        const low = Math.min(...pts.map((x) => x.y));
        const tip = pts[pts.length - 1];
        // Aimed tip: in front of the hind feet, beside the front foot (side side2).
        const target = new THREE.Vector3(side2 * (o.frontX + 0.06) * s, ground, pawZ - 0.02 * s);
        // Tail bones clear of the hind legs (not under the foot).
        let inside = pts.reduce((a, x) => a + hind.reduce((h, q) => h + Math.max(0, 0.05 * s - Math.hypot(x.x - q.x, x.z - q.z)), 0), 0);
        // … and clear of the body footprint (not under the belly): in front of the base, more than `tailOut` from the
        // middle.
        for (let i = 2; i < pts.length; i++) if (pts[i].z > pts[0].z + 0.02 * s) inside += Math.max(0, o.tailOut * s - Math.abs(pts[i].x));
        return { low, tip, cost: Math.abs(low - ground - o.tailH * s) * 20 + Math.max(0, ground - low) * 100 + tip.distanceTo(target) + inside * 5 };
      };
      // Coarse grid (0.3 rad step) then fine (0.1) around the best: about 1,460 tries instead of 22,500 for a full
      // fine grid.
      let best = { cost: Infinity };
      const search = (sides, c0, c1, cs, p0, p1, w0, w1, st) => {
        for (const side2 of sides) for (let c = c0; c <= c1 + 1e-9; c += cs) {
          for (let p = p0; p <= p1 + 1e-9; p += st) for (let w = w0; w <= w1 + 1e-9; w += st) {
            const r = tryTail(p, w, c, side2);
            if (r.cost < best.cost) best = { ...r, p, w, c, side2 };
          }
        }
      };
      const cm = o.curl ?? 0.5;
      search([-1, 1], -cm, cm, cm / 4, -1.5, 1.5, -1.5, 1.5, 0.3);
      const b0 = best;
      search([b0.side2], b0.c - 0.2, b0.c + 0.2, 0.1, b0.p - 0.3, b0.p + 0.3, Math.max(-1.6, b0.w - 0.3), Math.min(1.6, b0.w + 0.3), 0.1);
      tryTail(best.p, best.w, best.c, best.side2);
      tailInfo = { pitch: +best.p.toFixed(2), yaw: +best.w.toFixed(2), curl: +best.c.toFixed(2), low: +(best.low - ground).toFixed(4), tip: best.tip.toArray().map((x) => +x.toFixed(3)) };
    }
    if (this.def.accessories === 'wizard') this._foldEars(...HAT_EAR_FOLD);
    this.sitInfo = { ...o, ground: +ground.toFixed(4), reachError: errors, knees, tail: tailInfo };
    SIT_CACHE.set(cacheKey, {
      info: this.sitInfo,
      bones: this._boneBackup.map(([b]) => [b.position.clone(), b.quaternion.clone(), b.scale.clone()]),
    });
  },

  /**
   * Ears folded under the hat brim: each ear (base bone) turns `out` rad outward then `back` rad backward, axes taken
   * in the head frame at rest (the hat's).
   */
  _foldEars(out, back) {
    const head = this.rig.head;
    // Axes of the root frame at rest carried by the head: head (world) × headQ⁻¹, so that the fold does not depend on
    // the heading of the NPC.
    const M = head.getWorldQuaternion(new THREE.Quaternion()).multiply(this._landmarks.headQ.clone().invert());
    const zAxis = new THREE.Vector3(0, 0, 1).applyQuaternion(M), xAxis = new THREE.Vector3(1, 0, 0).applyQuaternion(M);
    const q = new THREE.Quaternion(), qe = new THREE.Quaternion();
    for (const [ear, sgn] of [[this.rig.earL?.[0], 1], [this.rig.earR?.[0], -1]]) {
      if (!ear) continue;
      ear.getWorldQuaternion(qe);
      q.setFromAxisAngle(zAxis, -sgn * out).premultiply(new THREE.Quaternion().setFromAxisAngle(xAxis, -back));
      setWorldQuaternion(ear, q.multiply(qe));
    }
  },

  /**
   * Tail curled on the ground around the sitting cat: each bone, from base to tip, is turned toward the point of the
   * path at its length; the path follows the body footprint (vertices within `o.wrapH` of the ground, tail excluded),
   * `o.wrapGap` outside it, from the back to the front, on side `o.tailSide`. Root frame, before `_contact` (ground =
   * `ground`).
   */
  _wrapTail(o, ground, toRoot) {
    const s = this.sizeScale;
    const chain = this.rig.tail.filter(Boolean);
    const rq = this.root.getWorldQuaternion(new THREE.Quaternion());
    const rp = (b) => b.getWorldPosition(new THREE.Vector3()).applyMatrix4(toRoot);
    const body = this.bodyMesh;
    const g = body.geometry, si = g.attributes.skinIndex, sw = g.attributes.skinWeight, bones = body.skeleton.bones;
    const pts = [];
    for (let i = 0; i < si.count; i += 2) {
      let b = 0, w = -1;
      for (let k = 0; k < 4; k++) if (sw.getComponent(i, k) > w) { w = sw.getComponent(i, k); b = si.getComponent(i, k); }
      if (/^Tail/.test(bones[b].name)) continue;
      const p = body.getVertexPosition(i, new THREE.Vector3()).applyMatrix4(body.matrixWorld).applyMatrix4(toRoot);
      if (p.y < ground + o.wrapH * s) pts.push(p);
    }
    const zs = pts.map((p) => p.z);
    const cz = THREE.MathUtils.lerp(Math.min(...zs), Math.max(...zs), o.wrapC ?? 0.5);
    // Footprint radius per 5° sector around (0, cz); θ = 0 backward, π forward.
    const sd = o.tailSide ?? -1;
    const N = 37, r = new Array(N).fill(0);
    for (const p of pts) {
      const x = p.x * sd, z = p.z - cz;
      const th = Math.atan2(Math.max(0, x), -z);
      const k = Math.round(th / (Math.PI / (N - 1)));
      if (x >= -0.01 * s) r[k] = Math.max(r[k], Math.hypot(x, z));
    }
    const rr = r.map((_, k) => Math.max(r[Math.max(0, k - 1)], r[k], r[Math.min(N - 1, k + 1)]));
    const path = [];
    const baseY = rp(chain[0]).y;
    for (let d = 0; d <= 180; d++) {
      const th = d * Math.PI / 180, kf = th / (Math.PI / (N - 1)), k0 = Math.floor(kf), k1 = Math.min(N - 1, k0 + 1);
      const rad = THREE.MathUtils.lerp(rr[k0], rr[k1], kf - k0) + o.wrapGap * s;
      const drop = o.wrapDrop ? Math.max(0, 1 - th / o.wrapDrop) * (baseY - ground - o.tailH * s) : 0;
      path.push(new THREE.Vector3(sd * Math.sin(th) * rad, ground + o.tailH * s + drop, cz - Math.cos(th) * rad));
    }
    const dir = new THREE.Vector3(), aim = new THREE.Vector3(), q = new THREE.Quaternion(), rqi = rq.clone().invert();
    let j = 0, L = 0;
    for (let i = 0; i < chain.length; i++) {
      const b = chain[i], h = rp(b);
      const child = chain[i + 1] ? rp(chain[i + 1]) : null;
      if (child) { L = h.distanceTo(child); dir.copy(child).sub(h).normalize(); }
      else dir.set(0, 1, 0).applyQuaternion(b.getWorldQuaternion(q)).applyQuaternion(rqi);
      let k = j;
      while (k < path.length - 1 && path[k].distanceTo(h) < L) k++;
      aim.copy(path[k]).sub(h).normalize();
      q.setFromUnitVectors(dir, aim).premultiply(rq).multiply(rqi);
      setWorldQuaternion(b, q.multiply(b.getWorldQuaternion(new THREE.Quaternion())));
      j = k;
    }
    const tp = chain.map(rp);
    const last = chain[chain.length - 1];
    const tip = tp[tp.length - 1].clone().add(dir.set(0, 1, 0).applyQuaternion(last.getWorldQuaternion(q)).applyQuaternion(rqi).multiplyScalar(L));
    return { wrap: true, side: sd, pathEnd: j, low: +(Math.min(...tp.map((p) => p.y)) - ground).toFixed(4), tip: tip.toArray().map((x) => +x.toFixed(3)) };
  },

  /**
   * Chartiste: paint spots on top of both front paws (one mesh per paw, attached to the foot bone), redone at each
   * frozen pose; none outside the sitting pose.
   */
  _paintSpots(sitPose) {
    for (const m of this._spots) {
      m.removeFromParent();
      m.geometry.dispose();
      this.accessories = this.accessories.filter((a) => a !== m);
      this.pickables = this.pickables.filter((a) => a !== m);
    }
    this._spots = [];
    if (!sitPose) return;
    this.root.updateMatrixWorld(true);
    const toRoot = new THREE.Matrix4().copy(this.root.matrixWorld).invert();
    for (const key of ['FL', 'FR']) {
      const leg = this.rig.legs[key];
      if (!leg?.calf) continue;
      const mesh = mergedAccessory(paintSpotParts(this._pawSpots([leg.paw, leg.foot], toRoot, 3), this.sizeScale), 'NpcPaintSpots');
      this.root.add(mesh);
      this.root.updateMatrixWorld(true);
      pawHolder(leg).attach(mesh);
      mesh.userData.npc = this;
      this._spots.push(mesh);
      this.accessories.push(mesh);
      this.pickables.push(mesh);
    }
  },

  /**
   * Paint spots: `n` well-spread vertices on the top and front of the vertices dominated by `bones` (current pose),
   * offset out of the short paw hair. Root frame.
   */
  _pawSpots(bones, toRoot, n) {
    const body = this.bodyMesh;
    const geo = body.geometry;
    const si = geo.attributes.skinIndex;
    const sw = geo.attributes.skinWeight;
    const names = new Set(bones.filter(Boolean).map((b) => b.name));
    const sk = body.skeleton.bones;
    const ref = bones.find(Boolean).getWorldPosition(new THREE.Vector3()).applyMatrix4(toRoot);
    const cand = [];
    for (let i = 0; i < si.count; i++) {
      let best = 0, bw = -1;
      for (let k = 0; k < 4; k++) { const w = sw.getComponent(i, k); if (w > bw) { bw = w; best = si.getComponent(i, k); } }
      if (!names.has(sk[best]?.name)) continue;
      const p = body.getVertexPosition(i, new THREE.Vector3()).applyMatrix4(body.matrixWorld).applyMatrix4(toRoot);
      cand.push({ p, score: p.y + 0.5 * p.z });
    }
    if (!cand.length) return [];
    cand.sort((a, b) => b.score - a.score);
    const top = cand.slice(0, 60);
    const out = [top[0]];
    while (out.length < n && out.length < top.length) {
      let far = null, fd = -1;
      for (const c of top) {
        const d = Math.min(...out.map((o) => o.p.distanceTo(c.p)));
        if (d > fd) { fd = d; far = c; }
      }
      out.push(far);
    }
    return out.map(({ p }) => {
      const dir = p.clone().sub(ref).normalize();
      return { p: p.clone().addScaledVector(dir, 0.009 * this.sizeScale), n: dir };
    });
  },

  /**
   * Brings the paw of `leg` toward `target` (world): thigh and calf rotated around the cat's axes, angles searched on
   * a grid. Error and angles in `_lastReach`.
   * @returns {THREE.Bone} bone holding the object
   */
  _reach(leg, target) {
    const holder = pawHolder(leg);
    const rootQ = this.root.getWorldQuaternion(new THREE.Quaternion());
    const side = new THREE.Vector3(1, 0, 0).applyQuaternion(rootQ);  // lateral axis (raise)
    const front = new THREE.Vector3(0, 0, 1).applyQuaternion(rootQ); // forward axis (spread)
    const q0t = leg.thigh.quaternion.clone();
    const q0c = leg.calf.quaternion.clone();
    // a: thigh forward / backward, c: thigh spread sideways, b: elbow fold.
    // Small cost on the angles: for an equal distance, the least twisted pose wins.
    const apply = (a, b, c) => {
      rotateWorld(leg.thigh, side, a, q0t);
      rotateWorld(leg.thigh, front, c, leg.thigh.quaternion.clone());
      leg.thigh.updateMatrixWorld(true);
      rotateWorld(leg.calf, side, b, q0c);
      leg.calf.updateMatrixWorld(true);
      return holder.getWorldPosition(_v).distanceTo(target) + 0.004 * (Math.abs(a) + Math.abs(b) + Math.abs(c));
    };
    let best = { d: Infinity, a: 0, b: 0, c: 0 };
    const search = (a0, a1, b0, b1, c0, c1, st) => {
      for (let a = a0; a <= a1 + 1e-9; a += st) for (let b = b0; b <= b1 + 1e-9; b += st) for (let c = c0; c <= c1 + 1e-9; c += st) {
        const d = apply(a, b, c);
        if (d < best.d) best = { d, a, b, c };
      }
    };
    search(-2.4, 0.6, -2.4, 2.4, -0.8, 0.8, 0.15);
    search(best.a - 0.15, best.a + 0.15, best.b - 0.15, best.b + 0.15, best.c - 0.15, best.c + 0.15, 0.03);
    apply(best.a, best.b, best.c);
    this._lastReach = { angles: [best.a, best.b, best.c], error: holder.getWorldPosition(_v).distanceTo(target) };
    return holder;
  },
};
