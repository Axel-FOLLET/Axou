/**
 * Camera of the sword cutscene: six shots, each defined by a start and a reason. Positions are in the scene's local
 * frame (`ctx.L.w(a, b, h)`: `a` from the boss to the stone, `b` to the right, `h` above the ground, metres).
 * Shot changes are cuts (a cutscene, not a camera move), always at a moment of action so the cut hides in it.
 *
 *  1. Notice. Low and behind the kitten, wide: the kitten in the foreground, the glowing stone, the boss looming
 *     behind it. Says where everything is before anything moves. Slow push-in.
 *  2. Run and wind-up. From the side, back far enough to hold the boss: he raises his brush at the left of the frame
 *     while the kitten crosses towards the stone. The brush must be seen coming before it falls.
 *  3. Impact. On the ground, close to the stone: the brush lands, the stone splits, the sword leaves. Shake.
 *  4. Flight. Wider and rising: the sword turns in the air while the kitten crouches and leaps into the frame.
 *  5. Catch. Profile of the mouth meeting the grip, in slow motion.
 *  6. Face. In front of the kitten, level with the eyes: sword in the mouth, narrowed eyes, still. Held to the end.
 */

import * as THREE from 'three';
import { DURATION, EVENTS, tAt } from './plan.js';

/**
 * Shot boundaries (story seconds) and vertical field of view (degrees) of each shot.
 * - `runStart`: second shot starts when the boss is about to move.
 * - `impactLead`: third shot starts this long before the impact so that the brush is seen falling.
 * - `flightStart`: fourth shot starts when the sword is up and the stone is behind.
 * - `catchLead`: fifth shot starts this long before the catch.
 * - `faceLead`: the face shot starts this long after the landing and holds to the end of the video.
 */
export const SHOTS = {
  runStart: 1.05,
  impactLead: 0.2,
  flightStart: EVENTS.impact + 0.6,
  catchLead: 0.3,
  faceLead: 0.9,
  fov: [52, 50, 42, 44, 38, 30],
};

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const out = { pos: new THREE.Vector3(), target: new THREE.Vector3(), fov: 40 };

const ease = (x) => { const c = Math.min(Math.max(x, 0), 1); return c * c * (3 - 2 * c); };

/** @returns {{pos: THREE.Vector3, target: THREE.Vector3, fov: number}} (shared object, read it at once) */
export function cameraAt(ctx, t, tau) {
  const { L, leap, sword, cat } = ctx;
  const S = SHOTS;
  const tFace = tAt(leap.tauLand + S.faceLead);
  const tImpactIn = tAt(EVENTS.impact - S.impactLead);
  const tFlight = tAt(S.flightStart);
  const tCatch = tAt(EVENTS.catch - S.catchLead);
  const tRun = tAt(S.runStart);
  const swordPos = _b.setFromMatrixPosition(sword.mesh.matrix);

  if (t < tRun) {
    const k = t / tRun;
    L.w(5.6 - 0.6 * k, 3.5 - 0.35 * k, 0.5, out.pos);
    L.w(-0.2, 0.2, 1.0, out.target);
    out.fov = S.fov[0];
  } else if (t < tImpactIn) {
    const k = (t - tRun) / (tImpactIn - tRun);
    L.w(2.2, -3.4, 0.6, out.pos);
    out.target.set(cat.root.position.x, cat.root.position.y + 0.3, cat.root.position.z);
    L.w(-0.8, 0.3, 1.2, _a);
    out.target.lerp(_a, 0.45 + 0.15 * k);
    out.fov = S.fov[1];
  } else if (t < tFlight) {
    const age = tau - EVENTS.impact;
    L.w(1.2, 1.5, 0.28, out.pos);
    L.w(-0.1, 0.05, 0.35, out.target);
    out.target.lerp(swordPos, ease(age / 0.35) * 0.8);
    out.fov = S.fov[2];
  } else if (t < tCatch) {
    L.w(1.6, -3.2, 0.7, out.pos);
    const head = cat.rig.head.getWorldPosition(_a);
    out.target.copy(swordPos).lerp(head, 0.45);
    out.fov = S.fov[3];
  } else if (t < tFace) {
    // Mouth at the catch, seen from the kitten's side: framed on the catch point and the kitten just behind it.
    const C = cat.rig.head.getWorldPosition(_a);
    const yaw = ctx.catchYaw;
    const sx = Math.cos(yaw);
    const sz = -Math.sin(yaw);
    const fx = Math.sin(yaw);
    const fz = Math.cos(yaw);
    out.pos.set(C.x + sx * 1.5 - fx * 0.1, C.y + 0.05, C.z + sz * 1.5 - fz * 0.1);
    out.target.set(C.x - fx * 0.25, C.y - 0.05, C.z - fz * 0.25);
    out.fov = S.fov[4];
  } else {
    // Face: in front of the kitten (live head and heading), level with the eyes, creeping in.
    const k = (t - tFace) / (DURATION - tFace);
    const H = cat.rig.head.getWorldPosition(_a);
    const yaw = ctx.endYaw;
    const d = 0.8 - 0.1 * k;
    out.pos.set(H.x + Math.sin(yaw) * d + Math.cos(yaw) * 0.1, H.y - 0.03, H.z + Math.cos(yaw) * d - Math.sin(yaw) * 0.1);
    out.target.copy(H);
    out.fov = S.fov[5];
  }
  return out;
}
