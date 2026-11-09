import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { Duel, FIGHT } from '../src/game/combat.js';

/** Smallest kitten and boss a Duel can run on: no scene, no clips. */
function makeDuel(level) {
  const cat = {
    sword: false,
    root: { position: new THREE.Vector3(0, 0, 3), rotation: { y: 0 } },
    locomotion: { heading: 0 },
    brain: { brisk: false, scripted: null, target: null, setScripted: vi.fn(), walkTo: vi.fn(), refreshGrid: vi.fn() },
    duration: () => 1,
  };
  const boss = {
    root: { position: new THREE.Vector3(0, 0, 0), rotation: { y: 0 } },
    bossPlay: vi.fn(() => true),
    setPosition: vi.fn(),
    clipDone: false,
    pose: 'BrushHold',
    clipTime: 0,
  };
  const world = { scene: new THREE.Group(), inArena: false, arena: { setPhase2: vi.fn() } };
  return new Duel({ cat, boss, world, ground: () => 0, level });
}

describe('fight tuning', () => {
  it('derives boss health from the claw pace: 120 s at 1.70 s per hit', () => {
    expect(FIGHT.hp).toBe(71);
  });

  it('makes the sword fight last 30 s at its own pace', () => {
    const hits = FIGHT.hp / FIGHT.sword.damage;
    expect(hits * FIGHT.swordPace).toBeCloseTo(FIGHT.swordTime, 5);
  });
});

describe('Duel', () => {
  let duel;

  describe('on easy', () => {
    beforeEach(() => { duel = makeDuel('easy'); });

    it('starts with a full boss and a full kitten', () => {
      expect(duel.hp).toBe(FIGHT.hp);
      expect(duel.catHp).toBe(1);
    });

    it('falls back to easy on an unknown level', () => {
      expect(makeDuel('unknown').level).toBe('easy');
    });

    it('heals the boss by 10 % of its health when the kitten is hit', () => {
      duel.setHp(30);
      duel.hitCat({ knock: false });
      expect(duel.hp).toBeCloseTo(30 + 0.1 * FIGHT.hp, 5);
    });

    it('never heals the boss above its maximum', () => {
      duel.hitCat({ knock: false });
      expect(duel.hp).toBe(duel.maxHp);
    });

    it('never empties the kitten bar below the floor', () => {
      for (let k = 0; k < 40; k++) duel.hitCat({ knock: false });
      expect(duel.catHp).toBeCloseTo(duel.L.floor, 5);
      expect(duel.lost).toBe(false);
    });

    it('clamps test health to the valid range', () => {
      expect(duel.setHp(1000)).toBe(duel.maxHp);
    });

    it('starts the defeat once at 0 health and stops taking hits', () => {
      const onDefeat = vi.fn();
      duel.onDefeat = onDefeat;
      duel.setHp(0);
      duel.setHp(10);
      expect(onDefeat).toHaveBeenCalledTimes(1);
      expect(duel.b.mode).toBe('defeat');
      expect(duel.hp).toBe(0);
    });
  });

  it.each([['normal', 5], ['hard', 3]])('on %s the kitten is down after %i hits', (level, lives) => {
    duel = makeDuel(level);
    for (let k = 0; k < lives - 1; k++) duel.hitCat({ knock: false });
    expect(duel.lost).toBe(false);
    duel.hitCat({ knock: false });
    expect(duel.lost).toBe(true);
    expect(duel.catHp).toBe(0);
  });

  describe('phase 2 on hard', () => {
    beforeEach(() => { duel = makeDuel('hard'); });

    it('fires once when boss health reaches half', () => {
      const onPhase2 = vi.fn();
      duel.onPhase2 = onPhase2;
      duel.setHp(duel.maxHp * 0.6);
      expect(onPhase2).not.toHaveBeenCalled();
      duel.setHp(duel.maxHp * 0.5);
      duel.setHp(duel.maxHp * 0.4);
      expect(onPhase2).toHaveBeenCalledTimes(1);
    });

    it('does not exist on easy', () => {
      duel = makeDuel('easy');
      const onPhase2 = vi.fn();
      duel.onPhase2 = onPhase2;
      duel.setHp(duel.maxHp * 0.2);
      expect(onPhase2).not.toHaveBeenCalled();
    });
  });
});
