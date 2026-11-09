import { CHURCH, WALLS } from '../world/Ruins.js';
import { CLEARING, FOREST_AREA } from '../world/Forest.js';
import { heightAt } from '../world/Terrain.js';
import { ZONE2, SUMMIT, ZONE2_BOUNDS, PATH_SEGMENTS, PATH_DISKS } from '../world/zone2.js';
import { MEADOW_LIMIT } from '../world/field.js';
import { CHAVALANCHE } from '../game/Chavalanche.js';
import { UI_LABELS } from '../game/labels.js';

/**
 * On-screen minimap, created by main.js (Story reads its goal list). No text is drawn.
 *
 * Round top-down view, cat at the centre, visible radius VIEW_RADIUS m. The scenery is baked once into an off-screen
 * canvas (shaded terrain from Terrain.js `heightAt`, meadow, misty rim beyond MEADOW_LIMIT, foothill, forest as dark
 * green circles, stone ruins, zone edge). Zone 2 has a second background, baked the first time it shows (snow, path,
 * rocks, pines) and kept on return. Every frame: one rotated `drawImage`, the cat arrow, the goal marker (on the edge
 * of the disc if out of view), the brass ring.
 *
 * Orientation: the map ROTATES WITH THE CAMERA (top of the map = camera direction projected on the ground). The player
 * clicks on the ground in the camera's view, which turns around the cat, so a goal at the top right of the map is at
 * the top right of the screen with no mental rotation. With a fixed north, the same goal would change side of the
 * screen on each camera turn.
 *
 * Size: 120 px (112 px if the window is ≤ 600 px wide or ≤ 500 px tall, the HUD thresholds), fixed at the top left in
 * the safe area (`--safe-t`, `--safe-l` of index.html).
 *
 * Interface:
 * - `new MiniMap(container = document.body, { world })` (reads `world.forest.trees/bushes` and `world.ruins.obstacles`;
 *   without world, WALLS and an approximated forest).
 * - `setTarget(Vector3 | { x, z } | MINIMAP_GOALS entry | null)`, `setVisible(bool)` (fade).
 * - `update(camera, catPosition, catHeading, dt?)`: catHeading is `cat.root.rotation.y` (rad).
 * - `dispose()`. Read: see `state`.
 */

/** Goals in story order (positions imported from the world modules, in metres). */
export const MINIMAP_GOALS = [
  { id: 'ruins', x: CHURCH.x, z: CHURCH.z, near: CHURCH.length / 2 + 1.5 },  // Ruins.js CHURCH
  { id: 'forest', x: CLEARING.x, z: CLEARING.z, near: CLEARING.r },            // Forest.js CLEARING
  { id: 'maman', x: ZONE2.x + SUMMIT.x, z: SUMMIT.z, near: SUMMIT.r },        // zone2.js SUMMIT: from the meadow, the arrow aims at the gate (`_aim`)
  // Goal after the victory: the Chavalanche seated at the foot (Chavalanche.js, `home`). Added last to keep indices
  // 0 to 2 (Story reads them by index); Story finds it by its `id`. Like Maman he is in zone 2, so from the meadow the
  // arrow aims at the gate.
  { id: 'chavalanche', x: ZONE2.x + CHAVALANCHE.home.x, z: CHAVALANCHE.home.z, near: CHAVALANCHE.approach },
];

export const VIEW_RADIUS = 24;  // m: radius of the world visible in the disc
const BAKE_HALF = 66;           // m: half-side of the baked scenery (40 m zone + 24 m view + margin)
const BAKE_PPM = 4;             // px per metre of the baked scenery (528 px per side)
// Zone 2 background (m, world): path corridor (`ZONE2_BOUNDS`, zone2.js) + 24 m view + a margin of 4 m in x and 10 m
// in z, rounded to integers.
const BAKE_MARGIN = { x: 28, z: 34 };
const MOUNTAIN_BAKE = {
  x0: Math.floor(ZONE2_BOUNDS.x0 - BAKE_MARGIN.x), x1: Math.ceil(ZONE2_BOUNDS.x1 + BAKE_MARGIN.x),
  z0: Math.floor(ZONE2_BOUNDS.z0 - BAKE_MARGIN.z), z1: Math.ceil(ZONE2_BOUNDS.z1 + BAKE_MARGIN.z),
};
const RELIEF_PPM = 1;           // px per metre of the relief grid (enlarged with smoothing)
const SCALE_FRAC = 0.85;      // VIEW_RADIUS fills 85% of the canvas radius (the ring takes 9%)
const NEAR_DEFAULT = 3;
const DPR_MAX = 2;
const CHECK_EVERY = 2;          // s: check of the baked scenery (see `_checkBaked`)
const DEG = 180 / Math.PI;

// Colours (palette.js, sRGB) copied as integers: GROUND, MOUNTAIN, FOG/SKY.horizon, MOSS, STONE, GRASS_KINDS, HUD.
// The drawing part of this module stays free of three.js imports.
const C = {
  groundCenter: [0xb7, 0xd9, 0x7a], groundEdge: [0x93, 0xc0, 0x66], hollow: [0x8d, 0xb9, 0x6a],
  bump: [0xc8, 0xe0, 0x88], mountainNear: [0x8f, 0xae, 0x7e], rock: [0xc2, 0xad, 0x9c], haze: [0xff, 0xe9, 0xcc],
  snow: [0xff, 0xf7, 0xee], snowShade: [0xd8, 0xd4, 0xec], snowPath: '#cdbfc9', snowRock: '#938da3', pine: '#4a7a6b', pineEdge: '#3c6b5e',
  treeDark: '#5f9454', treeLight: '#92c46c', treeEdge: '#4f7f48', bush: '#86a95c',
  water: '#8cc6bd', bridge: '#dcaa6e', portcullis: '#5e4c5a',
  stone: '#f1dcb2', stoneEdge: '#9e8270', limit: 'rgba(255, 248, 236, 0.85)',
  cat: '#2a2320', catEdge: '#fff8ec', target: '#ff9f7a', targetEdge: '#ffffff', text: '#5a4335',
};

// ------------------------------------------------------------------ pure functions (Node tests)

function lerp3(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}
function smooth(a, b, x) {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
}

/**
 * Ground colour seen from above at (x, z): meadow (centre to edge), hollows and bumps, foothill turning to rock, shaded
 * terrain (light from −X −Z, top left with the starting camera), haze beyond MEADOW_LIMIT.
 * @returns {number[]} [r, g, b], 0 to 255.
 */
function groundColor(x, z, h = heightAt) {
  const r = Math.hypot(x, z);
  const y = h(x, z);
  const e = 0.5;
  const gx = (h(x + e, z) - h(x - e, z)) / (2 * e), gz = (h(x, z + e) - h(x, z - e)) / (2 * e);
  let c = lerp3(C.groundCenter, C.groundEdge, smooth(0, MEADOW_LIMIT, r));
  if (r < MEADOW_LIMIT) c = y < 0 ? lerp3(c, C.hollow, Math.min(1, -y / 0.4) * 0.6) : lerp3(c, C.bump, Math.min(1, y / 0.6) * 0.45);
  c = lerp3(c, C.mountainNear, smooth(0.8, 3.5, y) * 0.55);
  c = lerp3(c, C.rock, smooth(3.5, 9, y) * 0.6);
  // Shading: a slope facing the light (−X, −Z normalised) brightens, the opposite side darkens.
  const shade = Math.max(-0.35, Math.min(0.35, (gx + gz) * 0.7071 * 0.9));
  c = c.map((v) => v * (1 - shade));
  c = lerp3(c, C.haze, smooth(MEADOW_LIMIT, MEADOW_LIMIT + 14, r) * 0.55);
  return c.map((v) => Math.max(0, Math.min(255, Math.round(v))));
}

/** Camera forward on the ground, normalised, read from `camera.matrixWorld` (−Z axis; up axis when looking vertically). */
function cameraGroundForward(camera) {
  const m = camera.matrixWorld.elements;
  let x = -m[8], z = -m[10];
  let l = Math.hypot(x, z);
  if (l < 1e-4) { x = m[4]; z = m[6]; l = Math.hypot(x, z); }
  if (l < 1e-9) return { x: 0, z: -1 };
  return { x: x / l, z: z / l };
}

/**
 * World point to map, in metres relative to the cat, x towards the right of the map and y DOWN (like a canvas). `fwd`
 * is the camera forward on the ground: it points to the top of the map. Right = (−fwd.z, fwd.x) (three.js: Y up, base
 * camera towards −Z, right +X).
 */
function worldToMap(fwd, cat, p) {
  const dx = p.x - cat.x, dz = p.z - cat.z;
  return { x: -fwd.z * dx + fwd.x * dz, y: -(fwd.x * dx + fwd.z * dz) };
}

/** Angle (degrees, 0 = up, positive = clockwise) of a map vector {x, y down}. */
function mapAngle(v) {
  return Math.atan2(v.x, -v.y) * DEG;
}

/** Cat heading (rotation.y, direction (sin h, cos h) as in Brain.js) to an angle on the map (degrees). */
function headingOnMap(fwd, heading) {
  return mapAngle(worldToMap(fwd, { x: 0, z: 0 }, { x: Math.sin(heading), z: Math.cos(heading) }));
}

/**
 * Position of the goal marker: `rel` in map metres, `R` radius of the disc in m, `margin` in m.
 * @returns {{x, y, inside}} Outside the disc, the point is brought back to the edge (R − margin) in the same direction.
 */
function clampToDisk(rel, R, margin) {
  const d = Math.hypot(rel.x, rel.y);
  const lim = R - margin;
  if (d <= lim) return { x: rel.x, y: rel.y, inside: true };
  return { x: rel.x / d * lim, y: rel.y / d * lim, inside: false };
}

/** No real forest (without world): approximate circles in FOREST_AREA, fixed random sequence. */
function fallbackTrees() {
  let s = 7;
  const rand = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const A = FOREST_AREA, out = [];
  for (let i = 0; i < 400 && out.length < 40; i++) {
    const x = A.x0 + (A.x1 - A.x0) * rand(), z = A.z0 + (A.z1 - A.z0) * rand(), R = 1.05 + 0.75 * rand();
    if (Math.hypot(x - CLEARING.x, z - CLEARING.z) < CLEARING.r + 1) continue;
    if (out.some((t) => Math.hypot(t.x - x, t.z - z) < 0.8 * (t.R + R))) continue;
    out.push({ x, z, R });
  }
  return out;
}

/** Wall sections of WALLS as boxes { x, z, hx, hz, rotY } (convention of Ruins.js `toWorldBox`). */
function wallBoxes() {
  return WALLS.map((w) => {
    const dx = w.p1[0] - w.p0[0], dz = w.p1[1] - w.p0[1];
    return { x: (w.p0[0] + w.p1[0]) / 2, z: (w.p0[1] + w.p1[1]) / 2, hx: Math.hypot(dx, dz) / 2, hz: w.thick / 2, rotY: Math.atan2(dz, dx) };
  });
}

/**
 * Scenery data: trees { x, z, R }, bushes { x, z, r }, stones (boxes). With `world`: `world.forest.trees`,
 * `world.forest.bushes`, and `world.ruins.obstacles` without those of the forest, NPCs (`npc_`), yarn launchers
 * (`launcher_`) or the moat, closed gate and end-of-passage pieces of the rampart (`rampart_`).
 */
export function mapFeatures(world) {
  const forest = world?.forest;
  let trees = forest?.trees?.length ? forest.trees : fallbackTrees();
  let bushes = forest?.bushes ?? [];
  // Arena: trees and bushes hidden by World.enterArena (invisible `Forest_tree_i` or `Forest_bush_i` mesh) are left
  // off the map; read again by `refresh`.
  const hidden = new Set((forest?.occluders ?? []).filter((m) => !m.visible).map((m) => m.userData.forest));
  if (hidden.size) {
    trees = trees.filter((t, i) => !hidden.has(`tree_${i}`));
    bushes = bushes.filter((b, i) => !hidden.has(`bush_${i}`));
  }
  let stones = wallBoxes();
  const obs = world?.ruins?.obstacles;
  if (obs?.length) {
    const skip = new Set(forest?.obstacles ?? []);
    stones = obs.filter((o) => !skip.has(o) && !/^(npc_|launcher_|rampart_(moat|closed|back))/.test(o.name ?? ''));
  }
  return { trees, bushes, stones, rampart: world?.rampart?.mapInfo ?? null };
}

/** Snow colour seen from above at (x, z): sunny slope light, opposite slope lavender. */
export function snowColor(x, z, h = heightAt) {
  const e = 0.5;
  const gx = (h(x + e, z) - h(x - e, z)) / (2 * e), gz = (h(x, z + e) - h(x, z - e)) / (2 * e);
  const shade = Math.min(Math.max((gx + gz) * 0.7071 * 0.9, -0.35), 0.35);
  return lerp3(C.snow, C.snowShade, smooth(-0.15, 0.3, shade)).map((v) => Math.round(Math.min(Math.max(v, 0), 255)));
}

// ------------------------------------------------------------------ on-screen element

const STYLE_ID = 'lost-minimap-style';
const CSS = `
.lost-minimap {
  --m-size: 120px;
  position: fixed; top: var(--safe-t, 12px); left: var(--safe-l, 12px); z-index: 5;
  width: var(--m-size); height: var(--m-size); border-radius: 50%;
  pointer-events: none; opacity: 0; visibility: hidden;
  transition: opacity 0.35s ease, visibility 0s linear 0.35s;
  filter: drop-shadow(0 4px 8px rgba(150, 100, 60, 0.25));
}
.lost-minimap.on { opacity: 1; visibility: visible; transition: opacity 0.35s ease, visibility 0s; }
.lost-minimap canvas { display: block; width: 100%; height: 100%; }
@media (max-width: 600px), (max-height: 500px) { .lost-minimap { --m-size: 112px; } }
`;

export class MiniMap {
  constructor(container = document.body, { world = null } = {}) {
    if (!document.getElementById(STYLE_ID)) {
      const style = document.createElement('style');
      style.id = STYLE_ID;
      style.textContent = CSS;
      document.head.append(style);
    }
    this.el = document.createElement('div');
    this.el.className = 'lost-minimap';
    this.el.setAttribute('role', 'img');
    this.el.setAttribute('aria-label', UI_LABELS.map);
    this.canvas = document.createElement('canvas');
    this.el.append(this.canvas);
    container.append(this.el);
    this.ctx = this.canvas.getContext('2d');

    this._world = world;
    this.features = mapFeatures(world);
    // The baked scenery is an off-screen 2D canvas: the browser may lose its content (GPU context loss or restore, tab
    // asleep), which leaves an empty cream disc. Counter-measures: rebake on `contextrestored`, on returning to the
    // foreground, and a one-pixel check every CHECK_EVERY s while displayed (`_checkBaked`). `bakeCount` counts the bakes.
    this.bakeCount = 0;
    this._probe = document.createElement('canvas');
    this._probe.width = this._probe.height = 1;
    this._probeCtx = this._probe.getContext('2d', { willReadFrequently: true });
    this._checkT = 0;               // ms (performance.now) of the last check
    this._rebake = () => { this.baked = this._bake(); this._last.x = NaN; };
    this._redraw = () => { this._last.x = NaN; };
    this._onVisibility = () => { if (document.visibilityState === 'visible') this._checkBaked(); };
    this.canvas.addEventListener('contextrestored', this._redraw);
    document.addEventListener('visibilitychange', this._onVisibility);
    this.baked = this._bake();
    // Zone 2 background: baked on the first draw up there, once, and kept on returning to the meadow.
    this.bakedMountain = null;
    this._rebakeMountain = () => { this.bakedMountain = this._bakeMountain(); this._last.x = NaN; };

    this.target = null;
    this.visible = false;
    this._wanted = false;
    this.distance = Infinity;
    this.near = false;
    /** Read access for checks. Angles in degrees, 0 = up, positive = clockwise. */
    this.state = {
      size: 0, viewRadius: VIEW_RADIUS, mapUp: 0, catHeadingOnMap: 0,
      targetBearing: null, targetOnMap: null, targetInside: null, distance: null, near: false, visible: false,
    };
    this._px = 0;
    // Last drawing. Resetting `x` to NaN forces the next draw (NaN never compares equal), even without a target: `t` is
    // then null before and after, so it could not serve as the marker.
    this._last = { x: NaN, z: NaN, fx: NaN, fz: NaN, h: NaN, t: null };
    this._time = 0;
    this._heading = 0;
  }

  /** Scenery baked in world coordinates: pixel (i, j) ↔ (−BAKE_HALF + i / BAKE_PPM, −BAKE_HALF + j / BAKE_PPM). */
  _bake() {
    const n = Math.round(2 * BAKE_HALF * RELIEF_PPM) + 1;
    const relief = document.createElement('canvas');
    relief.width = relief.height = n;
    const rc = relief.getContext('2d');
    const img = rc.createImageData(n, n);
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const [r, g, b] = groundColor(-BAKE_HALF + i / RELIEF_PPM, -BAKE_HALF + j / RELIEF_PPM);
        const k = (j * n + i) * 4;
        img.data[k] = r; img.data[k + 1] = g; img.data[k + 2] = b; img.data[k + 3] = 255;
      }
    }
    rc.putImageData(img, 0, 0);

    const size = Math.round(2 * BAKE_HALF * BAKE_PPM);
    const out = document.createElement('canvas');
    out.width = out.height = size;
    out.addEventListener('contextrestored', this._rebake); // content reset to blank by the browser
    this.bakeCount++;
    const c = out.getContext('2d');
    c.imageSmoothingEnabled = true;
    // Relief: texel i is centred on world −BAKE_HALF + i, hence the half-texel offset.
    const s = BAKE_PPM / RELIEF_PPM;
    c.drawImage(relief, -s / 2, -s / 2, n * s, n * s);
    c.setTransform(BAKE_PPM, 0, 0, BAKE_PPM, BAKE_HALF * BAKE_PPM, BAKE_HALF * BAKE_PPM); // world metres

    // Forest clearing: light meadow.
    c.fillStyle = 'rgba(200, 224, 136, 0.55)';
    c.beginPath(); c.arc(CLEARING.x, CLEARING.z, CLEARING.r, 0, Math.PI * 2); c.fill();

    // Zone edge (40 m): dashed cream line.
    c.strokeStyle = C.limit; c.lineWidth = 0.55; c.setLineDash([2.2, 1.6]);
    c.beginPath(); c.arc(0, 0, MEADOW_LIMIT, 0, Math.PI * 2); c.stroke();
    c.setLineDash([]);

    // Moat, before the rampart stones; wooden bridge if the gate is open, otherwise a portcullis line.
    const moat = this.features.rampart;
    if (moat) {
      const w = moat.water;
      c.fillStyle = C.water;
      c.fillRect(w.x0, w.z0, w.x1 - w.x0, w.z1 - w.z0);
    }

    // Stones: rotated boxes (Ruins.js toWorldBox: local (lx, lz) → (lx c + lz s, −lx s + lz c), a rotation of −rotY in the
    // canvas frame x = world x, y = world z).
    c.lineJoin = 'round';
    for (const o of this.features.stones) {
      c.save();
      c.translate(o.x, o.z); c.rotate(-o.rotY);
      const hx = Math.max(o.hx, 0.45), hz = Math.max(o.hz, 0.45); // ≥ 0.9 m: about 2 px at 120 px
      c.fillStyle = C.stone; c.strokeStyle = C.stoneEdge; c.lineWidth = 0.35;
      c.fillRect(-hx, -hz, 2 * hx, 2 * hz); c.strokeRect(-hx, -hz, 2 * hx, 2 * hz);
      c.restore();
    }

    // Gate (Rampart.mapInfo): drawn over the stones, open or closed at a glance.
    if (moat) {
      const b = moat.bridge;
      if (moat.open) { c.fillStyle = C.bridge; c.fillRect(b.x0, -b.half, b.x1 - b.x0, 2 * b.half); }
      else { c.strokeStyle = C.portcullis; c.lineWidth = 0.8; c.beginPath(); c.moveTo(moat.portcullisX, -moat.portcullisHalf); c.lineTo(moat.portcullisX, moat.portcullisHalf); c.stroke(); }
    }

    // Bushes then trees: dark green circles, light highlight at the top left, edge line.
    for (const b of this.features.bushes) {
      c.fillStyle = C.bush; c.beginPath(); c.arc(b.x, b.z, b.r, 0, Math.PI * 2); c.fill();
    }
    for (const t of this.features.trees) {
      const R = t.R * 0.95;
      c.fillStyle = C.treeDark; c.strokeStyle = C.treeEdge; c.lineWidth = 0.22;
      c.beginPath(); c.arc(t.x, t.z, R, 0, Math.PI * 2); c.fill(); c.stroke();
      c.fillStyle = C.treeLight;
      c.beginPath(); c.arc(t.x - R * 0.28, t.z - R * 0.28, R * 0.45, 0, Math.PI * 2); c.fill();
    }
    return out;
  }

  /** Zone 2 background in world coordinates (MOUNTAIN_BAKE): snow, path, ledges, rocks, nearby pines. */
  _bakeMountain() {
    const B = MOUNTAIN_BAKE;
    const nx = Math.round((B.x1 - B.x0) * RELIEF_PPM) + 1, nz = Math.round((B.z1 - B.z0) * RELIEF_PPM) + 1;
    const relief = document.createElement('canvas');
    relief.width = nx; relief.height = nz;
    const rc = relief.getContext('2d');
    const img = rc.createImageData(nx, nz);
    for (let j = 0; j < nz; j++) {
      for (let i = 0; i < nx; i++) {
        const [r, g, b] = snowColor(B.x0 + i / RELIEF_PPM, B.z0 + j / RELIEF_PPM);
        const k = (j * nx + i) * 4;
        img.data[k] = r; img.data[k + 1] = g; img.data[k + 2] = b; img.data[k + 3] = 255;
      }
    }
    rc.putImageData(img, 0, 0);

    const out = document.createElement('canvas');
    out.width = Math.round((B.x1 - B.x0) * BAKE_PPM);
    out.height = Math.round((B.z1 - B.z0) * BAKE_PPM);
    out.addEventListener('contextrestored', this._rebakeMountain);
    this.bakeCount++;
    const c = out.getContext('2d');
    c.imageSmoothingEnabled = true;
    const s = BAKE_PPM / RELIEF_PPM;
    c.drawImage(relief, -s / 2, -s / 2, nx * s, nz * s);
    c.setTransform(BAKE_PPM, 0, 0, BAKE_PPM, -B.x0 * BAKE_PPM, -B.z0 * BAKE_PPM); // world metres

    // Path: the zone limit, held by the corridor, reads from its own outline.
    c.strokeStyle = C.snowPath; c.fillStyle = C.snowPath; c.lineCap = 'round';
    for (const p of PATH_SEGMENTS) {
      c.lineWidth = 2 * p.half;
      c.beginPath(); c.moveTo(p.ax, p.az); c.lineTo(p.bx, p.bz); c.stroke();
    }
    const disk = (x, z, r) => { c.beginPath(); c.arc(x, z, r, 0, Math.PI * 2); c.fill(); };
    for (const d of PATH_DISKS) disk(d.x, d.z, d.r); // foot, bends, clearing, summit (zone2.js)

    const m = this._world?.mountain;
    c.fillStyle = C.snowRock;
    for (const r of m?.rocks ?? []) disk(r.x, r.z, Math.max(r.r, 0.45));
    c.strokeStyle = C.pineEdge; c.lineWidth = 0.22;
    for (const t of m?.trees ?? []) {
      c.fillStyle = C.pine;
      c.beginPath(); c.arc(t.x, t.z, t.R * 0.8, 0, Math.PI * 2); c.fill(); c.stroke();
    }
    return out;
  }

  _mountainLayer() {
    if (!this.bakedMountain) this.bakedMountain = this._bakeMountain();
    return this.bakedMountain;
  }

  /**
   * True if the baked scenery still has its content. It is opaque everywhere, so one reduced pixel at the centre is enough
   * (one `drawImage` into a 1 × 1 canvas read by the CPU). Otherwise it is rebaked.
   */
  _checkBaked() {
    const p = this._probeCtx;
    const mountain = !!this._world?.inMountain;
    const src = mountain ? this._mountainLayer() : this.baked;
    let ok = false;
    try {
      p.clearRect(0, 0, 1, 1);
      p.drawImage(src, src.width / 2 - 8, src.height / 2 - 8, 16, 16, 0, 0, 1, 1);
      ok = p.getImageData(0, 0, 1, 1).data[3] > 0;
    } catch { ok = false; }
    if (!ok) { if (mountain) this._rebakeMountain(); else this._rebake(); }
    return ok;
  }

  setTarget(target) {
    this.target = target ? { x: target.x, z: target.z, near: target.near ?? NEAR_DEFAULT } : null;
    this._last.x = NaN; // forces a redraw
    this._applyVisibility();
  }

  /** Point shown by the goal: Maman is in zone 2, and from the meadow the only way is through the gate. */
  _aim(t) {
    const b = this.features.rampart?.bridge;
    return b && t.x > ZONE2.switchX && !this._world?.inMountain ? { x: b.x1, z: 0 } : t;
  }

  /** Shows or hides (0.35 s fade). Without a target the map stays visible (cat and scenery). */
  setVisible(on) {
    this._wanted = !!on;
    this._applyVisibility();
  }

  _applyVisibility() {
    if (this._wanted === this.visible) return;
    this.visible = this._wanted;
    this.state.visible = this.visible;
    this.el.classList.toggle('on', this.visible);
    this._last.x = NaN;
  }

  _resize() {
    const css = this.el.getBoundingClientRect().width || 120;
    const dpr = Math.min(devicePixelRatio || 1, DPR_MAX);
    const px = Math.round(css * dpr);
    if (px !== this._px) {
      this._px = px;
      this.canvas.width = this.canvas.height = px;
      this._last.x = NaN;
      this._checkBaked();
    }
    this._css = css;
    this.state.size = css;
    return px;
  }

  /** Every frame, after the camera has moved. `catHeading` is `cat.root.rotation.y` (rad). */
  update(camera, catPosition, catHeading, dt) {
    if (!camera || !catPosition) return;
    this._time += Number.isFinite(dt) ? dt : 1 / 60;
    if (Number.isFinite(catHeading)) this._heading = catHeading;
    const fwd = cameraGroundForward(camera);
    const cat = { x: catPosition.x, z: catPosition.z };
    const st = this.state;
    st.mapUp = Math.atan2(fwd.x, -fwd.z) * DEG; // world direction at the top of the map (0 = −Z, 90 = +X)
    st.catHeadingOnMap = headingOnMap(fwd, this._heading);

    const t = this.target;
    let rel = null;
    if (t) {
      rel = worldToMap(fwd, cat, this._aim(t));
      this.distance = Math.hypot(t.x - cat.x, t.z - cat.z);
      this.near = this.distance <= t.near;
      const m = clampToDisk(rel, VIEW_RADIUS, 2.2);
      st.targetBearing = mapAngle(rel);
      st.targetInside = m.inside;
      st.distance = this.distance;
      st.near = this.near;
      rel = m;
    } else {
      this.distance = Infinity; this.near = false;
      st.targetBearing = st.targetOnMap = st.targetInside = st.distance = null; st.near = false;
    }
    if (!this.visible) return; // hidden: read values up to date, no drawing

    const px = this._resize();
    const now = performance.now(); // real clock: the game's `dt` is capped when the frame is slow
    if (now - this._checkT >= CHECK_EVERY * 1000) { this._checkT = now; this._checkBaked(); }
    const k =(this._css / 2) * SCALE_FRAC / VIEW_RADIUS; // CSS px per metre
    if (rel) st.targetOnMap = { x: Math.round(rel.x * k * 10) / 10, y: Math.round(rel.y * k * 10) / 10 };

    // Nothing moved (and no pulse): no redraw.
    const L = this._last;
    const same = L.t === t && Math.abs(L.x - cat.x) < 0.01 && Math.abs(L.z - cat.z) < 0.01 &&
      Math.abs(L.fx - fwd.x) < 1e-4 && Math.abs(L.fz - fwd.z) < 1e-4 && Math.abs(L.h - this._heading) < 1e-3;
    if (same && !this.near) return;
    Object.assign(L, { x: cat.x, z: cat.z, fx: fwd.x, fz: fwd.z, h: this._heading, t });
    this._draw(px, fwd, cat, rel);
  }

  _draw(px, fwd, cat, rel) {
    const c = this.ctx;
    const half = px / 2;
    const ring = px * 0.045;               // brass ring
    const R = half - ring;                 // radius of the map disc (px)
    const s = (half * SCALE_FRAC) / VIEW_RADIUS; // px per metre (same scale as state.targetOnMap)
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, px, px);

    // Rotated map: x' = s (−fz dx + fx dz), y' = −s (fx dx + fz dz), centred on the cat.
    c.save();
    c.beginPath(); c.arc(half, half, R, 0, Math.PI * 2); c.clip();
    c.fillStyle = `rgb(${C.haze.join(',')})`; c.fillRect(0, 0, px, px);
    const a = -s * fwd.z, b = -s * fwd.x, cc = s * fwd.x, d = -s * fwd.z;
    c.setTransform(a, b, cc, d, half - (a * cat.x + cc * cat.z), half - (b * cat.x + d * cat.z));
    c.imageSmoothingEnabled = true;
    if (this._world?.inMountain) {
      const B = MOUNTAIN_BAKE;
      c.drawImage(this._mountainLayer(), B.x0, B.z0, B.x1 - B.x0, B.z1 - B.z0);
    } else c.drawImage(this.baked, -BAKE_HALF, -BAKE_HALF, 2 * BAKE_HALF, 2 * BAKE_HALF);
    c.restore();

    // Soft inner shadow on the edge of the disc.
    const g = c.createRadialGradient(half, half, R * 0.7, half, half, R);
    g.addColorStop(0, 'rgba(90, 67, 53, 0)'); g.addColorStop(1, 'rgba(90, 67, 53, 0.18)');
    c.fillStyle = g; c.beginPath(); c.arc(half, half, R, 0, Math.PI * 2); c.fill();

    // Goal: peach circle (pulsing when the cat is close) or arrow on the edge of the disc.
    if (rel) {
      const x = half + rel.x * s, y = half + rel.y * s;
      const u = px / 120; // unit: 1 CSS px at 120 px diameter
      if (rel.inside) {
        if (this.near) {
          const p = (this._time % 1.6) / 1.6;
          c.strokeStyle = `rgba(255, 159, 122, ${0.8 * (1 - p)})`; c.lineWidth = 2.5 * u;
          c.beginPath(); c.arc(x, y, (6 + 9 * p) * u, 0, Math.PI * 2); c.stroke();
        }
        c.fillStyle = C.target; c.strokeStyle = C.targetEdge; c.lineWidth = 2.2 * u;
        c.beginPath(); c.arc(x, y, 5.5 * u, 0, Math.PI * 2); c.fill(); c.stroke();
      } else {
        const ang = Math.atan2(rel.y, rel.x);
        c.save(); c.translate(x, y); c.rotate(ang);
        c.fillStyle = C.target; c.strokeStyle = C.targetEdge; c.lineWidth = 2 * u; c.lineJoin = 'round';
        c.beginPath(); c.moveTo(7 * u, 0); c.lineTo(-4.5 * u, -6.5 * u); c.lineTo(-2 * u, 0); c.lineTo(-4.5 * u, 6.5 * u);
        c.closePath(); c.fill(); c.stroke();
        c.restore();
      }
    }

    // Cat at the centre: warm black chevron arrow, tip = front of the cat (its heading), cream edge.
    {
      const u = px / 120;
      c.save(); c.translate(half, half); c.rotate(this.state.catHeadingOnMap / DEG);
      c.fillStyle = C.cat; c.strokeStyle = C.catEdge; c.lineWidth = 2 * u; c.lineJoin = 'round';
      c.beginPath();
      c.moveTo(0, -9 * u);                                   // muzzle (front)
      c.lineTo(5.5 * u, 5 * u); c.lineTo(0, 2.5 * u); c.lineTo(-5.5 * u, 5 * u);
      c.closePath(); c.fill(); c.stroke();
      c.restore();
    }

    // Cream brass ring (STONE), white edge like the HUD buttons.
    const brass = c.createLinearGradient(0, 0, px * 0.4, px);
    brass.addColorStop(0, '#fde9c4'); brass.addColorStop(0.5, '#e8c78f'); brass.addColorStop(1, '#dcb582');
    c.strokeStyle = brass; c.lineWidth = ring;
    c.beginPath(); c.arc(half, half, half - ring / 2 - px * 0.012, 0, Math.PI * 2); c.stroke();
    c.strokeStyle = '#ffffff'; c.lineWidth = px * 0.022;
    c.beginPath(); c.arc(half, half, half - px * 0.012, 0, Math.PI * 2); c.stroke();
    c.strokeStyle = '#c9a46e'; c.lineWidth = px * 0.01;
    c.beginPath(); c.arc(half, half, R, 0, Math.PI * 2); c.stroke();
  }

  /**
   * Re-reads and rebakes the scenery: called by Story on entering and leaving the arena (trees, bushes and stones hidden
   * or restored). No per-frame cost.
   */
  refresh() {
    this.features = mapFeatures(this._world);
    this.baked.removeEventListener('contextrestored', this._rebake);
    this._rebake();
  }

  dispose() {
    document.removeEventListener('visibilitychange', this._onVisibility);
    this.canvas.removeEventListener('contextrestored', this._redraw);
    this.baked.removeEventListener('contextrestored', this._rebake);
    this.bakedMountain?.removeEventListener('contextrestored', this._rebakeMountain);
    this.el.remove();
    if (!document.querySelector('.lost-minimap')) document.getElementById(STYLE_ID)?.remove();
  }
}
