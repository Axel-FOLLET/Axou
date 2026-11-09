import { PATH_SEGMENTS, pathInside } from '../world/zone2.js';

/**
 * Slide of a fallen kitten, used by world/SnowCats.js: pure maths with no three.js and no state, so a Node test
 * bench can replay it along the whole path. "Downhill" is the reverse of the climb, segment by segment
 * (`PATH_SEGMENTS`, zone2.js), so the slide follows the bends instead of cutting across the bank.
 */

const _p = { x: 0, z: 0 };

/**
 * Writes the downhill direction of the path at (x, z) into `out` {x, z} (unit vector).
 * At the very start of a segment (the point is at its start or before it), the previous segment gives the
 * direction, so the kitten rounds the bend instead of hitting the outer bank.
 * @returns {object} The segment that gave the direction.
 */
export function downhill(x, z, out) {
  let best = Infinity, bi = 0, bt = 0;
  for (let i = 0; i < PATH_SEGMENTS.length; i++) {
    const p = PATH_SEGMENTS[i];
    const px = x - p.ax, pz = z - p.az;
    const raw = px * p.ux + pz * p.uz;
    const t = Math.min(Math.max(raw, 0), p.len);
    const c = Math.hypot(px - t * p.ux, pz - t * p.uz) - p.half;
    if (c < best) { best = c; bi = i; bt = raw; }
  }
  const s = PATH_SEGMENTS[bt <= 0.05 && bi > 0 ? bi - 1 : bi];
  out.x = -s.ux; out.z = -s.uz;
  return s;
}

/**
 * Moves `dist` m down the path from (x, z), in steps of at most `step` m (the direction is read again at each
 * step, so bends are followed). Each step is pulled back inside the corridor, `margin` m from its edge.
 * Writes the result into `out` {x, z}.
 * @returns {number} Distance actually travelled (m).
 */
export function slideDown(x, z, dist, margin, out, step = 0.2) {
  const dir = { x: 0, z: 0 };
  let moved = 0;
  out.x = x; out.z = z;
  while (moved < dist - 1e-6) {
    const d = Math.min(step, dist - moved);
    downhill(out.x, out.z, dir);
    const nx = out.x + dir.x * d, nz = out.z + dir.z * d;
    pathInside(nx, nz, margin, _p);
    moved += Math.hypot(_p.x - out.x, _p.z - out.z);
    // Stuck (no progress): exit rather than loop.
    if (Math.hypot(_p.x - out.x, _p.z - out.z) < 1e-4) break;
    out.x = _p.x; out.z = _p.z;
  }
  return moved;
}
