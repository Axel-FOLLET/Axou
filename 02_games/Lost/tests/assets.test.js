import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { TRACKS } from '../src/audio/Music.js';
import { SFX } from '../src/audio/CombatSfx.js';
import { VOLUMES } from '../src/audio/volumes.js';

const SOUNDS = path.resolve(__dirname, '..', 'public', 'sounds');
const exists = (file) => fs.existsSync(path.join(SOUNDS, file));

describe('sound files', () => {
  it.each(Object.keys(TRACKS))('music track %s has its files', (name) => {
    const track = TRACKS[name];
    expect(exists(track.file)).toBe(true);
    if (track.intro) {
      expect(exists(track.intro)).toBe(true);
      expect(track.lead).toBeGreaterThan(0);
    }
  });

  it.each(Object.keys(SFX.events))('sound effect %s has its file and volume', (name) => {
    const event = SFX.events[name];
    expect(exists(event.file)).toBe(true);
    expect(VOLUMES.combat[event.gain]).toBeGreaterThan(0);
  });

  it('gives every music track a volume', () => {
    for (const [name, track] of Object.entries(TRACKS)) {
      expect(VOLUMES.music.tracks[track.volume ?? name]).toBeGreaterThan(0);
    }
  });
});
