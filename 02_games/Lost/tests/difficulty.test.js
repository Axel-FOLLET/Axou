import { describe, expect, it } from 'vitest';
import { LEVELS, LEVEL_ORDER } from '../src/game/difficulty.js';

const ordered = LEVEL_ORDER.map((key) => LEVELS[key]);

describe('difficulty table', () => {
  it('lists every level exactly once, from easiest to hardest', () => {
    expect([...LEVEL_ORDER].sort()).toEqual(Object.keys(LEVELS).sort());
  });

  it.each(LEVEL_ORDER)('%s has usable values', (key) => {
    const L = LEVELS[key];
    expect(L.lives).toBeGreaterThan(0);
    expect(L.heal).toBeGreaterThanOrEqual(0);
    expect(L.first).toBeGreaterThan(0);
    expect(L.announce).toBeLessThan(L.cadence);
    expect(L.floor).toBe(L.canLose ? 0 : L.floor);
    expect(L.phase2.at).toBeGreaterThan(0);
    expect(L.phase2.at).toBeLessThan(1);
  });

  it.each(LEVEL_ORDER)('%s only uses paint shapes it defines', (key) => {
    const { paint } = LEVELS[key];
    for (const shape of paint.shapes) expect(paint[shape]).toBeDefined();
    expect(paint.on).toBe(paint.shapes.length > 0);
  });

  it('gets harder at each step: fewer lives, faster attacks, shorter warnings', () => {
    for (let k = 1; k < ordered.length; k++) {
      expect(ordered[k].lives).toBeLessThan(ordered[k - 1].lives);
      expect(ordered[k].cadence).toBeLessThan(ordered[k - 1].cadence);
      expect(ordered[k].announce).toBeLessThan(ordered[k - 1].announce);
    }
  });
});
