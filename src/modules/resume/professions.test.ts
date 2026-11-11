import { describe, expect, it } from 'vitest';
import { getProfession, PRESET_IDS, PROFESSIONS } from './professions';

describe('professions', () => {
  it('has exactly one entry per preset id, in a stable order', () => {
    expect(PROFESSIONS.map((p) => p.id)).toEqual([...PRESET_IDS]);
  });

  it('uses plain, non-empty labels and examples', () => {
    for (const p of PROFESSIONS) {
      expect(p.name.trim().length).toBeGreaterThan(3);
      expect(p.example.trim().length).toBeGreaterThan(3);
      expect(p.name).not.toMatch(/ATS|template|prompt/i);
    }
  });

  it('looks up by id', () => {
    expect(getProfession('driver')?.name).toBe('Driving & delivery');
    expect(getProfession('nope')).toBeUndefined();
  });
});
