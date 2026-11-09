import * as THREE from 'three';
import { COMBAT_CAM } from '../combat.js';

/** Camera framing helpers shared by the story scenes. */

const _ray = new THREE.Raycaster();

const _ra = new THREE.Vector3();

const _rd = new THREE.Vector3();

const _hits = [];

const _decorBoxes = new WeakMap();

/** Angle difference brought back between −π and π. */
export const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));

/**
 * Azimuths to try for a shot (COMBAT_CAM.plan.turnStep): `az` first, then further and further on each side, the `first`
 * side (+1 or −1) first, up to a half-turn.
 */
export function azimuthFan(az, first) {
  const step = COMBAT_CAM.plan.turnStep, out = [az];
  for (let a = step; a < Math.PI + 1e-6; a += step) out.push(az + first * a, az - first * a);
  return out;
}

/**
 * Line of sight on the real scenery meshes, for talkShot (`sight`): true if no mesh of `objects` (world.occluders: ruins,
 * roof included, and trees) cuts a → b. Prefilter by bounding box, both sides of faces (camera caught in a stone counts as
 * cut), Occlusion.js doubles ignored. Computed once, when a speech bubble opens.
 */
export function sightOn(objects) {
  return (a, b) => {
    _ra.set(a.x, a.y, a.z);
    const len = _rd.set(b.x - a.x, b.y - a.y, b.z - a.z).length();
    if (len < 1e-4) return true;
    _ray.set(_ra, _rd.divideScalar(len));
    _ray.far = len;
    for (const obj of objects) {
      let box = _decorBoxes.get(obj);
      if (!box) _decorBoxes.set(obj, (box = new THREE.Box3().setFromObject(obj)));
      if (!_ray.ray.intersectsBox(box)) continue;
      let hit = false;
      obj.traverse((m) => {
        if (hit || !m.isMesh || !m.material || m.userData.occGhost) return;
        const mats = Array.isArray(m.material) ? m.material : [m.material];
        const sides = mats.map((mat) => mat.side);
        for (const mat of mats) mat.side = THREE.DoubleSide;
        _hits.length = 0;
        m.raycast(_ray, _hits);
        mats.forEach((mat, i) => { mat.side = sides[i]; });
        hit = _hits.some((h) => h.distance <= len);
      });
      if (hit) return false;
    }
    return true;
  };
}
