import * as THREE from 'three';
import { toonMaterial, outlineMaterial } from '../style/palette.js';

/**
 * The kitten's helmet: a cute armet (closed 15th-century knight's helmet) with a rounded skull, central ridge, pivoting
 * beaked visor with vertical slits, side hinges, rivets and a short gorget open at the back. Built here with no external
 * file and fitted at load time to the GLB head. Attached by Cat.js (`attachHelmet`).
 *
 * Helmet frame: axes of `cat.root` (+Y up, +Z muzzle), origin = `Head` bone in the bind pose, metres. The group is a child
 * of the `Head` bone and follows every clip. All parts are centred on C, the skull centre and hinge axis (parallel to X).
 * Fit: the fur tips of the head vertices (`furMask` × 0.022 m) keep the plates above the fur; ear cut-outs come from the
 * ears' swept positions (`earSweep`); `EarFollow` makes the ears (children of `Neck002`) follow the head.
 *
 * Interface: `Helmet` (visor fixed open; update, setVisible, hit, dispose) and `attachHelmet(cat)`. Hug scene (Story):
 * `sample`, `detach` (rigid-body fall to the ground), `reattach`, `topPoint`, `groundGap`, `resting`.
 */

/** Helmet colours (sRGB): light brushed steel, neutral grey. */
export const HELMET_COLORS = {
  steel: 0xdcdbd4,   // plates
  edge: 0xc2c1ba,    // rolled edges, ridge, lames (one tone darker, so the lines read)
  rivet: 0xefeee8,   // rivet heads and rosettes (one tone lighter)
};

const FUR_MAX = 0.022;      // m, MAX_LENGTH of Fur.js (length for factor 1)
const FUR_FALLBACK = 1.6;   // factor if `furMask` is missing (the longest in Fur.js)
const GAP = 0.004;          // m, gap between the hair tips and the skull
const TRIM = 0.0032;        // m, radius of the rolled edges
const RIDGE_H = 0.0055;     // m, height of the central ridge
const RIDGE_W = 0.0075;     // m, half-width of the ridge
const VISOR_GAP = 0.011;    // m, visor above the skull (clears the ridge)
// Ear cut-outs: convex hull of the ears' cross-section at rest (hair tips included), grown by EAR_MARGIN (m) for
// movement (twitches ±0.35 rad, orientation, `Pet` clip).
const EAR_MARGIN = 0.005;
const VISOR_EAR_CLEAR = 0.006; // m, gap between the raised visor and the edge of the ear cut-outs
const BROW_ANGLE = 0.09;    // rad above the top of the eyes: front edge of the skull
const FACE_SIDE = 0.12;     // rad of azimuth beyond the outer edge of the eyes: width of the face
const FACE_BLEND = 0.40;    // rad of azimuth: transition from front to sides
const SIDE_LAT = -0.30;     // rad, latitude of the lower edge on the sides (cheeks covered)
const BACK_LAT = -0.18;     // rad, latitude of the lower edge at the back (nape free)
const VISOR_BELOW = 0.12;   // rad below the bottom of the eyes: lower edge of the lowered visor
const VISOR_OVER = 0.13;    // rad of overlap of the visor on the front of the skull
// rad, opening = browLat + OPEN_EXTRA - visorLow: negative so the raised visor stays below the ears while clearing the
// top of the eyes.
const OPEN_EXTRA = -0.08;
const BEAK_W = 0.036;       // m, half-width of the beak
const BEAK_MIN = 0.014;     // m, minimum beak protrusion (readable shape even with a short muzzle)
const BEAK_MAX = 0.060;     // m, maximum protrusion
const BEAK_LIP = 0.45;      // share of the protrusion kept at the lower edge (beak lip)
const BEAK_DIP = 0.07;      // rad: the lower edge dips at the centre (beak tip)
const SLIT_HW = 0.0021;     // m, half-width of the slits
const GORGET_AZI = 1.95;    // rad: the gorget stops at ±112° (open at the back)
const LAME_H = 0.13;        // rad, height of a lame
const LAME_OVER = 0.035;    // rad, overlap of the lames
/**
 * Helmet fall at the hug: rigid body (sampled points of the parts), gravity `g` (m/s²), substeps of at most `step` s.
 * Ground contact (`brain._groundAt`): restitution `bounce` (zero below `still` m/s of normal speed), friction `mu`;
 * damping `damp` (1/s) in the air, `dampGround` (1/s) in contact. At rest when speed stays under `restV` m/s and rotation
 * under `restW` rad/s for `restT` s: the helmet is then set `gap` m above the ground and stops. `samples`: number of
 * rigid-body points; `maxT`: s, longest possible fall.
 */
const DROP = {
  g: 9.81, step: 1 / 240, bounce: 0.22, still: 0.35, mu: 0.6, damp: 0.15, dampGround: 4,
  restV: 0.05, restW: 0.5, restT: 0.25, gap: 0.001, samples: 600, maxT: 6,
};
const _noRaycast = () => {};
const _dv = new THREE.Vector3(), _dw = new THREE.Vector3(), _dr = new THREE.Vector3(), _dn = new THREE.Vector3();
const _dt = new THREE.Vector3(), _dq = new THREE.Quaternion(), _dm = new THREE.Matrix4();
const _UP = new THREE.Vector3(0, 1, 0);

const smooth = THREE.MathUtils.smoothstep;
const clamp = THREE.MathUtils.clamp;

// ------------------------------------------------------------------ reading the GLB head

/** Head data in the helmet frame (metres, root axes, origin = Head bone at rest). */
function readHead(cat) {
  const body = cat.meshes.find((m) => m.name === 'CatBody') ?? cat.meshes.find((m) => m.isSkinnedMesh);
  cat.root.updateMatrixWorld(true);
  const rootInv = cat.root.matrixWorld.clone().invert();
  const toRoot = (mesh) => rootInv.clone().multiply(mesh.matrixWorld).multiply(mesh.bindMatrix);
  const b2r = toRoot(body);
  const bones = body.skeleton.bones;
  const boneMatrix = (name) => {
    const i = bones.findIndex((b) => b.name === name);
    return i < 0 ? null : b2r.clone().multiply(body.skeleton.boneInverses[i].clone().invert());
  };
  const headM = boneMatrix('Head');
  const origin = new THREE.Vector3().setFromMatrixPosition(headM);

  const g = body.geometry;
  const pos = g.getAttribute('position');
  const nor = g.getAttribute('normal');
  const mask = g.getAttribute('furMask');
  const si = g.getAttribute('skinIndex');
  const sw = g.getAttribute('skinWeight');
  const nm = new THREE.Matrix3().getNormalMatrix(b2r);
  const earL = new Set(['Ear', 'Ear001', 'Ear002']);
  const fur = [];
  const ears = [[], []];
  const n = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    let best = 0;
    for (let k = 1; k < 4; k++) if (sw.getComponent(i, k) > sw.getComponent(i, best)) best = k;
    const name = bones[si.getComponent(i, best)].name;
    const isEar = /^Ear(?!_connector)/.test(name);
    if (!isEar && !/^(Head|Nose|Mouth|Ear_connector|Neck002)/.test(name)) continue;
    const p = new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(b2r).sub(origin);
    n.fromBufferAttribute(nor, i).applyMatrix3(nm).normalize();
    const tip = p.clone().addScaledVector(n, FUR_MAX * (mask ? mask.getX(i) : FUR_FALLBACK));
    if (isEar) { const e = ears[earL.has(name) ? 0 : 1]; e.push(p, tip); continue; }
    fur.push(tip);
  }
  const eyes = cat.meshes.filter((m) => m !== body && m.isSkinnedMesh).map((eye) => {
    eye.geometry.computeBoundingSphere();
    const s = eye.geometry.boundingSphere.clone().applyMatrix4(toRoot(eye));
    s.center.sub(origin);
    return s;
  });
  return { headM, origin, fur, eyes, ears };
}

// ------------------------------------------------------------------ shape

/** Normalised direction of a point relative to the centre, for an ellipsoid (k·R, R, R). */
function dirOf(v, k, out = new THREE.Vector3()) {
  return out.set(v.x / k, v.y, v.z).normalize();
}
const latOf = (d) => Math.asin(clamp(d.y, -1, 1));
const aziOf = (d) => Math.atan2(d.x, d.z);
const alphaOf = (v) => Math.atan2(v.y, v.z); // angle around the X axis (hinge), 0 = front
const norm = (v, k) => Math.hypot(v.x / k, v.y, v.z);

/** Beak width along x (1 at the centre, 0 at ±BEAK_W). */
const beakX = (x) => (Math.abs(x) >= BEAK_W ? 0 : Math.cos((Math.PI / 2) * (x / BEAK_W)) ** 2);
/** Vertical beak profile by angle a: 0 at the top edge, 1 at the tip, BEAK_LIP at the bottom edge. */
function beakA(shape, a) {
  const { visorHigh: top, beakPeak: peak, visorLow: low } = shape;
  if (a >= peak) return smooth(a, top, peak) === 0 && a >= top ? 0 : 1 - smooth(a, peak, top);
  return THREE.MathUtils.lerp(BEAK_LIP, 1, smooth(a, low - BEAK_DIP, peak));
}

/**
 * Fits the skull: centre level with the eyes, searching the centre depth and the flattening k that give the smallest
 * volume while covering the fur (except under the beak, which holds the muzzle through its protrusion).
 */
function design(head) {
  const { fur, eyes } = head;
  const eyeY = eyes.reduce((s, e) => s + e.center.y, 0) / eyes.length;
  const nose = fur.reduce((b, p) => (p.z > b.z ? p : b), fur[0]);
  let best = null;
  const v = new THREE.Vector3(), d = new THREE.Vector3();
  for (let cz = -0.04; cz <= 0.08 + 1e-9; cz += 0.004) {
    const C = new THREE.Vector3(0, eyeY, cz);
    let eyeAMin = Infinity, eyeAMax = -Infinity;
    for (const e of eyes) {
      const y = e.center.y - C.y, z = e.center.z - C.z;
      const a = Math.atan2(y, z), h = Math.asin(Math.min(1, e.radius / Math.hypot(y, z)));
      eyeAMin = Math.min(eyeAMin, a - h); eyeAMax = Math.max(eyeAMax, a + h);
    }
    for (let k = 0.9; k <= 1.3 + 1e-9; k += 0.02) {
      let faceAzi = 0;
      for (const e of eyes) {
        const z = e.center.z - C.z;
        faceAzi = Math.max(faceAzi, Math.atan2((Math.abs(e.center.x) + e.radius) / k, z));
      }
      const shape = {
        C, k, eyeAMin, eyeAMax, browLat: eyeAMax + BROW_ANGLE, faceAzi: faceAzi + FACE_SIDE,
        visorLow: eyeAMin - VISOR_BELOW, visorHigh: eyeAMax + BROW_ANGLE + VISOR_OVER,
        beakPeak: Math.atan2(nose.y - C.y, nose.z - C.z),
      };
      // Skull: fur under the rim; visor: fur between its edges, except the muzzle (beak).
      let R = 0, Rvis = 0;
      for (const p of fur) {
        v.subVectors(p, C);
        dirOf(v, k, d);
        if (domeCovers(shape, d)) { R = Math.max(R, norm(v, k)); continue; }
        if (!visorCovers(shape, v) || beakX(v.x) * beakA(shape, alphaOf(v)) > 0.3) continue;
        Rvis = Math.max(Rvis, norm(v, k));
      }
      R += GAP;
      const Rv = Math.max(R + VISOR_GAP, Rvis + GAP);
      const vol = k * R * R * Rv;
      if (!best || vol < best.vol) best = { ...shape, R, Rv, vol };
    }
  }
  return best;
}

/** Latitude of the skull's lower edge by azimuth: front (brow), sides, back. */
function rimLat(shape, azi) {
  const a = Math.abs(azi);
  const side = THREE.MathUtils.lerp(shape.browLat, SIDE_LAT, smooth(a, shape.faceAzi, shape.faceAzi + FACE_BLEND));
  return THREE.MathUtils.lerp(side, BACK_LAT, smooth(a, Math.PI * 0.55, Math.PI * 0.9));
}
const domeCovers = (shape, d) => latOf(d) > rimLat(shape, aziOf(d));
const visorCovers = (shape, v) => {
  const a = alphaOf(v);
  return a > shape.visorLow - BEAK_DIP * beakX(v.x) && a < shape.visorHigh;
};

// ------------------------------------------------------------------ ear cut-outs

/** 2D convex hull (Andrew's monotone chain), counter-clockwise. */
function convexHull(points) {
  const pts = points.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [], upper = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  upper.pop(); lower.pop();
  return lower.concat(upper);
}

/** Signed distance to a convex polygon (negative inside). */
function polySdf(poly, x, y) {
  let emax = -Infinity, dmin = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const ex = b[0] - a[0], ey = b[1] - a[1];
    const len2 = ex * ex + ey * ey;
    if (len2 < 1e-14) continue;
    emax = Math.max(emax, ((x - a[0]) * ey - (y - a[1]) * ex) / Math.sqrt(len2));
    const t = clamp(((x - a[0]) * ex + (y - a[1]) * ey) / len2, 0, 1);
    dmin = Math.min(dmin, Math.hypot(x - a[0] - t * ex, y - a[1] - t * ey));
  }
  return emax <= 0 ? emax : dmin;
}

// Share of the ears' own procedural swivel that is kept (0 = they turn only with the head, 1 = full swivel ±0.44 rad):
// beyond this, the cut-outs reach the raised visor.
const EAR_SWIVEL = 0.35;
const _efM0 = new THREE.Matrix4(), _efD = new THREE.Matrix4(), _efM = new THREE.Matrix4(), _efS = new THREE.Vector3(), _efQ = new THREE.Quaternion();

/**
 * Ears held by the helmet. In the GLB, the ear roots (`Ear`, `Ear.006`) are children of `Neck002`, not `Head`: as the
 * procedural layer turns the head around its pivot, the ears would stay put and slide about 5 cm on the helmet.
 * `EarFollow` applies to them, after the procedural layer, the same transformation `Head` received; the ears' own
 * procedural swivel is scaled by EAR_SWIVEL. Wired in Cat.update: `restore()` right after `procedural.restore()`,
 * `begin()` right before `procedural.update()`, `apply()` right after.
 */
export class EarFollow {
  constructor(rig) {
    this.rig = rig;
    this.ears = [rig.earL[0], rig.earR[0]].filter(Boolean);
    this._q0 = new THREE.Quaternion();
    this._base = null; // position and rotation of the ear roots out of the mixer
  }

  /** Before `mixer.update`: puts the ear roots back in their mixer output state. */
  restore() {
    if (!this._base) return;
    this.ears.forEach((b, i) => { b.position.copy(this._base[i][0]); b.quaternion.copy(this._base[i][1]); });
  }

  /** Right before the procedural layer: remembers the local rotation of `Head` and the ears. */
  begin() {
    if (!this.rig.head) return;
    this._q0.copy(this.rig.head.quaternion);
    this._base = this.ears.map((b) => [b.position.clone(), b.quaternion.clone()]);
  }

  /** Right after the procedural layer: applies the transformation `Head` received to the ears. */
  apply() {
    const head = this.rig.head;
    if (!head || !head.parent || !this._base) return;
    head.updateWorldMatrix(true, false);
    // Head without its own procedural rotation: current parent × (previous position, rotation, scale).
    _efM0.compose(head.position, this._q0, head.scale).premultiply(head.parent.matrixWorld);
    _efD.copy(head.matrixWorld).multiply(_efM0.invert());
    this.ears.forEach((ear, i) => {
      // Ears' own swivel (procedural yaw of the roots) kept up to EAR_SWIVEL.
      if (EAR_SWIVEL !== 1) ear.quaternion.copy(_efQ.copy(this._base[i][1]).slerp(ear.quaternion, EAR_SWIVEL));
      ear.updateWorldMatrix(true, false);
      _efM.multiplyMatrices(_efD, ear.matrixWorld).premultiply(_efM0.copy(ear.parent.matrixWorld).invert());
      _efM.decompose(ear.position, ear.quaternion, _efS);
      ear.updateMatrixWorld(true);
    });
  }
}

/**
 * Swept positions of the ears around the skull, in the `shell` frame (relative to C). The ears follow the head through
 * `EarFollow` but still move relative to the helmet. This replays, on the real skeleton, what moves them:
 * - bind pose, and the `Pet` and `run` clips (the only ones moving the ears relative to the head), sampled with a temporary mixer;
 * - the head's share of pointer tracking (yaw ±0.54 rad, pitch -0.25 to +0.29 rad), scaled by the gaze weight, then `EarFollow`;
 * - the ears' own yaw (0.4 × yaw, clamped to ±0.44 rad, lagging by ±0.3 rad) and twitches (`Ear.001` +0.35 rad, `Ear.003` -0.14 rad around x).
 * The skeleton is restored exactly at the end. Only points within the band [rIn, rOut] are kept (norm of the ellipsoid of shape k).
 */
function earSweep(cat, shell, k, rIn, rOut) {
  const body = cat.meshes.find((m) => m.name === 'CatBody') ?? cat.meshes.find((m) => m.isSkinnedMesh);
  const g = body.geometry;
  const pos = g.getAttribute('position'), nor = g.getAttribute('normal'), mask = g.getAttribute('furMask');
  const si = g.getAttribute('skinIndex'), sw = g.getAttribute('skinWeight');
  const bones = body.skeleton.bones;
  const left = new Set(['Ear', 'Ear001', 'Ear002']);
  const verts = []; // [index, bind position, side]: skin and hair tip
  for (let i = 0; i < pos.count; i++) {
    let best = 0;
    for (let j = 1; j < 4; j++) if (sw.getComponent(i, j) > sw.getComponent(i, best)) best = j;
    const name = bones[si.getComponent(i, best)].name;
    if (!/^Ear(?!_connector)/.test(name)) continue;
    const side = left.has(name) ? 0 : 1;
    const p = new THREE.Vector3().fromBufferAttribute(pos, i);
    const tip = p.clone().addScaledVector(new THREE.Vector3().fromBufferAttribute(nor, i), FUR_MAX * (mask ? mask.getX(i) : FUR_FALLBACK));
    verts.push([i, p, side], [i, tip, side]);
  }
  const all = cat.root;
  const snap = bones.map((b) => [b.position.clone(), b.quaternion.clone(), b.scale.clone()]);
  const restore = () => bones.forEach((b, i) => { b.position.copy(snap[i][0]); b.quaternion.copy(snap[i][1]); b.scale.copy(snap[i][2]); });
  const rig = cat.rig;
  const moved = [rig.head, rig.earL[0], rig.earR[0], rig.earL[1], rig.earR[1]];
  const frameQ = all.getWorldQuaternion(new THREE.Quaternion());
  const UP = new THREE.Vector3(0, 1, 0), RIGHT = new THREE.Vector3(1, 0, 0);
  const pq = new THREE.Quaternion(), rq = new THREE.Quaternion(), ax = new THREE.Vector3();
  const rotFrame = (bone, axis, a) => {
    if (!a) return;
    bone.parent.getWorldQuaternion(pq);
    ax.copy(axis).applyQuaternion(frameQ).applyQuaternion(pq.invert());
    bone.quaternion.premultiply(rq.setFromAxisAngle(ax, a));
  };
  const out = [[], []];
  const v = new THREE.Vector3(), inv = new THREE.Matrix4();
  // Common ancestor of the head and ears: only its branch is updated at each trial.
  const hub = rig.neck[2] ?? all;
  all.updateMatrixWorld(true);
  inv.copy(shell.matrixWorld).invert();
  // Only vertices close to the band can enter it (wide tolerance: 6 cm).
  for (let n = verts.length - 1; n >= 0; n--) {
    const [i, p] = verts[n];
    v.copy(p);
    body.applyBoneTransform(i, v);
    const r = norm(v.applyMatrix4(body.matrixWorld).applyMatrix4(inv), k);
    if (r < rIn - 0.06 || r > rOut + 0.06) verts.splice(n, 1);
  }
  const collect = () => {
    hub.updateMatrixWorld(true);
    inv.copy(shell.matrixWorld).invert();
    for (const [i, p, side] of verts) {
      v.copy(p);
      body.applyBoneTransform(i, v);
      v.applyMatrix4(body.matrixWorld).applyMatrix4(inv);
      const r = norm(v, k);
      if (r > rIn && r < rOut) out[side].push(v.clone());
    }
  };
  // `lw`: gaze weight of the state (Cat.onStateChange: 1 at rest, 0.5 running, 0.2 while petting).
  // The ears aim at the same yaw as the head (0.4 × yaw), with a delay: gap ±0.3 × lw.
  const follow = new EarFollow(rig);
  const grid = (lw) => {
    const base = moved.map((b) => b.quaternion.clone());
    hub.updateMatrixWorld(true);
    follow.begin();
    for (const Y of [-1.35, -0.7, 0, 0.7, 1.35]) for (const lag of [-0.3, 0, 0.3]) for (const hp of [-0.25, 0, 0.29]) for (const tw of [0, 1]) {
      const hy = 0.4 * Y * lw;
      const ey = THREE.MathUtils.clamp(hy + lag * lw, -0.44 * lw, 0.44 * lw);
      follow.restore();
      moved.forEach((b, i) => b.quaternion.copy(base[i]));
      hub.updateMatrixWorld(true);
      // Order of Cat.update: head (yaw then pitch), ears, twitches, then EarFollow.
      rotFrame(rig.head, UP, hy);
      rig.head.updateMatrixWorld(true);
      rotFrame(rig.head, RIGHT, -hp * lw);
      rotFrame(rig.earL[0], UP, ey);
      rotFrame(rig.earR[0], UP, ey);
      if (tw) {
        rig.earL[1].quaternion.multiply(rq.setFromAxisAngle(RIGHT, 0.35));
        rig.earR[1].quaternion.multiply(rq.setFromAxisAngle(RIGHT, -0.14));
      }
      hub.updateMatrixWorld(true);
      follow.apply();
      collect();
    }
    follow.restore();
    moved.forEach((b, i) => b.quaternion.copy(base[i]));
  };
  grid(1);
  const mixer = new THREE.AnimationMixer(cat.mixer?.getRoot?.() ?? all);
  for (const [name, lw] of [['Pet', 0.2], ['run', 0.5]]) {
    const clip = cat.clips?.[name];
    if (!clip) continue;
    const action = mixer.clipAction(clip);
    action.play();
    for (let s = 0; s < 6; s++) {
      restore();
      mixer.setTime((clip.duration * s) / 6);
      all.updateMatrixWorld(true);
      grid(lw);
    }
    action.stop();
  }
  mixer.stopAllAction();
  mixer.uncacheRoot(mixer.getRoot());
  restore();
  all.updateMatrixWorld(true);
  return out;
}

/**
 * Ear cut-out: swept ear points (`earSweep`) projected on the plane tangent to the skull at the cut-out centre; convex
 * hull + EAR_MARGIN.
 */
function earHole(band, k) {
  const c = band.reduce((s, q) => s.add(q), new THREE.Vector3()).multiplyScalar(1 / Math.max(1, band.length));
  const n = new THREE.Vector3(c.x / (k * k), c.y, c.z).normalize();
  const u = new THREE.Vector3(1, 0, 0).cross(n).normalize(); // toward the back and up on the skull
  const w = n.clone().cross(u).normalize();
  const q = new THREE.Vector3();
  const poly = convexHull(band.map((p) => { q.subVectors(p, c); return [q.dot(u), q.dot(w)]; }));
  const sdf = (p, margin = EAR_MARGIN) => {
    q.subVectors(p, c);
    if (q.dot(n) < -0.08 || q.lengthSq() > 0.06) return Infinity;
    return polySdf(poly, q.dot(u), q.dot(w)) - margin;
  };
  return { c, n, u, w, poly, sdf, count: band.length };
}

// ------------------------------------------------------------------ geometry

/** Brushing texture: fine streaks in one direction (1 × 256, grey 0.86 to 1). */
function brushedTexture() {
  const N = 256;
  const data = new Uint8Array(N * 4);
  let s = 12345, walk = 0;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < N; i++) {
    walk = walk * 0.7 + (rnd() - 0.5) * 0.6;
    const v = clamp(0.93 + walk * 0.1 + (rnd() - 0.5) * 0.05, 0.86, 1);
    data.set([v * 255, v * 255, v * 255, 255], i * 4);
  }
  const tex = new THREE.DataTexture(data, 1, N, THREE.RGBAFormat);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 3);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Parametric surface (s, t) cut by a signed distance function `sdf(s, t)` in metres (> 0: kept). `point(s, t)` gives the
 * point, `normalAt(s, t)` the outward normal, `uvAt` texture coordinates. Grid triangles are cut exactly on sdf = 0
 * (interpolated in parameter space, point recomputed on the surface).
 */
function clippedSurface({ ss, ts, sdf, point, normalAt, uvAt }) {
  const grid = ts.map((t) => ss.map((s) => ({ s, t, f: sdf(s, t) })));
  const positions = [], normals = [], uvs = [];
  const lerpV = (a, b) => {
    const u = a.f / (a.f - b.f);
    return { s: a.s + (b.s - a.s) * u, t: a.t + (b.t - a.t) * u, f: 0 };
  };
  const _e1 = new THREE.Vector3(), _e2 = new THREE.Vector3();
  const emit = (poly) => {
    for (let i = 1; i + 1 < poly.length; i++) {
      let tri = [poly[0], poly[i], poly[i + 1]];
      let p = tri.map((v) => point(v.s, v.t));
      _e1.subVectors(p[1], p[0]); _e2.subVectors(p[2], p[0]);
      const c = _e1.cross(_e2);
      if (c.lengthSq() < 1e-16) continue;
      const nn = tri.map((v) => normalAt(v.s, v.t));
      if (c.dot(nn[0]) < 0) { tri = [tri[0], tri[2], tri[1]]; p = [p[0], p[2], p[1]]; nn.splice(1, 2, nn[2], nn[1]); }
      for (let m = 0; m < 3; m++) {
        positions.push(p[m].x, p[m].y, p[m].z);
        normals.push(nn[m].x, nn[m].y, nn[m].z);
        const uv = uvAt(tri[m].s, tri[m].t);
        uvs.push(uv[0], uv[1]);
      }
    }
  };
  const clip = (tri) => {
    if (tri[0].f < 0 && tri[1].f < 0 && tri[2].f < 0) return;
    const out = [];
    for (let i = 0; i < 3; i++) {
      const a = tri[i], b = tri[(i + 1) % 3];
      if (a.f >= 0) out.push(a);
      if ((a.f >= 0) !== (b.f >= 0)) out.push(lerpV(a, b));
    }
    if (out.length >= 3) emit(out);
  };
  for (let j = 0; j + 1 < ts.length; j++) {
    for (let i = 0; i + 1 < ss.length; i++) {
      const a = grid[j][i], b = grid[j][i + 1], c = grid[j + 1][i], d = grid[j + 1][i + 1];
      clip([a, c, d]);
      clip([a, d, b]);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.computeBoundingSphere();
  return geo;
}

const range = (a, b, n) => Array.from({ length: n + 1 }, (_, i) => a + ((b - a) * i) / n);

/**
 * Ellipsoid patch (semi-axes kR, R, R) in latitude / azimuth, cut by `sdf(d, p)` in metres (d = normalised direction,
 * p = point relative to the centre).
 */
function ellipsoidPatch(R, k, sdf, nAzi = 128, nLat = 80) {
  const dir = (s, t) => new THREE.Vector3(Math.cos(t) * Math.sin(s), Math.sin(t), Math.cos(t) * Math.cos(s));
  const pt = (d) => new THREE.Vector3(d.x * k * R, d.y * R, d.z * R);
  return clippedSurface({
    ss: range(-Math.PI, Math.PI, nAzi),
    ts: range(-Math.PI / 2, Math.PI / 2, nLat),
    sdf: (s, t) => { const d = dir(s, t); return sdf(d, pt(d)); },
    point: (s, t) => pt(dir(s, t)),
    normalAt: (s, t) => { const d = dir(s, t); return new THREE.Vector3(d.x / k, d.y, d.z).normalize(); },
    uvAt: (s, t) => [s / (Math.PI * 2) + 0.5, t / Math.PI + 0.5],
  });
}

/** Tube along a series of points (closed or not). */
function tube(points, radius = TRIM, segments = 160, closed = true) {
  const curve = new THREE.CatmullRomCurve3(points, closed, 'centripetal');
  return new THREE.TubeGeometry(curve, segments, radius, 8, closed);
}

/** Exit point from the ellipsoid (kR, R, R) along the line q + t·dir (largest root). */
function onEllipsoid(q, dir, a, R) {
  const s = new THREE.Vector3(1 / a, 1 / R, 1 / R);
  const qs = q.clone().multiply(s), ds = dir.clone().multiply(s);
  const A = ds.dot(ds), B = 2 * qs.dot(ds), Cc = qs.dot(qs) - 1;
  const disc = Math.max(0, B * B - 4 * A * Cc);
  return q.clone().addScaledVector(dir, (-B + Math.sqrt(disc)) / (2 * A));
}

/** Point of the ellipsoid (kR, R, R) at latitude `lat` and azimuth `az`, pushed out by `out` m. */
function latAzi(R, k, lat, az, out = 0) {
  const d = new THREE.Vector3(Math.cos(lat) * Math.sin(az), Math.sin(lat), Math.cos(lat) * Math.cos(az));
  const p = new THREE.Vector3(d.x * k * R, d.y * R, d.z * R);
  return p.addScaledVector(new THREE.Vector3(d.x / k, d.y, d.z).normalize(), out);
}

// ------------------------------------------------------------------ helmet

export class Helmet {
  /**
   * Builds the helmet and attaches it to the cat's `Head` bone (visor raised).
   * @param {import('./Cat.js').Cat} cat an already built cat (Cat.load)
   */
  constructor(cat) {
    this.cat = cat;
    const head = readHead(cat);
    const shape = design(head);
    this.shape = shape;
    const { C, k, R } = shape;

    // Child group of the Head bone: helmet frame (root axes, metres, origin = Head bone).
    this.group = new THREE.Group();
    this.group.name = 'Helmet';
    const local = head.headM.clone().invert().multiply(new THREE.Matrix4().makeTranslation(head.origin));
    local.decompose(this.group.position, this.group.quaternion, this.group.scale);
    cat.rig.head.add(this.group);

    // Centre of the skull and hinge.
    this.shell = new THREE.Group();
    this.shell.position.copy(C);
    this.group.add(this.shell);

    this._texture = brushedTexture();
    const steel = toonMaterial(HELMET_COLORS.steel, { side: THREE.DoubleSide, map: this._texture });
    const edge = toonMaterial(HELMET_COLORS.edge);
    const lame = toonMaterial(HELMET_COLORS.edge, { side: THREE.DoubleSide, map: this._texture });
    const rivetMat = toonMaterial(HELMET_COLORS.rivet);
    const outline = outlineMaterial();
    this._materials = [steel, edge, lame, rivetMat, outline];
    this.meshes = [];
    const add = (parent, geo, mat, withOutline = false) => {
      const m = new THREE.Mesh(geo, mat);
      m.castShadow = true;
      m.receiveShadow = true;
      m.raycast = _noRaycast;
      parent.add(m);
      this.meshes.push(m);
      if (withOutline) {
        const o = new THREE.Mesh(geo, outline);
        o.raycast = _noRaycast;
        m.add(o);
      }
      return m;
    };

    // --- ear cut-outs (frame: relative to C)
    this.shell.updateMatrixWorld(true);
    this.holes = earSweep(cat, this.shell, k, R - 0.008, shape.Rv + 0.008).map((band) => earHole(band, k));
    const holeSdf = (p, margin) => {
      let f = Infinity;
      for (const h of this.holes) f = Math.min(f, h.sdf(p, margin));
      return f;
    };

    // --- skull: above the rim (front, sides, back), outside the ear cut-outs
    const domeSdf = (d, p) => Math.min((latOf(d) - rimLat(shape, aziOf(d))) * R, holeSdf(p));
    add(this.shell, ellipsoidPatch(R, k, domeSdf, 144, 90), steel, true);

    // Rolled edge at the bottom of the skull.
    const rim = [];
    for (let i = 0; i < 180; i++) {
      const az = (i / 180) * Math.PI * 2 - Math.PI;
      rim.push(latAzi(R, k, rimLat(shape, az), az));
    }
    add(this.shell, tube(rim, TRIM, 220), edge);

    // Rolled edges of the ear cut-outs (just outside: they do not narrow the opening).
    for (const h of this.holes) {
      const ring = [];
      const c2 = h.poly.reduce((s, p) => [s[0] + p[0] / h.poly.length, s[1] + p[1] / h.poly.length], [0, 0]);
      for (let i = 0; i < 64; i++) {
        const th = (i / 64) * Math.PI * 2;
        const dx = Math.cos(th), dy = Math.sin(th);
        let lo = 0, hi = 0.2;
        for (let it = 0; it < 30; it++) {
          const mid = (lo + hi) / 2;
          if (polySdf(h.poly, c2[0] + dx * mid, c2[1] + dy * mid) - EAR_MARGIN - TRIM * 0.9 < 0) lo = mid; else hi = mid;
        }
        const q = h.c.clone().addScaledVector(h.u, c2[0] + dx * lo).addScaledVector(h.w, c2[1] + dy * lo);
        ring.push(onEllipsoid(q.addScaledVector(h.n, -0.05), h.n, k * R, R));
      }
      add(this.shell, tube(ring, TRIM * 0.9, 96), edge);
    }

    // --- central ridge: from the front rim to the nape, along the median plane (x = 0).
    const a0 = shape.browLat, a1 = Math.PI - BACK_LAT;
    {
      const NS = 120, NJ = 12;
      const verts = [], idx = [];
      for (let i = 0; i <= NS; i++) {
        const a = a0 + ((a1 - a0) * i) / NS;
        const taper = smooth(a, a0, a0 + 0.22) * (1 - smooth(a, a1 - 0.25, a1));
        const nrm = new THREE.Vector3(0, Math.sin(a), Math.cos(a));
        const base = nrm.clone().multiplyScalar(R);
        const hgt = RIDGE_H * (0.15 + 0.85 * taper);
        const wid = RIDGE_W * (0.45 + 0.55 * taper);
        for (let j = 0; j <= NJ; j++) {
          const ph = (j / NJ) * Math.PI;
          const lat = Math.cos(ph) * wid;
          const up = -0.002 + (hgt + 0.002) * Math.pow(Math.sin(ph), 0.6);
          const p = base.clone().addScaledVector(nrm, up);
          p.x = lat;
          verts.push(p.x, p.y, p.z);
        }
      }
      for (let i = 0; i < NS; i++) for (let j = 0; j < NJ; j++) {
        const a = i * (NJ + 1) + j, b = a + 1, c = a + NJ + 1, d = c + 1;
        idx.push(a, c, b, b, c, d);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
      geo.setIndex(idx);
      geo.computeVertexNormals();
      // Orientation: normals outward (otherwise, flip the triangle winding).
      const nArr = geo.getAttribute('normal');
      const mid = (Math.floor(NS / 2) * (NJ + 1) + NJ / 2) | 0;
      const pm = new THREE.Vector3().fromBufferAttribute(geo.getAttribute('position'), mid);
      if (new THREE.Vector3().fromBufferAttribute(nArr, mid).dot(pm) < 0) {
        const ix = geo.index.array;
        for (let t = 0; t < ix.length; t += 3) { const tmp = ix[t + 1]; ix[t + 1] = ix[t + 2]; ix[t + 2] = tmp; }
        geo.computeVertexNormals();
      }
      this.ridge = add(this.shell, geo, edge, true);
    }

    // --- beaked visor
    const Rv = shape.Rv;
    const kv = (k * R + (Rv - R)) / Rv;
    const xMax = kv * Rv;
    const rhoAt = (x) => Rv * Math.sqrt(Math.max(1e-6, 1 - (x / xMax) ** 2));
    const eyeA = head.eyes.reduce((s, e) => s + alphaOf(e.center.clone().sub(C)), 0) / head.eyes.length;
    const eyeX = head.eyes.reduce((s, e) => s + Math.abs(e.center.x), 0) / head.eyes.length;
    const eyeR = head.eyes.reduce((s, e) => s + e.radius, 0) / head.eyes.length;
    const lowAt = (x) => shape.visorLow - BEAK_DIP * beakX(x);
    // Raised: the lower edge (sides) passes just above the front rim.
    this.openAngle = shape.browLat + OPEN_EXTRA - shape.visorLow;

    // Beak protrusion: just enough to hold the muzzle fur (BEAK_MIN..BEAK_MAX).
    let beak = BEAK_MIN;
    {
      const v = new THREE.Vector3(), d = new THREE.Vector3();
      for (const p of head.fur) {
        v.subVectors(p, C);
        if (domeCovers(shape, dirOf(v, k, d)) || !visorCovers(shape, v)) continue;
        const wgt = beakX(v.x) * beakA(shape, alphaOf(v));
        if (wgt <= 0.3) continue;
        beak = Math.max(beak, (norm(v, kv) - Rv + GAP) / wgt);
      }
      beak = Math.min(beak, BEAK_MAX);
    }
    const beakAt = (x, a) => beak * beakX(x) * beakA(shape, a);

    // Top edge by |x|: full height at the centre; it dips on the sides so the raised visor does not touch the ear
    // cut-outs (it becomes an arm toward the hinge).
    const NP = 120;
    const highTab = [];
    const _q = new THREE.Vector3();
    for (let i = 0; i <= NP; i++) {
      const x = (i / NP) * xMax * 0.999;
      const rho = rhoAt(x) + beakAt(x, shape.visorHigh);
      let hi = shape.visorHigh;
      for (let a = shape.visorLow; a <= shape.visorHigh; a += 0.004) {
        const ar = a + this.openAngle;
        let clear = Infinity;
        for (const sx of [-1, 1]) clear = Math.min(clear, holeSdf(_q.set(sx * x, rho * Math.sin(ar), rho * Math.cos(ar))));
        if (clear < VISOR_EAR_CLEAR + TRIM) { hi = a; break; }
      }
      highTab.push(hi);
    }
    const STRAP = 0.16; // rad, minimum height of the arm toward the hinge
    for (let i = 1; i <= NP; i++) highTab[i] = Math.min(highTab[i], highTab[i - 1]);
    const slope = 1.0 * (xMax / NP) / 0.016; // rad per step: ~1 rad over 16 mm
    for (let i = NP - 1; i >= 0; i--) highTab[i] = Math.min(highTab[i], highTab[i + 1] + slope);
    for (let i = 0; i <= NP; i++) highTab[i] = Math.max(highTab[i], shape.visorLow + STRAP);
    const highAt = (x) => {
      const f = clamp(Math.abs(x) / xMax, 0, 1) * NP;
      const i = Math.min(NP - 1, Math.floor(f));
      return THREE.MathUtils.lerp(highTab[i], highTab[i + 1], f - i);
    };

    // Vertical slits in front of each eye (three per eye), stopped before the edges.
    const slits = [];
    for (const sx of [-1, 1]) for (const o of [-0.62, 0, 0.62]) {
      const x = sx * (eyeX + o * eyeR);
      const rho = rhoAt(x);
      const hh = eyeR * (0.95 - 0.25 * Math.abs(o));
      let top = eyeA + hh / rho, bot = eyeA - hh / rho;
      top = Math.min(top, highAt(Math.abs(x) + SLIT_HW) - 0.012 / rho);
      bot = Math.max(bot, lowAt(x) + 0.012 / rho);
      if (top - bot > 0.01 / rho) slits.push({ x, top, bot });
    }
    const slitSdf = (x, a) => {
      let f = Infinity;
      const rho = rhoAt(x);
      for (const s of slits) {
        const dy = a > s.top ? (a - s.top) * rho : a < s.bot ? (s.bot - a) * rho : 0;
        f = Math.min(f, Math.hypot(x - s.x, dy) - SLIT_HW);
      }
      return f;
    };

    // Visor surface in parameters (x, a): x in metres (columns aligned with the slits).
    const base = (x, a) => { const rho = rhoAt(x); return new THREE.Vector3(x, rho * Math.sin(a), rho * Math.cos(a)); };
    const baseN = (x, a) => { const p = base(x, a); return new THREE.Vector3(p.x / (kv * kv), p.y, p.z).normalize(); };
    const vpoint = (x, a) => base(x, a).addScaledVector(baseN(x, a), beakAt(x, a));
    const vnormal = (x, a) => {
      const n0 = baseN(x, a);
      if (Math.abs(x) > BEAK_W || Math.abs(x) > xMax - 0.004) return n0;
      const ex = 0.0008, ea = 0.004;
      const sx = vpoint(x + ex, a).sub(vpoint(x - ex, a));
      const sa = vpoint(x, a + ea).sub(vpoint(x, a - ea));
      const n = sx.cross(sa).normalize();
      return n.dot(n0) < 0 ? n.negate() : n;
    };
    const xs = [];
    for (let x = -xMax * 0.999; x <= xMax * 0.999 + 1e-9;) {
      xs.push(x);
      x += Math.abs(x) < 0.085 ? 0.0018 : 0.004;
    }
    const aLo = shape.visorLow - BEAK_DIP - 0.02, aHi = shape.visorHigh + 0.02;
    const visorSdf = (x, a) => {
      const rho = rhoAt(x);
      return Math.min((a - lowAt(x)) * rho, (highAt(x) - a) * rho, slitSdf(x, a));
    };
    this.visorPivot = new THREE.Group();
    this.shell.add(this.visorPivot);
    const visorGeo = clippedSurface({
      ss: xs, ts: range(aLo, aHi, Math.ceil((aHi - aLo) / 0.02)), sdf: visorSdf,
      point: vpoint, normalAt: vnormal, uvAt: (x, a) => [x / xMax * 0.5 + 0.5, a / Math.PI + 0.5],
    });
    add(this.visorPivot, visorGeo, steel, true);
    // Rolled edge of the visor: lower edge then upper edge, from hinge to hinge.
    const edgePts = [];
    const NE = 90;
    const xb = (i) => Math.sin(-Math.PI / 2 + (i / NE) * Math.PI) * xMax * 0.995;
    for (let i = 0; i <= NE; i++) edgePts.push(vpoint(xb(i), lowAt(xb(i))));
    for (let i = NE - 1; i >= 1; i--) edgePts.push(vpoint(xb(i), highAt(xb(i))));
    add(this.visorPivot, tube(edgePts, TRIM, 300), edge);

    // --- hinges: round rosettes on each side (fixed to the skull), rivet at the centre.
    const rosette = new THREE.CylinderGeometry(0.0145, 0.0155, 0.0045, 28);
    const dome = new THREE.SphereGeometry(0.0052, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2);
    for (const s of [-1, 1]) {
      const r = add(this.shell, rosette, edge, true);
      r.position.set(s * (xMax + 0.0015), 0, 0);
      r.rotation.z = Math.PI / 2;
      const c = add(this.shell, dome, rivetMat);
      c.position.set(s * (xMax + 0.0038), 0, 0);
      c.rotation.z = -s * Math.PI / 2;
    }

    // --- rivets along the skull rim (sides and back, away from the face and cut-outs).
    const rivet = new THREE.SphereGeometry(0.0042, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    const up = new THREE.Vector3(0, 1, 0);
    const putRivet = (p, n) => {
      const m = add(this.shell, rivet, rivetMat);
      m.position.copy(p);
      m.quaternion.setFromUnitVectors(up, n);
    };
    for (let az = shape.faceAzi + FACE_BLEND + 0.1; az <= Math.PI + 1e-6; az += 0.34) {
      for (const s of az >= Math.PI - 1e-6 ? [1] : [-1, 1]) {
        const lat = rimLat(shape, s * az) + 0.075;
        const p = latAzi(R, k, lat, s * az, 0.0005);
        if (holeSdf(p) < 0.012) continue;
        const d = new THREE.Vector3(Math.cos(lat) * Math.sin(s * az), Math.sin(lat), Math.cos(lat) * Math.cos(s * az));
        putRivet(p, new THREE.Vector3(d.x / k, d.y, d.z).normalize());
      }
    }

    // --- gorget: two lames under the skull and under the beak, open at the back.
    // Top edge of the first lame by azimuth: below the visor in front, below the rim on the sides.
    const lameTop = (az) => {
      const a = Math.abs(az);
      return THREE.MathUtils.lerp(shape.visorLow - BEAK_DIP + 0.03, SIDE_LAT + 0.035, smooth(a, shape.faceAzi * 0.6, shape.faceAzi + FACE_BLEND));
    };
    this.lames = [];
    for (let i = 0; i < 2; i++) {
      const top = (az) => lameTop(az) - i * (LAME_H - LAME_OVER);
      const bot = (az) => top(az) - LAME_H;
      // Radius: above the fur of the band, and above the previous lame.
      let Rg = R + 0.003 * (i + 1);
      const v = new THREE.Vector3(), d = new THREE.Vector3();
      for (const p of head.fur) {
        v.subVectors(p, C); dirOf(v, k, d);
        const az = aziOf(d), lat = latOf(d);
        if (Math.abs(az) > GORGET_AZI || lat > top(az) || lat < bot(az)) continue;
        Rg = Math.max(Rg, norm(v, k) + GAP);
      }
      if (i > 0) Rg = Math.max(Rg, this.lames[i - 1].R + 0.0025);
      const sdf = (dd) => {
        const az = aziOf(dd), lat = latOf(dd);
        return Math.min((top(az) - lat) * Rg, (lat - bot(az)) * Rg, (GORGET_AZI - Math.abs(az)) * Rg * Math.cos(lat));
      };
      const mesh = add(this.shell, ellipsoidPatch(Rg, k, sdf, 144, 90), lame, true);
      // Rolled edge at the bottom of the lame.
      const lip = [];
      for (let j = 0; j <= 60; j++) {
        const az = -GORGET_AZI + 0.02 + ((2 * GORGET_AZI - 0.04) * j) / 60;
        lip.push(latAzi(Rg, k, bot(az) + 0.012, az));
      }
      add(this.shell, tube(lip, TRIM * 0.85, 120, false), edge);
      // Rivets at both ends of the lame.
      for (const s of [-1, 1]) {
        const az = s * (GORGET_AZI - 0.1);
        const lat = (top(az) + bot(az)) / 2;
        const dd = new THREE.Vector3(Math.cos(lat) * Math.sin(az), Math.sin(lat), Math.cos(lat) * Math.cos(az));
        putRivet(latAzi(Rg, k, lat, az, 0.0005), new THREE.Vector3(dd.x / k, dd.y, dd.z).normalize());
      }
      this.lames.push({ mesh, R: Rg, top, bot });
    }

    this.visorPivot.rotation.x = -this.openAngle;

    // Fall at the hug: original place under the Head bone (reattach), ridge in the group frame (topPoint, fallen
    // helmet), head hair tips (group frame).
    this.onHead = true;
    this._home = { parent: cat.rig.head, p: this.group.position.clone(), q: this.group.quaternion.clone(), s: this.group.scale.clone() };
    this.shell.updateMatrix(); this.ridge.updateMatrix();
    this._ridgeM = this.shell.matrix.clone().multiply(this.ridge.matrix);
    this._fur = head.fur.map((p) => p.clone());
    this._body = null;     // rigid body during the fall (detach), null on the head
    this._last = null;     // last two world poses from sample() (speed at detachment)
  }

  /** Call every frame (seconds): advances the fall once the helmet is off. */
  update(dt) {
    if (this._body) this._fall(dt);
  }

  /** Shows or hides the whole helmet. */
  setVisible(visible) { this.group.visible = !!visible; }

  /**
   * Helmet meshes ignore raycasts (empty `raycast`): a click on the helmet goes through to the cat's head behind it. To
   * count a click on the helmet as a click on the cat, `helmet.hit(raycaster)` returns the nearest intersection or null.
   */
  hit(raycaster) {
    // Helmet fallen on the ground: a click on it is not a click on the cat.
    if (!this.group.visible || !this.onHead) return null;
    const out = [];
    for (const m of this.meshes) THREE.Mesh.prototype.raycast.call(m, raycaster, out);
    out.sort((a, b) => a.distance - b.distance);
    return out[0] ?? null;
  }

  // ------------------------------------------------- fall at the hug

  /**
   * Records the helmet's world pose while on the head (Story, on each frame of the head shake, before `detach`): the
   * head speed at detachment comes from the last two records.
   */
  sample(dt) {
    if (!this.onHead || !(dt > 0)) return;
    this.group.updateWorldMatrix(true, false);
    const p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
    this.group.matrixWorld.decompose(p, q, s);
    this._last = { prev: this._last?.cur ?? null, cur: { p, q, dt } };
  }

  /**
   * Detaches the helmet from the Head bone (same world pose, attached to the scene) and lets it fall: rigid body updated
   * by `update` until rest, then left on the ground.
   * @param {object} [o] `side`: world direction (x, z) of the side toss; `toss`: [sideways, up] in m/s; `spin`: roll in
   *   rad/s; `keep`: share of the head's rotation kept; `ground(x, z)`: ground height (default: the brain's)
   * @returns {boolean} false if the helmet was not on the head
   */
  detach(o = {}) {
    const g = this.group, scene = this.cat.root.parent;
    if (!this.onHead || !scene) return false;
    const ground = o.ground ?? ((x, z) => this.cat.brain._groundAt(x, z));
    g.updateWorldMatrix(true, true);
    const pw = new THREE.Vector3(), qw = new THREE.Quaternion(), sw = new THREE.Vector3();
    g.matrixWorld.decompose(pw, qw, sw);
    // Vertices of all parts in the group frame, group scale included.
    const inv = g.matrixWorld.clone().invert(), all = [];
    for (const m of this.meshes) {
      const rel = inv.clone().multiply(m.matrixWorld), pos = m.geometry.getAttribute('position');
      for (let i = 0; i < pos.count; i++) all.push(new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(rel).multiply(sw));
    }
    const stride = Math.max(1, Math.ceil(all.length / DROP.samples));
    const pts = all.filter((_, i) => i % stride === 0);
    const c = pts.reduce((s, p) => s.add(p), new THREE.Vector3()).divideScalar(pts.length);
    const rs = pts.map((p) => p.clone().sub(c));
    // Inertia tensor (mass 1 spread over the points), group frame.
    const e = [0, 0, 0, 0, 0, 0, 0, 0, 0];
    for (const r of rs) {
      const w = 1 / rs.length, r2 = r.lengthSq();
      e[0] += w * (r2 - r.x * r.x); e[4] += w * (r2 - r.y * r.y); e[8] += w * (r2 - r.z * r.z);
      e[1] -= w * r.x * r.y; e[2] -= w * r.x * r.z; e[5] -= w * r.y * r.z;
    }
    e[3] = e[1]; e[6] = e[2]; e[7] = e[5];
    const Iinv = new THREE.Matrix3().fromArray(e).invert();
    // Velocities: head (last two sample records) + side toss and roll.
    const x = c.clone().applyQuaternion(qw).add(pw), v = new THREE.Vector3(), w = new THREE.Vector3();
    const L = this._last;
    if (L?.prev) {
      _dq.copy(L.cur.q).multiply(L.prev.q.clone().invert());
      if (_dq.w < 0) { _dq.x = -_dq.x; _dq.y = -_dq.y; _dq.z = -_dq.z; _dq.w = -_dq.w; }
      const ang = 2 * Math.acos(Math.min(1, _dq.w)), sn = Math.sqrt(Math.max(0, 1 - _dq.w * _dq.w));
      if (sn > 1e-6) w.set(_dq.x / sn, _dq.y / sn, _dq.z / sn).multiplyScalar(ang / L.cur.dt * (o.keep ?? 0.5));
      v.subVectors(L.cur.p, L.prev.p).divideScalar(L.cur.dt).add(_dw.copy(w).cross(_dr.copy(c).applyQuaternion(qw)));
    }
    const [tSide, tUp] = o.toss ?? [0.9, 0.8];
    const side = new THREE.Vector3(o.side?.x ?? 1, 0, o.side?.z ?? 0).normalize();
    v.addScaledVector(side, tSide).addScaledVector(_UP, tUp);
    w.addScaledVector(_dn.crossVectors(_UP, side), o.spin ?? 5);
    scene.attach(g);
    this.onHead = false;
    this._body = { x, q: qw.clone(), v, w, c, rs, Iinv, ground, t: 0, still: 0, contact: false, rest: false, v0: v.clone(), w0: w.clone(), n: all.length };
    this._pose();
    return true;
  }

  /** Puts the helmet back on the head (original pose under the Head bone), visible; fall stopped. */
  reattach() {
    const h = this._home;
    h.parent.add(this.group);
    this.group.position.copy(h.p); this.group.quaternion.copy(h.q); this.group.scale.copy(h.s);
    this.group.visible = true;
    this.onHead = true;
    this._body = null; this._last = null;
  }

  /**
   * Highest point (world) aimed at by Maman's chin at the hug (Npc._hugTarget): on the head, the top of the ridge (one
   * vertex in four); fallen helmet, `mode` 'ridge': the same ridge put virtually back on the head, 'fur': the top of the
   * head's hair tips. Returns `out`, or null if there is no point.
   */
  topPoint(out, mode = 'ridge') {
    let top = -Infinity;
    if (this.onHead) {
      const pos = this.ridge.geometry.getAttribute('position');
      for (let i = 0; i < pos.count; i += 4) {
        _dv.fromBufferAttribute(pos, i).applyMatrix4(this.ridge.matrixWorld);
        if (_dv.y > top) { top = _dv.y; out.copy(_dv); }
      }
      return top > -Infinity ? out : null;
    }
    const h = this._home, head = h.parent;
    head.updateWorldMatrix(true, false);
    _dm.compose(h.p, h.q, h.s).premultiply(head.matrixWorld);
    if (mode === 'fur') {
      for (const p of this._fur) {
        _dv.copy(p).applyMatrix4(_dm);
        if (_dv.y > top) { top = _dv.y; out.copy(_dv); }
      }
    } else {
      _dm.multiply(this._ridgeM);
      const pos = this.ridge.geometry.getAttribute('position');
      for (let i = 0; i < pos.count; i += 4) {
        _dv.fromBufferAttribute(pos, i).applyMatrix4(_dm);
        if (_dv.y > top) { top = _dv.y; out.copy(_dv); }
      }
    }
    return top > -Infinity ? out : null;
  }

  /**
   * Ground gap (m): lowest point of the helmet (all vertices, world frame) minus the ground height under it. `ground(x, z)`:
   * defaults to the brain's. Used by `_settle` and for measurements.
   */
  groundGap(ground = (x, z) => this.cat.brain._groundAt(x, z)) {
    this.group.updateWorldMatrix(true, true);
    let best = { gap: Infinity, x: 0, y: 0, z: 0 };
    for (const m of this.meshes) {
      const pos = m.geometry.getAttribute('position');
      for (let i = 0; i < pos.count; i++) {
        _dv.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld);
        const gp = _dv.y - ground(_dv.x, _dv.z);
        if (gp < best.gap) best = { gap: gp, x: _dv.x, y: _dv.y, z: _dv.z };
      }
    }
    return best;
  }

  /** Group pose from the rigid body (centre of mass x, orientation q). */
  _pose() {
    const b = this._body;
    this.group.quaternion.copy(b.q);
    this.group.position.copy(b.c).applyQuaternion(b.q).negate().add(b.x);
  }

  /** Inverse inertia tensor in world frame applied to `u` (modified in place). */
  _iinv(u) {
    const b = this._body;
    return u.applyQuaternion(_dq.copy(b.q).invert()).applyMatrix3(b.Iinv).applyQuaternion(b.q);
  }

  /** Fall: substeps of at most DROP.step s, then rest (_settle). */
  _fall(dt) {
    const b = this._body, D = DROP;
    if (b.rest || !(dt > 0)) return;
    b.t += dt;
    const n = Math.max(1, Math.ceil(dt / D.step - 1e-9)), h = dt / n;
    for (let k = 0; k < n; k++) this._substep(h);
    this._pose();
    const slow = b.contact && b.v.length() < D.restV && b.w.length() < D.restW;
    b.still = slow ? b.still + dt : 0;
    if (b.still >= D.restT || b.t >= D.maxT) this._settle();
  }

  _substep(h) {
    const b = this._body, D = DROP;
    b.v.y -= D.g * h;
    b.v.multiplyScalar(Math.exp(-D.damp * h));
    if (b.contact) {
      const k = Math.exp(-D.dampGround * h);
      b.w.multiplyScalar(k); b.v.x *= k; b.v.z *= k;
    }
    b.x.addScaledVector(b.v, h);
    _dq.set(b.w.x, b.w.y, b.w.z, 0).multiply(b.q);
    b.q.set(b.q.x + _dq.x * 0.5 * h, b.q.y + _dq.y * 0.5 * h, b.q.z + _dq.z * 0.5 * h, b.q.w + _dq.w * 0.5 * h).normalize();
    // Contacts: points below the ground; normal (restitution) and friction impulses, point by point.
    const hits = [];
    let deepest = 0;
    for (const r of b.rs) {
      const rw = r.clone().applyQuaternion(b.q);
      const py = b.x.y + rw.y, gy = b.ground(b.x.x + rw.x, b.x.z + rw.z);
      if (py < gy) { hits.push(rw); deepest = Math.max(deepest, gy - py); }
    }
    b.contact = hits.length > 0;
    for (const rw of hits) {
      _dv.copy(b.w).cross(rw).add(b.v);
      const vn = _dv.y;
      if (vn >= 0) continue;
      const e = -vn > D.still ? D.bounce : 0;
      const kn = 1 + _UP.dot(this._iinv(_dn.copy(rw).cross(_UP)).cross(rw));
      const j = (-(1 + e) * vn) / kn;
      b.v.y += j;
      b.w.add(this._iinv(_dn.copy(rw).cross(_UP).multiplyScalar(j)));
      // Coulomb friction (tangent = sliding speed at the point).
      _dv.copy(b.w).cross(rw).add(b.v);
      _dt.set(_dv.x, 0, _dv.z);
      const vt = _dt.length();
      if (vt < 1e-6) continue;
      _dt.divideScalar(vt);
      const kt = 1 + _dt.dot(this._iinv(_dn.copy(rw).cross(_dt)).cross(rw));
      const jt = -Math.min(vt / kt, D.mu * j);
      b.v.addScaledVector(_dt, jt);
      b.w.add(this._iinv(_dn.copy(rw).cross(_dt).multiplyScalar(jt)));
    }
    b.x.y += deepest;
  }

  /** Rest: lowest point (all vertices) set DROP.gap m above the ground; no more movement. */
  _settle() {
    const b = this._body;
    b.v.set(0, 0, 0); b.w.set(0, 0, 0);
    this._pose();
    const low = this.groundGap(b.ground);
    b.x.y += DROP.gap - low.gap;
    this._pose();
    this.group.updateMatrixWorld(true);
    b.rest = true;
    b.restAt = b.t;
    b.gapBefore = low.gap;
  }

  /** Removes the helmet from the rig and frees geometries, materials and texture. */
  dispose() {
    this.group.removeFromParent();
    const geos = new Set(this.meshes.map((m) => m.geometry));
    geos.forEach((g) => g.dispose());
    this._materials.forEach((m) => m.dispose());
    this._texture.dispose();
  }
}

/** Shortcut: builds the helmet, stores it in `cat.helmet` and returns it. */
export function attachHelmet(cat) {
  cat.helmet = new Helmet(cat);
  return cat.helmet;
}
