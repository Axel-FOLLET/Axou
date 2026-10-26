import * as THREE from 'three';

/**
 * Accès nommé aux os du chat BlendSwap (85 os) et à leur pose de repos.
 * three.js retire les points des noms Blender : « Spine.001 » devient « Spine001 ».
 */
export class CatRig {
  constructor(gltfScene) {
    this.root = gltfScene;
    this.bones = new Map();
    this.rest = new Map();
    this.meshes = [];
    // Le GLB est exporté avec les pistes NLA actives : les transformations statiques des os
    // sont une pose mélangée. La vraie pose de repos est la pose de liaison du skin.
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
      if (!bone) console.warn('os introuvable :', name);
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

    this.controllerWeights = this._reassignControllerWeights();
  }

  /**
   * Le GLB donne des poids de peau aux contrôleurs IK de Blender (Foot_Back_IK_*, Knee_front_IK_L,
   * Tail_controller, Head_controller, Spine_controller_1/2 : mesuré, jusqu'à 50 % du poids d'un
   * sommet). Ces os racines ne bougent jamais ici : les sommets concernés restaient tirés vers la
   * pose de repos (patte arrière 8 à 11 cm sous l'os, bout de queue et tête à moitié figés).
   * On reporte chaque poids de contrôleur sur l'os déformant le plus pesant du même sommet,
   * sinon sur un os de repli proche du contrôleur.
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
        // Emplacement déformant le plus pesant du sommet.
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

  /** Remet un os dans sa pose de repos (utile avant une couche procédurale). */
  resetBone(bone) {
    const r = this.rest.get(bone.name);
    if (r) { bone.quaternion.copy(r.q); bone.position.copy(r.p); }
  }

  restQuaternion(bone) {
    return this.rest.get(bone.name)?.q ?? new THREE.Quaternion();
  }
}
