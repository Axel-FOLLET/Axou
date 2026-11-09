/**
 * East rampart, portcullis and drawbridge: the gateway between the meadow and the snowy mountain (zone 2). Created by
 * World.js; Crossing.js opens it and Story.js refreshes the navigation grid and minimap when its obstacle changes.
 *
 * Layout: a straight curtain wall at x = 34 from z = -14.5 to +14.5, then two slanted sections receding to r = 44 (beyond
 * the 40 m play disc), each ending in a tower, so no free edge is within reach. Stones are those of the ruins (Builder),
 * in absolute courses from the sill; a stone whose top is under the ground or water is skipped, so nothing floats.
 *
 * Each zone draws only its half of the world and the zone change happens under the arch (Crossing.js), so each side of
 * the gate carries a fake view of the other: a snow sheet behind the gate in the meadow (`_buildBeyond`), and in zone 2
 * the same rampart translated by `RETURN_LOOK.axis`, with a painted meadow seen through its gate (`buildReturn`).
 *
 * Occluders carry `userData.occContains` and an analytic `raycast` on oriented boxes: constant cost, instead of testing
 * 10,000 triangles. States: `closed` | `opening` | `open`; `setClosed` and `setOpen` are instant, `startOpening` plays the
 * animation once. The `rampart_closed` obstacle is removed only at the end of the animation.
 */

import * as THREE from 'three';
import { STONE, SNOW, GROUND, GRASS, FLOWERS, color, jitter, toonMaterial } from '../style/palette.js';
import { Builder, stoneColor, mossOf } from './Ruins.js';
import { rng } from './random.js';
import { heightAt, visualHeightAt, MOAT } from './Terrain.js';
import { ZONE2, mountainHeight, pathClearance } from './zone2.js';
import * as SnowLook from './snowLook.js';

/** Layout and masonry (m). Heights are measured from the gate sill (`sill`). */
export const RAMPART = {
  axisX: 34.1,        // curtain axis: face at 33.3, nearly flat ground (SPUR, Terrain.js)
  thick: 1.6,         // thickness: wide enough for a real vaulted passage behind the portcullis
  straightZ: 14.5,    // |z| of the straight / slanted junction, with a tower there
  endX: 20.8, endZ: 39.5, // end of the slanted section: r = 44, 4 m beyond the play disc limit
  courseH: 0.72,      // course height; an integer multiple up to the sill and the top
  stoneLen: 1.5,      // average stone length, at rampart scale (ruins: 0.4 m)
  joint: 0.018,       // recess between stones (the joint line)
  chamfer: 0.07,
  foot: -1.44,        // base: 2 courses below the sill, under the water and the moat bottom
  top: 5.76,          // top of the curtain (8 courses), about 18 times the cat's height: cannot be jumped
  merlon: { pitch: 1.5, w: 0.85, h: 0.7 },
  mossLow: 0.45,      // share of mossy stones on the first 2 courses above ground
  mossHigh: 0.06,     // above them
  obstacleTop: 6,     // top of the obstacles: every jump and every yarn ball stays below
};

/** Gate and gatehouse (m). */
export const GATE = {
  half: 1.5,          // half-width of the opening: wider than the bridge, so the portcullis shows on each side
  spring: 3.0,        // springing height of the arch
  ring: 0.3,          // voussoirs (3 m opening: crown at 4.5 m)
  houseZ: 3.3,        // half-width of the gatehouse, up to the tower axis
  houseTop: 8.64,     // 12 courses: the raised portcullis (top at 8.1 m) stays hidden in the masonry
  towerX: 33.5, towerZ: 3.3, towerR: 1.7, // round towers framing the gate
  towerTop: 10.0,     // higher than the gatehouse, like a keep
  towerStones: 10,
  towerCourse: 0.9,
};

/** Junction and end towers, octagonal (m). */
export const TOWER = { r: 1.6, top: 7.2, stones: 8, course: 0.9, wall: 0.4 };

/** Portcullis (m): thin bars and a wide pitch, so it can be seen through clearly. */
export const PORTCULLIS = {
  x: 33.75,           // inside the vaulted passage, set back from the face
  halfW: 1.56, h: 4.5, // overlaps the stone: no gap on the sides or under the arch
  barPitch: 0.4, railPitch: 0.45, bar: 0.038,
  lift: 3.6,          // travel: bottom at 3.6 m (passage under the arch), top at 8.1 m under the gatehouse roof
  iron: 0x5e4c5a, ironLight: 0x74606e, // dark mauve-brown: never black (palette rule)
};

/** Drawbridge (m). */
export const BRIDGE = {
  hingeX: 33.25,      // hinge flush with the wall face
  length: 2.7,        // raised, it reaches 2.7 m: the portcullis still shows above it, up to 4.5 m
  halfW: 0.95,        // 0.55 m of portcullis visible on each side when raised
  plank: 0.3,
  raised: -Math.PI / 2 + 0.05, // rad: against the wall, slightly tilted
  wood: { light: 0xf3cf98, base: 0xdcaa6e, dark: 0xb9824f }, // same wood as Launcher.js
};

/** Bridge chains (m): one geometry with two strands, length set by `setDrawRange`. */
export const CHAIN = { x: 33.2, y: 4.8, z: 0.85, pitch: 0.2, links: 28, attach: 0.15 };

/** Opening animation (s): readable at a glance without making the player wait. */
export const OPENING = { bridge: 2.6, portcullisAt: 2.2, portcullis: 2.2 }; // total 4.4 s; portcullis after the bridge, slight overlap

/** Visible moat (m); the digging table is in Terrain.js (`MOAT`). */
export const MOAT_LOOK = {
  waterY: -0.35,      // below the bank: covers the worst case of the 0.75 m mesh (-0.34 to -0.39 m)
  x0: 30.8, x1: 33.4,
  curbX: 30.6, curbHx: 0.3, curbHy: 0.22,
  water: 0x8cc6bd, waterLight: 0xa8d8cb,
};

/**
 * Snow side of the rampart (zone 2, m, relative to ZONE2.x; return strip: Crossing.js).
 * - `axis`: curtain axis. At -5.8 the snow-side face is at ZONE2.x - 5.0, the limit of the mountain scenery, and the
 *   bridge arrival `ZONE2_ENTRY` (ZONE2.x - 4.5) is 0.5 m in front of the passage. The vaulted passage must stay inside
 *   the foot disc (`FOOT.r` in zone2.js, at least 6 m).
 * - `x1`, `half`: snow-free footprint of the passage, read by main.js (`Footprints.keepOff`): no footprints on the paving.
 * - `end`: end of the slanted section (relative x, |z|), further than on the meadow side (58 m instead of 39.5 m): at
 *   65 m from the cat, in a 14 to 80 m fog, it can no longer be seen.
 * - `coarse`: beyond `from` m from the corner, big stones (`stoneLen`, courses of `course` m, merlons `merlon` times
 *   wider): the view is in the mist there, and it costs only 85 more stones.
 * - `mossK`: share of moss (snow covers what faces up). `snowCap`: snow thickness on merlons and tower crowns.
 */
export const RETURN_LOOK = {
  axis: -5.8, x1: -5.0, half: 1.5,
  end: { x: -30.0, z: 58 },
  coarse: { from: 20, stoneLen: 2.4, course: 1.44, merlon: 1.6 },
  mossK: 0.35, snowCap: 0.07,
  seed: 77,
};

/**
 * Snow behind the rampart as seen from the meadow (m, meadow frame): all the ground visible through the open gate is
 * snow, up to the horizon or to a pine, stone or slope, with no visible edge. One sheet covers the outside of the rampart
 * from `x1` to `zMax`, coloured like the ground of zone 2 (`SNOW`, `GROUND_LOOK` in snowLook.js).
 * - `rows`: [max |z|, step]; `cols` columns per row, packed against the rampart (`colPow`).
 * - `lift`: offset above the mesh; `liftFar` far away, between `liftFarFrom` and `liftFarTo` (ground cells grow).
 * - `liftNear`, `liftSide`: offset against the rampart, in front of the gate (under the paving edge) and on the sides.
 * - `skirt`: the first column goes below the ground, otherwise the edge floats and shows a green line at paving level.
 * - `edge`: fade to the ground over the far edges only (fog). `bright`: snow brightness, so it stands out from the sky.
 * - `pines` [x, z, height, radius] and `rocks` [x, z, radius]: near decoration seen from the deck.
 * - `scatter`: seeded far decoration that closes the view (`pines` and `rocks` counts, `x` bounds; the funnel widens from
 *   `z0` by `spread` per metre, at most `zCap`; beyond x = `far`, simple geometry).
 * - `grass`: grass grows 30 m around the cat (Grass.js `LAYERS`), so up to x = 65: grass-free strip at the gate (`doorHz`:
 *   half-width of the sheet) and flank rectangles (`flankHz` m outward); Meadow.js `EXCL_HALF` covers this square.
 */
export const BEYOND = {
  x1: 92, zMax: 40, rows: [[4, 0.5], [14.5, 1], [30, 2], [40, 3]], cols: 64, colPow: 1.7,
  lift: 0.06, skirt: 0.15, liftNear: 0.02, liftSide: 0.09, liftFar: 0.14, liftFarFrom: 40, liftFarTo: 70, edge: 5, bright: 0.82,
  pines: [[38.4, 3.3, 2.6, 0.8], [41.6, -3.7, 3.9, 1.15], [44.2, 2.2, 3.3, 1.0], [45.3, -0.6, 4.6, 1.3]],
  rocks: [[37.2, -2.5, 0.55], [40.6, 1.4, 0.42], [43.0, -1.0, 0.6]],
  scatter: { pines: 16, rocks: 9, x: [47, 84], z0: 3, spread: 0.3, zCap: 16, far: 56, h: [3.6, 6.2], R: [1.0, 1.6], r: [0.55, 1.1], gap: 3 },
  grass: { x1: 68, doorHz: 40, flankHz: 28 },
};

/**
 * Painted meadow seen from zone 2 through the gate (m, relative to ZONE2.x; the real meadow is not in the scene).
 * - `x0`: far edge of the carpet; `zMax`: |z| where it stops; `edge`: fade to snow over the outer borders.
 * - `rows`: [max |z|, step] per band; `cols` columns per row, packed against the rampart (distance = width x
 *   (rank / cols)^`colPow`): the carpet must follow the snow berm that passes right in front of the gate.
 * - `lift`: offset above the snow; `liftFar` further away (ground cells grow), plus `drift` x the maximum drift height
 *   (`DRIFT.amp` in snowLook.js): the carpet must stay above the raised snow mesh.
 * - `tufts`: grass tufts of `blades` blades in a funnel of `half0` + `spread` x distance (m) in front of the gate.
 * - `flowers`: small flowers, same tints as the meadow.
 */
export const FAKE_MEADOW = {
  x0: -62, zMax: 64, rows: [[8, 0.5], [20, 1], [64, 2]], cols: 40, colPow: 2, lift: 0.06, drift: 1.25, liftFar: 0.25, liftFarFrom: -8, liftFarTo: -22, edge: 4,
  tufts: { count: 1100, h: [0.26, 0.5], w: 0.085, lean: 0.28, blades: 5, half0: 1.8, spread: 0.42, zCap: 12, len: 38 },
  flowers: { count: 26, r: 0.07, stem: 0.38 },
  planks: { gap: 0.04 }, // top of the planks above the ground: each one follows the snow under it
};

/**
 * Keeps `p` (x, z) on the meadow side of the rampart, `margin` m from its axis (curtain and slanted sections). Used by
 * the butterfly swarm (Butterfly.js).
 * @returns {boolean} true if `p` had to be moved; `n` then receives the outward normal
 */
const SLANT_LEN = Math.hypot(RAMPART.straightZ - RAMPART.endZ, RAMPART.axisX - RAMPART.endX);
const SLANT_NX = (RAMPART.endZ - RAMPART.straightZ) / SLANT_LEN;
const SLANT_NZ = (RAMPART.axisX - RAMPART.endX) / SLANT_LEN;
export function keepInsideRampart(p, margin, n = null) {
  let hit = false;
  const over = p.x - (RAMPART.axisX - margin);
  if (over > 0) { p.x -= over; hit = true; n?.set(1, 0, 0); }
  const side = p.z < 0 ? -1 : 1;
  const d = (p.x - RAMPART.axisX) * SLANT_NX + (p.z * side - RAMPART.straightZ) * SLANT_NZ + margin;
  if (d > 0) {
    p.x -= d * SLANT_NX;
    p.z -= d * SLANT_NZ * side;
    hit = true;
    n?.set(SLANT_NX, 0, SLANT_NZ * side);
  }
  return hit;
}

const SKIP_MARGIN = 0.15; // m: a stone is kept if its top rises above the ground or water minus this margin

const _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _Y = new THREE.Vector3(0, 1, 0), _X = new THREE.Vector3(1, 0, 0);

/** Ray against oriented boxes { x, z, hx, hz, rotY, y0, y1 }: replaces the `Mesh.raycast` of an occluder. */
function boxesRaycast(boxes) {
  const box = new THREE.Box3(), ray = new THREE.Ray(), hit = new THREE.Vector3();
  return function raycast(raycaster, intersects) {
    const r = raycaster.ray;
    for (const b of boxes) {
      const c = Math.cos(b.rotY), s = Math.sin(b.rotY);
      const dx = r.origin.x - b.x, dz = r.origin.z - b.z;
      ray.origin.set(dx * c - dz * s, r.origin.y, dx * s + dz * c);
      ray.direction.set(r.direction.x * c - r.direction.z * s, r.direction.y, r.direction.x * s + r.direction.z * c);
      box.min.set(-b.hx, b.y0, -b.hz); box.max.set(b.hx, b.y1, b.hz);
      if (ray.intersectBox(box, hit)) intersects.push({ distance: hit.distanceTo(ray.origin), object: this, face: null, point: hit.clone() });
    }
  };
}

function insideBoxes(boxes, p) {
  for (const b of boxes) {
    if (p.y < b.y0 || p.y > b.y1) continue;
    const c = Math.cos(b.rotY), s = Math.sin(b.rotY), dx = p.x - b.x, dz = p.z - b.z;
    if (Math.abs(dx * c - dz * s) <= b.hx && Math.abs(dx * s + dz * c) <= b.hz) return true;
  }
  return false;
}

function smooth(a, b, x) {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
}

export class Rampart {
  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'Rampart';
    this.returnGroup = new THREE.Group();
    this.returnGroup.name = 'BridgeEnd';
    this.state = 'closed';
    this.stones = 0;
    this.onBlockChange = null;
    this.blockList = null; // live list of `world.ruins.obstacles` (World.js), where the gate obstacle lives
    this._t = 0;

    this.obstacles = [];
    this.grassExclusions = [];
    this._occludersFixed = [];
    this._occClosed = [];
    this._occOpen = [];
    this.returnOccluders = [];
    this.returnObstacles = []; // snow-side obstacles, given to `Mountain.addObstacles` (World.js)
    this.meshes = [];

    // Current site of the masonry builders: the meadow first, the snow side next (`buildReturn`).
    // `dx`: x translation; `sill`: sill level; `seed`: seed offset.
    this._wallMat = toonMaterial(0xffffff, { vertexColors: true });
    this._partMat = toonMaterial(0xffffff, { vertexColors: true });
    this._deckMat = toonMaterial(0xffffff, { vertexColors: true }); // separate: the raised bridge fades on its own
    this._site = {
      dx: 0, seed: 0, sill: heightAt(BRIDGE.hingeX, 0), group: this.group, obstacles: this.obstacles,
      occ: this._occludersFixed, grass: this.grassExclusions, moat: true, snow: false, mossK: 1,
      prefix: 'rampart', suffix: '', end: null, coarse: null, wallMat: this._wallMat, partMat: this._partMat,
    };
    // Water level, relative to the sill (ground level at the hinge).
    this.waterY = this.sill + MOAT_LOOK.waterY;

    this._buildWalls();
    this._buildGatehouse();
    this._buildMoat();
    this._buildPortcullis();
    this._buildBridge();
    this._buildChains();
    this._buildBeyond();
    this._setBlock(true);
    this._pose(0);
  }

  /** Sill of the current site (m). */
  get sill() { return this._site.sill; }

  // ---------------------------------------------------------------- masonry

  /** Layer visible at this point: moat bottom or water, whichever is higher. */
  _floor(x, z) {
    const g = visualHeightAt(x, z);
    if (x >= MOAT_LOOK.x0 && x <= MOAT_LOOK.x1 && Math.abs(z) <= MOAT.zEnd) return Math.max(g, this.waterY);
    return g;
  }

  _keep(top, x, z, c, s) {
    // Two points on either side of the stone: it is kept if its top rises above the lower of the two.
    const f = Math.min(this._floor(x + c, z + s), this._floor(x - c, z - s));
    return top > f - SKIP_MARGIN;
  }

  /**
   * Courses of a curtain wall from (ax, az) to (bx, bz), staggered, from `foot` to `top` above the sill.
   * `cut(y)` (optional): half-width to keep free around s = `cutS`.
   */
  _lay(b, rand, ax, az, bx, bz, { foot = RAMPART.foot, top = RAMPART.top, h = RAMPART.courseH, thick = RAMPART.thick, cut = null, cutS = 0, stoneLen = RAMPART.stoneLen } = {}) {
    const dx = bx - ax, dz = bz - az, len = Math.hypot(dx, dz), ux = dx / len, uz = dz / len;
    _q.setFromAxisAngle(_Y, Math.atan2(-dz, dx));
    const quat = _q.clone();
    const nCourses = Math.round((top - foot) / h);
    for (let i = 0; i < nCourses; i++) {
      const y0 = this.sill + foot + i * h, yMid = y0 + h / 2, rel = y0 - this.sill;
      const half = cut ? cut(rel + h / 2, rel, rel + h) : 0;
      let s = (i % 2 ? -0.5 : 0) * stoneLen * (0.9 + 0.2 * rand());
      while (s < len - 0.01) {
        let l = stoneLen * (0.72 + 0.56 * rand());
        if (len - (s + l) < 0.45) l = len - s;
        let a = Math.max(s, 0), e = Math.min(s + l, len);
        s += l;
        if (half > 0) {
          const ca = cutS - half, cb = cutS + half;
          if (a >= ca && e <= cb) continue;
          if (a < ca && e > ca && e <= cb) e = ca;
          else if (a >= ca && a < cb && e > cb) a = cb;
          else if (a < ca && e > cb) {
            // Stone straddling the opening: two pieces, the run continues after it.
            this._place(b, rand, ax, az, ux, uz, a, ca, yMid, h, thick, quat, rel);
            a = cb;
          }
        }
        if (e - a < 0.12) continue;
        this._place(b, rand, ax, az, ux, uz, a, e, yMid, h, thick, quat, rel);
      }
    }
  }

  _place(b, rand, ax, az, ux, uz, a, e, yMid, h, thick, quat, rel) {
    const m = (a + e) / 2, x = ax + ux * m, z = az + uz * m;
    const l2 = (e - a) / 2;
    // Foot width: the ground is checked along the whole stone, face side included.
    const nx = -uz * (thick / 2), nz = ux * (thick / 2);
    if (!this._keep(yMid + h / 2, x + ux * l2, z + uz * l2, nx, nz) && !this._keep(yMid + h / 2, x - ux * l2, z - uz * l2, nx, nz)) return;
    const j = RAMPART.joint;
    _p.set(x, yMid, z);
    const low = rel < 1.44;
    const face = thick / 2 + (rand() - 0.5) * 0.05;
    const moss = mossOf(rand, (low ? RAMPART.mossLow : RAMPART.mossHigh) * this._site.mossK);
    b.stone(l2 - j, h / 2 - j, face, RAMPART.chamfer, _p, quat, stoneColor(rand, low), moss);
    this.stones++;
  }

  /** Colour of the snow on merlons and crowns (snow side only). */
  get _capColor() { return (this.__cap ??= color(SNOW.fresh)); }

  /** Snow on a stone top (snow side): a thin slab in the same frame as the stone. */
  _cap(b, hx, hz, pos, quat) {
    const keep = _p.clone(), t = RETURN_LOOK.snowCap;
    _p.set(keep.x, keep.y + t / 2, keep.z);
    b.stone(hx + 0.02, t / 2, hz + 0.02, t * 0.4, _p, quat, this._capColor);
    _p.copy(keep);
  }

  /** Merlons along (ax, az) -> (bx, bz), resting on `top`. `k`: length scale (big stones). */
  _merlons(b, rand, ax, az, bx, bz, top, thick, k = 1) {
    const { pitch, w, h } = RAMPART.merlon;
    const dx = bx - ax, dz = bz - az, len = Math.hypot(dx, dz), ux = dx / len, uz = dz / len;
    _q.setFromAxisAngle(_Y, Math.atan2(-dz, dx));
    const quat = _q.clone();
    const n = Math.max(1, Math.round(len / (pitch * k)));
    for (let i = 0; i < n; i++) {
      const s = (i + 0.5) * len / n;
      _p.set(ax + ux * s, this.sill + top + h / 2, az + uz * s);
      b.stone(w * k / 2, h / 2 - RAMPART.joint, thick / 2 - 0.05, RAMPART.chamfer, _p, quat, stoneColor(rand), mossOf(rand, 0.25 * this._site.mossK));
      this.stones++;
      if (this._site.snow) { _p.y += h / 2 - RAMPART.joint; this._cap(b, w * k / 2, thick / 2 - 0.05, _p, quat); }
    }
  }

  /** Tower of stone rings, staggered courses, wider crown and merlons on every other block. */
  _tower(b, rand, cx, cz, r, top, n, course, wall) {
    const foot = RAMPART.foot, nC = Math.round((top - foot) / course);
    const width = Math.PI * r / n * 1.07;
    for (let i = 0; i < nC; i++) {
      const y0 = this.sill + foot + i * course;
      const rel = y0 - this.sill, low = rel < 1.44;
      const crown = i === nC - 1 ? 0.14 : 0;
      for (let k = 0; k < n; k++) {
        const a = (k + (i % 2) * 0.5) * 2 * Math.PI / n;
        const ca = Math.cos(a), sa = Math.sin(a);
        const x = cx + (r + crown - wall / 2) * ca, z = cz + (r + crown - wall / 2) * sa;
        if (!this._keep(y0 + course, x, z, 0.3 * ca, 0.3 * sa)) continue;
        _q.setFromAxisAngle(_Y, Math.atan2(ca, sa));
        _p.set(x, y0 + course / 2, z);
        b.stone(width * (1 + crown), course / 2 - RAMPART.joint, wall / 2 + (rand() - 0.5) * 0.04, RAMPART.chamfer, _p, _q, stoneColor(rand, low), mossOf(rand, (low ? RAMPART.mossLow : RAMPART.mossHigh) * this._site.mossK));
        this.stones++;
        if (this._site.snow && i === nC - 1) { _p.y += course / 2 - RAMPART.joint; this._cap(b, width * (1 + crown), wall / 2, _p, _q); }
      }
    }
    // Floor under the merlons: the hollow inside never shows.
    _p.set(cx, this.sill + top - 0.1, cz);
    _q.identity();
    b.stone(r * 0.82, 0.1, r * 0.82, 0.03, _p, _q, color(STONE.shade));
    this.stones++;
    // Merlons: every other block of the crown.
    const my = this.sill + top + RAMPART.merlon.h / 2;
    for (let k = 0; k < n; k += 2) {
      const a = k * 2 * Math.PI / n, ca = Math.cos(a), sa = Math.sin(a);
      _q.setFromAxisAngle(_Y, Math.atan2(ca, sa));
      _p.set(cx + (r + 0.14 - wall / 2) * ca, my, cz + (r + 0.14 - wall / 2) * sa);
      b.stone(width * 0.92, RAMPART.merlon.h / 2 - RAMPART.joint, wall / 2, RAMPART.chamfer, _p, _q, stoneColor(rand), mossOf(rand, 0.25 * this._site.mossK));
      this.stones++;
      if (this._site.snow) { _p.y += RAMPART.merlon.h / 2 - RAMPART.joint; this._cap(b, width * 0.92, wall / 2, _p, _q); }
    }
  }

  /** Creates a masonry mesh, an occluder if it has boxes. */
  _mesh(builder, name, material, boxes = null, parent = this._site.group) {
    const mesh = new THREE.Mesh(builder.geometry(), material);
    mesh.name = name + this._site.suffix;
    mesh.castShadow = mesh.receiveShadow = true;
    mesh.matrixAutoUpdate = false;
    mesh.updateMatrix();
    if (boxes) {
      mesh.raycast = boxesRaycast(boxes);
      mesh.userData.occContains = (p) => insideBoxes(boxes, p);
    }
    parent.add(mesh);
    this.meshes.push(mesh);
    return mesh;
  }

  _obstacle(name, x, z, hx, hz, rotY = 0) {
    const o = {
      name: name.replace('rampart', this._site.prefix), x, z, hx, hz, rotY, top: this.sill + RAMPART.obstacleTop, ground: this.sill,
      height: RAMPART.obstacleTop, climbable: false,
    };
    this._site.obstacles.push(o);
    return o;
  }

  _buildWalls() {
    const S = this._site, R = RAMPART, ax = R.axisX + S.dx, y0 = this.sill + R.foot, y1 = this.sill + R.top + R.merlon.h;
    for (const [side, sign] of [['n', -1], ['s', 1]]) {
      // Straight part: from the gate tower to the junction tower, tower included.
      const rand = rng((sign < 0 ? 9101 : 9203) + S.seed);
      const straight = new Builder();
      const z0 = sign * GATE.houseZ, z1 = sign * R.straightZ;
      this._lay(straight, rand, ax, z0, ax, z1);
      this._merlons(straight, rand, ax, z0 + sign * 1.5, ax, z1 - sign * 1.2, R.top, R.thick);
      const jx = ax - 0.1, jz = z1;
      this._tower(straight, rand, jx, jz, TOWER.r, TOWER.top, TOWER.stones, TOWER.course, TOWER.wall);
      // Plinth on the moat side: big blocks, so water never touches a thin face stone (meadow only).
      for (let z = 2; S.moat && z < MOAT.zEnd - 0.6; z += 1.75) {
        _p.set(33.2, this.sill - 0.1, sign * z);
        _q.identity();
        straight.stone(0.32, 0.55, 0.86, 0.09, _p, _q, stoneColor(rand, true), mossOf(rand, 0.7));
        this.stones++;
      }
      const hzS = (R.straightZ - GATE.houseZ) / 2, czS = sign * (R.straightZ + GATE.houseZ) / 2;
      const boxesS = [
        { x: ax, z: czS, hx: R.thick / 2, hz: hzS, rotY: 0, y0, y1 },
        { x: jx, z: jz, hx: TOWER.r, hz: TOWER.r, rotY: 0, y0, y1: this.sill + TOWER.top + R.merlon.h },
      ];
      const mS = this._mesh(straight, `curtain_wall_${side}`, S.wallMat, boxesS);
      S.occ.push(mS);
      this._obstacle(`rampart_wall_${side}`, ax, sign * (GATE.half + R.straightZ) / 2, R.thick / 2, (R.straightZ - GATE.half) / 2);
      this._obstacle(`rampart_tower_${side}`, jx, jz, TOWER.r, TOWER.r);

      // Slanted section, end tower included. Snow side: longer, with big distant stones (`RETURN_LOOK.coarse`);
      // the meadow keeps it in a single run.
      const obl = new Builder();
      const ex = S.end ? S.end.x : R.endX + S.dx, ez = sign * (S.end ? S.end.z : R.endZ);
      if (S.coarse) {
        const C = S.coarse, L = Math.hypot(ex - jx, ez - jz), k = Math.min(C.from / L, 1);
        const mx = jx + (ex - jx) * k, mz = jz + (ez - jz) * k;
        this._lay(obl, rand, jx, jz, mx, mz);
        this._lay(obl, rand, mx, mz, ex, ez, { h: C.course, stoneLen: C.stoneLen });
        this._merlons(obl, rand, jx + (mx - jx) * 0.05, jz + (mz - jz) * 0.05, mx, mz, R.top, R.thick);
        this._merlons(obl, rand, mx, mz, ex + (jx - ex) * 0.05, ez + (jz - ez) * 0.05, R.top, R.thick, C.merlon);
      } else {
        this._lay(obl, rand, jx, jz, ex, ez);
        this._merlons(obl, rand, jx + (ex - jx) * 0.05, jz + (ez - jz) * 0.05, ex + (jx - ex) * 0.05, ez + (jz - ez) * 0.05, R.top, R.thick);
      }
      this._tower(obl, rand, ex, ez, TOWER.r, TOWER.top, TOWER.stones, TOWER.course, TOWER.wall);
      const dx = ex - jx, dz = ez - jz, len = Math.hypot(dx, dz), rot = Math.atan2(-dz, dx);
      const boxesO = [
        { x: (jx + ex) / 2, z: (jz + ez) / 2, hx: len / 2, hz: R.thick / 2, rotY: rot, y0, y1 },
        { x: ex, z: ez, hx: TOWER.r, hz: TOWER.r, rotY: 0, y0, y1: this.sill + TOWER.top + R.merlon.h },
      ];
      const mO = this._mesh(obl, `oblique_wall_${side}`, S.wallMat, boxesO);
      S.occ.push(mO);
      this._obstacle(`rampart_oblique_wall_${side}`, (jx + ex) / 2, (jz + ez) / 2, len / 2, R.thick / 2, rot);
      this._obstacle(`rampart_end_tower_${side}`, ex, ez, TOWER.r, TOWER.r);

      // No grass or flowers at the foot (0.4 m margin): meadow only.
      S.grass?.push(
        { x: ax, z: sign * (GATE.houseZ + R.straightZ) / 2 + sign * 1, hx: R.thick / 2 + 0.4, hz: (R.straightZ - GATE.houseZ) / 2 + 1, rotY: 0 },
        { x: jx, z: jz, r: TOWER.r + 0.4 },
        { x: (jx + ex) / 2, z: (jz + ez) / 2, hx: len / 2 + 0.4, hz: R.thick / 2 + 0.4, rotY: rot },
        { x: ex, z: ez, r: TOWER.r + 0.4 },
      );
    }
  }

  _buildGatehouse() {
    const S = this._site, dx = S.dx, b = new Builder(), rand = rng(9305 + S.seed), R = RAMPART, G = GATE;
    const ax = R.axisX + dx, z0 = -G.houseZ, z1 = G.houseZ, outer = G.half + G.ring;
    // Body: courses cut around the arch, on both sides of the passage.
    const cut = (mid, lo, hi) => {
      if (hi <= 0.02) return 0; // below the sill: solid
      if (lo >= G.spring + outer) return 0;
      if (mid <= G.spring) return G.half;
      return Math.max(Math.sqrt(Math.max(outer * outer - (mid - G.spring) ** 2, 0)), 0.01);
    };
    this._lay(b, rand, ax, z0, ax, z1, { top: G.houseTop, cut, cutS: G.houseZ });
    // Voussoirs: a ring through the whole thickness, slightly projecting.
    const nV = 13, rMid = G.half + G.ring / 2;
    for (let i = 0; i < nV; i++) {
      const a = (i + 0.5) * Math.PI / nV, ca = Math.cos(a), sa = Math.sin(a);
      _q.setFromAxisAngle(_X, -a + Math.PI / 2);
      _p.set(ax, this.sill + G.spring + rMid * sa, rMid * ca);
      b.stone(R.thick / 2 + 0.03, G.ring / 2, rMid * Math.PI / nV / 2 + 0.005, 0.03, _p, _q, stoneColor(rand, false));
      this.stones++;
    }
    // Passage floor: slabs at sill level.
    const nF = 3, fx0 = BRIDGE.hingeX + dx, fx1 = ax + R.thick / 2 + 0.05;
    _q.identity();
    for (let i = 0; i < nF; i++) {
      const w = (fx1 - fx0) / nF;
      _p.set(fx0 + (i + 0.5) * w, this.sill - 0.13, 0);
      b.stone(w / 2 - 0.01, 0.145, G.half + 0.05, 0.03, _p, _q, stoneColor(rand, true));
      this.stones++;
    }
    // Gatehouse merlons and gate towers.
    this._merlons(b, rand, ax - 0.55, -G.houseZ + 1.6, ax - 0.55, G.houseZ - 1.6, G.houseTop, 0.5);
    for (const sign of [-1, 1]) this._tower(b, rand, G.towerX + dx, sign * G.towerZ, G.towerR, G.towerTop, G.towerStones, G.towerCourse, TOWER.wall);
    // Arrow slits: two dark slits on each tower, at a readable height.
    const slit = color(STONE.joint);
    for (const sign of [-1, 1]) for (const [a, y] of [[Math.PI, 5.2], [Math.PI + sign * -0.6, 7.3]]) {
      const ca = Math.cos(a), sa = sign * Math.abs(Math.sin(a));
      _q.setFromAxisAngle(_Y, Math.atan2(ca, sa));
      _p.set(G.towerX + dx + (G.towerR + 0.008) * ca, this.sill + y, sign * G.towerZ + (G.towerR + 0.008) * sa);
      b.stone(0.07, 0.42, 0.03, 0.01, _p, _q, slit);
      this.stones++;
    }
    // Chain holes and fittings, above the arch.
    const iron = color(PORTCULLIS.iron);
    _q.identity();
    for (const sign of [-1, 1]) {
      _p.set(CHAIN.x + dx + 0.12, this.sill + CHAIN.y + 0.02, sign * CHAIN.z);
      b.stone(0.05, 0.1, 0.1, 0.02, _p, _q, iron);
      this.stones++;
    }

    const y0 = this.sill + R.foot, top = this.sill + G.houseTop + R.merlon.h, ty = this.sill + G.towerTop + R.merlon.h;
    const boxes = [
      { x: ax, z: -(G.half + G.houseZ) / 2, hx: R.thick / 2, hz: (G.houseZ - G.half) / 2, rotY: 0, y0, y1: top },
      { x: ax, z: (G.half + G.houseZ) / 2, hx: R.thick / 2, hz: (G.houseZ - G.half) / 2, rotY: 0, y0, y1: top },
      { x: ax, z: 0, hx: R.thick / 2, hz: G.half, rotY: 0, y0: this.sill + G.spring + G.half * 0.7, y1: top },
      { x: G.towerX + dx, z: -G.towerZ, hx: G.towerR, hz: G.towerR, rotY: 0, y0, y1: ty },
      { x: G.towerX + dx, z: G.towerZ, hx: G.towerR, hz: G.towerR, rotY: 0, y0, y1: ty },
    ];
    S.occ.push(this._mesh(b, 'gatehouse', S.wallMat, boxes));

    // Gate towers: collision and grass boxes. The wall on each side starts at |z| = half.
    for (const [side, sign] of [['n', -1], ['s', 1]]) {
      this._obstacle(`rampart_gate_tower_${side}`, G.towerX + dx, sign * G.towerZ, G.towerR, G.towerR);
    }
    // Back of the passage: the cat never comes out behind the rampart (the fade has already taken it). Snow side: the
    // back is on the bridge side, at the other end of the passage.
    this._obstacle('rampart_back', ax + (S.snow ? -1 : 1) * (R.thick / 2 + 0.25), 0, 0.25, G.half + 0.2);
    S.grass?.push({ x: 34.2, z: 0, hx: 2.6, hz: 5.6, rotY: 0 });
  }

  _buildMoat() {
    const b = new Builder(), rand = rng(9407), L = MOAT_LOOK, S = this.sill;
    _q.identity();
    // Water: one slab, with a few light reflections.
    const wx = (L.x0 + L.x1) / 2, whx = (L.x1 - L.x0) / 2;
    _p.set(wx, this.waterY - 0.04, 0);
    b.stone(whx, 0.04, MOAT.zEnd + 0.05, 0.01, _p, _q, color(L.water));
    const lightC = color(L.waterLight);
    for (let i = 0; i < 16; i++) {
      const z = (rand() * 2 - 1) * (MOAT.zEnd - 1);
      _p.set(L.x0 + 0.25 + rand() * (L.x1 - L.x0 - 0.9), this.waterY + 0.002, z);
      b.stone(0.05 + rand() * 0.05, 0.002, 0.3 + rand() * 0.5, 0.001, _p, _q, lightC);
    }
    this.stones += 17;
    // Curb on the meadow side: low, it hides the ramp and the water's edge.
    for (const sign of [-1, 1]) {
      let z = 1.05;
      while (z < MOAT.zEnd + 0.2) {
        const l = 0.8 + rand() * 0.45;
        const cz = z + l / 2, cx = L.curbX;
        _p.set(cx + (rand() - 0.5) * 0.05, heightAt(cx - 0.35, sign * cz) + L.curbHy - 0.1, sign * cz);
        _q.setFromAxisAngle(_Y, (rand() - 0.5) * 0.05);
        b.stone(L.curbHx, L.curbHy, l / 2 - 0.012, 0.05, _p, _q, stoneColor(rand, true), mossOf(rand, 0.35));
        this.stones++;
        z += l;
      }
      // Closure at the end: the moat butts against the tower.
      for (let i = 0; i < 3; i++) {
        const x = 31.0 + i * 0.85;
        _p.set(x, heightAt(x, sign * (MOAT.zEnd + 0.45)) + L.curbHy - 0.1, sign * (MOAT.zEnd - 0.05));
        _q.setFromAxisAngle(_Y, (rand() - 0.5) * 0.05);
        b.stone(0.415, L.curbHy, 0.38, 0.05, _p, _q, stoneColor(rand, true), mossOf(rand, 0.35));
        this.stones++;
      }
      // Bridgehead post on each side of the roadway.
      _q.identity();
      _p.set(30.42, heightAt(30.2, sign * 1.05) + 0.3, sign * 1.14);
      b.stone(0.16, 0.42, 0.16, 0.05, _p, _q, stoneColor(rand, true), mossOf(rand, 0.4));
      this.stones++;
    }
    this._mesh(b, 'moat', this._partMat);
    this.moat = this.meshes[this.meshes.length - 1];

    // Obstacles: moat in two halves, from the curb to the wall; bridge lane closed while the gate is.
    const x0 = 30.25, x1 = 33.3, hx = (x1 - x0) / 2, cx = (x0 + x1) / 2;
    const zOut = MOAT.zEnd + 0.4, zIn = BRIDGE.halfW;
    for (const [side, sign] of [['n', -1], ['s', 1]]) {
      this._obstacle(`rampart_moat_${side}`, cx, sign * (zIn + zOut) / 2, hx, (zOut - zIn) / 2);
    }
    this._gateBlock = {
      name: 'rampart_closed', x: (x0 + 35) / 2, z: 0, hx: (35 - x0) / 2, hz: 1.05, rotY: 0,
      top: S + RAMPART.obstacleTop, ground: S, height: RAMPART.obstacleTop, climbable: false,
    };
    this.grassExclusions.push({ x: 31.9, z: 0, hx: 2.05, hz: MOAT.zEnd + 0.8, rotY: 0 });
  }

  _buildPortcullis() {
    const b = new Builder(), rand = rng(9509), P = PORTCULLIS;
    const iron = () => jitter(P.iron, 0.03, rand), rail = () => jitter(P.ironLight, 0.03, rand);
    _q.identity();
    const nBars = Math.round(2 * P.halfW / P.barPitch);
    for (let i = 0; i <= nBars; i++) {
      const z = -P.halfW + i * 2 * P.halfW / nBars;
      _p.set(0, P.h / 2, z);
      b.stone(P.bar, P.h / 2, P.bar, 0.012, _p, _q, iron());
      // Spike at the bottom: a diamond-shaped cube.
      _p.set(0, -0.03, z);
      const tip = new THREE.Quaternion().setFromAxisAngle(_X, Math.PI / 4);
      b.stone(P.bar * 1.15, 0.075, 0.075, 0.012, _p, tip, iron());
    }
    const nRails = Math.round(P.h / P.railPitch);
    for (let j = 1; j <= nRails; j++) {
      _p.set(0.012, j * P.h / nRails, 0);
      b.stone(P.bar * 0.9, P.bar * 1.1, P.halfW + 0.02, 0.012, _p, _q, rail());
    }
    this.portcullis = this._mesh(b, 'portcullis', this._partMat);
    this.portcullis.frustumCulled = true;
  }

  _buildBridge() {
    const b = new Builder(), rand = rng(9611), B = BRIDGE, L = B.length;
    const wood = (k) => jitter(k === 2 ? B.wood.dark : k ? B.wood.light : B.wood.base, 0.03, rand);
    _q.identity();
    // Planks across, top at y = 0; underside visible when raised: stringers and fittings.
    const n = Math.round(L / B.plank), w = L / n;
    for (let i = 0; i < n; i++) {
      _p.set(-(i + 0.5) * w, -0.04, 0);
      b.stone(w / 2 - 0.008, 0.04, B.halfW, 0.012, _p, _q, wood(rand() < 0.3 ? 1 : 0));
    }
    for (const z of [-0.62, 0.62]) {
      _p.set(-L / 2, -0.13, z);
      b.stone(L / 2 - 0.02, 0.055, 0.08, 0.015, _p, _q, wood(2));
    }
    for (const x of [-0.45, -L / 2, -L + 0.4]) {
      _p.set(x, -0.1, 0);
      b.stone(0.07, 0.03, B.halfW - 0.03, 0.012, _p, _q, wood(2));
    }
    // Low edges and end fittings (portcullis iron).
    for (const z of [-B.halfW + 0.045, B.halfW - 0.045]) {
      _p.set(-L / 2, 0.025, z);
      b.stone(L / 2 - 0.02, 0.028, 0.04, 0.012, _p, _q, wood(2));
      _p.set(-L + CHAIN.attach, 0.02, Math.sign(z) * CHAIN.z);
      b.stone(0.06, 0.05, 0.07, 0.015, _p, _q, color(PORTCULLIS.iron));
    }
    this.deck = this._mesh(b, 'bridge', this._deckMat);
    this.deck.position.set(B.hingeX, this.sill + 0.015, 0);
    this.deck.updateMatrix();
    // Box for fading, only when raised: the bridge only hides the cat in front of the portcullis.
    const y0 = this.sill, y1 = this.sill + L + 0.1;
    const boxes = [{ x: B.hingeX - 0.1, z: 0, hx: 0.24, hz: B.halfW, rotY: 0, y0, y1 }];
    this.deck.raycast = boxesRaycast(boxes);
    this.deck.userData.occContains = (p) => insideBoxes(boxes, p);
    this._occClosed = [...this._occludersFixed, this.deck];
    this._occOpen = [...this._occludersFixed];
  }

  _buildChains() {
    const b = new Builder(), C = CHAIN;
    const dark = color(PORTCULLIS.iron), light = color(PORTCULLIS.ironLight);
    const q0 = new THREE.Quaternion(), q1 = new THREE.Quaternion().setFromAxisAngle(_Y, Math.PI / 2);
    for (let i = 0; i < C.links; i++) {
      const y = -C.pitch * (i + 0.5);
      for (const sign of [-1, 1]) {
        _p.set(0, y, sign * C.z);
        b.stone(0.016, C.pitch * 0.62, 0.042, 0.01, _p, i % 2 ? q1 : q0, i % 2 ? light : dark);
      }
    }
    this.chains = this._mesh(b, 'chains', this._partMat);
    this.chains.castShadow = false; // the shadow of thin links adds nothing, and it costs nothing this way
    this.chains.position.set(C.x, this.sill + C.y, 0);
    this.chains.frustumCulled = false; // the box varies with the bridge and is never recomputed
    this._chainIndex = 2 * 44 * 3; // indices per link (two strands)
  }

  // ---------------------------------------------------------------- snow glimpsed from the meadow

  /**
   * Painted snow sheet behind the rampart, in the meadow group (`BEYOND`), seen through the open gate. Nothing is
   * clickable (no obstacle, no picking) and the real zone 2 is not in the scene. Two meshes: the sheet and the decoration
   * (pines and stones of snowLook.js).
   */
  _buildBeyond() {
    const B = BEYOND, R = RAMPART, rand = rng(9811), GL = SnowLook.GROUND_LOOK;
    const jx = R.axisX - 0.1, jz = R.straightZ, wall = R.thick / 2;
    // Outer face of the rampart at position z: the curtain face, then the slanted section (offset by the half-thickness
    // along its normal, so by wall / SLANT_NX in x).
    const wallX = (z) => {
      const a = Math.abs(z);
      // Under the paving edge (34.95), so no strip of green ground shows between the two; on each side of the gate the
      // sheet starts under the curtain, otherwise a green line shows at the foot of the piers.
      if (a <= jz) return R.axisX + wall - (a >= GATE.half ? 0.3 : 0.1);
      const k = Math.min((a - jz) / (R.endZ - jz), 1);
      return jx + (R.endX - jx) * k + wall / SLANT_NX + 0.05;
    };
    const half = [];
    for (let z = 0, k = 0; z < B.zMax - 1e-6;) { while (z >= B.rows[k][0] - 1e-6) k++; z = Math.min(z + B.rows[k][1], B.zMax); half.push(z); }
    const zs = [...half.map((z) => -z).reverse(), 0, ...half];
    const fresh = color(SNOW.fresh), shade = color(SNOW.shade ?? SNOW.fresh), ground = color(GROUND.edge), tmp = new THREE.Color();
    const lift = GL.lift * B.bright, shadeK = GL.shade;
    const nz = zs.length - 1, nx = B.cols, pos = [], col = [], idx = [];
    for (let j = 0; j <= nz; j++) {
      const z = zs[j], x0 = wallX(z);
      // Against the rampart: flush with the paving in front of the gate, higher on the sides (the coarser ground mesh shows through).
      const near = B.liftNear + (B.liftSide - B.liftNear) * smooth(GATE.half + 0.1, GATE.half + 1.1, Math.abs(z));
      for (let i = 0; i <= nx; i++) {
        const x = x0 + (B.x1 - x0) * Math.pow(i / nx, B.colPow);
        // First column sunk below the ground: otherwise the edge of the sheet floats and, seen at paving level, shows a green line.
        pos.push(x, visualHeightAt(x, z) + (i === 0 ? -B.skirt : near + (B.lift - near) * smooth(x0, x0 + 2.5, x) + (B.liftFar - B.lift) * smooth(B.liftFarFrom, B.liftFarTo, x)), z);
        // Same shade-patch formula as the ground of zone 2 (snowLook.js `snowGeometry`), edge faded to the ground.
        const n = Math.sin(0.11 * x + 0.7) * Math.sin(0.13 * z + 1.9) + 0.5 * Math.sin(0.31 * x - 0.23 * z);
        tmp.copy(fresh).lerp(shade, shadeK * smooth(0.1, 0.9, -n)).multiplyScalar(lift);
        const t = smooth(0, B.edge, Math.min(B.zMax - Math.abs(z), B.x1 - x));
        tmp.lerp(ground, 1 - t);
        col.push(tmp.r, tmp.g, tmp.b);
      }
    }
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const a = j * (nx + 1) + i, b = a + 1, c = a + nx + 1, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
    const g = new THREE.BufferGeometry();
    g.setIndex(idx);
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.computeVertexNormals();
    const patch = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }));
    patch.name = 'Snow_beyond';
    patch.receiveShadow = true;
    patch.matrixAutoUpdate = false;
    patch.updateMatrix();
    this.group.add(patch);

    // Decoration: the pines and stones of zone 2 itself (snowLook.js `addPine`, `addRock`), merged into one mesh.
    // Same item shape as `placed` in Mountain.js.
    const ch = SnowLook.newChunk(), flat = SnowLook.LOOK.rock.flat, bury = SnowLook.LOOK.rock.bury;
    const lerp = (r, t) => r[0] + (r[1] - r[0]) * t, placed = [];
    const pine = (x, z, h, Rr, clear) => { SnowLook.addPine(ch, { x, z, a: rand() * Math.PI * 2, R: Rr, h, ground: visualHeightAt(x, z), clear }); placed.push([x, z]); };
    const rock = (x, z, r, clear) => {
      const f = lerp(flat, rand()), g0 = visualHeightAt(x, z);
      SnowLook.addRock(ch, { x, z, a: rand() * Math.PI * 2, r, flat: f, y: g0 + r * f * bury, ground: g0, clear });
      placed.push([x, z]);
    };
    for (const [x, z, h, Rr] of B.pines) pine(x, z, h, Rr, 0);
    for (const [x, z, r] of B.rocks) rock(x, z, r, 0);
    const S = B.scatter;
    for (let n = 0, tries = 0; n < S.pines + S.rocks && tries < 400; tries++) {
      const x = lerp(S.x, rand()), w = Math.min(S.z0 + S.spread * (x - R.axisX), S.zCap), z = (rand() * 2 - 1) * w;
      if (placed.some(([px, pz]) => Math.hypot(px - x, pz - z) < S.gap)) continue;
      if (n < S.pines) pine(x, z, lerp(S.h, rand()), lerp(S.R, rand()), x > S.far ? 30 : 0);
      else rock(x, z, lerp(S.r, rand()), x > S.far ? 30 : 0);
      n++;
    }
    const decor = SnowLook.chunkMesh(ch, toonMaterial(0xffffff, { vertexColors: true }), 'Scenery_beyond');
    this.group.add(decor);
    // No grass on the sheet: strip behind the gate, then a rectangle along the outer face of each section.
    const G = B.grass, gx0 = R.axisX + wall;
    this.grassExclusions.push({ x: (gx0 + G.x1) / 2, z: 0, hx: (G.x1 - gx0) / 2, hz: G.doorHz, rotY: 0 });
    const len = Math.hypot(R.endX - jx, R.endZ - jz), rot = Math.atan2(-(R.endZ - jz), R.endX - jx);
    for (const sign of [-1, 1]) {
      const mx = (jx + R.endX) / 2, mz = sign * (jz + R.endZ) / 2, off = wall + G.flankHz;
      this.grassExclusions.push({ x: mx + SLANT_NX * off, z: mz + sign * SLANT_NZ * off, hx: len / 2, hz: G.flankHz, rotY: sign > 0 ? rot : -rot });
    }
  }

  // ---------------------------------------------------------------- snow side (zone 2)

  /**
   * Snow side of the rampart, built once on the first crossing (`World.enterMountain`) in `returnGroup`: same builders as
   * the meadow (`_buildWalls`, `_buildGatehouse`) translated by `dx`, then raised portcullis, planks of the lowered bridge
   * and painted meadow seen through the gate. Obstacles go to `returnObstacles`, occluders to `returnOccluders`; these
   * stones are not counted in `stones`.
   */
  buildReturn() {
    if (this._returnBuilt) return;
    this._returnBuilt = true;
    const R = RETURN_LOOK, X = ZONE2.x, dx = X + R.axis - RAMPART.axisX, before = this.stones, prev = this._site;
    this._site = {
      dx, seed: R.seed, sill: heightAt(BRIDGE.hingeX + dx, 0), group: this.returnGroup, obstacles: this.returnObstacles,
      occ: this.returnOccluders, grass: null, moat: false, snow: true, mossK: R.mossK,
      prefix: 'rampart_z2', suffix: '_z2', end: { x: X + R.end.x, z: R.end.z }, coarse: R.coarse,
      wallMat: toonMaterial(0xffffff, { vertexColors: true }), partMat: toonMaterial(0xffffff, { vertexColors: true }),
    };
    try {
      this._buildWalls();
      this._buildGatehouse();
      this._buildReturnPortcullis();
      this._buildReturnPlanks();
      this._buildReturnMeadow();
    } finally {
      this.stones = before;
      this._site = prev;
    }
  }

  /** Raised portcullis, under the vault (geometry shared with the meadow). */
  _buildReturnPortcullis() {
    const S = this._site, m = new THREE.Mesh(this.portcullis.geometry, S.partMat);
    m.name = 'portcullis_z2';
    m.castShadow = m.receiveShadow = true;
    m.position.set(PORTCULLIS.x + S.dx, this.sill + PORTCULLIS.lift, 0);
    m.matrixAutoUpdate = false;
    m.updateMatrix();
    S.group.add(m);
  }

  /** Planks of the lowered bridge, outside the passage: each follows the snow under it (highest of three points). */
  _buildReturnPlanks() {
    const S = this._site, B = BRIDGE, F = FAKE_MEADOW, b = new Builder(), rand = rng(9611 + S.seed);
    const D = SnowLook.DRIFT;
    const h = (x, z) => mountainHeight(x, z) + F.drift * D.amp * smooth(D.start, D.full, pathClearance(x, z));
    _q.identity();
    const n = Math.round(B.length / B.plank), w = B.length / n;
    for (let i = 0; i < n; i++) {
      const x = B.hingeX + S.dx - (i + 0.5) * w;
      const y = Math.max(h(x, -B.halfW * 0.8), h(x, 0), h(x, B.halfW * 0.8)) + F.lift + 0.05;
      _p.set(x, y, 0);
      b.stone(w / 2 - 0.008, 0.04, B.halfW, 0.012, _p, _q, jitter(rand() < 0.3 ? B.wood.light : B.wood.base, 0.03, rand));
    }
    this._mesh(b, 'bridge', S.wallMat);
  }

  /**
   * Painted meadow behind the rampart (seen through the gate, or over it if the camera rises): a green carpet on the snow,
   * stopping against the -X face of the rampart and its sections, with grass tufts and small flowers in the funnel of the
   * gate. No animated blade: fixed geometry, two meshes.
   */
  _buildReturnMeadow() {
    const S = this._site, F = FAKE_MEADOW, R = RETURN_LOOK, X = ZONE2.x, rand = rng(9919);
    const ax = RAMPART.axisX + S.dx, jx = ax - 0.1, jz = RAMPART.straightZ;
    const ex = X + R.end.x, ez = R.end.z;
    // Carpet edge on the rampart side, by |z|: against the -X face (curtain), then along the slanted section.
    const limit = (z) => {
      const a = Math.abs(z);
      if (a <= jz) return ax - RAMPART.thick / 2 - 0.1;
      const k = Math.min((a - jz) / (ez - jz), 1);
      return jx + (ex - jx) * k - RAMPART.thick / 2 - 0.5;
    };
    const ground = color(GROUND.center), edge = color(GROUND.edge), snow = color(SNOW.fresh), tmp = new THREE.Color();
    const half = [];
    for (let z = 0, k = 0; z < F.zMax - 1e-6;) { while (z >= F.rows[k][0] - 1e-6) k++; z = Math.min(z + F.rows[k][1], F.zMax); half.push(z); }
    const zs = [...half.map((z) => -z).reverse(), 0, ...half]; // rows from -zMax to +zMax, in increasing order
    const nz = zs.length - 1, nx = F.cols;
    const pos = [], col = [], idx = [];
    const D = SnowLook.DRIFT;
    const heightOf = (x, z) => {
      const far = smooth(X + F.liftFarFrom, X + F.liftFarTo, x);
      // Ground drifts (snowLook.js): at most `amp` times their shape, zero in the path, full at `full` m.
      const drift = F.drift * D.amp * smooth(D.start, D.full, pathClearance(x, z));
      return mountainHeight(x, z) + F.lift + drift + (F.liftFar - F.lift) * far;
    };
    for (let j = 0; j <= nz; j++) {
      const z = zs[j], x1 = limit(z), x0 = X + F.x0;
      for (let i = 0; i <= nx; i++) {
        const x = x1 - (x1 - x0) * Math.pow(i / nx, F.colPow); // i = 0 against the rampart

        pos.push(x, heightOf(x, z), z);
        // Meadow green (clearing near the gate, deeper ground far away), edge faded to snow.
        const dist = Math.hypot(ax - x, z);
        tmp.copy(ground).lerp(edge, smooth(2, 40, dist));
        tmp.multiplyScalar(0.95 + 0.07 * Math.sin(0.23 * x + 0.7) * Math.sin(0.19 * z + 1.9));
        const border = Math.min(x - x0, F.zMax - Math.abs(z));
        tmp.lerp(snow, 1 - smooth(0, F.edge, border));
        col.push(tmp.r, tmp.g, tmp.b);
      }
    }
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const a = j * (nx + 1) + i, b = a + 1, c = a + nx + 1, d = c + 1;
      idx.push(a, b, c, b, d, c); // the columns run toward -X: winding reversed to keep the face up
    }
    const g = new THREE.BufferGeometry();
    g.setIndex(idx);
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.computeVertexNormals();
    const carpet = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true }));
    carpet.name = 'Painted_meadow';
    carpet.receiveShadow = true;
    carpet.matrixAutoUpdate = false;
    carpet.updateMatrix();
    S.group.add(carpet);

    // Tufts and flowers: triangles with a vertical normal, meadow colours.
    const T = F.tufts, Fl = F.flowers, tb = [], tc = [], ti = [];
    const planksEnd = BRIDGE.hingeX + S.dx - BRIDGE.length;
    const blade = (x, y, z, ang, h, w, lean, c0, c1) => {
      const s = Math.sin(ang), c = Math.cos(ang), v = tb.length / 3;
      tb.push(x - s * w, y, z + c * w, x + s * w, y, z - c * w, x + c * lean, y + h, z + s * lean);
      tc.push(c0.r, c0.g, c0.b, c0.r, c0.g, c0.b, c1.r, c1.g, c1.b);
      ti.push(v, v + 1, v + 2, v, v + 2, v + 1); // both windings: single-sided material, vertical normal on both sides
    };
    const mid = color(GRASS.mid), base = color(GRASS.base).lerp(mid, 0.45), tip = color(GRASS.tip);
    for (let n = 0; n < T.count; n++) {
      const d = T.len * Math.pow(rand(), 1.25) - 2.6; // d < 0: on either side of the planks
      const half = Math.min(T.half0 + T.spread * Math.max(d, 0), T.zCap);
      const x = planksEnd - d, z = (rand() * 2 - 1) * half;
      if (d < 0 && Math.abs(z) < BRIDGE.halfW + 0.2) continue;
      const y = heightOf(x, z) - 0.03, hh = T.h[0] + (T.h[1] - T.h[0]) * rand();
      const t1 = tip.clone().lerp(mid, rand() * 0.6), a0 = rand() * Math.PI;
      for (let k = 0; k < T.blades; k++) blade(x + (rand() - 0.5) * 0.1, y, z + (rand() - 0.5) * 0.1, a0 + k * Math.PI / T.blades, hh * (0.75 + 0.5 * rand()), T.w, (rand() - 0.5) * 2 * T.lean, base, t1);
    }
    const petals = [FLOWERS.daisyPetal, FLOWERS.poppy, FLOWERS.cornflower], hearts = [FLOWERS.daisyHeart, FLOWERS.poppyHeart, FLOWERS.cornflowerBud];
    for (let n = 0; n < Fl.count; n++) {
      const d = 2 + (T.len - 6) * rand(), half = Math.min(T.half0 + T.spread * d, T.zCap) * 0.9;
      const x = planksEnd - d, z = (rand() * 2 - 1) * half, y = heightOf(x, z) - 0.03, kind = n % 3;
      const stem = color(FLOWERS.stem), head = color(petals[kind]), heart = color(hearts[kind]);
      blade(x, y, z, rand() * Math.PI, Fl.stem, 0.012, 0, stem, stem);
      const hy = y + Fl.stem, v = tb.length / 3;
      for (let k = 0; k < 6; k++) {
        const a = k * Math.PI / 3, a1 = (k + 1) * Math.PI / 3;
        tb.push(x, hy, z, x + Math.cos(a) * Fl.r, hy, z + Math.sin(a) * Fl.r, x + Math.cos(a1) * Fl.r, hy, z + Math.sin(a1) * Fl.r);
        tc.push(heart.r, heart.g, heart.b, head.r, head.g, head.b, head.r, head.g, head.b);
        ti.push(v + 3 * k, v + 3 * k + 2, v + 3 * k + 1, v + 3 * k, v + 3 * k + 1, v + 3 * k + 2);
      }
    }
    const tg = new THREE.BufferGeometry();
    tg.setIndex(ti);
    tg.setAttribute('position', new THREE.Float32BufferAttribute(tb, 3));
    tg.setAttribute('color', new THREE.Float32BufferAttribute(tc, 3));
    tg.setAttribute('normal', new THREE.Float32BufferAttribute(new Array(tb.length).fill(0).map((_, k) => (k % 3 === 1 ? 1 : 0)), 3));
    tg.computeBoundingSphere();
    const tufts = new THREE.Mesh(tg, new THREE.MeshLambertMaterial({ vertexColors: true }));
    tufts.name = 'Painted_tufts';
    tufts.matrixAutoUpdate = false;
    tufts.updateMatrix();
    S.group.add(tufts);
  }

  // ---------------------------------------------------------------- state

  /** Walls and moat that can fade out (World.occluders), plus the raised bridge while it is raised. */
  get occluders() { return this.state === 'closed' ? this._occClosed : this._occOpen; }

  /** For the minimap: water, bridge and portcullis according to the state. */
  get mapInfo() {
    return {
      water: { x0: MOAT_LOOK.x0, x1: 33.3, z0: -MOAT.zEnd, z1: MOAT.zEnd },
      bridge: { x0: BRIDGE.hingeX - BRIDGE.length, x1: 35, half: BRIDGE.halfW },
      portcullisX: PORTCULLIS.x, portcullisHalf: GATE.half,
      open: this.state === 'open',
    };
  }

  /** True when the way is clear: bridge lowered, portcullis raised. */
  get isOpen() { return this.state === 'open'; }

  /** Adds or removes the gate obstacle. */
  _setBlock(on) {
    const list = this.blockList ?? this.obstacles, i = list.indexOf(this._gateBlock);
    if (on && i < 0) list.push(this._gateBlock);
    else if (!on && i >= 0) list.splice(i, 1);
    else return;
    this.onBlockChange?.(on);
  }

  /** Places the bridge, portcullis and chains for a time in seconds since the opening started. */
  _pose(t) {
    const O = OPENING, B = BRIDGE, C = CHAIN;
    const ease = (u) => { u = Math.min(Math.max(u, 0), 1); return u * u * (3 - 2 * u); };
    const a = B.raised * (1 - ease(t / O.bridge));
    this.deck.rotation.z = a;
    this.deck.updateMatrix();
    this.portcullis.position.set(PORTCULLIS.x, this.sill + PORTCULLIS.lift * ease((t - O.portcullisAt) / O.portcullis), 0);
    this.portcullis.updateMatrix();
    // Chain: from the anchor to the end of the deck.
    const r = B.length - C.attach;
    const tx = B.hingeX - r * Math.cos(a), ty = this.sill + 0.015 - r * Math.sin(a);
    const dx = tx - C.x, dy = ty - (this.sill + C.y);
    const len = Math.hypot(dx, dy);
    this.chains.rotation.z = Math.atan2(dx, -dy);
    this.chains.updateMatrix();
    this.chains.geometry.setDrawRange(0, Math.min(Math.ceil(len / C.pitch), C.links) * this._chainIndex);
  }

  /** Closed, without animation (new game, going back). */
  setClosed() {
    this.state = 'closed';
    this._t = 0;
    this._pose(0);
    this._setBlock(true);
  }

  /** Open, without animation (`skipTo`, after the ending). */
  setOpen() {
    this.state = 'open';
    this._t = OPENING.portcullisAt + OPENING.portcullis;
    this._pose(this._t);
    this._setBlock(false);
  }

  /** Starts the opening animation, once. */
  startOpening() {
    if (this.state !== 'closed') return;
    this.state = 'opening';
    this._t = 0;
  }

  /** No work at rest; part of the meadow, never called in zone 2 (resumes on return). */
  update(dt) {
    if (this.state !== 'opening') return;
    this._t += dt;
    const total = OPENING.portcullisAt + OPENING.portcullis;
    if (this._t >= total) { this.setOpen(); return; }
    this._pose(this._t);
  }
}
