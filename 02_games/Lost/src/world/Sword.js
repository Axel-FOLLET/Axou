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
 * in-mouth hold is frame `L` in the Head bone frame (`calibrate`); the SwordPull clip was animated against the same
 * stone and grip positions.
 *
 * Pull: before the bite (`grab`) the sword is planted (P0); from bite to release (`free`) it slides along its axis by
 * the held grip's displacement projected on that axis; from release to `held` its frame blends into `L`; then it
 * follows the Head bone.
 *
 * Interface: `new Sword(scene, cat)`; `place(world)` (stone, `npc_sword` obstacle, grass); `update(dt, camera)` every
 * frame AFTER `cat.update`; `hit(raycaster)` (Picker, null when `canTake()` is false); `beginPull()`, `take()`,
 * `drop()`, `reset()`; `state`.
 */

/**
 * Settings:
 * - `stance`: the kitten's spot for the pull: `ahead` 3.2 m from the clearing centre towards the origin, `side` 2.2 m
 *   away from the easel; inside the clearing (radius 4.5 m), clear of the Chartiste and boss footprints (combat.js
 *   BOSS.foot), about 3 m from the kitten during the transformation, so it sees the sword on arrival.
 * - `pull`: SwordPull clip times (s) of bite, release and held: PULL_T_GRAB / FREE / HELD from anim_cat.py, rounded to
 *   exported frames (round(t x 24) / 24).
 * - `slow`: brief slow motion at blade release: game time x `rate` (0.25) from `from` to `to` s of the clip (0.15 s
 *   before release, 0.35 s after), about 2 real seconds on the strongest gesture.
 * - `pick`: click sphere around stone and grip, at least `radius` 0.3 m (the stone is about 0.2 m, a finger reaches
 *   it); `arrive` 0.45 m: the kitten stopped within this distance of its spot starts the pull.
 * - `cam`: three-quarter close-up (`angle` 1.0 rad from the kitten's front), `dist` 1.7 m (ears and tail clear the
 *   letterbox at blade release), `height` 0.45 m; `rate` 3: glide 95% done in 1 s, before the bite.
 * - `run`: shot of the run to the stone, cut on click (Story._runShot): aim between kitten and stone raised by `lift`
 *   m, camera behind the kitten turned by `angle` rad, at least `dist` m on the ground, starting height `height` x
 *   distance; Story._planShot adjusts it so kitten and stone (COMBAT_CAM.plan.run) fit between the letterbox `bars`
 *   (share of the height hidden at top and bottom, Letterbox 12%); `rate` 3.
 * - `light`: golden light column on the stone (additive open cylinder, one draw call, no scene light); `idle` 0.35
 *   during the fight while the sword can be taken, `pull` 1 during the pull, `ground` 0.45 relit on the sword on the
 *   ground after victory; `rise` 0.6 s, `fade` 0.8 s; `radius` 0.22 m, `height` 2.4 m (above the standing kitten).
 * - `flash`: blade-release flash, additive camera-facing quad, `size` 1.3 m, `time` 0.8 s of game time (about 2.5 real
 *   seconds under slow motion), peak at `peak` (share of `time`), `gain` 1.6, four rays (`rays`, relative length).
 * - `drop`: fall of the released sword in `time` 0.45 s (a 0.3 m free fall takes 0.25 s, lengthened to be readable),
 *   lying flat; `yaw` 0.6 rad ground rotation so it does not land along the head axis; `scale` 1.8: it grows while
 *   falling (0.35 to 0.63 m) to stay readable at play distance; `lift` m above the ground (guard thickness).
 * - `stone`: `margin` 0.8 unit around the planted blade (anim_cat.py make_stone), top reduced to `top` 0.75; warm grey
 *   of the game's boulders (STONE.boulder, STONE.boulderShade); `jitter` 0.05 colour variation.
 */
export const SWORD = {
  stance: { ahead: 3.2, side: 2.2 },
  pull: { grab: 19 / 24, free: 46 / 24, held: 55 / 24 },
  slow: { from: 46 / 24 - 0.15, to: 46 / 24 + 0.35, rate: 0.25 },
  pick: { radius: 0.3, arrive: 0.45 },
  cam: { dist: 1.7, height: 0.45, angle: 1.0, rate: 3 },
  run: { angle: 0.6, dist: 2.6, lift: 0.2, height: 0.45, bars: 0.12, rate: 3 },
  light: { radius: 0.22, height: 2.4, idle: 0.35, pull: 1, ground: 0.45, fade: 0.8, rise: 0.6, color: 0xffe2a0 },
  flash: { size: 1.3, time: 0.8, peak: 0.12, gain: 1.6, rays: 0.55, color: 0xfff4d6 },
  drop: { time: 0.45, yaw: 0.6, scale: 1.8, lift: 0.03 },
  stone: { margin: 0.8, top: 0.75, color: STONE.boulder, shade: STONE.boulderShade, jitter: 0.05 },
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
const FLASH_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uI;
uniform float uRays;
varying vec2 vUv;
void main() {
  vec2 q = (vUv - 0.5) * 2.0;
  float d = length(q);
  float glow = 1.0 - smoothstep(0.0, 1.0, d);
  float core = 1.0 - smoothstep(0.0, 0.3, d);
  // Four rays (cross): thin, fading towards the edge of the quad.
  float ray = max(1.0 - smoothstep(0.0, 0.05, abs(q.x)), 1.0 - smoothstep(0.0, 0.05, abs(q.y)));
  ray *= 1.0 - smoothstep(0.0, uRays * 1.8, d);
  float a = min(uI * (0.45 * glow + 0.9 * core + ray), 1.0);
  if (a < 0.003) discard;
  // Additive blending (SRC_ALPHA, ONE): the colour receives a only once.
  gl_FragColor = vec4(uColor, a);
}
`;
const FLASH_VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;

const _m = new THREE.Matrix4(), _m2 = new THREE.Matrix4();
const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _u = new THREE.Vector3();
const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _s = new THREE.Vector3();
const _p = new THREE.Vector3(), _p2 = new THREE.Vector3();

export class Sword {
  constructor(scene, cat, o = SWORD) {
    this.o = o;
    this.scene = scene;
    this.cat = cat;
    this.state = 'stone';      // 'stone' | 'pull' | 'held' | 'drop' | 'ground'
    this.canTake = null;       // () => true if a click can take it (Story: combat, 'fight' phase)
    this.pullTime = 0;         // time in the SwordPull clip during the pull (for tests)
    this.flashes = 0;          // flashes played (for tests)

    this.mesh = new THREE.Mesh(swordGeometry(), toonMaterial(0xffffff, { vertexColors: true }));
    this.mesh.name = 'Sword';
    this.mesh.matrixAutoUpdate = false;
    this.mesh.castShadow = true;
    this.mesh.frustumCulled = false; // follows the head: its local box does not move with the hand-set matrix
    scene.add(this.mesh);

    this.stone = null; // set by place()

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

    const F = o.flash;
    this.flashUniforms = { uColor: { value: new THREE.Color(F.color) }, uI: { value: 0 }, uRays: { value: F.rays } };
    this.flash = new THREE.Mesh(new THREE.PlaneGeometry(F.size, F.size), new THREE.ShaderMaterial({
      vertexShader: FLASH_VERT, fragmentShader: FLASH_FRAG, uniforms: this.flashUniforms,
      transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, fog: false,
    }));
    this.flash.name = 'SwordFlash';
    this.flash.visible = false;
    this.flash.renderOrder = 6;
    scene.add(this.flash);

    this._lightI = 0;     // current intensity of the column
    this._flashT = -1;    // s since the flash (-1: none)
    this._drop = null;    // fall: { t, from: Matrix4, to: Matrix4 }
    this._groundM = new THREE.Matrix4();
    this.calibrate(cat);
  }

  /**
   * Pull frames, computed once from the SwordPull clip played by a temporary mixer: `L` (held sword, Head bone frame),
   * `P0` (planted, cat root frame), axis `u`, release slide `sFree`, release frame `Lf` (Head bone frame). The body is
   * laid flat with its lowest point on the ground, as in Cat.update; the cat's pose is rendered again afterwards.
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
    this.Lf = new THREE.Matrix4().copy(H.free).invert()
      .multiply(_m.makeTranslation(_v.copy(this.u).multiplyScalar(-this.sFree))).multiply(this.P0);
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
    this.uw = this.u.clone().transformDirection(this.S);
    this.mgw = this.mg.clone().applyMatrix4(this.S);

    // Stone (make_stone): truncated pyramid on the ground around the planted blade, root frame.
    const St = O.stone, k = this.k, T = this.entry, P = this.tip;
    const cx = (T.x + P.x) / 2, cz = (T.z + P.z) / 2;
    const a = Math.abs(T.x - P.x) / 2 + St.margin * k, b = Math.abs(T.z - P.z) / 2 + St.margin * k;
    const h = Math.max(T.y + 0.05 * k, 0.02);
    this.stone = this._stoneMesh(cx, cz, a, b, h, St);
    this.stone.matrixAutoUpdate = false;
    this.stone.matrix.copy(this.S);
    this.stone.matrixWorldNeedsUpdate = true;
    this.scene.add(this.stone);

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

  _stoneMesh(cx, cz, a, b, h, St) {
    // Eight sides (rounded stone) instead of four; top vertices scaled to St.top.
    const n = 8, rand = rng(7);
    const ring = (y, s) => Array.from({ length: n }, (_, i) => {
      const t = (i / n) * Math.PI * 2 + Math.PI / n, r = 1 + (rand() - 0.5) * 0.12;
      return [cx + Math.cos(t) * a * s * r * 1.08, y, cz + Math.sin(t) * b * s * r * 1.08];
    });
    const lo = ring(0, 1), hi = ring(h, St.top);
    const top = [cx, h + 0.006, cz];
    const pos = [], col = [];
    const c0 = jitter(St.shade, St.jitter, rand), c1 = jitter(St.color, St.jitter, rand), c2 = jitter(St.color, St.jitter, rand).lerp(new THREE.Color(0xffffff), 0.12);
    const push = (p, c) => { pos.push(...p); col.push(c.r, c.g, c.b); };
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      // Side: dark bottom, light top (cast shadow at the foot, like the boulders of the ruins).
      push(lo[i], c0); push(hi[i], c1); push(hi[j], c1);
      push(lo[i], c0); push(hi[j], c1); push(lo[j], c0);
      push(hi[i], c1); push(top, c2); push(hi[j], c1);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.computeVertexNormals();
    // Outward faces come from the vertex order (bottom to top, clockwise seen from above); DoubleSide removes any
    // doubt on so small an object.
    const m = new THREE.Mesh(g, toonMaterial(0xffffff, { vertexColors: true, side: THREE.DoubleSide }));
    m.name = 'SwordStone';
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  }

  /** Sword back in the stone (new game, replay, step skips). */
  reset() {
    this.state = 'stone';
    this.pullTime = 0;
    this._drop = null;
    this._flashT = -1;
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

  /** Start of the pull (kitten at `stance`, SwordPull clip started by Brain 'pull'). */
  beginPull() { this.state = 'pull'; this.pullTime = 0; }

  /** Sword held (end of the clip): follows the Head bone. */
  take() { this.state = 'held'; }

  /** Victory: the sword falls from the mouth and lies on the ground. */
  drop() {
    if (this.state !== 'held' && this.state !== 'pull') return;
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
      case 'pull': {
        const t = this.cat.actions.SwordPull?.time ?? O.pull.held;
        const prev = this.pullTime;
        this.pullTime = t;
        lightTo = O.light.pull;
        if (prev < O.pull.free && t >= O.pull.free) this._flash();
        if (t < O.pull.grab) this._setMatrix(this.P0w);
        else if (t <= O.pull.free) {
          const s = Math.min(this._slide(_m2.copy(head.matrixWorld), this.mgw, this.uw), this.sFree);
          this._setMatrix(_m.makeTranslation(_v.copy(this.uw).multiplyScalar(-s)).multiply(this.P0w));
        } else if (t < O.pull.held) {
          let e = (t - O.pull.free) / (O.pull.held - O.pull.free);
          e = e * e * (3 - 2 * e);
          this.Lf.decompose(_p, _q, _s);
          this.L.decompose(_p2, _q2, _w);
          _p.lerp(_p2, e); _q.slerp(_q2, e); _s.lerp(_w, e);
          _m.compose(_p, _q, _s);
          this._setMatrix(_m2.multiplyMatrices(head.matrixWorld, _m));
        } else this._setMatrix(_m.multiplyMatrices(head.matrixWorld, this.L));
        break;
      }
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
    // Blade-release flash, facing the camera.
    if (this._flashT >= 0) {
      this._flashT += dt;
      const e = this._flashT / O.flash.time;
      if (e >= 1) { this._flashT = -1; this.flash.visible = false; } else {
        this.flash.visible = true;
        const F = O.flash;
        this.flashUniforms.uI.value = F.gain * (e < F.peak ? e / F.peak : 1 - (e - F.peak) / (1 - F.peak));
        // On top of the stone, where the tip comes out (on the grip it would cover the head).
        if (this.stoneTop) this.flash.position.copy(this.stoneTop).y += 0.06;
        else this.flash.position.setFromMatrixPosition(this.mesh.matrix);
        if (camera) this.flash.quaternion.copy(camera.quaternion);
        this.flash.scale.setScalar(0.8 + 0.5 * e);
      }
    }
  }

  _flash() { this._flashT = 0; this.flashes++; }

  /** World point between the kitten's spot and the stone: target of the pull close-up. */
  get focus() {
    const s = this.stance, c = this.stoneCenter;
    return new THREE.Vector3((s.x + c.x) / 2, s.y, (s.z + c.z) / 2);
  }

  /** State (for tests). */
  get info() {
    const r = (v) => Math.round(v * 1000) / 1000;
    const grip = new THREE.Vector3().setFromMatrixPosition(this.mesh.matrix);
    return {
      state: this.state, pullTime: r(this.pullTime), sFree: r(this.sFree), k: r(this.k),
      stance: this.stance && { x: r(this.stance.x), z: r(this.stance.z), yaw: r(this.stance.yaw) },
      stone: this.obstacle && { x: r(this.obstacle.x), z: r(this.obstacle.z), hx: r(this.obstacle.hx), hz: r(this.obstacle.hz), height: r(this.obstacle.height) },
      grip: { x: r(grip.x), y: r(grip.y), z: r(grip.z) }, light: r(this._lightI), flashes: this.flashes,
    };
  }
}
