import * as THREE from 'three';

/**
 * Clics (souris) et touchers (doigt, stylet) sur un papillon, sur le chat, sur la pelote ou sur le
 * sol, et position du pointeur projetée au sol. Plus de mode lancer depuis la mission catgame_style
 * (fiche 05) : la pelote se lance par la touche P ou le bouton du HUD (main.js), sans clic.
 *
 * Toutes plateformes (mission catgame_monde, P) :
 * - Un toucher court vaut un clic ; un glisser (au-delà de `TAP_SLOP` px) est une rotation de
 *   caméra (OrbitControls) et n'est pas un clic.
 * - Dès qu'un deuxième doigt se pose (pincer, rotation à deux doigts), le geste entier n'est plus
 *   un clic, même si un doigt n'a presque pas bougé ; un nouveau clic n'est possible qu'après le
 *   lever de tous les doigts.
 * - Souris : seul le bouton principal clique (le bouton droit reste au panoramique d'OrbitControls).
 *
 * Sol visé (hypothèse publiée dans la fiche 05_plateformes) : `world.pickables` (tableau d'objets
 * sur lesquels le chat peut marcher : terrain, dessus de murs bas…) s'il existe et n'est pas vide ;
 * sinon `world.terrain.mesh`, `world.terrain` s'il est lui-même un Object3D, puis `world.ground`.
 * Le test est récursif (un terrain en plusieurs morceaux marche aussi).
 */
const TAP_SLOP = { mouse: 6, pen: 8, touch: 12 }; // px de déplacement toléré pour un clic

export class Picker {
  constructor(world, cat, butterflies = null, yarn = null) {
    this.world = world;
    this.cat = cat;
    this.butterflies = butterflies; // src/critters/Butterflies.js (chasse au clic)
    this.yarn = yarn;               // src/critters/Yarn.js (clic : le chat court après)
    this.onGround = null;
    this.onCat = null;
    this.onYarn = null;             // clic sur la pelote
    this.onPointerType = null;      // appelé avec 'mouse' | 'touch' | 'pen' à chaque appui
    this.pointerWorld = new THREE.Vector3(0, 0.3, 2);
    this._ray = new THREE.Raycaster();
    this._ndc = new THREE.Vector2();
    this._down = null;              // appui candidat au clic : { id, x, y, type }
    this._pointers = new Set();     // pointeurs actuellement posés sur le canvas
    this._multi = false;            // plusieurs doigts pendant ce geste : pas de clic

    const el = world.renderer.domElement;
    this._el = el;
    el.addEventListener('pointerdown', (e) => this._press(e));
    el.addEventListener('pointermove', (e) => this._move(e));
    el.addEventListener('pointerup', (e) => this._up(e));
    el.addEventListener('pointercancel', (e) => this._release(e));
    // Menu contextuel d'un appui long (Android) ou du clic droit : inutile dans le jeu.
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  /** Objets « sol » testés par le rayon (voir l'en-tête). */
  groundTargets() {
    const w = this.world;
    if (Array.isArray(w.pickables) && w.pickables.length) return w.pickables;
    const list = [];
    const t = w.terrain;
    if (t?.mesh?.isObject3D) list.push(t.mesh);
    else if (t?.isObject3D) list.push(t);
    if (w.ground?.isObject3D && !list.includes(w.ground)) list.push(w.ground);
    return list;
  }

  _groundHit() {
    return this._ray.intersectObjects(this.groundTargets(), true)[0];
  }

  _cast(e) {
    // Coordonnées relatives au canvas (il couvre la fenêtre, mais sans le supposer).
    const r = this._el.getBoundingClientRect();
    this._ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this._ray.setFromCamera(this._ndc, this.world.camera);
  }

  _press(e) {
    this.onPointerType?.(e.pointerType || 'mouse');
    // Premier pointeur d'un geste : repart de zéro (un lever perdu ne bloque pas les clics suivants).
    if (e.isPrimary) { this._pointers.clear(); this._multi = false; }
    this._pointers.add(e.pointerId);
    if (this._pointers.size > 1) { this._multi = true; this._down = null; return; }
    if (e.pointerType === 'mouse' && e.button !== 0) { this._down = null; return; }
    this._down = { id: e.pointerId, x: e.clientX, y: e.clientY, type: e.pointerType || 'mouse' };
    if (e.pointerType !== 'mouse') this._move(e); // pas de survol au doigt : regard du chat ici
  }

  _release(e) {
    this._pointers.delete(e.pointerId);
    if (this._down?.id === e.pointerId) this._down = null;
    if (this._pointers.size === 0) this._multi = false;
  }

  _move(e) {
    this._cast(e);
    const hit = this._groundHit();
    if (hit) this.pointerWorld.copy(hit.point).y += 0.3;
  }

  _up(e) {
    const d = this._down;
    const multi = this._multi;
    this._release(e);
    // Un glissement est une rotation de caméra, un geste à deux doigts un zoom : pas un clic.
    if (multi || !d || d.id !== e.pointerId) return;
    if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > (TAP_SLOP[d.type] ?? TAP_SLOP.mouse)) return;
    this._click(e);
  }

  _click(e) {
    this._cast(e);
    // Papillon d'abord (petite sphère de clic) : le chat le chasse s'il est posé ; un papillon en
    // vol ou trop loin consomme le clic sans effet (pas de marche surprise vers le sol derrière).
    const b = this.butterflies?.pick(this._ray);
    if (b) { this.cat.brain.hunt(b); return; }
    // Casque (H, D) : ses maillages ignorent le Raycaster ; `helmet.hit` rend une intersection
    // three (`point`, `distance`) ou null. Seul `point` est lu ici.
    const onCat = this._ray.intersectObjects(this.cat.meshes, false)[0] ?? this.cat.helmet?.hit(this._ray);
    if (onCat) { this.onCat?.(onCat.point); return; }
    if (this.yarn?.pick(this._ray)) { this.onYarn?.(); return; }
    const onGround = this._groundHit();
    if (onGround) this.onGround?.(onGround.point);
  }
}
