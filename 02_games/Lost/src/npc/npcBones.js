import * as THREE from 'three';
import { color } from '../style/palette.js';

/** Bone and clip helpers shared by the parts of `Npc`. */

const _q = new THREE.Quaternion();

const _qp = new THREE.Quaternion();

/**
 * Uniform values of a coat (sRGB hex): `coat` → furCoat, `tip` → furTip, `coatLit` → furCoatLit × 0.45, `sheen` →
 * furSheen × 0.6; absent keys are not returned.
 */
export function coatUniforms({ coat, tip, coatLit, sheen } = {}) {
  const u = {};
  if (coat !== undefined) u.furCoat = color(coat);
  if (tip !== undefined) u.furTip = color(tip);
  if (coatLit !== undefined) u.furCoatLit = color(coatLit).multiplyScalar(0.45);
  if (sheen !== undefined) u.furSheen = color(sheen).multiplyScalar(0.6);
  return u;
}

/** Gives `bone` the world rotation `q` (its position does not change). */
export function setWorldQuaternion(bone, q) {
  bone.parent.getWorldQuaternion(_qp);
  bone.quaternion.copy(_qp.invert().multiply(q));
  bone.updateMatrixWorld(true);
}

/** Sets `bone` to the world rotation (axis, angle) applied to its starting rotation q0. */
export function rotateWorld(bone, axis, angle, q0) {
  bone.parent.getWorldQuaternion(_qp);
  _q.setFromAxisAngle(axis, angle);
  // q' = P⁻¹ · R · P · q0
  bone.quaternion.copy(q0).premultiply(_qp).premultiply(_q).premultiply(_qp.invert());
}
