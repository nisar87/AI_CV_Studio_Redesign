import { describe, expect, it } from 'vitest';
import { profileDigest } from '@/modules/jobs/digest';
import { driver } from '@/modules/resume/fixtures';
import { checkGap, progressOf } from './gap';

const digest = profileDigest(driver);
const realBullet = [...digest.lines.keys()].find((id) => /^J1\.B/.test(id))!;

describe('skill gap check', () => {
  const out = {
    skills: [
      {
        name: 'Multi-drop delivery',
        importance: 'core' as const,
        status: 'have' as const,
        evidence: [realBullet],
        note: 'Shown.',
      },
      // "Have" with only the summary → partly; with an invented id → missing.
      {
        name: 'Customer service',
        importance: 'core' as const,
        status: 'have' as const,
        evidence: ['SUMMARY'],
        note: '',
      },
      {
        name: 'Forklift licence',
        importance: 'core' as const,
        status: 'have' as const,
        evidence: ['J9.B9'],
        note: '',
      },
      // "Partly" with no evidence → missing.
      {
        name: 'Route software',
        importance: 'useful' as const,
        status: 'partly' as const,
        evidence: [],
        note: '',
      },
      {
        name: 'multi-drop delivery',
        importance: 'core' as const,
        status: 'missing' as const,
        evidence: [],
        note: 'dup',
      },
    ],
    plan: [
      { skill: 'Multi-drop delivery', why: 'x', how: 'y', proof: 'z', weeks: 2 },
      {
        skill: 'forklift licence',
        why: 'Needed.',
        how: 'Book a course at https://example.com/course today.',
        proof: 'Add it.',
        weeks: 40,
      },
      { skill: 'Made-up skill', why: 'x', how: 'y', proof: 'z', weeks: 2 },
      { skill: 'Route software', why: 'x', how: 'See www.example.org.', proof: 'z', weeks: 0 },
      { skill: 'Forklift licence', why: 'again', how: '', proof: '', weeks: 3 },
    ],
    summary: ' You have a strong base. ',
  };
  const r = checkGap(out, digest);

  it('resolves evidence to the CV and never trusts a "have" without it', () => {
    expect(r.skills.map((s) => [s.name, s.status])).toEqual([
      ['Multi-drop delivery', 'have'],
      ['Customer service', 'partly'],
      ['Forklift licence', 'missing'],
      ['Route software', 'missing'],
    ]);
    expect(r.skills[0]!.evidence[0]!.text).toBe(digest.lines.get(realBullet)!.text);
    expect(r.skills[2]!.evidence).toEqual([]);
  });

  it('plans only skills still to learn, once each, without links, weeks 1–26', () => {
    expect(r.plan.map((p) => p.skill)).toEqual(['Forklift licence', 'Route software']);
    expect(r.plan[0]!.how).toBe('Book a course at today.');
    expect(r.plan[1]!.how).toBe('See');
    expect(r.plan.map((p) => p.weeks)).toEqual([26, 1]);
    expect(r.plan.every((p) => p.status === 'todo')).toBe(true);
    expect(r.summary).toBe('You have a strong base.');
    expect(progressOf({ plan: r.plan })).toEqual({ done: 0, total: 2 });
  });
});
