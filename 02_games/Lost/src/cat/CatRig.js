
/**
 * Named access to the bones of the cat rig (85 bones) and to their rest pose. Used by Cat.js, Procedural.js and
 * Npc.js. three.js strips the dots from Blender names: `Spine.001` becomes `Spine001`.
 */
export class CatRig {
  constructor(gltfScene) {
    this.root = gltfScene;
    this.bones = new Map();
    this.rest = new Map();
    this.meshes = [];
    // The GLB is exported with active NLA tracks: static bone transforms are a blended pose.
    // The real rest pose is the skin's bind pose.
    gltfScene.traverse((o) => { if (o.isSkinnedMesh) o.skeleton.pose(); });
    gltfScene.updateMatrixWorld(true);
    gltfScene.traverse((o) => {
      if (o.isBone) {
        this.bones.set(o.name, o);
        this.rest.set(o.name, { q: o.quaternion.clone(), p: o.position.clone() });
      }
      if (o.isMesh) this.meshes.push(o);
    });

    const b = (name) => {
      const bone = this.bones.get(name.replace(/\./g, ''));
      if (!bone) console.warn('bone not found:', name);
      return bone;
    };
    this.spine = ['Spine', 'Spine.001', 'Spine.002', 'Spine.003', 'Spine.004'].map(b);
    this.neck = ['Neck', 'Neck.001', 'Neck.002'].map(b);
    this.head = b('Head');
    this.mouth = b('Mouth');
    this.earL = ['Ear', 'Ear.001', 'Ear.002'].map(b);
    this.earR = ['Ear.006', 'Ear.003', 'Ear.004'].map(b);
    this.tail = ['Tail', 'Tail.001', 'Tail.002', 'Tail.003', 'Tail.004', 'Tail.005', 'Tail.006', 'Tail.007'].map(b);
    this.hip = b('Hip');
    this.legs = {
      FL: { thigh: b('Thigh_front_L'), calf: b('Calf_Front_L'), foot: b('Foot_front_L2'), paw: b('Foot_front_L') },
      FR: { thigh: b('Thigh_front_R'), calf: b('Calf_Front_R'), foot: b('Foot_front_L2.002'), paw: b('Foot_front_R') },
      BL: { thigh: b('Thigh_Back_L'), calf: b('Calf_back_L'), foot: b('Foot_Back_L'), paw: b('Foot_Back_L2') },
      BR: { thigh: b('Thigh_Back_R'), calf: b('Calf_back_R'), foot: b('Foot_Back_R'), paw: b('Foot_Back_L2.002') },
    };

    this._reassignControllerWeights();
  }

  /**
   * The GLB gives skin weights to Blender's IK controllers (up to 50% of a vertex). These bones never move
   * here, which would pin skin to the rest pose (hind paw, tail tip, head), so each controller weight is moved
   * to the vertex's heaviest deforming bone, or else to a fallback bone close to the controller.
   * @returns {{vertices: number, fallbacks: number}} vertices touched and weights sent to a fallback bone
   */
  _reassignControllerWeights() {
    const fallback = {
      Foot_front_IK_L: 'Foot_front_L', Foot_front_IK_R: 'Foot_front_R',
      Foot_Back_IK_L: 'Foot_Back_L2', Foot_Back_IK_R: 'Foot_Back_L2002',
      Knee_front_IK_L: 'Calf_Front_L', Knee_front_IK_R: 'Calf_Front_R',
      Knee_back_IK_L: 'Calf_back_L', Knee_back_IK_R: 'Calf_back_R',
      Tail_controller: 'Tail007', Head_controller: 'Head',
      Spine_controller_1: 'Spine002', Spine_controller_2: 'Spine004',
    };
    const stats = { vertices: 0, fallbacks: 0 };
    for (const mesh of this.meshes) {
      if (!mesh.isSkinnedMesh) continue;
      const bones = mesh.skeleton.bones;
      const isCtrl = bones.map((bone) => bone.name in fallback);
      if (!isCtrl.some(Boolean)) continue;
      const indexOf = new Map(bones.map((bone, i) => [bone.name, i]));
      const si = mesh.geometry.getAttribute('skinIndex');
      const sw = mesh.geometry.getAttribute('skinWeight');
      let touched = false;
      for (let v = 0; v < si.count; v++) {
        let hasCtrl = false;
        for (let k = 0; k < 4; k++) if (sw.getComponent(v, k) > 0 && isCtrl[si.getComponent(v, k)]) hasCtrl = true;
        if (!hasCtrl) continue;
        stats.vertices++; touched = true;
        // Heaviest deforming slot of this vertex.
        let best = -1;
        for (let k = 0; k < 4; k++) {
          const w = sw.getComponent(v, k);
          if (w > 0 && !isCtrl[si.getComponent(v, k)] && (best < 0 || w > sw.getComponent(v, best))) best = k;
        }
        for (let k = 0; k < 4; k++) {
          const w = sw.getComponent(v, k);
          const bi = si.getComponent(v, k);
          if (w === 0 || !isCtrl[bi]) continue;
          if (best >= 0) {
            sw.setComponent(v, best, sw.getComponent(v, best) + w);
            sw.setComponent(v, k, 0);
          } else {
            const target = indexOf.get(fallback[bones[bi].name]);
            if (target !== undefined) { si.setComponent(v, k, target); stats.fallbacks++; }
          }
        }
      }
      if (touched) { si.needsUpdate = true; sw.needsUpdate = true; }
    }
    return stats;
  }

}

/** True if `o` is below `ancestor` in the scene graph. */
export function isDescendant(o, ancestor) {
  for (let p = o.parent; p; p = p.parent) if (p === ancestor) return true;
  return false;
}

/** Bone of the paw that touches the ground or holds an object (foot under the calf), otherwise the calf. */
export function pawHolder(leg) {
  return [leg.paw, leg.foot].find((b) => b && isDescendant(b, leg.calf)) ?? leg.calf;
}
