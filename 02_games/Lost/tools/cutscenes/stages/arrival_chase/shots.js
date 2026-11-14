/**
 * Camera of the chase: a table of shots (start, end, camera function), each with the reason for its angle and length
 * in the task sheet. Positions are given in Maman's frame at the shot's own clock: [left, up, ahead] in metres, with the
 * height taken either above the ground under the camera (`ground`) or above Maman's root (`maman`). A shot is a pure
 * function of the scene clock. The camera of the game (`world.camera`) is set here, every frame, just before the render.
 */
import * as THREE from 'three';
import { CHARTISTE, CLOCK, HAND } from './tuning.js';
import { smoothstep } from './ground.js';

const lerp = THREE.MathUtils.lerp;
const ease = (k) => smoothstep(0, 1, k);

/** Hash noise in -1..1 for the hand-held shake: smooth value noise of the clock, one channel per axis. */
function wobble(t, channel) {
  const x = t * 6 + channel * 17.3, i = Math.floor(x), f = x - i;
  const h = (n) => { const s = Math.sin(n * 127.1 + channel * 311.7) * 43758.5453; return (s - Math.floor(s)) * 2 - 1; };
  const u = f * f * (3 - 2 * f);
  return h(i) * (1 - u) + h(i + 1) * u;
}

export class Director {
  /**
   * @param {object} deps `world` (camera), `path`, `ground`, `blasts` (shake), `actors` (head, kitten), `stumbleRock`
   */
  constructor({ world, path, ground, blasts, actors }) {
    this.world = world;
    this.path = path;
    this.ground = ground;
    this.blasts = blasts;
    this.actors = actors;
    this.cam = new THREE.Vector3();
    this.look = new THREE.Vector3();
    this.fov = 40;
    this.roll = 0;
    this.shot = '';
    this.chartisteMid = new THREE.Vector3(
      actors.chartistePos.x, actors.chartistePos.y + CHARTISTE.scale * 0.42, actors.chartistePos.z);
    // The table: start, end, id, camera function.
    this.shots = [
      { id: 'front_close', from: 0, to: CLOCK.frontEnd, fn: (M, k, u) => this.frontClose(M, k, u) },
      { id: 'side_track', from: CLOCK.frontEnd, to: 8.0, fn: (M, k, u) => this.sideTrack(M, k, u) },
      { id: 'pull_reveal', from: 8.0, to: 13.5, fn: (M, k, u) => this.pullReveal(M, k, u) },
      { id: 'low_side', from: 13.5, to: 16.0, fn: (M, k, u) => this.lowSide(M, k, u) },
      { id: 'high_rear', from: 16.0, to: 18.5, fn: (M, k, u) => this.highRear(M, k, u) },
      { id: 'front_face', from: 18.5, to: 21.0, fn: (M, k, u) => this.frontFace(M, k, u) },
      { id: 'rear_rock', from: 21.0, to: 23.0, fn: (M, k, u) => this.rearRock(M, k, u) },
      { id: 'stumble_side', from: 23.0, to: 26.2, fn: (M, k, u, t) => this.stumbleSide(M, k, u, t) },
      { id: 'face_gaze', from: 26.2, to: 29.2, fn: (M, k, u) => this.faceGaze(M, k, u) },
      { id: 'blast_wide', from: 29.2, to: 32.4, fn: (M, k, u) => this.blastWide(M, k, u) },
      { id: 'flee_high', from: 32.4, to: CLOCK.duration, fn: (M, k, u) => this.fleeHigh(M, k, u) },
    ];
  }

  /** Frame of Maman at time t: root, heading, axes, plus the live head when `t` is the present clock. */
  frameAt(t) {
    const p = this.path.at(t);
    const P = new THREE.Vector3(p.x, this.ground.heightAt(p.x, p.z), p.z);
    return {
      t, P, yaw: p.yaw,
      f: new THREE.Vector3(Math.sin(p.yaw), 0, Math.cos(p.yaw)),
      l: new THREE.Vector3(Math.cos(p.yaw), 0, -Math.sin(p.yaw)),
    };
  }

  /** Point at [left, up, ahead] of the frame; `mode` 'maman' measures up from her root, 'ground' from the ground there. */
  rel(M, left, up, ahead, mode = 'maman') {
    const x = M.P.x + M.l.x * left + M.f.x * ahead, z = M.P.z + M.l.z * left + M.f.z * ahead;
    return new THREE.Vector3(x, (mode === 'ground' ? this.ground.heightAt(x, z) : M.P.y) + up, z);
  }

  /** Sets the camera of the game for clock t. */
  frame(t) {
    const shot = this.shots.find((s) => t >= s.from && t < s.to) ?? this.shots[this.shots.length - 1];
    this.shot = shot.id;
    const u = t - shot.from, k = THREE.MathUtils.clamp(u / (shot.to - shot.from), 0, 1);
    const M = this.frameAt(t);
    this.roll = 0;
    shot.fn(M, k, u, t);

    // Hand-held feel and the shake of the blasts.
    const hand = this.shot === 'high_rear' || this.shot === 'flee_high' ? HAND.far : HAND.near;
    const shake = this.blasts.shake(t, this.cam);
    const cam = this.world.camera;
    cam.position.set(
      this.cam.x + (hand + shake) * wobble(t, 1),
      this.cam.y + (hand + shake) * wobble(t, 2),
      this.cam.z + (hand + shake) * wobble(t, 3));
    cam.fov = this.fov;
    cam.updateProjectionMatrix();
    cam.up.set(0, 1, 0);
    cam.lookAt(this.look);
    cam.rotateZ(this.roll + 0.35 * shake * wobble(t, 4));
    cam.updateMatrixWorld(true);
  }

  headOf(M) {
    // The live head of Maman when the shot is on the present frame; this call is made after Actors.update.
    return this.actors.headPosition(new THREE.Vector3());
  }

  // ---- shots (reasons in the task sheet) ------------------------------------------------------------------------

  /** 0-5 s: close, from the front, the camera backs away at her speed; level with her eyes; slight roll that settles. */
  frontClose(M, k) {
    const e = ease(k);
    this.cam.copy(this.rel(M, lerp(0.0, 0.35, e), lerp(0.65, 0.75, e), lerp(1.7, 2.5, e)));
    this.look.copy(this.headOf(M));
    this.fov = lerp(30, 33, e);
    this.roll = lerp(0.07, 0, e);
  }

  /** 5-8 s: side track at her speed, a little ahead of her, so the first shells land across the frame behind her. */
  sideTrack(M, k) {
    const e = ease(k);
    this.cam.copy(this.rel(M, lerp(7.2, 8.6, e), 1.5, lerp(2.0, 3.4, e), 'ground'));
    this.look.copy(this.rel(M, 0, 0.45, 1.8));
    this.fov = 46;
  }

  /** 8-13.5 s: close on her face again, then the camera backs away and rises until the giant fills the top of the frame. */
  pullReveal(M, k, u) {
    const closeEnd = 1.4, pull = 4.1;
    if (u < closeEnd) {
      this.cam.copy(this.rel(M, -0.7, 0.55, lerp(2.4, 2.9, u / closeEnd)));
      this.look.copy(this.headOf(M));
      this.fov = 34;
      return;
    }
    const e = ease(THREE.MathUtils.clamp((u - closeEnd) / pull, 0, 1));
    this.cam.copy(this.rel(M, lerp(-0.7, -6, e), lerp(0.55, 7, e), lerp(2.9, 30, e)));
    const far = this.headOf(M).lerp(this.chartisteMid, Math.pow(e, 0.9) * 0.72);
    this.look.copy(far);
    this.fov = lerp(34, 38, e);
  }

  /** 13.5-16 s: ground level beside her, very wide, so the speed of the snow and the trees reads. */
  lowSide(M, k) {
    this.cam.copy(this.rel(M, lerp(-3.2, -3.7, k), 0.3, lerp(0.6, 2.2, k), 'ground'));
    this.look.copy(this.rel(M, 0, 0.42, 1.0));
    this.fov = 54;
    this.roll = -0.06;
  }

  /** 16-18.5 s: high behind her, looking down the slope: the barrage, the forest and the valley in one picture. */
  highRear(M, k) {
    this.cam.copy(this.rel(M, lerp(1.5, 2.5, k), lerp(6.5, 8.0, k), lerp(-9, -13, k)));
    this.look.copy(this.rel(M, 0, 0.2, 5));
    this.fov = 46;
  }

  /** 18.5-21 s: back to her face, closer than the first time and pushing in: her fear grows, the big blast bursts behind her head. */
  frontFace(M, k) {
    const e = ease(k);
    this.cam.copy(this.rel(M, lerp(-0.55, -0.3, e), 0.45, lerp(2.4, 1.5, e)));
    this.look.copy(this.headOf(M));
    this.fov = 31;
    this.roll = 0.03;
  }

  /** 21-23 s: low behind her, looking along her way; the rock she will catch her paw on shows ahead. */
  rearRock(M, k) {
    this.cam.copy(this.rel(M, lerp(0.8, 0.55, k), 0.3, lerp(-2.6, -1.7, k)));
    this.look.copy(this.rel(M, 0, 0.3, 6));
    this.fov = 42;
  }

  /**
   * 23-26.2 s: from her right, steady at the catch (the camera stops with her frame at the catch), then it rises after the
   * kitten for the first moment of its flight, so the viewer sees the throw and loses the kitten at the top of the frame.
   */
  stumbleSide(M, k, u, t) {
    const Mc = this.frameAt(Math.min(t, CLOCK.catch));
    this.cam.copy(this.rel(Mc, 4.4, 1.0, lerp(0.8, 1.6, k), 'ground'));
    const head = this.headOf(M);
    const kit = this.actors.kittenPosition(new THREE.Vector3());
    const follow = ease(THREE.MathUtils.clamp((t - CLOCK.release + 0.05) / 0.7, 0, 1)) * 0.85;
    this.look.copy(head).lerp(kit, follow);
    this.fov = 44;
  }

  /** 26.2-29.2 s: close on her face, level with her eyes; she looks up at the kitten, which the camera never shows. */
  faceGaze(M, k, u, t) {
    const Ms = this.frameAt(26.2);
    this.cam.copy(this.rel(Ms, lerp(-1.1, -0.8, ease(k)), 0.45, lerp(2.4, 1.8, ease(k))));
    this.look.copy(this.headOf(M));
    this.fov = 34;
    this.roll = 0.04;
  }

  /** 29.2-32.4 s: wide and low from her right, fixed: the violet blast, then she runs away to the left. */
  blastWide(M, k) {
    const Ms = this.frameAt(CLOCK.separation);
    this.cam.copy(this.rel(Ms, -10, 1.6, -3.2, 'ground'));
    this.look.copy(this.rel(Ms, 1.5, 1.2, 4.5));
    this.fov = 48;
  }

  /** 32.4-36 s: the crane rises and backs away as she grows small on the flank; the last blast flashes; then black. */
  fleeHigh(M, k) {
    const e = ease(k);
    this.cam.copy(this.rel(M, lerp(-8, -15, e), lerp(5, 21, e), lerp(-5, -13, e), 'ground'));
    this.look.copy(this.rel(M, 0, 0.5, 4));
    this.fov = lerp(44, 52, e);
  }
}

