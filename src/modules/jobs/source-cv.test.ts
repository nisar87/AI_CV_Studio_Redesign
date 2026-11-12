import { describe, expect, it } from 'vitest';
import { defaultSourceCv } from './source-cv';

describe('defaultSourceCv', () => {
  it('prefers the career profile', () => {
    expect(
      defaultSourceCv([
        { id: 'a', role: 'cv' },
        { id: 'p', role: 'profile' },
      ]),
    ).toBe('p');
  });
  it('skips tailored copies, even the newest one', () => {
    expect(
      defaultSourceCv([
        { id: 't2', role: 'cv', jobId: 'job2' },
        { id: 't1', role: 'cv', jobId: 'job1' },
        { id: 'base', role: 'cv' },
      ]),
    ).toBe('base');
  });
  it('falls back to the newest CV when every CV is tailored, and to nothing when empty', () => {
    expect(defaultSourceCv([{ id: 't', role: 'cv', jobId: 'j' }])).toBe('t');
    expect(defaultSourceCv([])).toBe('');
  });
});
