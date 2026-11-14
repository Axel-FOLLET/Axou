/**
 * Maman's way down the slope: position and heading as a function of the scene clock, integrated once at set-up from the
 * tables of `tuning.js` (run, slide after the catch, stop, bolt away). Pure afterwards: `at(t)` always returns the same
 * values, so a capture started in the middle shows the same picture as a full run.
 */
import { CLOCK, RUN } from './tuning.js';
import { gradientAt, smoothstep } from './ground.js';

const STEP = 1 / 120;   // s: integration step
const SAMPLE_GAP = 1.5; // m: spacing of the points kept for distance queries

/** Heading (rad, 0 = +Z) before the catch: a gentle zig-zag. */
function serpentine(t) {
  return RUN.serpentine * Math.sin((2 * Math.PI * t) / RUN.serpentinePeriod + 0.6);
}

/** Heading at time t. After the catch she keeps the heading she had, then turns away at the separation. */
function headingAt(t) {
  const base = serpentine(Math.min(t, CLOCK.catch));
  return base + RUN.fleeTurn * smoothstep(CLOCK.fleeStart, CLOCK.fleeStart + RUN.fleeTurnTime, t);
}

/** Ground speed multiplier over the clock: 1 running, falls after the catch, zero while she is down, back to 1 when she bolts. */
function speedFactor(t) {
  if (t < CLOCK.catch) return 1;
  const slide = Math.exp(-(t - CLOCK.catch) / RUN.slide) * (1 - smoothstep(RUN.riseEnd - 0.6, RUN.riseEnd, t));
  const bolt = smoothstep(CLOCK.fleeStart, CLOCK.fleeStart + RUN.fleeRamp, t);
  return t < CLOCK.fleeStart ? slide : Math.max(slide, bolt);
}

/**
 * @param {number} runSpeed ground speed (m/s) of the `run` clip at the chosen clip rate, without sliding
 * @returns {{at: (t: number) => object, distance: (x: number, z: number) => number, points: Array<{x: number, z: number}>}}
 */
export function buildPath(runSpeed) {
  const n = Math.ceil((CLOCK.duration + 1) / STEP) + 1;
  const xs = new Float32Array(n), zs = new Float32Array(n), yaws = new Float32Array(n), vs = new Float32Array(n);
  let x = RUN.startX, z = RUN.startZ;
  const points = [];
  let lastKept = null;
  for (let i = 0; i < n; i++) {
    const t = i * STEP;
    const yaw = headingAt(t);
    // The clip speed is along the ground: the horizontal speed is smaller on a slope.
    const g = gradientAt(z) * Math.cos(yaw);
    const v = runSpeed * speedFactor(t) / Math.sqrt(1 + g * g);
    xs[i] = x; zs[i] = z; yaws[i] = yaw; vs[i] = v;
    if (!lastKept || Math.hypot(x - lastKept.x, z - lastKept.z) >= SAMPLE_GAP) { lastKept = { x, z }; points.push(lastKept); }
    x += Math.sin(yaw) * v * STEP;
    z += Math.cos(yaw) * v * STEP;
  }
  return {
    points,
    /** Position, heading and horizontal speed at time t (s). */
    at(t) {
      const f = Math.min(Math.max(t, 0) / STEP, n - 1.001), i = Math.floor(f), k = f - i;
      const l = (a) => a[i] + (a[i + 1] - a[i]) * k;
      return { x: l(xs), z: l(zs), yaw: l(yaws), speed: l(vs) };
    },
    /** Distance (m) from (x, z) to the way, to the nearest kept point (error under half the spacing). */
    distance(px, pz) {
      let best = Infinity;
      for (const p of points) {
        const d = (p.x - px) * (p.x - px) + (p.z - pz) * (p.z - pz);
        if (d < best) best = d;
      }
      return Math.sqrt(best);
    },
  };
}

export { speedFactor };
