import { describe, expect, it } from 'vitest';
import { CLEARING_FLAT, TERRAIN_SIZE, heightAt } from '../src/world/Terrain.js';
import { FOOT, SUMMIT, ZONE2, mountainHeight, pathClearance } from '../src/world/zone2.js';

/** Heights on a regular grid over the meadow. */
function meadowSamples(step) {
  const out = [];
  for (let x = -TERRAIN_SIZE; x <= TERRAIN_SIZE; x += step) {
    for (let z = -TERRAIN_SIZE; z <= TERRAIN_SIZE; z += step) out.push(heightAt(x, z));
  }
  return out;
}

describe('meadow terrain', () => {
  it('returns a finite height everywhere', () => {
    expect(meadowSamples(4).every(Number.isFinite)).toBe(true);
  });

  it('is deterministic', () => {
    expect(heightAt(12.5, -7.25)).toBe(heightAt(12.5, -7.25));
  });

  it('is flat in the clearing where the game starts', () => {
    const center = heightAt(0, 0);
    for (let a = 0; a < 16; a++) {
      const angle = (a / 16) * Math.PI * 2;
      const h = heightAt(Math.cos(angle) * (CLEARING_FLAT - 0.01), Math.sin(angle) * (CLEARING_FLAT - 0.01));
      expect(h).toBeCloseTo(center, 5);
    }
  });

  it('has no cliff a kitten could not walk: under 0.5 m per 0.25 m in the meadow', () => {
    const limit = 0.5;
    for (let x = -24; x < 24; x += 1.5) {
      for (let z = -24; z < 24; z += 1.5) {
        expect(Math.abs(heightAt(x + 0.25, z) - heightAt(x, z))).toBeLessThan(limit);
      }
    }
  });
});

describe('mountain zone', () => {
  // FOOT and SUMMIT are relative to the zone; the height and path functions take world coordinates.
  const foot = { x: ZONE2.x + FOOT.x, z: FOOT.z };
  const summit = { x: ZONE2.x + SUMMIT.x, z: SUMMIT.z };

  it('rises from the foot to the summit', () => {
    expect(mountainHeight(summit.x, summit.z)).toBeGreaterThan(mountainHeight(foot.x, foot.z) + 5);
  });

  it('counts the summit and the foot as being on the path (negative clearance is inside)', () => {
    expect(pathClearance(summit.x, summit.z)).toBeLessThan(0);
    expect(pathClearance(foot.x, foot.z)).toBeLessThan(0);
  });

  it('counts a point far from the path as outside', () => {
    expect(pathClearance(foot.x - 200, foot.z)).toBeGreaterThan(0);
  });

  it('is placed far from the meadow', () => {
    expect(ZONE2.x).toBeGreaterThan(TERRAIN_SIZE * 2);
  });
});
