import { describe, expect, it } from 'vitest';
import { LETTER_TYPES, LETTER_TYPE, fill, missingAnswers, starterLetter } from './types';

describe('letter types', () => {
  it('has the seven library letters plus a general cover letter, each a 3–5 question form', () => {
    expect(LETTER_TYPES.map((t) => t.id)).toEqual([
      'cover',
      'resignation',
      'reference',
      'thank-you',
      'follow-up',
      'offer-accept',
      'salary',
      'networking',
    ]);
    for (const t of LETTER_TYPES) {
      expect(t.questions.length).toBeGreaterThanOrEqual(3);
      expect(t.questions.length).toBeLessThanOrEqual(5);
      expect(t.questions.some((q) => q.required)).toBe(true);
      // Every placeholder names a question.
      const ids = new Set(t.questions.map((q) => q.id));
      for (const line of [...t.starter, t.subject])
        for (const m of line.matchAll(/\{(\w+)/g)) expect(ids, `${t.id}: ${m[1]}`).toContain(m[1]);
    }
  });

  it('fills answers, drops lines with a missing answer, and handles optional prefixes', () => {
    expect(
      fill('role of {role}{organisation: at }.', { role: 'Driver', organisation: 'Acme' }),
    ).toBe('role of Driver at Acme.');
    expect(fill('role of {role}{organisation: at }.', { role: 'Driver' })).toBe('role of Driver.');
    expect(fill('{thanks}', {})).toBeNull();
    expect(fill('meet me{when:} to', { when: 'yesterday' })).toBe('meet me yesterday to');
    expect(fill('meet me{when:} to', {})).toBe('meet me to');
  });

  it('builds a complete starter draft from the required answers alone', () => {
    for (const t of LETTER_TYPES) {
      const answers = Object.fromEntries(
        t.questions.filter((q) => q.required).map((q) => [q.id, `X-${q.id}`]),
      );
      expect(missingAnswers(t, answers)).toEqual([]);
      const s = starterLetter(t, answers);
      expect(s.paragraphs.length, t.id).toBeGreaterThanOrEqual(2);
      expect(s.paragraphs.join(' ')).not.toMatch(/[{}]/);
      expect(s.subject).not.toMatch(/[{}]/);
    }
    const r = starterLetter(LETTER_TYPE.resignation, {
      role: 'Driver',
      organisation: 'Swift',
      lastDay: '31 December 2026',
    });
    expect(r.paragraphs[0]).toContain(
      'my role as Driver at Swift. My last working day will be 31 December 2026.',
    );
    expect(r.subject).toBe('Resignation');
  });
});
