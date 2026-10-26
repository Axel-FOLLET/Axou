import * as THREE from 'three';
import { MEADOW_LIMIT } from '../world/field.js';
import { heightAt as terrainHeightAt } from '../world/Terrain.js';

/** Fenêtre du frottement de tête et de la respiration lente, couché sur le flanc, dans le clip `Pet`
 *  du GLB (secondes ; clip refait par A, mission catgame_style, fiche 04 : installé sur le flanc à
 *  3,0 s, début du relever à 7,0 s, poses identiques à 3,0 et 7,0 : on peut revenir à 3,0 sans
 *  à-coup ; clés cuites ≈ 0,04 s plus tard dans le GLB). Nom gardé de l'ancien pédalage sur le dos,
 *  supprimé. Les yeux mi-clos de Cat.js suivent cette fenêtre. */
export const PET_PADDLE = [3.0, 7.0];
/** Instants du clip `Pet` où le chat est assis (0,9 s) puis couché en sphinx (2,0 s, même pose que la
 *  fin de `Lie`) : point d'entrée si on le caresse déjà posé (fiche 04 de catgame_style, inchangés). */
const PET_FROM = { sit: 0.9, lie: 2.0 };

/** Occupations d'inactivité (étude Stray, § 8 du README). Durée fixe en secondes, ou celle du clip. */
const FILLERS = { stretch: 'Stretch', groom: 'Groom', sit: 8, lie: 12 };

/**
 * Chasse au papillon (mission catgame_jeu, fiche 01b). Toutes les distances au sol, en mètres.
 * Réglables ; les instants du bond sont ceux lus dans le clip `Pounce` du GLB (POUNCE ci-dessous).
 */
export const HUNT = {
  chance: 0.4,          // probabilité qu'une occupation de calme soit une chasse (si une proie est en vue)
  spotRadius: 4,        // rayon où le chat remarque seul un papillon posé
  minDist: 0.6,         // en deçà, pas de chasse spontanée (proie sous le nez)
  maxPreyY: 0.85,       // proie trop haute ignorée (fleurs de la clairière : 0,42 à 0,54 m)
  maxDist: 8,           // au-delà, abandon (et clic refusé)
  stalkDist: 1.2,       // approche à la marche jusqu'ici, puis affût
  pounceDist: 0.8,      // affût jusqu'ici, puis bond (bond de ≈ 0,4 m de la racine)
  aimTol: 0.35,         // rad : écart de cap toléré avant de bondir (rotation sur place sinon)
  move: [2, 4],         // s : avancée d'affût (≈ 0,10 m/s d'après le clip Stalk)
  freeze: [0.8, 2.5],   // s : arrêt figé d'affût
  firstFreeze: [0.5, 1.5], // s : arrêt figé en passant à l'affût
  approachMax: 25,      // s : garde-fous (8 m à 0,52 m/s ≈ 16 s)
  stalkMax: 25,
  noProgress: 6,        // s sans gagner 5 cm : abandon
  prepExtra: [0, 1],    // s : accroupi tenu en plus (fesses qui gigotent) avant l'élan
  maxLeap: 0.9,         // m : avancée maximale de la racine pendant le bond
  pawShift: 0.09,       // m : les pattes avant reculent de l'élan (mesuré) à la réception (clip Pounce, essai Node 2026-10-25)
  catchChance: 0.3,
  rootMotion: false,    // true si le clip `Pounce` avance lui-même l'os Root (demande à A) : Brain n'avance plus la racine
  after: 0.3,           // s après la fin du clip avant de reprendre sa vie
};
/**
 * Instants du clip `Pounce` du GLB (s). Décollage, réception et fin lus dans le GLB par A (fiche
 * taches/02_animations.md § 9, « Pounce ») : décollage 1,75 s (image 43, dernier contact au sol),
 * réception 2,08 s (image 51, clé 2,1 s), fin 2,54 s (durée du clip). Accroupi atteint à 0,4 s :
 * calendrier de la fiche 01b § 3 (clé CROUCH d'`anim_cat.py`). La racine avance en JS entre
 * `launch` et `land` ; le bond est résolu sur les papillons à `land`.
 */
const POUNCE = { crouch: 0.4, launch: 1.75, land: 2.08, end: 2.54 };

/** Jeu de la pelote (phase 2). Distances au sol en mètres, durées en secondes. Réglables. */
export const PLAY = {
  runSpeed: 1.5,        // m/s au clip `run` (foulée du clip non mesurée : glissement possible, voir fiche 05)
  reach: 0.32,          // distance racine → pelote où le chat la touche (museau ≈ 0,3 m devant la racine)
  strength: [0.8, 1.6], // m/s ajoutés à la pelote par une poussée (Yarn.nudge)
  bats: [1, 3],         // poussées de suite avant de revenir au repos (tirage entier)
  batTime: 0.6,         // pause après une poussée (patte qui frappe), avant de recourir
  chaseMax: 12,         // garde-fou : course trop longue
  maxDist: 12,          // pelote trop loin : le chat laisse tomber
  tiredAt: 5,           // lassitude : il court après 5 lancers rapprochés, se couche à la fin du 5e et ne court plus
  recover: 30,          // un lancer de lassitude s'efface toutes les 30 s hors du jeu
  lieTime: 15,          // durée du coucher de lassitude (état `lie` existant)
};

/**
 * Clic au sol (mission catgame_style, fiche 05 point e). Distances au sol en mètres.
 * `runFrom` : au-delà, le chat court (état `run`, clip `run` à PLAY.runSpeed 1,5 m/s) au lieu de
 * marcher (≈ 0,51 m/s, Cat.js) ; 2,5 m = au-delà de la clairière de départ (2,2 m) et ≈ 5 s de marche.
 * `walkAt` : en course, le chat repasse à la marche à cette distance du point (≈ 1,6 s de marche finale).
 */
export const GOTO = { runFrom: 2.5, walkAt: 0.8 };

/**
 * Déplacements dans le monde (mission catgame_monde, D) : relief, limite de la prairie, murs.
 * Distances en mètres, durées en secondes. Les murs viennent de `world.ruins` (src/world/Ruins.js) :
 * les murs hauts et les rochers (`climbable` faux) sont contournés (grille A* si la ligne droite est
 * coupée), les murets bas (`climbable`) sont franchis par un saut (clips `Jump` / `JumpDown`).
 */
export const NAV = {
  radius: 0.2,               // rayon du corps autour de la racine (contact avec les murs)
  limit: MEADOW_LIMIT - 0.5, // la racine reste dans ce disque (MEADOW_LIMIT = 18 m, field.js)
  cell: 0.25,                // maille de la grille de contournement
  pass: 0.3,                 // point de passage intermédiaire atteint à cette distance
  repath: 0.5,               // cible mobile (pelote, papillon) : chemin recalculé au plus souvent
  jumpReach: 0.75,           // saut sur un muret si le point d'arrivée est à moins de ça
  touch: 0.15,               // … ou si le corps touche le muret (distance au contact le long du chemin)
  topMargin: 0.08,           // retrait depuis les bords du dessus d'un muret (walkableAt)
  down: [0.45, 1.1],         // distance de réception d'un saut vers le bas (premier point libre)
  stuck: 4,                  // secondes sans gagner 5 cm vers la cible : abandon
  wallFollow: 12,            // 1/s, lissage de la hauteur sur le dessus d'un muret (pierres inégales)
};
/**
 * Instants des clips `Jump` et `JumpDown` du GLB (instants du script + 0,0417 s, fiche 04 de la
 * mission catgame_monde). Clips sur place : la racine est montée et avancée ici.
 * Jump : racine au sol jusqu'à `rise`, à h − 0,09 m à `front` (pattes avant sur le dessus), à h à
 * `top` ; avancée de `rise` à `top`. JumpDown : racine à h jusqu'à `leave`, au sol à `ground` ;
 * avancée de `go` à `stop`.
 */
const JUMP = { rise: 0.64, front: 0.94, top: 1.09, end: 1.625, frontDrop: 0.09 };
const JUMP_DOWN = { go: 0.44, leave: 0.54, ground: 0.74, stop: 0.84, end: 1.29 };

const _d = new THREE.Vector3();
const _p = new THREE.Vector3();
const _q = new THREE.Vector3();
const _res = { x: 0, z: 0, hit: null };
const between = ([a, b]) => a + Math.random() * (b - a);
const hdist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const smooth = (u) => u * u * (3 - 2 * u);
const clamp01 = (u) => Math.min(1, Math.max(0, u));
const lerp = (a, b, u) => a + (b - a) * u;

/**
 * Grille de contournement (A*, 8 voisins) des obstacles non praticables de `ruins` (murs hauts,
 * rochers), agrandis du rayon du chat + 5 cm ; hors du disque `limit` : bloqué. Les murets bas
 * restent libres : le chat saute dessus. Construite une fois, au premier chemin coupé.
 */
class NavGrid {
  constructor(ruins, { limit, cell, radius }) {
    this.cell = cell;
    this.half = limit;
    const n = this.n = Math.ceil((2 * limit) / cell);
    this.blocked = new Uint8Array(n * n);
    const pad = radius + 0.05;
    const obs = ruins.obstacles.filter((o) => !o.climbable)
      .map((o) => ({ o, c: Math.cos(o.rotY), s: Math.sin(o.rotY) }));
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const x = this.cx(i), z = this.cx(j);
        let b = Math.hypot(x, z) > limit;
        for (let k = 0; !b && k < obs.length; k++) {
          const { o, c, s } = obs[k];
          const dx = x - o.x, dz = z - o.z;
          b = Math.abs(dx * c - dz * s) <= o.hx + pad && Math.abs(dx * s + dz * c) <= o.hz + pad;
        }
        this.blocked[j * n + i] = b ? 1 : 0;
      }
    }
  }

  /** Centre (m) de la maille d'indice i (même formule en x et en z). */
  cx(i) { return -this.half + (i + 0.5) * this.cell; }
  idx(x) { return Math.min(this.n - 1, Math.max(0, Math.floor((x + this.half) / this.cell))); }

  /** Maille libre la plus proche de (i, j) (anneaux carrés jusqu'à 12 mailles), ou -1. */
  nearestFree(i, j) {
    const n = this.n;
    if (!this.blocked[j * n + i]) return j * n + i;
    for (let r = 1; r <= 12; r++) {
      let best = -1, bestD = Infinity;
      for (let dj = -r; dj <= r; dj++) {
        for (let di = -r; di <= r; di++) {
          if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
          const a = i + di, b = j + dj;
          if (a < 0 || b < 0 || a >= n || b >= n || this.blocked[b * n + a]) continue;
          const d = di * di + dj * dj;
          if (d < bestD) { bestD = d; best = b * n + a; }
        }
      }
      if (best >= 0) return best;
    }
    return -1;
  }

  /** Chemin de mailles de a vers b (centres {x, z}, sans la maille de départ), ou null. */
  find(ax, az, bx, bz) {
    const n = this.n, N = n * n;
    const s = this.nearestFree(this.idx(ax), this.idx(az));
    const t = this.nearestFree(this.idx(bx), this.idx(bz));
    if (s < 0 || t < 0) return null;
    const g = new Float32Array(N).fill(Infinity);
    const parent = new Int32Array(N).fill(-1);
    const closed = new Uint8Array(N);
    const ti = t % n, tj = (t / n) | 0;
    const h = (k) => {
      const dx = Math.abs((k % n) - ti), dz = Math.abs(((k / n) | 0) - tj);
      return Math.max(dx, dz) + 0.41421356 * Math.min(dx, dz);
    };
    // Tas binaire sur f = g + h.
    const heap = [], f = new Float32Array(N);
    const push = (k) => {
      heap.push(k);
      let c = heap.length - 1;
      while (c > 0) {
        const p = (c - 1) >> 1;
        if (f[heap[p]] <= f[heap[c]]) break;
        [heap[p], heap[c]] = [heap[c], heap[p]]; c = p;
      }
    };
    const pop = () => {
      const top = heap[0], last = heap.pop();
      if (heap.length) {
        heap[0] = last;
        let c = 0;
        for (;;) {
          const l = 2 * c + 1, r = l + 1;
          let m = c;
          if (l < heap.length && f[heap[l]] < f[heap[m]]) m = l;
          if (r < heap.length && f[heap[r]] < f[heap[m]]) m = r;
          if (m === c) break;
          [heap[m], heap[c]] = [heap[c], heap[m]]; c = m;
        }
      }
      return top;
    };
    g[s] = 0; f[s] = h(s); push(s);
    while (heap.length) {
      const k = pop();
      if (closed[k]) continue;
      if (k === t) break;
      closed[k] = 1;
      const i = k % n, j = (k / n) | 0;
      for (let dj = -1; dj <= 1; dj++) {
        for (let di = -1; di <= 1; di++) {
          if (!di && !dj) continue;
          const a = i + di, b = j + dj;
          if (a < 0 || b < 0 || a >= n || b >= n) continue;
          const m = b * n + a;
          if (this.blocked[m] || closed[m]) continue;
          // Pas de coupe en diagonale entre deux mailles bloquées.
          if (di && dj && (this.blocked[j * n + a] || this.blocked[b * n + i])) continue;
          const cost = g[k] + (di && dj ? 1.41421356 : 1);
          if (cost < g[m]) { g[m] = cost; parent[m] = k; f[m] = cost + h(m); push(m); }
        }
      }
    }
    if (parent[t] < 0 && t !== s) return null;
    const out = [];
    for (let k = t; k !== s && k >= 0; k = parent[k]) out.push({ x: this.cx(k % n), z: this.cx((k / n) | 0) });
    return out.reverse();
  }
}

/**
 * Machine à états du chat : idle, walk, run (course vers un point cliqué loin, GOTO), pet
 * (papouilles), stretch, groom, sit, lie, sleep, wake,
 * la chasse : approach (marche vers la proie), stalk (affût), pounce (bond),
 * et la pelote : chase (course, clip `run`), bat (poussée puis courte pause).
 * Décide ; ne touche pas aux os directement (c'est le rôle de Cat.js).
 *
 * Inactivité : une occupation aléatoire après 8 à 20 s de calme (parfois une chasse si un papillon
 * est posé près du chat), le sommeil après 60 s, un miaulement (callback) après 30 s. Un clic au sol
 * ou sur le chat interrompt tout, papouilles comprises (le chat se lève aussitôt, fondu court dans
 * Cat.js) ; un chat endormi se réveille d'abord (clip `Wake`), puis fait ce qu'on lui a demandé.
 */
export class Brain {
  constructor(cat) {
    this.cat = cat;
    this.state = 'idle';
    this.target = null;
    this.pending = null;   // action demandée pendant le réveil : 'walk', 'pet' ou 'hunt'
    this.quietSince = 0;   // secondes sans interaction (toutes situations calmes confondues)
    this.stateTime = 0;    // secondes dans l'état courant
    this.timer = 0;        // durée restante d'un état limité
    this.nextFiller = this._drawFillerDelay();
    this.onMeow = null;
    this.onHunt = null;    // callback (résultat 'caught' | 'missed' | 'abandon', raison, papillon)
    this._meowed = false;
    this.butterflies = null;
    this.prey = null;
    this._hunt = null;     // état interne de la chasse en cours
    this.yarn = null;
    this.fatigue = 0;      // lancers « en stock » (pelote), redescend avec le temps
    this.onPlay = null;    // callback ('chase' | 'bat' | 'tired' | 'ignored', info)
    this._play = null;
    // Monde (mission catgame_monde) : donné par Cat.update (setWorld) à la première image.
    this.world = null;
    this.ruins = null;
    this._groundAt = terrainHeightAt;
    this.onWall = false;   // racine sur le dessus d'un muret
    this._jump = null;     // saut en cours (états `jump` / `jumpdown`)
    this._queued = null;   // ordre reçu pendant un saut, exécuté à la réception
    this._nav = null;      // chemin courant (points de passage) vers la cible
    this._grid = null;     // NavGrid, construite au premier chemin coupé par un mur haut
  }

  /** Essaim de papillons (src/critters/Butterflies.js), donné par main.js. */
  setButterflies(b) { this.butterflies = b; }
  /** Pelote (src/critters/Yarn.js), donnée par main.js. Elle reçoit les murs du monde (Yarn.setRuins). */
  setYarn(y) { this.yarn = y; if (this.ruins) y?.setRuins?.(this.ruins); }
  /**
   * Monde (src/scene/World.js) : `terrain.heightAt` (sol) et `ruins` (murs, murets). Appelé par
   * Cat.update à la première image (main.js passe déjà `world` à `cat.update`).
   */
  setWorld(world) {
    this.world = world;
    this.ruins = world?.ruins ?? null;
    this._grid = null;
    this._nav = null;
    const terrain = world?.terrain;
    this._groundAt = terrain ? (x, z) => terrain.heightAt(x, z) : terrainHeightAt;
    if (this.ruins) this.yarn?.setRuins?.(this.ruins);
  }

  /** Saut en cours (montée sur un muret ou descente). */
  get jumping() { return !!this._jump; }
  /** Points de passage restants vers la cible (essais : `__cat.brain.path`). */
  get path() { return this._nav?.pts ?? null; }

  get isPlaying() { return this.state === 'chase' || this.state === 'bat'; }
  /** Lassé : PLAY.tiredAt lancers « en stock », à 0,5 près (les pauses entre lancers en effacent un peu). */
  get tired() { return this.fatigue > PLAY.tiredAt - 0.5; }

  /** Point que la tête suit pendant la chasse ou le jeu (sinon null : le pointeur). */
  get lookAt() {
    if (this.isPlaying && this.yarn) return this.yarn.position;
    return this.prey && this.isHunting ? this.prey.position : null;
  }
  get isHunting() { return this.state === 'approach' || this.state === 'stalk' || this.state === 'pounce'; }
  /** Bond en l'air (élan → réception) : les autres papillons proches s'envolent. */
  get pouncing() { return this.state === 'pounce' && !!this._hunt?.airborne; }

  _drawFillerDelay() { return 8 + Math.random() * 12; }

  /**
   * Clic au sol : marche, ou course si le point est à plus de GOTO.runFrom. Pendant les papouilles,
   * le chat se lève tout de suite (passage direct à `walk` / `run`, fondu court dans Cat.js).
   */
  walkTo(point) {
    if (this._jump) { this._queued = () => this.walkTo(point); return; }
    this._endHunt('clic au sol');
    // Point ramené dans la prairie (NAV.limit) et hors des murs hauts.
    this.target = this._clampGoal(new THREE.Vector3(point.x, point.y ?? 0, point.z));
    this._nav = null;
    this._interrupt();
    if (this._wakeFirst('walk')) return;
    this._set(this._moveState());
  }

  /** Allure vers `target` : `run` au-delà de GOTO.runFrom, sinon `walk`. */
  _moveState() {
    return hdist(this.target, this.cat.root.position) > GOTO.runFrom ? 'run' : 'walk';
  }

  pet() {
    if (this._jump) { this._queued = () => this.pet(); return; }
    this._endHunt('caresse');
    this.target = null;
    this._interrupt();
    if (this._wakeFirst('pet')) return;
    if (this.state === 'pet') {
      // Un nouveau clic pendant le frottement sur le flanc (PET_PADDLE, 3,0 à 7,0 s) prolonge le plaisir : retour à 3,0 s.
      if (this.stateTime > PET_PADDLE[0] && this.stateTime < PET_PADDLE[1] - 0.5) {
        this.stateTime = PET_PADDLE[0];
        this.timer = this.cat.duration('Pet') - PET_PADDLE[0];
        this.cat.onPetTime?.(PET_PADDLE[0]);
      }
      return;
    }
    // Déjà assis ou couché : on entre dans le clip à la pose correspondante (pas de relever inutile).
    const from = PET_FROM[this.state] ?? 0;
    this.timer = this.cat.duration('Pet') - from;
    this._set('pet');
    if (from) { this.stateTime = from; this.cat.onPetTime?.(from); }
  }

  /**
   * Clic sur un papillon : le chat le chasse s'il est posé et à moins de HUNT.maxDist.
   * Retourne false sinon (clic consommé sans effet). Ignoré pendant les papouilles.
   */
  hunt(b) {
    if (!this.butterflies || !b || this.state === 'pet') return false;
    if (this._jump) { this._queued = () => this.hunt(b); return true; }
    if (b.state !== 'perched' || hdist(b.position, this.cat.root.position) > HUNT.maxDist) return false;
    if (this.isHunting && this.prey === b) return true;
    this._interrupt();
    this.target = null;
    if (this.state === 'sleep' || this.state === 'wake') {
      if (!this.butterflies.target(b)) return false;
      this.prey = b;
      this._wakeFirst('hunt');
      return true;
    }
    return this._startHunt(b);
  }

  /** Console : chasse le papillon posé le plus proche (≤ maxDist). */
  huntNearest(maxDist = HUNT.maxDist) {
    const b = this.butterflies?.nearestPerched(this.cat.root.position, maxDist);
    return b ? this.hunt(b) : false;
  }

  /**
   * Pelote lancée (ou cliquée) : le chat court après elle, sauf s'il dort, se réveille, reçoit des
   * papouilles ou chasse un papillon (rien n'est interrompu), ou s'il est lassé (il se couche).
   * Retourne true si le chat part jouer.
   */
  yarnThrown() {
    if (this._jump) { this._queued = () => this.yarnThrown(); return true; }
    const s = this.state;
    if (!this.yarn || s === 'pet' || s === 'sleep' || s === 'wake' || this.isHunting) {
      this.onPlay?.('ignored', s);
      return false;
    }
    if (this.tired) {
      // Lassé : il ne court plus ; il se couche (état `lie` existant) ou y reste.
      this._interrupt();
      this.target = null;
      this._endPlay();
      return false;
    }
    this.fatigue += 1;
    this._interrupt();
    this.target = null;
    const [a, b] = PLAY.bats;
    this._play = { bats: a + Math.floor(Math.random() * (b - a + 1)), done: 0 };
    this._nav = null;
    if (s === 'chase') return true;
    this._set('chase');
    this.onPlay?.('chase', this.fatigue);
    return true;
  }

  /** Fin du jeu : repos, ou coucher si le chat est lassé. */
  _endPlay() {
    this._play = null;
    if (this.tired) {
      this.timer = PLAY.lieTime;
      this._set('lie');
      this.onPlay?.('tired', this.fatigue);
    } else this._set('idle');
  }

  _updatePlay(dt) {
    const y = this.yarn;
    const root = this.cat.root.position;
    const d = y.distanceTo(root);
    if (this.state === 'bat') {
      this.timer -= dt;
      this._aim(dt, 3, y.position);
      if (this.timer > 0) return;
      if (this._play && this._play.done < this._play.bats && d < PLAY.maxDist) this._set('chase');
      else this._endPlay();
      return;
    }
    if (this.stateTime > PLAY.chaseMax || d > PLAY.maxDist || !this._play) { this._endPlay(); return; }
    if (d <= PLAY.reach) {
      if (y.state === 'air') { this._aim(dt, 4, y.position); return; } // elle rebondit encore : il attend, face à elle
      // Poussée du museau / de la patte avant, dans l'axe racine → pelote (la tête, ≈ 0,3 m devant la
      // racine, peut déjà dépasser le centre de la pelote à cette distance : direction inversée).
      y.nudge(root, between(PLAY.strength));
      this._play.done += 1;
      this.timer = PLAY.batTime;
      this._set('bat');
      this.onPlay?.('bat', this._play.done);
      return;
    }
    _p.set(y.position.x, y.position.y, y.position.z);
    if (this._navigate(_p, dt, { dynamic: true }) === 'blocked') this._endPlay();
  }

  _startHunt(b) {
    if (this.isHunting) this._endHunt(null, false);
    if (!this.butterflies.target(b)) return false;
    this.prey = b;
    this._nav = null;
    const d = hdist(b.position, this.cat.root.position);
    this._hunt = { best: d, bestAt: 0, phase: 'freeze', left: between(HUNT.firstFreeze), clock: 0,
      hold: 0, held: false, airborne: false, landed: false, start: null, leap: 0 };
    this._set(d > HUNT.stalkDist ? 'approach' : 'stalk');
    return true;
  }

  /** Fin de chasse sans bond (raison donnée) ou nettoyage après le bond. */
  _endHunt(reason, toIdle = false) {
    if (!this.prey && !this.isHunting && this.pending !== 'hunt') return;
    if (this.pending === 'hunt') this.pending = null;
    const prey = this.prey;
    if (prey && prey.targeted) this.butterflies?.untarget();
    this.prey = null;
    this.cat.freeze?.(false);
    if (reason && !this._hunt?.landed) this.onHunt?.('abandon', reason, prey);
    this._hunt = null;
    if (toIdle) this._set('idle');
  }

  _preyValid() { return this.prey && this.prey.state === 'perched' && this.prey.targeted; }

  /** Lance une occupation : 'stretch', 'groom', 'sit', 'lie' ou 'sleep'. */
  startFiller(name) {
    if (!(name in FILLERS) && name !== 'sleep') return;
    if (this._jump) return;
    this._endHunt('occupation imposée'); // appel console pendant une chasse
    const d = FILLERS[name];
    this.timer = d === undefined ? Infinity : typeof d === 'number' ? d : this.cat.duration(d);
    this._set(name);
  }

  /** Endormi (ou en train de se réveiller) : mémorise l'action et passe par le réveil. */
  _wakeFirst(action) {
    if (this.pending === 'hunt' && action !== 'hunt') { this.butterflies?.untarget(); this.prey = null; }
    if (this.state === 'sleep') {
      this.pending = action;
      this.timer = this.cat.duration('Wake');
      this._set('wake');
      return true;
    }
    if (this.state === 'wake') { this.pending = action; return true; }
    return false;
  }

  _interrupt() {
    this.quietSince = 0;
    this._meowed = false;
    this.nextFiller = this._drawFillerDelay();
  }

  _set(state) {
    if (this.state === state) return;
    this.state = state;
    this.stateTime = 0;
    this.cat.onStateChange(state);
  }

  /** Tourne la racine sur place vers la proie (ou `target`) ; retourne l'écart de cap restant (rad). */
  _aim(dt, rate = 3, target = this.prey.position) {
    const loco = this.cat.locomotion;
    _d.copy(target).sub(this.cat.root.position);
    let diff = Math.atan2(_d.x, _d.z) - loco.heading;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    loco.heading += Math.sign(diff) * Math.min(Math.abs(diff), rate * dt);
    this.cat.root.rotation.y = loco.heading;
    return Math.abs(diff);
  }

  _updateHunt(dt) {
    const h = this._hunt;
    const root = this.cat.root.position;
    if (this.state !== 'pounce' || !h.airborne && !h.landed) {
      // Avant l'élan : la proie doit rester posée et visée, à portée, et le chat doit progresser.
      if (!this._preyValid()) return this._endHunt('papillon parti', true);
      const d = hdist(this.prey.position, root);
      if (d > HUNT.maxDist) return this._endHunt('trop loin', true);
      if (d < h.best - 0.05) { h.best = d; h.bestAt = this.stateTime; }
      if (this.state === 'approach') {
        if (this.stateTime > HUNT.approachMax) return this._endHunt('approche trop longue', true);
        if (this.stateTime - h.bestAt > HUNT.noProgress) return this._endHunt('bloqué', true);
        if (d <= HUNT.stalkDist) { h.bestAt = 0; h.best = d; return this._set('stalk'); }
        _p.copy(this.prey.position);
        this._navigate(_p, dt, { dynamic: true }); // un muret sur le chemin : saut, puis reprise de l'approche
        return;
      }
      if (this.state === 'stalk') {
        if (this.stateTime > HUNT.stalkMax) return this._endHunt('affût trop long', true);
        if (this.stateTime - h.bestAt > HUNT.noProgress) return this._endHunt('bloqué', true);
        if (d <= HUNT.pounceDist) {
          // Assez près : figé, on finit de s'aligner puis on bondit.
          this.cat.freeze(true);
          if (this._aim(dt) < HUNT.aimTol) this._startPounce(d);
          return;
        }
        h.left -= dt;
        if (h.left <= 0) {
          h.phase = h.phase === 'move' ? 'freeze' : 'move';
          h.left = between(h.phase === 'move' ? HUNT.move : HUNT.freeze);
        }
        this.cat.freeze(h.phase === 'freeze');
        if (h.phase === 'freeze') { this._aim(dt, 1.5); return; }
        _p.copy(this.prey.position);
        // Pas de saut à l'affût : un muret entre le chat et la proie fait abandonner.
        if (this._navigate(_p, dt, { dynamic: true, canJump: false }) === 'blocked') return this._endHunt('muret', true);
        return;
      }
    }
    if (this.state === 'pounce') this._updatePounce(dt);
  }

  _startPounce(d) {
    const h = this._hunt;
    h.dist = d;
    h.clock = 0;
    h.hold = between(HUNT.prepExtra);
    h.held = false;
    this._set('pounce');
    this.cat.freeze(false);
  }

  _updatePounce(dt) {
    const h = this._hunt;
    const cat = this.cat;
    // Instants bruts du GLB (POUNCE), sans mise à l'échelle : la durée du clip vaut POUNCE.end.
    // Accroupi tenu en plus (clip figé) : l'horloge du bond s'arrête.
    if (!h.held && h.clock >= POUNCE.crouch) {
      if (h.hold > 0) { h.hold -= dt; cat.freeze(true); this._aim(dt, 1.5); return; }
      h.held = true;
      cat.freeze(false);
    }
    h.clock += dt;
    const t = h.clock;
    if (!h.airborne && !h.landed && t < POUNCE.launch) { this._aim(dt, 1.5); return; }
    if (!h.airborne && !h.landed) {
      // Élan : la racine avancera de façon à poser les pattes avant sur la proie.
      cat.root.updateMatrixWorld(true);
      cat.pawPoint(_p);
      _d.set(Math.sin(cat.locomotion.heading), 0, Math.cos(cat.locomotion.heading));
      const pawAhead = _p.sub(cat.root.position).dot(_d);
      const preyAhead = _p.copy(this.prey.position).sub(cat.root.position).setY(0).dot(_d);
      h.leap = HUNT.rootMotion ? 0 : THREE.MathUtils.clamp(preyAhead - pawAhead + HUNT.pawShift, 0, HUNT.maxLeap);
      h.start = cat.root.position.clone();
      h.dir = _d.clone();
      h.leap = this._clampLeap(h.start, h.dir, h.leap);
      h.airborne = true;
    }
    if (h.airborne) {
      const u = Math.min(1, (t - POUNCE.launch) / (POUNCE.land - POUNCE.launch));
      const y = cat.root.position.y; // hauteur : sol ou dessus du muret (_settle)
      cat.root.position.copy(h.start).addScaledVector(h.dir, h.leap * smooth(u)).setY(y);
      if (u >= 1) {
        h.airborne = false;
        h.landed = true;
        cat.root.updateMatrixWorld(true);
        const paw = cat.pawPoint(new THREE.Vector3());
        const prey = this.prey;
        const result = this.butterflies.pounce(prey, paw, { catchChance: HUNT.catchChance });
        h.result = result;
        h.pawDist = hdist(paw, prey.position);
        h.pawErr = _d.copy(paw).sub(prey.position).setY(0).dot(h.dir); // > 0 : patte au-delà de la proie
        this.prey = null;
        this.onHunt?.(result, null, prey);
      }
      return;
    }
    const end = (cat.duration('Pounce') || POUNCE.end) + HUNT.after;
    if (t >= end) { this._hunt = null; this._set('idle'); }
  }

  update(dt) {
    if (this._jump) { this.stateTime += dt; this._updateJump(dt); return; }
    this._think(dt);
    if (!this._jump) this._settle(dt);
  }

  _think(dt) {
    this.stateTime += dt;
    // La lassitude retombe hors du jeu seulement (sinon une longue course efface une partie du lancer).
    if (this.fatigue > 0 && !this.isPlaying) this.fatigue = Math.max(0, this.fatigue - dt / PLAY.recover);
    if (this.isHunting) { this._updateHunt(dt); return; }
    if (this.isPlaying) { if (this.yarn) this._updatePlay(dt); else this._set('idle'); return; }
    if (this.state === 'walk' || this.state === 'run') {
      // Course : à GOTO.walkAt du point, le chat ralentit en marche.
      if (this.state === 'run' && hdist(this.target, this.cat.root.position) <= GOTO.walkAt) this._set('walk');
      const r = this._navigate(this.target, dt);
      if (r === 'arrived' || r === 'blocked') { this.target = null; this._nav = null; this._set('idle'); }
      return;
    }
    if (this.state === 'pet' || this.state === 'wake') {
      this.timer -= dt;
      if (this.timer > 0) return;
      const next = this.pending;
      this.pending = null;
      if (next === 'walk' && this.target) this._set(this._moveState());
      else if (next === 'pet') { this.state = 'idle'; this.pet(); }
      else if (next === 'hunt' && this.prey) {
        const b = this.prey;
        this.prey = null;
        if (b.state !== 'perched' || !this._startHunt(b)) {
          this.butterflies.untarget();
          this.onHunt?.('abandon', 'papillon parti', b);
          this._set('idle');
        }
      } else this._set('idle');
      return;
    }

    // Situations calmes : idle et occupations.
    this.quietSince += dt;
    if (this.quietSince > 30 && !this._meowed) { this._meowed = true; this.onMeow?.(); }
    if (this.state === 'sleep') return;
    if (this.state !== 'idle') {
      this.timer -= dt;
      if (this.timer <= 0) this._set('idle');
      return;
    }
    if (this.quietSince > 60) { this.startFiller('sleep'); return; }
    this.nextFiller -= dt;
    if (this.nextFiller <= 0) {
      this.nextFiller = this._drawFillerDelay();
      if (this._spontaneousHunt()) return;
      const names = Object.keys(FILLERS);
      this.startFiller(names[Math.floor(Math.random() * names.length)]);
    }
  }

  /** Occupation « chasse » : un papillon posé, bas, ni trop près ni trop loin, et un peu de chance. */
  _spontaneousHunt() {
    if (!this.butterflies || Math.random() >= HUNT.chance) return false;
    const root = this.cat.root.position;
    let best = null, bestD = HUNT.spotRadius;
    for (const b of this.butterflies.perched()) {
      const d = hdist(b.position, root);
      const above = b.position.y - this._groundAt(b.position.x, b.position.z); // hauteur au-dessus du sol
      if (d >= HUNT.minDist && d <= bestD && above <= HUNT.maxPreyY) { best = b; bestD = d; }
    }
    return best ? this._startHunt(best) : false;
  }

  // ---------------------------------------------------------------- monde : sol, limite, murs

  /** Ramène `v` (x, z) dans le disque NAV.limit et hors des obstacles (sauf s'il est sur le dessus d'un muret). Renvoie `v`. */
  _clampGoal(v) {
    const r = Math.hypot(v.x, v.z);
    if (r > NAV.limit) { v.x *= NAV.limit / r; v.z *= NAV.limit / r; }
    const ruins = this.ruins;
    if (ruins) {
      // Sur un muret : on garde le point (le chat y montera). Sinon : hors de toute empreinte.
      const onTop = ruins.walkableAt(v.x, v.z, 0) !== null;
      ruins.resolve(v.x, v.z, NAV.radius, onTop ? { climbable: false } : {}, _res);
      v.x = _res.x; v.z = _res.z;
      const r2 = Math.hypot(v.x, v.z);
      if (r2 > NAV.limit) { v.x *= NAV.limit / r2; v.z *= NAV.limit / r2; }
    }
    return v;
  }

  _blockedHigh(ax, az, bx, bz) {
    return !!this.ruins.blockedSegment(ax, az, bx, bz, NAV.radius, { climbable: false });
  }

  /**
   * Points de passage de a vers b : ligne droite si aucun mur haut ne la coupe, sinon chemin de la
   * grille A* raccourci (on garde le point le plus lointain visible), terminé par b.
   */
  _plan(ax, az, bx, bz) {
    if (!this._blockedHigh(ax, az, bx, bz)) return [{ x: bx, z: bz }];
    this._grid ??= new NavGrid(this.ruins, NAV);
    const cells = this._grid.find(ax, az, bx, bz);
    if (!cells || !cells.length) return [{ x: bx, z: bz }];
    cells[cells.length - 1] = { x: bx, z: bz };
    const out = [];
    let cx = ax, cz = az, k = 0;
    while (k < cells.length) {
      let far = k;
      for (let m = cells.length - 1; m > k; m--) {
        if (!this._blockedHigh(cx, cz, cells[m].x, cells[m].z)) { far = m; break; }
      }
      out.push(cells[far]);
      cx = cells[far].x; cz = cells[far].z;
      k = far + 1;
    }
    return out;
  }

  /**
   * Un pas vers `goal` en tenant compte du monde. Renvoie 'arrived', 'moving', 'jump' (saut lancé :
   * état `jump` ou `jumpdown`) ou 'blocked' (sans progrès depuis NAV.stuck s, ou saut refusé par
   * `canJump`). `dynamic` : cible mobile (chemin recalculé au plus toutes les NAV.repath s, pas
   * d'abandon faute de progrès).
   */
  _navigate(goal, dt, { dynamic = false, canJump = true } = {}) {
    const root = this.cat.root.position;
    const loco = this.cat.locomotion;
    const g = this._clampGoal(_q.set(goal.x, 0, goal.z));
    if (!this.ruins) {
      const arrived = loco.stepToward(g, dt);
      this._afterStep();
      return arrived ? 'arrived' : 'moving';
    }

    let nav = this._nav;
    if (!nav) nav = this._nav = { gx: NaN, gz: NaN, pts: null, age: Infinity, t: 0, best: Infinity, bestAt: 0 };
    nav.age += dt; nav.t += dt;
    if (!(Math.hypot(nav.gx - g.x, nav.gz - g.z) <= 0.05)) {
      if (!this._blockedHigh(root.x, root.z, g.x, g.z)) nav.pts = [{ x: g.x, z: g.z }];
      else if (!nav.pts || nav.age >= NAV.repath || nav.pts.length <= 1) { nav.pts = this._plan(root.x, root.z, g.x, g.z); nav.age = 0; }
      else nav.pts[nav.pts.length - 1] = { x: g.x, z: g.z };
      nav.gx = g.x; nav.gz = g.z;
    }
    while (nav.pts.length > 1 && Math.hypot(nav.pts[0].x - root.x, nav.pts[0].z - root.z) < NAV.pass) nav.pts.shift();
    const wp = nav.pts[0];
    const last = nav.pts.length === 1;
    const ruins = this.ruins;

    // Murets : monter dessus si le chemin les traverse ou si la cible est dessus ; redescendre au bord.
    if (!this.onWall) {
      const hit = ruins.blockedSegment(root.x, root.z, wp.x, wp.z, NAV.radius, { y: root.y });
      if (hit && hit.obstacle.climbable) {
        const len = Math.hypot(wp.x - root.x, wp.z - root.z);
        const land = this._landingOnWall(root, wp, last);
        if (land && (hit.t * len <= NAV.touch || Math.hypot(land.x - root.x, land.z - root.z) <= NAV.jumpReach)) {
          if (!canJump) return 'blocked';
          this._startJump('jump', land);
          return 'jump';
        }
      }
    } else if (ruins.walkableAt(wp.x, wp.z, 0) === null) {
      _d.set(wp.x - root.x, 0, wp.z - root.z);
      const len = _d.length();
      if (len > 1e-4) {
        _d.divideScalar(len);
        const ahead = Math.max(0.06, loco.speed * dt * 2);
        if (ruins.walkableAt(root.x + _d.x * ahead, root.z + _d.z * ahead, NAV.topMargin * 0.5) === null) {
          if (!canJump) return 'blocked';
          this._startJump('jumpdown', this._landingOffWall(root, _d));
          return 'jump';
        }
      }
    }

    const arrived = loco.stepToward(_p.set(wp.x, 0, wp.z), dt) && last;
    this._afterStep();
    if (arrived) return 'arrived';
    const dist = Math.hypot(g.x - root.x, g.z - root.z);
    if (dist < nav.best - 0.05) { nav.best = dist; nav.bestAt = nav.t; }
    if (!dynamic && nav.t - nav.bestAt > NAV.stuck) return 'blocked';
    return 'moving';
  }

  /** Après un pas : le corps est repoussé hors des murs (sauf ceux qu'il surplombe) et reste dans la prairie. */
  _afterStep() {
    const root = this.cat.root.position;
    if (this.ruins) {
      this.ruins.resolve(root.x, root.z, NAV.radius, { y: this.onWall ? root.y + 0.1 : root.y }, _res);
      root.x = _res.x; root.z = _res.z;
    }
    const r = Math.hypot(root.x, root.z);
    if (r > NAV.limit) { root.x *= NAV.limit / r; root.z *= NAV.limit / r; }
  }

  /**
   * Point d'arrivée d'un saut sur un muret, le long de racine → `wp` : au milieu du dessus traversé
   * (au plus 0,25 m après le bord), ou `wp` lui-même s'il est sur le muret (`last`). null si le
   * segment ne passe pas sur un dessus praticable.
   */
  _landingOnWall(root, wp, last) {
    const ruins = this.ruins;
    const dx = wp.x - root.x, dz = wp.z - root.z;
    const len = Math.hypot(dx, dz);
    if (len < 1e-4) return null;
    const ux = dx / len, uz = dz / len;
    const span = Math.min(len, 2.5);
    let e0 = -1, e1 = -1;
    for (let s = 0; s <= span + 1e-6; s += 0.03) {
      const ok = ruins.walkableAt(root.x + ux * s, root.z + uz * s, NAV.topMargin) !== null;
      if (ok && e0 < 0) e0 = s;
      if (ok) e1 = s;
      else if (e0 >= 0) break;
    }
    if (e0 < 0) return null;
    let s = e0 + Math.min(0.25, (e1 - e0) / 2);
    if (last && len <= e1 + 0.03 && ruins.walkableAt(wp.x, wp.z, 0) !== null) s = Math.min(Math.max(len, e0), e1);
    return { x: root.x + ux * s, z: root.z + uz * s };
  }

  /** Point de réception d'un saut vers le bas dans la direction `dir` : premier point libre (ni muret ni mur) entre NAV.down[0] et [1]. */
  _landingOffWall(root, dir) {
    const ruins = this.ruins;
    for (let s = NAV.down[0]; s <= NAV.down[1] + 1e-6; s += 0.05) {
      const x = root.x + dir.x * s, z = root.z + dir.z * s;
      if (Math.hypot(x, z) > NAV.limit) break;
      if (ruins.walkableAt(x, z, 0) === null && !ruins.obstacleAt(x, z, NAV.radius)) return { x, z };
    }
    return { x: root.x + dir.x * 0.6, z: root.z + dir.z * 0.6 };
  }

  /** Lance `jump` (monter sur un muret, arrivée `to`) ou `jumpdown` (descendre, réception `to`). */
  _startJump(kind, to) {
    const root = this.cat.root.position;
    const y1 = kind === 'jump'
      ? (this.ruins.walkableAt(to.x, to.z, 0) ?? root.y + 0.42)
      : this._groundAt(to.x, to.z);
    this._jump = { kind, t: 0, from: root.clone(), to: { x: to.x, z: to.z }, y0: root.y, y1, resume: this.state };
    this._set(kind);
  }

  _updateJump(dt) {
    const j = this._jump;
    const root = this.cat.root.position;
    const t = (j.t += dt);
    if (j.kind === 'jump') {
      if (t < JUMP.rise) this._aim(dt, 4, _p.set(j.to.x, 0, j.to.z));
      const u = smooth(clamp01((t - JUMP.rise) / (JUMP.top - JUMP.rise)));
      root.x = lerp(j.from.x, j.to.x, u); root.z = lerp(j.from.z, j.to.z, u);
      if (t <= JUMP.rise) root.y = j.y0;
      else if (t <= JUMP.front) root.y = lerp(j.y0, j.y1 - JUMP.frontDrop, smooth((t - JUMP.rise) / (JUMP.front - JUMP.rise)));
      else root.y = lerp(j.y1 - JUMP.frontDrop, j.y1, clamp01((t - JUMP.front) / (JUMP.top - JUMP.front)));
      if (t >= (this.cat.duration('Jump') || JUMP.end)) this._endJump();
    } else {
      if (t < JUMP_DOWN.go) this._aim(dt, 4, _p.set(j.to.x, 0, j.to.z));
      const u = smooth(clamp01((t - JUMP_DOWN.go) / (JUMP_DOWN.stop - JUMP_DOWN.go)));
      root.x = lerp(j.from.x, j.to.x, u); root.z = lerp(j.from.z, j.to.z, u);
      const ground = this._groundAt(root.x, root.z);
      if (t <= JUMP_DOWN.leave) root.y = j.y0;
      else if (t < JUMP_DOWN.ground) root.y = lerp(j.y0, ground, smooth((t - JUMP_DOWN.leave) / (JUMP_DOWN.ground - JUMP_DOWN.leave)));
      else root.y = ground;
      if (t >= (this.cat.duration('JumpDown') || JUMP_DOWN.end)) this._endJump();
    }
  }

  _endJump() {
    const j = this._jump;
    this._jump = null;
    this.onWall = j.kind === 'jump';
    this._nav = null;
    const resume = ['walk', 'run', 'chase', 'approach'].includes(j.resume) ? j.resume : 'idle';
    if (resume === 'approach' && !this._preyValid()) this._endHunt('papillon parti', false);
    this._set(resume === 'approach' && !this._hunt ? 'idle' : resume);
    const q = this._queued;
    this._queued = null;
    q?.();
  }

  /** Hauteur de la racine hors saut : dessus du muret (lissé) ou sol du terrain. */
  _settle(dt) {
    const root = this.cat.root.position;
    if (this.onWall) {
      const top = this.ruins?.walkableAt(root.x, root.z, 0) ?? null;
      if (top !== null) { root.y += (top - root.y) * (1 - Math.exp(-NAV.wallFollow * dt)); return; }
      this.onWall = false; // sorti du dessus sans saut (bond) : il retombe
    }
    const ground = this._groundAt(root.x, root.z);
    root.y = root.y > ground ? Math.max(ground, root.y - 4 * dt) : ground;
  }

  /** Bond : avancée de la racine réduite pour ne pas entrer dans un mur ni quitter le dessus d'un muret. */
  _clampLeap(start, dir, leap) {
    if (!this.ruins || leap <= 0) return leap;
    if (this.onWall) {
      while (leap > 0 && this.ruins.walkableAt(start.x + dir.x * leap, start.z + dir.z * leap, 0.02) === null) leap -= 0.05;
      return Math.max(0, leap);
    }
    const hit = this.ruins.blockedSegment(start.x, start.z, start.x + dir.x * leap, start.z + dir.z * leap, NAV.radius, { y: start.y });
    if (hit) leap = Math.max(0, leap * hit.t - 0.02);
    const ex = start.x + dir.x * leap, ez = start.z + dir.z * leap;
    const r = Math.hypot(ex, ez);
    if (r > NAV.limit) leap = Math.max(0, leap - (r - NAV.limit));
    return leap;
  }
}
