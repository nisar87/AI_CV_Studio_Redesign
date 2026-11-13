import { describe, expect, it } from 'vitest';
import { driver, engineer } from '@/modules/resume/fixtures';
import type { ResumeDocument } from '@/modules/resume/schema';
import { profileDigest } from '@/modules/jobs/digest';
import { assessReadBack, checkKeywords } from './ats';

/** What a plain single-column PDF of this CV reads back as (one line per field, in order). */
function plainLines(doc: ResumeDocument): string[] {
  const b = doc.basics;
  const out = [b.name, b.headline, [b.email, b.phone, b.location].filter(Boolean).join(' | ')];
  if (b.summary) out.push('Profile', b.summary);
  for (const s of doc.sections) {
    if (s.hidden || !s.items.length) continue;
    out.push(s.title);
    for (const it of s.items as unknown as Record<string, unknown>[]) {
      if ('role' in it) {
        out.push(`${it.role}  ${it.start} – ${it.current ? 'Present' : it.end}`);
        out.push(`${it.organization}${it.location ? `, ${it.location}` : ''}`);
        for (const x of (it.bullets as string[]) ?? []) out.push(`• ${x}`);
      } else
        for (const [k, v] of Object.entries(it))
          if (k !== 'id' && typeof v === 'string' && v) out.push(v);
          else if (Array.isArray(v)) out.push((v as string[]).join(', '));
    }
  }
  return out.filter(Boolean);
}
const status = (checks: ReturnType<typeof assessReadBack>) =>
  Object.fromEntries(checks.map((c) => [c.id, c.status]));

describe('ATS check from the text read back', () => {
  it('passes a CV that reads back in full and in order', () => {
    const s = status(assessReadBack(driver, plainLines(driver), { pages: 1 }));
    expect(s).toMatchObject({ contact: 'pass', jobs: 'pass', order: 'pass', length: 'pass' });
  });

  it('flags lost contact details, a lost employer and points read after the next job', () => {
    const lines = plainLines(engineer);
    const jobs = engineer.sections.find((x) => x.kind === 'experience')!.items as {
      role: string;
      organization: string;
      bullets: string[];
    }[];
    const without = lines
      .filter((l) => !l.includes(engineer.basics.email))
      .filter((l) => !l.startsWith(jobs[2]!.organization));
    // Move job 1's first point after job 2's title (a two-column mix-up).
    const b = without.findIndex((l) => l === `• ${jobs[0]!.bullets[0]}`);
    const [bullet] = without.splice(b, 1);
    const r2 = without.findIndex((l) => l.startsWith(jobs[1]!.role));
    without.splice(r2 + 1, 0, bullet!);
    const checks = assessReadBack(engineer, without, { pages: 3 });
    const s = status(checks);
    expect(s.contact).toBe('needs-work');
    expect(s.jobs).toBe('needs-work');
    expect(s.order).toBe('needs-work');
    expect(s.length).toBe('info');
    // Fixes point to the ATS-safe version (Design tab).
    expect(checks.find((c) => c.id === 'order')!.where).toBe('design');
    expect(checks.find((c) => c.id === 'jobs')!.examples![0]).toContain(jobs[2]!.organization);
  });

  it('notes columns and a photo, and passes the ATS-safe version', () => {
    const side: ResumeDocument = {
      ...driver,
      design: { ...driver.design, templateId: 'meridian' },
    };
    const v1 = status(assessReadBack(side, plainLines(side), { pages: 1 }));
    expect(v1.layout).toBe('info');
  });
});

describe('ATS keywords', () => {
  it('re-checks presence itself and only keeps real line ids for missing terms', () => {
    const d = profileDigest(driver);
    const k = checkKeywords(
      {
        terms: [
          { term: 'Route planning', line: '' },
          { term: 'Forklift licence', line: 'J1.B1' },
          { term: 'Customer service', line: '' },
          { term: 'customer service', line: '' },
          { term: 'Telematics', line: 'NOPE' },
        ],
      },
      d,
      'Delivery Driver',
    );
    expect(k.present).toEqual(expect.arrayContaining(['Route planning', 'Customer service']));
    expect(k.present).toHaveLength(2);
    expect(k.missing).toEqual([
      {
        term: 'Forklift licence',
        line: { text: d.lines.get('J1.B1')!.text, ref: d.lines.get('J1.B1')!.ref },
      },
      { term: 'Telematics' },
    ]);
  });
});

describe('ATS check — real-CV regressions (owner’s CV, R8.4 live check)', () => {
  it('reads words, not structure; bilingual headings pass like the health check', () => {
    const doc = structuredClone(driver);
    for (const s of doc.sections)
      if (s.kind === 'experience') s.title = 'WORK HISTORY / BERUFSERFAHRUNG';
    // A layout our rules parser can't structure, but whose words are all there.
    const words = plainLines(doc).map((l) => l.toUpperCase());
    const s = status(assessReadBack(doc, words, { pages: 1 }));
    expect(s.readable).toBe('pass');
    expect(s.headings).toBe('pass');
  });
});

describe('keyword stems', () => {
  it('matches spelling variants and word forms, not unrelated words', async () => {
    const { cvHasTerm } = await import('@/modules/jobs/match');
    const cv = 'Query Optimization; Performance Tuning; data validation; automated reporting';
    expect(cvHasTerm(cv, 'query optimisation')).toBe(true);
    expect(cvHasTerm(cv, 'tune')).toBe(true);
    expect(cvHasTerm(cv, 'validate')).toBe(true);
    expect(cvHasTerm(cv, 'automating reports')).toBe(true);
    expect(cvHasTerm(cv, 'Kubernetes')).toBe(false);
    expect(cvHasTerm(cv, 'data science')).toBe(false);
  });
});
