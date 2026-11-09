/**
 * Camera shot for a speech bubble with no obstacle in the way. Pure maths with no three.js or DOM: Story.js calls
 * it when a bubble opens, and the same computation can be checked under Node.
 *
 * Starting shot: camera `dist` m behind the cat, `height` m above the target, gaze turned by the angle `a` (law of
 * sines: NPC at 45% of the horizontal half-field). If an obstacle cuts the camera-to-cat or camera-to-NPC line of
 * sight (walls and rocks of the ruins, trunks and bushes: `obstacles` in the Ruins.obstacles format; tree crowns:
 * spheres from `trees` in Forest.js; terrain: `heightAt`), candidate shots (gaze offset, height, distance) are tried
 * by increasing cost of moving away from the starting shot. Each candidate keeps the cat and the NPC in frame
 * (projection: |x| ≤ FRAME.x, |y| ≤ FRAME.y in normalised coordinates); failing that, a second pass accepts the NPC
 * near the edge (FRAME_EDGE). With no clear shot, the least obstructed one is returned, the cat first (PENALTY).
 *
 * Limit: the camera target stays on the cat (World.js). Pressed against a wall, the cat leaves no room for the
 * camera behind it (controls.minDistance 0.7 m).
 */

/** Heights tested (m above the ground): centre and eyes of the cat; body and head of the NPC (× 1.25). */
export const SIGHT = { cat: 0.2, eye: 0.3, npc: [0.25, 0.55] };
/**
 * Frame margins (m). `head`: NPC head as a sphere (head bone given by Story.js, otherwise point SIGHT.npc[1] above
 * the root, hence `headFallback`, which covers the forward offset). `body`: around the other points. `top`: around
 * the topmost point (top of the hat, beret or ears), margin included; 0.03 because these points are the extreme
 * vertices of the frozen pose. `catHead`: sphere around the cat's head.
 */
const BULK = { head: 0.13, headFallback: 0.2, body: 0.12, top: 0.03, catHead: 0.07 };
/** Screen edge (normalised coordinates) that these spheres must not exceed. */
const SCREEN = 0.97;
/** Radius (m) of the corolla of a tall flower (Flowers.js) treated as an obstruction on a line of sight. */
const BLOOM = 0.1;
/** Corolla within BLOOM_NEAR m of the camera and on screen: also an obstruction (close-up). */
const BLOOM_NEAR = 1.0;
/**
 * Face: with `facing`, shots where the NPC is seen more than `max` rad from its front (from behind, from above
 * behind it), or whose camera-to-head line passes within `cat` m of the cat (centre SIGHT.cat), only come after the
 * shots that see its face.
 */
const FACE = { max: (100 * Math.PI) / 180, cat: 0.2 };
/** Usable frame in normalised screen coordinates (the NPC does not stick to the edge); fallback at the edge. */
const FRAME = { x: 0.62, y: 0.8 };
const FRAME_EDGE = { x: 0.92, y: 0.92 };
/** Candidates: distances (m) and heights (m) tried, from the starting shot towards the fallbacks. */
const DISTS = [2.6, 2.1, 1.7, 1.3, 1.0, 0.75]; // 0.75: above controls.minDistance (0.7)
const HEIGHTS = [0.9, 1.4, 2.0, 2.7];
/**
 * Gaze offsets tried: multiples of the starting offset `a`, then fixed offsets (rad), which the frame check only
 * keeps on a wide enough screen. Around π: reverse shot, camera on the NPC's side (foreground) looking at the cat
 * (cat against a wall, back to the wall).
 */
const TURNS = [1, -1, 0.5, -0.5, 0, 1.6, -1.6, 2.4, -2.4];
const TURNS_ABS = [0.9, -0.9, 1.3, -1.3, Math.PI - 0.3, Math.PI + 0.3, Math.PI - 0.6, Math.PI + 0.6];
/** Fallback when no candidate is clear: weight of a blocked line (the cat first). */
const PENALTY = { camera: 5, cat: 3, npc: 1 };
/**
 * Maximum `sight` calls per shot (about 0.45 ms per call, up to 471 calls without a cap). Beyond it, boxes only,
 * as without `sight`.
 */
const SIGHT_BUDGET = 150;
/**
 * Third pass: weight of the minimap overlap in the frame excess; excess tolerance around the best; excess of a
 * point behind the camera.
 */
const AVOID_WEIGHT = 4;
const EXCESS_TOL = 0.05; // only the screen counts for the top; 0.15 cuts a hat by up to 68 px at 390 × 844
const BEHIND = 10;
/** Margin (m) around the boxes; crown radius as a fraction of `R` (Forest.js). */
const BOX_MARGIN = 0.06;
const CROWN = { up: 1.05, radius: 1.15 };

/**
 * Picks the camera shot of a speech bubble.
 * @param {object} o
 * @param {{x,y,z}} o.cat Cat position (root, on the ground).
 * @param {{x,y,z}} o.npc NPC position (root, on the ground).
 * @param {string} [o.skip] Prefix of ignored obstacles (footprints of the talking NPC: `npc_chagicien_`).
 * @param {Array} o.obstacles Boxes { x, z, hx, hz, rotY, top, ground }.
 * @param {Array} [o.trees] Forest.js `trees`: { x, z, R, top }.
 * @param {(x: number, z: number) => number} o.heightAt Terrain height.
 * @param {number} o.fov Vertical field of view (degrees).
 * @param {number} o.aspect Width / height.
 * @param {{ dist, height, angle }} o.shot Starting settings (SHOT.talk).
 * @param {{x,y,z}} [o.head] World position of the NPC's head (bone), tested in frame.
 * @param {{x,y,z}|Array<{x,y,z}>} [o.top] Real top of the NPC (hat, beret, ears) and hat edges (Story.js `_top`),
 *   tested in frame.
 * @param {Array<{x0,x1,y0,y1}>} [o.avoid] Screen zones (normalised coordinates) where neither the cat nor the NPC
 *   may fall: minimap (Story.js).
 * @param {{x,y,z}} [o.catHead] World position of the cat's head (bone), tested in frame.
 * @param {Array<{x0,x1,y0,y1}>} [o.avoidHead] Zones that only heads (NPC and cat) avoid in addition to `avoid`:
 *   speech bubble (Story.js; the NPC's lower body may pass behind it).
 * @param {Array<{x,z,top,hidden}>} [o.flowers] Tall flowers (Meadow.flowerList): a clear shot whose line of sight is
 *   cut by a corolla gives way to the next of the same pass (otherwise `flowers` is true).
 * @param {number} [o.follow=0.22] Target height above the ground (World.js FOLLOW_HEIGHT).
 * @param {number} [o.facing] NPC heading (rad, 0 = muzzle towards +Z, Npc.js): shots that see its face come first
 *   (FACE).
 * @param {(a: {x,y,z}, b: {x,y,z}) => boolean} [o.sight] Line of sight on the real scenery (Story.js: meshes of
 *   `world.occluders`). When given, it replaces the scenery boxes for lines of sight (real windows and doors instead
 *   of conservative lintels, roof included, camera caught in a stone counts as blocked). NPC boxes (`npc_`), tree
 *   crowns and terrain are still tested, as well as the camera inside a box. At most SIGHT_BUDGET calls; once a line
 *   of the shot is blocked, its other lines (penalty only) are tested on the boxes.
 * @returns {{ lx, lz, dist, height, clear, rank, edge, blocked, penalty }} Normalised horizontal gaze, chosen distance
 *   and height. `clear`: false if no candidate is clear (the least obstructed is returned). `rank`: candidate rank
 *   (0 = starting shot). `edge`: found on the second pass. `blocked`: blocked lines of the returned candidate. `framed`
 *   false and `excess` (see frameExcess) when no candidate fits the frame (third pass, flowers not tested). `face`
 *   (with `facing`): NPC's face seen and not masked by the cat (FACE).
 */
export function talkShot({ cat, npc, skip = '', obstacles, trees = [], heightAt, fov, aspect, shot, follow = 0.22, head = null, top = null, avoid = [], flowers = [], sight = null, facing = null, catHead = null, avoidHead = [] }) {
  let ux = npc.x - cat.x, uz = npc.z - cat.z;
  const d = Math.hypot(ux, uz) || 1e-3;
  ux /= d; uz /= d;
  const tanV = Math.tan((fov * Math.PI) / 360);
  const half = Math.atan(tanV * aspect);
  const gc = heightAt(cat.x, cat.z), gn = heightAt(npc.x, npc.z);
  const target = { x: cat.x, y: Math.max(cat.y, gc) + follow, z: cat.z };
  const pts = [
    { x: cat.x, y: Math.max(cat.y, gc) + SIGHT.cat, z: cat.z },
    ...SIGHT.npc.map((h) => ({ x: npc.x, y: Math.max(npc.y, gn) + h, z: npc.z })),
  ];
  // Frame only (no extra line of sight): points with their radius, head included.
  const framed = [
    ...pts.map((p, j) => ({ ...p, r: j === pts.length - 1 && !head ? BULK.headFallback : BULK.body, headed: j === pts.length - 1 && !head })),
    ...(head ? [{ x: head.x, y: head.y, z: head.z, r: BULK.head, headed: true }] : []),
    // Cat's head: like the NPC's, it also avoids the `avoidHead` zones.
    ...(catHead ? [{ x: catHead.x, y: catHead.y, z: catHead.z, r: BULK.catHead, headed: true }] : []),
    // Top: extreme point. Its sphere only counts against the screen edge (SCREEN) and the minimap, not the usable frame.
    ...[].concat(top ?? []).map((t) => ({ x: t.x, y: t.y, z: t.z, r: BULK.top, rim: true })),
  ];
  // Face seen (FACE): camera on the NPC's front side, cat off the camera-to-head line.
  const face = facing == null ? null : { x: Math.sin(facing), z: Math.cos(facing) };
  const headAt = head ?? pts[pts.length - 1];
  const faces = (cam) => {
    if (!face) return true;
    const vx = cam.x - npc.x, vz = cam.z - npc.z;
    if (vx * face.x + vz * face.z < Math.cos(FACE.max) * Math.hypot(vx, vz)) return false;
    return !segSphere({ ...pts[0], r: FACE.cat }, cam, headAt);
  };
  const boxes = [...obstacles.filter((b) => !(skip && b.name?.startsWith(skip))), ...lintels(obstacles)];
  const lineBoxes = sight ? boxes.filter((b) => b.name?.startsWith('npc_')) : boxes; // see `sight`
  const crowns = trees.map((t) => ({ x: t.x, y: t.top - CROWN.up * t.R, z: t.z, r: CROWN.radius * t.R }));
  // Tall flowers: corollas near the cat, an obstruction only (the shot is kept if nothing better exists).
  const reach = shot.dist + 1.5;
  const blooms = [];
  for (const f of flowers) {
    if (f.hidden || !f.top || Math.hypot(f.x - cat.x, f.z - cat.z) > reach) continue;
    blooms.push({ x: f.top.x, y: f.top.y, z: f.top.z, r: BLOOM });
  }

  // Zones to avoid per point: `avoid` for all, `avoid` + `avoidHead` for heads (speech bubble).
  const avoidAll = avoidHead.length ? [...avoid, ...avoidHead] : avoid;
  const zonesOf = (p) => (p.headed ? avoidAll : avoid);

  const cands = [];
  for (const dist of DISTS) {
    const beta = 0.45 * half, q = (dist * Math.sin(beta)) / d;
    const a = Math.min(shot.angle, q >= 1 ? beta : beta + Math.asin(q));
    for (const height of HEIGHTS) {
      for (const turn of [...TURNS.map((k) => k * a), ...TURNS_ABS]) {
        cands.push({ dist, height, a: turn, cost: (shot.dist - dist) * 1.2 + (height - shot.height) * 0.8 + Math.abs(turn - a) });
      }
    }
  }
  cands.sort((p, q) => p.cost - q.cost);

  // Camera position of a candidate (null below the terrain).
  const place = (k) => {
    const c = Math.cos(k.a), s = Math.sin(k.a);
    const lx = ux * c - uz * s, lz = ux * s + uz * c;
    const cam = { x: target.x - lx * k.dist, y: target.y + k.height, z: target.z - lz * k.dist };
    return cam.y < heightAt(cam.x, cam.z) + 0.15 ? null : { lx, lz, cam };
  };
  // Lines of sight of a shot: blocked lines and penalty.
  let budget = sight ? SIGHT_BUDGET : 0;
  const lines = (cam) => {
    const blocked = [];
    let penalty = 0;
    if (boxes.some((b) => insideBox(b, cam, 0.15))) { blocked.push('camera inside an obstacle'); penalty += PENALTY.camera; }
    pts.forEach((p, j) => {
      // Real scenery while calls remain and the shot is not yet obstructed; otherwise boxes.
      const real = budget > 0 && !blocked.length;
      if (real ? lineClear(cam, p, lineBoxes, crowns, heightAt) && (budget--, sight(cam, p)) : lineClear(cam, p, boxes, crowns, heightAt)) return;
      blocked.push(j === 0 ? 'cat' : `npc ${SIGHT.npc[j - 1]} m`);
      penalty += j === 0 ? PENALTY.cat : PENALTY.npc;
    });
    return { blocked, penalty };
  };

  // First pass: usable frame. Second pass: NPC accepted near the edge (FRAME_EDGE). With `facing`, each pass is first
  // done on the shots that see the face; the least obstructed fallback is sought among all shots.
  const passes = (face ? [[FRAME, true], [FRAME_EDGE, true], [FRAME, false], [FRAME_EDGE, false]] : [[FRAME, false], [FRAME_EDGE, false]]);
  let best = null, flowered = null;
  const seenLines = new Map();
  for (const [frame, wantFace] of passes) {
    for (let i = 0; i < cands.length; i++) {
      const k = cands[i], at = place(k);
      if (!at) continue;
      const { lx, lz, cam } = at;
      if (!framed.every((p) => inFrame(cam, target, p, tanV, aspect, frame, zonesOf(p)))) continue;
      const seen = faces(cam);
      if (wantFace && !seen) continue;
      if (!wantFace && face && seen) continue; // already tried
      if (!seenLines.has(i)) seenLines.set(i, lines(cam)); // a shot from the first pass, seen again on the second
      const { blocked, penalty } = seenLines.get(i);
      const res = { lx, lz, dist: k.dist, height: k.height, clear: blocked.length === 0, rank: i, edge: frame === FRAME_EDGE, face: seen, blocked, penalty };
      if (res.clear) {
        // A corolla on a line of sight: shot kept only if no other shot of the pass is clear.
        const near = (s) => Math.hypot(s.x - cam.x, s.y - cam.y, s.z - cam.z) < BLOOM_NEAR && inFrame(cam, target, s, tanV, aspect, FRAME_EDGE);
        if (!blooms.some((s) => near(s) || pts.some((p) => segSphere(s, cam, p)))) return res;
        if (!flowered) flowered = { ...res, flowers: true };
        continue;
      }
      if (!best || penalty < best.penalty) best = res;
    }
    if (flowered) return flowered;
  }
  if (best) return best;
  // Third pass: no candidate holds the whole NPC (narrow screen, tall and close NPC). Shots with the smallest frame
  // excess (minimap counted AVOID_WEIGHT times: better a hat cut by the top of the screen than under the map), then
  // the first clear one by increasing cost, otherwise the least obstructed.
  const scored = [];
  for (let i = 0; i < cands.length; i++) {
    const at = place(cands[i]);
    if (!at) continue;
    const ex = framed.reduce((sum, p) => sum + frameExcess(at.cam, target, p, tanV, aspect, FRAME_EDGE, zonesOf(p)), 0);
    scored.push({ i, at, ex });
  }
  const least = Math.min(...scored.map((c) => c.ex));
  let worst = null;
  // Face seen first (FACE), then the other shots.
  const pool = scored.filter((c) => c.ex <= least + EXCESS_TOL).map((c) => ({ ...c, seen: faces(c.at.cam) }));
  for (const { i, at, ex, seen } of [...pool.filter((c) => c.seen), ...pool.filter((c) => !c.seen)]) {
    const { blocked, penalty } = lines(at.cam);
    const res = { lx: at.lx, lz: at.lz, dist: cands[i].dist, height: cands[i].height, clear: blocked.length === 0, rank: i, edge: true, framed: false, excess: ex, face: seen, blocked, penalty };
    if (res.clear) return res;
    if (!worst || penalty < worst.penalty) worst = res;
  }
  return worst ?? { lx: ux, lz: uz, dist: shot.dist, height: shot.height, clear: false, rank: -1, edge: false, blocked: ['no candidate in frame'], penalty: Infinity };
}

/**
 * Does the cat see the NPC? Line from its eyes (SIGHT.eye) to the NPC's head, cut by a box (`obstacles`, except
 * prefix `skip`) or by the terrain. Prevents opening a speech bubble through a wall.
 */
export function seesNpc({ cat, npc, skip = '', obstacles, heightAt }) {
  const boxes = obstacles.filter((b) => !(skip && b.name?.startsWith(skip)));
  const a = { x: cat.x, y: Math.max(cat.y, heightAt(cat.x, cat.z)) + SIGHT.eye, z: cat.z };
  const b = { x: npc.x, y: Math.max(npc.y, heightAt(npc.x, npc.z)) + SIGHT.npc[1], z: npc.z };
  return lineClear(a, b, boxes, [], heightAt);
}

/**
 * Lintels: Ruins.obstacles cuts a wall into full-height sections on either side of a door, but the real door
 * (Ruins.js: pointed arch of the church, springing at 1.5 m; round arch, 0.95 m + 0.5 m radius) is closed above.
 * Between two sections of one wall at most LINTEL.gap m apart, a box covers the passage from LINTEL.from m above the
 * ground up to the lower of the two tops. Conservative: under the pointed arch the view really passes slightly higher.
 */
const LINTEL = { gap: 1.6, from: 1.4 };
const _lintels = new WeakMap();
function lintels(obstacles) {
  const hit = _lintels.get(obstacles);
  if (hit && hit.n === obstacles.length) return hit.list;
  const walls = new Map();
  for (const o of obstacles) {
    if (o.climbable || !o.name) continue;
    const k = `${o.name}|${(o.rotY ?? 0).toFixed(3)}`;
    if (!walls.has(k)) walls.set(k, []);
    walls.get(k).push(o);
  }
  const list = [];
  for (const ps of walls.values()) {
    if (ps.length < 2) continue;
    const r = ps[0].rotY ?? 0, c = Math.cos(r), s = Math.sin(r);
    const along = (o) => o.x * c - o.z * s; // local x axis of the wall (toLocal convention)
    ps.sort((p, q) => along(p) - along(q));
    for (let i = 1; i < ps.length; i++) {
      const a = ps[i - 1], b = ps[i];
      const g = along(b) - b.hx - (along(a) + a.hx);
      if (g <= 0.05 || g > LINTEL.gap) continue;
      const mid = along(a) + a.hx + g / 2, t = (a.x * s + a.z * c + b.x * s + b.z * c) / 2; // t: local z axis
      const ground = Math.min(a.ground, b.ground);
      list.push({ name: `${a.name}_lintel`, x: mid * c + t * s, z: -mid * s + t * c, hx: g / 2, hz: Math.max(a.hz, b.hz), rotY: r,
        ground: ground + LINTEL.from, top: Math.min(a.top, b.top) });
    }
  }
  _lintels.set(obstacles, { n: obstacles.length, list });
  return list;
}

/**
 * Whether point `p` (radius `p.r` m, 0 by default) is in the frame `frame` of a camera at `cam` looking at `t`
 * (vertical axis +Y), and outside the `avoid` zones.
 */
function inFrame(cam, t, p, tanV, aspect, frame, avoid = []) {
  const q = project(cam, t, p, tanV, aspect);
  if (!q) return false;
  const { nx, ny, ex, ey } = q;
  // Centre within the usable frame; whole sphere on screen (SCREEN margin): head not cut.
  if (!p.rim && (Math.abs(nx) > frame.x || Math.abs(ny) > frame.y)) return false; // top: screen only
  if (Math.abs(nx) + ex > SCREEN || Math.abs(ny) + ey > SCREEN) return false;
  return !avoid.some((z) => nx + ex > z.x0 && nx - ex < z.x1 && ny + ey > z.y0 && ny - ey < z.y1);
}

/**
 * Excess of `inFrame` (normalised coordinates, 0 if the point fits): outside the frame, off screen, and overlap of
 * an `avoid` zone counted AVOID_WEIGHT times; point behind the camera: BEHIND. Used by the third pass of talkShot.
 */
function frameExcess(cam, t, p, tanV, aspect, frame, avoid = []) {
  const q = project(cam, t, p, tanV, aspect);
  if (!q) return BEHIND;
  const { nx, ny, ex, ey } = q, over = (v) => Math.max(0, v);
  let e = (p.rim ? 0 : over(Math.abs(nx) - frame.x) + over(Math.abs(ny) - frame.y)) + over(Math.abs(nx) + ex - SCREEN) + over(Math.abs(ny) + ey - SCREEN);
  for (const z of avoid) e += AVOID_WEIGHT * over(Math.min(nx + ex - z.x0, z.x1 - nx + ex, ny + ey - z.y0, z.y1 - ny + ey));
  return e;
}

/**
 * Projection of sphere `p` (radius p.r) for a camera at `cam` looking at `t`: centre (nx, ny) and half-sizes
 * (ex, ey) in normalised coordinates; null if the point is behind the camera.
 */
function project(cam, t, p, tanV, aspect) {
  let fx = t.x - cam.x, fy = t.y - cam.y, fz = t.z - cam.z;
  const fl = Math.hypot(fx, fy, fz); fx /= fl; fy /= fl; fz /= fl;
  // right = forward × up(0, 1, 0); up' = right × forward
  let rx = -fz, rz = fx; const rl = Math.hypot(rx, rz) || 1; rx /= rl; rz /= rl;
  const vx = -rz * fy, vy = rz * fx - rx * fz, vz = rx * fy;
  const px = p.x - cam.x, py = p.y - cam.y, pz = p.z - cam.z;
  const depth = px * fx + py * fy + pz * fz;
  if (depth <= 0.05) return null;
  const nx = (px * rx + pz * rz) / depth / (tanV * aspect);
  const ny = (px * vx + py * vy + pz * vz) / depth / tanV;
  const ex = (p.r ?? 0) / depth / (tanV * aspect), ey = (p.r ?? 0) / depth / tanV;
  return { nx, ny, ex, ey };
}

/** Local frame of a box (same convention as Ruins.js `toLocal`). */
function toLocal(b, x, z) {
  const dx = x - b.x, dz = z - b.z, c = Math.cos(b.rotY ?? 0), s = Math.sin(b.rotY ?? 0);
  return [dx * c - dz * s, dx * s + dz * c];
}

function insideBox(b, p, m) {
  const [lx, lz] = toLocal(b, p.x, p.z);
  return Math.abs(lx) <= b.hx + m && Math.abs(lz) <= b.hz + m && p.y >= b.ground - m && p.y <= b.top + m;
}

/** True if segment a → b is clear: boxes (slab test in local space), tree crowns, terrain (12 points). */
function lineClear(a, b, boxes, crowns, heightAt) {
  for (const box of boxes) if (segBox(box, a, b)) return false;
  for (const s of crowns) if (segSphere(s, a, b)) return false;
  for (let i = 1; i < 12; i++) {
    const t = i / 12, x = a.x + (b.x - a.x) * t, z = a.z + (b.z - a.z) * t, y = a.y + (b.y - a.y) * t;
    if (heightAt(x, z) > y + 0.02) return false;
  }
  return true;
}

function segBox(b, a, p) {
  const [ax, az] = toLocal(b, a.x, a.z), [px, pz] = toLocal(b, p.x, p.z);
  const lo = [-b.hx - BOX_MARGIN, b.ground, -b.hz - BOX_MARGIN], hi = [b.hx + BOX_MARGIN, b.top + BOX_MARGIN, b.hz + BOX_MARGIN];
  const o = [ax, a.y, az], dir = [px - ax, p.y - a.y, pz - az];
  let t0 = 0, t1 = 1;
  for (let i = 0; i < 3; i++) {
    if (Math.abs(dir[i]) < 1e-9) { if (o[i] < lo[i] || o[i] > hi[i]) return false; continue; }
    let u = (lo[i] - o[i]) / dir[i], v = (hi[i] - o[i]) / dir[i];
    if (u > v) [u, v] = [v, u];
    t0 = Math.max(t0, u); t1 = Math.min(t1, v);
    if (t0 > t1) return false;
  }
  return true;
}

function segSphere(s, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
  const L = dx * dx + dy * dy + dz * dz || 1e-9;
  const t = Math.max(0, Math.min(1, ((s.x - a.x) * dx + (s.y - a.y) * dy + (s.z - a.z) * dz) / L));
  const x = a.x + dx * t - s.x, y = a.y + dy * t - s.y, z = a.z + dz * t - s.z;
  return x * x + y * y + z * z < s.r * s.r;
}
