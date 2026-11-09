/**
 * Zone 2: shape of the snowy mountain, as pure maths with no three.js and no state.
 * `Terrain.heightAt` uses it beyond ZONE2.switchX; `Mountain.js` derives the mesh, path edges and scenery from it;
 * `MiniMap`, `Chavalanche`, `npcPlacement`, `SnowCats`, `Crossing` and `fall` read the summit, the foot or the path.
 *
 * The path is a sequence of pieces (segment or disc); each carries a corridor flat across, whose height depends only on
 * the position along the piece. Off the path the relief is a slope (`SLOPE`); between the two, a bank (`PATH.bank`) and a
 * snow berm (`PATH.berm`). Height stays a function of (x, z) alone, in a few operations per piece.
 *
 * All route settings are in the tables below (`PATH`, `ROUTE`, `LEG_KINDS`, `SLOPE`, `FOOT`): changing a value changes
 * the mountain, with no other edit.
 */

/**
 * Position of the zone in the world. `x` at +X, far enough for the minimap arrow to aim at the rampart from the meadow
 * and for nothing of zone 1 to be visible: the two zones are never in the scene together, and `camera.far` is 500 m
 * (World.js) for scenery reaching 485 m from a zone camera. `switchX`: boundary of `heightAt`, beyond the last meadow
 * read (`meadowGround` in `Mountains.js`, x = 66 m) and the east edge of the meadow mesh (TERRAIN_SIZE = 96 m).
 */
export const ZONE2 = { x: 1000, switchX: 600 };

/**
 * Path. `half` 1.5 m: 3 m corridor for a 0.4 m cat, so the camera can turn without getting stuck. `bank` 1.6 m: bank
 * width up to the slope. `berm`: snow berm just outside the corridor, 0.28 m by 0.9 m, so the edge reads in the relief.
 * `turn` 3 m: default radius of a flat turn disc; each `ROUTE` node may set its own (`r`).
 * Landing: a node's disc and bank (`r` + `bank`) weigh on the relief of both neighbouring legs, so their ramp only starts
 * beyond it (node `flat` = `r` + `bank` + `flatMargin`), otherwise the height averaging adds a local slope.
 */
export const PATH = { half: 1.5, bank: 1.6, berm: { h: 0.28, w: 0.9 }, turn: 3, flatMargin: 0.1 };

/** Foot landing (centre and radius), relative to ZONE2.x. The bridge (ZONE2_ENTRY) and the meadow rampart depend on it. */
export const FOOT = { x: 0, z: 0, r: 7 };

/**
 * Leg kinds (corridor half width `half`, m).
 * - `turn`: ordinary leg, 3 m corridor.
 * - `ledge`: narrow passage (2 m) along the flank; on the downhill side (-X), `drop.gap` m from the bank, the snow
 *   falls by `drop.depth` m over `drop.width` m, stays at the bottom for `drop.hold` m, then rises over `drop.recover` m
 *   up to the slope (a ravine, not a hole across the whole plain); `drop.fade`: length over which the drop sets in at
 *   both ends. The cat stays in the corridor (`pathInside`), so the drop cannot be crossed.
 * - `corridor`: narrow passage (2.4 m) between two walls of large rocks placed by `Mountain.js`: `walls.r` radius (m),
 *   `walls.rows` rows, `walls.gap` gap to the corridor.
 */
export const LEG_KINDS = {
  turn: { half: PATH.half },
  ledge: { half: 1.0, drop: { depth: 4.5, width: 3.5, hold: 1.5, recover: 9, gap: 0.5, fade: 9 } },
  corridor: { half: 1.2, walls: { r: [1.1, 1.8], gap: 0.1, rows: 2 } },
};

/**
 * Route: one node per change of direction, from foot to summit, relative to ZONE2.x (m). `x`, `z`: arrival point;
 * `kind`: kind of the leg leading to it (`LEG_KINDS`); `r`: radius of the node's flat disc (default `PATH.turn`);
 * `clearing`: the disc is a clearing (wide flat area, ring of pines, `Mountain.js`); `summit`: last node. The turn before
 * the summit is at the top of the slope (`SLOPE.x1`), so the leg leading to the summit is flat.
 * Turn sequence: L L R R L, never three alternating turns. Ramps: 10.5 to 16.6 deg on climbing legs, flat on the ledge
 * and the summit.
 */
export const ROUTE = [
  { x: 20, z: -10, kind: 'turn', r: 1.5 },
  { x: 39, z: 1.5, kind: 'corridor', r: 1.5 },
  { x: 43, z: 17, kind: 'ledge', r: 5, clearing: true },
  { x: 72, z: 15, kind: 'turn', r: 2 },
  { x: 88, z: -1, kind: 'turn', r: 2 },
  { x: 96.5, z: 0, kind: 'turn', r: 8, summit: true },
];
const LAST = ROUTE[ROUTE.length - 1];

/**
 * Slope: plane rising along x from `x0` (foot) to `x1` (last turn before the summit), `height` m above the foot; the
 * distant scenery (`Mountains.js`) keeps the scale of the mountain. Plane slope 0.19 (10.9 deg); the path derives its
 * ramp of 10.5 to 16.6 deg from it. `flankZ`: the flanks fall back to plain level between these two |z|; `backX`: same
 * beyond the summit (offsets from `x1`). `noise`: snow bumps (m).
 */
export const SLOPE = {
  x0: 10, x1: ROUTE[ROUTE.length - 2].x, height: 15,
  flankZ: [24, 72], backX: [12, 62], noise: 0.26,
};

/** Summit landing (Maman), relative to ZONE2.x: the last node of `ROUTE`. */
export const SUMMIT = { x: LAST.x, z: LAST.z, r: LAST.r };

/** Turn nodes in metres relative to ZONE2.x (foot and summit are separate). */

/**
 * Arrival point in the zone (world, m): on the -X edge of the foot landing, where the bridge crossing puts the cat.
 * `yaw` pi/2: faces +X, the direction of the climb (cat forward = (sin yaw, cos yaw)).
 */
export const ZONE2_ENTRY = { x: ZONE2.x + FOOT.x - 4.5, z: FOOT.z, yaw: Math.PI / 2 };

function smoothstep(a, b, x) {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
}

const slopeAt = (u) => SLOPE.height * Math.min(Math.max((u - SLOPE.x0) / (SLOPE.x1 - SLOPE.x0), 0), 1);

/** Path pieces, in world coordinates. `fa`, `fb`: landings at the start and end of a segment. */
function piece(ax, az, ah, bx, bz, bh, half, fa = 0, fb = fa, extra = null) {
  const dx = bx - ax, dz = bz - az, len = Math.hypot(dx, dz);
  return { ax, az, ah, bh, half, fa, fb, len, ux: len ? dx / len : 0, uz: len ? dz / len : 0, bx, bz, ...extra };
}

const X = ZONE2.x;
const PIECES = [];
export const FOOT_Y = 0;
export const SUMMIT_Y = SLOPE.height;
{
  const flatOf = (n) => n.flat ?? (n.r ?? PATH.turn) + PATH.bank + PATH.flatMargin;
  const nodeH = (n) => (n.summit ? SUMMIT_Y : slopeAt(n.x));
  PIECES.push(piece(X + FOOT.x, FOOT.z, FOOT_Y, X + FOOT.x, FOOT.z, FOOT_Y, FOOT.r));
  let prev = { x: FOOT.x, z: FOOT.z, h: FOOT_Y, flat: FOOT.r + PATH.bank + 0.2 };
  ROUTE.forEach((n, i) => {
    const h = nodeH(n);
    PIECES.push(piece(X + prev.x, prev.z, prev.h, X + n.x, n.z, h, LEG_KINDS[n.kind].half, prev.flat, n.summit ? 0 : flatOf(n), { kind: n.kind, index: i }));
    prev = { x: n.x, z: n.z, h, flat: flatOf(n) };
  });
  ROUTE.forEach((n) => {
    if (!n.summit) PIECES.push(piece(X + n.x, n.z, nodeH(n), X + n.x, n.z, nodeH(n), n.r ?? PATH.turn, 0, 0, { clearing: !!n.clearing }));
  });
  PIECES.push(piece(X + SUMMIT.x, SUMMIT.z, SUMMIT_Y, X + SUMMIT.x, SUMMIT.z, SUMMIT_Y, SUMMIT.r));
}

/** Path legs in climbing order (non-zero length): scenery along the edges. */
export const PATH_SEGMENTS = PIECES.filter((p) => p.len > 0);
/** Flat discs {x, z, r, clearing} in world space: foot, turns, summit. */
export const PATH_DISKS = PIECES.filter((p) => p.len === 0).map((p) => ({ x: p.ax, z: p.az, r: p.half, clearing: !!p.clearing }));

const DROPS = PATH_SEGMENTS.filter((p) => LEG_KINDS[p.kind]?.drop);
// Downhill side of a ledge: the -X side (lateral coordinate of (-1, 0) = uz).
for (const p of DROPS) p.dropSide = Math.sign(p.uz) || 1;

/** Corridor bounds in world space (m), for the pathfinding grid and the minimap background. */
export const ZONE2_BOUNDS = (() => {
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const p of PIECES) {
    x0 = Math.min(x0, p.ax - p.half, p.bx - p.half); x1 = Math.max(x1, p.ax + p.half, p.bx + p.half);
    z0 = Math.min(z0, p.az - p.half, p.bz - p.half); z1 = Math.max(z1, p.az + p.half, p.bz + p.half);
  }
  return { x0, x1, z0, z1 };
})();

/** Snow dropping beside a ledge (m): 0 elsewhere, up to `depth` on the downhill side. */
function dropAt(x, z) {
  let d = 0;
  for (let i = 0; i < DROPS.length; i++) {
    const p = DROPS[i], D = LEG_KINDS[p.kind].drop;
    const px = x - p.ax, pz = z - p.az;
    const s = px * p.ux + pz * p.uz;
    const lat = (-px * p.uz + pz * p.ux) * p.dropSide - p.half - PATH.bank - D.gap;
    if (lat <= 0) continue;
    const along = smoothstep(-D.fade * 0.5, D.fade, s) * smoothstep(p.len + D.fade * 0.5, p.len - D.fade, s);
    if (along <= 0) continue;
    d = Math.max(d, D.depth * smoothstep(0, D.width, lat) * (1 - smoothstep(D.width + D.hold, D.width + D.hold + D.recover, lat)) * along);
  }
  return d;
}

/** Relief off the path: slope, flanks, behind the summit, snow bumps, ledge drops. */
function slopeHeight(x, z) {
  const u = x - X;
  const lat = 1 - smoothstep(SLOPE.flankZ[0], SLOPE.flankZ[1], Math.abs(z));
  const back = 1 - smoothstep(SLOPE.x1 + SLOPE.backX[0], SLOPE.x1 + SLOPE.backX[1], u);
  const n = Math.sin(0.37 * x + 1.1) * Math.sin(0.29 * z + 0.4) + 0.4 * Math.sin(0.83 * x - 0.61 * z);
  return slopeAt(u) * lat * back + SLOPE.noise * n - (DROPS.length ? dropAt(x, z) : 0);
}

/** Signed distance to the corridor: negative inside, positive outside (m). */
export function pathClearance(x, z) {
  let best = Infinity;
  for (let i = 0; i < PIECES.length; i++) {
    const p = PIECES[i];
    const px = x - p.ax, pz = z - p.az;
    const s = Math.min(Math.max(px * p.ux + pz * p.uz, 0), p.len);
    const c = Math.hypot(px - s * p.ux, pz - s * p.uz) - p.half;
    if (c < best) best = c;
  }
  return best;
}

/**
 * Brings (x, z) back into the corridor, at least `margin` from the edge (nearest piece). Writes to `out` {x, z} and
 * returns true if the point moved. A click far up the slope thus lands on the nearest leg; walking cannot cross the bank.
 */
export function pathInside(x, z, margin, out) {
  let best = Infinity, b = null, bs = 0;
  for (let i = 0; i < PIECES.length; i++) {
    const p = PIECES[i];
    const px = x - p.ax, pz = z - p.az;
    const s = Math.min(Math.max(px * p.ux + pz * p.uz, 0), p.len);
    const c = Math.hypot(px - s * p.ux, pz - s * p.uz) - p.half;
    if (c < best) { best = c; b = p; bs = s; }
  }
  out.x = x; out.z = z;
  if (best <= -margin) return false;
  const cx = b.ax + bs * b.ux, cz = b.az + bs * b.uz;
  const dx = x - cx, dz = z - cz, d = Math.hypot(dx, dz), k = b.half - margin;
  if (d < 1e-6) return false;
  out.x = cx + dx / d * k; out.z = cz + dz / d * k;
  return true;
}

/** Zone 2 ground height (m). Pure: depends only on (x, z). */
export function mountainHeight(x, z) {
  let sumW = 0, sumH = 0, clear = Infinity;
  for (let i = 0; i < PIECES.length; i++) {
    const p = PIECES[i];
    const px = x - p.ax, pz = z - p.az;
    const s = Math.min(Math.max(px * p.ux + pz * p.uz, 0), p.len);
    const c = Math.hypot(px - s * p.ux, pz - s * p.uz) - p.half;
    if (c < clear) clear = c;
    if (c >= PATH.bank) continue;
    let w = 1;
    if (c > 0) { const t = c / PATH.bank; w = 1 - t * t * (3 - 2 * t); }
    const run = p.len - p.fa - p.fb;
    const a = run > 0 ? Math.min(Math.max((s - p.fa) / run, 0), 1) : 0;
    sumW += w;
    sumH += w * (p.ah + (p.bh - p.ah) * a);
  }
  let h;
  if (sumW >= 1) h = sumH / sumW;
  else {
    const base = slopeHeight(x, z);
    h = sumW > 0 ? base * (1 - sumW) + sumH : base;
  }
  if (clear > 0 && clear < PATH.berm.w) h += PATH.berm.h * Math.sin(Math.PI * clear / PATH.berm.w);
  return h;
}
