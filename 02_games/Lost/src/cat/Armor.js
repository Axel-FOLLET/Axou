import * as THREE from 'three';
import { toonMaterial, outlineMaterial } from '../style/palette.js';
import { HELMET_COLORS } from './Helmet.js';
import { heightAt as terrainHeight } from '../world/Terrain.js';

/**
 * The kitten's armour: silver plates made in code, in the style and with the materials of the helmet (`Helmet.js`: same
 * colours, `toonMaterial` and `outlineMaterial` of `style/palette.js`, brushed texture, rolled edges, rivets). No
 * external file. Worn in the cutscenes (`tools/cutscenes/stages/`) through `attachArmor`; lying in the meadow as scenery
 * (`world/ArmorScatter.js`) through `createArmorPiece`. It is not worn in the game.
 *
 * Pieces (`PIECE_NAMES`): `breastplate` (chest), `backplate` and `backlame_1..3` (back, overlapping lames from the
 * shoulders to the rump), `pauldron_L` / `pauldron_R` (shoulders: a boss and two hanging lames), `tailguard_1` and
 * `tailguard_2` (two cuffs on the tail).
 *
 * Fit: the plates are not read from the GLB at load time. They follow the measured shape of the kitten's body in its
 * bind pose (`TORSO_SKIN`, `CHEST_FRONT`, `TAIL_BONES`), pushed out by the hair length (`FIT`), so they stay above the
 * fur. Every piece is built in the bind frame of the cat (metres, feet on the ground at y = 0, +Y up, +Z muzzle, +X the
 * cat's left), centred on its own `anchor`. Most pieces are children of one bone and follow every clip by themselves. The
 * breastplate sits on skin that follows both front legs, so it is driven by the mean motion of the two thigh bones: that
 * needs `armor.update(dt)` every frame, after `cat.update`.
 *
 * Interface:
 * - `attachArmor(cat)` builds the armour on the cat, stores it in `cat.armor` and returns it.
 * - `armor.pieces`: list of `{ name, group, onBody, resting }` (`group` is a THREE.Group, `onBody` is false once the
 *   piece has fallen, `resting` is true when it lies still on the ground).
 * - `armor.setVisible(on)`: shows or hides every piece.
 * - `armor.update(dt)`: every frame (s), after `cat.update` and before the render. Moves the breastplate, records the
 *   pieces' motion (they inherit it when they come off) and advances the falling pieces.
 * - `armor.detach(name, { velocity, spin, ground })`: the piece leaves the body and falls as a rigid body until it rests
 *   on the ground. `velocity` (m/s) and `spin` (rad/s) are vectors ({x, y, z}) added to the speed the piece had on the
 *   body; `ground(x, z)`: ground height (default `heightAt` of Terrain.js). Deterministic: no random value.
 *   Returns false if the piece is unknown or already off the body.
 * - `armor.detachAll({ velocity, spin, spread, stagger, ground })`: every piece in the order of `pieces`. `spread`
 *   (m/s): speed added away from the body, horizontally; `spin`: spin of the first piece, the sign alternates from one
 *   piece to the next; `stagger` (s): delay between two successive pieces (0 = all at once).
 * - `armor.reattach()`: every piece back on its bone, visible, falls and delays cancelled.
 * - `armor.state`: read-only plain data for tests.
 * - `armor.dispose()`: removes the pieces and frees geometries and materials.
 * - `createArmorPiece(name)` -> `{ name, group, dispose }`: one piece alone, in the bind frame (+Y up, +Z muzzle),
 *   origin at its centre, for scenery.
 */

/** Order of the pieces: from the front of the body to the rear, then the tail. */
export const PIECE_NAMES = [
  'breastplate', 'pauldron_L', 'pauldron_R', 'backplate', 'backlame_1', 'backlame_2', 'backlame_3',
  'tailguard_1', 'tailguard_2',
];

/** Shape of the plates (m unless stated). */
const FIT = {
  // Hair length on the torso: `MAX_LENGTH` of Fur.js (0.022) x mean `furMask` of the torso bones (1.3), as for the helmet.
  fur: 0.022 * 1.3,
  gap: 0.004,        // clearance above the hair tips (same as the helmet's GAP), so a moving skin never cuts a plate
  trim: 0.0032,      // radius of the rolled edges (same as the helmet's TRIM)
  bead: 0.0028,      // radius of the bead along the back
  rivet: 0.0042,     // radius of a rivet head (same as the helmet)
  outlineSink: 0.0005, // rivets sit this far above the plate (no gap visible)
};

/**
 * Torso skin of the CatBody mesh in the bind pose, measured on the vertices of the spine, hip, shoulder, neck and
 * front and hind thigh bones: distance (m) from the torso axis (x = 0, y = TORSO_AXIS_Y, along z) by z and by angle
 * from the top of the back. Rows: z = TORSO_Z0 + k x TORSO_Z_STEP. Columns: angle = j x 15 degrees, 0 (top of the back)
 * to 120 (below the flank). Hair not included. The fit uses these values instead of reading the GLB so that scenery
 * pieces can be built without a cat.
 */
const TORSO_AXIS_Y = 0.37;   // m
const TORSO_Z0 = -0.22;      // m
const TORSO_Z_STEP = 0.04;   // m
const TORSO_ANGLE_STEP = Math.PI / 12;
const TORSO_SKIN = [
  [0.113, 0.112, 0.108, 0.104, 0.100, 0.099, 0.103, 0.109, 0.120],
  [0.111, 0.109, 0.107, 0.103, 0.100, 0.098, 0.096, 0.096, 0.098],
  [0.113, 0.112, 0.109, 0.106, 0.104, 0.100, 0.099, 0.098, 0.098],
  [0.116, 0.113, 0.111, 0.107, 0.105, 0.103, 0.102, 0.102, 0.102],
  [0.124, 0.121, 0.115, 0.108, 0.105, 0.104, 0.105, 0.105, 0.105],
  [0.133, 0.126, 0.119, 0.113, 0.104, 0.105, 0.107, 0.109, 0.110],
  [0.141, 0.141, 0.132, 0.113, 0.103, 0.101, 0.103, 0.106, 0.108],
  [0.143, 0.143, 0.140, 0.119, 0.105, 0.098, 0.099, 0.103, 0.110],
  [0.149, 0.148, 0.140, 0.121, 0.107, 0.099, 0.100, 0.111, 0.122],
  [0.168, 0.163, 0.140, 0.121, 0.104, 0.098, 0.102, 0.110, 0.121],
];

/** Front of the chest at x = 0 (skin, no hair): z (m) at each height y (m); at the side, z falls by `sag` x x^2. */
const CHEST_FRONT = {
  y: [0.26, 0.28, 0.30, 0.32, 0.34, 0.36, 0.38, 0.40, 0.42, 0.44],
  z: [0.159, 0.178, 0.212, 0.226, 0.234, 0.239, 0.244, 0.246, 0.247, 0.247],
  sag: 5.5,
};

/** Bind positions (m) of the tail bones that carry the cuffs. */
const TAIL_BONES = {
  Tail002: [0, 0.509, -0.355], Tail003: [0, 0.548, -0.369], Tail004: [0, 0.585, -0.378], Tail005: [0, 0.634, -0.385],
};

/**
 * Breastplate: shield outline from the point (bottom) to the flat top rim. `yBottom`, `yTop` (m); `halfWidth` (m) at
 * the top; `mount`: bones that carry it (the chest skin follows both front legs, so the plate follows their mean); `keel`: height (m) and half-width (m) of the ridge down the middle; `curve`: exponent of the outline (bigger =
 * wider belly of the shield); `rivets`: [height 0-1, side 0-1].
 */
const BREASTPLATE = {
  mount: ['Thigh_front_L', 'Thigh_front_R'],
  yBottom: 0.262, yTop: 0.442, halfWidth: 0.084, curve: 2.2, keel: { height: 0.005, width: 0.016 },
  rivets: [[0.55, 0.78], [0.8, 0.86], [0.93, 0.5]],
};

/**
 * Back plates: `z` (m) centre, `hz` (m) half-length, `hth` (rad) half-width around the back, `lift` (m) above the
 * hair line so each plate overlaps the one behind it (front plates higher), `dome` (m) height of the swell, `mount`: bones
 * that carry it (the ones whose rigid motion is the closest to the skin under the plate, measured over the run, trot,
 * walk, idle, carried, stalk and sit clips).
 */
const BACK_PLATES = {
  backplate: { z: 0.040, hz: 0.056, hth: 1.30, lift: 0.017, dome: 0.004, mount: ['Spine003'] },
  backlame_1: { z: -0.030, hz: 0.051, hth: 1.34, lift: 0.012, dome: 0.003, mount: ['Spine003'] },
  backlame_2: { z: -0.100, hz: 0.051, hth: 1.32, lift: 0.007, dome: 0.003, mount: ['Spine002'] },
  backlame_3: { z: -0.170, hz: 0.049, hth: 1.20, lift: 0.002, dome: 0.003, mount: ['Spine001'] },
};

/**
 * Pauldron, left side (mirrored for the right): a boss over the shoulder and two lames hanging towards the elbow, each
 * `{ z, th (rad from the top of the back), hz, hth, dome, lift, kind }`, from the lowest to the topmost; `kind`: material
 * ('steel' plate or 'lame'); `mount`: bones that carry it (the rig has one shoulder bone, shared by both sides).
 */
const PAULDRON = {
  mount: ['Shoulder_front_L'],
  plates: [
    { z: 0.112, th: 2.12, hz: 0.040, hth: 0.30, dome: 0.004, lift: 0.000, kind: 'lame' },
    { z: 0.118, th: 1.76, hz: 0.046, hth: 0.34, dome: 0.005, lift: 0.006, kind: 'lame' },
    { z: 0.124, th: 1.32, hz: 0.054, hth: 0.46, dome: 0.016, lift: 0.012, kind: 'steel' },
  ],
};

/** Tail cuffs: `from`/`to` bones that give the axis; `radius` (m) skin radius of the tail there; `length` (m). */
const TAIL_CUFFS = {
  tailguard_1: { from: 'Tail002', to: 'Tail003', radius: 0.019, length: 0.040, mount: ['Tail002'] },
  tailguard_2: { from: 'Tail004', to: 'Tail005', radius: 0.017, length: 0.040, mount: ['Tail004'] },
};
const CUFF_FLARE = 0.07;   // share of the radius: the cuff swells in the middle (barrel)

const SUPERELLIPSE_POWER = 3.2;  // outline of a plate: 2 = ellipse, higher = rounder rectangle
const SURFACE_RINGS = 12;        // rings from the centre of a plate to its edge
const SURFACE_STEPS = 72;        // points around a plate (also the points of its rolled edge)

/**
 * Fall as a rigid body (a sampled set of points of the piece): gravity `g` (m/s2), substeps of at most `step` s, ground
 * contact with restitution `bounce` (none below `still` m/s of normal speed) and friction `mu`; damping `damp` (1/s) in
 * the air and `dampGround` (1/s) in contact. At rest when speed stays under `restV` m/s and rotation under `restW` rad/s for
 * `restT` s: the piece is set `gap` m above the ground and stops. `samples`: points of the rigid body; `maxT`: s,
 * longest fall. The values are the helmet's, so the pieces drop like it does.
 */
const DROP = {
  g: 9.81, step: 1 / 240, bounce: 0.22, still: 0.35, mu: 0.6, damp: 0.15, dampGround: 4,
  restV: 0.05, restW: 0.5, restT: 0.25, gap: 0.001, samples: 220, maxT: 6,
};

const _noRaycast = () => {};
const _UP = new THREE.Vector3(0, 1, 0);
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3();
const _q = new THREE.Quaternion(), _m = new THREE.Matrix4();
const _pos = new THREE.Vector3(), _scl = new THREE.Vector3();
const _qa = new THREE.Quaternion(), _qb = new THREE.Quaternion(), _mb = new THREE.Matrix4();
const clamp = THREE.MathUtils.clamp;

// ------------------------------------------------------------------ materials

let _brushed = null;

/** Brushing texture of the helmet (1 x 256, grey 0.86 to 1, fixed seed): same look, shared by every piece. */
function brushedTexture() {
  if (_brushed) return _brushed;
  const N = 256;
  const data = new Uint8Array(N * 4);
  let s = 12345, walk = 0;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < N; i++) {
    walk = walk * 0.7 + (rnd() - 0.5) * 0.6;
    const v = clamp(0.93 + walk * 0.1 + (rnd() - 0.5) * 0.05, 0.86, 1);
    data.set([v * 255, v * 255, v * 255, 255], i * 4);
  }
  const tex = new THREE.DataTexture(data, 1, N, THREE.RGBAFormat);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 3);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  _brushed = tex;
  return tex;
}

/** Materials of the helmet: plates, rolled edges, lames, rivets, outline. */
function makeMaterials() {
  const map = brushedTexture();
  return {
    steel: toonMaterial(HELMET_COLORS.steel, { side: THREE.DoubleSide, map }),
    edge: toonMaterial(HELMET_COLORS.edge),
    lame: toonMaterial(HELMET_COLORS.edge, { side: THREE.DoubleSide, map }),
    rivet: toonMaterial(HELMET_COLORS.rivet),
    outline: outlineMaterial(),
  };
}

// ------------------------------------------------------------------ shapes

/** Skin radius of the torso (m) at height-along-body `z` and angle `th` (rad, either side of the back). */
function torsoSkin(z, th) {
  const rows = TORSO_SKIN.length, cols = TORSO_SKIN[0].length;
  const fz = clamp((z - TORSO_Z0) / TORSO_Z_STEP, 0, rows - 1);
  const fa = clamp(Math.abs(th) / TORSO_ANGLE_STEP, 0, cols - 1);
  const j = Math.min(Math.floor(fz), rows - 2), i = Math.min(Math.floor(fa), cols - 2);
  const u = fz - j, v = fa - i;
  const r0 = TORSO_SKIN[j][i] * (1 - v) + TORSO_SKIN[j][i + 1] * v;
  const r1 = TORSO_SKIN[j + 1][i] * (1 - v) + TORSO_SKIN[j + 1][i + 1] * v;
  return r0 * (1 - u) + r1 * u;
}

/** Point of the torso shell at (z, th), `out` m above the hair line. */
function shellPoint(z, th, out, target = new THREE.Vector3()) {
  const r = torsoSkin(z, th) + FIT.fur + FIT.gap + out;
  return target.set(r * Math.sin(th), TORSO_AXIS_Y + r * Math.cos(th), z);
}

const signedPow = (x, p) => Math.sign(x) * Math.abs(x) ** p;

/** Tube along a series of points (closed or not). */
function tube(points, radius = FIT.trim, closed = true) {
  const curve = new THREE.CatmullRomCurve3(points, closed, 'centripetal');
  return new THREE.TubeGeometry(curve, points.length * 2, radius, 8, closed);
}

/** Flips the triangles of an indexed geometry whose normals point towards `centreOf(point)` instead of away from it. */
function orientOutward(geo, centreOf) {
  geo.computeVertexNormals();
  const pos = geo.getAttribute('position'), nor = geo.getAttribute('normal');
  let sum = 0;
  for (let i = 0; i < pos.count; i += 7) {
    _a.fromBufferAttribute(pos, i);
    _b.fromBufferAttribute(nor, i);
    sum += _b.dot(_c.subVectors(_a, centreOf(_a, _d)));
  }
  if (sum >= 0) return geo;
  const ix = geo.index.array;
  for (let t = 0; t < ix.length; t += 3) { const k = ix[t + 1]; ix[t + 1] = ix[t + 2]; ix[t + 2] = k; }
  geo.computeVertexNormals();
  return geo;
}

/** Indexed grid of `rings` x `steps` points: `pointAt(i, j, target)` and `uvAt(i, j)`. Seam of `closed` grids duplicated. */
function gridGeometry(rings, steps, pointAt, uvAt) {
  const positions = [], uvs = [], index = [];
  const p = new THREE.Vector3();
  for (let i = 0; i <= rings; i++) {
    for (let j = 0; j <= steps; j++) {
      pointAt(i, j, p);
      positions.push(p.x, p.y, p.z);
      const uv = uvAt(i, j);
      uvs.push(uv[0], uv[1]);
    }
  }
  const row = steps + 1;
  for (let i = 0; i < rings; i++) {
    for (let j = 0; j < steps; j++) {
      const a = i * row + j, b = a + 1, c = a + row, d = c + 1;
      index.push(a, c, b, b, c, d);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(index);
  return geo;
}

/**
 * Plate lying on the torso shell, centred on (z, th) with half sizes (hz m, hth rad), outline a superellipse, swelling
 * by `dome` m at the centre, `lift` m above the hair line. Returns the plate, its rolled edge and a `point(fz, ft, out)`
 * function (fractions of the half sizes) to put rivets on it.
 */
function shellPlate({ z, th, hz, hth, dome, lift }) {
  const exponent = 2 / SUPERELLIPSE_POWER;
  const at = (s, phi, target) => {
    const dz = s * hz * signedPow(Math.cos(phi), exponent);
    const dth = s * hth * signedPow(Math.sin(phi), exponent);
    return shellPoint(z + dz, th + dth, lift + dome * (1 - s * s), target);
  };
  const phiOf = (j) => (j / SURFACE_STEPS) * Math.PI * 2;
  const geo = gridGeometry(
    SURFACE_RINGS, SURFACE_STEPS,
    (i, j, target) => at(i / SURFACE_RINGS, phiOf(j), target),
    (i, j) => [0.5 + (i / SURFACE_RINGS) * 0.5 * Math.cos(phiOf(j)), 0.5 + (i / SURFACE_RINGS) * 0.5 * Math.sin(phiOf(j))],
  );
  orientOutward(geo, (p, target) => target.set(0, TORSO_AXIS_Y, p.z));
  const rim = [];
  for (let j = 0; j < SURFACE_STEPS; j++) rim.push(at(1, phiOf(j), new THREE.Vector3()));
  return {
    geo,
    rim: tube(rim),
    point: (fz, ft, target) => shellPoint(z + fz * hz, th + ft * hth, lift + dome * (1 - fz * fz * 0.5 - ft * ft * 0.5), target),
  };
}

/** Rivet (hemisphere) geometry shared by every rivet of a piece. */
const rivetGeometry = () => new THREE.SphereGeometry(FIT.rivet, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2);

/** Rivet part at `position`, its axis along `normal`. */
function rivetAt(geo, position, normal) {
  const g = geo.clone();
  _q.setFromUnitVectors(_UP, normal);
  g.applyMatrix4(_m.compose(position, _q, _a.set(1, 1, 1)));
  return g;
}

/** Radial outward normal of the torso shell at angle `th`. */
const shellNormal = (th, target = new THREE.Vector3()) => target.set(Math.sin(th), Math.cos(th), 0);

/** Parts of a plate on the torso: plate, rolled edge, optional bead along z and rivets. `kind`: 'steel' or 'lame'. */
function shellParts(spec, kind, { bead = false, rivets = [] } = {}) {
  const plate = shellPlate(spec);
  const parts = [{ geo: plate.geo, kind, outline: true }, { geo: plate.rim, kind: 'edge' }];
  if (bead) {
    const points = [];
    for (let i = 0; i <= 12; i++) {
      const dz = ((i / 12) * 2 - 1) * spec.hz * 0.78;
      points.push(shellPoint(spec.z + dz, spec.th, spec.lift + spec.dome + FIT.bead * 0.6, new THREE.Vector3()));
    }
    parts.push({ geo: tube(points, FIT.bead, false), kind: 'edge', outline: true });
  }
  const rivet = rivetGeometry();
  for (const [fz, ft] of rivets) {
    const p = plate.point(fz, ft, new THREE.Vector3());
    const th = spec.th + ft * spec.hth;
    p.addScaledVector(shellNormal(th, _d), FIT.outlineSink);
    parts.push({ geo: rivetAt(rivet, p, shellNormal(th, new THREE.Vector3())), kind: 'rivet' });
  }
  rivet.dispose();
  return parts;
}

/** Skin z of the chest front (m) at height `y` and lateral position `x`. */
function chestFront(x, y) {
  const { y: ys, z: zs, sag } = CHEST_FRONT;
  const f = clamp((y - ys[0]) / (ys[1] - ys[0]), 0, ys.length - 1);
  const i = Math.min(Math.floor(f), ys.length - 2);
  return zs[i] * (1 - (f - i)) + zs[i + 1] * (f - i) - sag * x * x;
}

/** Point of the chest shell at (x, y): chest front pushed out along its normal by the hair and the gap. */
function chestPoint(x, y, out, target) {
  const e = 0.004;
  const zx = (chestFront(x + e, y) - chestFront(x - e, y)) / (2 * e);
  const zy = (chestFront(x, y + e) - chestFront(x, y - e)) / (2 * e);
  _a.set(-zx, -zy, 1).normalize();
  return target.set(x, y, chestFront(x, y)).addScaledVector(_a, FIT.fur + FIT.gap + out);
}

/** Breastplate: shield-shaped plate on the chest with a keel, a rolled edge and rivets. */
function breastplateParts() {
  const B = BREASTPLATE;
  const NT = 28, NS = 22;
  const halfWidth = (t) => B.halfWidth * (1 - (1 - t) ** B.curve) ** 0.55;
  const keel = (x) => B.keel.height * Math.exp(-((x / B.keel.width) ** 2));
  const at = (t, s, target) => {
    const y = B.yBottom + t * (B.yTop - B.yBottom);
    const x = s * halfWidth(t);
    return chestPoint(x, y, keel(x) + 0.006 * Math.sin(Math.PI * t * 0.9), target);
  };
  const geo = gridGeometry(NT, NS, (i, j, target) => at(i / NT, (j / NS) * 2 - 1, target), (i, j) => [j / NS, i / NT]);
  orientOutward(geo, (p, target) => target.set(0, p.y, p.z - 0.2));
  const rim = [];
  for (let i = 0; i <= NT; i++) rim.push(at(i / NT, -1, new THREE.Vector3()));
  for (let j = 1; j < NS; j++) rim.push(at(1, (j / NS) * 2 - 1, new THREE.Vector3()));
  for (let i = NT; i > 0; i--) rim.push(at(i / NT, 1, new THREE.Vector3()));
  const parts = [{ geo, kind: 'steel', outline: true }, { geo: tube(rim.filter((_, k) => k % 2 === 0)), kind: 'edge' }];
  const rivet = rivetGeometry();
  for (const [t, s] of B.rivets) {
    for (const side of [-1, 1]) {
      const x = side * s * halfWidth(t) * 0.82, y = B.yBottom + t * (B.yTop - B.yBottom);
      const p = chestPoint(x, y, keel(x) + 0.006 * Math.sin(Math.PI * t * 0.9) + FIT.outlineSink, new THREE.Vector3());
      const n = chestPoint(x + 0.003, y, 0, _b).sub(chestPoint(x - 0.003, y, 0, _c)).normalize();
      // Normal of the chest at the rivet: cross of the two tangents.
      const up = chestPoint(x, y + 0.003, 0, _c).sub(chestPoint(x, y - 0.003, 0, _d)).normalize();
      parts.push({ geo: rivetAt(rivet, p, new THREE.Vector3().crossVectors(n, up).normalize()), kind: 'rivet' });
    }
  }
  rivet.dispose();
  return parts;
}

/** Cuff around the tail between two bones: swollen ring with two rolled rims and a middle band. */
function cuffParts({ from, to, radius, length }) {
  const a = new THREE.Vector3(...TAIL_BONES[from]), b = new THREE.Vector3(...TAIL_BONES[to]);
  const axis = b.clone().sub(a).normalize();
  const centre = a.clone().add(b).multiplyScalar(0.5);
  const R = radius + FIT.fur + FIT.gap;
  const half = length / 2;
  const profile = [];
  for (let i = 0; i <= 10; i++) {
    const t = (i / 10) * 2 - 1;
    profile.push(new THREE.Vector2(R * (1 + CUFF_FLARE * (1 - t * t)), t * half));
  }
  const place = new THREE.Matrix4().compose(centre, new THREE.Quaternion().setFromUnitVectors(_UP, axis), new THREE.Vector3(1, 1, 1));
  const body = new THREE.LatheGeometry(profile, 40).applyMatrix4(place);
  const ring = (y, r, tubeR) => new THREE.TorusGeometry(r, tubeR, 8, 40).rotateX(Math.PI / 2).translate(0, y, 0).applyMatrix4(place);
  const parts = [
    { geo: body, kind: 'lame', outline: true },
    { geo: ring(-half, R, FIT.trim), kind: 'edge' },
    { geo: ring(half, R, FIT.trim), kind: 'edge' },
    { geo: ring(0, R * (1 + CUFF_FLARE) + FIT.trim * 0.5, FIT.trim * 0.9), kind: 'edge' },
  ];
  const rivet = rivetGeometry();
  for (let k = 0; k < 6; k++) {
    const phi = (k / 6) * Math.PI * 2;
    const dir = new THREE.Vector3(Math.cos(phi), 0, Math.sin(phi));
    const p = dir.clone().multiplyScalar(R * (1 + CUFF_FLARE) + FIT.trim * 1.4).applyMatrix4(place);
    const n = dir.clone().applyQuaternion(_q.setFromUnitVectors(_UP, axis));
    parts.push({ geo: rivetAt(rivet, p, n), kind: 'rivet' });
  }
  rivet.dispose();
  return parts;
}

/** Mirrors a part list along x (right-hand pieces): positions mirrored, winding flipped, normals recomputed. */
function mirrorParts(parts) {
  for (const part of parts) {
    const g = part.geo;
    g.scale(-1, 1, 1);
    if (g.index) {
      const ix = g.index.array;
      for (let t = 0; t < ix.length; t += 3) { const k = ix[t + 1]; ix[t + 1] = ix[t + 2]; ix[t + 2] = k; }
    }
    g.computeVertexNormals();
  }
  return parts;
}

/**
 * Description of a piece: `mount` (names of the bones that carry it), parts `{ geo, kind, outline }` (geometry in the
 * bind frame) and `anchor`, the centre of the parts. The geometry is moved to be centred on `anchor`.
 */
function describePiece(name) {
  let mount, parts;
  if (name === 'breastplate') {
    mount = BREASTPLATE.mount;
    parts = breastplateParts();
  } else if (BACK_PLATES[name]) {
    const s = BACK_PLATES[name];
    mount = s.mount;
    parts = shellParts({ z: s.z, th: 0, hz: s.hz, hth: s.hth, dome: s.dome, lift: s.lift }, 'lame', {
      bead: true, rivets: [[0, -0.88], [0, 0.88]],
    });
  } else if (name === 'pauldron_L' || name === 'pauldron_R') {
    mount = PAULDRON.mount;
    parts = [];
    for (const p of PAULDRON.plates) {
      parts.push(...shellParts(p, p.kind, { rivets: p.kind === 'steel' ? [[0, 0]] : [[0, 0.7]] }));
    }
    if (name.endsWith('R')) mirrorParts(parts);
  } else if (TAIL_CUFFS[name]) {
    mount = TAIL_CUFFS[name].mount;
    parts = cuffParts(TAIL_CUFFS[name]);
  } else {
    throw new Error(`[armor] unknown piece "${name}"`);
  }
  const box = new THREE.Box3();
  for (const part of parts) { part.geo.computeBoundingBox(); box.union(part.geo.boundingBox); }
  const anchor = box.getCenter(new THREE.Vector3());
  for (const part of parts) { part.geo.translate(-anchor.x, -anchor.y, -anchor.z); part.geo.computeBoundingSphere(); }
  return { name, mount, parts, anchor };
}

/** Group of meshes for a described piece, with the given materials. */
function buildGroup(desc, mats) {
  const group = new THREE.Group();
  group.name = `Armor_${desc.name}`;
  const meshes = [];
  for (const part of desc.parts) {
    const mesh = new THREE.Mesh(part.geo, mats[part.kind]);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.raycast = _noRaycast; // a click on the armour goes through to the cat or the ground behind it
    group.add(mesh);
    meshes.push(mesh);
    if (part.outline) {
      const o = new THREE.Mesh(part.geo, mats.outline);
      o.raycast = _noRaycast;
      mesh.add(o);
    }
  }
  return { group, meshes };
}

function disposeMaterials(mats) {
  Object.values(mats).forEach((m) => m.dispose());
}

/**
 * One armour piece alone, for scenery: in the bind frame of the cat (+Y up, +Z muzzle), origin at the centre of the
 * piece. `dispose()` frees its geometries and materials.
 * @param {string} name one of `PIECE_NAMES`
 * @returns {{ name: string, group: THREE.Group, dispose: () => void }}
 */
export function createArmorPiece(name) {
  const desc = describePiece(name);
  const mats = makeMaterials();
  const { group, meshes } = buildGroup(desc, mats);
  return {
    name,
    group,
    dispose() {
      group.removeFromParent();
      new Set(meshes.map((m) => m.geometry)).forEach((g) => g.dispose());
      disposeMaterials(mats);
    },
  };
}

// ------------------------------------------------------------------ attaching to the cat

/**
 * Bind frame of the cat: `boneMatrix(name)` gives the bind-pose matrix of a bone in the frame the plates are built in
 * (frame of `cat.body`, lifted so that the lowest vertex of the bind pose is at y = 0).
 */
function bindFrame(cat) {
  const body = cat.meshes.find((m) => m.name === 'CatBody') ?? cat.meshes.find((m) => m.isSkinnedMesh);
  cat.root.updateMatrixWorld(true);
  const toFrame = cat.body.matrixWorld.clone().invert().multiply(body.matrixWorld).multiply(body.bindMatrix);
  const pos = body.geometry.getAttribute('position');
  let low = Infinity;
  for (let i = 0; i < pos.count; i++) low = Math.min(low, _a.fromBufferAttribute(pos, i).applyMatrix4(toFrame).y);
  toFrame.premultiply(new THREE.Matrix4().makeTranslation(0, -low, 0));
  const bones = body.skeleton.bones;
  return (name) => {
    const i = bones.findIndex((b) => b.name === name);
    if (i < 0) throw new Error(`[armor] bone "${name}" not found in the cat`);
    return toFrame.clone().multiply(body.skeleton.boneInverses[i].clone().invert());
  };
}

/**
 * One piece on the cat: its group, the bones that carry it and its rigid body once it has fallen. `mount` lists
 * `{ bone, toBone }`: a bone and the inverse of its bind matrix in the bind frame. A piece with one bone is a child of that
 * bone (`home` = its place under it). A piece with several bones is a child of `cat.body` and `Armor.update` sets its
 * matrix from the mean motion of the bones (`blended`); `place` is its placement in the bind frame.
 */
class ArmorPiece {
  constructor(name, group, meshes, mount, place) {
    this.name = name;
    this.group = group;
    this.meshes = meshes;
    this.mount = mount;
    this.place = place;
    this.blended = mount.length > 1;
    this.home = null;             // single bone: position, quaternion, scale under the bone
    this.onBody = true;
    this.body = null;             // rigid body while it falls or lies on the ground
    this.last = null;             // last two world poses on the body: { prev, cur }
  }

  get resting() { return !!this.body?.rest; }
}

export class Armor {
  /**
   * Builds the armour and attaches every piece to its bone.
   * @param {import('./Cat.js').Cat} cat an already built cat (Cat.load)
   */
  constructor(cat) {
    this.cat = cat;
    this._materials = makeMaterials();
    this._visible = true;
    this._pending = [];           // delayed detachments { piece, options, at }
    this._clock = 0;
    const boneMatrix = bindFrame(cat);
    this.pieces = PIECE_NAMES.map((name) => {
      const desc = describePiece(name);
      const { group, meshes } = buildGroup(desc, this._materials);
      const mount = desc.mount.map((boneName) => {
        const bone = cat.rig.bones.get(boneName);
        if (!bone) throw new Error(`[armor] bone "${boneName}" missing for ${name}`);
        return { bone, toBone: boneMatrix(boneName).invert() };
      });
      const place = new THREE.Matrix4().makeTranslation(desc.anchor.x, desc.anchor.y, desc.anchor.z);
      const piece = new ArmorPiece(name, group, meshes, mount, place);
      if (!piece.blended) {
        new THREE.Matrix4().multiplyMatrices(mount[0].toBone, place).decompose(group.position, group.quaternion, group.scale);
        piece.home = { p: group.position.clone(), q: group.quaternion.clone(), s: group.scale.clone() };
      }
      this._mount(piece);
      return piece;
    });
  }

  /** Puts a piece on the body: under its bone, or under `cat.body` and driven by `update` when several bones carry it. */
  _mount(piece) {
    const g = piece.group;
    if (!piece.blended) {
      piece.mount[0].bone.add(g);
      g.position.copy(piece.home.p);
      g.quaternion.copy(piece.home.q);
      g.scale.copy(piece.home.s);
      g.matrixAutoUpdate = true;
    } else {
      this.cat.body.add(g);
      g.matrixAutoUpdate = false;
      this._follow(piece);
    }
    g.visible = this._visible;
    piece.onBody = true;
    piece.body = null;
    piece.last = null;
  }

  /** Matrix of a blended piece: mean position, rotation and scale of the bones' motion since the bind pose. */
  _follow(piece) {
    _pos.set(0, 0, 0);
    _scl.set(0, 0, 0);
    piece.mount.forEach(({ bone, toBone }, i) => {
      _mb.multiplyMatrices(bone.matrixWorld, toBone).decompose(_a, _qb, _b);
      _pos.add(_a);
      _scl.add(_b);
      if (i === 0) _qa.copy(_qb); else _qa.slerp(_qb, 1 / (i + 1));
    });
    const n = piece.mount.length;
    _pos.divideScalar(n);
    _scl.divideScalar(n);
    this.cat.body.updateWorldMatrix(true, false);
    _mb.compose(_pos, _qa, _scl).multiply(piece.place).premultiply(_m.copy(this.cat.body.matrixWorld).invert());
    piece.group.matrix.copy(_mb);
    piece.group.matrixWorldNeedsUpdate = true;
  }

  /** Piece by name, or undefined. */
  piece(name) { return this.pieces.find((p) => p.name === name); }

  /** Shows or hides every piece (the ones lying on the ground included). */
  setVisible(visible) {
    this._visible = !!visible;
    for (const p of this.pieces) p.group.visible = this._visible;
  }

  /** Read-only state for tests: plain data. */
  get state() {
    return {
      visible: this._visible,
      pending: this._pending.length,
      pieces: this.pieces.map((p) => ({ name: p.name, onBody: p.onBody, resting: p.resting })),
    };
  }

  /**
   * Every frame (s): records the world pose of the pieces still on the body (their speed when they come off), runs the
   * delayed detachments, advances the falling pieces.
   */
  update(dt) {
    if (!(dt > 0)) return;
    this._clock += dt;
    for (let k = this._pending.length - 1; k >= 0; k--) {
      const job = this._pending[k];
      if (this._clock >= job.at) { this._pending.splice(k, 1); this._detach(job.piece, job.options); }
    }
    for (const p of this.pieces) {
      if (p.onBody) {
        if (p.blended) this._follow(p);
        this._sample(p, dt);
      } else if (p.body) this._fall(p, dt);
    }
  }

  /**
   * The piece comes off and falls: see the header. `velocity` and `spin` are added to the speed it had on the body.
   * @returns {boolean} false if the piece is unknown or already off
   */
  detach(name, options = {}) {
    const piece = this.piece(name);
    if (!piece) { console.warn(`[armor] detach: unknown piece "${name}"`); return false; }
    return this._detach(piece, options);
  }

  /** Every piece comes off, in the order of `pieces`: see the header for the options. */
  detachAll({ velocity, spin, spread = 0, stagger = 0, ground } = {}) {
    const centre = this._bodyCentre(new THREE.Vector3());
    this.pieces.forEach((p, i) => {
      if (!p.onBody) return;
      p.group.getWorldPosition(_a);
      const out = _b.subVectors(_a, centre).setY(0);
      if (out.lengthSq() > 1e-8) out.normalize();
      const options = {
        velocity: {
          x: (velocity?.x ?? 0) + out.x * spread, y: velocity?.y ?? 0, z: (velocity?.z ?? 0) + out.z * spread,
        },
        spin: spin ? { x: spin.x * (i % 2 ? -1 : 1), y: spin.y * (i % 2 ? -1 : 1), z: spin.z * (i % 2 ? -1 : 1) } : undefined,
        ground,
      };
      if (stagger > 0 && i > 0) this._pending.push({ piece: p, options, at: this._clock + i * stagger });
      else this._detach(p, options);
    });
  }

  /** Every piece back on its bone, visible, in its original place; falls and delays cancelled. */
  reattach() {
    this._pending.length = 0;
    for (const p of this.pieces) this._mount(p);
  }

  /** Removes the pieces from the rig and frees geometries and materials. */
  dispose() {
    this.pieces.forEach((p) => p.group.removeFromParent());
    new Set(this.pieces.flatMap((p) => p.meshes.map((m) => m.geometry))).forEach((g) => g.dispose());
    disposeMaterials(this._materials);
    this.pieces = [];
    this._pending.length = 0;
    if (this.cat.armor === this) this.cat.armor = null;
  }

  // ------------------------------------------------- falling

  /** Mean world position of the pieces still on the body, written to `out`. */
  _bodyCentre(out) {
    out.set(0, 0, 0);
    let n = 0;
    for (const p of this.pieces) {
      if (!p.onBody) continue;
      p.group.getWorldPosition(_a);
      out.add(_a);
      n++;
    }
    if (n === 0) this.cat.root.getWorldPosition(out);
    else out.divideScalar(n);
    return out;
  }

  /** Records the world pose of a piece on the body. */
  _sample(piece, dt) {
    piece.group.updateWorldMatrix(true, false);
    const p = new THREE.Vector3(), q = new THREE.Quaternion();
    piece.group.matrixWorld.decompose(p, q, _a);
    piece.last = { prev: piece.last?.cur ?? null, cur: { p, q, dt } };
  }

  _detach(piece, options = {}) {
    const scene = this.cat.root.parent;
    if (!piece.onBody || !scene) return false;
    const ground = options.ground ?? terrainHeight;
    const g = piece.group;
    g.updateWorldMatrix(true, true);
    const pw = new THREE.Vector3(), qw = new THREE.Quaternion(), sw = new THREE.Vector3();
    g.matrixWorld.decompose(pw, qw, sw);
    // Vertices of every part in the group frame, with the group's world scale (metres).
    const inv = g.matrixWorld.clone().invert(), all = [];
    for (const m of piece.meshes) {
      const rel = inv.clone().multiply(m.matrixWorld), pos = m.geometry.getAttribute('position');
      for (let i = 0; i < pos.count; i++) all.push(new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(rel).multiply(sw));
    }
    const stride = Math.max(1, Math.ceil(all.length / DROP.samples));
    const pts = all.filter((_, i) => i % stride === 0);
    const c = pts.reduce((s, p) => s.add(p), new THREE.Vector3()).divideScalar(pts.length);
    const rs = pts.map((p) => p.clone().sub(c));
    // Inertia tensor (unit mass spread over the points), group frame.
    const e = [0, 0, 0, 0, 0, 0, 0, 0, 0];
    for (const r of rs) {
      const w = 1 / rs.length, r2 = r.lengthSq();
      e[0] += w * (r2 - r.x * r.x); e[4] += w * (r2 - r.y * r.y); e[8] += w * (r2 - r.z * r.z);
      e[1] -= w * r.x * r.y; e[2] -= w * r.x * r.z; e[5] -= w * r.y * r.z;
    }
    e[3] = e[1]; e[6] = e[2]; e[7] = e[5];
    const Iinv = new THREE.Matrix3().fromArray(e).invert();
    // Speed of the centre of mass: what the piece had on the body (last two records), plus the options.
    const x = c.clone().applyQuaternion(qw).add(pw);
    const v = new THREE.Vector3(), w = new THREE.Vector3();
    const L = piece.last;
    if (L?.prev) {
      _q.copy(L.cur.q).multiply(L.prev.q.clone().invert());
      if (_q.w < 0) { _q.x = -_q.x; _q.y = -_q.y; _q.z = -_q.z; _q.w = -_q.w; }
      const ang = 2 * Math.acos(Math.min(1, _q.w)), sn = Math.sqrt(Math.max(0, 1 - _q.w * _q.w));
      if (sn > 1e-6) w.set(_q.x / sn, _q.y / sn, _q.z / sn).multiplyScalar(ang / L.cur.dt);
      v.subVectors(L.cur.p, L.prev.p).divideScalar(L.cur.dt).add(_a.copy(w).cross(_b.copy(c).applyQuaternion(qw)));
    }
    if (options.velocity) v.add(_a.set(options.velocity.x ?? 0, options.velocity.y ?? 0, options.velocity.z ?? 0));
    if (options.spin) w.add(_a.set(options.spin.x ?? 0, options.spin.y ?? 0, options.spin.z ?? 0));
    if (!g.matrixAutoUpdate) {
      g.matrix.decompose(g.position, g.quaternion, g.scale);
      g.matrixAutoUpdate = true;
    }
    scene.attach(g);
    piece.onBody = false;
    piece.body = { x, q: qw.clone(), v, w, c, rs, Iinv, ground, t: 0, still: 0, contact: false, rest: false };
    this._pose(piece);
    return true;
  }

  /** Group pose from the rigid body (centre of mass x, orientation q). */
  _pose(piece) {
    const b = piece.body;
    piece.group.quaternion.copy(b.q);
    piece.group.position.copy(b.c).applyQuaternion(b.q).negate().add(b.x);
  }

  /** Inverse inertia tensor in the world frame applied to `u` (modified in place). */
  _iinv(b, u) {
    return u.applyQuaternion(_q.copy(b.q).invert()).applyMatrix3(b.Iinv).applyQuaternion(b.q);
  }

  /** Fall: substeps of at most DROP.step s, then rest. */
  _fall(piece, dt) {
    const b = piece.body, D = DROP;
    if (b.rest) return;
    b.t += dt;
    const n = Math.max(1, Math.ceil(dt / D.step - 1e-9)), h = dt / n;
    for (let k = 0; k < n; k++) this._substep(b, h);
    this._pose(piece);
    const slow = b.contact && b.v.length() < D.restV && b.w.length() < D.restW;
    b.still = slow ? b.still + dt : 0;
    if (b.still >= D.restT || b.t >= D.maxT) this._settle(piece);
  }

  _substep(b, h) {
    const D = DROP;
    b.v.y -= D.g * h;
    b.v.multiplyScalar(Math.exp(-D.damp * h));
    if (b.contact) {
      const k = Math.exp(-D.dampGround * h);
      b.w.multiplyScalar(k); b.v.x *= k; b.v.z *= k;
    }
    b.x.addScaledVector(b.v, h);
    _q.set(b.w.x, b.w.y, b.w.z, 0).multiply(b.q);
    b.q.set(b.q.x + _q.x * 0.5 * h, b.q.y + _q.y * 0.5 * h, b.q.z + _q.z * 0.5 * h, b.q.w + _q.w * 0.5 * h).normalize();
    // Contacts: points below the ground; normal (restitution) and friction impulses, point by point.
    const hits = [];
    let deepest = 0;
    for (const r of b.rs) {
      const rw = r.clone().applyQuaternion(b.q);
      const py = b.x.y + rw.y, gy = b.ground(b.x.x + rw.x, b.x.z + rw.z);
      if (py < gy) { hits.push(rw); deepest = Math.max(deepest, gy - py); }
    }
    b.contact = hits.length > 0;
    for (const rw of hits) {
      _c.copy(b.w).cross(rw).add(b.v);
      const vn = _c.y;
      if (vn >= 0) continue;
      const e = -vn > D.still ? D.bounce : 0;
      const kn = 1 + _UP.dot(this._iinv(b, _d.copy(rw).cross(_UP)).cross(rw));
      const j = (-(1 + e) * vn) / kn;
      b.v.y += j;
      b.w.add(this._iinv(b, _d.copy(rw).cross(_UP).multiplyScalar(j)));
      // Coulomb friction (tangent = sliding speed at the point).
      _c.copy(b.w).cross(rw).add(b.v);
      const t = _a.set(_c.x, 0, _c.z);
      const vt = t.length();
      if (vt < 1e-6) continue;
      t.divideScalar(vt);
      const kt = 1 + t.dot(this._iinv(b, _d.copy(rw).cross(t)).cross(rw));
      const jt = -Math.min(vt / kt, D.mu * j);
      b.v.addScaledVector(t, jt);
      b.w.add(this._iinv(b, _d.copy(rw).cross(t).multiplyScalar(jt)));
    }
    b.x.y += deepest;
  }

  /** Rest: the lowest vertex is set DROP.gap m above the ground; no more movement. */
  _settle(piece) {
    const b = piece.body;
    b.v.set(0, 0, 0); b.w.set(0, 0, 0);
    this._pose(piece);
    piece.group.updateMatrixWorld(true);
    let gap = Infinity;
    for (const m of piece.meshes) {
      const pos = m.geometry.getAttribute('position');
      for (let i = 0; i < pos.count; i++) {
        _a.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld);
        gap = Math.min(gap, _a.y - b.ground(_a.x, _a.z));
      }
    }
    b.x.y += DROP.gap - gap;
    this._pose(piece);
    piece.group.updateMatrixWorld(true);
    b.rest = true;
  }
}

/** Shortcut: builds the armour, stores it in `cat.armor` and returns it. */
export function attachArmor(cat) {
  cat.armor = new Armor(cat);
  return cat.armor;
}
