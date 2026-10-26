import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { YARN, toonMaterial, outlineMaterial, color } from '../style/palette.js';
import { MEADOW_LIMIT } from '../world/field.js';
import { heightAt as terrainHeightAt } from '../world/Terrain.js';

/**
 * Pelote de laine : boule de 11 cm de diamètre, lancer en arc, rebonds amortis, roulement avec
 * frottement (plus fort dans l'herbe haute si une fonction de hauteur est fournie), rotation
 * cohérente avec le roulement, fil qui traîne (corde simulée, une ligne).
 *
 * Indépendante du chat : reçoit la scène, puis à chaque image `update(dt, positionDuChat)`.
 * Sol : relief de src/world/Terrain.js (`heightAt`, option `groundAt`) et dessus des murets bas ;
 * murs (option `ruins` ou `setRuins`, src/world/Ruins.js) : la pelote rebondit dessus et ne les
 * traverse pas (mission catgame_monde, D). Repère monde, mètres, secondes.
 *
 * Lancers : `throwTo(from, target)` (point visé) et `throwDir(from, dir, force)` (direction et
 * force, sans point visé ; touche P). Chaque appel relance la pelote, même si elle vole ou roule.
 *
 * Limite : la pelote reste dans le disque `bounds` (par défaut centre (0, 0), rayon
 * `MEADOW_LIMIT` = 18 m, limite de la prairie, src/world/field.js) :
 * un point visé hors du disque est ramené dedans, et la pelote qui touche le bord rebondit
 * mollement vers l'intérieur (lancers, roulement, coups de patte et contact du chat).
 *
 * États (`state`) : `rest` (immobile au sol), `air` (en vol ou en rebond), `rolling` (au sol, roule).
 */

const G = 9.81;
/** m : distance horizontale du point de chute pour `throwDir` à force 1. */
export const THROW_RANGE = 3.2;
/** Forces acceptées par `throwDir` (au-delà : ramenée dans l'intervalle). */
export const THROW_FORCE = [0.2, 2.5];
const EDGE_BOUNCE = 0.35;       // part de la vitesse vers l'extérieur rendue vers l'intérieur au bord
const EDGE_KEEP = 0.7;          // part de la vitesse le long du bord gardée au contact
const EDGE_MARGIN = 0.3;        // m, un point visé est ramené à au moins ça du bord
/**
 * Repère flottant (correction 1) : rayon de la pastille (m), hauteur moyenne d'herbe au-delà de
 * laquelle il apparaît (m ; la pelote fait 0,11 m), marge au-dessus des touffes (m), amplitude du
 * flottement (m), du « souffle » (part du rayon), vitesse du fondu (1/s).
 */
const MARKER = { radius: 0.05, showAbove: 0.3, lift: 0.14, bob: 0.03, pulse: 0.1, fade: 4 };
const WALL_BOUNCE = 0.5;        // part de la vitesse vers le mur rendue en rebond
const WALL_KEEP = 0.8;          // part de la vitesse le long du mur gardée au contact
const STEP = 1 / 120;           // s, sous-pas de simulation (rebonds et corde stables avec dt jusqu'à 0,1 s)
const _v = new THREE.Vector3();
const _w = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _t = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);
const _res = { x: 0, z: 0, hit: null };

/**
 * Géométrie : noyau + une douzaine de tours de fil (tores) orientés au hasard, couleurs par sommet.
 * Sans couleur imposée : trois tons de `YARN` (palette.js) ; sinon dérivés de `hex`.
 * Tours de fil épais (tube 0,1 × rayon) et ronds (6 côtés) : aspect moelleux.
 */
function yarnGeometry(radius, hex, rng) {
  const base = color(hex ?? YARN.base);
  const light = hex == null ? color(YARN.light) : base.clone().lerp(color(0xffffff), 0.25);
  const dark = hex == null ? color(YARN.dark) : base.clone().multiplyScalar(0.7);
  const paint = (g, c) => {
    const n = g.attributes.position.count, a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(a, 3));
    g.deleteAttribute('uv');
    return g;
  };
  const parts = [paint(new THREE.IcosahedronGeometry(radius * 0.92, 2), dark)];
  const e = new THREE.Euler();
  for (let i = 0; i < 12; i++) {
    const t = new THREE.TorusGeometry(radius * (0.9 + 0.04 * rng()), radius * 0.1, 6, 36).toNonIndexed();
    e.set(rng() * Math.PI, rng() * Math.PI, rng() * Math.PI);
    t.applyQuaternion(_q.setFromEuler(e));
    parts.push(paint(t, i % 3 === 0 ? dark : i % 3 === 1 ? base : light));
  }
  const g = mergeGeometries(parts);
  parts.forEach((p) => p.dispose());
  return g;
}

export class Yarn {
  /**
   * @param {THREE.Object3D} scene
   * @param {object} [options]
   * @param {number} [options.radius=0.055]        m (diamètre 11 cm)
   * @param {number} [options.color]              couleur unique (hex) ; par défaut les trois tons de `YARN` (rose framboise tendre)
   * @param {THREE.Vector3} [options.position]     position de départ au sol (centre posé à y = rayon)
   * @param {number} [options.restitution=0.35]    rebond vertical gardé (0..1), divisé par (1 + herbe) dans l'herbe haute
   * @param {number} [options.impactKeep=0.65]     vitesse horizontale gardée à chaque impact, divisée de même
   * @param {number} [options.rollFriction=0.12]   coefficient de roulement sur herbe rase (décélération = coef × g)
   * @param {(x:number, z:number) => number} [options.heightAt]  hauteur d'herbe AU-DESSUS du sol (m) ;
   *        ex. `(x, z) => world.meadow.grassHeightAt(x, z)` (meadow.heightAt est absolu depuis la mission catgame_monde)
   * @param {(x:number, z:number) => number} [options.groundAt]  hauteur du sol (m) ; défaut : `heightAt` de src/world/Terrain.js
   * @param {object} [options.ruins]               murs (src/world/Ruins.js : walkableAt, resolve) ; aussi `setRuins`
   * @param {number} [options.grassDrag=1.5]       coef ajouté par mètre d'herbe au-dessus de 0,2 m
   * @param {number} [options.catRadius=0.15]      m, rayon du corps du chat pour le contact (0 : aucun contact)
   * @param {boolean} [options.trail=true]         fil qui traîne
   * @param {number} [options.trailLength=0.5]     m
   * @param {number} [options.seed=1]              forme des tours de fil
   * @param {{center?: {x:number, z:number}, radius?: number}} [options.bounds]  disque où la pelote reste
   *        (défaut : centre (0, 0), rayon MEADOW_LIMIT de src/world/field.js) ; `null` : aucune limite
   * @param {boolean} [options.outline=true]       contour brun chaud (coque inversée, `outlineMaterial`)
   * @param {boolean} [options.marker=true]        repère flottant au-dessus de la pelote quand elle est
   *        dans l'herbe haute (exige `heightAt`)
   */
  constructor(scene, options = {}) {
    this.scene = scene;
    this.radius = options.radius ?? 0.055;
    this.restitution = options.restitution ?? 0.35;
    this.impactKeep = options.impactKeep ?? 0.65;
    this.rollFriction = options.rollFriction ?? 0.12;
    this.heightAt = options.heightAt ?? null;
    this.groundAt = options.groundAt ?? terrainHeightAt;
    this.ruins = options.ruins ?? null;
    this.grassDrag = options.grassDrag ?? 1.5;
    this.catRadius = options.catRadius ?? 0.15;
    /** Rappel facultatif : (type, yarn, info) ; type ∈ thrown, bounce (info = vitesse d'impact m/s), stopped, pushed, hitCat, edge (info = vitesse vers l'extérieur m/s). */
    this.onEvent = null;
    /** Disque où la pelote reste : { center: {x, z}, radius } (m), ou null (aucune limite). */
    this.bounds = options.bounds === null ? null : {
      center: { x: options.bounds?.center?.x ?? 0, z: options.bounds?.center?.z ?? 0 },
      radius: options.bounds?.radius ?? MEADOW_LIMIT,
    };

    let s = (options.seed ?? 1) >>> 0;
    const rng = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
    this._geometry = yarnGeometry(this.radius, options.color, rng);
    // Aplats toon (style.md § 7) + léger éclat de sa propre couleur : reste lisible dans l'herbe.
    this._material = toonMaterial(0xffffff, { vertexColors: true, emissive: YARN.base, emissiveIntensity: 0.12 });
    this.mesh = new THREE.Mesh(this._geometry, this._material);
    this.mesh.name = 'Yarn';
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    // Contour : coque inversée sur une sphère simple du rayon de la pelote (et non sur chaque tour
    // de fil, qui donnerait un trait par tour) : un seul trait rond autour de la silhouette.
    this._outlineMat = null;
    this._outlineGeo = null;
    if (options.outline ?? true) {
      this._outlineMat = outlineMaterial();
      this._outlineGeo = new THREE.SphereGeometry(this.radius, 18, 12);
      const shell = new THREE.Mesh(this._outlineGeo, this._outlineMat);
      shell.name = 'YarnOutline';
      this.mesh.add(shell);
    }
    // Sphère de clic un peu plus grande (9 cm de rayon), invisible au rendu mais touchée par le Raycaster.
    this._hitGeo = new THREE.SphereGeometry(0.09, 10, 8);
    this._hitMat = new THREE.MeshBasicMaterial({ visible: false });
    this.hitMesh = new THREE.Mesh(this._hitGeo, this._hitMat);
    this.hitMesh.userData.yarn = this;
    this.group = new THREE.Group();
    this.group.name = 'YarnGroup';
    this.group.add(this.mesh, this.hitMesh);
    scene.add(this.group);
    this.marker = null;
    if ((options.marker ?? true) && this.heightAt) this._makeMarker();
    /** Objets cliquables (la sphère invisible). */
    this.pickables = [this.hitMesh];

    this.velocity = new THREE.Vector3();
    this.spin = new THREE.Vector3();        // vitesse angulaire en vol (rad/s, axe monde)
    this.state = 'rest';
    this.group.position.copy(options.position ?? new THREE.Vector3(0.6, 0, 0.6));
    this.group.position.y = this._ground(this.group.position.x, this.group.position.z, -Infinity) + this.radius;
    this._cat = null;
    this._acc = 0;

    this.trail = null;
    if (options.trail ?? true) this._makeTrail(options.trailLength ?? 0.5);
  }

  /** Position du centre (Vector3 du groupe, repère monde). */
  get position() { return this.group.position; }
  get isMoving() { return this.state !== 'rest'; }
  get atRest() { return this.state === 'rest'; }
  get onGround() { return this.state !== 'air'; }

  /** Murs du monde (src/world/Ruins.js) ; donné par Brain.setWorld / setYarn ou par main.js. */
  setRuins(ruins) { this.ruins = ruins ?? null; }

  /**
   * Hauteur du sol sous (x, z) pour une pelote dont le bas est à `bottom` : terrain, ou dessus d'un
   * muret bas si la pelote est au-dessus (à 5 cm près).
   */
  _ground(x, z, bottom) {
    const g = this.groundAt(x, z);
    const top = this.ruins?.walkableAt?.(x, z, 0) ?? null;
    return top !== null && top > g && bottom >= top - 0.05 ? top : g;
  }

  /** Pose la pelote immobile en `point` (x, z ; posée au sol). */
  placeAt(point) {
    const p = this._clampInside(this.group.position.set(point.x, 0, point.z), this.radius);
    p.y = this._ground(p.x, p.z, Infinity) + this.radius;
    this.velocity.set(0, 0, 0);
    this.spin.set(0, 0, 0);
    this.state = 'rest';
    this._resetTrail();
  }

  /**
   * Lance la pelote depuis `from` vers le point du sol `target` : la vitesse initiale est calculée
   * pour que le premier impact ait lieu en `target` (centre à y = rayon).
   * Durée de vol `time` (s) ; par défaut 0,45 + 0,1 s par mètre, entre 0,5 et 1,3 s (arc plus haut pour un lancer lointain).
   * Un point visé hors de `bounds` est ramené à `EDGE_MARGIN` m à l'intérieur du bord.
   * Relance toujours, même si la pelote vole ou roule encore.
   * @returns {THREE.Vector3} la vitesse initiale (m/s)
   */
  throwTo(from, target, { time } = {}) {
    const p = this.group.position.copy(from);
    this._clampInside(p, this.radius);        // départ hors de la prairie : ramené au bord
    const g0 = this.groundAt(p.x, p.z);
    if (p.y < g0 + this.radius) p.y = g0 + this.radius;
    this._clampInside(_t.set(target.x, 0, target.z), EDGE_MARGIN);
    const dx = _t.x - p.x, dz = _t.z - p.z;
    const d = Math.hypot(dx, dz);
    const T = time ?? THREE.MathUtils.clamp(0.45 + 0.1 * d, 0.5, 1.3);
    // Premier impact visé au sol au point visé : terrain, ou dessus du muret si le point est dessus.
    const gT = this._ground(_t.x, _t.z, Infinity);
    this.velocity.set(dx / T, (gT + this.radius - p.y + 0.5 * G * T * T) / T, dz / T);
    // Petit effet de rotation dans le sens du vol (sans influence sur la trajectoire).
    this.spin.set(dz, 0, -dx).normalize().multiplyScalar(d > 1e-3 ? 6 : 0);
    this.state = 'air';
    this._resetTrail();
    this._emit('thrown', this.velocity.clone());
    return this.velocity.clone();
  }

  /**
   * Lance la pelote sans point visé : depuis `from`, dans la direction horizontale `dir`, avec la
   * force `force`. Le point de chute (premier impact) est à `force × THROW_RANGE` m (3,2 m à
   * force 1) de `from`, horizontalement, dans la direction `dir` ; ramené dans `bounds` s'il en
   * sort. Durée de vol comme `throwTo`. Relance toujours, même si la pelote vole ou roule encore.
   * @param {THREE.Vector3|{x:number, y:number, z:number}} from  point de départ (m, repère monde ; y ≥ rayon)
   * @param {THREE.Vector3|{x:number, z:number}} dir  direction horizontale (y ignoré, longueur quelconque ;
   *        nulle : +Z)
   * @param {number} [force=1]  sans unité, ramenée dans THROW_FORCE (0,2 à 2,5)
   * @param {{time?: number}} [opts]  durée de vol imposée (s)
   * @returns {THREE.Vector3} la vitesse initiale (m/s)
   */
  throwDir(from, dir, force = 1, opts = {}) {
    let dx = dir.x, dz = dir.z;
    const L = Math.hypot(dx, dz);
    if (L < 1e-6) { dx = 0; dz = 1; } else { dx /= L; dz /= L; }
    const f = THREE.MathUtils.clamp(Number.isFinite(force) ? force : 1, THROW_FORCE[0], THROW_FORCE[1]);
    const d = f * THROW_RANGE;
    return this.throwTo(from, { x: from.x + dx * d, z: from.z + dz * d }, opts);
  }

  /**
   * Ramène le point (x, z) de `v` dans le disque `bounds`, à au moins `margin` m du bord
   * (y inchangé). Renvoie `v`. Sans `bounds` : ne fait rien.
   */
  _clampInside(v, margin = 0) {
    const b = this.bounds;
    if (!b) return v;
    const dx = v.x - b.center.x, dz = v.z - b.center.z;
    const d = Math.hypot(dx, dz), max = Math.max(0, b.radius - margin);
    if (d > max) { const k = max / d; v.x = b.center.x + dx * k; v.z = b.center.z + dz * k; }
    return v;
  }

  /** Bord de la prairie : la pelote qui le dépasse y est ramenée et rebondit mollement vers l'intérieur. */
  _edge() {
    const b = this.bounds;
    if (!b) return;
    const p = this.group.position, v = this.velocity;
    const dx = p.x - b.center.x, dz = p.z - b.center.z;
    const d = Math.hypot(dx, dz), max = b.radius - this.radius;
    if (d <= max || d < 1e-6) return;
    const nx = dx / d, nz = dz / d;
    p.x = b.center.x + nx * max; p.z = b.center.z + nz * max;
    const vn = v.x * nx + v.z * nz;          // vitesse vers l'extérieur
    if (vn > 0) {
      const tx = v.x - vn * nx, tz = v.z - vn * nz;
      v.x = tx * EDGE_KEEP - vn * EDGE_BOUNCE * nx;
      v.z = tz * EDGE_KEEP - vn * EDGE_BOUNCE * nz;
      if (this.state === 'air') this.spin.set(v.z, 0, -v.x).divideScalar(this.radius);
      this._emit('edge', vn);
    }
  }

  /**
   * Poussée du chat (patte ou museau) : ajoute `strength` m/s dans la direction horizontale `dir`
   * (un petit saut si la poussée dépasse 1,5 m/s).
   */
  push(dir, strength = 1) {
    _v.set(dir.x, 0, dir.z);
    if (_v.lengthSq() < 1e-8) return;
    _v.normalize().multiplyScalar(strength);
    this.velocity.add(_v);
    if (strength > 1.5) { this.velocity.y += 0.25 * (strength - 1.5); this.state = 'air'; }
    else if (this.state === 'rest') this.state = 'rolling';
    this._emit('pushed', strength);
  }

  /** Poussée depuis un point (museau ou patte du chat) : direction = de `fromPoint` vers la pelote. */
  nudge(fromPoint, strength = 1) {
    _w.copy(this.group.position).sub(fromPoint);
    if (_w.x * _w.x + _w.z * _w.z < 1e-8) _w.set(1, 0, 0);
    this.push(_w, strength);
  }

  /** Distance horizontale du centre à `point`. */
  distanceTo(point) { return Math.hypot(this.group.position.x - point.x, this.group.position.z - point.z); }

  /** Vrai si un rayon (`THREE.Raycaster` réglé) touche la pelote. */
  pick(raycaster) { return raycaster.intersectObjects(this.pickables, false).length > 0; }

  /**
   * À appeler à chaque image.
   * @param {number} dt  secondes
   * @param {THREE.Vector3} [catPos]  position du chat au sol (contact avec son corps si `catRadius` > 0)
   */
  update(dt, catPos) {
    this._cat = catPos ?? null;
    this._acc += Math.min(dt, 0.25);
    while (this._acc >= STEP) { this._step(STEP); this._acc -= STEP; }
    this._updateTrailGeometry();
    if (this.marker) this._updateMarker(Math.min(dt, 0.25));
  }

  // --- Repère flottant (correction 1, captures du chef : pelote invisible dans l'herbe haute).
  // Pastille ronde rose qui flotte et « respire » au-dessus des touffes, reliée à la pelote par un
  // fil de laine pâle. Visible seulement quand la pelote est au sol dans l'herbe haute (hauteur
  // moyenne `heightAt` > MARKER.showAbove) ; apparaît et disparaît en fondu.
  _makeMarker() {
    const geo = new THREE.SphereGeometry(MARKER.radius, 16, 12);
    const mat = toonMaterial(YARN.base, {
      emissive: YARN.light, emissiveIntensity: 0.6, transparent: true, opacity: 0, depthWrite: true,
    });
    const dot = new THREE.Mesh(geo, mat);
    dot.name = 'YarnMarkerDot';
    // Contour rose foncé (et non brun) : la coque est dessinée AVANT la pastille (renderOrder) et la
    // pastille écrit la profondeur, sinon la coque (faces arrière, sans profondeur) la recouvrait
    // entièrement et la pastille paraissait brun foncé (capture du chef, final2_pelote).
    const shellMat = outlineMaterial({ color: YARN.dark, thickness: 0.004 });
    shellMat.transparent = true; shellMat.opacity = 0; shellMat.depthWrite = false;
    const shell = new THREE.Mesh(geo, shellMat);
    shell.renderOrder = 1;
    dot.renderOrder = 2;
    dot.add(shell);
    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
    const lineMat = new THREE.LineBasicMaterial({ color: YARN.light, transparent: true, opacity: 0, depthWrite: false });
    const line = new THREE.Line(lineGeo, lineMat);
    line.frustumCulled = false;
    const group = new THREE.Group();
    group.name = 'YarnMarker';
    group.visible = false;
    group.add(dot, line);
    this.group.add(group); // suit la pelote (le groupe ne tourne pas, seul `mesh` tourne)
    for (const o of [dot, shell, line]) o.raycast = () => {}; // jamais touché par un clic
    this.marker = { group, dot, line, geo, mats: [mat, shellMat, lineMat], lineGeo, opacity: 0, t: 0 };
  }

  _updateMarker(dt) {
    const m = this.marker, p = this.group.position;
    const h = this.heightAt(p.x, p.z);
    const want = this.state !== 'air' && h > MARKER.showAbove ? 1 : 0;
    m.opacity += (want - m.opacity) * (1 - Math.exp(-MARKER.fade * dt));
    if (want === 0 && m.opacity < 0.02) m.opacity = 0;
    m.group.visible = m.opacity > 0;
    if (!m.group.visible) return;
    m.t += dt;
    // Au-dessus des touffes voisines (hauteur moyenne × 1,15, touffes jusqu'à ×1,2) + marge, qui flotte.
    const top = this._ground(p.x, p.z, p.y - this.radius) + h * 1.15 + MARKER.lift + MARKER.bob * Math.sin(m.t * 1.8);
    const y = top - p.y;
    m.dot.position.set(0, y, 0);
    m.dot.scale.setScalar(1 + MARKER.pulse * Math.sin(m.t * 3.2));
    const a = m.lineGeo.attributes.position.array;
    a[0] = 0; a[1] = this.radius; a[2] = 0; a[3] = 0; a[4] = y - MARKER.radius; a[5] = 0;
    m.lineGeo.attributes.position.needsUpdate = true;
    m.mats[0].opacity = m.mats[1].opacity = m.opacity;
    m.mats[2].opacity = 0.7 * m.opacity;
  }

  /** Part due à l'herbe haute : grassDrag × (hauteur − 0,2 m), 0 sans `heightAt` ou en herbe rase. */
  _grass(x, z) {
    return this.heightAt ? this.grassDrag * Math.max(0, this.heightAt(x, z) - 0.2) : 0;
  }

  _friction(x, z) { return this.rollFriction + this._grass(x, z); }

  _step(h) {
    const p = this.group.position, v = this.velocity, r = this.radius;
    if (this.state === 'air') {
      v.y -= G * h;
      p.addScaledVector(v, h);
      this._rotate(this.spin, h);
      this._walls();
      const g = this._ground(p.x, p.z, p.y - r);
      if (p.y <= g + r && v.y < 0) {
        p.y = g + r;
        const impact = -v.y;
        const soft = 1 + this._grass(p.x, p.z); // l'herbe haute amortit rebond et glissade
        v.y = impact * this.restitution / soft;
        const keep = this.impactKeep / soft;     // frottement à l'impact
        v.x *= keep; v.z *= keep;
        this._emit('bounce', impact);
        if (v.y < 0.35) { v.y = 0; this.state = 'rolling'; }
        this.spin.set(v.z, 0, -v.x).divideScalar(r); // reprend le roulement
      }
    } else if (this.state === 'rolling') {
      v.y = 0;
      const speed = Math.hypot(v.x, v.z);
      const dec = this._friction(p.x, p.z) * G * h;
      if (speed <= dec || speed < 0.02) {
        v.set(0, 0, 0);
        this.state = 'rest';
        this._emit('stopped', p.clone());
      } else {
        const k = (speed - dec) / speed;
        v.x *= k; v.z *= k;
        p.addScaledVector(v, h);
        this._walls();
        // Roulement sans glissement : ω = (haut × v) / r.
        _w.set(v.z, 0, -v.x).divideScalar(r);
        this._rotate(_w, h);
      }
      // Suit le relief ; au bord du dessus d'un muret, elle tombe (vol).
      const g = this._ground(p.x, p.z, p.y - r);
      if (p.y - r > g + 0.03) { this.state = 'air'; this.spin.set(v.z, 0, -v.x).divideScalar(r); }
      else p.y = g + r;
    } else {
      // Au repos : posée sur le relief (terrain ou muret).
      p.y = this._ground(p.x, p.z, p.y - r) + r;
    }
    // Contact avec le corps du chat (racine au sol ou sur un muret) : la pelote est repoussée et rebondit mollement.
    if (this._cat && this.catRadius > 0 && p.y - (this._cat.y ?? 0) < 0.45 && p.y - (this._cat.y ?? 0) > -0.2) {
      const dx = p.x - this._cat.x, dz = p.z - this._cat.z;
      const d = Math.hypot(dx, dz), min = this.catRadius + r;
      if (d < min && d > 1e-6) {
        const nx = dx / d, nz = dz / d;
        p.x = this._cat.x + nx * min; p.z = this._cat.z + nz * min;
        const vn = v.x * nx + v.z * nz;
        if (vn < 0) {
          v.x -= 1.5 * vn * nx; v.z -= 1.5 * vn * nz; // rebond à moitié amorti
          if (this.state === 'rest') this.state = 'rolling';
          this._emit('hitCat', -vn);
        }
      }
    }
    this._walls(); // le chat ne pousse pas la pelote dans un mur
    this._edge(); // après le contact du chat : la pelote ne sort jamais de la prairie
    if (this.trail) this._stepTrail(h);
  }

  /**
   * Murs : la pelote (disque de rayon r, bas à p.y − r) est repoussée hors des obstacles plus hauts
   * qu'elle (Ruins.resolve, option `y`) ; la vitesse vers le mur est renvoyée (WALL_BOUNCE), la
   * vitesse le long du mur gardée en partie (WALL_KEEP).
   */
  _walls() {
    if (!this.ruins) return;
    const p = this.group.position, v = this.velocity, r = this.radius;
    const out = this.ruins.resolve(p.x, p.z, r, { y: p.y - r }, _res);
    if (!out.hit) return;
    let nx = out.x - p.x, nz = out.z - p.z;
    const d = Math.hypot(nx, nz);
    p.x = out.x; p.z = out.z;
    if (d < 1e-9) return;
    nx /= d; nz /= d;
    const vn = v.x * nx + v.z * nz; // < 0 : vers le mur
    if (vn >= 0) return;
    const tx = v.x - vn * nx, tz = v.z - vn * nz;
    v.x = tx * WALL_KEEP - vn * WALL_BOUNCE * nx;
    v.z = tz * WALL_KEEP - vn * WALL_BOUNCE * nz;
    if (this.state === 'air') this.spin.set(v.z, 0, -v.x).divideScalar(r);
    else if (this.state === 'rest') this.state = 'rolling';
    this._emit('wall', -vn);
  }

  _rotate(omega, h) {
    const w = omega.length();
    if (w < 1e-6) return;
    _q.setFromAxisAngle(_v.copy(omega).divideScalar(w), w * h);
    this.mesh.quaternion.premultiply(_q);
  }

  // --- Fil qui traîne : corde de N points (intégration de Verlet), attachée à un point de la surface
  // de la boule qui tourne avec elle ; collisions avec le sol et avec la boule.
  _makeTrail(length) {
    const n = 20;
    this.trail = {
      n, seg: length / (n - 1),
      p: new Float32Array(n * 3), q: new Float32Array(n * 3),
      anchor: new THREE.Vector3(0, -0.2, -1).normalize().multiplyScalar(this.radius * 0.98),
    };
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    this._trailMat = new THREE.LineBasicMaterial({ color: YARN.trail });
    this.trailLine = new THREE.Line(geo, this._trailMat);
    this.trailLine.frustumCulled = false;
    this.trailLine.name = 'YarnTrail';
    this.scene.add(this.trailLine);
    this._resetTrail();
  }

  _anchorWorld(out) {
    return out.copy(this.trail.anchor).applyQuaternion(this.mesh.quaternion).add(this.group.position);
  }

  _resetTrail() {
    const t = this.trail;
    if (!t) return;
    this._anchorWorld(_v);
    for (let i = 0; i < t.n; i++) {
      const j = i * 3;
      t.p[j] = _v.x - i * t.seg * 0.9; t.p[j + 2] = _v.z;
      t.p[j + 1] = Math.max(this._ground(t.p[j], t.p[j + 2], _v.y) + 0.003, _v.y - i * 0.01);
      t.q[j] = t.p[j]; t.q[j + 1] = t.p[j + 1]; t.q[j + 2] = t.p[j + 2];
    }
  }

  _stepTrail(h) {
    const t = this.trail, P = t.p, Q = t.q, n = t.n;
    const c = this.group.position, rr = this.radius * 1.03;
    // Sol sous chaque point (terrain ou dessus de muret), calculé une fois par sous-pas.
    const gr = t.ground ??= new Float32Array(n);
    for (let i = 1; i < n; i++) gr[i] = this._ground(P[i * 3], P[i * 3 + 2], P[i * 3 + 1]) + 0.003;
    for (let i = 1; i < n; i++) {
      const j = i * 3;
      const onGround = P[j + 1] <= gr[i] + 0.001;
      const damp = onGround ? 0.8 : 0.995;
      for (let k = 0; k < 3; k++) {
        const cur = P[j + k];
        P[j + k] += (cur - Q[j + k]) * damp + (k === 1 ? -G * h * h : 0);
        Q[j + k] = cur;
      }
    }
    this._anchorWorld(_v);
    P[0] = _v.x; P[1] = _v.y; P[2] = _v.z;
    for (let it = 0; it < 4; it++) {
      for (let i = 0; i < n - 1; i++) {
        const a = i * 3, b = a + 3;
        const dx = P[b] - P[a], dy = P[b + 1] - P[a + 1], dz = P[b + 2] - P[a + 2];
        const d = Math.hypot(dx, dy, dz) || 1e-6;
        const diff = (d - t.seg) / d;
        if (i === 0) { P[b] -= dx * diff; P[b + 1] -= dy * diff; P[b + 2] -= dz * diff; }
        else {
          P[a] += dx * diff * 0.5; P[a + 1] += dy * diff * 0.5; P[a + 2] += dz * diff * 0.5;
          P[b] -= dx * diff * 0.5; P[b + 1] -= dy * diff * 0.5; P[b + 2] -= dz * diff * 0.5;
        }
      }
      for (let i = 1; i < n; i++) {
        const j = i * 3;
        if (P[j + 1] < gr[i]) P[j + 1] = gr[i];
        const dx = P[j] - c.x, dy = P[j + 1] - c.y, dz = P[j + 2] - c.z;
        const d = Math.hypot(dx, dy, dz);
        if (d < rr && d > 1e-6) { const s = rr / d; P[j] = c.x + dx * s; P[j + 1] = c.y + dy * s; P[j + 2] = c.z + dz * s; }
      }
    }
  }

  _updateTrailGeometry() {
    if (!this.trail) return;
    const attr = this.trailLine.geometry.attributes.position;
    attr.array.set(this.trail.p);
    attr.needsUpdate = true;
  }

  _emit(type, info) { this.onEvent?.(type, this, info); }

  /** Retire la pelote (et son fil) de la scène et libère géométries et matériaux. */
  dispose() {
    this.group.removeFromParent();
    this._geometry.dispose(); this._material.dispose();
    this._outlineGeo?.dispose(); this._outlineMat?.dispose();
    if (this.marker) { this.marker.geo.dispose(); this.marker.lineGeo.dispose(); this.marker.mats.forEach((m) => m.dispose()); this.marker = null; }
    this._hitGeo.dispose(); this._hitMat.dispose();
    if (this.trailLine) { this.trailLine.removeFromParent(); this.trailLine.geometry.dispose(); this._trailMat.dispose(); }
    this.pickables = [];
  }
}
