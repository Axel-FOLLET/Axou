import * as THREE from 'three';

/**
 * Pointer input on the 3D scene: turns mouse clicks and touches into picks on butterflies, the cat, added targets
 * (`addTarget`: NPCs, yarn launcher…), the yarn, walls or the ground, and keeps `pointerWorld`, the pointer projected
 * on the ground. Created and wired by main.js.
 *
 * Click order: butterflies, cat / helmet (CAT_PICK), added targets, yarn, walls, ground. The first match consumes the
 * click.
 *
 * Gestures: a short touch is a click; a drag beyond `TAP_SLOP` px rotates the camera (OrbitControls); once a second
 * finger lands, the whole gesture stops being a click until all fingers are lifted. Mouse: only the main button
 * clicks.
 */
const TAP_SLOP = { mouse: 6, pen: 8, touch: 12 }; // px of movement tolerated for a click
const WALL_AHEAD = 0.02; // m: the stone must be at least this far in front of the ground hit (otherwise: ground)
const OPENING_DEPTH = 0.35; // m: stone hit up to this far in front of a window's mid-plane counts as the window's edge
const GROUND_AHEAD = 0.1; // m: ground hit at least this much closer than the added target = ground click (_click)
/**
 * Double click or double tap on the ground: the cat runs to the point, even a close one (`onGround(point, null, {
 * run: true })`). The single click is not delayed: the first click leaves at once (walk, trot or run by distance,
 * GOTO in Brain.js); the second, if in time and near the first, restarts the same path at a run. Only two ground
 * clicks count: a click on anything else in between cancels the pair.
 * `ms`: slightly tighter than the desktop default (Windows 500 ms), so that two deliberately separate clicks stay two
 * walks.
 * `px`: tolerated gap between the two presses on screen; a finger lands less precisely than a mouse (a quick double
 * tap moves 10 to 30 px).
 */
const DOUBLE = { ms: 400, px: { mouse: 24, pen: 32, touch: 48 } };
/**
 * Picking the cat outside its mesh. A ray passing between the folded legs of the lying cat would hit the ground
 * behind it and a double click would make it run. Outside the arena only: in combat, a click right next to the kitten
 * stays a dodge.
 *
 * Done in screen space on the edges of the posed mesh (`_catNear`): outside the mesh projection, the distance to the
 * silhouette is that of the nearest edge, so the test depends neither on vertex density nor on a per-bone table for
 * each clip. No "ground hit in front" guard: it would wrongly reject rays between the legs.
 */
const CAT_PICK = {
  // px: tolerance beyond the mesh on screen. Covers the largest gap of the lying pose in the default camera (9.2 px
  // radius) and leaves a margin below 30 px, where a click must still be a walk.
  marginPx: 14,
  // Share of the fur counted as cat: shell tips are sparse but visible (the base mesh misses the visible edge).
  // Length `furM × furMask` in m, converted to px by depth.
  furShare: 0.8,
  furM: 0.022, // m: same as MAX_LENGTH in src/cat/Fur.js
  // Pocket between the legs seen up close, where marginPx is no longer enough: edges within pocketM around the click,
  // on the whole circle except a free arc of at most pocketArcBins bins (of pocketBins, 15° each: 150°). From outside
  // a silhouette, the free arc exceeds 180°.
  pocketM: 0.03,
  pocketMaxPx: 29, // px: cap of this radius at minimum zoom (44 px otherwise), below the 30 px that must still walk
  pocketBins: 24,
  pocketArcBins: 10,
  helmetRays: 8, // rays of `_helmetNear`: the thin helmet outline cannot slip between them
};
const _catPt = new THREE.Vector3();
const _catMvp = new THREE.Matrix4();
const _catBins = new Uint8Array(CAT_PICK.pocketBins);
let _catScreen = new Float32Array(0); // body vertices on screen: x, y, px per metre (< 0: behind the camera)

export class Picker {
  constructor(world, cat, butterflies = null, yarn = null) {
    this.world = world;
    this.cat = cat;
    this.butterflies = butterflies; // src/critters/Butterflies.js (hunted on click)
    this.yarn = yarn;               // src/critters/Yarn.js (on click, the cat runs after it)
    this.onGround = null;           // (point: THREE.Vector3, wall?: onWall info, opts?: { run }) => void
    this.onCat = null;
    this.onYarn = null;             // click on the yarn
    this.onWall = null;             // ({ obstacle, surface, top, chain, point }) => void
    // () => true while clicks and touches on the scene are ignored (speech bubble open, main.js); the speech bubble
    // stops its own events (Bubble.js).
    this.blocked = null;
    this.onPointerType = null;      // called with 'mouse' | 'touch' | 'pen' on each press
    this.pointerWorld = new THREE.Vector3(0, 0.3, 2);
    this._ray = new THREE.Raycaster();
    this._ndc = new THREE.Vector2();
    this._down = null;              // press that may become a click: { id, x, y, type }
    this._pointers = new Set();     // pointers currently on the canvas
    this._multi = false;            // several fingers during this gesture: no click
    this._targets = [];             // added targets: { list, onPick, priority, seq }
    this._seq = 0;
    this._lastGround = null;        // last ground click: { t, x, y, type } (double click, DOUBLE)

    const el = world.renderer.domElement;
    this._el = el;
    el.addEventListener('pointerdown', (e) => this._press(e));
    el.addEventListener('pointermove', (e) => this._move(e));
    el.addEventListener('pointerup', (e) => this._up(e));
    el.addEventListener('pointercancel', (e) => this._release(e));
    // Context menu of a long press (Android) or right click: useless in the game.
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  /**
   * Adds a clickable target (NPC, yarn launcher…). Tested recursively. No occlusion test by walls (like butterflies):
   * a target behind a wall stays clickable; only ground hit in front of it (GROUND_AHEAD) takes the click (`_click`).
   * @param {THREE.Object3D|object|Array} objects an Object3D, an object with `hit(raycaster)` returning an
   *   intersection or null (e.g. `Npc.hit`), or an array of them
   * @param {(hit: object) => void} onPick receives the three intersection (`point`, `distance`, `object`…)
   * @param {object} [opts] `priority` (higher wins); `confirm(raycaster, hit, groundHit)`, called when the ground
   *   is hit behind the target: false gives the click back to the ground
   * @returns {() => void} removes the target
   */
  addTarget(objects, onPick, { priority = 0, confirm = null } = {}) {
    const list = Array.isArray(objects) ? objects.slice() : [objects];
    const t = { list, onPick, priority, confirm, seq: this._seq++ };
    this._targets.push(t);
    this._targets.sort((a, b) => b.priority - a.priority || a.seq - b.seq);
    return () => {
      const i = this._targets.indexOf(t);
      if (i >= 0) this._targets.splice(i, 1);
    };
  }

  /**
   * Objects counted as ground by the ray: `world.pickables` if non-empty (everything the cat can walk on), else the
   * terrain mesh (or the terrain itself if it is an Object3D) and `world.ground`. Tested recursively.
   */
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

  /** False if this object (or the root of an object with `hit`: NPC, boss) is not attached to a scene. */
  _inScene(o) {
    let n = o?.isObject3D ? o : (o?.root ?? o?.mesh);
    if (!n?.isObject3D) return true;
    while (n.parent) n = n.parent;
    return n.isScene === true;
  }

  /** Nearest hit on an added target (Object3D or object with `hit`), or undefined. */
  _targetHit(t) {
    let best;
    const objs = [];
    for (const o of t.list) {
      // Other zone (group removed from the scene, World.js): the ray would still hit it.
      if (!this._inScene(o)) continue;
      if (o?.isObject3D) objs.push(o);
      else if (typeof o?.hit === 'function') {
        const h = o.hit(this._ray);
        if (h && (!best || h.distance < best.distance)) best = h;
      }
    }
    if (objs.length) {
      const h = this._ray.intersectObjects(objs, true)[0];
      if (h && (!best || h.distance < best.distance)) best = h;
    }
    return best;
  }

  /** Added target hit: highest priority, then nearest. { t, hit } or null. */
  _pickTarget() {
    let best = null;
    for (const t of this._targets) {
      if (best && t.priority < best.t.priority) break; // sorted list: a lower priority cannot win
      const hit = this._targetHit(t);
      if (hit && (!best || hit.distance < best.hit.distance)) best = { t, hit };
    }
    return best;
  }

  _cast(e) {
    // Coordinates relative to the canvas (it covers the window, but without assuming so).
    const r = this._el.getBoundingClientRect();
    this._ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this._ray.setFromCamera(this._ndc, this.world.camera);
  }

  _press(e) {
    this.onPointerType?.(e.pointerType || 'mouse');
    // First pointer of a gesture: start afresh (a lost release does not block later clicks).
    if (e.isPrimary) { this._pointers.clear(); this._multi = false; }
    this._pointers.add(e.pointerId);
    if (this._pointers.size > 1) { this._multi = true; this._down = null; return; }
    if (e.pointerType === 'mouse' && e.button !== 0) { this._down = null; return; }
    this._down = { id: e.pointerId, x: e.clientX, y: e.clientY, type: e.pointerType || 'mouse' };
    if (e.pointerType !== 'mouse') this._move(e); // no hover on touch: the cat looks here
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
    // A drag is a camera rotation, a two-finger gesture a zoom: not a click.
    if (multi || !d || d.id !== e.pointerId) return;
    if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > (TAP_SLOP[d.type] ?? TAP_SLOP.mouse)) return;
    this._click(e);
  }

  /**
   * Click on a wall: is the stone hit in front of the ground hit? `ruins.climbTarget(point)` gives the closest
   * walkable top (low wall, top of a tall wall with rubble, rubble step, window sill). A click in a crossable window
   * (`ruins.openingHit(ray)`) aims at its sill even through the hole, unless the cat already stands on it. Stone with
   * no walkable top (church outside a sill, rock, arch): null, so the ground behind is used.
   * @param {object} [onGround] ground intersection
   * @returns {object|null} `ruins.climbTarget` info plus `point` (point clicked on the stone), or the opening info
   */
  _wallHit(onGround) {
    const ruins = this.world.ruins;
    const meshes = ruins?.meshes ?? (ruins?.mesh ? [ruins.mesh] : null);
    if (!meshes || typeof ruins.climbTarget !== 'function') return null;
    // Arena (starry night): ruins hidden behind the shell, nothing to climb. Zone 2: no ruins.
    if (this.world.inArena || this.world.inMountain) return null;
    const limit = onGround ? onGround.distance - WALL_AHEAD : Infinity;
    // Mesh faded out in front of the camera (Occlusion.js): the click goes through it, like the view.
    const solid = meshes.filter((m) => !(m.material?.transparent && m.material.opacity < 0.99));
    let hit = this._ray.intersectObjects(solid, false)[0];
    if (hit && hit.distance > limit) hit = null;
    // Crossable window: the ray goes through the opening (or hits its inner edges, within OPENING_DEPTH): aim at the
    // sill. Cat already standing on that sill: the click through the window aims at the ground beyond (otherwise it
    // could never come back down by clicking the other side).
    let op = ruins.openingHit?.(this._ray.ray);
    const cp = this.cat?.root?.position;
    if (op && cp && this.cat.brain?.onWall && ruins.surfaceAt?.(cp.x, cp.z) === op.surface) op = null;
    if (op && op.distance <= limit && (!hit || hit.distance > op.distance - OPENING_DEPTH)) return op;
    if (!hit) return null;
    const info = ruins.climbTarget(hit.point);
    if (!info) return null;
    info.point = hit.point;
    return info;
  }

  /**
   * Ground double click (DOUBLE): true if click `e` follows a ground click by less than `DOUBLE.ms`, within
   * `DOUBLE.px` on screen and with the same pointer type. A recognised pair is consumed (a third quick click starts
   * over).
   * @returns {boolean}
   */
  _doubleGround(e) {
    const type = e.pointerType || 'mouse';
    const now = e.timeStamp || performance.now();
    const last = this._lastGround;
    const run = !!last && last.type === type && now - last.t <= DOUBLE.ms
      && Math.hypot(e.clientX - last.x, e.clientY - last.y) <= (DOUBLE.px[type] ?? DOUBLE.px.mouse);
    this._lastGround = run ? null : { t: now, x: e.clientX, y: e.clientY, type };
    return run;
  }

  /**
   * Cat mesh hit by the ray, using the bounds of the displayed pose. Without the reset, three keeps the sphere (and
   * any box) of the pose of the first test and rejects rays on the visible cat. Outside the arena only: in combat,
   * the click stays tuned as a dodge.
   */
  _catMeshHit() {
    if (!this.world.inArena) {
      for (const m of this.cat.meshes) {
        if (m.isSkinnedMesh) { m.boundingSphere = null; m.boundingBox = null; }
      }
    }
    return this._ray.intersectObjects(this.cat.meshes, false)[0];
  }

  /**
   * Click outside the mesh but on the cat as displayed (CAT_PICK), outside the arena. Vertices posed by the bones
   * (pose of the last render, the one displayed) and projected on screen; each triangle edge counts by its distance
   * to the click.
   * @returns {THREE.Vector3|null} a point on the body, or null
   */
  _catNear(e) {
    if (this.world.inArena) return null;
    const body = this.cat.meshes.find((m) => m.name === 'CatBody') ?? this.cat.meshes.find((m) => m.isSkinnedMesh);
    const geo = body?.geometry;
    const pos = geo?.attributes.position;
    const index = geo?.index;
    if (!pos || !index) return null;
    const fur = geo.attributes.furMask;
    const cam = this.world.camera;
    const rect = this._el.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    _catMvp.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse).multiply(body.matrixWorld);
    const m = _catMvp.elements;
    const scale = rect.height * 0.5 * cam.projectionMatrix.elements[5];
    if (_catScreen.length < pos.count * 3) _catScreen = new Float32Array(pos.count * 3);
    const s = _catScreen;
    for (let i = 0, j = 0; i < pos.count; i++, j += 3) {
      body.getVertexPosition(i, _catPt);
      const { x, y, z } = _catPt;
      const w = m[3] * x + m[7] * y + m[11] * z + m[15];
      if (w <= cam.near) { s[j + 2] = -1; continue; }
      s[j] = ((m[0] * x + m[4] * y + m[8] * z + m[12]) / w * 0.5 + 0.5) * rect.width;
      s[j + 1] = (0.5 - (m[1] * x + m[5] * y + m[9] * z + m[13]) / w * 0.5) * rect.height;
      s[j + 2] = scale / w;
    }
    const { marginPx, furShare, furM, pocketM, pocketMaxPx, pocketBins, pocketArcBins } = CAT_PICK;
    const mark = (x, y) => {
      const k = Math.floor((Math.atan2(y - cy, x - cx) / (2 * Math.PI) + 0.5) * pocketBins);
      _catBins[Math.min(k, pocketBins - 1)] = 1;
    };
    _catBins.fill(0);
    const idx = index.array;
    let nearest = -1;
    let nearestD = Infinity;
    for (let t = 0; t < index.count; t += 3) {
      for (let c = 0; c < 3; c++) {
        const a = idx[t + c];
        const b = idx[t + (c + 1) % 3];
        const pa = s[a * 3 + 2];
        const pb = s[b * 3 + 2];
        if (pa < 0 || pb < 0) continue;
        const ax = s[a * 3];
        const ay = s[a * 3 + 1];
        const dx = s[b * 3] - ax;
        const dy = s[b * 3 + 1] - ay;
        const l2 = dx * dx + dy * dy;
        const u = l2 > 0 ? Math.min(1, Math.max(0, ((cx - ax) * dx + (cy - ay) * dy) / l2)) : 0;
        const px = ax + u * dx;
        const py = ay + u * dy;
        const d = Math.hypot(cx - px, cy - py);
        const perM = pa + u * (pb - pa);
        if (d < nearestD) { nearestD = d; nearest = u < 0.5 ? a : b; }
        const furPx = fur ? furM * (fur.getX(a) + u * (fur.getX(b) - fur.getX(a))) * perM : 0;
        const radius = Math.min(pocketM * perM, pocketMaxPx);
        if (d <= marginPx + furShare * furPx) return this._catVertex(body, nearest);
        if (d <= radius) mark(px, py);
        if (Math.hypot(cx - ax, cy - ay) <= radius) mark(ax, ay);
      }
    }
    if (nearest < 0 || !_catBins.includes(1)) return null;
    // Longest free arc; bins read over two turns to catch the arc crossing bin 0.
    let run = 0;
    let longest = 0;
    for (let i = 0; i < pocketBins * 2; i++) {
      run = _catBins[i % pocketBins] ? 0 : run + 1;
      longest = Math.max(longest, run);
    }
    return longest <= pocketArcBins ? this._catVertex(body, nearest) : null;
  }

  /**
   * Click within marginPx of the worn helmet, outside the arena: same tolerance as the body, including the black
   * outline of the helmet, visible but absent from `helmet.hit`. Rays offset by marginPx around the click; the click
   * ray is restored for the rest of `_click`.
   * @returns {THREE.Vector3|null} point on the helmet, or null
   */
  _helmetNear(e) {
    const helmet = this.cat.helmet;
    if (this.world.inArena || !helmet) return null;
    let point = null;
    for (let i = 0; i < CAT_PICK.helmetRays && !point; i++) {
      const a = (i / CAT_PICK.helmetRays) * 2 * Math.PI;
      this._cast({
        clientX: e.clientX + Math.cos(a) * CAT_PICK.marginPx,
        clientY: e.clientY + Math.sin(a) * CAT_PICK.marginPx,
      });
      point = helmet.hit(this._ray)?.point ?? null;
    }
    this._cast(e);
    return point;
  }

  /** Body vertex `i`, posed, in world coordinates. */
  _catVertex(body, i) {
    return body.getVertexPosition(i, new THREE.Vector3()).applyMatrix4(body.matrixWorld);
  }

  _click(e) {
    if (this.blocked?.()) return;
    // Any click other than on the ground cancels a pending pair (restored below for the ground).
    const lastGround = this._lastGround;
    this._lastGround = null;
    this._cast(e);
    // Butterfly first (small click sphere): the cat hunts it if it has landed; a butterfly in flight or too far
    // consumes the click with no effect (no surprise walk to the ground behind it).
    // Arena: butterflies are hidden (World.arenaExtras) but the Raycaster ignores `visible`, so they are not tested
    // and the click goes to the dodge. Zone 2: same, butterflies and yarn stayed in the meadow.
    const b = this.world.inArena || this.world.inMountain ? null : this.butterflies?.pick(this._ray);
    if (b) { this.cat.brain.hunt(b); return; }
    // Helmet: its meshes ignore the Raycaster; `helmet.hit` returns a three intersection (`point`, `distance`) or
    // null. Only `point` is read here.
    const onCat = this._catMeshHit() ?? this.cat.helmet?.hit(this._ray);
    if (onCat) { this.onCat?.(onCat.point); return; }
    const near = this._catNear(e);
    if (near) { this.onCat?.(near); return; }
    const nearHelmet = this._helmetNear(e);
    if (nearHelmet) { this.onCat?.(nearHelmet); return; }
    // Added target (NPC, boss…): taken unless the ground is hit more than GROUND_AHEAD in front of it on the ray: the
    // player sees the ground, not the target (boss click box overflowing its silhouette, or NPC hidden by a mound);
    // the click then goes to the yarn, walls and ground (dodge in combat). Ground behind the target: the target may
    // still refuse the click (`confirm`, boss box outside its body).
    const onGround = this._groundHit();
    const target = this._pickTarget();
    const keep = target && (!onGround || (onGround.distance >= target.hit.distance - GROUND_AHEAD
      && (!target.t.confirm || target.t.confirm(this._ray, target.hit, onGround) !== false)));
    if (keep) { target.t.onPick(target.hit); return; }
    if (!this.world.inMountain && this.yarn?.pick(this._ray)) { this.onYarn?.(); return; }
    const wall = this._wallHit(onGround);
    if (wall) {
      if (this.onWall) this.onWall(wall);
      else this.onGround?.(wall.top, wall);
      return;
    }
    if (!onGround) return;
    this._lastGround = lastGround;
    this.onGround?.(onGround.point, null, { run: this._doubleGround(e) });
  }
}
