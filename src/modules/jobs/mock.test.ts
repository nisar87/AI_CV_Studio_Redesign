import { describe, expect, it } from 'vitest';
import { advance, checkFeedback, MOCK_QUESTIONS } from './mock';

const out = (q: string, summary = '') => ({
  feedback: {
    verdict: 'good' as const,
    star: { situation: true, task: false, action: true, result: false },
    quote: '“re-planned the route”',
    strengths: ['Clear example'],
    improve: ['Add the result'],
    tip: 'Mention the 120 parcels a day from your CV.',
  },
  next: { question: q, kind: 'situation' as const },
  summary,
});

describe('mock interview', () => {
  it('keeps a quote only when it is really in the answer', () => {
    expect(checkFeedback(out('').feedback, 'I re-planned the route quickly').quote).toBe(
      're-planned the route',
    );
    expect(checkFeedback(out('').feedback, 'I called my manager').quote).toBe('');
  });

  it('starts, records each answer with its feedback, and ends after the last question', () => {
    let s = advance(undefined, out('Q1'), '');
    expect(s.current?.question).toBe('Q1');
    expect(s.turns).toHaveLength(0);
    for (let i = 1; i < MOCK_QUESTIONS; i++) {
      s = advance(s, out(`Q${i + 1}`), `answer ${i}`);
      expect(s.turns).toHaveLength(i);
      expect(s.current?.question).toBe(`Q${i + 1}`);
    }
    s = advance(s, out('', 'Well done.'), 'last answer');
    expect(s.turns).toHaveLength(MOCK_QUESTIONS);
    expect(s.current).toBeNull();
    expect(s.summary).toBe('Well done.');
  });
});
