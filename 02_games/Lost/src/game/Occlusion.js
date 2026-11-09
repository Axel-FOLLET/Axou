import * as THREE from 'three';

/**
 * Fades the scenery between the camera and the cat, so that ruins, trees and anything else blocking the camera
 * never get in the way of play. Created by main.js.
 *
 * Input: `getOccluders()` returns the current list of three.js objects that may fade (ruin pieces and trees,
 * gathered in `world.occluders`). Empty or missing list: nothing happens. It is read every frame, so late additions
 * are accepted. Objects are assumed static (bounding box computed once, on first encounter). Ground, terrain,
 * mountains, grass and NPCs must not be listed: this module does not filter them. `getTargets()` (optional): extra
 * world points to clear, for example the NPC whose speech bubble is open (Story.talkTargets).
 *
 * Detection, every frame: segments from the camera to the cat's points (OCC.points: axis, head, ears, rump and
 * flanks; edge points take turns, OCC.edges per frame, a hit object staying hidden for OCC.hold frames) and to
 * `getTargets()`. Prefilter by bounding box (slab test), then raycast only against the meshes of the object whose
 * box is hit, both sides of faces (the camera can be caught inside stones). Camera inside an object's box: the object
 * fades as well.
 * Fade: opacity towards OCC.alpha in OCC.fade s (linear), back to 1 at the same speed. At 1, the original material
 * settings (`transparent`, `depthWrite`, `opacity`) are restored.
 *
 * Veil: a wall is made of many stones. Transparent without depth, all their faces (front, back, internal) would stack
 * at OCC.alpha each and veil the screen. During a fade each mesh therefore gets a depth-only double (no colour): only
 * the layer closest to the camera, across all faded stones, is then painted, once, at OCC.alpha. The double is a child
 * of the mesh (same geometry and frame), invisible outside a fade and ignored by rays.
 * Order (three.js transparent list, sorted first by `renderOrder`): the other transparent objects (dot and thread of
 * the yarn ball, Yarn.js, renderOrder 1 and 2), then the doubles (OCC.ghostOrder), then the faded meshes
 * (OCC.fadedOrder, back to the original once opaque). Doubles thus render after the usual transparent objects: a yarn
 * dot behind a faded wall stays visible under a single OCC.alpha veil (with doubles drawn before it, it would fail
 * the depth test and disappear).
 * Materials: a material shared by several listed objects is cloned for each (otherwise they would fade together); a
 * material shared with an object outside the list would fade on that object too and must be avoided.
 *
 * Read: `faded` (objects not fully opaque), `hidden` (objects cutting the view this frame), `count` (tracked objects),
 * `rays` (segments tested this frame), `ms` (duration of the last `update`).
 */
export const OCC = {
  alpha: 0.25,   // opacity of a faded object (one layer painted)
  fade: 0.2,     // s: fade duration, both ways
  // Points aimed at on the cat, in its root frame (m): [forward, height, side]. Axis (shoulders, back, hindquarters),
  // then edges: head, ear tips, rump, two flanks.
  points: [
    [0.2, 0.22, 0], [0, 0.18, 0], [-0.2, 0.15, 0],
    [0.32, 0.27, 0], [0.3, 0.36, 0], [-0.3, 0.14, 0], [0, 0.18, 0.09], [0, 0.18, -0.09],
  ],
  axis: 3,       // axis points, tested every frame
  edges: 2,      // edge points tested per frame (5 in 3 frames), to limit the cost
  hold: 3,       // frames: a hit object stays hidden this long (cycle of edge points)
  margin: 0.05,  // m: boxes enlarged by this much
  ghostOrder: 1e6,      // depth-only doubles: after the usual transparent objects
  fadedOrder: 1e6 + 1,  // fading meshes: right after their doubles
};

const _ray = new THREE.Raycaster();
const _from = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _hits = [];
const _targets = [];
const _depthOnly = new THREE.MeshBasicMaterial({
  colorWrite: false, depthWrite: true, transparent: true, side: THREE.FrontSide,
  // Double pushed back slightly: the nearest face, painted next at the same depth, passes without flicker; internal
  // faces, further away, are rejected.
  polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1,
});
const noRaycast = () => {};

export class Occlusion {
  /**
   * @param {object} o
   * @param {() => THREE.Object3D[]} o.getOccluders Current list (may be empty).
   * @param {() => THREE.Vector3[]} [o.getTargets] World points to clear in addition to the cat.
   * @param {THREE.Camera} o.camera
   * @param {THREE.Object3D} o.cat Cat root (position, rotation.y).
   */
  constructor({ getOccluders, getTargets = null, camera, cat }) {
    this.getOccluders = getOccluders;
    this.getTargets = getTargets;
    this.camera = camera;
    this.cat = cat;
    this.entries = new Map(); // object → { box, mats, meshes, ghosts, a, hit }
    this.faded = 0;
    this.hidden = 0;
    this.count = 0;
    this.rays = 0;
    this.ms = 0;
    this.enabled = true;
    this._used = new Map(); // material → listed object that carries it
  }

  _track(obj) {
    obj.updateWorldMatrix(true, true);
    const box = new THREE.Box3().setFromObject(obj).expandByScalar(OCC.margin);
    const mats = [], meshes = [];
    obj.traverse((m) => {
      if (!m.isMesh || !m.material || m.userData.occGhost) return; // doubles excluded
      meshes.push(m);
      const list = Array.isArray(m.material) ? m.material : [m.material];
      const own = list.map((mat) => {
        // Material already taken by another listed object: this object gets its own copy.
        if (this._used.has(mat) && this._used.get(mat) !== obj) mat = mat.clone();
        this._used.set(mat, obj);
        mats.push({ m: mat, transparent: mat.transparent, depthWrite: mat.depthWrite, opacity: mat.opacity });
        return mat;
      });
      m.material = Array.isArray(m.material) ? own : own[0];
    });
    const e = { box, mats, meshes, orders: meshes.map((m) => m.renderOrder), ghosts: null, a: 1, hit: false };
    this.entries.set(obj, e);
    return e;
  }

  /** Depth-only doubles of the meshes of `e`, created at the first fade. */
  _ghosts(e) {
    if (e.ghosts) return e.ghosts;
    e.ghosts = e.meshes.map((m) => {
      const g = m.isInstancedMesh
        ? new THREE.InstancedMesh(m.geometry, _depthOnly, m.count)
        : new THREE.Mesh(m.geometry, _depthOnly);
      if (m.isInstancedMesh) g.instanceMatrix = m.instanceMatrix;
      g.name = `${m.name || 'occluder'}_depth`;
      g.renderOrder = OCC.ghostOrder;
      g.castShadow = g.receiveShadow = false;
      g.raycast = noRaycast;
      g.userData.occGhost = true;
      g.visible = false;
      g.matrixAutoUpdate = false; // parent's frame (identity)
      m.add(g);
      g.updateMatrixWorld(true);
      return g;
    });
    return e.ghosts;
  }

  /** Call every frame, after the camera and the cat have moved. */
  update(dt) {
    const t0 = performance.now();
    const list = this.getOccluders?.() ?? [];
    // Object hit fewer than OCC.hold frames ago: still treated as hidden (rotating edge points).
    for (const e of this.entries.values()) { e.hold = e.seen ? OCC.hold : Math.max(0, (e.hold ?? 0) - 1); e.hit = e.seen = false; }
    const cam = this.camera.position, root = this.cat.position ?? this.cat.root?.position;
    const yaw = this.cat.rotation?.y ?? 0, fx = Math.sin(yaw), fz = Math.cos(yaw);
    // Points aimed at: cat (its root frame; side = perpendicular to forward), then targets.
    // The first OCC.axis every frame; edge points take turns, OCC.edges per frame.
    _targets.length = 0;
    if (root) {
      const nEdge = OCC.points.length - OCC.axis, k = (this._turn = ((this._turn ?? -1) + 1) % 1e6);
      for (let i = 0; i < OCC.points.length; i++) {
        if (i >= OCC.axis && nEdge > OCC.edges) {
          const j = i - OCC.axis, first = (k * OCC.edges) % nEdge;
          if ((j - first + nEdge) % nEdge >= OCC.edges) continue;
        }
        const [f, h, s] = OCC.points[i];
        const v = (this._pts ??= [])[i] ??= new THREE.Vector3();
        _targets.push(v.set(root.x + fx * f + fz * s, root.y + h, root.z + fz * f - fx * s));
      }
    }
    const extra = this.getTargets?.();
    if (extra) for (const p of extra) _targets.push(p);
    let hidden = 0, rays = 0;
    for (const obj of list) {
      const e = this.entries.get(obj) ?? this._track(obj);
      if (!this.enabled || !root || !obj.visible) continue;
      // Occluder with oriented boxes (Rampart.js): its axis-aligned box, too wide, does not decide alone.
      const inside = obj.userData.occContains ? obj.userData.occContains(cam) : e.box.containsPoint(cam);
      if (inside) { e.hit = e.seen = true; hidden++; continue; }
      for (const p of _targets) {
        _dir.copy(p).sub(cam);
        const len = _dir.length();
        if (len < 1e-4) continue;
        _dir.divideScalar(len);
        _ray.set(_from.copy(cam), _dir);
        _ray.far = len;
        rays++;
        if (!_ray.ray.intersectsBox(e.box)) continue;
        if (this._castMeshes(e, len)) { e.hit = true; break; }
      }
      e.seen = e.hit; // hit by a ray, or camera inside, this frame
      if (!e.hit && e.hold > 0) e.hit = true;
      if (e.hit) hidden++;
    }
    // Fades (also for objects no longer listed: back to opaque).
    const step = dt / OCC.fade * (1 - OCC.alpha);
    let faded = 0;
    for (const e of this.entries.values()) {
      const goal = e.hit ? OCC.alpha : 1;
      if (e.a === goal) { if (e.a < 1) faded++; continue; }
      const was = e.a;
      e.a = goal < e.a ? Math.max(goal, e.a - step) : Math.min(goal, e.a + step);
      if (e.a < 1) faded++;
      this._apply(e, was);
    }
    this.hidden = hidden;
    this.faded = faded;
    this.count = this.entries.size;
    this.rays = rays;
    this.ms = performance.now() - t0;
  }

  /** Raycast against an object's meshes, both sides of faces. */
  _castMeshes(e, len) {
    for (const m of e.meshes) {
      const list = Array.isArray(m.material) ? m.material : [m.material];
      const sides = list.map((mat) => mat.side);
      for (const mat of list) mat.side = THREE.DoubleSide;
      _hits.length = 0;
      m.raycast(_ray, _hits);
      list.forEach((mat, i) => { mat.side = sides[i]; });
      if (_hits.some((h) => h.distance <= len)) return true;
    }
    return false;
  }

  _apply(e, was) {
    const opaque = e.a >= 1;
    for (const s of e.mats) {
      const mat = s.m;
      if (opaque) {
        // Opaque: original settings.
        mat.opacity = s.opacity;
        if (mat.transparent !== s.transparent || mat.depthWrite !== s.depthWrite) {
          mat.transparent = s.transparent; mat.depthWrite = s.depthWrite; mat.needsUpdate = true;
        }
      } else {
        if (was >= 1 || !mat.transparent) { mat.transparent = true; mat.depthWrite = false; mat.needsUpdate = true; }
        mat.opacity = s.opacity * e.a;
      }
    }
    e.meshes.forEach((m, i) => { m.renderOrder = opaque ? e.orders[i] : OCC.fadedOrder; });
    if (!opaque || e.ghosts) for (const g of this._ghosts(e)) g.visible = !opaque;
  }
}
