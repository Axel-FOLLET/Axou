import * as THREE from 'three';
import { STONE, jitter, toonMaterial } from '../style/palette.js';
import { CLEARING } from './Forest.js';
import { rng } from './random.js';

/**
 * Sword in the stone, in the Chartiste's clearing (Forest.js CLEARING), visible from the start of the game; created by
 * main.js, tuned through SWORD, also read by Story.js. The combat arena is built around the Chartiste
 * (World.enterArena, radius 11 m), so the sword is inside it, within a few metres of the kitten throughout the fight.
 *
 * Geometry follows anim_cat.py (make_sword, make_stone, SWORD_HOLD; the cat is about 10 units long). Local frame = Blender
 * frame: X along the blade (pommel at -X, tip at +X), Y thickness, Z width, origin at the middle of the grip. The
 * in-mouth hold is frame `L` in the Head bone frame (`calibrate`); the planted frame `P0` and the stone come from the
 * SwordPull clip, animated against the same stone and grip positions.
 *
 * The sword is taken during cutscene 2 (video, src/game/story/swordCutscene.js): when it ends the stone is `split` in two
 * halves and the sword is `take`n, held in the mouth (it follows the Head bone).
 *
 * Interface: `new Sword(scene, cat)`; `place(world)` (stone, `npc_sword` obstacle, grass); `update(dt, camera)` every
 * frame AFTER `cat.update`; `hit(raycaster)` (Picker, null when `canTake()` is false); `split()`, `take()`, `drop()`,
 * `reset()`; `state`, `cleft`.
 */

/**
 * Settings:
 * - `stance`: the kitten's spot in front of the stone, the frame the planted sword is expressed in: `ahead` 3.2 m from the
 *   clearing centre towards the origin, `side` 2.2 m away from the easel; inside the clearing (radius 4.5 m), clear of the
 *   Chartiste and boss footprints (combat.js BOSS.foot).
 * - `pull`: SwordPull clip times (s) of bite and release: PULL_T_GRAB / FREE from anim_cat.py, rounded to exported frames
 *   (round(t x 24) / 24). They give the planted position of the sword and where its tip enters the stone.
 * - `pick`: click sphere around stone and grip, at least `radius` 0.3 m (the stone is about 0.2 m, a finger reaches it).
 * - `light`: golden light column on the stone (additive open cylinder, one draw call, no scene light); `idle` 0.35
 *   during the fight while the sword can be taken, `ground` 0.45 relit on the sword on the ground after victory; `rise`
 *   0.6 s, `fade` 0.8 s; `radius` 0.22 m, `height` 2.4 m (above the standing kitten).
 * - `drop`: fall of the released sword in `time` 0.45 s (a 0.3 m free fall takes 0.25 s, lengthened to be readable),
 *   lying flat; `yaw` 0.6 rad ground rotation so it does not land along the head axis; `scale` 1.8: it grows while
 *   falling (0.35 to 0.63 m) to stay readable at play distance; `lift` m above the ground (guard thickness).
 * - `stone`: `margin` 0.8 unit around the planted blade (anim_cat.py make_stone), top reduced to `top` 0.75; warm grey
 *   of the game's boulders (STONE.boulder, STONE.boulderShade); `jitter` 0.05 colour variation.
 * - `split`: stone cut in two along the blade (`split()`): halves `gap` 0.05 m apart at the cut, each leaning outward by
 *   `tilt` 0.12 rad about its cut edge, as if the brush stroke had pushed them apart; cut faces `fresh` 0.3 lighter
 *   (share of white mixed in) than the top, the rock inside being new.
 */
export const SWORD = {
  stance: { ahead: 3.2, side: 2.2 },
  pull: { grab: 19 / 24, free: 46 / 24 },
  pick: { radius: 0.3 },
  light: { radius: 0.22, height: 2.4, idle: 0.35, ground: 0.45, fade: 0.8, rise: 0.6, color: 0xffe2a0 },
  drop: { time: 0.45, yaw: 0.6, scale: 1.8, lift: 0.03 },
  stone: { margin: 0.8, top: 0.75, color: STONE.boulder, shade: STONE.boulderShade, jitter: 0.05 },
  split: { gap: 0.05, tilt: 0.12, fresh: 0.3 },
};

/** Geometry from anim_cat.py (Blender units of the cat). */
const SW_GRIP = 0.75, SW_GUARD = 0.14, SW_BLADE = 4.0;
const X_TIP = SW_GRIP + SW_GUARD + SW_BLADE;
const GOLD = [0.85, 0.65, 0.15];
const PARTS = [
  // [x0, x1, hy0, hz0, hy1, hz1, linear colour (Blender diffuse_color)]
  [-SW_GRIP, SW_GRIP, 0.1, 0.1, 0.1, 0.1, [0.35, 0.18, 0.08]],
  [-SW_GRIP - 0.22, -SW_GRIP, 0.15, 0.15, 0.15, 0.15, GOLD],
  [SW_GRIP, SW_GRIP + SW_GUARD, 0.12, 0.6, 0.12, 0.6, GOLD],
  [SW_GRIP + SW_GUARD, X_TIP, 0.035, 0.17, 0.01, 0.02, [0.82, 0.86, 0.9]],
];
const SWORD_GRIP = new THREE.Vector3(0, -4.15, 2.32);   // Blender, armature frame
const SWORD_DIR = new THREE.Vector3(Math.cos(THREE.MathUtils.degToRad(15)), Math.sin(THREE.MathUtils.degToRad(15)), Math.sin(THREE.MathUtils.degToRad(5))).normalize();

/** Prism along X (anim_cat.py _prism): 6 faces of 2 triangles, unshared vertices. */
function prism(pos, col, [x0, x1, hy0, hz0, hy1, hz1, c]) {
  const v = [[x0, -hy0, -hz0], [x0, hy0, -hz0], [x0, hy0, hz0], [x0, -hy0, hz0],
    [x1, -hy1, -hz1], [x1, hy1, -hz1], [x1, hy1, hz1], [x1, -hy1, hz1]];
  const faces = [[0, 3, 2, 1], [4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]];
  for (const [a, b, cc, d] of faces) {
    for (const i of [a, b, cc, a, cc, d]) { pos.push(...v[i]); col.push(...c); }
  }
}

function swordGeometry() {
  const pos = [], col = [];
  for (const p of PARTS) prism(pos, col, p);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}

/** Frame from anim_cat.py _frame: columns x, y = up x x, z = x x y. */
function frame(x, up = new THREE.Vector3(0, 0, 1)) {
  const X = x.clone().normalize();
  const Y = new THREE.Vector3().crossVectors(up, X).normalize();
  const Z = new THREE.Vector3().crossVectors(X, Y);
  return new THREE.Matrix4().makeBasis(X, Y, Z);
}

/** Blender (x, y, z) to glTF (x, z, -y). */
const BLENDER_TO_GLTF = new THREE.Matrix4().set(1, 0, 0, 0, 0, 0, 1, 0, 0, -1, 0, 0, 0, 0, 0, 1);

const LIGHT_VERT = /* glsl */ `
varying float vY;
varying float vFace;
void main() {
  vY = uv.y;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vec3 n = normalize(normalMatrix * normal);
  vFace = abs(dot(n, normalize(-mv.xyz)));
  gl_Position = projectionMatrix * mv;
}
`;
const LIGHT_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uI;
varying float vY;
varying float vFace;
void main() {
  float a = uI * pow(1.0 - vY, 1.6) * smoothstep(0.0, 0.08, vY) * pow(vFace, 1.5) * 0.55;
  if (a < 0.003) discard;
  gl_FragColor = vec4(uColor * a, a);
}
`;
const _m = new THREE.Matrix4();
const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _u = new THREE.Vector3();
const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _s = new THREE.Vector3();
const _p = new THREE.Vector3(), _p2 = new THREE.Vector3();

export class Sword {
  constructor(scene, cat, o = SWORD) {
    this.o = o;
    this.scene = scene;
    this.cat = cat;
    this.state = 'stone';      // 'stone' | 'held' | 'drop' | 'ground'
    this.canTake = null;       // () => true if a click can take it (Story: combat, 'fight' phase)
    this.cleft = false;        // stone split in two halves (`split`), back whole by `reset`

    this.mesh = new THREE.Mesh(swordGeometry(), toonMaterial(0xffffff, { vertexColors: true }));
    this.mesh.name = 'Sword';
    this.mesh.matrixAutoUpdate = false;
    this.mesh.castShadow = true;
    this.mesh.frustumCulled = false; // follows the head: its local box does not move with the hand-set matrix
    scene.add(this.mesh);

    this.stone = null; // whole stone, set by place()
    this.halves = null; // the two halves of the split stone, set by place()

    const L = o.light;
    const lg = new THREE.CylinderGeometry(L.radius * 0.7, L.radius, L.height, 20, 1, true);
    lg.translate(0, L.height / 2, 0);
    this.lightUniforms = { uColor: { value: new THREE.Color(L.color) }, uI: { value: 0 } };
    this.light = new THREE.Mesh(lg, new THREE.ShaderMaterial({
      vertexShader: LIGHT_VERT, fragmentShader: LIGHT_FRAG, uniforms: this.lightUniforms,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
    }));
    this.light.name = 'SwordLight';
    this.light.visible = false;
    this.light.renderOrder = 4;
    scene.add(this.light);

    this._lightI = 0;     // current intensity of the column
    this._drop = null;    // fall: { t, from: Matrix4, to: Matrix4 }
    this._groundM = new THREE.Matrix4();
    this.calibrate(cat);
  }

  /**
   * Frames computed once from the SwordPull clip played by a temporary mixer: `L` (held sword, Head bone frame), `P0`
   * (planted, cat root frame), axis `u`, and the slide `sFree` of the blade out of the stone, which gives the entry point.
   * The body is laid flat with its lowest point on the ground, as in Cat.update; the cat's pose is rendered again afterwards.
   */
  calibrate(cat) {
    const o = this.o.pull;
    const body = cat.meshes.find((m) => m.name === 'CatBody') ?? cat.meshes[0];
    const head = cat.rig.head;
    const idx = body.skeleton.bones.indexOf(head);
    const hold = new THREE.Matrix4().makeTranslation(SWORD_GRIP).multiply(frame(SWORD_DIR));
    this.L = new THREE.Matrix4().copy(body.skeleton.boneInverses[idx]).multiply(body.bindMatrix)
      .multiply(BLENDER_TO_GLTF).multiply(hold);
    const clip = cat.clips.SwordPull;
    const H = {};
    const saved = { y: cat.body.position.y, rx: cat.body.rotation.x, rz: cat.body.rotation.z };
    const rootInv = new THREE.Matrix4();
    if (clip) {
      const mixer = new THREE.AnimationMixer(cat.model);
      const a = mixer.clipAction(clip);
      a.play();
      for (const [k, t] of [['grab', o.grab], ['free', o.free]]) {
        mixer.setTime(t);
        cat.body.rotation.x = cat.body.rotation.z = 0;
        cat.body.position.y = cat.pivotY;
        cat.root.updateMatrixWorld(true);
        const minY = cat._lowestVertexY();
        cat.body.position.y = cat.pivotY - (minY - cat.root.position.y) + 0.004;
        cat.root.updateMatrixWorld(true);
        rootInv.copy(cat.root.matrixWorld).invert();
        H[k] = new THREE.Matrix4().multiplyMatrices(rootInv, head.matrixWorld);
      }
      a.stop();
      mixer.uncacheRoot(cat.model);
    } else {
      // Clip missing (fallback): head of the current pose, no slide, no stone offset.
      cat.root.updateMatrixWorld(true);
      rootInv.copy(cat.root.matrixWorld).invert();
      H.grab = H.free = new THREE.Matrix4().multiplyMatrices(rootInv, head.matrixWorld);
    }
    cat.body.position.y = saved.y; cat.body.rotation.x = saved.rx; cat.body.rotation.z = saved.rz;
    cat.mixer.update(0);
    cat.root.updateMatrixWorld(true);

    this.H = H;
    this.P0 = new THREE.Matrix4().multiplyMatrices(H.grab, this.L);
    this.u = new THREE.Vector3().setFromMatrixColumn(this.P0, 0).normalize();
    this.gl = new THREE.Vector3().setFromMatrixPosition(this.L);
    this.mg = this.gl.clone().applyMatrix4(H.grab);
    this.sFree = this._slide(H.free, this.mg, this.u);
    // Tip and entry point of the blade in the stone (root frame).
    this.tip = new THREE.Vector3(X_TIP, 0, 0).applyMatrix4(this.P0);
    this.entry = this.tip.clone().addScaledVector(this.u, -this.sFree);
    this.k = cat.model.scale.x; // Blender unit to m
  }

  /** Slide along -u of the held grip (head matrix Hm), from `mg`; >= 0. */
  _slide(Hm, mg, u) {
    return Math.max(0, _w.copy(this.gl).applyMatrix4(Hm).sub(mg).dot(_u.copy(u).negate()));
  }

  /**
   * Kitten spot, stone, light column, `npc_sword` obstacle (kept by World.enterArena through its `npc_` prefix) and
   * grass removed around it. Call once, before `cat.brain.setWorld`.
   */
  place(world) {
    this.world = world;
    const O = this.o;
    const ox = -CLEARING.x, oz = -CLEARING.z, d = Math.hypot(ox, oz) || 1;
    const dx = ox / d, dz = oz / d, nx = -dz, nz = dx;
    const x = CLEARING.x + dx * O.stance.ahead - nx * O.stance.side;
    const z = CLEARING.z + dz * O.stance.ahead - nz * O.stance.side;
    const g = world.terrain.heightAt(x, z);
    const yaw = Math.atan2(CLEARING.x - x, CLEARING.z - z);
    this.stance = { x, z, yaw, y: g };
    this.S = new THREE.Matrix4().compose(new THREE.Vector3(x, g, z), new THREE.Quaternion().setFromAxisAngle(_v.set(0, 1, 0), yaw), new THREE.Vector3(1, 1, 1));
    this.P0w = new THREE.Matrix4().multiplyMatrices(this.S, this.P0);

    // Stone (make_stone): truncated pyramid on the ground around the planted blade, root frame.
    const St = O.stone, k = this.k, T = this.entry, P = this.tip;
    const cx = (T.x + P.x) / 2, cz = (T.z + P.z) / 2;
    const a = Math.abs(T.x - P.x) / 2 + St.margin * k, b = Math.abs(T.z - P.z) / 2 + St.margin * k;
    const h = Math.max(T.y + 0.05 * k, 0.02);
    const shape = this._stoneShape(cx, cz, a, b, h, St);
    this.stone = this._stoneMesh(shape);
    this.halves = this._halvesGroup(shape);
    for (const o of [this.stone, this.halves]) {
      o.matrixAutoUpdate = false;
      o.matrix.copy(this.S);
      o.matrixWorldNeedsUpdate = true;
      this.scene.add(o);
    }

    const c = _v.set(cx, 0, cz).applyMatrix4(this.S);
    this.stoneCenter = c.clone();
    this.stoneTop = new THREE.Vector3(c.x, g + h, c.z);
    this.light.position.set(c.x, g, c.z);
    this.light.updateMatrix();
    // Click sphere: stone and grip.
    const grip = new THREE.Vector3().setFromMatrixPosition(this.P0w);
    this.pickCenter = grip.clone().add(this.stoneTop).multiplyScalar(0.5);
    this.pickRadius = Math.max(O.pick.radius, grip.distanceTo(this.stoneTop) / 2 + 0.12);
    this.pickSphere = new THREE.Sphere(this.pickCenter, this.pickRadius);

    this.obstacle = { name: 'npc_sword', x: c.x, z: c.z, hx: a, hz: b, rotY: yaw, top: g + h, ground: g, height: h, climbable: false };
    world.addObstacles([this.obstacle], { grass: false });
    world.addGrassExclusions([{ x: c.x, z: c.z, r: Math.hypot(a, b) + 0.15 }]);
    this.reset();
  }

  /**
   * Shape of the stone: two rings of eight points (bottom `lo`, top `hi` reduced to St.top), the top centre and three colours
   * (dark foot, light flank, lighter top), in the root frame. The points sit at the angles (i + 1/2) x 45 deg, so the plane
   * z = cz of the cut passes between two points on each side.
   */
  _stoneShape(cx, cz, a, b, h, St) {
    const n = 8, rand = rng(7);
    const ring = (y, s) => Array.from({ length: n }, (_, i) => {
      const t = (i / n) * Math.PI * 2 + Math.PI / n, r = 1 + (rand() - 0.5) * 0.12;
      return [cx + Math.cos(t) * a * s * r * 1.08, y, cz + Math.sin(t) * b * s * r * 1.08];
    });
    const lo = ring(0, 1), hi = ring(h, St.top);
    const top = [cx, h + 0.006, cz];
    const c0 = jitter(St.shade, St.jitter, rand), c1 = jitter(St.color, St.jitter, rand), c2 = jitter(St.color, St.jitter, rand).lerp(new THREE.Color(0xffffff), 0.12);
    return { n, cx, cz, lo, hi, top, c0, c1, c2 };
  }

  /** Geometry of triangles with vertex colours from a list of [position, colour] pushes; `origin` is subtracted from positions. */
  _coloredGeometry(triangles, origin = [0, 0, 0]) {
    const pos = [], col = [];
    for (const [p, c] of triangles) {
      pos.push(p[0] - origin[0], p[1] - origin[1], p[2] - origin[2]);
      col.push(c.r, c.g, c.b);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.computeVertexNormals();
    return g;
  }

  _stoneMesh({ n, lo, hi, top, c0, c1, c2 }) {
    const tri = [];
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      // Side: dark bottom, light top (cast shadow at the foot, like the boulders of the ruins).
      tri.push([lo[i], c0], [hi[i], c1], [hi[j], c1], [lo[i], c0], [hi[j], c1], [lo[j], c0]);
      tri.push([hi[i], c1], [top, c2], [hi[j], c1]);
    }
    // Outward faces come from the vertex order (bottom to top, clockwise seen from above); DoubleSide removes any
    // doubt on so small an object.
    const m = new THREE.Mesh(this._coloredGeometry(tri), toonMaterial(0xffffff, { vertexColors: true, side: THREE.DoubleSide }));
    m.name = 'SwordStone';
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  }

  /**
   * The stone cut in two along the vertical plane z = cz (the direction of the blade): each half keeps four points of each
   * ring plus the two points where the plane crosses the ring, and a flat cut face of fresh rock. Each half is a mesh whose
   * origin is on the cut at ground level (rotation pivot, see SWORD.split).
   */
  _halvesGroup({ n, cx, cz, lo, hi, top, c0, c1, c2 }) {
    const G = this.o.split;
    const fresh = c2.clone().lerp(new THREE.Color(0xffffff), G.fresh);
    // Point where the plane crosses the edge i -> j of a ring.
    const cross = (r, i, j) => {
      const u = (cz - r[i][2]) / (r[j][2] - r[i][2]);
      return [r[i][0] + (r[j][0] - r[i][0]) * u, r[i][1], cz];
    };
    const group = new THREE.Group();
    group.name = 'SwordStoneCleft';
    for (const side of [1, -1]) {
      // Points on the side z > cz are 0 to n/2 - 1, the others n/2 to n - 1; the crossings are on the edges (n/2 - 1, n/2)
      // and (n - 1, 0).
      const first = side > 0 ? 0 : n / 2;
      const edgeA = side > 0 ? [n - 1, 0] : [n / 2 - 1, n / 2], edgeB = side > 0 ? [n / 2 - 1, n / 2] : [n - 1, 0];
      const poly = (r) => [cross(r, ...edgeA), ...r.slice(first, first + n / 2), cross(r, ...edgeB)];
      const pl = poly(lo), ph = poly(hi);
      const tri = [];
      for (let k = 0; k < pl.length - 1; k++) {
        tri.push([pl[k], c0], [ph[k], c1], [ph[k + 1], c1], [pl[k], c0], [ph[k + 1], c1], [pl[k + 1], c0]);
        tri.push([ph[k], c1], [top, c2], [ph[k + 1], c1]);
      }
      const last = pl.length - 1;
      tri.push([pl[0], fresh], [pl[last], fresh], [ph[last], fresh], [pl[0], fresh], [ph[last], fresh], [ph[0], fresh]);
      const m = new THREE.Mesh(this._coloredGeometry(tri, [cx, 0, cz]), toonMaterial(0xffffff, { vertexColors: true, side: THREE.DoubleSide }));
      m.name = 'SwordStoneHalf';
      m.position.set(cx, 0, cz + side * G.gap / 2);
      m.rotation.x = side * G.tilt;
      m.castShadow = true;
      m.receiveShadow = true;
      group.add(m);
    }
    group.visible = false;
    return group;
  }

  /** Sword back in the whole stone (new game, replay, step skips). */
  reset() {
    this.state = 'stone';
    this.cleft = false;
    if (this.stone) { this.stone.visible = true; this.halves.visible = false; }
    this._drop = null;
    this._lightI = 0;
    if (this.stoneCenter) { this.light.position.set(this.stoneCenter.x, this.stance.y, this.stoneCenter.z); this.light.updateMatrix(); }
    this._setMatrix(this.P0w ?? _m.identity());
  }

  /** Click (Picker.addTarget): intersection with the stone's sphere, or null. */
  hit(raycaster) {
    if (this.state !== 'stone' || !this.pickSphere || !this.canTake?.()) return null;
    const p = raycaster.ray.intersectSphere(this.pickSphere, _p);
    if (!p) return null;
    return { point: p.clone(), distance: raycaster.ray.origin.distanceTo(p), object: this.stone };
  }

  /** The stone is cut in two halves (the brush stroke of cutscene 2); `reset` makes it whole again. */
  split() {
    this.cleft = true;
    this.stone.visible = false;
    this.halves.visible = true;
  }

  /** Sword held (end of cutscene 2): follows the Head bone. */
  take() { this.state = 'held'; }

  /** Victory: the sword falls from the mouth and lies on the ground. */
  drop() {
    if (this.state !== 'held') return;
    const from = this.mesh.matrix.clone();
    from.decompose(_p, _q, _s);
    // Blade axis flat (horizontal), turned by SWORD.drop.yaw; thickness (local Y) vertical.
    const ax = _v.setFromMatrixColumn(from, 0).setY(0);
    if (ax.lengthSq() < 1e-6) ax.set(1, 0, 0);
    ax.normalize().applyAxisAngle(_w.set(0, 1, 0), this.o.drop.yaw);
    const X = ax.clone(), Y = new THREE.Vector3(0, 1, 0), Z = new THREE.Vector3().crossVectors(X, Y);
    const rot = new THREE.Matrix4().makeBasis(X, Y, Z);
    const k = this.k * this.o.drop.scale;
    const g = this.world.terrain.heightAt(_p.x, _p.z);
    // Resting on the guard (half thickness 0.12 unit x scale): blade flat, just above the ground.
    const to = rot.clone().scale(_s.setScalar(k)).setPosition(_p.x, g + 0.12 * k + this.o.drop.lift, _p.z);
    this._drop = { t: 0, from, to };
    this.state = 'drop';
    // Light column relit on the sword on the ground (light.ground): marker after victory.
    this.light.position.set(_p.x, g, _p.z);
    this.light.updateMatrix();
  }

  /** World matrix of the sword, set by hand (object at the scene root). */
  _setMatrix(m) {
    this.mesh.matrix.copy(m);
    this.mesh.matrixWorldNeedsUpdate = true;
  }

  /** Every frame, after cat.update (head bone up to date). */
  update(dt, camera) {
    const O = this.o, head = this.cat.rig.head;
    let lightTo = 0;
    switch (this.state) {
      case 'stone':
        this._setMatrix(this.P0w);
        if (this.canTake?.()) lightTo = O.light.idle;
        break;
      case 'held':
        this._setMatrix(_m.multiplyMatrices(head.matrixWorld, this.L));
        break;
      case 'drop': {
        const D = this._drop;
        D.t += dt;
        const e = Math.min(D.t / O.drop.time, 1), f = e * e; // fall: accelerating
        D.from.decompose(_p, _q, _s);
        D.to.decompose(_p2, _q2, _w);
        _p.lerp(_p2, f); _q.slerp(_q2, f); _s.lerp(_w, e);
        this._setMatrix(_m.compose(_p, _q, _s));
        if (e >= 1) { this.state = 'ground'; this._groundM.copy(D.to); }
        lightTo = O.light.ground * e;
        break;
      }
      case 'ground': lightTo = O.light.ground; break; // matrix kept
      default: break;
    }
    // Light column: rises in `rise` s, fades in `fade` s.
    const rate = lightTo > this._lightI ? 1 / O.light.rise : 1 / O.light.fade;
    this._lightI = lightTo > this._lightI ? Math.min(lightTo, this._lightI + rate * dt) : Math.max(lightTo, this._lightI - rate * dt);
    this.lightUniforms.uI.value = this._lightI;
    this.light.visible = this._lightI > 0.003;
  }

  /** State (for tests). */
  get info() {
    const r = (v) => Math.round(v * 1000) / 1000;
    const grip = new THREE.Vector3().setFromMatrixPosition(this.mesh.matrix);
    return {
      state: this.state, split: this.cleft, sFree: r(this.sFree), k: r(this.k),
      stance: this.stance && { x: r(this.stance.x), z: r(this.stance.z), yaw: r(this.stance.yaw) },
      stone: this.obstacle && { x: r(this.obstacle.x), z: r(this.obstacle.z), hx: r(this.obstacle.hx), hz: r(this.obstacle.hz), height: r(this.obstacle.height) },
      grip: { x: r(grip.x), y: r(grip.y), z: r(grip.z) }, light: r(this._lightI),
    };
  }
}
