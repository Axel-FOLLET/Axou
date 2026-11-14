/**
 * Ground height of the chase slope, a pure function of (x, z) once Maman's path is known. Used by the slope mesh, by
 * every actor standing on the ground and by the paint blasts. The slope is a mountain flank that is steep at the top
 * and eases towards the valley; two soft noises add drifts, but not on the way she runs along (it stays smooth).
 */
import * as THREE from 'three';
import { SLOPE } from './tuning.js';

const smoothstep = (a, b, x) => {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
};

/** Value noise in 0..1 without table or state: the same (x, z) always gives the same value. */
function valueNoise(x, z) {
  const ix = Math.floor(x), iz = Math.floor(z);
  const h = (i, j) => { const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return s - Math.floor(s); };
  const u = x - ix, w = z - iz, a = u * u * (3 - 2 * u), b = w * w * (3 - 2 * w);
  const h0 = h(ix, iz) + (h(ix + 1, iz) - h(ix, iz)) * a;
  const h1 = h(ix, iz + 1) + (h(ix + 1, iz + 1) - h(ix, iz + 1)) * a;
  return h0 + (h1 - h0) * b;
}

/** Slope (m of drop per m of z) at z, before the bumps. */
export function gradientAt(z) {
  const [top, bottom] = SLOPE.gradient;
  return top + (bottom - top) * smoothstep(SLOPE.easeFrom, SLOPE.easeFrom + SLOPE.easeLength, z);
}

/** Integral of smoothstep over [0, t]: t^3 - t^4 / 2 inside, a straight line beyond 1. */
function smoothIntegral(t) {
  if (t <= 0) return 0;
  if (t >= 1) return t - 0.5;
  return t * t * t - (t * t * t * t) / 2;
}

/** Height of the smooth mountain flank at (x, z), m (zero at the top of the mesh). */
export function baseHeight(x, z) {
  const [top, bottom] = SLOPE.gradient;
  const L = SLOPE.easeLength;
  const drop = top * (z - SLOPE.zTop) + (bottom - top) * L * smoothIntegral((z - SLOPE.easeFrom) / L);
  return -drop + Math.min(SLOPE.bowl * x * x, SLOPE.bowlMax);
}

/**
 * @param {(x: number, z: number) => number} distanceToPath distance (m) to Maman's way, which keeps the bumps away
 * @returns {{heightAt: (x: number, z: number) => number, normalAt: (x: number, z: number, out?: THREE.Vector3) => THREE.Vector3}}
 */
export function makeGround(distanceToPath) {
  const B = SLOPE.bump;
  const heightAt = (x, z) => {
    const w = smoothstep(SLOPE.bumpClear[0], SLOPE.bumpClear[1], distanceToPath(x, z));
    let h = baseHeight(x, z);
    if (w > 0) {
      h += w * (B.amp * (valueNoise(x * B.scale + 3, z * B.scale - 7) - 0.5) * 2
        + B.fine * (valueNoise(x * B.fineScale - 11, z * B.fineScale + 5) - 0.5) * 2);
    }
    return h;
  };
  const EPS = 0.25;
  const normalAt = (x, z, out = new THREE.Vector3()) => {
    const dx = (heightAt(x + EPS, z) - heightAt(x - EPS, z)) / (2 * EPS);
    const dz = (heightAt(x, z + EPS) - heightAt(x, z - EPS)) / (2 * EPS);
    return out.set(-dx, 1, -dz).normalize();
  };
  return { heightAt, normalAt };
}

export { smoothstep, valueNoise };
