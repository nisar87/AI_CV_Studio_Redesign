import { describe, expect, it } from 'vitest';
import { matchStories, storyAsAnswer, storyInput, storyLines, type Story } from './schema';

const mk = (over: Partial<Story>): Story => ({
  ...storyInput.parse({ title: 'x', ...over }),
  id: over.id ?? crypto.randomUUID(),
  createdAt: '2026-11-01T00:00:00Z',
  updatedAt: over.updatedAt ?? '2026-11-01T00:00:00Z',
});

const routes = mk({
  id: 'routes',
  title: 'Re-planned routes after a depot closed',
  situation: 'Our Leicester depot closed for a week.',
  action: 'I re-planned 40 drops a day across two vans.',
  result: 'Every timed slot was met.',
  skills: ['Route planning', 'Problem solving'],
});
const team = mk({
  id: 'team',
  title: 'Trained two new drivers',
  action: 'I showed them the vehicle checks and rode along for a week.',
  skills: ['Leadership', 'Training'],
});
const draft = mk({ id: 'draft', title: 'Customer complaint', skills: ['Customer service'] });

describe('story bank', () => {
  it('cleans input: trims, dedupes tags case-insensitively, defaults the source', () => {
    const s = storyInput.parse({ title: '  A  ', skills: ['Leadership', 'leadership', ' Teams '] });
    expect(s.title).toBe('A');
    expect(s.skills).toEqual(['Leadership', 'Teams']);
    expect(s.source).toEqual({ kind: 'manual', ref: '' });
    expect(storyInput.safeParse({ title: '' }).success).toBe(false);
  });

  it('reads as one answer in STAR order', () => {
    expect(storyAsAnswer(routes)).toBe(
      'Our Leicester depot closed for a week. I re-planned 40 drops a day across two vans. Every timed slot was met.',
    );
  });

  it('matches a question by skill tag, then by words; unfinished stories are never offered', () => {
    expect(matchStories([routes, team, draft], 'Tell me about a time you led a team')).toEqual([]);
    expect(
      matchStories([routes, team, draft], 'Describe your leadership when training someone').map(
        (s) => s.id,
      ),
    ).toEqual(['team']);
    expect(
      matchStories([routes, team, draft], 'How do you plan a route when a depot closes?').map(
        (s) => s.id,
      )[0],
    ).toBe('routes');
    expect(matchStories([draft], 'Tell me about customer service')).toEqual([]);
    expect(matchStories([routes], '')).toEqual([]);
  });

  it('gives the AI numbered lines of finished stories only', () => {
    const t = storyLines([routes, draft, team]);
    expect(t.split('\n')).toHaveLength(2);
    expect(t).toMatch(
      /^S1: Re-planned routes after a depot closed \[Route planning, Problem solving\] — Our/,
    );
    expect(t).toContain('S2: Trained two new drivers');
  });
});
