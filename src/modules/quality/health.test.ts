import { describe, expect, it } from 'vitest';
import * as F from '@/modules/resume/fixtures';
import type { ExperienceItem, ResumeDocument } from '@/modules/resume/schema';
import { healthCheck } from './health';

const NOW = new Date('2026-11-12T00:00:00Z');
const ids = (d: ResumeDocument, pages?: number) =>
  healthCheck(d, { now: NOW, pages }).findings.map((f) => f.id);

function withJobs(jobs: Partial<ExperienceItem>[]): ResumeDocument {
  const d = structuredClone(F.driver);
  const s = d.sections.find((x) => x.kind === 'experience')!;
  s.items = jobs.map((j, i) => ({
    id: `j${i}`,
    role: 'Driver',
    organization: 'Co',
    location: '',
    start: '2020-01',
    end: '2021-01',
    current: false,
    bullets: ['Delivered 120 parcels a day'],
    ...j,
  })) as never;
  return d;
}

describe('healthCheck', () => {
  it('passes a well-made sample CV with no fixes needed', () => {
    for (const d of [F.driver, F.teacher, F.engineer]) {
      const r = healthCheck(d, { now: NOW, pages: 1 });
      expect(
        r.findings.filter((f) => f.severity === 'fix'),
        d.basics.name,
      ).toEqual([]);
      expect(r.passed.length).toBeGreaterThan(3);
    }
  });

  it('asks for contact details and a real email', () => {
    const d = structuredClone(F.driver);
    d.basics.email = '';
    d.basics.phone = '';
    expect(ids(d)).toContain('contact');
    d.basics.email = 'imran@gmail';
    expect(ids(d)).toContain('email-format');
  });

  it('finds date problems and points at the job', () => {
    const d = withJobs([
      { start: '', end: '', current: false, role: 'Picker' },
      { start: '2022-05', end: '2021-01' },
      { start: '2027-01', end: '', current: true },
    ]);
    const r = healthCheck(d, { now: NOW });
    const missing = r.findings.find((f) => f.id === 'dates-missing')!;
    expect(missing.examples).toEqual(['Picker']);
    expect(missing.ref).toMatch(/\/j0$/);
    expect(r.findings.map((f) => f.id)).toEqual(
      expect.arrayContaining(['dates-order', 'dates-future']),
    );
  });

  it('flags older jobs listed first, and a long gap, neutrally', () => {
    const d = withJobs([
      { start: '2015-01', end: '2016-01' },
      { start: '2020-01', end: '', current: true },
    ]);
    expect(ids(d)).toContain('order');
    const g = healthCheck(
      withJobs([
        { start: '2020-01', end: '', current: true },
        { start: '2015-01', end: '2017-06' },
      ]),
      { now: NOW },
    ).findings.find((f) => f.id === 'gap');
    expect(g?.title).toMatch(/about 3 years/);
  });

  it('suggests clearer points without asking for untrue facts', () => {
    const d = withJobs([
      {
        bullets: ['Responsible for loading the van', 'I drove the route every day', 'Kept records'],
      },
      { bullets: ['Responsible for loading the van'] },
    ]);
    const r = healthCheck(d, { now: NOW });
    const got = r.findings.map((f) => f.id);
    expect(got).toEqual(
      expect.arrayContaining(['weak-openings', 'first-person', 'duplicates', 'numbers']),
    );
    expect(r.findings.find((f) => f.id === 'numbers')!.detail).toMatch(
      /Only add numbers you can stand behind/,
    );
  });

  it('notices personal details, placeholders and length', () => {
    const d = structuredClone(F.teacher);
    d.basics.summary = 'Teacher. Date of birth: 1990. Taught {{?how many}} pupils.';
    expect(ids(d, 3)).toEqual(
      expect.arrayContaining(['personal-details', 'placeholders', 'length']),
    );
  });

  it('lists fixes before improvements', () => {
    const d = withJobs([{ start: '', end: '', bullets: [] }]);
    d.basics.location = '';
    const sev = healthCheck(d, { now: NOW }).findings.map((f) => f.severity);
    expect(sev.indexOf('improve')).toBeGreaterThan(sev.lastIndexOf('fix'));
  });
});

describe('section headings', () => {
  it('flags a creative heading and accepts usual or bilingual ones', () => {
    const doc = structuredClone(F.FIXTURES.driver);
    const exp = doc.sections.find((s) => s.kind === 'experience')!;
    exp.title = 'PROFESSIONAL EXPERIENCE / BERUFSERFAHRUNG';
    expect(healthCheck(doc).findings.map((f) => f.id)).not.toContain('heading-names');
    exp.title = 'My Journey';
    const f = healthCheck(doc).findings.find((x) => x.id === 'heading-names');
    expect(f?.detail).toContain('Experience');
    expect(f?.ref).toBe(exp.id);
  });
});
