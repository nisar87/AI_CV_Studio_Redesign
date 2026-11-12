import { describe, expect, it } from 'vitest';
import * as F from '@/modules/resume/fixtures';
import type { ExperienceItem } from '@/modules/resume/schema';
import { profileDigest } from './digest';
import { applyTailor, checkMatch, cvHasTerm } from './match';

const d = profileDigest(F.driver);
const firstJob = () =>
  F.driver.sections.find((s) => s.kind === 'experience')!.items[0] as ExperienceItem;

describe('profile digest', () => {
  it('numbers every line and keeps the field it came from', () => {
    expect(d.text).toMatch(/^NAME: Imran Qureshi/m);
    expect(d.text).toMatch(/^J1: .+/m);
    expect(d.text).toMatch(/^J1\.B1: .+/m);
    expect(d.lines.get('J1.B1')?.ref).toMatch(/\//);
    expect(d.jobs.get('J1')?.bullets.length).toBe(firstJob().bullets.filter(Boolean).length);
  });
});

describe('checkMatch', () => {
  it('drops invented evidence ids, downgrades unsupported "met", re-checks keywords', () => {
    const r = checkMatch(
      {
        summary: 'ok',
        requirements: [
          {
            text: 'Driving licence',
            importance: 'must',
            status: 'met',
            evidence: ['J1.B1', 'J99.B1'],
            note: '',
          },
          { text: 'Forklift', importance: 'nice', status: 'met', evidence: ['NOPE'], note: '' },
          { text: 'Welding', importance: 'nice', status: 'missing', evidence: ['J1.B1'], note: '' },
        ],
        keywords: ['parcels', 'Parcels', 'forklift'],
      },
      d,
      { sourceTitle: 'Career profile' },
    );
    expect(r.requirements[0]!.evidence).toEqual([
      { text: d.lines.get('J1.B1')!.text, ref: d.lines.get('J1.B1')!.ref },
    ]);
    expect(r.requirements[1]!.status).toBe('partial');
    expect(r.requirements[2]!.evidence).toEqual([]);
    expect(r.keywords.map((k) => k.term)).toEqual(['parcels', 'forklift']);
    expect(r.keywords.find((k) => k.term === 'forklift')!.found).toBe(false);
  });

  it('treats the headline or summary alone as "partly", not proof', () => {
    const req = (evidence: string[]) => ({
      text: 'Forklift licence',
      importance: 'must' as const,
      status: 'met' as const,
      evidence,
      note: '',
    });
    const r = checkMatch(
      { summary: '', keywords: [], requirements: [req(['SUMMARY']), req(['SUMMARY', 'CERT1'])] },
      d,
      { sourceTitle: 'CV' },
    );
    expect(r.requirements.map((x) => x.status)).toEqual(['partial', 'met']);
    expect(r.requirements[0]!.evidence).toHaveLength(1);
  });

  it('finds terms as whole words, tolerating plurals', () => {
    expect(cvHasTerm('Delivered 120 parcels a day', 'parcel')).toBe(true);
    expect(cvHasTerm('Multi-drop deliveries', 'delivery')).toBe(true);
    expect(cvHasTerm('Driver', 'river')).toBe(false);
  });
});

describe('applyTailor', () => {
  it('reorders bullets and skills only — never adds or drops a fact', () => {
    const job = d.jobs.get('J1')!;
    const reversed = [...job.bullets].reverse().map((b) => b.id);
    const t = applyTailor(
      F.driver,
      {
        headline: 'Delivery Driver',
        summary: 'Reliable driver.',
        order: [{ job: 'J1', bullets: [reversed[0]!, 'J1.B99'] }],
        skills: [...d.skills].reverse().concat(['Invented skill']),
      },
      d,
      { id: 'job-1', title: 'Delivery Driver', company: 'Swift' },
    );
    const before = firstJob().bullets.filter(Boolean);
    const after = (
      t.sections.find((s) => s.kind === 'experience')!.items[0] as ExperienceItem
    ).bullets.filter(Boolean);
    expect(after[0]).toBe(before[before.length - 1]);
    expect([...after].sort()).toEqual([...before].sort());
    const skills = t.sections
      .filter((s) => s.kind === 'skills')
      .flatMap((s) => s.items.flatMap((g) => g.keywords));
    expect([...skills].sort()).toEqual([...d.skills].sort());
    expect(skills).not.toContain('Invented skill');
    expect(t).toMatchObject({
      jobId: 'job-1',
      parentId: F.driver.id,
      basics: { headline: 'Delivery Driver' },
    });
    expect(t.title).toBe('Imran Qureshi — Delivery Driver (Swift)');
  });
});
