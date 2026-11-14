import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { CUTSCENES, hasSeen, markSeen } from '../src/ui/CutscenePlayer.js';

const PUBLIC = path.resolve(__dirname, '..', 'public');

/** In-memory stand-in for `localStorage`. */
const fakeStorage = () => {
  const data = new Map();
  return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => data.set(k, String(v)) };
};

describe('cutscene files', () => {
  it.each(Object.keys(CUTSCENES))('cutscene %s has its video', (name) => {
    expect(fs.existsSync(path.join(PUBLIC, CUTSCENES[name].src))).toBe(true);
  });
});

describe('cutscene memory', () => {
  it('only the first cutscene can be skipped, with its own memory key', () => {
    expect(Object.keys(CUTSCENES).filter((n) => CUTSCENES[n].skippable)).toEqual(['arrival']);
    expect(CUTSCENES.arrival.seenKey).toBeTruthy();
  });

  it('remembers a cutscene watched to the end', () => {
    const store = fakeStorage();
    expect(hasSeen('arrival', store)).toBe(false);
    markSeen('arrival', store);
    expect(hasSeen('arrival', store)).toBe(true);
  });

  it('keeps no memory for a cutscene that cannot be skipped', () => {
    const store = fakeStorage();
    markSeen('sword', store);
    expect(hasSeen('sword', store)).toBe(false);
  });

  it('survives a storage that is missing or refuses', () => {
    const broken = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('full'); } };
    expect(hasSeen('arrival', broken)).toBe(false);
    expect(() => markSeen('arrival', broken)).not.toThrow();
    expect(hasSeen('arrival', null)).toBe(false);
  });
});
