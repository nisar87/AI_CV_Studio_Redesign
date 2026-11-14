import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { runTask } from '@/modules/ai/run';
import { createMockProvider } from '@/modules/ai/providers/mock';
import { extractLines } from '@/modules/import/extract';
import { profileDigest } from '@/modules/jobs/digest';
import * as F from '@/modules/resume/fixtures';
import {
  exportFacts,
  LINKEDIN_LIMITS,
  looksLikeLinkedin,
  onPage,
  tidyReview,
  uniqueSkills,
  type ReviewSection,
} from './review';
import { LINKEDIN_SAMPLES as S } from './samples';

const lines = (t: string) => t.split('\n');
const models = { fast: 'f', smart: 's' };

describe('LinkedIn export', () => {
  it('reads the PDF fixture (made like LinkedIn’s “Save to PDF”) as the sample text', async () => {
    const pdf = readFileSync(join(__dirname, '../import/__fixtures__/linkedin-export.pdf'));
    const r = await extractLines(new Uint8Array(pdf));
    expect(r.scanned).toBe(false);
    expect(r.lines.join('\n')).toBe(S.DRIVER);
    expect(looksLikeLinkedin(r.lines)).toBe(true);
  });

  it('tells a LinkedIn export from other documents', () => {
    expect(looksLikeLinkedin(lines(S.DRIVER))).toBe(true);
    expect(looksLikeLinkedin(lines(S.ENGINEER))).toBe(true);
    expect(looksLikeLinkedin(lines(S.NOT_LINKEDIN))).toBe(false);
    // An ordinary CV has "Experience" and "Education" too, but not LinkedIn's other headings.
    const cv = [
      'Imran Qureshi',
      'Profile',
      'Reliable driver',
      'Experience',
      'Swift Logistics',
      'Education',
      'GCSEs',
    ];
    expect(looksLikeLinkedin(cv)).toBe(false);
  });

  it('counts facts from the file', () => {
    expect(exportFacts(lines(S.DRIVER))).toEqual({
      hasSummary: true,
      summaryChars: 'Hard working driver looking for new opportunities.'.length,
      jobs: 2,
      topSkills: 3,
      hasCertifications: true,
      defaultUrl: true,
    });
    const e = exportFacts(lines(S.ENGINEER));
    expect(e.jobs).toBe(2);
    expect(e.defaultUrl).toBe(false);
    expect(exportFacts(['Experience', 'Acme', 'Driver']).hasSummary).toBe(false);
  });
});

describe('quotes must be on the page', () => {
  it('accepts the export’s own words, across line breaks and split words', () => {
    expect(onPage(S.DRIVER, 'Driver at Swift Logistics')).toBe(true);
    expect(onPage(S.DRIVER, 'driver at swift logistics')).toBe(true);
    expect(onPage(S.DRIVER, 'www.linkedin.com/in/imran-qureshi-4b2a91')).toBe(true);
    expect(
      onPage(
        S.ENGINEER,
        'I build reliable payment and logistics systems and help teams move off old platforms',
      ),
    ).toBe(true);
    expect(onPage(S.ENGINEER, 'I build reliable payment … no unplanned downtime.')).toBe(true);
  });
  it('refuses words that aren’t there', () => {
    expect(onPage(S.DRIVER, 'Award-winning driver with 20 years')).toBe(false);
    expect(onPage(S.DRIVER, '')).toBe(false);
    expect(onPage(S.DRIVER, 'I build reliable … Delivering parcels.')).toBe(false);
  });
});

const sec = (o: Partial<ReviewSection>): ReviewSection => ({
  key: 'headline',
  title: 'Headline',
  status: 'improve',
  current: '',
  notes: ['A note.'],
  rewrite: 'Text',
  ...o,
});

describe('tidying the review', () => {
  it('lists each skill once, whatever its case', () => {
    expect(
      uniqueSkills('Driving, Customer Service, customer service;Time management\nDriving'),
    ).toBe('Driving, Customer Service, Time management');
    const r = tidyReview(
      { overall: '', sections: [sec({ key: 'skills', title: 'Skills', rewrite: 'A, a, B' })] },
      S.DRIVER,
    );
    expect(r.sections[0]!.rewrite).toBe('A, B');
  });

  it('drops quotes that aren’t in the export, and quotes on missing sections', () => {
    const r = tidyReview(
      {
        overall: ' Good start. ',
        sections: [
          sec({ current: 'Driver at Swift Logistics' }),
          sec({ key: 'about', title: 'About', current: 'Invented text', status: 'improve' }),
          sec({ key: 'skills', title: 'Skills', current: 'Driving', status: 'missing' }),
        ],
      },
      S.DRIVER,
    );
    expect(r.overall).toBe('Good start.');
    expect(r.sections.map((s) => s.current)).toEqual(['Driver at Swift Logistics', '', '']);
  });

  it('fits LinkedIn’s limits, sorts by profile order, removes empty and repeated sections', () => {
    const r = tidyReview(
      {
        overall: '',
        sections: [
          sec({ key: 'skills', title: 'Skills' }),
          sec({ key: 'headline', rewrite: `${'Driver | '.repeat(40)}end` }),
          sec({ key: 'headline' }),
          sec({ key: 'education', title: 'Education', notes: [], rewrite: '' }),
          sec({ key: 'about', title: 'About', status: 'good', rewrite: 'should go' }),
          sec({ key: 'nonsense' as never, title: 'Something' }),
        ],
      },
      S.DRIVER,
    );
    expect(r.sections.map((s) => s.key)).toEqual(['headline', 'about', 'skills', 'other']);
    expect(r.sections[0]!.rewrite.length).toBeLessThanOrEqual(LINKEDIN_LIMITS.headline);
    expect(r.sections[1]!.rewrite).toBe('');
  });
});

describe('the linkedin.review task', () => {
  const fake = (out: unknown) => ({
    name: 'fake',
    generate: async () => ({
      text: JSON.stringify(out),
      usage: { inputTokens: 1, outputTokens: 1 },
    }),
  });
  const input = {
    export: S.DRIVER,
    facts: '',
    profile: profileDigest(F.driver).text,
    target: '',
  };

  it('marks invented facts in suggested text, drops advice with invented numbers and false quotes', async () => {
    const r = await runTask('linkedin.review', input, 0, {
      provider: fake({
        isLinkedin: true,
        overall: 'Your jobs are clear.',
        sections: [
          {
            key: 'experience',
            title: 'Experience — Multi-drop Van Driver, Swift Logistics',
            status: 'improve',
            current: 'Delivering parcels.',
            notes: ['Say how many parcels you deliver.', 'Profiles with 17 skills get more views.'],
            rewrite: 'I deliver around 120 parcels a day and won Driver of the Year 2020.',
          },
          {
            key: 'headline',
            title: 'Headline',
            status: 'improve',
            current: 'Award-winning driver',
            notes: ['Lead with what you do.'],
            rewrite: 'Multi-drop Van Driver | Route planning | Driver CPC',
          },
        ],
      }) as never,
      models,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const [headline, job] = r.result.sections;
    expect(headline!.key).toBe('headline');
    expect(headline!.current).toBe(''); // not in the export
    expect(headline!.rewrite).toBe('Multi-drop Van Driver | Route planning | Driver CPC');
    // 120 is on the CV; the award and its year are not.
    expect(job!.rewrite).toContain('120 parcels');
    expect(job!.rewrite).toContain('{{?');
    expect(job!.notes).toEqual(['Say how many parcels you deliver.']);
    expect(r.findings.length).toBeGreaterThan(0);
  });

  it('returns nothing for a file that isn’t a LinkedIn export', async () => {
    const r = await runTask('linkedin.review', { ...input, export: S.NOT_LINKEDIN }, 0, {
      provider: fake({
        isLinkedin: false,
        overall: 'x',
        sections: [
          { key: 'other', title: 'x', status: 'improve', current: '', notes: ['x'], rewrite: 'x' },
        ],
      }) as never,
      models,
    });
    expect(r.ok && r.result).toEqual({ isLinkedin: false, overall: '', sections: [] });
  });

  it('works end to end with the demo provider (the e2e tests use it)', async () => {
    const r = await runTask('linkedin.review', input, 0, {
      provider: createMockProvider(),
      models,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const keys = r.result.sections.map((s) => s.key);
    expect(keys[0]).toBe('headline');
    expect(keys).toContain('contact');
    const city = r.result.sections.find((s) => /CityLink/.test(s.title))!;
    expect(city.status).toBe('missing');
    expect(r.result.sections.find((s) => s.key === 'education')).toMatchObject({ current: '' });
    for (const s of r.result.sections)
      if (s.current) expect(onPage(S.DRIVER, s.current)).toBe(true);
  });
});
