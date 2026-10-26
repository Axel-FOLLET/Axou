import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CatRig } from './CatRig.js';
import { Procedural } from './Procedural.js';
import { Locomotion } from './Locomotion.js';
import { Brain, PLAY, PET_PADDLE } from './Brain.js';
import { Fur } from './Fur.js';
import { Eyes } from './Eyes.js';
import { attachHelmet } from './Helmet.js';

const CAT_LENGTH = 0.8; // mètres, museau → bout de la queue
// Marche : un pied posé recule de 3,2 unités du rig pendant son appui, soit 0,67 du cycle
// (`tools/anim_cat.py`, WALK_STRIDE et WALK_DUTY) : le sol défile de 3,2 / 0,67 unités par cycle. La
// vitesse de déplacement en découle, sinon les pattes glissent (avec 3,2 seul : pied posé qui recule
// d'≈ 0,25 m/s au sol, mesuré par pose_preview.mjs walk, A2 2026-10-23).
const WALK_STRIDE = 3.2 / 0.67; // unités du rig par cycle (était 3,2 : recul pendant l'appui seul)
const WALK_RATE = 1.25; // lecture du clip Walk (1 s) : cycle de 0,8 s (mouvement_stray.md § 2.1 ; était 1,4)
// Affût (clip `Stalk`, cycle) : même principe que la marche. Valeurs proposées par la fiche 01b
// (pas ≈ 0,6 × 3,2 unités, appui 0,8 du cycle) : à remplacer par les constantes réelles de
// `anim_cat.py` quand A aura livré le clip (demande notée dans la fiche 05).
const STALK_STRIDE = (0.6 * 3.2) / 0.8; // unités du rig par cycle
const STALK_RATE = 1;                    // lecture du clip Stalk
// Repli tant que le GLB n'a pas `Stalk` : `Walk` lu au ralenti, vitesse au sol réduite d'autant.
const STALK_FALLBACK_RATE = 0.5;
// Clic au sol pendant les papouilles (mission catgame_style, fiche 05 point b) : fondu court du clip
// `Pet` vers `Walk` / `run`, sans attendre la fin du clip (0,25 s pour une marche ordinaire).
const PET_EXIT_FADE = 0.2;
// Yeux mi-clos de contentement pendant le frottement des papouilles (fenêtre PET_PADDLE du clip
// `Pet`, 3,0 à 7,0 s ; fiche 05 phase 2) : paupière à PET_LID (0 = ouverte, 1 = fermée, Eyes.setLid).
// Rapprochement exponentiel : fermeture lente (≈ 1 s pour 95 %), réouverture vive au relever ou au
// clic au sol (≈ 0,3 s).
const PET_LID = 0.6;
const LID_CLOSE_RATE = 3;
const LID_OPEN_RATE = 10;
const _v = new THREE.Vector3();
const _w = new THREE.Vector3();
// Inclinaison du corps sur la pente (mission catgame_monde, D) : `body` tourne de TILT.gain × l'angle
// du sol, mesuré par différences de hauteur à ±TILT.ahead m devant / derrière et ±TILT.side m sur
// les côtés de la racine ; rapprochement exponentiel (TILT.rate, 1/s). À plat sur un muret et pendant
// un saut (la pente du terrain n'y a pas de sens).
const TILT = { gain: 0.6, ahead: 0.25, side: 0.1, rate: 5, max: 0.25 };

/**
 * Clips attendus dans le GLB (produits par `tools/anim_cat.py`, 24 i/s, tous les os cuits).
 * `loop` : cycle ; sinon joué une fois et tenu sur la dernière image.
 * `hold` : instant (s) où la pose tenue est atteinte ; le clip joué à l'envers depuis cet
 * instant sert de relever (assis → debout, couché → assis → debout).
 * `fallback` : clip joué à la place tant que le GLB ne contient pas celui-ci (pas d'erreur).
 */
const CLIPS = {
  Idle: { loop: true }, Walk: { loop: true }, run: { loop: true },
  Sit: { hold: 1.2 }, Lie: { hold: 2.0 /* LIE_SETTLE atteint, ACTIONS Lie d'anim_cat.py */ }, Sleep: { hold: 3.8 /* boule CURL atteinte, ACTIONS Sleep d'anim_cat.py */ },
  Pet: {}, Wake: {}, Stretch: {}, Groom: {},
  // Chasse (mission catgame_jeu) : affût en cycle, bond joué une fois (instants dans Brain.js, POUNCE).
  Stalk: { loop: true, fallback: 'Walk' }, Pounce: { fallback: 'Idle' },
  // Murets (mission catgame_monde) : clips sur place, racine montée et avancée par Brain.js (JUMP).
  Jump: { fallback: 'Idle' }, JumpDown: { fallback: 'Idle' },
};

/**
 * Façade du chat : chargement du GLB, mixer, couches procédurales, locomotion et cerveau.
 *
 * Hiérarchie : root (position/cap au sol) > body (hauteur) > modèle. Toutes les poses, y
 * compris le chat couché sur le flanc des papouilles ou la boule de sommeil, viennent des clips du
 * GLB (roulis porté par l'os `Root` du rig) : plus aucune rotation rigide du corps ici.
 * Un contact au sol recalcule chaque frame la hauteur de `body` à partir du point le plus bas
 * du maillage déformé (sécurité : les clips sont déjà posés au sol dans Blender).
 */
export class Cat {
  static async load(url) {
    const gltf = await new GLTFLoader().loadAsync(url);
    return new Cat(gltf);
  }

  constructor(gltf) {
    this.root = new THREE.Group();
    this.body = new THREE.Group();
    this.model = gltf.scene;
    this.root.add(this.body);
    this.body.add(this.model);

    this.rig = new CatRig(this.model);
    this.meshes = this.rig.meshes;
    this.meshes.forEach((m) => { m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; });

    this._fit();
    // Coques de fourrure sur le corps seulement (les yeux restent nus) ; hors de `meshes` :
    // ni clic, ni contact au sol.
    const furBody = this.meshes.find((m) => m.name === 'CatBody') ?? this.meshes[0];
    const eyes = this.meshes.filter((m) => m !== furBody && m.isSkinnedMesh);
    this.fur = new Fur(furBody, eyes);
    this.eyes = new Eyes(eyes);
    this._time = 0;

    this.mixer = new THREE.AnimationMixer(this.model);
    this.clips = {};
    for (const clip of gltf.animations) this.clips[clip.name] = clip;
    // Un seul avertissement pour tous les clips manquants (les clips de chasse ont un repli).
    const missing = Object.keys(CLIPS).filter((name) => !this.clips[name])
      .map((name) => (CLIPS[name].fallback ? `${name} (repli ${CLIPS[name].fallback})` : name));
    if (missing.length) console.warn('clip absent du GLB :', missing.join(', '));
    this.actions = {};
    for (const [name, clip] of Object.entries(this.clips)) {
      const a = this.mixer.clipAction(clip);
      a.enabled = true;
      a.setEffectiveWeight(0);
      a.play();
      if (!CLIPS[name]?.loop) a.setLoop(THREE.LoopOnce, 1).clampWhenFinished = true;
      this.actions[name] = a;
    }
    this.actions.Idle.setEffectiveWeight(1);
    this.current = this.actions.Idle;

    this.pivotY = this.height * 0.42;
    this.model.position.y -= this.pivotY;
    this.body.position.y = this.pivotY;
    this._lift = null;
    this.debug = { minY: 0, lift: 0 };

    this.procedural = new Procedural(this.rig);
    this.locomotion = new Locomotion(this.root);
    if (this.duration('Walk')) this.locomotion.speed = WALK_STRIDE * this.model.scale.x * WALK_RATE / this.duration('Walk');
    this.walkSpeed = this.locomotion.speed;
    // Vitesse d'affût : depuis le clip `Stalk` s'il existe, sinon `Walk` au ralenti (même calcul).
    if (this.duration('Stalk')) this.stalkSpeed = STALK_STRIDE * this.model.scale.x * STALK_RATE / this.duration('Stalk');
    else this.stalkSpeed = this.walkSpeed * STALK_FALLBACK_RATE / WALK_RATE;
    this._rate = 1;           // vitesse de lecture du clip courant (affût figé = 0)
    this.brain = new Brain(this);
    this.onState = null;      // callback (state) pour l'extérieur (sons, HUD)
    this._state = 'idle';
    this._standUpLeft = 0;    // secondes restantes du relever joué à l'envers
    this._tailBase = 'up';
    // Casque (src/cat/Helmet.js, lot H) : enfant de l'os Head, hors de `meshes` (ni contact au
    // sol ni clic direct : Picker passe par `helmet.hit`). Une erreur de construction ne bloque pas le jeu.
    try { attachHelmet(this); } catch (e) { console.warn('casque non construit :', e); this.helmet = null; }
  }

  /** État courant du cerveau (essais : `__cat.state`). */
  get state() { return this.brain.state; }

  /** Met le modèle à l'échelle d'un vrai chat, posé au sol, museau vers +Z. */
  _fit() {
    this.model.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(this.model);
    const size = box.getSize(new THREE.Vector3());
    const longest = Math.max(size.x, size.z);
    const s = CAT_LENGTH / longest;
    this.model.scale.setScalar(s);
    this.model.updateMatrixWorld(true);
    box.setFromObject(this.model);
    const center = box.getCenter(new THREE.Vector3());
    this.model.position.set(-center.x, -box.min.y, -center.z);

    // Oriente le museau vers +Z : la tête doit être devant la hanche.
    const head = this.rig.head.getWorldPosition(new THREE.Vector3());
    const hip = this.rig.hip.getWorldPosition(new THREE.Vector3());
    const forward = head.clone().sub(hip).setY(0);
    const angle = Math.atan2(forward.x, forward.z);
    this.model.rotation.y = -angle;
    this.model.updateMatrixWorld(true);
    box.setFromObject(this.model);
    this.model.position.x -= (box.min.x + box.max.x) / 2;
    this.model.position.z -= (box.min.z + box.max.z) / 2;
    this.model.position.y -= box.min.y;
    this.height = size.y * s;
  }

  /** Durée (s) d'un clip du GLB, 0 s'il manque. */
  duration(name) { return this.clips[name]?.duration ?? 0; }

  /** Fondu enchaîné vers un clip ; `from` = instant de départ (relever joué à l'envers avec timeScale −1). */
  play(name, fade = 0.3, timeScale = 1, from = null) {
    const next = this.actions[name];
    if (!next) return;
    if (next === this.current) {
      // Même clip (relever à l'envers depuis la pose tenue) : on change l'instant et le sens
      // sans fondu, sinon le poids repart de 0 et la pose de repos apparaît une fraction de seconde.
      if (from !== null) next.time = from;
      next.paused = false;
      next.setEffectiveTimeScale(timeScale);
      return;
    }
    next.reset();
    if (from !== null) next.time = from;
    next.setEffectiveTimeScale(timeScale).setEffectiveWeight(1).fadeIn(fade);
    this.current.fadeOut(fade);
    this.current = next;
  }

  /** Relever depuis une pose tenue : le clip d'installation est rejoué à l'envers. */
  _standUp(clipName) {
    const hold = CLIPS[clipName]?.hold;
    if (!hold || !this.actions[clipName]) { this.play('Idle', 0.5); return; }
    this.play(clipName, 0.3, -1, hold);
    this._standUpLeft = hold;
  }

  onStateChange(state) {
    const p = this.procedural;
    const prev = this._state;
    this._state = state;
    this._standUpLeft = 0;
    p.breathRate = 2.2; p.breathAmp = 0.02;
    p.focus = false;
    this._rate = 1;
    this.locomotion.speed = this.walkSpeed;
    this.locomotion.turnRate = 4;
    switch (state) {
      case 'walk': this.play('Walk', prev === 'pet' ? PET_EXIT_FADE : 0.25, WALK_RATE); p.lookWeight = 0.5; this._tailBase = 'low'; break;
      // Clic au sol loin (Brain, GOTO) : même course que pour la pelote, sans fixer le regard.
      case 'run':
        this.locomotion.speed = PLAY.runSpeed;
        this.locomotion.turnRate = 6;
        p.lookWeight = 0.5; this._tailBase = 'low';
        if (this.actions.run) this.play('run', prev === 'pet' ? PET_EXIT_FADE : 0.2);
        else { this._rate = 2; this.play('Walk', prev === 'pet' ? PET_EXIT_FADE : 0.2, 2); }
        break;
      // Chasse : le chat marche vers le papillon repéré, puis passe à l'affût, puis bondit.
      case 'approach': this._rate = WALK_RATE; this.play('Walk', 0.25, WALK_RATE); p.lookWeight = 0.8; p.focus = true; this._tailBase = 'low'; break;
      case 'stalk':
        this.locomotion.speed = this.stalkSpeed;
        this.locomotion.turnRate = 2;
        p.lookWeight = 0.6; p.focus = true;
        if (this.actions.Stalk) { this._rate = STALK_RATE; this.play('Stalk', 0.4, STALK_RATE); this._tailBase = 'clipTip'; }
        else { this._rate = STALK_FALLBACK_RATE; this.play('Walk', 0.4, STALK_FALLBACK_RATE); this._tailBase = 'stalk'; }
        break;
      case 'pounce':
        p.lookWeight = 0.4; p.focus = true;
        if (this.actions.Pounce) { this.play('Pounce', 0.2); this._tailBase = 'clipTip'; }
        else { this.play('Idle', 0.3); this._tailBase = 'crouch'; }
        break;
      // Pelote : course (clip `run` de l'asset d'origine ; vitesse PLAY.runSpeed, foulée non mesurée),
      // puis poussée et courte pause sur le cycle de repos, regard et queue tendus vers elle.
      case 'chase':
        this.locomotion.speed = PLAY.runSpeed;
        this.locomotion.turnRate = 6;
        p.lookWeight = 0.8; p.focus = true; this._tailBase = 'low';
        if (this.actions.run) this.play('run', 0.2);
        else { this._rate = 2; this.play('Walk', 0.2, 2); }
        break;
      case 'bat': this.play('Idle', 0.2); p.lookWeight = 1; p.focus = true; this._tailBase = 'crouch'; break;
      case 'pet': this.play('Pet', 0.4); p.lookWeight = 0.2; this._tailBase = 'clip'; break;
      case 'sit': this.play('Sit', 0.5); p.lookWeight = 1; this._tailBase = 'clip'; break;
      case 'lie': this.play('Lie', 0.5); p.lookWeight = 0.7; this._tailBase = 'clip'; break;
      case 'stretch': this.play('Stretch', 0.3); p.lookWeight = 0; this._tailBase = 'clip'; break;
      case 'groom': this.play('Groom', 0.4); p.lookWeight = 0; this._tailBase = 'clip'; break;
      case 'sleep': this.play('Sleep', 0.8); p.lookWeight = 0; this._tailBase = 'clip'; p.breathRate = 1.1; p.breathAmp = 0.035; break;
      case 'wake': this.play('Wake', 0.4); p.lookWeight = 0.5; this._tailBase = 'clip'; break;
      // Murets : montée (clip `Jump`) et descente (clip `JumpDown`) ; racine déplacée par Brain.
      case 'jump': this.play(this.actions.Jump ? 'Jump' : 'Idle', 0.15); p.lookWeight = 0.3; this._tailBase = 'clip'; break;
      case 'jumpdown': this.play(this.actions.JumpDown ? 'JumpDown' : 'Idle', 0.15); p.lookWeight = 0.3; this._tailBase = 'clip'; break;
      default:
        p.lookWeight = 1; this._tailBase = 'up';
        if (prev === 'sit') this._standUp('Sit');
        else if (prev === 'lie') this._standUp('Lie');
        else this.play('Idle', 0.5);
    }
    this.onState?.(state);
  }

  /** Nouveau clic pendant les papouilles : Brain ramène le clip `Pet` au début du frottement sur le flanc (instant `t`). */
  onPetTime(t) { this.actions.Pet.time = t; }

  /** Affût figé (Brain) : le clip courant s'arrête sur place, puis reprend à sa vitesse. */
  freeze(frozen) { this.current.setEffectiveTimeScale(frozen ? 0 : this._rate); }

  /** Clip de chasse présent dans le GLB (sinon repli, voir CLIPS). */
  hasClip(name) { return !!this.actions[name]; }

  /** Point au sol entre les deux pattes avant (repère monde) : là où le bond retombe. */
  pawPoint(out = new THREE.Vector3()) {
    this.rig.legs.FL.paw.getWorldPosition(out);
    this.rig.legs.FR.paw.getWorldPosition(_w);
    return out.add(_w).multiplyScalar(0.5).setY(this.root.position.y);
  }

  /** Paupières : mi-closes tant que le clip `Pet` est dans la fenêtre du frottement, ouvertes sinon. */
  _updateLids(dt) {
    const pet = this.actions.Pet;
    const t = pet ? pet.time : -1;
    const target = this.brain.state === 'pet' && t >= PET_PADDLE[0] && t <= PET_PADDLE[1] ? PET_LID : 0;
    const lid = this.eyes.getLid();
    if (lid === target) return;
    const rate = target > lid ? LID_CLOSE_RATE : LID_OPEN_RATE;
    let next = lid + (target - lid) * (1 - Math.exp(-rate * dt));
    if (Math.abs(next - target) < 1e-3) next = target;
    this.eyes.setLid(next);
  }

  /** Point le plus bas du maillage déformé, en repère monde (un sommet sur trois). */
  _lowestVertexY() {
    let minY = Infinity;
    for (const m of this.meshes) {
      m.skeleton.update();
      const n = m.geometry.getAttribute('position').count;
      for (let i = 0; i < n; i += 3) {
        m.getVertexPosition(i, _v).applyMatrix4(m.matrixWorld);
        if (_v.y < minY) minY = _v.y;
      }
    }
    return minY;
  }

  update(dt, world, pointerWorld) {
    this._time += dt;
    this.fur.update(this._time);
    if (world && this.brain.world !== world) this.brain.setWorld(world);
    this.brain.update(dt);
    this._updateTilt(dt);
    this.procedural.restore();
    this.mixer.update(dt);
    this._updateLids(dt);
    this.helmet?.update(dt);

    // Fin du relever joué à l'envers : retour au cycle de repos.
    if (this._standUpLeft > 0) {
      this._standUpLeft -= dt;
      if (this._standUpLeft <= 0) this.play('Idle', 0.3);
    }

    // Queue en crochet quand le pointeur approche de la tête (chat calme seulement).
    let tail = this._tailBase;
    if (pointerWorld && (this.brain.state === 'idle' || this.brain.state === 'sit')) {
      this.rig.head.getWorldPosition(_v);
      if (_v.distanceTo(pointerWorld) < 0.55) tail = 'hook';
    }
    this.procedural.tailMode = tail;
    // Pendant la chasse ou le jeu, la tête suit la proie ou la pelote plutôt que le pointeur.
    this.procedural.lookTarget = this.brain.lookAt ?? pointerWorld;
    this.root.updateMatrixWorld(true);
    this.procedural.update(dt, this.body);

    // Contact au sol : le point le plus bas du maillage est ramené à la hauteur de la racine (sol du
    // terrain ou dessus d'un muret, posée par Brain), vite en montée
    // (on ne traverse pas le sol), plus doucement en descente (pas de secousse).
    const minY = this._lowestVertexY();
    const target = (this._lift ?? 0) - (minY - this.root.position.y) + 0.004;
    if (this._lift === null) this._lift = target;
    else if (this.brain.pouncing || this.brain.jumping) {
      // En l'air pendant le bond ou un saut de muret : le contact au sol ne doit pas aplatir le saut
      // du clip (pendant un saut de muret, la hauteur vient de la racine, Brain._updateJump).
    } else {
      // En marche, le cycle importé fait frôler le sol aux pattes : on redescend très lentement
      // pour ne pas faire sautiller le chat.
      const s = this.brain.state;
      const down = s === 'walk' || s === 'run' || s === 'approach' || s === 'stalk' || s === 'chase' ? 2 : 10;
      this._lift += (target - this._lift) * (1 - Math.exp(-(target > this._lift ? 30 : down) * dt));
    }
    this.body.position.y = this.pivotY + this._lift;
    this.root.updateMatrixWorld(true);
    this.debug.minY = minY; this.debug.lift = this._lift;
  }

  /** Inclinaison du corps selon la pente du terrain sous la racine (voir TILT). */
  _updateTilt(dt) {
    const b = this.brain;
    let pitch = 0, roll = 0;
    if (!b.onWall && !b.jumping) {
      const g = b._groundAt, p = this.root.position, h = this.locomotion.heading;
      const fx = Math.sin(h), fz = Math.cos(h); // avant (+Z local)
      const sx = Math.cos(h), sz = -Math.sin(h); // +X local
      const A = TILT.ahead, S = TILT.side;
      const dF = g(p.x + fx * A, p.z + fz * A) - g(p.x - fx * A, p.z - fz * A);
      const dS = g(p.x + sx * S, p.z + sz * S) - g(p.x - sx * S, p.z - sz * S);
      // rotation.x > 0 baisse le museau (+Z vers −Y) : nez vers le haut en montée.
      pitch = THREE.MathUtils.clamp(-Math.atan(dF / (2 * A)) * TILT.gain, -TILT.max, TILT.max);
      // rotation.z > 0 lève le flanc +X : côté haut levé.
      roll = THREE.MathUtils.clamp(Math.atan(dS / (2 * S)) * TILT.gain, -TILT.max, TILT.max);
    }
    const k = 1 - Math.exp(-TILT.rate * dt);
    this.body.rotation.x += (pitch - this.body.rotation.x) * k;
    this.body.rotation.z += (roll - this.body.rotation.z) * k;
  }
}
