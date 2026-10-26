import * as THREE from 'three';

const _q = new THREE.Quaternion();
const _pq = new THREE.Quaternion();
const _e = new THREE.Euler();
const _v = new THREE.Vector3();
const _axis = new THREE.Vector3();
const _headPos = new THREE.Vector3();
const deg = THREE.MathUtils.degToRad;

/**
 * Formes de queue par situation, en degrés par os (os 0 = base, non touché), d'après l'étude
 * Stray (§ 8 du README) : basse en marche, enroulée au repos assis/couché, en crochet quand on
 * l'approche. pitch > 0 = vers l'arrière puis le bas ; yaw > 0 = vers la droite du chat.
 * `clip` : la queue est déjà posée par le clip du GLB (assis, couché, papouilles, sommeil…),
 * on n'ajoute qu'une ondulation discrète.
 */
const TAIL_MODES = {
  up:   { pitch: [0, 6, 6, 6, 6, 4, 2, 0],          yaw: [0, 0, 0, 0, 0, 0, 0, 0],      sway: 0.08, speed: 1 },
  low:  { pitch: [0, 32, 30, 25, 15, 0, -10, -10],  yaw: [0, 0, 0, 0, 0, 0, 0, 0],      sway: 0.05, speed: 1.3 },
  curl: { pitch: [0, 48, 46, 40, 30, 20, 12, 4],    yaw: [0, 14, 16, 16, 12, 6, 0, 0],  sway: 0.015, speed: 0.6 },
  hook: { pitch: [0, -4, -6, -10, -16, -20, -20, -14], yaw: [0, 0, 0, 0, 0, 0, 0, 0],   sway: 0.04, speed: 1.6 },
  back: { pitch: [0, 32, 30, 25, 12, 0, 0, 0],      yaw: [0, 0, 0, 0, 0, 0, 0, 0],      sway: 0.10, speed: 0.7 },
  clip: { pitch: [0, 0, 0, 0, 0, 0, 0, 0],          yaw: [0, 0, 0, 0, 0, 0, 0, 0],      sway: 0.03, speed: 0.8 },
  // Chasse (mission catgame_jeu, fiche 01b) : queue basse et raide à l'affût, seul le bout bouge
  // (coups de queue fréquents) ; plus basse encore au ras du sol pendant la préparation du bond,
  // bout qui fouette vite, oreilles qui frémissent. `flick` / `twitch` = intervalle (s) entre deux
  // coups de bout de queue / frémissements d'oreille, à la place des valeurs calmes (4-10 s, 2-7 s).
  stalk:  { pitch: [0, 60, 25, 10, 0, 0, 0, 0],       yaw: [0, 0, 0, 0, 0, 0, 0, 0],      sway: 0.015, speed: 1.2, flick: [0.8, 2.2] },
  crouch: { pitch: [0, 70, 25, 5, -10, -15, -20, -15], yaw: [0, 0, 0, 0, 0, 0, 0, 0],     sway: 0.06, speed: 2.2, flick: [0.25, 0.7], twitch: [0.35, 0.9] },
  // Clip de chasse présent dans le GLB : forme du clip, on n'ajoute que les coups de bout de queue.
  clipTip: { pitch: [0, 0, 0, 0, 0, 0, 0, 0],         yaw: [0, 0, 0, 0, 0, 0, 0, 0],      sway: 0.01, speed: 1, flick: [0.6, 1.8] },
};

/**
 * Couches procédurales appliquées après le mixer, en relatif : respiration, queue, oreilles,
 * tête qui suit un point avec tours de tête par à-coups.
 *
 * Les rotations « corps » sont exprimées dans le repère du chat (X à droite, Y en haut,
 * Z vers le museau) puis converties dans l'espace du parent de l'os : on n'a ainsi pas à
 * deviner l'orientation locale de chaque os Blender. Le repère du chat est donné chaque frame
 * par le quaternion monde du groupe `body`.
 */
export class Procedural {
  constructor(rig) {
    this.rig = rig;
    this.t = 0;
    this.lookTarget = null;
    this.lookWeight = 1;
    this.tailMode = 'up';
    this.focus = false;      // chasse : regard fixe sur la proie, pas de tours de tête ni de frémissements calmes
    this.breathRate = 2.2;   // rad/s
    this.breathAmp = 0.02;   // rad
    this._frameQ = new THREE.Quaternion();
    this._yaw = 0;
    this._pitch = 0;
    this._earTwitch = 0;
    this._nextTwitch = 2;
    this._earYaw = 0;
    this._gaze = { yaw: 0, pitch: 0, next: 1.5 };
    this._gazeCur = { yaw: 0, pitch: 0 };
    this._tailPitch = new Float32Array(8);
    this._tailYaw = new Float32Array(8);
    this._flick = 0;
    this._nextFlick = 5;
    this._phase = Math.random() * 10;
    // Valeur « sortie du mixer » de chaque os touché. L'AnimationMixer n'écrit un os que si sa
    // valeur a changé depuis la frame précédente : sans cette sauvegarde, nos rotations
    // relatives s'accumuleraient frame après frame (tête et queue qui partent en vrille).
    this._base = new Map();
  }

  _touch(bone) {
    if (!this._base.has(bone)) this._base.set(bone, bone.quaternion.clone());
  }

  /** Rotation dans l'espace local de l'os (oreilles). */
  _rotateLocal(bone, axis, angle) {
    this._touch(bone);
    _e.set(axis === 'x' ? angle : 0, axis === 'y' ? angle : 0, axis === 'z' ? angle : 0);
    bone.quaternion.multiply(_q.setFromEuler(_e));
  }

  /** Rotation autour d'un axe du repère du chat, appliquée à un os. */
  _rotateFrame(bone, axisFrame, angle) {
    if (!angle) return;
    this._touch(bone);
    bone.parent.getWorldQuaternion(_pq);
    _axis.copy(axisFrame).applyQuaternion(this._frameQ).applyQuaternion(_pq.invert());
    bone.quaternion.premultiply(_q.setFromAxisAngle(_axis, angle));
    bone.updateMatrixWorld(true);
  }

  /** À appeler avant `mixer.update` : remet les os touchés dans leur état post-mixer. */
  restore() {
    for (const [bone, q] of this._base) bone.quaternion.copy(q);
  }

  /** À appeler après `mixer.update` et `updateMatrixWorld` : couches relatives. `frame` = groupe `body`. */
  update(dt, frame) {
    for (const [bone, q] of this._base) q.copy(bone.quaternion);
    this.t += dt;
    frame.getWorldQuaternion(this._frameQ);
    const { rig } = this;
    const { RIGHT, UP, FORWARD } = Procedural;
    const t = this.t + this._phase;

    // Respiration : léger soulèvement du thorax (plus lente et plus ample en dormant).
    this._rotateFrame(rig.spine[2], RIGHT, Math.sin(t * this.breathRate) * this.breathAmp);

    // Queue : forme cible selon la situation, atteinte en douceur, plus une ondulation
    // irrégulière (deux sinus de fréquences non commensurables, enveloppe lente) et un
    // coup de queue occasionnel au bout.
    const mode = TAIL_MODES[this.tailMode] ?? TAIL_MODES.up;
    const kt = 1 - Math.exp(-3 * dt);
    this._nextFlick -= dt;
    const [f0, f1] = mode.flick ?? [4, 10];
    if (this._nextFlick > f1) this._nextFlick = f0 + Math.random() * (f1 - f0); // entrée en chasse
    if (this._nextFlick <= 0) { this._flick = 1; this._nextFlick = f0 + Math.random() * (f1 - f0); }
    const flick = this._flick > 0 ? Math.sin(this._flick * Math.PI) * 0.5 : 0;
    this._flick = Math.max(0, this._flick - dt * 2.5);
    const env = 0.65 + 0.35 * Math.sin(t * 0.37) * Math.sin(t * 0.11 + 1);
    rig.tail.forEach((bone, i) => {
      if (i === 0) return;
      this._tailPitch[i] += (deg(mode.pitch[i]) - this._tailPitch[i]) * kt;
      this._tailYaw[i] += (deg(mode.yaw[i]) - this._tailYaw[i]) * kt;
      const w = t * mode.speed;
      const wave = (Math.sin(w * 1.9 - i * 0.55) * 0.7 + Math.sin(w * 2.63 + 0.8 - i * 0.4) * 0.3) * mode.sway * env;
      this._rotateFrame(bone, FORWARD, wave + (i >= 5 ? flick * (i - 4) * 0.12 : 0));
      this._rotateFrame(bone, RIGHT, this._tailPitch[i]);
      this._rotateFrame(bone, UP, this._tailYaw[i]);
    });

    // Tête : suit le pointeur, angles limités, lissés ; en l'absence de cible proche, le regard
    // change par à-coups (petits tours de tête toutes les 1,5 à 4 s, comme un vrai chat).
    let yaw = 0;
    let pitch = 0;
    if (this.lookTarget) {
      rig.head.getWorldPosition(_headPos);
      _v.copy(this.lookTarget).sub(_headPos).applyQuaternion(_q.copy(this._frameQ).invert());
      yaw = Math.atan2(_v.x, _v.z);
      pitch = Math.atan2(_v.y, Math.hypot(_v.x, _v.z));
      yaw = THREE.MathUtils.clamp(yaw, -1.1, 1.1);
      pitch = THREE.MathUtils.clamp(pitch, -0.5, 0.6);
    }
    this._gaze.next -= dt;
    if (this.focus) { this._gaze.yaw = 0; this._gaze.pitch = 0; }
    else if (this._gaze.next <= 0) {
      this._gaze.next = 1.5 + Math.random() * 2.5;
      this._gaze.yaw = (Math.random() - 0.5) * 0.5;
      this._gaze.pitch = (Math.random() - 0.5) * 0.25;
    }
    const kg = 1 - Math.exp(-14 * dt); // à-coup : rapide
    this._gazeCur.yaw += (this._gaze.yaw - this._gazeCur.yaw) * kg;
    this._gazeCur.pitch += (this._gaze.pitch - this._gazeCur.pitch) * kg;
    const k = 1 - Math.exp(-6 * dt);
    this._yaw += ((yaw + this._gazeCur.yaw) * this.lookWeight - this._yaw) * k;
    this._pitch += ((pitch + this._gazeCur.pitch) * this.lookWeight - this._pitch) * k;
    const parts = [[rig.neck[1], 0.3], [rig.neck[2], 0.3], [rig.head, 0.4]];
    for (const [bone, w] of parts) {
      // Yaw : une rotation positive autour de Y amène +Z vers +X (vers la droite du chat).
      this._rotateFrame(bone, UP, this._yaw * w);
      // Pitch : lever le museau = rotation négative autour de X (règle de la main droite).
      this._rotateFrame(bone, RIGHT, -this._pitch * w);
    }

    // Oreilles : elles pivotent vers le pointeur avec un temps de retard, et frémissent parfois.
    const ke = 1 - Math.exp(-3 * dt);
    this._earYaw += (yaw * 0.4 * this.lookWeight - this._earYaw) * ke;
    this._rotateFrame(rig.earL[0], UP, this._earYaw);
    this._rotateFrame(rig.earR[0], UP, this._earYaw);
    // À l'affût (focus), oreilles fixes vers la proie ; à la préparation du bond, frémissements rapides.
    const twitch = mode.twitch ?? (this.focus ? null : [2, 7]);
    if (twitch) {
      this._nextTwitch = Math.min(this._nextTwitch, twitch[1]) - dt;
      if (this._nextTwitch <= 0) { this._earTwitch = 1; this._nextTwitch = twitch[0] + Math.random() * (twitch[1] - twitch[0]); }
    }
    if (this._earTwitch > 0) {
      const a = Math.sin(this._earTwitch * Math.PI) * 0.35;
      this._earTwitch = Math.max(0, this._earTwitch - dt * 4);
      this._rotateLocal(rig.earL[1], 'x', a);
      this._rotateLocal(rig.earR[1], 'x', -a * 0.4);
    }
  }
}

Procedural.RIGHT = new THREE.Vector3(1, 0, 0);
Procedural.UP = new THREE.Vector3(0, 1, 0);
Procedural.FORWARD = new THREE.Vector3(0, 0, 1);
Procedural.TAIL_MODES = TAIL_MODES;
