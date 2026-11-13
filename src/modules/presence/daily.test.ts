import { describe, expect, it } from 'vitest';
import { lastDays } from './daily';

describe('lastDays', () => {
  it('returns the last n days oldest first, filling gaps with 0 and ignoring older days', () => {
    const r = lastDays(
      { '2026-11-13': 3, '2026-11-11': 1, '2026-10-01': 9 },
      4,
      new Date('2026-11-13T18:00:00Z'),
    );
    expect(r).toEqual([
      { day: '2026-11-10', n: 0 },
      { day: '2026-11-11', n: 1 },
      { day: '2026-11-12', n: 0 },
      { day: '2026-11-13', n: 3 },
    ]);
    expect(lastDays(undefined, 2, new Date('2026-01-01T00:00:00Z'))).toEqual([
      { day: '2025-12-31', n: 0 },
      { day: '2026-01-01', n: 0 },
    ]);
  });
});
