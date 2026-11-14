import * as THREE from 'three';
import { createArmorPiece } from '../cat/Armor.js';
import { heightAt as terrainHeightAt } from './Terrain.js';
import { OPENING } from '../game/story/tuning.js';

/**
 * The kitten's silver armour lying scattered in the meadow around the place where it is set down asleep
 * (`OPENING.drop`): simple scenery, as if the pieces had fallen off during the flight. Created by World.js
 * (`world.armorScatter`). No obstacle, no collision, no click target (meshes ignore the Raycaster), no grass removed.
 *
 * Each piece comes from `createArmorPiece` (cat/Armor.js), is rotated to lie more or less flat, and is lowered until its
 * lowest vertex touches the ground. Placement is a fixed table (no random value): the same game always shows the same
 * scene.
 *
 * Interface: `new ArmorScatter(parent, { heightAt })`; `scatter.group`, `scatter.pieces` (`{ name, group }`),
 * `scatter.setVisible(on)`, `scatter.dispose()`.
 */

/**
 * Pieces on the ground. `angle` (rad, 0 = +X, towards +Z) and `dist` (m) place a piece around `OPENING.drop`; the
 * kitten lies within about 0.3 m of it, so `dist` starts beyond. `yaw` (rad): turn about the vertical; `tilt` (rad): lean
 * from lying flat, towards the direction `lean` (rad, 0 = +X, towards +Z), as if propped on a tuft; `flip`: lies on its
 * other face (inside up).
 */
export const SCATTER = [
  { name: 'breastplate', angle: 2.73, dist: 0.68, yaw: 0.6, tilt: 0.22, lean: 0.4, flip: false },
  { name: 'pauldron_L', angle: -0.38, dist: 0.59, yaw: 2.2, tilt: 0.3, lean: 2.0, flip: false },
  { name: 'pauldron_R', angle: -0.7, dist: 0.8, yaw: -0.8, tilt: 0.25, lean: 1.2, flip: true },
  { name: 'backplate', angle: 0.38, dist: 0.81, yaw: 1.1, tilt: 0.2, lean: 3.4, flip: false },
  { name: 'backlame_1', angle: 1.9, dist: 0.6, yaw: -0.3, tilt: 0.3, lean: 0.9, flip: true },
  { name: 'backlame_2', angle: -1.3, dist: 0.5, yaw: 0.2, tilt: 0.15, lean: 5.0, flip: false },
  { name: 'backlame_3', angle: 1.3, dist: 0.95, yaw: 2.6, tilt: 0.28, lean: 2.6, flip: false },
  { name: 'tailguard_1', angle: 2.96, dist: 0.46, yaw: 0.4, tilt: 0, lean: 0, flip: false },
  { name: 'tailguard_2', angle: -0.45, dist: 0.7, yaw: 1.9, tilt: 0, lean: 0, flip: false },
];

const SINK = 0.004; // m: lowest vertex slightly under the ground, so the plate rests in the short grass

/**
 * Orientation of a piece lying flat: the outward face up (`flip`: down). Pieces are built in the bind frame of the cat
 * (+Y up on the back, +Z towards the muzzle, +X to the left of the cat).
 */
function lyingQuaternion(name, flip) {
  const q = new THREE.Quaternion();
  if (name === 'breastplate') q.setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));          // front (+Z) up
  else if (name === 'pauldron_L') q.setFromAxisAngle(new THREE.Vector3(0, 0, 1), 1.29);      // outer face (about +X) up
  else if (name === 'pauldron_R') q.setFromAxisAngle(new THREE.Vector3(0, 0, 1), -1.29);
  else if (name.startsWith('tailguard')) q.setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2); // on its side
  if (flip) q.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI));
  return q;
}

export class ArmorScatter {
  /**
   * @param {THREE.Object3D} parent where the group is added (the meadow zone)
   * @param {object} [options] `heightAt(x, z)`: ground height (default: Terrain.js)
   */
  constructor(parent, { heightAt = terrainHeightAt } = {}) {
    this.group = new THREE.Group();
    this.group.name = 'ArmorScatter';
    this._items = [];
    const _v = new THREE.Vector3();
    for (const s of SCATTER) {
      const item = createArmorPiece(s.name);
      const x = OPENING.drop.x + Math.cos(s.angle) * s.dist;
      const z = OPENING.drop.z + Math.sin(s.angle) * s.dist;
      const g = item.group;
      const lean = new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(-Math.sin(s.lean), 0, Math.cos(s.lean)), s.tilt);
      g.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), s.yaw).multiply(lean).multiply(lyingQuaternion(s.name, s.flip));
      g.position.set(x, 0, z);
      g.updateMatrixWorld(true);
      // Lowest vertex of the piece, then the piece is lowered onto the ground under that point.
      let low = { y: Infinity, x, z };
      for (const m of item.group.children) {
        const pos = m.geometry.getAttribute('position');
        for (let i = 0; i < pos.count; i++) {
          _v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld);
          if (_v.y < low.y) low = { y: _v.y, x: _v.x, z: _v.z };
        }
      }
      g.position.y += heightAt(low.x, low.z) - low.y - SINK;
      this.group.add(g);
      this._items.push(item);
    }
    this.pieces = this._items.map((it) => ({ name: it.name, group: it.group }));
    parent.add(this.group);
  }

  /** Shows or hides every piece (a cutscene that wants the bare meadow). */
  setVisible(visible) { this.group.visible = !!visible; }

  /** Removes the group from the scene and frees geometries and materials. */
  dispose() {
    this.group.removeFromParent();
    this._items.forEach((it) => it.dispose());
    this._items.length = 0;
    this.pieces = [];
  }
}
