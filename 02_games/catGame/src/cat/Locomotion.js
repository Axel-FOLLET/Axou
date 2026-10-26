import * as THREE from 'three';

const _dir = new THREE.Vector3();

/** Déplacement et orientation du groupe racine du chat vers un point du sol. */
export class Locomotion {
  constructor(root) {
    this.root = root;
    this.speed = 0.9;      // m/s
    this.turnRate = 4;     // rad/s
    this.arriveRadius = 0.12;
    this.heading = 0;      // angle autour de Y, 0 = +Z
    this.moving = false;
  }

  /** Avance d'un pas vers `target`. Retourne true à l'arrivée. */
  stepToward(target, dt) {
    _dir.copy(target).sub(this.root.position).setY(0);
    const dist = _dir.length();
    if (dist < this.arriveRadius) { this.moving = false; return true; }
    _dir.divideScalar(dist);

    const wanted = Math.atan2(_dir.x, _dir.z);
    let diff = wanted - this.heading;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    const step = Math.sign(diff) * Math.min(Math.abs(diff), this.turnRate * dt);
    this.heading += step;
    this.root.rotation.y = this.heading;

    // On n'avance franchement que lorsque le chat regarde à peu près vers la cible.
    const facing = Math.max(0, Math.cos(diff));
    const move = Math.min(dist, this.speed * facing * dt);
    this.root.position.x += Math.sin(this.heading) * move;
    this.root.position.z += Math.cos(this.heading) * move;
    this.moving = true;
    return false;
  }
}
