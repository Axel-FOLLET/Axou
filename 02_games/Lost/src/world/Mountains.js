import * as THREE from 'three';
import { MOUNTAIN_ROCK, LIGHT } from '../style/palette.js';
import { heightAt as terrainHeight, TERRAIN_SIZE, SPUR_SINK } from './Terrain.js';
import { ZONE2 } from './zone2.js';
import { rng } from './random.js';

/**
 * Background mountains, one horizon per zone. Built by World.js: the default MEADOW_HORIZON in `world.meadowGroup`,
 * ZONE2_HORIZON in `world.mountainGroup` on the first entry. The inactive horizon stays out of the scene.
 *
 * A peak is a stack of contour rows around its axis (one row per altitude, one column per azimuth), never a surface
 * of revolution. Uneven ridges, strata offset per face, cliffs, ledges and scree make it read as rock without any
 * texture. Facets are flat (non-indexed triangles) with 3 flat tones, like the game's toon shading; snow is decided
 * per facet from slope and exposure.
 *
 * Haze is baked per vertex (`fog: false`, `toneMapped: false`, like the sky). At ground level it equals FOG.color, so
 * no line shows against the fogged ground. Cost: one static mesh and draw call per range, one shared MeshBasic
 * material, no lights, shadows or updates; faces no camera can see from the front are removed at build (`facingData`).
 */

/**
 * Peak shape. Values are fractions, or slope cotangents (horizontal per vertical) where noted.
 * - `scree`: top of the scree as a fraction of the height, at most `maxTop` m so giants keep the playable slope
 *   clear; `climb` rise in the gullies; `cot` cotangent (1.5 = 34 deg, the angle of repose); `foot` stretch at the
 *   base; `fan` spread (0.7 on a ridge, 1.6 under a gully).
 * - `cliff`, `ledge`, `summit`: cotangents of a cliff row (drawn per row and per face), a ledge and the last step.
 *   `ledgeChance`: about one row in 4 is a ledge, never two in a row.
 * - `concave`: lower rows flare out, so the profile steepens with height like a real slope.
 * - `top`: altitude of the last row; the rest is the tip.
 * - `crest`: ridges at both ends of the axis (`len` length; `shoulder` below 1 keeps the ridge high far from the
 *   axis). `spur`: shorter ridges elsewhere. `ridges`: total number of ridges.
 * - `stretch`, `squeeze`: plan stretched along the crest, narrowed across it.
 * - `face`: radius at mid-face (ridge = 1 x its length), giving a star-shaped plan.
 * - `gully`: gully at mid-face, as a fraction of the radius. `rib`: vertical ribs, every other column forward, cutting
 *   across the strata as on a real wall. `rough`: per-vertex roughness.
 * - `twist`: ridges rotate with height (rad, +/-). `drift`: summit offset from the axis (fraction of the radius), so
 *   one face is steeper. `dip`: strata slope (tangent).
 * - `slip`: band offset of a face (fraction of the mean row height), zero on the ridge.
 * - `tooth`: ridge teeth as a fraction of the row height (stays below 0.5 to avoid folds).
 */
const FORM = {
  scree: { top: [0.2, 0.28], maxTop: 12, cot: 1.5, foot: 1.35, fan: [0.7, 1.6], climb: 0.7 },
  cliff: [0.18, 0.5], ledge: 1.4, ledgeChance: 0.24, summit: 0.6,
  concave: 0.9,
  top: 0.86,
  ridges: [3, 5],
  crest: { len: [1, 1.4], shoulder: [0.6, 0.95] }, spur: { len: [0.5, 0.95], shoulder: [0.9, 1.3] },
  stretch: [1.2, 1.7], squeeze: 0.85,
  face: [0.42, 0.7], gully: 0.14, rib: 0.09, rough: 0.07,
  twist: 0.55, drift: [0.18, 0.48], dip: [0.18, 0.42],
  slip: 0.9,
  tooth: 0.42,
};

/**
 * Shading and snow, driven by half-Lambert (0 to 1) or the vertical normal.
 * - `tone`: bounds of the two transitions shade -> full tint -> highlight; narrow for flat tones, never zero so the
 *   tones stay soft (same idea as the 3 steps of `toonGradient`).
 * - `fill`: share of a fill light opposite the sun; without it any backlit slope (the main peak at +X is one)
 *   collapses into a single lavender tone. `shadeMix`: share of lavender in shade.
 * - `ledgeN`: above this vertical normal, a facet takes the ledge tint. `stratum`: tint variation between bands
 *   (soft, to avoid stripes). `screeFan`: tint difference between scree columns.
 * - Snow, as offsets of the snow line (fraction of the height): `snowFlat` (normal bounds, gain) a flat facet holds
 *   snow; `snowSteep` (bounds, loss) a steep one sheds it, leaving rock high up; `snowSun` sunny slopes hold less;
 *   `snowFan` gullies hold it lower; `snowPatch` patches drawn per tile of 2 columns by 2 rows. `snowCap`: always
 *   white above this.
 */
const SHADE = {
  tone: [[0.4, 0.52], [0.7, 0.84]],
  fill: 0.42, shadeMix: 0.5,
  ledgeN: [0.62, 0.8],
  snowFlat: { n: [0.55, 0.85], gain: 0.12 },
  snowSteep: { n: [0.35, 0.6], loss: 0.36 },
  snowSun: 0.08,
  snowFan: 0.12,
  snowPatch: 0.12,
  snowCap: 0.96,
  screeFan: 0.8,
  stratum: 0.16,
};

/**
 * Meadow horizon, around the origin. Out of reach: the cat stays within 40 m, the camera within 10 m of it and the
 * ground fog ends at 46 m, so rock only emerges beyond that, except at +X where it stands behind the rampart and the
 * drawn crest. Three ranges, each higher and paler; the main peak at +X rises above the rampart.
 *
 * Range: `r` radius of the peak centres (m), `count`, `H` height (m), `aspect` radius / height, `cols` columns,
 * `bands` cliff bands, `footFade` height above the ground where the foot haze ends (m), `snow` snow line (fraction of
 * the height; a peak may set its own), `gap` half-angle left free around +X for the main peak (rad).
 *
 * `haze`: haze amount by distance to the zone centre, per mesh vertex rather than per range, so the scree of a far
 * range reaching in front of a near one is not paler than it.
 *
 * `cameras`: box of possible camera positions (m), for `facingData`. Horizontal: cat up to 40 m + arena camera up to
 * 22 m (`COMBAT_CAM.fight.maxDistance`) + 8 m margin. Top: 2.3 m of ground + those 22 m, with room above the ruins.
 * A camera outside this box would see holes: widen the box first.
 */
export const MEADOW_HORIZON = {
  name: 'Mountains',
  look: MOUNTAIN_ROCK.meadow,
  haze: [[110, 0.08], [330, 0.62]],
  cameras: { x: [-70, 70], y: [-2, 45], z: [-70, 70] },
  ranges: [
    { name: 'near', r: [158, 182], count: 14, H: [24, 38], aspect: [0.95, 1.25], cols: 23, bands: 5, footFade: [2.8, 9], snow: 0.74, gap: 0.5, seed: 3, sat: 1.2 },
    { name: 'far', r: [222, 262], count: 12, H: [42, 62], aspect: [0.95, 1.2], cols: 20, bands: 4, footFade: [2.8, 13], snow: 0.68, gap: 0.32, seed: 11, sat: 1 },
    { name: 'last', r: [298, 330], count: 13, H: [68, 92], aspect: [0.8, 1.05], cols: 16, bands: 2, footFade: [2.8, 20], snow: 0.6, gap: 0, seed: 29 },
  ],
  // Main peak: finer `cols` and `bands` because it is the closest and the one the player looks at.
  massif: {
    name: 'foothill', footFade: [0, 7], snow: 0.66, seed: 41, foot: -2,
    peaks: [
      { x: 186, z: -6, H: 72, aspect: 0.98, cols: 48, bands: 8, axis: Math.PI + 1.57 },
      // Buttresses: their rock emerges from the haze just behind the drawn terrain crest (`SPUR_SINK`).
      { x: 108, z: -6, H: 37, aspect: 0.62, cols: 20, bands: 4, axis: Math.PI + 1.57, snow: 0.95 },
      { x: 111, z: 12, H: 34, aspect: 0.62, cols: 16, bands: 3, axis: 3.0 + 1.57, snow: 0.95 },
      { x: 112, z: -24, H: 33, aspect: 0.62, cols: 16, bands: 3, axis: 3.3 + 1.57, snow: 0.95 },
      { x: 116, z: 31, H: 32, aspect: 0.66, cols: 16, bands: 3, axis: 2.9 + 1.57, snow: 0.95 },
      { x: 118, z: -43, H: 31, aspect: 0.66, cols: 16, bands: 3, axis: 3.4 + 1.57, snow: 0.95 },
      { x: 158, z: 12, H: 46, aspect: 0.8, cols: 18, bands: 3, axis: 3.4 + 1.57, snow: 0.8 },
      { x: 164, z: -30, H: 52, aspect: 0.75, cols: 18, bands: 3, axis: 3.0 + 1.57, snow: 0.76 },
      { x: 150, z: 44, H: 44, aspect: 1.1, cols: 30, bands: 6, axis: 2.6 + 1.57 },
      { x: 152, z: -56, H: 47, aspect: 1.08, cols: 30, bands: 6, axis: 3.7 + 1.57 },
      { x: 212, z: 52, H: 56, aspect: 1, cols: 26, bands: 4, axis: 2.2 + 1.57 },
      { x: 216, z: -66, H: 58, aspect: 1, cols: 26, bands: 4, axis: 4.1 + 1.57 },
      { x: 128, z: 86, H: 30, aspect: 1.15, cols: 24, bands: 4, axis: 2.2 + 1.57 },
      { x: 130, z: -94, H: 32, aspect: 1.15, cols: 24, bands: 4, axis: 4.1 + 1.57 },
    ],
  },
};

/**
 * Zone 2 horizon: high mountains around the slope. `center`: middle of the corridor. The ground is in fog at 80 m
 * from the camera (`MOUNTAIN_FOG`, World.js), so the peak feet emerge from haze, like a sea of fog when seen from
 * above. A near range, a higher one behind it, and five giants that tower over the slope seen from its foot.
 * Nothing lies further than 500 m (`camera.far`) from a corridor camera.
 * `low`: the range dips behind the bridge (-X), seen up close on arrival, so its peaks stay in frame (factor, half
 * width in rad). `cameras`: as for the meadow; covers the corridor and the camera distance, with a wide margin.
 */
export const ZONE2_HORIZON = {
  name: 'Mountains_zone2',
  center: { x: ZONE2.x + 60, z: 0 },
  look: MOUNTAIN_ROCK.zone2,
  haze: [[160, 0.12], [320, 0.6]],
  cameras: { x: [ZONE2.x - 30, ZONE2.x + 150], y: [-2, 80], z: [-50, 50] },
  ranges: [
    { name: 'near', r: [215, 240], count: 18, H: [40, 74], aspect: [0.66, 0.85], cols: 24, bands: 5, footFade: [0.5, 12], snow: 0.5, gap: 0, low: { k: 0.72, width: 0.9 }, seed: 53 },
    { name: 'far', r: [285, 308], count: 16, H: [85, 118], aspect: [0.62, 0.8], cols: 18, bands: 3, footFade: [0.5, 24], snow: 0.44, gap: 0, low: { k: 0.8, width: 0.9 }, seed: 67 },
  ],
  massif: {
    name: 'giants', hazeK: 0.6, footFade: [0.5, 24], snow: 0.62, seed: 79, foot: -2,
    peaks: [
      { x: ZONE2.x + 335, z: -30, H: 175, aspect: 0.5, cols: 34, bands: 6, axis: 1.57 },
      { x: ZONE2.x + 325, z: 70, H: 155, aspect: 0.52, cols: 28, bands: 5, axis: 0.3 + 1.57 },
      { x: ZONE2.x + 318, z: -128, H: 150, aspect: 0.52, cols: 28, bands: 5, axis: -0.3 + 1.57 },
      { x: ZONE2.x + 280, z: 165, H: 125, aspect: 0.56, cols: 24, bands: 4, axis: 0.7 + 1.57 },
      { x: ZONE2.x + 270, z: -205, H: 120, aspect: 0.56, cols: 24, bands: 4, axis: -0.7 + 1.57 },
    ],
  },
};

/**
 * Needles of a range (`sat`: mean count per peak): fraction of the parent height, slender, offset sideways (`off`)
 * and back (`back`), in parent heights; 14 columns and 2 bands are enough.
 */
const NEEDLE = { h: [0.5, 0.75], aspect: 0.72, off: 0.85, back: 0.25, cols: 14, bands: 2 };

const _groundLimit = TERRAIN_SIZE;
/**
 * Meadow ground under a scenery point (m), for the foot haze: beyond the mesh edge, the height of the edge; at +X, the
 * height of the drawn crest (`SPUR_SINK`), so rock emerges from haze at that height with no line against the fogged
 * terrain, even through the open gate.
 */
function meadowGround(x, z) {
  return terrainHeight(Math.max(-_groundLimit, Math.min(x, SPUR_SINK.x0)), Math.max(-_groundLimit, Math.min(z, _groundLimit)));
}

function smoothstep(a, b, x) {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
}

const lerp = (a, b, t) => a + (b - a) * t;
const pick = (r, rand) => lerp(r[0], r[1], rand());

/**
 * Plan of a peak: ridges sorted by azimuth, two at the ends of the crest, the others as spurs; one face per interval,
 * of unequal width; columns of each face. Column: azimuth, `t` (0 on a ridge, 1 at mid-face), plan `S`, `face`,
 * `near` (nearest ridge).
 */
function planOf(cfg, rand) {
  const axis = cfg.axis;
  const az = [
    { az: axis + (rand() - 0.5) * 0.5, ...FORM.crest },
    { az: axis + Math.PI + (rand() - 0.5) * 0.7, ...FORM.crest },
  ];
  const n = Math.round(pick(FORM.ridges, rand));
  for (let tries = 0; az.length < n && tries < 12; tries++) {
    const a = rand() * Math.PI * 2;
    if (az.every((r) => Math.abs(Math.atan2(Math.sin(r.az - a), Math.cos(r.az - a))) > 0.55)) az.push({ az: a, ...FORM.spur });
  }
  const a0 = az[0].az;
  const norm = (a) => ((a - a0) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
  const ridges = az.map((r) => ({ at: norm(r.az), len: pick(r.len, rand), shoulder: pick(r.shoulder, rand) })).sort((p, q) => p.at - q.at);
  const faces = [], cols = [];
  ridges.forEach((a, k) => {
    const b = ridges[(k + 1) % ridges.length];
    const gap = k + 1 < ridges.length ? b.at - a.at : b.at + Math.PI * 2 - a.at;
    const m = Math.max(3, Math.round((cfg.cols * gap) / (Math.PI * 2)));
    const faceR = pick(FORM.face, rand);
    faces.push({ slip: (rand() - 0.5) * 2 * FORM.slip });
    for (let j = 0; j < m; j++) {
      const f = (j + (j ? (rand() - 0.5) * 0.4 : 0)) / m;
      const t = 1 - Math.abs(2 * f - 1);
      const near = f < 0.5 ? a : b;
      // Pointed ridge (t^0.7: vertical tangent at the ridge), gully carved at mid-face.
      const S = lerp(near.len, faceR, Math.pow(t, 0.7)) * (1 - FORM.gully * smoothstep(0.7, 1, t));
      const rib = j ? 1 + (j % 2 ? FORM.rib : -FORM.rib) * (0.6 + 0.4 * rand()) : 1;
      cols.push({ az: a0 + a.at + gap * f, t, S: S * rib, ridge: j === 0, face: k, near, fanTint: rand() });
    }
  });
  return { cols, faces };
}

/**
 * Rows of a peak, bottom to top: irregular heights shared by the whole peak; profile per face (`face.prof`, radius as
 * a fraction of the radius at the cliff foot) and tint per face and row (`face.tint`), so a ledge or band on one face
 * does not continue onto the next.
 */
function rowsOf(cfg, faces, footY, rand) {
  const H = cfg.H;
  const hs = Math.min(pick(FORM.scree.top, rand) * H, FORM.scree.maxTop);
  const ys = [footY, hs * 0.45];
  const top = FORM.top * H;
  const nRock = 2 * cfg.bands, weights = [];
  let sum = 0;
  for (let b = 0; b < nRock; b++) { const w = 0.55 + 0.9 * rand(); weights.push(w); sum += w; }
  let y = hs;
  for (let b = 0; b < nRock; b++) { ys.push(y); y += ((top - hs) * weights[b]) / sum; }
  ys.push(top, H);
  const nR = ys.length;
  for (const face of faces) {
    const prof = new Array(nR).fill(0), tint = new Array(nR).fill(0);
    let wasLedge = false;
    for (let i = nR - 2; i >= 2; i--) {
      const summit = i === nR - 2;
      const ledge = !summit && !wasLedge && rand() < FORM.ledgeChance;
      wasLedge = ledge;
      const cot = summit ? FORM.summit : ledge ? FORM.ledge : pick(FORM.cliff, rand);
      prof[i] = prof[i + 1] + (ys[i + 1] - ys[i]) * cot * (1 + FORM.concave * (1 - ys[i] / H));
      tint[i] = (rand() - 0.5) * 2;
    }
    face.prof = prof.map((v) => v / prof[2]);
    face.tint = tint;
  }
  return { ys, hs, nR, dy: (top - hs) / Math.max(nRock, 1) };
}

const _ab = new THREE.Vector3(), _ac = new THREE.Vector3(), _n = new THREE.Vector3();
const _mid = new THREE.Color(), _lit = new THREE.Color(), _shade = new THREE.Color(), _c = new THREE.Color(), _v = new THREE.Color();

/** One peak: writes its facets (positions, colours) to `out`. */
function addPeak(out, cfg, chain, horizon, look, sun, ground, rand) {
  const H = cfg.H, R = H * cfg.aspect;
  const { cols, faces } = planOf(cfg, rand), nC = cols.length;
  const { ys, hs, nR, dy: rowH } = rowsOf(cfg, faces, chain.foot ?? -1.5, rand);
  const twist = (rand() - 0.5) * 2 * FORM.twist;
  const driftA = rand() * Math.PI * 2, driftR = pick(FORM.drift, rand) * R;
  const dipA = rand() * Math.PI * 2, dip = pick(FORM.dip, rand);
  const stretch = pick(FORM.stretch, rand), ca = Math.cos(cfg.axis), sa = Math.sin(cfg.axis);
  const center = horizon.center ?? { x: 0, z: 0 };
  const patches = new Float32Array(64);
  for (let i = 0; i < 64; i++) patches[i] = (rand() - 0.5) * 2;
  const sunH = Math.hypot(sun.x, sun.z);

  // Mesh vertices, shared only for computation: each facet copies its own.
  const P = new Float32Array(nC * nR * 3);
  for (let j = 0; j < nC; j++) {
    const col = cols[j], face = faces[col.face];
    const rBase = R * col.S;
    const fan = lerp(FORM.scree.fan[0], FORM.scree.fan[1], col.t * col.t);
    const toFace = smoothstep(0, 0.45, col.t);
    let prevY = -Infinity, prevR = Infinity;
    for (let i = 0; i < nR; i++) {
      const y0 = ys[i];
      let r;
      if (i === 0) r = rBase + (hs - ys[1]) * FORM.scree.cot * fan + (ys[1] - y0) * FORM.scree.cot * FORM.scree.foot * fan;
      else if (i === 1) r = rBase + (hs - y0) * FORM.scree.cot * fan;
      else {
        // On the ridge, the ridge profile (shoulder); on the face, the face profile.
        const onRidge = Math.pow(Math.max((H - y0) / (H - ys[2]), 0), col.near.shoulder);
        r = rBase * lerp(onRidge, face.prof[i], toFace) * (col.ridge ? 1 : 1 + (rand() - 0.5) * 2 * FORM.rough);
        r = Math.min(r, prevR);
      }
      prevR = r;
      const u = Math.max(y0, 0) / H;
      const a = col.az + twist * u;
      const px = Math.cos(a) * r, pz = Math.sin(a) * r;
      const along = (px * ca + pz * sa) * stretch, across = (-px * sa + pz * ca) * FORM.squeeze;
      const dx = along * ca - across * sa + Math.cos(driftA) * driftR * u;
      const dz = along * sa + across * ca + Math.sin(driftA) * driftR * u;
      let y = y0;
      if (i >= 2 && i < nR - 1) {
        const dy = Math.min(y0 - ys[i - 1], ys[i + 1] - y0);
        // Teeth: mostly on the ridge.
        y += (rand() - 0.5) * 2 * dy * FORM.tooth * (col.ridge ? 1 : 0.25);
        // Face bands, offset from the neighbouring face; none on the ridge, which stays continuous.
        y += face.slip * rowH * toFace * smoothstep(ys[2], ys[3], y0);
        // Foot of the cliffs: scree climbs into the gullies, so its edge is never a straight line.
        if (i === 2) y += (col.t * col.t - 0.3) * Math.min(hs, ys[3] - ys[2]) * FORM.scree.climb;
        // Tilted strata, increasing with height: the foot stays at ground level.
        y += dip * (dx * Math.cos(dipA) + dz * Math.sin(dipA)) * smoothstep(0.1, 0.4, u);
        // Never a row below the previous one (flipped face, hence a hole) nor above the tip.
        y = Math.min(Math.max(y, prevY + 0.1 * dy), H * (1 - 0.012 * (nR - 1 - i)));
      }
      prevY = y;
      const k = (j * nR + i) * 3;
      P[k] = cfg.x + dx; P[k + 1] = y; P[k + 2] = cfg.z + dz;
    }
  }

  const vertex = (j, i, c) => {
    const k = (j * nR + i) * 3, x = P[k], y = P[k + 1], z = P[k + 2];
    const foot = 1 - smoothstep(chain.footFade[0], chain.footFade[1], y - ground(x, z));
    const [[r0, h0], [r1, h1]] = horizon.haze;
    const far = lerp(h0, h1, Math.min(Math.max((Math.hypot(x - center.x, z - center.z) - r0) / (r1 - r0), 0), 1)) * (chain.hazeK ?? 1);
    _v.copy(c).lerp(look.hazeColor, far + (1 - far) * foot);
    out.pos.push(x, y, z);
    out.col.push(_v.r, _v.g, _v.b);
  };
  const facet = (i, j, ia, ja, ib, jb, ic, jc) => {
    const ka = (ja * nR + ia) * 3, kb = (jb * nR + ib) * 3, kc = (jc * nR + ic) * 3;
    _ab.set(P[kb] - P[ka], P[kb + 1] - P[ka + 1], P[kb + 2] - P[ka + 2]);
    _ac.set(P[kc] - P[ka], P[kc + 1] - P[ka + 1], P[kc + 2] - P[ka + 2]);
    _n.crossVectors(_ab, _ac).normalize();
    const lambert = lerp(0.5 + 0.5 * _n.dot(sun), 0.5 + 0.5 * (_n.y * sun.y - _n.x * sun.x - _n.z * sun.z), SHADE.fill);
    const col = cols[j], face = faces[col.face];
    const cy = (P[ka + 1] + P[kb + 1] + P[kc + 1]) / 3 / H;

    // Tint: scree (with grass at the very bottom, if any), otherwise the face band, lighter on a ledge.
    if (i < 2) {
      // One stream per column, lighter or darker: this is what makes a scree cone readable.
      _mid.copy(look.screeColor).lerp(col.fanTint > 0.5 ? look.ledgeColor : look.coolColor, SHADE.screeFan * Math.abs(2 * col.fanTint - 1));
      if (look.meadowColor) _mid.lerp(look.meadowColor, 1 - smoothstep(0.0, 0.07, cy));
    } else {
      _mid.copy(look.rockColor);
      const t = face.tint[Math.min(i, nR - 2)];
      if (t > 0) _mid.lerp(look.warmColor, t * SHADE.stratum * 3); else _mid.lerp(look.coolColor, -t * SHADE.stratum * 3);
      _mid.lerp(look.ledgeColor, smoothstep(SHADE.ledgeN[0], SHADE.ledgeN[1], _n.y));
    }
    _shade.copy(_mid).lerp(look.shadeColor, SHADE.shadeMix);
    _lit.copy(_mid).lerp(look.litColor, 0.7);
    _c.copy(_shade).lerp(_mid, smoothstep(SHADE.tone[0][0], SHADE.tone[0][1], lambert));
    _c.lerp(_lit, smoothstep(SHADE.tone[1][0], SHADE.tone[1][1], lambert));

    // Snow: by slope, exposure and gully, in patches: no ring, no regular cap.
    if (i >= 2) {
      const flat = smoothstep(SHADE.snowFlat.n[0], SHADE.snowFlat.n[1], _n.y);
      const steep = 1 - smoothstep(SHADE.snowSteep.n[0], SHADE.snowSteep.n[1], _n.y);
      const hl = Math.hypot(_n.x, _n.z) || 1;
      const sunny = (_n.x * sun.x + _n.z * sun.z) / (hl * sunH);
      const patch = patches[((j >> 1) * 7 + (i >> 1) * 13 + col.face * 5) & 63];
      const line = (cfg.snow ?? chain.snow) - SHADE.snowFlat.gain * flat + SHADE.snowSteep.loss * steep + SHADE.snowSun * sunny
        - SHADE.snowFan * col.t * col.t + SHADE.snowPatch * patch;
      if (cy > line || cy > SHADE.snowCap) {
        _c.copy(look.snowShadeColor).lerp(look.snowColor, smoothstep(SHADE.tone[0][0], SHADE.tone[1][0], lambert));
      }
    }
    vertex(ja, ia, _c); vertex(jb, ib, _c); vertex(jc, ic, _c);
  };

  for (let i = 0; i < nR - 1; i++) {
    for (let j = 0; j < nC; j++) {
      const j2 = (j + 1) % nC;
      if (i + 2 === nR) { facet(i, j, i, j, i + 1, j, i, j2); continue; } // tip: one triangle per column
      if (rand() < 0.5) {
        facet(i, j, i, j, i + 1, j, i, j2);
        facet(i, j, i, j2, i + 1, j, i + 1, j2);
      } else {
        facet(i, j, i, j, i + 1, j2, i, j2);
        facet(i, j, i, j, i + 1, j, i + 1, j2);
      }
    }
  }
}

/** Peaks of a ring-shaped range around `center`, leaving the `gap` around +X empty. */
function ringPeaks(cfg, center, rand) {
  const out = [];
  const span = Math.PI * 2 - 2 * cfg.gap;
  for (let i = 0; i < cfg.count; i++) {
    const a = cfg.gap + (((i + 0.2 + 0.6 * rand()) / cfg.count) * span);
    const r = pick(cfg.r, rand);
    const toBack = Math.abs(Math.atan2(Math.sin(a - Math.PI), Math.cos(a - Math.PI)));
    const k = cfg.low ? lerp(cfg.low.k, 1, smoothstep(0, cfg.low.width, toBack)) : 1;
    out.push({
      x: center.x + Math.cos(a) * r, z: center.z + Math.sin(a) * r,
      H: pick(cfg.H, rand) * k, aspect: pick(cfg.aspect, rand), cols: cfg.cols, bands: cfg.bands,
      axis: a + Math.PI / 2 + (rand() - 0.5) * 1.1, // crest along the range, at an angle: the foot stays far from the centre
    });
    // Needles: one or two slimmer peaks beside the main one, set back, for a jagged skyline.
    const sats = cfg.sat ? Math.floor(cfg.sat + rand()) : 0;
    const parent = out[out.length - 1];
    for (let s = 0; s < sats; s++) {
      const side = (s % 2 ? 1 : -1) * (0.5 + 0.5 * rand());
      const sr = r + NEEDLE.back * parent.H, sa = a + (side * NEEDLE.off * parent.H) / sr;
      out.push({
        x: center.x + Math.cos(sa) * sr, z: center.z + Math.sin(sa) * sr,
        H: parent.H * lerp(NEEDLE.h[0], NEEDLE.h[1], rand()), aspect: NEEDLE.aspect,
        cols: NEEDLE.cols, bands: NEEDLE.bands, axis: sa + Math.PI / 2 + (rand() - 0.5) * 1.4,
      });
    }
  }
  return out;
}

const SHARED_MATERIAL = new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, toneMapped: false });

/** Facets of a range. */
function chainData(peaks, chain, horizon, look, sun, ground, seed) {
  const rand = rng(seed);
  const out = { pos: [], col: [] };
  for (const p of peaks) addPeak(out, p, chain, horizon, look, sun, ground, rand);
  return out;
}

/** Bounding sphere of the full mesh: it decides the draw order between ranges (see `chainMesh`). */
function sphereOf(pos) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
  g.computeBoundingSphere();
  return g.boundingSphere;
}

/**
 * `sphere`: that of the full mesh, kept after `facingData`. three.js sorts ranges by the centre of this sphere;
 * recomputing it on the pruned mesh would change the draw order, hence pixels between ranges of equal depth.
 */
function chainMesh(name, peaks, data, sphere) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(data.pos), 3));
  g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(data.col), 3));
  g.boundingSphere = sphere;
  const mesh = new THREE.Mesh(g, SHARED_MATERIAL);
  mesh.name = name;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.matrixAutoUpdate = false;
  mesh.raycast = () => {}; // never hit by Picker.js
  return { mesh, peaks, triangles: data.pos.length / 9 };
}

/**
 * A range without its always back-facing faces: same facets and colours, in the same order. A face is visible from a
 * point C if n.(C - A) > 0 (A one of its corners, n its normal); over the box, the maximum of n.C takes each axis at
 * its useful bound.
 */
function facingData(data, box) {
  const { pos, col } = data, keepP = [], keepC = [];
  for (let k = 0; k < pos.length; k += 9) {
    const ax = pos[k], ay = pos[k + 1], az = pos[k + 2];
    const ux = pos[k + 3] - ax, uy = pos[k + 4] - ay, uz = pos[k + 5] - az, vx = pos[k + 6] - ax, vy = pos[k + 7] - ay, vz = pos[k + 8] - az;
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const reach = nx * (nx > 0 ? box.x[1] : box.x[0]) + ny * (ny > 0 ? box.y[1] : box.y[0]) + nz * (nz > 0 ? box.z[1] : box.z[0]);
    if (reach < nx * ax + ny * ay + nz * az) continue;
    for (let n = 0; n < 9; n++) { keepP.push(pos[k + n]); keepC.push(col[k + n]); }
  }
  return { pos: keepP, col: keepC };
}

/** Colours of a horizon as THREE.Color, computed once. */
function lookColors(hex) {
  const c = (v) => (v === undefined ? null : new THREE.Color(v));
  return {
    rockColor: c(hex.rock), warmColor: c(hex.warm), coolColor: c(hex.cool), ledgeColor: c(hex.ledge),
    litColor: c(hex.lit), shadeColor: c(hex.shade), screeColor: c(hex.scree), meadowColor: c(hex.meadow),
    snowColor: c(hex.snow), snowShadeColor: c(hex.snowShade), hazeColor: c(hex.haze),
  };
}

/**
 * Mountains of a zone: `mountains.group` (to add to the zone's group), `mountains.triangles`,
 * `mountains.buildMs` (build time), `mountains.chains` (one entry per range).
 * `sunDir`: sun direction (normalised or not), default LIGHT.sun.offset. `ground`: optional ground height for the
 * foot haze. `prune` false: full mesh, for comparison.
 */
export class Mountains {
  constructor({ sunDir = new THREE.Vector3(...LIGHT.sun.offset), horizon = MEADOW_HORIZON, ground = null, prune = true } = {}) {
    const t0 = performance.now();
    const sun = sunDir.clone().normalize();
    const look = lookColors(horizon.look);
    const center = horizon.center ?? { x: 0, z: 0 };
    const groundAt = ground ?? (horizon === MEADOW_HORIZON ? meadowGround : () => 0);
    this.group = new THREE.Group();
    this.group.name = horizon.name;
    const list = horizon.ranges.map((cfg) => {
      const peaks = ringPeaks(cfg, center, rng(cfg.seed + 1000));
      return { name: `${horizon.name}_${cfg.name}`, peaks, data: chainData(peaks, cfg, horizon, look, sun, groundAt, cfg.seed) };
    });
    if (horizon.massif) {
      const m = horizon.massif;
      list.push({ name: `${horizon.name}_${m.name}`, peaks: m.peaks, data: chainData(m.peaks, m, horizon, look, sun, groundAt, m.seed) });
    }
    this.chains = list.map((c) => chainMesh(c.name, c.peaks, prune ? facingData(c.data, horizon.cameras) : c.data, sphereOf(c.data.pos)));
    for (const c of this.chains) {
      c.mesh.updateMatrix();
      this.group.add(c.mesh);
    }
    this.triangles = this.chains.reduce((s, c) => s + c.triangles, 0);
    this.buildMs = performance.now() - t0;
  }

}
