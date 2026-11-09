import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { toonMaterial, YARN } from '../style/palette.js';

/**
 * Procedural NPC accessories in a cute toon style. Used by Npc.js.
 *
 * - Each accessory is one merged geometry with vertex colours: one draw call per accessory, one toon material shared
 *   by all (`accessoryMaterial`, never disposed by an NPC).
 * - All measures are in metres for a 0.8 m cat (hero size). Frame of the `build*` functions: the NPC root at rest, +Y
 *   up, +Z in front of the cat (muzzle), −X on its right. Npc.js places each object, then attaches it to a bone.
 */
// Chagicien: deep purple hat (darker and more saturated than his pastel mauve coat), round red glasses.
// Chartiste: duck-blue beret, mustard scarf, wooden palette, paint spots on the front paws.
export const ACCESSORY_COLORS = {
  wizardCone: 0x4b1f8f,
  wizardBrim: 0x3c1775,
  wizardBand: 0xf3c55a,
  wizardBall: 0xf7d774,
  wizardStar: 0xfff1a8,
  glasses: 0xd62f3a,
  wand: 0x4a2c1a,
  beret: 0x1e7f86,
  beretRim: 0x14626a,
  scarf: 0xd9a52a,
  scarfDark: 0xb7861a,
  wood: 0xc08a56,
  woodDark: 0xa0703f,
  canvas: 0xf6efe2,
  brushHandle: 0x2b3a67, // midnight-blue lacquered handle: readable on the ginger coat
  brushFerrule: 0xc9c2b8,
  brushTip: 0x6fa8dc,
  palette: 0xc8955c,
  paletteHole: 0x8a5e33,
  paints: [0xe86a7a, 0xf3c55a, 0x6fa8dc, 0x86c46a],
};

/**
 * Snow cat beanie colours and optional `buildScarf` colours (despite the name, Chavalanche himself uses
 * GUIDE_COLORS): pink family of the yarn (`YARN`, palette.js), the only warm, vivid colour of the game that reads
 * both on a cream coat and on snow. Beanie: `YARN.dark` dome, `YARN.light` cuff, cream pompom, pure pink ribs. Scarf:
 * `YARN.base`, knot and tails in `YARN.dark`.
 */
export const CHAVALANCHE_COLORS = {
  beanie: YARN.dark, beanieCuff: YARN.light, beanieRib: 0xc9526a, pompom: 0xfff3e0,
};

let _material = null;
/** Shared toon material (vertex colours). */
function accessoryMaterial() {
  if (!_material) _material = toonMaterial(0xffffff, { vertexColors: true });
  return _material;
}

const _c = new THREE.Color();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

/** Position / rotation (Euler XYZ) / scale matrix. */
function mat(x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) {
  return new THREE.Matrix4().compose(_p.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _s.set(sx, sy, sz));
}

/** Matrix placing an object built along +Y between points a and b. */
function between(a, b) {
  const dir = _p.subVectors(b, a);
  const len = dir.length();
  _q.setFromUnitVectors(UP, dir.normalize());
  return new THREE.Matrix4().compose(a.clone().lerp(b, 0.5), _q.clone(), _s.set(1, len, 1));
}

/** Non-indexed geometry, without UVs, transformed and coloured (flat colour in working space). */
function part(geo, hex, matrix = null) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  if (g !== geo) geo.dispose();
  g.deleteAttribute('uv');
  if (matrix) g.applyMatrix4(matrix);
  _c.set(hex);
  const n = g.attributes.position.count;
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { col[i * 3] = _c.r; col[i * 3 + 1] = _c.g; col[i * 3 + 2] = _c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

function merged(parts, name) {
  const geo = mergeGeometries(parts, false);
  parts.forEach((p) => p.dispose());
  geo.computeBoundingSphere();
  const mesh = new THREE.Mesh(geo, accessoryMaterial());
  mesh.name = name;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/** Cylinder of radius r built along +Y between a and b. */
function rod(a, b, r, hex, radial = 8) {
  return part(new THREE.CylinderGeometry(r, r, 1, radial, 1), hex, between(a, b));
}

/**
 * Pointed wizard hat, tip bent backwards and ending with a ball. Origin: centre of the underside of the brim, placed
 * on the skull. Stiff flat brim about 3 × the cone radius; `lift` raises the brim above the ears, with the bottom of
 * the cone extended as a tube down to the skull.
 * @param {object} [o] measures in m: `brim` brim radius, `cone` cone radius, `height`, `bend` backward offset of
 *   the tip, `lift` tube height under the brim (origin = bottom of the tube, on the skull)
 * @returns {THREE.BufferGeometry[]} parts
 */
function wizardHatParts(o = {}) {
  const C = ACCESSORY_COLORS;
  const rB = o.brim ?? 0.18;
  const rC = o.cone ?? 0.056;
  const H = o.height ?? 0.27;
  const B = o.bend ?? 0.08;
  const lift = o.lift ?? 0;
  const parts = [];
  // Stiff brim: flat disc (8 mm for a 0.1 m brim, thicker when wider), rounded hem.
  const k = Math.sqrt(Math.max(1, rB / 0.1));
  parts.push(part(new THREE.CylinderGeometry(rB, rB, 0.008 * k, 48), C.wizardBrim, mat(0, 0.004 * k, 0)));
  parts.push(part(new THREE.TorusGeometry(rB, 0.0055 * k, 8, 64), C.wizardBrim, mat(0, 0.004 * k, 0, Math.PI / 2)));
  parts.push(part(new THREE.CylinderGeometry(rC * 1.03, rC * 1.06, 0.02, 24), C.wizardBand, mat(0, 0.018, 0)));
  // Cone of revolution: profile (1 − t)^1.15, then tip bent backwards (z −= B·t²).
  const pts = [];
  const N = 14;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    pts.push(new THREE.Vector2(Math.max(rC * (1 - t) ** 1.15, 0.0005), 0.006 + H * t));
  }
  const cone = new THREE.LatheGeometry(pts, 24);
  const pos = cone.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const t = (pos.getY(i) - 0.006) / H;
    pos.setZ(i, pos.getZ(i) - B * t * t);
  }
  cone.computeVertexNormals();
  parts.push(part(cone, C.wizardCone));
  parts.push(part(new THREE.SphereGeometry(0.014, 12, 8), C.wizardBall, mat(0, 0.006 + H, -B)));
  // Small stars (flattened octahedra) on the front of the cone.
  for (const [t, ang, s] of [[0.22, 0.35, 1.2], [0.45, -0.45, 1], [0.66, 0.15, 0.8]]) {
    const r = rC * (1 - t) ** 1.15 + 0.001;
    const z = r * Math.cos(ang) - B * t * t;
    parts.push(part(new THREE.OctahedronGeometry(0.0095 * s), C.wizardStar,
      mat(r * Math.sin(ang), 0.006 + H * t, z, 0, ang, Math.PI / 4, 1, 1, 0.45)));
  }
  if (lift > 0) {
    for (const g of parts) g.translate(0, lift, 0);
    // Tube: bottom of the cone extended down to the skull, between the ears.
    parts.push(part(new THREE.CylinderGeometry(rC * 1.04, rC * 1.08, lift + 0.006, 24, 1, true), C.wizardCone, mat(0, (lift + 0.006) / 2, 0)));
  }
  return parts;
}

/**
 * Glasses frame (0.8 m cat): `ratio` ring radius / eye radius, `ahead` minimum offset in front of the eyeball (m),
 * `tube` wire radius (m), `lift` rise of the centre above the eye (m), `bins` number of sectors of the outline.
 */
export const GLASSES = { ratio: 1.45, ahead: 0.004, tube: 0.0048, lift: 0.008, bins: 48 };

/**
 * Frame ring in front of eye `e`: radius `R`, axis `forward` (forward, slightly outward), plane frame (`U`, `V`),
 * centre `c` in the eye plane, minimum offset `base`.
 * @param {object} e eye: `center`, `radius`
 * @param {number} [scale] NPC size relative to the hero
 * @returns {object} ring data
 */
export function glassesRing(e, scale = 1) {
  const side = Math.sign(e.center.x) || 1;
  const forward = new THREE.Vector3(side * 0.12, 0, 1).normalize();
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), forward);
  const U = new THREE.Vector3(1, 0, 0).applyQuaternion(q), V = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
  const c = e.center.clone().addScaledVector(V, GLASSES.lift * scale);
  return { R: e.radius * GLASSES.ratio, forward, q, U, V, c, side, base: e.radius + GLASSES.ahead * scale };
}

/**
 * Point of the outline at angle `t`.
 * @param {object} ring from `glassesRing`
 * @param {number|number[]} [push] offset in front of the eye plane: a number or one value per sector
 *   (interpolated); default `base`
 * @param {number} t angle (rad): 0 = +U, π/2 = top
 * @returns {THREE.Vector3}
 */
function glassesPoint(ring, push, t) {
  let a = ring.base;
  if (Array.isArray(push)) {
    const n = push.length, x = ((t / (Math.PI * 2)) % 1 + 1) % 1 * n, i = Math.floor(x) % n;
    a = THREE.MathUtils.lerp(push[i], push[(i + 1) % n], x - Math.floor(x));
  } else if (push !== undefined) a = push;
  return ring.c.clone().addScaledVector(ring.U, Math.cos(t) * ring.R).addScaledVector(ring.V, Math.sin(t) * ring.R).addScaledVector(ring.forward, a);
}

/**
 * Big round glasses (frames only, no lenses), root frame: one ring centred on each eye, facing forward; bridge above
 * the nose; temples toward the base of the ears. Each ring is a closed wire whose sectors advance just as needed
 * (`e.push`, measured by Npc._hatFit): close to the eye at the top and temple side, further forward around the
 * muzzle.
 * @param {{center: THREE.Vector3, radius: number, push?: number|number[]}[]} eyes one entry per eye
 * @param {object} [o] `scale`; `ears` { x, y, z } attachment point of the temples (+X side)
 * @returns {THREE.BufferGeometry[]} parts
 */
function glassesParts(eyes, { scale = 1, ears = null } = {}) {
  const C = ACCESSORY_COLORS;
  const parts = [];
  const rings = [];
  const tube = GLASSES.tube * scale;
  const N = 96;
  for (const e of eyes) {
    const ring = glassesRing(e, scale);
    const pts = [];
    for (let i = 0; i < N; i++) pts.push(glassesPoint(ring, e.push, (i / N) * Math.PI * 2));
    const curve = new THREE.CatmullRomCurve3(pts, true, 'centripetal');
    parts.push(part(new THREE.TubeGeometry(curve, N, tube, 8, true), C.glasses));
    rings.push({ ring, push: e.push });
  }
  if (rings.length === 2) {
    const [a, b] = rings[0].ring.c.x < rings[1].ring.c.x ? rings : [rings[1], rings[0]];
    // Bridge: from the inner top of one ring to the other (45° for the −X ring, 135° for the other), slightly bulging
    // up and forward.
    const pa = glassesPoint(a.ring, a.push, Math.PI / 4);
    const pb = glassesPoint(b.ring, b.push, (3 * Math.PI) / 4);
    const mid = pa.clone().lerp(pb, 0.5).add(new THREE.Vector3(0, 0.004 * scale, 0.006 * scale));
    parts.push(rod(pa, mid, tube * 0.8, C.glasses, 6), rod(mid, pb, tube * 0.8, C.glasses, 6));
    // Temples: from the outer edge of each ring to the base of the ear on the same side.
    for (const r of rings) {
      const s = glassesPoint(r.ring, r.push, r.ring.side > 0 ? 0 : Math.PI);
      const end = ears
        ? new THREE.Vector3(r.ring.side * Math.abs(ears.x), ears.y, ears.z)
        : s.clone().add(new THREE.Vector3(r.ring.side * 0.01, 0.006, -0.06).multiplyScalar(scale));
      parts.push(rod(s, end, tube * 0.75, C.glasses, 6));
    }
  }
  return parts;
}

/**
 * Magic wand held across the mouth (along X), star at the −X end (cat's right). Origin: middle of the wand.
 * @param {object} o `center` (THREE.Vector3), `scale`
 * @returns {THREE.Mesh}
 */
export function buildWand({ center, scale = 1 }) {
  const C = ACCESSORY_COLORS;
  const s = scale;
  const L = 0.24 * s;
  const off = -0.02 * s; // a bit longer on the star side
  const v = (x) => new THREE.Vector3(center.x + x, center.y, center.z);
  const parts = [
    rod(v(off - L / 2), v(off + L / 2), 0.0055 * s, C.wand, 8),
    rod(v(off - L / 2 - 0.004 * s), v(off - L / 2 + 0.018 * s), 0.0068 * s, C.wizardBand, 8),
  ];
  const tip = v(off - L / 2 - 0.016 * s);
  parts.push(part(new THREE.OctahedronGeometry(0.02 * s), C.wizardStar, mat(tip.x, tip.y, tip.z, 0, Math.PI / 2, Math.PI / 4, 1, 1, 0.4)));
  parts.push(part(new THREE.SphereGeometry(0.009 * s, 10, 8), C.wizardBall, mat(tip.x, tip.y, tip.z)));
  return merged(parts, 'NpcWand');
}

/**
 * Merged wizard hat and glasses (one draw call). The `hat` measures are for a 0.8 m cat; the eyes are already scaled.
 * @param {object} o `crown`, `eyes`, `hat`, `ears`, `scale` (NPC size relative to the hero)
 * @returns {THREE.Mesh}
 */
export function buildWizard({ crown, eyes, hat = {}, ears = null, scale = 1 }) {
  const hatM = mat(crown.x, crown.y, crown.z, hat.tilt ?? 0, 0, 0, scale);
  const parts = wizardHatParts(hat).map((g) => g.applyMatrix4(hatM));
  parts.push(...glassesParts(eyes, { scale, ears }));
  return merged(parts, 'NpcWizardHat');
}

/** Beret tilted to the side, origin at the centre of its underside. */
function beretParts(o = {}) {
  const C = ACCESSORY_COLORS;
  const r = o.radius ?? 0.056;
  const parts = [];
  parts.push(part(new THREE.SphereGeometry(r, 24, 12), C.beret, mat(0, r * 0.32 * 0.55, 0, 0, 0, 0, 1, 0.32, 1.05)));
  parts.push(part(new THREE.TorusGeometry(r * 0.78, 0.006, 6, 24), C.beretRim, mat(0, 0.004, 0, Math.PI / 2)));
  parts.push(part(new THREE.CylinderGeometry(0.0028, 0.0042, 0.014, 6), C.beretRim, mat(0, r * 0.32 * 1.5 + 0.005, 0)));
  return parts;
}

/** Artist's beret (one draw call). */
export function buildBeret({ crown, beret = {}, scale = 1 }) {
  const tilt = beret.tilt ?? 0.32;
  const m = mat(crown.x - Math.sin(tilt) * 0.01 * scale, crown.y, crown.z - 0.004 * scale, -0.1, 0, tilt, scale);
  return merged(beretParts(beret).map((g) => g.applyMatrix4(m)), 'NpcBeret');
}

/**
 * Knitted snow cat beanie, origin at the centre of the dome base (0.8 m cat): slightly flattened half-sphere, rolled
 * cuff, two ribs, pompom. The ears poke through the dome: it is wider than the skull and worn low.
 * @param {object} [o] `radius` dome radius (m), `height` (fraction of the radius), `ribs` (polar angles of the
 *   ribs, rad), `colors`
 * @returns {THREE.BufferGeometry[]} parts
 */
function beanieParts(o = {}) {
  const C = { ...CHAVALANCHE_COLORS, ...o.colors }; // `colors`: beanie, beanieCuff, beanieRib, pompom
  const r = o.radius ?? 0.062, k = o.height ?? 0.9;
  const parts = [];
  parts.push(part(new THREE.SphereGeometry(r, 28, 12, 0, Math.PI * 2, 0, Math.PI / 2), C.beanie, mat(0, 0, 0, 0, 0, 0, 1, k, 1)));
  // Cuff: open band with a rolled bead at each edge.
  parts.push(part(new THREE.CylinderGeometry(r * 1.03, r * 1.05, 0.02, 32, 1, true), C.beanieCuff, mat(0, 0.002, 0)));
  parts.push(part(new THREE.TorusGeometry(r * 1.04, 0.0065, 8, 40), C.beanieCuff, mat(0, -0.0075, 0, Math.PI / 2)));
  parts.push(part(new THREE.TorusGeometry(r * 1.04, 0.0055, 8, 40), C.beanieCuff, mat(0, 0.0125, 0, Math.PI / 2)));
  for (const a of o.ribs ?? [0.62, 1.0]) {
    parts.push(part(new THREE.TorusGeometry(r * Math.sin(a) * 1.005, 0.0024, 6, 36), C.beanieRib, mat(0, r * Math.cos(a) * k, 0, Math.PI / 2)));
  }
  parts.push(part(new THREE.SphereGeometry(0.0175, 14, 10), C.pompom, mat(0, r * k + 0.008, 0)));
  return parts;
}

/** Snow cat beanie (one draw call), tilted slightly back and sideways. `crown`: top of the skull. */
export function buildBeanie({ crown, beanie = {}, scale = 1 }) {
  const tilt = beanie.tilt ?? 0.16, back = beanie.back ?? 0.07;
  const m = mat(crown.x, crown.y + (beanie.drop ?? -0.02) * scale, crown.z - 0.004 * scale, -back, 0, tilt, scale);
  return merged(beanieParts(beanie).map((g) => g.applyMatrix4(m)), 'NpcBeanie');
}

/**
 * Chartiste's scarf (one draw call), root frame: cloth band 2 × `top` wide, laid on the measured coat (`radiusAt`),
 * tight around the neck and barely lower in front (`sag`); knot in front, turned `knotTurn` rad to the side, and two
 * short tails (`tails`, m for a 0.8 m cat) falling away from the coat.
 * @param {object} o `center` neck centre, `axis` band axis (toward the head), `side` lateral direction (⟂ axis),
 *   `radiusAt(h, t)` coat radius at height h along `axis` and angle t around it (cos t along `side`), `front` front
 *   direction, `top` half-width, `sag`, `knotTurn`, `tails`, `scale`
 * @returns {THREE.Mesh}
 */
export function buildScarf({ center, axis, side, radiusAt, front, top, sag = 0.3 * top, knotTurn = 0.55, tails = [0.035, 0.028], scale = 1 }) {
  const C = ACCESSORY_COLORS;
  const u = side.clone().projectOnPlane(axis).normalize();
  const v = new THREE.Vector3().crossVectors(axis, u).normalize();
  const f = front.clone().projectOnPlane(axis).normalize();
  const tf = Math.atan2(f.dot(v), f.dot(u));
  const thick = 0.005 * scale;
  const M = 72, R = 8;
  const edges = (t) => {
    const low = sag * (1 + Math.cos(t - tf)) / 2;
    return [top - low, -top - low];
  };
  const at = (h, t, extra) => center.clone().addScaledVector(axis, h)
    .addScaledVector(u, Math.cos(t) * (radiusAt(h, t) + extra)).addScaledVector(v, Math.sin(t) * (radiusAt(h, t) + extra));
  // Closed section: outer face top to bottom, then inner face bottom to top.
  const S = 2 * (R + 1);
  const P = [];
  for (let i = 0; i < M; i++) {
    const t = (i / M) * Math.PI * 2;
    const [h1, h2] = edges(t);
    for (let k = 0; k <= R; k++) P.push(at(h1 + (h2 - h1) * k / R, t, thick));
    for (let k = R; k >= 0; k--) P.push(at(h1 + (h2 - h1) * k / R, t, 0));
  }
  const idx = [];
  for (let i = 0; i < M; i++) {
    const a = i * S, b = ((i + 1) % M) * S;
    for (let k = 0; k < S; k++) {
      const k1 = (k + 1) % S;
      idx.push(a + k, a + k1, b + k, b + k, a + k1, b + k1);
    }
  }
  const band = new THREE.BufferGeometry().setFromPoints(P);
  band.setIndex(idx);
  band.computeVertexNormals();
  // Faces point outward if (side, axis) is right-handed; otherwise flip them.
  const n0 = new THREE.Vector3().fromBufferAttribute(band.attributes.normal, Math.floor(R / 2));
  if (n0.dot(P[Math.floor(R / 2)].clone().sub(center).projectOnPlane(axis)) < 0) {
    for (let i = 0; i < idx.length; i += 3) [idx[i + 1], idx[i + 2]] = [idx[i + 2], idx[i + 1]];
    band.setIndex(idx);
    band.computeVertexNormals();
  }
  const parts = [part(band, C.scarf)];
  // Knot in front, slightly to the side, on the band; tails falling downward (−Y).
  const tk = tf + knotTurn;
  const out = new THREE.Vector3().addScaledVector(u, Math.cos(tk)).addScaledVector(v, Math.sin(tk)).normalize();
  const [k1, k2] = edges(tk);
  const knot = at((k1 + k2) / 2, tk, thick + 0.005 * scale);
  parts.push(part(new THREE.SphereGeometry(0.011 * scale, 12, 8), C.scarfDark, new THREE.Matrix4().compose(knot,
    new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), out), new THREE.Vector3(1.25, 1, 0.65))));
  const down = new THREE.Vector3(0, -1, 0).projectOnPlane(out).normalize().addScaledVector(out, 0.45).normalize();
  const lat = new THREE.Vector3().crossVectors(out, down).normalize();
  tails.forEach((len, j) => {
    const sd = j ? -1 : 1;
    const a = knot.clone().addScaledVector(lat, sd * 0.005 * scale);
    const b = a.clone().addScaledVector(down, len * scale).addScaledVector(lat, sd * 0.007 * scale);
    const m = new THREE.Matrix4().lookAt(new THREE.Vector3(), out, b.clone().sub(a)).setPosition(a.clone().lerp(b, 0.5));
    parts.push(part(new THREE.BoxGeometry(0.018 * scale, a.distanceTo(b), 0.004 * scale), C.scarf, m));
  });
  return merged(parts, 'NpcScarf');
}

/**
 * Paint spots on the coat: small flattened drops, root frame.
 * @param {{p: THREE.Vector3, n: THREE.Vector3}[]} spots point and outward direction
 * @param {number} [scale] NPC size relative to the hero
 * @returns {THREE.BufferGeometry[]} parts
 */
export function paintSpotParts(spots, scale = 1) {
  const C = ACCESSORY_COLORS;
  return spots.map(({ p, n }, i) => {
    const q = new THREE.Quaternion().setFromUnitVectors(UP, n.clone().normalize());
    const r = (0.011 + 0.003 * (i % 2)) * scale;
    const m = new THREE.Matrix4().compose(p, q, new THREE.Vector3(r, r * 0.35, r * 0.8));
    return part(new THREE.SphereGeometry(1, 10, 6), C.paints[i % C.paints.length], m);
  });
}

/** Merges `part` geometries into an accessory mesh. */
export function mergedAccessory(parts, name) {
  return merged(parts, name);
}

/**
 * Three-legged easel with a blank canvas (the painting is a separate mesh, see buildPainting). Local frame: easel
 * foot at the origin, the canvas faces −Z (toward the cat).
 * @returns {{mesh: THREE.Mesh, canvasCenter: THREE.Vector3, canvasNormal: THREE.Vector3}} in the local easel frame
 */
function buildEasel() {
  const C = ACCESSORY_COLORS;
  const parts = [];
  const v = (x, y, z) => new THREE.Vector3(x, y, z);
  parts.push(rod(v(-0.17, 0, -0.03), v(-0.03, 0.66, 0.05), 0.009, C.wood));
  parts.push(rod(v(0.17, 0, -0.03), v(0.03, 0.66, 0.05), 0.009, C.wood));
  parts.push(rod(v(0, 0, 0.3), v(0, 0.62, 0.06), 0.009, C.woodDark));
  // Shelf holding the canvas.
  parts.push(part(new THREE.BoxGeometry(0.3, 0.014, 0.04), C.wood, mat(0, 0.3, -0.004, 0.12, 0, 0)));
  // Canvas (cream box tilted backward, centre at 0.43 m).
  const tilt = 0.12;
  const center = v(0, 0.43, 0.012);
  parts.push(part(new THREE.BoxGeometry(0.3, 0.24, 0.012), C.canvas, mat(center.x, center.y, center.z, tilt, 0, 0)));
  // Top crossbar clamping the canvas.
  parts.push(part(new THREE.BoxGeometry(0.06, 0.014, 0.03), C.woodDark, mat(0, 0.555, 0.03, tilt, 0, 0)));
  const normal = v(0, 0, -1).applyEuler(new THREE.Euler(tilt, 0, 0));
  const face = center.clone().addScaledVector(normal, 0.0065);
  return { mesh: merged(parts, 'NpcEasel'), canvasCenter: face, canvasNormal: normal };
}

/** Draws the canvas picture (without `document`, in Node tests: null, flat colour). */
function paintingTexture() {
  if (typeof document === 'undefined') return null;
  const cv = document.createElement('canvas');
  cv.width = 256; cv.height = 200;
  const g = cv.getContext('2d');
  const sky = g.createLinearGradient(0, 0, 0, 200);
  sky.addColorStop(0, '#bfe0f7'); sky.addColorStop(1, '#fbe3ef');
  g.fillStyle = sky; g.fillRect(0, 0, 256, 200);
  g.fillStyle = '#ffe08a'; g.beginPath(); g.arc(205, 45, 22, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#b8a6e0'; g.beginPath(); g.moveTo(10, 150); g.lineTo(105, 50); g.lineTo(200, 150); g.closePath(); g.fill();
  g.fillStyle = '#f6f2ff'; g.beginPath(); g.moveTo(84, 72); g.lineTo(105, 50); g.lineTo(126, 72); g.lineTo(115, 66); g.lineTo(105, 74); g.lineTo(95, 66); g.closePath(); g.fill();
  g.fillStyle = '#9fd17a'; g.beginPath(); g.ellipse(128, 205, 170, 70, 0, 0, Math.PI * 2); g.fill();
  // Small grey cat sitting on the summit: hint of the mountain where Maman waits.
  g.fillStyle = '#7d7680';
  g.beginPath(); g.ellipse(105, 44, 6, 7, 0, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(105, 34, 4.5, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.moveTo(101, 31); g.lineTo(102, 25); g.lineTo(104.5, 30); g.fill();
  g.beginPath(); g.moveTo(109, 31); g.lineTo(108, 25); g.lineTo(105.5, 30); g.fill();
  g.strokeStyle = '#7d7680'; g.lineWidth = 2; g.beginPath(); g.moveTo(110, 48); g.quadraticCurveTo(118, 46, 116, 38); g.stroke();
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Painting on the front of the canvas (one draw call, own material and texture). */
export function buildPainting(easel) {
  const map = paintingTexture();
  const mat2 = toonMaterial(map ? 0xffffff : 0xbfe0f7, map ? { map } : {});
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.27, 0.21), mat2);
  mesh.name = 'NpcPainting';
  mesh.position.copy(easel.canvasCenter).addScaledVector(easel.canvasNormal, 0.0008);
  // The plane faces +Z by default: turn it toward −Z, with the canvas tilt.
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), easel.canvasNormal);
  mesh.receiveShadow = true;
  mesh.userData.ownMaterial = true;
  return mesh;
}

/** Wooden painter's palette on the ground (thumb hole, four paint spots). Origin on the ground. */
function paletteParts() {
  const C = ACCESSORY_COLORS;
  const parts = [part(new THREE.CylinderGeometry(0.062, 0.062, 0.008, 24), C.palette, mat(0, 0.004, 0, 0, 0, 0, 1, 1, 0.78))];
  parts.push(part(new THREE.CylinderGeometry(0.009, 0.009, 0.0085, 12), C.paletteHole, mat(-0.034, 0.0045, -0.022)));
  C.paints.forEach((hex, i) => {
    const a = 0.2 + i * 0.85;
    parts.push(part(new THREE.SphereGeometry(0.011, 8, 6), hex, mat(Math.cos(a) * 0.036, 0.009, Math.sin(a) * 0.028, 0, 0, 0, 1, 0.4, 1)));
  });
  return parts;
}

/**
 * Easel and ground palette merged (one draw call), placed by a matrix (root frame).
 * @param {THREE.Matrix4} matrix
 * @param {THREE.Vector3} [palettePos] palette position in the local easel frame (before the matrix)
 * @returns {object} `buildEasel` result, in the root frame
 */
export function buildEaselGroup(matrix, palettePos = null) {
  const easel = buildEasel();
  easel.mesh.geometry.applyMatrix4(matrix);
  if (palettePos) {
    const palM = matrix.clone().multiply(mat(palettePos.x, palettePos.y, palettePos.z, 0, 0.4, 0));
    const pal = mergeGeometries(paletteParts().map((g) => g.applyMatrix4(palM)), false);
    const both = mergeGeometries([easel.mesh.geometry, pal], false);
    easel.mesh.geometry.dispose(); pal.dispose();
    both.computeBoundingSphere();
    easel.mesh.geometry = both;
  }
  easel.canvasCenter.applyMatrix4(matrix);
  easel.canvasNormal.transformDirection(matrix);
  return easel;
}

/**
 * Brush built along +Y: held at the origin (middle of the handle), bristles toward +Y. Total length 0.138 m.
 * @returns {THREE.Mesh}
 */
export function buildBrush() {
  const C = ACCESSORY_COLORS;
  const parts = [
    part(new THREE.CylinderGeometry(0.0035, 0.0045, 0.1, 8), C.brushHandle, mat(0, 0.0, 0)),
    part(new THREE.CylinderGeometry(0.0042, 0.0038, 0.016, 8), C.brushFerrule, mat(0, 0.058, 0)),
    part(new THREE.ConeGeometry(0.0045, 0.022, 8), C.brushTip, mat(0, 0.077, 0)),
  ];
  return merged(parts, 'NpcBrush');
}

/* ------------------------------------------------------------------------------------------------
 * Chavalanche, mountain guide: blue helmet with two ear holes, ski mask (black frame and strap, large curved lens
 * with a red-orange-yellow gradient: shapes and colours only, no lettering or brand), big khaki backpack whose straps
 * go around the front legs, two blue hiking poles wedged between pack and back. All vertex-coloured geometry (one
 * draw call per carrying bone), no texture. Measures in metres in the root frame of a 1.25-scale NPC at rest; `scale`
 * brings them to the actual size. Reference points on the rest mesh: back at y 0.585 to 0.62 (plus about 0.03 of
 * fur), trunk half-width 0.13, skull x ±0.13 and z 0.28 to 0.41 at y 0.70, sloping face (z 0.414 at y 0.70, 0.464 at
 * 0.64, 0.488 at 0.60), eyes at y 0.643.
 * ---------------------------------------------------------------------------------------------- */
export const GUIDE_COLORS = {
  helmet: 0x2f6fd6, helmetDark: 0x1d47a0, helmetRim: 0x173a85,
  frame: 0x14161b, strap: 0x1a1c22,
  lensRed: 0xe0263a, lensOrange: 0xff8a22, lensYellow: 0xffd43b, glint: 0xfff0c8,
  pack: 0x6f7a3c, packDark: 0x515c2a, packLight: 0x838e4b, webbing: 0x3d4522, buckle: 0xd8d0b0,
  pole: 0x2b86e8, poleDark: 0x1c58a8, grip: 0x22252b, tip: 0x8d9299,
};

const GUIDE_HELMET = { c: new THREE.Vector3(0, 0.655, 0.34), r: new THREE.Vector3(0.152, 0.145, 0.115) };
const GUIDE_CUT = (z) => 0.6 + 0.52 * (z - 0.24); // helmet edge: tilted plane, higher in front (above the mask)
const GUIDE_HOLE = 0.055; // m: radius of the ear holes
const GUIDE_LENS = { a: 0.1, b: 0.042, y0: 0.645, h: 0.025, p: 3, clear: 0.02, frame: 1.2 }; // lens (m): half-width, half-height, centre height, bulge; superellipse power; gap to the face (m); frame scale
const GUIDE_PACK_DROP = 0.025; // m: how far the pack and poles drop toward the back
const GUIDE_FACE = (y) => 0.414 + (0.7 - y) * 0.75; // front of the face at height y (returns z in m)
const _c2 = new THREE.Color();

/** Indexed grid mesh (nu × nv), with computed normals turned away from `inside`. */
function gridGeometry(nu, nv, fn, inside, wrap = false) {
  const cols = wrap ? nu : nu + 1;
  const pos = new Float32Array((nv + 1) * cols * 3);
  const v = new THREE.Vector3();
  for (let j = 0; j <= nv; j++) {
    for (let i = 0; i < cols; i++) { fn(i / nu, j / nv, v, i, j); pos.set([v.x, v.y, v.z], (j * cols + i) * 3); }
  }
  const idx = [];
  for (let j = 0; j < nv; j++) {
    for (let i = 0; i < nu; i++) {
      const i1 = wrap ? (i + 1) % nu : i + 1;
      const a = j * cols + i, b = j * cols + i1, c = (j + 1) * cols + i1, d = (j + 1) * cols + i;
      idx.push(a, b, d, b, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  const nor = g.attributes.normal;
  let s = 0;
  for (let i = 0; i < nor.count; i++) {
    v.fromBufferAttribute(g.attributes.position, i).sub(inside);
    s += v.x * nor.getX(i) + v.y * nor.getY(i) + v.z * nor.getZ(i);
  }
  if (s < 0) {
    for (let k = 0; k < idx.length; k += 3) { const t = idx[k + 1]; idx[k + 1] = idx[k + 2]; idx[k + 2] = t; }
    g.setIndex(idx);
    g.computeVertexNormals();
  }
  return g;
}

/** Vertex colour computed by `fn(x, y, z, out)` (out: THREE.Color). Returns the non-indexed geometry. */
function paintGeometry(geo, fn) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  if (g !== geo) geo.dispose();
  g.deleteAttribute('uv');
  const n = g.attributes.position.count;
  const col = new Float32Array(n * 3);
  const c = new THREE.Color();
  for (let i = 0; i < n; i++) {
    fn(g.attributes.position.getX(i), g.attributes.position.getY(i), g.attributes.position.getZ(i), c);
    col.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

/**
 * Flat ribbon following `pts` (width 2 × `half` along `wdir(i)`), visible from both sides, flat colour. `closed`:
 * loop.
 */
function ribbon(pts, wdir, half, hex, closed = false) {
  const pos = [], nor = [];
  const n = closed ? pts.length : pts.length - 1;
  const w = (i) => wdir(i % pts.length).clone().multiplyScalar(half);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % pts.length;
    const a0 = pts[i].clone().sub(w(i)), a1 = pts[i].clone().add(w(i));
    const b0 = pts[j].clone().sub(w(j)), b1 = pts[j].clone().add(w(j));
    const nn = new THREE.Vector3().crossVectors(b0.clone().sub(a0), a1.clone().sub(a0)).normalize();
    for (const [sgn, order] of [[1, [a0, a1, b0, a1, b1, b0]], [-1, [a0, b0, a1, a1, b0, b1]]]) {
      for (const p of order) { pos.push(p.x, p.y, p.z); nor.push(nn.x * sgn, nn.y * sgn, nn.z * sgn); }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  return part(g, hex);
}

/** Radius (≤ 1) of the superellipse of power p in the direction of angle `al`. */
const superR = (al, p) => 1 / (Math.abs(Math.cos(al)) ** p + Math.abs(Math.sin(al)) ** p) ** (1 / p);

/** Helmet: ellipsoidal dome cut by a tilted plane, with a hole around each ear axis. */
function guideHelmetParts(ears) {
  const C = GUIDE_COLORS, { c, r } = GUIDE_HELMET;
  const NU = 96, NV = 36;
  const at = (th, ph, out = new THREE.Vector3(), grow = 0) => out.set(
    c.x + (r.x + grow) * Math.sin(th) * Math.sin(ph), c.y + (r.y + grow) * Math.cos(th), c.z + (r.z + grow) * Math.sin(th) * Math.cos(ph));
  // Polar angle of the edge for each azimuth: last point above the cutting plane.
  const edge = [];
  for (let i = 0; i < NU; i++) {
    const ph = (i / NU - 0.5) * Math.PI * 2;
    let lo = Math.PI / 3, hi = Math.PI * 0.8;
    for (let k = 0; k < 24; k++) {
      const mid = (lo + hi) / 2, p = at(mid, ph);
      if (p.y >= GUIDE_CUT(p.z)) lo = mid; else hi = mid;
    }
    edge.push(lo);
  }
  const dome = gridGeometry(NU, NV, (u, vv, out, i) => at(vv * edge[i], (u - 0.5) * Math.PI * 2, out), c, true);
  // Holes: remove triangles whose centre is within GUIDE_HOLE of an ear axis.
  const src = dome.toNonIndexed();
  dome.dispose();
  const P = src.attributes.position, N = src.attributes.normal;
  const keepPos = [], keepNor = [];
  const m = new THREE.Vector3(), q = new THREE.Vector3();
  for (let t = 0; t < P.count; t += 3) {
    m.set(0, 0, 0);
    for (let k = 0; k < 3; k++) m.add(q.fromBufferAttribute(P, t + k));
    m.multiplyScalar(1 / 3);
    const hole = ears.some((e) => {
      const d = m.clone().sub(e.base), along = d.dot(e.dir);
      return along > 0 && d.addScaledVector(e.dir, -along).length() < GUIDE_HOLE;
    });
    if (hole) continue;
    for (let k = 0; k < 3; k++) { keepPos.push(P.getX(t + k), P.getY(t + k), P.getZ(t + k)); keepNor.push(N.getX(t + k), N.getY(t + k), N.getZ(t + k)); }
  }
  src.dispose();
  const shell = new THREE.BufferGeometry();
  shell.setAttribute('position', new THREE.Float32BufferAttribute(keepPos, 3));
  shell.setAttribute('normal', new THREE.Float32BufferAttribute(keepNor, 3));
  const parts = [part(shell, C.helmet)];
  // Rolled rim around the helmet.
  const rimPts = edge.map((th, i) => at(th, (i / NU - 0.5) * Math.PI * 2));
  for (let i = 0; i < NU; i++) {
    parts.push(rod(rimPts[i], rimPts[(i + 1) % NU], 0.0065, C.helmetRim, 6));
    parts.push(part(new THREE.SphereGeometry(0.0065, 6, 4), C.helmetRim, mat(rimPts[i].x, rimPts[i].y, rimPts[i].z)));
  }
  // Rim of each ear hole: a ring where the ear axis pierces the dome.
  for (const e of ears) {
    const p = e.base.clone();
    for (let k = 0; k < 400; k++) {
      p.addScaledVector(e.dir, 0.001);
      if (((p.x - c.x) / r.x) ** 2 + ((p.y - c.y) / r.y) ** 2 + ((p.z - c.z) / r.z) ** 2 >= 1) break;
    }
    const nrm = new THREE.Vector3((p.x - c.x) / r.x ** 2, (p.y - c.y) / r.y ** 2, (p.z - c.z) / r.z ** 2).normalize();
    const qt = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), nrm);
    parts.push(part(new THREE.TorusGeometry(GUIDE_HOLE + 0.002, 0.0085, 8, 40), C.helmetRim, new THREE.Matrix4().compose(p, qt, new THREE.Vector3(1, 1, 1))));
  }
  // Dark blue crest band from front to back.
  const crest = [];
  for (let k = 0; k <= 16; k++) crest.push(at(edge[NU / 2] * (1 - k / 16), 0, new THREE.Vector3(), 0.004));
  for (let k = 1; k <= 16; k++) crest.push(at(edge[0] * (k / 16), Math.PI, new THREE.Vector3(), 0.004));
  parts.push(ribbon(crest, () => new THREE.Vector3(1, 0, 0), 0.012, C.helmetDark));
  return parts;
}

/** Point of the lens (superellipse) at angle `al` and radius fraction `rho`; `k` > 1: beyond the edge (frame). */
function lensPoint(al, rho, out, k = 1) {
  const L = GUIDE_LENS, R = superR(al, L.p) * rho * k;
  const x = L.a * R * Math.cos(al), y = L.y0 + L.b * R * Math.sin(al);
  return out.set(x, y, GUIDE_FACE(y) + L.clear - 2 * x * x + L.h * Math.sqrt(Math.max(0, 1 - Math.min(1, rho) ** 2)));
}

/** Ski mask: curved gradient lens, black frame, black strap around the helmet. */
function guideMaskParts() {
  const C = GUIDE_COLORS, L = GUIDE_LENS, back = new THREE.Vector3(0, L.y0, GUIDE_FACE(L.y0) - 0.1);
  const grad = (x, y, z, out) => {
    const f = THREE.MathUtils.clamp((y - (L.y0 - L.b)) / (2 * L.b), 0, 1);
    if (f < 0.5) out.set(C.lensYellow).lerp(_c2.set(C.lensOrange), f / 0.5); else out.set(C.lensOrange).lerp(_c2.set(C.lensRed), (f - 0.5) / 0.5);
  };
  const parts = [paintGeometry(gridGeometry(48, 10, (u, v, out) => lensPoint(u * Math.PI * 2, v, out), back, true), grad)];
  // Frame: black band around the lens, folding back toward the face.
  const band = gridGeometry(48, 2, (u, v, out) => {
    lensPoint(u * Math.PI * 2, 1, out, 1 + (L.frame - 1) * v);
    out.z -= 0.012 * v - 0.004;
  }, back, true);
  parts.push(part(band, C.frame));
  const ring = [];
  for (let i = 0; i < 48; i++) { const o = lensPoint((i / 48) * Math.PI * 2, 1, new THREE.Vector3(), L.frame); o.z -= 0.008; ring.push(o); }
  for (let i = 0; i < 48; i++) parts.push(rod(ring[i], ring[(i + 1) % 48], 0.0055, C.frame, 6));
  // Glint: a pale stroke on the top left of the lens.
  const glint = [];
  for (let k = 0; k <= 8; k++) glint.push(lensPoint(Math.PI * (0.62 + 0.2 * k / 8), 0.72, new THREE.Vector3()).add(new THREE.Vector3(0, 0, 0.003)));
  parts.push(ribbon(glint, () => new THREE.Vector3(0, 0, 1), 0.0035, C.glint));
  // Strap: from the frame, on each side, around the helmet at equator height, to the nape.
  const { c, r } = GUIDE_HELMET;
  for (const sx of [-1, 1]) {
    const x0 = sx * L.a * L.frame;
    const pts = [new THREE.Vector3(x0, L.y0, GUIDE_FACE(L.y0) + L.clear - 2 * x0 * x0)];
    for (let k = 0; k <= 14; k++) {
      const ph = Math.PI * (0.62 + 0.38 * k / 14);
      pts.push(new THREE.Vector3(sx * (r.x + 0.008) * Math.sin(ph), c.y + 0.002, c.z + (r.z + 0.008) * Math.cos(ph)));
    }
    parts.push(ribbon(pts, () => new THREE.Vector3(0, 1, 0), 0.02, C.strap));
  }
  return parts;
}

/** Khaki backpack on the back, above the two poles. */
function guidePackParts() {
  const C = GUIDE_COLORS;
  const box = (w, h, d, rad, x, y, z, hex) => part(new RoundedBoxGeometry(w, h, d, 3, rad), hex, mat(x, y, z));
  const parts = [
    box(0.3, 0.25, 0.34, 0.045, 0, 0.815, -0.105, C.pack),
    box(0.31, 0.06, 0.35, 0.028, 0, 0.955, -0.1, C.packDark), // flap
    box(0.2, 0.15, 0.05, 0.02, 0, 0.795, -0.29, C.packLight), // rear pocket
    box(0.05, 0.16, 0.2, 0.02, 0.165, 0.775, -0.12, C.packDark), // side pockets
    box(0.05, 0.16, 0.2, 0.02, -0.165, 0.775, -0.12, C.packDark),
  ];
  // Compression straps on the rear pocket and buckles of the flap.
  for (const sx of [-1, 1]) {
    parts.push(box(0.022, 0.2, 0.012, 0.004, sx * 0.075, 0.82, -0.2765, C.webbing));
    parts.push(box(0.02, 0.025, 0.014, 0.004, sx * 0.075, 0.95, -0.275, C.buckle));
  }
  return parts;
}

/** Straps of one side (`sx` = ±1): shoulder strap (back bone), then loop around the front leg (thigh bone). */
function guideStrapParts(sx) {
  const C = GUIDE_COLORS, V = (x, y, z) => new THREE.Vector3(sx * x, y, z);
  const X = new THREE.Vector3(1, 0, 0), Z = new THREE.Vector3(0, 0, 1);
  const back = [V(0.095, 0.915, 0.069), V(0.095, 0.715, 0.073), V(0.118, 0.655, 0.105), V(0.15, 0.55, 0.12), V(0.155, 0.45, 0.14)];
  const wBack = [X, X.clone().multiplyScalar(0.7).addScaledVector(Z, 0.3).normalize(), X.clone().multiplyScalar(0.3).addScaledVector(Z, 0.7).normalize(), Z, Z];
  const spine = [ribbon(back, (i) => wBack[i], 0.017, C.webbing)];
  const leg = [ribbon([back[4], V(0.15, 0.36, 0.15)], () => Z, 0.017, C.webbing)];
  const ringPts = [];
  for (let i = 0; i < 40; i++) {
    const a = (i / 40) * Math.PI * 2;
    ringPts.push(V(0.085 + 0.06 * Math.cos(a), 0.34, 0.15 + 0.1 * Math.sin(a)));
  }
  leg.push(ribbon(ringPts, () => new THREE.Vector3(0, 1, 0), 0.022, C.webbing, true));
  leg.push(part(new THREE.BoxGeometry(0.02, 0.03, 0.016), C.buckle, mat(sx * 0.145, 0.36, 0.15)));
  return { spine, leg };
}

/** Two blue hiking poles along the back, under the pack: grip in front, basket and tip behind. */
function guidePoleParts() {
  const C = GUIDE_COLORS, parts = [];
  for (const sx of [-1, 1]) {
    const a = new THREE.Vector3(sx * 0.085, 0.645, -0.42), b = new THREE.Vector3(sx * 0.06, 0.675, 0.11);
    const dir = b.clone().sub(a).normalize();
    const at = (t) => a.clone().lerp(b, t);
    const q = new THREE.Quaternion().setFromUnitVectors(UP, dir);
    parts.push(rod(a, b, 0.0105, C.pole, 8));
    parts.push(rod(a, at(0.18), 0.0125, C.poleDark, 8)); // darker lower section
    parts.push(rod(b.clone().addScaledVector(dir, -0.055), b.clone().addScaledVector(dir, 0.02), 0.0165, C.grip, 8)); // grip
    parts.push(part(new THREE.ConeGeometry(0.0085, 1, 8), C.tip, between(a, a.clone().addScaledVector(dir, -0.05)))); // tip
    parts.push(part(new THREE.CylinderGeometry(0.03, 0.03, 0.006, 16), C.grip, new THREE.Matrix4().compose(at(0.05), q, new THREE.Vector3(1, 1, 1)))); // basket
    parts.push(part(new THREE.TorusGeometry(0.022, 0.004, 5, 14), C.webbing, new THREE.Matrix4().compose(b.clone().addScaledVector(dir, -0.075).add(new THREE.Vector3(0, 0.004, 0)), q, new THREE.Vector3(1, 1, 1)))); // wrist strap
  }
  return parts;
}

/**
 * Guide gear (see above).
 * @param {object} o `ears`: per ear, `base` and `dir` (axis toward the tip), root frame at rest at actual size;
 *   `scale`
 * @returns {object} meshes to attach: `helmet` and `mask` (head), `pack` (back, with poles and shoulder straps),
 *   `legL` and `legR` (front thighs, left +X and right −X)
 */
export function buildGuideGear({ ears, scale = 1 }) {
  const k = 1 / scale;
  const earsD = ears.map((e) => ({ base: e.base.clone().multiplyScalar(k), dir: e.dir.clone() }));
  const S = mat(0, 0, 0, 0, 0, 0, scale);
  const place = (parts) => parts.map((g) => g.applyMatrix4(S));
  const sl = guideStrapParts(1), sr = guideStrapParts(-1);
  return {
    helmet: merged(place(guideHelmetParts(earsD)), 'NpcGuideHelmet'),
    mask: merged(place(guideMaskParts()), 'NpcGuideMask'),
    // Pack and poles moved closer to the back by GUIDE_PACK_DROP; the shoulder straps stay in place.
    pack: merged(place([...guidePackParts(), ...guidePoleParts()].map((g) => g.translate(0, -GUIDE_PACK_DROP, 0)).concat(sl.spine, sr.spine)), 'NpcGuidePack'),
    legL: merged(place(sl.leg), 'NpcGuideStrapL'),
    legR: merged(place(sr.leg), 'NpcGuideStrapR'),
  };
}
