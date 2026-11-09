import { describe, expect, it } from 'vitest';
import { DEFAULT_NAME, NAME_MAX, cleanName } from '../src/game/playerName.js';

describe('cleanName', () => {
  it('falls back to the default name when empty', () => {
    expect(cleanName('')).toBe(DEFAULT_NAME);
    expect(cleanName('   ')).toBe(DEFAULT_NAME);
    expect(cleanName(null)).toBe(DEFAULT_NAME);
  });

  it('trims and collapses spaces', () => {
    expect(cleanName('  Mina   la  chatte ')).toBe('Mina la chatte');
  });

  it('removes invisible characters', () => {
    expect(cleanName('Mi​na\n')).toBe('Mina');
  });

  it('keeps accents, in composed form', () => {
    expect(cleanName('Zéphyr')).toBe('Zéphyr');
  });

  it('cuts at the maximum length', () => {
    expect(Array.from(cleanName('x'.repeat(40)))).toHaveLength(NAME_MAX);
  });

  it('does not separate a letter from its combining mark at the cut', () => {
    const name = cleanName(`${'x'.repeat(NAME_MAX - 1)}q́z`);
    expect(name).toBe('x'.repeat(NAME_MAX - 1));
  });
});
